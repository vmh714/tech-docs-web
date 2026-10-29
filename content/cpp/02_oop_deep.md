# OOP Chuyên Sâu — Virtual Table, Rule of 5, SOLID

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp cơ chế hoạt động ở tầng dưới (low-level mechanics) của OOP trong C++: vtable/vptr cho polymorphism, Rule of 3/5/0 cho resource management, và nguyên lý SOLID cho thiết kế module.

---

## 1. Virtual Table (vtable) & Dynamic Dispatch

```text
  ┌──────────────────┐                     ┌──────────────────────────┐
  │ [Class Base]     │                     │ [Base vtable]            │
  │ + vptr           │────────────────────▶│ [0] Base::virtualFunc    │
  │ + virtualFunc()  │                     │ [1] Base::~Base          │
  │ + ~Base()        │                     └──────────────────────────┘
  └──────────────────┘
           ▲
           │ (Inherits)
  ┌──────────────────┐                     ┌──────────────────────────┐
  │ [Class Derived]  │                     │ [Derived vtable]         │
  │ + vptr           │────────────────────▶│ [0] Derived::virtualFunc │
  │ + virtualFunc()  │                     │ [1] Derived::~Derived    │
  │ + ~Derived()     │                     └──────────────────────────┘
 ─────────────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Cơ chế Dynamic Dispatch:**
> Khi gọi `base_ptr->virtualFunc()`, runtime thực hiện 3 bước:
> 1. Đọc `vptr` từ object (hidden member, 8 bytes trên 64-bit)
> 2. Index vào vtable: `vtable[slot_of_virtualFunc]`
> 3. Gọi function tại địa chỉ đó (indirect call)
>
> **Overhead:** 1 pointer dereference + 1 indirect function call — có thể gây cache miss. Static dispatch (non-virtual) là direct call → nhanh hơn. Tuy nhiên overhead này thường không đáng kể trừ tight loops trong embedded/CV.

> [!WARNING]
> **Virtual Destructor — Tại sao BẮT BUỘC:**
> Khi `delete` qua base pointer mà destructor KHÔNG virtual → chỉ gọi `~Base()`, phần Derived KHÔNG được cleanup → **resource leak + undefined behavior.**
>
> ```cpp
> Base* p = new Derived;
> delete p; // Nếu ~Base() không virtual → CHỈ gọi ~Base()
>           // → Derived resources (memory, file handles) BỊ LEAK!
> ```
>
> **Quy tắc:** Bất cứ khi nào class có ít nhất 1 virtual function → destructor PHẢI virtual. Khi thiết kế base class cho polymorphism → luôn khai báo `virtual ~Base() = default;`

> [!TIP]
> **`override` và `final` keywords (C++11):**
>
> | Keyword | Tác dụng | Ví dụ |
> |:--|:--|:--|
> | `override` | Báo compiler kiểm tra hàm này THẬT SỰ override virtual function của base — bắt lỗi typo tên hàm | `void draw() override;` |
> | `final` | Ngăn derived class override thêm — hoặc ngăn class bị inherit | `void draw() final;` / `class Leaf final {};` |
>
> **Luôn dùng `override`** — biến runtime bug thành compile error. Slide FPT: "The final specifier can be used to tell the compiler to enforce this."

### 1.2 Case Study: Tiến Hóa Từ C-Style Function Pointers Sang Virtual Table & Virtual Destructor

> [!CAUTION]
> **Bối cảnh:** Module chẩn đoán lỗi phần cứng ô tô (`DiagnosticManager`) cần giao tiếp với các bộ điều khiển khác nhau: `EngineECU` và `BrakeECU`. `BrakeECU` cấp phát riêng một bộ đệm DMA 1MB để ghi log áp suất dầu phanh.
> **Hạn chế của phương án cũ (C-Style Struct Function Pointers):**
> Trong lập trình C truyền thống, các kỹ sư thường dùng struct chứa con trỏ hàm (`void (*diagnose)(void*)`) để mô phỏng đa hình.
> 1. Dễ quên gán con trỏ hàm dẫn đến crash `Null Pointer Dereference`.
> 2. **Chí mạng về thu hồi tài nguyên:** Khi giải phóng qua con trỏ tổng quát `free(base_device)`, hàm giải phóng hoàn toàn không biết cấu trúc bên trong của `BrakeECU` $\rightarrow$ Bộ đệm DMA 1MB bị rò rỉ vĩnh viễn (Memory Leak).

```cpp
// ❌ C-STYLE / PHƯƠNG ÁN CŨ: Thủ công, dễ rò rỉ bộ nhớ lớp con
struct BaseECU_C
{
    void (*diagnose)(void* self);
};

struct BrakeECU_C
{
    BaseECU_C base;
    uint8_t* dmaBuffer; // Cấp phát 1MB DMA
};

void destroyECU_C(BaseECU_C* ecu)
{
    // LỖI: Chỉ giải phóng phần vỏ BaseECU, dmaBuffer của BrakeECU bị rò rỉ vĩnh viễn!
    free(ecu);
}
```

#### Khắc phục bằng C++ vtable & Virtual Destructor

Trình biên dịch tự động chèn con trỏ `vptr` trỏ tới bảng ảo `vtable`. Khi khai báo `virtual ~BaseECU() = default;`, compiler đảm bảo thứ tự dọn dẹp ngược: Gọi `~BrakeECU()` trước (giải phóng DMA 1MB), sau đó mới gọi `~BaseECU()`.

```cpp
// ✅ C++ PHƯƠNG ÁN MỚI: Đa hình tự động qua vtable & dọn dẹp sạch bằng Virtual Destructor
class BaseECU
{
public:
    virtual ~BaseECU() = default; // BẮT BUỘC: Đảm bảo hủy đúng lớp con
    virtual void diagnose() = 0;
};

class BrakeECU : public BaseECU
{
private:
    std::unique_ptr<uint8_t[]> m_dmaBuffer; // 1MB DMA Buffer

public:
    BrakeECU()
        : m_dmaBuffer(std::make_unique<uint8_t[]>(1024 * 1024))
    {
    }

    ~BrakeECU() override
    {
        // Tự động giải phóng m_dmaBuffer an toàn, 0% rò rỉ bộ nhớ
    }

    void diagnose() override
    {
        // Thực hiện kiểm tra áp suất dầu phanh
    }
};

void runDiagnostic(std::unique_ptr<BaseECU> ecu)
{
    ecu->diagnose(); // Dynamic dispatch O(1) qua vtable
} // ecu ra khỏi scope -> Virtual destructor tự động kích hoạt dọn dẹp sạch sẽ
```

> [!TIP]
> **Bài học rút ra:** Bất cứ khi nào thiết kế lớp cơ sở cho đa hình (Polymorphism), destructor **BẮT BUỘC** phải là `virtual`. Nó biến việc dọn dẹp tài nguyên từ trách nhiệm thủ công của lập trình viên thành hành vi xác định của trình biên dịch.

---

## 2. Rule of 3 / 5 / 0

### 2.1 Rule of 3 (C++03)

> [!NOTE]
> **Ba hàm đặc biệt:**
> 1. **Destructor:** `~ClassName()` — giải phóng resource
> 2. **Copy Constructor:** `ClassName(const ClassName& other)` — tạo bản sao
> 3. **Copy Assignment Operator:** `ClassName& operator=(const ClassName& other)` — gán bản sao
>
> **Tại sao phải custom cả 3 (Deep vs Shallow Copy):** 
> - **Shallow Copy (Sao chép nông):** Là mặc định của compiler (chỉ copy từng bit, copy địa chỉ con trỏ). Nếu 2 object trỏ cùng vùng nhớ động (heap), khi hủy sẽ gây lỗi **double free** (giải phóng vùng nhớ 2 lần).
> - **Deep Copy (Sao chép sâu):** Phải tự định nghĩa Copy Constructor và `operator=` để cấp phát vùng nhớ mới và copy toàn bộ dữ liệu thực thể, đảm bảo mỗi object có bộ nhớ độc lập.
>
> Slide FPT (Shallow vs Deep copy): "Shallow copy is a bit-wise copy... just the reference addresses are copied. A deep copy copies all fields, and makes copies of dynamically allocated memory."

```cpp
// Ví dụ Rule of 3: Quản lý raw pointer
class RuleOfThree {
    int* data;
public:
    RuleOfThree(int val) : data(new int(val)) {}
    
    // 1. Destructor
    ~RuleOfThree() { delete data; }
    
    // 2. Copy Constructor (Deep Copy)
    RuleOfThree(const RuleOfThree& other) : data(new int(*other.data)) {}
    
    // 3. Copy Assignment Operator (Exception-Safe)
    RuleOfThree& operator=(const RuleOfThree& other)
    {
        if (this == &other)
        {
            return *this; // Self-assignment check
        }
        
        int* new_data = new int(*other.data); // 1. Cấp phát & copy trước (nếu throw bad_alloc thì data cũ vẫn an toàn)
        delete data;                          // 2. Chỉ giải phóng vùng nhớ cũ sau khi cấp phát thành công
        data = new_data;                      // 3. Gán con trỏ mới (No-throw)
        return *this;
    }
};
```

### 2.2 Rule of 5 (C++11)

> [!NOTE]
> **Hai hàm bổ sung (C++11):**
> 4. **Move Constructor:** `ClassName(ClassName&& other) noexcept` — "ăn cắp" resource từ rvalue
> 5. **Move Assignment Operator:** `ClassName& operator=(ClassName&& other) noexcept` — gán bằng move
>
> **`noexcept` cực kỳ quan trọng:** `std::vector` khi realloc chỉ dùng move constructor NẾU có `noexcept`. Nếu thiếu → fallback về copy → chậm. Move "steal" pointer thay vì deep copy → tiết kiệm hàng triệu cycles cho object lớn (cv::Mat, buffer).

```cpp
// Ví dụ Rule of 5: Kế thừa từ Rule of 3, thêm Move semantics chuẩn Allman & exception-safe
class RuleOfFive
{
    int* data;

public:
    RuleOfFive(int val)
        : data(new int(val))
    {
    }

