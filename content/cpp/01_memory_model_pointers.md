# Quản Lý Bộ Nhớ & Con Trỏ Thông Minh (Memory Management & Smart Pointers)

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp toàn bộ kiến thức về mô hình bộ nhớ C++, các chiến lược quản lý tài nguyên (RAII), và hệ thống con trỏ thông minh (Smart Pointers) — nền tảng sống còn cho mọi dự án CV/Embedded/ADAS.

---

## 1. Stack Frame Chi Tiết

> [!NOTE]
> **Calling Conventions — cdecl vs stdcall:**
>
> | Tiêu chí | `cdecl` (mặc định C/C++ trên x86) | `stdcall` (Win32 API) |
> |:--|:--|:--|
> | Ai dọn stack sau gọi hàm? | **Caller** clean stack | **Callee** clean stack |
> | Thứ tự push arguments | Phải → Trái (right-to-left) | Phải → Trái |
> | Variadic args (`printf`) | ✅ Hỗ trợ (caller biết số lượng args) | ❌ Không hỗ trợ |
> | Name mangling (x86) | `_func` | `_func@N` (N = bytes params) |
>
> **Lưu ý:** Trên **x86_64** (64-bit), cả Linux và Windows đều dùng **register-based** calling convention (6 tham số đầu truyền qua thanh ghi `rdi, rsi, rdx, rcx, r8, r9` trên SysV ABI / `rcx, rdx, r8, r9` trên Windows x64). Phân biệt cdecl/stdcall chỉ còn ý nghĩa trên x86 32-bit.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  x86_64 SysV ABI Stack Frame Layout — Hàm process(int a, int b)             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Địa chỉ cao (High Address) ▲                                               │
│  0x7FFF_FFFF_E000 ┌──────────────────────────────────────────────────────┐  │
│                   │          ... Caller Stack Frame (main) ...           │  │
│                   ├──────────────────────────────────────────────────────┤  │
│                   │  Arg 7, Arg 8, ... (Chỉ xuất hiện nếu > 6 tham số)   │  │
│                   ├──────────────────────────────────────────────────────┤  │
│                   │  Return Address (Địa chỉ lệnh kế tiếp do call push)  │  │
│  RBP ────────────>├──────────────────────────────────────────────────────┤  │
│                   │  Saved Frame Pointer (RBP cũ: push rbp; mov rbp,rsp) │  │
│                   ├──────────────────────────────────────────────────────┤  │
│                   │  Local Variables (RBP - 0x08, RBP - 0x10, ...)       │  │
│                   │  Spilled Registers / Temporary Calculations          │  │
│                   ├──────────────────────────────────────────────────────┤  │
│                   │  128-byte RED ZONE (Leaf Function dùng không tốn RSP)│  │
│  RSP ────────────>├──────────────────────────────────────────────────────┤  │
│                   │  16-byte Aligned Boundary (Bắt buộc cho SIMD/movaps) │  │
│  0x7FFF_FFFF_DC00 └──────────────────────────────────────────────────────┘  │
│  Địa chỉ thấp (Low Address) ▼   (Chiều tăng trưởng Stack: GROWS DOWN ▼)     │
├─────────────────────────────────────────────────────────────────────────────┤
│  * 6 tham số nguyên/con trỏ đầu: RDI, RSI, RDX, RCX, R8, R9 (Qua thanh ghi) │
│  * Tham số số thực: XMM0 .. XMM7 | Giá trị trả về: RAX (int), XMM0 (float)  │
│  * Struct > 16 Bytes: Caller cấp vùng nhớ trước, truyền con trỏ ẩn qua RDI  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Case Study: Thảm Họa Stack Overflow Trên Vi Điều Khiển ARM Cortex-M Của Bộ Điều Khiển Phanh ABS

> [!CAUTION]
> **Bối cảnh:** Module phân tích cấu hình UDS (Unified Diagnostic Services) trên ECU phanh ô tô dùng chip ARM Cortex-M4 (FreeRTOS, cấu hình stack phân bổ cho tác vụ chẩn đoán là **8KB**). Tác vụ cần duyệt cây cú pháp bản tin chẩn đoán lồng nhau (nested diagnostic blocks).
>
> **Hạn chế của phương án cũ (Đệ quy sâu trên Stack):**
> Lập trình viên viết hàm phân tích cú pháp theo giải thuật đệ quy truyền thống:
> ```cpp
> void parseDiagnosticNode(const char* xml, int pos);
> ```
> 1. Mỗi lần đệ quy tạo một Stack Frame tốn ~180 bytes (biến cục bộ `char tagName[64]`, `char attrValue[64]`, biến chỉ số và con trỏ khung stack).
> 2. Khi trạm dịch vụ truyền gói tin kiểm tra phức tạp có 45 cấp lồng nhau: $45 \times 180\text{ B} = 8{,}100\text{ bytes}$.
> 3. Con trỏ Stack `SP` (r13) giảm dần vượt qua biên 8KB, ghi đè trực tiếp vào phân vùng dữ liệu `.bss`/`.data` của FreeRTOS $\rightarrow$ Kích hoạt ngắt phần cứng **HardFault Handler**, toàn bộ ECU phanh ABS bị reset đột ngột ngay khi xe đang kết nối máy quét lỗi!

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ TRÀN STACK (STACK OVERFLOW) TRÊN BỘ NHỚ SRAM 64KB ARM CORTEX-M4      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Địa chỉ cao ▲                                                               │
│ 0x2000_2000 ┌────────────────────────────────────────────────────────────┐  │
│             │ Task Stack (8KB) — Chiều tăng trưởng GROWS DOWN ▼          │  │
│             │ [Frame 0: parseNode] (180B)                                │  │
│             │ [Frame 1: parseNode] (180B)                                │  │
│             │ ...                                                        │  │
│             │ [Frame 44: parseNode] (180B)                               │  │
│ 0x2000_0000 ├────────────────────────────────────────────────────────────┤  │
│      ▲      │ [!] VƯỢT BIÊN STACK 8KB! Con trỏ SP ghi đè vùng nhớ dưới:  │  │
│      │      ├────────────────────────────────────────────────────────────┤  │
│      │      │ FreeRTOS Kernel Data & Task Control Blocks (TCB)          │   │
│      └──────┴──▶ Ghi đè con trỏ OS ──▶ Bắn ngắt vi xử lý HardFault!       │ │
│ Địa chỉ thấp ▼                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Đệ quy ngốn Stack gây crash hệ thống nhúng)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Đệ quy không giới hạn trên hệ thống nhúng bộ nhớ nhỏ
void parseDiagnosticNode(const char* buffer, int pos)
{
    char tagName[64];   // 64 bytes cục bộ trên stack
    char attrValue[64]; // 64 bytes cục bộ trên stack
    int nextPos = 0;

    // ... Đọc thẻ và nội dung ...

    while (hasNextChild(buffer, pos, &nextPos))
    {
        // ❌ Gọi đệ quy: Mỗi tầng push thêm RBP, LR, biến cục bộ -> Tràn stack 8KB!
        parseDiagnosticNode(buffer, nextPos);
    }
}
```

#### Code SAU (Khử đệ quy bằng vòng lặp và Explicit Stack cấp phát tĩnh)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Khử đệ quy bằng vòng lặp + Static Heap Buffer
struct DiagnosticFrame
{
    int position;
    int childIndex;
};

void parseDiagnosticIterative(const char* buffer)
{
    // Cấp phát trước một vùng stack mô phỏng trên Heap (hoặc Static Arena)
    // Hoàn toàn không tiêu tốn thêm một byte nào trên Task Stack của ARM!
    std::vector<DiagnosticFrame> explicitStack;
    explicitStack.reserve(64); // Cố định tối đa 64 cấp lồng nhau, zero reallocation
    explicitStack.push_back({0, 0});

    while (!explicitStack.empty())
    {
        DiagnosticFrame& current = explicitStack.back();
        int nextChildPos = 0;

        if (hasNextChild(buffer, current.position, current.childIndex, &nextChildPos))
        {
            current.childIndex++;
            explicitStack.push_back({nextChildPos, 0}); // Mô phỏng bước gọi hàm đệ quy
        }
        else
        {
            processNode(buffer, current.position);       // Xử lý node khi duyệt xong con
            explicitStack.pop_back();                   // Mô phỏng bước return
        }
    }
    // Task stack chỉ tiêu thụ cố định ~80 bytes cho các con trỏ điều khiển
}
```

