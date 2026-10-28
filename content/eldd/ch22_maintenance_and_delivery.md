# Chương 22: Bảo trì và Phân phối (Maintenance and Delivery)

| Trong Chương này | |
|---|---|
| Quy chuẩn Viết mã | 642 |
| Ký hiệu Thay đổi | 642 |
| Quản lý Phiên bản | 643 |
| Mã kiểm tra (Checksum) Nhất quán | 643 |
| Kịch bản Biên dịch | 645 |
| Mã nguồn Khả chuyển | 647 |

Bạn đã đi đến cuối hành trình khám phá trình điều khiển thiết bị (device driver), nhưng việc triển khai một driver chỉ là một phần trong vòng đời phát triển phần mềm (software development life cycle). Trước khi kết thúc, chúng ta hãy cùng thảo luận về một số ý tưởng góp phần nâng cao hiệu quả vận hành trong quá trình bảo trì và bàn giao phần mềm.

## Quy chuẩn Viết mã

Vòng đời của nhiều thiết bị Linux kéo dài từ 5 đến 10 năm, do đó việc tuân thủ một quy chuẩn viết mã (coding style) chuẩn mực sẽ giúp việc hỗ trợ sản phẩm thuận lợi về lâu dài, ngay cả sau khi bạn đã chuyển sang dự án khác.

Một trình soạn thảo mạnh mẽ kết hợp với phong cách trình bày mã nguồn có tổ chức sẽ giúp chuyển hóa tư duy thành mã nguồn một cách dễ dàng hơn. Không thể có một tập hướng dẫn hoàn hảo tuyệt đối cho một quy chuẩn viết mã tốt vì đó là vấn đề sở thích cá nhân; tuy nhiên, một quy cách lập trình đồng nhất lại có giá trị vô giá khi có nhiều nhà phát triển cùng làm việc trong một dự án.

Hãy thống nhất các tiêu chuẩn lập trình chung với các thành viên trong nhóm và khách hàng trước khi bắt đầu dự án. Quy chuẩn viết mã được các nhà phát triển Linux kernel ưa chuộng được mô tả chi tiết tại `Documentation/CodingStyle` nằm trong cây mã nguồn (source tree).
