# Chương 19. Trình điều khiển ở Không gian Người dùng (Drivers in User Space)

| Trong chương này                        |     |
|------------------------------------------|-----|
| Lập lịch tiến trình và thời gian phản hồi<br>(Process Scheduling and Response Times) | 553 |
| Truy cập các vùng I/O (Accessing I/O Regions) | 558 |
| Truy cập các vùng bộ nhớ (Accessing Memory Regions) | 562 |
| SCSI chế độ người dùng (User Mode SCSI) | 565 |
| USB chế độ người dùng (User Mode USB) | 567 |
| I2C chế độ người dùng (User Mode I2C) | 571 |
| UIO                                      | 573 |
| Xem xét mã nguồn (Looking at the Sources) | 574 |

Hầu hết các trình điều khiển thiết bị (device driver) thích sống một cuộc đời đặc quyền bên trong kernel (Kernel Space), nhưng một số lại thoải mái ở thế giới không xác định bên ngoài. Một số hệ thống con (subsystem) của kernel, như SCSI, USB và I2C, cung cấp các mức độ hỗ trợ khác nhau cho các trình điều khiển chế độ người dùng (user mode driver), vì vậy bạn có thể điều khiển các thiết bị đó mà không cần viết một dòng mã kernel nào.

Bất chấp điều kiện thời tiết khắc nghiệt ở vùng đất người dùng (user land), các trình điều khiển chế độ người dùng vẫn có những ưu điểm nhất định. Chúng dễ phát triển và gỡ lỗi (debug). Bạn sẽ không phải khởi động lại hệ thống mỗi khi tham chiếu nhầm một con trỏ treo (dangling pointer). Một số trình điều khiển chế độ người dùng thậm chí sẽ hoạt động trên các hệ điều hành khác nhau nếu hệ thống con thiết bị đó tận dụng các dịch vụ từ một thư viện lập trình không gian người dùng (user-space programming library) chuẩn. Dưới đây là một số quy tắc ngón tay cái (rule of thumb) giúp quyết định xem trình điều khiển của bạn có nên nằm ở không gian người dùng (User Space) hay không:

- Áp dụng bài kiểm tra khả năng (possibility test). Những gì có thể được thực hiện ở không gian người dùng thì có lẽ nên ở lại không gian người dùng.
- Nếu bạn phải giao tiếp với một số lượng lớn các thiết bị chậm và yêu cầu về hiệu suất ở mức khiêm tốn, hãy khám phá khả năng triển khai các trình điều khiển trong không gian người dùng. Nếu bạn có các yêu cầu về hiệu suất đòi hỏi khắt khe về thời gian (time-critical), hãy ở lại bên trong kernel.
- Nếu mã của bạn cần các dịch vụ của các API kernel, quyền truy cập vào các biến kernel, hoặc gắn liền với việc xử lý ngắt (interrupt handling), thì đó là một lý do thuyết phục để nằm trong không gian kernel (Kernel Space).
- Nếu phần lớn những gì mã của bạn làm có thể được hiểu là chính sách (policy), thì user land có thể là nơi cư trú hợp lý của nó.
- Nếu phần còn lại của kernel cần gọi các dịch vụ của mã bạn, đó là một ứng cử viên để ở lại bên trong kernel.
- Bạn không thể dễ dàng thực hiện phép toán dấu phẩy động (floating-point arithmetic) bên trong kernel. Tuy nhiên, các lệnh của *Đơn vị dấu phẩy động* (*Floating-point unit* - FPU) có thể được sử dụng từ không gian người dùng.

Dù vậy, bạn không thể hoàn thành quá nhiều việc từ không gian người dùng. Nhiều lớp thiết bị quan trọng, chẳng hạn như phương tiện lưu trữ (storage media) và bộ điều khiển mạng (network adapter), không thể được điều khiển từ user land. Nhưng ngay cả khi một trình điều khiển kernel là giải pháp phù hợp, thì việc mô hình hóa và kiểm thử càng nhiều mã càng tốt trong không gian người dùng trước khi chuyển nó vào không gian kernel vẫn là một ý tưởng hay. Vòng đời kiểm thử sẽ nhanh hơn, và việc đi qua tất cả các luồng mã có thể (code path) cũng như đảm bảo chúng sạch sẽ sẽ dễ dàng hơn.

