# Chương 32: Luồng: Hủy luồng (Threads: Thread Cancellation)

Thông thường, nhiều thread thực thi song song, với mỗi thread thực hiện tác vụ của mình cho đến khi tự kết thúc bằng cách gọi `pthread_exit()` hoặc trả về từ hàm khởi động (start function) của thread đó.

Đôi khi, việc hủy một thread (cancel a thread) là rất hữu ích; tức là gửi cho nó một yêu cầu chấm dứt ngay lập tức. Điều này có thể hữu ích, chẳng hạn như khi một nhóm thread đang thực hiện một phép tính và một thread phát hiện lỗi đòi hỏi tất cả các thread còn lại phải dừng lại. Hoặc một trường hợp khác, một ứng dụng có giao diện đồ họa (GUI) có thể cung cấp nút Hủy ("Cancel") để người dùng dừng một tác vụ đang chạy nền; lúc này, thread chính (quản lý GUI) cần yêu cầu thread chạy nền chấm dứt.

Trong chương này, chúng ta sẽ tìm hiểu cơ chế hủy thread của chuẩn POSIX threads (Pthreads).

## 32.1 Hủy một Thread

Hàm `pthread_cancel()` gửi một yêu cầu hủy đến một thread được chỉ định.

```c
## include <pthread.h>

int pthread_cancel(pthread_t thread);
```

*Trả về 0 nếu thành công, hoặc một số dương biểu thị mã lỗi nếu thất bại.*

Sau khi phát đi yêu cầu hủy, `pthread_cancel()` trả về ngay lập tức; nghĩa là nó không đợi thread mục tiêu chấm dứt hoàn toàn.

Chính xác điều gì sẽ xảy ra với thread mục tiêu và thời điểm xảy ra phụ thuộc vào trạng thái hủy (cancellation state) và kiểu hủy (cancellation type) của thread đó, như sẽ được mô tả trong phần tiếp theo.

## 32.2 Trạng thái và Kiểu Hủy

Các hàm `pthread_setcancelstate()` và `pthread_setcanceltype()` thiết lập các cờ cho phép một thread kiểm soát cách nó phản ứng với một yêu cầu hủy.

```c
## include <pthread.h>

int pthread_setcancelstate(int state, int *oldstate);
int pthread_setcanceltype(int type, int *oldtype);
```

*Cả hai hàm đều trả về 0 nếu thành công, hoặc một số dương biểu thị mã lỗi nếu thất bại.*

Hàm `pthread_setcancelstate()` thiết lập trạng thái khả năng hủy (cancelability state) của thread gọi hàm thành giá trị được cung cấp trong `state`. Tham số này nhận một trong các giá trị sau:

- `PTHREAD_CANCEL_DISABLE`: Thread không thể bị hủy. Nếu nhận được một yêu cầu hủy, yêu cầu đó sẽ ở trạng thái chờ xử lý (pending) cho đến khi khả năng hủy được kích hoạt trở lại.
- `PTHREAD_CANCEL_ENABLE`: Thread có thể bị hủy. Đây là trạng thái khả năng hủy mặc định của các thread mới tạo.

Trạng thái khả năng hủy trước đó của thread được ghi lại vào vùng nhớ trỏ bởi `oldstate`.

> [!NOTE]
> Nếu không quan tâm đến trạng thái khả năng hủy trước đó, Linux cho phép truyền `NULL` vào `oldstate`. Nhiều hệ thống triển khai khác cũng hỗ trợ điều này; tuy nhiên, SUSv3 không quy định đặc tính này, do đó các ứng dụng muốn đảm bảo tính khả chuyển (portable) không nên dựa vào đó. Ta nên luôn truyền một con trỏ khác `NULL` cho `oldstate`.

Việc tạm thời vô hiệu hóa khả năng hủy (`PTHREAD_CANCEL_DISABLE`) rất hữu ích khi thread đang thực thi một đoạn mã quan trọng mà tất cả các bước đều phải được hoàn tất trọn vẹn (atomic/critical section).

