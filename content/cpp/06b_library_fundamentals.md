# Nền Tảng Thư Viện C/C++ — Static, Dynamic, Loading & Troubleshooting

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp kiến thức nền tảng về thư viện C/C++ — từ cơ chế tạo Static/Dynamic library bằng tay, cross-platform DLL export, Dynamic Loading (`dlfcn.h`/`LoadLibrary`), Name Mangling, đến debug các lỗi link/load thường gặp.
>
> **Liên kết:**
> - CMake workflow → [`02_cmake_build_system.md`](./02_cmake_build_system.md)
> - ELF format, PLT/GOT, Symbol Visibility chi tiết → [`08_linking_internals.md`](./08_linking_internals.md)
> - Lệnh `nm` và phân tích symbol → [`nm_reading_symbols.md`](./nm_reading_symbols.md)
> - Cờ biên dịch GCC/G++ → [`gcc_gpp_flags_guide.md`](./gcc_gpp_flags_guide.md)

---

## 1. Quá Trình Build C/C++ — Từ Source Đến Binary

```
    .cpp / .c ── -E ──▶ .i (Preprocessed) ── -S ──▶ .s (Assembly) ── -c ──▶ .o (Object)
                                                                               │
                 ┌─────────────────────────────────────────────────────────────┤
                 │ ar rcs                                                      │ -shared -fPIC
                 ▼                                                             ▼
         .a (Static Library)                                           .so / .dll (Dynamic Library)
                 │                                                             │
                 └──────────────────▶ ld (Linker) ◀────────────────────────────┘
                                           │
                                           ▼
                                    ELF Executable
```

> [!NOTE]
> **Quy ước đặt tên thư viện:**
>
> | Hệ điều hành | Static | Dynamic | Import Lib (Windows) |
> |:--|:--|:--|:--|
> | Linux/macOS | `libfoo.a` | `libfoo.so` / `libfoo.dylib` | — |
> | Windows MinGW | `libfoo.a` | `foo.dll` | `libfoo.dll.a` |
> | Windows MSVC | `foo.lib` | `foo.dll` | `foo.lib` |
>
> **Quy ước `-l`:** Khi link `-lfoo`, linker tự tìm `libfoo.a` hoặc `libfoo.so` trong đường dẫn `-L`.

---

## 2. Static Library — Đóng Gói Object Files

> [!NOTE]
> **Tạo static library bằng tay:**
>
> ```bash
> # 1. Compile source thành object files:
> g++ -Wall -Wextra -Iinclude -c src/math_lib.cpp -o math_lib.o
>
> # 2. Đóng gói thành archive (.a):
> ar rcs libmath.a math_lib.o
> # r = insert/replace, c = create, s = index (ranlib)
>
> # 3. Link vào executable:
> g++ main.cpp -Iinclude -L. -lmath -o app
> ```
>
> **CMake tương đương:** `add_library(math STATIC src/math_lib.cpp)` — xem [`02_cmake §2`](./02_cmake_build_system.md).

---

## 3. Dynamic Library — Shared Object / DLL

### 3.1 Tạo Dynamic Library

> [!NOTE]
> **Linux/macOS:**
>
> ```bash
> # -fPIC = Position Independent Code (BẮT BUỘC cho .so)
> # -shared = tạo shared object thay vì executable
> g++ -shared -fPIC -o libmath.so src/math_lib.cpp -Iinclude
>
> # Link executable với .so:
> g++ main.cpp -Iinclude -L. -lmath -Wl,-rpath=. -o app
> # -Wl,-rpath=. : ghi đường dẫn tìm .so vào binary (không cần LD_LIBRARY_PATH)
> ```
>
> **Windows MinGW:**
>
> ```bash
> # Sinh .dll + import library (.dll.a):
> g++ -shared -o math.dll src/math_lib.cpp -Iinclude -Wl,--out-implib,libmath.dll.a
>
> # Link executable:
> g++ main.cpp -Iinclude -L. -lmath -o app.exe
> # Copy math.dll cùng thư mục app.exe khi chạy
> ```
>
> **CMake tương đương:** `add_library(math SHARED src/math_lib.cpp)` + `set_target_properties(math PROPERTIES VERSION 1.0.0 SOVERSION 1)` — xem [`02_cmake §2`](./02_cmake_build_system.md).

