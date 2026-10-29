# State Pattern nguyên tử, Zero-Heap EventBus & Bounded Ring Buffer

## 1. Cơ chế mức thấp

State Pattern thay `switch` khổng lồ bằng bảng ảo: `PlayerContext` giữ `IPlayerState*` trỏ tới các singleton `static` nằm trong `.bss` (0 byte heap, 0 byte per-instance). Rủi ro chí mạng là **reentrancy**: `OnEnter()` của state trung gian lại gọi `Transition()`, làm sự kiện `StateChanged` phát ra theo thứ tự đảo. `PlayerContext::Transition()` giải quyết bằng **trampoline**: cờ `m_inTransition` biến đệ quy thành vòng lặp phẳng, chỉ publish **một** `StateChanged` cho trạng thái ổn định cuối cùng.

## 2. Sơ đồ trạng thái & trampoline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MA TRẬN CHUYỂN TRẠNG THÁI — SWC Playback Manager                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│        ┌──────────┐  Play(id)   ┌─────────────┐  OpenStream OK  ┌──────────┐ │
│        │ Stopped  │────────────▶│  Buffering  │────────────────▶│ Playing  │ │
│        └──────────┘             └─────────────┘                 └──────────┘ │
│             ▲                          │ OpenStream FAIL          │   ▲      │
│             │                          │ + ErrorOccurred          │   │      │
│             └──────────────────────────┘                   Pause()│   │Resume│
│             ▲                                                     ▼   │      │
│             │  Stop() / OnTrackEnd(no next)                  ┌──────────┐    │
│             ├──────────────────────────────────────────────  │  Paused  │    │
│             │                                                └──────────┘    │
│             │                          NavPrompt(true) │  ▲                  │
│             │                                          ▼  │ NavPrompt(false) │
│             │                                     ┌──────────┐               │
│             └─────────────────────────────────────│  Ducked  │ -12 dB        │
│                    OnReverseGear(true)            └──────────┘               │
│                                                                              │
│  ⚠ OnReverseGear(true) từ MỌI trạng thái ──▶ Stopped (ưu tiên an toàn tuyệt  │
│    đối cho camera lùi + cảm biến khoảng cách; xoá luôn currentSongId)         │
└──────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TRAMPOLINE — vì sao không dùng đệ quy                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  ĐỆ QUY (SAI):                                                               │
│    Transition(Buffering)                                                     │
│      └─ Buffering::OnEnter ──▶ Transition(Playing)                           │
│           └─ Playing::OnEnter ──▶ Publish(StateChanged=Playing)   ① phát      │
│      <── quay về khung ngoài ──▶ Publish(StateChanged=Buffering)  ② phát SAU  │
│    ==> HMI nhận Playing rồi Buffering ==> UI nhảy ngược, stack sâu bất định   │
│                                                                              │
│  TRAMPOLINE (ĐÚNG — oke/PlayerContext.cpp):                                  │
│    m_inTransition=true                                                       │
│    target=Buffering ─▶ OnExit(old) ─▶ m_state=Buffering ─▶ OnEnter           │
│                        (OnEnter chỉ GHI m_pendingState=Playing rồi return)   │
│    target=Playing   ─▶ OnExit      ─▶ m_state=Playing   ─▶ OnEnter           │
│    target=nullptr   ─▶ thoát vòng lặp                                        │
│    m_inTransition=false ─▶ Publish(StateChanged=Playing)          ① duy nhất  │
│    ==> Độ sâu stack HẰNG SỐ, đúng 1 sự kiện, thứ tự đơn điệu                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  EVENTBUS<8> — Tombstone chống Use-After-Free                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  std::array<Subscription,8> = 8 * (fn 8B + ctx 8B) = 128B + m_count 8B       │
│  Toàn bộ IN-STRUCT. 0 heap. 0 std::function. 0 virtual.                      │
│                                                                              │
│  [0]{h=CliHarness, c=&cli }                                                  │
│  [1]{h=nullptr,    c=null } <── TOMBSTONE: Unsubscribe giữa lúc Publish      │
│  [2]{h=ViewModel,  c=&vm  }     KHÔNG dịch mảng ==> chỉ số đang duyệt của    │
│  [3..7] trống                   Publish() vẫn hợp lệ ==> không UAF, không    │
│                                 bỏ sót/gọi trùng subscriber                  │
│                                                                              │
│  ĐỐI CHỨNG std::vector::erase(it): dịch phần tử ==> iterator/chỉ số của      │
│  vòng lặp Publish đang chạy bị lệch ==> gọi 2 lần hoặc bỏ sót 1 subscriber.  │
└──────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PLAYBACK HISTORY — Ring buffer LIFO, wrap-around                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  std::array<SongId,50> m_buffer + m_head + m_size + m_maxCapacity            │
│  = 50*4 + 3*8 = 224 B, cố định, in-struct                                    │
│                                                                              │
│  Push:  m_buffer[m_head] = id;  m_head = (m_head+1) % cap;                   │
│         if (m_size < cap) ++m_size;      // đầy => GHI ĐÈ bản ghi cũ nhất    │
│  Pop :  m_head = (m_head + cap - 1) % cap;  --m_size;  return m_buffer[head];│
│                                                                              │
│  ⚠ (m_head - 1) % cap trên size_t KHÔNG dấu: m_head=0 ==> 0-1 = SIZE_MAX     │
│    ==> BẮT BUỘC viết (m_head + cap - 1) % cap.  Đây là lỗi modulo-wrap        │
│    kinh điển, hãy kiểm thử riêng biên m_head == 0.                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3. Mã nguồn (Allman)

