# Exception Handling trong Phát Triển ECU (C++)

> [!IMPORTANT]
> **Mục tiêu**:
> Hiểu rõ cơ chế và best practices khi quản lý ngoại lệ (Exception Handling) trong hệ thống nhúng ô tô (ECU) tuân thủ tiêu chuẩn an toàn AUTOSAR và ISO 26262: Stack Unwinding, an toàn ngoại lệ qua RAII, cấm tuyệt đối ngoại lệ trong ISR, tác động của `-fno-exceptions` đối với bộ nhớ Flash và mô hình thay thế hiện đại (`std::expected`).

---

## 1. Cơ Chế Xử Lý Ngoại Lệ trong C++

> [!NOTE]
> **Sử Dụng Exception Đại Diện Cho Lỗi Hệ Thống**
> Trong các hệ thống C++ hiện đại (đặc biệt là nền tảng Adaptive AUTOSAR trên Linux/POSIX), ưu tiên sử dụng Exception để biểu diễn các lỗi nghiêm trọng (ví dụ: mất kết nối bus mạng, lỗi phần cứng cảm biến) thay vì sử dụng error codes (Mã lỗi kiểu C), giúp phân tách rành mạch luồng logic chính và luồng xử lý lỗi.

```cpp
#include <exception>
#include <iostream>

class SensorReadException : public std::exception
{
public:
    const char* what() const noexcept override
    {
        return "LỖI PHẦN CỨNG: Không thể đọc cảm biến nhiệt độ động cơ!";
    }
};

float readEngineTemperature()
{
    if (/* Phát hiện mất kết nối I2C/SPI */ true)
    {
        throw SensorReadException();
    }
    return 85.5f;
}
```

---

## 2. RAII và Exception Safety (An Toàn Ngoại Lệ)

### 2.1 Các Cấp Độ An Toàn Ngoại Lệ (Exception Safety Levels)
1. **Basic Guarantee:** Nếu ngoại lệ xảy ra, không bị rò rỉ bộ nhớ và đối tượng vẫn ở trạng thái hợp lệ.
2. **Strong Guarantee:** Hoặc thao tác thành công hoàn toàn, hoặc hệ thống quay về đúng trạng thái ban đầu như chưa có chuyện gì xảy ra (Commit-or-Rollback).
3. **Nothrow Guarantee (`noexcept`):** Cam kết tuyệt đối không bao giờ bắn ngoại lệ ra ngoài (bắt buộc cho destructors, swap, và move constructors).

### 2.2 Case Study: Rò Rỉ Khóa Mutex & Treo Hệ Thống Phanh Khi Exception Bắn Qua Hàm Non-RAII

> [!CAUTION]
> **Bối cảnh:** Module điều khiển phanh tái sinh năng lượng trên xe Hybrid. Khi nhận bản tin yêu cầu lực phanh, hàm điều khiển khóa `m_brakeMutex`, thực hiện giải thuật tính toán phân bổ mô-men xoắn rồi mở khóa.
> **Triệu chứng:** Khi bộ điều áp bị quá nhiệt, hàm con bên trong ném ra ngoại lệ `ThermalThresholdException`. Khối `catch` ở tầng trên bắt được ngoại lệ, nhưng từ thời điểm đó toàn bộ xe bị đơ phanh: Các luồng khác đều bị đóng băng tại `m_brakeMutex.lock()` vĩnh viễn (Deadlock).