> [!TIP]
> **Bài học rút ra:**
> - Tiêu chuẩn an toàn ô tô **MISRA C++:2023 Rule 17.2** nghiêm cấm sử dụng đệ quy (unbounded recursion) trong phần mềm điều khiển nhúng.
> - Bật cờ biên dịch GCC `-fstack-usage` để trình biên dịch tự động sinh tệp `.su` phân tích lượng stack tiêu thụ tối đa của từng hàm trong dự án.
> - Luôn chuyển đổi các giải thuật duyệt cây từ đệ quy sang vòng lặp (iterative) với bộ đệm được cấp phát trước tĩnh (Static Memory Arena).

---

## 2. Heap Allocator Internals

```
    [ new / malloc() ]
           │
           ▼
    ┌───────────────────────────┐
    │  Có free chunk phù hợp    │───(Có)───▶ [ Trả về chunk từ free list ]
    │  trong bins (glibc)?      │                         │
    └─────────────┬─────────────┘                         │
                  │ (Không)                               │
                  ▼                                       │
    ┌───────────────────────────┐                         │
    │  sbrk() / mmap()          │                         │
    │  mở rộng Heap từ Kernel   │─────────────────────────┘
    └───────────────────────────┘                         │
                                                          ▼
                                            [ Trả con trỏ về cho Caller ]
```

> [!NOTE]
> **`new` vs `malloc` — Khác biệt cốt lõi:**
>
> | Tiêu chí | `new` / `delete` | `malloc` / `free` |
> |:--|:--|:--|
> | Gọi constructor/destructor | ✅ Có — tự động gọi | ❌ Không — chỉ cấp phát raw memory |
> | Type safety | ✅ Trả đúng kiểu `T*` | ❌ Trả `void*`, phải cast |
> | Khi thất bại | Throw `std::bad_alloc` | Trả `NULL` |
> | Overloadable | ✅ Có thể override `operator new` | ❌ Không |
> | Header cần | Không cần | `<cstdlib>` |
> | Tính toán size | Tự động `sizeof(T)` | Phải tự tính |
>
> **Quy tắc:** Trong C++ luôn ưu tiên `new`/`delete` (hoặc tốt hơn: smart pointer). Chỉ dùng `malloc`/`free` khi interface với C code hoặc custom allocator.

> [!WARNING]
> **Memory Fragmentation:**
>
> | Loại | Mô tả | Ví dụ |
> |:--|:--|:--|
> | **Internal** | Bộ nhớ bị lãng phí BÊN TRONG block đã cấp phát (do padding/alignment) | `malloc(5)` → allocator cấp 8 bytes → 3 bytes thừa |
> | **External** | Tổng free memory đủ, nhưng bị phân mảnh thành nhiều block nhỏ rời rạc, không có block nào đủ lớn | Sau nhiều lần alloc/free xen kẽ → heap full of holes |
>

### 2.2 Case Study: Khắc Phục Nghẽn Phân Mảnh Bộ Nhớ (Heap Fragmentation) Trong Camera ADAS Bằng Fixed-Block Memory Pool

> [!CAUTION]
> **Bối cảnh:** Module truyền nhận gói tin cảm biến ADAS (`SensorPacketDispatcher`) chạy trên SoC nhúng ô tô (RAM giới hạn 128MB). Module liên tục nhận các gói tin cấu hình nhỏ (64 bytes) và gói tin frame đo lường (1024 bytes) từ mạng Ethernet ô tô với tần suất 100 Hz.
>
> **Hạn chế của phương án cũ (Cấp phát động new/delete thông thường):**
> Lập trình viên sử dụng trực tiếp `new Packet()` và `delete packet` từ heap của hệ thống (glibc ptmalloc):
> 1. **Phân mảnh bộ nhớ ngoài (External Fragmentation):** Các gói tin kích thước khác nhau liên tục được cấp phát và giải phóng xen kẽ ngẫu nhiên. Sau 6 giờ thử nghiệm xe chạy trên đường, heap bị "đục lỗ" thành hàng nghìn khối nhớ vụn vặt.
> 2. **Sập hệ thống bất ngờ (OOM Crash dù RAM còn trống):** Khi pipeline xử lý ảnh cần cấp phát một khối nhớ đệm liên tục 4MB (`new uint8_t[4 * 1024 * 1024]`), allocator thất bại vì không tìm thấy bất kỳ khối nhớ liên tục nào đủ 4MB, mặc dù lệnh `free` báo tổng dung lượng RAM trống còn tới hơn 35MB $\rightarrow$ Ném ngoại lệ `std::bad_alloc`, làm sập toàn bộ hệ thống phát hiện làn đường!
> 3. **Non-deterministic Latency (Độ trễ không xác định):** Khi heap bị phân mảnh, glibc phải duyệt qua các danh sách liên kết free bins dài để tìm chunk phù hợp, đẩy thời gian cấp phát từ 50ns lên tới 2500ns, vi phạm ràng buộc thời gian thực cứng (Hard Real-Time).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ PHÂN MẢNH BỘ NHỚ (FRAGMENTATION) VS FIXED-BLOCK MEMORY POOL          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. HEAP TRUYỀN THỐNG BỊ PHÂN MẢNH NGOÀI (EXTERNAL FRAGMENTATION):           │
│    ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐  │
│    │ [64B]│ FREE │ [1KB]│ FREE │ [64B]│ FREE │ [1KB]│ FREE │ [64B]│ FREE │  │
│    └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘  │
│    ──▶ Tổng dung lượng trống = 35MB nhưng KHÔNG CÓ KHỐI NÀO ĐỦ 4MB LIÊN TỤC!│
│    ──▶ malloc(4MB) THẤT BẠI ──▶ NÉM NGOẠI LỆ STD::BAD_ALLOC!                │
│                                                                             │
│ 2. FIXED-BLOCK MEMORY POOL (CHIA BLOCK CỐ ĐỊNH, FREE-LIST O(1)):            │
│    Mảng bộ nhớ tĩnh liên tục (Pre-allocated Static Block):                  │
│    ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐      │
│    │ Slot 0   │ Slot 1   │ Slot 2   │ Slot 3   │ Slot 4   │ Slot N   │      │
│    │ [1024 B] │ [1024 B] │ [1024 B] │ [1024 B] │ [1024 B] │ [1024 B] │      │
│    └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘      │
│         ▲                     │          ▲                                  │
│         └────── Free List ────┴──────────┘ (O(1) pop/push slot trống)       │
│    ──▶ Triệt tiêu 100% phân mảnh ngoài, thời gian cấp phát xác định O(1).   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Cấp phát heap ngẫu nhiên gây phân mảnh bộ nhớ)

