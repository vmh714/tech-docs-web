# Chương 58: Socket: Cơ bản về mạng TCP/IP (Sockets: Fundamentals of TCP/IP Networks)

Chương này cung cấp phần giới thiệu về các khái niệm mạng máy tính và các giao thức mạng TCP/IP. Việc thấu hiểu các chủ đề này là cần thiết để sử dụng hiệu quả Internet domain socket (ổ cắm miền Internet), được mô tả trong chương tiếp theo.

Bắt đầu từ chương này, chúng tôi sẽ đề cập đến các tài liệu Yêu cầu Bình luận (Request for Comments - RFC). Mỗi giao thức mạng được thảo luận trong cuốn sách này đều được mô tả một cách chính thức trong một tài liệu RFC. Chúng tôi cung cấp thêm thông tin về các RFC, cũng như danh sách các RFC có liên quan đặc biệt đến tài liệu được đề cập trong cuốn sách này, tại Mục [58.7](#page-44-0).

## 58.1 Mạng liên kết (Internets)

Một mạng liên kết (internetwork) hay thường gọi là internet (viết thường chữ i), kết nối các mạng máy tính khác nhau, cho phép các host (máy chủ/nói chung là thiết bị đầu cuối) trên tất cả các mạng có thể giao tiếp với nhau. Nói cách khác, một internet là một mạng lưới gồm các mạng máy tính. Thuật ngữ subnetwork (mạng con), hay subnet, được dùng để chỉ một trong các mạng cấu thành nên một internet. Mục tiêu của một internet là ẩn đi các chi tiết về các mạng vật lý khác nhau nhằm cung cấp một kiến trúc mạng thống nhất cho tất cả các host trên các mạng được kết nối. Ví dụ, điều này có nghĩa là một định dạng địa chỉ duy nhất được sử dụng để nhận dạng tất cả các host trong internet.

Mặc dù có nhiều giao thức liên kết mạng khác nhau đã được phát triển, TCP/IP đã trở thành bộ giao thức chiếm ưu thế, thậm chí thay thế cả các giao thức mạng độc quyền (proprietary) vốn trước đây rất phổ biến trên các mạng cục bộ (local area networks) và mạng diện rộng (wide area networks). Thuật ngữ Internet (viết hoa chữ I) được dùng để chỉ mạng TCP/IP kết nối hàng triệu máy tính trên toàn cầu.

Việc triển khai TCP/IP rộng rãi đầu tiên xuất hiện cùng với 4.2BSD vào năm 1983. Một số bản triển khai TCP/IP có nguồn gốc trực tiếp từ mã nguồn BSD; các bản triển khai khác, bao gồm cả bản triển khai trên Linux, được viết hoàn toàn mới từ đầu (from scratch), lấy hoạt động của mã nguồn BSD làm tiêu chuẩn tham chiếu để xác định cách thức hoạt động của TCP/IP.

> [!NOTE]
> TCP/IP xuất phát từ một dự án do Cơ quan Nghiên cứu Tiên tiến Quốc phòng Bộ Quốc phòng Hoa Kỳ tài trợ (ARPA, sau này là DARPA, với chữ D viết tắt của Defense - Quốc phòng) nhằm phát triển một kiến trúc mạng máy tính để sử dụng trong ARPANET, một mạng diện rộng thời kỳ đầu. Trong suốt những năm 1970, một họ giao thức mới đã được thiết kế cho ARPANET. Về mặt chính xác, các giao thức này được gọi là bộ giao thức Internet DARPA, nhưng thông thường chúng được gọi là bộ giao thức TCP/IP, hoặc đơn giản là TCP/IP.

> [!NOTE]
> Trang web http://www.isoc.org/internet/history/brief.shtml cung cấp lịch sử ngắn gọn về Internet và TCP/IP.

[Hình 58-1](#page-31-0) minh họa một internet đơn giản. Trong sơ đồ này, máy tekapo là một ví dụ về một router (bộ định tuyến), một máy tính có chức năng kết nối một subnet này với một subnet khác, truyền dữ liệu giữa chúng. Ngoài việc hiểu giao thức internet đang được sử dụng, một router cũng phải hiểu các giao thức tầng liên kết dữ liệu (data-link-layer protocols) (có thể) khác nhau được sử dụng trên mỗi subnet mà nó kết nối.

Một router có nhiều giao diện mạng (network interface), mỗi giao diện tương ứng với một subnet mà nó kết nối. Thuật ngữ tổng quát hơn là multihomed host (host đa giao diện) được dùng cho bất kỳ host nào—không nhất thiết phải là router—có nhiều giao diện mạng. (Một cách diễn đạt khác về router là nó là một multihomed host có chức năng chuyển tiếp các gói tin (packet) từ subnet này sang subnet khác). Một multihomed host có một địa chỉ mạng khác nhau cho mỗi giao diện của nó (tức là một địa chỉ khác nhau trên mỗi subnet mà nó kết nối).

![](_page_31_Figure_6.jpeg)

**Hình 58-1:** Một internet sử dụng router để kết nối hai mạng

## 58.2 Các Giao thức Mạng và Các Tầng (Networking Protocols and Layers)

Một giao thức mạng là một tập hợp các quy tắc xác định cách thức thông tin được truyền đi qua một mạng. Các giao thức mạng thường được tổ chức thành một chuỗi các tầng (layers), với mỗi tầng xây dựng dựa trên tầng nằm bên dưới nó để bổ sung các tính năng được cung cấp cho các tầng cao hơn.

*Bộ giao thức TCP/IP (TCP/IP protocol suite)* là một giao thức mạng có cấu trúc phân tầng (Hình 58-2). Nó bao gồm *Giao thức Internet (Internet Protocol - IP)* và các giao thức khác nằm ở các tầng phía trên nó. (Đoạn mã thực thi các tầng này thường được gọi là một *giao thức ngăn xếp (protocol stack)*). Tên gọi TCP/IP xuất phát từ thực tế là *Giao thức Điều khiển Truyền vận (Transmission Control Protocol - TCP)* là giao thức tầng truyền vận (transport-layer) được sử dụng nhiều nhất.

Chúng tôi đã lược bỏ một loạt các giao thức TCP/IP khác khỏi Hình 58-2 vì chúng không liên quan đến chương này. *Giao thức Phân giải Địa chỉ (Address Resolution Protocol - ARP)* liên quan đến việc ánh xạ địa chỉ Internet sang địa chỉ phần cứng (ví dụ: địa chỉ Ethernet). *Giao thức Thông báo Kiểm soát Internet (Internet Control Message Protocol - ICMP)* được sử dụng để truyền tải thông tin lỗi và điều khiển qua mạng. (ICMP được sử dụng bởi chương trình *ping*, thường được dùng để kiểm tra xem một host cụ thể có đang hoạt động và hiển thị trên mạng TCP/IP hay không, và bởi chương trình *traceroute*, dùng để dò tìm đường đi của một gói tin IP qua mạng). *Giao thức Quản lý Nhóm Internet (Internet Group Management Protocol - IGMP)* được sử dụng bởi các host và router hỗ trợ truyền đa hướng (multicasting) các gói dữ liệu IP datagram.

![](_page_32_Figure_2.jpeg)

Hình 58-2: Các giao thức trong bộ giao thức TCP/IP (TCP/IP suite)

Một trong những khái niệm mang lại sức mạnh và sự linh hoạt lớn cho việc phân tầng giao thức (protocol layering) chính là *tính trong suốt* (*transparency*) — mỗi tầng giao thức che chắn cho các tầng cao hơn khỏi hoạt động và độ phức tạp của các tầng thấp hơn. Do đó, ví dụ, một ứng dụng sử dụng TCP chỉ cần sử dụng API socket (sockets API) tiêu chuẩn và biết rằng nó đang sử dụng một dịch vụ truyền tải luồng byte (byte-stream transport service) đáng tin cậy. Nó không cần phải hiểu các chi tiết vận hành của TCP. (Khi xem xét các tùy chọn socket tại Mục 61.9, chúng ta sẽ thấy điều này không phải lúc nào cũng hoàn toàn đúng; đôi khi, một ứng dụng cần phải biết một số chi tiết vận hành của giao thức truyền tải bên dưới.) Ứng dụng cũng không cần phải biết chi tiết vận hành của IP hoặc của tầng liên kết dữ liệu (data-link layer). Từ góc độ của các ứng dụng, chúng trông giống như đang giao tiếp trực tiếp với nhau thông qua API socket, như được minh họa trong [Hình 58-3](#page-34-0), trong đó các đường đứt nét nằm ngang biểu thị các đường truyền thông ảo giữa các thực thể ứng dụng, TCP và IP tương ứng trên hai host.

### Đóng gói (Encapsulation)

Đóng gói là một nguyên tắc quan trọng của giao thức mạng phân tầng. Hình 58-4 cho thấy một ví dụ về việc đóng gói trong các tầng giao thức TCP/IP. Ý tưởng cốt lõi của việc đóng gói là thông tin (ví dụ: dữ liệu ứng dụng, một phân đoạn TCP, hoặc một gói dữ liệu IP datagram) được chuyển từ tầng cao xuống tầng thấp hơn sẽ được tầng thấp hơn coi là dữ liệu mờ (opaque data). Nói cách khác, tầng thấp hơn không cố gắng diễn giải thông tin được gửi từ tầng trên, mà chỉ đơn giản đặt thông tin đó vào bên trong bất kỳ loại gói tin (packet) nào được sử dụng ở tầng thấp hơn và thêm phần tiêu đề (header) đặc trưng của riêng tầng đó trước khi chuyển gói tin xuống tầng thấp hơn tiếp theo. Khi dữ liệu được chuyển ngược từ tầng thấp lên tầng cao, một quá trình giải nén ngược lại sẽ diễn ra.

> [!NOTE]
> Chúng ta không thể hiện điều này trong Hình 58-4, nhưng khái niệm đóng gói cũng mở rộng xuống tầng liên kết dữ liệu, nơi các IP datagram được đóng gói bên trong các khung mạng (network frames). Việc đóng gói cũng có thể mở rộng lên tầng ứng dụng, nơi ứng dụng có thể tự thực hiện việc đóng gói dữ liệu của riêng mình.

## 58.3 Tầng liên kết dữ liệu (The Data-Link Layer)

Tầng thấp nhất trong [Hình 58-2](#page-32-0) là tầng liên kết dữ liệu, bao gồm trình điều khiển thiết bị (device driver) và giao diện phần cứng (card mạng) kết nối với môi trường vật lý bên dưới (ví dụ: đường dây điện thoại, cáp đồng trục, hoặc cáp quang). Tầng liên kết dữ liệu chịu trách nhiệm truyền dữ liệu qua một liên kết vật lý trong mạng.

Để truyền dữ liệu, tầng liên kết dữ liệu đóng gói các datagram từ tầng mạng (network layer) thành các đơn vị gọi là khung (frames). Ngoài dữ liệu cần truyền, mỗi khung bao gồm một phần tiêu đề chứa, ví dụ, địa chỉ đích và kích thước khung. Tầng liên kết dữ liệu truyền các khung qua liên kết vật lý và xử lý các thông báo xác nhận (acknowledgements) từ bên nhận. (Không phải tất cả các tầng liên kết dữ liệu đều sử dụng cơ chế xác nhận). Tầng này có thể thực hiện việc phát hiện lỗi, truyền lại (retransmission) và điều khiển luồng (flow control). Một số tầng liên kết dữ liệu cũng chia các gói tin mạng lớn thành nhiều khung và lắp ráp lại chúng ở phía bên nhận.

Từ góc độ lập trình ứng dụng, chúng ta có thể nhìn chung bỏ qua tầng liên kết dữ liệu, vì tất cả các chi tiết giao tiếp được xử lý trong driver và phần cứng.

Một đặc điểm của tầng liên kết dữ liệu quan trọng đối với cuộc thảo luận của chúng ta về IP là đơn vị truyền dẫn tối đa (Maximum Transmission Unit - MTU). MTU của một tầng liên kết dữ liệu là giới hạn trên mà tầng đó áp đặt lên kích thước của một khung. Các tầng liên kết dữ liệu khác nhau sẽ có các MTU khác nhau.

> [!NOTE]
> Lệnh `netstat -i` hiển thị danh sách các giao diện mạng của hệ thống, cùng với các MTU tương ứng của chúng.

![](_page_34_Figure_0.jpeg)

**Hình 58-3:** Giao tiếp phân tầng thông qua các giao thức TCP/IP

![](_page_34_Figure_2.jpeg)

**Hình 58-4:** Sự đóng gói bên trong các tầng giao thức TCP/IP

## 58.4 Tầng mạng (The Network Layer): IP

Nằm phía trên tầng liên kết dữ liệu là tầng mạng, chịu trách nhiệm phân phối các gói tin (dữ liệu) từ host nguồn đến host đích. Tầng này thực hiện nhiều tác vụ khác nhau, bao gồm:

- chia nhỏ dữ liệu thành các phân đoạn đủ nhỏ để truyền qua tầng liên kết dữ liệu (nếu cần thiết);
- định tuyến (routing) dữ liệu qua liên mạng internet; và
- cung cấp các dịch vụ cho tầng truyền tải (transport layer).

Trong bộ giao thức TCP/IP, giao thức chính ở tầng mạng là IP. Phiên bản IP xuất hiện trong bản cài đặt 4.2BSD là IP phiên bản 4 (IPv4). Vào đầu những năm 1990, một phiên bản sửa đổi của IP đã được thiết kế: IP phiên bản 6 (IPv6). Điểm khác biệt đáng chú ý nhất giữa hai phiên bản là IPv4 xác định các mạng con (subnets) và host sử dụng địa chỉ 32-bit, trong khi IPv6 sử dụng địa chỉ 128-bit, qua đó cung cấp dải địa chỉ lớn hơn nhiều để cấp phát cho các host. Mặc dù IPv4 vẫn là phiên bản IP chiếm ưu thế đang được sử dụng trên Internet, nhưng trong những năm tới, nó sẽ dần được thay thế bởi IPv6. Cả IPv4 và IPv6 đều hỗ trợ các giao thức tầng truyền tải UDP và TCP ở cấp cao hơn (cùng với nhiều giao thức khác).

> [!NOTE]
> Mặc dù không gian địa chỉ (address space) 32-bit về mặt lý thuyết cho phép cấp phát hàng tỷ địa chỉ mạng IPv4, nhưng cách thức cấu trúc và phân bổ các địa chỉ này lại khiến cho số lượng địa chỉ khả dụng trên thực tế thấp hơn rất nhiều. Việc cạn kiệt không gian địa chỉ IPv4 có thể xảy ra là một trong những động lực chính dẫn đến sự ra đời của IPv6.

> [!NOTE]
> Một lịch sử ngắn gọn về IPv6 có thể được tìm thấy tại http://www.laynetworks.com/ IPv6.htm.

> [!NOTE]
> Sự tồn tại của IPv4 và IPv6 đặt ra câu hỏi: "Thế còn IPv5 thì sao?". Chưa từng có phiên bản IPv5 nào như vậy cả. Mỗi phần đầu (header) của IP datagram đều bao gồm một trường số phiên bản 4-bit (do đó, các IPv4 datagram luôn có số 4 trong trường này), và số phiên bản 5 đã được gán cho một giao thức thử nghiệm có tên là Internet Stream Protocol. (Phiên bản 2 của giao thức này, viết tắt là ST-II, được mô tả trong RFC 1819). Được hình thành ban đầu từ những năm 1970, giao thức hướng kết nối (connection-oriented) này được thiết kế để hỗ trợ truyền tải giọng nói (voice), video và mô phỏng phân tán (distributed simulation). Vì số phiên bản IP datagram 5 đã được gán, nên thế hệ kế thừa của IPv4 đã được gán số phiên bản là 6.

[Hình 58-2](#page-32-0) minh họa một loại socket thô (`SOCK_RAW`), cho phép một ứng dụng giao tiếp trực tiếp với tầng IP (IP layer). Chúng tôi không mô tả chi tiết việc sử dụng socket thô, vì hầu hết các ứng dụng đều sử dụng socket thông qua một trong các giao thức tầng giao vận (transport-layer protocols) như TCP hoặc UDP. Socket thô được mô tả trong Chương 28 của [Stevens et al., 2004]. Một ví dụ mang tính hướng dẫn về việc sử dụng socket thô là chương trình `sendip` (http:// www.earth.li/projectpurple/progs/sendip.html), đây là một công cụ điều khiển bằng dòng lệnh (command-line-driven tool) cho phép xây dựng và truyền các IP datagram với nội dung tùy ý (bao gồm các tùy chọn để xây dựng UDP datagram và TCP segment).

### IP truyền tải các datagram

IP truyền dữ liệu dưới dạng các datagram (gói tin). Mỗi datagram được gửi giữa hai host sẽ di chuyển độc lập qua mạng, và có thể đi theo các tuyến đường khác nhau. Một IP datagram bao gồm một phần đầu (header), có kích thước dao động từ 20 đến 60 byte. Phần đầu chứa địa chỉ của host đích (target host), để datagram có thể được định tuyến qua mạng đến đích của nó, và cũng bao gồm địa chỉ nguồn của gói tin, giúp host nhận biết được nguồn gốc của datagram đó.

> [!NOTE]
> Một host gửi có thể giả mạo (spoof) địa chỉ nguồn của một gói tin, và điều này tạo thành cơ sở cho một cuộc tấn công từ chối dịch vụ (denial-of-service attack) TCP được gọi là SYN-flooding. [Lemon, 2002] mô tả chi tiết về cuộc tấn công này và các biện pháp được các bản thực thi TCP hiện đại sử dụng để đối phó với nó.

Một tiến trình cài đặt/thực thi IP (IP implementation) có thể đặt giới hạn trên cho kích thước của các datagram mà nó hỗ trợ. Tất cả các cài đặt IP phải cho phép các datagram có kích thước ít nhất bằng giới hạn được chỉ định bởi kích thước bộ đệm lắp ráp lại tối thiểu (minimum reassembly buffer size) của IP. Trong IPv4, giới hạn này là 576 byte; trong IPv6, nó là 1500 byte.

## IP là giao thức không kết nối (connectionless) và không đáng tin cậy (unreliable)

IP được mô tả là một giao thức không kết nối (connectionless protocol), vì nó không cung cấp khái niệm về một mạch ảo (virtual circuit) kết nối hai host. IP cũng là một giao thức không đáng tin cậy (unreliable protocol): nó nỗ lực hết sức ("best effort") để truyền các datagram từ bên gửi đến bên nhận, nhưng không đảm bảo rằng các gói tin sẽ đến theo đúng thứ tự mà chúng được truyền đi, rằng chúng không bị trùng lặp, hoặc thậm chí không đảm bảo rằng chúng có đến nơi hay không. IP cũng không cung cấp cơ chế khôi phục lỗi (các gói tin bị lỗi phần tiêu đề sẽ âm thầm bị loại bỏ). Tính đáng tin cậy phải được đảm bảo bằng cách sử dụng một giao thức tầng truyền tải (transport-layer protocol) đáng tin cậy (ví dụ: TCP) hoặc được xử lý ngay bên trong ứng dụng.

> [!NOTE]
> IPv4 cung cấp một mã kiểm tra tổng (checksum) cho phần tiêu đề IP, cho phép phát hiện các lỗi trong phần tiêu đề, nhưng không cung cấp bất kỳ cơ chế phát hiện lỗi nào cho dữ liệu được truyền tải bên trong gói tin. IPv6 không cung cấp checksum trong phần tiêu đề IP, mà dựa vào các giao thức tầng cao hơn để cung cấp tính năng kiểm tra lỗi và độ tin cậy theo yêu cầu. (Checksum của UDP là tùy chọn trong IPv4 nhưng thường được bật; checksum của UDP là bắt buộc trong IPv6. Checksum của TCP là bắt buộc đối với cả IPv4 và IPv6.)

> [!NOTE]
> Việc trùng lặp các datagram IP có thể xảy ra do các kỹ thuật được sử dụng bởi một số tầng liên kết dữ liệu (data-link layer) để đảm bảo độ tin cậy, hoặc khi các datagram IP được đóng gói qua đường hầm (tunneled) qua một số mạng không phải TCP/IP có sử dụng cơ chế truyền lại (retransmission).

### IP có thể phân mảnh các datagram (fragment datagrams)

Các datagram IPv4 có kích thước lên tới 65.535 byte. Theo mặc định, IPv6 cho phép các datagram có kích thước lên tới 65.575 byte (40 byte cho phần tiêu đề, 65.535 byte cho dữ liệu) và cung cấp một tùy chọn cho các datagram lớn hơn (được gọi là jumbogram).

Chúng ta đã lưu ý trước đó rằng hầu hết các tầng liên kết dữ liệu (data-link layer) áp đặt giới hạn trên (MTU) đối với kích thước của các khung dữ liệu (data frame). Ví dụ, giới hạn trên này là 1500 byte trên kiến trúc mạng Ethernet thường được sử dụng (tức là nhỏ hơn rất nhiều so với kích thước tối đa của một IP datagram). IP cũng định nghĩa khái niệm về MTU đường đi (path MTU). Đây là mức MTU tối thiểu trên tất cả các tầng liên kết dữ liệu đi qua trên tuyến đường từ nguồn đến đích. (Trên thực tế, MTU của Ethernet thường là MTU tối thiểu trong một đường đi).

Khi một IP datagram lớn hơn MTU, IP sẽ phân mảnh (fragment - chia nhỏ) datagram thành các đơn vị có kích thước phù hợp để truyền qua mạng. Các phân mảnh này sau đó sẽ được lắp ráp lại (reassembled) tại đích cuối cùng để tạo lại datagram ban đầu. (Mỗi phân mảnh IP bản thân nó là một IP datagram chứa một trường bù trừ (offset field) cho biết vị trí của phân mảnh đó trong datagram ban đầu.)

Việc phân mảnh IP diễn ra một cách trong suốt (transparently) đối với các tầng giao thức cao hơn, nhưng dù sao đi nữa, nó thường bị coi là điều không mong muốn ([Kent & Mogul, 1987]). Vấn đề là vì IP không thực hiện việc truyền lại (retransmission), và một datagram chỉ có thể được lắp ráp lại tại đích nếu tất cả các phân mảnh đều đến nơi, nên toàn bộ datagram sẽ không thể sử dụng được nếu bất kỳ phân mảnh nào bị mất hoặc chứa lỗi truyền dẫn. Trong một số trường hợp, điều này có thể dẫn đến tỷ lệ mất dữ liệu đáng kể (đối với các tầng giao thức bậc cao không thực hiện truyền lại, chẳng hạn như UDP) hoặc làm giảm tốc độ truyền (đối với các tầng giao thức bậc cao có thực hiện truyền lại, chẳng hạn như TCP). Các cài đặt TCP hiện đại sử dụng các thuật toán (khám phá MTU đường đi - path MTU discovery) để xác định MTU của một đường đi giữa các host, và từ đó cắt nhỏ dữ liệu mà chúng chuyển cho IP, sao cho IP không phải truyền các datagram vượt quá kích thước này. UDP không cung cấp cơ chế như vậy, và chúng ta sẽ xem xét cách các ứng dụng dựa trên UDP có thể xử lý khả năng phân mảnh IP trong Mục [58.6.2.](#page-40-0)

## 58.5 Địa chỉ IP (IP Addresses)

Một địa chỉ IP bao gồm hai phần: ID mạng (network ID), xác định mạng mà một host đang kết nối, và ID host (host ID), xác định host bên trong mạng đó.

## Địa chỉ IPv4

Một địa chỉ IPv4 (IPv4 address) bao gồm 32 bit [\(Hình 58-5\)](#page-37-0). Khi được biểu diễn ở dạng con người có thể đọc được, các địa chỉ này thường được viết theo ký hiệu chấm-thập phân (dotted-decimal notation), trong đó 4 byte của địa chỉ được viết dưới dạng các số thập phân ngăn cách nhau bằng dấu chấm, ví dụ như 204.152.189.116.

|                 | 32 bit     |          |
|-----------------|------------|----------|
| Địa chỉ mạng    | ID Mạng    | ID Host  |
|                 |            |          |
| Mặt nạ mạng     | tất cả là 1| tất cả là 0|

**Hình 58-5:** Địa chỉ mạng IPv4 và mặt nạ mạng tương ứng

Khi một tổ chức đăng ký một dải địa chỉ IPv4 cho các host của mình, họ nhận được một địa chỉ mạng 32-bit và một mặt nạ mạng (network mask) 32-bit tương ứng. Ở dạng nhị phân, mặt nạ này bao gồm một chuỗi các bit 1 ở các bit bên trái nhất, theo sau là một chuỗi các bit 0 để lấp đầy phần còn lại của mặt nạ. Các bit 1 biểu thị phần nào của địa chỉ chứa ID mạng (Network ID) đã được gán, trong khi các bit 0 biểu thị phần nào của địa chỉ mà tổ chức có thể sử dụng để gán làm ID host (Host ID) duy nhất trên mạng của mình. Kích thước của phần Network ID trong mặt nạ được xác định khi địa chỉ được gán. Vì thành phần Network ID luôn chiếm phần bên trái nhất của mặt nạ, ký hiệu sau đây là đủ để chỉ định dải địa chỉ được gán:

204.152.189.0/24

Ký hiệu /24 cho biết phần Network ID của địa chỉ được gán bao gồm 24 bit bên trái nhất, với 8 bit còn lại chỉ định Host ID. Ngoài ra, chúng ta có thể nói rằng mặt nạ mạng trong trường hợp này là 255.255.255.0 theo ký hiệu chấm-thập phân.

Một tổ chức nắm giữ địa chỉ này có thể gán 254 địa chỉ Internet duy nhất cho các máy tính của mình—từ 204.152.189.1 đến 204.152.189.254. Có hai địa chỉ không thể được gán. Một trong số đó là địa chỉ có Host ID toàn các bit 0, được sử dụng để định danh chính mạng đó. Địa chỉ còn lại là địa chỉ có Host ID toàn các bit 1—204.152.189.255 trong ví dụ này—đó là địa chỉ phát quảng bá mạng con (subnet broadcast address).

Một số địa chỉ IPv4 có ý nghĩa đặc biệt. Địa chỉ đặc biệt 127.0.0.1 thường được định nghĩa là địa chỉ vòng lặp (loopback address), và theo quy ước được gán tên host là localhost. (Bất kỳ địa chỉ nào trên mạng 127.0.0.0/8 đều có thể được chỉ định làm địa chỉ IPv4 loopback, nhưng 127.0.0.1 là lựa chọn thông thường). Một gói dữ liệu (datagram) được gửi đến địa chỉ này thực ra không bao giờ đến mạng, mà thay vào đó sẽ tự động vòng lại để trở thành dữ liệu đầu vào cho host gửi. Việc sử dụng địa chỉ này rất thuận tiện cho việc kiểm thử các chương trình client và server trên cùng một host. Để sử dụng trong chương trình C, hằng số số nguyên `INADDR_LOOPBACK` được định nghĩa cho địa chỉ này.

Hằng số `INADDR_ANY` là cái gọi là địa chỉ wildcard IPv4 (IPv4 wildcard address). Địa chỉ IP wildcard rất hữu ích cho các ứng dụng thực hiện bind (liên kết) các socket miền Internet trên các host đa giao diện (multihomed host). Nếu một ứng dụng trên host đa giao diện liên kết một socket chỉ với một trong các địa chỉ IP của host đó, thì socket đó chỉ có thể nhận các gói dữ liệu UDP hoặc các yêu cầu kết nối TCP được gửi đến địa chỉ IP đó. Tuy nhiên, thông thường chúng ta muốn một ứng dụng trên host đa giao diện có thể nhận các gói dữ liệu hoặc yêu cầu kết nối chỉ định bất kỳ địa chỉ IP nào của host, và việc liên kết socket với địa chỉ IP wildcard sẽ làm cho điều này trở nên khả thi. SUSv3 không chỉ định bất kỳ giá trị cụ thể nào cho `INADDR_ANY`, nhưng hầu hết các cài đặt đều định nghĩa nó là 0.0.0.0 (tất cả các số không).

Thông thường, các địa chỉ IPv4 được chia thành các mạng con (subnetted). Việc chia mạng con sẽ chia phần Host ID của địa chỉ IPv4 thành hai phần: ID mạng con (subnet ID) và ID host (host ID) [\(Hình 58-6\)](#page-38-0). (Việc lựa chọn cách chia các bit của Host ID được thực hiện bởi quản trị viên mạng cục bộ). Lý do của việc chia mạng con là một tổ chức thường không kết nối tất cả các host của mình vào một mạng đơn lẻ. Thay vào đó, tổ chức có thể vận hành một tập hợp các mạng con ("mạng liên kết nội bộ" - internal internetwork), với mỗi mạng con được nhận diện bằng sự kết hợp giữa Network ID cộng với Subnet ID. Sự kết hợp này thường được gọi là ID mạng mở rộng (extended network ID). Trong một mạng con, mặt nạ mạng con (subnet mask) đóng vai trò tương tự như đã mô tả trước đó đối với mặt nạ mạng, và chúng ta có thể sử dụng một ký hiệu tương tự để chỉ ra dải địa chỉ được gán cho một mạng con cụ thể.

Ví dụ, giả sử Network ID được gán của chúng ta là 204.152.189.0/24, và chúng ta chọn chia mạng con dải địa chỉ này bằng cách tách 8 bit của Host ID thành một Subnet ID 4-bit và một Host ID 4-bit. Theo sơ đồ này, mặt nạ mạng con sẽ bao gồm 28 bit 1 ở đầu, theo sau là 4 bit 0, và mạng con có ID bằng 1 sẽ được chỉ định là 204.152.189.16/28.

![](_page_38_Figure_5.jpeg)

**Hình 58-6:** Chia mạng con IPv4 (IPv4 subnetting)

### Địa chỉ IPv6

Các nguyên lý về địa chỉ IPv6 tương tự như địa chỉ IPv4. Sự khác biệt chính là địa chỉ IPv6 bao gồm 128 bit, và một vài bit đầu tiên của địa chỉ là một tiền tố định dạng (format prefix), biểu thị loại địa chỉ. (Chúng ta sẽ không đi sâu vào chi tiết của các loại địa chỉ này; hãy xem Phụ lục A của tài liệu [Stevens et al., 2004] và RFC 3513 để biết chi tiết).

Các địa chỉ IPv6 thường được biểu diễn dưới dạng một chuỗi các số thập lục phân (hexadecimal) 16-bit được ngăn cách bởi dấu hai chấm (colon), như ví dụ sau:

```
F000:0:0:0:0:0:A:1
```

Địa chỉ IPv6 thường bao gồm một chuỗi các số không, và để thuận tiện cho việc ký hiệu, hai dấu hai chấm (`::`) có thể được sử dụng để biểu thị chuỗi số không đó. Do đó, địa chỉ trên có thể được viết lại thành:

```
F000::A:1
```

Chỉ một trường hợp ký hiệu hai dấu hai chấm được phép xuất hiện trong một địa chỉ IPv6; nếu có nhiều hơn một trường hợp, địa chỉ sẽ trở nên mơ hồ.

IPv6 cũng cung cấp các giá trị tương đương với địa chỉ loopback của IPv4 (127 số 0, theo sau là số 1, do đó là `::1`) và địa chỉ wildcard (tất cả các số 0, được viết là `0::0` hoặc `::`).

Để cho phép các ứng dụng IPv6 giao tiếp với các host chỉ hỗ trợ IPv4, IPv6 cung cấp cái gọi là địa chỉ IPv4-mapped IPv6 (địa chỉ IPv6 được ánh xạ IPv4). Định dạng của các địa chỉ này được minh họa tại [Hình 58-7](#page-39-1).

![](_page_39_Figure_9.jpeg)

**Hình 58-7:** Định dạng của một địa chỉ IPv4-mapped IPv6

Khi viết một địa chỉ IPv4-mapped IPv6, phần IPv4 của địa chỉ (tức là 4 byte cuối) được viết theo ký hiệu thập phân phân cách bằng dấu chấm (dotted-decimal) của IPv4. Do đó, địa chỉ IPv4-mapped IPv6 tương đương với `204.152.189.116` là `::FFFF:204.152.189.116`.

## 58.6 Tầng Giao Vận (Transport Layer)

Có hai giao thức tầng giao vận (transport-layer protocol) được sử dụng rộng rãi trong bộ giao thức TCP/IP:

- User Datagram Protocol (UDP) là giao thức được sử dụng cho các socket gói tin (datagram socket).
- Transmission Control Protocol (TCP) là giao thức được sử dụng cho các socket luồng (stream socket).

Trước khi xem xét các giao thức này, trước hết chúng ta cần mô tả số hiệu cổng (port number), một khái niệm được sử dụng bởi cả hai giao thức.

### 58.6.1 Số Hiệu Cổng (Port Numbers)

Nhiệm vụ của giao thức giao vận là cung cấp dịch vụ giao tiếp đầu cuối đến đầu cuối (end-to-end) cho các ứng dụng nằm trên các host khác nhau (hoặc đôi khi trên cùng một host). Để làm được điều này, tầng giao vận (Transport Layer) yêu cầu một phương pháp để phân biệt các ứng dụng trên một host. Trong TCP và UDP, sự phân biệt này được cung cấp bởi một số hiệu cổng (port number) 16-bit.

### Cổng thông dụng, cổng đã đăng ký và cổng đặc quyền (Well-known, registered, and privileged ports)

Một số số hiệu cổng thông dụng (well-known port) được gán vĩnh viễn cho các ứng dụng cụ thể (còn được gọi là các dịch vụ - services). Ví dụ, tiến trình nền (daemon) ssh (secure shell) sử dụng cổng thông dụng 22, và HTTP (giao thức dùng để giao tiếp giữa máy chủ web và trình duyệt) sử dụng cổng thông dụng 80. Các cổng thông dụng được gán dải số từ 0 đến 1023 bởi một cơ quan trung tâm, Tổ chức Cấp phát Số hiệu Internet (Internet Assigned Numbers Authority - IANA, http://www.iana.org/). Việc gán một số hiệu cổng thông dụng phụ thuộc vào một đặc tả mạng được phê duyệt (thường dưới dạng một tài liệu RFC).

IANA cũng ghi nhận các cổng đã đăng ký (registered port), được phân bổ cho các nhà phát triển ứng dụng theo tiêu chí ít nghiêm ngặt hơn (điều này cũng có nghĩa là một cài đặt không cần phải đảm bảo tính khả dụng của các cổng này cho mục đích đã đăng ký của chúng). Dải cổng do IANA đăng ký là từ 1024 đến 41951. (Không phải tất cả các số hiệu cổng trong dải này đều được đăng ký.)

Danh sách cập nhật về việc gán cổng thông dụng và cổng đã đăng ký của IANA có thể được lấy trực tuyến tại http://www.iana.org/assignments/port-numbers.

Trong hầu hết các cài đặt TCP/IP (bao gồm Linux), các số hiệu cổng trong dải từ 0 đến 1023 cũng là cổng đặc quyền (privileged port), có nghĩa là chỉ các tiến trình (Process) có đặc quyền (`CAP_NET_BIND_SERVICE`) mới có thể bind (gắn kết) vào các cổng này. Điều này ngăn cản một người dùng thông thường thực thi một ứng dụng độc hại, chẳng hạn như giả mạo (spoof) ssh nhằm đánh cắp mật khẩu. (Đôi khi, các cổng đặc quyền được gọi là cổng dành riêng - reserved port).

Mặc dù các cổng TCP và UDP có cùng số hiệu là các thực thể riêng biệt, nhưng cùng một số hiệu cổng thông dụng thường được gán cho một dịch vụ dưới cả TCP và UDP, ngay cả khi, như trường hợp thường xảy ra, dịch vụ đó chỉ khả dụng dưới một trong hai giao thức này. Quy ước này giúp tránh sự nhầm lẫn về số hiệu cổng giữa hai giao thức.

## Cổng tạm (Ephemeral ports)

Nếu một ứng dụng không chọn một cổng cụ thể (tức là trong thuật ngữ về socket, nó không gọi `bind()` socket của mình vào một cổng cụ thể), thì TCP và UDP sẽ gán một số cổng tạm (ephemeral port) duy nhất (tức là có thời gian sống ngắn) cho socket. Trong trường hợp này, ứng dụng — thường là một client — không quan tâm đến số cổng mà nó sử dụng, nhưng việc gán một cổng là cần thiết để các giao thức tầng giao vận (transport-layer protocols) có thể xác định các điểm cuối giao tiếp (communication endpoints). Điều này cũng giúp ứng dụng ngang hàng (peer application) ở đầu bên kia của kênh giao tiếp biết cách liên lạc với ứng dụng này. TCP và UDP cũng gán một số cổng tạm nếu chúng ta bind một socket vào cổng 0.

IANA chỉ định dải cổng từ 49152 đến 65535 là dải cổng động hoặc riêng tư (dynamic or private), với dụng ý rằng các cổng này có thể được sử dụng bởi các ứng dụng cục bộ (local applications) và được gán làm cổng tạm. Tuy nhiên, các cài đặt (implementations) khác nhau lại phân bổ cổng tạm từ các dải khác nhau. Trên Linux, dải này được định nghĩa bởi (và có thể được sửa đổi thông qua) hai số nằm trong tệp `/proc/sys/net/ipv4/ip_local_port_range`.

### 58.6.2 Giao thức Datagram Người dùng (User Datagram Protocol - UDP)

UDP chỉ bổ sung hai tính năng vào IP: số cổng (port numbers) và một mã tổng kiểm dữ liệu (data checksum) cho phép phát hiện lỗi trong dữ liệu được truyền.

Giống như IP, UDP không có kết nối (connectionless). Vì nó không thêm tính năng đảm bảo độ tin cậy (reliability) nào cho IP, nên UDP cũng không đáng tin cậy. Nếu một ứng dụng được xây dựng lớp trên UDP yêu cầu độ tin cậy, thì điều này phải được triển khai bên trong ứng dụng đó. Bất chấp sự không đáng tin cậy này, đôi khi chúng ta vẫn ưu tiên sử dụng UDP thay vì TCP, vì những lý do được trình bày chi tiết trong Mục [61.12](#page-133-0).

Mã tổng kiểm (checksums) được sử dụng bởi cả UDP và TCP chỉ dài 16 bit, và là các mã tổng kiểm "cộng dồn" đơn giản có thể không phát hiện được một số loại lỗi nhất định. Do đó, chúng không cung cấp khả năng phát hiện lỗi cực kỳ mạnh mẽ. Các máy chủ Internet bận rộn thường thấy trung bình cứ vài ngày lại có một lỗi truyền dẫn không bị phát hiện ([Stone & Partridge, 2000]). Các ứng dụng cần đảm bảo tính toàn vẹn dữ liệu (data integrity) mạnh mẽ hơn có thể sử dụng giao thức Secure Sockets Layer (SSL), không chỉ cung cấp giao tiếp bảo mật mà còn phát hiện lỗi nghiêm ngặt hơn nhiều. Ngoài ra, một ứng dụng có thể tự triển khai cơ chế kiểm soát lỗi của riêng mình.

## Lựa chọn kích thước datagram UDP để tránh phân mảnh IP (IP fragmentation)

Trong Mục [58.4](#page-35-0), chúng tôi đã mô tả cơ chế phân mảnh IP (IP fragmentation) và lưu ý rằng tốt nhất là nên tránh phân mảnh IP. Trong khi TCP chứa các cơ chế để tránh phân mảnh IP, thì UDP lại không có. Với UDP, chúng ta có thể dễ dàng gây ra hiện tượng phân mảnh IP bằng cách truyền một datagram vượt quá MTU của liên kết dữ liệu cục bộ (local data link).

Một ứng dụng dựa trên UDP thường không biết MTU của đường dẫn (path) giữa máy nguồn và máy đích. Các ứng dụng dựa trên UDP nhằm mục đích tránh phân mảnh IP thường áp dụng cách tiếp cận thận trọng, đó là đảm bảo rằng datagram IP được truyền đi nhỏ hơn kích thước bộ đệm lắp ráp lại tối thiểu (minimum reassembly buffer size) của IPv4 là 576 byte. (Giá trị này có thể thấp hơn MTU của đường dẫn). Từ 576 byte này, 8 byte được yêu cầu bởi chính phần tiêu đề (header) của UDP, và tối thiểu thêm 20 byte nữa được yêu cầu cho phần tiêu đề IP, để lại 548 byte cho chính UDP datagram. Trong thực tế, nhiều ứng dụng dựa trên UDP chọn giới hạn thấp hơn nữa là 512 byte cho các datagram của chúng ([Stevens, 1994]).

### 58.6.3 Giao thức Điều khiển Truyền vận (Transmission Control Protocol - TCP)

TCP cung cấp một kênh giao tiếp dòng byte (byte-stream), hai chiều (bidirectional), hướng kết nối (connection-oriented), đáng tin cậy giữa hai điểm cuối (tức là các ứng dụng), như được thể hiện trong [Hình 58-8](#page-41-0). Để cung cấp các tính năng này, TCP phải thực hiện các tác vụ được mô tả trong mục này. (Mô tả chi tiết về tất cả các tính năng này có thể được tìm thấy trong [Stevens, 1994]).

![](_page_41_Figure_6.jpeg)

**Hình 58-8:** Các TCP socket đã được kết nối

Chúng tôi sử dụng thuật ngữ điểm cuối TCP (TCP endpoint) để biểu thị thông tin được duy trì bởi kernel cho một đầu của kết nối TCP. (Thường thì chúng tôi viết tắt thuật ngữ này hơn nữa, ví dụ, chỉ viết "một TCP" để có ý nghĩa là "một điểm cuối TCP", hoặc "TCP của client" để có ý nghĩa là "điểm cuối TCP được duy trì cho ứng dụng client"). Thông tin này bao gồm bộ đệm gửi và nhận (send and receive buffers) cho đầu kết nối này, cũng như thông tin trạng thái được duy trì nhằm mục đích đồng bộ hóa hoạt động của hai điểm cuối được kết nối. (Chúng tôi mô tả thông tin trạng thái này chi tiết hơn khi xem xét biểu đồ chuyển đổi trạng thái TCP trong Mục [61.6.3](#page-120-0)). Trong phần còn lại của cuốn sách này, chúng tôi sử dụng các thuật ngữ TCP nhận (receiving TCP) và TCP gửi (sending TCP) để biểu thị các điểm cuối TCP được duy trì cho các ứng dụng nhận và gửi ở hai đầu của một kết nối socket dòng (stream socket connection) đang được sử dụng để truyền dữ liệu theo một hướng cụ thể.

## Thiết lập kết nối (Connection establishment)

Trước khi quá trình truyền thông có thể bắt đầu, TCP thiết lập một kênh truyền thông (communication channel) giữa hai điểm đầu cuối (endpoint). Trong quá trình thiết lập kết nối, bên gửi và bên nhận có thể trao đổi các tùy chọn để thông báo (advertise) các tham số cho kết nối đó.

## Đóng gói dữ liệu thành các phân đoạn (Packaging of data in segments)

Dữ liệu được chia thành các phân đoạn (segment), mỗi phân đoạn chứa một mã kiểm tra lỗi (checksum) cho phép phát hiện các lỗi truyền dẫn đầu cuối (end-to-end). Mỗi phân đoạn được truyền đi trong một gói tin IP (IP datagram) duy nhất.

### Xác nhận, truyền lại và thời gian chờ (Acknowledgements, retransmissions, and timeouts)

Khi một phân đoạn TCP đến đích mà không có lỗi, TCP bên nhận sẽ gửi một thông báo xác nhận dương tính (positive acknowledgement) tới bên gửi, thông báo cho bên gửi biết dữ liệu đã được giao thành công. Nếu một phân đoạn đến nơi có lỗi, nó sẽ bị loại bỏ (discard) và không có thông báo xác nhận nào được gửi đi. Để xử lý trường hợp các phân đoạn không bao giờ đến nơi hoặc bị loại bỏ, bên gửi sẽ khởi động một bộ định thời (timer) khi mỗi phân đoạn được truyền đi. Nếu không nhận được thông báo xác nhận trước khi bộ định thời hết hạn, phân đoạn đó sẽ được truyền lại (retransmit).

> [!NOTE]
> Vì thời gian cần thiết để truyền một phân đoạn và nhận được thông báo xác nhận của nó thay đổi tùy thuộc vào phạm vi của mạng và tải lưu lượng hiện tại, TCP áp dụng một thuật toán để điều chỉnh động kích thước thời gian chờ truyền lại (retransmission timeout - RTO).

> [!NOTE]
> TCP bên nhận có thể không gửi thông báo xác nhận ngay lập tức, mà thay vào đó chờ một khoảng thời gian ngắn để xem thông báo xác nhận có thể được ghép chung (piggyback) bên trong bất kỳ phản hồi nào mà bên nhận có thể gửi ngược lại ngay cho bên gửi hay không. (Mỗi phân đoạn TCP đều bao gồm một trường xác nhận, cho phép thực hiện việc ghép chung này.) Mục đích của kỹ thuật này, được gọi là ACK trễ (delayed ACK), là để tiết kiệm việc gửi một phân đoạn TCP, từ đó làm giảm số lượng gói tin trên mạng và giảm tải cho các host gửi và nhận.

## Đánh số thứ tự (Sequencing)

Mỗi byte được truyền qua một kết nối TCP được gán một số thứ tự logic (logical sequence number). Số này biểu thị vị trí của byte đó trong luồng dữ liệu (data stream) của kết nối. (Mỗi luồng trong số hai luồng của kết nối đều có hệ thống đánh số thứ tự riêng.) Khi một phân đoạn TCP được truyền đi, nó bao gồm một trường chứa số thứ tự của byte đầu tiên trong phân đoạn đó.

Việc đính kèm số thứ tự vào mỗi phân đoạn phục vụ nhiều mục đích khác nhau:

- Số thứ tự cho phép các phân đoạn TCP được lắp ráp theo đúng thứ tự ở đích, sau đó được chuyển giao dưới dạng một luồng byte (byte stream) cho tầng ứng dụng (application layer). (Tại bất kỳ thời điểm nào, nhiều phân đoạn TCP có thể đang trên đường truyền giữa bên gửi và bên nhận, và các phân đoạn này có thể đến nơi sai thứ tự.)

- Thông báo xác nhận được truyền từ bên nhận ngược lại cho bên gửi có thể sử dụng số thứ tự để xác định phân đoạn TCP nào đã được nhận.
- Bên nhận có thể sử dụng số thứ tự để loại bỏ các phân đoạn trùng lặp. Các trường hợp trùng lặp như vậy có thể xảy ra do sự trùng lặp của các gói tin IP (IP datagram) hoặc do chính thuật toán truyền lại của TCP, thuật toán này có thể truyền lại một phân đoạn đã được giao thành công nếu thông báo xác nhận cho phân đoạn đó bị mất hoặc không được nhận kịp thời.

Số thứ tự ban đầu (initial sequence number - ISN) cho một luồng không bắt đầu từ 0. Thay vào đó, nó được tạo ra thông qua một thuật toán làm tăng ISN được gán cho các kết nối TCP kế tiếp nhau (để ngăn chặn khả năng các phân đoạn cũ từ một phiên kết nối trước đó bị nhầm lẫn với các phân đoạn của kết nối hiện tại). Thuật toán này cũng được thiết kế để làm cho việc đoán ISN trở nên khó khăn. Số thứ tự là một giá trị 32-bit sẽ quay vòng (wrap around) về 0 khi đạt đến giá trị tối đa.

### Điều khiển luồng (Flow control)

Điều khiển luồng (flow control) ngăn chặn một bên gửi (sender) quá nhanh làm quá tải một bên nhận (receiver) chậm hơn. Để thực hiện điều khiển luồng, TCP phía nhận duy trì một bộ đệm (buffer) cho dữ liệu đến. (Mỗi TCP thông báo kích thước của bộ đệm này trong quá trình thiết lập kết nối - connection establishment.) Dữ liệu tích lũy trong bộ đệm này khi được nhận từ TCP phía gửi, và được lấy ra khi ứng dụng đọc dữ liệu. Với mỗi thông báo xác nhận (acknowledgement), bên nhận thông báo cho bên gửi biết còn bao nhiêu dung lượng trống trong bộ đệm dữ liệu đến của nó (tức là bên gửi có thể truyền bao nhiêu byte). Thuật toán điều khiển luồng của TCP sử dụng cái gọi là thuật toán cửa sổ trượt (sliding window algorithm), cho phép các đoạn dữ liệu (segment) chưa được xác nhận với tổng kích thước lên tới $N$ byte (kích thước cửa sổ được quảng cáo - offered window size) đang được truyền tải (in transit) giữa bên gửi và bên nhận. Nếu bộ đệm dữ liệu đến của một TCP phía nhận bị đầy hoàn toàn, thì cửa sổ được gọi là đã đóng (closed), và TCP phía gửi sẽ ngừng truyền.

> [!NOTE]
> Bên nhận có thể ghi đè kích thước mặc định cho bộ đệm dữ liệu đến bằng cách sử dụng tùy chọn socket `SO_RCVBUF` (xem trang hướng dẫn thủ công `socket(7)`).

### Điều khiển tắc nghẽn: thuật toán khởi động chậm và tránh tắc nghẽn

Các thuật toán điều khiển tắc nghẽn (congestion-control) của TCP được thiết kế để ngăn chặn một bên gửi nhanh làm quá tải mạng. Nếu một TCP gửi truyền các gói tin nhanh hơn mức chúng có thể được chuyển tiếp (relayed) bởi một bộ định tuyến trung gian (router), router đó sẽ bắt đầu thả (drop) các gói tin. Điều này có thể dẫn đến tỷ lệ mất gói tin cao và hậu quả là hiệu suất suy giảm nghiêm trọng, nếu TCP gửi cứ tiếp tục truyền lại các đoạn dữ liệu bị mất này với cùng tốc độ. Các thuật toán điều khiển tắc nghẽn của TCP rất quan trọng trong hai trường hợp:

Sau khi thiết lập kết nối: Tại thời điểm này (hoặc khi việc truyền dữ liệu tiếp tục trên một kết nối đã ở trạng thái nhàn rỗi - idle trong một khoảng thời gian), bên gửi có thể bắt đầu bằng cách ngay lập tức bơm (inject) vào mạng số lượng đoạn dữ liệu tương ứng với mức cho phép bởi kích thước cửa sổ được quảng cáo bởi bên nhận. (Trên thực tế, đây là cách đã được thực hiện trong các triển khai TCP đời đầu). Vấn đề ở đây là nếu mạng không thể xử lý lượng lớn đoạn dữ liệu này, bên gửi sẽ có nguy cơ làm quá tải mạng ngay lập tức.

Khi phát hiện tắc nghẽn: Nếu TCP phía gửi phát hiện thấy hiện tượng tắc nghẽn đang xảy ra, thì nó phải giảm tốc độ truyền của mình. TCP phát hiện tắc nghẽn dựa trên giả định rằng việc mất đoạn dữ liệu do lỗi truyền dẫn là rất thấp; do đó, nếu một gói tin bị mất, nguyên nhân được mặc định là do tắc nghẽn.

Chiến lược điều khiển tắc nghẽn của TCP kết hợp sử dụng hai thuật toán: khởi động chậm (slow start) và tránh tắc nghẽn (congestion avoidance).

Thuật toán khởi động chậm khiến TCP phía gửi ban đầu truyền các đoạn dữ liệu ở tốc độ chậm, nhưng cho phép nó tăng tốc độ theo hàm mũ (exponentially) khi các đoạn dữ liệu này được xác nhận bởi TCP phía nhận. Khởi động chậm cố gắng ngăn chặn một bên gửi TCP nhanh làm quá tải mạng. Tuy nhiên, nếu không bị kìm hãm, việc tăng tốc độ truyền theo hàm mũ của khởi động chậm có nghĩa là bên gửi sẽ sớm làm quá tải mạng. Thuật toán tránh tắc nghẽn của TCP ngăn chặn điều này bằng cách đặt ra một cơ chế giới hạn (governor) cho việc tăng tốc độ.

Với tính năng tránh tắc nghẽn, vào đầu một kết nối, TCP phía gửi bắt đầu với một cửa sổ tắc nghẽn (congestion window) nhỏ, giới hạn lượng dữ liệu chưa được xác nhận mà nó có thể truyền. Khi bên gửi nhận được các xác nhận từ TCP đối tác, cửa sổ tắc nghẽn ban đầu phát triển theo hàm mũ. Tuy nhiên, một khi cửa sổ tắc nghẽn đạt đến một ngưỡng nhất định được cho là gần với dung lượng truyền tải của mạng, sự phát triển của nó trở thành tuyến tính (linear) thay vì theo hàm mũ. (Ước tính về dung lượng của mạng được suy ra từ một phép tính dựa trên tốc độ truyền đang hoạt động khi phát hiện tắc nghẽn, hoặc được đặt ở một giá trị cố định sau khi thiết lập kết nối ban đầu). Tại mọi thời điểm, lượng dữ liệu mà TCP phía gửi sẽ truyền vẫn bị giới hạn bổ sung bởi cửa sổ được quảng cáo của TCP phía nhận và bộ đệm gửi (send buffer) của TCP cục bộ.

Kết hợp lại, các thuật toán khởi động chậm và tránh tắc nghẽn cho phép bên gửi nhanh chóng nâng tốc độ truyền của mình lên đến dung lượng khả dụng của mạng mà không vượt quá dung lượng đó. Hiệu quả của các thuật toán này là cho phép việc truyền dữ liệu nhanh chóng đạt đến trạng thái cân bằng (equilibrium), nơi bên gửi truyền các gói tin với cùng tốc độ mà nó nhận được các xác nhận từ bên nhận.

## 58.7 Yêu cầu Bình luận (Requests for Comments - RFCs)

Mỗi giao thức Internet mà chúng ta thảo luận trong cuốn sách này đều được định nghĩa trong một tài liệu RFC—một đặc tả giao thức chính thức (formal protocol specification). Các tài liệu RFC được xuất bản bởi Biên tập viên RFC (RFC Editor - http://www.rfc-editor.org/), được tài trợ bởi Tổ chức Internet (Internet Society - http://www.isoc.org/). Các RFC mô tả các tiêu chuẩn Internet được phát triển dưới sự bảo trợ của Lực lượng Đặc nhiệm Kỹ thuật Internet (Internet Engineering Task Force - IETF, http://www.ietf.org/), một cộng đồng gồm các nhà thiết kế mạng, nhà điều hành, nhà cung cấp (vendor) và nhà nghiên cứu quan tâm đến sự tiến hóa và hoạt động suôn sẻ của Internet. Tư cách thành viên của IETF mở cho bất kỳ cá nhân nào quan tâm.

Các RFC sau đây có ý nghĩa đặc biệt quan trọng đối với nội dung được đề cập trong cuốn sách này:

- RFC 791, Internet Protocol. J. Postel (ed.), 1981.
- RFC 950, Internet Standard Subnetting Procedure. J. Mogul and J. Postel, 1985.
- RFC 793, Transmission Control Protocol. J. Postel (ed.), 1981.
- RFC 768, User Datagram Protocol. J. Postel (ed.), 1980.
- RFC 1122, Requirements for Internet Hosts—Communication Layers. R. Braden (ed.), 1989.

RFC 1122 mở rộng (và hiệu chỉnh) các RFC trước đó mô tả các giao thức TCP/IP. Đây là một trong hai RFC thường được gọi đơn giản là RFC về Yêu cầu đối với Host (Host Requirements RFCs). Thành viên còn lại trong cặp này là RFC 1123, bao gồm các giao thức tầng ứng dụng (application-layer protocols) như telnet, FTP và SMTP.

Trong số các RFC mô tả IPv6, có các tài liệu sau:

- RFC 2460, Internet Protocol, Version 6. S. Deering and R. Hinden, 1998.
- RFC 4291, IP Version 6 Addressing Architecture. R. Hinden and S. Deering, 2006.
- RFC 3493, Basic Socket Interface Extensions for IPv6. R. Gilligan, S. Thomson, J. Bound, J. McCann, and W. Stevens, 2003.
- RFC 3542, Advanced Sockets API for IPv6. W. Stevens, M. Thomas, E. Nordmark, and T. Jinmei, 2003.

Một số RFC và tài liệu nghiên cứu cung cấp các cải tiến và mở rộng cho đặc tả TCP gốc, bao gồm:

- Congestion Avoidance and Control. V. Jacobsen, 1988. Đây là tài liệu nghiên cứu ban đầu mô tả các thuật toán kiểm soát tắc nghẽn (congestion-control) và khởi động chậm (slow-start) cho TCP. Ban đầu được xuất bản trong Proceedings of SIGCOMM '88, một phiên bản được chỉnh sửa đôi chút có sẵn tại ftp://ftp.ee.lbl.gov/papers/congavoid.ps.Z. Tài liệu này phần lớn đã được thay thế bởi một số RFC sau đây.
- RFC 1323, TCP Extensions for High Performance. V. Jacobson, R. Braden, and D. Borman, 1992.
- RFC 2018, TCP Selective Acknowledgment Options. M. Mathis, J. Mahdavi, S. Floyd, and A. Romanow, 1996.
- RFC 2581, TCP Congestion Control. M. Allman, V. Paxson, and W. Stevens, 1999.
- RFC 2861, TCP Congestion Window Validation. M. Handley, J. Padhye, and S. Floyd, 2000.
- RFC 2883, An Extension to the Selective Acknowledgement (SACK) Option for TCP. S. Floyd, J. Mahdavi, M. Mathis, and M. Podolsky, 2000.
- RFC 2988, Computing TCP's Retransmission Timer. V. Paxson and M. Allman, 2000.
- RFC 3168, The Addition of Explicit Congestion Notification (ECN) to IP. K. Ramakrishnan, S. Floyd, and D. Black, 2001.
- RFC 3390, Increasing TCP's Initial Window. M. Allman, S. Floyd, and C. Partridge, 2002.

## 58.8 Tóm tắt

TCP/IP là một bộ giao thức mạng phân tầng (layered networking protocol suite). Ở tầng thấp nhất của chồng giao thức (protocol stack) TCP/IP là giao thức tầng mạng IP. IP truyền dữ liệu dưới dạng các datagram. IP hoạt động theo kiểu không kết nối (connectionless), có nghĩa là các datagram được truyền giữa host nguồn và host đích có thể đi theo các tuyến đường khác nhau trên mạng. IP không đáng tin cậy (unreliable), ở chỗ nó không đảm bảo rằng các datagram sẽ đến theo đúng thứ tự, không bị trùng lặp, hoặc thậm chí có đến nơi hay không. Nếu tính đáng tin cậy là bắt buộc, thì nó phải được cung cấp thông qua việc sử dụng một giao thức tầng trên đáng tin cậy (ví dụ: TCP) hoặc bên trong một ứng dụng.

Phiên bản gốc của IP là IPv4. Vào đầu những năm 1990, một phiên bản IP mới là IPv6 đã được thiết kế. Điểm khác biệt đáng chú ý nhất giữa IPv4 và IPv6 là IPv4 sử dụng 32 bit để biểu diễn một địa chỉ host, trong khi IPv6 sử dụng 128 bit, do đó cho phép số lượng host lớn hơn nhiều trên Internet toàn cầu. Hiện tại, IPv4 vẫn là phiên bản IP được sử dụng rộng rãi nhất, mặc dù trong những năm tới, nó có khả năng sẽ bị thay thế bởi IPv6.

Nhiều giao thức tầng vận chuyển (transport-layer protocols) được chồng lên trên IP, trong đó được sử dụng rộng rãi nhất là UDP và TCP. UDP là một giao thức datagram không đáng tin cậy. TCP là một giao thức dòng byte (byte-stream), hướng kết nối (connection-oriented), đáng tin cậy. TCP xử lý toàn bộ các chi tiết về việc thiết lập và chấm dứt kết nối. TCP cũng đóng gói dữ liệu thành các đoạn (segment) để IP truyền đi, và cung cấp đánh số thứ tự (sequence numbering) cho các segment này để chúng có thể được bên nhận xác nhận và lắp ráp theo đúng thứ tự. Ngoài ra, TCP cung cấp cơ chế điều khiển luồng (flow control) nhằm ngăn chặn một bên gửi quá nhanh làm quá tải bên nhận chậm, và kiểm soát tắc nghẽn (congestion control) nhằm ngăn chặn một bên gửi quá nhanh làm quá tải mạng.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê trong Mục [59.15.](#page-86-0)