Nếu thread cho phép hủy (`PTHREAD_CANCEL_ENABLE`), việc xử lý yêu cầu hủy sẽ được quyết định bởi kiểu khả năng hủy (cancelability type) của thread, được chỉ định qua tham số `type` trong lời gọi `pthread_setcanceltype()`. Tham số này nhận một trong các giá trị sau:

- `PTHREAD_CANCEL_ASYNCHRONOUS`: Thread có thể bị hủy tại bất kỳ thời điểm nào (có thể ngay lập tức, nhưng không bắt buộc phải ngay lập tức). Kiểu hủy bất đồng bộ hiếm khi hữu dụng, chúng ta sẽ hoãn thảo luận chi tiết về nó đến Mục 32.6.
- `PTHREAD_CANCEL_DEFERRED`: Yêu cầu hủy sẽ ở trạng thái chờ xử lý cho đến khi thread chạm tới một điểm hủy (cancellation point - xem mục kế tiếp). Đây là kiểu khả năng hủy mặc định của các thread mới tạo. Chúng ta sẽ tìm hiểu kỹ hơn về kiểu hủy hoãn lại này trong các phần tiếp theo.

Kiểu khả năng hủy trước đó của thread được ghi lại vào vùng nhớ trỏ bởi `oldtype`.

> [!NOTE]
> Tương tự như tham số `oldstate` của `pthread_setcancelstate()`, nhiều hệ thống triển khai (bao gồm cả Linux) cho phép truyền `oldtype` là `NULL` nếu không cần dùng đến giá trị cũ. Tuy nhiên, SUSv3 không quy định điều này và các ứng dụng khả chuyển không nên lạm dụng. Ta nên luôn truyền một con trỏ khác `NULL` cho `oldtype`.

Khi một thread gọi `fork()`, tiến trình con kế thừa kiểu và trạng thái khả năng hủy của thread gọi đó. Khi một thread gọi `exec()`, kiểu và trạng thái khả năng hủy của thread chính trong chương trình mới sẽ được đặt lại về giá trị mặc định, lần lượt là `PTHREAD_CANCEL_ENABLE` và `PTHREAD_CANCEL_DEFERRED`.

## 32.3 Điểm Hủy (Cancellation Points)

Khi khả năng hủy được bật và ở chế độ hoãn lại (`deferred`), yêu cầu hủy chỉ được thực thi khi thread chạm tới một điểm hủy tiếp theo. Điểm hủy (cancellation point) thực chất là lời gọi đến một trong các hàm được quy định sẵn bởi hệ thống triển khai.

SUSv3 quy định rằng các hàm được liệt kê trong Bảng 32-1 bắt buộc phải là các điểm hủy nếu chúng được hệ thống triển khai cung cấp. Hầu hết trong số này là các hàm có khả năng chặn (block) thread trong một khoảng thời gian không xác định.

**Bảng 32-1:** Các hàm bắt buộc phải là điểm hủy theo SUSv3

| | | |
|---|---|---|
| `accept()` | `nanosleep()` | `sem_timedwait()` |
| `aio_suspend()` | `open()` | `sem_wait()` |
| `clock_nanosleep()` | `pause()` | `send()` |
| `close()` | `poll()` | `sendmsg()` |
| `connect()` | `pread()` | `sendto()` |
| `creat()` | `pselect()` | `sigpause()` |
| `fcntl(F_SETLKW)` | `pthread_cond_timedwait()` | `sigsuspend()` |
| `fsync()` | `pthread_cond_wait()` | `sigtimedwait()` |
| `fdatasync()` | `pthread_join()` | `sigwait()` |
| `getmsg()` | `pthread_testcancel()` | `sigwaitinfo()` |
| `getpmsg()` | `putmsg()` | `sleep()` |
| `lockf(F_LOCK)` | `putpmsg()` | `system()` |
| `mq_receive()` | `pwrite()` | `tcdrain()` |
| `mq_send()` | `read()` | `usleep()` |
| `mq_timedreceive()` | `readv()` | `wait()` |
| `mq_timedsend()` | `recv()` | `waitid()` |
| `msgrcv()` | `recvfrom()` | `waitpid()` |
| `msgsnd()` | `recvmsg()` | `write()` |
| `msync()` | `select()` | `writev()` |

