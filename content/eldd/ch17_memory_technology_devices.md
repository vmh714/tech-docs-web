# Chương 17. Thiết bị Công nghệ Bộ nhớ (Memory Technology Devices)

| Trong chương này    |     |
|------------------------|-----|
| Bộ nhớ Flash là gì?   | 504 |
| Hệ thống con Linux-MTD    | 505 |
| Trình điều khiển Ánh xạ (Map Drivers) | 506 |
| Trình điều khiển Chip NOR | 511 |
| Trình điều khiển Chip NAND | 513 |
| Các Mô-đun Người dùng (User Modules) | 516 |
| MTD-Utils              | 518 |
| Cấu hình MTD        | 519 |
| Thực thi tại chỗ (eXecute In Place) | 520 |
| Trung tâm Chương trình cơ sở (Firmware Hub) | 520 |
| Gỡ lỗi (Debugging)      | 524 |
| Tìm hiểu Mã nguồn (Looking at the Sources) | 524 |
|                        |     |

Khi bạn nhấn công tắc nguồn trên thiết bị cầm tay của mình, rất có thể nó sẽ khởi động từ bộ nhớ flash (flash memory). Khi bạn bấm một vài nút để lưu dữ liệu trên điện thoại di động của mình, với mọi xác suất, dữ liệu của bạn bắt đầu được lưu trữ trong bộ nhớ flash. Ngày nay, Linux đã thâm nhập vào không gian nhúng (embedded space) và không còn bị giới hạn ở máy tính để bàn (desktops) và máy chủ (servers). Các biến thể của Linux xuất hiện trên máy trợ lý kỹ thuật số cá nhân (PDA), máy nghe nhạc, hộp giải mã tín hiệu (set-top boxes), và thậm chí cả các thiết bị cấp y tế. Hệ thống con *Memory Technology Devices* (MTD) của kernel chịu trách nhiệm giao tiếp hệ thống của bạn với các biến thể bộ nhớ flash khác nhau được tìm thấy trong các thiết bị này. Trong chương này, chúng ta hãy sử dụng ví dụ về một thiết bị cầm tay chạy Linux để tìm hiểu về MTD.

## Bộ nhớ Flash là gì?

*Bộ nhớ flash* (Flash memory) là thiết bị lưu trữ có thể ghi lại (rewritable) và không cần nguồn điện để duy trì thông tin. Các ngân hàng bộ nhớ flash (flash memory banks) thường được tổ chức thành các *sector* (khu vực/phân vùng). Không giống như thiết bị lưu trữ thông thường, việc ghi vào các địa chỉ flash phải được tiến hành trước bằng một thao tác xóa (erase) các vị trí tương ứng. Hơn nữa, việc xóa các phần của flash chỉ có thể được thực hiện ở mức độ chi tiết của từng sector riêng lẻ. Do những ràng buộc này, bộ nhớ flash được sử dụng tốt nhất với các trình điều khiển thiết bị (device drivers) và hệ thống tập tin (filesystems) được thiết kế riêng cho chúng. Trên Linux, các trình điều khiển và hệ thống tập tin được thiết kế đặc biệt như vậy được cung cấp bởi hệ thống con MTD.

Các chip nhớ flash thường có hai loại: NOR và NAND. *NOR* là loại được sử dụng để lưu trữ các hình ảnh firmware (firmware images) trên thiết bị nhúng, trong khi *NAND* được sử dụng cho dung lượng lưu trữ lớn, mật độ cao, giá rẻ nhưng không hoàn hảo[1] theo yêu cầu của các phương tiện lưu trữ dung lượng lớn thể rắn (solid-state mass storage media) như ổ đĩa USB và *Disk-On-Modules* (DOM). Các chip flash NOR được kết nối với bộ xử lý thông qua các đường địa chỉ và dữ liệu giống như RAM thông thường, nhưng các chip flash NAND được giao tiếp bằng các đường I/O và điều khiển. Vì vậy, mã nguồn thường trú trên flash NOR có thể được thực thi tại chỗ (execute in place), nhưng mã được lưu trữ trên flash NAND phải được sao chép vào RAM trước khi thực thi.

[1] Hiện tượng xuất hiện các khối bị lỗi (bad blocks) rải rác khắp các vùng flash NAND là điều bình thường, như bạn sẽ tìm hiểu trong phần "Trình điều khiển Chip NAND" (NAND Chip Drivers).
