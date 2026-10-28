# Chương 23: Bộ định thời và Trạng thái ngủ (Timers and Sleeping)

Bộ định thời (timer) cho phép một tiến trình (process) lên lịch thông báo cho chính nó xảy ra tại một thời điểm nào đó trong tương lai. Trạng thái ngủ (sleeping) cho phép một tiến trình (hoặc luồng - thread) tạm dừng thực thi trong một khoảng thời gian. Chương trình này mô tả các giao diện (interface) được sử dụng để thiết lập bộ định thời và chuyển sang trạng thái ngủ. Nó bao gồm các chủ đề sau:

- các API UNIX cổ điển để thiết lập bộ định thời khoảng thời gian (interval timer) (`setitimer()` và `alarm()`) nhằm thông báo cho tiến trình khi một lượng thời gian nhất định đã trôi qua;
- các API cho phép một tiến trình ngủ trong một khoảng thời gian được chỉ định;
- các API đồng hồ và bộ định thời chuẩn POSIX.1b; và
- tiện ích `timerfd` đặc thù của Linux, cho phép tạo các bộ định thời mà việc hết hạn của chúng có thể được đọc từ một bộ mô tả tệp (File Descriptor).

## 23.1 Bộ định thời khoảng thời gian (Interval Timers)

System Call `setitimer()` thiết lập một bộ định thời khoảng thời gian, là một bộ định thời sẽ hết hạn vào một thời điểm trong tương lai và (tùy chọn) theo các khoảng thời gian đều đặn sau đó.

## include <sys/time.h>

int setitimer(int which, const struct itimerval *new_value,
struct itimerval *old_value);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Sử dụng `setitimer()`, một tiến trình có thể thiết lập ba loại bộ định thời khác nhau bằng cách chỉ định tham số `which` là một trong các giá trị sau:

### ITIMER\_REAL

Tạo một bộ định thời đếm ngược theo thời gian thực (tức là thời gian theo đồng hồ treo tường - wall clock). Khi bộ định thời hết hạn, một tín hiệu (signal) `SIGALRM` được tạo ra cho tiến trình.

### ITIMER\_VIRTUAL

Tạo một bộ định thời đếm ngược theo thời gian ảo của tiến trình (tức là thời gian CPU ở chế độ người dùng - user-mode CPU time). Khi bộ định thời hết hạn, một tín hiệu `SIGVTALRM` được tạo ra cho tiến trình.

### ITIMER\_PROF

Tạo một bộ định thời cấu hình hiệu năng (profiling timer). Bộ định thời cấu hình đếm theo thời gian tiến trình (tức là tổng của cả thời gian CPU ở chế độ người dùng và chế độ nhân - kernel-mode CPU time). Khi bộ định thời hết hạn, một tín hiệu `SIGPROF` được tạo ra cho tiến trình.

Hành vi mặc định (default disposition) của tất cả các tín hiệu bộ định thời là chấm dứt tiến trình. Trừ khi đây là kết quả mong muốn, chúng ta phải thiết lập một trình xử lý (handler) cho tín hiệu do bộ định thời gửi đến.

Các tham số `new_value` và `old_value` là con trỏ trỏ đến các cấu trúc `itimerval`, được định nghĩa như sau:

```

struct itimerval {
struct timeval it_interval; /* Khoảng thời gian cho bộ định thời định kỳ */
struct timeval it_value; /* Giá trị hiện tại (thời gian cho đến khi
lần hết hạn tiếp theo) */
};

```

Mỗi trường trong cấu trúc `itimerval` lại là một cấu trúc có kiểu `timeval`, chứa các trường giây và micrô-giây:

```

struct timeval {
time_t tv_sec; /* Giây */
suseconds_t tv_usec; /* Micrô-giây (long int) */
};

```

Cấu trúc con `it_value` của tham số `new_value` chỉ định khoảng thời gian trễ cho đến khi bộ định thời hết hạn. Cấu trúc con `it_interval` chỉ định đây có phải là một bộ định thời định kỳ hay không. Nếu cả hai trường của `it_interval` được đặt thành 0, thì bộ định thời chỉ hết hạn một lần duy nhất, tại thời điểm được chỉ định bởi `it_value`. Nếu một hoặc cả hai trường của `it_interval` khác 0, thì sau mỗi lần bộ định thời hết hạn, nó sẽ được thiết lập lại để tiếp tục hết hạn theo khoảng thời gian đã chỉ định.

Một tiến trình chỉ có duy nhất một bộ định thời cho mỗi loại trong số ba loại. Nếu chúng ta gọi `setitimer()` lần thứ hai, nó sẽ thay đổi các đặc tính của bất kỳ bộ định thời hiện có nào tương ứng với giá trị `which`. Nếu chúng ta gọi `setitimer()` với cả hai trường của `new_value.it_value` được đặt thành 0, thì bất kỳ bộ định thời hiện có nào sẽ bị vô hiệu hóa.

Nếu `old_value` không phải là `NULL`, thì nó trỏ đến một cấu trúc `itimerval` được sử dụng để trả về giá trị trước đó của bộ định thời. Nếu cả hai trường của `old_value.it_value` bằng 0, điều đó có nghĩa là bộ định thời trước đó đã bị vô hiệu hóa. Nếu cả hai trường của `old_value.it_interval` bằng 0, bộ định thời trước đó được đặt để hết hạn một lần duy nhất, tại thời điểm được cho bởi `old_value.it_value`. Việc truy xuất các thiết lập trước đó của bộ định thời có thể hữu ích nếu chúng ta muốn khôi phục lại các thiết lập sau khi bộ định thời mới đã hết hạn. Nếu chúng ta không quan tâm đến giá trị trước đó của bộ định thời, chúng ta có thể truyền `old_value` là `NULL`.

Khi một bộ định thời hoạt động, nó đếm ngược từ giá trị ban đầu (`it_value`) về 0. Khi bộ định thời đạt đến 0, tín hiệu tương ứng sẽ được gửi đến tiến trình, và sau đó, nếu khoảng thời gian (`it_interval`) khác 0, giá trị của bộ định thời (`it_value`) sẽ được nạp lại và quá trình đếm ngược về 0 lại bắt đầu.

Tại bất kỳ thời điểm nào, chúng ta có thể sử dụng `getitimer()` để truy xuất trạng thái hiện tại của bộ định thời nhằm xem còn lại bao nhiêu thời gian trước khi nó hết hạn lần tiếp theo.

## include <sys/time.h>
int getitimer(int which, struct itimerval *curr_value);
                                            Trả về 0 khi thành công, hoặc –1 khi lỗi
```

System Call `getitimer()` trả về trạng thái hiện tại của bộ định thời được chỉ định bởi `which`, vào vùng đệm được trỏ bởi `curr_value`. Đây chính xác là thông tin giống như được trả về thông qua tham số `old_value` của `setitimer()`, với điểm khác biệt là chúng ta không cần phải thay đổi các thiết lập của bộ định thời để truy xuất thông tin đó. Cấu trúc con `curr_value.it_value` trả về lượng thời gian còn lại cho đến khi bộ định thời hết hạn lần tiếp theo. Giá trị này thay đổi khi bộ định thời đếm ngược và được thiết lập lại khi bộ định thời hết hạn nếu một giá trị `it_interval` khác 0 đã được chỉ định khi thiết lập bộ định thời. Cấu trúc con `curr_value.it_interval` trả về khoảng thời gian cho bộ định thời này; giá trị này giữ nguyên không đổi cho đến một lần gọi `setitimer()` tiếp theo.

Các bộ định thời (timer) được thiết lập bằng `setitimer()` (và `alarm()`, mà chúng ta sẽ thảo luận ngắn gọn sau đây) được bảo toàn qua hàm `exec()`, nhưng không được kế thừa bởi tiến trình con (child process) được tạo ra bởi `fork()`.

> [!NOTE]
> SUSv4 đánh dấu `getitimer()` và `setitimer()` là đã lỗi thời (obsolete), và lưu ý rằng API bộ định thời POSIX (Mục [23.6](#page-16-0)) được ưu tiên sử dụng hơn.

### Chương trình ví dụ

[Liệt kê 23-1](#page-3-0) minh họa cách sử dụng `setitimer()` và `getitimer()`. Chương trình này thực hiện các bước sau:

- Thiết lập một trình xử lý (handler) cho tín hiệu (signal) `SIGALRM` e.
- Đặt các trường giá trị (value) và khoảng thời gian (interval) cho một bộ định thời thực (real timer) (`ITIMER_REAL`) bằng cách sử dụng các giá trị được cung cấp trong các đối tham số dòng lệnh (command-line argument) r. Nếu các tham số này không được cung cấp, chương trình sẽ thiết lập một bộ định thời chỉ hết hạn đúng một lần, sau 2 giây.
- Thực hiện một vòng lặp liên tục t, tiêu thụ thời gian CPU và định kỳ gọi hàm `displayTimes()` q, hàm này hiển thị thời gian thực đã trôi qua (elapsed real time) kể từ khi chương trình bắt đầu, cũng như trạng thái hiện tại của bộ định thời `ITIMER_REAL`.

Mỗi khi bộ định thời hết hạn, trình xử lý `SIGALRM` được gọi và nó đặt một cờ toàn cục (global flag), `gotAlarm` w. Bất cứ khi nào cờ này được đặt, vòng lặp trong chương trình chính sẽ gọi `displayTimes()` để hiển thị thời điểm trình xử lý được gọi và trạng thái của bộ định thời y. (Chúng ta thiết kế trình xử lý tín hiệu theo cách này để tránh gọi các hàm không an toàn với tín hiệu bất đồng bộ - non-async-signal-safe functions từ bên trong trình xử lý, vì các lý do được mô tả trong Mục 21.1.2). Nếu bộ định thời có khoảng thời gian bằng không, thì chương trình sẽ thoát ngay khi nhận được tín hiệu đầu tiên; ngược lại, nó sẽ bắt tối đa ba tín hiệu trước khi kết thúc u.

Khi chạy chương trình trong Liệt kê 23-1, chúng ta thấy kết quả sau:

|        | \$ ./real_timer 1 800000 1 0 |      |                | Giá trị ban đầu 1.8 giây, khoảng lặp 1 giây    |
|--------|------------------------------|------|----------------|------------------------------------------------|
|        | Elapsed                      |      | Value Interval |                                                |
| START: | 0.00                         |      |                |                                                |
| Main:  | 0.50                         | 1.30 | 1.00           | Bộ định thời đếm lùi cho đến khi hết hạn       |
| Main:  | 1.00                         | 0.80 | 1.00           |                                                |
| Main:  | 1.50                         | 0.30 | 1.00           |                                                |
| ALARM: | 1.80                         | 1.00 | 1.00           | Khi hết hạn, bộ định thời được nạp lại từ khoảng lặp |
| Main:  | 2.00                         | 0.80 | 1.00           |                                                |
| Main:  | 2.50                         | 0.30 | 1.00           |                                                |
| ALARM: | 2.80                         | 1.00 | 1.00           |                                                |
| Main:  | 3.00                         | 0.80 | 1.00           |                                                |
| Main:  | 3.50                         | 0.30 | 1.00           |                                                |
| ALARM: | 3.80                         | 1.00 | 1.00           |                                                |
|        | That's all folks             |      |                |                                                |

**Liệt kê 23-1:** Sử dụng bộ định thời thời gian thực (real-time timer)

```c
–––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/real_timer.c
## include <signal.h>
## include <sys/time.h>
## include <time.h>
## include "tlpi_hdr.h"
  static volatile sig_atomic_t gotAlarm = 0;
   /* Đặt thành giá trị khác không khi nhận được SIGALRM */
  /* Lấy và hiển thị thời gian thực, và (nếu 'includeTimer' là
   TRUE) giá trị hiện tại và khoảng lặp cho bộ định thời ITIMER_REAL */
  static void