### 3.2 Tại Sao Cần `-fPIC`

> [!TIP]
> **Position Independent Code** cho phép `.so` được loader nạp vào **bất kỳ địa chỉ nào** trong virtual memory (ASLR). Code dùng **GOT (Global Offset Table)** thay vì hardcode địa chỉ tuyệt đối.
>
> Nếu quên `-fPIC`:
> - Linux: Lỗi `relocation R_X86_64_32S against symbol` khi link
> - Embedded: Binary chỉ chạy được ở 1 địa chỉ cố định → không an toàn
>
> Chi tiết PLT/GOT mechanism → [`08_linking_internals.md §3`](./08_linking_internals.md).

---

## 4. So Sánh Static vs Dynamic Library

> [!IMPORTANT]
> **Bảng so sánh toàn diện:**
>
> | Tiêu chí | Static (`.a` / `.lib`) | Dynamic (`.so` / `.dll`) |
> |:--|:--|:--|
> | Link khi nào | **Compile-time** — copy code vào binary | **Runtime** — loader tìm `.so` khi start |
> | Binary size | Lớn — chứa toàn bộ library code | Nhỏ — chỉ ghi tên library |
> | Runtime dependency | **Không** — self-contained | **Có** — cần `.so`/`.dll` trên target |
> | Memory sharing | Không — mỗi process copy riêng | **Có** — nhiều process share 1 bản trong RAM |
> | Update library | Phải **re-link** toàn bộ executable | Chỉ thay file `.so` (nếu ABI tương thích) |
> | Startup time | Nhanh (không resolve symbols) | Chậm hơn (loader phải resolve PLT/GOT) |
> | Security (ASLR) | Không (fixed addresses) | **Có** — địa chỉ randomized mỗi lần load |
> | Debugging | Dễ (1 binary, all symbols) | Khó hơn (symbols phân tán nhiều `.so`) |
>
> | Trường hợp sử dụng | Khuyên dùng |
> |:--|:--|
> | Embedded firmware, ECU | Static — zero runtime dependency |
> | Docker container, CLI tool | Static — self-contained deployment |
> | Desktop app (Qt, GTK) | Dynamic — share `.so` giữa apps |
> | Plugin system | Dynamic — load/unload runtime |
> | CI/CD shared library | Dynamic — update library không rebuild app |
>
> So sánh chi tiết hơn (ASLR, PLT/GOT) → [`08_linking_internals.md §2-§3`](./08_linking_internals.md).

---

## 5. DLL Export Macro — Cross-Platform Symbol Export

> [!NOTE]
> **Pattern chuẩn cho thư viện cross-platform (Linux + Windows):**
>
> ```cpp
> // my_library_export.h
> #ifdef _WIN32
>   #ifdef MY_LIB_EXPORTS
>     #define MY_LIB_API __declspec(dllexport)   // Build library → export
>   #else
>     #define MY_LIB_API __declspec(dllimport)   // Dùng library → import
>   #endif
> #else
>   #define MY_LIB_API __attribute__((visibility("default")))
> #endif
>
> // API header:
> MY_LIB_API int add(int a, int b);
> MY_LIB_API void process_frame(const uint8_t* data, size_t len);
> ```
>
> **CMake setup:**
>
> ```cmake
> add_library(mylib SHARED src/mylib.cpp)
> target_compile_definitions(mylib PRIVATE MY_LIB_EXPORTS)  # Chỉ khi BUILD library
> # Consumer tự động dùng dllimport (vì không define MY_LIB_EXPORTS)
> ```
>
> Chi tiết Symbol Visibility (`-fvisibility=hidden`) → [`08_linking_internals.md §4`](./08_linking_internals.md).

---

## 6. Name Mangling & `extern "C"`

> [!NOTE]
> **C++ Name Mangling:**
> Compiler C++ đổi tên hàm để hỗ trợ overload, namespace, class. Ví dụ:
>
> | Source code | Mangled symbol | Demangle |
> |:--|:--|:--|
> | `int add(int, int)` | `_Z3addii` | `add(int, int)` |
> | `MyNS::foo(int)` | `_ZN4MyNS3fooEi` | `MyNS::foo(int)` |
> | `std::vector<int>::push_back(int&&)` | `_ZNSt6vectorIiSaIiEE9push_backEOi` | ... |
>
> **Vấn đề:** `dlsym(handle, "add")` sẽ **KHÔNG** tìm thấy `_Z3addii` → lỗi tìm symbol.

