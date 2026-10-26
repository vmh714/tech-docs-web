# Chương 5. Trình điều khiển thiết bị ký tự (Character Drivers)

| Trong chương này             |     |
|------------------------------|-----|
| Cơ bản về Trình điều khiển ký tự | 120 |
| Ví dụ thiết bị: CMOS hệ thống | 121 |
| Phát hiện tính khả dụng của dữ liệu | 139 |
| Giao tiếp với cổng song song  | 145 |
| Hệ thống con RTC             | 156 |
| Trình điều khiển ký tự giả (Pseudo Char Drivers) | 157 |
| Trình điều khiển hỗn hợp (Misc Drivers) | 160 |
| Các lưu ý về thiết bị ký tự  | 166 |
| Xem xét mã nguồn              | 167 |
|                              |     |

Bây giờ bạn đã sẵn sàng để dấn thân vào việc viết các trình điều khiển thiết bị (device drivers) đơn giản nhưng mang tính thực tế. Trong chương này, chúng ta hãy cùng tìm hiểu các hoạt động bên trong của một trình điều khiển thiết bị ký tự (character hoặc char device driver), đây là mã nguồn kernel (kernel code) có nhiệm vụ truy cập dữ liệu tuần tự từ một thiết bị. Các char driver có thể thu thập dữ liệu thô (raw data) từ nhiều loại thiết bị khác nhau: máy in, chuột, thiết bị theo dõi lỗi hệ thống (watchdog), băng từ, bộ nhớ, RTC, v.v. Tuy nhiên, chúng không phù hợp để quản lý dữ liệu nằm trên các thiết bị khối (block device) có khả năng truy cập ngẫu nhiên như ổ cứng, đĩa mềm hoặc đĩa quang.

## Cơ bản về Trình điều khiển ký tự (Char Driver Basics)

Hãy bắt đầu với góc nhìn từ trên xuống (top-down view). Để truy cập một thiết bị ký tự (char device), người dùng hệ thống gọi một chương trình ứng dụng phù hợp. Ứng dụng chịu trách nhiệm giao tiếp với thiết bị, nhưng để làm được điều đó, nó cần xác định danh tính của một trình điều khiển (driver) phù hợp. Chi tiết liên lạc của driver được xuất ra user space thông qua thư mục */dev*:

#### bash> ls -l /dev

```
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

Ký tự đầu tiên trong mỗi dòng của kết quả lệnh ls biểu thị loại driver: c biểu thị char driver, b đại diện cho block driver, và l biểu thị liên kết tượng trưng (symbolic link). Các con số ở cột thứ năm được gọi là số chính (*major number*), và những con số ở cột thứ sáu là số phụ (*minor number*). Major number xác định tổng quát driver, trong khi minor number chỉ định chính xác thiết bị được phục vụ bởi driver đó. Ví dụ, trình điều khiển lưu trữ khối IDE */dev/hda* sở hữu major number là 3 và chịu trách nhiệm xử lý ổ cứng trên hệ thống của bạn, nhưng khi bạn chỉ định thêm minor number là 1 (*/dev/hda1*), phạm vi sẽ thu hẹp xuống phân vùng đĩa đầu tiên. Char driver và block driver chiếm các không gian khác nhau, vì vậy bạn có thể có cùng một major number được gán cho cả char driver lẫn block driver.

Hãy tiến thêm một bước nữa và thâm nhập vào bên trong một char driver. Từ góc độ luồng mã nguồn (code-flow), các char driver có các thành phần sau:

- Một hàm khởi tạo (routine init()) có trách nhiệm khởi tạo thiết bị và gắn kết driver một cách mượt mà với phần còn lại của kernel thông qua các hàm đăng ký (registration functions).
- Một tập hợp các điểm vào (entry points hoặc methods) như open(), read(), ioctl(), llseek(), và write(), tương ứng trực tiếp với các system call I/O được gọi bởi các ứng dụng ở user space thông qua nút */dev* tương ứng.
- Các hàm ngắt (interrupt routines), nửa dưới (bottom halves), trình xử lý bộ hẹn giờ (timer handlers), kernel thread hỗ trợ (helper kernel threads), và các cơ sở hạ tầng hỗ trợ khác. Những phần này phần lớn là trong suốt (transparent) đối với các ứng dụng người dùng.

Từ góc độ luồng dữ liệu (data-flow), các char driver sở hữu các cấu trúc dữ liệu chính sau:

- **1.** Cấu trúc cho mỗi thiết bị (per-device structure). Đây là kho lưu trữ thông tin mà driver xoay quanh đó.
- struct cdev, một sự trừu tượng hóa trong kernel dành cho các trình điều khiển ký tự. Cấu trúc này thường được nhúng bên trong cấu trúc per-device được đề cập trước đó. **2.**
- **3.** struct file_operations, chứa địa chỉ của tất cả các điểm vào (entry points) của driver.
- **4.** struct file, chứa thông tin về nút */dev* liên quan.
