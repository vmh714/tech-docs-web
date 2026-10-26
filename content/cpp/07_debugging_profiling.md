# Debugging & Profiling — GDB, Valgrind, Sanitizers

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp workflow debug và profiling chuẩn công nghiệp cho C/C++ Linux & Embedded Systems. Bao gồm: GDB (interactive debugger & remote cross-debug), Valgrind (memcheck & helgrind), AddressSanitizer (compile-time shadow memory instrumentation), Core Dump postmortem, và các công cụ profiling hiệu năng phần cứng (`perf`, flame graphs).

---

## 1. GDB — GNU Debugger Workflow

**Chuẩn bị:** Biên dịch với cờ `-g` (debug symbols) hoặc `-g3` (bao gồm thông tin preprocessor macro):
```bash
g++ -std=c++17 -g3 -O0 -Wall main.cpp -o app
gdb ./app
# Hoặc truyền arguments:
gdb --args ./app --config test.json
```

### 1.1 Các Lệnh GDB Cơ Bản

> [!NOTE]
> **Nhóm lệnh điều hướng (Navigation):**
>
> | Lệnh | Viết tắt | Hành vi |
> |:--|:--|:--|
> | `run [args]` | `r` | Chạy chương trình từ đầu |
> | `break func` | `b func` | Đặt breakpoint tại hàm `func` |
> | `break file:42` | `b file:42` | Đặt breakpoint tại dòng 42 của file |
> | `next` | `n` | Chạy dòng tiếp theo (bước qua hàm — step over) |
> | `step` | `s` | Bước vào bên trong hàm (step into) |
> | `finish` | `fin` | Chạy đến hết hàm hiện tại rồi dừng (step out) |
> | `continue` | `c` | Tiếp tục chạy đến breakpoint tiếp theo |
> | `until 50` | `u 50` | Chạy đến dòng 50 rồi dừng |

> [!NOTE]
> **Nhóm lệnh kiểm tra (Inspection):**
>
> | Lệnh | Hành vi |
> |:--|:--|
> | `print var` / `p var` | In giá trị biến `var` |
> | `print *ptr` | Dereference con trỏ |
> | `print arr[0]@10` | In 10 phần tử đầu của mảng `arr` |
> | `display var` | Tự động in `var` mỗi lần dừng |
> | `info locals` | Liệt kê tất cả biến cục bộ |
> | `info args` | Liệt kê tham số hàm hiện tại |
> | `ptype var` | In kiểu dữ liệu đầy đủ của `var` |
> | `whatis expr` | In kiểu của biểu thức |
> | `x/16xb &var` | Xem 16 bytes dạng hex tại địa chỉ `var` |

> [!NOTE]
> **Nhóm lệnh stack (Stack Inspection):**
>
> | Lệnh | Hành vi |
> |:--|:--|
> | `backtrace` / `bt` | In toàn bộ call stack (stack trace) |
> | `bt full` | Stack trace + giá trị biến cục bộ mỗi frame |
> | `frame N` / `f N` | Chuyển đến stack frame thứ N |
> | `up` / `down` | Di chuyển lên/xuống 1 frame |
> | `info frame` | Chi tiết frame hiện tại (saved RBP, return address) |
> | `info registers` | Giá trị tất cả thanh ghi CPU |
> | `thread apply all bt` | Stack trace của TẤT CẢ threads (phát hiện deadlock) |

### 1.2 Breakpoints & Watchpoints Nâng Cao

> [!TIP]
> **Conditional Breakpoint:**
> ```
> (gdb) break process_sensor if sensor_id > 100
> (gdb) break main.cpp:42 if ptr == nullptr
> (gdb) break MyClass::update if frame_count % 60 == 0
> ```
> Breakpoint chỉ kích hoạt khi điều kiện đúng — cực hữu ích khi debug vòng lặp lớn trong Computer Vision hoặc vòng lặp Sensor 100Hz.

