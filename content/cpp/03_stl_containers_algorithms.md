# STL Containers & Algorithms — Hiểu Sâu Để Chọn Đúng

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp kiến thức chuyên sâu về STL containers (memory layout, complexity) và STL algorithms. Mục tiêu: biết chọn đúng container cho đúng use case, tránh performance pitfall trong image/video processing pipeline.

---

## 1. Sequence Containers

### 1.1 `std::vector`

> [!NOTE]
> **Memory Layout & Đặc điểm:**
> Contiguous memory (như mảng C). `size()` = số phần tử hiện tại, `capacity()` = số phần tử có thể chứa trước khi realloc. Growth factor thường 2x (GCC) hoặc 1.5x (MSVC).
>
> ```cpp
> std::vector<int> vec;
> vec.push_back(1);  // O(1) amortized
> vec.push_back(2);
> int first = vec[0];       // O(1) random access
> int second = vec.at(1);   // O(1) + bounds check
> int f = vec.front();      // first element
> int l = vec.back();       // last element
> ```
>
> Slide FPT: "Best for dynamic arrays with fast random access and infrequent insertions/deletions."

> [!WARNING]
> **Iterator Invalidation:**
> `push_back()` CÓ THỂ invalidate **TẤT CẢ** iterators (nếu capacity không đủ → realloc → copy toàn bộ data sang vùng nhớ mới). `erase()` invalidate từ vị trí erase trở đi. `insert()` tương tự.
>
> **Quy tắc:** Không giữ iterator/pointer vào vector qua các thao tác có thể thay đổi size.

> [!TIP]
> **Tối ưu vector:**
>
> ```cpp
> vec.reserve(1000);          // Pre-allocate — tránh realloc khi biết trước số lượng
> vec.shrink_to_fit();        // Giải phóng capacity thừa
> vec.emplace_back(10, 5);    // Construct in-place — tránh copy/move
>
> // Iterate đúng cách:
> for (const auto& val : vec) { cout << val << " "; }
>
> // Size vs Capacity:
> cout << vec.size();      // Số phần tử hiện tại
> cout << vec.capacity();  // Số phần tử có thể chứa trước khi realloc
> ```

### 1.2 `std::deque`

> [!NOTE]
> **Double-ended array** (chunked memory, không contiguous). O(1) insert/remove ở CẢ HAI đầu. O(1) random access. Không dùng được cho SIMD/pointer arithmetic vì không contiguous. Slide FPT: "Best for double-ended operations with efficient insertions and deletions at both ends."

### 1.3 `std::list` / `std::forward_list`

> [!NOTE]
> **Doubly linked list** (`std::list`) / Singly linked list (`std::forward_list`). O(1) insert/erase bất kỳ đâu NẾU có iterator. Không có random access (phải `std::advance(it, n)` — O(n)). Cache-unfriendly → hiếm khi dùng trong CV/embedded. Slide FPT: "Best for scenarios with frequent insertions/deletions and where random access is not needed."

### 1.4 `std::array` (C++11)

> [!NOTE]
> **Mảng tĩnh cố định kích thước, phân bổ trên Stack.** Zero overhead so với mảng C thuần. Kích thước `N` phải biết lúc compile-time.
>
> ```cpp
> #include <array>
> std::array<int, 5> arr = {1, 2, 3, 4, 5};
> arr[0] = 10;                    // O(1) random access
> arr.at(10);                     // throws std::out_of_range
> constexpr auto size = arr.size(); // constexpr compatible
> int* raw = arr.data();          // Con trỏ tới vùng nhớ liên tục
> ```
>
### 1.5 Case Study: Thảm Họa Chọn Sai Container std::list Cho Khung Hình Camera ADAS — Nghẽn Cache Miss 87% Và Tối Ưu Bằng Circular Buffer

