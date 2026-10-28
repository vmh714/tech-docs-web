# Chương 61: Socket: Các chủ đề nâng cao (Sockets: Advanced Topics)

Chương này xem xét một loạt các chủ đề nâng cao hơn liên quan đến lập trình socket (sockets programming), bao gồm:

- các hoàn cảnh mà các thao tác đọc và ghi một phần (partial reads and writes) có thể xảy ra trên stream socket (stream sockets);
- việc sử dụng hàm shutdown() để đóng một nửa kênh truyền thông hai chiều (bidirectional channel) giữa hai socket đã kết nối;
- các system call I/O recv() và send(), cung cấp chức năng dành riêng cho socket mà các hàm read() và write() không có;
- system call sendfile(), được sử dụng trong một số trường hợp nhất định để xuất dữ liệu trên socket một cách hiệu quả;
- chi tiết về hoạt động của giao thức TCP (TCP protocol), nhằm loại bỏ một số hiểu lầm phổ biến dẫn đến sai sót khi viết các chương trình sử dụng TCP socket;
- việc sử dụng các lệnh netstat và tcpdump để giám sát và gỡ lỗi (debugging) các ứng dụng sử dụng socket; và
- việc sử dụng các system call getsockopt() và setsockopt() để truy xuất và sửa đổi các tùy chọn ảnh hưởng đến hoạt động của socket.

Chúng ta cũng sẽ xem xét một số chủ đề nhỏ khác, và kết thúc chương bằng phần tóm tắt về một số tính năng nâng cao của socket.

## 61.1 Đọc và Ghi Một Phần trên Stream Socket (Partial Reads and Writes on Stream Sockets)

Khi chúng ta lần đầu giới thiệu các system call read() và write() trong Chương 4, chúng ta đã lưu ý rằng, trong một số trường hợp, chúng có thể truyền ít byte hơn số lượng được yêu cầu. Các việc truyền dữ liệu một phần (partial transfers) như vậy có thể xảy ra khi thực hiện I/O trên stream socket. Bây giờ chúng ta sẽ xem xét lý do tại sao chúng lại xảy ra và trình bày một cặp hàm xử lý các thao tác truyền một phần này một cách trong suốt (transparently).

Một thao tác đọc một phần (partial read) có thể xảy ra nếu số byte có sẵn trong socket ít hơn số lượng được yêu cầu trong lời gọi read(). Trong trường hợp này, read() đơn giản trả về số byte hiện có sẵn. (Đây là hành vi tương tự mà chúng ta đã thấy đối với pipe và FIFO trong Mục 44.10).

Một thao tác ghi một phần (partial write) có thể xảy ra nếu không đủ không gian vùng đệm (buffer space) để truyền tất cả các byte được yêu cầu và một trong các điều kiện sau đây xảy ra:

- Một trình xử lý tín hiệu (signal handler) đã làm gián đoạn lời gọi write() (Mục 21.5) sau khi nó đã truyền được một số byte được yêu cầu.
- Socket đang hoạt động ở chế độ phi chặn (nonblocking mode) (O\_NONBLOCK), và chỉ có thể truyền được một phần số byte được yêu cầu.
- Một lỗi bất đồng bộ (asynchronous error) xảy ra sau khi chỉ một số byte được yêu cầu được truyền đi. Ý của chúng tôi về lỗi bất đồng bộ là lỗi xảy ra một cách bất đồng bộ đối với việc ứng dụng sử dụng các lời gọi trong sockets API. Lỗi bất đồng bộ có thể phát sinh, ví dụ, do sự cố với kết nối TCP, có thể là kết quả của việc ứng dụng ngang hàng (peer application) bị crash.

Trong tất cả các trường hợp trên, giả sử có đủ không gian để truyền ít nhất 1 byte, lời gọi write() sẽ thành công và trả về số byte đã được truyền vào vùng đệm đầu ra (output buffer).

