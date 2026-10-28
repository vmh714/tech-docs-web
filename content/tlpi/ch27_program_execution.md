# Chương 27: Thực thi chương trình (Program Execution)

Chương này tiếp nối phần thảo luận của chúng ta về việc tạo và kết thúc tiến trình (process creation and termination) trong các chương trước. Bây giờ chúng ta sẽ xem xét cách một tiến trình có thể sử dụng system call `execve()` để thay thế chương trình mà nó đang chạy bằng một chương trình hoàn toàn mới. Sau đó, chúng ta sẽ chỉ cách triển khai hàm `system()`, cho phép tiến trình gọi thực thi một lệnh shell tùy ý.

## 27.1 Thực thi một Chương trình Mới: execve()

System call `execve()` tải một chương trình mới vào bộ nhớ của tiến trình (process's memory). Trong quá trình này, chương trình cũ bị loại bỏ, và stack, data, heap của tiến trình được thay thế bằng các phần tương ứng của chương trình mới. Sau khi thực thi các mã khởi động thời gian chạy thư viện C (C library run-time startup code) và mã khởi tạo chương trình khác nhau (ví dụ: các hàm khởi dựng tĩnh của C++ hoặc các hàm C được khai báo với thuộc tính constructor của gcc được mô tả trong Mục 42.4), chương trình mới bắt đầu thực thi tại hàm `main()` của nó.

Việc sử dụng `execve()` thường xuyên nhất là ở tiến trình con (child) được tạo ra bởi `fork()`, mặc dù nó cũng thỉnh thoảng được sử dụng trong các ứng dụng không có lời gọi `fork()` đi trước.

Các hàm thư viện khác nhau, tất cả đều có tên bắt đầu bằng `exec`, được xây dựng chồng lên system call `execve()`. Mỗi hàm trong số này cung cấp một giao diện khác nhau cho cùng một chức năng. Việc tải một chương trình mới bởi bất kỳ lời gọi nào trong số này thường được gọi là một thao tác exec (exec operation), hoặc đơn giản bằng ký hiệu `exec()`. Chúng ta bắt đầu với phần mô tả về `execve()` và sau đó mô tả các hàm thư viện.

```c
## include <unistd.h>

int execve(const char *pathname, char *const argv[], char *const envp[]);
```

Không bao giờ trả về khi thành công; trả về –1 khi có lỗi

Đối số `pathname` chứa tên đường dẫn của chương trình mới sẽ được tải vào bộ nhớ của tiến trình. Tên đường dẫn này có thể là tuyệt đối (được chỉ ra bằng dấu `/` ở đầu) hoặc tương đối so với thư mục làm việc hiện tại (current working directory) của tiến trình gọi.

Đối số `argv` chỉ định các đối số dòng lệnh (command-line arguments) sẽ được truyền cho chương trình mới. Mảng này tương ứng với, và có cùng hình thức với, đối số thứ hai (`argv`) của hàm `main()` trong C; nó là một danh sách các con trỏ trỏ đến các chuỗi ký tự được kết thúc bằng `NULL`. Giá trị được cung cấp cho `argv[0]` tương ứng với tên lệnh. Thông thường, giá trị này giống với tên cơ sở (basename) (tức là thành phần cuối cùng) của `pathname`.

Đối số cuối cùng, `envp`, chỉ định danh sách môi trường (environment list) cho chương trình mới. Đối số `envp` tương ứng với mảng `environ` của chương trình mới; nó là một danh sách các con trỏ trỏ đến các chuỗi ký tự có dạng `name=value` được kết thúc bằng `NULL` (Mục 6.7).

> [!NOTE]
> Tệp `/proc/PID/exe` đặc trưng của Linux là một liên kết tượng trưng (symbolic link) chứa tên đường dẫn tuyệt đối của tệp thực thi đang được chạy bởi tiến trình tương ứng.

Sau một lời gọi `execve()`, ID tiến trình (process ID) của tiến trình vẫn giữ nguyên, bởi vì cùng một tiến trình tiếp tục tồn tại. Một số thuộc tính khác của tiến trình cũng không thay đổi, như được mô tả trong Mục [28.4.](#page-99-0)

Nếu bit quyền set-user-ID (set-group-ID) của tệp chương trình được chỉ định bởi `pathname` được thiết lập, thì khi tệp được thực thi bằng lệnh exec, ID người dùng (nhóm) hiệu dụng (effective user/group ID) của tiến trình sẽ được thay đổi thành giống với chủ sở hữu (nhóm) của tệp chương trình. Đây là cơ chế tạm thời cấp quyền cho người dùng khi chạy một chương trình cụ thể (xem Mục 9.3).

Sau khi thay đổi tùy chọn các ID hiệu dụng, và bất kể chúng có bị thay đổi hay không, `execve()` sao chép giá trị ID người dùng hiệu dụng của tiến trình vào set-user-ID đã lưu (saved set-user-ID) của nó, và sao chép giá trị ID nhóm hiệu dụng của tiến trình vào set-group-ID đã lưu (saved set-group-ID) của nó.

Vì nó thay thế chương trình đã gọi nó, một lời gọi `execve()` thành công sẽ không bao giờ trả về. Chúng ta không bao giờ cần kiểm tra giá trị trả về từ `execve()`; nó sẽ luôn là –1. Bản thân việc nó trả về cho chúng ta biết rằng đã có lỗi xảy ra, và như thường lệ, chúng ta có thể sử dụng `errno` để xác định nguyên nhân. Trong số các lỗi có thể được trả về trong `errno` có các lỗi sau:

### EACCES

Đối số `pathname` không trỏ đến một tệp thông thường (regular file), tệp không được bật quyền thực thi (execute permission), hoặc một trong các thành phần thư mục của `pathname` không thể tìm kiếm được (tức là quyền thực thi bị từ chối trên thư mục đó). Hoặc cách khác, tệp nằm trên một hệ thống tệp (file system) được gắn kết (mounted) với cờ `MS_NOEXEC` (Mục 14.8.1).

ENOENT

Tệp được trỏ tới bởi `pathname` không tồn tại.

ENOEXEC

Tệp được trỏ tới bởi `pathname` được đánh dấu là có thể thực thi, nhưng không ở định dạng thực thi có thể nhận dạng được. Có thể, đó là một tập lệnh (script) không bắt đầu bằng một dòng (bắt đầu bằng các ký tự `#!`) chỉ định bộ thông dịch tập lệnh (script interpreter).

ETXTBSY

Tệp được trỏ tới bởi `pathname` đang mở để ghi bởi một tiến trình khác (Mục 4.3.2).

E2BIG

Tổng dung lượng bộ nhớ được yêu cầu bởi danh sách đối số và danh sách môi trường vượt quá giới hạn tối đa cho phép.

Các lỗi được liệt kê ở trên cũng có thể được sinh ra nếu bất kỳ điều kiện nào trong số này áp dụng cho tệp thông dịch được định nghĩa để chạy một tập lệnh (tham khảo Mục [27.3](#page-59-0)) hoặc cho bộ thông dịch ELF đang được sử dụng để thực thi chương trình.

> [!NOTE]
> Định dạng Executable and Linking Format (ELF) là một đặc tả được áp dụng rộng rãi, mô tả bố cục của các tệp thực thi. Thông thường, trong quá trình `exec`, một image tiến trình (process image) được xây dựng bằng cách sử dụng các đoạn (segment) của tệp thực thi (Mục 6.3). Tuy nhiên, đặc tả ELF cũng cho phép một tệp thực thi định nghĩa một trình thông dịch (interpreter) (phần tử header chương trình ELF `PT_INTERP`) để sử dụng cho việc thực thi chương trình. Nếu một trình thông dịch được định nghĩa, kernel sẽ xây dựng image tiến trình từ các đoạn của tệp thực thi trình thông dịch được chỉ định. Trình thông dịch sau đó sẽ chịu trách nhiệm tải và thực thi chương trình. Chúng ta sẽ thảo luận thêm một chút về trình thông dịch ELF trong Chương 41 và cung cấp một số tài liệu tham khảo cho thông tin chi tiết hơn trong chương đó.

### Chương trình ví dụ

[Listing 27-1](#page-53-0) minh họa việc sử dụng `execve()`. Chương trình này tạo ra một danh sách tham số (argument list) và một môi trường (environment) cho một chương trình mới, sau đó gọi `execve()`, sử dụng tham số dòng lệnh của chính nó (`argv[1]`) làm đường dẫn (pathname) để thực thi.

[Listing 27-2](#page-53-1) hiển thị một chương trình được thiết kế để thực thi bởi chương trình trong [Listing 27-1](#page-53-0). Chương trình này đơn giản là hiển thị các tham số dòng lệnh và danh sách môi trường của nó (danh sách sau được truy cập bằng cách sử dụng biến toàn cục `environ`, như được mô tả trong Mục 6.7).

Phiên làm việc trên shell sau đây minh họa việc sử dụng các chương trình trong [Listing 27-1](#page-53-0) và [Listing 27-2](#page-53-1) (trong ví dụ này, một đường dẫn tương đối (relative pathname) được sử dụng để chỉ định chương trình cần thực thi):

```
$ ./t_execve ./envargs
argv[0] = envargs All of the output is printed by envargs
argv[1] = hello world
argv[2] = goodbye
environ: GREET=salut
environ: BYE=adieu
```

**Liệt kê 27-1:** Sử dụng `execve()` để thực thi một chương trình mới

```c
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execve.c
## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
    char *argVec[10]; /* Lớn hơn mức cần thiết */
    char *envVec[] = { "GREET=salut", "BYE=adieu", NULL };

    if (argc != 2 || strcmp(argv[1], "--help") == 0)
        usageErr("%s pathname\n", argv[0]);

    argVec[0] = strrchr(argv[1], '/'); /* Lấy tên cơ sở (basename) từ argv[1] */
    if (argVec[0] != NULL)
        argVec[0]++;
    else
        argVec[0] = argv[1];

    argVec[1] = "hello world";
    argVec[2] = "goodbye";
    argVec[3] = NULL; /* Danh sách phải được kết thúc bằng NULL */

    execve(argv[1], argVec, envVec);
    errExit("execve"); /* Nếu đến được đây, đã có lỗi xảy ra */
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execve.c
```

**Liệt kê 27-2:** Hiển thị danh sách tham số và môi trường

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/envargs.c
## include "tlpi_hdr.h"

extern char **environ;
```

int
main(int argc, char *argv[])
{
int j;
char **ep;
for (j = 0; j < argc; j++)
printf("argv[%d] = %s\n", j, argv[j]);
for (ep = environ; *ep != NULL; ep++)
printf("environ: %s\n", *ep);
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/envargs.c

```

## 27.2 Các hàm Thư viện exec()

Các hàm thư viện được mô tả trong phần này cung cấp các API thay thế để thực hiện một lệnh exec(). Tất cả các hàm này được xây dựng dựa trên (layered on top of) `execve()`, và chúng chỉ khác nhau cũng như khác với `execve()` ở cách thức chỉ định tên chương trình, danh sách tham số (argument list) và môi trường (environment) của chương trình mới.

```c

## include <unistd.h>

int execle(const char *pathname, const char *arg, ...
/* , (char *) NULL, char *const envp[] */ );
int execlp(const char *filename, const char *arg, ...
/* , (char *) NULL */);
int execvp(const char *filename, char *const argv[]);
int execv(const char *pathname, char *const argv[]);
int execl(const char *pathname, const char *arg, ...
/* , (char *) NULL */);
/* Không hàm nào trong số trên trả về khi thành công; tất cả đều trả về –1 khi lỗi */

```

Các ký tự cuối cùng trong tên của các hàm này cung cấp manh mối về sự khác biệt giữa chúng. Những khác biệt này được tóm tắt trong [Bảng 27-1](#page-55-0) và được trình bày chi tiết trong danh sách sau đây:

- Hầu hết các hàm `exec()` yêu cầu một đường dẫn (`pathname`) để chỉ định chương trình mới cần tải. Tuy nhiên, `execlp()` và `execvp()` cho phép chỉ định chương trình chỉ bằng một tên tệp (`filename`). Tên tệp này được tìm kiếm trong danh sách các thư mục được chỉ định bởi biến môi trường `PATH` (được giải thích chi tiết hơn bên dưới). Đây là kiểu tìm kiếm mà shell thực hiện khi được cung cấp một tên lệnh. Để biểu thị sự khác biệt trong hoạt động này, tên của các hàm này chứa ký tự `p` (viết tắt của `PATH`). Biến `PATH` không được sử dụng nếu tên tệp chứa dấu gạch chéo (`/`), trong trường hợp đó nó được coi là đường dẫn tuyệt đối hoặc tương đối.
- Thay vì sử dụng một mảng để chỉ định danh sách `argv` cho chương trình mới, `execle()`, `execlp()`, và `execl()` yêu cầu lập trình viên chỉ định các tham số dưới dạng một danh sách các chuỗi ký tự bên trong lời gọi hàm. Tham số đầu tiên trong số này tương ứng với `argv[0]` trong hàm `main` của chương trình mới, và do đó thường giống với tham số tên tệp (`filename`) hoặc thành phần tên cơ sở (basename) của tham số đường dẫn (`pathname`). Một con trỏ `NULL` phải kết thúc danh sách tham số, để các lời gọi này có thể xác định được điểm cuối của danh sách. (Yêu cầu này được chỉ ra bằng chú thích `(char *) NULL` trong các nguyên mẫu (prototype) ở trên; để thảo luận về lý do tại sao cần phải ép kiểu trước `NULL`, xem Phụ lục C). Tên của các hàm này chứa ký tự `l` (viết tắt của list - danh sách) để phân biệt chúng với các hàm yêu cầu danh sách tham số dưới dạng một mảng được kết thúc bằng `NULL`. Tên của các hàm yêu cầu danh sách tham số dưới dạng một mảng (`execve()`, `execvp()`, và `execv()`) chứa ký tự `v` (viết tắt của vector).

Các hàm `execve()` và `execle()` cho phép lập trình viên chỉ định rõ ràng môi trường cho chương trình mới bằng cách sử dụng `envp`, một mảng con trỏ trỏ đến các chuỗi ký tự được kết thúc bằng `NULL`. Tên của các hàm này kết thúc bằng ký tự `e` (viết tắt của environment - môi trường) để biểu thị thực tế này. Tất cả các hàm `exec()` khác sử dụng môi trường hiện có của tiến trình gọi (caller's existing environment) (nghĩa là nội dung của `environ`) làm môi trường cho chương trình mới.

> Phiên bản 2.11 của glibc đã bổ sung một hàm phi chuẩn là `execvpe(file, argv, envp)`. Hàm này giống với `execvp()`, nhưng thay vì lấy môi trường cho chương trình mới từ `environ`, bên gọi sẽ chỉ định môi trường mới thông qua tham số `envp` (giống như `execve()` và `execle()`).

Trong vài trang tiếp theo, chúng tôi sẽ minh họa việc sử dụng một số biến thể `exec()` này.

| Hàm | Chỉ định<br>tệp chương trình<br>(–, p) | Chỉ định<br>các tham số<br>(v, l) | Nguồn của<br>môi trường<br>(e, –) |
|----------|--------------------------------------------|-----------------------------------------|------------------------------------|
| execve() | đường dẫn (pathname)                       | mảng (array)                            | tham số envp                       |
| execle() | đường dẫn (pathname)                       | danh sách (list)                        | tham số envp                       |
| execlp() | tên tệp (filename) + PATH                  | danh sách (list)                        | environ của bên gọi                |
| execvp() | tên tệp (filename) + PATH                  | mảng (array)                            | environ của bên gọi                |
| execv()  | đường dẫn (pathname)                       | mảng (array)                            | environ của bên gọi                |
| execl()  | đường dẫn (pathname)                       | danh sách (list)                        | environ của bên gọi                |

**Bảng 27-1:** Tóm tắt sự khác biệt giữa các hàm exec()

### 27.2.1 Biến môi trường PATH

Các hàm `execvp()` và `execlp()` cho phép chúng ta chỉ định tên của tệp cần thực thi. Các hàm này tận dụng biến môi trường PATH để tìm kiếm tệp. Giá trị của PATH là một chuỗi bao gồm các tên thư mục ngăn cách nhau bởi dấu hai chấm (colon-separated), được gọi là các tiền tố đường dẫn (path prefixes). Ví dụ, giá trị PATH sau đây chỉ định năm thư mục:

### \$ **echo \$PATH**

/home/mtk/bin:/usr/local/bin:/usr/bin:/bin:.

Giá trị PATH cho một shell đăng nhập (login shell) được thiết lập bởi các tập lệnh khởi động shell (shell startup scripts) ở cấp độ hệ thống và cấp độ người dùng cụ thể. Vì một tiến trình con (child process) kế thừa một bản sao các biến môi trường của tiến trình cha (parent process), nên mỗi tiến trình do shell tạo ra để thực thi một lệnh sẽ kế thừa một bản sao PATH của shell đó.

Các đường dẫn thư mục được chỉ định trong PATH có thể là tuyệt đối (bắt đầu bằng dấu `/` ở đầu) hoặc tương đối. Đường dẫn tương đối được diễn giải dựa trên thư mục làm việc hiện tại (current working directory) của tiến trình gọi. Thư mục làm việc hiện tại có thể được chỉ định bằng dấu `.` (dấu chấm), như trong ví dụ trên.

> Cũng có thể chỉ định thư mục làm việc hiện tại bằng cách đưa một tiền tố có độ dài bằng không vào PATH, thông qua việc sử dụng các dấu hai chấm liên tiếp, dấu hai chấm ở đầu hoặc dấu hai chấm ở cuối (ví dụ: `/usr/bin:/bin:`). Tiêu chuẩn SUSv3 tuyên bố kỹ thuật này đã lỗi thời (obsolete); thư mục làm việc hiện tại nên được chỉ định một cáchrõ ràng bằng dấu `.` (dấu chấm).

Nếu biến PATH không được xác định, thì `execvp()` và `execlp()` sẽ mặc định sử dụng danh sách đường dẫn `.:/usr/bin:/bin`.

Như một biện pháp bảo mật, tài khoản siêu người dùng (superuser - `root`) thông thường được thiết lập sao cho thư mục làm việc hiện tại bị loại khỏi PATH. Điều này ngăn chặn `root` vô tình thực thi một tệp từ thư mục làm việc hiện tại (có thể đã được một kẻ xấu chủ ý đặt ở đó) trùng tên với một lệnh chuẩn hoặc có tên bị viết sai chính tả của một lệnh thông thường (ví dụ: `sl` thay vì `ls`). Trong một số bản phân phối Linux (Linux distributions), giá trị mặc định cho PATH cũng loại trừ thư mục làm việc hiện tại đối với người dùng không có đặc quyền (unprivileged users). Chúng ta giả định định nghĩa PATH như vậy trong tất cả các bản ghi phiên shell (shell session logs) được hiển thị trong cuốn sách này, đó là lý do tại sao chúng ta luôn thêm tiền tố `./` vào tên của các chương trình được thực thi từ thư mục làm việc hiện tại. (Điều này cũng mang lại một tác dụng phụ hữu ích là giúp phân biệt trực quan các chương trình của chúng ta với các lệnh chuẩn trong các bản ghi phiên shell được hiển thị trong cuốn sách này).

Các hàm `execvp()` và `execlp()` tìm kiếm tên tệp trong từng thư mục được liệt kê trong PATH, bắt đầu từ đầu danh sách và tiếp tục cho đến khi một tệp có tên cho trước được `exec` thành công. Việc sử dụng biến môi trường PATH theo cách này rất hữu ích nếu chúng ta không biết vị trí tại thời điểm chạy (run-time location) của một tệp thực thi hoặc không muốn tạo một sự phụ thuộc cứng nhắc (hard-coded dependency) vào vị trí đó.

Việc sử dụng `execvp()` và `execlp()` trong các chương trình set-user-ID hoặc set-group-ID nên được tránh, hoặc ít nhất phải được tiếp cận với sự thận trọng cực độ. Cụ thể, biến môi trường PATH phải được kiểm soát cẩn thận để ngăn chặn việc thực thi một chương trình độc hại. Trong thực tế, điều này có nghĩa là ứng dụng nên ghi đè bất kỳ giá trị PATH nào được định nghĩa trước đó bằng một danh sách thư mục được biết là an toàn.

[Liệt kê 27-3](#page-57-0) cung cấp một ví dụ về việc sử dụng `execlp()`. Bản ghi phiên shell sau đây minh họa việc sử dụng chương trình này để gọi lệnh `echo` (`/bin/echo`):

```

$ which echo
/bin/echo
$ ls -l /bin/echo
-rwxr-xr-x 1 root 15428 Mar 19 21:28 /bin/echo
$ echo $PATH                                  Hiển thị nội dung biến môi trường PATH
/home/mtk/bin:/usr/local/bin:/usr/bin:/bin    /bin nằm trong PATH
$ ./t_execlp echo                             execlp() dùng PATH tìm thành công lệnh echo
hello world

```

Chuỗi `hello world` xuất hiện ở trên được cung cấp làm đối số thứ ba của lệnh gọi `execlp()` trong chương trình tại [Liệt kê 27-3](#page-57-0).

Chúng ta tiếp tục bằng cách định nghĩa lại PATH để loại bỏ `/bin`, thư mục chứa chương trình `echo`:

```

$ PATH=/home/mtk/bin:/usr/local/bin:/usr/bin
$ ./t_execlp echo
ERROR [ENOENT No such file or directory] execlp
$ ./t_execlp /bin/echo
hello world

```

Như có thể thấy, khi chúng ta cung cấp tên tệp (tức là một chuỗi không chứa dấu gạch chéo) cho `execlp()`, lời gọi hàm thất bại vì không tìm thấy tệp có tên `echo` trong bất kỳ thư mục nào thuộc danh sách PATH. Mặt khác, khi chúng ta cung cấp một đường dẫn chứa một hoặc nhiều dấu gạch chéo, `execlp()` sẽ bỏ qua nội dung của PATH.

**Liệt kê 27-3:** Sử dụng `execlp()` để thực thi một chương trình

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execlp.c

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
if (argc != 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s pathname\n", argv[0]);

execlp(argv[1], argv[1], "hello world", (char *) NULL);
errExit("execlp"); /* Nếu đến được đây, đã có lỗi xảy ra */
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execlp.c

```

### 27.2.2 Chỉ định các đối số của chương trình dưới dạng một danh sách

Khi chúng ta biết số lượng đối số cho một hàm `exec()` tại thời điểm viết chương trình, chúng ta có thể sử dụng `execle()`, `execlp()`, hoặc `execl()` để chỉ định các đối số dưới dạng một danh sách (list) ngay trong lời gọi hàm. Điều này rất thuận tiện, vì nó đòi hỏi ít mã nguồn (code) hơn so với việc gom các đối số thành một véc-tơ `argv` (argv vector). Chương trình trong [Liệt kê 27-4](#page-57-1) đạt được kết quả tương tự như chương trình trong [Liệt kê 27-1](#page-53-0) nhưng sử dụng `execle()` thay vì `execve()`.

**Liệt kê 27-4:** Sử dụng `execle()` để chỉ định các đối số của chương trình dưới dạng một danh sách

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execle.c

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
char *envVec[] = { "GREET=salut", "BYE=adieu", NULL };
char *filename;

if (argc != 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s pathname\n", argv[0]);

filename = strrchr(argv[1], '/'); /* Lấy basename từ argv[1] */
if (filename != NULL)
filename++;
else
filename = argv[1];

execle(argv[1], filename, "hello world", (char *) NULL, envVec);
errExit("execle"); /* Nếu đến được đây, đã có lỗi xảy ra */
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execle.c

```

### 27.2.3 Truyền môi trường của tiến trình gọi sang chương trình mới

Các hàm `execlp()`, `execvp()`, `execl()`, và `execv()` không cho phép lập trình viên chỉ định rõ ràng một danh sách môi trường (environment list); thay vào đó, chương trình mới sẽ kế thừa môi trường của nó từ tiến trình gọi (calling process) (Mục 6.7). Điều này có thể mong muốn hoặc không. Vì lý do bảo mật, đôi khi việc đảm bảo rằng một chương trình được thực thi (`execed`) với một danh sách môi trường đã biết trước sẽ tốt hơn. Chúng ta sẽ xem xét kỹ hơn điểm này trong Mục 38.8.

[Liệt kê 27-5](#page-58-0) minh họa rằng chương trình mới kế thừa môi trường của nó từ tiến trình gọi trong một lời gọi `execl()`. Chương trình này trước tiên sử dụng `putenv()` để thay đổi môi trường mà nó kế thừa từ shell do kết quả của hàm `fork()`. Sau đó, chương trình `printenv` được thực thi để hiển thị giá trị của các biến môi trường `USER` và `SHELL`. Khi chạy chương trình này, chúng ta thu được kết quả sau:

```

$ echo $USER $SHELL Display some of the shell's environment variables
blv /bin/bash
$ ./t_execl
Initial value of USER: blv Copy of environment was inherited from the shell
britta These two lines are displayed by execed printenv
/bin/bash

```

**Liệt kê 27-5:** Truyền môi trường của tiến trình gọi sang chương trình mới sử dụng `execl()`

```c

––––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execl.c

## include <stdlib.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
printf("Initial value of USER: %s\n", getenv("USER"));
if (putenv("USER=britta") != 0)
errExit("putenv");
execl("/usr/bin/printenv", "printenv", "USER", "SHELL", (char *) NULL);
errExit("execl"); /* Nếu đến được đây, đã có lỗi xảy ra */
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_execl.c

```

### 27.2.4 Thực thi một File được tham chiếu bởi một Descriptor: fexecve()

Kể từ phiên bản 2.3.2, glibc cung cấp hàm `fexecve()`, hoạt động giống hệt như `execve()`, nhưng chỉ định file cần thực thi (`execed`) thông qua một file descriptor (mô tả file) `fd` đã được mở, thay vì sử dụng đường dẫn (pathname). Việc sử dụng `fexecve()` rất hữu ích cho các ứng dụng muốn mở một file, xác minh nội dung của nó bằng cách tính toán checksum (mã kiểm tra), và sau đó thực thi file đó.

```c

## define _GNU_SOURCE

## include <unistd.h>

int fexecve(int fd, char *const argv[], char *const envp[]);
/* Không trả về khi thành công; trả về –1 khi có lỗi */

```

Nếu không có `fexecve()`, chúng ta có thể gọi `open()` và đọc file để xác minh nội dung, sau đó thực thi nó (`exec`). Tuy nhiên, cách làm này tiềm ẩn rủi ro là trong khoảng thời gian giữa lúc mở file và thực thi file, file đó có thể bị thay thế (việc giữ một file descriptor đang mở không ngăn cản việc một file mới có cùng tên được tạo ra), dẫn đến việc nội dung được thực thi có thể khác với nội dung đã được kiểm tra.

## 27.3 Các Script Thông dịch (Interpreter Scripts)

Trình thông dịch (interpreter) là một chương trình đọc các lệnh dưới dạng văn bản và thực thi chúng. (Điều này trái ngược với trình biên dịch - compiler, vốn dịch mã nguồn đầu vào thành ngôn ngữ máy để sau đó có thể thực thi trên một máy thực hoặc máy ảo). Các ví dụ về trình thông dịch bao gồm các UNIX shell khác nhau và các chương trình như `awk`, `sed`, `perl`, `python`, và `ruby`. Ngoài khả năng đọc và thực thi các lệnh một cách tương tác (interactively), các trình thông dịch thường cung cấp tính năng đọc và thực thi các lệnh từ một file văn bản, được gọi là một script.

Kernel (nhân) UNIX cho phép các script thông dịch được chạy theo cách giống như một file chương trình nhị phân (binary program file), miễn là đáp ứng được hai yêu cầu. Thứ nhất, quyền thực thi (execute permission) phải được bật cho file script. Thứ hai, file phải chứa một dòng đầu tiên chỉ định đường dẫn của trình thông dịch sẽ được sử dụng để chạy script đó. Dòng này có dạng sau:

```

## ! interpreter-path [ optional-arg ]

```

Các ký tự `#!` phải được đặt ở đầu dòng; tùy chọn, có thể có một khoảng trắng phân tách các ký tự này với đường dẫn của trình thông dịch. Biến môi trường `PATH` không được sử dụng khi phân giải đường dẫn này, do đó thông thường phải chỉ định một đường dẫn tuyệt đối (absolute pathname). Đường dẫn tương đối (relative pathname) cũng có thể sử dụng, dù hiếm gặp; nó được diễn giải tương đối so với thư mục làm việc hiện tại của tiến trình khởi chạy trình thông dịch. Khoảng trắng phân tách đường dẫn trình thông dịch với một đối số tùy chọn (`optional-arg`), mục đích của nó sẽ được giải thích ngay sau đây. Đối số tùy chọn này không được chứa các ký tự khoảng trắng.

Ví dụ, các script shell UNIX thường bắt đầu bằng dòng sau, chỉ định shell được dùng để thực thi script:

```sh

## !/bin/sh

```

Đối số tùy chọn trong dòng đầu tiên của file script thông dịch không nên chứa khoảng trắng vì hành vi trong trường hợp này phụ thuộc rất nhiều vào từng hệ thống (implementation-dependent). Trên Linux, khoảng trắng trong `optional-arg` không được diễn giải đặc biệt — toàn bộ văn bản từ đầu đối số cho đến cuối dòng được diễn giải như một từ duy nhất (được truyền làm đối số cho script, như chúng tôi mô tả bên dưới). Lưu ý rằng cách xử lý khoảng trắng này trái ngược với shell, nơi khoảng trắng dùng để phân tách các từ của dòng lệnh.

Trong khi một số hệ thống UNIX xử lý khoảng trắng trong `optional-arg` giống như Linux, các hệ thống khác thì không. Trên FreeBSD trước phiên bản 6.0, nhiều đối số tùy chọn phân tách bằng khoảng trắng có thể theo sau `interpreter-path` (và chúng được truyền như các từ riêng biệt cho script); kể từ phiên bản 6.0, FreeBSD hoạt động giống như Linux. Trên Solaris 8, các ký tự khoảng trắng sẽ kết thúc `optional-arg`, và bất kỳ văn bản nào còn lại trong dòng `#!` sẽ bị bỏ qua.

Kernel Linux đặt giới hạn 127 ký tự cho độ dài của dòng `#!` trong một script (không tính ký tự xuống dòng ở cuối dòng). Các ký tự vượt quá giới hạn này sẽ âm thầm bị bỏ qua.

Kỹ thuật `#!` cho các script thông dịch không được quy định trong chuẩn SUSv3, nhưng có sẵn trên hầu hết các hệ thống UNIX.

Giới hạn đặt ra cho độ dài của dòng `#!` thay đổi tùy theo các hệ thống UNIX khác nhau. Ví dụ, giới hạn là 64 ký tự trong OpenBSD 3.1 và 1024 ký tự trên Tru64 5.1. Trên một số hệ thống cũ (ví dụ: SunOS 4), giới hạn này thậm chí chỉ có 32 ký tự.

### Thực thi các script thông dịch

Vì một script không chứa mã máy nhị phân (binary machine code), khi `execve()` được sử dụng để chạy script, rõ ràng sẽ có một cơ chế khác biệt so với thông thường diễn ra trong quá trình thực thi script. Nếu `execve()` phát hiện ra rằng file được cung cấp bắt đầu bằng chuỗi 2 byte `#!`, thì nó sẽ trích xuất phần còn lại của dòng (đường dẫn và đối số), và thực thi (`execs`) file trình thông dịch với danh sách các đối số sau:

```

interpreter-path [ optional-arg ] script-path arg...

```

Ở đây, `interpreter-path` và `optional-arg` được lấy từ dòng `#!` của script, `script-path` là đường dẫn được truyền cho `execve()`, và `arg...` là danh sách bất kỳ đối số bổ sung nào được chỉ định thông qua tham số `argv` của `execve()` (nhưng loại trừ `argv[0]`). Nguồn gốc của từng đối số trong script được tóm tắt trong [Hình 27-1](#page-60-0).

![](_page_60_Figure_5.jpeg)

**Hình 27-1:** Danh sách tham số được truyền cho một script được gọi thông qua exec (execed script)

Chúng ta có thể minh họa nguồn gốc của các đối số trình thông dịch bằng cách viết một script sử dụng chương trình trong Liệt kê 6-2 (`necho.c`, ở trang 123) làm trình thông dịch. Chương trình này đơn giản chỉ in lại (echo) tất cả các đối số dòng lệnh của nó. Sau đó, chúng ta sử dụng chương trình trong [Liệt kê 27-1](#page-53-0) để thực thi script đó:

```

$ cat > necho.script                          Tạo script

## !/home/mtk/bin/necho some argument

Some junk
Nhấn Control-D
$ chmod +x necho.script                       Cấp quyền thực thi cho script
$ ./t_execve necho.script                     Và thực thi script
argv[0] = /home/mtk/bin/necho                 3 đối số đầu tiên do kernel tạo ra
argv[1] = some argument                       Đối số của script được xử lý như một từ đơn
argv[2] = necho.script                        Đây là đường dẫn của script
argv[3] = hello world                         Đây là argVec[1] được truyền cho execve()
argv[4] = goodbye                             Và đây là argVec[2]

```

Trong ví dụ này, "trình thông dịch" của chúng ta (`necho`) bỏ qua nội dung của tệp script (`necho.script`), và dòng thứ hai của script (`Some junk`) không có ảnh hưởng gì đến quá trình thực thi của nó.

> Kernel Linux 2.2 chỉ truyền phần tên cơ sở (basename) của đường dẫn trình thông dịch làm tham số đầu tiên khi gọi một script. Do đó, trên Linux 2.2, dòng hiển thị `argv[0]` sẽ chỉ hiển thị giá trị `echo`.

Hầu hết các shell và trình thông dịch trên UNIX coi ký tự `#` là điểm bắt đầu của một chú thích (comment). Do đó, các trình thông dịch này bỏ qua dòng `#!` ban đầu khi thông dịch script.

### Sử dụng tham số tùy chọn của script (script optional-arg)

Một công dụng của tham số tùy chọn (optional-arg) trong dòng `#!` ban đầu của script là để chỉ định các tùy chọn dòng lệnh cho trình thông dịch. Tính năng này rất hữu ích với một số trình thông dịch nhất định, chẳng hạn như `awk`.

> Trình thông dịch `awk` đã là một phần của hệ thống UNIX kể từ cuối những năm 1970. Ngôn ngữ `awk` được mô tả trong một số cuốn sách, bao gồm cả cuốn sách do những người tạo ra nó viết [Aho et al., 1988], những người có tên viết tắt đã đặt tên cho ngôn ngữ này. Thế mạnh của nó là tạo mẫu nhanh (rapid prototyping) các ứng dụng xử lý văn bản. Về thiết kế — một ngôn ngữ có kiểu dữ liệu yếu (weakly typed), với tập hợp phong phú các hàm nguyên thủy xử lý văn bản (text-handling primitives), và cú pháp dựa trên C — `awk` là tiền thân của nhiều ngôn ngữ kịch bản đương đại được sử dụng rộng rãi, chẳng hạn như JavaScript và PHP.

Một script có thể được cung cấp cho `awk` theo hai cách khác nhau. Mặc định là cung cấp script như tham số dòng lệnh đầu tiên cho `awk`:

```

$ awk 'script' input-file...

```

Ngoài ra, một script `awk` có thể nằm bên trong một tệp, như trong script `awk` sau đây, in ra độ dài của dòng dài nhất trong đầu vào của nó:

```

$ cat longest_line.awk

## !/usr/bin/awk

length > max { max = length; }
END { print max; }

```

Giả sử chúng ta thử thực thi script này bằng cách sử dụng mã nguồn C sau:

```

execl("longest_line.awk", "longest_line.awk", "input.txt", (char *) NULL);

```

Lệnh gọi `execl()` này lần lượt sử dụng `execve()` với danh sách tham số sau để gọi `awk`:

```

/usr/bin/awk longest_line.awk input.txt

```

Lệnh gọi `execve()` này thất bại, bởi vì `awk` hiểu chuỗi `longest_line.awk` là một script chứa một lệnh `awk` không hợp lệ. Chúng ta cần một cách để thông báo cho `awk` rằng tham số này thực thực tế là tên của một tệp chứa script. Chúng ta có thể làm điều này bằng cách thêm tùy chọn `-f` làm tham số tùy chọn trong dòng `#!` của script. Điều này cho `awk` biết rằng tham số tiếp theo là một tệp script:

```

## !/usr/bin/awk -f

length > max { max = length; }
END { print max; }

```

Bây giờ, lệnh gọi `execl()` của chúng ta dẫn đến danh sách tham số sau được sử dụng:

```

/usr/bin/awk -f longest_line.awk input.txt

```

Thao tác này gọi `awk` thành công bằng cách sử dụng script `longest_line.awk` để xử lý tệp `input.txt`.

### Thực thi script bằng execlp() và execvp()

Thông thường, việc thiếu dòng `#!` ở đầu script sẽ làm cho các hàm `exec()` thất bại. Tuy nhiên, `execlp()` và `execvp()` hoạt động có phần khác biệt. Hãy nhớ lại rằng đây là các hàm sử dụng biến môi trường `PATH` để lấy danh sách các thư mục nhằm tìm kiếm một tệp cần thực thi. Nếu bất kỳ hàm nào trong số này tìm thấy một tệp đã bật quyền thực thi, nhưng không phải là một tệp thực thi nhị phân (binary executable) và không bắt đầu bằng dòng `#!`, thì chúng sẽ gọi shell để thông dịch tệp đó. Trên Linux, điều này có nghĩa là các tệp như vậy được xử lý giống như thể chúng bắt đầu bằng một dòng chứa chuỗi `#!/bin/sh`.

## 27.4 Bộ mô tả tệp (File Descriptors) và exec()

Theo mặc định, tất cả các bộ mô tả tệp (file descriptor) được mở bởi một chương trình gọi `exec()` vẫn sẽ mở xuyên suốt lệnh `exec()` đó và sẵn sàng cho chương trình mới sử dụng. Điều này thường rất hữu ích, bởi vì chương trình gọi có thể mở các tệp trên các bộ mô tả cụ thể, và các tệp này sẽ tự động khả dụng đối với chương trình mới mà không cần chương trình đó phải biết tên hoặc phải tự mở các tệp đó.

Shell tận dụng tính năng này để xử lý việc chuyển hướng I/O (I/O redirection) cho các chương trình mà nó thực thi. Ví dụ, giả sử chúng ta nhập lệnh shell sau:

### \$ **ls /tmp > dir.txt**

Shell thực hiện các bước sau để thực thi lệnh này:

- 1. Một lệnh `fork()` được thực hiện để tạo ra một tiến trình con (child process) cũng đang chạy một bản sao của shell (và do đó có một bản sao của câu lệnh).
- 2. Shell con mở tệp `dir.txt` để ghi đầu ra bằng cách sử dụng bộ mô tả tệp 1 (tiêu chuẩn đầu ra - standard output). Việc này có thể được thực hiện theo một trong các cách sau:
  - a) Shell con đóng bộ mô tả 1 (`STDOUT_FILENO`) và sau đó mở tệp `dir.txt`. Vì `open()` luôn sử dụng bộ mô tả tệp chưa được sử dụng thấp nhất, và đầu vào chuẩn (bộ mô tả 0) vẫn đang mở, tệp sẽ được mở trên bộ mô tả 1.
  - b) Shell mở tệp `dir.txt`, nhận về một bộ mô tả tệp mới. Sau đó, nếu bộ mô tả tệp đó không phải là đầu ra chuẩn, shell sẽ sử dụng `dup2()` để ép đầu ra chuẩn trở thành một bản sao của bộ mô tả mới đó và đóng bộ mô tả mới lại, vì nó không còn cần thiết nữa. (Phương pháp này an toàn hơn phương pháp trước đó, vì nó không phụ thuộc vào việc các bộ mô tả có số hiệu nhỏ hơn phải đang được mở). Đoạn mã sẽ có dạng như sau:

```

fd = open("dir.txt", O_WRONLY | O_CREAT,
S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH | S_IWOTH);
/* rw-rw-rw- */
if (fd != STDOUT_FILENO) {
dup2(fd, STDOUT_FILENO);
close(fd);
}

```

3. Shell con thực thi (`exec`) chương trình `ls`. Chương trình `ls` ghi đầu ra của nó vào đầu ra chuẩn, chính là tệp `dir.txt`.

> Giải thích được trình bày ở đây về cách shell thực hiện chuyển hướng I/O đã đơn giản hóa một số điểm. Cụ thể, một số lệnh — cái gọi là lệnh nội bộ của shell (shell built-in commands) — được thực thi trực tiếp bởi shell, mà không cần thực hiện `fork()` hay `exec()`. Các lệnh như vậy phải được xử lý có phần khác biệt cho mục đích chuyển hướng I/O.

> Một lệnh shell được hiện thực dưới dạng lệnh nội bộ vì một trong hai lý do: hiệu năng và để tạo ra các hiệu ứng phụ (side effects) bên trong shell. Một số lệnh được sử dụng thường xuyên — chẳng hạn như `pwd`, `echo`, và `test` — đủ đơn giản để việc hiện thực chúng ngay bên trong shell mang lại hiệu quả tối ưu về hiệu năng. Các lệnh khác được hiện thực bên trong shell để chúng có các hiệu ứng phụ lên chính shell đó, nghĩa là chúng thay đổi thông tin được lưu trữ bởi shell, hoặc sửa đổi các thuộc tính, hay ảnh hưởng đến quá trình thực thi của tiến trình shell. Ví dụ, lệnh `cd` phải thay đổi thư mục làm việc (working directory) của chính shell, do đó không thể được thực thi bên trong một tiến trình riêng biệt. Các ví dụ khác về lệnh được tích hợp sẵn vì hiệu ứng phụ của chúng bao gồm `exec`, `exit`, `read`, `set`, `source`, `ulimit`, `umask`, `wait`, và các lệnh điều khiển công việc của shell (jobs, fg, và bg). Toàn bộ tập hợp các lệnh nội bộ được hiểu bởi một shell được tài liệu hóa trong trang hướng dẫn sử dụng (manual page) của shell đó.

## Cờ close-on-exec (FD_CLOEXEC)

Thỉnh thoảng, chúng ta muốn đảm bảo rằng một số File Descriptor (mô tả tệp) nhất định được đóng lại trước khi thực thi hàm `exec()`. Đặc biệt, nếu chúng ta thực thi `exec()` đối với một chương trình không xác định (tức là chương trình mà chúng ta không tự viết) từ một tiến trình có đặc quyền (privileged process), hoặc một chương trình không cần các mô tả tệp đối với các tệp mà chúng ta đã mở trước đó, thì việc tuân thủ thực hành lập trình bảo mật (secure programming practice) yêu cầu phải đảm bảo rằng tất cả các mô tả tệp không cần thiết đều phải được đóng lại trước khi chương trình mới được nạp. Chúng ta có thể thực hiện việc này bằng cách gọi `close()` trên tất cả các mô tả đó, nhưng cách làm này gặp phải các hạn chế sau:

Mô tả tệp (file descriptor) có thể đã được mở bởi một hàm thư viện (library function). Hàm này không có cơ chế nào để ép chương trình chính đóng mô tả tệp trước khi `exec()` được thực thi. (Theo nguyên tắc chung, các hàm thư viện luôn phải thiết lập cờ close-on-exec, sử dụng kỹ thuật được mô tả bên dưới, cho bất kỳ tệp nào mà chúng chúng mở.)

Nếu lệnh gọi `exec()` thất bại vì lý do nào đó, chúng ta có thể muốn giữ cho các mô tả tệp tiếp tục mở. Nếu chúng đã bị đóng từ trước, việc mở lại chúng để chúng trỏ đến đúng các tệp ban đầu có thể sẽ rất khó khăn, hoặc thậm chí là bất khả thi.

Vì những lý do này, kernel cung cấp một cờ close-on-exec cho mỗi mô tả tệp. Nếu cờ này được thiết lập, thì mô tả tệp sẽ tự động bị đóng trong quá trình thực thi `exec()` thành công, nhưng sẽ được giữ mở nếu `exec()` thất bại. Cờ close-on-exec của một mô tả tệp có thể được truy cập thông qua System Call `fcntl()` (Phần 5.2). Thao tác `fcntl()` với `F_GETFD` sẽ lấy về một bản sao của các cờ mô tả tệp (file descriptor flags):

```

int flags;
flags = fcntl(fd, F_GETFD);
if (flags == -1)
errExit("fcntl");

```

Sau khi lấy về các cờ này, chúng ta có thể sửa đổi bit `FD_CLOEXEC` và sử dụng lệnh gọi `fcntl()` thứ hai chỉ định `F_SETFD` để cập nhật lại các cờ:

```

flags |= FD_CLOEXEC;
if (fcntl(fd, F_SETFD, flags) == -1)
errExit("fcntl");

```

`FD_CLOEXEC` thực chất là bit duy nhất được sử dụng trong các cờ mô tả tệp. Bit này tương ứng với giá trị 1. Trong các chương trình cũ, đôi khi chúng ta thấy cờ close-on-exec được thiết lập chỉ bằng lệnh gọi `fcntl(fd, F_SETFD, 1)`, dựa trên thực tế là không có bit nào khác bị ảnh hưởng bởi thao tác này. Về mặt lý thuyết, điều này không phải lúc nào cũng đúng (trong tương lai, một số hệ thống UNIX có thể triển khai thêm các bit cờ bổ họa), vì vậy chúng ta nên sử dụng kỹ thuật được trình bày trong phần chính.

Nhiều hệ triển khai UNIX, bao gồm cả Linux, cũng cho phép cờ close-on-exec được sửa đổi bằng cách sử dụng hai hàm `ioctl()` phi tiêu chuẩn: `ioctl(fd, FIOCLEX)` để thiết lập cờ close-on-exec cho `fd`, và `ioctl(fd, FIONCLEX)` để xóa cờ đó.

Khi `dup()`, `dup2()`, hoặc `fcntl()` được sử dụng để tạo một bản sao (duplicate) của một mô tả tệp, cờ close-on-exec sẽ luôn bị xóa đối với mô tả tệp nhân bản đó. (Hành vi này mang tính lịch sử và là một yêu cầu của SUSv3.)

[Liệt kê 27-6](#page-65-0) minh họa cách thao tác với cờ close-on-exec. Tùy thuộc vào sự xuất hiện của đối dòng lệnh (command-line argument - bất kỳ chuỗi nào), chương trình này trước tiên thiết lập cờ close-on-exec cho đầu ra chuẩn (standard output) và sau đó thực thi chương trình `ls`. Dưới đây là kết quả khi chúng ta chạy chương trình:

```

$ ./closeonexec Exec ls without closing standard output
-rwxr-xr-x 1 mtk users 28098 Jun 15 13:59 closeonexec
$ ./closeonexec n Sets close-on-exec flag for standard output
ls: write error: Bad file descriptor

```

Trong lần chạy thứ hai hiển thị ở trên, `ls` phát hiện ra rằng đầu ra chuẩn của nó đã bị đóng và in ra một thông báo lỗi trên đầu lỗi chuẩn (standard error).

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/closeonexec.c

## include <fcntl.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
int flags;
if (argc > 1) {
flags = fcntl(STDOUT_FILENO, F_GETFD); /* Lấy các cờ */
if (flags == -1)
errExit("fcntl - F_GETFD");
flags |= FD_CLOEXEC; /* Bật cờ FD_CLOEXEC */
if (fcntl(STDOUT_FILENO, F_SETFD, flags) == -1) /* Cập nhật cờ */
errExit("fcntl - F_SETFD");
}
execlp("ls", "ls", "-l", argv[0], (char *) NULL);
errExit("execlp");
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/closeonexec.c

```

## 27.5 Signals và exec()

Trong quá trình thực thi `exec()`, phần văn bản (text) của tiến trình hiện tại sẽ bị hủy bỏ. Phần văn bản này có thể bao gồm các trình xử lý tín hiệu (signal handlers) do chương trình gọi thiết lập. Vì các trình xử lý này biến mất, kernel sẽ thiết lập lại cơ chế xử lý (dispositions) của tất cả các tín hiệu có trình xử lý về giá trị mặc định `SIG_DFL`. Cơ chế xử lý của tất cả các tín hiệu khác (tức là những tín hiệu có cơ chế xử lý là `SIG_IGN` hoặc `SIG_DFL`) được giữ nguyên không đổi qua một lệnh `exec()`. Hành vi này là bắt buộc theo tiêu chuẩn SUSv3.

SUSv3 đưa ra một trường hợp đặc biệt đối với tín hiệu `SIGCHLD` bị bỏ qua (ignored). (Chúng ta đã lưu ý trong Phần [26.3.3](#page-46-0) rằng việc bỏ qua `SIGCHLD` giúp ngăn chặn việc tạo ra các tiến trình thây ma - zombies). SUSv3 không quy định rõ ràng việc một tín hiệu `SIGCHLD` bị bỏ qua có tiếp tục bị bỏ qua sau khi `exec()` hay cơ chế xử lý của nó có bị đặt lại thành `SIG_DFL` hay không. Linux thực hiện theo cách thứ nhất, nhưng một số hệ triển khai UNIX khác (ví dụ: Solaris) lại thực hiện theo cách thứ hai. Điều này ngụ ý rằng, trong các chương trình bỏ qua `SIGCHLD`, để đạt được khả năng tương thích cao nhất (maximum portability), chúng ta nên thực hiện lệnh gọi `signal(SIGCHLD, SIG_DFL)` trước khi gọi `exec()`, đồng thời đảm bảo rằng chúng ta không viết các chương trình phụ thuộc vào việc cơ chế xử lý ban đầu của `SIGCHLD` khác với `SIG_DFL`.

Việc hủy bỏ dữ liệu, heap (vùng nhớ heap) và stack (ngăn xếp) của chương trình cũ cũng đồng nghĩa với việc mọi ngăn xếp tín hiệu thay thế (alternate signal stack) được thiết lập bởi lệnh gọi `sigaltstack()` (Mục 21.3) sẽ bị mất. Vì ngăn xếp tín hiệu thay thế không được bảo lưu qua một lệnh `exec()`, bit `SA_ONSTACK` cũng bị xóa đối với tất cả các tín hiệu (signal).

Trong quá trình thực thi `exec()`, mặt nạ tín hiệu của tiến trình (process signal mask) và tập hợp các tín hiệu đang chờ xử lý (set of pending signals) đều được bảo lưu. Tính năng này cho phép chúng ta chặn (block) và xếp hàng (queue) các tín hiệu cho chương trình mới được `exec()`. Tuy nhiên, tiêu chuẩn SUSv3 lưu ý rằng nhiều ứng dụng hiện có lại lầm tưởng rằng chúng được khởi động với cơ chế xử lý (disposition) của một số tín hiệu nhất định được đặt thành `SIG_DFL` hoặc các tín hiệu này được bỏ chặn. (Cụ thể, các tiêu chuẩn C đưa ra một đặc tả về tín hiệu yếu hơn nhiều, không quy định việc chặn tín hiệu; do đó, các chương trình C được viết trên các hệ thống phi UNIX sẽ không biết cách bỏ chặn tín hiệu.) Vì lý do này, SUSv3 khuyến nghị rằng các tín hiệu không nên bị chặn hoặc bỏ qua qua một lệnh `exec()` của một chương trình tùy ý. Ở đây, "tùy ý" có nghĩa là một chương trình mà chúng ta không tự viết. Việc chặn hoặc bỏ qua tín hiệu là hoàn toàn có thể chấp nhận được khi thực thi `exec()` một chương trình do chính chúng ta viết hoặc một chương trình có hành vi đã biết liên quan đến tín hiệu.

## 27.6 Thực thi một Lệnh Shell: system()

Hàm `system()` cho phép chương trình gọi thực thi một lệnh shell tùy ý. Trong phần này, chúng ta sẽ mô tả hoạt động của `system()`, và ở phần tiếp theo, chúng ta sẽ minh họa cách `system()` có thể được hiện thực hóa bằng cách sử dụng các hàm `fork()`, `exec()`, `wait()`, và `exit()`.

> Trong Mục 44.5, chúng ta sẽ tìm hiểu về các hàm `popen()` và `pclose()`, cũng có thể được sử dụng để thực thi một lệnh shell, nhưng cho phép chương trình gọi đọc đầu ra của lệnh hoặc gửi đầu vào cho lệnh đó.

```

## include <stdlib.h>

int system(const char *command);
Xem phần văn bản chính để biết mô tả về giá trị trả về

```

Hàm `system()` tạo ra một tiến trình con (child process) gọi đến một shell để thực thi `command`. Dưới đây là một ví dụ về lệnh gọi `system()`:

```

system("ls | wc");

```

Những ưu điểm chính của `system()` là tính đơn giản và tiện lợi:

- Chúng ta không cần phải xử lý các chi tiết phức tạp khi gọi `fork()`, `exec()`, `wait()`, và `exit()`.
- Việc xử lý lỗi (error handling) và xử lý tín hiệu được thực hiện bởi `system()` thay cho chúng ta.
- Bởi vì `system()` sử dụng shell để thực thi `command`, tất cả các quá trình xử lý thông thường của shell, sự thay thế và chuyển hướng (redirection) đều được thực hiện trên `command` trước khi nó được chạy. Điều này giúp việc thêm tính năng "thực thi một lệnh shell" vào một ứng dụng trở nên rất dễ dàng. (Nhiều ứng dụng tương tác cung cấp tính năng này dưới dạng một lệnh `!`.)

Nhược điểm chính của `system()` là kém hiệu quả (inefficiency). Việc thực thi một lệnh sử dụng `system()` đòi hỏi phải tạo ra ít nhất hai tiến trình — một cho shell và một hoặc nhiều tiến trình cho (các) lệnh mà nó thực thi — mỗi tiến trình đều thực hiện một lệnh `exec()`. Nếu yêu cầu đặt ra là hiệu năng hoặc tốc độ, tốt hơn hết là nên sử dụng các lời gọi `fork()` và `exec()` tường minh để thực thi chương trình mong muốn.

Giá trị trả về của `system()` như sau:

- Nếu `command` là một con trỏ `NULL`, thì `system()` trả về một giá trị khác không nếu có sẵn shell, và trả về `0` nếu không có sẵn shell. Trường hợp này xuất phát từ các tiêu chuẩn ngôn ngữ lập trình C, vốn không gắn liền với bất kỳ hệ điều hành cụ thể nào, do đó shell có thể không có sẵn nếu `system()` đang chạy trên một hệ thống phi UNIX. Hơn nữa, mặc dù tất cả các bản cài đặt UNIX đều có shell, nhưng shell này có thể không khả dụng nếu chương trình gọi `chroot()` trước khi gọi `system()`. Nếu `command` khác `NULL`, giá trị trả về của `system()` được xác định dựa theo các quy tắc còn lại trong danh sách này.

- Nếu không thể tạo tiến trình con hoặc không thể lấy được trạng thái kết thúc (termination status) của nó, thì `system()` trả về `–1`.
- Nếu không thể thực thi `exec()` shell trong tiến trình con, thì `system()` trả về một giá trị giống như thể tiến trình con shell đã kết thúc bằng lệnh gọi `_exit(127)`.
- Nếu tất cả các system call (lệnh gọi hệ thống) thành công, thì `system()` trả về trạng thái kết thúc của tiến trình con shell được sử dụng để thực thi `command`. (Trạng thái kết thúc của một shell chính là trạng thái kết thúc của lệnh cuối cùng mà nó thực thi.)

Không thể (bằng cách sử dụng giá trị do `system()` trả về) phân biệt giữa trường hợp `system()` thực thi `exec()` shell thất bại với trường hợp shell thoát ra với mã trạng thái `127` (khả năng sau có thể xảy ra nếu shell không tìm thấy chương trình có tên được chỉ định để thực thi).

Trong hai trường hợp cuối cùng, giá trị do `system()` trả về là một trạng thái chờ (wait status) có cùng định dạng được trả về bởi `waitpid()`. Điều này có nghĩa là chúng ta nên sử dụng các hàm được mô tả trong Mục [26.1.3](#page-32-2) để phân tích giá trị này, và chúng ta có thể hiển thị giá trị đó bằng cách sử dụng hàm `printWaitStatus()` của mình ([Liệt kê 26-2](#page-33-1), ở trang [546\)](#page-33-1).

### Chương trình ví dụ

[Liệt kê 27-7](#page-68-0) minh họa cách sử dụng `system()`. Chương trình này thực hiện một vòng lặp đọc một chuỗi lệnh, thực thi nó bằng `system()`, sau đó phân tích và hiển thị giá trị do `system()` trả về. Dưới đây là một mẫu chạy thử:

```

$ ./t_system
Command: whoami
mtk
system() returned: status=0x0000 (0,0)
child exited, status=0
Command: ls | grep XYZ Shell terminates with the status of…
system() returned: status=0x0100 (1,0) its last command (grep), which…
child exited, status=1 found no match, and so did an exit(1)
Command: exit 127
system() returned: status=0x7f00 (127,0)
(Probably) could not invoke shell Actually, not true in this case
Command: sleep 100
Type Control-Z to suspend foreground process group
[1]+ Stopped ./t_system
$ ps | grep sleep Find PID of sleep
29361 pts/6 00:00:00 sleep
$ kill 29361 And send a signal to terminate it
$ fg Bring t_system back into foreground
./t_system
system() returned: status=0x000f (0,15)
child killed by signal 15 (Terminated)
Command: ^D$ Type Control-D to terminate program

```

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_system.c

## include <sys/wait.h>

## include "print_wait_status.h"

## include "tlpi_hdr.h"

## define MAX_CMD_LEN 200

int
main(int argc, char *argv[])
{
char str[MAX_CMD_LEN]; /* Command to be executed by system() */
int status; /* Status return from system() */
for (;;) { /* Read and execute a shell command */
printf("Command: ");
fflush(stdout);
if (fgets(str, MAX_CMD_LEN, stdin) == NULL)
break; /* end-of-file */
status = system(str);
printf("system() returned: status=0x%04x (%d,%d)\n",
(unsigned int) status, status >> 8, status & 0xff);
if (status == -1) {
errExit("system");
} else {
if (WIFEXITED(status) && WEXITSTATUS(status) == 127)
printf("(Probably) could not invoke shell\n");
else /* Shell successfully executed command */
printWaitStatus(NULL, status);
}
}
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_system.c

```

## Tránh sử dụng system() trong các chương trình set-user-ID và set-group-ID

Các chương trình set-user-ID và set-group-ID tuyệt đối không được sử dụng hàm `system()` khi đang hoạt động dưới định danh có đặc quyền (privileged identifier) của chương trình. Ngay cả khi các chương trình như vậy không cho phép người dùng chỉ định văn bản của lệnh cần thực thi, việc shell phụ thuộc vào các biến môi trường (environment variable) khác nhau để điều khiển hoạt động của nó đồng nghĩa với việc sử dụng `system()` chắc chắn sẽ mở ra lỗ hổng bảo mật hệ thống (system security breach).

Ví dụ, trong các phiên bản Bourne shell cũ, biến môi trường `IFS` (định nghĩa dấu phân cách trường nội bộ - internal field separator dùng để tách dòng lệnh thành các từ riêng biệt) là nguồn gốc của một số vụ xâm nhập hệ thống thành công. Nếu chúng ta định nghĩa `IFS` có giá trị là `a`, thì shell sẽ coi chuỗi lệnh `shar` là từ `sh` theo sau bởi đối số `r`, và gọi một shell khác để thực thi tệp tập lệnh (script file) có tên `r` trong thư mục làm việc hiện tại (current working directory), thay vì mục đích ban đầu (thực thi một lệnh có tên `shar`). Lỗ hổng bảo mật cụ thể này đã được khắc phục bằng cách chỉ áp dụng `IFS` cho các từ được tạo ra từ quá trình mở rộng của shell (shell expansions). Ngoài ra, các shell hiện đại sẽ thiết lập lại `IFS` (thành một chuỗi bao gồm ba ký tự khoảng trắng, tab và ký tự dòng mới) khi shell khởi động để đảm bảo rằng các tập lệnh hoạt động nhất quán nếu chúng kế thừa một giá trị `IFS` bất thường. Như một biện pháp bảo mật bổ sung, `bash` sẽ quay trở lại định danh người dùng (nhóm) thực thực tế — real user (group) ID — khi được gọi từ một chương trình set-user-ID (set-group-ID).

Các chương trình bảo mật cần tạo tiến trình con để chạy một chương trình khác nên sử dụng trực tiếp `fork()` kết hợp với một trong các hàm `exec()` — ngoại trừ `execlp()` hoặc `execvp()`.

## 27.7 Triển khai system()

Trong phần này, chúng ta sẽ giải thích cách triển khai hàm `system()`. Chúng ta bắt đầu với một bản triển khai đơn giản, giải thích những thành phần còn thiếu trong bản triển khai đó, và sau đó trình bày một bản triển khai hoàn chỉnh.

### Bản triển khai đơn giản của system()

Tùy chọn `-c` của lệnh `sh` cung cấp một cách dễ dàng để thực thi một chuỗi chứa các lệnh shell tùy ý:

```

$ sh -c "ls | wc"
38 38 444

```

Do đó, để triển khai `system()`, chúng ta cần sử dụng `fork()` để tạo một tiến trình con (child process), tiến trình này sau đó thực hiện `execl()` với các đối số tương ứng với lệnh `sh` ở trên:

```

execl("/bin/sh", "sh", "-c", command, (char *) NULL);

```

Để thu thập trạng thái (status) của tiến trình con do `system()` tạo ra, chúng ta sử dụng lời gọi `waitpid()` chỉ định ID tiến trình (Process ID - PID) của tiến trình con. (Sử dụng `wait()` là không đủ, bởi vì `wait()` chờ bất kỳ tiến trình con nào, điều này có thể vô tình thu thập trạng thái của một tiến trình con khác do tiến trình gọi tạo ra). Một bản triển khai `system()` đơn giản và chưa đầy đủ được thể hiện trong [Liệt kê 27-8.](#page-69-0)

**Liệt kê 27-8:** Một bản triển khai `system()` loại trừ việc xử lý tín hiệu (signal handling)

```

––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/simple_system.c

## include <unistd.h>

## include <sys/wait.h>

## include <sys/types.h>

int
system(char *command)
{
int status;
pid_t childPid;
switch (childPid = fork()) {
case -1: /* Error */
return -1;

```

```

case 0: /* Child */
execl("/bin/sh", "sh", "-c", command, (char *) NULL);
_exit(127); /* Failed exec */
default: /* Parent */
if (waitpid(childPid, &status, 0) == -1)
return -1;
else
return status;
}
}
––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/simple_system.c

```

### Xử lý tín hiệu chính xác bên trong system()

Yếu tố làm tăng độ phức tạp cho việc triển khai `system()` là việc xử lý tín hiệu (signal) một cách chính xác.

Tín hiệu đầu tiên cần xem xét là `SIGCHLD`. Giả sử rằng chương trình gọi `system()` cũng đang trực tiếp tạo ra các tiến trình con, và đã thiết lập một trình xử lý tín hiệu (signal handler) cho `SIGCHLD` thực hiện thao tác `wait()` của riêng nó. Trong tình huống này, khi một tín hiệu `SIGCHLD` được tạo ra bởi sự kết thúc của tiến trình con do `system()` tạo ra, có khả năng trình xử lý tín hiệu của chương trình chính sẽ được gọi — và thu thập trạng thái của tiến trình con — trước khi `system()` có cơ hội gọi `waitpid()`. (Đây là một ví dụ về tình trạng tranh chấp - race condition). Điều này dẫn đến hai hậu quả không mong muốn:

- Chương trình gọi sẽ bị lầm tưởng rằng một trong các tiến trình con do chính nó tạo ra đã kết thúc.
- Hàm `system()` sẽ không thể lấy được trạng thái kết thúc của tiến trình con do chính nó tạo ra.

Do đó, `system()` phải chặn (block) việc phân phối tín hiệu `SIGCHLD` trong khi nó đang thực thi.

Các tín hiệu khác cần xem xét là những tín hiệu được tạo ra bởi các ký tự ngắt thiết bị đầu cuối (thường là Control-C) và thoát (thường là Control-\), lần lượt là `SIGINT` và `SIGQUIT`. Hãy xem xét điều gì xảy ra khi chúng ta thực thi lời gọi sau:

```

system("sleep 20");

```

Tại thời điểm này, có ba tiến trình đang chạy: tiến trình thực thi chương trình gọi, một shell, và `sleep`, như được thể hiện trong [Hình 27-2](#page-71-0).

> Như một biện pháp tối ưu hóa hiệu suất, khi chuỗi được truyền cho tùy chọn `-c` là một lệnh đơn giản (trái ngược với một đường ống - pipeline hoặc một chuỗi lệnh), một số shell (bao gồm cả `bash`) sẽ trực tiếp thực thi lệnh (exec) thay vì phân nhánh một shell con (fork a child shell). Đối với các shell thực hiện việc tối ưu hóa như vậy, [Hình 27-2](#page-71-0) không hoàn toàn chính xác, vì sẽ chỉ có hai tiến trình (tiến trình gọi và `sleep`). Tuy nhiên, các lập luận trong phần này về cách `system()` nên xử lý các tín hiệu vẫn được áp dụng.

Tất cả các tiến trình được hiển thị trong [Hình 27-2](#page-71-0) đều tạo thành một phần của nhóm tiến trình nền trước (foreground process group) cho thiết bị đầu cuối (terminal). (Chúng ta xem xét chi tiết về các nhóm tiến trình trong Mục 34.2). Do đó, khi chúng ta gõ các ký tự ngắt hoặc thoát, cả ba tiến trình đều được gửi tín hiệu tương ứng. Shell bỏ qua `SIGINT` và `SIGQUIT` trong khi chờ tiến trình con của nó. Tuy nhiên, theo mặc định, cả chương trình gọi và tiến trình `sleep` đều sẽ bị tiêu diệt (killed) bởi các tín hiệu này.

Tiến trình gọi và lệnh được thực thi phải phản ứng như thế nào với các tín hiệu này? SUSv3 quy định những điểm sau:

- `SIGINT` và `SIGQUIT` nên bị bỏ qua trong tiến trình gọi trong khi lệnh đang được thực thi.
- Trong tiến trình con, `SIGINT` và `SIGQUIT` nên được xử lý giống như thể tiến trình gọi thực hiện `fork()` và `exec()`; nghĩa là, khuynh hướng xử lý tín hiệu (signal disposition) được thiết lập lại về mặc định, và khuynh hướng xử lý của các tín hiệu khác vẫn giữ nguyên.

## fork(), exec() fork(), exec() **Foreground process group** Child shell created by system() Child process created by shell (executes command given to system()) calling process Caller of system() sh sleep

**Hình 27-2:** Sơ đồ bố trí các tiến trình (process) trong quá trình thực thi `system("sleep 20")`

Việc xử lý các tín hiệu (signal) theo cách thức được chỉ định bởi SUSv3 là phương pháp hợp lý nhất, vì những lý do sau:

- Sẽ không có ý nghĩa gì nếu cả hai tiến trình cùng phản hồi lại các tín hiệu này, vì điều này có thể dẫn đến các hành vi gây nhầm lẫn cho người dùng ứng dụng.
- Tương tự, sẽ không hợp lý nếu bỏ qua (ignore) các tín hiệu này trong tiến trình thực thi câu lệnh trong khi vẫn xử lý chúng theo cơ chế mặc định (default disposition) của chúng trong tiến trình gọi (`calling process`). Điều này sẽ cho phép người dùng thực hiện những việc như tiêu diệt (`kill`) tiến trình gọi trong khi câu lệnh được thực thi vẫn tiếp tục chạy. Nó cũng mâu thuẫn với thực tế là tiến trình gọi thực chất đã từ bỏ quyền kiểm soát (nghĩa là đang bị chặn trong lệnh gọi `waitpid()`) trong khi câu lệnh được truyền cho `system()` đang được thực thi.
- Câu lệnh do `system()` thực thi có thể là một ứng dụng tương tác (interactive application), và việc để ứng dụng này phản hồi lại các tín hiệu do terminal tạo ra là điều hợp lý.

SUSv3 yêu cầu cách xử lý SIGINT và SIGQUIT như mô tả ở trên, nhưng lưu ý rằng điều này có thể gây ra hiệu ứng không mong muốn trong một chương trình sử dụng ẩn `system()` để thực hiện một tác vụ nào đó. Trong khi câu lệnh đang được thực thi, việc gõ Control-C hoặc Control-\ sẽ chỉ tiêu diệt tiến trình con (child process) của `system()`, trong khi ứng dụng (một cách bất ngờ đối với người dùng) vẫn tiếp tục chạy. Chương trình sử dụng `system()` theo cách này nên kiểm tra trạng thái kết thúc (termination status) do `system()` trả về, và thực hiện hành động thích hợp nếu phát hiện thấy câu lệnh đã bị tiêu diệt bởi một tín hiệu.

### Một bản cài đặt system() cải tiến

[Liệt kê 27-9](#page-73-0) cho thấy một bản cài đặt `system()` tuân thủ các quy tắc được mô tả ở trên. Hãy lưu ý các điểm sau về bản cài đặt này:

- Như đã lưu ý trước đó, nếu `command` là một con trỏ NULL (NULL pointer), thì `system()` phải trả về một giá trị khác 0 nếu có sẵn shell hoặc 0 nếu không có shell nào khả dụng. Cách duy nhất để xác định thông tin này một cách đáng tin cậy là thử thực thi một shell. Chúng ta thực hiện việc này bằng cách gọi đệ quy `system()` để thực thi câu lệnh shell `:` và kiểm tra trạng thái trả về bằng 0 từ lần gọi đệ quy q. Câu lệnh `:` là một câu lệnh tích hợp sẵn của shell (shell built-in command) không làm gì cả, nhưng luôn trả về trạng thái thành công. Chúng ta có thể thực thi câu lệnh shell `exit 0` để đạt được kết quả tương tự. (Lưu ý rằng việc sử dụng `access()` để kiểm tra xem tệp `/bin/sh` có tồn tại và được cấp quyền thực thi hay không là chưa đủ. Trong môi trường `chroot()`, ngay cả khi tệp thực thi của shell có mặt, nó có thể không thực thi được nếu nó được liên kết động (dynamically linked) và các thư viện chia sẻ (shared libraries) bắt buộc không có sẵn.)
- Chỉ trong tiến trình cha (tiến trình gọi `system()`) thì SIGCHLD mới cần phải được chặn w, và SIGINT cùng SIGQUIT cần phải bị bỏ qua e. Tuy nhiên, chúng ta phải thực hiện các thao tác này trước lệnh gọi `fork()`, bởi vì nếu chúng được thực hiện ở tiến trình cha sau `fork()`, chúng ta sẽ tạo ra một điều kiện tranh chấp (race condition). (Giả sử, ví dụ, tiến trình con thoát trước khi tiến trình cha có cơ hội chặn SIGCHLD.) Do đó, tiến trình con phải hoàn tác các thay đổi đối với thuộc tính tín hiệu này, như sẽ được mô tả ngay sau đây.
- Trong tiến trình cha, chúng ta bỏ qua các lỗi từ các lệnh gọi `sigaction()` và `sigprocmask()` được sử dụng để thao tác với cơ chế xử lý tín hiệu (signal dispositions) và mặt nạ tín hiệu (signal mask) w e o. Chúng ta làm điều này vì hai lý do. Đầu tiên, các lệnh gọi này rất khó có khả năng thất bại. Trong thực tế, điều duy nhất có thể xảy ra sai sót một cách thực tế với các lệnh gọi này là lỗi trong việc chỉ định các đối số của chúng, và lỗi như vậy phải được loại bỏ trong quá trình gỡ lỗi ban đầu. Thứ hai, chúng ta giả định rằng người gọi quan tâm nhiều hơn đến việc biết liệu `fork()` hoặc `waitpid()` có thất bại hay không hơn là biết liệu các lệnh gọi thao tác tín hiệu này có thất bại hay không. Vì những lý do tương tự, chúng ta kẹp các lệnh gọi thao tác tín hiệu được sử dụng ở cuối `system()` bằng mã để lưu i và khôi phục `errno` a, sao cho nếu `fork()` hoặc `waitpid()` thất bại, người gọi có thể xác định nguyên nhân. Nếu chúng ta trả về –1 do các lệnh gọi thao tác tín hiệu này thất bại, người gọi có thể nhầm tưởng rằng `system()` không thực thi được `command`.

SUSv3 chỉ đơn thuần nói rằng `system()` nên trả về –1 nếu không thể tạo tiến trình con hoặc không thể lấy được trạng thái của nó. Không có đề cập nào đến việc trả về –1 do các lỗi trong các thao tác thao tác tín hiệu bởi `system()`.

Việc kiểm tra lỗi không được thực hiện đối với các system call liên quan đến tín hiệu trong tiến trình con r t. Một mặt, không có cách nào để báo cáo một lỗi như vậy (việc sử dụng `_exit(127)` được dành riêng để báo cáo lỗi khi thực thi hàm exec shell); mặt khác, những thất bại như vậy không ảnh hưởng đến người gọi `system()`, vốn là một tiến trình riêng biệt.

Khi trả về từ `fork()` trong tiến trình con, cơ chế xử lý của SIGINT và SIGQUIT là `SIG_IGN` (tức là cơ chế được kế thừa từ tiến trình cha). Tuy nhiên, như đã lưu ý trước đó, trong tiến trình con, các tín hiệu này nên được đối xử như thể người gọi `system()` đã thực hiện một `fork()` và một `exec()`. Lệnh `fork()` giữ nguyên việc xử lý tín hiệu trong tiến trình con. Lệnh `exec()` thiết lập lại cơ chế xử lý của các tín hiệu được xử lý về mặc định của chúng và giữ nguyên cơ chế xử lý của các tín hiệu khác (Mục [27.5\)](#page-65-1). Do đó, nếu cơ chế xử lý của SIGINT và SIGQUIT trong tiến trình gọi khác với `SIG_IGN`, thì tiến trình con sẽ thiết lập lại cơ chế xử lý thành `SIG_DFL` r.

> Một số cài đặt của hàm `system()` thay vào đó đặt lại trạng thái xử lý (disposition) của `SIGINT` và `SIGQUIT` về như cũ ở tiến trình gọi (caller), dựa vào thực tế là lời gọi `execl()` tiếp theo sẽ tự động đặt lại trạng thái xử lý của các tín hiệu bị bắt (handled signal) về mặc định của chúng. Tuy nhiên, điều này có thể dẫn đến hành vi tiềm ẩn không mong muốn nếu tiến trình gọi đang xử lý một trong hai tín hiệu này. Trong trường hợp này, nếu một tín hiệu được gửi đến tiến trình con (child) trong khoảng thời gian rất ngắn trước khi gọi `execl()`, thì trình xử lý tín hiệu (handler) sẽ được gọi trong tiến trình con, sau khi tín hiệu được bỏ chặn (unblocked) bởi `sigprocmask()`.

- Nếu lời gọi `execl()` trong tiến trình con thất bại, thì chúng ta sử dụng `_exit()` để chấm dứt tiến trình y, thay vì `exit()`, nhằm ngăn chặn việc xả (flush) bất kỳ dữ liệu chưa được ghi nào trong bản sao bộ đệm stdio của tiến trình con.
- Trong tiến trình cha (parent), chúng ta phải sử dụng `waitpid()` để chờ cụ thể tiến trình con mà chúng ta đã tạo u. Nếu chúng ta sử dụng `wait()`, thì chúng ta có thể vô tình lấy trạng thái của một tiến trình con nào đó khác được tạo bởi chương trình gọi.
- Mặc dù việc cài đặt `system()` không yêu cầu sử dụng trình xử lý tín hiệu, nhưng chương trình gọi có thể đã thiết lập các trình xử lý tín hiệu và một trong số chúng có thể làm gián đoạn lời gọi bị chặn tới `waitpid()`. Tiêu chuẩn SUSv3 yêu cầu rõ ràng rằng tiến trình chờ phải được khởi động lại trong trường hợp này. Do đó, chúng ta sử dụng một vòng lặp để khởi động lại `waitpid()` nếu nó thất bại với lỗi `EINTR` u; bất kỳ lỗi nào khác từ `waitpid()` đều làm vòng lặp này chấm dứt.

**Liệt kê 27-9:** Cài đặt hàm `system()`

–––––––––––––––––––––––––––––––––––––––––––––––––––––––– **procexec/system.c** #include <unistd.h> #include <signal.h> #include <sys/wait.h> #include <sys/types.h> #include <errno.h> int system(const char \*command) { sigset\_t blockMask, origMask; struct sigaction saIgnore, saOrigQuit, saOrigInt, saDefault; pid\_t childPid; int status, savedErrno; q if (command == NULL) /\* Có sẵn shell không? \*/ return system(":") == 0;

```

sigemptyset(&blockMask); /* Chặn SIGCHLD */
sigaddset(&blockMask, SIGCHLD);
w sigprocmask(SIG_BLOCK, &blockMask, &origMask);
saIgnore.sa_handler = SIG_IGN; /* Bỏ qua SIGINT và SIGQUIT */
saIgnore.sa_flags = 0;
sigemptyset(&saIgnore.sa_mask);
e sigaction(SIGINT, &saIgnore, &saOrigInt);
sigaction(SIGQUIT, &saIgnore, &saOrigQuit);
switch (childPid = fork()) {
case -1: /* fork() thất bại */
status = -1;
break; /* Tiếp tục để đặt lại thuộc tính tín hiệu */
case 0: /* Tiến trình con: thực thi lệnh */
saDefault.sa_handler = SIG_DFL;
saDefault.sa_flags = 0;
sigemptyset(&saDefault.sa_mask);
r if (saOrigInt.sa_handler != SIG_IGN)
sigaction(SIGINT, &saDefault, NULL);
if (saOrigQuit.sa_handler != SIG_IGN)
sigaction(SIGQUIT, &saDefault, NULL);
t sigprocmask(SIG_SETMASK, &origMask, NULL);
execl("/bin/sh", "sh", "-c", command, (char *) NULL);
y _exit(127); /* Không thể thực thi shell */
default: /* Tiến trình cha: chờ tiến trình con kết thúc */
u while (waitpid(childPid, &status, 0) == -1) {
if (errno != EINTR) { /* Lỗi khác EINTR */
status = -1;
break; /* Thoát khỏi vòng lặp */
}
}
break;
}
/* Bỏ chặn SIGCHLD, khôi phục trạng thái xử lý của SIGINT và SIGQUIT */
i savedErrno = errno; /* Các lệnh sau có thể thay đổi 'errno' */
o sigprocmask(SIG_SETMASK, &origMask, NULL);
sigaction(SIGINT, &saOrigInt, NULL);
sigaction(SIGQUIT, &saOrigQuit, NULL);
a errno = savedErrno;
return status;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/system.c

```

### Chi tiết bổ sung về system()

Các ứng dụng khả chuyển (portable application) nên đảm bảo rằng `system()` không được gọi khi trạng thái xử lý của `SIGCHLD` được đặt thành `SIG_IGN`, bởi vì trong trường hợp này, lời gọi `waitpid()` không thể lấy được trạng thái của tiến trình con. (Việc bỏ qua `SIGCHLD` khiến trạng thái của tiến trình con bị hủy bỏ ngay lập tức, như được mô tả trong Mục [26.3.3](#page-46-0).)

Trên một số hệ thống UNIX, `system()` xử lý trường hợp nó được gọi khi trạng thái xử lý của `SIGCHLD` được đặt thành `SIG_IGN` bằng cách tạm thời đặt trạng thái xử lý của `SIGCHLD` thành `SIG_DFL`. Điều này khả thi, miễn là cài đặt UNIX đó thuộc nhóm (khác với Linux) thu hồi (reap) các tiến trình con thây ma (zombie child) hiện có khi trạng thái xử lý của `SIGCHLD` được đặt lại thành `SIG_IGN`. (Nếu hệ thống không làm điều này, thì việc cài đặt `system()` theo cách này sẽ mang lại hậu quả tiêu cực là nếu một tiến trình con khác được tạo bởi tiến trình gọi kết thúc trong khi `system()` đang thực thi, nó sẽ trở thành một tiến trình thây ma không bao giờ được thu hồi.)

Trên một số hệ thống UNIX (đặc biệt là Solaris), `/bin/sh` không phải là một shell chuẩn POSIX. Nếu chúng ta muốn đảm bảo rằng chúng ta thực thi một shell chuẩn, thì chúng ta phải sử dụng hàm thư viện `confstr()` để lấy giá trị của biến cấu hình `_CS_PATH`. Giá trị này là một danh sách các thư mục theo định dạng PATH chứa các tiện ích hệ thống chuẩn. Chúng ta có thể gán danh sách này cho biến môi trường `PATH`, và sau đó sử dụng `execlp()` để thực thi shell chuẩn như sau:

```c

char path[PATH_MAX];
if (confstr(_CS_PATH, path, PATH_MAX) == 0)
_exit(127);
if (setenv("PATH", path, 1) == -1)
_exit(127);
execlp("sh", "sh", "-c", command, (char *) NULL);
_exit(127);

```

## 27.8 Tổng kết

Bằng cách sử dụng `execve()`, một tiến trình (process) có thể thay thế chương trình mà nó đang chạy bằng một chương trình mới. Các đối số (argument) truyền vào lời gọi `execve()` cho phép chỉ định danh sách đối số (`argv`) và danh sách biến môi trường (environment list) cho chương trình mới. Nhiều hàm thư viện có tên tương tự được xây dựng chồng lên trên `execve()` và cung cấp các giao diện khác nhau cho cùng một chức năng.

Tất cả các hàm `exec()` có thể được sử dụng để tải một tệp thực thi nhị phân (binary executable file) hoặc để thực thi một tập lệnh thông dịch (interpreter script). Khi một tiến trình thực thi (`execs`) một tập lệnh, chương trình thông dịch của tập lệnh đó sẽ thay thế chương trình hiện đang được thực thi bởi tiến trình. Trình thông dịch của tập lệnh thường được xác định bởi dòng đầu tiên (bắt đầu bằng các ký tự `#!`) trong tập lệnh, trong đó chỉ định đường dẫn (pathname) của trình thông dịch. Nếu không có dòng nào như vậy, thì tập lệnh chỉ có thể thực thi thông qua `execlp()` hoặc `execvp()`, và các hàm này sẽ thực thi shell làm trình thông dịch tập lệnh.

Chúng ta đã minh họa cách `fork()`, `exec()`, `exit()`, và `wait()` có thể được kết hợp để hiện thực hóa hàm `system()`, có thể được dùng để thực thi một lệnh shell tùy ý.

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê trong Mục [24.6](#page-16-0).

## 27.9 Bài tập

**27-1.** Lệnh cuối cùng trong phiên shell sau sử dụng chương trình trong [Liệt kê 27-3](#page-57-0) để thực thi (`exec`) chương trình `xyz`. Điều gì sẽ xảy ra?

```

$ echo $PATH
/usr/local/bin:/usr/bin:/bin:./dir1:./dir2
$ ls -l dir1
total 8
-rw-r--r-- 1 mtk users 7860 Jun 13 11:55 xyz
$ ls -l dir2
total 28
-rwxr-xr-x 1 mtk users 27452 Jun 13 11:55 xyz
$ ./t_execlp xyz

```

- **27-2.** Sử dụng `execve()` để hiện thực hóa `execlp()`. Bạn sẽ cần sử dụng API `stdarg(3)` để xử lý danh sách đối số có độ dài biến đổi (variable-length argument list) được truyền vào `execlp()`. Bạn cũng sẽ cần sử dụng các hàm trong gói `malloc` để cấp phát không gian cho các véc-tơ đối số (argument vector) và biến môi trường (environment vector). Cuối cùng, lưu ý rằng một cách dễ dàng để kiểm tra xem một tệp có tồn tại trong một thư mục cụ thể và có thể thực thi hay không là đơn giản thử thực thi (`execing`) tệp đó.
- **27-3.** Đầu ra nào sẽ xuất hiện nếu chúng ta làm cho tập lệnh sau có thể thực thi và gọi `exec()` lên nó?

```

## !/bin/cat -n

Hello world

```

**27-4.** Tác dụng của đoạn mã sau là gì? Trong những trường hợp nào nó có thể hữu ích?

```

childPid = fork();
if (childPid == -1)
errExit("fork1");
if (childPid == 0) { /* Tiến trình con (Child) */
switch (fork()) {
case -1: errExit("fork2");
case 0: /* Tiến trình cháu (Grandchild) */
/* ----- Thực hiện công việc thực tế ở đây ----- */
exit(EXIT_SUCCESS); /* Sau khi hoàn thành công việc thực tế */
default:
exit(EXIT_SUCCESS); /* Biến tiến trình cháu thành trẻ mồ côi (orphan) */
}
}
/* Tiến trình cha rơi xuống đây */
if (waitpid(childPid, &status, 0) == -1)
errExit("waitpid");
/* Tiến trình cha tiếp tục làm các việc khác */

```

**27-5.** Khi chúng ta chạy chương trình sau, chúng ta thấy nó không tạo ra đầu ra nào. Tại sao lại như vậy?

```

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
printf("Hello world");
execlp("sleep", "sleep", "0", (char *) NULL);
}

```

**27-6.** Giả sử rằng một tiến trình cha đã thiết lập một trình xử lý (handler) cho tín hiệu `SIGCHLD` và cũng chặn (block) tín hiệu này. Sau đó, một trong các tiến trình con của nó thoát (exits), và tiến trình cha thực hiện `wait()` để thu thập trạng thái của tiến trình con đó. Điều gì xảy ra khi tiến trình cha bỏ chặn (unblock) `SIGCHLD`? Viết một chương trình để kiểm chứng câu trả lời của bạn. Kết quả này có ý nghĩa như thế nào đối với một chương trình gọi hàm `system()`?

```