> [!CAUTION]
> **Bối cảnh:** Pipeline xử lý ảnh thời gian thực (Computer Vision ADAS) trên SoC ô tô: Module camera thu nhận 30 khung hình/giây (mỗi frame 2MB raw Bayer data). Module tiền xử lý cần giữ bộ đệm 60 frame gần nhất để khử nhiễu đa khung hình (Temporal Denoising). Lập trình viên chọn `std::list<FrameData>` vì lý do "cần push_back và pop_front liên tục ở cả 2 đầu trong $O(1)$".
>
> **Hạn chế của phương án cũ (std::list gây nghẽn bộ nhớ đệm):**
> 1. `std::list` là danh sách liên kết đôi (Doubly-Linked List) — mỗi node được cấp phát rời rạc bằng `malloc` trên heap. Các node nằm rải rác cách nhau hàng chục đến hàng trăm kilobytes trong không gian địa chỉ.
> 2. Khi chạy vòng lặp xử lý 60 frames, con trỏ CPU nhảy cóc liên tục (Pointer Chasing). Trình dự đoán phần cứng (Hardware Prefetcher) hoàn toàn bất lực $\rightarrow$ Công cụ `perf stat` đo được **tỉ lệ Cache Miss lên tới 87.4%**!
> 3. CPU liên tục bị treo (Memory Stall) chờ nạp dữ liệu từ DRAM. Pipeline bị tụt tốc độ từ 30 FPS xuống vỏn vẹn **8.2 FPS**, gây trễ cảnh báo tiền va chạm.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ CACHE MISS CỦA STD::LIST VS CIRCULAR BUFFER LIÊN TỤC TRÊN BỘ NHỚ     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. STD::LIST (POINTER CHASING — MỖI LẦN TRUY CẬP = 1 LẦN CACHE MISS):       │
│    0x7F00_1000 ┌──────────┐                                                │
│    Node 0:     │ [2MB RAW]│──next (Nhảy cóc xa 48KB trên Heap) ──┐          │
│                └──────────┘                                      │          │
│    0x7F00_D000 ┌──────────┐                                      │          │
│    Node 1:     │ [2MB RAW]│◀─────────────────────────────────────┘          │
│                └──────────┘ ──▶ Prefetcher thất bại, CPU chờ DRAM 200 cycles!│
│                                                                             │
│ 2. INDEX-BASED CIRCULAR BUFFER (VÙNG NHỚ MẢNG LIÊN TỤC 100%):               │
│    ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐      │
│    │ Frame 0  │ Frame 1  │ Frame 2  │ Frame 3  │ Frame 4  │ Frame N  │      │
│    └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘      │
│    ▲                     ▲                                                  │
│    [Tail: Đọc cũ nhất]   [Head: Ghi đè mới nhất - O(1) modulo index]        │
│    ──▶ Dữ liệu liên tục, L1/L2 Cache hit 97%, CPU chạy trơn tru 60 FPS!     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (std::list rải rác khắp heap gây sập hiệu năng)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Dùng std::list cho pipeline xử lý ảnh
struct FrameData
{
    uint8_t rawPixels[1920 * 1080];
};

std::list<FrameData> g_frameList;

void onNewFrameBad(const FrameData& frame)
{
    g_frameList.push_back(frame); // Cấp phát node mới trên heap rải rác
    if (g_frameList.size() > 60)
    {
        g_frameList.pop_front();  // Giải phóng tạo lỗ hổng heap
    }
}

void processFramesBad()
{
    // Duyệt qua 60 node: Mỗi node là 1 lần nhảy pointer -> 87% cache miss!
    for (const auto& frame : g_frameList)
    {
        // Áp dụng thuật toán lọc nhiễu -> Chạy chậm chạm 8.2 FPS
    }
}
```

#### Code SAU (Circular Buffer với mảng liên tục & trượt index O(1) Zero-Copy)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Index-based Circular Buffer chuẩn Allman Style
template <typename T, size_t Capacity>
class CircularFrameBuffer
{
private:
    std::array<T, Capacity> m_buffer; // Bộ nhớ liên tục 100%
    size_t m_head{0};
    size_t m_tail{0};
    size_t m_size{0};

public:
    void push(T&& frame)
    {
        m_buffer[m_head] = std::move(frame); // Ghi đè trực tiếp in-place
        m_head = (m_head + 1) % Capacity;

        if (m_size < Capacity)
        {
            ++m_size;
        }
        else
        {
            m_tail = (m_tail + 1) % Capacity; // Trượt tail O(1), không memmove dữ liệu
        }
    }

    size_t size() const noexcept { return m_size; }

    const T& operator[](size_t idx) const noexcept
    {
        return m_buffer[(m_tail + idx) % Capacity]; // O(1) contiguous random access
    }
};

static CircularFrameBuffer<FrameData, 60> g_safeFrameBuffer;

void onNewFrameFast(FrameData&& frame)
{
    g_safeFrameBuffer.push(std::move(frame)); // O(1) Zero Heap Allocation
}

void processFramesFast()
{
    // Dữ liệu nằm liên tục -> CPU prefetcher nạp thẳng vào L1 Cache
    for (size_t i = 0; i < g_safeFrameBuffer.size(); ++i)
    {
        const FrameData& frame = g_safeFrameBuffer[i];
        // Xử lý bộ lọc nhiễu: Cache miss < 2.5%, đạt đỉnh 60 FPS mượt mà!
    }
}
```