Nếu xảy ra I/O một phần — ví dụ, nếu read() trả về ít hơn số byte được yêu cầu hoặc một lời gọi write() đang bị chặn bị gián đoạn bởi signal handler sau khi chỉ truyền được một phần dữ liệu được yêu cầu — thì đôi khi việc khởi động lại system call để hoàn tất quá trình truyền là rất hữu ích. Trong [Liệt kê 61-1](#page-106-0), chúng tôi cung cấp hai hàm thực hiện việc này: readn() và writen(). (Ý tưởng cho các hàm này được rút ra từ các hàm có cùng tên được trình bày trong [Stevens et al., 2004]).

```c
## include "rdwrn.h"
ssize_t readn(int fd, void *buffer, size_t count);
                        Trả về số byte đã đọc, 0 khi gặp EOF, hoặc –1 khi lỗi
ssize_t writen(int fd, void *buffer, size_t count);
                                Trả về số byte đã ghi, hoặc –1 khi lỗi
```

Các hàm readn() và writen() nhận các tham số giống như read() và write(). Tuy nhiên, chúng sử dụng một vòng lặp để khởi động lại các system call này, do đó đảm bảo rằng số lượng byte được yêu cầu luôn được truyền đi (trừ khi xảy ra lỗi hoặc phát hiện thấy kết thúc tệp - end-of-file trên một thao tác đọc).

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/rdwrn.c
## include <unistd.h>
## include <errno.h>
## include "rdwrn.h" /* Khai báo readn() và writen() */
ssize_t
readn(int fd, void *buffer, size_t n)
{
 ssize_t numRead; /* Số byte được lấy bởi read() gần nhất */
 size_t totRead; /* Tổng số byte đã đọc cho đến nay */
 char *buf;
 buf = buffer; /* Không thực hiện phép toán con trỏ (pointer arithmetic) trên "void *" */
 for (totRead = 0; totRead < n; ) {
 numRead = read(fd, buf, n - totRead);
 if (numRead == 0) /* EOF */
 return totRead; /* Có thể là 0 nếu đây là lần gọi read() đầu tiên */
 if (numRead == -1) {
 if (errno == EINTR)
 continue; /* Bị gián đoạn --> khởi động lại read() */
 else
 return -1; /* Lỗi khác */
 }
 totRead += numRead;
 buf += numRead;
 }
 return totRead; /* Phải là 'n' byte nếu chạy đến đây */
}
ssize_t
writen(int fd, const void *buffer, size_t n)
{
 ssize_t numWritten; /* Số byte được ghi bởi write() gần nhất */
 size_t totWritten; /* Tổng số byte đã ghi cho đến nay */
 const char *buf;
 buf = buffer; /* Không thực hiện phép toán con trỏ trên "void *" */
 for (totWritten = 0; totWritten < n; ) {
 numWritten = write(fd, buf, n - totWritten);
 if (numWritten <= 0) {
 if (numWritten == -1 && errno == EINTR)
 continue; /* Bị gián đoạn --> khởi động lại write() */
 else
 return -1; /* Lỗi khác */
 }
 totWritten += numWritten;
 buf += numWritten;
 }
 return totWritten; /* Phải là 'n' byte nếu chạy đến đây */
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/rdwrn.c
```

## 61.2 System Call shutdown()

Việc gọi `close()` trên một socket đóng cả hai nửa của kênh truyền thông song công (bidirectional communication channel). Đôi khi, việc đóng một nửa kết nối là rất hữu ích, để dữ liệu chỉ có thể được truyền theo một chiều qua socket. System call `shutdown()` cung cấp tính năng này.

## include <sys/socket.h>

int shutdown(int sockfd, int how);
Trả về 0 khi thành công, hoặc –1 khi có lỗi

```

System call `shutdown()` đóng một hoặc cả hai kênh của socket `sockfd`, tùy thuộc vào giá trị của `how`, được chỉ định là một trong các giá trị sau:

SHUT_RD

Đóng nửa đọc (reading half) của kết nối. Các thao tác đọc tiếp theo sẽ trả về dấu hiệu kết thúc tệp - end-of-file (0). Dữ liệu vẫn có thể được ghi vào socket. Sau khi thực hiện `SHUT_RD` trên một UNIX domain stream socket, ứng dụng đối tác (peer application) sẽ nhận được tín hiệu `SIGPIPE` và lỗi `EPIPE` nếu nó tiếp tục cố gắng ghi vào socket đối tác. Như đã thảo luận trong Mục [61.6.6](#page-124-0), `SHUT_RD` không thể được sử dụng một cách có ý nghĩa đối với các TCP socket.

SHUT_WR

Đóng nửa ghi (writing half) của kết nối. Khi ứng dụng đối tác đã đọc hết tất cả dữ liệu chưa được xử lý (outstanding data), nó sẽ thấy dấu hiệu kết thúc tệp (end-of-file). Các thao tác ghi tiếp theo vào socket cục bộ sẽ tạo ra tín hiệu `SIGPIPE` và lỗi `EPIPE`. Dữ liệu do đối tác ghi vẫn có thể được đọc từ socket. Nói cách khác, thao tác này cho phép chúng ta báo hiệu kết thúc tệp (end-of-file) cho đối tác trong khi vẫn có thể đọc dữ liệu mà đối tác gửi ngược lại cho chúng ta. Thao tác `SHUT_WR` được sử dụng bởi các chương trình như `ssh` và `rsh` (tham khảo Mục 18.5 của [Stevens, 1994]). Thao tác `SHUT_WR` là cách sử dụng phổ biến nhất của `shutdown()`, và đôi khi được gọi là đóng một nửa socket (socket half-close).

SHUT_RDWR

Đóng cả hai nửa đọc và ghi của kết nối. Thao tác này tương đương với việc thực hiện `SHUT_RD` theo sau bởi `SHUT_WR`.

Ngoài ngữ nghĩa của tham số `how`, `shutdown()` khác với `close()` ở một điểm quan trọng khác: nó đóng (các) kênh socket bất kể có các file descriptor khác đang tham chiếu đến socket đó hay không. (Nói cách khác, `shutdown()` thực hiện một thao tác trên mô tả tệp mở - open file description, thay vì trên file descriptor. Xem Hình 5-1, trang 91.) Giả sử, ví dụ, `sockfd` tham chiếu đến một stream socket đã được kết nối. Nếu chúng ta thực hiện các lời gọi sau, thì kết nối vẫn mở và chúng ta vẫn có thể thực hiện I/O trên kết nối thông qua file descriptor `fd2`:

```

fd2 = dup(sockfd);
close(sockfd);

```

Tuy nhiên, nếu chúng ta thực hiện chuỗi lời gọi sau, thì cả hai kênh của kết nối đều bị đóng và I/O không còn có thể được thực hiện thông qua `fd2`:

```

fd2 = dup(sockfd);
shutdown(sockfd, SHUT_RDWR);

```

Một kịch bản tương tự cũng xảy ra nếu một file descriptor cho socket được nhân bản (duplicate) trong quá trình `fork()`. Nếu sau khi `fork()`, một tiến trình thực hiện `SHUT\_RDWR` trên bản sao file descriptor của nó, thì tiến trình kia cũng không còn có thể thực hiện I/O trên file descriptor của chính nó nữa.

Lưu ý rằng `shutdown()` không đóng file descriptor, ngay cả khi `how` được chỉ định là `SHUT\_RDWR`. Để đóng file descriptor, chúng ta phải gọi thêm `close()`.

### Chương trình ví dụ

[Liệt kê 61-2](#page-109-0) minh họa việc sử dụng thao tác `shutdown()` `SHUT\_WR`. Chương trình này là một TCP client cho dịch vụ echo. (Chúng tôi đã trình bày một TCP server cho dịch vụ echo trong Mục [60.3](#page-94-0).) Để mã nguồn ngắn gọn hơn, chúng tôi sử dụng các hàm trong thư viện socket miền Internet được trình bày ở Mục [59.12.](#page-76-1)

> Ở một số bản phân phối Linux, dịch vụ echo không được bật theo mặc định, do đó chúng ta phải bật nó trước khi chạy chương trình trong [Liệt kê 61-2.](#page-109-0) Thông thường, dịch vụ này được thực thi bên trong bởi tiến trình nền (daemon) `inetd(8)` (Mục [60.5\)](#page-98-0), và để bật dịch vụ echo, chúng ta phải chỉnh sửa tệp `/etc/inetd.conf` để bỏ chú thích hai dòng tương ứng với các dịch vụ echo UDP và TCP (xem [Liệt kê 60-5](#page-100-1), ở trang [1249\)](#page-100-1), và sau đó gửi tín hiệu `SIGHUP` đến daemon `inetd`.

> Nhiều bản phân phối cung cấp `xinetd(8)` hiện đại hơn thay vì `inetd(8)`. Hãy tham khảo tài liệu của `xinetd` để biết thông tin về cách thực hiện các thay đổi tương đương dưới `xinetd`.

Là tham số dòng lệnh duy nhất của mình, chương trình nhận tên của host mà echo server đang chạy. Client thực hiện một lời gọi `fork()`, tạo ra các tiến trình cha và tiến trình con.

Tiến trình cha của client ghi nội dung của đầu vào chuẩn (standard input) vào socket, để nó có thể được đọc bởi echo server. Khi tiến trình cha phát hiện ra dấu hiệu kết thúc tệp (end-of-file) trên đầu vào chuẩn, nó sử dụng `shutdown()` để đóng nửa ghi của socket phía nó. Điều này làm cho echo server nhìn thấy dấu hiệu kết thúc tệp, tại thời điểm đó server sẽ đóng socket của chính nó (làm cho tiến trình con của client lần lượt nhìn thấy dấu hiệu kết thúc tệp). Tiến trình cha sau đó kết thúc.

Tiến trình con của client đọc phản hồi của echo server từ socket và in phản hồi đó ra đầu ra chuẩn (standard output). Tiến trình con kết thúc khi nó nhìn thấy dấu hiệu kết thúc tệp trên socket.

Dưới đây là phần văn bản được dịch sang tiếng Việt theo đúng các tiêu chuẩn kỹ thuật:

Phần sau đây cho thấy một ví dụ về những gì chúng ta thấy khi chạy chương trình này:

```

$ cat > tell-tale-heart.txt Tạo một tệp để kiểm tra
It is impossible to say how the idea entered my brain;
but once conceived, it haunted me day and night.
Nhập Control-D
$ ./is_echo_cl tekapo < tell-tale-heart.txt
It is impossible to say how the idea entered my brain;
but once conceived, it haunted me day and night.

```

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_echo_cl.c

## include "inet_sockets.h"

## include "tlpi_hdr.h"

## define BUF_SIZE 100

int
main(int argc, char *argv[])
{
int sfd;
ssize_t numRead;
char buf[BUF_SIZE];
if (argc != 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s host\n", argv[0]);
sfd = inetConnect(argv[1], "echo", SOCK_STREAM);
if (sfd == -1)
errExit("inetConnect");
switch (fork()) {
case -1:
errExit("fork");
case 0: /* Tiến trình con: đọc phản hồi của server, hiển thị trên stdout */
for (;;) {
numRead = read(sfd, buf, BUF_SIZE);
if (numRead <= 0) /* Thoát khi gặp EOF hoặc lỗi */
break;
printf("%.*s", (int) numRead, buf);
}
exit(EXIT_SUCCESS);
default: /* Tiến trình cha: ghi nội dung từ stdin vào socket */
for (;;) {
numRead = read(STDIN_FILENO, buf, BUF_SIZE);
if (numRead <= 0) /* Thoát vòng lặp khi gặp EOF hoặc lỗi */
break;
if (write(sfd, buf, numRead) != numRead)
fatal("write() failed");
}
/* Đóng kênh ghi, để server nhận biết được EOF */
if (shutdown(sfd, SHUT_WR) == -1)
errExit("shutdown");
exit(EXIT_SUCCESS);
}
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_echo_cl.c

```

## 61.3 Các System Call I/O dành riêng cho Socket: recv() và send()

Các system call `recv()` và `send()` thực hiện thao tác I/O trên các socket đã thiết lập kết nối (connected socket). Chúng cung cấp các tính năng đặc thù của socket mà các system call `read()` và `write()` truyền thống không có.

## include <sys/socket.h>
ssize_t recv(int sockfd, void *buffer, size_t length, int flags);
                    Trả về số byte nhận được, 0 khi gặp EOF, hoặc –1 khi lỗi
ssize_t send(int sockfd, const void *buffer, size_t length, int flags);
                                    Trả về số byte đã gửi, hoặc –1 khi lỗi
```

Giá trị trả về và ba tham số đầu tiên của `recv()` và `send()` hoàn toàn giống với `read()` và `write()`. Tham số cuối cùng, `flags`, là một mặt nạ bit (bit mask) dùng để thay đổi hành vi của thao tác I/O. Đối với `recv()`, các bit có thể được kết hợp bằng phép toán OR trong `flags` bao gồm:

### MSG_DONTWAIT

Thực hiện một thao tác `recv()` ở chế độ không chặn (nonblocking). Nếu không có dữ liệu nào sẵn sàng, thay vì chuyển sang trạng thái chặn (blocking), hàm sẽ trả về ngay lập tức với mã lỗi `EAGAIN`. Chúng ta có thể đạt được hành vi tương tự bằng cách sử dụng `fcntl()` để thiết lập chế độ không chặn (`O_NONBLOCK`) cho socket, điểm khác biệt là `MSG_DONTWAIT` cho phép chúng ta kiểm soát hành vi không chặn này cho từng lời gọi riêng lẻ (per-call basis).

### MSG\_OOB

Nhận dữ liệu ngoài băng tần (out-of-band data) trên socket. Chúng ta sẽ mô tả ngắn gọn tính năng này trong Mục [61.13.1.](#page-134-0)

### MSG\_PEEK

Truy xuất một bản sao của các byte được yêu cầu từ bộ đệm (buffer) của socket, nhưng không thực sự xóa chúng khỏi bộ đệm đó. Dữ liệu này sau đó có thể được đọc lại bởi một lời gọi `recv()` hoặc `read()` khác.

### MSG\_WAITALL

Thông thường, một lời gọi `recv()` sẽ trả về giá trị nhỏ hơn giữa số lượng byte được yêu cầu (`length`) và số lượng byte thực sự có sẵn trong socket. Việc chỉ định cờ `MSG_WAITALL` khiến system call bị chặn cho đến khi đủ `length` byte được nhận về. Tuy nhiên, ngay cả khi cờ này được chỉ định, lời gọi vẫn có thể trả về số byte ít hơn yêu cầu nếu: (a) bắt được một tín hiệu (signal); (b) đầu bên kia (peer) trên một stream socket chấm dứt kết nối; (c) gặp phải một byte dữ liệu ngoài băng tần (Mục [61.13.1](#page-134-0)); (d) thông điệp nhận được từ một datagram socket nhỏ hơn `length` byte; hoặc (e) xảy ra lỗi trên socket. (Cờ `MSG_WAITALL` có thể thay thế hàm `readn()` mà chúng ta đã minh họa trong [Liệt kê 61-1](#page-106-0), với điểm khác biệt là hàm `readn()` của chúng ta có cơ chế tự khởi động lại nếu bị ngắt bởi một trình xử lý tín hiệu - signal handler).

Tất cả các cờ nêu trên đều được quy định trong SUSv3, ngoại trừ `MSG_DONTWAIT`, tuy nhiên cờ này vẫn có sẵn trên một số implementación (phần hiện thực) UNIX khác. Cờ `MSG_WAITALL` là một phần bổ sung sau này cho API socket và không có mặt ở một số phiên bản hiện thực cũ hơn.

Đối với `send()`, các bit có thể được kết hợp bằng phép OR trong `flags` bao gồm:

### MSG\_DONTWAIT

Thực hiện một thao tác `send()` không chặn (nonblocking). Nếu dữ liệu không thể được truyền đi ngay lập tức (do bộ đệm gửi của socket đã đầy), thay vì bị chặn, hàm sẽ thất bại với mã lỗi `EAGAIN`. Giống như `recv()`, hiệu ứng tương tự có thể đạt được bằng cách thiết lập cờ `O_NONBLOCK` cho socket.

### MSG\_MORE (kể từ Linux 2.4.4)

Cờ này được sử dụng với các socket TCP để đạt được hiệu ứng tương tự như tùy chọn socket `TCP_CORK` (Mục [61.4](#page-111-0)), với điểm khác biệt là nó cung cấp cơ chế gom dữ liệu (corking) cho từng lời gọi riêng lẻ. Kể từ Linux 2.6, cờ này cũng có thể được sử dụng với các datagram socket, nơi nó mang ý nghĩa khác. Dữ liệu được truyền trong các lời gọi `send()` hoặc `sendto()` liên tiếp có chỉ định `MSG_MORE` sẽ được đóng gói thành một datagram duy nhất, datagram này chỉ được truyền đi khi có một lời gọi tiếp theo không chỉ định cờ này. (Linux cũng cung cấp một tùy chọn socket tương tự là `UDP_CORK` khiến dữ liệu từ các lời gọi `send()` hoặc `sendto()` liên tiếp được tích lũy vào một datagram duy nhất và được truyền đi khi `UDP_CORK` bị vô hiệu hóa). Cờ `MSG_MORE` không có tác dụng đối với các UNIX domain socket.

### MSG\_NOSIGNAL

Khi gửi dữ liệu trên một socket luồng (stream socket) đã kết nối, cờ này không tạo ra tín hiệu `SIGPIPE` nếu đầu bên kia của kết nối đã bị đóng. Thay vào đó, lời gọi `send()` sẽ thất bại với mã lỗi `EPIPE`. Hành vi này hoàn toàn giống với việc bỏ qua tín hiệu `SIGPIPE`, điểm khác biệt là cờ `MSG\_NOSIGNAL` kiểm soát hành vi này trên cơ sở từng lời gọi (per-call basis).

MSG\_OOB

Gửi dữ liệu ngoài băng tần (out-of-band data) trên một stream socket. Tham khảo Mục [61.13.1.](#page-134-0)

Trong số các cờ trên, chỉ có `MSG\_OOB` được quy định bởi chuẩn SUSv3. Cờ `MSG\_DONTWAIT` xuất hiện trên một số bản cài đặt UNIX khác, trong khi `MSG\_NOSIGNAL` và `MSG\_MORE` là các cờ đặc trưng của Linux (Linux-specific).

Các trang hướng dẫn sử dụng (manual pages) `send(2)` và `recv(2)` mô tả các cờ bổ sung khác mà chúng ta không đề cập đến ở đây.

## 61.4 System Call sendfile()

Các ứng dụng như máy chủ web (web server) và máy chủ tập tin (file server) thường xuyên cần truyền tải nội dung nguyên vẹn của một tập tin đĩa thông qua một socket (đã kết nối). Một cách để thực hiện việc này là sử dụng một vòng lặp có dạng sau:

```
while ((n = read(diskfilefd, buf, BUZ_SIZE)) > 0)
 write(sockfd, buf, n);
```

Đối với nhiều ứng dụng, một vòng lặp như vậy là hoàn toàn chấp nhận được. Tuy nhiên, nếu chúng ta thường xuyên truyền các tập tin lớn qua socket, kỹ thuật này sẽ kém hiệu quả. Để truyền tập tin, chúng ta phải sử dụng hai system call (có thể lặp lại nhiều lần bên trong một vòng lặp): một để sao chép nội dung tập tin từ bộ đệm cache của kernel (kernel buffer cache) vào không gian người dùng (User Space), và một để sao chép bộ đệm từ User Space ngược lại vào không gian nhân (Kernel Space) nhằm truyền tải qua socket. Kịch bản này được minh họa ở phía bên trái của [Hình 61-1.](#page-112-0) Quá trình hai bước này tỏ ra lãng phí nếu ứng dụng không thực hiện bất kỳ xử lý nào đối với nội dung tập tin trước khi truyền đi. System call `sendfile()` được thiết kế để loại bỏ sự kém hiệu quả này. Khi một ứng dụng gọi `sendfile()`, nội dung tập tin được truyền trực tiếp đến socket mà không cần đi qua User Space, như được minh họa ở phía bên phải của [Hình 61-1](#page-112-0). Đây được gọi là quá trình truyền không sao chép (zero-copy transfer).

![](_page_112_Figure_1.jpeg)

**Hình 61-1:** Truyền nội dung của một tập tin đến một socket

## include <sys/sendfile.h>

ssize_t sendfile(int out_fd, int in_fd, off_t *offset, size_t count);
Trả về số lượng byte được truyền, hoặc –1 nếu có lỗi

```

System call `sendfile()` truyền các byte từ tập tin được trỏ bởi File Descriptor `in_fd` sang tập tin được trỏ bởi File Descriptor `out_fd`. Descriptor `out_fd` bắt buộc phải trỏ tới một socket. Tham số `in_fd` phải trỏ tới một tập tin mà hàm `mmap()` có thể áp dụng được; trong thực tế, điều này thường có nghĩa là một tập tin thông thường (regular file). Điều này làm hạn chế phần nào việc sử dụng `sendfile()`. Chúng ta có thể dùng nó để truyền dữ liệu từ một tập tin sang một socket, nhưng không thể làm ngược lại. Và chúng ta không thể sử dụng `sendfile()` để truyền dữ liệu trực tiếp từ socket này sang socket khác.

> Lợi ích về hiệu năng cũng có thể đạt được nếu `sendfile()` được dùng để truyền các byte giữa hai tập tin thông thường. Trên Linux 2.4 trở về trước, `out_fd` có thể trỏ tới một tập tin thông thường. Một số thay đổi trong việc cài đặt bên dưới đã khiến tính năng này biến mất từ phiên bản kernel 2.6. Tuy nhiên, tính năng này có thể được khôi phục trong các phiên bản kernel tương lai.

Nếu `offset` khác `NULL`, nó phải trỏ đến một giá trị kiểu `off_t` xác định vị trí bù (offset) bắt đầu trong tập tin từ đó các byte sẽ được truyền từ `in_fd`. Đây là một tham số kiểu giá trị-kết quả (value-result argument). Khi trả về, nó chứa offset của byte tiếp theo ngay sau byte cuối cùng vừa được truyền từ `in_fd`. Trong trường hợp này, `sendfile()` không làm thay đổi file offset của `in_fd`.

Nếu `offset` là `NULL`, các byte sẽ được truyền từ `in_fd` bắt đầu từ file offset hiện tại, và file offset này sẽ được cập nhật để phản ánh số lượng byte đã được truyền.

Tham số `count` chỉ định số lượng byte cần truyền. Nếu gặp kết thúc tập tin (end-of-file) trước khi truyền đủ `count` byte, chỉ có các byte hiện có được truyền đi. Khi thành công, `sendfile()` trả về số lượng byte thực tế đã được truyền.

Chuẩn SUSv3 không quy định `sendfile()`. Các phiên bản của `sendfile()` có sẵn trên một số bản cài đặt UNIX khác, nhưng danh sách tham số thường khác với phiên bản trên Linux.

> Bắt đầu từ kernel 2.6.17, Linux cung cấp ba system call mới (không theo chuẩn)—`splice()`, `vmsplice()`, và `tee()`—cung cấp tập siêu tập (superset) các tính năng của `sendfile()`. Xem các trang manual để biết thêm chi tiết.

### Tùy chọn Socket TCP_CORK

Để nâng cao hơn nữa hiệu quả của các ứng dụng TCP sử dụng sendfile(), đôi khi việc sử dụng tùy chọn socket TCP_CORK đặc trưng của Linux (Linux-specific) là rất hữu ích. Lấy ví dụ, hãy xét một máy chủ web (web server) truyền một trang web để phản hồi lại yêu cầu từ một trình duyệt web. Phản hồi của máy chủ web bao gồm hai phần: các HTTP header (tiêu đề HTTP), có lẽ được xuất ra bằng hàm write(), theo sau là dữ liệu của trang, có lẽ được xuất ra bằng sendfile(). Trong kịch bản này, thông thường hai TCP segment (phân đoạn TCP) sẽ được truyền đi: các header được gửi trong segment đầu tiên (khá nhỏ), và sau đó dữ liệu trang được gửi trong segment thứ hai. Đây là một cách sử dụng băng thông mạng kém hiệu quả. Nó có thể cũng tạo ra công việc không cần thiết cho cả TCP bên gửi và bên nhận, vì trong nhiều trường hợp, HTTP header và dữ liệu trang đủ nhỏ để vừa vặn bên trong một TCP segment duy nhất. Tùy chọn TCP_CORK được thiết kế để giải quyết sự kém hiệu quả này.

Khi tùy chọn TCP_CORK được bật trên một TCP socket, toàn bộ dữ liệu xuất ra tiếp theo sẽ được đệm (buffer) thành một TCP segment duy nhất cho đến khi đạt đến giới hạn trên về kích thước của một segment, tùy chọn TCP_CORK bị tắt, socket bị đóng, hoặc tối đa 200 mili giây trôi qua tính từ thời điểm byte được "nút" (cork) đầu tiên được ghi. (Thời gian chờ này đảm bảo rằng dữ liệu bị nút được truyền đi nếu ứng dụng quên tắt tùy chọn TCP_CORK).

Chúng ta bật và tắt tùy chọn TCP_CORK bằng cách sử dụng system call (lời gọi hệ thống) setsockopt() (Mục [61.9](#page-129-1)). Đoạn mã sau (bỏ qua phần kiểm tra lỗi) minh họa việc sử dụng TCP_CORK cho ví dụ máy chủ HTTP giả định của chúng tôi:

```

int optval;
/* Enable TCP_CORK option on 'sockfd' - subsequent TCP output is corked
until this option is disabled. */
optval = 1;
setsockopt(sockfd, IPPROTO_TCP, TCP_CORK, sizeof(optval));
write(sockfd, ...); /* Write HTTP headers */
sendfile(sockfd, ...); /* Send page data */
/* Disable TCP_CORK option on 'sockfd' - corked output is now transmitted
in a single TCP segment. */
optval = 0
setsockopt(sockfd, IPPROTO_TCP, TCP_CORK, sizeof(optval));

```

Chúng ta có thể tránh khả năng hai segment được truyền đi bằng cách xây dựng một bộ đệm dữ liệu duy nhất bên trong ứng dụng của mình, và sau đó truyền bộ đệm đó bằng một lệnh write() duy nhất. (Ngoài ra, chúng ta có thể sử dụng writev() để kết hợp hai bộ đệm riêng biệt trong một thao tác xuất duy nhất). Tuy nhiên, nếu chúng ta muốn kết hợp hiệu quả zero-copy của sendfile() với khả năng bao gồm một header như một phần của segment đầu tiên chứa dữ liệu tệp được truyền, thì chúng ta cần sử dụng TCP_CORK.

> Tại Mục [61.3](#page-110-1), chúng tôi đã lưu ý rằng cờ MSG_MORE cung cấp chức năng tương tự như TCP_CORK, nhưng trên cơ sở từng system call (per-system-call). Đây không hẳn là một lợi thế. Có thể thiết lập tùy chọn TCP_CORK trên socket, và sau đó thực thi exec một chương trình thực hiện việc xuất dữ liệu trên file descriptor (bảng mô tả tệp) được kế thừa mà không cần nhận biết về tùy chọn TCP_CORK. Ngược lại, việc sử dụng MSG_MORE đòi hỏi phải thay đổi mã nguồn của chương trình một cách rõ ràng.

FreeBSD cung cấp một tùy chọn tương tự như TCP_CORK dưới hình thức TCP_NOPUSH.

## 61.5 Truy xuất Địa chỉ Socket

Các system call getsockname() và getpeername() lần lượt trả về địa chỉ cục bộ (local address) mà một socket được ràng buộc (bind) và địa chỉ của socket đối tác (peer socket) mà socket cục bộ được kết nối tới.

## include <sys/socket.h>
int getsockname(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
int getpeername(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
                                        Cả hai đều trả về 0 khi thành công, hoặc –1 khi lỗi
```

Đối với cả hai lời gọi, sockfd là một file descriptor tham chiếu đến một socket, và addr là con trỏ tới một bộ đệm có kích thước phù hợp được sử dụng để trả về một cấu trúc chứa địa chỉ socket. Kích thước và kiểu của cấu trúc này phụ thuộc vào miền socket (socket domain). Đối số addrlen là một đối số dạng giá trị-kết quả (value-result argument). Trước khi gọi, nó nên được khởi tạo bằng độ dài của bộ đệm trỏ bởi addr; khi trả về, nó chứa sốbyte thực sự được ghi vào bộ đệm này.

Hàm getsockname() trả về họ địa chỉ (address family) của socket và địa chỉ mà socket đó được ràng buộc. Điều này rất hữu ích nếu socket được ràng buộc bởi một chương trình khác (ví dụ: inetd(8)) và file descriptor của socket sau đó được giữ nguyên qua một lệnh exec().

Việc gọi getsockname() cũng hữu ích nếu chúng ta muốn xác định số cổng tạm thời (ephemeral port number) mà kernel (nhân) đã gán cho một socket khi thực hiện một ràng buộc ngầm (implicit bind) đối với một Internet domain socket. Kernel thực hiện ràng buộc ngầm trong các trường hợp sau:

- sau một lời gọi connect() hoặc listen() trên một TCP socket chưa từng được ràng buộc trước đó với một địa chỉ bởi bind();
- trên lần gọi sendto() đầu tiên trên một UDP socket chưa từng được ràng buộc trước đó với một địa chỉ; hoặc
- sau một lời gọi bind() trong đó số cổng (sin_port) được chỉ định là 0. Trong trường hợp này, bind() chỉ định địa chỉ IP cho socket, nhưng kernel sẽ chọn một số cổng tạm thời.

System call `getpeername()` trả về địa chỉ của socket đối tác (peer socket) trên một kết nối stream socket. Điều này hữu ích chủ yếu với các TCP socket, nếu server muốn tìm hiểu địa chỉ của client đã thiết lập kết nối. Thông tin này cũng có thể lấy được khi thực hiện lời gọi `accept()`; tuy nhiên, nếu server được `exec` bởi chương trình đã gọi `accept()` (ví dụ: `inetd`), thì nó sẽ kế thừa file descriptor của socket, nhưng thông tin địa chỉ do `accept()` trả về sẽ không còn khả dụng nữa.

[Listing 61-3](#page-116-0) minh họa việc sử dụng `getsockname()` và `getpeername()`. Chương trình này sử dụng các hàm mà chúng ta đã định nghĩa trong [Listing 59-9](#page-79-1) (ở trang [1228](#page-79-1)), và thực hiện các bước sau:

- 1. Sử dụng hàm `inetListen()` của chúng ta để tạo một listening socket (`listenFd`), được bind với địa chỉ IP wildcard (đại diện) và cổng (port) được chỉ định trong tham số dòng lệnh duy nhất của chương trình. (Cổng có thể được chỉ định bằng số hoặc tên dịch vụ). Tham số `len` trả về độ dài của cấu trúc địa chỉ cho domain của socket này. Giá trị này được truyền vào một lời gọi `malloc()` sau đó để cấp phát một bộ đệm (buffer) được dùng để trả về địa chỉ socket từ các lời gọi `getsockname()` và `getpeername()`.
- 2. Sử dụng hàm `inetConnect()` của chúng ta để tạo socket thứ hai (`connFd`), được dùng để gửi yêu cầu kết nối đến socket được tạo ở bước 1.
- 3. Gọi `accept()` trên listening socket để tạo socket thứ ba (`acceptFd`), socket này được kết nối với socket được tạo ở bước trước.
- 4. Sử dụng các lời gọi `getsockname()` và `getpeername()` để lấy địa chỉ cục bộ (local address) và địa chỉ đối tác (peer address) cho hai socket đã kết nối (`connFd` và `acceptFd`). Sau mỗi lời gọi này, chương trình sử dụng hàm `inetAddressStr()` của chúng ta để chuyển đổi địa chỉ socket sang dạng có thể in được.
- 5. Ngủ (sleep) trong vài giây để chúng ta có thể chạy `netstat` nhằm xác nhận thông tin địa chỉ socket. (Chúng ta mô tả `netstat` trong Mục [61.7.](#page-126-0))

Nhật ký phiên shell sau đây cho thấy một ví dụ chạy chương trình này:

```
$ ./socknames 55555 &
getsockname(connFd): (localhost, 32835)
getsockname(acceptFd): (localhost, 55555)
getpeername(connFd): (localhost, 55555)
getpeername(acceptFd): (localhost, 32835)
[1] 8171
$ netstat -a | egrep '(Address|55555)'
Proto Recv-Q Send-Q Local Address Foreign Address State
tcp 0 0 *:55555 *:* LISTEN
tcp 0 0 localhost:32835 localhost:55555 ESTABLISHED
tcp 0 0 localhost:55555 localhost:32835 ESTABLISHED
```

Từ kết quả đầu ra ở trên, chúng ta có thể thấy rằng socket đã kết nối (`connFd`) đã được bind với cổng tạm thời (ephemeral port) `32835`. Lệnh `netstat` cho chúng ta thông tin về cả ba socket được tạo bởi chương trình, và cho phép chúng ta xác nhận thông tin cổng cho hai socket đã kết nối, vốn đang ở trạng thái `ESTABLISHED` (được mô tả trong Mục [61.6.3](#page-120-1)).

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/socknames.c
## include "inet_sockets.h" /* Khai báo các hàm socket của chúng ta */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int listenFd, acceptFd, connFd;
 socklen_t len; /* Kích thước bộ đệm địa chỉ socket */
 void *addr; /* Bộ đệm cho địa chỉ socket */
 char addrStr[IS_ADDR_STR_LEN];
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s service\n", argv[0]);
 listenFd = inetListen(argv[1], 5, &len);
 if (listenFd == -1)
 errExit("inetListen");
 connFd = inetConnect(NULL, argv[1], SOCK_STREAM);
 if (connFd == -1)
 errExit("inetConnect");
 acceptFd = accept(listenFd, NULL, NULL);
 if (acceptFd == -1)
 errExit("accept");
 addr = malloc(len);
 if (addr == NULL)
 errExit("malloc");
 if (getsockname(connFd, addr, &len) == -1)
 errExit("getsockname");
 printf("getsockname(connFd): %s\n",
 inetAddressStr(addr, len, addrStr, IS_ADDR_STR_LEN));
 if (getsockname(acceptFd, addr, &len) == -1)
 errExit("getsockname");
 printf("getsockname(acceptFd): %s\n",
 inetAddressStr(addr, len, addrStr, IS_ADDR_STR_LEN));
 if (getpeername(connFd, addr, &len) == -1)
 errExit("getpeername");
 printf("getpeername(connFd): %s\n",
 inetAddressStr(addr, len, addrStr, IS_ADDR_STR_LEN));
 if (getpeername(acceptFd, addr, &len) == -1)
 errExit("getpeername");
 printf("getpeername(acceptFd): %s\n",
 inetAddressStr(addr, len, addrStr, IS_ADDR_STR_LEN));
 sleep(30); /* Cho chúng ta thời gian chạy netstat(8) */
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/socknames.c
```

## 61.6 Tìm hiểu kỹ hơn về TCP

Việc nắm được một số chi tiết về hoạt động của TCP giúp chúng ta gỡ lỗi (debug) các ứng dụng sử dụng TCP socket, và trong một số trường hợp, giúp các ứng dụng đó hoạt động hiệu quả hơn. Trong các mục tiếp theo, chúng ta sẽ tìm hiểu về:

- định dạng của các TCP segment;
- cơ chế xác nhận (acknowledgement scheme) của TCP;
- máy trạng thái (state machine) của TCP;
- việc thiết lập và kết thúc kết nối TCP; và
- trạng thái `TIME_WAIT` của TCP.

### 61.6.1 Định dạng của một TCP Segment

Hình 61-2 minh họa định dạng của các đoạn (segment) TCP được trao đổi giữa các đầu mút (endpoint) của một kết nối TCP. Ý nghĩa của các trường này như sau:

- *Source port number* (Số cổng nguồn): Đây là số cổng của TCP gửi.
- Destination port number (Số cổng đích): Đây là số cổng của TCP đích.
- Sequence number (Số thứ tự): Đây là số thứ tự cho đoạn này. Đây là độ lệch (offset) của byte dữ liệu đầu tiên trong đoạn này nằm trong luồng dữ liệu đang được truyền theo hướng này qua kết nối, như được mô tả trong Mục 58.6.3.

![](_page_117_Figure_12.jpeg)

**Hình 61-2:** Định dạng của một đoạn (segment) TCP

- Acknowledgement number (Số xác nhận): Nếu bit ACK (xem bên dưới) được thiết lập, thì trường này chứa số thứ tự của byte dữ liệu tiếp theo mà bên nhận (receiver) mong đợi nhận được từ bên gửi (sender).
- Header length (Độ dài tiêu đề): Đây là độ dài của phần tiêu đề (header), tính theo đơn vị từ 32-bit (32-bit word). Vì đây là một trường 4-bit, tổng độ dài tiêu đề có thể lên tới 60 byte (15 từ). Trường này cho phép TCP bên nhận xác định độ dài của trường tùy chọn có độ dài biến đổi (variable-length options field) và điểm bắt đầu của dữ liệu.
- Reserved (Dự trữ): Bao gồm 4 bit không sử dụng (phải được đặt là 0).
- Control bits (Các bit điều khiển): Trường này bao gồm 8 bit dùng để chỉ định rõ hơn ý nghĩa của đoạn:
  - CWR: cờ giảm cửa sổ tắc nghẽn (congestion window reduced).
  - ECE: cờ báo hiệu tắc nghẽn tường minh (explicit congestion notification echo). Các cờ CWR và ECE được sử dụng như một phần của thuật toán Thông báo Tắc nghẽn Tường minh (Explicit Congestion Notification - ECN) của TCP/IP. ECN là một bổ sung tương đối gần đây đối với TCP/IP và được mô tả trong RFC 3168 và trong [Floyd, 1994]. ECN được triển khai trong Linux từ kernel phiên bản 2.4 trở đi, và được kích hoạt bằng cách đặt một giá trị khác 0 vào tệp chuyên biệt của Linux `/proc/sys/net/ipv4/tcp_ecn`.
  - URG: nếu được thiết lập, thì trường con trỏ khẩn cấp (urgent pointer) chứa thông tin hợp lệ.
  - ACK: nếu được thiết lập, thì trường số xác nhận chứa thông tin hợp lệ (tức là đoạn này xác nhận dữ liệu đã được gửi trước đó bởi bên đối đẳng).
  - PSH: đẩy (push) tất cả dữ liệu đã nhận đến tiến trình (process) nhận. Cờ này được mô tả trong RFC 993 và trong [Stevens, 1994].
  - RST: thiết lập lại (reset) kết nối. Cờ này được sử dụng để xử lý các tình huống lỗi khác nhau.
  - SYN: đồng bộ hóa số thứ tự (synchronize sequence numbers). Các đoạn có cờ này được thiết lập sẽ được trao đổi trong quá trình thiết lập kết nối (connection establishment) cho phép hai TCP chỉ định các số thứ tự ban đầu sẽ được sử dụng để truyền dữ liệu theo mỗi hướng.
  - FIN: được sử dụng bởi bên gửi để chỉ ra rằng nó đã truyền xong dữ liệu.

Nhiều bit điều khiển (hoặc không có bit nào) có thể được thiết lập trong một đoạn, cho phép một đoạn duy nhất phục vụ nhiều mục đích. Ví dụ, chúng ta sẽ thấy sau này rằng một đoạn có cả hai bit SYN và ACK được thiết lập sẽ được trao đổi trong quá trình thiết lập kết nối TCP.

- Window size (Kích thước cửa sổ): Trường này được sử dụng khi bên nhận gửi một ACK để chỉ ra số byte dữ liệu mà bên nhận còn khoảng trống để chấp nhận. (Điều này liên quan đến cơ chế cửa sổ trượt [sliding window] được mô tả ngắn gọn trong Mục [58.6.3.](#page-41-1))
- Checksum (Mã kiểm tra): Đây là một mã kiểm tra 16-bit bao trùm cả phần tiêu đề TCP và dữ liệu TCP.

Mã kiểm tra TCP không chỉ bao trùm tiêu đề và dữ liệu TCP, mà còn bao gồm 12 byte thường được gọi là tiêu đề giả TCP (TCP pseudoheader). Tiêu đề giả bao gồm các thành phần sau: địa chỉ IP nguồn và IP đích (mỗi địa chỉ 4 byte); 2 byte chỉ định kích thước của đoạn TCP (giá trị này được tính toán, nhưng không phải là một phần của tiêu đề IP hoặc tiêu đề TCP); 1 byte chứa giá trị 6, đây là số hiệu giao thức duy nhất của TCP trong bộ giao thức TCP/IP; và 1 byte đệm (padding) chứa số 0 (để độ dài của tiêu đề giả là bội số của 16-bit). Mục đích của việc đưa tiêu đề giả vào phép tính mã kiểm tra là cho phép TCP bên nhận kiểm tra kép rằng một đoạn đến đã đi đúng đích (tức là IP không chấp nhận nhầm một datagram được gửi đến một host khác hoặc chuyển cho TCP một gói tin đáng lẽ phải đi đến một tầng cao hơn [upper layer] khác). UDP tính toán mã kiểm tra trong các tiêu đề gói tin của nó theo cách thức tương tự và vì những lý do tương tự. Xem [Stevens, 1994] để biết thêm chi tiết về tiêu đề giả.

- Urgent pointer (Con trỏ khẩn cấp): Nếu bit điều khiển URG được thiết lập, thì trường này chỉ ra vị trí của cái gọi là dữ liệu khẩn cấp (urgent data) trong luồng dữ liệu đang được truyền từ bên gửi đến bên nhận. Chúng ta thảo luận ngắn gọn về dữ liệu khẩn cấp trong Mục [61.13.1.](#page-134-0)
- Options (Tùy chọn): Đây là một trường có độ dài biến đổi chứa các tùy chọn điều khiển hoạt động của kết nối TCP.
- Data (Dữ liệu): Trường này chứa dữ liệu người dùng (user data) được truyền trong đoạn này. Trường này có thể có độ dài bằng 0 nếu đoạn này không chứa bất kỳ dữ liệu nào (ví dụ: nếu nó đơn giản là một đoạn ACK).

### 61.6.2 Số thứ tự TCP (TCP Sequence Numbers) và Xác nhận (Acknowledgements)

Mỗi byte dữ liệu được truyền qua một kết nối TCP (TCP connection) đều được TCP gán cho một số thứ tự logic (logical sequence number). (Mỗi một trong hai luồng dữ liệu của kết nối sẽ có hệ thống đánh số thứ tự riêng của mình.) Khi một phân đoạn (segment) được truyền đi, trường số thứ tự (sequence number field) của nó được thiết lập bằng độ lệch logic (logical offset) của byte dữ liệu đầu tiên trong phân đoạn đó, tính trong tổng luồng dữ liệu đang được truyền theo hướng này qua kết nối. Điều này cho phép phía TCP nhận có thể lắp ráp các phân đoạn nhận được theo đúng thứ tự, đồng thời chỉ ra dữ liệu nào đã được nhận khi gửi một thông điệp xác nhận (acknowledgement) lại cho phía gửi.

Để triển khai truyền thông đáng tin cậy (reliable communication), TCP sử dụng các cơ chế xác nhận dương tính (positive acknowledgements); nghĩa là, khi một phân đoạn được nhận thành công, một thông điệp xác nhận (ví dụ: một phân đoạn có bật cờ ACK - ACK bit set) sẽ được gửi từ TCP nhận tới TCP gửi, như được minh họa trong [Hình 61-3.](#page-119-0) Trường số thứ tự xác nhận (acknowledgement number field) của thông điệp này được thiết lập để chỉ ra số thứ tự logic của byte dữ liệu tiếp theo mà bên nhận mong đợi nhận được. (Nói cách khác, giá trị trong trường số thứ tự xác nhận chính là số thứ tự của byte cuối cùng trong phân đoạn mà nó xác nhận, cộng thêm 1.)

![](_page_119_Figure_7.jpeg)

**Hình 61-3:** Các thông điệp xác nhận trong TCP

Khi TCP gửi truyền đi một phân đoạn, nó sẽ khởi động một bộ đếm thời gian (timer). Nếu không nhận được thông điệp xác nhận trước khi bộ đếm thời gian này hết hạn (expires), phân đoạn đó sẽ được truyền lại (retransmitted).

[Hình 61-3](#page-119-0) và các biểu đồ tương tự sau này nhằm mục đích minh họa quá trình trao đổi các phân đoạn TCP giữa hai điểm cuối (endpoints). Một chiều thời gian ngầm định (implicit time dimension) được giả định khi đọc các biểu đồ này từ trên xuống dưới.

### 61.6.3 Máy trạng thái TCP (TCP State Machine) và Biểu đồ chuyển đổi trạng thái

Việc duy trì một kết nối TCP đòi hỏi sự phối hợp giữa các TCP ở cả hai đầu kết nối. Để giảm độ phức tạp của tác vụ này, một điểm cuối TCP (TCP endpoint) được mô hình hóa như một máy trạng thái (state machine). Điều này có nghĩa là TCP có thể ở một trong một tập hợp các trạng thái cố định, và nó chuyển từ trạng thái này sang trạng thái khác để phản hồi lại các sự kiện, chẳng hạn như các lệnh hệ thống (system calls) từ ứng dụng nằm phía trên TCP hoặc sự đến của các phân đoạn TCP từ TCP đối tác (peer TCP). Các trạng thái của TCP bao gồm:

- LISTEN: TCP đang chờ yêu cầu kết nối từ một TCP đối tác.
- SYN\_SENT: TCP đã gửi một gói SYN thay mặt cho một ứng dụng thực hiện thao tác mở chủ động (active open) và đang đợi phản hồi từ đối tác để hoàn tất kết nối.
- SYN\_RECV: TCP, trước đó ở trạng thái LISTEN, đã nhận được một gói SYN và đã phản hồi bằng một gói SYN/ACK (tức là một phân đoạn TCP được bật cả hai cờ SYN và ACK), và hiện đang đợi gói ACK từ TCP đối tác để hoàn tất kết nối.
- ESTABLISHED: Quá trình thiết lập kết nối với TCP đối tác đã hoàn tất. Các phân đoạn dữ liệu giờ đây có thể được trao đổi theo cả hai hướng giữa hai TCP.
- FIN_WAIT1: Ứng dụng đã đóng kết nối. TCP đã gửi một gói FIN tới TCP đối tác nhằm chấm dứt phía kết nối của mình và đang chờ gói ACK từ đối tác. Trạng thái này và ba trạng thái tiếp theo gắn liền với một ứng dụng thực hiện việc đóng chủ động (active close) — nghĩa là ứng dụng đầu tiên đóng phía kết nối của mình.
- FIN\_WAIT2: TCP, trước đó ở trạng thái FIN\_WAIT1, nay đã nhận được gói ACK từ TCP đối tác.
- CLOSING: TCP, trước đó đang chờ gói ACK ở trạng thái FIN\_WAIT1, lại nhận được một gói FIN từ đối tác, cho thấy đối tác đồng thời cố gắng thực hiện việc đóng chủ động. (Nói cách khác, hai TCP đã gửi các phân đoạn FIN gần như cùng một thời điểm. Đây là một kịch bản hiếm gặp.)
- TIME\_WAIT: Sau khi thực hiện việc đóng chủ động, TCP đã nhận được một gói FIN, cho thấy TCP đối tác đã thực hiện việc đóng thụ động (passive close). TCP này lúc này sẽ dành ra một khoảng thời gian cố định ở trạng thái TIME\_WAIT, nhằm đảm bảo việc chấm dứt kết nối TCP diễn ra đáng tin cậy và đảm bảo rằng bất kỳ phân đoạn trùng lặp cũ nào cũng sẽ hết hạn trong mạng trước khi một thể hiện mới (incarnation) của cùng kết nối đó được tạo ra. (Chúng tôi giải thích chi tiết hơn về trạng thái TIME\_WAIT ở Mục [61.6.7.](#page-125-0)) Khi khoảng thời gian cố định này kết thúc, kết nối được đóng lại và các tài nguyên kernel (kernel resources) liên quan sẽ được giải phóng.
- CLOSE\_WAIT: TCP đã nhận được một gói FIN từ TCP đối tác. Trạng thái này và trạng thái tiếp theo gắn liền với một ứng dụng thực hiện việc đóng thụ động — nghĩa là ứng dụng thứ hai đóng kết nối.

LAST\_ACK: Ứng dụng đã thực hiện việc đóng thụ động, và TCP, trước đó ở trạng thái CLOSE\_WAIT, đã gửi một gói FIN tới TCP đối tác và đang chờ gói tin này được xác nhận. Khi gói ACK này được nhận, kết nối sẽ được đóng lại và các tài nguyên kernel liên quan sẽ được giải phóng.

Bên cạnh các trạng thái trên, RFC 793 bổ sung thêm một trạng thái giả định nữa là CLOSED, đại diện cho trạng thái khi không có kết nối nào tồn tại (tức là không có tài nguyên kernel nào được phân bổ để mô tả một kết nối TCP).

> [!NOTE]
> Trong danh sách trên, chúng tôi sử dụng các tên gọi trạng thái TCP được định nghĩa trong mã nguồn Linux (Linux source code). Các tên gọi này hơi khác biệt so với các tên gọi trong RFC 793.

Hình 61-4 minh họa sơ đồ chuyển đổi trạng thái (state transition diagram) cho TCP. (Hình vẽ này dựa trên các sơ đồ trong RFC 793 và [Stevens et al., 2004].) Sơ đồ này cho thấy cách một điểm cuối TCP (TCP endpoint) chuyển từ trạng thái này sang trạng thái khác để đáp ứng các sự kiện khác nhau. Mỗi mũi tên biểu thị một sự chuyển đổi khả dĩ và được gán nhãn bằng sự kiện kích hoạt quá trình chuyển đổi đó. Nhãn này có thể là một hành động của ứng dụng (được in đậm) hoặc chuỗi `recv`, biểu thị việc nhận được một phân đoạn (segment) từ TCP ngang hàng (peer TCP). Khi một TCP chuyển từ trạng thái này sang trạng thái khác, nó có thể truyền một phân đoạn tới bên ngang hàng, và điều này được biểu thị bằng nhãn `send` trên đường chuyển đổi. Ví dụ, mũi tên biểu thị sự chuyển đổi từ trạng thái ESTABLISHED sang trạng thái FIN\_WAIT1 cho thấy sự kiện kích hoạt là lời gọi hàm `close()` từ ứng dụng cục bộ, và trong quá trình chuyển đổi đó, TCP sẽ gửi một phân đoạn FIN tới bên ngang hàng của nó.

Trong Hình 61-4, đường đi chuyển đổi thông thường đối với TCP của phía client được thể hiện bằng các mũi tên liền nét đậm, và đường đi chuyển đổi thông thường đối với TCP của phía server được thể hiện bằng các mũi tên đứt nét đậm. (Các mũi tên khác biểu thị những đường ít phổ biến hơn). Quan sát các con số trong ngoặc đơn trên các mũi tên của những đường đi này, chúng ta có thể thấy rằng các phân đoạn được gửi và nhận bởi hai TCP là ảnh phản chiếu của nhau. (Sau trạng thái ESTABLISHED, các đường đi mà TCP server và TCP client trải qua có thể ngược lại với các đường được chỉ ra, nếu chính server là bên thực hiện chủ động đóng kết nối - active close).

> [!NOTE]
> Hình 61-4 không thể hiện tất cả các trạng thái chuyển đổi khả dĩ của máy trạng thái TCP (TCP state machine); nó chỉ minh họa những trạng thái có tầm quan trọng chính. Bạn đọc có thể tìm thấy một sơ đồ chuyển đổi trạng thái TCP chi tiết hơn tại http://www.cl.cam.ac.uk/~pes20/Netsem/poster.pdf.

### 61.6.4 Thiết lập kết nối TCP (TCP Connection Establishment)

Ở cấp độ API socket (sockets API level), hai stream socket được kết nối thông qua các bước sau (xem [Hình 56-1,](#page-7-1) ở trang [1156](#page-7-1)):

- 1. Server gọi hàm `listen()` để thực hiện mở bị động (passive open) một socket, sau đó gọi hàm `accept()`, hàm này sẽ bị chặn (block) cho đến khi kết nối được thiết lập.
- 2. Client gọi hàm `connect()` để thực hiện mở chủ động (active open) một socket nhằm thiết lập kết nối tới socket bị động của server.

Các bước do TCP thực hiện để thiết lập kết nối được minh họa trong [Hình 61-5.](#page-123-0) Các bước này thường được gọi là quá trình bắt tay ba bước (three-way handshake), vì có ba phân đoạn được truyền đi giữa hai TCP. Các bước cụ thể như sau:

1. Lời gọi hàm `connect()` khiến TCP của client gửi một phân đoạn SYN tới TCP của server. Phân đoạn này thông báo cho TCP của server biết số thứ tự ban đầu (initial sequence number) của TCP client

- (được kí hiệu là M trong sơ đồ). Thông tin này là cần thiết vì các số thứ tự không bắt đầu từ 0, như đã lưu ý trong Mục 58.6.3.
- 2. TCP server phải vừa xác nhận (acknowledge) phân đoạn SYN của TCP client, vừa thông báo cho TCP client biết số thứ tự ban đầu của chính nó (được kí hiệu là *N* trong sơ đồ). (Cần có hai số thứ tự vì một stream socket có tính chất hai chiều - bidirectional). TCP server có thể thực hiện cả hai thao tác này bằng cách trả về một phân đoạn duy nhất với cả hai cờ điều khiển SYN và ACK được thiết lập. (Chúng ta gọi thao tác này là ACK được *gắn kèm* (*piggybacked*) trên SYN).
- 3. TCP client gửi một phân đoạn ACK để xác nhận phân đoạn SYN của TCP server.

![](_page_122_Figure_3.jpeg)

Hình 61-4: Sơ đồ chuyển đổi trạng thái TCP

Các phân đoạn SYN được trao đổi trong hai bước đầu tiên của quá trình bắt tay ba bước có thể chứa thông tin trong trường tùy chọn (options field) của tiêu đề TCP (TCP header), thông tin này được sử dụng để xác định các tham số khác nhau cho kết nối. Xem chi tiết trong [Stevens et al., 2004], [Stevens, 1994], và [Wright & Stevens, 1995].

Các nhãn nằm trong dấu ngoặc nhọn (ví dụ: `<LISTEN>`) trong [Hình 61-5](#page-123-0) biểu thị trạng thái của các TCP ở mỗi đầu của kết nối.

Cờ SYN tiêu thụ một byte trong không gian số thứ tự (sequence-number space) của kết nối. Điều này là cần thiết để cờ này có thể được xác nhận một cách rõ ràng không mơ hồ, vì các phân đoạn có thiết lập cờ này cũng có thể chứa các byte dữ liệu. Đây là lý do tại sao chúng ta thể hiện việc xác nhận phân đoạn SYN M dưới dạng `ACK M+1` trong [Hình 61-5.](#page-123-0)

![](_page_123_Figure_3.jpeg)

**Hình 61-5:** Quá trình bắt tay ba bước để thiết lập kết nối TCP

### 61.6.5 Đóng kết nối TCP (TCP Connection Termination)

Việc đóng một kết nối TCP thông thường diễn ra theo cách sau:

- 1. Một ứng dụng ở một đầu của kết nối thực hiện lệnh `close()`. (Điều này thường xảy ra ở phía client, nhưng không bắt buộc.) Chúng ta gọi ứng dụng này đang thực hiện một thao tác đóng chủ động (active close).
- 2. Sau đó, ứng dụng ở đầu kia của kết nối (server) cũng thực hiện lệnh `close()`. Thao tác này được gọi là đóng thụ động (passive close).

[Hình 61-6](#page-124-1) minh họa các bước tương ứng được thực hiện bởi các tầng TCP bên dưới (ở đây, chúng ta giả sử rằng client là bên thực hiện đóng chủ động). Các bước này cụ thể như sau:

- 1. Client thực hiện đóng chủ động, khiến TCP của client gửi một gói tin `FIN` tới TCP của server.
- 2. Sau khi nhận được `FIN`, TCP của server phản hồi bằng một gói tin `ACK`. Bất kỳ nỗ lực nào sau đó của server nhằm thực hiện `read()` từ socket sẽ trả về dấu hiệu kết thúc file (end-of-file, tức là giá trị trả về là 0).
- 3. Khi server sau đó đóng đầu kết nối của chính nó, TCP của server sẽ gửi một gói tin `FIN` tới TCP của client.
- 4. TCP của client phản hồi bằng một gói tin `ACK` để xác nhận gói `FIN` của server.

Giống như cờ `SYN` và vì những lý do tương tự, cờ `FIN` chiếm một byte trong không gian số thứ tự (sequence-number space) của kết nối. Đây là lý do tại sao chúng ta biểu diễn việc xác nhận phân đoạn (segment) `FIN M` là `ACK M+1` trong [Hình 61-6.](#page-124-1)

![](_page_124_Figure_1.jpeg)

**Hình 61-6:** Đóng kết nối TCP

### 61.6.6 Gọi hàm shutdown() trên một TCP Socket

Phần thảo luận trước đó giả định một quá trình đóng song công toàn phần (full-duplex close); nghĩa là một ứng dụng đóng cả hai kênh gửi và nhận của TCP socket bằng cách sử dụng `close()`. Như đã lưu ý trong Phần [61.2](#page-107-1), chúng ta có thể sử dụng `shutdown()` để chỉ đóng một kênh của kết nối (đóng bán song công - half-duplex close). Phần này đề cập đến một số chi tiết cụ thể đối với hàm `shutdown()` trên một TCP socket.

Việc chỉ định tham số `how` là `SHUT_WR` hoặc `SHUT_RDWR` sẽ khởi động chuỗi kết thúc kết nối TCP (tức là đóng chủ động) được mô tả trong Phần [61.6.5,](#page-123-1) bất kể có hay không các bộ mô tả file (file descriptor) khác đang tham chiếu đến socket đó. Khi chuỗi này được khởi tạo, TCP cục bộ sẽ chuyển sang trạng thái `FIN_WAIT1`, và sau đó chuyển sang trạng thái `FIN_WAIT2`, trong khi TCP ở phía đầu xa (peer) chuyển sang trạng thái `CLOSE_WAIT` [\(Hình 61-6\)](#page-124-1). Nếu `how` được chỉ định là `SHUT_WR`, thì do bộ mô tả file socket vẫn hợp lệ và nửa kết nối dùng để đọc vẫn được mở, phía đầu xa có thể tiếp tục gửi dữ liệu ngược lại cho chúng ta.

Thao tác `SHUT_RD` không thể được sử dụng một cách có ý nghĩa với các TCP socket. Lý do là vì hầu hết các cài đặt (implementation) TCP không cung cấp hành vi như mong đợi đối với `SHUT_RD`, và tác động của `SHUT_RD` thay đổi tùy theo từng cài đặt. Trên Linux và một số ít cài đặt khác, sau một lệnh `SHUT_RD` (và sau khi bất kỳ dữ liệu tồn đọng nào đã được đọc hết), hàm `read()` sẽ trả về dấu hiệu kết thúc file (end-of-file), đúng như chúng ta kỳ vọng từ mô tả về `SHUT_RD` trong Phần [61.2](#page-107-1). Tuy nhiên, nếu ứng dụng ở phía đầu xa sau đó ghi dữ liệu vào socket của nó, thì việc đọc dữ liệu đó trên socket cục bộ vẫn có thể thực hiện được.

Trên một số cài đặt khác (ví dụ: các hệ thống BSD), `SHUT_RD` thực sự khiến các lời gọi `read()` tiếp theo luôn trả về 0. Tuy nhiên, trên các cài đặt đó, nếu phía đầu xa tiếp tục gọi `write()` vào socket, thì kênh dữ liệu cuối cùng sẽ đầy đến mức một lời gọi `write()` tiếp theo (có tính chất chặn - blocking) từ phía đầu xa sẽ bị chặn lại (block). (Đối với các socket miền UNIX - UNIX domain stream sockets, phía đầu xa sẽ nhận được tín hiệu `SIGPIPE` và lỗi `EPIPE` nếu nó tiếp tục ghi vào socket của mình sau khi `SHUT_RD` đã được thực hiện trên socket cục bộ.)

Tóm lại, việc sử dụng `SHUT_RD` nên được tránh đối với các ứng dụng TCP tính di portable (portable TCP applications).

### 61.6.7 Trạng thái TIME\_WAIT

Trạng thái `TIME_WAIT` của TCP là một nguồn gây nhầm lẫn thường gặp trong lập trình mạng. Nhìn vào Hình 61-4, chúng ta có thể thấy rằng một TCP thực hiện việc đóng chủ động sẽ đi qua trạng thái này. Trạng thái `TIME_WAIT` tồn tại nhằm phục vụ hai mục đích:

- để thực hiện việc đóng kết nối một cách đáng tin cậy (reliable connection termination); và
- để cho phép hết hạn các phân đoạn trùng lặp cũ trên mạng, nhờ đó chúng không bị chấp nhận bởi một thể hiện mới (incarnation) của kết nối.

Trạng thái `TIME_WAIT` khác với các trạng thái khác ở chỗ sự kiện gây ra việc chuyển đổi thoát khỏi trạng thái này (để sang trạng thái `CLOSED`) là một bộ đếm thời gian (timeout). Bộ đếm thời gian này có thời lượng bằng hai lần giá trị MSL (2MSL), trong đó MSL (Maximum Segment Lifetime - thời gian sống tối đa của phân đoạn) là thời gian sống tối đa giả định của một phân đoạn TCP trên mạng.

> [!NOTE]
> Trường Thời gian sống (Time-to-Live - TTL) 8-bit trong IP header đảm bảo rằng tất cả các gói tin IP cuối cùng sẽ bị loại bỏ nếu chúng không đến được đích trong một số lượng chặng (hop - các bộ định tuyến đi qua) cố định khi di chuyển từ host nguồn đến host đích. MSL là một ước tính về thời gian tối đa mà một gói tin IP có thể mất để vượt quá giới hạn TTL. Do được biểu diễn bằng 8 bit, trường TTL cho phép tối đa 255 chặng. Thông thường, một gói tin IP đòi hỏi ít chặng hơn đáng kể so với mức này để hoàn thành hành trình của mình. Một gói tin có thể gặp phải giới hạn này do một số loại bất thường của bộ định tuyến (ví dụ: sự cố cấu hình bộ định tuyến) khiến gói tin bị kẹt trong một vòng lặp mạng (network loop) cho đến khi vượt quá giới hạn TTL.

Việc cài đặt BSD socket (BSD sockets implementation) giả định giá trị MSL (Maximum Segment Lifetime) là 30 giây và Linux tuân theo tiêu chuẩn của BSD. Do đó, trạng thái `TIME_WAIT` có thời gian tồn tại là 60 giây trên Linux. Tuy nhiên, RFC 1122 khuyến nghị giá trị MSL là 2 phút, và trên các hệ thống tuân theo khuyến nghị này, trạng thái `TIME_WAIT` có thể kéo dài tới 4 phút.

Chúng ta có thể hiểu mục đích đầu tiên của trạng thái `TIME_WAIT` — đảm bảo việc chấm dứt kết nối đáng tin cậy — bằng cách quan sát [Hình 61-6.](#page-124-1) Trong sơ đồ này, chúng ta có thể thấy rằng bốn segment thường được trao đổi trong quá trình chấm dứt một kết nối TCP. Segment cuối cùng trong số này là một ACK được gửi từ TCP thực hiện hành vi đóng chủ động (active close) đến TCP thực hiện hành vi đóng thụ động (passive close). Giả sử rằng gói ACK này bị thất lạc trong mạng. Nếu điều này xảy ra, TCP thực hiện đóng thụ động cuối cùng sẽ truyền lại (retransmit) gói FIN của nó. Việc duy trì TCP thực hiện đóng chủ động ở trạng thái `TIME_WAIT` trong một khoảng thời gian cố định sẽ đảm bảo rằng nó luôn sẵn sàng để gửi lại gói ACK cuối cùng trong trường hợp này. Nếu TCP thực hiện đóng chủ động không còn tồn tại, thì — do nó không giữ lại bất kỳ thông tin trạng thái nào cho kết nối — giao thức TCP sẽ phản hồi lại gói FIN được gửi lại bằng cách gửi một segment RST (reset) đến TCP thực hiện đóng thụ động, và gói RST này sẽ được hiểu là một lỗi. (Điều này giải thích tại sao thời gian của trạng thái `TIME_WAIT` bằng hai lần MSL: một MSL để gói ACK cuối cùng đến được TCP ngang hàng, cộng thêm một khoảng MSL nữa trong trường hợp một gói FIN tiếp theo phải được gửi đi.)

> [!NOTE]
> Một trạng thái tương đương với `TIME_WAIT` là không bắt buộc đối với TCP thực hiện đóng thụ động, bởi vì nó chính là bên khởi tạo trao đổi cuối cùng trong quá trình chấm dứt kết nối. Sau khi gửi gói FIN, TCP này sẽ đợi gói ACK từ phía ngang hàng của nó, và truyền lại gói FIN nếu bộ đếm thời gian (timer) của nó hết hạn trước khi nhận được gói ACK.

Để hiểu mục đích thứ hai của trạng thái `TIME_WAIT` — đảm bảo sự hết hạn của các segment trùng lặp cũ trong mạng — chúng ta phải nhớ rằng thuật toán truyền lại (retransmission algorithm) được sử dụng bởi TCP đồng nghĩa với việc các segment trùng lặp có thể được tạo ra, và tùy thuộc vào các quyết định định tuyến (routing decisions), những bản trùng lặp này có thể đến sau khi kết nối đã bị đóng. Ví dụ, giả sử chúng ta có một kết nối TCP giữa hai địa chỉ socket, chẳng hạn, `204.152.189.116` cổng 21 (cổng FTP) và `200.0.0.1` cổng 50.000. Cũng giả sử rằng kết nối này bị đóng, và sau đó một kết nối mới được thiết lập bằng cách sử dụng chính xác các địa chỉ IP và cổng đó. Hiện tượng này được gọi là một hiện thân mới (new incarnation) của kết nối. Trong trường hợp này, TCP phải đảm bảo rằng không có segment trùng lặp cũ nào từ hiện thân trước đó bị chấp nhận là dữ liệu hợp lệ trong hiện thân mới. Điều này được thực hiện bằng cách ngăn chặn một hiện thân mới được thiết lập khi vẫn còn một kết nối TCP ở trạng thái `TIME_WAIT` trên một trong các điểm cuối (endpoint).

Một câu hỏi thường gặp được đăng trên các diễn đàn trực tuyến là làm cách nào để vô hiệu hóa trạng thái `TIME_WAIT`, vì nó có thể dẫn đến lỗi `EADDRINUSE` ("Address already in use" - Địa chỉ đã được sử dụng) khi một máy chủ được khởi động lại cố gắng liên kết (bind) một socket với một địa chỉ đang có kết nối TCP ở trạng thái `TIME_WAIT`. Mặc dù có các cách để thực hiện việc này (xem [Stevens et al., 2004]), cũng như các cách để "tiêu diệt" một kết nối TCP ở trạng thái này (tức là làm cho trạng thái `TIME_WAIT` chấm dứt sớm, xem [Snader, 2000]), nhưng điều này nên tránh, vì nó sẽ phá vỡ các đảm bảo về độ tin cậy mà trạng thái `TIME_WAIT` mang lại. Tại Mục [61.10,](#page-130-1) chúng ta sẽ xem xét việc sử dụng tùy chọn socket `SO_REUSEADDR`, có thể được dùng để tránh các nguyên nhân thông thường gây ra lỗi `EADDRINUSE`, trong khi vẫn cho phép `TIME_WAIT` cung cấp các đảm bảo về độ tin cậy của nó.

## 61.7 Giám sát Socket: netstat

Chương trình `netstat` hiển thị trạng thái của các Internet domain socket và UNIX domain socket trên một hệ thống. Đây là một công cụ gỡ lỗi (debugging tool) hữu ích khi viết các ứng dụng socket. Hầu hết các bản cài đặt UNIX đều cung cấp một phiên bản của `netstat`, mặc dù có một số thay đổi về cú pháp các tham số dòng lệnh (command-line arguments) giữa các hệ thống.

Theo mặc định, khi được thực thi mà không có tùy chọn dòng lệnh nào, `netstat` hiển thị thông tin cho các socket đã kết nối trong cả hai domain UNIX và Internet. Chúng ta có thể sử dụng một số tùy chọn dòng lệnh để thay đổi thông tin được hiển thị. Một số tùy chọn trong số này được liệt kê trong [Bảng 61-1](#page-126-1).

|  |  |  |  |  |  |  | Bảng 61-1: Các tùy chọn cho lệnh netstat |
|--|--|--|--|--|--|--|----------------------------------------|
|--|--|--|--|--|--|--|----------------------------------------|

| Tùy chọn | Mô tả                                                                 |
|----------|-----------------------------------------------------------------------|
| -a       | Hiển thị thông tin về tất cả các socket, bao cả các socket đang lắng nghe (listening socket) |
| -e       | Hiển thị thông tin mở rộng (bao gồm ID người dùng của chủ sở hữu socket) |

| -c     | Hiển thị lại thông tin socket liên tục (mỗi giây)                     |
| -l     | Chỉ hiển thị thông tin về các socket đang ở trạng thái lắng nghe (listening) |
| -n     | Hiển thị địa chỉ IP, số hiệu cổng (port number) và tên người dùng dưới dạng số |
| -p     | Hiển thị Process ID và tên chương trình sở hữu socket                 |
| inet   | Hiển thị thông tin cho các Internet domain socket                   |
| tcp    | Hiển thị thông tin cho các Internet domain TCP (stream) socket        |
| udp    | Hiển thị thông tin cho các Internet domain UDP (datagram) socket      |
| unix   | Hiển thị thông tin cho các UNIX domain socket                       |

Dưới đây là một ví dụ rút gọn về đầu ra mà chúng ta thấy khi sử dụng `netstat` để liệt kê tất cả các Internet domain socket trên hệ thống:

### \$ **netstat -a --inet**

```
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address Foreign Address State
tcp 0 0 *:50000 *:* LISTEN
tcp 0 0 *:55000 *:* LISTEN
tcp 0 0 localhost:smtp *:* LISTEN
tcp 0 0 localhost:32776 localhost:58000 TIME_WAIT
tcp 34767 0 localhost:55000 localhost:32773 ESTABLISHED
tcp 0 115680 localhost:32773 localhost:55000 ESTABLISHED
udp 0 0 localhost:61000 localhost:60000 ESTABLISHED
udp 684 0 *:60000 *:*
```

Đối với mỗi Internet domain socket, chúng ta thấy các thông tin sau:

- Proto: Đây là giao thức socket (socket protocol) — ví dụ, `tcp` hoặc `udp`.
- Recv-Q: Đây là số byte trong bộ đệm nhận của socket (socket receive buffer) mà ứng dụng phía local chưa đọc. Đối với các UDP socket, trường này không chỉ tính dữ liệu mà còn tính cả các byte trong tiêu đề (header) UDP và các siêu dữ liệu (metadata) khác.
- Send-Q: Đây là số byte được xếp hàng đợi để truyền trong bộ đệm gửi của socket (socket send buffer). Giống như trường Recv-Q, đối với các UDP socket, trường này bao gồm cả các byte trong tiêu đề UDP và các siêu dữ liệu khác.
- Local Address: Đây là địa chỉ mà socket được gắn kết (bound), được thể hiện dưới dạng `host-IP-address:port`. Theo mặc định, cả hai thành phần của địa chỉ được hiển thị dưới dạng tên, trừ khi các giá trị số không thể được phân giải (resolve) thành tên host và service tương ứng. Dấu hoa thị (\*) trong phần host của địa chỉ biểu thị địa chỉ IP đại diện (wildcard IP address).
- Foreign Address: Đây là địa chỉ của socket đối tác (peer socket) mà socket này được kết nối tới. Chuỗi `*:*` cho biết không có địa chỉ đối tác nào.
- State: Đây là trạng thái hiện tại của socket. Đối với một TCP socket, trạng thái này là một trong những trạng thái được mô tả tại Mục [61.6.3](#page-120-1).

Để biết thêm chi tiết, hãy xem trang hướng dẫn thủ công (manual page) `netstat(8)`.

Nhiều tệp cụ thể của Linux nằm trong thư mục `/proc/net` cho phép một chương trình đọc phần lớn các thông tin tương tự do `netstat` hiển thị. Các tệp này được đặt tên lần lượt là `tcp`, `udp`, `tcp6`, `udp6` và `unix`, với các mục đích hiển nhiên tương ứng. Để biết thêm chi tiết, hãy xem trang hướng dẫn thủ công `proc(5)`.

## 61.8 Sử dụng tcpdump để giám sát Lưu lượng TCP

Chương trình `tcpdump` là một công cụ gỡ lỗi (debugging tool) hữu ích cho phép người dùng siêu cao cấp (superuser) giám sát lưu lượng Internet trên một mạng đang hoạt động (live network), tạo ra kết quả dạng văn bản theo thời gian thực tương đương với các sơ đồ như trong [Hình 61-3.](#page-119-0) Mặc dù có tên là `tcpdump`, chương trình này có thể được sử dụng để hiển thị lưu lượng cho tất cả các loại gói tin TCP/IP (ví dụ: các phân đoạn TCP [TCP segment], gói dữ liệu UDP [UDP datagram] và gói tin ICMP). Đối với mỗi gói tin mạng (network packet), `tcpdump` hiển thị các thông tin như dấu thời gian (timestamp), địa chỉ IP nguồn và đích, cùng các chi tiết cụ thể khác của giao thức. Chúng ta có thể lựa chọn các gói tin cần giám sát theo loại giao thức, địa chỉ IP nguồn và đích, số hiệu cổng (port number), và một loạt các tiêu chí khác. Chi tiết đầy đủ được cung cấp trong trang hướng dẫn thủ công `tcpdump`.

> [!NOTE]
> Chương trình `wireshark` (trước đây là `ethereal`; http://www.wireshark.org/) thực hiện tác vụ tương tự như `tcpdump`, nhưng hiển thị thông tin lưu lượng thông qua giao diện đồ họa (graphical interface).

Đối với mỗi phân đoạn TCP (TCP segment), `tcpdump` hiển thị một dòng có dạng sau:

src > dst: flags data-seqno ack window urg <options>

Các trường này có ý nghĩa như sau:

- src: Đây là địa chỉ IP nguồn và cổng (port).
- dst: Đây là địa chỉ IP đích và cổng (port).
- flags: Trường này chứa từ không đến nhiều chữ số/ký tự sau đây, mỗi ký tự tương ứng với một trong các bit điều khiển TCP (TCP control bit) được mô tả tại Mục [61.6.1](#page-117-1): S (SYN), F (FIN), P (PSH), R (RST), E (ECE), và C (CWR).
- data-seqno: Đây là phạm vi của không gian số thứ tự (sequence-number space) được bao phủ bởi các byte trong gói tin này.

Theo mặc định, phạm vi số thứ tự được hiển thị tương đối so với byte đầu tiên được giám sát cho hướng này của luồng dữ liệu (data stream). Tùy chọn `tcpdump –S` khiến các số thứ tự được hiển thị ở định dạng tuyệt đối.

- ack: Đây là chuỗi có dạng "ack num" biểu thị số thứ tự của byte tiếp theo mong đợi từ hướng ngược lại trên kết nối này.
- window: Đây là chuỗi có dạng "win num" biểu thị số byte dung lượng bộ đệm nhận có sẵn để truyền theo hướng ngược lại trên kết nối này.

- urg: Đây là một chuỗi có định dạng "urg num" biểu thị rằng phân đoạn (segment) này chứa dữ liệu khẩn cấp (urgent data) tại độ lệch (offset) được chỉ định trong phân đoạn.
- options: Chuỗi này mô tả bất kỳ tùy chọn TCP (TCP options) nào có trong phân đoạn.

Các trường src, dst và flags luôn xuất hiện. Các trường còn lại chỉ được hiển thị khi phù hợp.

Phiên shell dưới đây cho thấy cách sử dụng `tcpdump` để giám sát lưu lượng mạng giữa một client (chạy trên host pukaki) và một server (chạy trên tekapo). Trong phiên shell này, chúng ta sử dụng hai tùy chọn của `tcpdump` để làm cho phần đầu ra bớt chi tiết hơn. Tùy chọn `-t` ẩn việc hiển thị thông tin dấu thời gian (timestamp). Tùy chọn `-N` làm cho tên host (hostname) được hiển thị mà không có tên miền đủ điều kiện (qualifying domain name). Hơn nữa, để ngắn gọn và vì chúng ta không mô tả chi tiết về các tùy chọn TCP, chúng ta đã xóa các trường options khỏi các dòng đầu ra của `tcpdump`.

Server hoạt động trên cổng 55555, vì vậy lệnh `tcpdump` của chúng ta chọn lưu lượng cho cổng đó. Đầu ra hiển thị ba phân đoạn được trao đổi trong quá trình thiết lập kết nối (connection establishment):

```
$ tcpdump -t -N 'port 55555'
IP pukaki.60391 > tekapo.55555: S 3412991013:3412991013(0) win 5840
IP tekapo.55555 > pukaki.60391: S 1149562427:1149562427(0) ack 3412991014 win 5792
IP pukaki.60391 > tekapo.55555: . ack 1 win 5840
```

Ba phân đoạn này là các phân đoạn SYN, SYN/ACK và ACK được trao đổi trong quá trình bắt tay ba bước (three-way handshake) (xem [Hình 61-5](#page-123-0)).

Trong phần đầu ra tiếp theo, client gửi cho server hai thông điệp, lần lượt chứa 16 và 32 byte, và server phản hồi trong mỗi trường hợp bằng một thông điệp 4 byte:

```
IP pukaki.60391 > tekapo.55555: P 1:17(16) ack 1 win 5840
IP tekapo.55555 > pukaki.60391: . ack 17 win 1448
IP tekapo.55555 > pukaki.60391: P 1:5(4) ack 17 win 1448
IP pukaki.60391 > tekapo.55555: . ack 5 win 5840
IP pukaki.60391 > tekapo.55555: P 17:49(32) ack 5 win 5840
IP tekapo.55555 > pukaki.60391: . ack 49 win 1448
IP tekapo.55555 > pukaki.60391: P 5:9(4) ack 49 win 1448
IP pukaki.60391 > tekapo.55555: . ack 9 win 5840
```

Đối với mỗi phân đoạn dữ liệu, chúng ta thấy một ACK được gửi theo hướng ngược lại.

Cuối cùng, chúng ta hiển thị các phân đoạn được trao đổi trong quá trình chấm dứt kết nối (connection termination) (đầu tiên, client đóng đầu kết nối của chính nó, và sau đó server đóng đầu còn lại):

```
IP pukaki.60391 > tekapo.55555: F 49:49(0) ack 9 win 5840
IP tekapo.55555 > pukaki.60391: . ack 50 win 1448
IP tekapo.55555 > pukaki.60391: F 9:9(0) ack 50 win 1448
IP pukaki.60391 > tekapo.55555: . ack 10 win 5840
```

Phần đầu ra ở trên hiển thị bốn phân đoạn được trao đổi trong quá trình chấm dứt kết nối (xem [Hình 61-6](#page-124-1)).

## 61.9 Tùy chọn Socket (Socket Options)

Các tùy chọn socket (Socket options) ảnh hưởng đến các tính năng khác nhau trong hoạt động của một socket. Trong cuốn sách này, chúng tôi chỉ mô tả một vài trong số rất nhiều tùy chọn socket khả dụng. Một cuộc thảo luận rộng rãi bao gồm hầu hết các tùy chọn socket chuẩn được cung cấp trong [Stevens et al., 2004]. Hãy xem các trang hướng dẫn (manual pages) `tcp(7)`, `udp(7)`, `ip(7)`, `socket(7)` và `unix(7)` để biết thêm các chi tiết cụ thể về Linux.

Các system call `setsockopt()` và `getsockopt()` thiết lập và truy xuất các tùy chọn socket.

## include <sys/socket.h>

int getsockopt(int sockfd, int level, int optname, void *optval,
socklen_t *optlen);
int setsockopt(int sockfd, int level, int optname, const void *optval,
socklen_t optlen);
Cả hai đều trả về 0 khi thành công, hoặc –1 khi lỗi

```

Đối với cả `setsockopt()` và `getsockopt()`, `sockfd` là một file descriptor (mô tả tệp) tham chiếu đến một socket.

Đối số `level` chỉ định giao thức (protocol) mà tùy chọn socket áp dụng — ví dụ: `IP` hoặc `TCP`. Đối với hầu hết các tùy chọn socket mà chúng tôi mô tả trong cuốn sách này, `level` được đặt thành `SOL_SOCKET`, cho biết một tùy chọn áp dụng ở cấp độ API socket (sockets API level).

Đối số `optname` xác định tùy chọn mà giá trị của nó chúng ta muốn thiết lập hoặc truy xuất. Đối số `optval` là một con trỏ đến bộ đệm (buffer) được sử dụng để chỉ định hoặc trả về giá trị tùy chọn; đối số này là một con trỏ đến một số nguyên (integer) hoặc một cấu trúc (structure), tùy thuộc vào tùy chọn đó.

Đối số `optlen` chỉ định kích thước (tính bằng byte) của bộ đệm được trỏ bởi `optval`. Đối với `setsockopt()`, đối số này được truyền theo giá trị (passed by value). Đối với `getsockopt()`, `optlen` là một đối số kiểu giá trị-kết quả (value-result argument). Trước khi gọi, chúng ta khởi tạo nó thành kích thước của bộ đệm được trỏ bởi `optval`; khi trả về, nó được đặt thành số byte thực sự được ghi vào bộ đệm đó.

Như được trình bày chi tiết trong Mục [61.11](#page-132-0), file descriptor của socket được trả về bởi một lời gọi `accept()` sẽ kế thừa các giá trị của các tùy chọn socket có thể thiết lập từ socket lắng nghe (listening socket).

Các tùy chọn socket được liên kết với một mô tả tệp mở (open file description) (tham khảo Hình 5-2, ở trang 95). Điều này có nghĩa là các file descriptor được nhân bản do hậu quả của `dup()` (hoặc tương tự) hoặc `fork()` sẽ chia sẻ cùng một tập hợp các tùy chọn socket.

Một ví dụ đơn giản về tùy chọn socket là `SO_TYPE`, có thể được sử dụng để tìm loại của một socket, như sau:

```c

int optval;
socklen_t optlen;
optlen = sizeof(optval);
if (getsockopt(sfd, SOL_SOCKET, SO_TYPE, &optval, &optlen) == -1)
errExit("getsockopt");

```

Sau lời gọi này, `optval` chứa kiểu socket (socket type)—ví dụ, `SOCK_STREAM` hoặc `SOCK_DGRAM`. Việc sử dụng lời gọi này có thể hữu ích trong một chương trình kế thừa một File Descriptor của socket thông qua hàm `exec()`—ví dụ, một chương trình được thực thi (execed) bởi `inetd`—vì chương trình đó có thể không biết nó đã kế thừa loại socket nào.

`SO_TYPE` là một ví dụ về tùy chọn socket chỉ đọc (read-only socket option). Không thể sử dụng `setsockopt()` để thay đổi kiểu của một socket.

## 61.10 Tùy chọn Socket SO_REUSEADDR

Tùy chọn socket `SO_REUSEADDR` phục vụ nhiều mục đích (xem Chương 7 của [Stevens et al., 2004] để biết thêm chi tiết). Chúng ta sẽ chỉ quan tâm đến một mục đích phổ biến: tránh lỗi `EADDRINUSE` ("Address already in use" - Địa chỉ đã được sử dụng) khi một TCP server được khởi động lại và cố gắng bind một socket vào một cổng (port) hiện đang có một kết nối TCP liên kết. Có hai kịch bản mà hiện tượng này thường xảy ra:

- Một lần thực thi trước đó của server đã kết nối với một client đã thực hiện đóng chủ động (active close), bằng cách gọi hàm `close()`, hoặc bằng cách bị crash (ví dụ: bị chấm dứt bởi một tín hiệu - signal). Điều này để lại một điểm đầu cuối (endpoint) TCP vẫn ở trạng thái `TIME_WAIT` cho đến khi thời gian chờ (timeout) `2MSL` hết hạn.
- Một lần thực thi trước đó của server đã tạo ra một tiến trình con (child process) để xử lý kết nối với một client. Sau đó, server kết thúc, trong khi tiến trình con vẫn tiếp tục phục vụ client, và do đó duy trì một TCP endpoint sử dụng cổng nổi tiếng (well-known port) của server.

Trong cả hai kịch bản này, TCP endpoint đang tồn tại không thể chấp nhận các kết nối mới. Mặc dù vậy, trong cả hai trường hợp, theo mặc định, hầu hết các cài đặt TCP đều ngăn chặn việc một socket lắng nghe (listening socket) mới được bind vào well-known port của server.

> Lỗi `EADDRINUSE` thường không xảy ra với các client, vì chúng thường sử dụng một cổng tạm thời (ephemeral port) không nằm trong số các cổng hiện đang ở trạng thái `TIME_WAIT`. Tuy nhiên, nếu một client bind vào một số hiệu cổng cụ thể, thì nó cũng có thể gặp phải lỗi này.

Để hiểu hoạt động của tùy chọn socket `SO_REUSEADDR`, sẽ hữu ích nếu ta quay lại phép ẩn dụ về điện thoại trước đó đối với các stream socket (Mục [56.5\)](#page-6-0). Giống như một cuộc gọi điện thoại (chúng ta bỏ qua khái niệm cuộc gọi hội nghị), một kết nối socket TCP có thể được nhận dạng bằng sự kết hợp của một cặp điểm đầu cuối được kết nối. Hoạt động của `accept()` tương tự như tác vụ được thực hiện bởi tổng đài viên trên một bảng chuyển mạch nội bộ của công ty ("một server"). Khi một cuộc gọi điện thoại bên ngoài đến, tổng đài viên chuyển tiếp cuộc gọi đó đến một điện thoại nội bộ nào đó ("một socket mới") trong tổ chức. Từ góc nhìn bên ngoài, không có cách nào để nhận dạng chiếc điện thoại nội bộ đó. Khi có nhiều cuộc gọi bên ngoài đang được xử lý bởi bảng chuyển mạch, cách duy nhất để phân biệt chúng là thông qua sự kết hợp giữa số điện thoại của người gọi bên ngoài và số của bảng chuyển mạch. (Số sau là cần thiết khi chúng ta xem xét rằng sẽ có nhiều bảng chuyển mạch của công ty trong toàn bộ mạng lưới điện thoại). Tương tự như vậy, mỗi khi chúng ta chấp nhận một kết nối socket trên một listening socket, một socket mới được tạo ra. Tất cả các socket này đều được liên kết với cùng một địa chỉ cục bộ (local address) giống như listening socket. Cách duy nhất để phân biệt chúng là thông qua các kết nối của chúng tới các peer socket khác nhau.

Nói cách khác, một kết nối TCP socket được nhận dạng bằng một bộ 4 phần tử (4-tuple) (tức là sự kết hợp của bốn giá trị) có dạng sau:

```

{ local-IP-address, local-port, foreign-IP-address, foreign-port }

```

Đặc tả TCP yêu cầu mỗi bộ 4 phần tử như vậy phải là duy nhất; nghĩa là, chỉ có thể tồn tại một hiện thân kết nối tương ứng ("cuộc gọi điện thoại"). Vấn đề là hầu hết các cài đặt (bao gồm cả Linux) thực thi một ràng buộc nghiêm ngặt hơn: một cổng cục bộ không thể được tái sử dụng (tức là được chỉ định trong lời gọi hàm `bind()`) nếu bất kỳ hiện thân kết nối TCP nào có cổng cục bộ khớp tồn tại trên host. Quy tắc này được thực thi ngay cả khi TCP không thể chấp nhận các kết nối mới, giống như trong các kịch bản được mô tả ở đầu mục này.

Việc bật tùy chọn socket `SO_REUSEADDR` sẽ nới lỏng ràng buộc này, đưa nó đến gần hơn với yêu cầu của TCP. Theo mặc định, tùy chọn này có giá trị 0, nghĩa là nó bị vô hiệu hóa. Chúng ta bật tùy chọn này bằng cách gán cho nó một giá trị khác 0 trước khi bind một socket, như được hiển thị trong [Liệt kê 61-4.](#page-132-1)

Việc thiết lập tùy chọn `SO_REUSEADDR` có nghĩa là chúng ta có thể bind một socket vào một cổng cục bộ ngay cả khi một TCP khác đang được bind vào cùng một cổng trong bất kỳ kịch bản nào được mô tả ở đầu mục này. Hầu hết các TCP server nên bật tùy chọn này. Chúng ta đã thấy một số ví dụ về việc sử dụng tùy chọn này trong [Liệt kê 59-6](#page-72-1) (trang [1221](#page-72-1)) và [Liệt kê 59-9](#page-79-1) (trang [1228](#page-79-1)).

```

int sockfd, optval;
sockfd = socket(AF_INET, SOCK_STREAM, 0);
if (sockfd == -1)
errExit("socket");
optval = 1;
if (setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &optval,
sizeof(optval)) == -1)
errExit("socket");
if (bind(sockfd, &addr, addrlen) == -1)
errExit("bind");
if (listen(sockfd, backlog) == -1)
errExit("listen");

```

## 61.11 Sự kế thừa cờ và tùy chọn qua hàm accept()

Nhiều cờ (flags) và thiết lập khác nhau có thể được liên kết với mô tả tệp mở (open file description) và bộ mô tả tệp (file descriptor) (Mục 5.4). Hơn nữa, như đã mô tả ở Mục [61.9,](#page-129-1) các tùy chọn khác nhau có thể được thiết lập cho một socket. Nếu các cờ và tùy chọn này được thiết lập trên một socket lắng nghe (listening socket), thì chúng có được kế thừa bởi socket mới do hàm accept() trả về hay không? Chúng ta sẽ thảo luận chi tiết vấn đề này tại đây.

Trên Linux, các thuộc tính sau không được kế thừa bởi bộ mô tả tệp mới do accept() trả về:

- Các cờ trạng thái (status flags) được liên kết với mô tả tệp mở — các cờ có thể thay đổi bằng cách sử dụng thao tác fcntl() F\_SETFL (Mục 5.3). Các cờ này bao gồm O\_NONBLOCK và O\_ASYNC.
- Các cờ bộ mô tả tệp (file descriptor flags) — các cờ có thể thay đổi bằng cách sử dụng thao tác fcntl() F\_SETFD. Cờ duy nhất loại này là cờ đóng khi thực thi (close-on-exec flag) (FD\_CLOEXEC, được mô tả ở Mục 27.4).
- Các thuộc tính bộ mô tả tệp fcntl() F\_SETOWN (ID tiến trình sở hữu - owner process ID) và F\_SETSIG (tín hiệu được tạo ra - generated signal) liên kết với I/O điều khiển bằng tín hiệu (signal-driven I/O) (Mục 63.3).

Mặt khác, bộ mô tả mới do accept() trả về sẽ kế thừa một bản sao của hầu hết các tùy chọn socket có thể được thiết lập bằng setsockopt() (Mục [61.9](#page-129-1)).

Tài liệu SUSv3 không đề cập chi tiết đến các vấn đề được mô tả ở đây, và các quy tắc kế thừa cho socket đã kết nối mới do accept() trả về sẽ khác nhau giữa các bản cài đặt UNIX. Đáng chú ý nhất, trên một số hệ thống UNIX, nếu các cờ trạng thái tệp mở như O\_NONBLOCK và O\_ASYNC được thiết lập trên socket lắng nghe, thì chúng sẽ được kế thừa bởi socket mới do accept() trả về. Để đảm bảo khả năng tương thích ngược và di động (portability), có thể cần phải chủ động thiết lập lại các thuộc tính này một cách tường minh trên socket do accept() trả về.

## 61.12 So sánh TCP và UDP

Vì TCP cung cấp cơ chế truyền dữ liệu đáng tin cậy (reliable delivery), trong khi UDP thì không, một câu hỏi hiển nhiên được đặt ra là: "Tại sao lại phải sử dụng UDP?". Câu trả lời cho câu hỏi này đã được trình bày khá chi tiết trong Chương 22 của [Stevens et al., 2004]. Tại đây, chúng ta tóm tắt một số điểm có thể khiến chúng ta lựa chọn UDP thay vì TCP:

- Một UDP server có thể nhận (và trả lời) các datagram từ nhiều client khác nhau mà không cần phải tạo và chấm dứt kết việc nối cho từng client (tức là việc truyền các thông điệp đơn lẻ bằng UDP có chi phí hệ thống - overhead thấp hơn so với khi sử dụng TCP).
- Đối với các giao tiếp yêu cầu-phản hồi (request-response) đơn giản, UDP có thể nhanh hơn TCP vì nó không đòi hỏi quá trình thiết lập và kết thúc kết nối. Phụ lục A của [Stevens, 1996] lưu ý rằng trong trường hợp tối ưu nhất, thời gian sử dụng TCP là

```

2 * RTT + SPT

```

Trong công thức này, RTT là thời gian khứ hồi (round-trip time - thời gian cần thiết để gửi một yêu cầu và nhận về phản hồi), và SPT là thời gian server xử lý yêu cầu. (Trên mạng diện rộng - WAN, giá trị SPT có thể rất nhỏ so với RTT). Đối với UDP, trường hợp tối ưu nhất cho một giao tiếp yêu cầu-phản hồi đơn lẻ là

```

RTT + SPT

```

Thời gian này ít hơn TCP đúng một khoảng RTT. Vì RTT giữa các máy chủ cách nhau những khoảng cách lớn (ví dụ: xuyên lục địa) hoặc qua nhiều bộ định tuyến (router) trung gian thường kéo dài vài phần mười giây, sự khác biệt này làm cho UDP trở nên hấp dẫn đối với một số loại giao tiếp yêu cầu-phản hồi. DNS là một ví dụ điển hình về ứng dụng sử dụng UDP vì lý do này — việc sử dụng UDP cho phép thực hiện tra cứu tên miền (name lookup) bằng cách truyền một gói tin duy nhất theo mỗi hướng giữa các server.

- Các socket UDP cho phép phát quảng bá (broadcasting) và phát đa hướng (multicasting). Broadcasting cho phép một bên gửi truyền một datagram đến cùng một cổng đích trên tất cả các máy chủ kết nối với mạng. Multicasting cũng tương tự, nhưng cho phép gửi datagram đến một tập hợp các máy chủ được chỉ định cụ thể. Để biết thêm chi tiết, hãy xem Chương 21 và 22 của [Stevens et al., 2004].
- Một số loại ứng dụng nhất định (ví dụ: truyền phát video và âm thanh - streaming media) có thể hoạt động chấp nhận được mà không cần tính năng đảm bảo độ tin cậy do TCP cung cấp. Ngược lại, độ trễ có thể phát sinh sau khi TCP cố gắng khôi phục một phân đoạn (segment) bị mất có thể dẫn đến độ trễ truyền dẫn dài không thể chấp nhận được. (Độ trễ trong việc truyền phát phương tiện truyền thông có thể tồi tệ hơn việc mất ngắn hạn dòng truyền dẫn). Do đó, các ứng dụng này có thể ưu tiên UDP hơn, và áp dụng các chiến lược khôi phục dành riêng cho ứng dụng (application-specific recovery strategies) để xử lý tình trạng mất gói tin thỉnh thoảng xảy ra.

Một ứng dụng sử dụng UDP nhưng vẫn yêu cầu độ tin cậy thì phải tự triển khai các tính năng đảm bảo độ tin cậy đó. Thông thường, điều này đòi hỏi tối thiểu các yếu tố như số thứ tự (sequence numbers), xác nhận (acknowledgements), truyền lại các gói tin bị mất, và phát hiện gói tin trùng lặp (duplicate detection). Một ví dụ về cách thực hiện việc này được minh họa trong [Stevens et al., 2004]. Tuy nhiên, nếu các tính năng nâng cao hơn như điều khiển luồng (flow control) và điều khiển tắc nghẽn (congestion control) cũng được yêu cầu, thì tốt nhất là nên sử dụng TCP thay thế. Việc cố gắng triển khai tất cả các tính năng này dựa trên nền tảng UDP là rất phức tạp, và ngay cả khi được triển khai tốt, kết quả thu được cũng khó có thể hoạt động tốt hơn TCP.

## 61.13 Các tính năng nâng cao

UNIX và Internet domain socket có nhiều tính năng khác mà chúng ta chưa trình bày chi tiết trong cuốn sách này. Chúng tôi tóm tắt một số tính năng này trong phần này. Để biết thêm chi tiết đầy đủ, hãy xem [Stevens et al., 2004].

### 61.13.1 Dữ liệu ngoài băng tần (Out-of-Band Data)

Dữ liệu ngoài băng tần (Out-of-Band Data) là một tính năng của stream socket cho phép bên gửi đánh dấu dữ liệu được truyền đi là có độ ưu tiên cao; nghĩa là bên nhận có thể nhận được thông báo về sự sẵn có của dữ liệu ngoài băng tần mà không cần phải đọc tất cả dữ liệu nằm giữa trong dòng dữ liệu (stream). Tính năng này được sử dụng trong các chương trình như `telnet`, `rlogin` và `ftp` để có thể hủy bỏ các lệnh đã được truyền trước đó. Dữ liệu ngoài băng tần được gửi và nhận bằng cách sử dụng cờ `MSG_OOB` trong các lời gọi hàm `send()` và `recv()`. Khi một socket nhận được thông báo về sự sẵn có của dữ liệu ngoài băng tần, kernel sẽ tạo ra tín hiệu `SIGURG` cho chủ sở hữu socket (thông thường là tiến trình - process đang sử dụng socket đó), được thiết lập bởi thao tác `fcntl()` `F_SETOWN`.

Khi được sử dụng với TCP socket, tối đa 1 byte dữ liệu có thể được đánh dấu là ngoài băng tần tại bất kỳ thời điểm nào. Nếu bên gửi truyền thêm một byte dữ liệu ngoài băng tần trước khi bên nhận xử lý byte trước đó, thì chỉ báo cho byte ngoài băng tần trước đó sẽ bị mất.

> Giới hạn của TCP đối với dữ liệu ngoài băng tần ở mức một byte duy nhất là hệ quả của sự không tương thích giữa mô hình ngoài băng tần tổng quát của sockets API và việc triển khai cụ thể của nó sử dụng chế độ khẩn cấp (urgent mode) của TCP. Chúng ta đã đề cập đến chế độ khẩn cấp của TCP khi xem xét định dạng của các TCP segment trong Mục [61.6.1.](#page-117-1) TCP chỉ ra sự hiện diện của dữ liệu khẩn cấp (ngoài băng tần) bằng cách thiết lập bit `URG` trong tiêu đề (header) TCP và thiết lập trường con trỏ khẩn cấp (urgent pointer) trỏ đến dữ liệu khẩn cấp. Tuy nhiên, TCP không có cách nào để chỉ ra độ dài của một chuỗi dữ liệu khẩn cấp, do đó dữ liệu khẩn cấp được coi là chỉ bao gồm một byte duy nhất.

Thông tin thêm về dữ liệu khẩn cấp của TCP có thể được tìm thấy trong RFC 793.

Dưới một số bản cài đặt UNIX, dữ liệu ngoài băng tần được hỗ trợ cho UNIX domain stream socket. Linux không hỗ trợ tính năng này.

Việc sử dụng dữ liệu ngoài băng tần ngày nay không được khuyến khích và nó có thể không đáng tin cậy trong một số hoàn cảnh (xem [Gont & Yourtchenko, 2009]). Một giải pháp thay thế là duy trì một cặp stream socket để giao tiếp. Một trong số đó được sử dụng cho giao tiếp thông thường, trong khi socket còn lại được sử dụng cho giao tiếp có độ ưu tiên cao. Một ứng dụng có thể giám sát cả hai kênh bằng cách sử dụng một trong các kỹ thuật được mô tả trong Chương 63. Phương pháp này cho phép truyền nhiều byte dữ liệu ưu tiên. Hơn nữa, nó có thể được áp dụng với stream socket trong bất kỳ miền giao tiếp nào (ví dụ: UNIX domain socket).

### 61.13.2 Các System Call sendmsg() và recvmsg()

Các system call `sendmsg()` và `recvmsg()` là các system call I/O socket có tính tổng quát cao nhất. System call `sendmsg()` có thể thực hiện mọi tác vụ được thực hiện bởi `write()`, `send()`, và `sendto()`; system call `recvmsg()` có thể thực hiện mọi tác vụ được thực hiện bởi `read()`, `recv()`, và `recvfrom()`. Thêm vào đó, các lời gọi này cho phép các tính năng sau:

- Chúng ta có thể thực hiện I/O dạng phân tán-tập trung (scatter-gather I/O), tương tự như `readv()` và `writev()` (Mục 5.7). Khi chúng ta sử dụng `sendmsg()` để thực hiện xuất tập trung (gather output) trên một socket datagram (hoặc `writev()` trên một socket datagram đã kết nối), một datagram duy nhất sẽ được tạo ra. Ngược lại, `recvmsg()` (và `readv()`) có thể được sử dụng để thực hiện nhập phân tán (scatter input) trên một socket datagram, phân tán các byte của một datagram duy nhất vào nhiều bộ đệm vùng nhớ người dùng (`user-space buffers`).
- Chúng ta có thể truyền các thông điệp chứa dữ liệu phụ trợ đặc trưng theo miền (domain-specific ancillary data, còn được gọi là thông tin điều khiển - control information). Dữ liệu phụ trợ có thể được truyền qua cả socket dạng luồng (`stream sockets`) và socket dạng datagram (`datagram sockets`). Chúng ta sẽ mô tả một số ví dụ về dữ liệu phụ trợ dưới đây.

Linux 2.6.33 bổ sung một system call mới là `recvmmsg()`. System call này tương tự như `recvmsg()`, nhưng cho phép nhận nhiều datagram trong một system call duy nhất. Điều này làm giảm chi phí chung của system call (`system-call overhead`) trong các ứng dụng xử lý lưu lượng mạng ở mức độ cao. Một system call tương tự là `sendmmsg()` có khả năng sẽ được bổ sung trong một phiên bản kernel trong tương lai.

### 61.13.3 Truyền File Descriptor (Bộ mô tả tệp)

Sử dụng `sendmsg()` và `recvmsg()`, chúng ta có thể truyền dữ liệu phụ trợ chứa một file descriptor từ tiến trình này sang tiến trình khác trên cùng một host thông qua một UNIX domain socket. Bất kỳ loại file descriptor nào cũng có thể được truyền theo cách này — ví dụ, một descriptor nhận được từ một lời gọi `open()` hoặc `pipe()`. Một ví dụ có liên quan thực tế hơn đến socket là một máy chủ chính (`master server`) có thể chấp nhận kết nối từ client trên một TCP listening socket và truyền descriptor đó cho một trong các tiến trình con trong bể tiến trình máy chủ (`server child processes`) (Mục [60.4](#page-96-0)), sau đó tiến trình con này sẽ xử lý phản hồi yêu cầu của client.

Mặc dù kỹ thuật này thường được gọi là truyền một file descriptor, nhưng thứ thực sự được truyền giữa hai tiến trình là một tham chiếu đến cùng một mô tả tệp đang mở (`open file description`) (Hình 5-2, trang 95). Số hiệu file descriptor được sử dụng ở tiến trình nhận thường sẽ khác với số hiệu được sử dụng ở tiến trình gửi.

> Một ví dụ về việc truyền file descriptor được cung cấp trong các tệp `scm_rights_send.c` và `scm_rights_recv.c` nằm trong thư mục con `sockets` trong mã nguồn phân phối của cuốn sách này.

### 61.13.4 Nhận Thông Tin Xác Thực Của Người Gửi (Sender Credentials)

Một ví dụ khác về việc sử dụng dữ liệu phụ trợ là để nhận thông tin xác thực của người gửi thông qua một UNIX domain socket. Các thông tin xác thực này bao gồm ID người dùng (`user ID`), ID nhóm (`group ID`), và ID tiến trình (`process ID`) của tiến trình gửi. Bên gửi có thể chỉ định ID người dùng và ID nhóm của nó dưới dạng các ID tập hợp tương ứng: thực (`real`), hiệu dụng (`effective`), hoặc đã lưu (`saved set IDs`). Điều này cho phép tiến trình nhận xác thực người gửi trên cùng một host. Để biết thêm chi tiết, hãy xem các trang tài liệu hướng dẫn (manual pages) `socket(7)` và `unix(7)`.

Không giống như việc truyền thông tin xác thực của tệp, việc truyền thông tin xác thực của người gửi không được quy định trong tiêu chuẩn SUSv3. Ngoại trừ Linux, tính năng này được triển khai trên một số hệ thống BSD hiện đại (nơi cấu trúc thông tin xác thực chứa nhiều thông tin hơn một chút so với trên Linux), nhưng lại có sẵn trên rất ít các bản cài đặt UNIX khác. Chi tiết về việc truyền thông tin xác thực trên FreeBSD được mô tả trong [Stevens et al., 2004].

Trên Linux, một tiến trình có đặc quyền (`privileged process`) có thể giả mạo ID người dùng, ID nhóm và ID tiến trình được truyền dưới dạng thông tin xác thực nếu nó lần lượt sở hữu các capability `CAP_SETUID`, `CAP_SETGID`, và `CAP_SYS_ADMIN`.

> Một ví dụ về việc truyền thông tin xác thực được cung cấp trong các tệp `scm_cred_send.c` và `scm_cred_recv.c` nằm trong thư mục con `sockets` trong mã nguồn phân phối của cuốn sách này.

### 61.13.5 Sequenced-Packet Sockets (Socket gói có thứ tự)

Sequenced-packet sockets (Socket gói có thứ tự) kết hợp các đặc điểm của cả stream sockets (socket luồng) và datagram sockets (socket datagram):

- Giống như stream sockets, sequenced-packet sockets có tính hướng kết nối (connection-oriented). Các kết nối được thiết lập theo cách tương tự như stream sockets, sử dụng các hàm `bind()`, `listen()`, `accept()`, và `connect()`.
- Giống như datagram sockets, các ranh giới thông điệp (message boundaries) được bảo toàn. Một lệnh `read()` từ một sequenced-packet socket sẽ trả về chính xác một thông điệp (được ghi bởi phía đối tác - peer). Nếu thông điệp dài hơn bộ đệm do bên gọi cung cấp, các byte vượt quá sẽ bị loại bỏ.
- Giống như stream sockets, và khác với datagram sockets, giao tiếp thông qua sequenced-packet sockets có độ tin cậy cao (reliable). Các thông điệp được gửi đến ứng dụng đối tác mà không có lỗi, đúng thứ tự, không bị trùng lặp và được đảm bảo sẽ đến nơi (giả định rằng không có sự cố sập hệ thống hoặc ứng dụng, hoặc mất kết nối mạng).

Một sequenced-packet socket được tạo bằng cách gọi hàm `socket()` với đối số `type` được chỉ định là `SOCK_SEQPACKET`.

Về mặt lịch sử, Linux, giống như hầu hết các bản cài đặt UNIX, không hỗ trợ sequenced-packet sockets trong cả miền UNIX (UNIX domain) hoặc miền Internet (Internet domain). Tuy nhiên, bắt đầu từ kernel 2.6.4, Linux đã hỗ trợ `SOCK_SEQPACKET` cho các UNIX domain sockets.

Trong miền Internet, các giao thức UDP và TCP không hỗ trợ `SOCK_SEQPACKET`, nhưng giao thức SCTP (được mô tả trong phần tiếp theo) thì có hỗ trợ.

Chúng ta không trình bày ví dụ về việc sử dụng sequenced-packet sockets trong cuốn sách này, nhưng ngoại trừ việc bảo toàn ranh giới thông điệp, cách sử dụng của chúng rất giống với stream sockets.

### 61.13.6 Các giao thức tầng giao vận SCTP và DCCP

SCTP và DCCP là hai giao thức tầng giao vận (transport-layer protocols) mới hơn, có khả năng sẽ ngày càng trở nên phổ biến trong tương lai.

Stream Control Transmission Protocol (SCTP, http://www.sctp.org/) được thiết kế đặc biệt để hỗ trợ báo hiệu viễn thông (telephony signaling), nhưng cũng mang tính đa ưng dụng (general purpose). Giống như TCP, SCTP cung cấp giao vận hướng kết nối, hai chiều, có độ tin cậy cao. Khác với TCP, SCTP bảo toàn các ranh giới thông điệp. Một trong những tính năng nổi bật của SCTP là hỗ trợ đa luồng (multistream support), cho phép sử dụng nhiều luồng dữ liệu logic trên một kết nối duy nhất.

SCTP được mô tả trong [Stewart & Xie, 2001], [Stevens et al., 2004], và trong các tài liệu RFC 4960, 3257, và 3286.

SCTP có sẵn trên Linux kể từ kernel 2.6. Thêm thông tin về việc cài đặt này có thể được tìm thấy tại http://lksctp.sourceforge.net/.

Trong suốt các chương trước mô tả về API socket, chúng ta đã đồng nhất Internet domain stream sockets với TCP. Tuy nhiên, SCTP cung cấp một giao thức thay thế để triển khai stream sockets, được tạo bằng cách sử dụng lời gọi sau:

```c

socket(AF_INET, SOCK_STREAM, IPPROTO_SCTP);

```

Bắt đầu từ kernel 2.6.14, Linux hỗ trợ một giao thức datagram mới, Datagram Congestion Control Protocol (DCCP). Giống như TCP, DCCP cung cấp cơ chế kiểm soát tắc nghẽn (congestion control) — loại bỏ sự cần thiết phải triển khai kiểm soát tắc nghẽn ở cấp độ ứng dụng — nhằm ngăn chặn một bên truyền quá nhanh làm quá tải mạng. (Chúng ta đã giải thích về kiểm soát tắc nghẽn khi mô tả TCP tại Mục [58.6.3](#page-41-1).) Tuy nhiên, khác với TCP (nhưng giống như UDP), DCCP không cung cấp sự đảm bảo về việc phân phối đáng tin cậy hoặc đúng thứ tự, và do đó cho phép các ứng dụng không cần các tính năng này tránh được độ trễ mà chúng có thể gây ra. Thông tin về DCCP có thể được tìm thấy tại http://www.read.cs.ucla.edu/dccp/ và các RFC 4336 và 4340.

## 61.14 Tóm tắt

Trong nhiều trường hợp khác nhau, các thao tác đọc và ghi một phần (partial reads and writes) có thể xảy ra khi thực hiện I/O trên stream sockets. Chúng ta đã trình bày việc triển khai hai hàm, `readn()` và `writen()`, có thể được sử dụng để đảm bảo toàn bộ bộ đệm dữ liệu được đọc hoặc ghi.

System Call `shutdown()` cung cấp khả năng kiểm soát chính xác hơn đối với việc chấm dứt kết nối. Sử dụng `shutdown()`, chúng ta có thể buộc đóng một hoặc cả hai nửa của một luồng giao tiếp hai chiều, bất kể có hay không các File Descriptor (mô tả tệp) mở khác đang trỏ tới socket đó.

Giống như `read()` và `write()`, `recv()` và `send()` có thể được sử dụng để thực hiện I/O trên một socket, nhưng các System Call này cung cấp thêm một đối số bổ sung là `flags`, dùng để điều khiển tính năng I/O đặc thù của socket.

System Call `sendfile()` cho phép chúng ta sao chép hiệu quả nội dung của một tệp vào một socket. Hiệu quả này đạt được là do chúng ta không cần phải sao chép dữ liệu tệp đến và đi từ User Space (bộ nhớ người dùng), điều mà sẽ bắt buộc phải làm khi gọi `read()` và `write()`.

Các System Call `getsockname()` và `getpeername()` lần lượt truy xuất địa chỉ cục bộ (local address) mà một socket được gắn kết (bound) và địa chỉ của đối tác (peer) mà socket đó được kết nối tới.

Chúng ta đã xem xét một số chi tiết về hoạt động của TCP, bao gồm các trạng thái TCP (TCP states) và biểu đồ chuyển đổi trạng thái TCP (TCP state transition diagram), cũng như việc thiết lập và chấm dứt kết nối TCP. Là một phần của cuộc thảo luận này, chúng ta đã thấy lý do tại sao trạng thái `TIME_WAIT` là một phần quan trọng trong đảm bảo độ tin cậy của TCP. Mặc dù trạng thái này có thể dẫn đến lỗi "Address already in use" (Địa chỉ đã được sử dụng) khi khởi động lại máy chủ, nhưng sau đó chúng ta đã thấy rằng tùy chọn socket `SO_REUSEADDR` có thể được sử dụng để tránh lỗi này, đồng thời vẫn cho phép trạng thái `TIME_WAIT` thực hiện đúng mục đích dự kiến của nó.

Các lệnh `netstat` và `tcpdump` là những công cụ hữu ích để giám sát và gỡ lỗi (debug) các ứng dụng sử dụng socket.

Các system call (lời gọi hệ thống) `getsockopt()` và `setsockopt()` thực hiện việc lấy (retrieve) và sửa đổi các tùy chọn ảnh hưởng đến hoạt động của một socket.

Trên Linux, khi một socket mới được tạo bởi `accept()`, nó không kế thừa các cờ trạng thái tệp mở (open file status flags) của socket lắng nghe (listening socket), các cờ file descriptor (file descriptor flags), hay các thuộc tính file descriptor liên quan đến I/O điều khiển bằng tín hiệu (signal-driven I/O). Tuy nhiên, nó lại kế thừa các thiết lập của tùy chọn socket (socket options). Chúng ta đã lưu ý rằng tiêu chuẩn SUSv3 không đề cập đến các chi tiết này, vốn có sự khác nhau giữa các bản cài đặt (implementations).

Mặc dù UDP không cung cấp các đảm bảo về độ tin cậy giống như TCP, chúng ta thấy rằng vẫn có những lý do khiến UDP trở nên ưu việt hơn đối với một số ứng dụng.

Cuối cùng, chúng ta đã phác thảo một vài tính năng nâng cao của lập trình socket mà chúng ta không mô tả chi tiết trong cuốn sách này.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê tại Mục [59.15.](#page-86-0)

## 61.15 Bài tập

- **61-1.** Giả sử chương trình trong [Đoạn mã 61-2](#page-109-0) (`is_echo_cl.c`) được chỉnh sửa sao cho thay vì sử dụng `fork()` để tạo ra hai tiến trình hoạt động đồng thời (concurrently), nó lại chỉ sử dụng một tiến trình duy nhất thực hiện việc sao chép đầu vào chuẩn (standard input) của chính nó vào socket trước, sau đó mới đọc phản hồi của server. Vấn đề gì có thể xảy ra khi chạy client này? (Xem [Hình 58-8](#page-41-2), ở trang [1190](#page-41-2)).
- **61-2.** Triển khai `pipe()` dựa trên `socketpair()`. Sử dụng `shutdown()` để đảm bảo rằng pipe tạo ra là một chiều (unidirectional).
- **61-3.** Triển khai một hàm thay thế cho `sendfile()` bằng cách sử dụng `read()`, `write()`, và `lseek()`.
- **61-4.** Viết một chương trình sử dụng `getsockname()` để cho thấy rằng, nếu chúng ta gọi `listen()` trên một TCP socket mà trước đó không gọi `bind()`, socket đó sẽ được gán một số cổng tạm thời (ephemeral port number).
- **61-5.** Viết một chương trình client và một chương trình server cho phép client thực thi các lệnh shell tùy ý trên máy chủ (host) server. (Nếu bạn không triển khai bất kỳ cơ chế bảo mật nào trong ứng dụng này, bạn nên đảm bảo rằng server đang hoạt động dưới một tài khoản người dùng mà tại đó nó không thể gây ra thiệt hại nếu bị gọi bởi những kẻ độc hại). Client nên được thực thi với hai tham số dòng lệnh (command-line arguments):

### \$ **./is\_shell\_cl** *server-host* **'***some-shell-command***'**

Sau khi kết nối đến server, client gửi lệnh đã cho đến server, sau đó đóng nửa ghi (writing half) của socket bằng cách sử dụng `shutdown()`, để server nhận diện được dấu hiệu kết thúc tệp (end-of-file). Server nên xử lý mỗi kết nối đến trong một tiến trình con riêng biệt (tức là thiết kế đồng thời - concurrent design). Đối với mỗi kết nối đến, server nên đọc lệnh từ socket (cho đến khi gặp end-of-file), và sau đó gọi `exec` một shell để thực hiện lệnh đó. Dưới đây là một vài gợi ý:

- Xem phần triển khai của `system()` tại Mục 27.7 để có ví dụ về cách thực thi một lệnh shell.
- Bằng cách sử dụng `dup2()` để nhân bản (duplicate) socket thành đầu ra chuẩn (standard output) và lỗi chuẩn (standard error), lệnh được `exec` sẽ tự động ghi dữ liệu ra socket.

- **61-6.** Mục [61.13.1](#page-134-0) đã lưu ý rằng một giải pháp thay thế cho dữ liệu băng tần ngoài (out-of-band data) là tạo ra hai kết nối socket giữa client và server: một cho dữ liệu thông thường và một cho dữ liệu ưu tiên. Hãy viết các chương trình client và server triển khai cấu trúc này. Dưới đây là một vài gợi ý:
  - Server cần một cách nào đó để biết được hai socket nào thuộc về cùng một client. Một cách để làm điều này là yêu cầu client trước tiên tạo một socket lắng nghe sử dụng một cổng tạm thời (tức là bind vào cổng 0). Sau khi lấy được số cổng tạm thời của socket lắng nghe đó (sử dụng `getsockname()`), client kết nối socket "thông thường" ("normal") của nó tới socket lắng nghe của server và gửi một thông điệp chứa số cổng của socket lắng nghe phía client. Sau đó, client chờ server sử dụng socket lắng nghe của client để thiết lập một kết nối theo chiều ngược lại cho socket "ưu tiên" ("priority"). (Server có thể lấy địa chỉ IP của client trong lời gọi `accept()` của kết nối thông thường).
  - Triển khai một số loại cơ chế bảo mật để ngăn chặn một tiến trình giả mạo (rogue process) cố gắng kết nối đến socket lắng nghe của client. Để làm điều này, client có thể gửi một cookie (tức là một loại thông điệp duy nhất - unique message) tới server thông qua socket thông thường. Server sau đó sẽ trả lại cookie này qua socket ưu tiên để client có thể xác thực.
  - Để thử nghiệm việc truyền dữ liệu thông thường và dữ liệu ưu tiên từ client sang server, bạn sẽ cần lập trình cho server để ghép kênh (multiplex) đầu vào từ hai socket sử dụng `select()` hoặc `poll()` (được mô tả tại Mục 63.2).
