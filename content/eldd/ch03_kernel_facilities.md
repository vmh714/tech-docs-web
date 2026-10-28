# Chương 3: Các tiện ích của Kernel (Kernel Facilities)

## **Trong Chương này** Kernel Threads (Tiến trình nhân) 56 Helper Interfaces (Giao diện hỗ trợ) 65 Looking at the Sources (Khảo sát mã nguồn) 85

Trong chương này, chúng ta sẽ xem xét một số cơ chế của nhân (kernel facilities) là các thành phần hữu ích trong bộ công cụ của nhà phát triển trình điều khiển (driver developer). Chúng ta bắt đầu chương này bằng việc tìm hiểu một cơ chế của nhân tương tự như tiến trình người dùng (user process); kernel thread là các trừu tượng hóa lập trình hướng tới xử lý đồng thời (concurrent processing).

Nhân cung cấp một số giao diện hỗ trợ giúp đơn giản hóa mã nguồn của bạn, loại bỏ sự dư thừa, tăng tính dễ đọc của mã nguồn và hỗ trợ việc bảo trì lâu dài. Chúng ta sẽ xem xét danh sách liên kết (linked list), danh sách băm (hash list), hàng đợi công việc (work queue), chuỗi thông báo (notifier chain), hàm hoàn thành (completion function) và các công cụ hỗ trợ xử lý lỗi. Các tiện ích hỗ trợ này không có lỗi và đã được tối ưu hóa, do đó trình điều khiển của bạn cũng sẽ thừa hưởng những lợi ích đó một cách hoàn toàn miễn phí.

## Kernel Threads

*Kernel thread* là một cách để triển khai các tác vụ nền (background task) bên trong nhân (kernel space). Tác vụ này có thể bận rộn xử lý các sự kiện bất đồng bộ (asynchronous event) hoặc ngủ-chờ (sleep-waiting) một sự kiện xảy ra. Kernel thread tương tự như các tiến trình người dùng (user process), ngoại trừ việc chúng tồn tại trong không gian nhân (kernel space) và có quyền truy cập vào các hàm cũng như cấu trúc dữ liệu của nhân. Giống như tiến trình người dùng, kernel thread có ảo giác độc quyền bộ vi xử lý nhờ vào lập lịch cướp quyền (preemptive scheduling). Nhiều trình điều khiển thiết bị (device driver) tận dụng các dịch vụ của kernel thread để thực hiện các tác vụ hỗ trợ hoặc phụ trợ. Ví dụ, kernel thread *khubd*, là một phần của nhân trình điều khiển USB Linux (được đề cập trong Chương 11, "Universal Serial Bus"), có nhiệm vụ giám sát các bộ tập trung USB (USB hub) và cấu hình các thiết bị USB khi chúng được cắm nóng (hot-plug) vào hệ thống.

## Tạo một Kernel Thread

Hãy tìm hiểu về kernel thread thông qua một ví dụ cụ thể. Trong quá trình phát triển luồng ví dụ này, bạn cũng sẽ tìm hiểu về các khái niệm của nhân như trạng thái tiến trình (process state), hàng đợi chờ (wait queue) và bộ hỗ trợ chế độ người dùng (user mode helper). Khi bạn đã quen thuộc với kernel thread, bạn có thể sử dụng chúng như một công cụ thử nghiệm để thực hiện các thí nghiệm khác nhau bên trong nhân.

Giả sử bạn muốn nhân gọi bất đồng bộ một chương trình chế độ người dùng để gửi email hoặc cảnh báo qua máy nhắn tin cho bạn, bất cứ khi nào nó cảm nhận thấy tình trạng của một số cấu trúc dữ liệu quan trọng trong nhân đang suy giảm. (Ví dụ: dung lượng trống trong bộ đệm nhận mạng đã giảm xuống dưới ngưỡng thấp).

Đây là một ứng cử viên phù hợp để triển khai dưới dạng kernel thread vì những lý do sau:

- Đây là một tác vụ nền (background task) vì nó phải chờ các sự kiện bất đồng bộ.
- Nó cần quyền truy cập vào các cấu trúc dữ liệu của nhân vì việc phát hiện sự kiện thực tế được thực hiện bởi các phần khác của nhân.
- Nó phải gọi một chương trình hỗ trợ chế độ người dùng (user mode helper), đây là một thao tác tốn nhiều thời gian.

#### Các Kernel Thread tích hợp sẵn

Để xem các kernel thread (còn được gọi là *kernel process*) đang chạy trên hệ thống của bạn, hãy chạy lệnh ps. Tên của các kernel thread được đặt trong dấu ngoặc vuông:

| bash> ps -ef |      |  |                        |                        |
|--------------|------|--|------------------------|------------------------|
| UID          |      |  | PID PPID C STIME TTY   | TIME CMD               |
| root         | 1    |  | 0 0 22:36 ?            | 00:00:00 init [3]      |
| root         | 2    |  | 0 0 22:36 ?            | 00:00:00 [kthreadd]    |
| root         | 3    |  | 2 0 22:36 ?            | 00:00:00 [ksoftirqd/0] |
| root         | 4    |  | 2 0 22:36 ?            | 00:00:00 [events/0]    |
| root         | 38   |  | 2 0 22:36 ?            | 00:00:00 [pdflush]     |
| root         | 39   |  | 2 0 22:36 ?            | 00:00:00 [pdflush]     |
| root         | 29   |  | 2 0 22:36 ?            | 00:00:00 [khubd]       |
| root         | 695  |  | 2 0 22:36 ?            | 00:00:00 [kjournald]   |
|              |      |  |                        |                        |
| root         | 3914 |  | 2 0 22:37 ?            | 00:00:00 [nfsd]        |
| root         | 3915 |  | 2 0 22:37 ?            | 00:00:00 [nfsd]        |
|              |      |  |                        |                        |
| root         |      |  | 4015 3364 0 22:55 tty3 | 00:00:00 -bash         |
| root         |      |  | 4066 4015 0 22:59 tty3 | 00:00:00 ps -ef        |

Kernel thread *[ksoftirqd/0]* là một công cụ hỗ trợ triển khai *softirq* (ngắt mềm). Softirq được kích hoạt bởi các trình xử lý ngắt (interrupt handler) để yêu cầu xử lý "nửa dưới" (bottom half) đối với các phần của trình xử lý mà quá trình thực thi của chúng có thể bị hoãn lại. Chúng ta sẽ xem xét chi tiết về nửa dưới và softirq trong Chương 4, "Đặt nền móng" (Laying the Groundwork), nhưng ý tưởng cơ bản ở đây là giữ cho mã nguồn có mặt bên trong trình xử lý ngắt càng ít càng tốt. Việc có các trình xử lý ngắt nhỏ giúp giảm thời gian ngắt bị vô hiệu hóa (interrupt-off times) trong hệ thống, từ đó mang lại độ trễ thấp hơn. Công việc của *Ksoftirqd* là đảm bảo rằng tải trọng cao của softirq không làm thiếu đói (starve) các softirq cũng như không làm quá tải hệ thống. Trên các máy *Symmetric Multi Processing* (SMP - Đa xử lý đối xứng), nơi nhiều thể hiện luồng (thread instance) có thể chạy trên các bộ xử lý khác nhau song song, một thể hiện của ksoftirqd được tạo cho mỗi CPU để cải thiện thông lượng (*ksoftirqd/n*, với *n* là số hiệu CPU).

Các tiến trình *events/n* (với *n* là số hiệu CPU) giúp triển khai các *hàng đợi công việc* (work queues), đây là một phương pháp khác để hoãn công việc (deferring work) trong kernel. Các phần của kernel muốn thực thi công việc bị hoãn có thể tự tạo hàng đợi công việc của riêng mình hoặc sử dụng tiến trình công nhân (worker thread) mặc định *events/n*. Hàng đợi công việc cũng được phân tích chi tiết trong Chương 4.

Nhiệm vụ của tiến trình kernel *pdflush* là ghi các trang bẩn (dirty pages) từ bộ nhớ đệm trang (page cache) xuống đĩa. Page cache đệm các thao tác truy cập đĩa. Để cải thiện hiệu năng, các thao tác ghi thực tế lên đĩa sẽ bị trì hoãn cho đến khi tiến trình nền (daemon) pdflush ghi dữ liệu bị bẩn ra đĩa. Quá trình này được thực hiện nếu bộ nhớ trống khả dụng giảm xuống dưới ngưỡng cho phép, hoặc nếu trang giữ trạng thái bẩn trong một khoảng thời gian đủ lâu. Trong các kernel phiên bản 2.4, hai tác vụ này được thực hiện lần lượt bởi các tiến trình kernel riêng biệt là *bdflush* và *kupdated*. Bạn có thể nhận thấy có hai thể hiện (instances) của pdflush trong kết quả đầu ra của lệnh `ps`. Một thể hiện mới sẽ được tạo nếu kernel nhận thấy các thể hiện hiện tại đang quá bận rộn để phục vụ các hàng đợi đĩa. Điều này giúp cải thiện thông lượng (throughput), đặc biệt là khi hệ thống của bạn có nhiều ổ đĩa và nhiều trong số đó đang hoạt động bận rộn.

Như bạn đã thấy ở chương trước, kjournald là tiến trình ghi nhật ký (journaling) chung của kernel, được sử dụng bởi các hệ thống tập tin (filesystems) như EXT3.

Máy chủ *Network File System* (NFS) của Linux được triển khai bằng cách sử dụng một tập hợp các tiến trình kernel có tên là *nfsd*.

Tiến trình kernel mẫu của chúng ta nhường bộ xử lý (relinquish the processor) cho đến khi nó được đánh thức bởi các phần của kernel chịu trách nhiệm giám sát các cấu trúc dữ liệu quan tâm. Khi thức dậy, nó gọi một chương trình trợ giúp chế độ người dùng (user mode helper program) và truyền các mã định danh thích hợp trong môi trường của nó.

Để tạo một tiến trình kernel, hãy sử dụng `kernel_thread()`:

```c
ret = kernel_thread(mykthread, NULL,
 CLONE_FS | CLONE_FILES | CLONE_SIGHAND | SIGCHLD);
```

Các cờ (flags) chỉ định các tài nguyên sẽ được chia sẻ giữa tiến trình cha và tiến trình con. `CLONE_FILES` chỉ định rằng các tập tin đang mở sẽ được chia sẻ, và `CLONE_SIGHAND` yêu cầu chia sẻ các trình xử lý tín hiệu (signal handlers).

Liệt kê 3.1 cho thấy phần triển khai mẫu. Do các tiến trình kernel thường đóng vai trò là trình trợ giúp cho các trình điều khiển thiết bị (device drivers), chúng được tạo ra khi trình điều khiển được khởi tạo. Tuy nhiên, trong trường hợp này, tiến trình mẫu có thể được tạo từ bất kỳ vị trí thích hợp nào, chẳng hạn như *init/main.c*.

Tiến trình bắt đầu bằng cách gọi `daemonize()`, hàm này thực hiện dọn dẹp ban đầu (initial housekeeping) và chuyển tiến trình cha của tiến trình đang gọi thành một tiến trình kernel có tên là *kthreadd*. Mỗi tiến trình Linux chỉ có một tiến trình cha duy nhất. Nếu một tiến trình cha chết mà không chờ tiến trình con của nó thoát, tiến trình con sẽ trở thành một tiến trình *zombie* và lãng phí tài nguyên. Việc đổi tiến trình cha của tiến trình con thành `kthreadd` sẽ tránh được điều này và đảm bảo dọn dẹp tài nguyên đúng cách khi tiến trình thoát.[1]

[1] Trong các kernel phiên bản 2.6.21 trở về trước, `daemonize()` đổi tiến trình cha của tiến trình đang gọi thành tác vụ init bằng cách gọi `reparent_to_init()`.

Vì `daemonize()` chặn tất cả các tín hiệu theo mặc định, hãy sử dụng `allow_signal()` để cho phép phân phối (delivery) nếu tiến trình của bạn muốn xử lý một tín hiệu cụ thể. Không có trình xử lý tín hiệu nào bên trong kernel, vì vậy hãy sử dụng `signal_pending()` để kiểm tra các tín hiệu và thực hiện hành động thích hợp. Để phục vụ mục đích gỡ lỗi (debugging), mã nguồn trong Liệt kê 3.1 yêu cầu phân phối tín hiệu `SIGKILL` và kết thúc nếu tín hiệu đó được nhận.

`kernel_thread()` đã lỗi thời (deprecated) và được thay thế bằng API *kthread* cấp cao hơn, được xây dựng dựa trên API cũ này. Chúng ta sẽ tìm hiểu về kthreads sau.

**Liệt kê 3.1. Triển khai một Tiến trình Kernel**

