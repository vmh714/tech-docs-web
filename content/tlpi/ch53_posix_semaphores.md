# Chương 53: Semaphore POSIX (POSIX Semaphores)

Chương này mô tả các semaphore POSIX (POSIX semaphores), cho phép các tiến trình (process) và luồng (thread) đồng bộ hóa quyền truy cập vào các tài nguyên dùng chung (shared resources). Trong Chương 47, chúng ta đã mô tả semaphore System V (System V semaphores), và chúng tôi giả định rằng bạn đọc đã quen thuộc với các khái niệm chung về semaphore cũng như lý do sử dụng semaphore được trình bày ở phần đầu của chương đó. Trong suốt chương này, chúng ta sẽ so sánh giữa semaphore POSIX và semaphore System V để làm rõ những điểm giống và khác nhau giữa hai API semaphore này.

## 53.1 Tổng quan

SUSv3 quy định hai loại semaphore POSIX:

- Semaphore có tên (Named semaphores): Loại semaphore này có một tên định danh. Bằng cách gọi `sem_open()` với cùng một tên, các tiến trình không có quan hệ họ hàng (unrelated processes) có thể truy cập vào cùng một semaphore.
- Semaphore không tên (Unnamed semaphores): Loại semaphore này không có tên; thay vào đó, nó nằm tại một vị trí đã thỏa thuận trước trong bộ nhớ (memory). Semaphore không tên có thể được chia sẻ giữa các tiến trình hoặc giữa một nhóm luồng. Khi được chia sẻ giữa các tiến trình, semaphore phải nằm trong một vùng bộ nhớ dùng chung (System V, POSIX, hoặc `mmap()`). Khi được chia sẻ giữa các luồng, semaphore có thể nằm trong một vùng nhớ được chia sẻ bởi các luồng đó (ví dụ: trên heap hoặc trong một biến toàn cục - global variable).

Semaphore POSIX hoạt động theo cách tương tự như semaphore System V; nghĩa là, một semaphore POSIX là một số nguyên (integer) có giá trị không được phép giảm xuống dưới 0. Nếu một tiến trình cố gắng giảm giá trị của semaphore xuống dưới 0, thì tùy thuộc vào hàm được sử dụng, lời gọi (call) sẽ hoặc là bị chặn (block) hoặc trả về lỗi cho biết thao tác hiện tại không khả thi.

Một số hệ thống không cung cấp bản cài đặt đầy đủ của semaphore POSIX. Một giới hạn điển hình là chỉ hỗ trợ semaphore không tên dùng chung cho luồng (thread-shared semaphores). Đó là tình trạng trên Linux 2.4; kể từ Linux 2.6 và glibc cung cấp NPTL, bản cài đặt đầy đủ của semaphore POSIX đã có sẵn.

> [!NOTE]
> Trên Linux 2.6 với NPTL, các thao tác semaphore (tăng và giảm) được thực hiện bằng cách sử dụng System Call `futex(2)`.

## 53.2 Semaphore có tên (Named Semaphores)

Để làm việc với một semaphore có tên, chúng ta sử dụng các hàm sau:

- Hàm `sem_open()` mở hoặc tạo một semaphore, khởi tạo semaphore nếu nó được tạo bởi lời gọi này, và trả về một định danh (handle) để sử dụng trong các lời gọi sau.
- Các hàm `sem_post(sem)` và `sem_wait(sem)` lần lượt tăng và giảm giá trị của semaphore.
- Hàm `sem_getvalue()` lấy giá trị hiện tại của semaphore.
- Hàm `sem_close()` hủy liên kết của tiến trình gọi với một semaphore mà nó đã mở trước đó.
- Hàm `sem_unlink()` xóa tên của semaphore và đánh dấu semaphore để xóa khi tất cả các tiến trình đã đóng nó.

SUSv3 không quy định cách thức cài đặt semaphore có tên. Một số hệ thống UNIX tạo ra chúng như các tệp (file) tại một vị trí đặc biệt trong hệ thống tệp chuẩn (standard file system). Trên Linux, chúng được tạo dưới dạng các đối tượng bộ nhớ dùng chung POSIX nhỏ có tên theo định dạng `sem.name`, nằm trong một hệ thống tệp tmpfs chuyên dụng (Mục 14.10) được gắn kết (mount) dưới thư mục `/dev/shm`. Hệ thống tệp này có tính bền vững trong kernel (kernel persistence) — các đối tượng semaphore chứa trong đó sẽ vẫn tồn tại ngay cả khi không có tiến trình nào đang mở chúng, nhưng sẽ bị mất nếu hệ thống tắt nguồn (shutdown).

Semaphore có tên được hỗ trợ trên Linux kể từ kernel phiên bản 2.6.

### 53.2.1 Mở một Semaphore có tên (Named Semaphore)

Hàm `sem_open()` tạo và mở một semaphore có tên mới hoặc mở một semaphore đã tồn tại.

## include <fcntl.h> /* Định nghĩa các hằng số O_* */

## include <sys/stat.h> /* Định nghĩa các hằng số chế độ (mode) */

## include <semaphore.h>

sem_t *sem_open(const char *name, int oflag, ...
/* mode_t mode, unsigned int value */ );
Trả về con trỏ đến semaphore khi thành công, hoặc SEM_FAILED khi lỗi

