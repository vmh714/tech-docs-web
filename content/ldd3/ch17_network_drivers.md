# Chương 17: Driver mạng (Network Drivers)

Sau khi đã thảo luận về trình điều khiển ký tự (char driver) và trình điều khiển khối (block driver), giờ đây chúng ta đã sẵn sàng bước sang thế giới mạng. Giao diện mạng (network interface) là lớp tiêu chuẩn thứ ba của các thiết bị Linux, và chương này mô tả cách chúng tương tác với phần còn lại của kernel.

Vai trò của một giao diện mạng trong hệ thống tương tự như một thiết bị khối (block device) đã được gắn kết (mounted). Một thiết bị khối đăng ký các đĩa và phương thức của nó với kernel, sau đó "truyền" (transmit) và "nhận" (receive) các khối theo yêu cầu, thông qua hàm *request* của nó. Tương tự, một giao diện mạng phải tự đăng ký trong các cấu trúc dữ liệu cụ thể của kernel để được gọi khi các gói tin (packet) được trao đổi với thế giới bên ngoài.

Có một vài điểm khác biệt quan trọng giữa các đĩa được gắn kết và các giao diện truyền gói tin. Trước hết, một đĩa tồn tại như một tệp đặc biệt trong thư mục */dev*, trong khi giao diện mạng không có điểm nhập (entry point) như vậy. Các thao tác tệp thông thường (đọc, ghi, v.v.) không có ý nghĩa khi áp dụng cho các giao diện mạng, do đó không thể áp dụng cách tiếp cận "mọi thứ là một tệp" (everything is a file) của Unix cho chúng. Do đó, các giao diện mạng tồn tại trong không gian tên (namespace) của riêng chúng và xuất ra một tập hợp các thao tác khác nhau.

Mặc dù bạn có thể phản đối rằng các ứng dụng sử dụng các system call (lời hệ thống) *read* và *write* khi sử dụng socket, các lệnh gọi đó tác động lên một đối tượng phần mềm tách biệt với giao diện. Hàng trăm socket có thể được ghép kênh (multiplex) trên cùng một giao diện vật lý.

Nhưng sự khác biệt quan trọng nhất giữa hai loại này là các trình điều khiển khối (block driver) chỉ hoạt động để đáp ứng các yêu cầu từ kernel, trong khi các trình điều khiển mạng (network driver) nhận các gói tin một cách bất đồng bộ (asynchronously) từ bên ngoài. Do đó, trong khi một block driver được *yêu cầu* (asked) gửi một bộ đệm (buffer) hướng về kernel, thì thiết bị mạng lại *yêu cầu* (asks) đẩy các gói tin đến hướng về kernel. Giao diện kernel dành cho network driver được thiết kế cho chế độ hoạt động khác biệt này.

Các network driver cũng phải sẵn sàng hỗ trợ một số tác vụ quản trị, chẳng hạn như thiết lập địa chỉ, sửa đổi các tham số truyền dẫn, và duy trì các thống kê về lưu lượng và lỗi. API cho các network driver phản ánh nhu cầu này và do đó, trông có vẻ khác biệt đôi chút so với các giao diện chúng ta đã thấy cho đến nay.

Hệ thống con mạng (network subsystem) của kernel Linux được thiết kế để hoàn toàn độc lập với giao thức (protocol-independent). Điều này áp dụng cho cả giao thức mạng (giao thức Internet [IP] so với IPX hoặc các giao thức khác) và giao thức phần cứng (Ethernet so với token ring, v.v.). Sự tương tác giữa một network driver và kernel xử lý gọn gàng từng gói tin mạng một; điều này cho phép các vấn đề về giao thức được ẩn đi một cách gọn gàng khỏi trình điều khiển và việc truyền dẫn vật lý được ẩn đi khỏi giao thức.

Chương này mô tả cách các giao diện mạng hòa nhập với phần còn lại của kernel Linux và cung cấp các ví dụ dưới dạng một giao diện mạng mô-đun dựa trên bộ nhớ (memory-based modularized network interface), có tên là (bạn đoán đúng rồi đấy) *snull*. Để đơn giản hóa thảo luận, giao diện này sử dụng giao thức phần cứng Ethernet và truyền các gói tin IP. Kiến thức bạn thu được từ việc kiểm tra *snull* có thể được áp dụng dễ dàng cho các giao thức khác ngoài IP, và việc viết một trình điều khiển không phải Ethernet chỉ khác biệt ở những chi tiết rất nhỏ liên quan đến giao thức mạng thực tế.

Chương này không bàn về các sơ đồ đánh số IP, giao thức mạng, hoặc các khái niệm mạng chung khác. Các chủ đề như vậy (thường) không liên quan đến người viết trình điều khiển, và không thể cung cấp một cái nhìn tổng quan thỏa đáng về công nghệ mạng chỉ trong vòng chưa đầy vài trăm trang. Bạn đọc quan tâm được khuyến khích tham khảo các sách khác mô tả các vấn đề về mạng.

Một lưu ý về thuật ngữ là cần thiết trước khi đi sâu vào các thiết bị mạng. Thế giới mạng sử dụng thuật ngữ *octet* để chỉ một nhóm gồm tám bit, thường là đơn vị nhỏ nhất mà các thiết bị và giao thức mạng hiểu được. Thuật ngữ byte hầu như không bao giờ gặp phải trong bối cảnh này. Để duy trì tính nhất quán với cách sử dụng tiêu chuẩn, chúng ta sẽ sử dụng octet khi nói về các thiết bị mạng.

Thuật ngữ "header" (tiêu đề) cũng đáng được nhắc đến nhanh chóng. Header là một tập hợp các byte (à nhầm, octet) được gắn vào phía trước của một gói tin khi nó đi qua các lớp khác nhau của hệ thống con mạng. Khi một ứng dụng gửi một khối dữ liệu qua một TCP socket, hệ thống con mạng sẽ chia dữ liệu đó thành các gói tin và đặt một TCP header (mô tả vị trí của mỗi gói tin khớp trong luồng) vào phần đầu. Các lớp thấp hơn sau đó đặt một IP header (được sử dụng để định tuyến gói tin đến đích của nó) ở phía trước TCP header. Nếu gói tin di chuyển qua một môi trường giống Ethernet, một Ethernet header (được phần cứng thông dịch) sẽ đi vào phía trước phần còn lại. Các network driver không cần phải bận tâm đến các header cấp cao hơn (thường là vậy), nhưng chúng thường phải tham gia vào việc tạo ra header cấp phần cứng.

## Cách snull được thiết kế

Phần này thảo luận về các khái niệm thiết kế đã dẫn đến giao diện mạng *snull*. Mặc dù thông tin này có vẻ ít có giá trị sử dụng, nhưng việc không hiểu nó có thể dẫn đến các vấn đề khi bạn thử nghiệm với mã nguồn mẫu.

Quyết định thiết kế đầu tiên và quan trọng nhất là các giao diện mẫu (sample interface) phải độc lập với phần cứng thực tế, giống như phần lớn mã nguồn mẫu được sử dụng trong cuốn sách này. Ràng buộc này dẫn đến một thiết kế tương tự như giao diện loopback (loopback interface). *snull* không phải là một giao diện loopback; tuy nhiên, nó mô phỏng các cuộc trao đổi với các thiết bị đầu xa thực tế (real remote host) nhằm minh họa rõ hơn cho tác vụ viết một trình điều khiển mạng (network driver). Trình điều khiển loopback của Linux thực ra khá đơn giản; nó có thể được tìm thấy tại *drivers/net/loopback.c*.

Một tính năng khác của *snull* là nó chỉ hỗ trợ lưu lượng IP (IP traffic). Đây là hệ quả từ hoạt động bên trong của giao diện—*snull* phải kiểm tra bên trong và giải mã các gói tin (packet) để mô phỏng chính xác một cặp giao diện phần cứng. Các giao diện thực tế không phụ thuộc vào giao thức đang được truyền tải, và hạn chế này của *snull* không ảnh hưởng gì đến các đoạn mã được trình bày trong chương này.

## Gán Địa chỉ IP (Assigning IP Numbers)

Mô-đun *snull* tạo ra hai giao diện. Các giao diện này khác với một giao diện loopback đơn giản ở điểm: bất cứ thứ gì bạn truyền qua một giao diện sẽ vòng ngược (loop back) về giao diện kia chứ không phải chính nó. Có vẻ như bạn đang có hai liên kết ngoài (external link), nhưng thực ra máy tính của bạn đang tự phản hồi chính nó.

Đáng tiếc là hiệu ứng này không thể đạt được chỉ bằng việc gán các số IP (IP number), bởi vì kernel sẽ không gửi một gói tin qua giao diện A nếu gói tin đó hướng đến chính giao diện B của nó. Thay vào đó, nó sẽ sử dụng kênh loopback mà không đi qua *snull*. Để có thể thiết lập giao tiếp thông qua các giao diện *snull*, địa chỉ nguồn (source address) và địa chỉ đích (destination address) cần phải được sửa đổi trong quá trình truyền dữ liệu. Nói cách khác, các gói tin được gửi qua một giao diện phải được nhận bởi giao diện kia, nhưng bên nhận gói tin đi (outgoing packet) không được nhận diện là host cục bộ (local host). Điều tương tự cũng áp dụng cho địa chỉ nguồn của các gói tin nhận được.

Để đạt được loại "loopback ẩn" này, giao diện *snull* sẽ đảo trạng thái bit ít quan trọng nhất (least significant bit) của octet thứ ba trên cả địa chỉ nguồn và địa chỉ đích; nghĩa là, nó thay đổi cả số mạng (network number) và số host (host number) của các địa chỉ IP lớp C (class C IP). Hiệu ứng tổng thể là các gói tin gửi đến mạng A (được kết nối với sn0, giao diện đầu tiên) sẽ xuất hiện trên giao diện sn1 dưới dạng các gói tin thuộc về mạng B.

Để tránh việc phải xử lý quá nhiều con số, chúng ta hãy gán các tên tượng trưng cho các địa chỉ IP liên quan:

- snullnet0 là mạng được kết nối với giao diện sn0. Tương tự, snullnet1 là mạng được kết nối với sn1. Địa chỉ của các mạng này chỉ nên khác nhau ở bit ít quan trọng nhất của octet thứ ba. Các mạng này phải có mặt nạ mạng (netmask) 24-bit.
- local0 là địa chỉ IP được gán cho giao diện sn0; nó thuộc về snullnet0. Địa chỉ liên kết với sn1 là local1. local0 và local1 phải khác nhau ở bit ít quan trọng nhất của octet thứ ba và ở octet thứ tư.
- remote0 là một host trong snullnet0, và octet thứ tư của nó giống với octet thứ tư của local1. Bất kỳ gói tin nào được gửi tới remote0 sẽ đến được local1 sau khi địa chỉ mạng của nó đã bị thay đổi bởi mã nguồn của giao diện. Host remote1 thuộc về snullnet1, và octet thứ tư của nó giống với octet thứ tư của local0.

Hoạt động của các giao diện *snull* được minh họa trong Hình 17-1, trong đó tên host liên kết với mỗi giao diện được in gần tên giao diện đó.

```
                         +----------------------+
                         |       snullnet0      |
                         |       remote         |
                         |        (PC)          |
                         +----------+-----------+
                                    ^
                                    |
                                    |
                              sn0 (local0)
                                    |
                                    |
        +---------------------------+---------------------------+
        |                                                       |
        |                       HOST                            |
        |                                                       |
        |  lo  (localhost) ----> loopback                       |
        |                                                       |
        |  eth0 (morgana) ----> localnet                        |
        |                                                       |
        |  sn0 (local0) ----> snullnet0                         |
        |                                                       |
        |  sn1 (local1) ----> snullnet1                         |
        |                                                       |
        +---------------------------+---------------------------+
                                    |
                                    |
                              sn1 (local1)
                                    |
                                    v
                         +----------------------+
                         |       snullnet1      |
                         |       remote         |
                         |        (PC)          |
                         +----------------------+

localnet
   |
   +----> eth0 (morgana)

loopback
   |
   +----> lo (localhost)
```

*Hình 17-1. Cách một host nhìn nhận các giao diện (interface) của nó*

Dưới đây là các giá trị khả dĩ cho các số hiệu mạng (network number). Một khi bạn đưa các dòng này vào tệp */etc/networks*, bạn có thể gọi các mạng của mình bằng tên. Các giá trị này được chọn từ dải số được dành riêng cho mục đích sử dụng nội bộ (private use).

snullnet0 192.168.0.0 snullnet1 192.168.1.0

Sau đây là các số hiệu host (host number) khả dĩ để đưa vào */etc/hosts*:

192.168.0.1 local0 192.168.0.2 remote0 192.168.1.2 local1 192.168.1.1 remote1

Đặc điểm quan trọng của các số này là phần host của `local0` giống với phần host của `remote1`, và phần host của `local1` giống với phần host của `remote0`. Bạn có thể sử dụng các số hoàn toàn khác miễn là mối quan hệ này được giữ nguyên.

Tuy nhiên, hãy cẩn thận nếu máy tính của bạn đã được kết nối với một mạng. Các số bạn chọn có thể là số Internet hoặc intranet thực tế, và việc gán chúng cho các giao diện (interface) của bạn sẽ ngăn cản việc giao tiếp với các host thực sự. Ví dụ, mặc dù

các số vừa hiển thị không phải là số Internet có thể định tuyến (routable), chúng có thể đã được sử dụng bởi mạng riêng của bạn.

Dù bạn chọn số nào đi nữa, bạn có thể thiết lập chính xác các giao diện để hoạt động bằng cách thực thi các lệnh sau:

```
ifconfig sn0 local0
ifconfig sn1 local1
```

Bạn có thể cần thêm tham số `netmask 255.255.255.0` nếu dải địa chỉ đã chọn không phải là dải class C.

Tại thời điểm này, đầu "remote" của giao diện có thể được truy cập. Đoạn ghi màn hình (screendump) sau cho thấy cách một host truy cập `remote0` và `remote1` thông qua giao diện *snull*:

```
morgana% ping -c 2 remote0
64 bytes from 192.168.0.99: icmp_seq=0 ttl=64 time=1.6 ms
64 bytes from 192.168.0.99: icmp_seq=1 ttl=64 time=0.9 ms
2 packets transmitted, 2 packets received, 0% packet loss
morgana% ping -c 2 remote1
64 bytes from 192.168.1.88: icmp_seq=0 ttl=64 time=1.8 ms
64 bytes from 192.168.1.88: icmp_seq=1 ttl=64 time=0.9 ms
2 packets transmitted, 2 packets received, 0% packet loss
```

Lưu ý rằng bạn sẽ không thể truy cập bất kỳ "host" nào khác thuộc về hai mạng này, bởi vì các gói tin (packet) bị máy tính của bạn hủy (discard) sau khi địa chỉ đã được sửa đổi và gói tin đã được nhận. Ví dụ, một gói tin nhắm tới địa chỉ `192.168.0.32` sẽ rời đi thông qua `sn0` và xuất hiện trở lại tại `sn1` với địa chỉ đích là `192.168.1.32`, đây không phải là địa chỉ cục bộ (local address) cho máy tính host.

## Quá trình vận chuyển vật lý của các gói tin (The Physical Transport of Packets)

Liên quan đến việc vận chuyển dữ liệu, các giao diện *snull* thuộc về lớp Ethernet (Ethernet class).

*snull* mô phỏng (emulate) Ethernet bởi vì phần lớn các mạng hiện có — ít nhất là các phân đoạn (segment) mà một máy trạm (workstation) kết nối tới — đều dựa trên công nghệ Ethernet, có thể là 10base-T, 100base-T hoặc Gigabit. Thêm vào đó, kernel cung cấp một số hỗ trợ tổng quát cho các thiết bị Ethernet và không có lý do gì để không sử dụng nó. Lợi thế của việc trở nên giống một thiết bị Ethernet lớn đến mức ngay cả giao diện *plip* (giao diện sử dụng cổng máy in) cũng tự khai báo nó là một thiết bị Ethernet.

Lợi ích cuối cùng của việc sử dụng thiết lập Ethernet cho *snull* là bạn có thể chạy *tcpdump* trên giao diện để quan sát các gói tin đi qua. Theo dõi các giao diện bằng *tcpdump* có thể là một cách hữu ích để xem hai giao diện hoạt động như thế nào.

Như đã đề cập trước đó, *snull* chỉ hoạt động với các gói tin IP. Hạn chế này là hệ quả từ việc *snull* "ngửi" (snoop) các gói tin và thậm chí sửa đổi chúng để mã nguồn có thể hoạt động. Mã nguồn sẽ sửa đổi địa chỉ nguồn (source), địa chỉ đích (destination) và mã kiểm tra (checksum) trong phần IP header của mỗi gói tin mà không cần kiểm tra xem nó có thực sự mang thông tin IP hay không.

Việc sửa đổi dữ liệu nhanh-và-ẩu (quick-and-dirty) này sẽ phá hủy các gói tin không phải IP. Nếu bạn muốn truyền các giao thức khác thông qua *snull*, bạn phải sửa đổi mã nguồn của module.

## Kết nối với Kernel (Connecting to the Kernel)

Chúng ta bắt đầu xem xét cấu trúc của các trình điều khiển mạng (network driver) bằng cách mổ xẻ mã nguồn của *snull*. Việc giữ sẵn mã nguồn cho một số driver có thể giúp bạn theo dõi phần thảo luận và xem các driver mạng Linux trong thế giới thực hoạt động như thế nào. Như một điểm khởi đầu, chúng tôi đề xuất các tệp *loopback.c*, *plip.c* và *e100.c*, theo thứ tự độ phức tạp tăng dần. Tất cả các tệp này nằm trong thư mục *drivers/net*, bên trong cây mã nguồn kernel (kernel source tree).

## Đăng ký thiết bị (Device Registration)

Khi một module driver được tải vào một kernel đang chạy, nó yêu cầu tài nguyên và cung cấp các tiện ích; không có gì mới mẻ trong chuyện đó. Và cũng không có gì mới trong cách các tài nguyên được yêu cầu. Driver nên dò tìm (probe) thiết bị của nó và vị trí phần cứng của nó (cổng I/O và đường IRQ) — nhưng không đăng ký chúng — như được mô tả trong phần "Cài đặt một trình xử lý ngắt" (Installing an Interrupt Handler) ở Chương 10. Cách mà một network driver được đăng ký bởi hàm khởi tạo module của nó thì khác biệt so với các driver ký tự (char driver) và driver khối (block driver). Vì không có khái niệm tương đương với số hiệu chính và số hiệu phụ (major and minor number) cho các giao diện mạng, một network driver không yêu cầu số hiệu như vậy. Thay vào đó, driver sẽ chèn một cấu trúc dữ liệu cho mỗi giao diện mới được phát hiện vào một danh sách toàn cục (global list) các thiết bị mạng.

Mỗi giao diện (interface) được mô tả bởi một mục `struct net_device`, được định nghĩa trong *<linux/netdevice.h>*. Driver *snull* lưu giữ các con trỏ đến hai cấu trúc trong số này (cho sn0 và sn1) trong một mảng đơn giản:

```
struct net_device *snull_devs[2];
```

Cấu trúc `net_device`, giống như nhiều cấu trúc kernel khác, chứa một `kobject` và do đó, được quản lý tham chiếu (reference-counted) và xuất ra thông qua `sysfs`. Giống như các cấu trúc tương tự khác, nó phải được cấp phát động (dynamically allocated). Hàm kernel được cung cấp để thực hiện việc cấp phát này là `alloc_netdev`, có nguyên mẫu (prototype) như sau:

```
struct net_device *alloc_netdev(int sizeof_priv,
 const char *name,
 void (*setup)(struct net_device *));
```

Ở đây, `sizeof_priv` là kích thước của vùng "dữ liệu riêng" (private data) của driver; với các thiết bị mạng, vùng đó được cấp phát cùng với cấu trúc `net_device`. Trên thực tế, cả hai được cấp phát cùng nhau trong một khối bộ nhớ lớn, nhưng các tác giả viết driver nên giả vờ như họ không biết điều đó. `name` là tên của giao diện này, như được nhìn thấy bởi không gian người dùng (user space); tên này có thể chứa định dạng %d theo phong cách của *printf*. Kernel sẽ thay thế %d bằng số thứ tự giao diện khả dụng tiếp theo. Cuối cùng, `setup` là một con trỏ đến một hàm khởi tạo (initialization function) được gọi để thiết lập phần còn lại của cấu trúc `net_device`. Chúng ta sẽ bàn về hàm khởi tạo này