Trong chương này, thuật ngữ *trình điều khiển không gian người dùng* (*user space driver* - hoặc *trình điều khiển chế độ người dùng* - *user mode driver*) được sử dụng theo nghĩa chung, không tuân thủ nghiêm ngặt ngữ nghĩa của một trình điều khiển được ngụ ý từ đầu cuốn sách đến nay. Một ứng dụng được coi là một trình điều khiển chế độ người dùng nếu nó cũng là một ứng cử viên để được triển khai bên trong kernel.

Kernel 2.6 đã đại tu một hệ thống con đặc biệt được quan tâm đối với các trình điều khiển không gian người dùng. Bộ lập lịch tiến trình (process scheduler) mới mang lại lợi ích rất lớn về thời gian phản hồi cho mã chế độ người dùng, vì vậy hãy bắt đầu với điều đó.

## Lập lịch tiến trình và thời gian phản hồi (Process Scheduling and Response Times)

Nhiều trình điều khiển chế độ người dùng cần thực hiện một số công việc theo ràng buộc thời gian (time-bound). Tuy nhiên, trong không gian người dùng, tính không xác định do việc lập lịch và phân trang (paging) thường cản trở thời gian phản hồi nhanh. Để xem cách bạn có thể giảm thiểu tác động của rào cản trước, hãy cùng tìm hiểu các bộ lập lịch Linux gần đây và nắm bắt triết lý nền tảng của chúng.

## Bộ lập lịch ban đầu (The Original Scheduler)

Trong phiên bản 2.4 và các phiên bản trước đó, bộ lập lịch (scheduler) thường tính toán lại các tham số lập lịch của từng tiến trình (task) trước khi chọn tiến trình tiếp theo để thực thi. Do đó, thời gian tiêu tốn bởi thuật toán tăng tuyến tính theo số lượng tiến trình đang tranh chấp trong hệ thống. Nói cách khác, thuật toán này tốn thời gian $O(n)$, với $n$ là số lượng tiến trình hoạt động (active task). Trên một hệ thống chạy ở tải cao, điều này dẫn đến overhead (chi phí tốn kém về tài nguyên) đáng kể. Thuật toán của phiên bản 2.4 cũng hoạt động không thực sự tốt trên các hệ thống SMP (Symmetric Multiprocessing).

## Bộ lập lịch O(1) (The O(1) Scheduler)

Thời gian tiêu tốn của một thuật toán $O(n)$ phụ thuộc tuyến tính vào kích thước đầu vào của nó, và một giải pháp $O(n^2)$ phụ thuộc bậc hai vào độ dài đầu vào, nhưng kỹ thuật $O(1)$ thì độc lập với đầu vào và do đó có khả năng mở rộng (scale) rất tốt. Bộ lập lịch trong nhân 2.6 đã thay thế thuật toán $O(n)$ bằng phương pháp $O(1)$. Ngoài khả năng mở rộng cực tốt, bộ lập lịch này còn có các heuristic (thuật toán phỏng chừng) được tích hợp sẵn để cải thiện độ phản hồi của người dùng (user responsiveness) bằng cách ưu tiên các tiến trình tham gia vào hoạt động I/O (I/O activity). Các tiến trình (process) được chia làm hai loại: hướng I/O (I/O bound) và hướng CPU (CPU bound). Các tiến trình hướng I/O thường ở trạng thái ngủ/chờ (sleep-waiting) thiết bị I/O, trong khi các tiến trình hướng CPU lại là những tiến trình "nghiện" bộ xử lý. Trớ trêu thay, để đạt được thời gian phản hồi nhanh, những tiến trình "lười biếng" lại nhận được phần thưởng từ bộ lập lịch O(1), trong khi những tiến trình "chăm chỉ" lại bị chỉ trích. Hãy xem mục bên "Các điểm nổi bật của bộ lập lịch O(1)" để tìm hiểu một số tính năng quan trọng của nó.

### Các điểm nổi bật của bộ lập lịch O(1) (Highlights of the O(1) Scheduler)

Dưới đây là một số tính năng quan trọng của bộ lập lịch O(1):