```cpp
// TRƯỚC (Lỗi): Khóa và mở khóa mutex thủ công không an toàn ngoại lệ
#include <mutex>

std::mutex m_brakeMutex;

void applyRegenBrakingBad(float torqueRequest)
{
    m_brakeMutex.lock(); // Khóa thủ công

    // Hàm con kiểm tra nhiệt độ và có thể NÉM NGOẠI LỆ
    validateThermalLimits(); 

    // LỖI CHÍ MẠNG: Nếu validateThermalLimits() ném exception,
    // dòng unlock phía dưới BỊ BỎ QUA HOÀN TOÀN!
    // Stack bị unwound nhưng mutex vẫn ở trạng thái KHÓA VĨNH VIỄN!
    m_brakeMutex.unlock();
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ STACK UNWINDING VÀ SỰ CỨU NGUY CỦA RAII                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Non-RAII (Bỏ sót unlock):                                                │
│    lock() ──▶ throw Exception ──▶ Nhảy vọt qua unlock() ──▶ DEADLOCK!       │
│                                                                             │
│ 2. RAII Lock Guard (Stack Unwinding tự động dọn dẹp):                       │
│    std::lock_guard lock(mtx)                                                │
│         │                                                                   │
│         ├───▶ throw Exception phát sinh                                     │
│         │                                                                   │
│         └───▶ C++ Runtime tự động gọi Destructor ~lock_guard()              │
│               ──▶ Mutex ĐƯỢC MỞ KHÓA TỰ ĐỘNG trước khi bay vào catch!       │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Sử dụng std::lock_guard bảo đảm Exception Safety chuẩn Allman
#include <mutex>

std::mutex g_brakeMutex;

void applyRegenBrakingSafe(float torqueRequest)
{
    // Áp dụng RAII: Constructor tự động khóa mutex
    std::lock_guard<std::mutex> lock(g_brakeMutex);

    // Kể cả khi hàm này có ném exception:
    // C++ Runtime đảm bảo gọi Destructor của toàn bộ biến cục bộ trên Stack
    validateThermalLimits(); 

    // Destructor của lock_guard tự động giải phóng mutex trong mọi trường hợp!
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Tuyệt đối không bao giờ gọi các hàm `lock()`/`unlock()`, `new`/`delete`, hoặc `open()`/`close()` một cách trần trụi.
> - RAII (Resource Acquisition Is Initialization) là trụ cột sống còn để đạt tiêu chuẩn Exception Safety trong C++. Mọi tài nguyên phải được bọc trong các lớp có destructor tự giải phóng khi Stack Unwinding xảy ra.

---

## 3. Cấm Tuyệt Đối Ngoại Lệ Trong ISR (Interrupt Service Routines)

### 3.1 Lý Do Kỹ Thuật
ISR là hàm phục vụ ngắt phần cứng, chạy ở ngữ cảnh đặc biệt (không có Thread Stack thông thường, không có bảng `.eh_frame` unwind của C++ Runtime). Nếu một ngoại lệ bị ném bên trong ISR, bộ vi điều khiển sẽ kích hoạt lỗi phần cứng `Hard Fault` hoặc `Panic` ngay tức khắc.

### 3.2 Case Study: Exception Trong ISR Gây Hard Fault Trên ARM Cortex-M4

> [!CAUTION]
> **Bối cảnh:** Firmware bare-metal (không dùng OS) trên vi điều khiển ARM Cortex-M4 điều khiển biến tần xe điện. Hàm ngắt định thời Timer ISR (`TIM2_IRQHandler`) đọc giá trị cảm biến dòng điện ADC. Firmware biên dịch với cờ mặc định của GCC (`-fexceptions`).
> **Triệu chứng:** Khi cảm biến bị ngắt dây và trả về giá trị $4095$ (Over-range), vi điều khiển lập tức nhảy vào `HardFault_Handler` và treo cứng toàn bộ hệ thống. Trình nạp J-Link debugger chỉ ra con trỏ lệnh PC đang kẹt tại vùng nhớ xử lý unwinding của thư viện `libgcc_s`.

```cpp
// TRƯỚC (Lỗi): Ném exception bên trong ngắt phần cứng ISR
extern "C" void TIM2_IRQHandler(void)
{
    int16_t raw_current = readAdcChannel(0);
    if (raw_current >= 4095)
    {
        // LỖI CHÍ MẠNG: ISR chạy trên Main Stack Pointer (MSP) với layout phần cứng,
        // C++ Exception Unwinder cố gắng truy ngược call frame nhưng không tìm thấy
        // cấu trúc stack hợp lệ -> Kích hoạt CPU Fault Trap ngay lập tức!
        throw std::runtime_error("Dòng điện vượt ngưỡng an toàn!");
    }
    processCurrent(raw_current);
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ BỐ CỤC STACK FRAME CỦA ISR KHI C++ EXCEPTION UNWINDER CỐ TRUY NGƯỢC        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ARM Cortex-M4 Hardware Context: [ R0-R3, R12, LR, PC, xPSR ] (Phần cứng lưu)│
│                                                                             │
│ C++ Exception Unwinder (.eh_frame):                                         │
│ Cố gắng tìm con trỏ Frame Pointer và Unwind Table của C++...                 │
│ ──▶ Không tìm thấy frame hợp lệ ──▶ Đọc trúng vùng cấm (Memory Fault)       │
│ ──▶ HARD FAULT TRAP KÍCH HOẠT ──▶ XE DỪNG KHẨN CẤP!                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Cơ chế Atomic Status Flag + std::expected (C++23) chuẩn Allman
#include <atomic>
#include <cstdint>

// Biến cờ ngắt bất khả phân giao tiếp giữa ISR và Task chính
std::atomic<bool> g_overcurrentFlag{false};

extern "C" void TIM2_IRQHandler(void)
{
    int16_t raw_current = readAdcChannel(0);
    if (raw_current >= 4095)
    {
        // Đặt cờ trạng thái nguyên tử không khóa, thoát ngắt an toàn 100%
        g_overcurrentFlag.store(true, std::memory_order_release);
        return;
    }
    processCurrent(raw_current);
}

// Xử lý lỗi an toàn tại cấp độ Task thông thường (Thread Context):
void motorControlTask()
{
    if (g_overcurrentFlag.load(std::memory_order_acquire))
    {
        g_overcurrentFlag.store(false, std::memory_order_relaxed);
        // Ngắt cầu H bảo vệ an toàn động cơ
        shutdownInverterHardware();
        logDiagnosticCode(0xE001);
    }
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - **Quy tắc vàng AUTOSAR C++14 (Rule A15-1-1):** Nghiêm cấm tuyệt đối việc sử dụng `throw` trong bất kỳ hàm ngắt (ISR), Destructor, hoặc hàm xử lý tín hiệu OS (Signal Handler).
> - Giao tiếp giữa tầng ngắt và tầng ứng dụng phải luôn luôn thông qua các biến cờ nguyên tử `std::atomic<bool>` hoặc các Lock-free Ring Buffer tĩnh.

---

## 4. Chi Phí Vận Hành & Tiêu Chuẩn AUTOSAR C++14 (`-fno-exceptions`)

### 4.1 Chi Phí Ẩn Của Exception
1. **Dung lượng Flash ROM:** Việc bật exception yêu cầu compiler sinh các bảng metadata `.eh_frame` và `.gcc_except_table` để hỗ trợ tra cứu stack khi lỗi phát sinh, làm tăng dung lượng binary từ 15% đến 25%.
2. **Tính Bất Định Về Thời Gian (Non-deterministic Timing):** Khi một ngoại lệ bị ném ra, việc duyệt qua hàng loạt stack frame và tra cứu bảng bảng hash trong runtime có thể mất từ vài microsecond đến vài millisecond. Đây là điều tối kỵ trong các hệ thống phanh ABS hoặc túi khí (Hard Real-Time).

### 4.2 Lựa Chọn Thay Thế Hiện Đại Khi Tắt Exception
Khi biên dịch với cờ `-fno-exceptions -fno-rtti`:
- Sử dụng mô hình `Result<T, E>` hoặc `std::expected<T, E>` (C++23) đại diện tường minh cho kết quả tính toán hoặc mã lỗi.

```cpp
#include <system_error>

// Mô hình Result Pattern an toàn cho Automotive ASIL-D không cần exception:
template <typename T, typename E>
class Result
{
private:
    T m_value{};
    E m_error{};
    bool m_hasValue{false};

public:
    Result(T val) : m_value(std::move(val)), m_hasValue(true) {}
    Result(E err) : m_error(err), m_hasValue(false) {}

    bool has_value() const { return m_hasValue; }
    const T& value() const { return m_value; }
    const E& error() const { return m_error; }
};
```

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: try-catch block](https://en.cppreference.com/w/cpp/language/try_catch) | Cơ chế xử lý ngoại lệ, Stack Unwinding |
| [cppreference: noexcept specifier](https://en.cppreference.com/w/cpp/language/noexcept_spec) | Cam kết an toàn ngoại lệ compile-time |
| [cppreference: std::expected](https://en.cppreference.com/w/cpp/utility/expected) | Type-safe error handling không cần ném exception (C++23) |
| *AUTOSAR C++14 Guidelines* — Rule A15-1-1 to A15-5-3 | Quy chuẩn cấm exception trong ISR, destructor và ASIL-D ECU |
| [ARM Architecture Reference Manual](https://developer.arm.com/) | Cấu trúc phần cứng Exception & Interrupt trên ARM Cortex-M |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Giải Pháp Kỹ Thuật |
| :--- | :--- |
| Đảm bảo giải phóng khóa khi có lỗi | `std::lock_guard` / RAII Wrappers (Exception Safety) |
| Báo lỗi từ tầng ngắt phần cứng (ISR) | Đặt biến cờ nguyên tử `std::atomic<bool>`, cấm `throw` |
| Hệ thống an toàn ASIL-D (Tài nguyên thấp) | Biên dịch `-fno-exceptions` + Sử dụng `Result`/`std::expected` |
| Cam kết hàm không bao giờ văng lỗi | Đánh dấu hàm với từ khóa `noexcept` |
| Chuyển giao thông tin lỗi giàu ngữ cảnh | Kế thừa từ `std::exception` và override `what()` |
