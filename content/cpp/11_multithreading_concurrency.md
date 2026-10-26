# Concurrency & Multithreading — std::thread, Mutex, Condition Variable

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp kiến thức lập trình đa luồng hiện đại trong C++11/14/17: Quản lý vòng đời thread (`std::thread`, `std::jthread`), cơ chế đồng bộ hóa dữ liệu độc quyền (`std::mutex`, `std::shared_mutex`, `std::scoped_lock`), mô hình Producer-Consumer (`std::condition_variable`), các thao tác bất khả phân (`std::atomic`), và tối ưu hóa phần cứng chống hiện tượng False Sharing. Đây là kiến thức nền tảng bắt buộc trong việc xây dựng pipeline xử lý song song tốc độ cao cho Computer Vision và ADAS.

---

## 1. `std::thread` — Tạo và Quản Lý Luồng

> [!NOTE]
> **Khởi tạo thread cơ bản:**
>
> ```cpp
> #include <thread>
> #include <iostream>
> #include <string>
>
> void workerTask(int id, const std::string& taskName)
> {
>     std::cout << "Thread ID: " << id << " executing " << taskName << "\n";
> }
>
> int main()
> {
>     std::thread t(&workerTask, 1, "SensorPolling");
>     t.join(); // Luồng chính bị block cho tới khi t hoàn thành
>     return 0;
> }
> ```
>
> Hàm `std::thread::hardware_concurrency()` trả về số lượng lõi xử lý logic (logical CPU cores) của hệ thống — căn cứ để định lượng số luồng worker trong Thread Pool.

> [!WARNING]
> **Rủi ro quên `join()` hoặc `detach()`:**
> Khi một đối tượng `std::thread` bị hủy (destruct) trong khi vẫn còn trạng thái `joinable() == true`, hàm hủy sẽ tự động gọi `std::terminate()` dẫn tới **tiến trình bị crash lập tức**.
>
> | Phương thức | Tính chất | Hệ quả | Trường hợp sử dụng |
> |:--|:--|:--|:--|
> | `t.join()` | **Blocking** | Luồng gọi phải chờ luồng con kết thúc | Đồng bộ hóa kết quả, đảm bảo an toàn tài nguyên |
> | `t.detach()` | **Non-blocking** | Luồng con tách ra chạy độc lập nền (Daemon) | Tác vụ nền độc lập, rủi ro cao nếu truy cập biến đã hủy |

> [!TIP]
> **Truyền tham chiếu vào thread:**
> `std::thread` constructor sao chép giá trị (pass-by-value) các đối số theo mặc định. Khi cần truyền tham chiếu thực tế, bắt buộc phải bọc bằng `std::ref()` hoặc `std::cref()`.
>
> ```cpp
> int counter = 0;
> std::thread t([](int& c) { c++; }, std::ref(counter)); // Bắt buộc dùng std::ref
> t.join();
> ```

---

## 2. Mutex & Lock — Bảo Vệ Vùng Dữ Liệu Chia Sẻ

### 2.1 Các Loại Mutex Trong Chuẩn C++

1. **`std::mutex`**: Khóa loại trừ lẫn nhau cơ bản nhất (Mutual Exclusion). Chỉ duy nhất 1 luồng được sở hữu tại một thời điểm.
2. **`std::recursive_mutex`**: Cho phép cùng 1 luồng khóa lặp lại nhiều lần (không khuyến khích dùng vì overhead lớn và che giấu thiết kế tồi).
3. **`std::shared_mutex` (C++17)**: Hỗ trợ mô hình Reader-Writer Lock: Cho phép nhiều luồng đọc đồng thời (`std::shared_lock`), nhưng chỉ 1 luồng được ghi độc quyền (`std::unique_lock`).

### 2.2 Các Cơ Chế Quản Lý Khóa RAII

