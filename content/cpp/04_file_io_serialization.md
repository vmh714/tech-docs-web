# File I/O & Serialization — C-style, C++ Streams, Binary Format

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp kiến thức đọc/ghi tập tin và tuần tự hóa dữ liệu trong C/C++ cho hệ thống nhúng và xử lý dữ liệu lớn: C-style FILE I/O, C++ fstream, định dạng nhị phân, bộ nhớ ánh xạ (`mmap` Zero-Copy), cơ chế lưu file an toàn chống sập nguồn (Atomic Save), và tiêu chuẩn AUTOSAR Persistency cho ECU.

---

## 1. C-Style FILE I/O

> [!NOTE]
> **Chi tiết các API C-Style FILE I/O cơ bản:**
>
> 1. **`FILE *fopen(const char *filename, const char *mode);`**
>    - `mode`: `"r"` (đọc), `"w"` (ghi đè), `"a"` (ghi tiếp), `"rb"`, `"wb"` (chế độ nhị phân).
>    - Trả về `NULL` nếu mở thất bại (file không tồn tại hoặc thiếu quyền).
>
> 2. **`int fclose(FILE *stream);`**
>    - Đóng stream và flush bộ đệm tầng C runtime (`FILE*`). Trả về `0` nếu thành công, `EOF` nếu lỗi.
>
> 3. **`size_t fread(void *ptr, size_t size, size_t count, FILE *stream);`** / **`size_t fwrite(...)`**
>    - Đọc/Ghi dữ liệu nhị phân thô. Trả về số lượng phần tử (`count`) thực tế thao tác thành công.
>
> 4. **`int fseek(FILE *stream, long int offset, int whence);`**
>    - Định vị con trỏ file (`SEEK_SET`: đầu file, `SEEK_CUR`: vị trí hiện tại, `SEEK_END`: cuối file).
>
> 5. **`long int ftell(FILE *stream);`**
>    - Trả về vị trí byte hiện tại của con trỏ file.

> [!WARNING]
> **Hiểm họa Text Mode vs Binary Mode:**
> - Trong **Text Mode (`"r"`, `"w"`)**, hệ điều hành tự động can thiệp biến đổi ký tự xuống dòng (trên Windows: `\n` $\leftrightarrow$ `\r\n`). Khi đọc gặp byte `0x1A` (EOF), stream sẽ tự động ngắt.
> - Trong **Binary Mode (`"rb"`, `"wb"`)**, luồng dữ liệu được giữ nguyên vẹn từng bit.
> **LƯU Ý BẮT BUỘC:** Khi thao tác với ảnh, âm thanh, mạng nơ-ron hoặc struct nhị phân, BẮT BUỘC phải dùng `"rb"`/`"wb"`. Nếu mở nhầm `"w"`, byte dữ liệu `0x0A` trong file nhị phân sẽ bị hệ điều hành chèn thêm byte `0x0D` làm hỏng toàn bộ cấu trúc file!

---

## 2. C++ Streams (`iostream`, `fstream`)

```cpp
#include <fstream>
#include <iostream>
#include <string>

// Ghi file văn bản an toàn với RAII:
void writeLog(const std::string& path, const std::string& msg)
{
    std::ofstream ofs(path, std::ios::out | std::ios::app);
    if (!ofs.is_open())
    {
        std::cerr << "Không thể mở file ghi log: " << path << "\n";
        return;
    }
    ofs << msg << "\n";
    // ofs tự động đóng và flush khi ra khỏi phạm vi hàm (RAII)
}
```

---

## 3. Nhị Phân & Bộ Nhớ Ánh Xạ (Memory-Mapped I/O)

### 3.1 Serialization Cấu Trúc Nhị Phân
Việc ghi trực tiếp một struct ra đĩa bằng `fwrite(&myStruct, sizeof(myStruct), 1, fp)` tiềm ẩn rủi ro lớn về tính tương thích:
- **Struct Padding & Alignment:** Compiler trên các kiến trúc khác nhau chèn số byte đệm khác nhau.
- **Endianness (Đầu to/Đầu nhỏ):** x86_64 sử dụng Little-Endian trong khi một số DSP hoặc Network Protocols sử dụng Big-Endian.

