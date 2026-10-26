# Chương 25: Kết thúc tiến trình (Process Termination)

Chương này mô tả những gì diễn ra khi một tiến trình kết thúc. Trước tiên, chúng ta sẽ xem xét việc sử dụng `exit()` và `_exit()` để chấm dứt một tiến trình. Tiếp theo, chúng ta thảo luận về việc sử dụng các trình xử lý thoát (exit handler) nhằm tự động thực hiện các thao tác dọn dẹp tài nguyên khi tiến trình gọi `exit()`. Cuối cùng, chúng ta phân tích các tương tác phức tạp giữa `fork()`, bộ đệm stdio (`stdio buffer`), và `exit()`.

## 25.1 Kết thúc một tiến trình: \_exit() và exit()

Một tiến trình có thể kết thúc theo hai trường hợp tổng quát. Thứ nhất là kết thúc bất thường (abnormal termination), xảy ra khi tiến trình nhận một tín hiệu mà hành động mặc định của tín hiệu đó là khai tử tiến trình (có hoặc không kèm theo việc tạo bản ghi sự cố - core dump), như đã mô tả trong Mục 20.1. Thứ hai, một tiến trình có thể kết thúc bình thường (normal termination) thông qua system call `_exit()`.

```c
## include <unistd.h>
void _exit(int status);
```

Đối số `status` truyền vào `_exit()` định nghĩa trạng thái kết thúc (termination status) của tiến trình. Giá trị này sẽ được cung cấp cho tiến trình cha khi tiến trình cha gọi `wait()`. Mặc dù được khai báo kiểu `int`, nhưng trên thực tế chỉ có 8 bit trọng số thấp nhất (least significant 8 bits) của `status` là được chuyển giao cho tiến trình cha. Theo quy ước, trạng thái kết thúc bằng 0 báo hiệu tiến trình đã hoàn thành thành công, trong khi giá trị khác 0 báo hiệu tiến trình kết thúc thất bại. Không có quy tắc cố định nào quy định cách diễn giải các giá trị trạng thái khác 0; mỗi ứng dụng tuân theo quy ước riêng và những quy ước này cần được ghi rõ trong tài liệu kỹ thuật của ứng dụng đó. SUSv3 quy định hai hằng số tiêu chuẩn là `EXIT_SUCCESS` (0) và `EXIT_FAILURE` (1), vốn được sử dụng xuyên suốt hầu hết các chương trình trong cuốn sách này.

Một tiến trình luôn luôn được kết thúc thành công bởi `_exit()` (nghĩa là `_exit()` không bao giờ trả về - *never returns*).

Mặc dù mọi giá trị trong phạm vi từ 0 đến 255 đều có thể được chuyển tới tiến trình cha qua đối số `status` của `_exit()`, nhưng việc chỉ định các giá trị lớn hơn 128 có thể gây nhầm lẫn trong các shell script. Lý do là khi một lệnh bị chấm dứt bởi một tín hiệu, shell sẽ biểu thị điều này bằng cách gán giá trị của biến `$?` bằng 128 cộng với số hiệu tín hiệu (signal number); giá trị này sẽ không thể phân biệt được với trường hợp một tiến trình chủ động gọi `_exit()` với cùng một mã trạng thái.

Các chương trình ứng dụng thông thường không gọi trực tiếp `_exit()`, mà gọi hàm thư viện `exit()`. Hàm này thực hiện hàng loạt thao tác dọn dẹp trước khi chuyển giao quyền điều khiển cho `_exit()`.

```c
## include <stdlib.h>
void exit(int status);
```

Các hành động sau đây được `exit()` tuần tự thực thi:

- Các trình xử lý thoát (exit handler - những hàm được đăng ký qua `atexit()` và `on_exit()`) được kích hoạt theo thứ tự ngược với thứ tự đăng ký của chúng (Mục 25.3).
- Các bộ đệm luồng stdio (stdio stream buffers) được xả sạch dữ liệu (flushed).
- System call `_exit()` được gọi, truyền vào giá trị `status` đã cung cấp.

Khác với `_exit()` vốn là hàm đặc thù của hệ thống UNIX, `exit()` được định nghĩa như một phần của thư viện C tiêu chuẩn (Standard C Library); do đó nó khả dụng trong mọi hiện thực C (C implementation).

