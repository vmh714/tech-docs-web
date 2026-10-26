# 📘 C++ CORE MASTER SUMMARY & LOOKUP GUIDE (C++11 / C++14 / C++17 / C++20)

> **Mục đích:** Tài liệu này là **Cẩm nang Tra cứu Nhanh Chuẩn mực (Master Lookup & Cheat-Sheet)** hệ thống hóa toàn bộ kiến thức C++ Core, kiến trúc lập trình nhúng (Embedded Systems), Computer Vision và hệ thống an toàn Automotive ECU.  
> 
> ⚙️ **Định vị Chuẩn Cơ sở (Baseline Standard):** Tài liệu thiết lập **C++11 / C++14 làm nền tảng cốt lõi (Core Baseline)** cho các dự án bảo trì (Maintenance) và hệ thống ECU an toàn (AUTOSAR Classic CP / MISRA C++:2008 / AUTOSAR C++14), đồng thời cung cấp lộ trình nâng cấp (Upgrade Path) và **Bảng Giải pháp Thay thế (Legacy Workarounds)** khi không có C++17/C++20.  
> 
> Nội dung được tổ chức theo **5 Tầng Kiến trúc Hệ thống (5 Tiers)** bao bọc **12 Khối Trụ Cột (12 Core Pillars)**, tối đa hóa mật độ từ khóa kỹ thuật (High-Density Keywords), trực quan hóa bằng Sơ đồ tư duy (Mental Models), chỉ rõ các Bẫy lập trình thực chiến (Gotchas & Hazards) và đối chiếu chi tiết đến 20 Bài tập lớn (Assignments).

---

## <span id="architecture">🏛️ TỔNG QUAN KIẾN TRÚC 5 TẦNG & 12 TRỤ CỘT C++ CORE</span>