> [!TIP]
> **Watchpoint — Dừng khi biến thay đổi giá trị:**
> ```
> (gdb) watch counter          # Dừng khi counter bị GHI (hardware watchpoint)
> (gdb) rwatch *buffer_ptr     # Dừng khi vùng nhớ bị ĐỌC
> (gdb) awatch shared_flag     # Dừng khi bị ĐỌC hoặc GHI
> ```
> Watchpoint dùng **hardware debug registers** của vi xử lý (x86 hỗ trợ tối đa 4 watchpoints phần cứng, ARM Cortex-A hỗ trợ DWT/Watchpoints) — không làm chậm tốc độ thực thi của chương trình.

### 1.3 GDB Remote Debugging Architecture (Cross-debug ARM target)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ KIẾN TRÚC GDB REMOTE DEBUG: HOST X86_64 VS TARGET ARM BOARD                 │
├─────────────────────────────────────────────────────────────────────────────┤
│   [ Host Development PC: x86_64 ]            [ Target Board: ARM64 ]        │
│   ┌─────────────────────────────┐            ┌───────────────────────────┐  │
│   │ gdb-multiarch (ELF Symbols) │            │ gdbserver (:1234)         │  │
│   │ Source Code: main.cpp       │            │ Stripped App (ptrace API) │  │
│   │ DWARF-5 Debug Section       │            │ Physical Peripheral (I2C) │  │
│   └──────────────┬──────────────┘            └─────────────▲─────────────┘  │
│                  │                                         │                │
│                  └─────── TCP/IP Socket (Port 1234) ───────┘                │
│                           GDB Remote Serial Protocol                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

```bash
# Trên Target (Raspberry Pi 4 / NVIDIA Jetson / NXP i.MX8):
gdbserver :1234 ./sensor_app

# Trên Host (Dev PC x86_64):
gdb-multiarch ./sensor_app       # Binary CÓ chứa debug symbols (-g)
(gdb) target remote 192.168.1.100:1234
(gdb) break main
(gdb) continue
```

### 1.4 Case Study: GDB Remote Debug Bắt Lỗi Segfault Khác Biệt Kiến Trúc Trên ARM

> [!CAUTION]
> **Bối cảnh:** Debug ứng dụng thu thập dữ liệu cảm biến quán tính IMU qua giao tiếp bus I2C trên Raspberry Pi 4 (ARM Cortex-A72 64-bit). Ứng dụng được cross-compile từ máy trạm x86_64 Ubuntu bằng toolchain `aarch64-linux-gnu-g++`.
> **Triệu chứng:** Chương trình chạy thử nghiệm trên máy host x86 mô phỏng không phát sinh lỗi, nhưng khi nạp chạy thực tế trên bo mạch ARM thì gặp lỗi `Segmentation fault (core dumped)` ngay chu kỳ đọc cảm biến đầu tiên.

