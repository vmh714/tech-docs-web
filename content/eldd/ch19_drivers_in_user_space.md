# Chương 19: Trình điều khiển ở không gian người dùng (Drivers in User Space)

| Trong chương này | Trang |
|------------------|-------|
| Lập lịch tiến trình và thời gian phản hồi | 553 |
| Truy cập các vùng I/O | 558 |
| Truy cập các vùng bộ nhớ | 562 |
| SCSI ở chế độ người dùng | 565 |
| USB ở chế độ người dùng | 567 |
| I2C ở chế độ người dùng | 571 |
| UIO | 573 |
| Xem xét mã nguồn | 574 |

Hầu hết các trình điều khiển thiết bị (device driver) thích sống một cuộc đời đặc quyền bên trong kernel, nhưng một số lại hoạt động tốt trong thế giới không xác định bên ngoài. Một số hệ thống con (subsystem) của kernel như SCSI, USB và I2C cung cấp các mức độ hỗ trợ nhất định cho các trình điều khiển ở chế độ người dùng (user mode driver), nhờ đó bạn có thể điều khiển các thiết bị này mà không cần viết một dòng mã kernel nào.

Bất chấp những điều kiện bất lợi ở không gian người dùng (user land), các trình điều khiển ở chế độ người dùng vẫn sở hữu những ưu điểm nhất định. Chúng dễ phát triển và gỡ lỗi (debug). Bạn sẽ không phải khởi động lại hệ thống mỗi khi tham chiếu nhầm một con trỏ treo (dangling pointer). Một số trình điều khiển chế độ người dùng thậm chí có thể hoạt động trên nhiều hệ điều hành khác nhau nếu hệ thống con của thiết bị đó sử dụng các dịch vụ từ một thư viện lập trình không gian người dùng chuẩn. Dưới đây là một số quy tắc kinh nghiệm (rule of thumb) giúp bạn quyết định xem trình điều khiển có nên nằm ở không gian người dùng (user space) hay không:

- Áp dụng kiểm tra tính khả thi: Những gì có thể thực hiện ở không gian người dùng thì nên giữ lại ở không gian người dùng.
- Nếu bạn phải giao tiếp với một số lượng lớn các thiết bị tốc độ chậm và yêu cầu hiệu năng ở mức vừa phải, hãy xem xét khả năng triển khai trình điều khiển trong không gian người dùng. Nếu bạn có các yêu cầu hiệu năng đòi hỏi thời gian ngặt nghèo (time-critical), hãy giữ mã nguồn bên trong kernel.
- Nếu mã nguồn của bạn cần các dịch vụ từ kernel API, cần truy cập vào các biến kernel, hoặc gắn liền với xử lý ngắt (interrupt handling), đó là lý do thuyết phục để nó nằm trong không gian kernel (kernel space).
- Nếu phần lớn chức năng mã nguồn của bạn được định nghĩa là chính sách (policy), không gian người dùng là nơi cư trú hợp lý của nó.
- Nếu các thành phần còn lại của kernel cần gọi đến dịch vụ do mã nguồn của bạn cung cấp, đó là ứng cử viên nên ở lại bên trong kernel.
- Bạn không thể thực hiện phép toán dấu phẩy động (floating-point arithmetic) một cách dễ dàng bên trong kernel. Tuy nhiên, các lệnh của *Đơn vị xử lý dấu phẩy động* (Floating-Point Unit - FPU) có thể được sử dụng từ không gian người dùng.

Dù vậy, bạn không thể làm được quá nhiều việc chỉ từ không gian người dùng. Nhiều lớp thiết bị quan trọng, chẳng hạn như thiết bị lưu trữ (storage media) và bộ điều khiển mạng (network adapter), không thể vận hành từ không gian người dùng. Nhưng ngay cả khi trình điều khiển kernel là giải pháp phù hợp, bạn vẫn nên mô hình hóa và kiểm thử càng nhiều mã nguồn càng tốt trong không gian người dùng trước khi chuyển nó vào kernel. Vòng đời kiểm thử sẽ nhanh hơn, đồng thời việc rà soát toàn bộ các luồng thực thi (code path) để bảo đảm độ sạch sẽ của mã nguồn cũng dễ dàng hơn.

Trong chương này, thuật ngữ *trình điều khiển không gian người dùng* (user space driver hoặc user mode driver) được dùng theo nghĩa rộng, không tuân thủ nghiêm ngặt ngữ nghĩa của một trình điều khiển kernel chuẩn như đã mô tả từ đầu sách đến nay. Một ứng dụng được coi là một trình điều khiển chế độ người dùng nếu nó cũng là một ứng cử viên có thể triển khai bên trong kernel.

