# Chương 26: Giám sát tiến trình con (Monitoring Child Processes)

Trong nhiều thiết kế ứng dụng, một tiến trình cha (parent process) cần biết khi nào một trong các tiến trình con (child processes) của nó thay đổi trạng thái — khi tiến trình con kết thúc (terminate) hoặc bị dừng bởi một tín hiệu (signal). Chương trình này mô tả hai kỹ thuật được sử dụng để giám sát các tiến trình con: lời gọi hệ thống (system call) `wait()` (và các biến thể của nó) và việc sử dụng tín hiệu `SIGCHLD`.

## 26.1 Chờ một Tiến trình Con (Waiting on a Child Process)

Trong nhiều ứng dụng mà tiến trình cha tạo ra các tiến trình con, việc tiến trình cha có thể giám sát các tiến trình con để biết thời điểm và cách thức chúng kết thúc là rất hữu ích. Tính năng này được cung cấp bởi `wait()` và một số lời gọi hệ thống liên quan.

### 26.1.1 Lời gọi hệ thống wait() (The wait() System Call)

Lời gọi hệ thống `wait()` chờ một trong các tiến trình con của tiến trình gọi kết thúc và trả về trạng thái kết thúc của tiến trình con đó trong vùng đệm (buffer) được trỏ tới bởi `status`.

```c
## include <sys/wait.h>
pid_t wait(int *status);
                          Trả về ID tiến trình của tiến trình con đã kết thúc, hoặc –1 nếu có lỗi
```

Lời gọi hệ thống `wait()` thực hiện các công việc sau:

- 1. Nếu chưa có tiến trình con nào (chưa từng được chờ trước đó) của tiến trình gọi kết thúc, lời gọi sẽ chặn (block) cho đến khi một trong các tiến trình con kết thúc. Nếu một tiến trình con đã kết thúc tại thời điểm gọi, `wait()` sẽ trả về ngay lập tức.
- 2. Nếu `status` không phải là `NULL`, thông tin về cách thức tiến trình con kết thúc được trả về trong biến số nguyên mà `status` trỏ tới. Chúng ta mô tả thông tin được trả về trong `status` tại Mục [26.1.3.](#page-32-0)
- 3. Kernel cộng thời gian CPU của tiến trình (Mục 10.7) và thống kê sử dụng tài nguyên (Mục 36.1) vào tổng số tích lũy cho tất cả các tiến trình con của tiến trình cha này.
- 4. Kết quả trả về của hàm, `wait()` trả về ID tiến trình (Process ID) của tiến trình con đã kết thúc.

Khi có lỗi, `wait()` trả về –1. Một lỗi có thể xảy ra là tiến trình gọi không có tiến trình con nào (chưa từng được chờ trước đó), điều này được chỉ ra bởi giá trị `errno` là `ECHILD`. Điều này có nghĩa là chúng ta có thể sử dụng vòng lặp sau để chờ tất cả các tiến trình con của tiến trình gọi kết thúc:

```
while ((childPid = wait(NULL)) != -1)
 continue;
if (errno != ECHILD) /* Một lỗi không mong đợi... */
 errExit("wait");
```

[Liệt kê 26-1](#page-30-0) minh họa việc sử dụng `wait()`. Chương trình này tạo ra nhiều tiến trình con, mỗi tiến trình tương ứng với một đối số dòng lệnh (kiểu số nguyên). Mỗi tiến trình con ngủ trong số giây được chỉ định trong đối số dòng lệnh tương ứng và sau đó thoát. Trong lúc đó, sau khi tất cả các tiến trình con đã được tạo, tiến trình cha liên tục gọi `wait()` để giám sát việc kết thúc của các tiến trình con của nó. Vòng lặp này tiếp tục cho đến khi `wait()` trả về –1. (Đây không phải là cách tiếp cận duy nhất: chúng ta có thể thay thế bằng cách thoát khỏi vòng lặp khi số lượng tiến trình con đã chết, `numDead`, khớp với số lượng tiến trình con được tạo ra). Nhật ký phiên làm việc shell sau đây cho thấy điều gì xảy ra khi chúng ta sử dụng chương trình để tạo ra ba tiến trình con:

```
$ ./multi_wait 7 1 4
[13:41:00] child 1 started with PID 21835, sleeping 7 seconds
[13:41:00] child 2 started with PID 21836, sleeping 1 seconds
[13:41:00] child 3 started with PID 21837, sleeping 4 seconds
[13:41:01] wait() returned child PID 21836 (numDead=1)
[13:41:04] wait() returned child PID 21837 (numDead=2)
[13:41:07] wait() returned child PID 21835 (numDead=3)
No more children - bye!
```

Nếu có nhiều tiến trình con đã kết thúc tại một thời điểm cụ thể, chuẩn SUSv3 không quy định thứ tự mà các tiến trình con này sẽ được thu gom (reaped) bởi một chuỗi các lời gọi `wait()`; nghĩa là thứ tự phụ thuộc vào việc hiện thực (implementation). Ngay cả giữa các phiên bản Linux kernel khác nhau, hành vi này cũng thay đổi.

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/multi_wait.c
## include <sys/wait.h>
## include <time.h>
## include "curr_time.h" /* Khai báo của currTime() */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int numDead; /* Số lượng tiến trình con đã được chờ cho đến nay */
 pid_t childPid; /* PID của tiến trình con được chờ */
 int j;
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s sleep-time...\n", argv[0]);
 setbuf(stdout, NULL); /* Vô hiệu hóa việc đệm (buffering) của stdout */
 for (j = 1; j < argc; j++) { /* Tạo một tiến trình con cho mỗi đối số */
 switch (fork()) {
 case -1:
 errExit("fork");
 case 0: /* Tiến trình con ngủ một thời gian rồi thoát */
 printf("[%s] child %d started with PID %ld, sleeping %s "
 "seconds\n", currTime("%T"), j, (long) getpid(), argv[j]);
 sleep(getInt(argv[j], GN_NONNEG, "sleep-time"));
 _exit(EXIT_SUCCESS);
 default: /* Tiến trình cha tiếp tục vòng lặp */
 break;
 }
 }
 numDead = 0;
 for (;;) { /* Tiến trình cha chờ từng tiến trình con thoát */
 childPid = wait(NULL);
 if (childPid == -1) {
 if (errno == ECHILD) {
 printf("No more children - bye!\n");
 exit(EXIT_SUCCESS);
 } else { /* Một lỗi khác (không mong đợi) */
 errExit("wait");
 }
 }
 numDead++;
 printf("[%s] wait() returned child PID %ld (numDead=%d)\n",
 currTime("%T"), (long) childPid, numDead);
 }
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/multi_wait.c
```

### 26.1.2 System Call waitpid()

System call `wait()` có một số hạn chế mà `waitpid()` được thiết kế để khắc phục:

- Nếu một tiến trình cha (parent process) tạo ra nhiều tiến trình con (child process), chúng ta không thể gọi `wait()` để chờ sự hoàn thành của một tiến trình con cụ thể nào; chúng ta chỉ có thể chờ tiến trình con tiếp theo kết thúc.
- Nếu chưa có tiến trình con nào kết thúc, `wait()` sẽ luôn bị chặn (blocks). Đôi khi, chúng ta sẽ muốn thực hiện một thao tác chờ không chặn (nonblocking wait) để nếu chưa có tiến trình con nào kết thúc, ta sẽ nhận được phản hồi ngay lập tức về trạng thái đó.
- Sử dụng `wait()`, chúng ta chỉ có thể biết về các tiến trình con đã kết thúc. Không thể nhận được thông báo khi một tiến trình con bị dừng bởi một tín hiệu (chẳng hạn như `SIGSTOP` hoặc `SIGTTIN`) hoặc khi một tiến trình con bị dừng được tiếp tục chạy (resumed) thông qua việc nhận tín hiệu `SIGCONT`.

```c
## include <sys/wait.h>
pid_t waitpid(pid_t pid, int *status, int options);
                          Trả về Process ID của tiến trình con, 0 (xem văn bản), hoặc –1 nếu có lỗi
```

Giá trị trả về và các tham số `status` của `waitpid()` hoàn toàn giống với `wait()`. (Xem Mục [26.1.3](#page-32-0) để được giải thích về giá trị được trả về trong `status`). Tham số `pid` cho phép lựa chọn tiến trình con cần chờ, cụ thể như sau:

- Nếu `pid` lớn hơn 0, hãy chờ tiến trình con có Process ID bằng `pid`.
- Nếu `pid` bằng 0, hãy chờ bất kỳ tiến trình con nào nằm trong cùng nhóm tiến trình (process group) với tiến trình gọi (tiến trình cha). Chúng ta sẽ mô tả các nhóm tiến trình ở Mục 34.2.
- Nếu `pid` nhỏ hơn –1, hãy chờ bất kỳ tiến trình con nào có định danh nhóm tiến trình bằng giá trị tuyệt đối của `pid`.
- Nếu `pid` bằng –1, hãy chờ bất kỳ tiến trình con nào. Lời gọi `wait(&status)` tương đương với lời gọi `waitpid(–1, &status, 0)`.

Tham số `options` là một bit mask có thể bao gồm (phép toán OR) từ không đến nhiều cờ (flag) sau đây (tất cả đều được quy định trong SUSv3):

### WUNTRACED

Ngoài việc trả về thông tin về các tiến trình con đã kết thúc, cũng trả về thông tin khi một tiến trình con bị dừng bởi một tín hiệu.

### WCONTINUED (từ Linux 2.6.10)

Cũng trả về thông tin trạng thái về các tiến trình con bị dừng đã được tiếp tục chạy thông qua việc nhận tín hiệu `SIGCONT`.

### WNOHANG

Nếu chưa có tiến trình con nào được chỉ định bởi `pid` thay đổi trạng thái, thì trả về ngay lập tức thay vì bị chặn (nghĩa là thực hiện thao tác "thăm dò" - poll). Trong trường hợp này, giá trị trả về của `waitpid()` là 0. Nếu tiến trình gọi không có tiến trình con nào khớp với tiêu chuẩn chỉ định trong `pid`, `waitpid()` sẽ thất bại và trả về lỗi `ECHILD`.

Chúng ta minh họa cách sử dụng `waitpid()` trong Liệt kê (Listing) 26-3.

Trong phần lý giải (rationale) cho `waitpid()`, SUSv3 lưu ý rằng tên gọi `WUNTRACED` là một di tích lịch sử bắt nguồn từ BSD, nơi một tiến trình có thể bị dừng theo một trong hai cách: do hệ quả của việc bị theo dõi (traced) bởi system call `ptrace()`, hoặc do bị dừng bởi một tín hiệu (nghĩa là không bị theo dõi). Khi một tiến trình con đang bị theo dõi bởi `ptrace()`, thì việc gửi bất kỳ tín hiệu nào (ngoại trừ `SIGKILL`) sẽ khiến tiến trình con đó bị dừng, và do đó một tín hiệu `SIGCHLD` sẽ được gửi tới tiến trình cha. Hành vi này vẫn diễn ra ngay cả khi tiến trình con đang bỏ qua tín hiệu đó. Tuy nhiên, nếu tiến trình con đang chặn (block) tín hiệu đó, thì nó sẽ không bị dừng (trừ khi tín hiệu đó là `SIGSTOP`, vốn là tín hiệu không thể bị chặn).

### 26.1.3 Giá trị Trạng thái Chờ (Wait Status Value)

Giá trị trạng thái (status value) được trả về bởi `wait()` và `waitpid()` cho phép chúng ta phân biệt các sự kiện sau đây của tiến trình con (child):

- Tiến trình con đã kết thúc bằng cách gọi `_exit()` (hoặc `exit()`), chỉ định một mã trạng thái thoát (exit status) dạng số nguyên.
- Tiến trình con bị chấm dứt do nhận được một tín hiệu (signal) chưa được xử lý.
- Tiến trình con bị dừng (stopped) bởi một tín hiệu, và `waitpid()` được gọi với cờ `WUNTRACED`.
- Tiến trình con được tiếp tục chạy (resumed) bởi tín hiệu `SIGCONT`, và `waitpid()` được gọi với cờ `WCONTINUED`.

Chúng ta sử dụng thuật ngữ trạng thái chờ (wait status) để bao hàm tất cả các trường hợp trên. Thuật ngữ trạng thái kết thúc (termination status) được dùng để chỉ hai trường hợp đầu tiên. (Trong shell, chúng ta có thể lấy trạng thái kết thúc của lệnh được thực thi gần nhất bằng cách kiểm tra nội dung của biến `$?`.)

Mặc dù được định nghĩa là một kiểu `int`, nhưng chỉ có 2 byte thấp của giá trị được trỏ tới bởi `status` thực sự được sử dụng. Cách thức mà 2 byte này được lấp đầy phụ thuộc vào sự kiện nào ở trên đã xảy ra với tiến trình con, như được minh họa trong [Hình 26-1.](#page-32-1)

> [!NOTE]
> [Hình 26-1](#page-32-1) thể hiện bố cục của giá trị trạng thái chờ đối với Linux/x86-32. Các chi tiết này có thể khác nhau giữa các bản cài đặt (implementations). SUSv3 không quy định bất kỳ bố cục cụ thể nào cho thông tin này, hoặc thậm chí không yêu cầu nó phải nằm trong 2 byte thấp của giá trị được trỏ bởi `status`. Các ứng dụng có tính di động (portable applications) nên luôn sử dụng các macro được mô tả trong phần này để kiểm tra giá trị này, thay vì trực tiếp kiểm tra các thành phần mặt nạ bit (bit-mask) của nó.

```text
                           15 ←────── các bit ──────► 8  7                    0
                          ┌─────────────────────────┬──────────────────────────┐
Normal termination        │  exit status (0-255)    │           0              │
                          └─────────────────────────┴──────────────────────────┘

                          ┌─────────────────────────┬──┬───────────────────────┐
Killed by signal          │      chưa dùng (0)      │  │ termination signal != 0│
                          └─────────────────────────┴──┴───────────────────────┘
                                                       ▲
                                                       └─ cờ core dumped

                          ┌─────────────────────────┬──────────────────────────┐
Stopped by signal         │      stop signal        │          0x7F            │
                          └─────────────────────────┴──────────────────────────┘

                          ┌──────────────────────────────────────────────────────┐
Continued by signal       │                    0xFFFF                            │
                          └──────────────────────────────────────────────────────┘
```

**Hình 26-1:** Giá trị được trả về trong tham số `status` của `wait()` và `waitpid()`

Tệp tiêu đề `<sys/wait.h>` định nghĩa một tập hợp các macro chuẩn có thể được sử dụng để phân tích (dissect) giá trị trạng thái chờ. Khi được áp dụng cho một giá trị trạng thái trả về bởi `wait()` hoặc `waitpid()`, chỉ có một macro trong danh sách dưới đây trả về giá trị đúng (true). Các macro bổ sung được cung cấp để phân tích kỹ hơn giá trị trạng thái, như được ghi chú trong danh sách.

### WIFEXITED(status)

Macro này trả về true nếu tiến trình con thoát bình thường. Trong trường hợp này, macro `WEXITSTATUS(status)` trả về mã trạng thái thoát của tiến trình con. (Như đã lưu ý ở Mục [25.1,](#page-18-1) chỉ có byte ít ý nghĩa nhất (least significant byte) trong mã trạng thái thoát của tiến trình con là khả dụng đối với tiến trình cha (parent).)

### WIFSIGNALED(status)

Macro này trả về true nếu tiến trình con bị tiêu diệt bởi một tín hiệu. Trong trường hợp này, macro `WTERMSIG(status)` trả về số hiệu của tín hiệu đã làm cho tiến trình kết thúc, và macro `WCOREDUMP(status)` trả về true nếu tiến trình con tạo ra một tệp kết xuất lõi (core dump file). Macro `WCOREDUMP()` không được quy định bởi SUSv3, nhưng có sẵn trên hầu hết các bản cài đặt UNIX.

### WIFSTOPPED(status)

Macro này trả về true nếu tiến trình con bị dừng bởi một tín hiệu. Trong trường hợp này, macro `WSTOPSIG(status)` trả về số hiệu của tín hiệu đã dừng tiến trình.

### WIFCONTINUED(status)

Macro này trả về true nếu tiến trình con được tiếp tục chạy nhờ việc nhận được tín hiệu `SIGCONT`. Macro này có sẵn kể từ Linux 2.6.10.

Lưu ý rằng mặc dù tên `status` cũng được dùng cho tham số của các macro trên, nhưng chúng mong đợi một số nguyên thuần túy (plain integer), chứ không phải một con trỏ trỏ tới số nguyên như yêu cầu của `wait()` và `waitpid()`.

### Chương trình ví dụ

Hàm `printWaitStatus()` trong [Liệt kê 26-2](#page-33-0) sử dụng tất cả các macro được mô tả ở trên. Hàm này phân tích và in ra nội dung của một giá trị trạng thái chờ.

**Liệt kê 26-2:** Hiển thị giá trị trạng thái trả về bởi `wait()` và các lời gọi liên quan

```c
––––––––––––––––––––––––––––––––––––––––––––––– procexec/print_wait_status.c
## define _GNU_SOURCE /* Lấy khai báo strsignal() từ <string.h> */
## include <string.h>
## include <sys/wait.h>
## include "print_wait_status.h" /* Khai báo của printWaitStatus() */
## include "tlpi_hdr.h"
/* LƯU Ý: Hàm sau đây sử dụng printf(), vốn không phải là
 async-signal-safe (xem Mục 21.1.2). Do đó, hàm này cũng 
 không phải là async-signal-safe (tức là, hãy cẩn thận khi gọi nó từ
 một trình xử lý SIGCHLD). */
void /* Kiểm tra trạng thái wait() bằng cách sử dụng các macro W* */
printWaitStatus(const char *msg, int status)
{
 if (msg != NULL)
 printf("%s", msg);
 if (WIFEXITED(status)) {
 printf("child exited, status=%d\n", WEXITSTATUS(status));
 } else if (WIFSIGNALED(status)) {
 printf("child killed by signal %d (%s)",
 WTERMSIG(status), strsignal(WTERMSIG(status)));
## ifdef WCOREDUMP /* Not in SUSv3, may be absent on some systems */
 if (WCOREDUMP(status))
 printf(" (core dumped)");
## endif
 printf("\n");
 } else if (WIFSTOPPED(status)) {
 printf("child stopped by signal %d (%s)\n",
 WSTOPSIG(status), strsignal(WSTOPSIG(status)));
## ifdef WIFCONTINUED /* SUSv3 has this, but older Linux versions and
 some other UNIX implementations don't */
 } else if (WIFCONTINUED(status)) {
 printf("child continued\n");
## endif
 } else { /* Should never happen */
 printf("what happened to this child? (status=%x)\n",
 (unsigned int) status);
 }
}
––––––––––––––––––––––––––––––––––––––––––––––– procexec/print_wait_status.c
```

Hàm `printWaitStatus()` được sử dụng trong Liệt kê (Listing) 26-3. Chương trình này tạo ra một tiến trình con (`child process`) hoặc chạy vòng lặp liên tục gọi `pause()` (trong khoảng thời gian đó các tín hiệu - `signals` có thể được gửi tới tiến trình con), hoặc nếu một đối số dòng lệnh là số nguyên được cung cấp, nó sẽ thoát ngay lập tức với số nguyên này làm trạng thái kết thúc (`exit status`). Trong lúc đó, tiến trình cha (`parent process`) giám sát tiến trình con thông qua `waitpid()`, in ra giá trị trạng thái được trả về và truyền giá trị này cho hàm `printWaitStatus()`. Tiến trình cha thoát khi nó phát hiện thấy tiến trình con đã thoát bình thường hoặc bị chấm dứt bởi một tín hiệu (`signal`).

Phiên làm việc shell sau đây hiển thị một số ví dụ chạy chương trình trong Liệt kê 26-3. Chúng ta bắt đầu bằng cách tạo một tiến trình con thoát ngay lập tức với trạng thái là 23:

```
$ ./child_status 23
Child started with PID = 15807
waitpid() returned: PID=15807; status=0x1700 (23,0)
child exited, status=23
```

Trong lần chạy tiếp theo, chúng ta khởi động chương trình ở chế độ nền (`background`), sau đó gửi các tín hiệu `SIGSTOP` và `SIGCONT` đến tiến trình con:

```
$ ./child_status &
[1] 15870
$ Child started with PID = 15871
```

```
kill -STOP 15871
$ waitpid() returned: PID=15871; status=0x137f (19,127)
child stopped by signal 19 (Stopped (signal))
kill -CONT 15871
$ waitpid() returned: PID=15871; status=0xffff (255,255)
child continued
```

Hai dòng đầu ra cuối cùng sẽ chỉ xuất hiện trên Linux 2.6.10 trở lên, do các phiên bản kernel cũ hơn không hỗ trợ tùy chọn `WCONTINUED` của `waitpid()`. (Phiên bản shell này hơi khó đọc một chút do đầu ra từ chương trình chạy ở chế độ nền trong một số trường hợp bị trộn lẫn với dấu nhắc lệnh do shell tạo ra).

Chúng ta tiếp tục phiên làm việc shell bằng cách gửi tín hiệu `SIGABRT` để chấm dứt tiến trình con:

```
kill -ABRT 15871
$ waitpid() returned: PID=15871; status=0x0006 (0,6)
child killed by signal 6 (Aborted)
Press Enter, in order to see shell notification that background job has terminated
[1]+ Done ./child_status
$ ls -l core
ls: core: No such file or directory
$ ulimit -c Display RLIMIT_CORE limit
0
```

Mặc dù hành động mặc định của `SIGABRT` là tạo ra tệp core dump và chấm dứt tiến trình, nhưng không có tệp core nào được tạo ra. Điều này là do các tệp core dump đã bị vô hiệu hóa — giới hạn tài nguyên mềm `RLIMIT_CORE` (Mục 36.3), xác định kích thước tối đa của tệp core, được đặt thành 0, như được hiển thị bởi lệnh `ulimit` ở trên.

Chúng ta lặp lại thí nghiệm tương tự, nhưng lần này bật tính năng tạo core dump trước khi gửi `SIGABRT` đến tiến trình con:

```
$ ulimit -c unlimited Allow core dumps
$ ./child_status &
[1] 15902
$ Child started with PID = 15903
kill -ABRT 15903 Send SIGABRT to child
$ waitpid() returned: PID=15903; status=0x0086 (0,134)
child killed by signal 6 (Aborted) (core dumped)
Press Enter, in order to see shell notification that background job has terminated
[1]+ Done ./child_status
$ ls -l core This time we get a core dump
-rw------- 1 mtk users 65536 May 6 21:01 core
```

**Liệt kê 26-3:** Sử dụng `waitpid()` để truy xuất trạng thái của một tiến trình con (`child process`)

```c
––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/child_status.c
## include <sys/wait.h>
## include "print_wait_status.h" /* Declares printWaitStatus() */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int status;
 pid_t childPid;

 if (argc > 1 && strcmp(argv[1], "--help") == 0)
 usageErr("%s [exit-status]\n", argv[0]);
 switch (fork()) {
 case -1: errExit("fork");
 case 0: /* Child: either exits immediately with given
 status or loops waiting for signals */
 printf("Child started with PID = %ld\n", (long) getpid());
 if (argc > 1) /* Status supplied on command line? */
 exit(getInt(argv[1], 0, "exit-status"));
 else /* Otherwise, wait for signals */
 for (;;)
 pause();
 exit(EXIT_FAILURE); /* Not reached, but good practice */
 default: /* Parent: repeatedly wait on child until it
 either exits or is terminated by a signal */
 for (;;) {
 childPid = waitpid(-1, &status, WUNTRACED
## ifdef WCONTINUED /* Not present on older versions of Linux */
 | WCONTINUED
## endif
 );
 if (childPid == -1)
 errExit("waitpid");
 /* Print status in hex, and as separate decimal bytes */
 printf("waitpid() returned: PID=%ld; status=0x%04x (%d,%d)\n",
 (long) childPid,
 (unsigned int) status, status >> 8, status & 0xff);
 printWaitStatus(NULL, status);
 if (WIFEXITED(status) || WIFSIGNALED(status))
 exit(EXIT_SUCCESS);
 }
 }
}
––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/child_status.c
```

### 26.1.4 Kết thúc tiến trình từ Trình xử lý tín hiệu (Signal Handler)

Như được minh họa trong Bảng 20-1 (ở trang 396), một số tín hiệu sẽ chấm dứt (terminate) một tiến trình theo mặc định. Trong một số trường hợp, chúng ta có thể muốn thực hiện một số bước dọn dẹp (cleanup) nhất định trước khi tiến trình kết thúc. Vì mục đích này, chúng ta có thể thiết lập để một hàm xử lý (handler) bắt các tín hiệu đó, thực hiện các bước dọn dẹp, và sau đó chấm dứt tiến trình. Nếu làm như vậy, chúng ta nên ghi nhớ rằng trạng thái kết thúc (termination status) của một tiến trình có thể được lấy bởi tiến trình cha (parent process) thông qua hàm `wait()` hoặc `waitpid()`. Ví dụ, việc gọi `_exit(EXIT_SUCCESS)` từ trong trình xử lý tín hiệu sẽ làm cho tiến trình cha thấy rằng tiến trình con đã kết thúc thành công.

Nếu tiến trình con cần thông báo cho tiến trình cha biết rằng nó đã kết thúc do một tín hiệu, thì trình xử lý tín hiệu của tiến trình con trước tiên nên hủy đăng ký chính nó (disestablish), rồi sau đó kích hoạt (raise) lại chính tín hiệu đó một lần nữa, hành động này sẽ chấm dứt tiến trình. Trình xử lý tín hiệu sẽ chứa mã nguồn tương tự như sau:

```c
void
handler(int sig)
{
 /* Thực hiện các bước dọn dẹp */
 signal(sig, SIG_DFL); /* Hủy đăng ký handler */
 raise(sig); /* Kích hoạt lại tín hiệu */
}
```

### 26.1.5 System Call waitid()

Giống như `waitpid()`, system call `waitid()` trả về trạng thái của các tiến trình con (child process). Tuy nhiên, `waitid()` cung cấp thêm các tính năng bổ sung mà `waitpid()` không có. System call này bắt nguồn từ System V, nhưng hiện đã được quy định trong chuẩn SUSv3. Nó đã được thêm vào Linux từ phiên bản kernel 2.6.9.

> [!NOTE]
> Trước Linux 2.6.9, một phiên bản của `waitid()` đã được cung cấp thông qua quá trình triển khai trong glibc. Tuy nhiên, vì việc triển khai đầy đủ giao diện này đòi hỏi sự hỗ trợ từ kernel, nên phần triển khai trong glibc không cung cấp thêm tính năng nào so với những gì đã có sẵn khi sử dụng `waitpid()`.

```c
## include <sys/wait.h>
int waitid(idtype_t idtype, id_t id, siginfo_t *infop, int options);
                              Trả về 0 khi thành công hoặc nếu WNOHANG được chỉ định và
                                không có tiến trình con nào để chờ, hoặc –1 khi có lỗi
```

Các tham số `idtype` và `id` chỉ định tiến trình con nào cần chờ, cụ thể như sau:

- Nếu `idtype` là `P_ALL`, chờ bất kỳ tiến trình con nào; tham số `id` bị bỏ qua.
- Nếu `idtype` là `P_PID`, chờ tiến trình con có Process ID bằng với `id`.
- Nếu `idtype` là `P_PGID`, chờ bất kỳ tiến trình con nào có Process Group ID bằng với `id`.

Lưu ý rằng không giống như `waitpid()`, việc chỉ định giá trị 0 trong `id` để biểu thị bất kỳ tiến trình nào nằm trong cùng một nhóm tiến trình (process group) với tiến trình gọi là không khả thi. Thay vào đó, chúng ta phải chỉ định rõ ràng Process Group ID của tiến trình gọi bằng cách sử dụng giá trị được trả về bởi hàm `getpgrp()`.

Sự khác biệt quan trọng nhất giữa `waitpid()` và `waitid()` là `waitid()` cung cấp khả năng kiểm soát chính xác hơn đối với các sự kiện của tiến trình con cần được chờ đợi. Chúng ta kiểm soát điều này bằng cách kết hợp phép toán OR (`|`) trên một hoặc nhiều cờ (flag) sau trong tham số `options`:

`WEXITED`

Chờ các tiến trình con đã kết thúc, dù là bình thường hay bất thường.

`WSTOPPED`

Chờ các tiến trình con đã bị dừng (stop) bởi một tín hiệu.

`WCONTINUED`

Chờ các tiến trình con đã được tiếp tục thực thi bởi tín hiệu `SIGCONT`.

Các cờ bổ sung sau đây cũng có thể được kết hợp bằng phép toán OR trong `options`:

`WNOHANG`

Cờ này có ý nghĩa tương tự như đối với `waitpid()`. Nếu không có tiến trình con nào khớp với chỉ định trong `id` có thông tin trạng thái để trả về, thì trả về ngay lập tức (thao tác thăm dò - poll). Trong trường hợp này, giá trị trả về của `waitid()` là 0. Nếu tiến trình gọi không có tiến trình con nào khớp với chỉ định trong `id`, `waitid()` sẽ thất bại và trả về lỗi `ECHILD`.

`WNOWAIT`

Thông thường, một khi tiến trình con đã được chờ đợi bằng `waitid()`, "sự kiện trạng thái" (status event) đó sẽ bị tiêu thụ (consume). Tuy nhiên, nếu cờ `WNOWAIT` được chỉ định, trạng thái của tiến trình con vẫn được trả về, nhưng tiến trình con đó vẫn ở trạng thái có thể chờ (waitable state), và sau đó chúng ta có thể tiếp tục chờ nó để truy xuất lại thông tin tương tự.

Khi thành công, `waitid()` trả về 0 và cấu trúc `siginfo_t` (Mục 21.4) được trỏ tới bởi `infop` sẽ được cập nhật để chứa thông tin về tiến trình con. Các trường sau đây sẽ được điền dữ liệu trong cấu trúc `siginfo_t`:

`si_code`

Trường này chứa một trong các giá trị sau: `CLD_EXITED`, cho biết tiến trình con đã kết thúc bằng cách gọi `_exit()`; `CLD_KILLED`, cho biết tiến trình con đã bị tiêu diệt bởi một tín hiệu; `CLD_STOPPED`, cho biết tiến trình con đã bị dừng bởi một tín hiệu; hoặc `CLD_CONTINUED`, cho biết tiến trình con (trước đó đã bị dừng) đã tiếp tục thực thi do nhận được tín hiệu `SIGCONT`.

`si_pid`

Trường này chứa Process ID của tiến trình con có trạng thái vừa thay đổi.

`si_signo`

Trường này luôn được đặt thành `SIGCHLD`.

`si_status`

Trường này chứa trạng thái thoát (exit status) của tiến trình con (được truyền tới hàm `_exit()`), hoặc mã tín hiệu khiến tiến trình con dừng, tiếp tục, hay kết thúc. Chúng ta có thể xác định loại thông tin nào nằm trong trường này bằng cách kiểm tra trường `si_code`.

`si_uid`

Trường này chứa Real User ID của tiến trình con. Hầu hết các bản triển khai UNIX khác không thiết lập trường này.

Trên hệ điều hành Solaris, có thêm hai trường được điền dữ liệu: `si_stime` và `si_utime`. Các trường này lần lượt chứa thời gian CPU ở chế độ hệ thống (system CPU time) và chế độ người dùng (user CPU time) mà tiến trình con đã sử dụng. Chuẩn SUSv3 không bắt buộc các trường này phải được thiết lập bởi `waitid()`.

Một chi tiết về hoạt động của `waitid()` cần được làm rõ thêm. Nếu `WNOHANG` được chỉ định trong `options`, thì giá trị trả về là `0` từ `waitid()` có thể mang một trong hai ý nghĩa: một tiến trình con (child process) đã thay đổi trạng thái tại thời điểm gọi (và thông tin về tiến trình con được trả về trong cấu trúc `siginfo_t` được trỏ tới bởi `infop`), hoặc không có tiến trình con nào có trạng thái thay đổi. Đối với trường hợp không có tiến trình con nào thay đổi trạng thái, một số cài đặt UNIX (bao gồm cả Linux) sẽ xóa sạch (zero out) cấu trúc `siginfo_t` được trả về. Điều này cung cấp một phương pháp để phân biệt hai khả năng: chúng ta có thể kiểm tra xem giá trị trong `si_pid` là `0` hay khác không (nonzero). Thật không may, hành vi này không được yêu cầu bởi SUSv3, và một số cài đặt UNIX giữ nguyên cấu trúc `siginfo_t` trong trường hợp này. (Một bản đính chính trong tương lai cho SUSv4 có thể sẽ bổ sung yêu cầu rằng `si_pid` và `si_signo` phải được đặt về 0 trong trường hợp này). Cách duy nhất có tính di động (portable) để phân biệt hai trường hợp này là xóa sạch cấu trúc `siginfo_t` trước khi gọi `waitid()`, như trong đoạn mã sau:

```
siginfo_t info;
...
memset(&info, 0, sizeof(siginfo_t));
if (waitid(idtype, id, &info, options | WNOHANG) == -1)
 errExit("waitid");
if (info.si_pid == 0) {
 /* Không có tiến trình con nào thay đổi trạng thái */
} else {
 /* Một tiến trình con đã thay đổi trạng thái; chi tiết được cung cấp trong 'info' */
}
```

### 26.1.6 Các System Call wait3() và wait4()

Các system call `wait3()` và `wait4()` thực hiện tác vụ tương tự như `waitpid()`. Sự khác biệt chính về mặt ngữ nghĩa là `wait3()` và `wait4()` trả về thông tin sử dụng tài nguyên (resource usage information) về tiến trình con đã kết thúc trong cấu trúc được trỏ tới bởi đối số `rusage`. Thông tin này bao gồm lượng thời gian CPU được sử dụng bởi tiến trình (process) và các thống kê quản lý bộ nhớ (memory-management statistics). Chúng ta sẽ hoãn thảo luận chi tiết về cấu trúc `rusage` cho đến Mục 36.1, nơi chúng ta mô tả system call `getrusage()`.

```c
## define _BSD_SOURCE /* Hoặc #define _XOPEN_SOURCE 500 cho wait3() */
## include <sys/resource.h>
## include <sys/wait.h>
pid_t wait3(int *status, int options, struct rusage *rusage);
pid_t wait4(pid_t pid, int *status, int options, struct rusage *rusage);
                                 Cả hai đều trả về PID của tiến trình con, hoặc –1 khi lỗi
```

Nếu không tính đến việc sử dụng đối số `rusage`, một lời gọi `wait3()` tương đương với lời gọi `waitpid()` sau:

```
waitpid(-1, &status, options);
Tương tự, wait4() tương đương với đoạn sau:
    waitpid(pid, &status, options);
```

Nói cách khác, `wait3()` chờ bất kỳ tiến trình con nào, trong khi `wait4()` có thể được sử dụng để chọn một hoặc nhiều tiến trình con cụ thể để chờ.

Trên một số cài đặt UNIX, `wait3()` và `wait4()` chỉ trả về thông tin sử dụng tài nguyên cho các tiến trình con đã kết thúc. Trên Linux, thông tin sử dụng tài nguyên cũng có thể được truy xuất cho các tiến trình con bị dừng (stopped children) nếu cờ `WUNTRACED` được chỉ định trong `options`.

Tên của hai system call này đề cập đến số lượng đối số mà mỗi hàm nhận vào. Cả hai system call đều có nguồn gốc từ BSD, nhưng hiện có sẵn trên hầu hết các cài đặt UNIX. Không có hàm nào được chuẩn hóa trong SUSv3. (SUSv2 có định nghĩa `wait3()`, nhưng đã đánh dấu nó là LEGACY - kế thừa/lỗi thời).

Chúng ta thường tránh sử dụng `wait3()` và `wait4()` trong cuốn sách này. Thông thường, chúng ta không cần thông tin bổ sung do các lời gọi này trả về. Ngoài ra, việc thiếu tính chuẩn hóa làm giới hạn tính di động (portability) của chúng.

## 26.2 Tiến trình mồ côi và tiến trình thây ma (Orphans and Zombies)

Vòng đời của tiến trình cha (parent process) và tiến trình con (child process) thường không giống nhau — hoặc tiến trình cha sống lâu hơn tiến trình con hoặc ngược lại. Điều này đặt ra hai câu hỏi:

Ai sẽ trở thành tiến trình cha của một tiến trình con bị mồ côi? Tiến trình con bị mồ côi sẽ được nhận nuôi bởi `init`, tổ tiên của tất cả các tiến trình, có ID tiến trình (Process ID) là 1. Nói cách khác, sau khi tiến trình cha của một tiến trình con kết thúc, một lời gọi hàm `getppid()` sẽ trả về giá trị 1. Điều này có thể được sử dụng như một cách để xác định xem tiến trình cha thực sự của một tiến trình con còn sống hay không (giả định rằng tiến trình con đó được tạo bởi một tiến trình khác không phải là `init`).

> [!NOTE]
> Sử dụng thao tác `PR_SET_PDEATHSIG` của system call `prctl()` đặc trưng cho Linux, ta có thể sắp xếp để một tiến trình nhận được một tín hiệu (signal) được chỉ định khi nó trở thành tiến trình mồ côi.

Điều gì xảy ra với một tiến trình con kết thúc trước khi tiến trình cha có cơ hội thực thi hàm `wait()`? Vấn đề ở đây là, mặc dù tiến trình con đã hoàn thành công việc của mình, tiến trình cha vẫn phải được phép thực hiện `wait()` vào một thời điểm sau đó để xác định tiến trình con đã kết thúc như thế nào. Kernel giải quyết tình huống này bằng cách biến tiến trình con thành một tiến trình thây ma (zombie). Điều này có nghĩa là phần lớn tài nguyên mà tiến trình con nắm giữ đã được giải phóng trở lại hệ thống để các tiến trình khác có thể tái sử dụng. Phần duy nhất của tiến trình còn lại là một mục (entry) trong bảng tiến trình (process table) của kernel, ghi lại (trong số những thứ khác) ID tiến trình của tiến trình con, trạng thái kết thúc (termination status) và các thống kê sử dụng tài nguyên (Mục 36.1).

Đối với các tiến trình thây ma, hệ thống UNIX bắt chước các bộ phim — một tiến trình zombie không thể bị tiêu diệt bởi một tín hiệu (signal), thậm chí không thể dùng viên đạn bạc `SIGKILL`. Điều này đảm bảo rằng tiến trình cha luôn có thể thực hiện hàm `wait()` vào một thời điểm nào đó.

Khi tiến trình cha thực hiện `wait()`, kernel sẽ xóa tiến trình zombie, vì thông tin cuối cùng còn lại về tiến trình con không còn cần thiết nữa. Mặt khác, nếu tiến trình cha kết thúc mà không thực hiện `wait()`, thì tiến trình `init` sẽ nhận nuôi tiến trình con đó và tự động thực hiện `wait()`, qua đó loại bỏ tiến trình zombie khỏi hệ thống.

Nếu một tiến trình cha tạo ra một tiến trình con, nhưng không thực hiện hàm `wait()`, thì một mục dành cho tiến trình con zombie sẽ được duy trì vô thời hạn trong bảng tiến trình của kernel. Nếu một số lượng lớn các tiến trình con zombie như vậy được tạo ra, chúng cuối cùng sẽ làm đầy bảng tiến trình của kernel, ngăn cản việc tạo ra các tiến trình mới. Vì các tiến trình zombie không thể bị tiêu diệt bằng tín hiệu, cách duy nhất để loại bỏ chúng khỏi hệ thống là tiêu diệt tiến trình cha của chúng (hoặc đợi tiến trình cha thoát), lúc đó các tiến trình zombie sẽ được `init` nhận nuôi và thực hiện `wait()`, và do đó sẽ bị xóa khỏi hệ thống.

Ngữ nghĩa này có ý nghĩa quan trọng đối với việc thiết kế các tiến trình cha có vòng đời dài (long-lived parent processes), chẳng hạn như các máy chủ mạng (network servers) và shell, tạo ra nhiều tiến trình con. Nói cách khác, trong các ứng dụng như vậy, tiến trình cha nên thực hiện các lời gọi `wait()` để đảm bảo rằng các tiến trình con đã chết luôn bị xóa khỏi hệ thống, thay vì trở thành các tiến trình zombie tồn tại lâu dài. Tiến trình cha có thể thực hiện các lời gọi `wait()` này một cách đồng bộ (synchronously) hoặc bất đồng bộ (asynchronously), để phản hồi lại việc phân phối tín hiệu `SIGCHLD`, như được mô tả trong Mục [26.3.1.](#page-42-0)

[Liệt kê 26-4](#page-41-0) minh họa việc tạo ra một tiến trình zombie và việc tiến trình zombie không thể bị tiêu diệt bởi `SIGKILL`. Khi chúng ta chạy chương trình này, chúng ta thấy kết quả đầu ra sau:

```
$ ./make_zombie
Parent PID=1013
Child (PID=1014) exiting
 1013 pts/4 00:00:00 make_zombie Output from ps(1)
 1014 pts/4 00:00:00 make_zombie <defunct>
After sending SIGKILL to make_zombie (PID=1014):
 1013 pts/4 00:00:00 make_zombie Output from ps(1)
 1014 pts/4 00:00:00 make_zombie <defunct>
```

Trong phần đầu ra ở trên, chúng ta thấy rằng `ps(1)` hiển thị chuỗi `<defunct>` để chỉ ra một tiến trình ở trạng thái zombie.

> [!NOTE]
> Chương trình trong [Liệt kê 26-4](#page-41-0) sử dụng hàm `system()` để thực thi lệnh shell được cung cấp trong đối số chuỗi ký tự (character-string argument) của nó. Chúng ta sẽ mô tả chi tiết về `system()` trong Mục [27.6](#page-66-0).

**Liệt kê 26-4:** Tạo một tiến trình con zombie

```c
–––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/make_zombie.c
## include <signal.h>
## include <libgen.h> /* For basename() declaration */
## include "tlpi_hdr.h"
## define CMD_SIZE 200
int
main(int argc, char *argv[])
{
 char cmd[CMD_SIZE];
 pid_t childPid;
 setbuf(stdout, NULL); /* Disable buffering of stdout */
 printf("Parent PID=%ld\n", (long) getpid());
 switch (childPid = fork()) {
 case -1:
 errExit("fork");
 case 0: /* Child: immediately exits to become zombie */
 printf("Child (PID=%ld) exiting\n", (long) getpid());
 _exit(EXIT_SUCCESS);
 default: /* Parent */
 sleep(3); /* Give child a chance to start and exit */
 snprintf(cmd, CMD_SIZE, "ps | grep %s", basename(argv[0]));
 cmd[CMD_SIZE - 1] = '\0'; /* Ensure string is null-terminated */
 system(cmd); /* View zombie child */
 /* Now send the "sure kill" signal to the zombie */
 if (kill(childPid, SIGKILL) == -1)
 errMsg("kill");
 sleep(3); /* Give child a chance to react to signal */
 printf("After sending SIGKILL to zombie (PID=%ld):\n", (long) childPid);
 system(cmd); /* View zombie child again */
 exit(EXIT_SUCCESS);
 }
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/make_zombie.c
```

## 26.3 Tín hiệu SIGCHLD

Việc chấm dứt (termination) của một tiến trình con (child process) là một sự kiện xảy ra một cách bất đồng bộ (asynchronously). Tiến trình cha (parent process) không thể dự đoán được khi nào một trong các tiến trình con của nó sẽ kết thúc. (Ngay cả khi tiến trình cha gửi tín hiệu SIGKILL tới tiến trình con, thời điểm kết thúc chính xác vẫn phụ thuộc vào thời điểm tiến trình con được lập lịch [scheduled] sử dụng CPU lần tiếp theo). Chúng ta đã thấy rằng tiến trình cha nên sử dụng hàm wait() (hoặc tương tự) để ngăn chặn sự tích tụ của các tiến trình con thây ma (zombie children), và đã xem xét hai cách có thể thực hiện điều này:

- Tiến trình cha có thể gọi wait(), hoặc waitpid() mà không chỉ định cờ WNOHANG, trong trường hợp này lời gọi hàm sẽ bị chặn (block) nếu tiến trình con chưa kết thúc.
- Tiến trình cha có thể định kỳ thực hiện việc kiểm tra không chặn (thăm dò - poll) các tiến trình con đã chết thông qua lời gọi hàm waitpid() với cờ WNOHANG được chỉ định.

Cả hai cách tiếp cận này đều có thể gây bất tiện. Một mặt, chúng ta có thể không muốn tiến trình cha bị chặn (block) khi chờ tiến trình con kết thúc. Mặt khác, việc liên tục gọi waitpid() không chặn sẽ làm lãng phí thời gian CPU và làm tăng độ phức tạp cho thiết kế ứng dụng. Để giải quyết những vấn đề này, chúng ta có thể sử dụng một trình xử lý tín hiệu (signal handler) cho tín hiệu SIGCHLD.

### 26.3.1 Thiết lập một Trình xử lý cho SIGCHLD

Tín hiệu SIGCHLD được gửi đến một tiến trình cha bất cứ khi nào một trong các tiến trình con của nó kết thúc. Theo mặc định, tín hiệu này bị bỏ qua, nhưng chúng ta có thể bắt nó bằng cách cài đặt một signal handler. Bên trong signal handler, chúng ta có thể sử dụng wait() (hoặc tương tự) để thu gom (reap) tiến trình con zombie. Tuy nhiên, có một điểm tế nhị cần lưu ý trong cách tiếp cận này.

Trong Mục 20.10 và 20.12, chúng ta đã quan sát thấy rằng khi một signal handler được gọi, tín hiệu gây ra lệnh gọi đó sẽ tạm thời bị chặn (trừ khi cờ sigaction() SA_NODEFER được chỉ định), và các tín hiệu chuẩn (standard signals), trong đó SIGCHLD là một ví dụ, sẽ không được đưa vào hàng đợi (queued). Do đó, nếu tiến trình con thứ hai và thứ ba kết thúc trong thời gian ngắn liên tiếp trong khi signal handler của SIGCHLD đang thực thi cho một tiến trình con đã kết thúc trước đó, thì mặc dù SIGCHLD được tạo ra hai lần, nó chỉ được đưa vào hàng đợi một lần cho tiến trình cha. Kết quả là, nếu signal handler SIGCHLD của tiến trình cha chỉ gọi wait() một lần mỗi khi nó được gọi, handler đó có thể không thu gom hết một số tiến trình con zombie.

Giải pháp là tạo một vòng lặp bên trong signal handler SIGCHLD, liên tục gọi waitpid() với cờ WNOHANG cho đến khi không còn tiến trình con đã chết nào cần thu gom. Thường thì phần thân của một SIGCHLD handler chỉ đơn giản bao gồm đoạn mã sau, dùng để thu gom bất kỳ tiến trình con đã chết nào mà không cần kiểm tra trạng thái của chúng:

```c
while (waitpid(-1, NULL, WNOHANG) > 0)
 continue;
```

Vòng lặp trên tiếp tục cho đến khi waitpid() trả về 0 (cho biết không còn tiến trình con zombie nào nữa) hoặc –1 (cho biết có lỗi xảy ra, có thể là ECHILD, nghĩa là không còn tiến trình con nào).

### Các vấn đề thiết kế đối với các SIGCHLD handler

Giả sử rằng, tại thời điểm chúng ta thiết lập một handler cho SIGCHLD, đã có sẵn một tiến trình con bị chấm dứt dành cho tiến trình này. Liệu kernel có ngay lập tức tạo ra một tín hiệu SIGCHLD cho tiến trình cha hay không? Tiêu chuẩn SUSv3 không nêu rõ điểm này. Một số triển khai bắt nguồn từ System V có tạo ra SIGCHLD trong những trường hợp này; các triển khai khác, bao gồm cả Linux, thì không. Một ứng dụng có tính di động (portable application) có thể làm cho sự khác biệt này trở nên vô hình bằng cách thiết lập SIGCHLD handler trước khi tạo bất kỳ tiến trình con nào. (Tất nhiên, đây thường là cách tiếp cận tự nhiên nhất).

Một điểm cần xem xét thêm là vấn đề tính tái nhập (reentrancy). Trong Mục 21.1.2, chúng ta đã lưu ý rằng việc sử dụng một System Call (ví dụ: waitpid()) từ bên trong một signal handler có thể làm thay đổi giá trị của biến toàn cục errno. Sự thay đổi như vậy có thể gây cản trở cho các nỗ lực của chương trình chính trong việc thiết lập rõ ràng biến errno (xem, ví dụ, thảo luận về getpriority() trong Mục 35.1) hoặc kiểm tra giá trị của nó sau một System Call thất bại. Vì lý do này, đôi khi cần phải lập trình SIGCHLD handler để lưu errno vào một biến cục bộ ngay khi vào handler, và sau đó khôi phục lại giá trị errno ngay trước khi trả về (return). Một ví dụ về điều này được thể hiện trong [Listing 26-5](#page-44-0).

### Chương trình ví dụ

[Listing 26-5](#page-44-0) cung cấp một ví dụ về hàm xử lý tín hiệu (signal handler) SIGCHLD phức tạp hơn. Trình xử lý này hiển thị ID tiến trình (Process ID - PID) và trạng thái chờ (wait status) của mỗi tiến trình con q đã được thu gom (reaped). Để thấy rằng nhiều tín hiệu SIGCHLD không được đưa vào hàng đợi (queued) trong khi trình xử lý đang thực thi, thời gian chạy của trình xử lý bị kéo dài nhân tạo bằng một lời gọi hàm sleep() w. Chương trình chính tạo ra một tiến trình con cho mỗi đối số dòng lệnh (integer) r. Mỗi tiến trình con này sẽ ngủ (sleep) trong số giây được chỉ định bởi đối số dòng lệnh tương ứng và sau đó thoát t. Trong ví dụ thực thi chương trình sau đây, chúng ta thấy rằng mặc dù có ba tiến trình con chấm dứt, SIGCHLD chỉ được đưa vào hàng đợi hai lần đối với tiến trình cha:

```
$ ./multi_SIGCHLD 1 2 4
16:45:18 Child 1 (PID=17767) exiting
16:45:18 handler: Caught SIGCHLD First invocation of handler
16:45:18 handler: Reaped child 17767 - child exited, status=0
```

```
16:45:19 Child 2 (PID=17768) exiting These children terminate during…
16:45:21 Child 3 (PID=17769) exiting first invocation of handler
16:45:23 handler: returning End of first invocation of handler
16:45:23 handler: Caught SIGCHLD Second invocation of handler
16:45:23 handler: Reaped child 17768 - child exited, status=0
16:45:23 handler: Reaped child 17769 - child exited, status=0
16:45:28 handler: returning
16:45:28 All 3 children have terminated; SIGCHLD was caught 2 times
```

Lưu ý việc sử dụng sigprocmask() để chặn (block) tín hiệu SIGCHLD trước khi bất kỳ tiến trình con nào được tạo trong [Listing 26-5](#page-44-0) e. Điều này được thực hiện để đảm bảo hoạt động chính xác của vòng lặp sigsuspend() ở tiến trình cha. Nếu chúng ta không chặn SIGCHLD theo cách này, và một tiến trình con chấm dứt trong khoảng thời gian giữa việc kiểm tra giá trị của numLiveChildren và việc thực thi lời gọi sigsuspend() (hoặc thay thế bằng lời gọi pause()), thì lời gọi sigsuspend() sẽ bị chặn vĩnh viễn (block forever) để chờ một tín hiệu đã được bắt y. Yêu cầu để xử lý loại tình trạng tranh chấp (race condition) này đã được trình bày chi tiết trong Mục 22.9.

**Listing 26-5:** Thu gom các tiến trình con đã chết thông qua trình xử lý cho SIGCHLD

```
–––––––––––––––––––––––––––––––––––––––––––––––––– procexec/multi_SIGCHLD.c
## include <signal.h>
## include <sys/wait.h>
## include "print_wait_status.h"
## include "curr_time.h"
## include "tlpi_hdr.h"
  static volatile int numLiveChildren = 0;
   /* Số lượng tiến trình con đã khởi động nhưng chưa được thu gom */
  static void
  sigchldHandler(int sig)
  {
   int status, savedErrno;
   pid_t childPid;
   /* KHÔNG AN TOÀN: Trình xử lý này sử dụng các hàm không an toàn với tín hiệu bất đồng bộ
   (non-async-signal-safe functions) (printf(), printWaitStatus(), currTime(); xem Mục 21.1.2) */
   savedErrno = errno; /* Trong trường hợp chúng ta sửa đổi 'errno' */
   printf("%s handler: Caught SIGCHLD\n", currTime("%T"));
   while ((childPid = waitpid(-1, &status, WNOHANG)) > 0) {
q printf("%s handler: Reaped child %ld - ", currTime("%T"),
   (long) childPid);
   printWaitStatus(NULL, status);
   numLiveChildren--;
   }
   if (childPid == -1 && errno != ECHILD)
   errMsg("waitpid");
```

```
w sleep(5); /* Kéo dài thời gian thực thi của trình xử lý một cách nhân tạo */
   printf("%s handler: returning\n", currTime("%T"));
   errno = savedErrno;
  }
  int
  main(int argc, char *argv[])
  {
   int j, sigCnt;
   sigset_t blockMask, emptyMask;
   struct sigaction sa;
   if (argc < 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s child-sleep-time...\n", argv[0]);
   setbuf(stdout, NULL); /* Vô hiệu hóa đệm (buffering) của stdout */
   sigCnt = 0;
   numLiveChildren = argc - 1;
   sigemptyset(&sa.sa_mask);
   sa.sa_flags = 0;
   sa.sa_handler = sigchldHandler;
   if (sigaction(SIGCHLD, &sa, NULL) == -1)
   errExit("sigaction");
   /* Chặn SIGCHLD để ngăn việc gửi tín hiệu nếu một tiến trình con kết thúc
   trước khi tiến trình cha bắt đầu vòng lặp sigsuspend() bên dưới */
   sigemptyset(&blockMask);
   sigaddset(&blockMask, SIGCHLD);
e if (sigprocmask(SIG_SETMASK, &blockMask, NULL) == -1)
   errExit("sigprocmask");
r for (j = 1; j < argc; j++) {
   switch (fork()) {
   case -1:
   errExit("fork");
   case 0: /* Tiến trình con - ngủ và sau đó thoát */
t sleep(getInt(argv[j], GN_NONNEG, "child-sleep-time"));
   printf("%s Child %d (PID=%ld) exiting\n", currTime("%T"),
   j, (long) getpid());
   _exit(EXIT_SUCCESS);
   default: /* Tiến trình cha - lặp để tạo tiến trình con tiếp theo */
   break;
   }
   }
```

```
 /* Tiến trình cha đến đây: chờ SIGCHLD cho đến khi tất cả tiến trình con đã chết */
   sigemptyset(&emptyMask);
   while (numLiveChildren > 0) {
y if (sigsuspend(&emptyMask) == -1 && errno != EINTR)
   errExit("sigsuspend");
   sigCnt++;
   }
   printf("%s All %d children have terminated; SIGCHLD was caught "
   "%d times\n", currTime("%T"), argc - 1, sigCnt);
   exit(EXIT_SUCCESS);
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––– procexec/multi_SIGCHLD.c
```

### 26.3.2 Giao dịch (Delivery) SIGCHLD cho các Tiến trình con bị Dừng

Cũng giống như `waitpid()` có thể được sử dụng để theo dõi các tiến trình con bị dừng (stopped children), tiến trình cha (parent process) hoàn toàn có thể nhận được tín hiệu (signal) `SIGCHLD` khi một trong các tiến trình con của nó bị dừng bởi một signal. Hành vi này được điều khiển bởi cờ `SA_NOCLDSTOP` khi sử dụng `sigaction()` để thiết lập một trình xử lý (handler) cho signal `SIGCHLD`. Nếu cờ này bị bỏ qua, một signal `SIGCHLD` sẽ được gửi đến tiến trình cha khi một trong các tiến trình con của nó dừng lại; nếu cờ này được bật, `SIGCHLD` sẽ không được gửi đối với các tiến trình con bị dừng. (Việc cài đặt `signal()` được trình bày trong Mục 22.7 không chỉ định `SA_NOCLDSTOP`.)

> [!NOTE]
> Vì `SIGCHLD` bị bỏ qua theo mặc định (ignored by default), cờ `SA_NOCLDSTOP` chỉ có ý nghĩa khi chúng ta đang thiết lập một handler cho `SIGCHLD`. Hơn nữa, `SIGCHLD` là signal duy nhất mà cờ `SA_NOCLDSTOP` có tác dụng.

SUSv3 cũng cho phép tiến trình cha được gửi signal `SIGCHLD` nếu một trong các tiến trình con bị dừng của nó được tiếp tục chạy (resumed) bằng cách nhận được signal `SIGCONT`. (Điều này tương ứng với cờ `WCONTINUED` trong `waitpid()`.) Tính năng này đã được cài đặt trong Linux kể từ phiên bản kernel 2.6.9.

### 26.3.3 Bỏ qua các Tiến trình con đã Chết (Dead Child Processes)

Có một khả năng khác để xử lý các tiến trình con đã chết. Việc thiết lập tường minh hành vi xử lý (disposition) của `SIGCHLD` thành `SIG_IGN` sẽ khiến bất kỳ tiến trình con nào chấm dứt (terminates) sau đó bị xóa ngay lập tức khỏi hệ thống thay vì bị biến thành tiến trình thây ma (zombie). Trong trường hợp này, vì trạng thái của tiến trình con bị loại bỏ hoàn toàn, một lời gọi tiếp theo tới `wait()` (hoặc tương tự) sẽ không thể trả về bất kỳ thông tin nào cho tiến trình con đã kết thúc đó.

> [!NOTE]
> Lưu ý rằng mặc dù hành vi mặc định đối với `SIGCHLD` là bị bỏ qua, việc thiết lập tường minh disposition thành `SIG_IGN` lại gây ra hành vi khác biệt được mô tả ở đây. Về mặt này, `SIGCHLD` được xử lý một cách đặc biệt so với các signal khác.

Trên Linux, cũng như trên nhiều hệ thống cài đặt UNIX, việc thiết lập disposition của `SIGCHLD` thành `SIG_IGN` không làm ảnh hưởng đến trạng thái của bất kỳ tiến trình con zombie nào đang tồn tại, vốn vẫn phải được chờ (wait upon) bằng cách thông thường. Trên một số hệ thống cài đặt UNIX khác (ví dụ: Solaris 8), việc thiết lập disposition của `SIGCHLD` thành `SIG_IGN` sẽ thực sự loại bỏ các tiến trình con zombie hiện có.

Ngữ nghĩa của `SIG_IGN` đối với `SIGCHLD` có lịch sử lâu đời, bắt nguồn từ System V. SUSv3 quy định hành vi được mô tả ở đây, nhưng những ngữ nghĩa này không được chỉ định rõ trong chuẩn POSIX.1 gốc. Do đó, trên một số hệ thống cài đặt UNIX cũ hơn, việc bỏ qua `SIGCHLD` không có tác dụng gì đối với việc tạo ra các zombie. Cách duy nhất hoàn toàn tương thích (portable) để ngăn chặn việc tạo ra zombie là gọi `wait()` hoặc `waitpid()`, có thể được gọi từ bên trong một handler được thiết lập cho `SIGCHLD`.

### Các điểm không tuân thủ SUSv3 trong các phiên bản Linux kernel cũ

SUSv3 quy định rằng nếu cơ chế xử lý (disposition) của tín hiệu `SIGCHLD` được thiết lập thành `SIG_IGN`, thông tin sử dụng tài nguyên của tiến trình con (child process) phải bị loại bỏ và không được đưa vào tổng số liệu trả về khi tiến trình cha (parent process) gọi hàm `getrusage()` với cờ `RUSAGE_CHILDREN` (Mục 36.1). Tuy nhiên, trên các phiên bản Linux trước kernel 2.6.9, thời gian CPU và các tài nguyên mà tiến trình con sử dụng vẫn được ghi nhận và hiển thị trong các lệnh gọi `getrusage()`. Sự không tuân thủ này đã được khắc phục từ phiên bản Linux 2.6.9 trở đi.

> [!NOTE]
> Việc thiết lập cơ chế xử lý của `SIGCHLD` thành `SIG_IGN` cũng đồng thời ngăn chặn thời gian CPU của tiến trình con không bị đưa vào cấu trúc do hàm `times()` trả về (Mục 10.7). Tuy nhiên, trên các Linux kernel trước phiên bản 2.6.9, một sự không tuân thủ tương tự cũng xảy ra đối với thông tin do `times()` trả về.

SUSv3 quy định rằng nếu cơ chế xử lý của `SIGCHLD` được đặt thành `SIG_IGN`, và tiến trình cha không có tiến trình con nào đã kết thúc mà biến thành trạng thái thây ma (zombie) nhưng chưa được thu hồi (wait for), thì lệnh gọi `wait()` (hoặc `waitpid()`) phải chặn (block) cho đến khi tất cả các tiến trình con của tiến trình cha đã kết thúc. Tại thời điểm đó, lệnh gọi sẽ kết thúc với mã lỗi `ECHILD`. Linux 2.6 tuân thủ yêu cầu này. Tuy nhiên, trong Linux 2.4 và các phiên bản trước đó, `wait()` chỉ chặn cho đến khi tiến trình con tiếp theo kết thúc, sau đó trả về ID tiến trình (process ID) và trạng thái của tiến trình con đó (tức là hành vi hoàn toàn giống như khi cơ chế xử lý của `SIGCHLD` không được đặt thành `SIG_IGN`).

### Cờ SA_NOCLDWAIT của sigaction()

SUSv3 quy định cờ `SA_NOCLDWAIT`, có thể được sử dụng khi thiết lập cơ chế xử lý cho tín hiệu `SIGCHLD` bằng hàm `sigaction()`. Cờ này tạo ra hành vi tương tự như khi cơ chế xử lý của `SIGCHLD` được đặt thành `SIG_IGN`. Cờ này chưa được triển khai trong Linux 2.4 và các phiên bản trước đó, nhưng đã được hỗ trợ trong Linux 2.6.

Sự khác biệt chính giữa việc thiết lập cơ chế xử lý của `SIGCHLD` thành `SIG_IGN` và sử dụng `SA_NOCLDWAIT` là khi thiết lập một trình xử lý (handler) với `SA_NOCLDWAIT`, SUSv3 không quy định rõ việc tín hiệu `SIGCHLD` có được gửi đến tiến trình cha hay không khi một tiến trình con kết thúc. Nói cách khác, một hệ thống (implementation) được phép gửi `SIGCHLD` khi chỉ định `SA_NOCLDWAIT`, và một ứng dụng có thể bắt (catch) tín hiệu này (mặc dù trình xử lý `SIGCHLD` sẽ không thể thu hồi trạng thái tiến trình con bằng cách sử dụng `wait()`, do kernel đã loại bỏ trạng thái zombie rồi). Trên một số hệ thống UNIX, bao gồm cả Linux, kernel có tạo ra tín hiệu `SIGCHLD` cho tiến trình cha. Trên các hệ thống UNIX khác, `SIGCHLD` không được tạo ra.

> [!NOTE]
> Khi thiết lập cờ `SA_NOCLDWAIT` cho tín hiệu `SIGCHLD`, các phiên bản Linux kernel cũ cũng thể hiện các chi tiết không tuân thủ SUSv3 giống như đã mô tả ở trên đối với việc thiết lập cơ chế xử lý của `SIGCHLD` thành `SIG_IGN`.

### Tín hiệu SIGCLD của System V

Trên Linux, tên gọi `SIGCLD` được cung cấp như một từ đồng nghĩa (synonym) cho tín hiệu `SIGCHLD`. Lý do tồn tại của cả hai tên gọi này mang tính lịch sử. Tín hiệu `SIGCHLD` có nguồn gốc từ BSD, và tên gọi này đã được POSIX thông qua, phần lớn chuẩn hóa theo mô hình tín hiệu của BSD. System V cung cấp tín hiệu `SIGCLD` tương ứng, với ngữ nghĩa có phần khác biệt đôi chút.

Sự khác biệt cốt lõi giữa `SIGCHLD` của BSD và `SIGCLD` của System V nằm ở những gì xảy ra khi cơ chế xử lý của tín hiệu được đặt thành `SIG_IGN`:

- Trên các hệ thống BSD lịch sử (và một số hệ thống hiện đại), hệ thống vẫn tiếp tục tạo ra các tiến trình zombie cho các tiến trình con chưa được thu hồi (`unwaited-for children`), ngay cả khi `SIGCHLD` bị bỏ qua (ignored).
- Trên System V, việc sử dụng `signal()` (nhưng không phải `sigaction()`) để bỏ qua `SIGCLD` sẽ dẫn đến kết quả là các tiến trình zombie không được tạo ra khi tiến trình con chết.

Như đã lưu ý, tiêu chuẩn POSIX.1 ban đầu không quy định rõ kết quả của việc bỏ qua `SIGCHLD`, do đó cho phép hành vi của System V. Ngày nay, hành vi System V này được quy định như một phần của SUSv3 (mặc dù vẫn giữ tên gọi là `SIGCHLD`). Các hệ thống dẫn xuất từ System V hiện đại sử dụng tên chuẩn `SIGCHLD` cho tín hiệu này, nhưng vẫn tiếp tục cung cấp tên đồng nghĩa `SIGCLD`. Các chi tiết bổ sung về `SIGCLD` có thể được tìm thấy trong [Stevens & Rago, 2005].

## 26.4 Tóm tắt

Bằng cách sử dụng `wait()` và `waitpid()` (và các hàm liên quan khác), tiến trình cha (parent process) có thể lấy được trạng thái của các tiến trình con đã kết thúc hoặc bị dừng. Trạng thái này cho biết liệu một tiến trình con kết thúc bình thường (với trạng thái thoát cho biết thành công hay thất bại), kết thúc bất thường, bị dừng bởi một tín hiệu (signal), hay được tiếp tục chạy lại bởi tín hiệu `SIGCONT`.

Nếu tiến trình cha của một tiến trình con kết thúc, tiến trình con đó trở thành tiến trình mồ côi (orphan) và được nhận nuôi bởi tiến trình `init`, có định danh tiến trình (Process ID - PID) là 1.

Khi một tiến trình con kết thúc, nó trở thành một tiến trình thây ma (zombie) và chỉ bị xóa khỏi hệ thống khi tiến trình cha của nó gọi `wait()` (hoặc hàm tương tự) để lấy trạng thái của tiến trình con. Các chương trình chạy lâu dài như shell và daemon nên được thiết kế sao cho chúng luôn thu hồi (reap) trạng thái của các tiến trình con do chúng tạo ra, vì một tiến trình ở trạng thái zombie không thể bị tiêu diệt (kill), và các zombie không được thu hồi cuối cùng sẽ làm nghẽn bảng tiến trình của kernel (kernel process table).

Một cách phổ biến để thu hồi các tiến trình con đã chết là thiết lập một hàm xử lý (handler) cho tín hiệu `SIGCHLD`. Tín hiệu này được gửi đến tiến trình cha bất cứ khi nào một trong các tiến trình con của nó kết thúc, và tùy chọn khi một tiến trình con bị dừng bởi một tín hiệu. Ngoài ra, nhưng ít tính di động (portable) hơn một chút, một tiến trình có thể chọn thiết lập hành vi (disposition) của `SIGCHLD` thành `SIG_IGN`, trong trường hợp đó, trạng thái của các tiến trình con kết thúc sẽ bị hủy bỏ ngay lập tức (do đó tiến trình cha không thể lấy lại sau này) và các tiến trình con sẽ không biến thành zombie.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê trong Mục [24.6](#page-16-0).

## 26.5 Bài tập

- **26-1.** Viết một chương trình để xác minh rằng khi tiến trình cha của một tiến trình con kết thúc, lời gọi `getppid()` sẽ trả về 1 (Process ID của `init`).
- **26-2.** Giả sử chúng ta có ba tiến trình có quan hệ là ông bà (grandparent), cha (parent) và con (child), và tiến trình ông bà không thực hiện `wait()` ngay lập tức sau khi tiến trình cha thoát, khiến tiến trình cha trở thành zombie. Bạn kỳ vọng tiến trình cháu sẽ được `init` nhận nuôi khi nào (để hàm `getppid()` trong tiến trình cháu trả về 1): sau khi tiến trình cha kết thúc hay sau khi tiến trình ông bà thực hiện `wait()`? Viết chương trình để kiểm chứng câu trả lời của bạn.
- **26-3.** Thay thế việc sử dụng `waitpid()` bằng `waitid()` trong Liệt kê 26-3 (`child_status.c`). Lời gọi `printWaitStatus()` sẽ cần được thay thế bằng đoạn mã in ra các trường có liên quan từ cấu trúc `siginfo_t` được trả về bởi `waitid()`.
- **26-4.** [Liệt kê 26-4](#page-41-0) (`make_zombie.c`) sử dụng lời gọi `sleep()` để cho phép tiến trình con có cơ hội thực thi và kết thúc trước khi tiến trình cha thực thi `system()`. Cách tiếp cận này tạo ra một điều kiện tranh chấp (race condition) về mặt lý thuyết. Hãy sửa đổi chương trình để loại bỏ điều kiện tranh chấp bằng cách sử dụng các tín hiệu để đồng bộ hóa (synchronize) tiến trình cha và tiến trình con.