```cpp
// TRƯỚC (Lỗi): Khác biệt quản lý bộ nhớ giữa Host và Target che giấu con trỏ rỗng
struct ImuPacket
{
    uint64_t timestamp_ns;
    float accel[3];
    float gyro[3];
    uint8_t* dma_buffer; // Con trỏ vùng đệm trung gian
};

void readImuSensor(ImuPacket* packet)
{
    // LỖI NGHIÊM TRỌNG: Quên kiểm tra và cấp phát dma_buffer trước khi nạp dữ liệu từ I2C Bus.
    // Trên x86 Linux, cơ chế cấp phát tĩnh tình cờ gán vùng nhớ hợp lệ, nhưng trên ARM64,
    // thanh ghi chứa giá trị 0x0000000000000000 -> Ghi vào NULL gây Hardware Fault!
    i2c_read_raw(0x68, packet->dma_buffer, 32);
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHÂN TÍCH STACK FRAME VÀ CON TRỎ LỖI QUA GDB REMOTE RSP                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ (gdb) target remote 192.168.1.100:1234                                      │
│ (gdb) continue                                                              │
│ Program received signal SIGSEGV, Segmentation fault.                        │
│ 0x0000007fba123456 in i2c_read_raw (addr=104, buf=0x0, len=32)             │
│                                                     ▲                       │
│                                                     └── Con trỏ buf = NULL  │
│ (gdb) backtrace                                                             │
│ #0  0x0000007fba123456 in i2c_read_raw (addr=104, buf=0x0, len=32)          │
│ #1  0x0000005555555890 in readImuSensor (packet=0x7ffffff820) at imu.cpp:45 │
│ (gdb) print packet->dma_buffer                                              │
│ $1 = (uint8_t *) 0x0                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Khởi tạo tiền cấp phát an toàn + bảo vệ con trỏ chuẩn Allman
#include <cstdint>
#include <array>
#include <system_error>

struct ImuPacketFixed
{
    uint64_t timestamp_ns{0};
    float accel[3]{0.0f, 0.0f, 0.0f};
    float gyro[3]{0.0f, 0.0f, 0.0f};
    // Thay con trỏ thô bằng buffer kích thước tĩnh trên stack/struct
    // Loại bỏ hoàn toàn dynamic allocation và nguy cơ NULL pointer dereference
    std::array<uint8_t, 64> dma_buffer{};
};

bool readImuSensorSafe(ImuPacketFixed& packet)
{
    // Xác thực buffer luôn hợp lệ tại compile-time
    int ret = i2c_read_raw(0x68, packet.dma_buffer.data(), packet.dma_buffer.size());
    if (ret != 0)
    {
        return false;
    }
    return true;
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Máy host phát triển x86_64 và vi xử lý mục tiêu ARM thường có cấu trúc bộ nhớ ảo, cơ chế phân trang và thanh ghi khác nhau. Các lỗi con trỏ hoang hoặc tham chiếu NULL có thể không lộ diện trên Host do cấu trúc heap khác biệt.
> - Việc sử dụng `gdbserver` trên mục tiêu kết hợp với `gdb-multiarch` trên máy host cho phép tra cứu toàn bộ symbol DWARF mà không làm phình dung lượng bộ nhớ Flash của bo mạch nhúng (target chỉ chứa binary đã stripped).

---

## 2. Valgrind — Memory Error Detection

### 2.1 Memcheck — Phát Hiện Memory Bugs

```bash
# Chạy với Memcheck (công cụ phân tích mặc định):
valgrind --tool=memcheck --leak-check=full --show-leak-kinds=all --track-origins=yes ./app
```

> [!NOTE]
> **Các loại lỗi Memcheck phát hiện:**
>
> | Loại lỗi | Mô tả | Ví dụ |
> |:--|:--|:--|
> | **Invalid read/write** | Truy cập vùng nhớ đã free hoặc ngoài bounds | `arr[100]` khi `arr` chỉ có 10 phần tử |
> | **Use of uninitialized value** | Đọc biến chưa gán giá trị | `int x; if (x > 0)` |
> | **Memory leak** | `malloc`/`new` không `free`/`delete` | `int* p = new int[100];` rồi quên `delete[]` |
> | **Mismatched free** | `new[]` nhưng `delete` (thiếu `[]`) | `int* p = new int[10]; delete p;` |
> | **Double free** | Free 2 lần cùng 1 pointer | `free(p); free(p);` |
> | **Invalid free** | Free con trỏ không hợp lệ | `free(&stack_var);` |

> [!TIP]
> **Đọc hiểu Leak Summary:**
>
> ```
> ==12345== LEAK SUMMARY:
> ==12345==    definitely lost: 48 bytes in 1 blocks     ← 🔴 PHẢI SỬA — leak thật
> ==12345==    indirectly lost: 1,024 bytes in 4 blocks   ← 🟠 Sửa parent struct thì hết
> ==12345==      possibly lost: 96 bytes in 2 blocks      ← 🟡 Cần review — con trỏ trượt offset
> ==12345==    still reachable: 4,096 bytes in 1 blocks   ← 🟢 Static/Global chưa free khi exit
> ```

### 2.2 Helgrind — Thread Race Detection

```bash
valgrind --tool=helgrind ./multithreaded_app
```
Helgrind phát hiện: **data race** (2 thread truy cập chung biến không có mutex), **lock order violation** (tiềm ẩn deadlock), **pthread API misuse** (unlock mutex không phải owner). Output bao gồm call stack chi tiết của cả 2 luồng xung đột.

### 2.3 Case Study: Săn Tìm Rò Rỉ Bộ Nhớ Heap Trong IVI Playlist Manager

> [!CAUTION]
> **Bối cảnh:** Module quản lý danh sách nhạc (In-Vehicle Infotainment - IVI) trên hệ thống giải trí xe hơi. Ứng dụng đọc siêu dữ liệu hàng nghìn bài hát và cấp phát đối tượng `Song` động trên Heap.
> **Triệu chứng:** Chương trình chạy kiểm thử hoàn toàn không bị crash, giao diện hiển thị mượt mà. Tuy nhiên, sau 48 giờ chạy liên tục trên xe, hệ điều hành Linux kích hoạt OOM Killer (Out-Of-Memory) khai tử tiến trình IVI.

```cpp
// TRƯỚC (Lỗi): Quản lý con trỏ thô thủ công gây rò rỉ âm thầm
class PlaylistManager
{
private:
    Song** m_songs;
    int m_count;
    int m_capacity;

public:
    PlaylistManager(int cap) : m_count(0), m_capacity(cap)
    {
        m_songs = new Song*[m_capacity];
    }

