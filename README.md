# 📘 TechDocs Master — Embedded Linux & C++ Architecture Reader

> **Hệ thống Web Reader chuyên biệt cho đọc tài liệu kỹ thuật dài trên thiết bị di động (Mobile-First / E-Reader High-Contrast).**  
> Thiết kế chuẩn mực **"Tam tấm HTML / CSS / JS"**, hoàn toàn độc lập, không phụ thuộc Node.js hay package ngoại lai, triển khai tức thì lên **Vercel**.

---

## 📚 4 Kho Tri Thức Toàn Diện (131 Tài Liệu Chuyên Sâu)

1. **🐧 The Linux Programming Interface (TLPI) — Michael Kerrisk (64 Chương)**
   - Hệ thống POSIX, Quản lý tiến trình, Tín hiệu (Signals), Luồng (Threads & Synchronization), Memory Mappings, IPC (Pipes, FIFOs, System V, POSIX), Network Sockets.
2. **🔌 Essential Linux Device Drivers (ELDD) — Sreekrishnan Venkateswaran (21 Chương)**
   - Kiến trúc Kernel nội tại, Character Drivers, Serial, Input Subsystem, I2C/SMBus, PCMCIA, PCI, USB, Video Drivers (V4L2), MTD, Drivers trong User-space, Debugging.
3. **🛠️ Linux Device Drivers 3rd Edition (LDD3) — Jonathan Corbet, Greg KH (18 Chương)**
   - Khởi tạo Kernel Modules, Xử lý tương tranh & Race Conditions, Cấp phát bộ nhớ Kernel, Giao tiếp phần cứng, Ngắt (Interrupt Handling), Block & Network Drivers.
4. **⚡ C++ Core & Embedded Architecture (28 Chuyên Đề)**
   - Master Lookup Guide & Bảng ma trận tương thích C++11/14/17/20.
   - 27 Module chuyên sâu: Mô hình bộ nhớ, Con trỏ thông minh, Template Metaprogramming, Multithreading, Qt6 MVVM Cockpit, Automotive State Machine, 100+ Viva Interview Questions.

---

## 📱 Thiết Kế Tối Ưu Cho Màn Hình Di Động (Redmi 10 / 20:9 Viewport)

- **Phong cách E-Reader High-Contrast (Kindle / Paper-Like):**
  - **Light Style (Kindle Warm Paperwhite):** Nền giấy ngà ấm `#fbf9f4`, mực than đen sâu `#111827` (Tương phản 17.5:1, chống chói mắt).
  - **Dark Style (Charcoal E-Ink Invert):** Nền than chì ấm `#121316`, mực phấn `#f9fafb` (Tương phản 16:1, triệt tiêu ánh sáng xanh IPS).
- **Điều hướng một tay (Thumb Zone Ergonomics):**
  - Nút tròn nổi **TOC FAB** và Modal Mục lục dạng **Bottom Sheet** trượt từ dưới đáy màn hình.
  - Cặp nút **"Bài trước" / "Bài kế tiếp"** 52px ở chân trang.
- **Bảo toàn Sơ đồ ASCII (Memory Topologies):**
  - Khóa tỷ lệ ký tự `letter-spacing: 0px !important;`, cuộn ngang mượt mà, không bao giờ bị vỡ sơ đồ 80 cột.
- **Khối mã nguồn kỹ thuật (Book Technical Plate):**
  - Tô màu cú pháp C/C++ Allman và Bash thuần JavaScript, có nút sao chép tức thì.

---

## 🚀 Hướng Dẫn Triển Khai Lên Vercel

### Cách 1: Triển khai qua GitHub (Tự động đồng bộ)
1. Đẩy mã nguồn lên GitHub.
2. Truy cập [vercel.com/new](https://vercel.com/new), chọn **Import Git Repository**.
3. Chọn thư mục gốc `./` và bấm **Deploy**. Vercel sẽ cấp phát URL dạng `https://<ten-repo>.vercel.app`.

### Cách 2: Triển khai tức thì qua Vercel CLI
```bash
npx vercel
npx vercel --prod
```

---

## 🔄 Quy Trình Cập Nhật Tri Thức

Khi viết thêm chương sách mới vào Obsidian Vault, chỉ cần chạy:
```powershell
python tools/sync.py
```
Script sẽ tự động quét, cập nhật các chương mới vào `docs_data.js` và đồng bộ nội dung.
