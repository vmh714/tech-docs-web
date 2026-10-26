# Chương 1. Giới thiệu

| Trong Chương Này           |    |
|-----------------------------|----|
| Sự tiến hóa                 | 2  |
| Giấy phép GNU Copyleft      | 3  |
| Kernel.org                  | 4  |
| Danh sách gửi thư và<br>Diễn đàn | 4  |
| Các bản phân phối Linux      | 5  |
| Khảo sát mã nguồn           | 6  |
| Xây dựng Kernel             | 10 |
| Module có thể nạp           | 12 |
| Trước khi bắt đầu           | 14 |

Linux có sức hút mãnh liệt. Nó mang hương vị hấp dẫn của một dự án quốc tế, nơi mọi người từ mọi quốc gia, tín ngưỡng và giới tính cùng nhau cộng tác. Việc mã nguồn được cung cấp hoàn toàn miễn phí cùng với môi trường lập trình ứng dụng (Application Programming Environment) kiểu UNIX quen thuộc đã góp phần mang lại thành công vang dội cho hệ điều hành này. Sự hỗ trợ chất lượng cao từ các chuyên gia luôn sẵn có tức thì qua Internet hoàn toàn miễn phí cũng đóng vai trò to lớn trong việc kết nối một cộng đồng Linux khổng lồ.

Các lập trình viên vô cùng hào hứng khi được làm việc trên các công nghệ mà họ có quyền truy cập vào toàn bộ mã nguồn, bởi điều đó cho phép họ tạo ra các giải pháp đột phá. Ví dụ, bạn có thể chỉnh sửa (`hack`) mã nguồn và tùy chỉnh Linux để khởi động chỉ trong vài giây trên thiết bị của mình—một thành tựu rất khó đạt được với một hệ điều hành độc quyền (proprietary operating system).

## Sự tiến hóa

Linux khởi đầu như một sở thích cá nhân của một sinh viên đại học người Phần Lan tên là Linus Torvalds vào năm 1991, nhưng đã nhanh chóng biến đổi thành một hệ điều hành tiên tiến phổ biến trên toàn cầu. Kể từ bản phát hành đầu tiên dành cho bộ vi xử lý Intel 386, nhân (kernel) đã dần phát triển về độ phức tạp để hỗ trợ vô số kiến trúc (architecture), phần cứng đa xử lý (multiprocessor hardware) và các cụm máy hiệu năng cao (high-performance cluster). Danh sách đầy đủ các CPU được hỗ trợ rất dài, nhưng một số kiến trúc chính bao gồm x86, IA64, ARM, PowerPC, Alpha, s390, MIPS và SPARC. Linux đã được port (chuyển đổi nền tảng) sang hàng trăm nền tảng phần cứng được xây dựng dựa trên các bộ vi xử lý này. Kernel không ngừng được cải thiện và quá trình tiến hóa đang diễn ra với tốc độ chóng mặt.

Mặc dù bắt đầu cuộc sống như một hệ điều hành dành cho máy tính để bàn (desktop operating system), Linux đã thâm nhập sâu vào thế giới hệ thống nhúng (embedded) và doanh nghiệp (enterprise), đồng thời chạm đến cuộc sống hàng ngày của chúng ta. Khi bạn bấm các nút trên thiết bị cầm tay, chuyển kênh điều khiển từ xa sang kênh dự báo thời tiết, hoặc đến bệnh viện để kiểm tra sức khỏe tổng quát, ngày càng có nhiều khả năng một đoạn mã Linux nào đó đang được kích hoạt để phục vụ bạn. Việc Linux hoàn toàn miễn phí đang thúc đẩy quá trình tiến hóa của nó không kém gì tính ưu việt về mặt kỹ thuật. Cho dù đó là sáng kiến phát triển máy tính dưới 100 USD nhằm giúp đỡ những người nghèo trên thế giới, hay áp lực về giá cả trong lĩnh vực điện tử tiêu dùng, Linux hiện là hệ điều hành được lựa chọn hàng đầu, bởi các hệ điều hành độc quyền đôi khi có chi phí cao hơn cả mức giá mong muốn của chính chiếc máy tính đó.