```c
static DECLARE_WAIT_QUEUE_HEAD(myevent_waitqueue);
rwlock_t myevent_lock;
extern unsigned int myevent_id; /* Chứa định danh của
 cấu trúc dữ liệu gặp vấn đề.
 Sẽ được gán giá trị sau */
static int mykthread(void *unused)
{
 unsigned int event_id = 0;
 DECLARE_WAITQUEUE(wait, current);
 /* Trở thành một tiến trình kernel không gắn liền với tài nguyên người dùng */
 daemonize("mykthread");
 /* Yêu cầu phân phối SIGKILL */
 allow_signal(SIGKILL);
 /* Tiến trình ngủ trên hàng đợi chờ này cho đến khi
 được đánh thức bởi các phần của kernel chịu trách nhiệm theo dõi
 trạng thái của các cấu trúc dữ liệu quan tâm */
 add_wait_queue(&myevent_waitqueue, &wait);
 for (;;) {
 /* Nhường bộ xử lý cho đến khi sự kiện xảy ra */
 set_current_state(TASK_INTERRUPTIBLE);
 schedule(); /* Cho phép các phần khác của kernel chạy */
 /* Kết thúc nếu nhận được SIGKILL */
 if (signal_pending(current)) break;
 /* Điều khiển đến đây khi tiến trình được đánh thức */
 read_lock(&myevent_lock); /* Bắt đầu vùng găng (critical section) */
 if (myevent_id) { /* Phòng ngừa việc thức dậy giả (spurious wakeups) */
 event_id = myevent_id;
 read_unlock(&myevent_lock); /* Kết thúc vùng găng */
 /* Gọi trình trợ giúp chế độ người dùng đã đăng ký và
 truyền mã định danh trong môi trường của nó */
 run_umode_handler(event_id); /* Được mở rộng sau */
 } else {
 read_unlock(&myevent_lock);
 }
 }
 set_current_state(TASK_RUNNING);
 remove_wait_queue(&myevent_waitqueue, &wait);
 return 0;
}
```

Nếu bạn biên dịch và chạy đoạn mã này như một phần của kernel, bạn có thể nhìn thấy tiến trình vừa được tạo, *mykthread*, trong kết quả đầu ra của lệnh `ps`:

```
bash> ps -ef
 UID PID PPID C STIME TTY TIME CMD
 root 1 0 0 21:56 ? 00:00:00 init [3]
 root 2 1 0 22:36 ? 00:00:00 [ksoftirqd/0]
 ...
 root 111 1 0 21:56 ? 00:00:00 [mykthread]
 ...
```

Trước khi đi sâu hơn vào việc cài đặt tiến trình nhẹ/luồng (thread), hãy viết một đoạn mã nguồn (code snippet) giám sát trạng thái sức khỏe của một cấu trúc dữ liệu quan trọng và đánh thức `mykthread` nếu phát hiện ra vấn đề:

```
/* Được thực thi bởi các phần của kernel sở hữu cấu trúc dữ liệu
 mà bạn muốn giám sát trạng thái */
/* ... */
if (my_key_datastructure looks troubled) {
 write_lock(&myevent_lock); /* Tuần tự hóa (Serialize) */
 /* Điền định danh của cấu trúc dữ liệu */
 myevent_id = datastructure_id;
 write_unlock(&myevent_lock);
 /* Đánh thức mykthread */
 wake_up_interruptible(&myevent_waitqueue);
}
/* ... */
```

Đoạn mã trong Danh mục (Listing) 3.1 thực thi trong ngữ cảnh tiến trình (process context), trong khi đoạn mã bên trên chạy từ ngữ cảnh tiến trình hoặc ngữ cảnh ngắt (interrupt context). Ngữ cảnh tiến trình và ngữ cảnh ngắt giao tiếp với nhau thông qua các cấu trúc dữ liệu của kernel (kernel data structures). Ví dụ của chúng ta sử dụng `myevent_id` và `myevent_waitqueue` cho quá trình giao tiếp này. `myevent_id` chứa định danh của cấu trúc dữ liệu đang gặp sự cố. Việc truy cập vào `myevent_id` được tuần tự hóa (serialize) bằng các khóa (locks).

Lưu ý rằng các luồng kernel (kernel threads) chỉ có thể bị cướp quyền (preemptible) nếu tùy chọn `CONFIG_PREEMPT` được bật trong thời gian biên dịch (compile time). Nếu `CONFIG_PREEMPT` bị tắt, hoặc nếu bạn vẫn đang chạy kernel phiên bản 2.4 mà không có bản vá cướp quyền (preemption patch), luồng của bạn sẽ làm đóng băng hệ thống (freeze the system) nếu nó không chuyển sang trạng thái ngủ (sleep). Nếu bạn chú thích (comment out) hàm `schedule()` trong Danh mục 3.1 và vô hiệu hóa `CONFIG_PREEMPT` trong cấu hình kernel của mình, hệ thống của bạn sẽ bị treo (lock up).

Bạn sẽ học cách thu được các phản hồi thời gian thực mềm (soft real-time responses) từ các luồng kernel khi chúng ta thảo luận về các chính sách lập lịch (scheduling policies) trong Chương 19, "Trình điều khiển trong Không gian Người dùng" (Drivers in User Space).

**Trạng thái Tiến trình và Hàng đợi Chờ (Process States and Wait Queues)**

Dưới đây là đoạn mã từ Danh mục 3.1 đưa `mykthread` vào trạng thái ngủ trong lúc chờ các sự kiện:

```
add_wait_queue(&myevent_waitqueue, &wait);
for (;;) {
 /* ... */
 set_current_state(TASK_INTERRUPTIBLE);
 schedule(); /* Nhường bộ vi xử lý (Relinquish the processor) */
 /* Điểm A (Point A) */
 /* ... */
}
set_current_state(TASK_RUNNING);
remove_wait_queue(&myevent_waitqueue, &wait);
```

Hoạt động của đoạn mã trên dựa trên hai khái niệm: *hàng đợi chờ* (wait queues) và *trạng thái tiến trình* (process states).

Hàng đợi chờ lưu trữ các luồng cần chờ một sự kiện hoặc một tài nguyên hệ thống (system resource). Các luồng trong hàng đợi chờ sẽ chuyển sang trạng thái ngủ cho đến khi chúng được đánh thức bởi một luồng khác hoặc một trình xử lý ngắt (interrupt handler) chịu trách nhiệm phát hiện sự kiện đó. Việc đưa vào và lấy ra khỏi hàng đợi được thực hiện lần lượt bằng `add_wait_queue()` và `remove_wait_queue()`, còn việc đánh thức các tác vụ trong hàng đợi được thực hiện thông qua `wake_up_interruptible()`.

Một luồng kernel (hoặc một tiến trình thông thường) có thể ở bất kỳ trạng thái tiến trình nào sau đây: *running*, *interruptible*, *uninterruptible*, *zombie*, *stopped*, *traced*, hoặc *dead*. Các trạng thái này được định nghĩa trong *include*/*linux*/*sched*.*h*:

- Một tiến trình ở trạng thái **running** (`TASK_RUNNING`) nằm trong hàng đợi chạy của bộ lập lịch (scheduler run queue) và là một ứng viên để nhận thời gian CPU do bộ lập lịch phân bổ.
- Một tác vụ ở trạng thái **interruptible** (`TASK_INTERRUPTIBLE`) đang chờ một sự kiện xảy ra và không nằm trong hàng đợi chạy của bộ lập lịch. Khi tác vụ được đánh thức, hoặc nếu một tín hiệu (signal) được gửi đến nó, nó sẽ tái gia nhập hàng đợi chạy.
- Trạng thái **uninterruptible** (`TASK_UNINTERRUPTIBLE`) tương tự như trạng thái **interruptible** ngoại trừ việc việc nhận được một tín hiệu sẽ không đưa tác vụ quay trở lại hàng đợi chạy.
- Một tác vụ ở trạng thái **stopped** (`TASK_STOPPED`) đã dừng thực thi do nhận được các tín hiệu nhất định.
- Nếu một ứng dụng như `strace` đang sử dụng hỗ trợ `ptrace` trong kernel để chặn (intercept) một tác vụ, nó sẽ ở trạng thái **traced** (`TASK_TRACED`).
- Một tác vụ ở trạng thái **zombie** (`EXIT_ZOMBIE`) đã chấm dứt hoạt động, nhưng tiến trình cha của nó không chờ tác vụ hoàn thành. Một tác vụ đang thoát sẽ ở trạng thái `EXIT_ZOMBIE` hoặc trạng thái chết `EXIT_DEAD`.

Bạn có thể sử dụng `set_current_state()` để thiết lập trạng thái chạy cho luồng kernel của mình.

Bây giờ chúng ta hãy quay lại đoạn mã nguồn trước đó. `mykthread` ngủ trên một hàng đợi chờ (`myevent_waitqueue`) và thay đổi trạng thái của nó thành `TASK_INTERRUPTIBLE`, báo hiệu mong muốn rút khỏi hàng đợi chạy của bộ lập lịch. Lời gọi hàm `schedule()` yêu cầu bộ lập lịch chọn và chạy một tác vụ mới từ hàng đợi chạy của nó. Khi mã chịu trách nhiệm giám sát sức khỏe đánh thức `mykthread` bằng cách sử dụng `wake_up_interruptible(&myevent_waitqueue)`, luồng được đưa trở lại hàng đợi chạy của bộ lập lịch. Trạng thái tiến trình cũng đồng thời được chuyển thành `TASK_RUNNING`, do đó không xảy ra tình trạng tranh chấp dữ liệu (race condition) ngay cả khi việc đánh thức diễn ra giữa thời điểm trạng thái tác vụ được đặt thành `TASK_INTERRUPTIBLE` và thời điểm `schedule()` được gọi. Luồng cũng quay trở lại hàng đợi chạy nếu một tín hiệu `SIGKILL` được gửi đến nó. Khi bộ lập lịch sau đó chọn `mykthread` từ hàng đợi chạy, quá trình thực thi sẽ tiếp tục từ Điểm A (Point A).

#### Trợ lý Chế độ Người dùng (User Mode Helpers)

Mykthread gọi hàm `run_umode_handler()` trong Liệt kê 3.1 để thông báo cho không gian người dùng (User Space) về các sự kiện được phát hiện:

#### Code View: /\* Called from Listing 3.1 \*/ static void run\_umode\_handler(int event\_id) { int i = 0; char \*argv[2], \*envp[4], \*buffer = NULL;

```
 int value;
 argv[i++] = myevent_handler; /* Defined in
 kernel/sysctl.c */
 /* Fill in the id corresponding to the data structure
 in trouble */
 if (!(buffer = kmalloc(32, GFP_KERNEL))) return;
 sprintf(buffer, "TROUBLED_DS=%d", event_id);
 /* If no user mode handlers are found, return */
 if (!argv[0]) return; argv[i] = 0;
 /* Prepare the environment for /path/to/helper */
 i = 0;
 envp[i++] = "HOME=/";
 envp[i++] = "PATH=/sbin:/usr/sbin:/bin:/usr/bin";
 envp[i++] = buffer; envp[i] = 0;
 /* Execute the user mode program, /path/to/helper */
 value = call_usermodehelper(argv[0], argv, envp, 0);
 /* Check return values */
 kfree(buffer);
}
```

Kernel hỗ trợ một cơ chế cho phép yêu cầu các chương trình chạy ở chế độ người dùng (User Mode) hỗ trợ thực hiện một số chức năng nhất định. `run_umode_handler()` sử dụng tính năng này bằng cách gọi `call_usermodehelper()`.

