# Hệ Thống Build CMake — Kiến Trúc & Cẩm Nang Tra Cứu Toàn Diện

> [!IMPORTANT]
> **Mục tiêu**:
> Cẩm nang tra cứu và chuẩn mực kiến trúc Modern CMake chuẩn công nghiệp (Target-Centric Design): Quản lý quan hệ phụ thuộc (`PUBLIC`, `PRIVATE`, `INTERFACE`), cấu hình nạp thư viện động (`RPATH`), tích hợp công cụ kiểm thử (`CTest`, AddressSanitizer), biên dịch chéo (Cross-compilation) cho Automotive ECU và phân giải biểu thức sinh động (Generator Expressions).

---

## 1. Mô Hình Tư Duy: Make vs Modern CMake

Một sai lầm phổ biến là xem CMake như trình biên dịch. Thực tế, CMake là một **Meta-Build Generator**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: META-BUILD GENERATOR (CMake)                                   │
│ Đọc CMakeLists.txt ──▶ Phân tích Dependency Graph ──▶ Sinh script đích │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Configure: cmake -B build)
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: BUILD SYSTEM TOOL (Ninja / GNU Make / MSVC / Xcode)            │
│ Đọc build.ninja/Makefile ──▶ Theo dõi Timestamp ──▶ Gọi Compiler       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Build: cmake --build build)
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: TOOLCHAIN (GCC / Clang / MSVC)                                 │
│ Biên dịch mã nguồn ──▶ Liên kết nhị phân ──▶ File Thực thi / Thư viện  │
└────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **Quy tắc tuyệt đối của Modern CMake:**
> KHÔNG sử dụng các biến toàn cục (như `CMAKE_CXX_FLAGS`, `include_directories()`, `link_libraries()`) trừ khi bắt buộc. Mọi thao tác cấu hình **phải gắn vào một Target cụ thể** (Executable hoặc Library).

### 1.1 Bảng Phép Chiếu Song Song Cú Pháp (Makefile ↔ CMake)

| Ý Định Kỹ Thuật | Cách Viết Trong Makefile | Cách Viết Trong Modern CMake |
|:---|:---|:---|
| Khai báo Executable | `app: main.o`<br>`$(CXX) $^ -o $@` | `add_executable(app src/main.cpp)` |
| Khai báo Thư viện Tĩnh (.a) | `libmath.a: math.o`<br>`ar rcs $@ $^` | `add_library(math STATIC src/math.cpp)` |
| Khai báo Thư viện Động (.so)| `libmath.so: math.o`<br>`$(CXX) -shared -o $@ $^` | `add_library(math SHARED src/math.cpp)` |
| Đường dẫn Header (`-I`) | `CXXFLAGS += -Iinclude` | `target_include_directories(app PRIVATE include/)` |
| Cờ biên dịch (`-Wall`) | `CXXFLAGS += -Wall -Wextra` | `target_compile_options(app PRIVATE -Wall -Wextra)` |
| Chuẩn C++ (`-std=c++14`) | `CXXFLAGS += -std=c++14` | `target_compile_features(app PRIVATE cxx_std_14)` |
| Liên kết thư viện (`-l`) | `LDFLAGS += -lmath` | `target_link_libraries(app PRIVATE math)` |
| Tiêm Macro (`-D`) | `CXXFLAGS += -DDEBUG=1` | `target_compile_definitions(app PRIVATE DEBUG=1)` |
| Lệnh Dịch (Build) | `make -j8` | `cmake --build build -j 8` |

---

## 2. PHẦN 1: Môi Trường Đào Tạo & Dự Án Vừa (CMake 3.15+ / C++11/14)

### 2.1 Cấu Trúc Khởi Tạo Chuẩn (Project Boilerplate)

```cmake
cmake_minimum_required(VERSION 3.15)
project(CoreSystem 
    VERSION 1.0.0 
    DESCRIPTION "Core module for processing"
    LANGUAGES CXX
)

# Quy hoạch thư mục đầu ra (Output Directory Layout)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Tự động tạo file compile_commands.json cho IDE (clangd, VS Code)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
```