Một phương thức khác để kết thúc tiến trình là trả về từ `main()` (`return from main()`), có thể là tường minh hoặc ngầm định khi luồng thực thi đi hết phần thân hàm `main()`. Việc thực hiện lệnh `return n` tường minh nhìn chung tương đương với lời gọi `exit(n)`, bởi vì hàm thời gian chạy (run-time function) bao bọc việc khởi tạo `main()` sẽ dùng chính giá trị trả về của `main()` làm đối số gọi `exit()`.

> [!NOTE]
> Có một trường hợp mà việc gọi `exit()` và trả về từ `main()` không hề tương đương: Nếu bất kỳ thao tác nào diễn ra trong quá trình dọn dẹp lúc thoát truy cập vào các biến cục bộ của hàm `main()`, thì việc thực thi lệnh `return` từ `main()` sẽ dẫn đến hành vi không xác định (undefined behavior). Ví dụ: điều này sẽ phát sinh nếu một biến cục bộ trong `main()` từng được truyền vào làm bộ đệm cho lời gọi `setvbuf()` hoặc `setbuf()` (Mục 13.2).

Việc gọi `return` không kèm giá trị, hoặc để luồng thực thi tự rơi khỏi cuối hàm `main()`, cũng sẽ khiến hàm bao ngoài `main()` gọi `exit()`, tuy nhiên kết quả trả về sẽ biến thiên tùy thuộc vào tiêu chuẩn C được áp dụng và các tùy chọn biên dịch:

- Trong chuẩn C89, hành vi này là không xác định (undefined); chương trình có thể kết thúc với một giá trị trạng thái ngẫu nhiên. Đây là hành vi mặc định khi biên dịch bằng `gcc` trên Linux, trong đó trạng thái thoát của chương trình nhận một giá trị rác nằm trên stack hoặc trong một thanh ghi CPU cụ thể. Do đó, cần tuyệt đối tránh kết thúc chương trình theo cách này.
- Tiêu chuẩn C99 quy định rõ ràng rằng việc luồng thực thi đi hết điểm cuối của hàm `main` bắt buộc phải tương đương với lời gọi `exit(0)`. Đây là hành vi thu được trên Linux khi biên dịch chương trình với cờ `gcc -std=c99`.

## 25.2 Chi tiết về quá trình kết thúc tiến trình

Dù tiến trình kết thúc bình thường hay bất thường, kernel đều tự động thực hiện các hành động giải phóng tài nguyên sau:

- Đóng tất cả các bộ mô tả tệp mở (file descriptor), luồng thư mục (directory stream, Mục 18.8), bộ mô tả danh mục thông điệp (message catalog descriptor, xem trang manual `catopen(3)` và `catgets(3)`), và các bộ mô tả chuyển đổi mã hóa (conversion descriptor, xem trang manual `iconv_open(3)`).
- Hệ quả của việc đóng các file descriptor là mọi khóa tệp (file lock, Chương 55) do tiến trình này nắm giữ đều được giải phóng hoàn toàn.
- Mọi phân đoạn bộ nhớ chia sẻ System V (System V shared memory segment) đang gắn kết (attach) sẽ bị tách rời (detach), và bộ đếm `shm_nattch` tương ứng của mỗi phân đoạn sẽ giảm đi 1 (Mục 48.8).
- Với mỗi System V semaphore mà tiến trình đã thiết lập giá trị `semadj`, giá trị `semadj` đó sẽ được hoàn trả (cộng dồn) vào giá trị hiện tại của semaphore (Mục 47.8).
- Nếu tiến trình này là tiến trình điều khiển (controlling process) của một terminal điều khiển (controlling terminal), thì tín hiệu `SIGHUP` sẽ được gửi đến mọi tiến trình nằm trong nhóm tiến trình tiền cảnh (foreground process group) của terminal đó, đồng thời terminal sẽ bị ngắt liên kết khỏi phiên làm việc (session). Chi tiết được trình bày trong Mục 34.6.
- Mọi POSIX named semaphore đang mở trong tiến trình gọi sẽ được đóng lại như thể đã gọi `sem_close()`.
- Mọi POSIX message queue đang mở trong tiến trình gọi sẽ được đóng lại như thể đã gọi `mq_close()`.
- Nếu việc thoát của tiến trình này dẫn tới việc một nhóm tiến trình trở thành mồ côi (orphaned process group) và trong nhóm đó tồn tại bất kỳ tiến trình nào đang bị dừng (stopped process), thì toàn bộ các tiến trình trong nhóm sẽ nhận được một tín hiệu `SIGHUP`, nối tiếp ngay sau là tín hiệu `SIGCONT` (Mục 34.7.4).
- Mọi vùng khóa bộ nhớ do tiến trình này thiết lập thông qua `mlock()` hoặc `mlockall()` (Mục 50.2) đều bị dỡ bỏ.
- Mọi vùng ánh xạ bộ nhớ (memory mapping) do tiến trình thiết lập thông qua `mmap()` sẽ bị hủy ánh xạ (unmapped).