```

Đối số `name` xác định semaphore. Nó được chỉ định theo các quy tắc được nêu tại Mục [51.1.](#page-1-0)

Đối số `oflag` là một mặt nạ bit (bit mask) quyết định việc chúng ta đang mở một semaphore đã tồn tại hay tạo và mở một semaphore mới. Nếu `oflag` bằng 0, chúng ta đang truy cập một semaphore đã có sẵn. Nếu `O_CREAT` được chỉ định trong `oflag`, một semaphore mới sẽ được tạo nếu chưa có semaphore nào mang tên được cho tồn tại. Nếu `oflag` chỉ định cả `O_CREAT` và `O_EXCL`, và một semaphore mang tên đã cho đã tồn tại từ trước, thì `sem_open()` sẽ thất bại.

Nếu `sem_open()` được sử dụng để mở một semaphore đã tồn tại, lời gọi hàm chỉ cần hai đối số. Tuy nhiên, nếu `O_CREAT` được chỉ định trong cờ (flags), thì cần thêm hai đối số nữa: `mode` và `value`. (Nếu semaphore do `name` chỉ định đã tồn tại, hai đối số này sẽ bị bỏ qua.) Các đối số này như sau:

- Đối số `mode` là một mặt nạ bit (bit mask) xác định các quyền được gán cho semaphore mới. Các giá trị bit giống như đối với tệp (Bảng 15-4, trang 295), và giống như hàm `open()`, giá trị trong `mode` sẽ được lọc qua umask của tiến trình (Process) (Mục 15.4.6). SUSv3 không chỉ định bất kỳ cờ chế độ truy cập nào (`O_RDONLY`, `O_WRONLY` và `O_RDWR`) cho `oflag`. Nhiều hệ thống thực thi, bao gồm cả Linux, mặc định chế độ truy cập là `O_RDWR` khi mở một semaphore, vì hầu hết các ứng dụng sử dụng semaphore đều phải dùng cả `sem_post()` và `sem_wait()`, liên quan đến việc đọc và sửa đổi giá trị của semaphore. Điều này có nghĩa là chúng ta nên đảm bảo cấp quyền cả đọc và viết cho từng phân loại người dùng — chủ sở hữu (owner), nhóm (group) và người dùng khác (other) — những đối tượng cần truy cập semaphore.
- Đối số `value` là một số nguyên không dấu (unsigned integer) xác định giá trị khởi tạo sẽ gán cho semaphore mới. Quá trình tạo và khởi tạo semaphore được thực hiện một cách nguyên tử (atomically). Điều này giúp tránh được sự phức tạp vốn đòi hỏi khi khởi tạo semaphore System V (Mục 47.5).

Bất kể chúng ta đang tạo semaphore mới hay mở semaphore đã tồn tại, `sem_open()` đều trả về một con trỏ trỏ đến giá trị kiểu `sem_t`, và chúng ta sử dụng con trỏ này trong các lời gọi hàm tiếp theo để thao tác với semaphore đó. Khi gặp lỗi, `sem_open()` trả về giá trị `SEM_FAILED`. (Trên hầu hết các hệ thống thực thi, `SEM_FAILED` được định nghĩa là `((sem_t *) 0)` hoặc `((sem_t *) –1)`; Linux định nghĩa nó là trường hợp đầu tiên.)

SUSv3 nêu rõ rằng kết quả sẽ không xác định nếu chúng ta cố gắng thực hiện các thao tác (`sem_post()`, `sem_wait()`, v.v.) trên một bản sao của biến `sem_t` mà con trỏ trả về từ hàm `sem_open()` hướng tới. Nói cách khác, việc sử dụng `sem2` dưới đây là không hợp lệ:

```

sem_t *sp, sem2
sp = sem_open(...);
sem2 = *sp;
sem_wait(&sem2);

```

Khi một tiến trình con (Child Process) được tạo ra thông qua hàm `fork()`, nó sẽ kế thừa các tham chiếu đến tất cả các semaphore có tên đang mở ở tiến trình cha (Parent Process). Sau hàm `fork()`, tiến trình cha và con có thể sử dụng các semaphore này để đồng bộ hóa các hành động của chúng.

### Chương trình ví dụ

Chương trình trong [Liệt kê 53-1](#page-35-0) cung cấp một giao diện dòng lệnh đơn giản cho hàm `sem_open()`. Định dạng lệnh cho chương trình này được thể hiện trong hàm `usageError()`.

Nhật ký phiên làm việc trên shell sau đây minh họa cách sử dụng chương trình này. Đầu tiên, chúng ta sử dụng lệnh `umask` để tước bỏ mọi quyền của nhóm người dùng `other`. Sau đó, chúng ta tạo độc quyền một semaphore và kiểm tra nội dung của thư mục ảo đặc trưng của Linux chứa các semaphore có tên.

```

$ umask 007
$ ./psem_create -cx /demo 666 666 có nghĩa là đọc+viết cho tất cả người dùng
$ ls -l /dev/shm/sem.*
-rw-rw---- 1 mtk users 16 Jul 6 12:09 /dev/shm/sem.demo

```

Kết quả đầu ra của lệnh `ls` cho thấy umask của tiến trình đã ghi đè lên các quyền đọc và viết đã chỉ định đối với nhóm người dùng `other`.

Nếu chúng ta thử tạo độc quyền một lần nữa với cùng một tên semaphore, thao tác sẽ thất bại vì tên này đã tồn tại.

```

$ ./psem_create -cx /demo 666
ERROR [EEXIST File exists] sem_open Thất bại do O_EXCL

```

**Liệt kê 53-1:** Sử dụng `sem_open()` để mở hoặc tạo một POSIX named semaphore

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_create.c

## include <semaphore.h>

## include <sys/stat.h>

## include <fcntl.h>

## include "tlpi_hdr.h"

static void
usageError(const char *progName)
{
fprintf(stderr, "Cách dùng: %s [-cx] name [octal-perms [value]]\n", progName);
fprintf(stderr, " -c Tạo semaphore (O_CREAT)\n");
fprintf(stderr, " -x Tạo độc quyền (O_EXCL)\n");
exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
int flags, opt;
mode_t perms;
unsigned int value;
sem_t *sem;
flags = 0;
while ((opt = getopt(argc, argv, "cx")) != -1) {
switch (opt) {
case 'c': flags |= O_CREAT; break;
case 'x': flags |= O_EXCL; break;
default: usageError(argv[0]);
}
}

```

```c

if (optind >= argc)
usageError(argv[0]);
/* Default permissions are rw-------; default semaphore initialization
value is 0 */
perms = (argc <= optind + 1) ? (S_IRUSR | S_IWUSR) :
getInt(argv[optind + 1], GN_BASE_8, "octal-perms");
value = (argc <= optind + 2) ? 0 : getInt(argv[optind + 2], 0, "value");
sem = sem_open(argv[optind], flags, perms, value);
if (sem == SEM_FAILED)
errExit("sem_open");
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_create.c

```