### 2.2 Quản Lý Target & Cơ Chế Lan Truyền (Transitive Usage)

Sự khác biệt giữa `PUBLIC`, `PRIVATE`, và `INTERFACE` là trái tim của Modern CMake:

```text
CƠ CHẾ LAN TRUYỀN THUỘC TÍNH
                         ┌───────────────────────────────┐
                         │   Thư Viện Gốc (math_lib)     │
                         └───────────────┬───────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
           [ PRIVATE ]             [ INTERFACE ]            [ PUBLIC ]
          (-Wall, -O3)        (Header-only, no source) (include/, cxx_std_14)
                 │                       │                       │
      Chỉ math_lib sử dụng         math_lib bỏ qua,         Cả math_lib và app
      app bên ngoài KHÔNG thấy     dành cho app kế thừa     đều kế thừa sử dụng
                 │                       │                       │
                 └───────────────┬───────┴───────────────────────┘
                                 │
                                 ▼
                         ┌───────────────────────────────┐
                         │   Ứng Dụng Đích (app_main)    │
                         │ target_link_libraries(app...) │
                         └───────────────────────────────┘
```

```cmake
add_library(math_static STATIC src/math.cpp)

# Header public (Cả file trong src/math.cpp và app ngoài đều cần include)
target_include_directories(math_static PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)

# Header private (Chỉ src/math.cpp được dùng, giấu kín với bên ngoài)
target_include_directories(math_static PRIVATE src/internal)

# Ép chuẩn ngôn ngữ (Tự động lan truyền cxx_std_14 sang các target phụ thuộc)
target_compile_features(math_static PUBLIC cxx_std_14)

# Cờ cảnh báo (Chỉ áp dụng khi build chính thư viện này)
target_compile_options(math_static PRIVATE -Wall -Wextra -Wpedantic)
```

### 2.3 Liên Kết Động (Shared Library), Bí Danh (Alias) và RPATH

```cmake
# Khai báo Shared Library
add_library(math_shared SHARED src/math.cpp)

# Bắt buộc mã độc lập vị trí (PIC) cho kiến trúc chia sẻ
set_target_properties(math_shared PROPERTIES 
    POSITION_INDEPENDENT_CODE ON
    OUTPUT_NAME "math"          # Sinh ra libmath.so
)

# Tạo Alias Namespace (Bảo vệ tên gọi, tránh trùng lặp biến)
add_library(Math::Shared ALIAS math_shared)

# Liên kết vào Executable
add_executable(app_dynamic src/main.cpp)
target_link_libraries(app_dynamic PRIVATE Math::Shared)

# Cấu hình RPATH: Cho phép nhị phân tự tìm libmath.so trong thư mục ../lib 
# (Tương đối so với vị trí của file chạy thực thi, không phụ thuộc LD_LIBRARY_PATH)
set_target_properties(app_dynamic PROPERTIES
    BUILD_WITH_INSTALL_RPATH TRUE
    INSTALL_RPATH "$ORIGIN/../lib:${CMAKE_BINARY_DIR}/lib"
)
```

### 2.4 Biểu Thức Sinh Động (Generator Expressions)

```cmake
target_compile_options(app_dynamic PRIVATE
    $<$<CONFIG:Debug>:-g -O0>
    $<$<CONFIG:Release>:-O3 -march=native>
)

target_compile_definitions(app_dynamic PRIVATE
    $<$<CONFIG:Debug>:DEBUG_MODE=1 LOG_LEVEL="VERBOSE">
    $<$<CONFIG:Release>:NDEBUG>
)
```

### 2.5 Tích Hợp AddressSanitizer (Bắt lỗi bộ nhớ)

```cmake
option(ENABLE_ASAN "Enable AddressSanitizer for memory leak detection" OFF)

if(ENABLE_ASAN)
    message(STATUS "AddressSanitizer is ENABLED")
    add_compile_options(-fsanitize=address -g -fno-omit-frame-pointer)
    add_link_options(-fsanitize=address)
endif()
```

