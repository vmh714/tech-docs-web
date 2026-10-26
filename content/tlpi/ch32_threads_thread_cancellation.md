## Chapter 32

## THREADS: THREAD CANCELLATION (HỦY TIẾN TRÌNH NHẸ)

Thông thường, nhiều Thread (luồng) thực thi song song, với mỗi thread thực hiện nhiệm vụ của mình cho đến khi nó quyết định kết thúc bằng cách gọi `pthread_exit()` hoặc trả về từ hàm khởi động của thread đó.

Đôi khi, việc hủy một thread (cancel a thread) sẽ rất hữu ích; nghĩa là gửi cho nó một yêu cầu yêu cầu nó chấm dứt ngay lập tức. Điều này có thể hữu ích, ví dụ, nếu một nhóm thread đang thực hiện một phép tính và một thread phát hiện ra một điều kiện lỗi yêu cầu các thread khác phải chấm dứt. Hoặc cách khác, một ứng dụng điều khiển bằng giao diện người dùng (GUI-driven application) có thể cung cấp nút hủy (cancel button) để cho phép người dùng chấm dứt một tác vụ đang được thực hiện bởi một thread ở chế độ nền (background); trong trường hợp này, thread chính (điều khiển GUI) cần thông báo cho thread nền chấm dứt.

Trong chương này, chúng ta sẽ mô tả cơ chế hủy POSIX thread (POSIX threads cancellation mechanism).

## 32.1 Hủy một Thread (Canceling a Thread)

Hàm `pthread_cancel()` gửi một yêu cầu hủy đến thread được chỉ định.

## include <pthread.h>

int **pthread\_cancel**(pthread\_t thread);

Trả về 0 nếu thành công, hoặc một số dương báo lỗi nếu thất bại

Sau khi đã tạo yêu cầu hủy, `pthread_cancel()` trả về ngay lập tức; nghĩa là nó không đợi thread mục tiêu (target thread) chấm dứt.

Chính xác điều gì xảy ra với thread mục tiêu và khi nào điều đó xảy ra sẽ phụ thuộc vào trạng thái hủy (cancellation state) và kiểu hủy (cancellation type) của thread đó, như được mô tả trong phần tiếp theo.

## 32.2 Trạng thái và Kiểu Hủy (Cancellation State and Type)

Các hàm `pthread_setcancelstate()` và `pthread_setcanceltype()` thiết lập các cờ (flags) cho phép một thread kiểm soát cách nó phản hồi lại một yêu cầu hủy.

```
## include <pthread.h>
int pthread_setcancelstate(int state, int *oldstate);
int pthread_setcanceltype(int type, int *oldtype);
                   Cả hai đều trả về 0 nếu thành công, hoặc một số dương báo lỗi nếu thất bại
```

Hàm `pthread_setcancelstate()` thiết lập trạng thái khả năng hủy (cancelability state) của thread gọi đến thành giá trị được cung cấp trong tham số `state`. Tham số này nhận một trong các giá trị sau:

### PTHREAD\_CANCEL\_DISABLE

Thread không thể bị hủy. Nếu một yêu cầu hủy được nhận, nó sẽ ở trạng thái chờ xử lý (pending) cho đến khi khả năng hủy được bật lại.

### PTHREAD\_CANCEL\_ENABLE

Thread có thể bị hủy. Đây là trạng thái khả năng hủy mặc định ở các thread mới được tạo.

Trạng thái khả năng hủy trước đó của thread được trả về thông qua con trỏ `oldstate`.

> Nếu chúng ta không quan tâm đến trạng thái khả năng hủy trước đó, Linux cho phép `oldstate` được chỉ định là `NULL`. Đây cũng là trường hợp trên nhiều hệ thống triển khai (implementations) khác; tuy nhiên, SUSv3 không quy định tính năng này, vì vậy các ứng dụng có tính di động cao (portable applications) không thể dựa vào nó. Chúng ta nên luôn chỉ định một giá trị khác `NULL` cho `oldstate`.

Việc tạm thời vô hiệu hóa tính năng hủy (`PTHREAD_CANCEL_DISABLE`) rất hữu ích nếu một thread đang thực thi một đoạn mã (code section) trong đó tất cả các bước phải được hoàn thành.