> [!NOTE]
> **So sánh các Wrapper Khóa:**
>
> | Wrapper Lock | Chuẩn | Tính chất | Khi nào áp dụng |
> |:--|:--|:--|:--|
> | `std::lock_guard` | C++11 | Cực nhẹ, lock tại constructor, unlock tại destructor | Critical section đơn giản, không cần unlock sớm |
> | `std::unique_lock` | C++11 | Linh hoạt, hỗ trợ deferred locking, unlock/relock thủ công | Bắt buộc khi dùng với `std::condition_variable` |
> | `std::scoped_lock` | C++17 | Lock đồng thời $N$ mutex bằng thuật toán tránh deadlock | Khi cần khóa từ 2 mutex trở lên trong một phạm vi |

### 2.3 Hiểm Họa Deadlock (Khóa Chết)

Deadlock xảy ra khi hai hay nhiều luồng bị đóng băng vĩnh viễn do tranh chấp vòng tròn tài nguyên: Luồng $A$ giữ Mutex 1 và chờ Mutex 2; Luồng $B$ giữ Mutex 2 và chờ Mutex 1.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SƠ ĐỒ XUNG ĐỘT DEADLOCK DO THỨ TỰ KHÓA MUTEX BẤT ĐỐI XỨNG                   │
├─────────────────────────────────────────────────────────────────────────────┤
│   [ Thread A: onTrackChange ]               [ Thread B: onNavPrompt ]       │
│                │                                         │                  │
│   1. Lock(m_audioMtx) [Thành công]          1. Lock(m_displayMtx) [Thành công]
│                │                                         │                  │
│   2. Chờ Lock(m_displayMtx)                 2. Chờ Lock(m_audioMtx)         │
│         │ (Bị chặn do B đang giữ)                 │ (Bị chặn do A đang giữ) │
│         ▼                                         ▼                         │
│   ═════════════════════════ DEADLOCK ĐÓNG BĂNG ════════════════════════════ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Case Study: Deadlock Khi Lock Đa Mutex Ngược Thứ Tự Trong Automotive IVI

> [!CAUTION]
> **Bối cảnh:** Module điều phối giao diện buồng lái xe hơi (Cockpit Controller). `AudioManager` kiểm soát kênh âm thanh giải trí (bảo vệ bởi `m_audioMtx`), `DisplayManager` kiểm soát khung hiển thị bảng đồng hồ (bảo vệ bởi `m_displayMtx`).
> **Triệu chứng:** Khi người lái xe vừa chuyển bài hát trên vô lăng (Thread A) đúng thời điểm hệ thống định vị GPS phát cảnh báo rẽ (Thread B), toàn bộ màn hình trung tâm bị đơ cứng, không phản hồi thao tác. GDB báo cáo hai luồng đều rơi vào trạng thái `__lll_lock_wait`.

```cpp
// TRƯỚC (Lỗi): Khóa mutex theo thứ tự bất đồng bộ giữa các module
std::mutex m_audioMtx;
std::mutex m_displayMtx;

// Luồng A: Xử lý chuyển bài hát giải trí
void onTrackChange(const std::string& songTitle)
{
    std::lock_guard<std::mutex> lockAudio(m_audioMtx);     // Khóa Audio TRƯỚC
    // ... Cập nhật phần cứng âm thanh ...
    std::lock_guard<std::mutex> lockDisplay(m_displayMtx); // Khóa Display SAU
    // ... Cập nhật tên bài hát lên màn hình ...
}

// Luồng B: Xử lý cảnh báo điều hướng khẩn cấp
void onNavPrompt(const std::string& promptText)
{
    std::lock_guard<std::mutex> lockDisplay(m_displayMtx); // Khóa Display TRƯỚC
    // ... Vẽ lớp phủ cảnh báo điều hướng ...
    std::lock_guard<std::mutex> lockAudio(m_audioMtx);     // Khóa Audio SAU
    // ... Giảm âm lượng nhạc nền ...
}
```

