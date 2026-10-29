# Non-Owning Views & C++20 Heterogeneous Lookup

## 1. Cơ chế mức thấp

`std::span<T>` và `std::string_view` là **fat pointer 16 byte** (ptr 8B + size 8B trên LP64), không sở hữu bộ nhớ, không gọi allocator. Truyền chúng qua thanh ghi (`rdi`/`rsi` theo SysV AMD64 ABI) nên chi phí bằng đúng 2 lần `mov` — thay thế `const std::string&` để triệt tiêu việc dựng `std::string` tạm khi caller đưa vào `const char*`. Heterogeneous Lookup (`is_transparent`) cho phép `unordered_map<std::string, V>::find(string_view)` băm trực tiếp trên view, loại bỏ hoàn toàn allocation của khóa tạm.

## 2. Bố cục bộ nhớ

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  std::span<const uint32_t> / std::string_view  (STACK — 16 bytes, align 8)    │
├───────────────────────────────────────────────────────────────────────────────┤
│  +0x00 │ const T* ptr   │ 8B │ ──────┐                                        │
│  +0x08 │ size_t   size  │ 8B │       │                                        │
└──────────────────────────────────────┼────────────────────────────────────────┘
                                       │
                                       ▼  HEAP (sở hữu bởi SongArena)
       ┌───────────────────────────────────────────────────────────────────┐
       │ [idx0 4B][idx1 4B][idx2 4B]...[idx15 4B]  = 64B = 1 CACHE LINE    │
       │  ==> 16 chỉ mục uint32_t / 1 lần nạp L1 ==> ~100% cache hit       │
       └───────────────────────────────────────────────────────────────────┘

   ĐỐI CHỨNG — trả về std::vector<uint32_t> theo giá trị:
       [3 con trỏ 24B trên stack] + 1 lần malloc + memcpy N*4B + 1 lần free
 --------------------------------------------------------------------------------
```

```
   ĐƯỜNG TRA CỨU CHUỖI — CÓ vs KHÔNG is_transparent
   ─────────────────────────────────────────────────────────────────────────
   KHÔNG (std::hash<std::string>, std::equal_to<std::string>):
     find("Artist A")  ──▶ dựng std::string tạm ──▶ malloc (nếu >15 ký tự SSO)
                       ──▶ hash ──▶ probe bucket ──▶ free
                       ==> 1 malloc + 1 free MỖI LẦN TÌM KIẾM

   CÓ (TransparentStringHash + std::equal_to<>):
     find(string_view) ──▶ hash trực tiếp trên view ──▶ probe bucket
                       ==> 0 byte heap
```

## 3. Mã nguồn (Allman)

```cpp
struct TransparentStringHash
{
    using is_transparent = void; // Kích hoạt overload template của find/contains/equal_range

    [[nodiscard]] std::size_t operator()(std::string_view sv) const noexcept
    {
        return std::hash<std::string_view>{}(sv);
    }

    [[nodiscard]] std::size_t operator()(const std::string& s) const noexcept
    {
        // BẮT BUỘC hash qua string_view để hai overload sinh cùng giá trị băm
        return std::hash<std::string_view>{}(s);
    }
};

template <typename Value>
using StringKeyedMap =
    std::unordered_map<std::string, Value, TransparentStringHash, std::equal_to<>>;