> [!TIP]
> **Bài học rút ra:**
> - Trong xử lý luồng dữ liệu thông lượng cao (High-throughput streams: Video, Audio, Telemetry), **tính cục bộ bộ nhớ đệm (Cache Locality)** quan trọng hơn nhiều so với độ phức tạp thuật toán lý thuyết.
> - Luôn ưu tiên các container cấp phát bộ nhớ liên tục (`std::vector`, `std::array`, Ring Buffer) thay vì các cấu trúc dữ liệu dựa trên liên kết node (`std::list`, `std::forward_list`).

---

## 2. Associative Containers

### 2.1 `std::map` / `std::set`

> [!NOTE]
> **Cây đỏ đen (Red-Black Tree)** — phần tử luôn được sắp xếp theo key. Mọi thao tác đều $O(\log N)$.
>
> ```cpp
> std::map<std::string, int> scores;
> scores["Alice"] = 95;            // Insert hoặc update: O(log N)
> scores.insert({"Bob", 87});      // Chỉ insert nếu key chưa tồn tại
> auto it = scores.find("Alice");  // O(log N) — trả iterator
> if (it != scores.end()) { std::cout << it->second; }  // 95
>
> // Duyệt theo thứ tự key tăng dần (tự động sorted):
> for (const auto& [name, score] : scores) { /* Alice → Bob */ }
>
> // Custom comparator (sắp giảm dần):
> std::map<int, std::string, std::greater<int>> desc_map;
> ```
>
> `std::set<T>` tương tự nhưng chỉ lưu key (không có value). `std::multimap` / `std::multiset` cho phép key trùng lặp.

### 2.2 `std::unordered_map` / `std::unordered_set`

> [!NOTE]
> **Bảng băm (Hash Table)** — trung bình $O(1)$ cho insert/find/erase, tệ nhất $O(N)$ khi nhiều hash collision.
>
> ```cpp
> std::unordered_map<std::string, int> cache;
> cache.reserve(1000);              // Pre-allocate buckets — tránh rehash
> cache["sensor_01"] = 42;          // O(1) average
> cache.count("sensor_01");         // 1 nếu tồn tại, 0 nếu không
>
> // Custom hash function (bắt buộc cho user-defined key type):
> struct PairHash {
>     size_t operator()(const std::pair<int,int>& p) const {
>         return std::hash<int>{}(p.first) ^ (std::hash<int>{}(p.second) << 16);
>     }
> };
> std::unordered_map<std::pair<int,int>, float, PairHash> pixel_cache;
> ```

> [!TIP]
> **Khi nào `map` vs `unordered_map`:**
>
> 
### 2.3 Case Study: Tiến Hóa Từ std::map Node-Based Sang Flat Vector & std::unordered_map Trong Bảng Tra Cứu Tín Hiệu CAN ID Ô Tô