    ~RuleOfFive()
    {
        delete data;
    }

    RuleOfFive(const RuleOfFive& other)
        : data(new int(*other.data))
    {
    }

    RuleOfFive& operator=(const RuleOfFive& other)
    {
        if (this != &other)
        {
            int* new_data = new int(*other.data);
            delete data;
            data = new_data;
        }
        return *this;
    }

    // 4. Move Constructor (Ăn cắp tài nguyên, set nguồn về nullptr)
    RuleOfFive(RuleOfFive&& other) noexcept
        : data(other.data)
    {
        other.data = nullptr;
    }

    // 5. Move Assignment Operator (Xử lý self-move an toàn)
    RuleOfFive& operator=(RuleOfFive&& other) noexcept
    {
        if (this != &other)
        {
            delete data;           // Giải phóng tài nguyên hiện tại
            data = other.data;     // Chuyển giao quyền sở hữu
            other.data = nullptr;  // Reset nguồn về trạng thái an toàn
        }
        return *this;
    }
};
```

### 2.3 Rule of 0

> [!IMPORTANT]
> **Nguyên lý Rule of 0:**
> Nếu class dùng `std::unique_ptr`, `std::shared_ptr`, `std::vector`, `std::string` để quản lý resource → **compiler-generated defaults ĐỦ TỐT** → KHÔNG CẦN viết destructor/copy/move → ít bug hơn, code sạch hơn.
>
> **Đây là best practice hiện đại:** Luôn ưu tiên Rule of 0 bằng cách dùng RAII wrappers (smart pointers, containers). Chỉ chuyển sang Rule of 5 khi BẮT BUỘC quản lý raw resource trực tiếp.

### 2.4 Case Study: Cuộc Tiến Hóa Quản Lý Bộ Nhớ — Từ Double Free Đến Move Semantics Và Rule Of 0

> [!CAUTION]
> **Bối cảnh:** Lớp `AudioBuffer` quản lý mảng âm thanh PCM 10MB trên hệ thống IVI xe hơi. Hệ thống liên tục truyền nhận các buffer âm thanh giữa luồng giải mã (`Decoder`) và luồng phát âm thanh (`PlaybackEngine`).
>
> **Giai đoạn 1: Mặc định Compiler (C++98) $\rightarrow$ Thảm họa Double Free**
> Không viết Copy Constructor/Destructor. Khi truyền `AudioBuffer` vào hàm theo tham trị hoặc gán `buf2 = buf1`, compiler chỉ sao chép con trỏ thô (Shallow Copy). Cả 2 đối tượng cùng trỏ vào 10MB trên heap. Khi ra khỏi scope, đối tượng thứ nhất gọi `delete[]` thành công, đối tượng thứ hai gọi `delete[]` lần nữa $\rightarrow$ **Crash lập tức vì Double Free!**

```cpp
// ❌ THẾ HỆ 1: Mặc định compiler (Shallow Copy) -> Double Free
class AudioBuffer_Gen1
{
    uint8_t* m_data;
    size_t m_size;
public:
    AudioBuffer_Gen1(size_t sz) : m_data(new uint8_t[sz]), m_size(sz) {}
    ~AudioBuffer_Gen1() { delete[] m_data; }
    // Quên viết Copy Ctor & Copy Assignment -> Double Free!
};
```

> **Giai đoạn 2: Khắc phục bằng Rule of 3 (C++03 Deep Copy) $\rightarrow$ Hạn chế: Nghẽn DRAM do sao chép thừa**
> Kỹ sư tự viết Destructor, Copy Constructor, Copy Assignment để cấp phát vùng nhớ mới và copy dữ liệu (Deep Copy). Khắc phục được 100% lỗi Double Free.
> **Hạn chế phát sinh:** Khi hàm `decodeAudio()` trả về một `AudioBuffer` tạm thời (rvalue), hoặc khi `std::vector::push_back()` tăng kích thước, hệ thống phải liên tục `malloc` 10MB mới và `memcpy` 10MB $\rightarrow$ Làm tụt FPS và quá tải băng thông bus bộ nhớ.

```cpp
// ⚠️ THẾ HỆ 2: Rule of 3 (C++03 Deep Copy) -> An toàn nhưng lãng phí tài nguyên
class AudioBuffer_Gen2
{
    uint8_t* m_data;
    size_t m_size;
public:
    AudioBuffer_Gen2(size_t sz) : m_data(new uint8_t[sz]), m_size(sz) {}
    ~AudioBuffer_Gen2() { delete[] m_data; }

    AudioBuffer_Gen2(const AudioBuffer_Gen2& other)
        : m_data(new uint8_t[other.m_size]), m_size(other.m_size)
    {
        std::memcpy(m_data, other.m_data, m_size); // Malloc + memcpy 10MB tốn kém!
    }

    AudioBuffer_Gen2& operator=(const AudioBuffer_Gen2& other)
    {
        if (this != &other)
        {
            delete[] m_data;
            m_data = new uint8_t[other.m_size];
            m_size = other.m_size;
            std::memcpy(m_data, other.m_data, m_size);
        }
        return *this;
    }
};
```

> **Giai đoạn 3: Khắc phục bằng Rule of 5 (C++11 Move Semantics) $\rightarrow$ Tối ưu O(1) nhưng Boilerplate cao**
> Bổ sung Move Constructor và Move Assignment Operator với từ khóa `noexcept`. Thay vì cấp phát mới, ta "ăn cắp" con trỏ trong $O(1)$ và gán nguồn về `nullptr`. Tốc độ truyền nhận buffer tăng gấp 100 lần.
> **Hạn chế:** Phải viết tay cả 5 hàm (dễ mắc lỗi quên reset con trỏ nguồn, quên kiểm tra self-move, hoặc quên `noexcept`).

```cpp
// 🚀 THẾ HỆ 3: Rule of 5 (C++11 Move Semantics) -> Tối ưu O(1)
class AudioBuffer_Gen3
{
    uint8_t* m_data;
    size_t m_size;
public:
    AudioBuffer_Gen3(size_t sz) : m_data(new uint8_t[sz]), m_size(sz) {}
    ~AudioBuffer_Gen3() { delete[] m_data; }

    AudioBuffer_Gen3(const AudioBuffer_Gen3& other) : m_data(new uint8_t[other.m_size]), m_size(other.m_size)
    {
        std::memcpy(m_data, other.m_data, m_size);
    }
    AudioBuffer_Gen3& operator=(const AudioBuffer_Gen3& other)
    {
        if (this != &other)
        {
            delete[] m_data;
            m_data = new uint8_t[other.m_size];
            m_size = other.m_size;
            std::memcpy(m_data, other.m_data, m_size);
        }
        return *this;
    }

    // Move Semantics O(1)
    AudioBuffer_Gen3(AudioBuffer_Gen3&& other) noexcept
        : m_data(other.m_data), m_size(other.m_size)
    {
        other.m_data = nullptr;
        other.m_size = 0;
    }
    AudioBuffer_Gen3& operator=(AudioBuffer_Gen3&& other) noexcept
    {
        if (this != &other)
        {
            delete[] m_data;
            m_data = other.m_data;
            m_size = other.m_size;
            other.m_data = nullptr;
            other.m_size = 0;
        }
        return *this;
    }
};
```

> **Giai đoạn 4: Đỉnh cao Modern C++ với Rule of 0 $\rightarrow$ Hoàn hảo, Zero-Boilerplate**
> Thay thế con trỏ thô bằng `std::vector<uint8_t>`. Không cần viết bất kỳ hàm Destructor, Copy hay Move nào. Trình biên dịch tự động kế thừa cơ chế Move $O(1)$ và RAII dọn dẹp sạch sẽ từ STL container.

```cpp
// 🏆 THẾ HỆ 4: Rule of 0 (Modern C++ Best Practice) -> Sạch sẽ, an toàn tuyệt đối
class AudioBuffer_Gen4
{
private:
    std::vector<uint8_t> m_buffer; // Tự động quản lý bộ nhớ, tự động Move O(1)

public:
    explicit AudioBuffer_Gen4(size_t sz)
        : m_buffer(sz, 0)
    {
    }

    // HOÀN TOÀN KHÔNG CẦN VIẾT Destructor, Copy, Move!
    // Compiler tự sinh mã tối ưu nhất và an toàn 100%.

