# Linking Internals — ELF Format, PLT/GOT, Symbol Visibility

> [!IMPORTANT]
> **Mục tiêu**:
> Đi sâu vào cơ chế linking, ELF format, dynamic loading (PLT/GOT), và symbol visibility control.
>
> **Liên kết:**
> - Thực hành tạo Static/Dynamic Library, Dynamic Loading, Troubleshooting → [`02b_library_fundamentals.md`](./02b_library_fundamentals.md)
> - CMake workflow → [`02_cmake_build_system.md`](./02_cmake_build_system.md)
> - Cờ biên dịch GCC/G++ → [`gcc_gpp_flags_guide.md`](./gcc_gpp_flags_guide.md)
> - Phân tích symbol bằng `nm` → [`nm_reading_symbols.md`](./nm_reading_symbols.md)

---

## 1. ELF Format Chi Tiết

```
┌────────────────────────────────────────────────────────┐
│                   ELF Binary Layout                    │
├────────────────────────────────────────────────────────┤
│  ELF Header (Magic numbers, Architecture, Entry point) │
├────────────────────────────────────────────────────────┤
│  Program Headers (Segments — Dùng cho OS Loader: RX/RW)│
├────────────────────────────────────────────────────────┤
│  .text       (Code thực thi nhị phân)                  │
│  .rodata     (Hằng số chỉ đọc, chuỗi ký tự)            │
│  .data       (Biến toàn cục/static đã khởi tạo)        │
│  .bss        (Biến chưa khởi tạo — cấp phát 0 trong RAM)│
│  .plt / .got (Dynamic Linker Tables cho shared libs)   │
├────────────────────────────────────────────────────────┤
│  Section Headers (Sections — Dùng cho Linker ld)       │
└────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Sections vs Segments:**
>
> | Tiêu chí | Sections (Linking View) | Segments (Execution View) |
> |:--|:--|:--|
> | Dùng bởi | **Linker** (`ld`) | **Loader** (kernel/`ld.so`) |
> | Số lượng | Nhiều (~20-30) | Ít (~5-8) |
> | Chứa gì | `.text`, `.data`, `.bss`, `.rodata`, `.symtab`... | Nhóm nhiều sections có cùng permission |
> | Permission | Không có | `R`, `RW`, `RX` |
>
> Ví dụ: Segment `LOAD (RX)` nhóm `.text` + `.rodata` (read + execute). Segment `LOAD (RW)` nhóm `.data` + `.bss` (read + write).

> [!NOTE]
> **`readelf` — Công cụ phân tích ELF:**
>
> | Lệnh | Tác dụng |
> |:--|:--|
> | `readelf -h binary` | Xem ELF header (entry point, architecture, type) |
> | `readelf -S binary` | Liệt kê tất cả sections (`.text`, `.data`, `.bss`...) |
> | `readelf -l binary` | Xem segments/program headers (permission map) |
> | `readelf -d binary` | Xem dynamic section (shared lib dependencies) |
> | `readelf -s binary` | Xem symbol table |
> | `readelf -r binary` | Xem relocation entries (PLT/GOT) |

---

## 2. Static Linking vs Dynamic Linking — Trade-offs Chi Tiết

> [!NOTE]
> **Bảng so sánh chi tiết:**
>
> | Tiêu chí | Static (`.a` / `.lib`) | Dynamic (`.so` / `.dll`) |
> |:--|:--|:--|
> | Linking time | Compile-time | Runtime |
> | Binary size | Lớn — copy toàn bộ library code vào executable | Nhỏ — chỉ ghi tên library |
> | Dependencies | **Không** — self-contained | **Có** — cần `.so`/`.dll` trên target |
> | Memory sharing | Không — mỗi process copy riêng | **Có** — nhiều process share 1 bản trong RAM |
> | Update library | Phải re-link toàn bộ executable | Chỉ thay file `.so` — không cần re-compile app |
> | Startup time | Nhanh hơn (không cần resolve symbols) | Chậm hơn (loader phải resolve) |
> | Security (ASLR) | Không (fixed addresses) | **Có** — địa chỉ randomized mỗi lần load |
>
> **Khi nào static:** Embedded firmware, Docker container, standalone tool. **Khi nào dynamic:** Desktop app, plugin system, shared libraries (Qt, OpenCV).
>
> Tạo static: `g++ -c files.cpp && ar rcs lib.a files.o`
> Tạo dynamic: `g++ -shared -fPIC -o lib.so files.o`
>
> Hướng dẫn tạo library từng bước (hands-on), DLL export macro, troubleshooting lỗi link → [`02b_library_fundamentals.md §2-§4, §10`](./02b_library_fundamentals.md).

---

## 3. Dynamic Linking Internals — PLT & GOT

```
    Caller Code                 PLT Entry                  GOT Entry             Dynamic Linker (ld.so)        Actual Func
         │                          │                          │                          │                          │
  (Lần 1: Lazy Binding)             │                          │                          │                          │
         ├─── 1. call func@plt ────▶│                          │                          │                          │
         │                          ├─── 2. jmp *GOT[n] ──────▶│                          │                          │
         │                          │                          ├─── 3. (Chưa resolve) ───▶│                          │
         │                          │                          │                          ├─── 4. Tìm địa chỉ thật ──┤
         │                          │                          │◀── 5. Ghi địa chỉ thật ──┤                          │
         │                          │                          │                          └─── 6. Nhảy thực thi ────▶│
         │                          │                          │                                                     │
  (Các lần gọi sau)                 │                          │                                                     │
         ├─── 1. call func@plt ────▶│                          │                                                     │
         │                          ├─── 2. jmp *GOT[n] ──────▶│                                                     │
         │                          │                          └─── 3. Nhảy thẳng đến địa chỉ đã lưu ───────────────▶│