> [!CAUTION]
> **Bối cảnh:** Module Gateway ô tô (`CanMessageDispatcher`) xử lý giải mã tín hiệu từ mạng CAN Bus ở tần số 1,000 frames/giây. Xe có 128 mã CAN ID cố định (ví dụ: `0x120` = Phanh ABS, `0x240` = Góc lái EPS, `0x320` = Tốc độ bánh xe). Cần tra cứu nhanh handler tương ứng cho mỗi frame nhận được.
>
> **Hạn chế của phương án cũ (Lạm dụng std::map cây đỏ đen):**
> Lập trình viên sử dụng `std::map<uint32_t, CanHandler>`:
> 1. **Overhead bộ nhớ node khổng lồ:** Mỗi phần tử trong `std::map` là một node cấp phát riêng trên Heap chứa: con trỏ `parent`, `left`, `right` (24 bytes trên 64-bit) + `color` (1 byte) + 7 bytes padding $\rightarrow$ Tốn tới **32 bytes overhead** chỉ để lưu 8 bytes dữ liệu!
> 2. **Nghẽn bộ nhớ do Pointer Dereferencing:** Để tìm một CAN ID, CPU phải duyệt cây đỏ đen qua $\log_2(128) = 7$ bước nhảy con trỏ ngẫu nhiên khắp bộ nhớ Heap $\rightarrow$ Gây ra chuỗi Cache Misses liên tục và Branch Mispredictions.
> 3. Đo đạc bằng profiler: Thao tác tra cứu bản tin ngốn tới **16.5% thời gian CPU** của vi điều khiển Gateway.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH TRA CỨU: STD::MAP (CÂY PHÂN MẢNH) VS FLAT MAP (MẢNG LIÊN TỤC)       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. STD::MAP (CÂY ĐỎ ĐEN — 7 BƯỚC NHẢY CON TRỎ TRÊN HEAP RẢI RÁC):           │
│             [Root Node ID 0x300] (0x7F00_1000)                              │
│             ├── Left (Nhảy 40KB) ──▶ [Node 0x150] (0x7F00_B000)             │
│             └── Right (Nhảy 80KB) ─▶ [Node 0x480] (0x7F01_5000)             │
│    ──▶ Mỗi bước so sánh là 1 lần Cache Miss! CPU stall chờ RAM 7 lần.        │
│                                                                             │
│ 2. FLAT MAP DỰA TRÊN VECTOR / ARRAY (CONTIGUOUS MEMORY + BINARY SEARCH):    │
│    Mảng liên tục đã được sort sẵn lúc boot:                                 │
│    ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐      │
│    │ ID:0x050 │ ID:0x120 │ ID:0x180 │ ID:0x240 │ ID:0x310 │ ID:0x480 │      │
│    └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘      │
│    ▲────────────────── 1 Cache Line 64B nạp trọn 8 phần tử ─────────▲       │
│    ──▶ std::lower_bound chạy nhị phân hoàn toàn trong CPU Cache!             │
│    ──▶ Nhanh hơn 3.8 lần, 0 byte cấp phát heap, 100% Deterministic!          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (std::map gây nghẽn tra cứu CAN)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Dùng std::map cho dữ liệu ít thay đổi
using CanHandler = void (*)(const uint8_t*);

class CanDispatcherBad
{
private:
    std::map<uint32_t, CanHandler> m_handlerMap; // Red-Black Tree rải rác

public:
    void registerHandler(uint32_t canId, CanHandler handler)
    {
        m_handlerMap[canId] = handler; // Cấp phát node heap
    }

    void dispatch(uint32_t canId, const uint8_t* data)
    {
        // Tra cứu 7 bước nhảy con trỏ: 16.5% CPU bottleneck!
        auto it = m_handlerMap.find(canId);
        if (it != m_handlerMap.end())
        {
            it->second(data);
        }
    }
};
```

#### Code SAU (Flat Map với Sorted std::vector + std::lower_bound chuẩn Allman)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Flat Map bộ nhớ phẳng liên tục (Flat Contiguous Map)
class CanDispatcherOptimized
{
private:
    struct Entry
    {
        uint32_t canId;
        CanHandler handler;

        // Toán tử so sánh phục vụ tìm kiếm nhị phân
        bool operator<(const Entry& other) const noexcept
        {
            return canId < other.canId;
        }
    };

    std::vector<Entry> m_entries; // Mảng phẳng contiguous memory

public:
    void registerHandler(uint32_t canId, CanHandler handler)
    {
        m_entries.push_back({canId, handler});
    }

    void finalizeSetup()
    {
        // Sắp xếp mảng một lần duy nhất lúc khởi động xe (Boot phase)
        std::sort(m_entries.begin(), m_entries.end());
    }

    void dispatch(uint32_t canId, const uint8_t* data) const
    {
        Entry dummy{canId, nullptr};
        // Tìm kiếm nhị phân O(log N) trên bộ nhớ liên tục bằng std::lower_bound
        auto it = std::lower_bound(m_entries.begin(), m_entries.end(), dummy);

        if (it != m_entries.end() && it->canId == canId)
        {
            it->handler(data); // Cache hit 99%, CPU load giảm từ 16.5% xuống 4.1%!
        }
    }
};
```

> [!TIP]
> **Bài học rút ra:**
> - Khi tập dữ liệu có kích thước nhỏ đến trung bình ($N < 256$) và **chủ yếu đọc, hiếm khi thêm/xóa lúc runtime** (như cấu hình, bảng mã lỗi DTC, bảng tín hiệu CAN): **Flat Map (Sorted Vector + Binary Search)** luôn vượt trội `std::map` về tốc độ, cache locality và tiết kiệm RAM.
> - Chỉ dùng `std::unordered_map` khi số lượng phần tử rất lớn ($N > 1000$) và yêu cầu tốc độ $O(1)$ mà không quan tâm đến thứ tự sắp xếp.