ngay sau đây, nhưng hiện tại, chỉ cần nói rằng *snull* cấp phát hai cấu trúc thiết bị của nó theo cách này:

```
snull_devs[0] = alloc_netdev(sizeof(struct snull_priv), "sn%d",
 snull_init);
snull_devs[1] = alloc_netdev(sizeof(struct snull_priv), "sn%d",
 snull_init);
if (snull_devs[0] == NULL || snull_devs[1] == NULL)
 goto out;
```

Như thường lệ, chúng ta phải kiểm tra giá trị trả về để đảm bảo rằng việc cấp phát đã thành công.

Hệ thống con mạng (networking subsystem) cung cấp một số hàm trợ giúp (helper functions) được bọc quanh `alloc_netdev` cho các loại giao diện khác nhau. Phổ biến nhất là `alloc_etherdev`, được định nghĩa trong *<linux/etherdevice.h>*:

```
struct net_device *alloc_etherdev(int sizeof_priv);
```

Hàm này cấp phát một thiết bị mạng sử dụng `eth%d` cho tham số `name`. Nó cung cấp hàm khởi tạo của riêng mình (`ether_setup`) để thiết lập một số trường (field) của `net_device` với các giá trị thích hợp cho các thiết bị Ethernet. Do đó, không có hàm khởi tạo do driver cung cấp cho `alloc_etherdev`; driver chỉ cần thực hiện việc khởi tạo cần thiết ngay sau một lần cấp phát thành công. Những người viết driver cho các loại thiết bị khác có thể muốn tận dụng một trong các hàm trợ giúp khác, chẳng hạn như `alloc_fcdev` (được định nghĩa trong *<linux/fcdevice.h>*) cho các thiết bị kênh quang (fiber-channel), `alloc_fddidev` (*<linux/fddidevice.h>*) cho các thiết bị FDDI, hoặc `alloc_trdev` (*<linux/trdevice.h>*) cho các thiết bị token ring.

*snull* có thể sử dụng `alloc_etherdev` mà không gặp vấn đề gì; chúng ta chọn sử dụng `alloc_netdev` thay thế, như một cách để minh họa giao diện cấp thấp hơn (lower-level interface) và cho phép chúng ta kiểm soát tên được gán cho giao diện.

Một khi cấu trúc `net_device` đã được khởi tạo, việc hoàn tất quá trình chỉ đơn giản là truyền cấu trúc đó cho `register_netdev`. Trong *snull*, lời gọi có dạng như sau:

```
for (i = 0; i < 2; i++)
 if ((result = register_netdev(snull_devs[i])))
 printk("snull: error %i registering device \"%s\"\n",
 result, snull_devs[i]->name);
```

Các lưu ý thông thường được áp dụng ở đây: ngay khi bạn gọi `register_netdev`, driver của bạn có thể được gọi để vận hành trên thiết bị. Do đó, bạn không nên đăng ký thiết bị cho đến khi mọi thứ đã được khởi tạo hoàn toàn.

## Khởi tạo từng thiết bị (Initializing Each Device)

Chúng ta đã xem xét việc cấp phát và đăng ký các cấu trúc `net_device`, nhưng chúng ta đã bỏ qua bước trung gian là khởi tạo hoàn toàn cấu trúc đó. Lưu ý rằng `struct net_device` luôn được tạo ra tại thời điểm chạy (runtime); nó không thể được thiết lập tại thời điểm biên dịch (compile time) theo cách giống như cấu trúc `file_operations` hoặc `block_device_operations`. Việc khởi tạo này phải được hoàn tất trước khi gọi `register_netdev`. Cấu trúc `net_device`

rất lớn và phức tạp; may mắn thay, kernel sẽ xử lý một số giá trị mặc định chung cho Ethernet thông qua hàm `ether_setup` (được gọi bởi `alloc_etherdev`).

Vì *snull* sử dụng `alloc_netdev`, nó có một hàm khởi tạo riêng. Phần cốt lõi của hàm này (`snull_init`) như sau:

```
ether_setup(dev); /* gán một số trường */
dev->open = snull_open;
dev->stop = snull_release;
dev->set_config = snull_config;
dev->hard_start_xmit = snull_tx;
dev->do_ioctl = snull_ioctl;
dev->get_stats = snull_stats;
dev->rebuild_header = snull_rebuild_header;
dev->hard_header = snull_header;
dev->tx_timeout = snull_tx_timeout;
dev->watchdog_timeo = timeout;
/* giữ các cờ mặc định, chỉ thêm NOARP */
dev->flags |= IFF_NOARP;
dev->features |= NETIF_F_NO_CSUM;
dev->hard_header_cache = NULL; /* Vô hiệu hóa caching */
```

Đoạn mã trên là một quá trình khởi tạo khá thông thường của cấu trúc `net_device`; chủ yếu là việc lưu trữ các con trỏ đến các hàm driver khác nhau của chúng ta. Tính năng duy nhất bất thường của mã là thiết lập `IFF_NOARP` trong các cờ (flags). Điều này chỉ định rằng giao diện không thể sử dụng Giao thức Phân giải Địa chỉ (Address Resolution Protocol - ARP). ARP là một giao thức Ethernet cấp thấp; công việc của nó là biến đổi các địa chỉ IP thành các địa chỉ điều khiển truy cập môi trường (media access control - MAC) của Ethernet. Vì các hệ thống "từ xa" được mô phỏng bởi *snull* thực sự không tồn tại, nên không có ai ở đó để trả lời các yêu cầu ARP cho chúng. Thay vì làm phức tạp *snull* bằng việc bổ sung thêm một cài đặt ARP, chúng tôi chọn đánh dấu giao diện là không có khả năng xử lý giao thức đó. Việc gán giá trị cho `hard_header_cache` cũng vì một lý do tương tự: nó vô hiệu hóa việc lưu đệm (caching) các phản hồi ARP (vốn không tồn tại) trên giao diện này. Chủ đề này được thảo luận chi tiết trong phần "Phân giải địa chỉ MAC" (MAC Address Resolution) sau trong chương này.

Mã nguồn khởi tạo cũng thiết lập một vài trường (`tx_timeout` và `watchdog_timeo`) liên quan đến việc xử lý thời gian chờ truyền (transmission timeout). Chúng ta sẽ đề cập kỹ lưỡng đến chủ đề này trong phần "Transmission Timeouts" (Thời gian chờ truyền).

Bây giờ chúng ta sẽ xem xét thêm một trường nữa của `struct net_device`, đó là `priv`. Vai trò của nó tương tự như con trỏ `private_data` mà chúng ta đã sử dụng cho các char driver (trình điều khiển thiết bị ký tự). Khác với `fops->private_data`, con trỏ `priv` này được cấp phát cùng với cấu trúc `net_device`. Việc truy cập trực tiếp vào trường `priv` cũng không được khuyến khích vì lý do hiệu năng (performance) và tính linh hoạt (flexibility). Khi một driver cần truy cập vào con trỏ dữ liệu riêng tư (private data pointer), nó nên sử dụng hàm `netdev_priv`. Do đó, driver *snull* chứa đầy các khai báo như:

```
struct snull_priv *priv = netdev_priv(dev);
```

Module *snull* khai báo một cấu trúc dữ liệu `snull_priv` được sử dụng cho `priv`:

```
struct snull_priv {
 struct net_device_stats stats;
 int status;
 struct snull_packet *ppool;
 struct snull_packet *rx_queue; /* Danh sách các gói tin đến */
 int rx_int_enabled;
 int tx_packetlen;
 u8 *tx_packetdata;
 struct sk_buff *skb;
 spinlock_t lock;
};
```

Cấu trúc này bao gồm, ngoài các thành phần khác, một thể hiện (instance) của `struct net_device_stats`, đây là nơi tiêu chuẩn để lưu trữ các thống kê về giao diện (interface statistics). Các dòng sau trong `snull_init` thực hiện cấp phát và khởi tạo `dev->priv`:

```
priv = netdev_priv(dev);
memset(priv, 0, sizeof(struct snull_priv));
spin_lock_init(&priv->lock);
snull_rx_ints(dev, 1); /* bật ngắt nhận (receive interrupts) */
```

## Gỡ bỏ Module (Module Unloading)

Không có điều gì đặc biệt xảy ra khi module được gỡ bỏ (unload). Hàm dọn dẹp module (module cleanup function) đơn giản là hủy đăng ký (unregister) các giao diện, thực hiện bất kỳ công việc dọn dẹp nội bộ nào cần thiết, và trả lại cấu trúc `net_device` cho hệ thống:

```
void snull_cleanup(void)
{
 int i;
 for (i = 0; i < 2; i++) {
 if (snull_devs[i]) {
 unregister_netdev(snull_devs[i]);
 snull_teardown_pool(snull_devs[i]);
 free_netdev(snull_devs[i]);
 }
 }
 return;
}
```

Lời gọi hàm `unregister_netdev` sẽ loại bỏ giao diện khỏi hệ thống; `free_netdev` trả lại cấu trúc `net_device` cho kernel. Nếu một tham chiếu (reference) đến cấu trúc đó vẫn tồn tại ở đâu đó, nó có thể tiếp tục tồn tại, nhưng driver của bạn không cần bận tâm về điều đó. Một khi bạn đã hủy đăng ký giao diện, kernel sẽ không còn gọi các phương thức (methods) của nó nữa.

Lưu ý rằng quá trình dọn dẹp nội bộ của chúng ta (được thực hiện trong `snull_teardown_pool`) không thể diễn ra cho đến khi thiết bị đã được hủy đăng ký. Tuy nhiên, nó phải xảy ra trước khi chúng ta trả lại cấu trúc `net_device` cho hệ thống; một khi chúng ta đã gọi `free_netdev`, chúng ta không thể thực hiện thêm bất kỳ tham chiếu nào đến thiết bị hoặc vùng nhớ riêng tư (private area) của mình nữa.

**Kết nối với Kernel | 505**

## Cấu trúc net_device Chi tiết (The net_device Structure in Detail)

Cấu trúc `net_device` nằm ở cốt lõi của tầng network driver (trình điều khiển mạng) và xứng đáng có một mô tả đầy đủ. Danh sách này mô tả tất cả các trường, nhưng mang tính chất tham khảo hơn là bắt buộc phải ghi nhớ. Phần còn lại của chương này sẽ mô tả ngắn gọn từng trường ngay khi nó được sử dụng trong mã nguồn mẫu, vì vậy bạn không cần phải liên tục quay lại phần này.

## Thông tin Toàn cục (Global Information)

Phần đầu tiên của `struct net_device` bao gồm các trường sau:

```
char name[IFNAMSIZ];
```

Tên của thiết bị. Nếu tên do driver thiết lập chứa chuỗi định dạng `%d`, `register_netdev` sẽ thay thế nó bằng một số để tạo ra một tên duy nhất; các số được gán bắt đầu từ 0.

```
unsigned long state;
```

Trạng thái thiết bị (Device state). Trường này bao gồm một số cờ (flags). Các driver thông thường không thao tác trực tiếp với các cờ này; thay vào đó, một tập hợp các hàm tiện ích đã được cung cấp. Các hàm này sẽ được thảo luận ngay khi chúng ta đi vào các hoạt động của driver.

```
struct net_device *next;
```

Con trỏ trỏ đến thiết bị tiếp theo trong danh sách liên kết toàn cục (global linked list). Trường này không nên bị tác động bởi driver.

```
int (*init)(struct net_device *dev);
```

Một hàm khởi tạo (initialization function). Nếu con trỏ này được thiết lập, hàm sẽ được gọi bởi `register_netdev` để hoàn tất việc khởi tạo cấu trúc `net_device`. Hầu hết các network driver hiện đại không còn sử dụng hàm này nữa; thay vào đó, việc khởi tạo được thực hiện trước khi đăng ký giao diện.

## Thông tin Phần cứng (Hardware Information)

Các trường sau chứa thông tin phần cứng mức thấp (low-level hardware information) cho các thiết bị tương đối đơn giản. Chúng là di tích từ những ngày đầu của hệ thống mạng Linux; hầu hết các driver hiện đại đều sử dụng chúng (với ngoại lệ có thể là `if_port`). Chúng tôi liệt kê chúng ở đây để tính đầy đủ của tài liệu.

```
unsigned long rmem_end;
unsigned long rmem_start;
unsigned long mem_end;
unsigned long mem_start;
```

Thông tin bộ nhớ thiết bị (Device memory information). Các trường này chứa địa chỉ bắt đầu và kết thúc của vùng nhớ chia sẻ (shared memory) được sử dụng bởi thiết bị. Nếu thiết bị có các vùng nhớ nhận và truyền khác nhau, các trường `mem` được sử dụng cho bộ nhớ truyền và các trường `rmem` được sử dụng cho bộ nhớ nhận. Các trường `rmem` không bao giờ được tham chiếu bên ngoài

chính driver đó. Theo quy ước, các trường `end` được thiết lập sao cho `end - start` chính là dung lượng bộ nhớ trên bo mạch (onboard memory) có sẵn.

#### unsigned long base\_addr;

Địa chỉ cơ sở I/O (I/O base address) của giao diện mạng (network interface). Trường này, giống như các trường trước đó, được gán bởi trình điều khiển (driver) trong quá trình dò tìm thiết bị (device probe). Lệnh *ifconfig* có thể được sử dụng để hiển thị hoặc sửa đổi giá trị hiện tại. base\_addr có thể được gán một cách tường minh trên dòng lệnh kernel (kernel command line) khi khởi động hệ thống (thông qua tham số netdev=) hoặc tại thời điểm tải mô-đun (module load time). Trường này, giống như các trường bộ nhớ được mô tả ở trên, không được sử dụng bởi kernel.

#### unsigned char irq;

Số ngắt (interrupt number) được gán. Giá trị của dev->irq được in ra bởi *ifconfig* khi liệt kê các giao diện. Giá trị này thường có thể được thiết lập lúc khởi động hoặc lúc tải mô-đun và được sửa đổi sau đó bằng cách sử dụng *ifconfig*.

#### unsigned char if\_port;

Cổng đang được sử dụng trên các thiết bị đa cổng (multiport devices). Trường này được sử dụng, ví dụ, với các thiết bị hỗ trợ cả kết nối Ethernet cáp đồng trục (coaxial - IF\_PORT\_10BASE2) và cáp xoắn đôi (twisted-pair - IF\_PORT\_100BASET). Tập hợp đầy đủ các loại cổng được hỗ trợ được định nghĩa trong *<linux/netdevice.h>*.

#### unsigned char dma;

Kênh DMA được cấp phát bởi thiết bị. Trường này chỉ có ý nghĩa với một số bus ngoại vi (peripheral buses), chẳng hạn như ISA. Nó không được sử dụng bên ngoài trình điều khiển thiết bị (device driver) ngoại trừ mục đích cung cấp thông tin (trong lệnh *ifconfig*).

## Thông tin Giao diện (Interface Information)

Hầu hết thông tin về giao diện được thiết lập chính xác bởi hàm *ether\_setup* (hoặc bất kỳ hàm thiết lập nào khác phù hợp với loại phần cứng cụ thể). Các card Ethernet có thể dựa vào hàm đa dụng (general-purpose function) này cho phần lớn các trường này, nhưng các trường flags và dev\_addr là đặc trưng cho thiết bị (device specific) và phải được gán một cách tường minh tại thời điểm khởi tạo (initialization time).

Một số giao diện không phải Ethernet có thể sử dụng các hàm trợ giúp (helper functions) tương tự như *ether\_setup*. *drivers/net/net\_init.c* xuất ra (export) một số hàm như vậy, bao gồm các hàm sau:

```c
void ltalk_setup(struct net_device *dev);
```

Thiết lập các trường cho thiết bị LocalTalk

void fc\_setup(struct net\_device \*dev);

Khởi tạo các trường cho thiết bị kênh quang (fiber-channel devices)

void fddi\_setup(struct net\_device \*dev);

Cấu hình giao diện cho mạng Giao diện Dữ liệu Phân tán Quang học (Fiber Distributed Data Interface - FDDI)

void hippi\_setup(struct net\_device \*dev);

Chuẩn bị các trường cho trình điều khiển kết nối tốc độ cao Giao diện Song song Hiệu năng Cao (High-Performance Parallel Interface - HIPPI)

void tr\_setup(struct net\_device \*dev);

Xử lý việc thiết lập cho các giao diện mạng vòng thẻ bài (token ring)

Hầu hết các thiết bị đều nằm trong các lớp (classes) này. Tuy nhiên, nếu thiết bị của bạn hoàn toàn mới và khác biệt, bạn cần phải tự gán các trường sau bằng tay:

unsigned short hard\_header\_len;

Độ dài tiêu đề phần cứng (hardware header length), nghĩa là số lượng octet đi trước gói tin được truyền (transmitted packet) trước tiêu đề IP hoặc thông tin giao thức khác. Giá trị của hard\_header\_len là 14 (ETH\_HLEN) đối với các giao diện Ethernet.

unsigned mtu;

Đơn vị truyền dữ liệu tối đa (Maximum Transmission Unit - MTU). Trường này được sử dụng bởi tầng mạng (network layer) để điều khiển việc truyền gói tin. Ethernet có MTU là 1500 octet (ETH\_DATA\_LEN). Giá trị này có thể được thay đổi bằng lệnh *ifconfig*.

unsigned long tx\_queue\_len;

Số lượng khung (frames) tối đa có thể được xếp hàng đợi trên hàng đợi truyền (transmission queue) của thiết bị. Giá trị này được đặt là 1000 bởi *ether\_setup*, nhưng bạn có thể thay đổi nó. Ví dụ, *plip* sử dụng 10 để tránh lãng phí bộ nhớ hệ thống (*plip* có thông lượng thấp hơn so với giao diện Ethernet thực tế).

unsigned short type;

Loại phần cứng của giao diện. Trường type được sử dụng bởi ARP để xác định loại địa chỉ phần cứng mà giao diện hỗ trợ. Giá trị thích hợp cho các giao diện Ethernet là ARPHRD\_ETHER, và đó là giá trị được thiết lập bởi *ether\_setup*. Các loại được nhận diện được định nghĩa trong *<linux/if\_arp.h>*.

unsigned char addr\_len; unsigned char broadcast[MAX\_ADDR\_LEN]; unsigned char dev\_addr[MAX\_ADDR\_LEN];

Độ dài địa chỉ phần cứng (MAC) và địa chỉ phần cứng của thiết bị. Độ dài địa chỉ Ethernet là sáu octet (chúng ta đang đề cập đến ID phần cứng của bo mạch giao diện), và địa chỉ quảng bá (broadcast address) được cấu tạo từ sáu octet 0xff; *ether\_setup* đảm bảo các giá trị này là chính xác. Mặt khác, địa chỉ thiết bị phải được đọc từ bo mạch giao diện theo cách đặc thù của thiết bị, và trình điều khiển nên sao chép nó vào dev\_addr. Địa chỉ phần cứng được sử dụng để tạo ra các tiêu đề Ethernet chính xác trước khi gói tin được chuyển cho trình điều khiển để truyền đi. Thiết bị *snull* không sử dụng giao diện vật lý và nó tự tạo ra địa chỉ phần cứng cho riêng mình.

unsigned short flags;

int features;

Các cờ giao diện (Interface flags - được chi tiết ở phần tiếp theo).

Trường flags là một mặt nạ bit (bit mask) bao gồm các giá trị bit sau. Tiền tố IFF\_ viết tắt cho "interface flags" (cờ giao diện). Một số cờ được quản lý bởi kernel, và một số cờ được thiết lập bởi giao diện tại thời điểm khởi tạo để khẳng định các khả năng và tính năng khác nhau của giao diện. Các cờ hợp lệ, được định nghĩa trong *<linux/if.h>*, bao gồm:

#### IFF\_UP

Cờ này là chỉ đọc (read-only) đối với trình điều khiển. Kernel bật cờ này khi giao diện hoạt động và sẵn sàng truyền gói tin.

#### IFF\_BROADCAST

Cờ này (được quản lý bởi mã nguồn mạng - networking code) cho biết giao diện (interface) cho phép phát quảng bá (broadcasting). Các bo mạch Ethernet đều hỗ trợ tính năng này.

#### IFF\_DEBUG