- Thuật toán sử dụng hai hàng đợi chạy (*run queue*) bao gồm 140 danh sách ưu tiên: một hàng đợi *active* chứa các tiến trình vẫn còn lát thời gian (time slice) và một hàng đợi *expired* chứa các tiến trình đã dùng hết lát thời gian của mình. Khi một tiến trình hoàn thành lát thời gian của nó, nó được chèn vào hàng đợi expired theo thứ tự sắp xếp của độ ưu tiên. Hàng đợi active và expired sẽ được hoán đổi cho nhau khi hàng đợi active cạn kiệt. Để quyết định tiến trình nào sẽ chạy tiếp theo, bộ lập lịch không duyệt qua toàn bộ hàng đợi. Thay vào đó, nó chọn tiến trình có độ ưu tiên cao nhất từ hàng đợi active. Do đó, overhead của việc chọn tiến trình không phụ thuộc vào số lượng tiến trình đang hoạt động, mà phụ thuộc vào số lượng mức ưu tiên. Điều này biến nó thành một thuật toán thời gian hằng số (constant-time) hoặc $O(1)$.
- Bộ lập lịch hỗ trợ hai phạm vi độ ưu tiên: các giá trị *nice* tiêu chuẩn được hỗ trợ trên các hệ thống UNIX và độ ưu tiên nội bộ (internal priority). Phạm vi trước kéo dài từ –20 đến +19, trong khi phạm vi sau kéo dài từ 0 đến 139. Trong cả hai trường hợp, giá trị thấp hơn tương ứng với độ ưu tiên cao hơn. 100 mức ưu tiên nội bộ cao nhất (từ 0 đến 99) được dành riêng cho các tiến trình thời gian thực (Real-Time - RT), và 40 mức thấp nhất (từ 100 đến 139) được gán cho các tiến trình thông thường. 40 giá trị *nice* ánh xạ tới 40 mức ưu tiên nội bộ thấp nhất. Độ ưu tiên nội bộ của các tiến trình thông thường có thể được thay đổi động bởi bộ lập lịch, trong khi các giá trị *nice* được thiết lập tĩnh bởi người dùng. Mỗi độ ưu tiên nội bộ có một danh sách chạy (*run list*) đi kèm.
- Bộ lập lịch sử dụng một heuristic để tìm hiểu xem bản chất của một tiến trình là hướng I/O hay hướng CPU. Nói cách khác, nếu một tiến trình ngủ thường xuyên, nó có xu hướng hướng I/O, nhưng nếu nó sử dụng hết lát thời gian của mình một cách nhanh chóng, nó là tiến trình hướng CPU. Bất cứ khi nào bộ lập lịch phát hiện ra một tiến trình thể hiện các đặc tính hướng I/O, nó sẽ thưởng cho tiến trình đó bằng cách tăng động độ ưu tiên nội bộ của tiến trình lên. Ngược lại, các đặc tính hướng CPU sẽ bị phạt bằng điểm trừ.
- Lát thời gian được cấp phát tỷ lệ thuận với độ ưu tiên. Tiến trình có độ ưu tiên cao hơn sẽ nhận được lát thời gian lớn hơn.
- Một tiến trình sẽ không bị chiếm quyền (preempt) bởi bộ lập lịch miễn là nó vẫn còn tín dụng lát thời gian (time slice credit). Nếu nó nhường bộ xử lý trước khi dùng hết hạn mức lát thời gian của mình, nó có thể cộng dồn phần thời gian còn lại vào lần chạy tiếp theo. Vì các tiến trình hướng I/O là những tiến trình thường xuyên nhường CPU, điều này giúp cải thiện hiệu năng tương tác.
- Bộ lập lịch hỗ trợ các chính sách lập lịch thời gian thực (RT scheduling policy). Các tiến trình RT sẽ chiếm quyền các tiến trình thông thường (`SCHED_OTHER`). Người dùng sử dụng các chính sách RT có thể ghi đè lên các phân assignment độ ưu tiên động của bộ lập lịch. Không giống như các tiến trình `SCHED_OTHER`, độ ưu tiên của chúng không bị tính toán lại bởi nhân hệ điều hành (kernel) một cách tức thời (on-the-fly). Lập lịch RT có hai dạng: `SCHED_FIFO` và `SCHED_RR`. Chúng được sử dụng để tạo ra hành vi thời gian thực "mềm" ("soft" real-time), thay vì các đảm bảo thời gian thực "cứng" ("hard" RT) nghiêm ngặt. `SCHED_FIFO` không có khái niệm về lát thời gian; các tiến trình `SCHED_FIFO` chạy cho đến khi chúng ngủ/chờ I/O hoặc nhường bộ xử lý. `SCHED_RR` là một biến thể vòng tròn (round-robin) của `SCHED_FIFO`, trong đó cũng gán lát thời gian cho các tiến trình RT. Các tiến trình `SCHED_RR` đã hết lát thời gian sẽ được nối vào cuối danh sách ưu tiên tương ứng.
- Bộ lập lịch cải thiện hiệu năng SMP bằng cách sử dụng các hàng đợi chạy trên từng CPU (per-CPU run queue) và cơ chế đồng bộ hóa trên từng CPU (per-CPU synchronization).