---

## 3. Container Adaptors

> [!NOTE]
> **`std::stack`, `std::queue`, `std::priority_queue`:**
> Container adaptors — bọc container bên dưới (mặc định `deque`) và chỉ expose interface giới hạn.
>
> | Adaptor | Interface | Container mặc định | Use case |
> |:--|:--|:--|:--|
> | `std::stack<T>` | `push()`, `top()`, `pop()` — LIFO | `deque` | Undo history, DFS, expression parsing |
> | `std::queue<T>` | `push()`, `front()`, `pop()` — FIFO | `deque` | BFS, task queue, message queue |
> | `std::priority_queue<T>` | `push()`, `top()`, `pop()` — Max-heap | `vector` | Event scheduling, Dijkstra, A* |

---

## 4. Bảng So Sánh Complexity

| Thao tác | `vector` | `deque` | `list` | `map` | `unordered_map` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Access [i] | O(1) | O(1) | O(n) | O(log n) | O(1) avg |
| Insert front | O(n) | O(1) | O(1) | N/A | N/A |
| Insert back | O(1)* | O(1) | O(1) | N/A | N/A |
| Insert middle | O(n) | O(n) | O(1) | O(log n) | O(1) avg |
| Find | O(n) | O(n) | O(n) | O(log n) | O(1) avg |
| Erase | O(n) | O(n) | O(1) | O(log n) | O(1) avg |

---

## 5. STL Algorithms

> [!NOTE]
> **Các algorithm hay dùng nhất:**
>
> | Algorithm | Header | Mô tả | Ví dụ |
> |:--|:--|:--|:--|
> | `std::find` | `<algorithm>` | Tìm phần tử | `auto it = std::find(v.begin(), v.end(), 42);` |
> | `std::find_if` | `<algorithm>` | Tìm theo điều kiện | `std::find_if(v.begin(), v.end(), [](int x){ return x > 10; });` |
> | `std::count_if` | `<algorithm>` | Đếm theo điều kiện | `int n = std::count_if(v.begin(), v.end(), is_even);` |
> | `std::sort` | `<algorithm>` | Sắp xếp ($O(N \log N)$) | `std::sort(v.begin(), v.end());` |
> | `std::binary_search` | `<algorithm>` | Tìm nhị phân (cần sorted) | `bool found = std::binary_search(v.begin(), v.end(), 42);` |
> | `std::lower_bound` | `<algorithm>` | Iterator tới phần tử ≥ val | `auto it = std::lower_bound(v.begin(), v.end(), 42);` |
> | `std::transform` | `<algorithm>` | Biến đổi mỗi phần tử | `std::transform(v.begin(), v.end(), out.begin(), square);` |
> | `std::copy_if` | `<algorithm>` | Copy có điều kiện | `std::copy_if(v.begin(), v.end(), std::back_inserter(out), pred);` |
> | `std::accumulate` | `<numeric>` | Tổng / reduce | `int sum = std::accumulate(v.begin(), v.end(), 0);` |
> | `std::all_of` | `<algorithm>` | Tất cả thỏa mãn? | `bool ok = std::all_of(v.begin(), v.end(), is_positive);` |

> [!TIP]
> **Erase-Remove Idiom (C++11/14) & C++20 `std::ranges`:**
> `std::remove_if` **không thực sự xóa** phần tử — nó dồn phần tử giữ lại về đầu và trả iterator tới vùng "rác" phía sau. Cần gọi `erase()` để thực sự cắt bỏ. Từ C++20, dùng trực tiếp `std::erase_if(v, pred)`.

### 5.3 Case Study: Cạm Bẫy Vừa Duyệt Vừa Xóa (Iterator Invalidation) Trong Bộ Lọc Nhiễu Điểm Mây LiDAR — Tiến Hóa Từ Vòng Lặp Thô Sang Erase-Remove Idiom & std::erase_if