Bạn phải đăng ký chương trình ở chế độ người dùng được gọi bởi `run_umode_handler()` thông qua một nút trong thư mục */proc/sys/*. Để làm như vậy, hãy đảm bảo rằng `CONFIG_SYSCTL` (các tệp nằm trong thư mục */proc/sys/* được gọi chung là giao diện *sysctl*) được bật trong cấu hình kernel của bạn và thêm một mục vào mảng `kern_table` trong *kernel/sysctl.c*:

```
{
 .ctl_name = KERN_MYEVENT_HANDLER, /* Define in
 include/linux/sysctl.h */
 .procname = "myevent_handler",
 .data = &myevent_handler,
 .maxlen = 256,
 .mode = 0644,
 .proc_handler = &proc_dostring,
 .strategy = &sysctl_string,
},
```

Thao tác này tạo ra nút */proc/sys/kernel/myevent_handler* trong hệ thống tệp tiến trình (Process Filesystem). Để đăng ký chương trình hỗ trợ chế độ người dùng (User Mode Helper) của bạn, hãy thực hiện lệnh sau:

**bash> echo /path/to/helper > /proc/sys/kernel/myevent\_handler**

Điều này dẫn đến việc */path/to/helper* được thực thi khi mykthread gọi `run_umode_handler()`.

Mykthread truyền định danh của cấu trúc dữ liệu kernel đang gặp sự cố tới chương trình hỗ trợ chế độ người dùng thông qua biến môi trường `TROUBLED_DS`. Chương trình hỗ trợ này có thể là một tập lệnh đơn giản như sau, dùng để gửi cho bạn một email cảnh báo chứa thông tin thu thập được từ môi trường của nó:

#### bash> cat /path/to/helper

## !/bin/bash

echo Kernel datastructure \$TROUBLED\_DS is in trouble | mail -s Alert root

`call_usermodehelper()` phải được thực thi từ ngữ cảnh tiến trình (Process Context) và chạy với đặc quyền root. Nó được triển khai bằng cách sử dụng một hàng đợi công việc (Work Queue), mà chúng ta sẽ thảo luận ngay sau đây.

## **Trong chương này** Kernel Threads 56 Helper Interfaces 65 Looking at the Sources 85

Trong chương này, chúng ta hãy xem xét một số tiện ích của kernel, là những thành phần hữu ích trong hộp công cụ của nhà phát triển trình điều khiển (Driver Developer). Chúng ta bắt đầu chương này bằng cách xem xét một tiện ích kernel tương tự như các tiến trình người dùng; luồng kernel (Kernel Thread) là cácừu tượng hóa lập trình hướng tới xử lý đồng thời (Concurrent Processing).

Kernel cung cấp một số giao diện hỗ trợ (Helper Interface) giúp đơn giản hóa mã nguồn của bạn, loại bỏ sự dư thừa, tăng tính dễ đọc của mã nguồn và hỗ trợ bảo trì lâu dài. Chúng ta sẽ xem xét danh sách liên kết (Linked List), danh sách băm (Hash List), hàng đợi công việc (Work Queue), chuỗi thông báo (Notifier Chain), hàm hoàn thành (Completion Function) và các công cụ hỗ trợ xử lý lỗi. Các tiện ích hỗ trợ này không có lỗi (Bug-free) và đã được tối ưu hóa, vì vậy trình điều khiển của bạn cũng được thừa hưởng những lợi ích đó một cách hoàn toàn miễn phí.

## Kernel Threads (Luồng nhân)

Một *kernel thread* (luồng nhân) là một cách để triển khai các tác vụ nền (background task) bên trong kernel. Tác vụ này có thể bận rộn xử lý các sự kiện bất đồng bộ (asynchronous event) hoặc ngủ-chờ (sleep-waiting) một sự kiện xảy ra. Kernel thread tương tự như các tiến trình người dùng (user process), ngoại trừ việc chúng nằm trong không gian nhân (kernel space) và có quyền truy cập vào các hàm cũng như cấu trúc dữ liệu của kernel. Giống như user process, kernel thread có ảo giác độc quyền bộ vi xử lý nhờ vào lập lịch cướp quyền (preemptive scheduling). Nhiều trình điều khiển thiết bị (device driver) tận dụng các dịch vụ của kernel thread để thực hiện các tác vụ hỗ trợ hoặc trợ giúp. Ví dụ, kernel thread *khubd*, là một phần của nhân driver USB Linux (được đề cập trong Chương 11, "Universal Serial Bus"), giám sát các USB hub và cấu hình các thiết bị USB khi chúng được cắm nóng (hot-plugged) vào hệ thống.

## Creating a Kernel Thread (Tạo một Kernel Thread)

Hãy tìm hiểu về kernel thread thông qua một ví dụ. Trong quá trình phát triển luồng ví dụ này, bạn cũng sẽ tìm hiểu về các khái niệm của kernel như trạng thái tiến trình (process state), hàng đợi chờ (wait queue), và trình trợ giúp chế độ người dùng (user mode helper). Khi bạn đã quen thuộc với kernel thread, bạn có thể sử dụng chúng làm công cụ kiểm thử để thực hiện các thí nghiệm khác nhau bên trong kernel.

Giả định rằng bạn muốn kernel gọi bất đồng bộ một chương trình chế độ người dùng (user mode program) để gửi cho bạn một email hoặc cảnh báo qua máy nhắn tin, bất cứ khi nào nó phát hiện thấy tình trạng của một số cấu trúc dữ liệu chính trong kernel đang xuống cấp. (Ví dụ, dung lượng trống trong bộ đệm nhận mạng đã giảm xuống dưới ngưỡng thấp).

Đây là một ứng cử viên sáng giá để được triển khai như một kernel thread vì các lý do sau:

- Đó là một tác vụ nền vì nó phải chờ các sự kiện bất đồng bộ.
- Nó cần quyền truy cập vào các cấu trúc dữ liệu của kernel vì việc phát hiện sự kiện thực tế được thực hiện bởi các phần khác của kernel.
- Nó phải gọi một chương trình trợ giúp chế độ người dùng (user mode helper program), vốn là một thao tác tiêu tốn nhiều thời gian.

#### Built-In Kernel Threads (Các Kernel Thread tích hợp sẵn)

Để xem các kernel thread (còn được gọi là *kernel process* - tiến trình nhân) đang chạy trên hệ thống của bạn, hãy chạy lệnh `ps`. Tên của kernel thread được đặt trong ngoặc vuông:

| bash> ps -ef |      |  |                        |                        |
|--------------|------|--|------------------------|------------------------|
| UID          |      |  | PID PPID C STIME TTY   | TIME CMD               |
| root         | 1    |  | 0 0 22:36 ?            | 00:00:00 init [3]      |
| root         | 2    |  | 0 0 22:36 ?            | 00:00:00 [kthreadd]    |
| root         | 3    |  | 2 0 22:36 ?            | 00:00:00 [ksoftirqd/0] |
| root         | 4    |  | 2 0 22:36 ?            | 00:00:00 [events/0]    |
| root         | 38   |  | 2 0 22:36 ?            | 00:00:00 [pdflush]     |
| root         | 39   |  | 2 0 22:36 ?            | 00:00:00 [pdflush]     |
| root         | 29   |  | 2 0 22:36 ?            | 00:00:00 [khubd]       |
| root         | 695  |  | 2 0 22:36 ?            | 00:00:00 [kjournald]   |
|              |      |  |                        |                        |
| root         | 3914 |  | 2 0 22:37 ?            | 00:00:00 [nfsd]        |
| root         | 3915 |  | 2 0 22:37 ?            | 00:00:00 [nfsd]        |
|              |      |  |                        |                        |
| root         |      |  | 4015 3364 0 22:55 tty3 | 00:00:00 -bash         |
| root         |      |  | 4066 4015 0 22:59 tty3 | 00:00:00 ps -ef        |

Kernel thread *[ksoftirqd/0]* là một trợ giúp để triển khai *softirq* (ngắt mềm). Softirq được kích hoạt bởi các trình xử lý ngắt (interrupt handler) để yêu cầu xử lý "nửa dưới" (bottom half) của các phần trong trình xử lý ngắt mà việc thực thi của chúng có thể bị trì hoãn. Chúng ta sẽ xem xét chi tiết về bottom half và softirq trong Chương 4, "Laying the Groundwork", nhưng ý tưởng cơ bản ở đây là cho phép càng ít mã nguồn càng tốt xuất hiện bên trong trình xử lý ngắt. Việc có các trình xử lý ngắt nhỏ giúp giảm thời gian ngắt bị tắt (interrupt-off times) trong hệ thống, dẫn đến độ trễ thấp hơn. Công việc của *Ksoftirqd* là đảm bảo rằng tải trọng cao của softirq không làm thiếu đói (starve) các softirq cũng như không làm quá tải hệ thống. Trên các máy *Symmetric Multi Processing* (SMP - Đa xử lý đối xứng), nơi nhiều thể hiện luồng (thread instance) có thể chạy trên các bộ xử lý khác nhau song song, một thể hiện của ksoftirqd được tạo cho mỗi CPU để cải thiện thông lượng (*ksoftirqd/n*, với *n* là số hiệu CPU).

Các luồng *events/n* (với *n* là số hiệu CPU) giúp triển khai *work queue* (hàng đợi công việc), đây là một cách khác để trì hoãn công việc trong kernel. Các phần của kernel mong muốn thực thi công việc bị trì hoãn có thể tự tạo work queue của riêng mình hoặc tận dụng luồng công việc mặc định *events/n* worker thread. Work queue cũng được mổ xẻ chi tiết trong Chương 4.

Tác vụ của kernel thread *pdflush* là xả (flush) các trang bẩn (dirty page) khỏi page cache (bộ đệm trang). Page cache đệm các truy cập vào đĩa. Để cải thiện hiệu năng, các thao tác ghi thực tế xuống đĩa bị trì hoãn cho đến khi tiến trình nền (daemon) pdflush ghi dữ liệu bị bẩn ra đĩa. Điều này được thực hiện nếu bộ nhớ trống khả dụng giảm xuống dưới ngưỡng, hoặc nếu trang vẫn ở trạng thái bẩn trong một khoảng thời gian đủ dài. Trong các kernel 2.4, hai tác vụ này lần lượt được thực hiện bởi các kernel thread riêng biệt là *bdflush* và

*kupdated.* Bạn có thể nhận thấy có hai tiến trình `pdflush` trong kết quả đầu ra của lệnh `ps`. Một tiến trình mới sẽ được tạo ra nếu kernel nhận thấy các tiến trình hiện tại đang quá bận rộn trong việc xử lý các hàng đợi đĩa (disk queues). Điều này giúp cải thiện thông lượng (throughput), đặc biệt là khi hệ thống của bạn có nhiều ổ đĩa và nhiều trong số chúng đang bận.

Như bạn đã thấy ở chương trước, `kjournald` là luồng nhật ký (journaling thread) chung của kernel, được sử dụng bởi các hệ thống tập tin (file systems) chẳng hạn như EXT3.

Máy chủ *Network File System* (NFS) trên Linux được triển khai bằng cách sử dụng một tập hợp các kernel thread có tên là *nfsd*.

Kernel thread mẫu của chúng tôi nhường bộ xử lý (relinquishes the processor) cho đến khi nó được đánh thức bởi các phần của kernel chịu trách nhiệm giám sát các cấu trúc dữ liệu quan tâm. Khi thức dậy, nó gọi một chương trình trợ giúp chế độ người dùng (user mode helper program) và truyền các mã định danh (identity codes) phù hợp vào môi trường của chương trình đó.

Để tạo một kernel thread, hãy sử dụng `kernel_thread()`:

```
ret = kernel_thread(mykthread, NULL,
 CLONE_FS | CLONE_FILES | CLONE_SIGHAND | SIGCHLD);
```

Các cờ (flags) chỉ định các tài nguyên sẽ được chia sẻ giữa luồng cha và luồng con. `CLONE_FILES` chỉ định rằng các tập tin đang mở sẽ được chia sẻ, và `CLONE_SIGHAND` yêu cầu chia sẻ các trình xử lý tín hiệu (signal handlers).

Liệt kê 3.1 hiển thị ví dụ về việc triển khai. Do các kernel thread thường đóng vai trò là các trình trợ giúp cho trình điều khiển thiết bị (device drivers), chúng được tạo ra khi driver được khởi tạo. Tuy nhiên, trong trường hợp này, luồng mẫu có thể được tạo từ bất kỳ vị trí thích hợp nào, ví dụ như *init/main.c*.

Luồng bắt đầu bằng cách gọi `daemonize()`, hàm này thực hiện các công việc dọn dẹp ban đầu (initial housekeeping) và thay đổi tiến trình cha của luồng gọi thành một kernel thread có tên là *kthreadd*. Mỗi Linux thread có một tiến trình cha duy nhất. Nếu một tiến trình cha chết mà không đợi tiến trình con của nó thoát (exit), tiến trình con sẽ trở thành một tiến trình *zombie* và lãng phí tài nguyên. Việc gán lại tiến trình cha của luồng con thành `kthreadd` sẽ tránh được điều này và đảm bảo dọn dẹp đúng cách khi luồng thoát.[1]

[1] Trong các phiên bản kernel 2.6.21 trở về trước, `daemonize()` gán lại tiến trình cha của luồng gọi thành tác vụ init (init task) bằng cách gọi `reparent_to_init()`.

Vì `daemonize()` chặn tất cả các tín hiệu theo mặc định, hãy sử dụng `allow_signal()` để cho phép phân phối (delivery) nếu luồng của bạn muốn xử lý một tín hiệu cụ thể. Không có trình xử lý tín hiệu nào bên trong kernel, vì vậy hãy sử dụng `signal_pending()` để kiểm tra các tín hiệu và thực hiện hành động thích hợp. Vì mục đích gỡ lỗi (debugging), mã trong Liệt kê 3.1 yêu cầu phân phối tín hiệu `SIGKILL` và kết thúc nếu nó nhận được tín hiệu đó.

`kernel_thread()` đã lỗi thời (deprecated) và được thay thế bằng API *kthread* cấp cao hơn, được xây dựng dựa trên API cũ này. Chúng ta sẽ tìm hiểu về kthread sau.

**Liệt kê 3.1. Triển khai một Kernel Thread**

```
static DECLARE_WAIT_QUEUE_HEAD(myevent_waitqueue);
rwlock_t myevent_lock;
extern unsigned int myevent_id; /* Chứa định danh của cấu trúc dữ liệu
 đang gặp sự cố.
 Sẽ được điền sau */
