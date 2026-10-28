# Chương 17: Thiết bị công nghệ bộ nhớ (Memory Technology Devices)

| Trong chương này | Trang |
|------------------|-------|
| Bộ nhớ Flash là gì? | 504 |
| Hệ thống con Linux-MTD | 505 |
| Trình điều khiển Ánh xạ (Map Drivers) | 506 |
| Trình điều khiển Chip NOR | 511 |
| Trình điều khiển Chip NAND | 513 |
| Các Mô-đun Người dùng (User Modules) | 516 |
| MTD-Utils | 518 |
| Cấu hình MTD | 519 |
| Thực thi tại chỗ (eXecute In Place) | 520 |
| Trung tâm Chương trình cơ sở (Firmware Hub) | 520 |
| Gỡ lỗi (Debugging) | 524 |
| Tìm hiểu Mã nguồn (Looking at the Sources) | 524 |

Khi bạn nhấn công tắc nguồn trên một thiết bị cầm tay, rất có thể nó sẽ khởi động từ bộ nhớ flash. Khi bạn thao tác lưu dữ liệu trên điện thoại di động, gần như chắc chắn dữ liệu của bạn được khởi tạo đầu tiên trên bộ nhớ flash. Ngày nay, Linux đã thâm nhập sâu vào lĩnh vực nhúng (embedded space) và không còn chỉ giới hạn ở máy tính để bàn hay máy chủ. Các dạng hiện thân của Linux xuất hiện trong PDA, máy nghe nhạc, hộp giải mã tín hiệu (set-top box), và cả các thiết bị y tế chuyên dụng. Hệ thống con *Memory Technology Devices* (MTD) của kernel chịu trách nhiệm đóng vai trò giao tiếp giữa hệ thống của bạn với nhiều chủng loại bộ nhớ flash khác nhau trên các thiết bị này. Trong chương này, chúng ta sẽ thông qua ví dụ về một thiết bị cầm tay chạy Linux để tìm hiểu về MTD.

## Bộ nhớ Flash là gì?

*Bộ nhớ flash* (Flash memory) là loại bộ nhớ lưu trữ có thể ghi lại (rewritable) và không cần nguồn điện liên tục để duy trì dữ liệu. Các bank bộ nhớ flash (flash memory banks) thường được tổ chức thành các *sector*. Khác với các thiết bị lưu trữ truyền thống, thao tác ghi vào các địa chỉ flash bắt buộc phải được tiến hành sau một thao tác xóa (erase) các vị trí tương ứng trước đó. Hơn nữa, thao tác xóa các phần dữ liệu trên flash chỉ có thể thực hiện theo độ mịn chi tiết (granularity) của từng sector riêng lẻ. Do những hạn chế đặc thù này, bộ nhớ flash hoạt động tốt nhất khi đi kèm với các trình điều khiển thiết bị (device drivers) và hệ thống tập tin (filesystems) được thiết kế tối ưu riêng cho chúng. Trên Linux, các trình điều khiển và hệ thống tập tin chuyên dụng này do hệ thống con MTD đảm nhiệm cung cấp.

Chip nhớ flash thường bao gồm hai loại chính: NOR và NAND. *NOR* là loại được sử dụng để lưu trữ các ảnh firmware (firmware images) trên thiết bị nhúng; trong khi *NAND* được dùng cho các nhu cầu lưu trữ dung lượng lớn, mật độ cao, giá thành rẻ nhưng cho phép có tỷ lệ lỗi vật lý nhất định[1], đáp ứng các phương tiện lưu trữ khối dạng bán dẫn (solid-state mass storage media) như ổ USB flash hay *Disk-On-Module* (DOM). Các chip flash NOR kết nối trực tiếp với bộ xử lý thông qua các đường địa chỉ và đường dữ liệu tương tự như RAM thông thường, nhưng chip flash NAND lại giao tiếp thông qua các đường I/O và đường điều khiển. Do đó, mã lệnh nằm trên flash NOR có thể được thực thi tại chỗ (*eXecute In Place - XIP*), còn mã lệnh lưu trên flash NAND bắt buộc phải được chép vào RAM trước khi thực thi.

---
[1] Việc xuất hiện các khối bị lỗi (bad blocks) rải rác trên các vùng flash NAND là điều hoàn toàn bình thường, như bạn sẽ tìm hiểu trong phần "Trình điều khiển Chip NAND".