### 53.2.2 Đóng một Semaphore (Closing a Semaphore)

Khi một Process ( tiến trình) mở một named semaphore (semaphore có tên), hệ thống sẽ ghi lại mối liên kết giữa tiến trình đó và semaphore. Hàm `sem_close()` chấm dứt mối liên kết này (tức là đóng semaphore), giải phóng bất kỳ tài nguyên nào mà hệ thống đã liên kết với semaphore cho tiến trình này, đồng thời giảm số lượng tiến trình đang tham chiếu đến semaphore đó.

## include <semaphore.h>
int sem_close(sem_t *sem);
                                             Thành công trả về 0, lỗi trả về –1
```

Các named semaphore đang mở cũng sẽ tự động được đóng khi tiến trình kết thúc (Process Termination) hoặc nếu tiến trình thực thi hàm `exec()`.

Việc đóng semaphore không đồng nghĩa với việc xóa nó. Để thực hiện việc đó, chúng ta cần sử dụng hàm `sem_unlink()`.

### 53.2.3 Xóa một Named Semaphore (Removing a Named Semaphore)

Hàm `sem_unlink()` xóa semaphore được xác định bởi `name` và đánh dấu semaphore đó để tiêu hủy ngay khi tất cả các tiến trình ngừng sử dụng nó (điều này có thể xảy ra ngay lập tức, nếu tất cả các tiến trình đã mở semaphore trước đó đã đóng nó lại).

## include <semaphore.h>

int sem_unlink(const char *name);
Thành công trả về 0, lỗi trả về –1

```

