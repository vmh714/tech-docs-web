# Chương 3: Khái niệm lập trình hệ thống (System Programming Concepts)

Chương này bao gồm nhiều chủ đề khác nhau làm tiền đề cho lập trình hệ thống (system programming). Chúng ta bắt đầu bằng việc giới thiệu các lời gọi hệ thống (system call) và trình bày chi tiết các bước diễn ra trong quá trình thực thi của chúng. Sau đó, chúng ta xem xét các hàm thư viện (library function) và sự khác biệt của chúng so với system call, kết hợp với phần mô tả về thư viện C của (GNU) C library.

Bất cứ khi nào chúng ta thực hiện một system call hoặc gọi một hàm thư viện, chúng ta phải luôn kiểm tra trạng thái trả về của lời gọi đó để xác định xem nó có thành công hay không. Chúng tôi mô tả cách thực hiện các bước kiểm tra như vậy, đồng thời trình bày một tập hợp các hàm được sử dụng trong hầu hết các chương trình ví dụ của cuốn sách này để chẩn đoán lỗi từ system call và hàm thư viện.

Chúng ta kết thúc chương bằng cách xem xét các vấn đề khác nhau liên quan đến lập trình khả chuyển (portable programming), cụ thể là việc sử dụng các macro kiểm tra tính năng (feature test macros) và các kiểu dữ liệu hệ thống chuẩn được định nghĩa bởi SUSv3.

## 3.1 Lời gọi hệ thống (System Calls)

System call là một điểm truy cập được kiểm soát (controlled entry point) vào kernel (kernel space), cho phép một tiến trình (process) yêu cầu kernel thực hiện một hành động nào đó thay mặt cho tiến trình. Kernel cung cấp một loạt các dịch vụ cho các chương trình thông qua giao diện lập trình ứng dụng (application programming interface - API) của system call. Các dịch vụ này bao gồm, ví dụ: tạo một process mới, thực hiện I/O và tạo một ống (pipe) để giao tiếp giữa các tiến trình (interprocess communication). (Trang sổ tay `syscalls(2)` liệt kê các system call của Linux).

Trước khi đi vào chi tiết về cách thức hoạt động của một system call, chúng ta lưu ý một số điểm chung:

- Một system call làm thay đổi trạng thái bộ vi xử lý từ chế độ người dùng (user mode) sang chế độ nhân (kernel mode), để CPU có thể truy cập vào vùng nhớ kernel được bảo vệ.
- Tập hợp các system call là cố định. Mỗi system call được định danh bằng một số duy nhất. (Sơ đồ đánh số này thông thường không hiển thị với các chương trình, các chương trình định danh system call bằng tên).
- Mỗi system call có thể có một tập hợp các đối số (argument) chỉ định thông tin cần truyền từ vùng nhớ người dùng (user space) (tức là không gian địa chỉ ảo của tiến trình) sang vùng nhớ nhân (kernel space) và ngược lại.

Từ góc độ lập trình, việc gọi một system call trông rất giống với việc gọi một hàm C. Tuy nhiên, đằng sau hậu trường, rất nhiều bước xảy ra trong quá trình thực thi của một system call. Để minh họa điều này, chúng ta xem xét các bước theo thứ tự diễn ra trên một cài đặt phần cứng cụ thể, x86-32. Các bước diễn ra như sau:

- 1. Chương trình ứng dụng thực hiện một system call bằng cách gọi một hàm bọc (wrapper function) trong thư viện C.
- 2. Hàm bọc phải cung cấp tất cả các đối số của system call cho routine xử lý bẫy (trap-handling routine) của system call (sẽ được mô tả ngay sau đây). Các đối số này được truyền cho hàm bọc thông qua ngăn xếp (stack), nhưng kernel mong đợi chúng nằm trong các thanh ghi (register) cụ thể. Hàm bọc sẽ sao chép các đối số vào các thanh ghi này.
- 3. Vì tất cả các system call đều đi vào kernel theo cùng một cách, kernel cần một phương pháp nào đó để nhận diện system call. Để cho phép điều này, hàm bọc sao chép số hiệu system call (system call number) vào một thanh ghi CPU cụ thể (`%eax`).
- 4. Hàm bọc thực thi một lệnh máy bẫy (trap machine instruction) (`int 0x80`), khiến bộ vi xử lý chuyển từ user mode sang kernel mode và thực thi mã lệnh được trỏ tới bởi vị trí `0x80` (128 hệ thập phân) trong bảng véc-tơ bẫy (trap vector) của hệ thống.

Các kiến trúc x86-32 hiện đại hơn thực hiện lệnh `sysenter`, cung cấp một phương pháp chuyển vào kernel mode nhanh hơn so với lệnh bẫy `int 0x80` thông thường. Việc sử dụng `sysenter` được hỗ trợ từ kernel 2.6 và từ glibc 2.3.2 trở đi.

- 5. Để phản hồi lại lệnh bẫy tại vị trí `0x80`, kernel gọi routine `system_call()` của nó (nằm trong tệp hợp ngữ `arch/i386/entry.S`) để xử lý bẫy. Trình xử lý này thực hiện các công việc sau:
  - a) Lưu các giá trị thanh ghi vào ngăn xếp kernel (kernel stack) (Mục 6.5).
  - b) Kiểm tra tính hợp lệ của số hiệu system call.
  - c) Gọi routine dịch vụ system call tương thích, được tìm thấy bằng cách sử dụng số hiệu system call để tra cứu trong bảng tất cả các routine dịch vụ system call (biến kernel `sys_call_table`). Nếu routine dịch vụ system call có bất kỳ đối số nào, trước tiên nó sẽ kiểm tra tính hợp lệ của chúng; ví dụ, nó kiểm tra xem các địa chỉ có trỏ đến các vị trí hợp lệ trong bộ nhớ người dùng hay không. Sau đó, routine dịch vụ

sẽ thực hiện tác vụ được yêu cầu, có thể bao gồm việc sửa đổi các giá trị tại các địa chỉ được chỉ định trong các đối số đã cho và truyền dữ liệu giữa bộ nhớ người dùng và bộ nhớ kernel (ví dụ: trong các thao tác I/O). Cuối cùng, routine dịch vụ trả về một trạng thái kết quả cho routine `system_call()`.