```cpp
// ❌ PHƯƠNG ÁN CŨ: malloc/new trực tiếp trên heap hệ điều hành
struct SensorPacket
{
    uint32_t sensorId;
    uint64_t timestamp;
    uint8_t payload[1012];
};

void onPacketReceived(const uint8_t* rawData, size_t len)
{
    // Cấp phát riêng lẻ trên Heap: Sau vài giờ, heap bị đục lỗ tan hoang
    SensorPacket* packet = new SensorPacket(); 
    std::memcpy(packet->payload, rawData, len);

    // Xử lý gói tin...

    delete packet; // Giải phóng tạo lỗ hổng phân mảnh (fragmentation hole)
}
```

#### Code SAU (Fixed-Block Memory Pool chuẩn Allman Style & O(1) Deterministic)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Memory Pool chia khối cố định, zero-fragmentation
template <typename T, size_t Capacity>
class FixedBlockMemoryPool
{
private:
    union Node
    {
        alignas(T) uint8_t storage[sizeof(T)];
        Node* nextFree; // Tận dụng vùng nhớ trống làm con trỏ Free List (Zero memory waste)
    };

    Node m_pool[Capacity];
    Node* m_freeHead{nullptr};

public:
    FixedBlockMemoryPool()
    {
        // Khởi tạo danh sách Free List liên kết các slot trống lúc boot-up
        for (size_t i = 0; i < Capacity - 1; ++i)
        {
            m_pool[i].nextFree = &m_pool[i + 1];
        }
        m_pool[Capacity - 1].nextFree = nullptr;
        m_freeHead = &m_pool[0];
    }

    T* allocate()
    {
        if (!m_freeHead)
        {
            return nullptr; // Pool đầy, xử lý deterministic (không crash bất ngờ)
        }
        Node* allocatedNode = m_freeHead;
        m_freeHead = m_freeHead->nextFree; // O(1) Pop từ đầu danh sách
        return reinterpret_cast<T*>(allocatedNode);
    }

    void deallocate(T* ptr)
    {
        if (!ptr)
        {
            return;
        }
        Node* freedNode = reinterpret_cast<Node*>(ptr);
        freedNode->nextFree = m_freeHead; // O(1) Push lại vào đầu danh sách
        m_freeHead = freedNode;
    }
};

// Sử dụng trong pipeline ADAS
static FixedBlockMemoryPool<SensorPacket, 256> g_packetPool;

