# Qt Multithreading & Event Loop — QThread, Worker Pattern & Thread Affinity

> [!IMPORTANT]
> **Mục tiêu**:
> Phân tích bản chất Event Loop trong Qt, cơ chế gán luồng (Thread Affinity) của `QObject`, mô hình chuẩn **Worker Object + `moveToThread()`** cho các tác vụ thời gian thực (CAN bus, xử lý ảnh Camera, xử lý cảm biến), và các lỗi chí mạng khi lập trình đa luồng trên Qt.

---

## 1. Event Loop & Quá Trình Xử Lý Sự Kiện (`QEventLoop`)

### 1.1 Vòng Lặp Xử Lý Sự Kiện
Mỗi ứng dụng Qt có ít nhất một **Main Event Loop** được khởi động bởi `app.exec()`:

```
    [ OS / Hardware / User Input ]
                 │ (Timer / Socket / Touch)
                 ▼
    [ Operating System Event Queue ]
                 │ (Qt Window System Integration - QPA)
                 ▼
    [ Qt Thread Event Queue ] ◀─── QCoreApplication::postEvent() [Thread-Safe]
                 │
                 ▼ (QEventLoop::processEvents())
    [ QCoreApplication::sendEvent() / notify() ]
                 │
                 ▼
    [ QObject::event(QEvent* e) ] ──▶ [ PaintEvent / Custom Event Handler ]
```

* **`QCoreApplication::sendEvent()` (Đồng bộ):** Gửi event trực tiếp đến hàm `event()` của đối tượng đích và chờ xử lý xong ngay lập tức.
* **`QCoreApplication::postEvent()` (Bất đồng bộ - Thread-Safe):** Đẩy event vào hàng đợi của thread sở hữu đối tượng đích và trả về ngay.

### 1.2 Event Filter (`QObject::eventFilter`)
Cho phép một `QObject` chặn và xử lý sự kiện trước khi sự kiện đó tới được đối tượng đích:
```cpp
bool KeyInterceptor::eventFilter(QObject* watched, QEvent* event)
{
    if (event->type() == QEvent::KeyPress)
    {
        auto keyEvent = static_cast<QKeyEvent*>(event);
        if (keyEvent->key() == Qt::Key_Escape)
        {
            // Chặn phím Escape không cho gửi tiếp
            return true;
        }
    }
    // Chuyển tiếp các sự kiện khác cho đối tượng đích xử lý bình thường
    return QObject::eventFilter(watched, event);
}
```

---

## 2. Thread Affinity Của `QObject`

Mỗi instance `QObject` đều có một thuộc tính nội bộ gọi là **Thread Affinity** (luồng sở hữu đối tượng):