> [!TIP]
> **Giải pháp: `extern "C"` tắt mangling:**
>
> ```cpp
> // Hàm export cho C caller hoặc dlsym:
> extern "C" {
>     int add(int a, int b) { return a + b; }
>     const char* get_version() { return "1.0.0"; }
> }
> // Symbol: "add", "get_version" — đúng tên, dlsym tìm được
> ```
>
> **Quy tắc:** Mọi hàm export ra ngoài cho `dlsym`/`GetProcAddress` hoặc gọi từ C → **BẮT BUỘC** `extern "C"`.
>
> Demangle bằng command line: `echo "_Z3addii" | c++filt` → `add(int, int)`.
> Chi tiết `nm -C` demangle → [`nm_reading_symbols.md`](./nm_reading_symbols.md).

---

## 7. Dynamic Loading — Runtime Library Loading

### 7.1 Linux: `dlfcn.h` (`dlopen` / `dlsym` / `dlclose`)

> [!NOTE]
> **Dynamic Loading Workflow:**
>
> ```c
> #include <stdio.h>
> #include <dlfcn.h>
>
> typedef int (*AddFunc)(int, int);
>
> int main() {
>     // 1. Mở library — RTLD_LAZY = resolve symbols khi gọi
>     void* handle = dlopen("./libcalc.so", RTLD_LAZY);
>     if (!handle) {
>         fprintf(stderr, "dlopen: %s\n", dlerror());
>         return 1;
>     }
>
>     // 2. Lấy địa chỉ hàm bằng tên (phải là extern "C")
>     dlerror();  // Xóa error cũ
>     AddFunc add = (AddFunc)dlsym(handle, "add");
>     char* error = dlerror();
>     if (error) {
>         fprintf(stderr, "dlsym: %s\n", error);
>         dlclose(handle);
>         return 1;
>     }
>
>     // 3. Gọi hàm như bình thường
>     printf("5 + 3 = %d\n", add(5, 3));
>
>     // 4. Đóng library
>     dlclose(handle);
>     return 0;
> }
> ```
>
> **Build:** `gcc main.c -ldl -o app` (link với `libdl`)
>
> | Hàm | Tác dụng |
> |:--|:--|
> | `dlopen(path, mode)` | Nạp `.so` vào process, trả handle |
> | `dlsym(handle, name)` | Tìm địa chỉ symbol theo tên (phải `extern "C"`) |
> | `dlclose(handle)` | Giải phóng library |
> | `dlerror()` | Trả chuỗi lỗi gần nhất (hoặc NULL) |
>
> **`RTLD_LAZY` vs `RTLD_NOW`:**
> - `RTLD_LAZY`: Resolve symbols khi gọi lần đầu (nhanh load, chậm lần gọi đầu)
> - `RTLD_NOW`: Resolve tất cả symbols ngay khi load (chậm load, predictable cho real-time)

### 7.2 Windows: `LoadLibrary` / `GetProcAddress`

> [!NOTE]
> **Windows Dynamic Loading:**
>
> ```cpp
> #include <windows.h>
> #include <iostream>
>
> typedef int (*AddFunc)(int, int);
>
> int main() {
>     HMODULE lib = LoadLibrary(TEXT("calc.dll"));
>     if (!lib) {
>         std::cerr << "LoadLibrary failed: " << GetLastError() << "\n";
>         return 1;
>     }
>
>     AddFunc add = (AddFunc)GetProcAddress(lib, "add");
>     if (!add) {
>         std::cerr << "GetProcAddress failed\n";
>         FreeLibrary(lib);
>         return 1;
>     }
>
>     std::cout << "5 + 3 = " << add(5, 3) << "\n";
>     FreeLibrary(lib);
>     return 0;
> }
> ```
>
> | Windows API | Tương đương Linux |
> |:--|:--|
> | `LoadLibrary(path)` | `dlopen(path, mode)` |
> | `GetProcAddress(lib, name)` | `dlsym(handle, name)` |
> | `FreeLibrary(lib)` | `dlclose(handle)` |
> | `GetLastError()` | `dlerror()` |

### 7.3 Use Case: Plugin Architecture