static int mykthread(void *unused)
{
 unsigned int event_id = 0;
 DECLARE_WAITQUEUE(wait, current);
 /* Trở thành một kernel thread không có tài nguyên người dùng đi kèm */
 daemonize("mykthread");
 /* Yêu cầu phân phối SIGKILL */
 allow_signal(SIGKILL);
 /* Luồng ngủ trên hàng đợi chờ này cho đến khi nó được
 đánh thức bởi các phần của kernel chịu trách nhiệm theo dõi
 trạng thái của các cấu trúc dữ liệu quan tâm */
 add_wait_queue(&myevent_waitqueue, &wait);
 for (;;) {
 /* Nhường bộ xử lý cho đến khi sự kiện xảy ra */
 set_current_state(TASK_INTERRUPTIBLE);
 schedule(); /* Cho phép các phần khác của kernel chạy */
 /* Chết nếu nhận được SIGKILL */
 if (signal_pending(current)) break;
 /* Quyền điều khiển đến đây khi luồng được đánh thức */
 read_lock(&myevent_lock); /* Bắt đầu vùng găng - Critical section */
 if (myevent_id) { /* Tránh các trường hợp thức dậy giả mạo - spurious wakeups */
 event_id = myevent_id;
 read_unlock(&myevent_lock); /* Kết thúc vùng găng */
 /* Gọi trình trợ giúp chế độ người dùng đã đăng ký và
 truyền mã định danh trong môi trường của nó */
 run_umode_handler(event_id); /* Sẽ được mở rộng sau */
 } else {
 read_unlock(&myevent_lock);
 }
 }
 set_current_state(TASK_RUNNING);
 remove_wait_queue(&myevent_waitqueue, &wait);
 return 0;
}
```

Nếu bạn biên dịch và chạy đoạn mã này như một phần của kernel, bạn có thể thấy luồng vừa được tạo, *mykthread*, trong kết quả đầu ra của `ps`:

```
bash> ps -ef
 UID PID PPID C STIME TTY TIME CMD
 root 1 0 0 21:56 ? 00:00:00 init [3]
 root 2 1 0 22:36 ? 00:00:00 [ksoftirqd/0]
 ...
 root 111 1 0 21:56 ? 00:00:00 [mykthread]
 ...
```

Trước khi đi sâu hơn vào việc triển khai luồng, hãy viết một đoạn mã nhỏ để giám sát tình trạng của một cấu trúc dữ liệu quan tâm và đánh thức `mykthread` nếu phát hiện thấy điều kiện sự cố:

```
/* Được thực thi bởi các phần của kernel sở hữu các
 cấu trúc dữ liệu mà bạn muốn giám sát tình trạng */
/* ... */
if (my_key_datastructure looks troubled) {
 write_lock(&myevent_lock); /* Tuần tự hóa - Serialize */
 /* Điền định danh của cấu trúc dữ liệu */
 myevent_id = datastructure_id;
 write_unlock(&myevent_lock);
 /* Đánh thức mykthread */
 wake_up_interruptible(&myevent_waitqueue);
}
/* ... */
```

Liệt kê 3.1 (Listing 3.1) thực thi trong ngữ cảnh tiến trình (process context), trong khi đoạn mã trước đó chạy từ ngữ cảnh tiến trình hoặc ngữ cảnh ngắt (interrupt context). Ngữ cảnh tiến trình và ngữ cảnh ngắt giao tiếp với nhau thông qua các cấu trúc dữ liệu của nhân (kernel data structures). Ví dụ của chúng ta sử dụng `myevent_id` và `myevent_waitqueue` cho quá trình giao tiếp này. `myevent_id` chứa định danh của cấu trúc dữ liệu đang gặp sự cố. Việc truy cập vào `myevent_id` được tuần tự hóa (serialized) bằng cách sử dụng các khóa (locks).

Lưu ý rằng các luồng nhân (kernel threads) chỉ có thể bị trưng dụng (preemptible) nếu `CONFIG_PREEMPT` được bật (turned on) tại thời điểm biên dịch. Nếu `CONFIG_PREEMPT` bị tắt, hoặc nếu bạn vẫn đang chạy nhân phiên bản 2.4 mà không có bản vá trưng dụng (preemption patch), luồng của bạn sẽ làm đóng băng hệ thống nếu nó không đi vào trạng thái ngủ (sleep). Nếu bạn chú thích (comment out) hàm `schedule()` trong Liệt kê 3.1 và vô hiệu hóa `CONFIG_PREEMPT` trong cấu hình nhân của mình, hệ thống của bạn sẽ bị treo (lock up).

Bạn sẽ học cách thu được phản hồi thời gian thực mềm (soft real-time responses) từ các luồng nhân khi chúng ta thảo luận về các chính sách lập lịch (scheduling policies) trong Chương 19, "Trình điều khiển trong Không gian Người dùng" (Drivers in User Space).

**Trạng thái Tiến trình và Hàng đợi Chờ (Process States and Wait Queues)**

Dưới đây là vùng mã nguồn từ Liệt kê 3.1 đưa `mykthread` vào trạng thái ngủ trong lúc chờ các sự kiện:

```
add_wait_queue(&myevent_waitqueue, &wait);
for (;;) {
 /* ... */
 set_current_state(TASK_INTERRUPTIBLE);
 schedule(); /* Từ bỏ bộ xử lý */
 /* Điểm A */
 /* ... */
}
set_current_state(TASK_RUNNING);
remove_wait_queue(&myevent_waitqueue, &wait);
```

Hoạt động của đoạn mã trước đó dựa trên hai khái niệm: *hàng đợi chờ* (*wait queues*) và *trạng thái tiến trình* (*process states*).

Hàng đợi chờ chứa các luồng cần chờ một sự kiện hoặc một tài nguyên hệ thống (system resource). Các luồng trong hàng đợi chờ sẽ đi vào trạng thái ngủ cho đến khi chúng được đánh thức bởi một luồng khác hoặc một trình xử lý ngắt (interrupt handler) chịu trách nhiệm phát hiện sự kiện đó. Việc đưa vào và lấy ra khỏi hàng đợi lần lượt được thực hiện bằng `add_wait_queue()` và `remove_wait_queue()`, và việc đánh thức các tác vụ đang nằm trong hàng đợi được thực hiện thông qua `wake_up_interruptible()`.

Một luồng nhân (hoặc một tiến trình thông thường) có thể ở bất kỳ trạng thái tiến trình nào sau đây: *đang chạy* (*running*), *có thể ngắt* (*interruptible*), *không thể ngắt* (*uninterruptible*), *thây ma* (*zombie*), *đã dừng* (*stopped*), *đang được dò vết* (*traced*), hoặc *đã chết* (*dead*). Các trạng thái này được định nghĩa trong *include*/*linux*/*sched*.*h*:

- Một tiến trình ở trạng thái **đang chạy** (`TASK_RUNNING`) nằm trong hàng đợi chạy của bộ lập lịch (scheduler run queue) và là một ứng viên để nhận thời gian CPU được phân bổ bởi bộ lập lịch.
- Một tác vụ ở trạng thái **có thể ngắt** (`TASK_INTERRUPTIBLE`) đang chờ một sự kiện xảy ra và không nằm trong hàng đợi chạy của bộ lập lịch. Khi tác vụ được đánh thức, hoặc nếu một tín hiệu (signal) được gửi đến nó, nó sẽ tái gia nhập hàng đợi chạy.
- Trạng thái **không thể ngắt** (`TASK_UNINTERRUPTIBLE`) tương tự như trạng thái **có thể ngắt**, ngoại trừ việc việc nhận được một tín hiệu sẽ không đưa tác vụ trở lại hàng đợi chạy.
- Một tác vụ **đã dừng** (`TASK_STOPPED`) đã dừng thực thi do nhận được một số tín hiệu nhất định.
- Nếu một ứng dụng như `strace` đang sử dụng hỗ trợ `ptrace` trong nhân để chặn (intercept) một tác vụ, nó sẽ ở trạng thái **đang được dò vết** (`TASK_TRACED`).
- Một tác vụ ở trạng thái **thây ma** (`EXIT_ZOMBIE`) đã chấm dứt (terminated), nhưng tiến trình cha của nó không đợi tác vụ hoàn thành. Một tác vụ đang thoát sẽ ở trạng thái `EXIT_ZOMBIE` hoặc trạng thái đã chết (`EXIT_DEAD`).

Bạn có thể sử dụng `set_current_state()` để thiết lập trạng thái chạy cho luồng nhân của mình.

Bây giờ chúng ta quay lại đoạn mã trước đó. `mykthread` ngủ trên một hàng đợi chờ (`myevent_waitqueue`) và thay đổi trạng thái của nó thành `TASK_INTERRUPTIBLE`, ra hiệu mong muốn rút lui khỏi hàng đợi chạy của bộ lập lịch. Lời gọi `schedule()` yêu cầu bộ lập lịch chọn và chạy một tác vụ mới từ hàng đợi chạy của nó. Khi mã chịu trách nhiệm giám sát tình trạng đánh thức `mykthread` bằng cách sử dụng `wake_up_interruptible(&myevent_waitqueue)`, luồng được đưa trở lại hàng đợi chạy của bộ lập lịch. Trạng thái tiến trình cũng đồng thời được thay đổi thành `TASK_RUNNING`, do đó không xảy ra tình trạng tranh chấp dữ liệu (race condition) ngay cả khi việc đánh thức xảy ra trong khoảng thời gian giữa lúc trạng thái tác vụ được đặt thành `TASK_INTERRUPTIBLE` và lúc `schedule()` được gọi. Luồng cũng quay trở lại hàng đợi chạy nếu một tín hiệu `SIGKILL` được gửi đến nó. Khi bộ lập lịch sau đó chọn `mykthread` từ hàng đợi chạy, quá trình thực thi tiếp tục từ Điểm A.

#### Trình hỗ trợ Chế độ Người dùng (User Mode Helpers)

`Mykthread` gọi `run_umode_handler()` trong Liệt kê 3.1 để thông báo cho không gian người dùng (user space) về các sự kiện được phát hiện:

#### Góc nhìn Mã nguồn: /* Được gọi từ Liệt kê 3.1 */ static void run_umode_handler(int event_id) { int i = 0; char *argv[2], *envp[4], *buffer = NULL;

```
 int value;
 argv[i++] = myevent_handler; /* Được định nghĩa trong
 kernel/sysctl.c */
 /* Điền định danh tương ứng với cấu trúc dữ liệu
 đang gặp sự cố */
 if (!(buffer = kmalloc(32, GFP_KERNEL))) return;
 sprintf(buffer, "TROUBLED_DS=%d", event_id);
 /* Nếu không tìm thấy trình hỗ trợ chế độ người dùng nào, hãy trả về */
 if (!argv[0]) return; argv[i] = 0;
 /* Chuẩn bị môi trường cho /path/to/helper */
 i = 0;
 envp[i++] = "HOME=/";
 envp[i++] = "PATH=/sbin:/usr/sbin:/bin:/usr/bin";
 envp[i++] = buffer; envp[i] = 0;
 /* Thực thi chương trình chế độ người dùng, /path/to/helper */
 value = call_usermodehelper(argv[0], argv, envp, 0);
 /* Kiểm tra các giá trị trả về */
 kfree(buffer);
}
```

Kernel hỗ trợ một cơ chế cho phép yêu cầu các chương trình chạy ở chế độ người dùng (user mode program) hỗ trợ thực hiện một số chức năng nhất định. `run_umode_handler()` sử dụng tính năng này bằng cách gọi hàm `call_usermodehelper()`.

Bạn phải đăng ký chương trình chế độ người dùng được gọi bởi `run_umode_handler()` thông qua một nút (node) trong thư mục */proc/sys/*. Để làm như vậy, hãy đảm bảo rằng `CONFIG_SYSCTL` (các tệp nằm trong thư mục */proc/sys* được gọi chung là giao diện *sysctl* - *sysctl interface*) đã được bật trong cấu hình kernel của bạn và thêm một mục vào mảng `kern_table` trong *kernel/sysctl.c*:

```c
{
 .ctl_name = KERN_MYEVENT_HANDLER, /* Định nghĩa trong
 include/linux/sysctl.h */
 .procname = "myevent_handler",
 .data = &myevent_handler,
 .maxlen = 256,
 .mode = 0644,
 .proc_handler = &proc_dostring,
 .strategy = &sysctl_string,
},
```

Thao tác này tạo ra nút */proc/sys/kernel/myevent_handler* trong hệ thống tệp tiến trình (process filesystem). Để đăng ký chương trình hỗ trợ chế độ người dùng (user mode helper) của bạn, hãy thực hiện lệnh sau:

**bash> echo /path/to/helper > /proc/sys/kernel/myevent_handler**

Điều này dẫn đến việc */path/to/helper* được thực thi khi `mykthread` gọi `run_umode_handler()`.

`Mykthread` truyền định danh của cấu trúc dữ liệu kernel đang gặp sự cố cho user mode helper thông qua biến môi trường `TROUBLED_DS`. Chương trình hỗ trợ này có thể là một tập lệnh (script) đơn giản như sau, gửi cho bạn một email cảnh báo chứa thông tin mà nó thu thập được từ môi trường của mình:

#### bash> cat /path/to/helper

## !/bin/bash

echo Kernel datastructure \$TROUBLED\_DS is in trouble | mail -s Alert root

`call_usermodehelper()` phải được thực thi từ ngữ cảnh tiến trình (process context) và chạy với quyền root (root privileges). Nó được triển khai bằng cách sử dụng một hàng đợi công việc (work queue), thứ mà chúng ta sẽ thảo luận ngay sau đây.

## Giao diện hỗ trợ (Helper Interfaces)

Có một số giao diện hỗ trợ hữu ích tồn tại trong kernel nhằm đơn giản hóa công việc cho các nhà phát triển trình điều khiển thiết bị (device driver developer). Một ví dụ là việc triển khai thư viện danh sách liên kết đôi (doubly linked list library). Nhiều trình điều khiển cần duy trì và thao tác với các danh sách liên kết của các cấu trúc dữ liệu. Cácroutines giao diện *list* của kernel giúp loại bỏ sự cần thiết phải theo dõi các con trỏ danh sách (list pointer) và gỡ lỗi các vấn đề rắc rối liên quan đến việc duy trì danh sách. Hãy cùng tìm hiểu cách sử dụng các giao diện hỗ trợ như danh sách (lists), danh sách băm (hlists), hàng đợi công việc (work queues), hàm hoàn thành (completion functions), khối thông báo (notifier blocks), và tiến trình kernel (kthreads).

Có những cách tương đương để làm những gì mà các cơ chế hỗ trợ mang lại. Ví dụ, bạn có thể tự triển khai các routine thao tác danh sách của riêng mình thay vì sử dụng thư viện list, hoặc sử dụng các tiến trình kernel (kernel thread) để hoãn công việc thay vì gửi nó vào các hàng đợi công việc (work queue). Tuy nhiên, việc sử dụng các giao diện hỗ trợ chuẩn của kernel sẽ giúp đơn giản hóa mã nguồn của bạn, loại bỏ sự dư thừa khỏi kernel, tăng khả năng đọc mã và hỗ trợ việc bảo trì lâu dài.

Vì kernel rất rộng lớn, bạn luôn có thể tìm thấy các phần chưa tận dụng các cơ chế hỗ trợ này, vì vậy việc cập nhật các vùng mã nguồn đó có thể là một cách tốt để bắt đầu tham gia đóng góp vào quá trình phát triển kernel.

### Danh sách liên kết (Linked Lists)

Để tạo ra các danh sách liên kết kép (doubly linked lists) cho các cấu trúc dữ liệu, hãy sử dụng các hàm được cung cấp trong *include/linux/list.h.* Về cơ bản, bạn nhúng một `struct list_head` vào bên trong cấu trúc dữ liệu của mình:

## include <linux/list.h>

struct list_head {
struct list_head *next, *prev;
};
struct mydatastructure {
struct list_head mylist; /* Nhúng */
/* ... */ /* Các trường thực tế */
};

```