void onPacketReceivedFast(const uint8_t* rawData, size_t len)
{
    // Cấp phát O(1) trong 12ns, tuyệt đối không gây phân mảnh Heap!
    SensorPacket* packet = g_packetPool.allocate();
    if (packet)
    {
        std::memcpy(packet->payload, rawData, len);

        // Xử lý dữ liệu...

        g_packetPool.deallocate(packet); // Trả lại slot trong O(1)
    }
}
```

> [!TIP]
> **Bài học rút ra:**
> - Tiêu chuẩn AUTOSAR và MISRA C++ yêu cầu cấm cấp phát bộ nhớ động không giới hạn sau giai đoạn khởi động (Post-initialization dynamic memory allocation ban).
> - Kỹ thuật **Free-List nhúng (Embedded Free List)** trong Union giúp tận dụng chính ô nhớ trống của đối tượng để lưu con trỏ `nextFree`, không tốn thêm bất kỳ byte RAM nào cho cấu trúc quản lý danh sách.

---

## 3. RAII — Resource Acquisition Is Initialization

> [!IMPORTANT]
> **Nguyên lý RAII:**
> **Resource Acquisition Is Initialization** — gắn vòng đời tài nguyên vào vòng đời object:
> - **Constructor** acquire resource (mở file, cấp phát memory, lock mutex)
> - **Destructor** release resource — được gọi TỰ ĐỘNG khi object ra khỏi scope
> - Đảm bảo KHÔNG BAO GIỜ quên giải phóng, kể cả khi exception xảy ra
>
> ```cpp
> // Ví dụ từ IVI Music Player case study (FPT slide)
> // ❌ Anti-pattern: raw new/delete
> struct TrackInfo_Bad {
>     char* artist; // phải nhớ delete[] → dễ leak
> };
>
> // ✅ RAII: dùng std::string
> struct TrackInfo_Good {
>     std::string artist; // tự quản lý memory
>     std::string album;  // destructor tự free
> };
> ```
>
> **Các RAII wrapper chuẩn trong STL:** `std::string`, `std::vector`, `std::unique_ptr`, `std::lock_guard`, `std::fstream`

> [!TIP]
> **Exception Safety Guarantees:**
>
> | Cấp độ | Tên | Đảm bảo | Ví dụ |
> |:---:|:--|:--|:--|
> | 1 | **Basic Guarantee** | Không rò rỉ tài nguyên, object ở trạng thái valid nhưng có thể khác trước đó | `std::vector::push_back()` — nếu realloc fail, vector vẫn valid nhưng size không đổi |

### 3.2 Case Study: Rò Rỉ POSIX File Descriptor & Deadlock Mutex Trong Module Hộp Đen Ô Tô (Crash Event Recorder)

> [!CAUTION]
> **Bối cảnh:** Module ghi dữ liệu va chạm khẩn cấp ô tô (`CrashEventRecorder`) chạy ngầm trên nền Linux nhúng. Khi cảm biến gia tốc phát hiện va chạm vượt ngưỡng từ ECU túi khí, module lập tức mở tệp nhật ký nhị phân `/var/log/crash.bin`, khóa `pthread_mutex_t` để độc quyền truy cập phần cứng lưu trữ và ghi dữ liệu hộp đen.
>
> **Hạn chế của phương án cũ (Quản lý tài nguyên thủ công kiểu C):**
> Lập trình viên quản lý bằng API C thuần (`open`, `close`, `pthread_mutex_lock`, `pthread_mutex_unlock`):
> 1. **Deadlock vĩnh viễn do Early Return:** Khi bộ nhớ eMMC bị đầy hoặc hàm `write()` trả về lỗi, lập trình viên thực hiện câu lệnh thoát sớm `return false;`. Câu lệnh này vô tình nhảy cóc qua lệnh `pthread_mutex_unlock()`. Luồng gửi tín hiệu cứu hộ khẩn cấp (eCall) chờ mutex này bị treo vĩnh viễn (Deadlock)!
> 2. **Cạn kiệt File Descriptor (FD Leak):** Tương tự, lệnh `close(fd)` bị bỏ qua. Sau một số chu kỳ ghi lỗi, tiến trình chạm trần giới hạn `ulimit -n` (mặc định 1024 FDs), hệ thống báo lỗi `EMFILE (Too many open files)` và ngừng ghi nhận toàn bộ dữ liệu an toàn.
> 3. **Không an toàn với Exception (Exception Safety Violation):** Nếu trong quá trình tính toán mã băm SHA256 phát sinh ngoại lệ, luồng thực thi bị ngắt quãng lập tức, bỏ qua toàn bộ phần dọn dẹp ở cuối hàm.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH LUỒNG GIẢI PHÓNG TÀI NGUYÊN: C-STYLE VS RAII STACK UNWINDING        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. C-STYLE THỦ CÔNG (DỄ BỎ QUÊN KHI CÓ RETURN SỚM / NGOẠI LỆ):              │
│    open(fd) ──▶ mutex_lock() ──▶ Kiểm tra ghi file (LỖI!) ──▶ return false; │
│                                                                 │           │
│    [close(fd)] <── [mutex_unlock()] <── (BỊ BỎ QUA HOÀN TOÀN!) ─┘           │
│    ──▶ HẬU QUẢ: Rò rỉ File Descriptor + Treo cứng luồng khác (Deadlock)!    │
│                                                                             │
│ 2. RAII CHUẨN C++ (TỰ ĐỘNG THU HỒI NHỜ STACK UNWINDING):                    │
│    {                                                                        │
│       FileDescriptorGuard fdGuard(...) ──▶ Tự động open()                   │
│       std::lock_guard<std::mutex> lock(...) ──▶ Tự động lock()              │
│       if (error) return false; ────────────────────────────────────────┐    │
│    }                                                                   │    │
│    ▲                                                                   │    │
│    └──── Ra khỏi scope: Compiler tự động gọi Destructor theo thứ tự:   │    │
│          1. lock dtor ──▶ Tự động unlock()                             │    │
│          2. fdGuard dtor ──▶ Tự động close(fd) <───────────────────────┘    │
│    ──▶ An toàn 100% trước mọi điểm return và ngoại lệ!                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Quản lý thủ công gây rò rỉ FD và treo Mutex)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Dọn dẹp thủ công dễ bị nhảy cóc khi có lỗi
pthread_mutex_t g_crashMutex = PTHREAD_MUTEX_INITIALIZER;

bool recordCrashTelemetry(const uint8_t* telemetryData, size_t size)
{
    pthread_mutex_lock(&g_crashMutex); // Khóa Mutex

    int fd = open("/var/log/crash.bin", O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd < 0)
    {
        // ❌ LỖI CHÍ MẠNG: Thoát sớm nhưng quên unlock Mutex -> Deadlock vĩnh viễn!
        return false; 
    }

    ssize_t written = write(fd, telemetryData, size);
    if (written < static_cast<ssize_t>(size))
    {
        // ❌ LỖI KÉP: Quên close(fd) và quên unlock Mutex -> Rò rỉ FD + Deadlock!
        return false; 
    }

    close(fd);
    pthread_mutex_unlock(&g_crashMutex);
    return true;
}
```

#### Code SAU (Áp dụng trọn vẹn RAII với Lock Guard và Custom FD Guard)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Tự động dọn dẹp bằng RAII Idiom chuẩn Allman Style
class FileDescriptorGuard
{
private:
    int m_fd{-1};

public:
    explicit FileDescriptorGuard(const char* path, int flags, mode_t mode = 0644)
        : m_fd(open(path, flags, mode))
    {
    }

    ~FileDescriptorGuard()
    {
        if (m_fd >= 0)
        {
            close(m_fd); // Tự động đóng file khi ra khỏi scope
        }
    }

    // Cấm copy để đảm bảo quyền sở hữu duy nhất (Unique Ownership)
    FileDescriptorGuard(const FileDescriptorGuard&) = delete;
    FileDescriptorGuard& operator=(const FileDescriptorGuard&) = delete;

    // Hỗ trợ Move Semantics
    FileDescriptorGuard(FileDescriptorGuard&& other) noexcept : m_fd(other.m_fd)
    {
        other.m_fd = -1;
    }

    int get() const noexcept { return m_fd; }
    bool isValid() const noexcept { return m_fd >= 0; }
};

static std::mutex g_safeCrashMutex;

