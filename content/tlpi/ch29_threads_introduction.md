# Chương 29: LUỒNG (THREADS): GIỚI THIỆU

Trong chương này và một vài chương tiếp theo, chúng ta sẽ mô tả các luồng POSIX (POSIX threads), thường được gọi là Pthreads. Chúng ta sẽ không cố gắng bao quát toàn bộ API Pthreads vì nó khá lớn. Các nguồn tài liệu khác nhau để tìm hiểu thêm về luồng được liệt kê ở cuối chương này.

Các chương này chủ yếu mô tả hành vi tiêu chuẩn được quy định cho Pthreads API. Tại Mục [33.5](#page-72-0), chúng ta sẽ thảo luận về những điểm mà hai bản triển khai luồng chính trên Linux—LinuxThreads và Native POSIX Threads Library (NPTL)—chệch hướng khỏi tiêu chuẩn.

```

```

Trong chương này, chúng ta cung cấp một cái nhìn tổng quan về hoạt động của luồng (thread), sau đó xem xét cách các luồng được tạo ra (created) và cách chúng kết thúc (terminate). Kết luận chương là phần thảo luận về một số yếu tố có thể ảnh hưởng đến việc lựa chọn phương tiếp cận đa luồng (multithreaded) hay đa tiến trình (multiprocess) khi thiết kế một ứng dụng.

## 29.1 Tổng quan

Giống như các tiến trình (process), luồng là một cơ chế cho phép một ứng dụng thực hiện nhiều tác vụ đồng thời (concurrently). Một tiến trình đơn lẻ có thể chứa nhiều luồng, như minh họa trong [Hình 29-1](#page-1-0). Tất cả các luồng này đang thực thi độc lập cùng một chương trình, và tất cả chúng đều chia sẻ chung một vùng nhớ toàn cục (global memory), bao gồm các phân đoạn dữ liệu đã khởi tạo (initialized data), dữ liệu chưa khởi tạo (uninitialized data) và vùng nhớ heap (heap segments). (Một tiến trình UNIX truyền thống chỉ đơn giản là một trường hợp đặc biệt của tiến trình đa luồng; đó là một tiến trình chỉ chứa đúng một luồng).

Chúng ta đã đơn giản hóa một chút trong [Hình 29-1](#page-1-0). Cụ thể, vị trí của các ngăn xếp (stack) dành riêng cho từng luồng có thể đan xen với các thư viện chia sẻ (shared libraries) và các vùng nhớ chia sẻ (shared memory regions), tùy thuộc vào thứ tự tạo luồng, thứ tự nạp thư viện chia sẻ và thời điểm gắn kết (attach) vùng nhớ chia sẻ. Hơn nữa, vị trí của các ngăn xếp theo từng luồng này có thể thay đổi tùy theo từng bản phân phối (distribution) Linux.

Các luồng trong một tiến trình có thể thực thi đồng thời. Trên hệ thống đa bộ xử lý (multiprocessor system), nhiều luồng có thể thực thi song song (parallel). Nếu một luồng bị chặn (blocked) do I/O, các luồng khác vẫn đủ điều kiện để tiếp tục thực thi. (Mặc dù đôi khi việc tạo một luồng riêng biệt hoàn toàn cho mục đích thực hiện I/O là hữu ích, nhưng thường ưu tiên sử dụng một trong các mô hình I/O thay thế mà chúng ta mô tả ở Chương 63).

```text
Địa chỉ bộ nhớ ảo
    (thập lục phân)
                        ┌─────────────────────────────┐
    0xC0000000          │      argc, environ          │
                        ├─────────────────────────────┤
                        │  Stack cho luồng chính      │
                        ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ --┤
                        │            │                │
                        │            ▼                │
                        │                             │
                        │                             │
                        ├─────────────────────────────┤
                        │   Stack cho luồng 3         │
                        ├─────────────────────────────┤
                        │   Stack cho luồng 2         │
                        ├─────────────────────────────┤
                        │   Stack cho luồng 1         │
                        ├─────────────────────────────┤
    0x40000000          │   Thư viện chia sẻ,         │
TASK_UNMAPPED_BASE      │   bộ nhớ chia sẻ            │
                        │                             │
                        │                             │
                        │            ▲                │
                        ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ --┤
                        │          Heap               │
                        ├─────────────────────────────┤
                        │ Dữ liệu chưa khởi tạo (bss) │
                        ├─────────────────────────────┤
                        │    Dữ liệu đã khởi tạo      │
        ▲               │                             │◄── luồng 3 đang thực thi tại đây
        │               ├─────────────────────────────┤
        │               │                             │◄── luồng chính đang thực thi tại đây
        │               │   Text (mã chương trình)    │
địa chỉ ảo              │                             │◄── luồng 1 đang thực thi tại đây
tăng dần                │                             │
        │               ├─────────────────────────────┤◄── luồng 2 đang thực thi tại đây
        │               │                             │
                        │                             │
    0x08048000          ├─────────────────────────────┤
                        │                             │
    0x00000000          └─────────────────────────────┘
```

**Hình 29-1:** Bốn luồng đang thực thi trong một tiến trình (Linux/x86-32)

Các luồng mang lại nhiều ưu thế hơn so với tiến trình trong một số ứng dụng nhất định. Hãy xem xét phương pháp UNIX truyền thống để đạt được tính đồng thời bằng cách tạo ra nhiều tiến trình. Một ví dụ về điều này là thiết kế máy chủ mạng (network server) trong đó một tiến trình cha (parent process) chấp nhận các kết nối đến từ các client, sau đó sử dụng hàm `fork()` để tạo ra một tiến trình con (child process) riêng biệt nhằm xử lý giao tiếp với từng client (tham khảo Mục 60.3). Thiết kế như vậy giúp phục vụ đồng thời nhiều client. Mặc dù phương pháp này hoạt động tốt cho nhiều kịch bản, nó vẫn có những hạn chế sau trong một số ứng dụng:

- Việc chia sẻ thông tin giữa các tiến trình (process) gặp nhiều khó khăn. Vì tiến trình cha (parent) và tiến trình con (child) không chia sẻ bộ nhớ với nhau (ngoại trừ phân đoạn mã lệnh chỉ đọc - read-only text segment), chúng ta buộc phải sử dụng một số hình thức giao tiếp giữa các tiến trình (Interprocess Communication - IPC) để trao đổi thông tin.
- Việc tạo tiến trình bằng `fork()` tương đối tốn kém. Ngay cả với kỹ thuật sao chép khi ghi (copy-on-write) được mô tả trong Mục 24.2.2, nhu cầu phải nhân bản các thuộc tính khác nhau của tiến trình như bảng trang (page table) và bảng mô tả tệp (file descriptor table) đồng nghĩa với việc lệnh gọi `fork()` vẫn tiêu tốn nhiều thời gian.

### Threads giải quyết cả hai vấn đề này:

- Việc chia sẻ thông tin giữa các luồng (thread) diễn ra dễ dàng và nhanh chóng. Đó chỉ đơn giản là việc sao chép dữ liệu vào các biến chung (biến toàn cục hoặc vùng nhớ heap - global or heap variables). Tuy nhiên, để tránh các vấn đề có thể xảy ra khi nhiều luồng cố gắng cập nhật cùng một thông tin, chúng ta phải áp dụng các kỹ thuật đồng bộ hóa (synchronization techniques) được mô tả trong Chương [30.](#page-14-0)
- Việc tạo luồng nhanh hơn so với tạo tiến trình — thường nhanh hơn khoảng mười lần hoặc hơn thế. (Trên Linux, các luồng được hiện thực bằng cách sử dụng System Call `clone()`, và Bảng 28-3, ở trang 610, cho thấy sự khác biệt về tốc độ giữa `fork()` và `clone()`.) Việc tạo luồng nhanh hơn là do nhiều thuộc tính vốn phải được nhân bản trong tiến trình con được tạo bởi `fork()` thì nay được chia sẻ giữa các luồng. Cụ thể, việc nhân bản các trang nhớ theo cơ chế copy-on-write là không cần thiết, cũng như việc nhân bản bảng trang (page table).

Bên cạnh bộ nhớ toàn cục (global memory), các luồng cũng chia sẻ một số thuộc tính khác (tức là các thuộc tính này mang tính toàn cục đối với tiến trình, thay vì dành riêng cho từng luồng). Các thuộc tính này bao gồm:

- ID tiến trình (process ID) và ID tiến trình cha (parent process ID);
- ID nhóm tiến trình (process group ID) và ID phiên (session ID);
- terminal điều khiển (controlling terminal);
- thông tin xác thực tiến trình (ID người dùng và ID nhóm - user and group IDs);
- các mô tả tệp đang mở (open file descriptors);
- các khóa bản ghi (record locks) được tạo bằng `fcntl()`;
- cách xử lý tín hiệu (signal dispositions);
- thông tin liên quan đến hệ thống tệp (file system): `umask`, thư mục làm việc hiện tại (current working directory), và thư mục gốc (root directory);
- bộ định thời khoảng thời gian (interval timers - `setitimer()`) và bộ định thời POSIX (`timer_create()`);
- giá trị hoàn tác semaphore System V (semadj) (Mục 47.8);
- giới hạn tài nguyên (resource limits);
- thời gian CPU đã tiêu thụ (được trả về bởi `times()`);
- tài nguyên đã tiêu thụ (được trả về bởi `getrusage()`); và
- giá trị độ ưu tiên `nice` (được thiết lập bởi `setpriority()` và `nice()`).

Các thuộc tính riêng biệt cho từng luồng bao gồm:

- ID luồng (thread ID) (Mục [29.5\)](#page-7-0);
- mặt nạ tín hiệu (signal mask);
- dữ liệu riêng của luồng (thread-specific data) (Mục [31.3](#page-42-0));
- ngăn xếp tín hiệu thay thế (`sigaltstack()`);
- biến `errno`;
- môi trường dấu phẩy động (floating-point environment - xem `fenv(3)`);
- chính sách và mức ưu tiên lập lịch thời gian thực (realtime scheduling policy and priority) (Mục 35.2 và 35.3);
- ái lực CPU (CPU affinity - đặc trưng của Linux, được mô tả trong Mục 35.4);
- năng lực tiến trình/luồng (capabilities - đặc trưng của Linux, được mô tả trong Chương 39); và
- ngăn xếp - stack (các biến cục bộ và thông tin liên kết lệnh gọi hàm).

Như có thể thấy từ [Hình 29-1,](#page-1-0) tất cả các ngăn xếp (stack) của từng luồng đều nằm trong cùng một không gian địa chỉ ảo (virtual address space). Điều này có nghĩa là, với một con trỏ phù hợp, các luồng hoàn toàn có thể chia sẻ dữ liệu nằm trên ngăn xếp của nhau. Điều này đôi khi rất hữu ích, nhưng đòi hỏi phải lập trình cẩn thận để xử lý sự phụ thuộc phát sinh từ việc một biến cục bộ chỉ còn hiệu lực trong vòng đời của khung ngăn xếp (stack frame) mà nó cư trú. (Nếu một hàm trả về, vùng nhớ được sử dụng bởi khung ngăn xếp của hàm đó có thể bị tái sử dụng bởi một lời gọi hàm sau đó. Nếu luồng kết thúc, một luồng mới có thể tái sử dụng vùng nhớ từng dùng cho ngăn xếp của luồng đã kết thúc đó.) Việc không xử lý chính xác sự phụ thuộc này có thể tạo ra các lỗi rất khó truy vết.

## 29.2 Chi tiết nền tảng về Pthreads API

Vào cuối những năm 1980 và đầu những năm 1990, đã tồn tại một vài API luồng khác nhau. Năm 1995, POSIX.1c đã chuẩn hóa POSIX threads API, và tiêu chuẩn này sau đó được tích hợp vào SUSv3.

Có một số khái niệm áp dụng chung cho toàn bộ Pthreads API, và chúng ta sẽ giới thiệu ngắn gọn các khái niệm này trước khi đi sâu tìm hiểu chi tiết về API.

## Các kiểu dữ liệu trong Pthreads

Pthreads API định nghĩa một số kiểu dữ liệu, một số trong số đó được liệt kê trong Bảng 29-1. Chúng tôi mô tả hầu hết các kiểu dữ liệu này trong các trang tiếp theo.

**Bảng 29-1:** Các kiểu dữ liệu trong Pthreads

| Kiểu dữ liệu        | Mô tả                                   |
|---------------------|-----------------------------------------|
| pthread_t           | Định danh luồng (Thread identifier)     |
| pthread_mutex_t     | Khóa tương tranh (Mutex)                |
| pthread_mutexattr_t | Đối tượng thuộc tính mutex              |
| pthread_cond_t      | Biến điều kiện (Condition variable)     |
| pthread_condattr_t  | Đối tượng thuộc tính biến điều kiện     |
| pthread_key_t       | Khóa cho dữ liệu đặc thù của luồng      |
| pthread_once_t      | Ngữ cảnh điều khiển khởi tạo một lần    |
| pthread_attr_t      | Đối tượng thuộc tính luồng              |

SUSv3 không quy định các kiểu dữ liệu này phải được biểu diễn như thế nào, và các chương trình có tính di động (portable programs) nên coi chúng là dữ liệu mờ (opaque data). Ý của chúng tôi là chương trình phải tránh mọi sự phụ thuộc vào việc hiểu biết cấu trúc hoặc nội dung của một biến thuộc các kiểu dữ liệu này. Cụ thể, chúng ta không thể so sánh các biến thuộc các kiểu này bằng cách sử dụng toán tử `==` của C.

### Luồng và errno

Trong UNIX API truyền thống, `errno` là một biến số nguyên toàn cục (global integer variable). Tuy nhiên, điều này là không đủ đối với các chương trình đa luồng (threaded programs). Nếu một luồng thực hiện một lệnh gọi hàm trả về lỗi trong một biến `errno` toàn cục, thì điều này sẽ gây nhầm lẫn cho các luồng khác cũng có thể đang thực hiện các lệnh gọi hàm và kiểm tra `errno`. Nói cách khác, hiện tượng điều kiện tranh chấp (race conditions) sẽ xảy ra. Do đó, trong các chương trình đa luồng, mỗi luồng có giá trị `errno` của riêng mình. Trên Linux, một `errno` đặc thù cho luồng (thread-specific errno) đạt được theo cách tương tự như hầu hết các cài đặt UNIX khác: `errno` được định nghĩa là một macro mở rộng thành một lệnh gọi hàm trả về một lvalue có thể sửa đổi và phân biệt cho từng luồng. (Vì lvalue có thể sửa đổi, nên việc viết các câu lệnh gán dạng `errno = value` trong các chương trình đa luồng là hoàn toàn khả thi).

Tóm lại, cơ chế `errno` đã được điều chỉnh cho các luồng theo cách giúp cho việc báo cáo lỗi không thay đổi so với UNIX API truyền thống.

> Tiêu chuẩn POSIX.1 gốc tuân theo cách sử dụng của K&R C khi cho phép chương trình khai báo `errno` dưới dạng `extern int errno`. SUSv3 không cho phép cách sử dụng này (sự thay đổi thực sự diễn ra vào năm 1995 trong POSIX.1c). Ngày nay, chương trình bắt buộc phải khai báo `errno` bằng cách bao gồm tệp tiêu đề `<errno.h>`, điều này cho phép việc hiện thực hóa `errno` cho từng luồng (per-thread errno).

### Giá trị trả về từ các hàm Pthreads

Phương pháp truyền thống để trả về trạng thái từ các System Call và một số hàm thư viện là trả về `0` khi thành công và `-1` khi có lỗi, với `errno` được thiết lập để chỉ ra lỗi. Các hàm trong Pthreads API hoạt động khác đi. Tất cả các hàm Pthreads đều trả về `0` khi thành công hoặc một giá trị dương khi thất bại. Giá trị thất bại là một trong số các giá trị có thể được gán vào `errno` bởi các System Call truyền thống của UNIX.

Vì mỗi lần tham chiếu đến `errno` trong một chương trình đa luồng đều gánh chịu chi phí của một lệnh gọi hàm, các chương trình ví dụ của chúng tôi không gán trực tiếp giá trị trả về của hàm Pthreads cho `errno`. Thay vào đó, chúng tôi sử dụng một biến trung gian và áp dụng hàm chẩn đoán `errExitEN()` (Mục 3.5.2), như sau:

```c
pthread_t *thread;
int s;
s = pthread_create(&thread, NULL, func, &arg);
if (s != 0)
 errExitEN(s, "pthread_create");
```

### Biên dịch các chương trình Pthreads

Trên Linux, các chương trình sử dụng API Pthreads phải được biên dịch với tùy chọn `cc –pthread`. Các hiệu ứng của tùy chọn này bao gồm:

- Macro tiền xử lý `_REENTRANT` được định nghĩa. Điều này làm cho các khai báo của một số hàm khả nhập (reentrant function) được hiển thị.
- Chương trình được liên kết (link) với thư viện `libpthread` (tương đương với `-lpthread`).

Các tùy chọn chính xác để biên dịch một chương trình đa luồng (multithreaded program) khác nhau tùy theo các bản cài đặt (implementation) và trình biên dịch. Một số bản cài đặt khác (ví dụ: Tru64) cũng sử dụng `cc –pthread`; trong khi Solaris và HP-UX sử dụng `cc –mt`.

## 29.3 Khởi tạo Luồng (Thread Creation)

Khi một chương trình được khởi động, tiến trình (process) kết quả bao gồm một luồng duy nhất, gọi là luồng ban đầu hoặc luồng chính (initial/main thread). Trong phần này, chúng ta sẽ tìm hiểu cách tạo ra các luồng bổ sung.

Hàm `pthread_create()` tạo ra một luồng mới.

```c
## include <pthread.h>
int pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                   void *(*start)(void *), void *arg);
                    /* Trả về 0 nếu thành công, hoặc một số nguyên dương biểu thị mã lỗi khi thất bại */
```

```

```

Luồng mới bắt đầu thực thi bằng cách gọi hàm được chỉ định bởi `start` với đối số `arg` (tức là `start(arg)`). Luồng gọi `pthread_create()` tiếp tục thực thi với câu lệnh tiếp theo sau lệnh gọi đó. (Hành vi này giống với hàm wrapper của glibc đối với system call `clone()` được mô tả trong Mục 28.2).

Đối số `arg` được khai báo dưới dạng `void *`, nghĩa là chúng ta có thể truyền một con trỏ tới bất kỳ kiểu đối tượng nào cho hàm `start`. Thông thường, `arg` trỏ tới một biến toàn cục (global variable) hoặc biến trên vùng nhớ heap, nhưng nó cũng có thể được chỉ định là `NULL`. Nếu chúng ta cần truyền nhiều đối số cho `start`, thì `arg` có thể được chỉ định là một con trỏ tới một cấu trúc (structure) chứa các đối số dưới dạng các trường (field) riêng biệt. Với việc ép kiểu (casting) khôn ngoan, chúng ta thậm chí có thể chỉ định `arg` như một `int`.

> Nói một cách chính xác, các chuẩn C không định nghĩa kết quả của việc ép kiểu từ `int` sang `void *` và ngược lại. Tuy nhiên, hầu hết các trình biên dịch C đều cho phép các thao tác này và chúng tạo ra kết quả mong muốn; nghĩa là, `int j == (int) ((void *) j)`.

Giá trị trả về của `start` cũng có kiểu `void *`, và nó có thể được sử dụng theo cách tương tự như đối số `arg`. Chúng ta sẽ thấy giá trị này được sử dụng như thế nào khi mô tả hàm `pthread_join()` dưới đây.

> Cần cẩn trọng khi sử dụng một số nguyên được ép kiểu làm giá trị trả về của hàm `start` của một luồng. Lý do là `PTHREAD_CANCELED`—giá trị trả về khi một luồng bị hủy (xem Chương [32](#page-54-0))—thường là một giá trị số nguyên do bản triển khai định nghĩa được ép kiểu thành `void *`. Nếu hàm `start` của một luồng trả về đúng giá trị số nguyên đó, thì đối với một luồng khác đang thực hiện `pthread_join()`, nó sẽ bị hiểu nhầm rằng luồng đó đã bị hủy. Trong một ứng dụng sử dụng cơ chế hủy luồng và chọn trả về các giá trị số nguyên được ép kiểu từ hàm `start`, chúng ta phải đảm bảo rằng một luồng kết thúc bình thường không trả về giá trị số nguyên trùng với `PTHREAD_CANCELED` trên bản triển khai Pthreads đó.

```

``` Một ứng dụng khả chuyển (portable application) cần đảm bảo rằng các luồng kết thúc bình thường không trả về các giá trị số nguyên trùng với `PTHREAD_CANCELED` trên bất kỳ bản cài đặt nào mà ứng dụng đó sẽ chạy.

Đối số `thread` trỏ tới một bộ đệm (buffer) kiểu `pthread_t` mà định danh duy nhất (unique identifier) cho luồng này được sao chép vào trước khi `pthread_create()` trả về. Định danh này có thể được sử dụng trong các lời gọi Pthreads sau đó để tham chiếu đến luồng.

> SUSv3 lưu ý rõ rằng bản cài đặt không cần phải khởi tạo bộ đệm mà `thread` trỏ tới trước khi luồng mới bắt đầu thực thi; nghĩa là, luồng mới có thể bắt đầu chạy trước khi `pthread_create()` trả về cho hàm gọi nó. Nếu luồng mới cần lấy ID của chính nó, thì nó phải thực hiện điều đó bằng cách sử dụng `pthread_self()` (được mô tả trong Mục [29.5](#page-7-0)).

Đối số `attr` là một con trỏ tới đối tượng `pthread_attr_t` chỉ định các thuộc tính khác nhau cho luồng mới. Chúng ta sẽ nói thêm về các thuộc tính này trong Mục [29.8](#page-11-0). Nếu `attr` được chỉ định là `NULL`, thì luồng được tạo với các thuộc tính mặc định khác nhau, và đây là điều chúng ta sẽ làm trong hầu hết các chương trình ví dụ trong cuốn sách này.

Sau một lời gọi `pthread_create()`, một chương trình không có đảm bảo nào về việc luồng nào sẽ được lên lịch (scheduled) tiếp theo để sử dụng CPU (trên hệ thống đa bộ xử lý - multiprocessor system, cả hai luồng có thể đồng thời thực thi trên các CPU khác nhau). Các chương trình phụ thuộc ngầm định vào một thứ tự lên lịch cụ thể sẽ dễ gặp phải các loại điều kiện tranh đua (race condition) mà chúng ta đã mô tả trong Mục 24.4. Nếu chúng ta cần ép buộc một thứ tự thực thi cụ thể, chúng ta phải sử dụng một trong các kỹ thuật đồng bộ hóa được mô tả trong Chương [30](#page-14-0).

## 29.4 Kết thúc Luồng (Thread Termination)

Việc thực thi của một luồng kết thúc theo một trong các cách sau:

- Hàm `start` của luồng thực hiện lệnh `return` chỉ định giá trị trả về cho luồng.

- Luồng gọi hàm `pthread_exit()` (được mô tả bên dưới).
- Luồng bị hủy bằng cách sử dụng hàm `pthread_cancel()` (được mô tả trong Mục [32.1\)](#page-54-1).
- Bất kỳ luồng nào gọi hàm `exit()`, hoặc luồng chính (main thread) thực hiện lệnh `return` (trong hàm `main()`), điều này khiến tất cả các luồng trong tiến trình (process) chấm dứt hoạt động ngay lập tức.

Hàm `pthread_exit()` chấm dứt luồng gọi nó, đồng thời chỉ định một giá trị trả về (return value) mà luồng khác có thể lấy được bằng cách gọi hàm `pthread_join()`.

```c
## include <pthread.h>
void pthread_exit(void *retval);
```

```

```

Việc gọi `pthread_exit()` tương đương với việc thực hiện lệnh `return` trong hàm khởi tạo của luồng (thread's start function), với điểm khác biệt là `pthread_exit()` có thể được gọi từ bất kỳ hàm nào đã được gọi bởi hàm khởi tạo của luồng đó.

Đối số `retval` chỉ định giá trị trả về cho luồng. Giá trị được trỏ tới bởi `retval` không được nằm trên vùng nhớ stack của luồng, vì nội dung của stack đó sẽ trở nên không xác định (undefined) khi luồng chấm dứt. (Ví dụ, vùng nhớ đó của không gian ảo (virtual memory) trong tiến trình có thể được sử dụng lại ngay lập tức bởi stack cho một luồng mới). Tương tự như vậy đối với giá trị được truyền cho câu lệnh `return` trong hàm khởi tạo của luồng.

Nếu luồng chính gọi hàm `pthread_exit()` thay vì gọi `exit()` hoặc thực hiện lệnh `return`, thì các luồng khác vẫn tiếp tục thực thi.

## 29.5 Các ID Luồng (Thread IDs)

Mỗi luồng trong một tiến trình được định danh duy nhất bởi một ID luồng (thread ID). ID này được trả về cho bên gọi hàm `pthread_create()`, và một luồng có thể lấy ID của chính nó bằng cách sử dụng hàm `pthread_self()`.

```c
## include <pthread.h>
pthread_t pthread_self(void);
                                      /* Trả về ID luồng của luồng gọi hàm */
```

```

```

Các ID luồng rất hữu ích trong các ứng dụng vì những lý do sau:

- Các hàm Pthreads khác nhau sử dụng ID luồng để xác định luồng mà chúng tác động lên. Ví dụ về các hàm này bao gồm `pthread_join()`, `pthread_detach()`, `pthread_cancel()` và `pthread_kill()`, tất cả đều được chúng ta mô tả trong chương này và các chương tiếp theo.
- Trong một số ứng dụng, việc gắn nhãn (tag) các cấu trúc dữ liệu động (dynamic data structures) với ID của một luồng cụ thể có thể rất hữu ích. Điều này có thể giúp xác định luồng đã tạo hoặc "sở hữu" một cấu trúc dữ liệu, hoặc có thể được sử dụng bởi một luồng để xác định một luồng cụ thể sau đó sẽ thực hiện thao tác gì đó với cấu trúc dữ liệu đó.

Hàm `pthread_equal()` cho phép chúng ta kiểm tra xem hai ID luồng có giống nhau hay không.

```c
## include <pthread.h>
int pthread_equal(pthread_t t1, pthread_t t2);
                        /* Trả về giá trị khác 0 nếu t1 và t2 bằng nhau, ngược lại trả về 0 */
```

```

```

Ví dụ, để kiểm tra xem ID của luồng gọi có khớp với ID luồng được lưu trong biến `tid` hay không, chúng ta có thể viết mã như sau:

```c
if (pthread_equal(tid, pthread_self()))
    printf("tid trùng khớp với chính nó\n");
```

Hàm `pthread_equal()` là cần thiết vì kiểu dữ liệu `pthread_t` phải được xử lý như một dữ liệu mờ (opaque data). Trên Linux, `pthread_t` thực tế được định nghĩa là một số nguyên không dấu (unsigned long), nhưng trên các hệ thống thực thi (implementation) khác, nó có thể là một con trỏ (pointer) hoặc một cấu trúc (structure).

```c
Trong NPTL, pthread_t thực chất là một con trỏ đã được ép kiểu (cast) thành unsigned long.
```

Tiêu chuẩn SUSv3 không yêu cầu `pthread_t` phải được triển khai như một kiểu dữ liệu vô hướng (scalar type); nó có thể là một cấu trúc. Do đó, chúng ta không thể sử dụng mã nguồn có tính di động (portable) như sau để hiển thị ID luồng (mặc dù nó hoạt động trên nhiều hệ thống thực thi, bao gồm cả Linux, và đôi khi hữu ích cho mục đích gỡ lỗi - debugging):

```c
pthread_t thr;
printf("Thread ID = %ld\n", (long) thr); /* SAI! */
```

Trong các cơ chế thực thi luồng của Linux, các ID luồng là duy nhất trên toàn bộ các tiến trình (across processes). Tuy nhiên, điều này không nhất thiết đúng trên các hệ thống thực thi khác, và SUSv3 lưu ý rõ ràng rằng một ứng dụng không thể sử dụng ID luồng một cách có tính di động để định danh một luồng ở tiến trình khác. SUSv3 cũng lưu ý rằng một hệ thống thực thi được phép tái sử dụng ID luồng sau khi một luồng đã chấm dứt được thu gom bằng `pthread_join()` hoặc sau khi một luồng tách biệt (detached thread) đã chấm dứt. (Chúng ta sẽ giải thích về `pthread_join()` ở phần tiếp theo, và luồng tách biệt trong Mục [29.7](#page-10-0)).

> Các ID luồng POSIX không giống với các ID luồng được trả về bởi System Call `gettid()` đặc trưng của Linux. Các ID luồng POSIX được cấp phát và quản lý bởi thư viện thực thi luồng (threading implementation). ID luồng được trả về bởi `gettid()` là một con số (tương tự như ID tiến trình - PID) được cấp phát bởi Kernel. Mặc dù mỗi luồng POSIX có một ID luồng kernel duy nhất trong cơ chế luồng NPTL của Linux, nhưng một ứng dụng thường không cần phải biết về các ID kernel này (và mã nguồn sẽ mất tính di động nếu phụ thuộc vào việc biết chúng).

## 29.6 Thu gom (Join) với một Thread đã kết thúc

Hàm `pthread_join()` đợi thread được định dạng bởi `thread` kết thúc. (Nếu thread đó đã kết thúc từ trước, `pthread_join()` sẽ trả về ngay lập tức). Thao tác này được gọi là thu gom hay kết nối (`joining`).

```c
## include <pthread.h>
int pthread_join(pthread_t thread, void **retval);
                      /* Thành công trả về 0, thất bại trả về một số nguyên dương biểu thị mã lỗi */
```

```

```

Nếu `retval` là một con trỏ khác `NULL`, thì nó sẽ nhận một bản sao giá trị trả về của thread đã kết thúc — nghĩa là giá trị đã được chỉ định khi thread thực hiện lệnh `return` hoặc gọi `pthread_exit()`.

Việc gọi `pthread_join()` cho một Thread ID (`thread ID`) đã được thu gom trước đó có thể dẫn đến hành vi không xác định (unpredictable behavior); ví dụ, nó có thể thay vào đó thu gom với một thread được tạo sau này nhưng vô tình tái sử dụng cùng một Thread ID.

Nếu một thread không ở trạng thái tách rời (detached) (xem Mục [29.7](#page-10-0)), thì chúng ta bắt buộc phải thu gom nó bằng cách sử dụng `pthread_join()`. Nếu chúng ta không làm điều này, thì khi thread kết thúc, nó sẽ tạo ra một phiên bản tương đương của tiến trình thây ma (`zombie process`) ở cấp độ thread (Mục 26.2). Bên cạnh việc lãng phí tài nguyên hệ thống (system resources), nếu số lượng thread thây ma tích tụ đủ lớn, chúng ta sẽ không thể tạo thêm các thread mới.

Tác vụ mà `pthread_join()` thực hiện cho các thread tương tự như tác vụ mà `waitpid()` thực hiện cho các tiến trình (`process`). Tuy nhiên, có một số điểm khác biệt đáng chú ý:

- Các thread là bình đẳng (peers). Bất kỳ thread nào trong một tiến trình đều có thể sử dụng `pthread_join()` để thu gom với bất kỳ thread nào khác trong cùng tiến trình đó. Ví dụ, nếu thread A tạo ra thread B, và thread B tạo ra thread C, thì thread A hoàn toàn có thể thu gom với thread C, hoặc ngược lại. Điều này khác với mối quan hệ phân cấp giữa các tiến trình. Khi một tiến trình cha (parent process) tạo ra một tiến trình con (child process) sử dụng `fork()`, nó là tiến trình duy nhất có thể gọi `wait()` trên tiến trình con đó. Không hề có mối quan hệ tương tự như vậy giữa thread gọi `pthread_create()` và thread mới được tạo ra.
- Không có cách nào để ra lệnh "thu gom với bất kỳ thread nào" (đối với các tiến trình, chúng ta có thể làm điều này bằng cách sử dụng lời gọi `waitpid(-1, &status, options)`); cũng không có cách nào để thực hiện một thao tác thu gom không đồng bộ/không chặn (nonblocking join) (tương tự như cờ `WNOHANG` của `waitpid()`). Có những cách để đạt được chức năng tương tự bằng cách sử dụng biến điều kiện (`condition variables`); chúng ta sẽ xem xét một ví dụ ở Mục [30.2.4](#page-31-0).

Hạn chế việc `pthread_join()` chỉ có thể thu gom với một Thread ID cụ thể là hoàn toàn có chủ đích. Ý tưởng cốt lõi là một chương trình chỉ nên thu gom với các thread mà nó "biết rõ". Vấn đề với thao tác "thu gom với bất kỳ thread nào" bắt nguồn từ việc không có hệ thống phân cấp thread, do đó một thao tác như vậy thực sự có thể thu gom với bất kỳ thread nào, kể cả thread được tạo một cách riêng tư bởi một hàm thư viện (library function). (Kỹ thuật biến điều kiện mà chúng ta trình bày ở Mục [30.2.4](#page-31-0) cho phép một thread chỉ thu gom với bất kỳ thread nào khác mà nó nắm rõ). Hệ quả là, thư viện sẽ không còn khả năng thu gom với thread đó để lấy trạng thái của nó nữa, và nó sẽ cố gắng một cách sai lầm việc thu gom với một Thread ID đã được thu gom trước đó. Nói cách khác, một thao tác "thu gom với bất kỳ thread nào" là không tương thích với thiết kế chương trình theo mô-đun (modular program design).

## Chương trình ví dụ

Chương trình trong Listing 29-1 tạo ra một luồng khác và sau đó thực hiện thu gom (join) với nó.

**Listing 29-1:** Một chương trình đơn giản sử dụng Pthreads

```c
// ––––––––––––––––––––––––––––––––––––––––––––––––––– threads/simple_thread.c
## include <pthread.h>
## include "tlpi_hdr.h"

static void *
threadFunc(void *arg)
{
    char *s = (char *) arg;

    printf("%s", s);

    return (void *) strlen(s);
}

int
main(int argc, char *argv[])
{
    pthread_t t1;
    void *res;
    int s;

    s = pthread_create(&t1, NULL, threadFunc, "Hello world\n");
    if (s != 0)
        errExitEN(s, "pthread_create");

    printf("Message from main()\n");
    s = pthread_join(t1, &res);
    if (s != 0)
        errExitEN(s, "pthread_join");

    printf("Thread returned %ld\n", (long) res);

    exit(EXIT_SUCCESS);
}
// ––––––––––––––––––––––––––––––––––––––––––––––––––– threads/simple_thread.c
```

Khi chạy chương trình trong Listing 29-1, chúng ta thấy kết quả sau:

```

```

```
$ ./simple_thread
Message from main()
Hello world
Thread returned 12
```

Tùy thuộc vào cách hai Thread (luồng) được lập lịch (scheduled), thứ tự của hai dòng đầu tiên trong kết quả đầu ra có thể bị đảo ngược.

## 29.7 Tách rời một Thread (Detaching a Thread)

Theo mặc định, một Thread (luồng) có thể thu hồi được (joinable), nghĩa là khi nó kết thúc, một Thread (luồng) khác có thể lấy trạng thái trả về của nó bằng cách sử dụng `pthread_join()`. Đôi khi, chúng ta không quan tâm đến trạng thái trả về của Thread (luồng); chúng ta đơn giản chỉ muốn hệ thống tự động dọn dẹp và xóa Thread (luồng) đó khi nó kết thúc. Trong trường hợp này, chúng ta có thể đánh dấu Thread (luồng) là đã tách rời (detached) bằng cách gọi hàm `pthread_detach()` và chỉ định định danh (identifier) của Thread (luồng) trong tham số `thread`.

```c
## include <pthread.h>
int pthread_detach(pthread_t thread);
                      /* Trả về 0 nếu thành công, hoặc một số nguyên dương biểu thị mã lỗi nếu thất bại */
```

```

```

Như một ví dụ về việc sử dụng `pthread_detach()`, một Thread (luồng) có thể tự tách rời chính nó bằng lời gọi sau:

```
pthread_detach(pthread_self());
```

Một khi một Thread (luồng) đã bị tách rời (detached), sẽ không thể sử dụng `pthread_join()` để lấy trạng thái trả về của nó nữa, và Thread (luồng) đó không thể được chuyển lại thành trạng thái có thể thu hồi (joinable).

Việc tách rời một Thread (luồng) không làm cho nó miễn nhiễm với lời gọi `exit()` ở một Thread (luồng) khác hoặc lệnh `return` trong Thread chính (`main thread`). Trong trường hợp đó, tất cả các Thread (luồng) trong Process (tiến trình) sẽ ngay lập tức bị chấm dứt, bất kể chúng là joinable hay detached. Nói cách khác, `pthread_detach()` chỉ kiểm soát điều gì xảy ra sau khi một Thread (luồng) kết thúc, chứ không phải cách thức hoặc thời điểm nó kết thúc.

## 29.8 Các thuộc tính của Thread (Thread Attributes)

Chúng ta đã đề cập trước đó rằng tham số `attr` của `pthread_create()`, có kiểu dữ liệu là `pthread_attr_t`, có thể được sử dụng để chỉ định các thuộc tính được dùng khi tạo một Thread (luồng) mới. Chúng ta sẽ không đi vào chi tiết của các thuộc tính này (để biết chi tiết, hãy xem các tài liệu tham khảo được liệt kê ở cuối chương này) hay hiển thị nguyên mẫu (prototype) của các hàm Pthreads khác nhau có thể được sử dụng để thao tác với đối tượng `pthread_attr_t`. Chúng ta chỉ cần lưu ý rằng các thuộc tính này bao gồm các thông tin như vị trí và kích thước của vùng nhớ stack (ngăn xếp) của Thread (luồng), chính sách lập lịch (scheduling policy) và ưu tiên của Thread (luồng) (tương tự như các chính sách và mức độ ưu tiên lập lịch thời gian thực của Process (tiến trình) được mô tả trong Mục 35.2 và 35.3), và việc Thread (luồng) đó là joinable hay detached.

Như một ví dụ về việc sử dụng thuộc tính luồng, đoạn mã được hiển thị trong [Listing 29-2](#page-11-1) tạo ra một luồng mới ở trạng thái tách rời ngay tại thời điểm khởi tạo (thay vì làm việc đó sau này bằng `pthread_detach()`). Đoạn mã này trước tiên khởi tạo một đối tượng thuộc tính luồng với các giá trị mặc định, thiết lập thuộc tính cần thiết để tạo luồng tách rời, và sau đó tạo luồng mới bằng cách sử dụng đối tượng thuộc tính đó. Ngay sau khi luồng đã được tạo, đối tượng thuộc tính không còn cần thiết nữa và được giải phóng.

**Listing 29-2:** Tạo một luồng với thuộc tính tách rời (detached attribute)

```c
// ––––––––––––––––––––––––––––––––––––––––––– từ threads/detached_attrib.c
pthread_t thr;
pthread_attr_t attr;
int s;

s = pthread_attr_init(&attr); /* Gán các giá trị mặc định */
if (s != 0)
    errExitEN(s, "pthread_attr_init");

s = pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
if (s != 0)
    errExitEN(s, "pthread_attr_setdetachstate");

s = pthread_create(&thr, &attr, threadFunc, (void *) 1);
if (s != 0)
    errExitEN(s, "pthread_create");

s = pthread_attr_destroy(&attr); /* Không còn cần thiết nữa */
if (s != 0)
    errExitEN(s, "pthread_attr_destroy");
// ––––––––––––––––––––––––––––––––––––––––––– từ threads/detached_attrib.c
```

```

```

## 29.9 Luồng so với Tiến trình (Threads Versus Processes)

Trong phần này, chúng ta sẽ xem xét ngắn gọn một số yếu tố có thể ảnh hưởng đến quyết định lựa chọn triển khai một ứng dụng dưới dạng một nhóm các luồng (thread) hay một nhóm các tiến trình (process). Chúng ta bắt đầu bằng việc xem xét các ưu điểm của phương pháp đa luồng (multithreaded approach):

- Chia sẻ dữ liệu giữa các luồng rất dễ dàng. Ngược lại, việc chia sẻ dữ liệu giữa các tiến trình đòi hỏi nhiều công sức hơn (ví dụ: tạo một phân đoạn bộ nhớ chia sẻ - shared memory segment, hoặc sử dụng một đường ống - pipe).
- Việc tạo luồng nhanh hơn việc tạo tiến trình; thời gian chuyển đổi ngữ cảnh (context-switch time) của luồng có thể thấp hơn so với tiến trình.

Sử dụng luồng có thể mang lại một số bất lợi so với sử dụng tiến trình:

- Khi lập trình với các luồng, chúng ta cần đảm bảo rằng các hàm mà chúng ta gọi phải an toàn luồng (thread-safe) hoặc được gọi theo cách an toàn luồng. (Chúng ta sẽ mô tả khái niệm an toàn luồng trong Mục [31.1.](#page-38-0)) Các ứng dụng đa tiến trình (multiprocess applications) không cần phải bận tâm đến vấn đề này.
- Một lỗi ở một luồng nào đó (ví dụ: sửa đổi bộ nhớ thông qua con trỏ không hợp lệ) có thể làm hỏng tất cả các luồng trong tiến trình, vì chúng chia sẻ cùng một không gian địa chỉ (address space) và các thuộc tính khác. Ngược lại, các tiến trình có tính cô lập cao hơn với nhau.
- Mỗi luồng đều cạnh tranh để sử dụng không gian địa chỉ ảo (virtual address space) hữu hạn của tiến trình chủ (host process). Cụ thể, stack và dữ liệu đặc thù của từng luồng (hoặc bộ nhớ cục bộ luồng - thread-local storage) chiếm một phần không gian địa chỉ ảo của tiến trình, do đó phần không gian này sẽ không khả dụng cho các luồng khác. Mặc dù không gian địa chỉ ảo khả dụng rất lớn (ví dụ: thường là 3 GB trên kiến trúc x86-32), yếu tố này vẫn có thể là một giới hạn đáng kể đối với các ứng dụng sử dụng số lượng lớn luồng hoặc các luồng yêu cầu lượng lớn bộ nhớ.

```

``` Ngược lại, các tiến trình riêng biệt có thể tận dụng toàn bộ dải bộ nhớ ảo khả dụng (chịu giới hạn bởi RAM và không gian swap).

Dưới đây là một số điểm khác có thể ảnh hưởng đến lựa chọn giữa luồng và tiến trình của chúng ta:

- Xử lý tín hiệu (signal) trong một ứng dụng đa luồng đòi hỏi thiết kế cẩn thận. (Theo nguyên tắc chung, thường nên tránh sử dụng tín hiệu trong các chương trình đa luồng). Chúng ta sẽ bàn thêm về luồng và tín hiệu tại Mục [33.2](#page-65-0).
- Trong một ứng dụng đa luồng, tất cả các luồng phải chạy cùng một chương trình (mặc dù có thể thực thi ở các hàm khác nhau). Trong một ứng dụng đa tiến trình, các tiến trình khác nhau có thể chạy các chương trình khác nhau.
- Ngoài dữ liệu, các luồng còn chia sẻ một số thông tin khác (ví dụ: bộ mô tả tệp - file descriptors, cơ chế xử lý tín hiệu - signal dispositions, thư mục làm việc hiện tại - current working directory, và ID người dùng/nhóm - user and group IDs). Điều này có thể là một ưu điểm hoặc nhược điểm tùy thuộc vào ứng dụng.

## 29.10 Tổng kết (Summary)

Trong một tiến trình đa luồng (multithreaded process), nhiều luồng đồng thời (concurrently) thực thi cùng một chương trình. Tất cả các luồng đều chia sẻ chung các biến toàn cục (global variables) và biến heap, nhưng mỗi luồng sở hữu một stack riêng tư dành cho các biến cục bộ (local variables). Các luồng trong một tiến trình cũng chia sẻ một số thuộc tính khác, bao gồm ID tiến trình (process ID), bộ mô tả tệp đang mở (open file descriptors), cơ chế xử lý tín hiệu (signal dispositions), thư mục làm việc hiện tại (current working directory), và các giới hạn tài nguyên (resource limits).

Sự khác biệt mấu chốt giữa luồng và tiến trình là khả năng chia sẻ thông tin dễ dàng hơn mà các luồng mang lại, và đây là lý do chính khiến một số thiết kế ứng dụng phù hợp với thiết kế đa luồng hơn là thiết kế đa tiến trình. Các luồng cũng có thể mang lại hiệu suất tốt hơn cho một số thao tác (ví dụ: việc tạo luồng nhanh hơn tạo tiến trình), nhưng yếu tố này thường chỉ mang tính phụ khi ảnh hưởng đến quyết định lựa chọn giữa luồng và tiến trình.

Các luồng được tạo ra bằng cách sử dụng `pthread_create()`. Sau đó, mỗi luồng có thể tự kết thúc một cách độc lập bằng cách sử dụng `pthread_exit()`. (Nếu bất kỳ luồng nào gọi `exit()`, thì tất cả các luồng sẽ lập tức chấm dứt hoạt động). Trừ khi một luồng được đánh dấu là ở trạng thái tách rời (detached) (ví dụ: thông qua lệnh gọi `pthread_detach()`), nó phải được thu gom bởi một luồng khác thông qua `pthread_join()`, hàm này trả về trạng thái kết thúc của luồng được thu gom (joined thread).

```

### Thông tin thêm

[Butenhof, 1996] cung cấp một tài liệu giải thích về Pthreads vừa dễ đọc vừa toàn diện. [Robbins & Robbins, 2003] cũng trình bày tốt về Pthreads. [Tanenbaum, 2007] cung cấp phần giới thiệu mang tính lý thuyết nhiều hơn về các khái niệm thread (luồng), bao gồm các chủ đề như mutex, critical region (vùng tranh chấp), conditional variable (biến điều kiện), cũng như việc phát hiện và phòng tránh deadlock (tắc nghẽn). [Vahalia, 1996] cung cấp thông tin nền tảng về việc triển khai các thread.

## 29.11 Bài tập

**29-1.** Những kết quả nào có thể xảy ra nếu một thread thực thi đoạn mã sau:

```c

pthread_join(pthread_self(), NULL);

```

Hãy viết một chương trình để xem điều gì thực sự xảy ra trên Linux. Nếu chúng ta có một biến `tid` chứa một ID của thread (thread ID), làm thế nào một thread có thể tự ngăn chặn việc gọi `pthread_join(tid, NULL)`, vốn tương đương với câu lệnh trên?

**29-2.** Ngoài việc thiếu cơ chế kiểm tra lỗi và các khai báo biến, cấu trúc khác nhau, vấn đề của chương trình sau là gì?

```c

static void *
threadFunc(void *arg)
{
struct someStruct *pbuf = (struct someStruct *) arg;
/* Thực hiện một số công việc với cấu trúc được trỏ tới bởi 'pbuf' */
}
int
main(int argc, char *argv[])
{
struct someStruct buf;
pthread_create(&thr, NULL, threadFunc, (void *) &buf);
pthread_exit(NULL);
}

```