- d) Khôi phục các giá trị thanh ghi từ kernel stack và đặt giá trị trả về của system call lên stack.
- e) Trở về hàm bọc, đồng thời đưa bộ vi xử lý trở lại user mode.
- 6. Nếu giá trị trả về của routine dịch vụ system call cho biết có lỗi xảy ra, hàm bọc sẽ thiết lập biến toàn cục `errno` (xem Mục [3.4](#page-27-0)) bằng giá trị này. Sau đó, hàm bọc trả về cho hàm gọi, cung cấp một giá trị trả về dạng số nguyên cho biết system call thành công hay thất bại.

Trên Linux, các routine dịch vụ system call (system call service routine) tuân theo quy ước trả về một giá trị không âm để chỉ báo thành công. Trong trường hợp xảy ra lỗi, routine trả về một số âm, đây là giá trị phủ định (negated value) của một trong các hằng số `errno`. Khi một giá trị âm được trả về, hàm wrapper của thư viện C (C library wrapper function) sẽ phủ định lại giá trị đó (để làm cho nó trở thành số dương), sao chép kết quả vào `errno`, và trả về –1 làm kết quả hàm của wrapper để báo hiệu lỗi cho chương trình gọi (calling program).

Quy ước này dựa trên giả định rằng các system call service routine không trả về giá trị âm khi thành công. Tuy nhiên, đối với một số ít các routine này, giả định đó không đúng. Thông thường, đây không phải là vấn đề, vì dải giá trị `errno` bị phủ định không chồng lấn lên các giá trị trả về âm hợp lệ. Dù vậy, quy ước này gây ra vấn đề trong một trường hợp: thao tác `F_GETOWN` của system call `fcntl()`, mà chúng ta sẽ mô tả ở Mục 63.3.

[Hình 3-1](#page-25-0) minh họa chuỗi sự kiện trên bằng cách sử dụng ví dụ về system call `execve()`. Trên Linux/x86-32, `execve()` là system call số 11 (`__NR_execve`). Do đó, trong bảng vectơ `sys_call_table`, mục thứ 11 chứa địa chỉ của `sys_execve()`, service routine cho system call này. (Trên Linux, các system call service routine thường có tên theo định dạng `sys_xyz()`, trong đó `xyz()` là system call đang được xét đến.)

Thông tin được trình bày trong các đoạn trước nhiều hơn mức chúng ta thường cần biết cho phần còn lại của cuốn sách này. Tuy nhiên, nó minh họa một điểm quan trọng rằng, ngay cả đối với một system call đơn giản, vẫn phải thực hiện một lượng công việc đáng kể, và do đó system call có chi phí chi trả (overhead) nhỏ nhưng đáng kể.

> [!NOTE]
> Như một ví dụ về chi phí overhead của việc thực hiện một system call, hãy xem xét system call `getppid()`, vốn chỉ đơn giản trả về Process ID (PID) của tiến trình cha của tiến trình đang gọi. Trên một trong các hệ thống x86-32 của tác giả chạy Linux 2.6.25, 10 triệu lần gọi `getppid()` mất khoảng 2,2 giây để hoàn thành. Con số này tương đương với khoảng 0,3 micro giây cho mỗi lần gọi. Để so sánh, trên cùng hệ thống đó, 10 triệu lần gọi đến một hàm C chỉ đơn giản trả về một số nguyên chỉ mất 0,11 giây, hoặc khoảng một phần hai mươi thời gian so với các lệnh gọi `getppid()`. Tất nhiên, hầu hết các system call đều có overhead lớn hơn đáng kể so với `getppid()`.

Vì từ quan điểm của một chương trình C, việc gọi hàm wrapper của thư viện C là đồng nghĩa với việc gọi system call service routine tương ứng, nên trong phần còn lại của cuốn sách này, chúng tôi sử dụng cách diễn đạt như "gọi system call xyz()" để mang ý nghĩa là "gọi hàm wrapper thực hiện gọi system call xyz()".

```
+--------------------------- USER MODE -----------------------------------+
|      Application program              glibc wrapper function            |
|                                       (sysdeps/unix/sysv/linux/         |
|                                       syscalls/execve.c)                |                                
|    +----------------------+        +----------------------------------+ |
|    |                      |        |                                  | |
|    |                      |        |                                  | |
|    |   ...                |        |                                  | |
|    |   execve(path,------------------> execve(path, argv, envp)       | |
|    |          argv, envp);|        |   {   ...                        | |
|    |   ... <------------------|    |       int 0x80        ------>----------------|           
|    |                      |   |    |       (__NR_execve,              | |         |Switch to kernel mode
|    |                      |   |    |        path, argv, envp)  ... <--------------|------|
|    |                      |   |------------return                     | |         |      |
|    |                      |        |   }                              | |         |      |
|    +----------------------+        +----------------------------------+ |         |      |
|_________________________________________________________________________|         |      |
                                                                                    |      |
+--------------------------- KERNEL MODE ---------------------------------+         |      |
|   System call service routine                Trap handler               |         |      |
|   (arch/x86/kernel/process_32.c)      (arch/x86/kernel/entry_32.S)      |         |      |Switch to user mode
|                                                                         |         |      |                 
|    +----------------------+        +----------------------------------+ |         |      |
|    |                      |        |   system_call:  <-----------------------------      |
|    |                      |        |   ...                            | |                |
|    |                      |        |                                  | |                |
|    |   sys_execve() <------------------call sys_call_table            | |                |
|    |   {                  |        |            [__NR_execve]         | |                |
|    |   ...                |        |                                  | |                |
|    |   return error; ----------------> ...                            | |                |
|    |   }                  |        |                                  | |                |
|    |                      |        |                                  | |                |
|    |                      |        |              ----->---------------------------------|
|    +----------------------+        +----------------------------------+ |
|_________________________________________________________________________|   
```

**Hình 3-1:** Các bước trong quá trình thực thi một System Call

Phụ lục A mô tả lệnh `strace`, có thể được sử dụng để theo dõi các system call được thực hiện bởi một chương trình, phục vụ cho mục đích gỡ lỗi (debugging) hoặc đơn giản là để tìm hiểu xem một chương trình đang làm gì.

Bạn có thể tìm thêm thông tin về cơ chế system call của Linux trong [Love, 2010], [Bovet & Cesati, 2005], và [Maxwell, 1999].

## 3.2 Library Functions

Một hàm thư viện (library function) đơn giản là một trong vô số các hàm tạo nên thư viện chuẩn C (Standard C Library). (Để ngắn gọn, khi đề cập đến một hàm cụ thể trong phần còn lại của cuốn sách, chúng ta sẽ thường viết tắt là function thay vì library function.) Mục đích của các hàm này rất đa dạng, bao gồm các tác vụ như mở một tệp (file), chuyển đổi thời gian sang định dạng con người có thể đọc được, và so sánh hai chuỗi ký tự (character string).

Nhiều hàm thư viện không sử dụng bất kỳ system call nào (ví dụ: các hàm thao tác chuỗi). Ngược lại, một số hàm thư viện được xây dựng trồng lên trên các system call. Ví dụ, hàm thư viện `fopen()` sử dụng system call `open()` để thực sự mở một tệp. Thông thường, các hàm thư viện được thiết kế để cung cấp một giao diện thân thiện với người gọi (caller-friendly) hơn so với system call bên dưới. Ví dụ, hàm `printf()` cung cấp tính năng định dạng đầu ra (output formatting) và đệm dữ liệu (data buffering), trong khi system call `write()` chỉ xuất ra một khối byte. Tương tự, các hàm `malloc()` và `free()` thực hiện các tác vụ sổ sách (bookkeeping) khác nhau giúp chúng trở thành một cách dễ dàng hơn nhiều để cấp phát và giải phóng bộ nhớ so với system call `brk()` bên dưới.

## 3.3 Thư viện chuẩn C; Thư viện GNU C (glibc)

Có các bản cài đặt (implementation) khác nhau của thư viện chuẩn C trên các hệ thống UNIX khác nhau. Bản cài đặt được sử dụng phổ biến nhất trên Linux là thư viện GNU C (glibc, http://www.gnu.org/software/libc/).

> [!NOTE]
> Nhà phát triển chính và người bảo trì thư viện GNU C ban đầu là Roland McGrath. Ngày nay, nhiệm vụ này do Ulrich Drepper đảm nhận.

> [!NOTE]
> Nhiều thư viện C khác nhau cũng có sẵn cho Linux, bao gồm các thư viện có yêu cầu bộ nhớ nhỏ hơn để sử dụng trong các ứng dụng thiết bị nhúng (embedded device). Các ví dụ bao gồm uClibc (http://www.uclibc.org/) và diet libc (http://www.fefe.de/dietlibc/). Trong cuốn sách này, chúng ta giới hạn thảo luận ở glibc, vì đó là thư viện C được sử dụng bởi hầu hết các ứng dụng phát triển trên Linux.

## Xác định phiên bản glibc trên hệ thống

Đôi khi, chúng ta cần xác định phiên bản glibc trên một hệ thống. Từ shell, chúng ta có thể làm điều này bằng cách chạy tệp thư viện chia sẻ (shared library) glibc như thể nó là một chương trình có thể thực thi (executable program). Khi chúng ta chạy thư viện như một tệp thực thi, nó sẽ hiển thị các văn bản khác nhau, bao gồm cả số phiên bản của nó:

```
$ /lib/libc.so.6
GNU C Library stable release version 2.10.1, by Roland McGrath et al.
Copyright (C) 2009 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.
There is NO warranty; not even for MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.
Compiled by GNU CC version 4.4.0 20090506 (Red Hat 4.4.0-4).
Compiled on a Linux >>2.6.18-128.4.1.el5<< system on 2009-08-19.
Available extensions:
 The C stubs add-on version 2.1.2.
 crypt add-on version 2.1 by Michael Glad and others
 GNU Libidn by Simon Josefsson
 Native POSIX Threads Library by Ulrich Drepper et al
 BIND-8.2.3-T5B
 RT using linux kernel aio
For bug reporting instructions, please see:
<http://www.gnu.org/software/libc/bugs.html>.
```

Trong một số bản phân phối (distribution) Linux, thư viện GNU C nằm ở một đường dẫn (pathname) khác với `/lib/libc.so.6`. Một cách để xác định vị trí của thư viện là chạy chương trình `ldd` (liệt kê các phụ thuộc động - list dynamic dependencies) đối với một tệp thực thi được liên kết động (dynamically linked) với glibc (hầu hết các tệp thực thi đều được liên kết theo cách này). Sau đó, chúng ta có thể kiểm tra danh sách phụ thuộc thư viện kết quả để tìm vị trí của thư viện chia sẻ glibc:

```
$ ldd myprog | grep libc
 libc.so.6 => /lib/tls/libc.so.6 (0x4004b000)
```

Có hai cách để một chương trình ứng dụng có thể xác định phiên bản của thư viện GNU C có trên hệ thống: bằng cách kiểm tra các hằng số (constant) hoặc bằng cách gọi một hàm thư viện. Từ phiên bản 2.0 trở đi, glibc định nghĩa hai hằng số, `__GLIBC__` và `__GLIBC_MINOR__`, có thể được kiểm tra tại thời điểm biên dịch (compile time) (trong các câu lệnh `#ifdef`). Trên một hệ thống được cài đặt glibc 2.12, các hằng số này sẽ có giá trị lần lượt là 2 và 12. Tuy nhiên, các hằng số này có ít công dụng trong một chương trình được biên dịch trên hệ thống này nhưng lại chạy trên một hệ thống khác có phiên bản glibc khác. Để xử lý trường hợp này, chương trình có thể gọi hàm `gnu_get_libc_version()` để xác định phiên bản glibc có sẵn tại thời điểm chạy (run time).

```c
## include <gnu/libc-version.h>
const char *gnu_get_libc_version(void);
                   Trả về con trỏ tới chuỗi được cấp phát tĩnh, kết thúc bằng ký tự null
                                      chứa số phiên bản thư viện GNU C
```

Hàm `gnu_get_libc_version()` trả về một con trỏ tới một chuỗi, chẳng hạn như `2.12`.

Chúng ta cũng có thể lấy thông tin phiên bản bằng cách sử dụng hàm `confstr()` để truy xuất giá trị của biến cấu hình `_CS_GNU_LIBC_VERSION` (đặc trưng của glibc). Lời gọi này trả về một chuỗi chẳng hạn như `glibc 2.12`.

## 3.4 Xử lý lỗi từ các System Call (System Call) và Thư viện

Hầu như mọi System Call và hàm thư viện đều trả về một số dạng giá trị trạng thái cho biết lời gọi đó thành công hay thất bại. Giá trị trạng thái này phải luôn được kiểm tra để xem lời gọi có thành công hay không. Nếu không, cần có hành động xử lý thích hợp—ít nhất là chương trình phải hiển thị thông báo lỗi cảnh báo rằng có điều gì đó bất ngờ đã xảy ra.

Mặc dù việc bỏ qua các bước kiểm tra này rất cám dỗ để tiết kiệm thời gian gõ phím (đặc biệt là sau khi thấy các ví dụ về chương trình UNIX và Linux mà giá trị trạng thái không được kiểm tra), nhưng đây là một sự tiết kiệm sai lầm. Nhiều giờ gỡ lỗi (debugging) có thể bị lãng phí chỉ vì không kiểm tra giá trị trả về của một System Call hoặc hàm thư viện "chắc chắn không thể thất bại".

> [!NOTE]
> Một vài System Call không bao giờ thất bại. Ví dụ, `getpid()` luôn trả về thành công ID của một Process (tiến trình), và `_exit()` luôn chấm dứt một Process. Không cần thiết phải kiểm tra giá trị trả về từ các System Call như vậy.

### Xử lý lỗi System Call

Trang hướng dẫn (manual page) cho mỗi System Call tài liệu hóa các giá trị trả về có thể có của lời gọi đó, cho biết giá trị nào thể hiện lỗi. Thông thường, lỗi được biểu thị bằng giá trị trả về là `–1`. Do đó, một System Call có thể được kiểm tra bằng mã nguồn như sau:

```
fd = open(pathname, flags, mode); /* system call to open a file */
if (fd == -1) {
 /* Code to handle the error */
}
...
```

```
if (close(fd) == -1) {
 /* Code to handle the error */
}
```

Khi một System Call thất bại, nó thiết lập biến số nguyên toàn cục `errno` thành một giá trị dương xác định lỗi cụ thể đó. Việc bao gồm tệp tiêu đề `<errno.h>` cung cấp khai báo cho `errno`, cũng như tập hợp các hằng số cho các mã lỗi khác nhau. Tất cả các tên mang tính biểu tượng này đều bắt đầu bằng chữ `E`. Phần có tiêu đề `ERRORS` trong mỗi trang manual cung cấp danh sách các giá trị `errno` có thể được trả về bởi từng System Call. Dưới đây là một ví dụ đơn giản về việc sử dụng `errno` để chẩn đoán lỗi System Call:

```
cnt = read(fd, buf, numbytes);
if (cnt == -1) {
 if (errno == EINTR)
 fprintf(stderr, "read was interrupted by a signal\n");
 else {
 /* Some other error occurred */
 }
}
```

Các System Call và hàm thư viện thành công không bao giờ đặt lại `errno` về `0`, do đó biến này có thể mang giá trị khác không do hậu quả từ lỗi của một lời gọi trước đó. Hơn nữa, chuẩn SUSv3 cho phép một lời gọi hàm thành công thiết lập `errno` thành một giá trị khác không (mặc dù rất ít hàm làm điều này). Do đó, khi kiểm tra lỗi, chúng ta nên luôn kiểm tra trước xem giá trị trả về của hàm có biểu thị lỗi hay không, và chỉ sau đó mới kiểm tra `errno` để xác định nguyên nhân gây ra lỗi.

Một vài System Call (ví dụ: `getpriority()`) có thể trả về hợp lệ giá trị `–1` khi thành công. Để xác định xem có lỗi xảy ra trong các lời gọi như vậy hay không, chúng ta đặt `errno` về `0` trước khi gọi, và sau đó kiểm tra lại sau khi gọi. Nếu lời gọi trả về `–1` và `errno` khác không, thì đã xảy ra lỗi. (Tương tự cũng áp dụng cho một số ít hàm thư viện).

Một cách xử lý phổ biến sau khi một System Call thất bại là in ra thông báo lỗi dựa trên giá trị `errno`. Các hàm thư viện `perror()` và `strerror()` được cung cấp cho mục đích này.

Hàm `perror()` in ra chuỗi được trỏ tới bởi tham số `msg` của nó, theo sau là thông báo tương ứng với giá trị hiện tại của `errno`.

```c
## include <stdio.h>
void perror(const char *msg);
```

Cách đơn giản để xử lý lỗi từ các System Call sẽ như sau:

```
fd = open(pathname, flags, mode);
if (fd == -1) {
 perror("open");
 exit(EXIT_FAILURE);
}
```

Hàm `strerror()` trả về chuỗi lỗi tương ứng với mã lỗi được truyền vào qua tham số `errnum`.

```c
## include <string.h>
char *strerror(int errnum);
                        Trả về con trỏ tới chuỗi lỗi tương ứng với errnum
```

Chuỗi do `strerror()` trả về có thể được cấp phát tĩnh, điều này có nghĩa là nó có thể bị ghi đè bởi các lời gọi `strerror()` tiếp theo.

Nếu `errnum` chỉ định một mã lỗi không được nhận dạng, `strerror()` sẽ trả về một chuỗi có dạng `Unknown error nnn`. Trên một số hệ thống triển khai khác, `strerror()` thay vào đó sẽ trả về `NULL` trong trường hợp này.

Vì các hàm `perror()` và `strerror()` nhạy cảm với locale (Mục 10.4), các mô tả lỗi được hiển thị bằng ngôn ngữ của địa phương (local language).

## Xử lý lỗi từ các hàm thư viện

Các hàm thư viện khác nhau trả về các kiểu dữ liệu và giá trị khác nhau để biểu thị lỗi. (Hãy kiểm tra trang hướng dẫn sử dụng - manual page cho từng hàm). Đối với mục đích của chúng ta, các hàm thư viện có thể được chia thành các loại sau:

- Một số hàm thư viện trả về thông tin lỗi theo cách thức hoàn toàn giống với System Call (System Call): giá trị trả về là –1, cùng với biến `errno` chỉ định lỗi cụ thể. Một ví dụ về hàm như vậy là remove(), dùng để xóa một file (sử dụng System Call unlink()) hoặc một thư mục (sử dụng System Call rmdir()). Các lỗi từ những hàm này có thể được chẩn đoán theo cách tương tự như lỗi từ System Call.
- Một số hàm thư viện trả về một giá trị khác với –1 khi xảy ra lỗi, nhưng vẫn thiết lập biến `errno` để chỉ định tình trạng lỗi cụ thể. Ví dụ, fopen() trả về con trỏ `NULL` khi có lỗi, và việc thiết lập `errno` phụ thuộc vào System Call nền tảng nào đã thất bại. Các hàm perror() và strerror() có thể được sử dụng để chẩn đoán những lỗi này.
- Các hàm thư viện khác hoàn toàn không sử dụng `errno`. Phương pháp xác định sự tồn tại và nguyên nhân gây ra lỗi tùy thuộc vào từng hàm cụ thể và được tài liệu hóa trong trang hướng dẫn sử dụng của hàm đó. Đối với các hàm này, việc sử dụng `errno`, perror(), hoặc strerror() để chẩn đoán lỗi là một sai lầm.

## 3.5 Lưu ý về các chương trình ví dụ trong cuốn sách này

Trong phần này, chúng ta mô tả các quy ước và tính năng khác nhau thường được sử dụng bởi các chương trình ví dụ được trình bày trong cuốn sách này.

### 3.5.1 Tùy chọn và đối số dòng lệnh (Command-Line Options and Arguments)

Nhiều chương trình ví dụ trong cuốn sách này dựa vào các tùy chọn và đối số dòng lệnh (command-line options and arguments) để xác định hành vi của chúng.

Các tùy chọn dòng lệnh truyền thống của UNIX bao gồm một dấu gạch ngang ở đầu, một chữ cái xác định tùy chọn, và một đối số tùy chọn. (Các tiện ích của GNU cung cấp cú pháp tùy chọn mở rộng bao gồm hai dấu gạch ngang ở đầu, theo sau là một chuỗi xác định tùy chọn và một đối số tùy chọn). Để phân tích cú pháp (parse) các tùy chọn này, chúng ta sử dụng hàm thư viện chuẩn getopt() (được mô tả trong Phụ lục B).

Mỗi chương trình ví dụ của chúng ta có cú pháp dòng lệnh không đơn giản đều cung cấp một tính năng trợ giúp đơn giản cho người dùng: nếu được gọi với tùy chọn `--help`, chương trình sẽ hiển thị thông báo hướng dẫn sử dụng cho biết cú pháp của các tùy chọn và đối số dòng lệnh.

### 3.5.2 Các hàm chung và tệp tiêu đề (Common Functions and Header Files)

Hầu hết các chương trình ví dụ đều bao gồm một tệp tiêu đề (header file) chứa các định nghĩa thường dùng, và chúng cũng sử dụng một tập hợp các hàm chung. Chúng ta sẽ thảo luận về tệp tiêu đề và các hàm này trong phần này.

## Tệp tiêu đề chung (Common header file)

Danh sách 3-1 là tệp tiêu đề (header file) được sử dụng bởi hầu như mọi chương trình trong cuốn sách này. Tệp tiêu đề này bao gồm nhiều tệp tiêu đề khác nhau được dùng bởi nhiều chương trình ví dụ, định nghĩa một kiểu dữ liệu Boolean, và định nghĩa các macro để tính giá trị tối thiểu và tối đa của hai giá trị số. Việc sử dụng tệp tiêu đề này giúp chúng ta làm cho các chương trình ví dụ ngắn gọn hơn một chút.

**Danh sách 3-1:** Tệp tiêu đề được sử dụng bởi hầu hết các chương trình ví dụ

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/tlpi_hdr.h
## ifndef TLPI_HDR_H
## define TLPI_HDR_H /* Prevent accidental double inclusion */
## include <sys/types.h> /* Type definitions used by many programs */
## include <stdio.h> /* Standard I/O functions */
## include <stdlib.h> /* Prototypes of commonly used library functions,
 plus EXIT_SUCCESS and EXIT_FAILURE constants */
## include <unistd.h> /* Prototypes for many system calls */
## include <errno.h> /* Declares errno and defines error constants */
## include <string.h> /* Commonly used string-handling functions */
## include "get_num.h" /* Declares our functions for handling numeric
 arguments (getInt(), getLong()) */
## include "error_functions.h" /* Declares our error-handling functions */
typedef enum { FALSE, TRUE } Boolean;
## define min(m,n) ((m) < (n) ? (m) : (n))
## define max(m,n) ((m) > (n) ? (m) : (n))
## endif
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/tlpi_hdr.h
```

## Các hàm chẩn đoán lỗi (Error-diagnostic functions)

Để đơn giản hóa việc xử lý lỗi (error handling) trong các chương trình ví dụ của mình, chúng tôi sử dụng các hàm chẩn đoán lỗi có các khai báo được thể hiện trong Danh sách 3-2.

**Danh sách 3-2:** Khai báo cho các hàm xử lý lỗi thông dụng

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/error_functions.h
## ifndef ERROR_FUNCTIONS_H
## define ERROR_FUNCTIONS_H
void errMsg(const char *format, ...);
## ifdef __GNUC__
/* This macro stops 'gcc -Wall' complaining that "control reaches
 end of non-void function" if we use the following functions to
 terminate main() or some other non-void function. */
## define NORETURN __attribute__ ((__noreturn__))
## else
## define NORETURN
## endif
void errExit(const char *format, ...) NORETURN ;
void err_exit(const char *format, ...) NORETURN ;
void errExitEN(int errnum, const char *format, ...) NORETURN ;
void fatal(const char *format, ...) NORETURN ;
void usageErr(const char *format, ...) NORETURN ;
void cmdLineErr(const char *format, ...) NORETURN ;
## endif
––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/error_functions.h
```

Để chẩn đoán lỗi từ System Call và các hàm thư viện, chúng tôi sử dụng errMsg(), errExit(), err\_exit(), và errExitEN().

## include "tlpi_hdr.h"

void errMsg(const char *format, ...);
void errExit(const char *format, ...);
void err_exit(const char *format, ...);
void errExitEN(int errnum, const char *format, ...);

```

Hàm errMsg() in ra một thông điệp trên luồng lỗi chuẩn (standard error). Danh sách đối số của nó giống với printf(), ngoại trừ việc một ký tự xuống dòng kết thúc được tự động nối thêm vào chuỗi đầu ra. Hàm errMsg() in văn bản lỗi tương ứng với giá trị hiện tại của `errno` — bao gồm tên lỗi, chẳng hạn như `EPERM`, cộng với mô tả lỗi được trả về bởi strerror() — theo sau là đầu ra được định dạng được chỉ định trong danh sách đối số.

Hàm errExit() hoạt động giống như errMsg(), nhưng đồng thời cũng kết thúc chương trình, hoặc bằng cách gọi exit() hoặc, nếu biến môi trường `EF_DUMPCORE` được định nghĩa với một giá trị chuỗi không rỗng, bằng cách gọi abort() để tạo ra một tệp core dump phục vụ cho việc gỡ lỗi (debugger). (Chúng tôi giải thích về các tệp core dump trong Mục 22.1).

Hàm err\_exit() tương tự như errExit(), nhưng khác ở hai điểm:

- Nó không xả (flush) bộ đệm đầu ra chuẩn trước khi in thông điệp lỗi.
- Nó kết thúc tiến trình (Process) bằng cách gọi \_exit() thay vì exit(). Điều này khiến tiến trình kết thúc mà không làm sạch bộ đệm stdio hoặc gọi các trình xử lý thoát (exit handler).

Chi tiết về những điểm khác biệt này trong hoạt động của err\_exit() sẽ trở nên rõ ràng hơn ở Chương 25, nơi chúng tôi mô tả sự khác biệt giữa \_exit() và exit(), đồng thời xem xét việc xử lý bộ đệm stdio và các trình xử lý thoát trong một tiến trình con (child process) được tạo bởi fork(). Hiện tại, chúng ta chỉ cần lưu ý rằng err\_exit() đặc biệt hữu ích nếu chúng ta viết một hàm thư viện tạo ra một tiến trình con cần phải chấm dứt do một lỗi nào đó. Việc chấm dứt này phải diễn ra mà không làm sạch bản sao bộ đệm stdio của tiến trình cha (tức là tiến trình gọi) và không gọi các trình xử lý thoát do tiến trình cha thiết lập.

Hàm errExitEN() giống với errExit(), ngoại trừ việc thay vì in văn bản lỗi tương ứng với giá trị hiện tại của `errno`, nó in văn bản tương ứng với số lỗi (do đó có hậu tố EN) được cung cấp trong đối số `errnum`.

Chủ yếu, chúng tôi sử dụng errExitEN() trong các chương trình ứng dụng API POSIX threads. Không giống như các System Call truyền thống của UNIX — vốn trả về –1 khi có lỗi, các hàm POSIX threads chẩn đoán lỗi bằng cách trả về một số lỗi (tức là một số dương thuộc kiểu thường được đặt trong `errno`) làm kết quả hàm của chúng. (Các hàm POSIX threads trả về 0 khi thành công).

Chúng ta có thể chẩn đoán lỗi từ các hàm POSIX threads sử dụng đoạn mã như sau:

```

errno = pthread_create(&thread, NULL, func, &arg);
if (errno != 0)
errExit("pthread_create");

```

Tuy nhiên, cách tiếp cận này không hiệu quả vì trong các chương trình đa luồng (threaded programs), `errno` được định nghĩa là một macro mở rộng thành lời gọi hàm trả về một lvalue có thể thay đổi được (modifiable lvalue). Do đó, mỗi lần sử dụng `errno` đều dẫn đến một lời gọi hàm. Hàm `errExitEN()` cho phép chúng ta viết một đoạn mã tương đương hiệu quả hơn đoạn mã trên:

```

int s;
s = pthread_create(&thread, NULL, func, &arg);
if (s != 0)
errExitEN(s, "pthread_create");

```

Theo thuật ngữ của ngôn ngữ C, một lvalue là một biểu thức tham chiếu đến một vùng lưu trữ (storage). Ví dụ phổ biến nhất về lvalue là một định danh cho biến (identifier for a variable). Một số toán tử cũng trả về lvalue. Ví dụ, nếu `p` là một con trỏ trỏ đến một vùng lưu trữ, thì `*p` là một lvalue. Theo POSIX threads API, `errno` được định nghĩa lại thành một hàm trả về con trỏ trỏ đến vùng lưu trữ riêng biệt của luồng (thread-specific storage area) (xem Mục 31.3).

Để chẩn đoán các loại lỗi khác, chúng ta sử dụng `fatal()`, `usageErr()` và `cmdLineErr()`.

## include "tlpi_hdr.h"
void fatal(const char *format, ...);
void usageErr(const char *format, ...);
void cmdLineErr(const char *format, ...);
```

Hàm `fatal()` được sử dụng để chẩn đoán các lỗi chung (general errors), bao gồm lỗi từ các hàm thư viện không thiết lập `errno`. Danh sách tham số của hàm này giống với `printf()`, ngoại trừ việc ký tự xuống dòng kết thúc được tự động nối thêm vào chuỗi đầu ra. Nó in ra đầu ra được định dạng trên luồng lỗi chuẩn (standard error) và sau đó chấm dứt chương trình tương tự như `errExit()`.

Hàm `usageErr()` được sử dụng để chẩn đoán lỗi trong việc sử dụng đối số dòng lệnh (command-line argument). Nó nhận một danh sách tham số theo kiểu của `printf()`, in ra chuỗi `Usage:` theo sau là đầu ra được định dạng trên standard error, và sau đó chấm dứt chương trình bằng cách gọi `exit()`. (Một số chương trình ví dụ trong cuốn sách này cung cấp phiên bản mở rộng của riêng chúng cho hàm `usageErr()`, dưới tên gọi `usageError()`.)

Hàm `cmdLineErr()` tương tự như `usageErr()`, nhưng nhằm mục đích chẩn đoán lỗi trong các đối số dòng lệnh được chỉ định cho chương trình.

Việc cài đặt các hàm chẩn đoán lỗi của chúng ta được thể hiện trong Liệt kê 3-3 (Listing 3-3).

**Liệt kê 3-3 (Listing 3-3):** Các hàm xử lý lỗi được sử dụng bởi tất cả các chương trình

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/error_functions.c
## include <stdarg.h>
## include "error_functions.h"
## include "tlpi_hdr.h"
## include "ename.c.inc" /* Định nghĩa ename và MAX_ENAME */
## ifdef __GNUC__
__attribute__ ((__noreturn__))
## endif
static void
terminate(Boolean useExit3)
{
 char *s;
 /* Tạo core dump nếu biến môi trường EF_DUMPCORE được định nghĩa và
 là một chuỗi không rỗng; ngược lại gọi exit(3) hoặc _exit(2),
 tùy thuộc vào giá trị của 'useExit3'. */
 s = getenv("EF_DUMPCORE");
 if (s != NULL && *s != '\0')
 abort();
 else if (useExit3)
 exit(EXIT_FAILURE);
 else
 _exit(EXIT_FAILURE);
}
```

```
static void
outputError(Boolean useErr, int err, Boolean flushStdout,
 const char *format, va_list ap)
{
## define BUF_SIZE 500
 char buf[BUF_SIZE], userMsg[BUF_SIZE], errText[BUF_SIZE];
 vsnprintf(userMsg, BUF_SIZE, format, ap);
 if (useErr)
 snprintf(errText, BUF_SIZE, " [%s %s]",
 (err > 0 && err <= MAX_ENAME) ?
 ename[err] : "?UNKNOWN?", strerror(err));
 else
 snprintf(errText, BUF_SIZE, ":");
 snprintf(buf, BUF_SIZE, "ERROR%s %s\n", errText, userMsg);
 if (flushStdout)
 fflush(stdout); /* Xóa bộ đệm (flush) bất kỳ dữ liệu stdout nào đang chờ xử lý */
 fputs(buf, stderr);
 fflush(stderr); /* Trong trường hợp stderr không được đệm theo dòng (line-buffered) */
}
void
errMsg(const char *format, ...)
{
 va_list argList;
 int savedErrno;
 savedErrno = errno; /* Trong trường hợp chúng ta thay đổi nó ở đây */
 va_start(argList, format);
 outputError(TRUE, errno, TRUE, format, argList);
 va_end(argList);
 errno = savedErrno;
}
void
errExit(const char *format, ...)
{
 va_list argList;
 va_start(argList, format);
 outputError(TRUE, errno, TRUE, format, argList);
 va_end(argList);
 terminate(TRUE);
}
```

```
void
err_exit(const char *format, ...)
{
 va_list argList;
 va_start(argList, format);
 outputError(TRUE, errno, FALSE, format, argList);
 va_end(argList);
 terminate(FALSE);
}
void
errExitEN(int errnum, const char *format, ...)
{
 va_list argList;
 va_start(argList, format);
 outputError(TRUE, errnum, TRUE, format, argList);
 va_end(argList);
 terminate(TRUE);
}
void
fatal(const char *format, ...)
{
 va_list argList;
 va_start(argList, format);
 outputError(FALSE, 0, TRUE, format, argList);
 va_end(argList);
 terminate(TRUE);
}
void
usageErr(const char *format, ...)
{
 va_list argList;
 fflush(stdout); /* Xóa bộ đệm (flush) bất kỳ dữ liệu stdout nào đang chờ xử lý */
 fprintf(stderr, "Usage: ");
 va_start(argList, format);
 vfprintf(stderr, format, argList);
 va_end(argList);
 fflush(stderr); /* Trong trường hợp stderr không được đệm theo dòng (line-buffered) */
 exit(EXIT_FAILURE);
}
```

```c
void
cmdLineErr(const char *format, ...)
{
 va_list argList;
 fflush(stdout); /* Xóa bộ đệm (flush) bất kỳ dữ liệu nào còn tồn đọng trong stdout */
 fprintf(stderr, "Command-line usage error: ");
 va_start(argList, format);
 vfprintf(stderr, format, argList);
 va_end(argList);
 fflush(stderr); /* Phòng trường hợp stderr không được đệm theo dòng (line-buffered) */
 exit(EXIT_FAILURE);
}
```

––––––––––––––––––––––––––––––––––––––––––––––––––––– **lib/error_functions.c**

Tệp `ename.c.inc` được bao gồm (include) bởi Listing 3-3 được thể hiện tại [Listing 3-4](#page-37-0). Tệp này định nghĩa một mảng các chuỗi, `ename`, đại diện cho các tên tượng trưng (symbolic name) tương ứng với từng giá trị `errno` có thể xảy ra. Các hàm xử lý lỗi (error-handling function) của chúng ta sử dụng mảng này để in ra tên tượng trưng tương ứng với một mã lỗi cụ thể. Đây là một giải pháp thay thế (workaround) nhằm giải quyết vấn đề: một mặt, chuỗi do hàm `strerror()` trả về không xác định được hằng số tượng trưng (symbolic constant) tương ứng với thông báo lỗi của nó; mặt khác, các trang hướng dẫn sử dụng (manual pages) lại mô tả các lỗi bằng cách sử dụng tên tượng trưng của chúng. Việc in ra tên tượng trưng giúp chúng ta có một cách dễ dàng để tra cứu nguyên nhân gây ra lỗi trong các manual pages.

> [!NOTE]
> Nội dung của tệp `ename.c.inc` phụ thuộc vào kiến trúc phần cứng (architecture-specific), bởi vì các giá trị `errno` có sự khác biệt nhất định giữa các kiến trúc phần cứng Linux khác nhau. Phiên bản được thể hiện trong [Listing 3-4](#page-37-0) dành cho hệ thống Linux 2.6/x86-32. Tệp này được xây dựng bằng cách sử dụng một tập lệnh (script) (`lib/Build_ename.sh`) được đính kèm trong mã nguồn phân phối của cuốn sách này. Tập lệnh này có thể được sử dụng để tạo ra một phiên bản của `ename.c.inc` phù hợp với một nền tảng phần cứng và phiên bản kernel cụ thể.

Lưu ý rằng một số chuỗi trong mảng `ename` để trống. Chúng tương ứng với các giá trị lỗi không được sử dụng. Hơn nữa, một số chuỗi trong `ename` bao gồm hai tên lỗi được phân tách bằng dấu gạch chéo. Các chuỗi này tương ứng với các trường hợp mà hai tên lỗi tượng trưng có cùng một giá trị số.

> [!NOTE]
> Từ tệp `ename.c.inc`, chúng ta có thể thấy rằng các lỗi `EAGAIN` và `EWOULDBLOCK` có cùng giá trị. (Tiêu chuẩn SUSv3 cho phép rõ ràng điều này, và giá trị của các hằng số này giống nhau trên hầu hết, nhưng không phải tất cả, các hệ thống UNIX khác). Các lỗi này được trả về bởi một System Call trong các trường hợp mà thông thường nó sẽ bị block (tức là buộc phải chờ đợi trước khi hoàn thành), nhưng tiến trình gọi (caller) lại yêu cầu System Call trả về lỗi thay vì bị block. `EAGAIN` bắt nguồn từ System V, và đó là lỗi được trả về cho các System Call thực hiện I/O, thao tác semaphore, thao tác message queue, và khóa tệp (`fcntl()`). `EWOULDBLOCK` bắt nguồn từ BSD, và nó được trả về bởi các System Call liên quan đến khóa tệp (`flock()`) và socket.

> [!NOTE]
> Trong tiêu chuẩn SUSv3, `EWOULDBLOCK` chỉ được đề cập trong phần kỹ thuật đặc tả của các giao diện khác nhau liên quan đến socket. Đối với các giao diện này, SUSv3 cho phép trả về hoặc `EAGAIN` hoặc `EWOULDBLOCK` bởi các lệnh gọi không chặn (nonblocking call). Đối với tất cả các lệnh gọi không chặn khác, chỉ có mã lỗi `EAGAIN` được quy định trong SUSv3.

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/ename.c.inc
static char *ename[] = {
 /* 0 */ "",
 /* 1 */ "EPERM", "ENOENT", "ESRCH", "EINTR", "EIO", "ENXIO", "E2BIG",
 /* 8 */ "ENOEXEC", "EBADF", "ECHILD", "EAGAIN/EWOULDBLOCK", "ENOMEM",
 /* 13 */ "EACCES", "EFAULT", "ENOTBLK", "EBUSY", "EEXIST", "EXDEV",
 /* 19 */ "ENODEV", "ENOTDIR", "EISDIR", "EINVAL", "ENFILE", "EMFILE",
 /* 25 */ "ENOTTY", "ETXTBSY", "EFBIG", "ENOSPC", "ESPIPE", "EROFS",
 /* 31 */ "EMLINK", "EPIPE", "EDOM", "ERANGE", "EDEADLK/EDEADLOCK",
 /* 36 */ "ENAMETOOLONG", "ENOLCK", "ENOSYS", "ENOTEMPTY", "ELOOP", "",
 /* 42 */ "ENOMSG", "EIDRM", "ECHRNG", "EL2NSYNC", "EL3HLT", "EL3RST",
 /* 48 */ "ELNRNG", "EUNATCH", "ENOCSI", "EL2HLT", "EBADE", "EBADR",
 /* 54 */ "EXFULL", "ENOANO", "EBADRQC", "EBADSLT", "", "EBFONT", "ENOSTR",
 /* 61 */ "ENODATA", "ETIME", "ENOSR", "ENONET", "ENOPKG", "EREMOTE",
 /* 67 */ "ENOLINK", "EADV", "ESRMNT", "ECOMM", "EPROTO", "EMULTIHOP",
 /* 73 */ "EDOTDOT", "EBADMSG", "EOVERFLOW", "ENOTUNIQ", "EBADFD",
 /* 78 */ "EREMCHG", "ELIBACC", "ELIBBAD", "ELIBSCN", "ELIBMAX",
 /* 83 */ "ELIBEXEC", "EILSEQ", "ERESTART", "ESTRPIPE", "EUSERS",
 /* 88 */ "ENOTSOCK", "EDESTADDRREQ", "EMSGSIZE", "EPROTOTYPE",
 /* 92 */ "ENOPROTOOPT", "EPROTONOSUPPORT", "ESOCKTNOSUPPORT",
 /* 95 */ "EOPNOTSUPP/ENOTSUP", "EPFNOSUPPORT", "EAFNOSUPPORT",
 /* 98 */ "EADDRINUSE", "EADDRNOTAVAIL", "ENETDOWN", "ENETUNREACH",
 /* 102 */ "ENETRESET", "ECONNABORTED", "ECONNRESET", "ENOBUFS", "EISCONN",
 /* 107 */ "ENOTCONN", "ESHUTDOWN", "ETOOMANYREFS", "ETIMEDOUT",
 /* 111 */ "ECONNREFUSED", "EHOSTDOWN", "EHOSTUNREACH", "EALREADY",
 /* 115 */ "EINPROGRESS", "ESTALE", "EUCLEAN", "ENOTNAM", "ENAVAIL",
 /* 120 */ "EISNAM", "EREMOTEIO", "EDQUOT", "ENOMEDIUM", "EMEDIUMTYPE",
 /* 125 */ "ECANCELED", "ENOKEY", "EKEYEXPIRED", "EKEYREVOKED",
 /* 129 */ "EKEYREJECTED", "EOWNERDEAD", "ENOTRECOVERABLE", "ERFKILL"
};
## define MAX_ENAME 132
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/ename.c.inc
```

## Các hàm phân tích cú pháp (parse) đối số dòng lệnh dạng số

Tệp tiêu đề (header file) trong [Listing 3-5](#page-38-0) cung cấp khai báo của hai hàm mà chúng ta thường xuyên sử dụng để phân tích cú pháp (parse) các đối số dòng lệnh dạng số nguyên (integer): `getInt()` và `getLong()`. Ưu điểm chính của việc sử dụng các hàm này thay vì `atoi()`, `atol()`, và `strtol()` là chúng cung cấp một số cơ chế kiểm tra tính hợp lệ cơ bản cho các đối số dạng số.

## include "tlpi_hdr.h"

int getInt(const char *arg, int flags, const char *name);
long getLong(const char *arg, int flags, const char *name);
Cả hai đều trả về arg đã được chuyển đổi sang dạng số

```

Các hàm `getInt()` và `getLong()` lần lượt chuyển đổi chuỗi được trỏ bởi `arg` thành kiểu `int` hoặc `long`. Nếu `arg` không chứa một chuỗi số nguyên hợp lệ (tức là chỉ bao gồm các chữ số và các ký tự `+` và `-`), thì các hàm này sẽ in ra thông báo lỗi và chấm dứt (terminate) chương trình.

Nếu đối số `name` khác `NULL`, nó phải chứa một chuỗi định danh cho đối số nằm trong `arg`. Chuỗi này được bao gồm như một phần của bất kỳ thông báo lỗi nào được hiển thị bởi các hàm này.

Đối số `flags` cung cấp một số quyền kiểm soát đối với hoạt động của các hàm `getInt()` và `getLong()`. Theo mặc định, các hàm này mong đợi các chuỗi chứa số nguyên thập phân có dấu (signed decimal integer). Bằng cách thực hiện phép toán OR bitwise (`|`) một hoặc nhiều hằng số `GN_*` được định nghĩa trong [Listing 3-5](#page-38-0) vào `flags`, chúng ta có thể chọn các cơ số (base) thay thế cho việc chuyển đổi và giới hạn phạm vi của số đó phải là không âm (non-negative) hoặc lớn hơn 0.

Các phần cài đặt (implementation) của hàm `getInt()` và `getLong()` được cung cấp trong [Listing 3-6](#page-38-1).

> Mặc dù đối số `flags` cho phép chúng ta thực thi việc kiểm tra phạm vi được mô tả trong phần nội dung chính, nhưng trong một số trường hợp, chúng ta không yêu cầu các kiểu kiểm tra như vậy trong các chương trình ví dụ của mình, mặc dù điều đó có vẻ hợp lý. Ví dụ, trong Listing 47-1, chúng ta không kiểm tra đối số `init-value`. Điều này có nghĩa là người dùng có thể chỉ định một số âm làm giá trị khởi tạo cho một semaphore, điều này sẽ dẫn đến lỗi (`ERANGE`) trong System Call `semctl()` tiếp theo, bởi vì một semaphore không thể mang giá trị âm. Việc bỏ qua kiểm tra phạm vi trong các trường hợp như vậy cho phép chúng ta thử nghiệm không chỉ việc sử dụng đúng các System Call và thư viện hàm (library function), mà còn xem điều gì xảy ra khi các đối số không hợp lệ được cung cấp. Các ứng dụng thực tế thông thường sẽ áp dụng các biện pháp kiểm tra ngặt nghèo hơn đối với các đối số dòng lệnh của chúng.

**Listing 3-5:** Tệp tiêu đề cho get\_num.c

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/get_num.h

## ifndef GET_NUM_H

## define GET_NUM_H

## define GN_NONNEG 01 /* Giá trị phải >= 0 */

## define GN_GT_0 02 /* Giá trị phải > 0 */

/* Theo mặc định, số nguyên là hệ thập phân */

## define GN_ANY_BASE 0100 /* Có thể dùng bất kỳ cơ số nào - giống strtol(3) */

## define GN_BASE_8 0200 /* Giá trị được biểu diễn dưới hệ bát phân (octal) */

## define GN_BASE_16 0400 /* Giá trị được biểu diễn dưới hệ thập lục phân (hexadecimal) */

long getLong(const char *arg, int flags, const char *name);
int getInt(const char *arg, int flags, const char *name);

## endif

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/get_num.h
Listing 3-6: Các hàm phân tích cú pháp đối số dòng lệnh dạng số
–––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/get_num.c

## include <stdio.h>

## include <stdlib.h>

## include <string.h>

## include <limits.h>

## include <errno.h>

## include "get_num.h"

```

```

static void
gnFail(const char *fname, const char *msg, const char *arg, const char *name)
{
fprintf(stderr, "%s error", fname);
if (name != NULL)
fprintf(stderr, " (in %s)", name);
fprintf(stderr, ": %s\n", msg);
if (arg != NULL && *arg != '\0')
fprintf(stderr, " offending text: %s\n", arg);
exit(EXIT_FAILURE);
}
static long
getNum(const char *fname, const char *arg, int flags, const char *name)
{
long res;
char *endptr;
int base;
if (arg == NULL || *arg == '\0')
gnFail(fname, "null or empty string", arg, name);
base = (flags & GN_ANY_BASE) ? 0 : (flags & GN_BASE_8) ? 8 :
(flags & GN_BASE_16) ? 16 : 10;
errno = 0;
res = strtol(arg, &endptr, base);
if (errno != 0)
gnFail(fname, "strtol() failed", arg, name);
if (*endptr != '\0')
gnFail(fname, "nonnumeric characters", arg, name);
if ((flags & GN_NONNEG) && res < 0)
gnFail(fname, "negative value not allowed", arg, name);
if ((flags & GN_GT_0) && res <= 0)
gnFail(fname, "value must be > 0", arg, name);
return res;
}
long
getLong(const char *arg, int flags, const char *name)
{
return getNum("getLong", arg, flags, name);
}
int
getInt(const char *arg, int flags, const char *name)
{
long res;
res = getNum("getInt", arg, flags, name);

```

```

if (res > INT_MAX || res < INT_MIN)
gnFail("getInt", "integer out of range", arg, name);
return (int) res;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– lib/get_num.c

```

## 3.6 Các vấn đề về tính tương thích (Portability Issues)

Trong phần này, chúng ta xem xét chủ đề viết các chương trình hệ thống có tính tương thích cao (portable). Chúng ta sẽ giới thiệu các macro kiểm tra tính năng (feature test macro) và các kiểu dữ liệu hệ thống chuẩn được định nghĩa bởi SUSv3, sau đó tìm hiểu một số vấn đề về tính tương thích khác.

### 3.6.1 Macro Kiểm tra Tính năng (Feature Test Macros)

Nhiều tiêu chuẩn khác nhau chi phối hành vi của các System Call và API của thư viện hàm (xem Mục 1.3). Một số tiêu chuẩn trong số này được định nghĩa bởi các tổ chức tiêu chuẩn như The Open Group (Single UNIX Specification), trong khi các tiêu chuẩn khác được định nghĩa bởi hai hiện thực UNIX có ý nghĩa lịch sử quan trọng: BSD và System V Release 4 (cùng với System V Interface Definition đi kèm).

Đôi khi, khi viết một ứng dụng có tính khả chuyển (portable application), chúng ta có thể muốn các tệp tiêu đề (header file) chỉ hiển thị (expose) các định nghĩa (hằng số, nguyên mẫu hàm, v.v.) tuân theo một tiêu chuẩn cụ thể nào đó. Để làm điều này, chúng ta định nghĩa một hoặc nhiều macro kiểm tra tính năng (feature test macro) được liệt kê dưới đây khi biên dịch chương trình. Một cách để thực hiện là định nghĩa macro trong mã nguồn chương trình trước khi bao gồm (include) bất kỳ tệp tiêu đề nào:

```c

## define _BSD_SOURCE 1

```

Ngoài ra, chúng ta có thể sử dụng tùy chọn `-D` của trình biên dịch C:

```

$ cc -D_BSD_SOURCE prog.c

```

Thuật ngữ macro kiểm tra tính năng (feature test macro) có vẻ gây nhầm lẫn, nhưng nó hoàn toàn hợp lý nếu chúng ta nhìn nhận vấn đề từ góc độ của việc hiện thực (implementation). Phía hiện thực quyết định tính năng nào có sẵn trong mỗi tệp tiêu đề nên được làm cho hiển thị bằng cách kiểm tra (với `#if`) xem ứng dụng đã định nghĩa giá trị nào cho các macro này.

Các macro kiểm tra tính năng sau đây được quy định bởi các tiêu chuẩn có liên quan, do đó việc sử dụng chúng có tính di động trên tất cả các hệ thống hỗ trợ các tiêu chuẩn này:

```

_POSIX_SOURCE

```

Nếu được định nghĩa (với bất kỳ giá trị nào), sẽ hiển thị các định nghĩa tuân thủ POSIX.1-1990 và ISO C (1990). Macro này đã được thay thế bởi `_POSIX_C_SOURCE`.

```

_POSIX_C_SOURCE

```

Nếu được định nghĩa với giá trị 1, nó có tác dụng tương tự như `_POSIX_SOURCE`. Nếu được định nghĩa với giá trị lớn hơn hoặc bằng 199309, cũng hiển thị các định nghĩa cho POSIX.1b (thời gian thực - realtime). Nếu được định nghĩa với giá trị lớn hơn hoặc bằng 199506, cũng hiển thị các định nghĩa cho POSIX.1c (luồng - threads). Nếu được định nghĩa với giá trị 200112, cũng hiển thị các định nghĩa cho đặc tả cơ sở POSIX.1-2001 (tức là phần mở rộng XSI bị loại trừ). (Trước phiên bản 2.3.3, các tệp tiêu đề của glibc không diễn giải giá trị 200112 cho `_POSIX_C_SOURCE`.) Nếu được định nghĩa với giá trị 200809, cũng hiển thị các định nghĩa cho đặc tả cơ sở POSIX.1-2008. (Trước phiên bản 2.10, các tệp tiêu đề của glibc không diễn giải giá trị 200809 cho `_POSIX_C_SOURCE`.)

### `_XOPEN_SOURCE`

Nếu được định nghĩa (với bất kỳ giá trị nào), sẽ hiển thị các định nghĩa POSIX.1, POSIX.2 và X/Open (XPG4). Nếu được định nghĩa với giá trị từ 500 trở lên, cũng hiển thị các phần mở rộng SUSv2 (UNIX 98 và XPG5). Thiết lập từ 600 trở lên sẽ đồng thời hiển thị các phần mở rộng SUSv3 XSI (UNIX 03) và các phần mở rộng C99. (Trước phiên bản 2.2, các tệp tiêu đề của glibc không diễn giải giá trị 600 cho `_XOPEN_SOURCE`.) Thiết lập từ 700 trở lên cũng hiển thị các phần mở rộng SUSv4 XSI. (Trước phiên bản 2.10, các tệp tiêu đề của glibc không diễn giải giá trị 700 cho `_XOPEN_SOURCE`.) Các giá trị 500, 600 và 700 cho `_XOPEN_SOURCE` được chọn vì SUSv2, SUSv3 và SUSv4 lần lượt là các Phiên bản (Issues) 5, 6 và 7 của các đặc tả X/Open.

Các macro kiểm tra tính năng được liệt kê sau đây là đặc thù của glibc (glibc-specific):

### `_BSD_SOURCE`

Nếu được định nghĩa (với bất kỳ giá trị nào), sẽ hiển thị các định nghĩa BSD. Việc định nghĩa macro này cũng đồng thời định nghĩa `_POSIX_C_SOURCE` với giá trị 199506. Việc chỉ định rõ riêng macro này sẽ khiến các định nghĩa BSD được ưu tiên trong một số ít trường hợp các tiêu chuẩn mâu thuẫn với nhau.

### `_SVID_SOURCE`

Nếu được định nghĩa (với bất kỳ giá trị nào), sẽ hiển thị các định nghĩa System V Interface Definition (SVID).

### `_GNU_SOURCE`

Nếu được định nghĩa (với bất kỳ giá trị nào), sẽ hiển thị tất cả các định nghĩa được cung cấp bởi việc thiết lập tất cả các macro trước đó, cũng như các phần mở rộng GNU khác nhau.

Khi trình biên dịch GNU C được gọi mà không có các tùy chọn đặc biệt, `_POSIX_SOURCE`, `_POSIX_C_SOURCE=200809` (200112 với glibc phiên bản 2.5 đến 2.9, hoặc 199506 với glibc phiên bản trước 2.4), `_BSD_SOURCE` và `_SVID_SOURCE` được định nghĩa theo mặc định.

Nếu các macro riêng lẻ được định nghĩa, hoặc trình biên dịch được gọi ở một trong các chế độ tiêu chuẩn của nó (ví dụ: `cc –ansi` hoặc `cc –std=c99`), thì chỉ các định nghĩa được yêu cầu mới được cung cấp. Có một ngoại lệ: nếu `_POSIX_C_SOURCE` không được định nghĩa theo cách nào khác, và trình biên dịch không được gọi ở một trong các chế độ tiêu chuẩn của nó, thì `_POSIX_C_SOURCE` được định nghĩa với giá trị 200809 (200112 với glibc phiên bản 2.4 đến 2.9, hoặc 199506 với glibc phiên bản trước 2.4).

Việc định nghĩa nhiều macro mang tính chất cộng dồn (additive), do đó chúng ta có thể, ví dụ, sử dụng lệnh `cc` sau đây để chọn một cách rõ ràng các thiết lập macro giống như được cung cấp theo mặc định:

```

$ cc -D_POSIX_SOURCE -D_POSIX_C_SOURCE=199506 \
-D_BSD_SOURCE -D_SVID_SOURCE prog.c

```

Tệp tiêu đề `<features.h>` và trang hướng dẫn (man page) `feature_test_macros(7)` cung cấp thêm thông tin chi tiết về các giá trị chính xác được gán cho từng macro kiểm tra tính năng.

## \_POSIX\_C\_SOURCE, \_XOPEN\_SOURCE và POSIX.1/SUS

Chỉ có các macro kiểm tra tính năng (feature test macro) `_POSIX_C_SOURCE` và `_XOPEN_SOURCE` là được quy định trong POSIX.1-2001/SUSv3, trong đó yêu cầu các macro này phải được định nghĩa với các giá trị tương ứng là 200112 và 600 trong các ứng dụng tuân thủ (conforming application). Việc định nghĩa `_POSIX_C_SOURCE` là 200112 sẽ cung cấp khả năng tuân thủ đặc tả cơ sở POSIX.1-2001 (tức là tuân thủ POSIX, ngoại trừ phần mở rộng XSI). Việc định nghĩa `_XOPEN_SOURCE` là 600 sẽ cung cấp khả năng tuân thủ SUSv3 (tức là tuân thủ XSI, bao gồm đặc tả cơ sở cộng với phần mở rộng XSI). Các phát biểu tương tự cũng áp dụng cho POSIX.1-2008/SUSv4, trong đó yêu cầu hai macro này phải được định nghĩa với các giá trị là 200809 và 700.

SUSv3 quy định rằng việc thiết lập `_XOPEN_SOURCE` thành 600 phải cung cấp tất cả các tính năng được kích hoạt nếu `_POSIX_C_SOURCE` được thiết lập thành 200112. Do đó, một ứng dụng chỉ cần định nghĩa `_XOPEN_SOURCE` để tuân thủ SUSv3 (tức là XSI). SUSv4 đưa ra một quy định tương tự rằng việc thiết lập `_XOPEN_SOURCE` thành 700 phải cung cấp tất cả các tính năng được kích hoạt nếu `_POSIX_C_SOURCE` được thiết lập thành 200809.

### Macro kiểm tra tính năng trong các nguyên mẫu hàm và ví dụ mã nguồn

Các trang tài liệu hướng dẫn (manual page) mô tả macro kiểm tra tính năng nào phải được định nghĩa để làm cho một định nghĩa hằng số hoặc khai báo hàm cụ thể có thể nhìn thấy được từ một tệp tiêu đề (header file).

Tất cả các ví dụ mã nguồn trong cuốn sách này được viết sao cho chúng có thể được biên dịch bằng cách sử dụng các tùy chọn trình biên dịch GNU C mặc định hoặc các tùy chọn sau:

\$ **cc -std=c99 -D\_XOPEN\_SOURCE=600**

Nguyên mẫu (prototype) của mỗi hàm được hiển thị trong cuốn sách này chỉ ra bất kỳ macro kiểm tra tính năng nào phải được định nghĩa để sử dụng hàm đó trong một chương trình được biên dịch với các tùy chọn trình biên dịch mặc định hoặc các tùy chọn trong lệnh `cc` vừa nêu. Các trang tài liệu hướng dẫn cung cấp các mô tả chính xác hơn về các macro kiểm tra tính năng bắt buộc để hiển thị khai báo của từng hàm.

### 3.6.2 Kiểu Dữ Liệu Hệ Thống (System Data Types)

Các kiểu dữ liệu thực thi khác nhau được thể hiện bằng các kiểu C chuẩn, ví dụ: ID tiến trình (process ID), ID người dùng (user ID) và phần bù tệp (file offset). Mặc dù có thể sử dụng các kiểu cơ bản của C như `int` và `long` để khai báo các biến lưu trữ thông tin đó, nhưng điều này làm giảm tính khả chuyển (portability) trên các hệ thống UNIX, vì những lý do sau:

- Kích thước của các kiểu cơ bản này thay đổi giữa các bản cài đặt UNIX (ví dụ: kiểu `long` có thể là 4 byte trên một hệ thống và 8 byte trên hệ thống khác), hoặc đôi khi thậm chí trong các môi trường biên dịch khác nhau trên cùng một bản cài đặt. Hơn nữa, các bản cài đặt khác nhau có thể sử dụng các kiểu khác nhau để biểu diễn cùng một thông tin. Ví dụ, một ID tiến trình có thể là `int` trên hệ thống này nhưng lại là `long` trên hệ thống khác.
- Ngay cả trên một bản cài đặt UNIX duy nhất, các kiểu được sử dụng để biểu diễn thông tin có thể khác nhau giữa các phiên bản (release) của bản cài đặt đó. Các ví dụ đáng chú ý trên Linux là ID người dùng và ID nhóm (user and group ID). Trên Linux 2.2 trở về trước, các giá trị này được biểu diễn trong 16 bit. Trên Linux 2.4 trở về sau, chúng là các giá trị 32-bit.

Để tránh các vấn đề về tính khả chuyển như vậy, SUSv3 quy định các kiểu dữ liệu hệ thống chuẩn khác nhau và yêu cầu một bản cài đặt phải định nghĩa và sử dụng các kiểu này một cách thích hợp. Mỗi kiểu trong số này được định nghĩa bằng cách sử dụng tính năng `typedef` của C. Ví dụ, kiểu dữ liệu `pid_t` được dùng để biểu diễn các ID tiến trình, và trên Linux/x86-32 kiểu này được định nghĩa như sau:

```c

typedef int pid_t;

```

Hầu hết các kiểu dữ liệu hệ thống chuẩn có tên kết thúc bằng `_t`. Nhiều kiểu trong số đó được khai báo trong tệp tiêu đề `<sys/types.h>`, mặc dù một số ít được định nghĩa trong các tệp tiêu đề khác.

Một ứng dụng nên sử dụng các định nghĩa kiểu này để khai báo các biến mà nó sử dụng một cách khả chuyển. Ví dụ, khai báo sau đây sẽ cho phép một ứng dụng biểu diễn chính xác các ID tiến trình trên bất kỳ hệ thống nào tuân thủ SUSv3:

```c

pid_t mypid;

```

Bảng 3-1 liệt kê một số kiểu dữ liệu hệ thống mà chúng ta sẽ gặp trong cuốn sách này. Đối với một số kiểu nhất định trong bảng này, SUSv3 yêu cầu kiểu đó phải được triển khai như một kiểu số học (arithmetic type). Điều này có nghĩa là quá trình thực thi có thể chọn kiểu cơ sở (underlying type) là kiểu số nguyên (integer) hoặc kiểu dấu phẩy động (floating-point - số thực hoặc số phức).

**Bảng 3-1:** Các kiểu dữ liệu hệ thống được chọn lọc

| Kiểu dữ liệu | Yêu cầu kiểu của SUSv3 | Mô tả |
|--------------|------------------------|-------|
| blkcnt_t     | số nguyên có dấu (signed integer) | Số khối tệp (File block count) (Mục 15.1) |
| blksize_t    | số nguyên có dấu (signed integer) | Kích thước khối tệp (File block size) (Mục 15.1) |

| cc_t       | số nguyên không dấu (unsigned integer)                 | Ký tự đặc biệt của terminal (Mục 62.4)                                                           |
| clock_t    | số nguyên hoặc số thực dấu phẩy động (real-floating)   | Thời gian hệ thống tính bằng số xung nhịp (clock tick) (Mục 10.7)                               |
| clockid_t  | kiểu số học (arithmetic type)                          | Định danh đồng hồ cho các hàm đồng hồ và bộ định thời<br>POSIX.1b (Mục 23.6)                      |
| comp_t     | không có trong SUSv3                                   | Xung nhịp hệ thống đã nén (Mục 28.1)                                                             |
| dev_t      | kiểu số học (arithmetic type)                          | Số hiệu thiết bị, bao gồm số hiệu chính (major) và<br>số hiệu phụ (minor) (Mục 15.1)            |
| DIR        | không yêu cầu kiểu dữ liệu cụ thể                      | Dòng thư mục (Directory stream) (Mục 18.8)                                                       |
| fd_set     | kiểu cấu trúc (structure type)                         | Tập hợp bộ mô tả tệp (File Descriptor set) cho select() (Mục 63.2.1)                             |
| fsblkcnt_t | số nguyên không dấu (unsigned integer)                 | Số lượng khối hệ thống tệp (File-system block count) (Mục 14.11)                                 |
| fsfilcnt_t | số nguyên không dấu (unsigned integer)                 | Số lượng tệp (Mục 14.11)                                                                         |
| gid_t      | số nguyên (integer)                                    | Định danh nhóm dạng số (Numeric group identifier) (Mục 8.3)                                        |
| id_t       | số nguyên (integer)                                    | Kiểu chung để lưu trữ các định danh; đủ lớn<br>để chứa ít nhất pid_t, uid_t và gid_t             |
| in_addr_t  | số nguyên không dấu 32-bit                             | Địa chỉ IPv4 (Mục 59.4)                                                                          |
| in_port_t  | số nguyên không dấu 16-bit                             | Số hiệu cổng IP (IP port number) (Mục 59.4)                                                      |
| ino_t      | số nguyên không dấu (unsigned integer)                 | Số hiệu i-node của tệp (Mục 15.1)                                                                |
| key_t      | kiểu số học (arithmetic type)                          | Khóa System V IPC (Mục 45.2)                                                                     |
| mode_t     | số nguyên (integer)                                    | Quyền truy cập và kiểu tệp (Mục 15.1)                                                            |
| mqd_t      | không yêu cầu kiểu cụ thể, nhưng<br>không được là kiểu mảng | Bộ mô tả hàng đợi thông điệp POSIX (POSIX message queue descriptor)                            |
| msglen_t   | số nguyên không dấu (unsigned integer)                 | Số byte cho phép trong hàng đợi thông điệp<br>System V (Mục 46.4)                                  |

**Bảng 3-1:** Các kiểu dữ liệu hệ thống được chọn (tiếp theo)

| Kiểu dữ liệu | Yêu cầu kiểu của SUSv3                         | Mô tả                                                                         |
|--------------|------------------------------------------------|-------------------------------------------------------------------------------|
| msgqnum_t    | số nguyên không dấu (unsigned integer)         | Số lượng thông điệp trong hàng đợi thông điệp                                 |
|              |                                                | System V (Mục 46.4)                                                           |
| nfds_t       | số nguyên không dấu (unsigned integer)         | Số lượng bộ mô tả tệp (File Descriptor) cho poll()                            |
|              |                                                | (Mục 63.2.2)                                                                  |
| nlink_t      | số nguyên (integer)                            | Số lượng liên kết (cứng - hard link) trỏ đến một tệp (Mục 15.1)               |
| off_t        | số nguyên có dấu (signed integer)              | Vị trí hoặc kích thước tệp (Mục 4.7 và 15.1)                                  |
| pid_t        | số nguyên có dấu (signed integer)              | Process ID, Process Group ID hoặc Session ID<br>(Mục 6.2, 34.2 và 34.3)       |
| ptrdiff_t    | số nguyên có dấu (signed integer)              | Hiệu giữa hai giá trị con trỏ (pointer), dưới dạng<br>số nguyên có dấu        |
| rlim_t       | số nguyên không dấu (unsigned integer)         | Giới hạn tài nguyên (Resource limit) (Mục 36.2)                               |
| sa_family_t  | số nguyên không dấu (unsigned integer)         | Họ địa chỉ socket (Socket address family) (Mục 56.4)                          |

| shmatt_t     | số nguyên không dấu (unsigned integer) | Số lượng tiến trình (process) đang đính kèm vào một phân đoạn chia sẻ bộ nhớ System V (shared memory segment) (Mục 48.8) |
|              |                                                |                                                                               |
| sig_atomic_t | số nguyên (integer)                            | Kiểu dữ liệu có thể được truy cập một cách nguyên tử (atomically accessed)<br>(Mục 21.1.3) |
| siginfo_t    | kiểu cấu trúc (structure type)                 | Thông tin về nguồn gốc của một tín hiệu (signal)<br>(Mục 21.4)                 |
| sigset_t     | số nguyên hoặc kiểu cấu trúc                   | Tập hợp tín hiệu (signal set) (Mục 20.9)                                      |
| size_t       | số nguyên không dấu                            | Kích thước của một đối tượng tính bằng byte                                   |
| socklen_t    | kiểu số nguyên có ít nhất<br>32 bit            | Kích thước của cấu trúc địa chỉ socket (socket address structure) tính bằng byte<br>(Mục 56.3) |
| speed_t      | số nguyên không dấu                            | Tốc độ đường truyền terminal (Terminal line speed) (Mục 62.7)                 |
| ssize_t      | số nguyên có dấu (signed integer)              | Số lượng byte hoặc biểu thị lỗi (âm)                                          |
| stack_t      | kiểu cấu trúc                                  | Mô tả về một ngăn xếp tín hiệu thay thế (alternate signal stack)<br>(Mục 21.3) |
| suseconds_t  | số nguyên có dấu cho phép<br>dải [–1, 1000000] | Khoảng thời gian tính bằng micro giây (Mục 10.1)                              |
| tcflag_t     | số nguyên không dấu                            | Mặt nạ bit cờ chế độ terminal (Terminal mode flag bit mask) (Mục 62.2)         |
| time_t       | số nguyên hoặc số thực dấu phẩy động           | Thời gian lịch (calendar time) tính bằng giây kể từ thời điểm Epoch           |
|              | (real-floating)                                | (Mục 10.1)                                                                    |
| timer_t      | một kiểu số học (arithmetic type)              | Định danh bộ hẹn giờ cho các hàm bộ hẹn giờ khoảng thời gian POSIX.1b           |
|              |                                                | (POSIX.1b interval timer functions) (Mục 23.6)                                |
| uid_t        | số nguyên                                      | Định danh người dùng dạng số (Numeric user identifier) (Mục 8.1)               |

Khi thảo luận về các kiểu dữ liệu trong Bảng 3-1 ở các chương sau, chúng ta thường đưa ra các tuyên bố rằng một kiểu nào đó "là một kiểu số nguyên [được quy định bởi SUSv3]." Điều này có nghĩa là SUSv3 yêu cầu kiểu dữ liệu đó phải được định nghĩa là một số nguyên, nhưng không bắt buộc phải sử dụng một kiểu số nguyên nguyên bản (native integer type) cụ thể nào (ví dụ: `short`, `int` hoặc `long`). (Thường thì chúng ta sẽ không nêu rõ kiểu dữ liệu nguyên bản cụ thể nào thực sự được sử dụng để biểu diễn cho từng kiểu dữ liệu hệ thống trong Linux, bởi vì một ứng dụng di động (portable application) nên được viết sao cho nó không quan tâm đến việc kiểu dữ liệu nào đang được sử dụng.)

### In các giá trị kiểu dữ liệu hệ thống

Khi in các giá trị của một trong các kiểu dữ liệu hệ thống dạng số được hiển thị trong Bảng 3-1 (ví dụ: `pid_t` và `uid_t`), chúng ta phải cẩn thận không để xảy ra sự phụ thuộc vào biểu diễn (representation dependency) trong lời gọi hàm `printf()`. Sự phụ thuộc vào biểu diễn có thể xảy ra do các quy tắc thăng hạng đối số (argument promotion rules) của ngôn ngữ C chuyển đổi các giá trị kiểu `short` thành `int`, nhưng giữ nguyên các giá trị kiểu `int` và `long`. Điều này có nghĩa là, tùy thuộc vào định nghĩa của kiểu dữ liệu hệ thống, một `int` hoặc một `long` sẽ được truyền vào lời gọi `printf()`. Tuy nhiên, vì `printf()` không có cách nào xác định kiểu của các đối số tại thời điểm chạy (run time), nên hàm gọi (caller) phải cung cấp rõ ràng thông tin này bằng cách sử dụng bộ chỉ định định dạng (format specifier) `%d` hoặc `%ld`. Vấn đề nằm ở chỗ chỉ đơn thuần mã hóa một trong các bộ chỉ định này trong lời gọi `printf()` sẽ tạo ra sự phụ thuộc vào cài đặt (implementation dependency). Giải pháp thông thường là sử dụng bộ chỉ định `%ld` và luôn ép kiểu (cast) giá trị tương ứng về `long`, chẳng hạn như:

```c

pid_t mypid;
mypid = getpid(); /* Trả về Process ID của tiến trình gọi */
printf("My PID is %ld\n", (long) mypid);

```

Chúng ta đưa ra một ngoại lệ đối với kỹ thuật trên. Vì kiểu dữ liệu `off_t` có kích thước bằng `long long` trong một số môi trường biên dịch (compilation environments), chúng ta ép các giá trị `off_t` về kiểu này và sử dụng bộ chỉ định `%lld`, như được mô tả trong [Mục 5.10](#page-83-0).

> Tiêu chuẩn C99 định nghĩa bổ từ chỉ độ dài (length modifier) `z` cho hàm `printf()`, nhằm chỉ ra rằng phép chuyển đổi số nguyên tiếp theo tương ứng với kiểu `size_t` hoặc `ssize_t`. Do đó, chúng ta có thể viết `%zd` thay vì sử dụng `%ld` kèm theo việc ép kiểu cho các kiểu dữ liệu này. Mặc dù bộ chỉ định này khả dụng trong `glibc`, chúng ta vẫn tránh sử dụng nó vì nó không có sẵn trên mọi bản cài đặt UNIX.

> Tiêu chuẩn C99 cũng định nghĩa bổ từ chỉ độ dài (length modifier) `j`, chỉ định rằng đối số tương ứng có kiểu `intmax_t` (hoặc `uintmax_t`), một kiểu số nguyên được đảm bảo đủ lớn để biểu diễn số nguyên của bất kỳ kiểu nào. Cuối cùng, việc sử dụng phép ép kiểu `(intmax_t)` kết hợp với bộ chỉ định `%jd` nên thay thế cho phép ép kiểu `(long)` kết hợp với bộ chỉ định `%ld` như là cách tốt nhất để in các giá trị kiểu dữ liệu hệ thống dạng số, vì cách tiếp cận trước cũng xử lý được các giá trị `long long` và bất kỳ kiểu số nguyên mở rộng nào như `int128_t`. Tuy nhiên, (một lần nữa) chúng ta tránh kỹ thuật này vì nó không khả thi trên mọi bản cài đặt UNIX.

### 3.6.3 Các vấn đề về tính di động khác

Trong phần này, chúng ta xem xét một vài vấn đề về tính di động (portability) khác mà chúng ta có thể gặp phải khi viết các chương trình hệ thống (system programs).

## Khởi tạo và sử dụng cấu trúc

Mỗi bản cài đặt UNIX quy định một loạt các cấu trúc chuẩn được sử dụng trong các System Call (lời gọi hệ thống) và hàm thư viện khác nhau. Lấy cấu trúc `sembuf` làm ví dụ, cấu trúc này được dùng để biểu diễn một thao tác semaphore sẽ được thực hiện bởi System Call `semop()`:

```c

struct sembuf {
unsigned short sem_num; /* Số hiệu semaphore */
short sem_op; /* Thao tác cần thực hiện */
short sem_flg; /* Cờ thao tác */
};

```

Mặc dù SUSv3 quy định các cấu trúc như `sembuf`, điều quan trọng cần nhận ra là:

- Nhìn chung, thứ tự định nghĩa các trường (field) bên trong các cấu trúc như vậy là không được ấn định trước.
- Trong một số trường hợp, các trường bổ sung cụ thể theo từng cài đặt (implementation-specific) có thể được bao gồm trong các cấu trúc đó.

Do đó, việc sử dụng một bộ khởi tạo cấu trúc (structure initializer) như sau là không mang tính di động (non-portable):

```c

struct sembuf s = { 3, -1, SEM_UNDO };

```

Mặc dù bộ khởi tạo này sẽ hoạt động trên Linux, nhưng nó sẽ không chạy được trên một bản cài đặt khác nơi các trường trong cấu trúc `sembuf` được định nghĩa theo một thứ tự khác. Để khởi tạo các cấu trúc này một cách có tính di động, chúng ta phải sử dụng các câu lệnh gán tường minh (explicit assignment statements), như sau:

```c

struct sembuf s;
s.sem_num = 3;
s.sem_op = -1;
s.sem_flg = SEM_UNDO;

```

Nếu chúng ta đang sử dụng C99, thì chúng ta có thể tận dụng cú pháp mới của ngôn ngữ đó dành cho bộ khởi tạo cấu trúc để viết một cách khởi tạo tương đương:

```c

struct sembuf s = { .sem_num = 3, .sem_op = -1, .sem_flg = SEM_UNDO };

```

Các cân nhắc về thứ tự các thành viên (member) của cấu trúc chuẩn cũng được áp dụng nếu chúng ta muốn ghi nội dung của một cấu trúc chuẩn vào một tệp (file). Để thực hiện việc này một cách có tính di động, chúng ta không thể chỉ đơn giản thực hiện một phép ghi nhị phân (binary write) cấu trúc đó. Thay vào đó, các trường của cấu trúc phải được ghi riêng lẻ (có thể ở dạng văn bản) theo một thứ tự xác định.

### Sử dụng các macro có thể không có trên mọi bản cài đặt (implementations)

Trong một số trường hợp, một macro có thể không được định nghĩa trên mọi bản cài đặt UNIX (UNIX implementations). Ví dụ, macro WCOREDUMP() (dùng để kiểm tra xem một tiến trình con có tạo ra tệp core dump hay không) rất phổ biến, nhưng lại không được quy định trong chuẩn SUSv3. Do đó, macro này có thể không có mặt trên một số bản cài đặt UNIX. Để xử lý các khả năng như vậy một cách tương thích (portably), chúng ta có thể sử dụng chỉ thị tiền xử lý C (C preprocessor) `#ifdef`, như trong ví dụ sau:

```c

## ifdef WCOREDUMP

/* Sử dụng macro WCOREDUMP() */

## endif

```

### Sự khác biệt về các tệp header bắt buộc giữa các bản cài đặt

Trong một số trường hợp, các tệp header (header files) cần thiết để khai báo nguyên mẫu (prototype) cho các System Call (system calls) và hàm thư viện (library functions) khác nhau giữa các bản cài đặt UNIX. Trong cuốn sách này, chúng tôi trình bày các yêu cầu trên Linux và lưu ý bất kỳ sự khác biệt nào so với SUSv3.

Một số bản tóm tắt hàm (function synopses) trong cuốn sách này hiển thị một tệp header cụ thể kèm theo chú thích `/* For portability */`. Điều này cho biết tệp header đó không bắt buộc phải có trên Linux hoặc theo tiêu chuẩn SUSv3, nhưng vì một số bản cài đặt khác (đặc biệt là các phiên bản cũ hơn) có thể yêu cầu, chúng ta nên bao gồm (include) nó trong các chương trình tương thích (portable programs).

> Đối với nhiều hàm do POSIX.1-1990 quy định, tiêu chuẩn này yêu cầu tệp header `<sys/types.h>` phải được bao gồm trước bất kỳ header nào khác liên quan đến hàm đó. Tuy nhiên, yêu cầu này là thừa thãi, bởi vì hầu hết các bản cài đặt UNIX hiện đại không bắt buộc các ứng dụng phải bao gồm tệp header này cho các hàm đó. Do đó, SUSv1 đã loại bỏ yêu cầu này. Mặc dù vậy, khi viết các chương trình tương thích (portable programs), việc đưa tệp header này thành một trong những header được bao gồm đầu tiên là một điều khôn ngoan. (Tuy nhiên, chúng tôi bỏ qua tệp header này trong các chương trình ví dụ của mình vì nó không bắt buộc trên Linux và việc lược bỏ nó giúp các chương trình ví dụ ngắn hơn một dòng).

## 3.7 Tóm tắt

System Call (system calls) cho phép các tiến trình (processes) yêu cầu các dịch vụ từ Kernel (kernel). Ngay cả những System Call đơn giản nhất cũng có chi phí đáng kể (overhead) khi so sánh với một lời gọi hàm ở User Space (user-space function call), vì hệ thống phải tạm thời chuyển sang Kernel Mode (kernel mode) để thực thi System Call đó, đồng thời Kernel phải xác thực các đối số của System Call và truyền dữ liệu giữa bộ nhớ người dùng (user memory) và bộ nhớ Kernel (kernel memory).

Thư viện C chuẩn (standard C library) cung cấp vô số hàm thư viện thực hiện một loạt các tác vụ. Một số hàm thư viện sử dụng System Call để thực hiện công việc của chúng; các hàm khác thực hiện tác vụ hoàn toàn bên trong User Space (user space). Trên Linux, bản cài đặt thư viện C chuẩn thông thường được sử dụng là `glibc`.

Hầu hết các System Call và hàm thư viện đều trả về một trạng thái (status) cho biết lời gọi đã thành công hay thất bại. Các giá trị trạng thái trả về như vậy phải luôn luôn được kiểm tra.

Chúng tôi đã giới thiệu một số hàm mà chúng tôi đã triển khai để sử dụng trong các chương trình ví dụ trong cuốn sách này. Các tác vụ được thực hiện bởi các hàm này bao gồm chẩn đoán lỗi (diagnosing errors) và phân tích cú pháp các đối số dòng lệnh (parsing command-line arguments).

Chúng tôi đã thảo luận về các nguyên tắc và kỹ thuật khác nhau có thể giúp chúng ta viết các chương trình hệ thống tương thích (portable system programs) chạy trên bất kỳ hệ thống tuân thủ tiêu chuẩn nào.

Khi biên dịch một ứng dụng, chúng ta có thể định nghĩa các macro kiểm tra tính năng (feature test macros) khác nhau nhằm kiểm soát các định nghĩa được hiển thị bởi các tệp header. Điều này rất hữu ích nếu chúng ta muốn đảm bảo rằng một chương trình tuân thủ một hoặc nhiều tiêu chuẩn chính thức hoặc do bản cài đặt quy định.

Chúng ta có thể cải thiện tính tương thích (portability) của các chương trình hệ thống bằng cách sử dụng các kiểu dữ liệu hệ thống (system data types) được định nghĩa trong các tiêu chuẩn khác nhau, thay vì các kiểu C nguyên thủy (native C types). SUSv3 quy định một phạm vi rộng lớn các kiểu dữ liệu hệ thống mà một bản cài đặt nên hỗ trợ và một ứng dụng nên sử dụng.

## 3.8 Bài tập

**3-1.** Khi sử dụng System Call (lệnh hệ thống) `reboot()` đặc thù của Linux để khởi động lại hệ thống, đối số thứ hai, `magic2`, phải được chỉ định bằng một trong số các số ma thuật (magic numbers) (ví dụ: `LINUX_REBOOT_MAGIC2`). Ý nghĩa của các con số này là gì? (Việc chuyển đổi chúng sang hệ thập lục phân [hexadecimal] sẽ cung cấp một manh mối).
