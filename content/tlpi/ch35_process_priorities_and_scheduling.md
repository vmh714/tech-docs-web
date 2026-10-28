# Chương 35: Độ ưu tiên tiến trình và Lập lịch (Process Priorities and Scheduling)

Chương này thảo luận về các system call (system call) và thuộc tính tiến trình khác nhau, quyết định thời điểm và tiến trình nào được quyền truy cập vào (các) CPU. Chúng ta bắt đầu bằng việc mô tả nice value (giá trị nice), một đặc tính tiến trình ảnh hưởng đến lượng thời gian CPU được cấp phát cho một tiến trình bởi kernel scheduler (bộ lập lịch nhân). Tiếp theo là mô tả về API lập lịch realtime (realtime scheduling API) theo chuẩn POSIX. API này cho phép chúng ta định nghĩa policy (chính sách) và priority (độ ưu tiên) được sử dụng để lập lịch cho các tiến trình, mang lại khả năng kiểm soát chặt chẽ hơn nhiều đối với cách các tiến trình được cấp phát cho CPU. Kết thúc chương là phần thảo luận về các system call dùng để thiết lập CPU affinity mask (mặt nạ gắn kết CPU) của tiến trình, qua đó xác định tập hợp các CPU mà một tiến trình đang chạy trên hệ thống đa xử lý (multiprocessor system) sẽ thực thi.

## 35.1 Độ ưu tiên tiến trình (Nice Values)

Trên Linux, cũng như hầu hết các cài đặt UNIX khác, mô hình mặc định để lập lịch cho các tiến trình sử dụng CPU là chia sẻ thời gian vòng tròn (round-robin time-sharing). Theo mô hình này, mỗi tiến trình lần lượt được phép sử dụng CPU trong một khoảng thời gian ngắn, được gọi là time slice (lát cắt thời gian) hoặc quantum. Chia sẻ thời gian vòng tròn thỏa mãn hai yêu cầu quan trọng của một hệ thống đa nhiệm tương tác (interactive multitasking system):

- Tính công bằng (Fairness): Mỗi tiến trình đều nhận được một phần thời gian CPU.
- Tính phản hồi (Responsiveness): Một tiến trình không phải chờ đợi lâu trước khi được sử dụng CPU.

Dưới thuật toán chia sẻ thời gian vòng tròn, các tiến trình không thể kiểm soát trực tiếp thời điểm và thời gian chúng được sử dụng CPU. Theo mặc định, mỗi tiến trình lần lượt nhận quyền sử dụng CPU cho đến khi hết time slice của nó hoặc nó tự nguyện nhường CPU (ví dụ: đưa bản thân vào trạng thái ngủ hoặc thực hiện thao tác đọc đĩa). Nếu tất cả các tiến trình đều cố gắng sử dụng CPU nhiều nhất có thể (tức là không có tiến trình nào ngủ hoặc bị block (chặn) trên một thao tác I/O), thì chúng sẽ nhận được một phần thời gian CPU tương đương nhau.