## 25.3 Trình xử lý thoát (Exit Handlers)

Đôi khi, một ứng dụng cần tự động thực thi một số tác vụ nhất định khi tiến trình kết thúc. Xét ví dụ về một thư viện dùng chung: nếu được sử dụng trong suốt vòng đời tiến trình, thư viện cần tự động thực hiện một số bước dọn dẹp tài nguyên nội bộ khi tiến trình thoát. Vì thư viện không thể kiểm soát thời điểm cũng như cách thức tiến trình kết thúc, và cũng không thể ép buộc chương trình chính phải gọi hàm dọn dẹp chuyên biệt của thư viện trước khi thoát, nên thao tác dọn dẹp này khó có thể đảm bảo được diễn ra. Giải pháp tối ưu cho trường hợp này là sử dụng một trình xử lý thoát (exit handler; các tài liệu System V trước đây gọi là *program termination routine*).

Một exit handler là một hàm do lập trình viên định nghĩa, được đăng ký tại một thời điểm bất kỳ trong vòng đời của tiến trình và sau đó sẽ tự động được kích hoạt trong quá trình kết thúc tiến trình bình thường thông qua `exit()`. Các exit handler sẽ **không** được gọi nếu chương trình trực tiếp gọi `_exit()` hoặc nếu tiến trình bị chấm dứt bất thường bởi một tín hiệu.

> [!NOTE]
> Việc exit handler không được gọi khi tiến trình bị kết thúc bởi tín hiệu phần nào làm hạn chế công dụng của cơ chế này. Biện pháp khả thi nhất là cài đặt các bộ xử lý tín hiệu (signal handler) cho những tín hiệu dự kiến gửi tới tiến trình, và cho signal handler bật một cờ hiệu để yêu cầu chương trình chính chủ động gọi `exit()`. (Do `exit()` không thuộc danh sách các hàm an toàn với tín hiệu bất đồng bộ - *async-signal-safe functions* liệt kê ở Bảng 21-1, trang 426, chúng ta thường không được phép gọi nó trực tiếp từ bên trong một signal handler). Dù vậy, cách này cũng bất khả thi đối với `SIGKILL`, vì hành vi mặc định của `SIGKILL` là không thể can thiệp hay thay đổi. Đây là một lý do quan trọng nữa để chúng ta tránh dùng `SIGKILL` khi muốn chấm dứt một tiến trình (như lưu ý ở Mục 20.2), mà thay vào đó nên sử dụng `SIGTERM` - tín hiệu mặc định được phát ra bởi lệnh `kill`.

### Đăng ký exit handler

Thư viện GNU C cung cấp hai cơ chế để đăng ký exit handler. Phương thức thứ nhất, được chuẩn hóa trong SUSv3, là sử dụng hàm `atexit()`.

```c
## include <stdlib.h>
int atexit(void (*func)(void));
                                      Trả về 0 nếu thành công, khác 0 nếu lỗi
```

Hàm `atexit()` sẽ thêm hàm `func` vào danh sách các hàm sẽ được thực thi khi tiến trình kết thúc. Hàm `func` phải được khai báo không nhận tham số và không trả về giá trị, có dạng tổng quát như sau:

```c
void
func(void)
{
    /* Thực hiện một số hành động dọn dẹp */
}
```

Lưu ý rằng `atexit()` trả về một giá trị khác 0 (không nhất thiết là –1) khi xảy ra lỗi.

Chương trình có thể đăng ký nhiều exit handler (và thậm chí có thể đăng ký cùng một hàm nhiều lần). Khi chương trình gọi `exit()`, các hàm này được thực thi theo thứ tự ngược với thứ tự đã đăng ký (LIFO). Thứ tự đảo ngược này là hoàn toàn hợp lý, bởi thông thường các hàm được đăng ký trước sẽ đảm nhiệm các thao tác dọn dẹp mang tính nền tảng hơn, vốn chỉ nên thực thi sau khi các tài nguyên tầng trên (được đăng ký sau) đã được thu dọn xong.

Về bản chất, bất kỳ thao tác hợp lệ nào cũng có thể được thực thi bên trong một exit handler, bao gồm cả việc đăng ký thêm các exit handler mới; các hàm mới đăng ký này sẽ được chèn vào ngay đầu danh sách các hàm đang chờ được gọi tiếp theo. Tuy nhiên, nếu một trong các exit handler không thể quay trở về (failed to return) — do hàm đó gọi `_exit()` hoặc do tiến trình bị chấm dứt bởi một tín hiệu (ví dụ: exit handler tự phát tín hiệu qua `raise()`) — thì toàn bộ các exit handler còn lại trong hàng đợi sẽ bị bỏ qua. Đồng thời, các hành động dọn dẹp tiếp theo mà `exit()` đảm trách (như việc xả các bộ đệm stdio) cũng sẽ không diễn ra.

> [!WARNING]
> SUSv3 quy định rằng nếu một exit handler tự gọi hàm `exit()`, kết quả là không xác định (undefined). Trên Linux, các exit handler còn lại vẫn được kích hoạt bình thường. Tuy nhiên, trên một số hệ thống khác, hành động này khiến toàn bộ chuỗi exit handler bị kích hoạt lại từ đầu, dẫn đến hiện tượng đệ quy vô hạn (cho đến khi lỗi tràn ngăn xếp - stack overflow xảy ra và tiến trình bị hủy). Do đó, các ứng dụng yêu cầu tính khả chuyển (portable) tuyệt đối không được gọi `exit()` bên trong một exit handler.

SUSv3 yêu cầu một hiện thực hệ điều hành phải cho phép một tiến trình đăng ký tối thiểu 32 exit handler. Thông qua lời gọi `sysconf(_SC_ATEXIT_MAX)`, một chương trình có thể truy vấn giới hạn trên do hệ thống quy định đối với số lượng exit handler. (Tuy nhiên, không có hàm nào cung cấp số lượng handler hiện đã được đăng ký). Bằng cách quản lý các exit handler đã đăng ký thông qua một danh sách liên kết cấp phát động, glibc cho phép đăng ký số lượng exit handler gần như vô hạn. Trên Linux, `sysconf(_SC_ATEXIT_MAX)` trả về giá trị 2.147.482.647 (giá trị số nguyên có dấu 32-bit lớn nhất). Nói cách khác, hệ thống sẽ gặp các giới hạn khác (chẳng hạn như cạn kiệt bộ nhớ) trước khi chạm tới giới hạn số lượng hàm có thể đăng ký.

Một tiến trình con được tạo ra thông qua `fork()` sẽ kế thừa nguyên vẹn bản sao danh sách các exit handler đã đăng ký từ tiến trình cha. Khi một tiến trình thực thi `exec()`, toàn bộ các đăng ký exit handler sẽ bị xóa bỏ hoàn toàn. (Điều này là hiển nhiên, vì `exec()` sẽ thay thế toàn bộ không gian mã lệnh hiện có của tiến trình, bao gồm cả mã lệnh của các exit handler).

> [!NOTE]
> Không có cơ chế tiêu chuẩn nào để hủy đăng ký (deregister) một exit handler đã đăng ký qua `atexit()` (hoặc `on_exit()`). Tuy nhiên, chúng ta có thể thiết kế exit handler kiểm tra một cờ toàn cục (global flag) trước khi thực hiện các hành động dọn dẹp; khi cần vô hiệu hóa handler, chương trình chỉ việc xóa cờ này.

