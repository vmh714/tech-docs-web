# Hướng Dẫn Sử Dụng Lệnh `nm` Đọc Bảng Ký Hiệu (Symbols) Trong Thư Viện Động (.so)

> [!IMPORTANT]
> **Khái niệm cốt lõi**:
> Một tệp thư viện động `.so` (Shared Object) dạng ELF chứa hai bảng ký hiệu hoàn toàn khác nhau:
> - **Bảng ký hiệu đầy đủ (`.symtab`)**: Lưu toàn bộ ký hiệu nội bộ và toàn cục (dùng cho debug & liên kết nội bộ).
> - **Bảng ký hiệu động (`.dynsym`)**: Chỉ lưu các API công khai xuất ra ngoài (Exported) hoặc đi mượn từ thư viện khác (Imported).
>
> **Liên kết:**
> - Tạo Static/Dynamic Library, Dynamic Loading (`dlsym`), DLL Export, Troubleshooting → [`02b_library_fundamentals.md`](./02b_library_fundamentals.md)
> - ELF format, PLT/GOT, Symbol Visibility → [`08_linking_internals.md`](./08_linking_internals.md)
> - CMake build workflow → [`02_cmake_build_system.md`](./02_cmake_build_system.md)

---

### Phân Tích Các Cờ (Flags) Thường Dùng Khi Kiểm Tra File `.so`

| Cờ (Flag) | Tên Đầy Đủ | Công Dụng Chính |
| :--- | :--- | :--- |
| `-D` | `--dynamic` | Bắt buộc `nm` đọc từ bảng `.dynsym`. Chỉ hiển thị các symbol liên kết động. |
| `-C` | `--demangle` | Giải mã tên hàm C++ bị mã hóa (Name Mangling) về dạng tên gốc người đọc được. |
| `-g` | `--extern-only` | Chỉ lọc và hiển thị các symbol toàn cục (External / Global symbols). |
| `-u` | `--undefined-only` | Chỉ hiển thị các symbol chưa có định nghĩa (Symbol đi mượn từ thư viện khác). |
| `-A` | `--print-file-name` | In tên tệp nhị phân ở đầu mỗi dòng (hữu ích khi làm việc với nhiều file `.so`). |
| `-n` | `--numeric-sort` | Sắp xếp kết quả theo địa chỉ tăng dần — giúp thấy layout của các symbol trong bộ nhớ. |
| `-S` | `--print-size` | In kích thước (size) của mỗi symbol (nếu có) — phát hiện hàm/biến chiếm nhiều bộ nhớ. |
| `-t d` | `--radix=d` | Hiển thị địa chỉ dạng thập phân (d=decimal, o=octal, x=hex). Mặc định là hex. |
| `--defined-only` | | Chỉ hiển thị symbol đã được định nghĩa trong file (ngược với `-u`). |

---

### Ý Nghĩa Các Ký Tự Phân Loại Symbol (Symbol Types)

Kết quả lệnh `nm` trả về ký tự loại symbol ở cột giữa. Ký tự **VIẾT HOA** đại diện cho **External/Global Symbol**, ký tự **viết thường** đại diện cho **Internal/Local Symbol**:

> [!NOTE]
> - **`T` / `t`** (Text Section): Ký hiệu thuộc phân vùng mã thực thi (Hàm).
> - **`R` / `r`** (Read-Only Data Section): Ký hiệu thuộc phân vùng dữ liệu chỉ đọc (Biến `const`, hằng chuỗi).
> - **`D` / `d`** (Data Section): Ký hiệu thuộc phân vùng dữ liệu đã khởi tạo (Biến toàn cục/static có gán giá trị).
> - **`B` / `b`** (BSS Section): Ký hiệu thuộc phân vùng dữ liệu chưa khởi tạo (Biến toàn cục/static mặc định bằng 0).
> - **`W` / `w`** (Weak Symbol): Ký hiệu yếu (có thể bị ghi đè bởi ký hiệu cùng tên ở nơi khác).
> - **`U`** (Undefined Symbol): Ký hiệu chưa định nghĩa (Ký hiệu đi mượn từ bên ngoài).

---

### Các Trường Hợp Sử Dụng Thực Tế

> [!TIP]
> **Trường hợp 1: Kiểm tra danh sách API công khai mà thư viện `.so` xuất ra ngoài**
> ```bash
> nm -D -C lib_name.so
> ```
> *Ứng dụng: Kiểm tra xem ứng dụng khác có gọi được các hàm trong thư viện hay không.*

> [!TIP]
> **Trường hợp 2: Debug toàn bộ biến/hàm nội bộ khi phát triển thư viện**
> ```bash
> nm -C lib_name.so
> ```
> *Ứng dụng: Đọc bảng `.symtab` để xem biến `static` hoặc `const` nội bộ có được sinh ra hay không.*

> [!TIP]
> **Trường hợp 3: Kiểm tra các hàm mượn từ thư viện hệ thống**
> ```bash
> nm -D -u -C lib_name.so
> ```
> *Ứng dụng: Tìm các phụ thuộc (Dependencies) bên ngoài mà thư viện `.so` yêu cầu lúc runtime.*

