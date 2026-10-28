# Chương 60: Socket: Thiết kế máy chủ (Sockets: Server Design)

Chương này thảo luận về các nguyên lý cơ bản trong thiết kế máy chủ tuần tự (iterative server) và máy chủ đồng thời (concurrent server), đồng thời mô tả `inetd`, một tiến trình nền (daemon) đặc biệt được thiết kế để tạo thuận lợi cho việc xây dựng các Internet server.

## 60.1 Máy chủ tuần tự và Máy chủ đồng thời (Iterative and Concurrent Servers)

Hai thiết kế phổ biến cho các máy chủ mạng (network server) sử dụng Socket (Socket) bao gồm:

- Tuần tự (Iterative): Máy chủ xử lý từng client (Client) một, xử lý hoàn tất các yêu cầu của client đó trước khi chuyển sang client tiếp theo.
- Đồng thời (Concurrent): Máy chủ được thiết kế để xử lý nhiều client cùng một lúc.

Chúng ta đã thấy một ví dụ về máy chủ tuần tự sử dụng FIFO trong Mục 44.8 và một ví dụ về máy chủ đồng thời sử dụng hàng đợi thông điệp System V (System V message queue) trong Mục 46.8.

Các máy chủ tuần tự thường chỉ phù hợp khi các yêu cầu của client có thể được xử lý nhanh chóng, vì mỗi client phải đợi cho đến khi tất cả các client đứng trước nó được phục vụ xong. Kịch bản điển hình để áp dụng máy chủ tuần tự là khi client và server trao đổi một yêu cầu và phản hồi đơn lẻ.

Các máy chủ đồng thời thích hợp khi cần một lượng thời gian xử lý đáng kể để đáp ứng mỗi yêu cầu, hoặc khi client và server tham gia vào một phiên trao đổi kéo dài, truyền các thông điệp qua lại lẫn nhau. Trong chương này, chúng ta chủ yếu tập trung vào phương pháp thiết kế máy chủ đồng thời truyền thống (và đơn giản nhất): tạo một tiến trình con (child process) mới cho mỗi client mới. Mỗi tiến trình con của server sẽ thực hiện tất cả các tác vụ cần thiết để phục vụ một client duy nhất và sau đó kết thúc (terminate). Vì mỗi tiến trình này có thể hoạt động độc lập, nhiều client có thể được xử lý cùng một lúc. Tác vụ chính của tiến trình server chính (tiến trình cha - parent) là tạo một tiến trình con mới cho mỗi client mới. (Một biến thể của cách tiếp cận này là tạo một luồng mới - thread cho mỗi client).

Trong các phần tiếp theo, chúng ta sẽ xem xét các ví dụ về máy chủ tuần tự và máy chủ đồng thời sử dụng Socket miền Internet (Internet domain socket). Hai máy chủ này triển khai dịch vụ echo (RFC 862), một dịch vụ sơ khai trả về bản sao của bất kỳ thứ gì mà client gửi đến nó.

## 60.2 Máy chủ UDP echo tuần tự (An Iterative UDP echo Server)

Trong phần này và phần tiếp theo, chúng ta trình bày các máy chủ cho dịch vụ echo. Dịch vụ echo hoạt động trên cả cổng (port) UDP và TCP số 7. (Vì đây là một cổng dành riêng - reserved port, máy chủ echo phải được chạy với quyền siêu người dùng - superuser privileges).