## Trình lập lịch CFS (The CFS Scheduler)

Trình lập lịch Linux (Linux scheduler) lại một lần nữa trải qua đợt viết lại với phiên bản kernel 2.6.23. *Completely Fair Scheduler* (CFS) dành cho lớp `SCHED_OTHER` đã loại bỏ phần lớn sự phức tạp liên quan đến trình lập lịch O(1) bằng cách từ bỏ mảng độ ưu tiên (priority arrays), lát thời gian (time slices), các heuristic tính tương tác (interactivity heuristics), và sự phụ thuộc vào HZ. Mục tiêu của CFS là triển khai tính công bằng cho tất cả các thực thể lập lịch (scheduling entities) bằng cách cung cấp cho mỗi tiến trình (task) tổng công suất CPU chia cho số lượng các tiến trình đang chạy. Việc mổ xẻ CFS nằm ngoài phạm vi của chương này. Hãy tham khảo *Documentation/sched-design-CFS.txt* để có một hướng dẫn ngắn gọn.

### Thời gian phản hồi (Response Times)

Là một nhà phát triển trình điều khiển chế độ người dùng (user mode driver developer), bạn có một số tùy chọn để cải thiện thời gian phản hồi của ứng dụng:

- Sử dụng các chính sách lập lịch thời gian thực (RT scheduling policies) cung cấp cho bạn quyền kiểm soát chi tiết hơn bình thường. Hãy xem các trang man của `sched_setscheduler()` và các hàm liên quan để có cái nhìn chi tiết về cách đạt được thời gian phản hồi RT mềm (soft RT response times).
- Nếu bạn đang sử dụng lập lịch phi thời gian thực (non-RT scheduling), hãy tinh chỉnh các giá trị *nice* của các tiến trình khác nhau để đạt được mức cân bằng hiệu năng yêu cầu.
- Nếu bạn đang sử dụng kernel phiên bản 2.6.23 trở lên được bật trình lập lịch CFS, bạn có thể tinh chỉnh `/proc/sys/kernel/sched_granularity_ns`. Nếu bạn đang sử dụng kernel trước phiên bản 2.6.23, hãy sửa đổi các lệnh `#define` trong *kernel/sched.c* và *include/linux/sched.h* để phù hợp với ứng dụng của mình. Hãy thay đổi các giá trị này một cách cẩn thận để đáp ứng nhu cầu của bộ ứng dụng của bạn. Các kịch bản sử dụng trình lập lịch rất phức tạp. Các thiết lập làm hài lòng một số điều kiện tải nhất định có thể làm giảm hiệu năng ở các điều kiện khác, vì vậy bạn có thể phải thử nghiệm theo phương pháp thử và sai (trial and error).
- Thời gian phản hồi không chỉ thuộc phạm vi của trình lập lịch; chúng còn phụ thuộc vào kiến trúc giải pháp. Ví dụ, nếu bạn đánh dấu một trình xử lý ngắt bận (busy interrupt handler) là *fast* (nhanh), nó sẽ vô hiệu hóa thường xuyên các ngắt cục bộ khác và điều đó có thể làm chậm quá trình thu thập và truyền dữ liệu trên các IRQ khác.

Hãy cùng triển khai một ví dụ và xem cách một trình điều khiển chế độ người dùng (user mode driver) có thể đạt được thời gian phản hồi nhanh bằng cách phòng ngừa tính bất định (indeterminism) do việc lập lịch và phân trang (paging) giới thiệu. Như bạn đã học ở Chương 2, "Nhìn sâu vào bên trong Kernel" (A Peek Inside the Kernel), RTC là một nguồn bộ định thời (timer source) có thể tạo ra các ngắt định kỳ (periodic interrupts) với độ chính xác cao. Liệt kê 19.1 (Listing 19.1) triển khai một ví dụ sử dụng các báo cáo ngắt từ `/dev/rtc` để thực hiện công việc định kỳ với độ chính xác cỡ microsecond (micro-giây). Bộ đếm dấu thời gian Pentium *Time Stamp Counter* (TSC) được sử dụng để đo thời gian phản hồi.

