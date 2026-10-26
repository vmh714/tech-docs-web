# Cẩm Nang Toàn Diện Về Các Cờ (Flags) Biên Dịch GCC / G++

> [!IMPORTANT]
> **Mục tiêu**:
> Tài liệu tổng hợp toàn bộ các cờ biên dịch chuẩn của `gcc` và `g++`, phân loại theo các giai đoạn xây dựng phần mềm (Build Process), chiến lược tối ưu hiệu năng (Performance Optimization) và kỹ thuật liên kết thư viện tĩnh/động (Static & Dynamic Linking).

---

### Các Cờ Cơ Bản & Chuẩn Hóa Mã Nguồn (Fundamental Flags)

| Cờ (Flag) | Ý Nghĩa & Tác Dụng |
| :--- | :--- |
| `-std=c++14` | Chỉ định phiên bản chuẩn C++ (ví dụ: `c++11`, `c++14`, `c++17`, `c++20`). |
| `-Wall` | Bật hầu hết các cảnh báo cú pháp nguy hiểm thông thường (All Warnings). |
| `-Wextra` | Bật thêm các cảnh báo bổ sung nâng cao (Bật các cảnh báo mà `-Wall` bỏ qua). |
| `-Wpedantic` | Bắt mọi vi phạm chuẩn ISO C/C++ nghiêm ngặt. Đặc biệt quan trọng khi cross-compile cho ARM (compiler ARM strict hơn GCC x86). |
| `-Werror` | Biến tất cả Cảnh báo (Warnings) thành Lỗi (Errors), ép phải sửa sạch cảnh báo mới cho build. |
| `-Wshadow` | Cảnh báo khi biến cục bộ trùng tên biến ở scope ngoài (variable shadowing) — nguồn bug ẩn rất phổ biến. |
| `-Wconversion` | Cảnh báo khi chuyển đổi kiểu ngầm có thể mất dữ liệu (ví dụ: `double` → `int`, `int` → `unsigned`). |
| `-g` / `-g3` | Sinh thông tin hỗ trợ gỡ lỗi (Debug Symbols) cho `gdb`. `-g3` bổ sung cả các macro `#define`. |
| `-I<dir>` | Thêm thư mục chứa file tiêu chuẩn (`.h`, `.hpp`) vào danh sách tìm kiếm include (`Include Path`). |
| `-D<macro>=<val>` | Định nghĩa macro từ dòng lệnh (tương đương `#define` trong code). Ví dụ: `-DDEBUG=1`, `-DPLATFORM_ARM`. |
| `-o <file>` | Chỉ định tên tệp đầu ra (Output File). |

---

### Các Cờ Kiểm Soát Theo Pha Biên Dịch (Build Phase Flags)

Chuỗi biên dịch C/C++ trải qua các giai đoạn chính. Sử dụng các cờ sau để dừng lại ở từng pha cụ thể:

```
    Source (.cpp/.c) ── -E ──▶ Preprocessed (.i) ── -S ──▶ Assembly (.s) ── -c ──▶ Object (.o) ── ld ──▶ Executable / .so
```

> [!NOTE]
> - **Cờ `-E` (Stop after Preprocessing)**:
>   - Tác dụng: Đã xử lý xong các chỉ thị tiền xử lý (`#include`, `#define`, `#ifdef`), mở rộng toàn bộ macro và chèn nội dung file header.
>   - Đầu ra: Mã nguồn tiền xử lý dạng text (stdout hoặc tệp `.i`).
>
> - **Cờ `-S` (Stop after Compilation)**:
>   - Tác dụng: Dừng lại sau khi biên dịch mã C++ thành mã hợp ngữ (Assembly).
>   - Đầu ra: File chứa mã Assembly nhân vi xử lý (tệp `.s`).
>
> - **Cờ `-c` (Stop after Assembly / Compile-only)**:
>   - Tác dụng: Dừng lại sau khi biên dịch thành tệp đối tượng nhị phân (Object file), **loại bỏ hoàn toàn bước Linking**.
>   - Đầu ra: Tệp đối tượng tái định vị (Relocatable Object File `.o`).
>
> - **Mặc định (Không dùng cờ dừng)**:
>   - Tác dụng: Thực hiện đầy đủ các giai đoạn và gọi Trình liên kết `ld` để sinh ra file thực thi nhị phân hoặc thư viện hoàn chỉnh.