`mylist` là liên kết xâu chuỗi các thể hiện (instances) khác nhau của `mydatastructure`. Nếu bạn có nhiều `list_head` được nhúng bên trong `mydatastructure`, mỗi cái trong số chúng tạo thành một liên kết khiến `mydatastructure` trở thành thành viên của một danh sách mới. Bạn có thể sử dụng thư viện danh sách để thêm hoặc xóa tư cách thành viên khỏi các danh sách riêng lẻ.

Để nắm bắt tổng quan trước khi đi vào chi tiết, hãy tổng kết giao diện lập trình danh sách liên kết được cung cấp bởi thư viện danh sách. Điều này được thể hiện trong Bảng 3.1.

**Bảng 3.1. Các hàm thao tác danh sách liên kết**

| Hàm              | Mục đích                                    |
|------------------|---------------------------------------------|
| INIT_LIST_HEAD() | Khởi tạo phần đầu danh sách (list head)     |
| list_add()       | Thêm một phần tử vào sau đầu danh sách      |

| Hàm                                                  | Mục đích                                          |
|------------------------------------------------------|---------------------------------------------------|
| list_add_tail()                                      | Thêm một phần tử vào đuôi danh sách               |
| list_del()                                           | Xóa một phần tử khỏi danh sách                    |
| list_replace()                                       | Thay thế một phần tử trong danh sách bằng phần tử khác |
| list_entry()                                         | Duyệt qua tất cả các nút trong danh sách          |
| list_for_each_entry()/<br>list_for_each_entry_safe() | Các giao diện lặp danh sách đơn giản hơn          |
| list_empty()                                         | Kiểm tra xem có phần tử nào trong danh sách không |
| list_splice()                                        | Nối một danh sách với danh sách khác              |

Để minh họa cách sử dụng danh sách, chúng ta hãy triển khai một ví dụ. Ví dụ này cũng đóng vai trò là nền tảng để hiểu khái niệm về hàng đợi công việc (work queue), sẽ được thảo luận trong phần tiếp theo. Giả sử trình điều khiển kernel (kernel driver) của bạn cần thực hiện một tác vụ nặng từ một điểm vào (entry point). Một ví dụ là tác vụ buộc luồng gọi (calling thread) phải chuyển sang trạng thái ngủ chờ (sleep-wait). Đương nhiên, trình điều khiển của bạn không muốn bị chặn (block) cho đến khi tác vụ hoàn thành, vì điều đó làm giảm khả năng phản hồi của các ứng dụng phụ thuộc vào nó. Do đó, bất cứ khi nào trình điều khiển cần thực hiện công việc tốn kém này, nó sẽ hoãn việc thực thi bằng cách thêm quy trình tương ứng vào một danh sách liên kết chứa các hàm công việc. Công việc thực tế được thực hiện bởi một luồng kernel (kernel thread), luồng này duyệt qua danh sách và thực thi các hàm công việc ở chế độ nền (background). Trình điều khiển đưa các hàm công việc vào đuôi danh sách, trong khi luồng kernel tiến hành duyệt từ đầu danh sách, do đó đảm bảo rằng công việc được đưa vào hàng đợi trước sẽ được thực hiện trước. Tất nhiên, phần còn lại của trình điều khiển cần được thiết kế để phù hợp với cơ chế hoãn thực thi này. Tuy nhiên, trước khi hiểu ví dụ này, hãy lưu ý rằng chúng ta sẽ sử dụng giao diện hàng đợi công việc trong Liệt kê 3.5 (Listing 3.5) để thực hiện cùng một tác vụ theo cách đơn giản hơn.

Trước tiên, hãy giới thiệu các cấu trúc dữ liệu trình điều khiển quan trọng được sử dụng trong ví dụ của chúng ta:

```

static struct _mydrv_wq {
struct list_head mydrv_worklist; /* Danh sách công việc */
spinlock_t lock; /* Bảo vệ danh sách */
wait_queue_head_t todo; /* Đồng bộ hóa tiến trình gửi
và tiến trình xử lý */
} mydrv_wq;
struct _mydrv_work {
struct list_head mydrv_workitem; /* Chuỗi công việc */
void (*worker_func)(void *); /* Công việc cần thực hiện */
void *worker_data; /* Tham số truyền cho worker_func */
/* ... */ /* Các trường khác */
} mydrv_work;

```

`mydrv_wq` là toàn cục cho tất cả các yêu cầu gửi công việc. Các thành viên của nó bao gồm một con trỏ trỏ đến đầu danh sách công việc và một hàng đợi chờ (wait queue) để giao tiếp giữa các hàm trình điều khiển thực hiện việc gửi công việc và luồng kernel thực hiện công việc đó. Các hàm hỗ trợ danh sách không tự động bảo vệ việc truy cập vào các thành viên danh sách, vì vậy bạn cần sử dụng các cơ chế đồng thời (concurrency mechanisms) để tuần tự hóa các tham chiếu con trỏ đồng thời. Điều này được thực hiện bằng cách sử dụng một `spinlock` cũng là một phần của `mydrv_wq`. Quy trình khởi tạo trình điều khiển `mydrv_init()` trong Liệt kê 3.2 (Listing 3.2) khởi tạo `spinlock`, đầu danh sách và hàng đợi chờ, đồng thời kích hoạt luồng xử lý công việc (worker thread).

#### Liệt kê 3.2. Khởi tạo cấu trúc dữ liệu

```

static int __init
mydrv_init(void)
{
/* Khởi tạo khóa để bảo vệ chống lại việc
truy cập danh sách đồng thời */
spin_lock_init(&mydrv_wq.lock);
/* Khởi tạo hàng đợi chờ để giao tiếp
giữa tiến trình gửi và tiến trình xử lý */
init_waitqueue_head(&mydrv_wq.todo);
/* Khởi tạo đầu danh sách */
INIT_LIST_HEAD(&mydrv_wq.mydrv_worklist);
/* Khởi động luồng xử lý. Xem Liệt kê 3.4 */
kernel_thread(mydrv_worker, NULL,
CLONE_FS | CLONE_FILES | CLONE_SIGHAND | SIGCHLD);
return 0;
}

```

Trước khi tìm hiểu về luồng công việc (worker thread) thực thi công việc được gửi vào, chúng ta hãy xem xét cơ chế gửi việc (work submission). Liệt kê 3.3 (Listing 3.3) triển khai một hàm mà các phần khác của kernel có thể sử dụng để gửi công việc. Nó sử dụng `list_add_tail()` để thêm một hàm công việc vào cuối danh sách liên kết (list). Hãy xem Hình 3.1 để hình dung cấu trúc vật lý của danh sách công việc.

```

mvd rv worklist-------------------------------------------

|                                                   |
v                                                   |
+-----------------+                                      |

|    mydrv_wq     |                                      |
+-----------------+                                      |
^                                                |

|                                                |
v                                                |
+-----------------+    <---->   +-----------------+      |

|    mydrv_work   | <---------> |    mydrv_work   |<-----|
|                 |             |                 |
+-----------------+             +-----------------+
^

|
|
v
Membership in another list
(Not shown in structure definition)

```

**Hình 3.1. Danh sách liên kết của các hàm công việc.**

**Liệt kê 3.3. Gửi công việc để thực thi sau**

```

int
submit_work(void (*func)(void *data), void *data)
{
struct _mydrv_work *mydrv_work;
/* Cấp phát cấu trúc công việc */
mydrv_work = kmalloc(sizeof(struct _mydrv_work), GFP_ATOMIC);
if (!mydrv_work) return -1;
/* Điền thông tin vào cấu trúc công việc */
mydrv_work->worker_func = func; /* Hàm công việc */
mydrv_work->worker_data = data; /* Tham số truyền vào */
spin_lock(&mydrv_wq.lock); /* Bảo vệ danh sách */
/* Thêm công việc của bạn vào cuối danh sách */
list_add_tail(&mydrv_work->mydrv_workitem,
&mydrv_wq.mydrv_worklist);
/* Đánh thức luồng công việc (worker thread) */
wake_up(&mydrv_wq.todo);
spin_unlock(&mydrv_wq.lock);
return 0;
}

```

Để gửi một hàm công việc `void job(void *)` từ một điểm vào (entry point) của driver, hãy thực hiện như sau:

```

submit_work(job, NULL);

```

Sau khi gửi hàm công việc, Liệt kê 3.3 tiến hành đánh thức luồng công việc (worker thread). Cấu trúc tổng quát của luồng công việc được minh họa ở Liệt kê 3.4 có nét tương đồng với các kernel thread tiêu chuẩn đã được thảo luận ở phần trước. Luồng này sử dụng `list_entry()` để duyệt qua tất cả các node trong danh sách. `list_entry()` trả về cấu trúc dữ liệu chứa (container data structure) node của danh sách bên trong nó. Hãy quan sát kỹ hơn dòng lệnh có liên quan trong Liệt kê 3.4:

```

mydrv_work = list_entry(mydrv_wq.mydrv_worklist.next,
struct _mydrv_work, mydrv_workitem);

```

`mydrv_workitem` được nhúng (embed) bên trong `mydrv_work`, do đó `list_entry()` trả về một con trỏ trỏ đến cấu trúc `mydrv_work` tương ứng. Các tham số được truyền vào `list_entry()` lần lượt là địa chỉ của node danh sách được nhúng, kiểu của cấu trúc chứa (container structure), và tên trường của node danh sách được nhúng đó.

Sau khi thực thi một hàm công việc được gửi vào, luồng công việc sẽ xóa node tương ứng khỏi danh sách bằng cách sử dụng `list_del()`. Lưu ý rằng `mydrv_wq.lock` được giải phóng và được giữ lại (re-acquire) trong khoảng thời gian mà hàm công việc được thực thi. Nguyên nhân là do các hàm công việc có thể đi vào trạng thái ngủ (sleep), dẫn đến nguy cơ tiềm ẩn về khóa chết (deadlock) nếu mã nguồn được lên lịch (scheduled) mới cố gắng chiếm giữ cùng một spinlock đó.

#### Liệt kê 3.4. Luồng công việc (Worker Thread)

