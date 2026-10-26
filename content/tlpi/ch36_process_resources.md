# Chương 36: TÀI NGUYÊN TIẾN TRÌNH (PROCESS RESOURCES)

Mỗi tiến trình (process) tiêu thụ các tài nguyên hệ thống (system resources) như bộ nhớ và thời gian CPU. Chương trình này xem xét các system call liên quan đến tài nguyên. Chúng ta bắt đầu với system call `getrusage()`, cho phép một tiến trình theo dõi các tài nguyên mà nó đã sử dụng hoặc các tiến trình con của nó đã sử dụng. Sau đó, chúng ta xem xét các system call `setrlimit()` và `getrlimit()`, có thể được sử dụng để thay đổi và truy xuất các giới hạn về mức độ tiêu thụ các tài nguyên khác nhau của tiến trình gọi.

## 36.1 Sử dụng Tài nguyên Tiến trình (Process Resource Usage)

System call `getrusage()` truy xuất các thống kê về các tài nguyên hệ thống khác nhau được sử dụng bởi tiến trình gọi hoặc bởi tất cả các tiến trình con của nó.

```
## include <sys/resource.h>
```

int **getrusage**(int who, struct rusage \*res\_usage);

Trả về 0 khi thành công, hoặc –1 khi xảy ra lỗi

Đối số `who` chỉ định (các) tiến trình mà thông tin sử dụng tài nguyên sẽ được truy xuất. Nó nhận một trong các giá trị sau:

```
RUSAGE_SELF
```

Trả về thông tin về tiến trình gọi.

### RUSAGE\_CHILDREN

Trả về thông tin về tất cả các tiến trình con của tiến trình gọi đã kết thúc (terminated) và đã được chờ (waited for).

```
RUSAGE_THREAD (since Linux 2.6.26)
```

Trả về thông tin về luồng (thread) gọi. Giá trị này dành riêng cho Linux (Linux-specific).