    uint8_t* data() noexcept { return m_buffer.data(); }
    size_t size() const noexcept { return m_buffer.size(); }
};
```

> [!TIP]
> **Bài học rút ra:** Luôn ưu tiên **Rule of 0** trong các dự án C++ hiện đại. Chỉ sử dụng **Rule of 5** khi tương tác trực tiếp với các tài nguyên phần cứng C-API (như file descriptor, Linux socket, POSIX shared memory handle).

---

## 3. Object Slicing

### 3.1 Case Study: Thảm Họa Object Slicing Trong Pipeline Cảm Biến ADAS

> [!CAUTION]
> **Bối cảnh:** Pipeline an toàn ADAS đọc dữ liệu từ nhiều loại cảm biến. Lớp cơ sở `Sensor` chỉ chứa `id` và trả về khoảng cách cơ bản. Lớp dẫn xuất `RadarSensor` bổ sung thêm trường vận tốc hiệu ứng Doppler `m_dopplerSpeed` (8 bytes) và ghi đè hàm `getDistance()`.
>
> **Hạn chế của phương án cũ (Pass-by-Value):**
> Developer viết hàm xử lý: `void evaluateObstacle(Sensor sensor)`.
> Khi truyền `RadarSensor radar` vào hàm:
> 1. Trình biên dịch chỉ copy kích thước của `Sensor` (phần vỏ Base), toàn bộ trường `m_dopplerSpeed` bị "cắt phăng" (sliced off).
> 2. Con trỏ `vptr` của bản sao bị trỏ ngược lại `Sensor::vtable` $\rightarrow$ Hành vi đa hình biến mất! Hàm tính khoảng cách gọi `Sensor::getDistance()` thay vì `RadarSensor::getDistance()` $\rightarrow$ Tính toán sai lệch khoảng cách va chạm, hệ thống phanh khẩn cấp không kích hoạt!

```cpp
// ❌ PHƯƠNG ÁN CŨ: Truyền tham trị gây Object Slicing chết người
class Sensor
{
public:
    virtual ~Sensor() = default;
    virtual double getDistance() const { return 100.0; }
};

class RadarSensor : public Sensor
{
    double m_dopplerSpeed{35.5}; // Dữ liệu chuyên biệt của Radar
public:
    double getDistance() const override { return 12.5; } // Tính toán chính xác
};

void evaluateObstacle(Sensor sensor) // LỖI: Pass-by-value làm cắt mất lớp dẫn xuất!
{
    // sensor.getDistance() LUÔN TRẢ VỀ 100.0 (Hàm Base), không gọi được Radar!
}
```

#### Khắc phục bằng Pass-by-Reference & Smart Pointers

Bắt buộc truyền polymorphic object qua **tham chiếu hằng (`const Base&`)** hoặc **con trỏ thông minh (`std::unique_ptr<Base>`)**. Không một byte nào bị cắt gọt, `vptr` trỏ chính xác vào bảng vtable của `RadarSensor`.

```cpp
// ✅ PHƯƠNG ÁN MỚI: Truyền tham chiếu bảo toàn đa hình & zero-copy
void evaluateObstacleSafe(const Sensor& sensor)
{
    double dist = sensor.getDistance(); // Gọi chính xác RadarSensor::getDistance() -> 12.5m
    if (dist < 15.0)
    {
        // Kích hoạt cảnh báo va chạm kịp thời
    }
}
```

> [!TIP]
> **Bài học rút ra:** Không bao giờ truyền đối tượng có tính đa hình (chứa virtual function) theo tham trị (`pass-by-value`). Bất cứ khi nào nhận đối tượng lớp cha, **BẮT BUỘC** dùng `const Base&` hoặc `std::unique_ptr<Base>`.

---

## 4. Multiple Inheritance & Diamond Problem

### 4.1 Case Study: Xung Đột Kim Cương (Diamond Problem) Trong Gateway Ô Tô

> [!CAUTION]
> **Bối cảnh:** Module điều khiển trung tâm `CentralGateway` trên xe hơi kết nối đồng thời cả mạng CAN (`CanNode`) và mạng Ethernet (`EthernetNode`). Cả hai module này đều xuất phát từ lớp thiết bị mạng cơ sở `NetworkDevice` (chứa định danh phần cứng `uint32_t m_deviceId`).
>
> **Hạn chế của phương án cũ (Đa kế thừa thông thường):**
> Khi `CentralGateway` kế thừa từ cả `CanNode` và `EthernetNode`:
> 1. **Lỗi biên dịch Ambiguity:** Lệnh `gateway.m_deviceId` bị trình biên dịch từ chối (`request for member 'm_deviceId' is ambiguous`).
> 2. **Bất đồng bộ trạng thái (State Inconsistency):** Nếu developer gán `gateway.CanNode::m_deviceId = 100`, thì `gateway.EthernetNode::m_deviceId` vẫn mang giá trị rác hoặc giá trị cũ $\rightarrow$ Gửi sai ID thiết bị trên mạng nội bộ xe, gây mất an toàn chẩn đoán lỗi.
> 3. **Nhân đôi bộ nhớ (Memory Bloat):** Bố cục bộ nhớ của `CentralGateway` chứa 2 bản thể `NetworkDevice` độc lập.

```cpp
// ❌ PHƯƠNG ÁN CŨ: Đa kế thừa thông thường -> Nhân đôi bản sao & Lỗi Ambiguous
class NetworkDevice
{
public:
    uint32_t m_deviceId{0};
};

class CanNode : public NetworkDevice {};
class EthernetNode : public NetworkDevice {};

class CentralGateway : public CanNode, public EthernetNode
{
    // Chứa 2 bản thể NetworkDevice riêng biệt!
};

void configure(CentralGateway& gw)
{
    // gw.m_deviceId = 0xAA; // LỖI COMPILE: Ambiguous! Phải gọi gw.CanNode::m_deviceId
}
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ BỐ CỤC BỘ NHỚ ĐA KẾ THỪA THƯỜNG (2 BẢN SAO NETWORKDEVICE)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ CentralGateway:                                                             │
│   ├── [CanNode Subobject]      ──▶ [m_deviceId] (Bản sao 1)                 │
│   └── [EthernetNode Subobject] ──▶ [m_deviceId] (Bản sao 2 - Trùng lặp!)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Khắc phục bằng Kế Thừa Ảo (Virtual Inheritance)

Sử dụng từ khóa `virtual public NetworkDevice` ở cả `CanNode` và `EthernetNode`. Trình biên dịch sử dụng con trỏ bảng ảo `vbptr` (Virtual Base Pointer) để chỉ dẫn cả hai nhánh cùng chia sẻ **duy nhất một thực thể `NetworkDevice`** trong bộ nhớ.

```cpp
// ✅ PHƯƠNG ÁN MỚI: Virtual Inheritance -> Hợp nhất 1 bản thể duy nhất
class CanNode : virtual public NetworkDevice {};
class EthernetNode : virtual public NetworkDevice {};

class CentralGateway : public CanNode, public EthernetNode
{
public:
    // Constructor của lớp dẫn xuất cuối cùng (CentralGateway) chịu trách nhiệm
    // khởi tạo Virtual Base Class NetworkDevice
    CentralGateway(uint32_t id) : NetworkDevice(), CanNode(), EthernetNode()
    {
        m_deviceId = id; // Hợp lệ 100%, không còn lỗi ambiguous!
    }
};
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ BỐ CỤC BỘ NHỚ KẾ THỪA ẢO (VIRTUAL INHERITANCE - 1 BẢN THỂ DUY NHẤT)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ CentralGateway:                                                             │
│   ├── [CanNode Subobject]      ──▶ [vbptr] ───┐                             │
│   ├── [EthernetNode Subobject] ──▶ [vbptr] ───┼──▶ [NetworkDevice Duy Nhất] │
│   └── [Gateway Members]                       │     └── [m_deviceId]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!TIP]
> **Bài học rút ra:** Kế thừa ảo giải quyết triệt để xung đột kim cương, nhưng làm phát sinh thêm con trỏ `vbptr` và một cấp độ giải tham chiếu (indirection). Trong thiết kế phần mềm nhúng hiện đại, hãy ưu tiên **Composition over Inheritance** (kết tập thay vì đa kế thừa) trừ khi thực sự cần giao diện chuẩn.

---

## 5. SOLID Principles trong C++ (Đặc biệt cho Embedded AI & CV)

SOLID là 5 nguyên lý thiết kế hệ thống phần mềm kinh điển, giúp code dễ đọc, dễ mở rộng và dễ bảo trì. Trong các dự án lớn về C++ (như phát triển module cho xe tự hành), việc vi phạm SOLID sẽ dẫn đến "Spaghetti Code" và technical nợ (technical debt) rất lớn.

### 5.1 Single Responsibility Principle (SRP) - Nguyên lý Đơn trách nhiệm

> [!NOTE]
> **Khái niệm:** Một class chỉ nên có **MỘT** lý do để thay đổi (chỉ đảm nhận một trách nhiệm duy nhất).

- **Vấn đề:** Nếu một class `Camera` vừa chịu trách nhiệm giao tiếp phần cứng (đọc pixel) lại vừa chịu trách nhiệm xử lý ảnh (chuyển Grayscale) và lưu file. Khi đổi thuật toán xử lý ảnh, bạn phải sửa class giao tiếp phần cứng.
- **Giải pháp:** Tách thành 3 class độc lập: `CameraReader` (đọc data), `ImageProcessor` (xử lý) và `ImageSaver` (lưu file).

```cpp
// ❌ SAI: Vi phạm SRP
class ImageHandler {
public:
    void captureFromCamera() { /* Đọc data phần cứng */ }
    void applyGaussianFilter() { /* Thuật toán xử lý */ }
    void saveToDisk() { /* Ghi I/O file */ }
};

