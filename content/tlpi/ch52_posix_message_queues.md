# Chương 52: HÀNG ĐỢI THÔNG ĐIỆP POSIX (POSIX MESSAGE QUEUES)

Chương trình này mô tả các hàng đợi thông điệp POSIX (POSIX message queues), cho phép các tiến trình (process) trao đổi dữ liệu dưới dạng các thông điệp (message). Hàng đợi thông điệp POSIX tương tự như các đối tác System V của chúng ở điểm dữ liệu được trao đổi theo đơn vị là các thông điệp nguyên vẹn. Tuy nhiên, cũng có một số điểm khác biệt đáng chú ý:

- Hàng đợi thông điệp POSIX được quản lý tham chiếu (reference counted). Một hàng đợi được đánh dấu để xóa chỉ bị gỡ bỏ sau khi nó đã bị đóng bởi tất cả các tiến trình hiện đang sử dụng nó.
- Mỗi thông điệp System V có một kiểu số nguyên (integer type), và các thông điệp có thể được lựa chọn theo nhiều cách khác nhau bằng cách sử dụng `msgrcv()`. Ngược lại, các thông điệp POSIX có một mức độ ưu tiên (priority) đi kèm, và các thông điệp luôn được xếp hàng một cách nghiêm ngặt (và do đó được nhận) theo thứ tự ưu tiên.
- Hàng đợi thông điệp POSIX cung cấp một tính năng cho phép một tiến trình nhận thông báo bất đồng bộ (asynchronously notified) khi có sẵn một thông điệp trong hàng đợi.

Hàng đợi thông điệp POSIX là một bổ sung tương đối gần đây đối với Linux. Hỗ trợ cài đặt cần thiết đã được thêm vào nhân (kernel) 2.6.6 (ngoài ra, cần có glibc 2.3.4 trở lên).

> Hỗ trợ hàng đợi thông điệp POSIX là một thành phần nhân tùy chọn được cấu hình thông qua tùy chọn `CONFIG_POSIX_MQUEUE`.

## 52.1 Tổng quan

Các hàm chính trong API hàng đợi thông điệp POSIX bao gồm:

- Hàm `mq_open()` tạo một hàng đợi thông điệp mới hoặc mở một hàng đợi đã tồn tại, trả về một bộ mô tả hàng đợi thông điệp (message queue descriptor) để sử dụng trong các lời gọi sau.
- Hàm `mq_send()` ghi một thông điệp vào hàng đợi.
- Hàm `mq_receive()` đọc một thông điệp từ hàng đợi.
- Hàm `mq_close()` đóng một hàng đợi thông điệp mà tiến trình đã mở trước đó.
- Hàm `mq_unlink()` gỡ bỏ tên của hàng đợi thông điệp và đánh dấu hàng đợi để xóa khi tất cả các tiến trình đã đóng nó.

Các hàm trên đều phục vụ các mục đích khá hiển nhiên. Ngoài ra, có một vài tính năng đặc trưng cho API hàng đợi thông điệp POSIX:

- Mỗi hàng đợi thông điệp có một tập hợp các thuộc tính đi kèm. Một số thuộc tính này có thể được thiết lập khi hàng đợi được tạo hoặc mở bằng cách sử dụng `mq_open()`. Hai hàm được cung cấp để truy xuất và thay đổi các thuộc tính hàng đợi: `mq_getattr()` và `mq_setattr()`.
- Hàm `mq_notify()` cho phép một tiến trình đăng ký nhận thông báo thông điệp từ một hàng đợi. Sau khi đăng ký, tiến trình sẽ được thông báo về việc có sẵn thông điệp thông qua việc gửi tín hiệu (signal) hoặc thông qua việc gọi một hàm trong một luồng (thread) riêng biệt.

## 52.2 Mở, Đóng và Gỡ liên kết Hàng đợi Thông điệp

Trong phần này, chúng ta xem xét các hàm được sử dụng để mở, đóng và gỡ bỏ các hàng đợi thông điệp.

### Mở một hàng đợi thông điệp

Hàm `mq_open()` tạo một hàng đợi thông điệp mới hoặc mở một hàng đợi đã tồn tại.

```
## include <fcntl.h> /* Định nghĩa các hằng số O_* */
## include <sys/stat.h> /* Định nghĩa các hằng số chế độ (mode) */
## include <mqueue.h>
mqd_t mq_open(const char *name, int oflag, ...
 /* mode_t mode, struct mq_attr *attr */);
         Trả về một bộ mô tả hàng đợi thông điệp khi thành công, hoặc (mqd_t) –1 khi lỗi
```