[Liệt kê 53-2](#page-37-0) minh họa cách sử dụng hàm `sem_unlink()`.

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_unlink.c

## include <semaphore.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
if (argc != 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s sem-name\n", argv[0]);
if (sem_unlink(argv[1]) == -1)
errExit("sem_unlink");
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_unlink.c

```

## 53.3 Các thao tác trên Semaphore (Semaphore Operations)

Giống như System V semaphore, POSIX semaphore là một số nguyên mà hệ thống không bao giờ cho phép giảm xuống dưới 0. Tuy nhiên, các thao tác trên POSIX semaphore khác với các semaphore tương đương trong System V ở các điểm sau:

- Các hàm dùng để thay đổi giá trị của semaphore—`sem_post()` và `sem_wait()`—chỉ thao tác trên một semaphore tại một thời điểm. Ngược lại, System Call (lời gọi hệ thống) `semop()` của System V có thể thao tác trên nhiều semaphore trong một tập hợp (set).
- Các hàm `sem_post()` và `sem_wait()` tăng và giảm giá trị của semaphore đúng một đơn vị. Ngược lại, `semop()` có thể cộng và trừ các giá trị tùy ý.
- Không có thao tác nào tương đương với thao tác chờ đến giá trị không (wait-for-zero) do System V semaphore cung cấp (một lời gọi `semop()` trong đó trường `sops.sem_op` được chỉ định là 0).

Từ danh sách này, có vẻ như POSIX semaphore ít mạnh mẽ hơn System V semaphore. Tuy nhiên, thực tế không phải vậy—bất cứ điều gì chúng ta có thể làm với System V semaphore thì cũng có thể làm được với POSIX semaphore. Trong một số ít trường hợp, có thể cần thêm một chút nỗ lực lập trình, nhưng đối với các kịch bản thông thường, việc sử dụng POSIX semaphore thực tế đòi hỏi ít công sức lập trình hơn. (Giao diện lập trình ứng dụng - API của System V semaphore phức tạp hơn mức cần thiết đối với hầu hết các ứng dụng).

```

### 53.3.1 Đợi Semaphore

Hàm `sem_wait()` thực hiện giảm (giảm đi 1) giá trị của semaphore được trỏ tới bởi `sem`.

```

## include <semaphore.h>

int sem_wait(sem_t *sem);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Nếu semaphore hiện tại có giá trị lớn hơn 0, `sem_wait()` sẽ trả về ngay lập tức. Nếu giá trị của semaphore hiện bằng 0, `sem_wait()` sẽ bị chặn (block) cho đến khi giá trị của semaphore tăng lên trên 0; lúc đó, giá trị semaphore sẽ được giảm xuống và `sem_wait()` trả về.

Nếu một lời gọi `sem_wait()` đang bị chặn bị ngắt bởi một trình xử lý tín hiệu (signal handler), thì nó sẽ thất bại với mã lỗi `EINTR`, bất kể cờ `SA_RESTART` có được sử dụng hay không khi thiết lập trình xử lý tín hiệu bằng `sigaction()`. (Trên một số hệ thống UNIX khác, `SA_RESTART` thực sự khiến `sem_wait()` tự động khởi động lại).

Chương trình trong [Liệt kê 53-3](#page-38-0) cung cấp một giao diện dòng lệnh (command-line interface) cho hàm `sem_wait()`. Chúng ta sẽ minh họa việc sử dụng chương trình này ngay sau đây.

**Liệt kê 53-3:** Sử dụng `sem_wait()` để giảm giá trị của một POSIX semaphore

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_wait.c

## include <semaphore.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
sem_t *sem;
if (argc < 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s sem-name\n", argv[0]);
sem = sem_open(argv[1], 0);
if (sem == SEM_FAILED)
errExit("sem_open");
if (sem_wait(sem) == -1)
errExit("sem_wait");
printf("%ld sem_wait() succeeded\n", (long) getpid());
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_wait.c

```

Hàm `sem_trywait()` là phiên bản không chặn (nonblocking) của `sem_wait()`.

```

## include <semaphore.h>

int sem_trywait(sem_t *sem);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Nếu thao tác giảm giá trị không thể được thực hiện ngay lập tức, `sem_trywait()` sẽ thất bại với mã lỗi `EAGAIN`.

Hàm `sem_timedwait()` là một biến thể khác của `sem_wait()`. Nó cho phép tiến trình gọi (caller) chỉ định giới hạn thời gian mà lời gọi sẽ bị chặn.

```

## define _XOPEN_SOURCE 600

## include <semaphore.h>

int sem_timedwait(sem_t *sem, const struct timespec *abs_timeout);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Nếu một lời gọi `sem_timedwait()` bị quá thời gian (timeout) mà không thể giảm được giá trị của semaphore, thì lời gọi đó sẽ thất bại với mã lỗi `ETIMEDOUT`.

Tham số `abs_timeout` là một cấu trúc `timespec` (Mục 23.4.2) chỉ định thời gian chờ dưới dạng giá trị tuyệt đối tính bằng giây và nanosecond kể từ mốc thời gian gốc (Epoch). Nếu chúng ta muốn thực hiện thời gian chờ tương đối (relative timeout), chúng ta phải lấy giá trị hiện tại của đồng hồ `CLOCK_REALTIME` bằng cách sử dụng `clock_gettime()` và cộng thêm khoảng thời gian cần thiết vào giá trị đó để tạo ra một cấu trúc `timespec` phù hợp để sử dụng với `sem_timedwait()`.

Hàm `sem_timedwait()` ban đầu được quy định trong POSIX.1d (1999) và không có sẵn trên tất cả các hệ thống UNIX.

### 53.3.2 Tăng giá trị Semaphore (Posting a Semaphore)

Hàm `sem_post()` thực hiện tăng (tăng thêm 1) giá trị của semaphore được tham chiếu bởi `sem`.

```c

## include <semaphore.h>

int sem_post(sem_t *sem);
Trả về 0 nếu thành công, hoặc –1 nếu có lỗi

```

Nếu giá trị của semaphore bằng 0 trước khi gọi `sem_post()`, và một process (hoặc thread) khác đang bị chặn (blocked) chờ để giảm giá trị semaphore, thì process đó sẽ được đánh thức (awoken), và lời gọi `sem_wait()` của nó sẽ tiếp tục thực hiện việc giảm giá trị semaphore. Nếu có nhiều process (hoặc thread) đang bị chặn trong `sem_wait()`, thì nếu các process này được lên lịch (scheduled) theo chính sách chia sẻ thời gian vòng tròn (round-robin time-sharing policy) mặc định, việc xác định process nào được đánh thức và cho phép giảm giá trị semaphore là không xác định (indeterminate). (Giống như các semaphore tương đương trong System V, POSIX semaphore chỉ là một cơ chế đồng bộ hóa (synchronization mechanism), không phải là cơ chế hàng đợi - queuing mechanism).

> [!NOTE]
> SUSv3 quy định rằng nếu các process hoặc thread đang được thực thi theo chính sách lập lịch thời gian thực (realtime scheduling policy), thì process hoặc thread sẽ được đánh thức là tiến trình có ưu tiên cao nhất và đã chờ đợi lâu nhất.

Cũng giống như System V semaphore, việc tăng giá trị một POSIX semaphore tương ứng với việc giải phóng một tài nguyên chia sẻ (shared resource) nào đó để process hoặc thread khác sử dụng.

Chương trình trong [Listing 53-4](#page-40-0) cung cấp một giao diện dòng lệnh (command-line interface) cho hàm `sem_post()`. Chúng ta sẽ minh họa việc sử dụng chương trình này ngay sau đây.

```c

––––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_post.c

## include <semaphore.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
sem_t *sem;

if (argc != 2)
usageErr("%s sem-name\n", argv[0]);

sem = sem_open(argv[1], 0);
if (sem == SEM_FAILED)
errExit("sem_open");

if (sem_post(sem) == -1)
errExit("sem_post");

exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_post.c

```

### 53.3.3 Truy vấn giá trị hiện tại của Semaphore

Hàm `sem_getvalue()` trả về giá trị hiện tại của semaphore được tham chiếu bởi `sem` thông qua biến `int` trỏ bởi `sval`.

```

## include <semaphore.h>

int sem_getvalue(sem_t *sem, int *sval);
Trả về 0 nếu thành công, hoặc –1 nếu có lỗi

```

Nếu một hoặc nhiều process (hoặc thread) hiện đang bị chặn chờ để giảm giá trị của semaphore, thì giá trị được trả về trong `sval` sẽ tùy thuộc vào từng cài đặt (implementation). SUSv3 cho phép hai khả năng: 0 hoặc một số âm mà giá trị tuyệt đối của nó chính là số lượng các tiến trình đang chờ bị chặn trong `sem_wait()`. Linux và một số cài đặt khác áp dụng hành vi đầu tiên; một số ít cài đặt khác áp dụng hành vi thứ hai.

> [!NOTE]
> Mặc dù việc trả về một giá trị `sval` âm khi có các tiến trình đang chờ bị chặn có thể hữu ích, đặc biệt cho các mục đích gỡ lỗi (debugging), SUSv3 không bắt buộc hành vi này vì các kỹ thuật mà một số hệ thống sử dụng để cài đặt hiệu quả các POSIX semaphore không (trên thực tế là không thể) ghi lại số lượng các process đang chờ bị chặn.

Lưu ý rằng vào thời điểm `sem_getvalue()` trả về, giá trị được trả về trong `sval` có thể đã lỗi thời. Một chương trình phụ thuộc vào thông tin do `sem_getvalue()` trả về mà không thay đổi vào thời điểm của một thao tác tiếp theo sẽ dễ gặp phải các điều kiện tranh chấp dạng kiểm tra thời điểm – sử dụng thời điểm (time-of-check, time-of-use race conditions) (Mục 38.6).

Chương trình trong [Listing 53-5](#page-41-0) sử dụng `sem_getvalue()` để truy vấn giá trị của semaphore có tên được truyền qua đối số dòng lệnh, và sau đó hiển thị giá trị đó ra đầu ra chuẩn (standard output).

**Listing 53-5:** Sử dụng `sem_getvalue()` để truy vấn giá trị của một POSIX semaphore

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_getvalue.c

## include <semaphore.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
int value;
sem_t *sem;
if (argc != 2)
usageErr("%s sem-name\n", argv[0]);
sem = sem_open(argv[1], 0);
if (sem == SEM_FAILED)
errExit("sem_open");
if (sem_getvalue(sem, &value) == -1)
errExit("sem_getvalue");
printf("%d\n", value);
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– psem/psem_getvalue.c

```

### Ví dụ

Nhật ký phiên dòng lệnh (shell session log) sau đây minh họa việc sử dụng các chương trình mà chúng ta đã tìm hiểu từ đầu chương này. Chúng ta bắt đầu bằng cách tạo một semaphore có giá trị ban đầu là không, và sau đó khởi chạy một chương trình ở chế độ nền (background) cố gắng giảm giá trị của semaphore đó:

```

$ ./psem_create -c /demo 600 0
$ ./psem_wait /demo &
[1] 31208

```

Lệnh chạy ở nền bị chặn, bởi vì giá trị của semaphore hiện tại là 0 và do đó không thể giảm thêm được nữa.

Sau đó, chúng ta truy vấn giá trị của semaphore:

```

$ ./psem_getvalue /demo
0

```

Chúng ta thấy giá trị trả về là 0 ở trên. Trên một số cài đặt khác, chúng ta có thể thấy giá trị –1, cho biết có một process đang chờ semaphore.

Tiếp theo, chúng ta thực hiện một lệnh làm tăng giá trị semaphore. Điều này khiến cho hàm `sem_wait()` đang bị chặn trong chương trình nền được hoàn tất:

```

$ ./psem_post /demo
$ 31208 sem_wait() succeeded

```

(Dòng đầu tiên của kết quả ở trên hiển thị dấu nhắc shell hòa lẫn với đầu ra của tiến trình nền - background job).

Chúng ta nhấn phán Enter để xem dấu nhắc shell tiếp theo, hành động này cũng khiến shell thông báo về tiến trình nền đã kết thúc, và sau đó thực hiện các thao tác tiếp theo trên semaphore:

```

Press Enter
[1]- Done ./psem_wait /demo
$ ./psem_post /demo Increment semaphore
$ ./psem_getvalue /demo Retrieve semaphore value
1
$ ./psem_unlink /demo We're done with this semaphore

```

## 53.4 Unnamed Semaphores (Semaphore vô danh)

Semaphore vô danh (còn được gọi là semaphore dựa trên bộ nhớ - memory-based semaphore) là các biến kiểu `sem_t` được lưu trữ trong vùng nhớ do ứng dụng cấp phát. Semaphore này được làm cho khả dụng đối với các Process (tiến trình) hoặc Thread (luồng) sử dụng nó bằng cách đặt nó vào một vùng nhớ mà chúng chia sẻ (shared memory).

Các thao tác trên semaphore vô danh sử dụng các hàm tương tự (`sem_wait()`, `sem_post()`, `sem_getvalue()`, v.v.) được sử dụng cho semaphore có tên (named semaphore). Ngoài ra, cần có thêm hai hàm nữa:

- Hàm `sem_init()` khởi tạo một semaphore và thông báo cho hệ thống biết liệu semaphore đó sẽ được chia sẻ giữa các tiến trình hay giữa các luồng của một tiến trình đơn lẻ.
- Hàm `sem_destroy(sem)` hủy một semaphore.

Các hàm này không nên được sử dụng với semaphore có tên.

### So sánh semaphore vô danh và semaphore có tên

Sử dụng semaphore vô danh giúp chúng ta tránh được công sức tạo tên cho semaphore. Điều này có thể hữu ích trong các trường hợp sau:

- Một semaphore được chia sẻ giữa các luồng không cần tên. Việc biến một semaphore vô danh thành một biến chia sẻ (biến toàn cục - global hoặc trên vùng nhớ heap) sẽ tự động làm cho nó có thể truy cập được đối với tất cả các luồng.
- Một semaphore được chia sẻ giữa các tiến trình có liên quan (related processes) không cần tên. Nếu một tiến trình cha (parent process) cấp phát một semaphore vô danh trong một vùng nhớ chia sẻ (ví dụ: một ánh xạ ẩn danh chia sẻ - shared anonymous mapping), thì tiến trình con (child process) sẽ tự động kế thừa ánh xạ đó và do đó kế thừa luôn semaphore như một phần của hoạt động hàm `fork()`.

Nếu chúng ta đang xây dựng một cấu trúc dữ liệu động (ví dụ: cây nhị phân - binary tree), trong đó mỗi mục (item) yêu cầu một semaphore liên kết, thì phương pháp đơn giản nhất là cấp phát một semaphore vô danh bên trong mỗi mục. Việc mở một semaphore có tên cho mỗi mục sẽ đòi hỏi chúng ta phải thiết kế một quy ước để tạo tên semaphore (duy nhất) cho từng mục và quản lý các tên đó (ví dụ: hủy liên kết - unlink chúng khi không còn cần thiết).

### 53.4.1 Khởi tạo một Semaphore Vô danh

Hàm `sem_init()` khởi tạo semaphore vô danh được trỏ bởi `sem` với giá trị được chỉ định bởi `value`.

```

## include <semaphore.h>

int sem_init(sem_t *sem, int pshared, unsigned int value);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Đối số `pshared` cho biết semaphore sẽ được chia sẻ giữa các luồng hay giữa các tiến trình.

- Nếu `pshared` bằng 0, thì semaphore sẽ được chia sẻ giữa các luồng của tiến trình gọi hàm. Trong trường hợp này, `sem` thường được chỉ định là địa chỉ của một biến toàn cục hoặc một biến được cấp phát trên heap. Semaphore được chia sẻ theo luồng có tính bền vững theo tiến trình (process persistence); nó bị hủy khi tiến trình kết thúc.
- Nếu `pshared` khác 0, thì semaphore sẽ được chia sẻ giữa các tiến trình. Trong trường hợp này, `sem` phải là địa chỉ của một vị trí trong vùng nhớ chia sẻ (một đối tượng bộ nhớ chia sẻ POSIX - POSIX shared memory object, một ánh xạ chia sẻ được tạo bằng `mmap()`, hoặc một phân đoạn bộ nhớ chia sẻ System V - System V shared memory segment). Semaphore tồn tại chừng nào vùng nhớ chia sẻ mà nó cư trú còn tồn tại. (Các vùng nhớ chia sẻ được tạo bởi hầu hết các kỹ thuật này có tính bền vững trong Kernel Space - kernel persistence. Ngoại lệ là các ánh xạ ẩn danh được chia sẻ, chỉ tồn tại chừng nào ít nhất một tiến trình vẫn duy trì ánh xạ đó). Vì tiến trình con được tạo ra thông qua `fork()` kế thừa các ánh xạ bộ nhớ của tiến trình cha, nên các semaphore chia sẻ theo tiến trình được kế thừa bởi tiến trình con của hàm `fork()`, và tiến trình cha - con có thể sử dụng các semaphore này để đồng bộ hóa các hoạt động của chúng.

Đối số `pshared` là cần thiết vì những lý do sau:

- Một số hệ thống không hỗ trợ semaphore chia sẻ theo tiến trình. Trên các hệ thống này, việc chỉ định một giá trị khác 0 cho `pshared` khiến `sem_init()` trả về lỗi. Linux không hỗ trợ semaphore chia sẻ theo tiến trình dạng vô danh cho đến tận kernel 2.6 và sự ra đời của cơ chế thực thi luồng NPTL. (Phiên bản LinuxThreads cũ hơn của hàm `sem_init()` thất bại với lỗi `ENOSYS` nếu một giá trị khác 0 được chỉ định cho `pshared`).
- Trên các hệ thống hỗ trợ cả semaphore chia sẻ theo tiến trình và chia sẻ theo luồng, việc chỉ định loại chia sẻ nào là cần thiết vì hệ thống phải thực hiện các thao tác đặc biệt để hỗ trợ kiểu chia sẻ được yêu cầu. Việc cung cấp thông tin này cũng có thể cho phép hệ thống thực hiện các tối ưu hóa tùy thuộc vào loại chia sẻ.

Triển khai `sem_init()` của NPTL bỏ qua `pshared`, vì không có thao tác đặc biệt nào được yêu cầu cho cả hai loại chia sẻ. Tuy nhiên, các ứng dụng có tính di động (portable) và hướng tới tương lai vẫn nên chỉ định một giá trị thích hợp cho `pshared`.

```

> Đặc tả SUSv3 cho hàm `sem_init()` định nghĩa giá trị trả về khi thất bại là –1, nhưng không đưa ra tuyên bố nào về giá trị trả về khi thành công. Tuy nhiên, các trang manual page trên hầu hết các cài đặt UNIX hiện đại đều tài liệu hóa giá trị trả về là 0 khi thành công. (Một ngoại lệ đáng chú ý là Solaris, nơi mô tả về giá trị trả về tương tự như đặc tả của SUSv3. Tuy nhiên, việc kiểm tra mã nguồn OpenSolaris cho thấy rằng, trên hệ thống đó, `sem_init()` thực sự trả về 0 khi thành công). SUSv4 đã chỉnh sửa lại vấn đề này, quy định rõ ràng rằng `sem_init()` phải trả về 0 khi thành công.

Không có thiết lập quyền hạn (permission settings) nào gắn liền với semaphore vô danh (unnamed semaphore) (nghĩa là `sem_init()` không có tham số tương đương với đối số `mode` của hàm `sem_open()`). Quyền truy cập vào một semaphore vô danh được chi phối bởi các quyền hạn được cấp cho tiến trình (process) đối với vùng nhớ chia sẻ (shared memory region) bên dưới.

SUSv3 quy định rằng việc khởi tạo một semaphore vô danh đã được khởi tạo trước đó sẽ dẫn đến hành vi không xác định (undefined behavior). Nói cách khác, chúng ta phải thiết kế các ứng dụng của mình sao cho chỉ có một tiến trình (process) hoặc luồng (thread) gọi hàm `sem_init()` để khởi tạo semaphore.

Giống như semaphore có tên (named semaphore), SUSv3 cho biết kết quả sẽ không xác định nếu chúng ta cố gắng thực hiện các thao tác trên một bản sao của biến `sem_t` mà địa chỉ của nó được truyền làm đối số `sem` của hàm `sem_init()`. Các thao tác luôn chỉ nên được thực hiện trên semaphore "gốc" (original).

### Chương trình ví dụ

Trong Mục 30.1.2, chúng ta đã trình bày một chương trình (Liệt kê 30-2) sử dụng các mutex để bảo vệ một vùng găng (critical section), trong đó hai luồng (thread) truy cập vào cùng một biến toàn cục (global variable). Chương trình trong [Liệt kê 53-6](#page-44-0) giải quyết cùng một vấn đề nhưng sử dụng semaphore vô danh chia sẻ giữa các luồng (thread-shared unnamed semaphore).

**Liệt kê 53-6:** Sử dụng POSIX semaphore vô danh để bảo vệ quyền truy cập vào một biến toàn cục

```c

––––––––––––––––––––––––––––––––––––––––––––––––––– psem/thread_incr_psem.c

## include <semaphore.h>

## include <pthread.h>

## include "tlpi_hdr.h"

static int glob = 0;
static sem_t sem;

static void *
threadFunc(void *arg) /* Lặp 'arg' lần để tăng giá trị của 'glob' */
{
int loops = *((int *) arg);
int loc, j;

for (j = 0; j < loops; j++) {
if (sem_wait(&sem) == -1)
errExit("sem_wait");

loc = glob;
loc++;
glob = loc;

if (sem_post(&sem) == -1)
errExit("sem_post");
}

return NULL;
}

int
main(int argc, char *argv[])
{
pthread_t t1, t2;
int loops, s;

loops = (argc > 1) ? getInt(argv[1], GN_GT_0, "num-loops") : 10000000;

/* Khởi tạo một semaphore chia sẻ giữa các luồng với giá trị ban đầu là 1 */
if (sem_init(&sem, 0, 1) == -1)
errExit("sem_init");

/* Tạo hai luồng để cùng tăng biến 'glob' */
s = pthread_create(&t1, NULL, threadFunc, &loops);
if (s != 0)
errExitEN(s, "pthread_create");
s = pthread_create(&t2, NULL, threadFunc, &loops);
if (s != 0)
errExitEN(s, "pthread_create");

/* Chờ các luồng kết thúc */
s = pthread_join(t1, NULL);
if (s != 0)
errExitEN(s, "pthread_join");
s = pthread_join(t2, NULL);
if (s != 0)
errExitEN(s, "pthread_join");

printf("glob = %d\n", glob);
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––– psem/thread_incr_psem.c

```

### 53.4.2 Hủy một Semaphore Không Tên (Unnamed Semaphore)

Hàm `sem_destroy()` dùng để hủy semaphore `sem`. Đây bắt buộc phải là một semaphore không tên đã được khởi tạo trước đó bằng hàm `sem_init()`. Việc hủy một semaphore chỉ an toàn khi không có tiến trình (process) hay luồng (thread) nào đang chờ trên semaphore đó.

## include <semaphore.h>
int sem_destroy(sem_t *sem);
                                             Trả về 0 khi thành công, hoặc –1 nếu lỗi
```

Sau khi một phân đoạn semaphore không tên đã bị hủy bằng `sem_destroy()`, nó có thể được khởi tạo lại bằng `sem_init()`.

Một semaphore không tên nên được hủy trước khi vùng nhớ cơ sở (underlying memory) của nó bị giải phóng (deallocate). Ví dụ, nếu semaphore là một biến được cấp phát tự động (automatically allocated variable), nó nên được hủy trước khi hàm chứa nó trả về. Nếu semaphore nằm trong một vùng bộ nhớ chia sẻ POSIX (POSIX shared memory region), thì nó nên được hủy sau khi tất cả các tiến trình đã ngừng sử dụng semaphore đó và trước khi đối tượng bộ nhớ chia sẻ được hủy liên kết bằng `shm_unlink()`.

Trên một số hệ thống cài đặt, việc bỏ qua các lời gọi `sem_destroy()` không gây ra vấn đề gì. Tuy nhiên, trên các hệ thống khác, việc không gọi `sem_destroy()` có thể dẫn đến rò rỉ tài nguyên (resource leaks). Các ứng dụng tính di động cao (portable application) nên gọi `sem_destroy()` để tránh những vấn đề này.

## 53.5 So sánh với các Kỹ thuật Đồng bộ hóa Khác

Trong phần này, chúng ta so sánh semaphore POSIX với hai kỹ thuật đồng bộ hóa khác: semaphore System V và mutex.

### Semaphore POSIX với Semaphore System V

Cả semaphore POSIX và semaphore System V đều có thể được sử dụng để đồng bộ hóa các hoạt động của tiến trình. Phần [51.2](#page-4-0) đã liệt kê các ưu điểm khác nhau của IPC kiểu POSIX so với IPC kiểu System V: giao diện IPC POSIX đơn giản hơn và đồng nhất hơn với mô hình tệp truyền thống của UNIX, đồng thời các đối tượng IPC POSIX được quản lý theo cơ chế đếm tham chiếu (reference counted), giúp đơn giản hóa việc xác định thời điểm cần xóa một đối tượng IPC. Những ưu điểm chung này cũng áp dụng cho trường hợp cụ thể của semaphore POSIX (có tên) so với semaphore System V.

Semaphore POSIX có những ưu điểm vượt trội hơn so với semaphore System V như sau:

- Giao diện semaphore POSIX đơn giản hơn rất nhiều so với giao diện semaphore System V. Sự đơn giản này đạt được mà không làm mất đi tính năng hay sức mạnh biểu diễn.
- Semaphore POSIX có tên giúp loại bỏ vấn đề khởi tạo vốn đi kèm với semaphore System V (Phần 47.5).
- Việc liên kết một semaphore không tên POSIX với một đối tượng bộ nhớ được cấp phát động sẽ dễ dàng hơn: semaphore có thể được nhúng trực tiếp vào bên trong đối tượng đó.
- Trong các kịch bản có mức độ tranh chấp semaphore cao (tức là các thao tác trên semaphore thường xuyên bị chặn do một tiến trình khác đã đặt semaphore về giá trị ngăn cản thao tác tiếp tục ngay lập tức), hiệu năng của semaphore POSIX và semaphore System V là tương đương nhau. Tuy nhiên, trong các trường hợp có ít sự tranh chấp semaphore (tức là giá trị của semaphore cho phép các thao tác thường có thể

tiếp tục mà không bị chặn), thì semaphore POSIX hoạt động tốt hơn đáng kể so với semaphore System V. (Trên các hệ thống được tác giả thử nghiệm, sự khác biệt về hiệu năng lớn hơn một bậc độ lớn - hơn 10 lần; xem Bài tập 53-4). Semaphore POSIX hoạt động tốt hơn rất nhiều trong trường hợp này vì cách thức cài đặt của chúng chỉ yêu cầu gọi hệ thống (system call) khi xảy ra tranh chấp, trong khi các thao tác trên semaphore System V luôn yêu cầu gọi hệ thống, bất kể có tranh chấp hay không.

Tuy nhiên, semaphore POSIX cũng có những nhược điểm sau khi so sánh với semaphore System V:

- Semaphore POSIX kém tính di động (portable) hơn một chút. (Trên Linux, semaphore có tên chỉ được hỗ trợ bắt đầu từ kernel phiên bản 2.6).
- Semaphore POSIX không cung cấp tính năng tương đương với tính năng hoàn tác (undo) của semaphore System V. (Tuy nhiên, như chúng ta đã lưu ý ở Phần 47.8, tính năng này có thể không hữu ích trong một số hoàn cảnh).

### Semaphore POSIX với Pthreads Mutex

Cả semaphore POSIX và mutex của Pthreads đều có thể được sử dụng để đồng bộ hóa các hoạt động của các luồng (thread) trong cùng một tiến trình, và hiệu năng của chúng là tương đương nhau. Tuy nhiên, mutex thường được ưu tiên hơn, bởi vì thuộc tính sở hữu (ownership property) của mutex giúp ép buộc cấu trúc mã nguồn tốt hơn (chỉ luồng nào khóa mutex mới được phép mở khóa nó). Ngược lại, một luồng có thể tăng (increment) giá trị của một semaphore mà đã bị giảm (decrement) bởi một luồng khác. Sự linh hoạt này có thể dẫn đến các thiết kế đồng bộ hóa có cấu trúc kém. (Vì lý do này, semaphore đôi khi được gọi là câu lệnh "goto" của lập trình đồng thời).

Có một hoàn cảnh mà mutex không thể được sử dụng trong một ứng dụng đa luồng (multithreaded application), do đó semaphore có thể là lựa chọn ưu tiên hơn. Do hàm `sem_post()` an toàn với tín hiệu bất đồng bộ (async-signal-safe) (xem Bảng 21-1, trang 426), nó có thể được sử dụng bên trong một trình xử lý tín hiệu (signal handler) để đồng bộ hóa với một luồng khác. Điều này là không thể đối với mutex, bởi vì các hàm Pthreads thao tác trên mutex không an toàn với tín hiệu bất đồng bộ. Tuy nhiên, vì việc xử lý các tín hiệu bất đồng bộ bằng cách tiếp nhận chúng thông qua `sigwaitinfo()` (hoặc tương tự) thường được ưu tiên hơn là sử dụng các trình xử lý tín hiệu (xem Phần 33.2.4), nên ưu điểm này của semaphore so với mutex rất hiếm khi phải dùng đến.

## 53.6 Giới hạn của Semaphore (Semaphore Limits)

SUSv3 định nghĩa hai giới hạn áp dụng cho semaphore (semaphore limits):

SEM\_NSEMS\_MAX

Đây là số lượng tối đa các POSIX semaphore mà một tiến trình (process) có thể có. SUSv3 yêu cầu giới hạn này phải ít nhất là 256. Trên Linux, số lượng POSIX semaphore thực tế chỉ bị giới hạn bởi bộ nhớ khả dụng (available memory).

SEM\_VALUE\_MAX

Đây là giá trị tối đa mà một POSIX semaphore có thể đạt tới. Semaphore có thể nhận bất kỳ giá trị nào từ 0 cho đến giới hạn này. SUSv3 yêu cầu giới hạn này phải ít nhất là 32.767; bản cài đặt trên Linux cho phép các giá trị lên tới `INT_MAX` (2.147.483.647 trên Linux/x86-32).

## 53.7 Tóm tắt (Summary)

POSIX semaphore cho phép các tiến trình (process) hoặc luồng (thread) đồng bộ hóa các hoạt động của chúng. POSIX semaphore có hai loại: có tên (named) và không tên (unnamed). Một semaphore có tên được nhận diện bằng một tên định danh, và có thể được chia sẻ bởi bất kỳ tiến trình nào có quyền mở semaphore đó. Một semaphore không tên không có tên định danh, nhưng các tiến trình hoặc luồng có thể chia sẻ cùng một semaphore bằng cách đặt nó vào một vùng nhớ mà chúng chia sẻ (ví dụ: trong một đối tượng bộ nhớ chia sẻ POSIX để chia sẻ giữa các tiến trình, hoặc trong một biến toàn cục để chia sẻ giữa các luồng).

Giao diện POSIX semaphore đơn giản hơn giao diện System V semaphore. Các semaphore được cấp phát và thao tác một cách độc lập, và các thao tác chờ (`wait`) và giải phóng (`post`) sẽ điều chỉnh giá trị của semaphore đi một đơn vị.

POSIX semaphore có một số ưu điểm vượt trội so với System V semaphore, nhưng chúng kém tính di động (portable) hơn một chút. Đối với việc đồng bộ hóa trong các ứng dụng đa luồng (multithreaded application), mutex thường được ưu tiên sử dụng hơn semaphore.

### Thông tin thêm (Further information)

[Stevens, 1999] trình bày một góc nhìn khác về POSIX semaphore và minh họa các bản cài đặt ở không gian người dùng (user-space implementations) sử dụng nhiều cơ chế IPC khác nhau (FIFO, các file ánh xạ bộ nhớ - memory-mapped files, và System V semaphore). [Butenhof, 1996] mô tả việc sử dụng POSIX semaphore trong các ứng dụng đa luồng (multithreaded applications).

## 53.8 Bài tập (Exercises)

- **53-1.** Viết lại các chương trình trong Liệt kê 48-2 (Listing 48-2) và Liệt kê 48-3 (Listing 48-3) (Mục 48.4) thành một ứng dụng đa luồng (threaded application), với hai luồng truyền dữ liệu cho nhau thông qua một vùng đệm toàn cục (global buffer), và sử dụng POSIX semaphore để đồng bộ hóa.
- **53-2.** Chỉnh sửa chương trình trong [Liệt kê 53-3](#page-38-0) (`psem_wait.c`) để sử dụng `sem_timedwait()` thay vì `sem_wait()`. Chương trình nên nhận thêm một đối số dòng lệnh (command-line argument) chỉ định số giây (tương đối) dùng làm thời gian chờ (timeout) cho lời gọi `sem_timedwait()`.
- **53-3.** Xây dựng một phương án cài đặt (implementation) POSIX semaphore bằng cách sử dụng System V semaphore.
- **53-4.** Tại Mục [53.5](#page-46-0), chúng ta đã lưu ý rằng POSIX semaphore có hiệu suất vượt trội hơn nhiều so với System V semaphore trong trường hợp semaphore không có sự tranh chấp (uncontended). Hãy viết hai chương trình (mỗi chương trình cho một loại semaphore) để kiểm chứng điều này. Mỗi chương trình sẽ thực hiện tăng và giảm giá trị của semaphore một số lần nhất định. So sánh thời gian thực thi cần thiết của hai chương trình đó.