---

### Các Cờ Tối Ưu Hiệu Năng (Optimization Flags)

Đặc biệt quan trọng đối với hệ thống Nhúng (Embedded Systems), Xử lý ảnh (Computer Vision) và AI:

> [!TIP]
> **Các mức tối ưu hóa chính (`-O`)**:
> - **`-O0` (No Optimization)**: Mặc định. Biên dịch nhanh nhất, không tối ưu mã máy. Thích hợp nhất để Debug bằng `gdb`.
> - **`-O1` (Basic Optimization)**: Tối ưu nhẹ, giảm kích thước file và thời gian thực thi mà không làm tăng thời gian biên dịch đáng kể.
> - **`-O2` (Recommended Production)**: Mức tối ưu hóa tiêu chuẩn phát hành sản phẩm. Kích hoạt hầu hết các kỹ thuật tối ưu mã máy không đánh đổi kích thước file.
> - **`-O3` (High Performance)**: Mức tối ưu hóa tối đa. Kích hoạt Vector hóa tự động (Auto-vectorization), unroll vòng lặp (Loop Unrolling) và inline hàm mạnh mẽ.
> - **`-Os` (Optimize for Size)**: Tối ưu hóa kích thước file nhị phân nhỏ nhất (vô cùng hữu ích cho vi điều khiển/thiết bị nhúng bộ nhớ hạn chế).
> - **`-Ofast` (Aggressive Fast Math — CỰC KỲ NGUY HIỂM)**: Kích hoạt toàn bộ `-O3` kết hợp `-ffast-math`. Bỏ qua chuẩn IEEE 754 số thực.
>   - ⚠️ **Hiểm họa ngầm:** Compiler tự động **XÓA BỎ** câu lệnh kiểm tra NaN (`if (x != x)`), giả định không có số vô cùng (`isinf`), và bật chế độ Flush Denormals to Zero.
>   - ❌ **Cấm dùng:** Trong các pipeline Computer Vision, Ma trận chiếu Camera 3D, hoặc Inference AI có bước kiểm tra tính hợp lệ của số thực (Numeric Validation). Sai số sẽ bị sai lệch âm thầm mà không có bất kỳ Exception nào!

> [!TIP]
> **Các cờ tối ưu hóa phần cứng & SIMD**:
> - **`-march=native`**: Tự động phát hiện và tối ưu hóa mã máy cho đúng tập lệnh của CPU máy đang biên dịch (AVX2, AVX512, FMA,...). **Lưu ý: KHÔNG dùng khi cross-compile** — vì `-march=native` detect CPU máy host, không phải target.
> - **`-mtune=<cpu>`**: Tối ưu scheduling cho CPU cụ thể nhưng giữ tương thích với tập lệnh cơ bản (dùng kết hợp `-march`).
> - **`-mfpu=neon` / `-march=armv8-a`**: Bật tập lệnh SIMD NEON trên vi xử lý ARM (Raspberry Pi, Jetson Nano,...).

> [!TIP]
> **Các cờ tối ưu hóa Linker nâng cao**:
> - **`-flto`** (Link-Time Optimization): Cho phép trình biên dịch tối ưu **xuyên suốt các file `.o`** trong giai đoạn linking — inline function cross-module, loại bỏ dead code toàn cục. Giảm 10-20% kích thước binary cho embedded firmware.
> - **`-ffunction-sections` + `-fdata-sections`**: Đặt mỗi hàm/biến vào section riêng trong file `.o`.
> - **`-Wl,--gc-sections`**: Kết hợp với 2 cờ trên — Linker loại bỏ section không dùng. Cực kỳ hiệu quả giảm binary size cho vi điều khiển.
> - **`-fno-exceptions` + `-fno-rtti`**: Tắt exception handling và Run-Time Type Information — giảm binary size đáng kể. Thường dùng cho bare-metal embedded (không có OS hỗ trợ exception).

