# Chương 44: PIPES VÀ FIFOS

Chương này mô tả về pipe (đường ống) và FIFO. Pipe là phương pháp Giao tiếp giữa các tiến trình (Interprocess Communication - IPC) lâu đời nhất trên hệ thống UNIX, xuất hiện từ phiên bản Third Edition UNIX vào đầu những năm 1970. Pipe cung cấp một giải pháp thanh lịch cho một nhu cầu thường gặp: sau khi tạo ra hai tiến trình để chạy các chương trình (lệnh) khác nhau, làm thế nào shell có thể cho phép đầu ra do một tiến trình tạo ra được sử dụng làm đầu vào cho tiến trình còn lại? Pipe có thể được sử dụng để truyền dữ liệu giữa các tiến trình có quan hệ họ hàng (ý nghĩa của từ "có quan hệ họ hàng" sẽ trở nên rõ ràng hơn sau đây). FIFO là một biến thể của khái niệm pipe. Điểm khác biệt quan trọng là FIFO có thể được sử dụng để giao tiếp giữa bất kỳ tiến trình nào.

## 44.1 Tổng quan

Bất kỳ người dùng shell nào cũng đều quen thuộc với việc sử dụng pipe trong các câu lệnh như lệnh sau, dùng để đếm số lượng tệp trong một thư mục:

\$ **ls | wc -l**

