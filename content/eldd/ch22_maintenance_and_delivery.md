# Chương 22. Bảo trì và Bàn giao

| Trong Chương này      |     |
|----------------------|-----|
| Phong cách Lập trình   | 642 |
| Đánh dấu Thay đổi     | 642 |
| Quản lý Phiên bản    | 643 |
| Tổng kiểm Tra Nhất quán | 643 |
| Kịch bản Xây dựng     | 645 |
| Mã nguồn Di động      | 647 |
|                      |     |

Bạn đã đi đến cuối hành trình khám phá trình điều khiển thiết bị (device driver), nhưng việc hiện thực hóa một driver chỉ là một phần trong vòng đời phát triển phần mềm (software development life cycle). Trước khi kết thúc, chúng ta hãy thảo luận về một vài ý tưởng góp phần nâng cao hiệu quả vận hành trong quá trình bảo trì và bàn giao phần mềm.

## Phong cách Lập trình

Vòng đời của nhiều thiết bị Linux kéo dài từ 5 đến 10 năm, vì vậy việc tuân thủ một phong cách lập trình chuẩn mực sẽ giúp hỗ trợ sản phẩm lâu dài ngay cả sau khi bạn đã rời khỏi dự án.

Một trình soạn thảo mạnh mẽ kết hợp với phong cách viết có tổ chức giúp việc liên kết giữa mã nguồn và tư duy trở nên dễ dàng hơn. Không thể có những hướng dẫn hoàn hảo tuyệt đối cho một phong cách tốt vì đó là vấn đề sở thích cá nhân, nhưng một cách thức lập trình đồng nhất là vô giá nếu có nhiều nhà phát triển cùng làm việc trên một dự án.

Hãy thống nhất các tiêu chuẩn lập trình chung với các thành viên trong nhóm và khách hàng trước khi bắt đầu dự án. Phong cách lập trình được ưa chuộng bởi các nhà phát triển nhân hệ điều hành (kernel developer) được mô tả trong tệp *Documentation/CodingStyle* nằm trong cây mã nguồn (source tree).