```

```cpp
// Trả view thay vì clone vector — O(1) time, O(1) space
[[nodiscard]] std::span<const std::uint32_t>
SongArena::FindByArtist(std::string_view artist) const noexcept
{
    const auto it = m_byArtist.find(artist); // 0 allocation
    if (it == m_byArtist.end())
    {
        return {}; // span rỗng: ptr=nullptr, size=0
    }
    return it->second;
}
```

```cpp
// Bao mảng DMA/audio-buffer thô, triệt tiêu Array Decay
void ApplyGain(std::span<std::int16_t> pcm, std::int32_t attenuationDb) noexcept
{
    const std::int32_t q15 = DbToQ15(attenuationDb); // Tra bảng constexpr trong .rodata

    for (auto& sample : pcm) // size đi kèm span ==> không cần tham số len
    {
        sample = static_cast<std::int16_t>((static_cast<std::int32_t>(sample) * q15) >> 15);
    }
}
```

## 4. Bảng chi phí

| Thao tác | Time | Space (heap) | Ghi chú |
|:---|:---:|:---:|:---|
| `FindByArtist` trả `span` | $O(1)$ | $0$ B | Chỉ copy 16B stack |
| `FindByArtist` trả `vector` | $O(K)$ | $4K$ B + malloc header | Cần tránh |
| `find(string_view)` có `is_transparent` | $O(1)$ avg | $0$ B | |
| `find(const char*)` không transparent | $O(1)$ avg | $\le$ len B | SSO cứu được $\le$15 ký tự |
| `ApplyGain(span)` | $O(N)$ | $0$ B | Auto-vectorize NEON/SSE |

## 5. Cạm bẫy

1. **Dangling view:** `std::string_view sv = a + b;` — chuỗi tạm hủy ngay cuối câu lệnh. Trong `SongArena`, mọi view chỉ hợp lệ khi `SongArenaPtr` (shared_ptr) còn sống → luôn giữ `SongArenaPtr` cùng scope với view.
2. **Không NUL-terminated:** cấm `printf("%s", sv.data())`. Dùng `fwrite(sv.data(), 1, sv.size(), f)`.
3. **Hai overload hash không đồng nhất:** nếu `operator()(const std::string&)` gọi `std::hash<std::string>` thì bucket lệch → `find` luôn miss. Bắt buộc cùng đi qua `string_view`.
4. **`span` trên `vector` vừa `push_back`:** reallocate làm view dangling. `SongArena` giải quyết bằng bất biến sau `Build()`.

## 6. Ảnh hưởng ô tô

Trên IVI với thư viện 50.000 bài, thao tác "lọc theo nghệ sĩ" chạy mỗi lần người dùng lướt danh sách; bản `vector`-return sinh ~50 malloc/giây gây phân mảnh heap và jitter không tất định. Bản `span` + `is_transparent` đưa đường dẫn này về **zero-allocation**, giữ WCET tất định — điều kiện tiên quyết để qua đánh giá ISO 26262 cho tác vụ HMI có deadline mềm.

## Case Study: string_view Trỏ Vào Temporary → Dangling

> [!CAUTION]
> **Triệu chứng:** Hàm trả `std::string_view` từ temporary `std::string` → view trỏ vào bộ nhớ đã bị giải phóng. ASan báo `heap-use-after-free`.

```cpp
// ❌ TRƯỚC — string_view sống lâu hơn string nguồn
std::string_view getName()
{
    std::string result = "Track_" + std::to_string(42);
    return result; // result bị hủy → string_view trỏ vào garbage!
}

// ✅ SAU — trả std::string khi cần ownership
std::string getName() { return "Track_" + std::to_string(42); }

// Hoặc: string_view CHỈ dùng khi nguồn sống đủ lâu
void process(std::string_view name) { /* OK — caller đảm bảo lifetime */ }
```

> [!TIP]
> `string_view` và `span` là **non-owning views** — chúng KHÔNG kéo dài lifetime của nguồn. Quy tắc: KHÔNG trả view từ hàm trừ khi nguồn là static/global. ASan detect ngay.

## Tài Liệu Tham Khảo

- cppreference — [`std::span`](https://en.cppreference.com/w/cpp/container/span)
- cppreference — [`std::string_view`](https://en.cppreference.com/w/cpp/string/basic_string_view)
- cppreference — [`std::unordered_map::find`](https://en.cppreference.com/w/cpp/container/unordered_map/find) (overload template, C++20)
- cppreference — [Transparent comparators / `is_transparent`](https://en.cppreference.com/w/cpp/utility/functional/equal_to_void)
- GCC — [libstdc++ Unordered Associative Containers](https://gcc.gnu.org/onlinedocs/libstdc++/manual/unordered_associative.html)

## 7. Cheatsheet

```cpp
std::span<T> s{ptr, n};  s.subspan(off, cnt);  s.first(k);  s.last(k);  s.empty();
std::string_view sv{"abc"};  sv.substr(1,2);  sv.starts_with("a");  sv.find('b');
using Map = std::unordered_map<std::string, V, TransparentStringHash, std::equal_to<>>;
// Nhớ: view KHÔNG sở hữu — kiểm tra lifetime của buffer gốc TRƯỚC khi trả ra hàm.
```
