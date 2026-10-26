# Design Patterns Thực Chiến cho C++

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp các mẫu thiết kế (Design Patterns) quan trọng nhất cho hệ thống C++ hiện đại (Qt Cockpit, CV Pipeline, ADAS ECU, Embedded Systems). Mỗi pattern phân tích cơ chế hệ thống tầng thấp, bố cục bộ nhớ, rủi ro con trỏ hoang và kỹ thuật tối ưu hóa không cấp phát Heap (Zero-Heap Architecture).

---

## 1. Singleton — Đảm Bảo Một Instance Duy Nhất

### 1.1 Meyers' Singleton (C++11 Thread-Safe)
Đặc tả C++11 (Mệnh đề §6.7) cam kết việc khởi tạo biến cục bộ tĩnh (`static local variable`) là an toàn đa luồng (Thread-safe) tuyệt đối mà không cần dùng khóa mutex thủ công.

```cpp
class AudioHardwareHAL
{
private:
    AudioHardwareHAL() { /* Khởi tạo thanh ghi âm thanh DSP */ }

public:
    // Xóa bỏ hoàn toàn copy & move constructor
    AudioHardwareHAL(const AudioHardwareHAL&) = delete;
    AudioHardwareHAL& operator=(const AudioHardwareHAL&) = delete;

    static AudioHardwareHAL& getInstance() noexcept
    {
        // Compiler tự động chèn cờ ngầm và cơ chế đồng bộ hóa luồng (Thread-safe)
        static AudioHardwareHAL s_instance;
        return s_instance;
    }

    void setMasterVolume(int volume) { /* ... */ }
};
```

> [!WARNING]
> **Hiểm Họa Singleton (Anti-Pattern):**
> Lạm dụng Singleton biến đối tượng thành một "biến toàn cục ngụy trang", tạo ra sự phụ thuộc ngầm (Hidden Dependencies) và phá vỡ khả năng viết Unit Test. Khuyến khích sử dụng **Dependency Injection (DI)** truyền tham chiếu interface `IAudioHAL&` thay vì gọi trực tiếp `getInstance()` bên trong logic nghiệp vụ.

---

## 2. Observer — Mô Hình Đăng Ký & Phát Tán Sự Kiện

### 2.1 Kiến Trúc Observer Căn Bản
Subject duy trì một danh sách các Subscriber (Observer). Khi trạng thái thay đổi, Subject duyệt qua danh sách và kích hoạt hàm cập nhật của từng Observer.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MÔ HÌNH OBSERVER TRUYỀN THỐNG VÀ HIỂM HỌA CON TRỎ HOANG (DANGLING POINTER)  │
├─────────────────────────────────────────────────────────────────────────────┤
│   [ Subject: MediaManager ]                [ Observer: SpectrumWidget ]     │
│   std::vector<IObserver*>                       (Vùng nhớ Heap)             │
│   ┌───────────────────────┐                                                 │
│   │ [0] Con trỏ 0x600010  │───────────────▶ [ Object SpectrumWidget ]       │
│   └───────────────────────┘                         │                       │
│                                                     ▼                       │
│                                            Người dùng đổi màn hình:         │
│                                            delete SpectrumWidget!           │
│                                                     │                       │
│   Subject notify():                                 ▼                       │
│   Gọi 0x600010->update() ──▶ VÙNG NHỚ ĐÃ BỊ THU HỒI (USE-AFTER-FREE CRASH)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Case Study: Observer Pattern Bằng Raw Pointer Gây Lỗi Use-After-Free Trong Automotive IVI

> [!CAUTION]
> **Bối cảnh:** Ứng dụng giải trí xe hơi IVI. `MediaSubject` phát sự kiện `onTrackChanged` khi bài hát chuyển đổi. Màn hình sóng nhạc ảo `SpectrumWidget` đăng ký lắng nghe sự kiện bằng con trỏ thô (`IObserver*`).
> **Triệu chứng:** Khi tài xế bấm chuyển màn hình sang bản đồ GPS Navigation, giao diện `SpectrumWidget` bị giải phóng (destructed) nhưng không kịp gọi hàm hủy đăng ký (`detach`). Khi bài hát tiếp theo bắt đầu, tiến trình IVI lập tức bị sập. AddressSanitizer báo cáo lỗi `heap-use-after-free` tại địa chỉ vtable của observer.

