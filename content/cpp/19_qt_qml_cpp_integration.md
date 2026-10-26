# Qt QML & C++ Integration — Kiến Trúc MVVM, Model/View & Qt Quick Scene Graph

> [!IMPORTANT]
> **Mục tiêu**:
> Tổng hợp toàn diện kỹ thuật kết nối giữa tầng **Backend C++ hiệu năng cao** và tầng **Frontend QML / Qt Quick hiện đại**: Kiến trúc MVVM (Model-View-ViewModel), cơ chế phơi bày dữ liệu (`Q_PROPERTY`, `Q_INVOKABLE`), mô hình danh sách `QAbstractListModel`, và quy chuẩn đóng gói module QML hiện đại với CMake trên **Qt6**.

---

## 1. Kiến Trúc MVVM Trong Qt / QML (Automotive & Embedded Standard)

```
┌─────────────────────────┐         ┌─────────────────────────┐         ┌─────────────────────────┐
│   1. MODEL (Backend)    │         │  2. VIEWMODEL (Bridge)  │         │    3. VIEW (Frontend)   │
│                         │         │                         │         │                         │
│  • Pure C++ Domain Data │ ◀─────▶ │  • Qt C++ (QObject)     │ ◀─────▶ │  • QML Declarative UI   │
│  • Không phụ thuộc Qt   │ (Pure   │  • Q_PROPERTY / Signal  │ (Data   │  • Qt Quick Controls    │
│  • Business & Physics   │  C++)   │  • QAbstractListModel   │ Binding)│  • Scene Graph (GPU)    │
└─────────────────────────┘         └─────────────────────────┘         └─────────────────────────┘
```

| Tầng | Ngôn Ngữ & Thư Viện | Trách Nhiệm Kỹ Thuật |
| :--- | :--- | :--- |
| **Model** | Pure C++ (ISO Standard) | Chứa Business Logic, thuật toán vật lý, lưu trữ cấu trúc dữ liệu thô, giao tiếp phần cứng (CAN, Socket, File I/O). |
| **ViewModel** | Qt C++ (`QObject`) | Cầu nối chuyển đổi dữ liệu thô từ Model thành các thuộc tính phản ứng (`Q_PROPERTY`), phát tín hiệu khi có cập nhật, điều phối luồng người dùng. |
| **View** | QML & Javascript | Khai báo bố cục giao diện (Layouts, Animations, Canvas/Scene Graph GPU), bắt sự kiện chạm/click và gọi xuống ViewModel. |

---

## 2. Các Kỹ Thuật Phơi Bày C++ Sang QML

### 2.1 Đăng Ký Kiểu Trong Qt6 (`QML_ELEMENT` & `qt_add_qml_module`)
Trong **Qt6**, chuẩn mực khuyến nghị là sử dụng macro `QML_ELEMENT` kết hợp với lệnh `qt_add_qml_module()` trong `CMakeLists.txt`:

```cpp
// CarViewModel.h
#include <QObject>
#include <QtQml/qqmlregistration.h>

class CarViewModel : public QObject
{
    Q_OBJECT
    QML_ELEMENT // Tự động đăng ký kiểu vào module QML tương ứng

    Q_PROPERTY(float speed READ speed NOTIFY speedChanged)

public:
    explicit CarViewModel(QObject* parent = nullptr);
    float speed() const;

    Q_INVOKABLE void emergencyBrake(); // Gọi trực tiếp từ QML

signals:
    void speedChanged();
};
```

Cấu hình trong `CMakeLists.txt`:
```cmake
qt_add_executable(CarApp src/main.cpp src/CarViewModel.cpp)

qt_add_qml_module(CarApp
    URI Vehicle.Dashboard
    VERSION 1.0
    QML_FILES views/MainDashboard.qml
)
```

Sử dụng trực tiếp trong QML:
```qml
import QtQuick
import Vehicle.Dashboard

Item
{
    CarViewModel
    {
        id: carVM
    }

    Text
    {
        text: carVM.speed.toFixed(1) + " km/h"
    }
}
```

---

## 3. Kiến Trúc Model/View: `QAbstractListModel`

Để hiển thị danh sách lớn (danh sách bài hát, danh sách lỗi CAN bus, log dữ liệu cảm biến) lên QML `ListView` với hiệu năng $O(1)$ về bộ nhớ (Lazy Loading/Recycling View), bắt buộc phải kế thừa `QAbstractListModel`.