### 2.6 Hạ Tầng Kiểm Thử (CTest)

```cmake
enable_testing()

add_executable(test_suite tests/test_math.cpp)
target_link_libraries(test_suite PRIVATE Math::Static)

add_test(
    NAME MathUnitTests
    COMMAND test_suite
)
```

### 2.7 Case Study: Xử Lý Lỗi Linker "undefined reference" Do Thứ Tự Nạp Thư Viện Tĩnh

> [!CAUTION]
> **Bối cảnh:** Dự án hệ thống âm thanh xe hơi (Audio Subsystem) gồm 3 thư viện tĩnh: `libcodec.a` cần gọi giải thuật lọc tín hiệu từ `libdsp.a`, `libdsp.a` cần hàm tính toán từ `libmath.a`. Khi liên kết vào ứng dụng chính `media_player`, CMake báo lỗi linker.
> **Triệu chứng:** Toàn bộ mã nguồn `.cpp` biên dịch thành `.o` thành công 100%, nhưng tại bước link nhị phân xuất hiện hàng chục lỗi `undefined reference to 'dsp::filter(...)'`.

```cmake
# TRƯỚC (Lỗi): Khai báo thủ công thứ tự link vi phạm nguyên tắc Single-Pass của GNU ld
target_link_libraries(media_player PRIVATE
    math    # libmath.a
    dsp     # libdsp.a
    codec   # libcodec.a (LỖI: codec cần dsp nhưng dsp đã bị ld quét qua từ trước!)
)
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ QUÉT SINGLE-PASS CỦA LINKER (GNU LD) TRÊN STATIC ARCHIVES (.A)       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Trình tự sai: math ──▶ dsp ──▶ codec                                     │
│    ld quét math: Không có symbol chưa giải quyết. Bỏ qua math.              │
│    ld quét dsp:  Không có symbol chưa giải quyết. Bỏ qua dsp.               │
│    ld quét codec: Yêu cầu 'dsp::filter' ──▶ Không tìm lại dsp được nữa!     │
│    == LỖI: undefined reference to 'dsp::filter' ==                          │
│                                                                             │
│ 2. Modern CMake Target-Centric Graph:                                       │
│    target_link_libraries(codec PUBLIC dsp) ──▶ CMake tự động suy diễn       │
│    Thứ tự liên kết chuẩn xác tuyệt đối: codec ──▶ dsp ──▶ math              │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cmake
# SAU (Khắc phục): Khai báo quan hệ phụ thuộc trực tiếp giữa các Target (Target-Centric)
# Trong dsp/CMakeLists.txt:
target_link_libraries(dsp PUBLIC math)

# Trong codec/CMakeLists.txt:
target_link_libraries(codec PUBLIC dsp)

# Trong root CMakeLists.txt:
# Chỉ cần liên kết target đầu cuối, CMake tự động giải quyết đồ thị phụ thuộc (DAG)
target_link_libraries(media_player PRIVATE codec)
# CMake sinh lệnh link chuẩn: -lcodec -ldsp -lmath (Giải quyết triệt để 100% undefined reference)
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Trong liên kết thư viện tĩnh (`.a`), trình liên kết GNU `ld` quét theo thứ tự một chiều từ trái sang phải. Một thư viện nằm trước không thể giải quyết symbol cho một thư viện nằm sau nó.
> - Bằng cách gắn quan hệ `PUBLIC` giữa các thư viện trong Modern CMake, CMake tự động tính toán đồ thị có hướng không chu trình (Directed Acyclic Graph - DAG) và sắp xếp thứ tự link chính xác, loại bỏ hoàn toàn việc phải đoán thứ tự bằng tay.

---

## 3. PHẦN 2: Triển Khai Thực Tế (CMake 3.28+ / C++17/20)

### 3.1 Quản Lý Dependency: `find_package` vs `FetchContent`

```cmake
# Cách 1: Sử dụng thư viện đã có trong hệ thống (find_package)
find_package(OpenCV REQUIRED COMPONENTS core imgproc highgui)
add_executable(vision_app src/vision.cpp)
target_link_libraries(vision_app PRIVATE ${OpenCV_LIBS})

