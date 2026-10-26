# Qt Core — Meta-Object System (MOC), QObject Tree & Signal-Slot Mechanics

> [!IMPORTANT]
> **Mục tiêu**:
> Đi sâu vào kiến trúc cốt lõi của Qt Framework: Trình tiền xử lý Meta-Object Compiler (MOC), cơ chế bộ nhớ cây phân cấp `QObject`, bản chất bên dưới của Signals & Slots, và hệ thống thuộc tính động (Dynamic Property System).

---

## 1. Meta-Object System (MOC) & `Q_OBJECT`

Qt mở rộng khả năng của C++ chuẩn thông qua **Meta-Object System**, cung cấp:
- Hệ thống truyền tin bất đồng bộ **Signals & Slots**.
- Thông tin kiểu lúc runtime (Introspection & Reflection mở rộng vượt trên RTTI chuẩn).
- Hệ thống thuộc tính động (`Q_PROPERTY`).
- Dịch chuyển đa ngôn ngữ (Internationalization - `tr()`).

```
    Source Header (.h) ──1. MOC Tool──▶ moc_*.cpp (Meta-Object Implementation)
           │                                    │
           ▼ (C++ Compiler)                     ▼ (C++ Compiler)
         *.o (Source Object)                moc_*.o (Meta Object)
           │                                    │
           └──────────────▶ 2. Linker ◀─────────┘
                               │
                               ▼
                   ELF Executable / Shared Library
```

### 1.1 Cơ Chế Sinh Mã Của MOC
Khi khai báo macro `Q_OBJECT` trong một lớp kế thừa từ `QObject`:
```cpp
class TelemetrySensor : public QObject
{
    Q_OBJECT
    Q_PROPERTY(double temperature READ getTemperature NOTIFY temperatureChanged)

public:
    explicit TelemetrySensor(QObject* parent = nullptr);
    double getTemperature() const;

signals:
    void temperatureChanged(double newTemp);

public slots:
    void updateSensorData(double rawValue);

private:
    double m_temperature{ 0.0 };
};
```

1. **MOC quét các file header:** Tìm thấy macro `Q_OBJECT`, tự động sinh file `moc_TelemetrySensor.cpp`.
2. **Cấu trúc dữ liệu `QMetaObject`:** Lưu trữ bảng chuỗi (String Table), bảng chỉ mục Signals, Slots, Properties, và con trỏ hàm tĩnh `qt_static_metacall`.
3. **Thực thi hàm Signal:** Signal **KHÔNG CẦN VIẾT THÂN HÀM** trong `.cpp`. Thân hàm của Signal được MOC tự sinh trong `moc_*.cpp`, bên trong gọi `QMetaObject::activate()`.

---

## 2. Mô Hình Sở Hữu Bộ Nhớ: `QObject` Parent-Child Tree

Qt quản lý vòng đời đối tượng thông qua **Cây phân cấp Cha - Con (Parent-Child Hierarchy)**:

```
[ Root QObject (Parent) ] ── (Heap Allocated / Main Window)
        ├── [ Child Object 1 ]
        │       ├── [ Sub-Child 1.1 ]
        │       └── [ Sub-Child 1.2 ]
        └── [ Child Object 2 ]
```

### 2.1 Quy Tắc Hủy Bộ Nhớ Tự Động
- Khi một `QObject` cha bị hủy (Destructor được gọi), nó sẽ tự động duyệt danh sách con (`children()`) và gọi `delete` trên từng đối tượng con.
- Đối tượng con tự động xóa chính nó khỏi danh sách của cha nếu nó bị `delete` trước đối tượng cha.

### 2.2 Các Bẫy Bộ Nhớ Chí Mạng (Gotchas & Hazards)

> [!CAUTION]
> **1. Bẫy Double Free (Đối tượng con trên Stack):**
> ```cpp
> void createWidgets()
> {
>     QObject parent;
>     QObject child(&parent); // NGUY HIỂM: child nằm trên STACK nhưng có parent
> }
> // Khi hết scope: child bị hủy trước do Stack Unwinding -> parent bị hủy sau và cố gắng delete con trỏ child -> CRASH DOUBLE FREE!
> ```
> **Quy tắc vàng:** Chỉ gán `parent` cho các đối tượng được cấp phát động trên **Heap (`new`)**.

> [!CAUTION]
> **2. Xung đột `std::unique_ptr` và `QObject` Parent:**
> ```cpp
> auto parent = new QObject();
> auto child = std::make_unique<QObject>(parent);
> // NGUY HIỂM: Cả std::unique_ptr và parent đều sở hữu quyền delete child -> Tranh chấp giải phóng bộ nhớ!
> ```
> **Giải pháp:** Nếu dùng `QObject` parent-child thì để Qt quản lý vòng đời (`new QObject(parent)`). Nếu dùng con trỏ thông minh hiện đại thì không set `parent`, hoặc sử dụng `QPointer<T>` làm con trỏ quan sát an toàn (Weak reference).