Cờ này đánh dấu chế độ gỡ lỗi (debug mode). Cờ này có thể được sử dụng để kiểm soát mức độ chi tiết (verbosity) của các lời gọi hàm *printk* hoặc cho các mục đích gỡ lỗi khác. Mặc dù hiện tại không có trình điều khiển (driver) nào trong cây mã nguồn (in-tree driver) sử dụng cờ này, nó có thể được thiết lập và xóa bởi các chương trình người dùng (user programs) thông qua *ioctl*, và driver của bạn có thể sử dụng nó. Chương trình *misc-progs/netifdebug* có thể được dùng để bật và tắt cờ này.

#### IFF\_LOOPBACK

Cờ này chỉ nên được thiết lập trên giao diện loopback. Nhân hệ điều hành (kernel) kiểm tra IFF\_LOOPBACK thay vì cố định (hardwiring) tên `lo` như một giao diện đặc biệt.

#### IFF\_POINTOPOINT

Cờ này báo hiệu rằng giao diện được kết nối với một liên kết điểm-điểm (point-to-point link). Nó được thiết lập bởi driver hoặc, đôi khi, bởi *ifconfig*. Ví dụ, *plip* và driver PPP có thiết lập cờ này.

#### IFF\_NOARP

Điều này có nghĩa là giao diện không thể thực hiện ARP. Ví dụ, các giao diện điểm-điểm không cần chạy ARP, vì việc đó chỉ tạo thêm lưu lượng (traffic) không cần thiết mà không thu thập được thông tin hữu ích nào. *snull* chạy mà không có khả năng ARP, do đó nó thiết lập cờ này.

#### IFF\_PROMISC

Cờ này được thiết lập (bởi mã nguồn mạng) để kích hoạt chế độ hỗn tạp (promiscuous operation). Theo mặc định, các giao diện Ethernet sử dụng một bộ lọc phần cứng (hardware filter) để đảm bảo rằng chúng chỉ nhận các gói tin quảng bá (broadcast packets) và các gói tin hướng đến địa chỉ phần cứng của giao diện đó. Các chương trình bắt gói tin (packet sniffers) như *tcpdump* sẽ bật chế độ hỗn tạp trên giao diện nhằm thu thập tất cả các gói tin di chuyển trên môi trường truyền dẫn (transmission medium) của giao diện đó.

#### IFF\_MULTICAST

Cờ này được thiết lập bởi các driver để đánh dấu các giao diện có khả năng truyền đa hướng (multicast transmission). *ether\_setup* thiết lập IFF\_MULTICAST theo mặc định, do đó nếu driver của bạn không hỗ trợ multicast, nó phải xóa cờ này tại thời điểm khởi tạo (initialization time).

#### IFF\_ALLMULTI

Cờ này báo cho giao diện biết để nhận tất cả các gói tin multicast. Nhân hệ điều hành thiết lập nó khi máy chủ (host) thực hiện định tuyến multicast (multicast routing), và chỉ khi IFF\_MULTICAST được thiết lập. IFF\_ALLMULTI là

chỉ đọc (read-only) đối với driver. Các cờ multicast được sử dụng trong phần "Multicast," ở phần sau của chương này.

#### IFF\_MASTER

#### IFF\_SLAVE

Các cờ này được sử dụng bởi mã nguồn cân bằng tải (load equalization code). Driver của giao diện không cần phải quan tâm đến chúng.

#### IFF\_PORTSEL

#### IFF\_AUTOMEDIA

Các cờ này báo hiệu rằng thiết bị có khả năng chuyển đổi giữa nhiều loại phương truyền dẫn (media types); ví dụ: cáp đôi xoắn không chống nhiễu (UTP) so với cáp đồng trục Ethernet. Nếu IFF\_AUTOMEDIA được thiết lập, thiết bị sẽ tự động chọn phương truyền dẫn phù hợp. Trên thực tế, kernel không sử dụng cờ nào trong hai cờ này.

#### IFF\_DYNAMIC

Cờ này, được thiết lập bởi driver, biểu thị rằng địa chỉ của giao diện này có thể thay đổi. Hiện tại nó không được sử dụng bởi kernel.

#### IFF\_RUNNING

Cờ này chỉ ra rằng giao diện đang hoạt động (up and running). Nó chủ yếu tồn tại để tương thích với BSD; kernel ít khi sử dụng nó. Hầu hết các driver mạng không cần phải bận tâm về IFF\_RUNNING.

#### IFF\_NOTRAILERS

Cờ này không được sử dụng trong Linux, nhưng nó vẫn tồn tại để tương thích với BSD.

Khi một chương trình thay đổi trạng thái IFF\_UP, phương thức thiết bị (device method) *open* hoặc *stop* sẽ được gọi. Hơn nữa, khi IFF\_UP hoặc bất kỳ cờ nào khác được sửa đổi, phương thức *set\_multicast\_list* sẽ được gọi. Nếu driver cần thực hiện một số hành động để phản hồi lại việc sửa đổi các cờ, nó phải thực hiện hành động đó trong *set\_multicast\_list*. Ví dụ, khi IFF\_PROMISC được bật hoặc tắt, *set\_multicast\_list* phải thông báo cho bộ lọc phần cứng trên bo mạch (onboard hardware filter). Trách nhiệm của phương thức thiết bị này được nêu rõ trong phần "Multicast."

Trường `features` của cấu trúc `net_device` được thiết lập bởi driver để thông báo cho kernel về bất kỳ khả năng phần cứng đặc biệt nào mà giao diện này có. Chúng ta sẽ thảo luận về một số tính năng này; các tính năng khác nằm ngoài phạm vi của cuốn sách này. Tập hợp đầy đủ bao gồm:

#### NETIF\_F\_SG

#### NETIF\_F\_FRAGLIST

Cả hai cờ này đều kiểm soát việc sử dụng I/O phân tán/tập trung (scatter/gather I/O). Nếu giao diện của bạn có thể truyền một gói tin đã bị chia tách thành nhiều phân đoạn bộ nhớ (memory segments) riêng biệt, bạn nên thiết lập NETIF\_F\_SG. Tất nhiên, bạn phải thực tế triển khai scatter/gather I/O (chúng tôi mô tả cách thực hiện việc đó trong phần "Scatter/Gather I/O"). NETIF\_F\_FRAGLIST nêu rõ rằng giao diện của bạn có thể xử lý các gói tin đã bị phân mảnh (fragmented); chỉ có driver loopback thực hiện điều này trong phiên bản 2.6.

Lưu ý rằng kernel không thực hiện scatter/gather I/O tới thiết bị của bạn nếu thiết bị đó đồng thời không cung cấp một số hình thức tính tổng kiểm tra (checksumming). Lý do là nếu

kernel phải duyệt qua một gói tin bị phân mảnh ("phi tuyến tính" - nonlinear) để tính toán checksum, thì nó hoàn toàn có thể sao chép dữ liệu và gom nhóm (coalesce) gói tin đó lại cùng một lúc.

NETIF\_F\_IP\_CSUM NETIF\_F\_NO\_CSUM NETIF\_F\_HW\_CSUM

> [!NOTE]
> Những cờ này đều là các cách thông báo cho kernel rằng nó không cần áp dụng checksum cho một số hoặc tất cả các gói tin rời khỏi hệ thống qua giao diện này. Hãy thiết lập NETIF\_F\_IP\_CSUM nếu giao diện của bạn có thể tính checksum cho các gói tin IP nhưng không áp dụng cho các gói tin khác. Nếu không bao giờ cần checksum cho giao diện này, hãy thiết lập NETIF\_F\_NO\_CSUM. Driver loopback thiết lập cờ này, và *snull* cũng vậy; vì các gói tin chỉ được truyền tải qua bộ nhớ hệ thống, (hy vọng rằng) không có cơ hội nào để chúng bị hỏng (corrupted), và do đó không cần phải kiểm tra chúng. Nếu phần cứng của bạn tự thực hiện việc tính checksum, hãy thiết lập NETIF\_F\_HW\_CSUM.

NETIF\_F\_HIGHDMA

Đặt cờ (flag) này nếu thiết bị của bạn có thể thực hiện DMA (Direct Memory Access) tới bộ nhớ cao (high memory). Nếu không có cờ này, tất cả các bộ đệm gói tin (packet buffer) được cung cấp cho trình điều khiển (driver) của bạn đều được cấp phát trong bộ nhớ thấp (low memory).

NETIF\_F\_HW\_VLAN\_TX NETIF\_F\_HW\_VLAN\_RX NETIF\_F\_HW\_VLAN\_FILTER NETIF\_F\_VLAN\_CHALLENGED

> [!NOTE]
> Các tùy chọn này mô tả khả năng hỗ trợ gói tin 802.1q VLAN của phần cứng. Việc hỗ trợ VLAN nằm ngoài phạm vi có thể đề cập trong chương này. Nếu các gói tin VLAN làm thiết bị của bạn gặp sự cố (thực tế thì không nên như vậy), hãy đặt cờ `NETIF_F_VLAN_CHALLENGED`.

NETIF\_F\_TSO

Đặt cờ này nếu thiết bị của bạn có thể thực hiện giảm tải phân đoạn TCP (TCP segmentation offloading). TSO là một tính năng nâng cao mà chúng ta không đề cập ở đây.

## Các Phương thức của Thiết bị (Device Methods)

Giống như các trình điều khiển ký tự (char driver) và khối (block driver), mỗi thiết bị mạng khai báo các hàm hoạt động trên nó. Các thao tác có thể được thực hiện trên giao diện mạng (network interface) được liệt kê trong phần này. Một số thao tác có thể được để trống (`NULL`), và các thao tác khác thường không cần chạm đến vì *ether\_setup* đã gán các phương thức phù hợp cho chúng.

Các phương thức thiết bị cho giao diện mạng có thể được chia thành hai nhóm: cơ bản (fundamental) và tùy chọn (optional). Các phương thức cơ bản bao gồm những phương thức cần thiết để có thể sử dụng giao diện; các phương thức tùy chọn triển khai các tính năng nâng cao hơn không bắt buộc phải có. Dưới đây là các phương thức cơ bản:

int (\*open)(struct net\_device \*dev);

Mở giao diện. Giao diện được mở bất cứ khi nào lệnh *ifconfig* kích hoạt nó. Phương thức *open* nên đăng ký bất kỳ tài nguyên hệ thống nào mà nó cần (cổng I/O, IRQ, DMA, v.v.), bật phần cứng và thực hiện bất kỳ thiết lập nào khác mà thiết bị của bạn yêu cầu.

- int (\*stop)(struct net\_device \*dev); Dừng giao diện. Giao diện bị dừng khi nó bị hạ xuống (brought down). Hàm này nên đảo ngược các thao tác đã thực hiện tại thời điểm mở.
- int (\*hard\_start\_xmit) (struct sk\_buff \*skb, struct net\_device \*dev); Phương thức khởi tạo việc truyền một gói tin. Toàn bộ gói tin (tiêu đề giao thức và mọi thứ khác) được chứa trong một cấu trúc bộ đệm socket (`sk_buff`). Bộ đệm socket (socket buffer) sẽ được giới thiệu sau trong chương này.
- int (\*hard\_header) (struct sk\_buff \*skb, struct net\_device \*dev, unsigned short type, void \*daddr, void \*saddr, unsigned len); Hàm (được gọi trước *hard\_start\_xmit*) xây dựng tiêu đề phần cứng (hardware header) từ các địa chỉ phần cứng nguồn và đích đã được truy xuất trước đó; công việc của nó là tổ chức thông tin được truyền tới như các đối thành một tiêu đề phần cứng thích hợp, đặc thù cho thiết bị. *eth\_header* là hàm mặc định cho các giao diện kiểu Ethernet, và *ether\_setup* gán trường này cho phù hợp.
- int (\*rebuild\_header)(struct sk\_buff \*skb); Hàm được sử dụng để xây dựng lại tiêu đề phần cứng sau khi quá trình phân giải ARP (ARP resolution) hoàn tất nhưng trước khi gói tin được truyền đi. Hàm mặc định được sử dụng bởi các thiết bị Ethernet tận dụng mã hỗ trợ ARP để điền thông tin còn thiếu vào gói tin.
- void (\*tx\_timeout)(struct net\_device \*dev); Phương thức được gọi bởi mã mạng khi việc truyền gói tin không hoàn thành trong một khoảng thời gian hợp lý, với giả định rằng một ngắt (interrupt) đã bị bỏ lỡ hoặc giao diện đã bị treo (locked up). Nó nên xử lý vấn đề và tiếp tục truyền gói tin.
- struct net\_device\_stats \*(\*get\_stats)(struct net\_device \*dev); Bất cứ khi nào một ứng dụng cần lấy thống kê cho giao diện, phương thức này sẽ được gọi. Điều này xảy ra, ví dụ, khi *ifconfig* hoặc *netstat -i* được chạy. Một ví dụ triển khai cho *snull* được giới thiệu trong phần "Thông tin Thống kê" (Statistical Information).
- int (\*set\_config)(struct net\_device \*dev, struct ifmap \*map); Thay đổi cấu hình giao diện. Phương thức này là điểm vào (entry point) để cấu hình trình điều khiển. Địa chỉ I/O cho thiết bị và số ngắt của nó có thể được thay đổi tại thời điểm chạy (runtime) bằng cách sử dụng *set\_config*. Khả năng này có thể được sử dụng bởi quản trị viên hệ thống nếu giao diện không thể dò tìm (probe) được. Các trình điều khiển cho phần cứng hiện đại thông thường không cần phải triển khai phương thức này.

Các thao tác thiết bị còn lại là tùy chọn:

int weight;

int (\*poll)(struct net\_device \*dev; int \*quota);

Phương thức được cung cấp bởi các trình điều khiển tuân thủ NAPI để vận hành giao diện ở chế độ bỏ phiếu (polled mode), với các ngắt bị vô hiệu hóa. NAPI (và trường weight) được đề cập trong phần "Giảm thiểu Ngắt Nhận" (Receive Interrupt Mitigation).

void (\*poll\_controller)(struct net\_device \*dev);

Hàm yêu cầu trình điều khiển kiểm tra các sự kiện trên giao diện trong các tình huống mà ngắt bị vô hiệu hóa. Nó được sử dụng cho các tác vụ mạng cụ thể trong kernel (in-kernel), chẳng hạn như console từ xa và gỡ lỗi kernel qua mạng.

int (\*do\_ioctl)(struct net\_device \*dev, struct ifreq \*ifr, int cmd); Thực hiện các lệnh *ioctl* đặc thù cho giao diện. (Việc triển khai các lệnh đó được mô tả trong phần "Các lệnh ioctl Tùy chỉnh" - Custom ioctl Commands). Trường tương ứng trong `struct net_device` có thể được để là `NULL` nếu giao diện không cần bất kỳ lệnh đặc thù nào.

```c
void (*set_multicast_list)(struct net_device *dev);
```

Phương thức (Method) được gọi khi danh sách multicast (multicast list) của thiết bị thay đổi và khi các cờ (flags) thay đổi. Xem phần "Multicast" để biết thêm chi tiết và một bản cài đặt mẫu.

```c
int (*set_mac_address)(struct net_device *dev, void *addr);
```

Hàm có thể được triển khai nếu giao diện (interface) hỗ trợ khả năng thay đổi địa chỉ phần cứng (hardware address) của nó. Nhiều giao diện hoàn toàn không hỗ trợ tính năng này. Số khác sử dụng cài đặt mặc định *eth_mac_addr* (từ *drivers/net/net_init.c*). *eth_mac_addr* chỉ sao chép địa chỉ mới vào `dev->dev_addr`, và chỉ thực hiện điều đó nếu giao diện không đang chạy (not running). Các trình điều khiển (drivers) sử dụng *eth_mac_addr* nên thiết lập địa chỉ MAC phần cứng từ `dev->dev_addr` trong phương thức *open* của chúng.

```c
int (*change_mtu)(struct net_device *dev, int new_mtu);
```

Hàm thực hiện hành động nếu có sự thay đổi trong đơn vị truyền dữ liệu tối đa (Maximum Transmission Unit - MTU) cho giao diện. Nếu driver cần thực hiện bất kỳ thao tác cụ thể nào khi MTU bị thay đổi bởi người dùng, nó nên khai báo hàm của riêng mình; nếu không, hàm mặc định sẽ thực hiện công việc chính xác. *snull* có một mẫu cho hàm này nếu bạn quan tâm.

```c
int (*header_cache) (struct neighbour *neigh, struct hh_cache *hh);
```

*header_cache* được gọi để điền vào cấu trúc `hh_cache` với kết quả của một truy vấn ARP (ARP query). Hầu hết mọi driver giống Ethernet (Ethernet-like drivers) đều có thể sử dụng cài đặt mặc định *eth_header_cache*.

```c
int (*header_cache_update) (struct hh_cache *hh, struct net_device *dev, unsigned char *haddr);
```

Phương thức cập nhật địa chỉ đích (destination address) trong cấu trúc `hh_cache` để phản hồi lại một sự thay đổi. Các thiết bị Ethernet sử dụng *eth_header_cache_update*.

```c
int (*hard_header_parse) (struct sk_buff *skb, unsigned char *haddr);
```

Phương thức *hard_header_parse* trích xuất địa chỉ nguồn (source address) từ gói tin (packet) được chứa trong `skb`, sao chép nó vào vùng đệm (buffer) tại `haddr`. Giá trị trả về từ hàm là độ dài của địa chỉ đó. Các thiết bị Ethernet thông thường sử dụng *eth_header_parse*.

## Các Trường Tiện ích (Utility Fields)

Các trường dữ liệu còn lại của `struct net_device` được sử dụng bởi giao diện để lưu giữ thông tin trạng thái hữu ích. Một số trường được sử dụng bởi *ifconfig* và *netstat* để cung cấp cho người dùng thông tin về cấu hình hiện tại. Do đó, một giao diện nên gán giá trị cho các trường sau:

```c
unsigned long trans_start;
unsigned long last_rx;
```

Các trường lưu giữ giá trị jiffies. Driver chịu trách nhiệm cập nhật các giá trị này khi quá trình truyền bắt đầu và khi một gói tin được nhận, tương ứng. Giá trị `trans_start` được sử dụng bởi hệ thống con mạng (networking subsystem) để phát hiện hiện tượng treo bộ phát (transmitter lockups). `last_rx` hiện không được sử dụng, nhưng driver vẫn nên duy trì trường này để sẵn sàng cho việc sử dụng trong tương lai.

```c
int watchdog_timeo;
```

Thời gian tối thiểu (tính bằng jiffies) cần trôi qua trước khi tầng mạng (networking layer) quyết định rằng đã xảy ra quá trình hết thời gian chờ truyền (transmission timeout) và gọi hàm *tx_timeout* của driver.

```c
void *priv;
```

Tương đương với `filp->private_data`. Trong các driver hiện đại, trường này được thiết lập bởi *alloc_netdev* và không được truy cập trực tiếp; thay vào đó hãy sử dụng *netdev_priv*.

```c
struct dev_mc_list *mc_list;
int mc_count;
```

Các trường xử lý việc truyền multicast. `mc_count` là số lượng mục trong `mc_list`. Xem phần "Multicast" để biết thêm chi tiết.

```c
spinlock_t xmit_lock;
int xmit_lock_owner;
```

`xmit_lock` được sử dụng để tránh việc gọi đồng thời nhiều lần vào hàm *hard_start_xmit* của driver. `xmit_lock_owner` là số hiệu của CPU đã chiếm được `xmit_lock`. Driver không nên thực hiện bất kỳ thay đổi nào đối với các trường này.

Có các trường khác trong `struct net_device`, nhưng chúng không được sử dụng bởi các network drivers.

## Mở và Đóng (Opening and Closing)

Driver của chúng ta có thể dò tìm (probe) giao diện tại thời điểm nạp module (module load time) hoặc khi khởi động kernel (kernel boot). Tuy nhiên, trước khi giao diện có thể mang các gói tin, kernel phải mở nó và gán một địa chỉ cho nó. Kernel mở hoặc đóng một giao diện để đáp lại lệnh *ifconfig*.

Khi *ifconfig* được sử dụng để gán một địa chỉ cho giao diện, nó thực hiện hai tác vụ. Đầu tiên, nó gán địa chỉ thông qua `ioctl(SIOCSIFADDR)` (Socket I/O Control Set Interface Address). Sau đó, nó thiết lập cờ `IFF_UP` trong `dev->flag` thông qua `ioctl(SIOCSIFFLAGS)` (Socket I/O Control Set Interface Flags) để bật giao diện lên.