---

### Các Cờ Phân Tích & Phát Hiện Lỗi Runtime (Sanitizer Flags)

Đặc biệt quan trọng trong quy trình CI/CD của mọi dự án ADAS/Embedded. Các sanitizer chèn mã kiểm tra lúc biên dịch, phát hiện lỗi lúc runtime với overhead thấp hơn Valgrind (2-5x vs 10-50x):

> [!CAUTION]
> **AddressSanitizer (ASan) — Phát hiện Memory Bugs**:
> - **`-fsanitize=address`**: Phát hiện buffer overflow (stack/heap/global), use-after-free, use-after-return, double-free, memory leaks.
> - Kết hợp **`-fno-omit-frame-pointer`** để ASan report hiển thị backtrace đầy đủ.
> - Overhead: ~2x chậm hơn, ~3x bộ nhớ hơn. Dùng cho Dev/CI build, **KHÔNG dùng production**.
> - Ví dụ: `g++ -fsanitize=address -fno-omit-frame-pointer -g main.cpp -o main`

> [!CAUTION]
> **UndefinedBehaviorSanitizer (UBSan) — Phát hiện Undefined Behavior**:
> - **`-fsanitize=undefined`**: Phát hiện signed integer overflow, null pointer dereference, misaligned access, division by zero, shift overflow.
> - Có thể dùng **chung với ASan**: `-fsanitize=address,undefined`.
> - Overhead rất thấp (~1.1x) — có thể bật cả trong build nội bộ thường xuyên.

> [!CAUTION]
> **ThreadSanitizer (TSan) — Phát hiện Data Race**:
> - **`-fsanitize=thread`**: Phát hiện data race giữa các thread (đọc/ghi cùng biến không đồng bộ).
> - **KHÔNG dùng chung với ASan** (xung đột instrumentation). Chọn 1 trong 2.
> - Overhead: ~5-15x chậm hơn, ~5-10x bộ nhớ hơn.

> [!CAUTION]
> **LeakSanitizer (LSan) — Phát hiện Memory Leak**:
> - **`-fsanitize=leak`**: Chỉ phát hiện memory leak (nhẹ hơn ASan). ASan đã bao gồm LSan mặc định.
> - Dùng độc lập khi chỉ cần kiểm tra leak mà không cần overhead của ASan.

---

### Các Cờ Kiểm Soát Symbol Visibility (Symbol Control Flags)

Đặc biệt quan trọng khi phát triển thư viện `.so` (plugin architecture, Qt plugins, OpenCV custom modules):

> [!WARNING]
> **Kiểm soát Symbol Export trong Shared Library**:
> - **`-fvisibility=hidden`**: Ẩn toàn bộ symbol mặc định — chỉ export symbol được đánh dấu tường minh. Ưu điểm:
>   - Giảm kích thước bảng `.dynsym` → tăng tốc loading.
>   - Tránh symbol clash khi load nhiều `.so` cùng lúc.
>   - Giảm kích thước binary.
> - **`__attribute__((visibility("default")))`**: Đánh dấu symbol cụ thể cần export ra ngoài. Thường wrap thành macro:
>   ```cpp
>   #define API_EXPORT __attribute__((visibility("default")))
>   API_EXPORT int myPublicFunction(int x);
>   ```
> - **`-fvisibility-inlines-hidden`**: Ẩn inline functions — giảm thêm symbol table size, hầu như không có side-effect.

---

### Các Cờ Cross-Compilation (Cross-Compile Flags)

Sử dụng khi biên dịch code trên máy host (x86) để chạy trên target board (ARM/AArch64):

> [!NOTE]
> **Cross-compile cơ bản**:
> - **`--target=<triple>`** (Clang): Chỉ định target architecture. Ví dụ: `--target=aarch64-linux-gnu`.
> - **`--sysroot=<dir>`**: Chỉ định root filesystem của target — nơi tìm headers và libraries cho cross-compile.
> - **Dùng cross-compiler**: Thay `g++` bằng cross-compiler. Ví dụ: `aarch64-linux-gnu-g++` cho ARM 64-bit.
> - Trên thực tế, cross-compilation thường quản lý qua **CMake toolchain file** thay vì truyền cờ thủ công.
>
> **Ví dụ cross-compile cho Raspberry Pi / Jetson:**
> ```bash
> aarch64-linux-gnu-g++ -std=c++17 -O2 -march=armv8-a main.cpp -o main_arm
> ```

