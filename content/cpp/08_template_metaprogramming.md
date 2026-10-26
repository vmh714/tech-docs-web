# Template Metaprogramming (TMP) cho Hệ Thống Nhúng (ECU)

> [!IMPORTANT]
> **Mục tiêu**:
> Nắm bắt cách sử dụng Template trong C++ để dịch chuyển logic kiểm tra và cấp phát từ thời điểm chạy (runtime) sang thời điểm biên dịch (compile-time), giúp tối ưu hiệu năng tuyệt đối (Zero runtime overhead) theo chuẩn thiết kế ECU hiện đại: Cấu hình tĩnh, SFINAE (`std::enable_if`), `if constexpr` (C++17), quản lý bộ nhớ không phân mảnh và kỹ thuật kiểm soát kích thước mã máy (Template Bloat Prevention).

---

## 1. Cấu hình tại thời điểm biên dịch (Compile-Time Configuration)

> [!NOTE]
> **Loại bỏ `#define` Macro truyền thống:**
> Tránh sử dụng Macro tiền xử lý (Preprocessor Macros) của ngôn ngữ C, thay vào đó dùng cấu hình dựa trên Template. Cấu hình bằng Template mang lại **Type Safety (An toàn kiểu dữ liệu)** và dễ gỡ lỗi hơn rất nhiều.

```cpp
template <typename Config>
class ECUModule
{
public:
    // Giá trị hằng số được quyết định khi compile, tiết kiệm RAM/ROM
    static constexpr bool DEBUG_ENABLED = Config::debug_mode;
    static constexpr size_t MAX_SENSORS = Config::sensor_count;
};
```
**Lợi ích:** Không tốn tài nguyên runtime (Zero runtime overhead), các lỗi thiết lập sẽ được compiler bắt ngay lúc biên dịch thay vì chạy thử nghiệm mới thấy.

---

## 2. Kiểm tra Kiểu An Toàn Dữ Liệu (Type Safety với SFINAE & Concepts)

### 2.1 Cơ Chế SFINAE (Substitution Failure Is Not An Error)
Kỹ thuật SFINAE và `std::enable_if` cho phép chúng ta từ chối biên dịch nếu kiểu truyền vào template không đạt yêu cầu phần cứng. Điều này cực kỳ quan trọng trong môi trường Embedded/ECU để cấm sử dụng các kiểu dữ liệu không hợp lệ đối với bộ nhớ thanh ghi cảm biến.

### 2.2 Case Study: Bảo Vệ Giao Tiếp Thanh Ghi Phần Cứng Bằng SFINAE & `if constexpr`

> [!CAUTION]
> **Bối cảnh:** Thư viện điều khiển truy xuất thanh ghi Memory-Mapped I/O (MMIO Driver) cho vi điều khiển ARM Cortex-M4. Thanh ghi phần cứng chỉ chấp nhận ghi các độ rộng chuẩn: 8-bit (`uint8_t`), 16-bit (`uint16_t`), hoặc 32-bit (`uint32_t`).
> **Triệu chứng:** Kỹ sư vô tình truyền kiểu dữ liệu số thực `float` hoặc struct vào hàm ghi thanh ghi. Trình biên dịch C truyền thống dùng ép kiểu `(uint32_t)value` làm méo mó bitmask phần cứng, dẫn tới việc cấu hình sai chân PWM điều khiển động cơ bướm ga.