```cpp
// SAU (Khắc phục): Sử dụng std::scoped_lock (C++17) khóa nguyên tử không gây deadlock
#include <mutex>
#include <string>

std::mutex g_audioMtx;
std::mutex g_displayMtx;

void onTrackChangeSafe(const std::string& songTitle)
{
    // std::scoped_lock tự động áp dụng thuật toán Deadlock Avoidance (std::lock)
    // Khóa đồng thời cả 2 mutex một cách an toàn mà không phụ thuộc thứ tự truyền đối số
    std::scoped_lock lock(g_audioMtx, g_displayMtx);
    
    // Cập nhật âm thanh và màn hình trong cùng 1 phạm vi an toàn
}

void onNavPromptSafe(const std::string& promptText)
{
    // Kể cả khi thứ tự truyền tham số có bị đảo, scoped_lock vẫn bảo đảm an toàn
    std::scoped_lock lock(g_audioMtx, g_displayMtx);

    // Cập nhật cảnh báo điều hướng an toàn
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Tuyệt đối không lồng các khối `std::lock_guard` thủ công khi một hàm cần tương tác với nhiều hơn một mutex.
> - Tiêu chuẩn C++17 cung cấp `std::scoped_lock` giải quyết hoàn toàn bài toán này ở tầng compile/runtime bằng kỹ thuật deadlock-avoidance algorithm (thử khóa bằng `try_lock`, nếu thất bại sẽ giải phóng toàn bộ khóa đã giữ và thử lại).

---

## 3. `std::condition_variable` — Điều Phối Luồng Producer-Consumer

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ LUỒNG ĐIỀU PHỐI TÍN HIỆU GIỮA PRODUCER VÀ CONSUMER VỚI PREDICATE            │
├─────────────────────────────────────────────────────────────────────────────┤
│ [ Producer Thread ]          [ Shared Thread-Safe Queue ] [ Consumer Thread]
│         │                                │                        │         │
│   1. Đẩy Frame vào Queue                 │                        │         │
│   2. lock(mtx) ─────────────────────────▶│                        │         │
│   3. queue.push(f)                       │                        │         │
│   4. unlock(mtx)                         │                        │         │
│   5. cv.notify_one() ────────────────────┼───────────────────────▶│         │
│                                          │                  cv.wait(ulock)  │
│                                          │                  Kiểm tra predicate
│                                          │                  Queue rỗng?     │
│                                          │                  - Đúng: Sleep   │
│                                          │                  - Sai: Thức dậy │
│                                          │                  6. Rút Frame    │
│                                          │◀───────────────── pop()          │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **Hiện Tượng Đánh Thức Giả (Spurious Wakeup):**
> Một luồng đang chờ tại `cv.wait()` có thể bị đánh thức bởi hệ điều hành dù không có bất kỳ luồng nào gọi `notify`. Do đó, **BẮT BUỘC** phải truyền biểu thức kiểm tra (Predicate) vào hàm `wait()`:
> ```cpp
> cv.wait(ulock, [&] { return !queue.empty(); });
> ```

---

## 4. `std::atomic` — Thao Tác Bất Khả Phân & Bộ Nhớ Không Khóa (Lock-Free)

### 4.1 Khái Niệm Cốt Lõi
`std::atomic<T>` đảm bảo các thao tác đọc/ghi trên biến đơn diễn ra nguyên tử (không thể bị ngắt quãng bởi context switch), loại bỏ sự cần thiết của mutex và chi phí chuyển đổi ngữ cảnh (context-switch overhead).

### 4.2 Các Cấp Độ Sắp Xếp Bộ Nhớ (Memory Ordering)

| Memory Order | Cơ chế | Ứng dụng |
|:---|:---|:---|
| `std::memory_order_relaxed` | Chỉ đảm bảo tính nguyên tử, không đảm bảo thứ tự thực thi lệnh | Bộ đếm tiến trình (Counters), Thống kê hiệu năng |
| `std::memory_order_acquire` | Các lệnh đọc/ghi phía sau không thể bị compiler đảo lên trước | Luồng đọc trong bài toán Producer-Consumer |
| `std::memory_order_release` | Các lệnh đọc/ghi phía trước không thể bị compiler đảo ra sau | Luồng ghi xuất bản dữ liệu cho luồng đọc |
| `std::memory_order_seq_cst` | Đảm bảo trật tự tuần tự nhất quán toàn cục (mặc định) | An toàn tuyệt đối nhưng tốn xung nhịp CPU nhất |

### 4.3 Case Study: Xung Đột Dữ Liệu (Data Race) & Torn Read Trong ADAS Camera Pipeline

> [!CAUTION]
> **Bối cảnh:** Hệ thống camera hỗ trợ lái xe ADAS. Luồng Camera Capture thu nhận khung hình thô kích thước 1920x1080 YUV (~3MB) với tần số 30fps và ghi vào biến chia sẻ toàn cục. Luồng AI Inference đọc khung hình này để đưa vào mô hình phát hiện vật cản.
> **Triệu chứng:** Mạng nơ-ron thỉnh thoảng phát hiện "vật cản ma" (phantom obstacle) ở giữa khung hình. Khi kiểm tra với `-fsanitize=thread`, công cụ báo cáo Data Race nghiêm trọng. Ảnh trích xuất thực tế bị hiện tượng xé hình (Torn Read): nửa trên thuộc frame $N$, nửa dưới thuộc frame $N-1$.

```cpp
// TRƯỚC (Lỗi): Chia sẻ struct lớn qua biến toàn cục không có đồng bộ
struct CameraFrame
{
    uint8_t pixels[1920 * 1080 * 2]; // 4.14 MB
    uint64_t frame_index;
};

