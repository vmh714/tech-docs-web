# Chương 46: HÀNG ĐỢI THÔNG ĐIỆP SYSTEM V (SYSTEM V MESSAGE QUEUES)

Chương này mô tả các hàng đợi thông điệp System V (System V message queues). Hàng đợi thông điệp cho phép các tiến trình (process) trao đổi dữ liệu dưới dạng các thông điệp (message). Mặc dù hàng đợi thông điệp có một số điểm tương đồng với ống lọc (pipe) và FIFO, chúng cũng có những điểm khác biệt quan trọng sau:

- Bộ định danh được sử dụng để tham chiếu đến một hàng đợi thông điệp là mã định danh (identifier) do lời gọi hàm msgget() trả về. Các mã định danh này không giống với các mô tả tệp (file descriptor) được sử dụng cho hầu hết các hình thức I/O khác trên hệ thống UNIX.
- Giao tiếp thông qua hàng đợi thông điệp mang tính định hướng thông điệp (message-oriented); nghĩa là, bên đọc nhận được toàn bộ thông điệp do bên ghi tạo ra. Không thể đọc một phần của thông điệp rồi để lại phần còn lại trong hàng đợi, hoặc đọc nhiều thông điệp cùng một lúc. Điều này trái ngược với pipe, vốn cung cấp một luồng byte không phân định (nghĩa là với pipe, bên đọc có thể đọc một số lượng byte tùy ý tại một thời điểm, bất kể kích thước của các khối dữ liệu do bên ghi thực hiện).
- Ngoài việc chứa dữ liệu, mỗi thông điệp còn có một kiểu số nguyên (integer type). Các thông điệp có thể được lấy ra từ hàng đợi theo thứ tự vào trước, ra trước (first-in, first-out) hoặc lấy ra theo kiểu (type).