Các exit handler đăng ký bằng `atexit()` có hai hạn chế lớn: Thứ nhất, khi được gọi, handler không thể biết được trạng thái kết thúc (`status`) nào đã được truyền vào hàm `exit()`. Trong nhiều ngữ cảnh, việc biết được trạng thái này là rất hữu ích (chẳng hạn ta muốn thực hiện các thao tác dọn dẹp khác nhau tùy thuộc vào việc tiến trình thoát thành công hay thất bại). Hạn chế thứ hai là không thể truyền bất kỳ đối số tùy biến nào vào exit handler tại thời điểm nó được kích hoạt. Khả năng này rất cần thiết khi muốn dùng một hàm xử lý duy nhất nhưng ứng xử linh hoạt theo tham số truyền vào, hoặc đăng ký cùng một hàm nhiều lần với các ngữ cảnh dữ liệu khác nhau.

Để khắc phục các hạn chế trên, glibc cung cấp một phương thức mở rộng (không thuộc chuẩn POSIX): hàm `on_exit()`.

```c
## define _BSD_SOURCE /* Hoặc: #define _SVID_SOURCE */
## include <stdlib.h>
int on_exit(void (*func)(int, void *), void *arg);
                                      Trả về 0 nếu thành công, khác 0 nếu lỗi
```

Đối số `func` của `on_exit()` là một con trỏ hàm có nguyên mẫu như sau:

```c
void
func(int status, void *arg)
{
    /* Thực hiện các hành động dọn dẹp */
}
```

Khi được gọi, `func()` sẽ nhận hai tham số: giá trị `status` được truyền vào `exit()`, và một bản sao của con trỏ `arg` từng được chuyển cho `on_exit()` tại thời điểm hàm được đăng ký. Dù được định nghĩa dưới dạng con trỏ `void *`, ngữ nghĩa của `arg` hoàn toàn do lập trình viên quyết định. Nó có thể trỏ tới một cấu trúc dữ liệu phức tạp; hoặc thông qua kỹ thuật ép kiểu (casting), nó có thể đại diện trực tiếp cho một giá trị số nguyên hoặc kiểu vô hướng (scalar).

Tương tự `atexit()`, `on_exit()` trả về giá trị khác 0 (không nhất thiết là –1) khi xảy ra lỗi.

Ta cũng có thể đăng ký nhiều exit handler với `on_exit()`. Các hàm đăng ký bằng `atexit()` và `on_exit()` cùng được lưu trữ trên một danh sách duy nhất. Nếu cả hai phương thức được sử dụng đan xen trong cùng một chương trình, các exit handler vẫn sẽ được kích hoạt theo thứ tự đảo ngược so với thứ tự đã đăng ký chung của cả hai cơ chế.

Mặc dù linh hoạt hơn `atexit()`, lập trình viên nên hạn chế sử dụng `on_exit()` trong các chương trình cần đảm bảo tính khả chuyển cao, do hàm này không nằm trong bất kỳ tiêu chuẩn chung nào và chỉ xuất hiện trên một số ít hệ thống UNIX.

### Chương trình ví dụ

Listing 25-1 minh họa cách thức kết hợp cả `atexit()` và `on_exit()` để đăng ký các trình xử lý thoát. Khi biên dịch và thực thi chương trình này, kết quả đầu ra hiển thị như sau:

```bash
$ ./exit_handlers
on_exit function called: status=2, arg=20
atexit function 2 called
atexit function 1 called
on_exit function called: status=2, arg=10
```

**Listing 25-1:** Sử dụng các trình xử lý thoát (exit handler)