> [!TIP]
> **Plugin pattern phổ biến trong CV/ADAS:**
>
> ```cpp
> // plugin_interface.h — Interface chung cho tất cả plugins
> extern "C" {
>     typedef struct {
>         const char* (*get_name)();
>         void (*process)(const uint8_t* frame, int width, int height);
>         void (*cleanup)();
>     } PluginAPI;
>
>     PluginAPI* get_plugin_api();  // Mỗi .so export hàm này
> }
>
> // Host application load plugin:
> void* handle = dlopen("./plugins/edge_detect.so", RTLD_LAZY);
> auto get_api = (PluginAPI*(*)())dlsym(handle, "get_plugin_api");
> PluginAPI* plugin = get_api();
> plugin->process(frame_data, 1920, 1080);
> ```

---

## 8. Symbol Versioning (Nâng Cao)

> [!NOTE]
> **Quản lý nhiều phiên bản API trong cùng 1 `.so`:**
>
> ```text
> # version_script.map
> VERSION_1.0 {
>     global:
>         my_function_v1;
>     local:
>         *;              # Ẩn TẤT CẢ symbol khác
> };
>
> VERSION_2.0 {
>     global:
>         my_function_v2;
> } VERSION_1.0;          # Kế thừa từ VERSION_1.0
> ```
>
> ```bash
> # Build với version script:
> gcc -shared -o libmylib.so version.c -Wl,--version-script=version_script.map
>
> # Kiểm tra:
> readelf --dyn-syms libmylib.so
> ```
>
> **Mục đích:** Cho phép nâng cấp `.so` mà không break binary cũ — binary link với `VERSION_1.0` vẫn tìm được `my_function_v1`, binary mới dùng `my_function_v2`.
>
> Chi tiết `readelf` → [`08_linking_internals.md §1`](./08_linking_internals.md).

---

## 9. Tổ Chức Thư Viện C++ Thực Tế

> [!NOTE]
> **Project layout chuẩn công nghiệp:**
>
> ```
> my-cpp-library/
> ├── CMakeLists.txt          ← Top-level build (xem 02_cmake §5)
> ├── include/
> │   └── my_library/         ← Public headers (API cho user)
> │       ├── core.h
> │       ├── version.h
> │       └── export.h        ← DLL export macro (§5 ở trên)
> ├── src/
> │   ├── core.cpp            ← Implementation (PRIVATE)
> │   └── version.cpp
> ├── examples/
> │   └── basic_usage.cpp     ← Chỉ dùng public API từ include/
> ├── tests/
> │   ├── test_core.cpp
> │   └── test_version.cpp
> └── docs/
>     ├── api.md
>     └── getting_started.md
> ```
>
> **Checklist trước khi release:**
> - ✅ Header khai báo gì → source phải định nghĩa đúng y vậy
> - ✅ Example chỉ dùng API từ `include/` (không include `src/`)
> - ✅ Namespace thống nhất giữa header, source, example, test
> - ✅ README có lệnh build chạy được
> - ✅ Test build chung với library + chạy qua CTest

---

## 10. Lỗi Thường Gặp & Troubleshooting

### 10.1 `undefined reference to ...`

> [!CAUTION]
> **Lỗi xảy ra ở giai đoạn LINK, không phải compile.**
>
> | Nguyên nhân | Cách sửa |
> |:--|:--|
> | Header khai báo nhưng source chưa định nghĩa | Kiểm tra source có implement hàm |
> | Chưa link library | Thêm `-lfoo` hoặc `target_link_libraries()` |
> | Sai thứ tự link | Đặt library SAU object files: `g++ main.o -lfoo` |
> | C++ function gọi từ C (bị mangling) | Thêm `extern "C"` |
>
> **Debug:**
> ```bash
> # Kiểm tra symbol có trong library không:
> nm -D -C libfoo.so | grep "myFunction"
> # Kiểm tra file .o cần symbol nào:
> nm -C -u main.o | grep "myFunction"
> ```
> Chi tiết `nm` → [`nm_reading_symbols.md`](./nm_reading_symbols.md).

### 10.2 `cannot find -lfoo` / `library not found`

> [!CAUTION]
> | Nguyên nhân | Cách sửa |
> |:--|:--|
> | Sai đường dẫn `-L` | `ls` thư mục chứa library, sửa `-L./lib` |
> | Tên không đúng quy ước | File phải là `libfoo.a` (không phải `foo.a`) |
> | Library chưa build | Build library trước: `make` hoặc `cmake --build build` |