Chương trình trong Liệt kê 19.1 đầu tiên thay đổi chính sách lập lịch của nó thành `SCHED_FIFO` bằng cách sử dụng `sched_setscheduler()`. Tiếp theo, nó gọi `mlockall()` để khóa tất cả các trang được ánh xạ (mapped pages) trong bộ nhớ nhằm đảm bảo rằng việc hoán đổi trang (swapping) không cản trở thời gian mang tính tất định (deterministic timing). Chỉ người dùng siêu cấp (super-user) mới được phép gọi `sched_setscheduler()` và `mlockall()` cũng như yêu cầu các ngắt RTC ở tần số lớn hơn 64Hz.

**Liệt kê 19.1. Công việc định kỳ với độ chính xác cỡ Microsecond (Periodic Work with Microsecond Precision)**

```c
## include <linux/rtc.h>
## include <sys/ioctl.h>
## include <sys/time.h>
## include <fcntl.h>
## include <pthread.h>
## include <linux/mman.h>
/* Read the lower half of the Pentium Time Stamp Counter
 using the rdtsc instruction */
## define rdtscl(val) __asm__ __volatile__ ("rdtsc" : "=A" (val))
main()
{
 unsigned long ts0, ts1, now, worst; /* Store TSC ticks */
 struct sched_param sched_p; /* Information related to
 scheduling priority */
 int fd, i=0;
 unsigned long data;
 /* Change the scheduling policy to SCHED_FIFO */
 sched_getparam(getpid(), &sched_p);
 sched_p.sched_priority = 50; /* RT Priority */
 sched_setscheduler(getpid(), SCHED_FIFO, &sched_p);
 /* Avoid paging and related indeterminism */
 mlockall(MCL_CURRENT);
 /* Open the RTC */
 fd = open("/dev/rtc", O_RDONLY);
 /* Set the periodic interrupt frequency to 8192Hz
 This should give an interrupt rate of 122uS */
 ioctl(fd, RTC_IRQP_SET, 8192);
 /* Enable periodic interrupts */
 ioctl(fd, RTC_PIE_ON, 0);
 rdtscl(ts0);
 worst = 0;
 while (i++ < 10000) {
 /* Block until the next periodic interrupt */
 read(fd, &data, sizeof(unsigned long));
```

```c
 /* Use the TSC to precisely measure the time consumed.
 Reading the lower half of the TSC is sufficient */
 rdtscl(ts1);
 now = (ts1-ts0);
 /* Update the worst case latency */
 if (now > worst) worst = now;
 ts0 = ts1;
 /* Do work that is to be done periodically */
 do_work(); /* NOP for the purpose of this measurement */
 }
 printf("Worst latency was %8ld\n", worst);
 /* Disable periodic interrupts */
 ioctl(fd, RTC_PIE_OFF, 0);
}
```

Mã nguồn trong Liệt kê 19.1 thực hiện vòng lặp 10.000 lần và in ra độ trễ trường hợp xấu nhất (worst-case latency) xảy ra trong quá trình thực thi. Kết quả đầu ra là 240899 trên một cỗ máy Pentium 1.8GHz, tương ứng khoảng 133 micro-giây. Theo bảng dữ liệu (data sheet) của chipset RTC, tần số bộ định thời là 8192Hz sẽ dẫn đến tốc độ ngắt định kỳ là 122 micro-giây. Con số đó rất sát thực tế. Hãy chạy lại mã nguồn dưới các mức tải khác nhau bằng cách sử dụng `SCHED_OTHER` thay vì `SCHED_FIFO` và quan sát độ lệch (drift) kết quả.

Bạn cũng có thể chạy các luồng nhân (kernel threads) ở chế độ thực thi thời gian thực (RT mode). Để làm điều đó, hãy thực hiện các bước sau khi bạn khởi động luồng:

```c
static int
my_kernel_thread(void *i)
{
 daemonize();
 current->policy = SCHED_FIFO;
 current->rt_priority = 1;
 /* ... */
}
```