```cpp
// TRƯỚC (Lỗi): C-style macro ép kiểu bừa bãi gây hỏng thanh ghi
#define WRITE_REG(addr, val) (*(volatile uint32_t*)(addr) = (uint32_t)(val))

void configureThrottleBad()
{
    float targetVoltage = 3.3f;
    // LỖI NGUY HIỂM: Ép kiểu ngầm định float 3.3f thành (uint32_t)3
    // Mất toàn bộ phần thập phân và ghi bitmask sai vào thanh ghi PWM!
    WRITE_REG(0x40001000, targetVoltage);
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SFINAE & COMPILE-TIME FILTERING: CHẶN LỖI NGAY TẠI COMPILER                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Gọi với kiểu hợp lệ: writeRegister<uint16_t>(0x40001000, 0x01FF)         │
│    std::is_integral_v<T> == true && sizeof(T) <= 4                          │
│    ──▶ Compiler sinh mã máy tối ưu 1 lệnh STRH (Store Halfword)             │
│                                                                             │
│ 2. Gọi với kiểu sai: writeRegister<float>(0x40001000, 3.3f)                 │
│    std::is_integral_v<float> == false                                       │
│    ──▶ Substitution Failure ──▶ COMPILER BÁO LỖI NGAY LẬP TỨC!              │
│    (Zero runtime check, zero memory overhead)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Áp dụng SFINAE / if constexpr ràng buộc thanh ghi chuẩn Allman
#include <type_traits>
#include <cstdint>

template <typename T>
struct is_valid_register_type : std::integral_constant<bool,
    std::is_integral_v<T> && (sizeof(T) == 1 || sizeof(T) == 2 || sizeof(T) == 4)> {};

template <typename T, typename = std::enable_if_t<is_valid_register_type<T>::value>>
void writeRegisterSafe(uintptr_t reg_addr, T val)
{
    volatile T* reg = reinterpret_cast<volatile T*>(reg_addr);
    *reg = val;
}

// Phiên bản Modern C++17 sử dụng if constexpr và static_assert:
template <typename T>
void writeRegisterModern(uintptr_t reg_addr, T val)
{
    static_assert(std::is_integral_v<T>, "LỖI: Thanh ghi chỉ chấp nhận số nguyên!");
    static_assert(sizeof(T) <= 4, "LỖI: Độ rộng thanh ghi tối đa là 32-bit!");

    volatile T* reg = reinterpret_cast<volatile T*>(reg_addr);
    *reg = val;
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Kỹ thuật Compile-time Type Filtering biến mọi lỗi logic của lập trình viên thành lỗi biên dịch (Compile error).
> - Trong C++17, việc kết hợp `static_assert` với `if constexpr` mang lại thông điệp lỗi rõ ràng hơn nhiều so với cú pháp SFINAE `std::enable_if` truyền thống của C++11.

---

## 3. Quản lý Bộ Nhớ với Template (Memory Pools)

> [!CAUTION]
> **Ngăn chặn phân mảnh bộ nhớ (Memory Fragmentation)**
> Trong ECU, cấp phát động (Dynamic Allocation / Heap) bằng `new/delete` hoặc `malloc/free` ở vòng lặp thời gian thực có nguy cơ lớn gây phân mảnh bộ nhớ và tràn RAM.
> Thay vào đó, hãy sử dụng **Memory Pools** được thiết kế bằng Template để cấp phát trước một mảng bộ nhớ có kích thước cố định tại thời điểm compile-time (Stack hoặc vùng nhớ tĩnh BSS).

```cpp
template <typename T, size_t PoolSize>
class FixedMemoryPool
{
private:
    alignas(T) uint8_t m_storage[PoolSize * sizeof(T)];
    bool m_used[PoolSize]{false};

public:
    T* allocate()
    {
        for (size_t i = 0; i < PoolSize; ++i)
        {
            if (!m_used[i])
            {
                m_used[i] = true;
                return reinterpret_cast<T*>(&m_storage[i * sizeof(T)]);
            }
        }
        return nullptr; // Không bao giờ phân mảnh, thời gian xác định O(1)
    }

