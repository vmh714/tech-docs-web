# Modern C++ (C++11/14/17) — Tính Năng Thiết Yếu

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp các tính năng Modern C++ thiết yếu cho kỹ sư phần mềm hệ thống và Embedded AI: Move Semantics (tối ưu hóa $O(1)$ chuyển giao tài nguyên), Lambda Expressions (hàm nặc danh và kiểm soát vòng đời capture), `constexpr` (tính toán compile-time), Vocabulary Types (`std::optional`, `std::variant`), và Structured Bindings (C++17).

---

## 1. Move Semantics & Rvalue Reference

### 1.1 Giá Trị Lvalue vs Rvalue
- **Lvalue (Trái):** Các đối tượng có tên, có địa chỉ bộ nhớ cố định và tồn tại sau khi biểu thức kết thúc (ví dụ: biến cục bộ `int a`, đối tượng `std::vector v`).
- **Rvalue (Phải):** Dữ liệu tạm thời (temporaries), không có tên, chuẩn bị bị hủy ngay sau khi kết thúc biểu thức (ví dụ: giá trị trả về tạm thời của hàm, hằng số `42`, kết quả phép cộng `a + b`).

### 1.2 Cơ Chế Ăn Cắp Vùng Nhớ (Resource Stealing)
Rvalue Reference (`T&&`) cho phép nhận diện các đối tượng tạm thời chuẩn bị bị hủy. Thay vì cấp phát vùng nhớ mới và sao chép sâu toàn bộ dữ liệu ($O(N)$), Move Constructor chỉ cần:
1. Gán con trỏ của đối tượng mới trỏ tới vùng nhớ Heap của đối tượng cũ.
2. Thiết lập con trỏ của đối tượng cũ thành `nullptr`.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ BỐ CỤC BỘ NHỚ: DEEP COPY (O(N) MALLOC) VS MOVE SEMANTICS (O(1) POINTER SWAP)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Deep Copy: Cấp phát mới 120MB + sao chép từng byte qua DRAM bus          │
│                                                                             │
│   src_vec [_M_start] ───────────────▶ [ Heap Buffer: 120MB Image Data ]     │
│   dst_vec [_M_start] ───────────────▶ [ Heap Buffer MỚI: 120MB Copy ]       │
│                                                                             │
│ 2. Move Semantics: Ăn cắp 3 con trỏ (_M_start, _M_finish, _M_end) trong O(1)│
│                                                                             │
│   src_vec [_M_start = nullptr]                                              │
│                               \                                             │
│   dst_vec [_M_start] ──────────┴────▶ [ Heap Buffer Gốc: Giữ Nguyên 120MB ] │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **Bản chất của `std::move`:**
> Bản thân hàm `std::move` không di chuyển bất kỳ byte dữ liệu nào. Nó chỉ đơn thuần thực hiện một phép ép kiểu tĩnh `static_cast<T&&>` biến một Lvalue thành Rvalue Reference để compiler ưu tiên kích hoạt hàm dựng di chuyển (Move Constructor).

### 1.3 Quy Tắc Áp Dụng `std::move`
- **NÊN dùng:** Khi chuyển giao quyền sở hữu biến cục bộ vào hàm hoặc chèn vào container (`push_back(std::move(x))`) ở câu lệnh cuối cùng mà biến đó không còn được sử dụng nữa.
- **KHÔNG NÊN dùng:** Không dùng `return std::move(local_var);` vì hành động này sẽ triệt tiêu cơ chế Tối ưu hóa Giá trị Trả về (Named Return Value Optimization - NRVO) của compiler.

### 1.4 Case Study: Move Semantics Cứu Hiệu Năng Pipeline Thị Giác Máy Tính (CV Pipeline)

> [!CAUTION]
> **Bối cảnh:** Chuỗi xử lý Computer Vision 4 tầng: `Capture` $\rightarrow$ `Resize` $\rightarrow$ `Denoise` $\rightarrow$ `Detect`. Mỗi khung hình là một đối tượng `std::vector<uint8_t>` độ phân giải 4K chứa xấp xỉ 30MB dữ liệu ảnh thô. Các hàm được truyền và trả về theo dạng tham trị (Pass-by-value).
> **Triệu chứng:** Pipeline chỉ đạt tốc độ 2.1fps trên bo mạch nhúng ARM Cortex-A72. Công cụ `perf` báo cáo 85% thời gian xử lý của CPU bị tiêu tốn trong hàm `memcpy` tầng Kernel — sao chép lặp lại 30MB qua 4 giai đoạn = **120MB copy vô nghĩa cho mỗi khung hình**.