CameraFrame g_activeFrame; // Dữ liệu chia sẻ không được bảo vệ!

void captureThreadLoop()
{
    while (true)
    {
        CameraFrame new_frame = hardware_capture();
        // LỖI: Thao tác memcpy 4.14MB tốn hàng nghìn chu kỳ CPU.
        // Luồng Inference có thể đọc xen ngang khi memcpy mới hoàn tất 50%!
        g_activeFrame = new_frame; 
    }
}

void inferenceThreadLoop()
{
    while (true)
    {
        // Đọc dữ liệu bị xé (Torn Read)
        CameraFrame current = g_activeFrame;
        runNeuralNetwork(current.pixels);
    }
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ DOUBLE BUFFERING KẾT HỢP ATOMIC POINTER EXCHANGE ZERO-COPY           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Front Buffer (Đang Đọc - Read Only)        Back Buffer (Đang Ghi - Write)    │
│ ┌───────────────────────────────┐          ┌──────────────────────────────┐ │
│ │ Buffer 0: Frame N (Ổn định)  │          │ Buffer 1: Frame N+1 (Ghi dở) │ │
│ └──────────────▲────────────────┘          └──────────────▲───────────────┘ │
│                │                                          │                 │
│         Inference Thread                           Camera Thread            │
│                │                                          │                 │
│                └──── m_frontIndex.load(acquire) ◄─────────┘                 │
│                      m_frontIndex.store(1-idx, release)                     │
│                      (Hoán đổi chỉ mục trong 1 chu kỳ clock O(1))           │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Mô hình Double Buffering với atomic index swap chuẩn Allman
#include <atomic>
#include <cstdint>
#include <cstring>

class DoubleBufferedCamera
{
private:
    struct FrameSlot
    {
        uint8_t pixels[1920 * 1080 * 2];
        uint64_t timestamp_ns{0};
    };

    FrameSlot m_slots[2]; // 2 slot bộ nhớ tĩnh cố định, tránh cấp phát heap
    std::atomic<int> m_frontIdx{0};

public:
    void publishNewFrame(const uint8_t* rawData, size_t size, uint64_t timestamp)
    {
        // 1. Xác định slot nền không bị đọc
        int currentFront = m_frontIdx.load(std::memory_order_relaxed);
        int backIdx = 1 - currentFront;

        // 2. Ghi dữ liệu an toàn vào slot nền (hoàn toàn cách ly với Reader)
        std::memcpy(m_slots[backIdx].pixels, rawData, size);
        m_slots[backIdx].timestamp_ns = timestamp;

        // 3. Hoán đổi quyền nguyên tử với cơ chế Release Semantics
        m_frontIdx.store(backIdx, std::memory_order_release);
    }

    template <typename ProcessCallback>
    void accessActiveFrame(ProcessCallback&& callback)
    {
        // 1. Mượn chỉ mục với cơ chế Acquire Semantics
        int activeIdx = m_frontIdx.load(std::memory_order_acquire);

        // 2. Truy cập trực tiếp tại chỗ (Zero-Copy), không copy 4MB lên Stack
        callback(m_slots[activeIdx].pixels, m_slots[activeIdx].timestamp_ns);
    }
};
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Kiểu dữ liệu `std::atomic` trên các kiến trúc x86_64 và ARM64 chỉ hỗ trợ nguyên tử trên kích thước tối đa 8 bytes hoặc 16 bytes (Double Word CAS). Không thể dùng `std::atomic` trực tiếp trên struct ảnh MB.
> - Kỹ thuật Double Buffering tách biệt hoàn toàn bộ đệm ghi và bộ đệm đọc. Việc hoán đổi chỉ thông qua 1 biến `std::atomic<int>` biến thao tác đồng bộ 4MB từ $O(N)$ tốn kém thành $O(1)$ zero-copy chỉ trong vài nanoseconds.

---

## 5. `std::async` & `std::future` — Task-Based Parallelism

Khác với việc quản lý thread cấp thấp bằng `std::thread`, `std::async` cho phép lập trình viên tư duy theo cấp độ Tác vụ (Task): Trả về một đối tượng `std::future<T>` đại diện cho kết quả sẽ được tính toán trong tương lai.

```cpp
#include <future>
#include <iostream>

int calculateChecksum(const uint8_t* data, size_t len)
{
    // Tính toán nặng...
    return 42;
}

int main()
{
    // Khởi chạy tác vụ bất đồng bộ trên một worker thread của runtime
    std::future<int> result = std::async(std::launch::async, calculateChecksum, nullptr, 0);

    // Luồng chính tiếp tục làm việc khác...
    
    // Thu nhận kết quả (nếu chưa tính xong sẽ block tại đây)
    int checksum = result.get();
    std::cout << "Checksum: " << checksum << "\n";
    return 0;
}
```

---

## 6. Thread Pool Architecture & Tối Ưu Hóa Bộ Nhớ L1 Cache

### 6.1 Triển Khai Thread Pool Hoàn Chỉnh Chuẩn Modern C++

Thay vì liên tục tạo và hủy luồng bằng `std::thread` (tiêu tốn từ hàng chục nghìn đến hàng triệu chu kỳ CPU cho mỗi lần gọi Kernel tạo thread stack 1MB-8MB), Thread Pool duy trì một tập hợp cố định các Worker Threads và tái sử dụng chúng qua một Hàng đợi Tác vụ (`Task Queue`).

```cpp
#include <vector>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <future>
#include <functional>
#include <memory>
#include <type_traits>

class ThreadPool
{
private:
    std::vector<std::thread> m_workers;
    std::queue<std::function<void()>> m_tasks;

    std::mutex m_queueMutex;
    std::condition_variable m_cv;
    bool m_stop{false};

public:
    explicit ThreadPool(size_t numThreads = std::thread::hardware_concurrency())
    {
        for (size_t i = 0; i < numThreads; ++i)
        {
            m_workers.emplace_back([this]()
            {
                while (true)
                {
                    std::function<void()> task;
                    {
                        // 1. Chờ tác vụ với predicate chống Spurious Wakeup
                        std::unique_lock<std::mutex> lock(this->m_queueMutex);
                        this->m_cv.wait(lock, [this]()
                        {
                            return this->m_stop || !this->m_tasks.empty();
                        });

                        // 2. Nếu đã dừng và hàng đợi rỗng -> Luồng thoát an toàn
                        if (this->m_stop && this->m_tasks.empty())
                        {
                            return;
                        }

                        // 3. Lấy tác vụ ra khỏi hàng đợi
                        task = std::move(this->m_tasks.front());
                        this->m_tasks.pop();
                    }

                    // 4. Thực thi tác vụ ngoài phạm vi khóa (Lock Scope)
                    task();
                }
            });
        }
    }

    // Đăng ký tác vụ tùy ý với kiểu trả về bất kỳ (trả về std::future)
    template <typename F, typename... Args>
    auto enqueue(F&& f, Args&&... args)
        -> std::future<typename std::invoke_result<F, Args...>::type>
    {
        using ReturnType = typename std::invoke_result<F, Args...>::type;

        // Đóng gói tác vụ kèm tham số vào std::packaged_task
        auto task = std::make_shared<std::packaged_task<ReturnType()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...)
        );

        std::future<ReturnType> res = task->get_future();
        {
            std::unique_lock<std::mutex> lock(m_queueMutex);

            if (m_stop)
            {
                throw std::runtime_error("LỖI: Không thể nạp tác vụ vào ThreadPool đã dừng!");
            }

            m_tasks.emplace([task]()
            {
                (*task)();
            });
        }
        m_cv.notify_one();
        return res;
    }

    // Graceful Shutdown: Hủy an toàn toàn bộ worker threads
    ~ThreadPool()
    {
        {
            std::unique_lock<std::mutex> lock(m_queueMutex);
            m_stop = true;
        }
        m_cv.notify_all(); // Đánh thức toàn bộ worker đang ngủ

        for (std::thread& worker : m_workers)
        {
            if (worker.joinable())
            {
                worker.join(); // Chờ hoàn tất mọi tác vụ đang chạy dở
            }
        }
    }
};
```

### 6.2 Tranh Chấp Khóa (Lock Contention) & Kiến Trúc Work-Stealing Pool

Trong các hệ thống xử lý lượng tác vụ cực lớn (hàng triệu vi tác vụ/giây trong mạng nơ-ron hoặc đồ họa), mô hình **Single Global Queue** gặp điểm nghẽn nghiêm trọng: Mọi worker thread đều tranh chấp chung 1 mutex để lấy việc $\rightarrow$ Nghẽn khóa (**Lock Contention**).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH SINGLE QUEUE THREAD POOL VS WORK-STEALING POOL                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Single Global Task Queue (Truyền thống):                                 │
│    [ Worker 1 ] ──┐                                                         │
│    [ Worker 2 ] ──┼──▶ [ Global Mutex ] ──▶ [ Task Queue ] ──▶ NGHẼN KHÓA! │
│    [ Worker N ] ──┘                                                         │
│                                                                             │
│ 2. Work-Stealing Architecture (Intel TBB, Go Runtime, Tokos):               │
│    Worker 1 ──▶ [ Local Deque 1 ] (Lấy ở đầu Head - LIFO/FIFO)              │
│    Worker 2 ──▶ [ Local Deque 2 ]                                           │
│       │                                                                     │
│       └──────── Trộm việc khi Deque 2 rỗng ──────────▶ [ Trộm ở đuôi Tail ] │
│                 (Giảm 90% tranh chấp Mutex, tối ưu hóa tuyệt đối L1 Cache)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Ràng Buộc Thread Pool Trong Hệ Thống Nhúng Real-Time (AUTOSAR / MISRA)

Trong môi trường xe hơi an toàn cao (ISO 26262 ASIL-D), việc sử dụng code Thread Pool tổng quát bằng `std::function` và `std::queue` tiềm ẩn 2 lỗi chí mạng:
1. **Phân bổ Heap ngoài ý muốn:** `std::function` có thể cấp phát Heap nếu Lambda Closure vượt ngưỡng kích thước SBO (~16-32 bytes).
2. **Dung lượng hàng đợi bất định:** `std::queue` (`std::deque`) liên tục cấp phát các block bộ nhớ mới khi hàng đợi dài ra.

**Giải pháp Chuẩn Nhúng Ô tô:**
- Bắt buộc dùng **Bounded Fixed-Capacity Ring Buffer** (Ví dụ `BoundedRingBuffer<StaticTask, 256>`).
- Task được định nghĩa là con trỏ hàm hoặc functor có kích thước cố định, xác định trước kích thước bộ nhớ tĩnh ngay tại thời điểm khởi tạo hệ thống (Zero-Heap Initialization).

### 6.4 Case Study: Hiện Tượng Tranh Chấp L1 Cache (False Sharing) Trong Thread Pool Worker Tasks

> [!CAUTION]
> **Bối cảnh:** Hệ thống trạm sạc xe điện thông minh phân tích song song dòng điện 8 kênh sensor thông qua Thread Pool gồm 8 luồng worker độc lập. Mỗi worker nhận nhiệm vụ cập nhật bộ đếm xung năng lượng của kênh đó vào một mảng toàn cục.
> **Triệu chứng:** Khi chạy trên CPU 8 lõi thực, tốc độ xử lý của 8 luồng chạy song song lại **chậm hơn 3.8 lần** so với khi chạy tuần tự trên 1 luồng đơn lẻ. Báo cáo phần cứng cho thấy bus CPU bị nghẽn do thông điệp Cache Coherency (MESI protocol invalidations) liên tục phát sinh giữa các lõi.

```cpp
// TRƯỚC (Lỗi): Các biến riêng của từng luồng nằm liền kề trong cùng 1 Cache Line 64 bytes
struct WorkerCounter
{
    uint64_t accumulated_energy; // 8 bytes
};

// 8 biến của 8 luồng nằm liên tiếp: 8 * 8 = 64 bytes -> NẰM CHUNG 1 ĐƯỜNG DẪN CACHE!
WorkerCounter g_counters[8];

void workerFunction(int worker_id)
{
    for (int i = 0; i < 10000000; ++i)
    {
        // LỖI FALSE SHARING: Luồng 0 sửa g_counters[0] khiến L1 Cache Line của Core 1, 2, 3.. 7
        // bị CPU đánh dấu INVALIDATE. Mỗi lần ghi là một lần phải reload lại L1 từ L3 Cache!
        g_counters[worker_id].accumulated_energy += 1;
    }
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ HIỆN TƯỢNG FALSE SHARING: TRANH CHẤP TRÊN 1 CACHE LINE 64 BYTES             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Core 0 (Thread 0)                   Core 1 (Thread 1)                       │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ L1 Data Cache Line (64 Bytes Shared Line):                             │  │
│ │ [ Counter 0 (8B) ] [ Counter 1 (8B) ] ... [ Counter 7 (8B) ]          │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│        ▲                                   ▲                                │
│        │ Ghi dữ liệu                       │ Ghi dữ liệu                    │
│   Kích hoạt tín hiệu Invalidate       Kích hoạt tín hiệu Invalidate         │
│   ════════════════ CPU Bus nghẽn tín hiệu Bus Snooping ════════════════════ │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Đệm căn chỉnh bộ nhớ theo kích thước Cache Line phần cứng
#include <new>
#include <cstdint>

// Xác định kích thước Cache Line vật lý (thường là 64 bytes trên x86_64 và ARM64)
#ifdef __cpp_lib_hardware_interference_size
    using std::hardware_destructive_interference_size;
#else
    constexpr size_t hardware_destructive_interference_size = 64;
#endif

// Bắt buộc mỗi struct phải chiếm trọn vẹn tối thiểu 1 Cache Line độc lập
struct alignas(hardware_destructive_interference_size) AlignedWorkerCounter
{
    uint64_t accumulated_energy{0};
    // Compiler tự động chèn 56 bytes padding vào cuối struct để đạt tròn 64 bytes
};

AlignedWorkerCounter g_alignedCounters[8];

void workerFunctionOptimized(int worker_id)
{
    for (int i = 0; i < 10000000; ++i)
    {
        // MỖI CORE THAO TÁC TRÊN CACHE LINE HOÀN TOÀN TÁCH BIỆT
        // Zero cache invalidations -> Tốc độ tăng tốc tuyến tính hoàn hảo theo số lõi!
        g_alignedCounters[worker_id].accumulated_energy += 1;
    }
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - False Sharing là lỗi hiệu năng âm thầm nguy hiểm nhất trong lập trình đa luồng trên kiến trúc đa lõi (SMP). Mã nguồn hoàn toàn đúng về mặt logic, không có Data Race (do mỗi luồng ghi vào 1 phần tử mảng khác nhau), nhưng xung đột phần cứng tại tầng Cache Line làm hiệu năng sụt giảm nghiêm trọng.
> - Sử dụng từ khóa `alignas(64)` hoặc `alignas(std::hardware_destructive_interference_size)` trong C++17 để cô lập hoàn toàn vùng nhớ nhạy cảm của từng luồng.

---

## 7. Thread Safety Detection Tools

- **ThreadSanitizer (TSan)**: Biên dịch với `g++ -fsanitize=thread -g main.cpp -lpthread`. Phát hiện chính xác từng cặp lệnh đọc/ghi gây Data Race cùng Call Stack tương ứng.
- **Helgrind (Valgrind)**: Chạy với `valgrind --tool=helgrind ./app`. Kiểm tra thứ tự cấp phát khóa để cảnh báo nguy cơ tiềm ẩn Deadlock trước khi nó xảy ra trên thực tế.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: std::thread](https://en.cppreference.com/w/cpp/thread/thread) | Quản lý luồng, `join()`, `detach()`, `hardware_concurrency()` |
| [cppreference: std::mutex](https://en.cppreference.com/w/cpp/thread/mutex) | Đồng bộ hóa, `lock_guard`, `unique_lock`, `scoped_lock` (C++17) |
| [cppreference: std::condition_variable](https://en.cppreference.com/w/cpp/thread/condition_variable) | Giao tiếp giữa các luồng, `wait(predicate)`, `notify_one/all` |
| [cppreference: std::atomic](https://en.cppreference.com/w/cpp/atomic/atomic) | Lock-free operations, Memory Ordering (`relaxed`, `acquire/release`, `seq_cst`) |
| [cppreference: hardware_destructive_interference_size](https://en.cppreference.com/w/cpp/thread/hardware_destructive_interference_size) | Kích thước L1 Cache Line vật lý chống hiện tượng False Sharing |
| *C++ Concurrency in Action* (Anthony Williams) — Chapter 2, 3, 4, 5 | Toàn diện về Thread Management, Data Sharing, Lock-free Programming |
| [Effective Modern C++ — Item 35, 36 (Bản dịch TV)](../../effective_modern_cpp/item_35.md) | Ưu tiên lập trình dựa trên tác vụ (Task-based) với `std::async` (xem thêm [Item 36](../../effective_modern_cpp/item_36.md)) |
| [Effective Modern C++ — Item 37, 38 (Bản dịch TV)](../../effective_modern_cpp/item_37.md) | Đảm bảo `std::thread` unjoinable trên mọi nhánh rẽ (xem thêm [Item 38](../../effective_modern_cpp/item_38.md)) |
| [Effective Modern C++ — Item 39, 40 (Bản dịch TV)](../../effective_modern_cpp/item_39.md) | Dùng `void` futures cho sự kiện một lần; `std::atomic` cho concurrency (xem thêm [Item 40](../../effective_modern_cpp/item_40.md)) |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Tình Huống | Giải Pháp Kỹ Thuật |
| :--- | :--- |
| Chạy tác vụ nền độc lập | `std::thread` hoặc `std::async(std::launch::async, ...)` |
| Bảo vệ vùng dữ liệu chia sẻ | `std::mutex` + `std::lock_guard` (RAII) |
| Khóa nhiều hơn một mutex an toàn | `std::scoped_lock lock(m1, m2);` (C++17 Deadlock avoidance) |
| Luồng này chờ sự kiện từ luồng kia | `std::condition_variable` + `wait(lock, predicate)` |
| Biến đếm chia sẻ tốc độ cao | `std::atomic<T>` với `fetch_add` (Lock-Free) |
| Chống Torn Read khung hình lớn (MB) | Double Buffering + Atomic Index Exchange (Zero-Copy) |
| Chống xung đột L1 Cache Line giữa các lõi | `alignas(hardware_destructive_interference_size)` |
| Phát hiện Race Condition tự động | Biên dịch `-fsanitize=thread` (TSan) hoặc `valgrind --tool=helgrind` |