    void free(T* ptr)
    {
        uintptr_t offset = reinterpret_cast<uint8_t*>(ptr) - m_storage;
        size_t index = offset / sizeof(T);
        if (index < PoolSize)
        {
            m_used[index] = false;
        }
    }
};
```

---

## 4. Nguy Cơ Phình To Mã Nguồn (Template Bloat) & Biện Pháp Kiểm Soát

### 4.1 Nguyên Nhân Gây Template Bloat
Việc gọi Template với nhiều kiểu dữ liệu hoặc tham số phi kiểu (Non-type template parameters) khác nhau sẽ khiến compiler sinh ra nhiều bản sao độc lập của mã máy (binary code), dẫn đến hiện tượng **Template Bloat** làm tràn bộ nhớ Flash ROM của ECU.

### 4.2 Case Study: Template Bloat Gây Phình Binary 48MB Trên ECU Flash 4MB & Khắc Phục Bằng Non-Template Base

> [!CAUTION]
> **Bối cảnh:** Thư viện tính toán ma trận tổng quát `Matrix<T, Rows, Cols>` dùng cho thuật toán Kalman Filter trong hệ thống tự hành ADAS. Thuật toán được instantiate với hơn 20 tổ hợp kiểu dữ liệu (`float`, `double`, `int16_t`) và kích thước ma trận khác nhau ($3\times3, 4\times4, 6\times6$).
> **Triệu chứng:** Binary của bản build release phình to lên tới **48MB** — vượt quá 12 lần dung lượng bộ nhớ Flash vật lý (4MB) của vi điều khiển ECU. Lệnh `size -A` chỉ ra section `.text` chiếm tới 42MB do chứa hàng trăm bản copy mã máy của các phép toán ma trận.

```cpp
// TRƯỚC (Lỗi): Template Header-Only sinh hàng trăm bản mã máy trùng lặp
template <typename T, int Rows, int Cols>
class MatrixBad
{
private:
    T m_data[Rows * Cols];

public:
    // HÀM NHÂN MA TRẬN 50 DÒNG: Bị compiler nhân bản riêng cho MỖI tổ hợp <T, Rows, Cols>!
    // 20 tổ hợp khác nhau * 10 hàm toán học = 200 bản hàm nhân ma trận độc lập trong ROM!
    MatrixBad<T, Rows, Cols> multiply(const MatrixBad<T, Cols, Cols>& rhs) const
    {
        MatrixBad<T, Rows, Cols> res;
        for (int i = 0; i < Rows; ++i)
        {
            for (int j = 0; j < Cols; ++j)
            {
                T sum = 0;
                for (int k = 0; k < Cols; ++k)
                {
                    sum += m_data[i * Cols + k] * rhs.m_data[k * Cols + j];
                }
                res.m_data[i * Cols + j] = sum;
            }
        }
        return res;
    }
};
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ KỸ THUẬT BASE CLASS HOISTING: TRIỆT TIÊU TEMPLATE BLOAT TRONG FLASH ROM     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Header-only Naive Template (Phình ROM):                                  │
│    Matrix<float, 3, 3>::multiply ──▶ 1 bản mã máy trong .text (2.4 KB)      │
│    Matrix<float, 4, 4>::multiply ──▶ 1 bản mã máy trong .text (2.4 KB)      │
│    Matrix<float, 6, 6>::multiply ──▶ 1 bản mã máy trong .text (2.4 KB)      │
│    ... (200 hàm tương tự làm vỡ ROM 48MB)                                   │
│                                                                             │
│ 2. Non-Template Base Class Hoisting:                                        │
│    MatrixBase::multiplyRaw(void*, void*, void*) ──▶ DUY NHẤT 1 BẢN MÃ MÁY!  │
│    Wrapper template chỉ là hàm inline mỏng O(0) gọi về Base.                │
│    ==> Dung lượng nhị phân giảm từ 48MB xuống còn 1.8MB (Tiết kiệm 96% Flash)│
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Tách logic dùng chung vào Base Class phi-template chuẩn Allman
// File: matrix_base.h
class MatrixBase
{
protected:
    // Logic tính toán thô được biên dịch đúng 1 lần trong file .cpp
    static void multiplyRaw(const float* a, const float* b, float* out,
                            int rows, int cols, int rCols);
};

// File: matrix_base.cpp
void MatrixBase::multiplyRaw(const float* a, const float* b, float* out,
                             int rows, int cols, int rCols)
{
    for (int i = 0; i < rows; ++i)
    {
        for (int j = 0; j < rCols; ++j)
        {
            float sum = 0.0f;
            for (int k = 0; k < cols; ++k)
            {
                sum += a[i * cols + k] * b[k * rCols + j];
            }
            out[i * rCols + j] = sum;
        }
    }
}

// File: matrix.h — Template Wrapper mỏng nhẹ bảo đảm Type-Safety
template <int Rows, int Cols>
class MatrixSafe : private MatrixBase
{
private:
    float m_data[Rows * Cols];

public:
    MatrixSafe<Rows, Cols> multiply(const MatrixSafe<Cols, Cols>& rhs) const
    {
        MatrixSafe<Rows, Cols> result;
        // Chỉ ủy quyền sang hàm duy nhất của Base Class
        multiplyRaw(m_data, rhs.m_data, result.m_data, Rows, Cols, Cols);
        return result;
    }
};

// Kết hợp Explicit Instantiation cho các tổ hợp quan trọng:
// extern template class MatrixSafe<3, 3>;
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Kỹ thuật **Base Class Hoisting** (được áp dụng triệt để trong `std::vector<void*>` của thư viện chuẩn libstdc++) tách toàn bộ logic tính toán không phụ thuộc kiểu vào class cha phi-template, chỉ để lại lớp vỏ bọc mỏng bên ngoài.
> - Kết hợp cờ linker `-Wl,--gc-sections` và cờ compiler `-ffunction-sections -fdata-sections` để trình liên kết tự động loại bỏ những bản mã template không bao giờ được gọi tới.

---

## 5. Two-Phase Lookup (Tra cứu 2 pha)

Compiler xử lý template qua 2 pha rõ rệt:

| Pha | Thời điểm | Nội dung kiểm tra |
|:---:|:---|:---|
| **Pha 1** (Definition) | Khi compiler đọc định nghĩa template | Cú pháp chung, các tên **không phụ thuộc** kiểu `T` (Non-dependent names) |
| **Pha 2** (Instantiation) | Khi template được gọi với kiểu cụ thể | Các tên **phụ thuộc** kiểu `T` (Dependent names), kiểm tra tính hợp lệ của hàm/biến |

```cpp
template <typename T>
void processData(T val)
{
    undeclared_func();    // Lỗi Pha 1: Tên không phụ thuộc T, không tồn tại
    val.readSensor();     // Pha 2: Chỉ kiểm tra khi có kiểu T cụ thể
    typename T::DataType x; // 'typename' bắt buộc để báo cho compiler biết T::DataType là một kiểu
}
```

---

## 6. Template Specialization (Chuyên biệt hóa)

- **Full Specialization**: Chuyên biệt hóa hoàn toàn cho 1 kiểu dữ liệu cụ thể (ví dụ: `template<> struct Serializer<std::string>`).
- **Partial Specialization**: Chuyên biệt hóa cho một họ kiểu dữ liệu (ví dụ: `template<typename T> struct Serializer<T*>`).
*Lưu ý:* Hàm mẫu (Function Template) **không** hỗ trợ partial specialization — phải dùng kỹ thuật nạp chồng hàm (Function Overloading) hoặc `if constexpr` để thay thế.

---

## 7. Variadic Templates & Fold Expressions (C++17)

Thu gọn danh sách tham số tùy biến (Parameter Pack) chỉ với một dòng mã nguồn trong sáng:

```cpp
#include <iostream>

// Fold expression tính tổng:
template <typename... Args>
auto sumAll(Args... args)
{
    return (... + args); // Unary Left Fold
}

// Comma fold in toàn bộ giá trị:
template <typename... Args>
void printAll(Args... args)
{
    ((std::cout << args << " "), ...);
    std::cout << "\n";
}
```

---

## 8. C++20 Concepts — Thay Thế SFINAE Trực Quan

```cpp
#include <concepts>

template <typename T>
concept NumericType = std::is_arithmetic_v<T>;

template <NumericType T>
T calculateSensorGain(T raw, T factor)
{
    return raw * factor;
}
```

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: Templates](https://en.cppreference.com/w/cpp/language/templates) | Two-phase lookup, Dependent names, Template Specialization |
| [cppreference: std::enable_if](https://en.cppreference.com/w/cpp/types/enable_if) | SFINAE mechanics, Compile-time type filtering |
| [cppreference: Constraints and concepts](https://en.cppreference.com/w/cpp/language/constraints) | C++20 Concepts, `requires` clauses, Abbreviated function templates |
| [cppreference: Fold expression](https://en.cppreference.com/w/cpp/language/fold) | C++17 Fold expressions (Unary/Binary Left/Right folds) |
| [Effective Modern C++ — Item 26, 27 (Bản dịch TV)](../../effective_modern_cpp/item_26.md) | Tránh nạp chồng hàm trên Universal References & Các giải pháp thay thế (Tag dispatch, `enable_if`) (xem thêm [Item 27](../../effective_modern_cpp/item_27.md)) |
| [Effective Modern C++ — Item 28, 29, 30 (Bản dịch TV)](../../effective_modern_cpp/item_28.md) | Reference Collapsing, Giới hạn của Move và Các trường hợp thất bại của Perfect Forwarding (xem thêm [Item 29](../../effective_modern_cpp/item_29.md), [Item 30](../../effective_modern_cpp/item_30.md)) |
| *C++ Templates: The Complete Guide 2nd Ed.* (Vandevoorde, Josuttis, Gregor) | Kinh điển toàn diện về Template Metaprogramming và Template Bloat management |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Giải Pháp Kỹ Thuật |
| :--- | :--- |
| Cấu hình tĩnh thay `#define` | Template + `static constexpr` member |
| Lọc kiểu đầu vào (C++11/14) | `std::enable_if_t<Condition, T>` (SFINAE) |
| Lọc kiểu trực quan (C++20) | `template<Concept T>` hoặc mệnh đề `requires` |
| Rẽ nhánh tại compile-time (C++17) | `if constexpr (condition) { ... }` |
| Hàm nhận số tham số tùy ý | Variadic templates `Args...` + Fold Expressions (C++17) |
| Memory Pool tĩnh chống phân mảnh | `template<typename T, size_t N> class FixedMemoryPool` |
| Khắc phục Template Bloat phình ROM | Base Class Hoisting + Explicit Instantiation |
| Chuyên biệt xử lý cho 1 kiểu | Full Specialization `template<> struct Handler<SpecificType>` |