Tuy nhiên, một thuộc tính của tiến trình là nice value (giá trị nice), cho phép một tiến trình tác động gián tiếp đến thuật toán lập lịch của kernel (nhân). Mỗi tiến trình có một nice value nằm trong khoảng từ –20 (độ ưu tiên cao) đến +19 (độ ưu tiên thấp); giá trị mặc định là 0 (tham khảo [Hình 35-1](#page-1-0)). Trong các cài đặt UNIX truyền thống, chỉ các tiến trình có đặc quyền (privileged process) mới có thể gán cho chính mình (hoặc các tiến trình khác) một độ ưu tiên âm (cao). (Chúng ta sẽ giải thích một số điểm khác biệt trên Linux ở Mục [35.3.2](#page-8-0).) Các tiến trình không có đặc quyền chỉ có thể giảm độ ưu tiên của chúng bằng cách nhận nice value lớn hơn mức mặc định là 0. Bằng cách làm này, chúng tỏ ra "tử tế" (nice) với các tiến trình khác, và thực tế này là nguồn gốc tên gọi của thuộc tính này.

Nice value được kế thừa bởi tiến trình con (child process) được tạo ra thông qua `fork()` và được bảo toàn qua hàm `exec()`.

> [!NOTE]
> Thay vì trả về nice value thực tế, routine dịch vụ của system call `getpriority()` trả về một số nằm trong khoảng từ 1 (độ ưu tiên thấp) đến 40 (độ ưu tiên cao), được tính toán theo công thức `unice = 20 – knice`. Việc này được thực hiện để tránh việc routine dịch vụ của system call trả về một giá trị âm vốn được dùng để chỉ báo lỗi. (Xem mô tả về các routine dịch vụ system call tại Mục 3.1.) Các ứng dụng không hề hay biết về giá trị đã qua thao tác này do wrapper function (hàm bọc) `getpriority()` của thư viện C đã đảo ngược phép tính, trả về giá trị `20 – unice` cho chương trình gọi.

```text
nice
        value
(độ ưu tiên cao)  -20  ┬
                      │  ↑
                      │     *(truyền thống) chỉ khả dụng*
                      │     *với các tiến trình có đặc quyền*
                      │  ↓
     (mặc định)   0   ┼
                      │
                      │
                      │
(độ ưu tiên thấp) +19  ┴
```

**Hình 35-1:** Khoảng giá trị và ý nghĩa của nice value của tiến trình

### Ảnh hưởng của giá trị nice (nice value)

Các tiến trình (process) không được lập lịch (schedule) theo một phân cấp nghiêm ngặt dựa trên giá trị nice; thay vào đó, giá trị nice đóng vai trò là một hệ số trọng số (weighting factor) khiến bộ lập lịch kernel (kernel scheduler) ưu tiên các tiến trình có mức ưu tiên cao hơn. Việc gán cho một tiến trình mức ưu tiên thấp (tức là giá trị nice cao) sẽ không khiến nó bị thiếu hụt hoàn toàn CPU (starved of the CPU), nhưng sẽ làm cho nó nhận được thời gian CPU tương đối ít hơn. Mức độ mà giá trị nice ảnh hưởng đến việc lập lịch của một tiến trình có sự khác nhau giữa các phiên bản Linux kernel, cũng như giữa các hệ thống UNIX.

> [!NOTE]
> Bắt đầu từ phiên bản kernel 2.6.23, một thuật toán lập lịch kernel mới có nghĩa là các khác biệt tương đối về giá trị nice có tác dụng mạnh hơn rất nhiều so với các phiên bản kernel trước đó. Kết quả là, các tiến trình có giá trị nice thấp sẽ nhận được ít CPU hơn trước, và các tiến trình có giá trị nice cao sẽ chiếm được tỷ lệ CPU lớn hơn.

### Truy vấn và sửa đổi mức ưu tiên (priorities)

Các lời gọi hệ thống (system call) `getpriority()` và `setpriority()` cho phép một tiến trình truy vấn và thay đổi giá trị nice của chính nó hoặc của một tiến trình khác.

```c
## include <sys/resource.h>
int getpriority(int which, id_t who);
           /* Trả về giá trị nice (có thể âm) của tiến trình chỉ định khi thành công, hoặc –1 khi lỗi */
int setpriority(int which, id_t who, int prio);
                                             /* Trả về 0 khi thành công, hoặc –1 khi lỗi */
```

Cả hai lời gọi hệ thống đều nhận các tham số `which` và `who`, dùng để xác định (các) tiến trình cần truy vấn hoặc sửa đổi mức ưu tiên. Tham số `which` quyết định cách thức `who` được diễn giải. Tham số này nhận một trong các giá trị sau:

### PRIO\_PROCESS

Thao tác trên tiến trình có ID tiến trình (process ID) bằng `who`. Nếu `who` bằng 0, sử dụng ID tiến trình của tiến trình gọi (caller).

### PRIO\_PGRP

Thao tác trên tất cả các thành viên của nhóm tiến trình (process group) có ID nhóm tiến trình bằng `who`. Nếu `who` bằng 0, sử dụng nhóm tiến trình của tiến trình gọi.

### PRIO\_USER

Thao tác trên tất cả các tiến trình có ID người dùng thực (real user ID) bằng `who`. Nếu `who` bằng 0, sử dụng ID người dùng thực của tiến trình gọi.

Kiểu dữ liệu `id_t`, được sử dụng cho tham số `who`, là một kiểu số nguyên có kích thước đủ lớn để chứa một ID tiến trình hoặc một ID người dùng.

Lời gọi hệ thống `getpriority()` trả về giá trị nice của tiến trình được chỉ định bởi `which` và `who`. Nếu có nhiều tiến trình khớp với các tiêu chí được chỉ định (có thể xảy ra nếu `which` là `PRIO_PGRP` hoặc `PRIO_USER`), thì giá trị nice của tiến trình có mức ưu tiên cao nhất (tức là giá trị số nhỏ nhất) sẽ được trả về. Vì `getpriority()` có thể trả về hợp lệ giá trị –1 khi gọi thành công, chúng ta phải kiểm tra lỗi bằng cách thiết lập `errno` thành 0 trước khi gọi, sau đó kiểm tra trạng thái trả về –1 và giá trị `errno` khác 0 sau khi gọi.

Lời gọi hệ thống `setpriority()` thiết lập giá trị nice của (các) tiến trình được chỉ định bởi `which` và `who` thành giá trị được chỉ định trong `prio`. Các nỗ lực thiết lập giá trị nice nằm ngoài phạm vi cho phép (từ –20 đến +19) sẽ được giới hạn một cách âm thầm (silently bounded) trong phạm vi này.

> [!NOTE]
> Về mặt lịch sử, giá trị nice được thay đổi bằng cách sử dụng lời gọi `nice(incr)`, hàm này cộng thêm `incr` vào giá trị nice của tiến trình gọi. Hàm này vẫn khả dụng, nhưng đã bị thay thế bởi lời gọi hệ thống tổng quát hơn là `setpriority()`.

> [!NOTE]
> Các công cụ dòng lệnh (command-line) tương đương với `setpriority()` là `nice(1)`, có thể được sử dụng bởi người dùng không có đặc quyền (unprivileged user) để chạy một lệnh với mức ưu tiên thấp hơn hoặc bởi người dùng có đặc quyền (privileged user) để chạy một lệnh với mức ưu tiên cao hơn, và `renice(8)`, có thể được sử dụng bởi siêu người dùng (superuser) để thay đổi giá trị nice của một tiến trình đang tồn tại.

Một tiến trình có đặc quyền (`CAP_SYS_NICE`) có thể thay đổi mức ưu tiên của bất kỳ tiến trình nào. Một tiến trình không có đặc quyền có thể thay đổi mức ưu tiên của chính nó (bằng cách chỉ định `which` là `PRIO_PROCESS` và `who` là 0) hoặc mức ưu tiên của một tiến trình (mục tiêu) khác, nếu ID người dùng hiệu dụng (effective user ID) của nó khớp với ID người dùng thực hoặc hiệu dụng của tiến trình mục tiêu. Các quy tắc phân quyền trên Linux đối với `setpriority()` khác với SUSv3, quy định rằng một tiến trình không có đặc quyền có thể thay đổi mức ưu tiên của tiến trình khác nếu ID người dùng thực hoặc hiệu dụng của nó khớp với ID người dùng hiệu dụng của tiến trình mục tiêu. Các cài đặt (implementation) UNIX có một số biến thể về điểm này. Một số tuân theo các quy tắc SUSv3, nhưng những hệ thống khác—đáng chú ý là các hệBSD—hành xử theo cùng một cách như Linux.

> [!NOTE]
> Trong các phiên bản Linux kernel trước 2.6.12, các quy tắc phân quyền cho các lời gọi `setpriority()` bởi các tiến trình không có đặc quyền thì khác với các kernel sau này (và cũng khác với SUSv3). Một tiến trình không có đặc quyền có thể thay đổi mức ưu tiên của tiến trình khác nếu ID người dùng thực hoặc hiệu dụng của nó khớp với ID người dùng thực của tiến trình mục tiêu. Từ Linux 2.6.12 trở đi, các kiểm tra quyền đã được thay đổi để đồng nhất với các API tương tự khác có sẵn trên Linux, chẳng hạn như `sched_setscheduler()` và `sched_setaffinity()`.

Trong các phiên bản Linux kernel trước 2.6.12, một tiến trình không có đặc quyền chỉ có thể sử dụng `setpriority()` để hạ thấp (không thể đảo ngược) giá trị nice của chính nó hoặc của tiến trình khác. Một tiến trình có đặc quyền (`CAP_SYS_NICE`) có thể sử dụng `setpriority()` để tăng các giá trị nice.

Kể từ phiên bản kernel 2.6.12, Linux cung cấp giới hạn tài nguyên `RLIMIT_NICE`, cho phép các tiến trình không đặc quyền (unprivileged process) tăng giá trị nice (nice value). Một tiến trình không đặc quyền có thể nâng giá trị nice của chính nó lên mức tối đa được xác định theo công thức $20 - \text{rlim\_cur}$, trong đó `rlim_cur` là giới hạn mềm (soft resource limit) `RLIMIT_NICE` hiện tại. Ví dụ, nếu giới hạn mềm `RLIMIT_NICE` của một tiến trình là 25, thì giá trị nice của nó có thể được nâng lên thành –5. Từ công thức này, kết hợp với việc giá trị nice nằm trong khoảng từ +19 (thấp) đến –20 (cao), chúng ta có thể suy ra rằng phạm vi hữu ích thực tế của giới hạn `RLIMIT_NICE` là từ 1 (thấp) đến 40 (cao). (`RLIMIT_NICE` không sử dụng dải số từ +19 đến –20 vì một số giá trị giới hạn tài nguyên âm mang ý nghĩa đặc biệt—ví dụ, `RLIM_INFINITY` có cùng biểu diễn với –1.)

Một tiến trình không đặc quyền có thể thực hiện lệnh gọi `setpriority()` để thay đổi giá trị nice của một tiến trình khác (tiến trình đích - target process), nếu ID người dùng hiệu dụng (effective user ID) của tiến trình gọi `setpriority()` khớp với ID người dùng thực (real user ID) hoặc hiệu dụng của tiến trình đích, và việc thay đổi giá trị nice phải phù hợp với giới hạn `RLIMIT_NICE` của tiến trình đích đó.

Chương trình trong [Liệt kê 35-1](#page-3-0) sử dụng `setpriority()` để thay đổi giá trị nice của (các) tiến trình được chỉ định bởi các tham số dòng lệnh của nó (tương ứng với các tham số của `setpriority()`), và sau đó gọi `getpriority()` để xác minh sự thay đổi.

**Liệt kê 35-1:** Sửa đổi và truy xuất giá trị nice của một tiến trình

```c
––––––––––––––––––––––––––––––––––––––––––––––––––– procpri/t_setpriority.c
## include <sys/time.h>
## include <sys/resource.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int which, prio;
 id_t who;
```

```c
 if (argc != 4 || strchr("pgu", argv[1][0]) == NULL)
 usageErr("%s {p|g|u} who priority\n"
 " set priority of: p=process; g=process group; "
 "u=processes for user\n", argv[0]);
 /* Thiết lập giá trị nice theo các tham số dòng lệnh */
 which = (argv[1][0] == 'p') ? PRIO_PROCESS :
 (argv[1][0] == 'g') ? PRIO_PGRP : PRIO_USER;
 who = getLong(argv[2], 0, "who");
 prio = getInt(argv[3], 0, "prio");
 if (setpriority(which, who, prio) == -1)
 errExit("getpriority");
 /* Truy xuất giá trị nice để kiểm tra thay đổi */
 errno = 0; /* Bởi vì lời gọi thành công có thể trả về -1 */
 prio = getpriority(which, who);
 if (prio == -1 && errno != 0)
 errExit("getpriority");
 printf("Nice value = %d\n", prio);
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––– procpri/t_setpriority.c
```

## 35.2 Tổng quan về Lên lịch Tiến trình Thời gian Thực (Realtime Process Scheduling)

Thuật toán lên lịch chuẩn của kernel thường cung cấp hiệu năng và khả năng phản hồi đầy đủ cho hỗn hợp các tiến trình tương tác và tiến trình nền (background process) thường chạy trên hệ thống. Tuy nhiên, các ứng dụng thời gian thực (realtime application) có các yêu cầu khắt khe hơn đối với bộ lên lịch (scheduler), bao gồm những điểm sau:

Một ứng dụng thời gian thực phải cung cấp thời gian phản hồi tối đa được đảm bảo cho các đầu vào bên ngoài. Trong nhiều trường hợp, thời gian phản hồi tối đa được đảm bảo này phải rất ngắn (ví dụ: cỡ một phần của một giây). Chẳng hạn, phản hồi chậm từ một hệ thống định vị xe hơi có thể dẫn đến thảm họa. Để thỏa mãn yêu cầu này, kernel phải cung cấp cơ chế cho phép một tiến trình ưu tiên cao giành quyền kiểm soát CPU một cách kịp thời, chiếm quyền (preempting) bất kỳ tiến trình nào hiện đang chạy.

> [!NOTE]
> Một ứng dụng đòi hỏi tính thời gian khắt khe (time-critical application) có thể cần thực hiện các bước khác để tránh độ trễ không thể chấp nhận được. Ví dụ, để tránh bị chậm trễ do lỗi trang (page fault), một ứng dụng có thể khóa toàn bộ bộ nhớ ảo của nó vào RAM bằng cách sử dụng `mlock()` hoặc `mlockall()` (được mô tả trong Mục 50.2).

Một tiến trình ưu tiên cao phải có khả năng duy trì quyền truy cập độc quyền vào CPU cho đến khi nó hoàn thành hoặc tự nguyện nhường CPU.

Một ứng dụng thời gian thực phải có khả năng kiểm soát chính xác thứ tự mà các tiến trình thành phần của nó được lên lịch.

SUSv3 quy định một API lên lịch tiến trình thời gian thực (ban đầu được định nghĩa trong POSIX.1b) nhằm giải quyết một phần các yêu cầu này. API này cung cấp hai chính sách lên lịch thời gian thực: `SCHED_RR` và `SCHED_FIFO`. Các tiến trình hoạt động theo một trong hai chính sách này luôn có độ ưu tiên cao hơn các tiến trình được lên lịch bằng chính sách chia sẻ thời gian vòng tròn (round-robin timesharing) chuẩn được mô tả trong Mục [35.1](#page-0-0), mà API lên lịch thời gian thực định danh bằng hằng số `SCHED_OTHER`.

Mỗi chính sách thời gian thực cho phép một dải các mức ưu tiên. SUSv3 yêu cầu một bản cài đặt phải cung cấp ít nhất 32 mức ưu tiên rời rạc cho các chính sách thời gian thực. Trong mỗi chính sách lên lịch, các tiến trình có thể chạy (runnable process) với độ ưu tiên cao hơn sẽ luôn có quyền ưu tiên trước các tiến trình có độ ưu tiên thấp hơn khi tranh giành quyền truy cập CPU.

> [!NOTE]
> Phát biểu cho rằng các tiến trình có thể chạy với độ ưu tiên cao hơn luôn có quyền ưu tiên trước các tiến trình có độ ưu tiên thấp hơn cần phải được làm rõ đối với các hệ thống Linux đa xử lý (multiprocessor) (bao gồm cả các hệ thống hỗ trợ siêu phân luồng - hyperthreaded). Trên hệ thống đa xử lý, mỗi CPU có một hàng đợi chạy (run queue) riêng biệt (điều này mang lại hiệu năng tốt hơn so với một hàng đợi chạy đơn cho toàn hệ thống), và các tiến trình chỉ được ưu tiên tính trên từng hàng đợi chạy của CPU đó. Ví dụ, trên một hệ thống hai bộ xử lý với ba tiến trình, tiến trình A có độ ưu tiên thời gian thực là 20 có thể được đưa vào hàng đợi chờ CPU 0, nơi hiện đang chạy tiến trình B với độ ưu tiên 30, mặc dù CPU 1 đang chạy tiến trình C với độ ưu tiên 10.

> [!NOTE]
> Các ứng dụng thời gian thực (realtime application) sử dụng nhiều tiến trình (process) hoặc luồng (thread) có thể sử dụng API ái lực CPU (CPU affinity API) được mô tả ở Mục [35.4](#page-15-0) để tránh bất kỳ vấn đề nào có thể phát sinh từ hành vi lập lịch này. Ví dụ, trên một hệ thống bốn bộ xử lý (four-processor system), tất cả các tiến trình không quan trọng (noncritical process) có thể được cô lập trên một CPU duy nhất, để lại ba CPU còn lại cho ứng dụng sử dụng.

Linux cung cấp 99 mức độ ưu tiên thời gian thực (realtime priority level), được đánh số từ 1 (thấp nhất) đến 99 (cao nhất), và dải giá trị này áp dụng cho cả hai chính sách lập lịch thời gian thực (realtime scheduling policy). Các mức ưu tiên trong mỗi chính sách là tương đương nhau. Điều này có nghĩa là, với hai tiến trình có cùng mức ưu tiên, một tiến trình hoạt động theo chính sách `SCHED_RR` và tiến trình kia theo `SCHED_FIFO`, bất kỳ tiến trình nào cũng có thể là tiến trình tiếp theo đủ điều kiện thực thi, tùy thuộc vào thứ tự chúng được lập lịch. Thực tế là, mỗi mức ưu tiên duy trì một hàng đợi (queue) chứa các tiến trình có thể chạy (runnable process), và tiến trình tiếp theo được chọn chạy sẽ lấy từ đầu hàng đợi không trống có mức ưu tiên cao nhất.

### POSIX realtime so với hard realtime

Các ứng dụng đáp ứng tất cả các yêu cầu được liệt kê ở phần đầu mục này đôi khi được gọi là ứng dụng thời gian thực cứng (hard realtime application). Tuy nhiên, API lập lịch tiến trình thời gian thực POSIX (POSIX realtime process scheduling API) không thỏa mãn tất cả các yêu cầu này. Cụ thể, nó không cung cấp cách thức nào để ứng dụng đảm bảo thời gian phản hồi (response time) khi xử lý đầu vào. Việc đưa ra những đảm bảo như vậy đòi hỏi các tính năng của hệ điều hành không nằm trong Linux kernel chính thống ( mainline Linux kernel) (cũng như hầu hết các hệ điều hành chuẩn khác). API POSIX chỉ đơn thuần cung cấp cái gọi là thời gian thực mềm (soft realtime), cho phép chúng ta kiểm soát tiến trình nào được lập lịch sử dụng CPU.

Việc bổ sung hỗ trợ cho các ứng dụng thời gian thực cứng (hard realtime application) rất khó đạt được nếu không làm phát sinh thêm chi phí chung (overhead) cho hệ thống — điều gây mâu thuẫn với các yêu cầu hiệu năng của các ứng dụng chia sẻ thời gian (time-sharing application) vốn chiếm phần lớn ứng dụng trên các hệ thống máy để bàn (desktop) và máy chủ (server) tiêu chuẩn. Đây là lý do tại sao hầu hết các UNIX kernel — bao gồm cả Linux về mặt lịch sử — chưa bao giờ hỗ trợ nguyên bản (natively) các ứng dụng thời gian thực. Mặc dù vậy, bắt đầu từ khoảng phiên bản 2.6.18, nhiều tính năng khác nhau đã được thêm vào Linux kernel với mục đích cuối cùng là cho phép Linux hỗ trợ nguyên bản toàn diện các ứng dụng thời gian thực cứng, mà không làm phát sinh chi phí chung đã đề cập đối với hoạt động chia sẻ thời gian.

### 35.2.1 Chính sách `SCHED_RR`

Dưới chính sách `SCHED_RR` (round-robin), các tiến trình có cùng mức ưu tiên sẽ được thực thi theo phương thức chia sẻ thời gian vòng tròn (round-robin time-sharing). Một tiến trình nhận được một lát thời gian (time slice) có độ dài cố định mỗi khi nó sử dụng CPU. Một khi đã được lập lịch, tiến trình sử dụng chính sách `SCHED_RR` sẽ tiếp tục duy trì quyền kiểm soát CPU cho đến khi:

- nó đạt đến cuối lát thời gian (time slice) của mình;
- nó tự nguyện từ bỏ CPU, bằng cách thực hiện một system call chặn (blocking system call) hoặc bằng cách gọi system call `sched_yield()` (được mô tả ở Mục [35.3.3](#page-14-0));
- nó kết thúc (terminate); hoặc
- nó bị chiếm quyền (preempt) bởi một tiến trình có mức ưu tiên cao hơn.

Đối với hai sự kiện đầu tiên ở trên, khi một tiến trình chạy dưới chính sách `SCHED_RR` mất quyền truy cập CPU, nó sẽ được đưa về cuối hàng đợi tương ứng với mức ưu tiên của nó. Trong trường hợp cuối cùng, khi tiến trình có mức ưu tiên cao hơn đã ngừng thực thi, tiến trình bị chiếm quyền (preempted process) sẽ tiếp tục thực thi, tiêu thụ phần thời gian còn lại trong lát thời gian của nó (nghĩa là, tiến trình bị chiếm quyền vẫn giữ nguyên ở đầu hàng đợi cho mức ưu tiên của nó).

Ở cả hai chính sách `SCHED_RR` và `SCHED_FIFO`, tiến trình đang chạy hiện tại có thể bị chiếm quyền (preempt) vì một trong các lý do sau:

- một tiến trình có mức ưu tiên cao hơn vốn đang ở trạng thái bị chặn (blocked) nay đã chuyển sang trạng thái không bị chặn (ví dụ: một thao tác I/O mà nó đang chờ đã hoàn thành);
- mức ưu tiên của một tiến trình khác được nâng lên mức cao hơn tiến trình đang chạy hiện tại; hoặc
- mức ưu tiên của tiến trình đang chạy hiện tại bị giảm xuống mức thấp hơn một tiến trình có thể chạy (runnable process) khác.

Chính sách `SCHED_RR` tương tự như thuật toán lập lịch chia sẻ thời gian vòng tròn chuẩn (`SCHED_OTHER`), ở chỗ nó cho phép một nhóm tiến trình có cùng mức ưu tiên chia sẻ quyền truy cập CPU. Điểm khác biệt đáng chú ý nhất là sự tồn tại của các mức ưu tiên phân biệt rõ rệt, trong đó các tiến trình ưu tiên cao hơn luôn chiếm ưu thế hơn các tiến trình ưu tiên thấp hơn. Ngược lại, giá trị nice thấp (tức là mức ưu tiên cao) không mang lại cho tiến trình quyền truy cập độc quyền vào CPU; nó chỉ đơn thuần cung cấp cho tiến trình một trọng số có lợi trong các quyết định lập lịch. Như đã lưu ý ở Mục [35.1](#page-0-0), một tiến trình có mức ưu tiên thấp (tức là giá trị nice cao) vẫn luôn nhận được ít nhất một phần thời gian CPU. Một điểm khác biệt quan trọng nữa là chính sách `SCHED_RR` cho phép chúng ta kiểm soát chính xác thứ tự các tiến trình được lập lịch.

### 35.2.2 Chính sách SCHED\_FIFO

Chính sách SCHED\_FIFO (vào trước, ra trước - first-in, first-out) tương tự như chính sách SCHED\_RR. Điểm khác biệt lớn nhất là không có lát thời gian (time slice). Một khi tiến trình (process) SCHED\_FIFO giành được quyền truy cập CPU, nó sẽ thực thi cho đến khi:

- nó tự nguyện từ bỏ CPU (theo cách tương tự như đã mô tả đối với chính sách SCHED\_FIFO ở trên);
- nó kết thúc (terminate); hoặc
- nó bị chiếm quyền (preempted) bởi một tiến trình có độ ưu tiên cao hơn (trong cùng hoàn cảnh như đã mô tả đối với chính sách SCHED\_FIFO ở trên).

Trong trường hợp đầu tiên, tiến trình được đặt vào cuối hàng đợi tương ứng với mức độ ưu tiên của nó. Trong trường hợp cuối cùng, khi tiến trình có độ ưu tiên cao hơn ngừng thực thi (bằng cách chuyển sang trạng thái chờ/block hoặc kết thúc), tiến trình bị chiếm quyền sẽ tiếp tục thực thi (tức là tiến trình bị chiếm quyền vẫn ở đầu hàng đợi cho mức độ ưu tiên của nó).

### 35.2.3 Các chính sách SCHED\_BATCH và SCHED\_IDLE

Dòng nhân Linux 2.6 đã bổ sung hai chính sách lập lịch (scheduling policy) phi tiêu chuẩn: SCHED\_BATCH và SCHED\_IDLE. Mặc dù các chính sách này được thiết lập thông qua API lập lịch thời gian thực (realtime) POSIX, nhưng bản thân chúng không phải là các chính sách thời gian thực (realtime policy).

Chính sách SCHED\_BATCH, được thêm vào từ phiên bản nhân 2.6.16, tương tự như chính sách mặc định SCHED\_OTHER. Sự khác biệt là chính sách SCHED\_BATCH khiến cho các tác vụ (job) thường xuyên thức dậy (wake up) sẽ ít được lên lịch hơn. Chính sách này dành cho việc thực thi các tiến trình theo kiểu hàng đợi (batch-style).

Chính sách SCHED\_IDLE, được thêm vào từ phiên bản nhân 2.6.23, cũng tương tự như SCHED\_OTHER, nhưng cung cấp chức năng tương đương với giá trị nice rất thấp (tức là thấp hơn +19). Giá trị nice của tiến trình không có ý nghĩa đối với chính sách này. Nó nhằm mục đích chạy các tác vụ có độ ưu tiên thấp, những tác vụ này sẽ chỉ nhận được một phần đáng kể thời gian CPU nếu không có tác vụ nào khác trên hệ thống yêu cầu CPU.

## 35.3 API Lập lịch Tiến trình Thời gian thực (Realtime Process Scheduling API)

Bây giờ chúng ta xem xét các System Call khác nhau cấu thành nên API lập lịch tiến trình thời gian thực (realtime process scheduling API). Các System Call này cho phép chúng ta kiểm soát các chính sách lập lịch và mức độ ưu tiên của tiến trình (process).

> [!NOTE]
> Mặc dù lập lịch thời gian thực (realtime scheduling) đã là một phần của Linux kể từ phiên bản nhân 2.0, một số vấn đề vẫn tồn tại trong một thời gian dài ở phần cài đặt (implementation). Một số tính năng của phần cài đặt vẫn bị lỗi trong nhân 2.2, và thậm chí trong các phiên bản nhân 2.4 đầu. Hầu hết các vấn đề này đã được khắc phục vào khoảng phiên bản nhân 2.4.20.

### 35.3.1 Dải Độ ưu tiên Thời gian thực (Realtime Priority Ranges)

Các System Call `sched_get_priority_min()` và `sched_get_priority_max()` trả về dải độ ưu tiên khả dụng cho một chính sách lập lịch (scheduling policy).

```c
## include <sched.h>
int sched_get_priority_min(int policy);
int sched_get_priority_max(int policy);
             Cả hai đều trả về số nguyên không âm biểu thị độ ưu tiên khi thành công, hoặc –1 khi có lỗi
```

Đối với cả hai System Call, `policy` chỉ định chính sách lập lịch mà chúng ta muốn lấy thông tin. Đối với đối số này, chúng ta chỉ định `SCHED_RR` hoặc `SCHED_FIFO`. System Call `sched_get_priority_min()` trả về độ ưu tiên tối thiểu cho chính sách được chỉ định và `sched_get_priority_max()` trả về độ ưu tiên tối đa. Trên Linux, các System Call này trả về các số 1 và 99 tương ứng cho cả hai chính sách `SCHED_RR` và `SCHED_FIFO`. Nói cách khác, dải độ ưu tiên của hai chính sách thời gian thực hoàn toàn trùng khớp và các tiến trình `SCHED_RR` và `SCHED_FIFO` có cùng độ ưu tiên sẽ có đủ điều kiện như nhau để được lên lịch. (Tiến trình nào được lên lịch trước phụ thuộc vào thứ tự của chúng trong hàng đợi cho mức độ ưu tiên đó).

Dải độ ưu tiên thời gian thực khác nhau giữa các bản cài đặt UNIX khác nhau. Do đó, thay vì mã hóa cứng (hard-coding) các giá trị độ ưu tiên vào một ứng dụng, chúng ta nên chỉ định độ ưu tiên tương đối theo giá trị trả về từ một trong các hàm này. Do đó, độ ưu tiên `SCHED_RR` thấp nhất sẽ được chỉ định là `sched_get_priority_min(SCHED_FIFO)`, độ ưu tiên cao hơn tiếp theo là `sched_get_priority_min(SCHED_FIFO) + 1`, v.v.

> [!NOTE]
> SUSv3 không yêu cầu các chính sách `SCHED_RR` và `SCHED_FIFO` phải sử dụng cùng dải độ ưu tiên, nhưng thực tế chúng làm như vậy trên hầu hết các bản cài đặt UNIX. Ví dụ, trên Solaris 8, dải độ ưu tiên cho cả hai chính sách là từ 0 đến 59, và trên FreeBSD 6.1, là từ 0 đến 31.

### 35.3.2 Thay đổi và Truy xuất Chính sách (Policy) và Độ ưu tiên (Priority)

Trong phần này, chúng ta sẽ xem xét các System Call dùng để thay đổi và truy xuất các chính sách lịch biểu (scheduling policy) cũng như độ ưu tiên (priority).

### Thay đổi chính sách lịch biểu và độ ưu tiên

System Call `sched_setscheduler()` thay đổi cả chính sách lịch biểu và độ ưu tiên của tiến trình (process) có ID được chỉ định bởi `pid`. Nếu `pid` được chỉ định là 0, các thuộc tính của tiến trình gọi (calling process) sẽ được thay đổi.

## include <sched.h>

int sched_setscheduler(pid_t pid, int policy, const struct sched_param *param);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Tham số `param` là một con trỏ trỏ đến một cấu trúc (structure) có dạng sau:

```

struct sched_param {
int sched_priority; /* Độ ưu tiên lịch biểu */
};

```

SUSv3 định nghĩa tham số `param` như một cấu trúc nhằm cho phép một cài đặt (implementation) có thể bao gồm các trường bổ sung cụ thể theo cài đặt đó, điều này có thể hữu ích nếu cài đặt cung cấp thêm các chính sách lịch biểu bổ sung. Tuy nhiên, giống như hầu hết các cài đặt UNIX, Linux chỉ cung cấp trường `sched_priority`, trong đó chỉ định độ ưu tiên lịch biểu. Đối với các chính sách `SCHED_RR` và `SCHED_FIFO`, giá trị này phải nằm trong phạm vi được chỉ ra bởi `sched_get_priority_min()` và `sched_get_priority_max()`; đối với các chính sách khác, độ ưu tiên bắt buộc phải là 0.

Tham số `policy` xác định chính sách lịch biểu cho tiến trình. Nó được chỉ định là một trong các chính sách được hiển thị trong [Bảng 35-1](#page-9-0).

| Bảng 35-1: Các chính sách lịch biểu thời gian thực (realtime) và phi thời gian thực (nonrealtime) của Linux |  |  |
|-------------------------------------------------------------------------------------------------------------|--|--|
|                                                                                                             |  |  |

| Chính sách  | Mô tả                                                                                            | SUSv3 |
|-------------|--------------------------------------------------------------------------------------------------|-------|
| SCHED_FIFO  | Vào trước, ra trước thời gian thực (Realtime first-in first-out)                                 | •     |
| SCHED_RR    | Vòng tròn thời gian thực (Realtime round-robin)                                                  | •     |
| SCHED_OTHER | Chia sẻ thời gian vòng tròn tiêu chuẩn (Standard round-robin time-sharing)                       | •     |
| SCHED_BATCH | Tương tự như `SCHED_OTHER`, nhưng dành cho việc thực thi theo lô (batch) (từ Linux 2.6.16)       |       |
| SCHED_IDLE  | Tương tự như `SCHED_OTHER`, nhưng với độ ưu tiên thậm chí thấp hơn giá trị nice +19 (từ Linux 2.6.23) |       |

Một lời gọi `sched_setscheduler()` thành công sẽ đưa tiến trình được chỉ định bởi `pid` về cuối hàng đợi (queue) tương ứng với mức độ ưu tiên của nó.

SUSv3 quy định rằng giá trị trả về của một lời gọi `sched_setscheduler()` thành công phải là chính sách lịch biểu trước đó. Tuy nhiên, Linux khác biệt so với tiêu chuẩn ở chỗ một lời gọi thành công sẽ trả về 0. Một ứng dụng khả chuyển (portable application) nên kiểm tra tính thành công bằng cách kiểm tra xem trạng thái trả về có khác –1 hay không.

Chính sách lịch biểu và độ ưu tiên được kế thừa bởi tiến trình con (child process) được tạo ra thông qua `fork()`, và chúng được bảo toàn qua hàm `exec()`.

System Call `sched_setparam()` cung cấp một tập con các chức năng của `sched_setscheduler()`. Nó thay đổi độ ưu tiên lịch biểu của một tiến trình trong khi giữ nguyên chính sách lịch biểu.

## include <sched.h>
int sched_setparam(pid_t pid, const struct sched_param *param);
                                            Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Các tham số `pid` và `param` hoàn toàn giống với `sched_setscheduler()`.

Một lời gọi `sched_setparam()` thành công sẽ đưa tiến trình được chỉ định bởi `pid` về cuối hàng đợi tương ứng với mức độ ưu tiên của nó.

Chương trình trong [Liệt kê 35-2](#page-10-0) sử dụng `sched_setscheduler()` để thiết lập chính sách và độ ưu tiên cho các tiến trình được chỉ định bởi các tham số dòng lệnh (command-line arguments) của nó. Tham số đầu tiên là một ký tự chỉ định chính sách lịch biểu, tham số thứ hai là một số nguyên biểu diễn độ ưu tiên, và các tham số còn lại là ID của các tiến trình cần thay đổi thuộc tính lịch biểu.

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procpri/sched_set.c
## include <sched.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int j, pol;
 struct sched_param sp;
 if (argc < 3 || strchr("rfo", argv[1][0]) == NULL)
 usageErr("%s policy priority [pid...]\n"
 " policy is 'r' (RR), 'f' (FIFO), "
## ifdef SCHED_BATCH /* Cụ thể cho Linux */
 "'b' (BATCH), "
## endif
## ifdef SCHED_IDLE /* Cụ thể cho Linux */
 "'i' (IDLE), "
## endif
 "or 'o' (OTHER)\n",
 argv[0]);
 pol = (argv[1][0] == 'r') ? SCHED_RR :
 (argv[1][0] == 'f') ? SCHED_FIFO :
## ifdef SCHED_BATCH
 (argv[1][0] == 'b') ? SCHED_BATCH :
## endif
## ifdef SCHED_IDLE
 (argv[1][0] == 'i') ? SCHED_IDLE :
## endif
 SCHED_OTHER;
 sp.sched_priority = getInt(argv[2], 0, "priority");
 for (j = 3; j < argc; j++)
 if (sched_setscheduler(getLong(argv[j], 0, "pid"), pol, &sp) == -1)
 errExit("sched_setscheduler");
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procpri/sched_set.c
```

### Đặc quyền và giới hạn tài nguyên ảnh hưởng đến việc thay đổi tham số lập lịch (Scheduling Parameters)

Trong các phiên bản kernel trước 2.6.12, một tiến trình (process) thường bắt buộc phải có đặc quyền (CAP\_SYS\_NICE) để thực hiện các thay đổi đối với chính sách lập lịch (scheduling policy) và mức ưu tiên (priority). Ngoại lệ duy nhất cho yêu cầu này là một tiến trình không có đặc quyền (unprivileged process) có thể thay đổi chính sách lập lịch của một tiến trình thành SCHED\_OTHER nếu ID người dùng hiệu dụng (effective user ID) của tiến trình gọi khớp với ID người dùng thực (real user ID) hoặc hiệu dụng của tiến trình đích (target process).

Kể từ kernel 2.6.12, các quy tắc về việc thiết lập chính sách và mức ưu tiên lập lịch thời gian thực (realtime scheduling policies and priorities) đã thay đổi với sự xuất hiện của một giới hạn tài nguyên (resource limit) mới, không chuẩn, là RLIMIT\_RTPRIO. Giống như các kernel cũ, các tiến trình có đặc quyền (CAP\_SYS\_NICE) có thể thực hiện các thay đổi tùy ý đối với chính sách và mức ưu tiên lập lịch của bất kỳ tiến trình nào. Tuy nhiên, một tiến trình không có đặc quyền cũng có thể thay đổi chính sách và mức ưu tiên lập lịch, tuân theo các quy tắc sau:

- Nếu tiến trình có giới hạn mềm (soft limit) RLIMIT\_RTPRIO lớn hơn 0, thì nó có thể thực hiện các thay đổi tùy ý đối với chính sách và mức ưu tiên lập lịch của mình, tuân theo ràng buộc là giới hạn trên đối với mức ưu tiên thời gian thực mà nó có thể thiết lập chính là giá trị lớn nhất giữa mức ưu tiên thời gian thực hiện tại của nó (nếu tiến trình hiện đang hoạt động dưới chính sách thời gian thực) và giá trị giới hạn mềm RLIMIT\_RTPRIO của nó.
- Nếu giá trị giới hạn mềm RLIMIT\_RTPRIO của một tiến trình bằng 0, thì thay đổi duy nhất mà nó có thể thực hiện là hạ thấp mức ưu tiên lập lịch thời gian thực của mình hoặc chuyển đổi từ chính sách thời gian thực sang chính sách phi thời gian thực (nonrealtime policy).
- Chính sách SCHED\_IDLE là một ngoại lệ đặc biệt. Một tiến trình đang hoạt động dưới chính sách này không thể thực hiện bất kỳ thay đổi nào đối với chính sách của mình, bất kể giá trị của giới hạn tài nguyên RLIMIT\_RTPRIO là bao nhiêu.
- Các thay đổi về chính sách và mức ưu tiên cũng có thể được thực hiện từ một tiến trình không có đặc quyền khác, miễn là ID người dùng hiệu dụng của tiến trình đó khớp với ID người dùng thực hoặc hiệu dụng của tiến trình đích.
- Giới hạn mềm RLIMIT\_RTPRIO của một tiến trình chỉ quyết định những thay đổi nào có thể được thực hiện đối với chính sách và mức ưu tiên lập lịch của chính nó, dù là do bản thân tiến trình đó thực hiện hay do một tiến trình không có đặc quyền khác thực hiện. Một giới hạn lớn hơn 0 không cấp cho tiến trình không có đặc quyền khả năng thay đổi chính sách và mức ưu tiên lập lịch của các tiến trình khác.

Bắt đầu từ kernel 2.6.25, Linux bổ sung khái niệm nhóm lập lịch thời gian thực (realtime scheduling groups), có thể cấu hình thông qua tùy chọn kernel `CONFIG_RT_GROUP_SCHED`, điều này cũng ảnh hưởng đến các thay đổi có thể được thực hiện khi thiết lập chính sách lập lịch thời gian thực. Xem chi tiết tại tệp mã nguồn kernel `Documentation/scheduler/sched-rt-group.txt`.

### Truy xuất chính sách và độ ưu tiên lập lịch

System Call (lời hệ thống) `sched_getscheduler()` và `sched_getparam()` dùng để truy xuất chính sách lập lịch (scheduling policy) và độ ưu tiên (priority) của một Process (tiến trình).

## include <sched.h>

int sched_getscheduler(pid_t pid);
Trả về chính sách lập lịch, hoặc –1 khi lỗi
int sched_getparam(pid_t pid, struct sched_param *param);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Đối với cả hai system call này, `pid` chỉ định ID của tiến trình cần truy xuất thông tin. Nếu `pid` bằng 0, thông tin sẽ được truy xuất cho tiến trình gọi (calling process). Cả hai system call đều có thể được sử dụng bởi một tiến trình không có đặc quyền (unprivileged process) để truy xuất thông tin về bất kỳ tiến trình nào, không phụ thuộc vào Credentials (thông tin định danh).

System Call `sched_getparam()` trả về độ ưu tiên thời gian thực (realtime priority) của tiến trình được chỉ định nằm trong trường `sched_priority` của cấu trúc `sched_param` được trỏ bởi `param`.

Khi thực thi thành công, `sched_getscheduler()` trả về một trong các chính sách đã được trình bày trước đó trong [Bảng 35-1](#page-9-0).

Chương trình trong Listing 35-3 sử dụng `sched_getscheduler()` và `sched_getparam()` để truy xuất chính sách và độ ưu tiên của tất cả các tiến trình có Process ID (ID tiến trình) được truyền vào làm tham số dòng lệnh (command-line arguments). Phiên làm việc shell sau đây minh họa cách sử dụng chương trình này, cũng như chương trình trong [Listing 35-2:](#page-10-0)

```bash

$ su # Giả định có đặc quyền để thiết lập chính sách thời gian thực
Password:

## sleep 100 & # Tạo một tiến trình nền

[1] 2006

## ./sched_view 2006 # Xem chính sách và độ ưu tiên ban đầu của tiến trình sleep

2006: OTHER 0

## ./sched_set f 25 2006 # Chuyển tiến trình sang chính sách SCHED_FIFO, độ ưu tiên 25

## ./sched_view 2006 # Xác nhận thay đổi

2006: FIFO 25

```

**Listing 35-3:** Truy xuất chính sách lập lịch và độ ưu tiên của tiến trình

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––– procpri/sched_view.c

## include <sched.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
int j, pol;
struct sched_param sp;
for (j = 1; j < argc; j++) {
pol = sched_getscheduler(getLong(argv[j], 0, "pid"));
if (pol == -1)
errExit("sched_getscheduler");
if (sched_getparam(getLong(argv[j], 0, "pid"), &sp) == -1)
errExit("sched_getparam");
printf("%s: %-5s %2d\n", argv[j],
(pol == SCHED_OTHER) ? "OTHER" :
(pol == SCHED_RR) ? "RR" :
(pol == SCHED_FIFO) ? "FIFO" :

## ifdef SCHED_BATCH /* Dành riêng cho Linux */

(pol == SCHED_BATCH) ? "BATCH" :

## endif

## ifdef SCHED_IDLE /* Dành riêng cho Linux */

(pol == SCHED_IDLE) ? "IDLE" :

## endif

"???", sp.sched_priority);
}
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procpri/sched_view.c

```

### Ngăn chặn các tiến trình thời gian thực (realtime process) làm treo hệ thống

Vì các tiến trình `SCHED_RR` và `SCHED_FIFO` chiếm quyền (preempt) bất kỳ tiến trình có độ ưu tiên thấp hơn (ví dụ: shell dùng để chạy chương trình), nên khi phát triển các ứng dụng sử dụng các chính sách (policy) này, chúng ta cần nhận thức được khả năng một tiến trình thời gian thực (realtime process) chạy sai sót (runaway) có thể làm treo hệ thống do chiếm dụng toàn bộ CPU (hogging the CPU). Về mặt lập trình, có một số cách để tránh tình trạng này:

- Thiết lập giới hạn tài nguyên thời gian CPU mềm (soft CPU time resource limit) ở mức phù hợp (`RLIMIT_CPU`, được mô tả trong Mục [36.3](#page-27-0)) bằng cách sử dụng `setrlimit()`. Nếu tiến trình tiêu thụ quá nhiều thời gian CPU, nó sẽ được gửi một tín hiệu (signal) `SIGXCPU`, mặc định sẽ tiêu diệt (kill) tiến trình đó.
- Đặt một bộ hẹn giờ báo thức (alarm timer) bằng `alarm()`. Nếu tiến trình tiếp tục chạy trong một khoảng thời gian thực (wall clock time) vượt quá số giây được chỉ định trong lời gọi `alarm()`, nó sẽ bị tiêu diệt bởi tín hiệu `SIGALRM`.
- Tạo một tiến trình giám sát (watchdog process) chạy với độ ưu tiên thời gian thực (realtime priority) cao. Tiến trình này có thể lặp liên tục, ngủ (sleep) trong một khoảng thời gian được chỉ định, sau đó thức dậy và giám sát trạng thái của các tiến trình khác. Việc giám sát như vậy có thể bao gồm việc đo giá trị của đồng hồ thời gian CPU (CPU time clock) cho từng tiến trình (xem thảo luận về hàm `clock_getcpuclockid()` tại Mục 23.5.3) và kiểm tra chính sách cũng như độ ưu tiên lập lịch của nó bằng `sched_getscheduler()` và `sched_getparam()`. Nếu một tiến trình được coi là hoạt động bất thường, luồng giám sát (watchdog thread) có thể hạ độ ưu tiên của tiến trình đó, hoặc dừng/chấm dứt nó bằng cách gửi một tín hiệu (signal) phù hợp.
- Kể từ kernel 2.6.25, Linux cung cấp một giới hạn tài nguyên phi chuẩn (nonstandard resource limit), `RLIMIT_RTTIME`, để kiểm soát lượng thời gian CPU có thể được tiêu thụ trong một đợt liên tục (single burst) bởi một tiến trình chạy dưới chính sách lập lịch thời gian thực (realtime scheduling policy). Được chỉ định bằng đơn vị micro giây, `RLIMIT_RTTIME` giới hạn lượng thời gian CPU mà tiến trình có thể tiêu thụ mà không thực hiện một lời gọi hệ thống (system call) gây chặn (block). Khi tiến trình thực hiện một lời gọi như vậy, bộ đếm thời gian CPU đã tiêu thụ sẽ được đặt lại về 0. Bộ đếm thời gian CPU đã tiêu thụ sẽ không được đặt lại nếu tiến trình bị chiếm quyền (preempt) bởi một tiến trình có độ ưu tiên cao hơn, bị lập lịch ra khỏi CPU do hết lát cắt thời gian (time slice) (đối với tiến trình `SCHED_RR`), hoặc gọi hàm `sched_yield()` (Mục [35.3.3](#page-14-0)). Nếu tiến trình đạt đến giới hạn thời gian CPU của nó, thì tương tự như `RLIMIT_CPU`, nó sẽ được gửi tín hiệu `SIGXCPU`, mặc định sẽ tiêu diệt tiến trình đó.

Các thay đổi trong kernel 2.6.25 cũng có thể giúp ngăn chặn các tiến trình thời gian thực chạy sai sót làm treo hệ thống. Để biết thêm chi tiết, hãy xem tệp mã nguồn kernel `Documentation/scheduler/sched-rt-group.txt`.

### Ngăn chặn tiến trình con (child process) kế thừa các chính sách lập lịch đặc quyền (privileged scheduling policies)

Linux 2.6.32 đã bổ sung `SCHED_RESET_ON_FORK` như một giá trị có thể được chỉ định trong chính sách khi gọi hàm `sched_setscheduler()`. Đây là một giá trị cờ (flag value) được kết hợp theo phép OR với một trong các chính sách trong [Bảng 35-1.](#page-9-0) Nếu cờ này được thiết lập, thì các tiến trình con (children) được tạo bởi tiến trình này bằng hàm `fork()` sẽ không kế thừa các chính sách và mức ưu tiên lập lịch đặc quyền. Các quy tắc như sau:

- Nếu tiến trình gọi (calling process) có chính sách lập lịch thời gian thực (`SCHED_RR` hoặc `SCHED_FIFO`), thì chính sách trong các tiến trình con sẽ được đặt lại thành chính sách chia sẻ thời gian vòng tròn chuẩn (standard round-robin timesharing policy), `SCHED_OTHER`.
- Nếu tiến trình có giá trị nice âm (tức là mức ưu tiên cao), thì giá trị nice trong các tiến trình con sẽ được đặt lại thành 0.

Cờ `SCHED_RESET_ON_FORK` được thiết kế để sử dụng trong các ứng dụng phát đa phương tiện (media-playback applications). Nó cho phép tạo ra các tiến trình đơn có chính sách lập lịch thời gian thực (realtime scheduling policies) nhưng không thể truyền sang các tiến trình con. Việc sử dụng cờ `SCHED_RESET_ON_FORK` giúp ngăn chặn việc tạo ra các cuộc tấn công kiểu `fork` bomb nhằm né tránh giới hạn trên (ceiling) được thiết lập bởi giới hạn tài nguyên `RLIMIT_RTTIME` bằng cách tạo ra nhiều tiến trình con chạy dưới các chính sách lập lịch thời gian thực.

Một khi cờ `SCHED_RESET_ON_FORK` đã được bật cho một tiến trình, chỉ có tiến trình đặc quyền (`CAP_SYS_NICE`) mới có thể tắt nó đi. Khi một tiến trình con được tạo ra, cờ reset-on-fork của nó sẽ bị tắt.

### 35.3.3 Từ bỏ CPU (Relinquishing the CPU)

Một tiến trình thời gian thực (realtime process) có thể chủ động từ bỏ CPU theo hai cách: bằng cách gọi một system call làm chặn (block) tiến trình đó (ví dụ: thao tác `read()` từ một thiết bị đầu cuối) hoặc bằng cách gọi `sched_yield()`.

```c

## include <sched.h>

int sched_yield(void);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Hoạt động của `sched_yield()` rất đơn giản. Nếu có bất kỳ tiến trình có thể chạy (runnable process) nào khác đang nằm trong hàng đợi ở cùng mức ưu tiên với tiến trình gọi, thì tiến trình gọi sẽ được đưa về cuối hàng đợi, và tiến trình ở đầu hàng đợi sẽ được lập lịch để sử dụng CPU. Nếu không có tiến trình có thể chạy nào khác trong hàng đợi ở mức ưu tiên này, thì `sched_yield()` không làm gì cả; tiến trình gọi đơn giản là tiếp tục sử dụng CPU.

Mặc dù SUSv3 cho phép khả năng trả về lỗi từ `sched_yield()`, system call này luôn thực thi thành công trên Linux, cũng như trên nhiều cài đặt UNIX khác. Tuy nhiên, các ứng dụng khả chuyển (portable applications) vẫn luôn nên kiểm tra giá trị trả về lỗi.

Việc sử dụng `sched_yield()` cho các tiến trình phi thời gian thực (nonrealtime processes) là chưa được định nghĩa (undefined).

### 35.3.4 Khoảng thời gian lát cắt thời gian (Time Slice) của SCHED_RR

System call `sched_rr_get_interval()` cho phép chúng ta tìm ra độ dài của lát cắt thời gian (time slice) được cấp phát cho một tiến trình `SCHED_RR` mỗi khi nó được cấp quyền sử dụng CPU.

```c

## include <sched.h>

int sched_rr_get_interval(pid_t pid, struct timespec *tp);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Giống như các system call lập lịch tiến trình khác, `pid` xác định tiến trình mà chúng ta muốn lấy thông tin, và việc chỉ định `pid` là 0 có nghĩa là tiến trình đang gọi. Lát cắt thời gian được trả về trong cấu trúc `timespec` được trỏ tới bởi `tp`:

```c

struct timespec {
time_t tv_sec; /* Giây */
long tv_nsec; /* Nanosecond */
};

```

Trên các phiên bản kernel 2.6 gần đây, lát cắt thời gian vòng tròn thời gian thực (realtime round-robin time slice) là 0.1 giây.

## 35.4 Ái lực CPU (CPU Affinity)

Khi một tiến trình được lập lịch lại để chạy trên một hệ thống đa xử lý (multiprocessor system), nó không nhất thiết phải chạy trên cùng một CPU mà nó đã thực thi lần gần nhất. Lý do thông thường khiến nó chạy trên một CPU khác là CPU ban đầu đã bận.

Khi một tiến trình thay đổi CPU, sẽ có một ảnh hưởng đến hiệu năng (performance impact): để một dòng dữ liệu (data line) của tiến trình được tải vào bộ nhớ cache của CPU mới, nó trước tiên phải bị vô hiệu hóa (tức là bị loại bỏ nếu nó chưa bị sửa đổi, hoặc được ghi đẩy (flush) về bộ nhớ chính nếu nó đã bị sửa đổi), nếu dữ liệu đó đang có trong cache của CPU cũ. (Để tránh sự không nhất quán của cache, các kiến trúc đa xử lý cho phép dữ liệu chỉ được giữ trong một bộ nhớ cache CPU tại một thời điểm). Việc vô hiệu hóa này tốn thời gian thực thi. Do ảnh hưởng hiệu năng này, kernel Linux (2.6) cố gắng đảm bảo ái lực CPU mềm (soft CPU affinity) cho một tiến trình—bất cứ khi nào có thể, tiến trình được lập lịch lại để chạy trên cùng một CPU.

> Một dòng cache (cache line) tương đương trong bộ nhớ cache của một trang (page) trong hệ thống quản lý bộ nhớ ảo (virtual memory management system). Nó có kích thước của đơn vị được sử dụng để truyền tải dữ liệu giữa bộ nhớ cache của CPU và bộ nhớ chính. Kích thước dòng điển hình nằm trong khoảng từ 32 đến 128 byte. Để biết thêm thông tin, hãy xem [Schimmel, 1994] và [Drepper, 2007].

> Một trong các trường trong tệp `/proc/PID/stat` đặc trưng của Linux hiển thị số hiệu của CPU mà tiến trình đang thực thi hoặc thực thi lần cuối. Xem trang hướng dẫn (manual page) `proc(5)` để biết chi tiết.

Đôi khi, việc thiết lập ái lực CPU cứng (hard CPU affinity) cho một tiến trình là điều mong muốn, sao cho nó bị giới hạn một cách rõ ràng để luôn chạy trên một CPU duy nhất, hoặc một tập con các CPU có sẵn. Trong số các lý do chúng ta muốn làm điều này bao gồm những điểm sau:

- Chúng ta có thể tránh được các tác động hiệu năng (performance impact) do việc vô hiệu hóa dữ liệu trong bộ nhớ đệm (cache invalidation).
- Nếu nhiều luồng (thread) hoặc tiến trình (process) cùng truy cập vào một dữ liệu, chúng ta có thể thu được lợi ích về hiệu năng bằng cách ràng buộc (confine) tất cả chúng vào cùng một CPU, nhờ đó chúng không tranh chấp dữ liệu và tránh được việc trượt bộ nhớ đệm (cache miss).
- Đối với một ứng dụng thời gian thực (time-critical application), việc ràng buộc hầu hết các tiến trình trên hệ thống sang các CPU khác, đồng thời dành riêng một hoặc nhiều CPU cho ứng dụng thời gian thực đó có thể là một lựa chọn tối ưu.

Tùy chọn khởi động kernel `isolcpus` có thể được sử dụng để cô lập một hoặc nhiều CPU khỏi các thuật toán lập lịch thông thường của kernel (kernel scheduling algorithm). Cách duy nhất để di chuyển một tiến trình vào hoặc ra khỏi một CPU đã bị cô lập là thông qua các system call về độ ưu tiên CPU (CPU affinity) được mô tả trong phần này. Tùy chọn khởi động `isolcpus` là phương pháp được ưu tiên để thực hiện kịch bản cuối cùng được liệt kê ở trên. Để biết thêm chi tiết, hãy xem tệp mã nguồn kernel `Documentation/kernel-parameters.txt`.

Linux cũng cung cấp tùy chọn kernel `cpuset`, có thể được sử dụng trên các hệ thống chứa số lượng lớn CPU nhằm đạt được khả năng kiểm soát phức tạp hơn đối với cách phân bổ CPU và bộ nhớ cho các tiến trình. Để biết chi tiết, hãy xem tệp mã nguồn kernel `Documentation/cpusets.txt`.

Linux 2.6 cung cấp một cặp system call phi chuẩn để chỉnh sửa và truy vấn độ ưu tiên CPU cứng (hard CPU affinity) của một tiến trình: `sched_setaffinity()` và `sched_getaffinity()`.

> Nhiều cài đặt UNIX khác cung cấp các giao diện để điều khiển CPU affinity. Ví dụ, HP-UX và Solaris cung cấp system call `pset_bind()`.

System call `sched_setaffinity()` thiết lập CPU affinity của tiến trình được chỉ định bởi `pid`. Nếu `pid` bằng 0, CPU affinity của tiến trình gọi sẽ được thay đổi.

```c

## define _GNU_SOURCE

## include <sched.h>

int sched_setaffinity(pid_t pid, size_t len, cpu_set_t *set);
/* Trả về 0 khi thành công, hoặc –1 nếu có lỗi */

```

CPU affinity được gán cho tiến trình được chỉ định trong cấu trúc `cpu_set_t` được trỏ tới bởi `set`.

> CPU affinity thực chất là một thuộc tính của từng luồng (per-thread attribute) có thể được điều chỉnh độc lập cho từng luồng trong một nhóm luồng (thread group). Nếu chúng ta muốn thay đổi CPU affinity của một luồng cụ thể trong một tiến trình đa luồng (multithreaded process), chúng ta có thể chỉ định `pid` là giá trị trả về từ lời gọi hàm `gettid()` trong luồng đó. Việc chỉ định `pid` là 0 có nghĩa là luồng đang gọi.

Mặc dù kiểu dữ liệu `cpu_set_t` được triển khai dưới dạng một mặt nạ bit (bit mask), chúng ta nên coi nó như một cấu trúc mờ (opaque structure). Mọi thao tác trên cấu trúc này phải được thực hiện bằng cách sử dụng các macro `CPU_ZERO()`, `CPU_SET()`, `CPU_CLR()`, và `CPU_ISSET()`.

```c

## define _GNU_SOURCE

## include <sched.h>

void CPU_ZERO(cpu_set_t *set);
void CPU_SET(int cpu, cpu_set_t *set);
void CPU_CLR(int cpu, cpu_set_t *set);
int CPU_ISSET(int cpu, cpu_set_t *set);
/* Trả về true (1) nếu cpu nằm trong set, ngược lại trả về false (0) */

```

Các macro này thao tác trên tập hợp CPU (CPU set) được trỏ tới bởi `set` như sau:

- `CPU_ZERO()` khởi tạo `set` thành rỗng.
- `CPU_SET()` thêm CPU `cpu` vào `set`.
- `CPU_CLR()` xóa CPU `cpu` khỏi `set`.
- `CPU_ISSET()` trả về true nếu CPU `cpu` là thành viên của `set`.

Thư viện C chuẩn GNU (GNU C library) cũng cung cấp một số macro khác để làm việc với các tập hợp CPU. Xem trang hướng dẫn thủ công (manual page) `CPU_SET(3)` để biết thêm chi tiết.

Các CPU trong một tập hợp CPU được đánh số bắt đầu từ 0. Tệp tiêu đề `<sched.h>` định nghĩa hằng số `CPU_SETSIZE` lớn hơn một đơn vị so với số hiệu CPU tối đa có thể được biểu diễn trong một biến `cpu_set_t`. `CPU_SETSIZE` có giá trị là 1024.

Tham số `len` truyền cho `sched_setaffinity()` phải chỉ định số byte trong tham số `set` (tức là `sizeof(cpu_set_t)`).

Đoạn mã sau ràng buộc tiến trình được xác định bởi `pid` chỉ chạy trên bất kỳ CPU nào ngoài CPU đầu tiên của một hệ thống bốn bộ xử lý:

```

cpu_set_t set;
CPU_ZERO(&set);
CPU_SET(1, &set);
CPU_SET(2, &set);
CPU_SET(3, &set);
sched_setaffinity(pid, CPU_SETSIZE, &set);

```

Nếu các CPU được chỉ định trong `set` không tương ứng với bất kỳ CPU nào trên hệ thống, thì `sched_setaffinity()` sẽ thất bại và trả về lỗi `EINVAL`.

Nếu `set` không bao gồm CPU mà tiến trình gọi đang chạy trên đó, thì tiến trình sẽ được di chuyển (migrate) sang một trong các CPU nằm trong `set`.

Một tiến trình không có đặc quyền (unprivileged process) chỉ có thể thiết lập CPU affinity của một tiến trình khác nếu ID người dùng hiệu dụng (effective user ID) của nó khớp với ID người dùng thực hoặc hiệu dụng của tiến trình đích. Một tiến trình có đặc quyền (`CAP_SYS_NICE`) có thể thiết lập CPU affinity của bất kỳ tiến trình nào.

System call `sched_getaffinity()` truy vấn mặt nạ CPU affinity của tiến trình được chỉ định bởi `pid`. Nếu `pid` bằng 0, mặt nạ CPU affinity của tiến trình gọi sẽ được trả về.

## define _GNU_SOURCE
## include <sched.h>
int sched_getaffinity(pid_t pid, size_t len, cpu_set_t *set);
                                             Trả về 0 khi thành công, hoặc –1 nếu có lỗi
```

Mặt nạ CPU affinity được trả về trong cấu trúc `cpu_set_t` được trỏ tới bởi `set`. Tham số `len` nên được thiết lập để biểu thị số byte trong cấu trúc này (tức là `sizeof(cpu_set_t)`). Chúng ta có thể sử dụng macro `CPU_ISSET()` để xác định những CPU nào có trong tập hợp được trả về.

Nếu mặt nạ độ gắn kết CPU (CPU affinity mask) của tiến trình mục tiêu (target process) chưa từng bị chỉnh sửa, `sched_getaffinity()` trả về một tập hợp chứa tất cả các CPU trên hệ thống.

Không có việc kiểm tra quyền (permission checking) nào được thực hiện bởi `sched_getaffinity()`; một tiến trình không có đặc quyền (unprivileged process) có thể lấy được mặt nạ độ gắn kết CPU của bất kỳ tiến trình nào trên hệ thống.

Tiến trình con được tạo ra bởi `fork()` sẽ kế thừa mặt nạ độ gắn kết CPU của tiến trình cha, và mặt nạ này được giữ nguyên qua lời gọi `exec()`.

Các system call `sched_setaffinity()` và `sched_getaffinity()` là các hàm đặc trưng của Linux (Linux-specific).

Các chương trình `t_sched_setaffinity.c` và `t_sched_getaffinity.c` trong thư mục con `procpri` thuộc mã nguồn phân phối của cuốn sách này minh họa cách sử dụng `sched_setaffinity()` và `sched_getaffinity()`.

## 35.5 Tóm tắt

Thuật toán lập lịch mặc định của kernel sử dụng chính sách chia sẻ thời gian vòng tròn (round-robin time-sharing policy). Theo mặc định, tất cả các tiến trình đều có quyền truy cập CPU ngang nhau theo chính sách này, nhưng chúng ta có thể đặt giá trị nice (nice value) của tiến trình thành một số nằm trong khoảng từ –20 (ưu tiên cao) đến +19 (ưu tiên thấp) để khiến bộ lập lịch (scheduler) ưu tiên hoặc hạn chế tiến trình đó. Tuy nhiên, ngay cả khi chúng ta gán cho một tiến trình mức ưu tiên thấp nhất, nó cũng không bị bỏ đói CPU hoàn toàn.

Linux cũng triển khai các phần mở rộng lập lịch thời gian thực (realtime scheduling extensions) của POSIX. Những phần mở rộng này cho phép một ứng dụng kiểm soát chính xác việc phân bổ CPU cho các tiến trình. Các tiến trình hoạt động dưới hai chính sách lập lịch thời gian thực, `SCHED_RR` (round-robin) và `SCHED_FIFO` (first-in, first-out - vào trước, ra trước), luôn có mức ưu tiên cao hơn các tiến trình hoạt động theo các chính sách phi thời gian thực (nonrealtime policies). Các tiến trình thời gian thực có mức ưu tiên nằm trong khoảng từ 1 (thấp) đến 99 (cao). Miễn là có thể chạy được (runnable), một tiến trình có mức ưu tiên cao hơn sẽ loại bỏ hoàn toàn các tiến trình có mức ưu tiên thấp hơn khỏi CPU. Một tiến trình hoạt động theo chính sách `SCHED_FIFO` duy trì quyền truy cập độc quyền vào CPU cho đến khi nó kết thúc (terminate), tự nguyện nhường CPU (voluntarily relinquishes), hoặc bị chiếm quyền (preempted) do một tiến trình có mức ưu tiên cao hơn chuyển sang trạng thái có thể chạy. Các quy tắc tương tự cũng áp dụng cho chính sách `SCHED_RR`, với điểm bổ sung là nếu có nhiều tiến trình đang chạy cùng mức ưu tiên, thì CPU sẽ được chia sẻ giữa các tiến trình này theo phương thức vòng tròn.

Mặt nạ độ gắn kết CPU (CPU affinity mask) của tiến trình có thể được sử dụng để giới hạn tiến trình chỉ chạy trên một tập con các CPU có sẵn trên hệ thống đa xử lý (multiprocessor system). Điều này có thể cải thiện hiệu năng của một số loại ứng dụng nhất định.

### Thông tin thêm

[Love, 2010] cung cấp các chi tiết nền tảng về mức ưu tiên tiến trình và lập lịch trên Linux. [Gallmeister, 1995] cung cấp thêm thông tin về API lập lịch thời gian thực POSIX. Mặc dù hướng đến các luồng POSIX (POSIX threads), phần lớn các thảo luận về API lập lịch thời gian thực trong [Butenhof, 1996] là tài liệu nền tảng hữu ích cho các thảo luận về lập lịch thời gian thực trong chương này.

Để biết thêm thông tin về độ gắn kết CPU (CPU affinity) và việc kiểm soát phân bổ luồng cho các CPU cũng như các node bộ nhớ trên hệ thống đa xử lý, hãy xem tệp mã nguồn kernel `Documentation/cpusets.txt`, và các trang manual pages `mbind(2)`, `set_mempolicy(2)`, cùng với `cpuset(7)`.

## 35.6 Bài tập

- **35-1.** Hiện thực hóa câu lệnh nice(1).
- **35-2.** Viết một chương trình set-user-ID-root đóng vai trò là phiên bản tương đương của nice(1) nhưng dành cho lập lịch thời gian thực (realtime scheduling). Giao diện dòng lệnh (command-line interface) của chương trình này như sau:

### **./rtsched** *chính_sách độ_ưu_tiên câu_lệnh tham_số...*

Trong câu lệnh trên, *chính_sách* (policy) là `r` cho `SCHED_RR` hoặc `f` cho `SCHED_FIFO`. Chương trình này nên từ bỏ định danh có đặc quyền (privileged ID) của mình trước khi thực hiện hàm `exec` để chạy câu lệnh, vì những lý do được mô tả trong Mục 9.7.1 và [38.3](#page-54-0).

- **35-3.** Viết một chương trình tự đưa nó vào chính sách lập lịch `SCHED_FIFO` và sau đó tạo ra một tiến trình con (child process). Cả hai tiến trình phải thực thi một hàm làm cho tiến trình tiêu thụ tối đa 3 giây thời gian CPU. (Việc này có thể được thực hiện bằng cách sử dụng một vòng lặp trong đó System Call `times()` được gọi liên tục để xác định lượng thời gian CPU đã tiêu thụ cho đến thời điểm đó). Sau mỗi một phần tư giây thời gian CPU được tiêu thụ, hàm này phải in ra một thông báo hiển thị ID tiến trình (process ID) và lượng thời gian CPU đã tiêu thụ cho đến lúc đó. Sau mỗi giây thời gian CPU được tiêu thụ, hàm phải gọi `sched_yield()` để nhường CPU cho tiến trình còn lại. (Ngoài ra, các tiến trình có thể nâng độ ưu tiên lập lịch của nhau bằng cách sử dụng `sched_setparam()`). Đầu ra của chương trình phải chứng minh rằng hai tiến trình thay phiên nhau thực thi trong khoảng thời gian 1 giây CPU. (Hãy chú ý kỹ lời khuyên được đưa ra trong Mục [35.3.2](#page-8-0) về cách ngăn chặn một tiến trình thời gian thực chạy mất kiểm soát chiếm dụng CPU).
- **35-4.** Nếu hai tiến trình sử dụng một đường ống (pipe) để trao đổi một lượng lớn dữ liệu trên một hệ thống đa xử lý (multiprocessor system), quá trình giao tiếp sẽ nhanh hơn nếu các tiến trình chạy trên cùng một CPU so với khi chúng chạy trên các CPU khác nhau. Lý do là khi hai tiến trình chạy trên cùng một CPU, dữ liệu của pipe sẽ được truy cập nhanh hơn vì nó có thể nằm lại trong bộ nhớ cache của CPU đó. Ngược lại, khi các tiến trình chạy trên các CPU riêng biệt, các lợi ích từ bộ nhớ cache của CPU sẽ bị mất đi. Nếu bạn có quyền truy cập vào một hệ thống đa xử lý, hãy viết một chương trình sử dụng `sched_setaffinity()` để minh họa hiệu ứng này, bằng cách ép các tiến trình chạy hoặc là trên cùng các CPU hoặc là trên các CPU khác nhau. (Chương 44 mô tả việc sử dụng các pipe).

Lợi thế nghiêng về các tiến trình chạy trên cùng một CPU sẽ không đúng trên các hệ thống hỗ trợ siêu phân luồng (hyperthreaded systems) và trên một số kiến trúc đa xử lý hiện đại nơi các CPU có chia sẻ bộ nhớ cache. Trong những trường hợp này, lợi thế sẽ nghiêng về phía các tiến trình chạy trên các CPU khác nhau. Thông tin về cấu trúc topo CPU (CPU topology) của một hệ thống đa xử lý có thể thu được bằng cách kiểm tra nội dung của tệp `/proc/cpuinfo` đặc trưng của Linux.