bool recordCrashTelemetrySafe(const uint8_t* telemetryData, size_t size)
{
    // RAII 1: Mutex tự động unlock ngay khi ra khỏi scope bất kể return ở đâu
    std::lock_guard<std::mutex> lock(g_safeCrashMutex);

    // RAII 2: File Descriptor tự động close khi ra khỏi hàm
    FileDescriptorGuard file("/var/log/crash.bin", O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (!file.isValid())
    {
        return false; // lock tự động giải phóng an toàn!
    }

    ssize_t written = write(file.get(), telemetryData, size);
    if (written < static_cast<ssize_t>(size))
    {
        return false; // Cả file và lock tự động thu hồi sạch sẽ!
    }

    return true;
}
```

> [!TIP]
> **Bài học rút ra:**
> - Nguyên lý sống còn của C++ hiện đại: **Không bao giờ gọi hàm giải phóng tài nguyên thủ công (`free`, `delete`, `close`, `unlock`) trong thân hàm logic.**
> - Mọi tài nguyên hệ điều hành (Socket, File, Mutex, DMA handle, Shared Memory) bắt buộc phải được bọc trong một class RAII. Trình biên dịch C++ đảm bảo cơ chế Stack Unwinding kích hoạt Destructor 100% xác định.

---

## 4. Smart Pointers (C++11)

### 4.1 `std::unique_ptr` — Exclusive Ownership

> [!NOTE]
> **Cơ chế hoạt động `unique_ptr`:**
> Sở hữu **duy nhất** — chỉ MỘT `unique_ptr` trỏ tới object tại một thời điểm. Không copy được, chỉ **move** (chuyển quyền sở hữu). Zero overhead so với raw pointer.
>
> ```cpp
> // Tạo unique_ptr
> unique_ptr<Rectangle> P1(new Rectangle(10, 5));
> cout << P1->area() << endl; // 50
>
> // unique_ptr<Rectangle> P2(P1); // ❌ COMPILE ERROR — không copy được
>
> // Chuyển ownership bằng std::move
> unique_ptr<Rectangle> P2;
> P2 = move(P1);                   // P1 giờ là nullptr
> cout << P2->area() << endl;      // 50
> // cout << P1->area() << endl;   // ❌ CRASH — P1 đã nullptr
> ```
>
> **Khi `unique_ptr` ra khỏi scope → destructor tự gọi `delete` → KHÔNG CẦN nhớ free.**

### 4.2 `std::shared_ptr` — Shared Ownership

> [!NOTE]
> **Cơ chế Reference Counting:**
> Mỗi `shared_ptr` có 2 phần: pointer tới object + pointer tới **control block** (chứa strong count + weak count). Khi copy `shared_ptr` → strong count tăng. Khi `shared_ptr` bị hủy → strong count giảm. **Object bị delete khi strong count = 0.**
>
> ```cpp
> shared_ptr<Rectangle> P1(new Rectangle(10, 5));
> cout << P1->area() << endl;       // 50
>
> shared_ptr<Rectangle> P2;
> P2 = P1;                           // P2 share ownership với P1
> cout << P2->area() << endl;        // 50 — cả hai trỏ cùng object
> cout << P1->area() << endl;        // 50 — P1 vẫn valid
> cout << P1.use_count() << endl;    // 2 — strong count = 2
>
> // Khi P1, P2 đều ra khỏi scope → strong count = 0 → object bị delete
> ```
>
> **Overhead & Thread-Safety Boundary:**
> - **Control Block Size:** Phụ thuộc thư viện chuẩn (~16–32 bytes). Với libstdc++, `_Sp_counted_base` gồm vptr (8B) + 2 biến `_Atomic_word` (8B) = 16B. Nếu có Custom Deleter/Allocator kích thước sẽ tăng lên 32B+. Dùng `std::make_shared` để cấp phát gộp Object + Control Block trong 1 vùng nhớ liên tục $\rightarrow$ Giảm từ 2 lần xuống 1 lần `malloc`.
> - ⚠️ **Ranh giới Thread-Safety:** Chỉ các thao tác đếm tham chiếu trên **Control Block** (Ref Count) là Atomic. Bản thân **Instance `shared_ptr`** và **Object được trỏ tới** hoàn toàn **KHÔNG THREAD-SAFE**. Việc đọc/ghi đồng thời trên cùng một biến `shared_ptr` (`sp = other;`) từ nhiều luồng mà không có Mutex/`std::atomic<std::shared_ptr>` là **Data Race dẫn đến Crash**.

> [!WARNING]
> **Circular Reference — Memory Leak ẩn:**
> Khi 2 object giữ `shared_ptr` tới nhau → reference count KHÔNG BAO GIỜ về 0 → **memory leak dù dùng smart pointer!**
>
> ```cpp
> class ClassA {
> public:
>     shared_ptr<ClassB> m_data;
>     ~ClassA() { cout << "A destructor" << endl; } // KHÔNG BAO GIỜ được gọi!
> };
> class ClassB {
> public:
>     shared_ptr<ClassA> m_data;
>     ~ClassB() { cout << "B destructor" << endl; } // KHÔNG BAO GIỜ được gọi!
> };
>
> int main() {
>     shared_ptr<ClassA> sharedA(new ClassA());
>     shared_ptr<ClassB> sharedB(new ClassB());
>     sharedA->m_data = sharedB;  // A→B: ref count B = 2
>     sharedB->m_data = sharedA;  // B→A: ref count A = 2
>     // main() kết thúc: sharedA, sharedB hủy → count giảm về 1 → KHÔNG delete
>     // → Cả A và B đều LEAK!
> }
> ```
>
> **Giải pháp:** Dùng `weak_ptr` cho 1 chiều của vòng tròn (xem section 4.3).

### 4.3 `std::weak_ptr` — Non-owning Observer

> [!NOTE]
> **`weak_ptr` giải quyết Circular Reference:**
> `weak_ptr` **không tăng reference count** — chỉ "quan sát". Dùng `lock()` để tạo `shared_ptr` tạm khi cần truy cập object (trả `nullptr` nếu object đã bị delete).
>
> ```cpp
> // Sửa circular reference: ClassB dùng weak_ptr thay shared_ptr
> class ClassB {
> public:
>     weak_ptr<ClassA> m_data;  // ← THAY ĐỔI: weak thay vì shared
> };
>
> // Truy cập object qua weak_ptr:
> shared_ptr<Rectangle> sp(make_shared<Rectangle>(10, 5));
> weak_ptr<Rectangle> wp = sp;
> 
### 4.4 Case Study: Cuộc Tiến Hóa Từ Con Trỏ Thô Sang Smart Pointer — Triệt Tiêu Double Free Và Phá Vỡ Circular Reference

> [!CAUTION]
> **Bối cảnh:** Module bám đuôi vật thể ADAS (`SensorFusionTracker`) quản lý các thực thể xe cộ xung quanh xe tự hành. Mỗi chùm đối tượng (`TrackCluster`) chứa danh sách các cảm biến thành phần (`SensorTrack`), và mỗi cảm biến thành phần cần trỏ ngược lại cụm cha để truy xuất vận tốc trung bình. Đồng thời, bộ đệm dữ liệu đo lường 256KB được chia sẻ giữa luồng lọc nhiễu (`KalmanFilter`) và luồng truyền thông (`CanPublisher`).
>
> **Hạn chế của phương án cũ (Thế hệ 1: Con trỏ thô & Thế hệ 2: Lạm dụng shared_ptr):**
> 1. **Thế hệ 1 — Con trỏ thô (Raw Pointer):** Cả 2 luồng cùng giữ raw pointer tới buffer 256KB. Khi luồng Kalman giải phóng trước, luồng CAN tiếp tục giải phóng $\rightarrow$ **Double Free Crash** (`SIGABRT` làm sập tiến trình).
> 2. **Thế hệ 2 — Tham chiếu vòng (Circular Reference):** Kỹ sư thay thế toàn bộ bằng `std::shared_ptr`. Lớp cha `TrackCluster` giữ `std::shared_ptr<SensorTrack>`, và lớp con `SensorTrack` cũng giữ `std::shared_ptr<TrackCluster>`.
> 3. **Hậu quả rò rỉ âm thầm:** Khi radar mất dấu vật cản, pipeline xóa `TrackCluster` khỏi danh sách. Tuy nhiên, do `SensorTrack` vẫn trỏ ngược về cha với strong count $\ge 1$, bộ đếm tham chiếu không bao giờ chạm 0 $\rightarrow$ Toàn bộ chùm đối tượng bị **rò rỉ vĩnh viễn trong RAM** (Memory Leak dù dùng Smart Pointer 100%)!

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ THAM CHIẾU VÒNG (CIRCULAR REFERENCE) VS GIẢI PHÁP WEAK_PTR           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. LẠM DỤNG SHARED_PTR CẢ 2 CHIỀU (STRONG COUNT KHÔNG BAO GIỜ VỀ 0):        │
│    ┌──────────────────────────┐             ┌──────────────────────────┐    │
│    │ TrackCluster             │──shared_ptr▶│ SensorTrack              │    │
│    │ Strong Count: 1 (+1 từ B)│◀─shared_ptr─│ Strong Count: 1 (+1 từ A)│    │
│    └──────────────────────────┘             └──────────────────────────┘    │
│    ──▶ Xóa con trỏ ngoài: Strong Count cả 2 giảm về 1 (KHÔNG VỀ 0) ──▶ LEAK!│
│                                                                             │
│ 2. PHÁ VỠ VÒNG LẶP BẰNG WEAK_PTR (NON-OWNING OBSERVER):                     │
│    ┌──────────────────────────┐             ┌──────────────────────────┐    │
│    │ TrackCluster (Owner)     │──shared_ptr▶│ SensorTrack (Child)      │    │
│    │ Strong: 1, Weak: 1       │<──weak_ptr──│ Strong: 1, Weak: 0       │    │
│    └──────────────────────────┘             └──────────────────────────┘    │
│    ──▶ Xóa con trỏ ngoài: Strong Count của Cluster về 0 ──▶ Destructor chạy │
│    ──▶ SensorTrack bị hủy theo ──▶ Toàn bộ vùng nhớ giải phóng 100%!        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Con trỏ thô gây Double Free + shared_ptr gây rò rỉ vòng)