```cpp
// TRƯỚC (Kém tối ưu): Truyền tham trị gây lặp lại Deep Copy 120MB/frame
std::vector<uint8_t> resizeFrame(std::vector<uint8_t> frame)   // Copy 30MB #1
{
    // ... Thuật toán resize ...
    return frame; // Copy 30MB #2 (nếu NRVO bị vô hiệu hóa)
}

std::vector<uint8_t> denoiseFrame(std::vector<uint8_t> frame)  // Copy 30MB #3
{
    // ... Khử nhiễu ...
    return frame; // Copy 30MB #4
}

void badVisionPipeline()
{
    std::vector<uint8_t> raw = captureCamera();      // 30MB
    std::vector<uint8_t> resized = resizeFrame(raw); // Sao chép sâu
    std::vector<uint8_t> denoised = denoiseFrame(resized);
    // Tiêu tốn 120MB DRAM bandwidth cho mỗi khung hình!
}
```

```cpp
// SAU (Khắc phục): Di chuyển quyền sở hữu O(1) bằng std::move chuẩn Allman
#include <vector>
#include <cstdint>
#include <utility>

std::vector<uint8_t> resizeFrameFast(std::vector<uint8_t> frame)
{
    // Thao tác trực tiếp trên bộ đệm được chuyển quyền sở hữu
    return frame; // Compiler kích hoạt implicit move
}

std::vector<uint8_t> denoiseFrameFast(std::vector<uint8_t> frame)
{
    return frame;
}

void optimizedVisionPipeline()
{
    std::vector<uint8_t> raw = captureCamera();
    
    // std::move biến lvalue thành rvalue -> Kích hoạt Move Constructor
    // Chỉ hoán đổi 3 con trỏ nội bộ (data, size, capacity) trong 15 nanoseconds!
    std::vector<uint8_t> resized = resizeFrameFast(std::move(raw));
    
    // raw sau khi move rơi vào trạng thái valid but unspecified (rỗng) -> không truy cập lại
    std::vector<uint8_t> denoised = denoiseFrameFast(std::move(resized));
    
    // Tổng chi phí copy: 0 Bytes! Tốc độ tăng từ 2.1fps lên 29.4fps (tăng tốc 14 lần)
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Move Semantics biến các thao tác chuyển giao vùng nhớ lớn từ độ phức tạp $O(N)$ thành $O(1)$ chỉ trong vài chu kỳ CPU.
> - Sau khi gọi `std::move(obj)`, đối tượng `obj` không bị hủy ngay nhưng đã bị rút hết tài nguyên bên trong. Tuyệt đối không đọc dữ liệu từ một biến đã bị move.

---

## 2. Lambda Expressions & Cơ Chế Capture Vòng Đời

### 2.1 Cấu Trúc Khối Lambda
`[capture_list](parameter_list) -> return_type { function_body }`

### 2.2 Các Kiểu Capture Danh Sách Biến Ngoài
- `[=]`: Sao chép tất cả biến bên ngoài theo giá trị (Pass-by-value). An toàn nhưng tốn bộ nhớ với object lớn.
- `[&]`: Bắt tất cả biến bên ngoài theo tham chiếu (Pass-by-reference). Hiệu năng cao nhưng cực kỳ nguy hiểm nếu lambda chạy bất đồng bộ (Asynchronous).
- `[data = std::move(ptr)]`: Init-Capture (C++14) hỗ trợ di chuyển các đối tượng Move-Only (`std::unique_ptr`) vào trong closure của Lambda.

### 2.3 Case Study: Con Trỏ Hoang (Dangling Reference) Khi Lambda Bắt Biến Stack Trong Async Event Bus

> [!CAUTION]
> **Bối cảnh:** Đăng ký hàm xử lý sự kiện (Event Callback) vào hệ thống Bus thông báo trạng thái xe hơi. Khi nhận bản tin cảnh báo tốc độ, hệ thống ghi log và cảnh báo tài xế.
> **Triệu chứng:** Ứng dụng thi thoảng bị crash với lỗi `Segmentation Fault` hoặc in ra các ký tự rác khó hiểu. Lỗi chỉ phát sinh khi sự kiện kích hoạt sau khi hàm đăng ký đã kết thúc vòng đời.

```cpp
// TRƯỚC (Lỗi): Capture tham chiếu biến cục bộ trên Stack vào Lambda bất đồng bộ
#include <functional>
#include <string>