Ngoài các hàm trong Bảng 32-1, SUSv3 còn quy định một nhóm hàm mở rộng mà một bản cài đặt có thể định nghĩa làm điểm hủy. Nhóm này bao gồm các hàm trong thư viện `stdio`, API `dlopen`, API `syslog`, `nftw()`, `popen()`, `semop()`, `unlink()`, cùng nhiều hàm truy xuất thông tin từ các tệp hệ thống như tệp `utmp`. Một chương trình chuẩn khả chuyển phải xử lý thỏa đáng tình huống một thread có thể bị hủy khi gọi các hàm này.

SUSv3 chỉ rõ rằng ngoại trừ hai danh sách hàm bắt buộc và tùy chọn nêu trên, không có hàm nào khác trong tiêu chuẩn được phép hoạt động như điểm hủy (nghĩa là một chương trình khả chuyển không cần phải bận tâm đến việc gọi các hàm khác có thể kích hoạt tiến trình hủy thread).

SUSv4 đã bổ sung `openat()` vào danh sách bắt buộc, đồng thời chuyển `sigpause()` sang danh sách tùy chọn và loại bỏ hoàn toàn `usleep()` khỏi tiêu chuẩn.

> [!NOTE]
> Bản cài đặt hệ thống được tự do chỉ định thêm các hàm ngoài tiêu chuẩn làm điểm hủy. Bất kỳ hàm nào có khả năng bị block (chẳng hạn do truy cập tệp) đều là ứng cử viên tiềm năng. Trong `glibc`, rất nhiều hàm phi chuẩn được đánh dấu là điểm hủy vì lý do này.

Khi nhận được yêu cầu hủy, một thread có khả năng hủy được bật ở chế độ hoãn lại sẽ kết thúc khi nó chạm tới điểm hủy tiếp theo. Nếu thread chưa được tách rời (detached), một thread khác trong tiến trình phải thực hiện `join` với nó để tránh biến nó thành một zombie thread. Khi một thread bị hủy được thu gom bằng `pthread_join()`, giá trị trả về nhận được qua đối số thứ hai của hàm sẽ là hằng số đặc biệt: `PTHREAD_CANCELED`.

### Chương trình ví dụ

Listing 32-1 minh họa cách sử dụng cơ bản của hàm `pthread_cancel()`. Chương trình chính tạo ra một thread chạy vòng lặp vô hạn, tạm dừng 1 giây và in giá trị biến đếm. (Thread này sẽ chỉ kết thúc nếu nhận được yêu cầu hủy hoặc khi cả tiến trình thoát). Trong lúc đó, hàm `main()` ngủ 3 giây rồi gửi yêu cầu hủy tới thread vừa tạo. Khi chạy chương trình, kết quả thu được như sau:

```bash
$ ./t_pthread_cancel
New thread started
Loop 1
Loop 2
Loop 3
Thread was canceled
```

**Listing 32-1:** Hủy một thread bằng `pthread_cancel()`

```c
/* threads/thread_cancel.c */

## include <pthread.h>
## include "tlpi_hdr.h"

static void *
threadFunc(void *arg)
{
    int j;

    printf("New thread started\n"); /* Có thể là một điểm hủy */
    for (j = 1; ; j++) {
        printf("Loop %d\n", j);     /* Có thể là một điểm hủy */
        sleep(1);                   /* Điểm hủy chắc chắn */
    }

    /* KHÔNG BAO GIỜ CHẠY TỚI ĐÂY */
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

    sleep(3);                       /* Để thread mới chạy trong giây lát */

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
```

## 32.4 Kiểm tra Chủ động Yêu cầu Hủy Thread