```cpp
// ❌ PHƯƠNG ÁN CŨ 1: Raw Pointer gây Double Free
void processAudioDoubleFree()
{
    int16_t* rawPcm = new int16_t[128000]; // 256KB PCM
    // Module A và Module B cùng giữ rawPcm
    delete[] rawPcm; // Module A dọn
    delete[] rawPcm; // ❌ CRASH: Module B gọi delete lần 2 -> Double Free!
}

// ❌ PHƯƠNG ÁN CŨ 2: Circular Reference gây rò rỉ dù dùng shared_ptr
class SensorTrack;

class TrackCluster
{
public:
    std::shared_ptr<SensorTrack> m_track;
    ~TrackCluster() { /* Không bao giờ chạy được! */ }
};

class SensorTrack
{
public:
    std::shared_ptr<TrackCluster> m_parentCluster; // ❌ LỖI: Strong pointer trỏ ngược cha
    ~SensorTrack() { /* Không bao giờ chạy được! */ }
};

void createTrackCycle()
{
    auto cluster = std::make_shared<TrackCluster>();
    auto track = std::make_shared<SensorTrack>();

    cluster->m_track = track;          // cluster giữ track (Ref count track = 2)
    track->m_parentCluster = cluster;  // track giữ cluster (Ref count cluster = 2)
} // Ra khỏi hàm: Ref count cả hai giảm về 1 -> KHÔNG AI BỊ HỦY -> LEAK BỘ NHỚ!
```

#### Code SAU (Sở hữu chia sẻ bằng shared_ptr + Quan sát bằng weak_ptr chuẩn Allman)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Phá vỡ chu trình bằng std::weak_ptr
class SensorTrack;

class TrackCluster : public std::enable_shared_from_this<TrackCluster>
{
public:
    std::shared_ptr<SensorTrack> m_track;

    ~TrackCluster()
    {
        // Tự động hủy sạch sẽ khi cluster ra khỏi radar scope
    }
};

class SensorTrack
{
private:
    // ✅ GIẢI PHÁP: Dùng weak_ptr trỏ ngược lại cha mà không tăng strong count
    std::weak_ptr<TrackCluster> m_parentCluster;

public:
    void setParent(std::shared_ptr<TrackCluster> parent)
    {
        m_parentCluster = parent; // Gán weak_ptr an toàn
    }

    void process()
    {
        // Khi cần dùng đối tượng cha, thăng cấp weak_ptr -> shared_ptr tạm thời
        if (std::shared_ptr<TrackCluster> parent = m_parentCluster.lock())
        {
            // Truy cập an toàn vào cluster...
        }
        else
        {
            // Đối tượng cha đã bị hủy an toàn, xử lý graceful
        }
    }

    ~SensorTrack()
    {
        // Tự động dọn dẹp sạch sẽ, 0% memory leak!
    }
};