> [!CAUTION]
> **Bối cảnh:** Module tiền xử lý dữ liệu LiDAR ADAS (`LidarFilterNode`) nhận $100{,}000$ điểm 3D mỗi chu kỳ 50ms. Nhiệm vụ là loại bỏ toàn bộ các điểm có cường độ phản xạ yếu (`intensity < 15.0f`) được coi là bụi đường hoặc sương mù.
>
> **Hạn chế của phương án cũ (Vòng lặp thô sơ với vector.erase):**
> Lập trình viên viết vòng lặp `for` thủ công để duyệt và gọi `points.erase(it)`:
> 1. **Undefined Behavior do Iterator Invalidation:** Trong `std::vector`, thao tác `erase(it)` làm vô hiệu hóa (invalidate) iterator `it` và toàn bộ các iterator trỏ vào các phần tử phía sau. Bước lặp tiếp theo `++it` truy cập vào vùng nhớ không xác định $\rightarrow$ Gây **Segmentation Fault ngẫu nhiên**, hoặc nhảy cóc bỏ sót 50% số điểm nhiễu liên tiếp!
> 2. **Độ phức tạp $O(N^2)$ làm nghẽn CPU trầm trọng:** Mỗi lần gọi `erase()`, toàn bộ các phần tử phía sau phải dịch lùi (memmove) 1 vị trí. Khi lọc 30,000 điểm nhiễu, số lượng thao tác sao chép lên tới hàng trăm triệu lần $\rightarrow$ Thời gian xử lý mất tới **340 ms** (vượt xa chu kỳ thời gian thực 50ms của xe tự hành).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH THUẬT TOÁN: VÒNG LẶP THÔ O(N^2) VS ERASE-REMOVE IDIOM O(N)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. VÒNG LẶP THÔ ERASE() (O(N^2) — LIÊN TỤC MEMMOVE DỜI TOÀN BỘ MẢNG):       │
│    [P0] [P1: Xóa] [P2] [P3] ... [PN] ──▶ Dời P2..PN sang trái 1 bước        │
│    ──▶ 30,000 lần xóa = 30,000 × 70,000 bước copy = 2.1 TỶ THAO TÁC (340ms)!│
│    ──▶ it bị vô hiệu hóa ──▶ ++it nhảy cóc phần tử hoặc CRASH CORE DUMP!    │
│                                                                             │
│ 2. ERASE-REMOVE IDIOM / STD::ERASE_IF (O(N) — QUÉT 1 LẦN DUY NHẤT):         │
│    Bước 1: std::remove_if (Two-Pointer In-Place Shift):                     │
│    ┌──────────┬──────────┬──────────┬──────────┬────────────────────────┐   │
│    │ Hợp lệ 0 │ Hợp lệ 1 │ Hợp lệ 2 │ Hợp lệ K │ RÁC CẦN CẮT BỎ...      │   │
│    └──────────┴──────────┴──────────┴──────────┴────────────────────────┘   │
│                                                ▲ it mới trả về              │
│    Bước 2: points.erase(it, points.end()) ──▶ Cắt bỏ đúng 1 lần duy nhất!   │
│    ──▶ Quét tuyến tính O(N) đúng 1.2ms, an toàn tuyệt đối 100%!             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Vòng lặp thô gây crash và giật lag 340ms)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Vừa lặp vừa erase gây Iterator Invalidation & O(N^2)
struct LidarPoint
{
    float x, y, z;
    float intensity;
};

void filterNoiseBad(std::vector<LidarPoint>& points)
{
    // ❌ LỖI 1: ++it sau khi erase là Undefined Behavior!
    // ❌ LỖI 2: O(N^2) dời mảng làm nghẽn CPU 340ms!
    for (auto it = points.begin(); it != points.end(); ++it)
    {
        if (it->intensity < 15.0f)
        {
            points.erase(it); // Invalidate iterator it!
        }
    }
}
```

#### Code SAU (Erase-Remove Idiom & std::erase_if chuẩn Modern C++ Allman Style)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Erase-Remove Idiom O(N) chuẩn mực

// Cách 1 (C++11/C++14/C++17): 2 bước chuẩn công nghiệp
void filterNoiseEraseRemove(std::vector<LidarPoint>& points)
{
    // Bước 1: std::remove_if dồn các phần tử giữ lại về đầu mảng trong O(N)
    auto itGarbageStart = std::remove_if(points.begin(), points.end(),
        [](const LidarPoint& pt) noexcept
        {
            return pt.intensity < 15.0f; // Điều kiện bị lọc bỏ
        }
    );

    // Bước 2: Cắt bỏ vùng rác phía sau đúng 1 lần duy nhất trong O(1)
    points.erase(itGarbageStart, points.end());
    // Thời gian chạy đo được: 1.2ms (Nhanh hơn 280 lần so với vòng lặp thô!)
}

// Cách 2 (C++20 Best Practice): 1 bước duy nhất, zero boilerplate
void filterNoiseCpp20(std::vector<LidarPoint>& points)
{
    std::erase_if(points, [](const LidarPoint& pt) noexcept
    {
        return pt.intensity < 15.0f;
    });
}
```