Đối với thiết bị, `ioctl(SIOCSIFADDR)` không làm gì cả. Không có hàm driver nào được gọi—tác vụ này độc lập với thiết bị và kernel tự thực hiện nó. Tuy nhiên, lệnh sau (`ioctl(SIOCSIFFLAGS)`), lại gọi phương thức *open* cho thiết bị.

Tương tự, khi giao diện bị tắt đi (shut down), *ifconfig* sử dụng `ioctl(SIOCSIFFLAGS)` để xóa cờ `IFF_UP`, và phương thức *stop* được gọi.

Cả hai phương thức thiết bị đều trả về 0 trong trường hợp thành công và giá trị âm thông thường trong trường hợp lỗi.

Đối với mã nguồn thực tế, driver phải thực hiện nhiều tác vụ giống như các char driver và block driver thực hiện. *open* yêu cầu bất kỳ tài nguyên hệ thống (system resources) nào nó cần và ra lệnh cho giao diện hoạt động trở lại; *stop* tắt giao diện và giải phóng tài nguyên hệ thống. Tuy nhiên, các network drivers phải thực hiện một số bước bổ sung tại thời điểm *open*.

Đầu tiên, địa chỉ phần cứng (MAC address) cần được sao chép từ thiết bị phần cứng vào `dev->dev_addr` trước khi giao diện (interface) có thể giao tiếp với thế giới bên ngoài. Địa chỉ phần cứng sau đó có thể được sao chép vào thiết bị tại thời điểm mở (open time). Giao diện phần mềm *snull* gán địa chỉ này ngay bên trong hàm *open*; nó chỉ giả lập một số phần cứng bằng cách sử dụng một chuỗi ASCII có độ dài `ETH_ALEN`, độ dài của địa chỉ phần cứng Ethernet.

Phương thức *open* cũng nên khởi động hàng đợi truyền (transmit queue) của giao diện (cho phép nó chấp nhận các gói tin để truyền) ngay khi nó sẵn sàng bắt đầu gửi dữ liệu. Nhân hệ điều hành (kernel) cung cấp một hàm để khởi động hàng đợi:

```
void netif_start_queue(struct net_device *dev);
```

Đoạn mã *open* cho *snull* trông giống như sau:

```
int snull_open(struct net_device *dev)
{
 /* request_region( ), request_irq( ), .... (like fops->open) */
 /*
 * Assign the hardware address of the board: use "\0SNULx", where
 * x is 0 or 1. The first byte is '\0' to avoid being a multicast
 * address (the first byte of multicast addrs is odd).
 */
 memcpy(dev->dev_addr, "\0SNUL0", ETH_ALEN);
 if (dev = = snull_devs[1])
```

```
 dev->dev_addr[ETH_ALEN-1]++; /* \0SNUL1 */
 netif_start_queue(dev);
 return 0;
}
```

Như bạn có thể thấy, khi không có phần cứng thực tế, có rất ít việc phải làm trong phương thức *open*. Điều tương tự cũng đúng với phương thức *stop*; nó chỉ đảo ngược các thao tác của *open*. Vì lý do này, hàm thực hiện *stop* thường được gọi là *close* hoặc *release*.

```
int snull_release(struct net_device *dev)
{
 /* release ports, irq and such -- like fops->close */
 netif_stop_queue(dev); /* can't transmit any more */
 return 0;
}
```

Hàm:

```
void netif_stop_queue(struct net_device *dev);
```

là hàm ngược lại với *netif\_start\_queue*; nó đánh dấu thiết bị là không thể truyền thêm gói tin nào nữa. Hàm này phải được gọi khi giao diện bị đóng (trong phương thức *stop*) nhưng cũng có thể được sử dụng để tạm dừng truyền dữ liệu, như được giải thích trong phần tiếp theo.

## Truyền gói tin (Packet Transmission)

Các tác vụ quan trọng nhất do các giao diện mạng thực hiện là truyền và nhận dữ liệu. Chúng ta bắt đầu với việc truyền dữ liệu vì nó dễ hiểu hơn một chút.

*Truyền dữ liệu (Transmission)* đề cập đến hành động gửi một gói tin qua một liên kết mạng. Bất cứ khi nào nhân hệ điều hành cần truyền một gói dữ liệu, nó sẽ gọi phương thức *hard\_start\_transmit* của trình điều khiển (driver) để đưa dữ liệu vào hàng đợi đi ra (outgoing queue). Mỗi gói tin được xử lý bởi nhân hệ điều hành đều được chứa trong một cấu trúc bộ đệm ổ cắm (struct `sk_buff`), định nghĩa của nó được tìm thấy trong *<linux/skbuff.h>*. Cấu trúc này lấy tên từ sự trừu tượng hóa của Unix được sử dụng để đại diện cho một kết nối mạng, *socket*. Ngay cả khi giao diện không liên quan gì đến socket, mỗi gói tin mạng đều thuộc về một socket ở các tầng mạng cao hơn, và các bộ đệm đầu vào/đầu ra của bất kỳ socket nào cũng là các danh sách cấu trúc struct `sk_buff`. Cấu trúc `sk_buff` giống nhau được sử dụng để lưu trữ dữ liệu mạng xuyên suốt tất cả các hệ subsystem mạng của Linux, nhưng bộ đệm ổ cắm (socket buffer) đối với giao diện thì chỉ đơn thuần là một gói tin.

Con trỏ trỏ tới `sk_buff` thường được gọi là skb, và chúng ta tuân theo thực tiễn này cả trong mã nguồn mẫu lẫn trong văn bản.

Bộ đệm ổ cắm (socket buffer) là một cấu trúc phức tạp và nhân hệ điều hành cung cấp một số hàm để thao tác với nó. Các hàm này được mô tả sau trong phần "Bộ đệm ổ cắm (The Socket Buffers)"; hiện tại, một vài thông tin cơ bản về `sk_buff` là đủ để chúng ta viết một trình điều khiển hoạt động được.

Bộ đệm ổ cắm được truyền tới *hard\_start\_xmit* chứa gói tin vật lý đúng như hình dạng của nó khi xuất hiện trên đường truyền truyền thông (media), hoàn chỉnh với các tiêu đề cấp độ truyền dẫn (transmission-level headers). Giao diện không cần phải chỉnh sửa dữ liệu đang được truyền. `skb->data` trỏ đến gói tin đang được truyền và `skb->len` là chiều dài của nó tính bằng byte (octet). Tình huống này sẽ trở nên phức tạp hơn một chút nếu trình điều khiển của bạn có thể xử lý I/O phân tán/tập trung (scatter/gather I/O); chúng ta sẽ tìm hiểu vấn đề đó trong phần "I/O phân tán/tập trung (Scatter/Gather I/O)".

Mã nguồn truyền gói tin của *snull* tiếp theo đây; cơ chế truyền vật lý đã được tách biệt thành một hàm khác, bởi vì mọi trình điều khiển giao diện đều phải triển khai nó theo phần cứng cụ thể đang được điều khiển:

```
int snull_tx(struct sk_buff *skb, struct net_device *dev)
{
 int len;
 char *data, shortpkt[ETH_ZLEN];
 struct snull_priv *priv = netdev_priv(dev);
 data = skb->data;
 len = skb->len;
 if (len < ETH_ZLEN) {
 memset(shortpkt, 0, ETH_ZLEN);
 memcpy(shortpkt, skb->data, skb->len);
 len = ETH_ZLEN;
 data = shortpkt;
 }
 dev->trans_start = jiffies; /* save the timestamp */
 /* Remember the skb, so we can free it at interrupt time */
 priv->skb = skb;
 /* actual deliver of data is device-specific, and not shown here */
 snull_hw_tx(data, len, dev);
 return 0; /* Our simple device can not fail */
}
```

Do đó, hàm truyền thực hiện một số kiểm tra tính hợp lệ trên gói tin và truyền dữ liệu thông qua hàm liên quan đến phần cứng. Tuy nhiên, xin lưu ý sự cẩn trọng được áp dụng khi gói tin cần truyền ngắn hơn độ dài tối thiểu được hỗ trợ bởi phương tiện truyền thông bên dưới (đối với *snull*, đó là "Ethernet" ảo của chúng ta). Nhiều trình điều khiển mạng Linux (và cả các hệ điều hành khác) đã bị phát hiện là rò rỉ dữ liệu trong các tình huống như vậy. Thay vì tạo ra loại lỗ hổng bảo mật đó, chúng ta sao chép các gói tin ngắn vào một mảng riêng biệt mà chúng ta có thể chủ động đệm số không (zero-pad) ra đến độ dài đầy đủ mà phương tiện truyền thông yêu cầu. (Chúng ta có thể đặt dữ liệu đó một cách an toàn trên stack, vì độ dài tối thiểu — 60 byte — là khá nhỏ).

Giá trị trả về từ *hard_start_xmit* phải là 0 khi thành công; tại thời điểm đó, driver của bạn đã nhận trách nhiệm về gói tin (packet), phải nỗ lực hết sức để đảm bảo việc truyền đi thành công, và bắt buộc phải giải phóng (free) skb ở phần cuối. Giá trị trả về khác 0 biểu thị rằng gói tin không thể được truyền đi tại thời điểm này; kernel sẽ thử lại

**Truyền gói tin | 517**

sau đó. Trong tình huống này, driver của bạn nên dừng hàng đợi (stop the queue) cho đến khi bất kỳ tình huống nào gây ra lỗi đã được giải quyết.

Hàm truyền dữ liệu "liên quan đến phần cứng" (*snull_hw_tx*) được lược bỏ ở đây vì nó hoàn toàn bận rộn với việc triển khai các mánh lới của thiết bị *snull*, bao gồm cả việc thao tác với các địa chỉ nguồn và đích, và có rất ít điều thú vị đối với các lập trình viên viết network driver thực tế. Tất nhiên, nó vẫn có mặt trong mã nguồn mẫu dành cho những ai muốn tìm hiểu sâu hơn và xem nó hoạt động như thế nào.

## Kiểm soát tính đồng thời trong truyền dữ liệu (Transmission Concurrency)

Hàm *hard_start_xmit* được bảo vệ khỏi các lời gọi đồng thời (concurrent calls) bằng một spinlock (`xmit_lock`) nằm trong cấu trúc `net_device`. Tuy nhiên, ngay khi hàm này trả về, nó có thể được gọi lại. Hàm này trả về khi phần mềm đã hoàn tất việc chỉ thị cho phần cứng về việc truyền gói tin, nhưng quá trình truyền ở phần cứng có lẽ vẫn chưa hoàn tất. Đây không phải là vấn đề với *snull*, vì nó thực hiện toàn bộ công việc của mình bằng CPU, do đó quá trình truyền gói tin hoàn tất trước khi hàm truyền trả về.

Mặt khác, các giao diện phần cứng thực tế truyền các gói tin một cách bất đồng bộ (asynchronously) và có một lượng bộ nhớ hữu hạn để lưu trữ các gói tin đi. Khi bộ nhớ đó cạn kiệt (đối với một số phần cứng, điều này xảy ra chỉ với một gói tin đang chờ truyền duy nhất), driver cần thông báo cho hệ thống mạng không bắt đầu bất kỳ đợt truyền nào nữa cho đến khi phần cứng sẵn sàng chấp nhận dữ liệu mới.

Thông báo này được thực hiện bằng cách gọi *netif_stop_queue*, hàm đã được giới thiệu trước đó để dừng hàng đợi. Một khi driver của bạn đã dừng hàng đợi của nó, nó *phải* sắp xếp để khởi động lại hàng đợi vào một thời điểm nào đó trong tương lai, khi nó có thể chấp nhận các gói tin để truyền trở lại. Để làm như vậy, nó nên gọi:

```c
void netif_wake_queue(struct net_device *dev);
```

Hàm này giống hệt như *netif_start_queue*, ngoại trừ việc nó cũng đánh thức (poke) hệ thống mạng để làm cho hệ thống bắt đầu truyền lại các gói tin.

Hầu hết phần cứng mạng hiện đại duy trì một hàng đợi nội bộ chứa nhiều gói tin cần truyền; bằng cách này, nó có thể đạt được hiệu suất tốt nhất từ mạng. Network driver cho các thiết bị này phải hỗ trợ việc có nhiều tiến trình truyền đang chờ xử lý (outstanding) tại bất kỳ thời điểm nào, nhưng bộ nhớ thiết bị có thể bị đầy bất kể phần cứng có hỗ trợ nhiều tiến trình truyền đang chờ hay không. Bất cứ khi nào bộ nhớ thiết bị đầy đến mức không còn chỗ cho gói tin lớn nhất có thể, driver nên dừng hàng đợi cho đến khi có lại không gian trống.

Nếu bạn bắt buộc phải vô hiệu hóa việc truyền gói tin từ bất kỳ nơi nào khác ngoài hàm *hard_start_xmit* của bạn (có thể để phản hồi lại một yêu cầu cấu hình lại - reconfiguration request), hàm bạn muốn sử dụng là:

`void netif_tx_disable(struct net_device *dev);`

**518 | Chương 17: Network Drivers**

Hàm này hoạt động giống như *netif_stop_queue*, nhưng nó cũng đảm bảo rằng, khi nó trả về, phương thức *hard_start_xmit* của bạn không đang chạy trên một CPU khác. Hàng đợi có thể được khởi động lại bằng *netif_wake_queue*, như bình thường.

## Thời gian chờ truyền (Transmission Timeouts)

Hầu hết các driver xử lý phần cứng thực tế đều phải chuẩn bị cho việc phần cứng đó thỉnh thoảng không phản hồi. Các giao diện có thể quên mất chúng đang làm gì, hoặc hệ thống có thể bị mất ngắt (interrupt). Loại sự cố này rất phổ biến đối với một số thiết bị được thiết kế để chạy trên máy tính cá nhân.

Nhiều driver xử lý vấn đề này bằng cách thiết lập các bộ hẹn giờ (timers); nếu hoạt động chưa hoàn tất vào thời điểm bộ hẹn giờ hết hạn, thì đã có điều gì đó không ổn. Hóa ra, hệ thống mạng về cơ bản là một tập hợp phức tạp các cỗ máy trạng thái (state machines) được điều khiển bởi một khối lượng các bộ hẹn giờ. Do đó, mã nguồn mạng ở vị trí thuận lợi để phát hiện thời gian chờ truyền như một phần trong hoạt động thông thường của nó.

Vì vậy, các network driver không cần phải bận tâm về việc tự phát hiện những sự cố như vậy. Thay vào đó, chúng chỉ cần thiết lập một khoảng thời gian chờ, được đặt trong trường `watchdog_timeo` của cấu trúc `net_device`. Khoảng thời gian này, được tính bằng jiffies, phải đủ dài để tính đến các độ trễ truyền bình thường (chẳng hạn như các vụ va chạm do tắc nghẽn trên môi trường mạng).

Nếu thời gian hiện tại của hệ thống vượt quá thời gian `trans_start` của thiết bị ít nhất bằng khoảng thời gian chờ, tầng mạng cuối cùng sẽ gọi phương thức *tx_timeout* của driver. Công việc của phương thức đó là làm bất cứ điều gì cần thiết để khắc phục sự cố và đảm bảo việc hoàn tất đúng hạn bất kỳ quá trình truyền nào đang diễn ra. Đặc biệt, điều quan trọng là driver không được đánh mất dấu vết của bất kỳ bộ đệm socket (socket buffers) nào đã được giao phó cho nó bởi mã nguồn mạng.

*snull* có khả năng mô phỏng tình trạng treo bộ phát (transmitter lockups), được điều khiển bởi hai tham số thời điểm nạp (load-time parameters):

```c
static int lockup = 0;
module_param(lockup, int, 0);
static int timeout = SNULL_TIMEOUT;
module_param(timeout, int, 0);
```

Nếu trình điều khiển (driver) được nạp với tham số `lockup=n`, hiện tượng treo sẽ được mô phỏng sau mỗi `n` gói tin được truyền đi, và trường `watchdog_timeo` được đặt thành giá trị timeout cho trước. Khi mô phỏng tình trạng treo, *snull* cũng gọi hàm *netif_stop_queue* để ngăn chặn các lần truyền dữ liệu khác xảy ra.

Hàm xử lý quá thời gian truyền (transmission timeout handler) của *snull* có dạng như sau:

```c
void snull_tx_timeout (struct net_device *dev)
{
 struct snull_priv *priv = netdev_priv(dev);

 PDEBUG("Transmit timeout at %ld, latency %ld\n", jiffies,
 jiffies - dev->trans_start);
 /* Mô phỏng một ngắt truyền để thúc đẩy mọi thứ hoạt động */
 priv->status = SNULL_TX_INTR;
 snull_interrupt(0, dev, NULL);
 priv->stats.tx_errors++;
 netif_wake_queue(dev);
 return;
}
```

Khi xảy ra quá thời gian truyền (transmission timeout), trình điều khiển phải ghi nhận lỗi vào các số liệu thống kê của giao diện (interface statistics) và sắp xếp để đưa thiết bị trở về trạng thái ổn định (sane state) nhằm có thể truyền các gói tin mới. Khi xảy ra timeout trong *snull*, driver gọi *snull_interrupt* để lấp đầy ngắt "bị thiếu" và khởi động lại hàng đợi truyền (transmit queue) bằng hàm *netif_wake_queue*.

## Scatter/Gather I/O

Quá trình tạo một gói tin để truyền trên mạng bao gồm việc tập hợp nhiều mảnh dữ liệu lại với nhau. Dữ liệu gói tin thường phải được sao chép từ không gian người dùng (User Space), và các tiêu đề (headers) được sử dụng bởi các tầng khác nhau của ngăn xếp mạng (network stack) cũng phải được bổ sung thêm. Quá trình tập hợp này có thể đòi hỏi một lượng lớn công sức sao chép dữ liệu. Tuy nhiên, nếu giao diện mạng (network interface) chịu trách nhiệm truyền gói tin đó có khả năng thực hiện Scatter/Gather I/O, gói tin sẽ không cần phải được tập hợp lại thành một khối duy nhất, và phần lớn các thao tác sao chép đó có thể được tránh khỏi. Scatter/Gather I/O cũng cho phép truyền dữ liệu mạng theo cơ chế "không sao chép" (zero-copy) trực tiếp từ các bộ đệm trong không gian người dùng (user-space buffers).

Kernel không chuyển các gói tin phân tán (scattered packets) đến phương thức *hard_start_xmit* của bạn trừ khi cờ `NETIF_F_SG` đã được thiết lập trong trường `features` của cấu trúc thiết bị (device structure). Nếu bạn đã thiết lập cờ đó, bạn cần kiểm tra một trường "thông tin chia sẻ" (shared info) đặc biệt bên trong `skb` để xem liệu gói tin được cấu thành từ một phân mảnh đơn lẻ hay nhiều phân mảnh, và để tìm các phân mảnh phân tán đó nếu cần thiết. Một macro đặc biệt tồn tại để truy cập thông tin này; nó có tên là *skb_shinfo*. Bước đầu tiên khi truyền các gói tin có khả năng bị phân mảnh thường trông giống như sau:

```c
if (skb_shinfo(skb)->nr_frags == 0) {
 /* Chỉ sử dụng skb->data và skb->len như bình thường */
}
```

Trường `nr_frags` cho biết có bao nhiêu phân mảnh đã được sử dụng để xây dựng gói tin. Nếu nó bằng 0, gói tin tồn tại dưới dạng một khối duy nhất và có thể được truy cập thông qua trường `data` như bình thường. Tuy nhiên, nếu nó khác không, driver của bạn phải duyệt qua và sắp xếp để chuyển từng phân mảnh riêng lẻ. Trường `data` của cấu trúc `skb` trỏ một cách thuận tiện đến phân mảnh đầu tiên (khác với toàn bộ gói tin, như trong trường hợp không bị phân mảnh). Kích thước của phân mảnh phải được tính bằng cách lấy `skb->len` trừ đi `skb->data_len` (vẫn chứa kích thước của toàn bộ gói tin). Các phân mảnh còn lại nằm trong một mảng có tên là `frags` trong cấu trúc thông tin chia sẻ; mỗi phần tử trong `frags` là một cấu trúc `skb_frag_struct`:

```c
struct skb_frag_struct {
 struct page *page;

 __u16 page_offset;
 __u16 size;
};
```