Trong Listing 32-1, thread được tạo bởi `main()` chấp nhận yêu cầu hủy vì nó thực thi một hàm là điểm hủy (`sleep()` là điểm hủy; `printf()` có thể là điểm hủy). Tuy nhiên, giả sử một thread thực thi một vòng lặp không chứa bất kỳ điểm hủy nào (ví dụ: vòng lặp thuần tính toán - compute-bound loop). Trong trường hợp đó, thread sẽ không bao giờ phản hồi yêu cầu hủy.

Mục đích duy nhất của hàm `pthread_testcancel()` là chủ động tạo ra một điểm hủy. Nếu đang có một yêu cầu hủy ở trạng thái chờ xử lý (pending), thread gọi hàm sẽ lập tức kết thúc.

```c
## include <pthread.h>

void pthread_testcancel(void);
```

Một thread đang chạy các đoạn mã không có lời gọi hàm điểm hủy nào khác có thể định kỳ gọi `pthread_testcancel()` để đảm bảo đáp ứng kịp thời các yêu cầu hủy được gửi từ thread khác.

## 32.5 Trình Xử lý Dọn dẹp (Cleanup Handlers)

Nếu một thread có yêu cầu hủy đang chờ mà bị kết thúc đột ngột ngay khi chạm tới một điểm hủy, thì các biến dùng chung và các đối tượng Pthreads (chẳng hạn như mutex) có thể bị bỏ lại ở trạng thái không nhất quán. Hậu quả là các thread còn lại trong tiến trình có thể tính toán sai, rơi vào bế tắc (deadlock) hoặc bị đổ vỡ (crash). Để giải quyết vấn đề này, một thread có thể thiết lập một hoặc nhiều trình xử lý dọn dẹp (cleanup handler) — là các hàm được tự động thực thi nếu thread bị hủy. Một cleanup handler có thể thực hiện các thao tác như khôi phục giá trị các biến toàn cục và mở khóa mutex trước khi thread chính thức dừng lại.

Mỗi thread sở hữu một ngăn xếp (stack) các cleanup handler. Khi một thread bị hủy, các handler sẽ được thực thi theo thứ tự từ đỉnh stack xuống; nghĩa là handler nào được thiết lập gần nhất sẽ được gọi đầu tiên, kế đến là handler được thiết lập trước đó, cứ tuần tự như vậy. Khi toàn bộ các cleanup handler đã thực thi xong, thread mới kết thúc.

Các hàm `pthread_cleanup_push()` và `pthread_cleanup_pop()` lần lượt có nhiệm vụ đẩy thêm và lấy bớt các handler ra khỏi ngăn xếp của thread gọi.

```c
## include <pthread.h>

void pthread_cleanup_push(void (*routine)(void *), void *arg);
void pthread_cleanup_pop(int execute);
```

Hàm `pthread_cleanup_push()` đẩy hàm có địa chỉ chỉ định trong `routine` lên đỉnh ngăn xếp cleanup handler của thread gọi. Tham số `routine` là một con trỏ hàm có dạng:

```c
void
routine(void *arg)
{
    /* Mã thực hiện thao tác dọn dẹp */
}
```

Giá trị `arg` truyền vào `pthread_cleanup_push()` sẽ được chuyển tiếp làm đối số duy nhất cho handler khi hàm này được kích hoạt. Đối số này có kiểu `void *`, nhưng thông qua kỹ thuật ép kiểu (casting) hợp lý, ta có thể truyền bất kỳ kiểu dữ liệu nào qua nó.

Thông thường, thao tác dọn dẹp chỉ cần thiết nếu thread bị hủy khi đang chạy dở một đoạn mã nhất định. Nếu thread chạy qua hết đoạn mã đó an toàn mà không bị hủy, hành động dọn dẹp không còn cần thiết nữa. Do đó, mỗi lời gọi `pthread_cleanup_push()` luôn đi kèm một lời gọi `pthread_cleanup_pop()`. Hàm này sẽ loại bỏ handler nằm ở đỉnh ngăn xếp. Nếu đối số `execute` mang giá trị khác 0, handler đó cũng sẽ được gọi thực thi ngay lập tức. Điều này rất tiện lợi nếu ta muốn dùng chung logic dọn dẹp tài nguyên ngay cả khi thread kết thúc bình thường.