// ✅ ĐÚNG: Tuân thủ SRP
class CameraReader { public: void capture() {} };
class ImageProcessor { public: void applyFilter() {} };
class ImageSaver { public: void save() {} };
```

### 5.2 Open/Closed Principle (OCP) - Nguyên lý Mở/Đóng

> [!NOTE]
> **Khái niệm:** Có thể **MỞ RỘNG** thêm tính năng mới (bằng cách viết thêm code), nhưng **ĐÓNG** đối với việc sửa đổi (không được sửa code cũ đã chạy ổn định).

- **Ứng dụng:** Thường dùng Kế thừa (Inheritance) và Đa hình (Polymorphism) thông qua class trừu tượng.
- **Ví dụ CV:** Khi muốn thêm một thuật toán nhận diện mới (YOLO, SSD), ta không sửa file `DetectionManager.cpp` hiện có, mà chỉ cần tạo class mới kế thừa từ Interface.

```cpp
class ObjectDetector {
public:
    virtual void detect() = 0; // Interface
    virtual ~ObjectDetector() = default;
};

// Mở rộng dễ dàng bằng class mới
class YoloDetector : public ObjectDetector {
public:
    void detect() override { /* Triển khai YOLO */ }
};

class SSDDetector : public ObjectDetector {
public:
    void detect() override { /* Triển khai SSD */ }
};
```

### 5.3 Liskov Substitution Principle (LSP) - Nguyên lý Thay thế Liskov

> [!NOTE]
> **Khái niệm:** Đối tượng của **Lớp con (Derived)** phải thay thế được hoàn toàn đối tượng của **Lớp cha (Base)** mà không làm sai lệch tính đúng đắn của chương trình.

- **Vấn đề:** Tránh việc override hàm của lớp cha nhưng lại bẻ cong hoàn toàn logic ban đầu (ví dụ ném Exception bất ngờ, hoặc thay đổi hành vi cơ bản).
- **Ví dụ kinh điển:** Hình vuông (`Square`) KHÔNG NÊN kế thừa Hình chữ nhật (`Rectangle`). Vì nếu truyền `Square` vào hàm nhận `Rectangle`, hàm gọi `setWidth(5)` mong đợi chỉ chiều rộng đổi, nhưng `Square` lại tự động đổi cả chiều cao $\rightarrow$ Phá vỡ logic hệ thống.

```cpp
// ❌ SAI: Vi phạm LSP
class Rectangle {
public:
    virtual void setWidth(int w) { width = w; }
    virtual void setHeight(int h) { height = h; }
protected:
    int width, height;
};

class Square : public Rectangle {
public:
    // Thay đổi logic ngầm! Người dùng Base pointer không lường trước được điều này.
    void setWidth(int w) override { width = height = w; } 
    void setHeight(int h) override { width = height = h; }
};
```

### 5.4 Interface Segregation Principle (ISP) - Nguyên lý Phân tách Interface

> [!NOTE]
> **Khái niệm:** Thay vì tạo ra một interface khổng lồ nhồi nhét mọi thứ, hãy chia nhỏ thành nhiều interface cụ thể. Client không nên bị ép buộc implement những phương thức mà nó không sử dụng.

- **Ví dụ:** Không nên có 1 `IADAS_System` chứa cả `steerWheel()`, `brake()`, `detectLane()`. Vì module Cảm biến (Sensor) chỉ cần `detectLane()`, bắt nó implement 2 hàm kia là vô lý.

```cpp
// ❌ SAI: Interface quá cồng kềnh
class IMachine {
public:
    virtual void print() = 0;
    virtual void scan() = 0;
    virtual void fax() = 0;
};

// Máy in giá rẻ bị ép phải implement scan() và fax() dù không có phần cứng này!

// ✅ ĐÚNG: Phân tách Interface
class IPrinter { public: virtual void print() = 0; };
class IScanner { public: virtual void scan() = 0; };

class CheapPrinter : public IPrinter {
public:
    void print() override { /* ... */ }
}; // Không bị gánh nặng implement hàm không liên quan
```

### 5.5 Dependency Inversion Principle (DIP) - Nguyên lý Đảo ngược Phụ thuộc

> [!IMPORTANT]
> **Khái niệm:** Module cấp cao **KHÔNG ĐƯỢC** phụ thuộc vào module cấp thấp. Cả hai phải phụ thuộc vào các khái niệm trừu tượng (Abstractions/Interfaces).

- **Ứng dụng thực tế (Dependency Injection):** Khi code một hệ thống xử lý logic lái xe (cấp cao), đừng khởi tạo cứng một class `USBCamera` (cấp thấp). Hãy truyền vào một `ICamera`. Như vậy khi chuyển sang nền tảng dùng `IPCamera`, hệ thống lái xe không cần sửa một dòng code nào.

```cpp
class ICamera {
public:
    virtual void getFrame() = 0;
    virtual ~ICamera() = default;
};

class USBCamera : public ICamera { /* ... */ };

// ✅ ĐÚNG: CarSystem phụ thuộc vào Interface (ICamera), không phụ thuộc vào USBCamera
class CarSystem {
    ICamera* camera; 
public:
    CarSystem(ICamera* cam) : camera(cam) {} // Dependency Injection
    
    void run() {
        camera->getFrame(); 
    }
};
```


### 5.6 Case Study: Tiến Hóa Kiến Trúc Module Thị Giác ADAS — Refactor Toàn Diện 5 Vi Phạm SOLID

> [!CAUTION]
> **Bối cảnh:** Module phát hiện chướng ngại vật ADAS (`ObstacleDetectionModule`) trên xe tự hành. Phiên bản ban đầu được viết theo kiểu "God Object" nguyên khối (Monolith) trong một file hơn 2000 dòng.
>
> **Hạn chế của kiến trúc cũ (Vi phạm toàn diện 5 nguyên lý SOLID):**
> 1. **Vi phạm SRP (Single Responsibility):** Class `ObstacleDetectionPipeline` ôm đồm cùng lúc 5 trách nhiệm: đọc I/O phần cứng từ Linux V4L2 USB camera, tiền xử lý ảnh (chuyển grayscale, resize), chạy mạng nơ-ron nhận diện vật thể, can thiệp phanh khẩn cấp qua CAN bus, và ghi video mã hóa H.264 ra ổ đĩa SSD. Bất kỳ thay đổi nào (đổi loại camera, đổi bitrate video, đổi thuật toán AI) đều phải sửa class này.
> 2. **Vi phạm OCP (Open/Closed):** Hàm `detect()` chứa câu lệnh `switch-case` 400 dòng rẽ nhánh thuật toán (`YOLO_V8`, `SSD_MOBILENET`, `TENSORRT_EFFDET`). Mỗi khi thêm model AI mới, kỹ sư bắt buộc phải can thiệp sửa đổi file mã nguồn lõi đang chạy ổn định, dẫn đến nguy cơ hồi quy lỗi (regression bugs) và xung đột mã nguồn (merge conflicts) liên miên.
> 3. **Vi phạm LSP (Liskov Substitution):** Lớp dẫn xuất `ThermalCamera` kế thừa từ `CameraBase`. Do camera nhiệt hồng ngoại chỉ xuất ảnh đơn sắc 1 kênh (Grayscale 16-bit), nó ghi đè hàm `getRGBFrame()` bằng cách ném ngoại lệ `std::runtime_error("Thermal camera does not support RGB")` $\rightarrow$ Khi truyền `ThermalCamera` vào pipeline xử lý đang mong đợi `CameraBase`, hệ thống bị sập do unhandled exception.
> 4. **Vi phạm ISP (Interface Segregation):** Interface khổng lồ `IAutonomousVehicleDevice` định nghĩa cả `captureFrame()`, `detectObstacle()`, `applyEmergencyBrake()`, `turnSteeringWheel()`. Module camera quang học bị ép phải triển khai cả hàm đánh lái và phanh với thân hàm rỗng giả lập.
> 5. **Vi phạm DIP (Dependency Inversion):** Class cấp cao `SafetyDecisionEngine` trực tiếp khởi tạo phần cứng `m_camera = new V4L2CameraHardware("/dev/video0")` $\rightarrow$ Phụ thuộc cứng vào driver Linux thực tế, không thể chạy unit test trong môi trường CI/CD, không thể nạp dữ liệu giả lập từ trình mô phỏng (CARLA/ROS2).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ KIẾN TRÚC CŨ (VI PHẠM SOLID - MONOLITHIC GOD OBJECT)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ObstacleDetectionPipeline (2000+ dòng)                                     │
│  ├── [V4L2 Linux I/O] ──▶ Đọc trực tiếp từ /dev/video0 (Tight coupling)     │
│  ├── [Switch-case 400L] ──▶ YOLOv8 / SSD / TensorRT (Vi phạm OCP & SRP)     │
│  ├── [ThermalCamera] ──▶ Throw exception getRGBFrame() (Vi phạm LSP)        │
│  ├── [IAutoVehicleDev] ──▶ Ép implement cả steer() & brake() (Vi phạm ISP)  │
│  └── [CAN Bus Writer] ──▶ Gửi tín hiệu phanh khẩn cấp trực tiếp             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ▼ REFACTOR SOLID

┌─────────────────────────────────────────────────────────────────────────────┐
│ KIẾN TRÚC MỚI (TUÂN THỦ TRỌN VẸN 5 NGUYÊN LÝ SOLID)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [IFrameSource]   (DIP & ISP)            [IObjectDetector] (OCP, Strategy)  │
│  ├── V4l2CameraSource                    ├── YoloV8Detector                 │
│  └── MockCameraSource (Mock CI/CD)       └── TensorRtDetector               │
│                    │                                   │                    │
│                    └─────────────┬─────────────────────┘                    │
│                                  ▼ (Dependency Injection)                   │
│               ┌───────────────────────────────────────┐                     │
│               │   ObstacleDetectionService (SRP)      │                     │
│               │   - Chỉ phối hợp luồng dữ liệu        │                     │
│               │   - Không phụ thuộc phần cứng cụ thể  │                     │
│               └───────────────────────────────────────┘                     │
│                                  │                                          │
│                                  ▼ (ISP)                                    │
│                         [IBrakeActuator]                                    │
│                         └── CanBrakeActuator                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Monolithic God Class vi phạm 5 nguyên lý SOLID)

```cpp
// ❌ KIẾN TRÚC CŨ: Vi phạm toàn diện 5 nguyên lý SOLID
enum class ModelType
{
    YOLO_V8,
    SSD_MOBILENET,
    TENSORRT
};