Như bạn có thể thấy, chúng ta lại một lần nữa làm việc với các cấu trúc trang (page structures), thay vì các địa chỉ ảo của kernel (kernel virtual addresses). Trình điều khiển của bạn nên lặp qua các phân mảnh, ánh xạ (mapping) từng phân mảnh cho một lần truyền DMA và không được quên phân mảnh đầu tiên, vốn được trỏ tới trực tiếp bởi `skb`. Tất nhiên, phần cứng của bạn phải tự tập hợp các phân mảnh lại và truyền chúng như một gói tin duy nhất. Lưu ý rằng, nếu bạn đã thiết lập cờ tính năng `NETIF_F_HIGHDMA`, một số hoặc toàn bộ các phân mảnh có thể nằm trong vùng nhớ cao (high memory).

## Nhận gói tin (Packet Reception)

Việc nhận dữ liệu từ mạng phức tạp hơn việc truyền dữ liệu, bởi vì một `sk_buff` phải được cấp phát và bàn giao cho các tầng phía trên từ bên trong một ngữ cảnh nguyên tử (atomic context). Có hai chế độ nhận gói tin có thể được hiện thực hóa bởi các driver mạng: điều khiển bằng ngắt (interrupt-driven) và thăm dò (polled). Hầu hết các driver đều hiện thực hóa kỹ thuật điều khiển bằng ngắt, và đó là kỹ thuật mà chúng ta sẽ tìm hiểu trước tiên. Một số driver cho các bộ điều hợp băng thông cao (high-bandwidth adapters) cũng có thể hiện thực hóa kỹ thuật thăm dò; chúng ta sẽ xem xét phương pháp này trong phần "Giảm thiểu ngắt nhận" (Receive Interrupt Mitigation).

Việc hiện thực hóa *snull* tách biệt các chi tiết "phần cứng" khỏi các công việc quản lý độc lập với thiết bị (device-independent housekeeping). Do đó, hàm *snull_rx* được gọi từ trình xử lý "ngắt" của *snull* sau khi phần cứng đã nhận được gói tin, và gói tin đó đã nằm sẵn trong bộ nhớ của máy tính. *snull_rx* nhận một con trỏ trỏ đến dữ liệu và chiều dài của gói tin; trách nhiệm duy nhất của nó là gửi gói tin cùng với một số thông tin bổ sung đến các tầng mã nguồn mạng phía trên. Đoạn mã này độc lập với cách thức mà con trỏ dữ liệu và chiều dài được lấy ra.

```c
void snull_rx(struct net_device *dev, struct snull_packet *pkt)
{
 struct sk_buff *skb;
 struct snull_priv *priv = netdev_priv(dev);
 /*
 * Gói tin đã được lấy từ môi trường truyền dẫn.
 * Xây dựng một skb bao quanh nó để các tầng trên có thể xử lý
 */
 skb = dev_alloc_skb(pkt->datalen + 2);
 if (!skb) {
 if (printk_ratelimit( ))
 printk(KERN_NOTICE "snull rx: low on mem - packet dropped\n");
 priv->stats.rx_dropped++;
 goto out;
 }
 memcpy(skb_put(skb, pkt->datalen), pkt->data, pkt->datalen);
 /* Ghi siêu dữ liệu (metadata), sau đó chuyển lên tầng nhận */
 skb->dev = dev;
```

```
 skb->protocol = eth_type_trans(skb, dev);
 skb->ip_summed = CHECKSUM_UNNECESSARY; /* không kiểm tra nó */
 priv->stats.rx_packets++;
 priv->stats.rx_bytes += pkt->datalen;
 netif_rx(skb);
 out:
 return;
}
```

Hàm này đủ tổng quát để đóng vai trò như một mẫu (template) cho bất kỳ trình điều khiển mạng (network driver) nào, nhưng cần có một số giải thích trước khi bạn có thể tự tin tái sử dụng đoạn mã này.

Bước đầu tiên là cấp phát một vùng đệm (buffer) để chứa gói tin. Lưu ý rằng hàm cấp phát vùng đệm (*dev\_alloc\_skb*) cần biết độ dài dữ liệu. Thông tin này được hàm sử dụng để cấp phát không gian cho vùng đệm. *dev\_alloc\_skb* gọi *kmalloc* với ưu tiên nguyên tử (atomic priority), vì vậy nó có thể được sử dụng an toàn tại thời điểm ngắt (interrupt time). Nhân hệ điều hành (Kernel) cung cấp các giao diện khác để cấp phát bộ đệm socket (socket-buffer), nhưng chúng không đáng để giới thiệu ở đây; bộ đệm socket được giải thích chi tiết trong phần "Bộ đệm Socket" (The Socket Buffers).

Tất nhiên, giá trị trả về từ *dev\_alloc\_skb* phải được kiểm tra, và *snull* đã làm điều đó. Tuy nhiên, chúng ta gọi *printk\_ratelimit* trước khi phàn nàn về các lỗi cấp phát. Việc tạo ra hàng trăm hoặc hàng nghìn thông điệp bảng điều khiển (console message) mỗi giây là một cách tốt để làm đình trệ hoàn toàn hệ thống và che giấu nguyên nhân gốc rễ của vấn đề; *printk\_ratelimit* giúp ngăn chặn vấn đề đó bằng cách trả về 0 khi có quá nhiều đầu ra được gửi đến console và mọi thứ cần phải được làm chậm lại một chút.

Khi đã có một con trỏ skb hợp lệ, dữ liệu gói tin được sao chép vào bộ đệm bằng cách gọi *memcpy*; hàm *skb\_put* cập nhật con trỏ cuối dữ liệu (end-of-data pointer) trong bộ đệm và trả về một con trỏ trỏ tới không gian vừa được tạo.

Nếu bạn đang viết một trình điều khiển hiệu năng cao (high-performance driver) cho một giao diện có khả năng thực hiện I/O bus-mastering toàn phần, có một sự tối ưu hóa rất đáng cân nhắc ở đây. Một số trình điều khiển cấp phát bộ đệm socket cho các gói tin đến trước khi chúng được tiếp nhận, sau đó ra lệnh cho giao diện đặt dữ liệu gói tin trực tiếp vào không gian của bộ đệm socket. Tầng mạng (networking layer) phối hợp với chiến lược này bằng cách cấp phát tất cả bộ đệm socket trong không gian có khả năng DMA (DMA-capable space) (có thể nằm trong bộ nhớ cao (high memory) nếu thiết bị của bạn được bật cờ tính năng `NETIF_F_HIGHDMA`). Làm như vậy giúp tránh được nhu cầu thực hiện một thao tác sao chép riêng biệt để lấp đầy bộ đệm socket, nhưng đòi hỏi phải cẩn thận với kích thước bộ đệm vì bạn sẽ không biết trước gói tin đến lớn cỡ nào. Việc triển khai phương thức *change\_mtu* cũng rất quan trọng trong tình huống này, vì nó cho phép trình điều khiển phản hồi lại sự thay đổi về kích thước gói tin tối đa (maximum packet size).

Tầng mạng cần phải nắm rõ một số thông tin trước khi nó có thể hiểu được gói tin. Vì mục đích này, các trường `dev` và `protocol` phải được gán giá trị trước khi bộ đệm được chuyển lên các tầng trên. Mã nguồn hỗ trợ Ethernet xuất một hàm trợ giúp (*eth\_type\_trans*), hàm này tìm kiếm một giá trị thích hợp để đưa vào trường `protocol`. Sau đó, chúng ta cần chỉ định cách tính tổng kiểm tra (checksum) sẽ được thực hiện hoặc đã được thực hiện trên gói tin (*snull* không cần thực hiện bất kỳ phép tính tổng kiểm tra nào). Các chính sách có thể có đối với `skb->ip_summed` là:

#### `CHECKSUM_HW`

Thiết bị đã thực hiện tính toán tổng kiểm tra trong phần cứng (hardware). Một ví dụ về tổng kiểm tra phần cứng là giao diện SPARC HME.

#### `CHECKSUM_NONE`

Tổng kiểm tra chưa được xác minh và tác vụ này phải do phần mềm hệ thống (system software) hoàn thành. Đây là giá trị mặc định trong các bộ đệm mới được cấp phát.

#### `CHECKSUM_UNNECESSARY`

Không thực hiện bất kỳ phép tính tổng kiểm tra nào. Đây là chính sách trong *snull* và trong giao diện loopback.

Bạn có thể tự hỏi tại sao trạng thái tổng kiểm tra phải được chỉ định ở đây trong khi chúng ta đã thiết lập một cờ trong trường `features` của cấu trúc `net_device` của mình. Câu trả lời là cờ tính năng (features flag) cho kernel biết cách thiết bị của chúng nó xử lý các gói tin đi (outgoing packets). Nó không được sử dụng cho các gói tin đến (incoming packets), những gói tin này thay vào đó phải được đánh dấu riêng lẻ.

Cuối cùng, trình điều khiển cập nhật bộ đếm thống kê (statistics counter) của nó để ghi nhận rằng một gói tin đã được nhận. Cấu trúc thống kê bao gồm vài trường; quan trọng nhất là `rx_packets`, `rx_bytes`, `tx_packets` và `tx_bytes`, chứa số lượng gói tin đã nhận và truyền đi cùng tổng số octet đã được chuyển giao. Tất cả các trường được mô tả kỹ lưỡng trong phần "Thông tin Thống kê" (Statistical Information).

Bước cuối cùng trong việc tiếp nhận gói tin được thực hiện bởi *netif\_rx*, hàm này bàn giao bộ đệm socket cho các tầng trên. *netif\_rx* thực tế trả về một giá trị nguyên; `NET_RX_SUCCESS` (0) có nghĩa là gói tin đã được nhận thành công; bất kỳ giá trị nào khác đều cho thấy có rắc rối. Có ba giá trị trả về (`NET_RX_CN_LOW`, `NET_RX_CN_MOD` và `NET_RX_CN_HIGH`) biểu thị mức độ tắc nghẽn (congestion) ngày càng tăng trong hệ thống con mạng; `NET_RX_DROP` có nghĩa là gói tin đã bị hủy. Trình điều khiển có thể sử dụng các giá trị này để ngừng cấp phát gói tin vào kernel khi tình trạng tắc nghẽn tăng cao, nhưng trên thực tế, hầu hết các trình điều khiển đều bỏ qua giá trị trả về từ *netif\_rx*. Nếu bạn đang viết một trình điều khiển cho thiết bị băng thông cao (high-bandwidth device) và muốn xử lý đúng đắn khi xảy ra tình trạng tắc nghẽn, phương pháp tốt nhất là triển khai NAPI, mà chúng ta sẽ tìm hiểu sau một cuộc thảo luận ngắn gọn về trình xử lý ngắt (interrupt handler).

```

## Trình xử lý ngắt (Interrupt Handler)
Hầu hết các giao diện phần cứng đều được điều khiển thông qua một trình xử lý ngắt (interrupt handler). Phần cứng thực hiện ngắt (interrupt) bộ xử lý (processor) để báo hiệu một trong hai sự kiện có thể xảy ra: một gói tin (packet) mới đã đến hoặc quá trình truyền một gói tin đi đã hoàn tất. Các giao diện mạng (network interfaces) cũng có thể tạo ra các ngắt để báo hiệu lỗi, thay đổi trạng thái đường truyền (link status), v.v.

Thường thì quy trình xử lý ngắt có thể phân biệt giữa ngắt gói tin đến và thông báo truyền xong bằng cách kiểm tra thanh ghi trạng thái (status register) nằm trên thiết bị vật lý. Giao diện *snull* hoạt động tương tự, nhưng từ trạng thái (status word) của nó được hiện thực hóa bằng phần mềm và nằm trong `dev->priv`. Trình xử lý ngắt cho một giao diện mạng có dạng như sau:

```c

static void snull_regular_interrupt(int irq, void *dev_id, struct pt_regs *regs)
{
int statusword;
struct snull_priv *priv;
struct snull_packet *pkt = NULL;
/*

- As usual, check the "device" pointer to be sure it is
- really interrupting.
- Then assign "struct device *dev"
*/
struct net_device *dev = (struct net_device *)dev_id;
/* ... and check with hw if it's really ours */
/* paranoid */
if (!dev)
return;
/* Lock the device */
priv = netdev_priv(dev);
spin_lock(&priv->lock);
/* retrieve statusword: real netdevices use I/O instructions */
statusword = priv->status;
priv->status = 0;
if (statusword & SNULL_RX_INTR) {
/* send it to snull_rx for handling */
pkt = priv->rx_queue;
if (pkt) {
priv->rx_queue = pkt->next;
snull_rx(dev, pkt);
}
}
if (statusword & SNULL_TX_INTR) {
/* a transmission is over: free the skb */
priv->stats.tx_packets++;
priv->stats.tx_bytes += priv->tx_packetlen;
dev_kfree_skb(priv->skb);
}
/* Unlock the device and we are done */
spin_unlock(&priv->lock);
if (pkt) snull_release_buffer(pkt); /* Do this outside the lock! */
return;
}

```

Nhiệm vụ đầu tiên của trình xử lý là lấy ra một con trỏ (pointer) trỏ đến cấu trúc `struct net_device` chính xác. Con trỏ này thường bắt nguồn từ con trỏ `dev_id` được nhận vào dưới dạng một tham số (argument).

Phần thú vị của trình xử lý này giải quyết tình huống "truyền hoàn tất" (transmission done). Trong trường hợp này, các thống kê (statistics) được cập nhật và *dev_kfree_skb* được gọi để trả bộ đệm socket (socket buffer) (không còn cần thiết nữa) về cho hệ thống. Thực tế có ba biến thể của hàm này có thể được gọi:

`dev_kfree_skb(struct sk_buff *skb);`

Phiên bản này nên được gọi khi bạn biết rằng mã nguồn của mình sẽ không chạy trong ngữ cảnh ngắt (interrupt context). Vì *snull* không có ngắt phần cứng thực tế, đây là phiên bản mà chúng ta sử dụng.

`dev_kfree_skb_irq(struct sk_buff *skb);`

Nếu bạn biết rằng mình sẽ giải phóng bộ đệm trong một trình xử lý ngắt, hãy sử dụng phiên bản này, vốn được tối ưu hóa cho trường hợp đó.

`dev_kfree_skb_any(struct sk_buff *skb);`

Đây là phiên bản nên được sử dụng nếu đoạn mã liên quan có thể chạy trong cả ngữ cảnh ngắt hoặc ngữ cảnh phi ngắt (noninterrupt context).

Cuối cùng, nếu trình điều khiển (driver) của bạn đã tạm thời dừng hàng đợi truyền (transmission queue), đây thường là nơi để khởi động lại nó bằng *netif_wake_queue*.

Việc tiếp nhận gói tin (packet reception), trái ngược với việc truyền, không cần bất kỳ xử lý ngắt đặc biệt nào. Việc gọi *snull_rx* (mà chúng ta đã thấy trước đó) là tất cả những gì cần thiết.

## Giảm thiểu ngắt nhận (Receive Interrupt Mitigation)
Khi một trình điều khiển mạng được viết như chúng ta đã mô tả ở trên, bộ xử lý sẽ bị ngắt đối với mỗi gói tin được nhận bởi giao diện của bạn. Trong nhiều trường hợp, đó là chế độ hoạt động mong muốn và không gặp vấn đề gì. Tuy nhiên, các giao diện băng thông cao (high-bandwidth interfaces) có thể nhận hàng nghìn gói tin mỗi giây. Với tải ngắt kiểu đó, hiệu năng tổng thể của hệ thống có thể bị suy giảm.

Như một cách để cải thiện hiệu năng của Linux trên các hệ thống cao cấp (high-end systems), các nhà phát triển hệ thống con mạng (networking subsystem) đã tạo ra một giao diện thay thế (được gọi là NAPI)\* dựa trên kỹ thuật bỏ phiếu (polling). "Polling" có thể là một từ ngữ không mấy thiện cảm đối với các nhà phát triển trình điều khiển, những người thường xem các kỹ thuật polling là kém thanh lịch và kém hiệu quả. Tuy nhiên, polling chỉ kém hiệu quả khi giao diện được thăm dò (poll) khi không có công việc nào để làm. Khi hệ thống có một giao diện tốc độ cao xử lý lưu lượng truy cập nặng, *luôn luôn* có nhiều gói tin hơn để xử lý. Không cần phải ngắt bộ xử lý trong những tình huống như vậy; chỉ cần các gói tin mới được thu thập từ giao diện định kỳ là đủ.

Việc dừng các ngắt nhận (receive interrupts) có thể làm giảm đáng kể tải cho bộ xử lý. Các trình điều khiển tương thích với NAPI (NAPI-compliant drivers) cũng có thể được yêu cầu không đưa các gói tin vào kernel nếu các gói tin đó bị loại bỏ trong mã mạng do nghẽn mạng (congestion), điều này cũng có thể giúp cải thiện hiệu năng khi sự trợ giúp đó là vô cùng cần thiết. Vì nhiều lý do khác nhau, các trình điều khiển NAPI cũng ít có khả năng sắp xếp lại thứ tự các gói tin hơn.

 NAPI là viết tắt của "new API" (API mới); các lập trình viên mạng giỏi tạo ra các giao diện hơn là đặt tên cho chúng.

Tuy nhiên, không phải tất cả các thiết bị đều có thể hoạt động ở chế độ NAPI. Một giao diện hỗ trợ NAPI (NAPI-capable interface) phải có khả năng lưu trữ nhiều gói tin (hoặc trên chính card mạng, hoặc trong một vòng DMA trong bộ nhớ - in-memory DMA ring). Giao diện phải có khả năng vô hiệu hóa các ngắt đối với các gói tin nhận được, trong khi vẫn tiếp tục tạo ngắt cho các lần truyền thành công và các sự kiện khác. Có những vấn đề tế nhị khác có thể làm cho việc viết một trình điều khiển tương thích với NAPI trở nên khó khăn hơn; hãy xem *Documentation/networking/NAPI_HOWTO.txt* trong cây mã nguồn kernel (kernel source tree) để biết thêm chi tiết.

Khá ít driver (trình điều khiển) triển khai giao diện NAPI (New API). Tuy nhiên, nếu bạn đang viết một driver cho một giao diện (interface) có khả năng tạo ra một lượng lớn ngắt (interrupt), việc dành thời gian để triển khai NAPI chắc chắn sẽ rất hữu ích.

Driver *snull*, khi được tải với tham số `use_napi` được thiết lập thành một giá trị khác không, sẽ hoạt động ở chế độ NAPI. Tại thời điểm khởi tạo, chúng ta phải thiết lập một vài trường bổ sung trong cấu trúc `struct net_device`:

```c

if (use_napi) {
dev->poll = snull_poll;
dev->weight = 2;
}

```

Trường `poll` phải được trỏ đến hàm polling (thăm dò) của driver; chúng ta sẽ xem xét *snull_poll* ngay sau đây. Trường `weight` mô tả mức độ quan trọng tương đối của giao diện: bao nhiêu lưu lượng truy cập nên được chấp nhận từ giao diện khi tài nguyên đang khan hiếm. Không có quy tắc nghiêm ngặt nào về việc tham số weight nên được thiết lập ra sao; theo quy ước, các giao diện Ethernet 10 MBps thiết lập weight thành 16, trong khi các giao diện nhanh hơn sử dụng 64. Bạn không nên đặt weight lớn hơn số lượng gói tin (packet) mà giao diện của bạn có thể lưu trữ. Trong *snull*, chúng ta đặt weight bằng hai nhằm mục đích minh họa việc nhận gói tin bị hoãn (deferred packet reception).

Bước tiếp theo trong việc tạo ra một driver tương thích với NAPI là thay đổi trình xử lý ngắt (interrupt handler). Khi giao diện của bạn (vốn nên được khởi tạo với ngắt nhận được bật) báo hiệu rằng một gói tin đã đến, trình xử lý ngắt *không được phép* xử lý gói tin đó. Thay vào đó, nó nên vô hiệu hóa các ngắt nhận tiếp theo và thông báo cho kernel (hạt nhân) rằng đã đến lúc bắt đầu polling giao diện. Trong trình xử lý "ngắt" của *snull*, mã nguồn phản hồi các ngắt nhận gói tin đã được thay đổi thành như sau:

```c

if (statusword & SNULL_RX_INTR) {
snull_rx_ints(dev, 0); /* Vô hiệu hóa các ngắt tiếp theo */
netif_rx_schedule(dev);
}

```

Khi giao diện thông báo cho chúng ta rằng có một gói tin khả dụng, trình xử lý ngắt sẽ giữ nguyên gói tin đó trong giao diện; tất cả những gì cần làm tại thời điểm này là gọi hàm *netif_rx_schedule*, hàm này sẽ khiến phương thức *poll* của chúng ta được gọi vào một thời điểm nào đó trong tương lai.

Phương thức *poll* có nguyên mẫu (prototype) sau:

```c