Mặc dù được mô tả như các hàm thông thường, SUSv3 cho phép `pthread_cleanup_push()` và `pthread_cleanup_pop()` được triển khai dưới dạng macro, mở rộng thành các khối lệnh lần lượt chứa dấu mở ngoặc nhọn (`{`) và đóng ngoặc nhọn (`}`). Không phải mọi hệ thống UNIX đều làm như vậy, nhưng Linux và nhiều hệ thống khác thì có. Điều này đồng nghĩa với việc mỗi lời gọi `pthread_cleanup_push()` **bắt buộc** phải được ghép cặp tương ứng với duy nhất một lời gọi `pthread_cleanup_pop()` trong **cùng một khối phạm vi từ vựng** (lexical block). (Trên các hệ thống triển khai theo cơ chế này, biến nào khai báo giữa `pthread_cleanup_push()` và `pthread_cleanup_pop()` sẽ chỉ có phạm vi hiệu lực cục bộ trong khối đó). Ví dụ, đoạn mã sau đây là không hợp lệ và sẽ gây lỗi biên dịch:

```c
pthread_cleanup_push(func, arg);
...
if (cond) {
    pthread_cleanup_pop(0);
}
```

Để thuận tiện cho lập trình, bất kỳ cleanup handler nào chưa được pop ra khỏi ngăn xếp cũng sẽ được tự động thực thi nếu thread kết thúc bằng cách gọi `pthread_exit()` (nhưng **không** được thực thi nếu thread chỉ đơn thuần dùng lệnh `return`).

### Chương trình ví dụ

Listing 32-2 minh họa việc sử dụng cleanup handler. Chương trình chính tạo một thread `[i]`. Các thao tác đầu tiên của thread này là cấp phát một khối bộ nhớ `[e]` lưu địa chỉ vào `buf`, sau đó khóa mutex `mtx` `[r]`. Vì thread có nguy cơ bị hủy, nó dùng `pthread_cleanup_push()` `[t]` để đăng ký một cleanup handler nhận đối số là con trỏ `buf`. Nếu được kích hoạt, cleanup handler sẽ giải phóng khối bộ nhớ `[q]` và mở khóa mutex `[w]`.

Thread sau đó đi vào vòng lặp chờ biến điều kiện `cond` được báo hiệu `[y]`. Vòng lặp này sẽ kết thúc theo một trong hai kịch bản, tùy thuộc vào việc chương trình có nhận đối số dòng lệnh hay không:

- Nếu không truyền đối số dòng lệnh: Thread sẽ bị `main()` gửi yêu cầu hủy `[o]`. Khi đó, sự kiện hủy xảy ra tại điểm hủy `pthread_cond_wait()` `[y]`, một trong các hàm thuộc Bảng 32-1. Nằm trong quy trình hủy, cleanup handler đã đăng ký bằng `pthread_cleanup_push()` sẽ tự động được gọi.
- Nếu có truyền đối số dòng lệnh: Biến điều kiện sẽ được phát tín hiệu `[a]` sau khi biến toàn cục kiểm tra `glob` được gán giá trị khác 0. Trong trường hợp này, thread thoát khỏi vòng lặp và đi xuống thực thi `pthread_cleanup_pop()` `[u]`. Với đối số truyền vào khác 0, hàm này cũng kích hoạt thực thi cleanup handler.

Chương trình chính thu gom thread đã kết thúc bằng `pthread_join()` `[s]`, rồi in ra thông báo thread đã bị hủy hay đã kết thúc bình thường.

**Listing 32-2:** Dọn dẹp tài nguyên khi thread bị hủy bằng cleanup handler

