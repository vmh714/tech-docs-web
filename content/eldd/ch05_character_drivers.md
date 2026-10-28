# Chương 5: Trình điều khiển thiết bị ký tự (Character Drivers)

| Trong chương này | Trang |
|------------------|-------|
| Cơ bản về Trình điều khiển ký tự | 120 |
| Ví dụ thiết bị: CMOS hệ thống | 121 |
| Phát hiện tính khả dụng của dữ liệu | 139 |
| Giao tiếp với cổng song song | 145 |
| Hệ thống con RTC | 156 |
| Trình điều khiển ký tự giả (Pseudo Char Drivers) | 157 |
| Trình điều khiển hỗn hợp (Misc Drivers) | 160 |
| Các lưu ý về thiết bị ký tự | 166 |
| Xem xét mã nguồn | 167 |

Bây giờ bạn đã sẵn sàng để dấn thân vào việc viết các trình điều khiển thiết bị (device drivers) đơn giản nhưng mang tính thực tế. Trong chương này, chúng ta hãy cùng tìm hiểu cơ chế hoạt động bên trong của một trình điều khiển thiết bị ký tự (character driver hoặc char driver). Đây là đoạn mã chạy trong không gian nhân (kernel space) có nhiệm vụ truy nhập dữ liệu tuần tự từ một thiết bị. Các char driver có thể thu thập dữ liệu thô (raw data) từ nhiều loại thiết bị khác nhau: máy in, chuột, mạch giám sát (watchdog), băng từ, bộ nhớ, RTC, v.v. Tuy nhiên, chúng không phù hợp để quản lý dữ liệu nằm trên các thiết bị khối (block device) có khả năng truy nhập ngẫu nhiên như ổ cứng, đĩa mềm hoặc đĩa quang (CD/DVD).

## Cơ bản về trình điều khiển ký tự

Hãy bắt đầu với một góc nhìn từ trên xuống (top-down view). Để truy nhập một thiết bị ký tự (char device), ứng dụng ở không gian người dùng (user space) sẽ thực thi một chương trình phù hợp. Ứng dụng chịu trách nhiệm trao đổi dữ liệu với thiết bị, nhưng để làm được điều đó, nó cần xác định được danh tính của driver tương ứng. Thông tin giao tiếp của driver được xuất ra user space thông qua thư mục `/dev`:

```bash
bash> ls -l /dev
total 0
crw------- 1 root root 5, 1 Jul 16 10:02 console
...
lrwxrwxrwx 1 root root 3 Oct 6 10:02 cdrom -> hdc
...
brw-rw---- 1 root disk 3, 0 Oct 6 2007 hda
brw-rw---- 1 root disk 3, 1 Oct 6 2007 hda1
...
crw------- 1 root tty 4, 1 Oct 6 10:20 tty1
crw------- 1 root tty 4, 2 Oct 6 10:02 tty2
```

Ký tự đầu tiên trong mỗi dòng của kết quả lệnh `ls` biểu thị loại driver: `c` chỉ định một char driver, `b` đại diện cho một block driver, và `l` biểu thị một liên kết mềm (symbolic link). Các con số ở cột thứ năm được gọi là *major number* (số chính), và các con số ở cột thứ sáu là *minor number* (số phụ). Major number xác định tổng quát driver, trong khi minor number chỉ định chính exact thiết bị cụ thể do driver đó quản lý. Ví dụ, driver lưu trữ khối IDE `/dev/hda` nắm giữ major number là `3` và chịu trách nhiệm xử lý ổ cứng trên hệ thống của bạn, nhưng khi bạn chỉ định thêm minor number là `1` (`/dev/hda1`), phạm vi xử lý sẽ được thu hẹp về phân vùng đĩa đầu tiên. Char driver và block driver nằm ở các không gian định danh khác nhau, do đó bạn hoàn toàn có thể có cùng một major number được gán đồng thời cho cả char driver và block driver.

Hãy tiến thêm một bước nữa để khám phá cấu trúc bên trong của một char driver. Từ góc độ luồng thi hành mã (code-flow), một char driver bao gồm:

- Một hàm khởi tạo (routine `init()`) chịu trách nhiệm khởi tạo thiết bị và gắn kết driver một cách trong suốt với phần còn lại của kernel thông qua các hàm đăng ký (registration functions).
- Một tập hợp các điểm vào (entry points hoặc methods) như `open()`, `read()`, `ioctl()`, `llseek()`, và `write()`, tương ứng trực tiếp với các lời gọi hệ thống (system call) I/O do ứng dụng người dùng thực thi trên node `/dev` tương ứng.
- Các trình xử lý ngắt (interrupt routines), cơ chế xử lý nửa sau ngắt (bottom halves), trình xử lý bộ hẹn giờ (timer handlers), các luồng hỗ trợ trong kernel (helper kernel threads), cùng các cơ sở hạ tầng bổ trợ khác. Những thành phần này hoàn toàn trong suốt (transparent) đối với các ứng dụng người dùng.

Từ góc độ luồng dữ liệu (data-flow), các char driver quản lý các cấu trúc dữ liệu cốt lõi sau:

1. **Cấu trúc dữ liệu theo từng thiết bị (per-device structure)**: Đây là kho lưu trữ thông tin trung tâm mà toàn bộ hoạt động của driver xoay quanh.
2. `struct cdev`: Cấu trúc trừu tượng hóa của kernel dành cho các trình điều khiển ký tự. Cấu trúc này thường được nhúng bên trong cấu trúc per-device được đề cập ở trên.
3. `struct file_operations`: Cấu trúc chứa địa chỉ hàm của tất cả các điểm vào (entry points) của driver.
4. `struct file`: Cấu trúc chứa thông tin về đại diện file mở liên kết với node `/dev` tương ứng.