void createSafeTrackRelationship()
{
    auto cluster = std::make_shared<TrackCluster>();
    auto track = std::make_shared<SensorTrack>();

    cluster->m_track = track;       // Cluster sở hữu Track (Strong count track = 2)
    track->setParent(cluster);      // Track chỉ quan sát Cluster (Strong count cluster = 1)
} // Ra khỏi hàm: Cluster strong count = 0 -> cluster hủy -> track strong count = 0 -> hủy sạch!
```

> [!TIP]
> **Bài học rút ra:**
> - Ranh giới thiết kế cốt lõi: **Quan hệ Cha $\rightarrow$ Con dùng `std::shared_ptr` (hoặc `std::unique_ptr`); Quan hệ Con $\rightarrow$ Cha BẮT BUỘC dùng `std::weak_ptr`**.
> - Không bao giờ dùng `shared_ptr` cho các cấu trúc đồ thị (Graph) hoặc cây có liên kết ngược (Back-pointers) nếu không có cơ chế phá vỡ chu trình chủ động.

---

## 5. Memory Alignment & Padding

> [!NOTE]
> **Struct Padding Rules:**
> Mỗi member được align theo bội số của `sizeof(member)`. Struct tổng thể được pad đến bội số của member lớn nhất.
>
> ```cpp
>// Thứ tự XẤU — sizeof = 24 bytes (14 bytes data thực + 10 bytes padding lãng phí):
>struct Bad {
 >   char   a;   // 1 byte  + 3 bytes padding (để int b align ở offset 4)
 >   int    b;   // 4 bytes
 >   char   c;   // 1 byte  + 7 bytes padding (để double d align ở offset 16)
 >   double d;   // 8 bytes (align 8)
>};  // sizeof = 24 bytes (Tổng data = 1+4+1+8 = 14B, lãng phí 10B padding!)
>
>// Thứ tự TỐT — sắp xếp trường từ lớn đến nhỏ:
>struct Good {
 >   double d;   // 8 bytes (offset 0)
 >   int    b;   // 4 bytes (offset 8)
 >   char   a;   // 1 byte  (offset 12)
 >   char   c;   // 1 byte  (offset 13) + 2 bytes padding cuối để sizeof chia hết cho 8
>};  // sizeof = 16 bytes! (Tiết kiệm 8 bytes = 33.3% RAM)
>
>static_assert(sizeof(Good) == 16, "Struct Good size mismatch!");
>static_assert(sizeof(Bad) == 24, "Struct Bad size mismatch!");
>```

> [!TIP]
> **Cache-Friendly Data Layout (AoS vs SoA):**
>
> ```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MÔ HÌNH BỐ CỤC BỘ NHỚ: OOP (AoS) vs DATA-ORIENTED DESIGN (SoA)             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Array of Structs (AoS) — Bộ nhớ xen kẽ (Truyền thống):                     │
│  ┌─────────────── Struct SensorData 0 (200 Bytes) ────────────────┐  ...    │
│  │ ID(4B) │ Name(64B) │ Calibration(128B) │ Timestamp(4B)         │         │
│  └────────┴───────────┴───────────────────┴───────────────────────┘         │
│  ▲                                                                          │
│  └── 1 L1 Cache Line (64 Bytes) chỉ nạp được 1/3 struct!                    │
│      Quét 10,000 ID để lọc ──▶ 92% Cache Miss! CPU liên tục nghẽn RAM!      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Struct of Arrays (SoA) — Bộ nhớ gom cụm (Tối ưu Cache & SIMD):             │
│  IDs:    ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐ (64B)   │
│          │ ID 0 │ ID 1 │ ID 2 │ ID 3 │ ID 4 │ ID 5 │ ...  │ ID15 │          │
│          └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘          │
│          ▲                                                                  │
│          └── 1 L1 Cache Line (64B) nạp được CÙNG LÚC 16 IDs ──▶ 100% Hit!   │
│  Names:  [ Name 0 ][ Name 1 ][ Name 2 ]... (Chỉ nạp khi cần in Report)      │
│  Calibs: [ Calib 0 ][ Calib 1 ]...         (Chỉ nạp khi cân chỉnh Sensor)   │
└─────────────────────────────────────────────────────────────────────────────┘
```
>
> **Quy tắc:** Nếu quét 1 trường trên nhiều đối tượng (ví dụ: lọc sensor theo ID) → dùng SoA. Nếu truy cập nhiều trường trên 1 đối tượng → dùng AoS.


### 5.2 Case Study: Tối Ưu Căn Chỉnh Bộ Nhớ Cho Cấu Trúc Dữ Liệu Cảm Biến CAN — Giảm 33% Tiêu Thụ RAM và Tránh Lỗi Unaligned Access Trên Vi Xử Lý ARM

> [!CAUTION]
> **Bối cảnh:** Mạng truyền thông ô tô CAN FD gửi liên tục các bản tin trạng thái cảm biến (`CanSensorFrame`) lưu trữ trong bộ đệm vòng (Ring Buffer) 100,000 bản ghi trên vi điều khiển ARM Cortex-R5.
>
> **Hạn chế của phương án cũ (Thứ tự khai báo biến lộn xộn):**
> Lập trình viên định nghĩa cấu trúc dữ liệu theo cảm tính mà không để ý căn chỉnh bộ nhớ (Memory Alignment):
> ```cpp
> struct BadCanSensorFrame
> {
>     uint8_t  canBusId;      // 1 byte  + 7 bytes padding! (để double align tại offset 8)
>     double   sensorValue;   // 8 bytes (offset 8)
>     uint16_t messageId;     // 2 bytes + 2 bytes padding (để uint32_t align tại offset 20)
>     uint32_t timestamp;     // 4 bytes (offset 20)
> }; // sizeof = 24 bytes! (Dữ liệu thực chỉ có 1 + 8 + 2 + 4 = 15 bytes, lãng phí 9 bytes padding!)
> ```
> 1. **Lãng phí RAM trầm trọng:** Mảng 100,000 phần tử ngốn $2.4\text{ MB}$ trong khi dữ liệu thực tế chỉ cần $1.5\text{ MB}$ $\rightarrow$ Lãng phí gần 1MB SRAM quý giá của vi điều khiển.
> 2. **Cạm bẫy ép kiểu phần cứng thô (Unaligned Memory Access Fault):** Khi lập trình viên cố tình dùng `#pragma pack(1)` để triệt tiêu padding nhằm tiết kiệm RAM, các trường `double` và `uint32_t` bị đặt tại các địa chỉ lẻ không chia hết cho 4 hoặc 8. Trên một số kiến trúc ARM Cortex không hỗ trợ unaligned access phần cứng, lệnh đọc `sensorValue` lập tức kích hoạt ngoại lệ phần cứng **Alignment Fault Exception** làm reset ECU!

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH CĂN CHỈNH BỘ NHỚ: CẤU TRÚC XẤU (24 BYTES) VS CẤU TRÚC TỐI ƯU (16B)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. BAD CAN FRAME (24 BYTES - LÃNG PHÍ 9 BYTES PADDING DO KHÔNG SẮP XẾP):    │
│    ┌─────────┬──────────────────────┬────────────┬──────────┬─────────────┐ │
│    │ID: 1B   │ PADDING LÃNG PHÍ: 7B │ VALUE: 8B  │ MSGID: 2B│ PAD: 2B │TS │ │
│    └─────────┴──────────────────────┴────────────┴──────────┴─────────────┘ │
│    0         1                      8            16         18    20    24  │
│                                                                             │
│ 2. OPTIMIZED CAN FRAME (16 BYTES - TIẾT KIỆM 33% RAM, AN TOÀN TUYỆT ĐỐI):   │
│    ┌────────────────────────┬─────────────┬──────────┬─────────┬──────────┐ │
│    │ SENSOR VALUE: 8 BYTES  │TIMESTAMP: 4B│ MSGID: 2B│ ID: 1B  │ PAD: 1B  │ │
│    └────────────────────────┴─────────────┴──────────┴─────────┴──────────┘ │
│    0                        8             12         14        15         16│
│    ──▶ 100,000 bản ghi: Tiết kiệm ngay lập tức 800 KB RAM trên vi điều khiển│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Thứ tự khai báo tùy tiện gây lãng phí bộ nhớ)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Lãng phí 37.5% bộ nhớ cho padding
struct BadCanSensorFrame
{
    uint8_t canBusId;      // 1B + 7B padding ngầm
    double sensorValue;    // 8B
    uint16_t messageId;    // 2B + 2B padding ngầm
    uint32_t timestamp;    // 4B
}; // sizeof = 24 bytes

static_assert(sizeof(BadCanSensorFrame) == 24, "Compiler inserted 9 bytes padding!");
```

#### Code SAU (Sắp xếp trường giảm dần kích thước chuẩn Allman Style)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Sắp xếp theo quy tắc giảm dần kích thước (8B -> 4B -> 2B -> 1B)
struct alignas(8) OptimizedCanSensorFrame
{
    double sensorValue;    // 8 bytes (Offset 0)
    uint32_t timestamp;    // 4 bytes (Offset 8)
    uint16_t messageId;    // 2 bytes (Offset 12)
    uint8_t canBusId;      // 1 byte  (Offset 14)
    uint8_t reservedPadding; // 1 byte padding chủ động (Offset 15) -> Tổng = 16B
};

static_assert(sizeof(OptimizedCanSensorFrame) == 16, "Kích thước struct phải đúng 16 bytes!");
```

> [!TIP]
> **Bài học rút ra:**
> - Luôn tuân thủ nguyên tắc vàng khi thiết kế struct trong C/C++ nhúng: **Khai báo các trường dữ liệu theo thứ tự kích thước giảm dần** (`double/uint64_t` $\rightarrow$ `float/uint32_t` $\rightarrow$ `uint16_t` $\rightarrow$ `uint8_t/bool`).
> - Tuyệt đối không lạm dụng `#pragma pack(1)` trên các hệ thống vi điều khiển nhúng nếu không phải giao thức truyền thông mạng bắt buộc, vì unaligned memory access làm giảm hiệu năng CPU hoặc gây crash phần cứng.