```c
/* threads/thread_cleanup.c */

## include <pthread.h>
## include "tlpi_hdr.h"

static pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
static pthread_mutex_t mtx = PTHREAD_MUTEX_INITIALIZER;
static int glob = 0; /* Biến vị từ (Predicate variable) */

static void /* Giải phóng khối bộ nhớ trỏ bởi 'arg' và mở khóa mutex */
cleanupHandler(void *arg)
{
    int s;

    printf("cleanup: freeing block at %p\n", arg);
/* [q] */ free(arg);

    printf("cleanup: unlocking mutex\n");
/* [w] */ s = pthread_mutex_unlock(&mtx);
    if (s != 0)
        errExitEN(s, "pthread_mutex_unlock");
}

static void *
threadFunc(void *arg)
{
    int s;
    void *buf = NULL; /* Vùng đệm được cấp phát bởi thread */

/* [e] */ buf = malloc(0x10000); /* Không phải là điểm hủy */
    printf("thread: allocated memory at %p\n", buf);

/* [r] */ s = pthread_mutex_lock(&mtx); /* Không phải là điểm hủy */
    if (s != 0)
        errExitEN(s, "pthread_mutex_lock");

/* [t] */ pthread_cleanup_push(cleanupHandler, buf);

    while (glob == 0) {
/* [y] */ s = pthread_cond_wait(&cond, &mtx); /* Một điểm hủy */
        if (s != 0)
            errExitEN(s, "pthread_cond_wait");
    }

    printf("thread: condition wait loop completed\n");
/* [u] */ pthread_cleanup_pop(1); /* Kích hoạt chạy cleanup handler */
    return NULL;
}

int
main(int argc, char *argv[])
{
    pthread_t thr;
    void *res;
    int s;

/* [i] */ s = pthread_create(&thr, NULL, threadFunc, NULL);
    if (s != 0)
        errExitEN(s, "pthread_create");

    sleep(2); /* Cho thread cơ hội khởi động và chạy */

    if (argc == 1) { /* Hủy thread */
        printf("main: about to cancel thread\n");
/* [o] */ s = pthread_cancel(thr);
        if (s != 0)
            errExitEN(s, "pthread_cancel");
    } else { /* Báo hiệu biến điều kiện */
        printf("main: about to signal condition variable\n");
        glob = 1;
/* [a] */ s = pthread_cond_signal(&cond);
        if (s != 0)
            errExitEN(s, "pthread_cond_signal");
    }

/* [s] */ s = pthread_join(thr, &res);
    if (s != 0)
        errExitEN(s, "pthread_join");

    if (res == PTHREAD_CANCELED)
        printf("main: thread was canceled\n");
    else
        printf("main: thread terminated normally\n");

    exit(EXIT_SUCCESS);
}
```

Nếu chạy Listing 32-2 mà không truyền tham số dòng lệnh, `main()` sẽ gọi `pthread_cancel()`, cleanup handler được kích hoạt tự động, và màn hình hiển thị:

```bash
$ ./thread_cleanup
thread: allocated memory at 0x804b050
main: about to cancel thread
cleanup: freeing block at 0x804b050
cleanup: unlocking mutex
main: thread was canceled
```

Nếu chạy kèm một tham số dòng lệnh bất kỳ, `main()` sẽ đặt `glob` thành 1 và báo hiệu biến điều kiện; cleanup handler lúc này được thực thi thông qua lời gọi `pthread_cleanup_pop(1)`:

```bash
$ ./thread_cleanup s
thread: allocated memory at 0x804b050
main: about to signal condition variable
thread: condition wait loop completed
cleanup: freeing block at 0x804b050
cleanup: unlocking mutex
main: thread terminated normally
```

## 32.6 Khả năng Hủy Bất đồng bộ (Asynchronous Cancelability)

Khi một thread được cấu hình khả năng hủy bất đồng bộ (`PTHREAD_CANCEL_ASYNCHRONOUS`), nó có thể bị hủy tại bất kỳ thời điểm nào (nghĩa là tại bất kỳ lệnh mã máy nào); việc thực thi lệnh hủy không cần phải chờ đến khi thread chạm tới điểm hủy tiếp theo.