```
┌────────────────────────────────────────────────────────┐
│ Thread Affinity của một QObject quyết định:            │
│ 1. Event Loop của Thread nào sẽ xử lý event gửi đến nó.│
│ 2. Thread nào sẽ thực thi Slot khi nhận Queued Signal. │
│ 3. Timer (QTimer) của nó sẽ kích hoạt trên Thread nào. │
└────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **Quy Tắc Thread Affinity Cốt Lõi:**
> 1. Một `QObject` chỉ có thể tương tác trực tiếp với các `QObject` con nằm **cùng Thread Affinity**.
> 2. `QObject` cha và con **BẮT BUỘC** phải nằm trên cùng một luồng. Không thể dùng `moveToThread()` trên một đối tượng con (phải di chuyển đối tượng cha gốc).
> 3. Cấm tạo đối tượng giao diện đồ họa (QWidgets, QQuickItem) ở bất kỳ luồng nào ngoài **Main / GUI Thread**.

---

## 3. Mô Hình Đa Luồng Chuẩn: Worker Object + `moveToThread()`

Qt khuyến nghị **KHÔNG KẾ THỪA `QThread`** để viết code xử lý logic, mà sử dụng mô hình **Worker Object**:

### 3.1 Cấu Trúc Worker Object
```cpp
// SensorWorker.h
class SensorWorker : public QObject
{
    Q_OBJECT

public:
    explicit SensorWorker(QObject* parent = nullptr);

public slots:
    void startAcquisition();
    void processFrame(const QByteArray& rawData);
    void stopAcquisition();

signals:
    void frameProcessed(double speed, double rpm);
    void errorOccurred(const QString& errorMsg);
    void finished();
};
```

### 3.2 Khởi Tạo & Điều Phối Luồng Đúng Chuẩn
```cpp
// Controller.cpp
void Controller::setupWorkerPipeline()
{
    auto thread = new QThread(this);
    auto worker = new SensorWorker(); // KHÔNG truyền parent để có thể move thread

    // 1. Chuyển affinity của Worker sang Thread con
    worker->moveToThread(thread);

    // 2. Kích hoạt Worker khi Thread bắt đầu chạy
    connect(thread, &QThread::started, worker, &SensorWorker::startAcquisition);

    // 3. Nhận dữ liệu từ Worker về UI Thread an toàn (QueuedConnection tự động)
    connect(worker, &SensorWorker::frameProcessed, this, &Controller::onTelemetryReceived);

    // 4. Thu hồi bộ nhớ an toàn (RAII qua deleteLater) khi hoàn thành
    connect(worker, &SensorWorker::finished, thread, &QThread::quit);
    connect(worker, &SensorWorker::finished, worker, &QObject::deleteLater);
    connect(thread, &QThread::finished, thread, &QObject::deleteLater);

    // 5. Khởi động Event Loop của Thread con
    thread->start();
}
```

---

## 4. So Sánh: Worker Object vs Subclassing `QThread`

| Tiêu Chí | Worker + `moveToThread()` (Khuyên Dùng) | Kế Thừa `QThread::run()` (Cổ Điển) |
| :--- | :--- | :--- |
| **Bản chất** | Tách biệt hoàn toàn luồng (`QThread`) và tác vụ (`Worker`) | Gộp chung Thread controller và Worker logic |
| **Event Loop** | Tự động chạy Event Loop đầy đủ trên thread con | Phải tự gọi `exec()` trong `run()` nếu muốn dùng Signal/Slot |
| **Signal-Slot** | Hoạt động trơn tru với `QueuedConnection` | Bẫy Thread Affinity: các Slot của `QThread` chạy ở **Thread Cha**, không phải con |
| **Độ phức tạp** | Rõ ràng, dễ mở rộng, dễ Unit Test | Dễ dính Data Race và Deadlock |

---

## 5. Các Công Cụ Đồng Bộ Hóa Đa Luồng Trong Qt

* **`QMutex` & `QMutexLocker` (RAII):**
  ```cpp
  QMutex mutex;
  void writeData()
  {
      QMutexLocker locker(&mutex); // Tự động lock và unlock khi ra khỏi scope
      // Critical section
  }
  ```
* **`QReadWriteLock` & `QReadLocker` / `QWriteLocker`:** Tối ưu hóa cho trường hợp nhiều luồng Đọc dữ liệu cảm biến và một luồng Ghi.
* **`QWaitCondition`:** Tương đương `std::condition_variable`, dùng cho mô hình Producer-Consumer đồng bộ luồng xử lý frame camera.

---

## 6. Case Study: Giao Diện IVI Bị Treo (UI Freeze) Do Tính Toán Trên Main Thread

> [!CAUTION]
> **Bối cảnh:** Màn hình giải trí xe hơi (IVI) cần giải mã danh sách 50,000 bài hát và trích xuất ảnh bìa (ID3 tag) từ USB khi cắm vào cổng trung tâm. Developer thực hiện vòng lặp đọc file và parse ảnh trực tiếp trong slot xử lý sự kiện `onUsbMounted()`.
> **Triệu chứng:** Màn hình IVI đứng yên hoàn toàn trong 8 giây (UI Freeze). Mọi thao tác chạm cảm ứng chỉnh điều hòa, phản hồi volume đều bị liệt, watchdog hệ thống kích hoạt cảnh báo ANR (Application Not Responding).

### Phân tích nguyên nhân gốc (Root Cause)

Qt chạy toàn bộ giao diện (GUI rendering, Touch events, Animations) trên **Main Thread** thông qua vòng lặp sự kiện `QCoreApplication::exec()`. 

```
┌────────────────────────────────────────────────────────┐
│ Main Thread Event Loop:                                │
│ [Render Frame] ──▶ [Touch Event] ──▶ [Heavy File I/O]  │
│                                      (Treo 8 giây!)    │
│                     ▲                                  │
│                     └── Mọi event mới bị ứ đọng queue! │
└────────────────────────────────────────────────────────┘
```

Khi Main Thread bị chiếm dụng bởi tác vụ I/O nặng kéo dài hàng giây, Event Loop không thể xử lý các thông điệp `QPaintEvent` hay `QMouseEvent`. Giao diện bị "đóng băng" vật lý.

```cpp
// TRƯỚC: Xử lý I/O nặng trực tiếp trên Main Thread
void MediaWidget::onUsbMounted(const QString& usbPath)
{
    // LỖI: Chặn đứng Main Thread 8 giây
    for (const auto& file : scanUsbFiles(usbPath))
    {
        AlbumArt art = decodeId3Tag(file); // I/O & CPU-intensive
        updatePlaylistUi(art);
    }
}
```

### Giải pháp

Tách tác vụ I/O và parse dữ liệu ra một `Worker` độc lập chạy trên luồng phụ (`QThread`) bằng cơ chế `moveToThread()`. Kết quả được gửi về Main Thread thông qua Signal-Slot với `Qt::QueuedConnection` (tự động kích hoạt khi kết nối xuyên luồng).

```cpp
// Định nghĩa struct dữ liệu ảnh và khai báo MetaType để truyền xuyên luồng
struct AlbumArt
{
    QString title;
    QByteArray rawImageData;
};
Q_DECLARE_METATYPE(AlbumArt)