```c
–––––––––––––––––––––––––––––––––––––––––––––––––– procexec/exit_handlers.c
## define _BSD_SOURCE /* Lấy khai báo on_exit() từ <stdlib.h> */
## include <stdlib.h>
## include "tlpi_hdr.h"

static void
atexitFunc1(void)
{
    printf("atexit function 1 called\n");
}

static void
atexitFunc2(void)
{
    printf("atexit function 2 called\n");
}

static void
onexitFunc(int exitStatus, void *arg)
{
    printf("on_exit function called: status=%d, arg=%ld\n",
            exitStatus, (long) arg);
}

int
main(int argc, char *argv[])
{
    if (on_exit(onexitFunc, (void *) 10) != 0)
        fatal("on_exit 1");
    if (atexit(atexitFunc1) != 0)
        fatal("atexit 1");
    if (atexit(atexitFunc2) != 0)
        fatal("atexit 2");
    if (on_exit(onexitFunc, (void *) 20) != 0)
        fatal("on_exit 2");

    exit(2);
}
–––––––––––––––––––––––––––––––––––––––––––––––––– procexec/exit_handlers.c
```

## 25.4 Tương tác giữa fork(), bộ đệm stdio và \_exit()

Kết quả đầu ra của chương trình trong Listing 25-2 thể hiện một hiện tượng thoạt nhìn rất khó hiểu. Khi chạy chương trình này với luồng đầu ra tiêu chuẩn (stdout) trỏ tới terminal, ta nhận được kết quả hoàn toàn bình thường:

```bash
$ ./fork_stdio_buf
Hello world
Ciao
```

Tuy nhiên, khi chuyển hướng (redirect) đầu ra tiêu chuẩn vào một tệp tin, kết quả lại biến đổi thành:

```bash
$ ./fork_stdio_buf > a
$ cat a
Ciao
Hello world
Hello world
```

Trong kết quả trên xuất hiện hai hiện tượng bất thường: dòng chữ xuất ra bởi `printf()` bị lặp lại hai lần, và nội dung từ lệnh `write()` lại hiển thị trước nội dung của `printf()`.

**Listing 25-2:** Sự tương tác giữa fork() và cơ chế đệm stdio

```c
––––––––––––––––––––––––––––––––––––––––––––––––– procexec/fork_stdio_buf.c
## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
    printf("Hello world\n");
    write(STDOUT_FILENO, "Ciao\n", 5);

    if (fork() == -1)
        errExit("fork");

    /* Cả tiến trình cha và con đều tiếp tục thực thi tại đây */
    exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––– procexec/fork_stdio_buf.c
```

Để hiểu rõ nguyên nhân dòng thông báo của `printf()` xuất hiện hai lần, hãy nhớ lại rằng các bộ đệm stdio nằm hoàn toàn trong vùng nhớ không gian người dùng (user-space memory) của tiến trình (xem Mục 13.2). Do đó, khi `fork()` được gọi, các bộ đệm này được sao chép nguyên vẹn sang tiến trình con. Khi đầu ra tiêu chuẩn hướng tới một terminal, chế độ đệm mặc định là đệm theo dòng (line-buffered); kết quả là chuỗi ký tự kết thúc bằng dấu xuống dòng `\n` của `printf()` được xả ra màn hình ngay tức khắc. Tuy nhiên, khi chuyển hướng đầu ra ra tệp tin, cơ chế đệm mặc định chuyển sang đệm theo khối (block-buffered). Vì vậy, trong kịch bản này, chuỗi ký tự của `printf()` vẫn còn nằm lại trong bộ đệm stdio của tiến trình cha tại thời điểm gọi `fork()`, và nội dung đệm này được nhân bản sang tiến trình con. Khi cả cha và con sau đó cùng gọi `exit()`, cả hai đều xả bản sao bộ đệm stdio của mình ra tệp, tạo nên sự trùng lặp dữ liệu.

Chúng ta có thể xử lý triệt để hiện tượng trùng lặp đầu ra này bằng một trong các phương án sau:

- Xử lý trực tiếp vấn đề đệm stdio: sử dụng `fflush()` để xả rỗng bộ đệm stdio ngay trước khi gọi `fork()`. Ngoài ra, có thể gọi `setvbuf()` hoặc `setbuf()` để tắt hoàn toàn cơ chế đệm trên luồng stdio.
- Thay vì gọi `exit()`, tiến trình con nên gọi `_exit()` để nó chấm dứt mà không xả các bộ đệm stdio. Kỹ thuật này minh họa cho một nguyên tắc kinh điển trong lập trình hệ thống: trong một ứng dụng sinh các tiến trình con, thông thường chỉ một tiến trình duy nhất (phổ biến nhất là tiến trình cha) được phép kết thúc bằng `exit()`, các tiến trình con còn lại nên kết thúc bằng `_exit()`. Điều này đảm bảo chỉ duy nhất một tiến trình thực thi các exit handler và xả các bộ đệm stdio, tránh các xung đột và trùng lặp không mong muốn.