int (*poll)(struct net_device *dev, int *budget);

```

Việc triển khai phương thức *poll* trong *snull* trông như thế này:

```c

static int snull_poll(struct net_device *dev, int *budget)
{
int npackets = 0, quota = min(dev->quota, *budget);
struct sk_buff *skb;
struct snull_priv *priv = netdev_priv(dev);
struct snull_packet *pkt;
while (npackets < quota && priv->rx_queue) {
pkt = snull_dequeue_buf(dev);
skb = dev_alloc_skb(pkt->datalen + 2);
if (! skb) {
if (printk_ratelimit( ))
printk(KERN_NOTICE "snull: packet dropped\n");
priv->stats.rx_dropped++;
snull_release_buffer(pkt);
continue;
}
memcpy(skb_put(skb, pkt->datalen), pkt->data, pkt->datalen);
skb->dev = dev;
skb->protocol = eth_type_trans(skb, dev);
skb->ip_summed = CHECKSUM_UNNECESSARY; /* không cần kiểm tra */
netif_receive_skb(skb);
/* Duy trì các thống kê (stats) */
npackets++;
priv->stats.rx_packets++;
priv->stats.rx_bytes += pkt->datalen;
snull_release_buffer(pkt);
}
/* Nếu chúng ta đã xử lý tất cả các gói tin, hoàn tất; thông báo cho kernel và bật lại ngắt */
*budget -= npackets;
dev->quota -= npackets;
if (! priv->rx_queue) {
netif_rx_complete(dev);
snull_rx_ints(dev, 1);
return 0;
}
/* Chúng ta không thể xử lý mọi thứ. */
return 1;
}

```

Phần cốt lõi của hàm này liên quan đến việc tạo ra một `skb` (socket buffer) chứa gói tin; đoạn mã này tương tự như những gì chúng ta đã thấy trong *snull_rx* trước đây. Tuy nhiên, có một số điểm khác biệt:

• Tham số `budget` cung cấp số lượng gói tin tối đa mà chúng ta được phép chuyển vào kernel. Bên trong cấu trúc thiết bị, trường `quota` cung cấp một giới hạn tối đa khác; phương thức *poll* phải tuân thủ giới hạn nhỏ hơn trong hai giới hạn này. Nó cũng phải giảm cả `dev->quota` và `*budget` đi một lượng bằng số lượng gói tin thực tế đã nhận. Giá trị budget là số lượng gói tin tối đa mà CPU hiện tại có thể nhận từ tất cả các giao diện, trong khi quota là giá trị tính trên mỗi giao diện (per-interface) thường bắt đầu bằng giá trị weight được gán cho giao diện tại thời điểm khởi tạo.

- Các gói tin phải được chuyển đến kernel bằng hàm *netif_receive_skb*, thay vì *netif_rx*.
- Nếu phương thức *poll* có thể xử lý tất cả các gói tin khả dụng nằm trong các giới hạn đã cho, nó phải bật lại ngắt nhận, gọi hàm *netif_rx_complete* để tắt chế độ polling và trả về 0. Giá trị trả về là 1 cho biết vẫn còn các gói tin cần được xử lý.

Hệ thống con mạng (networking subsystem) đảm bảo rằng phương thức *poll* của bất kỳ thiết bị nào sẽ không bị gọi đồng thời trên nhiều hơn một bộ vi xử lý (processor). Tuy nhiên, các lệnh gọi đến *poll* vẫn có thể xảy ra đồng thời với các lệnh gọi đến các phương thức thiết bị khác của bạn.

## Thay đổi Trạng thái Liên kết (Link State)
Theo định nghĩa, các kết nối mạng giao tiếp với thế giới bên ngoài hệ thống cục bộ. Do đó, chúng thường bị ảnh hưởng bởi các sự kiện bên ngoài và có tính chất tạm thời (transient). Hệ thống con mạng cần biết khi nào các liên kết mạng kết nối (up) hoặc ngắt (down), và nó cung cấp một vài hàm mà driver có thể sử dụng để truyền tải thông tin đó.

Hầu hết các công nghệ mạng liên quan đến một kết nối vật lý thực tế đều cung cấp trạng thái *carrier* (tín hiệu đường truyền); sự hiện diện của carrier có nghĩa là phần cứng đã sẵn sàng và hoạt động được. Ví dụ, các bộ điều hợp Ethernet (Ethernet adapters) sẽ nhận biết tín hiệu carrier trên đường dây cáp; khi một người dùng vấp phải cáp, tín hiệu carrier đó sẽ biến mất và liên kết (link) bị ngắt. Theo mặc định, các thiết bị mạng được giả định là có sẵn tín hiệu carrier. Tuy nhiên, trình điều khiển (driver) có thể thay đổi trạng thái đó một cách tường minh bằng các hàm sau:

```c

void netif_carrier_off(struct net_device *dev);
void netif_carrier_on(struct net_device *dev);

```

Nếu driver của bạn phát hiện thiếu tín hiệu carrier trên một trong các thiết bị của nó, driver đó nên gọi hàm *netif\_carrier\_off* để thông báo cho nhân hệ điều hành (kernel) về sự thay đổi này. Khi có lại carrier, hàm *netif\_carrier_on* nên được gọi. Một số driver cũng gọi hàm *netif\_carrier\_off* khi thực hiện các thay đổi cấu hình lớn (chẳng hạn như kiểu truyền thông - media type); khi bộ điều hợp đã hoàn tất quá trình thiết lập lại (reset), carrier mới sẽ được phát hiện và lưu lượng dữ liệu có thể tiếp tục.

Ngoài ra còn có một hàm trả về số nguyên (integer function):

```c

int netif_carrier_ok(struct net_device *dev);

```

Hàm này có thể được sử dụng để kiểm tra trạng thái carrier hiện tại (được phản ánh trong cấu trúc thiết bị).

## Các Bộ Đệm Socket (The Socket Buffers)
Bây giờ chúng ta đã đề cập đến hầu hết các vấn đề liên quan đến giao diện mạng (network interfaces). Điều còn thiếu là một số thảo luận chi tiết hơn về cấu trúc `sk_buff`. Cấu trúc này nằm ở cốt lõi của hệ thống con mạng (network subsystem) của Linux kernel, và giờ đây chúng ta sẽ giới thiệu cả các trường chính (fields) của cấu trúc cũng như các hàm được sử dụng để thao tác với nó.

Mặc dù không có nhu cầu bắt buộc phải hiểu các chi tiết bên nội tại (internals) của `sk_buff`, khả năng xem xét nội dung của nó có thể rất hữu ích khi bạn đang dò lỗi (track down problems) và khi bạn đang cố gắng tối ưu hóa mã nguồn của mình. Ví dụ, nếu bạn tìm trong tệp *loopback.c*, bạn sẽ thấy một sự tối ưu hóa dựa trên sự hiểu biết về nội dung bên trong của `sk_buff`. Cảnh báo thông thường được áp dụng ở đây: nếu bạn viết mã tận dụng sự hiểu biết về cấu trúc `sk_buff`, bạn phải chuẩn bị tinh thần là mã đó có thể bị hỏng (break) với các phiên bản kernel trong tương lai. Dù vậy, đôi khi những lợi ích về hiệu năng lại bù đắp cho chi phí bảo trì bổ sung.

Chúng ta sẽ không mô tả toàn bộ cấu trúc ở đây, mà chỉ các trường có thể được sử dụng từ bên trong một driver. Nếu bạn muốn tìm hiểu thêm, bạn có thể xem trong *<linux/skbuff.h>*, nơi cấu trúc này được định nghĩa và các nguyên mẫu hàm (prototypes) được khai báo. Các chi tiết bổ sung về cách các trường và hàm được sử dụng có thể dễ dàng được truy xuất bằng cách sử dụng lệnh `grep` trong mã nguồn kernel.

## Các Trường Quan Trọng (The Important Fields)
Các trường được giới thiệu ở đây là những trường mà driver có thể cần truy cập. Chúng được liệt kê theo thứ tự bất kỳ.

```c

struct net_device *dev;
union { /* ... */ } h;
union { /* ... */ } nh;
union { /* ... */ } mac;

```

Các con trỏ đến các cấp độ header khác nhau có trong gói tin. Mỗi trường của union là một con trỏ đến một kiểu cấu trúc dữ liệu khác nhau. `h` chứa các con trỏ đến header tầng giao vận (transport layer), ví dụ như `struct tcphdr *th`; `nh` bao gồm các header tầng mạng (network layer), chẳng hạn như `struct iphdr *iph`; và `mac` tập hợp các con trỏ đến các header tầng liên kết dữ liệu (link-layer), chẳng hạn như `struct ethdr *ethernet`.

Nếu driver của bạn cần xem các địa chỉ nguồn và đích của một gói tin TCP, nó có thể tìm thấy chúng trong `skb->h.th`. Hãy tham khảo tệp header để biết toàn bộ tập hợp các kiểu header có thể được truy cập theo cách này.

Lưu ý rằng các network driver chịu trách nhiệm thiết lập con trỏ `mac` cho các gói tin đến. Tác vụ này thông thường được xử lý bởi *eth\_type\_trans*, nhưng các driver không phải Ethernet phải thiết lập trực tiếp `skb->mac.raw`, như được minh họa trong phần "Non-Ethernet Headers" (Các Header Không phải Ethernet).

```c

unsigned char *head;
unsigned char *data;
unsigned char *tail;
unsigned char *end;

```

Các con trỏ được sử dụng để định địa chỉ dữ liệu trong gói tin. `head` trỏ đến điểm đầu của vùng nhớ được cấp phát, `data` là điểm đầu của các octet hợp lệ (và thường lớn hơn `head` một chút), `tail` là điểm cuối của các octet hợp lệ, và `end` trỏ đến địa chỉ tối đa mà `tail` có thể vươn tới. Một cách nhìn nhận khác là vùng đệm *có sẵn* (available buffer space) là `skb->end - skb->head`, và vùng dữ liệu *đang được sử dụng* (currently used data space) là `skb->tail - skb->data`.

```c

unsigned int len;
unsigned int data_len;

```

`len` là tổng độ dài của dữ liệu trong gói tin, trong khi `data_len` là độ dài của phần gói tin được lưu trữ trong các phân đoạn (fragments) rời rạc. Trường `data_len` có giá trị bằng 0 trừ khi scatter/gather I/O đang được sử dụng.

```c

unsigned char ip_summed;

```

Chính sách kiểm tra tổng (checksum policy) cho gói tin này. Trường này được thiết lập bởi driver đối với các gói tin đến, như được mô tả trong phần "Packet Reception" (Nhận Gói Tin).

```c

unsigned char pkt_type;

```

Phân loại gói tin được sử dụng trong quá trình chuyển phát nó. Driver chịu trách nhiệm thiết lập giá trị này thành `PACKET_HOST` (gói tin này dành cho tôi), `PACKET_OTHERHOST` (không, gói tin này không dành cho tôi), `PACKET_BROADCAST`, hoặc `PACKET_MULTICAST`. Các Ethernet driver không sửa đổi `pkt_type` một cách tường minh bởi vì hàm *eth\_type\_trans* đã làm thay việc đó cho chúng.

```c

shinfo(struct sk_buff *skb);
unsigned int shinfo(skb)->nr_frags;
skb_frag_t shinfo(skb)->frags;

```

Vì lý do hiệu năng (performance), một số thông tin của skb được lưu trữ trong một cấu trúc riêng biệt nằm ngay sau skb trong bộ nhớ. "Thông tin chia sẻ" này (shared info — gọi như vậy vì nó có thể được chia sẻ giữa các bản sao của skb trong mã nguồn networking) phải được truy cập thông qua macro *shinfo*. Có một vài trường trong cấu trúc này, nhưng hầu hết chúng nằm ngoài phạm vi của cuốn sách này. Chúng ta đã thấy `nr_frags` và `frags` trong phần "Scatter/Gather I/O".

Các trường còn lại trong cấu trúc này không quá đặc biệt. Chúng được sử dụng để duy trì danh sách các buffer, tính toán bộ nhớ thuộc về socket sở hữu buffer đó, v.v.

## Các hàm thao tác trên Socket Buffer
Các thiết bị mạng sử dụng cấu trúc `sk_buff` tương tác với nó thông qua các hàm giao diện chính thức. Có rất nhiều hàm vận hành trên socket buffer; dưới đây là các hàm thú vị nhất:

```c

struct sk_buff *alloc_skb(unsigned int len, int priority);
struct sk_buff *dev_alloc_skb(unsigned int len);

```

Cấp phát một buffer. Hàm *alloc\_skb* cấp phát một buffer và khởi tạo cả `skb->data` và `skb->tail` trỏ đến `skb->head`. Hàm *dev\_alloc\_skb* là một đường tắt gọi *alloc\_skb* với mức độ ưu tiên `GFP_ATOMIC` và dự trữ một số khoảng trống giữa `skb->head` và `skb->data`. Vùng dữ liệu này được sử dụng cho các tối ưu hóa trong tầng mạng (network layer) và driver không nên động chạm vào nó.

```c

void kfree_skb(struct sk_buff *skb);
void dev_kfree_skb(struct sk_buff *skb);
void dev_kfree_skb_irq(struct sk_buff *skb);
void dev_kfree_skb_any(struct sk_buff *skb);

```

Giải phóng một buffer. Lời gọi *kfree\_skb* được sử dụng nội bộ bởi kernel. Một driver nên sử dụng một trong các biến thể của *dev\_kfree\_skb* thay thế: *dev\_kfree\_skb* cho context không ngắt (non-interrupt context), *dev\_kfree\_skb\_irq* cho context ngắt (interrupt context), hoặc *dev\_kfree\_skb\_any* cho đoạn mã có thể chạy ở bất kỳ context nào.

```c

unsigned char *skb_put(struct sk_buff *skb, int len);
unsigned char *__skb_put(struct sk_buff *skb, int len);

```

Cập nhật các trường `tail` và `len` của cấu trúc `sk_buff`; chúng được sử dụng để thêm dữ liệu vào cuối buffer. Giá trị trả về của mỗi hàm là giá trị trước đó của `skb->tail` (nói cách khác, nó trỏ đến vùng dữ liệu vừa được tạo). Các driver có thể sử dụng giá trị trả về để sao chép dữ liệu bằng cách gọi `memcpy(skb_put(...), data, len)` hoặc một hàm tương đương. Sự khác biệt giữa hai hàm này là *skb\_put* kiểm tra để đảm bảo rằng dữ liệu vừa vặn trong buffer, trong khi *\_\_skb\_put* bỏ qua việc kiểm tra đó.

```c

unsigned char *skb_push(struct sk_buff *skb, int len);
unsigned char *__skb_push(struct sk_buff *skb, int len);

```

Các hàm để giảm `skb->data` và tăng `skb->len`. Chúng tương tự như *skb\_put*, ngoại trừ việc dữ liệu được thêm vào đầu gói tin thay vì ở cuối. Giá trị trả về trỏ tới vùng dữ liệu vừa được tạo. Các hàm này được sử dụng để thêm một hardware header (tiêu đề phần cứng) trước khi truyền gói tin. Một lần nữa, *\_\_skb\_push* khác biệt ở chỗ nó không kiểm tra dung lượng trống đầy đủ.

```c

int skb_tailroom(struct sk_buff *skb);

```

Trả về dung lượng trống có sẵn để đặt dữ liệu vào buffer. Nếu một driver đưa nhiều dữ liệu vào buffer hơn mức nó có thể chứa, hệ thống sẽ gây ra lỗi kernel panic (system panic). Mặc dù bạn có thể phản đối rằng một lời gọi *printk* là đủ để ghi nhận lỗi, nhưng tình trạng hỏng bộ nhớ (memory corruption) gây hại cho hệ thống đến mức các nhà phát triển đã quyết định thực hiện hành động dứt khoát. Trong thực tế, bạn không cần phải kiểm tra dung lượng trống nếu buffer đã được cấp phát đúng cách. Vì các driver thường lấy kích thước gói tin trước khi cấp phát buffer, nên chỉ có một driver bị lỗi nặng mới đưa quá nhiều dữ liệu vào buffer, và việc xuất hiện kernel panic có thể được xem là hình phạt thích đáng.

```c

int skb_headroom(struct sk_buff *skb);

```

Trả về dung lượng trống có sẵn ở phía trước dữ liệu, nghĩa là có thể "push" bao nhiêu byte vào buffer.

```c

void skb_reserve(struct sk_buff *skb, int len);

```

Tăng cả `data` và `tail`. Hàm này có thể được sử dụng để dự trữ không gian phần đầu (headroom) trước khi điền dữ liệu vào buffer. Hầu hết các giao tiếp Ethernet đều dự trữ hai byte ở phía trước gói tin; do đó, IP header được căn chỉnh (aligned) trên biên 16 byte, sau một Ethernet header 14 byte. *snull* cũng làm như vậy, mặc dù câu lệnh này không được hiển thị trong mục "Nhận gói tin" (Packet Reception) để tránh việc giới thiệu thêm các khái niệm phức tạp tại thời điểm đó.

`unsigned char *skb_pull(struct sk_buff *skb, int len);`

Loại bỏ dữ liệu khỏi phần đầu của gói tin. Driver sẽ không cần phải sử dụng hàm này, nhưng nó được đưa vào đây để tính đầy đủ. Nó làm giảm `skb->len` và tăng `skb->data`; đây là cách hardware header (Ethernet hoặc tương đương) bị loại bỏ khỏi phần đầu của các gói tin đến.

`int skb_is_nonlinear(struct sk_buff *skb);`

Trả về giá trị true nếu skb này được tách thành nhiều phân đoạn (fragment) cho Scatter/Gather I/O.
```

```c
int skb\_headlen(struct sk\_buff \*skb);
```

Trả về độ dài của phân đoạn (segment) đầu tiên của skb (phần được trỏ tới bởi `skb->data`).

```c
void *kmap_skb_frag(skb_frag_t *frag);
void kunmap_skb_frag(void *vaddr);
```

Nếu bạn bắt buộc phải truy cập trực tiếp các phân đoạn (fragment) trong một socket buffer phi tuyến tính (nonlinear `skb`) từ bên trong Kernel Space, các hàm này sẽ thực hiện ánh xạ (map) và hủy ánh xạ (unmap) chúng cho bạn. Một hàm ánh xạ nguyên tử (atomic `kmap`) được sử dụng, vì vậy bạn không thể ánh xạ nhiều hơn một phân đoạn tại cùng một thời điểm.

Kernel định nghĩa một vài hàm khác hoạt động trên socket buffer, nhưng chúng nhằm mục đích được sử dụng ở các tầng cao hơn của mã nguồn mạng (networking code), và thiết bị điều khiển (driver) không cần đến chúng.

## Phân giải Địa chỉ MAC (MAC Address Resolution)

Một vấn đề thú vị trong giao tiếp Ethernet là cách liên kết các địa chỉ MAC (ID phần cứng độc đáo của giao diện mạng) với số IP. Hầu hết các giao thức đều gặp vấn đề tương tự, nhưng ở đây chúng ta tập trung vào trường hợp giống Ethernet (Ethernet-like). Chúng ta cố gắng cung cấp một mô tả hoàn chỉnh về vấn đề này, do đó chúng ta sẽ xem xét ba tình huống: ARP, tiêu đề Ethernet không có ARP (như *plip*), và tiêu đề phi Ethernet.

## Sử dụng ARP với Ethernet

Cách thông thường để xử lý việc phân giải địa chỉ (address resolution) là sử dụng Giao thức Phân giải Địa chỉ (Address Resolution Protocol - ARP). May mắn thay, ARP được quản lý bởi kernel và một giao diện Ethernet không cần làm gì đặc biệt để hỗ trợ ARP. Miễn là `dev->addr` và `dev->addr_len` được gán chính xác tại thời điểm mở (open time), driver không cần phải lo lắng về việc phân giải số IP thành địa chỉ MAC; hàm *ether\_setup* sẽ gán các phương thức thiết bị chính xác cho `dev->hard_header` và `dev->rebuild_header`.

Mặc dù kernel thông thường xử lý các chi tiết về phân giải địa chỉ (và việc lưu đệm kết quả - caching), nó vẫn yêu cầu driver giao diện hỗ trợ trong việc xây dựng gói tin (packet). Rốt cuộc, driver nắm rõ các chi tiết về tiêu đề tầng vật lý (physical layer header), trong khi các tác giả của mã nguồn mạng đã cố gắng cô lập phần còn lại của kernel khỏi kiến thức đó. Để đạt được điều này, kernel gọi phương thức *hard\_header* của driver để bố trí