class IAutonomousVehicleDevice // Vi phạm ISP: Interface cồng kềnh nhồi nhét
{
public:
    virtual ~IAutonomousVehicleDevice() = default;
    virtual void captureFrame() = 0;
    virtual void detectObstacle() = 0;
    virtual void applyEmergencyBrake() = 0;
    virtual void turnSteeringWheel(double angle) = 0;
};

class ThermalCameraDevice : public IAutonomousVehicleDevice
{
public:
    void captureFrame() override
    {
        // Đọc ảnh nhiệt hồng ngoại
    }

    void detectObstacle() override
    {
    }

    // Vi phạm LSP & ISP: Camera nhiệt bị ép triển khai phanh và bẻ lái!
    void applyEmergencyBrake() override
    {
        throw std::runtime_error("Thermal Camera cannot brake!");
    }

    void turnSteeringWheel(double) override
    {
        throw std::runtime_error("Thermal Camera cannot steer!");
    }
};

class GodObstaclePipeline // Vi phạm SRP, OCP, DIP
{
private:
    ThermalCameraDevice* m_thermalCam; // Vi phạm DIP: Khởi tạo cứng đối tượng cụ thể

public:
    GodObstaclePipeline()
    {
        m_thermalCam = new ThermalCameraDevice(); // Khởi tạo cứng, không thể mock test
    }

    ~GodObstaclePipeline()
    {
        delete m_thermalCam;
    }

    void process(ModelType model)
    {
        m_thermalCam->captureFrame();
        
        // Vi phạm OCP: Giant switch-case, thêm model mới bắt buộc sửa code lõi
        switch (model)
        {
            case ModelType::YOLO_V8:
                // ... 80 dòng chạy YOLOv8 ...
                break;
            case ModelType::SSD_MOBILENET:
                // ... 100 dòng chạy SSD ...
                break;
            case ModelType::TENSORRT:
                // ... 120 dòng chạy TensorRT ...
                break;
        }

        // Vi phạm SRP: Tự quyết định và can thiệp ghi CAN bus phanh trực tiếp
    }
};
```

#### Code SAU (Refactored Clean Architecture — Tuân thủ trọn vẹn 5 nguyên lý SOLID)

```cpp
// ✅ KIẾN TRÚC MỚI: Tuân thủ trọn vẹn 5 nguyên lý SOLID (Allman format)

// 1. ISP: Tách các interface nhỏ gọn, đúng mục đích chuyên biệt
class IFrameSource
{
public:
    virtual ~IFrameSource() = default;
    virtual std::vector<uint8_t> grabFrame() = 0;
};

class IBrakeActuator
{
public:
    virtual ~IBrakeActuator() = default;
    virtual void applyBrake(double pressurePercent) = 0;
};

// 2. OCP: Abstract Strategy cho các thuật toán nhận diện đối tượng
struct DetectionResult
{
    float boundingBox[4];
    float confidence;
    bool isObstacleAhead;
};

class IObjectDetector
{
public:
    virtual ~IObjectDetector() = default;
    virtual DetectionResult detect(const std::vector<uint8_t>& frame) = 0;
};

// Mở rộng thuật toán mới bằng cách thêm class mới, TUYỆT ĐỐI KHÔNG sửa code cũ (OCP)
class YoloV8Detector : public IObjectDetector
{
public:
    DetectionResult detect(const std::vector<uint8_t>& frame) override
    {
        // 60 dòng suy luận mô hình YOLOv8 độc lập
        return DetectionResult{{10.0f, 20.0f, 50.0f, 80.0f}, 0.95f, true};
    }
};

class TensorRtDetector : public IObjectDetector
{
public:
    DetectionResult detect(const std::vector<uint8_t>& frame) override
    {
        // 80 dòng suy luận tăng tốc phần cứng TensorRT
        return DetectionResult{{10.0f, 20.0f, 50.0f, 80.0f}, 0.98f, true};
    }
};

// 3. LSP: Lớp con thay thế hoàn toàn lớp cha mà không gây ngoại lệ bất thường
class V4L2CameraSource : public IFrameSource
{
public:
    std::vector<uint8_t> grabFrame() override
    {
        return std::vector<uint8_t>(1920 * 1080 * 3, 0xFF); // Đọc driver V4L2
    }
};

class MockCameraSource : public IFrameSource
{
public:
    std::vector<uint8_t> grabFrame() override
    {
        return std::vector<uint8_t>(640 * 480, 0xAA); // Giả lập dữ liệu cho CI/CD Unit Test
    }
};

class CanBrakeActuator : public IBrakeActuator
{
public:
    void applyBrake(double pressurePercent) override
    {
        // Gửi khung tin CAN ID 0x120 tới bộ điều khiển phanh thủy lực ABS
    }
};

// 4. SRP & DIP: Module cấp cao điều phối luồng nhận Abstraction qua Dependency Injection
class ObstacleDetectionService
{
private:
    IFrameSource& m_frameSource;
    IObjectDetector& m_detector;
    IBrakeActuator& m_brakeActuator;

public:
    // DIP: Tiêm phụ thuộc qua Constructor (Dependency Injection)
    ObstacleDetectionService(IFrameSource& camera,
                             IObjectDetector& detector,
                             IBrakeActuator& brake)
        : m_frameSource(camera)
        , m_detector(detector)
        , m_brakeActuator(brake)
    {
    }

    // SRP: Chỉ đảm nhận duy nhất việc phối hợp luồng dữ liệu an toàn
    void step()
    {
        std::vector<uint8_t> frame = m_frameSource.grabFrame();
        DetectionResult result = m_detector.detect(frame);

        if (result.isObstacleAhead && result.confidence > 0.85f)
        {
            m_brakeActuator.applyBrake(100.0); // Kích hoạt phanh khẩn cấp kịp thời
        }
    }
};
```

> [!TIP]
> **Bài học rút ra:**
> - **DIP & ISP:** Giúp hệ thống decoupling hoàn toàn khỏi phần cứng Linux V4L2/CAN bus thực tế. Mã nguồn có thể chạy trơn tru trong môi trường Google Test (GTest) hoặc GMock với tốc độ thực thi hàng nghìn test cases mỗi giây.
> - **OCP & SRP:** Thêm thuật toán mới chỉ cần tạo file mới kế thừa `IObjectDetector` mà không cần compile lại toàn bộ hệ thống lõi.
> - **LSP:** Đảm bảo mọi lớp con thực hiện trọn vẹn hợp đồng (contract) của Interface cơ sở, triệt tiêu nguy cơ runtime exception làm sập ECU.

---

## 6. Member Initializer List (MIL) & Constructor Optimization

> [!IMPORTANT]
> **Member Initializer List (MIL)** là cú pháp khởi tạo các thành viên của class trước khi thân hàm constructor thực thi. Trong C++ (đặc biệt là Embedded/CV), việc sử dụng MIL không chỉ là vấn đề phong cách (style) mà còn là **bắt buộc** trong nhiều trường hợp và là **tiêu chuẩn tối ưu hóa hiệu năng**.

### 6.1 So sánh MIL và Khởi tạo trong thân hàm (Assignment)

> [!TIP]
> **Khởi tạo trong thân hàm (Assignment overhead):**
> Khi gán giá trị trong thân hàm constructor, biến thành viên đã được gọi **default constructor** trước khi bước vào thân hàm. Sau đó, toán tử gán (`operator=`) mới được gọi để đè giá trị mới lên.
>
> **MIL (Trực tiếp khởi tạo):**
> MIL gọi trực tiếp constructor có tham số của biến thành viên, bỏ qua bước default constructor và assignment.

```cpp
// CÁCH TỒI: Khởi tạo trong thân hàm -> Tốn 1 lần default constructor + 1 lần assignment
class BadClass
{
    std::string name;
public:
    BadClass(const std::string& n)
    { 
        name = n; // name đã khởi tạo rỗng trước đó, giờ lại bị gán đè. Gây overhead!
    }
};