q displayTimes(const char *msg, Boolean includeTimer)
  {
   struct itimerval itv;
   static struct timeval start;
   struct timeval curr;
   static int callNum = 0; /* Số lần gọi hàm này */
   if (callNum == 0) /* Khởi tạo đồng hồ đo thời gian đã trôi qua */
   if (gettimeofday(&start, NULL) == -1)
   errExit("gettimeofday");
   if (callNum % 20 == 0) /* In tiêu đề sau mỗi 20 dòng */
   printf(" Elapsed Value Interval\n");
```

```c
 if (gettimeofday(&curr, NULL) == -1)
   errExit("gettimeofday");
   printf("%-7s %6.2f", msg, curr.tv_sec - start.tv_sec +
   (curr.tv_usec - start.tv_usec) / 1000000.0);
   if (includeTimer) {
   if (getitimer(ITIMER_REAL, &itv) == -1)
   errExit("getitimer");
   printf(" %6.2f %6.2f",
   itv.it_value.tv_sec + itv.it_value.tv_usec / 1000000.0,
   itv.it_interval.tv_sec + itv.it_interval.tv_usec / 1000000.0);
   }
   printf("\n");
   callNum++;
  }
  static void
  sigalrmHandler(int sig)
  {
w gotAlarm = 1;
  }
  int
  main(int argc, char *argv[])
  {
   struct itimerval itv;
   clock_t prevClock;
   int maxSigs; /* Số lượng tín hiệu cần bắt trước khi thoát */
   int sigCnt; /* Số lượng tín hiệu đã bắt được cho đến nay */
   struct sigaction sa;
   if (argc > 1 && strcmp(argv[1], "--help") == 0)
   usageErr("%s [secs [usecs [int-secs [int-usecs]]]]\n", argv[0]);
   sigCnt = 0;
   sigemptyset(&sa.sa_mask);
   sa.sa_flags = 0;
   sa.sa_handler = sigalrmHandler;
e if (sigaction(SIGALRM, &sa, NULL) == -1)
   errExit("sigaction");
   /* Thoát sau 3 tín hiệu, hoặc ngay tín hiệu đầu tiên nếu khoảng lặp bằng 0 */
   maxSigs = (itv.it_interval.tv_sec == 0 &&
   itv.it_interval.tv_usec == 0) ? 1 : 3;
   displayTimes("START:", FALSE);
   /* Thiết lập bộ định thời từ các tham số dòng lệnh */
   itv.it_value.tv_sec = (argc > 1) ? getLong(argv[1], 0, "secs") : 2;
   itv.it_value.tv_usec = (argc > 2) ? getLong(argv[2], 0, "usecs") : 0;
```

```c
   itv.it_interval.tv_sec = (argc > 3) ? getLong(argv[3], 0, "int-secs") : 0;
   itv.it_interval.tv_usec = (argc > 4) ? getLong(argv[4], 0, "int-usecs") : 0;
r if (setitimer(ITIMER_REAL, &itv, 0) == -1)
   errExit("setitimer");
   prevClock = clock();
   sigCnt = 0;
t for (;;) {
   /* Inner loop consumes at least 0.5 seconds CPU time */
   while (((clock() - prevClock) * 10 / CLOCKS_PER_SEC) < 5) {
y if (gotAlarm) { /* Did we get a signal? */
   gotAlarm = 0;
   displayTimes("ALARM:", TRUE);
   sigCnt++;
u if (sigCnt >= maxSigs) {
   printf("That's all folks\n");
   exit(EXIT_SUCCESS);
   }
   }
   }
   prevClock = clock();
   displayTimes("Main: ", TRUE);
   }
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/real_timer.c
```

### Một giao diện bộ đếm thời gian đơn giản hơn: alarm()

System Call `alarm()` cung cấp một giao diện đơn giản để thiết lập một bộ đếm thời gian thời gian thực (real-time timer) hết hạn một lần, không có khoảng lặp lại. (Về mặt lịch sử, `alarm()` là API UNIX gốc dùng để thiết lập bộ đếm thời gian).

```c
## include <unistd.h>
unsigned int alarm(unsigned int seconds);
                   Luôn thành công, trả về số giây còn lại của
                     bất kỳ bộ đếm thời gian nào đã được thiết lập trước đó, hoặc 0 nếu không có bộ đếm nào được thiết lập trước đó
```

Tham số `seconds` chỉ định số giây trong tương lai khi bộ đếm thời gian hết hạn. Tại thời điểm đó, tín hiệu `SIGALRM` (signal) sẽ được gửi đến tiến trình gọi (`calling process`).

Thiết lập một bộ đếm thời gian bằng `alarm()` sẽ ghi đè lên bất kỳ bộ đếm thời gian nào đã được thiết lập trước đó. Chúng ta có thể vô hiệu hóa một bộ đếm thời gian hiện có bằng cách gọi `alarm(0)`.

Là giá trị trả về, `alarm()` cung cấp cho chúng ta số giây còn lại cho đến khi hết hạn của bất kỳ bộ đếm thời gian nào đã được thiết lập trước đó, hoặc 0 nếu không có bộ đếm thời gian nào được thiết lập.

Một ví dụ về việc sử dụng `alarm()` được trình bày trong Mục [23.3](#page-7-0).

Trong một số chương trình ví dụ sau này trong cuốn sách này, chúng ta sử dụng `alarm()` để khởi động bộ đếm thời gian mà không thiết lập trình xử lý tín hiệu `SIGALRM` (handler) tương ứng, như một kỹ thuật nhằm đảm bảo rằng một tiến trình sẽ bị tiêu diệt (killed) nếu nó không bị chấm dứt theo cách khác.

### Tương tác giữa setitimer() và alarm()

Trên Linux, `alarm()` và `setitimer()` chia sẻ chung một bộ đếm thời gian thực trên mỗi tiến trình (per-process real-time timer), có nghĩa là việc thiết lập bộ đếm thời gian bằng một trong các hàm này sẽ làm thay đổi bất kỳ bộ đếm thời gian nào trước đó đã được thiết lập bởi hàm còn lại. Điều này có thể không đúng trên các cài đặt UNIX khác (nghĩa là các hàm này có thể điều khiển các bộ đếm thời gian độc lập). Tiêu chuẩn SUSv3 cố ý không chỉ định rõ ràng các tương tác giữa `setitimer()` và `alarm()`, cũng như các tương tác của các hàm này với hàm `sleep()` được mô tả trong Mục [23.4.1](#page-8-0). Để có tính tương thích tối đa (portability), chúng ta nên đảm bảo rằng các ứng dụng của mình chỉ sử dụng một trong hai hàm `setitimer()` hoặc `alarm()` để thiết lập các bộ đếm thời gian thực.

## 23.2 Lập lịch và độ chính xác của Bộ đếm thời gian (Timers)

Tùy thuộc vào tải của hệ thống (system load) và việc lập lịch các tiến trình (scheduling of processes), một tiến trình có thể không được lên lịch chạy cho đến một khoảng thời gian ngắn (thường là một phần nhỏ của một giây) sau khi bộ đếm thời gian thực sự hết hạn. Mặc dù vậy, việc hết hạn của một bộ đếm thời gian định kỳ được thiết lập bởi `setitimer()`, hoặc các giao diện khác được mô tả sau trong chương này, sẽ vẫn giữ được tính đều đặn. Ví dụ, nếu một bộ đếm thời gian thực được thiết lập để hết hạn sau mỗi 2 giây, thì việc gửi các sự kiện bộ đếm thời gian riêng lẻ có thể chịu các độ trễ vừa được mô tả, nhưng việc lập lịch cho các lần hết hạn tiếp theo vẫn sẽ diễn ra chính xác ở khoảng thời gian 2 giây tiếp theo. Nói cách khác, các bộ đếm thời gian khoảng thời gian (interval timers) không bị chịu lỗi tích lũy (creeping errors).

Mặc dù cấu trúc `timeval` được sử dụng bởi `setitimer()` cho phép đạt độ chính xác đến micro giây, độ chính xác của bộ đếm thời gian theo truyền thống bị giới hạn bởi tần số của đồng hồ phần mềm (software clock) (Mục 10.6). Nếu giá trị của bộ đếm thời gian không khớp chính xác với một bội số của độ mịn (granularity) của đồng hồ phần mềm, thì giá trị bộ đếm thời gian sẽ được làm tròn lên. Điều này có nghĩa là nếu, ví dụ, chúng ta chỉ định một bộ đếm thời gian khoảng thời gian kêu sau mỗi 19.100 micro giây (tức là chỉ hơn 19 mili giây), thì giả sử giá trị jiffy là 4 mili giây, chúng ta sẽ thực sự nhận được một bộ đếm thời gian hết hạn sau mỗi 20 mili giây.

```

### Bộ định thời độ phân giải cao (High-resolution timers)

Trên các nhân Linux hiện đại, nhận định trước đây rằng độ phân giải của bộ định thời (timer resolution) bị giới hạn bởi tần số của đồng hồ phần mềm (software clock) không còn chính xác nữa. Kể từ phiên bản kernel 2.6.21, Linux hỗ trợ tùy chọn bộ định thời độ phân giải cao (high-resolution timers). Nếu tính năng hỗ trợ này được bật (thông qua tùy chọn cấu hình kernel `CONFIG_HIGH_RES_TIMERS`), thì độ chính xác của các giao diện định thời (timer) và tạm dừng thực thi (sleep) mà chúng ta mô tả trong chương này sẽ không còn bị giới hạn bởi kích thước của jiffy trong kernel nữa. Thay vào đó, các lời gọi này có thể đạt độ chính xác cao tùy theo giới hạn của phần cứng bên dưới. Trên phần cứng hiện đại, độ chính xác xuống mức microsecond (micro-giây) là điều phổ biến.

> Sự khả dụng của bộ định thời độ phân giải cao (high-resolution timers) có thể được xác định bằng cách kiểm tra độ phân giải của đồng hồ trả về từ hàm `clock_getres()`, được mô tả tại Mục [23.5.1](#page-12-0).

## 23.3 Thiết lập Thời gian chờ (Timeout) cho các Thao tác Chặn (Blocking Operations)

Một ứng dụng của bộ định thời thời gian thực (real-time timer) là đặt giới hạn thời gian tối đa cho một System Call (lời gọi hệ thống) dạng chặn (blocking system call) có thể tiếp tục bị chặn. Ví dụ, chúng ta có thể muốn hủy một thao tác `read()` từ thiết bị terminal nếu người dùng không nhập một dòng dữ liệu nào trong một khoảng thời gian nhất định. Chúng ta có thể thực hiện việc này như sau:

- 1. Gọi `sigaction()` để thiết lập một trình xử lý (handler) cho tín hiệu `SIGALRM`, lược bỏ cờ `SA_RESTART`, để các system call không bị khởi động lại (tham khảo Mục 21.5).
- 2. Gọi `alarm()` hoặc `setitimer()` để thiết lập một bộ định thời (timer) chỉ định giới hạn thời gian tối đa mà chúng ta muốn system call bị chặn.
- 3. Thực hiện blocking system call.
- 4. Sau khi system call trả về, gọi lại `alarm()` hoặc `setitimer()` một lần nữa để vô hiệu hóa bộ định thời (trong trường hợp system call hoàn thành trước khi timer hết hạn).
- 5. Kiểm tra xem blocking system call có thất bại với biến `errno` được thiết lập thành `EINTR` (system call bị ngắt) hay không.

[Liệt kê 23-2](#page-7-1) minh họa kỹ thuật này cho hàm `read()`, sử dụng `alarm()` để thiết lập bộ định thời.

**Liệt kê 23-2:** Thực hiện thao tác `read()` có kèm thời gian chờ (timeout)

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/timed_read.c

## include <signal.h>

## include "tlpi_hdr.h"

## define BUF_SIZE 200

static void /* Trình xử lý SIGALRM: ngắt system call đang bị chặn */
handler(int sig)
{
printf("Caught signal\n"); /* KHÔNG AN TOÀN - UNSAFE (xem Mục 21.1.2) */
}
int
main(int argc, char *argv[])
{
struct sigaction sa;
char buf[BUF_SIZE];
ssize_t numRead;
int savedErrno;
if (argc > 1 && strcmp(argv[1], "--help") == 0)
usageErr("%s [num-secs [restart-flag]]\n", argv[0]);
/* Thiết lập trình xử lý cho SIGALRM. Cho phép các system call bị ngắt,
trừ khi đối số dòng lệnh thứ hai được cung cấp. */
sa.sa_flags = (argc > 2) ? SA_RESTART : 0;
sigemptyset(&sa.sa_mask);

```

```

sa.sa_handler = handler;
if (sigaction(SIGALRM, &sa, NULL) == -1)
errExit("sigaction");
alarm((argc > 1) ? getInt(argv[1], GN_NONNEG, "num-secs") : 10);
numRead = read(STDIN_FILENO, buf, BUF_SIZE - 1);
savedErrno = errno; /* Trong trường hợp alarm() làm thay đổi giá trị này */
alarm(0); /* Đảm bảo bộ định thời được tắt */
errno = savedErrno;
/* Xác định kết quả của read() */
if (numRead == -1) {
if (errno == EINTR)
printf("Read timed out\n");
else
errMsg("read");
} else {
printf("Successful read (%ld bytes): %.*s",
(long) numRead, (int) numRead, buf);
}
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/timed_read.c

```

Lưu ý rằng có một Race Condition (tình trạng tranh chấp) lý thuyết trong chương trình tại [Liệt kê 23-2.](#page-7-1) Nếu bộ định thời hết hạn sau lệnh gọi `alarm()`, nhưng trước khi lệnh gọi `read()` được bắt đầu, thì lệnh gọi `read()` sẽ không bị ngắt bởi signal handler. Vì giá trị timeout được sử dụng trong các kịch bản như thế này thường tương đối lớn (ít nhất là vài giây) nên điều này rất khó xảy ra, do đó, trên thực tế, đây là một kỹ thuật khả thi. [Stevens & Rago, 2005] đề xuất một kỹ thuật thay thế sử dụng `longjmp()`. Một giải pháp thay thế khác khi xử lý các I/O system call là sử dụng tính năng timeout của các system call `select()` hoặc `poll()` (Chương 63), vốn cũng có ưu điểm là cho phép chúng ta đồng thời chờ I/O trên nhiều File Descriptor (mô tả tệp) khác nhau.

## 23.4 Tạm dừng Thực thi trong một khoảng thời gian cố định (Sleeping)

Đôi khi, chúng ta muốn tạm dừng việc thực thi của một Process (tiến trình) trong một khoảng thời gian cố định. Mặc dù có thể thực hiện việc này bằng cách kết hợp `sigsuspend()` và các hàm định thời đã mô tả ở trên, nhưng sẽ dễ dàng hơn nếu sử dụng một trong các hàm sleep thay thế.

### 23.4.1 Tạm dừng độ phân giải thấp: sleep()

Hàm `sleep()` tạm dừng việc thực thi của tiến trình gọi trong số giây được chỉ định bởi đối số `seconds` hoặc cho đến khi một tín hiệu (signal) bị bắt (do đó làm ngắt lời gọi).

```

## include <unistd.h>

unsigned int sleep(unsigned int seconds);
Trả về 0 khi hoàn thành bình thường, hoặc số giây
chưa ngủ nếu bị kết thúc sớm

```

Nếu quá trình ngủ hoàn tất, `sleep()` trả về 0. Nếu quá trình ngủ bị ngắt quãng bởi một tín hiệu (signal), `sleep()` trả về số giây còn lại (chưa ngủ). Giống như các bộ định thời (timer) được thiết lập bởi `alarm()` và `setitimer()`, tải hệ thống (system load) có thể có nghĩa là tiến trình (process) chỉ được lên lịch lại (rescheduled) tại một khoảng thời gian nào đó (thông thường là ngắn) sau khi lệnh gọi `sleep()` hoàn tất.

SUSv3 không quy định rõ các tương tác có thể có giữa `sleep()` với `alarm()` và `setitimer()`. Trên Linux, `sleep()` được triển khai như một lời gọi đến `nanosleep()` (Mục [23.4.2](#page-9-0)), với hệ quả là không có sự tương tác nào giữa `sleep()` và các hàm định thời. Tuy nhiên, trên nhiều hệ thống triển khai, đặc biệt là các hệ thống cũ, `sleep()` được thực thi bằng cách sử dụng `alarm()` và một hàm xử lý tín hiệu (signal handler) cho tín hiệu `SIGALRM`. Để đảm bảo tính di động (portability), chúng ta nên tránh kết hợp việc sử dụng `sleep()` với `alarm()` và `setitimer()`.

### 23.4.2 Ngủ độ phân giải cao: nanosleep()

Hàm `nanosleep()` thực hiện một tác vụ tương tự như `sleep()`, nhưng cung cấp một số ưu điểm, bao gồm độ phân giải mịn hơn khi chỉ định khoảng thời gian ngủ.

```

## define _POSIX_C_SOURCE 199309

## include <time.h>

int nanosleep(const struct timespec *request, struct timespec *remain);
Trả về 0 khi ngủ thành công,
hoặc –1 khi có lỗi hoặc bị ngắt quãng giấc ngủ

```

Tham số `request` chỉ định khoảng thời gian ngủ và là một con trỏ trỏ tới một cấu trúc (structure) có dạng sau:

```

struct timespec {
time_t tv_sec; /* Giây */
long tv_nsec; /* Nanosecond */
};

```

Trường `tv_nsec` chỉ định giá trị tính bằng nanosecond. Nó phải là một số nằm trong khoảng từ 0 đến 999,999,999.

Một ưu điểm khác của `nanosleep()` là SUSv3 quy định rõ ràng rằng nó không được triển khai bằng cách sử dụng các tín hiệu (signal). Điều này có nghĩa là, không giống như tình huống với `sleep()`, chúng ta có thể kết hợp một cách linh hoạt các lệnh gọi `nanosleep()` với các lệnh gọi `alarm()` hoặc `setitimer()`.

Mặc dù không được triển khai bằng tín hiệu, `nanosleep()` vẫn có thể bị ngắt quãng bởi một trình xử lý tín hiệu (signal handler). Trong trường hợp này, `nanosleep()` trả về –1, với `errno` được thiết lập thành `EINTR` thông thường và nếu tham số `remain` không phải là `NULL`, bộ đệm mà nó trỏ tới sẽ trả về thời gian chưa ngủ còn lại. Nếu muốn, chúng ta có điều kiện sử dụng giá trị được trả về để khởi động lại system call và hoàn thành giấc ngủ. Điều này được minh họa trong [Listing 23-3.](#page-11-0) Dưới dạng các tham số dòng lệnh (command-line arguments), chương trình này mong đợi các giá trị giây và nanosecond cho `nanosleep()`. Chương trình lặp lại liên tục, thực thi `nanosleep()` cho đến khi toàn bộ khoảng thời gian ngủ trôi qua. Nếu `nanosleep()` bị ngắt bởi trình xử lý cho `SIGINT` (được tạo ra bằng cách gõ Control-C), thì lệnh gọi sẽ được khởi động lại bằng cách sử dụng giá trị được trả về trong `remain`. Khi chúng ta chạy chương trình này, chúng ta thấy kết quả sau:

### \$ **./t\_nanosleep 10 0** Ngủ trong 10 giây

Gõ Control-C

Đã ngủ: 1.853428 giây Còn lại: 8.146617000

Gõ Control-C

Đã ngủ: 4.370860 giây Còn lại: 5.629800000

Gõ Control-C

Đã ngủ: 6.193325 giây Còn lại: 3.807758000 Đã ngủ: 10.008150 giây

Hoàn thành giấc ngủ

Mặc dù `nanosleep()` cho phép độ chính xác đến mức nanosecond khi chỉ định khoảng thời gian ngủ, độ chính xác của khoảng thời gian ngủ bị giới hạn bởi độ chi tiết (granularity) của đồng hồ phần mềm (software clock) (Mục 10.6). Nếu chúng ta chỉ định một khoảng thời gian không phải là bội số của đồng hồ phần mềm, thì khoảng thời gian đó sẽ được làm tròn lên.

> Như đã lưu ý trước đó, trên các hệ thống hỗ trợ bộ định thời độ phân giải cao (high-resolution timers), độ chính xác của khoảng thời gian ngủ có thể tinh tế hơn nhiều so với độ chi tiết của đồng hồ phần mềm.

Hành vi làm tròn này có nghĩa là nếu các tín hiệu được nhận với tốc độ cao, thì sẽ có một vấn đề với cách tiếp cận được sử dụng trong chương trình ở [Listing 23-3.](#page-11-0) Vấn đề là mỗi lần khởi động lại `nanosleep()` sẽ chịu các lỗi làm tròn, vì thời gian `remain` được trả về không có khả năng là một bội số chính xác của độ chi tiết đồng hồ phần mềm. Do đó, mỗi lần `nanosleep()` được khởi động lại sẽ ngủ lâu hơn giá trị được trả về trong `remain` bởi lệnh gọi trước đó. Trong trường hợp tốc độ gửi tín hiệu cực kỳ cao (tức là thường xuyên bằng hoặc lớn hơn độ chi tiết của đồng hồ phần mềm), tiến trình có thể không bao giờ có thể hoàn thành giấc ngủ của mình. Trên Linux 2.6, vấn đề này có thể tránh được bằng cách sử dụng `clock_nanosleep()` với tùy chọn `TIMER_ABSTIME`. Chúng ta mô tả `clock_nanosleep()` ở Mục [23.5.4](#page-14-0).

> Trong Linux 2.4 trở về trước, có một điểm đặc biệt trong việc triển khai `nanosleep()`. Giả sử rằng một tiến trình thực hiện lệnh gọi `nanosleep()` bị dừng lại bởi một tín hiệu. Khi tiến trình sau đó được tiếp tục (resumed) thông qua việc gửi tín hiệu `SIGCONT`, thì lệnh gọi `nanosleep()` thất bại với lỗi `EINTR`, đúng như dự kiến. Tuy nhiên, nếu chương trình sau đó khởi động lại lệnh gọi `nanosleep()`, thì khoảng thời gian mà tiến trình đã dành ở trạng thái dừng không được tính vào khoảng thời gian ngủ, do đó tiến trình sẽ ngủ lâu hơn dự kiến. Điểm đặc biệt này đã được loại bỏ trên Linux 2.6, nơi lệnh gọi `nanosleep()` tự động tiếp tục khi gửi tín hiệu `SIGCONT`, và thời gian trải qua ở trạng thái ngủ được tính vào khoảng thời gian ngủ.

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/t_nanosleep.c

## define _POSIX_C_SOURCE 199309

## include <sys/time.h>

## include <time.h>

## include <signal.h>

## include "tlpi_hdr.h"

static void
sigintHandler(int sig)
{
return; /* Just interrupt nanosleep() */
}
int
main(int argc, char *argv[])
{
struct timeval start, finish;
struct timespec request, remain;
struct sigaction sa;
int s;
if (argc != 3 || strcmp(argv[1], "--help") == 0)
usageErr("%s secs nanosecs\n", argv[0]);
request.tv_sec = getLong(argv[1], 0, "secs");
request.tv_nsec = getLong(argv[2], 0, "nanosecs");
/* Allow SIGINT handler to interrupt nanosleep() */
sigemptyset(&sa.sa_mask);
sa.sa_flags = 0;
sa.sa_handler = sigintHandler;
if (sigaction(SIGINT, &sa, NULL) == -1)
errExit("sigaction");
if (gettimeofday(&start, NULL) == -1)
errExit("gettimeofday");
for (;;) {
s = nanosleep(&request, &remain);
if (s == -1 && errno != EINTR)
errExit("nanosleep");
if (gettimeofday(&finish, NULL) == -1)
errExit("gettimeofday");
printf("Slept for: %9.6f secs\n", finish.tv_sec - start.tv_sec +
(finish.tv_usec - start.tv_usec) / 1000000.0);
if (s == 0)
break; /* nanosleep() completed */
printf("Remaining: %2ld.%09ld\n", (long) remain.tv_sec,
remain.tv_nsec);

```

```c

request = remain; /* Next sleep is with remaining time */
}
printf("Sleep complete\n");
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/t_nanosleep.c

```

## 23.5 POSIX Clocks

Các POSIX clock (được định nghĩa ban đầu trong POSIX.1b) cung cấp một API để truy cập các bộ đếm thời gian (clock) đo đếm thời gian với độ chính xác đến nano-giây. Các giá trị thời gian tính bằng nano-giây được biểu diễn bằng cách sử dụng cùng cấu trúc `timespec` được dùng bởi `nanosleep()` (Mục [23.4.2](#page-9-0)).

Trên Linux, các chương trình sử dụng API này phải được biên dịch với tùy chọn `-lrt`, nhằm liên kết (link) với thư viện `librt` (realtime).

Các System Call chính trong API POSIX clock là `clock_gettime()`, dùng để truy xuất giá trị hiện tại của một clock; `clock_getres()`, trả về độ phân giải (resolution) của một clock; và `clock_settime()`, dùng để cập nhật một clock.

### 23.5.1 Truy xuất giá trị của một Clock: clock_gettime()

System call `clock_gettime()` trả về thời gian tương ứng với clock được chỉ định trong `clockid`.

```c

## define _POSIX_C_SOURCE 199309

## include <time.h>

int clock_gettime(clockid_t clockid, struct timespec *tp);
int clock_getres(clockid_t clockid, struct timespec *res);
Cả hai đều trả về 0 khi thành công, hoặc –1 khi lỗi

```

Giá trị thời gian được trả về trong cấu trúc `timespec` do `tp` trỏ tới. Mặc dù cấu trúc `timespec` mang lại độ chính xác đến nano-giây, độ chi tiết (granularity) của giá trị thời gian do `clock_gettime()` trả về có thể thô hơn mức này. System call `clock_getres()` trả về một con trỏ trỏ đến cấu trúc `timespec` chứa độ phân giải của clock được chỉ định trong `clockid`.

Kiểu dữ liệu `clockid_t` là một kiểu dữ liệu do SUSv3 quy định để biểu diễn định danh của clock (clock identifier). Cột đầu tiên của Bảng 23-1 liệt kê các giá trị có thể được chỉ định cho `clockid`.

**Bảng 23-1:** Các loại POSIX.1b clock

| Clock ID                 | Mô tả                                           |
|--------------------------|-------------------------------------------------|
| CLOCK_REALTIME           | Real-time clock toàn hệ thống, có thể chỉnh sửa |
| CLOCK_MONOTONIC          | Monotonic clock, không thể chỉnh sửa            |
| CLOCK_PROCESS_CPUTIME_ID | CPU-time clock tính theo tiến trình (từ Linux 2.6.12) |
| CLOCK_THREAD_CPUTIME_ID  | CPU-time clock tính theo luồng (từ Linux 2.6.12) |

Clock `CLOCK_REALTIME` là một clock toàn hệ thống (system-wide) đo thời gian thực tế (wall-clock time). Khác với clock `CLOCK_MONOTONIC`, cấu hình của clock này có thể bị thay đổi.

SUSv3 quy định rằng clock `CLOCK_MONOTONIC` đo thời gian kể từ một "điểm không xác định trong quá khứ" mà không thay đổi sau khi hệ thống khởi động. Clock này hữu ích cho các ứng dụng không được phép bị ảnh hưởng bởi các thay đổi ngắt quãng đối với clock hệ thống (ví dụ: thay đổi thủ công thời gian hệ thống). Trên Linux, clock này đo thời gian kể từ khi hệ thống khởi động.

Clock `CLOCK_PROCESS_CPUTIME_ID` đo thời gian CPU ở phía user space và kernel space (user and system CPU time) mà tiến trình gọi tiêu thụ. Clock `CLOCK_THREAD_CPUTIME_ID` thực hiện tác vụ tương tự cho một Thread riêng lẻ trong một Process.

Tất cả các clock trong Bảng 23-1 đều được quy định trong SUSv3, nhưng chỉ có `CLOCK_REALTIME` là bắt buộc và được hỗ trợ rộng rãi trên các cài đặt UNIX.

> [!NOTE]
> Linux 2.6.28 bổ sung một loại clock mới, `CLOCK_MONOTONIC_RAW`, vào danh sách trong Bảng 23-1. Đây là một clock không thể chỉnh sửa tương tự như `CLOCK_MONOTONIC`, nhưng nó cung cấp quyền truy cập vào thời gian thuần túy dựa trên phần cứng (pure hardware-based time) không bị ảnh hưởng bởi các điều chỉnh NTP. Clock phi tiêu chuẩn này được thiết kế để sử dụng trong các ứng dụng đồng bộ hóa thời gian chuyên biệt.

> Linux 2.6.32 bổ sung thêm hai clock mới vào danh sách trong Bảng 23-1: `CLOCK_REALTIME_COARSE` và `CLOCK_MONOTONIC_COARSE`. Các clock này tương tự như `CLOCK_REALTIME` và `CLOCK_MONOTONIC`, nhưng dành cho các ứng dụng muốn lấy các mốc thời gian (timestamp) độ phân giải thấp với chi phí tối thiểu. Các clock phi chuẩn này không gây ra bất kỳ truy cập nào tới phần cứng clock (vốn có thể tốn kém đối với một số nguồn clock phần cứng), và độ phân giải của giá trị trả về chính là một jiffy (Mục 10.6).

### 23.5.2 Thiết lập Giá trị của một Clock: clock_settime()

System Call (lời gọi hệ thống) `clock_settime()` thiết lập clock được chỉ định bởi `clockid` thành thời gian được cung cấp trong bộ đệm trỏ tới bởi `tp`.

## define _POSIX_C_SOURCE 199309
## include <time.h>
int clock_settime(clockid_t clockid, const struct timespec *tp);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Nếu thời gian được chỉ định bởi `tp` không phải là bội số của độ phân giải clock do `clock_getres()` trả về, thời gian sẽ được làm tròn xuống.

Một tiến trình (process) có đặc quyền (`CAP_SYS_TIME`) mới có thể thiết lập clock `CLOCK_REALTIME`. Giá trị ban đầu của clock này thông thường là thời gian tính từ mốc Epoch. Không có clock nào khác trong Bảng 23-1 có thể chỉnh sửa được.

> [!NOTE]
> Theo tiêu chuẩn SUSv3, một bản cài đặt (implementation) có thể cho phép các clock `CLOCK_PROCESS_CPUTIME_ID` và `CLOCK_THREAD_CPUTIME_ID` có thể chỉnh sửa được. Tại thời điểm viết tài liệu này, các clock này trên Linux chỉ ở chế độ chỉ đọc (read-only).

### 23.5.3 Lấy Clock ID của một Tiến trình hoặc Luồng Cụ thể

Các hàm được mô tả trong phần này cho phép chúng ta lấy ID của một clock đo lường thời gian CPU mà một tiến trình hoặc luồng (thread) cụ thể tiêu thụ. Chúng ta có thể sử dụng clock ID được trả về trong một lời gọi tới `clock_gettime()` nhằm tìm hiểu thời gian CPU mà tiến trình hoặc luồng đã tiêu thụ.

Hàm `clock_getcpuclockid()` trả về định danh của clock thời gian CPU (CPU-time clock) của tiến trình có ID là `pid`, thông qua bộ đệm trỏ tới bởi `clockid`.

## define _XOPEN_SOURCE 600

## include <time.h>

int clock_getcpuclockid(pid_t pid, clockid_t *clockid);
Trả về 0 khi thành công, hoặc một số dương báo lỗi khi lỗi

```

Nếu `pid` bằng 0, `clock_getcpuclockid()` sẽ trả về ID của clock thời gian CPU của tiến trình gọi hàm (calling process).

Hàm `pthread_getcpuclockid()` là hàm tương đương theo chuẩn POSIX threads của hàm `clock_getcpuclockid()`. Nó trả về định danh của clock đo lường thời gian CPU tiêu thụ bởi một luồng cụ thể thuộc tiến trình gọi hàm.

## define _XOPEN_SOURCE 600
## include <pthread.h>
## include <time.h>
int pthread_getcpuclockid(pthread_t thread, clockid_t *clockid);
                       Trả về 0 khi thành công, hoặc một số dương báo lỗi khi lỗi
```

Đối số `thread` là một ID luồng POSIX định danh luồng mà chúng ta muốn lấy ID clock thời gian CPU của nó. Clock ID được trả về trong bộ đệm trỏ tới bởi `clockid`.

### 23.5.4 Cải thiện độ phân giải cao cho tiến trình ngủ: clock\_nanosleep()

Giống như nanosleep(), system call `clock_nanosleep()` đặc trưng của Linux sẽ tạm dừng tiến trình gọi (calling process) cho đến khi một khoảng thời gian được chỉ định trôi qua hoặc có tín hiệu (signal) được gửi đến. Trong phần này, chúng ta sẽ mô tả các tính năng giúp phân biệt `clock_nanosleep()` với nanosleep().

## define _XOPEN_SOURCE 600

## include <time.h>

int clock_nanosleep(clockid_t clockid, int flags,
const struct timespec *request, struct timespec *remain);
Trả về 0 nếu ngủ hoàn tất thành công,
hoặc một mã lỗi dương nếu lỗi hoặc bị gián đoạn giấc ngủ

```

Các tham số `request` và `remain` phục vụ các mục đích tương tự như các tham số tương ứng của nanosleep().

Theo mặc định (tức là nếu `flags` bằng 0), khoảng thời gian ngủ được chỉ định trong `request` là tương đối (giống như `nanosleep()`). Tuy nhiên, nếu chúng ta chỉ định `TIMER_ABSTIME` trong `flags` (xem ví dụ tại [Listing 23-4](#page-15-0)), thì `request` sẽ chỉ định một thời gian tuyệt đối được đo bằng đồng hồ (clock) do `clockid` xác định. Tính năng này rất cần thiết trong các ứng dụng cần ngủ chính xác cho đến một thời điểm cụ thể. Nếu thay vào đó, chúng ta cố gắng truy xuất thời gian hiện tại, tính toán khoảng chênh lệch cho đến thời gian mục tiêu mong muốn và thực hiện một giấc ngủ tương đối, thì có khả năng tiến trình có thể bị chiếm quyền (preempted) ngay giữa các bước này, và kết quả là sẽ ngủ lâu hơn mong muốn.

Như đã mô tả trong Phần [23.4.2,](#page-9-0) vấn đề "ngủ quên" (oversleeping) này đặc biệt rõ rệt đối với một tiến trình sử dụng vòng lặp để khởi động lại trạng thái ngủ bị gián đoạn bởi một trình xử lý tín hiệu (signal handler). Nếu các tín hiệu được gửi đến với tần suất cao, thì giấc ngủ tương đối (loại do `nanosleep()` thực hiện) có thể dẫn đến sai số lớn trong tổng thời gian mà một tiến trình dành để ngủ. Chúng ta có thể tránh được vấn đề ngủ quên này bằng cách thực hiện một lời gọi ban đầu tới `clock_gettime()` để lấy thời gian, cộng thêm lượng thời gian mong muốn vào thời gian đó, và sau đó gọi `clock_nanosleep()` với cờ `TIMER_ABSTIME` (và khởi động lại system call nếu nó bị gián đoạn bởi signal handler).

Khi cờ `TIMER_ABSTIME` được chỉ định, tham số `remain` sẽ không được sử dụng (nó không cần thiết). Nếu lời gọi `clock_nanosleep()` bị gián đoạn bởi signal handler, thì giấc ngủ có thể được khởi động lại bằng cách lặp lại lời gọi với cùng tham số `request`.

Một tính năng khác phân biệt `clock_nanosleep()` với `nanosleep()` là chúng ta có thể chọn bộ đếm thời gian (clock) dùng để đo khoảng thời gian ngủ. Chúng ta chỉ định clock mong muốn trong `clockid`: `CLOCK_REALTIME`, `CLOCK_MONOTONIC`, hoặc `CLOCK_PROCESS_CPUTIME_ID`. Xem Bảng 23-1 để có mô tả chi tiết về các loại clock này.

[Listing 23-4](#page-15-0) minh họa việc sử dụng `clock_nanosleep()` để ngủ trong 20 giây dựa trên clock `CLOCK_REALTIME` bằng cách sử dụng giá trị thời gian tuyệt đối.

**Listing 23-4:** Sử dụng `clock_nanosleep()`

```

struct timespec request;
/* Truy xuất giá trị hiện tại của clock CLOCK_REALTIME */
if (clock_gettime(CLOCK_REALTIME, &request) == -1)
errExit("clock_gettime");
request.tv_sec += 20; /* Ngủ trong 20 giây tính từ thời điểm hiện tại */
s = clock_nanosleep(CLOCK_REALTIME, TIMER_ABSTIME, &request, NULL);
if (s != 0) {
if (s == EINTR)
printf("Bị gián đoạn bởi trình xử lý tín hiệu\n");
else
errExitEN(s, "clock_nanosleep");
}

```

## 23.6 Bộ định thời khoảng thời gian POSIX (POSIX Interval Timers)

Các bộ định thời khoảng thời gian UNIX cổ điển được thiết lập bởi `setitimer()` gặp phải một số hạn chế sau:

- Chúng ta chỉ có thể thiết lập một bộ định thời cho mỗi loại trong ba loại: `ITIMER_REAL`, `ITIMER_VIRTUAL`, và `ITIMER_PROF`.
- Cách duy nhất để nhận thông báo khi bộ định thời hết hạn là thông qua việc gửi tín hiệu (signal delivery). Hơn nữa, chúng ta không thể thay đổi tín hiệu được tạo ra khi bộ định thời hết hạn.
- Nếu một bộ định thời khoảng thời gian hết hạn nhiều lần trong khi tín hiệu tương ứng đang bị chặn (blocked), thì signal handler sẽ chỉ được gọi một lần duy nhất. Nói cách khác, chúng ta không có cách nào để biết được có hiện tượng tràn bộ định thời (timer overrun) hay không.
- Các bộ định thời bị giới hạn ở độ phân giải micro giây. Tuy nhiên, một số hệ thống có đồng hồ phần cứng cung cấp độ phân giải cao hơn thế, và trên các hệ thống như vậy, việc có thể truy cập phần mềm ở mức độ phân giải cao hơn là điều rất mong muốn.

POSIX.1b đã định nghĩa một API nhằm giải quyết các hạn chế này, và API này được hiện thực hóa trong Linux 2.6.

> Trên các hệ thống Linux cũ hơn, một phiên bản chưa đầy đủ của API này được cung cấp thông qua cơ chế dựa trên luồng (thread-based implementation) trong glibc. Tuy nhiên, việc hiện thực ở không gian người dùng (user-space implementation) này không cung cấp đầy đủ tất cả các tính năng được mô tả ở đây.

API bộ định thời POSIX chia vòng đời của một bộ định thời thành các bước sau:

- System call `timer_create()` tạo một bộ định thời mới và xác định phương thức mà nó sẽ thông báo cho tiến trình khi bộ định thời đó hết hạn.
- System call `timer_settime()` kích hoạt (armed/bắt đầu) hoặc vô hiệu hóa (disarmed/dừng) một bộ định thời.
- System call `timer_delete()` xóa một bộ định thời không còn cần thiết nữa.

Các POSIX timer không bị kế thừa bởi tiến trình con (child process) được tạo ra bởi hàm `fork()`. Chúng bị vô hiệu hóa (disarmed) và xóa trong quá trình thực thi hàm `exec()` hoặc khi tiến trình (process) kết thúc.

Trên Linux, các chương trình sử dụng POSIX timer API phải được biên dịch với tùy chọn `-lrt`, nhằm liên kết (link) với thư viện `librt` (thời gian thực - realtime).

### 23.6.1 Tạo một Timer: timer\_create()

Hàm `timer_create()` tạo ra một timer mới dùng để đo thời gian bằng cách sử dụng đồng hồ (clock) được chỉ định bởi `clockid`.

```c

## define _POSIX_C_SOURCE 199309

## include <signal.h>

## include <time.h>

int timer_create(clockid_t clockid, struct sigevent *evp, timer_t *timerid);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Tham số `clockid` có thể chỉ định bất kỳ giá trị nào được hiển thị trong Bảng 23-1, hoặc giá trị `clockid` được trả về bởi `clock_getcpuclockid()` hoặc `pthread_getcpuclockid()`. Đối số `timerid` trỏ đến một vùng nhớ đệm trả về một định danh (handle) được dùng để tham chiếu đến timer trong các System Call sau này. Vùng nhớ đệm này có kiểu `timer_t`, đây là một kiểu dữ liệu do SUSv3 quy định để đại diện cho định danh của timer (timer identifier).

Đối số `evp` xác định cách thức chương trình được thông báo khi timer hết hạn (expires). Nó trỏ đến một cấu trúc kiểu `sigevent`, được định nghĩa như sau:

```c

union sigval {
int sival_int; /* Giá trị số nguyên cho dữ liệu đi kèm */
void *sival_ptr; /* Giá trị con trỏ cho dữ liệu đi kèm */
};
struct sigevent {
int sigev_notify; /* Phương thức thông báo */
int sigev_signo; /* Tín hiệu (signal) hết hạn timer */
union sigval sigev_value; /* Giá trị đi kèm signal hoặc
được truyền cho hàm thread */
union {
pid_t _tid; /* ID của thread sẽ nhận signal */
void (*_function) (union sigval);
/* Hàm thông báo thread */
void *_attribute; /* Thực chất là 'pthread_attr_t *' */
} _sigev_un;
};

## define sigev_notify_function _sigev_un._sigev_thread._function

## define sigev_notify_attributes _sigev_un._sigev_thread._attribute

## define sigev_notify_thread_id _sigev_un._tid

```

Trường `sigev_notify` của cấu trúc này được thiết lập thành một trong các giá trị được hiển thị trong [Bảng 23-2.](#page-17-0)

**Bảng 23-2:** Các giá trị cho trường `sigev_notify` của cấu trúc `sigevent`

| Giá trị sigev_notify | Phương thức thông báo                                      | SUSv3 |
|----------------------|------------------------------------------------------------|-------|
| SIGEV_NONE           | Không thông báo; theo dõi timer bằng timer_gettime()       | •     |
| SIGEV_SIGNAL         | Gửi signal `sigev_signo` tới tiến trình (process)          | •     |
| SIGEV_THREAD         | Gọi `sigev_notify_function` làm hàm khởi đầu của thread mới| •     |
| SIGEV_THREAD_ID      | Gửi signal `sigev_signo` tới thread `sigev_notify_thread_id`|      |

Các chi tiết bổ sung về các hằng số của trường `sigev_notify`, và các trường trong cấu trúc `sigval` đi kèm với mỗi giá trị hằng số như sau:

### SIGEV\_NONE

Không cung cấp thông báo khi timer hết hạn. Tiến trình vẫn có thể theo dõi tiến độ của timer bằng cách sử dụng hàm `timer_gettime()`.

### SIGEV\_SIGNAL

Khi timer hết hạn, tạo ra signal được chỉ định trong trường `sigev_signo` cho tiến trình. Nếu `sigev_signo` là một realtime signal, thì trường `sigev_value` sẽ chỉ định dữ liệu (một số nguyên hoặc một con trỏ) đi kèm với signal đó (Mục 22.8.1). Dữ liệu này có thể được truy xuất thông qua trường `si_value` của cấu trúc `siginfo_t` được truyền tới hàm xử lý signal (signal handler) hoặc được trả về bởi lệnh gọi `sigwaitinfo()` hoặc `sigtimedwait()`.

### SIGEV\_THREAD

Khi timer hết hạn, gọi hàm được chỉ định trong trường `sigev_notify_function`. Hàm này được kích hoạt giống như thể nó là hàm khởi đầu trong một thread mới. Cụm từ "giống như thể" (as if) là từ SUSv3, cho phép một bản cài đặt (implementation) tạo ra các thông báo cho một timer định kỳ bằng cách hoặc gửi mỗi thông báo đến một thread mới duy nhất, hoặc gửi các thông báo nối tiếp nhau đến một thread mới duy nhất. Trường `sigev_notify_attributes` có thể được chỉ định là `NULL` hoặc là một con trỏ trỏ đến cấu trúc `pthread_attr_t` để định nghĩa các thuộc tính cho thread (Mục 29.8). Giá trị `union sigval` được chỉ định trong `sigev_value` sẽ được truyền làm đối số duy nhất cho hàm.

### SIGEV\_THREAD\_ID

Điều này tương tự như `SIGEV_SIGNAL`, nhưng signal được gửi đến thread có Thread ID khớp với `sigev_notify_thread_id`. Thread này phải nằm trong cùng một tiến trình với thread gọi (calling thread). (Với thông báo `SIGEV_SIGNAL`, một signal được đưa vào hàng đợi (queued) cho toàn bộ tiến trình, và nếu có nhiều thread trong tiến trình, signal đó sẽ được phân phối đến một thread được chọn bất kỳ trong tiến trình). Trường `sigev_notify_thread_id` có thể được đặt thành giá trị trả về bởi `clone()` hoặc giá trị trả về bởi `gettid()`. Cờ `SIGEV_THREAD_ID` được thiết kế để các thư viện thread sử dụng. (Nó yêu cầu một cơ chế thực thi thread sử dụng tùy chọn `CLONE_THREAD`, được mô tả trong Mục 28.2.1. Cơ chế thực thi thread NPTL hiện đại sử dụng `CLONE_THREAD`, nhưng cơ chế thực thi thread LinuxThreads cũ hơn thì không).

Tất cả các hằng số trên đều được quy định trong tiêu chuẩn SUSv3, ngoại trừ `SIGEV_THREAD_ID`, là hằng số đặc trưng của Linux (Linux-specific).

Đối số `evp` có thể được chỉ định là `NULL`, tương đương với việc chỉ định `sigev_notify` là `SIGEV_SIGNAL`, `sigev_signo` là `SIGALRM` (điều này có thể khác trên các hệ thống khác, vì SUSv3 chỉ định nghĩa chung chung là "một số hiệu tín hiệu mặc định" - "a default signal number"), và `sigev_value.sival_int` là ID của timer.

Theo cách triển khai hiện tại, kernel sẽ cấp phát trước (preallocate) một cấu trúc tín hiệu realtime được đưa vào hàng đợi (queued realtime signal structure) cho mỗi POSIX timer được tạo bằng hàm `timer_create()`. Mục đích của việc cấp phát trước này là để đảm bảo rằng luôn có sẵn ít nhất một cấu trúc như vậy để đưa tín hiệu vào hàng đợi khi timer hết hạn (expire). Điều này có nghĩa là số lượng POSIX timer có thể được tạo sẽ bị giới hạn bởi số lượng tín hiệu realtime có thể được đưa vào hàng đợi (tham khảo Mục 22.8).

### 23.6.2 Kích hoạt và Hủy kích hoạt Timer: timer_settime()

Sau khi đã tạo một timer, chúng ta có thể kích hoạt (arm/start) hoặc hủy kích hoạt (disarm/stop) nó bằng cách sử dụng hàm `timer_settime()`.

```c

## define _POSIX_C_SOURCE 199309

## include <time.h>

int timer_settime(timer_t timerid, int flags, const struct itimerspec *value,
struct itimerspec *old_value);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Đối số `timerid` của hàm `timer_settime()` là một định danh timer (timer handle) được trả về từ lời gọi `timer_create()` trước đó.

Các đối số `value` và `old_value` có ý nghĩa tương tự như các đối số cùng tên trong hàm `setitimer()`: `value` chỉ định các thiết lập mới cho timer, và `old_value` được dùng để trả về các thiết lập timer trước đó (xem mô tả về hàm `timer_gettime()` bên dưới). Nếu chúng ta không quan tâm đến các thiết lập trước đó, chúng ta có thể truyền `old_value` là `NULL`. Các đối số `value` và `old_value` là con trỏ trỏ đến các cấu trúc `itimerspec`, được định nghĩa như sau:

```c

struct itimerspec {
struct timespec it_interval; /* Khoảng thời gian cho periodic timer */
struct timespec it_value; /* Lần hết hạn đầu tiên */
};

```

Mỗi trường của cấu trúc `itimerspec` lại là một cấu trúc kiểu `timespec`, trong đó chỉ định các giá trị thời gian dưới dạng số giây và số nano-giây:

```c

struct timespec {
time_t tv_sec; /* Giây */
long tv_nsec; /* Nano-giây */
};

```

Trường `it_value` chỉ định thời điểm timer sẽ hết hạn lần đầu tiên. Nếu bất kỳ trường con nào của `it_interval` khác 0, thì đây là một timer định kỳ (periodic timer); sau lần hết hạn ban đầu được chỉ định bởi `it_value`, nó sẽ tiếp tục hết hạn theo tần số được chỉ định trong các trường con này. Nếu cả hai trường con của `it_interval` đều bằng 0, timer này sẽ chỉ hết hạn một lần duy nhất.

Nếu `flags` được chỉ định là 0, thì `value.it_value` sẽ được hiểu là tương đối so với giá trị của clock tại thời điểm gọi hàm `timer_settime()` (tức là giống như hàm `setitimer()`). Nếu `flags` được chỉ định là `TIMER_ABSTIME`, thì `value.it_value` sẽ được hiểu là thời gian tuyệt đối (tức là được tính từ mốc thời gian gốc số 0 của clock). Nếu thời điểm đó đã trôi qua trên clock, timer sẽ hết hạn ngay lập tức.

Để kích hoạt một timer, chúng ta gọi hàm `timer_settime()` trong đó có một hoặc cả hai trường con của `value.it_value` khác 0. Nếu timer trước đó đã được kích hoạt, `timer_settime()` sẽ thay thế các thiết lập cũ.

Nếu giá trị và khoảng thời gian của timer không phải là bội số của độ phân giải (resolution) của clock tương ứng (như được trả về bởi hàm `clock_getres()`), các giá trị này sẽ được làm tròn lên (rounded up) thành bội số tiếp theo của độ phân giải đó.

Mỗi khi timer hết hạn, tiến trình (process) sẽ nhận được thông báo sử dụng phương thức được định nghĩa trong lời gọi `timer_create()` đã tạo ra timer đó. Nếu cấu trúc `it_interval` chứa các giá trị khác 0, các giá trị này sẽ được sử dụng để nạp lại (reload) cho cấu trúc `it_value`.

Để hủy kích hoạt một timer, chúng ta gọi hàm `timer_settime()` và chỉ định cả hai trường của `value.it_value` bằng 0.

### 23.6.3 Truy xuất Giá trị Hiện tại của Timer: timer\_gettime()

System Call (lời gọi hệ thống) `timer_gettime()` trả về khoảng thời gian (interval) và thời gian còn lại của POSIX timer được định danh bởi `timerid`.

## define _POSIX_C_SOURCE 199309
## include <time.h>
int timer_gettime(timer_t timerid, struct itimerspec *curr_value);
                                             Trả về 0 nếu thành công, hoặc –1 nếu có lỗi
```

Khoảng thời gian và thời gian cho đến lần hết hạn tiếp theo của timer được trả về trong cấu trúc `itimerspec` do `curr_value` trỏ tới. Trường `curr_value.it_value` trả về khoảng thời gian cho đến lần hết hạn tiếp theo của timer, ngay cả khi timer này được thiết lập như một absolute timer (timer tuyệt đối) bằng cách sử dụng `TIMER_ABSTIME`.

Nếu cả hai trường của cấu trúc `curr_value.it_value` được trả về đều bằng 0, thì timer hiện đang bị vô hiệu hóa (disarmed). Nếu cả hai trường của cấu trúc `curr_value.it_interval` được trả về đều bằng 0, thì timer chỉ hết hạn một lần duy nhất, vào thời điểm được chỉ định trong `curr_value.it_value`.

### 23.6.4 Xóa một Timer: timer\_delete()

Mỗi POSIX timer tiêu tốn một lượng tài nguyên hệ thống (system resource) nhỏ. Do đó, khi chúng ta hoàn tất việc sử dụng một timer, chúng ta nên giải phóng các tài nguyên này bằng cách sử dụng `timer_delete()` để xóa timer đó.

## define _POSIX_C_SOURCE 199309

## include <time.h>

int timer_delete(timer_t timerid);
Trả về 0 nếu thành công, hoặc –1 nếu có lỗi

```

Đối số `timerid` là một handle (thẻ định danh) do lời gọi `timer_create()` trước đó trả về. Nếu timer đang ở trạng thái kích hoạt (armed), nó sẽ tự động bị vô hiệu hóa (disarmed) trước khi bị xóa. Nếu vẫn còn tín hiệu đang chờ xử lý (pending signal) từ lần hết hạn trước đó của timer này, tín hiệu đó vẫn giữ nguyên trạng thái pending. (SUSv3 không quy định chi tiết điểm này, vì vậy các cài đặt UNIX khác có thể có hành vi khác nhau.) Các timer sẽ tự động bị xóa khi một Process (tiến trình) kết thúc.

### 23.6.5 Thông báo qua Tín hiệu (Signal)

Nếu chúng ta chọn nhận thông báo timer thông qua Signal (tín hiệu), chúng ta có thể tiếp nhận tín hiệu thông qua một Signal Handler (trình xử lý tín hiệu), hoặc bằng cách gọi `sigwaitinfo()` hoặc `sigtimedwait()`. Cả hai cơ chế này đều cho phép Process nhận lấy cấu trúc `siginfo_t` (Mục 21.4) cung cấp thêm thông tin về tín hiệu đó. (Để tận dụng tính năng này trong một signal handler, chúng ta chỉ định cờ `SA_SIGINFO` khi thiết lập handler.) Các trường sau được thiết lập trong cấu trúc `siginfo_t`:

- `si_signo`: Trường này chứa tín hiệu được tạo ra bởi timer này.
- `si_code`: Trường này được đặt thành `SI_TIMER`, cho biết tín hiệu này được tạo ra do một POSIX timer hết hạn.
- `si_value`: Trường này được đặt thành giá trị đã được cung cấp trong `evp.sigev_value` khi timer được tạo bằng `timer_create()`. Việc chỉ định các giá trị `evp.sigev_value` khác nhau cung cấp một phương pháp để phân biệt sự hết hạn của nhiều timer cùng gửi đi một tín hiệu giống nhau.

Khi gọi `timer_create()`, `evp.sigev_value.sival_ptr` thường được gán địa chỉ của đối số `timerid` được cung cấp trong cùng lời gọi đó (xem Liệt kê 23-5). Điều này cho phép signal handler (hoặc lời gọi `sigwaitinfo()`) lấy được ID của timer đã tạo ra tín hiệu. (Ngoài ra, `evp.sigev_value.sival_ptr` có thể được gán địa chỉ của một cấu trúc chứa `timerid` được truyền cho `timer_create()`.)

Linux cũng cung cấp trường phi tiêu chuẩn sau trong cấu trúc `siginfo_t`:

`si_overrun`: Trường này chứa số lần tràn (overrun count) cho timer này (được mô tả ở Mục [23.6.6](#page-24-0)).

> Linux cũng cung cấp một trường phi tiêu chuẩn khác: `si_timerid`. Trường này chứa một định danh được hệ thống sử dụng nội bộ để nhận diện timer (nó không giống với ID do `timer_create()` trả về). Nó không có ích đối với các ứng dụng.

Liệt kê 23-5 minh họa việc sử dụng signal làm cơ chế thông báo cho một POSIX timer.

**Liệt kê 23-5:** Thông báo POSIX timer sử dụng tín hiệu (signal)

```

–––––––––––––––––––––––––––––––––––––––––––––––––timers/ptmr_sigev_signal.c

## define _POSIX_C_SOURCE 199309

## include <signal.h>

## include <time.h>

## include "curr_time.h" /* Khai báo hàm currTime() */

## include "itimerspec_from_str.h" /* Khai báo hàm itimerspecFromStr() */

## include "tlpi_hdr.h"

## define TIMER_SIG SIGRTMAX /* Tín hiệu thông báo timer của chúng ta */

static void
handler(int sig, siginfo_t *si, void *uc)
{
timer_t *tidptr;
tidptr = si->si_value.sival_ptr;
/* KHÔNG AN TOÀN: Handler này sử dụng các hàm không an toàn đối với async-signal
(printf(); xem Mục 21.1.2) */

```

```

printf("[%s] Nhận được tín hiệu %d\n", currTime("%T"), sig);
printf(" *sival_ptr = %ld\n", (long) *tidptr);
printf(" timer_getoverrun() = %d\n", timer_getoverrun(*tidptr));
}
int
main(int argc, char *argv[])
{
struct itimerspec ts;
struct sigaction sa;
struct sigevent sev;
timer_t *tidlist;
int j;
if (argc < 2)
usageErr("%s secs[/nsecs][:int-secs[/int-nsecs]]...\n", argv[0]);
tidlist = calloc(argc - 1, sizeof(timer_t));
if (tidlist == NULL)
errExit("malloc");
/* Thiết lập handler cho tín hiệu thông báo */
sa.sa_flags = SA_SIGINFO;
sa.sa_sigaction = handler;
sigemptyset(&sa.sa_mask);
if (sigaction(TIMER_SIG, &sa, NULL) == -1)
errExit("sigaction");
/* Tạo và khởi động một timer cho mỗi đối số dòng lệnh */
sev.sigev_notify = SIGEV_SIGNAL; /* Thông báo qua tín hiệu */
sev.sigev_signo = TIMER_SIG; /* Thông báo bằng tín hiệu này */
for (j = 0; j < argc - 1; j++) {
itimerspecFromStr(argv[j + 1], &ts);
sev.sigev_value.sival_ptr = &tidlist[j];
/* Cho phép handler lấy ID của timer này */
if (timer_create(CLOCK_REALTIME, &sev, &tidlist[j]) == -1)
errExit("timer_create");
printf("Timer ID: %ld (%s)\n", (long) tidlist[j], argv[j + 1]);
if (timer_settime(tidlist[j], 0, &ts, NULL) == -1)
errExit("timer_settime");
}
for (;;) /* Chờ các tín hiệu timer đến */
pause();
}
–––––––––––––––––––––––––––––––––––––––––––––––––timers/ptmr_sigev_signal.c

```

Mỗi đối số dòng lệnh (command-line argument) của chương trình trong [Liệt kê 23-5](#page-23-0) chỉ định giá trị ban đầu (initial value) và khoảng thời gian (interval) cho một bộ định thời (timer). Cú pháp của các đối số này được mô tả trong thông báo "usage" của chương trình và được minh họa trong phiên shell dưới đây. Chương trình này thực hiện các bước sau:

- Thiết lập một trình xử lý (handler) cho tín hiệu (signal) được sử dụng để thông báo bộ định thời (timer notification) w.
- Đối với mỗi đối số dòng lệnh, tạo r và kích hoạt (arm) t một POSIX timer sử dụng cơ chế thông báo `SIGEV_SIGNAL`. Hàm `itimerspecFromStr()` mà chúng ta sử dụng để chuyển đổi e các đối số dòng lệnh thành các cấu trúc (structure) `itimerspec` được thể hiện trong [Liệt kê 23-6.](#page-23-0)
- Tại mỗi lần bộ định thời hết hạn (timer expiration), tín hiệu được chỉ định trong `sev.sigev_signo` sẽ được gửi đến tiến trình (process). Trình xử lý cho tín hiệu này hiển thị giá trị được cung cấp trong `sev.sigev_value.sival_ptr` (tức là ID của bộ định thời, `tidlist[j]`) và giá trị tràn (overrun value) cho bộ định thời q.
- Sau khi đã tạo và kích hoạt các bộ định thời, chờ các bộ định thời hết hạn bằng cách thực thi một vòng lặp liên tục gọi `pause()` y.

[Liệt kê 23-6](#page-23-0) hiển thị hàm chuyển đổi từng đối số dòng lệnh cho chương trình trong [Liệt kê 23-5](#page-23-0) thành cấu trúc `itimerspec` tương ứng. Định dạng của các đối số chuỗi được hàm này diễn giải được thể hiện trong một chú thích ở đầu phần liệt kê (và được minh họa trong phiên shell bên dưới).

**Liệt kê 23-6:** Chuyển đổi chuỗi thời gian kết hợp khoảng thời gian thành giá trị `itimerspec`

```c

––––––––––––––––––––––––––––––––––––––––––––––– timers/itimerspec_from_str.c

## define_POSIX_C_SOURCE 199309

## include <string.h>

## include <stdlib.h>

## include "itimerspec_from_str.h" /* Khai báo hàm được định nghĩa ở đây */

/* Chuyển đổi chuỗi có dạng sau thành cấu trúc itimerspec:
"value.sec[/value.nanosec][:interval.sec[/interval.nanosec]]".
Các thành phần tùy chọn nếu bị lược bỏ sẽ gán giá trị 0 cho
các trường cấu trúc tương ứng. */
void
itimerspecFromStr(char *str, struct itimerspec *tsp)
{
char *cptr, *sptr;
cptr = strchr(str, ':');
if (cptr != NULL)
*cptr = '\0';
sptr = strchr(str, '/');
if (sptr != NULL)
*sptr = '\0';
tsp->it_value.tv_sec = atoi(str);
tsp->it_value.tv_nsec = (sptr != NULL) ? atoi(sptr + 1) : 0;

```

```c

if (cptr == NULL) {
tsp->it_interval.tv_sec = 0;
tsp->it_interval.tv_nsec = 0;
} else {
sptr = strchr(cptr + 1, '/');
if (sptr != NULL)
*sptr = '\0';
tsp->it_interval.tv_sec = atoi(cptr + 1);
tsp->it_interval.tv_nsec = (sptr != NULL) ? atoi(sptr + 1) : 0;
}
}
––––––––––––––––––––––––––––––––––––––––––––––– timers/itimerspec_from_str.c

```

Chúng ta minh họa việc sử dụng chương trình trong [Liệt kê 23-5](#page-23-0) trong phiên shell sau đây, tạo một bộ định thời duy nhất với thời gian hết hạn ban đầu là 2 giây và khoảng thời gian lặp lại là 5 giây.

```bash

$ ./ptmr_sigev_signal 2:5
Timer ID: 134524952 (2:5)
[15:54:56] Got signal 64 SIGRTMAX is signal 64 on this system
*sival_ptr = 134524952 sival_ptr points to the variable tid
timer_getoverrun() = 0
[15:55:01] Got signal 64
*sival_ptr = 134524952
timer_getoverrun() = 0
Type Control-Z to suspend the process
[1]+ Stopped ./ptmr_sigev_signal 2:5

```

Sau khi tạm dừng (suspend) chương trình, chúng ta chờ trong vài giây, cho phép một vài lần hết hạn của bộ định thời xảy ra trước khi tiếp tục (resume) chương trình:

```bash

$ fg
./ptmr_sigev_signal 2:5
[15:55:34] Got signal 64
*sival_ptr = 134524952
timer_getoverrun() = 5
Type Control-C to kill the program

```

Dòng cuối cùng của đầu ra chương trình cho thấy năm lần tràn bộ định thời (timer overrun) đã xảy ra, nghĩa là sáu lần hết hạn bộ định thời đã diễn ra kể từ lần gửi tín hiệu trước đó.

### 23.6.6 Tràn Timer (Timer Overruns)

Giả sử chúng ta đã chọn nhận thông báo về việc timer hết hạn thông qua cơ chế gửi tín hiệu (signal) (tức là `sigev_notify` là `SIGEV_SIGNAL`). Giả sử tiếp rằng timer hết hạn nhiều lần trước khi tín hiệu tương ứng được bắt hoặc chấp nhận. Điều này có thể xảy ra do độ trễ trước khi tiến trình (process) được lên lịch chạy lần tiếp theo. Hoặc cách khác, điều này có thể xảy ra do việc gửi tín hiệu tương ứng bị chặn (blocked), hoặc là một cách tường minh thông qua `sigprocmask()`, hoặc là một cách ngầm định trong quá trình thực thi hàm xử lý tín hiệu (signal handler). Làm thế nào chúng ta biết rằng các hiện tượng tràn timer (timer overrun) như vậy đã xảy ra?

Chúng ta có thể cho rằng việc sử dụng tín hiệu thời gian thực (realtime signal) sẽ giúp giải quyết vấn đề này, vì nhiều thể hiện (instance) của một realtime signal được đưa vào hàng đợi (queue). Tuy nhiên, phương pháp này tỏ ra không khả thi, bởi vì có các giới hạn về số lượng realtime signal có thể được đưa vào hàng đợi. Do đó, ủy ban POSIX.1b đã quyết định chọn một phương pháp khác: nếu chúng ta chọn nhận thông báo timer thông qua một tín hiệu, thì nhiều thể hiện của tín hiệu đó sẽ không bao giờ được đưa vào hàng đợi, ngay cả khi chúng ta sử dụng realtime signal. Thay vào đó, sau khi nhận được tín hiệu (thông qua signal handler hoặc bằng cách sử dụng `sigwaitinfo()`), chúng ta có thể lấy số đếm tràn timer (timer overrun count), đây là số lượng lần timer hết hạn bổ sung xảy ra trong khoảng thời gian từ lúc tín hiệu được tạo (generated) cho đến lúc nó được nhận (received). Ví dụ, nếu timer đã hết hạn ba lần kể từ lần nhận tín hiệu cuối cùng, thì số đếm tràn sẽ là 2.

Sau khi nhận được tín hiệu timer, chúng ta có thể lấy số đếm tràn timer theo hai cách:

- Gọi hàm `timer_getoverrun()`, mà chúng ta sẽ mô tả bên dưới. Đây là cách lấy số đếm tràn do SUSv3 quy định.
- Sử dụng giá trị trong trường `si_overrun` của cấu trúc `siginfo_t` được trả về cùng với tín hiệu. Phương pháp này giúp tiết kiệm chi phí overhead của System Call `timer_getoverrun()`, nhưng là một phần mở rộng của Linux và không mang tính di động (nonportable Linux extension).

Số đếm tràn timer được đặt lại (reset) mỗi khi chúng ta nhận được tín hiệu timer. Nếu timer chỉ hết hạn một lần kể từ khi tín hiệu timer được xử lý hoặc chấp nhận, thì số đếm tràn sẽ là 0 (tức là không có lần tràn nào).

```c

## define _POSIX_C_SOURCE 199309

## include <time.h>

int timer_getoverrun(timer_t timerid);
Trả về số đếm tràn timer nếu thành công, hoặc –1 nếu có lỗi

```

Hàm `timer_getoverrun()` trả về số đếm tràn cho timer được chỉ định bởi tham số `timerid` của nó.

Hàm `timer_getoverrun()` là một trong những hàm được quy định là an toàn với tín hiệu bất đồng bộ (async-signal-safe) trong SUSv3 (Bảng 21-1, trang 426), vì vậy việc gọi nó từ bên trong một signal handler là hoàn toàn an toàn.

### 23.6.7 Thông báo qua Thread (Thread)

Cờ `SIGEV_THREAD` cho phép chương trình nhận thông báo về việc bộ đếm thời gian (timer) hết hạn thông qua việc gọi một hàm trong một thread riêng biệt. Việc hiểu rõ cờ này đòi hỏi kiến thức về POSIX threads (luồng POSIX) mà chúng ta sẽ trình bày sau ở Chương 29 và 30. Những độc giả chưa quen thuộc với POSIX threads có thể muốn đọc các chương đó trước khi xem xét chương trình ví dụ mà chúng ta trình bày trong phần này.

[Liệt kê 23-7](#page-27-0) minh họa việc sử dụng `SIGEV_THREAD`. Chương trình này nhận các tham số dòng lệnh (command-line arguments) giống như chương trình trong Liệt kê 23-5. Chương trình thực hiện các bước sau:

- Đối với mỗi tham số dòng lệnh, chương trình tạo y và kích hoạt u một POSIX timer sử dụng cơ chế thông báo `SIGEV_THREAD` e.
- Mỗi khi timer này hết hạn, hàm được chỉ định bởi `sev.sigev_notify_function` r sẽ được gọi trong một thread riêng biệt. Khi hàm này được gọi, nó nhận giá trị được chỉ định trong `sev.sigev_value.sival_ptr` làm tham số. Chúng ta gán địa chỉ của ID timer (`tidlist[j]`) cho trường này t để hàm thông báo có thể lấy được ID của timer đã gây ra lệnh gọi nó.
- Sau khi đã tạo và kích hoạt tất cả các timer, chương trình chính bước vào một vòng lặp chờ các timer hết hạn i. Mỗi lần lặp qua vòng lặp, chương trình sử dụng `pthread_cond_wait()` để chờ một biến điều kiện (condition variable - `cond`) phát tín hiệu từ thread đang xử lý thông báo timer.
- Hàm `threadFunc()` được gọi mỗi khi một timer hết hạn q. Sau khi in ra một thông báo, nó tăng giá trị của biến toàn cục `expireCnt`. Để tính toán đến khả năng tràn timer (timer overrun), giá trị trả về bởi `timer_getoverrun()` cũng được cộng thêm vào `expireCnt`. (Chúng ta đã giải thích về hiện tượng tràn timer trong Mục [23.6.6](#page-24-0) liên quan đến cơ chế thông báo `SIGEV_SIGNAL`. Tràn timer cũng có thể xuất hiện với cơ chế `SIGEV_THREAD`, bởi vì một timer có thể hết hạn nhiều lần trước khi hàm thông báo được gọi.) Hàm thông báo cũng phát tín hiệu cho biến điều kiện `cond` để chương trình chính biết đường kiểm tra rằng một timer đã hết hạn w.

Nhật ký phiên shell (shell session log) sau đây minh họa việc sử dụng chương trình trong Liệt kê 23-7. Trong ví dụ này, chương trình tạo ra hai timer: một timer có thời gian hết hạn ban đầu là 5 giây và chu kỳ lặp là 5 giây, và một timer khác có thời gian hết hạn ban đầu là 10 giây và chu kỳ lặp là 10 giây.

```

$ ./ptmr_sigev_thread 5:5 10:10
Timer ID: 134525024 (5:5)
Timer ID: 134525080 (10:10)
[13:06:22] Thread notify
timer ID=134525024
timer_getoverrun()=0
main(): count = 1
[13:06:27] Thread notify
timer ID=134525080
timer_getoverrun()=0
main(): count = 2
[13:06:27] Thread notify
timer ID=134525024
timer_getoverrun()=0
main(): count = 3
Type Control-Z to suspend the program
[1]+ Stopped ./ptmr_sigev_thread 5:5 10:10
$ fg Resume execution
./ptmr_sigev_thread 5:5 10:10
[13:06:45] Thread notify
timer ID=134525024
timer_getoverrun()=2 There were timer overruns
main(): count = 6
[13:06:45] Thread notify
timer ID=134525080
timer_getoverrun()=0
main(): count = 7
Type Control-C to kill the program

```

**Liệt kê 23-7:** Thông báo POSIX timer sử dụng một hàm thread

```

–––––––––––––––––––––––––––––––––––––––––––––––––timers/ptmr_sigev_thread.c

## include <signal.h>

## include <time.h>

## include <pthread.h>

## include "curr_time.h" /* Khai báo của currTime() */

## include "tlpi_hdr.h"

## include "itimerspec_from_str.h" /* Khai báo itimerspecFromStr() */

static pthread_mutex_t mtx = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
static int expireCnt = 0; /* Số lần hết hạn của tất cả các timer */
static void /* Hàm thông báo qua Thread */
q threadFunc(union sigval sv)
{
timer_t *tidptr;
int s;
tidptr = sv.sival_ptr;
printf("[%s] Thread notify\n", currTime("%T"));
printf(" timer ID=%ld\n", (long) *tidptr);
printf(" timer_getoverrun()=%d\n", timer_getoverrun(*tidptr));
/* Tăng biến đếm được chia sẻ với thread chính và phát tín hiệu
cho biến điều kiện để thông báo cho thread chính về sự thay đổi. */
s = pthread_mutex_lock(&mtx);
if (s != 0)
errExitEN(s, "pthread_mutex_lock");
expireCnt += 1 + timer_getoverrun(*tidptr);
s = pthread_mutex_unlock(&mtx);
if (s != 0)
errExitEN(s, "pthread_mutex_unlock");
w s = pthread_cond_signal(&cond);
if (s != 0)
errExitEN(s, "pthread_cond_signal");
}
int
main(int argc, char *argv[])
{
struct sigevent sev;
struct itimerspec ts;
timer_t *tidlist;
int s, j;

```

```

if (argc < 2)
usageErr("%s secs[/nsecs][:int-secs[/int-nsecs]]...\n", argv[0]);
tidlist = calloc(argc - 1, sizeof(timer_t));
if (tidlist == NULL)
errExit("malloc");
e sev.sigev_notify = SIGEV_THREAD; /* Thông báo qua thread */
r sev.sigev_notify_function = threadFunc; /* Hàm khởi đầu của thread */
sev.sigev_notify_attributes = NULL;
/* Có thể là con trỏ trỏ tới cấu trúc pthread_attr_t */
/* Tạo và khởi động một timer cho mỗi tham số dòng lệnh */
for (j = 0; j < argc - 1; j++) {
itimerspecFromStr(argv[j + 1], &ts);
t sev.sigev_value.sival_ptr = &tidlist[j];
/* Được truyền làm tham số cho threadFunc() */
y if (timer_create(CLOCK_REALTIME, &sev, &tidlist[j]) == -1)
errExit("timer_create");
printf("Timer ID: %ld (%s)\n", (long) tidlist[j], argv[j + 1]);
u if (timer_settime(tidlist[j], 0, &ts, NULL) == -1)
errExit("timer_settime");
}
/* Thread chính chờ trên một biến điều kiện được phát tín hiệu
vào mỗi lần gọi hàm thông báo thread. Chúng ta
in ra một thông báo để người dùng có thể thấy điều này đã xảy ra. */
s = pthread_mutex_lock(&mtx);
if (s != 0)
errExitEN(s, "pthread_mutex_lock");
i for (;;) {
s = pthread_cond_wait(&cond, &mtx);
if (s != 0)
errExitEN(s, "pthread_cond_wait");
printf("main(): expireCnt = %d\n", expireCnt);
}
}
–––––––––––––––––––––––––––––––––––––––––––––––––timers/ptmr_sigev_thread.c

```

## 23.7 Bộ định thời thông báo qua File Descriptor: API timerfd

Bắt đầu từ phiên bản kernel 2.6.25, Linux cung cấp một API khác để tạo bộ định thời (timer). API `timerfd` đặc trưng của Linux tạo ra một bộ định thời mà thông báo hết hạn của nó có thể được đọc từ một file descriptor (mô tả tệp). Điều này rất hữu ích vì file descriptor này có thể được giám sát cùng với các descriptor khác bằng cách sử dụng `select()`, `poll()` và `epoll` (được mô tả trong Chương 63). (Với các API bộ định thời khác được thảo luận trong chương này, cần tốn một chút công sức để có thể đồng thời giám sát một hoặc nhiều bộ định thời cùng với một tập hợp các file descriptor).

Hoạt động của ba system call (lệnh gọi hệ thống) mới trong API này tương tự như hoạt động của các system call `timer_create()`, `timer_settime()` và `timer_gettime()` được mô tả trong Mục [23.6.](#page-16-0)

System call đầu tiên trong số các system call mới là `timerfd_create()`, hàm này tạo một đối tượng bộ định thời mới và trả về một file descriptor tham chiếu đến đối tượng đó.

```c

## include <sys/timerfd.h>

int timerfd_create(int clockid, int flags);
Trả về file descriptor nếu thành công, hoặc –1 nếu lỗi

```

Giá trị của `clockid` có thể là `CLOCK_REALTIME` hoặc `CLOCK_MONOTONIC` (xem Bảng 23-1).

Trong phiên bản cài đặt ban đầu của `timerfd_create()`, đối số `flags` được dành riêng cho việc sử dụng trong tương lai và bắt buộc phải được chỉ định là 0. Tuy nhiên, kể từ Linux 2.6.27, hai cờ (flags) được hỗ trợ:

### TFD_CLOEXEC

Thiết lập cờ đóng khi thực thi (`FD_CLOEXEC`) cho file descriptor mới. Cờ này hữu ích vì những lý do tương tự như cờ `O_CLOEXEC` của hàm `open()` được mô tả trong Mục 4.3.1.

### TFD_NONBLOCK

Thiết lập cờ `O_NONBLOCK` trên mô tả tệp mở cơ sở (underlying open file description), để các thao tác đọc trong tương lai sẽ là không chặn (nonblocking). Điều này giúp tiết kiệm các lời gọi bổ sung tới `fnctl()` để đạt được cùng một kết quả.

Khi chúng ta đã sử dụng xong bộ định thời được tạo bởi `timerfd_create()`, chúng ta nên gọi `close()` đối với file descriptor liên quan, để kernel có thể giải phóng các tài nguyên liên quan đến bộ định thời đó.

System call `timerfd_settime()` kích hoạt (bắt đầu) hoặc vô hiệu hóa (dừng) bộ định thời được tham chiếu bởi file descriptor `fd`.

```c

## include <sys/timerfd.h>

int timerfd_settime(int fd, int flags, const struct itimerspec *new_value,
struct itimerspec *old_value);
Trả về 0 nếu thành công, hoặc –1 nếu lỗi

```

Đối số `new_value` chỉ định các thiết lập mới cho bộ định thời. Đối số `old_value` có thể được sử dụng để trả về các thiết lập trước đó của bộ định thời (xem mô tả về `timerfd_gettime()` bên dưới để biết chi tiết). Nếu chúng ta không quan tâm đến các thiết lập trước đó, chúng ta có thể chỉ định `old_value` là `NULL`. Cả hai đối số này đều là cấu trúc `itimerspec` được sử dụng theo cách tương tự như đối với `timer_settime()` (xem Mục [23.6.2\)](#page-19-0).

Đối số `flags` tương tự như đối số tương ứng của hàm `timer_settime()`. Nó có thể mang giá trị 0, nghĩa là `new_value.it_value` được diễn giải tương đối so với thời điểm gọi `timerfd_settime()`, hoặc nó có thể là `TFD_TIMER_ABSTIME`, nghĩa là `new_value.it_value` được diễn giải như một thời gian tuyệt đối (tức là được tính từ điểm gốc của đồng hồ).

System call `timerfd_gettime()` trả về khoảng thời gian (interval) và thời gian còn lại cho bộ định thời được nhận diện bởi file descriptor `fd`.

```c

## include <sys/timerfd.h>

int timerfd_gettime(int fd, struct itimerspec *curr_value);
Trả về 0 nếu thành công, hoặc –1 nếu lỗi

```

Giống như `timer_gettime()`, khoảng thời gian và thời gian cho đến lần hết hạn tiếp theo của bộ định thời được trả về trong cấu trúc `itimerspec` do `curr_value` trỏ tới. Trường `curr_value.it_value` trả về thời gian cho đến lần hết hạn tiếp theo của bộ định thời, ngay cả khi bộ định thời này được thiết lập như một bộ định thời tuyệt đối bằng cách sử dụng `TFD_TIMER_ABSTIME`. Nếu cả hai trường của cấu trúc `curr_value.it_value` được trả về đều bằng 0, thì bộ định thời hiện đang bị vô hiệu hóa. Nếu cả hai trường của cấu trúc `curr_value.it_interval` được trả về đều bằng 0, thì bộ định thời chỉ hết hạn một lần duy nhất, vào thời điểm được chỉ định trong `curr_value.it_value`.

### Tương tác của timerfd với fork() và exec()

Trong một tiến trình (`process`) thực hiện `fork()`, tiến trình con sẽ kế thừa các bản sao của các mô tả tệp (`file descriptor`) được tạo bởi `timerfd_create()`. Các mô tả tệp này trỏ đến cùng các đối tượng bộ định thời (`timer object`) giống như các mô tả tương ứng ở tiến trình cha, và các lần hết hạn bộ định thời (`timer expiration`) có thể được đọc ở bất kỳ tiến trình nào.

Các mô tả tệp được tạo bởi `timerfd_create()` được giữ lại qua lời gọi `exec()` (trừ khi các mô tả này được đánh dấu là `close-on-exec`, như được mô tả trong Mục 27.4), và các bộ định thời đã được kích hoạt (`armed timer`) sẽ tiếp tục tạo ra các lần hết hạn sau khi `exec()`.

### Đọc từ mô tả tệp timerfd

Một khi chúng ta đã kích hoạt (`arm`) một bộ định thời bằng `timerfd_settime()`, chúng ta có thể sử dụng `read()` để đọc thông tin về các lần hết hạn của bộ định thời từ mô tả tệp liên quan. Cho mục đích này, bộ đệm (`buffer`) được truyền vào `read()` phải đủ lớn để chứa một số nguyên 8-byte không dấu (`uint64_t`).

Nếu có một hoặc nhiều lần hết hạn đã xảy ra kể từ lần sửa đổi cài đặt bộ định thời gần nhất bằng `timerfd_settime()` hoặc lần gọi `read()` gần nhất, thì `read()` sẽ trả về ngay lập tức, và bộ đệm trả về sẽ chứa số lượng lần hết hạn đã xảy ra. Nếu không có lần hết hạn nào xảy ra, thì `read()` sẽ chặn (`block`) cho đến khi lần hết hạn tiếp theo diễn ra. Cũng có thể sử dụng thao tác `fcntl()` `F_SETFL` (Mục 5.3) để thiết lập cờ `O_NONBLOCK` cho mô tả tệp, sao cho các thao tác đọc không bị chặn (`nonblocking`), và sẽ trả về lỗi `EAGAIN` nếu chưa có lần hết hạn nào xảy ra.

Như đã nêu trước đó, một mô tả tệp `timerfd` có thể được giám sát bằng `select()`, `poll()`, và `epoll`. Nếu bộ định thời đã hết hạn, thì mô tả tệp sẽ báo hiệu là có thể đọc được (`readable`).

### Chương trình mẫu

[Listing 23-8](#page-31-0) minh họa cách sử dụng API `timerfd`. Chương trình này nhận hai tham số dòng lệnh (`command-line argument`). Tham số đầu tiên là bắt buộc, chỉ định thời gian ban đầu và khoảng thời gian (interval) cho bộ định thời. (Tham số này được phân giải bằng hàm `itimerspecFromStr()` được trình bày trong [Listing 23-6](#page-23-0).) Tham số thứ hai, là tùy chọn, chỉ định số lần hết hạn tối đa của bộ định thời mà chương trình nên chờ trước khi kết thúc; giá trị mặc định cho tham số này là 1.

Chương trình tạo một bộ định thời bằng `timerfd_create()` và kích hoạt nó bằng `timerfd_settime()`. Sau đó, nó thực hiện vòng lặp đọc các thông báo hết hạn từ mô tả tệp cho đến khi đạt được số lần hết hạn được chỉ định. Sau mỗi lần `read()`, chương trình hiển thị thời gian đã trôi qua kể từ khi bộ định thời được khởi động, số lần hết hạn đọc được, và tổng số lần hết hạn tính đến thời điểm đó.

Trong nhật ký phiên làm việc shell sau đây, các tham số dòng lệnh chỉ định một bộ định thời với giá trị ban đầu là 1 giây, khoảng lặp 1 giây, và tối đa 100 lần hết hạn.

```

$ ./demo_timerfd 1:1 100
1.000: expirations read: 1; total=1
2.000: expirations read: 1; total=2
3.000: expirations read: 1; total=3
Type Control-Z to suspend program in background for a few seconds
[1]+ Stopped ./demo_timerfd 1:1 100
$ fg Resume program in foreground
./demo_timerfd 1:1 100
14.205: expirations read: 11; total=14 Multiple expirations since last read()
15.000: expirations read: 1; total=15
16.000: expirations read: 1; total=16
Type Control-C to terminate the program

```

Từ kết quả đầu ra trên, chúng ta có thể thấy rằng nhiều lần hết hạn của bộ định thời đã xảy ra trong khi chương trình bị tạm dừng (`suspend`) ở chế độ nền (`background`), và tất cả các lần hết hạn này đã được trả về trong lần `read()` đầu tiên sau khi chương trình tiếp tục thực thi.

**Listing 23-8:** Sử dụng API `timerfd`

```

––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/demo_timerfd.c

## include <sys/timerfd.h>

## include <time.h>

## include <stdint.h> /* Definition of uint64_t */

## include "itimerspec_from_str.h" /* Declares itimerspecFromStr() */

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct itimerspec ts;
struct timespec start, now;
int maxExp, fd, secs, nanosecs;
uint64_t numExp, totalExp;
ssize_t s;
if (argc < 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s secs[/nsecs][:int-secs[/int-nsecs]] [max-exp]\n", argv[0]);
itimerspecFromStr(argv[1], &ts);
maxExp = (argc > 2) ? getInt(argv[2], GN_GT_0, "max-exp") : 1;

```

```

fd = timerfd_create(CLOCK_REALTIME, 0);
if (fd == -1)
errExit("timerfd_create");
if (timerfd_settime(fd, 0, &ts, NULL) == -1)
errExit("timerfd_settime");
if (clock_gettime(CLOCK_MONOTONIC, &start) == -1)
errExit("clock_gettime");
for (totalExp = 0; totalExp < maxExp;) {
/* Read number of expirations on the timer, and then display
time elapsed since timer was started, followed by number
of expirations read and total expirations so far. */
s = read(fd, &numExp, sizeof(uint64_t));
if (s != sizeof(uint64_t))
errExit("read");
totalExp += numExp;
if (clock_gettime(CLOCK_MONOTONIC, &now) == -1)
errExit("clock_gettime");
secs = now.tv_sec - start.tv_sec;
nanosecs = now.tv_nsec - start.tv_nsec;
if (nanosecs < 0) {
secs--;
nanosecs += 1000000000;
}
printf("%d.%03d: expirations read: %llu; total=%llu\n",
secs, (nanosecs + 500000) / 1000000,
(unsigned long long) numExp, (unsigned long long) totalExp);
}
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– timers/demo_timerfd.c

```

## 23.8 Tổng kết

Một tiến trình (process) có thể sử dụng `setitimer()` hoặc `alarm()` để thiết lập một bộ định thời (timer), sao cho nó nhận được một tín hiệu (signal) sau khi một khoảng thời gian thực (real time) hoặc thời gian tiến trình (process time) được chỉ định trôi qua. Một trong những ứng dụng của bộ định thời là đặt giới hạn trên cho khoảng thời gian mà một System Call (lời gọi hệ thống) có thể bị chặn (block).

Các ứng dụng cần tạm dừng việc thực thi trong một khoảng thời gian thực được chỉ định có thể sử dụng nhiều hàm tạm dừng (sleep) khác nhau cho mục đích này.

Linux 2.6 triển khai các phần mở rộng POSIX.1b định nghĩa một API cho các đồng hồ (clock) và bộ định thời độ chính xác cao. Bộ định thời POSIX.1b cung cấp một số ưu điểm so với bộ định thời UNIX truyền thống (`setitimer()`). Chúng ta có thể: tạo nhiều bộ định thời; chọn tín hiệu được gửi khi bộ định thời hết hạn; truy xuất số lần tràn bộ định thời (timer overrun count) để xác định xem bộ định thời đã hết hạn nhiều lần kể từ thông báo hết hạn cuối cùng hay chưa; và chọn nhận thông báo bộ định thời thông qua việc thực thi một hàm luồng (thread function) thay vì gửi tín hiệu.

API `timerfd` đặc trưng của Linux cung cấp một tập hợp các giao diện để tạo bộ định thời tương tự như API bộ định thời POSIX, nhưng cho phép đọc các thông báo bộ định thời thông qua một bộ mô tả tệp (file descriptor). Bộ mô tả tệp này có thể được giám sát bằng cách sử dụng `select()`, `poll()` và `epoll`.

### Thông tin thêm

Dưới phần lý giải cho từng hàm riêng lẻ, SUSv3 cung cấp các ghi chú hữu ích về giao diện bộ hẹn giờ và tạm dừng (tiêu chuẩn) được mô tả trong chương này. [Gallmeister, 1995] thảo luận về các đồng hồ và bộ hẹn giờ POSIX.1b.

## 23.9 Bài tập

- **23-1.** Mặc dù `alarm()` được triển khai như một lời hệ thống bên trong Linux kernel, điều này là dư thừa. Hãy triển khai `alarm()` bằng cách sử dụng `setitimer()`.
- **23-2.** Thử chạy chương trình trong [Listing 23-3](#page-11-0) (`t_nanosleep.c`) ở chế độ nền (background) với khoảng thời gian tạm dừng là 60 giây, trong khi sử dụng lệnh sau để gửi càng nhiều tín hiệu `SIGINT` càng tốt đến tiến trình nền:
  - \$ **while true; do kill -INT** *pid***; done**

Bạn sẽ quan sát thấy chương trình tạm dừng lâu hơn dự kiến. Hãy thay thế việc sử dụng `nanosleep()` bằng cách sử dụng `clock_gettime()` (sử dụng đồng hồ `CLOCK_REALTIME`) và `clock_nanosleep()` với cờ `TIMER_ABSTIME`. (Bài tập này yêu cầu Linux 2.6). Lặp lại thử nghiệm với chương trình đã sửa đổi và giải thích sự khác biệt.

- **23-3.** Viết một chương trình để chứng minh rằng nếu đối số `evp` cho `timer_create()` được chỉ định là `NULL`, thì điều này tương đương với việc chỉ định `evp` là con trỏ tới cấu trúc `sigevent` với `sigev_notify` được thiết lập thành `SIGEV_SIGNAL`, `sigev_signo` được thiết lập thành `SIGALRM` và `si_value.sival_int` được thiết lập thành ID bộ hẹn giờ (timer ID).
- **23-4.** Sửa đổi chương trình trong Listing 23-5 (`ptmr_sigev_signal.c`) để sử dụng `sigwaitinfo()` thay vì một trình xử lý tín hiệu (signal handler).