---

### Các Cờ Sinh Thông Tin Hỗ Trợ Công Cụ (Tooling Support Flags)

> [!NOTE]
> **Cờ hỗ trợ IDE & Công cụ phân tích**:
> - **`-MJ <file>.json`**: Sinh compile command entry dạng JSON cho 1 file (dùng tổng hợp thành `compile_commands.json` cho `clangd`). Trên thực tế, CMake tự sinh bằng `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`.
> - **`-fdiagnostics-color=always`**: Ép output lỗi/cảnh báo có màu ngay cả khi redirect stdout — hữu ích khi dùng với build system (Make, Ninja).
> - **`-ftime-report`**: In báo cáo thời gian từng pha biên dịch — tìm bottleneck trong build time.
> - **`-save-temps`**: Giữ lại tất cả file trung gian (`.i`, `.s`, `.o`) — debug pipeline biên dịch.

---

### Các Cờ Tạo & Liên Kết Thư Viện Động / Tĩnh (Linking Flags)

> [!WARNING]
> **Cờ dành cho biên dịch & đóng gói Thư viện Động (Shared Library `.so`)**:
> - **`-fPIC` (Position Independent Code)**: Bắt buộc khi biên dịch code cho thư viện động. Giúp mã máy có thể nạp vào bất kỳ địa chỉ bộ nhớ nào lúc runtime.
> - **`-shared`**: Chỉ thị cho Trình liên kết `ld` đóng gói các tệp đối tượng thành tệp Shared Object ELF (`.so`). **Lưu ý: Không dùng chung cờ này với cờ `-c`**.

> [!WARNING]
> **Cờ chỉ định liên kết khi biên dịch Ứng dụng**:
> - **`-L<dir>`**: Thêm thư mục chứa file thư viện (`.so`, `.a`) vào danh sách tìm kiếm của Trình liên kết (`Library Path`).
> - **`-l<name>`**: Liên kết với thư viện chỉ định (ví dụ: `-lmath` sẽ tìm `libmath.so` hoặc `libmath.a`).
> - **`-l:<filename>`**: Liên kết chính xác với tệp thư viện chỉ định tên đầy đủ (ví dụ: `-l:libinterger.so`).
> - **`-static`**: Ép buộc Trình liên kết thực hiện Liên kết Tĩnh (Static Linking) toàn bộ thư viện thành một file nhị phân độc lập duy nhất.
> - **`-Wl,-rpath,<dir>`**: Truyền tham số `-rpath` trực tiếp cho Linker `ld` để ghi nhận đường dẫn tìm kiếm file `.so` lúc runtime vào chính tệp thực thi.

---

## Case Study: ASan Bắt Buffer Overflow Trong Bài Tập Array

> [!CAUTION]
> **Bối cảnh:** Bài tập xử lý mảng — hàm `fillPlaylist()` ghi 11 phần tử vào mảng cố định 10 phần tử. Compile bình thường, chạy bình thường trên x86 (vì ghi đè padding/alignment bytes → "tình cờ không crash").
> **Triệu chứng:** Không crash trên host. Nhưng trên ARM embedded, ghi đè return address → jump to garbage → Hard Fault. ASan phát hiện ngay trên host.

```bash
# Compile với ASan:
g++ -std=c++17 -g -O0 -fsanitize=address -fno-omit-frame-pointer main.cpp -o app

# Chạy:
./app
# =================================================================
# ==12345==ERROR: AddressSanitizer: stack-buffer-overflow on address 0x7ffc12345678
#   WRITE of size 4 at 0x7ffc12345678 thread T0
#     #0 0x401234 in fillPlaylist() main.cpp:15    ← CHÍNH XÁC dòng gây lỗi
#     #1 0x401567 in main main.cpp:28
# Address 0x7ffc12345678 is located in stack of thread T0 at offset 44 in frame
#     #0 0x401200 in fillPlaylist() main.cpp:10
#   This frame has 1 object(s):
#     [32, 72) 'playlist' (line 11) <== Memory access at offset 72 overflows this variable
```