Kernel 2.6 đã đại tu một hệ thống con đặc biệt quan trọng đối với các trình điều khiển không gian người dùng. Bộ lập lịch tiến trình (process scheduler) mới mang lại lợi ích rất lớn về thời gian phản hồi cho mã ở chế độ người dùng, vì vậy chúng ta hãy bắt đầu với chủ đề này.

## Lập lịch tiến trình và thời gian phản hồi

Nhiều trình điều khiển chế độ người dùng cần thực hiện công việc với ràng buộc nghiêm ngặt về thời gian (time-bound). Tuy nhiên, trong không gian người dùng, tính bất định (indeterminism) do việc lập lịch và phân trang (paging) thường cản trở thời gian phản hồi nhanh. Để hiểu cách giảm thiểu tác động của rào cản lập lịch, hãy cùng tìm hiểu các bộ lập lịch Linux gần đây và nắm bắt triết lý thiết kế nền tảng của chúng.

## Bộ lập lịch ban đầu (O(n) Scheduler)

Trong phiên bản 2.4 và trước đó, bộ lập lịch (scheduler) phải tính toán lại các tham số lập lịch của từng tiến trình (task) trước khi chọn tiến trình tiếp theo để chạy. Do đó, thời gian tiêu tốn của thuật toán tăng tuyến tính theo số lượng tiến trình đang cạnh tranh trong hệ thống. Nói cách khác, nó tiêu tốn thời gian $O(n)$, với $n$ là số lượng tiến trình đang hoạt động (active task). Trên các hệ thống chạy ở mức tải cao, điều này dẫn đến chi phí phụ trội (overhead) rất lớn. Thuật toán của bản 2.4 cũng hoạt động không hiệu quả trên các hệ thống đa xử lý đối xứng (SMP).

## Bộ lập lịch O(1)

Thời gian tiêu tốn của một thuật toán $O(n)$ phụ thuộc tuyến tính vào kích thước dữ liệu đầu vào, và giải pháp $O(n^2)$ phụ thuộc theo hàm bậc hai, nhưng kỹ thuật $O(1)$ lại hoàn toàn độc lập với đầu vào, do đó có khả năng mở rộng (scale) rất tốt. Bộ lập lịch của Kernel 2.6 đã thay thế thuật toán $O(n)$ bằng phương pháp $O(1)$. Bên cạnh khả năng mở rộng vượt trội, bộ lập lịch này còn tích hợp các giải thuật phỏng chừng (heuristics) nhằm cải thiện độ phản hồi với người dùng (user responsiveness) bằng cách ưu tiên các tiến trình thực hiện hoạt động I/O.

Các tiến trình được chia thành hai loại: hướng I/O (I/O bound) và hướng CPU (CPU bound). Các tiến trình hướng I/O thường xuyên ở trạng thái ngủ/chờ thiết bị I/O, trong khi các tiến trình hướng CPU là những tiến trình "nghiện" xử lý dữ liệu. Nghịch lý là, để đạt được thời gian phản hồi nhanh, những tiến trình "lười biếng" (hướng I/O) lại nhận được ưu đãi từ bộ lập lịch O(1), trong khi những tiến trình "chăm chỉ" (hướng CPU) lại chịu bất lợi. Hãy xem khung "Điểm nổi bật của bộ lập lịch O(1)" để biết thêm chi tiết.