// CÁCH CHUẨN: Sử dụng MIL -> Chỉ tốn 1 lần copy/move constructor
class GoodClass
{
    std::string name;
public:
    GoodClass(const std::string& n) : name(n) {} // Khởi tạo trực tiếp in-place
};
```

### 6.2 Các trường hợp BẮT BUỘC phải dùng MIL

> [!WARNING]
> Có những tình huống C++ **cấm** việc khởi tạo trong thân hàm constructor và bắt buộc phải dùng MIL để code có thể biên dịch thành công:
> 
> 1. **Biến thành viên hằng (`const` members):**
>    Biến `const` chỉ được gán giá trị một lần duy nhất vào thời điểm khởi tạo. Không thể gán giá trị trong thân hàm vì lúc đó biến đã hình thành.
>    ```cpp
>    class Sensor
>    {
>        const int id;
>    public:
>        Sensor(int _id) : id(_id) {} // BẮT BUỘC phải dùng MIL
>    };
>    ```
> 
> 2. **Biến tham chiếu (Reference members):**
>    Tham chiếu bắt buộc phải trỏ đến một vùng nhớ/biến khác ngay khi được tạo ra. Không thể để trống rồi gán sau.
>    ```cpp
>    class Controller
>    {
>        Hardware& hw_ref;
>    public:
>        Controller(Hardware& hw) : hw_ref(hw) {} // BẮT BUỘC phải dùng MIL
>    };
>    ```
> 
> 3. **Thành viên đối tượng hoặc Lớp cha (Base class) KHÔNG có Default Constructor:**
>    Nếu lớp thành viên hoặc lớp cha không có constructor không tham số, trình biên dịch không thể tự khởi tạo chúng trước khi vào thân hàm → Bắt buộc phải gọi constructor cụ thể thông qua MIL.
>    ```cpp
>    class Derived : public Base
>    {
>    public:
>        // Nếu Base không có default constructor, bắt buộc gọi Base(args) trong MIL
>        Derived(int x) : Base(x) {} 
>    };
>    ```

### 6.3 Case Study: Tiến Hóa Từ Khởi Tạo Trong Thân Hàm Sang MIL Trong ECU Điều Khiển Phanh (Brake Actuator Controller)

> [!CAUTION]
> **Bối cảnh:** Module điều khiển chấp hành phanh khẩn cấp ô tô (`BrakeActuatorController`) chịu trách nhiệm kích hoạt van thủy lực ABS/ESC. Tiêu chuẩn an toàn chức năng ISO 26262 ASIL-D yêu cầu thời gian khởi động ECU (boot-to-active) phải dưới 5ms.
>
> **Hạn chế của phương án cũ (In-body Assignment):**
> Lập trình viên viết constructor theo thói quen gán giá trị bên trong thân hàm `{ ... }`:
> 1. **Lỗi biên dịch chí mạng (Compile-time Errors):** Khi nhóm an toàn bổ sung 2 trường bất biến: `const uint32_t m_hardwareCanId` (định danh phần cứng cố định) và `SpiBus& m_spiBusRef` (tham chiếu bus truyền thông phần cứng), việc gán trong thân hàm bị trình biên dịch từ chối ngay lập tức:
>    - `error: uninitialized const member in 'class BrakeActuatorController'`
>    - `error: uninitialized reference member in 'class BrakeActuatorController'`
> 2. **Overhead hiệu năng kép (Double Initialization):** Thành viên `std::string m_ecuTag` và `DiagnosticBuffer m_diagBuffer` (cấp phát 64KB RAM) tự động gọi Default Constructor trước khi bước vào thân hàm. Sau đó trong thân hàm, toán tử gán `operator=` lại được gọi để giải phóng vùng nhớ vừa tạo và cấp phát lại vùng nhớ mới $\rightarrow$ Tiêu tốn hơn 12,000 chu kỳ CPU, làm trễ thời gian khởi động ECU lên tới 8.4ms (vi phạm ngưỡng an toàn 5ms).
> 3. **Cạm bẫy thứ tự khởi tạo (Initialization Order Bug):** Trình biên dịch C++ luôn khởi tạo các biến thành viên theo **thứ tự khai báo trong định nghĩa class**, hoàn toàn không phụ thuộc vào thứ tự viết các câu lệnh gán bên trong thân constructor.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH LUỒNG THỰC THI (EXECUTION FLOW): IN-BODY ASSIGNMENT VS MIL          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. IN-BODY ASSIGNMENT (2 BƯỚC - OVERHEAD & LỖI BIÊN DỊCH):                  │
│    [Cấp phát bộ nhớ Object]                                                 │
│       │                                                                     │
│       ▼ (Bước 1: Tự động chạy ngầm trước khi vào thân hàm)                  │
│    [Default Ctor m_ecuTag] ──▶ [Default Ctor m_diagBuffer (Cấp phát 64KB)]  │
│       │ (LỖI: const m_hardwareCanId và reference m_spiBusRef không thể tạo) │
│       ▼ (Bước 2: Bước vào thân hàm constructor { ... })                     │
│    [Copy Assignment: Hủy buffer cũ, cấp phát lại buffer mới] ──▶ TỐN KÉM!   │
│                                                                             │
│ 2. MEMBER INITIALIZER LIST (1 BƯỚC - TRỰC TIẾP IN-PLACE & AN TOÀN):         │
│    [Cấp phát bộ nhớ Object]                                                 │
│       │                                                                     │
│       ▼ (Khởi tạo trực tiếp in-place qua MIL)                               │
│    [m_hardwareCanId(id)] ──▶ [m_spiBusRef(bus)] ──▶ [Direct Buffer Ctor]    │
│       │ (Chỉ tốn 1 lần khởi tạo duy nhất, 0% overhead, 0% rác bộ nhớ)       │
│       ▼                                                                     │
│    [Thân hàm rỗng {} - Hoàn tất khởi động < 1.2ms]                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Gán trong thân hàm gây lỗi biên dịch và overhead kép)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Gán trong thân hàm (Bị lỗi biên dịch & lãng phí tài nguyên)
struct SpiBus {};

class DiagnosticBuffer
{
public:
    DiagnosticBuffer() { /* Cấp phát 64KB bộ đệm tạm thời */ }
    DiagnosticBuffer(size_t sz) { /* Cấp phát đúng kích thước sz */ }
    DiagnosticBuffer& operator=(const DiagnosticBuffer& other)
    {
        // Giải phóng bộ đệm cũ, cấp phát lại bộ đệm mới -> Rất chậm!
        return *this;
    }
};

class BrakeActuatorController
{
private:
    const uint32_t m_hardwareCanId; // Biến hằng bất biến
    SpiBus& m_spiBusRef;            // Tham chiếu phần cứng
    DiagnosticBuffer m_diagBuffer;  // Bộ đệm chẩn đoán
    std::string m_ecuTag;           // Tên định danh

public:
    BrakeActuatorController(uint32_t id, SpiBus& bus, const std::string& tag)
    {
        // ❌ LỖI BIÊN DỊCH 1: const member không thể gán sau khi tạo!
        // m_hardwareCanId = id; 

        // ❌ LỖI BIÊN DỊCH 2: reference member không thể gán sau khi tạo!
        // m_spiBusRef = bus; 

        // ❌ OVERHEAD KÉP: Đã chạy Default Ctor cấp 64KB, giờ lại gán đè
        m_diagBuffer = DiagnosticBuffer(1024 * 64);
        m_ecuTag = tag;
    }
};
```