* 🏗️ **TẦNG 1: FOUNDATIONS (Nền tảng Biên dịch & Hệ thống Kiểu)**
  * [**Pillar 1**](#pillar-1): Compilation, Linking, ODR, ABI & Build Systems
  * [**Pillar 2**](#pillar-2): C++ Type System, Conversion & Initialization
* 💾 **TẦNG 2: DATA & LIFETIME (Bộ nhớ, Vòng đời Đối tượng & Cơ chế Hàm)**
  * [**Pillar 3**](#pillar-3): Pointers, References, Allocation & Object Lifetime
  * [**Pillar 4**](#pillar-4): Functions, Callables & Value Categories
* 🏛️ **TẦNG 3: OBJECT & LOGIC (Mô hình Đối tượng, RAII & Mẫu Thiết kế)**
  * [**Pillar 5**](#pillar-5): RAII, Copy/Move & Special Member Functions
  * [**Pillar 6**](#pillar-6): Classes, Inheritance, Polymorphism & Object Model
* ⚡ **TẦNG 4: MODERN & STL (Lập trình Tổng quát & Bộ Thư viện Chuẩn)**
  * [**Pillar 7**](#pillar-7): Templates, SFINAE & Generic Programming
  * [**Pillar 8**](#pillar-8): STL Architecture: Containers, Iterators & Algorithms
  * [**Pillar 9**](#pillar-9): Modern C++ Vocabulary Types
* 🛡️ **TẦNG 5: SYSTEMS & CONCURRENCY (Hệ thống, Đa luồng & Tối ưu Real-Time)**
  * [**Pillar 10**](#pillar-10): Concurrency, C++ Memory Model & Atomics
  * [**Pillar 11**](#pillar-11): Error Handling, Exceptions & File I/O
  * [**Pillar 12**](#pillar-12): Performance, Undefined Behavior & Data-Oriented Design
* 🚗 **TẦNG MỞ RỘNG: APPLICATION FRAMEWORKS, AUTOMOTIVE SYSTEMS & VIVA CHALLENGE**
  * [**Qt Core & MOC**](./knowledge/17_qt_core_moc_architecture.md): Meta-Object System, QObject Tree, Signals & Slots
  * [**Qt Multithreading**](./knowledge/18_qt_multithreading_event_loop.md): Event Loop, QThread, Worker Pattern + `moveToThread()`
  * [**Qt QML & MVVM**](./knowledge/19_qt_qml_cpp_integration.md): C++ Integration, Q_PROPERTY, QAbstractListModel, Scene Graph
  * [**Qt6 MVVM Cockpit**](./knowledge/20_qt6_qml_mvvm_cockpit.md): Qt 6.8 Cockpit, Virtual Scrolling, Vietnamese Unicode Diacritics
  * [**Automotive State Machine & EventBus**](./knowledge/21_automotive_state_machine_eventbus.md): Deterministic State Pattern, Zero-Heap EventBus, Bounded Ring Buffer
  * [**Mock Project Roadmap & Viva Bank**](./knowledge/22_mock_project_roadmap_viva_bank.md): Blank-Screen Challenge, 100+ Automotive C++ Viva Interview Questions

---

## <span id="compatibility">🔄 BẢNG MA TRẬN TƯƠNG THÍCH CHUẨN C++11 / C++14 (LEGACY BASELINE & WORKAROUND MATRIX)</span>

> Bảng dưới đây hỗ trợ tra cứu nhanh giải pháp tương đương khi dự án bảo trì bị giới hạn ở trình biên dịch **C++11** hoặc **C++14** (ví dụ: Green Hills MULTI, Tasking TriCore, QNX 6.6, GCC 4.8 / 5.4, AUTOSAR Classic R20-11):

| Tính năng Hiện đại (Modern C++17/20) | Chuẩn | Giải pháp Tương đương trên C++11 / C++14 (Legacy Workaround) | Ghi chú Rủi ro & Tối ưu |
| :--- | :---: | :--- | :--- |
| `if constexpr` (Compile-time Branch) | C++17 | **SFINAE** (`std::enable_if_t`) hoặc **Tag Dispatching** (`std::true_type`/`false_type`). | SFINAE làm tăng thời gian compile; Tag Dispatching dễ debug hơn. |
| `std::string_view` (Zero-Copy String) | C++17 | Cặp `const char* ptr` + `size_t len`, hoặc tự viết `StringRef` struct. | Không tự kết thúc `\0`, cấm truyền thẳng vào `printf("%s")`. |
| `std::span<T>` (Contiguous Buffer View)| C++20 | Mảng tham chiếu `T (&arr)[N]`, hoặc con trỏ `const T*` + `size_t len`. | Tránh Array Decay; bọc an toàn mảng DMA/V4L2 camera. |
| `std::optional<T>` (Nullable Type) | C++17 | `std::pair<bool, T>`, con trỏ `nullptr` (nếu là object), hoặc `boost::optional`. | Lưu in-place; kiểm tra `.first` trước khi lấy `.second`. |
| `std::variant<Types...>` (Tagged Union) | C++17 | **Manual Tagged Union**: `struct { TagEnum type; union { T1 a; T2 b; }; };`. | Phải tự viết Destructor gọi đúng trường union đang kích hoạt. |
| `std::scoped_lock` (Multi-Mutex Lock) | C++17 | `std::lock(m1, m2); std::lock_guard<std::mutex> l1(m1, std::adopt_lock);`. | Bắt buộc dùng `adopt_lock` để tránh khóa lại (Double Lock). |
| `std::make_unique<T>()` | C++14 | Tự định nghĩa template helper `make_unique` bằng `std::forward` trong C++11. | C++11 chuẩn bị thiếu `make_unique` dù đã có `std::unique_ptr`. |
| `std::shared_mutex` (Read-Write Lock) | C++17 | `std::shared_timed_mutex` trong **C++14**, hoặc `pthread_rwlock_t` trong **C++11**. | Cho phép nhiều Reader đồng thời, 1 Writer độc quyền. |
| `operator<=>` (Three-way Comparison) | C++20 | Tự viết nạp chồng 2 toán tử cơ sở: `operator<` và `operator==`. | Tự suy diễn các toán tử `>`, `<=`, `>=`, `!=` từ 2 toán tử trên. |
| `constexpr` Functions (Loop & If) | C++14 | Trong **C++11**, `constexpr` chỉ được chứa **đúng 1 lệnh `return`** (dùng đệ quy & toán tử 3 ngôi `? :`). | C++14 gỡ bỏ hạn chế, cho phép vòng lặp `for`, biến cục bộ. |
| `consteval` & `constinit` | C++20 | Dùng `constexpr` kết hợp `static_assert` hoặc macro `#define` tĩnh. | Đảm bảo giá trị hằng số được nhúng thẳng vào Flash `.rodata`. |
| `std::bit_cast<To, From>` (Type Punning)| C++20 | `std::memcpy(&dest, &src, sizeof(dest));` (Compiler tự optimize thành 0-cost). | An toàn Strict Aliasing; cấm dùng `*(reinterpret_cast<To*>(&src))`. |

---

## <span id="matrix">🗺️ MA TRẬN ĐỐI CHIẾU KIẾN THỨC & BÀI TẬP (MASTER MAPPING MATRIX)</span>

| Tầng (Tier) | Pillar | Chủ đề Trọng tâm (Core Pillar) | Chuẩn | Trọng tâm Kiến thức & Từ khóa Tra cứu | Assignment & Knowledge Mapping |
| :---: | :---: | :--- | :---: | :--- | :--- |
| **T1** | [**P1**](#pillar-1) | **Compilation, Linking, ODR, ABI & Build Systems** | C++11$\rightarrow$20 | Pipeline biên dịch, Translation Unit, ODR, Linkage (`static`/`extern`), `inline`, Symbol Table (`nm`), PLT/GOT, `LD_BIND_NOW=1`, `-fPIC`, Dynamic Loading (`dlopen`), `RPATH`/$ORIGIN, CMake, Makefile (`-MMD -MP`), Linker Script, Cross-Compile. | • **Ass 1, 2, 3, 5**<br>• **Ass 4** (Ex 1-4)<br>• **Ass 6** (Ex 1-4)<br>📖 [06_cmake](./knowledge/06_cmake_build_system.md) • [06b_library](./knowledge/06b_library_fundamentals.md) • [06c_flags](./knowledge/06c_gcc_gpp_flags_guide.md) • [06d_ninja](./knowledge/06d_ninja_build_system.md) • [07b_linking](./knowledge/07b_linking_internals.md) • [07c_nm](./knowledge/07c_nm_reading_symbols.md) |
| **T1** | [**P2**](#pillar-2) | **C++ Type System, Conversion & Initialization** | C++11$\rightarrow$20 | 5 Hình thức Khởi tạo (`int x{}` vs `int x(0)` vs `int x=0`), Narrowing Prevention, `signed`/`unsigned` Overflow UB, `const`, `constexpr` (C++11/14), `consteval`, `constinit`, `explicit`, 4 loại Cast, `std::bit_cast`. | • **Ass 4, 9**<br>• **Ass 20** (Ex 1)<br>📖 [05_modern_cpp](./knowledge/05_modern_cpp_features.md) • [09_rtti](./knowledge/09_rtti_dynamic_cast.md) |
| **T2** | [**P3**](#pillar-3) | **Pointers, References, Allocation & Object Lifetime** | C++11$\rightarrow$20 | **Object $\neq$ Memory Block**, 5 Giai đoạn Vòng đời, Storage Duration, Process Memory Layout (Text/Data/BSS/Heap/Stack), Array Decay `T (&arr)[N]`, `volatile` MMIO, Placement `new`, `std::launder`, Smart Pointers, Custom Deleter, `alignas(64)`, Memory Pool, PMR Arena. | • **Ass 7** (Ex 1-4)<br>• **Ass 8** (Ex 1-4)<br>📖 [01_memory_model](./knowledge/01_memory_model_pointers.md) • [15_pmr](./knowledge/15_pmr_allocators_embedded_memory.md) |
| **T2** | [**P4**](#pillar-4) | **Functions, Callables & Value Categories** | C++11$\rightarrow$20 | Value Categories (`lvalue`, `prvalue`, `xvalue`), Overload Resolution, RVO/NRVO, C++17 Mandatory Copy Elision, Universal Reference `T&&`, Reference Collapsing, `std::forward`, Functors, Lambdas, `std::invoke`, `std::function`, `decltype`. | • **Ass 9** (Ex 1-4)<br>📖 [05_modern_cpp](./knowledge/05_modern_cpp_features.md) |
| **T3** | [**P5**](#pillar-5) | **RAII, Copy/Move & Special Member Functions** | C++11$\rightarrow$20 | RAII, Ma trận tự sinh Special Members (Rule of 0/3/5, `noexcept` Move Contract), Copy-and-Swap Idiom, Operator Overloading (`<=>`), Static Initialization Order Fiasco (Meyers' Singleton). | • **Ass 11** (Ex 1-4)<br>📖 [01_memory_model](./knowledge/01_memory_model_pointers.md) • [02_oop_deep](./knowledge/02_oop_deep.md) |
| **T3** | [**P6**](#pillar-6) | **Classes, Inheritance, Polymorphism & Object Model** | C++11$\rightarrow$20 | C++ Object Memory Layout (`vptr`/`vtable`), ABC & Pure Virtual, Virtual Destructor Rule, **CRTP Static Polymorphism**, Covariant Returns, NVI Idiom, PIMPL Idiom (ABI Firewall), Factory, Strategy, State, Command (`undo`), Observer, DI vs Singleton. | • **Ass 12, 13, 14**<br>• **Ass 17, 19**<br>📖 [02_oop_deep](./knowledge/02_oop_deep.md) • [12_patterns](./knowledge/12_design_patterns.md) • [09_rtti](./knowledge/09_rtti_dynamic_cast.md) • [21_state_eventbus](./knowledge/21_automotive_state_machine_eventbus.md) |
| **T4** | [**P7**](#pillar-7) | **Templates, SFINAE & Generic Programming** | C++11$\rightarrow$20 | Requirements $\rightarrow$ Concepts $\rightarrow$ Constraints, Two-phase lookup, Template Specialization, `if constexpr` (C++17) vs SFINAE (C++11), `<type_traits>`, Variadic Templates & Fold Expressions, C++20 Concepts, Template Bloat. | • **Ass 15** (Ex 1-4)<br>📖 [08_templates](./knowledge/08_template_metaprogramming.md) • [14_concepts_ranges](./knowledge/14_cpp20_concepts_ranges_coroutines.md) |
| **T4** | [**P8**](#pillar-8) | **STL Architecture: Containers, Iterators & Algorithms** | C++11$\rightarrow$20 | Mô hình 3 tầng STL (Container $\rightarrow$ Iterator $\rightarrow$ Algorithm), Sequence vs Associative vs Unordered, Iterator Invalidation, Bẫy `vector<bool>`, Cache Locality, Core Algorithms (`sort`, `transform`, `accumulate`), Ranges. | • **Ass 7, 8, 10**<br>• **Ass 20** (Ex 1-3)<br>📖 [03_stl](./knowledge/03_stl_containers_algorithms.md) • [15_pmr](./knowledge/15_pmr_allocators_embedded_memory.md) |
| **T4** | [**P9**](#pillar-9) | **Modern C++ Vocabulary Types** | C++11$\rightarrow$20 | Zero-Copy Views (`string_view`, `span`), `std::optional`, `std::variant` + `std::visit` Pattern Matching, `std::any`, `std::tuple`, Structured Binding, `std::reference_wrapper` & Workarounds C++11. | • **Ass 9, 10, 15**<br>📖 [05_modern_cpp](./knowledge/05_modern_cpp_features.md) • [13_span_string_view](./knowledge/13_span_string_view_heterogeneous.md) |
| **T5** | [**P10**](#pillar-10) | **Concurrency, C++ Memory Model & Atomics** | C++11$\rightarrow$20 | `std::thread`/`jthread`, Mutex, `scoped_lock` vs C++11 `lock`, Condition Variable, `std::atomic`, Happens-Before, 5 Memory Orders (`acquire`/`release`/`seq_cst`), Priority Inversion Mutex, False Sharing `alignas(64)`. | • **Ass 18** (Ex 1-5)<br>• **Ass 20** (Ex 4)<br>📖 [11_multithreading](./knowledge/11_multithreading_concurrency.md) • [18_qt_multithreading](./knowledge/18_qt_multithreading_event_loop.md) |
| **T5** | [**P11**](#pillar-11) | **Error Handling, Exceptions & File I/O** | C++11$\rightarrow$20 | Dual-Mode Error Handling (AUTOSAR ASIL-D cấm exception trong real-time loop), Stack Unwinding, Binary I/O, Struct Packing `#pragma pack(1)` & Unaligned HardFault, Endianness, Stream States, Atomic Safe-Save, `mmap` Zero-Copy. | • **Ass 10** (Ex 1-4)<br>• **Ass 18** (Ex 3)<br>📖 [04_file_io](./knowledge/04_file_io_serialization.md) • [10_exception](./knowledge/10_exception_handling_ecu.md) |
| **T5** | [**P12**](#pillar-12) | **Performance, Testing, Undefined Behavior & Data-Oriented Design** | C++11$\rightarrow$20 | Undefined Behavior (Signed overflow, Strict Aliasing), `__restrict__` SIMD Vectorization, WCET Determinism $O(1)$, Data-Oriented Design (AoS vs SoA, 64-byte Cache Line, Hot/Cold split), Google Benchmark, Google Test & GMock (`-fno-exceptions`), `perf`. | • **Ass 20** (Ex 1-4)<br>📖 [07_debugging](./knowledge/07_debugging_profiling.md) • [03_stl](./knowledge/03_stl_containers_algorithms.md) • [16_gtest_gmock](./knowledge/16_gtest_gmock_embedded_testing.md) |
| **EXT**| **Frameworks** | **Automotive Cockpit, SWC State Machine & Viva Bank** | C++17$\rightarrow$20 | Qt Core MOC Architecture, QObject Tree ownership, QAbstractListModel, Qt 6.8 MVVM Cockpit, Trampoline State Machine, Zero-Heap EventBus, Blank-Screen Challenge & Ngân hàng 100+ câu hỏi phỏng vấn Viva. | • **Mock Project**<br>• **Viva Prep**<br>📖 [17_qt_core](./knowledge/17_qt_core_moc_architecture.md) • [18_qt_threads](./knowledge/18_qt_multithreading_event_loop.md) • [19_qt_qml](./knowledge/19_qt_qml_cpp_integration.md) • [20_qt6_cockpit](./knowledge/20_qt6_qml_mvvm_cockpit.md) • [21_state_eventbus](./knowledge/21_automotive_state_machine_eventbus.md) • [22_viva_bank](./knowledge/22_mock_project_roadmap_viva_bank.md) |

---

# 📑 NỘI DUNG CHI TIẾT 12 KHỐI TRỤ CỘT (DETAILED PILLARS)

---

## 🏗️ TẦNG 1: FOUNDATIONS (NỀN TẢNG BIÊN DỊCH & HỆ THỐNG KIỂU)

---

### <span id="pillar-1">📍 PILLAR 1: COMPILATION, LINKING, ODR, ABI & BUILD SYSTEMS</span>

> **Phạm vi bài tập:** `Assignment 1, 2, 3, 5`, `Assignment 4` (Ex 1-4), `Assignment 6` (Ex 1-4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [06_cmake](./knowledge/06_cmake_build_system.md) • [06b_library](./knowledge/06b_library_fundamentals.md) • [06c_flags](./knowledge/06c_gcc_gpp_flags_guide.md) • [06d_ninja](./knowledge/06d_ninja_build_system.md) • [07b_linking](./knowledge/07b_linking_internals.md) • [07c_nm](./knowledge/07c_nm_reading_symbols.md)

#### 1. Mental Model: Compilation Pipeline & ELF Layout

```
    Source (.cpp, .h) ──1. Preprocessor──▶ Expanded (.i) ──2. Compiler──▶ Object (.o) ──3. Linker──▶ ELF Binary
                                                                                                        │
    ┌── ELF Binary Layout (readelf) ────────────────────────────────────────────────────────────────────┤
    │  Sections (Linking View / ld):    .text (Code) │ .rodata (Const) │ .data (Init) │ .bss (Zero)     │
    │  Segments (Execution View / OS):  LOAD (RX)    │ LOAD (RX)       │ LOAD (RW)    │ LOAD (RW)       │
    │  Dynamic Link Table:              .plt (Procedure Linkage Table) │ .got (Global Offset Table)     │
    └───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Translation Unit (TU):** File `.cpp` sau khi Preprocessor gộp toàn bộ `#include` và khai triển `#define`.
* **One Definition Rule (ODR):**
  * Trong 1 TU: Mỗi biến/hàm/struct chỉ được định nghĩa đúng 1 lần.
  * Toàn chương trình: Biến/hàm non-inline chỉ có đúng 1 định nghĩa trên toàn bộ các TU liên kết.
* **Internal vs External Linkage:**
  * `External Linkage` (Mặc định cho global function/variable): Nhìn thấy từ các TU khác, khai báo qua `extern`, symbol `T`/`D`/`B` trong `nm`.
  * `Internal Linkage` (`static` ở file scope hoặc `namespace { ... }`): Chỉ nhìn thấy trong TU hiện tại, symbol `t`/`d`/`b` trong `nm`, ngăn ngừa xung đột ODR giữa các file `.cpp`.
* **Bản chất thực của từ khóa `inline`:** Cho phép 1 hàm hoặc biến (`inline variable` C++17) được định nghĩa giống hệt nhau ở nhiều TU (qua file `.h`). Linker tự động khử trùng lặp (deduplicate) giữ lại đúng 1 bản sao duy nhất trong Binary.
* **Symbol Visibility & Dynamic Loading:**
  * `__attribute__((visibility("hidden")))` / `-fvisibility=hidden`: Ẩn symbol nội bộ của `.so` để giảm kích thước bảng symbol và tránh xung đột tên.
  * `Dynamic Loading (`dlfcn.h`):` Nạp thư viện lúc runtime qua `dlopen()`, lấy con trỏ hàm qua `dlsym()`, đóng qua `dlclose()`.
  * `PLT / GOT & Real-time Determinism:` Lần đầu gọi hàm `.so` sẽ qua PLT resolve địa chỉ vào GOT (Lazy Binding). Trong hệ thống Real-time / AUTOSAR, thiết lập `LD_BIND_NOW=1` để nạp trước toàn bộ Symbol lúc khởi động, triệt tiêu độ trễ Jitter.
* **`-fPIC` (Position Independent Code):** Ép compiler sinh mã sử dụng địa chỉ tương đối qua thanh ghi con trỏ lệnh (RIP-relative addressing), bắt buộc khi tạo thư viện động `.so`.
* **Runtime Search Order của Dynamic Linker (`ld.so`):**
  1. `DT_RPATH` $\rightarrow$ 2. `LD_LIBRARY_PATH` $\rightarrow$ 3. `DT_RUNPATH` $\rightarrow$ 4. `/etc/ld.so.cache` $\rightarrow$ 5. `/lib`, `/usr/lib`.
  * Thiết lập `set(CMAKE_INSTALL_RPATH "$ORIGIN/lib")` để file thực thi tự tìm `.so` trong thư mục con tương đối, không phụ thuộc máy cài đặt.
* **Build Systems & Cross-Compilation:**
  * `Makefile Auto-Dependency:` Cờ `-MMD -MP` tự sinh file `.d` theo dõi header, tự rebuild khi header thay đổi.
  * `CMake Target System:` `target_include_directories(PUBLIC/PRIVATE)`, `target_link_libraries()`.
  * `Cross-Compilation:` Host (x86_64) build cho Target (ARM/AArch64) qua `CMAKE_TOOLCHAIN_FILE` (`CMAKE_SYSTEM_NAME Linux`, `CMAKE_SYSROOT /opt/sysroot`, `CMAKE_C_COMPILER aarch64-linux-gnu-gcc`).
  * `Linker Script (`.ld`):` Định nghĩa `MEMORY { FLASH (rx): ORIGIN=0x08000000, LENGTH=512K }` và phân bổ `SECTIONS { .text : { *(.text*) } > FLASH }`.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Undefined reference to `...`:** Thiếu file `.o`, quên link thư viện (`-lmylib`), hoặc quên thân hàm template trong `.h`.
* ⚠️ **Multiple definition of `...`:** Định nghĩa biến/hàm non-inline, non-static trong file `.h` rồi include vào nhiều `.cpp`.
* ⚠️ **ABI Incompatibility:** Biên dịch 2 thư viện bằng 2 compiler khác nhau (hoặc khác cờ `-D_GLIBCXX_USE_CXX11_ABI`) làm sai lệch Name Mangling và Memory Layout của struct/class.

---

### <span id="pillar-2">📍 PILLAR 2: C++ TYPE SYSTEM, CONVERSION & INITIALIZATION</span>

> **Phạm vi bài tập:** `Assignment 4, 9`, `Assignment 20` (Ex 1)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [05_modern_cpp](./knowledge/05_modern_cpp_features.md)

#### 1. Mental Model: Ma trận Phân biệt Thao tác Kiểu

```
    Declaration     ──▶ Báo cho Compiler biết Symbol và Kiểu tồn tại (extern int x;)
    Definition      ──▶ Cấp phát ô nhớ thực tế cho Symbol (int x;)
    Initialization  ──▶ Gán giá trị HỢP LỆ NGAY TẠI THỜI ĐIỂM KHỞI TẠO Ô NHỚ (int x{0};)
    Assignment      ──▶ Ghi đè giá trị mới lên một ô nhớ ĐÃ ĐƯỢC KHỞI TẠO TRƯỚC ĐÓ (x = 5;)
    Conversion      ──▶ Biến đổi biểu diễn kiểu dữ liệu (Implicit, Explicit, Cast)
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **5 Hình thức Khởi tạo (Initialization Forms):**
  * `Default Initialization:` `int x;` $\rightarrow$ Giá trị rác khó đoán trên Stack; biến static/global tự động = 0 (BSS).
  * `Value Initialization [C++11]:` `int x{};` hoặc `new int()` $\rightarrow$ Khởi tạo về 0 (Zero-initialized).
  * `Direct Initialization:` `int x(5);` $\rightarrow$ Khớp trực tiếp Constructor tương ứng.
  * `Copy Initialization:` `int x = 5;` $\rightarrow$ Khởi tạo qua toán tử gán (có thể gọi Copy/Move Ctor).
  * `List / Direct-List Initialization (Brace Init `{}` [C++11]):` Cú pháp chuẩn hóa `T x{args}`. **Cấm Narrowing Conversion** (Ví dụ `int x{3.14};` bị Compiler chặn lỗi ngay).
* **Quy tắc Số nguyên & Tràn số (Signed vs Unsigned):**
  * `Signed Integer Overflow:` Là **Undefined Behavior (UB)**! Compiler có quyền tối ưu hóa loại bỏ câu lệnh.
  * `Unsigned Integer Overflow:` Xác định theo chuẩn (Modulo $2^N$), không bao giờ âm.
  * `Integer Promotion:` Các kiểu nhỏ hơn `int` (`char`, `short`, `bool`) tự động được nâng cấp lên `int` khi thực hiện phép toán số học.
* **Bộ tứ Từ khóa Hằng trong C++:**
  * `const:` Hằng số Read-only tại runtime.
  * `constexpr [C++11/14]:` Hằng số hoặc Hàm tính toán được tại **Compile-time**. Trong C++11 chỉ được chứa 1 lệnh `return`; từ C++14 cho phép vòng lặp `for` và câu lệnh `if`.
  * `consteval [C++20 Immediate Function]:` Bắt buộc hàm PHẢI thực thi tại Compile-time.
  * `constinit [C++20]:` Cam kết biến static/thread-local được khởi tạo tại Compile-time, triệt tiêu Static Initialization Order Fiasco.
* **Chuyển đổi Kiểu (Conversions & Casts):**
  * `Implicit Conversion:` Chuyển đổi ngầm định do compiler tự suy diễn (nguy hiểm).
  * `explicit Constructor / Conversion Operator [C++11]:` Ngăn chặn compiler tự ép kiểu ngầm (`explicit MyClass(int);`).
  * 4 Loại C++ Casts:
    1. `static_cast<T>:` Kiểm tra compile-time, an toàn khi biết rõ quan hệ kiểu.
    2. `dynamic_cast<T>:` Kiểm tra runtime qua RTTI và `vtable`, trả `nullptr` nếu ép sai con trỏ.
    3. `reinterpret_cast<T>:` Ép kiểu bit-level thô, dùng trong driver thanh ghi phần cứng.
    4. `const_cast<T>:` Thêm/bớt thuộc tính `const`/`volatile`.
  * `std::bit_cast<To, From> [C++20]:` Type Punning an toàn tuyệt đối ở cấp độ nhị phân (trên C++11/14 dùng `std::memcpy`).

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Most Vexing Parse:** `MyClass obj();` không phải khởi tạo đối tượng, mà bị compiler hiểu nhầm thành **khai báo hàm `obj` trả về `MyClass`**. Khắc phục: `MyClass obj{};`.
* ⚠️ **Implicit Conversion Constructor Bug:** Class có constructor 1 tham số không có `explicit` sẽ vô tình biến chuỗi logic thành phép gán hợp lệ ngoài ý muốn (`MyString s = 100;` chạy mà không báo lỗi).

---

## 💾 TẦNG 2: DATA & LIFETIME (BỘ NHỚ, VÒNG ĐỜI & CƠ CHẾ HÀM)

---

### <span id="pillar-3">📍 PILLAR 3: POINTERS, REFERENCES, ALLOCATION & OBJECT LIFETIME</span>

> **Phạm vi bài tập:** `Assignment 7, 8` (Ex 1-4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [01_memory_model](./knowledge/01_memory_model_pointers.md) • [15_pmr](./knowledge/15_pmr_allocators_embedded_memory.md)

#### 1. Mental Model: Vòng đời Đối tượng & Memory Layout

```
    5 GIAI ĐOẠN VÒNG ĐỜI:  [1. Allocation] ──▶ [2. Construction] ──▶ [3. Lifetime] ──▶ [4. Destruction] ──▶ [5. Deallocation]
                           (Cấp raw bytes)    (Chạy Constructor)   (Dùng hợp lệ)     (Chạy Destructor)     (Thu hồi raw bytes)
                           ────────────────────────────────────────────────────────────────────────────────────────────────────
    NGUYÊN LÝ CỐT LÕI:     Object ≠ Memory Block! Ô nhớ chưa construct hoặc đã destruct KHÔNG PHẢI là đối tượng hợp lệ.
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Linux x86_64 User Process Memory Layout (Virtual Address Space - ASLR On)  │
├─────────────────────────────────────────────────────────────────────────────┤
│  0xFFFF_FFFF_FFFF_FFFF ┌─────────────────────────────────────────────────┐  │
│                        │ Kernel Space (Dành riêng cho OS Kernel)         │  │
│  0x0000_7FFF_FFFF_FFFF ├─────────────────────────────────────────────────┤  │
│                        │ [Stack] (Biến cục bộ / Stack Frames)    ⬇ grows │  │
│                        ├─────────────────────────────────────────────────┤  │
│                        │ ~~~ GAP ~~~ (Guard Page bảo vệ đáy Stack)       │  │
│                        ├─────────────────────────────────────────────────┤  │
│                        │ Memory Map (.so / mmap / malloc > 128KB)⬇ grows │  │
│                        ├─────────────────────────────────────────────────┤  │
│                        │ ~~~ GAP ~~~                                     │  │
│                        ├─────────────────────────────────────────────────┤  │
│                        │ [Heap] (Cấp phát động new/malloc)       ⬆ grows │  │
│                        ├─────────────────────────────────────────────────┤  │
│                        │ .bss    (Biến static/global chưa gán giá trị = 0)│  │
│                        │ .data   (Biến static/global đã khởi tạo giá trị)│  │
│                        │ .rodata (Hằng số const, String Literals "abc")  │  │
│                        │ .text   (Mã máy CPU thực thi - Read/Execute)    │  │
│  0x0000_5555_5555_0000 └─────────────────────────────────────────────────┘  │
│  Base PIE (Được Randomize bởi ASLR để chống tràn bộ đệm)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  * Khác biệt trên Bare-Metal/MCU: .text/.rodata nằm ở FLASH ROM;            │
│    .data/.bss nằm ở SRAM; Heap thường bị vô hiệu hóa hoàn toàn.             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Storage Duration (Thời lượng Lưu trữ):**
  * `Automatic:` Biến cục bộ trên Stack, cấp phát và thu hồi tự động theo scope.
  * `Static:` Biến toàn cục/static, tồn tại suốt vòng đời chương trình (Data/BSS).
  * `Thread-local [C++11]:` `thread_local`, mỗi luồng sở hữu một bản sao riêng biệt.
  * `Dynamic:` Vùng nhớ Heap cấp phát thủ công qua `new`/`delete` hoặc `malloc`/`free`.
* **Mảng & Con trỏ Chuyên sâu:**
  * `Array Decay:` Mảng `T arr[N]` bị hạ cấp thành con trỏ `T*` khi truyền vào hàm C-style, mất kích thước `N`.
  * `Tham chiếu mảng:` `template <size_t N> void func(T (&arr)[N])` bảo toàn kích thước compile-time.
  * `Con trỏ Mảng 2D:` `T (*p)[10]` (Bộ nhớ liên tục Row-Major), KHÔNG PHẢI `T**` (Mảng con trỏ rời rạc).
* **Tương tác Phần cứng & Nhúng:**
  * Từ khóa `volatile:` Bắt buộc CPU đọc/ghi trực tiếp ra bus vật lý, cấm Compiler tối ưu hóa vào thanh ghi CPU. Dùng cho thanh ghi MMIO và biến cờ trong ngắt ISR. **`volatile` KHÔNG CÓ TÍNH THREAD-SAFE**.
  * `Placement new (`#include <new>`):` `new (buffer_ptr) ClassType(args);` dựng đối tượng trực tiếp lên vùng nhớ có sẵn. Bắt buộc gọi destructor thủ công `buffer_ptr->~ClassType();` (hoặc `std::destroy_at(buffer_ptr)` trong C++17) khi giải phóng.
  * `std::launder [C++17]:` Báo cho trình biên dịch biết ô nhớ đã được tái khởi tạo đối tượng mới để tránh giả định con trỏ cũ.
* **Smart Pointers & Quản lý Sở hữu [C++11/14]:**
  * `std::unique_ptr<T> [C++11]:` Độc quyền sở hữu (Exclusive Ownership), Move-only, Zero overhead. Khởi tạo qua `std::make_unique` (C++14, trên C++11 tự viết template helper).
  * `std::shared_ptr<T> [C++11]:` Đồng sở hữu qua Control Block (Strong Ref Count + Weak Ref Count, Atomic Operations). Khởi tạo bằng `std::make_shared` để tối ưu gộp 1 lần allocation.
  * `std::weak_ptr<T> [C++11]:` Quan sát không tăng ref-count, dùng `lock()` để lấy `shared_ptr`, phá vỡ vòng lặp rò rỉ Circular Reference.
  * `Custom Deleter:` Đóng gói tài nguyên C-style (`std::unique_ptr<FILE, decltype(&fclose)> fp(fopen(...), &fclose);`).
* **Căn chỉnh Bộ nhớ & Tối ưu Phân mảnh:**
  * `alignof(T)` / `alignas(N) [C++11]:` Truy vấn và ép buộc căn chỉnh biên byte (ví dụ `alignas(64)` cho Cache Line).
  * `Memory Fragmentation:` Phân mảnh trong (Padding thừa) vs Phân mảnh ngoài (Xé vụn Heap).
  * `Fixed-Size Memory Pool & Arena Allocator:` Cấp phát mảng tĩnh $O(1)$, triệt tiêu phân mảnh Heap trên ECU.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Dangling Pointer / Dangling Reference:** Trả về con trỏ/tham chiếu đến biến cục bộ trên Stack đã bị hủy.
* ⚠️ **Pointer Invalidation:** `std::vector::push_back()` vượt quá capacity sẽ reallocate Heap, làm toàn bộ con trỏ và iterator cũ trở thành con trỏ rác (Dangling).
* ⚠️ **Circular Reference Leak:** Hai đối tượng giữ `std::shared_ptr` trỏ chéo vào nhau làm Reference Count không bao giờ về 0.

---

### <span id="pillar-4">📍 PILLAR 4: FUNCTIONS, CALLABLES & VALUE CATEGORIES</span>

> **Phạm vi bài tập:** `Assignment 9` (Ex 1-4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [05_modern_cpp](./knowledge/05_modern_cpp_features.md)

#### 1. Mental Model: Value Categories & Reference Collapsing

```
    ┌──────────────────────── Expressions (Biểu thức C++) ────────────────────────┐
    │                                                                             │
    │   ┌─────────── glvalue ──────────┐                                          │
    │   │  (Có Identity / Lấy & được / │                                          │
    │   │   Có địa chỉ định danh)      │                                          │
    │   │                              │                                          │
    │   │   ┌──────────┐  ┌────────────┼──────────┐                               │
    │   │   │  lvalue  │  │   xvalue   │          │                               │
    │   │   │          │  │ (eXpiring) │          │                               │
    │   │   │ int a;   │  │ std::move  │          │                               │
    │   │   │ *ptr     │  │ f() → T&&  │          │                               │
    │   │   │ "literal"│  │ a.member   │          │                               │
    │   │   └──────────┘  └────────────┼──────────┘                               │
    │   └──────────────────────────────┘          │                               │
    │                                  │  rvalue  │                               │
    │                                  │ (Có thể move-from / Chiếm dụng tài nguyên│
    │                                  │          │                               │
    │                                  │  ┌───────┴────────┐                      │
    │                                  │  │    prvalue     │                      │
    │                                  │  │  (pure rvalue) │                      │
    │                                  │  │  42, a+b, T{}  │                      │
    │                                  │  │  f() → T       │                      │
    │                                  │  └────────────────┘                      │
    │                                  └──────────────────────────┘               │
    └─────────────────────────────────────────────────────────────────────────────┘

    NGUYÊN LÝ PHÂN BIỆT CỐT LÕI (2 Câu Hỏi Quyết Định):
    1. Có Identity không? (Lấy địa chỉ &expr được không?) ──▶ YES: glvalue | NO: prvalue
    2. Có Move được không? (Tài nguyên sắp hủy/tái dụng?) ──▶ YES: rvalue  | NO: lvalue
    ===> xvalue (eXpiring value) chính là giao thoa: Vừa có Identity VỪA Move được (glvalue ∩ rvalue)!
```

```
    QUY TẮC THU GỌN THAM CHIẾU (Reference Collapsing):
    &  +  &   ──▶  &        │    &&  +  &   ──▶  &
    &  +  &&  ──▶  &        │    &&  +  &&  ──▶  &&  (Chỉ duy nhất && + && mới sinh ra Rvalue Reference!)
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Khớp Nạp chồng Hàm theo Value Category (Overload Resolution):**
  * `void f(T&)` $\rightarrow$ Chỉ nhận Non-const Lvalue (`f(a)`).
  * `void f(const T&)` $\rightarrow$ Nhận mọi thứ: Lvalue, Const Lvalue, Prvalue, Xvalue (`f(a)`, `f(42)`, `f(move(a))`).
  * `void f(T&&)` $\rightarrow$ Ưu tiên nhận Rvalue (`f(T{})`, `f(std::move(a))`).
* **Tối ưu Hóa Bản sao (Copy Elision & RVO):**
  * `Return Value Optimization (RVO / NRVO):` Trình biên dịch dựng trực tiếp đối tượng trả về vào Stack Frame của Caller, loại bỏ hoàn toàn việc gọi Copy/Move Constructor.
  * `Mandatory Copy Elision [C++17]:` Bắt buộc áp dụng cho prvalue.
  * ❌ **Cấm kỵ:** Viết `return std::move(local_var);` làm triệt tiêu RVO, ép chạy Move Constructor chậm hơn.
* **Universal Reference (`T&&`) & Perfect Forwarding [C++11]:**
  * `Universal Reference (Forwarding Reference):` Xuất hiện khi `T&&` đi kèm template suy diễn kiểu (`template <typename T> void relay(T&& arg)`).
  * `std::forward<T>(arg):` Bảo toàn chính xác bản chất Lvalue/Rvalue của đối số truyền vào, nền tảng cho `make_unique` và `emplace_back`.
* **Hệ sinh thái Callable Entities:**
  * `Function Pointer:` `void (*fp)(int)` — Không lưu trạng thái, khó inline.
  * `Member Function Pointer:` `void (Class::*mfp)(int)` — Gọi qua `(obj.*mfp)(val)`.
  * `Functor:` Class nạp chồng `operator()`, lưu được trạng thái, compiler dễ dàng inline.
  * `Lambda Expression [C++11]:` Cú pháp `[capture](params) mutable noexcept -> ret { body }`.
    * Capture: `[&]` (tham chiếu), `[=]` (bản sao), `[this]` (con trỏ đối tượng), `[x = std::move(y)]` (C++14 Init capture).
    * Generic Lambda: `[](auto x, auto y) { return x + y; }` (C++14).
  * `std::invoke [C++17]:` Cú pháp chuẩn hóa gọi đồng nhất mọi loại Callable.
  * `std::function<R(Args...)> [C++11]:` Type-Erased Polymorphic Wrapper, linh hoạt nhưng có chi phí Virtual call và Heap allocation (nếu vượt SBO).
* **Toán tử `decltype` [C++11]:** Trích xuất kiểu biểu thức tại Compile-time: `template <typename T, typename U> auto add(T a, U b) -> decltype(a + b);`.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Dangling Lambda Reference:** Lambda bắt biến cục bộ theo tham chiếu `[&]` nhưng lại được lưu trữ vào callback sống lâu hơn hàm chứa biến đó.
* ⚠️ **Lạm dụng `std::function` trong Real-time Loop:** Gây trễ do gián tiếp qua bảng ảo và phân bổ Heap ngoài ý muốn. Ưu tiên dùng Template Callable hoặc Function Pointer.

---

## 🏛️ TẦNG 3: OBJECT & LOGIC (MÔ HÌNH ĐỐI TƯỢNG & MẪU THIẾT KẾ)

---

### <span id="pillar-5">📍 PILLAR 5: RAII, COPY/MOVE & SPECIAL MEMBER FUNCTIONS</span>

> **Phạm vi bài tập:** `Assignment 11` (Ex 1-4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [01_memory_model](./knowledge/01_memory_model_pointers.md) • [02_oop_deep](./knowledge/02_oop_deep.md)

#### 1. Mental Model: Bảng Ma trận Tự sinh Special Member Functions (3 Trạng Thái Chuẩn)
> **Quy ước:** `✔ Defaulted` (Compiler tự sinh) | `∅ Not Declared` (Không sinh $\rightarrow$ **Fallback sang Copy**) | `✘ Deleted` (Bị cấm $\rightarrow$ Gọi là lỗi Compile) | `👤 User Defined` (Người dùng tự viết)

| Bạn tự viết thành phần nào... | Default Ctor | Destructor | Copy Ctor | Copy Assign | Move Ctor | Move Assign |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Không viết gì cả (Rule of 0)** | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted |
| **Tự viết Constructor bất kỳ** | **∅ Not Declared** | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted | ✔ Defaulted |
| **Tự viết Destructor** | ✔ Defaulted | 👤 User Defined | ✔ *(Deprecated)* | ✔ *(Deprecated)* | **∅ Not Declared** | **∅ Not Declared** |
| **Tự viết Copy Ctor hoặc Copy Assign**| ✔ Defaulted | ✔ Defaulted | 👤 / ✔ | ✔ / 👤 | **∅ Not Declared** | **∅ Not Declared** |
| **Tự viết Move Ctor hoặc Move Assign**| ✔ Defaulted | ✔ Defaulted | ✘ **Deleted** | ✘ **Deleted** | 👤 / ∅ | ∅ / 👤 |

```
    🚨 BẪY HIỆU NĂNG CHÍ TỬ TRONG XỬ LÝ ẢNH / EMBEDDED: VÌ SAO "∅" NGUY HIỂM HƠN "✘"?
    
    class FrameBuffer
    {
    public:
        ~FrameBuffer() { cleanup_hw(); } // Tự viết Destructor
    private:
        std::vector<uint8_t> pixels;    // Buffer 4K RGBA: 8.3 MB
    };

    // Khi gọi code:
    FrameBuffer f1;
    FrameBuffer f2 = std::move(f1); 
    // 1. Compiler tìm Move Ctor -> Trạng thái: ∅ Not Declared (Không tồn tại).
    // 2. Overload Resolution tự động Fallback sang Copy Constructor(const FrameBuffer&)!
    // 3. Hệ quả: Code BIÊN DỊCH THÀNH CÔNG KHÔNG BÁO LỖI, nhưng ngầm memcpy 8.3 MB mỗi frame!
    //    Chạy 30 FPS = Tốn 250 MB/s băng thông bộ nhớ -> Drop FPS thảm họa.
    // ===> GIẢI PHÁP: Áp dụng Rule of 5 (khai báo = default cho Move) hoặc Rule of 0!
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Triết lý RAII (Resource Acquisition Is Initialization):** Gắn chặt vòng đời tài nguyên (bộ nhớ, file, lock mutex, GPU buffer) vào vòng đời của đối tượng trên Stack. Constructor cấp phát tài nguyên, Destructor tự động giải phóng tài nguyên khi thoát scope.
* **Bộ ba Quy tắc Quản lý Đối tượng:**
  * `The Rule of Three (C++98):` Nếu tự quản lý tài nguyên thô $\rightarrow$ Phải viết Destructor, Copy Constructor, Copy Assignment.
  * `The Rule of Five [C++11]:` Viết thêm Move Constructor và Move Assignment Operator (`noexcept`).
  * `The Rule of Zero (Modern C++ Best Practice):` Sử dụng smart pointers và STL containers $\rightarrow$ Không viết bất kỳ hàm nào trong bộ 6 hàm trên, để compiler tự sinh tối ưu.
* **Kỹ thuật Copy-and-Swap Idiom:**
  ```cpp
  MyClass& operator=(MyClass other) noexcept { // Pass-by-value tự động gọi Copy hoặc Move Ctor
      swap(*this, other);                      // Hoán đổi con trỏ nội bộ an toàn
      return *this;                            // other tự động hủy vùng nhớ cũ khi ra khỏi scope
  }
  ```
* **Hợp đồng `noexcept` trong Move Semantics [C++11]:** `std::vector` khi tái cấp phát sẽ kiểm tra `is_nothrow_move_constructible`. Nếu Move Constructor không có `noexcept`, vector sẽ lùi về dùng Copy Constructor chậm chạp để đảm bảo Strong Exception Safety.
* **Nạp chồng Toán tử (Operator Overloading):**
  * `operator[]`, `operator()`, `operator<<`, `operator==`.
  * `Toán tử Phi thuyền <=> [C++20]:` `auto operator<=>(const MyClass&) const = default;` (Trên C++11/14 tự viết `operator<` và `operator==`).
* **Static Initialization Order Fiasco & Meyers' Singleton [C++11]:**
  * Tránh khởi tạo biến toàn cục phụ thuộc chéo nhau qua các file `.cpp`.
  * Khắc phục bằng hàm trả về static reference: `static Config& getInstance() { static Config instance; return instance; }` (Thread-safe chuẩn C++11).

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Shallow Copy Double-Free:** Compiler tự sinh copy gán thẳng con trỏ thô, khi 2 đối tượng cùng hủy sẽ xóa vùng nhớ 2 lần gây crash chương trình.
* ⚠️ **Member Initialization List Order:** Thứ tự khởi tạo trong danh sách `: a(1), b(2)` luôn chạy theo **thứ tự khai báo thuộc tính trong class**, không phụ thuộc vào thứ tự viết trong Constructor.

---

### <span id="pillar-6">📍 PILLAR 6: CLASSES, INHERITANCE, POLYMORPHISM & OBJECT MODEL</span>

> **Phạm vi bài tập:** `Assignment 12, 13, 14`, `Assignment 17, 19`  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [02_oop_deep](./knowledge/02_oop_deep.md) • [12_patterns](./knowledge/12_design_patterns.md) • [09_rtti](./knowledge/09_rtti_dynamic_cast.md) • [21_state_eventbus](./knowledge/21_automotive_state_machine_eventbus.md)

#### 1. Mental Model: Bố cục Bộ nhớ Đa hình & CRTP Static Polymorphism

```
    DYNAMIC POLYMORPHISM (Runtime vtable):
    Base* ptr ──▶ [ vptr (8 Bytes) ] ──▶ vtable [ &Derived::func ] ──▶ Gián tiếp (Tốn RAM, không thể Inline)
                  [ Member Var     ]

    STATIC POLYMORPHISM (Compile-time CRTP):
    template <typename Derived> class Base {
        void process() { static_cast<Derived*>(this)->impl(); } ──▶ Trực tiếp (Zero vptr, Inline 100% tốc độ cao)
    };
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **C++ Object Model & Virtual Internals:**
  * Mỗi class có hàm virtual sẽ có 1 bảng tĩnh `vtable`.
  * Mỗi đối tượng của class được chèn thêm 1 con trỏ ẩn `vptr` (8 bytes trên 64-bit) ở đầu struct.
  * **Quy tắc Vàng:** Class có ít nhất 1 hàm ảo thì Destructor **BẮT BUỘC** phải là `virtual ~Base()`.
* **Static Polymorphism qua CRTP (Curiously Recurring Template Pattern):**
  * `class SensorDriver : public BaseDriver<SensorDriver>`: Ép kiểu compile-time thay cho virtual call, triệt tiêu overhead vptr/vtable, tối ưu tuyệt đối cho Computer Vision và Hardware Drivers (Tương thích 100% từ C++11 đến C++20).
* **Non-Virtual Interface (NVI Idiom):** Hàm `public non-virtual` đóng vai trò kiểm soát luồng (Template Method / Lock / Pre-conditions), hàm `protected virtual` cho phép lớp con tùy biến thuật toán.
* **PIMPL Idiom (Pointer to Implementation — Tường lửa Biên dịch):**
  * Đưa toàn bộ thành viên private và header phụ thuộc vào struct `Impl` trong file `.cpp`, class công khai ở `.h` chỉ giữ `std::unique_ptr<Impl> pImpl;`.
  * Lợi ích: **Ổn định ABI** (kích thước class không đổi) và giảm thời gian biên dịch (Build Isolation).
* **Thừa kế Phức tạp & RTTI:**
  * `Diamond Problem & Virtual Inheritance:` Dùng `class B : virtual public A` để loại bỏ thực thể trùng lặp của lớp gốc.
  * `This Pointer Adjustment:` Trong đa kế thừa, khi ép kiểu từ `Base2*` về `Derived*`, con trỏ `this` tự động được cộng/trừ một khoảng bù byte (Offset).
  * `Object Slicing:` Gán đối tượng con vào biến giá trị lớp cha (`Base b = derived;`) làm cắt gọt thuộc tính con và vptr.
  * `Covariant Return Types:` Hàm ảo override được phép trả về con trỏ/tham chiếu lớp con.
* **Design Patterns Kiến trúc ECU & Clean Code:**
  * `Factory Method` (Tạo 1 đối tượng) vs `Abstract Factory` (Tạo một họ đối tượng liên quan).
  * `Strategy Pattern` (Tách thuật toán tính toán) & `State Pattern` (Tách logic chuyển đổi trạng thái).
  * `Command Pattern` (Hàng đợi lệnh bất đồng bộ, hỗ trợ `undo()`).
  * `Observer Pattern` (Phát sóng sự kiện 1-N).
  * `Dependency Injection (DI):` Tiêm interface trừu tượng qua Constructor để hỗ trợ Unit Testing với Mock Objects (chuẩn ISO 26262), thay thế Singleton Anti-Pattern.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Quên Virtual Destructor ở Base Class:** Khi gọi `Base* p = new Derived(); delete p;`, chỉ có Destructor của `Base` được gọi, toàn bộ tài nguyên của `Derived` bị rò rỉ (Memory Leak).
* ⚠️ **Gọi Virtual Function trong Constructor / Destructor:** Lúc Constructor của Base đang chạy, vptr vẫn đang trỏ tới vtable của Base (Derived chưa được dựng), do đó hàm con sẽ KHÔNG được gọi đa hình.

---

## ⚡ TẦNG 4: MODERN & STL (LẬP TRÌNH TỔNG QUÁT & BỘ THƯ VIỆN CHUẨN)

---

### <span id="pillar-7">📍 PILLAR 7: TEMPLATES, SFINAE & GENERIC PROGRAMMING</span>

> **Phạm vi bài tập:** `Assignment 15` (Ex 1-4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [08_templates](./knowledge/08_template_metaprogramming.md) • [14_concepts_ranges](./knowledge/14_cpp20_concepts_ranges_coroutines.md)

#### 1. Mental Model: Mô hình Phân nhánh Compile-time `if constexpr` vs SFINAE

```
    C++17 (if constexpr):
    template <typename T>
    void process(T val) {
        if constexpr (std::is_integral_v<T>) {
            // Nhánh Số nguyên: Compile-time sinh mã máy chuyên biệt
        } else {
            // Nhánh khác: BỊ LOẠI BỎ HOÀN TOÀN KHỎI BINARY (Zero Dead Code)
        }
    }

    C++11 / C++14 LEGACY WORKAROUND (SFINAE std::enable_if):
    template <typename T, typename std::enable_if<std::is_integral<T>::value, int>::type = 0>
    void process(T val) { /* Xử lý số nguyên */ }
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Template Compilation Model:**
  * `Two-phase Lookup:` Pha 1 kiểm tra cú pháp không phụ thuộc kiểu; Pha 2 kiểm tra khi đã nạp kiểu cụ thể (Instantiation).
  * Khai báo và định nghĩa thân hàm của Template **bắt buộc phải đặt trong file Header (`.h`/`.hpp`)**.
* **Template Specialization (Chuyên biệt hóa):**
  * `Full Specialization:` `template <> class Serializer<std::string> { ... };`.
  * `Partial Specialization:` `template <typename T> class Buffer<T*> { ... };`.
* **Kỹ thuật Lọc Kiểu SFINAE [C++11] vs `if constexpr` [C++17]:**
  * `SFINAE (Substitution Failure Is Not An Error):` Loại bỏ overload không hợp lệ qua `std::enable_if_t` (C++14) hoặc `std::enable_if<...>::type` (C++11) mà không báo lỗi build.
  * `if constexpr (C++17):` Thay thế SFINAE phức tạp bằng cú pháp rẽ nhánh điều kiện compile-time trong sáng, loại bỏ mã thừa.
* **Thư viện Type Traits (`<type_traits>` [C++11/14]):**
  * Kiểm tra kiểu: `is_integral<T>::value` (C++11) / `is_integral_v<T>` (C++17), `is_floating_point`, `is_pointer`, `is_same`, `is_trivially_copyable`.
  * Biến đổi kiểu: `decay<T>::type` (C++11) / `decay_t<T>` (C++14), `remove_reference`, `underlying_type`.
* **Variadic Templates & Parameter Packs [C++11/17]:**
  * Nhận số lượng tham số tùy ý: `template <typename... Args> void log(Args&&... args)`.
  * `Fold Expressions (C++17):` Thu gọn gói tham số ngắn gọn `(... + args)`. Trên C++11/14 dùng hàm đệ quy cơ sở (Recursive Template Base Case).
* **C++20 Concepts & Constraints:**
  * Định nghĩa ràng buộc kiểu trực quan: `template <typename T> requires std::integral<T> void sendPacket(T id);`.
* **Kiểm soát Kích thước Binary (Mitigating Template Bloat):** Khởi tạo template với quá nhiều kiểu dữ liệu làm phình bộ nhớ ROM của vi điều khiển. Sử dụng kỹ thuật gom mã cơ sở (Base Class Hoisting) hoặc `extern template` (Explicit Instantiation [C++11]).

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Viết Template Definition trong file `.cpp`:** Dẫn đến lỗi Linker `undefined reference to ...` khi các file `.cpp` khác gọi template đó.
* ⚠️ **Lạm dụng SFINAE làm tăng thời gian biên dịch:** Mã nguồn trở nên khó đọc, trình biên dịch mất nhiều thời gian duyệt cây ứng viên. Thay thế bằng Tag Dispatching trên C++11/14 hoặc `if constexpr`/`Concepts` trên C++17/20.

---

### <span id="pillar-8">📍 PILLAR 8: STL ARCHITECTURE: CONTAINERS, ITERATORS & ALGORITHMS</span>

> **Phạm vi bài tập:** `Assignment 7, 8, 10`, `Assignment 20` (Ex 1-3)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [03_stl](./knowledge/03_stl_containers_algorithms.md)

#### 1. Mental Model: Kiến trúc 3 Tầng STL & Cache Line Contiguity

```
    ┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
    │       CONTAINERS       │─────▶│       ITERATORS        │─────▶│       ALGORITHMS       │
    │  (Vector, List, Array) │      │ (RandomAccess, Forward)│      │ (std::sort, transform) │
    └────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

```
    CACHE LOCALITY COMPARISON:
    std::vector / std::array ──▶ [ Elem 0 ][ Elem 1 ][ Elem 2 ][ Elem 3 ] ──▶ 100% Cache Hit (Mảng liên tục)
    std::list / std::map     ──▶ [ Node A ] ──ptr──▶ [ Node B ] ──ptr──▶  ──▶ 90% Cache Miss (Node rải rác trên RAM)
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Sequence Containers (Bộ chứa Tuần tự):**
  * `std::vector<T>:` Mảng động liên tục, truy cập $O(1)$, chèn đuôi Amortized $O(1)$, tối ưu cache line nhất. Quản lý dung lượng qua `reserve()` (cấp phát trước) và `shrink_to_fit()` (C++11).
  * `std::deque<T>:` Mảng phân đoạn 2 đầu, $O(1)$ chèn đầu/đuôi, không dịch chuyển con trỏ khi thêm phần tử.
  * `std::list<T>` (Double-linked) & `std::forward_list<T>` (Single-linked [C++11]): Chèn/xóa tại chỗ $O(1)$, nhưng tốn thêm 8-16 bytes node pointer cho mỗi phần tử và gây phân mảnh RAM.
  * `std::array<T, N> [C++11]:` Mảng tĩnh phân bổ trên Stack/BSS, zero overhead, WCET $O(1)$, bắt buộc cho hệ thống nhúng Real-time.
* **Associative & Unordered Containers:**
  * `std::map` / `std::set:` Cây đỏ đen (Red-Black Tree), $O(\log N)$, phần tử luôn được sắp xếp theo key.
  * `std::unordered_map` / `std::unordered_set [C++11]:` Bảng băm (Hash Table), trung bình $O(1)$, tệ nhất $O(N)$ khi va chạm hash.
* **Quy tắc Vô hiệu hóa Iterator (Iterator Invalidation Rules):**
  * `std::vector:` Thêm phần tử làm vượt capacity $\rightarrow$ Toàn bộ iterator/con trỏ bị vô hiệu hóa; Xóa phần tử $\rightarrow$ Toàn bộ iterator từ vị trí xóa về sau bị vô hiệu hóa.
  * `std::list / std::map:` Chèn/xóa phần tử KHÔNG làm vô hiệu hóa iterator của các phần tử khác.
* **Thuật toán Chuẩn (`<algorithm>`, `<numeric>`):**
  * Tìm kiếm & Lọc: `std::find`, `std::find_if`, `std::count_if`, `std::binary_search`, `std::lower_bound` ($O(\log N)$ trên mảng đã sort).
  * Biến đổi: `std::transform`, `std::copy_if` (C++11), `std::accumulate`.
  * Xóa phần tử an toàn: `Erase-Remove Idiom` (`v.erase(std::remove_if(v.begin(), v.end(), pred), v.end())` trên C++11/14 hoặc `std::erase_if(v, pred)` trong C++20).
* **C++20 Ranges & Views:** Xử lý chuỗi thuật toán theo phong cách Pipeline lười (Lazy Evaluation): `auto res = v | std::views::filter(is_even) | std::views::transform(square);`.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Vừa duyệt vừa xóa phần tử khỏi Vector:** `for (auto it = v.begin(); it != v.end(); ++it) { if (...) v.erase(it); }` gây lỗi Use-After-Free và nhảy cóc phần tử. Khắc phục: Dùng giá trị trả về của `it = v.erase(it);` hoặc `std::erase_if`.
* ⚠️ **Bẫy Kiểu `std::vector<bool>`:** `std::vector<bool>` là bản chuyên biệt hóa nén 1 bit/phần tử. `operator[]` trả về **Proxy Object (`std::vector<bool>::reference`)**, KHÔNG PHẢI `bool&`. Cấm lấy con trỏ `&v[0]` hoặc truyền vào hàm nhận `bool&`/`bool*`.

---

### <span id="pillar-9">📍 PILLAR 9: MODERN C++ VOCABULARY TYPES</span>

> **Phạm vi bài tập:** `Assignment 9, 10, 15`  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [05_modern_cpp](./knowledge/05_modern_cpp_features.md) • [13_span_string_view](./knowledge/13_span_string_view_heterogeneous.md)

#### 1. Mental Model: Cấu trúc Zero-Copy Views & Tagged Union

```
    std::string_view / std::span:
    [ Pointer ptr (8 Bytes) ] ──▶ Trỏ trực tiếp vào bộ đệm gốc (Stack/Heap/Flash)
    [ Size size   (8 Bytes) ] ──▶ Độ dài chuỗi/mảng
    ✔ Zero-Allocation, Zero-Copy, Tốc độ truyền tham số tối đa!
```

```
    std::variant<int, float, MyStruct>:
    [ Data Buffer (sizeof(MaxType)) ] ──▶ Ô nhớ chứa dữ liệu in-place
    [ Type Index  (int/byte)        ] ──▶ Đánh dấu kiểu hiện tại đang lưu (Type-safe Union)
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **`std::string_view` [C++17]:**
  * Tham chiếu chuỗi Read-only không sở hữu (Non-owning).
  * Thay thế `const std::string&` cho tham số hàm, tránh cấp phát Heap tạm thời khi truyền literal `char[]`.
  * 🔄 **Legacy Workaround (C++11/14):** Truyền cặp `const char* str, size_t len` hoặc dùng `boost::string_ref`.
  * ⚠️ **Lưu ý:** `string_view` không đảm bảo ký tự `\0` ở cuối, cấm truyền thẳng vào hàm C-style `printf("%s")`.
* **`std::span<T, Extent>` [C++20]:**
  * Tham chiếu mảng bộ nhớ liên tục không sở hữu. Triệt tiêu Array Decay, hỗ trợ `span.subspan(offset, count)`.
  * 🔄 **Legacy Workaround (C++11/14):** Dùng tham chiếu mảng `T (&arr)[N]` hoặc cặp `T* ptr, size_t size`.
* **`std::optional<T>` [C++17]:**
  * Đóng gói giá trị có thể tồn tại hoặc rỗng (`std::nullopt`), lưu trữ in-place (không cấp phát Heap).
  * Truy xuất: `.has_value()`, `.value()`, `.value_or(default_val)`.
  * 🔄 **Legacy Workaround (C++11/14):** Dùng `std::pair<bool, T>` hoặc `boost::optional`.
* **`std::variant<Types...>` [C++17]:**
  * Tagged Union an toàn kiểu dữ liệu, lưu in-place.
  * Truy xuất: `std::holds_alternative<T>(var)`, `std::get<T>(var)`, `std::visit` Pattern Matching.
  * 🔄 **Legacy Workaround (C++11/14):** Tự viết struct bọc `enum TypeTag` và `union { ... }`.
* **Các kiểu Bổ trợ khác:**
  * `std::any [C++17]:` Type-erased container cho bất kỳ kiểu dữ liệu nào.
  * `std::tuple [C++11] & Structured Binding [C++17]:` `auto [id, name, score] = getStudentTuple();` (Trên C++11/14 dùng `std::tie(id, name, score) = getStudentTuple();`).
  * `std::reference_wrapper<T> [C++11] (`std::ref`, `std::cref`):` Cho phép lưu trữ tham chiếu vào STL Containers (`std::vector<std::reference_wrapper<T>>`).

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Dangling `string_view`:** Gán `string_view` vào chuỗi tạm thời (`std::string_view sv = (str1 + str2);`) làm `sv` trỏ vào vùng nhớ đã bị giải phóng ngay sau câu lệnh.
* ⚠️ **Gọi `.value()` trên `std::optional` rỗng:** Ném ngoại lệ `std::bad_optional_access` làm sập chương trình.

---

## 🛡️ TẦNG 5: SYSTEMS & CONCURRENCY (HỆ THỐNG, ĐA LUỒNG & TỐI ƯU REAL-TIME)

---

### <span id="pillar-10">📍 PILLAR 10: CONCURRENCY, C++ MEMORY MODEL & ATOMICS</span>

> **Phạm vi bài tập:** `Assignment 18` (Ex 1-5), `Assignment 20` (Ex 4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [11_multithreading](./knowledge/11_multithreading_concurrency.md) • [18_qt_multithreading](./knowledge/18_qt_multithreading_event_loop.md)

#### 1. Mental Model: Happens-Before & False Sharing

```
    HAPPENS-BEFORE / SYNCHRONIZES-WITH:
    Thread A (Ghi dữ liệu):    data = 100;  ──▶ atomic_flag.store(true, memory_order_release);
                                                        │ (Rào cản bộ nhớ đồng bộ)
                                                        ▼
    Thread B (Đọc dữ liệu):    while (!atomic_flag.load(memory_order_acquire)); ──▶ assert(data == 100); ✔
```

```
    FALSE SHARING (Tranh chấp Cache Line 64-byte):
    Core 0 (Thread A ghi varA) ──┐
                                 ├──▶ [ Cache Line 64B: varA (8B) | varB (8B) ] ──▶ CPU Cache Coherence liên tục
    Core 1 (Thread B ghi varB) ──┘                                                    vô hiệu hóa L1 Cache của nhau!
    Khắc phục: alignas(64) uint64_t varA; alignas(64) uint64_t varB;
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Quản lý Luồng & Đồng bộ Cơ bản:**
  * `std::thread [C++11]:` Quản lý luồng, bắt buộc gọi `join()` hoặc `detach()` trước khi hủy object.
  * `std::jthread [C++20]:` Tự động `join()` khi ra khỏi scope và hỗ trợ ngắt luồng an toàn qua `std::stop_token`.
  * `Data Race (UB):` Xảy ra khi 2 luồng cùng truy cập 1 ô nhớ (ít nhất 1 luồng ghi) mà không có cơ chế đồng bộ.
  * `std::mutex, std::lock_guard, std::unique_lock [C++11]:` Khóa vùng tranh chấp (Critical Section).
  * `std::scoped_lock [C++17]:` Khóa đồng thời nhiều mutex chống Deadlock: `std::scoped_lock lock(mutexA, mutexB);`.
    * 🔄 **Legacy Workaround (C++11/14):** `std::lock(mA, mB); std::lock_guard<std::mutex> lA(mA, std::adopt_lock); std::lock_guard<std::mutex> lB(mB, std::adopt_lock);`.
  * `std::shared_mutex [C++17] / std::shared_timed_mutex [C++14]:` Khóa Đọc-Ghi (Read-Write Lock) cho phép nhiều Reader đồng thời và 1 Writer độc quyền.
* **Mô hình Producer-Consumer & `std::condition_variable` [C++11]:**
  * Luồng Consumer chìm vào giấc ngủ qua `cv.wait(lock, predicate)` để giải phóng CPU (tránh Busy-Waiting / Spinning).
  * Luồng Producer đánh thức qua `cv.notify_one()` hoặc `cv.notify_all()`.
* **C++ Memory Model & Atomics [C++11]:**
  * `std::atomic<T>:` Thao tác nguyên tử không khóa (Lock-free), `is_lock_free()`.
  * 5 Cấp độ Memory Ordering:
    1. `memory_order_relaxed:` Chỉ bảo đảm nguyên tử, không có rào cản thứ tự lệnh.
    2. `memory_order_acquire` (Luồng đọc): Không cho phép các lệnh đọc/ghi phía sau bị đẩy lên trước rào cản.
    3. `memory_order_release` (Luồng ghi): Không cho phép các lệnh đọc/ghi phía trước bị đẩy ra sau rào cản.
    4. `memory_order_acq_rel:` Kết hợp cả Acquire và Release cho thao tác Read-Modify-Write.
    5. `memory_order_seq_cst` (Mặc định): Đảm bảo trật tự toàn cục tuần tự nghiêm ngặt (Sequential Consistency).
* **Đặc thù Hệ thống Nhúng Real-Time:**
  * `Priority Inversion Hazard:` Tác vụ ưu tiên thấp giữ khóa chặn tác vụ ưu tiên cao, bị tác vụ trung bình chiếm quyền CPU.
  * `Priority Inheritance Mutex:` Dùng cơ chế kế thừa độ ưu tiên (`PTHREAD_PRIO_INHERIT`) trong Linux RT/RTOS để nâng tạm thời độ ưu tiên của tác vụ thấp.
  * `False Sharing:` Tách biệt các biến đa luồng sang các Cache Line riêng biệt bằng `alignas(64)`.
* **Bất đồng bộ & Kiến Trúc Thread Pool [C++11]:**
  * `std::async`, `std::future`, `std::promise`, `std::packaged_task`.
  * `Thread Pool (Fixed Workers):` Khởi tạo $N$ luồng cố định (`hardware_concurrency()`), duy trì Hàng đợi Tác vụ (`Task Queue`) + `condition_variable`, nạp task qua `std::packaged_task` trả về `std::future`. Loại bỏ chi phí cấp phát Thread Stack 1MB-8MB liên tục từ OS Kernel.
  * `Graceful Shutdown RAII:` Đặt cờ `stop = true`, gọi `cv.notify_all()`, `join()` toàn bộ workers trong Destructor (chống crash do unjoined threads).
  * `Work-Stealing Architecture:` Khắc phục nghẽn khóa (Lock Contention) trên Single Global Queue bằng Deque cục bộ riêng cho từng worker (Head lấy việc, Tail trộm việc khi rỗng).
  * `Ràng buộc Nhúng Real-Time (Zero-Heap):` Cấm dùng `std::queue<std::function<void()>>` vì nguy cơ cấp phát Heap (nếu vượt SBO); thay bằng **Bounded Fixed-Capacity Ring Buffer** và static functors.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Spurious Wakeup:** `condition_variable` có thể tự thức dậy mà không có notify. Bắt buộc phải dùng vòng lặp predicate: `cv.wait(lock, []{ return ready; });`.
* ⚠️ **Deadlock do Khóa sai Thứ tự:** Thread 1 khóa A rồi B; Thread 2 khóa B rồi A. Khắc phục: Dùng `std::scoped_lock` (hoặc `std::lock` trên C++11).
* ⚠️ **Thread Pool Destructor Hang / Crash:** Quên `notify_all()` khiến các worker threads ngủ mãi mãi trên `cv.wait()` dẫn tới Destructor bị treo vĩnh viễn (Hang); hoặc để `std::thread` ra khỏi scope mà unjoined làm kích hoạt `std::terminate()`.
* ⚠️ **Heap Allocation Trong Real-time Task Queue:** `std::function` vượt quá SBO (~16-32 bytes) sẽ âm thầm gọi `malloc`, phá vỡ tính tất định thời gian WCET của hệ thống ô tô.

---

### <span id="pillar-11">📍 PILLAR 11: ERROR HANDLING, EXCEPTIONS & FILE I/O</span>

> **Phạm vi bài tập:** `Assignment 10` (Ex 1-4), `Assignment 18` (Ex 3)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [04_file_io](./knowledge/04_file_io_serialization.md) • [10_exception](./knowledge/10_exception_handling_ecu.md)

#### 1. Mental Model: Stack Unwinding & Atomic Safe-Save Pipeline

```
    STACK UNWINDING (Khi Exception ném ra):
    [ Frame hàm 3 (throw) ] ──▶ Destructor biến cục bộ chạy ──▶ Giải phóng Stack Frame 3
              │
              ▼
    [ Frame hàm 2 ]         ──▶ Destructor biến cục bộ chạy ──▶ Giải phóng Stack Frame 2
              │
              ▼
    [ Frame hàm 1 (catch) ] ──▶ Bắt Exception tại catch (const std::exception& e) an toàn!
```

```
    ATOMIC SAFE-SAVE PIPELINE:
    1. Ghi dữ liệu ra file tạm: "config.json.tmp" ──▶ 2. Kiểm tra failbit == 0 ──▶ 3. std::rename(".tmp", "config.json")
    ✔ Cấp Filesystem hoán đổi Inode Pointer nguyên tử ──▶ Không bao giờ mất file khi sập nguồn xe!
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Triết lý Xử lý Lỗi trong Hệ thống Nhúng:**
  * **Quy chuẩn MISRA C++ / AUTOSAR ASIL-D:** Exception **BỊ CẤM HOÀN TOÀN** trong các tiến trình thời gian thực và ISR do chi phí Stack Unwinding không tất định ($O(N)$) và làm tăng dung lượng Flash (`.eh_frame`). Biên dịch với cờ `-fno-exceptions`.
  * **Chiến lược Xử lý Lỗi Kép (Dual-Mode Error Strategy):**
    * Vòng lặp Real-time: Dùng Error Codes (`enum class` [C++11]), `std::optional` [C++17] hoặc `std::expected<T, E>` [C++23] với chi phí zero-overhead.
    * Giai đoạn Khởi động (Boot/Config): Dùng Exceptions (`try-catch`) để xử lý lỗi thiếu phần cứng nghiêm trọng.
* **Cơ chế Ngoại lệ C++:**
  * `throw`, `try`, `catch (const std::exception& e)` (Bắt theo const reference tránh Object Slicing).
  * `noexcept Specifier & Operator [C++11]:` Khai báo hàm không bao giờ ném lỗi. Nếu vi phạm, chương trình sẽ gọi ngay `std::terminate()`.
  * 3 Cấp độ An toàn Ngoại lệ: `Basic Guarantee` (Không rò rỉ RAM), `Strong Guarantee` (Commit-or-Rollback), `No-throw Guarantee` (`noexcept`).
* **Đọc/Ghi File & Luồng Nhị phân (Binary Streams):**
  * `std::ifstream, std::ofstream, std::fstream:` Mở file nhị phân qua `std::ios::binary`.
  * `Struct Packing (`#pragma pack(push, 1)`):` Loại bỏ byte padding để ghi cấu trúc nhị phân đồng nhất ra file hoặc CAN bus.
  * `Endianness (Thứ tự Byte):` Chuyển đổi giữa Little Endian (x86/ARM) và Big Endian (Network) qua `htonl()`, `ntohl()`.
  * `Stream Error States:` `good()`, `eof()` (`eofbit`), `fail()` (`failbit` - lỗi định dạng), `bad()` (`badbit` - hỏng I/O). Thiết lập ném lỗi tự động qua `.exceptions(failbit | badbit)`.
  * `Chunked Streaming:` Đọc file dung lượng lớn theo mảng đệm cố định 4KB trên Stack (`read()`, `gcount()`).
* **Linux Zero-Copy Memory Mapping (`mmap`):**
  * Hàm hệ thống `mmap()` ánh xạ trực tiếp file hoặc buffer phần cứng vào không gian địa chỉ ảo của tiến trình.
  * Ứng dụng: Thu nhận khung hình từ Camera V4L2 và chia sẻ bộ nhớ IPC tốc độ cao (Zero-Copy từ Kernel sang User Space).

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Ném Exception trong Destructor:** Nếu một Destructor ném ngoại lệ trong quá trình Stack Unwinding đang diễn ra, chương trình sẽ lập tức bị crash qua `std::terminate()`.
* ⚠️ **Ghi File Trực tiếp Không Dùng File Tạm:** Sập nguồn giữa chừng làm file cấu hình bị rỗng hoặc hỏng nửa chừng. Bắt buộc dùng cơ chế Atomic Safe-Save.
* ⚠️ **Bẫy Unaligned Memory Access khi dùng `#pragma pack(1)`:** Trên các vi điều khiển lõi ARM Cortex-M0/M0+ hoặc chip RISC-V không hỗ trợ đọc bộ nhớ lệch biên (Unaligned Access), việc ép kiểu con trỏ `uint32_t*` vào địa chỉ byte lẻ trong packed struct sẽ gây **HardFault / Bus Error**. Khắc phục: Đọc dữ liệu ra bằng `std::memcpy` thay vì dereference con trỏ trực tiếp.

---

### <span id="pillar-12">📍 PILLAR 12: PERFORMANCE, UNDEFINED BEHAVIOR & DATA-ORIENTED DESIGN</span>

> **Phạm vi bài tập:** `Assignment 20` (Ex 1-4)  
> [⬆️ Quay lại Ma trận](#matrix) | 📖 **Tài liệu chuyên sâu:** [07_debugging](./knowledge/07_debugging_profiling.md) • [03_stl](./knowledge/03_stl_containers_algorithms.md) • [16_gtest_gmock](./knowledge/16_gtest_gmock_embedded_testing.md)

#### 1. Mental Model: Data-Oriented Design (Hot/Cold Data Split)

```
    TRADITIONAL OOP (Array of Structures - AoS): Fat Struct (200 Bytes)
    [ ID (4B) | SensorName (64B) | CalibData (128B) | Timestamp (4B) ] ──▶ Quét ID làm nạp cả 200B ──▶ 92% Cache Miss!

    DATA-ORIENTED DESIGN (Structure of Arrays - SoA):
    Hot Data Array:  [ ID 0 (4B) ][ ID 1 (4B) ][ ID 2 (4B) ]... ──▶ 16 IDs / 1 Cache Line (64B) ──▶ 100% Cache Hit!
    Cold Data Array: [ Name 0 (64B) ][ Name 1 (64B) ]...       ──▶ Chỉ nạp khi cần xuất báo cáo
```

#### 2. Từ khóa & Khái niệm Cốt lõi
* **Mô hình Undefined Behavior (UB) & Giả định của Trình biên dịch:**
  * Trình biên dịch hiện đại tối ưu hóa dựa trên giả định mã nguồn **không bao giờ chứa UB**.
  * `Signed Integer Overflow:` Compiler giả định không bao giờ tràn $\rightarrow$ Tối ưu hóa `i + 1 > i` thành `true`.
  * `Strict Aliasing Rule Violation:` Hai con trỏ khác kiểu không được phép trỏ chung vùng nhớ. Ép kiểu con trỏ thô làm compiler tự ý đổi thứ tự đọc/ghi làm sai lệch dữ liệu. Dùng `std::memcpy` (C++11) hoặc `std::bit_cast` (C++20).
  * `Null Dereference Optimization:` Compiler tự loại bỏ các câu lệnh kiểm tra null nằm sau câu lệnh dereference.
* **Tối ưu hóa Con trỏ & Vector hóa (SIMD):**
  * Từ khóa `__restrict__:` Cam kết với compiler rằng hai con trỏ không trỏ đè lên nhau (No Pointer Aliasing).
  * Giúp compiler tự động sinh tập lệnh vector hóa **SIMD Auto-Vectorization** (SSE, AVX-512, ARM NEON).
* **Tính Xác định WCET ($O(1)$ Worst-Case Execution Time):**
  * Trong hệ thống an toàn, thời gian phản hồi phải mang tính tất định.
  * Thay thế các container cấp phát động bất định (`std::vector`) bằng mảng tĩnh cố định (`std::array<T, N>`).
* **Dịch chuyển Tính toán về Compile-Time:**
  * Chuyển các thuật toán tính bảng mã, bảng CRC32, mã băm về hàm `constexpr` [C++11/14] / `consteval` [C++20] để nhúng sẵn vào Flash ROM (`.rodata`).
  * `static_assert(cond, msg) [C++11]:` Bắt lỗi kích thước struct, căn chỉnh byte và kiểm tra va chạm cấu hình ngay lúc biên dịch.
* **Phương pháp Đo lường & Chẩn đoán Hiệu năng (Benchmarking & Profiling):**
  * Micro-benchmarking: Sử dụng đồng hồ đơn điệu `std::chrono::steady_clock` [C++11] hoặc thư viện **Google Benchmark**. Dùng `benchmark::DoNotOptimize(var)` để chống compiler xóa mã đo.
  * System Profiling: Linux `perf` (`perf record -g`, `perf report`), biểu đồ `Flame Graphs`.
  * Bộ công cụ Sanitizers: AddressSanitizer (`-fsanitize=address` bắt tràn mảng, leak), UndefinedBehaviorSanitizer (`-fsanitize=undefined`), ThreadSanitizer (`-fsanitize=thread` bắt data race), Valgrind Memcheck.

#### 3. Bẫy Lập trình (Gotchas & Hazards)
* ⚠️ **Struct Padding Bloat:** Khai báo các trường lộn xộn (`char`, `double`, `int`) làm compiler chèn nhiều byte đệm padding lãng phí bộ nhớ. Khắc phục: Sắp xếp các trường từ kích thước lớn đến nhỏ (`double` $\rightarrow$ `int` $\rightarrow$ `char`).
* ⚠️ **Benchmark Rỗng do Compiler Tối ưu:** Đo thời gian vòng lặp tính toán nhưng không sử dụng kết quả, compiler nhận thấy Dead Code và loại bỏ toàn bộ vòng lặp, thời gian đo trả về 0ns.

---

## 💡 HƯỚNG DẪN TỰ THỰC HÀNH & NẮM VỮNG KIẾN THỨC (BLANK SCREEN CHALLENGE)

Để chuyển hóa toàn bộ hệ thống từ khóa và Mental Model của 12 Trụ cột này thành kỹ năng lập trình phản xạ:

1. **Tra cứu Định vị theo Tầng & Chuẩn C++:** Xác định chủ đề cần nắm vững và phiên bản C++ môi trường mục tiêu hỗ trợ (ví dụ: *Tầng 1 - Pillar 1: Linking & ABI* trên C++11, hoặc *Tầng 4 - Pillar 9: Zero-Copy Views* trên C++14).
2. **Xem Sơ đồ Mental Model & Bảng Tương thích:** Tra cứu cú pháp chuẩn hoặc giải pháp thay thế tương đương (*Legacy Workaround*).
3. **Đối chiếu Bài tập Mẫu:** Mở thư mục mã nguồn tương ứng trong `baitap_src/` để đối chiếu cách triển khai thực tế.
4. **Thử thách Màn hình Trắng (Blank Screen Challenge):** Mở một file mã nguồn rỗng trên môi trường WSL, tự gõ lại toàn bộ bài tập và cấu hình `CMakeLists.txt` / `Makefile` từ đầu. Biên dịch với cờ kiểm tra nghiêm ngặt:
   ```bash
   # Kiểm thử với chuẩn C++11
   g++ -std=c++11 -Wall -Wextra -Wpedantic -Werror -fsanitize=address,undefined main.cpp -o app_cpp11

   # Kiểm thử với chuẩn C++14 (Chuẩn AUTOSAR C++14)
   g++ -std=c++14 -Wall -Wextra -Wpedantic -Werror -fsanitize=address,undefined main.cpp -o app_cpp14
   ```
   Nếu chương trình biên dịch thành công với 0 cảnh báo và vượt qua mọi test case, khối kiến thức của Trụ cột đó đã hoàn toàn được làm chủ!