```cpp
// TRƯỚC (Lỗi): Lưu con trỏ thô raw pointer thiếu cơ chế theo dõi vòng đời
#include <vector>
#include <iostream>

class IObserver
{
public:
    virtual ~IObserver() = default;
    virtual void onUpdate() = 0;
};

class MediaSubjectBad
{
private:
    std::vector<IObserver*> m_observers; // Con trỏ thô nguy hiểm!

public:
    void attach(IObserver* obs) { m_observers.push_back(obs); }
    void notify()
    {
        for (auto* obs : m_observers)
        {
            // LỖI USE-AFTER-FREE: Nếu đối tượng observer đã bị delete ở ngoài
            // mà quên detach, lệnh gọi dereference vptr sẽ gây sập tiến trình!
            obs->onUpdate(); 
        }
    }
};
```

```cpp
// SAU (Khắc phục): Theo dõi vòng đời đối tượng bằng std::weak_ptr chuẩn Allman
#include <vector>
#include <memory>
#include <algorithm>
#include <iostream>

class ITrackObserver
{
public:
    virtual ~ITrackObserver() = default;
    virtual void onTrackChanged(const std::string& title) = 0;
};

class ModernMediaSubject
{
private:
    // Lưu weak_ptr: Không tăng ref-count, tự động biết khi nào đối tượng đích bị hủy!
    std::vector<std::weak_ptr<ITrackObserver>> m_observers;

public:
    void attach(std::weak_ptr<ITrackObserver> obs)
    {
        m_observers.push_back(obs);
    }

    void notify(const std::string& newTrackTitle)
    {
        // 1. Tự động thanh lọc các Observer đã bị hủy (Expired Observers)
        m_observers.erase(
            std::remove_if(m_observers.begin(), m_observers.end(),
                [](const std::weak_ptr<ITrackObserver>& wp)
                {
                    return wp.expired();
                }),
            m_observers.end()
        );

        // 2. Thăng hạng (Promote) an toàn lên shared_ptr trước khi gọi callback
        for (const auto& wp : m_observers)
        {
            if (auto sp = wp.lock()) // lock() trả về nullptr nếu đối tượng đã bị giải phóng
            {
                sp->onTrackChanged(newTrackTitle); // An toàn tuyệt đối 100%
            }
        }
    }
};
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Việc sử dụng con trỏ thô trong Observer Pattern luôn tiềm ẩn nguy cơ rò rỉ con trỏ lơ lửng (Dangling Pointer) nếu Subscriber bị hủy trước Publisher.
> - Kỹ thuật `std::weak_ptr` kết hợp `wp.lock()` và `wp.expired()` cho phép Publisher tự động dọn dẹp các subscriber "chết" mà không cần subscriber phải nhớ gọi hàm `detach()` trong destructor.

---

## 3. Strategy — Thay Đổi Thuật Toán Linh Hoạt Tại Runtime

Đóng gói các thuật toán xử lý khác nhau (ví dụ: các mô hình thị giác máy tính YOLO, MobileNet, Haar Cascade) đằng sau một Interface trừu tượng duy nhất:

```cpp
#include <memory>

class IDetectionStrategy
{
public:
    virtual ~IDetectionStrategy() = default;
    virtual void processFrame(const uint8_t* pixels, int width, int height) = 0;
};

class FastDetectionStrategy : public IDetectionStrategy
{
public:
    void processFrame(const uint8_t* pixels, int width, int height) override
    {
        // Thuật toán nhẹ cho chế độ tiết kiệm pin
    }
};

class ADASVisionProcessor
{
private:
    std::unique_ptr<IDetectionStrategy> m_strategy;

public:
    void setStrategy(std::unique_ptr<IDetectionStrategy> strategy)
    {
        m_strategy = std::move(strategy);
    }