---

### Những Lưu Ý Quan Trọng (Gotchas)

> [!WARNING]
> **Lưu ý 1: Biên dịch bằng cờ `-c` khiến `nm -D` báo `no symbols`**
> - Nguyên nhân: Cờ `-c` ngắt tiến trình biên dịch trước khi Trình liên kết (`ld`) chạy. Tệp sinh ra là file `.o` (đối tượng tái định vị) chứ không phải `.so` thật sự, do đó không có bảng `.dynsym`.
> - Khắc phục: Loại bỏ cờ `-c` khi đóng gói thư viện động.

> [!WARNING]
> **Lưu ý 2: Biến `const` toàn cục trong C++ không xuất hiện ở `nm -D`**
> - Nguyên nhân: Chuẩn C++ quy định biến global `const` có **Internal Linkage** mặc định (tương tự `static`), dẫn đến việc bị loại khỏi bảng `.dynsym`.
> - Khắc phục: Thêm từ khóa `extern` trước khai báo (ví dụ: `extern const int hehe = 10;`).

> [!WARNING]
> **Lưu ý 3: Binary đã bị `strip` sẽ mất bảng `.symtab`**
> - Nguyên nhân: Lệnh `strip` loại bỏ bảng `.symtab` (debug symbols) khỏi binary để giảm size. `nm` không cờ sẽ báo `no symbols`.
> - Khắc phục: Dùng `nm -D` để đọc bảng `.dynsym` (bảng này KHÔNG bị strip vì cần cho runtime). Hoặc giữ bản binary chưa strip cho debug.

> [!WARNING]
> **Lưu ý 4: Hàm C trong file `.cpp` bị Name Mangling**
> - Nguyên nhân: G++ mặc định mangle mọi symbol. Hàm `int add(int, int)` sẽ xuất hiện là `_Z3addii` thay vì `add` trong bảng symbol.
> - Khắc phục: Dùng `extern "C"` để tắt mangling cho hàm cần export dưới tên C (bắt buộc khi thư viện `.so` cần gọi từ C hoặc `dlsym`).
>   ```cpp
>   extern "C" {
>       int add(int a, int b) { return a + b; }
>   }
>   ```

---

### Các Trường Hợp Sử Dụng Nâng Cao

> [!TIP]
> **Trường hợp 4: So sánh API giữa 2 phiên bản thư viện `.so`**
> ```bash
> diff <(nm -D -C libfoo_v1.so | sort) <(nm -D -C libfoo_v2.so | sort)
> ```
> *Ứng dụng: Kiểm tra ABI compatibility khi nâng cấp thư viện — phát hiện symbol bị xóa hoặc đổi chữ ký hàm.*

> [!TIP]
> **Trường hợp 5: Tìm symbol gây lỗi `undefined reference` khi link**
> ```bash
> # Kiểm tra symbol cần tìm có trong .so không
> nm -D -C libfoo.so | grep "myFunction"
> # Kiểm tra file .o nào cần symbol đó
> nm -C -u main.o | grep "myFunction"
> ```
> *Ứng dụng: Debug lỗi linker `undefined reference to` — xác định symbol thiếu nằm ở đâu.*

> [!TIP]
> **Trường hợp 6: Kiểm tra binary sau khi `strip` còn gì**
> ```bash
> nm libfoo.so          # Báo "no symbols" (vì .symtab bị strip)
> nm -D -C libfoo.so    # Vẫn thấy exported API (vì .dynsym không bị strip)
> ```
> *Ứng dụng: Xác nhận production binary đã strip nhưng vẫn hoạt động đúng.*

> [!TIP]
> **Trường hợp 7: Tìm hàm/biến chiếm nhiều bộ nhớ nhất trong binary**
> ```bash
> nm -C -S --size-sort libfoo.so | tail -20
> ```
> *Ứng dụng: Tối ưu binary size cho embedded — tìm symbol lớn nhất để refactor hoặc loại bỏ.*

---

### Bộ Công Cụ Phân Tích Binary Đi Kèm (Companion Tools)

`nm` chỉ là 1 trong nhiều công cụ phân tích binary trên Linux. Dưới đây là các công cụ bổ sung thường dùng cùng `nm` trong quy trình phát triển/debug:

> [!NOTE]
> **`objdump` — Phân tích chi tiết hơn `nm`**:
> - **`objdump -d binary`**: Disassemble — xem mã Assembly của từng hàm. Lệnh đầu tiên mở khi debug ADAS crash dump.
> - **`objdump -t binary`**: Xem bảng symbol đầy đủ (giống `nm` nhưng nhiều thông tin hơn: section, flags).
> - **`objdump -h binary`**: Xem section headers — kích thước `.text`, `.data`, `.bss`.
> - **`objdump -d -j .plt binary`**: Xem PLT entries — các stub hàm dynamic linking.
> - Ví dụ: `objdump -d -C libfoo.so | grep -A 20 "<myFunction>:"`