### 10.3 Không tìm thấy `.so` / `.dll` khi chạy

> [!CAUTION]
> **Binary build thành công nhưng crash khi chạy: `error while loading shared libraries`**
>
> **Linux:**
> ```bash
> # Kiểm tra dependency nào thiếu:
> ldd ./app
> # → libfoo.so => not found
>
> # Cách sửa (chọn 1):
> export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/path/to/lib  # Tạm thời
> # Hoặc link với rpath (vĩnh viễn):
> g++ main.cpp -L. -lfoo -Wl,-rpath=/opt/lib -o app
> # Hoặc cài system-wide:
> sudo cp libfoo.so /usr/local/lib && sudo ldconfig
> ```
>
> **Windows:**
> ```powershell
> # DLL phải ở 1 trong 3 nơi:
> # 1. Cùng thư mục .exe
> # 2. Trong PATH
> # 3. System32 (không khuyến khích)
> $env:PATH += ";C:\path\to\dll"
> ```

### 10.4 `dlsym: undefined symbol: myFunction`

> [!CAUTION]
> | Nguyên nhân | Cách sửa |
> |:--|:--|
> | Hàm C++ bị name mangling | Thêm `extern "C"` (xem §6) |
> | Symbol bị hidden (`-fvisibility=hidden`) | Thêm `__attribute__((visibility("default")))` hoặc export macro (xem §5) |
> | Sai tên symbol | Dùng `nm -D -C libfoo.so` để xem tên thật |

### 10.5 Inspect Tools Tổng Hợp

> [!TIP]
> **Bảng công cụ debug build/link/load:**
>
> | Lỗi | Công cụ | Lệnh |
> |:--|:--|:--|
> | `undefined reference` | `nm` | `nm -D -C lib.so \| grep func` |
> | Thiếu `.so` runtime | `ldd` | `ldd ./app` |
> | Xem symbol table | `readelf` | `readelf -s binary` |
> | Xem dependencies | `readelf` | `readelf -d binary \| grep NEEDED` |
> | Disassemble hàm | `objdump` | `objdump -d -C binary` |
> | Demangle symbol | `c++filt` | `echo "_Z3addii" \| c++filt` |
> | Xem binary type | `file` | `file binary` |
>
> Chi tiết đầy đủ → [`nm_reading_symbols.md`](./nm_reading_symbols.md), [`08_linking_internals.md §5`](./08_linking_internals.md).

---

## 11. Case Study: `dlsym` Trả Về `NULL` Do Thiếu `extern "C"` Trong Hệ Thống Plugin

> [!CAUTION]
> **Bối cảnh:** Hệ thống Autonomous Driving tải động các plugin giải mã cảm biến (`liblidar_decoder.so`, `libcamera_decoder.so`) lúc runtime bằng `dlopen()`. Developer viết hàm khởi tạo plugin `IPlugin* createPlugin()` trong shared library.
> **Triệu chứng:** `dlopen()` thành công nhưng khi gọi `dlsym(handle, "createPlugin")`, kết quả trả về `NULL`. Lệnh `dlerror()` in ra: `undefined symbol: createPlugin`.

### Phân tích nguyên nhân gốc (Root Cause)

Trình biên dịch C++ (`g++`) áp dụng kỹ thuật **Name Mangling** để hỗ trợ Function Overloading (nạp chồng hàm) và Namespace. Tên hàm `createPlugin()` trong bảng symbol của file ELF `.so` không còn giữ nguyên chuỗi `"createPlugin"` mà bị mã hóa thành chuỗi phức tạp như `_Z12createPluginv`.

```
┌────────────────────────────────────────────────────────┐
│ C++ Code:      createPlugin()                          │
│ Compiler:   ──▶ Bị Name Mangling thành: _Z12createPluginv│
│ dlsym call: ──▶ Tìm chuỗi "createPlugin"                │
│                 ──▶ Thất bại! Trả về NULL              │
└────────────────────────────────────────────────────────┘
```

Hàm `dlsym()` là C-API của hệ điều hành POSIX, chỉ tìm kiếm chuỗi ký tự thô khớp từng byte (raw symbol name matching) chứ không có khả năng tự động demangle tên hàm C++.

