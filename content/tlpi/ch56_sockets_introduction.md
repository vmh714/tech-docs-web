# Chương 56: SOCKET: GIỚI THIỆU

Socket là một phương pháp Giao tiếp giữa các tiến trình (Interprocess Communication - IPC) cho phép trao đổi dữ liệu giữa các ứng dụng, hoặc trên cùng một máy chủ (host) hoặc trên các máy chủ khác nhau được kết nối bằng mạng. Bản triển khai (implementation) API socket phổ biến đầu tiên xuất hiện cùng với 4.2BSD vào năm 1983, và API này đã đượcported (cổng hóa/chuyển đổi) sang hầu hết mọi bản triển khai UNIX, cũng như hầu hết các hệ điều hành khác.

> API socket được quy định chính thức trong POSIX.1g, được phê chuẩn vào năm 2000 sau khoảng một thập kỷ nằm ở dạng tiêu chuẩn dự thảo (draft standard). Tiêu chuẩn này đã được thay thế bởi SUSv3.

Chương này và các chương tiếp theo mô tả việc sử dụng socket như sau:

- Chương này cung cấp phần giới thiệu chung về API socket. Các chương tiếp theo giả định rằng bạn đã hiểu các khái niệm chung được trình bày ở đây. Chúng tôi không trình bày bất kỳ mã nguồn mẫu nào trong chương này. Các mã nguồn mẫu trong miền UNIX và Internet sẽ được trình bày trong các chương tiếp theo.
- Chương [57](#page-16-0) mô tả socket miền UNIX (UNIX domain socket), cho phép giao tiếp giữa các ứng dụng trên cùng một hệ thống máy chủ.
- Chương [58](#page-30-0) giới thiệu các khái niệm mạng máy tính khác nhau và mô tả các tính năng chính của các giao thức mạng TCP/IP. Nó cung cấp nền tảng cần thiết cho các chương tiếp theo.
- Chương [59](#page-48-0) mô tả socket miền Internet (Internet domain socket), cho phép các ứng dụng trên các máy chủ khác nhau giao tiếp thông qua mạng TCP/IP.

- Chương [60](#page-90-0) thảo luận về thiết kế của các máy chủ (server) sử dụng socket.
- Chương [61](#page-104-0) bao gồm một loạt các chủ đề nâng cao, bao gồm các tính năng bổ sung cho I/O của socket, xem xét chi tiết hơn về giao thức TCP, và việc sử dụng các tùy chọn socket (socket option) để truy xuất và sửa đổi các thuộc tính khác nhau của socket.

Các chương này chỉ nhằm mục đích cung cấp cho người đọc nền tảng vững chắc về việc sử dụng socket. Lập trình socket, đặc biệt là đối với truyền thông mạng, là một chủ đề vô cùng lớn theo đúng nghĩa của nó và là chủ đề của toàn bộ các cuốn sách. Các nguồn thông tin chi tiết hơn được liệt kê trong Mục [59.15.](#page-86-0)

## 56.1 Tổng quan

Trong một kịch bản client-server điển hình, các ứng dụng giao tiếp sử dụng socket như sau:

- Mỗi ứng dụng tạo ra một socket. Socket là "công cụ" cho phép giao tiếp và cả hai ứng dụng đều cần một socket.
- Server liên kết (bind) socket của nó với một địa chỉ nổi tiếng (tên) để các client có thể định vị nó.

Một socket được tạo bằng cách sử dụng System Call `socket()`, trả về một File Descriptor (bộ mô tả tệp) được sử dụng để tham chiếu đến socket trong các System Call tiếp theo:

```
fd = socket(domain, type, protocol);
```

Chúng tôi mô tả các miền (domain) và kiểu (type) của socket trong các đoạn văn sau. Đối với tất cả các ứng dụng được mô tả trong cuốn sách này, `protocol` luôn được chỉ định là 0.

### Miền giao tiếp (Communication domains)

Socket tồn tại trong một miền giao tiếp, miền này quyết định:

- phương pháp nhận dạng một socket (tức là định dạng của "địa chỉ" socket); và
- phạm vi giao tiếp (tức là giữa các ứng dụng trên cùng một máy chủ hoặc giữa các ứng dụng trên các máy chủ khác nhau được kết nối qua mạng).

Các hệ điều hành hiện đại hỗ trợ ít nhất các miền sau:

- Miền UNIX (`AF_UNIX`) cho phép giao tiếp giữa các ứng dụng trên cùng một máy chủ. (POSIX.1g đã sử dụng tên `AF_LOCAL` làm từ đồng nghĩa cho `AF_UNIX`, nhưng tên này không được sử dụng trong SUSv3.)
- Miền IPv4 (`AF_INET`) cho phép giao tiếp giữa các ứng dụng chạy trên các máy chủ được kết nối qua mạng Giao thức Internet phiên bản 4 (IPv4 - Internet Protocol version 4).
- Miền IPv6 (`AF_INET6`) cho phép giao tiếp giữa các ứng dụng chạy trên các máy chủ được kết nối qua mạng Giao thức Internet phiên bản 6 (IPv6 - Internet Protocol version 6). Mặc dù IPv6 được thiết kế để kế nhiệm IPv4, nhưng giao thức sau hiện vẫn được sử dụng rộng rãi nhất.

Bảng 56-1 tóm tắt các đặc điểm của các miền socket này.

Trong một số mã nguồn, chúng ta có thể thấy các hằng số có tên như `PF_UNIX` thay vì `AF_UNIX`. Trong bối cảnh này, AF viết tắt của "Address Family" (Họ địa chỉ) và PF viết tắt của "Protocol Family" (Họ giao thức). Ban đầu, người ta hình dung rằng một họ giao thức duy nhất có thể hỗ trợ nhiều họ địa chỉ. Trong thực tế, chưa từng có họ giao thức nào hỗ trợ nhiều họ địa chỉ được định nghĩa, và tất cả các bản triển khai hiện tại đều định nghĩa các hằng số `PF_` đồng nghĩa với các hằng số `AF_` tương ứng. (SUSv3 quy định các hằng số `AF_`, nhưng không quy định các hằng số `PF_`.) Trong cuốn sách này, chúng ta luôn sử dụng các hằng số `AF_`. Thông tin thêm về lịch sử của các hằng số này có thể được tìm thấy trong Mục 4.2 của [Stevens et al., 2004].

**Bảng 56-1:** Các miền socket

| Miền (Domain)   | Giao tiếp<br>được thực hiện | Giao tiếp<br>giữa các ứng dụng     | Định dạng địa chỉ<br>(Address format) | Cấu trúc địa chỉ<br>(Address structure) |
|-----------------|-----------------------------|------------------------------------|---------------------------------------|-----------------------------------------|

| AF_UNIX  | trong kernel              | trên cùng một host                          | đường dẫn (pathname)                         | sockaddr_un          |
| AF_INET  | qua IPv4                   | trên các host được kết nối<br>qua mạng IPv4 | địa chỉ IPv4 32-bit +<br>số cổng 16-bit      | sockaddr_in          |
|          |                            |                                           |                                              |                      |
| AF_INET6 | via IPv6                   | trên các host được kết nối<br>qua mạng IPv6 | địa chỉ IPv6 128-bit +<br>số cổng 16-bit     | sockaddr_in6         |

## Các loại Socket (Socket types)

Mỗi triển khai socket (sockets implementation) cung cấp ít nhất hai loại socket: stream (luồng) và datagram (gói dữ liệu). Các loại socket này được hỗ trợ ở cả miền UNIX (UNIX domain) và miền Internet (Internet domain). [Bảng 56-2](#page-2-0) tóm tắt các thuộc tính của các loại socket này.

**Bảng 56-2:** Các loại socket và thuộc tính của chúng

| Thuộc tính                    | Loại socket |          |  |  |
|-------------------------------|-------------|----------|--|--|
|                               | Stream      | Datagram |  |  |
| Truyền đáng tin cậy?          | C (Y)       | K (N)    |  |  |
| Bảo toàn ranh giới thông điệp?| K (N)       | C (Y)    |  |  |
| Hướng kết nối (Connection-oriented)? | C (Y) | K (N)  |  |  |

Stream socket (`SOCK_STREAM`) cung cấp một kênh giao tiếp luồng byte (byte-stream), song hướng (bidirectional) và đáng tin cậy (reliable). Theo các thuật ngữ trong mô tả này, chúng ta hiểu các ý nghĩa sau:

- Đáng tin cậy (Reliable) có nghĩa là chúng ta được đảm bảo rằng dữ liệu được truyền đi sẽ hoặc là đến nơi nhận một cách nguyên vẹn, chính xác như khi được gửi đi bởi bên gửi (giả sử rằng cả đường truyền mạng lẫn ứng dụng nhận không bị crash), hoặc là chúng ta sẽ nhận được thông báo về một lỗi có thể xảy ra trong quá trình truyền.
- Song hướng (Bidirectional) có nghĩa là dữ liệu có thể được truyền theo cả hai hướng giữa hai socket.
- Luồng byte (Byte-stream) có nghĩa là, giống như các pipe, không có khái niệm về ranh giới thông điệp (message boundaries) (tham khảo Mục 44.1).

Một stream socket tương tự như việc sử dụng một cặp pipe để cho phép giao tiếp song hướng giữa hai ứng dụng, điểm khác biệt là các socket (trong miền Internet) cho phép giao tiếp qua mạng.

Stream socket hoạt động theo các cặp đã kết nối. Vì lý do này, stream socket được mô tả là hướng kết nối (connection-oriented). Thuật ngữ socket đối đẳng (peer socket) dùng để chỉ socket ở đầu bên kia của một kết nối; địa chỉ đối đẳng (peer address) biểu thị địa chỉ của socket đó; và ứng dụng đối đẳng (peer application) biểu thị ứng dụng đang sử dụng socket đối đẳng đó. Đôi khi, thuật ngữ từ xa (remote hoặc foreign) được dùng đồng nghĩa với peer. Tương tự, đôi khi thuật ngữ cục bộ (local) được dùng để chỉ ứng dụng, socket, hoặc địa chỉ ở phía đầu này của kết nối. Một stream socket chỉ có thể được kết nối với một peer duy nhất.

Datagram socket (`SOCK_DGRAM`) cho phép trao đổi dữ liệu dưới dạng các thông điệp được gọi là datagram. Với datagram socket, ranh giới thông điệp được bảo toàn, nhưng việc truyền dữ liệu là không đáng tin cậy (unreliable). Các thông điệp có thể đến không đúng thứ tự, bị lặp lại, hoặc hoàn toàn không đến nơi.

Datagram socket là một ví dụ về khái niệm tổng quát hơn là socket phi kết nối (connectionless socket). Không giống như stream socket, datagram socket không cần phải kết nối với một socket khác để có thể sử dụng. (Ở Mục [56.6.2,](#page-13-0) chúng ta sẽ thấy rằng datagram socket có thể được kết nối với nhau, nhưng điều này có ngữ nghĩa hơi khác so với các stream socket đã kết nối).

Trong miền Internet, datagram socket sử dụng Giao thức Gói tin Người dùng (User Datagram Protocol - UDP), và stream socket (thường) sử dụng Giao thức Điều khiển Truyền vận (Transmission Control Protocol - TCP). Thay vì sử dụng các thuật ngữ datagram socket miền Internet và stream socket miền Internet, chúng ta thường sẽ chỉ dùng các thuật ngữ tương ứng là UDP socket và TCP socket.

## Các System Call của Socket

Các System Call (lời gọi hệ thống) socket chính bao gồm:

- System Call `socket()` tạo ra một socket mới.
- System Call `bind()` gắn (bind) một socket với một địa chỉ. Thông thường, một server sử dụng lời gọi này để gắn socket của nó vào một địa chỉ nổi tiếng (well-known address) để các client có thể định vị được socket đó.
- System Call `listen()` cho phép một stream socket chấp nhận các kết nối đến từ các socket khác.
- System Call `accept()` chấp nhận một kết nối từ một ứng dụng đối tác (peer application) trên một stream socket đang lắng nghe (listening stream socket), và tùy chọn trả về địa chỉ của socket đối tác đó.
- System Call `connect()` thiết lập kết nối với một socket khác.

Trên hầu hết các kiến trúc Linux (ngoại trừ Alpha và IA-64), tất cả các system call socket thực chất được cài đặt như các hàm thư viện được ghép kênh (multiplexed) thông qua một system call duy nhất là `socketcall()`. (Đây là hệ quả từ quá trình phát triển ban đầu của việc cài đặt socket trên Linux như một dự án độc lập.) Mặc dù vậy, trong cuốn sách này, chúng ta vẫn gọi tất cả các hàm này là các system call, vì đó là cách gọi của chúng trong bản cài đặt BSD gốc, cũng như trong nhiều cài đặt UNIX đương đại khác.

I/O của socket có thể được thực hiện bằng cách sử dụng các system call truyền thống là `read()` và `write()`, hoặc sử dụng một loạt các system call dành riêng cho socket (ví dụ: `send()`, `recv()`, `sendto()`, và `recvfrom()`). Theo mặc định, các system call này sẽ ở trạng thái chặn (block) nếu thao tác I/O không thể hoàn thành ngay lập tức. Nonblocking I/O (I/O không chặn) cũng khả thi bằng cách sử dụng thao tác `fcntl()` `F_SETFL` (Mục 5.3) để bật cờ trạng thái mở tệp `O_NONBLOCK`.

> Trên Linux, chúng ta có thể gọi `ioctl(fd, FIONREAD, &cnt)` để lấy số lượng byte chưa đọc có sẵn trên stream socket được tham chiếu bởi file descriptor (mô tả tệp) `fd`. Đối với một datagram socket, thao tác này trả về số lượng byte trong datagram chưa đọc tiếp theo (có thể bằng không nếu datagram tiếp theo có độ dài bằng không), hoặc trả về không nếu không có datagram nào đang chờ xử lý. Tính năng này không được chỉ định trong tiêu chuẩn SUSv3.

## 56.2 Tạo một Socket: socket()

System call `socket()` tạo ra một socket mới.

```
## include <sys/socket.h>
int socket(int domain, int type, int protocol);
                                Returns file descriptor on success, or –1 on error
```

Đối số `domain` chỉ định miền truyền thông (communication domain) cho socket. Đối số `type` chỉ định kiểu socket (socket type). Đối số này thường được chỉ định là `SOCK_STREAM` để tạo một stream socket, hoặc `SOCK_DGRAM` để tạo một datagram socket.

Đối số `protocol` luôn được chỉ định là 0 đối với các kiểu socket mà chúng ta mô tả trong cuốn sách này. Các giá trị protocol khác không được sử dụng với một số kiểu socket mà chúng ta không mô tả. Ví dụ, `protocol` được chỉ định là `IPPROTO_RAW` cho các raw socket (`SOCK_RAW`).

Khi thành công, `socket()` trả về một file descriptor được dùng để tham chiếu đến socket mới được tạo trong các system call tiếp theo.

> Bắt đầu từ kernel phiên bản 2.6.27, Linux cung cấp một cách sử dụng thứ hai cho đối số `type`, bằng cách cho phép kết hợp hai cờ phi tiêu chuẩn (nonstandard flags) bằng phép toán OR với kiểu socket. Cờ `SOCK_CLOEXEC` khiến kernel bật cờ close-on-exec (`FD_CLOEXEC`) cho file descriptor mới. Cờ này hữu ích vì những lý do tương tự như cờ `open()` `O_CLOEXEC` được mô tả tại Mục 4.3.1. Cờ `SOCK_NONBLOCK` khiến kernel thiết lập cờ `O_NONBLOCK` trên mô tả tệp mở (open file description) bên dưới, sao cho các thao tác I/O trong tương lai trên socket sẽ ở chế độ không chặn (nonblocking). Điều này giúp tiết kiệm các lời gọi `fcntl()` bổ sung để đạt được cùng một kết quả.

## 56.3 Gắn Socket vào một Địa chỉ: bind()

System call `bind()` gắn một socket vào một địa chỉ.

```
## include <sys/socket.h>
int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
                                             Returns 0 on success, or –1 on error
```

Đối số `sockfd` là một file descriptor lấy từ lời gọi `socket()` trước đó. Đối số `addr` là một con trỏ trỏ đến một cấu trúc (structure) chỉ định địa chỉ mà socket này sẽ được gắn vào. Kiểu của cấu trúc được truyền vào đối số này phụ thuộc vào miền socket (socket domain). Đối số `addrlen` chỉ định kích thước của cấu trúc địa chỉ. Kiểu dữ liệu `socklen_t` được sử dụng cho đối số `addrlen` là một kiểu số nguyên được chỉ định bởi SUSv3.

Thông thường, chúng ta gắn socket của server vào một địa chỉ nổi tiếng—tức là một địa chỉ cố định đã được biết trước đối với các ứng dụng client cần giao tiếp với server đó.

> Có những khả năng khác ngoài việc gắn socket của server vào một địa chỉ nổi tiếng. Ví dụ, đối với một Internet domain socket, server có thể bỏ qua lời gọi `bind()` và đơn giản gọi `listen()`, điều này khiến kernel tự động chọn một cổng tạm thời (ephemeral port) cho socket đó. (Chúng ta mô tả các cổng tạm thời tại Mục [58.6.1.](#page-39-0)) Sau đó, server có thể sử dụng `getsockname()` (Mục [61.5](#page-114-0)) để truy xuất địa chỉ của socket của nó. Trong kịch bản này, server sau đó phải công bố (publish) địa chỉ đó để các client biết cách định vị socket của server. Việc công bố này có thể được thực hiện bằng cách đăng ký địa chỉ của server với một ứng dụng dịch vụ thư mục tập trung (centralized directory service application) mà các client sau đó sẽ liên hệ để lấy địa chỉ. (Ví dụ, Sun RPC giải quyết vấn đề này bằng cách sử dụng server portmapper của nó.) Tất nhiên, socket của ứng dụng dịch vụ thư mục phải nằm ở một địa chỉ nổi tiếng.

## 56.4 Cấu trúc Địa chỉ Socket Tổng quát: struct sockaddr

Các tham số addr và addrlen trong hàm bind() cần được giải thích thêm. Nhìn vào Bảng 56-1, chúng ta thấy rằng mỗi miền socket (socket domain) sử dụng một định dạng địa chỉ khác nhau. Ví dụ, UNIX domain socket sử dụng đường dẫn (pathnames), trong khi Internet domain socket sử dụng sự kết hợp giữa địa chỉ IP và số hiệu cổng (port number). Đối với mỗi miền socket, một kiểu cấu trúc khác nhau được định nghĩa để lưu trữ địa chỉ socket. Tuy nhiên, vì các System Call (lời gọi hệ thống) như bind() mang tính tổng quát cho tất cả các miền socket, chúng phải có khả năng chấp nhận các cấu trúc địa chỉ của bất kỳ kiểu nào. Để cho phép điều này, API socket định nghĩa một cấu trúc địa chỉ tổng quát là struct sockaddr. Mục đích duy nhất của kiểu này là ép kiểu (cast) các cấu trúc địa chỉ đặc thù của từng miền thành một kiểu duy nhất để sử dụng làm tham số trong các System Call của socket. Cấu trúc sockaddr thường được định nghĩa như sau:

```c
struct sockaddr {
 sa_family_t sa_family; /* Address family (AF_* constant) */
 char sa_data[14]; /* Socket address (size varies
 according to socket domain) */
};
```

Cấu trúc này đóng vai trò là một mẫu (template) cho tất cả các cấu trúc địa chỉ đặc thù theo miền. Mỗi cấu trúc địa chỉ này đều bắt đầu bằng một trường họ (family field) tương ứng với trường sa_family của cấu trúc sockaddr. (Kiểu dữ liệu sa_family_t là một kiểu số nguyên được quy định trong SUSv3.) Giá trị trong trường family là đủ để xác định kích thước và định dạng của địa chỉ được lưu trữ trong phần còn lại của cấu trúc.

> Một số cài đặt UNIX cũng định nghĩa một trường bổ sung trong cấu trúc sockaddr, đó là sa_len, chỉ định tổng kích thước của cấu trúc. SUSv3 không yêu cầu trường này, và nó không có mặt trong bản cài đặt Linux của sockets API.

Nếu chúng ta định nghĩa macro kiểm tra tính năng `_GNU_SOURCE`, thì glibc sẽ tạo nguyên mẫu (prototype) cho các System Call socket khác nhau trong `<sys/socket.h>` bằng cách sử dụng một tiện ích mở rộng của gcc (gcc extension), giúp loại bỏ nhu cầu phải ép kiểu `(struct sockaddr *)`. Tuy nhiên, việc phụ thuộc vào tính năng này sẽ làm mất tính di động (sẽ dẫn đến các cảnh báo biên dịch trên các hệ thống khác).

## 56.5 Stream Socket (Socket Kiểu Luồng)

Hoạt động của stream socket có thể được giải thích thông qua phép ẩn dụ với hệ thống điện thoại:

- 1. System Call socket(), dùng để tạo một socket, tương đương với việc lắp đặt một điện thoại. Để hai ứng dụng có thể giao tiếp, mỗi ứng dụng phải tạo một socket.
- 2. Giao tiếp thông qua stream socket tương tự như một cuộc gọi điện thoại. Một ứng dụng phải kết nối socket của nó với socket của ứng dụng khác trước khi quá trình giao tiếp có thể diễn ra. Hai socket được kết nối như sau:
  - a) Một ứng dụng gọi bind() để liên kết (bind) socket với một địa chỉ nổi tiếng (well-known address), và sau đó gọi listen() để thông báo cho kernel (nhân hệ điều hành) về việc nó sẵn sàng chấp nhận các kết nối đến. Bước này tương tự như việc có một số điện thoại được biết trước và đảm bảo rằng điện thoại của chúng ta đã được bật để mọi người có thể gọi đến.
  - b) Ứng dụng còn lại thiết lập kết nối bằng cách gọi connect(), chỉ định địa chỉ của socket mà kết nối sẽ được hướng tới. Hành động này tương tự như việc quay số điện thoại của ai đó.
  - c) Ứng dụng đã gọi listen() sau đó chấp nhận kết nối bằng cách sử dụng accept(). Việc này tương tự như việc nhấc ống nghe điện thoại khi nó đổ chuông. Nếu hàm accept() được thực thi trước khi ứng dụng ngang hàng (peer application) gọi connect(), thì accept() sẽ bị chặn (block) ("chờ bên điện thoại").
- 3. Khi một kết nối đã được thiết lập, dữ liệu có thể được truyền theo cả hai hướng giữa các ứng dụng (tương tự như một cuộc trò chuyện điện thoại hai chiều) cho đến khi một trong số chúng đóng kết nối bằng cách sử dụng close(). Quá trình giao tiếp được thực hiện bằng cách sử dụng các System Call read() và write() thông thường hoặc thông qua một số System Call đặc thù của socket (như send() và recv()) cung cấp các tính năng bổ sung.

[Hình 56-1](#page-7-0) minh họa việc sử dụng các System Call đi kèm với stream socket.

### Socket chủ động và socket thụ động (Active and passive sockets)

Stream socket thường được phân biệt thành socket chủ động (active) hoặc thụ động (passive):

- Theo mặc định, một socket được tạo bằng socket() là một socket chủ động. Socket chủ động có thể được sử dụng trong lời gọi connect() để thiết lập kết nối tới một socket thụ động. Quá trình này được gọi là thực hiện mở chủ động (active open).
- Socket thụ động (còn gọi là listening socket - socket lắng nghe) là socket đã được đánh dấu để cho phép các kết nối đến bằng cách gọi listen(). Việc chấp nhận một kết nối đến được gọi là thực hiện mở thụ động (passive open).

Trong hầu hết các ứng dụng sử dụng stream socket, Server (máy chủ) thực hiện mở thụ động, và Client (máy khách) thực hiện mở chủ động. Chúng ta sẽ mặc định kịch bản này trong các phần tiếp theo, do đó thay vì nói "ứng dụng thực hiện mở socket chủ động", chúng ta thường sẽ gọi đơn giản là "client". Tương tự, chúng ta sẽ đồng nhất "server" với "ứng dụng thực hiện mở socket thụ động".

![](_page_7_Figure_1.jpeg)

**Hình 56-1:** Tổng quan về các System Call được sử dụng với Stream Socket

### 56.5.1 Lắng nghe các kết nối đến: listen()

System Call `listen()` đánh dấu stream socket được trỏ bởi File Descriptor `sockfd` là thụ động (passive). Socket này sau đó sẽ được sử dụng để chấp nhận các kết nối từ các socket khác (đang hoạt động - active).

```
## include <sys/socket.h>
int listen(int sockfd, int backlog);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Chúng ta không thể áp dụng `listen()` cho một socket đã được kết nối — nghĩa là một socket mà hàm `connect()` đã được thực thi thành công hoặc một socket được trả về bởi một lời gọi `accept()`.

Để hiểu mục đích của tham số `backlog`, trước tiên chúng ta lưu ý rằng client có thể gọi `connect()` trước khi server gọi `accept()`. Điều này có thể xảy ra, ví dụ, do server đang bận xử lý (các) client khác. Kết quả là tạo ra một kết nối đang chờ xử lý (pending connection), như được minh họa trong [Hình 56-2](#page-8-0).

## **Socket thụ động** (server) **Socket chủ động** (client) có thể bị block, tùy thuộc vào số lượng yêu cầu kết nối đang chờ xử lý socket() bind() listen() accept() socket() connect()

**Hình 56-2:** Một kết nối socket đang chờ xử lý

Kernel phải ghi lại một số thông tin về mỗi yêu cầu kết nối đang chờ xử lý để lời gọi `accept()` tiếp theo có thể được xử lý. Tham số `backlog` cho phép chúng ta giới hạn số lượng các kết nối đang chờ xử lý như vậy. Các yêu cầu kết nối đạt đến giới hạn này sẽ thành công ngay lập tức. (Đối với TCP socket, câu chuyện phức tạp hơn một chút, như chúng ta sẽ thấy ở Mục [61.6.4](#page-121-0)). Các yêu cầu kết nối tiếp theo sẽ bị block cho đến khi một kết nối đang chờ được chấp nhận (thông qua `accept()`), và do đó bị loại khỏi hàng đợi các kết nối đang chờ xử lý.

SUSv3 cho phép một bản cài đặt (implementation) đặt giới hạn trên cho giá trị có thể được chỉ định cho `backlog`, và cho phép bản cài đặt tự động làm tròn giá trị `backlog` xuống giới hạn này mà không cần thông báo. SUSv3 quy định rằng bản cài đặt nên công bố giới hạn này bằng cách định nghĩa hằng số `SOMAXCONN` trong `<sys/socket.h>`. Trên Linux, hằng số này được định nghĩa với giá trị 128. Tuy nhiên, kể từ phiên bản Kernel 2.4.25, Linux cho phép giới hạn này được điều chỉnh tại thời điểm chạy (run time) thông qua tệp `/proc/sys/net/core/somaxconn` đặc trưng của Linux. (Ở các phiên bản Kernel trước đó, giới hạn `SOMAXCONN` là cố định và không thể thay đổi).

> Trong bản cài đặt BSD sockets gốc, giới hạn trên cho `backlog` là 5, và chúng ta có thể thấy con số này được chỉ định trong mã nguồn cũ. Tất cả các bản cài đặt hiện đại đều cho phép các giá trị `backlog` lớn hơn, điều này là cần thiết cho các máy chủ mạng sử dụng TCP socket để phục vụ số lượng lớn các client.

### 56.5.2 Chấp nhận một kết nối: accept()

System Call `accept()` chấp nhận một kết nối đến trên stream socket đang lắng nghe được trỏ bởi File Descriptor `sockfd`. Nếu không có kết nối nào đang chờ xử lý khi `accept()` được gọi, lời gọi này sẽ bị block cho đến khi có yêu cầu kết nối đến.

```
## include <sys/socket.h>
int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
                               Trả về File Descriptor khi thành công, hoặc –1 khi lỗi
```

Điểm cốt lõi cần hiểu về `accept()` là nó tạo ra một socket mới, và chính socket mới này được kết nối với socket đối tác (peer socket) đã thực hiện hàm `connect()`. File Descriptor cho socket đã kết nối được trả về như kết quả hàm của lời gọi `accept()`. Socket đang lắng nghe (`sockfd`) vẫn giữ nguyên trạng thái mở và có thể được sử dụng để chấp nhận các kết nối tiếp theo. Một ứng dụng server điển hình tạo ra một socket lắng nghe, bind nó với một địa chỉ nổi tiếng (well-known address), và sau đó xử lý tất cả các yêu cầu của client bằng cách chấp nhận các kết nối thông qua socket đó.

Các tham số còn lại của `accept()` trả về địa chỉ của socket đối tác. Tham số `addr` trỏ đến một cấu trúc được sử dụng để trả về địa chỉ socket. Kiểu dữ liệu của tham số này phụ thuộc vào domain của socket (giống như `bind()`).

Tham số `addrlen` là một tham số kiểu giá trị-kết quả (value-result argument). Nó trỏ đến một số nguyên mà trước khi gọi hàm, phải được khởi tạo bằng kích thước của vùng đệm (buffer) do `addr` trỏ tới, để Kernel biết có bao nhiêu không gian khả dụng để trả về địa chỉ socket. Sau khi `accept()` trả về, số nguyên này được thiết lập để chỉ ra số byte dữ liệu thực sự được sao chép vào bộ đệm.

Nếu chúng ta không quan tâm đến địa chỉ của socket đối tác, thì `addr` và `addrlen` lần lượt được chỉ định là `NULL` và `0`. (Nếu muốn, chúng ta có thể truy xuất địa chỉ của đối tác sau đó bằng cách sử dụng System Call `getpeername()`, như được mô tả trong Mục [61.5](#page-114-0)).

> Bắt đầu từ Kernel 2.6.28, Linux hỗ trợ một System Call mới, phi tiêu chuẩn là `accept4()`. System Call này thực hiện tác vụ giống như `accept()`, nhưng hỗ trợ thêm một tham số `flags`, có thể được sử dụng để sửa đổi hành vi của System Call. Hai cờ (flag) được hỗ trợ: `SOCK_CLOEXEC` và `SOCK_NONBLOCK`. Cờ `SOCK_CLOEXEC` khiến Kernel bật cờ close-on-exec (`FD_CLOEXEC`) cho File Descriptor mới được trả về bởi lời gọi. Cờ này hữu ích vì những lý do tương tự như cờ `O_CLOEXEC` của hàm `open()` được mô tả trong Mục 4.3.1. Cờ `SOCK_NONBLOCK` khiến Kernel bật cờ `O_NONBLOCK` trên Open File Description cơ sở, do đó các hoạt động I/O trong tương lai trên socket sẽ là không đồng bộ (nonblocking). Điều này giúp tiết kiệm các lời gọi `fcntl()` bổ sung để đạt được cùng một kết quả.

### 56.5.3 Kết nối tới một Socket Ngang hàng: connect()

System Call `connect()` kết nối socket chủ động được trỏ bởi File Descriptor `sockfd` với socket lắng nghe có địa chỉ được chỉ định bởi `addr` và `addrlen`.

```
## include <sys/socket.h>
int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
                                            Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Các tham số `addr` và `addrlen` được chỉ định theo cách tương tự như các tham số tương ứng trong `bind()`.

Nếu `connect()` thất bại và chúng ta muốn thử lại kết nối, thì SUSv3 quy định rằng phương pháp di động (portable) để thực hiện điều này là đóng socket (`close`), tạo một socket mới, và thử lại kết nối với socket mới đó.

### 56.5.4 Nhập/Xuất (I/O) trên Stream Socket

Một cặp stream socket được kết nối cung cấp một kênh giao tiếp hai chiều (bidirectional) giữa hai điểm cuối (endpoint). [Hình 56-3](#page-10-0) minh họa điều này trông như thế nào trong miền UNIX (UNIX domain).

![](_page_10_Figure_2.jpeg)

**Hình 56-3:** Stream socket miền UNIX cung cấp kênh giao tiếp hai chiều

Ngữ nghĩa của I/O trên các stream socket được kết nối tương tự như đối với các đường ống (pipe):

- Để thực hiện I/O, chúng ta sử dụng các system call `read()` và `write()` (hoặc các hàm `send()` và `recv()` dành riêng cho socket, được mô tả trong Mục [61.3](#page-110-0)). Vì các socket mang tính hai chiều, cả hai lời gọi này đều có thể được sử dụng ở mỗi đầu của kết nối.
- Một socket có thể được đóng bằng system call `close()` hoặc do ứng dụng bị chấm dứt (terminating). Sau đó, khi ứng dụng ngang hàng (peer application) cố gắng đọc từ đầu bên kia của kết nối, nó sẽ nhận được tín hiệu kết thúc tệp — end-of-file (sau khi tất cả dữ liệu được đệm đã được đọc). Nếu ứng dụng ngang hàng cố gắng ghi vào socket của nó, nó sẽ nhận được tín hiệu `SIGPIPE`, và system call sẽ thất bại với mã lỗi `EPIPE`. Như chúng ta đã lưu ý trong Mục 44.2, cách thông thường để xử lý khả năng này là bỏ qua tín hiệu `SIGPIPE` và nhận biết về kết nối đã đóng thông qua lỗi `EPIPE`.

### 56.5.5 Chấm dứt Kết nối: close()

Cách thông thường để chấm dứt kết nối stream socket là gọi `close()`. Nếu có nhiều file descriptor cùng trỏ đến một socket, thì kết nối sẽ chỉ bị chấm dứt khi tất cả các descriptor đó đã được đóng.

Giả sử rằng, sau khi chúng ta đóng kết nối, ứng dụng ngang hàng gặp sự cố (crash) hoặc không đọc hoặc xử lý chính xác dữ liệu mà chúng ta đã gửi cho nó trước đó. Trong trường hợp này, chúng ta không có cách nào để biết rằng lỗi đã xảy ra. Nếu chúng ta cần đảm bảo rằng dữ liệu đã được đọc và xử lý thành công, thì chúng ta phải xây dựng một số loại giao thức xác nhận (acknowledgement protocol) vào ứng dụng của mình. Điều này thường bao gồm một thông điệp xác nhận tường minh được truyền ngược lại cho chúng ta từ phía ngang hàng.

Trong Mục [61.2,](#page-107-0) chúng ta mô tả system call `shutdown()`, cung cấp khả năng kiểm soát chi tiết hơn về cách đóng kết nối stream socket.

## 56.6 Datagram Socket

Hoạt động của datagram socket có thể được giải thích thông qua phép loại suy với hệ thống bưu chính:

1. System call `socket()` tương đương với việc thiết lập một hộp thư. (Ở đây, chúng ta giả định một hệ thống giống như dịch vụ bưu chính nông thôn ở một số quốc gia, nơi vừa nhận thư từ vừa phát thư đến hộp thư). Mỗi ứng dụng muốn gửi hoặc nhận datagram sẽ tạo một datagram socket bằng cách sử dụng `socket()`.

- 2. Để cho phép ứng dụng khác gửi datagram (thư) cho mình, một ứng dụng sử dụng `bind()` để liên kết socket của nó với một địa chỉ nổi tiếng (well-known address). Thông thường, một máy chủ (server) liên kết socket của nó với một địa chỉ nổi tiếng, và một máy khách (client) khởi 1t quá trình giao tiếp bằng cách gửi một datagram đến địa chỉ đó. (Trong một số miền — đặc biệt là miền UNIX — máy khách cũng có thể cần sử dụng `bind()` để gán một địa chỉ cho socket của nó nếu nó muốn nhận datagram do máy chủ gửi tới).
- 3. Để gửi một datagram, ứng dụng gọi `sendto()`, nhận một trong các tham số là địa chỉ của socket mà datagram sẽ được gửi tới. Điều này tương tự như việc ghi địa chỉ người nhận lên một lá thư và đem đi gửi bưu điện.
- 4. Để nhận một datagram, ứng dụng gọi `recvfrom()`, hàm này có thể bị chặn (block) nếu chưa có datagram nào đến. Vì `recvfrom()` cho phép chúng ta lấy được địa chỉ của người gửi, chúng ta có thể gửi lại phản hồi nếu muốn. (Điều này rất hữu ích nếu socket của người gửi được liên kết với một địa chỉ không nổi tiếng, điều này điển hình ở máy khách). Ở đây, chúng ta kéo dài phép loại suy ra một chút, vì không có yêu cầu bắt buộc là một lá thư được gửi phải được đánh dấu bằng địa chỉ của người gửi.
- 5. Khi không còn cần thiết phải sử dụng socket nữa, ứng dụng sẽ đóng nó lại bằng `close()`.

Giống như hệ thống bưu chính, khi nhiều datagram (lá thư) được gửi từ địa chỉ này sang địa chỉ khác, không có gì đảm bảo rằng chúng sẽ đến theo thứ tự chúng được gửi, hoặc thậm chí là có đến nơi hay không. Datagram bổ sung thêm một khả năng nữa không có trong hệ thống bưu chính: vì các giao thức mạng bên dưới đôi khi có thể truyền lại (retransmit) một gói dữ liệu, nên cùng một datagram có thể đến nhiều hơn một lần.

[Hình 56-4](#page-11-0) minh họa việc sử dụng các system call (lệnh gọi hệ thống) được áp dụng với socket dạng gói tin (datagram socket).

![](_page_11_Figure_6.jpeg)

**Hình 56-4:** Tổng quan về các system call được sử dụng với datagram socket

### 56.6.1 Trao đổi Datagram: recvfrom() và sendto()

Các system call `recvfrom()` và `sendto()` dùng để nhận và gửi các datagram trên một datagram socket.

```
## include <sys/socket.h>
ssize_t recvfrom(int sockfd, void *buffer, size_t length, int flags,
 struct sockaddr *src_addr, socklen_t *addrlen);
                  Trả về số byte đã nhận, 0 khi gặp EOF, hoặc –1 nếu có lỗi
ssize_t sendto(int sockfd, const void *buffer, size_t length, int flags,
 const struct sockaddr *dest_addr, socklen_t addrlen);
                                 Trả về số byte đã gửi, hoặc –1 nếu có lỗi
```

Giá trị trả về và ba tham số đầu tiên của các system call này tương tự như đối với `read()` và `write()`.

Tham số thứ tư, `flags`, là một mặt nạ bit (bit mask) điều khiển các tính năng I/O đặc thù của socket. Chúng ta sẽ đề cập đến các tính năng này khi mô tả các system call `recv()` và `send()` tại Mục [61.3](#page-110-0). Nếu không cần sử dụng bất kỳ tính năng nào trong số này, chúng ta có thể đặt `flags` là 0.

Các tham số `src_addr` và `addrlen` được sử dụng để lấy hoặc chỉ định địa chỉ của socket đối tác (peer socket) mà chúng ta đang giao tiếp.

Đối với `recvfrom()`, các tham số `src_addr` và `addrlen` trả về địa chỉ của socket từ xa đã được dùng để gửi datagram. (Các tham số này tương tự như các tham số `addr` và `addrlen` của `accept()`, vốn trả về địa chỉ của một peer socket đang kết nối). Tham số `src_addr` là một con trỏ trỏ tới cấu trúc địa chỉ phù hợp với miền giao tiếp (communication domain). Giống như `accept()`, `addrlen` là một tham số kiểu giá trị-kết quả (value-result argument). Trước khi gọi, `addrlen` phải được khởi tạo bằng kích thước của cấu trúc mà `src_addr` trỏ tới; khi trả về, nó chứa số byte thực sự được ghi vào cấu trúc này.

Nếu chúng ta không quan tâm đến địa chỉ của người gửi, chúng ta có thể đặt cả `src_addr` và `addrlen` thành `NULL`. Trong trường hợp này, `recvfrom()` tương đương với việc sử dụng `recv()` để nhận một datagram. Chúng ta cũng có thể sử dụng `read()` để đọc một datagram, thao tác này tương đương với việc sử dụng `recv()` với tham số `flags` bằng 0.

Bất kể giá trị được chỉ định cho `length` là gì, `recvfrom()` sẽ lấy chính xác một thông điệp (message) từ một datagram socket. Nếu kích thước của thông điệp đó vượt quá `length` byte, thông điệp sẽ bị cắt bớt một cách âm thầm (silently truncated) xuống còn `length` byte.

> Nếu chúng ta sử dụng system call `recvmsg()` (Mục [61.13.2](#page-135-0)), thì có thể phát hiện ra một datagram bị cắt bớt thông qua cờ `MSG_TRUNC` được trả về trong trường `msg_flags` của cấu trúc `msghdr` nhận được. Xem trang hướng dẫn (manual page) `recvmsg(2)` để biết thêm chi tiết.

Đối với `sendto()`, các tham số `dest_addr` và `addrlen` chỉ định socket mà datagram sẽ được gửi đến. Các tham số này được sử dụng theo cách tương tự như các tham số tương ứng trong `connect()`. Tham số `dest_addr` là một cấu trúc địa chỉ phù hợp cho miền giao tiếp này. Nó được khởi tạo với địa chỉ của socket đích. Tham số `addrlen` chỉ định kích thước của `addr`.

> Trên Linux, có thể sử dụng `sendto()` để gửi các datagram có độ dài bằng 0. Tuy nhiên, không phải mọi cài đặt UNIX đều cho phép điều này.

### 56.6.2 Sử dụng connect() với Datagram Socket

Mặc dù datagram socket là loại không kết nối (connectionless), system call `connect()` vẫn có một mục đích sử dụng khi áp dụng cho datagram socket. Việc gọi `connect()` trên một datagram socket khiến kernel ghi lại một địa chỉ cụ thể làm socket đối tác (peer) của socket này. Thuật ngữ datagram socket đã kết nối (connected datagram socket) được dùng cho loại socket như vậy. Thuật ngữ datagram socket chưa kết nối (unconnected datagram socket) được dùng cho datagram socket mà hàm `connect()` chưa được gọi trên đó (tức là trạng thái mặc định của một datagram socket mới).

Sau khi một datagram socket đã được kết nối:

- Các datagram có thể được gửi qua socket bằng cách sử dụng `write()` (hoặc `send()`) và được tự động gửi đến cùng một peer socket. Giống như `sendto()`, mỗi lời gọi `write()` sẽ tạo ra một datagram riêng biệt.
- Chỉ các datagram được gửi bởi peer socket mới có thể được đọc trên socket này.

Lưu ý rằng hiệu ứng của `connect()` mang tính bất đối xứng (asymmetric) đối với datagram socket. Các tuyên bố trên chỉ áp dụng cho socket mà `connect()` đã được gọi, chứ không áp dụng cho socket từ xa mà nó kết nối tới (trừ khi ứng dụng phía bên kia cũng gọi `connect()` trên socket của họ).

Chúng ta có thể thay đổi socket đối tác của một datagram socket đã kết nối bằng cách thực hiện một lời gọi `connect()` tiếp theo. Cũng có thể hủy bỏ hoàn toàn mối liên kết đối tác bằng cách chỉ định một cấu trúc địa chỉ trong đó họ địa chỉ (chẳng hạn như trường `sun_family` trong miền UNIX) được chỉ định là `AF_UNSPEC`. Tuy nhiên, lưu ý rằng nhiều cài đặt UNIX khác không hỗ trợ việc sử dụng `AF_UNSPEC` cho mục đích này.

> SUSv3 có phần mơ hồ về việc hủy bỏ mối liên kết đối tác, nêu rằng một kết nối có thể được thiết lập lại bằng cách thực hiện lời gọi `connect()` chỉ định một "địa chỉ null", mà không định nghĩa thuật ngữ đó. SUSv4 quy định rõ ràng việc sử dụng `AF_UNSPEC`.

Ưu điểm hiển nhiên của việc thiết lập peer (nút ngang hàng/nút đối tác) cho một datagram socket (ổ cắm gói dữ liệu) là chúng ta có thể sử dụng các System Call (lời gọi hệ thống) I/O đơn giản hơn khi truyền dữ liệu trên socket. Chúng ta không cần phải sử dụng `sendto()` với các đối số `dest_addr` và `addrlen` nữa, thay vào đó có thể sử dụng `write()`. Việc thiết lập peer chủ yếu hữu ích trong một ứng dụng cần gửi nhiều datagram tới một peer duy nhất (vốn là điểm đặc trưng của một số datagram client).

> Trên một số triển khai TCP/IP, việc kết nối một datagram socket với một peer mang lại sự cải thiện về hiệu năng ([Stevens et al., 2004]). Trên Linux, việc kết nối một datagram socket tạo ra ít sự khác biệt đối với hiệu năng.

## 56.7 Tóm tắt

Socket cho phép giao tiếp giữa các ứng dụng trên cùng một host (máy chủ) hoặc trên các host khác nhau được kết nối thông qua mạng.

Một socket tồn tại trong một communication domain (miền giao tiếp), miền này quyết định phạm vi giao tiếp và định dạng địa chỉ được sử dụng để định danh socket. Tiêu chuẩn SUSv3 quy định các miền giao tiếp UNIX (`AF_UNIX`), IPv4 (`AF_INET`) và IPv6 (`AF_INET6`).

Hầu hết các ứng dụng sử dụng một trong hai loại socket: stream socket (ổ cắm luồng) hoặc datagram socket. Stream socket (`SOCK_STREAM`) cung cấp một kênh giao tiếp dạng luồng byte, đáng tin cậy, hai chiều giữa hai điểm cuối (endpoint). Datagram socket (`SOCK_DGRAM`) cung cấp giao tiếp hướng thông điệp, phi kết nối, không đảm bảo độ tin cậy.

Một stream socket server điển hình tạo socket của nó bằng cách sử dụng `socket()`, sau đó bind (ràng buộc) socket vào một địa chỉ nổi tiếng bằng cách sử dụng `bind()`. Server sau đó gọi `listen()` để cho phép các kết nối được tiếp nhận trên socket. Mỗi kết nối từ client sau đó được chấp nhận trên listening socket bằng cách sử dụng `accept()`, hàm này trả về một File Descriptor (mô tả tệp) cho một socket mới được kết nối với socket của client. Một stream socket client điển hình tạo một socket bằng cách sử dụng `socket()`, sau đó thiết lập kết nối bằng cách gọi `connect()`, chỉ định địa chỉ nổi tiếng của server. Sau khi hai stream socket được kết nối, dữ liệu có thể được truyền theo cả hai hướng bằng cách sử dụng `read()` và `write()`. Một khi tất cả các Process (tiến trình) có File Descriptor trỏ đến một điểm cuối của stream socket đã thực hiện thao tác `close()` ngầm định hoặc tường minh, kết nối sẽ bị chấm dứt.

Một datagram socket server điển hình tạo một socket bằng cách sử dụng `socket()`, sau đó bind nó vào một địa chỉ nổi tiếng bằng cách sử dụng `bind()`. Do datagram socket mang tính phi kết nối, socket của server có thể được sử dụng để nhận datagram từ bất kỳ client nào. Datagram có thể được nhận bằng cách sử dụng `read()` hoặc sử dụng System Call chuyên biệt cho socket là `recvfrom()`, hàm này trả về địa chỉ của socket gửi. Một datagram socket client tạo một socket bằng cách sử dụng `socket()`, sau đó sử dụng `sendto()` để gửi một datagram đến một địa chỉ được chỉ định (tức là địa chỉ của server). System Call `connect()` có thể được sử dụng với một datagram socket để thiết lập địa chỉ peer cho socket. Sau khi thực hiện việc này, không còn cần thiết phải chỉ định địa chỉ đích cho các datagram gửi đi nữa; một lời gọi `write()` có thể được sử dụng để gửi datagram.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê tại Mục [59.15.](#page-86-0)