---

## 3. Bản Chất Của Cơ Chế Signals & Slots

### 3.1 So Sánh 2 Cú Pháp Kết Nối

| Tiêu Chí | Cú Pháp Chuẩn Qt4 (String-based) | Cú Pháp Hiện Đại Qt5/Qt6 (Function Pointer) |
| :--- | :--- | :--- |
| **Cú pháp** | `connect(src, SIGNAL(sig()), dst, SLOT(slt()))` | `connect(src, &Source::sig, dst, &Target::slt)` |
| **Type Checking** | Runtime (kiểm tra chuỗi) | **Compile-time** (kiểm tra kiểu tham số lúc biên dịch) |
| **Báo lỗi** | Chỉ cảnh báo lúc chạy nếu gõ sai tên | Báo lỗi ngay lúc Compile (`No matching function`) |
| **Hỗ trợ Lambda** | ❌ Không | ✅ Hỗ trợ Lambda expression và Functors |
| **Khuyên dùng** | Không khuyến khích | **Bắt buộc sử dụng** |

### 3.2 4 Chế Độ Kết Nối (`Qt::ConnectionType`)

```cpp
QObject::connect(sender, &Sender::dataReady, receiver, &Receiver::processData, Qt::AutoConnection);
```

1. **`Qt::DirectConnection` (Đồng bộ - Synchronous):**
   * Slot được thực thi ngay lập tức trong thread của **Sender** tại thời điểm gọi `emit`.
   * Tương đương với lời gọi hàm trực tiếp.
2. **`Qt::QueuedConnection` (Bất đồng bộ - Asynchronous):**
   * Tín hiệu được đóng gói thành một `QEvent` và đẩy vào Event Queue của thread sở hữu **Receiver**.
   * Slot sẽ được thực thi khi Event Loop của Receiver xử lý đến event đó.
   * **Bắt buộc cho giao tiếp đa luồng an toàn (Thread-Safe Inter-Thread Communication).**
3. **`Qt::AutoConnection` (Mặc định):**
   * Nếu Sender và Receiver cùng Thread Affinity $\rightarrow$ Dùng `DirectConnection`.
   * Nếu Sender và Receiver khác Thread $\rightarrow$ Tự động chuyển sang `QueuedConnection`.
4. **`Qt::BlockingQueuedConnection`:**
   * Tương tự `QueuedConnection`, nhưng luồng Sender bị chặn (Block/Sleep) cho đến khi Slot ở luồng Receiver hoàn thành xong.
   * *Cảnh báo:* Dễ gây Deadlock nếu Sender và Receiver nằm chung một luồng.

---

## 4. Hệ Thống Thuộc Tính `Q_PROPERTY`

`Q_PROPERTY` là nền tảng để giao tiếp hai chiều giữa C++ Backend và QML Frontend:

```cpp
Q_PROPERTY(Type name
           READ getterFunction
           [WRITE setterFunction]
           [NOTIFY signalFunction]
           [RESET resetFunction]
           [CONSTANT])
```

### 4.1 Quy Chuẩn Đặt Tên & Triển Khai (Best Practice)
```cpp
class VehicleSpeedometer : public QObject
{
    Q_OBJECT
    Q_PROPERTY(float speed READ speed WRITE setSpeed NOTIFY speedChanged)

public:
    explicit VehicleSpeedometer(QObject* parent = nullptr)
        : QObject(parent)
        , m_speed(0.0f)
    {
    }

    float speed() const
    {
        return m_speed;
    }

    void setSpeed(float newSpeed)
    {
        if (qFuzzyCompare(m_speed, newSpeed))
        {
            return; // Tránh phát tín hiệu thừa thãi nếu giá trị không đổi
        }
        m_speed = newSpeed;
        emit speedChanged(m_speed);
    }

signals:
    void speedChanged(float newSpeed);

private:
    float m_speed;
};
```

---

## 5. Case Study: Quên Macro `Q_OBJECT` Dẫn Đến Undefined Reference Vtable

> [!CAUTION]
> **Bối cảnh:** Phát triển module `TirePressureMonitor` kế thừa từ `QObject` để phát tín hiệu cảnh báo áp suất lốp bất thường tới Cluster Display. Developer khai báo `signals: void alertPressure(float psi);` nhưng quên đặt macro `Q_OBJECT` ở đầu class.
> **Triệu chứng:** Khi biên dịch bằng CMake/G++, linker báo lỗi nghiêm trọng: `undefined reference to 'vtable for TirePressureMonitor'`. Nếu chương trình biên dịch được (trong một số cấu hình template), `connect()` âm thầm thất bại lúc runtime và không phát được tín hiệu.