```cpp
// TRƯỚC: Biên dịch bằng g++ không có extern "C"
// Trong lidar_plugin.cpp:
IPlugin* createPlugin()
{
    return new LidarPlugin(); // Symbol bị đổi tên thành _Z12createPluginv
}

// Trong main.cpp:
void* handle = dlopen("./liblidar_plugin.so", RTLD_NOW);
auto factory = (IPlugin*(*)())dlsym(handle, "createPlugin"); // NULL!
```

Kiểm tra bằng công cụ `nm`:
```bash
nm -D liblidar_plugin.so | grep createPlugin
# 0000000000001150 T _Z12createPluginv  <-- Tên bị mangled!
```

### Giải pháp

Bao bọc hàm export của thư viện trong khối `extern "C"` để chỉ thị compiler xuất symbol theo chuẩn C ABI (không mangling tên hàm).

```cpp
// SAU: Khai báo extern "C" cho API nạp động
extern "C"
{
    IPlugin* createPlugin()
    {
        return new LidarPlugin(); // Symbol lưu trong .so chính xác là "createPlugin"
    }

    void destroyPlugin(IPlugin* plugin)
    {
        delete plugin; // Tránh lỗi giải phóng chéo heap giữa các module
    }
}
```

Kiểm tra lại bằng `nm`:
```bash
nm -D liblidar_plugin.so | grep createPlugin
# 0000000000001150 T createPlugin  <-- Khớp chính xác 100% với chuỗi tìm kiếm của dlsym!
```

> [!TIP]
> **Bài học rút ra:** Mọi hàm entry-point dành cho `dlsym()` (Linux) hoặc `GetProcAddress()` (Windows) BẮT BUỘC phải dùng `extern "C"`. Luôn cung cấp kèm hàm `destroyPlugin()` để giải phóng đối tượng trong cùng phân vùng cấp phát của thư viện.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [man7.org: dlopen(3)](https://man7.org/linux/man-pages/man3/dlopen.3.html) | Dynamic Loading API trên Linux (`dlopen`, `dlsym`, `dlclose`, `dlerror`) |
| [GCC Wiki: Visibility](https://gcc.gnu.org/wiki/Visibility) | Cơ chế Symbol Visibility (`-fvisibility=hidden`, `__attribute__((visibility))`) |
| [Microsoft Learn: dllexport, dllimport](https://learn.microsoft.com/en-us/cpp/cpp/dllexport-dllimport) | Quản lý Symbol Export/Import cho dynamic library trên Windows |
| *Computer Systems: A Programmer's Perspective (CS:APP)* — Chapter 7 | Static vs Dynamic Linking, Shared Libraries, Position Independent Code (PIC) |
| *C++ Core Guidelines* — Interfaces & Linkage (I.1 - I.30) | Quy tắc thiết kế Interface thư viện, C ABI compatibility với `extern "C"` |
| Lecturer Materials — `HUONG_DAN_HOC_CPP_BUILD_LIBRARY.md` | Quy chuẩn đóng gói thư viện C++, phân tách header/source/tests |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Lệnh / Kỹ Thuật |
| :--- | :--- |
| Tạo static library | `g++ -c src.cpp && ar rcs libfoo.a src.o` |
| Tạo dynamic library (Linux) | `g++ -shared -fPIC -o libfoo.so src.cpp` |
| Tạo dynamic library (Windows) | `g++ -shared -o foo.dll src.cpp -Wl,--out-implib,libfoo.dll.a` |
| Link static | `g++ main.cpp -L. -lfoo -o app` |
| Link dynamic + rpath | `g++ main.cpp -L. -lfoo -Wl,-rpath=. -o app` |
| Export hàm cho dlsym | `extern "C" { int add(int a, int b); }` |
| DLL export macro | `#ifdef _WIN32 __declspec(dllexport) #else __attribute__((visibility("default")))` |
| Dynamic load (Linux) | `dlopen()` → `dlsym()` → `dlclose()` (link `-ldl`) |
| Dynamic load (Windows) | `LoadLibrary()` → `GetProcAddress()` → `FreeLibrary()` |
| Debug `undefined reference` | `nm -D -C lib.so \| grep func` |
| Debug missing `.so` | `ldd ./app` → tìm `not found` |