### 3.1 Triển Khai `QAbstractListModel` Chuẩn
```cpp
// DiagnosticLogModel.h
struct LogEntry
{
    QString timestamp;
    QString ecuCode;
    QString description;
    int severityLevel;
};

class DiagnosticLogModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT

public:
    enum LogRoles
    {
        TimestampRole = Qt::UserRole + 1,
        EcuCodeRole,
        DescriptionRole,
        SeverityRole
    };

    explicit DiagnosticLogModel(QObject* parent = nullptr);

    int rowCount(const QModelIndex& parent = QModelIndex()) const override
    {
        return m_logs.size();
    }

    QVariant data(const QModelIndex& index, int role = Qt::DisplayRole) const override
    {
        if (!index.isValid() || index.row() >= m_logs.size())
        {
            return QVariant();
        }

        const auto& entry = m_logs.at(index.row());
        switch (role)
        {
            case TimestampRole:
                return entry.timestamp;
            case EcuCodeRole:
                return entry.ecuCode;
            case DescriptionRole:
                return entry.description;
            case SeverityRole:
                return entry.severityLevel;
            default:
                return QVariant();
        }
    }

    QHash<int, QByteArray> roleNames() const override
    {
        return {
            { TimestampRole, "timestamp" },
            { EcuCodeRole, "ecuCode" },
            { DescriptionRole, "description" },
            { SeverityRole, "severity" }
        };
    }

    void appendLog(const LogEntry& entry)
    {
        beginInsertRows(QModelIndex(), m_logs.size(), m_logs.size());
        m_logs.push_back(entry);
        endInsertRows(); // QML View tự động cập nhật mượt mà
    }

private:
    QVector<LogEntry> m_logs;
};
```

### 3.2 Hiển Thị Trong QML `ListView`
```qml
ListView
{
    anchors.fill: parent
    model: DiagnosticLogModel {}

    delegate: Rectangle
    {
        width: parent.width
        height: 40
        color: severity >= 2 ? "#ff4444" : "#222222"

        Row
        {
            spacing: 15
            Text { text: timestamp; color: "white" }
            Text { text: "[" + ecuCode + "]"; color: "yellow" }
            Text { text: description; color: "white" }
        }
    }
}
```

---

## 4. Qt Quick Scene Graph & Tối Ưu Hóa GPU

Qt Quick không sử dụng CPU để render từng pixel như QWidgets mà xây dựng một **Scene Graph (Cây đồ họa)** và đẩy trực tiếp xuống GPU qua **OpenGL, Vulkan, Direct3D hoặc Metal**:

```
[ QML Elements ] ──▶ [ Scene Graph Nodes (QSGNode) ] ──▶ [ Qt Rendering Hardware Interface (RHI) ] ──▶ [ GPU ]
```

> [!TIP]
> **Quy Tắc Tối Ưu Hiệu Năng QML Cho Embedded Systems:**
> 1. **Tránh biểu thức Javascript phức tạp trong Property Binding:** Chuyển toàn bộ logic tính toán nặng xuống C++ ViewModel.
> 2. **Sử dụng `Item` thay cho `Rectangle` khi chỉ cần làm container:** Giảm số lượng draw calls trên GPU.
> 3. **Tận dụng `ShaderEffect` và `Canvas` có kiểm soát:** Tránh re-paint toàn màn hình liên tục khi dữ liệu chỉ đổi ở một góc nhỏ.
> 4. **Bật Ahead-of-Time (AOT) QML Compilation:** `qt_add_qml_module` trong Qt6 tự động biên dịch QML sang C++ bytecode tĩnh, loại bỏ độ trễ JIT lúc chạy.

---

## 5. Case Study: QML Không Cập Nhật Giao Diện Do Thiếu Signal `NOTIFY`

> [!CAUTION]
> **Bối cảnh:** Bảng đồng hồ tốc độ xe (Cluster Instrument) binding giá trị vận tốc từ C++ ViewModel sang kim đồng hồ QML `Gauge { value: carSpeed.speed }`. Developer khai báo `Q_PROPERTY(double speed READ getSpeed WRITE setSpeed)`.
> **Triệu chứng:** Khi xe tăng tốc từ 0 lên 100 km/h, hàm `setSpeed()` ở tầng C++ được gọi liên tục mỗi 20ms, giá trị biến thành viên `m_speed` thay đổi chính xác trong debugger. Tuy nhiên, kim đồng hồ trên màn hình QML đứng im ở vạch 0 và không hề chuyển động.

### Phân tích nguyên nhân gốc (Root Cause)

QML Engine sử dụng cơ chế **Reactive Property Binding**. Để một biểu thức trong QML (`value: carSpeed.speed`) tự động đánh giá lại (re-evaluate) và kích hoạt GPU re-paint khi giá trị C++ thay đổi, QML bắt buộc phải lắng nghe một **Signal thông báo** được liên kết thông qua từ khóa `NOTIFY`.