```

> [!NOTE]
> **PLT/GOT Mechanism:**
> **Lần gọi đầu tiên (Lazy Binding):** Code gọi `printf@plt` → PLT stub nhảy tới GOT entry → GOT chưa resolve → gọi dynamic linker (`ld.so`) → linker tìm địa chỉ thật của `printf` → ghi vào GOT → nhảy tới `printf` thật.
>
> **Các lần gọi sau:** PLT stub → GOT entry (đã có địa chỉ thật) → nhảy thẳng, không cần linker.
>
> Liên hệ với `-fPIC` (Position Independent Code): code dùng GOT thay vì hardcode địa chỉ → cho phép load `.so` tại bất kỳ địa chỉ nào (ASLR compatible).
>
> **Non-lazy binding:** `LD_BIND_NOW=1` hoặc link với `-z now` → resolve hết khi startup → predictable latency cho real-time systems.

---

## 4. Symbol Visibility Control

> [!NOTE]
> **Symbol Visibility Pattern:**
>
> ```cpp
> // Compile với: g++ -fvisibility=hidden -shared -o libfoo.so foo.cpp
> // Mặc định: TẤT CẢ symbols bị ẩn
>
> // Macro export cho symbols cần public:
> #define API_EXPORT __attribute__((visibility("default")))
>
> class API_EXPORT MyPublicClass { /* ... */ }; // Được export
> class MyInternalClass { /* ... */ };            // ẨN — không ai nhìn thấy
>
> API_EXPORT void publicFunc();                    // Được export
> void internalFunc();                             // ẨN
> ```
>
> **Ưu điểm:** Giảm symbol table size, tăng tốc loading, tránh symbol clash giữa libraries. Tương tự `__declspec(dllexport)` trên Windows.
>
> Cross-platform export macro pattern (`__declspec` + `visibility`) → [`02b_library_fundamentals.md §5`](./02b_library_fundamentals.md).

---

## 5. Các Công Cụ Phân Tích Binary Bổ Sung

### 5.1 `objdump`

> [!NOTE]
> `objdump -d binary` (disassemble), `objdump -t binary` (symbol table), `objdump -h binary` (section headers), `objdump -d -j .plt binary` (xem PLT entries), `objdump -d -j .text binary` (chỉ disassemble section `.text`).

### 5.2 `readelf`

> [!NOTE]
> `readelf -a binary` (all info), `readelf -d binary` (dynamic section — xem `NEEDED` libraries), `readelf -V binary` (version info của symbol versioning).

### 5.3 `ldd`

> [!NOTE]
> `ldd binary` — liệt kê tất cả shared library dependencies và đường dẫn resolve. Nếu thấy `"not found"` → thiếu library trên hệ thống. Kiểm tra `LD_LIBRARY_PATH` hoặc cài đặt library.

> [!WARNING]
> **Không dùng `ldd` trên binary không tin cậy:**
> `ldd` thực thi binary để resolve dependencies → có thể bị exploit nếu binary chứa malicious code. Thay thế an toàn: `objdump -p binary | grep NEEDED`.

### 5.4 `strip`

> [!NOTE]
> `strip --strip-all binary` — loại bỏ debug symbols + symbol table, giảm 50-90% binary size. Dùng cho **production deploy**. Giữ bản có symbols riêng cho debug: `objcopy --only-keep-debug binary binary.dbg`.

### 5.5 `c++filt`

> [!NOTE]
> `echo "_ZN4MyNS3fooEi" | c++filt` → `MyNS::foo(int)`. Demangle C++ mangled symbols từ command line. Tương đương `nm -C` (demangle trong nm).

---

## 6. Case Study: PLT/GOT Lazy Binding Gây Latency Spike 50ms

> [!CAUTION]
> **Bối cảnh:** ADAS lane detection module dùng `libopencv_core.so` (dynamic library). Lần gọi đầu tiên `cv::resize()` mất **50ms** thay vì 2ms bình thường. Sau lần đầu, mọi lần gọi tiếp chỉ 2ms.
> **Triệu chứng:** Frame đầu tiên sau boot bị drop (vượt deadline 33ms ở 30fps). Profiling cho thấy bottleneck tại `_dl_runtime_resolve_xsavec` — dynamic linker đang resolve symbol.

**Root Cause:** PLT/GOT lazy binding — symbol chỉ được resolve lần gọi đầu tiên. `cv::resize` chuỗi resolve 8 symbol phụ thuộc → 50ms tổng.

```bash
# ✅ Fix: Force eager binding — resolve TẤT CẢ symbol lúc load
LD_BIND_NOW=1 ./adas_app

