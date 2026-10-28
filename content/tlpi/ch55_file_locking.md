# Chương 55: Khóa tệp (File Locking)

Các chương trước đã đề cập đến nhiều kỹ thuật khác nhau mà các tiến trình (process) có thể sử dụng để đồng bộ hóa hành động của chúng, bao gồm tín hiệu (signal) (Chương 20 đến 22) và semaphore (Chương 47 và 53). Trong chương này, chúng ta sẽ xem xét các kỹ thuật đồng bộ hóa tiếp theo được thiết kế dành riêng cho các tệp (file).

## 55.1 Tổng quan

Yêu cầu ứng dụng thường gặp là đọc dữ liệu từ một tệp, thực hiện một số thay đổi đối với dữ liệu đó, và sau đó ghi ngược lại tệp. Miễn là chỉ có một tiến trình sử dụng tệp theo cách này tại một thời điểm, thì sẽ không có vấn đề gì xảy ra. Tuy nhiên, các vấn đề có thể phát sinh nếu nhiều tiến trình cùng lúc cập nhật một tệp. Giả sử, ví dụ, mỗi tiến trình thực hiện các bước sau để cập nhật một tệp chứa một số thứ tự (sequence number):

- 1. Đọc số thứ tự từ tệp.
- 2. Sử dụng số thứ tự cho một mục đích nào đó do ứng dụng định nghĩa.
- 3. Tăng số thứ tự lên và ghi ngược lại vào tệp.