Tham số `name` xác định hàng đợi thông điệp và được chỉ định theo các quy tắc được đưa ra trong Mục [51.1](#page-1-0).

Tham số `oflag` là một mặt nạ bit (bit mask) điều khiển các khía cạnh khác nhau trong hoạt động của `mq_open()`. Các giá trị có thể được bao gồm trong mặt nạ này được tóm tắt trong [Bảng 52-1](#page-8-0).

**Bảng 52-1:** Các giá trị bit cho tham số `oflag` của hàm `mq_open()`

| Cờ (Flag)  | Mô tả                                    |
|------------|------------------------------------------|
| O_CREAT    | Tạo hàng đợi nếu nó chưa tồn tại         |
| O_EXCL     | Đi kèm với O_CREAT, tạo hàng đợi độc quyền |
| O_RDONLY   | Chỉ mở để đọc                            |
| O_WRONLY   | Chỉ mở để ghi                            |
| O_RDWR     | Mở để đọc và ghi                         |
| O_NONBLOCK | Mở ở chế độ phi chặn (nonblocking)       |

Một trong những mục đích của tham số `oflag` là xác định xem chúng ta đang mở một hàng đợi đã tồn tại hay đang tạo và mở một hàng đợi mới. Nếu `oflag` không bao gồm `O_CREAT`, chúng ta đang mở một hàng đợi đã tồn tại. Nếu `oflag` bao gồm `O_CREAT`, một hàng đợi trống mới sẽ được tạo ra nếu chưa có hàng đợi nào mang tên được chỉ định. Nếu `oflag` chỉ định cả `O_CREAT` và `O_EXCL`, và một hàng đợi có tên đã cho đã tồn tại, thì `mq_open()` sẽ thất bại.

Tham số `oflag` cũng chỉ ra loại quyền truy cập mà tiến trình gọi sẽ thực hiện đối với hàng đợi thông điệp, bằng cách chỉ định chính xác một trong các giá trị `O_RDONLY`, `O_WRONLY`, hoặc `O_RDWR`.

Giá trị cờ còn lại, `O_NONBLOCK`, khiến cho hàng đợi được mở ở chế độ phi chặn (nonblocking mode). Nếu một lời gọi tiếp theo tới `mq_receive()` hoặc `mq_send()` không thể được thực hiện mà không bị chặn (blocking), lời gọi đó sẽ thất bại ngay lập tức với lỗi `EAGAIN`.

Nếu `mq_open()` đang được sử dụng để mở một hàng đợi thông điệp đã tồn tại, lời gọi này chỉ yêu cầu hai tham số. Tuy nhiên, nếu `O_CREAT` được chỉ định trong các cờ, hai tham số bổ sung là bắt buộc: `mode` và `attr`. (Nếu hàng đợi được chỉ định bởi `name` đã tồn tại, hai tham số này sẽ bị bỏ qua.) Các tham số này được sử dụng như sau:

- Tham số `mode` là một mặt nạ bit (bit mask) xác định các quyền hạn được thiết lập cho hàng đợi thông điệp (message queue) mới. Các giá trị bit có thể được chỉ định hoàn toàn giống như đối với các tệp (Bảng 15-4, trang 295), và tương tự như hàm `open()`, giá trị trong `mode` sẽ được kết hợp qua phép toán bitwise với `umask` của tiến trình (Process) (Mục 15.4.6). Để đọc từ một hàng đợi (`mq_receive()`), quyền đọc phải được cấp cho nhóm người dùng tương ứng; để ghi vào hàng đợi (`mq_send()`), yêu cầu phải có quyền ghi.
- Tham số `attr` là một cấu trúc `mq_attr` chỉ định các thuộc tính cho hàng đợi thông điệp mới. Nếu `attr` là `NULL`, hàng đợi sẽ được tạo với các thuộc tính mặc định do hệ thống triển khai (implementation-defined) quy định. Chúng tôi mô tả cấu trúc `mq_attr` tại Mục [52.4.](#page-11-0)

Khi hoàn thành thành công, `mq_open()` trả về một mô tả hàng đợi thông điệp (message queue descriptor), một giá trị kiểu `mqd_t`, được sử dụng trong các lời gọi (call) tiếp theo để tham chiếu đến hàng đợi thông điệp đang mở này. Quy định duy nhất mà tiêu chuẩn SUSv3 đặt ra về kiểu dữ liệu này là nó có thể không phải là một mảng; nghĩa là, nó được đảm bảo là một kiểu dữ liệu có thể được sử dụng trong một câu lệnh gán hoặc được truyền theo giá trị như một đối số hàm. (Trên Linux, `mqd_t` là một kiểu `int`, nhưng ví dụ trên Solaris, nó được định nghĩa là `void *`.)

Một ví dụ về việc sử dụng `mq_open()` được cung cấp trong [Liệt kê 52-2 (Listing 52-2).](#page-12-0)

## Ảnh hưởng của fork(), exec() và việc chấm dứt tiến trình (process termination) đối với các mô tả hàng đợi thông điệp

Trong quá trình thực thi `fork()`, tiến trình con (child process) nhận được các bản sao các mô tả hàng đợi thông điệp của tiến trình cha (parent process), và các mô tả này tham chiếu đến cùng một mô tả hàng đợi thông điệp mở. (Chúng tôi giải thích các mô tả hàng đợi thông điệp tại Mục [52.3.](#page-10-0)) Tiến trình con không kế thừa bất kỳ đăng ký thông báo thông điệp (message notification registration) nào của tiến trình cha.

Khi một tiến trình thực hiện lệnh `exec()` hoặc kết thúc, tất cả các mô tả hàng đợi thông điệp đang mở của nó sẽ bị đóng lại. Hệ quả của việc đóng các mô tả hàng đợi thông điệp là tất cả các đăng ký thông báo thông điệp của tiến trình trên các hàng đợi tương ứng sẽ bị hủy đăng ký (deregister).

### Đóng một hàng đợi thông điệp

Hàm `mq_close()` thực hiện đóng mô tả hàng đợi thông điệp `mqdes`.

```
## include <mqueue.h>
int mq_close(mqd_t mqdes);
                                             Trả về 0 nếu thành công, hoặc –1 nếu lỗi
```

Nếu tiến trình gọi đã đăng ký thông qua `mqdes` để nhận thông báo thông điệp từ hàng đợi (Mục [52.6](#page-20-0)), thì đăng ký thông báo đó sẽ tự động bị xóa, và một tiến trình khác có thể tiếp tục đăng ký nhận thông báo thông điệp từ hàng đợi đó.

Một mô tả hàng đợi thông điệp sẽ tự động bị đóng khi một tiến trình kết thúc hoặc gọi `exec()`. Giống như các mô tả tệp (File Descriptor), chúng ta nên chủ động đóng các mô tả hàng đợi thông điệp không còn cần thiết để ngăn chặn việc tiến trình bị cạn kiệt tài nguyên mô tả hàng đợi thông điệp.

Tương tự như hàm `close()` đối với tệp, việc đóng một hàng đợi thông điệp không đồng nghĩa với việc xóa nó. Để thực hiện việc xóa, chúng ta cần dùng hàm `mq_unlink()`, đây là hàm tương đương với `unlink()` áp dụng cho hàng đợi thông điệp.

### Gỡ bỏ một hàng đợi thông điệp

Hàm `mq_unlink()` gỡ bỏ hàng đợi thông điệp được xác định bởi `name`, và đánh dấu hàng đợi đó để bị hủy bỏ ngay khi tất cả các tiến trình ngừng sử dụng nó (điều này có thể xảy ra ngay lập tức, nếu tất cả các tiến trình đã mở hàng đợi đó đều đã đóng nó trước đó).

```
## include <mqueue.h>
int mq_unlink(const char *name);
                                            Trả về 0 nếu thành công, hoặc –1 nếu lỗi
```

[Liệt kê 52-1 (Listing 52-1)](#page-9-0) minh họa cách sử dụng hàm `mq_unlink()`.

**Liệt kê 52-1 (Listing 52-1):** Sử dụng `mq_unlink()` để hủy liên kết (unlink) một hàng đợi thông điệp POSIX

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_unlink.c
## include <mqueue.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
```

```
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s mq-name\n", argv[0]);
 if (mq_unlink(argv[1]) == -1)
 errExit("mq_unlink");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_unlink.c
```

## 52.3 Mối quan hệ giữa Descriptor và Hàng đợi Thông điệp (Message Queue)

Mối quan hệ giữa một descriptor của hàng đợi thông điệp (message queue descriptor) và một hàng đợi thông điệp mở (open message queue) tương tự như mối quan hệ giữa một file descriptor (mô tả tệp) và một tệp mở (Hình 5-2, ở trang 95). Một message queue descriptor là một handle (bộ định danh) theo từng tiến trình (per-process) trỏ đến một mục trong bảng mô tả hàng đợi thông điệp mở trên toàn hệ thống (system-wide table of open message queue descriptions), và mục này lại trỏ đến một đối tượng hàng đợi thông điệp (message queue object). Mối quan hệ này được minh họa tại [Hình 52-1.](#page-10-1)

> Trên Linux, các hàng đợi thông điệp POSIX (POSIX message queues) được triển khai dưới dạng các i-node trong một hệ thống tệp ảo (virtual file system), và message queue descriptor cũng như mô tả hàng đợi thông điệp mở lần lượt được triển khai dưới dạng file descriptor và mô tả tệp mở (open file description). Tuy nhiên, đây là các chi tiết hiện thực (implementation details) không bắt buộc bởi chuẩn SUSv3 và không đúng trên một số hệ thống cài đặt UNIX khác. Dù vậy, chúng ta sẽ quay lại điểm này trong Mục [52.7,](#page-26-0) bởi vì Linux cung cấp một số tính năng phi tiêu chuẩn được hiện thực hóa nhờ cách triển khai này.

![](_page_10_Figure_4.jpeg)

**Hình 52-1:** Mối quan hệ giữa các cấu trúc dữ liệu kernel (kernel data structures) cho hàng đợi thông điệp POSIX

[Hình 52-1](#page-10-1) giúp làm sáng tỏ một số chi tiết về việc sử dụng message queue descriptor (tất cả đều tương tự như việc sử dụng file descriptor):

- Một mô tả hàng đợi thông điệp mở có một tập hợp các cờ (flag) đi kèm. Chuẩn SUSv3 chỉ định nghĩa một cờ duy nhất như vậy là `O_NONBLOCK`, quyết định việc I/O có ở chế độ không chặn (nonblocking) hay không.
- Hai tiến trình có thể nắm giữ các message queue descriptor (descriptor x trong sơ đồ) cùng trỏ đến một mô tả hàng đợi thông điệp mở. Điều này có thể xảy ra do một tiến trình mở hàng đợi thông điệp và sau đó gọi `fork()`. Các descriptor này chia sẻ trạng thái của cờ `O_NONBLOCK`.
- Hai tiến trình có thể nắm giữ các message queue descriptor trỏ đến các mô tả hàng đợi thông điệp khác nhau nhưng lại cùng trỏ đến một hàng đợi thông điệp (ví dụ: descriptor z trong tiến trình A và descriptor y trong tiến trình B đều trỏ đến `/mq-r`). Điều này xảy ra do hai tiến trình đều sử dụng `mq_open()` để mở cùng một hàng đợi.

## 52.4 Thuộc tính Hàng đợi Thông điệp (Message Queue Attributes)

Các hàm `mq_open()`, `mq_getattr()`, và `mq_setattr()` đều cho phép một đối số là con trỏ trỏ đến một cấu trúc `mq_attr`. Cấu trúc này được định nghĩa trong `<mqueue.h>` như sau:

```c
struct mq_attr {
 long mq_flags; /* Các cờ mô tả hàng đợi thông điệp: 0 hoặc
 O_NONBLOCK [mq_getattr(), mq_setattr()] */
 long mq_maxmsg; /* Số lượng thông điệp tối đa trên hàng đợi
 [mq_open(), mq_getattr()] */
 long mq_msgsize; /* Kích thước thông điệp tối đa (tính bằng byte)
 [mq_open(), mq_getattr()] */
 long mq_curmsgs; /* Số lượng thông điệp hiện có trong hàng đợi
 [mq_getattr()] */
};
```

Trước khi đi sâu tìm hiểu cấu trúc `mq_attr`, chúng ta cần lưu ý các điểm sau:

- Chỉ một số trường (field) được sử dụng bởi mỗi hàm trong số ba hàm trên. Các trường được sử dụng bởi từng hàm được chỉ ra trong các chú thích đi kèm với định nghĩa cấu trúc ở trên.
- Cấu trúc này chứa thông tin về mô tả hàng đợi thông điệp mở (`mq_flags`) liên kết với một message descriptor và thông tin về hàng đợi mà descriptor đó trỏ tới (`mq_maxmsg`, `mq_msgsize`, `mq_curmsgs`).
- Một số trường chứa thông tin được cố định tại thời điểm hàng đợi được tạo bằng `mq_open()` (`mq_maxmsg` và `mq_msgsize`); các trường khác trả về thông tin về trạng thái hiện tại của mô tả hàng đợi thông điệp (`mq_flags`) hoặc hàng đợi thông điệp (`mq_curmsgs`).

### Thiết lập thuộc tính hàng đợi thông điệp trong quá trình tạo hàng đợi

Khi chúng ta tạo một hàng đợi thông điệp bằng `mq_open()`, các trường `mq_attr` sau đây sẽ quyết định các thuộc tính của hàng đợi:

Trường `mq_maxmsg` xác định giới hạn về số lượng thông điệp có thể được đưa vào hàng đợi bằng cách sử dụng `mq_send()`. Giá trị này phải lớn hơn 0.

Trường `mq_msgsize` xác định giới hạn trên về kích thước của mỗi thông điệp có thể được đưa vào hàng đợi. Giá trị này phải lớn hơn 0.

Kết hợp lại, hai giá trị này cho phép kernel xác định lượng bộ nhớ tối đa mà hàng đợi thông điệp này có thể yêu cầu.

Các thuộc tính `mq_maxmsg` và `mq_msgsize` được cố định khi hàng đợi thông điệp được tạo; chúng không thể bị thay đổi sau đó. Trong Mục [52.8,](#page-28-0), chúng tôi mô tả hai tệp `/proc` áp đặt giới hạn trên toàn hệ thống đối với các giá trị có thể được chỉ định cho các thuộc tính `mq_maxmsg` và `mq_msgsize`.

Chương trình trong [Liệt kê 52-2](#page-12-0) cung cấp một giao diện dòng lệnh (command-line interface) cho hàm `mq_open()` và minh họa cách cấu trúc `mq_attr` được sử dụng với `mq_open()`.

Hai tùy chọn dòng lệnh cho phép chỉ định các thuộc tính của hàng đợi thông điệp: `-m` cho `mq_maxmsg` và `-s` cho `mq_msgsize`. Nếu một trong hai tùy chọn này được cung cấp, một đối số `attrp` khác `NULL` sẽ được truyền vào `mq_open()`. Một số giá trị mặc định được gán cho các trường của cấu trúc `mq_attr` mà `attrp` trỏ tới, trong trường hợp chỉ có một trong hai tùy chọn `-m` và `-s` được chỉ định trên dòng lệnh. Nếu không có tùy chọn nào trong số này được cung cấp, `attrp` sẽ được chỉ định là `NULL` khi gọi `mq_open()`, khiến hàng đợi được tạo với các giá trị mặc định do hệ thống quy định cho các thuộc tính hàng đợi.

**Liệt kê 52-2:** Tạo một hàng đợi thông điệp POSIX (POSIX message queue)

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_create.c
## include <mqueue.h>
## include <sys/stat.h>
## include <fcntl.h>
## include "tlpi_hdr.h"
static void
usageError(const char *progName)
{
 fprintf(stderr, "Usage: %s [-cx] [-m maxmsg] [-s msgsize] mq-name "
 "[octal-perms]\n", progName);
 fprintf(stderr, " -c Create queue (O_CREAT)\n");
 fprintf(stderr, " -m maxmsg Set maximum # of messages\n");
 fprintf(stderr, " -s msgsize Set maximum message size\n");
 fprintf(stderr, " -x Create exclusively (O_EXCL)\n");
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int flags, opt;
 mode_t perms;
 mqd_t mqd;
 struct mq_attr attr, *attrp;
 attrp = NULL;
 attr.mq_maxmsg = 50;
 attr.mq_msgsize = 2048;
 flags = O_RDWR;
```

```
 /* Phân tích các tùy chọn dòng lệnh (command-line options) */
 while ((opt = getopt(argc, argv, "cm:s:x")) != -1) {
 switch (opt) {
 case 'c':
 flags |= O_CREAT;
 break;
 case 'm':
 attr.mq_maxmsg = atoi(optarg);
 attrp = &attr;
 break;
 case 's':
 attr.mq_msgsize = atoi(optarg);
 attrp = &attr;
 break;
 case 'x':
 flags |= O_EXCL;
 break;
 default: 
         usageError(argv[0]);
 }
 }
 if (optind >= argc)
 usageError(argv[0]);
 perms = (argc <= optind + 1) ? (S_IRUSR | S_IWUSR) :
 getInt(argv[optind + 1], GN_BASE_8, "octal-perms");
 mqd = mq_open(argv[ind], flags, perms, attrp);
 if (mqd == (mqd_t) -1)
 errExit("mq_open");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_create.c
```

## Truy xuất các thuộc tính của hàng đợi thông điệp

Hàm `mq_getattr()` trả về một cấu trúc `mq_attr` chứa thông tin về mô tả hàng đợi thông điệp (message queue description) và hàng đợi thông điệp liên kết với bộ mô tả (descriptor) `mqdes`.

```
## include <mqueue.h>
int mq_getattr(mqd_t mqdes, struct mq_attr *attr);
                                             Trả về 0 nếu thành công, hoặc –1 nếu lỗi
```

Ngoài các trường `mq_maxmsg` và `mq_msgsize` mà chúng ta đã mô tả, các trường sau được trả về trong cấu trúc do `attr` trỏ tới:

### mq\_flags

Đây là các cờ (flags) dành cho mô tả hàng đợi thông điệp mở được liên kết với bộ mô tả `mqdes`. Chỉ có một cờ như vậy được chỉ định: `O_NONBLOCK`. Cờ này được khởi tạo từ đối số `oflag` của hàm `mq_open()`, và có thể được thay đổi bằng cách sử dụng `mq_setattr()`.

### mq\_curmsgs

Đây là số lượng thông điệp hiện đang có trong hàng đợi. Thông tin này có thể đã thay đổi vào thời điểm `mq_getattr()` trả về, nếu các tiến trình (process) khác đang đọc thông điệp từ hàng đợi hoặc ghi thông điệp vào đó.

Chương trình trong [Liệt kê 52-3](#page-14-0) sử dụng `mq_getattr()` để truy xuất các thuộc tính cho hàng đợi thông điệp được chỉ định trong đối số dòng lệnh của nó, sau đó hiển thị các thuộc tính đó ra đầu ra chuẩn (standard output).

**Liệt kê 52-3:** Truy xuất các thuộc tính của hàng đợi thông điệp POSIX

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_getattr.c
## include <mqueue.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 mqd_t mqd;
 struct mq_attr attr;
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s mq-name\n", argv[0]);
 mqd = mq_open(argv[1], O_RDONLY);
 if (mqd == (mqd_t) -1)
 errExit("mq_open");
 if (mq_getattr(mqd, &attr) == -1)
 errExit("mq_getattr");
 printf("Maximum # of messages on queue: %ld\n", attr.mq_maxmsg);
 printf("Maximum message size: %ld\n", attr.mq_msgsize);
 printf("# of messages currently on queue: %ld\n", attr.mq_curmsgs);
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_getattr.c
```

Trong phiên làm việc shell sau đây, chúng ta sử dụng chương trình trong [Liệt kê 52-2](#page-12-0) để tạo một hàng đợi thông điệp với các thuộc tính mặc định do cài đặt định nghĩa (implementation-defined default attributes) (tức là đối số cuối cùng truyền vào `mq_open()` là `NULL`), sau đó sử dụng chương trình trong [Liệt kê 52-3](#page-14-0) để hiển thị các thuộc tính của hàng đợi nhằm quan sát các thiết lập mặc định trên Linux.

```
$ ./pmsg_create -cx /mq
$ ./pmsg_getattr /mq
Maximum # of messages on queue: 10
Maximum message size: 8192
## of messages currently on queue: 0
$ ./pmsg_unlink /mq Xóa hàng đợi thông điệp
```

Từ kết quả đầu ra trên, chúng ta thấy rằng các giá trị mặc định trên Linux cho `mq_maxmsg` và `mq_msgsize` lần lượt là 10 và 8192.

Có sự dao động lớn về các giá trị mặc định do cài đặt định nghĩa đối với `mq_maxmsg` và `mq_msgsize`. Các ứng dụng có tính di động (portable applications) thường cần phải chọn các giá trị tường minh cho các thuộc tính này, thay vì phụ thuộc vào các giá trị mặc định.

### Thay đổi các thuộc tính của hàng đợi thông điệp

Hàm `mq_setattr()` thiết lập các thuộc tính của mô tả hàng đợi thông điệp được liên kết với bộ mô tả hàng đợi thông điệp `mqdes`, và tùy chọn trả về thông tin về hàng đợi thông điệp đó.

```
## include <mqueue.h>
int mq_setattr(mqd_t mqdes, const struct mq_attr *newattr,
 struct mq_attr *oldattr);
                                         Trả về 0 nếu thành công, hoặc –1 nếu lỗi
```

Hàm `mq_setattr()` thực hiện các tác vụ sau:

- Nó sử dụng trường `mq_flags` trong cấu trúc `mq_attr` được trỏ bởi `newattr` để thay đổi các cờ (flags) của mô tả hàng đợi thông điệp (message queue description) liên kết với bộ mô tả (descriptor) `mqdes`.
- Nếu `oldattr` khác NULL (`non-NULL`), nó trả về một cấu trúc `mq_attr` chứa các cờ mô tả hàng đợi thông điệp trước đó và các thuộc tính của hàng đợi thông điệp (tức là thực hiện tác vụ giống như `mq_getattr()`).

Thuộc tính duy nhất mà SUSv3 quy định có thể được thay đổi bằng cách sử dụng `mq_setattr()` là trạng thái của cờ `O_NONBLOCK`.

Để tính đến khả năng một cài đặt (implementation) cụ thể có thể định nghĩa các cờ có thể sửa đổi khác, hoặc SUSv3 có thể bổ sung các cờ mới trong tương lai, một ứng dụng di động (portable application) nên thay đổi trạng thái của cờ `O_NONBLOCK` bằng cách sử dụng `mq_getattr()` để truy xuất giá trị `mq_flags`, sửa đổi bit `O_NONBLOCK`, và gọi `mq_setattr()` để thay đổi các thiết lập `mq_flags`. Ví dụ, để bật `O_NONBLOCK`, chúng ta sẽ thực hiện như sau:

```
if (mq_getattr(mqd, &attr) == -1)
 errExit("mq_getattr");
attr.mq_flags |= O_NONBLOCK;
if (mq_setattr(mqd, &attr, NULL) == -1)
 errExit("mq_getattr");
```

## 52.5 Trao đổi Thông điệp (Exchanging Messages)

Trong phần này, chúng ta sẽ xem xét các hàm được sử dụng để gửi thông điệp tới và nhận thông điệp từ một hàng đợi (queue).

### 52.5.1 Gửi Thông điệp (Sending Messages)

Hàm `mq_send()` thêm thông điệp trong vùng đệm (buffer) được trỏ bởi `msg_ptr` vào hàng đợi thông điệp do bộ mô tả `mqdes` tham chiếu đến.

```
## include <mqueue.h>
int mq_send(mqd_t mqdes, const char *msg_ptr, size_t msg_len,
 unsigned int msg_prio);
                                         Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Đối số `msg_len` chỉ định độ dài của thông điệp được trỏ bởi `msg_ptr`. Giá trị này phải nhỏ hơn hoặc bằng thuộc tính `mq_msgsize` của hàng đợi; nếu không, `mq_send()` sẽ thất bại với lỗi `EMSGSIZE`. Các thông điệp có độ dài bằng không được phép sử dụng.

Mỗi thông điệp có một độ ưu tiên (priority) là số nguyên không âm, được chỉ định bởi đối số `msg_prio`. Các thông điệp được sắp xếp trong hàng đợi theo thứ tự giảm dần của độ ưu tiên (tức là 0 là độ ưu tiên thấp nhất). Khi một thông điệp mới được thêm vào hàng đợi, nó được đặt sau bất kỳ thông điệp nào khác có cùng độ ưu tiên. Nếu một ứng dụng không cần sử dụng độ ưu tiên thông điệp, việc luôn chỉ định `msg_prio` là 0 là đủ dùng.

> Như đã lưu ý ở đầu chương này, thuộc tính kiểu (type attribute) của thông điệp System V cung cấp chức năng khác. Thông điệp System V luôn được xếp hàng theo thứ tự FIFO, nhưng `msgrcv()` cho phép chúng ta chọn thông điệp theo nhiều cách khác nhau: theo thứ tự FIFO, theo đúng kiểu chính xác (exact type), hoặc theo kiểu cao nhất nhỏ hơn hoặc bằng một giá trị nào đó.

SUSv3 cho phép một bản cài đặt công bố giới hạn trên của nó đối với các độ ưu tiên thông điệp, hoặc thông qua việc định nghĩa hằng số `MQ_PRIO_MAX` hoặc thông qua giá trị trả về từ `sysconf(_SC_MQ_PRIO_MAX)`. SUSv3 yêu cầu giới hạn này phải có ít nhất là 32 (`_POSIX_MQ_PRIO_MAX`); nghĩa là, các độ ưu tiên ít nhất trong phạm vi từ 0 đến 31 là khả dụng. Tuy nhiên, phạm vi thực tế trên các hệ thống cài đặt là rất khác nhau. Ví dụ, trên Linux, hằng số này có giá trị là 32.768; trên Solaris, nó là 32; và trên Tru64, nó là 256.

Nếu hàng đợi thông điệp đã đầy (tức là giới hạn `mq_maxmsg` của hàng đợi đã đạt tới), thì lệnh `mq_send()` tiếp theo sẽ hoặc là chặn (blocks) cho đến khi có sẵn không gian trống trong hàng đợi, hoặc là, nếu cờ `O_NONBLOCK` đang có hiệu lực, sẽ thất bại ngay lập tức với lỗi `EAGAIN`.

Chương trình trong [Liệt kê 52-4](#page-17-0) cung cấp một giao diện dòng lệnh (command-line interface) cho hàm `mq_send()`. Chúng ta minh họa cách sử dụng chương trình này trong phần tiếp theo.

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_send.c
## include <mqueue.h>
## include <fcntl.h> /* Cho định nghĩa O_NONBLOCK */
## include "tlpi_hdr.h"
static void
usageError(const char *progName)
{
 fprintf(stderr, "Cách dùng: %s [-n] name msg [prio]\n", progName);
 fprintf(stderr, " -n Sử dụng cờ O_NONBLOCK\n");
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int flags, opt;
 mqd_t mqd;
 unsigned int prio;
 flags = O_WRONLY;
 while ((opt = getopt(argc, argv, "n")) != -1) {
 switch (opt) {
 case 'n': flags |= O_NONBLOCK; break;
 default: usageError(argv[0]);
 }
 }
 if (optind + 1 >= argc)
 usageError(argv[0]);
 mqd = mq_open(argv[optind], flags);
 if (mqd == (mqd_t) -1)
 errExit("mq_open");
 prio = (argc > optind + 2) ? atoi(argv[optind + 2]) : 0;
 if (mq_send(mqd, argv[optind + 1], strlen(argv[optind + 1]), prio) == -1)
 errExit("mq_send");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_send.c
```

### 52.5.2 Nhận thông điệp (Receiving Messages)

Hàm `mq_receive()` lấy thông điệp cũ nhất có độ ưu tiên cao nhất từ hàng đợi thông điệp (message queue) được trỏ bởi `mqdes` và trả về thông điệp đó trong vùng đệm (buffer) do `msg_ptr` trỏ tới.

```
## include <mqueue.h>
ssize_t mq_receive(mqd_t mqdes, char *msg_ptr, size_t msg_len,
 unsigned int *msg_prio);
       Trả về số byte trong thông điệp nhận được khi thành công, hoặc –1 khi có lỗi
```

Đối số `msg_len` được sử dụng bởi tiến trình gọi (caller) để chỉ định số byte không gian có sẵn trong vùng đệm được trỏ bởi `msg_ptr`.

Bất kể kích thước thực tế của thông điệp là bao nhiêu, `msg_len` (và do đó là kích thước của vùng đệm được trỏ bởi `msg_ptr`) phải lớn hơn hoặc bằng thuộc tính `mq_msgsize` của hàng đợi; nếu không, `mq_receive()` sẽ thất bại với mã lỗi `EMSGSIZE`. Nếu chúng ta không biết giá trị của thuộc tính `mq_msgsize` của hàng đợi, chúng ta có thể lấy nó bằng cách sử dụng `mq_getattr()`. (Trong một ứng dụng bao gồm các tiến trình phối hợp, việc sử dụng `mq_getattr()` thường có thể được lược bỏ, bởi vì ứng dụng thường có thể quyết định trước cài đặt `mq_msgsize` của hàng đợi).

Nếu `msg_prio` khác `NULL`, thì độ ưu tiên của thông điệp nhận được sẽ được sao chép vào vị trí được trỏ bởi `msg_prio`.

Nếu hàng đợi thông điệp hiện đang trống, thì `mq_receive()` sẽ hoặc là chặn (block) cho đến khi có thông điệp, hoặc là, nếu cờ `O_NONBLOCK` có hiệu lực, sẽ thất bại ngay lập tức với mã lỗi `EAGAIN`. (Không có hành vi tương đương với pipe (đường ống) nơi tiến trình đọc nhận được kết thúc file (end-of-file) nếu không có tiến trình ghi nào).

Chương trình trong [Liệt kê 52-5](#page-17-0) cung cấp giao diện dòng lệnh (command-line interface) cho hàm `mq_receive()`. Định dạng lệnh cho chương trình này được thể hiện trong hàm `usageError()`.

Phiên shell sau đây minh họa việc sử dụng các chương trình trong [Liệt kê 52-4](#page-17-0) và Liệt kê 52-5. Chúng ta bắt đầu bằng cách tạo một hàng đợi thông điệp và gửi một vài thông điệp với các độ ưu tiên khác nhau:

```
$ ./pmsg_create -cx /mq
$ ./pmsg_send /mq msg-a 5
$ ./pmsg_send /mq msg-b 0
$ ./pmsg_send /mq msg-c 10
```

Sau đó, chúng ta thực thi một chuỗi các lệnh để lấy thông điệp từ hàng đợi:

```
$ ./pmsg_receive /mq
Read 5 bytes; priority = 10
msg-c
$ ./pmsg_receive /mq
Read 5 bytes; priority = 5
msg-a
$ ./pmsg_receive /mq
Read 5 bytes; priority = 0
msg-b
```

Như chúng ta có thể thấy từ kết quả đầu ra ở trên, các thông điệp đã được lấy ra theo thứ tự độ ưu tiên.

Tại thời điểm này, hàng đợi bây giờ đã trống. Khi chúng ta thực hiện một lệnh nhận chặn (blocking receive) khác, thao tác sẽ bị chặn lại:

```
$ ./pmsg_receive /mq
Blocks; we type Control-C to terminate the program
```

Mặt khác, nếu chúng ta thực hiện một lệnh nhận phi chặn (nonblocking receive), lời gọi hàm sẽ trả về ngay lập tức với trạng thái lỗi:

\$ **./pmsg\_receive -n /mq** ERROR [EAGAIN/EWOULDBLOCK Resource temporarily unavailable] mq\_receive

**Liệt kê 52-5:** Đọc một thông điệp từ hàng đợi thông điệp POSIX (POSIX message queue)

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_receive.c
## include <mqueue.h>
## include <fcntl.h> /* Cho định nghĩa của O_NONBLOCK */
## include "tlpi_hdr.h"
static void
usageError(const char *progName)
{
 fprintf(stderr, "Usage: %s [-n] name\n", progName);
 fprintf(stderr, " -n Sử dụng cờ O_NONBLOCK\n");
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int flags, opt;
 mqd_t mqd;
 unsigned int prio;
 void *buffer;
 struct mq_attr attr;
 ssize_t numRead;
 flags = O_RDONLY;
 while ((opt = getopt(argc, argv, "n")) != -1) {
 switch (opt) {
 case 'n': flags |= O_NONBLOCK; break;
 default: usageError(argv[0]);
 }
 }
 if (optind >= argc)
 usageError(argv[0]);
 mqd = mq_open(argv[optind], flags);
 if (mqd == (mqd_t) -1)
 errExit("mq_open");
 if (mq_getattr(mqd, &attr) == -1)
 errExit("mq_getattr");
 buffer = malloc(attr.mq_msgsize);
 if (buffer == NULL)
 errExit("malloc");
```

```
 numRead = mq_receive(mqd, buffer, attr.mq_msgsize, &prio);
 if (numRead == -1)
 errExit("mq_receive");
 printf("Read %ld bytes; priority = %u\n", (long) numRead, prio);
 if (write(STDOUT_FILENO, buffer, numRead) == -1)
 errExit("write");
 write(STDOUT_FILENO, "\n", 1);
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/pmsg_receive.c
```

### 52.5.3 Gửi và Nhận Thông điệp với Thời gian chờ (Timeout)

Các hàm `mq_timedsend()` và `mq_timedreceive()` hoàn toàn giống với `mq_send()` và `mq_receive()`, ngoại trừ việc nếu thao tác không thể thực hiện ngay lập tức và cờ `O_NONBLOCK` không được bật cho mô tả hàng đợi thông điệp (message queue description), thì tham số `abs_timeout` sẽ chỉ định giới hạn thời gian mà lời gọi (call) sẽ bị chặn (block).

```
## define _XOPEN_SOURCE 600
## include <mqueue.h>
## include <time.h>
int mq_timedsend(mqd_t mqdes, const char *msg_ptr, size_t msg_len,
 unsigned int msg_prio, const struct timespec *abs_timeout);
                                         Trả về 0 khi thành công, hoặc –1 khi lỗi
ssize_t mq_timedreceive(mqd_t mqdes, char *msg_ptr, size_t msg_len,
 unsigned int *msg_prio, const struct timespec *abs_timeout);
       Trả về số byte trong thông điệp nhận được khi thành công, hoặc –1 khi lỗi
```

Tham số `abs_timeout` là một cấu trúc `timespec` (Mục 23.4.2) chỉ định thời gian chờ dưới dạng giá trị tuyệt đối tính bằng giây và nano giây kể từ mốc thời gian gốc (Epoch). Để thực hiện thời gian chờ tương đối (relative timeout), chúng ta có thể lấy giá trị hiện tại của đồng hồ `CLOCK_REALTIME` bằng cách sử dụng `clock_gettime()` và cộng khoảng thời gian yêu cầu vào giá trị đó để tạo ra một cấu trúc `timespec` được khởi tạo phù hợp.

Nếu một lời gọi đến `mq_timedsend()` hoặc `mq_timedreceive()` hết thời gian chờ (timeout) mà không thể hoàn thành thao tác của nó, thì lời gọi sẽ thất bại với mã lỗi `ETIMEDOUT`.

Trên Linux, việc chỉ định `abs_timeout` là `NULL` có nghĩa là thời gian chờ vô hạn (infinite timeout). Tuy nhiên, hành vi này không được quy định trong SUSv3, và các ứng dụng có tính di động (portable applications) không thể dựa vào nó.

Các hàm `mq_timedsend()` và `mq_timedreceive()` ban đầu bắt nguồn từ POSIX.1d (1999) và không có sẵn trên tất cả các hệ thống thực thi UNIX.

## 52.6 Thông báo Thông điệp (Message Notification)

Một tính năng phân biệt hàng đợi thông điệp POSIX (POSIX message queues) với các đối tác System V của chúng là khả năng nhận thông báo bất đồng bộ (asynchronous notification) về sự sẵn có của một thông điệp trên một hàng đợi trước đó đang trống (nghĩa là khi hàng đợi chuyển đổi từ trạng thái trống sang không trống). Tính năng này có nghĩa là thay vì thực hiện lời gọi `mq_receive()` bị chặn hoặc đánh dấu mô tả hàng đợi thông điệp là không chặn (nonblocking) và thực hiện các lời gọi `mq_receive()` định kỳ ("thăm dò" - poll) trên hàng đợi, một tiến trình (process) có thể yêu cầu thông báo về sự đến của thông điệp và sau đó thực hiện các tác vụ khác cho đến khi nó được thông báo. Một tiến trình có thể chọn nhận thông báo thông qua tín hiệu (signal) hoặc thông qua việc gọi một hàm trong một luồng (thread) riêng biệt.

> Tính năng thông báo của hàng đợi thông điệp POSIX tương tự như cơ chế thông báo mà chúng tôi đã mô tả cho các bộ định thời POSIX (POSIX timers) trong Mục 23.6. (Cả hai API này đều bắt nguồn từ POSIX.1b.)

Hàm `mq_notify()` đăng ký tiến trình gọi để nhận thông báo khi một thông điệp đến hàng đợi trống do mô tả `mqdes` trỏ tới.

```
## include <mqueue.h>
int mq_notify(mqd_t mqdes, const struct sigevent *notification);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Tham số `notification` chỉ định cơ chế mà tiến trình sẽ được thông báo. Trước khi đi vào chi tiết của tham số `notification`, chúng ta lưu ý một số điểm về thông báo thông điệp:

- Tại bất kỳ thời điểm nào, chỉ có một tiến trình ("tiến trình đã đăng ký" - registered process) có thể được đăng ký để nhận thông báo từ một hàng đợi thông điệp cụ thể. Nếu đã có một tiến trình được đăng ký cho một hàng đợi thông điệp, các nỗ lực đăng ký tiếp theo cho hàng đợi đó sẽ thất bại (`mq_notify()` thất bại với lỗi `EBUSY`).
- Tiến trình đã đăng ký chỉ được thông báo khi một thông điệp mới đến một hàng đợi trước đó đang trống. Nếu một hàng đợi đã chứa các thông điệp tại thời điểm đăng ký, thông báo sẽ chỉ xảy ra sau khi hàng đợi được làm trống và một thông điệp mới đến.
- Sau khi một thông báo được gửi đến tiến trình đã đăng ký, việc đăng ký sẽ bị gỡ bỏ và bất kỳ tiến trình nào sau đó cũng có thể tự đăng ký để nhận thông báo. Nói cách khác, chừng nào một tiến trình còn muốn tiếp tục nhận thông báo, nó phải tự đăng ký lại sau mỗi thông báo bằng cách gọi lại `mq_notify()`.
- Tiến trình đã đăng ký chỉ được thông báo nếu một tiến trình khác hiện không bị chặn trong lời gọi `mq_receive()` cho hàng đợi đó. Nếu một tiến trình khác bị chặn trong `mq_receive()`, tiến trình đó sẽ đọc thông điệp và tiến trình đã đăng ký sẽ vẫn ở trạng thái đã đăng ký.
- Một tiến trình có thể chủ động hủy đăng ký chính nó làm mục tiêu nhận thông báo thông điệp bằng cách gọi `mq_notify()` với tham số `notification` là `NULL`.

Chúng tôi đã trình bày cấu trúc `sigevent` được sử dụng để định kiểu cho tham số `notification` trong Mục 23.6.1. Ở đây, chúng tôi trình bày cấu trúc dưới dạng đơn giản hóa, chỉ hiển thị các trường liên quan đến thảo luận về `mq_notify()`:

```
union sigval {
 int sival_int; /* Giá trị số nguyên cho dữ liệu đi kèm */
 void *sival_ptr; /* Giá trị con trỏ cho dữ liệu đi kèm */
};
```

```c
struct sigevent {
 int sigev_notify; /* Notification method */
 int sigev_signo; /* Notification signal for SIGEV_SIGNAL */
 union sigval sigev_value; /* Value passed to signal handler or
 thread function */
 void (*sigev_notify_function) (union sigval);
 /* Thread notification function */
 void *sigev_notify_attributes; /* Really 'pthread_attr_t' */
};
```

Trường `sigev_notify` của cấu trúc này được thiết lập thành một trong các giá trị sau:

### SIGEV\_NONE

Đăng ký tiến trình (Process) này để nhận thông báo, nhưng khi một thông điệp (message) đến hàng đợi (queue) vốn đang trống, thực tế sẽ không thông báo cho tiến trình. Như thường lệ, việc đăng ký sẽ bị gỡ bỏ khi một thông điệp mới đến hàng đợi đang trống.

### SIGEV\_SIGNAL

Thông báo cho tiến trình bằng cách tạo ra (generate) tín hiệu (signal) được chỉ định trong trường `sigev_signo`. Nếu `sigev_signo` là một tín hiệu thời gian thực (realtime signal), thì trường `sigev_value` chỉ định dữ liệu đi kèm với tín hiệu đó (Mục 22.8.1). Dữ liệu này có thể được truy xuất thông qua trường `si_value` của cấu trúc `siginfo_t` được truyền tới hàm xử lý tín hiệu (signal handler) hoặc được trả về bởi lời gọi hàm `sigwaitinfo()` hoặc `sigtimedwait()`. Các trường sau trong cấu trúc `siginfo_t` cũng được điền dữ liệu: `si_code`, với giá trị `SI_MESGQ`; `si_signo`, với số hiệu tín hiệu; `si_pid`, với ID tiến trình (Process ID) của tiến trình đã gửi thông điệp; và `si_uid`, với ID người dùng thực (real user ID) của tiến trình đã gửi thông điệp. (Các trường `si_pid` và `si_uid` không được thiết lập trên hầu hết các cài đặt khác).

### SIGEV\_THREAD

Thông báo cho tiến trình bằng cách gọi hàm được chỉ định trong `sigev_notify_function` giống như thể đó là hàm khởi điểm trong một luồng (Thread) mới. Trường `sigev_notify_attributes` có thể được chỉ định là `NULL` hoặc là một con trỏ trỏ tới cấu trúc `pthread_attr_t` định nghĩa các thuộc tính cho luồng (Mục 29.8). Giá trị union `sigval` được chỉ định trong `sigev_value` sẽ được truyền làm đối số của hàm này.

### 52.6.1 Nhận thông báo thông qua Tín hiệu (Signal)

[Listing 52-6](#page-23-0) cung cấp một ví dụ về thông báo thông điệp sử dụng các tín hiệu. Chương trình này thực hiện các bước sau:

- 1. Mở hàng đợi thông điệp (message queue) có tên được chỉ định trên dòng lệnh ở chế độ phi chặn (nonblocking mode) q, xác định thuộc tính `mq_msgsize` cho hàng đợi w, và cấp phát một vùng đệm (buffer) với kích thước đó để nhận thông điệp e.
- 2. Chặn (block) tín hiệu thông báo (`SIGUSR1`) và thiết lập một hàm xử lý (handler) cho nó r.
- 3. Thực hiện lời gọi ban đầu tới `mq_notify()` để đăng ký tiến trình nhận thông báo thông điệp t.
- 4. Thực thi một vòng lặp vô hạn thực hiện các bước sau:
  - a) Gọi `sigsuspend()`, hàm này sẽ bỏ chặn (unblock) tín hiệu thông báo và đợi cho đến khi tín hiệu bị bắt (caught) y. Việc trả về từ lời gọi hệ thống (System Call) này cho biết một thông báo thông điệp đã xảy ra. Tại thời điểm này, tiến trình sẽ bị hủy đăng ký nhận thông báo thông điệp.
- b) Gọi `mq_notify()` để đăng ký lại tiến trình này nhằm nhận thông báo thông điệp u.
- c) Thực thi một vòng lặp while để làm rỗng (drain) hàng đợi bằng cách đọc càng nhiều thông điệp càng tốt i.

**Listing 52-6:** Nhận thông báo thông điệp thông qua tín hiệu

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/mq_notify_sig.c
## include <signal.h>
## include <mqueue.h>
## include <fcntl.h> /* For definition of O_NONBLOCK */
## include "tlpi_hdr.h"
## define NOTIFY_SIG SIGUSR1
  static void
  handler(int sig)
  {
   /* Just interrupt sigsuspend() */
  }
  int
  main(int argc, char *argv[])
  {
   struct sigevent sev;
   mqd_t mqd;
   struct mq_attr attr;
   void *buffer;
   ssize_t numRead;
   sigset_t blockMask, emptyMask;
   struct sigaction sa;
   if (argc != 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s mq-name\n", argv[0]);
q mqd = mq_open(argv[1], O_RDONLY | O_NONBLOCK);
   if (mqd == (mqd_t) -1)
   errExit("mq_open");
w if (mq_getattr(mqd, &attr) == -1)
   errExit("mq_getattr");
e buffer = malloc(attr.mq_msgsize);
   if (buffer == NULL)
   errExit("malloc");
r sigemptyset(&blockMask);
   sigaddset(&blockMask, NOTIFY_SIG);
   if (sigprocmask(SIG_BLOCK, &blockMask, NULL) == -1)
   errExit("sigprocmask");
```

```
 sigemptyset(&sa.sa_mask);
   sa.sa_flags = 0;
   sa.sa_handler = handler;
   if (sigaction(NOTIFY_SIG, &sa, NULL) == -1)
   errExit("sigaction");
t sev.sigev_notify = SIGEV_SIGNAL;
   sev.sigev_signo = NOTIFY_SIG;
   if (mq_notify(mqd, &sev) == -1)
   errExit("mq_notify");
   sigemptyset(&emptyMask);
   for (;;) {
y sigsuspend(&emptyMask); /* Wait for notification signal */
u if (mq_notify(mqd, &sev) == -1)
   errExit("mq_notify");
i while ((numRead = mq_receive(mqd, buffer, attr.mq_msgsize, NULL)) >= 0)
   printf("Read %ld bytes\n", (long) numRead);
   if (errno != EAGAIN) /* Unexpected error */
   errExit("mq_receive");
   }
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/mq_notify_sig.c
```

Các khía cạnh khác nhau của chương trình trong [Listing 52-6](#page-23-0) rất đáng được bình luận thêm:

```

- Chúng ta chặn tín hiệu thông báo (notification signal) và sử dụng `sigsuspend()` để chờ tín hiệu đó, thay vì dùng `pause()`, nhằm ngăn chặn khả năng bỏ sót một tín hiệu được gửi đến trong lúc chương trình đang thực thi ở nơi khác (nghĩa là không bị chặn để chờ tín hiệu) trong vòng lặp `for`. Nếu điều này xảy ra và chúng ta sử dụng `pause()` để chờ tín hiệu, thì lần gọi `pause()` tiếp theo sẽ bị treo (block), ngay cả khi tín hiệu đã được gửi đi trước đó.
- Chúng ta mở hàng đợi (queue) ở chế độ không chặn (nonblocking mode), và bất cứ khi nào có thông báo xảy ra, chúng ta sử dụng vòng lặp `while` để đọc toàn bộ các thông điệp (message) từ hàng đợi. Việc làm trống hàng đợi theo cách này đảm bảo rằng một thông báo tiếp theo sẽ được tạo ra khi có một thông điệp mới đến. Việc áp dụng chế độ không chặn đồng nghĩa với việc vòng lặp `while` sẽ kết thúc (hàm `mq_receive()` sẽ thất bại với lỗi `EAGAIN`) khi chúng ta đã làm trống hàng đợi. (Cách tiếp cận này tương tự như việc sử dụng I/O không chặn với thông báo I/O kích hoạt theo cạnh [edge-triggered I/O notification], mà chúng ta mô tả ở Mục 63.1.1, và được sử dụng vì những lý do tương tự).
- Bên trong vòng lặp `for`, việc đăng ký lại (reregister) để nhận thông báo thông điệp trước khi đọc tất cả các thông điệp từ hàng đợi là rất quan trọng. Nếu đảo ngược các bước này, chuỗi sự kiện sau có thể xảy ra: tất cả các thông điệp được đọc khỏi hàng đợi và vòng lặp `while` kết thúc; một thông điệp khác được đưa vào hàng đợi; `mq_notify()` được gọi để đăng ký lại nhận thông báo thông điệp. Tại thời điểm này, sẽ không có thêm tín hiệu thông báo nào được tạo ra nữa, bởi vì hàng đợi đã không còn trống. Hậu quả là chương trình sẽ bị treo vĩnh viễn ở lời gọi `sigsuspend()` tiếp theo.

### 52.6.2 Nhận thông báo thông qua một luồng (Thread)

[Liệt kê 52-7](#page-25-0) cung cấp một ví dụ về thông báo thông điệp sử dụng các luồng (thread). Chương trình này chia sẻ một số đặc điểm thiết kế với chương trình trong [Liệt kê 52-6](#page-23-0):

- Khi thông báo thông điệp xảy ra, chương trình kích hoạt lại thông báo trước khi xả cạn hàng đợi w.
- Chế độ không chặn (nonblocking mode) được áp dụng để sau khi nhận được thông báo, chúng ta có thể xả cạn hoàn toàn hàng đợi mà không bị treo t.

**Liệt kê 52-7:** Nhận thông báo thông điệp thông qua một luồng

```

––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/mq_notify_thread.c

## include <pthread.h>

## include <mqueue.h>

## include <fcntl.h> /* For definition of O_NONBLOCK */

## include "tlpi_hdr.h"

static void notifySetup(mqd_t *mqdp);
static void /* Thread notification function */
q threadFunc(union sigval sv)
{
ssize_t numRead;
mqd_t *mqdp;
void *buffer;
struct mq_attr attr;
mqdp = sv.sival_ptr;
if (mq_getattr(*mqdp, &attr) == -1)
errExit("mq_getattr");
buffer = malloc(attr.mq_msgsize);
if (buffer == NULL)
errExit("malloc");
w notifySetup(mqdp);
while ((numRead = mq_receive(*mqdp, buffer, attr.mq_msgsize, NULL)) >= 0)
printf("Read %ld bytes\n", (long) numRead);
if (errno != EAGAIN) /* Unexpected error */
errExit("mq_receive");
free(buffer);
pthread_exit(NULL);
}
static void
notifySetup(mqd_t *mqdp)
{
struct sigevent sev;

```

```

e sev.sigev_notify = SIGEV_THREAD; /* Notify via thread */
sev.sigev_notify_function = threadFunc;
sev.sigev_notify_attributes = NULL;
/* Could be pointer to pthread_attr_t structure */
r sev.sigev_value.sival_ptr = mqdp; /* Argument to threadFunc() */
if (mq_notify(*mqdp, &sev) == -1)
errExit("mq_notify");
}
int
main(int argc, char *argv[])
{
mqd_t mqd;
if (argc != 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s mq-name\n", argv[0]);
t mqd = mq_open(argv[1], O_RDONLY | O_NONBLOCK);
if (mqd == (mqd_t) -1)
errExit("mq_open");
y notifySetup(&mqd);
pause(); /* Wait for notifications via thread function */
}
––––––––––––––––––––––––––––––––––––––––––––––––––– pmsg/mq_notify_thread.c

```

Hãy lưu ý các điểm tiếp theo liên quan đến thiết kế của chương trình trong [Liệt kê 52-7:](#page-25-0)

- Chương trình yêu cầu thông báo thông qua một luồng bằng cách chỉ định `SIGEV_THREAD` trong trường `sigev_notify` của cấu trúc `sigevent` được truyền cho `mq_notify()`. Hàm khởi chạy của luồng, `threadFunc()`, được chỉ định trong trường `sigev_notify_function` e.
- Sau khi bật thông báo thông điệp, chương trình chính tạm dừng vô thời hạn y; các thông báo bộ định thời (timer notification) được phân phối bằng các lệnh gọi `threadFunc()` trong một luồng riêng biệt q.
- Chúng ta có thể làm cho bộ mô tả hàng đợi thông điệp (message queue descriptor) `mqd` hiển thị trong `threadFunc()` bằng cách biến nó thành một biến toàn cục. Tuy nhiên, chúng ta đã áp dụng một cách tiếp cận khác để minh họa cho phương án thay thế: chúng ta đặt địa chỉ của bộ mô tả hàng đợi thông điệp vào trường `sigev_value.sival_ptr` được truyền tới `mq_notify()` r. Khi `threadFunc()` được gọi sau đó, địa chỉ này được truyền làm đối số của nó.

Chúng ta phải gán một con trỏ tới bộ mô tả hàng đợi thông điệp cho `sigev_value.sival_ptr`, thay vì (một phiên bản ép kiểu nào đó của) chính bộ mô tả đó, bởi vì ngoại trừ quy định rằng nó không phải là kiểu mảng, SUSv3 không đưa ra đảm bảo nào về bản chất hoặc kích thước của kiểu dữ liệu được sử dụng để biểu diễn kiểu dữ liệu `mqd_t`.

## 52.7 Các tính năng đặc thù của Linux

Việc cài đặt hàng đợi thông điệp POSIX (POSIX message queues) trên Linux cung cấp một số tính năng không theo chuẩn nhưng vô cùng hữu ích.

### Hiển thị và xóa các đối tượng hàng đợi thông điệp qua dòng lệnh

Trong Chương [51](#page-0-0), chúng tôi đã đề cập rằng các đối tượng IPC kiểu POSIX (POSIX IPC objects) được hiện thực hóa dưới dạng các tệp (file) trong các hệ thống tệp ảo (virtual file systems), và các tệp này có thể được liệt kê và xóa bằng lệnh `ls` và `rm`. Để thực hiện điều này với các hàng đợi thông điệp POSIX, chúng ta phải mount hệ thống tệp hàng đợi thông điệp bằng lệnh có dạng sau:

```

## mount -t mqueue source target

```

Phần `source` có thể là bất kỳ tên nào (thường chỉ định chuỗi `none`). Ý nghĩa duy nhất của nó là xuất hiện trong `/proc/mounts` và được hiển thị bởi các lệnh `mount` và `df`. Phần `target` là điểm mount (mount point) cho hệ thống tệp hàng đợi thông điệp.

Phiên làm việc shell sau đây minh họa cách mount hệ thống tệp hàng đợi thông điệp và hiển thị nội dung của nó. Chúng ta bắt đầu bằng cách tạo một điểm mount cho hệ thống tệp và tiến hành mount:

```

$ su # Cần có quyền root (Privilege) để thực hiện mount
Password:

## mkdir /dev/mqueue

## mount -t mqueue none /dev/mqueue

$ exit # Kết thúc phiên làm việc shell của root (Terminate root shell session)

```

Tiếp theo, chúng ta hiển thị bản ghi trong `/proc/mounts` cho điểm mount mới, sau đó hiển thị các quyền (permissions) của thư mục mount:

```

$ cat /proc/mounts | grep mqueue
none /dev/mqueue mqueue rw 0 0
$ ls -ld /dev/mqueue
drwxrwxrwt 2 root root 40 Jul 26 12:09 /dev/mqueue

```

Một điểm cần lưu ý từ đầu ra của lệnh `ls` là hệ thống tệp hàng đợi thông điệp được tự động mount với cờ sticky bit (sticky bit) được thiết lập cho thư mục mount. (Chúng ta thấy điều này từ việc xuất hiện ký tự `t` trong trường quyền thực thi của người dùng khác - other-execute permission field do `ls` hiển thị). Điều này có nghĩa là một tiến trình không có đặc quyền (unprivileged process) chỉ có thể hủy liên kết (unlink) các hàng đợi thông điệp do chính nó sở hữu.

Tiếp theo, chúng ta tạo một hàng đợi thông điệp, dùng `ls` để cho thấy nó hiển thị trong hệ thống tệp, và sau đó xóa hàng đợi thông điệp đó:

```

$ ./pmsg_create -c /newq
$ ls /dev/mqueue
newq
$ rm /dev/mqueue/newq

```

### Lấy thông tin về một hàng đợi thông điệp

Chúng ta có thể hiển thị nội dung của các tệp bên trong hệ thống tệp hàng đợi thông điệp. Mỗi tệp ảo này chứa thông tin về hàng đợi thông điệp tương ứng:

```

$ ./pmsg_create -c /mq # Tạo một hàng đợi (Create a queue)
$ ./pmsg_send /mq abcdefg # Ghi 7 byte vào hàng đợi (Write 7 bytes to the queue)
$ cat /dev/mqueue/mq
QSIZE:7 NOTIFY:0 SIGNO:0 NOTIFY_PID:0

```

Trường `QSIZE` là số lượng đếm tổng số byte dữ liệu có trong hàng đợi. Các trường còn lại liên quan đến cơ chế thông báo thông điệp (message notification). Nếu `NOTIFY_PID` khác không, thì tiến trình có ID tiến trình (process ID) được chỉ định đã đăng ký nhận thông báo thông điệp từ hàng đợi này và các trường còn lại cung cấp thông tin về loại thông báo:

- `NOTIFY` là một giá trị tương ứng với một trong các hằng số `sigev_notify`: `0` cho `SIGEV_SIGNAL`, `1` cho `SIGEV_NONE`, hoặc `2` cho `SIGEV_THREAD`.
- Nếu phương thức thông báo là `SIGEV_SIGNAL`, trường `SIGNO` cho biết tín hiệu (signal) nào được gửi đi để thông báo thông điệp.

Phiên làm việc shell sau đây minh họa thông tin xuất hiện trong các trường này:

```

$ ./mq_notify_sig /mq & # Thông báo sử dụng SIGUSR1 (tín hiệu 10 trên x86)
[1] 18158
$ cat /dev/mqueue/mq
QSIZE:7 NOTIFY:0 SIGNO:10 NOTIFY_PID:18158
$ kill %1
[1] Terminated ./mq_notify_sig /mq
$ ./mq_notify_thread /mq & # Thông báo sử dụng một luồng (thread)
[2] 18160
$ cat /dev/mqueue/mq
QSIZE:7 NOTIFY:2 SIGNO:0 NOTIFY_PID:18160

```

### Sử dụng hàng đợi thông điệp với các mô hình I/O thay thế

Trong bản cài đặt trên Linux, một bộ mô tả hàng đợi thông điệp (message queue descriptor) thực chất là một bộ mô tả tệp (file descriptor). Chúng ta có thể giám sát bộ mô tả tệp này bằng cách sử dụng các system call đa hợp I/O (I/O multiplexing system calls) như `select()` và `poll()` hoặc API `epoll`. (Xem Chương 63 để biết thêm chi tiết về các API này). Điều này cho phép chúng ta tránh được khó khăn gặp phải với hàng đợi thông điệp System V khi cố gắng chờ dữ liệu đầu vào (input) trên cả hàng đợi thông điệp lẫn bộ mô tả tệp (tham khảo Mục 46.9). Tuy nhiên, tính năng này không theo chuẩn; tiêu chuẩn SUSv3 không bắt buộc các bộ mô tả hàng đợi thông điệp phải được cài đặt dưới dạng các bộ mô tả tệp.

## 52.8 Giới hạn Hàng đợi Thông điệp (Message Queue Limits)

SUSv3 định nghĩa hai giới hạn cho hàng đợi thông điệp (message queue) POSIX:

MQ\_PRIO\_MAX

Chúng tôi đã mô tả giới hạn này, xác định độ ưu tiên tối đa cho một thông điệp (message), tại Mục [52.5.1.](#page-16-0)

MQ\_OPEN\_MAX

Một hệ thống (implementation) có thể định nghĩa giới hạn này để chỉ định số lượng hàng đợi thông điệp tối đa mà một tiến trình (process) có thể giữ mở. SUSv3 yêu cầu giới hạn này phải có giá trị ít nhất là `_POSIX_MQ_OPEN_MAX` (8). Linux không định nghĩa giới hạn này. Thay vào đó, vì Linux triển khai các bộ mô tả hàng đợi thông điệp (message queue descriptor) dưới dạng các bộ mô tả tệp (file descriptor) (Mục [52.7](#page-26-0)), các giới hạn được áp dụng chính là những giới hạn áp dụng cho bộ mô tả tệp. (Nói cách khác, trên Linux, các giới hạn trên số lượng bộ mô tả tệp tính trên mỗi tiến trình và trên toàn hệ thống thực tế áp dụng cho tổng của các bộ mô tả tệp và bộ mô tả hàng đợi thông điệp). Để biết thêm chi tiết về các giới hạn được áp dụng, hãy xem phần thảo luận về giới hạn tài nguyên `RLIMIT_NOFILE` tại Mục 36.3.

Bên cạnh các giới hạn do SUSv3 quy định ở trên, Linux cung cấp một số tệp `/proc` để xem và (với quyền đặc quyền - privilege) thay đổi các giới hạn kiểm soát việc sử dụng hàng đợi thông điệp POSIX. Ba tệp sau đây nằm trong thư mục `/proc/sys/fs/mqueue`:

msg\_max

Giới hạn này chỉ định mức trần (ceiling) cho thuộc tính `mq_maxmsg` của các hàng đợi thông điệp mới (tức là mức trần cho `attr.mq_maxmsg` khi tạo một hàng đợi bằng hàm `mq_open()`). Giá trị mặc định cho giới hạn này là 10. Giá trị tối thiểu là 1 (10 đối với các phiên bản kernel trước Linux 2.6.28). Giá trị tối đa được định nghĩa bởi hằng số kernel `HARD_MSGMAX`. Giá trị của hằng số này được tính bằng `(131,072 / sizeof(void *))`, cho ra kết quả là 32.768 trên Linux/x86-32. Khi một tiến trình có đặc quyền (`CAP_SYS_RESOURCE`) gọi hàm `mq_open()`, giới hạn `msg_max` sẽ bị bỏ qua, nhưng `HARD_MSGMAX` vẫn đóng vai trò là mức trần cho `attr.mq_maxmsg`.

msgsize\_max

Giới hạn này chỉ định mức trần cho thuộc tính `mq_msgsize` của các hàng đợi thông điệp mới được tạo bởi các tiến trình không có đặc quyền (tức là mức trần cho `attr.mq_msgsize` khi tạo một hàng đợi bằng hàm `mq_open()`). Giá trị mặc định cho giới hạn này là 8192. Giá trị tối thiểu là 128 (8192 đối với các phiên bản kernel trước Linux 2.6.28). Giá trị tối đa là 1.048.576 (`INT_MAX` trong các kernel trước phiên bản 2.6.28). Giới hạn này bị bỏ qua khi một tiến trình có đặc quyền (`CAP_SYS_RESOURCE`) gọi hàm `mq_open()`.

queues\_max

Đây là giới hạn trên toàn hệ thống (system-wide limit) đối với số lượng hàng đợi thông điệp có thể được tạo. Khi đạt đến giới hạn này, chỉ có tiến trình có đặc quyền (`CAP_SYS_RESOURCE`) mới có thể tạo hàng đợi mới. Giá trị mặc định cho giới hạn này là 256. Nó có thể được thay đổi thành bất kỳ giá trị nào trong khoảng từ 0 đến `INT_MAX`.

Linux cũng cung cấp giới hạn tài nguyên `RLIMIT_MSGQUEUE`, có thể được sử dụng để thiết lập mức trần cho lượng dung lượng có thể bị tiêu thụ bởi tất cả các hàng đợi thông điệp thuộc về ID người dùng thực (real user ID) của tiến trình gọi. Xem Mục 36.3 để biết thêm chi tiết.

## 52.9 So sánh Hàng đợi Thông điệp POSIX và System V

Mục [51.2](#page-4-0) đã liệt kê các ưu điểm khác nhau của giao diện IPC (Inter-Process Communication) kiểu POSIX so với giao diện IPC kiểu System V: giao diện POSIX IPC đơn giản hơn và nhất quán hơn với mô hình tập tin UNIX truyền thống, đồng thời các đối tượng POSIX IPC được đếm tham chiếu (reference counted), giúp đơn giản hóa việc xác định thời điểm cần xóa một đối tượng. Những ưu điểm chung này cũng áp dụng cho các hàng đợi thông điệp (message queues) POSIX.

Hàng đợi thông điệp POSIX cũng có các ưu điểm cụ thể sau so với hàng đợi thông điệp System V:

-  Tính năng thông báo thông điệp (message notification) cho phép một (duy nhất) Process được thông báo một cách bất đồng bộ (asynchronously) thông qua một Signal hoặc việc khởi tạo một Thread khi có thông điệp đến một hàng đợi trước đó đang trống.
-  Trên Linux (nhưng không áp dụng cho các cài đặt UNIX khác), hàng đợi thông điệp POSIX có thể được giám sát (monitor) bằng các hàm `poll()`, `select()` và `epoll`. Hàng đợi thông điệp System V không cung cấp tính năng này.

Tuy nhiên, hàng đợi thông điệp POSIX cũng có một số nhược điểm so với hàng đợi thông điệp System V:

-  Hàng đợi thông điệp POSIX ít tính di động (portable) hơn. Vấn đề này thậm chí áp dụng ngay cả giữa các hệ thống Linux, vì hỗ trợ hàng đợi thông điệp chỉ có từ phiên bản kernel 2.6.6 trở đi.
-  Khả năng lựa chọn thông điệp System V theo loại (type) mang lại sự linh hoạt cao hơn một chút so với thứ tự ưu tiên nghiêm ngặt của thông điệp POSIX.

Có sự khác biệt lớn về cách thức triển khai hàng đợi thông điệp POSIX trên các hệ thống UNIX. Một số hệ thống cung cấp các bản cài đặt ở User Space, và trên ít nhất một hệ thống như vậy (Solaris 10), trang hướng dẫn (manual page) của `mq_open()` lưu ý rõ rằng bản cài đặt không thể được coi là bảo mật. Trên Linux, một trong những động lực để chọn cách cài đặt hàng đợi thông điệp ở Kernel Space là do người ta cho rằng không thể cung cấp một bản cài đặt an toàn ở User Space.

## 52.10 Tổng kết

Hàng đợi thông điệp POSIX cho phép các Process trao đổi dữ liệu dưới dạng các thông điệp (messages). Mỗi thông điệp đi kèm với một mức ưu tiên dạng số nguyên (integer priority), và các thông điệp được đưa vào hàng đợi (và do đó được nhận) theo thứ tự ưu tiên.

Hàng đợi thông điệp POSIX có một số ưu điểm so với hàng đợi thông điệp System V, đáng chú ý nhất là chúng được đếm tham chiếu (reference counted) và một Process có thể được thông báo bất đồng bộ khi có thông điệp đến một hàng đợi đang trống. Tuy nhiên, hàng đợi thông điệp POSIX ít tính di động hơn so với hàng đợi thông điệp System V.

### Thông tin thêm

[Stevens, 1999] cung cấp một góc nhìn trình bày khác về hàng đợi thông điệp POSIX và minh họa một bản cài đặt ở User Space sử dụng các tập tin ánh xạ bộ nhớ (memory-mapped files). Hàng đợi thông điệp POSIX cũng được mô tả khá chi tiết trong [Gallmeister, 1995].

## 52.11 Bài tập

- **52-1.** Sửa đổi chương trình trong Liệt kê 52-5 (`pmsg_receive.c`) để nhận một khoảng thời gian chờ (timeout dưới dạng số giây tương đối) trên dòng lệnh, và sử dụng `mq_timedreceive()` thay vì `mq_receive()`.
- **52-2.** Viết lại ứng dụng client-server quản lý số thứ tự (sequence-number) tại Mục 44.8 để sử dụng hàng đợi thông điệp POSIX (POSIX message queue).
- **52-3.** Viết lại ứng dụng máy chủ tập tin (file-server) tại Mục 46.8 để sử dụng hàng đợi thông điệp POSIX thay cho hàng đợi thông điệp System V (System V message queue).
- **52-4.** Viết một chương trình trò chuyện (chat) đơn giản (tương tự như `talk(1)`, nhưng không có giao diện `curses`) sử dụng hàng đợi thông điệp POSIX.
- **52-5.** Sửa đổi chương trình trong [Liệt kê 52-6](#page-23-0) (`mq_notify_sig.c`) để chứng minh rằng thông báo thông điệp (message notification) được thiết lập bởi `mq_notify()` chỉ diễn ra đúng một lần. Điều này có thể thực hiện bằng cách loại bỏ lời gọi `mq_notify()` bên trong vòng lặp `for`.

- **52-6.** Thay thế việc sử dụng trình xử lý tín hiệu (signal handler) trong [Liệt kê 52-6](#page-23-0) (`mq_notify_sig.c`) bằng cách sử dụng `sigwaitinfo()`. Sau khi `sigwaitinfo()` trả về, hãy hiển thị các giá trị có trong cấu trúc `siginfo_t` được trả về. Làm cách nào để chương trình có thể lấy được bộ mô tả hàng đợi thông điệp (message queue descriptor) trong cấu trúc `siginfo_t` do `sigwaitinfo()` trả về?
- **52-7.** Trong [Liệt kê 52-7](#page-25-0), liệu biến `buffer` có thể được chuyển thành một biến toàn cục (global variable) và được cấp phát bộ nhớ chỉ một lần (trong chương trình chính) hay không? Hãy giải thích câu trả lời của bạn.