> [!NOTE]
> ### Điểm nổi bật của bộ lập lịch O(1)
> 
> Dưới đây là một số tính năng quan trọng của bộ lập lịch O(1):
> 
> - Thuật toán sử dụng hai hàng đợi chạy (*run queue*) bao gồm 140 danh sách ưu tiên: một hàng đợi *active* chứa các tiến trình còn hạn mức lát thời gian (time slice) và một hàng đợi *expired* chứa các tiến trình đã dùng hết lát thời gian. Khi một tiến trình dùng hết lát thời gian, nó sẽ được đưa vào hàng đợi expired theo thứ tự độ ưu tiên. Hai hàng đợi active và expired sẽ hoán đổi vị trí cho nhau khi hàng đợi active trống rỗng. Để quyết định tiến trình tiếp theo sẽ chạy, bộ lập lịch không duyệt qua toàn bộ hàng đợi. Thay vào đó, nó chọn ngay tiến trình có độ ưu tiên cao nhất từ hàng đợi active. Do đó, chi phí chọn tiến trình không phụ thuộc vào số lượng tiến trình đang hoạt động mà phụ thuộc vào số lượng mức ưu tiên. Điều này biến nó thành thuật toán thời gian hằng số hay $O(1)$.
> - Bộ lập lịch hỗ trợ hai dải độ ưu tiên: các giá trị *nice* tiêu chuẩn trên UNIX (từ –20 đến +19) và các độ ưu tiên nội bộ (từ 0 đến 139). Trong cả hai trường hợp, giá trị nhỏ hơn tương ứng với độ ưu tiên cao hơn. 100 mức ưu tiên nội bộ cao nhất (0 đến 99) được dành riêng cho các tiến trình thời gian thực (Real-Time - RT), và 40 mức thấp nhất (100 đến 139) gán cho các tiến trình thông thường. 40 giá trị *nice* được ánh xạ trực tiếp vào 40 mức ưu tiên nội bộ thấp nhất này. Độ ưu tiên nội bộ của các tiến trình thông thường có thể biến đổi động bởi bộ lập lịch, trong khi các giá trị *nice* được thiết lập tĩnh bởi người dùng. Mỗi độ ưu tiên nội bộ sở hữu một danh sách chạy (*run list*) riêng.
> - Bộ lập lịch sử dụng giải thuật phỏng chừng (heuristic) để xác định một tiến trình là hướng I/O hay hướng CPU. Đơn giản là: nếu một tiến trình ngủ thường xuyên, nó có xu hướng hướng I/O; nếu nó dùng hết lát thời gian rất nhanh, nó là tiến trình hướng CPU. Khi phát hiện tiến trình có đặc tính hướng I/O, bộ lập lịch sẽ "thưởng" cho nó bằng cách tăng độ ưu tiên nội bộ một cách động. Ngược lại, đặc tính hướng CPU sẽ bị trừ điểm ưu tiên.
> - Lát thời gian được cấp phát tỷ lệ thuận với độ ưu tiên. Tiến trình có độ ưu tiên cao hơn sẽ nhận được lát thời gian lớn hơn.
> - Một tiến trình sẽ không bị bộ lập lịch chiếm quyền ưu tiên (preempt) chừng nào nó vẫn còn hạn mức lát thời gian. Nếu tiến trình tự nguyện nhường CPU trước khi dùng hết hạn mức, nó có thể cộng dồn phần thời gian còn thừa vào lần chạy tiếp theo. Vì các tiến trình hướng I/O là đối tượng thường xuyên nhường CPU, điều này giúp cải thiện đáng kể hiệu năng tương tác.
> - Bộ lập lịch hỗ trợ các chính sách lập lịch thời gian thực (RT scheduling policies). Các tiến trình RT sẽ chiếm quyền của các tiến trình thông thường (`SCHED_OTHER`). Người dùng chính sách RT có thể ghi đè phân bổ độ ưu tiên động của bộ lập lịch. Không giống như các tiến trình `SCHED_OTHER`, độ ưu tiên của tiến trình RT không bị nhân hệ điều hành tính toán lại trong quá trình thực thi (on-the-fly). Lập lịch RT có hai dạng: `SCHED_FIFO` và `SCHED_RR`. Chúng được dùng để tạo ra hành vi thời gian thực "mềm" (soft real-time) chứ không cung cấp các đảm bảo thời gian thực "cứng" (hard RT) khắt khe. `SCHED_FIFO` không có khái niệm lát thời gian; tiến trình `SCHED_FIFO` chạy liên tục cho đến khi nó ngủ chờ I/O hoặc tự nhường CPU. `SCHED_RR` là biến thể xoay vòng (round-robin) của `SCHED_FIFO` có gán thêm lát thời gian. Các tiến trình `SCHED_RR` khi hết lát thời gian sẽ được chuyển xuống cuối danh sách ưu tiên tương ứng.
> - Bộ lập lịch cải thiện hiệu năng SMP bằng cách sử dụng hàng đợi chạy trên từng CPU (per-CPU run queue) và cơ chế đồng bộ hóa riêng trên từng CPU (per-CPU synchronization).

## Bộ lập lịch CFS

Bộ lập lịch Linux tiếp tục được viết lại từ bản kernel 2.6.23. Bộ lập lịch công bằng tuyệt đối (*Completely Fair Scheduler* - CFS) dành cho lớp `SCHED_OTHER` đã loại bỏ phần lớn sự phức tạp của bộ lập lịch O(1) bằng cách bỏ hẳn mảng độ ưu tiên (priority arrays), lát thời gian (time slices), các giải thuật phỏng chừng tương tác (interactivity heuristics) và sự phụ thuộc vào tần số ngắt đồng hồ HZ. Mục tiêu của CFS là triển khai tính công bằng cho tất cả các thực thể lập lịch (scheduling entities) bằng cách chia đều tổng công suất xử lý của CPU cho số lượng tiến trình đang chạy. Việc phân tích chuyên sâu CFS nằm ngoài phạm vi chương này. Bạn có thể tham khảo tệp *Documentation/sched-design-CFS.txt* để xem tài liệu tóm tắt.

