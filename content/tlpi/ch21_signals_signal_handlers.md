## Chapter 21

## SIGNALS: SIGNAL HANDLERS (TÍN HIỆU: BỘ XỬ LÝ TÍN HIỆU)

Chương này tiếp tục mô tả về tín hiệu (signal) đã được bắt đầu ở chương trước. Nội dung tập trung vào các bộ xử lý tín hiệu (signal handler), đồng thời mở rộng phần thảo luận đã bắt đầu ở Mục 20.4. Các chủ đề mà chúng ta sẽ xem xét bao gồm:

- cách thiết kế một signal handler, điều này đòi hỏi phải thảo luận về tính khả nhập (reentrancy) và các hàm an toàn với tín hiệu bất đồng bộ (async-signal-safe function);
- các phương pháp thay thế cho việc thực hiện một lệnh return thông thường từ signal handler, cụ thể là việc sử dụng lệnh nhảy phi cục bộ (nonlocal goto) cho mục đích này;
- xử lý tín hiệu trên một ngăn xếp thay thế (alternate stack);
- việc sử dụng cờ `sigaction()` `SA_SIGINFO` để cho phép signal handler lấy thông tin chi tiết hơn về tín hiệu đã gây ra lệnh gọi nó; và
- cách một system call (lời gọi hệ thống) đang chặn (blocking) có thể bị ngắt bởi một signal handler, và cách gọi lại (restart) lời gọi đó nếu muốn.

## 21.1 Thiết kế Signal Handlers

Nhìn chung, việc viết các signal handler đơn giản sẽ được ưu tiên hơn. Một lý do quan trọng cho việc này là nhằm giảm thiểu nguy cơ phát sinh điều kiện tranh chấp (race condition). Hai thiết kế phổ biến cho signal handler bao gồm:

- Signal handler thiết lập một cờ toàn cục (global flag) rồi thoát. Chương trình chính sẽ định kỳ kiểm tra cờ này và, nếu nó được thiết lập, sẽ thực hiện hành động thích hợp. (Nếu chương trình chính không thể thực hiện các bước kiểm tra định kỳ như vậy do cần theo dõi một hoặc nhiều File Descriptor để xem I/O có khả thi hay không, thì signal handler cũng có thể ghi một byte đơn vào một pipe chuyên dụng mà đầu đọc của nó nằm trong số các File Descriptor được theo dõi bởi chương trình chính. Chúng tôi trình bày một ví dụ về kỹ thuật này ở Mục 63.5.2.)
- Signal handler thực hiện một số thao tác dọn dẹp (cleanup), sau đó hoặc là chấm dứt tiến trình (process), hoặc là sử dụng lệnh nhảy phi cục bộ (nonlocal goto) (Mục [21.2.1](#page-8-0)) để xả ngăn xếp (unwind the stack) và trả quyền điều khiển về một vị trí được định trước trong chương trình chính.

Trong các phần tiếp theo, chúng ta sẽ khám phá các ý tưởng này, cũng như các khái niệm khác rất quan trọng trong thiết kế signal handler.

### 21.1.1 Tín Hiệu Không Được Xếp Hàng Đợi (Xem Lại)

Ở Mục 20.10, chúng ta đã lưu ý rằng việc phân phối (delivery) một tín hiệu bị chặn trong quá trình thực thi handler của nó (trừ khi chúng ta chỉ định cờ `SA_NODEFER` cho `sigaction()`). Nếu tín hiệu (lại) được tạo ra trong khi handler đang thực thi, thì nó sẽ được đánh dấu là đang chờ xử lý (pending) và sau đó sẽ được phân phối khi handler trả về. Chúng ta cũng đã lưu ý rằng các tín hiệu không được xếp hàng đợi (queued). Nếu tín hiệu được tạo ra nhiều hơn một lần trong khi handler đang thực thi, thì nó vẫn chỉ được đánh dấu là pending và sau đó sẽ chỉ được phân phối một lần duy nhất.

Việc các tín hiệu có thể "biến mất" theo cách này sẽ ảnh hưởng đến cách chúng ta thiết kế các signal handler. Trước hết, chúng ta không thể đếm một cách đáng tin cậy số lần một tín hiệu được tạo ra. Hơn nữa, chúng ta có thể phải viết mã cho signal handler để đối phó với khả năng có nhiều sự kiện cùng loại tương ứng với tín hiệu đã xảy ra. Chúng ta sẽ thấy một ví dụ về điều này khi xem xét việc sử dụng tín hiệu `SIGCHLD` ở Mục 26.3.1.

### 21.1.2 Các hàm tái nhập (Reentrant) và an toàn với tín hiệu bất đồng bộ (Async-Signal-Safe)

Không phải tất cả các System Call và hàm thư viện đều có thể được gọi một cách an toàn từ một trình xử lý tín hiệu (signal handler). Để hiểu lý do tại sao, cần phải giải thích hai khái niệm: hàm tái nhập (reentrant function) và hàm an toàn với tín hiệu bất đồng bộ (async-signal-safe function).

### Hàm tái nhập và hàm không tái nhập (Reentrant and nonreentrant functions)

Để giải thích hàm tái nhập là gì, trước tiên chúng ta cần phân biệt giữa chương trình đơn luồng (singlethreaded) và đa luồng (multithreaded). Các chương trình UNIX cổ điển có một luồng thực thi duy nhất: CPU xử lý các tập lệnh cho một luồng thực thi logic duy nhất trong toàn bộ chương trình. Trong một chương trình đa luồng, có nhiều luồng thực thi logic độc lập, đồng thời trong cùng một tiến trình (process).

Trong Chương 29, chúng ta sẽ tìm hiểu cách tạo ra các chương trình chứa nhiều luồng thực thi một cách tường minh. Tuy nhiên, khái niệm về nhiều luồng thực thi cũng có liên quan đối với các chương trình sử dụng trình xử lý tín hiệu (signal handler). Vì một signal handler có thể ngắt bất đồng bộ việc thực thi chương trình tại bất kỳ thời điểm nào, nên chương trình chính và signal handler thực chất tạo thành hai luồng thực thi độc lập (mặc dù không đồng thời) trong cùng một tiến trình.

Một hàm được gọi là tái nhập (reentrant) nếu nó có thể được thực thi đồng thời một cách an toàn bởi nhiều luồng thực thi trong cùng một tiến trình. Trong ngữ cảnh này, "an toàn" có nghĩa là hàm đạt được kết quả mong đợi, bất kể trạng thái thực thi của bất kỳ luồng thực thi nào khác.

> Định nghĩa của SUSv3 về một hàm tái nhập là hàm "có hiệu quả, khi được gọi bởi hai hoặc nhiều luồng, được đảm bảo giống như thể các luồng lần lượt thực thi hàm đó tuần tự theo một thứ tự không xác định, ngay cả khi quá trình thực thi thực tế bị đan xen (interleaved)."

Một hàm có thể không tái nhập (nonreentrant) nếu nó cập nhật các cấu trúc dữ liệu toàn cục (global) hoặc tĩnh (static). (Một hàm chỉ sử dụng các biến cục bộ được đảm bảo là tái nhập). Nếu hai lần gọi (tức là hai luồng cùng thực thi) hàm này đồng thời cố gắng cập nhật cùng một biến toàn cục hoặc cấu trúc dữ liệu, thì các cập nhật này có khả năng cản trở lẫn nhau và tạo ra kết quả sai lệch. Ví dụ, giả sử một luồng thực thi đang trong quá trình cập nhật cấu trúc dữ liệu danh sách liên kết (linked list) để thêm một mục mới vào danh sách, trong khi một luồng khác cũng cố gắng cập nhật cùng danh sách liên kết đó. Vì việc thêm một mục mới vào danh sách đòi hỏi phải cập nhật nhiều con trỏ (pointer), nên nếu một luồng khác ngắt các bước này và cập nhật các con trỏ đó, thảm họa sẽ xảy ra.

Những khả năng như vậy thực sự rất phổ biến trong thư viện chuẩn C. Ví dụ, chúng ta đã lưu ý trong Mục 7.1.3 rằng malloc() và free() duy trì một danh sách liên kết các khối bộ nhớ đã được giải phóng có sẵn để cấp phát lại từ heap. Nếu một lệnh gọi malloc() trong chương trình chính bị ngắt bởi một signal handler cũng gọi malloc(), thì danh sách liên kết này có thể bị hỏng (corrupted). Vì lý do này, họ hàm malloc(), và các hàm thư viện khác sử dụng chúng, là không tái nhập.

Các hàm thư viện khác không tái nhập vì chúng trả về thông tin sử dụng bộ nhớ được cấp phát tĩnh. Ví dụ về các hàm như vậy (được mô tả ở phần khác trong cuốn sách này) bao gồm crypt(), getpwnam(), gethostbyname(), và getservbyname(). Nếu một signal handler cũng sử dụng một trong các hàm này, nó sẽ ghi đè lên thông tin được trả về bởi bất kỳ lệnh gọi trước đó nào đến cùng hàm đó từ bên trong chương trình chính (hoặc ngược lại).

Các hàm cũng có thể không tái nhập nếu chúng sử dụng các cấu trúc dữ liệu tĩnh cho việc ghi sổ nội bộ (internal bookkeeping). Các ví dụ rõ ràng nhất về các hàm này là các thành viên của thư viện stdio (printf(), scanf(), v.v.), vốn cập nhật các cấu trúc dữ liệu nội bộ cho việc I/O có đệm (buffered I/O). Do đó, khi sử dụng printf() từ bên trong một signal handler, đôi khi chúng ta có thể thấy đầu ra kỳ lạ — hoặc thậm chí là chương trình bị crash hoặc hỏng dữ liệu nếu signal handler ngắt chương trình chính ở giữa quá trình thực thi lệnh gọi printf() hoặc một hàm stdio khác.

Ngay cả khi chúng ta không sử dụng các hàm thư viện không tái nhập, các vấn đề về tính tái nhập vẫn có thể liên quan. Nếu một signal handler cập nhật các cấu trúc dữ liệu toàn cục do lập trình viên định nghĩa mà cũng được cập nhật trong chương trình chính, thì chúng ta có thể nói rằng signal handler đó không tái nhập đối với chương trình chính.

Nếu một hàm không tái nhập, trang man page của nó thường sẽ cung cấp chỉ báo tường minh hoặc ngầm định về thực tế này. Cụ thể, hãy chú ý đến các câu lệnh cho biết hàm sử dụng hoặc trả về thông tin trong các biến được cấp phát tĩnh.

### Chương trình ví dụ

[Liệt kê 21-1](#page-3-0) minh họa bản chất không tái nhập của hàm crypt() (Mục 8.5). Dưới dạng các tham số dòng lệnh (command-line arguments), chương trình này nhận vào hai chuỗi. Chương trình thực hiện các bước sau:

- 1. Gọi crypt() để mã hóa chuỗi trong tham số dòng lệnh thứ nhất, và sao chép chuỗi này sang một bộ đệm riêng biệt bằng cách sử dụng strdup().

- 2. Thiết lập một hàm xử lý (handler) cho tín hiệu `SIGINT` (được tạo ra bằng cách gõ tổ hợp phím Control-C). Hàm xử lý này gọi `crypt()` để mã hóa chuỗi được cung cấp ở tham số dòng lệnh (command-line argument) thứ hai.
- 3. Bước vào một vòng lặp `for` vô hạn sử dụng `crypt()` để mã hóa chuỗi ở tham số dòng lệnh thứ nhất và kiểm tra xem chuỗi trả về có giống với chuỗi đã lưu ở bước 1 hay không.

Khi không có tín hiệu (signal) xuất hiện, các chuỗi sẽ luôn khớp nhau ở bước 3. Tuy nhiên, nếu một tín hiệu `SIGINT` đến và việc thực thi hàm xử lý tín hiệu ngắt chương trình chính ngay sau khi lời gọi hàm `crypt()` trong vòng lặp `for` hoàn tất, nhưng trước khi kiểm tra xem các chuỗi có khớp nhau hay không, thì chương trình chính sẽ báo lỗi không khớp (mismatch). Khi chúng ta chạy chương trình, đây là kết quả hiển thị:

### \$ **./non\_reentrant abc def**

```
Repeatedly type Control-C to generate SIGINT
Mismatch on call 109871 (mismatch=1 handled=1)
Mismatch on call 128061 (mismatch=2 handled=2)
Many lines of output removed
Mismatch on call 727935 (mismatch=149 handled=156)
Mismatch on call 729547 (mismatch=150 handled=157)
Type Control-\ to generate SIGQUIT
Quit (core dumped)
```

So sánh các giá trị không khớp (`mismatch`) và đã xử lý (`handled`) trong đầu ra ở trên, chúng ta thấy rằng trong phần lớn các trường hợp hàm xử lý tín hiệu được gọi (invoked), nó ghi đè lên bộ đệm được cấp phát tĩnh (statically allocated buffer) nằm giữa lời gọi `crypt()` và phép so sánh chuỗi trong hàm `main()`.

**Liệt kê 21-1:** Gọi một hàm không tái nhập (nonreentrant function) từ cả `main()` và một hàm xử lý tín hiệu

–––––––––––––––––––––––––––––––––––––––––––––––––––– **signals/nonreentrant.c** #define \_XOPEN\_SOURCE 600 #include <unistd.h> #include <signal.h> #include <string.h> #include "tlpi\_hdr.h" static char \*str2; /\* Được thiết lập từ argv[2] \*/ static int handled = 0; /\* Đếm số lần gọi hàm xử lý \*/ static void handler(int sig) { crypt(str2, "xx"); handled++; }

```
int
main(int argc, char *argv[])
{
 char *cr1;
 int callNum, mismatch;
 struct sigaction sa;
 if (argc != 3)
 usageErr("%s str1 str2\n", argv[0]);
 str2 = argv[2]; /* Làm cho argv[2] khả dụng đối với handler */
 cr1 = strdup(crypt(argv[1], "xx")); /* Sao chép chuỗi được cấp phát tĩnh
 sang một bộ đệm khác */
 if (cr1 == NULL)
 errExit("strdup");
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = 0;
 sa.sa_handler = handler;
 if (sigaction(SIGINT, &sa, NULL) == -1)
 errExit("sigaction");
 /* Gọi lặp lại hàm crypt() sử dụng argv[1]. Nếu bị ngắt bởi một
 hàm xử lý tín hiệu, thì vùng nhớ tĩnh do crypt() trả về
 sẽ bị ghi đè bởi kết quả mã hóa argv[2], và
 strcmp() sẽ phát hiện sự không khớp với giá trị trong 'cr1'. */
 for (callNum = 1, mismatch = 0; ; callNum++) {
 if (strcmp(crypt(argv[1], "xx"), cr1) != 0) {
 mismatch++;
 printf("Mismatch on call %d (mismatch=%d handled=%d)\n",
 callNum, mismatch, handled);
 }
 }
}
```

–––––––––––––––––––––––––––––––––––––––––––––––––––– **signals/nonreentrant.c**

### Các hàm an toàn khi gọi bất đồng bộ với tín hiệu chuẩn (Standard async-signal-safe functions)

Một hàm an toàn khi gọi bất đồng bộ với tín hiệu (async-signal-safe function) là hàm mà quá trình triển khai đảm bảo là an toàn khi được gọi từ bên trong hàm xử lý tín hiệu. Một hàm được coi là async-signal-safe hoặc là vì nó có tính tái nhập (reentrant), hoặc vì nó không thể bị ngắt bởi hàm xử lý tín hiệu.

Bảng 21-1 liệt kê các hàm mà các tiêu chuẩn khác nhau yêu cầu phải đạt chuẩn async-signal-safe. Trong bảng này, các hàm có tên không đi kèm với hậu tố `v2` hoặc `v3` đã được định nghĩa là async-signal-safe trong POSIX.1-1990. Phiên bản SUSv2 bổ sung các hàm được đánh dấu `v2` vào danh sách, và những hàm được đánh dấu `v3` được bổ sung bởi SUSv3. Các bản cài đặt UNIX riêng lẻ có thể làm cho các hàm khác trở thành async-signal-safe, nhưng tất cả các bản cài đặt UNIX tuân thủ tiêu chuẩn phải đảm bảo rằng ít nhất các hàm này phải là async-signal-safe (nếu chúng được cung cấp bởi bản cài đặt; không phải tất cả các hàm này đều được cung cấp trên Linux).

SUSv4 thực hiện các thay đổi sau đối với Bảng 21-1:

Các hàm sau đây bị loại bỏ: `fpathconf()`, `pathconf()`, và `sysconf()`.

Các hàm sau đây được thêm vào: `execl()`, `execv()`, `faccessat()`, `fchmodat()`, `fchownat()`, `fexecve()`, `fstatat()`, `futimens()`, `linkat()`, `mkdirat()`, `mkfifoat()`, `mknod()`, `mknodat()`, `openat()`, `readlinkat()`, `renameat()`, `symlinkat()`, `unlinkat()`, `utimensat()`, và `utimes()`.

**Bảng 21-1:** Các hàm được yêu cầu phải đạt chuẩn async-signal-safe theo POSIX.1-1990, SUSv2, và SUSv3

| _Exit()<br>(v3)<br>_exit()<br>abort() (v3)<br>accept() (v3)<br>access()<br>aio_error() (v2)<br>aio_return() (v2) | getpid()<br>getppid()<br>getsockname() (v3)<br>getsockopt() (v3)<br>getuid()<br>kill()<br>link()<br>listen() (v3) | sigdelset()<br>sigemptyset()<br>sigfillset()<br>sigismember()<br>signal() (v2)<br>sigpause() (v2)<br>sigpending() |
|------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|

|                                                                                                                  |                                                                                                                   |                                                                                                                   |
|------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
|                                                                                                                  |                                                                                                                   |                                                                                                                   |
|                                                                                                                  |                                                                                                                   |                                                                                                                   |
|                                                                                                                  |                                                                                                                   |                                                                                                                   |
|                                                                                                                  |                                                                                                                   |                                                                                                                   |
|                                                                                                                  |                                                                                                                   |                                                                                                                   |
|                                                                                                                  |                                                                                                                   |                                                                                                                   |
| aio_suspend() (v2)                                                                                               |                                                                                                                   | sigprocmask()                                                                                                     |
| alarm()                                                                                                          | lseek()                                                                                                           | sigqueue() (v2)                                                                                                   |
| bind()<br>(v3)                                                                                                   | lstat() (v3)                                                                                                      | sigset() (v2)                                                                                                     |
| cfgetispeed()                                                                                                    | mkdir()                                                                                                           | sigsuspend()                                                                                                      |
| cfgetospeed()                                                                                                    | mkfifo()                                                                                                          | sleep()                                                                                                           |
| cfsetispeed()                                                                                                    | open()                                                                                                            | socket() (v3)                                                                                                     |
| cfsetospeed()                                                                                                    | pathconf()                                                                                                        | sockatmark() (v3)                                                                                                 |

| chdir()                                                                                                          | pause()                                                                                                           | socketpair() (v3)                                                                                                 |
| chmod()                                                                                                          | pipe()                                                                                                            | stat()                                                                                                            |
| chown()                                                                                                          | poll() (v3)                                                                                                       | symlink() (v3)                                                                                                    |
| clock_gettime() (v2)                                                                                             | posix_trace_event() (v3)                                                                                          | sysconf()                                                                                                         |
| close()                                                                                                          | pselect() (v3)                                                                                                    | tcdrain()                                                                                                         |
| connect() (v3)                                                                                                   | raise() (v2)                                                                                                      | tcflow()                                                                                                          |
| creat()                                                                                                          | read()                                                                                                            | tcflush()                                                                                                         |
| dup()                                                                                                            | readlink() (v3)                                                                                                   | tcgetattr()                                                                                                       |
| dup2()                                                                                                           | recv() (v3)                                                                                                       | tcgetpgrp()                                                                                                       |
| execle()                                                                                                         | recvfrom() (v3)                                                                                                   | tcsendbreak()                                                                                                     |
| execve()                                                                                                         | recvmsg() (v3)                                                                                                    | tcsetattr()                                                                                                       |
| fchmod() (v3)                                                                                                    | rename()                                                                                                          | tcsetpgrp()                                                                                                       |
| fchown() (v3)                                                                                                    | rmdir()                                                                                                           | time()                                                                                                            |
| fcntl()                                                                                                          | select() (v3)                                                                                                     | timer_getoverrun() (v2)                                                                                           |

| fdatasync() (v2)                                                                                                 | sem_post() (v2)                                                                                                   | timer_gettime() (v2)                                                                                              |
| fork()                                                                                                           | send()<br>(v3)                                                                                                    | timer_settime() (v2)                                                                                              |
| fpathconf() (v2)                                                                                                 | sendmsg()<br>(v3)                                                                                                 | times()                                                                                                           |
| fstat()                                                                                                          | sendto() (v3)                                                                                                     | umask()                                                                                                           |
| fsync() (v2)                                                                                                     | setgid()                                                                                                          | uname()                                                                                                           |
| ftruncate() (v3)                                                                                                 | setpgid()                                                                                                         | unlink()                                                                                                          |
| getegid()                                                                                                        | setsid()                                                                                                          | utime()                                                                                                           |
| geteuid()                                                                                                        | setsockopt() (v3)                                                                                                 | wait()                                                                                                            |
| getgid()                                                                                                         | setuid()                                                                                                          | waitpid()                                                                                                         |
| getgroups()                                                                                                      | shutdown() (v3)                                                                                                   | write()                                                                                                           |
| getpeername() (v3)                                                                                               | sigaction()                                                                                                       |                                                                                                                   |
| getpgrp()                                                                                                        | sigaddset()                                                                                                       |                                                                                                                   |

Tiêu chuẩn SUSv3 lưu ý rằng tất cả các hàm không được liệt kê trong Bảng 21-1 đều được coi là không an toàn đối với tín hiệu (signal-unsafe), nhưng chỉ ra rằng một hàm chỉ không an toàn khi việc gọi một trình xử lý tín hiệu (signal handler) làm gián đoạn việc thực thi của một hàm không an toàn, và bản thân trình xử lý đó cũng gọi một hàm không an toàn. Nói cách khác, khi viết các trình xử lý tín hiệu, chúng ta có hai sự lựa chọn:

- Đảm bảo rằng bản thân mã nguồn của trình xử lý tín hiệu có thể tái nhập (reentrant) và nó chỉ gọi các hàm an toàn với tín hiệu bất đồng bộ (`async-signal-safe functions`).
- Chặn việc phân phối tín hiệu (block delivery of signals) trong khi thực thi mã nguồn trong chương trình chính — nơi gọi các hàm không an toàn hoặc làm việc với các cấu trúc dữ liệu toàn cục (global data structures) cũng được cập nhật bởi trình xử lý tín hiệu.

Vấn đề với cách tiếp cận thứ hai là, trong một chương trình phức tạp, rất khó để đảm bảo rằng một trình xử lý tín hiệu (signal handler) sẽ không bao giờ làm gián đoạn chương trình chính trong khi chương trình đang gọi một hàm không an toàn. Vì lý do này, các quy tắc trên thường được đơn giản hóa thành tuyên bố rằng chúng ta tuyệt đối không được gọi các hàm không an toàn (unsafe functions) từ bên trong một trình xử lý tín hiệu.

> Nếu chúng ta thiết lập cùng một hàm xử lý để xử lý nhiều tín hiệu khác nhau hoặc sử dụng cờ `SA_NODEFER` trong hàm `sigaction()`, thì một trình xử lý có thể tự làm gián đoạn chính nó. Do đó, trình xử lý có thể không tái nhập (nonreentrant) nếu nó cập nhật các biến toàn cục (global) hoặc tĩnh (static), ngay cả khi các biến đó không được sử dụng bởi chương trình chính.

### Sử dụng `errno` bên trong các trình xử lý tín hiệu

Vì chúng có thể cập nhật `errno`, việc sử dụng các hàm được liệt kê trong Bảng 21-1 vẫn có thể khiến cho trình xử lý tín hiệu trở nên không tái nhập (nonreentrant), do chúng có thể ghi đè lên giá trị `errno` đã được thiết lập bởi một hàm được gọi từ chương trình chính. Biện pháp khắc phục là lưu lại giá trị của `errno` ngay khi bước vào trình xử lý tín hiệu (đối với trình xử lý sử dụng bất kỳ hàm nào trong Bảng 21-1) và khôi phục lại giá trị `errno` đó trước khi thoát khỏi trình xử lý, như trong ví dụ sau:

```c
void
handler(int sig)
{
 int savedErrno;
 savedErrno = errno;
 /* Bây giờ chúng ta có thể thực thi một hàm có thể làm thay đổi errno */
 errno = savedErrno;
}
```

## Sử dụng các hàm không an toàn trong các chương trình ví dụ của cuốn sách này

Mặc dù `printf()` không phải là an toàn với tín hiệu bất đồng bộ (async-signal-safe), chúng tôi vẫn sử dụng hàm này trong các trình xử lý tín hiệu ở nhiều chương trình ví dụ khác nhau trong cuốn sách này. Chúng tôi làm như vậy vì `printf()` cung cấp một cách dễ dàng và ngắn gọn để chứng minh rằng một trình xử lý tín hiệu đã được gọi, đồng thời hiển thị nội dung của các biến liên quan bên trong trình xử lý đó. Vì những lý do tương tự, đôi khi chúng tôi cũng sử dụng một vài hàm không an toàn khác trong các trình xử lý tín hiệu, bao gồm các hàm `stdio` khác và `strsignal()`.

Các ứng dụng trong thế giới thực nên tránh gọi các hàm không an toàn với tín hiệu bất đồng bộ (non-async-signal-safe) từ các trình xử lý tín hiệu. Để làm rõ điều này, mỗi trình xử lý tín hiệu trong các chương trình ví dụ sử dụng một trong các hàm này đều được đánh dấu bằng một chú thích (comment) chỉ ra rằng việc sử dụng đó là không an toàn:

```c
printf("Some message\n"); /* UNSAFE */
```

### 21.1.3 Biến toàn cục (Global Variables) và Kiểu dữ liệu `sig_atomic_t`

Bất chấp các vấn đề về tính tái nhập (reentrancy), việc chia sẻ các biến toàn cục giữa chương trình chính và trình xử lý tín hiệu có thể rất hữu ích. Điều này có thể an toàn miễn là chương trình chính xử lý đúng đắn khả năng trình xử lý tín hiệu có thể thay đổi biến toàn cục bất cứ lúc nào. Ví dụ, một thiết kế phổ biến là đặt hành động duy nhất của trình xử lý tín hiệu là thiết lập một cờ toàn cục (global flag). Cờ này được kiểm tra định kỳ bởi chương trình chính, sau đó chương trình chính sẽ thực hiện hành động thích hợp để phản hồi lại việc tín hiệu được phân phối (delivery) (và xóa cờ này đi). Khi các biến toàn cục được truy cập theo cách này từ một trình xử lý tín hiệu, chúng ta nên luôn khai báo chúng bằng thuộc tính `volatile` (xem Mục 6.8) nhằm ngăn trình biên dịch thực hiện các tối ưu hóa dẫn đến việc biến được lưu trữ trong một thanh ghi (register).

Việc đọc và ghi các biến toàn cục có thể bao gồm nhiều hơn một lệnh ngôn ngữ máy (machine-language instruction), và một trình xử lý tín hiệu có thể làm gián đoạn chương trình chính ở giữa chuỗi lệnh đó. (Chúng ta gọi việc truy cập biến như vậy là không nguyên tử - nonatomic). Vì lý do này, các tiêu chuẩn ngôn ngữ C và SUSv3 chỉ định một kiểu dữ liệu số nguyên, `sig_atomic_t`, đảm bảo các thao tác đọc và ghi là nguyên tử (atomic). Do đó, một biến cờ toàn cục được chia sẻ giữa chương trình chính và trình xử lý tín hiệu nên được khai báo như sau:

```c
volatile sig_atomic_t flag;
```

Chúng tôi trình bày một ví dụ về việc sử dụng kiểu dữ liệu `sig_atomic_t` trong [Danh sách 22-5,](#page-45-0) ở trang [466](#page-45-0).

Lưu ý rằng các toán tử tăng (`++`) và giảm (`--`) trong C không nằm trong phạm vi được đảm bảo đối với `sig_atomic_t`. Trên một số kiến trúc phần cứng, các thao tác này có thể không mang tính nguyên tử (tham khảo Mục 30.1 để biết thêm chi tiết). Tất cả những gì chúng ta được đảm bảo là được phép thực hiện một cách an toàn với một biến `sig_atomic_t` là thiết lập nó bên trong trình xử lý tín hiệu và kiểm tra nó trong chương trình chính (hoặc ngược lại).

C99 và SUSv3 quy định rằng một cài đặt phải định nghĩa hai hằng số (trong `<stdint.h>`), `SIG_ATOMIC_MIN` và `SIG_ATOMIC_MAX`, dùng để xác định phạm vi giá trị có thể được gán cho các biến có kiểu `sig_atomic_t`. Các tiêu chuẩn yêu cầu phạm vi này phải ít nhất là từ –127 đến 127 nếu `sig_atomic_t` được biểu diễn dưới dạng giá trị có dấu (signed value), hoặc từ 0 đến 255 nếu nó được biểu diễn dưới dạng giá trị không dấu (unsigned value). Trên Linux, hai hằng số này tương đương với giới hạn âm và dương đối với các số nguyên 32-bit có dấu.

## 21.2 Các phương thức khác để kết thúc Trình xử lý tín hiệu (Signal Handler)

Tất cả các trình xử lý tín hiệu (signal handler) mà chúng ta đã xem xét cho đến nay đều hoàn tất bằng cách trả về chương trình chính. Tuy nhiên, việc đơn giản là return từ một signal handler đôi khi không mong muốn, hoặc trong một số trường hợp, thậm chí không có tác dụng (Chúng ta sẽ thấy một ví dụ về trường hợp return từ một signal handler không có tác dụng khi thảo luận về các tín hiệu do phần cứng tạo ra trong Mục [22.4](#page-31-0)).

Có nhiều cách khác nhau để kết thúc một signal handler:

- Sử dụng `_exit()` để kết thúc tiến trình (process). Trước đó, handler có thể thực hiện một số hành động dọn dẹp (cleanup). Lưu ý rằng chúng ta không thể sử dụng `exit()` để kết thúc một signal handler, bởi vì nó không phải là một trong các hàm an toàn được liệt kê trong Bảng 21-1. Nó không an toàn vì nó thực hiện xả (flush) các bộ đệm stdio trước khi gọi `_exit()`, như được mô tả trong Mục 25.1.
- Sử dụng `kill()` hoặc `raise()` để gửi một tín hiệu làm chết tiến trình (tức là một tín hiệu có hành động mặc định là kết thúc tiến trình).
- Thực hiện một lệnh nhảy phi cục bộ (nonlocal goto) từ signal handler.
- Sử dụng hàm `abort()` để kết thúc tiến trình kèm theo tệp kết xuất lõi (core dump).

Hai tùy chọn cuối cùng trong số này được mô tả chi tiết hơn trong các mục tiếp theo.

### 21.2.1 Thực hiện Nonlocal Goto từ một Signal Handler

Mục 6.8 đã mô tả việc sử dụng `setjmp()` và `longjmp()` để thực hiện một lệnh nhảy phi cục bộ (nonlocal goto) từ một hàm đến một trong các hàm gọi nó (caller). Chúng ta cũng có thể sử dụng kỹ thuật này từ một signal handler. Điều này cung cấp một cách để khôi phục sau khi phân phối một tín hiệu gây ra bởi ngoại lệ phần cứng (ví dụ: lỗi truy cập bộ nhớ), đồng thời cho phép chúng ta bắt một tín hiệu và trả quyền điều khiển về một điểm cụ thể trong chương trình. Ví dụ, khi nhận được tín hiệu `SIGINT` (thường được tạo bằng cách nhấn Control-C), shell thực hiện một nonlocal goto để trả quyền điều khiển về vòng lặp đầu vào chính của nó (và do đó đọc một lệnh mới).

Tuy nhiên, có một vấn đề khi sử dụng hàm `longjmp()` chuẩn để thoát khỏi một signal handler. Chúng ta đã lưu ý trước đó rằng, khi vào signal handler, kernel sẽ tự động thêm tín hiệu đang gọi, cũng như bất kỳ tín hiệu nào được chỉ định trong trường `act.sa_mask`, vào mặt nạ tín hiệu của tiến trình (process signal mask), và sau đó xóa các tín hiệu này khỏi mặt nạ khi handler thực hiện lệnh return thông thường.

Điều gì xảy ra với mặt nạ tín hiệu (signal mask) nếu chúng ta thoát khỏi signal handler bằng `longjmp()`? Câu trả lời phụ thuộc vào nguồn gốc của từng bản cài đặt UNIX cụ thể. Dưới hệ thống System V, `longjmp()` không khôi phục mặt nạ tín hiệu, do đó các tín hiệu bị chặn (blocked signal) sẽ không được bỏ chặn khi rời khỏi handler. Linux tuân theo hành vi của System V. (Điều này thường không phải là điều chúng ta muốn, vì nó để lại tín hiệu gây ra việc gọi handler ở trạng thái bị chặn). Dưới các bản cài đặt có nguồn gốc từ BSD, `setjmp()` lưu mặt nạ tín hiệu trong đối số `env` của nó, và mặt nạ tín hiệu đã lưu sẽ được khôi phục bởi `longjmp()`. (Các bản cài đặt có nguồn gốc từ BSD cũng cung cấp hai hàm khác là `_setjmp()` và `_longjmp()`, mangữ nghĩa của System V). Nói cách khác, chúng ta không thể sử dụng `longjmp()` một cách di port (portably) để thoát khỏi một signal handler.

> Nếu chúng ta định nghĩa macro kiểm tra tính năng `_BSD_SOURCE` khi biên dịch chương trình, thì `setjmp()` (của glibc) sẽ tuân theo ngữ nghĩa BSD.

Do sự khác biệt này giữa hai biến thể UNIX chính, POSIX.1-1990 đã chọn không chỉ định cách xử lý mặt nạ tín hiệu bởi `setjmp()` và `longjmp()`. Thay vào đó, nó định nghĩa một cặp hàm mới là `sigsetjmp()` và `siglongjmp()`, cung cấp khả năng điều khiển rõ ràng đối với mặt nạ tín hiệu khi thực hiện một lệnh nhảy phi cục bộ (nonlocal goto).

```c
## include <setjmp.h>
int sigsetjmp(sigjmp_buf env, int savesigs);
                      Trả về 0 khi gọi ban đầu, khác 0 khi trả về thông qua siglongjmp()
void siglongjmp(sigjmp_buf env, int val);
```

Các hàm `sigsetjmp()` và `siglongjmp()` hoạt động tương tự như `setjmp()` và `longjmp()`. Sự khác biệt duy nhất nằm ở kiểu dữ liệu của đối số `env` (`sigjmp_buf` thay vì `jmp_buf`) và đối số bổ sung `savesigs` cho `sigsetjmp()`. Nếu `savesigs` khác 0, thì mặt nạ tín hiệu của tiến trình hiện tại tại thời điểm gọi `sigsetjmp()` sẽ được lưu trong `env` và được khôi phục bởi lệnh gọi `siglongjmp()` sau đó chỉ định cùng đối số `env`. Nếu `savesigs` bằng 0, thì mặt nạ tín hiệu của tiến trình sẽ không được lưu và khôi phục.

Các hàm `longjmp()` và `siglongjmp()` không được liệt kê trong số các hàm an toàn với tín hiệu bất đồng bộ (async-signal-safe functions) trong Bảng 21-1. Lý do là việc gọi bất kỳ hàm không an toàn với tín hiệu bất đồng bộ nào sau khi thực hiện nonlocal goto đều mang lại những rủi ro giống như việc gọi hàm đó từ bên trong signal handler. Hơn nữa, nếu một signal handler ngắt chương trình chính khi nó đang cập nhật dang dở một cấu trúc dữ liệu (data structure), và handler thoát bằng cách thực hiện nonlocal goto, thì bản cập nhật chưa hoàn thành đó có thể để lại cấu trúc dữ liệu ở trạng thái không nhất quán (inconsistent state). Một kỹ thuật có thể giúp tránh các vấn đề này là sử dụng `sigprocmask()` để tạm thời chặn tín hiệu trong khi các bản cập nhật nhạy cảm đang được thực hiện.

### Chương trình ví dụ

[Listing 21-2](#page-11-0) minh họa sự khác biệt trong việc xử lý mặt nạ tín hiệu (signal mask) giữa hai loại nhảy phi cục bộ (nonlocal goto). Chương trình này thiết lập một hàm xử lý (handler) cho tín hiệu `SIGINT`. Chương trình được thiết kế để cho phép sử dụng hoặc `setjmp()` kết hợp với `longjmp()`, hoặc `sigsetjmp()` kết hợp với `siglongjmp()` nhằm thoát khỏi hàm xử lý tín hiệu, tùy thuộc vào việc chương trình được biên dịch với macro `USE_SIGSETJMP` được định nghĩa hay không. Chương trình hiển thị các thiết lập hiện tại của mặt nạ tín hiệu (signal mask) cả khi bước vào hàm xử lý tín hiệu và sau khi lệnh nhảy phi cục bộ (nonlocal goto) đã chuyển quyền điều khiển từ hàm xử lý trở lại chương trình chính.

Khi chúng ta biên dịch chương trình sao cho `longjmp()` được sử dụng để thoát khỏi hàm xử lý tín hiệu, đây là kết quả khi chúng ta chạy chương trình:

```
$ make -s sigmask_longjmp Mặc định quá trình biên dịch sẽ khiến setjmp() được sử dụng
$ ./sigmask_longjmp
Signal mask at startup:
 <empty signal set>
Calling setjmp()
Type Control-C to generate SIGINT
Received signal 2 (Interrupt), signal mask is:
 2 (Interrupt)
After jump from handler, signal mask is:
 2 (Interrupt)
(At this point, typing Control-C again has no effect, since SIGINT is blocked)
Type Control-\ to kill the program
Quit
```

Từ đầu ra của chương trình, chúng ta có thể thấy rằng, sau một lời gọi `longjmp()` từ hàm xử lý tín hiệu, mặt nạ tín hiệu (signal mask) vẫn giữ nguyên giá trị đã được thiết lập khi bước vào hàm xử lý tín hiệu.

> Trong phiên làm việc trên dòng lệnh (shell session) ở trên, chúng ta đã biên dịch chương trình bằng cách sử dụng Makefile đi kèm với mã nguồn phân phối cho cuốn sách này. Tùy chọn `-s` ra lệnh cho `make` không hiển thị các câu lệnh mà nó đang thực thi. Chúng ta sử dụng tùy chọn này để tránh làm rối log của phiên làm việc. ([Mecklenburg, 2005] cung cấp một mô tả chi tiết về chương trình GNU `make`.)

Khi chúng ta biên dịch cùng tệp mã nguồn đó để tạo ra một tệp thực thi sử dụng `siglongjmp()` nhằm thoát khỏi hàm xử lý, chúng ta sẽ thấy kết quả sau:

```
$ make -s sigmask_siglongjmp Biên dịch sử dụng cc –DUSE_SIGSETJMP
$ ./sigmask_siglongjmp x
Signal mask at startup:
 <empty signal set>
Calling sigsetjmp()
Type Control-C
Received signal 2 (Interrupt), signal mask is:
 2 (Interrupt)
After jump from handler, signal mask is:
 <empty signal set>
```

Tại thời điểm này, `SIGINT` không bị chặn (blocked), bởi vì `siglongjmp()` đã khôi phục mặt nạ tín hiệu (signal mask) về trạng thái ban đầu của nó. Tiếp theo, chúng ta nhấn `Control-C` một lần nữa, để hàm xử lý được kích hoạt thêm một lần nữa:

```
Type Control-C
Received signal 2 (Interrupt), signal mask is:
 2 (Interrupt)
After jump from handler, signal mask is:
 <empty signal set>
Type Control-\ to kill the program
Quit
```

Từ kết quả đầu ra ở trên, chúng ta có thể thấy rằng `siglongjmp()` khôi phục mặt nạ tín hiệu (signal mask) về giá trị mà nó có tại thời điểm gọi `sigsetjmp()` (tức là một tập hợp tín hiệu trống - empty signal set).

[Listing 21-2](#page-11-0) cũng minh họa một kỹ thuật hữu ích khi sử dụng cùng với hàm xử lý tín hiệu (signal handler) thực hiện một bước nhảy phi cục bộ (nonlocal goto). Do một tín hiệu có thể được tạo ra bất cứ lúc nào, nó thực sự có thể xảy ra trước khi đích đến của lệnh nhảy được thiết lập bởi `sigsetjmp()` (hoặc `setjmp()`). Để ngăn chặn khả năng này (vốn sẽ khiến hàm xử lý thực hiện một bước nhảy phi cục bộ bằng cách sử dụng một bộ đệm `env` chưa được khởi tạo), chúng ta sử dụng một biến canh gác (guard variable), `canJump`, để chỉ ra xem bộ đệm `env` đã được khởi tạo hay chưa. Nếu `canJump` là sai (false), thì thay vì thực hiện bước nhảy phi cục bộ (nonlocal goto), hàm xử lý sẽ đơn giản trả về (return). Một cách tiếp cận thay thế là bố trí mã nguồn chương trình sao cho lời gọi `sigsetjmp()` (hoặc `setjmp()`) diễn ra trước khi hàm xử lý tín hiệu được thiết lập. Tuy nhiên, trong các chương trình phức tạp, việc đảm bảo hai bước này được thực hiện theo đúng thứ tự đó có thể rất khó khăn, và việc sử dụng một biến canh gác (guard variable) có thể sẽ đơn giản hơn.

Lưu ý rằng việc sử dụng `#ifdef` là cách đơn giản nhất để viết chương trình trong [Listing 21-2](#page-11-0) theo chuẩn mực. Cụ thể, chúng ta không thể thay thế `#ifdef` bằng đoạn kiểm tra thời gian chạy (run-time check) sau:

```
if (useSiglongjmp)
 s = sigsetjmp(senv, 1);
else
 s = setjmp(env);
if (s == 0)
 ...
```

Điều này không được phép bởi vì chuẩn SUSv3 không cho phép `setjmp()` và `sigsetjmp()` được sử dụng bên trong một câu lệnh gán (xem Mục 6.8).

**Listing 21-2:** Thực hiện một bước nhảy phi cục bộ (nonlocal goto) từ một hàm xử lý tín hiệu (signal handler)

```c
–––––––––––––––––––––––––––––––––––––––––––––––––– signals/sigmask_longjmp.c
## define _GNU_SOURCE /* Lấy khai báo strsignal() từ <string.h> */
## include <string.h>
## include <setjmp.h>
## include <signal.h>
## include "signal_functions.h" /* Khai báo của printSigMask() */
## include "tlpi_hdr.h"
static volatile sig_atomic_t canJump = 0;
 /* Được đặt thành 1 khi bộ đệm "env" đã được
 khởi tạo bởi [sig]setjmp() */
## ifdef USE_SIGSETJMP
static sigjmp_buf senv;
## else
static jmp_buf env;
## endif
static void
handler(int sig)
{
 /* KHÔNG AN TO TOÀN: Hàm xử lý này sử dụng các hàm không an toàn đối với async-signal
 (printf(), strsignal(), printSigMask(); xem Mục 21.1.2) */
 printf("Received signal %d (%s), signal mask is:\n", sig,
 strsignal(sig));
 printSigMask(stdout, NULL);
 if (!canJump) {
 printf("'env' buffer not yet set, doing a simple return\n");
 return;
 }
## ifdef USE_SIGSETJMP
 siglongjmp(senv, 1);
## else
 longjmp(env, 1);
## endif
}
```

```c
int
main(int argc, char *argv[])
{
 struct sigaction sa;
 printSigMask(stdout, "Signal mask at startup:\n");
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = 0;
 sa.sa_handler = handler;
 if (sigaction(SIGINT, &sa, NULL) == -1)
 errExit("sigaction");
## ifdef USE_SIGSETJMP
 printf("Calling sigsetjmp()\n");
 if (sigsetjmp(senv, 1) == 0)
## else
 printf("Calling setjmp()\n");
 if (setjmp(env) == 0)
## endif
 canJump = 1; /* Executed after [sig]setjmp() */
 else /* Executed after [sig]longjmp() */
 printSigMask(stdout, "After jump from handler, signal mask is:\n" );
 for (;;) /* Wait for signals until killed */
 pause();
}
–––––––––––––––––––––––––––––––––––––––––––––––––– signals/sigmask_longjmp.c
```

### 21.2.2 Kết thúc tiến trình một cách bất thường: abort()

Hàm `abort()` chấm dứt tiến trình gọi (calling process) và làm cho nó tạo ra một tập tin core dump (core dump).

```c
## include <stdlib.h>
void abort(void);
```

Hàm `abort()` chấm dứt tiến trình gọi bằng cách phát tín hiệu `SIGABRT`. Hành động mặc định của `SIGABRT` là tạo ra một tập tin core dump và chấm dứt tiến trình. Tập tin core dump sau đó có thể được sử dụng trong trình gỡ lỗi (debugger) để kiểm tra trạng thái của chương trình tại thời điểm gọi `abort()`.

SUSv3 yêu cầu `abort()` phải ghi đè lên hiệu ứng chặn (blocking) hoặc bỏ qua (ignoring) tín hiệu `SIGABRT`. Hơn nữa, SUSv3 quy định rằng `abort()` phải chấm dứt tiến trình trừ khi tiến trình bắt tín hiệu bằng một trình xử lý (handler) không trả về (does not return). Phát biểu cuối cùng này đòi hỏi phải suy nghĩ một chút. Trong số các phương pháp chấm dứt một trình xử lý tín hiệu (signal handler) được mô tả ở Mục [21.2,](#page-7-0) phương pháp có liên quan ở đây là việc sử dụng lệnh nhảy phi cục bộ (nonlocal goto) để thoát khỏi trình xử lý. Nếu điều này được thực hiện, thì hiệu ứng của `abort()` sẽ bị vô hiệu hóa; nếu không, `abort()` sẽ luôn chấm dứt tiến trình. Trong hầu hết các cài đặt (implementation), việc chấm dứt được đảm bảo như sau: nếu tiến trình vẫn chưa chấm dứt sau khi phát tín hiệu `SIGABRT` một lần (tức là một trình xử lý bắt được tín hiệu và trả về, do đó việc thực thi `abort()` được tiếp tục), `abort()` sẽ thiết lập lại cơ chế xử lý `SIGABRT` thành `SIG_DFL` và phát ra tín hiệu `SIGABRT` thứ hai, điều này đảm bảo sẽ tiêu diệt tiến trình.

Nếu `abort()` chấm dứt tiến trình thành công, thì nó cũng thực hiện xả bộ đệm (flush) và đóng các luồng `stdio`.

Một ví dụ về việc sử dụng `abort()` được cung cấp trong các hàm xử lý lỗi của Liệt kê 3-3 (Listing 3-3), ở trang 54.

## 21.3 Xử lý tín hiệu trên một Stack thay thế: sigaltstack()

Thông thường, khi một trình xử lý tín hiệu được gọi, kernel sẽ tạo một khung (frame) cho nó trên stack của tiến trình (process stack). Tuy nhiên, điều này có thể không khả thi nếu một tiến trình cố gắng mở rộng stack vượt quá kích thước tối đa có thể. Ví dụ, điều này có thể xảy ra do stack phát triển quá lớn khiến nó chạm trán với một vùng nhớ đã được ánh xạ (mapped memory) (Mục 48.5) hoặc vùng heap đang phát triển lên trên, hoặc nó đạt đến giới hạn tài nguyên `RLIMIT_STACK` (Mục 36.3).

Khi một tiến trình cố gắng làm cho stack của nó phát triển vượt quá kích thước tối đa có thể, kernel sẽ tạo ra tín hiệu `SIGSEGV` cho tiến trình. Tuy nhiên, vì không gian stack đã cạn kiệt, kernel không thể tạo khung cho bất kỳ trình xử lý `SIGSEGV` nào mà chương trình có thể đã thiết lập. Do đó, trình xử lý không được gọi và tiến trình bị chấm dứt (hành động mặc định đối với `SIGSEGV`).

Nếu thay vào đó, chúng ta cần đảm bảo rằng tín hiệu `SIGSEGV` được xử lý trong những trường hợp này, chúng ta có thể thực hiện các bước sau:

- 1. Phân bổ một vùng nhớ, gọi là stack tín hiệu thay thế (alternate signal stack), được sử dụng cho khung stack của trình xử lý tín hiệu.
- 2. Sử dụng lời gọi hệ thống (system call) `sigaltstack()` để thông báo cho kernel về sự tồn tại của stack tín hiệu thay thế.
- 3. Khi thiết lập trình xử lý tín hiệu, hãy chỉ định cờ `SA_ONSTACK`, để thông báo cho kernel rằng khung cho trình xử lý này nên được tạo trên stack thay thế.

Lời gọi hệ thống `sigaltstack()` vừa thiết lập một stack tín hiệu thay thế vừa trả về thông tin về bất kỳ stack tín hiệu thay thế nào đã được thiết lập trước đó.

```c
## include <signal.h>
int sigaltstack(const stack_t *sigstack, stack_t *old_sigstack);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Tham số `sigstack` trỏ đến một cấu trúc chỉ định vị trí và các thuộc tính của stack tín hiệu thay thế mới. Tham số `old_sigstack` trỏ đến một cấu trúc được sử dụng để trả về thông tin về stack tín hiệu thay thế đã được thiết lập trước đó (nếu có). Một trong hai tham số này có thể được chỉ định là `NULL`. Ví dụ, chúng ta có thể tìm hiểu về stack tín hiệu thay thế hiện có mà không cần thay đổi nó bằng cách chỉ định `NULL` cho tham số `sigstack`. Nếu không, mỗi tham số này trỏ đến một cấu trúc có kiểu sau:

```
typedef struct {
 void *ss_sp; /* Địa chỉ bắt đầu của stack thay thế */
 int ss_flags; /* Các cờ: SS_ONSTACK, SS_DISABLE */
 size_t ss_size; /* Kích thước của stack thay thế */
} stack_t;
```

Các trường `ss_sp` và `ss_size` chỉ định kích thước và vị trí của stack tín hiệu thay thế. Khi thực sự sử dụng stack tín hiệu thay thế, kernel sẽ tự động lo việc căn chỉnh (aligning) giá trị được cung cấp trong `ss_sp` đến một ranh giới địa chỉ phù hợp với kiến trúc phần cứng.

Thông thường, ngăn xếp tín hiệu thay thế (alternate signal stack) được cấp phát tĩnh (statically allocated) hoặc cấp phát động trên vùng nhớ heap (dynamically allocated on the heap). Tiêu chuẩn SUSv3 chỉ định hằng số `SIGSTKSZ` được sử dụng làm giá trị tiêu chuẩn khi xác định kích thước cho ngăn xếp thay thế, và `MINSIGSTKSZ` là kích thước tối thiểu được yêu cầu để gọi một trình xử lý tín hiệu (signal handler). Trên Linux/x86-32, các hằng số này được định nghĩa với giá trị lần lượt là 8192 và 2048.

Kernel không tự động thay đổi kích thước (resize) của ngăn xếp tín hiệu thay thế. Nếu ngăn xếp bị tràn (overflow) vượt quá vùng không gian mà chúng ta đã cấp phát cho nó, thảm họa sẽ xảy ra (ví dụ: ghi đè lên các biến nằm ngoài giới hạn của ngăn xếp). Đây thường không phải là vấn đề lớn — bởi vì chúng ta thông thường sử dụng ngăn xếp tín hiệu thay thế để xử lý trường hợp đặc biệt là ngăn xếp tiêu chuẩn (standard stack) bị tràn, thông thường chỉ có một hoặc một vài frame được cấp phát trên ngăn xếp này. Công việc của trình xử lý `SIGSEGV` là thực hiện một số dọn dẹp (cleanup) và kết thúc tiến trình (process) hoặc làm cuộn ngược (unwind) ngăn xếp tiêu chuẩn bằng cách sử dụng hàm nhảy phi cục bộ (nonlocal goto).

Trường `ss_flags` chứa một trong các giá trị sau:

### `SS_ONSTACK`

Nếu cờ này được thiết lập khi truy xuất thông tin về ngăn xếp tín hiệu thay thế hiện đang được thiết lập (`old_sigstack`), nó chỉ ra rằng tiến trình hiện đang thực thi trên ngăn xếp tín hiệu thay thế. Mọi nỗ lực thiết lập một ngăn xếp tín hiệu thay thế mới trong khi tiến trình đang chạy trên ngăn xếp tín hiệu thay thế sẽ dẫn đến lỗi (`EPERM`) trả về từ hàm `sigaltstack()`.

### `SS_DISABLE`

Được trả về trong `old_sigstack`, cờ này chỉ ra rằng hiện tại không có ngăn xếp tín hiệu thay thế nào được thiết lập. Khi được chỉ định trong `sigstack`, cờ này sẽ vô hiệu hóa (disable) một ngăn xếp tín hiệu thay thế đang được thiết lập.

[Liệt kê 21-3](#page-15-0) minh họa việc thiết lập và sử dụng một ngăn xếp tín hiệu thay thế. Sau khi thiết lập một ngăn xếp tín hiệu thay thế và một trình xử lý cho `SIGSEGV`, chương trình này gọi một hàm đệ quy vô hạn, sao cho ngăn xếp bị tràn và tiến trình nhận được một tín hiệu `SIGSEGV`. Khi chúng ta chạy chương trình, đây là những gì chúng ta thấy:

```
$ ulimit -s unlimited
$ ./t_sigaltstack
Top of standard stack is near 0xbffff6b8
Alternate stack is at 0x804a948-0x804cfff
Call 1 - top of stack near 0xbff0b3ac
Call 2 - top of stack near 0xbfe1714c
Many intervening lines of output removed
Call 2144 - top of stack near 0x4034120c
```

```
Call 2145 - top of stack near 0x4024cfac
Caught signal 11 (Segmentation fault)
Top of handler stack near 0x804c860
```

Trong phiên shell này, lệnh `ulimit` được sử dụng để loại bỏ bất kỳ giới hạn tài nguyên `RLIMIT_STACK` nào có thể đã được thiết lập trong shell. Chúng ta giải thích giới hạn tài nguyên này trong Mục 36.3.

**Liệt kê 21-3:** Sử dụng `sigaltstack()`

```
––––––––––––––––––––––––––––––––––––––––––––––––––––signals/t_sigaltstack.c
## define _GNU_SOURCE /* Get strsignal() declaration from <string.h> */
## include <string.h>
## include <signal.h>
## include "tlpi_hdr.h"
static void
sigsegvHandler(int sig)
{
 int x;
 /* UNSAFE: This handler uses non-async-signal-safe functions
 (printf(), strsignal(), fflush(); see Section 21.1.2) */
 printf("Caught signal %d (%s)\n", sig, strsignal(sig));
 printf("Top of handler stack near %10p\n", (void *) &x);
 fflush(NULL);
 _exit(EXIT_FAILURE); /* Can't return after SIGSEGV */
}
static void /* A recursive function that overflows the stack */
overflowStack(int callNum)
{
 char a[100000]; /* Make this stack frame large */
 printf("Call %4d - top of stack near %10p\n", callNum, &a[0]);
 overflowStack(callNum+1);
}
int
main(int argc, char *argv[])
{
 stack_t sigstack;
 struct sigaction sa;
 int j;
 printf("Top of standard stack is near %10p\n", (void *) &j);
 /* Allocate alternate stack and inform kernel of its existence */
 sigstack.ss_sp = malloc(SIGSTKSZ);
 if (sigstack.ss_sp == NULL)
 errExit("malloc");
```

```
 sigstack.ss_size = SIGSTKSZ;
 sigstack.ss_flags = 0;
 if (sigaltstack(&sigstack, NULL) == -1)
 errExit("sigaltstack");
 printf("Alternate stack is at %10p-%p\n",
 sigstack.ss_sp, (char *) sbrk(0) - 1);
 sa.sa_handler = sigsegvHandler; /* Establish handler for SIGSEGV */
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = SA_ONSTACK; /* Handler uses alternate stack */
 if (sigaction(SIGSEGV, &sa, NULL) == -1)
 errExit("sigaction");
 overflowStack(1);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––signals/t_sigaltstack.c
```

## 21.4 Cờ `SA_SIGINFO`

Việc thiết lập cờ `SA_SIGINFO` khi đăng ký một trình xử lý với hàm `sigaction()` cho phép trình xử lý đó nhận được thông tin bổ sung về một tín hiệu khi nó được gửi đến (delivered). Để lấy được thông tin này, chúng ta phải khai báo trình xử lý như sau:

```
void handler(int sig, siginfo_t *siginfo, void *ucontext);
```

Đối số đầu tiên, `sig`, là số hiệu tín hiệu, giống như đối với trình xử lý tín hiệu tiêu chuẩn. Đối số thứ hai, `siginfo`, là một cấu trúc (structure) được sử dụng để cung cấp thông tin bổ sung về tín hiệu. Chúng ta mô tả cấu trúc này ở phần dưới. Đối số cuối cùng, `ucontext`, cũng được mô tả bên dưới.

Vì trình xử lý tín hiệu (signal handler) ở trên có một nguyên mẫu (prototype) khác với trình xử lý tín hiệu tiêu chuẩn, các quy tắc kiểu dữ liệu trong C đồng nghĩa với việc chúng ta không thể sử dụng trường `sa_handler` của cấu trúc `sigaction` để chỉ định địa chỉ của trình xử lý. Thay vào đó, chúng ta phải sử dụng một trường thay thế: `sa_sigaction`. Nói cách khác, định nghĩa của cấu trúc `sigaction` phức tạp hơn đôi chút so với những gì đã được trình bày trong Mục 20.13. Cấu trúc này được định nghĩa đầy đủ như sau:

```c
struct sigaction {
 union {
 void (*sa_handler)(int);
 void (*sa_sigaction)(int, siginfo_t *, void *);
 } __sigaction_handler;
 sigset_t sa_mask;
 int sa_flags;
 void (*sa_restorer)(void);
};
/* Các định nghĩa sau đây làm cho các trường trong union trông giống như các trường đơn giản
 trong cấu trúc cha */
## define sa_handler __sigaction_handler.sa_handler
## define sa_sigaction __sigaction_handler.sa_sigaction
```

Cấu trúc `sigaction` sử dụng một `union` để kết hợp hai trường `sa_sigaction` và `sa_handler`. (Hầu hết các cài đặt UNIX khác cũng tương tự khi sử dụng một `union` cho mục đích này.) Việc sử dụng `union` là khả thi vì chỉ có một trong hai trường này được yêu cầu trong một lần gọi `sigaction()` cụ thể. (Tuy nhiên, điều này có thể dẫn đến các lỗi kỳ lạ nếu chúng ta ngây thơ kỳ vọng có thể thiết lập các trường `sa_handler` và `sa_sigaction` một cách độc lập với nhau, có lẽ vì chúng ta tái sử dụng một cấu trúc `sigaction` duy nhất trong nhiều lần gọi `sigaction()` để thiết lập các trình xử lý cho các tín hiệu khác nhau.)

Dưới đây là một ví dụ về việc sử dụng `SA_SIGINFO` để thiết lập một trình xử lý tín hiệu (signal handler):

```c
struct sigaction act;
sigemptyset(&act.sa_mask);
act.sa_sigaction = handler;
act.sa_flags = SA_SIGINFO;
if (sigaction(SIGINT, &act, NULL) == -1)
 errExit("sigaction");
```

Để xem các ví dụ hoàn chỉnh về việc sử dụng cờ `SA_SIGINFO`, hãy xem [Liệt kê 22-3](#page-41-0) (trang [462](#page-41-0)) và Liệt kê 23-5 (trang 500).

### Cấu trúc siginfo_t

Cấu trúc `siginfo_t` được truyền làm đối số thứ hai cho trình xử lý tín hiệu (signal handler) được thiết lập với `SA_SIGINFO` có dạng như sau:

```c
typedef struct {
 int si_signo; /* Số hiệu tín hiệu (Signal number) */
 int si_code; /* Mã tín hiệu (Signal code) */
 int si_trapno; /* Số hiệu bẫy (Trap number) đối với tín hiệu do phần cứng tạo ra
 (không được sử dụng trên hầu hết các kiến trúc) */
 union sigval si_value; /* Dữ liệu kèm theo từ sigqueue() */
 pid_t si_pid; /* Process ID của tiến trình gửi */
 uid_t si_uid; /* Real user ID của tiến trình gửi */
 int si_errno; /* Số hiệu lỗi (thường không được sử dụng) */
 void *si_addr; /* Địa chỉ tạo ra tín hiệu
 (chỉ áp dụng cho các tín hiệu do phần cứng tạo ra) */
 int si_overrun; /* Số lần tràn (Linux 2.6, POSIX timers) */
 int si_timerid; /* ID Timer (nội bộ Kernel)
 (Linux 2.6, POSIX timers) */
 long si_band; /* Sự kiện band (SIGPOLL/SIGIO) */
 int si_fd; /* File Descriptor (SIGPOLL/SIGIO) */
 int si_status; /* Trạng thái thoát (exit status) hoặc tín hiệu (SIGCHLD) */
 clock_t si_utime; /* Thời gian CPU User (SIGCHLD) */
 clock_t si_stime; /* Thời gian CPU Kernel (SIGCHLD) */
} siginfo_t;
```

Macro kiểm tra tính năng `_POSIX_C_SOURCE` phải được định nghĩa với giá trị lớn hơn hoặc bằng 199309 để làm cho khai báo của cấu trúc `siginfo_t` hiển thị từ `<signal.h>`.

Trên Linux, cũng như trên hầu hết các bản cài đặt UNIX, nhiều trường trong cấu trúc `siginfo_t` được kết hợp vào một `union`, vì không phải tất cả các trường đều cần thiết cho mọi tín hiệu. (Xem `<bits/siginfo.h>` để biết thêm chi tiết).

Khi bước vào một trình xử lý tín hiệu (signal handler), các trường của cấu trúc `siginfo_t` được thiết lập như sau:

si_signo

Trường này được thiết lập cho tất cả các tín hiệu. Nó chứa số hiệu của tín hiệu gây ra việc gọi trình xử lý—tức là giá trị giống với đối số `sig` truyền vào trình xử lý.

si_code

Trường này được thiết lập cho tất cả các tín hiệu. Nó chứa một mã cung cấp thêm thông tin về nguồn gốc của tín hiệu, như được thể hiện trong Bảng 21-1.

si_value

Trường này chứa dữ liệu kèm theo cho một tín hiệu được gửi thông qua hàm `sigqueue()`. Chúng tôi mô tả `sigqueue()` trong Mục [22.8.1](#page-37-0).

si_pid

Đối với các tín hiệu được gửi thông qua `kill()` hoặc `sigqueue()`, trường này được đặt thành Process ID của tiến trình gửi.

si_uid

Đối với các tín hiệu được gửi thông qua `kill()` hoặc `sigqueue()`, trường này được đặt thành Real user ID của tiến trình gửi. Hệ thống cung cấp Real user ID của tiến trình gửi vì thông tin đó hữu ích hơn việc cung cấp Effective user ID. Hãy xem xét các quy tắc phân quyền để gửi tín hiệu được mô tả trong Mục 20.5: nếu Effective user ID cấp cho người gửi quyền gửi tín hiệu, thì User ID đó phải hoặc bằng 0 (tức là một tiến trình có quyền đặc quyền - privileged process), hoặc phải giống với Real user ID hoặc Saved set-user-ID của tiến trình nhận. Trong trường hợp này, việc tiến trình nhận biết được Real user ID của người gửi có thể rất hữu ích, vì nó có thể khác với Effective user ID (ví dụ: nếu bên gửi là một chương trình set-user-ID).

si_errno

Nếu trường này được đặt thành một giá trị khác không, thì nó chứa một số hiệu lỗi (giống như `errno`) xác định nguyên nhân gây ra tín hiệu. Trường này thường không được sử dụng trên Linux.

si\_addr

Trường này chỉ được thiết lập cho các tín hiệu (signal) do phần cứng tạo ra gồm SIGBUS, SIGSEGV, SIGILL và SIGFPE. Đối với các tín hiệu SIGBUS và SIGSEGV, trường này chứa địa chỉ gây ra tham chiếu bộ nhớ không hợp lệ (invalid memory reference). Đối với các tín hiệu SIGILL và SIGFPE, trường này chứa địa chỉ của câu lệnh chương trình gây ra tín hiệu đó.

Các trường sau đây, vốn là các phần mở rộng phi chuẩn của Linux, chỉ được thiết lập khi chuyển giao (delivery) một tín hiệu được tạo ra do hết hạn bộ định thời POSIX (POSIX timer) (xem Mục 23.6):

si\_timerid

Trường này chứa một ID mà kernel sử dụng nội bộ để định danh bộ định thời.

si\_overrun

Trường này được thiết lập bằng số lần tràn (overrun count) của bộ định thời.

Hai trường sau đây chỉ được thiết lập khi chuyển giao tín hiệu SIGIO (Mục 63.3):

si\_band

Trường này chứa giá trị "sự kiện dải ưu tiên" (band event) liên quan đến sự kiện I/O. (Trong các phiên bản glibc cho đến 2.3.2, kiểu dữ liệu của si\_band là int).

si\_fd

Trường này chứa số hiệu của bộ mô tả tệp (file descriptor) liên quan đến sự kiện I/O. Trường này không được quy định trong SUSv3, nhưng có mặt trên nhiều hệ thống thực thi khác.

Các trường sau đây chỉ được thiết lập khi chuyển giao tín hiệu SIGCHLD (Mục 26.3):

si\_status

Trường này chứa trạng thái thoát (exit status) của tiến trình con (child process) (nếu si\_code là CLD\_EXITED) hoặc số hiệu của tín hiệu được gửi đến tiến trình con (tức là số hiệu của tín hiệu đã chấm dứt hoặc dừng tiến trình con, như được mô tả trong Mục 26.1.3).

si\_utime

Trường này chứa thời gian CPU ở chế độ người dùng (user CPU time) mà tiến trình con đã sử dụng. Trong các kernel trước phiên bản 2.6, và kể từ phiên bản 2.6.27, thời gian này được đo bằng các tick xung nhịp hệ thống (system clock ticks) (chia cho sysconf(\_SC\_CLK\_TCK)). Trong các kernel phiên bản 2.6 trước 2.6.27, một lỗi (bug) khiến trường này báo cáo thời gian được đo bằng các đơn vị jiffies (có thể cấu hình bởi người dùng) (xem Mục 10.6). Trường này không được quy định trong SUSv3, nhưng có mặt trên nhiều hệ thống thực thi khác.

si\_stime

Trường này chứa thời gian CPU ở chế độ kernel/hệ thống (system CPU time) mà tiến trình con đã sử dụng. Xem phần mô tả của trường si\_utime. Trường này không được quy định trong SUSv3, nhưng có mặt trên nhiều hệ thống thực thi khác.

Trường si\_code cung cấp thêm thông tin về nguồn gốc của tín hiệu, sử dụng các giá trị được hiển thị trong Bảng 21-2. Không phải tất cả các giá trị đặc thù của tín hiệu được hiển thị trong cột thứ hai của bảng này đều xuất hiện trên mọi hệ thống thực thi UNIX và kiến trúc phần cứng (đặc biệt là trong trường hợp của bốn tín hiệu do phần cứng tạo ra là SIGBUS, SIGSEGV, SIGILL và SIGFPE), mặc dù tất cả các hằng số này đều được định nghĩa trên Linux và hầu hết xuất hiện trong SUSv3.

Lưu ý các điểm bổ sung sau đây về các giá trị được hiển thị trong Bảng 21-2:

- Các giá trị SI\_KERNEL và SI\_SIGIO là đặc thù của Linux. Chúng không được quy định trong SUSv3 và không xuất hiện trên các hệ thống thực thi UNIX khác.
- SI\_SIGIO chỉ được sử dụng trong Linux 2.2. Từ kernel 2.4 trở đi, Linux thay vào đó sử dụng các hằng số POLL\_\* được hiển thị trong bảng.

SUSv4 quy định hàm psiginfo(), có mục đích tương tự như hàm psignal() (Mục 20.8). Hàm psiginfo() nhận hai đối số: một con trỏ trỏ đến cấu trúc siginfo\_t và một chuỗi thông báo. Nó in chuỗi thông báo ra luồng lỗi chuẩn (standard error), theo sau là thông tin về tín hiệu được mô tả trong cấu trúc siginfo\_t. Hàm psiginfo() được cung cấp bởi glibc kể từ phiên bản 2.10. Bản cài đặt của glibc sẽ in ra phần mô tả tín hiệu, nguồn gốc của tín hiệu (được chỉ ra bởi trường si\_code), và đối với một số tín hiệu, các trường khác từ cấu trúc siginfo\_t. Hàm psiginfo() là một hàm mới trong SUSv4 và không có sẵn trên tất cả các hệ thống.

**Bảng 21-2:** Các giá trị được trả về trong trường si\_code của cấu trúc siginfo\_t

| Tín hiệu | Giá trị si_code | Nguồn gốc của tín hiệu |
|----------|---------------|-------------------------------------------------------------|
| Bất kỳ | SI_ASYNCIO | Hoàn thành một thao tác I/O bất đồng bộ (Asynchronous I/O - AIO) |
| | SI_KERNEL | Được gửi bởi kernel (ví dụ: tín hiệu từ trình điều khiển thiết bị đầu cuối - terminal driver) |
| | SI_MESGQ | Thông điệp đến trên hàng đợi thông điệp POSIX (POSIX message queue) (kể từ Linux 2.6.6) |
| | SI_QUEUE | Tín hiệu thời gian thực (realtime signal) từ một tiến trình người dùng thông qua sigqueue() |
| | SI_SIGIO | Tín hiệu SIGIO (chỉ có trên Linux 2.2) |
| | SI_TIMER | Hết hạn của bộ định thời POSIX (thời gian thực) |
| | SI_TKILL | Từ một tiến trình người dùng thông qua tkill() hoặc tgkill() (kể từ Linux 2.4.19) |
| | SI_USER | Từ một tiến trình người dùng thông qua kill() hoặc raise() |
| SIGBUS | BUS_ADRALN | Căn chỉnh địa chỉ không hợp lệ (Invalid address alignment) |
| | BUS_ADRERR | Địa chỉ vật lý không tồn tại |
| | BUS_MCEERR_AO | Lỗi bộ nhớ phần cứng; hành động là tùy chọn (action optional) (kể từ Linux 2.6.32) |
| | BUS_MCEERR_AR | Lỗi bộ nhớ phần cứng; hành động là bắt buộc (action required) (kể từ Linux 2.6.32) |

|          | BUS_OBJERR    | Lỗi phần cứng đặc thù của đối tượng (Object-specific hardware error) |
| SIGCHLD  | CLD_CONTINUED | Tiến trình con được tiếp tục bởi SIGCONT (từ Linux 2.6.9)     |
|          | CLD_DUMPED    | Tiến trình con chấm dứt bất thường, có tạo core dump         |
|          | CLD_EXITED    | Tiến trình con đã thoát (exited)                            |
|          | CLD_KILLED    | Tiến trình con chấm dứt bất thường, không có core dump      |
|          | CLD_STOPPED   | Tiến trình con bị dừng (stopped)                            |
|          | CLD_TRAPPED   | Tiến trình con đang được trace đã bị dừng                   |
| SIGFPE   | FPE_FLTDIV    | Phép chia cho số không (divide-by-zero) dấu phẩy động       |
|          | FPE_FLTINV    | Thao tác dấu phẩy động không hợp lệ                         |
|          | FPE_FLTOVF    | Tràn (overflow) dấu phẩy động                               |
|          | FPE_FLTRES    | Kết quả dấu phẩy động không chính xác                       |
|          | FPE_FLTUND    | Tràn dưới (underflow) dấu phẩy động                         |
|          | FPE_INTDIV    | Phép chia cho số không số nguyên                            |
|          | FPE_INTOVF    | Tràn số nguyên                                              |
|          | FPE_SUB       | Chỉ số mảng (subscript) nằm ngoài phạm vi                   |
| SIGILL   | ILL_BADSTK    | Lỗi ngăn xếp nội bộ (Internal stack error)                  |
|          | ILL_COPROC    | Lỗi bộ đồng xử lý (Coprocessor error)                       |
|          | ILL_ILLADR    | Chế độ định địa chỉ không hợp lệ                            |
|          | ILL_ILLOPC    | Mã lệnh (opcode) không hợp lệ                               |
|          | ILL_ILLOPN    | Toán hạng không hợp lệ                                      |
|          | ILL_ILLTRP    | Trap không hợp lệ                                           |
|          | ILL_PRVOPC    | Mã lệnh có đặc quyền (privileged opcode)                    |
|          | ILL_PRVREG    | Thanh ghi có đặc quyền (privileged register)                |
| SIGPOLL/ | POLL_ERR      | Lỗi I/O                                                     |
| SIGIO    | POLL_HUP      | Thiết bị ngắt kết nối                                       |
|          | POLL_IN       | Có dữ liệu đầu vào sẵn sàng                                 |
|          | POLL_MSG      | Có thông điệp đầu vào sẵn sàng                              |
|          | POLL_OUT      | Có bộ đệm đầu ra sẵn sàng                                   |
|          | POLL_PRI      | Có dữ liệu đầu vào độ ưu tiên cao sẵn sàng                  |
| SIGSEGV  | SEGV_ACCERR   | Quyền truy cập không hợp lệ cho đối tượng được ánh xạ (mapped object) |
|          |               |                                                             |

*(tiếp theo)*

**Bảng 21-2:** Các giá trị được trả về trong trường si\_code của cấu trúc siginfo\_t (tiếp theo)

| Signal  | Giá trị si_code | Nguồn gốc của signal           |
|---------|-----------------|--------------------------------|
| SIGTRAP | TRAP_BRANCH     | Trap rẽ nhánh tiến trình       |
|         | TRAP_BRKPT      | Điểm dừng (breakpoint) tiến trình |
|         | TRAP_HWBKPT     | Điểm dừng/điểm theo dõi phần cứng (Hardware breakpoint/watchpoint) |
|         | TRAP_TRACE      | Trap trace tiến trình          |

### Đối số ucontext

Đối số cuối cùng được truyền đến một handler được thiết lập với cờ SA\_SIGINFO, ucontext, là một con trỏ trỏ tới một cấu trúc kiểu ucontext\_t (được định nghĩa trong <ucontext.h>). (SUSv3 sử dụng một con trỏ void cho đối số này vì tiêu chuẩn không định nghĩa chi tiết nào về đối số đó.) Cấu trúc này cung cấp thông tin ngữ cảnh người dùng (user-context) mô tả trạng thái tiến trình trước khi gọi signal handler, bao gồm mặt nạ signal (signal mask) trước đó của tiến trình và các giá trị thanh ghi được lưu (ví dụ: bộ đếm chương trình - program counter và con trỏ ngăn xếp - stack pointer). Thông tin này rất hiếm khi được sử dụng trong các signal handler, vì vậy chúng ta sẽ không đi vào chi tiết hơn.

> Một cách sử dụng khác của các cấu trúc ucontext\_t là thông qua các hàm getcontext(), makecontext(), setcontext(), và swapcontext(), cho phép một tiến trình lần lượt lấy, tạo, thay đổi và hoán đổi các ngữ cảnh thực thi. (Các thao tác này tương tự như setjmp() và longjmp(), nhưng tổng quát hơn.) Các hàm này có thể được sử dụng để cài đặt coroutine, trong đó luồng thực thi (thread of execution) của một tiến trình luân phiên giữa hai (hoặc nhiều) hàm. SUSv3 định nghĩa các hàm này, nhưng đánh dấu chúng là lỗi thời (obsolete). SUSv4 loại bỏ các đặc tả này và đề xuất rằng các ứng dụng nên được viết lại để sử dụng POSIX threads thay thế. Tài liệu hướng dẫn (manual) của glibc cung cấp thêm thông tin về các hàm này.

## 21.5 Ngắt và Khởi động lại System Call

Hãy xem xét kịch bản sau:

- 1. Chúng ta thiết lập một handler cho một signal nào đó.
- 2. Chúng ta thực hiện một system call chặn (blocking system call), ví dụ, một lệnh read() từ một thiết bị terminal, lệnh này sẽ bị chặn cho đến khi có dữ liệu đầu vào được cung cấp.

- 3. Trong khi System Call đang bị chặn (blocked), tín hiệu (signal) mà chúng ta thiết lập hàm xử lý (signal handler) sẽ được gửi đến, và hàm xử lý tín hiệu đó được gọi thực thi.

Điều gì xảy ra sau khi hàm xử lý tín hiệu trả về (returns)? Theo mặc định, System Call sẽ thất bại với mã lỗi `EINTR` ("Interrupted function" - Hàm bị ngắt). Đây có thể là một tính năng hữu ích. Trong Mục 23.3, chúng ta sẽ thấy cách sử dụng một bộ định thời (timer) — dẫn đến việc gửi tín hiệu `SIGALRM` — để thiết lập thời gian chờ (timeout) cho một System Call đang bị chặn như `read()`.

Tuy nhiên, trong nhiều trường hợp, chúng ta muốn tiếp tục thực thi một System Call bị ngắt. Để làm điều này, chúng ta có thể sử dụng đoạn mã nguồn như sau để thủ công khởi động lại (restart) một System Call trong trường hợp nó bị ngắt bởi hàm xử lý tín hiệu:

```c
while ((cnt = read(fd, buf, BUF_SIZE)) == -1 && errno == EINTR)
 continue; /* Thân vòng lặp không làm gì cả */
if (cnt == -1) /* read() thất bại với lỗi khác ngoài EINTR */
 errExit("read");
```

Nếu chúng ta thường xuyên viết mã nguồn giống như trên, việc định nghĩa một macro như sau sẽ rất hữu ích:

```c
## define NO_EINTR(stmt) while ((stmt) == -1 && errno == EINTR);
```

Sử dụng macro này, chúng ta có thể viết lại lời gọi `read()` trước đó như sau:

```c
NO_EINTR(cnt = read(fd, buf, BUF_SIZE));
if (cnt == -1) /* read() thất bại với lỗi khác ngoài EINTR */
 errExit("read");
```

Thư viện GNU C cung cấp một macro (không chuẩn) có cùng mục đích với macro `NO_EINTR()` của chúng ta trong tệp tiêu đề `<unistd.h>`. Macro này có tên là `TEMP_FAILURE_RETRY()` và sẽ khả dụng nếu macro kiểm tra tính năng `_GNU_SOURCE` được định nghĩa.

Ngay cả khi chúng ta sử dụng một macro như `NO_EINTR()`, việc để các hàm xử lý tín hiệu ngắt các System Call có thể gây ra sự bất tiện, vì chúng ta phải thêm mã nguồn vào từng System Call bị chặn (giả sử rằng chúng ta muốn khởi động lại lời gọi trong từng trường hợp). Thay vào đó, chúng ta có thể chỉ định cờ `SA_RESTART` khi thiết lập hàm xử lý tín hiệu bằng hàm `sigaction()`, để các System Call được kernel tự động khởi động lại thay cho Process. Điều này có nghĩa là chúng ta không cần phải xử lý giá trị trả về lỗi `EINTR` có thể xảy ra cho các System Call này.

Cờ `SA_RESTART` là một thiết lập tính trên từng tín hiệu (per-signal). Nói cách khác, chúng ta có thể cho phép các hàm xử lý đối với một số tín hiệu làm ngắt các System Call bị chặn, trong khi các tín hiệu khác cho phép tự động khởi động lại System Call.

## System Call (và các hàm thư viện) mà cờ `SA_RESTART` có hiệu lực

Đáng tiếc là không phải tất cả các System Call bị chặn đều tự động khởi động lại khi chỉ định cờ `SA_RESTART`. Lý do cho việc này một phần là do lịch sử:

- Việc khởi động lại System Call được giới thiệu từ phiên bản 4.2BSD, và áp dụng cho các lời gọi bị ngắt đến `wait()` và `waitpid()`, cũng như các System Call I/O sau: `read()`, `readv()`, `write()`, `writev()`, và các thao tác `ioctl()` bị chặn. Các System Call I/O này có thể bị ngắt, và do đó chỉ được tự động khởi động lại bởi `SA_RESTART` khi thao tác trên một thiết bị "chậm" (slow device). Các thiết bị chậm bao gồm terminal, pipe, FIFO và socket. Trên các loại tệp này, các thao tác I/O khác nhau có thể bị chặn. (Ngược lại, các tệp trên đĩa không nằm trong danh mục thiết bị chậm, bởi vì các thao tác I/O đĩa nhìn chung có thể được đáp ứng ngay lập tức thông qua bộ đệm trang (Page Cache). Nếu yêu cầu I/O đĩa là bắt buộc, kernel sẽ đặt Process vào trạng thái ngủ (sleep) cho đến khi I/O hoàn tất).
- Một số System Call bị chặn khác có nguồn gốc từ System V vốn ban đầu không hỗ trợ cơ chế khởi động lại System Call.

Trên Linux, các System Call bị chặn sau đây (và các hàm thư viện tầng trên dựa trên System Call) sẽ tự động được khởi động lại nếu bị ngắt bởi một hàm xử lý tín hiệu được thiết lập sử dụng cờ `SA_RESTART`:

- Các System Call dùng để chờ một tiến trình con (Process Child) (Mục 26.1): `wait()`, `waitpid()`, `wait3()`, `wait4()`, và `waitid()`.
- Các System Call I/O `read()`, `readv()`, `write()`, `writev()`, và `ioctl()` khi áp dụng cho các thiết bị "chậm". Trong các trường hợp dữ liệu đã được truyền đi một phần tại thời điểm tín hiệu được gửi đến, các System Call nhập/xuất sẽ bị ngắt, nhưng trả về trạng thái thành công: một số nguyên chỉ ra có bao nhiêu byte đã được truyền thành công.
- System Call `open()`, trong các trường hợp nó có thể bị chặn (ví dụ, khi mở các FIFO, như được mô tả trong Mục 44.7).
- Các System Call khác nhau được sử dụng với socket: `accept()`, `accept4()`, `connect()`, `send()`, `sendmsg()`, `sendto()`, `recv()`, `recvfrom()`, và `recvmsg()`. (Trên Linux, các System Call này không tự động khởi động lại nếu thời gian chờ (timeout) đã được thiết lập trên socket bằng hàm `setsockopt()`. Xem trang hướng dẫn thủ công `signal(7)` để biết thêm chi tiết).
- Các System Call được sử dụng cho I/O trên hàng đợi thông điệp POSIX (POSIX message queues): `mq_receive()`, `mq_timedreceive()`, `mq_send()`, và `mq_timedsend()`.
- Các System Call và hàm thư viện được sử dụng để thiết lập khóa tệp (file locks): `flock()`, `fcntl()`, và `lockf()`.
- Thao tác `FUTEX_WAIT` của System Call `futex()` đặc trưng cho Linux.
- Các hàm `sem_wait()` và `sem_timedwait()` được sử dụng để giảm giá trị của một Semaphore POSIX. (Trên một số cài đặt UNIX, `sem_wait()` được khởi động lại nếu cờ `SA_RESTART` được chỉ định).

- Các hàm được sử dụng để đồng bộ hóa POSIX thread (luồng POSIX): `pthread_mutex_lock()`, `pthread_mutex_trylock()`, `pthread_mutex_timedlock()`, `pthread_cond_wait()` và `pthread_cond_timedwait()`.

Trong các phiên bản kernel trước 2.6.22, `futex()`, `sem_wait()` và `sem_timedwait()` luôn thất bại với lỗi `EINTR` khi bị ngắt, bất kể cài đặt của cờ `SA_RESTART`.

Các System Call (lời gọi hệ thống) chặn (blocking system call) sau đây (và các hàm thư viện xây dựng dựa trên System Call) không bao giờ được tự động khởi động lại (ngay cả khi `SA_RESTART` được chỉ định):

- Các System Call đa hợp I/O (I/O multiplexing): `poll()`, `ppoll()`, `select()` và `pselect()`. (SUSv3 quy định rõ ràng rằng hành vi của `select()` và `pselect()` khi bị ngắt bởi một signal handler (trình xử lý tín hiệu) là không xác định, bất kể cài đặt của `SA_RESTART`.)
- Các System Call đặc thù của Linux: `epoll_wait()` và `epoll_pwait()`.
- System Call đặc thù của Linux: `io_getevents()`.
- Các System Call chặn được sử dụng với hàng đợi thông điệp (message queue) và semaphore của System V: `semop()`, `semtimedop()`, `msgrcv()` và `msgsnd()`. (Mặc dù ban đầu System V không cung cấp tính năng tự động khởi động lại System Call, nhưng trên một số cài đặt UNIX, các System Call này được khởi động lại nếu cờ `SA_RESTART` được chỉ định.)
- Một thao tác `read()` từ một inotify file descriptor (mô tả tệp inotify).
- Các System Call và hàm thư viện được thiết kế để tạm dừng việc thực thi của một chương trình trong một khoảng thời gian xác định: `sleep()`, `nanosleep()` và `clock_nanosleep()`.
- Các System Call được thiết kế riêng để chờ cho đến khi một tín hiệu (signal) được gửi tới: `pause()`, `sigsuspend()`, `sigtimedwait()` và `sigwaitinfo()`.

## Sửa đổi cờ SA_RESTART cho một tín hiệu

Hàm `siginterrupt()` thay đổi cài đặt `SA_RESTART` được liên kết với một tín hiệu.

```c
## include <signal.h>
int siginterrupt(int sig, int flag);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Nếu `flag` là true (1), thì một handler (trình xử lý) cho tín hiệu `sig` sẽ ngắt các System Call chặn. Nếu `flag` là false (0), thì các System Call chặn sẽ được khởi động lại sau khi thực thi handler cho `sig`.

Hàm `siginterrupt()` hoạt động bằng cách sử dụng `sigaction()` để lấy một bản sao của trạng thái/thiết lập xử lý hiện thời (disposition) của tín hiệu, tinh chỉnh cờ `SA_RESTART` trong cấu trúc `oldact` được trả về, và sau đó gọi lại `sigaction()` một lần nữa để cập nhật thiết lập xử lý của tín hiệu.

SUSv4 đánh dấu `siginterrupt()` là lỗi thời (obsolete), thay vào đó khuyến nghị sử dụng `sigaction()` cho mục đích này.

### Các tín hiệu dừng không được xử lý có thể tạo ra EINTR đối với một số System Call của Linux

Trên Linux, một số System Call chặn có thể trả về `EINTR` ngay cả khi vắng bóng signal handler. Điều này có thể xảy ra nếu System Call bị chặn và tiến trình (process) bị dừng bởi một tín hiệu (`SIGSTOP`, `SIGTSTP`, `SIGTTIN` hoặc `SIGTTOU`), sau đó được tiếp tục lại thông qua việc gửi tín hiệu `SIGCONT`.

Các System Call và hàm sau đây thể hiện hành vi này: `epoll_pwait()`, `epoll_wait()`, `read()` từ một inotify file descriptor, `semop()`, `semtimedop()`, `sigtimedwait()` và `sigwaitinfo()`.

Trong các kernel trước 2.6.24, `poll()` cũng thể hiện hành vi này, tương tự như `sem_wait()`, `sem_timedwait()`, `futex(FUTEX_WAIT)` trong các kernel trước 2.6.22, `msgrcv()` và `msgsnd()` trong các kernel trước 2.6.9, và `nanosleep()` trong Linux 2.4 trở về trước.

Trong Linux 2.4 và các phiên bản trước đó, `sleep()` cũng có thể bị ngắt theo cách này, nhưng thay vì trả về một mã lỗi, nó trả về số giây chưa ngủ còn lại.

Hệ quả của hành vi này là nếu có khả năng chương trình của chúng ta bị dừng và khởi động lại bởi các tín hiệu, thì chúng ta có thể cần phải bao gồm mã nguồn để khởi động lại các System Call này, ngay cả trong một chương trình không cài đặt các handler cho các tín hiệu dừng.

## 21.6 Tổng kết

Trong chương này, chúng ta đã xem xét một loạt các yếu tố ảnh hưởng đến hoạt động và thiết kế của các trình xử lý tín hiệu (signal handler).

Vì các tín hiệu (signal) không được xếp hàng đợi (queued), trình xử lý tín hiệu đôi khi phải được lập trình để xử lý khả năng xảy ra nhiều sự kiện của một loại cụ thể, mặc dù chỉ có một tín hiệu được chuyển đến. Vấn đề tính tái nhập (reentrancy) ảnh hưởng đến cách chúng ta có thể cập nhật các biến toàn cục và giới hạn tập hợp các hàm mà chúng ta có thể gọi một cách an toàn từ bên trong trình xử lý tín hiệu.

Thay vì trả về (return), một trình xử lý tín hiệu có thể kết thúc bằng nhiều cách khác nhau, bao gồm gọi `_exit()`, chấm dứt tiến trình (process) bằng cách gửi tín hiệu (`kill()`, `raise()`, hoặc `abort()`), hoặc thực hiện một bước nhảy phi cục bộ (nonlocal goto). Việc sử dụng `sigsetjmp()` và `siglongjmp()` cung cấp cho chương trình quyền kiểm soát rõ ràng đối với việc xử lý mặt nạ tín hiệu của tiến trình (process signal mask) khi một bước nhảy phi cục bộ được thực hiện.

Chúng ta có thể sử dụng `sigaltstack()` để định nghĩa một ngăn xếp tín hiệu thay thế (alternate signal stack) cho một tiến trình. Đây là một vùng nhớ được sử dụng thay cho ngăn xếp tiến trình chuẩn (standard process stack) khi gọi một trình xử lý tín hiệu. Ngăn xếp tín hiệu thay thế hữu ích trong các trường hợp ngăn xếp chuẩn đã cạn kiệt do phát triển quá lớn (tại thời điểm đó kernel sẽ gửi tín hiệu `SIGSEGV` đến tiến trình).

Cờ `SA_SIGINFO` của hàm `sigaction()` cho phép chúng ta thiết lập một trình xử lý tín hiệu nhận thêm thông tin về một tín hiệu. Thông tin này được cung cấp thông qua cấu trúc `siginfo_t` mà địa chỉ của nó được truyền như một đối số cho trình xử lý tín hiệu.

Khi một trình xử lý tín hiệu làm gián đoạn một lời gọi hệ thống (system call) đang bị chặn (blocked), lời gọi hệ thống sẽ thất bại với lỗi `EINTR`. Chúng ta có thể tận dụng hành vi này để, ví dụ, đặt bộ hẹn giờ (timer) cho một lời gọi hệ thống đang bị chặn. Các lời gọi hệ thống bị gián đoạn có thể được khởi động lại thủ công nếu muốn. Ngoài ra, việc thiết lập trình xử lý tín hiệu với cờ `SA_RESTART` của `sigaction()` sẽ khiến nhiều (nhưng không phải tất cả) lời gọi hệ thống tự động được khởi động lại.

### Thông tin thêm

Xem các tài liệu được liệt kê trong Mục 20.15.

## 21.7 Bài tập

**21-1.** Triển khai hàm `abort()`.
