# Chương 57: SOCKET DOMAIN UNIX: UNIX DOMAIN SOCKETS

Chương này xem xét việc sử dụng các socket domain UNIX (UNIX domain socket), cho phép giao tiếp giữa các tiến trình (Process) trên cùng một hệ thống máy chủ (Host system). Chúng ta sẽ thảo luận về việc sử dụng cả socket kiểu hướng kết nối (stream socket) và socket kiểu bản tin (datagram socket) trong domain UNIX. Chúng ta cũng mô tả việc sử dụng quyền hạn tập tin (File permissions) để kiểm soát quyền truy cập vào các UNIX domain socket, việc sử dụng hàm `socketpair()` để tạo một cặp UNIX domain socket được kết nối với nhau, và không gian tên socket ẩn danh (abstract socket namespace) trên Linux.

## 57.1 Địa chỉ Socket Domain UNIX: struct sockaddr\_un

Trong UNIX domain, một địa chỉ socket (Socket address) có dạng là một đường dẫn (Pathname), và cấu trúc địa chỉ socket đặc trưng cho domain này được định nghĩa như sau:

```c
struct sockaddr_un {
 sa_family_t sun_family; /* Luôn là AF_UNIX */
 char sun_path[108]; /* Đường dẫn socket kết thúc bằng null-byte */
};
```

Tiền tố `sun_` trong các trường của cấu trúc `sockaddr_un` không liên quan gì đến hãng Sun Microsystems; thay vào đó, nó bắt nguồn từ cụm từ "socket unix".

SUSv3 không quy định kích thước của trường `sun_path`. Các phiên bản BSD đời đầu sử dụng 108 và 104 byte, và một phiên bản hiện đại (HP-UX 11) sử dụng 92 byte. Các ứng dụng có tính di động cao (Portable application) nên mã hóa dựa trên giá trị nhỏ hơn này, đồng thời sử dụng hàm `snprintf()` hoặc `strncpy()` để tránh tràn bộ đệm (Buffer overflow) khi ghi vào trường này.