Vấn đề ở đây là, nếu không có bất kỳ kỹ thuật đồng bộ hóa nào, hai tiến trình có thể thực hiện các bước trên cùng một lúc với (ví dụ) hậu quả được hiển thị trong [Hình 55-1](#page-1-0) (ở đây, chúng ta giả sử giá trị ban đầu của số thứ tự là 1000).

```
Process A                                                           Process B
----------                                                          ----------

[Read seq. # (obtains 1000)]                                             |      
        |                                                                |
        |---- time slice expires ----||---- time slice begins ---------->|
        |                                                                |
        |                                                                v
        |                                                         [Read seq. # (obtains 1000)]
        |                                                                |
        |                                                         [Use seq. #]
        |                                                                |
        |                                                         [Increment seq. # -> 1001
        |                                                          and write back to file]
        |                                                                |
        |<---- time slice begins ----||---- time slice ends --------------
        |
        v
[Use seq. #]
        |
[Increment seq. # -> 1001
 and write back to file]
 
                        Key
        ---->                       ---->  
  Executing on CPU              Waiting for CPU

```

**Hình 55-1:** Hai tiến trình cập nhật một tệp cùng lúc mà không có đồng bộ hóa

Vấn đề đã rõ: vào cuối các bước này, tệp chứa giá trị 1001, trong khi lẽ ra nó phải chứa giá trị 1002. (Đây là một ví dụ về tình trạng tranh chấp (race condition).) Để ngăn chặn những khả năng như vậy, chúng ta cần một dạng đồng bộ hóa giữa các tiến trình (interprocess synchronization).

Mặc dù chúng ta có thể sử dụng (chẳng hạn) semaphore để thực hiện việc đồng bộ hóa cần thiết, nhưng việc sử dụng khóa tệp (file lock) thường được ưu tiên hơn, bởi vì kernel tự động liên kết các khóa với các tệp.

> [!NOTE]
> [Stevens & Rago, 2005] ghi nhận việc triển khai khóa tệp UNIX đầu tiên vào năm 1980, và lưu ý rằng khóa `fcntl()`, thứ mà chúng ta tập trung chính trong chương này, đã xuất hiện trong System V Release 2 vào năm 1984.

Trong chương này, chúng ta mô tả hai API khác nhau để đặt khóa tệp:

- `flock()`, đặt khóa trên toàn bộ tệp; và
- `fcntl()`, đặt khóa trên các vùng của một tệp.

System Call `flock()` có nguồn gốc từ BSD; `fcntl()` có nguồn gốc từ System V. Phương pháp chung khi sử dụng `flock()` và `fcntl()` như sau:

- 1. Đặt khóa lên tệp.
- 2. Thực hiện I/O tệp (file I/O).
- 3. Mở khóa tệp (unlock) để tiến trình khác có thể khóa nó.

Mặc dù khóa tệp thường được sử dụng kết hợp với I/O tệp, chúng ta cũng có thể sử dụng nó như một kỹ thuật đồng bộ hóa tổng quát hơn. Các tiến trình hợp tác có thể tuân theo quy ước rằng việc khóa toàn bộ hoặc một phần tệp biểu thị quyền truy cập của một tiến trình vào một tài nguyên chia sẻ nào đó ngoài chính tệp đó (ví dụ: một vùng nhớ chia sẻ (shared memory region)).

## Kết hợp cơ chế khóa (locking) và các hàm stdio

Do tính năng đệm không gian người dùng (user-space buffering) được thực hiện bởi thư viện stdio, chúng ta nên thận trọng khi sử dụng các hàm stdio kết hợp với các kỹ thuật khóa được mô tả trong chương này. Vấn đề là bộ đệm đầu vào (input buffer) có thể được lấp đầy trước khi một khóa (lock) được thiết lập, hoặc bộ đệm đầu ra (output buffer) có thể được xả (flushed) sau khi một khóa bị gỡ bỏ. Có một số cách để tránh những vấn đề này:

- Thực hiện I/O tệp bằng cách sử dụng `read()` và `write()` (và các system call liên quan) thay vì thư viện stdio.
- Xả (flush) luồng stdio ngay sau khi thiết lập khóa trên tệp, và xả lại một lần nữa ngay trước khi giải phóng khóa.
- Có thể chấp nhận đánh đổi một chút hiệu năng, tắt hoàn toàn tính năng đệm của stdio bằng cách sử dụng `setbuf()` (hoặc tương tự).

## Khóa khuyến nghị (advisory locking) và khóa bắt buộc (mandatory locking)

Trong phần còn lại của chương này, chúng ta sẽ phân biệt các loại khóa là khóa khuyến nghị (advisory) hoặc khóa bắt buộc (mandatory). Theo mặc định, các khóa tệp mang tính khuyến nghị. Điều này có nghĩa là một tiến trình (process) có thể phớt lờ một khóa do tiến trình khác thiết lập. Để một cơ chế khóa khuyến nghị có thể hoạt động được, mỗi tiến trình truy cập vào tệp phải hợp tác bằng cách thiết lập khóa trước khi thực hiện I/O tệp. Ngược lại, hệ thống khóa bắt buộc buộc một tiến trình đang thực hiện I/O phải tuân thủ các khóa do các tiến trình khác nắm giữ. Chúng ta sẽ bàn kỹ hơn về sự phân biệt này trong Mục [55.4.](#page-20-0)

## 55.2 Khóa tệp với flock()

Mặc dù `fcntl()` cung cấp một tập siêu tập (superset) các tính năng so với `flock()`, chúng ta vẫn mô tả `flock()` vì nó vẫn được sử dụng trong một số ứng dụng, và vì nó khác với `fcntl()` ở một số ngữ nghĩa về sự kế thừa và giải phóng khóa.

```c
## include <sys/file.h>
int flock(int fd, int operation);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

System call `flock()` thiết lập một khóa đơn trên toàn bộ tệp. Tệp cần khóa được chỉ định thông qua một file descriptor đang mở được truyền vào `fd`. Đối số `operation` chỉ định một trong các giá trị `LOCK_SH`, `LOCK_EX`, hoặc `LOCK_UN`, được mô tả trong [Bảng 55-1](#page-3-0).

Theo mặc định, `flock()` sẽ chặn (block) nếu một tiến trình khác đang giữ một khóa không tương thích trên tệp đó. Nếu muốn ngăn chặn điều này, chúng ta có thể phép toán OR (|) cờ `LOCK_NB` vào đối số `operation`. Trong trường hợp này, nếu một tiến trình khác đã giữ khóa không tương thích trên tệp, `flock()` sẽ không bị chặn mà thay vào đó trả về –1, với `errno` được thiết lập thành `EWOULDBLOCK`.

**Bảng 55-1:** Các giá trị cho đối số `operation` của `flock()`

| Giá trị | Mô tả |
|---------|-------------------------------------------------------|
| LOCK_SH | Đặt một khóa chia sẻ (shared lock) trên tệp được trỏ bởi `fd` |
| LOCK_EX | Đặt một khóa độc quyền (exclusive lock) trên tệp được trỏ bởi `fd` |
| LOCK_UN | Mở khóa (unlock) tệp được trỏ bởi `fd` |
| LOCK_NB | Yêu cầu khóa không chặn (nonblocking lock request) |

Bất kỳ số lượng tiến trình nào cũng có thể đồng thời nắm giữ khóa chia sẻ trên một tệp. Tuy nhiên, tại một thời điểm chỉ có duy nhất một tiến trình có thể nắm giữ khóa độc quyền trên tệp đó. (Nói cách khác, khóa độc quyền từ chối cả khóa độc quyền lẫn khóa chia sẻ từ các tiến trình khác.) [Bảng 55-2](#page-3-1) tóm tắt các quy tắc tương thích cho các loại khóa của `flock()`. Ở đây, chúng ta giả định rằng tiến trình A là tiến trình đầu tiên đặt khóa và bảng cho biết liệu tiến trình B sau đó có thể đặt khóa hay không.

**Bảng 55-2:** Tính tương thích của các loại khóa trong `flock()`

| Tiến trình A | Tiến trình B |         |
|--------------|--------------|---------|
|              | LOCK_SH      | LOCK_EX |
| LOCK_SH      | Có           | Không   |
| LOCK_EX      | Không        | Không   |

Một tiến trình có thể đặt khóa chia sẻ hoặc khóa độc quyền bất kể chế độ truy cập (đọc, ghi, hoặc đọc-ghi) của tệp là gì.

Một khóa chia sẻ hiện có có thể được chuyển đổi thành khóa độc quyền (và ngược lại) bằng cách thực hiện một lời gọi `flock()` khác, chỉ định giá trị phù hợp cho `operation`. Việc chuyển đổi từ khóa chia sẻ sang khóa độc quyền sẽ bị chặn nếu một tiến trình khác đang giữ khóa chia sẻ trên tệp, trừ khi cờ `LOCK_NB` cũng được chỉ định.

Việc chuyển đổi khóa không được đảm bảo là tính nguyên tử (atomic). Trong quá trình chuyển đổi, khóa hiện có trước tiên bị xóa, sau đó một khóa mới được thiết lập. Giữa hai bước này, yêu cầu đang chờ xử lý của một tiến trình khác đối với một khóa không tương thích có thể được chấp thuận. Nếu điều này xảy ra, quá trình chuyển đổi sẽ bị chặn, hoặc nếu `LOCK_NB` được chỉ định, quá trình chuyển đổi sẽ thất bại và tiến trình sẽ mất khóa ban đầu của mình. (Hành vi này xuất hiện trong cài đặt `flock()` gốc của BSD và cũng xuất hiện trên nhiều bản cài đặt UNIX khác.)

> [!NOTE]
> Mặc dù không phải là một phần của tiêu chuẩn SUSv3, `flock()` vẫn xuất hiện trên hầu hết các bản cài đặt UNIX. Một số bản cài đặt yêu cầu bao gồm (include) `<fcntl.h>` hoặc `<sys/fcntl.h>` thay vì `<sys/file.h>`. Do `flock()` bắt nguồn từ BSD, các khóa do nó thiết lập đôi khi được gọi là khóa tệp BSD (BSD file locks).

[Liệt kê 55-1](#page-4-0) minh họa việc sử dụng `flock()`. Chương trình này khóa một tệp, tạm dừng hoạt động (sleep) trong một số giây được chỉ định, và sau đó mở khóa tệp đó. Chương trình nhận tối đa ba đối số dòng lệnh (command-line arguments). Đối số đầu tiên là tệp cần khóa. Đối số thứ hai chỉ định loại khóa (chia sẻ hoặc độc quyền) và có bao gồm cờ `LOCK_NB` (không chặn) hay không. Đối số thứ ba chỉ định số giây cần sleep giữa thời điểm nhận được khóa và thời điểm giải phóng khóa; đối số này là tùy chọn và mặc định là 10 giây.

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– filelock/t_flock.c
## include <sys/file.h>
## include <fcntl.h>
## include "curr_time.h" /* Khai báo của currTime() */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int fd, lock;
 const char *lname;
 if (argc < 3 || strcmp(argv[1], "--help") == 0 ||
 strchr("sx", argv[2][0]) == NULL)
 usageErr("%s file lock [sleep-time]\n"
 " 'lock' là 's' (chia sẻ - shared) hoặc 'x' (độc quyền - exclusive)\n"
 " có thể theo sau bởi 'n' (không khóa - nonblocking)\n"
 " 'secs' chỉ định thời gian giữ khóa\n", argv[0]);
 lock = (argv[2][0] == 's') ? LOCK_SH : LOCK_EX;
 if (argv[2][1] == 'n')
 lock |= LOCK_NB;
 fd = open(argv[1], O_RDONLY); /* Mở tệp để đặt khóa */
 if (fd == -1)
 errExit("open");
 lname = (lock & LOCK_SH) ? "LOCK_SH" : "LOCK_EX";
 printf("PID %ld: đang yêu cầu %s vào lúc %s\n", (long) getpid(), lname,
 currTime("%T"));
 if (flock(fd, lock) == -1) {
 if (errno == EWOULDBLOCK)
 fatal("PID %ld: đã bị khóa - kết thúc!", (long) getpid());
 else
 errExit("flock (PID=%ld)", (long) getpid());
 }
 printf("PID %ld: đã được cấp %s vào lúc %s\n", (long) getpid(), lname,
 currTime("%T"));
 sleep((argc > 3) ? getInt(argv[3], GN_NONNEG, "sleep-time") : 10);
 printf("PID %ld: đang giải phóng %s vào lúc %s\n", (long) getpid(), lname,
 currTime("%T"));
 if (flock(fd, LOCK_UN) == -1)
 errExit("flock");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– filelock/t_flock.c
```

Sử dụng chương trình trong [Listing 55-1](#page-4-0), chúng ta có thể tiến hành một số thí nghiệm để khám phá hành vi của `flock()`. Một số ví dụ được hiển thị trong phiên dòng lệnh (shell session) sau đây. Chúng ta bắt đầu bằng cách tạo một tệp (file), sau đó khởi chạy một tiến trình (Process) của chương trình chạy ngầm (background) và giữ khóa chia sẻ (shared lock) trong vòng 60 giây:

```
$ touch tfile
$ ./t_flock tfile s 60 &
[1] 9777
PID 9777: requesting LOCK_SH at 21:19:37
PID 9777: granted LOCK_SH at 21:19:37
```

Tiếp theo, chúng ta khởi chạy một tiến trình khác của chương trình để yêu cầu khóa chia sẻ (shared lock) thành công và sau đó giải phóng nó:

```
$ ./t_flock tfile s 2
PID 9778: requesting LOCK_SH at 21:19:49
PID 9778: granted LOCK_SH at 21:19:49
PID 9778: releasing LOCK_SH at 21:19:51
```

Tuy nhiên, khi chúng ta khởi chạy một tiến trình khác của chương trình để đưa ra yêu cầu không chặn (nonblocking request) cho khóa độc quyền (exclusive lock), yêu cầu đó sẽ thất bại ngay lập tức:

```
$ ./t_flock tfile xn
PID 9779: requesting LOCK_EX at 21:20:03
PID 9779: already locked - bye!
```

Khi chúng ta khởi chạy một tiến trình khác của chương trình để đưa ra yêu cầu chặn (blocking request) cho khóa độc quyền (exclusive lock), tiến trình đó sẽ bị chặn (block). Khi tiến trình nền (background process) đang giữ khóa chia sẻ trong 60 giây giải phóng khóa của nó, yêu cầu đang bị chặn sẽ được cấp phép:

```
$ ./t_flock tfile x
PID 9780: requesting LOCK_EX at 21:20:21
PID 9777: releasing LOCK_SH at 21:20:37
PID 9780: granted LOCK_EX at 21:20:37
PID 9780: releasing LOCK_EX at 21:20:47
```

### 55.2.1 Ngữ nghĩa của việc kế thừa và giải phóng khóa (Lock Inheritance and Release)

Như đã trình bày trong [Bảng 55-1,](#page-3-0) chúng ta có thể giải phóng một khóa tập tin (file lock) thông qua lệnh gọi `flock()` với thao tác được chỉ định là `LOCK_UN`. Ngoài ra, các khóa sẽ được tự động giải phóng khi mô tả tập tin (file descriptor) tương ứng bị đóng. Tuy nhiên, vấn đề phức tạp hơn thế. Một khóa tập tin được lấy thông qua `flock()` được liên kết với mô tả tập tin mở (open file description) (Mục 5.4), chứ không phải bản thân mô tả tập tin (file descriptor) hay tập tin (i-node). Điều này có nghĩa là khi một mô tả tập tin được nhân bản (thông qua `dup()`, `dup2()`, hoặc thao tác `fcntl()` `F_DUPFD`), mô tả tập tin mới sẽ tham chiếu đến cùng một khóa tập tin. Ví dụ, nếu chúng ta đã lấy được một khóa trên tập tin được tham chiếu bởi `fd`, thì đoạn mã sau (bỏ qua phần kiểm tra lỗi) sẽ giải phóng khóa đó:

```c
flock(fd, LOCK_EX); /* Nhận khóa thông qua 'fd' */
newfd = dup(fd); /* 'newfd' tham chiếu đến cùng khóa với 'fd' */
flock(newfd, LOCK_UN); /* Giải phóng khóa đã có thông qua 'fd' */
```

Nếu chúng ta đã có được một khóa thông qua một mô tả tập tin cụ thể và tạo ra một hoặc nhiều bản sao của mô tả đó, thì nếu chúng ta không thực hiện thao tác mở khóa một cách tường minh, khóa sẽ chỉ bị đóng khi tất cả các mô tả tập tin bản sao đều đã bị đóng.

Tuy nhiên, nếu chúng ta sử dụng `open()` để lấy một mô tả tập tin thứ hai (và mô tả tập tin mở liên quan) tham chiếu đến cùng một tập tin, mô tả thứ hai này sẽ được `flock()` xử lý một cách độc lập. Ví dụ, một tiến trình (process) thực thi đoạn mã sau sẽ bị chặn (block) ở lệnh gọi `flock()` thứ hai:

```c
fd1 = open("a.txt", O_RDWR);
fd2 = open("a.txt", O_RDWR);
flock(fd1, LOCK_EX);
flock(fd2, LOCK_EX); /* Bị chặn bởi khóa trên 'fd1' */
```

Do đó, một tiến trình có thể tự khóa chính nó khỏi một tập tin khi sử dụng `flock()`. Như chúng ta sẽ thấy sau đây, điều này không thể xảy ra với các khóa bản ghi (record lock) có được bởi `fcntl()`.

Khi chúng ta tạo một tiến trình con (child process) bằng cách sử dụng `fork()`, tiến trình con đó sẽ nhận được các bản sao các mô tả tập tin của tiến trình cha (parent process), và giống như các mô tả được nhân bản thông qua `dup()` v.v., các mô tả này tham chiếu đến cùng một mô tả tập tin mở và do đó tham chiếu đến cùng các khóa. Ví dụ, đoạn mã sau khiến tiến trình con xóa khóa của tiến trình cha:

```c
flock(fd, LOCK_EX); /* Tiến trình cha lấy khóa */
if (fork() == 0) /* Nếu là tiến trình con... */
 flock(fd, LOCK_UN); /* Giải phóng khóa được chia sẻ với tiến trình cha */
```

Ngữ nghĩa này đôi khi có thể được khai thác một cách hữu ích để chuyển giao (một cách nguyên tử - atomically) một khóa tập tin từ tiến trình cha sang tiến trình con: sau lệnh `fork()`, tiến trình cha đóng mô tả tập tin của mình và khóa nằm dưới sự kiểm soát duy nhất của tiến trình con. Như chúng ta sẽ thấy sau này, điều này là không thể nếu sử dụng các khóa bản ghi có được bởi `fcntl()`.

Các khóa được tạo bởi `flock()` được bảo toàn qua lệnh gọi `exec()` (trừ khi cờ `close-on-exec` được thiết lập cho mô tả tập tin và mô tả tập tin đó là mô tả cuối cùng tham chiếu đến mô tả tập tin mở cơ sở).

Ngữ nghĩa trên Linux được mô tả ở trên tuân thủ theo cài đặt BSD cổ điển của `flock()`. Trên một số hệ thống UNIX, `flock()` được cài đặt bằng cách sử dụng `fcntl()`, và chúng ta sẽ thấy sau đây rằng ngữ nghĩa kế thừa và giải phóng của các khóa `fcntl()` khác với các khóa `flock()`. Do các tương tác giữa các khóa được tạo bởi `flock()` và `fcntl()` là không xác định (undefined), một ứng dụng chỉ nên sử dụng một trong các phương pháp khóa này trên một tập tin.

### 55.2.2 Hạn chế của flock()

Việc thiết lập khóa bằng `flock()` gặp một số hạn chế:

- Chỉ có thể khóa toàn bộ tập tin. Việc khóa thô (coarse locking) như vậy làm hạn chế khả năng đồng thời (concurrency) giữa các tiến trình phối hợp. Ví dụ, nếu chúng ta có nhiều tiến trình, mỗi tiến trình muốn đồng thời truy cập các phần khác nhau của cùng một tập tin, thì việc khóa thông qua `flock()` sẽ vô tình ngăn cản các tiến trình này hoạt động đồng thời.
- Chúng ta chỉ có thể thiết lập các khóa tư vấn (advisory locks) bằng `flock()`.
- Nhiều cài đặt NFS không nhận ra các khóa được cấp bởi `flock()`.

Tất cả các hạn chế này đều được giải quyết bởi cơ chế khóa được cài đặt bởi `fcntl()`, mà chúng ta sẽ mô tả trong phần tiếp theo.

Về mặt lịch sử, máy chủ Linux NFS không hỗ trợ các khóa `flock()`. Kể từ phiên bản kernel 2.6.12, máy chủ Linux NFS đã hỗ trợ các khóa `flock()` bằng cách cài đặt chúng dưới dạng một khóa `fcntl()` trên toàn bộ tập tin. Điều này có thể gây ra một số hiện tượng lạ khi kết hợp các khóa BSD trên máy chủ và khóa BSD trên máy client: các client thường sẽ không thấy các khóa của máy chủ và ngược lại.

## 55.3 Khóa bản ghi với fcntl() (Record Locking with fcntl())

Sử dụng `fcntl()` (Mục 5.2), chúng ta có thể đặt khóa trên bất kỳ phần nào của tập tin, từ một byte duy nhất cho đến toàn bộ tập tin. Hình thức khóa tập tin này thường được gọi là khóa bản ghi (record locking). Tuy nhiên, thuật ngữ này không hoàn toàn chính xác (misnomer), bởi vì các tập tin trên hệ thống UNIX là các chuỗi byte, không có khái niệm về ranh giới bản ghi. Bất kỳ khái niệm nào về bản ghi bên trong tập tin đều được xác định thuần túy trong ứng dụng.

Thông thường, `fcntl()` được sử dụng để khóa các dải byte tương ứng với các ranh giới bản ghi do ứng dụng xác định bên trong tập tin; do đó xuất phát từ thuật ngữ khóa bản ghi. Các thuật ngữ dải byte (byte range), vùng tập tin (file region), và phân đoạn tập tin (file segment) ít được sử dụng hơn, nhưng là những mô tả chính xác hơn về loại khóa này. (Vì đây là loại khóa duy nhất được quy định trong tiêu chuẩn POSIX.1 gốc và trong SUSv3, nên nó đôi khi cũng được gọi là khóa tập tin POSIX - POSIX file locking.)

> [!NOTE]
> SUSv3 yêu cầu khóa bản ghi (record locking) phải được hỗ trợ đối với các tập tin thông thường (regular files) và cho phép hỗ trợ đối với các loại tập tin khác. Mặc dù việc áp dụng khóa bản ghi chỉ cho các tập tin thông thường thường là hợp lý (vì đối với hầu hết các loại tập tin khác, việc bàn về các khoảng byte cho dữ liệu chứa trong tập tin là không có ý nghĩa), nhưng trên Linux, có thể áp dụng khóa bản ghi cho bất kỳ loại File Descriptor nào.

[Hình 55-2](#page-8-0) minh họa cách khóa bản ghi có thể được sử dụng để đồng bộ hóa quyền truy cập của hai Process vào cùng một vùng của một tập tin. (Trong sơ đồ này, chúng ta giả định rằng tất cả các yêu cầu khóa đều ở chế độ chặn (blocking), do đó chúng sẽ phải chờ nếu một khóa đang bị giữ bởi Process khác).

Dạng tổng quát của hàm `fcntl()` được sử dụng để tạo hoặc gỡ bỏ một khóa tập tin (file lock) như sau:

```c
struct flock flockstr;
/* Thiết lập các trường của 'flockstr' để mô tả khóa cần đặt hoặc gỡ bỏ */
fcntl(fd, cmd, &flockstr); /* Đặt khóa được định nghĩa bởi 'fl' */
```

Đối số `fd` là một File Descriptor đang mở, trỏ đến tập tin mà chúng ta muốn đặt khóa.

Trước khi thảo luận về đối số `cmd`, trước tiên chúng ta mô tả cấu trúc `flock`.

## Cấu trúc flock

Cấu trúc `flock` định nghĩa khóa mà chúng ta muốn có được hoặc gỡ bỏ. Nó được định nghĩa như sau:

```c
struct flock {
 short l_type; /* Loại khóa: F_RDLCK, F_WRLCK, F_UNLCK */
 short l_whence; /* Cách giải thích 'l_start': SEEK_SET,
 SEEK_CUR, SEEK_END */
```

```c
 off_t l_start; /* Offset nơi khóa bắt đầu */
 off_t l_len; /* Số lượng byte cần khóa; 0 nghĩa là "cho đến EOF" */
 pid_t l_pid; /* Process ngăn cản khóa của chúng ta (chỉ dùng với F_GETLK) */
};
```

Trường `l_type` chỉ ra loại khóa mà chúng ta muốn đặt. Nó được chỉ định là một trong các giá trị trong Bảng 55-3.

Về mặt ngữ nghĩa, khóa đọc (`F_RDLCK`) và khóa ghi (`F_WRLCK`) tương ứng với các khóa chia sẻ (shared) và độc quyền (exclusive) được áp dụng bởi `flock()`, và chúng tuân theo các quy tắc tương thích giống nhau [\(Bảng 55-2\)](#page-3-1): bất kỳ số lượng Process nào cũng có thể giữ khóa đọc trên một vùng tập tin, nhưng chỉ một Process duy nhất có thể giữ khóa ghi, và khóa đó loại trừ các khóa đọc và khóa ghi của các Process khác. Việc chỉ định `l_type` là `F_UNLCK` tương tự như thao tác `LOCK_UN` của `flock()`.

**Bảng 55-3:** Các loại khóa cho việc khóa `fcntl()`

| Loại khóa | Mô tả                        |
|-----------|------------------------------|
| F_RDLCK   | Đặt một khóa đọc             |
| F_WRLCK   | Đặt một khóa ghi             |
| F_UNLCK   | Gỡ bỏ một khóa hiện có       |

```c
Process A                                                        Process B
----------                                                       ----------

[Yêu cầu khóa ghi trên byte 0–99]                      [Yêu cầu khóa ghi trên byte 0–99]
        |                                                           | bị chặn (blocks) 
[Cập nhật byte 0–99]                                                |
        |                                                           |
[Chuyển khóa byte 0–99 thành khóa đọc]     ------------------------>| (hết chặn - unblocks)
        |                                                           |
[Đọc byte 0–99]                                             [Đọc byte 0–99]
        |                                                           |
[Chuyển khóa byte 0–99 thành khóa ghi]                              |
        |                                                           |
        |<------------------------- (hết chặn) ------------[Mở khóa byte 0–99]
        |
[Cập nhật byte 0–99]                            
        |                                              
[Mở khóa byte 0–99]                             
```

**Hình 55-2:** Sử dụng khóa bản ghi để đồng bộ hóa quyền truy cập vào cùng một vùng của tập tin

Để đặt khóa đọc trên một tập tin, tập tin đó phải được mở ở chế độ đọc. Tương tự, để đặt khóa ghi, tập tin phải được mở ở chế độ ghi. Để đặt cả hai loại khóa, chúng ta mở tập tin ở chế độ đọc-ghi (`O_RDWR`). Cố gắng đặt một khóa không tương thích với chế độ truy cập tập tin sẽ dẫn đến lỗi `EBADF`.

Các trường `l_whence`, `l_start` và `l_len` kết hợp với nhau để chỉ định phạm vi byte cần khóa. Hai trường đầu tiên trong số này tương tự như các đối số `whence` và `offset` của hàm `lseek()` (Mục 4.7). Trường `l_start` chỉ định một offset bên trong tập tin được diễn giải dựa trên một trong các mốc sau:

- điểm đầu của tập tin, nếu `l_whence` là `SEEK_SET`;
- offset hiện tại của tập tin, nếu `l_whence` là `SEEK_CUR`; hoặc
- điểm cuối của tập tin, nếu `l_whence` là `SEEK_END`.

Trong hai trường hợp sau, `l_start` có thể là một số âm, miễn là vị trí tập tin kết quả không nằm trước điểm đầu của tập tin (byte 0).

Trường `l_len` chứa một số nguyên chỉ định số lượng byte cần khóa, bắt đầu từ vị trí được xác định bởi `l_whence` và `l_start`. Có thể khóa các byte không tồn tại nằm vượt quá phần cuối của tập tin, nhưng không thể khóa các byte nằm trước phần đầu của tập tin.

Kể từ phiên bản kernel 2.4.21, Linux cho phép một giá trị âm được truyền vào `l_len`. Đây là một yêu cầu khóa `l_len` byte nằm trước vị trí được chỉ định bởi `l_whence` và `l_start` (tức là các byte trong khoảng từ `(l_start – abs(l_len))` đến `(l_start – 1)`). SUSv3 cho phép, nhưng không bắt buộc, tính năng này. Một số triển khai UNIX khác cũng cung cấp tính năng này.

Nhìn chung, các ứng dụng nên khóa phạm vi byte tối thiểu cần thiết. Điều này cho phép mức độ đồng thời (concurrency) cao hơn cho các tiến trình khác đang cố gắng khóa đồng thời các vùng khác nhau của cùng một tệp.

> [!NOTE]
> Thuật ngữ "phạm vi tối thiểu" cần được làm rõ thêm trong một số trường hợp. Việc kết hợp khóa bản ghi (record lock) và các lời gọi đến `mmap()` có thể gây ra những hậu quả khó chịu trên các hệ thống tệp mạng (network file system) như NFS và CIFS. Vấn đề xảy ra vì `mmap()` ánh xạ (map) các tệp theo các đơn vị kích thước trang hệ thống (system page size). Nếu một khóa tệp được căn chỉnh theo trang (page-aligned), thì mọi thứ đều ổn, vì khóa sẽ bao phủ toàn bộ vùng tương ứng với một trang bẩn (dirty page). Tuy nhiên, nếu khóa không được căn chỉnh theo trang, thì sẽ có một tình trạng tranh chấp (race condition) — kernel có thể ghi vào vùng không được khóa nếu bất kỳ phần nào của trang được ánh xạ đã bị sửa đổi.

Việc chỉ định 0 trong `l_len` có ý nghĩa đặc biệt là "khóa tất cả các byte từ điểm được chỉ định bởi `l_start` và `l_whence` cho đến cuối tệp, bất kể tệp phát triển lớn đến đâu." Điều này rất thuận tiện nếu chúng ta không biết trước có bao nhiêu byte sẽ được thêm vào tệp. Để khóa toàn bộ tệp, chúng ta có thể chỉ định `l_whence` là `SEEK_SET` và cả `l_start` lẫn `l_len` bằng 0.

### Tham số cmd

Khi làm việc với các khóa tệp (file lock), ba giá trị có thể có được chỉ định cho tham số `cmd` của `fcntl()`. Hai giá trị đầu tiên được sử dụng để lấy (acquire) và giải phóng (release) khóa:

`F_SETLK`

Lấy (`l_type` là `F_RDLCK` hoặc `F_WRLCK`) hoặc giải phóng (`l_type` là `F_UNLCK`) một khóa trên các byte được chỉ định bởi `flockstr`. Nếu một khóa không tương thích đang bị giữ bởi một tiến trình khác trên bất kỳ phần nào của vùng cần khóa, `fcntl()` sẽ thất bại với mã lỗi `EAGAIN`. Trên một số triển khai UNIX, `fcntl()` thất bại với mã lỗi `EACCES` trong trường hợp này. SUSv3 cho phép cả hai khả năng, và một ứng dụng di động (portable application) nên kiểm tra cả hai giá trị này.

### `F_SETLKW`

Thao tác này giống với `F_SETLK`, ngoại trừ việc nếu một tiến trình khác đang giữ khóa không tương thích trên bất kỳ phần nào của vùng cần khóa, thì lời gọi sẽ chặn (block) cho đến khi khóa có thể được cấp phát. Nếu chúng ta đang xử lý các tín hiệu (signal) và chưa chỉ định `SA_RESTART` (Mục 21.5), thì một thao tác `F_SETLKW` có thể bị ngắt (tức là thất bại với mã lỗi `EINTR`). Chúng ta có thể tận dụng hành vi này để sử dụng `alarm()` hoặc `setitimer()` nhằm thiết lập thời gian chờ (timeout) cho yêu cầu khóa.

Lưu ý rằng `fcntl()` khóa toàn bộ vùng được chỉ định hoặc không khóa gì cả. Không có khái niệm chỉ khóa những byte của vùng được yêu cầu hiện đang ở trạng thái chưa khóa.

Thao tác `fcntl()` còn lại được sử dụng để xác định xem chúng ta có thể đặt một khóa trên một vùng cho trước hay không:

### `F_GETLK`

Kiểm tra xem liệu có thể lấy được khóa được chỉ định trong `flockstr` hay không, nhưng không thực sự lấy nó. Trường `l_type` phải là `F_RDLCK` hoặc `F_WRLCK`. Cấu trúc `flockstr` được xử lý như một tham số kiểu giá trị-kết quả (value-result argument); khi trả về, nó chứa thông tin cho chúng ta biết liệu khóa được chỉ định có thể được đặt hay không. Nếu khóa được phép (tức là không có khóa không tương thích nào tồn tại trên vùng tệp được chỉ định), thì `F_UNLCK` được trả về trong trường `l_type`, và các trường còn lại được giữ nguyên không đổi. Nếu có một hoặc nhiều khóa không tương thích tồn tại trên vùng đó, thì `flockstr` trả về thông tin về một trong các khóa đó (không cố định là khóa nào), bao gồm loại của nó (`l_type`), phạm vi byte (`l_start` và `l_len`; `l_whence` luôn được trả về là `SEEK_SET`), và ID tiến trình (process ID) của tiến trình đang giữ khóa (`l_pid`).

Lưu ý rằng có những tình trạng tranh chấp tiềm ẩn (potential race condition) khi kết hợp việc sử dụng `F_GETLK` với một lời gọi `F_SETLK` hoặc `F_SETLKW` tiếp theo. Vào thời điểm chúng ta thực hiện thao tác sau, thông tin do `F_GETLK` trả về có thể đã lỗi thời. Do đó, `F_GETLK` ít hữu ích hơn so với vẻ bề ngoài của nó. Ngay cả khi `F_GETLK` cho biết có thể đặt khóa, chúng ta vẫn phải chuẩn bị tinh thần nhận mã lỗi trả về từ `F_SETLK` hoặc việc `F_SETLKW` sẽ bị chặn (block).

> [!NOTE]
> Thư viện GNU C cũng thực thi hàm `lockf()`, đây chỉ là một giao diện được đơn giản hóa nằm chồng lên trên `fcntl()`. (SUSv3 quy định `lockf()`, nhưng không quy định mối quan hệ giữa `lockf()` và `fcntl()`. Tuy nhiên, hầu hết các hệ thống UNIX đều thực thi `lockf()` dựa trên nền tảng của `fcntl()`). Một lời gọi có dạng `lockf(fd, operation, size)` tương đương với một lời gọi đến `fcntl()` với `l_whence` được thiết lập thành `SEEK_CUR`, `l_start` thiết lập thành 0, và `l_len` thiết lập thành `size`; nghĩa là, `lockf()` khóa một chuỗi byte bắt đầu tại vị trí con trỏ tệp hiện tại (current file offset). Tham số `operation` của `lockf()` tương tự như tham số `cmd` của `fcntl()`, nhưng các hằng số khác nhau được sử dụng cho việc lấy, giải phóng và kiểm tra sự tồn tại của khóa. Hàm `lockf()` chỉ đặt các khóa độc quyền (exclusive lock, tức là khóa ghi). Xem trang hướng dẫn (manual page) `lockf(3)` để biết thêm chi tiết.

## Chi tiết về việc cấp phát và giải phóng khóa

Lưu ý các điểm sau đây liên quan đến việc cấp phát và giải phóng các khóa (lock) được tạo bằng `fcntl()`:

- Việc mở khóa (unlock) một vùng tệp (file region) luôn thành công ngay lập tức. Không có lỗi nào xảy ra khi mở khóa một vùng mà hiện tại chúng ta không giữ khóa.
- Tại bất kỳ thời điểm nào, một tiến trình (process) chỉ có thể giữ một loại khóa trên một vùng cụ thể của tệp. Việc đặt một khóa mới lên một vùng mà chúng ta đã khóa sẽ hoặc là không làm thay đổi gì (nếu loại khóa giống với khóa hiện tại) hoặc là chuyển đổi nguyên tử (atomically) khóa hiện có sang chế độ mới. Trong trường hợp sau, khi chuyển đổi khóa đọc (read lock) thành khóa ghi (write lock), chúng ta cần chuẩn bị sẵn sàng cho khả năng lệnh gọi sẽ trả về lỗi (`F_SETLK`) hoặc bị chặn (`F_SETLKW`). (Điều này khác với `flock()`, vốn có các thao tác chuyển đổi khóa không mang tính nguyên tử).
- Một tiến trình không bao giờ tự khóa chính mình ra khỏi một vùng tệp, ngay cả khi đặt khóa thông qua nhiều mô tả tệp (file descriptor) cùng trỏ đến một tệp. (Điều này tương phản với `flock()`, và chúng ta sẽ bàn thêm về điểm này trong Mục [55.3.5.](#page-19-0))
- Việc đặt một khóa có chế độ khác vào giữa một khóa mà chúng ta đang nắm giữ sẽ tạo ra ba khóa: hai khóa nhỏ hơn ở chế độ ban đầu được tạo ở hai bên của khóa mới (xem [Hình 55-3](#page-11-0)). Ngược lại, việc lấy một khóa thứ hai nằm kề hoặc chồng chéo lên một khóa hiện có cùng chế độ sẽ tạo ra một khóa duy nhất được gộp lại (coalesced lock) bao phủ toàn bộ vùng kết hợp của hai khóa đó. Các hoán vị khác là có thể xảy ra. Ví dụ, việc mở khóa một vùng ở giữa của một khóa lớn hơn đang tồn tại sẽ để lại hai vùng bị khóa nhỏ hơn ở hai bên của vùng được mở khóa. Nếu một khóa mới chồng lên một khóa hiện có với chế độ khác, thì khóa hiện có sẽ bị thu nhỏ lại, bởi vì các byte chồng chéo được hợp thành khóa mới.
- Việc đóng một mô tả tệp (closing a file descriptor) có một số ngữ nghĩa bất thường đối với các khóa vùng tệp. Chúng ta mô tả các ngữ nghĩa này trong Mục [55.3.5.](#page-19-0)

```
1. After placing read lock (L_start = 10, L_len = 30)

Byte:     10                               39
          |--------------------------------|
          |          READ LOCK             |
          | (bytes 10 .. 39, shared lock)  |
          |--------------------------------|

2. After placing write lock (L_start = 20, L_len = 10)

Byte:     10       19 20           29      39
          |--------| |-------------|------|
          | READ   | |  WRITE      | READ |
          | LOCK   | |   LOCK      | LOCK |
          | 10-19  | |   20-29     | 30-39|
          |--------| |-------------|------|
```

**Hình 55-3:** Sự chia tách một khóa đọc hiện có bởi một khóa ghi do cùng một tiến trình thực hiện

### 55.3.1 Trạng thái bế tắc (Deadlock)

Khi sử dụng `F_SETLKW`, chúng ta cần lưu ý đến loại kịch bản được minh họa trong [Hình 55-4](#page-12-0). Trong kịch bản này, yêu cầu khóa thứ hai của mỗi tiến trình (process) bị chặn (blocked) bởi một khóa đang được giữ bởi tiến trình kia. Kịch bản như vậy được gọi là trạng thái bế tắc (deadlock). Nếu không được kernel kiểm tra, tình trạng này sẽ khiến cả hai tiến trình bị chặn vĩnh viễn. Để ngăn chặn khả năng này, kernel sẽ kiểm tra mỗi yêu cầu khóa mới được thực hiện thông qua `F_SETLKW` xem nó có dẫn đến tình trạng deadlock hay không. Nếu có, kernel sẽ chọn một trong các tiến trình bị chặn và làm cho lệnh gọi `fcntl()` của nó được giải phóng khỏi trạng thái chặn và trả về lỗi `EDEADLK`. (Trên Linux, tiến trình thực hiện lệnh gọi `fcntl()` gần đây nhất sẽ được chọn, nhưng điều này không bắt buộc bởi tiêu chuẩn SUSv3 và có thể không đúng trên các phiên bản Linux trong tương lai hoặc trên các triển khai UNIX khác. Bất kỳ tiến trình nào sử dụng `F_SETLKW` đều phải chuẩn bị sẵn sàng để xử lý lỗi `EDEADLK`.)

```
              Tiến trình A                                         Tiến trình B
           ─────────────────                                   ─────────────────
                                                                                                               Thời gian                   
                                                                                                                 |
(1) A: F_SETLKW các byte 10–19 của tệp X để ghi                                                                  |
                                                                                                                 |
                                                     (2) B: F_SETLKW các byte 50–59 của tệp X để ghi               |
                                                                                                                 |
(3) A: F_SETLKW các byte 50–59 của tệp X để ghi                                                                  |
                                                                                                                 |
                                                     (4) B: F_SETLKW các byte 10–19 của tệp X để ghi               ↓
```

**Hình 55-4:** Trạng thái bế tắc (Deadlock) khi hai tiến trình từ chối yêu cầu khóa của nhau

Các tình trạng deadlock được phát hiện ngay cả khi đặt khóa trên nhiều tệp khác nhau, cũng như các deadlock vòng tròn (circular deadlocks) liên quan đến nhiều tiến trình. (Ý của chúng tôi về deadlock vòng tròn là, ví dụ, tiến trình A đang đợi để có được khóa trên một vùng do tiến trình B khóa, tiến trình B đang đợi khóa do tiến trình C giữ, và tiến trình C đang đợi khóa do tiến trình A giữ.)

### 55.3.2 Ví dụ: Một Chương Trình Khóa Tương Tác

Chương trình được thể hiện trong [Liệt kê 55-2](#page-13-0) cho phép chúng ta thử nghiệm tương tác với khóa bản ghi (record locking). Chương trình này nhận một đối số dòng lệnh (command-line argument) duy nhất: tên của tệp mà chúng ta muốn đặt khóa. Bằng cách sử dụng chương trình này, chúng ta có thể xác minh nhiều nhận định trước đó của mình liên quan đến hoạt động của khóa bản ghi. Chương trình được thiết kế để sử dụng tương tác và chấp nhận các lệnh có dạng sau:

### cmd lock start length [ whence ]

Đối với cmd, chúng ta có thể chỉ định `g` để thực hiện `F_GETLK`, `s` để thực hiện `F_SETLK`, hoặc `w` để thực hiện `F_SETLKW`. Các đối số còn lại được dùng để khởi tạo cấu trúc `flock` được truyền cho `fcntl()`. Đối số lock chỉ định giá trị cho trường `l_type` và là `r` cho `F_RDLCK`, `w` cho `F_WRLCK`, hoặc `u` cho `F_UNLCK`. Các đối số start và length là các số nguyên chỉ định giá trị cho các trường `l_start` và `l_len`. Cuối cùng, đối số whence tùy chọn chỉ định giá trị cho trường `l_whence`, và có thể là `s` cho `SEEK_SET` (mặc định), `c` cho `SEEK_CUR`, hoặc `e` cho `SEEK_END`. (Để biết giải thích về lý do tại sao chúng ta ép kiểu các trường `l_start` và `l_len` thành `long long` trong lệnh gọi `printf()` ở [Liệt kê 55-2](#page-13-0), hãy xem Mục 5.10.)

```c
–––––––––––––––––––––––––––––––––––––––––––– filelock/i_fcntl_locking.c
## include <sys/stat.h>
## include <fcntl.h>
## include "tlpi_hdr.h"
## define MAX_LINE 100
static void
displayCmdFmt(void)
{
 printf("\n Format: cmd lock start length [whence]\n\n");
 printf(" 'cmd' is 'g' (GETLK), 's' (SETLK), or 'w' (SETLKW)\n");
 printf(" 'lock' is 'r' (READ), 'w' (WRITE), or 'u' (UNLOCK)\n");
 printf(" 'start' and 'length' specify byte range to lock\n");
 printf(" 'whence' is 's' (SEEK_SET, default), 'c' (SEEK_CUR), "
 "or 'e' (SEEK_END)\n\n");
}
int
main(int argc, char *argv[])
{
 int fd, numRead, cmd, status;
 char lock, cmdCh, whence, line[MAX_LINE];
 struct flock fl;
 long long len, st;
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s file\n", argv[0]);
 fd = open(argv[1], O_RDWR);
 if (fd == -1)
 errExit("open (%s)", argv[1]);
 printf("Enter ? for help\n");
 for (;;) { /* Prompt for locking command and carry it out */
 printf("PID=%ld> ", (long) getpid());
 fflush(stdout);
 if (fgets(line, MAX_LINE, stdin) == NULL) /* EOF */
 exit(EXIT_SUCCESS);
 line[strlen(line) - 1] = '\0'; /* Remove trailing '\n' */
 if (*line == '\0')
 continue; /* Skip blank lines */
 if (line[0] == '?') {
 displayCmdFmt();
 continue;
 }
 whence = 's'; /* In case not otherwise filled in */
```

```c
 numRead = sscanf(line, "%c %c %lld %lld %c", &cmdCh, &lock,
 &st, &len, &whence);
 fl.l_start = st;
 fl.l_len = len;
 if (numRead < 4 || strchr("gsw", cmdCh) == NULL ||
 strchr("rwu", lock) == NULL || strchr("sce", whence) == NULL) {
        printf("Invalid command!\n");
 continue;
 }
 cmd = (cmdCh == 'g') ? F_GETLK : (cmdCh == 's') ? F_SETLK : F_SETLKW;
 fl.l_type = (lock == 'r') ? F_RDLCK : (lock == 'w') ? F_WRLCK : F_UNLCK;
 fl.l_whence = (whence == 'c') ? SEEK_CUR :
 (whence == 'e') ? SEEK_END : SEEK_SET;
 status = fcntl(fd, cmd, &fl); /* Perform request... */
 if (cmd == F_GETLK) { /* ... and see what happened */
 if (status == -1) {
 errMsg("fcntl - F_GETLK");
 } else {
 if (fl.l_type == F_UNLCK)
 printf("[PID=%ld] Lock can be placed\n", (long) getpid());
 else /* Locked out by someone else */
 printf("[PID=%ld] Denied by %s lock on %lld:%lld "
 "(held by PID %ld)\n", (long) getpid(),
 (fl.l_type == F_RDLCK) ? "READ" : "WRITE",
 (long long) fl.l_start,
 (long long) fl.l_len, (long) fl.l_pid);
 }
 } else { /* F_SETLK, F_SETLKW */
 if (status == 0)
 printf("[PID=%ld] %s\n", (long) getpid(),
 (lock == 'u') ? "unlocked" : "got lock");
 else if (errno == EAGAIN || errno == EACCES) /* F_SETLK */
 printf("[PID=%ld] failed (incompatible lock)\n",
 (long) getpid());
 else if (errno == EDEADLK) /* F_SETLKW */
 printf("[PID=%ld] failed (deadlock)\n", (long) getpid());
 else
 errMsg("fcntl - F_SETLK(W)");
 }
 }
}
–––––––––––––––––––––––––––––––––––––––––––– filelock/i_fcntl_locking.c
```

Trong các nhật ký phiên shell (shell session logs) sau đây, chúng ta minh họa việc sử dụng chương trình trong Liệt kê 55-2 bằng cách chạy hai tiến trình (instances) để đặt khóa trên cùng một tệp 100 byte (`tfile`). Hình 55-5 cho thấy trạng thái của các yêu cầu khóa được cấp phát (granted) và nằm trong hàng đợi (queued) tại các thời điểm khác nhau trong nhật ký phiên shell này, như được ghi chú trong phần bình luận bên dưới.

Chúng ta khởi động tiến trình đầu tiên (tiến trình A) của chương trình trong [Liệt kê 55-2](#page-13-0), đặt một khóa đọc (read lock) trên các byte từ 0 đến 39 của tệp:

```bash
Terminal window 1
$ ls -l tfile
-rw-r--r-- 1 mtk users 100 Apr 18 12:19 tfile
$ ./i_fcntl_locking tfile
Enter ? for help
PID=790> s r 0 40
[PID=790] got lock
```

Sau đó, chúng ta khởi động tiến trình thứ hai của chương trình (tiến trình B), đặt một khóa đọc trên các byte từ 70 cho đến cuối tệp:

```bash
 Terminal window 2
 $ ./i_fcntl_locking tfile
 Enter ? for help
 PID=800> s r -30 0 e
 [PID=800] got lock
```

Tại thời điểm này, các tiến trình xuất hiện như trong phần a của Hình 55-5, trong đó tiến trình A (Process ID 790) và tiến trình B (Process ID 800) đang giữ các ổ khóa (lock) trên các phần khác nhau của tệp (file).

Bây giờ chúng ta quay lại với tiến trình A, nơi chúng ta thử đặt một ổ khóa ghi (write lock) trên toàn bộ tệp. Đầu tiên, chúng ta sử dụng `F_GETLK` để kiểm tra xem ổ khóa có thể được đặt hay không và được thông báo rằng có một ổ khóa xung đột (conflicting lock). Sau đó, chúng ta thử đặt ổ khóa bằng `F_SETLK`, hành động này cũng thất bại. Cuối cùng, chúng ta thử đặt ổ khóa bằng `F_SETLKW`, hành động này sẽ chuyển sang trạng thái chờ (block).

```
PID=790> g w 0 0
[PID=790] Denied by READ lock on 70:0 (held by PID 800)
PID=790> s w 0 0
[PID=790] failed (incompatible lock)
PID=790> w w 0 0
```

Tại thời điểm này, trạng thái hiển thị như trong phần b của Hình 55-5, trong đó tiến trình A và tiến trình B mỗi tiến trình giữ một ổ khóa trên các phần khác nhau của tệp, và tiến trình A có một yêu cầu khóa đang được xếp hàng đợi (queued lock request) trên toàn bộ tệp.

Chúng ta tiếp tục với tiến trình B, bằng cách thử đặt một ổ khóa ghi trên toàn bộ tệp. Đầu tiên, chúng ta kiểm tra xem ổ khóa có thể được đặt hay không bằng cách sử dụng `F_GETLK`, thông báo cho chúng ta biết rằng có một ổ khóa xung đột. Sau đó, chúng ta thử đặt ổ khóa bằng cách sử dụng `F_SETLKW`.

```
 PID=800> g w 0 0
 [PID=800] Denied by READ lock on 0:40
 (held by PID 790)
 PID=800> w w 0 0
 [PID=800] failed (deadlock)
```

Phần c của Hình 55-5 minh họa điều gì đã xảy ra khi tiến trình B thực hiện một yêu cầu chặn (blocking request) để đặt ổ khóa ghi trên toàn bộ tệp: xảy ra tình trạng bế tắc (deadlock). Tại thời điểm này, kernel đã chọn một trong các yêu cầu khóa để làm thất bại — trong trường hợp này là yêu cầu của tiến trình B, tiến trình này sau đó nhận được lỗi `EDEADLK` từ lệnh gọi `fcntl()` của nó.

Chúng ta tiếp tục với tiến trình B, bằng cách xóa tất cả các ổ khóa của nó trên tệp:

```
 PID=800> s u 0 0
 [PID=800] unlocked
```

[PID=790] got lock

Như chúng ta thấy từ dòng đầu ra cuối cùng, điều này đã cho phép yêu cầu khóa bị chặn của tiến trình A được cấp phát (granted).

Điều quan trọng cần nhận ra là mặc dù yêu cầu bị bế tắc của tiến trình B đã bị hủy, nhưng nó vẫn giữ ổ khóa khác của mình, và do đó yêu cầu khóa đang xếp hàng đợi của tiến trình A vẫn tiếp tục ở trạng thái bị chặn. Yêu cầu khóa của tiến trình A chỉ được cấp phát khi tiến trình B xóa ổ khóa còn lại của nó, tạo ra tình huống được minh họa trong phần d của Hình 55-5.

```
Chú thích:
[hộp liền nét]  = Ổ khóa đã được cấp (Granted lock)
[hộp đứt nét]  = Ổ khóa trong hàng đợi (Queued lock)

Độ lệch tệp (File offset): 0 -------------------------------------------- 99

a)
0                           39                70                          99
|---------------------------|                 |---------------------------|
[ PID=790, type=READ ]                        [ PID=800, type=READ ]

b)
0                           39                70                          99
|---------------------------|                 |---------------------------|
[ PID=790, type=READ ]                        [ PID=800, type=READ ]

0 ----------------------------------------------------------------------- 99
[ PID=790, type=WRITE ]   

c)
0                           39                70                          99
|---------------------------|                 |---------------------------|
[ PID=790, type=READ ]                        [ PID=800, type=READ ]

0 ----------------------------------------------------------------------- 99
[ PID=790, type=WRITE ]   (đang xếp hàng - queued)

0 ----------------------------------------------------------------------- 99
[ PID=800, type=WRITE ]   (đang xếp hàng, bị hủy do bế tắc - deadlock)

d)
0 ----------------------------------------------------------------------- 99
[ PID=790, type=WRITE ]   (đã cấp phát trên toàn bộ tệp)
```

**Hình 55-5:** Trạng thái của các yêu cầu khóa được cấp phát và xếp hàng đợi khi chạy chương trình `i_fcntl_locking.c`

### 55.3.3 Ví dụ: Thư viện các hàm khóa (Locking Functions)

[Liệt kê 55-3](#page-17-0) cung cấp một tập hợp các hàm khóa mà chúng ta có thể sử dụng trong các chương trình khác. Các hàm này bao gồm:

- Hàm `lockRegion()` sử dụng `F_SETLK` để đặt một ổ khóa trên tệp đang mở được tham chiếu bởi bộ mô tả tệp (file descriptor) `fd`. Tham số `type` chỉ định loại khóa (`F_RDLCK` hoặc `F_WRLCK`). Các tham số `whence`, `start` và `len` chỉ định phạm vi byte cần khóa. Các tham số này cung cấp giá trị cho các trường có tên tương tự của cấu trúc `flock` được sử dụng để đặt khóa.
- Hàm `lockRegionWait()` tương tự như `lockRegion()`, nhưng thực hiện yêu cầu khóa chặn (blocking lock request); nghĩa là, nó sử dụng `F_SETLKW` thay vì `F_SETLK`.

Hàm `regionIsLocked()` kiểm tra xem một ổ khóa có thể được đặt trên tệp hay không. Các tham số của hàm này giống như đối với `lockRegion()`. Hàm này trả về 0 (sai - false) nếu không có tiến trình nào giữ ổ khóa xung đột với ổ khóa được chỉ định trong lời gọi. Nếu có một hoặc nhiều tiến trình giữ các ổ khóa xung đột, thì hàm này trả về một giá trị khác 0 (tức là đúng - true) — đó là Process ID của một trong các tiến trình đang giữ ổ khóa xung đột.

**Liệt kê 55-3:** Các hàm khóa vùng tệp (File region locking functions)

```
––––––––––––––––––––––––––––––––––––––––––––– filelock/region_locking.c
## include <fcntl.h>
## include "region_locking.h" /* Khai báo các hàm được định nghĩa ở đây */
/* Khóa một vùng tệp (riêng tư; giao diện công khai ở bên dưới) */
static int
lockReg(int fd, int cmd, int type, int whence, int start, off_t len)
{
 struct flock fl;
 fl.l_type = type;
 fl.l_whence = whence;
 fl.l_start = start;
 fl.l_len = len;
 return fcntl(fd, cmd, &fl);
}
int /* Khóa vùng tệp sử dụng F_SETLK không chặn */
lockRegion(int fd, int type, int whence, int start, int len)
{
 return lockReg(fd, F_SETLK, type, whence, start, len);
}
int /* Khóa vùng tệp sử dụng F_SETLKW có chặn */
lockRegionWait(int fd, int type, int whence, int start, int len)
{
 return lockReg(fd, F_SETLKW, type, whence, start, len);
}
/* Kiểm tra xem vùng tệp có thể khóa được không. Trả về 0 nếu khóa được, hoặc
 PID của tiến trình đang giữ khóa không tương thích, hoặc -1 nếu có lỗi. */
pid_t
regionIsLocked(int fd, int type, int whence, int start, int len)
{
 struct flock fl;
 fl.l_type = type;
 fl.l_whence = whence;
 fl.l_start = start;
```

fl.l_len = len;

```
 if (fcntl(fd, F_GETLK, &fl) == -1)
 return -1;
 return (fl.l_type == F_UNLCK) ? 0 : fl.l_pid;
}
––––––––––––––––––––––––––––––––––––––––––––– filelock/region_locking.c
```

### 55.3.4 Giới hạn Khóa và Hiệu năng

SUSv3 cho phép một bản cài đặt (implementation) thiết lập các giới hạn trên cố định trên toàn hệ thống (system-wide upper limits) đối với số lượng khóa bản ghi (record locks) có thể được thiết lập. Khi đạt đến giới hạn này, hàm `fcntl()` sẽ thất bại với mã lỗi `ENOLCK`. Linux không đặt giới hạn trên cố định đối với số lượng khóa bản ghi có thể được thiết lập; chúng ta chỉ bị giới hạn bởi dung lượng bộ nhớ khả dụng (Nhiều bản cài đặt UNIX khác cũng có cách tiếp cận tương tự).

Các khóa bản ghi có thể được thiết lập và giải phóng nhanh đến mức nào? Không có câu trả lời cố định cho câu hỏi này, vì tốc độ của các thao tác này là một hàm số phụ thuộc vào cấu trúc dữ liệu của kernel (kernel data structure) dùng để duy trì các khóa bản ghi và vị trí của một khóa cụ thể bên trong cấu trúc dữ liệu đó. Chúng ta sẽ xem xét cấu trúc này ngay sau đây, nhưng trước tiên hãy điểm qua một số yêu cầu ảnh hưởng đến thiết kế của nó:

- Kernel cần có khả năng hợp nhất (merge) một khóa mới với bất kỳ khóa hiện có nào (do cùng một tiến trình - process nắm giữ) có cùng chế độ nằm ở hai phía của khóa mới.
- Một khóa mới có thể thay thế hoàn toàn một hoặc nhiều khóa hiện có do tiến trình gọi (calling process) nắm giữ. Kernel cần có khả năng định vị dễ dàng tất cả các khóa này.
- Khi tạo một khóa mới với một chế độ khác nằm ở giữa một khóa hiện có, công việc chia tách (splitting) khóa hiện có ([Hình 55-3](#page-11-0)) sẽ trở nên đơn giản.

Cấu trúc dữ liệu của kernel được sử dụng để duy trì thông tin về các khóa được thiết kế để đáp ứng các yêu cầu này. Mỗi tệp đang mở (open file) có một danh sách liên kết (linked list) các khóa liên quan được nắm giữ đối với tệp đó. Các khóa trong danh sách được sắp xếp, đầu tiên theo ID tiến trình (process ID), và sau đó theo offset bắt đầu. Một ví dụ về danh sách như vậy được minh họa trong [Hình 55-6.](#page-18-0)

> [!NOTE]
> Kernel cũng duy trì các khóa `flock()` và lease tệp (file leases) trong danh sách liên kết các khóa liên quan đến một tệp đang mở. (Chúng ta sẽ mô tả ngắn gọn về lease tệp khi thảo luận về tệp `/proc/locks` ở [Mục 55.5](#page-23-0)). Tuy nhiên, các loại khóa này thường có số lượng ít hơn rất nhiều và do đó ít có khả năng ảnh hưởng đến hiệu năng, nên chúng ta sẽ bỏ qua chúng trong phần thảo luận này.

```
 Key
 l_pid
 l_start
 l_len
 l_type
 l_next  

+-------+      +-------+      +-------+      +-------+      +-------+
| 461   |      | 461   |      | 871   |      | 871   |      | 871   |
| 100   |  ->  | 300   |  ->  | 100   |  ->  | 500   |  ->  | 2400  |
| 10    |      | 30    |      | 10    |      | 40    |      | 0     |
| RD    |      | WR    |      | RD    |      | WR    |      | RD    |
+-------+      +-------+      +-------+      +-------+      +-------+
                                                               |
                                                               v
                                                            +-------+      +-------+      +-------+      +-------+
                                                            | 1961  |      | 1961  |      | 1961  |      | 1961  |
                                                            | 50    |  ->  | 1000  |  ->  | 2000  |  ->  | 4000  |
                                                            | 100   |      | 100   |      | 10    |      | 100   |
                                                            | RD    |      | WR    |      | WR    |      | RD    |
                                                            +-------+      +-------+      +-------+      +-------+
                                                                                                               |
                                                                                                               v
                                                                                                             NULL
```

**Hình 55-6:** Ví dụ về một danh sách khóa bản ghi cho một tệp duy nhất

Bất cứ khi nào một khóa mới được thêm vào cấu trúc dữ liệu này, kernel phải kiểm tra xung đột với bất kỳ khóa hiện có nào trên tệp đó. Quá trình tìm kiếm này được thực hiện tuần tự, bắt đầu từ đầu danh sách (head of the list).

Giả sử có một số lượng lớn các khóa được phân phối ngẫu nhiên giữa nhiều tiến trình, chúng ta có thể nói rằng thời gian cần thiết để thêm hoặc xóa một khóa tăng lên xấp xỉ tuyến tính (linearly) theo số lượng khóa đã được nắm giữ trên tệp đó.

### 55.3.5 Ngữ nghĩa của việc kế thừa và giải phóng khóa (Lock Inheritance and Release)

Ngữ nghĩa của việc kế thừa và giải phóng khóa bản ghi (record lock) trong `fcntl()` khác biệt đáng kể so với các khóa được tạo bằng `flock()`. Hãy lưu ý các điểm sau:

- Khóa bản ghi không được kế thừa qua hàm `fork()` bởi tiến trình con (child process). Điều này trái ngược với `flock()`, nơi tiến trình con kế thừa một tham chiếu đến cùng một khóa và có thể giải phóng khóa này, dẫn đến việc tiến trình cha (parent process) cũng bị mất khóa.
- Khóa bản ghi được bảo toàn qua lời gọi `exec()`. (Tuy nhiên, cần lưu ý ảnh hưởng của cờ đóng khi thực thi - close-on-exec flag, được mô tả bên dưới).
- Tất cả các luồng (thread) trong một tiến trình đều chia sẻ chung một tập hợp các khóa bản ghi.
- Khóa bản ghi được liên kết với cả tiến trình và một i-node (tham khảo Mục 5.4). Một hệ quả không có gì bất ngờ của mối liên kết này là khi một tiến trình chấm dứt (terminate), tất cả các khóa bản ghi của nó đều được giải phóng. Điều ít ngờ tới hơn là bất cứ khi nào một tiến trình đóng một file descriptor (mô tả tệp), tất cả các khóa do tiến trình nắm giữ trên tệp tương ứng sẽ được giải phóng, bất kể (các) file descriptor mà qua đó các khóa đã được lấy. Ví dụ, trong đoạn mã sau, lời gọi `close(fd2)` sẽ giải phóng khóa do tiến trình gọi giữ trên `testfile`, mặc dù khóa đó đã được lấy thông qua file descriptor `fd1`:

```c
struct flock fl;
fl.l_type = F_WRLCK;
fl.l_whence = SEEK_SET;
fl.l_start = 0;
fl.l_len = 0;
fd1 = open("testfile", O_RDWR);
fd2 = open("testfile", O_RDWR);
if (fcntl(fd1, cmd, &fl) == -1)
 errExit("fcntl");
close(fd2);
```

Ngữ nghĩa được mô tả ở điểm cuối cùng áp dụng cho dù các file descriptor khác nhau trỏ đến cùng một tệp được lấy bằng cách nào và file descriptor được đóng như thế nào. Ví dụ, `dup()`, `dup2()`, và `fcntl()` đều có thể được sử dụng để tạo các bản sao của một file descriptor đang mở. Và bên cạnh việc thực hiện một lời gọi `close()` tường minh, một descriptor có thể bị đóng bởi lời gọi `exec()` nếu cờ đóng khi thực thi được thiết lập, hoặc thông qua lời gọi `dup2()`, hàm này sẽ đóng đối số file descriptor thứ hai nếu descriptor đó đã mở.

Ngữ nghĩa kế thừa và giải phóng khóa của `fcntl()` là một điểm hạn chế về mặt kiến trúc (architectural blemish). Ví dụ, chúng làm cho việc sử dụng khóa bản ghi từ các gói thư viện (library package) trở nên có vấn đề, vì một hàm thư viện không thể ngăn chặn khả năng người gọi nó sẽ đóng một file descriptor trỏ đến một tệp đang bị khóa và do đó làm mất khóa do mã nguồn thư viện lấy. Một sơ đồ cài đặt thay thế đáng lẽ là liên kết khóa với một file descriptor thay vì với một i-node. Tuy nhiên, ngữ nghĩa hiện tại là hành vi lịch sử và nay đã trở thành tiêu chuẩn của khóa bản ghi. Thật không may, ngữ nghĩa này làm giảm đáng kể tính hữu dụng của cơ chế khóa `fcntl()`.

> [!NOTE]
> Với `flock()`, một khóa chỉ được liên kết với một mô tả tệp mở (open file description), và vẫn có hiệu lực cho đến khi bất kỳ tiến trình nào nắm giữ tham chiếu đến khóa thực hiện giải phóng khóa một cách tường minh hoặc tất cả các file descriptor trỏ đến mô tả tệp mở đó đều bị đóng.

### 55.3.6 Hiện tượng đói khóa (Lock Starvation) và Thứ tự ưu tiên của các yêu cầu khóa trong hàng đợi

Khi có nhiều process phải chờ để đặt khóa (lock) lên một vùng đang bị khóa, một số câu hỏi sẽ được đặt ra.

Liệu một process đang chờ đặt write lock có thể bị bỏ đói (starve) bởi một chuỗi các process đặt read lock trên cùng một vùng đó không? Trên Linux (giống như trên nhiều hệ thống UNIX khác), một chuỗi các read lock thực sự có thể làm đói một write lock đang bị chặn (blocked), có khả năng kéo dài vô thời hạn.

Khi có từ hai process trở lên đang chờ đặt khóa, có quy tắc nào xác định process nào sẽ nhận được khóa khi nó khả dụng không? Ví dụ, các yêu cầu khóa có được đáp ứng theo thứ tự FIFO (vào trước ra trước) không? Và các quy tắc này có phụ thuộc vào loại khóa mà mỗi process đang yêu cầu hay không (tức là, process yêu cầu read lock có ưu tiên hơn process yêu cầu write lock hay ngược lại, hoặc không bên nào ưu tiên hơn)? Trên Linux, các quy tắc như sau:

- Thứ tự cấp phát các yêu cầu khóa trong hàng đợi là không xác định (indeterminate). Nếu có nhiều process đang chờ đặt khóa, thì thứ tự chúng được đáp ứng sẽ phụ thuộc vào cách các process được lập lịch (scheduled).
- Writer không có ưu tiên hơn reader, và ngược lại.

Các nhận định này không nhất thiết đúng trên các hệ thống khác. Trên một số hệ thống UNIX, các yêu cầu khóa được phục vụ theo thứ tự FIFO, và reader được ưu tiên hơn writer.

## 55.4 Khóa bắt buộc (Mandatory Locking)

Các loại khóa mà chúng ta đã mô tả cho đến nay đều là khóa khuyến nghị (advisory). Điều này có nghĩa là một process hoàn toàn có thể tự do bỏ qua việc sử dụng `fcntl()` (hoặc `flock()`) và chỉ đơn giản là thực hiện I/O trên file. Kernel không ngăn cản điều này. Khi sử dụng advisory locking, nhà thiết kế ứng dụng có trách nhiệm phải:

- thiết lập quyền sở hữu (hoặc quyền sở hữu nhóm - group ownership) và quyền truy cập (permissions) phù hợp cho file, nhằm ngăn chặn các process không hợp tác thực hiện I/O trên file; và
- đảm bảo rằng các process cấu thành ứng dụng phải hợp tác bằng cách lấy được khóa phù hợp trên file trước khi thực hiện I/O.

Linux, giống như nhiều hệ thống UNIX khác, cũng cho phép các record lock của `fcntl()` trở thành khóa bắt buộc (mandatory). Điều này có nghĩa là mọi thao tác I/O trên file đều được kiểm tra xem nó có tương thích với bất kỳ khóa nào do các process khác đang giữ trên vùng file mà I/O đang diễn ra hay không.

> [!NOTE]
> Khóa ở chế độ khuyến nghị (Advisory mode locking) đôi khi được gọi là khóa tùy ý (discretionary locking), trong khi khóa bắt buộc (mandatory locking) đôi khi được gọi là khóa chế độ thực thi (enforcement-mode locking). SUSv3 không quy định về mandatory locking, nhưng nó có sẵn (với một số khác biệt nhỏ về chi tiết) trên hầu hết các hệ thống UNIX hiện đại.

Để sử dụng mandatory locking trên Linux, chúng ta phải bật tính năng này trên file system chứa các file mà chúng ta muốn khóa và trên từng file cần khóa. Chúng ta bật mandatory locking trên một file system bằng cách mount nó với tùy chọn `-o mand` (đặc trưng của Linux):

## mount -o mand /dev/sda10 /testfs

```

Từ một chương trình, chúng ta có thể đạt được kết quả tương tự bằng cách chỉ định cờ `MS_MANDLOCK` khi gọi `mount(2)` (Mục 14.8.1).

Chúng ta có thể kiểm tra xem một file system đã được mount có bật mandatory locking hay không bằng cách xem đầu ra của lệnh `mount(8)` mà không có tùy chọn nào:

## mount | grep sda10
/dev/sda10 on /testfs type ext3 (rw,mand)
```

Mandatory locking được bật trên một file thông qua sự kết hợp giữa việc bật bit quyền set-group-ID và tắt quyền thực thi của nhóm (group-execute). Sự kết hợp các bit quyền này vốn dĩ không có ý nghĩa và không được sử dụng trong các hệ thống UNIX trước đây. Bằng cách này, các hệ thống UNIX sau này đã bổ sung mandatory locking mà không cần phải thay đổi các chương trình hiện có hoặc thêm các system call mới. Từ shell, chúng ta có thể bật mandatory locking trên một file như sau:

```
$ chmod g+s,g-x /testfs/file
```

Từ một chương trình, chúng ta có thể bật mandatory locking cho một file bằng cách thiết lập các quyền phù hợp sử dụng `chmod()` hoặc `fchmod()` (Mục 15.4.7).

Khi hiển thị quyền đối với một file có các bit quyền được thiết lập cho mandatory locking, lệnh `ls(1)` sẽ hiển thị ký tự `S` ở cột quyền thực thi của nhóm:

```
$ ls -l /testfs/file
-rw-r-Sr-- 1 mtk users 0 Apr 22 14:11 /testfs/file
```

Mandatory locking được hỗ trợ cho tất cả các file system gốc của Linux và UNIX, nhưng có thể không được hỗ trợ trên một số file system mạng (network file system) hoặc trên các file system không phải UNIX. Ví dụ, file system VFAT của Microsoft không có bit quyền set-group-ID, do đó mandatory locking không thể được sử dụng trên các file system VFAT.

## Ảnh hưởng của khóa bắt buộc (mandatory locking) lên các thao tác I/O của tệp

Nếu khóa bắt buộc (mandatory locking) được bật cho một tệp, điều gì sẽ xảy ra khi một System Call thực hiện truyền dữ liệu (ví dụ: `read()` hoặc `write()`) gặp phải xung đột khóa (nghĩa là, có một cố gắng ghi vào một vùng đang bị khóa đọc hoặc khóa ghi, hoặc đọc từ một vùng đang bị khóa ghi)? Câu trả lời phụ thuộc vào việc tệp được mở ở chế độ chặn (blocking mode) hay không chặn (nonblocking mode). Nếu tệp được mở ở chế độ chặn, System Call sẽ bị chặn (block). Nếu tệp được mở với cờ `O_NONBLOCK`, System Call sẽ thất bại ngay lập tức với lỗi `EAGAIN`. Các quy tắc tương tự cũng áp dụng cho `truncate()` và `ftruncate()`, nếu các byte mà chúng đang cố gắng thêm vào hoặc loại bỏ khỏi tệp chồng lấn lên một vùng hiện đang bị khóa (để đọc hoặc ghi) bởi một Process khác.

Nếu chúng ta mở một tệp ở chế độ chặn (nghĩa là `O_NONBLOCK` không được chỉ định trong lời gọi `open()`), thì các System Call I/O có thể vướng vào các tình huống bế tắc (Deadlock). Hãy xem xét ví dụ được minh họa trong [Hình 55-7](#page-22-0), liên quan đến hai Process mở cùng một tệp cho I/O ở chế độ chặn, lấy các khóa ghi trên các phần khác nhau của tệp, và sau đó mỗi Process đều cố gắng ghi vào vùng bị khóa bởi Process kia. Kernel giải quyết tình huống này theo cách tương tự như cách giải quyết bế tắc giữa hai lời gọi `fcntl()` (Mục [55.3.1](#page-11-1)): nó chọn một trong các Process tham gia vào Deadlock và làm cho System Call `write()` của Process đó thất bại với lỗi `EDEADLK`.

```
                Process A                                      Process B
            ─────────────────                              ─────────────────
Time ↓

(1) A: F_SETLKW bytes 0–99 of file X for writing

                                                   (2) B: F_SETLKW bytes 100–1999 of file X for writing

(3) A: Seek to byte 100 of file X
        and perform a write()

                                                   (4) B: Seek to byte 0 of file X and perform a write()

```

**Hình 55-7:** Deadlock khi khóa bắt buộc (mandatory locking) có hiệu lực

Các cố gắng `open()` một tệp với cờ `O_TRUNC` sẽ luôn thất bại ngay lập tức (với lỗi `EAGAIN`) nếu có bất kỳ Process nào khác đang giữ khóa đọc hoặc khóa ghi trên bất kỳ phần nào của tệp.

Không thể tạo một ánh xạ bộ nhớ chia sẻ (shared memory mapping) (nghĩa là `mmap()` với cờ `MAP_SHARED`) trên một tệp nếu có bất kỳ Process nào khác đang giữ khóa đọc hoặc khóa ghi bắt buộc trên bất kỳ phần nào của tệp. Ngược lại, không thể đặt một khóa bắt buộc lên bất kỳ phần nào của một tệp hiện đang tham gia vào một ánh xạ bộ nhớ chia sẻ. Trong cả hai trường hợp, System Call liên quan sẽ thất bại ngay lập tức với lỗi `EAGAIN`. Lý do cho những hạn chế này trở nên rõ ràng khi chúng ta xem xét việc triển khai các ánh xạ bộ nhớ. Ở Mục 49.4.2, chúng ta đã thấy rằng một ánh xạ tệp chia sẻ (shared file mapping) vừa đọc từ vừa ghi vào một tệp (và cụ thể là thao tác ghi xung đột với bất kỳ loại khóa nào trên tệp). Hơn nữa, I/O tệp này được thực hiện bởi hệ thống con quản lý bộ nhớ (memory-management subsystem), vốn không có thông tin về vị trí của bất kỳ khóa tệp nào trong hệ thống. Do đó, để ngăn chặn một ánh xạ cập nhật tệp đang giữ khóa bắt buộc, Kernel thực hiện một kiểm tra đơn giản—kiểm tra tại thời điểm gọi `mmap()` xem có khóa nào ở bất kỳ đâu trong tệp cần ánh xạ hay không (và ngược lại đối với `fcntl()`).

## Các điểm lưu ý về khóa bắt buộc (Mandatory Locking)

Khóa bắt buộc (mandatory lock) mang lại ít lợi ích hơn chúng ta tưởng tượng ban đầu và đi kèm với một số hạn chế cũng như vấn đề tiềm ẩn:

- Việc nắm giữ một khóa bắt buộc trên một tập tin không ngăn cản tiến trình (process) khác xóa nó, vì tất cả những gì cần thiết để hủy liên kết (unlink) một tập tin là quyền hạn phù hợp trên thư mục cha (parent directory).
- Cần phải cân nhắc kỹ lưỡng trước khi bật khóa bắt buộc trên một tập tin có thể truy cập công khai, vì ngay cả các tiến trình có đặc quyền (privileged process) cũng không thể ghi đè lên khóa bắt buộc. Một kẻ tấn công độc hại có thể liên tục giữ khóa trên tập tin nhằm tạo ra một cuộc tấn công từ chối dịch vụ (denial-of-service attack). (Mặc dù trong hầu hết các trường hợp, chúng ta có thể làm cho tập tin có thể truy cập lại bằng cách tắt bit set-group-ID, nhưng điều này có thể không khả thi nếu, ví dụ, khóa tập tin bắt buộc đang gây ra hiện tượng treo hệ thống (hang)).
- Có một chi phí hiệu năng (performance cost) đi kèm với việc sử dụng khóa bắt buộc. Đối với mỗi System Call (System Call) I/O thực hiện trên một tập tin được bật khóa bắt buộc, kernel phải kiểm tra xung đột khóa trên tập tin đó. Nếu tập tin có số lượng lớn các khóa, việc kiểm tra này có thể làm chậm các System Call I/O một cách đáng kể.
- Khóa bắt buộc cũng làm phát sinh chi phí trong thiết kế ứng dụng. Chúng ta cần phải xử lý khả năng mỗi System Call I/O có thể trả về `EAGAIN` (đối với I/O không chặn - nonblocking I/O) hoặc `EDEADLK` (đối với I/O chặn - blocking I/O).
- Do một số điều kiện tranh chấp (Race Condition) của kernel trong bản cài đặt Linux hiện tại, có những trường hợp các System Call thực hiện thao tác I/O vẫn có thể thành công mặc dù có sự hiện diện của các khóa bắt buộc đáng lẽ phải từ chối các thao tác đó.

Tóm lại, tốt nhất là nên tránh sử dụng khóa bắt buộc.

## 55.5 Tập tin /proc/locks

Chúng ta có thể xem tập hợp các khóa hiện đang được giữ trong hệ thống bằng cách kiểm tra nội dung của tập tin đặc thù trên Linux `/proc/locks`. Dưới đây là ví dụ về thông tin chúng ta có thể thấy trong tập tin này (trong trường hợp này là cho bốn khóa):

```
$ cat /proc/locks
1: POSIX ADVISORY WRITE 458 03:07:133880 0 EOF
2: FLOCK ADVISORY WRITE 404 03:07:133875 0 EOF
3: POSIX ADVISORY WRITE 312 03:07:133853 0 EOF
4: FLOCK ADVISORY WRITE 274 03:07:81908 0 EOF
```

Tập tin `/proc/locks` hiển thị thông tin về các khóa được tạo bởi cả `flock()` và `fnctl()`. Tám trường (field) được hiển thị cho mỗi khóa như sau (từ trái sang phải):

- 1. Số thứ tự của khóa trong tập hợp tất cả các khóa đang được giữ cho tập tin này. (Tham khảo Mục [55.3.4](#page-18-1)).
- 2. Loại khóa. Ở đây, `FLOCK` biểu thị khóa được tạo bởi `flock()`, và `POSIX` biểu thị khóa được tạo bởi `fcntl()`.
- 3. Chế độ của khóa, hoặc là `ADVISORY` (khuyến cáo) hoặc `MANDATORY` (bắt buộc).
- 4. Kiểu của khóa, hoặc là `READ` hoặc `WRITE` (tương ứng với khóa chia sẻ và khóa độc quyền cho `fcntl()`).
- 5. Process ID (PID) của tiến trình đang giữ khóa.
- 6. Ba số được phân tách bằng dấu hai chấm định danh tập tin mà trên đó khóa đang được giữ. Các số này lần lượt là số thiết bị chính (major device number) và số thiết bị phụ (minor device number) của hệ thống tập tin (file system) nơi tập tin cư trú, theo sau là số i-node của tập tin.
- 7. Byte bắt đầu của khóa. Giá trị này luôn là 0 đối với các khóa `flock()`.
- 8. Byte kết thúc của khóa. Ở đây, `EOF` biểu thị rằng khóa kéo dài đến cuối tập tin (tức là `l_len` được chỉ định là 0 đối với khóa được tạo bởi `fcntl()`). Đối với các khóa `flock()`, cột này luôn là `EOF`.

Trong Linux 2.4 trở về trước, mỗi dòng của `/proc/locks` bao gồm thêm năm giá trị hệ thập lục phân. Đây là các địa chỉ con trỏ (pointer address) được kernel sử dụng để ghi lại các khóa trong các danh sách khác nhau. Các giá trị này không có ích trong các chương trình ứng dụng.

Sử dụng thông tin trong `/proc/locks`, chúng ta có thể tìm ra tiến trình nào đang giữ khóa và trên tập tin nào. Phiên shell (shell session) sau đây cho thấy cách thực hiện điều này đối với khóa số 3 trong danh sách ở trên. Khóa này được giữ bởi tiến trình có Process ID 312, trên i-node 133853 trên thiết bị có ID chính là 3 và ID phụ là 7. Chúng ta bắt đầu bằng cách sử dụng `ps(1)` để liệt kê thông tin về tiến trình có Process ID 312:

```
$ ps -p 312
 PID TTY TIME CMD
 312 ? 00:00:00 atd
```

Đầu ra trên cho thấy chương trình đang giữ khóa là `atd`, tiến trình nền (daemon) thực thi các tác vụ theo lô (batch job) theo lịch trình.

Để tìm tập tin bị khóa, trước tiên chúng ta tìm kiếm các tập tin trong thư mục `/dev`, và qua đó xác định rằng thiết bị có ID 3:7 chính là `/dev/sda7`:

```
$ ls -li /dev/sda7 | awk '$6 == "3," && $7 == 10'
 1311 brw-rw---- 1 root disk 3, 7 May 12 2006 /dev/sda7
```

Sau đó, chúng ta xác định điểm gắn kết (mount point) cho thiết bị `/dev/sda7` và tìm kiếm phần đó của hệ thống tập tin để tìm tập tin có số i-node là 133853:

```
$ mount | grep sda7
/dev/sda7 on / type reiserfs (rw) Device is mounted on /
$ su # Để chúng ta có thể tìm kiếm tất cả các thư mục
Password:
## find / -mount -inum 133853 # Tìm kiếm i-node 133853
/var/run/atd.pid
```

Tùy chọn `find –mount` ngăn chặn lệnh `find` đi xuống các thư mục con bên dưới `/` vốn là điểm gắn kết cho các hệ thống tập tin khác.

Cuối cùng, chúng ta hiển thị nội dung của tập tin bị khóa:

```markdown
## cat /var/run/atd.pid
312
```

Như vậy, chúng ta thấy rằng tiến trình nền (daemon) `atd` đang giữ một khóa (lock) trên tệp `/var/run/atd.pid`, và nội dung của tệp này chính là ID tiến trình (Process ID - PID) của tiến trình đang chạy `atd`. Tiến trình nền này đang áp dụng một kỹ thuật để đảm bảo rằng chỉ có duy nhất một thể hiện (instance) của tiến trình nền chạy tại một thời điểm. Chúng ta sẽ mô tả kỹ thuật này ở Mục [55.6](#page-25-0).

Chúng ta cũng có thể sử dụng `/proc/locks` để lấy thông tin về các yêu cầu khóa bị chặn (blocked lock request), như được minh họa trong đầu ra sau đây:

```
$ cat /proc/locks
1: POSIX ADVISORY WRITE 11073 03:07:436283 100 109
1: -> POSIX ADVISORY WRITE 11152 03:07:436283 100 109
2: POSIX MANDATORY WRITE 11014 03:07:436283 0 9
2: -> POSIX MANDATORY WRITE 11024 03:07:436283 0 9
2: -> POSIX MANDATORY READ 11122 03:07:436283 0 19
3: FLOCK ADVISORY WRITE 10802 03:07:134447 0 EOF
3: -> FLOCK ADVISORY WRITE 10840 03:07:134447 0 EOF
```

Các dòng được hiển thị với các ký tự `->` ngay sau số hiệu khóa đại diện cho các yêu cầu khóa bị chặn bởi số hiệu khóa tương ứng. Do đó, chúng ta thấy một yêu cầu bị chặn trên khóa 1 (khóa khuyến nghị - advisory lock được tạo bằng `fcntl()`), hai yêu cầu bị chặn trên khóa 2 (khóa bắt buộc - mandatory lock được tạo bằng `fcntl()`), và một yêu cầu bị chặn trên khóa 3 (khóa được tạo bằng `flock()`).

> [!NOTE]
> Tệp `/proc/locks` cũng hiển thị thông tin về bất kỳ sự cho thuê tệp (file lease) nào đang được nắm giữ bởi các tiến trình trên hệ thống. File lease là một cơ chế đặc thù của Linux có sẵn từ phiên bản Linux 2.4 trở đi. Nếu một tiến trình thiết lập lease trên một tệp, nó sẽ nhận được thông báo (thông qua việc gửi một tín hiệu - signal) nếu một tiến trình khác cố gắng `open()` hoặc `truncate()` tệp đó. (Việc bao gồm `truncate()` là cần thiết vì đây là System Call duy nhất có thể được sử dụng để thay đổi nội dung của tệp mà không cần mở tệp đó trước). File lease được cung cấp nhằm cho phép Samba hỗ trợ tính năng khóa cơ hội (opportunistic lock - oplock) của giao thức Microsoft SMB và cho phép NFS phiên bản 4 hỗ trợ các quyền ủy quyền - delegation (tương tự như SMB oplock). Các chi tiết bổ sung về file lease có thể được tìm thấy dưới phần mô tả của thao tác `F_SETLEASE` trong trang hướng dẫn (man page) `fcntl(2)`.

## 55.6 Chạy Chỉ Một Thể Hiện Duy Nhất Của Một Chương Trình

Một số chương trình—đặc biệt là nhiều tiến trình nền (daemon)—cần đảm bảo rằng chỉ có duy nhất một thể hiện của chương trình đang chạy trên hệ thống tại một thời điểm. Một phương pháp phổ biến để thực hiện điều này là yêu cầu daemon tạo một tệp trong một thư mục tiêu chuẩn và đặt một khóa ghi (write lock) lên tệp đó. Daemon giữ khóa tệp này trong suốt thời gian thực thi và xóa tệp ngay trước khi kết thúc. Nếu một thể hiện khác của daemon được khởi động, nó sẽ không thể lấy được khóa ghi trên tệp. Kết quả là, nó sẽ nhận ra rằng một thể hiện khác của daemon chắc chắn đang chạy, và tiến hành kết thúc (terminate).

> [!NOTE]
> Nhiều máy chủ mạng (network server) sử dụng một quy ước thay thế là giả định rằng một thể hiện máy chủ đã đang chạy nếu cổng socket nổi tiếng (well-known socket port) mà máy chủ liên kết (bind) tới đã được sử dụng (Mục 61.10).

Thư mục `/var/run` là vị trí thông thường cho các tệp khóa như vậy. Ngoài ra, vị trí của tệp có thể được chỉ định bằng một dòng trong tệp cấu hình của daemon.

Theo quy ước, một daemon ghi ID tiến trình của chính nó vào tệp khóa, do đó tệp này thường được đặt tên với phần mở rộng `.pid` (ví dụ: `syslogd` tạo tệp `/var/run/syslogd.pid`). Điều này rất hữu ích nếu một số ứng dụng cần tìm ID tiến trình của daemon. Nó cũng cho phép thực hiện thêm một bước kiểm tra tính hợp lệ (sanity check)—chúng ta có thể xác minh xem ID tiến trình đó có tồn tại hay không bằng cách sử dụng `kill(pid, 0)`, như được mô tả trong Mục 20.5. (Trong các cài đặt UNIX cũ hơn không cung cấp cơ chế khóa tệp, cách này được sử dụng như một phương pháp không hoàn hảo nhưng thường khả thi để đánh giá xem một thể hiện của daemon thực sự vẫn đang chạy, hay một thể hiện trước đó đơn giản là đã quên xóa tệp trước khi kết thúc).

Có rất nhiều biến thể nhỏ trong mã nguồn được sử dụng để tạo và khóa một tệp PID. [Listing 55-4](#page-26-0) dựa trên các ý tưởng được trình bày trong [Stevens, 1999] và cung cấp một hàm `createPidFile()`, đóng gói các bước đã được mô tả ở trên. Chúng ta thường sẽ gọi hàm này với một dòng mã như sau:

```c
if (createPidFile("mydaemon", "/var/run/mydaemon.pid", 0) == -1)
 errExit("createPidFile");
```

Một điểm tinh tế trong hàm `createPidFile()` là việc sử dụng `ftruncate()` để xóa bất kỳ chuỗi ký tự cũ nào trong tệp khóa. Điều này được thực hiện vì thể hiện trước đó của daemon có thể đã không xóa được tệp, có lẽ do hệ thống bị sập (crash). Trong trường hợp này, nếu ID tiến trình của thể hiện daemon mới là một số nhỏ, nếu không làm sạch, chúng ta có thể không ghi đè hoàn toàn nội dung trước đó của tệp. Ví dụ, nếu ID tiến trình của chúng ta là `789`, thì chúng ta sẽ chỉ ghi `789\n` vào tệp, nhưng thể hiện daemon trước đó có thể đã ghi `12345\n`. Nếu chúng ta không cắt bớt (truncate) tệp, nội dung kết quả sẽ là `789\n5\n`. Việc xóa bất kỳ chuỗi hiện có nào có thể không hoàn toàn bắt buộc, nhưng nó gọn gàng hơn và loại bỏ mọi khả năng gây nhầm lẫn.

```

Tham số `flags` có thể chỉ định hằng số `CPF_CLOEXEC`, khiến cho hàm `createPidFile()` thiết lập cờ `close-on-exec` (Mục 27.4) cho File Descriptor (bộ mô tả tệp). Điều này hữu ích đối với các tiến trình máy chủ (server) tự khởi động lại bằng cách gọi `exec()`. Nếu File Descriptor không bị đóng trong quá trình thực thi `exec()`, thì tiến trình máy chủ sau khi khởi động lại sẽ lầm tưởng rằng một thể hiện (instance) trùng lặp của máy chủ đó đang chạy.

**Liệt kê 55-4:** Tạo một tệp khóa PID để đảm bảo chỉ có duy nhất một thể hiện của chương trình được khởi động

```

–––––––––––––––––––––––––––––––––––––––––––– filelock/create_pid_file.c

## include <sys/stat.h>

## include <fcntl.h>

## include "region_locking.h" /* For lockRegion() */

## include "create_pid_file.h" /* Declares createPidFile() and

defines CPF_CLOEXEC */

## include "tlpi_hdr.h"

## define BUF_SIZE 100 /* Large enough to hold maximum PID as string */

```

/\* Mở/tạo tệp có tên trong 'pidFile', khóa tệp đó, tùy chọn thiết lập cờ close-on-exec cho File Descriptor, ghi PID của chúng ta vào tệp, và (trong trường hợp bên gọi quan tâm) trả về File Descriptor trỏ đến tệp đã bị khóa. Bên gọi chịu trách nhiệm xóa tệp 'pidFile' (ngay) trước khi tiến trình kết thúc. 'progName' phải là tên của chương trình gọi (tức là argv[0] hoặc tương tự), và chỉ được sử dụng cho các thông báo chẩn đoán. Nếu chúng ta không thể mở 'pidFile', hoặc gặp lỗi nào khác, thì chúng ta in ra thông báo chẩn đoán thích hợp và kết thúc tiến trình. \*/

```

int
createPidFile(const char *progName, const char *pidFile, int flags)
{
int fd;
char buf[BUF_SIZE];
fd = open(pidFile, O_RDWR | O_CREAT, S_IRUSR | S_IWUSR);
if (fd == -1)
errExit("Could not open PID file %s", pidFile);
if (flags & CPF_CLOEXEC) {
/* Set the close-on-exec file descriptor flag */
flags = fcntl(fd, F_GETFD); /* Fetch flags */
if (flags == -1)
errExit("Could not get flags for PID file %s", pidFile);
flags |= FD_CLOEXEC; /* Turn on FD_CLOEXEC */
if (fcntl(fd, F_SETFD, flags) == -1) /* Update flags */
errExit("Could not set flags for PID file %s", pidFile);
}
if (lockRegion(fd, F_WRLCK, SEEK_SET, 0, 0) == -1) {
if (errno == EAGAIN || errno == EACCES)
fatal("PID file '%s' is locked; probably "
"'%s' is already running", pidFile, progName);
else
errExit("Unable to lock PID file '%s'", pidFile);
}
if (ftruncate(fd, 0) == -1)
errExit("Could not truncate PID file '%s'", pidFile);
snprintf(buf, BUF_SIZE, "%ld\n", (long) getpid());
if (write(fd, buf, strlen(buf)) != strlen(buf))
fatal("Writing to PID file '%s'", pidFile);
return fd;
}
–––––––––––––––––––––––––––––––––––––––––––– filelock/create_pid_file.c

```

## 55.7 Các Kỹ Thuật Khóa Cũ Hơn

Trong các cài đặt UNIX cũ thiếu cơ chế khóa tệp (file locking), một số kỹ thuật khóa đặc thù (ad hoc) đã được sử dụng. Mặc dù tất cả các kỹ thuật này đã bị thay thế bởi cơ chế khóa bản ghi `fcntl()` (record locking), chúng tôi vẫn mô tả chúng ở đây vì chúng vẫn xuất hiện trong một số chương trình cũ. Tất cả các kỹ thuật này đều mang tính chất khuyến nghị (advisory).

## open(file, O\_CREAT | O\_EXCL,...) kết hợp unlink(file)

SUSv3 yêu cầu một lời gọi hàm (system call) open() với các cờ (flags) O\_CREAT và O\_EXCL phải thực hiện các bước kiểm tra sự tồn tại của tệp và tạo tệp đó một cách nguyên tử (atomic) (Mục 5.1). Điều này có nghĩa là nếu hai tiến trình (process) cố gắng tạo một tệp cùng chỉ định các cờ này, thì được đảm bảo rằng chỉ có một tiến trình thành công. (Tiến trình còn lại sẽ nhận được lỗi EEXIST từ open().) Được sử dụng kết hợp với System Call unlink(), cơ chế này cung cấp nền tảng cho một cơ chế khóa (locking mechanism). Việc chiếm giữ khóa (acquiring the lock) được thực hiện bằng cách mở tệp thành công với các cờ O\_CREAT và O\_EXCL, tiếp theo là đóng tệp (close()) ngay lập tức. Việc giải phóng khóa (releasing the lock) được thực hiện bằng cách sử dụng unlink(). Mặc dù có thể hoạt động được, kỹ thuật này vẫn có một số hạn chế sau:

- Nếu open() thất bại, cho biết một tiến trình khác đang giữ khóa, thì chúng ta phải thử lại open() trong một vòng lặp nào đó, hoặc là thăm dò liên tục (polling continuously) (làm lãng phí thời gian CPU) hoặc có độ trễ giữa mỗi lần thử (có nghĩa là có thể có một khoảng trễ giữa thời điểm khóa khả dụng và thời điểm chúng ta thực sự chiếm được nó). Với fcntl(), chúng ta có thể sử dụng F\_SETLKW để chặn (block) cho đến khi khóa được giải phóng.
- Việc chiếm giữ và giải phóng khóa sử dụng open() và unlink() liên quan đến các thao tác hệ thống tệp (file-system operations) chậm hơn đáng kể so với việc sử dụng khóa bản ghi (record locks). (Trên một trong các hệ thống x86-32 của tác giả chạy Linux 2.6.31, việc chiếm giữ và giải phóng 1 triệu khóa trên một tệp ext3 sử dụng kỹ thuật được mô tả ở đây mất 44 giây. Việc chiếm giữ và giải phóng 1 triệu khóa bản ghi trên cùng một byte của một tệp chỉ mất 2.5 giây.)
- Nếu một tiến trình vô tình thoát (exit) mà không xóa tệp khóa, khóa sẽ không được giải phóng. Có các kỹ thuật đặc thù (ad hoc) để xử lý vấn đề này, bao gồm việc kiểm tra thời gian sửa đổi lần cuối của tệp và yêu cầu tiến trình giữ khóa ghi ID tiến trình (process ID) của nó vào tệp để chúng ta có thể kiểm tra xem tiến trình đó còn tồn tại hay không, nhưng không có kỹ thuật nào trong số này là hoàn hảo tuyệt đối. Ngược lại, khóa bản ghi sẽ được giải phóng tự động khi một tiến trình chấm dứt (terminate).
- Nếu chúng ta đặt nhiều khóa (tức là sử dụng nhiều tệp khóa), hiện tượng bế tắc (deadlock) sẽ không bị phát hiện. Nếu một vụ bế tắc phát sinh, các tiến trình liên quan đến vụ bế tắc sẽ tiếp tục bị chặn vô thời hạn. (Mỗi tiến trình sẽ chạy vòng lặp, kiểm tra xem nó có thể lấy được khóa mà nó yêu cầu hay không.) Ngược lại, kernel cung cấp tính năng phát hiện bế tắc cho các khóa bản ghi fcntl().
- NFS phiên bản 2 không hỗ trợ ngữ nghĩa (semantics) của O\_EXCL. Các máy khách (client) NFS trên Linux 2.4 cũng không triển khai O\_EXCLอย่าง chính xác, ngay cả đối với NFS phiên bản 3 trở lên.

## link(file, lockfile) kết hợp với unlink(lockfile)

Việc System Call `link()` thất bại nếu liên kết mới (new link) đã tồn tại cũng được tận dụng làm cơ chế khóa (locking mechanism), trong đó hàm `unlink()` lại tiếp cận được sử dụng để thực hiện chức năng mở khóa (unlock). Phương pháp thông thường là yêu cầu mỗi Process cần lấy khóa (acquire the lock) tạo ra một tên file tạm thời duy nhất, thường bao gồm ID của tiến trình (và có thể là tên hostname, nếu file khóa được tạo trên hệ thống file mạng - network file system). Để lấy khóa, file tạm thời này được liên kết (link) với một đường dẫn tiêu chuẩn đã thống nhất trước. (Ngữ nghĩa của hard link yêu cầu hai đường dẫn phải nằm trên cùng một File System). Nếu lời gọi `link()` thành công, chúng ta đã nhận được khóa. Nếu nó thất bại (trả về lỗi `EEXIST`), thì một Process khác đang nắm giữ khóa và chúng ta phải thử lại sau. Kỹ thuật này gặp phải các hạn chế tương tự như kỹ thuật `open(file, O_CREAT | O\_EXCL,...)` đã được mô tả ở trên.

### open(file, O_CREAT | O_TRUNC | O_WRONLY, 0) kết hợp với unlink(file)

Việc gọi `open()` trên một file đã tồn tại sẽ thất bại nếu cờ `O_TRUNC` được chỉ định và quyền ghi (write permission) trên file bị từ chối, điều này có thể được sử dụng làm nền tảng cho một kỹ thuật khóa. Để lấy khóa, chúng ta sử dụng đoạn mã sau (bỏ qua phần kiểm tra lỗi) để tạo một file mới:

```c

fd = open(file, O_CREAT | O_TRUNC | O_WRONLY, (mode_t) 0);
close(fd);

```

Để giải thích lý do tại sao chúng ta sử dụng phép ép kiểu `(mode_t)` trong lời gọi `open()` ở trên, hãy xem Phụ lục C.

Nếu lời gọi `open()` thành công (tức là file trước đó chưa tồn tại), chúng ta đã có khóa. Nếu nó thất bại với mã lỗi `EACCES` (tức là file tồn tại và không có bất kỳ quyền nào cho bất kỳ ai), thì một Process khác đang giữ khóa và chúng ta phải thử lại sau. Kỹ thuật này chịu những hạn chế tương tự như các kỹ thuật trước, với một cảnh báo bổ sung là chúng ta không thể áp dụng nó trong một chương trình có đặc quyền siêu người dùng (superuser privileges), vì lời gọi `open()` sẽ luôn thành công bất kể các quyền được thiết lập trên file đó là gì.

## 55.8 Tóm tắt

File Lock cho phép các Process đồng bộ hóa quyền truy cập vào một file. Linux cung cấp hai System Call khóa file: `flck()` bắt nguồn từ BSD và `fcntl()` bắt nguồn từ System V. Mặc dù cả hai System Call đều có sẵn trên hầu hết các cài đặt UNIX, chỉ có khóa `fcntl()` được chuẩn hóa trong SUSv3.

System Call `flock()` khóa toàn bộ một file. Hai loại khóa có thể được đặt: Shared Lock (khóa chia sẻ), tương thích với Shared Lock do các Process khác nắm giữ, và Exclusive Lock (khóa độc quyền), ngăn cản các Process khác đặt bất kỳ loại khóa nào.

System Call `fcntl()` đặt các khóa ("Record Lock") trên bất kỳ vùng nào của file, từ một byte đơn lẻ cho đến toàn bộ file. Hai loại khóa có thể được đặt: Read Lock (khóa đọc) và Write Lock (khóa ghi), có ngữ nghĩa tương thích tương tự như Shared Lock và Exclusive Lock được đặt thông qua `flock()`. Nếu một yêu cầu khóa dạng chặn (blocking - `F_SETLKW`) dẫn đến tình trạng Deadlock (tắc nghẽn), thì Kernel sẽ làm cho `fcntl()` thất bại (với lỗi `EDEADLK`) ở một trong các Process bị ảnh hưởng.

Các khóa được đặt bằng cách sử dụng `flock()` và `fcntl()` sẽ vô hình đối với nhau (ngoại trừ trên các hệ thống thực thi `flock()` bằng cách sử dụng `fcntl()`). Các khóa được đặt thông qua `flock()` và `fcntl()` có ngữ nghĩa khác nhau đối với sự kế thừa qua `fork()` và việc giải phóng khi File Descriptor bị đóng.

File `/proc/locks` đặc trưng của Linux hiển thị các khóa file hiện đang được nắm giữ bởi tất cả các Process trên hệ thống.

### Thông tin thêm

Một cuộc thảo luận chi tiết về khóa bản ghi (record locking) của `fcntl()` có thể được tìm thấy trong [Stevens & Rago, 2005] và [Stevens, 1999]. Một số chi tiết về việc cài đặt khóa `flock()` và `fcntl()` trên Linux được cung cấp trong [Bovet & Cesati, 2005]. [Tanenbaum, 2007] và [Deitel et al., 2004] mô tả các khái niệm về Deadlock nói chung, bao gồm việc phát hiện deadlock (deadlock detection), tránh deadlock (deadlock avoidance), và ngăn ngừa deadlock (deadlock prevention).

## 55.9 Bài tập

- **55-1.** Thực nghiệm bằng cách chạy nhiều tiến trình (process) của chương trình trong [Listing 55-1](#page-4-0) (`t_flock.c`) để xác định các điểm sau đây về hoạt động của `flock()`:
  - a) Liệu một chuỗi các tiến trình đang giữ khóa chia sẻ (shared lock) trên một tập tin có làm cho tiến trình đang cố gắng đặt khóa độc quyền (exclusive lock) trên tập tin đó bị bỏ đói (starve) hay không?
  - b) Giả sử một tập tin đang bị khóa độc quyền và các tiến trình khác đang chờ để đặt cả khóa chia sẻ lẫn khóa độc quyền trên tập tin đó. Khi khóa đầu tiên được giải phóng, có quy tắc nào quyết định tiến trình nào sẽ được cấp khóa tiếp theo không? Ví dụ, khóa chia sẻ có ưu tiên hơn khóa độc quyền hay ngược lại? Các khóa có được cấp theo thứ tự FIFO (Vào trước, ra trước) không?
  - c) Nếu bạn có quyền truy cập vào các hệ thống cài đặt UNIX khác có cung cấp `flock()`, hãy thử xác định các quy tắc trên hệ thống đó.
- **55-2.** Viết một chương trình để xác định xem `flock()` có phát hiện ra các tình trạng bế tắc (deadlock) khi được sử dụng để khóa hai tập tin khác nhau trong hai tiến trình hay không.
- **55-3.** Viết một chương trình để kiểm chứng các nhận định được nêu trong Mục [55.2.1](#page-5-0) liên quan đến ngữ nghĩa kế thừa và giải phóng các khóa của `flock()`.
- **55-4.** Thực nghiệm bằng cách chạy các chương trình trong [Listing 55-1](#page-4-0) (`t_flock.c`) và [Listing 55-2](#page-13-0) (`i_fcntl_locking.c`) để xem các khóa được cấp bởi `flock()` và `fcntl()` có ảnh hưởng gì lẫn nhau hay không. Nếu bạn có quyền truy cập vào các hệ thống cài đặt UNIX khác, hãy thử nghiệm tương tự trên các hệ thống đó.
- **55-5.** Trong Mục [55.3.4](#page-18-1), chúng ta đã lưu ý rằng trên Linux, thời gian cần thiết để thêm hoặc kiểm tra sự tồn tại của một khóa là một hàm số phụ thuộc vào vị trí của khóa trong danh sách tất cả các khóa trên tập tin. Viết hai chương trình để kiểm chứng điều này:
  - a) Chương trình thứ nhất nên lấy (giả sử) 40.001 khóa ghi (write lock) trên một tập tin. Các khóa này được đặt trên các byte cách quãng của tập tin; nghĩa là, các khóa được đặt trên các byte 0, 2, 4, 6, và cứ tiếp tục như vậy cho đến (giả sử) byte 80.000. Sau khi đã lấy được các khóa này, tiến trình sẽ đi vào trạng thái ngủ (sleep).
  - b) Trong khi chương trình thứ nhất đang ngủ, chương trình thứ hai lặp lại (giả sử) 10.000 lần, sử dụng `F_SETLK` để cố gắng khóa một trong các byte đã bị khóa bởi chương trình trước đó (các lần cố gắng khóa này sẽ luôn thất bại). Trong bất kỳ lần thực thi cụ thể nào, chương trình luôn cố gắng khóa byte `N * 2` của tập tin.

Sử dụng lệnh `time` tích hợp của shell, đo thời gian cần thiết cho chương trình thứ hai với `N` lần lượt bằng 0, 10.000, 20.000, 30.000 và 40.000. Kết quả có khớp với hành vi tuyến tính (linear behavior) dự kiến hay không?

**55-6.** Thực nghiệm với chương trình trong [Listing 55-2](#page-13-0) (`i_fcntl_locking.c`) để kiểm chứng các nhận định được đưa ra trong Mục [55.3.6](#page-20-1) về hiện tượng đói khóa (lock starvation) và độ ưu tiên đối với các khóa bản ghi (record lock) của `fcntl()`.

- **55-7.** Nếu bạn có quyền truy cập vào các hệ thống cài đặt UNIX khác, hãy sử dụng chương trình trong [Listing 55-2](#page-13-0) (`i_fcntl_locking.c`) để xem bạn có thể thiết lập bất kỳ quy tắc nào cho việc khóa bản ghi của `fcntl()` liên quan đến hiện tượng bỏ đói tiến trình ghi (writer starvation) và thứ tự cấp phát cho nhiều yêu cầu khóa đang xếp hàng đợi hay không.
- **55-8.** Sử dụng chương trình trong [Listing 55-2](#page-13-0) (`i_fcntl_locking.c`) để minh họa rằng kernel phát hiện ra các tình trạng bế tắc vòng tròn (circular deadlock) liên quan đến ba (hoặc nhiều hơn) tiến trình cùng khóa một tập tin.
- **55-9.** Viết một cặp chương trình (hoặc một chương trình đơn lẻ sử dụng tiến trình con - child process) để tạo ra tình trạng bế tắc với khóa bắt buộc (mandatory lock) được mô tả trong Mục [55.4](#page-20-0).
- **55-10.** Đọc trang hướng dẫn sử dụng (manual page) của tiện ích `lockfile(1)` được cung cấp kèm theo procmail. Viết một phiên bản đơn giản của chương trình này.