### Thời gian phản hồi

Với tư cách là nhà phát triển trình điều khiển ở chế độ người dùng, bạn có một số tùy chọn để cải thiện thời gian phản hồi của ứng dụng:

- Sử dụng các chính sách lập lịch thời gian thực (RT scheduling policies) để có quyền kiểm soát tinh vi hơn. Hãy tham khảo trang hướng dẫn (man page) của `sched_setscheduler()` và các hàm liên quan để biết cách đạt được thời gian phản hồi RT mềm.
- Nếu sử dụng lập lịch phi thời gian thực (non-RT), hãy tinh chỉnh giá trị *nice* của các tiến trình khác nhau để đạt được mức cân bằng hiệu năng mong muốn.
- Nếu dùng kernel từ phiên bản 2.6.23 trở lên có bật CFS, bạn có thể tinh chỉnh thông số `/proc/sys/kernel/sched_granularity_ns`. Nếu dùng kernel cũ hơn 2.6.23, hãy sửa đổi các chỉ thị `#define` trong *kernel/sched.c* và *include/linux/sched.h* cho phù hợp với ứng dụng. Hãy thay đổi các giá trị này một cách cẩn trọng. Các kịch bản sử dụng bộ lập lịch rất phức tạp: cấu hình tối ưu cho một kiểu tải nhất định có thể làm sụt giảm hiệu năng ở các kiểu tải khác, do đó bạn cần phải thực nghiệm để tìm ra thông số phù hợp.
- Thời gian phản hồi không chỉ phụ thuộc vào bộ lập lịch mà còn phụ thuộc vào kiến trúc giải pháp. Ví dụ, nếu bạn đánh dấu một trình xử lý ngắt bận rộn (busy interrupt handler) là *fast*, nó sẽ thường xuyên vô hiệu hóa các ngắt cục bộ khác, dẫn đến nguy cơ làm chậm quá trình thu thập và truyền dữ liệu trên các IRQ còn lại.

Hãy cùng triển khai một ví dụ để xem trình điều khiển chế độ người dùng đạt được thời gian phản hồi nhanh như thế nào bằng cách phòng ngừa tính bất định do lập lịch và phân trang gây ra. Như đã học ở Chương 2, "Nhìn sâu vào bên trong Kernel", RTC là một nguồn bộ định thời có thể tạo ngắt định kỳ với độ chính xác cao. Mã nguồn 19.1 minh họa việc sử dụng thông báo ngắt từ `/dev/rtc` để thực hiện công việc định kỳ với độ chính xác tới mức microsecond. Bộ đếm dấu thời gian trên vi xử lý Pentium (Time Stamp Counter - TSC) được dùng để đo thời gian phản hồi.

Chương trình trong Mã nguồn 19.1 trước tiên chuyển chính sách lập lịch sang `SCHED_FIFO` bằng hàm `sched_setscheduler()`. Tiếp theo, nó gọi `mlockall()` để khóa tất cả các trang bộ nhớ đã ánh xạ, đảm bảo tiến trình hoán đổi trang (swapping) không ảnh hưởng đến tính tất định thời gian. Chỉ tài khoản quản trị (super-user) mới có quyền gọi `sched_setscheduler()`, `mlockall()` và yêu cầu tần số ngắt RTC lớn hơn 64Hz.

**Mã nguồn 19.1. Thực hiện công việc định kỳ với độ chính xác Microsecond**

```c
## include <linux/rtc.h>
## include <sys/ioctl.h>
## include <sys/time.h>
## include <fcntl.h>
## include <pthread.h>
## include <linux/mman.h>

/* Đọc nửa dưới của Pentium Time Stamp Counter 
   bằng lệnh rdtsc */
## define rdtscl(val) __asm__ __volatile__ ("rdtsc" : "=A" (val))

main()
{
    unsigned long ts0, ts1, now, worst; /* Lưu các tick của TSC */
    struct sched_param sched_p;        /* Thông tin độ ưu tiên lập lịch */
    int fd, i = 0;
    unsigned long data;

    /* Thay đổi chính sách lập lịch sang SCHED_FIFO */
    sched_getparam(getpid(), &sched_p);
    sched_p.sched_priority = 50; /* Độ ưu tiên RT */
    sched_setscheduler(getpid(), SCHED_FIFO, &sched_p);

    /* Tránh phân trang và tính bất định liên quan */
    mlockall(MCL_CURRENT);

    /* Mở thiết bị RTC */
    fd = open("/dev/rtc", O_RDONLY);

    /* Thiết lập tần số ngắt định kỳ là 8192Hz
       Tương ứng với chu kỳ ngắt khoảng