    void addSong(const std::string& title, int duration)
    {
        if (m_count < m_capacity)
        {
            m_songs[m_count++] = new Song(title, duration); // Cấp phát con trỏ Song
        }
    }

    ~PlaylistManager()
    {
        // LỖI: Chỉ giải phóng mảng con trỏ, BỎ QUÊN từng đối tượng Song đã cấp phát!
        delete[] m_songs;
        // Kết quả: Mọi Song* bị mồ côi (definitely lost trên Heap)
    }
};
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ VALGRIND MEMCHECK BÁO CÁO LEAK CHÍNH XÁC ĐỊA CHỈ & DÒNG MÃ CẤP PHÁT         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ==12891== 25,600 bytes in 400 blocks are definitely lost in loss record 1   │
│ ==12891==    at 0x4C2FB0F: operator new(unsigned long)                      │
│ ==12891==    by 0x401234: PlaylistManager::addSong(...) (playlist.cpp:21)  │
│ ==12891==    by 0x401567: main (main.cpp:55)                                │
│ ==12891==                                                                   │
│ ==12891== LEAK SUMMARY:                                                     │
│ ==12891==    definitely lost: 25,600 bytes in 400 blocks                    │
│ ==12891==    indirectly lost: 0 bytes in 0 blocks                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Áp dụng Rule of Zero với std::vector và std::unique_ptr
#include <vector>
#include <memory>
#include <string>

class Song
{
public:
    std::string title;
    int duration_sec;
    Song(std::string t, int d) : title(std::move(t)), duration_sec(d) {}
};

class ModernPlaylistManager
{
private:
    // Tự động quản lý vòng đời tài nguyên, không cần viết Destructor thủ công
    std::vector<std::unique_ptr<Song>> m_songs;

public:
    explicit ModernPlaylistManager(size_t reserve_cap)
    {
        m_songs.reserve(reserve_cap);
    }

    void addSong(std::string title, int duration)
    {
        m_songs.push_back(std::make_unique<Song>(std::move(title), duration));
    }
    // Destructor mặc định sẽ tự dọn dẹp toàn bộ vector và giải phóng heap Song!
};
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Valgrind Memcheck biên dịch với `-g -O0` giúp ánh xạ từng byte rò rỉ về đúng dòng `operator new`.
> - Việc sử dụng smart pointer (`std::unique_ptr`) biến class thành "Rule of Zero", loại trừ triệt để 100% rủi ro quên `delete` trong các destructor phức tạp.

---

## 3. Sanitizers — Compile-Time Instrumentation

> [!IMPORTANT]
> Sanitizers chèn mã kiểm tra trực tiếp vào binary lúc compile — **nhanh hơn Valgrind 5-10x** và phát hiện lỗi ngay khi xảy ra (crash lập tức tại điểm lỗi thay vì tiếp tục chạy ngầm). Đây là tiêu chuẩn bắt buộc cho Continuous Integration (CI) và Automated Testing.

### 3.1 AddressSanitizer (ASan)