```
┌────────────────────────────────────────────────────────┐
│ Thiếu NOTIFY:                                          │
│   C++ m_speed = 80.0                                   │
│   QML Engine KHÔNG nhận được thông báo biến động       │
│   ──▶ Kim đồng hồ QML KHÔNG vẽ lại (Re-paint skipped)  │
└────────────────────────────────────────────────────────┘
```

Nếu không có `NOTIFY`, QML chỉ đọc giá trị một lần duy nhất lúc khởi tạo component (First Evaluation) rồi bỏ qua toàn bộ các cập nhật tiếp theo.

```cpp
// TRƯỚC: Thiếu NOTIFY signal
class SpeedViewModel : public QObject
{
    Q_OBJECT
    // LỖI: Không có NOTIFY speedChanged -> QML binding bị điếc
    Q_PROPERTY(double speed READ getSpeed WRITE setSpeed)

public:
    double getSpeed() const { return m_speed; }
    void setSpeed(double val)
    {
        m_speed = val; // C++ cập nhật nhưng QML không hay biết!
    }

private:
    double m_speed = 0.0;
};
```

### Giải pháp

Bổ sung khai báo signal và liên kết vào `Q_PROPERTY` qua `NOTIFY`. Trong hàm setter, chỉ bắn signal (`emit speedChanged()`) khi giá trị mới thực sự khác biệt so với giá trị cũ để tránh kích hoạt re-render lãng phí GPU cycles.

```cpp
// SAU: Đầy đủ NOTIFY và kiểm tra sai số chống dư thừa tín hiệu
class SpeedViewModel : public QObject
{
    Q_OBJECT
    Q_PROPERTY(double speed READ getSpeed WRITE setSpeed NOTIFY speedChanged)

public:
    explicit SpeedViewModel(QObject* parent = nullptr)
        : QObject(parent)
        , m_speed(0.0)
    {
    }

    double getSpeed() const
    {
        return m_speed;
    }

    void setSpeed(double newSpeed)
    {
        // Tối ưu hóa GPU: Chỉ phát tín hiệu khi giá trị thay đổi thực tế
        if (qFuzzyCompare(m_speed, newSpeed))
        {
            return;
        }

        m_speed = newSpeed;
        emit speedChanged(m_speed); // QML nhận tín hiệu và cập nhật kim đo ngay lập tức
    }

signals:
    void speedChanged(double newSpeed);

private:
    double m_speed;
};
```

> [!TIP]
> **Bài học rút ra:** Mọi `Q_PROPERTY` cần hiển thị động lên QML BẮT BUỘC phải có `NOTIFY`. Luôn kèm điều kiện kiểm tra biến động (`qFuzzyCompare` cho số thực float/double, `!=` cho integer/object) trong setter để bảo vệ GPU Scene Graph khỏi hiện tượng thrashing.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [doc.qt.io: Overview — QML and C++ Integration](https://doc.qt.io/qt-6/qtqml-cppintegration-overview.html) | Toàn diện về cơ chế tương tác giữa QML và C++ |
| [doc.qt.io: Model/View Programming in QML](https://doc.qt.io/qt-6/qtquick-modelviewsdata-modelview.html) | Triển khai `QAbstractItemModel` cho QML Views |
| [doc.qt.io: Qt Quick Scene Graph](https://doc.qt.io/qt-6/qtquick-visualcanvas-scenegraph.html) | Kiến trúc Render Pipeline trên GPU |
| [doc.qt.io: CMake QML Module Guide](https://doc.qt.io/qt-6/qt-add-qml-module.html) | Đóng gói Module QML chuẩn Qt6 với `qt_add_qml_module` |
| *The QML Book* (Jürgen Ryannel, Johan Thelin) | Sách cẩm nang mã nguồn mở kinh điển về Qt Quick và QML |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu Kỹ Thuật | Giải Pháp Triển Khai |
| :--- | :--- |
| Expose biến C++ tự động cập nhật lên QML | `Q_PROPERTY(type name READ get NOTIFY changed)` |
| Gọi hàm C++ từ QML Javascript | Thêm macro `Q_INVOKABLE` hoặc khai báo trong `public slots:` |
| Đăng ký class C++ để tạo instance trong QML | Khai báo `QML_ELEMENT` + cấu hình `qt_add_qml_module()` trong CMake |
| Hiển thị danh sách động có hiệu năng cao | Kế thừa `QAbstractListModel`, ghi đè `rowCount()`, `data()`, `roleNames()` |
| Báo hiệu cho View khi thêm phần tử vào Model | `beginInsertRows(QModelIndex(), pos, pos);` $\rightarrow$ `endInsertRows();` |
| Bật tính năng biên dịch tĩnh QML (AOT) | Dùng lệnh `qt_add_qml_module` chuẩn của Qt6 |