### 3.2 Cơ Chế Zero-Copy Của `mmap`
Hàm hệ thống `mmap()` (POSIX) ánh xạ trực tiếp một file trên ổ cứng vào không gian địa chỉ bộ nhớ ảo (Virtual Address Space) của tiến trình. CPU đọc/ghi file như một mảng con trỏ trong RAM mà không cần gọi `read()` hay `memcpy()` qua Kernel buffer.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ ZERO-COPY: READ() KERNEL BUFFER COPY VS MMAP VIRTUAL ADDRESS SPACE   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Truyền thống read():                                                     │
│    Ổ đĩa / Flash ──▶ [ Page Cache Kernel ] ──(memcpy)──▶ [ User Space RAM ] │
│                       (2 lần copy + Context Switch qua syscall tốn kém)     │
│                                                                             │
│ 2. Bộ nhớ ánh xạ mmap() (Zero-Copy):                                        │
│    Ổ đĩa / Flash ──▶ [ Physical Page Frame ] <─────────────────────────┐    │
│                               ▲                                         │   │
│                               └────── Ánh xạ Page Table ────────────────┘   │
│                            [ Tiến trình User Space đọc trực tiếp ]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Case Study: Đọc Dữ Liệu PointCloud LiDAR 500MB Qua POSIX mmap Zero-Copy

> [!CAUTION]
> **Bối cảnh:** Ứng dụng xử lý bản đồ đám mây điểm 3D (3D LiDAR Point Cloud Map) cho xe tự hành. Mỗi tệp bản đồ quét laser nhị phân có dung lượng khoảng 500MB (chứa hàng chục triệu điểm tọa độ XYZI).
> **Triệu chứng:** Sử dụng vòng lặp `fread` với bộ đệm nhỏ (buffer 4KB) mất tới 4.8 giây để tải xong bản đồ. Tiến trình liên tục bị treo do hàng trăm nghìn lần chuyển đổi ngữ cảnh (Context Switches) giữa User Mode và Kernel Mode, chiếm 68% CPU.

```cpp
// TRƯỚC (Kém tối ưu): Đọc nhị phân bằng fread phân mảnh bộ đệm
#include <cstdio>
#include <vector>

struct Point3D { float x, y, z, intensity; };

std::vector<Point3D> loadPointCloudLegacy(const char* path)
{
    FILE* fp = fopen(path, "rb");
    if (!fp) return {};

    std::vector<Point3D> points;
    Point3D chunk[1024]; // Bộ đệm 1024 điểm (16KB)
    size_t read_count = 0;

    // LỖI HIỆU NĂNG: Gọi fread hàng chục nghìn lần trong vòng lặp!
    // Mỗi lần gọi fread kích hoạt syscall, Kernel copy từ đĩa vào Kernel Page Cache,
    // rồi lại memcpy từ Kernel Buffer sang User Buffer -> Nghẽn băng thông DRAM bus!
    while ((read_count = fread(chunk, sizeof(Point3D), 1024, fp)) > 0)
    {
        points.insert(points.end(), chunk, chunk + read_count);
    }
    fclose(fp);
    return points;
}
```