> [!NOTE]
> **`readelf` — Đọc ELF headers & metadata**:
> - **`readelf -h binary`**: Xem ELF header (entry point, architecture, endianness).
> - **`readelf -S binary`**: Xem tất cả sections (tương tự `objdump -h` nhưng chi tiết hơn).
> - **`readelf -d binary`**: Xem dynamic section — danh sách `.so` dependencies và RPATH/RUNPATH.
> - **`readelf -l binary`**: Xem program headers (segments) — cách OS loader nạp binary.
> - Ví dụ: `readelf -d main_app | grep NEEDED` — liệt kê tất cả `.so` cần thiết.

> [!NOTE]
> **`ldd` — Kiểm tra Shared Library Dependencies**:
> - **`ldd binary`**: Liệt kê tất cả `.so` mà binary cần và đường dẫn thực tế của chúng.
> - Lệnh đầu tiên chạy khi deploy lên target board mà binary crash `"not found"`.
> - Ví dụ: `ldd main_app` — nếu thấy `not found` → thiếu `.so` hoặc sai `LD_LIBRARY_PATH`.

> [!WARNING]
> **Bảo mật: KHÔNG dùng `ldd` trên binary không tin cậy**:
> - `ldd` thực thi binary để resolve dependencies → có thể bị exploit.
> - Thay thế an toàn: `objdump -p binary | grep NEEDED` hoặc `readelf -d binary | grep NEEDED`.

> [!NOTE]
> **`strip` — Loại Bỏ Debug Symbols**:
> - **`strip --strip-all binary`**: Xóa toàn bộ `.symtab` và debug info. Giảm 50-90% kích thước binary.
> - **`strip --strip-debug binary`**: Chỉ xóa debug info, giữ `.symtab` — vẫn `nm` được.
> - Quy trình chuẩn: giữ binary chưa strip cho debug, deploy binary đã strip lên target.
> - Ví dụ: `cp main_app main_app.debug && strip --strip-all main_app`

> [!NOTE]
> **`c++filt` — Demangle Symbol Từ Command Line**:
> - Giải mã tên C++ mangled về dạng đọc được (tương tự `nm -C` nhưng dùng độc lập).
> - Hữu ích khi pipe output từ `objdump` hoặc đọc crash log.
> - Ví dụ: `echo "_ZN4MyNS3fooEi" | c++filt` → `MyNS::foo(int)`
> - Ví dụ: `objdump -d binary | c++filt` — disassembly với tên hàm đã demangle.

> [!NOTE]
> **`size` — Xem Kích Thước Từng Section**:
> - **`size binary`**: Hiển thị nhanh kích thước `.text`, `.data`, `.bss` và tổng.
> - Dùng để theo dõi binary size qua các lần build (quan trọng cho embedded có giới hạn flash).
> - Ví dụ: `size main_app` → `text: 12345  data: 678  bss: 90  total: 13113`

> [!NOTE]
> **`file` & `strings` — Kiểm Tra Nhanh Binary**:
> - **`file binary`**: Xác định loại file (ELF 64-bit, stripped/not stripped, dynamically linked, architecture).
> - **`strings binary`**: Trích xuất tất cả chuỗi text trong binary (tìm hardcoded paths, version strings, error messages).
> - Ví dụ: `file main_app` → `ELF 64-bit LSB executable, x86-64, dynamically linked`

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [man7.org: nm(1)](https://man7.org/linux/man-pages/man1/nm.1.html) | Danh mục cờ và ý nghĩa các ký tự Symbol Types (T, R, D, B, W, U) |
| [man7.org: c++filt(1)](https://man7.org/linux/man-pages/man1/c++filt.1.html) | Demangling symbols theo Itanium C++ ABI / GCC Name Mangling |
| [man7.org: objdump(1)](https://man7.org/linux/man-pages/man1/objdump.1.html) | Disassembly, Symbol table (`-t`), Section headers (`-h`) |
| [man7.org: readelf(1)](https://man7.org/linux/man-pages/man1/readelf.1.html) | Đọc trực tiếp ELF header, `.dynsym`, `.symtab`, relocation entries |
| [GNU Binutils Documentation](https://sourceware.org/binutils/docs/binutils/) | Hướng dẫn chính thức về bộ công cụ phân tích tệp nhị phân GNU |

---

### Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Lệnh Khuyên Dùng |
| :--- | :--- |
| Xem API công khai của `.so` | `nm -D -C lib.so` |
| Xem dependencies bên ngoài | `nm -D -u -C lib.so` |
| Debug nội bộ thư viện | `nm -C lib.so` |
| Tìm symbol chiếm nhiều nhất | `nm -C -S --size-sort lib.so \| tail -20` |
| So sánh 2 version `.so` | `diff <(nm -D -C v1.so \| sort) <(nm -D -C v2.so \| sort)` |
| Xem disassembly của hàm | `objdump -d -C binary \| grep -A 20 "<func>:"` |
| Liệt kê `.so` dependencies | `ldd binary` hoặc `readelf -d binary \| grep NEEDED` |
| Xem ELF sections | `readelf -S binary` |
| Demangle symbol | `echo "_ZN..." \| c++filt` |
| Giảm size binary cho deploy | `strip --strip-all binary` |
| Xem size từng section | `size binary` |
| Kiểm tra loại file & arch | `file binary` |
