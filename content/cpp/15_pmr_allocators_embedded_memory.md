# PMR, Arena Allocator & Bounded Containers cho ECU

## 1. Cơ chế mức thấp

`std::pmr` tách chính sách cấp phát khỏi kiểu container: container lưu một `memory_resource*` (8B) và gọi ảo `do_allocate()` — cho phép **đổi backing store lúc runtime mà không đổi kiểu**. `monotonic_buffer_resource` cấp phát bằng cách tăng con trỏ trên một buffer stack/`.bss` cho trước và **không bao giờ giải phóng lẻ** (`deallocate` là no-op), nên chi phí là $O(1)$ tất định và phân mảnh ngoài bằng 0. Đây là cơ chế thay thế hợp pháp cho `new`/`malloc` trong tác vụ real-time.

## 2. Bố cục bộ nhớ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ARENA STACK-BASED — monotonic_buffer_resource                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  std::array<std::byte, 4096> buf;        <── nằm trên STACK hoặc .bss        │
│                                                                             │
│  ┌────────┬────────┬────────┬───────────────────────────────────────────┐   │
│  │ obj A  │ obj B  │ obj C  │ ░░░ vùng chưa dùng ░░░                    │   │
│  └────────┴────────┴────────┴───────────────────────────────────────────┘   │
│           ▲                 ▲                                               │
│           │                 └── m_current (bump pointer, tăng đơn điệu)      │
│           └── align padding theo alignof(T)                                 │
│                                                                             │
│  allocate(n): p = align_up(m_current, a); m_current = p + n; return p;       │
│               ==> 2 lệnh ALU, KHÔNG khóa, KHÔNG free-list, WCET O(1)         │
│  deallocate(): no-op. Toàn arena thu hồi 1 lần khi hết scope.                │
└─────────────────────────────────────────────────────────────────────────────┘
```

```
   SO SÁNH 3 CHIẾN LƯỢC QUẢN LÝ HÀNG ĐỢI PHÁT NHẠC
   ─────────────────────────────────────────────────────────────────────────
   (1) std::list<Song>            : 1 malloc / node
       node = [prev 8B][next 8B][Song ~64B] + malloc header 16B ≈ 96B
       ──▶ rải rác heap, ~90% cache miss khi duyệt, phân mảnh ngoài tăng dần

   (2) std::pmr::list<Song> + arena
       node cùng layout NHƯNG liền kề trong arena
       ──▶ 0 malloc runtime, cache locality tốt, vẫn còn 16B ptr overhead/node

   (3) BoundedFifo<32> (oke/PlayerContext.h)   ◀── LỰA CHỌN CỦA ASW
       std::array<SongId,32> + 3 size_t = 32*4 + 24 = 152B, toàn bộ in-struct
       ──▶ 0 heap tuyệt đối, O(1) push/pop, WCET hằng số
       ──▶ ĐÁNH ĐỔI: mất xóa phần tử giữa & kéo-thả đổi thứ tự
```

## 3. Mã nguồn (Allman)

```cpp
#include <array>
#include <memory_resource>
#include <vector>

// Tác vụ chu kỳ: dựng danh sách tạm hoàn toàn trên stack, 0 malloc
void BuildSmartPlaylistCycle(const SongArena& arena, SongId seed) noexcept
{
    std::array<std::byte, 4096> stackBuffer{};
    std::pmr::monotonic_buffer_resource pool
    {
        stackBuffer.data(),
        stackBuffer.size(),
        std::pmr::null_memory_resource() // Hết arena => ném bad_alloc, KHÔNG âm thầm rơi về heap
    };

    std::pmr::vector<SongId> playlist{&pool};
    playlist.reserve(32U);

    // ... thuật toán BFS ghi vào playlist ...
    // Ra khỏi scope: pool hủy, toàn bộ vùng nhớ thu hồi 1 lần. 0 free().
}
```

```cpp
// Pool cố định cho đối tượng đồng kích cỡ, có tái sử dụng (khác monotonic)
class FixedBlockPool
{
public:
    static constexpr std::size_t kBlockSize = 64U;
    static constexpr std::size_t kBlockCount = 128U;

    FixedBlockPool() noexcept
    {
        for (std::size_t i = 0U; i + 1U < kBlockCount; ++i)
        {
            NextOf(i) = static_cast<std::uint16_t>(i + 1U);
        }
        NextOf(kBlockCount - 1U) = kInvalidIndex;
        m_freeHead = 0U;
    }

    [[nodiscard]] void* Allocate() noexcept
    {
        if (m_freeHead == kInvalidIndex)
        {
            return nullptr; // Cạn pool: trả nullptr, KHÔNG throw (tuân thủ -fno-exceptions)
        }
        const std::uint16_t index = m_freeHead;
        m_freeHead = NextOf(index);
        return &m_storage[index * kBlockSize];
    }