Vấn đề lớn của việc hủy bất đồng bộ là dù các cleanup handler vẫn được kích hoạt, chúng không có cách nào phán đoán được trạng thái hiện tại của thread. Trong chương trình ở Listing 32-2 (sử dụng chế độ hủy hoãn lại), thread chỉ có thể bị hủy khi đang ở trong hàm `pthread_cond_wait()` — điểm hủy duy nhất. Khi hàm đó được gọi, ta biết chắc chắn biến `buf` đã được cấp phát bộ nhớ hợp lệ và mutex `mtx` đang ở trạng thái bị khóa. Ngược lại, với kiểu hủy bất đồng bộ, thread có thể bị cắt đứt ở bất cứ đâu: trước lời gọi `malloc()`, nằm giữa lệnh `malloc()` và lệnh khóa mutex, hoặc sau khi khóa mutex. Cleanup handler không thể nào biết việc hủy đã diễn ra ở bước nào để dọn dẹp cho chuẩn xác. Tệ hơn nữa, nếu thread bị hủy ngay giữa lúc hàm `malloc()` đang chỉnh sửa cấu trúc heap nội bộ, trạng thái bộ nhớ của toàn bộ tiến trình sẽ rơi vào hỗn loạn (xem Mục 7.1.3).

Vì vậy, theo nguyên tắc chung, một thread có khả năng hủy bất đồng bộ không được phép cấp phát tài nguyên hay thâu tóm bất kỳ mutex, semaphore hoặc cơ chế khóa nào. Quy tắc này loại trừ hầu hết các hàm trong thư viện chuẩn, bao gồm phần lớn các hàm thuộc Pthreads. (SUSv3 chỉ đưa ra ngoại lệ cho `pthread_cancel()`, `pthread_setcancelstate()` và `pthread_setcanceltype()`, vốn là những hàm bắt buộc phải đảm bảo an toàn khi hủy bất đồng bộ — *async-cancel-safe*; nghĩa là hệ thống triển khai phải đảm bảo an toàn khi gọi chúng từ một thread có khả năng hủy bất đồng bộ). Tóm lại, rất hiếm trường hợp mà việc hủy bất đồng bộ mang lại lợi ích thực tế. Một trong số ít trường hợp đó là hủy một thread đang chạy một vòng lặp thuần tính toán nặng.

## 32.7 Tóm tắt

Hàm `pthread_cancel()` cho phép một thread gửi yêu cầu hủy tới một thread khác, tức là yêu cầu thread mục tiêu phải kết thúc.

Cách thức thread mục tiêu phản ứng với yêu cầu này được kiểm soát bởi trạng thái hủy (cancelability state) và kiểu hủy (cancelability type) của nó:

- Nếu trạng thái hủy đang bị vô hiệu hóa (`disabled`), yêu cầu hủy sẽ ở trạng thái chờ xử lý (pending) cho đến khi trạng thái hủy được kích hoạt lại (`enabled`).
- Nếu trạng thái hủy được bật, kiểu hủy sẽ xác định thời điểm thread mục tiêu phản ứng:
  - Nếu là kiểu hoãn lại (`deferred`), hành động hủy chỉ diễn ra khi thread gọi một trong các hàm được SUSv3 định nghĩa là điểm hủy (cancellation points).
  - Nếu là kiểu bất đồng bộ (`asynchronous`), hành động hủy có thể giáng xuống bất kỳ lúc nào (rất hiếm khi nên dùng).

Một thread có thể thiết lập một ngăn xếp các trình xử lý dọn dẹp (cleanup handlers). Đây là các hàm do lập trình viên định nghĩa nhằm tự động dọn dẹp tài nguyên (chẳng hạn như khôi phục trạng thái biến dùng chung hoặc mở khóa mutex) khi thread bị hủy đột ngột.

### Thông tin thêm

Bạn đọc có thể tham khảo các nguồn tài liệu mở rộng được liệt kê tại Mục 29.10.