```cpp
// SAU (Khắc phục): Ánh xạ bộ nhớ ảo Zero-Copy với mmap chuẩn Allman
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <iostream>

struct Point3D { float x, y, z, intensity; };

class MmapPointCloudReader
{
private:
    int m_fd{-1};
    size_t m_fileSize{0};
    const Point3D* m_dataPtr{nullptr};

public:
    explicit MmapPointCloudReader(const char* path)
    {
        m_fd = open(path, O_RDONLY);
        if (m_fd < 0) return;

        struct stat sb;
        if (fstat(m_fd, &sb) == -1)
        {
            close(m_fd);
            return;
        }
        m_fileSize = static_cast<size_t>(sb.st_size);

        // Ánh xạ toàn bộ file 500MB vào không gian địa chỉ ảo chỉ trong O(1)
        void* addr = mmap(nullptr, m_fileSize, PROT_READ, MAP_SHARED, m_fd, 0);
        if (addr == MAP_FAILED)
        {
            close(m_fd);
            m_fd = -1;
            return;
        }

        // Báo trước cho OS biết ta sẽ đọc tuần tự để kích hoạt Page Cache Prefetch
        madvise(addr, m_fileSize, MADV_SEQUENTIAL);
        m_dataPtr = static_cast<const Point3D*>(addr);
    }

    const Point3D* getData() const { return m_dataPtr; }
    size_t getPointCount() const { return m_fileSize / sizeof(Point3D); }

    ~MmapPointCloudReader()
    {
        if (m_dataPtr)
        {
            munmap(const_cast<Point3D*>(m_dataPtr), m_fileSize);
        }
        if (m_fd >= 0)
        {
            close(m_fd);
        }
    }
};
// Kết quả: Thời gian nạp dữ liệu giảm từ 4.8s xuống còn 0.08s (Tăng tốc 60 lần)
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - `mmap` không nạp toàn bộ 500MB vào RAM cùng một lúc. Nó tạo ra các Virtual Memory Pages; khi thuật toán chạm tới trang nhớ nào, phần cứng MMU sẽ kích hoạt Page Fault để OS nạp đúng trang đó trực tiếp từ đĩa vào RAM (Zero-Copy).
> - Cờ `MADV_SEQUENTIAL` thông báo cho nhân Linux biết luồng truy cập sẽ là tuần tự, kích hoạt cơ chế đọc đón đầu (Read-Ahead Prefetch) của Kernel.

---

## 4. Serialization Formats Trong Hệ Thống Hiện Đại

| Định dạng | Kiểu | Tốc độ | Kích thước | Đặc điểm kiến trúc |
|:---|:---|:---|:---|:---|
| **JSON** (`nlohmann/json`) | Text | Chậm | Lớn | Dễ đọc, thích hợp cho cấu hình ban đầu (Configuration) |
| **Protocol Buffers** | Binary Schema | Rất nhanh | Rất nhỏ | Yêu cầu bước compile `.proto`, backward compatibility cực mạnh |
| **FlatBuffers** | Binary Zero-Copy | Tức thì | Nhỏ | Đọc dữ liệu trực tiếp từ buffer nhị phân mà không cần deserialize |

---

## 5. Đảm Bảo An Toàn Dữ Liệu Khi Mất Điện Đột Ngột (Atomic Save)

### 5.1 Rủi Ro Phổ Biến Trong Automotive ECU
Khi ECU đang ghi đè một tệp cấu hình quan trọng (chẳng hạn góc lái, dữ liệu căn chỉnh radar) trực tiếp bằng `fopen(..., "w")`:
1. File cũ ngay lập tức bị truncate về kích thước 0 byte.
2. Nếu xe bị ngắt ắc-quy đột ngột lúc này: **Toàn bộ cấu hình biến mất vĩnh viễn, ECU không thể khởi động lại**.

### 5.2 Case Study: Sập Nguồn Đột Ngột Làm Hỏng File Cấu Hình ECU & Giải Pháp Atomic File Save

> [!CAUTION]
> **Bối cảnh:** Bộ điều khiển phanh khẩn cấp tự động (AEB ECU) lưu thông số căn chỉnh khoảng cách an toàn vào file `calibration.json`. Hệ thống cập nhật dữ liệu này định kỳ khi xe vận hành.
> **Triệu chứng:** Khi tài xế tắt chìa khóa điện đúng lúc ECU đang ghi dữ liệu, sau khi bật lại xe, hệ thống báo lỗi hỏng file (Corrupted File - 0 Bytes), xe bị khóa không cho khởi động do lỗi an toàn ISO 26262.

```cpp
// TRƯỚC (Lỗi): Mở ghi đè trực tiếp làm mất toàn bộ dữ liệu nếu mất điện giữa chừng
bool saveCalibrationBad(const char* path, const std::string& data)
{
    FILE* fp = fopen(path, "w"); // File lập tức bị cắt cụt (truncated) về 0 byte!
    if (!fp) return false;

    // NẾU MẤT ĐIỆN TẠI ĐÂY: File gốc đã biến thành 0 byte và dữ liệu mới chưa được ghi!
    fwrite(data.c_str(), 1, data.size(), fp);
    fclose(fp);
    return true;
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ QUY TRÌNH LƯU FILE NGUYÊN TỬ (ATOMIC SAVE) CHỐNG MẤT ĐIỆN ĐỘT NGỘT          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Ghi toàn bộ dữ liệu vào file tạm: config.json.tmp_123                    │
│ 2. Ép flush từ Page Cache xuống phần cứng Flash: fsync(fd)                  │
│ 3. Đổi tên nguyên tử ở tầng Filesystem: rename(tmp, config.json)            │
│    (Thao tác atomic: Hoặc là giữ nguyên file cũ, hoặc là trỏ sang file mới) │
│ 4. BẮT BUỘC: fsync(dir_fd) trên thư mục cha để flush Directory Inode Entry  │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Atomic File Save qua Temp Inode + fsync chuẩn Allman
#include <fcntl.h>
#include <unistd.h>
#include <cstdio>
#include <string>

bool saveCalibrationAtomicSafe(const char* dirPath, const char* finalPath, const std::string& data)
{
    std::string tmpPath = std::string(finalPath) + ".tmp";

    // 1. Mở file tạm với cờ tạo mới độc quyền
    int fd = open(tmpPath.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0)
    {
        return false;
    }

    // 2. Ghi toàn bộ nội dung dữ liệu vào file tạm
    ssize_t bytesWritten = write(fd, data.data(), data.size());
    if (bytesWritten != static_cast<ssize_t>(data.size()))
    {
        close(fd);
        unlink(tmpPath.c_str());
        return false;
    }

    // 3. ÉP FLUSH dữ liệu từ Kernel Page Cache xuống chip nhớ Flash vật lý
    if (fsync(fd) < 0)
    {
        close(fd);
        unlink(tmpPath.c_str());
        return false;
    }
    close(fd);

    // 4. HOÁN ĐỔI NGUYÊN TỬ (Atomic Inode Replacement)
    // Hệ điều hành POSIX đảm bảo rename() diễn ra nguyên tử:
    // Nếu sập nguồn xảy ra, file đích vẫn trỏ 100% nguyên vẹn về inode cũ!
    if (rename(tmpPath.c_str(), finalPath) < 0)
    {
        unlink(tmpPath.c_str());
        return false;
    }

    // 5. BẮT BUỘC TRONG HỆ THỐNG NHÚNG: Flush Directory Entry của thư mục cha
    int dirFd = open(dirPath, O_DIRECTORY | O_RDONLY);
    if (dirFd >= 0)
    {
        fsync(dirFd); // Đảm bảo bảng danh mục thư mục được lưu cứng trên Flash ROM
        close(dirFd);
    }
    return true;
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Hàm `rename()` trong tiêu chuẩn POSIX là một thao tác nguyên tử (Atomic Operation). Tại bất kỳ thời điểm nào, file cấu hình luôn hợp lệ (hoặc là phiên bản cũ trọn vẹn, hoặc là phiên bản mới trọn vẹn).
> - Bẫy chết người: Nếu quên gọi `fsync(dirFd)` trên thư mục chứa file, việc sập nguồn đột ngột có thể khiến bản ghi thư mục (Directory Entry) chưa kịp ghi xuống Flash, dẫn tới việc khởi động lại thấy file biến thành 0 byte dù dữ liệu khối đã nằm dưới đĩa!

---

## 6. Guideline Sử Dụng File I/O Trong Hệ Thống Nhúng (Theo AUTOSAR)

1. **Không sử dụng trực tiếp thư viện C chuẩn (`stdio.h`) trong lõi logic**: Cần bọc qua lớp trừu tượng (Abstraction Layer / MCAL).
2. **Không thực thi File I/O trong các tác vụ thời gian thực (Real-Time Tasks) hoặc hàm ngắt (ISR)**: Thao tác truy xuất đĩa có độ trễ bất định lớn (Unbounded Latency). Bắt buộc phải đẩy dữ liệu vào Lock-free Queue và ủy quyền cho một worker thread nền ưu tiên thấp thực thi.
3. **Tuân thủ quy chuẩn quản lý lỗi**: Không bao giờ bỏ qua giá trị trả về của `write`, `fsync`, hay `rename`.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: C file input/output](https://en.cppreference.com/w/c/io) | C-style `fopen`, `fread`, `fwrite`, `fseek`, Buffering modes |
| [cppreference: std::basic_fstream](https://en.cppreference.com/w/cpp/io/basic_fstream) | C++ Stream I/O, RAII stream management, binary open modes |
| [man7.org: mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html) | POSIX Memory-mapped I/O, `munmap`, `msync`, `MAP_SHARED` |
| [Google FlatBuffers](https://flatbuffers.dev/) | Zero-copy deserialization cho Real-time & Embedded systems |
| *AUTOSAR Adaptive Platform* — Persistency Specification | Chuẩn an toàn cho việc ghi/đọc dữ liệu cấu hình ECU (Atomic Save) |
| *Computer Systems: A Programmer's Perspective (CS:APP)* — Chapter 9 | Cơ chế ảo hóa bộ nhớ và Memory-Mapped I/O tầng OS |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Giải Pháp Kỹ Thuật |
| :--- | :--- |
| Đọc file văn bản từng dòng an toàn | `std::ifstream` + `std::getline(ifs, line)` |
| Đọc/Ghi dữ liệu nhị phân | Mở mode `"rb"`/`"wb"` (bắt buộc tránh chuyển đổi dòng ký tự) |
| Xử lý file dữ liệu khổng lồ (>500MB) | `mmap()` POSIX Zero-Copy + `madvise(MADV_SEQUENTIAL)` |
| Tuần tự hóa thông điệp Zero-Copy | FlatBuffers (truy cập trường trực tiếp không cần parse) |
| Chống hỏng dữ liệu khi sập nguồn ECU | Atomic Save: Ghi file `.tmp` $\rightarrow$ `fsync(fd)` $\rightarrow$ `rename()` $\rightarrow$ `fsync(dir_fd)` |
