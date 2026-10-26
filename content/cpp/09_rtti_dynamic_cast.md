# Type Casting và RTTI (Run-Time Type Information)

> [!IMPORTANT]
> **Mục tiêu**:
> Hiểu rõ cơ chế RTTI trong C++ và cách thức hoạt động, cảnh báo hiệu năng của `dynamic_cast` trong hệ thống phân cấp kế thừa đa hình (Polymorphic Class Hierarchy).

---

## 1. RTTI (Run-Time Type Information)

> [!NOTE]
> **RTTI là gì?**
> C++ thường phân giải kiểu tại thời điểm biên dịch (Compile-time) để tối ưu hiệu năng. Tuy nhiên, khi sử dụng Đa hình (Polymorphism), kiểu thực tế của đối tượng (Dynamic Type) nằm sau con trỏ lớp cơ sở (Base Pointer) có thể thay đổi trong quá trình chạy.
> RTTI là cơ chế cho phép C++ truy xuất thông tin về kiểu thực tế của đối tượng tại thời điểm chạy (Runtime). Hai công cụ chính của RTTI là `typeid` và `dynamic_cast`.

> [!WARNING]
> **Yêu cầu Bắt buộc:**
> RTTI **chỉ** hoạt động với các lớp Đa hình (Polymorphic classes). Tức là lớp cơ sở phải có **ít nhất một hàm ảo (virtual function)** (thường là `virtual destructor`). Nếu không có hàm ảo, RTTI sẽ không được bật cho lớp đó, và việc cố gắng sử dụng `dynamic_cast` sẽ dẫn đến lỗi biên dịch.

---

## 2. Các Loại C++ Cast (Type Casting)

C++ cung cấp 4 loại ép kiểu (cast) thay vì kiểu cast C-style (`(Type)value`) để tăng tính rõ ràng và an toàn:

1. **`static_cast<T>`**: Ép kiểu tại Compile-time. Dùng cho các chuyển đổi cơ bản (float -> int) hoặc upcast/downcast khi lập trình viên **chắc chắn** 100% về kiểu dữ liệu. KHÔNG có kiểm tra an toàn tại runtime.
2. **`reinterpret_cast<T>`**: Ép kiểu con trỏ một cách thô bạo (bit-level). Rất nguy hiểm, chủ yếu dùng khi tương tác trực tiếp với bộ nhớ hoặc phần cứng thấp.
3. **`const_cast<T>`**: Dùng để thêm hoặc xóa bỏ thuộc tính `const` của biến.
4. **`dynamic_cast<T>`**: Ép kiểu tại Runtime, dành riêng cho các lớp Đa hình. Cực kỳ an toàn nhưng đi kèm chi phí hiệu năng (overhead).

---

## 3. Hoạt động của `dynamic_cast`

> [!TIP]
> **Sử dụng `dynamic_cast` khi nào?**
> Khi bạn có một con trỏ lớp cơ sở (`Base*`) và muốn gọi một hàm ĐẶC THÙ chỉ tồn tại ở lớp dẫn xuất (`Derived`), bạn cần downcast một cách an toàn.

```cpp
class AudioSource {
public:
    virtual ~AudioSource() = default; // Bắt buộc có virtual để bật RTTI
};

class InternetRadioSource : public AudioSource {
public:
    void displayMetadata() { /* ... */ }
};

void processAudio(AudioSource* source) {
    // Ép kiểu động để kiểm tra xem 'source' có thực sự là 'InternetRadioSource' không
    InternetRadioSource* radio = dynamic_cast<InternetRadioSource*>(source);
    
    if (radio != nullptr) {
        // Thành công: 'source' thực sự là InternetRadioSource
        radio->displayMetadata();
    } else {
        // Thất bại: 'source' là một loại AudioSource khác (LocalFile, Bluetooth...)
        // Tránh được lỗi crash!
    }
}
```

> [!CAUTION]
> **Nhược điểm (Overhead) của `dynamic_cast`**
> Khác với `static_cast` hoàn tất mọi việc ở compile-time, `dynamic_cast` yêu cầu chạy thuật toán kiểm tra cây kế thừa (inheritance tree) thông qua `vtable` và `type_info` tại runtime.
> - Trên các hệ thống nhúng (Embedded Systems) hoặc mã nguồn thời gian thực (Real-time), việc sử dụng quá nhiều `dynamic_cast` hoặc bật RTTI có thể gây tốn CPU và RAM.
> - Các nhà phát triển hệ thống nhúng thỉnh thoảng sẽ biên dịch với cờ `-fno-rtti` để tắt hoàn toàn tính năng này nhằm tiết kiệm tài nguyên.

---

## 4. Case Study: dynamic_cast Trả nullptr → Crash Không Kiểm Tra

> [!CAUTION]
> **Bối cảnh:** Hệ thống sensor plugin — base pointer `ISensor*` trỏ tới nhiều loại sensor. Developer dùng `dynamic_cast<CameraSensor*>` để truy cập method riêng, nhưng **không kiểm tra nullptr** khi sensor thực tế là `RadarSensor`.

```cpp
// ❌ TRƯỚC — không kiểm tra kết quả dynamic_cast
void processCamera(ISensor* sensor)
{
    CameraSensor* cam = dynamic_cast<CameraSensor*>(sensor);
    cam->captureFrame(); // ← nếu sensor là Radar → cam = nullptr → CRASH!
}

// ✅ SAU — pattern an toàn
void processCamera(ISensor* sensor)
{
    if (auto* cam = dynamic_cast<CameraSensor*>(sensor))
    {
        cam->captureFrame(); // CHỈ gọi khi cast thành công
    }
    else
    {
        logWarning("Expected CameraSensor, got different type");
    }
}
```

> [!TIP]
> - `dynamic_cast<T*>` trả `nullptr` khi thất bại (pointer version). `dynamic_cast<T&>` ném `std::bad_cast` (reference version).
> - Trên embedded với `-fno-rtti`: `dynamic_cast` **KHÔNG hoạt động** → dùng enum type tag hoặc visitor pattern thay thế.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [cppreference: dynamic_cast](https://en.cppreference.com/w/cpp/language/dynamic_cast) | Cú pháp, cơ chế RTTI traversal, xử lý con trỏ vs tham chiếu |
| [cppreference: typeid operator](https://en.cppreference.com/w/cpp/language/typeid) | Truy vấn `std::type_info` lúc runtime cho polymorphic types |
| *Effective C++* (Scott Meyers) — Item 27 | Hạn chế ép kiểu (Minimize casting), chi phí tiềm ẩn của `dynamic_cast` |
| *AUTOSAR C++14 Guidelines* — Rule A5-2-1 to A5-2-6 | Hạn chế RTTI và `dynamic_cast` trong hệ thống nhúng an toàn chức năng |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

| Nhu Cầu | Loại Cast | Đặc Điểm |
| :--- | :--- | :--- |
| Chuyển kiểu cơ bản, Downcast an toàn chắc chắn | `static_cast<T>` | Compile-time, Zero runtime overhead |
| Downcast an toàn với polymorphic class | `dynamic_cast<T>` | Runtime check qua `type_info`, tốn CPU, trả `nullptr` nếu fail |
| Thao tác raw memory / hardware register | `reinterpret_cast<T>` | Bit-level reinterpretation, nguy hiểm |
| Xóa bỏ hoặc thêm tính `const` | `const_cast<T>` | Chỉ dùng khi interface bên ngoài thiếu `const` |
| Tối ưu hóa ROM/RAM cho ECU | Biên dịch với `-fno-rtti` | Tắt hoàn toàn RTTI, cấm dùng `dynamic_cast`/`typeid` |