### Phân tích nguyên nhân gốc (Root Cause)

MOC (Meta-Object Compiler) của Qt quét toàn bộ header files trong dự án. MOC **chỉ sinh mã nguồn meta-object** (`moc_tirepressuremonitor.cpp`) cho những class nào có chứa macro `Q_OBJECT`. 

```
┌────────────────────────────────────────────────────────┐
│ Thiếu Q_OBJECT:                                        │
│   CMake (AUTOMOC) ──▶ Bỏ qua class TirePressureMonitor │
│   Linker          ──▶ Không tìm thấy code vtable       │
│                   ──▶ LỖI: undefined reference         │
└────────────────────────────────────────────────────────┘
```

Khi thiếu `Q_OBJECT`, compiler tạo con trỏ bảng ảo (vtable pointer) với các hàm ảo từ `QObject` (`metaObject()`, `qt_metacast()`, `qt_metacall()`), nhưng linker không tìm thấy định nghĩa (implementation) của chúng do MOC chưa từng sinh mã.

```cpp
// TRƯỚC: Thiếu Q_OBJECT
class TirePressureMonitor : public QObject
{
    // LỖI: Quên Q_OBJECT
public:
    explicit TirePressureMonitor(QObject* parent = nullptr)
        : QObject(parent)
    {
    }

signals:
    void alertPressure(float psi); // Compiler hiểu cú pháp nhưng MOC không sinh mã!
};
```

### Giải pháp

Khai báo macro `Q_OBJECT` ngay dòng đầu tiên trong khối định nghĩa class (phạm vi `private` mặc định). Nếu dùng CMake, đảm bảo đã kích hoạt `set(CMAKE_AUTOMOC ON)`.

```cpp
// SAU: Đầy đủ Q_OBJECT và AUTOMOC
class TirePressureMonitor : public QObject
{
    Q_OBJECT // MOC phát hiện và sinh moc_*.cpp chứa vtable & signal implementation

public:
    explicit TirePressureMonitor(QObject* parent = nullptr)
        : QObject(parent)
    {
    }

    void checkPressure(float currentPsi)
    {
        if (currentPsi < 28.0f)
        {
            emit alertPressure(currentPsi); // Hoạt động chính xác
        }
    }

signals:
    void alertPressure(float psi);
};
```

> [!TIP]
> **Bài học rút ra:** Bất kỳ class nào kế thừa `QObject` và sử dụng Signals/Slots, `Q_PROPERTY`, hoặc `qobject_cast` BẮT BUỘC phải chứa macro `Q_OBJECT`. Khi gặp lỗi `undefined reference to vtable for ...`, kiểm tra ngay 2 điểm: macro `Q_OBJECT` và cấu hình `CMAKE_AUTOMOC ON`.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [doc.qt.io: Meta-Object System](https://doc.qt.io/qt-6/metaobjects.html) | Chi tiết về MOC, Introspection, Dynamic Cast trong Qt |
| [doc.qt.io: Object Trees & Ownership](https://doc.qt.io/qt-6/objecttrees.html) | Mô hình phân cấp bộ nhớ cha con của `QObject` |
| [doc.qt.io: Signals & Slots](https://doc.qt.io/qt-6/signalsandslots.html) | Cơ chế truyền tin bất đồng bộ và bảng `Qt::ConnectionType` |
| [doc.qt.io: The Property System](https://doc.qt.io/qt-6/properties.html) | Khai báo và sử dụng `Q_PROPERTY` cho QML binding |
| *Mastering Qt 5* (Guillaume Lazar) — Chapter 1, 2 | Cấu trúc chuyên sâu về Signals/Slots compile-time, custom MOC types |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu Kỹ Thuật | Giải Pháp Cú Pháp |
| :--- | :--- |
| Khai báo Signal-Slot và Meta-Object | Khai báo macro `Q_OBJECT` ở dòng đầu của class |
| Kết nối Signal sang Slot an toàn | `connect(sender, &Sender::sig, receiver, &Receiver::slot);` |
| Kết nối Signal sang Lambda | `connect(sender, &Sender::sig, [this](int val) { process(val); });` |
| Bắn tín hiệu từ C++ | `emit speedChanged(m_speed);` |
| Quản lý con trỏ an toàn chống dangling | Dùng `QPointer<MyObject> ptr = obj;` |
| Ngắt toàn bộ kết nối của một Object | `sender->disconnect();` hoặc `disconnect(sender, nullptr, receiver, nullptr);` |
| Tự động hóa MOC trong CMake | `set(CMAKE_AUTOMOC ON)` |