```

static int
mydrv_worker(void *unused)
{
DECLARE_WAITQUEUE(wait, current);
void (*worker_func)(void *);
void *worker_data;
struct _mydrv_work *mydrv_work;
set_current_state(TASK_INTERRUPTIBLE);
/* Quay vòng (spin) cho đến khi nhận được yêu cầu kết thúc */
while (!asked_to_die()) {
add_wait_queue(&mydrv_wq.todo, &wait);
if (list_empty(&mydrv_wq.mydrv_worklist)) {
schedule();
/* Được đánh thức bởi tiến trình gửi việc */
} else {
set_current_state(TASK_RUNNING);
}
remove_wait_queue(&mydrv_wq.todo, &wait);
/* Bảo vệ quyền truy cập đồng thời (concurrent access) vào danh sách */
spin_lock(&mydrv_wq.lock);
/* Duyệt qua danh sách và xử lý triệt để các hàm công việc
có trong mỗi node */
while (!list_empty(&mydrv_wq.mydrv_worklist)) {
/* Lấy phần tử đầu tiên trong danh sách */
mydrv_work = list_entry(mydrv_wq.mydrv_worklist.next,
struct _mydrv_work, mydrv_workitem);
worker_func = mydrv_work->worker_func;
worker_data = mydrv_work->worker_data;
/* Node này đã được xử lý. Loại bỏ nó
ra khỏi danh sách */
list_del(mydrv_wq.mydrv_worklist.next);
kfree(mydrv_work); /* Giải phóng node */
/* Thực thi hàm công việc trong node này */
spin_unlock(&mydrv_wq.lock); /* Giải phóng khóa */
worker_func(worker_data);
spin_lock(&mydrv_wq.lock); /* Chiếm lại khóa */
}
spin_unlock(&mydrv_wq.lock);
set_current_state(TASK_INTERRUPTIBLE);
}
set_current_state(TASK_RUNNING);
return 0;
}

```

Vì lý tính đơn giản, đoạn mã ví dụ không thực hiện việc xử lý lỗi (error handling). Ví dụ, nếu lời gọi đến `kernel_thread()` trong Liệt kê 3.2 (Listing 3.2) thất bại, bạn cần giải phóng (free) bộ nhớ đã cấp phát cho cấu trúc công việc (work structure) tương ứng. Ngoài ra, hàm `asked_to_die()` trong Liệt kê 3.4 (Listing 3.4) được để trống chưa viết. Về cơ bản, hàm này sẽ thoát khỏi vòng lặp (loop) nếu nó phát hiện một tín hiệu được gửi tới (delivered signal) hoặc nhận được thông báo từ điểm nhập (entry point) `release()` rằng module sắp được gỡ khỏi Kernel (kernel).

Trước khi kết thúc phần này, chúng ta hãy xem xét một hàm tiện ích thư viện danh sách (list library routine) hữu ích khác, `list_for_each_entry()`. Với macro này, quá trình lặp (iteration) trở nên đơn giản và dễ đọc hơn vì bạn không phải sử dụng `list_entry()` bên trong vòng lặp. Hãy sử dụng biến thể `list_for_each_entry_safe()` nếu bạn định xóa các phần tử trong danh sách bên trong vòng lặp. Bạn có thể thay thế đoạn mã sau trong Liệt kê 3.4 (Listing 3.4):

```

while (!list_empty(&mydrv_wq.mydrv_worklist)) {
mydrv_work = list_entry(mydrv_wq.mydrv_worklist.next,
struct _mydrv_work, mydrv_workitem);
/* ... */
}
bằng:
struct _mydrv_work *temp;
list_for_each_entry_safe(mydrv_work, temp,
&mydrv_wq.mydrv_worklist,
mydrv_workitem) {
/* ... */
}

```

Bạn không thể sử dụng `list_for_each_entry()` trong trường hợp này vì bạn đang xóa phần tử trỏ bởi `mydrv_work` bên trong vòng lặp ở Liệt kê 3.4 (Listing 3.4). `list_for_each_entry_safe()` giải quyết vấn đề này bằng cách sử dụng biến tạm thời được truyền vào làm đối số thứ hai (`temp`) để lưu trữ địa chỉ của phần tử tiếp theo trong danh sách (list).

### Danh sách băm (Hash Lists)

Việc cài đặt danh sách liên kết kép (doubly linked list implementation) được thảo luận trước đó không tối ưu cho các trường hợp bạn muốn triển khai các cấu trúc dữ liệu liên kết như bảng băm (hash tables). Lý do là các bảng băm chỉ cần một đầu danh sách (list head) chứa một con trỏ duy nhất. Để giảm chi phí bộ nhớ (memory overhead) cho các ứng dụng như vậy, Kernel cung cấp các danh sách băm (hay *hlists*), một biến thể của danh sách. Không giống như các danh sách thông thường sử dụng cùng một cấu trúc cho đầu danh sách và các nút danh sách (list nodes), hlists có các định nghĩa riêng biệt:

```

struct hlist_head {
struct hlist_node *first;
};
struct hlist_node {
struct hlist_node *next, **pprev;
};

```

Để phù hợp với sơ đồ đầu hlist một con trỏ, các nút duy trì địa chỉ của con trỏ trỏ tới nút trước đó, thay vì chính con trỏ đó.

Bảng băm được triển khai bằng cách sử dụng một mảng các `hlist_head`. Mỗi `hlist_head` cung cấp nguồn cho một danh sách liên kết kép gồm các `hlist_node`. Một hàm băm (hash function) được sử dụng để xác định chỉ mục (index hoặc bucket) trong mảng `hlist_head`. Khi quá trình đó hoàn tất, bạn có thể sử dụng các hàm trợ giúp hlist (hlist helper routines, cũng được định nghĩa trong *include/linux/list.h*) để thao tác trên danh sách các `hlist_node` được liên kết với bucket đã chọn. Hãy xem việc cài đặt bộ đệm thư mục (directory cache - dcache) trong *fs/dcache.c* để biết một ví dụ.

### Hàng đợi Công việc (Work Queues)

Hàng đợi công việc (work queues) là một cách để hoãn công việc (defer work) bên trong kernel [2]. Việc hoãn công việc rất hữu ích trong vô số tình huống. Các ví dụ bao gồm những trường hợp sau:

[2] Softirq và tasklet là hai cơ chế khác có sẵn để hoãn công việc bên trong kernel. Bảng 4.1 của Chương 4 so sánh giữa softirq, tasklet và hàng đợi công việc.

- Kích hoạt khởi động lại bộ điều hợp mạng (network adapter) để phản hồi lại ngắt lỗi (error interrupt)
- Các tác vụ hệ thống tệp (filesystem) như đồng bộ hóa các bộ đệm đĩa (disk buffers)
- Gửi lệnh đến đĩa và thực hiện theo máy trạng thái giao thức lưu trữ (storage protocol state machine)

Chức năng của hàng đợi công việc tương tự như ví dụ được mô tả trong Danh sách (Listings) 3.2 đến 3.4. Tuy nhiên, hàng đợi công việc có thể giúp bạn hoàn thành cùng một tác vụ theo cách đơn giản hơn.

Thư viện hỗ trợ hàng đợi công việc cung cấp hai cấu trúc giao diện cho người dùng: `workqueue_struct` và `work_struct`. Thực hiện theo các bước sau để sử dụng hàng đợi công việc:

- **1.** Tạo một hàng đợi công việc (hoặc `workqueue_struct`) với một hoặc nhiều tiến trình nhân (kernel thread) đi kèm. Để tạo một kernel thread nhằm phục vụ `workqueue_struct`, hãy sử dụng `create_singlethread_workqueue()`. Để tạo một tiến trình nhân làm việc (worker thread) cho mỗi CPU trong hệ thống, hãy sử dụng biến thể `create_workqueue()`. Kernel cũng có các worker thread mặc định cho mỗi CPU (*events/n*, trong đó *n* là số hiệu CPU) mà bạn có thể chia sẻ thời gian (timeshare) thay vì yêu cầu một worker thread riêng biệt. Tùy thuộc vào ứng dụng của bạn, bạn có thể gặp phải tình trạng sụt giảm hiệu năng nếu không sử dụng một worker thread chuyên dụng.
- **2.** Tạo một phần tử công việc (hoặc `work_struct`). Một `work_struct` được khởi tạo bằng cách sử dụng `INIT_WORK()`, hàm này sẽ gán cho nó địa chỉ và tham số của hàm công việc (work function) của bạn.
- **3.** Gửi phần tử công việc vào hàng đợi công việc. Một `work_struct` có thể được gửi vào một hàng đợi chuyên dụng bằng cách sử dụng `queue_work()`, hoặc vào worker thread mặc định của kernel bằng cách sử dụng `schedule_work()`.

Hãy viết lại Danh sách 3.2 đến 3.4 để tận dụng lợi thế của giao diện hàng đợi công việc. Việc này được thực hiện trong Danh sách 3.5. Toàn bộ kernel thread, cũng như spinlock và hàng đợi chờ (wait queue), đều biến mất bên trong giao diện hàng đợi công việc. Ngay cả lệnh gọi `create_singlethread_workqueue()` cũng không còn cần thiết nếu bạn đang sử dụng worker thread mặc định của kernel.

**Mã nguồn 3.5. Sử dụng Hàng đợi Công việc để Hoãn Công việc**

```c

## include <linux/workqueue.h>

struct workqueue_struct *wq;
/* Khởi tạo Driver */
static int __init
mydrv_init(void)
{
/* ... */
wq = create_singlethread_workqueue("mydrv");
return 0;
}
/* Gửi Công việc. Đối số đầu tiên là hàm công việc, và
đối số thứ hai là tham số truyền vào hàm công việc */
int
submit_work(void (*func)(void *data), void *data)
{
struct work_struct *hardwork;
hardwork = kmalloc(sizeof(struct work_struct), GFP_KERNEL);
/* Khởi tạo cấu trúc công việc */
INIT_WORK(hardwork, func, data);
/* Đưa công việc vào hàng đợi */
queue_work(wq, hardwork);
return 0;
}

```

Nếu bạn đang sử dụng hàng đợi công việc, bạn sẽ gặp lỗi liên kết (linker error) trừ khi bạn khai báo module của mình được cấp phép theo giấy phép GPL. Điều này là do kernel chỉ xuất các hàm này cho mã nguồn tuân thủ GPL. Nếu bạn xem xét việc triển khai hàng đợi công việc của kernel, bạn sẽ thấy sự hạn chế này được thể hiện qua các câu lệnh như sau:

```

EXPORT_SYMBOL_GPL(queue_work);

```

Để thông báo rằng module của bạn mang tính chất *copyleft* theo GPL, hãy khai báo như sau:

```

MODULE_LICENSE("GPL");

```

### Chuỗi thông báo (Notifier Chains)

*Chuỗi thông báo* (*notifier chains*) được sử dụng để gửi các thông điệp thay đổi trạng thái tới các vùng mã nguồn có yêu cầu. Khác với các cơ chế mã cứng (hard-coded), các bộ thông báo cung cấp một kỹ thuật linh hoạt để nhận cảnh báo khi các sự kiện quan trọng phát sinh. Các bộ thông báo ban đầu được thêm vào để truyền các sự kiện mạng đến các phần có liên quan của kernel nhưng hiện nay được sử dụng cho nhiều mục đích khác nhau. Kernel thực hiện các bộ thông báo được định nghĩa sẵn cho các sự kiện quan trọng. Ví dụ về các thông báo như vậy bao gồm:

- **Thông báo chết (Die notification)**, được gửi đi khi một hàm kernel kích hoạt một trap hoặc fault, do "oops", page fault, hoặc điểm ngắt (breakpoint) bị chạm tới. Ví dụ, nếu bạn đang viết một trình điều khiển thiết bị (device driver) cho một thẻ cấp y tế (medical grade card), bạn có thể muốn đăng ký với chuỗi thông báo die để có thể cố gắng tắt các thiết bị điện tử y tế nếu kernel panic xảy ra.
- **Thông báo thiết bị mạng (Net device notification)**, được tạo ra khi một giao diện mạng (network interface) chuyển sang trạng thái up hoặc down.
- **Thông báo tần số CPU (CPU frequency notification)**, được điều phối khi có sự chuyển đổi tần số của bộ xử lý (processor frequency).
- **Thông báo địa chỉ Internet (Internet address notification)**, được gửi đi khi phát hiện thấy sự thay đổi trong địa chỉ IP của một giao diện mạng.

Một ví dụ sử dụng các bộ thông báo là trình điều khiển giao thức *High-level Data Link Control* (HDLC) *drivers/net/wan/hdlc.c*, tự đăng ký với chuỗi thông báo thiết bị mạng để phát hiện các thay đổi về sóng mang (carrier changes).

Để gắn mã nguồn của bạn vào một chuỗi thông báo, bạn phải đăng ký một trình xử lý sự kiện (event handler) với chuỗi tương ứng. Một định danh sự kiện (event identifier) và một tham số dành riêng cho bộ thông báo (notifier-specific argument) được truyền làm đối số cho hàm xử lý khi sự kiện quan trọng được tạo ra. Để định nghĩa một chuỗi thông báo tùy chỉnh (custom notifier chain), bạn phải triển khai thêm hạ tầng để kích hoạt chuỗi khi sự kiện được phát hiện.

Liệt kê (Listing) 3.6 chứa các ví dụ về việc sử dụng các bộ thông báo được định nghĩa sẵn và do người dùng định nghĩa. Bảng 3.2 chứa một mô tả ngắn gọn về các chuỗi thông báo được sử dụng trong Liệt kê 3.6 và các sự kiện mà chúng truyền đi, vì vậy hãy xem xét phần liệt kê và bảng này song song với nhau.