# Hoặc link-time:
g++ -Wl,-z,now main.cpp -lopencv_core -o adas_app
# Tăng startup time ~200ms nhưng LOẠI BỎ hoàn toàn latency spike runtime
```

> [!TIP]
> - **Real-time systems:** Luôn dùng `LD_BIND_NOW=1` hoặc `-Wl,-z,now` để có thời gian thực thi xác định (deterministic WCET). Lazy binding vi phạm yêu cầu real-time.
> - Kiểm tra: `readelf -d binary | grep BIND_NOW` → nếu thấy `BIND_NOW` = eager binding đã bật.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [Linux Foundation: System V ABI ELF](https://refspecs.linuxfoundation.org/elf/) | Đặc tả định dạng ELF (Executable and Linkable Format), Sections vs Segments |
| [man7.org: ld.so(8)](https://man7.org/linux/man-pages/man8/ld.so.8.html) | Dynamic Linker/Loader, Lazy Binding, `LD_BIND_NOW`, `LD_LIBRARY_PATH` |
| [man7.org: readelf(1)](https://man7.org/linux/man-pages/man1/readelf.1.html) | Đọc Section/Program headers, Relocations, Dynamic Symbol Table |
| [GCC Wiki: Visibility](https://gcc.gnu.org/wiki/Visibility) | Quy tắc ẩn symbol (`-fvisibility=hidden`) và tối ưu hóa dynamic export |
| *Computer Systems: A Programmer's Perspective (CS:APP)* — Chapter 7 (Linking) | Chi tiết cơ chế Relocation, Symbol Resolution, PLT/GOT |
| *Ian Lance Taylor: Linkers (20-part series)* | Cơ chế nội tại của Linker, Position Independent Code (PIC) |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Lệnh / Kỹ Thuật |
| :--- | :--- |
| Xem ELF header | `readelf -h binary` |
| Xem tất cả sections | `readelf -S binary` |
| Xem disassembly | `objdump -d binary` |
| Xem shared lib dependencies | `ldd binary` (hoặc `objdump -p \| grep NEEDED`) |
| Demangle C++ symbol | `c++filt` hoặc `nm -C` |
| Ẩn symbols trong .so | `-fvisibility=hidden` + `API_EXPORT` macro |
| Giảm binary size cho deploy | `strip --strip-all binary` |
| Xem PLT/GOT entries | `objdump -d -j .plt binary` |