std::function<void()> g_onAlertCallback;

void registerSpeedAlert()
{
    // Biến cục bộ nằm trên Stack của hàm registerSpeedAlert
    std::string alertMsg = "CẢNH BÁO: Tốc độ vượt ngưỡng 120 km/h!";

    // LỖI NGUY HIỂM: Capture [&] tham chiếu tới alertMsg
    g_onAlertCallback = [&alertMsg]()
    {
        // Khi hàm registerSpeedAlert kết thúc, frame stack bị hủy (unwound)
        // Biến alertMsg bị thu hồi vùng nhớ. Khi callback này được gọi bởi Event Bus:
        // alertMsg trở thành Dangling Reference -> Đọc rác hoặc sập tiến trình!
        sendToHeadUpDisplay(alertMsg);
    };
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SỰ CỐ DANGLING REFERENCE TRÊN STACK FRAME KHI GỌI ASYNC CALLBACK           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Thời điểm t0: Đăng ký Callback                                              │
│ [ Stack Frame: registerSpeedAlert ] ── alertMsg ("Cảnh báo...") ◄──┐       │
│                                                                     │       │
│ Thời điểm t1: Hàm kết thúc -> Frame Stack BỊ GIẢI PHÓNG            │       │
│ [ Vùng nhớ Stack bị ghi đè bởi hàm khác ]                           │       │
│                                                                     │       │
│ Thời điểm t2: Event Bus kích hoạt Callback                          │       │
│ g_onAlertCallback() ── dereference địa chỉ cũ ──────────────────────┘       │
│                     ──▶ Truy cập vùng nhớ chết (USE-AFTER-FREE TRÊN STACK)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Sử dụng C++14 Init-Capture di chuyển quyền sở hữu vào Closure
#include <functional>
#include <string>
#include <utility>

std::function<void()> g_safeAlertCallback;

void registerSpeedAlertSafe()
{
    std::string alertMsg = "CẢNH BÁO: Tốc độ vượt ngưỡng 120 km/h!";

    // SỬ DỤNG INIT-CAPTURE: Di chuyển thẳng chuỗi alertMsg vào bên trong đối tượng Closure
    // Lambda giờ đây sở hữu một bản sao/move độc lập, tồn tại gắn liền với vòng đời của callback
    g_safeAlertCallback = [msg = std::move(alertMsg)]()
    {
        sendToHeadUpDisplay(msg); // An toàn tuyệt đối, không phụ thuộc Stack Frame
    };
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Tuyệt đối không sử dụng capture-by-reference `[&]` cho các Lambda được lưu trữ trong callback bất đồng bộ, event listener, hoặc dispatch sang một thread khác.
> - Sử dụng tính năng C++14 Generalized Lambda Capture `[var = std::move(x)]` để chuyển giao quyền sở hữu tài nguyên độc quyền vào bên trong Lambda.

---

## 3. `auto` & `decltype` — Tự Động Suy Diễn Kiểu Dữ Liệu

- **`auto`**: Suy diễn kiểu dữ liệu dựa trên giá trị khởi tạo. Loại bỏ việc phải viết các kiểu dữ liệu dài dòng như `std::vector<std::pair<int, std::string>>::const_iterator`. Lưu ý: `auto` mặc định loại bỏ tham chiếu (`&`) và hằng số (`const`). Muốn giữ lại phải khai báo rõ `const auto&`.
- **`decltype(expr)`**: Trích xuất chính xác kiểu dữ liệu của một biểu thức mà không thực thi biểu thức đó. Rất hữu ích khi viết template và generic wrappers.

---

## 4. `constexpr` & `consteval` — Tính Toán Tại Thời Điểm Biên Dịch

- **`constexpr` (C++11/14)**: Định nghĩa hàm hoặc biến có thể được tính toán ngay trong quá trình biên dịch (Compile-time) nếu các đối số đầu vào là hằng số. Giảm thời gian khởi động của chương trình về $0$ nanoseconds.
- **`consteval` (C++20)**: Bắt buộc hàm PHẢI được tính toán tại compile-time, nếu không sẽ báo lỗi biên dịch.

---

## 5. Vocabulary Types (`std::optional`, `std::variant`, `std::any`)

### 5.1 `std::optional<T>` (C++17)
Đại diện cho một giá trị có thể tồn tại hoặc không tồn tại, thay thế hoàn toàn cho việc dùng con trỏ NULL hoặc các mã lỗi ma thuật (-1, 0xFF) kiểu C.

### 5.2 `std::variant<Ts...>` (C++17)
Type-safe Union hiện đại. Có thể chứa một trong các kiểu dữ liệu được định nghĩa mà không cần cấp phát Heap, kết hợp hoàn hảo với `std::visit` cho kiến trúc Pattern Matching.

### 5.3 Case Study: Xử Lý Lỗi Và Dữ Liệu Hỗn Hợp Trong CAN Gateway Bằng std::optional & std::variant

> [!CAUTION]
> **Bối cảnh:** Bộ định tuyến mạng truyền thông trên ô tô (Automotive Gateway). Nhận các gói tin CAN-Bus từ nhiều cụm cảm biến: Radar (trả về struct khoảng cách `RadarTarget`), Cảm biến tốc độ bánh xe (trả về float `WheelSpeed`), hoặc mã lỗi hệ thống (enum `ErrorCode`).
> **Triệu chứng:** Mã nguồn C truyền thống sử dụng con trỏ `void*` kết hợp biến cờ `int data_type`. Lỗi ép sai kiểu dữ liệu con trỏ (Invalid Pointer Cast) xảy ra thường xuyên khi có gói tin mới, dẫn tới hiện tượng đọc sai dữ liệu cảm biến khiến xe tự động phanh gấp khi đang chạy trên cao tốc.

```cpp
// TRƯỚC (Lỗi): C-Style void* và out-parameter thiếu an toàn kiểu dữ liệu
enum DataType { TYPE_RADAR, TYPE_SPEED, TYPE_ERROR };

struct LegacyCanMessage
{
    int type;
    void* payload; // LỖI NGUY HIỂM: Mất toàn bộ thông tin kiểu dữ liệu tại compile-time
};

void processLegacyMessage(const LegacyCanMessage& msg)
{
    if (msg.type == TYPE_RADAR)
    {
        // Ép kiểu liều lĩnh: Nếu bên phát truyền nhầm float mà ép sang RadarTarget* -> UB!
        RadarTarget* target = reinterpret_cast<RadarTarget*>(msg.payload);
        applyEmergencyBrake(target->distance_m);
    }
}
```

```cpp
// SAU (Khắc phục): std::variant và Pattern Matching an toàn tuyệt đối với std::visit
#include <variant>
#include <optional>
#include <iostream>

struct RadarTarget
{
    float distance_m;
    float relative_speed_mps;
};

struct WheelSpeed
{
    float kph;
};

enum class CanError
{
    ChecksumFailed,
    BusTimeout
};

// Định nghĩa kiểu dữ liệu hợp nhất an toàn tại compile-time (Zero Heap Allocation)
using CanPayload = std::variant<RadarTarget, WheelSpeed, CanError>;

// Hàm giải mã an toàn trả về std::optional
std::optional<CanPayload> parseCanFrame(uint32_t can_id, const uint8_t* raw_bytes, size_t len)
{
    if (len == 0 || !raw_bytes)
    {
        return std::nullopt; // Báo hiệu không có dữ liệu mà không cần mã lỗi ma thuật
    }

    if (can_id == 0x100)
    {
        RadarTarget target{25.4f, -1.2f};
        return target;
    }
    else if (can_id == 0x200)
    {
        WheelSpeed speed{85.5f};
        return speed;
    }
    return CanError::ChecksumFailed;
}

// Xử lý gói tin bằng Pattern Matching (Visitor Pattern)
void dispatchCanMessage(const CanPayload& payload)
{
    std::visit([](auto&& arg)
    {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, RadarTarget>)
        {
            std::cout << "Đã nhận Radar: Khoảng cách = " << arg.distance_m << "m\n";
        }
        else if constexpr (std::is_same_v<T, WheelSpeed>)
        {
            std::cout << "Đã nhận Tốc độ bánh xe = " << arg.kph << " km/h\n";
        }
        else if constexpr (std::is_same_v<T, CanError>)
        {
            std::cout << "Lỗi Bus CAN phát sinh!\n";
        }
    }, payload);
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - `std::variant` lưu trữ dữ liệu trực tiếp bên trong vùng nhớ của nó (dựa trên `alignas` union nội bộ), hoàn toàn không cấp phát động trên Heap.
> - Kết hợp `std::variant` với `std::visit` và `if constexpr` (Compile-Time Branching) đảm bảo 100% không bao giờ xảy ra lỗi ép sai kiểu (Type Mismatch) tại runtime, bảo vệ tuyệt đối an toàn cho hệ thống Automotive.

---

## 6. Structured Bindings (C++17)

Cho phép giải nén (unpack) các phần tử từ `std::pair`, `std::tuple`, mảng tĩnh hoặc struct dữ liệu trực tiếp vào các biến riêng biệt một cách trong sáng:

```cpp
#include <tuple>
#include <string>
#include <map>
#include <iostream>

struct GpsCoordinate
{
    double latitude;
    double longitude;
    float altitude;
};

void demoStructuredBindings()
{
    // 1. Giải nén struct:
    GpsCoordinate coord{21.0285, 105.8542, 12.5f};
    auto [lat, lon, alt] = coord; // lat, lon, alt trở thành các biến độc lập

    // 2. Duyệt map một cách thanh thoát:
    std::map<std::string, int> sensorMap = {{"LiDAR", 1}, {"Camera", 2}};
    for (const auto& [sensorName, sensorId] : sensorMap)
    {
        std::cout << sensorName << " -> ID: " << sensorId << "\n";
    }
}
```

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: std::move](https://en.cppreference.com/w/cpp/utility/move) | Move semantics, Cast lvalue sang rvalue reference |
| [cppreference: Lambda expressions](https://en.cppreference.com/w/cpp/language/lambda) | Cú pháp, Capture modes, Generic Lambdas, Mutable |
| [cppreference: std::optional](https://en.cppreference.com/w/cpp/utility/optional) | Nullable types an toàn, `value_or()`, `nullopt` |
| [cppreference: std::variant](https://en.cppreference.com/w/cpp/utility/variant) | Type-safe Unions, Pattern Matching với `std::visit` |
| [cppreference: Structured binding](https://en.cppreference.com/w/cpp/language/structured_binding) | Destructuring cho Pairs, Tuples, Aggregates |
| [Effective Modern C++ — Item 1, 2, 3 (Bản dịch TV)](../../effective_modern_cpp/item_01.md) | Cơ chế suy diễn kiểu với Template, `auto` và `decltype` (xem thêm [Item 2](../../effective_modern_cpp/item_02.md), [Item 3](../../effective_modern_cpp/item_03.md)) |
| [Effective Modern C++ — Item 14, 15 (Bản dịch TV)](../../effective_modern_cpp/item_14.md) | Sử dụng `noexcept` và `constexpr` tối ưu hóa compile-time (xem thêm [Item 15](../../effective_modern_cpp/item_15.md)) |
| [Effective Modern C++ — Item 23, 24, 25 (Bản dịch TV)](../../effective_modern_cpp/item_23.md) | Hiểu rõ `std::move` vs `std::forward`, Universal References (xem thêm [Item 24](../../effective_modern_cpp/item_24.md), [Item 25](../../effective_modern_cpp/item_25.md)) |
| [Effective Modern C++ — Item 31, 32, 33, 34 (Bản dịch TV)](../../effective_modern_cpp/item_31.md) | Tránh default capture mode, Init capture cho move, Generic Lambdas (xem thêm [Item 32](../../effective_modern_cpp/item_32.md), [Item 33](../../effective_modern_cpp/item_33.md), [Item 34](../../effective_modern_cpp/item_34.md)) |
| *AUTOSAR C++14 Guidelines* — Rule A5-1-1 to A5-1-9 | Tiêu chuẩn sử dụng `constexpr`, Lambda trong automotive embedded |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Tình Huống | Giải Pháp Modern C++ |
| :--- | :--- |
| Chuyển giao dữ liệu ảnh lớn (cv::Mat, vector) | `std::move(obj)` — hoán đổi con trỏ $O(1)$ thay vì sao chép sâu $O(N)$ |
| Bắt biến vào Lambda trong async task | Init-capture `[data = std::move(p)]` chống dangling reference |
| Hàm có thể không trả về giá trị | `std::optional<T>` — kiểm tra bằng `has_value()` hoặc `value_or()` |
| Dữ liệu có thể thuộc 1 trong nhiều kiểu | `std::variant<Ts...>` + `std::visit()` pattern matching (Zero-heap) |
| Tính toán bảng giá trị cố định | `constexpr` hàm/mảng — thực thi tại compile-time, zero runtime cost |
| Trích xuất nhanh key-value từ cặp hoặc struct | `auto [key, val] = pair;` — Structured Bindings (C++17) |
