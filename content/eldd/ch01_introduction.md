# Chương 1: Giới thiệu (Introduction)

| Trong chương này | Trang |
|-------------------|-------|
| Quá trình phát triển | 2 |
| Giấy phép GNU Copyleft | 3 |
| Kernel.org | 4 |
| Mailing list và Diễn đàn | 4 |
| Các bản phân phối Linux | 5 |
| Khám phá mã nguồn | 6 |
| Biên dịch Kernel | 10 |
| Module có thể nạp (Loadable Modules) | 12 |
| Trước khi bắt đầu | 14 |

Linux sở hữu một sức hút đặc biệt. Nó mang không khí đầy cuốn hút của một dự án mang tầm quốc tế, nơi mọi người thuộc mọi quốc tịch, tín ngưỡng và giới tính cùng nhau hợp tác. Việc mã nguồn được cung cấp hoàn toàn miễn phí cùng một môi trường lập trình ứng dụng kiểu UNIX dễ hiểu, quen thuộc đã góp phần tạo nên thành công vang dội của hệ điều hành này. Mạng lưới hỗ trợ chất lượng cao từ các chuyên gia luôn sẵn sàng tức thì qua Internet hoàn toàn miễn phí cũng đóng vai trò then chốt trong việc gắn kết một cộng đồng Linux khổng lồ.

Các nhà phát triển luôn cực kỳ hào hứng khi được làm việc trên những công nghệ mà họ có toàn quyền truy cập mã nguồn, bởi điều đó cho phép họ sáng tạo nên các giải pháp đột phá. Chẳng hạn, bạn có thể can thiệp (`hack`) mã nguồn và tùy chỉnh Linux để thiết bị khởi động chỉ trong vài giây—một thành tựu rất khó đạt được đối với một hệ điều hành thương mại đóng (proprietary operating system).

## Quá trình phát triển

Linux khởi đầu như một sở thích cá nhân của một sinh viên đại học người Phần Lan tên là Linus Torvalds vào năm 1991, nhưng đã nhanh chóng chuyển mình thành một hệ điều hành tiên tiến phổ biến trên toàn cầu. Kể từ bản phát hành đầu tiên dành cho bộ vi xử lý Intel 386, nhân (kernel) đã dần phát triển về độ phức tạp để hỗ trợ vô số kiến trúc phần cứng, hệ thống đa xử lý (multiprocessor hardware) và các cụm máy tính hiệu năng cao (high-performance cluster). Danh sách đầy đủ các CPU được hỗ trợ rất dài, nhưng một số kiến trúc chính bao gồm x86, IA64, ARM, PowerPC, Alpha, s390, MIPS và SPARC. Linux đã được port (chuyển đổi nền tảng) sang hàng trăm nền tảng phần cứng phát triển dựa trên các bộ vi xử lý này. Kernel không ngừng được hoàn thiện và quá trình phát triển này đang diễn ra với tốc độ chóng mặt.

Mặc dù ban đầu là một hệ điều hành dành cho máy tính để bàn (desktop operating system), Linux đã thâm nhập sâu vào thế giới hệ thống nhúng (embedded) lẫn doanh nghiệp (enterprise) và hiện diện trong cuộc sống hàng ngày của chúng ta. Khi bạn thao tác trên thiết bị cầm tay, bấm điều khiển chuyển sang kênh dự báo thời tiết, hay đến bệnh viện kiểm tra sức khỏe tổng quát, nhiều khả năng một đoạn mã Linux nào đó đang được kích hoạt để phục vụ bạn. Việc Linux được phát hành miễn phí đã thúc đẩy quá trình phát triển của nó không kém gì sự vượt trội về mặt kỹ thuật. Cho dù đó là sáng kiến phát triển máy tính có giá dưới 100 USD dành cho người nghèo trên thế giới hay áp lực về giá thành trong lĩnh vực điện tử tiêu dùng, Linux hiện là hệ điều hành được lựa chọn hàng đầu, bởi chi phí bản quyền của các hệ điều hành đóng đôi khi còn cao hơn cả mức giá mong muốn của chính chiếc máy tính đó.