gói tin với các kết quả từ truy vấn ARP. Thông thường, các nhà phát triển Ethernet driver không cần phải biết về quá trình này—mã nguồn Ethernet chung sẽ lo liệu mọi thứ.

## Ghi đè ARP (Overriding ARP)

Các giao diện mạng điểm-điểm (point-to-point) đơn giản, chẳng hạn như *plip*, có thể đạt lợi ích từ việc sử dụng các tiêu đề Ethernet, đồng thời tránh được chi phí chung (overhead) của việc gửi các gói tin ARP qua lại. Mã nguồn mẫu trong *snull* cũng nằm trong nhóm thiết bị mạng này. *snull* không thể sử dụng ARP bởi vì driver thay đổi các địa chỉ IP trong các gói tin đang được truyền đi, và các gói tin ARP cũng trao đổi các địa chỉ IP. Mặc dù chúng ta có thể triển khai một bộ tạo phản hồi ARP đơn giản mà không gặp nhiều rắc rối, nhưng việc minh họa cách xử lý trực tiếp các tiêu đề tầng vật lý sẽ trực quan hơn.

Nếu thiết bị của bạn muốn sử dụng tiêu đề phần cứng thông thường mà không cần chạy ARP, bạn cần ghi đè (override) phương thức mặc định `dev->hard_header`. Đây là cách *snull* triển khai nó, dưới dạng một hàm rất ngắn:

```c
int snull_header(struct sk_buff *skb, struct net_device *dev,
 unsigned short type, void *daddr, void *saddr,
 unsigned int len)
{
 struct ethhdr *eth = (struct ethhdr *)skb_push(skb,ETH_HLEN);
 eth->h_proto = htons(type);
 memcpy(eth->h_source, saddr ? saddr : dev->dev_addr, dev->addr_len);
 memcpy(eth->h_dest, daddr ? daddr : dev->dev_addr, dev->addr_len);
 eth->h_dest[ETH_ALEN-1] ^= 0x01; /* dest is us xor 1 */
 return (dev->hard_header_len);
}
```

Hàm này đơn giản lấy thông tin được cung cấp bởi kernel và định dạng nó thành một tiêu đề Ethernet chuẩn. Nó cũng chuyển đổi (toggle) một bit trong địa chỉ Ethernet đích, vì những lý do được mô tả sau đây.

Khi một gói tin được nhận bởi giao diện, tiêu đề phần cứng được sử dụng theo một vài cách bởi *eth\_type\_trans*. Chúng ta đã thấy lệnh gọi này trong *snull\_rx*:

```c
skb->protocol = eth_type_trans(skb, dev);
```

Hàm này trích xuất định danh giao thức (`ETH_P_IP`, trong trường hợp này) từ tiêu đề Ethernet; nó cũng gán `skb->mac.raw`, loại bỏ tiêu đề phần cứng khỏi dữ liệu gói tin (với *skb\_pull*), và thiết lập `skb->pkt_type`. Mục cuối cùng này mặc định là `PACKET_HOST` khi phân bổ `skb` (chỉ ra rằng gói tin được hướng tới host này), và *eth\_type\_trans* thay đổi nó để phản ánh địa chỉ đích Ethernet: nếu địa chỉ đó không khớp với địa chỉ của giao diện nhận nó, trường `pkt_type` được đặt thành `PACKET_OTHERHOST`. Sau đó, trừ khi giao diện ở chế độ hỗn tạp (promiscuous mode) hoặc việc chuyển tiếp gói tin (packet forwarding) được bật trong kernel, *netif\_rx* sẽ loại bỏ bất kỳ gói tin nào có kiểu `PACKET_OTHERHOST`. Vì lý do này, *snull\_header* cẩn thận làm cho địa chỉ phần cứng đích khớp với địa chỉ của giao diện "nhận".

Nếu giao diện của bạn là một liên kết điểm-điểm (point-to-point link), bạn sẽ không muốn nhận các gói tin đa hướng (multicast packet) bất ngờ. Để tránh vấn đề này, hãy nhớ rằng một địa chỉ đích có octet đầu tiên mang bit có ý nghĩa nhỏ nhất (Least Significant Bit - LSB) bằng 0 sẽ được hướng tới một host đơn lẻ (ví dụ: nó là `PACKET_HOST` hoặc `PACKET_OTHERHOST`). Driver *plip* sử dụng `0xfc` làm octet đầu tiên của địa chỉ phần cứng, trong khi *snull* sử dụng `0x00`. Cả hai địa chỉ đều tạo ra một liên kết điểm-điểm giống Ethernet hoạt động tốt.

```

## Tiêu đề Phi-Ethernet (Non-Ethernet Headers)

Chúng ta vừa thấy rằng phần tiêu đề phần cứng (hardware header) chứa một số thông tin bổ sung bên cạnh địa chỉ đích (destination address), trong đó quan trọng nhất là giao thức truyền thông (communication protocol). Bây giờ chúng ta sẽ mô tả cách các tiêu đề phần cứng có thể được sử dụng để đóng gói (encapsulate) thông tin có liên quan. Nếu bạn cần biết các chi tiết cụ thể, bạn có thể trích xuất chúng từ mã nguồn nhân hệ điều hành (kernel sources) hoặc tài liệu kỹ thuật cho phương tiện truyền thông (transmission medium) cụ thể đó. Hầu hết các nhà phát triển trình điều khiển (driver writers) có thể bỏ qua phần thảo luận này và chỉ cần sử dụng việc triển khai Ethernet.

Điều đáng chú ý là không phải mọi thông tin đều phải được cung cấp bởi mọi giao thức. Một liên kết điểm-đối-điểm (point-to-point link) như *plip* hoặc *snull* có thể tránh việc truyền toàn bộ tiêu đề Ethernet mà không làm mất tính tổng quát. Phương thức thiết bị *hard\_header*, được minh họa trước đó qua phần triển khai của *snull\_header*, nhận thông tin phân phối—cả địa chỉ cấp giao thức (protocol-level) và địa chỉ phần cứng (hardware addresses)—từ nhân hệ điều hành (kernel). Nó cũng nhận số hiệu giao thức 16-bit trong tham số kiểu (type argument); ví dụ, IP được nhận diện bởi ETH\_P\_IP. Trình điều khiển (driver) được kỳ vọng sẽ phân phối chính xác cả dữ liệu gói tin (packet data) và số hiệu giao thức đến máy chủ nhận (receiving host). Một liên kết điểm-đối-điểm có thể lược bỏ các địa chỉ khỏi tiêu đề phần cứng của nó, chỉ truyền số hiệu giao thức, bởi vì việc phân phối được đảm bảo độc lập với địa chỉ nguồn và địa chỉ đích. Một liên kết chỉ dùng IP (IP-only link) thậm chí có thể tránh việc truyền tải bất kỳ tiêu đề phần cứng nào.

Khi gói tin được lấy lên ở đầu bên kia của liên kết, hàm nhận trong trình điều khiển nên thiết lập chính xác các trường skb->protocol, skb->pkt\_type và skb->mac.raw.

skb->mac.raw là một con trỏ kiểu ký tự (char pointer) được sử dụng bởi cơ chế phân giải địa chỉ (address-resolution mechanism) được triển khai ở các tầng cao hơn của mã nguồn mạng (networking code) (chẳng hạn như *net/ipv4/arp.c*). Nó phải trỏ đến một địa chỉ máy (machine address) khớp với dev->type. Các giá trị khả dĩ cho kiểu thiết bị được định nghĩa trong *<linux/if\_arp.h>*; các giao diện Ethernet sử dụng ARPHRD\_ETHER. Ví dụ, đây là cách *eth\_type\_trans* xử lý tiêu đề Ethernet cho các gói tin nhận được:

```c

skb->mac.raw = skb->data;
skb_pull(skb, dev->hard_header_len);

```

Trong trường hợp đơn giản nhất (một liên kết điểm-đối-điểm không có tiêu đề), skb->mac.raw có thể trỏ đến một vùng đệm tĩnh (static buffer) chứa địa chỉ phần cứng của giao diện này, protocol có thể được thiết lập thành ETH\_P\_IP, và packet\_type có thể được giữ nguyên giá trị mặc định của nó là PACKET\_HOST.

Vì mọi kiểu phần cứng đều là duy nhất, rất khó để đưa ra lời khuyên cụ thể hơn ngoài những gì đã thảo luận. Tuy nhiên, nhân hệ điều hành (kernel) chứa đầy các ví dụ. Hãy xem xét, ví dụ như trình điều khiển AppleTalk (*drivers/net/appletalk/cops.c*), các trình điều khiển hồng ngoại (infrared drivers) (như *drivers/net/irda/smc\_ircc.c*), hoặc trình điều khiển PPP (*drivers/net/ppp\_generic.c*).

## Các Lệnh ioctl Tùy chỉnh (Custom ioctl Commands)
Chúng ta đã thấy rằng lời gọi hệ thống (system call) *ioctl* được triển khai cho các socket; SIOCSIFADDR và SIOCSIFMAP là các ví dụ về "socket *ioctls*." Bây giờ chúng ta hãy xem cách tham số thứ ba của lời gọi hệ thống được sử dụng bởi mã nguồn mạng (networking code).

Khi lời gọi hệ thống *ioctl* được thực thi trên một socket, số hiệu lệnh (command number) là một trong các ký hiệu được định nghĩa trong *<linux/sockios.h>*, và hàm *sock\_ioctl* gọi trực tiếp một hàm cụ thể theo giao thức (trong đó "giao thức" đề cập đến giao thức mạng chính đang được sử dụng, ví dụ như IP hoặc AppleTalk).

Bất kỳ lệnh *ioctl* nào không được nhận diện bởi tầng giao thức sẽ được chuyển tiếp đến tầng thiết bị (device layer). Các lệnh *ioctl* liên quan đến thiết bị này chấp nhận tham số thứ ba từ không gian người dùng (user space), một cấu trúc `struct ifreq*`. Cấu trúc này được định nghĩa trong *<linux/if.h>*. Các lệnh SIOCSIFADDR và SIOCSIFMAP thực tế hoạt động trên cấu trúc ifreq. Tham số bổ sung cho SIOCSIFMAP, mặc dù được định nghĩa là ifmap, nhưng thực chất chỉ là một trường của ifreq.

Ngoài việc sử dụng các lời gọi được tiêu chuẩn hóa, mỗi giao diện có thể tự định nghĩa các lệnh *ioctl* của riêng mình. Giao diện *plip*, ví dụ, cho phép giao diện sửa đổi các giá trị thời gian chờ (timeout values) nội bộ của nó thông qua *ioctl*. Việc triển khai *ioctl* cho các socket nhận diện 16 lệnh là riêng tư (private) đối với giao diện: từ SIOCDEVPRIVATE đến SIOCDEVPRIVATE+15.\*

Khi một trong những lệnh này được nhận diện, dev->do\_ioctl được gọi trong trình điều khiển giao diện (interface driver) có liên quan. Hàm này nhận cùng con trỏ `struct ifreq*` mà hàm *ioctl* vạn năng sử dụng:

```c

int (*do_ioctl)(struct net_device *dev, struct ifreq *ifr, int cmd);

```

Con trỏ ifr trỏ đến một địa chỉ trong không gian nhân hệ điều hành (kernel-space address) lưu giữ một bản sao của cấu trúc được truyền bởi người dùng. Sau khi *do\_ioctl* trả về, cấu trúc này được sao chép trở lại không gian người dùng (user space); do đó, trình điều khiển có thể sử dụng các lệnh riêng tư (private commands) để cả nhận và trả về dữ liệu.

Các lệnh cụ thể theo thiết bị (device-specific commands) có thể chọn sử dụng các trường trong `struct ifreq`, nhưng chúng đã mang ý nghĩa chuẩn hóa sẵn, và khó có khả năng trình điều khiển có thể tùy chỉnh cấu trúc này theo nhu cầu của nó. Trường ifr\_data là một mục caddr\_t (một con trỏ) nhằm mục đích được sử dụng cho các nhu cầu đặc thù của thiết bị. Trình điều khiển và chương trình được sử dụng để gọi các lệnh *ioctl* của nó phải thống nhất với nhau về việc sử dụng ifr\_data. Ví dụ, *pppstats* sử dụng các lệnh cụ thể theo thiết bị để trích xuất thông tin từ trình điều khiển giao diện *ppp*.

Lưu ý rằng, theo *<linux/sockios.h>*, các lệnh `SIOCDEVPRIVATE` đã lỗi thời (deprecated). Tuy nhiên, điều gì sẽ thay thế chúng vẫn chưa rõ ràng, và rất nhiều trình điều khiển (driver) trong cây mã nguồn (in-tree) vẫn đang sử dụng chúng.

Việc minh họa một cài đặt của hàm `do_ioctl` ở đây là không cần thiết, nhưng với các thông tin trong chương này và các ví dụ trong kernel, bạn hoàn toàn có thể tự viết một hàm khi cần thiết. Tuy nhiên, xin lưu ý rằng bản cài đặt trong *plip* đang sử dụng `ifr_data` không đúng cách và không nên được dùng làm ví dụ cho việc cài đặt `ioctl`.

## Thông tin Thống kê (Statistical Information)
Phương thức cuối cùng mà một driver cần có là `get_stats`. Phương thức này trả về một con trỏ tới các số liệu thống kê của thiết bị. Việc cài đặt nó khá đơn giản; đoạn mã được minh họa dưới đây vẫn hoạt động ngay cả khi có nhiều giao diện (interface) được quản lý bởi cùng một driver, bởi vì các số liệu thống kê được lưu trữ bên trong cấu trúc dữ liệu của thiết bị (device data structure).

```

struct net_device_stats *snull_stats(struct net_device *dev)
{
struct snull_priv *priv = netdev_priv(dev);
return &priv->stats;
}

```

Công việc thực sự cần thiết để trả về các số liệu thống kê có ý nghĩa sẽ được phân bổ xuyên suốt driver, nơi các trường (field) khác nhau được cập nhật. Danh sách sau đây cho thấy các trường thú vị nhất trong cấu trúc `struct net_device_stats`:

```

unsigned long rx_packets;
unsigned long tx_packets;

```

Tổng số gói tin đến và đi (incoming and outgoing packets) được truyền thành công bởi giao diện.

```

unsigned long rx_bytes;
unsigned long tx_bytes;

```

Số byte được nhận và truyền bởi giao diện.

```

unsigned long rx_errors;
unsigned long tx_errors;

```

Số lượng các lần nhận và truyền bị lỗi. Có vô số vấn đề có thể xảy ra trong quá trình truyền gói tin, và cấu trúc `net_device_stats` bao gồm sáu bộ đếm dành riêng cho các lỗi nhận và năm bộ đếm cho các lỗi truyền. Hãy tham khảo *<linux/netdevice.h>* để xem danh sách đầy đủ. Nếu có thể, driver của bạn nên duy trì các số liệu thống kê lỗi chi tiết, bởi vì chúng cực kỳ hữu ích cho các quản trị viên hệ thống (system administrator) khi cố gắng khắc phục sự cố.

```

unsigned long rx_dropped;
unsigned long tx_dropped;

```

Số lượng gói tin bị hủy (dropped) trong quá trình nhận và truyền. Các gói tin bị hủy khi không có sẵn bộ nhớ (memory) cho dữ liệu gói tin. `tx_dropped` hiếm khi được sử dụng.

unsigned long collisions;

Số lượng các vụ xung đột (collision) do tắc nghẽn trên đường truyền.

unsigned long multicast;

Số lượng gói tin multicast nhận được.

Cần nhắc lại rằng phương thức `get_stats` có thể được gọi tại bất kỳ thời điểm nào—ngay cả khi giao diện đang ngừng hoạt động (down)—vì vậy driver phải giữ lại thông tin thống kê chừng nào cấu trúc `net_device` còn tồn tại.

## Multicast
Một gói tin *multicast* là gói tin mạng được định hướng để nhận bởi nhiều hơn một host, nhưng không phải tất cả các host. Chức năng này đạt được bằng cách gán các địa chỉ phần cứng đặc biệt cho các nhóm host. Các gói tin hướng đến một trong các địa chỉ đặc biệt đó phải được nhận bởi tất cả các host trong nhóm đó. Trong trường hợp Ethernet, một địa chỉ multicast có bit ít quan trọng nhất (least significant bit) của octet địa chỉ đầu tiên được thiết lập trong địa chỉ đích, trong khi mọi bo mạch thiết bị đều có bit đó được xóa (clear) trong địa chỉ phần cứng của chính nó.

Phần phức tạp trong việc xử lý các nhóm host và địa chỉ phần cứng được thực hiện bởi các ứng dụng và kernel, và driver giao diện không cần phải bận tâm đến những vấn đề này.

Việc truyền các gói tin multicast là một bài toán đơn giản vì chúng trông giống hệt như bất kỳ gói tin nào khác. Giao diện truyền chúng qua môi trường truyền thông mà không cần xem xét địa chỉ đích. Kernel mới là bên phải gán một địa chỉ đích phần cứng chính xác; phương thức thiết bị `hard_header`, nếu được định nghĩa, không cần phải nhìn vào dữ liệu mà nó sắp xếp.

Kernel đảm nhận công việc theo dõi những địa chỉ multicast nào đang được quan tâm tại bất kỳ thời điểm nào. Danh sách này có thể thay đổi thường xuyên, vì nó phụ thuộc vào các ứng dụng đang chạy tại thời điểm đó và sự quan tâm của người dùng. Công việc của driver là chấp nhận danh sách các địa chỉ multicast đang được quan tâm và chuyển đến kernel bất kỳ gói tin nào được gửi đến các địa chỉ đó. Cách driver cài đặt danh sách multicast phụ thuộc phần lớn vào cách phần cứng bên dưới hoạt động. Thông thường, phần cứng thuộc một trong ba loại sau đối với multicast:

• Các giao diện không thể xử lý multicast. Các giao diện này hoặc là nhận các gói tin được hướng cụ thể đến địa chỉ phần cứng của chúng (cộng với các gói tin broadcast), hoặc là nhận mọi gói tin. Chúng chỉ có thể nhận các gói tin multicast bằng cách nhận mọi gói tin, do đó có khả năng làm quá tải hệ điều hành với một số lượng lớn các gói tin "không quan tâm". Bạn thường không coi các giao diện này là có khả năng hỗ trợ multicast, và driver sẽ không thiết lập cờ `IFF_MULTICAST` trong `dev->flags`.

Các giao diện điểm-điểm (point-to-point) là một trường hợp đặc biệt vì chúng luôn nhận mọi gói tin mà không thực hiện bất kỳ bộ lọc phần cứng nào.

- Các giao diện có thể phân biệt gói tin multicast với các gói tin khác (host-to-host hoặc broadcast). Các giao diện này có thể được chỉ thị để nhận mọi gói tin multicast và để phần mềm xác định xem địa chỉ đó có đáng quan tâm đối với host này hay không. Chi phí phát sinh (overhead) trong trường hợp này là có thể chấp nhận được, bởi vì số lượng gói tin multicast trên một mạng thông thường là thấp.

- Các giao diện (interfaces) có khả năng thực hiện việc phát hiện phần cứng (hardware detection) đối với các địa chỉ multicast. Các giao diện này có thể được truyền một danh sách các địa chỉ multicast để nhận gói tin và bỏ qua các gói tin multicast khác. Đây là trường hợp tối ưu nhất đối với kernel, bởi vì nó không làm lãng phí thời gian của bộ xử lý (processor time) để loại bỏ các gói tin "không quan tâm" do giao diện nhận được.

Kernel cố gắng khai thác các khả năng của các giao diện cấp cao bằng cách hỗ trợ lớp thiết bị thứ ba — loại linh hoạt nhất — ở mức tốt nhất có thể. Do đó, kernel sẽ thông báo cho driver bất cứ khi nào danh sách các địa chỉ multicast hợp lệ thay đổi, đồng thời truyền danh sách mới này cho driver để nó có thể cập nhật bộ lọc phần cứng (hardware filter) theo thông tin mới.

## Hỗ trợ Multicast của Kernel
Hỗ trợ cho các gói tin multicast bao gồm một số thành phần: một phương thức thiết bị (device method), một cấu trúc dữ liệu (data structure) và các cờ thiết bị (device flags):

```c