Nếu một thread có thể bị hủy (`PTHREAD_CANCEL_ENABLE`), thì việc xử lý yêu cầu hủy sẽ được quyết định bởi kiểu khả năng hủy (cancelability type) của thread, được chỉ định bởi tham số `type` trong lệnh gọi `pthread_setcanceltype()`. Tham số này nhận một trong các giá trị sau:

### PTHREAD\_CANCEL\_ASYNCHRONOUS

Thread có thể bị hủy tại bất kỳ thời điểm nào (có thể, nhưng không nhất thiết là ngay lập tức). Khả năng hủy bất đồng bộ (asynchronous cancelability) hiếm khi hữu ích, và chúng ta sẽ hoãn thảo luận về nó cho đến Phần [32.6.](#page-63-0)

### PTHREAD\_CANCEL\_DEFERRED

Yêu cầu hủy vẫn ở trạng thái chờ xử lý cho đến khi đạt đến một điểm hủy (cancellation point - xem phần tiếp theo). Đây là kiểu khả năng hủy mặc định ở các thread mới được tạo. Chúng ta sẽ thảo luận chi tiết hơn về khả năng hủy hoãn lại (deferred cancelability) trong các phần tiếp theo.

Kiểu khả năng hủy trước đó của thread được trả về thông qua con trỏ `oldtype`.

> Giống như tham số `oldstate` của `pthread_setcancelstate()`, nhiều hệ thống triển khai bao gồm cả Linux cho phép `oldtype` được chỉ định là `NULL` nếu chúng ta không quan tâm đến kiểu khả năng hủy trước đó. Một lần nữa, SUSv3 không quy định tính năng này và các ứng dụng có tính di động không thể dựa vào nó. Chúng ta nên luôn chỉ định một giá trị khác `NULL` cho `oldtype`.

Khi một thread gọi `fork()`, tiến trình con (child) kế thừa kiểu và trạng thái khả năng hủy của thread gọi. Khi một thread gọi `exec()`, kiểu và trạng thái khả năng hủy của thread chính trong chương trình mới sẽ được đặt lại lần lượt thành `PTHREAD_CANCEL_ENABLE` và `PTHREAD_CANCEL_DEFERRED`.

## 32.3 Điểm Hủy (Cancellation Points)

Khi tính năng khả năng hủy được bật và ở chế độ hoãn lại (`deferred`), yêu cầu hủy chỉ được thực thi khi thread tiếp tục đi đến một điểm hủy (cancellation point). Điểm hủy là lệnh gọi đến một trong các hàm được định nghĩa bởi hệ thống triển khai.

SUSv3 quy định rằng các hàm được hiển thị trong Bảng 32-1 phải là các điểm hủy nếu chúng được cung cấp bởi hệ thống triển khai. Hầu hết trong số này là các hàm có khả năng làm cho thread bị chặn (block) trong một khoảng thời gian không xác định.

**Bảng 32-1:** Các hàm bắt buộc phải là điểm hủy bỏ (cancellation point) theo SUSv3

| accept()          | nanosleep()              | sem_timedwait() |
|-------------------|--------------------------|-----------------|
| aio_suspend()     | open()                   | sem_wait()      |
| clock_nanosleep() | pause()                  | send()          |
| close()           | poll()                   | sendmsg()       |
| connect()         | pread()                  | sendto()        |
| creat()           | pselect()                | sigpause()      |
| fcntl(F_SETLKW)   | pthread_cond_timedwait() | sigsuspend()    |
| fsync()           | pthread_cond_wait()      | sigtimedwait()  |
| fdatasync()       | pthread_join()           | sigwait()       |
| getmsg()          | pthread_testcancel()     | sigwaitinfo()   |
| getpmsg()         | putmsg()                 | sleep()         |
| lockf(F_LOCK)     | putpmsg()                | system()        |
| mq_receive()      | pwrite()                 | tcdrain()       |
| mq_send()         | read()                   | usleep()        |
| mq_timedreceive() | readv()                  | wait()          |
| mq_timedsend()    | recv()                   | waitid()        |
| msgrcv()          | recvfrom()               | waitpid()       |
| msgsnd()          | recvmsg()                | write()         |
| msync()           | select()                 | writev()        |

Ngoài các hàm trong Bảng 32-1, SUSv3 còn chỉ định một nhóm lớn các hàm mà bản cài đặt (implementation) có thể định nghĩa là điểm hủy bỏ (cancellation point). Các hàm này bao gồm các hàm stdio, API dlopen, API syslog, nftw(), popen(), semop(), unlink(), và nhiều hàm khác nhau truy xuất thông tin từ các tệp hệ thống như tệp utmp. Một chương trình di động (portable program) phải xử lý chính xác khả năng một Thread (luồng) có thể bị hủy bỏ (cancel) khi gọi các hàm này.

SUSv3 quy định rằng ngoài hai danh sách hàm bắt buộc và có thể là điểm hủy bỏ, không có hàm nào khác trong tiêu chuẩn được phép hoạt động như điểm hủy bỏ (tức là, một chương trình di động không cần phải xử lý khả năng việc gọi các hàm khác này có thể thúc đẩy quá trình hủy bỏ Thread).

SUSv4 bổ sung openat() vào danh sách các hàm bắt buộc phải là điểm hủy bỏ, đồng thời loại bỏ sigpause() (chuyển sang danh sách các hàm có thể là điểm hủy bỏ) và usleep() (bị loại bỏ khỏi tiêu chuẩn).

> Một bản cài đặt (implementation) có quyền tự do đánh dấu các hàm bổ sung không được quy định trong tiêu chuẩn thành các điểm hủy bỏ (cancellation point). Bất kỳ hàm nào có khả năng bị chặn (block) (có lẽ vì nó có thể truy cập một tệp) đều là ứng cử viên sáng giá để trở thành điểm hủy bỏ. Trong glibc, nhiều hàm không chuẩn được đánh dấu là điểm hủy bỏ vì lý do này.

Khi nhận được yêu cầu hủy bỏ (cancellation request), một Thread có tính khả hủy (cancelability) được bật và ở chế độ hoãn lại (deferred) sẽ kết thúc khi nó chạm tới điểm hủy bỏ tiếp theo. Nếu Thread đó chưa được tách rời (detached), thì một Thread khác trong Process (tiến trình) phải thực hiện join với nó để ngăn không cho nó trở thành một zombie thread. Khi một Thread bị hủy bỏ được join, giá trị trả về trong đối số thứ hai của hàm pthread\_join() sẽ là một giá trị trả về đặc biệt của Thread: PTHREAD\_CANCELED.

### Chương trình ví dụ

[Liệt kê 32-1](#page-57-0) minh họa một ví dụ đơn giản về việc sử dụng `pthread_cancel()`. Chương trình chính tạo ra một Thread thực thi một vòng lặp vô hạn, ngủ (sleep) trong một giây và in ra giá trị của biến đếm vòng lặp. (Thread này sẽ chỉ kết thúc nếu nó nhận được một yêu cầu hủy - cancellation request hoặc nếu tiến trình - process thoát). Trong khi đó, chương trình chính ngủ trong 3 giây, sau đó gửi yêu cầu hủy tới Thread mà nó đã tạo. Khi chạy chương trình này, chúng ta thấy kết quả như sau:

```
$ ./t_pthread_cancel
New thread started
Loop 1
Loop 2
Loop 3
Thread was canceled
```

**Liệt kê 32-1:** Hủy một Thread bằng `pthread_cancel()`

```
––––––––––––––––––––––––––––––––––––––––––––––––––– threads/thread_cancel.c
## include <pthread.h>
## include "tlpi_hdr.h"
static void *
threadFunc(void *arg)
{
 int j;
```

```
 printf("New thread started\n"); /* Có thể là một điểm hủy - cancellation point */
 for (j = 1; ; j++) {
 printf("Loop %d\n", j); /* Có thể là một điểm hủy - cancellation point */
 sleep(1); /* Một điểm hủy - cancellation point */
 }
 /* KHÔNG BAO GIỜ ĐẠT TỚI */
 return NULL;
}
int
main(int argc, char *argv[])
{
 pthread_t thr;
 int s;
 void *res;
 s = pthread_create(&thr, NULL, threadFunc, NULL);
 if (s != 0)
 errExitEN(s, "pthread_create");
 sleep(3); /* Cho phép Thread mới chạy một lúc */
 s = pthread_cancel(thr);
 if (s != 0)
 errExitEN(s, "pthread_cancel");
 s = pthread_join(thr, &res);
 if (s != 0)
 errExitEN(s, "pthread_join");
 if (res == PTHREAD_CANCELED)
 printf("Thread was canceled\n");
 else
 printf("Thread was not canceled (should not happen!)\n");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––– threads/thread_cancel.c
```

## 32.4 Kiểm tra khả năng hủy Thread (Testing for Thread Cancellation)

Trong [Liệt kê 32-1,](#page-57-0) Thread được tạo bởi `main()` đã chấp nhận yêu cầu hủy vì nó thực thi một hàm là điểm hủy (cancellation point) (`sleep()` là một điểm hủy; `printf()` có thể là một điểm hủy). Tuy nhiên, giả sử một Thread thực thi một vòng lặp không chứa bất kỳ điểm hủy nào (ví dụ: một vòng lặp thiên về tính toán - compute-bound loop). Trong trường hợp này, Thread sẽ không bao giờ tuân theo yêu cầu hủy.

Mục đích của hàm `pthread_testcancel()` đơn giản là tạo ra một điểm hủy. Nếu một yêu cầu hủy đang chờ xử lý (pending) khi hàm này được gọi, thì Thread gọi hàm sẽ bị kết thúc.

```
## include <pthread.h>
void pthread_testcancel(void);
```

Một Thread đang thực thi mã nguồn không bao gồm các điểm hủy có thể định kỳ gọi `pthread_testcancel()` để đảm bảo rằng nó phản hồi một cách kịp thời đối với yêu cầu hủy do một Thread khác gửi đến.

## 32.5 Trình xử lý dọn dẹp (Cleanup Handlers)

Nếu một thread (luồng) đang có cờ hủy chờ xử lý (pending cancellation) bị chấm dứt đột ngột khi nó chạm tới một điểm hủy (cancellation point), thì các biến chia sẻ (shared variables) và các đối tượng Pthreads (ví dụ: mutex) có thể bị bỏ lại ở trạng thái không nhất quán (inconsistent state), có khả năng khiến các thread còn lại trong tiến trình (process) tạo ra kết quả sai lệch, gây ra deadlock (bế tắc), hoặc crash (sự cố treo/hỏng). Để giải quyết vấn đề này, một thread có thể thiết lập một hoặc nhiều trình xử lý dọn dẹp (cleanup handler) — là các hàm được thực thi tự động nếu thread đó bị hủy (canceled). Một cleanup handler có thể thực hiện các tác vụ như sửa đổi giá trị của biến toàn cục và mở khóa mutex trước khi thread bị chấm dứt.

Mỗi thread có thể có một stack (ngăn xếp) chứa các cleanup handler. Khi một thread bị hủy, các cleanup handler sẽ được thực thi theo thứ tự từ đỉnh stack đi xuống; nghĩa là, handler được thiết lập gần nhất sẽ được gọi đầu tiên, tiếp theo là handler được thiết lập gần thứ nhì, cứ thế tiếp tục. Khi tất cả các cleanup handler đã được thực thi, thread sẽ kết thúc.

Các hàm `pthread_cleanup_push()` và `pthread_cleanup_pop()` lần lượt có nhiệm vụ thêm và xóa các handler trên stack cleanup handler của thread gọi.

```
## include <pthread.h>
void pthread_cleanup_push(void (*routine)(void*), void *arg);
void pthread_cleanup_pop(int execute);
```

Hàm `pthread_cleanup_push()` thêm hàm có địa chỉ được chỉ định trong tham số `routine` lên đỉnh stack cleanup handler của thread gọi. Tham số `routine` là một con trỏ trỏ tới một hàm có dạng sau:

```
void
routine(void *arg)
{
 /* Code thực hiện dọn dẹp */
}
```

Giá trị `arg` truyền cho `pthread_cleanup_push()` sẽ được truyền làm đối số cho cleanup handler khi nó được gọi. Đối số này được định nghĩa kiểu là `void *`, nhưng bằng cách ép kiểu (casting) cẩn thận, các kiểu dữ liệu khác có thể được truyền thông qua đối số này.

Thông thường, hành động dọn dẹp chỉ cần thiết nếu một thread bị hủy trong khi đang thực thi một đoạn mã (section of code) cụ thể nào đó. Nếu thread đi đến cuối đoạn mã đó mà không bị hủy, thì hành động dọn dẹp không còn cần thiết nữa. Do đó, mỗi lời gọi `pthread_cleanup_push()` sẽ đi kèm với một lời gọi `pthread_cleanup_pop()`. Hàm này sẽ gỡ bỏ hàm ở đỉnh stack của các cleanup handler. Nếu đối số `execute` khác không (nonzero), handler cũng sẽ đồng thời được thực thi. Điều này rất tiện lợi nếu chúng ta muốn thực hiện hành động dọn dẹp ngay cả khi thread không bị hủy.

Mặc dù chúng ta đã mô tả `pthread_cleanup_push()` và `pthread_cleanup_pop()` là các hàm, SUSv3 cho phép chúng được triển khai dưới dạng macro mở rộng thành một chuỗi câu lệnh bao gồm dấu ngoặc nhọn mở (`{`) và đóng (`}`) lần lượt ở đầu và cuối. Không phải mọi bản triển khai UNIX đều làm theo cách này, nhưng Linux và nhiều hệ thống khác thì có. Điều này có nghĩa là mỗi lần sử dụng `pthread_cleanup_push()` phải được ghép đôi chính xác với một `pthread_cleanup_pop()` tương ứng trong cùng một khối từ vựng (lexical block). (Trên các hệ thống triển khai theo cách này, các biến được khai báo giữa `pthread_cleanup_push()` và `pthread_cleanup_pop()` sẽ bị giới hạn trong phạm vi từ vựng đó). Ví dụ, việc viết mã như sau là không hợp lệ:

```
pthread_cleanup_push(func, arg);
...
if (cond) {
 pthread_cleanup_pop(0);
}
```

Để thuận tiện cho việc viết mã, bất kỳ cleanup handler nào chưa bị pop (gỡ khỏi stack) cũng sẽ được tự động thực thi nếu thread kết thúc bằng cách gọi `pthread_exit()` (nhưng không được thực thi nếu thread chỉ đơn thuần return).

### Chương trình ví dụ

Chương trình trong [Liệt kê 32-2](#page-61-0) cung cấp một ví dụ đơn giản về cách sử dụng cleanup handler. Chương trình chính tạo ra một thread `i` mà các thao tác đầu tiên của nó là cấp phát một khối bộ nhớ `e` có vị trí được lưu trong `buf`, và sau đó khóa mutex `mtx` `r`. Vì thread có thể bị hủy, nó sử dụng `pthread_cleanup_push()` `t` để cài đặt một cleanup handler được gọi với địa chỉ được lưu trong `buf`. Nếu được kích hoạt, cleanup handler sẽ giải phóng bộ nhớ đã cấp phát `q` và mở khóa mutex `w`.

Thread sau đó bước vào một vòng lặp chờ biến điều kiện (condition variable) `cond` phát tín hiệu `y`. Vòng lặp này sẽ kết thúc theo một trong hai cách, tùy thuộc vào việc chương trình có được cung cấp đối số dòng lệnh (command-line argument) hay không:

- Nếu không có đối số dòng lệnh nào được cung cấp, thread sẽ bị hủy bởi hàm `main()` `o`. Trong trường hợp này, việc hủy sẽ xảy ra tại lời gọi `pthread_cond_wait()` `y`, đây là một trong những điểm hủy được hiển thị trong Bảng 32-1. Như một phần của tiến trình hủy, cleanup handler được thiết lập bằng `pthread_cleanup_push()` sẽ được tự động gọi.
- Nếu một đối số dòng lệnh được cung cấp, biến điều kiện sẽ phát tín hiệu `a` sau khi biến toàn cục tương ứng, `glob`, được gán một giá trị khác không trước đó. Trong trường hợp này, thread sẽ đi tiếp xuống để thực thi `pthread_cleanup_pop()` `u`, hàm này với đối số khác không cũng sẽ khiến cho cleanup handler được gọi.

Chương trình chính thực hiện join với thread đã kết thúc `s`, và báo cáo xem thread đó đã bị hủy hay kết thúc một cách bình thường.

```
–––––––––––––––––––––––––––––––––––––––––––––––––– threads/thread_cleanup.c
## include <pthread.h>
## include "tlpi_hdr.h"
  static pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
  static pthread_mutex_t mtx = PTHREAD_MUTEX_INITIALIZER;
  static int glob = 0; /* Biến vị từ (Predicate variable) */
  static void /* Giải phóng vùng nhớ trỏ bởi 'arg' và mở khóa mutex */
  cleanupHandler(void *arg)
  {
   int s;
   printf("cleanup: freeing block at %p\n", arg);
q free(arg);
   printf("cleanup: unlocking mutex\n");
w s = pthread_mutex_unlock(&mtx);
   if (s != 0)
   errExitEN(s, "pthread_mutex_unlock");
  }
  static void *
  threadFunc(void *arg)
  {
   int s;
   void *buf = NULL; /* Bộ đệm được cấp phát bởi thread */
e buf = malloc(0x10000); /* Không phải là điểm hủy bỏ (cancellation point) */
   printf("thread: allocated memory at %p\n", buf);
r s = pthread_mutex_lock(&mtx); /* Không phải là điểm hủy bỏ */
   if (s != 0)
   errExitEN(s, "pthread_mutex_lock");
t pthread_cleanup_push(cleanupHandler, buf);
   while (glob == 0) {
y s = pthread_cond_wait(&cond, &mtx); /* Một điểm hủy bỏ */
   if (s != 0)
   errExitEN(s, "pthread_cond_wait");
   }
   printf("thread: condition wait loop completed\n");
u pthread_cleanup_pop(1); /* Thực thi hàm dọn dẹp */
   return NULL;
  }
  int
  main(int argc, char *argv[])
  {
   pthread_t thr;
   void *res;
   int s;
```

```
i s = pthread_create(&thr, NULL, threadFunc, NULL);
   if (s != 0)
   errExitEN(s, "pthread_create");
   sleep(2); /* Cho thread có thời gian bắt đầu */
   if (argc == 1) { /* Hủy bỏ thread */
   printf("main: about to cancel thread\n");
o s = pthread_cancel(thr);
   if (s != 0)
   errExitEN(s, "pthread_cancel");
   } else { /* Phát tín hiệu cho biến điều kiện (condition variable) */
   printf("main: about to signal condition variable\n");
   glob = 1;
a s = pthread_cond_signal(&cond);
   if (s != 0)
   errExitEN(s, "pthread_cond_signal");
   }
s s = pthread_join(thr, &res);
   if (s != 0)
   errExitEN(s, "pthread_join");
   if (res == PTHREAD_CANCELED)
   printf("main: thread was canceled\n");
   else
   printf("main: thread terminated normally\n");
   exit(EXIT_SUCCESS);
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––– threads/thread_cleanup.c
```

Nếu chúng ta chạy chương trình trong [Listing 32-2](#page-61-0) mà không có bất kỳ đối số dòng lệnh (command-line argument) nào, hàm main() sẽ gọi `pthread_cancel()`, hàm dọn dẹp (cleanup handler) được gọi tự động và chúng ta thấy kết quả sau:

### \$ **./thread_cleanup**

thread: allocated memory at 0x804b050 main: about to cancel thread cleanup: freeing block at 0x804b050 cleanup: unlocking mutex main: thread was canceled

Nếu chúng ta chạy chương trình với một đối số dòng lệnh, main() sẽ đặt `glob` thành 1 và phát tín hiệu cho biến điều kiện, hàm dọn dẹp được gọi bởi `pthread_cleanup_pop()`, và chúng ta thấy kết quả sau:

### \$ **./thread_cleanup s**

thread: allocated memory at 0x804b050 main: about to signal condition variable thread: condition wait loop completed cleanup: freeing block at 0x804b050 cleanup: unlocking mutex main: thread terminated normally

## 32.6 Khả năng hủy bất đồng bộ (Asynchronous Cancelability)

Khi một thread được cấu hình ở trạng thái có thể hủy bất đồng bộ (loại khả năng hủy `PTHREAD_CANCEL_ASYNCHRONOUS`), nó có thể bị hủy tại bất kỳ thời điểm nào (nghĩa là tại bất kỳ câu lệnh ngôn ngữ máy nào); việc gửi tín hiệu hủy không bị trì hoãn cho đến khi thread đó chạm tới điểm hủy (cancellation point) tiếp theo.

Vấn đề với việc hủy bất đồng bộ (asynchronous cancellation) là mặc dù các hàm dọn dẹp (cleanup handlers) vẫn được gọi, nhưng các hàm này không có cách nào xác định được trạng thái của thread. Trong chương trình tại [Liệt kê 32-2,](#page-61-0) sử dụng loại khả năng hủy trì hoãn (deferred cancelability type), thread chỉ có thể bị hủy khi nó thực thi lời gọi `pthread_cond_wait()`, đây là điểm hủy duy nhất. Vào thời điểm này, chúng ta biết rằng `buf` đã được khởi tạo để trỏ đến một khối bộ nhớ được cấp phát và mutex `mtx` đã được khóa (locked). Tuy nhiên, với khả năng hủy bất đồng bộ, thread có thể bị hủy tại bất kỳ điểm nào; ví dụ, trước lời gọi `malloc()`, giữa lời gọi `malloc()` và việc khóa mutex, hoặc sau khi khóa mutex. Hàm dọn dẹp không có cách nào biết được việc hủy đã xảy ra ở đâu, hoặc chính xác những bước dọn dẹp nào là cần thiết. Hơn nữa, thread thậm chí có thể bị hủy ngay trong lời gọi `malloc()`, sau đó sự hỗn loạn rất dễ xảy ra (Mục 7.1.3).

Theo nguyên tắc chung, một thread có khả năng hủy bất đồng bộ không thể cấp phát bất kỳ tài nguyên nào hoặc thu giữ bất kỳ mutex, semaphore hoặc khóa (lock) nào. Điều này loại trừ việc sử dụng một phạm vi rộng các hàm thư viện, bao gồm hầu hết các hàm Pthreads. (SUSv3 đưa ra ngoại lệ cho `pthread_cancel()`, `pthread_setcancelstate()` và `pthread_setcanceltype()`, những hàm này được yêu cầu rõ ràng là an toàn khi hủy bất đồng bộ - *async-cancel-safe*; nghĩa là, một bản cài đặt phải đảm bảo chúng an toàn khi được gọi từ một thread có khả năng hủy bất đồng bộ). Nói cách khác, có rất ít trường hợp mà việc hủy bất đồng bộ hữu ích. Một trường hợp như vậy là hủy một thread đang nằm trong một vòng lặp nặng về tính toán (compute-bound loop).

## 32.7 Tóm tắt

Hàm `pthread_cancel()` cho phép một thread gửi yêu cầu hủy tới một thread khác, đây là yêu cầu buộc thread đích (target thread) phải chấm dứt hoạt động.

Cách mà thread đích phản ứng với yêu cầu này được quyết định bởi trạng thái và loại khả năng hủy của nó. Nếu trạng thái khả năng hủy (cancelability state) hiện đang được đặt là vô hiệu hóa (disabled), yêu cầu sẽ ở trạng thái chờ xử lý (pending) cho đến khi trạng thái khả năng hủy được bật lên (enabled). Nếu khả năng hủy được bật, loại khả năng hủy (cancelability type) sẽ quyết định thời điểm thread đích phản ứng với yêu cầu. Nếu loại là trì hoãn (deferred), việc hủy sẽ xảy ra khi thread gọi một trong số các hàm được chỉ định là điểm hủy (cancellation points) bởi SUSv3. Nếu loại là bất đồng bộ (asynchronous), việc hủy có thể xảy ra bất cứ lúc nào (điều này hiếm khi hữu ích).

Một thread có thể thiết lập một ngăn xếp (stack) gồm các hàm dọn dẹp (cleanup handlers), đây là các hàm do lập trình viên định nghĩa được gọi tự động để thực hiện việc dọn dẹp (ví dụ: khôi phục trạng thái của các biến dùng chung, hoặc mở khóa các mutex) nếu thread đó bị hủy.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê tại Mục [29.10.](#page-12-0)
