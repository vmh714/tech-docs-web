# Chương 33: LUỒNG: CÁC CHI TIẾT NÂNG CAO

Chương này cung cấp thêm chi tiết về nhiều khía cạnh khác nhau của POSIX threads (Pthreads). Chúng ta sẽ thảo luận về sự tương tác giữa các luồng (thread) với các khía cạnh của API UNIX truyền thống—đặc biệt là tín hiệu (signal) và các nguyên thủy điều khiển tiến trình (`fork()`, `exec()`, và `_exit()`). Chúng ta cũng sẽ tổng quan về hai cài đặt POSIX threads có sẵn trên Linux—LinuxThreads và NPTL—đồng thời lưu ý những điểm mà mỗi cài đặt này lệch so với đặc tả SUSv3 của Pthreads.

## 33.1 Stack của luồng (Thread Stacks)

Mỗi luồng có stack (vùng ngăn xếp) riêng với kích thước được cố định khi luồng được tạo. Trên Linux/x86-32, đối với tất cả các luồng ngoại trừ luồng chính (main thread), kích thước mặc định của stack cho mỗi luồng là 2 MB. (Trên một số kiến trúc 64-bit, kích thước mặc định lớn hơn; ví dụ, nó là 32 MB trên IA-64). Luồng chính có không gian lớn hơn nhiều cho sự phát triển của stack (tham khảo [Hình 29-1](#page-1-1), trang [618\)](#page-1-1)).

Thỉnh thoảng, việc thay đổi kích thước stack của một luồng là hữu ích. Hàm `pthread_attr_setstacksize()` thiết lập một thuộc tính luồng (Mục [29.8\)](#page-11-2) để xác định kích thước stack trong các luồng được tạo bằng đối tượng thuộc tính luồng (thread attributes object). Hàm liên quan `pthread_attr_setstack()` có thể được sử dụng để kiểm soát cả kích thước lẫn vị trí của stack, nhưng việc thiết lập vị trí của stack có thể làm giảm khả năng diポート (portability) của ứng dụng. Các trang hướng dẫn sử dụng (man pages) cung cấp chi tiết về các hàm này.

Một lý do để thay đổi kích thước stack cho mỗi luồng là để cấp phát stack lớn hơn cho các luồng phân bổ các biến tự động (automatic variables) lớn hoặc thực hiện các lời gọi hàm lồng nhau với độ sâu lớn (có thể do đệ quy). Ngoài ra, một ứng dụng có thể muốn giảm kích thước stack cho mỗi luồng để cho phép số lượng luồng lớn hơn trong một tiến trình (process). Ví dụ, trên x86-32, nơi không gian địa chỉ ảo có thể truy cập bởi user space là 3 GB, kích thước stack mặc định là 2 MB có nghĩa là chúng ta có thể tạo tối đa khoảng 1500 luồng. (Mức tối đa chính xác phụ thuộc vào dung lượng bộ nhớ ảo bị tiêu thụ bởi các phân đoạn text và data, các thư viện chia sẻ, v.v.). Stack tối thiểu có thể được sử dụng trên một kiến trúc cụ thể có thể được xác định bằng cách gọi `sysconf(_SC_THREAD_STACK_MIN)`. Đối với cài đặt NPTL trên Linux/x86-32, lời gọi này trả về giá trị 16.384.

> [!NOTE]
> Dưới cơ chế cài đặt luồng NPTL, nếu giới hạn tài nguyên kích thước stack (`RLIMIT_STACK`) được đặt thành bất kỳ giá trị nào khác ngoài vô hạn (unlimited), thì giá trị đó sẽ được sử dụng làm kích thước stack mặc định khi tạo các luồng mới. Giới hạn này phải được thiết lập trước khi chương trình thực thi, thường bằng cách sử dụng lệnh nội tại của shell `ulimit –s` (`limit stacksize` trong C shell) trước khi chạy chương trình. Việc sử dụng `setrlimit()` bên trong chương trình chính để thiết lập giới hạn là không đủ, bởi vì NPTL xác định kích thước stack mặc định của nó trong quá trình khởi tạo thời gian chạy (run-time initialization) diễn ra trước khi `main()` được gọi.

## 33.2 Luồng và Tín hiệu (Threads and Signals)

Mô hình tín hiệu UNIX được thiết kế dựa trên mô hình tiến trình UNIX, và ra đời trước Pthreads vài thập kỷ. Kết quả là, có một số xung đột đáng kể giữa mô hình tín hiệu và mô hình luồng. Những xung đột này phát sinh chủ yếu từ nhu cầu duy trì ngữ nghĩa tín hiệu truyền thống cho các tiến trình đơn luồng (singlethreaded processes) (tức là ngữ nghĩa tín hiệu của các chương trình truyền thống không được thay đổi bởi Pthreads), đồng thời phát triển một mô hình tín hiệu có thể sử dụng được bên trong một tiến trình đa luồng (multithreaded process).

Sự khác biệt giữa mô hình tín hiệu và mô hình luồng có nghĩa là việc kết hợp tín hiệu và luồng rất phức tạp, và nên tránh bất cứ khi nào có thể. Tuy nhiên, đôi khi chúng ta bắt buộc phải xử lý tín hiệu trong một chương trình đa luồng. Trong phần này, chúng ta thảo luận về sự tương tác giữa luồng và tín hiệu, đồng thời mô tả các hàm khác nhau hữu ích trong các chương trình đa luồng xử lý tín hiệu.

### 33.2.1 Mô hình Tín hiệu UNIX Ánh xạ như thế nào vào các Tiến trình nhẹ (Threads)

Để hiểu cách các tín hiệu UNIX (UNIX signals) ánh xạ vào mô hình Pthreads, chúng ta cần biết khía cạnh nào của mô hình tín hiệu là mang tính toàn tiến trình (process-wide) — nghĩa là được chia sẻ bởi tất cả các thread trong tiến trình — trái ngược với những khía cạnh dành riêng cho từng thread riêng lẻ bên trong tiến trình. Danh sách sau đây tóm tắt các điểm chính:

- Các hành động tín hiệu (signal actions) mang tính toàn tiến trình. Nếu bất kỳ tín hiệu chưa được xử lý nào mà có hành động mặc định là dừng (stop) hoặc chấm dứt (terminate) được gửi (deliver) đến bất kỳ thread nào trong tiến trình, thì tất cả các thread trong tiến trình đó sẽ bị dừng hoặc chấm dứt.
- Trạng thái xử lý tín hiệu (signal dispositions) mang tính toàn tiến trình; tất cả các thread trong một tiến trình chia sẻ chung một trạng thái xử lý cho mỗi tín hiệu. Nếu một thread sử dụng `sigaction()` để thiết lập một hàm xử lý (handler) cho, ví dụ, `SIGINT`, thì hàm xử lý đó có thể được gọi từ bất kỳ thread nào mà `SIGINT` được gửi đến. Tương tự, nếu một thread đặt trạng thái xử lý của một tín hiệu thành bỏ qua (ignore), thì tín hiệu đó sẽ bị bỏ qua bởi tất cả các thread.

- Một tín hiệu có thể được hướng đến toàn bộ tiến trình (process-directed) hoặc hướng đến một thread cụ thể (thread-directed). Một tín hiệu là hướng-đến-thread nếu:
  - Nó được sinh ra như một kết quả trực tiếp từ việc thực thi một chỉ thị phần cứng cụ thể trong ngữ cảnh của thread (tức là các ngoại lệ phần cứng được mô tả trong Mục 22.4: `SIGBUS`, `SIGFPE`, `SIGILL`, và `SIGSEGV`);
  - Nó là một tín hiệu `SIGPIPE` được sinh ra khi thread cố gắng ghi vào một đường ống bị đứt (broken pipe); hoặc
  - Nó được gửi bằng cách sử dụng `pthread_kill()` hoặc `pthread_sigqueue()`, đây là các hàm (được mô tả trong [Mục 33.2.3](#page-67-0)) cho phép một thread gửi tín hiệu cho một thread khác trong cùng một tiến trình.

Tất cả các tín hiệu được sinh ra bởi các cơ chế khác đều mang tính toàn tiến trình (process-directed). Ví dụ như các tín hiệu được gửi từ một tiến trình khác bằng cách sử dụng `kill()` hoặc `sigqueue()`; các tín hiệu như `SIGINT` và `SIGTSTP`, được sinh ra khi người dùng gõ một trong các ký tự đặc biệt trên terminal tạo ra tín hiệu; và các tín hiệu được sinh ra cho các sự kiện phần mềm như thay đổi kích thước cửa sổ terminal (`SIGWINCH`) hoặc bộ định thời hết hạn (ví dụ: `SIGALRM`).

- Khi một tín hiệu được gửi đến một tiến trình đa luồng (multithreaded process) đã thiết lập một trình xử lý tín hiệu (signal handler), kernel sẽ chọn một cách tùy ý một thread trong tiến trình để gửi tín hiệu đến và gọi trình xử lý trong thread đó. Hành vi này nhất quán với việc duy trì ngữ nghĩa tín hiệu truyền thống. Sẽ là vô lý nếu một tiến trình thực hiện các hành động xử lý tín hiệu nhiều lần để đáp ứng lại một tín hiệu duy nhất.
- Mặt nạ tín hiệu (signal mask) là dành riêng cho từng thread (per-thread). (Không có khái niệm mặt nạ tín hiệu toàn tiến trình chi phối tất cả các thread trong một tiến trình đa luồng.) Các thread có thể độc lập chặn (block) hoặc bỏ chặn (unblock) các tín hiệu khác nhau bằng cách sử dụng `pthread_sigmask()`, một hàm mới được định nghĩa bởi Pthreads API. Bằng cách thao tác trên mặt nạ tín hiệu của từng thread, một ứng dụng có thể kiểm soát thread nào có thể xử lý một tín hiệu được hướng tới toàn bộ tiến trình.
- Kernel duy trì một bản ghi về các tín hiệu đang chờ xử lý (pending) cho toàn bộ tiến trình, cũng như một bản ghi về các tín hiệu đang chờ xử lý cho từng thread. Một lời gọi đến `sigpending()` trả về hợp của tập hợp các tín hiệu đang chờ xử lý của tiến trình và các tín hiệu đang chờ xử lý của thread gọi hàm. Trong một thread mới được tạo, tập hợp các tín hiệu đang chờ xử lý ban đầu là trống. Một tín hiệu hướng-đến-thread chỉ có thể được gửi đến thread đích. Nếu thread đang chặn tín hiệu đó, nó sẽ tiếp tục ở trạng thái chờ xử lý cho đến khi thread đó bỏ chặn tín hiệu (hoặc kết thúc).
- Nếu một trình xử lý tín hiệu làm gián đoạn một lời gọi đến `pthread_mutex_lock()`, thì lời gọi đó luôn tự động được khởi động lại. Nếu một trình xử lý tín hiệu làm gián đoạn một lời gọi đến `pthread_cond_wait()`, thì lời gọi đó hoặc sẽ được tự động khởi động lại (đây là điều Linux làm) hoặc trả về 0, cho biết một sự đánh thức giả mạo (spurious wake-up) (trong trường hợp này, một ứng dụng được thiết kế tốt sẽ kiểm tra lại điều kiện tương ứng và khởi động lại lời gọi, như được mô tả trong [Mục 30.2.3](#page-30-0)). SUSv3 yêu cầu hai hàm này phải hoạt động như được mô tả ở đây.
- Ngăn xếp tín hiệu thay thế (alternate signal stack) là dành riêng cho từng thread (tham khảo mô tả về `sigaltstack()` trong Mục 21.3). Một thread mới được tạo không kế thừa ngăn xếp tín hiệu thay thế từ tiến trình/thread tạo ra nó.

Chính xác hơn, SUSv3 quy định rằng có một ngăn xếp tín hiệu thay thế riêng biệt cho mỗi thực thể lập lịch của kernel (Kernel Scheduling Entity - KSE). Trên một hệ thống có mô hình cài đặt thread 1:1, như trên Linux, có một KSE cho mỗi thread (xem [Mục 33.4](#page-70-0)).

### 33.2.2 Thao tác với Mặt nạ Tín hiệu của Luồng (Thread Signal Mask)

Khi một luồng (thread) mới được tạo, nó sẽ kế thừa một bản sao mặt nạ tín hiệu (signal mask) của luồng đã tạo ra nó. Một luồng có thể sử dụng hàm `pthread_sigmask()` để thay đổi mặt nạ tín hiệu của chính nó, để lấy mặt nạ hiện tại, hoặc thực hiện cả hai việc.

```
## include <signal.h>
int pthread_sigmask(int how, const sigset_t *set, sigset_t *oldset);
                       Trả về 0 khi thành công, hoặc một số lỗi dương khi thất bại
```

Ngoại trừ việc nó thao tác trên mặt nạ tín hiệu của luồng, cách sử dụng của `pthread_sigmask()` hoàn toàn giống với `sigprocmask()` (Mục 20.10).

> SUSv3 lưu ý rằng việc sử dụng `sigprocmask()` trong một chương trình đa luồng (multithreaded program) là không được xác định (unspecified). Chúng ta không thể sử dụng `sigprocmask()` một cách có tính di động (portably) trong một chương trình đa luồng. Trên thực tế, `sigprocmask()` và `pthread_sigmask()` là giống hệt nhau trên nhiều hệ thống cài đặt (implementation), bao gồm cả Linux.

### 33.2.3 Gửi Tín hiệu đến một Luồng

Hàm `pthread_kill()` gửi tín hiệu `sig` đến một luồng khác trong cùng tiến trình (process). Luồng đích được xác định bởi tham số `thread`.

```
## include <signal.h>
int pthread_kill(pthread_t thread, int sig);
                        Trả về 0 khi thành công, hoặc một số lỗi dương khi thất bại
```

Vì ID của luồng (thread ID) chỉ được đảm bảo là duy nhất trong phạm vi một tiến trình (xem Mục [29.5](#page-7-1)), chúng ta không thể sử dụng `pthread_kill()` để gửi tín hiệu đến một luồng trong tiến trình khác.

> Hàm `pthread_kill()` được cài đặt bằng cách sử dụng System Call đặc trưng của Linux là `tgkill(tgid, tid, sig)`, hàm này gửi tín hiệu `sig` đến luồng được xác định bởi `tid` (một ID luồng kernel có kiểu trả về bởi `gettid()`) nằm trong nhóm luồng (thread group) được xác định bởi `tgid`. Xem trang hướng dẫn (manual page) `tgkill(2)` để biết thêm chi tiết.

Hàm `pthread_sigqueue()` đặc trưng của Linux kết hợp tính năng của `pthread_kill()` và `sigqueue()` (Mục 22.8.1): nó gửi một tín hiệu kèm theo dữ liệu đến một luồng khác trong cùng tiến trình.

```
## define _GNU_SOURCE
## include <signal.h>
int pthread_sigqueue(pthread_t thread, int sig, const union sigval value);
                       Trả về 0 khi thành công, hoặc một số lỗi dương khi thất bại
```

Tương tự như `pthread_kill()`, `sig` chỉ định tín hiệu cần gửi, và `thread` xác định luồng đích. Tham số `value` chỉ định dữ liệu đi kèm với tín hiệu, và được sử dụng theo cách tương tự như tham số tương đương của `sigqueue()`.

> Hàm `pthread_sigqueue()` được thêm vào glibc từ phiên bản 2.11 và yêu cầu sự hỗ trợ từ kernel. Hỗ trợ này được cung cấp bởi System Call `rt_tgsigqueueinfo()`, được thêm vào từ Linux 2.6.31.

### 33.2.4 Xử lý Tín hiệu Bất đồng bộ một cách Hợp lý

Trong các Chương từ 20 đến 22, chúng ta đã thảo luận về các yếu tố khác nhau—chẳng hạn như các vấn đề về tính khả nhập (reentrancy issues), sự cần thiết phải khởi động lại các System Call bị gián đoạn, và việc tránh tình trạng Race Condition—những yếu tố có thể làm cho việc xử lý các tín hiệu được tạo ra một cách bất đồng bộ (asynchronously generated signals) thông qua trình xử lý tín hiệu (signal handler) trở nên phức tạp. Hơn nữa, không có hàm nào trong Pthreads API nằm trong tập hợp các hàm an toàn với tín hiệu bất đồng bộ (async-signal-safe functions) mà chúng ta có thể gọi một cách an toàn từ bên trong một signal handler (Mục 21.1.2). Vì những lý do này, các chương trình đa luồng (multithreaded programs) phải xử lý các tín hiệu được tạo ra bất đồng bộ nhìn chung không nên sử dụng signal handler làm cơ chế để nhận thông báo về việc phân phối tín hiệu (signal delivery). Thay vào đó, phương pháp được ưu tiên là:

- Tất cả các luồng (thread) đều chặn (block) tất cả các tín hiệu bất đồng bộ mà tiến trình (process) có thể nhận được. Cách đơn giản nhất để làm điều này là chặn các tín hiệu trong luồng chính (main thread) trước khi bất kỳ luồng nào khác được tạo. Mỗi luồng được tạo sau đó sẽ kế thừa một bản sao mặt nạ tín hiệu (signal mask) của luồng chính.
- Tạo một luồng chuyên dụng duy nhất (dedicated thread) để chấp nhận các tín hiệu đến bằng cách sử dụng `sigwaitinfo()`, `sigtimedwait()`, hoặc `sigwait()`. Chúng ta đã mô tả `sigwaitinfo()` và `sigtimedwait()` trong Mục 22.10. Chúng ta sẽ mô tả `sigwait()` dưới đây.

Ưu điểm của phương pháp này là các tín hiệu được tạo ra bất đồng bộ sẽ được nhận một cách đồng bộ (synchronously). Khi chấp nhận các tín hiệu đến, luồng chuyên dụng có thể sửa đổi các biến được chia sẻ một cách an toàn (dưới sự kiểm soát của mutex) và gọi các hàm không an toàn với tín hiệu bất đồng bộ (non-async-signal-safe functions). Nó cũng có thể phát tín hiệu cho các biến điều kiện (condition variables), và sử dụng các cơ chế giao tiếp và đồng bộ hóa luồng (thread) và tiến trình (process) khác.

Hàm `sigwait()` đợi việc phân phối một trong các tín hiệu nằm trong tập tín hiệu (signal set) do `set` trỏ tới, chấp nhận tín hiệu đó, và trả về số hiệu tín hiệu trong `sig`.

```
## include <signal.h>
int sigwait(const sigset_t *set, int *sig);
                      Trả về 0 khi thành công, hoặc một số mã lỗi dương khi có lỗi
```

Hoạt động của `sigwait()` giống với `sigwaitinfo()`, ngoại trừ việc:

- thay vì trả về cấu trúc `siginfo_t` mô tả tín hiệu, `sigwait()` chỉ trả về số hiệu tín hiệu; và
- giá trị trả về nhất quán với các hàm liên quan đến luồng khác (thay vì giá trị 0 hoặc –1 được trả về bởi các System Call truyền thống của UNIX).

Nếu có nhiều luồng cùng đợi một tín hiệu bằng `sigwait()`, chỉ có một luồng thực sự nhận được tín hiệu khi nó đến. Luồng nào trong số đó nhận được tín hiệu là điều không thể xác định trước (indeterminate).

## 33.3 Luồng và Điều khiển Tiến trình (Process Control)

Giống như cơ chế tín hiệu, `exec()`, `fork()`, và `exit()` ra đời trước Pthreads API. Trong các đoạn văn sau đây, chúng ta sẽ lưu ý một số chi tiết liên quan đến việc sử dụng các System Call này trong các chương trình có sử dụng luồng.

### Threads và exec()

Khi bất kỳ thread nào gọi một trong các hàm `exec()`, chương trình gọi sẽ bị thay thế hoàn toàn. Tất cả các thread, ngoại trừ thread gọi `exec()`, sẽ biến mất ngay lập tức. Không có thread nào thực thi hàm hủy (destructor) cho dữ liệu đặc thù của thread (thread-specific data) hoặc gọi các trình xử lý dọn dẹp (cleanup handler). Tất cả các mutex (process-private mutex) và biến điều kiện (condition variable) thuộc về tiến trình (Process) cũng biến mất. Sau lệnh `exec()`, định danh thread (thread ID) của thread còn lại là không xác định (unspecified).

## Threads và fork()

Khi một tiến trình đa luồng (multithreaded process) gọi `fork()`, chỉ có thread gọi được nhân bản trong tiến trình con (child process). (Định danh của thread trong tiến trình con giống với định danh của thread đã gọi `fork()` trong tiến trình cha - parent). Tất cả các thread khác đều biến mất trong tiến trình con; không có hàm hủy dữ liệu đặc thù của thread hoặc trình xử lý dọn dẹp nào được thực thi cho các thread đó. Điều này có thể dẫn đến nhiều vấn đề khác nhau:

- Mặc dù chỉ có thread gọi được nhân bản trong tiến trình con, trạng thái của các biến toàn cục (global variable), cũng như tất cả các đối tượng Pthreads như mutex và biến điều kiện, vẫn được bảo toàn trong tiến trình con. (Điều này xảy ra vì các đối tượng Pthreads này được cấp phát trong vùng nhớ của tiến trình cha, và tiến trình con nhận được một bản sao của vùng nhớ đó). Điều này có thể dẫn đến các kịch bản phức tạp. Ví dụ, giả sử một thread khác đã khóa (lock) một mutex tại thời điểm gọi `fork()` và đang cập nhật dang dở một cấu trúc dữ liệu toàn cục. Trong trường hợp này, thread trong tiến trình con sẽ không thể mở khóa mutex (vì nó không phải là chủ sở hữu - owner của mutex) và sẽ bị chặn (block) nếu nó cố gắng chiếm quyền sở hữu mutex đó. Hơn nữa, bản sao của cấu trúc dữ liệu toàn cục trong tiến trình con có thể đang ở trạng thái không nhất quán (inconsistent state), bởi vì thread đang cập nhật nó đã biến mất giữa chừng quá trình cập nhật.
- Vì các hàm hủy dữ liệu đặc thù của thread và các trình xử lý dọn dẹp không được gọi, việc gọi `fork()` trong một chương trình đa luồng có thể gây ra hiện tượng rò rỉ bộ nhớ (memory leak) trong tiến trình con. Hơn nữa, các mục dữ liệu đặc thù của thread được tạo bởi các thread khác có khả năng không thể truy cập được đối với thread trong tiến trình con mới, vì nó không có các con trỏ trỏ đến các mục này.

Do những vấn đề này, khuyến nghị thông thường là việc sử dụng duy nhất hàm `fork()` trong một tiến trình đa luồng nên là việc được tiếp nối ngay lập tức bằng một lệnh `exec()`. Lệnh `exec()` làm cho tất cả các đối tượng Pthreads trong tiến trình con biến mất khi chương trình mới ghi đè lên bộ nhớ của tiến trình.

Đối với các chương trình bắt buộc phải sử dụng `fork()` mà không có `exec()` đi kèm, Pthreads API cung cấp một cơ chế để định nghĩa các trình xử lý fork (fork handler). Các fork handler được thiết lập bằng cách sử dụng lời gọi `pthread_atfork()` theo dạng sau:

```c
pthread_atfork(prepare_func, parent_func, child_func);
```

Mỗi lời gọi `pthread_atfork()` sẽ thêm `prepare_func` vào danh sách các hàm sẽ được tự động thực thi (theo thứ tự ngược lại với thứ tự đăng ký) trước khi tiến trình con mới được tạo ra khi `fork()` được gọi. Tương tự, `parent_func` và `child_func` được thêm vào danh sách các hàm sẽ được gọi tự động (theo đúng thứ tự đăng ký), lần lượt trong tiến trình cha và tiến trình con, ngay trước khi `fork()` trả về.

Các fork handler đôi khi rất hữu ích cho mã thư viện (library code) có sử dụng các thread. Nếu không có fork handler, thư viện sẽ không có cách nào xử lý các ứng dụng sử dụng thư viện một cách ngây thơ và gọi `fork()`, mà không hề hay biết rằng thư viện đã tạo ra một số thread.

Tiến trình con được tạo ra bởi `fork()` kế thừa các fork handler từ thread đã gọi `fork()`. Trong quá trình thực hiện `exec()`, các fork handler không được bảo toàn (chúng không thể được bảo toàn vì mã của các handler bị ghi đè trong quá trình thực hiện `exec()`).

Các chi tiết bổ sung về fork handler và các ví dụ về cách sử dụng chúng có thể được tìm thấy trong [Butenhof, 1996].

> [!NOTE]
> Trên Linux, các fork handler không được gọi nếu một chương trình sử dụng thư viện luồng NPTL gọi `vfork()`. Tuy nhiên, trong một chương trình sử dụng LinuxThreads, các fork handler sẽ được gọi trong trường hợp này.

### Threads và exit()

Nếu bất kỳ thread nào gọi `exit()` hoặc tương đương là thread chính thực hiện lệnh `return`, tất cả các thread sẽ biến mất ngay lập tức; không có hàm hủy dữ liệu đặc thù của thread hoặc trình xử lý dọn dẹp nào được thực thi.

## 33.4 Các Mô hình Triển khai Thread

Trong phần này, chúng ta đi sâu vào một số lý thuyết, xem xét ngắn gọn ba mô hình khác nhau để triển khai một API thread. Điều này cung cấp nền tảng hữu ích cho Mục [33.5,](#page-72-1) nơi chúng ta xem xét các triển khai thread của Linux. Sự khác biệt giữa các mô hình triển khai này xoay quanh cách các thread được ánh xạ (map) vào các thực thể lập lịch của kernel (KSE - kernel scheduling entities), đây là các đơn vị mà kernel phân bổ CPU và các tài nguyên hệ thống khác. (Trong các triển khai UNIX truyền thống có trước thread, thuật ngữ thực thể lập lịch của kernel đồng nghĩa với thuật ngữ process).

### Triển khai Nhiều-trên-một (Many-to-one - M:1) (thread mức người dùng)

Trong các triển khai thread M:1, toàn bộ chi tiết về việc tạo thread, lập lịch và đồng bộ hóa (khóa mutex, chờ trên các biến điều kiện, v.v.) được xử lý hoàn toàn bên trong process bởi một thư viện thread ở không gian người dùng (user-space). Kernel hoàn toàn không biết gì về sự tồn tại của nhiều thread bên trong process đó.

Các triển khai M:1 có một số ưu điểm. Ưu điểm lớn nhất là nhiều thao tác thread — ví dụ: tạo và hủy thread, chuyển đổi ngữ cảnh (context switch) giữa các thread, và các thao tác mutex, biến điều kiện — diễn ra nhanh chóng, vì không cần phải chuyển đổi sang chế độ kernel (kernel mode). Hơn nữa, vì không cần sự hỗ trợ của kernel cho thư viện thread, nên việc triển khai M:1 có thể đượcported (chuyển đổi nền tảng) tương đối dễ dàng từ hệ thống này sang hệ thống khác.

Tuy nhiên, các triển khai M:1 lại gặp phải một số nhược điểm nghiêm trọng:

- Khi một thread thực hiện một System Call chẳng hạn như `read()`, quyền điều khiển sẽ chuyển từ thư viện thread ở không gian người dùng sang kernel. Điều này có nghĩa là nếu lệnh gọi `read()` bị chặn (block), thì tất cả các thread trong process đó đều bị chặn.
- Kernel không thể lập lịch cho các thread của một process. Vì kernel không nhận thức được sự tồn tại của nhiều thread bên trong process, nên nó không thể lập lịch cho các thread riêng biệt lên các bộ xử lý khác nhau trên phần cứng đa xử lý (multiprocessor hardware). Cũng không thể gán một cách có ý nghĩa một thread trong process này có độ ưu tiên cao hơn thread trong process khác, vì việc lập lịch các thread được xử lý hoàn toàn bên trong process.

## Triển khai Một-trên-một (One-to-one - 1:1) (thread mức kernel)

Trong triển khai thread 1:1, mỗi thread ánh xạ tới một KSE riêng biệt. Kernel xử lý việc lập lịch của từng thread một cách riêng biệt. Các thao tác đồng bộ hóa thread được triển khai bằng các System Call vào kernel.

Các triển khai 1:1 loại bỏ các nhược điểm mà các triển khai M:1 gặp phải. Một System Call bị chặn không làm tất cả các thread trong process bị chặn, và kernel có thể lập lịch các thread của một process lên các CPU khác nhau trên phần cứng đa xử lý.

Tuy nhiên, các thao tác như tạo thread, chuyển đổi ngữ cảnh (context switch) và đồng bộ hóa sẽ chậm hơn trên mô hình triển khai 1:1, vì cần phải chuyển đổi sang chế độ kernel. Hơn nữa, chi phí chung (overhead) cần thiết để duy trì một KSE riêng biệt cho mỗi thread trong một ứng dụng chứa số lượng lớn thread có thể đặt một tải trọng đáng kể lên bộ lập lịch của kernel (kernel scheduler), làm giảm hiệu năng tổng thể của hệ thống.

Bất chấp những nhược điểm này, việc triển khai 1:1 thường được ưu tiên hơn so với triển khai M:1. Cả hai triển khai thread của Linux — LinuxThreads và NPTL — đều áp dụng mô hình 1:1.

> Trong quá trình phát triển NPTL, nỗ lực đáng kể đã được đầu tư vào việc viết lại bộ lập lịch của kernel và thiết kế một mô hình triển khai thread cho phép thực thi hiệu quả các process đa luồng (multithreaded process) chứa nhiều hàng nghìn thread. Các thử nghiệm tiếp theo cho thấy mục tiêu này đã đạt được.

## Các cài đặt nhiều-nhiều (M:N) (mô hình hai cấp)

Các cài đặt M:N nhằm mục đích kết hợp các ưu điểm của mô hình 1:1 và M:1, đồng thời loại bỏ các nhược điểm của chúng.

Trong mô hình M:N, mỗi tiến trình (process) có thể liên kết với nhiều thực thể KSE (Kernel Scheduling Entity), và một số luồng (thread) có thể ánh xạ tới mỗi KSE. Thiết kế này cho phép kernel phân phối các luồng của một ứng dụng trên nhiều CPU, đồng thời loại bỏ các vấn đề tiềm ẩn về khả năng mở rộng (scaling) liên quan đến các ứng dụng sử dụng số lượng lớn luồng.

Nhược điểm đáng kể nhất của mô hình M:N là độ phức tạp. Nhiệm vụ lập lịch luồng (thread scheduling) được chia sẻ giữa kernel và thư viện luồng ở không gian người dùng (user-space threading library), các thành phần này phải hợp tác và trao đổi thông tin với nhau. Việc quản lý tín hiệu (signal) theo các yêu cầu của chuẩn SUSv3 cũng rất phức tạp trong mô hình cài đặt M:N.

> Một cài đặt M:N ban đầu đã được cân nhắc cho thư viện luồng NPTL, nhưng sau đó đã bị loại bỏ vì đòi hỏi những thay đổi đối với kernel quá rộng và có lẽ không cần thiết, do khả năng mở rộng tốt của bộ lập lịch Linux (Linux scheduler), ngay cả khi phải xử lý số lượng lớn các KSE.

## 33.5 Các cài đặt POSIX Threads trên Linux

Linux có hai cài đặt chính của Pthreads API:

- LinuxThreads: Đây là cài đặt luồng ban đầu của Linux, do Xavier Leroy phát triển.
- NPTL (Native POSIX Threads Library): Đây là cài đặt luồng hiện đại trên Linux, do Ulrich Drepper và Ingo Molnar phát triển nhằm kế thừa LinuxThreads. NPTL cung cấp hiệu năng vượt trội hơn so com với LinuxThreads và tuân thủ chặt chẽ hơn đặc tả SUSv3 dành cho Pthreads. Việc hỗ trợ NPTL đòi hỏi những thay đổi đối với kernel và những thay đổi này xuất hiện từ phiên bản Linux 2.6.

Trong một khoảng thời gian, tưởng chừng như người kế nhiệm của LinuxThreads sẽ là một cài đặt khác mang tên Next Generation POSIX Threads (NGPT) — một thư viện luồng được phát triển tại IBM. NGPT áp dụng thiết kế M:N và đạt hiệu năng cao hơn đáng kể so với LinuxThreads. Tuy nhiên, các nhà phát triển NPTL đã quyết định theo đuổi một cài đặt mới. Cách tiếp cận này đã được chứng minh là đúng đắn — NPTL với thiết kế 1:1 cho thấy hiệu năng vượt trội hơn so với NGPT. Sau khi NPTL được phát hành, việc phát triển NGPT đã bị dừng lại.

Trong các phần tiếp theo, chúng ta sẽ xem xét chi tiết hơn về hai cài đặt này, đồng thời lưu ý các điểm mà chúng đi lệch so với các yêu cầu của SUSv3 đối với Pthreads.

Tại thời điểm này, cần nhấn mạnh rằng cài đặt LinuxThreads hiện đã lỗi thời (obsolete); nó không còn được hỗ trợ trong glibc phiên bản 2.4 trở về sau. Toàn bộ quá trình phát triển thư viện luồng mới hiện nay chỉ diễn ra trên NPTL.

### 33.5.1 LinuxThreads

Trong nhiều năm, LinuxThreads là cơ chế thực thi luồng (threading implementation) chính trên Linux, và nó đủ dùng để triển khai nhiều ứng dụng đa luồng (threaded application) khác nhau. Các điểm cốt lõi của việc triển khai LinuxThreads như sau:

Các tiến trình nhẹ (Thread) được tạo ra bằng cách sử dụng lệnh gọi `clone()` với việc chỉ định các cờ (flag) sau:

```
CLONE_VM | CLONE_FILES | CLONE_FS | CLONE_SIGHAND
```

Điều này có nghĩa là các luồng trong LinuxThreads chia sẻ bộ nhớ ảo (virtual memory), bộ mô tả tệp (file descriptor), thông tin liên quan đến hệ thống tệp (umask, thư mục gốc và thư mục làm việc hiện tại), và trạng thái xử lý tín hiệu (signal disposition). Tuy nhiên, các luồng không chia sẻ định danh tiến trình (Process ID - PID) và định danh tiến trình cha (Parent Process ID - PPID).

- Ngoài các luồng do ứng dụng tạo ra, LinuxThreads còn tạo thêm một luồng "quản lý" (manager thread) chịu trách nhiệm xử lý việc tạo và hủy luồng.
- Cơ chế thực thi này sử dụng các tín hiệu (signal) cho hoạt động nội bộ của nó. Với các kernel hỗ trợ tín hiệu thời gian thực (realtime signal) từ Linux 2.2 trở đi, ba tín hiệu thời gian thực đầu tiên sẽ được sử dụng. Với các kernel cũ hơn, `SIGUSR1` và `SIGUSR2` được sử dụng. Các ứng dụng không được phép sử dụng các tín hiệu này. (Việc sử dụng các tín hiệu này dẫn đến độ trễ cao cho các thao tác đồng bộ hóa luồng (thread synchronization) khác nhau.)

## Những điểm khác biệt của LinuxThreads so với hành vi được định nghĩa chuẩn

LinuxThreads không tuân thủ đặc tả SUSv3 cho Pthreads ở một số điểm. (Việc triển khai LinuxThreads bị giới hạn bởi các tính năng của nhân hệ thống - kernel available tại thời điểm nó được phát triển; nó tuân thủ ở mức tối đa có thể trong những giới hạn đó). Danh sách sau đây tóm tắt những điểm không tương thích:

- Các lời gọi đến `getpid()` trả về một giá trị khác nhau ở mỗi luồng của một tiến trình. Các lời gọi đến `getppid()` phản ánh thực tế là mọi luồng khác luồng chính đều được tạo bởi luồng quản lý của tiến trình (nghĩa là `getppid()` trả về PID của luồng quản lý). Các lời gọi đến `getppid()` trong các luồng khác đáng lẽ phải trả về giá trị giống như lời gọi `getppid()` trong luồng chính.
- Nếu một luồng tạo ra một tiến trình con bằng cách sử dụng `fork()`, thì bất kỳ luồng nào khác cũng phải có khả năng lấy được trạng thái kết thúc của tiến trình con đó bằng cách sử dụng `wait()` (hoặc tương tự). Tuy nhiên, thực tế không phải vậy; chỉ có luồng tạo ra tiến trình con mới có thể gọi `wait()` cho tiến trình đó.
- Nếu một luồng gọi `exec()`, thì theo yêu cầu của SUSv3, tất cả các luồng khác sẽ bị chấm dứt. Tuy nhiên, nếu `exec()` được thực hiện từ bất kỳ luồng nào khác ngoài luồng chính, thì tiến trình kết quả sẽ có PID giống như luồng gọi — nghĩa là PID khác với PID của luồng chính. Theo SUSv3, PID phải giống với PID của luồng chính.
- Các luồng không chia sẻ thông tin xác thực (credentials) (ID người dùng và ID nhóm - user và group IDs). Khi một tiến trình đa luồng (multithreaded process) đang thực thi một chương trình set-user-ID, điều này có thể dẫn đến các kịch bản mà một luồng không thể gửi tín hiệu đến luồng khác bằng cách sử dụng `pthread_kill()`, bởi vì thông tin xác thực của hai luồng đã thay đổi theo cách mà luồng gửi không còn quyền gửi tín hiệu đến luồng đích (tham khảo Hình 20-2, trang 403). Hơn nữa, vì việc triển khai LinuxThreads sử dụng tín hiệu nội bộ, nên các thao tác Pthreads khác nhau có thể thất bại hoặc bị treo (hang) nếu một luồng thay đổi thông tin xác thực của nó.
- Các khía cạnh khác nhau của đặc tả SUSv3 đối với sự tương tác giữa luồng và tín hiệu không được tuân thủ:
  - Một tín hiệu được gửi đến một tiến trình bằng cách sử dụng `kill()` hoặc `sigqueue()` cần phải được chuyển đến và xử lý bởi một luồng bất kỳ trong tiến trình đích không đang chặn tín hiệu đó. Tuy nhiên, vì các luồng của LinuxThreads có PID khác nhau, một tín hiệu chỉ có thể được nhắm mục tiêu đến một luồng cụ thể. Nếu luồng đó đang chặn tín hiệu, tín hiệu sẽ vẫn ở trạng thái chờ xử lý (pending), ngay cả khi có các luồng khác không chặn tín hiệu đó.

- LinuxThreads không hỗ trợ khái niệm tín hiệu đang chờ xử lý cho toàn bộ tiến trình; chỉ có các tín hiệu đang chờ xử lý cho từng luồng riêng biệt (per-thread pending signals) được hỗ trợ.
- Nếu một tín hiệu được hướng tới một nhóm tiến trình (process group) chứa một ứng dụng đa luồng, thì tín hiệu đó sẽ được xử lý bởi tất cả các luồng trong ứng dụng (nghĩa là tất cả các luồng đã thiết lập trình xử lý tín hiệu - signal handler), thay vì chỉ bởi một luồng đơn lẻ (bất kỳ). Ví dụ, một tín hiệu như vậy có thể được tạo ra bằng cách gõ một trong các ký tự trên thiết bị đầu cuối (terminal) tạo ra tín hiệu điều khiển công việc (job-control signal) cho nhóm tiến trình nền trước (foreground process group).
- Các thiết lập ngăn xếp tín hiệu thay thế (alternate signal stack settings) (được thiết lập bởi `sigaltstack()`) là dành riêng cho từng luồng (per-thread). Tuy nhiên, vì một luồng mới kế thừa nhầm các thiết lập ngăn xếp tín hiệu thay thế từ luồng gọi `pthread_create()`, nên hai luồng này chia sẻ chung một ngăn xếp tín hiệu thay thế. SUSv3 yêu cầu một luồng mới phải bắt đầu mà không có ngăn xếp tín hiệu thay thế nào được định nghĩa. Hậu quả của việc LinuxThreads không tuân thủ này là nếu hai luồng vô tình xử lý đồng thời các tín hiệu khác nhau trên ngăn xếp tín hiệu thay thế được chia sẻ của chúng cùng một lúc, thảm họa rất dễ xảy ra (ví dụ: chương trình bị treo - crash). Vấn đề này có thể rất khó tái hiện và gỡ lỗi (debug), vì sự cố của nó phụ thuộc vào một sự kiện có lẽ rất hiếm hoi là hai tín hiệu được xử lý cùng một lúc.

Trong một chương trình sử dụng LinuxThreads, một thread mới có thể gọi hàm `sigaltstack()` để đảm bảo rằng nó sử dụng một alternate signal stack (ngăn xếp tín hiệu thay thế) khác với thread đã tạo ra nó (hoặc không dùng ngăn xếp nào cả). Tuy nhiên, các chương trình có tính di động (portable program) (và các hàm thư viện tạo thread) sẽ không biết phải làm điều này, vì đây không phải là yêu cầu trên các cài đặt (implementation) khác. Hơn nữa, ngay cả khi chúng ta áp dụng kỹ thuật này, vẫn có khả năng xảy ra race condition (tình trạng tranh chấp): thread mới có thể nhận và xử lý một tín hiệu trên ngăn xếp thay thế trước khi nó kịp gọi `sigaltstack()`.

- Các thread không chia sẻ chung một session ID (ID phiên) và process group ID (ID nhóm tiến trình). Các system call (lệnh gọi hệ thống) `setsid()` và `setpgid()` không thể được sử dụng để thay đổi session hoặc tư cách thành viên nhóm tiến trình của một tiến trình đa luồng (multithreaded process).
- Record lock (Khóa bản ghi) được thiết lập bằng `fcntl()` không được chia sẻ. Các yêu cầu khóa chồng chéo có cùng loại không được hợp nhất.
- Các thread không chia sẻ resource limit (giới hạn tài nguyên). SUSv3 quy định rằng giới hạn tài nguyên là thuộc tính áp dụng cho toàn bộ tiến trình (process-wide attribute).
- Thời gian CPU trả về bởi `times()` và thông tin sử dụng tài nguyên trả về bởi `getrusage()` là mang tính cục bộ cho từng thread (per-thread). Các system call này lẽ ra phải trả về tổng số liệu của toàn bộ tiến trình.
- Một số phiên bản của `ps(1)` hiển thị tất cả các thread trong một tiến trình (bao gồm cả thread quản lý - manager thread) dưới dạng các mục riêng biệt với các process ID khác nhau.
- Các thread không chia sẻ nice value (giá trị độ ưu tiên nice) được thiết lập bởi `setpriority()`.
- Interval timer (Bộ định thời khoảng) được tạo bằng `setitimer()` không được chia sẻ giữa các thread.
- Các thread không chia sẻ giá trị hoàn tác semaphore System V (`semadj`).

### Các vấn đề khác với LinuxThreads

Ngoài những điểm sai lệch so với SUSv3 nêu trên, việc cài đặt LinuxThreads còn gặp các vấn đề sau:

- Nếu thread quản lý (manager thread) bị tiêu diệt (killed), thì các thread còn lại phải được dọn dẹp (clean up) thủ công.
- Core dump của một chương trình đa luồng có thể không bao gồm tất cả các thread của tiến trình (hoặc thậm chí không bao gồm thread đã kích hoạt core dump).
- Thao tác `ioctl()` `TIOCNOTTY` phi tiêu chuẩn chỉ có thể gỡ bỏ mối liên kết của tiến trình với một terminal điều khiển (controlling terminal) khi được gọi từ thread chính (main thread).

### 33.5.2 NPTL

NPTL được thiết kế để khắc phục hầu hết các thiếu sót của LinuxThreads. Cụ thể:

- NPTL cung cấp mức độ tuân thủ đặc tả SUSv3 cho Pthreads cao hơn rất nhiều.
- Các ứng dụng sử dụng số lượng lớn thread có khả năng mở rộng (scale) tốt hơn rất nhiều dưới NPTL so với LinuxThreads.

NPTL cho phép một ứng dụng tạo ra số lượng lớn các thread. Các nhà phát triển NPTL đã có thể chạy các chương trình kiểm thử tạo ra 100.000 thread. Với LinuxThreads, giới hạn thực tế về số lượng thread chỉ là vài nghìn. (Thừa nhận rằng, rất ít ứng dụng cần số lượng thread lớn đến vậy).

Công việc triển khai NPTL bắt đầu vào năm 2002 và tiến triển trong khoảng năm tiếp theo sau đó. Song song đó, các thay đổi khác nhau đã được thực hiện bên trong Linux kernel để đáp ứng các yêu cầu của NPTL. Các thay đổi xuất hiện trong Linux kernel 2.6 nhằm hỗ trợ NPTL bao gồm:

- cải tiến việc cài đặt thread group (nhóm luồng) (Mục 28.2.1);
- bổ sung futex như một cơ chế đồng bộ hóa (synchronization mechanism) (futex là một cơ chế tổng quát không chỉ được thiết kế riêng cho NPTL);
- bổ sung các system call mới (`get_thread_area()` và `set_thread_area()`) để hỗ trợ thread-local storage (lưu trữ cục bộ của luồng);
- hỗ trợ core dump có phân luồng và gỡ lỗi (debugging) các tiến trình đa luồng;
- sửa đổi để hỗ trợ quản lý tín hiệu (signal) theo cách tương thích với mô hình Pthreads;
- bổ sung một system call `exit_group()` mới để chấm dứt (terminate) tất cả các thread trong một tiến trình (bắt đầu từ glibc 2.3, `_exit()`—và do đó hàm thư viện `exit()`—được ánh xạ như một wrapper gọi tới `exit_group()`, trong khi lệnh gọi `pthread_exit()` gọi system call `_exit()` thực sự trong kernel, vốn chỉ chấm dứt thread gọi nó);
- viết lại bộ lập lịch của kernel (kernel scheduler) để cho phép lập lịch hiệu quả cho số lượng rất lớn (nghĩa là hàng nghìn) KSE;

- cải thiện hiệu năng cho mã nguồn chấm dứt tiến trình của kernel; và
- mở rộng system call `clone()` (Mục 28.2).

Các yếu tố cốt lõi của việc cài đặt NPTL như sau:

Các thread được tạo bằng lệnh gọi `clone()` với các cờ (flag) sau:

```
CLONE_VM | CLONE_FILES | CLONE_FS | CLONE_SIGHAND |
CLONE_THREAD | CLONE_SETTLS | CLONE_PARENT_SETTID |
CLONE_CHILD_CLEARTID | CLONE_SYSVSEM
```

Các thread NPTL chia sẻ tất cả thông tin mà các thread trong LinuxThreads chia sẻ, và nhiều hơn thế nữa. Cờ `CLONE_THREAD` có nghĩa là một thread được đặt vào cùng một thread group với tiến trình tạo ra nó và chia sẻ chung process ID và parent process ID (ID tiến trình cha). Cờ `CLONE_SYSVSEM` có nghĩa là một thread chia sẻ các giá trị hoàn tác semaphore System V với tiến trình tạo ra nó.

> Khi chúng ta sử dụng `ps(1)` để liệt kê một tiến trình đa luồng đang chạy dưới NPTL, chúng ta chỉ thấy một dòng đầu ra duy nhất. Để xem thông tin về các thread bên trong một tiến trình, chúng ta có thể sử dụng tùy chọn `ps –L`.

Việc cài đặt sử dụng nội bộ hai realtime signal (tín hiệu thời gian thực) đầu tiên. Các ứng dụng không được phép sử dụng các tín hiệu này.

> Một trong những tín hiệu (signal) này được sử dụng để thực thi việc hủy thread (thread cancellation). Tín hiệu còn lại được sử dụng như một phần của kỹ thuật nhằm đảm bảo rằng tất cả các thread trong một tiến trình (process) có cùng ID người dùng (user ID) và ID nhóm (group ID). Kỹ thuật này là bắt buộc bởi vì, ở cấp độ kernel (kernel level), các thread có các thông tin xác thực (credential) về người dùng và nhóm hoàn toàn riêng biệt. Do đó, phần cài đặt NPTL thực hiện một số xử lý trong hàm bao (wrapper function) cho mỗi system call (System Call) có nhiệm vụ thay đổi ID người dùng và nhóm (như `setuid()`, `setresuid()`, v.v., và các hàm tương đương về nhóm) nhằm đồng bộ việc thay đổi ID này trên tất cả các thread của tiến trình.

Không giống như LinuxThreads, NPTL không sử dụng các thread quản lý (manager thread).

### Sự tuân thủ tiêu chuẩn của NPTL

Những thay đổi này đồng nghĩa với việc NPTL đạt mức độ tuân thủ SUSv3 sát sao hơn rất nhiều so với LinuxThreads. Tại thời điểm viết tài liệu này, điểm chưa tuân thủ sau đây vẫn tồn tại:

Các thread không chia sẻ giá trị nice (nice value).

Vẫn có một số điểm NPTL chưa tuân thủ bổ sung trong các phiên bản kernel 2.6.x đời đầu:

- Trong các kernel trước phiên bản 2.6.16, ngăn xếp tín hiệu thay thế (alternate signal stack) là độc lập trên mỗi thread (per-thread), nhưng một thread mới lại bị kế thừa nhầm các cấu hình ngăn xếp tín hiệu thay thế (được thiết lập bởi `sigaltstack()`) từ tiến trình gọi hàm `pthread_create()`, dẫn đến hậu quả là hai thread chia sẻ chung một ngăn xếp tín hiệu thay thế.
- Trong các kernel trước phiên bản 2.6.16, chỉ có thread dẫn đầu nhóm (thread group leader, tức là thread chính) mới có thể khởi tạo một phiên làm việc (session) mới bằng cách gọi `setsid()`.
- Trong các kernel trước phiên bản 2.6.16, chỉ có thread dẫn đầu nhóm mới có thể sử dụng `setpgid()` để biến tiến trình chủ thành một tiến trình dẫn đầu nhóm tiến trình (process group leader).

- Trong các kernel trước phiên bản 2.6.12, các bộ định thời khoảng thời gian (interval timer) được tạo bằng `setitimer()` không được chia sẻ giữa các thread của một tiến trình.
- Trong các kernel trước phiên bản 2.6.10, các thiết lập giới hạn tài nguyên (resource limit) không được chia sẻ giữa các thread của một tiến trình.
- Trong các kernel trước phiên bản 2.6.9, thời gian CPU trả về bởi hàm `times()` và thông tin sử dụng tài nguyên trả về bởi hàm `getrusage()` được tính theo từng thread (per-thread).

NPTL được thiết kế để tương thích ABI (ABI-compatible) với LinuxThreads. Điều này có nghĩa là các chương trình được liên kết (link) với thư viện GNU C cung cấp LinuxThreads không cần phải liên kết lại (relink) để sử dụng NPTL. Tuy nhiên, một số hành vi có thể thay đổi khi chương trình chạy với NPTL, chủ yếu là do NPTL bám sát hơn nữa vào đặc tả SUSv3 dành cho Pthreads.

### 33.5.3 Lựa Chọn Cơ Chế Threading Nào?

Một số bản phân phối Linux (Linux distribution) đi kèm với thư viện GNU C cung cấp cả LinuxThreads và NPTL, trong đó cơ chế mặc định được quyết định bởi bộ liên kết động (dynamic linker) dựa trên nền tảng kernel bên dưới mà hệ thống đang chạy. (Các bản phân phối này hiện đã mang tính lịch sử vì kể từ phiên bản 2.4, glibc không còn cung cấp LinuxThreads nữa). Do đó, đôi khi chúng ta cần phải giải đáp những câu hỏi sau:

- Cơ chế threading nào khả dụng trong một bản phân phối Linux cụ thể?
- Trên một bản phân phối Linux cung cấp cả LinuxThreads và NPTL, cơ chế nào được sử dụng mặc định, và làm thế nào chúng ta có thể chỉ định rõ ràng cơ chế sẽ được sử dụng bởi một chương trình?

## Khám phá cách triển khai luồng (threading implementation)

Chúng ta có thể sử dụng một số kỹ thuật để khám phá cách triển khai luồng (threading implementation) có sẵn trên một hệ thống cụ thể, hoặc để khám phá cách triển khai mặc định sẽ được sử dụng khi một chương trình chạy trên hệ thống hỗ trợ cả hai cách triển khai luồng.

Trên hệ thống cung cấp glibc phiên bản 2.3.2 trở lên, chúng ta có thể sử dụng lệnh sau để khám phá xem hệ thống cung cấp cách triển khai luồng nào, hoặc nếu hệ thống cung cấp cả hai, thì cách nào được sử dụng theo mặc định:

### \$ **getconf GNU\_LIBPTHREAD\_VERSION**

Trên hệ thống mà NPTL (Native POSIX Threads Library) là cách triển khai duy nhất hoặc mặc định, lệnh này sẽ hiển thị một chuỗi như sau:

NPTL 2.3.4

Kể từ glibc 2.3.2, một chương trình có thể lấy thông tin tương tự bằng cách sử dụng hàm `confstr(3)` để truy xuất giá trị của biến cấu hình `_CS_GNU_LIBPTHREAD_VERSION` đặc trưng cho glibc.

Trên các hệ thống sử dụng thư viện GNU C cũ hơn, chúng ta cần thực hiện thêm một vài thao tác. Đầu tiên, lệnh sau có thể được sử dụng để hiển thị đường dẫn (pathname) của thư viện GNU C được sử dụng khi chúng ta chạy một chương trình (ở đây, chúng ta sử dụng ví dụ về chương trình `ls` chuẩn, nằm tại `/bin/ls`):

```
$ ldd /bin/ls | grep libc.so
 libc.so.6 => /lib/tls/libc.so.6 (0x40050000)
```

Chúng ta sẽ bàn thêm một chút về chương trình `ldd` (liệt kê các liên kết động - list dynamic dependencies) trong Mục 41.5.

Đường dẫn của thư viện GNU C được hiển thị sau ký tự `=>`. Nếu chúng ta thực thi đường dẫn này như một lệnh, glibc sẽ hiển thị một loạt thông tin về chính nó. Chúng ta có thể lọc (grep) qua thông tin này để chọn ra dòng hiển thị cách triển khai luồng (threading implementation):

```
$ /lib/tls/libc.so.6 | egrep -i 'threads|nptl'
 Native POSIX Threads Library by Ulrich Drepper et al
```

Chúng ta đưa `nptl` vào biểu thức chính quy (regular expression) `egrep` bởi vì một số bản phát hành glibc chứa NPTL thay vào đó lại hiển thị một chuỗi như sau:

```
 NPTL 0.61 by Ulrich Drepper
```

Vì đường dẫn của glibc có thể khác nhau giữa các bản phân phối Linux (Linux distribution) này với bản phân phối khác, chúng ta có thể sử dụng tính năng thay thế lệnh của shell (shell command substitution) để tạo ra một dòng lệnh hiển thị cách triển khai luồng đang được sử dụng trên bất kỳ hệ thống Linux nào, như sau:

```
$ $(ldd /bin/ls | grep libc.so | awk '{print $3}') | egrep -i 'threads|nptl'
 Native POSIX Threads Library by Ulrich Drepper et al
```

### Chọn cách triển khai luồng được sử dụng bởi một chương trình

Trên hệ thống Linux cung cấp cả NPTL và LinuxThreads, việc có thể chủ động kiểm soát cách triển khai luồng nào được sử dụng đôi khi rất hữu ích. Ví dụ phổ biến nhất cho nhu cầu này là khi chúng ta có một chương trình cũ phụ thuộc vào một số hành vi (có lẽ không chuẩn) của LinuxThreads, do đó chúng ta muốn ép chương trình chạy với cách triển khai luồng đó thay vì sử dụng NPTL mặc định.

Vì mục đích này, chúng ta có thể sử dụng một biến môi trường (environment variable) đặc biệt được hiểu bởi trình liên kết động (dynamic linker): `LD_ASSUME_KERNEL`. Đúng như tên gọi của nó, biến môi trường này ra lệnh cho trình liên kết động hoạt động như thể nó đang chạy trên một phiên bản nhân Linux (Linux kernel) cụ thể. Bằng cách chỉ định một phiên bản nhân không hỗ trợ NPTL (ví dụ: 2.2.5), chúng ta có thể đảm bảo rằng LinuxThreads được sử dụng. Do đó, chúng ta có thể chạy một chương trình đa luồng (multithreaded program) với LinuxThreads bằng cách sử dụng lệnh sau:

```
$ LD_ASSUME_KERNEL=2.2.5 ./prog
```

Khi chúng ta kết hợp thiết lập biến môi trường này với lệnh đã mô tả trước đó để hiển thị cách triển khai luồng đang được sử dụng, chúng ta sẽ thấy kết quả đại loại như sau:

```
$ export LD_ASSUME_KERNEL=2.2.5
$ $(ldd /bin/ls | grep libc.so | awk '{print $3}') | egrep -i 'threads|nptl'
 linuxthreads-0.10 by Xavier Leroy
```

Phạm vi các số phiên bản nhân có thể được chỉ định trong `LD_ASSUME_KERNEL` phải tuân theo một số giới hạn nhất định. Trong một số bản phân phối phổ biến cung cấp cả NPTL và LinuxThreads, việc chỉ định số phiên bản là 2.2.5 là đủ để đảm bảo việc sử dụng LinuxThreads. Để có mô tả đầy đủ hơn về việc sử dụng biến môi trường này, hãy xem http://people.redhat.com/drepper/assumekernel.html.

## 33.6 Các tính năng nâng cao của Pthreads API

Một số tính năng nâng cao của Pthreads API bao gồm:

- Lịch trình thời gian thực (Realtime scheduling): Chúng ta có thể thiết lập các chính sách lập lịch (scheduling policies) và mức độ ưu tiên thời gian thực cho các luồng (thread). Điều này tương tự như các System Call lập lịch thời gian thực của tiến trình (process) được mô tả trong Mục 35.3.
- Mutex và biến điều kiện chia sẻ giữa các tiến trình (Process shared mutexes and condition variables): SUSv3 định nghĩa một tùy chọn cho phép các mutex và biến điều kiện (condition variable) được chia sẻ giữa các tiến trình (thay vì chỉ giữa các luồng của một tiến trình đơn lẻ). Trong trường hợp này, biến điều kiện hoặc mutex phải nằm trong một vùng nhớ được chia sẻ giữa các tiến trình. NPTL hỗ trợ tính năng này.
- Các nguyên thủy đồng bộ hóa luồng nâng cao (Advanced thread-synchronization primitives): Các cơ chế này bao gồm rào cản (barrier), khóa đọc-ghi (read-write lock) và khóa quay (spin lock).

Chi tiết hơn về tất cả các tính năng này có thể được tìm thấy trong [Butenhof, 1996].

## 33.7 Tổng kết

Luồng (thread) không tương thích tốt với tín hiệu (signal); các thiết kế ứng dụng đa luồng (multithreaded application) nên tránh sử dụng signal bất cứ khi nào có thể. Nếu một ứng dụng đa luồng bắt buộc phải xử lý các bất đồng bộ signal (asynchronous signal), cách sạch sẽ nhất thường là chặn signal ở tất cả các luồng, và chỉ định một luồng duy nhất chuyên trách tiếp nhận các signal đến bằng cách sử dụng `sigwait()` (hoặc tương tự). Luồng này sau đó có thể thực hiện các tác vụ một cách an toàn như sửa đổi các biến được chia sẻ (dưới sự kiểm soát của mutex) và gọi các hàm không an toàn với tín hiệu bất đồng bộ (non-async-signal-safe functions).

Có hai bản cài đặt luồng (threading implementation) thường có sẵn trên Linux: LinuxThreads và NPTL. LinuxThreads đã có mặt trên Linux trong nhiều năm, nhưng có một số điểm không tuân thủ các yêu cầu của SUSv3 và hiện đã lỗi thời. Bản cài đặt NPTL mới hơn cung cấp mức độ tuân thủ SUSv3 sát sao hơn cùng với hiệu năng vượt trội, và đây chính là bản cài đặt được cung cấp trong các bản phân phối Linux hiện đại.

### Thông tin bổ sung

Tham khảo các nguồn thông tin bổ sung được liệt kê trong Mục [29.10.](#page-12-0)

Tác giả của LinuxThreads đã tài liệu hóa việc cài đặt trên một trang web có thể tìm thấy tại http://pauillac.inria.fr/~xleroy/linuxthreads/. Bản cài đặt NPTL được mô tả bởi những người phát triển nó trong một bài báo (hiện đã hơi lỗi thời) có sẵn trực tuyến tại http://people.redhat.com/drepper/nptl-design.pdf.

## 33.8 Bài tập

- **33-1.** Viết một chương trình để chứng minh rằng các luồng khác nhau trong cùng một tiến trình có thể có các tập hợp tín hiệu đang chờ xử lý (pending signal) khác nhau, như được trả về bởi `sigpending()`. Bạn có thể thực hiện điều này bằng cách sử dụng `pthread_kill()` để gửi các signal khác nhau đến hai luồng khác nhau đã chặn các signal này, và sau đó cho mỗi luồng gọi `sigpending()` và hiển thị thông tin về các signal đang chờ xử lý. (Bạn có thể thấy các hàm trong Liệt kê 20-4 hữu ích.)
- **33-2.** Giả sử một luồng tạo ra một tiến trình con (child process) bằng cách sử dụng `fork()`. Khi tiến trình con chấm dứt, liệu có được đảm bảo rằng tín hiệu `SIGCHLD` kết quả sẽ được gửi đến luồng đã gọi `fork()` hay không (thay vì một luồng nào khác trong tiến trình)?