void (*dev->set_multicast_list)(struct net_device *dev);

```

Phương thức thiết bị được gọi bất cứ khi nào danh sách các địa chỉ máy (machine addresses) liên kết với thiết bị thay đổi. Nó cũng được gọi khi `dev->flags` bị sửa đổi, bởi vì một số cờ (ví dụ: `IFF_PROMISC`) cũng có thể yêu cầu bạn cấu hình lại bộ lọc phần cứng. Phương thức nhận một con trỏ trỏ tới `struct net_device` làm tham số và trả về `void`. Một driver không quan tâm đến việc thực thi phương thức này có thể để trường này ở trạng thái `NULL`.

```c

struct dev_mc_list *dev->mc_list;

```

Một danh sách liên kết (linked list) chứa tất cả các địa chỉ multicast liên kết với thiết bị. Định nghĩa thực tế của cấu trúc này được giới thiệu ở phần cuối của mục này.

```c

int dev->mc_count;

```

Số lượng các phần tử trong danh sách liên kết. Thông tin này có phần dư thừa, nhưng việc kiểm tra `mc_count` so với 0 là một phím tắt hữu ích để kiểm tra danh sách.

`IFF_MULTICAST`

Trừ khi driver thiết lập cờ này trong `dev->flags`, giao diện sẽ không được yêu cầu xử lý các gói tin multicast. Tuy nhiên, kernel vẫn gọi phương thức *set_multicast_list* của driver khi `dev->flags` thay đổi, bởi vì danh sách multicast có thể đã thay đổi trong khi giao diện không hoạt động.

`IFF_ALLMULTI`

Cờ được thiết lập trong `dev->flags` bởi phần mềm mạng (networking software) nhằm ra lệnh cho driver lấy tất cả các gói tin multicast từ mạng. Điều này xảy ra khi định tuyến multicast (multicast routing) được bật. Nếu cờ này được thiết lập, `dev->mc_list` không nên được sử dụng để lọc các gói tin multicast.

#### `IFF_PROMISC`

Cờ được thiết lập trong `dev->flags` khi giao diện được đưa vào chế độ promiscuous (chế độ tạp nham/nhận tất cả). Mọi gói tin đều phải được giao diện tiếp nhận, độc lập với `dev->mc_list`.

Phần thông tin cuối cùng mà nhà phát triển driver cần biết là định nghĩa của `struct dev_mc_list`, nằm trong *<linux/netdevice.h>*:

```c

struct dev_mc_list {
struct dev_mc_list *next; /* Địa chỉ tiếp theo trong danh sách */
__u8 dmi_addr[MAX_ADDR_LEN]; /* Địa chỉ phần cứng */
unsigned char dmi_addrlen; /* Độ dài địa chỉ */
int dmi_users; /* Số lượng người dùng */
int dmi_gusers; /* Số lượng nhóm */
};

```

Vì multicast và địa chỉ phần cứng độc lập với việc truyền gói tin thực tế, cấu trúc này có thể di chuyển (portable) qua các cài đặt mạng khác nhau, và mỗi địa chỉ được định danh bằng một chuỗi các octet và độ dài, giống như `dev->dev_addr`.

## Một cài đặt tiêu biểu (Typical Implementation)
Cách tốt nhất để mô tả thiết kế của *set_multicast_list* là trình bày một số đoạn mã giả (pseudocode).

Hàm sau đây là một cài đặt tiêu biểu của hàm trong một driver đầy đủ tính năng (full-featured - ff). Driver này được coi là đầy đủ tính năng vì giao diện mà nó điều khiển có một bộ lọc gói tin phần cứng phức tạp, có thể chứa một bảng các địa chỉ multicast sẽ được nhận bởi host này. Kích thước tối đa của bảng là `FF_TABLE_SIZE`.

Tất cả các hàm có tiền tố `ff_` là các hàm giữ chỗ (placeholders) cho các thao tác đặc thù của phần cứng:

```c

void ff_set_multicast_list(struct net_device *dev)
{
struct dev_mc_list *mcptr;
if (dev->flags & IFF_PROMISC) {
ff_get_all_packets( );
return;
}
/* Nếu có nhiều địa chỉ hơn mức chúng ta xử lý, hãy lấy tất cả các gói tin
multicast và lọc chúng ở tầng phần mềm (software). */
if (dev->flags & IFF_ALLMULTI || dev->mc_count > FF_TABLE_SIZE) {
ff_get_all_multicast_packets( );
return;
}
/* Không có multicast? Chỉ nhận các gói tin của riêng chúng ta */
if (dev->mc_count == 0) {

```

```c

ff_get_only_own_packets( );
return;
}
/* Lưu tất cả các địa chỉ multicast vào bộ lọc phần cứng */
ff_clear_mc_list( );
for (mc_ptr = dev->mc_list; mc_ptr; mc_ptr = mc_ptr->next)
ff_store_mc_address(mc_ptr->dmi_addr);
ff_get_packets_in_multicast_list( );
}

```

Cài đặt này có thể được đơn giản hóa nếu giao diện không thể lưu trữ bảng multicast trong bộ lọc phần cứng cho các gói tin đến. Trong trường hợp đó, `FF_TABLE_SIZE` giảm xuống 0 và bốn dòng mã cuối cùng là không cần thiết.

Như đã đề cập trước đó, ngay cả các giao diện không thể xử lý các gói tin multicast cũng cần thực thi phương thức *set_multicast_list* để nhận thông báo về các thay đổi trong `dev->flags`. Cách tiếp cận này có thể được gọi là cài đặt "không có tính năng" (nonfeatured - nf). Cài đặt này rất đơn giản, như được minh họa bằng đoạn mã sau:

```c

void nf_set_multicast_list(struct net_device *dev)
{
if (dev->flags & IFF_PROMISC)
nf_get_all_packets( );
else
nf_get_only_own_packets( );
}

```

Việc triển khai `IFF_PROMISC` là rất quan trọng, bởi vì nếu không, người dùng sẽ không thể chạy *tcpdump* hoặc bất kỳ trình phân tích mạng (network analyzer) nào khác. Mặt khác, nếu giao diện chạy trên liên kết điểm-điểm (point-to-point link), thì hoàn toàn không cần phải triển khai `set_multicast_list`, vì người dùng dù sao cũng nhận được mọi gói tin (packet).

## Một số chi tiết khác
Phần này đề cập đến một số chủ đề khác có thể hữu ích cho các tác giả viết trình điều khiển mạng (network driver). Trong mỗi trường hợp, chúng tôi đơn giản cố gắng hướng dẫn bạn đi đúng hướng. Để có cái nhìn toàn diện về chủ đề này, bạn có thể sẽ cần dành thời gian nghiên cứu kỹ mã nguồn Linux Kernel (kernel source).

## Hỗ trợ Giao diện Độc lập Phương tiện (Media Independent Interface Support)
Media Independent Interface (hoặc MII) là một chuẩn IEEE 802.3 mô tả cách các bộ thu phát Ethernet (Ethernet transceiver) có thể giao tiếp với các bộ điều khiển mạng (network controller); nhiều sản phẩm trên thị trường tuân thủ giao diện này. Nếu bạn đang viết một trình điều khiển cho bộ điều khiển tuân thủ MII, nhân Linux (kernel) cung cấp một tầng hỗ trợ MII chung (generic MII support layer) có thể giúp công việc của bạn trở nên dễ dàng hơn.

Để sử dụng tầng MII chung, bạn nên bao gồm tệp tiêu đề *<linux/mii.h>*. Bạn cần điền thông tin vào cấu trúc `mii_if_info` với các thông tin về ID vật lý của bộ thu phát, chế độ song công hoàn toàn (full duplex) có đang được áp dụng hay không, v.v. Ngoài ra, cần có hai phương thức cho cấu trúc `mii_if_info`:

```

int (*mdio_read) (struct net_device *dev, int phy_id, int location);
void (*mdio_write) (struct net_device *dev, int phy_id, int location, int val);

```

Như bạn có thể dự đoán, các phương thức này phải thực hiện việc giao tiếp với giao diện MII cụ thể của bạn.

Mã nguồn MII chung cung cấp một tập hợp các hàm để truy vấn và thay đổi chế độ hoạt động của bộ thu phát; nhiều hàm trong số này được thiết kế để hoạt động với tiện ích *ethtool* (được mô tả trong phần tiếp theo). Hãy xem trong *<linux/mii.h>* và *drivers/net/mii.c* để biết thêm chi tiết.

## Hỗ trợ Ethtool (Ethtool Support)
*Ethtool* là một tiện ích được thiết kế nhằm cung cấp cho quản trị viên hệ thống (system administrator) khả năng kiểm soát lớn đối với hoạt động của các giao diện mạng. Với *ethtool*, có thể kiểm soát các tham số giao diện khác nhau bao gồm tốc độ, loại phương tiện, chế độ song công (duplex operation), thiết lập vòng đệm DMA (DMA ring setup), kiểmm tra tổng phần cứng (hardware checksumming), hoạt động đánh thức qua mạng Wake-on-LAN, v.v., nhưng chỉ khi *ethtool* được hỗ trợ bởi trình điều khiển. *Ethtool* có thể được tải xuống từ *http://sf.net/projects/ gkernel/*.

Các khai báo liên quan đến việc hỗ trợ *ethtool* có thể được tìm thấy trong *<linux/ethtool.h>*. Trọng tâm của nó là một cấu trúc kiểu `ethtool_ops`, chứa tổng cộng 24 phương thức khác nhau để hỗ trợ *ethtool*. Hầu hết các phương thức này tương đối trực quan; hãy xem *<linux/ethtool.h>* để biết chi tiết. Nếu trình điều khiển của bạn đang sử dụng tầng MII, bạn có thể sử dụng `mii_ethtool_gset` và `mii_ethtool_sset` để lần lượt triển khai các phương thức `get_settings` và `set_settings`.

Để *ethtool* hoạt động với thiết bị của bạn, bạn phải đặt một con trỏ trỏ đến cấu trúc `ethtool_ops` của mình vào bên trong cấu trúc `net_device`. Macro `SET_ETHTOOL_OPS` (được định nghĩa trong *<linux/netdevice.h>*) nên được sử dụng cho mục đích này. Lưu ý rằng các phương thức *ethtool* của bạn vẫn có thể được gọi ngay cả khi giao diện đang ở trạng thái ngắt (down).

## Netpoll
"Netpoll" là một phần bổ sung tương đối muộn (2.6.5) vào ngăn xếp mạng (network stack); mục đích của nó là cho phép nhân Linux gửi và nhận các gói tin trong các tình huống mà các hệ thống con mạng và I/O đầy đủ có thể không khả dụng. Nó được sử dụng cho các tính năng như bảng điều khiển mạng từ xa (remote network console) và gỡ lỗi nhân từ xa (remote kernel debugging). Việc hỗ trợ netpoll trong trình điều khiển của bạn hoàn toàn không bắt buộc, nhưng nó có thể làm cho thiết bị của bạn hữu ích hơn trong một số tình huống. Việc hỗ trợ netpoll cũng tương đối dễ dàng trong hầu hết các trường hợp.

Các trình điều khiển triển khai netpoll nên thực thi phương thức `poll_controller`. Nhiệm vụ của nó là theo kịp bất kỳ sự kiện nào có thể đang diễn ra trên bộ điều khiển khi vắng bóng các ngắt thiết bị (device interrupt). Hầu như tất cả các phương thức `poll_controller` đều có dạng sau:

```

void my_poll_controller(struct net_device *dev)
{
disable_device_interrupts(dev);
call_interrupt_handler(dev->irq, dev, NULL);
reenable_device_interrupts(dev);
}

```

Phương thức `poll_controller`, về bản chất, chỉ đơn giản là mô phỏng các ngắt từ thiết bị được chỉ định.

## Tra cứu nhanh (Quick Reference)
Phần này cung cấp tài liệu tham khảo cho các khái niệm được giới thiệu trong chương này. Nó cũng giải thích vai trò của từng tệp tiêu đề (header file) mà một trình điều khiển cần phải bao gồm (`include`). Tuy nhiên, danh sách các trường trong các cấu trúc `net_device` và `sk_buff` sẽ không được lặp lại ở đây.

```c

## include <linux/netdevice.h>

```

Tệp tiêu đề chứa các định nghĩa về `struct net_device` và `struct net_device_stats`, đồng thời bao gồm một vài tệp tiêu đề khác cần thiết cho các trình điều khiển mạng.

```

struct net_device *alloc_netdev(int sizeof_priv, char *name, void
(*setup)(struct net_device *);
struct net_device *alloc_etherdev(int sizeof_priv);
void free_netdev(struct net_device *dev);
Các hàm dùng để cấp phát và giải phóng các cấu trúc net_device.
int register_netdev(struct net_device *dev);
void unregister_netdev(struct net_device *dev);
Đăng ký và hủy đăng ký một thiết bị mạng.
void *netdev_priv(struct net_device *dev);
Một hàm truy xuất con trỏ trỏ đến vùng dữ liệu riêng tư của trình điều khiển (driver-private area)
bên trong cấu trúc thiết bị mạng.
struct net_device_stats;
Một cấu trúc lưu trữ các số liệu thống kê về thiết bị.
netif_start_queue(struct net_device *dev);
netif_stop_queue(struct net_device *dev);
netif_wake_queue(struct net_device *dev);
Các hàm điều khiển việc chuyển các gói tin đến trình điều khiển để truyền đi. Không

```

các gói tin được truyền đi cho đến khi *netif\_start\_queue* được gọi. *netif\_stop\_queue* tạm dừng việc truyền, và *netif\_wake\_queue* khởi động lại hàng đợi (queue) đồng thời đánh thức (poke) tầng mạng (network layer) để tiếp tục truyền các gói tin.

```

skb_shinfo(struct sk_buff *skb);

```

Một macro cung cấp quyền truy cập vào phần "shared info" (thông tin chia sẻ) của một bộ đệm gói tin (packet buffer).

```

void netif_rx(struct sk_buff *skb);

```

Hàm có thể được gọi (bao gồm cả trong thời điểm xử lý ngắt - interrupt time) để thông báo cho kernel rằng một gói tin đã được nhận và đóng gói (encapsulated) vào một bộ đệm socket (socket buffer).

```

void netif_rx_schedule(dev);

```

Hàm thông báo cho kernel rằng các gói tin đã sẵn sàng và việc thăm dò (polling) nên được bắt đầu trên giao diện (interface); hàm này chỉ được sử dụng bởi các trình điều khiển (driver) tương thích với NAPI.

```

int netif_receive_skb(struct sk_buff *skb);
void netif_rx_complete(struct net_device *dev);

```

Các hàm chỉ nên được sử dụng bởi các driver tương thích với NAPI. *netif\_receive\_skb* là hàm tương đương trong NAPI của *netif\_rx*; nó chuyển một gói tin vào kernel. Khi một driver tương thích với NAPI đã cạn kiệt nguồn gói tin nhận được, nó nên kích hoạt lại ngắt và gọi *netif\_rx\_complete* để dừng việc thăm dò (polling).

```c

## include <linux/if.h>

```

Được bao gồm (include) bởi *netdevice.h*, tệp này khai báo các cờ giao diện (interface flags - các macro IFF\_) và cấu trúc `struct ifmap`, đóng vai trò quan trọng trong việc triển khai *ioctl* cho các driver mạng.

```

void netif_carrier_off(struct net_device *dev);
void netif_carrier_on(struct net_device *dev);
int netif_carrier_ok(struct net_device *dev);

```

Hai hàm đầu tiên có thể được sử dụng để thông báo cho kernel biết liệu tín hiệu sóng mang (carrier signal) hiện có mặt trên giao diện được chỉ định hay không. *netif\_carrier\_ok* kiểm tra trạng thái sóng mang như được phản ánh trong cấu trúc thiết bị (device structure).

```

## include <linux/if_ether.h>

ETH_ALEN
ETH_P_IP
struct ethhdr;

```

Được bao gồm bởi *netdevice.h*, *if\_ether.h* định nghĩa tất cả các macro ETH\_ được sử dụng để biểu diễn độ dài octet (chẳng hạn như độ dài địa chỉ) và các giao thức mạng (chẳng hạn như IP). Nó cũng định nghĩa cấu trúc `ethhdr`.

```c

## include <linux/skbuff.h>

```

Định nghĩa của `struct sk_buff` và các cấu trúc liên quan, cũng như một số hàm inline để thao tác trên các bộ đệm (buffer). Tệp tiêu đề này được bao gồm bởi *netdevice.h*.

```

struct sk_buff *alloc_skb(unsigned int len, int priority);
struct sk_buff *dev_alloc_skb(unsigned int len);
void kfree_skb(struct sk_buff *skb);
void dev_kfree_skb(struct sk_buff *skb);
void dev_kfree_skb_irq(struct sk_buff *skb);
void dev_kfree_skb_any(struct sk_buff *skb);
Các hàm xử lý việc cấp phát (allocation) và giải phóng (freeing) bộ đệm socket. Các driver
thông thường nên sử dụng các biến thể có tiền tố dev_, được thiết kế cho mục đích đó.
unsigned char *skb_put(struct sk_buff *skb, int len);
unsigned char *__skb_put(struct sk_buff *skb, int len);
unsigned char *skb_push(struct sk_buff *skb, int len);
unsigned char *__skb_push(struct sk_buff *skb, int len);
Các hàm thêm dữ liệu vào một skb; skb_put đặt dữ liệu vào cuối skb,
trong khi skb_push đặt nó vào phần đầu. Các phiên bản thông thường thực hiện kiểm tra
để đảm bảo rằng có đủ không gian trống; các phiên bản có hai dấu gạch dưới (double-underscore) bỏ qua
các bài kiểm tra đó.
int skb_headroom(struct sk_buff *skb);
int skb_tailroom(struct sk_buff *skb);
void skb_reserve(struct sk_buff *skb, int len);
Các hàm thực hiện quản lý không gian bên trong một skb. skb_headroom và
skb_tailroom cho biết có bao nhiêu dung lượng trống ở phần đầu và phần cuối, tương ứng,
của một skb. skb_reserve có thể được sử dụng để dành sẵn không gian ở phần đầu của
skb, vốn phải đang trống.
unsigned char *skb_pull(struct sk_buff *skb, int len);
skb_pull "gỡ bỏ" dữ liệu khỏi một skb bằng cách điều chỉnh các con trỏ nội bộ.
int skb_is_nonlinear(struct sk_buff *skb);
Hàm trả về giá trị chân lý (true) nếu skb này được chia thành nhiều phân đoạn (fragment)
cho hoạt động I/O phân tán/tập trung (scatter/gather I/O).
int skb_headlen(struct sk_buff *skb);
Trả về độ dài của phân đoạn đầu tiên của skb—phần được trỏ tới bởi skb->data.
void *kmap_skb_frag(skb_frag_t *frag);
void kunmap_skb_frag(void *vaddr);
Các hàm cung cấp quyền truy cập trực tiếp vào các phân đoạn bên trong một skb phi tuyến tính (nonlinear skb).

## include <linux/etherdevice.h>

void ether_setup(struct net_device *dev);
Hàm thiết lập hầu hết các phương thức thiết bị (device methods) thành các cài đặt chung
cho các driver Ethernet. Nó cũng thiết lập dev->flags và gán tên ethx
tiếp theo có sẵn cho dev->name nếu ký tự đầu tiên trong tên là khoảng trắng hoặc ký tự

```

NULL.

unsigned short eth\_type\_trans(struct sk\_buff \*skb, struct net\_device \*dev); Khi một giao diện Ethernet nhận được một gói tin, hàm này có thể được gọi để thiết lập `skb->pkt_type`. Giá trị trả về là một số hiệu giao thức (protocol number) thường được lưu trữ trong `skb->protocol`.

## include <linux/sockios.h>

SIOCDEVPRIVATE

Lệnh đầu tiên trong số 16 lệnh *ioctl* có thể được triển khai bởi mỗi driver để phục vụ mục đích riêng của nó. Tất cả các lệnh mạng *ioctl* đều được định nghĩa trong *sockios.h*.

## include <linux/mii.h>

struct mii\_if\_info;

Các khai báo và một cấu trúc hỗ trợ các trình điều khiển thiết bị (device drivers) thực thi tiêu chuẩn MII (Media Independent Interface).

## include <linux/ethtool.h>

struct ethtool\_ops;

Các khai báo và cấu trúc cho phép các thiết bị hoạt động với tiện ích (utility) *ethtool*.