class MediaScannerWorker : public QObject
{
    Q_OBJECT

public slots:
    void doScan(const QString& usbPath)
    {
        for (const auto& file : scanUsbFiles(usbPath))
        {
            AlbumArt art = decodeId3Tag(file);
            emit itemParsed(art); // Bắn signal xuyên luồng (QueuedConnection)
        }
        emit scanFinished();
    }

signals:
    void itemParsed(AlbumArt art);
    void scanFinished();
};

// Khởi tạo, đăng ký MetaType và quản lý vòng đời luồng từ Controller
void MediaController::startBackgroundScan(const QString& usbPath)
{
    // BẮT BUỘC: Đăng ký kiểu dữ liệu tùy biến vào hệ thống Meta-Object của Qt
    qRegisterMetaType<AlbumArt>("AlbumArt");

    QThread* workerThread = new QThread(this);
    MediaScannerWorker* worker = new MediaScannerWorker(); // Không gán parent cho worker chạy luồng khác

    worker->moveToThread(workerThread);

    connect(workerThread, &QThread::started, worker, [worker, usbPath]() {
        worker->doScan(usbPath);
    });
    connect(worker, &MediaScannerWorker::itemParsed, this, &MediaController::onItemParsed);
    connect(worker, &MediaScannerWorker::scanFinished, workerThread, &QThread::quit);
    connect(workerThread, &QThread::finished, worker, &QObject::deleteLater);
    connect(workerThread, &QThread::finished, workerThread, &QObject::deleteLater);

    workerThread->start(); // Main Thread hoàn toàn rảnh tay, UI giữ 60 FPS
}

MediaController::~MediaController()
{
    // Đảm bảo dừng luồng an toàn (Deterministic Destruction) nếu Controller bị hủy trước
    if (m_workerThread && m_workerThread->isRunning())
    {
        m_workerThread->quit();
        m_workerThread->wait(1000); // Đợi tối đa 1 giây
    }
}
```

> [!TIP]
> **Bài học rút ra:** TUYỆT ĐỐI KHÔNG thực hiện File I/O, Network Socket, hoặc giải mã hình ảnh/video trên GUI Thread. Sử dụng `moveToThread()` kết hợp `deleteLater()` để dọn dẹp bộ nhớ luồng theo chuẩn RAII trong Qt.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [doc.qt.io: Threading Basics](https://doc.qt.io/qt-6/threads-technologies.html) | Tổng quan các công nghệ đa luồng trong Qt |
| [doc.qt.io: QThread Class](https://doc.qt.io/qt-6/qthread.html) | Chi tiết về vòng đời `QThread`, `moveToThread()` và `deleteLater()` |
| [doc.qt.io: Threads and QObjects](https://doc.qt.io/qt-6/threads-qobject.html) | Bản chất Thread Affinity và Reentrancy |
| [doc.qt.io: The Event System](https://doc.qt.io/qt-6/eventsandfilters.html) | Cơ chế Event Loop, `postEvent()` và Event Filters |
| *C++ GUI Programming with Qt 4 / Qt 5* (Blanchette, Summerfield) — Chapter 18 | Multithreading, Thread-safe Queues, Worker Pattern |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Tình Huống Kỹ Thuật | Giải Pháp Đa Luồng Chuẩn |
| :--- | :--- |
| Tác vụ nền tính toán nặng / đọc Socket | Tạo Worker `QObject` $\rightarrow$ `worker->moveToThread(thread)` |
| Truyền kết quả tính toán về GUI Thread | `emit resultReady(data);` (Tự động kích hoạt `QueuedConnection`) |
| Giải phóng Object ở thread khác an toàn | `object->deleteLater();` (Không dùng `delete` thô) |
| Cập nhật UI từ Worker Thread | **CẤM** gọi trực tiếp method của Widget/QML $\rightarrow$ Bắt buộc bắn Signal |
| Đợi Thread con kết thúc khi thoát ứng dụng | `thread->quit(); thread->wait();` |
| Tác vụ chạy một lần không cần Signal | `QThreadPool::globalInstance()->start(runnable);` hoặc `QtConcurrent::run()` |