> [!TIP]
> **Bài học rút ra:**
> - Tuyệt đối không bao giờ gọi `container.erase(it)` bên trong vòng lặp `for` thông thường mà không cập nhật lại iterator trả về từ hàm `erase()` (`it = container.erase(it);`).
> - Luôn ưu tiên sử dụng **Erase-Remove Idiom (`std::remove_if` + `erase`)** hoặc **`std::erase_if` (C++20)** cho mọi thao tác xóa có điều kiện trên các mảng liên tục (`vector`, `deque`, `string`).

---

## 6. Iterator Categories

> [!NOTE]
> **Iterator Hierarchy (từ yếu → mạnh):**
>
> ```
> Input Iterator (istream) ──┐
>                            ├──▶ Forward Iterator (forward_list) ──▶ Bidirectional (list, map) ──▶ Random Access (vector, deque)
> Output Iterator (ostream) ─┘                                                                          │
>                                                                                               Contiguous (C++17)
>                                                                                              (vector, array, string)
> ```
>
> | Loại | Operations | Container tiêu biểu |
> |:--|:--|:--|
> | **Input** | `++`, `*` (đọc), `==`/`!=` | `istream_iterator` |
> | **Output** | `++`, `*` (ghi) | `ostream_iterator`, `back_inserter` |
> | **Forward** | Input + multi-pass | `forward_list`, `unordered_map` |
> | **Bidirectional** | Forward + `--` | `list`, `map`, `set` |
> | **Random Access** | Bidirectional + `[]`, `+n`, `-n`, `<` | `vector`, `deque`, `array` |
> | **Contiguous** (C++17) | Random Access + bộ nhớ liên tục | `vector`, `array`, `string` |

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: Containers library](https://en.cppreference.com/w/cpp/container) | Memory layout, Đảm bảo độ phức tạp (Complexity guarantees), Iterator Invalidation |
| [cppreference: Algorithms library](https://en.cppreference.com/w/cpp/algorithm) | Thuật toán chuẩn STL, Search/Sort, Modifying sequence operations |
| [cppreference: Ranges library](https://en.cppreference.com/w/cpp/ranges) | C++20 Ranges & Views pipeline, Lazy evaluation, Composable operations |
| [Effective Modern C++ — Item 41, 42 (Bản dịch TV)](../../effective_modern_cpp/item_41.md) | Truyền tham trị cho tham số copyable giá rẻ; Cân nhắc Emplacement (`emplace_back`) thay vì Insertion (xem thêm [Item 42](../../effective_modern_cpp/item_42.md)) |
| *Effective STL* (Scott Meyers) — Item 1-50 | Best practices về lựa chọn Containers, Vector reserve, Erase-remove idiom |
| *C++ Core Guidelines* — Standard Library (SL.1 - SL.4) | Nguyên tắc ưu tiên STL Algorithms thay vì vòng lặp tay thô |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Container / Algorithm |
| :--- | :--- |
| Mảng động, truy cập ngẫu nhiên nhanh | `std::vector` — contiguous, O(1) access |
| Key-value lookup nhanh | `std::unordered_map<K,V>` — O(1) average, `reserve()` trước |
| Dữ liệu sắp xếp, range query | `std::map<K,V>` — O(log N), `lower_bound`/`upper_bound` |
| FIFO queue | `std::queue<T>` — `push()`, `front()`, `pop()` |
| Fixed-size array trên stack | `std::array<T, N>` — zero overhead, constexpr, WCET O(1) |
| Lọc phần tử theo điều kiện | `v.erase(std::remove_if(v.begin(), v.end(), pred), v.end())` (C++20: `std::erase_if(v, pred)`) |
| Biến đổi mỗi phần tử | `std::transform(v.begin(), v.end(), out.begin(), func)` |
| Tìm phần tử | `std::find(v.begin(), v.end(), val)` / `std::find_if(v.begin(), v.end(), pred)` |