---

## 6. Memory-Mapped I/O & Shared Memory

> [!NOTE]
> **`mmap()` cho IPC — Shared Memory giữa 2 process:**
>
> ```
> ┌─── Process A (Producer) ───┐     ┌─── Kernel Space ───┐     ┌─── Process B (Consumer) ───┐
> │  ptr_a = mmap(shm_fd...)  │───▶│  Shared Memory   │◀───│  ptr_b = mmap(shm_fd...)  │
> │  *ptr_a = sensor_data;    │     │  (Physical RAM)  │     │  read(*ptr_b);            │
> └──────────────────────────┘     └──────────────────┘     └───────────────────────────┘
> ```

### 6.1 Cơ Chế Hoạt Động & Cú Pháp Chuẩn

```cpp
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>

// 1. Tạo shared memory object trong RAM (/dev/shm):
int fd = shm_open("/cam_buffer", O_CREAT | O_RDWR, 0666);
ftruncate(fd, BUFFER_SIZE);

// 2. Map vào không gian địa chỉ ảo của tiến trình:
void* ptr = mmap(nullptr, BUFFER_SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);

// 3. Sử dụng như mảng thông thường — Zero-Copy IPC!
std::memcpy(ptr, frame_data, FRAME_SIZE);

// 4. Cleanup giải phóng mapping:
munmap(ptr, BUFFER_SIZE);
close(fd);
shm_unlink("/cam_buffer");
```

### 6.2 Case Study: Zero-Copy Truyền Khung Hình Camera ADAS Giữa 2 Tiến Trình Bằng POSIX Shared Memory

> [!CAUTION]
> **Bối cảnh:** Hệ thống xe tự hành gồm 2 tiến trình độc lập: Tiến trình thu nhận video phần cứng (`CameraCaptureDaemon`) đọc frame 4K RGB (dung lượng 4MB/frame ở 30 FPS, tương đương 120 MB/giây) và Tiến trình suy luận AI (`AiPerceptionNode`) nhận diện người đi bộ.
>
> **Hạn chế của phương án cũ (Truyền thông liên tiến trình qua Unix Domain Socket):**
> Kỹ sư sử dụng cơ chế IPC truyền thống qua Socket (`socketpair` hoặc Unix Domain Socket):
> 1. Khi gửi một khung hình 4MB, dữ liệu bị copy **2 lần lãng phí**:
>    - Lần 1: Từ User Space của tiến trình phát copy vào Socket Buffer trong Kernel Space.
>    - Lần 2: Từ Socket Buffer của Kernel copy sang User Space của tiến trình nhận.
> 2. Tổng băng thông bộ nhớ tiêu tốn để copy dữ liệu: $120\text{ MB/s} \times 2 = 240\text{ MB/giây}$.
> 3. Tỉ lệ chiếm dụng CPU (CPU Load) tăng vọt lên **42%** chỉ dành riêng cho thao tác `memcpy` của kernel, gây hiện tượng tụt khung hình (frame drop) từ 30 FPS xuống còn 18 FPS $\rightarrow$ Vi phạm tiêu chuẩn an toàn thời gian thực.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH HIỆU NĂNG TRUYỀN DỮ LIỆU FRAME: SOCKET IPC VS POSIX SHARED MEMORY    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SOCKET IPC (2 LẦN MEMCPY QUA KERNEL - NGHẼN BUS & CPU 42%):              │
│    [Producer User Space] ──memcpy──▶ [Kernel Socket Buffer] ──memcpy──▶ [Consumer] │
│    ──▶ Tiêu tốn 240 MB/s băng thông RAM, trễ 18ms mỗi frame, tụt FPS!       │
│                                                                             │
│ 2. POSIX SHARED MEMORY ZERO-COPY (CÙNG ÁNH XẠ VÀO RAM VẬT LÝ):              │
│    [Producer: /dev/shm/cam0] ──┐                                            │
│                                ├──▶ [VÙNG NHỚ VẬT LÝ SHARED TRÊN DRAM]       │
│    [Consumer: /dev/shm/cam0] ──┘         ▲                                  │
│                                          │ DMA Camera nạp thẳng vào đây!    │
│    ──▶ 0 lần memcpy giữa 2 tiến trình! Độ trễ < 0.1ms, CPU load chỉ 1.8%!   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Gửi frame qua Socket làm nghẽn CPU và DRAM)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Socket IPC copy 2 lần qua Kernel
void sendFrameSocket(int socketFd, const uint8_t* frameBuffer, size_t frameSize)
{
    // Copy Lần 1: User buffer -> Kernel socket buffer (Tốn CPU và làm xả Cache)
    ssize_t sent = write(socketFd, frameBuffer, frameSize);
    if (sent < 0)
    {
        // Xử lý lỗi...
    }
}
```

#### Code SAU (POSIX Shared Memory + Named Semaphore đồng bộ Zero-Copy)

```cpp
// ✅ PHƯƠNG ÁN MỚI: POSIX Shared Memory Zero-Copy chuẩn Allman Style
#include <fcntl.h>
#include <sys/mman.h>
#include <semaphore.h>
#include <unistd.h>

struct SharedFrameBuffer
{
    uint64_t frameIndex;
    uint64_t timestampNs;
    uint8_t pixelData[4 * 1024 * 1024]; // 4MB Buffer
};

class SharedMemoryProducer
{
private:
    int m_shmFd{-1};
    SharedFrameBuffer* m_sharedBuffer{nullptr};
    sem_t* m_semReady{nullptr};

public:
    SharedMemoryProducer(const char* shmName, const char* semName)
    {
        // 1. Tạo Shared Memory object trong RAM
        m_shmFd = shm_open(shmName, O_CREAT | O_RDWR, 0660);
        ftruncate(m_shmFd, sizeof(SharedFrameBuffer));

        // 2. Map vào địa chỉ tiến trình Producer
        m_sharedBuffer = static_cast<SharedFrameBuffer*>(
            mmap(nullptr, sizeof(SharedFrameBuffer), PROT_READ | PROT_WRITE, MAP_SHARED, m_shmFd, 0)
        );

        // 3. Semaphore đồng bộ tiến trình
        m_semReady = sem_open(semName, O_CREAT, 0660, 0);
    }

    void publishFrameDirect(uint64_t index, const uint8_t* hardwareDmaBuffer)
    {
        m_sharedBuffer->frameIndex = index;
        // Ghi trực tiếp vào Shared RAM (Consumer lập tức nhìn thấy dữ liệu không cần socket)
        std::memcpy(m_sharedBuffer->pixelData, hardwareDmaBuffer, sizeof(m_sharedBuffer->pixelData));

        // Bắn tín hiệu đánh thức Consumer
        sem_post(m_semReady);
    }

    ~SharedMemoryProducer()
    {
        munmap(m_sharedBuffer, sizeof(SharedFrameBuffer));
        close(m_shmFd);
        sem_close(m_semReady);
    }
};