```bash
g++ -std=c++17 -g -fsanitize=address -fno-omit-frame-pointer main.cpp -o app
./app   # Crash ngay lập tức kèm bản đồ Shadow Memory chi tiết
```

### 3.2 UndefinedBehaviorSanitizer (UBSan)

```bash
g++ -std=c++17 -g -fsanitize=undefined main.cpp -o app
```
Phát hiện: **signed integer overflow**, **null pointer dereference**, **misaligned memory access**, **shift overflow**, **divide by zero**, **float cast overflow**. Có thể kết hợp: `-fsanitize=address,undefined`.

### 3.3 ThreadSanitizer (TSan)

```bash
g++ -std=c++17 -g -fsanitize=thread main.cpp -o app -lpthread
```
Phát hiện **data race** giữa các thread song song.
⚠️ **KHÔNG dùng chung với ASan** trong cùng 1 bản build vì cả hai cùng can thiệp vào bộ cấp phát bộ nhớ ảo (Shadow Memory).

### 3.4 Case Study: AddressSanitizer (ASan) Bắt Lỗi Use-After-Free Trong Computer Vision Frame Processing

> [!CAUTION]
> **Bối cảnh:** Luồng xử lý camera ADAS nhận khung hình RGB từ luồng Capture, chuyển qua hàm tiền xử lý (Preprocessing Callback) rồi giải phóng frame buffer để tái sử dụng.
> **Triệu chứng:** Pipeline đôi khi xuất hiện hiện tượng biến dạng màu sắc ngẫu nhiên hoặc crash sau vài nghìn frame. Valgrind khiến tốc độ pipeline rơi từ 30fps xuống 1.5fps, gây timeout các test case kiểm thử tự động trên hệ thống CI.

```cpp
// TRƯỚC (Lỗi): Callback lưu con trỏ trỏ vào vùng nhớ tạm thời đã bị free
struct FrameBuffer
{
    uint8_t* raw_data;
    size_t length;
};

void processAsync(const FrameBuffer& frame, void (*callback)(const uint8_t*))
{
    // Đăng ký callback xử lý không đồng bộ nhưng frame sau đó bị giải phóng ngay
    callback(frame.raw_data);
}

void badPipeline()
{
    FrameBuffer* buf = new FrameBuffer{new uint8_t[1920 * 1080], 1920 * 1080};
    const uint8_t* dangling_ref = buf->raw_data;

    delete[] buf->raw_data; // Đã giải phóng bộ đệm pixel
    delete buf;

    // LỖI: Use-After-Free! Truy cập bộ nhớ đã bị đánh dấu giải phóng
    uint8_t first_pixel = dangling_ref[0]; 
    (void)first_pixel;
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ ASAN SHADOW MEMORY: PHÁT HIỆN USE-AFTER-FREE LẬP TỨC                │
├─────────────────────────────────────────────────────────────────────────────┤
│ DRAM Virtual Address: [ 0x602000000010 ]  ──▶ Đã gọi free()                 │
│ Shadow Memory Byte:   [ 0xFD (Freed Heap Chunk) ]                           │
│                                                                             │
│ ==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000010     │
│ READ of size 1 at 0x602000000010 thread T0                                  │
│     #0 0x4012de in badPipeline() /src/vision.cpp:22                         │
│                                                                             │
│ 0x602000000010 is located 0 bytes inside of 2073600-byte region             │
│ freed by thread T0 here:                                                    │
│     #0 0x7f12... in operator delete[](void*)                                │
│     #1 0x4012aa in badPipeline() /src/vision.cpp:18                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Chuyển giao quyền sở hữu tường minh qua std::shared_ptr/unique_ptr
#include <memory>
#include <vector>

struct SafeFrame
{
    std::vector<uint8_t> pixels;
    uint64_t timestamp_ns{0};
};

void safeProcessPipeline(std::shared_ptr<SafeFrame> frame)
{
    if (!frame || frame->pixels.empty())
    {
        return;
    }

    // Tham chiếu được bảo vệ bằng reference count của shared_ptr
    // Không bao giờ bị giải phóng sớm trước khi mọi worker hoàn thành
    uint8_t first_pixel = frame->pixels[0];
    (void)first_pixel;
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - ASan sử dụng cấu trúc **Shadow Memory** ánh xạ 8 bytes bộ nhớ ứng dụng thành 1 byte shadow state. Khi một vùng heap bị `free()`, ASan đánh dấu byte tương ứng thành `0xFD` (Poisoned). Bất kỳ lệnh đọc/ghi nào chạm vào byte này sẽ kích hoạt CPU trap ngay trong chu kỳ $O(1)$.
> - Khác với Valgrind giả lập CPU (làm chậm 20-50x), ASan chỉ làm chậm khoảng 2x, cho phép chạy real-time trong CI/CD pipeline với toàn bộ tập dữ liệu kiểm thử camera ADAS.

---

## 4. Core Dump Analysis — Postmortem Debugging

```bash
# 1. Kích hoạt core dump không giới hạn dung lượng:
ulimit -c unlimited
echo "/tmp/core.%e.%p" | sudo tee /proc/sys/kernel/core_pattern