```cpp
void PlayerContext::Transition(IPlayerState& nextState) noexcept
{
    if (m_inTransition)
    {
        m_pendingState = &nextState; // Hoãn: vòng lặp ngoài sẽ xử lý
        return;
    }

    m_inTransition = true;
    IPlayerState* target = &nextState;

    while (target != nullptr)
    {
        m_pendingState = nullptr;
        m_state->OnExit(*this);
        m_state = target;
        m_state->OnEnter(*this); // Có thể ghi m_pendingState
        target = m_pendingState;
    }

    m_inTransition = false;
    m_pendingState = nullptr;

    // Đúng MỘT sự kiện, mô tả trạng thái ổn định cuối cùng
    m_eventBus.Publish(RteEvent{
        .id = EventId::StateChanged,
        .state = m_state->State(),
        .songId = m_currentSongId,
        .payloadValue = 0});
}
```

```cpp
// Singleton state trong .bss — 0 heap, thread-safe theo chuẩn C++11
PlayingState& PlayingState::Instance() noexcept
{
    static PlayingState s_instance;
    return s_instance;
}

void PlayingState::OnReverseGear(PlayerContext& ctx, bool engaged) noexcept
{
    if (engaged)
    {
        Stop(ctx); // Ưu tiên an toàn: cưỡng chế dừng, xoá track
    }
}
```

```cpp
bool EventBus<MaxSubscribers>::Unsubscribe(HandlerFn handler, void* context) noexcept
{
    for (std::size_t i = 0; i < m_count; ++i)
    {
        if (m_subscribers[i].handler == handler && m_subscribers[i].context == context)
        {
            m_subscribers[i] = Subscription{}; // Tombstone, KHÔNG dịch mảng
            return true;
        }
    }
    return false;
}
```

## 4. Bảng chi phí

| Thành phần | Time | Space | Heap | WCET tất định |
|:---|:---:|:---:|:---:|:---:|
| `Transition` (trampoline) | $O(D)$, $D$ = số state trung gian $\le 2$ | stack hằng | 0 | Có |
| `EventBus::Subscribe` | $O(M)$, $M\le 8$ | 128 B tĩnh | 0 | Có |
| `EventBus::Publish` | $O(M)$ | 0 | 0 | Có |
| `PlaybackHistory::Push/Pop` | $O(1)$ | 224 B tĩnh | 0 | Có |
| `BoundedFifo::Push/Pop` | $O(1)$ | 152 B tĩnh | 0 | Có |
| `std::stack<Song>` (legacy) | $O(1)$ amortized | không giới hạn | Có | Không |

## 5. Cạm bẫy

1. **Gọi hàm ảo trong constructor/destructor của state:** vptr chưa/đã bị hạ cấp → gọi bản của lớp cơ sở. Không đặt logic chuyển trạng thái ở đó.
2. **`Publish` trong `OnEnter`:** làm HMI thấy trạng thái trung gian. Chỉ publish sau khi trampoline kết thúc.
3. **Subscriber tự hủy mà không `Unsubscribe`:** dangling `void*`. `CliHarness` và `PlayerViewModel` đều `Unsubscribe` trong destructor — đây là RAII bắt buộc, phải có test (`TestEventBusAndCliHarness`).
4. **Modulo wrap trên `size_t`:** xem hộp ASCII ở §2. Luôn `+cap` trước khi `-1`.
5. **Bus đầy trả `false` bị bỏ qua:** `Subscribe` là `[[nodiscard]]`; nếu bỏ qua, subscriber im lặng không nhận sự kiện. Luôn `(void)` có ý thức hoặc assert.
6. **State singleton có trạng thái mutable:** vì dùng chung mọi `PlayerContext`, state **phải stateless**; mọi dữ liệu nằm trong `ctx`.

## 6. Ảnh hưởng ô tô

Ba bất biến của thiết kế này — độ sâu stack hằng số khi chuyển trạng thái, 0 byte heap ở mọi đường dẫn sự kiện, và ưu tiên tuyệt đối cho `OnReverseGear` — cùng cấu thành lập luận an toàn cho phân hệ media: không có nhánh nào có thể thất bại vì cạn heap, không có thứ tự sự kiện nào có thể làm HMI hiển thị trạng thái sai, và không có lệnh phát nhạc nào có thể tranh chấp với camera lùi.

## Tài Liệu Tham Khảo

- cppreference — [`static` local variable initialization (thread-safe, C++11)](https://en.cppreference.com/w/cpp/language/storage_duration)
- cppreference — [Virtual function call during construction/destruction](https://en.cppreference.com/w/cpp/language/virtual)
- cppreference — [Designated initializers (C++20)](https://en.cppreference.com/w/cpp/language/aggregate_initialization)
- AUTOSAR — [C++14 Coding Guidelines](https://www.autosar.org/fileadmin/standards/adaptive/) (Rule A18-5-1: cấm cấp phát động)
- cppreference — [`std::array`](https://en.cppreference.com/w/cpp/container/array)

## 7. Cheatsheet

```cpp
// State: singleton .bss, stateless, mọi dữ liệu trong ctx
static S& Instance() noexcept { static S s; return s; }   // (Allman khi viết thật)
// Trampoline: cờ m_inTransition + m_pendingState, publish MỘT lần sau vòng lặp
// EventBus: array tĩnh + Tombstone (gán Subscription{}), KHÔNG erase/dịch mảng
// Ring buffer LIFO: head=(head+1)%cap khi Push;  head=(head+cap-1)%cap khi Pop
// Bounded FIFO   : head/tail/size riêng biệt; Push trả false khi đầy (không throw)
```
