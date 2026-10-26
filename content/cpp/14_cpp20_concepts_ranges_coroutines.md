# C++20 Concepts, Ranges & Coroutines trong hệ nhúng

## 1. Cơ chế mức thấp

**Concepts** là vị từ compile-time tham gia overload resolution: vi phạm ràng buộc làm ứng viên bị loại **trước** khi instantiate thân hàm, cho thông báo lỗi 3 dòng thay vì 300 dòng của SFINAE. **Ranges views** là các adaptor lười, mỗi view là một struct 16–32B giữ iterator + predicate; pipeline `a | b | c` không sinh container trung gian, compiler inline thành một vòng lặp duy nhất. **Coroutine** biến hàm thành máy trạng thái: compiler cấp phát một *coroutine frame* (thường trên heap qua `operator new` — điểm chí tử cho ECU) chứa biến cục bộ + con trỏ resume.

## 2. Bố cục bộ nhớ

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  RANGES PIPELINE — 0 byte container trung gian                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  songs | views::filter(byArtist) | views::transform(toId) | views::take(20)  │
│                                                                              │
│  STACK:  [filter_view 24B][transform_view 24B][take_view 32B]  ≈ 80B         │
│  HEAP :  0 B                                                                 │
│                                                                              │
│  ĐỐI CHỨNG code cổ điển:                                                     │
│    vector<Song> tmp1 = filter(songs);      // malloc + copy N*64B            │
│    vector<SongId> tmp2 = transform(tmp1);  // malloc + copy N*4B             │
│    ==> 2 malloc + 2 free + 2 lần đi qua RAM                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  COROUTINE FRAME — cảnh báo cho ECU                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  HEAP (mặc định!):                                                           │
│  ┌──────────────┬──────────────┬───────────────┬─────────────────────────┐   │
│  │ resume_fn 8B │ destroy_fn 8B│ promise_type  │ biến cục bộ đã spill    │   │
│  └──────────────┴──────────────┴───────────────┴─────────────────────────┘   │
│                                                                              │
│  ==> Kích thước frame KHÔNG có trong chuẩn, phụ thuộc compiler ==> WCET       │
│      không chứng minh được. Với ASIL-D: BẮT BUỘC override                    │
│      promise_type::operator new để cấp từ arena tĩnh, hoặc KHÔNG dùng.       │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3. Mã nguồn (Allman)

```cpp
#include <concepts>
#include <ranges>

// Concept mô tả buffer PCM liền kề, ghi được, phần tử số nguyên
template <typename T>
concept PcmBuffer =
    std::ranges::contiguous_range<T> &&
    std::ranges::sized_range<T> &&
    std::integral<std::ranges::range_value_t<T>> &&
    (!std::is_const_v<std::remove_reference_t<std::ranges::range_reference_t<T>>>);

template <PcmBuffer Buf>
void NormalizeInPlace(Buf& buffer, std::int32_t peakQ15) noexcept
{
    for (auto& sample : buffer)
    {
        sample = static_cast<std::ranges::range_value_t<Buf>>(
            (static_cast<std::int32_t>(sample) * peakQ15) >> 15);
    }
}
```

```cpp
// Thay thế vòng for lồng của SmartBfsOrder khi chỉ cần lọc-lấy-N
[[nodiscard]] std::vector<SongId>
TopTracksOfArtist(const SongArena& arena, std::string_view artist, std::size_t limit)
{
    const auto indices = arena.FindByArtist(artist); // span, 0 alloc

    auto pipeline = indices
                  | std::views::transform([&arena](std::uint32_t i)
                    {
                        return arena.GetByIndex(i);
                    })
                  | std::views::filter([](const SongRecord* rec)
                    {
                        return rec != nullptr && rec->durationSec >= 60U;
                    })
                  | std::views::transform([](const SongRecord* rec)
                    {
                        return rec->id;
                    })
                  | std::views::take(limit);

    return std::vector<SongId>{pipeline.begin(), pipeline.end()}; // 1 alloc duy nhất
}
```

```cpp
// Coroutine generator có KIỂM SOÁT cấp phát — bắt buộc cho ECU
template <typename T>
class BoundedGenerator
{
public:
    struct promise_type
    {
        static constexpr std::size_t kFrameArenaSize = 2048U;

        [[nodiscard]] static void* operator new(std::size_t size) noexcept
        {
            return FrameArena::Instance().Allocate(size); // Arena tĩnh, 0 heap
        }

        static void operator delete(void* ptr, std::size_t size) noexcept
        {
            FrameArena::Instance().Deallocate(ptr, size);
        }

        [[nodiscard]] BoundedGenerator get_return_object() noexcept
        {
            return BoundedGenerator{std::coroutine_handle<promise_type>::from_promise(*this)};
        }

        [[nodiscard]] std::suspend_always initial_suspend() const noexcept
        {
            return {};
        }

        [[nodiscard]] std::suspend_always final_suspend() const noexcept
        {
            return {};
        }

        [[nodiscard]] std::suspend_always yield_value(T value) noexcept
        {
            m_current = value;
            return {};
        }

        void return_void() const noexcept
        {
        }

        void unhandled_exception() const noexcept
        {
            std::terminate(); // -fno-exceptions: không bao giờ tới đây
        }

        T m_current{};
    };

    explicit BoundedGenerator(std::coroutine_handle<promise_type> handle) noexcept
        : m_handle(handle)
    {
    }

    ~BoundedGenerator()
    {
        if (m_handle)
        {
            m_handle.destroy();
        }
    }

    BoundedGenerator(const BoundedGenerator&) = delete;
    BoundedGenerator& operator=(const BoundedGenerator&) = delete;

    BoundedGenerator(BoundedGenerator&& other) noexcept
        : m_handle(std::exchange(other.m_handle, {}))
    {
    }

    BoundedGenerator& operator=(BoundedGenerator&& other) noexcept
    {
        if (this != &other)
        {
            if (m_handle)
            {
                m_handle.destroy();
            }
            m_handle = std::exchange(other.m_handle, {});
        }
        return *this;
    }

    [[nodiscard]] bool MoveNext() noexcept
    {
        if (!m_handle || m_handle.done())
        {
            return false;
        }
        m_handle.resume();
        return !m_handle.done();
    }

    [[nodiscard]] const T& Current() const noexcept
    {
        return m_handle.promise().m_current;
    }

private:
    std::coroutine_handle<promise_type> m_handle{};
};
```