Các giải pháp cho phép cả tiến trình cha và con cùng gọi `exit()` cũng khả thi (và đôi khi là bắt buộc). Chẳng hạn, chúng ta có thể thiết kế các exit handler sao cho chúng hoạt động an toàn ngay cả khi được gọi đồng thời từ nhiều tiến trình, hoặc chỉ cho phép ứng dụng đăng ký các exit handler sau khi đã phân nhánh bằng `fork()`. Hơn nữa, đôi khi yêu cầu nghiệp vụ thực sự muốn mọi tiến trình phải xả các bộ đệm stdio của chúng sau khi `fork()`. Trong trường hợp này, việc kết thúc tiến trình bằng `exit()` hoặc gọi `fflush()` tường minh tại mỗi tiến trình là hoàn toàn thích hợp.

Dữ liệu ghi bởi `write()` trong Listing 25-2 không bị trùng lặp, bởi vì `write()` là một system call chuyển dữ liệu trực tiếp vào bộ đệm của kernel (kernel buffer); bộ đệm này thuộc không gian nhân và không bị sao chép trong quá trình `fork()`.

Đến đây, nguyên nhân thứ hai — tại sao đầu ra của `write()` lại xuất hiện trước `printf()` khi chuyển hướng ra tệp — cũng đã sáng tỏ: Lệnh `write()` đẩy dữ liệu ngay lập tức vào bộ đệm cache của kernel (kernel buffer cache), trong khi dữ liệu từ `printf()` chỉ thực sự được chuyển vào kernel khi các bộ đệm stdio trong không gian người dùng được xả tại thời điểm gọi `exit()`. (Nhìn chung, lập trình viên cần hết sức thận trọng khi kết hợp đan xen các hàm thư viện stdio và các system call cấp thấp để thao tác I/O trên cùng một tệp, như đã khuyến cáo trong Mục 13.7).

## 25.5 Tóm tắt

Một tiến trình có thể kết thúc theo hai hình thức: bất thường hoặc bình thường. Sự kết thúc bất thường xảy ra khi nhận một số tín hiệu nhất định, trong đó một số tín hiệu sẽ kích hoạt tiến trình tạo ra tệp kết xuất bộ nhớ (core dump file).

Sự kết thúc bình thường được thực hiện thông qua system call `_exit()` hoặc phổ biến hơn là hàm thư viện `exit()` — một lớp bọc cấp cao hơn được xây dựng bên trên `_exit()`. Cả `_exit()` và `exit()` đều nhận một đối số kiểu số nguyên, trong đó 8 bit trọng số thấp nhất xác định trạng thái kết thúc (termination status) của tiến trình. Theo quy ước, trạng thái bằng 0 biểu thị việc thực thi thành công, còn giá trị khác 0 báo hiệu việc kết thúc có lỗi.

Trong cả hai trường hợp kết thúc bình thường và bất thường, kernel đều tự động thực hiện hàng loạt thao tác dọn dẹp tài nguyên cốt lõi. Việc kết thúc tiến trình một cách bình thường bằng `exit()` sẽ bổ sung thêm các bước: kích hoạt các exit handler đã đăng ký qua `atexit()` và `on_exit()` (theo thứ tự LIFO đảo ngược với lúc đăng ký), và xả sạch toàn bộ dữ liệu đang lưu trong các bộ đệm stdio.

### Thông tin tham khảo thêm

Tham khảo các nguồn tài liệu bổ sung được liệt kê trong Mục 24.6.

## 25.6 Bài tập

**25-1.** Nếu một tiến trình con thực hiện lời gọi `exit(-1)`, thì mã trạng thái thoát (exit status) mà tiến trình cha quan sát được thông qua macro `WEXITSTATUS()` sẽ là bao nhiêu?