Để gán (bind) một UNIX domain socket với một địa chỉ, chúng ta khởi tạo một cấu trúc `sockaddr_un`, sau đó truyền con trỏ (đã được ép kiểu) tới cấu trúc này làm đối số `addr` cho hàm `bind()`, đồng thời chỉ định `addrlen` là kích thước của cấu trúc, như được minh họa trong [Liệt kê 57-1.](#page-17-0)

**Liệt kê 57-1:** Gán địa chỉ cho một UNIX domain socket

```c
 const char *SOCKNAME = "/tmp/mysock";
 int sfd;
 struct sockaddr_un addr;
 sfd = socket(AF_UNIX, SOCK_STREAM, 0); /* Tạo socket */
 if (sfd == -1)
 errExit("socket");
 memset(&addr, 0, sizeof(struct sockaddr_un)); /* Xóa sạch cấu trúc */
 addr.sun_family = AF_UNIX; /* Địa chỉ domain UNIX */
 strncpy(addr.sun_path, SOCKNAME, sizeof(addr.sun_path) - 1);
 if (bind(sfd, (struct sockaddr *) &addr, sizeof(struct sockaddr_un)) == -1)
 errExit("bind");
```

Việc gọi hàm `memset()` trong [Liệt kê 57-1](#page-17-0) đảm bảo rằng tất cả các trường trong cấu trúc đều mang giá trị 0. (Lệnh `strncpy()` tiếp theo tận dụng điều này bằng cách chỉ định đối số cuối cùng nhỏ hơn kích thước của trường `sun_path` một đơn vị, nhằm đảm bảo trường này luôn có một null-byte kết thúc). Việc sử dụng `memset()` để xóa toàn bộ cấu trúc thay vì khởi tạo từng trường riêng lẻ sẽ giúp đảm bảo rằng bất kỳ trường phi chuẩn nào được cung cấp bởi một số hệ thống triển khai cũng sẽ được khởi tạo về 0.

> Hàm `bzero()` có nguồn gốc từ BSD là một giải pháp thay thế cho `memset()` dùng để làm sạch nội dung của một cấu trúc. SUSv3 định nghĩa `bzero()` và hàm liên quan `bcopy()` (tương tự như `memmove()`), nhưng đánh dấu cả hai hàm này là LEGACY (cũ/kém ưu tiên), đồng thời lưu ý rằng `memset()` và `memmove()` được ưu tiên sử dụng hơn. SUSv4 đã loại bỏ hoàn toàn đặc tả kỹ thuật của `bzero()` và `bcopy()`.

Khi được sử dụng để gán địa chỉ cho một UNIX domain socket, hàm `bind()` sẽ tạo ra một mục nhập (Entry) trong hệ thống tập tin (File system). (Do đó, thư mục được chỉ định làm một phần của đường dẫn socket cần phải có quyền truy cập và quyền ghi). Quyền sở hữu của tập tin được xác định theo các quy tắc thông thường đối với việc tạo tập tin (Mục 15.3.1). Tập tin này được đánh dấu là một socket. Khi hàm `stat()` được gọi trên đường dẫn này, nó trả về giá trị `S_IFSOCK` trong thành phần loại tập tin của trường `st_mode` thuộc cấu trúc stat (Mục 15.1). Khi liệt kê bằng lệnh `ls -l`, một UNIX domain socket được hiển thị với ký tự `s` ở cột đầu tiên, và lệnh `ls -F` sẽ gắn thêm một dấu bằng (`=`) vào đường dẫn của socket đó.

> Mặc dù UNIX domain socket được nhận diện bằng các đường dẫn, hoạt động I/O trên các socket này không liên quan đến các thao tác trên thiết bị bên dưới (Underlying device).

Các điểm sau đây rất đáng chú ý khi thực hiện gán địa chỉ cho một UNIX domain socket:

- Chúng ta không thể gán socket vào một đường dẫn đã tồn tại (lệnh `bind()` sẽ thất bại với lỗi `EADDRINUSE`).
- Thông lệ phổ biến là gán socket vào một đường dẫn tuyệt đối (Absolute pathname), để socket nằm ở một địa chỉ cố định trong hệ thống tập tin. Việc sử dụng đường dẫn tương đối (Relative pathname) là có thể, nhưng hiếm khi xảy ra, bởi vì nó đòi hỏi ứng dụng muốn gọi `connect()` tới socket này phải biết thư mục làm việc hiện tại (Current working directory) của ứng dụng thực hiện lệnh `bind()`.
- Một socket chỉ có thể được gán cho tối đa một đường dẫn; ngược lại, một đường dẫn cũng chỉ có thể được gán cho tối đa một socket.
- Chúng ta không thể sử dụng hàm `open()` để mở một socket.
- Khi socket không còn cần thiết nữa, mục nhập đường dẫn của nó có thể (và thường là nên) được xóa bằng cách sử dụng hàm `unlink()` (hoặc `remove()`).

Trong phần lớn các chương trình ví dụ của chúng tôi, chúng tôi gán các UNIX domain socket vào các đường dẫn bên trong thư mục `/tmp`, bởi vì thư mục này thường luôn tồn tại và có quyền ghi trên mọi hệ thống. Điều này giúp cho bạn đọc dễ dàng chạy các chương trình này mà không cần phải chỉnh sửa lại đường dẫn socket trước. Tuy nhiên, hãy lưu ý rằng đây thường không phải là một kỹ thuật thiết kế tốt. Như đã chỉ ra trong Mục 38.7, việc tạo các tập tin trong các thư mục có quyền ghi công khai chẳng hạn như `/tmp` có thể dẫn đến các lỗ hổng bảo mật khác nhau. Ví dụ, bằng cách tạo một đường dẫn trong `/tmp` có tên trùng với tên mà socket của ứng dụng đang sử dụng, chúng ta có thể tạo ra một cuộc tấn công từ chối dịch vụ (Denial-of-Service - DoS) đơn giản. Các ứng dụng thực tế nên gán (`bind()`) các UNIX domain socket vào các đường dẫn tuyệt đối trong các thư mục được bảo mật thích hợp.

## 57.2 Stream Socket trong Miền UNIX (UNIX Domain Stream Socket)

Bây giờ chúng ta sẽ tìm hiểu một ứng dụng client-server đơn giản sử dụng stream socket trong miền UNIX (UNIX domain). Chương trình client [\(Liệt kê 57-4\)](#page-20-0) kết nối tới server và sử dụng kết nối đó để truyền dữ liệu từ luồng đầu vào chuẩn (standard input) của nó tới server. Chương trình server ([Liệt kê 57-3\)](#page-19-0) chấp nhận các kết nối từ client và truyền toàn bộ dữ liệu do client gửi qua kết nối ra luồng đầu ra chuẩn (standard output). Server này là một ví dụ đơn giản về một iterative server (server lặp) — một server xử lý từng client một trước khi chuyển sang client tiếp theo. (Chúng ta sẽ xem xét chi tiết hơn về thiết kế server trong Chương [60.](#page-90-0))

[Liệt kê 57-2](#page-18-0) là tệp tiêu đề (header file) được sử dụng bởi cả hai chương trình này.

**Liệt kê 57-2:** Tệp tiêu đề cho us\_xfr\_sv.c và us\_xfr\_cl.c ––––––––––––––––––––––––––––––––––––––––––––––––––––––––– **sockets/us\_xfr.h** #include <sys/un.h> #include <sys/socket.h> #include "tlpi\_hdr.h" #define SV\_SOCK\_PATH "/tmp/us\_xfr" #define BUF\_SIZE 100 ––––––––––––––––––––––––––––––––––––––––––––––––––––––––– **sockets/us\_xfr.h**

Trong các trang tiếp theo, trước tiên chúng ta trình bày mã nguồn của server và client, sau đó thảo luận về chi tiết của các chương trình này và đưa ra một ví dụ về cách sử dụng chúng.

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/us_xfr_sv.c
## include "us_xfr.h"
## define BACKLOG 5
int
main(int argc, char *argv[])
{
 struct sockaddr_un addr;
 int sfd, cfd;
 ssize_t numRead;
 char buf[BUF_SIZE];
 sfd = socket(AF_UNIX, SOCK_STREAM, 0);
 if (sfd == -1)
 errExit("socket");
 /* Construct server socket address, bind socket to it,
 and make this a listening socket */
 if (remove(SV_SOCK_PATH) == -1 && errno != ENOENT)
 errExit("remove-%s", SV_SOCK_PATH);
 memset(&addr, 0, sizeof(struct sockaddr_un));
 addr.sun_family = AF_UNIX;
 strncpy(addr.sun_path, SV_SOCK_PATH, sizeof(addr.sun_path) - 1);
 if (bind(sfd, (struct sockaddr *) &addr, sizeof(struct sockaddr_un)) == -1)
 errExit("bind");
 if (listen(sfd, BACKLOG) == -1)
 errExit("listen");
 for (;;) { /* Handle client connections iteratively */
 /* Accept a connection. The connection is returned on a new
 socket, 'cfd'; the listening socket ('sfd') remains open
 and can be used to accept further connections. */
 cfd = accept(sfd, NULL, NULL);
 if (cfd == -1)
 errExit("accept");
 /* Transfer data from connected socket to stdout until EOF */
 while ((numRead = read(cfd, buf, BUF_SIZE)) > 0)
 if (write(STDOUT_FILENO, buf, numRead) != numRead)
 fatal("partial/failed write");
 if (numRead == -1)
 errExit("read");
```

```
 if (close(cfd) == -1)
 errMsg("close");
 }
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/us_xfr_sv.c
Liệt kê 57-4: Một client stream socket miền UNIX đơn giản
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/us_xfr_cl.c
## include "us_xfr.h"
int
main(int argc, char *argv[])
{
 struct sockaddr_un addr;
 int sfd;
 ssize_t numRead;
 char buf[BUF_SIZE];
 sfd = socket(AF_UNIX, SOCK_STREAM, 0); /* Create client socket */
 if (sfd == -1)
 errExit("socket");
 /* Construct server address, and make the connection */
 memset(&addr, 0, sizeof(struct sockaddr_un));
 addr.sun_family = AF_UNIX;
 strncpy(addr.sun_path, SV_SOCK_PATH, sizeof(addr.sun_path) - 1);
 if (connect(sfd, (struct sockaddr *) &addr,
 sizeof(struct sockaddr_un)) == -1)
 errExit("connect");
 /* Copy stdin to socket */
 while ((numRead = read(STDIN_FILENO, buf, BUF_SIZE)) > 0)
 if (write(sfd, buf, numRead) != numRead)
 fatal("partial/failed write");
 if (numRead == -1)
 errExit("read");
 exit(EXIT_SUCCESS); /* Closes our socket; server sees EOF */
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/us_xfr_cl.c
```

Chương trình server được thể hiện trong [Liệt kê 57-3.](#page-19-0) Server thực hiện các bước sau:

- Tạo một socket (Create a socket).
- Xóa bất kỳ tệp nào đang tồn tại có cùng đường dẫn (pathname) với đường dẫn mà chúng ta muốn gắn (bind) socket vào.
- Xây dựng cấu trúc địa chỉ (address structure) cho socket của server, gắn (bind) socket vào địa chỉ đó và đánh dấu socket là một listening socket (socket lắng nghe).
- Thực thi một vòng lặp vô hạn để xử lý các yêu cầu đến từ client. Mỗi lần lặp của vòng lặp sẽ thực hiện các bước sau:
  - Chấp nhận một kết nối (accept), nhận về một socket mới (`cfd`) cho kết nối đó; socket lắng nghe (`sfd`) vẫn mở và có thể được sử dụng để chấp nhận các kết nối tiếp theo.
  - Đọc toàn bộ dữ liệu từ socket đã kết nối và ghi dữ liệu đó ra luồng đầu ra chuẩn (standard output).
  - Đóng socket đã kết nối `cfd`.

Server phải được chấm dứt thủ công (ví dụ: bằng cách gửi cho nó một tín hiệu - signal). Chương trình client ([Liệt kê 57-4\)](#page-20-0) thực hiện các bước sau:

- Tạo một socket.
- Xây dựng cấu trúc địa chỉ cho socket của server và thực hiện kết nối (connect) tới socket tại địa chỉ đó.
- Thực thi một vòng lặp sao chép dữ liệu từ luồng đầu vào chuẩn của nó vào kết nối socket. Khi gặp kết thúc tệp (end-of-file - EOF) ở luồng đầu vào chuẩn, client sẽ kết thúc, dẫn đến việc socket của nó bị đóng và server sẽ nhìn thấy EOF khi đọc từ socket ở đầu bên kia của kết nối.

Đoạn nhật ký phiên dòng lệnh (shell session log) sau đây minh họa cách sử dụng các chương trình này. Chúng ta bắt đầu bằng cách chạy tiến trình máy chủ (server) ở chế độ nền (background):

```
$ ./us_xfr_sv > b &
[1] 9866
$ ls -lF /tmp/us_xfr Kiểm tra tệp socket bằng lệnh ls
srwxr-xr-x 1 mtk users 0 Jul 18 10:48 /tmp/us_xfr=
```

Sau đó, chúng ta tạo một tệp kiểm thử để dùng làm dữ liệu đầu vào cho tiến trình máy khách (client) và chạy máy khách:

```
$ cat *.c > a
$ ./us_xfr_cl < a Máy khách nhận đầu vào từ tệp kiểm thử
```

Tại thời điểm này, tiến trình con (child process) đã hoàn tất. Bây giờ, chúng ta đồng thời chấm dứt (terminate) máy chủ và kiểm tra xem đầu ra của máy chủ có khớp với đầu vào của máy khách hay không:

```
$ kill %1 Chấm dứt máy chủ
 [1]+ Terminated ./us_xfr_sv >b Shell nhận biết việc máy chủ kết thúc
$ diff a b
$
```

Lệnh `diff` không tạo ra bất kỳ đầu ra nào, cho thấy rằng các tệp đầu vào và đầu ra là hoàn toàn giống nhau.

Lưu ý rằng sau khi máy chủ kết thúc, đường dẫn (pathname) của socket vẫn tiếp tục tồn tại. Đây là lý do tại sao máy chủ sử dụng hàm `remove()` để xóa bất kỳ thể hiện (instance) hiện có nào của đường dẫn socket trước khi gọi hàm `bind()`. (Giả định rằng chúng ta có đủ quyền hạn, lệnh gọi `remove()` này sẽ xóa bất kỳ loại tệp nào có đường dẫn này, ngay cả khi nó không phải là một socket). Nếu chúng ta không làm điều này, thì lệnh gọi `bind()` sẽ thất bại nếu một lần thực thi trước đó của máy chủ đã tạo sẵn đường dẫn socket này rồi.

## 57.3 Socket Datagram trong miền UNIX (Datagram Sockets in the UNIX Domain)

Trong mô tả chung về socket datagram mà chúng tôi đã trình bày ở Mục [56.6,](#page-10-1) chúng tôi đã nêu rằng việc giao tiếp sử dụng socket datagram là không đáng tin cậy (unreliable). Đây là trường hợp đối với các datagram được truyền qua mạng (network). Tuy nhiên, đối với socket miền UNIX (UNIX domain socket), việc truyền datagram được thực hiện hoàn toàn bên trong nhân hệ điều hành (kernel) và có độ tin cậy cao. Tất cả các thông điệp (message) đều được phân phối theo đúng thứ tự và không bị trùng lặp.

### Kích thước datagram tối đa cho socket datagram miền UNIX

Tiêu chuẩn SUSv3 không chỉ định kích thước tối đa cho các datagram được gửi thông qua socket miền UNIX. Trên Linux, chúng ta có thể gửi các datagram khá lớn. Các giới hạn này được kiểm soát thông qua tùy chọn socket `SO_SNDBUF` và các tệp khác nhau trong thư mục `/proc`, như được mô tả trong trang hướng dẫn (manual page) `socket(7)`. Tuy nhiên, một số hệ thống UNIX khác áp dụng các giới hạn thấp hơn, chẳng hạn như 2048 byte. Các ứng dụng có tính di động cao (portable applications) sử dụng socket datagram miền UNIX nên cân nhắc việc áp dụng một giới hạn trên nhỏ cho kích thước của datagram được sử dụng.

### Chương trình ví dụ

[Liệt kê 57-6](#page-23-0) và [Liệt kê 57-7](#page-24-0) minh họa một ứng dụng máy khách - máy chủ (client-server) đơn giản sử dụng socket datagram miền UNIX. Cả hai chương trình này đều sử dụng tệp tiêu đề (header file) được hiển thị trong [Liệt kê 57-5.](#page-22-0)

```
Liệt kê 57-5: Tệp tiêu đề được sử dụng bởi ud_ucase_sv.c và ud_ucase_cl.c
––––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/ud_ucase.h
## include <sys/un.h>
## include <sys/socket.h>
## include <ctype.h>
## include "tlpi_hdr.h"
## define BUF_SIZE 10 /* Kích thước tối đa của các thông điệp trao đổi
 giữa máy khách và máy chủ */
## define SV_SOCK_PATH "/tmp/ud_ucase"
––––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/ud_ucase.h
```

Chương trình máy chủ ([Liệt kê 57-6](#page-23-0)) đầu tiên tạo một socket và liên kết (bind) nó với một địa chỉ nổi tiếng (well-known address). (Trước đó, máy chủ thực hiện hủy liên kết (unlink) đường dẫn khớp với địa chỉ đó, trong trường hợp đường dẫn đã tồn tại từ trước). Máy chủ sau đó bước vào một vòng lặp vô hạn, sử dụng hàm `recvfrom()` để nhận các datagram từ máy khách, chuyển đổi văn bản nhận được thành chữ hoa, và trả lại văn bản đã chuyển đổi cho máy khách thông qua địa chỉ lấy được từ hàm `recvfrom()`.

Chương trình máy khách [\(Liệt kê 57-7\)](#page-24-0) tạo một socket và liên kết socket đó với một địa chỉ, để máy chủ có thể gửi phản hồi của mình. Địa chỉ của máy khách được làm cho là duy nhất bằng cách đưa định danh tiến trình (process ID) của máy khách vào đường dẫn. Máy khách sau đó chạy vòng lặp, gửi từng tham số dòng lệnh (command-line argument) của nó như một thông điệp riêng biệt đến máy chủ. Sau khi gửi mỗi thông điệp, máy khách đọc phản hồi từ máy chủ và hiển thị nó ra thiết bị xuất chuẩn (standard output).

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/ud_ucase_sv.c
## include "ud_ucase.h"
int
main(int argc, char *argv[])
{
 struct sockaddr_un svaddr, claddr;
 int sfd, j;
 ssize_t numBytes;
 socklen_t len;
 char buf[BUF_SIZE];
 sfd = socket(AF_UNIX, SOCK_DGRAM, 0); /* Tạo socket máy chủ */
 if (sfd == -1)
 errExit("socket");
 /* Xây dựng địa chỉ nổi tiếng và liên kết socket máy chủ với địa chỉ đó */
 if (remove(SV_SOCK_PATH) == -1 && errno != ENOENT)
 errExit("remove-%s", SV_SOCK_PATH);
 memset(&svaddr, 0, sizeof(struct sockaddr_un));
 svaddr.sun_family = AF_UNIX;
 strncpy(svaddr.sun_path, SV_SOCK_PATH, sizeof(svaddr.sun_path) - 1);
 if (bind(sfd, (struct sockaddr *) &svaddr, sizeof(struct sockaddr_un)) == -1)
 errExit("bind");
 /* Nhận thông điệp, chuyển đổi thành chữ hoa, và trả về cho máy khách */
 for (;;) {
 len = sizeof(struct sockaddr_un);
 numBytes = recvfrom(sfd, buf, BUF_SIZE, 0,
 (struct sockaddr *) &claddr, &len);
 if (numBytes == -1)
 errExit("recvfrom");
 printf("Server received %ld bytes from %s\n", (long) numBytes,
 claddr.sun_path);
 for (j = 0; j < numBytes; j++)
 buf[j] = toupper((unsigned char) buf[j]);
 if (sendto(sfd, buf, numBytes, 0, (struct sockaddr *) &claddr, len) !=
 numBytes)
 fatal("sendto");
 }
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/ud_ucase_sv.c
```

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/ud_ucase_cl.c
## include "ud_ucase.h"
int
main(int argc, char *argv[])
{
 struct sockaddr_un svaddr, claddr;
 int sfd, j;
 size_t msgLen;
 ssize_t numBytes;
 char resp[BUF_SIZE];
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s msg...\n", argv[0]);
 /* Tạo socket client; bind tới một tên đường dẫn (pathname) duy nhất (dựa trên PID) */
 sfd = socket(AF_UNIX, SOCK_DGRAM, 0);
 if (sfd == -1)
 errExit("socket");
 memset(&claddr, 0, sizeof(struct sockaddr_un));
 claddr.sun_family = AF_UNIX;
 snprintf(claddr.sun_path, sizeof(claddr.sun_path),
 "/tmp/ud_ucase_cl.%ld", (long) getpid());
 if (bind(sfd, (struct sockaddr *) &claddr, sizeof(struct sockaddr_un)) == -1)
 errExit("bind");
 /* Xây dựng địa chỉ của server */
 memset(&svaddr, 0, sizeof(struct sockaddr_un));
 svaddr.sun_family = AF_UNIX;
 strncpy(svaddr.sun_path, SV_SOCK_PATH, sizeof(svaddr.sun_path) - 1);
 /* Gửi thông điệp tới server; hiển thị phản hồi trên stdout */
 for (j = 1; j < argc; j++) {
 msgLen = strlen(argv[j]); /* Có thể dài hơn BUF_SIZE */
 if (sendto(sfd, argv[j], msgLen, 0, (struct sockaddr *) &svaddr,
 sizeof(struct sockaddr_un)) != msgLen)
 fatal("sendto");
 numBytes = recvfrom(sfd, resp, BUF_SIZE, 0, NULL, NULL);
 if (numBytes == -1)
 errExit("recvfrom");
 printf("Response %d: %.*s\n", j, (int) numBytes, resp);
 }
 remove(claddr.sun_path); /* Xóa tên đường dẫn socket của client */
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/ud_ucase_cl.c
```

Nhật ký phiên dòng lệnh (shell session) sau đây minh họa cách sử dụng các chương trình server và client:

```
$ ./ud_ucase_sv &
[1] 20113
$ ./ud_ucase_cl hello world Gửi 2 thông điệp tới server
Server received 5 bytes from /tmp/ud_ucase_cl.20150
Response 1: HELLO
Server received 5 bytes from /tmp/ud_ucase_cl.20150
Response 2: WORLD
$ ./ud_ucase_cl 'long message' Gửi 1 thông điệp dài hơn tới server
Server received 10 bytes from /tmp/ud_ucase_cl.20151
Response 1: LONG MESSA
$ kill %1 Kết thúc server
```

Lần thực thi thứ hai của chương trình client được thiết kế để cho thấy rằng khi một lời gọi `recvfrom()` chỉ định một độ dài (`BUF_SIZE`, được định nghĩa trong [Liệt kê 57-5](#page-22-0) với giá trị là 10) ngắn hơn kích thước thông điệp, thông điệp sẽ bị cắt bớt một cách âm thầm (silently truncated). Chúng ta có thể thấy việc cắt bớt này đã xảy ra, bởi vì server in ra một thông báo cho biết nó chỉ nhận được 10 byte, trong khi thông điệp do client gửi bao gồm 12 byte.

## 57.4 Quyền của UNIX Domain Socket

Quyền sở hữu và quyền truy cập của tệp socket xác định những tiến trình nào có thể giao tiếp với socket đó:

- Để kết nối với một UNIX domain stream socket (socket luồng miền UNIX), quyền ghi (write permission) là bắt buộc đối với tệp socket.
- Để gửi một datagram đến một UNIX domain datagram socket (socket datagram miền UNIX), quyền ghi là bắt buộc đối với tệp socket.

Ngoài ra, quyền thực thi (tìm kiếm - execute/search permission) là bắt buộc đối với từng thư mục trong đường dẫn (pathname) của socket.

Theo mặc định, một socket được tạo (bởi hàm `bind()`) với tất cả các quyền được cấp cho chủ sở hữu (`owner` - user), nhóm (`group`) và người khác (`other`). Để thay đổi điều này, chúng ta có thể đặt một lời gọi `umask()` trước lời gọi `bind()` để vô hiệu hóa các quyền mà chúng ta không muốn cấp.

Một số hệ thống bỏ qua các quyền trên tệp socket (SUSv3 cho phép điều này). Do đó, chúng ta không thể sử dụng quyền của tệp socket một cách có tính di động (portably) để kiểm soát quyền truy cập vào socket, mặc dù chúng ta có thể sử dụng quyền trên thư mục chứa nó cho mục đích này một cách di động.

## 57.5 Tạo một Cặp Socket Đã Kết Nối: socketpair()

Đôi khi, việc một tiến trình đơn lẻ tạo ra một cặp socket và kết nối chúng lại với nhau là rất hữu ích. Điều này có thể được thực hiện bằng cách sử dụng hai lời gọi `socket()`, một lời gọi `bind()`, và sau đó là các lời gọi `listen()`, `connect()`, và `accept()` (đối với socket luồng), hoặc một lời gọi `connect()` (đối với socket datagram). System call `socketpair()` cung cấp một cách viết tắt cho thao tác này.

```
## include <sys/socket.h>
int socketpair(int domain, int type, int protocol, int sockfd[2]);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

System call `socketpair()` này chỉ có thể được sử dụng trong miền UNIX (UNIX domain); nghĩa là, `domain` phải được chỉ định là `AF_UNIX`. (Hạn chế này áp dụng trên hầu hết các cài đặt và rất hợp lý, vì cặp socket được tạo trên một hệ thống host duy nhất). Kiểu socket (`type`) có thể được chỉ định là `SOCK_DGRAM` hoặc `SOCK_STREAM`. Đối số `protocol` phải được chỉ định là 0. Mảng `sockfd` trả về các file descriptor tham chiếu đến hai socket đã kết nối.

Việc chỉ định `type` là `SOCK_STREAM` sẽ tạo ra một đường ống song hướng tương đương (còn được gọi là stream pipe - ống luồng). Mỗi socket có thể được sử dụng cho cả đọc và ghi, và các kênh dữ liệu riêng biệt chạy theo mỗi hướng giữa hai socket. (Trên các hệ thống có nguồn gốc từ BSD, `pipe()` được triển khai như một lời gọi đến `socketpair()`.)

Thông thường, một cặp socket được sử dụng tương tự như một pipe. Sau lời gọi `socketpair()`, tiến trình sau đó tạo ra một tiến trình con thông qua `fork()`. Tiến trình con kế thừa các bản sao của các file descriptor của tiến trình cha, bao gồm các descriptor tham chiếu đến cặp socket. Do đó, tiến trình cha và con có thể sử dụng cặp socket này để thực hiện IPC (Inter-Process Communication - Giao tiếp giữa các tiến trình).

```

Một điểm khác biệt giữa việc sử dụng `socketpair()` và việc tạo thủ công một cặp socket đã được kết nối là các socket này không được gán (bind) vào bất kỳ địa chỉ nào. Điều này có thể giúp chúng ta tránh được toàn bộ các lỗ hổng bảo mật (security vulnerabilities), vì các socket này không hiển thị đối với bất kỳ tiến trình (process) nào khác.

> Bắt đầu từ phiên bản kernel 2.6.27, Linux cung cấp một cách sử dụng thứ hai cho tham số kiểu (`type`), cho phép kết hợp hai cờ phi tiêu chuẩn bằng phép toán OR với kiểu socket. Cờ `SOCK_CLOEXEC` khiến nhân hệ điều hành (kernel) bật cờ close-on-exec (`FD_CLOEXEC`) cho hai file descriptor mới. Cờ này hữu ích vì những lý do tương tự như cờ `O_CLOEXEC` của hàm `open()` được mô tả ở Mục 4.3.1. Cờ `SOCK_NONBLOCK` khiến kernel thiết lập cờ `O_NONBLOCK` trên cả hai mô tả tệp mở (open file descriptions) cơ sở, nhờ đó các thao tác I/O trong tương lai trên socket sẽ chuyển sang chế độ không chặn (nonblocking). Điều này giúp tiết kiệm các lời gọi hàm `fcntl()` bổ sung để đạt được cùng một kết quả.

## 57.6 Không gian tên Socket trừu tượng của Linux (The Linux Abstract Socket Namespace)

Cái gọi là không gian tên trừu tượng (abstract namespace) là một tính năng đặc thù của Linux cho phép chúng ta gán (bind) một UNIX domain socket với một tên mà tên đó không được tạo ra trong hệ thống tập tin (file system). Điều này mang lại một số lợi ích tiềm năng:

- Chúng ta không cần phải lo lắng về khả năng xung đột với các tên đã tồn tại trong hệ thống tập tin.
- Không cần thiết phải hủy liên kết (unlink) đường dẫn socket khi chúng ta đã sử dụng xong socket đó. Tên trừu tượng sẽ tự động bị xóa khi socket bị đóng (closed).
- Chúng ta không cần tạo đường dẫn trên hệ thống tập tin cho socket. Điều này có thể hữu ích trong một môi trường `chroot`, hoặc nếu chúng ta không có quyền ghi (write access) vào hệ thống tập tin.

Để tạo một liên kết trừu tượng (abstract binding), chúng ta chỉ định byte đầu tiên của trường `sun_path` là một byte null (`\0`). Điều này giúp phân biệt tên socket trừu tượng với các đường dẫn UNIX domain socket thông thường vốn bao gồm một chuỗi gồm một hoặc nhiều byte khác null và kết thúc bằng một byte null. Các byte còn lại của trường `sun_path` sau đó sẽ định nghĩa tên trừu tượng cho socket. Các byte này được thông dịch toàn bộ, thay vì dưới dạng một chuỗi kết thúc bằng null.

[Liệt kê 57-8](#page-27-0) minh họa việc tạo một liên kết socket trừu tượng.

**Liệt kê 57-8:** Tạo một liên kết socket trừu tượng

```c

––––––––––––––––––––––––––––––––––––––––––––– from sockets/us_abstract_bind.c
struct sockaddr_un addr;
memset(&addr, 0, sizeof(struct sockaddr_un)); /* Clear address structure */
addr.sun_family = AF_UNIX; /* UNIX domain address */
/* addr.sun_path[0] has already been set to 0 by memset() */
strncpy(&addr.sun_path[1], "xyz", sizeof(addr.sun_path) - 2);
/* Abstract name is "xyz" followed by null bytes */
sockfd = socket(AF_UNIX, SOCK_STREAM, 0);
if (sockfd == -1)
errExit("socket");
if (bind(sockfd, (struct sockaddr *) &addr,
sizeof(struct sockaddr_un)) == -1)
errExit("bind");
––––––––––––––––––––––––––––––––––––––––––––– from sockets/us_abstract_bind.c

```

Việc sử dụng một byte null ở đầu để phân biệt tên socket trừu tượng với tên socket thông thường có thể dẫn đến một hệ quả bất thường. Giả sử biến `name` tình cờ trỏ đến một chuỗi có độ dài bằng không và chúng ta cố gắng gán (bind) một UNIX domain socket vào một `sun_path` được khởi tạo như sau:

```c

strncpy(addr.sun_path, name, sizeof(addr.sun_path) - 1);

```

Trên Linux, chúng ta sẽ vô tình tạo ra một liên kết socket trừu tượng. Tuy nhiên, một chuỗi mã nguồn như vậy có thể là không có chủ ý (tức là một lỗi - bug). Trên các hệ triển khai UNIX khác, lời gọi `bind()` tiếp theo sẽ thất bại.

## 57.7 Tổng kết

UNIX domain socket cho phép giao tiếp giữa các ứng dụng trên cùng một máy chủ (host). Miền UNIX (UNIX domain) hỗ trợ cả socket dạng luồng (stream socket) và socket dạng datagram (datagram socket).

Một UNIX domain socket được nhận diện bằng một đường dẫn trong hệ thống tập tin. Quyền truy cập tệp (file permissions) có thể được sử dụng để kiểm soát quyền truy cập vào UNIX domain socket.

System Call `socketpair()` tạo ra một cặp UNIX domain socket đã được kết nối với nhau. Điều này giúp tránh được nhu cầu thực hiện nhiều system call để tạo, gán (bind) và kết nối (connect) các socket. Một cặp socket thông thường được sử dụng tương tự như một pipe (đường ống): một tiến trình tạo ra cặp socket và sau đó gọi `fork` để tạo ra một tiến trình con kế thừa các descriptor tham chiếu đến các socket đó. Hai tiến trình sau đó có thể giao tiếp thông qua cặp socket này.

Không gian tên socket trừu tượng đặc thù của Linux cho phép chúng ta gán (bind) một UNIX domain socket với một tên không xuất hiện trong hệ thống tập tin.

## Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê tại Mục [59.15.](#page-86-0)

## 57.8 Bài tập

- **57-1.** Trong Mục [57.3,](#page-22-1) chúng ta đã lưu ý rằng các socket miền UNIX kiểu datagram (UNIX domain datagram socket) là đáng tin cậy. Hãy viết các chương trình để minh họa rằng nếu một tiến trình gửi (sender) truyền các datagram đến một UNIX domain datagram socket nhanh hơn tốc độ đọc của tiến trình nhận (receiver), thì tiến trình gửi cuối cùng sẽ bị chặn (block), và tiếp tục bị chặn cho đến khi tiến trình nhận đọc bớt một số datagram đang chờ xử lý (pending datagram).
- **57-2.** Viết lại các chương trình trong [Listing 57-3](#page-19-0) (`us_xfr_sv.c`) và [Listing 57-4](#page-20-0) (`us_xfr_cl.c`) để sử dụng không gian tên socket trừu tượng (abstract socket namespace) đặc thù của Linux (Mục [57.6](#page-26-0)).
- **57-3.** Triển khai lại máy chủ (server) và máy khách (client) cấp phát số thứ tự (sequence-number) của Mục 44.8 bằng cách sử dụng các socket miền UNIX kiểu dòng dữ liệu (UNIX domain stream socket).
- **57-4.** Giả sử rằng chúng ta tạo ra hai UNIX domain datagram socket được bind (liên kết) với các đường dẫn `/somepath/a` và `/somepath/b`, và chúng ta kết nối (connect) socket `/somepath/a` tới `/somepath/b`. Điều gì sẽ xảy ra nếu chúng ta tạo một datagram socket thứ ba và cố gắng gửi (`sendto()`) một datagram thông qua socket đó đến `/somepath/a`? Hãy viết một chương trình để tìm ra câu trả lời. Nếu bạn có quyền truy cập vào các hệ thống UNIX khác, hãy kiểm thử chương trình trên các hệ thống đó để xem câu trả lời có khác biệt hay không.