## 4. Bảng chi phí

| Kỹ thuật | Compile-time | Runtime | Heap | Dùng cho ECU |
|:---|:---:|:---:|:---:|:---:|
| `concept` + `requires` | Nhanh hơn SFINAE ~30% | $0$ | $0$ | Có |
| `views::filter/transform/take` | Tăng (inline sâu) | $O(N)$, 1 lần đi qua | $0$ | Có |
| `views::*` + `ranges::to<vector>` | | $O(N)$ | 1 alloc | Có, nếu `reserve` |
| Coroutine mặc định | Tăng mạnh | $O(1)$/resume | 1 alloc/coroutine | **Không** |
| Coroutine + `promise::operator new` arena | Tăng mạnh | $O(1)$/resume | $0$ | Có (cần chứng minh frame size) |

## 5. Cạm bẫy

1. **Dangling view trên rvalue range:** `auto v = GetVector() | views::filter(p);` — `GetVector()` hủy, view dangling. Chỉ pipeline trên lvalue hoặc `owning_view`.
2. **`views::filter` không phải `random_access`:** mất `operator[]` và `size()`; `std::sort` từ chối. Materialize trước khi sort.
3. **Predicate có side-effect:** view lười có thể gọi predicate **nhiều lần** cho cùng phần tử (đặc biệt `filter` + duyệt hai chiều). Giữ predicate thuần khiết.
4. **Frame size coroutine không xác định:** không có cách chuẩn nào truy vấn. Đo bằng cách log `size` trong `operator new`, rồi `static_assert` ngưỡng ở test.
5. **Concept quá chặt:** `contiguous_range` loại `std::deque`, `std::list`. Ràng buộc đúng mức cần thiết, không hơn.

## 6. Ảnh hưởng ô tô

Concepts và Ranges là **an toàn và khuyến nghị** cho tầng ASW của IVI: chúng giảm mã lặp và loại bỏ container tạm trong đường dẫn lọc thư viện nhạc mà không phát sinh heap. Coroutines thì ngược lại — frame cấp phát động và kích thước không xác định khiến chúng bị loại khỏi tác vụ ASIL; chỉ nên dùng ở tiến trình QM (HMI, logging) hoặc sau khi ép allocator arena và chứng minh được cận trên frame size bằng test.

## Case Study: Concepts Thay SFINAE — Error Message Cải Thiện 10x

> [!CAUTION]
> **Bối cảnh:** Hàm template `serialize<T>()` yêu cầu `T` phải có method `toBytes()`. Với SFINAE, truyền sai kiểu → compiler in 200 dòng error không đọc nổi. Với Concepts → 3 dòng rõ ràng.

```cpp
// ❌ SFINAE — error message khó đọc
template<typename T, typename = std::enable_if_t<has_toBytes_v<T>>>
void serialize(const T& obj) { /* ... */ }
// Truyền int → error: "no matching function... substitution failure in enable_if..."
// + 200 dòng template instantiation backtrace

// ✅ C++20 Concepts — error message rõ ràng
template<typename T>
concept Serializable = requires(const T& t) { { t.toBytes() } -> std::convertible_to<std::vector<uint8_t>>; };

template<Serializable T>
void serialize(const T& obj) { /* ... */ }
// Truyền int → error: "constraints not satisfied: int does not satisfy Serializable"
// → 3 dòng, chỉ rõ constraint nào fail
```

> [!TIP]
> Concepts = SFINAE thân thiện. Ưu tiên Concepts khi dùng C++20+. Trên embedded C++14: vẫn phải dùng `static_assert` + custom message làm workaround.

---

## Tài Liệu Tham Khảo

- cppreference — [Constraints and concepts](https://en.cppreference.com/w/cpp/language/constraints)
- cppreference — [Ranges library](https://en.cppreference.com/w/cpp/ranges)
- cppreference — [Coroutines](https://en.cppreference.com/w/cpp/language/coroutines)
- cppreference — [`std::coroutine_handle`](https://en.cppreference.com/w/cpp/coroutine/coroutine_handle)
- GCC — [C++20 Support Status](https://gcc.gnu.org/projects/cxx-status.html#cxx20)

## 7. Cheatsheet

```cpp
template <typename T> concept C = requires(T t) { { t.Foo() } -> std::same_as<int>; };
template <C T> void f(T);                       // Ràng buộc qua template parameter
void g(C auto x);                               // Abbreviated function template
r | views::filter(p) | views::transform(f) | views::take(n) | views::reverse
ranges::sort(v);  ranges::find_if(v, p);  ranges::to<std::vector>(pipeline); // C++23
co_yield v;  co_await aw;  co_return;           // Cần override promise::operator new cho ECU
```