#### Code SAU (Member Initializer List trực tiếp in-place & đúng thứ tự khai báo)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Khởi tạo trực tiếp qua MIL chuẩn Allman Style
class BrakeActuatorController
{
private:
    // Thứ tự khai báo xác định thứ tự khởi tạo thực tế của trình biên dịch!
    const uint32_t m_hardwareCanId;
    SpiBus& m_spiBusRef;
    DiagnosticBuffer m_diagBuffer;
    std::string m_ecuTag;

public:
    // MIL: Khởi tạo trực tiếp từng thành viên in-place
    BrakeActuatorController(uint32_t id, SpiBus& bus, const std::string& tag)
        : m_hardwareCanId(id)                       // Khởi tạo const member hợp lệ
        , m_spiBusRef(bus)                         // Liên kết reference ngay khi tạo
        , m_diagBuffer(1024 * 64)                  // Gọi trực tiếp ctor có tham số (0 lần default ctor)
        , m_ecuTag(tag)                            // Khởi tạo copy/move trực tiếp (0 lần gán đè)
    {
        // Thân hàm hoàn toàn rỗng! Khởi động hoàn tất chỉ trong 1.1ms (< 5ms yêu cầu)
    }
};
```

> [!TIP]
> **Bài học rút ra:**
> 1. Luôn khai báo các thành viên trong MIL **đúng theo thứ tự khai báo trong định nghĩa class**. Trình biên dịch C++ luôn khởi tạo theo thứ tự khai báo trong class bất kể thứ tự bạn viết trong MIL (nhiều compiler sẽ cảnh báo `-Wreorder` nếu viết lệch thứ tự).
> 2. Sử dụng MIL giúp triệt tiêu hoàn toàn chi phí khởi tạo kép (double initialization), đảm bảo khả năng khởi động xác định (deterministic boot time) cho các hệ thống nhúng thời gian thực.

---

## 7. Bố Cục Bộ Nhớ (Memory Layout): Class vs Struct & Tối Ưu Hóa Cache

> [!IMPORTANT]
> Về bản chất, `class` và `struct` có bố cục bộ nhớ tương đồng (chỉ khác default access modifier). Tuy nhiên, khi kết hợp Đa hình (Polymorphism), bộ nhớ của class sẽ phình to và đòi hỏi kỹ thuật tối ưu hóa đặc thù.

### 7.1 Overhead của Virtual Table và Padding
Khi một class có `virtual function`, trình biên dịch chèn thêm con trỏ `vptr` (8 bytes trên 64-bit) vào object. Điều này cộng với Memory Alignment/Padding có thể làm kích thước object tăng đáng kể.

```cpp
class Base
{
    char c;           // 1 byte
    virtual void f(); // Thêm vptr (8 bytes) -> compiler tự thêm 7 bytes padding sau 'c' để align
}; // Kích thước có thể lên tới 16 bytes!
```

### 7.2 Tối ưu hóa bộ nhớ: SoA vs AoS (Dữ liệu Nhúng & CV)
> [!TIP]
> Trong xử lý lượng dữ liệu lớn (như tính toán cảm biến xe hay Computer Vision), cấu trúc **SoA (Structure of Arrays)** giúp tăng **Cache Locality** (tính cục bộ của bộ nhớ cache), giảm cache misses vượt trội so với **AoS (Array of Structures)** truyền thống.
> 
> - **AoS (Chậm):** `std::vector<Particle> particles;` (Mỗi Particle gồm x, y, z, r, g, b).
> - **SoA (Nhanh):** `struct Particles { vector<float> x; vector<float> y; ... };`. CPU cache line có thể nạp một lúc hàng loạt giá trị `x` liên tiếp để tính toán SIMD.

### 7.3 Case Study: Tiến Hóa Bố Cục Bộ Nhớ Đám Mây Điểm LiDAR 3D — Từ AoS Sang SoA Tăng Tốc 4.2x SIMD & Tối Ưu Cache

> [!CAUTION]
> **Bối cảnh:** Xe tự hành trang bị cảm biến LiDAR 64 tia quét môi trường với tần số 20 Hz, sinh ra $100{,}000$ điểm 3D mỗi khung hình (tương đương 2,000,000 điểm/giây). Một tác vụ tiền xử lý nền tảng bắt buộc phải hoàn thành dưới 10ms là **Lọc Mặt Đường (Ground Removal Filter)**: loại bỏ toàn bộ các điểm có cao độ mặt đất $z < -1.2\text{ m}$ để bảo vệ các thuật toán nhận diện vật cản phía sau.
>
> **Hạn chế của phương án cũ (Array of Structures - AoS):**
> Các kỹ sư định nghĩa kiểu cấu trúc hướng đối tượng truyền thống:
> ```cpp
> struct Point3D
> {
>     float x, y, z;        // 12 bytes
>     float intensity;      // 4 bytes
>     uint32_t ringId;      // 4 bytes
>     uint32_t timestamp;   // 4 bytes
> }; // Kích thước = 24 bytes/point
> std::vector<Point3D> pointCloud; // 100,000 phần tử = 2.4 MB
> ```
> 1. **Lãng phí băng thông bộ nhớ cực nặng (Memory Bandwidth Waste):** Khi CPU duyệt mảng để kiểm tra điều kiện `point.z < -1.2f`, mỗi lần đọc $z$, CPU nạp một Cache Line 64 bytes từ RAM. Trong 64 bytes đó, chỉ có 4 bytes của $z$ được dùng, 20 bytes còn lại ($x, y, intensity, ringId, timestamp$) bị nạp vô ích $\rightarrow$ Lãng phí tới **83.3% băng thông bộ nhớ**!
> 2. **Cache Thrashing:** Bộ đệm L1 Data Cache (thường chỉ 32KB - 48KB) liên tục bị tràn và xả do phải chứa các trường dữ liệu thừa, đẩy tỉ lệ Cache Miss lên tới 78.4%.
> 3. **Vô hiệu hóa Vector hóa SIMD (Auto-vectorization Failure):** Dữ liệu cao độ $z$ nằm cách nhau 24 bytes (strided memory access), các đơn vị tính toán SIMD 256-bit (AVX2/ARM NEON) không thể nạp song song 8 số thực $z$ bằng một lệnh load liên tục.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ BỐ CỤC CACHE LINE 64-BYTE: ARRAY OF STRUCTURES (AOS) VS STRUCTURE OF ARRAYS │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. AOS (LÃNG PHÍ 83% BĂNG THÔNG, STRIDED DATA):                             │
│    Cache Line 64B:                                                          │
│    ┌──────────┬──────────┬──────────┬──────────────┬──────────┬──────────┐  │
│    │ Pt0: x,y │ Pt0: [Z] │ Pt0: int │ Pt0: ring,ts │ Pt1: x,y │ Pt1: [Z] │  │
│    └──────────┴──────────┴──────────┴──────────────┴──────────┴──────────┘  │
│                  ▲ Chỉ dùng 4B                           ▲ Chỉ dùng 4B      │
│    ──▶ 1 Cache Line 64B chỉ chứa được ~2.6 điểm! Phải nạp RAM liên tục.     │
│                                                                             │
│ 2. SOA (100% HIỆU QUẢ CACHE, LIÊN TỤC CHO AVX2 / ARM NEON SIMD):            │
│    Cache Line 64B của mảng z:                                               │
│    ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───...───┬─────┐        │
│    │Z[0] │Z[1] │Z[2] │Z[3] │Z[4] │Z[5] │Z[6] │Z[7] │  ...  │Z[15]│          │
│    └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴───────┴─────┘          │
│    ▲────────────────── 8 x float32 (256-bit AVX2) ──────────────────▲       │
│    ──▶ 1 Cache Line nạp trọn vẹn 16 giá trị Z! SIMD xử lý 8 float/chu kỳ.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (AoS: Truy cập phân tán, nghẽn Cache & không thể vector hóa)

```cpp
// ❌ PHƯƠNG ÁN CŨ: AoS truyền thống gây Cache Thrashing
struct Point3D
{
    float x, y, z;
    float intensity;
    uint32_t ringId;
    uint32_t timestamp;
};

size_t filterGroundAoS(const std::vector<Point3D>& cloud, float groundZThreshold)
{
    size_t validPoints = 0;
    // Vòng lặp duyệt tuần tự nhưng bộ nhớ nhảy cóc từng bước 24 bytes (strided access)
    for (size_t i = 0; i < cloud.size(); ++i)
    {
        if (cloud[i].z >= groundZThreshold)
        {
            ++validPoints;
        }
    }
    return validPoints; // Thời gian chạy đo được trên 100,000 điểm: 18.6 ms
}
```

#### Code SAU (SoA: Dữ liệu liên tục sát nhau, SIMD AVX2 tăng tốc 4.2x)

```cpp
// ✅ PHƯƠNG ÁN MỚI: SoA tối ưu hóa Cache Locality & SIMD
struct PointCloudSoA
{
    std::vector<float> x;
    std::vector<float> y;
    std::vector<float> z;         // Mảng cao độ Z nằm liên tục trên RAM!
    std::vector<float> intensity;
    std::vector<uint32_t> ringId;
    std::vector<uint32_t> timestamp;

    void reserve(size_t n)
    {
        x.reserve(n);
        y.reserve(n);
        z.reserve(n);
        intensity.reserve(n);
        ringId.reserve(n);
        timestamp.reserve(n);
    }
};

size_t filterGroundSoA(const PointCloudSoA& cloud, float groundZThreshold)
{
    const float* __restrict zData = cloud.z.data();
    const size_t total = cloud.z.size();
    size_t validPoints = 0;

    // Dữ liệu z liên tục sát nhau -> Trình biên dịch tự động sinh mã SIMD AVX2
    // Nạp song song 8 float32 vào thanh ghi YMM mỗi chu kỳ CPU!
    #pragma GCC ivdep
    for (size_t i = 0; i < total; ++i)
    {
        if (zData[i] >= groundZThreshold)
        {
            ++validPoints;
        }
    }
    return validPoints; // Thời gian chạy đo được trên 100,000 điểm: 4.4 ms (Tăng tốc 4.2x!)
}
```

> [!TIP]
> **Bài học rút ra:**
> - **Khi nào dùng AoS:** Khi hệ thống có số lượng đối tượng ít (vài trăm phần tử) và các thao tác thường xuyên truy xuất toàn bộ các thuộc tính của cùng một đối tượng cùng lúc (ví dụ: thực thể Game Object, bản ghi cấu hình).
> - **Khi nào bắt buộc dùng SoA:** Trong các pipeline xử lý dữ liệu lớn (Computer Vision, Point Cloud, Deep Learning Tensor, Physics Simulation). SoA đảm bảo 100% băng thông của mỗi Cache Line được tận dụng triệt để, đồng thời mở đường cho trình biên dịch kích hoạt tính năng SIMD Auto-vectorization.

---

## 8. Quản Lý Phạm Vi Truy Cập (Access Modifiers) Nâng Cao

> [!NOTE]
> Trong tính kế thừa, ta có thể dùng từ khóa `using` hoặc `= delete` để điều chỉnh chi tiết cách lớp con tiếp nhận các thuộc tính/phương thức từ lớp cha.

### 8.1 Chuyển đổi và Che giấu chức năng

```cpp
class Base
{
protected:
    void debugLog();
public:
    int value;
};