    void run(const uint8_t* frameData, int w, int h)
    {
        if (m_strategy)
        {
            m_strategy->processFrame(frameData, w, h);
        }
    }
};
```

---

## 4. Factory Method — Khởi Tạo Đối Tượng Linh Hoạt

Che giấu logic khởi tạo phần cứng cụ thể (USB Camera, IP Camera, CSI MIPI Camera) và trả về con trỏ thông minh trừu tượng `std::unique_ptr<ICamera>`.

---

## 5. State Pattern — Quản Lý Máy Trạng Thái Hữu Hạn (FSM)

### 5.1 Nguyên Lý State Pattern
Mỗi trạng thái của hệ thống (ví dụ: `Idle`, `Detecting`, `EmergencyBraking`) được đóng gói thành một lớp riêng biệt kế thừa từ `IState`. Khi nhận sự kiện, trạng thái hiện tại sẽ quyết định hành vi và chuyển giao sang trạng thái mới.

### 5.2 Case Study: State Pattern Cấp Phát Động Gây Trễ Bất Định Trong Phanh ADAS & Khắc Phục Zero-Heap

> [!CAUTION]
> **Bối cảnh:** Máy trạng thái điều khiển phanh khẩn cấp tự động (Autonomous Emergency Braking - AEB). Hệ thống hoạt động trong vòng lặp thời gian thực chu kỳ 10ms (Real-Time Control Loop 100Hz).
> **Triệu chứng:** Khi phát hiện vật cản nguy hiểm ở cự ly gần, quá trình chuyển trạng thái từ `Detecting` sang `EmergencyBraking` thi thoảng bị khựng mất 12ms do bộ cấp phát Heap bị phân mảnh (Heap Latency). Thời gian phản ứng phanh bị vi phạm giới hạn an toàn ISO 26262 ASIL-D.

```cpp
// TRƯỚC (Lỗi): Cấp phát State mới bằng new/make_unique trong vòng lặp thời gian thực
class StateContextBad;

class IStateBad
{
public:
    virtual ~IStateBad() = default;
    virtual void update(StateContextBad* ctx) = 0;
};

class StateContextBad
{
private:
    std::unique_ptr<IStateBad> m_currentState;

public:
    void changeState(std::unique_ptr<IStateBad> nextState)
    {
        // LỖI CHÍ MẠNG: Gọi delete state cũ và new state mới trong chu kỳ phanh 10ms!
        // Thao tác Heap Allocation có thời gian bất định, có thể gây vỡ chu kỳ RTOS!
        m_currentState = std::move(nextState); 
    }
};
```

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MÔ HÌNH CHUYỂN TRẠNG THÁI ZERO-HEAP FLYWEIGHT CHO HỆ THỐNG AN TOÀN NHÚNG    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Cấp phát động truyền thống:                                              │
│    changeState(make_unique<EmergencyState>()) ──▶ Gọi malloc/free lúc phanh!│
│    (Độ trễ dao động từ 50ns tới 15ms nếu phân mảnh Heap)                    │
│                                                                             │
│ 2. Zero-Heap Flyweight State (AUTOSAR Standard):                            │
│    EmergencyState::getInstance() ──▶ Biến tĩnh cố định trên BSS/Data section│
│    m_currentState = &EmergencyState::getInstance();                         │
│    (Chuyển trạng thái chỉ là 1 phép gán con trỏ trong 1 chu kỳ clock O(1)!) │
└─────────────────────────────────────────────────────────────────────────────┘
```

```cpp
// SAU (Khắc phục): Zero-Heap Flyweight State Pattern chuẩn Allman
class ADASVehicleContext;

class IADASState
{
public:
    virtual ~IADASState() = default;
    virtual void execute(ADASVehicleContext* ctx) = 0;
};

class EmergencyBrakeState : public IADASState
{
public:
    // State được lưu trữ dưới dạng Singleton tĩnh trong vùng nhớ tĩnh (Zero-Heap)
    static EmergencyBrakeState& getInstance() noexcept
    {
        static EmergencyBrakeState s_instance;
        return s_instance;
    }

    void execute(ADASVehicleContext* ctx) override;
};

class CruiseState : public IADASState
{
public:
    static CruiseState& getInstance() noexcept
    {
        static CruiseState s_instance;
        return s_instance;
    }

    void execute(ADASVehicleContext* ctx) override;
};

class ADASVehicleContext
{
private:
    // Con trỏ mượn trỏ tới instance tĩnh — KHÔNG BAO GIỜ gọi delete/free
    IADASState* m_activeState{&CruiseState::getInstance()};

public:
    void transitionTo(IADASState* nextState) noexcept
    {
        // Hoán đổi con trỏ trong 1 lệnh máy O(1), bảo đảm thời gian thực tuyệt đối
        m_activeState = nextState;
    }

    void updateCycle() noexcept
    {
        if (m_activeState)
        {
            m_activeState->execute(this);
        }
    }
};

void CruiseState::execute(ADASVehicleContext* ctx)
{
    bool obstacleImminent = true;
    if (obstacleImminent)
    {
        // Chuyển sang phanh khẩn cấp mà không tốn 1 byte Heap nào!
        ctx->transitionTo(&EmergencyBrakeState::getInstance());
    }
}

void EmergencyBrakeState::execute(ADASVehicleContext* ctx)
{
    // Kích hoạt phanh ABS
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Trong các luồng điều khiển thời gian thực cứng (Hard Real-Time Loop như phanh xe, bung túi khí), tiêu chuẩn an toàn AUTOSAR và MISRA C++ cấm hoàn toàn việc cấp phát động `malloc`/`new`.
> - Kết hợp **State Pattern** với **Flyweight/Singleton Pattern** giúp giữ nguyên cấu trúc thiết kế hướng đối tượng thanh thoát nhưng loại bỏ 100% chi phí Heap Allocation, đảm bảo thời gian chuyển trạng thái mang tính xác định (Deterministic $O(1)$).

---

## 6. Command Pattern — Đóng Gói Tác Vụ Hỗ Trợ Undo/Redo

Đóng gói mỗi thao tác người dùng thành một đối tượng độc lập chứa phương thức `execute()` và `undo()`, lưu trữ trong hàng đợi `std::stack<std::unique_ptr<ICommand>>`.

---

## 7. RAII Wrapper Pattern — Quản Lý Vòng Đời Tài Nguyên Hệ Thống

Đóng gói các tài nguyên hệ thống (POSIX file descriptor, socket, DMA buffer) vào struct tuân thủ nghiêm ngặt **Rule of 5**:

```cpp
#include <cstdio>