# Cách 2: Tự động tải từ Github lúc Configure (FetchContent)
include(FetchContent)
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)
FetchContent_MakeAvailable(googletest)
```

### 3.2 Cấu Hình Biên Dịch Chéo (Cross-compilation Toolchain)

```cmake
# File: toolchain-aarch64.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

set(CMAKE_C_COMPILER   aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_SYSROOT /opt/sysroot/aarch64)

# Ép find_package() tuân thủ luật lệ:
# - KHÔNG tìm các executable host (tránh nạp nhầm binary x86_64)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
# - CHỈ tìm thư viện (.a, .so) và header (.h) trong Sysroot của Target ARM
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

### 3.3 Case Study: Xung Đột Nhị Phân Host-Target Khi Cross-Compile Cho NXP i.MX8 Automotive ECU

> [!CAUTION]
> **Bối cảnh:** Biên dịch ứng dụng ADAS sử dụng OpenCV cho bo mạch vi xử lý NXP i.MX8 (ARM64 Cortex-A53) trên máy trạm x86_64 Ubuntu.
> **Triệu chứng:** Quá trình `cmake -B build` thành công, nhưng khi chạy `cmake --build build`, linker báo lỗi chí mạng: `/usr/lib/x86_64-linux-gnu/libopencv_core.so: file class ELFCLASS64 format not recognized` hoặc `incompatible target architecture`.