**Bảng 3.2. Chuỗi thông báo và các sự kiện chúng truyền đi**

| Chuỗi thông báo (Notifier Chain) | Mô tả (Description) |
|----------------|-------------|
| **Die Notifier Chain** (`die_chain`) | Đăng ký qua `register_die_notifier()`. Được kích hoạt khi xảy ra lỗi nghiêm trọng (oops, page fault, điểm ngắt). Trình xử lý nhận được cấu trúc `die_args` chứa bản chụp trạng thái thanh ghi CPU tại thời điểm lỗi. |
| **Net Device Notifier Chain** (`netdev_chain`) | Đăng ký qua `register_netdevice_notifier()`. Phát sự kiện khi giao diện mạng thay đổi trạng thái (ví dụ `NETDEV_UP` khi chạy `ifconfig eth0 up`). Trình xử lý nhận tham số là con trỏ `struct net_device`. |
| **User-Defined Notifier Chain** | Chuỗi thông báo do người dùng tự định nghĩa (ví dụ `my_noti_chain`). Được kích hoạt thủ công bằng `blocking_notifier_call_chain()` để phát các sự kiện tùy biến nội bộ. |

Bạn phải hủy đăng ký (unregister) các trình xử lý sự kiện khỏi các chuỗi thông báo khi mô-đun của bạn được giải phóng khỏi kernel. Ví dụ, nếu bạn thực hiện *up* hoặc *down* một giao diện mạng sau khi gỡ mô-đun (unloading) mã nguồn trong Liệt kê 3.6, bạn sẽ gặp lỗi "oops", trừ khi bạn thực hiện register\_netdevice\_notifier(&my\_dev\_notifier) từ phương thức release() của mô-đun. Điều này là do chuỗi thông báo vẫn tiếp tục hiểu rằng mã nguồn trình xử lý là hợp lệ, mặc dù nó đã bị kéo ra khỏi kernel.

#### Mã nguồn 3.6. Các trình xử lý sự kiện thông báo

```c

## include <linux/notifier.h>

## include <asm/kdebug.h>

## include <linux/netdevice.h>

## include <linux/inetdevice.h>

/* Die Notifier Definition */
static struct notifier_block my_die_notifier = {
.notifier_call = my_die_event_handler,
};
/* Die notification event handler */
int
my_die_event_handler(struct notifier_block *self,
unsigned long val, void *data)
{
struct die_args *args = (struct die_args *)data;
if (val == 1) { /* '1' corresponds to an "oops" */
printk("my_die_event: OOPs! at EIP=%lx\n", args->regs->eip);

```

```

} /* else ignore */
return 0;
}
/* Net Device notifier definition */
static struct notifier_block my_dev_notifier = {
.notifier_call = my_dev_event_handler,
};
/* Net Device notification event handler */
int my_dev_event_handler(struct notifier_block *self,
unsigned long val, void *data)
{
printk("my_dev_event: Val=%ld, Interface=%s\n", val,
((struct net_device *) data)->name);
return 0;
}
/* User-defined notifier chain implementation */
static BLOCKING_NOTIFIER_HEAD(my_noti_chain);
static struct notifier_block my_notifier = {
.notifier_call = my_event_handler,
};
/* User-defined notification event handler */
int my_event_handler(struct notifier_block *self,
unsigned long val, void *data)
{
printk("my_event: Val=%ld\n", val);
return 0;
}
/* Driver Initialization */
static int __init
my_init(void)
{
/* ... */
/* Register Die Notifier */
register_die_notifier(&my_die_notifier);
/* Register Net Device Notifier */
register_netdevice_notifier(&my_dev_notifier);
/* Register a user-defined Notifier */
blocking_notifier_chain_register(&my_noti_chain, &my_notifier);
/* ... */
}

```

`my_noti_chain` trong Liệt kê (Listing) 3.6 được khai báo là một bộ thông báo chặn (blocking notifier) bằng cách sử dụng macro `BLOCKING_NOTIFIER_HEAD()` và được đăng ký thông qua hàm `blocking_notifier_chain_register()`. Điều này có nghĩa là trình xử lý thông báo (notifier handler) luôn được gọi từ ngữ cảnh tiến trình (process context). Do đó, hàm xử lý `my_event_handler()` được phép chuyển sang trạng thái ngủ (go to sleep). Nếu trình xử lý thông báo của bạn có thể được gọi từ ngữ cảnh ngắt (interrupt context), hãy khai báo chuỗi thông báo (notifier chain) bằng `ATOMIC_NOTIFIER_HEAD()` và đăng ký nó thông qua `atomic_notifier_chain_register()`.

#### Giao diện Notifier Cũ (The Old Notifier Interface)

Các phiên bản Linux Kernel trước 2.6.17 chỉ hỗ trợ một chuỗi thông báo đa mục đích (general-purpose notifier chain). Hàm đăng ký thông báo `notifier_chain_register()` được bảo vệ bên trong bằng một spinlock, nhưng hàm duyệt qua chuỗi thông báo để phân phối các sự kiện đến các trình xử lý thông báo (`notifier_call_chain()`) lại không sử dụng cơ chế khóa (lockless). Việc thiếu cơ chế khóa này là do các hàm xử lý có khả năng phải chuyển sang trạng thái ngủ, tự hủy đăng ký trong khi đang chạy, hoặc được gọi từ ngữ cảnh ngắt. Tuy nhiên, việc triển khai không có khóa này đã dẫn đến các tình trạng tranh chấp dữ liệu (Race Condition). API thông báo mới được xây dựng dựa trên giao diện gốc và nhằm mục đích khắc phục các hạn chế của nó.

### Giao diện Hoàn thành (Completion Interface)

Nhiều thành phần của nhân hệ điều hành (kernel) khởi tạo các hoạt động nhất định dưới dạng các luồng thực thi (execution thread) riêng biệt và sau đó chờ chúng hoàn thành. Giao diện *hoàn thành* (*completion* interface) là một cách hiệu quả và dễ dàng để triển khai các mẫu mã (code pattern) như vậy.

Một số kịch bản sử dụng ví dụ bao gồm:

- Module trình điều khiển (driver module) của bạn được hỗ trợ bởi một kernel thread. Nếu bạn thực hiện lệnh `rmmod` module đó, phương thức `release()` sẽ được gọi trước khi gỡ bỏ mã nguồn của module khỏi không gian nhân (kernel space). Quy trình giải phóng (release routine) yêu cầu luồng tự kết thúc và block (chặn) cho đến khi luồng hoàn tất quá trình thoát. Liệt kê 3.7 (Listing 3.7) triển khai trường hợp này.
- Bạn đang viết một phần của trình điều khiển thiết bị khối (block device driver - được thảo luận trong Chương 14, "Block Drivers") để xếp hàng đợi một yêu cầu đọc vào thiết bị. Điều này kích hoạt một sự thay đổi máy trạng thái (state machine change) được triển khai như một luồng riêng biệt hoặc hàng đợi công việc (work queue). Trình điều khiển muốn chờ cho đến khi thao tác hoàn tất trước khi tiếp tục một hoạt động khác. Hãy xem *drivers/block/floppy.c* để biết ví dụ.
- Một ứng dụng yêu cầu trình điều khiển *Bộ chuyển đổi Tương tự sang Số* (*Analog-to-Digital Converter* - ADC) để lấy mẫu dữ liệu. Trình điều khiển khởi tạo một yêu cầu chuyển đổi, chờ đợi cho đến khi một ngắt (interrupt) báo hiệu việc hoàn tất chuyển đổi và trả về dữ liệu.

#### Liệt kê 3.7. Đồng bộ hóa sử dụng các hàm hoàn thành (Completion Functions)

```

static DECLARE_COMPLETION(my_thread_exit); /* Biến hoàn thành */
static DECLARE_WAIT_QUEUE_HEAD(my_thread_wait); /* Hàng đợi chờ */
int pink_slip = 0; /* Cờ thoát */
/* Luồng hỗ trợ */
static int
my_thread(void *unused)
{
DECLARE_WAITQUEUE(wait, current);
daemonize("my_thread");
add_wait_queue(&my_thread_wait, &wait);
while (1) {
/* Nhường bộ xử lý cho đến khi sự kiện xảy ra */

```

```

set_current_state(TASK_INTERRUPTIBLE);
schedule();
/* Điều khiển đến đây khi luồng được đánh thức
khỏi hàng đợi chờ my_thread_wait */
/* Thoát nếu được phép */
if (pink_slip) {
break;
}
/* Thực hiện công việc thực tế */
/* ... */
}
/* Thoát khỏi hàng đợi chờ */
__set_current_state(TASK_RUNNING);
remove_wait_queue(&my_thread_wait, &wait);
/* Báo hiệu hoàn thành một cách nguyên tử và thoát */
complete_and_exit(&my_thread_exit, 0);
}
/* Khởi tạo Module */
static int __init
my_init(void)
{
/* ... */
/* Khởi động luồng */
kernel_thread(my_thread, NULL,
CLONE_FS | CLONE_FILES | CLONE_SIGHAND | SIGCHLD);
/* ... */
}
/* Giải phóng Module */
static void __exit
my_release(void)
{
/* ... */
pink_slip = 1; /* my_thread phải kết thúc */
wake_up(&my_thread_wait); /* Kích hoạt my_thread */
wait_for_completion(&my_thread_exit); /* Chờ cho đến khi my_thread
thoát */
/* ... */
}

```

Một đối tượng completion có thể được khai báo tĩnh (statically) bằng cách sử dụng `DECLARE_COMPLETION()` hoặc được tạo động (dynamically) bằng `init_completion()`. Một luồng có thể báo hiệu hoàn thành với sự trợ giúp của `complete()` hoặc `complete_all()`. Một tiến trình gọi (caller) có thể chờ hoàn thành thông qua `wait_for_completion()`.

Trong Liệt kê 3.7, `my_release()` đặt cờ yêu cầu thoát bằng cách thiết lập `pink_slip` trước khi đánh thức `my_thread()`. Sau đó, hàm này gọi `wait_for_completion()` để chờ cho đến khi `my_thread()` hoàn tất quá trình thoát. Về phần mình, `my_thread()` thức dậy, phát hiện thấy `pink_slip` đã được thiết lập và thực hiện các bước sau:

- **1.** Báo hiệu hoàn thành cho `my_release()`
- **2.** Tự hủy tiến trình (kết thúc chính nó)

`my_thread()` hoàn thành hai bước này một cách nguyên tử (atomically) bằng cách sử dụng `complete_and_exit()`. Việc sử dụng `complete_and_exit()` giúp thu hẹp khoảng thời gian (window) giữa việc module thoát và luồng thoát vốn có thể xảy ra nếu bạn gọi riêng biệt `complete()` và lệnh thoát.

Chúng ta sẽ sử dụng API completion khi phát triển một trình điều khiển từ xa (telemetry driver) mẫu trong Chương 11.

### Các hàm hỗ trợ Kthread (Kthread Helpers)

*Các hàm hỗ trợ kthread* (kthread helpers) bổ sung một lớp phủ bên trên các hàm khởi tạo luồng (thread creation routines) thô và đơn giản hóa tác vụ quản lý luồng (thread management).

Liệt kê 3.8 viết lại Liệt kê 3.7 bằng cách sử dụng giao diện hàm hỗ trợ kthread. my_init() bây giờ sử dụng kthread_create() thay vì kernel_thread(). Bạn có thể truyền tên của luồng vào kthread_create() thay vì gọi tường minh daemonize() bên trong luồng đó.

Giao diện kthread cung cấp cho bạn quyền truy cập miễn phí vào một cơ chế đồng bộ hóa thoát (exit synchronization mechanism) tích hợp sẵn, được thực thi bằng cách sử dụng giao diện completion. Do đó, giống như những gì my_release() thực hiện trong Liệt kê 3.8, bạn có thể gọi trực tiếp kthread_stop() thay vì phải tốn công thiết lập pink_slip, đánh thức my_thread() (waking up), và chờ đợi nó hoàn thành bằng cách sử dụng wait_for_completion(). Tương tự, my_thread() có thể thực hiện một lời gọi gọn gàng tới kthread_should_stop() để kiểm tra xem nó có nên dừng lại hay không (call it a day).

**Mã nguồn 3.8. Đồng bộ hóa sử dụng các hàm hỗ trợ Kthread**

```c

/* '+' và '-' thể hiện các điểm khác biệt so với Mã nguồn 3.7 */

## include <linux/kthread.h>

/* Luồng phụ (Assistant Thread) */
static int
my_thread(void *unused)
{
DECLARE_WAITQUEUE(wait, current);

- daemonize("my_thread");
- while (1) {
- /* Tiếp tục công việc nếu không có luồng nào khác
- * đã gọi kthread_stop() */
- while (!kthread_should_stop()) {
/* ... */

- /* Thoát nếu được cho phép */
- if (pink_slip) {
- break;
- }
/* ... */
}
__set_current_state(TASK_RUNNING);
remove_wait_queue(&my_thread_wait, &wait);

```