Để thực thi câu lệnh trên, shell tạo ra hai tiến trình, lần lượt thực thi `ls` và `wc`. (Việc này được thực hiện bằng cách sử dụng `fork()` và `exec()`, được mô tả trong Chương 24 và 27.) [Hình 44-1](#page-13-0) cho thấy cách hai tiến trình sử dụng pipe.

Trong số các mục đích khác, [Hình 44-1](#page-13-0) nhằm minh họa lý do tại sao pipe lại có tên gọi như vậy. Chúng ta có thể hình dung pipe giống như một đoạn đường ống nước cho phép dữ liệu chảy từ tiến trình này sang tiến trình khác.

![](_page_13_Figure_0.jpeg)

Hình 44-1: Sử dụng pipe để kết nối hai tiến trình

Một điểm cần lưu ý trong Hình 44-1 là hai tiến trình được kết nối với pipe sao cho tiến trình ghi (`ls`) có đầu ra tiêu chuẩn (standard output - File Descriptor 1) được nối với đầu ghi của pipe, trong khi tiến trình đọc (`wc`) có đầu vào tiêu chuẩn (standard input - File Descriptor 0) được nối với đầu đọc của pipe. Trên thực tế, hai tiến trình này hoàn toàn không biết sự tồn tại của pipe; chúng chỉ đơn giản là đọc từ và ghi vào các bộ mô tả tệp (File Descriptor) tiêu chuẩn. Shell phải thực hiện một số thao tác để thiết lập mọi thứ theo cách này, và chúng ta sẽ tìm hiểu cách thực hiện đó trong Mục 44.4.

Trong các đoạn tiếp theo, chúng ta sẽ đề cập đến một số đặc điểm quan trọng của pipe.

### Pipe là một luồng byte (byte stream)

Khi nói rằng pipe là một luồng byte, ý chúng ta là không có khái niệm thông điệp (message) hay ranh giới thông điệp khi sử dụng pipe. Tiến trình đọc từ pipe có thể đọc các khối dữ liệu với bất kỳ kích thước nào, bất kể kích thước của các khối do tiến trình ghi tạo ra. Hơn nữa, dữ liệu đi qua pipe một cách tuần tự — các byte được đọc từ pipe theo đúng thứ tự mà chúng được ghi vào. Không thể truy cập ngẫu nhiên dữ liệu trong pipe bằng cách sử dụng `lseek()`.

Nếu muốn triển khai khái niệm thông điệp rời rạc (discrete message) trong pipe, chúng ta phải tự thực hiện điều đó bên trong ứng dụng của mình. Mặc dù điều này khả thi (tham khảo Mục 44.8), nhưng có thể sẽ tốt hơn nếu sử dụng các cơ chế IPC thay thế, chẳng hạn như hàng đợi thông điệp (message queue) và socket datagram (datagram socket), mà chúng ta sẽ thảo luận trong các chương sau.

## Đọc từ một pipe

Các thao tác cố gắng đọc từ một pipe (đường ống) hiện đang trống sẽ bị chặn (block) cho đến khi có ít nhất một byte được ghi vào pipe đó. Nếu đầu ghi của một pipe bị đóng, thì một tiến trình (process) đang đọc từ pipe sẽ nhận được tín hiệu kết thúc tệp (end-of-file, nghĩa là hàm *read()* trả về 0) sau khi nó đã đọc toàn bộ dữ liệu còn lại trong pipe.

## Pipe là đơn hướng (unidirectional)

Dữ liệu chỉ có thể truyền theo một hướng duy nhất qua một pipe. Một đầu của pipe được dùng để ghi và đầu kia được dùng để đọc.

Trên một số triển khai UNIX khác — đáng chú ý là các hệ thống bắt nguồn từ System V Release 4 — các pipe có tính chất song hướng (được gọi là *stream pipe*). Các pipe song hướng không được quy định bởi bất kỳ tiêu chuẩn UNIX nào, do đó, ngay cả trên các hệ thống có hỗ trợ chúng, tốt nhất là không nên phụ thuộc vào ngữ nghĩa của chúng. Để thay thế, chúng ta có thể sử dụng các cặp socket miền UNIX (UNIX domain stream socket pair) được tạo bằng System Call *socketpair()* (được mô tả ở Mục 57.5), cung cấp một cơ chế giao tiếp song hướng được chuẩn hóa có ngữ nghĩa tương đương với stream pipe.

## Các thao tác ghi có kích thước lên đến PIPE\_BUF byte được đảm bảo là nguyên tử (atomic)

Nếu có nhiều tiến trình cùng ghi vào một pipe duy nhất, dữ liệu của chúng được đảm bảo là sẽ không bị trộn lẫn vào nhau nếu mỗi lần chúng ghi không vượt quá `PIPE_BUF` byte.

Tiêu chuẩn SUSv3 yêu cầu `PIPE_BUF` phải có giá trị ít nhất là `_POSIX_PIPE_BUF` (512). Một hệ thống nên định nghĩa `PIPE_BUF` (trong tệp `<limits.h>`) và/hoặc cho phép hàm `fpathconf(fd, _PC_PIPE_BUF)` trả về giới hạn trên thực tế cho các thao tác ghi nguyên tử (atomic write). Giá trị `PIPE_BUF` khác nhau giữa các hệ triển khai UNIX; ví dụ, nó là 512 byte trên FreeBSD 6.0, 4096 byte trên Tru64 5.1 và 5120 byte trên Solaris 8. Trên Linux, `PIPE_BUF` có giá trị là 4096.

Khi ghi các khối dữ liệu lớn hơn `PIPE_BUF` byte vào một pipe, kernel có thể truyền dữ liệu thành nhiều phần nhỏ hơn, đồng thời bổ sung thêm dữ liệu khi tiến trình đọc lấy các byte ra khỏi pipe. (Hàm `write()` sẽ block cho đến khi toàn bộ dữ liệu đã được ghi vào pipe). Khi chỉ có một tiến trình duy nhất ghi vào pipe (trường hợp thông thường), điều này không gây ảnh hưởng gì. Tuy nhiên, nếu có nhiều tiến trình ghi (writer process), thì các thao tác ghi khối dữ liệu lớn có thể bị chia nhỏ thành các đoạn có kích thước tùy ý (có thể nhỏ hơn `PIPE_BUF` byte) và xen kẽ với các thao tác ghi từ các tiến trình khác.

Giới hạn `PIPE_BUF` ảnh hưởng trực tiếp đến thời điểm dữ liệu được truyền vào pipe. Khi ghi lượng dữ liệu nhỏ hơn hoặc bằng `PIPE_BUF` byte, `write()` sẽ block (nếu cần thiết) cho đến khi có đủ không gian trống trong pipe để có thể hoàn tất thao tác một cách nguyên tử (atomic). Khi ghi lượng dữ liệu lớn hơn `PIPE_BUF` byte, `write()` sẽ truyền đi nhiều dữ liệu nhất có thể để làm đầy pipe, sau đó block cho đến khi dữ liệu được lấy ra khỏi pipe bởi một tiến trình đọc nào đó. Nếu một lời gọi `write()` đang bị block như vậy bị ngắt bởi một trình xử lý tín hiệu (signal handler), thì lời gọi này sẽ được gỡ block (unblock) và trả về số lượng byte đã truyền thành công, con số này sẽ nhỏกว่า lượng dữ liệu được yêu cầu ban đầu (được gọi là thao tác ghi một phần - partial write).

> Trên Linux 2.2, các thao tác ghi vào pipe với bất kỳ kích thước nào đều mang tính nguyên tử (atomic), trừ khi bị ngắt bởi một signal handler. Trên Linux 2.4 trở về sau, bất kỳ thao tác ghi nào lớn hơn `PIPE_BUF` byte đều có thể bị xen kẽ bởi các thao tác ghi từ các tiến trình khác. (Mã nguồn kernel thực thi pipe đã trải qua những thay đổi đáng kể giữa các phiên bản kernel 2.2 và 2.4).

## Pipes có dung lượng giới hạn

Một pipe (đường ống) đơn giản là một buffer (bộ đệm) được quản lý trong bộ nhớ kernel (Kernel Space). Buffer này có dung lượng tối đa. Một khi pipe đã đầy, các tiến trình ghi (writer process) tiếp theo vào pipe sẽ bị block (chặn) cho đến khi tiến trình đọc (reader process) lấy bớt dữ liệu ra khỏi pipe.

SUSv3 không đưa ra yêu cầu nào về dung lượng của một pipe. Trong các phiên bản Linux kernel trước 2.6.11, dung lượng pipe giống với kích thước trang hệ thống (system page size) (ví dụ: 4096 byte trên x86-32); kể từ Linux 2.6.11, dung lượng pipe là 65.536 byte. Các hệ điều hành UNIX khác có dung lượng pipe khác nhau.

Nói chung, một ứng dụng không bao giờ cần phải biết chính xác dung lượng của một pipe. Nếu chúng ta muốn ngăn chặn tiến trình ghi bị block, các tiến trình đọc từ pipe nên được thiết kế để đọc dữ liệu ngay khi nó có sẵn.

> Về lý thuyết, không có lý do gì mà một pipe lại không thể hoạt động với dung lượng nhỏ hơn, thậm chí chỉ với một buffer một byte. Lý do sử dụng kích thước buffer lớn là để tối ưu hiệu năng (efficiency): mỗi khi tiến trình ghi làm đầy pipe, kernel phải thực hiện một context switch (chuyển ngữ cảnh) để cho phép tiến trình đọc được lên lịch (schedule) nhằm dọn bớt dữ liệu khỏi pipe. Sử dụng kích thước buffer lớn hơn đồng nghĩa với việc cần ít context switch hơn.

> Bắt đầu từ Linux 2.6.35, dung lượng của một pipe có thể được thay đổi. Lời gọi dành riêng cho Linux fcntl(fd, F\_SETPIPE\_SZ, size) sẽ thay đổi dung lượng của pipe được trỏ bởi fd thành ít nhất là size byte. Một unprivileged process (tiến trình không có đặc quyền) có thể thay đổi dung lượng pipe thành bất kỳ giá trị nào nằm trong khoảng từ kích thước trang hệ thống cho đến giá trị trong `/proc/sys/fs/pipe-max-size`. Giá trị mặc định cho pipe-max-size là 1.048.576 byte. Một privileged process (tiến trình có đặc quyền - `CAP_SYS_RESOURCE`) có thể vượt qua giới hạn này. Khi cấp phát không gian cho pipe, kernel có thể làm tròn kích thước `size` lên thành một giá trị thuận tiện cho việc triển khai. Lời gọi fcntl(fd, F\_GETPIPE\_SZ) trả về kích thước thực tế được cấp phát cho pipe.

## 44.2 Tạo và Sử dụng Pipes

System Call (lời gọi hệ thống) `pipe()` tạo ra một pipe mới.

```
## include <unistd.h>
int pipe(int filedes[2]);
                                              Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Một lời gọi `pipe()` thành công sẽ trả về hai file descriptor (mô tả tệp) đang mở trong mảng `filedes`: một cho đầu đọc của pipe (`filedes[0]`) và một cho đầu ghi (`filedes[1]`).

Giống như bất kỳ file descriptor nào, chúng ta có thể sử dụng các system call `read()` và `write()` để thực hiện I/O trên pipe. Ngay khi được ghi vào đầu ghi của pipe, dữ liệu sẽ sẵn sàng ngay lập tức để đọc từ đầu đọc. Một thao tác `read()` từ pipe sẽ nhận được số lượng byte nhỏ hơn giữa số lượng byte được yêu cầu và số lượng byte hiện có trong pipe (nhưng sẽ bị block nếu pipe trống).

Chúng ta cũng có thể sử dụng các hàm stdio (`printf()`, `scanf()`, v.v.) với pipe bằng cách sử dụng trước `fdopen()` để lấy một file stream tương ứng với một trong các descriptor trong `filedes` (Mục 13.7). Tuy nhiên, khi làm điều này, chúng ta phải lưu ý đến các vấn đề buffering (đệm) của stdio được mô tả trong Mục [44.6.](#page-29-0)

> Lời gọi `ioctl(fd, FIONREAD, &cnt)` trả về số lượng byte chưa đọc trong pipe hoặc FIFO được trỏ bởi file descriptor `fd`. Tính năng này cũng có sẵn trên một số implementation (bản cài đặt) khác, nhưng không được quy định trong SUSv3.

[Hình 44-2](#page-15-0) minh họa tình trạng sau khi một pipe được tạo bởi `pipe()`, với tiến trình gọi có các file descriptor trỏ đến từng đầu.

![](_page_15_Figure_9.jpeg)

**Hình 44-2:** Các file descriptor của tiến trình sau khi tạo một pipe

Một pipe có rất ít công dụng bên trong một tiến trình đơn lẻ (chúng ta sẽ xem xét một trường hợp ở Mục 63.5.2). Thông thường, chúng ta sử dụng pipe để cho phép giao tiếp giữa hai tiến trình. Để kết nối hai tiến trình sử dụng pipe, chúng ta thực hiện lời gọi `pipe()`, theo sau là lời gọi `fork()`. Trong quá trình `fork()`, tiến trình con (child process) kế thừa các bản sao file descriptor của tiến trình cha (parent process) (Mục 24.2.1), dẫn đến tình trạng được minh họa ở phía bên trái của [Hình 44-3.](#page-16-0)

![](_page_16_Figure_0.jpeg)

**Hình 44-3:** Thiết lập một pipe để truyền dữ liệu từ tiến trình cha sang tiến trình con

Mặc dù tiến trình cha và con đều có thể đọc và ghi vào pipe, nhưng điều này là không bình thường. Do đó, ngay sau lời gọi `fork()`, một tiến trình sẽ đóng descriptor của nó đối với đầu ghi của pipe, và tiến trình kia sẽ đóng descriptor đối với đầu đọc. Ví dụ, nếu tiến trình cha gửi dữ liệu cho tiến trình con, thì nó sẽ đóng descriptor đọc của pipe (`filedes[0]`), trong khi tiến trình con sẽ đóng descriptor ghi của pipe (`filedes[1]`), dẫn đến tình trạng được minh họa ở phía bên phải của [Hình 44-3](#page-16-0). Mã nguồn để thiết lập cấu hình này được thể hiện trong Liệt kê (Listing) 44-1.

**Liệt kê 44-1:** Các bước tạo pipe để truyền dữ liệu từ tiến trình cha sang tiến trình con

```
 int filedes[2];
 if (pipe(filedes) == -1) /* Tạo pipe */
 errExit("pipe");
 switch (fork()) { /* Tạo tiến trình con */
 case -1:
 errExit("fork");
 case 0: /* Tiến trình con */
 if (close(filedes[1]) == -1) /* Đóng đầu ghi không dùng đến */
 errExit("close");
 /* Tiến trình con tiến hành đọc từ pipe */
 break;
 default: /* Tiến trình cha */
 if (close(filedes[0]) == -1) /* Đóng đầu đọc không dùng đến */
 errExit("close");
 /* Tiến trình cha tiến hành ghi vào pipe */
 break;
 }
```

Một lý do khiến việc cả tiến trình cha (parent) và tiến trình con (child) cùng đọc từ một pipe duy nhất không phổ biến là nếu hai tiến trình cố gắng đọc đồng thời từ một pipe, chúng ta không thể chắc chắn tiến trình nào sẽ thành công trước—hai tiến trình này tranh chấp dữ liệu (race for data). Việc ngăn chặn các tình trạng tranh chấp (race condition) như vậy sẽ đòi hỏi phải sử dụng một cơ chế đồng bộ hóa (synchronization mechanism) nào đó. Tuy nhiên, nếu chúng ta yêu cầu giao tiếp hai chiều (bidirectional communication), có một cách đơn giản hơn: chỉ cần tạo hai pipe, mỗi pipe dùng để gửi dữ liệu theo một hướng giữa hai tiến trình. (Nếu áp dụng kỹ thuật này, chúng ta cần phải cẩn trọng với các hiện tượng bế tắc (deadlock) có thể xảy ra nếu cả hai tiến trình đều bị chặn (block) khi cố gắng đọc từ các pipe trống hoặc khi cố gắng ghi vào các pipe đã đầy).

Mặc dù việc có nhiều tiến trình cùng ghi vào một pipe là khả thi, nhưng thông thường người ta chỉ dùng một tiến trình ghi duy nhất (single writer). (Chúng tôi trình bày một ví dụ về trường hợp có nhiều tiến trình ghi vào một pipe tỏ ra hữu ích trong Mục [44.3](#page-20-1)). Ngược lại, có những tình huống mà việc có nhiều tiến trình ghi trên một FIFO rất hữu ích, và chúng ta sẽ thấy một ví dụ về điều này trong Mục [44.8.](#page-32-1)

> Bắt đầu từ phiên bản kernel 2.6.27, Linux hỗ trợ một System Call mới không theo chuẩn là `pipe2()`. System Call này thực hiện tác vụ giống như `pipe()`, nhưng hỗ trợ thêm một tham số `flags`, có thể được dùng để sửa đổi hành vi của System Call. Hai cờ (flag) được hỗ trợ. Cờ `O_CLOEXEC` khiến kernel bật cờ đóng khi thực thi (close-on-exec flag - `FD_CLOEXEC`) cho hai File Descriptor mới. Cờ này hữu ích vì những lý do tương tự như cờ `O_CLOEXEC` của hàm `open()` được mô tả trong Mục 4.3.1. Cờ `O_NONBLOCK` khiến kernel đánh dấu cả hai Mô tả File mở (open file description) bên dưới ở chế độ phi chặn (nonblocking), để các thao tác I/O trong tương lai sẽ là phi chặn. Điều này giúp tiết kiệm các lời gọi bổ sung đến `fnctl()` để đạt được cùng một kết quả.

### Pipes cho phép giao tiếp giữa các tiến trình có quan hệ họ hàng

Trong phần thảo luận từ đầu đến giờ, chúng ta đã nói về việc sử dụng pipe để giao tiếp giữa tiến trình cha và tiến trình con. Tuy nhiên, pipe có thể được sử dụng để giao tiếp giữa bất kỳ hai (hoặc nhiều) tiến trình có quan hệ họ hàng (related processes) nào, miễn là pipe đó được tạo bởi một tổ tiên chung trước chuỗi các lời gọi `fork()` dẫn đến sự tồn tại của các tiến trình đó. (Đây là điều chúng tôi muốn nói khi nhắc đến các tiến trình có quan hệ họ hàng ở đầu chương này). Ví dụ, một pipe có thể được sử dụng để giao tiếp giữa một tiến trình và tiến trình cháu (grandchild) của nó. Tiến trình đầu tiên tạo pipe, sau đó tạo tiến trình con bằng `fork()`, tiến trình con này lại tiếp tục gọi `fork()` để tạo ra tiến trình cháu. Một kịch bản phổ biến là pipe được sử dụng để giao tiếp giữa hai tiến trình anh em (sibling)—tiến trình cha tạo pipe, sau đó tạo ra hai tiến trình con. Đây là những gì shell thực hiện khi xây dựng một pipeline.

> Có một ngoại lệ đối với khẳng định rằng pipe chỉ có thể được sử dụng để giao tiếp giữa các tiến trình có quan hệ họ hàng. Việc truyền một File Descriptor thông qua một UNIX domain socket (một kỹ thuật mà chúng tôi mô tả ngắn gọn trong Mục 61.13.3) giúp cho việc truyền File Descriptor của một pipe sang một tiến trình không có quan hệ họ hàng trở nên khả thi.

## Đóng các File Descriptor của pipe không sử dụng

Việc đóng các file descriptor (mô tả tệp) của pipe không được sử dụng không chỉ đơn thuần là đảm bảo quá trình (process) không làm cạn kiệt tập hợp file descriptor bị giới hạn của nó—mà còn là điều cốt yếu để sử dụng pipe một cách chính xác. Bây giờ chúng ta sẽ xem xét lý do tại sao các file descriptor không sử dụng cho cả đầu đọc và đầu ghi của pipe đều phải được đóng lại.

Process đọc từ pipe sẽ đóng file descriptor ghi của pipe, để khi process còn lại hoàn thành việc xuất dữ liệu và đóng file descriptor ghi của nó, bên đọc sẽ nhận được dấu hiệu kết thúc tệp - end-of-file (sau khi nó đã đọc xong bất kỳ dữ liệu tồn đọng nào trong pipe).

Nếu process đọc không đóng đầu ghi của pipe, thì sau khi process kia đóng file descriptor ghi của nó, bên đọc sẽ không nhận được end-of-file, ngay cả sau khi nó đã đọc tất cả dữ liệu từ pipe. Thay vào đó, một lệnh `read()` sẽ bị chặn (block) để chờ dữ liệu, bởi vì kernel biết rằng vẫn còn ít nhất một file descriptor ghi đang được mở cho pipe. Việc file descriptor này bị giữ mở bởi chính process đọc là không quan trọng; về lý thuyết, process đó vẫn có thể ghi vào pipe, ngay cả khi nó đang bị chặn khi cố gắng đọc. Ví dụ, `read()` có thể bị ngắt bởi một trình xử lý tín hiệu (signal handler) ghi dữ liệu vào pipe. (Đây là một kịch bản thực tế, như chúng ta sẽ thấy trong Mục 63.5.2).

Process ghi sẽ đóng file descriptor đọc của pipe vì một lý do khác. Khi một process cố gắng ghi vào pipe mà không có process nào mở file descriptor đọc, kernel sẽ gửi tín hiệu `SIGPIPE` đến process ghi. Theo mặc định, tín hiệu này sẽ chấm dứt (kill) process. Thay vào đó, một process có thể sắp xếp để bắt (catch) hoặc bỏ qua tín hiệu này, trong trường hợp đó lệnh `write()` trên pipe sẽ thất bại với lỗi `EPIPE` (pipe bị hỏng). Việc nhận tín hiệu `SIGPIPE` hoặc nhận lỗi `EPIPE` là một chỉ báo hữu ích về trạng thái của pipe, và đó là lý do tại sao các file descriptor đọc không sử dụng của pipe nên được đóng lại.

> Lưu ý rằng cách xử lý đối với lệnh `write()` bị ngắt bởi một signal handler `SIGPIPE` là rất đặc biệt. Thông thường, khi một lệnh `write()` (hoặc System Call "chậm" khác) bị ngắt bởi một signal handler, lời gọi đó sẽ tự động được khởi động lại hoặc thất bại với lỗi `EINTR`, tùy thuộc vào việc handler đó được cài đặt với cờ `sigaction()` `SA_RESTART` hay không (Mục 21.5). Hành vi trong trường hợp `SIGPIPE` thì khác bởi vì việc tự động khởi động lại `write()` hay chỉ đơn giản là báo hiệu rằng `write()` đã bị ngắt bởi một handler đều không có ý nghĩa (do đó ngụ ý rằng `write()` có thể được khởi động lại thủ công một cách hữu ích). Trong cả hai trường hợp, một nỗ lực `write()` tiếp theo đều không thể thành công, bởi vì pipe vẫn sẽ bị hỏng.

Nếu process ghi không đóng đầu đọc của pipe, thì ngay cả sau khi process kia đóng đầu đọc của pipe, process ghi vẫn có thể ghi vào pipe. Cuối cùng, process ghi sẽ làm đầy pipe, và một nỗ lực ghi tiếp theo sẽ bị chặn vô thời hạn.

Một lý do cuối cùng để đóng các file descriptor không sử dụng là chỉ sau khi tất cả các file descriptor trong tất cả các process tham chiếu đến một pipe được đóng lại thì pipe mới bị hủy và các tài nguyên của nó được giải phóng để các process khác tái sử dụng. Tại thời điểm này, mọi dữ liệu chưa đọc trong pipe sẽ bị mất.

## Chương trình ví dụ

Chương trình trong [Liệt kê 44-2](#page-19-0) minh họa cách sử dụng pipe để giao tiếp giữa tiến trình cha (parent process) và tiến trình con (child process). Ví dụ này thể hiện bản chất luồng byte (byte-stream) của pipe đã đề cập trước đó—tiến trình cha ghi dữ liệu của mình trong một thao tác duy nhất, trong khi tiến trình con đọc dữ liệu từ pipe theo các khối (block) nhỏ.

Chương trình chính gọi hàm `pipe()` để tạo một pipe q, và sau đó gọi `fork()` để tạo một tiến trình con w. Sau lời gọi `fork()`, tiến trình cha đóng File Descriptor (mô tả tệp) của đầu đọc pipe i, và ghi chuỗi được truyền vào làm đối dòng lệnh (command-line argument) của chương trình vào đầu ghi của pipe o. Tiến trình cha sau đó đóng đầu đọc của pipe a, và gọi `wait()` để chờ tiến trình con kết thúc s. Sau khi đóng File Descriptor của đầu ghi pipe e, tiến trình con bước vào một vòng lặp, nơi nó đọc r các khối dữ liệu (với kích thước lên tới `BUF_SIZE` byte) từ pipe và ghi y chúng ra đầu ra chuẩn (standard output). Khi tiến trình con gặp dấu kết thúc tệp (end-of-file) trên pipe t, nó thoát khỏi vòng lặp u, ghi một ký tự xuống dòng ở cuối, đóng mô tả tệp của đầu đọc pipe, và kết thúc.

Dưới đây là một ví dụ về những gì chúng ta có thể thấy khi chạy chương trình trong Liệt kê 44-2:

```
$ ./simple_pipe 'It was a bright cold day in April, '\
'and the clocks were striking thirteen.'
It was a bright cold day in April, and the clocks were striking thirteen.
```

**Liệt kê 44-2:** Sử dụng pipe để giao tiếp giữa tiến trình cha và tiến trình con

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/simple_pipe.c
## include <sys/wait.h>
## include "tlpi_hdr.h"
## define BUF_SIZE 10
  int
  main(int argc, char *argv[])
  {
   int pfd[2]; /* Các file descriptor của pipe */
   char buf[BUF_SIZE];
   ssize_t numRead;
   if (argc != 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s string\n", argv[0]);
q if (pipe(pfd) == -1) /* Tạo pipe */
   errExit("pipe");
w switch (fork()) {
   case -1:
   errExit("fork");
   case 0: /* Tiến trình con - đọc từ pipe */
e if (close(pfd[1]) == -1) /* Đầu ghi không được sử dụng */
   errExit("close - child");
   for (;;) { /* Đọc dữ liệu từ pipe, echo ra stdout */
r numRead = read(pfd[0], buf, BUF_SIZE);
   if (numRead == -1)
   errExit("read");
t if (numRead == 0)
   break; /* End-of-file */
y if (write(STDOUT_FILENO, buf, numRead) != numRead)
   fatal("child - partial/failed write");
   }
u write(STDOUT_FILENO, "\n", 1);
   if (close(pfd[0]) == -1)
   errExit("close");
   _exit(EXIT_SUCCESS);
   default: /* Tiến trình cha - ghi vào pipe */
i if (close(pfd[0]) == -1) /* Đầu đọc không được sử dụng */
   errExit("close - parent");
```

```
o if (write(pfd[1], argv[1], strlen(argv[1])) != strlen(argv[1]))
   fatal("parent - partial/failed write");
a if (close(pfd[1]) == -1) /* Tiến trình con sẽ nhìn thấy EOF */
   errExit("close");
s wait(NULL); /* Chờ tiến trình con hoàn tất */
   exit(EXIT_SUCCESS);
   }
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/simple_pipe.c
```

## 44.3 Pipe như một phương pháp đồng bộ hóa tiến trình (Process Synchronization)

Trong Mục 24.5, chúng ta đã xem xét cách các tín hiệu (signal) có thể được sử dụng để đồng bộ hóa các hành động của tiến trình cha và tiến trình con nhằm tránh tình trạng tranh chấp dữ liệu (Race Condition). Pipe có thể được sử dụng để đạt được kết quả tương tự, như được minh họa bởi chương trình khung trong [Liệt kê 44-3.](#page-20-2) Chương trình này tạo ra nhiều tiến trình con (mỗi tiến trình tương ứng với một đối số dòng lệnh), mỗi tiến trình được định hướng để thực hiện một hành động nào đó, được mô phỏng trong chương trình ví dụ bằng cách cho tạm dừng (sleep) trong một khoảng thời gian. Tiến trình cha chờ đợi cho đến khi tất cả các tiến trình con hoàn thành hành động của chúng.

Để thực hiện việc đồng bộ hóa, tiến trình cha tạo một pipe q trước khi tạo ra các tiến trình con w. Mỗi tiến trình con kế thừa một File Descriptor trỏ đến đầu ghi của pipe và đóng mô tả tệp này ngay khi nó hoàn thành hành động của mình e. Sau khi tất cả các tiến trình con đã đóng File Descriptor trỏ đến đầu ghi của pipe, lời gọi `read()` t của tiến trình cha từ pipe sẽ hoàn thành, trả về dấu kết thúc tệp (0). Tại thời điểm này, tiến trình cha có thể tự do tiếp tục thực hiện các công việc khác. (Lưu ý rằng việc đóng đầu ghi không sử dụng của pipe trong tiến trình cha r là tối quan trọng đối với hoạt động chính xác của kỹ thuật này; nếu không, tiến trình cha sẽ bị chặn (block) vĩnh viễn khi cố gắng đọc từ pipe).

Dưới đây là một ví dụ về những gì chúng ta thấy khi sử dụng chương trình trong Liệt kê 44-3 để tạo ra ba tiến trình con tạm dừng lần lượt trong 4, 2 và 6 giây:

```
$ ./pipe_sync 4 2 6
08:22:16 Parent started
08:22:18 Child 2 (PID=2445) closing pipe
08:22:20 Child 1 (PID=2444) closing pipe
08:22:22 Child 3 (PID=2446) closing pipe
08:22:22 Parent ready to go
```

**Liệt kê 44-3:** Sử dụng pipe để đồng bộ hóa nhiều tiến trình

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/pipe_sync.c
## include "curr_time.h" /* Khai báo hàm currTime() */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int pfd[2]; /* Pipe đồng bộ hóa tiến trình */
 int j, dummy;
```

```c
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s sleep-time...\n", argv[0]);
   setbuf(stdout, NULL); /* Đặt stdout thành không có bộ đệm (unbuffered), vì chúng ta
   kết thúc tiến trình con (child process) bằng _exit() */
   printf("%s Parent started\n", currTime("%T"));
q if (pipe(pfd) == -1)
   errExit("pipe");
   for (j = 1; j < argc; j++) {
w switch (fork()) {
   case -1:
   errExit("fork %d", j);
   case 0: /* Tiến trình con (Child) */
   if (close(pfd[0]) == -1) /* Đầu đọc không được sử dụng */
   errExit("close");
   /* Tiến trình con thực hiện một số công việc, và báo cho tiến trình cha (parent) biết là đã hoàn thành */
   sleep(getInt(argv[j], GN_NONNEG, "sleep-time"));
   /* Giả lập quá trình xử lý */
   printf("%s Child %d (PID=%ld) closing pipe\n",
   currTime("%T"), j, (long) getpid());
e if (close(pfd[1]) == -1)
   errExit("close");
   /* Tiến trình con bây giờ tiếp tục làm các việc khác... */
   _exit(EXIT_SUCCESS);
   default: /* Tiến trình cha lặp để tạo tiến trình con tiếp theo */
   break;
   }
   }
   /* Tiến trình cha đến đây; đóng đầu ghi của pipe để chúng ta có thể thấy EOF */
r if (close(pfd[1]) == -1) /* Đầu ghi không được sử dụng */
   errExit("close");
   /* Tiến trình cha có thể làm việc khác, sau đó đồng bộ hóa với các tiến trình con */
t if (read(pfd[0], &dummy, 1) != 0)
   fatal("parent didn't get EOF");
   printf("%s Parent ready to go\n", currTime("%T"));
   /* Tiến trình cha giờ đây có thể tiếp tục làm các việc khác... */
   exit(EXIT_SUCCESS);
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/pipe_sync.c
```

Việc đồng bộ hóa sử dụng pipe có một ưu điểm so với ví dụ trước đó về đồng bộ hóa sử dụng tín hiệu (signal): nó có thể được sử dụng để điều phối các hành động của một tiến trình với nhiều tiến trình khác (có quan hệ họ hàng). Thực tế là nhiều tín hiệu (chuẩn) không thể được xếp hàng đợi (queue) khiến cho tín hiệu không phù hợp trong trường hợp này. (Ngược lại, tín hiệu có ưu điểm là chúng có thể được quảng bá (broadcast) bởi một tiến trình tới tất cả các thành viên trong một nhóm tiến trình - process group.)

Các cấu trúc topology đồng bộ hóa khác là khả thi (ví dụ: sử dụng nhiều pipe). Hơn nữa, kỹ thuật này có thể được mở rộng sao cho, thay vì đóng pipe, mỗi tiến trình con ghi một thông điệp vào pipe chứa mã định danh tiến trình (process ID) và một số thông tin trạng thái. Ngoài ra, mỗi tiến trình con có thể ghi một byte đơn vào pipe. Tiến trình cha sau đó có thể đếm và phân tích các thông điệp này. Cách tiếp cận này giúp phòng ngừa khả năng tiến trình con vô tình chấm dứt (terminating) thay vì đóng pipe một cách rõ ràng.

## 44.4 Sử dụng Pipe để Kết nối các Bộ lọc (Filters)

Khi một pipe được tạo, các bộ mô tả tệp (File Descriptor) được sử dụng cho hai đầu của pipe là các bộ mô tả có giá trị số thấp nhất tiếp theo khả dụng. Vì trong điều kiện bình thường, các bộ mô tả 0, 1 và 2 đã được sử dụng cho một tiến trình, nên một số bộ mô tả có số thứ tự cao hơn sẽ được cấp phát cho pipe. Vậy làm thế nào để chúng ta đạt được tình huống hiển thị trong [Hình 44-1,](#page-13-0) nơi hai bộ lọc (tức là các chương trình đọc từ `stdin` và ghi vào `stdout`) được kết nối bằng một pipe, sao cho đầu ra chuẩn (standard output) của một chương trình được chuyển hướng vào pipe và đầu vào chuẩn (standard input) của chương trình kia được lấy từ pipe? Và cụ thể hơn, làm thế nào chúng ta có thể làm điều này mà không cần sửa đổi mã nguồn của chính các bộ lọc đó?

Câu trả lời là sử dụng các kỹ thuật được mô tả trong Mục 5.5 để nhân bản bộ mô tả tệp (duplicating file descriptors). Theo truyền thống, chuỗi lệnh gọi sau đây đã được sử dụng để đạt được kết quả mong muốn:

```c
int pfd[2];
pipe(pfd); /* Cấp phát (giả sử) bộ mô tả tệp 3 và 4 cho pipe */
/* Các bước khác ở đây, ví dụ: fork() */
close(STDOUT_FILENO); /* Giải phóng bộ mô tả tệp 1 */
dup(pfd[1]); /* Việc nhân bản sử dụng bộ mô tả tệp
 trống thấp nhất, tức là fd 1 */
```

Kết quả cuối cùng của các bước trên là đầu ra chuẩn của tiến trình được gắn với đầu ghi của pipe. Một tập hợp các lệnh gọi tương ứng có thể được sử dụng để gắn đầu vào chuẩn của tiến trình vào đầu đọc của pipe.

Lưu ý rằng các bước này phụ thuộc vào giả định rằng các bộ mô tả tệp 0, 1 và 2 của một tiến trình đã được mở. (Shell thường đảm bảo điều này cho mỗi chương trình mà nó thực thi.) Nếu bộ mô tả tệp 0 đã bị đóng trước các bước trên, thì chúng ta sẽ vô tình gắn đầu vào chuẩn của tiến trình vào đầu ghi của pipe. Để tránh khả năng này, chúng ta có thể thay thế các lệnh gọi `close()` và `dup()` bằng lệnh gọi `dup2()` sau đây, cho phép chúng ta chỉ định rõ ràng bộ mô tả sẽ được gắn vào đầu pipe:

```c
dup2(pfd[1], STDOUT_FILENO); /* Đóng bộ mô tả 1, và mở lại gắn
 vào đầu ghi của pipe */
```

Sau khi nhân bản `pfd[1]`, bây giờ chúng ta có hai bộ mô tả tệp trỏ đến đầu ghi của pipe: bộ mô tả 1 và `pfd[1]`. Vì các bộ mô tả tệp pipe không sử dụng nên được đóng lại, sau lệnh gọi `dup2()`, chúng ta đóng bộ mô tả thừa:

```c
close(pfd[1]);
```

Mã nguồn mà chúng ta đã trình bày cho đến nay dựa trên giả định rằng đầu ra chuẩn đã được mở trước đó. Giả sử rằng, trước lệnh gọi `pipe()`, cả đầu vào chuẩn và đầu ra chuẩn đều đã bị đóng. Trong trường hợp này, `pipe()` sẽ cấp phát hai bộ mô tả này cho pipe, có thể với `pfd[0]` có giá trị 0 và `pfd[1]` có giá trị 1. Do đó, các lệnh gọi `dup2()` và `close()` trước đó sẽ tương đương với các lệnh sau:

```
dup2(1, 1); /* Không làm gì cả */
close(1); /* Đóng mô tả tệp duy nhất cho đầu ghi của pipe */
```

Do đó, một thực hành lập trình phòng thủ (defensive programming) tốt là bọc các lời gọi này trong một câu lệnh `if` có dạng sau:

```
if (pfd[1] != STDOUT_FILENO) {
 dup2(pfd[1], STDOUT_FILENO);
 close(pfd[1]);
}
```

### Chương trình ví dụ

Chương trình trong [Liệt kê 44-4](#page-23-0) sử dụng các kỹ thuật được mô tả trong phần này để thiết lập cấu hình được thể hiện ở [Hình 44-1](#page-13-0). Sau khi tạo một pipe, chương trình này tạo ra hai tiến trình con (child process). Tiến trình con đầu tiên liên kết đầu ra chuẩn (standard output) của nó với đầu ghi của pipe và sau đó thực thi lệnh `ls` thông qua `exec`. Tiến trình con thứ hai liên kết đầu vào chuẩn (standard input) của nó với đầu đọc của pipe và sau đó thực thi lệnh `wc` thông qua `exec`.

**Liệt kê 44-4:** Sử dụng một pipe để kết nối `ls` và `wc`

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/pipe_ls_wc.c
## include <sys/wait.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int pfd[2]; /* Các file descriptor của pipe */
 if (pipe(pfd) == -1) /* Tạo pipe */
 errExit("pipe");
 switch (fork()) {
 case -1:
 errExit("fork");
 case 0: /* Tiến trình con thứ nhất: exec 'ls' để ghi vào pipe */
 if (close(pfd[0]) == -1) /* Đầu đọc không được sử dụng */
 errExit("close 1");
```

```
 /* Nhân bản stdout vào đầu ghi của pipe; đóng mô tả tệp đã được nhân bản */
 if (pfd[1] != STDOUT_FILENO) { /* Kiểm tra phòng thủ */
 if (dup2(pfd[1], STDOUT_FILENO) == -1)
 errExit("dup2 1");
 if (close(pfd[1]) == -1)
 errExit("close 2");
 }
 execlp("ls", "ls", (char *) NULL); /* Ghi vào pipe */
 errExit("execlp ls");
 default: /* Tiến trình cha rơi xuống dưới để tạo tiến trình con tiếp theo */
 break;
 }
 switch (fork()) {
 case -1:
 errExit("fork");
 case 0: /* Tiến trình con thứ hai: exec 'wc' để đọc từ pipe */
 if (close(pfd[1]) == -1) /* Đầu ghi không được sử dụng */
 errExit("close 3");
 /* Nhân bản stdin vào đầu đọc của pipe; đóng mô tả tệp đã được nhân bản */
 if (pfd[0] != STDIN_FILENO) { /* Kiểm tra phòng thủ */
 if (dup2(pfd[0], STDIN_FILENO) == -1)
 errExit("dup2 2");
 if (close(pfd[0]) == -1)
 errExit("close 4");
 }
 execlp("wc", "wc", "-l", (char *) NULL); /* Đọc từ pipe */
 errExit("execlp wc");
 default: /* Tiến trình cha rơi xuống dưới */
 break;
 }
 /* Tiến trình cha đóng các file descriptor không sử dụng của pipe, và chờ các tiến trình con */
 if (close(pfd[0]) == -1)
 errExit("close 5");
 if (close(pfd[1]) == -1)
 errExit("close 6");
 if (wait(NULL) == -1)
 errExit("wait 1");
 if (wait(NULL) == -1)
 errExit("wait 2");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/pipe_ls_wc.c
```

Khi chúng ta chạy chương trình trong Liệt kê 44-4, chúng ta thấy kết quả sau:

## 44.5 Giao tiếp với một lệnh Shell thông qua Pipe: `popen()`

Một mục đích sử dụng phổ biến của pipe là thực thi một lệnh shell (shell command) và hoặc đọc đầu ra của nó hoặc gửi một số đầu vào cho nó. Các hàm *popen()* và *pclose()* được cung cấp để đơn giản hóa tác vụ này.

```
## include <stdio.h>
FILE *popen(const char *command, const char *mode);
```

Hàm *popen()* tạo một pipe, sau đó tạo một tiến trình con thực thi một shell, shell này lại tiếp tục tạo một tiến trình con để thực thi chuỗi lệnh được truyền vào trong *command*. Đối số *mode* là một chuỗi xác định xem tiến trình gọi sẽ đọc từ pipe (*mode* là *r*) hay ghi vào pipe (*mode* là *w*). (Vì pipe là một chiều - unidirectional, nên không thể giao tiếp hai chiều với *command* được thực thi.) Giá trị của *mode* xác định xem đầu ra chuẩn của lệnh được thực thi có được kết nối với đầu ghi của pipe hay đầu vào chuẩn của nó được kết nối với đầu đọc của pipe, như được thể hiện ở Hình 44-4.

![](_page_25_Figure_6.jpeg)

**Hình 44-4:** Tổng quan về mối quan hệ giữa các tiến trình và việc sử dụng pipe cho *popen()*

Khi thành công, `popen()` trả về một con trỏ luồng tệp (file stream pointer) có thể được sử dụng với các hàm thư viện *stdio*. Nếu xảy ra lỗi (ví dụ: *mode* không phải là `r` hoặc `w`, việc tạo pipe thất bại, hoặc lời gọi `fork()` để tạo tiến trình con thất bại), thì `popen()` trả về `NULL` và thiết lập `errno` để chỉ ra nguyên nhân gây ra lỗi.

Sau lời gọi *popen()*, tiến trình gọi sử dụng pipe để đọc đầu ra của *command* hoặc gửi đầu vào cho nó. Giống như các pipe được tạo bằng *pipe()*, khi đọc từ pipe, tiến trình gọi sẽ gặp phải dấu hiệu kết thúc tệp (end-of-file) một khi *command* đã đóng đầu ghi của pipe; khi ghi vào pipe, nó sẽ nhận được một tín hiệu `SIGPIPE` và nhận lỗi `EPIPE` nếu command đã đóng đầu đọc của pipe.

Một khi quá trình I/O hoàn tất, hàm `pclose()` được sử dụng để đóng pipe và chờ tiến trình shell con chấm dứt. (Không nên sử dụng hàm `fclose()`, vì nó không chờ tiến trình con.) Khi thành công, `pclose()` trả về trạng thái kết thúc (termination status) (Mục 26.1.3) của shell con (đó là trạng thái kết thúc của lệnh cuối cùng mà shell đã thực thi, trừ khi shell bị tiêu diệt bởi một tín hiệu). Giống như `system()` (Mục 27.6), nếu một shell không thể được thực thi (`execed`), thì `pclose()` trả về một giá trị giống như thể shell con đã kết thúc với lời gọi `_exit(127)`. Nếu một số lỗi khác xảy ra, `pclose()` trả về –1. Một lỗi có thể xảy ra là trạng thái kết thúc không thể được thu thập. Chúng tôi sẽ giải thích điều này có thể xảy ra như thế nào ngay sau đây.

```

Khi thực hiện thao tác chờ để lấy trạng thái của shell con (child shell), SUSv3 yêu cầu `pclose()`, giống như `system()`, phải tự động khởi động lại lệnh gọi bên trong tới `waitpid()` nếu lệnh gọi đó bị gián đoạn bởi một trình xử lý tín hiệu (signal handler).

Nhìn chung, chúng ta có thể đưa ra các nhận định tương tự đối với `popen()` như đã nêu trong Mục 27.6 đối với `system()`. Sử dụng `popen()` mang lại sự tiện lợi. Nó tự động tạo pipe (đường ống), thực hiện nhân bản bộ mô tả (descriptor duplication), đóng các bộ mô tả không sử dụng, và xử lý tất cả các chi tiết của `fork()` và `exec()` thay cho chúng ta. Ngoài ra, việc xử lý shell cũng được thực hiện trên câu lệnh. Sự tiện lợi này phải đánh đổi bằng hiệu năng. Ít nhất hai tiến trình (process) bổ sung phải được tạo ra: một cho shell và một hoặc nhiều tiến trình cho (các) câu lệnh được thực thi bởi shell. Giống như `system()`, không bao giờ được sử dụng `popen()` trong các chương trình có đặc quyền (privileged program).

Mặc dù có một số điểm tương đồng giữa `system()` và `popen()` kết hợp với `pclose()`, nhưng cũng có những điểm khác biệt đáng kể. Điều này xuất phát từ thực tế là, với `system()`, việc thực thi lệnh shell được đóng gói gọn trong một lời gọi hàm duy nhất, trong khi với `popen()`, tiến trình gọi (calling process) chạy song song với lệnh shell và sau đó gọi `pclose()`. Các điểm khác biệt cụ thể như sau:

- Vì tiến trình gọi và lệnh được thực thi hoạt động song song, SUSv3 yêu cầu `popen()` không được bỏ qua `SIGINT` và `SIGQUIT`. Nếu được sinh ra từ bàn phím, các tín hiệu này sẽ được gửi tới cả tiến trình gọi và lệnh đang thực thi. Hiện tượng này xảy ra vì cả hai tiến trình đều nằm trong cùng một nhóm tiến trình (process group), và các tín hiệu do terminal sinh ra sẽ được gửi tới tất cả các thành viên của nhóm tiến trình (tiền cảnh - foreground), như đã mô tả trong Mục 34.5.
- Vì tiến trình gọi có thể tạo ra các tiến trình con khác trong khoảng thời gian giữa việc thực thi `popen()` và `pclose()`, SUSv3 yêu cầu `popen()` không được chặn `SIGCHLD`. Điều này có nghĩa là nếu tiến trình gọi thực hiện thao tác chờ (wait operation) trước lời gọi `pclose()`, nó có thể thu hồi trạng thái của tiến trình con do `popen()` tạo ra. Trong trường hợp này, khi `pclose()` được gọi sau đó, nó sẽ trả về `-1` và `errno` được đặt thành `ECHILD`, cho biết rằng `pclose()` không thể thu hồi trạng thái của tiến trình con nữa.

## Chương trình ví dụ

[Liệt kê 44-5](#page-27-0) minh họa việc sử dụng `popen()` và `pclose()`. Chương trình này liên tục đọc một mẫu ký tự đại diện (wildcard pattern) tên tệp `w`, sau đó sử dụng `popen()` để nhận kết quả từ việc chuyển mẫu này sang lệnh `ls` `t`. (Các kỹ thuật tương tự như thế này từng được sử dụng trên các phiên bản UNIX cũ để thực hiện việc tạo tên tệp, còn được gọi là globbing, trước khi hàm thư viện `glob()` ra đời.)

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/popen_glob.c

## include <ctype.h>

## include <limits.h>

## include "print_wait_status.h" /* For printWaitStatus() */

## include "tlpi_hdr.h"

q #define POPEN_FMT "/bin/ls -d %s 2> /dev/null"

## define PAT_SIZE 50

## define PCMD_BUF_SIZE (sizeof(POPEN_FMT) + PAT_SIZE)

int
main(int argc, char *argv[])
{
char pat[PAT_SIZE]; /* Pattern for globbing */
char popenCmd[PCMD_BUF_SIZE];
FILE *fp; /* File stream returned by popen() */
Boolean badPattern; /* Invalid characters in 'pat'? */
int len, status, fileCnt, j;
char pathname[PATH_MAX];
for (;;) { /* Read pattern, display results of globbing */
printf("pattern: ");
fflush(stdout);
w if (fgets(pat, PAT_SIZE, stdin) == NULL)
break; /* EOF */
len = strlen(pat);
if (len <= 1) /* Empty line */
continue;
if (pat[len - 1] == '\n') /* Strip trailing newline */
pat[len - 1] = '\0';
/* Ensure that the pattern contains only valid characters,
i.e., letters, digits, underscore, dot, and the shell
globbing characters. (Our definition of valid is more
restrictive than the shell, which permits other characters
to be included in a filename if they are quoted.) */
e for (j = 0, badPattern = FALSE; j < len && !badPattern; j++)
if (!isalnum((unsigned char) pat[j]) &&
strchr("_*?[^-].", pat[j]) == NULL)
badPattern = TRUE;
if (badPattern) {
printf("Bad pattern character: %c\n", pat[j - 1]);
continue;
}
/* Build and execute command to glob 'pat' */
r snprintf(popenCmd, PCMD_BUF_SIZE, POPEN_FMT, pat);
popenCmd[PCMD_BUF_SIZE - 1] = '\0'; /* Ensure string is
null-terminated */

```

```

t fp = popen(popenCmd, "r");
if (fp == NULL) {
printf("popen() failed\n");
continue;
}
/* Read resulting list of pathnames until EOF */
fileCnt = 0;
while (fgets(pathname, PATH_MAX, fp) != NULL) {
printf("%s", pathname);
fileCnt++;
}
/* Close pipe, fetch and display termination status */
status = pclose(fp);
printf(" %d matching file%s\n", fileCnt, (fileCnt != 1) ? "s" : "");
printf(" pclose() status == %#x\n", (unsigned int) status);
if (status != -1)
printWaitStatus("\t", status);
}
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/popen_glob.c

```

Phiên làm việc shell dưới đây minh họa việc sử dụng chương trình trong [Listing 44-5.](#page-27-0) Trong ví dụ này, trước tiên chúng ta cung cấp một mẫu (pattern) khớp với hai tên tệp, và sau đó là một mẫu không khớp với tên tệp nào:

```

$ ./popen_glob
pattern: popen_glob* Matches two filenames
popen_glob
popen_glob.c
2 matching files
pclose() status = 0
child exited, status=0
pattern: x* Matches no filename
0 matching files
pclose() status = 0x100 ls(1) exits with status 1
child exited, status=1
pattern: ^D$ Type Control-D to terminate

```

Việc xây dựng lệnh `qr` để thực hiện globbing trong [Listing 44-5](#page-27-0) đòi hỏi một số giải thích. Thao tác globbing thực tế của một mẫu được thực hiện bởi shell. Lệnh `ls` đơn thuần chỉ được sử dụng để liệt kê các tên tệp khớp, mỗi tên trên một dòng. Chúng ta có thể thử sử dụng lệnh `echo` thay thế, nhưng điều này sẽ dẫn đến một kết quả không mong muốn là nếu một mẫu không khớp với tên tệp nào, thì shell sẽ giữ nguyên mẫu đó, và `echo` sẽ đơn giản hiển thị lại mẫu. Ngược lại, nếu `ls` nhận được tên của một tệp không tồn tại, nó sẽ in ra một thông báo lỗi trên stderr (mà chúng ta loại bỏ bằng cách chuyển hướng stderr sang `/dev/null`), không in gì trên stdout, và thoát với trạng thái là `1`.

Cũng cần lưu ý về việc kiểm tra đầu vào được thực hiện trong [Listing 44-5](#page-27-0). Việc này được thực hiện nhằm ngăn chặn đầu vào không hợp lệ khiến hàm `popen()` thực thi một lệnh shell bất ngờ. Giả sử các bước kiểm tra này bị bỏ qua và người dùng nhập vào đầu vào sau:

```

pattern: ; rm *

```

Chương trình sau đó sẽ truyền lệnh sau cho `popen()`, dẫn đến những hậu quả thảm khốc:

```

/bin/ls -d ; rm * 2> /dev/null

```

Việc kiểm tra đầu vào như vậy luôn được yêu cầu trong các chương trình sử dụng `popen()` (hoặc `system()`) để thực thi một lệnh shell được xây dựng từ đầu vào của người dùng. (Một giải pháp thay thế là ứng dụng thực hiện quote (đặt trong dấu nháy) bất kỳ ký tự nào khác ngoài những ký tự đang được kiểm tra, để các ký tự đó không bị shell xử lý đặc biệt).

## 44.6 Pipes và stdio Buffering

Vì con trỏ luồng tệp (file stream pointer) được trả về bởi một lời gọi đến `popen()` không trỏ tới một thiết bị terminal, thư viện stdio áp dụng cơ chế đệm khối (block buffering) cho luồng tệp (Mục 13.2). Điều này có nghĩa là khi chúng ta gọi `popen()` với chế độ `w` (ghi), theo mặc định, dữ liệu đầu ra chỉ được gửi đến tiến trình con (child process) ở đầu bên kia của ống dẫn (pipe) khi bộ đệm stdio (stdio buffer) bị đầy hoặc khi chúng ta đóng ống dẫn bằng `pclose()`. Trong nhiều trường hợp, điều này không gây ra vấn đề gì. Tuy nhiên, nếu chúng ta cần đảm bảo rằng tiến trình con nhận được dữ liệu trên ống dẫn ngay lập tức, chúng ta có thể sử dụng các lời gọi định kỳ tới `fflush()` hoặc vô hiệu hóa bộ đệm stdio bằng cách sử dụng lời gọi `setbuf(fp, NULL)`. Kỹ thuật này cũng có thể được sử dụng nếu chúng ta tạo một ống dẫn bằng System Call `pipe()` và sau đó sử dụng `fdopen()` để lấy một luồng stdio tương ứng với đầu ghi của ống dẫn.

Nếu tiến trình gọi `popen()` đang đọc từ ống dẫn (nghĩa là chế độ là `r`), mọi thứ có thể không đơn giản như vậy. Trong trường hợp này, nếu tiến trình con đang sử dụng thư viện stdio — trừ khi nó bao gồm các lời gọi tường minh đến `fflush()` hoặc `setbuf()` — đầu ra của nó sẽ chỉ khả dụng cho tiến trình gọi khi tiến trình con làm đầy bộ đệm stdio hoặc gọi `fclose()`. (Tuyên bố tương tự cũng áp dụng nếu chúng ta đang đọc từ một ống dẫn được tạo bằng `pipe()` và tiến trình ghi ở đầu bên kia đang sử dụng thư viện stdio). Nếu đây là một vấn đề, chúng ta có thể làm rất ít trừ khi chúng ta có thể sửa đổi mã nguồn (source code) của chương trình đang chạy trong tiến trình con để bổ sung các lời gọi đến `setbuf()` hoặc `fflush()`.

Nếu việc sửa đổi mã nguồn không khả thi, thì thay vì sử dụng một ống dẫn (pipe), chúng ta có thể sử dụng một pseudo-terminal (thiết bị đầu cuối giả). Một pseudo-terminal là một kênh IPC xuất hiện đối với tiến trình ở một đầu giống như thể nó là một terminal. Do đó, thư viện stdio thực hiện đệm dòng (line buffers) đối với đầu ra. Chúng ta sẽ mô tả các pseudo-terminal trong Chương 64.

## 44.7 FIFOs

Về mặt ngữ nghĩa, một FIFO tương tự như một pipe. Sự khác biệt chính là một FIFO có một tên nằm trong hệ thống tệp (file system) và được mở theo cách giống như một tệp thông thường. Điều này cho phép một FIFO được sử dụng để giao tiếp giữa các tiến trình không có quan hệ họ hàng (ví dụ: một client và một server).

Một khi một FIFO đã được mở, chúng ta sử dụng các System Call I/O giống như được sử dụng với pipe và các tệp khác (nghĩa là `read()`, `write()`, và `close()`). Giống như đối với pipe, một FIFO có đầu ghi (write end) và đầu đọc (read end), và dữ liệu được đọc từ FIFO theo đúng thứ tự mà nó được ghi vào. Thực tế này mang lại cái tên cho FIFO: vào trước, ra trước (first in, first out). FIFO đôi khi cũng được gọi là named pipes (ống dẫn có tên).

Giống như đối với pipe, khi tất cả các File Descriptor trỏ đến một FIFO đã bị đóng, bất kỳ dữ liệu nào còn sót lại sẽ bị hủy bỏ.

Chúng ta có thể tạo một FIFO từ shell bằng cách sử dụng lệnh `mkfifo`:

```

$ mkfifo [ -m mode ] pathname

```

`pathname` là tên của FIFO cần tạo, và tùy chọn `-m` được sử dụng để chỉ định quyền hạn (permission mode) theo cách giống như đối với lệnh `chmod`.

Khi được áp dụng cho một FIFO (hoặc pipe), các hàm `fstat()` và `stat()` trả về loại tệp (file type) là `S_IFIFO` trong trường `st_mode` của cấu trúc `stat` (Mục 15.1). Khi được liệt kê bằng lệnh `ls -l`, một FIFO hiển thị với loại `p` ở cột đầu tiên, và `ls -F` thêm ký hiệu ống dẫn (`|`) vào tên đường dẫn của FIFO.

Hàm `mkfifo()` tạo ra một FIFO mới với tên đường dẫn (pathname) được chỉ định.

```c

## include <sys/stat.h>

int mkfifo(const char *pathname, mode_t mode);
Trả về 0 khi thành công, hoặc –1 khi có lỗi

```

Tham số `mode` chỉ định các quyền hạn (permissions) cho FIFO mới. Các quyền này được chỉ định bằng cách kết hợp các hằng số từ Bảng 15-4 (ở trang 295) thông qua phép toán OR. Như thường lệ, các quyền này sẽ được lọc (masked) với giá trị `umask` của tiến trình (Process) (Mục 15.4.6).

> Về mặt lịch sử, các FIFO được tạo ra bằng cách sử dụng System Call `mknod(pathname, S_IFIFO, 0)`. Chuẩn POSIX.1-1990 đã định nghĩa `mkfifo()` như một API đơn giản hơn nhằm tránh tính tổng quát quá mức của `mknod()`, vốn cho phép tạo ra nhiều loại tệp khác nhau, bao gồm cả tệp thiết bị (device files). (SUSv3 có quy định về `mknod()`, nhưng ở mức độ không bắt buộc chặt chẽ, chỉ định nghĩa việc sử dụng nó để tạo các FIFO). Hầu hết các cài đặt UNIX đều cung cấp `mkfifo()` dưới dạng một hàm thư viện (library function) được xây dựng dựa trên `mknod()`.

Một khi một FIFO đã được tạo, bất kỳ tiến trình (Process) nào cũng có thể mở nó, tuân theo các kiểm tra quyền truy cập tệp thông thường (Mục 15.4.3).

Việc mở một FIFO có ngữ nghĩa (semantics) khá khác thường. Nhìn chung, cách sử dụng hợp lý duy nhất của một FIFO là có một tiến trình đọc và một tiến trình viết ở mỗi đầu. Do đó, theo mặc định, việc mở một FIFO để đọc (với cờ `open()` `O_RDONLY`) sẽ bị chặn (blocks) cho đến khi một tiến trình khác mở FIFO đó để viết (với cờ `open()` `O_WRONLY`). Ngược lại, việc mở FIFO để viết sẽ bị chặn cho đến khi một tiến trình khác mở FIFO để đọc. Nói cách khác, việc mở một FIFO sẽ đồng bộ hóa (synchronizes) các tiến trình đọc và viết. Nếu đầu đối diện của FIFO đã được mở (có thể do một cặp tiến trình đã mở sẵn mỗi đầu của FIFO), thì `open()` sẽ thành công ngay lập tức.

Dưới hầu hết các hệ thống cài đặt UNIX (bao gồm cả Linux), có thể lách qua hành vi chặn (blocking behavior) khi mở FIFO bằng cách chỉ định cờ `O_RDWR` khi mở. Trong trường hợp này, `open()` trả về ngay lập tức với một File Descriptor (mô tả tệp) có thể dùng để đọc và viết trên FIFO. Làm như vậy sẽ phần nào phá vỡ mô hình I/O của FIFO, và chuẩn SUSv3 lưu ý rõ ràng rằng việc mở một FIFO với cờ `O_RDWR` là không được định nghĩa chuẩn hóa (unspecified); do đó, vì lý do khả chuyển (portability), kỹ thuật này nên tránh. Trong các trường hợp chúng ta cần ngăn chặn việc bị treo (blocking) khi mở một FIFO, cờ `open()` `O_NONBLOCK` cung cấp một phương pháp chuẩn hóa để làm điều đó (tham khảo Mục [44.9](#page-38-0)).

> Việc tránh sử dụng cờ `O_RDWR` khi mở một FIFO còn có thể hữu ích vì một lý do khác. Sau một lần mở như vậy, tiến trình gọi sẽ không bao giờ nhìn thấy tín hiệu kết thúc tệp (end-of-file) khi đọc từ File Descriptor kết quả, bởi vì sẽ luôn có ít nhất một Descriptor đang mở để viết vào FIFO—chính là Descriptor mà tiến trình đang dùng để đọc.

## Sử dụng FIFO và lệnh tee(1) để tạo một đường ống kép (dual pipeline)

Một trong những đặc điểm của các đường ống (shell pipeline) là tính tuần tự; mỗi tiến trình (process) trong đường ống đọc dữ liệu do tiến trình đứng trước nó tạo ra và gửi dữ liệu tới tiến trình đứng sau nó. Bằng cách sử dụng FIFO, chúng ta có thể tạo ra một điểm rẽ nhánh trong một đường ống, sao cho một bản sao dữ liệu đầu ra của một tiến trình sẽ được gửi đến một tiến trình khác bên cạnh tiến trình kế tiếp trong đường ống. Để làm được điều này, chúng ta cần sử dụng lệnh `tee`, lệnh này ghi lại hai bản sao của dữ liệu mà nó đọc từ đầu vào chuẩn (standard input): một bản được ghi ra đầu ra chuẩn (standard output) và bản còn lại được ghi vào tệp được chỉ định trong đối số dòng lệnh của nó.

Việc truyền đối số tệp cho `tee` là một FIFO cho phép chúng ta có hai tiến trình cùng lúc đọc bản sao đầu ra do `tee` tạo ra. Chúng ta minh họa điều này trong phiên làm việc với shell sau đây, trong đó tạo một FIFO có tên là `myfifo`, khởi chạy một lệnh `wc` chạy nền (background) để mở FIFO ở chế độ đọc (thao tác này sẽ bị chặn [block] cho đến khi FIFO được mở ở chế độ ghi), và sau đó thực thi một đường ống gửi đầu ra của `ls` tới `tee`, vừa chuyển tiếp đầu ra xuống phần sau của đường ống tới `sort` vừa gửi nó tới FIFO `myfifo`. (Tùy chọn `-k5n` cho lệnh `sort` khiến cho đầu ra của `ls` được sắp xếp theo thứ tự tăng dần về mặt số học dựa trên trường thứ năm phân tách bằng khoảng trắng).

```

$ mkfifo myfifo
$ wc -l < myfifo &
$ ls -l | tee myfifo | sort -k5n
(Kết quả đầu ra không được hiển thị)

```

Về mặt sơ đồ, các lệnh trên tạo ra tình huống được minh họa trong [Hình 44-5.](#page-31-0)

Chương trình `tee` được đặt tên như vậy là do hình dạng của nó. Chúng ta có thể coi `tee` hoạt động tương tự như một đường ống (pipe), nhưng có thêm một nhánh phụ để gửi bản sao đầu ra. Về mặt sơ đồ, nó có hình dạng của một chữ cái in hoa T (xem [Hình 44-5\)](#page-31-0). Ngoài mục đích được mô tả ở đây, `tee` cũng rất hữu ích trong việc gỡ lỗi (debugging) các đường ống và lưu lại kết quả được tạo ra tại một điểm trung gian nào đó trong một đường ống phức tạp.

![](_page_31_Figure_8.jpeg)

**Hình 44-5:** Sử dụng FIFO và lệnh tee(1) để tạo một đường ống kép (dual pipeline)

## 44.8 Ứng dụng Client-Server sử dụng FIFO

Trong phần này, chúng ta sẽ trình bày một ứng dụng client-server đơn giản sử dụng FIFO để giao tiếp liên tiến trình (IPC - Interprocess Communication). Server cung cấp một dịch vụ (mang tính chất minh họa) là cấp phát các số thứ tự duy nhất cho mỗi client gửi yêu cầu đến. Trong quá trình thảo luận về ứng dụng này, chúng ta sẽ giới thiệu một số khái niệm và kỹ thuật trong thiết kế server.

### Tổng quan về ứng dụng

Trong ứng dụng ví dụ này, tất cả các client đều gửi yêu cầu của mình tới server thông qua một FIFO duy nhất của server. Tệp tiêu đề (header file) ([Liệt kê 44-6\)](#page-34-0) định nghĩa tên nổi tiếng / địa chỉ quen thuộc (`well-known name`) (`/tmp/seqnum_sv`) mà server sử dụng cho FIFO của nó. Tên này là cố định, do đó tất cả các client đều biết cách liên hệ với server. (Trong ứng dụng ví dụ này, chúng ta tạo các FIFO trong thư mục `/tmp`, vì điều này cho phép chúng ta chạy các chương trình một cách thuận tiện mà không cần thay đổi trên hầu hết các hệ thống. Tuy nhiên, như đã lưu ý trong Mục 38.7, việc tạo tệp trong các thư mục mà mọi người đều có quyền ghi như `/tmp` có thể dẫn đến các lỗ hổng bảo mật khác nhau và nên tránh trong các ứng dụng thực tế).

> Trong các ứng dụng client-server, chúng ta sẽ liên tục gặp lại khái niệm về một địa chỉ quen thuộc (`well-known address`) hoặc tên nổi tiếng được server sử dụng để làm cho dịch vụ của nó hiển thị với các client. Sử dụng một địa chỉ quen thuộc là một giải pháp cho vấn đề làm thế nào để các client biết nơi liên hệ với server. Một giải pháp khả thi khác là cung cấp một loại server tên (name server) mà các server có thể đăng ký tên dịch vụ của chúng. Sau đó, mỗi client sẽ liên hệ với server tên để lấy vị trí của dịch vụ mà nó mong muốn. Giải pháp này cho phép vị trí của các server linh hoạt hơn, đổi lại bằng một chút công sức lập trình bổ sung. Tất nhiên, khi đó các client và server cần phải biết nơi liên hệ với server tên; thông thường, nó nằm ở một địa chỉ quen thuộc.

Tuy nhiên, không thể sử dụng một FIFO duy nhất để gửi phản hồi cho tất cả các client, vì nhiều client sẽ cạnh tranh (race) để đọc từ FIFO và có thể đọc nhầm thông điệp phản hồi của nhau thay vì của chính mình. Do đó, mỗi client tạo ra một FIFO duy nhất mà server sử dụng để gửi phản hồi cho client đó, và server cần phải biết cách tìm FIFO của từng client. Một cách khả thi để làm điều này là client tự tạo đường dẫn (pathname) FIFO của riêng nó, sau đó truyền đường dẫn đó như một phần trong thông điệp yêu cầu của mình. Ngoài ra, client và server có thể thống nhất một quy ước để xây dựng đường dẫn FIFO của client, và trong phần yêu cầu, client có thể truyền cho server thông tin cần thiết để xây dựng đường dẫn dành riêng cho client đó. Giải pháp sau được sử dụng trong ví dụ của chúng ta. Tên FIFO của mỗi client được xây dựng từ một mẫu (`CLIENT_FIFO_TEMPLATE`) bao gồm một đường dẫn chứa ID tiến trình (process ID) của client. Việc bao gồm ID tiến trình cung cấp một cách dễ dàng để tạo ra một tên duy nhất cho client này.

[Hình 44-6](#page-33-0) minh họa cách ứng dụng này sử dụng các FIFO để giao tiếp giữa các tiến trình (process) client và server của chúng ta.

Tệp tiêu đề [\(Liệt kê 44-6\)](#page-34-0) định nghĩa các định dạng cho thông điệp yêu cầu (request message) được gửi từ client đến server, và cho thông điệp phản hồi (response message) được gửi từ server đến các client.

![](_page_33_Figure_0.jpeg)

Hình 44-6: Sử dụng các FIFO trong ứng dụng một server, nhiều client

Hãy nhớ lại rằng dữ liệu trong các pipe và FIFO là một luồng byte (byte stream); ranh giới giữa nhiều thông điệp không được bảo toàn. Điều này có nghĩa là khi nhiều thông điệp được gửi đến một tiến trình đơn lẻ, chẳng hạn như server trong ví dụ của chúng ta, thì bên gửi và bên nhận phải thống nhất một quy ước nào đó để phân tách các thông điệp. Có nhiều phương pháp khác nhau có thể được áp dụng:

- Kết thúc mỗi thông điệp bằng một *ký tự phân tách (delimiter character)*, chẳng hạn như ký tự xuống dòng (newline character). (Để xem ví dụ về kỹ thuật này, hãy tham khảo hàm *readLine()* trong Liệt kê 59-1, trang 1201). Trong trường hợp này, ký tự phân tách hoặc phải là ký tự không bao giờ xuất hiện như một phần của thông điệp, hoặc chúng ta phải áp dụng một quy ước để thoát ký tự phân tách (escape) nếu nó thực sự xuất hiện bên trong thông điệp. Ví dụ, nếu chúng ta sử dụng dấu xuống dòng làm ký tự phân tách, thì các ký tự dấu gạch chéo ngược `\` cộng với dấu xuống dòng có thể được dùng để đại diện cho một ký tự xuống dòng thực sự bên trong thông điệp, trong khi `\\` có thể đại diện cho một dấu `\` thực sự. Một nhược điểm của phương pháp này là tiến trình đọc thông điệp phải quét dữ liệu từ FIFO từng byte một cho đến khi tìm thấy ký tự phân tách.
- Đưa vào mỗi thông điệp một *phần đầu có kích thước cố định chứa trường độ dài (fixed-size header with a length field)* chỉ định số lượng byte trong thành phần có độ dài thay đổi còn lại của thông điệp. Trong trường hợp này, tiến trình đọc trước tiên sẽ đọc phần đầu từ FIFO, sau đó sử dụng trường độ dài của phần đầu để xác định số lượng byte cần đọc cho phần còn lại của thông điệp. Phương pháp này có ưu điểm là cho phép các thông điệp có kích thước tùy ý một cách hiệu quả, nhưng có thể dẫn đến sự cố nếu một thông điệp bị lỗi định dạng (ví dụ: trường *length* không hợp lệ) được ghi vào pipe.
- Sử dụng *các thông điệp có kích thước cố định (fixed-length messages)* và yêu cầu server luôn đọc các thông điệp có kích thước cố định này. Ưu điểm của cách này là đơn giản trong việc lập trình. Tuy nhiên, nó áp đặt một giới hạn trên cho kích thước thông điệp và đồng thời gây lãng phí dung lượng kênh truyền (vì các thông điệp ngắn phải được đệm (pad) cho đủ kích thước cố định). Hơn nữa, nếu một trong các client vô tình hoặc cố ý gửi một thông điệp không đúng kích thước, thì tất cả các thông điệp tiếp theo sẽ bị lệch nhịp (out of step); trong tình huống này, server không thể dễ dàng khôi phục lại trạng thái ban đầu.

Ba kỹ thuật này được minh họa trong Hình 44-7. Cần lưu ý rằng đối với mỗi kỹ thuật này, tổng chiềuยาว của mỗi thông điệp phải nhỏ hơn `PIPE_BUF` byte để tránh khả năng thông điệp bị kernel chia nhỏ và xen kẽ (interleaved) với các thông điệp từ các tiến trình ghi khác.

Trong ba kỹ thuật được mô tả ở phần nội dung chính, một kênh đơn lẻ (FIFO) được sử dụng cho tất cả thông điệp từ mọi client. Một giải pháp thay thế là sử dụng *một kết nối đơn lẻ cho mỗi thông điệp (single connection for each message)*. Bên gửi mở kênh giao tiếp, gửi thông điệp của mình, và sau đó đóng kênh. Tiến trình đọc biết rằng thông điệp đã hoàn tất khi nó gặp dấu hiệu kết thúc tệp (end-of-file). Nếu nhiều tiến trình ghi cùng giữ một FIFO mở, thì cách tiếp cận này không khả thi, bởi vì bên đọc sẽ không nhìn thấy tín hiệu kết thúc tệp khi chỉ có một trong các bên ghi đóng FIFO đó. Tuy nhiên, phương pháp này hoàn toàn khả thi khi sử dụng socket dạng luồng (stream sockets), nơi một tiến trình server tạo ra một kênh giao tiếp duy nhất cho mỗi kết nối client đến.

![](_page_34_Figure_1.jpeg)

Hình 44-7: Phân tách các thông điệp trong một luồng byte

Trong ứng dụng mẫu của chúng ta, chúng ta sử dụng kỹ thuật thứ ba trong số các kỹ thuật đã mô tả ở trên, với mỗi client gửi các thông điệp có kích thước cố định đến server. Thông điệp này được định nghĩa bởi cấu trúc *request* trong Liệt kê 44-6. Mỗi yêu cầu gửi đến server đều bao gồm ID tiến trình (process ID) của client, cho phép server xây dựng tên của FIFO do client đó sử dụng để nhận phản hồi. Yêu cầu cũng chứa một trường (*seqLen*) chỉ định có bao nhiêu số thứ tự (sequence numbers) cần được cấp phát cho client này. Thông điệp phản hồi được gửi từ server về client bao gồm một trường duy nhất là *seqNum*, chính là giá trị bắt đầu của dải số thứ tự được cấp phát cho client đó.

**Liệt kê 44-6:** Tệp tiêu đề cho `fifo_segnum_server.c` và `fifo_segnum_client.c`

```c

pipes/fifo_seqnum.h

## include <sys/types.h>

## include <sys/stat.h>

## include <fcntl.h>

## include "tlpi_hdr.h"

## define SERVER_FIFO "/tmp/seqnum_sv"

/* Tên nổi tiếng (well-known name) cho FIFO của server */

## define CLIENT_FIFO_TEMPLATE "/tmp/seqnum_cl.%ld"

/* Mẫu để xây dựng tên FIFO của client */

## define CLIENT_FIFO_NAME_LEN (sizeof(CLIENT_FIFO_TEMPLATE) + 20)

/* Không gian cần thiết cho đường dẫn FIFO của client
(+20 là khoảng dự phòng thoải mái cho PID) */
struct request {
/* Yêu cầu (client --> server) */
/* PID của client */
pid_t pid;
int seqLen;
/* Độ dài của chuỗi số thứ tự mong muốn */
};

```

```

struct response { /* Phản hồi (server --> client) */
int seqNum; /* Bắt đầu chuỗi */
};
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pipes/fifo_seqnum.h

```

### Chương trình Server

Liệt kê 44-7 là mã nguồn cho server. Server thực hiện các bước sau:

- Tạo FIFO nổi tiếng (well-known FIFO) q của server và mở FIFO đó ở chế độ đọc w. Server phải được chạy trước bất kỳ client nào, để FIFO của server đã tồn tại vào thời điểm client cố gắng mở nó. Hàm `open()` của server sẽ chặn (block) cho đến khi client đầu tiên mở đầu bên kia của FIFO server ở chế độ ghi.
- Mở lại FIFO của server một lần nữa e, lần này ở chế độ ghi. Thao tác này sẽ không bao giờ bị chặn, vì FIFO đã được mở để đọc trước đó. Lần mở thứ hai này là một tiện ích nhằm đảm bảo rằng server không gặp phải tín hiệu kết thúc file (end-of-file) nếu tất cả client đóng đầu ghi của FIFO.
- Bỏ qua tín hiệu `SIGPIPE` r, để nếu server cố gắng ghi vào một FIFO client không có tiến trình đọc nào, thì thay vì bị gửi tín hiệu `SIGPIPE` (mặc định sẽ làm chết một tiến trình - kill a process), nó sẽ nhận được lỗi `EPIPE` từ System Call `write()`.
- Bước vào một vòng lặp đọc và phản hồi từng yêu cầu (request) đến từ client t. Để gửi phản hồi, server tạo tên của FIFO client y và sau đó mở FIFO đó u.
- Nếu server gặp lỗi khi mở FIFO của client, nó sẽ bỏ qua yêu cầu của client đó i.

Đây là một ví dụ về một server lặp (iterative server), trong đó server đọc và xử lý từng yêu cầu của client trước khi tiếp tục xử lý yêu cầu tiếp theo. Thiết kế server lặp phù hợp khi mỗi yêu cầu của client có thể được xử lý và phản hồi nhanh chóng, sao cho các yêu cầu khác của client không bị trì hoãn. Một thiết kế thay thế là server đồng thời (concurrent server), trong đó tiến trình server chính sử dụng một tiến trình con (hoặc Thread riêng biệt) để xử lý từng yêu cầu của client. Chúng ta sẽ thảo luận thêm về thiết kế server trong Chương 60.

**Liệt kê 44-7:** Một server lặp sử dụng FIFO

```

–––––––––––––––––––––––––––––––––––––––––––––––– pipes/fifo_seqnum_server.c

## include <signal.h>

## include "fifo_seqnum.h"

int
main(int argc, char *argv[])
{
int serverFd, dummyFd, clientFd;
char clientFifo[CLIENT_FIFO_NAME_LEN];
struct request req;
struct response resp;
int seqNum = 0; /* Đây là "dịch vụ" của chúng ta */

```

```

/* Tạo FIFO nổi tiếng và mở nó ở chế độ đọc */
umask(0); /* Để nhận được các quyền (permissions) mà chúng ta muốn */
q if (mkfifo(SERVER_FIFO, S_IRUSR | S_IWUSR | S_IWGRP) == -1
&& errno != EEXIST)
errExit("mkfifo %s", SERVER_FIFO);
w serverFd = open(SERVER_FIFO, O_RDONLY);
if (serverFd == -1)
errExit("open %s", SERVER_FIFO);
/* Mở thêm một File Descriptor ghi phụ, để chúng ta không bao giờ gặp EOF */
e dummyFd = open(SERVER_FIFO, O_WRONLY);
if (dummyFd == -1)
errExit("open %s", SERVER_FIFO);
r if (signal(SIGPIPE, SIG_IGN) == SIG_ERR)
errExit("signal");
t for (;;) { /* Đọc các yêu cầu và gửi phản hồi */
if (read(serverFd, &req, sizeof(struct request))
!= sizeof(struct request)) {
fprintf(stderr, "Lỗi đọc yêu cầu; đang loại bỏ\n");
continue; /* Hoặc đọc một phần (partial read) hoặc lỗi */
}
/* Mở FIFO client (đã được tạo trước đó bởi client) */
y snprintf(clientFifo, CLIENT_FIFO_NAME_LEN, CLIENT_FIFO_TEMPLATE,
(long) req.pid);
u clientFd = open(clientFifo, O_WRONLY);
if (clientFd == -1) { /* Mở thất bại, từ bỏ client */
errMsg("open %s", clientFifo);
i continue;
}
/* Gửi phản hồi và đóng FIFO */
resp.seqNum = seqNum;
if (write(clientFd, &resp, sizeof(struct response))
!= sizeof(struct response))
fprintf(stderr, "Lỗi ghi vào FIFO %s\n", clientFifo);
if (close(clientFd) == -1)
errMsg("close");
seqNum += req.seqLen; /* Cập nhật số thứ tự của chúng ta */
}
}
–––––––––––––––––––––––––––––––––––––––––––––––– pipes/fifo_seqnum_server.c

```

### Chương trình Client

[Liệt kê 44-8](#page-37-0) là mã nguồn cho chương trình client. Client thực hiện các bước sau:

- Tạo một FIFO được sử dụng để nhận phản hồi từ server w. Quá trình này được thực hiện trước khi gửi yêu cầu, nhằm đảm bảo rằng FIFO tồn tại vào thời điểm server cố gắng mở nó và gửi thông điệp phản hồi.
- Xây dựng một thông điệp cho server chứa ID tiến trình (Process ID) của client và một số (lấy từ đối số dòng lệnh tùy chọn) chỉ định độ dài của chuỗi mà client muốn server cấp phát cho nó r. (Nếu không có đối số dòng lệnh nào được cung cấp, độ dài chuỗi mặc định là 1.)
- Mở FIFO của server t và gửi thông điệp tới server y.
- Mở FIFO của client u, sau đó đọc và in ra phản hồi của server i.

Chi tiết duy nhất khác cần lưu ý là hàm xử lý thoát (exit handler) q, được thiết lập bằng `atexit()` e, đảm bảo rằng FIFO của client sẽ bị xóa khi tiến trình (process) thoát. Ngoài ra, chúng ta có thể đơn giản đặt một lời gọi `unlink()` ngay sau hàm `open()` của FIFO client. Cách này vẫn hoạt động vì tại thời điểm đó, sau khi cả hai đã thực hiện các lời gọi `open()` chặn (blocking `open()`), cả server và client đều sẽ nắm giữ các mô tả tệp (File Descriptor) mở cho FIFO, và việc gỡ bỏ tên FIFO khỏi hệ thống tập tin (file system) không ảnh hưởng đến các mô tả này hoặc các mô tả tệp mở (open file descriptions) mà chúng trỏ tới.

Dưới đây là ví dụ về những gì chúng ta thấy khi chạy các chương trình client và server:

```

$ ./fifo_seqnum_server &
[1] 5066
$ ./fifo_seqnum_client 3 Request a sequence of three numbers
0 Assigned sequence begins at 0
$ ./fifo_seqnum_client 2 Request a sequence of two numbers
3 Assigned sequence begins at 3
$ ./fifo_seqnum_client Request a single number
5

```

**Liệt kê 44-8:** Client cho server cấp phát số thứ tự (sequence-number)

```

–––––––––––––––––––––––––––––––––––––––––––––––– pipes/fifo_seqnum_client.c

## include "fifo_seqnum.h"

static char clientFifo[CLIENT_FIFO_NAME_LEN];
static void /* Được gọi khi thoát để xóa FIFO của client */
q removeFifo(void)
{
unlink(clientFifo);
}
int
main(int argc, char *argv[])
{
int serverFd, clientFd;
struct request req;
struct response resp;

```

```

if (argc > 1 && strcmp(argv[1], "--help") == 0)
usageErr("%s [seq-len...]\n", argv[0]);
/* Tạo FIFO của chúng ta (trước khi gửi yêu cầu, để tránh tình trạng tranh chấp (race)) */
umask(0); /* Để nhận các quyền (permission) mà chúng ta muốn */
w snprintf(clientFifo, CLIENT_FIFO_NAME_LEN, CLIENT_FIFO_TEMPLATE,
(long) getpid());
if (mkfifo(clientFifo, S_IRUSR | S_IWUSR | S_IWGRP) == -1
&& errno != EEXIST)
errExit("mkfifo %s", clientFifo);
e if (atexit(removeFifo) != 0)
errExit("atexit");
/* Xây dựng thông điệp yêu cầu, mở FIFO của server và gửi yêu cầu */
r req.pid = getpid();
req.seqLen = (argc > 1) ? getInt(argv[1], GN_GT_0, "seq-len") : 1;
t serverFd = open(SERVER_FIFO, O_WRONLY);
if (serverFd == -1)
errExit("open %s", SERVER_FIFO);
y if (write(serverFd, &req, sizeof(struct request)) !=
sizeof(struct request))
fatal("Không thể ghi vào server");
/* Mở FIFO của chúng ta, đọc và hiển thị phản hồi */
u clientFd = open(clientFifo, O_RDONLY);
if (clientFd == -1)
errExit("open %s", clientFifo);
i if (read(clientFd, &resp, sizeof(struct response))
!= sizeof(struct response))
fatal("Không thể đọc phản hồi từ server");
printf("%d\n", resp.seqNum);
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––– pipes/fifo_seqnum_client.c

```

## 44.9 I/O không đồng bộ / Không chặn (Nonblocking I/O)

Như đã lưu ý trước đó, khi một tiến trình mở một đầu của FIFO, nó sẽ bị chặn (block) nếu đầu kia của FIFO chưa được mở. Đôi khi, chúng ta không muốn bị chặn, và vì mục đích này, cờ `O_NONBLOCK` có thể được chỉ định khi gọi hàm `open()`:

```

fd = open("fifopath", O_RDONLY | O_NONBLOCK);
if (fd == -1)
errExit("open");

```

Nếu đầu kia của FIFO đã được mở từ trước, thì cờ `O_NONBLOCK` không có tác dụng gì đối với lời gọi `open()`—nó sẽ mở thành công FIFO ngay lập tức như bình thường. Cờ `O_NONBLOCK` chỉ thay đổi hành vi khi đầu kia của FIFO chưa được mở, và hiệu ứng sẽ phụ thuộc vào việc chúng ta đang mở FIFO để đọc hay để ghi:

- Nếu FIFO đang được mở để đọc và hiện không có tiến trình nào mở đầu ghi của FIFO, thì lời gọi `open()` sẽ thành công ngay lập tức (giống như thể đầu kia của FIFO đã được mở từ trước).
- Nếu FIFO đang được mở để ghi và đầu kia của FIFO chưa được mở để đọc, thì `open()` sẽ thất bại và đặt biến `errno` thành `ENXIO`.

Sự bất đối xứng của cờ `O_NONBLOCK` tùy thuộc vào việc FIFO đang được mở để đọc hay để ghi có thể được giải thích như sau. Việc mở một FIFO để đọc khi không có tiến trình ghi ở đầu bên kia là hoàn toàn hợp lệ, vì bất kỳ nỗ lực đọc nào từ FIFO đơn giản là sẽ không trả về dữ liệu nào. Tuy nhiên, việc cố gắng ghi vào một FIFO mà không có đầu đọc sẽ dẫn đến việc tạo ra tín hiệu (signal) `SIGPIPE` và lỗi `EPIPE` từ hàm `write()`.

Bảng 44-1 tóm tắt ngữ nghĩa của việc mở một FIFO, bao gồm cả các hiệu ứng của cờ `O_NONBLOCK` đã được mô tả ở trên.

|          | Loại hàm open()     |                        | Kết quả của open()       |
|----------|---------------------|------------------------|--------------------------|
| mở để    | các cờ bổ sung      | đầu kia của FIFO mở    | đầu kia của FIFO đóng    |
|          | không có (chặn)     | thành công ngay lập tức| bị chặn (blocks)         |
| đọc      | O_NONBLOCK          | thành công ngay lập tức| thành công ngay lập tức  |
|          | không có (chặn)     | thành công ngay lập tức| bị chặn (blocks)         |
| ghi      | O_NONBLOCK          | thành công ngay lập tức| thất bại (ENXIO)         |

**Bảng 44-1:** Ngữ nghĩa của `open()` đối với một FIFO

Việc sử dụng cờ `O_NONBLOCK` khi mở một FIFO phục vụ hai mục đích chính:

- Cho phép một tiến trình đơn (single process) mở cả hai đầu của FIFO. Tiến trình trước tiên mở FIFO để đọc với cờ `O_NONBLOCK`, sau đó mở FIFO để ghi.
- Ngăn ngừa tình trạng bế tắc (deadlock) giữa các tiến trình mở hai FIFO.

Tình trạng bế tắc (deadlock) là một tình huống trong đó từ hai tiến trình trở lên bị chặn (blocked) vì mỗi tiến trình đang chờ tiến trình (hoặc các tiến trình) khác hoàn thành một hành động nào đó. Hai tiến trình được thể hiện trong [Hình 44-8](#page-40-0) đang bị bế tắc (deadlocked). Mỗi tiến trình đều bị chặn khi đang chờ mở một FIFO để đọc. Sự việc bị chặn này sẽ không xảy ra nếu mỗi tiến trình có thể thực hiện bước thứ hai của mình (mở FIFO còn lại để ghi). Vấn đề bế tắc cụ thể này có thể được giải quyết bằng cách đảo ngược thứ tự của bước 1 và bước 2 trong tiến trình Y, trong khi giữ nguyên thứ tự trong tiến trình X, hoặc ngược lại. Tuy nhiên, việc sắp xếp các bước như vậy có thể không dễ đạt được trong một số ứng dụng. Thay vào đó, chúng ta có thể giải quyết vấn đề bằng cách cho một trong hai tiến trình, hoặc cả hai, chỉ định cờ `O_NONBLOCK` khi mở các FIFO để đọc.

| Tiến trình X                         | Tiến trình Y                         |
|--------------------------------------|--------------------------------------|
| 1. Mở FIFO A để đọc<br>bị chặn       | 1. Mở FIFO B để đọc<br>bị chặn       |
| 2. Mở FIFO B để ghi                  | 2. Mở FIFO A để ghi                  |

**Hình 44-8:** Tình trạng bế tắc (deadlock) giữa các tiến trình mở hai FIFO

## Hàm read() và write() không chặn (Nonblocking)

Cờ `O_NONBLOCK` không chỉ ảnh hưởng đến ngữ nghĩa của `open()` mà còn — bởi vì cờ này sau đó vẫn được thiết lập cho mô tả tệp đang mở (open file description) — ảnh hưởng đến ngữ nghĩa của các lời gọi `read()` và `write()` tiếp theo. Chúng tôi sẽ mô tả những hiệu ứng này trong phần tiếp theo.

Đôi khi, chúng ta cần thay đổi trạng thái của cờ `O_NONBLOCK` cho một FIFO (hoặc một loại tệp khác) đã được mở. Các kịch bản mà nhu cầu này có thể phát sinh bao gồm:

- Chúng ta đã mở một FIFO bằng cách sử dụng `O_NONBLOCK`, nhưng chúng ta muốn các lời gọi `read()` và `write()` tiếp theo hoạt động ở chế độ chặn (blocking mode).
- Chúng ta muốn bật chế độ không chặn (nonblocking mode) cho một bộ mô tả tệp (file descriptor) được trả về bởi `pipe()`. Tổng quát hơn, chúng ta có thể muốn thay đổi trạng thái không chặn của bất kỳ bộ mô tả tệp nào không phải lấy từ lời gọi `open()` — ví dụ: một trong ba bộ mô tả chuẩn được tự động mở cho mỗi chương trình mới chạy bởi shell, hoặc một bộ mô tả tệp do `socket()` trả về.
- Cho một mục đích cụ thể của ứng dụng, chúng ta cần bật và tắt thiết lập `O_NONBLOCK` của một bộ mô tả tệp (file descriptor).

Đối với các mục đích này, chúng ta có thể sử dụng `fcntl()` để bật hoặc tắt cờ trạng thái tệp mở `O_NONBLOCK`. Để bật cờ, chúng ta viết như sau (bỏ qua phần kiểm tra lỗi):

```c

int flags;
flags = fcntl(fd, F_GETFL); /* Lấy các cờ trạng thái tệp mở */
flags |= O_NONBLOCK; /* Bật bit O_NONBLOCK */
fcntl(fd, F_SETFL, flags); /* Cập nhật các cờ trạng thái tệp mở */
Và để tắt nó, chúng ta viết như sau:
flags = fcntl(fd, F_GETFL);
flags &= ~O_NONBLOCK; /* Tắt bit O_NONBLOCK */
fcntl(fd, F_SETFL, flags);

```

## 44.10 Ngữ nghĩa của hàm read() và write() trên Pipe và FIFO

Bảng 44-2 tóm tắt hoạt động của `read()` đối với pipe và FIFO, đồng thời bao gồm hiệu ứng của cờ `O_NONBLOCK`.

Sự khác biệt duy nhất giữa việc đọc ở chế độ chặn và không chặn xảy ra khi không có dữ liệu nào và đầu ghi đang mở. Trong trường hợp này, một lệnh `read()` thông thường sẽ bị chặn (blocks), trong khi một lệnh `read()` không chặn sẽ thất bại với mã lỗi `EAGAIN`.

**Bảng 44-2:** Ngữ nghĩa của việc đọc n byte từ một pipe hoặc FIFO chứa p byte

| O_NONBLOCK | Các byte dữ liệu có sẵn trong pipe hoặc FIFO (p) |                         |              |              |
|------------|-------------------------------------------------|-------------------------|--------------|--------------|
| được bật?  | p = 0, đầu ghi đang mở                          | p = 0, đầu ghi đã đóng  | p < n        | p >= n       |
| Không      | chặn (block)                                    | trả về 0 (EOF)          | đọc p byte   | đọc n byte   |
| Có         | thất bại (EAGAIN)                               | trả về 0 (EOF)          | đọc p byte   | đọc n byte   |

Tác động của cờ `O_NONBLOCK` khi ghi (write) vào một pipe hoặc FIFO trở nên phức tạp do sự tương tác với giới hạn `PIPE_BUF`. Hành vi của `write()` được tóm tắt trong Bảng 44-3.

**Bảng 44-3:** Ngữ nghĩa của việc ghi $n$ byte vào một pipe hoặc FIFO

| O_NONBLOCK | Đầu đọc đang mở                                                                                                                           |                                                                                                                                                                                                                  | Đầu đọc               |
|------------|-------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------|
| bật?       | n <= PIPE_BUF                                                                                                                             | n > PIPE_BUF                                                                                                                                                                                                     | đã đóng               |
| Không      | Ghi nguyên tử (atomically) $n$ byte;<br>có thể chặn (block) cho đến khi đủ<br>dữ liệu được đọc để hàm `write()`<br>có thể thực thi        | Ghi $n$ byte; có thể chặn cho đến khi<br>đủ dữ liệu được đọc để `write()`<br>hoàn tất; dữ liệu có thể bị xen kẽ<br>(interleaved) với các thao tác ghi từ các tiến trình (process) khác                        |                       |
| Có         | Nếu có đủ không gian trống<br>để ghi ngay lập tức $n$ byte,<br>thì `write()` thành công<br>nguyên tử; ngược lại, thất bại (EAGAIN)      | Nếu có đủ không gian trống để ghi<br>ngay lập tức một vài byte, thì ghi<br>từ 1 đến $n$ byte (có thể bị xen kẽ<br>với dữ liệu được ghi bởi các tiến trình khác);<br>ngược lại, `write()` thất bại (EAGAIN) | SIGPIPE<br>+<br>EPIPE |

Cờ `O_NONBLOCK` khiến hàm `write()` trên một pipe hoặc FIFO thất bại (với mã lỗi `EAGAIN`) trong bất kỳ trường hợp nào mà dữ liệu không thể được truyền đi ngay lập tức. Điều này có nghĩa là nếu chúng ta ghi từ `PIPE_BUF` byte trở xuống, thì `write()` sẽ thất bại nếu không có đủ không gian trống trong pipe hoặc FIFO, bởi vì kernel không thể hoàn thành thao tác ngay lập tức và cũng không thể thực hiện ghi một phần (partial write), vì điều đó sẽ phá vỡ yêu cầu rằng các thao tác ghi từ `PIPE_BUF` byte trở xuống phải mang tính nguyên tử (atomic).

Khi ghi nhiều hơn `PIPE_BUF` byte cùng một lúc, thao tác ghi không bắt buộc phải mang tính nguyên tử. Vì lý do này, `write()` sẽ truyền càng nhiều byte càng tốt (một thao tác ghi một phần - partial write) để làm đầy pipe hoặc FIFO. Trong trường hợp này, giá trị trả về từ `write()` chính là số byte thực sự được truyền đi, và tiến trình gọi (caller) phải thử lại sau để ghi phần dữ liệu còn lại. Tuy nhiên, nếu pipe hoặc FIFO đã đầy, dẫn đến việc thậm chí không thể truyền nổi một byte nào, thì `write()` sẽ thất bại với mã lỗi `EAGAIN`.

## 44.11 Tổng kết

Pipe (Đường ống) là phương pháp IPC (Interprocess Communication - Giao tiếp giữa các tiến trình) đầu tiên trong hệ thống UNIX, và chúng được sử dụng thường xuyên bởi shell cũng như trong các ứng dụng khác. Một pipe là một luồng byte (byte stream) một chiều, có dung lượng giới hạn, có thể được sử dụng để giao tiếp giữa các tiến trình có quan hệ họ hàng (related processes). Mặc dù các khối dữ liệu với bất kỳ kích thước nào có thể được ghi vào pipe, nhưng chỉ các thao tác ghi không vượt quá `PIPE_BUF` byte mới được đảm bảo tính nguyên tử (atomic). Ngoài việc được sử dụng như một phương pháp IPC, pipe cũng có thể được dùng cho việc đồng bộ hóa tiến trình (process synchronization).

Khi sử dụng pipe, chúng ta phải cẩn thận đóng các bộ mô tả chưa sử dụng (unused descriptors) nhằm đảm bảo rằng các tiến trình đang đọc phát hiện được dấu hiệu kết thúc tệp (end-of-file) và các tiến trình đang ghi nhận được tín hiệu `SIGPIPE` hoặc lỗi `EPIPE`. (Thông thường, cách dễ nhất là để ứng dụng ghi vào pipe bỏ qua tín hiệu `SIGPIPE` và phát hiện pipe bị "hỏng" thông qua lỗi `EPIPE`).

Các hàm `popen()` và `pclose()` cho phép một chương trình truyền dữ liệu đến hoặc từ một lệnh shell tiêu chuẩn, mà không cần phải xử lý các chi tiết về việc tạo pipe, thực thi shell (`exec`), và đóng các bộ mô tả tệp không sử dụng (unused file descriptors).

FIFO (First In, First Out) hoạt động hoàn toàn giống với pipe, ngoại trừ việc chúng được tạo bằng hàm `mkfifo()`, có một tên trong hệ thống tệp (file system), và có thể được mở bởi bất kỳ tiến trình nào có quyền hạn phù hợp. Theo mặc định, việc mở một FIFO để đọc sẽ bị chặn (block) cho đến khi một tiến trình khác mở FIFO đó để ghi, và ngược lại.

Trong chương này, chúng ta đã tìm hiểu một số chủ đề liên quan. Đầu tiên, chúng ta đã thấy cách nhân bản các bộ mô tả tệp (duplicate file descriptors) sao cho đầu vào hoặc đầu ra tiêu chuẩn của một bộ lọc (filter) có thể được gắn kết (bound) với một pipe. Khi trình bày ví dụ về mô hình client-server sử dụng FIFO, chúng ta đã chạm đến một số chủ đề trong thiết kế client-server, bao gồm việc sử dụng một địa chỉ nổi tiếng (well-known address) cho server và thiết kế server tuần tự (iterative) so với song song (concurrent). Khi phát triển ứng dụng FIFO mẫu, chúng ta lưu ý rằng, mặc dù dữ liệu được truyền qua pipe là một luồng byte (byte stream), nhưng đôi khi các tiến trình giao tiếp sẽ hữu ích hơn nếu đóng gói dữ liệu thành các thông điệp (messages), và chúng ta đã xem xét các cách khác nhau để thực hiện điều này.

Cuối cùng, chúng ta đã lưu ý hiệu ứng của cờ `O_NONBLOCK` (I/O phi chặn - nonblocking I/O) khi mở và thực hiện các thao tác I/O trên FIFO. Cờ `O_NONBLOCK` rất hữu ích nếu chúng ta không muốn bị chặn khi mở một FIFO. Nó cũng hữu ích nếu chúng ta không muốn các thao tác đọc bị chặn khi không có sẵn dữ liệu, hoặc các thao tác ghi bị chặn khi không đủ dung lượng trống bên trong pipe hoặc FIFO.

## Thông tin thêm

Việc cài đặt pipe được thảo luận trong [Bach, 1986] và [Bovet & Cesati, 2005]. Các chi tiết hữu ích về pipe và FIFO cũng có thể được tìm thấy trong [Vahalia, 1996].

## 44.12 Bài tập

- **44-1.** Viết một chương trình sử dụng hai pipe để cho phép giao tiếp hai chiều (bidirectional communication) giữa tiến trình cha và tiến trình con. Tiến trình cha nên thực hiện vòng lặp đọc một khối văn bản từ đầu vào tiêu chuẩn (standard input) và sử dụng một trong các pipe để gửi văn bản đó cho tiến trình con. Tiến trình con chuyển đổi văn bản thành chữ hoa (uppercase) và gửi ngược lại cho tiến trình cha thông qua pipe kia. Tiến trình cha đọc dữ liệu trả về từ tiến trình con và in lặp lại (echo) nó ra đầu vào/đầu ra tiêu chuẩn trước khi tiếp tục lặp lại vòng lặp một lần nữa.
- **44-2.** Cài đặt lại các hàm `popen()` và `pclose()`. Mặc dù các hàm này được đơn giản hóa nhờ việc không đòi hỏi cơ chế xử lý tín hiệu được sử dụng trong việc cài đặt `system()` (Mục 27.7), bạn sẽ cần phải cẩn thận để liên kết chính xác các đầu của pipe với các luồng tệp (file streams) trong mỗi tiến trình, và đảm bảo rằng tất cả các bộ mô tả không sử dụng (unused descriptors) trỏ đến các đầu của pipe đều được đóng lại. Vì các tiến trình con được tạo bởi nhiều lời gọi `popen()` có thể chạy cùng một lúc, bạn sẽ cần duy trì một cấu trúc dữ liệu liên kết các con trỏ luồng tệp (file stream pointers) do `popen()` cấp phát với các ID tiến trình con tương ứng. (Nếu sử dụng một mảng cho mục đích này, giá trị trả về bởi hàm `fileno()`, dùng để lấy bộ mô tả tệp tương ứng với một luồng tệp, có thể được dùng làm chỉ mục cho mảng). Việc lấy đúng ID tiến trình từ cấu trúc này sẽ cho phép `pclose()` chọn ra tiến trình con để chờ đợi (`wait`). Cấu trúc này cũng sẽ hỗ trợ yêu cầu của chuẩn SUSv3 rằng bất kỳ luồng tệp nào vẫn đang mở được tạo bởi các lời gọi `popen()` trước đó phải được đóng lại trong tiến trình con mới.
- **44-3.** Server trong Liệt kê 44-7 (`fifo_seqnum_server.c`) luôn bắt đầu cấp phát số thứ tự (sequence numbers) từ 0 mỗi khi nó được khởi động. Hãy sửa đổi chương trình để sử dụng một tệp sao lưu (backup file) được cập nhật mỗi khi một số thứ tự được cấp phát. (Cờ `open()` `O_SYNC`, được mô tả trong Mục 4.3.1, có thể hữu ích). Khi khởi động, chương trình nên kiểm tra sự tồn tại của tệp này, và nếu nó tồn tại, hãy sử dụng giá trị bên trong nó để khởi tạo số thứ tự. Nếu không tìm thấy tệp sao lưu khi khởi động, chương trình nên tạo một tệp mới và bắt đầu cấp phát số thứ tự từ 0. (Một phương pháp thay thế cho kỹ thuật này là sử dụng tệp được ánh xạ bộ nhớ - memory-mapped files, được mô tả trong Chương [49.](#page-140-0))

- **44-4.** Thêm mã nguồn vào máy chủ (server) trong Liệt kê 44-7 (`fifo_seqnum_server.c`) sao cho nếu chương trình nhận được tín hiệu (signal) `SIGINT` hoặc `SIGTERM`, nó sẽ xóa FIFO của máy chủ và kết thúc tiến trình (terminate).
- **44-5.** Máy chủ trong Liệt kê 44-7 (`fifo_seqnum_server.c`) thực hiện một thao tác mở (`open`) thứ hai với cờ `O_WRONLY` đối với FIFO để nó không bao giờ gặp phải trạng thái kết thúc tệp (end-of-file) khi đọc từ mô tả tệp đọc (`serverFd`) của FIFO. Thay vì làm cách này, có thể thử một phương pháp thay thế: bất cứ khi nào máy chủ gặp trạng thái kết thúc tệp trên mô tả tệp đọc, nó sẽ đóng mô tả tệp đó lại, và sau đó mở lại FIFO để đọc thêm một lần nữa. (Thao tác mở này sẽ bị chặn [block] cho đến khi máy khách [client] tiếp theo mở FIFO để ghi). Có vấn đề gì với phương pháp này?
- **44-6.** Máy chủ trong Liệt kê 44-7 (`fifo_seqnum_server.c`) giả định rằng tiến trình máy khách hoạt động đúng đắn. Nếu một máy khách hoạt động sai quy cách tạo ra một FIFO của máy khách và gửi yêu cầu đến máy chủ, nhưng không mở FIFO của chính nó, thì nỗ lực mở FIFO của máy khách từ phía máy chủ sẽ bị chặn, và các yêu cầu từ các máy khách khác sẽ bị trì hoãn vô thời hạn. (Nếu thực hiện một cách ác ý, điều này sẽ cấu thành một cuộc tấn công từ chối dịch vụ [denial-of-service attack]). Hãy thiết kế một cơ chế để giải quyết vấn đề này. Mở rộng máy chủ (và có thể cả máy khách trong [Liệt kê 44-8](#page-37-0)) cho phù hợp.
- **44-7.** Viết các chương trình để xác minh hoạt động của các thao tác mở không chặn (nonblocking open) và I/O không chặn (nonblocking I/O) trên FIFO (xem Mục [44.9](#page-38-0)).