Cuối chương này (Mục [46.9](#page-84-0)), chúng tôi tóm tắt một số hạn chế của hàng đợi thông điệp System V. Những hạn chế này dẫn đến kết luận rằng, nếu có thể, các ứng dụng mới nên tránh sử dụng hàng đợi thông điệp System V mà thay vào đó nên dùng các cơ chế IPC (Interprocess Communication) khác như FIFO, hàng đợi thông điệp POSIX (POSIX message queues) và socket. Tuy nhiên, khi hàng đợi thông điệp lần đầu tiên được phátise, các cơ chế thay thế này chưa có sẵn hoặc chưa phổ biến trên các bản cài đặt UNIX. Do đó, có nhiều ứng dụng hiện có đang sử dụng hàng đợi thông điệp, và thực tế này là một trong những động lực chính để mô tả chúng.

## 46.1 Tạo hoặc Mở một Hàng đợi Thông điệp

Lời gọi hệ thống (System Call) msgget() tạo ra một hàng đợi thông điệp mới hoặc lấy mã định danh của một hàng đợi đã tồn tại.

```
## include <sys/types.h> /* For portability */
## include <sys/msg.h>
int msgget(key_t key, int msgflg);
                   Trả về mã định danh hàng đợi thông điệp khi thành công, hoặc –1 khi lỗi
```

Tham số `key` là một khóa được tạo bằng một trong các phương pháp được mô tả trong Mục [45.2](#page-48-1) (thường là giá trị `IPC_PRIVATE` hoặc một khóa do hàm ftok() trả về). Tham số `msgflg` là một mặt nạ bit (bit mask) chỉ định các quyền (Bảng 15-4, trang 295) được thiết lập cho hàng đợi thông điệp mới hoặc dùng để kiểm tra đối với hàng đợi đã tồn tại. Ngoài ra, có thể kết hợp (dùng phép OR `|`) không hoặc nhiều cờ sau đây vào `msgflg` để điều khiển hoạt động của msgget():

`IPC_CREAT`

Nếu không có hàng đợi thông điệp nào với khóa đã chỉ định tồn tại, hãy tạo một hàng đợi mới.

`IPC_EXCL`

Nếu cờ `IPC_CREAT` cũng được chỉ định và một hàng đợi với khóa đã chỉ định đã tồn tại, hàm sẽ thất bại và trả về lỗi `EEXIST`.

Các cờ này được mô tả chi tiết hơn trong Mục [45.1](#page-45-0).

Lời gọi hệ thống msgget() bắt đầu bằng cách tìm kiếm trong tập hợp tất cả các hàng đợi thông điệp hiện có để tìm một hàng đợi có khóa đã chỉ định. Nếu tìm thấy hàng đợi khớp, mã định danh của hàng đợi đó sẽ được trả về (trừ khi cả `IPC_CREAT` và `IPC_EXCL` đều được chỉ định trong `msgflg`, trong trường hợp đó lỗi sẽ được trả về). Nếu không tìm thấy hàng đợi khớp và `IPC_CREAT` được chỉ định trong `msgflg`, một hàng đợi mới sẽ được tạo và mã định danh của nó sẽ được trả về.

Chương trình trong [Liệt kê 46-1](#page-61-0) cung cấp một giao diện dòng lệnh (command-line interface) cho lời gọi hệ thống msgget(). Chương trình cho phép sử dụng các tùy chọn và tham số dòng lệnh để chỉ định tất cả các khả năng cho các tham số `key` và `msgflg` của msgget(). Chi tiết về định dạng lệnh được chương trình này chấp nhận được hiển thị trong hàm `usageError()`. Khi tạo hàng đợi thành công, chương trình sẽ in ra mã định danh của hàng đợi. Chúng tôi minh họa việc sử dụng chương trình này trong Mục [46.2.2](#page-66-0).

```
Liệt kê 46-1: Sử dụng msgget()
–––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_create.c
## include <sys/types.h>
## include <sys/ipc.h>
## include <sys/msg.h>
## include <sys/stat.h>
## include "tlpi_hdr.h"
```

```
static void /* In thông tin hướng dẫn sử dụng, sau đó thoát */
usageError(const char *progName, const char *msg)
{
 if (msg != NULL)
 fprintf(stderr, "%s", msg);
 fprintf(stderr, "Cách dùng: %s [-cx] {-f pathname | -k key | -p} "
 "[octal-perms]\n", progName);
 fprintf(stderr, " -c Sử dụng cờ IPC_CREAT\n");
 fprintf(stderr, " -x Sử dụng cờ IPC_EXCL\n");
 fprintf(stderr, " -f pathname Tạo khóa sử dụng ftok()\n");
 fprintf(stderr, " -k key Sử dụng 'key' làm khóa\n");
 fprintf(stderr, " -p Sử dụng khóa IPC_PRIVATE\n");
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int numKeyFlags; /* Đếm các tùy chọn -f, -k và -p */
 int flags, msqid, opt;
 unsigned int perms;
 long lkey;
 key_t key;
 /* Phân tích các tùy chọn và tham số dòng lệnh */
 numKeyFlags = 0;
 flags = 0;
 while ((opt = getopt(argc, argv, "cf:k:px")) != -1) {
 switch (opt) {
 case 'c':
 flags |= IPC_CREAT;
 break;
 case 'f': /* -f pathname */
 key = ftok(optarg, 1);
 if (key == -1)
 errExit("ftok");
 numKeyFlags++;
 break;
 case 'k': /* -k key (bát phân, thập phân hoặc thập lục phân) */
 if (sscanf(optarg, "%li", &lkey) != 1)
 cmdLineErr("tùy chọn -k yêu cầu một tham số là số\n");
 key = lkey;
 numKeyFlags++;
 break;
 case 'p':
 key = IPC_PRIVATE;
 numKeyFlags++;
 break;
```

```c
 case 'x':
 flags |= IPC_EXCL;
 break;
 default:
 usageError(argv[0], "Bad option\n");
 }
 }
 if (numKeyFlags != 1)
 usageError(argv[0], "Exactly one of the options -f, -k, "
 "or -p must be supplied\n");
 perms = (optind == argc) ? (S_IRUSR | S_IWUSR) :
 getInt(argv[optind], GN_BASE_8, "octal-perms");
 msqid = msgget(key, flags | perms);
 if (msqid == -1)
 errExit("msgget");
 printf("%d\n", msqid);
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_create.c
```

## 46.2 Trao đổi Thông điệp (Exchanging Messages)

Các system call (lời gọi hệ thống) `msgsnd()` và `msgrcv()` thực hiện các thao tác I/O trên hàng đợi thông điệp (message queue). Đối số đầu tiên của cả hai system call này (`msqid`) là định danh hàng đợi thông điệp (message queue identifier). Đối số thứ hai, `msgp`, là một con trỏ trỏ đến cấu trúc do lập trình viên định nghĩa dùng để chứa thông điệp được gửi hoặc nhận. Cấu trúc này có dạng tổng quát như sau:

```
struct mymsg {
 long mtype; /* Kiểu thông điệp (Message type) */
 char mtext[]; /* Nội dung thông điệp (Message body) */
}
```

Định nghĩa này thực chất chỉ là cách viết tắt để chỉ ra rằng phần đầu của một thông điệp chứa kiểu thông điệp (message type), được định nghĩa là một số nguyên dài (long integer), trong khi phần còn lại của thông điệp là một cấu trúc do lập trình viên tự định nghĩa với độ dài và nội dung tùy ý; nó không nhất thiết phải là một mảng ký tự. Do đó, đối số `msgp` được khai báo với kiểu `void *` để cho phép nó có thể là con trỏ trỏ đến bất kỳ kiểu cấu trúc nào.

Trường `mtext` có độ dài bằng không được cho phép, và đôi khi rất hữu ích nếu thông tin cần truyền tải có thể được mã hóa hoàn toàn trong kiểu thông điệp (message type), hoặc nếu sự tồn tại của một thông điệp bản thân nó đã là đủ thông tin cho tiến trình (process) nhận.

### 46.2.1 Gửi Thông điệp (Sending Messages)

System call `msgsnd()` ghi một thông điệp vào một hàng đợi thông điệp.

```
## include <sys/types.h> /* Cho tính di động (Portability) */
## include <sys/msg.h>
int msgsnd(int msqid, const void *msgp, size_t msgsz, int msgflg);
                                           Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Để gửi một thông điệp bằng `msgsnd()`, chúng ta phải thiết lập trường `mtype` của cấu trúc thông điệp thành một giá trị lớn hơn 0 (chúng ta sẽ thấy giá trị này được sử dụng như thế nào khi thảo luận về `msgrcv()` ở phần tiếp theo) và sao chép thông tin mong muốn vào trường `mtext` do lập trình viên định nghĩa. Đối số `msgsz` chỉ định sốbyte có trong trường `mtext`.

> Khi gửi thông điệp bằng `msgsnd()`, không có khái niệm ghi một phần (partial write) như với `write()`. Đây là lý do tại sao một lời gọi `msgsnd()` thành công chỉ cần trả về 0, thay vì số byte đã được gửi.

Đối số cuối cùng, `msgflg`, là một mặt nạ bit (bit mask) gồm các cờ (flag) điều khiển hoạt động của `msgsnd()`. Chỉ có một cờ như vậy được định nghĩa:

### IPC\_NOWAIT

Thực hiện gửi không chặn (nonblocking send). Thông thường, nếu một hàng đợi thông điệp đã đầy, `msgsnd()` sẽ chặn (block) cho đến khi có đủ dung lượng trống để cho phép thông điệp được đặt vào hàng đợi. Tuy nhiên, nếu cờ này được chỉ định, `msgsnd()` sẽ trả về ngay lập tức với mã lỗi `EAGAIN`.

Một lời gọi `msgsnd()` bị chặn do hàng đợi đầy có thể bị ngắt bởi một trình xử lý tín hiệu (signal handler). Trong trường hợp này, `msgsnd()` luôn thất bại với mã lỗi `EINTR`. (Như đã lưu ý trong Mục 21.5, `msgsnd()` nằm trong số các system call không bao giờ tự động khởi động lại, bất kể cài đặt của cờ `SA_RESTART` khi trình xử lý tín hiệu được thiết lập).

Việc ghi một thông điệp vào hàng đợi thông điệp yêu cầu quyền ghi (write permission) trên hàng đợi đó.

Chương trình trong [Danh sách 46-2](#page-64-0) cung cấp một giao diện dòng lệnh (command-line interface) cho system call `msgsnd()`. Định dạng dòng lệnh được chương trình này chấp nhận được hiển thị trong hàm `usageError()`. Lưu ý rằng chương trình này không sử dụng system call `msgget()`. (Chúng ta đã lưu ý rằng một tiến trình không cần phải sử dụng lời gọi lấy định danh để truy cập một đối tượng IPC trong Mục [45.1](#page-45-0)). Thay vào đó, chúng ta chỉ định hàng đợi thông điệp bằng cách cung cấp định danh của nó như một đối số dòng lệnh. Chúng ta minh họa việc sử dụng chương trình này trong Mục [46.2.2](#page-66-0).

**Danh sách 46-2:** Sử dụng `msgsnd()` để gửi một thông điệp

––––––––––––––––––––––––––––––––––––––––––––––––––––––– **svmsg/svmsg\_send.c** #include <sys/types.h> #include <sys/msg.h> #include "tlpi\_hdr.h" #define MAX\_MTEXT 1024 struct mbuf { long mtype; /\* Kiểu thông điệp \*/ char mtext[MAX\_MTEXT]; /\* Nội dung thông điệp \*/ };

```
static void /* In (tùy chọn) thông điệp, sau đó hiển thị mô tả cách sử dụng */
usageError(const char *progName, const char *msg)
{
 if (msg != NULL)
 fprintf(stderr, "%s", msg);
 fprintf(stderr, "Usage: %s [-n] msqid msg-type [msg-text]\n", progName);
 fprintf(stderr, " -n Sử dụng cờ IPC_NOWAIT\n");
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int msqid, flags, msgLen;
 struct mbuf msg; /* Bộ đệm thông điệp cho msgsnd() */
 int opt; /* Ký tự tùy chọn từ getopt() */
 /* Phân tích cú pháp các tùy chọn và đối số dòng lệnh */
 flags = 0;
 while ((opt = getopt(argc, argv, "n")) != -1) {
 if (opt == 'n')
 flags |= IPC_NOWAIT;
 else
 usageError(argv[0], NULL);
 }
 if (argc < optind + 2 || argc > optind + 3)
 usageError(argv[0], "Sai số lượng đối số\n");
 msqid = getInt(argv[optind], 0, "msqid");
 msg.mtype = getInt(argv[optind + 1], 0, "msg-type");
 if (argc > optind + 2) { /* 'msg-text' đã được cung cấp */
 msgLen = strlen(argv[optind + 2]) + 1;
 if (msgLen > MAX_MTEXT)
 cmdLineErr("msg-text quá dài (tối đa: %d ký tự)\n", MAX_MTEXT);
 memcpy(msg.mtext, argv[optind + 2], msgLen);
 } else { /* Không có 'msg-text' ==> thông điệp có độ dài bằng 0 */
 msgLen = 0;
 }
 /* Gửi thông điệp */
 if (msgsnd(msqid, &msg, msgLen, flags) == -1)
 errExit("msgsnd");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_send.c
```

### 46.2.2 Nhận Thông Điệp (Receiving Messages)

System call `msgrcv()` đọc (và xóa) một thông điệp từ hàng đợi thông điệp (message queue), và sao chép nội dung của nó vào bộ đệm (buffer) được trỏ tới bởi `msgp`.

```c
## include <sys/types.h> /* For portability */
## include <sys/msg.h>
ssize_t msgrcv(int msqid, void *msgp, size_t maxmsgsz, long msgtyp, int msgflg);
                Trả về số byte được sao chép vào trường mtext, hoặc –1 nếu có lỗi
```

Dung lượng tối đa khả dụng trong trường `mtext` của bộ đệm `msgp` được xác định bởi tham số `maxmsgsz`. Nếu phần thân của thông điệp cần lấy ra khỏi hàng đợi vượt quá `maxmsgsz` byte, thì không có thông điệp nào được lấy ra, và `msgrcv()` thất bại với mã lỗi `E2BIG`. (Hành vi mặc định này có thể được thay đổi bằng cách sử dụng cờ `MSG_NOERROR` được mô tả ngay sau đây).

Các thông điệp không nhất thiết phải được đọc theo thứ tự mà chúng được gửi đi. Thay vào đó, chúng ta có thể chọn thông điệp dựa trên giá trị trong trường `mtype`. Việc lựa chọn này được điều khiển bởi tham số `msgtyp`, cụ thể như sau:

- Nếu `msgtyp` bằng 0, thông điệp đầu tiên từ hàng đợi sẽ bị xóa và trả về cho tiến trình gọi (calling process).
- Nếu `msgtyp` lớn hơn 0, thông điệp đầu tiên trong hàng đợi có `mtype` bằng `msgtyp` sẽ bị xóa và trả về cho tiến trình gọi. Bằng cách chỉ định các giá trị khác nhau cho `msgtyp`, nhiều tiến trình có thể đọc từ một hàng đợi thông điệp mà không bị tranh chấp (race) đọc cùng một thông điệp. Một kỹ thuật hữu ích là cho mỗi tiến trình chọn các thông điệp khớp với ID tiến trình (process ID) của nó.
- Nếu `msgtyp` nhỏ hơn 0, các thông điệp đang chờ sẽ được xử lý như một hàng đợi ưu tiên (priority queue). Thông điệp đầu tiên có `mtype` nhỏ nhất nhỏ hơn hoặc bằng giá trị tuyệt đối của `msgtyp` sẽ bị xóa và trả về cho tiến trình gọi.

Một ví dụ sẽ giúp làm rõ hành vi khi `msgtyp` nhỏ hơn 0. Giả sử chúng ta có một hàng đợi thông điệp chứa chuỗi các thông điệp được hiển thị trong Hình 46-1 và chúng ta thực hiện một chuỗi các lời gọi `msgrcv()` có dạng sau:

```c
msgrcv(id, &msg, maxmsgsz, -300, 0);
```

Các lời gọi `msgrcv()` này sẽ lấy các thông điệp theo thứ tự 2 (kiểu 100), 5 (kiểu 100), 3 (kiểu 200), và 1 (kiểu 300). Một lời gọi tiếp theo sẽ bị chặn (block), vì kiểu của thông điệp còn lại (400) vượt quá 300.

Tham số `msgflg` là một mặt nạ bit (bit mask) được tạo bằng cách kết hợp OR từ không hoặc nhiều cờ sau đây:

### `IPC_NOWAIT`

Thực hiện nhận không chặn (nonblocking receive). Thông thường, nếu không có thông điệp nào khớp với `msgtyp` trong hàng đợi, `msgrcv()` sẽ bị chặn cho đến khi một thông điệp như vậy khả dụng. Việc chỉ định cờ `IPC_NOWAIT` khiến `msgrcv()` trả về ngay lập tức với lỗi `ENOMSG`. (Lỗi `EAGAIN` sẽ đồng bộ hơn, giống như xảy ra đối với `msgsnd()` không chặn hoặc thao tác đọc không chặn từ một FIFO. Tuy nhiên, việc trả về lỗi `ENOMSG` là hành vi lịch sử và được yêu cầu bởi tiêu chuẩn SUSv3).

### `MSG_EXCEPT`

Cờ này chỉ có tác dụng nếu `msgtyp` lớn hơn 0, trong trường hợp đó nó ép buộc thực hiện thao tác ngược lại với thông thường; nghĩa là, thông điệp đầu tiên từ hàng đợi có `mtype` không bằng `msgtyp` sẽ bị xóa khỏi hàng đợi và trả về cho bên gọi. Cờ này dành riêng cho Linux (Linux-specific), và chỉ có sẵn từ `<sys/msg.h>` nếu `_GNU_SOURCE` được định nghĩa. Việc thực hiện một chuỗi các lời gọi dạng `msgrcv(id, &msg, maxmsgsz, 100, MSG_EXCEPT)` trên hàng đợi thông điệp được hiển thị trong Hình 46-1 sẽ lấy các thông điệp theo thứ tự 1, 3, 4, và sau đó bị chặn.

### `MSG_NOERROR`

Theo mặc định, nếu kích thước của trường `mtext` của thông điệp vượt quá dung lượng cho phép (được xác định bởi tham số `maxmsgsz`), `msgrcv()` sẽ thất bại. Nếu cờ `MSG_NOERROR` được chỉ định, `msgrcv()` thay vào đó sẽ lấy thông điệp ra khỏi hàng đợi, cắt ngắn (truncate) trường `mtext` của nó xuống còn `maxmsgsz` byte, và trả về cho bên gọi. Dữ liệu bị cắt ngắn sẽ bị mất.

Khi hoàn thành thành công, `msgrcv()` trả về kích thước của trường `mtext` của thông điệp đã nhận; nếu có lỗi, giá trị `–1` được trả về.

| Vị trí hàng đợi<br>(queue position) | Kiểu thông điệp<br>(mtype) | Thân thông điệp<br>(mtext) |
|-------------------------------------|----------------------------|----------------------------|
| 1                                   | 300                        |                            |
| 2                                   | 100                        |                            |
| 3                                   | 200                        |                            |
| 4                                   | 400                        |                            |
| 5                                   | 100                        |                            |

**Hình 46-1:** Ví dụ về một hàng đợi thông điệp chứa các thông điệp có nhiều kiểu khác nhau

Giống như `msgsnd()`, nếu một lời gọi `msgrcv()` đang bị chặn bị ngắt bởi một trình xử lý tín hiệu (signal handler), thì lời gọi đó sẽ thất bại với lỗi `EINTR`, bất kể thiết lập của cờ `SA_RESTART` khi trình xử lý tín hiệu được thiết lập.

Đọc một thông điệp từ hàng đợi thông điệp yêu cầu quyền đọc (read permission) trên hàng đợi đó.

### Chương trình ví dụ

Chương trình trong [Liệt kê 46-3](#page-68-0) cung cấp giao diện dòng lệnh (command-line interface) cho System Call `msgrcv()`. Định dạng dòng lệnh được chấp nhận bởi chương trình này được minh họa trong hàm `usageError()`. Giống như chương trình trong [Liệt kê 46-2](#page-64-0), vốn minh họa việc sử dụng `msgsnd()`, chương trình này không sử dụng System Call `msgget()`, mà thay vào đó nhận một định danh hàng đợi thông điệp (message queue identifier) làm đối số dòng lệnh của nó.

Phiên làm việc trên shell sau đây minh họa việc sử dụng các chương trình trong [Liệt kê 46-1](#page-86-0), [Liệt kê 46-2](#page-64-0), và [Liệt kê 46-3](#page-68-0). Chúng ta bắt đầu bằng cách tạo một hàng đợi thông điệp (message queue) sử dụng khóa `IPC_PRIVATE`, và sau đó ghi ba thông điệp với các kiểu khác nhau vào hàng đợi:

```
$ ./svmsg_create -p
32769 ID of message queue
$ ./svmsg_send 32769 20 "I hear and I forget."
$ ./svmsg_send 32769 10 "I see and I remember."
$ ./svmsg_send 32769 30 "I do and I understand."
```

Sau đó, chúng ta sử dụng chương trình trong [Liệt kê 46-3](#page-68-0) để đọc các thông điệp có kiểu nhỏ hơn hoặc bằng 20 từ hàng đợi:

```
$ ./svmsg_receive -t -20 32769
Received: type=10; length=22; body=I see and I remember.
$ ./svmsg_receive -t -20 32769
Received: type=20; length=21; body=I hear and I forget.
$ ./svmsg_receive -t -20 32769
```

Lệnh cuối cùng trong các lệnh trên đã bị chặn (blocked), bởi vì không có thông điệp nào trong hàng đợi có kiểu nhỏ hơn hoặc bằng 20. Do đó, chúng ta tiếp tục bằng cách gõ Control-C để kết thúc lệnh, rồi thực thi một lệnh đọc thông điệp bất kỳ kiểu nào từ hàng đợi:

```
Type Control-C to terminate program
$ ./svmsg_receive 32769
Received: type=30; length=23; body=I do and I understand.
```

**Liệt kê 46-3:** Sử dụng `msgrcv()` để đọc một thông điệp

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_receive.c
## define _GNU_SOURCE /* Get definition of MSG_EXCEPT */
## include <sys/types.h>
## include <sys/msg.h>
## include "tlpi_hdr.h"
## define MAX_MTEXT 1024
struct mbuf {
 long mtype; /* Message type */
 char mtext[MAX_MTEXT]; /* Message body */
};
static void
usageError(const char *progName, const char *msg)
{
 if (msg != NULL)
 fprintf(stderr, "%s", msg);
 fprintf(stderr, "Usage: %s [options] msqid [max-bytes]\n", progName);
 fprintf(stderr, "Permitted options are:\n");
 fprintf(stderr, " -e Use MSG_NOERROR flag\n");
 fprintf(stderr, " -t type Select message of given type\n");
 fprintf(stderr, " -n Use IPC_NOWAIT flag\n");
```

```
## ifdef MSG_EXCEPT
 fprintf(stderr, " -x Use MSG_EXCEPT flag\n");
## endif
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int msqid, flags, type;
 ssize_t msgLen;
 size_t maxBytes;
 struct mbuf msg; /* Message buffer for msgrcv() */
 int opt; /* Option character from getopt() */
 /* Parse command-line options and arguments */
 flags = 0;
 type = 0;
 while ((opt = getopt(argc, argv, "ent:x")) != -1) {
 switch (opt) {
 case 'e': flags |= MSG_NOERROR; break;
 case 'n': flags |= IPC_NOWAIT; break;
 case 't': type = atoi(optarg); break;
## ifdef MSG_EXCEPT
 case 'x': flags |= MSG_EXCEPT; break;
## endif
 default: usageError(argv[0], NULL);
 }
 }
 if (argc < optind + 1 || argc > optind + 2)
 usageError(argv[0], "Wrong number of arguments\n");
 msqid = getInt(argv[optind], 0, "msqid");
 maxBytes = (argc > optind + 1) ?
 getInt(argv[optind + 1], 0, "max-bytes") : MAX_MTEXT;
 /* Get message and display on stdout */
 msgLen = msgrcv(msqid, &msg, maxBytes, type, flags);
 if (msgLen == -1)
 errExit("msgrcv");
 printf("Received: type=%ld; length=%ld", msg.mtype, (long) msgLen);
 if (msgLen > 0)
 printf("; body=%s", msg.mtext);
 printf("\n");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_receive.c
```

## 46.3 Các thao tác điều khiển hàng đợi thông điệp (Message Queue Control Operations)

System Call `msgctl()` thực hiện các thao tác điều khiển trên hàng đợi thông điệp được định danh bởi `msqid`.

```
## include <sys/types.h> /* For portability */
## include <sys/msg.h>
int msgctl(int msqid, int cmd, struct msqid_ds *buf);
                                           Returns 0 on success, or –1 on error
```

Đối số `cmd` chỉ định thao tác cần thực hiện trên hàng đợi. Nó có thể là một trong các giá trị sau:

### IPC\_RMID

Ngay lập tức xóa đối tượng hàng đợi thông điệp và cấu trúc dữ liệu `msqid_ds` liên quan của nó. Tất cả các thông điệp còn lại trong hàng đợi sẽ bị mất, và bất kỳ Process đọc hoặc ghi nào đang bị chặn (blocked) sẽ được đánh thức ngay lập tức, với `msgsnd()` hoặc `msgrcv()` thất bại kèm theo lỗi `EIDRM`. Đối số thứ ba của `msgctl()` bị bỏ qua đối với thao tác này.

### IPC\_STAT

Đặt một bản sao của cấu trúc dữ liệu `msqid_ds` liên quan đến hàng đợi thông điệp này vào vùng đệm (buffer) do `buf` trỏ tới. Chúng ta mô tả cấu trúc `msqid_ds` trong Mục [46.4](#page-71-0).

### IPC\_SET

Cập nhật các trường được chọn của cấu trúc dữ liệu `msqid_ds` liên quan đến hàng đợi thông điệp này bằng cách sử dụng các giá trị được cung cấp trong vùng đệm do `buf` trỏ tới.

Chi tiết hơn về các thao tác này, bao gồm các đặc quyền (privileges) và quyền hạn (permissions) mà tiến trình gọi (calling process) yêu cầu, được mô tả trong Mục [45.3](#page-50-0). Chúng tôi sẽ mô tả một số giá trị khác cho `cmd` trong Mục [46.6](#page-74-1).

Chương trình trong [Liệt kê 46-4](#page-70-0) minh họa việc sử dụng hàm `msgctl()` để xóa một hàng đợi thông điệp (message queue).

**Liệt kê 46-4:** Xóa hàng đợi thông điệp System V

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_rm.c
## include <sys/types.h>
## include <sys/msg.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int j;
```

```
 if (argc > 1 && strcmp(argv[1], "--help") == 0)
 usageErr("%s [msqid...]\n", argv[0]);
 for (j = 1; j < argc; j++)
 if (msgctl(getInt(argv[j], 0, "msqid"), IPC_RMID, NULL) == -1)
 errExit("msgctl %s", argv[j]);
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_rm.c
```

## 46.4 Cấu trúc dữ liệu liên quan đến hàng đợi thông điệp

Mỗi hàng đợi thông điệp có một cấu trúc dữ liệu `msqid_ds` đi kèm theo dạng sau:

```
struct msqid_ds {
 struct ipc_perm msg_perm; /* Ownership and permissions */
 time_t msg_stime; /* Time of last msgsnd() */
 time_t msg_rtime; /* Time of last msgrcv() */
 time_t msg_ctime; /* Time of last change */
 unsigned long __msg_cbytes; /* Number of bytes in queue */
 msgqnum_t msg_qnum; /* Number of messages in queue */
 msglen_t msg_qbytes; /* Maximum bytes in queue */
 pid_t msg_lspid; /* PID of last msgsnd() */
 pid_t msg_lrpid; /* PID of last msgrcv() */
};
```

Mục đích của việc viết tắt `msq` trong tên cấu trúc `msqid_ds` là để làm rối lập trình viên. Đây là giao diện hàng đợi thông điệp duy nhất sử dụng cách viết tắt này.

Các kiểu dữ liệu `msgqnum_t` và `msglen_t` — được sử dụng để định kiểu cho các trường `msg_qnum` và `msg_qbytes` — là các kiểu số nguyên không dấu (unsigned integer types) được quy định trong chuẩn SUSv3.

Các trường của cấu trúc `msqid_ds` được cập nhật ngầm định bởi các System Call liên quan đến hàng đợi thông điệp, và một số trường nhất định có thể được cập nhật tường minh bằng cách sử dụng thao tác `IPC_SET` của `msgctl()`. Chi tiết cụ thể như sau:

```
msg_perm
```

Khi hàng đợi thông điệp được tạo, các trường của cấu trúc con này được khởi tạo như được mô tả trong Mục [45.3](#page-50-0). Các trường con `uid`, `gid`, và `mode` có thể được cập nhật thông qua `IPC_SET`.

`msg_stime`

Khi hàng đợi được tạo, trường này được đặt thành 0; mỗi lời gọi thành công tiếp theo của `msg_stime` sẽ đặt trường này thành thời gian hiện tại. Trường này và các trường dấu thời gian (timestamp fields) khác trong cấu trúc `msqid_ds` được định kiểu là `time_t`; chúng lưu trữ thời gian tính bằng giây kể từ mốc thời gian Epoch.

`msg_rtime`

Trường này được đặt thành 0 khi hàng đợi thông điệp được tạo, và sau đó được cập nhật thành thời gian hiện tại trong mỗi lần gọi `msgrcv()` thành công.

### `msg_ctime`

Trường này được đặt thành thời gian hiện tại khi hàng đợi thông điệp được tạo và bất cứ khi nào một thao tác `IPC_SET` được thực hiện thành công.

### `__msg_cbytes`

Trường này được đặt thành 0 khi hàng đợi thông điệp được tạo, và sau đó được điều chỉnh trong mỗi lần gọi `msgsnd()` và `msgrcv()` thành công để phản ánh tổng số byte nằm trong các trường `mtext` của tất cả các thông điệp có trong hàng đợi.

### `msg_qnum`

Khi hàng đợi thông điệp được tạo, trường này được đặt thành 0. Giá trị này sau đó sẽ được tăng lên sau mỗi lời gọi `msgsnd()` thành công và giảm xuống sau mỗi lời gọi `msgrcv()` thành công nhằm phản ánh tổng số lượng thông điệp hiện có trong hàng đợi.

### `msg_qbytes`

Giá trị trong trường này xác định giới hạn trên (upper limit) đối với tổng số byte trong các trường `mtext` của tất cả các thông điệp nằm trong hàng đợi thông điệp. Trường này được khởi tạo bằng giá trị giới hạn `MSGMNB` khi hàng đợi được tạo. Một tiến trình có đặc quyền (`CAP_SYS_RESOURCE`) có thể sử dụng thao tác `IPC_SET` để điều chỉnh `msg_qbytes` thành bất kỳ giá trị nào nằm trong khoảng từ 0 đến `INT_MAX` (2,147,483,647 trên các nền tảng 32-bit) byte. Một tiến trình không có đặc quyền (unprivileged process) có thể điều chỉnh `msg_qbytes` thành bất kỳ giá trị nào trong khoảng từ 0 đến `MSGMNB`. Một người dùng có đặc quyền (privileged user) có thể sửa đổi giá trị chứa trong tệp đặc thù của Linux `/proc/sys/kernel/msgmnb` để thay đổi thiết lập `msg_qbytes` ban đầu cho tất cả các hàng đợi thông điệp được tạo sau đó, cũng như giới hạn trên cho các lần thay đổi `msg_qbytes` tiếp theo bởi các tiến trình không có đặc quyền. Chúng ta sẽ bàn kỹ hơn về các giới hạn của hàng đợi thông điệp trong Mục [46.5](#page-73-0).

### `msg_lspid`

Trường này được đặt thành 0 khi hàng đợi được tạo, và sau đó được đặt thành Process ID (PID) của tiến trình gọi trong mỗi lần gọi `msgsnd()` thành công.

### `msg_lrpid`

Trường này được đặt thành 0 khi hàng đợi được tạo, và sau đó được đặt thành Process ID (PID) của tiến trình gọi trong mỗi lần gọi `msgrcv()` thành công.

Tất cả các trường nêu trên đều được quy định bởi chuẩn SUSv3, ngoại trừ `__msg_cbytes`. Mặc dù vậy, hầu hết các cài đặt UNIX đều cung cấp một trường tương đương với trường `__msg_cbytes`.

Chương trình trong [Liệt kê 46-5](#page-72-0) minh họa việc sử dụng các thao tác `IPC_STAT` và `IPC_SET` để sửa đổi thiết lập `msg_qbytes` của một hàng đợi thông điệp.

**Liệt kê 46-5:** Thay đổi thiết lập msg\_qbytes của một hàng đợi thông điệp System V (System V message queue)

–––––––––––––––––––––––––––––––––––––––––––––––––––– **svmsg/svmsg\_chqbytes.c** #include <sys/types.h> #include <sys/msg.h> #include "tlpi\_hdr.h" int main(int argc, char \*argv[]) { struct msqid\_ds ds; int msqid;

```
 if (argc != 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s msqid max-bytes\n", argv[0]);
 /* Retrieve copy of associated data structure from kernel */
 msqid = getInt(argv[1], 0, "msqid");
 if (msgctl(msqid, IPC_STAT, &ds) == -1)
 errExit("msgctl");
 ds.msg_qbytes = getInt(argv[2], 0, "max-bytes");
 /* Update associated data structure in kernel */
 if (msgctl(msqid, IPC_SET, &ds) == -1)
 errExit("msgctl");
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_chqbytes.c
```

## 46.5 Giới hạn của Hàng đợi Thông điệp (Message Queue Limits)

Hầu hết các cài đặt UNIX đều áp đặt các giới hạn khác nhau đối với hoạt động của hàng đợi thông điệp System V (System V message queue). Ở đây, chúng tôi mô tả các giới hạn trên Linux và lưu ý một số điểm khác biệt so với các cài đặt UNIX khác.

Các giới hạn sau đây được áp dụng trên Linux. System Call (system call) bị ảnh hưởng bởi giới hạn và mã lỗi trả về nếu đạt đến giới hạn được ghi chú trong ngoặc đơn.

MSGMNI

Đây là giới hạn trên toàn hệ thống (system-wide limit) đối có số lượng định danh hàng đợi thông điệp (nói cách khác là hàng đợi thông điệp) có thể được tạo. (msgget(), ENOSPC)

MSGMAX

Đây là giới hạn trên toàn hệ thống (system-wide limit) chỉ định số lượng byte (mtext) tối đa có thể được ghi trong một thông điệp đơn. (msgsnd(), EINVAL)

MSGMNB

Đây là số lượng byte (mtext) tối đa có thể được lưu trữ trong một hàng đợi thông điệp tại một thời điểm. Giới hạn này là một tham số toàn hệ thống (system-wide parameter) được sử dụng để khởi tạo trường msg\_qbytes của cấu trúc dữ liệu msqid\_ds liên kết với hàng đợi thông điệp này. Sau đó, giá trị msg\_qbytes có thể được sửa đổi cho từng hàng đợi riêng biệt, như được mô tả trong Mục [46.4](#page-71-0). Nếu giới hạn msg\_qbytes của một hàng đợi bị đạt đến, thì msgsnd() sẽ chặn (block) hoặc thất bại với lỗi EAGAIN nếu cờ IPC\_NOWAIT được thiết lập.

Một số cài đặt UNIX cũng định nghĩa các giới hạn bổ sung sau đây:

MSGTQL

Đây là giới hạn trên toàn hệ thống (system-wide limit) đối với số lượng thông điệp có thể được đặt trên tất cả các hàng đợi thông điệp trong hệ thống.

MSGPOOL

Đây là giới hạn trên toàn hệ thống (system-wide limit) đối với kích thước của vùng đệm (buffer pool) được sử dụng để chứa dữ liệu trong tất cả các hàng đợi thông điệp trên hệ thống.

Mặc dù Linux không áp đặt bất kỳ giới hạn nào trong hai giới hạn trên, nhưng nó giới hạn số lượng thông điệp trên một hàng đợi đơn ở giá trị do thiết lập msg\_qbytes của hàng đợi đó chỉ định. Giới hạn này chỉ có ý nghĩa quan trọng nếu chúng ta ghi các thông điệp có độ dài bằng không vào một hàng đợi. Nó dẫn đến việc giới hạn số lượng thông điệp có độ dài bằng không sẽ giống với giới hạn số lượng thông điệp 1-byte có thể được ghi vào hàng đợi. Điều này là cần thiết để ngăn chặn việc một số lượng vô hạn các thông điệp có độ dài bằng không được ghi vào hàng đợi. Mặc dù chúng không chứa dữ liệu, nhưng mỗi thông điệp có độ dài bằng không vẫn tiêu thụ một lượng nhỏ bộ nhớ cho chi phí quản lý hệ thống (system bookkeeping overhead).

Khi khởi động hệ thống, các giới hạn của hàng đợi thông điệp được đặt về các giá trị mặc định. Các giá trị mặc định này có sự thay đổi đôi chút giữa các phiên bản kernel (kernel versions). (Kernel của một số nhà phân phối đặt các giá trị mặc định khác với các giá trị được cung cấp bởi kernel gốc - vanilla kernel). Trên Linux, các giới hạn có thể được xem hoặc thay đổi thông qua các tệp trong hệ thống tệp `/proc` (/proc file system). [Bảng 46-1](#page-74-2) hiển thị tệp `/proc` tương ứng với mỗi giới hạn. Ví dụ, dưới đây là các giới hạn mặc định mà chúng ta thấy trên Linux 2.6.31 trên một hệ thống x86-32:

```
$ cd /proc/sys/kernel
$ cat msgmni
748
$ cat msgmax
8192
$ cat msgmnb
16384
```

**Bảng 46-1:** Các giới hạn của hàng đợi thông điệp System V

| Giới hạn | Giá trị trần (x86-32) | Tệp tương ứng<br>trong /proc/sys/kernel |
|----------|-----------------------|-----------------------------------------|
| MSGMNI | 32768 (IPCMNI) | msgmni |
| MSGMAX | Tùy thuộc vào bộ nhớ khả dụng | msgmax |
| MSGMNB | 2147483647 (INT_MAX) | msgmnb |

Cột giá trị trần (ceiling value) của [Bảng 46-1](#page-74-2) hiển thị giá trị tối đa mà mỗi giới hạn có thể được nâng lên trên kiến trúc x86-32. Lưu ý rằng mặc dù giới hạn MSGMNB có thể được nâng lên giá trị INT\_MAX, một giới hạn khác (ví dụ: thiếu bộ nhớ) sẽ bị chạm tới trước khi một hàng đợi thông điệp có thể được nạp với lượng dữ liệu lớn như vậy.

Thao tác IPC\_INFO dành riêng cho Linux trong msgctl() sẽ truy xuất một cấu trúc kiểu msginfo, chứa các giá trị của các giới hạn hàng đợi thông điệp khác nhau:

```
struct msginfo buf;
msgctl(0, IPC_INFO, (struct msqid_ds *) &buf);
```

Chi tiết về IPC\_INFO và cấu trúc msginfo có thể được tìm thấy trong trang hướng dẫn (manual page) msgctl(2).

## 46.6 Hiển thị Tất cả Hàng đợi Thông điệp trên Hệ thống

Trong Mục [45.7](#page-58-0), chúng ta đã tìm hiểu một cách để lấy danh sách tất cả các đối tượng IPC (IPC object) trên hệ thống: thông qua một tập hợp các tệp trong hệ thống tệp (file system) `/proc`. Giờ đây, chúng ta xem xét phương pháp thứ hai để thu thập cùng một thông tin: thông qua một tập hợp các thao tác IPC ctl đặc trưng của Linux (`msgctl()`, `semctl()` và `shmctl()`). (Chương trình `ipcs` sử dụng các thao tác này). Các thao tác này bao gồm:

- `MSG_INFO`, `SEM_INFO` và `SHM_INFO`: Thao tác `MSG_INFO` phục vụ hai mục đích. Đầu tiên, nó trả về một cấu trúc chi tiết về các tài nguyên bị tiêu thụ bởi tất cả các hàng đợi thông điệp (message queue) trên hệ thống. Thứ hai, dưới dạng kết quả hàm của lệnh gọi ctl (ctl call), nó trả về chỉ mục (index) của mục lớn nhất trong mảng các mục (`entries` array) trỏ đến các cấu trúc dữ liệu cho các đối tượng hàng đợi thông điệp (xem [Hình 45-1,](#page-55-1) ở trang [932\)](#page-55-1). Các thao tác `SEM_INFO` và `SHM_INFO` thực hiện nhiệm vụ tương tự lần lượt cho các tập hợp semaphore (semaphore set) và các phân đoạn bộ nhớ chia sẻ (shared memory segment). Chúng ta phải định nghĩa macro kiểm tra tính năng `_GNU_SOURCE` để lấy các định nghĩa của ba hằng số này từ các tệp tiêu đề (header file) System V IPC tương ứng.

> [!NOTE]
> Một ví dụ minh họa việc sử dụng `MSG_INFO` để truy xuất cấu trúc `msginfo` chứa thông tin về các tài nguyên được sử dụng bởi tất cả các đối tượng hàng đợi thông điệp được cung cấp trong tệp `svmsg/svmsg_info.c` trong gói mã nguồn của cuốn sách này.

- `MSG_STAT`, `SEM_STAT` và `SHM_STAT`: Giống như thao tác `IPC_STAT`, các thao tác này truy xuất cấu trúc dữ liệu liên quan cho một đối tượng IPC. Tuy nhiên, chúng khác nhau ở hai điểm. Đầu tiên, thay vì mong đợi một định danh IPC (IPC identifier) làm đối số đầu tiên của lệnh gọi ctl, các thao tác này mong đợi một chỉ mục vào mảng `entries`. Thứ hai, nếu thao tác thành công, thì dưới dạng kết quả hàm của nó, lệnh gọi ctl trả về định danh của đối tượng IPC tương ứng với chỉ mục đó. Chúng ta phải định nghĩa macro kiểm tra tính năng `_GNU_SOURCE` để lấy các định nghĩa của ba hằng số này từ các tệp tiêu đề System V IPC tương ứng.

Để liệt kê tất cả các hàng đợi thông điệp trên hệ thống, chúng ta có thể thực hiện các bước sau:

- 1. Sử dụng thao tác `MSG_INFO` để tìm chỉ mục lớn nhất (`maxind`) của mảng `entries` cho các hàng đợi thông điệp.
- 2. Thực hiện một vòng lặp cho tất cả các giá trị từ 0 cho đến và bao gồm `maxind`, sử dụng thao tác `MSG_STAT` cho mỗi giá trị. Trong vòng lặp này, chúng ta bỏ qua các lỗi có thể xảy ra nếu một mục của mảng `entries` trống (`EINVAL`) hoặc nếu chúng ta không có quyền truy cập vào đối tượng mà nó trỏ tới (`EACCES`).

[Liệt kê 46-6](#page-76-0) cung cấp một bản cài đặt (implementation) của các bước trên cho hàng đợi thông điệp. Nhật ký phiên làm việc shell sau đây minh họa việc sử dụng chương trình này:

## \$ **./svmsg\_ls** maxind: 4 index ID key messages 2 98306 0x00000000 0 4 163844 0x000004d2 2 \$ **ipcs -q** Kiểm tra kết quả trên với đầu ra của lệnh ipcs ------ Message Queues ------- key msqid owner perms used-bytes messages 0x00000000 98306 mtk 600 0 0 0x000004d2 163844 mtk 600 12 2

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_ls.c
## define _GNU_SOURCE
## include <sys/types.h>
## include <sys/msg.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int maxind, ind, msqid;
 struct msqid_ds ds;
 struct msginfo msginfo;
 /* Lấy kích thước mảng 'entries' của kernel */
 maxind = msgctl(0, MSG_INFO, (struct msqid_ds *) &msginfo);
 if (maxind == -1)
 errExit("msgctl-MSG_INFO");
 printf("maxind: %d\n\n", maxind);
 printf("index id key messages\n");
 /* Truy xuất và hiển thị thông tin từ mỗi phần tử của mảng 'entries' */
 for (ind = 0; ind <= maxind; ind++) {
 msqid = msgctl(ind, MSG_STAT, &ds);
 if (msqid == -1) {
 if (errno != EINVAL && errno != EACCES)
 errMsg("msgctl-MSG_STAT"); /* Lỗi không mong đợi */
 continue; /* Bỏ qua mục này */
 }
 printf("%4d %8d 0x%08lx %7ld\n", ind, msqid,
 (unsigned long) ds.msg_perm.__key, (long) ds.msg_qnum);
 }
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_ls.c
```

## 46.7 Lập trình Client-Server với Message Queue

Trong phần này, chúng ta xem xét hai trong số các thiết kế khả dĩ cho các ứng dụng client-server sử dụng System V message queue:

- Sử dụng một message queue duy nhất để trao đổi thông điệp theo cả hai hướng giữa server và client.
- Sử dụng các message queue riêng biệt cho server và cho mỗi client. Queue của server được dùng để nhận các yêu cầu (request) đến từ client, và các phản hồi (response) được gửi tới client thông qua các queue riêng của từng client.

Cách tiếp cận nào được chọn sẽ phụ thuộc vào các yêu cầu của ứng dụng. Tiếp theo, chúng ta sẽ xem xét một số yếu tố có thể ảnh hưởng đến sự lựa chọn của chúng ta.

## Sử dụng một message queue duy nhất cho server và các client

Sử dụng một message queue duy nhất có thể phù hợp khi các thông điệp trao đổi giữa server và client có kích thước nhỏ. Tuy nhiên, cần lưu ý các điểm sau:

- Vì nhiều process (tiến trình) có thể cố gắng đọc thông điệp cùng một lúc, chúng ta phải sử dụng trường loại thông điệp (`mtype`) để cho phép mỗi process chỉ chọn những thông điệp dành riêng cho nó. Một cách để thực hiện điều này là sử dụng Process ID (PID) của client làm loại thông điệp cho các thông điệp được gửi từ server đến client. Client có thể gửi Process ID của chính nó như một phần trong (các) thông điệp của nó tới server. Hơn nữa, các thông điệp gửi tới server cũng phải được phân biệt bằng một loại thông điệp duy nhất. Vì mục đích này, chúng ta có thể sử dụng số 1, vốn là Process ID của process `init` chạy vĩnh viễn, nên không bao giờ trùng với Process ID của một client process nào khác. (Một giải pháp thay thế là sử dụng Process ID của server làm loại thông điệp; tuy nhiên, rất khó để các client có được thông tin này). Sơ đồ đánh số này được minh họa trong Hình 46-2.
- Message queue có dung tích giới hạn. Điều này có tiềm năng gây ra một vài vấn đề. Một trong số đó là nhiều client đồng thời có thể làm đầy message queue, dẫn đến tình trạng deadlock (bế tắc), nơi không có yêu cầu client mới nào có thể được gửi lên và server bị block (chặn) khi muốn ghi bất kỳ phản hồi nào. Vấn đề thứ hai là một client hoạt động không đúng chuẩn hoặc cố ý phá hoại có thể không đọc các phản hồi từ server. Điều này có thể dẫn đến việc queue bị tắc nghẽn bởi các thông điệp chưa đọc, ngăn cản mọi giao tiếp giữa client và server. (Sử dụng hai queue — một cho các thông điệp từ client gửi đến server, và queue còn lại cho các thông điệp từ server gửi đến client — sẽ giải quyết được vấn đề đầu tiên, nhưng không giải quyết được vấn đề thứ hai.)

![](_page_77_Figure_5.jpeg)

**Hình 46-2:** Sử dụng một message queue duy nhất cho IPC client-server

### Sử dụng một hàng đợi thông điệp cho mỗi client

Việc sử dụng một hàng đợi thông điệp (message queue) cho mỗi client (cũng như một cho server) sẽ là phương án thích hợp hơn trong trường hợp cần trao đổi các thông điệp lớn (large messages), hoặc khi có tiềm ẩn các vấn đề đã nêu ở trên lúc chỉ dùng một hàng đợi thông điệp duy nhất. Hãy lưu ý các điểm sau đối với phương pháp này:

- Mỗi client phải tự tạo hàng đợi thông điệp của riêng mình (thường sử dụng khóa `IPC_PRIVATE`) và thông báo định danh (identifier) của hàng đợi đó cho server, thông thường bằng cách truyền định danh như một phần trong (các) thông điệp của client gửi đến server.
- Có một giới hạn trên toàn hệ thống (system-wide limit) (`MSGMNI`) về số lượng hàng đợi thông điệp, và giá trị mặc định cho giới hạn này khá thấp trên một số hệ thống. Nếu chúng ta dự kiến có một số lượng lớn client kết nối đồng thời (simultaneous clients), chúng ta có thể cần phải tăng giới hạn này lên.
- Server nên tính toán đến trường hợp hàng đợi thông điệp của client không còn tồn tại (có thể do client đã xóa nó trước thời hạn).

Chúng ta sẽ bàn thêm về việc sử dụng một hàng đợi thông điệp cho mỗi client ở phần tiếp theo.

## 46.8 Ứng dụng File-Server sử dụng Hàng đợi Thông điệp

Trong phần này, chúng ta mô tả một ứng dụng client-server sử dụng một hàng đợi thông điệp cho mỗi client. Ứng dụng này là một file server đơn giản. Client gửi một thông điệp yêu cầu (request message) đến hàng đợi thông điệp của server để hỏi nội dung của một tệp có tên. Server phản hồi bằng cách trả về nội dung tệp dưới dạng một chuỗi các thông điệp đến hàng đợi thông điệp riêng của client. Hình 46-3 cung cấp một cái nhìn tổng quan về ứng dụng.

Vì server không thực hiện xác thực (authentication) client, bất kỳ người dùng nào có thể chạy client đều có thể lấy được bất kỳ tệp nào mà server có quyền truy cập. Một server phức tạp hơn sẽ yêu cầu một số loại xác thực từ phía client trước khi phục vụ tệp được yêu cầu.

![](_page_78_Figure_8.jpeg)

Hình 46-3: IPC client-server sử dụng một hàng đợi thông điệp cho mỗi client

### Tệp tiêu đề chung (Common header file)

Liệt kê 46-7 là tệp tiêu đề được bao gồm (include) bởi cả server và client. Tệp tiêu đề này định nghĩa khóa nổi tiếng (well-known key) sẽ được sử dụng cho hàng đợi thông điệp của server (`SERVER_KEY`), đồng thời định nghĩa các định dạng của các thông điệp sẽ được truyền giữa client và server.

Cấu trúc `requestMsg` định dạng yêu cầu được gửi từ client tới server. Trong cấu trúc này, thành phần `mtext` bao gồm hai trường: định danh của hàng đợi thông điệp của client và đường dẫn (pathname) của tệp được yêu cầu bởi client. Hằng số `REQ_MSG_SIZE` bằng tổng kích thước của hai trường này và được sử dụng làm đối số `msgsz` trong các lời gọi hàm `msgsnd()` sử dụng cấu trúc này.

Cấu trúc `responseMsg` định dạng các thông điệp phản hồi được gửi từ server trở lại client. Trường `mtype` được sử dụng trong các thông điệp phản hồi để cung cấp thông tin về nội dung thông điệp, theo định nghĩa của các hằng số `RESP_MT_*`.

**Liệt kê 46-7:** Tệp tiêu đề cho `svmsg_file_server.c` và `svmsg_file_client.c`

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_file.h
## include <sys/types.h>
## include <sys/msg.h>
## include <sys/stat.h>
## include <stddef.h> /* For definition of offsetof() */
## include <limits.h>
## include <fcntl.h>
## include <signal.h>
## include <sys/wait.h>
## include "tlpi_hdr.h"
## define SERVER_KEY 0x1aaaaaa1 /* Key for server's message queue */
struct requestMsg { /* Requests (client to server) */
 long mtype; /* Unused */
 int clientId; /* ID of client's message queue */
 char pathname[PATH_MAX]; /* File to be returned */
};
/* REQ_MSG_SIZE computes size of 'mtext' part of 'requestMsg' structure.
 We use offsetof() to handle the possibility that there are padding
 bytes between the 'clientId' and 'pathname' fields. */
## define REQ_MSG_SIZE (offsetof(struct requestMsg, pathname) - \
 offsetof(struct requestMsg, clientId) + PATH_MAX)
## define RESP_MSG_SIZE 8192
struct responseMsg { /* Responses (server to client) */
 long mtype; /* One of RESP_MT_* values below */
 char data[RESP_MSG_SIZE]; /* File content / response message */
};
/* Types for response messages sent from server to client */
## define RESP_MT_FAILURE 1 /* File couldn't be opened */
## define RESP_MT_DATA 2 /* Message contains file data */
## define RESP_MT_END 3 /* File data complete */
––––––––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_file.h
```

### Chương trình máy chủ (Server program)

[Listing 46-8](#page-80-0) là chương trình máy chủ (server) cho ứng dụng. Hãy lưu ý các điểm sau đây về máy chủ:

- Máy chủ được thiết kế để xử lý các yêu cầu một cách đồng thời (concurrently). Thiết kế máy chủ đồng thời (concurrent server design) tốt hơn thiết kế tuần tự (iterative design) được sử dụng trong [Listing 44-7](#page-35-0) (trang [912](#page-35-0)), vì chúng ta muốn tránh trường hợp yêu cầu tệp lớn từ một client khiến tất cả các yêu cầu client khác phải chờ đợi.
- Mỗi yêu cầu từ client (client request) được xử lý bằng cách tạo ra một tiến trình con (child process) phục vụ tệp được yêu cầu i. Trong thời gian đó, tiến trình máy chủ chính (main server process) chờ các yêu cầu client tiếp theo. Lưu ý các điểm sau về tiến trình con của máy chủ (server child):
  - Vì tiến trình con được tạo ra thông qua `fork()` kế thừa một bản sao stack của tiến trình cha (parent), nên nó nhận được một bản sao của thông điệp yêu cầu (request message) do tiến trình máy chủ chính đọc.
  - Tiến trình con của máy chủ chấm dứt hoạt động (terminate) sau khi xử lý yêu cầu client liên quan o.
- Để tránh tạo ra các tiến trình thê tử / tiến trình thây ma (zombie process) (Mục 26.2), máy chủ thiết lập một trình xử lý (handler) cho tín hiệu `SIGCHLD` y và gọi `waitpid()` bên trong trình xử lý này q.
- Lời gọi `msgrcv()` trong tiến trình máy chủ cha có thể bị chặn (block), và do đó có thể bị ngắt bởi trình xử lý `SIGCHLD`. Để xử lý trường hợp này, một vòng lặp được sử dụng để khởi động lại lời gọi nếu nó thất bại với lỗi `EINTR` u.
- Tiến trình con của máy chủ thực thi hàm `serveRequest()` w, hàm này gửi ba loại thông điệp (message types) trở lại client. Yêu cầu với `mtype` là `RESP_MT_FAILURE` biểu thị rằng máy chủ không thể mở tệp được yêu cầu e; `RESP_MT_DATA` được sử dụng cho một chuỗi thông điệp chứa dữ liệu tệp r; và `RESP_MT_END` (với trường dữ liệu có độ dài bằng không) được sử dụng để biểu thị rằng quá trình truyền dữ liệu tệp đã hoàn tất t.

Chúng ta xem xét một số cách để cải tiến và mở rộng chương trình máy chủ trong [Bài tập 46-4](#page-86-1).

**Listing 46-8:** Một máy chủ tệp sử dụng hàng đợi thông điệp System V (System V message queues)

```
––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_file_server.c
## include "svmsg_file.h"
  static void /* SIGCHLD handler */
  grimReaper(int sig)
  {
   int savedErrno;
   savedErrno = errno; /* waitpid() might change 'errno' */
q while (waitpid(-1, NULL, WNOHANG) > 0)
   continue;
   errno = savedErrno;
  }
```

```
static void /* Executed in child process: serve a single client */
w serveRequest(const struct requestMsg *req)
  {
   int fd;
   ssize_t numRead;
   struct responseMsg resp;
   fd = open(req->pathname, O_RDONLY);
   if (fd == -1) { /* Open failed: send error text */
e resp.mtype = RESP_MT_FAILURE;
   snprintf(resp.data, sizeof(resp.data), "%s", "Couldn't open");
   msgsnd(req->clientId, &resp, strlen(resp.data) + 1, 0);
   exit(EXIT_FAILURE); /* and terminate */
   }
   /* Transmit file contents in messages with type RESP_MT_DATA. We don't
   diagnose read() and msgsnd() errors since we can't notify client. */
r resp.mtype = RESP_MT_DATA;
   while ((numRead = read(fd, resp.data, RESP_MSG_SIZE)) > 0)
   if (msgsnd(req->clientId, &resp, numRead, 0) == -1)
   break;
   /* Send a message of type RESP_MT_END to signify end-of-file */
t resp.mtype = RESP_MT_END;
   msgsnd(req->clientId, &resp, 0, 0); /* Zero-length mtext */
  }
  int
  main(int argc, char *argv[])
  {
   struct requestMsg req;
   pid_t pid;
   ssize_t msgLen;
   int serverId;
   struct sigaction sa;
   /* Create server message queue */
   serverId = msgget(SERVER_KEY, IPC_CREAT | IPC_EXCL |
   S_IRUSR | S_IWUSR | S_IWGRP);
   if (serverId == -1)
   errExit("msgget");
   /* Establish SIGCHLD handler to reap terminated children */
   sigemptyset(&sa.sa_mask);
   sa.sa_flags = SA_RESTART;
   sa.sa_handler = grimReaper;
y if (sigaction(SIGCHLD, &sa, NULL) == -1)
   errExit("sigaction");
```

```
 /* Read requests, handle each in a separate child process */
   for (;;) {
   msgLen = msgrcv(serverId, &req, REQ_MSG_SIZE, 0, 0);
   if (msgLen == -1) {
u if (errno == EINTR) /* Interrupted by SIGCHLD handler? */
   continue; /* ... then restart msgrcv() */
   errMsg("msgrcv"); /* Some other error */
   break; /* ... so terminate loop */
   }
i pid = fork(); /* Create child process */
   if (pid == -1) {
   errMsg("fork");
   break;
   }
   if (pid == 0) { /* Child handles request */
   serveRequest(&req);
o _exit(EXIT_SUCCESS);
   }
   /* Parent loops to receive next client request */
   }
   /* If msgrcv() or fork() fails, remove server MQ and exit */
   if (msgctl(serverId, IPC_RMID, NULL) == -1)
   errExit("msgctl");
   exit(EXIT_SUCCESS);
  }
  ––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_file_server.c
```

## Chương trình Client

[Listing 46-9](#page-83-0) là chương trình client cho ứng dụng. Cần lưu ý các điểm sau:

- Client tạo một hàng đợi thông điệp (message queue) với khóa `IPC_PRIVATE` w và sử dụng `atexit()` e để thiết lập một hàm xử lý thoát (exit handler) nhằm đảm bảo rằng hàng đợi sẽ bị xóa khi client thoát.
- Client truyền định danh (identifier) của hàng đợi của mình, cũng như đường dẫn (pathname) của tệp cần phục vụ, trong một yêu cầu gửi tới server r.
- Client xử lý khả năng thông điệp phản hồi đầu tiên do server gửi tới có thể là một thông báo lỗi (mtype bằng `RESP_MT_FAILURE`) bằng cách in ra văn bản thông báo lỗi do server trả về và thoát t.
- Nếu tệp được mở thành công, client sẽ thực hiện vòng lặp y, nhận một chuỗi các thông điệp chứa nội dung tệp (mtype bằng `RESP_MT_DATA`). Vòng lặp kết thúc khi nhận được thông điệp kết thúc tệp (end-of-file message) (mtype bằng `RESP_MT_END`).

Chương trình client đơn giản này không xử lý các trường hợp khác nhau phát sinh từ lỗi ở phía server. Chúng ta sẽ xem xét một số cải tiến trong Bài tập [46-5.](#page-87-0)

```
––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_file_client.c
## include "svmsg_file.h"
  static int clientId;
  static void
  removeQueue(void)
  {
   if (msgctl(clientId, IPC_RMID, NULL) == -1)
q errExit("msgctl");
  }
  int
  main(int argc, char *argv[])
  {
   struct requestMsg req;
   struct responseMsg resp;
   int serverId, numMsgs;
   ssize_t msgLen, totBytes;
   if (argc != 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s pathname\n", argv[0]);
   if (strlen(argv[1]) > sizeof(req.pathname) - 1)
   cmdLineErr("pathname too long (max: %ld bytes)\n",
   (long) sizeof(req.pathname) - 1);
   /* Lấy định danh hàng đợi của server; tạo hàng đợi cho phản hồi */
   serverId = msgget(SERVER_KEY, S_IWUSR);
   if (serverId == -1)
   errExit("msgget - server message queue");
w clientId = msgget(IPC_PRIVATE, S_IRUSR | S_IWUSR | S_IWGRP);
   if (clientId == -1)
   errExit("msgget - client message queue");
e if (atexit(removeQueue) != 0)
   errExit("atexit");
   /* Gửi thông điệp yêu cầu tệp có tên trong argv[1] */
   req.mtype = 1; /* Dùng loại nào cũng được */
   req.clientId = clientId;
   strncpy(req.pathname, argv[1], sizeof(req.pathname) - 1);
   req.pathname[sizeof(req.pathname) - 1] = '\0';
   /* Đảm bảo chuỗi được kết thúc bằng null */
r if (msgsnd(serverId, &req, REQ_MSG_SIZE, 0) == -1)
   errExit("msgsnd");
```

```
 /* Nhận phản hồi đầu tiên, có thể là thông báo lỗi */
   msgLen = msgrcv(clientId, &resp, RESP_MSG_SIZE, 0, 0);
   if (msgLen == -1)
   errExit("msgrcv");
t if (resp.mtype == RESP_MT_FAILURE) {
   printf("%s\n", resp.data); /* Hiển thị thông điệp từ server */
   if (msgctl(clientId, IPC_RMID, NULL) == -1)
   errExit("msgctl");
   exit(EXIT_FAILURE);
   }
   /* Tệp được server mở thành công; xử lý các thông điệp
   (bao gồm thông điệp đã nhận) chứa dữ liệu tệp */
   totBytes = msgLen; /* Đếm thông điệp đầu tiên */
y for (numMsgs = 1; resp.mtype == RESP_MT_DATA; numMsgs++) {
   msgLen = msgrcv(clientId, &resp, RESP_MSG_SIZE, 0, 0);
   if (msgLen == -1)
   errExit("msgrcv");
   totBytes += msgLen;
   }
   printf("Received %ld bytes (%d messages)\n", (long) totBytes, numMsgs);
   exit(EXIT_SUCCESS);
  }
  ––––––––––––––––––––––––––––––––––––––––––––––––– svmsg/svmsg_file_client.c
```

Phiên làm việc shell sau đây minh họa cách sử dụng các chương trình trong [Listing 46-8](#page-80-0) và [Listing 46-9:](#page-83-0)

```
$ ./svmsg_file_server & Chạy server ở chế độ nền (background)
[1] 9149
$ wc -c /etc/services Hiển thị kích thước tệp mà client sẽ yêu cầu
764360 /etc/services
$ ./svmsg_file_client /etc/services 
Received 764360 bytes (95 messages) Số byte nhận được khớp với kích thước ở trên
$ kill %1 Kết thúc server
[1]+ Terminated ./svmsg_file_server
```

## 46.9 Nhược điểm của System V Message Queue

Các hệ thống UNIX cung cấp một số cơ chế để truyền dữ liệu từ tiến trình (process) này sang tiến trình khác trên cùng một hệ thống, dưới dạng luồng byte không phân định ranh giới (undelimited byte stream) (pipes, FIFOs, và UNIX domain stream sockets) hoặc dưới dạng các thông điệp có phân định (delimited messages) (System V message queues, POSIX message queues, và UNIX domain datagram sockets).

Một tính năng đặc trưng của System V message queue là khả năng gắn một kiểu số (numeric type) vào mỗi thông điệp. Điều này mang lại hai khả năng có ích cho các ứng dụng: các tiến trình đọc có thể chọn thông điệp theo kiểu (type), hoặc chúng có thể áp dụng chiến lược hàng đợi ưu tiên (priority-queue strategy) sao cho các thông điệp có độ ưu tiên cao hơn (tức là các thông điệp có giá trị kiểu nhỏ hơn) được đọc trước.

Tuy nhiên, System V message queue có một số nhược điểm sau:

- Message queue được tham chiếu thông qua các định danh (identifiers), thay vì các tệp mô tả (file descriptors) được sử dụng bởi hầu hết các cơ chế I/O UNIX khác. Điều này có nghĩa là các kỹ thuật I/O dựa trên file descriptor được mô tả trong Chương 63 (ví dụ: `select()`, `poll()`, và `epoll`) không thể áp dụng cho message queue. Hơn nữa, việc viết các chương trình xử lý đồng thời đầu vào từ cả message queue và các cơ chế I/O dựa trên file descriptor đòi hỏi mã nguồn phức tạp hơn so với mã nguồn chỉ xử lý các file descriptor đơn thuần. (Chúng ta sẽ xem xét một cách kết hợp hai mô hình I/O này trong Bài tập 63-3).

- Việc sử dụng các key (khóa) thay vì tên file (filename) để định danh hàng đợi thông điệp (message queue) dẫn đến độ phức tạp trong lập trình tăng lên và cũng đòi hỏi phải sử dụng các lệnh `ipcs` và `ipcrm` thay vì `ls` và `rm`. Hàm `ftok()` thường tạo ra một key duy nhất, nhưng điều đó không được đảm bảo tuyệt đối. Việc sử dụng key `IPC_PRIVATE` đảm bảo một định danh hàng đợi duy nhất, nhưng lại đẩy trách nhiệm làm cho định danh đó hiển thị được với các process ( tiến trình) khác đang cần đến nó sang cho chúng ta.
- Các message queue không có kết nối (connectionless), và kernel không duy trì bộ đếm số lượng process đang tham chiếu đến hàng đợi như cách làm với pipe, FIFO và socket. Do đó, rất khó để trả lời các câu hỏi sau:
  - Khi nào thì một ứng dụng có thể xóa một message queue một cách an toàn? (Việc xóa hàng đợi quá sớm dẫn đến mất dữ liệu ngay lập tức, bất kể có process nào có thể muốn đọc từ hàng đợi đó sau này hay không).
  - Làm thế nào một ứng dụng có thể đảm bảo rằng một hàng đợi không sử dụng đã bị xóa?
- Tồn tại các giới hạn về tổng số lượng message queue, kích thước của thông điệp và dung lượng của từng hàng đợi riêng lẻ. Các giới hạn này có thể cấu hình được, nhưng nếu một ứng dụng hoạt động ngoài phạm vi giới hạn mặc định, điều này đòi hỏi thêm công sức khi cài đặt ứng dụng.

Tóm lại, tốt nhất là nên tránh sử dụng System V message queues. Trong các tình huống chúng ta cần tính năng lựa chọn thông điệp theo kiểu (type), chúng ta nên cân nhắc các giải pháp thay thế. POSIX message queues (Chương 52) là một giải pháp thay thế như vậy. Một giải pháp thay thế khác, các giải pháp liên quan đến nhiều kênh truyền thông dựa trên file descriptor (bộ mô tả file), có thể cung cấp chức năng tương tự như việc lựa chọn thông điệp theo kiểu, đồng thời cho phép sử dụng các mô hình I/O thay thế được mô tả trong Chương 63. Ví dụ, nếu chúng ta cần truyền các thông điệp "thường" (`normal`) và "ưu tiên" (`priority`), chúng ta có thể sử dụng một cặp FIFO hoặc UNIX domain socket cho hai loại thông điệp đó, và sau đó dùng `select()` hoặc `poll()` để giám sát các file descriptor cho cả hai kênh.

## 46.10 Tóm tắt

System V message queues cho phép các process giao tiếp bằng cách trao đổi các thông điệp bao gồm một kiểu số (numeric type) cộng với phần thân chứa dữ liệu tùy ý. Các đặc điểm nổi bật của message queue là ranh giới thông điệp được bảo toàn và (các) bên nhận có thể lựa chọn thông điệp theo kiểu, thay vì đọc thông điệp theo thứ tự vào trước, ra trước (first-in, first-out order).

Các yếu tố khác nhau dẫn đến kết luận rằng các cơ chế IPC khác thường được ưu tiên hơn System V message queues. Một khó khăn lớn là message queue không được tham chiếu bằng cách sử dụng file descriptor. Điều này có nghĩa là chúng ta không thể áp dụng các mô hình I/O thay thế khác nhau với message queue; cụ thể là, việc đồng thời giám sát cả message queue lẫn file descriptor để xem liệu I/O có khả thi hay không là rất phức tạp. Hơn nữa, thực tế là message queue không có kết nối (nghĩa là không được đếm tham chiếu - reference counted) làm cho ứng dụng khó biết được khi nào một hàng đợi có thể được xóa một cách an toàn.

## 46.11 Bài tập

- **46-1.** Thử nghiệm với các chương trình trong [Liệt kê 46-1](#page-61-0) (svmsg\_create.c), [Liệt kê 46-2](#page-64-0) (svmsg\_send.c), và [Liệt kê 46-3](#page-68-0) (svmsg\_receive.c) để xác nhận sự hiểu biết của bạn về các system call (lời gọi hệ thống) `msgget()`, `msgsnd()`, và `msgrcv()`.
- **46-2.** Viết lại ứng dụng client-server (máy khách-máy chủ) tạo số thứ tự ở Mục [44.8](#page-32-0) sử dụng hàng đợi thông điệp System V (System V message queues). Sử dụng một hàng đợi thông điệp duy nhất để truyền thông điệp từ cả client sang server và từ server sang client. Áp dụng các quy ước về loại thông điệp được mô tả ở Mục [46.8.](#page-78-1)
- **46-3.** Trong ứng dụng client-server ở Mục [46.8,](#page-78-1) tại sao client lại truyền định danh (identifier) của hàng đợi thông điệp của chính nó trong phần thân của thông điệp (trong trường `clientId`), thay vì truyền trong loại thông điệp (`mtype`)?
- **46-4.** Thực hiện các thay đổi sau đối với ứng dụng client-server ở Mục [46.8:](#page-78-1)
  - a) Thay thế việc sử dụng một key (khóa) hàng đợi thông điệp được mã hóa cứng (hard-coded) bằng đoạn mã trong server sử dụng `IPC_PRIVATE` để tạo một định danh duy nhất, sau đó ghi định danh này vào một tệp nổi tiếng (well-known file). Client phải đọc định danh từ tệp này. Server phải xóa tệp này nếu nó kết thúc.
  - b) Trong hàm `serveRequest()` của chương trình server, các lỗi của system call không được chẩn đoán. Thêm mã ghi nhật ký lỗi sử dụng `syslog()` (Mục 37.5).
  - c) Thêm mã vào server để nó trở thành một daemon (tiến trình nền) khi khởi động (Mục 37.2).
  - d) Trong server, thêm một trình xử lý (handler) cho `SIGTERM` và `SIGINT` để thực hiện việc thoát sạch sẽ (tidy exit). Trình xử lý nên xóa hàng đợi thông điệp và (nếu phần trước của bài tập này được thực hiện) tệp được tạo để lưu định danh hàng đợi thông điệp của server. Đưa vào trình xử lý mã để chấm dứt server bằng cách hủy thiết lập trình xử lý, sau đó kích hoạt lại tín hiệu đã gọi trình xử lý đó (xem Mục 26.1.4 về lý do và các bước cần thiết cho tác vụ này).
  - e) Tiến trình con của server không xử lý khả năng client có thể chấm dứt sớm, trong trường hợp đó tiến trình con của server sẽ làm đầy hàng đợi thông điệp của client, và sau đó bị chặn (block) vô thời hạn. Sửa đổi server để xử lý khả năng này bằng cách thiết lập thời gian chờ (timeout) khi gọi `msgsnd()`, như được mô tả trong Mục 23.3. Nếu tiến trình con của server đánh giá rằng client đã biến mất, nó nên cố gắng xóa hàng đợi thông điệp của client, sau đó thoát (có thể sau khi ghi nhật ký thông báo qua `syslog()`).

- **46-5.** Client được hiển thị trong [Liệt kê 46-9](#page-83-0) (`svmsg_file_client.c`) không xử lý các khả năng xảy ra lỗi khác nhau ở server. Cụ thể, nếu hàng đợi thông điệp của server bị đầy (có thể do server đã kết thúc và hàng đợi bị làm đầy bởi các client khác), thì lời gọi `msgsnd()` sẽ bị chặn vô thời hạn. Tương tự, nếu server không gửi được phản hồi cho client, thì lời gọi `msgrcv()` sẽ bị chặn vô thời hạn. Thêm mã vào client để thiết lập thời gian chờ (Mục 23.3) cho các lời gọi này. Nếu một trong hai lời gọi bị quá thời gian, chương trình sẽ báo lỗi cho người dùng và kết thúc.
- **46-6.** Viết một ứng dụng trò chuyện (chat) đơn giản (tương tự như `talk(1)`, nhưng không có giao diện curses) sử dụng hàng đợi thông điệp System V. Sử dụng một hàng đợi thông điệp duy nhất cho mỗi client.