class Derived : public Base
{
public:
    // 1. Mở rộng truy cập: Đưa hàm từ protected của Base thành public ở Derived
    using Base::debugLog; 

private:
    // 2. Thu hẹp truy cập: Giấu biến value thành private ở Derived
    using Base::value; 

public:
    // 3. Vô hiệu hóa hoàn toàn chức năng kế thừa (Inaccessible)
    void someParentFunc() = delete; 
};
```

### 8.2 Case Study: Kiểm Soát Giao Diện Phần Cứng CAN Bus Driver Bằng using Và = delete Để Ngăn Chặn Lỗi Vận Hành Nguy Hiểm

> [!CAUTION]
> **Bối cảnh:** Lớp điều khiển truyền thông mạng CAN trên xe hơi (`CanBusDriver`) kế thừa từ thư viện driver phần cứng cấp thấp `GenericGpioDriver`.
>
> **Hạn chế của phương án cũ (Kế thừa công khai lỏng lẻo):**
> 1. **Để lộ các API phần cứng nguy hiểm (Exposing Hazardous APIs):** Lớp cha `GenericGpioDriver` cung cấp các phương thức nhạy cảm như `forceChipHardwareReset()` và `setInternalClockFrequency(uint32_t freq)`. Khi kế thừa `public`, các lập trình viên tầng ứng dụng (Application Layer) vô tình nhìn thấy và gọi `driver.forceChipHardwareReset()` ngay trong lúc xe đang chạy trên cao tốc $\rightarrow$ Làm sập toàn bộ mạng nội bộ ô tô.
> 2. **Cạm bẫy ép kiểu ngầm (Implicit Conversion Traps):** Lớp cha có hàm gửi byte: `void sendPayload(uint8_t byte)`. Một kỹ sư tầng trên vô tình truyền số thực cảm biến `driver.sendPayload(125.75)`. Trình biên dịch C++ âm thầm thực hiện ép kiểu ngầm (floating-point truncation) thành byte giá trị `125`, hoàn toàn không báo lỗi biên dịch $\rightarrow$ Dữ liệu cảm biến truyền lên mạng bị cắt xén sai lệch nghiêm trọng.
> 3. **Che giấu nạp chồng hàm ngoài ý muốn (Name Hiding Bug):** Lớp con định nghĩa thêm hàm gửi danh sách byte: `void sendPayload(const std::vector<uint8_t>& data)`. Trong C++, việc khai báo hàm trùng tên trong lớp con sẽ **che giấu (hide) toàn bộ các overload** cùng tên của lớp cha $\rightarrow$ Mã nguồn cũ gọi `driver.sendPayload(uint8_t)` lập tức bị báo lỗi biên dịch không tìm thấy hàm phù hợp.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ CƠ CHẾ KIỂM SOÁT GIAO DIỆN: USING & = DELETE TRONG DERIVED CLASS            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Base: GenericGpioDriver                                                     │
│ ├── forceChipHardwareReset() ──┐ (Hàm nguy hiểm)                            │
│ ├── sendPayload(uint8_t) ──────┼─┐ (Hàm hợp lệ)                             │
│ └── sendPayload(uint16_t) ─────┼─┼─┐                                        │
│                                │ │ │                                        │
│ Derived: CanBusDriver          │ │ │                                        │
│ ├── private: using Base::forceChipHardwareReset ──▶ CHẶN TRUY CẬP TỪ NGOÀI  │
│ ├── public:  using Base::sendPayload ─────────────▶ MỞ LẠI OVERLOAD BASE    │
│ ├── public:  sendPayload(vector<uint8_t>) ────────▶ OVERLOAD MỚI            │
│ └── public:  sendPayload(double) = delete ────────▶ BÁO LỖI BIÊN DỊCH NẾU   │
│                                                     TRUYỀN SỐ THỰC NGẦM!    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Code TRƯỚC (Kế thừa công khai lỏng lẻo, dễ gọi nhầm hàm nguy hiểm và ép kiểu ngầm)

```cpp
// ❌ PHƯƠNG ÁN CŨ: Kế thừa lỏng lẻo để lộ nguy cơ an toàn chức năng
class GenericGpioDriver
{
public:
    void sendPayload(uint8_t data)
    {
        // Gửi 1 byte lên bus
    }

    void forceChipHardwareReset()
    {
        // Kéo chân RESET vi điều khiển về LOW -> Nguy hiểm chết người nếu gọi lúc xe chạy!
    }
};

class CanBusDriver : public GenericGpioDriver
{
public:
    // Cố gắng bổ sung thêm hàm gửi vector
    void sendPayload(const std::vector<uint8_t>& buffer)
    {
        // Gửi mảng bytes
    }
    // LỖI 1: Hàm này vô tình HIDE hàm sendPayload(uint8_t) của lớp cha!
    // LỖI 2: Vẫn để lộ forceChipHardwareReset() ra ngoài public interface!
};

void applicationTask(CanBusDriver& driver)
{
    // ❌ LỖI VẬN HÀNH: Tầng ứng dụng gọi nhầm lệnh nguy hiểm mà trình biên dịch không hề chặn!
    driver.forceChipHardwareReset(); 

    // ❌ LỖI BIÊN DỊCH: driver.sendPayload(0x55) bị lỗi do Name Hiding!
}
```

#### Code SAU (Kiểm soát chặt chẽ bằng using và = delete chuẩn Modern C++)

```cpp
// ✅ PHƯƠNG ÁN MỚI: Kiểm soát phạm vi và vô hiệu hóa ép kiểu ngầm
class CanBusDriver : public GenericGpioDriver
{
private:
    // 1. Thu hẹp phạm vi: Giấu hoàn toàn hàm nguy hiểm vào private
    using GenericGpioDriver::forceChipHardwareReset;

public:
    // 2. Chống Name Hiding: Đưa toàn bộ các overload của sendPayload từ Base vào scope của Derived
    using GenericGpioDriver::sendPayload;

    // 3. Mở rộng overload mới cho Derived
    void sendPayload(const std::vector<uint8_t>& buffer)
    {
        for (uint8_t b : buffer)
        {
            sendPayload(b); // Gọi overload của Base bình thường
        }
    }

    // 4. Bắt lỗi ép kiểu ngầm: Cấm tiệt việc truyền số thực hoặc kiểu float/double
    void sendPayload(double) = delete; // Báo lỗi Compile-time ngay lập tức nếu truyền sai kiểu!
};

void safeApplicationTask(CanBusDriver& driver)
{
    // ✅ Gọi overload byte của Base: Hợp lệ 100% nhờ 'using GenericGpioDriver::sendPayload;'
    driver.sendPayload(static_cast<uint8_t>(0xAA));

    // ✅ Gọi overload vector của Derived: Hợp lệ
    driver.sendPayload(std::vector<uint8_t>{0x01, 0x02, 0x03});

    // ❌ COMPILE ERROR: driver.forceChipHardwareReset() là private -> Trình biên dịch chặn đứng!
    // driver.forceChipHardwareReset();

    // ❌ COMPILE ERROR: driver.sendPayload(12.34) gọi hàm = delete -> Trình biên dịch chặn đứng ép kiểu ngầm!
    // driver.sendPayload(12.34);
}
```

> [!TIP]
> **Bài học rút ra:**
> - Sử dụng `private: using Base::hazardousFunction;` là kỹ thuật tuyệt vời để thu hẹp giao diện kế thừa mà không cần đổi kiểu kế thừa thành `private inheritance`.
> - Khai báo `= delete` cho các kiểu dữ liệu không mong muốn (như `double`, `int` lớn) là kỹ thuật phòng vệ chuẩn C++11 để tiêu diệt tận gốc các lỗi ép kiểu ngầm (implicit truncation) trong lập trình nhúng và an toàn xe hơi.


---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: Virtual functions](https://en.cppreference.com/w/cpp/language/virtual) | Dynamic dispatch, vtable/vptr mechanics, Pure virtual functions |
| [cppreference: Rule of three/five/zero](https://en.cppreference.com/w/cpp/language/rule_of_three) | Resource Management, Copy/Move Constructors & Assignments |
| [Effective Modern C++ — Item 11 (Bản dịch TV)](../../effective_modern_cpp/item_11.md) | Ưu tiên dùng `deleted functions` (`= delete`) thay vì `private undefined` |
| [Effective Modern C++ — Item 12 (Bản dịch TV)](../../effective_modern_cpp/item_12.md) | Luôn khai báo các hàm ghi đè với từ khóa `override` |
| [Effective Modern C++ — Item 17 (Bản dịch TV)](../../effective_modern_cpp/item_17.md) | Hiểu rõ cơ chế sinh tự động các hàm thành viên đặc biệt (Special Member Functions) |
| *Effective C++* (Scott Meyers) — Item 7, 9, 12 | Virtual destructors, Không gọi virtual trong constructor/destructor |
| *C++ Core Guidelines* — Classes & Class Hierarchies (C.1 - C.184) | Thiết kế OOP chuẩn, Rule of 5/0, Virtual Inheritance |
| *Clean Architecture* (Robert C. Martin) | Nguyên lý SOLID (SRP, OCP, LSP, ISP, DIP) trong thiết kế module C++ |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Tình Huống | Giải Pháp |
| :--- | :--- |
| Class có raw pointer resource | Rule of 5 hoặc chuyển sang smart pointer (Rule of 0) |
| Polymorphism qua base pointer | Virtual destructor BẮT BUỘC |
| Truyền polymorphic object vào hàm | Pass by reference/pointer, KHÔNG pass by value (tránh slicing) |
| Thêm detection algorithm mới | OCP — inherit abstract base, không sửa code cũ |
| Diamond inheritance | Virtual inheritance |
| Khởi tạo biến thành viên | Luôn ưu tiên dùng Member Initializer List (MIL) |
| Biến `const`, `reference`, không có default ctor | **BẮT BUỘC** phải dùng MIL |
| Truy xuất lượng dữ liệu khổng lồ (Particles, Pixels) | Dùng Structure of Arrays (SoA) để tối ưu Cache Locality |
| Ẩn phương thức từ lớp cha trong lớp con | Đặt ở phạm vi `private` kèm `using` hoặc dùng `= delete` |