    void Deallocate(void* ptr) noexcept
    {
        if (ptr == nullptr)
        {
            return;
        }
        const auto offset = static_cast<std::size_t>(
            static_cast<std::byte*>(ptr) - m_storage.data());
        const auto index = static_cast<std::uint16_t>(offset / kBlockSize);
        NextOf(index) = m_freeHead;
        m_freeHead = index;
    }

private:
    static constexpr std::uint16_t kInvalidIndex = 0xFFFFU;

    [[nodiscard]] std::uint16_t& NextOf(std::size_t index) noexcept
    {
        // Free-list nhúng trong chính block đang rỗi ==> 0 byte metadata phụ
        return *reinterpret_cast<std::uint16_t*>(&m_storage[index * kBlockSize]);
    }

    alignas(64) std::array<std::byte, kBlockSize * kBlockCount> m_storage{};
    std::uint16_t m_freeHead{kInvalidIndex};
};

static_assert(sizeof(FixedBlockPool) <= 8256U, "Pool vuot han muc SRAM cho phep");
```

## 4. Bảng chi phí

| Cấu trúc | Alloc | Dealloc | Heap runtime | Phân mảnh ngoài | WCET tất định |
|:---|:---:|:---:|:---:|:---:|:---:|
| `std::list` | $O(1)$ amortized* | $O(1)$* | Có | Tăng dần | Không |
| `std::pmr::list` + monotonic | $O(1)$ | no-op | Không | 0 | Có |
| `FixedBlockPool` | $O(1)$ | $O(1)$ | Không | 0 | Có |
| `BoundedFifo<N>` | — | — | Không | 0 | Có |

\* Phụ thuộc `malloc` của libc → không tất định (best-fit / bin search).

## 5. Cạm bẫy

1. **Upstream mặc định là heap:** `monotonic_buffer_resource(buf, size)` khi cạn sẽ gọi `new_delete_resource()` — âm thầm cấp phát heap. Luôn truyền `null_memory_resource()` để lỗi nổ ra ở test.
2. **`std::pmr::vector` không so sánh được với `std::vector`:** khác kiểu allocator → khác kiểu. Cần API biên thì nhận `std::span<const T>`.
3. **Allocator không lan truyền qua copy:** copy `pmr::vector` sang scope khác giữ allocator **của đích**, không của nguồn. Kiểm tra `get_allocator().resource()`.
4. **Free-list nhúng đòi `kBlockSize >= sizeof(index)`** và alignment đủ — bảo vệ bằng `static_assert`.
5. **`reinterpret_cast` trên `std::byte` buffer:** hợp lệ cho ghi/đọc `uint16_t` free-list nhưng nếu dựng đối tượng thật phải dùng placement `new` + `std::launder`.

## 6. Ảnh hưởng ô tô

Trên ECU với heap bị vô hiệu hoặc bị MISRA C++ cấm (`Rule A18-5-1`), mọi container động phải được gắn arena hoặc thay bằng bounded container. Dự án `oke/` chọn hướng cực đoan nhất cho đường dẫn nóng — `BoundedFifo<32U>` và `PlaybackHistory` ring buffer tĩnh — nên tác vụ `PlayNext()` có WCET đo được và không thể thất bại vì hết heap; đổi lại mất khả năng sửa hàng đợi ở giữa, được ghi rõ trong `doc/architecture.md` như một đánh đổi có chủ đích.

## Tài Liệu Tham Khảo

- cppreference — [`std::pmr::monotonic_buffer_resource`](https://en.cppreference.com/w/cpp/memory/monotonic_buffer_resource)
- cppreference — [`std::pmr::memory_resource`](https://en.cppreference.com/w/cpp/memory/memory_resource)
- cppreference — [`std::pmr::polymorphic_allocator`](https://en.cppreference.com/w/cpp/memory/polymorphic_allocator)
- cppreference — [`std::launder`](https://en.cppreference.com/w/cpp/utility/launder)
- GCC — [libstdc++ Allocators](https://gcc.gnu.org/onlinedocs/libstdc++/manual/memory.html#std.util.memory.allocator)

## 7. Cheatsheet

```cpp
std::array<std::byte, N> buf{};
std::pmr::monotonic_buffer_resource pool{buf.data(), buf.size(),
                                         std::pmr::null_memory_resource()};
std::pmr::vector<T> v{&pool};   std::pmr::string s{&pool};   std::pmr::list<T> l{&pool};
// Tái sử dụng block  -> unsynchronized_pool_resource (1 thread) / synchronized_pool_resource
// Bắt rơi về heap    -> null_memory_resource() làm upstream
```