class ScopedPosixFile
{
private:
    FILE* m_fileHandle{nullptr};

public:
    ScopedPosixFile(const char* path, const char* mode)
        : m_fileHandle(std::fopen(path, mode)) {}

    ~ScopedPosixFile()
    {
        if (m_fileHandle)
        {
            std::fclose(m_fileHandle);
        }
    }

    // 1 & 2: Cấm sao chép
    ScopedPosixFile(const ScopedPosixFile&) = delete;
    ScopedPosixFile& operator=(const ScopedPosixFile&) = delete;

    // 3: Move Constructor
    ScopedPosixFile(ScopedPosixFile&& other) noexcept
        : m_fileHandle(other.m_fileHandle)
    {
        other.m_fileHandle = nullptr;
    }

    // 4: Move Assignment
    ScopedPosixFile& operator=(ScopedPosixFile&& other) noexcept
    {
        if (this != &other)
        {
            if (m_fileHandle) std::fclose(m_fileHandle);
            m_fileHandle = other.m_fileHandle;
            other.m_fileHandle = nullptr;
        }
        return *this;
    }

    FILE* get() const noexcept { return m_fileHandle; }
};
```

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| *Design Patterns: Elements of Reusable Object-Oriented Software* (GoF) | Định nghĩa kinh điển các mẫu Creational, Structural và Behavioral |
| *Effective C++* (Scott Meyers) — Item 4 | Meyers' Singleton (Thread-safe static local initialization từ C++11) |
| *Head First Design Patterns* (Eric Freeman & Elisabeth Robson) | Kiến trúc Observer, Strategy, State, Command trong hệ thống thực tế |
| *C++ Core Guidelines* — Resource Management (R.1) & Concurrency (CP.2) | Nguyên lý RAII Wrapper và an toàn khởi tạo đa luồng |

---

## Bảng Tóm Tắt — Chọn Pattern Theo Vấn Đề (Cheatsheet)

| Vấn Đề Cần Giải Quyết | Mẫu Thiết Kế (Pattern) |
| :--- | :--- |
| Cần đúng 1 thực thể điều khiển phần cứng | Meyers' Singleton (biến cục bộ static thread-safe) |
| Phát thông báo sự kiện không bị rò rỉ con trỏ | Modern Observer (`std::weak_ptr` tự dọn dẹp subscriber) |
| Thay đổi thuật toán nhận diện lúc runtime | Strategy (`std::unique_ptr<IDetectionStrategy>`) |
| Tạo thiết bị mà không cần biết concrete type | Factory Method / Abstract Factory |
| Chuyển trạng thái an toàn thời gian thực | Zero-Heap Flyweight State Pattern ($O(1)$) |
| Hàng đợi tác vụ và hỗ trợ quay lui (Undo) | Command Pattern (`execute()` & `undo()`) |
| Quản lý tài nguyên hệ điều hành an toàn | RAII Wrapper (Resource Acquisition Is Initialization) |