```

- complete_and_exit(&my_thread_exit, 0);
- return 0;
}

- struct task_struct *my_task;
/* Khởi tạo Module (Module Initialization) */
static int __init
my_init(void)
{
/* ... */

- kernel_thread(my_thread, NULL,
- CLONE_FS | CLONE_FILES | CLONE_SIGHAND |
SIGCHLD);

- my_task = kthread_create(my_thread, NULL, "%s", "my_thread");
- if (my_task) wake_up_process(my_task);
/* ... */
}
/* Giải phóng Module (Module Release) */
static void __exit
my_release(void)
{
/* ... */

- pink_slip = 1;
- wake_up(&my_thread_wait);
- wait_for_completion(&my_thread_exit);
- kthread_stop(my_task);
/* ... */
}

```

Thay vì tạo luồng bằng kthread_create() và kích hoạt nó thông qua wake_up_process() như đã làm trong Liệt kê 3.8, bạn có thể sử dụng một lời gọi duy nhất sau đây:

```

kthread_run(my_thread, NULL, "%s", "my_thread");

```

#### Các công cụ hỗ trợ xử lý lỗi (Error-Handling Aids)

Một số hàm trong kernel trả về giá trị con trỏ (pointer values). Trong khi các hàm gọi зазвичай kiểm tra lỗi bằng cách so sánh giá trị trả về với NULL, chúng thường cần thêm thông tin để giải mã bản chất chính xác của lỗi đã xảy ra. Do các địa chỉ kernel (kernel addresses) có các bit dư thừa, chúng có thể được nạp chồng (overloaded) để mã hóa ngữ nghĩa lỗi (error semantics). Điều này được thực hiện với sự trợ giúp của một tập hợp các hàm hỗ trợ. Liệt kê 3.9 thực thi một ví dụ sử dụng đơn giản.

#### Mã nguồn 3.9. Sử dụng các công cụ hỗ trợ xử lý lỗi

```c

## include <linux/err.h>

char *
collect_data(char *userbuffer)
{
char *buffer;
/* ... */
buffer = kmalloc(100, GFP_KERNEL);
if (!buffer) { /* Hết bộ nhớ (Out of memory) */
return ERR_PTR(-ENOMEM);
}
/* ... */
if (copy_from_user(buffer, userbuffer, 100)) {
return ERR_PTR(-EFAULT);
}
/* ... */
return(buffer);
}
int
my_function(char *userbuffer)
{
char *buf;
/* ... */
buf = collect_data(userbuffer);
if (IS_ERR(buf)) {
printk("Error returned is %d!\n", PTR_ERR(buf));
}
/* ... */
}

```

Nếu kmalloc() thất bại bên trong collect_data() ở Liệt kê 3.9, bạn sẽ nhận được thông báo sau:

```

Error returned is -12!

```

Tuy nhiên, nếu collect_data() thành công, nó sẽ trả về một con trỏ hợp lệ trỏ tới bộ đệm dữ liệu (data buffer). Như một ví dụ khác, chúng ta hãy thêm phần xử lý lỗi bằng cách sử dụng IS_ERR() và PTR_ERR() vào mã tạo luồng trong Liệt kê 3.8:

```

my_task = kthread_create(my_thread, NULL, "%s", "mydrv");

- if (!IS_ERR(my_task)) {
- /* Thành công (Success) */
wake_up_process(my_task);

- } else {
- /* Thất bại (Failure) */

```

```

- printk("Error value returned=%d\n", PTR_ERR(my_task));
- }

```

## Xem xét mã nguồn (Looking at the Sources)

Các tiến trình kernel (kernel threads) ksoftirqd, pdflush và khubd lần lượt nằm trong *kernel/softirq.c*, *mm/pdflush.c* và *drivers/usb/core/hub.c*.

Hàm daemonize() có thể được tìm thấy trong *kernel/exit.c*. Để biết cách thực thi các hàm hỗ trợ chế độ người dùng (user mode helpers), hãy xem *kernel/kmod.c*.

Các thư viện hàm danh sách (list) và hlist nằm trong *include/linux/list.h*. Chúng được sử dụng xuyên suốt kernel, vì vậy bạn sẽ tìm thấy các ví dụ sử dụng ở hầu hết các thư mục con. Một ví dụ là cấu trúc request_queue được định nghĩa trong *include/linux/blkdev.h*, chứa một danh sách liên kết (linked list) các yêu cầu I/O đĩa. Chúng ta sẽ xem xét cấu trúc dữ liệu này trong Chương 14.

Truy cập trang www.ussg.iu.edu/hypermail/linux/kernel/0007.3/0805.html và theo dõi chuỗi thảo luận trong danh sách gửi thư (mailing list) để xem một cuộc tranh luận thú vị giữa Linus Torvalds và Andi Kleen về ưu và nhược điểm của việc bổ sung cho thư viện list các hàm hỗ trợ hlist.

Việc thực thi hàng đợi công việc của kernel (kernel work queue implementation) nằm trong *kernel/workqueue.c*. Để hiểu cách sử dụng thực tế của work queue, hãy xem trình điều khiển mạng PRO/Wireless 2200 tại *drivers/net/wireless/ipw2200.c*.

Việc cài đặt chuỗi thông báo (notifier chain) của kernel nằm trong *kernel/sys.c* và *include/linux/notifier.h*. Hãy xem *kernel/sched.c* và *include/linux/completion.h* để hiểu rõ phần cốt lõi của giao diện completion. *kernel/kthread.c* chứa mã nguồn cho các hàm hỗ trợ kthread (kthread helpers), và *include/linux/err.h* bao gồm các định nghĩa về các công cụ hỗ trợ xử lý lỗi (error handling aids).

Bảng 3.3 chứa tóm tắt về các cấu trúc dữ liệu chính được sử dụng trong chương này và vị trí định nghĩa của chúng trong cây mã nguồn (source tree). Bảng 3.4 liệt kê các giao diện lập trình kernel (kernel programming interfaces) chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

|                | Bảng 3.3. Tóm tắt các Cấu trúc Dữ liệu |                                                                                                                     |  |  |
|----------------|---------------------------------------|---------------------------------------------------------------------------------------------------------------------|--|--|
| Cấu trúc Dữ liệu | Vị trí                              | Mô tả                                                                                                               |  |  |
| wait_queue_t   | include/linux/wait.h                  | Được sử dụng bởi các luồng (threads) muốn chờ đợi một sự kiện hoặc một tài nguyên hệ thống                           |  |  |
| list_head      | include/linux/list.h                  | Cấu trúc của kernel để liên kết các cấu trúc dữ liệu thành một danh sách liên kết đôi (doubly linked list)           |  |  |
| hlist_head     | include/linux/list.h                  | Cấu trúc của kernel để thực thi các bảng băm (hash tables)                                                          |  |  |
| work_struct    |                                       | include/linux/workqueue.h Thực thi các hàng đợi công việc (work queues), là một cách để hoãn công việc bên trong kernel |  |  |
| notifier_block | include/linux/notifier.h              | Thực thi các chuỗi thông báo (notifier chains), được dùng để gửi các thay đổi trạng thái đến các vùng mã yêu cầu chúng |  |  |
| completion     |                                       | include/linux/completion.h Được sử dụng để khởi tạo các hoạt động dưới dạng các luồng riêng biệt và sau đó chờ chúng hoàn thành |  |  |

**Bảng 3.4. Tóm tắt các Giao diện Lập trình Kernel**

| Giao diện Kernel                                | Vị trí                                 | Mô tả                                                                                                                                                                                    |
|-------------------------------------------------|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| DECLARE_WAITQUEUE()                             | include/linux/wait.h                   | Khai báo một hàng đợi chờ (wait queue).                                                                                                                                                  |
| add_wait_queue()                                | kernel/wait.c                          | Đưa một tác vụ (task) vào hàng đợi chờ.<br>Tác vụ sẽ chuyển sang trạng thái ngủ (sleep) cho đến khi được đánh thức bởi một luồng khác hoặc trình xử lý ngắt (interrupt handler). |
| remove_wait_queue()                             | kernel/wait.c                          | Loại bỏ một tác vụ khỏi hàng đợi chờ.                                                                                                                                                    |
| wake_up_interruptible()                         | include/linux/wait.h<br>kernel/sched.c | Đánh thức một tác vụ đang ngủ bên trong hàng đợi chờ và đưa nó trở lại hàng đợi chạy của trình lập lịch (scheduler run queue).                                                            |
| schedule()                                      | kernel/sched.c                         | Từ bỏ bộ vi xử lý và cho phép các phần khác của kernel chạy.                                                                                                                             |
| set_current_state()                             | include/linux/sched.h                  | Đặt trạng thái chạy của một tiến trình (process).<br>Trạng thái có thể là một trong các giá trị TASK_RUNNING,<br>TASK_INTERRUPTIBLE,<br>TASK_UNINTERRUPTIBLE,<br>TASK_STOPPED, TASK_TRACED,<br>EXIT_ZOMBIE, hoặc EXIT_DEAD. |
| kernel_thread()                                 | arch/your<br>arch/kernel/process.c     | Tạo một luồng kernel (kernel thread).                                                                                                                                                    |

| daemonize()                                     | kernel/exit.c                          | Kích hoạt một tiến trình luồng nhân (kernel thread)<br>mà không đính kèm tài nguyên người dùng (user resources)<br>và đổi tiến trình cha của luồng gọi<br>thành kthreadd.                                                            |
| allow_signal()                                  | kernel/exit.c                          | Cho phép gửi một tín hiệu (signal)<br>được chỉ định.                                                                                                                                               |
| signal_pending()                                | include/linux/sched.h                  | Kiểm tra xem tín hiệu đã<br>được gửi đến hay chưa. Không có<br>trình xử lý tín hiệu (signal handlers) nào bên trong kernel,<br>vì vậy bạn phải chủ động kiểm tra<br>xem tín hiệu đã được<br>gửi đến hay chưa.          |
| call_usermodehelper()                           | include/linux/kmod.h<br>kernel/kmod.c  | Thực thi một chương trình chế độ người dùng (user mode program).                                                                                                                                                            |
| Linked list library functions                   | include/linux/list.h                   | Xem Bảng 3.1.                                                                                                                                                                           |
| register_die_notifier()                         | arch/your<br>arch/kernel/traps.c       | Đăng ký một bộ thông báo lỗi hệ thống (die notifier).                                                                                                                                 |
| register_netdevice_notifier()                   | net/core/dev.c                         | Đăng ký một bộ thông báo thiết bị mạng (netdevice notifier).                                                                                                                           |
| register_inetaddr_notifier()                    | net/ipv4/devinet.c                     | Đăng ký một bộ thông báo địa chỉ inet (inetaddr notifier).                                                                                                                           |
| BLOCKING_NOTIFIER_HEAD()                        | include/linux/notifier.h               | Tạo một bộ thông báo chặn (blocking notifier)<br>do người dùng định nghĩa.                                                                                                              |
| blocking_notifier_chain_register() kernel/sys.c |                                        | Đăng ký một bộ thông báo chặn.                                                                                                                                                           |

| Giao diện Kernel                 | Vị trí                                            | Mô tả                                                                                                                        |
|----------------------------------|---------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| blocking_notifier_call_chain()   | kernel/sys.c                                      | Phân phối một sự kiện đến chuỗi<br>bộ thông báo chặn (blocking notifier chain).                                              |
| ATOMIC_NOTIFIER_HEAD()           | include/linux/notifier.h                          | Tạo một bộ thông báo nguyên tử (atomic notifier).                                                                            |
| atomic_notifier_chain_register() | kernel/sys.c                                      | Đăng ký một bộ thông báo nguyên tử.                                                                                          |
| DECLARE_COMPLETION()             |                                                   | include/linux/completion.h Khai báo tĩnh một đối tượng<br>hoàn thành (completion object).                                     |
| init_completion()                | include/linux/completion.h Khai báo động một      | đối tượng hoàn thành (completion object).                                                                                    |
| complete()                       | kernel/sched.c                                    | Thông báo hoàn thành.                                                                                                        |
| wait_for_completion()            | kernel/sched.c                                    | Chờ cho đến khi đối tượng hoàn thành<br>hoàn tất.                                                                            |
| complete_and_exit()              | kernel/exit.c                                     | Gửi tín hiệu hoàn thành và thoát<br>một cách nguyên tử (atomically).                                                        |

| kthread_create()                 | kernel/kthread.c                                  | Tạo một tiến trình nhân (kernel thread).                                                                                     |
| kthread_stop()                   | kernel/kthread.c                                  | Yêu cầu một tiến trình nhân (kernel thread) dừng lại.                                                                        |
| kthread_should_stop()            | kernel/kthread.c                                  | Một tiến trình nhân (kernel thread) có thể gọi hàm này liên tục để phát hiện xem có tiến trình khác yêu cầu nó dừng lại thông qua `kthread_stop()` hay không. |
| IS_ERR()                         | include/linux/err.h                               | Kiểm tra xem giá trị trả về có phải là mã lỗi hay không.                                                                     |