Đối số `res_usage` là một con trỏ tới một cấu trúc (structure) kiểu `rusage`, được định nghĩa như trong [Liệt kê 36-1.](#page-21-0)

**Liệt kê 36-1:** Định nghĩa cấu trúc rusage

```
struct rusage {
 struct timeval ru_utime; /* Thời gian CPU ở User Space đã dùng */
 struct timeval ru_stime; /* Thời gian CPU ở Kernel Space đã dùng */
 long ru_maxrss; /* Kích thước tối đa của tập thường trú - resident set (kilobytes)
 [được sử dụng từ Linux 2.6.32] */
 long ru_ixrss; /* Kích thước bộ nhớ văn bản tích phân (chia sẻ)
 (kilobyte-seconds) [không sử dụng] */
 long ru_idrss; /* Bộ nhớ dữ liệu tích phân (không chia sẻ) đã dùng
 (kilobyte-seconds) [không sử dụng] */
 long ru_isrss; /* Bộ nhớ ngăn xếp tích phân (không chia sẻ) đã dùng
 (kilobyte-seconds) [không sử dụng] */
 long ru_minflt; /* Lỗi trang mềm - soft page faults (không yêu cầu I/O) */
 long ru_majflt; /* Lỗi trang cứng - hard page faults (yêu cầu I/O) */
 long ru_nswap; /* Số lần swap khỏi bộ nhớ vật lý [không sử dụng] */
 long ru_inblock; /* Các thao tác nhập khối qua hệ thống tệp
 [được sử dụng từ Linux 2.6.22] */
 long ru_oublock; /* Các thao tác xuất khối qua hệ thống tệp
 [được sử dụng từ Linux 2.6.22] */
 long ru_msgsnd; /* Thông điệp IPC đã gửi [không sử dụng] */
 long ru_msgrcv; /* Thông điệp IPC đã nhận [không sử dụng] */
 long ru_nsignals; /* Tín hiệu đã nhận [không sử dụng] */
 long ru_nvcsw; /* Chuyển đổi ngữ cảnh tự nguyện - voluntary context switches (tiến trình
 từ bỏ CPU trước khi hết lát cắt thời gian - time slice
 [được sử dụng từ Linux 2.6] */
 long ru_nivcsw; /* Chuyển đổi ngữ cảnh không tự nguyện - involuntary context switches (tiến trình
 có độ ưu tiên cao hơn trở nên khả chạy hoặc hết
 lát cắt thời gian) [được sử dụng từ Linux 2.6] */
};
```

Như được chỉ ra trong các chú thích ở [Liệt kê 36-1](#page-21-0), trên Linux, nhiều trường trong cấu trúc `rusage` không được điền bởi `getrusage()` (hoặc `wait3()` và `wait4()`), hoặc chúng chỉ được điền bởi các phiên bản kernel mới hơn. Một số trường không được sử dụng trên Linux lại được sử dụng trên các triển khai UNIX khác. Các trường này được cung cấp trên Linux để nếu chúng được triển khai vào một ngày nào đó trong tương lai, cấu trúc `rusage` sẽ không phải trải qua một sự thay đổi làm phá vỡ các tệp nhị phân ứng dụng (application binaries) hiện có.

Mặc dù `getrusage()` xuất hiện trên hầu hết các bản triển khai UNIX, nhưng nó chỉ được quy định lỏng lẻo trong SUSv3 (chỉ quy định các trường `ru_utime` và `ru_stime`). Một phần là do ý nghĩa của phần lớn thông tin trong cấu trúc `rusage` phụ thuộc vào bản triển khai (implementation-dependent).

Các trường `ru_utime` và `ru_stime` là các cấu trúc kiểu `timeval` (Mục 10.1), trả về số giây và micro giây thời gian CPU tiêu thụ bởi một tiến trình ở chế độ người dùng (user mode) và chế độ nhân (kernel mode) tương ứng. (Thông tin tương tự được truy xuất bởi system call `times()` được mô tả ở Mục 10.7).

> Tệp `/proc/PID/stat` đặc thù của Linux cung cấp một số thông tin sử dụng tài nguyên (thời gian CPU và lỗi trang - page faults) về tất cả các tiến trình trên hệ thống. Xem trang hướng dẫn (manual page) `proc(5)` để biết thêm chi tiết.

Cấu trúc `rusage` được trả về bởi thao tác `RUSAGE_CHILDREN` của `getrusage()` bao gồm các thống kê sử dụng tài nguyên của tất cả các tiến trình hậu duệ (descendants) của tiến trình gọi. Ví dụ, nếu chúng ta có ba tiến trình có quan hệ là cha, con và cháu, thì khi tiến trình con thực hiện hàm `wait()` đối với tiến trình cháu, các giá trị sử dụng tài nguyên của tiến trình cháu được cộng vào các giá trị `RUSAGE_CHILDREN` của tiến trình con; khi tiến trình cha thực hiện hàm `wait()` đối với tiến trình con, các giá trị sử dụng tài nguyên của cả tiến trình con và tiến trình cháu đều được cộng vào các giá trị `RUSAGE_CHILDREN` của tiến trình cha. Ngược lại, nếu tiến trình con không gọi `wait()` đối với tiến trình cháu, thì việc sử dụng tài nguyên của tiến trình cháu sẽ không được ghi lại trong các giá trị `RUSAGE_CHILDREN` của tiến trình cha.

Đối với thao tác `RUSAGE_CHILDREN`, trường `ru_maxrss` trả về kích thước tập thường trú tối đa trong số tất cả các tiến trình hậu duệ của tiến trình gọi (thay vì là tổng của tất cả các hậu duệ).

> SUSv3 quy định rằng nếu tín hiệu SIGCHLD bị bỏ qua (để các tiến trình con không biến thành tiến trình thây ma - zombie có thể thực hiện hàm wait), thì các thống kê của tiến trình con không được cộng vào các giá trị do RUSAGE\_CHILDREN trả về. Tuy nhiên, như đã lưu ý ở Mục 26.3.3, trong các phiên bản kernel trước 2.6.9, Linux không tuân theo yêu cầu này—nếu SIGCHLD bị bỏ qua, thì các giá trị sử dụng tài nguyên của các tiến trình con đã chết vẫn được bao gồm trong các giá trị trả về cho RUSAGE\_CHILDREN.

## 36.2 Giới hạn tài nguyên tiến trình (Process Resource Limits)

Mỗi tiến trình (process) có một tập hợp các giới hạn tài nguyên có thể được sử dụng để hạn chế lượng tài nguyên hệ thống khác nhau mà tiến trình đó được phép tiêu thụ. Ví dụ, chúng ta có thể muốn thiết lập giới hạn tài nguyên cho một tiến trình trước khi thực thi (exec) một chương trình bất kỳ, nếu chúng ta lo ngại rằng nó có thể tiêu thụ tài nguyên quá mức. Chúng ta có thể thiết lập giới hạn tài nguyên của shell bằng cách sử dụng lệnh nội tại `ulimit` (hoặc lệnh `limit` trong C shell). Các giới hạn này được kế thừa bởi các tiến trình do shell tạo ra để thực thi lệnh của người dùng.

> Kể từ phiên bản kernel 2.6.24, tệp chuyên biệt của Linux `/proc/PID/limits` có thể được sử dụng để xem toàn bộ giới hạn tài nguyên của bất kỳ tiến trình nào. Tệp này thuộc quyền sở hữu của UID thực (real user ID) của tiến trình tương ứng và quyền của nó chỉ cho phép đọc bởi UID đó (hoặc bởi một tiến trình có đặc quyền - privileged process).

Các system call `getrlimit()` và `setrlimit()` cho phép một tiến trình lấy và sửa đổi giới hạn tài nguyên của chính nó.

```
## include <sys/resource.h>
int getrlimit(int resource, struct rlimit *rlim);
int setrlimit(int resource, const struct rlimit *rlim);
                                         Cả hai đều trả về 0 khi thành công, hoặc –1 khi lỗi
```

Tham số `resource` xác định giới hạn tài nguyên cần truy xuất hoặc thay đổi. Tham số `rlim` được sử dụng để trả về các giá trị giới hạn tài nguyên (`getrlimit()`) hoặc để chỉ định các giá trị giới hạn tài nguyên mới (`setrlimit()`), và là một con trỏ trỏ đến một cấu trúc chứa hai trường (fields):

```
struct rlimit {
 rlim_t rlim_cur; /* Giới hạn mềm (giới hạn thực tế của tiến trình) */
 rlim_t rlim_max; /* Giới hạn cứng (trần giới hạn cho rlim_cur) */
};
```

Các trường này tương ứng với hai giới hạn liên quan cho một tài nguyên: giới hạn mềm (`rlim_cur`) và giới hạn cứng (`rlim_max`). (Kiểu dữ liệu `rlim_t` là một kiểu số nguyên). Giới hạn mềm chi phối lượng tài nguyên mà tiến trình được phép tiêu thụ. Một tiến trình có thể điều chỉnh giới hạn mềm thành bất kỳ giá trị nào từ 0 cho đến giới hạn cứng. Đối với hầu hết các tài nguyên, mục đích duy nhất của giới hạn cứng là cung cấp mức trần này cho giới hạn mềm. Một tiến trình có đặc quyền (`CAP_SYS_RESOURCE`) có thể điều chỉnh giới hạn cứng theo bất kỳ hướng nào (miễn là giá trị của nó vẫn lớn hơn giới hạn mềm), nhưng một tiến trình không có đặc quyền chỉ có thể điều chỉnh giới hạn cứng xuống mức thấp hơn (không thể đảo ngược). Giá trị `RLIM_INFINITY` trong `rlim_cur` hoặc `rlim_max` có nghĩa là vô hạn (không có giới hạn về tài nguyên), áp dụng cả khi truy xuất thông qua `getrlimit()` và khi thiết lập thông qua `setrlimit()`.

Trong phần lớn các trường hợp, giới hạn tài nguyên được áp dụng cho cả tiến trình có đặc quyền và không có đặc quyền. Chúng được kế thừa bởi các tiến trình con được tạo ra thông qua `fork()` và được bảo toàn qua lệnh `exec()`.

Các giá trị có thể được chỉ định cho tham số `resource` của `getrlimit()` và `setrlimit()` được tóm tắt trong [Bảng 36-1](#page-24-0) và được trình bày chi tiết ở Mục [36.3.](#page-27-1)

Mặc dù giới hạn tài nguyên là một thuộc tính trên mỗi tiến trình (per-process attribute), nhưng trong một số trường hợp, giới hạn này không chỉ được đo lường dựa trên mức tiêu thụ tài nguyên tương ứng của chính tiến trình đó, mà còn dựa trên tổng tài nguyên tiêu thụ bởi tất cả các tiến trình có cùng UID thực (real user ID). Giới hạn `RLIMIT_NPROC`, đặt ra giới hạn về số lượng tiến trình có thể được tạo, là một ví dụ điển hình cho lý do đằng sau phương pháp này. Việc áp dụng giới hạn này chỉ tính trên số lượng tiến trình con do chính tiến trình đó tạo ra sẽ không hiệu quả, vì mỗi tiến trình con do tiến trình đó tạo ra cũng có thể tiếp tục tạo ra các tiến trình con khác, cứ thế tiếp tục. Thay vào đó, giới hạn được đo lường dựa trên tổng số lượng tất cả các tiến trình có cùng UID thực. Tuy nhiên, lưu ý rằng giới hạn tài nguyên chỉ được kiểm tra ở những tiến trình đã thiết lập nó (tức là chính tiến trình đó và các tiến trình hậu duệ kế thừa giới hạn này). Nếu một tiến trình khác do cùng UID thực sở hữu chưa thiết lập giới hạn (tức là giới hạn là vô hạn) hoặc đã thiết lập một giới hạn khác, thì khả năng tạo tiến trình con của tiến trình đó sẽ được kiểm tra theo giới hạn mà nó đã thiết lập.

Khi chúng ta mô tả từng giới hạn tài nguyên dưới đây, chúng tôi sẽ lưu ý những giới hạn nào được đo lường dựa trên tài nguyên tiêu thụ bởi tất cả các tiến trình có cùng UID thực. Nếu không có chỉ định nào khác, giới hạn tài nguyên sẽ chỉ được đo lường dựa trên mức tiêu thụ tài nguyên của chính tiến trình đó.

Hãy lưu ý rằng trong nhiều trường hợp, các lệnh shell dùng để lấy và thiết lập giới hạn tài nguyên (`ulimit` trong bash và Korn shell, và `limit` trong C shell) sử dụng các đơn vị khác với các đơn vị được sử dụng trong `getrlimit()` và `setrlimit()`. Ví dụ, các lệnh shell thường biểu thị giới hạn về kích thước của các phân đoạn bộ nhớ khác nhau (memory segments) bằng đơn vị kilobyte.

**Bảng 36-1:** Các giá trị tài nguyên cho getrlimit() và setrlimit()

| tài nguyên        | Giới hạn trên                                             | SUSv3 |
|-------------------|-----------------------------------------------------------|-------|
| RLIMIT_AS         | Kích thước bộ nhớ ảo (virtual memory size) của tiến trình (bytes) | •     |
| RLIMIT_CORE       | Kích thước tệp core (bytes)                               | •     |
| RLIMIT_CPU        | Thời gian CPU (giây)                                      | •     |
| RLIMIT_DATA       | Phân đoạn dữ liệu (data segment) của tiến trình (bytes)   | •     |
| RLIMIT_FSIZE      | Kích thước tệp (bytes)                                    | •     |
| RLIMIT_MEMLOCK    | Bộ nhớ bị khóa (locked memory) (bytes)                    |       |
| RLIMIT_MSGQUEUE   | Số byte được cấp phát cho hàng đợi thông điệp (message queue) POSIX cho real user ID |       |
|                   | (từ Linux 2.6.8)                                          |       |
| RLIMIT_NICE       | Giá trị Nice (từ Linux 2.6.12)                            |       |
| RLIMIT_NOFILE     | Số hiệu File Descriptor tối đa cộng thêm một              | •     |
| RLIMIT_NPROC      | Số lượng tiến trình (Process) cho real user ID            |       |
| RLIMIT_RSS        | Kích thước tập thường trú (Resident Set Size - RSS) (bytes; chưa được hỗ trợ) |       |
| RLIMIT_RTPRIO     | Độ ưu tiên lập lịch thời gian thực (realtime scheduling priority) (từ Linux 2.6.12) |       |
| RLIMIT_RTTIME     | Thời gian CPU thời gian thực (micro giây; từ Linux 2.6.25)|       |
| RLIMIT_SIGPENDING | Số lượng tín hiệu (signal) đang chờ xử lý cho real user ID (từ |       |
|                   | Linux 2.6.8)                                              |       |
| RLIMIT_STACK      | Kích thước phân đoạn stack (bytes)                        | •     |

### Chương trình ví dụ

Trước khi đi vào chi tiết của từng giới hạn tài nguyên, chúng ta hãy xem xét một ví dụ đơn giản về việc sử dụng giới hạn tài nguyên. [Liệt kê 36-2](#page-25-0) định nghĩa hàm printRlimit(), hiển thị một thông báo cùng với giới hạn mềm (soft limit) và giới hạn cứng (hard limit) cho một tài nguyên được chỉ định.

> Kiểu dữ liệu rlim\_t thường được biểu diễn giống như off\_t, để xử lý việc biểu diễn RLIMIT\_FSIZE, giới hạn tài nguyên kích thước tệp. Vì lý do này, khi in các giá trị rlim\_t (như trong [Liệt kê 36-2](#page-25-0)), chúng ta ép kiểu (cast) chúng sang `long long` và sử dụng định dạng `%lld` của printf(), như đã giải thích ở Mục 5.10.

Chương trình trong [Liệt kê 36-3](#page-25-1) gọi setrlimit() để thiết lập giới hạn mềm và giới hạn cứng về số lượng tiến trình (Process) mà một người dùng có thể tạo (RLIMIT\_NPROC), sử dụng hàm printRlimit() từ [Liệt kê 36-2](#page-25-0) để hiển thị các giới hạn trước và sau khi thay đổi, sau đó tạo ra càng nhiều tiến trình càng tốt. Khi chúng ta chạy chương trình này, thiết lập giới hạn mềm thành 30 và giới hạn cứng thành 100, kết quả thu được như sau:

```
$ ./rlimit_nproc 30 100
Initial maximum process limits: soft=1024; hard=1024
New maximum process limits: soft=30; hard=100
Child 1 (PID=15674) started
Child 2 (PID=15675) started
Child 3 (PID=15676) started
Child 4 (PID=15677) started
ERROR [EAGAIN Resource temporarily unavailable] fork
```

Trong ví dụ này, chương trình chỉ tạo được 4 tiến trình mới, bởi vì đã có 26 tiến trình đang chạy cho người dùng này.

**Liệt kê 36-2:** Hiển thị giới hạn tài nguyên của tiến trình

```
–––––––––––––––––––––––––––––––––––––––––––––––––––– procres/print_rlimit.c
## include <sys/resource.h>
## include "print_rlimit.h" /* Khai báo hàm được định nghĩa ở đây */
## include "tlpi_hdr.h"
int /* In 'msg' theo sau là các giới hạn cho 'resource' */
printRlimit(const char *msg, int resource)
{
 struct rlimit rlim;
 if (getrlimit(resource, &rlim) == -1)
 return -1;
 printf("%s soft=", msg);
 if (rlim.rlim_cur == RLIM_INFINITY)
 printf("infinite");
## ifdef RLIM_SAVED_CUR /* Không được định nghĩa trên một số cài đặt */
 else if (rlim.rlim_cur == RLIM_SAVED_CUR)
 printf("unrepresentable");
## endif
 else
 printf("%lld", (long long) rlim.rlim_cur);
 printf("; hard=");
 if (rlim.rlim_max == RLIM_INFINITY)
 printf("infinite\n");
## ifdef RLIM_SAVED_MAX /* Không được định nghĩa trên một số cài đặt */
 else if (rlim.rlim_max == RLIM_SAVED_MAX)
 printf("unrepresentable");
## endif
 else
 printf("%lld\n", (long long) rlim.rlim_max);
 return 0;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– procres/print_rlimit.c
Liệt kê 36-3: Thiết lập giới hạn tài nguyên RLIMIT_NPROC
–––––––––––––––––––––––––––––––––––––––––––––––––––– procres/rlimit_nproc.c
## include <sys/resource.h>
## include "print_rlimit.h" /* Khai báo của printRlimit() */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 struct rlimit rl;
 int j;
 pid_t childPid;
```

```
 if (argc < 2 || argc > 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s soft-limit [hard-limit]\n", argv[0]);
 printRlimit("Initial maximum process limits: ", RLIMIT_NPROC);
 /* Thiết lập giới hạn tiến trình mới (hard == soft nếu không được chỉ định) */
 rl.rlim_cur = (argv[1][0] == 'i') ? RLIM_INFINITY :
 getInt(argv[1], 0, "soft-limit");
 rl.rlim_max = (argc == 2) ? rl.rlim_cur :
 (argv[2][0] == 'i') ? RLIM_INFINITY :
 getInt(argv[2], 0, "hard-limit");
 if (setrlimit(RLIMIT_NPROC, &rl) == -1)
 errExit("setrlimit");
 printRlimit("New maximum process limits: ", RLIMIT_NPROC);
 /* Tạo càng nhiều tiến trình con càng tốt */
 for (j = 1; ; j++) {
 switch (childPid = fork()) {
 case -1: errExit("fork");
 case 0: _exit(EXIT_SUCCESS); /* Tiến trình con */
 default: /* Tiến trình cha: hiển thị thông báo về mỗi tiến trình con mới
 và để các tiến trình zombie tạo thành tích tụ lại */
 printf("Child %d (PID=%ld) started\n", j, (long) childPid);
 break;
 }
 }
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– procres/rlimit_nproc.c
```

### Các giá trị giới hạn không thể biểu diễn

Trong một số môi trường lập trình, kiểu dữ liệu `rlim_t` có thể không đủ khả năng biểu diễn toàn bộ dải giá trị có thể được duy trì cho một giới hạn tài nguyên (resource limit) cụ thể. Điều này có thể xảy ra trên một hệ thống cung cấp nhiều môi trường lập trình mà trong đó kích thước của kiểu dữ liệu `rlim_t` khác nhau. Các hệ thống như vậy có thể xuất hiện nếu môi trường biên dịch tệp lớn (large-file compilation environment) với `off_t` 64-bit được thêm vào một hệ thống mà trước đây `off_t` có kích thước 32-bit. (Trong mỗi môi trường, `rlim_t` sẽ có kích thước bằng với `off_t`.) Điều này dẫn đến tình huống một chương trình có `rlim_t` nhỏ, sau khi được thực thi (`execed`) bởi một chương trình có `off_t` 64-bit, lại kế thừa một giới hạn tài nguyên (ví dụ: giới hạn kích thước tệp) lớn hơn giá trị `rlim_t` tối đa.

Để hỗ trợ các ứng dụng có tính di động (portable applications) xử lý khả năng một giới hạn tài nguyên không thể biểu diễn được, chuẩn SUSv3 chỉ định hai hằng số để biểu thị các giá trị giới hạn không thể biểu diễn: `RLIM_SAVED_CUR` và `RLIM_SAVED_MAX`. Nếu một giới hạn tài nguyên mềm (soft resource limit) không thể được biểu diễn trong `rlim_t`, thì hàm `getrlimit()` sẽ trả về `RLIM_SAVED_CUR` trong trường `rlim_cur`. `RLIM_SAVED_MAX` thực hiện chức năng tương tự đối với giới hạn cứng (hard limit) không thể biểu diễn được trả về trong trường `rlim_max`.

Nếu tất cả các giá trị giới hạn tài nguyên có thể có đều biểu diễn được trong `rlim_t`, thì SUSv3 cho phép một bản cài đặt (implementation) định nghĩa `RLIM_SAVED_CUR` và `RLIM_SAVED_MAX` giống với `RLIM_INFINITY`. Đây là cách các hằng số này được định nghĩa trên Linux, ngụ ý rằng tất cả các giá trị giới hạn tài nguyên có thể có đều biểu diễn được trong `rlim_t`. Tuy nhiên, điều này không đúng trên các kiến trúc 32-bit như x86-32. Trên các kiến trúc đó, trong môi trường biên dịch tệp lớn (tức là đặt macro kiểm tra tính năng `_FILE_OFFSET_BITS` thành 64 như được mô tả trong Mục 5.10), định nghĩa của glibc đối với `rlim_t` có độ rộng 64-bit, nhưng kiểu dữ liệu của kernel để biểu diễn giới hạn tài nguyên lại là `unsigned long`, vốn chỉ có độ rộng 32-bit. Các phiên bản glibc hiện tại giải quyết tình huống này như sau: nếu một chương trình được biên dịch với `_FILE_OFFSET_BITS=64` cố gắng đặt giới hạn tài nguyên thành một giá trị lớn hơn mức có thể biểu diễn trong `unsigned long` 32-bit, thì trình bao bọc (wrapper) của glibc cho hàm `setrlimit()` sẽ âm thầm chuyển đổi giá trị thành `RLIM_INFINITY`. Nói cách khác, thiết lập giới hạn tài nguyên được yêu cầu sẽ không được tôn trọng.

> Do các tiện ích xử lý tệp thường được biên dịch với `_FILE_OFFSET_BITS=64` trong nhiều bản phân phối x86-32, việc không tuân thủ các giới hạn tài nguyên lớn hơn giá trị có thể biểu diễn trong 32-bit là một vấn đề không chỉ ảnh hưởng đến các lập trình viên ứng dụng mà còn cả người dùng cuối.

> Người ta có thể lập luận rằng sẽ tốt hơn nếu trình bao bọc `setrlimit()` của glibc trả về lỗi khi giới hạn tài nguyên được yêu cầu vượt quá dung lượng của một `unsigned long` 32-bit. Tuy nhiên, vấn đề cốt lõi nằm ở giới hạn của kernel (kernel limitation), và hành vi được mô tả trong phần chính là cách tiếp cận mà các nhà phát triển glibc đã chọn để xử lý vấn đề này.

## 36.3 Chi tiết về các giới hạn tài nguyên cụ thể

Trong phần này, chúng tôi cung cấp chi tiết về từng giới hạn tài nguyên có sẵn trên Linux, đồng thời lưu ý những giới hạn dành riêng cho Linux (Linux-specific).

### RLIMIT_AS

Giới hạn `RLIMIT_AS` quy định kích thước tối đa cho bộ nhớ ảo (không gian địa chỉ - address space) của tiến trình (Process), tính bằng byte. Các nỗ lực (`brk()`, `sbrk()`, `mmap()`, `mremap()`, và `shmat()`) vượt quá giới hạn này sẽ thất bại và trả về lỗi `ENOMEM`. Trong thực tế, nơi phổ biến nhất mà một chương trình có thể chạm trán giới hạn này là khi gọi các hàm trong gói `malloc`, vốn sử dụng `sbrk()` và `mmap()`. Khi gặp giới hạn này, việc mở rộng stack (stack growth) cũng có thể thất bại kèm theo các hậu quả được liệt kê bên dưới đối với `RLIMIT_STACK`.

### RLIMIT_CORE

Giới hạn `RLIMIT_CORE` quy định kích thước tối đa, tính bằng byte, cho các tệp kết xuất lõi (core dump files) được tạo ra khi một tiến trình bị chấm dứt bởi các tín hiệu (signal) cụ thể (Mục 22.1). Việc tạo tệp core dump sẽ dừng lại ở giới hạn này. Việc chỉ định giới hạn bằng 0 sẽ ngăn chặn việc tạo ra các tệp core dump, điều này đôi khi rất hữu ích vì tệp core dump có thể rất lớn và người dùng cuối thường không biết phải làm gì với chúng. Một lý do khác để vô hiệu hóa core dump là bảo mật — nhằm ngăn chặn việc nội dung bộ nhớ của chương trình bị kết xuất ra đĩa. Nếu giới hạn `RLIMIT_FSIZE` thấp hơn giới hạn này, các tệp core dump sẽ bị giới hạn ở mức `RLIMIT_FSIZE` byte.

### RLIMIT_CPU

Giới hạn `RLIMIT_CPU` quy định số giây tối đa thời gian CPU (ở cả chế độ kernel - system mode và chế độ người dùng - user mode) mà tiến trình có thể sử dụng. Chuẩn SUSv3 yêu cầu tín hiệu `SIGXCPU` phải được gửi đến tiến trình khi đạt đến giới hạn mềm (soft limit), nhưng để ngỏ các chi tiết khác. (Hành động mặc định đối với `SIGXCPU` là chấm dứt tiến trình kèm theo core dump). Có thể thiết lập một trình xử lý (handler) cho `SIGXCPU` để thực hiện bất kỳ xử lý nào mong muốn và sau đó trả lại quyền điều khiển cho chương trình chính. Sau đó, (trên Linux) `SIGXCPU` sẽ được gửi một lần cho mỗi giây thời gian CPU tiêu thụ tiếp theo. Nếu tiến trình tiếp tục thực thi cho đến khi đạt đến giới hạn CPU cứng (hard CPU limit), thì kernel sẽ gửi cho nó một tín hiệu `SIGKILL`, tín hiệu này sẽ luôn chấm dứt tiến trình ngay lập tức.

Các triển khai UNIX có sự khác biệt trong chi tiết về cách chúng xử lý các tiến trình tiếp tục tiêu thụ thời gian CPU sau khi xử lý tín hiệu SIGXCPU. Hầu hết các hệ thống tiếp tục gửi tín hiệu SIGXCPU theo các khoảng thời gian đều đặn. Nếu hướng tới việc sử dụng tín hiệu này có tính tương thích cao (portable), chúng ta nên lập trình ứng dụng sao cho ngay khi nhận được tín hiệu này lần đầu tiên, nó sẽ thực hiện mọi thao tác dọn dẹp cần thiết và chấm dứt hoạt động (terminate). (Ngoài ra, chương trình có thể thay đổi giới hạn tài nguyên sau khi nhận được tín hiệu).

### RLIMIT\_DATA

Giới hạn RLIMIT\_DATA quy định kích thước tối đa (tính bằng byte) của đoạn dữ liệu (data segment) của tiến trình (tổng của các đoạn dữ liệu đã khởi tạo, dữ liệu chưa khởi tạo và vùng nhớ heap được mô tả trong Mục 6.3). Các cố gắng (sbrk() và brk()) nhằm mở rộng đoạn dữ liệu (program break) vượt quá giới hạn này sẽ thất bại và trả về lỗi ENOMEM. Giống như RLIMIT\_AS, nơi phổ biến nhất mà một chương trình có thể chạm mốc giới hạn này là trong các lời gọi đến các hàm thuộc gói cấp phát bộ nhớ malloc.

### RLIMIT\_FSIZE

Giới hạn RLIMIT\_FSIZE quy định kích thước tối đa tính bằng byte của các tệp mà tiến trình được phép tạo. Nếu một tiến trình cố gắng mở rộng tệp vượt quá giới hạn mềm (soft limit), nó sẽ được gửi một tín hiệu SIGXFSZ và system call (ví dụ: write() hoặc truncate()) sẽ thất bại với mã lỗi EFBIG. Hành động mặc định đối với tín hiệu SIGXFSZ là chấm dứt tiến trình (terminate) và tạo ra một tệp core dump. Thay vào đó, chúng ta có thể bắt (catch) tín hiệu này và trả lại quyền điều khiển cho chương trình chính. Tuy nhiên, bất kỳ nỗ lực tiếp theo nào nhằm mở rộng tệp cũng sẽ tạo ra tín hiệu và lỗi tương tự.

### RLIMIT\_MEMLOCK

Giới hạn RLIMIT\_MEMLOCK (có nguồn gốc từ BSD; không có trong tiêu chuẩn SUSv3 và chỉ có sẵn trên Linux cũng như các hệ thống BSD) quy định số lượng byte bộ nhớ ảo tối đa mà một tiến trình được phép khóa (lock) vào bộ nhớ vật lý (physical memory), nhằm ngăn chặn việc bộ nhớ đó bị hoán đổi ra ngoài (swapped out). Giới hạn này ảnh hưởng đến các system call mlock() và mlockall(), cũng như các tùy chọn khóa cho các system call mmap() và shmctl(). Chúng tôi sẽ mô tả chi tiết các vấn đề này trong Mục 50.2.

Nếu cờ MCL\_FUTURE được chỉ định khi gọi mlockall(), thì giới hạn RLIMIT\_MEMLOCK cũng có thể khiến cho các lời gọi sau đó tới brk(), sbrk(), mmap(), hoặc mremap() thất bại.

### RLIMIT\_MSGQUEUE

Giới hạn RLIMIT\_MSGQUEUE (đặc trưng của Linux; kể từ Linux 2.6.8) quy định số lượng byte tối đa có thể được cấp phát cho các hàng đợi thông điệp POSIX (POSIX message queues) đối với ID người dùng thực (real user ID) của tiến trình gọi. Khi một hàng đợi thông điệp POSIX được tạo bằng cách sử dụng mq\_open(), số lượng byte sẽ bị trừ vào giới hạn này theo công thức sau:

```
bytes = attr.mq_maxmsg * sizeof(struct msg_msg *) +
 attr.mq_maxmsg * attr.mq_msgsize;
```

Trong công thức này, attr là cấu trúc mq\_attr được truyền vào làm đối số thứ tư của hàm mq\_open(). Số hạng cộng thêm bao gồm sizeof(struct msg\_msg \*) đảm bảo rằng người dùng không thể đưa vào hàng đợi một số lượng vô hạn các thông điệp có độ dài bằng không. (Cấu trúc msg\_msg là một kiểu dữ liệu được kernel sử dụng nội bộ). Điều này là cần thiết bởi vì mặc dù các thông điệp có độ dài bằng không không chứa dữ liệu nào, nhưng chúng vẫn tiêu thụ một phần bộ nhớ hệ thống dành cho chi phí quản lý sổ sách (bookkeeping overhead).

Giới hạn RLIMIT\_MSGQUEUE chỉ ảnh hưởng đến tiến trình gọi. Các tiến trình khác thuộc về người dùng này sẽ không bị ảnh hưởng trừ khi họ cũng thiết lập giới hạn này hoặc thừa kế nó.

### RLIMIT\_NICE

Giới hạn RLIMIT\_NICE (đặc trưng của Linux; kể từ Linux 2.6.12) quy định mức trần (ceiling) đối với giá trị nice có thể được thiết lập cho tiến trình này bằng cách sử dụng sched\_setscheduler() và nice(). Mức trần được tính bằng 20 – rlim\_cur, trong đó rlim\_cur là giới hạn tài nguyên mềm RLIMIT\_NICE hiện tại. Tham khảo Mục [35.1](#page-0-1) để biết thêm chi tiết.

### RLIMIT\_NOFILE

Giới hạn RLIMIT\_NOFILE quy định một giá trị lớn hơn một đơn vị so với số hiệu file descriptor tối đa mà một tiến trình được phép cấp phát. Các cố gắng (ví dụ: open(), pipe(), socket(), accept(), shm\_open(), dup(), dup2(), fcntl(F\_DUPFD), và epoll\_create()) nhằm cấp phát các descriptor vượt quá giới hạn này sẽ thất bại. Trong phần lớn các trường hợp, lỗi trả về là EMFILE, nhưng đối với dup2(fd, newfd) thì lỗi là EBADF, và đối với fcntl(fd, F\_DUPFD, newfd) khi newfd lớn hơn hoặc bằng giới hạn thì lỗi là EINVAL.

Các thay đổi đối với giới hạn RLIMIT\_NOFILE được phản ánh qua giá trị trả về bởi hàm sysconf(\_SC\_OPEN\_MAX). Tiêu chuẩn SUSv3 cho phép, nhưng không bắt buộc, một bản triển khai phải trả về các giá trị khác nhau cho một lời gọi tới sysconf(\_SC\_OPEN\_MAX) trước và sau khi thay đổi giới hạn RLIMIT\_NOFILE; các bản triển khai khác có thể không hành xử giống như Linux về điểm này.

> Tiêu chuẩn SUSv3 nêu rõ rằng nếu một ứng dụng đặt giới hạn mềm hoặc cứng RLIMIT\_NOFILE thành một giá trị nhỏ hơn hoặc bằng số hiệu của file descriptor cao nhất mà tiến trình đang mở, thì hành vi bất ngờ có thể xảy ra.

> Trên Linux, chúng ta có thể kiểm tra xem tiến trình hiện đang mở những file descriptor nào bằng cách sử dụng readdir() để quét nội dung của thư mục /proc/PID/fd, nơi chứa các liên kết tượng trưng (symbolic links) cho từng file descriptor đang được mở bởi tiến trình đó.

Kernel áp đặt một mức trần đối với giá trị mà giới hạn RLIMIT\_NOFILE có thể được nâng lên. Trong các phiên bản kernel trước 2.6.25, mức trần này là một giá trị được mã hóa cứng (hard-coded) do hằng số kernel NR\_OPEN định nghĩa, có giá trị là 1.048.576. (Cần phải biên dịch lại kernel để nâng mức trần này lên). Kể từ kernel 2.6.25, giới hạn được định nghĩa bởi giá trị nằm trong tệp /proc/sys/fs/nr\_open đặc trưng của Linux. Giá trị mặc định trong tệp này là 1.048.576; siêu người dùng (superuser) có thể sửa đổi giá trị này. Các cố gắng thiết lập giới hạn mềm hoặc cứng RLIMIT\_NOFILE cao hơn giá trị mức trần sẽ dẫn đến lỗi EPERM.

Ngoài ra còn có một giới hạn trên toàn hệ thống (system-wide limit) đối với tổng số file có thể được mở bởi tất cả các tiến trình (process). Giới hạn này có thể được truy vấn và chỉnh sửa thông qua file đặc thù của Linux `/proc/sys/fs/file-max`. (Tham khảo Mục 5.4, chúng ta có thể định nghĩa `file-max` một cách chính xác hơn là giới hạn toàn hệ thống đối với số lượng các mô tả file mở - open file description). Chỉ các tiến trình có đặc quyền (`CAP_SYS_ADMIN`) mới có thể vượt quá giới hạn `file-max`. Đối với một tiến trình không có đặc quyền (unprivileged process), một System Call gặp phải giới hạn `file-max` sẽ thất bại và trả về mã lỗi `ENFILE`.

### RLIMIT_NPROC

Giới hạn `RLIMIT_NPROC` (có nguồn gốc từ BSD; không có trong SUSv3 và chỉ có sẵn trên Linux cùng các hệ thống BSD) quy định số lượng tối đa các tiến trình có thể được tạo ra cho Real User ID của tiến trình gọi. Các cố gắng (`fork()`, `vfork()` và `clone()`) vượt quá giới hạn này sẽ thất bại với mã lỗi `EAGAIN`.

Giới hạn `RLIMIT_NPROC` chỉ ảnh hưởng đến tiến trình gọi. Các tiến trình khác thuộc về người dùng này không bị ảnh hưởng trừ khi chúng cũng thiết lập hoặc kế thừa giới hạn này. Giới hạn này không được áp dụng đối với các tiến trình có đặc quyền (`CAP_SYS_ADMIN` hoặc `CAP_SYS_RESOURCE`).

> Linux cũng áp dụng giới hạn toàn hệ thống đối với số lượng tiến trình có thể được tạo bởi tất cả người dùng. Trên Linux 2.4 trở lên, file đặc thù của Linux `/proc/sys/kernel/threads-max` có thể được sử dụng để truy vấn và chỉnh sửa giới hạn này.

> Nói một cách chính xác, giới hạn tài nguyên (resource limit) `RLIMIT_NPROC` và file `threads-max` thực chất là giới hạn về số lượng luồng (thread) có thể được tạo, thay vì số lượng tiến trình.

Cách thức mà giá trị mặc định cho giới hạn tài nguyên `RLIMIT_NPROC` được thiết lập có sự thay đổi qua các phiên bản kernel. Trong Linux 2.2, nó được tính toán theo một công thức cố định. Trong Linux 2.4 trở lên, nó được tính toán bằng cách sử dụng một công thức dựa trên dung lượng bộ nhớ vật lý (physical memory) khả dụng.

> SUSv3 không quy định giới hạn tài nguyên `RLIMIT_NPROC`. Phương thức do SUSv3 yêu cầu để truy vấn (nhưng không thay đổi) số lượng tiến trình tối đa được phép cho một User ID là thông qua lời gọi `sysconf(_SC_CHILD_MAX)`. Lời gọi `sysconf()` này được hỗ trợ trên Linux, nhưng trong các phiên bản kernel trước 2.6.23, lời gọi này không trả về thông tin chính xác—nó luôn trả về giá trị 999. Kể từ Linux 2.6.23 (và với glibc 2.4 trở lên), lời gọi này báo cáo chính xác giới hạn (bằng cách kiểm tra giá trị của giới hạn tài nguyên `RLIMIT_NPROC`).

> Không có cách thức nào có thể di chuyển (portable) để phát hiện có bao nhiêu tiến trình đã được tạo cho một User ID cụ thể. Trên Linux, chúng ta có thể thử quét toàn bộ các file `/proc/PID/status` trên hệ thống và kiểm tra thông tin bên dưới mục `Uid` (liệt kê bốn ID người dùng của tiến trình theo thứ tự: real, effective, saved set, và file system) nhằm ước tính số lượng tiến trình hiện đang thuộc sở hữu của một người dùng. Tuy nhiên, cần lưu ý rằng vào thời điểm chúng ta hoàn thành việc quét đó, thông tin này có thể đã thay đổi.

### RLIMIT_RSS

Giới hạn `RLIMIT_RSS` (có nguồn gốc từ BSD; không có trong SUSv3, nhưng được hỗ trợ rộng rãi) quy định số lượng trang (page) tối đa trong tập hợp thường trú (resident set) của tiến trình; tức là tổng số trang bộ nhớ ảo (virtual memory page) hiện đang nằm trong bộ nhớ vật lý. Giới hạn này được cung cấp trên Linux, nhưng hiện tại nó không có tác dụng.

Trong các kernel Linux 2.4 cũ (tới và bao gồm phiên bản 2.4.29), `RLIMIT_RSS` thực sự có ảnh hưởng đến hành vi của thao tác `madvise()` với cờ `MADV_WILLNEED` (Mục 50.4). Nếu thao tác này không thể thực hiện được do gặp phải giới hạn `RLIMIT_RSS`, lỗi `EIO` sẽ được trả về trong biến `errno`.

### RLIMIT_RTPRIO

Giới hạn `RLIMIT_RTPRIO` (đặc thù của Linux; kể từ Linux 2.6.12) quy định mức trần (ceiling) đối với độ ưu tiên thời gian thực (realtime priority) có thể được thiết lập cho tiến trình này bằng cách sử dụng `sched_setscheduler()` và `sched_setparam()`. Tham khảo Mục [35.3.2](#page-8-1) để biết thêm chi tiết.

### RLIMIT_RTTIME

Giới hạn `RLIMIT_RTTIME` (đặc thù của Linux; kể từ Linux 2.6.25) quy định khoảng thời gian CPU tối đa tính bằng microsecond mà một tiến trình chạy dưới chính sách lập lịch thời gian thực (realtime scheduling policy) có thể tiêu thụ mà không bị ngủ (sleep) (tức là thực hiện một blocking system call). Hành vi khi đạt đến giới hạn này cũng giống như `RLIMIT_CPU`: nếu tiến trình chạm đến giới hạn mềm (soft limit), một tín hiệu `SIGXCPU` sẽ được gửi đến tiến trình, và các tín hiệu `SIGXCPU` tiếp theo sẽ được gửi cho mỗi giây thời gian CPU bổ sung bị tiêu thụ. Khi đạt đến giới hạn cứng (hard limit), tín hiệu `SIGKILL` sẽ được gửi đi. Tham khảo Mục [35.3.2](#page-8-1) để biết thêm chi tiết.

### RLIMIT\_SIGPENDING

Giới hạn RLIMIT\_SIGPENDING (đặc trưng của Linux; kể từ Linux 2.6.8) chỉ định số lượng tối đa các tín hiệu (signal) có thể được xếp hàng đợi (queue) cho real user ID của tiến trình gọi (calling process). Các cố gắng (thông qua `sigqueue()`) vượt quá giới hạn này sẽ thất bại và trả về lỗi `EAGAIN`.

Giới hạn RLIMIT\_SIGPENDING chỉ ảnh hưởng đến tiến trình gọi. Các tiến trình khác thuộc về người dùng này không bị ảnh hưởng trừ khi chúng cũng thiết lập hoặc kế thừa giới hạn này.

Khi mới được triển khai, giá trị mặc định cho giới hạn RLIMIT\_SIGPENDING là 1024. Kể từ kernel 2.6.12, giá trị mặc định đã được thay đổi thành bằng với giá trị mặc định của RLIMIT\_NPROC.

Nhằm mục đích kiểm tra giới hạn RLIMIT\_SIGPENDING, số lượng tín hiệu trong hàng đợi bao gồm cả tín hiệu thời gian thực (realtime signal) và tín hiệu chuẩn (standard signal). (Tín hiệu chuẩn chỉ có thể được đưa vào hàng đợi một lần cho mỗi tiến trình.) Tuy nhiên, giới hạn này chỉ được áp dụng (enforce) đối với `sigqueue()`. Ngay cả khi số lượng tín hiệu được chỉ định bởi giới hạn này đã được xếp hàng đợi cho các tiến trình thuộc về real user ID này, vẫn có thể sử dụng `kill()` để đưa vào hàng đợi một thể hiện (instance) của mỗi tín hiệu (bao gồm cả tín hiệu thời gian thực) mà chưa có trong hàng đợi của tiến trình.

Từ kernel 2.6.12 trở đi, trường `SigQ` trong tệp `/proc/PID/status` đặc trưng của Linux hiển thị số lượng hiện tại và số lượng tối đa các tín hiệu trong hàng đợi đối với real user ID của tiến trình.

### RLIMIT\_STACK

Giới hạn RLIMIT\_STACK chỉ định kích thước tối đa của stack tiến trình, tính bằng byte. Các nỗ lực làm cho stack vượt quá giới hạn này sẽ dẫn đến việc tạo ra một tín hiệu `SIGSEGV` cho tiến trình. Vì stack đã cạn kiệt, cách duy nhất để bắt (catch) tín hiệu này là thiết lập một stack tín hiệu thay thế (alternate signal stack), như được mô tả trong Mục 21.3.

> Kể từ Linux 2.6.23, giới hạn RLIMIT\_STACK cũng quyết định dung lượng bộ nhớ khả dụng để chứa các tham số dòng lệnh (command-line argument) và biến môi trường (environment variable) của tiến trình. Xem trang hướng dẫn sử dụng (manual page) `execve(2)` để biết thêm chi tiết.

## 36.4 Tổng kết

Các tiến trình tiêu thụ nhiều tài nguyên hệ thống khác nhau. System call `getrusage()` cho phép một tiến trình giám sát một số tài nguyên nhất định do chính nó và các tiến trình con của nó tiêu thụ.

Các system call `setrlimit()` và `getrlimit()` cho phép một tiến trình thiết lập và truy xuất các giới hạn về mức độ tiêu thụ các tài nguyên khác nhau của nó. Mỗi giới hạn tài nguyên có hai thành phần: giới hạn mềm (soft limit), là mức mà kernel áp dụng khi kiểm tra việc tiêu thụ tài nguyên của tiến trình, và giới hạn cứng (hard limit), đóng vai trò là trần giới hạn cho giá trị của giới hạn mềm. Một tiến trình không có đặc quyền (unprivileged process) có thể thiết lập giới hạn mềm cho một tài nguyên thành bất kỳ giá trị nào trong phạm vi từ 0 cho đến giới hạn cứng, nhưng chỉ có thể hạ thấp giới hạn cứng. Một tiến trình có đặc quyền (privileged process) có thể thực hiện bất kỳ thay đổi nào đối với cả hai giá trị giới hạn, miễn là giới hạn mềm nhỏ hơn hoặc bằng giới hạn cứng. Nếu một tiến trình chạm tới giới hạn mềm, nó thường được thông báo về việc đó bằng cách nhận được một tín hiệu hoặc thông qua việc thất bại của system call cố gắng vượt quá giới hạn đó.

## 36.5 Bài tập

- **36-1.** Viết một chương trình chứng minh rằng cờ `RUSAGE_CHILDREN` của `getrusage()` chỉ truy xuất thông tin về các tiến trình con mà hàm `wait()` đã được thực hiện trên đó. (Cho chương trình tạo một tiến trình con tiêu thụ một khoảng thời gian CPU, sau đó cho tiến trình cha gọi `getrusage()` trước và sau khi gọi `wait()`.)
- **36-2.** Viết một chương trình thực thi một lệnh (command) và sau đó hiển thị mức sử dụng tài nguyên của lệnh đó. Điều này tương tự với những gì lệnh `time(1)` làm. Do đó, chúng ta sẽ sử dụng chương trình này như sau:
  - \$ **./rusage** *command arg...*
- **36-3.** Viết các chương trình để xác định điều gì xảy ra nếu việc tiêu thụ các tài nguyên khác nhau của một tiến trình đã vượt quá giới hạn mềm được chỉ định trong một lời gọi `setrlimit()`.