```cmake
# TRƯỚC (Lỗi): Không cô lập sysroot, find_package nạp nhầm thư viện x86_64 của Host!
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)

# LỖI NGUY HIỂM: Thiếu cấu hình CMAKE_FIND_ROOT_PATH_MODE_LIBRARY!
# Khi gọi find_package(OpenCV), CMake lùng sục trong /usr/lib của máy host x86_64
# và nạp file libopencv_core.so x86_64 vào lệnh link của trình biên dịch ARM64!
find_package(OpenCV REQUIRED)
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SỰ CỐ NHẦM LẪN SYSROOT TRONG BIÊN DỊCH CHÉO (CROSS-COMPILATION)             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Máy Host (x86_64):     /usr/lib/libopencv_core.so (x86 ELF 64-bit)          │
│ Bo mạch Đích (ARM64):  /opt/sysroot/aarch64/usr/lib/libopencv_core.so (ARM) │
│                                                                             │
│ Không có Root Mode Isolation:                                               │
│ CMake find_package() ──▶ Nạp nhầm /usr/lib (x86) ──▶ aarch64-ld báo lỗi!    │
│                                                                             │
│ Khi có CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY:                              │
│ CMake find_package() ──▶ Bị ép CHỈ quét trong /opt/sysroot/aarch64 (ARM)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cmake
# SAU (Khắc phục): Thiết lập Toolchain File cô lập hoàn toàn môi trường mục tiêu
# File: cmake/toolchain-imx8.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

# 1. Chỉ định rõ tiền tố cross-compiler
set(CROSS_COMPILE_PREFIX "aarch64-linux-gnu-")
set(CMAKE_C_COMPILER   "${CROSS_COMPILE_PREFIX}gcc")
set(CMAKE_CXX_COMPILER "${CROSS_COMPILE_PREFIX}g++")

# 2. Khai báo đường dẫn Sysroot chuẩn của mục tiêu ARM
set(TARGET_SYSROOT "/opt/imx8_sdk/sysroots/aarch64-poky-linux")
set(CMAKE_SYSROOT ${TARGET_SYSROOT})
set(CMAKE_FIND_ROOT_PATH ${TARGET_SYSROOT})

# 3. KHOÁ CHẶT KHÔNG GIAN TÌM KIẾM (Search Path Isolation):
# Chỉ tìm header và thư viện (.a/.so) bên trong sysroot của ARM
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Trong môi trường nhúng ô tô (Automotive Yocto / PetaLinux SDK), việc để lọt bất kỳ thư viện hoặc header nào của máy phát triển x86_64 vào bản build của ARM sẽ dẫn tới lỗi xung đột định dạng ABI hoặc lỗi crash âm thầm do khác biệt căn chỉnh byte (Memory Alignment).
> - Luôn luôn truyền `CMAKE_TOOLCHAIN_FILE` qua lệnh CLI ngay từ lần khởi tạo cấu hình đầu tiên: `cmake -B build -DCMAKE_TOOLCHAIN_FILE=cmake/toolchain-imx8.cmake`.

---

## Tài Liệu Tham Khảo Nguyên Bản (Ground Truth)

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [CMake Documentation (Master)](https://cmake.org/cmake/help/latest/) | Đặc tả chuẩn, Policy, Modules và Properties. |
| [CMake: target_link_libraries](https://cmake.org/cmake/help/latest/command/target_link_libraries.html) | Quản lý quan hệ phụ thuộc `PUBLIC`, `PRIVATE`, `INTERFACE`. |
| [CMake: Generator Expressions](https://cmake.org/cmake/help/latest/manual/cmake-generator-expressions.7.html) | Biểu thức sinh động `<CONFIG:...>`, `<PLATFORM_ID:...>`. |
| [CMake 3.28 Release Notes](https://cmake.org/cmake/help/latest/release/3.28.html) | Đặc tả hỗ trợ Native C++20 Modules. |
| *Professional CMake: A Practical Guide* | Kiến trúc phân tách thư mục, quản lý vòng đời build. |
| CppCon 2017: "Modern CMake for Modular Design" | Cơ sở lý thuyết của **Target-Centric Design**. |

---

## Bảng Tra Cứu Nhanh CMake CLI (Cheatsheet)

### 1. Thao tác Sinh & Dịch (Configure & Build)
| Lệnh | Ý nghĩa cơ chế |
|:---|:---|
| `cmake -B build` | Cấu hình dự án (Configure), sinh thư mục `build/`. |
| `cmake -B build -G Ninja` | Sinh script build bằng **Ninja** (Cực nhanh, thay vì Makefile). |
| `cmake --build build` | Gọi công cụ build ngầm định để dịch mã nguồn. |
| `cmake --build build -j 8` | Dịch mã nguồn bằng 8 luồng song song (như `make -j8`). |
| `cmake --build build --clean-first`| Dọn dẹp object files (Clean) trước khi dịch lại từ đầu. |
| `cmake --install build` | Cài đặt các nhị phân/thư mục header vào hệ thống (prefix mặc định `/usr/local`). |

### 2. Truyền Biến Từ CLI (Command Line Arguments)
| Lệnh / Flag | Ý nghĩa cơ chế |
|:---|:---|
| `-DCMAKE_BUILD_TYPE=Release` | Gán biến `CMAKE_BUILD_TYPE`. |
| `-DCMAKE_INSTALL_PREFIX=/opt/app` | Chỉ định thư mục đích cho lệnh cài đặt `install()`. |
| `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`| Bắt buộc sinh file hỗ trợ cho IDE IntelliSense. |
| `-DBUILD_SHARED_LIBS=ON` | Biến toàn cục ép các lệnh `add_library()` mặc định sinh `.so`. |

### 3. Gỡ Lỗi Quá Trình Build (Debugging CMake)
| Lệnh | Ý nghĩa cơ chế |
|:---|:---|
| `cmake --build build --verbose` | In toàn bộ lệnh gọi `gcc`/`clang` ngầm định (xem chính xác cờ đã truyền). |
| `cmake --trace-source=CMakeLists.txt`| In ra từng dòng CMakeLists.txt được thực thi (giống `bash -x`). |
| `ccmake -B build` | Giao diện TUI (Terminal UI) chỉnh sửa các biến Cache tương tác. |
| `ctest --test-dir build --rerun-failed`| Chỉ chạy lại các Unit Test đã báo lỗi ở lần trước. |