Máy chủ UDP echo liên tục đọc các gói dữ liệu (datagram), trả về bản sao của mỗi datagram cho bên gửi. Vì máy chủ chỉ cần xử lý một thông điệp tại một thời điểm, nên thiết kế máy chủ tuần tự là hoàn toàn phù hợp. Tệp tiêu đề (header file) cho máy chủ được thể hiện trong [Liệt kê 60-1.](#page-91-0)

**Liệt kê 60-1:** Tệp tiêu đề cho id\_echo\_sv.c và id\_echo\_cl.c

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/id_echo.h
## include "inet_sockets.h" /* Declares our socket functions */
## include "tlpi_hdr.h"
## define SERVICE "echo" /* Name of UDP service */
## define BUF_SIZE 500 /* Maximum size of datagrams that can
 be read by client and server */
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/id_echo.h
```

[Liệt kê 60-2](#page-92-0) cho thấy việc triển khai máy chủ. Hãy lưu ý các điểm sau liên quan đến việc triển khai máy chủ:

- Chúng ta sử dụng hàm `becomeDaemon()` trong Mục 37.2 để biến máy chủ thành một tiến trình nền (daemon).
- Để rút ngắn chương trình này, chúng ta sử dụng thư viện Socket miền Internet được phát triển trong Mục [59.12.](#page-76-1)
- Nếu máy chủ không thể gửi trả lời cho client, nó sẽ ghi lại một thông điệp bằng cách sử dụng `syslog()`.

Trong một ứng dụng thực tế, chúng ta có thể áp dụng một số giới hạn tốc độ (rate limit) đối với các thông điệp được ghi bằng `syslog()`, nhằm ngăn chặn khả năng kẻ tấn công làm đầy nhật ký hệ thống (system log) và bởi vì mỗi lệnh gọi `syslog()` đều tốn kém tài nguyên, do (theo mặc định) `syslog()` lại gọi tiếp hàm `fsync()`.

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/id_echo_sv.c
## include <syslog.h>
## include "id_echo.h"
## include "become_daemon.h"
int
main(int argc, char *argv[])
{
 int sfd;
 ssize_t numRead;
 socklen_t addrlen, len;
 struct sockaddr_storage claddr;
 char buf[BUF_SIZE];
 char addrStr[IS_ADDR_STR_LEN];
 if (becomeDaemon(0) == -1)
 errExit("becomeDaemon");
 sfd = inetBind(SERVICE, SOCK_DGRAM, &addrlen);
 if (sfd == -1) {
 syslog(LOG_ERR, "Could not create server socket (%s)", strerror(errno));
 exit(EXIT_FAILURE);
 }
   /* Nhận các datagram và trả về bản sao cho người gửi */
 for (;;) {
 len = sizeof(struct sockaddr_storage);
 numRead = recvfrom(sfd, buf, BUF_SIZE, 0,
 (struct sockaddr *) &claddr, &len);
 if (numRead == -1)
 errExit("recvfrom");
 if (sendto(sfd, buf, numRead, 0, (struct sockaddr *) &claddr, len)
 != numRead)
 syslog(LOG_WARNING, "Error echoing response to %s (%s)",
 inetAddressStr((struct sockaddr *) &claddr, len,
 addrStr, IS_ADDR_STR_LEN),
 strerror(errno));
 }
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/id_echo_sv.c
```

Để kiểm tra máy chủ (server), chúng ta sử dụng chương trình máy khách (client) được minh họa tại [Listing 60-3.](#page-93-0) Chương trình này cũng sử dụng thư viện Internet domain socket được phát triển trong Mục [59.12.](#page-76-1) Là đối số dòng lệnh (command-line argument) đầu tiên, chương trình client yêu cầu tên của host mà server đang chạy. Client thực thi một vòng lặp, trong đó nó gửi từng đối số dòng lệnh còn lại của mình đến server dưới dạng các datagram riêng biệt, đồng thời đọc và in ra từng datagram phản hồi được gửi lại bởi server.

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/id_echo_cl.c
## include "id_echo.h"
int
main(int argc, char *argv[])
{
 int sfd, j;
 size_t len;
 ssize_t numRead;
 char buf[BUF_SIZE];
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s: host msg...\n", argv[0]);
   /* Xây dựng địa chỉ server từ đối số dòng lệnh đầu tiên */
 sfd = inetConnect(argv[1], SERVICE, SOCK_DGRAM);
 if (sfd == -1)
 fatal("Could not connect to server socket");
   /* Gửi các đối số dòng lệnh còn lại tới server dưới dạng các datagram riêng biệt */
 for (j = 2; j < argc; j++) {
 len = strlen(argv[j]);
 if (write(sfd, argv[j], len) != len)
 fatal("partial/failed write");
 numRead = read(sfd, buf, BUF_SIZE);
 if (numRead == -1)
 errExit("read");
 printf("[%ld bytes] %.*s\n", (long) numRead, (int) numRead, buf);
 }
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/id_echo_cl.c
```

Dưới đây là ví dụ về những gì chúng ta thấy khi chạy server và hai tiến trình (process) instance của client:

```
$ su Cần quyền hạn để bind cổng đã dành riêng (reserved port)
Password:
## ./id_echo_sv Server tự đưa nó vào background
## exit Thoát quyền superuser
$ ./id_echo_cl localhost hello world Client này gửi hai datagram
[5 bytes] hello Client in các phản hồi từ server
[5 bytes] world
$ ./id_echo_cl localhost goodbye Client này gửi một datagram
[7 bytes] goodbye
```

## 60.3 Máy chủ TCP echo đa tiến trình đồng thời (Concurrent TCP echo Server)

Dịch vụ TCP echo cũng hoạt động trên cổng 7. TCP echo server chấp nhận một kết nối (connection) và sau đó lặp liên tục, đọc tất cả dữ liệu được truyền đi và gửi lại chúng cho client trên cùng một socket đó. Server tiếp tục đọc cho đến khi phát hiện ra ký tự kết thúc file (end-of-file), tại thời điểm đó nó sẽ đóng socket của mình (để client nhận thấy end-of-file nếu client đó vẫn đang đọc từ socket của nó).

Vì client có thể gửi một lượng dữ liệu không xác định đến server (và do đó việc phục vụ client có thể mất một khoảng thời gian không xác định), nên thiết kế một server đồng thời (concurrent server) là phù hợp, để nhiều client có thể được phục vụ đồng thời. Việc cài đặt server được minh họa trong [Listing 60-4](#page-95-0). (Chúng tôi trình bày việc cài đặt một client cho dịch vụ này tại Mục [61.2](#page-107-0).) Lưu ý các điểm sau đây về cách cài đặt:

- Server trở thành một tiến trình nền (daemon) bằng cách gọi hàm `becomeDaemon()` được trình bày trong Mục 37.2.
- Để rút ngắn chương trình này, chúng tôi sử dụng thư viện Internet domain socket được hiển thị trong [Listing 59-9](#page-79-1) (trang [1228\)](#page-79-1).
- Vì server tạo ra một tiến trình con (child process) cho mỗi kết nối của client, chúng ta phải đảm bảo rằng các tiến trình thây ma (zombie) được thu gom/dọn dẹp (reap). Chúng ta thực hiện việc này bên trong một trình xử lý tín hiệu `SIGCHLD` (SIGCHLD handler).
- Phần thân chính của server bao gồm một vòng lặp `for` để chấp nhận kết nối từ client và sau đó sử dụng hàm `fork()` để tạo ra một tiến trình con thực thi hàm `handleRequest()` nhằm xử lý client đó. Trong khi đó, tiến trình cha (parent process) tiếp tục vòng lặp `for` để chấp nhận kết nối tiếp theo của client.

Trong một ứng dụng thực tế (real-world application), chúng ta có thể sẽ đưa vào server một số đoạn mã để đặt giới hạn trên (upper limit) cho số lượng tiến trình con mà server có thể tạo ra, nhằm ngăn chặn kẻ tấn công thực hiện một cuộc tấn công từ chối dịch vụ dạng fork bomb từ xa bằng cách sử dụng dịch vụ để tạo ra quá nhiều tiến trình trên hệ thống khiến nó trở nên không thể sử dụng được. Chúng ta có thể áp đặt giới hạn này bằng cách thêm mã nguồn phụ vào server để đếm số lượng tiến trình con đang thực thi (số đếm này sẽ được tăng lên sau một lệnh `fork()` thành công và giảm đi khi mỗi tiến trình con được thu hoạch trong trình xử lý `SIGCHLD`). Nếu đạt đến giới hạn số lượng tiến trình con, chúng ta có thể tạm thời ngừng chấp nhận kết nối (hoặc cách khác, vẫn chấp nhận kết nối và sau đó đóng chúng ngay lập tức).

- Sau mỗi lần gọi `fork()`, các file descriptor cho socket lắng nghe (listening socket) và socket đã kết nối (connected socket) được nhân bản sang tiến trình con (Mục 24.2.1). Điều này có nghĩa là cả tiến trình cha và tiến trình con đều có thể giao tiếp với client bằng socket đã kết nối. Tuy nhiên, chỉ tiến trình con cần thực hiện việc giao tiếp đó, do đó tiến trình cha sẽ đóng file descriptor của socket đã kết nối ngay sau lệnh `fork()`. (Nếu tiến trình cha không làm điều này, thì socket sẽ không bao giờ thực sự bị đóng; hơn nữa, tiến trình cha cuối cùng sẽ cạn kiệt các file descriptor). Vì tiến trình con không chấp nhận các kết nối mới, nó sẽ đóng bản nhân bản của file descriptor dành cho socket lắng nghe.

- Mỗi tiến trình con (child process) sẽ kết thúc sau khi xử lý một client duy nhất.

**Liệt kê 60-4:** Một server đồng thời (concurrent server) thực thi dịch vụ TCP echo

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_echo_sv.c
## include <signal.h>
## include <syslog.h>
## include <sys/wait.h>
## include "become_daemon.h"
## include "inet_sockets.h" /* Declarations of inet*() socket functions */
## include "tlpi_hdr.h"
## define SERVICE "echo" /* Name of TCP service */
## define BUF_SIZE 4096
static void /* SIGCHLD handler to reap dead child processes */
grimReaper(int sig)
{
 int savedErrno; /* Save 'errno' in case changed here */
 savedErrno = errno;
 while (waitpid(-1, NULL, WNOHANG) > 0)
 continue;
 errno = savedErrno;
}
/* Handle a client request: copy socket input back to socket */
static void
handleRequest(int cfd)
{
 char buf[BUF_SIZE];
 ssize_t numRead;
 while ((numRead = read(cfd, buf, BUF_SIZE)) > 0) {
 if (write(cfd, buf, numRead) != numRead) {
 syslog(LOG_ERR, "write() failed: %s", strerror(errno));
 exit(EXIT_FAILURE);
 }
 }
 if (numRead == -1) {
 syslog(LOG_ERR, "Error from read(): %s", strerror(errno));
 exit(EXIT_FAILURE);
 }
}
int
main(int argc, char *argv[])
{
 int lfd, cfd; /* Listening and connected sockets */
 struct sigaction sa;
 if (becomeDaemon(0) == -1)
 errExit("becomeDaemon");
```

```
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = SA_RESTART;
 sa.sa_handler = grimReaper;
 if (sigaction(SIGCHLD, &sa, NULL) == -1) {
 syslog(LOG_ERR, "Error from sigaction(): %s", strerror(errno));
 exit(EXIT_FAILURE);
 }
 lfd = inetListen(SERVICE, 10, NULL);
 if (lfd == -1) {
 syslog(LOG_ERR, "Could not create server socket (%s)", strerror(errno));
 exit(EXIT_FAILURE);
 }
 for (;;) {
 cfd = accept(lfd, NULL, NULL); /* Wait for connection */
 if (cfd == -1) {
 syslog(LOG_ERR, "Failure in accept(): %s", strerror(errno));
 exit(EXIT_FAILURE);
 }
      /* Handle each client request in a new child process */
      switch (fork()) {
 case -1:
 syslog(LOG_ERR, "Can't create child (%s)", strerror(errno));
 close(cfd); /* Give up on this client */
 break; /* May be temporary; try next client */
 case 0: /* Child */
 close(lfd); /* Unneeded copy of listening socket */
 handleRequest(cfd);
 _exit(EXIT_SUCCESS);
 default: /* Parent */
 close(cfd); /* Unneeded copy of connected socket */
 break; /* Loop to accept next connection */
 }
 }
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_echo_sv.c
```

## 60.4 Các mô hình Server Đồng thời Khác

Mô hình server đồng thời (concurrent server) truyền thống được mô tả trong phần trước là đủ dùng cho nhiều ứng dụng cần xử lý đồng thời nhiều client thông qua các kết nối TCP. Tuy nhiên, đối với các server có tải rất cao (ví dụ: các web server xử lý hàng nghìn yêu cầu mỗi phút), chi phí tạo một tiến trình con mới (hoặc thậm chí là luồng - thread) cho mỗi client sẽ áp đặt một gánh nặng đáng kể lên server (tham khảo Phần 28.3), và do đó cần phải sử dụng các thiết kế thay thế. Chúng ta sẽ cùng xem xét ngắn gọn một số giải pháp thay thế đó.

### Server tạo sẵn tiến trình và luồng (Preforked and prethreaded servers)

Các server dạng preforked và prethreaded được mô tả chi tiết trong Chương 30 của [Stevens et al., 2004]. Các ý tưởng cốt lõi bao gồm:

- Thay vì tạo một tiến trình con (hoặc luồng) mới cho mỗi client, server tạo sẵn một số lượng cố định các tiến trình con (hoặc luồng) ngay khi khởi động (nghĩa là trước khi bất kỳ yêu cầu nào từ client được nhận). Các tiến trình con này cấu thành nên cái gọi là nhóm tiến trình máy chủ (server pool).
- Mỗi tiến trình con trong server pool xử lý một client tại một thời điểm, nhưng thay vì kết thúc sau khi xử lý xong client đó, tiến trình con sẽ tiếp tục nhận client tiếp theo cần phục vụ và xử lý nó, cứ như vậy tiếp diễn.

Việc áp dụng kỹ thuật trên đòi hỏi một số quản lý cẩn thận bên trong ứng dụng server. Server pool phải đủ lớn để đảm bảo phản hồi thỏa đáng cho các yêu cầu của client. Điều này có nghĩa là tiến trình cha (parent process) của server phải giám sát số lượng các tiến trình con đang rảnh rỗi, và vào thời điểm tải cao điểm, tăng kích thước của pool lên sao cho luôn có đủ tiến trình con sẵn sàng phục vụ ngay lập tức các client mới. Nếu tải giảm xuống, kích thước của server pool nên được thu nhỏ lại, bởi vì việc có quá nhiều tiến trình dư thừa trên hệ thống có thể làm giảm hiệu năng tổng thể của hệ thống.

Ngoài ra, các tiến trình con trong server pool phải tuân theo một số giao thức nào đó để cho phép chúng chọn độc lập từng kết nối của client. Trên hầu hết các phiên bản UNIX (bao gồm cả Linux), chỉ cần để mỗi tiến trình con trong pool bị chặn (block) trong lệnh gọi `accept()` trên descriptor đang lắng nghe (listening descriptor). Nói cách khác, tiến trình cha của server tạo socket lắng nghe trước khi tạo bất kỳ tiến trình con nào, và mỗi tiến trình con sẽ kế thừa một File Descriptor cho socket đó trong quá trình `fork()`. Khi một kết nối client mới đến, chỉ có một trong số các tiến trình con hoàn thành lệnh gọi `accept()`. Tuy nhiên, vì `accept()` không phải là một System Call nguyên tử (atomic) trên một số phiên bản cũ, lệnh gọi này có thể cần phải được bọc lại bằng một kỹ thuật loại trừ lẫn nhau (mutual-exclusion) nào đó (ví dụ: khóa tập tin - file lock) để đảm bảo rằng chỉ có một tiến trình con thực hiện lệnh gọi này tại một thời điểm ([Stevens et al., 2004]).

> [!NOTE]
> Có những phương án thay thế cho việc để tất cả các tiến trình con trong server pool (nhóm máy chủ) đều thực hiện các lời gọi `accept()`. Nếu server pool bao gồm các tiến trình (process) riêng biệt, tiến trình cha của server có thể thực hiện lời gọi `accept()`, sau đó truyền file descriptor (mô tả tệp) chứa kết nối mới cho một trong các tiến trình đang rảnh rỗi trong pool, sử dụng một kỹ thuật mà chúng tôi mô tả ngắn gọn trong [Mục 61.13.3.](#page-135-1) Nếu server pool bao gồm các luồng (thread), luồng chính (main thread) có thể thực hiện lời gọi `accept()`, và sau đó thông báo cho một trong các luồng server đang rảnh rằng có một client mới sẵn sàng trên descriptor đã được kết nối.

### Xử lý nhiều client từ một tiến trình đơn

Trong một số trường hợp, chúng ta có thể thiết kế một tiến trình server đơn lẻ để xử lý nhiều client. Để làm điều này, chúng ta phải áp dụng một trong các mô hình I/O (I/O multiplexing - đa kênh I/O, signal-driven I/O - I/O hướng tín hiệu, hoặc epoll) cho phép một tiến trình đơn đồng thời giám sát nhiều file descriptor để chờ các sự kiện I/O. Các mô hình này được mô tả trong Chương 63.

Trong thiết kế server đơn, tiến trình server phải đảm nhận một số tác vụ lập lịch (scheduling) vốn thường được xử lý bởi kernel (nhân hệ điều hành). Trong một giải pháp liên quan đến việc sử dụng một tiến trình server cho mỗi client, chúng ta có thể dựa vào kernel để đảm bảo rằng mỗi tiến trình server (và do đó là client) nhận được một phần chia công bằng quyền truy cập vào tài nguyên của máy chủ (server host). Nhưng khi chúng ta sử dụng một tiến trình server đơn để xử lý nhiều client, server phải thực hiện một số công việc để đảm bảo rằng một hoặc một vài client không độc quyền truy cập vào server trong khi các client khác bị bỏ đói (starvation). Chúng tôi sẽ trình bày chi tiết hơn về điểm này trong Mục 63.4.6.

## Sử dụng các trang trại máy chủ (Server Farms)

Các cách tiếp cận khác để xử lý tải client cao liên quan đến việc sử dụng nhiều hệ thống server — một server farm (trang trại máy chủ).

Một trong những cách tiếp cận đơn giản nhất để xây dựng một server farm (được sử dụng bởi một số web server) là chia sẻ tải (hoặc phân phối tải) theo kiểu vòng tròn DNS (DNS round-robin load sharing), nơi máy chủ tên miền có thẩm quyền (authoritative name server) cho một zone ánh xạ cùng một tên miền tới nhiều địa chỉ IP (nghĩa là, nhiều server chia sẻ cùng một tên miền). Các yêu cầu liên tiếp đến máy chủ DNS để phân giải tên miền sẽ trả về các địa chỉ IP này theo một thứ tự khác nhau, theo phương thức xoay vòng (round-robin). Thông tin thêm về chia sẻ tải DNS round-robin có thể được tìm thấy trong [Albitz & Liu, 2006].

DNS round-robin có ưu điểm là không tốn kém và dễ thiết lập. Tuy nhiên, nó cũng mang lại một số vấn đề. Một trong số đó là việc caching (lưu trữ đệm) được thực hiện bởi các máy chủ DNS từ xa, điều này có nghĩa là các yêu cầu trong tương lai từ các client trên một host cụ thể (hoặc một tập hợp các host) sẽ bỏ qua máy chủ DNS round-robin và luôn được xử lý bởi cùng một server. Ngoài ra, DNS round-robin không có bất kỳ cơ chế tích hợp sẵn nào để đảm bảo cân bằng tải tốt (các client khác nhau có thể đặt các mức tải khác nhau lên một server) hoặc đảm bảo tính sẵn sàng cao (high availability) (điều gì xảy ra nếu một trong các server chết hoặc ứng dụng server đang chạy bị crash?). Một vấn đề khác mà chúng ta có thể cần phải xem xét — một vấn đề mà nhiều thiết kế sử dụng nhiều máy chủ server phải đối mặt — là đảm bảo tính gắn kết server (server affinity); nghĩa là, đảm bảo rằng một chuỗi các yêu cầu từ cùng một client đều được chuyển hướng đến cùng một server, sao cho bất kỳ thông tin trạng thái (state information) nào được duy trì bởi server về client đó vẫn giữ nguyên tính chính xác.

Một giải pháp linh hoạt hơn, nhưng cũng phức tạp hơn, là cân bằng tải server (server load balancing). Trong kịch bản này, một máy chủ cân bằng tải (load-balancing server) đơn lẻ định tuyến các yêu cầu client đến một trong các thành viên của server farm. (Để đảm bảo tính sẵn sàng cao, có thể có một máy chủ dự phòng tiếp quản nếu máy chủ cân bằng tải chính bị crash). Điều này loại bỏ các vấn đề liên quan đến DNS caching từ xa, vì server farm trình bày một địa chỉ IP duy nhất (của máy chủ cân bằng tải) với thế giới bên ngoài. Máy chủ cân bằng tải kết hợp các thuật toán để đo lường hoặc ước tính tải của server (có thể dựa trên các chỉ số được cung cấp bởi các thành viên của server farm) và phân phối tải một cách thông minh cho các thành viên trong server farm. Máy chủ cân bằng tải cũng tự động phát hiện các sự cố ở các thành viên trong server farm (và việc bổ sung các server mới, nếu nhu cầu đòi hỏi). Cuối cùng, máy chủ cân bằng tải cũng có thể cung cấp hỗ trợ cho server affinity. Thông tin thêm về cân bằng tải server có thể được tìm thấy trong [Kopparapu, 2002].

## 60.5 Tiến trình nền inetd (Internet Superserver)

Nếu chúng ta xem qua nội dung của `/etc/services`, chúng ta sẽ thấy hàng trăm dịch vụ khác nhau được liệt kê. Điều này ngụ ý rằng một hệ thống về lý thuyết có thể chạy một số lượng lớn các tiến trình server. Tuy nhiên, hầu hết các server này thường không làm gì ngoài việc chờ đợi các yêu cầu kết nối hoặc datagram ít khi xảy ra. Mặc dù vậy, tất cả các tiến trình server này vẫn chiếm các ô trong bảng tiến trình của kernel (kernel process table), và tiêu thụ một số bộ nhớ và không gian swap, do đó gây ra tải cho hệ thống.

Tiến trình nền (daemon) `inetd` được thiết kế để loại bỏ sự cần thiết phải chạy số lượng lớn các server ít khi được sử dụng. Sử dụng `inetd` mang lại hai lợi ích chính:

- Thay vì chạy một tiến trình nền (daemon) riêng biệt cho từng dịch vụ, một tiến trình duy nhất—tiến trình nền `inetd`—sẽ giám sát một tập hợp các cổng socket được chỉ định và khởi động các máy chủ (server) khác khi cần thiết. Nhờ đó, số lượng tiến trình đang chạy trên hệ thống được giảm xuống.
- Việc lập trình các máy chủ được khởi động bởi `inetd` trở nên đơn giản hơn, bởi vì `inetd` thực hiện một số bước thường được yêu cầu bởi tất cả các máy chủ mạng khi khởi động.

Vì nó giám sát một loạt các dịch vụ, gọi các máy chủ khác khi cần, `inetd` đôi khi được gọi là siêu máy chủ Internet (Internet superserver).

> [!NOTE]
> Một phiên bản mở rộng của `inetd` là `xinetd`, được cung cấp trong một số bản phân phối Linux. Ngoài ra, `xinetd` bổ sung thêm một số cải tiến về bảo mật. Thông tin về `xinetd` có thể được tìm thấy tại http://www.xinetd.org/.

## Hoạt động của tiến trình nền inetd

Tiến trình nền `inetd` thông thường được khởi động trong quá trình khởi động hệ thống (system boot). Sau khi trở thành một tiến trình nền (Mục 37.2), `inetd` thực hiện các bước sau:

- 1. Đối với mỗi dịch vụ được chỉ định trong tệp cấu hình của nó, `/etc/inetd.conf`, `inetd` tạo ra một socket thuộc loại phù hợp (tức là stream hoặc datagram) và liên kết (bind) nó với cổng được chỉ định. Mỗi TCP socket được đánh dấu bổ sung để cho phép các kết nối đến thông qua lệnh gọi `listen()`.
- 2. Sử dụng System Call `select()` (Mục 63.2.1), `inetd` giám sát tất cả các socket được tạo ở bước trước để phát hiện các gói datagram hoặc yêu cầu kết nối đến.
- 3. Lệnh gọi `select()` sẽ chặn (block) cho đến khi một UDP socket có sẵn datagram để đọc hoặc một yêu cầu kết nối được nhận trên một TCP socket. Trong trường hợp kết nối TCP, `inetd` thực hiện hàm `accept()` cho kết nối trước khi chuyển sang bước tiếp theo.
- 4. Để khởi động máy chủ được chỉ định cho socket này, `inetd()` gọi `fork()` để tạo một tiến trình mới, sau đó thực hiện lệnh gọi `exec()` để khởi động chương trình máy chủ. Trước khi thực hiện `exec()`, tiến trình con thực hiện các bước sau:
  - a) Đóng tất cả các File Descriptor được kế thừa từ tiến trình cha, ngoại trừ File Descriptor dành cho socket nơi UDP datagram có sẵn hoặc kết nối TCP đã được chấp nhận.
  - b) Sử dụng các kỹ thuật được mô tả trong Mục 5.5 để nhân bản File Descriptor của socket sang các File Descriptor 0, 1 và 2, sau đó đóng chính File Descriptor của socket đó đi (vì không còn cần thiết nữa). Sau bước này, máy chủ được `exec()` có thể giao tiếp qua socket bằng cách sử dụng ba File Descriptor tiêu chuẩn.
  - c) Tùy chọn, thiết lập ID người dùng (user ID) và ID nhóm (group ID) cho máy chủ được `exec()` theo các giá trị được chỉ định trong `/etc/inetd.conf`.
- 5. Nếu một kết nối đã được chấp nhận trên một TCP socket ở bước 3, `inetd` sẽ đóng socket đã kết nối lại (vì nó chỉ cần thiết trong tiến trình máy chủ được `exec()`).
- 6. Máy chủ `inetd` quay trở lại bước 2.

## Tệp /etc/inetd.conf

Hoạt động của tiến trình nền (daemon) `inetd` được điều khiển bởi một tệp cấu hình, thông thường là `/etc/inetd.conf`. Mỗi dòng trong tệp này mô tả một trong các dịch vụ sẽ được xử lý bởi `inetd`. [Liệt kê 60-5](#page-100-0) cho thấy một số ví dụ về các mục trong tệp `/etc/inetd.conf` đi kèm với một bản phân phối Linux (Linux distribution).

**Liệt kê 60-5:** Các dòng ví dụ từ `/etc/inetd.conf`

## echo stream tcp nowait root internal

## echo dgram udp wait root internal

ftp stream tcp nowait root /usr/sbin/tcpd in.ftpd
telnet stream tcp nowait root /usr/sbin/tcpd in.telnetd
login stream tcp nowait root /usr/sbin/tcpd in.rlogind

```

Hai dòng đầu tiên của [Liệt kê 60-5](#page-100-0) đã được vô hiệu hóa bằng ký tự `#` ở đầu; chúng tôi hiển thị chúng ở đây vì chúng ta sẽ đề cập đến dịch vụ `echo` ngay sau đây.

Mỗi dòng của `/etc/inetd.conf` bao gồm các trường sau, được phân tách bằng khoảng trắng (white space):

- Tên dịch vụ (Service name): Trường này chỉ định tên của một dịch vụ từ tệp `/etc/services`. Kết hợp với trường giao thức (protocol field), thông tin này được dùng để tra cứu `/etc/services` nhằm xác định số cổng (port number) mà `inetd` nên giám sát cho dịch vụ này.
- Loại socket (Socket type): Trường này chỉ định loại socket được sử dụng bởi dịch vụ này — ví dụ: `stream` hoặc `dgram`.
- Giao thức (Protocol): Trường này chỉ định giao thức sẽ được sử dụng bởi socket này. Trường này có thể chứa bất kỳ giao thức Internet nào được liệt kê trong tệp `/etc/protocols` (được tài liệu hóa trong trang hướng dẫn (manual page) `protocols(5)`), nhưng hầu như mọi dịch vụ đều chỉ định `tcp` (cho TCP) hoặc `udp` (cho UDP).
- Cờ (Flags): Trường này chứa `wait` hoặc `nowait`. Trường này chỉ định liệu máy chủ (server) được thực thi (`execed`) bởi `inetd` có (tạm thời) tiếp quản việc quản lý socket cho dịch vụ này hay không. Nếu máy chủ được thực thi quản lý socket, thì trường này được chỉ định là `wait`. Điều này khiến `inetd` gỡ bỏ socket này khỏi tập hợp bộ mô tả tệp (file descriptor set) mà nó đang giám sát bằng hàm `select()` cho đến khi máy chủ được thực thi kết thúc (`inetd` phát hiện điều này thông qua một hàm xử lý tín hiệu cho `SIGCHLD`). Chúng ta sẽ bàn thêm về trường này ở phần dưới.
- Tên đăng nhập (Login name): Trường này bao gồm tên người dùng (username) từ `/etc/passwd`, tùy chọn theo sau bởi dấu chấm (.) và tên nhóm (group name) từ `/etc/group`. Các thông tin này xác định ID người dùng (user ID) và ID nhóm (group ID) mà dưới quyền đó máy chủ được thực thi chạy. (Vì `inetd` chạy với hiệu dụng ID người dùng (effective user ID) là root, các tiến trình con (child processes) của nó cũng có đặc quyền và do đó có thể sử dụng các System Call `setuid()` và `setgid()` để thay đổi thông tin xác thực tiến trình (process credentials) nếu muốn.)
- Chương trình máy chủ (Server program): Trường này chỉ định đường dẫn (pathname) của chương trình máy chủ sẽ được thực thi (`execed`).
- Đối số chương trình máy chủ (Server program arguments): Trường này chỉ định một hoặc nhiều đối số, được phân tách bằng khoảng trắng, dùng làm danh sách đối số khi thực thi chương trình máy chủ. Đối số đầu tiên trong số này tương ứng với `argv[0]` trong chương trình được thực thi và do đó thường giống với phần tên cơ sở (basename) của tên chương trình máy chủ. Đối số tiếp theo tương ứng với `argv[1]`, cứ như vậy.

Trong các dòng ví dụ được hiển thị ở [Liệt kê 60-5](#page-100-0) cho các dịch vụ `ftp`, `telnet` và `login`, chúng ta thấy chương trình máy chủ và các đối số được thiết lập khác so với mô tả vừa rồi. Cả ba dịch vụ này đều khiến `inetd` gọi cùng một chương trình, `tcpd(8)` (trình bao bọc tiến trình nền TCP - TCP daemon wrapper), chương trình này thực hiện một số việc ghi nhật ký (logging) và kiểm soát truy cập (access-control checks) trước khi tiến hành thực thi chương trình phù hợp, dựa trên giá trị được chỉ định làm đối số chương trình máy chủ đầu tiên (có sẵn cho `tcpd` thông qua `argv[0]`). Thông tin thêm về `tcpd` có thể được tìm thấy trong trang hướng dẫn `tcpd(8)` và trong [Mann & Mitchell, 2003].

Các máy chủ stream socket (TCP) được gọi bởi `inetd` thường được thiết kế để chỉ xử lý một kết nối client duy nhất rồi chấm dứt, để lại cho `inetd` công việc lắng nghe các kết nối tiếp theo. Đối với các máy chủ như vậy, các cờ (flags) nên được chỉ định là `nowait`. (Nếu thay vào đó, máy chủ được thực thi phải tự chấp nhận kết nối, thì `wait` nên được chỉ định; trong trường hợp này, `inetd` không chấp nhận kết nối, mà thay vào đó chuyển bộ mô tả tệp cho socket lắng nghe sang máy chủ được thực thi dưới dạng bộ mô tả 0 - descriptor 0.)

Đối với hầu hết các máy chủ UDP, trường cờ nên được chỉ định là `wait`. Máy chủ UDP được gọi bởi `inetd` thường được thiết kế để đọc và xử lý tất cả các gói dữ liệu (datagram) chưa được xử lý trên socket rồi sau đó kết thúc. (Điều này thường đòi hỏi một dạng thời gian chờ (timeout) nào đó khi đọc socket, sao cho máy chủ kết thúc khi không có gói dữ liệu mới nào đến trong một khoảng thời gian được chỉ định.) Bằng cách chỉ định `wait`, chúng ta ngăn chặn tiến trình nền `inetd` đồng thời cố gắng gọi `select()` trên socket, điều này sẽ dẫn đến một hậu quả không mong muốn là `inetd` sẽ cạnh tranh (`race`) với máy chủ UDP để kiểm tra các gói dữ liệu và, nếu nó thắng cuộc đua, sẽ khởi động một thể hiện (instance) khác của máy chủ UDP.

> Do hoạt động của `inetd` và định dạng tệp cấu hình của nó không được quy định bởi chuẩn SUSv3, nên có một số biến thể (nhìn chung là nhỏ) về các giá trị có thể được chỉ định trong các trường của `/etc/inetd.conf`. Hầu hết các phiên bản của `inetd` đều cung cấp ít nhất cú pháp mà chúng tôi mô tả trong phần nội dung chính. Để biết thêm chi tiết, hãy xem trang hướng dẫn `inetd.conf(8)`.

Như một biện pháp tối ưu hóa hiệu suất, `inetd` tự thực thi một số dịch vụ đơn giản thay vì chạy (`exec`) các tiến trình server riêng biệt để thực hiện tác vụ đó. Các dịch vụ UDP và TCP echo là những ví dụ về các dịch vụ mà `inetd` tự triển khai. Đối với các dịch vụ như vậy, trường chương trình server (server program field) của bản ghi `/etc/inetd.conf` tương ứng được chỉ định là `internal`, và các tham số của chương trình server được lược bỏ. (Trong các dòng ví dụ tại [Listing 60-5](#page-100-0), chúng ta thấy các mục dịch vụ echo đã bị chú thích (comment out). Để kích hoạt dịch vụ echo, chúng ta cần xóa ký tự `#` ở đầu các dòng này).

Bất cứ khi nào chúng ta thay đổi tệp `/etc/inetd.conf`, chúng ta cần gửi tín hiệu `SIGHUP` tới `inetd` để yêu cầu tiến trình này đọc lại tệp:

## killall -HUP inetd

### Ví dụ: gọi một dịch vụ TCP echo thông qua inetd

Chúng ta đã lưu ý trước đó rằng `inetd` đơn giản hóa việc lập trình các server, đặc biệt là các server đồng thời (concurrent servers, thường là TCP). Nó thực hiện điều này bằng cách tiến hành các bước sau thay cho các server mà nó gọi:

- 1. Thực hiện mọi khởi tạo liên quan đến socket (socket-related initialization), gọi `socket()`, `bind()`, và (đối với TCP server) `listen()`.
- 2. Đối với dịch vụ TCP, thực hiện `accept()` cho kết nối mới.
- 3. Tạo một tiến trình mới (new process) để xử lý datagram UDP hoặc kết nối TCP đến. Tiến trình này được thiết lập tự động như một tiến trình nền (daemon). Chương trình `inetd` xử lý mọi chi tiết về việc tạo tiến trình thông qua `fork()` và việc thu gom các tiến trình con đã kết thúc (reaping of dead children) thông qua trình xử lý tín hiệu (handler) cho `SIGCHLD`.
- 4. Nhân bản (duplicate) File Descriptor của socket UDP hoặc socket TCP đã kết nối sang các file descriptor 0, 1, và 2, đồng thời đóng tất cả các file descriptor khác (vì chúng không được sử dụng trong server được `exec`).
- 5. Thực thi (`exec`) chương trình server.

(Trong mô tả về các bước trên, chúng ta giả định các trường hợp thông thường là trường cờ (flags field) của mục dịch vụ trong `/etc/inetd.conf` được chỉ định là `nowait` đối với dịch vụ TCP và `wait` đối với dịch vụ UDP).

Là một ví dụ về việc `inetd` đơn giản hóa việc lập trình dịch vụ TCP như thế nào, tại [Liệt kê 60-6](#page-102-0), chúng tôi trình bày phiên bản tương đương được gọi bởi `inetd` của TCP echo server từ [Liệt kê 60-4.](#page-95-0) Vì `inetd` thực hiện tất cả các bước trên, tất cả những gì còn lại của server chỉ là mã nguồn được thực thi bởi tiến trình con để xử lý yêu cầu của client, vốn có thể được đọc từ file descriptor 0 (`STDIN_FILENO`).

Nếu server nằm trong thư mục `/bin` (chẳng hạn), thì chúng ta sẽ cần tạo mục nhập sau trong `/etc/inetd.conf` để `inetd` có thể gọi server đó:

echo stream tcp nowait root /bin/is\_echo\_inetd\_sv is\_echo\_inetd\_sv

**Listing 60-6:** TCP echo server được thiết kế để gọi thông qua `inetd`

```c

–––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_echo_inetd_sv.c

## include <syslog.h>

## include "tlpi_hdr.h"

## define BUF_SIZE 4096

int
main(int argc, char *argv[])
{
char buf[BUF_SIZE];
ssize_t numRead;
while ((numRead = read(STDIN_FILENO, buf, BUF_SIZE)) > 0) {
if (write(STDOUT_FILENO, buf, numRead) != numRead) {
syslog(LOG_ERR, "write() failed: %s", strerror(errno));
exit(EXIT_FAILURE);
}
}
if (numRead == -1) {
syslog(LOG_ERR, "Error from read(): %s", strerror(errno));
exit(EXIT_FAILURE);
}
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_echo_inetd_sv.c

```

## 60.6 Tổng kết

Một iterative server (server lặp) xử lý từng client một, hoàn thành việc xử lý (các) yêu cầu của client đó trước khi chuyển sang client tiếp theo. Một concurrent server (server đồng thời) xử lý nhiều client cùng một lúc. Trong các kịch bản tải cao (high-load scenarios), thiết kế concurrent server truyền thống — tạo một tiến trình con (hoặc thread mới) cho mỗi client — có thể không đem lại hiệu năng đủ tốt, và chúng ta đã phác thảo hàng loạt cách tiếp cận khác để xử lý đồng thời số lượng lớn client.

Internet superserver daemon, `inetd`, giám sát nhiều socket và khởi động các server thích hợp để phản hồi lại các UDP datagram hoặc kết nối TCP đến. Sử dụng `inetd` cho phép chúng ta giảm tải hệ thống bằng cách tối thiểu hóa số lượng tiến trình network server trên hệ thống, đồng thời đơn giản hóa việc lập trình các tiến trình server, vì nó thực hiện hầu hết các bước khởi tạo mà một server yêu cầu.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê tại Mục [59.15.](#page-86-0)

## 60.7 Bài tập

- **60-1.** Thêm mã nguồn vào chương trình trong [Liệt kê 60-4](#page-95-0) (is\_echo\_sv.c) để thiết lập giới hạn về số lượng tiến trình con (child process) đang thực thi đồng thời.
- **60-2.** Đôi khi, việc viết một socket server sao cho nó có thể được gọi trực tiếp từ dòng lệnh (command line) hoặc gọi gián tiếp thông qua `inetd` là rất cần thiết. Trong trường hợp này, một tùy chọn dòng lệnh được sử dụng để phân biệt hai trường hợp đó. Hãy sửa đổi chương trình trong [Liệt kê 60-4](#page-95-0) sao cho nếu nó nhận được tùy chọn dòng lệnh `-i`, nó sẽ giả định rằng nó đang được gọi bởi `inetd` và xử lý một client duy nhất trên socket đã kết nối mà `inetd` cung cấp thông qua `STDIN_FILENO`. Nếu tùy chọn `-i` không được cung cấp, chương trình có thể giả định rằng nó đang được gọi từ dòng lệnh và hoạt động theo cách thông thường. (Thay đổi này chỉ yêu cầu bổ sung một vài dòng mã). Hãy sửa đổi `/etc/inetd.conf` để gọi chương trình này cho dịch vụ echo.