```cpp
// ❌ Code gây lỗi:
void fillPlaylist()
{
    int playlist[10];
    for (int i = 0; i <= 10; i++) // ← off-by-one: i=10 ghi ngoài mảng
        playlist[i] = i;
}

// ✅ Fix:
void fillPlaylist()
{
    std::array<int, 10> playlist;
    for (int i = 0; i < static_cast<int>(playlist.size()); i++)
        playlist[i] = i; // std::array::operator[] + ASan = double protection
}
```

> [!TIP]
> - ASan thêm **shadow memory** (1 byte shadow cho 8 bytes app memory) để detect mọi out-of-bounds access. Overhead: ~2x chậm, ~3x RAM → **chỉ dùng cho dev/CI, KHÔNG production**.
> - Kết hợp `-fsanitize=undefined` (UBSan) để bắt thêm signed overflow, null deref, alignment violations.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [GCC Online Documentation: Options Controlling C++ Dialect](https://gcc.gnu.org/onlinedocs/gcc/C_002b_002b-Dialect-Options.html) | `-std=c++14/17/20`, standard conformance |
| [GCC Online Documentation: Options to Request or Suppress Warnings](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html) | `-Wall`, `-Wextra`, `-Wpedantic`, `-Wshadow`, `-Wconversion`, `-Werror` |
| [GCC Online Documentation: Options for Code Generation Conventions](https://gcc.gnu.org/onlinedocs/gcc/Code-Gen-Options.html) | `-fPIC`, `-fvisibility`, `-ffunction-sections`, `-fdata-sections` |
| [GCC Online Documentation: Options for Directory Search](https://gcc.gnu.org/onlinedocs/gcc/Directory-Options.html) | `-I<dir>`, `-L<dir>`, `-B<prefix>` |
| [GCC Online Documentation: Options for Linking](https://gcc.gnu.org/onlinedocs/gcc/Link-Options.html) | `-shared`, `-static`, `-Wl,option`, `--gc-sections` |
| [man7.org: ld(1)](https://man7.org/linux/man-pages/man1/ld.1.html) | GNU Linker flags, `-rpath`, `--out-implib` |

---

### Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Lệnh / Cờ Khuyên Dùng |
| :--- | :--- |
| Biên dịch Debug an toàn (khuyên dùng) | `g++ -std=c++17 -g3 -Wall -Wextra -Wpedantic -Wshadow -O0 main.cpp -o main` |
| Debug + ASan (phát hiện memory bug) | `g++ -std=c++17 -g -fsanitize=address,undefined -fno-omit-frame-pointer -O1 main.cpp -o main` |
| Debug + TSan (phát hiện data race) | `g++ -std=c++17 -g -fsanitize=thread -O1 main.cpp -o main` |
| Biên dịch Sản phẩm (Release) | `g++ -std=c++17 -O2 -Wall -DNDEBUG main.cpp -o main` |
| Release tối ưu size (Embedded) | `g++ -std=c++17 -Os -flto -ffunction-sections -fdata-sections -Wl,--gc-sections main.cpp -o main` |
| Biên dịch CV/Embedded AI tốc độ cao | `g++ -std=c++17 -O3 -march=native -flto main.cpp -o main` |
| Tạo Shared Object (.so) | `g++ -std=c++17 -fPIC -fvisibility=hidden -shared interger.cpp -o libinterger.so` |
| Link Shared Object có Rpath | `g++ main.cpp -L. -l:libinterger.so -Wl,-rpath,. -o main_app` |
| Cross-compile cho ARM64 | `aarch64-linux-gnu-g++ -std=c++17 -O2 -march=armv8-a main.cpp -o main_arm` |
| Giữ file trung gian debug pipeline | `g++ -save-temps -std=c++17 main.cpp -o main` |