# 2. Chạy ứng dụng bị lỗi -> Kernel sinh file crash dump:
./app
# Output: Segmentation fault (core dumped)

# 3. Mở phân tích hồi quy trạng thái sập bằng GDB:
gdb ./app /tmp/core.app.12345
(gdb) bt full                # Kiểm tra stack trace kèm giá trị biến lúc crash
(gdb) frame 0                # Nhảy thẳng tới dòng lệnh gây ngoại lệ phần cứng
(gdb) print *this            # Kiểm tra toàn bộ member của đối tượng
(gdb) info registers         # Kiểm tra trạng thái thanh ghi vi xử lý
```

---

## 5. Profiling — `perf` & Flame Graphs

### 5.1 Sử Dụng `perf` Phân Tích Phần Cứng

```bash
# Thu thập thống kê tổng quan (IPC, Cache misses, Branch misses):
perf stat ./app

# Thu thập chi tiết cây gọi hàm (call graph):
perf record -g --call-graph dwarf -F 99 ./app

# Xem báo cáo tương tác trên terminal:
perf report
```

### 5.2 Sinh Biểu Đồ Lửa (Flame Graphs)

```bash
# Trích xuất dữ liệu perf và tạo file SVG:
perf script | stackcollapse-perf.pl | flamegraph.pl > profile.svg
```
- **Trục hoành (X-axis):** Tỷ lệ % thời gian thực thi CPU (hàm càng rộng = ngốn càng nhiều xung nhịp).
- **Trục tung (Y-axis):** Chiều sâu cây gọi hàm (Call Stack Depth).

### 5.3 Case Study: Tối Ưu Điểm Nghẽn CPU Với perf & Flame Graph Trong Bộ Lọc Ảnh ADAS

> [!CAUTION]
> **Bối cảnh:** Thuật toán chuẩn hóa ma trận điểm ảnh (Image Normalization Kernel) cho luồng camera ADAS phân giải 1920x1080 chạy ở tần số 30fps.
> **Triệu chứng:** Tốc độ khung hình bị sụt giảm nghiêm trọng xuống còn 6.2fps. CPU 1 lõi luôn bị ép tải 100%. Báo cáo `perf stat` chỉ ra tỷ lệ **Cache Miss lên tới 84.6%** trên tập lệnh đọc điểm ảnh.

```cpp
// TRƯỚC (Kém tối ưu): Duyệt ma trận theo cột làm vỡ hoàn toàn L1 Data Cache
void normalizeImageColumnMajor(uint8_t* img, int width, int height, float scale)
{
    // LỖI NGHẼN CACHE: Vòng lặp ngoài duyệt theo X (Width), vòng lặp trong duyệt theo Y (Height)
    // Mỗi bước lặp Y nhảy qua (width) bytes trong DRAM -> Trượt Cache Line (Cache Miss liên tục)!
    for (int x = 0; x < width; ++x)
    {
        for (int y = 0; y < height; ++y)
        {
            int idx = y * width + x;
            img[idx] = static_cast<uint8_t>(img[idx] * scale);
        }
    }
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ PERF REPORT & CACHE MISS PROFILE GIỮA 2 CHIẾN LƯỢC DUYỆT BỘ NHỚ             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Column-Major Loop (Truy cập rải rác - Strided Access):                   │
│    perf stat: 142,320,110 cache-misses (84.6% of all L1-dcache hits)        │
│    Execution Time: 161.4 ms per frame (Chỉ đạt 6.2 fps)                     │
│                                                                             │
│ 2. Row-Major Contiguous + SIMD Vectorization:                               │
│    perf stat: 1,890,200 cache-misses (1.2% of all L1-dcache hits)           │
│    Execution Time: 21.3 ms per frame (Đạt 46.9 fps -> Tăng tốc 7.5x)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Duyệt tuần tự theo hàng (Row-Major) tận dụng tối đa Cache Line
void normalizeImageRowMajorSafe(uint8_t* img, int width, int height, float scale)
{
    // Sắp xếp vòng lặp ngoài duyệt Y, vòng lặp trong duyệt X
    // CPU nạp 64-byte Cache Line liên tục -> Kích hoạt cơ chế Hardware Prefetcher
    for (int y = 0; y < height; ++y)
    {
        uint8_t* row_ptr = img + (y * width);
        for (int x = 0; x < width; ++x)
        {
            row_ptr[x] = static_cast<uint8_t>(row_ptr[x] * scale);
        }
    }
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - `perf stat` cho phép đo lường trực tiếp các thanh ghi phần cứng (Hardware Performance Counters) bao gồm `L1-dcache-load-misses` và `instructions per cycle (IPC)`.
> - Trong xử lý ảnh ma trận và mạng nơ-ron nhúng, việc tổ chức vòng lặp thuận theo chiều lưu trữ của bộ nhớ vật lý (Row-major cho mảng C/C++) là điều kiện tiên quyết để đạt chuẩn thời gian thực (Real-Time Determinism).

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [GDB Documentation](https://sourceware.org/gdb/current/onlinedocs/gdb/) | Interactive debugging, Breakpoints, Watchpoints, Remote gdbserver |
| [Valgrind User Manual](https://valgrind.org/docs/manual/manual.html) | Memcheck memory error detection, Leak summary, Helgrind thread analysis |
| [Clang AddressSanitizer Documentation](https://clang.llvm.org/docs/AddressSanitizer.html) | ASan compile-time instrumentation, Shadow memory, Fast memory checking |
| [Clang UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html) | UBSan undefined behavior detection (overflows, null deref, alignment) |
| [Clang ThreadSanitizer](https://clang.llvm.org/docs/ThreadSanitizer.html) | TSan data race detection, Thread synchronization bugs |
| [Linux perf wiki](https://perf.wiki.kernel.org/index.php/Main_Page) | Linux hardware/software performance counters, CPU profiling |
| [Brendan Gregg: Flame Graphs](https://www.brendangregg.com/flamegraphs.html) | Trực quan hóa CPU profile và call stack visualization |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Công Cụ & Lệnh |
| :--- | :--- |
| Debug tương tác (interactive) | `gdb ./app` → `break main` → `run` → `next`/`step`/`print` |
| Phát hiện memory leak | `valgrind --leak-check=full --show-leak-kinds=all ./app` |
| Phát hiện buffer overflow runtime | `g++ -fsanitize=address -fno-omit-frame-pointer -g app.cpp` |
| Phát hiện undefined behavior | `g++ -fsanitize=undefined -g app.cpp` |
| Phát hiện data race | `g++ -fsanitize=thread -g app.cpp` (hoặc `valgrind --tool=helgrind`) |
| Phân tích crash dump | `ulimit -c unlimited` → crash → `gdb ./app core` → `bt full` |
| CPU profiling & Cache counters | `perf stat ./app` / `perf record -g ./app` → `perf report` |
| Flame graph trực quan | `perf script \| stackcollapse-perf.pl \| flamegraph.pl > out.svg` |
| Debug trên target board | Target: `gdbserver :1234 ./app` / Host: `gdb-multiarch` → `target remote IP:1234` |
