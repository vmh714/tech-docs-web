## Chương 4
# **FILE I/O: MÔ HÌNH I/O TỔNG QUÁT**

Bây giờ chúng ta sẽ bắt đầu đi sâu tìm hiểu về API System Call. Các tập tin (file) là một điểm khởi đầu tốt, vì chúng đóng vai trò cốt lõi trong triết lý của UNIX. Trọng tâm của chương này là các System Call được sử dụng để thực hiện việc nhập và xuất tập tin (file input and output).

Chúng ta sẽ giới thiệu khái niệm File Descriptor (mô tả tập tin), và sau đó xem xét các System Call tạo nên cái gọi là mô hình I/O tổng quát (universal I/O model). Đây là các System Call dùng để mở, đóng tập tin, cũng như đọc và ghi dữ liệu.

Chúng ta sẽ tập trung vào I/O trên các tập tin đĩa (disk file). Tuy nhiên, phần lớn nội dung được đề cập ở đây vẫn có liên quan cho các chương sau, bởi vì các System Call tương tự được sử dụng để thực hiện I/O trên tất cả các loại tập tin khác, chẳng hạn như pipe (đường ống) và terminal (thiết bị đầu cuối).

Chương [5](#page-68-0) sẽ mở rộng thảo luận trong chương này với các chi tiết sâu hơn về File I/O. Một khía cạnh khác của File I/O, đó là cơ chế đệm (buffering), đủ phức tạp để có một chương riêng. Chương 13 đề cập đến bộ đệm I/O trong Kernel (nhân hệ điều hành) và trong thư viện stdio.

## **4.1 Tổng quan**

Tất cả các System Call dùng để thực hiện I/O đều tham chiếu đến các tập tin đang mở thông qua một File Descriptor, đây là một số nguyên không âm (thường có giá trị nhỏ). File Descriptor được sử dụng để tham chiếu đến tất cả các loại tập tin đang mở, bao gồm pipe, FIFO, socket, terminal, các thiết bị (device) và tập tin thông thường (regular file). Mỗi Process (tiến trình) có tập hợp các File Descriptor của riêng mình.

Theo quy ước, hầu hết các chương trình đều mong đợi có thể sử dụng ba File Descriptor tiêu chuẩn được liệt kê trong [Bảng 4-1](#page-49-0). Ba Descriptor này được mở sẵn cho chương trình bởi Shell, trước khi chương trình được khởi động. Hoặc nói một cách chính xác hơn, chương trình kế thừa các bản sao của File Descriptor từ Shell, và Shell thường hoạt động với ba File Descriptor này luôn mở. (Trong một Shell tương tác, ba File Descriptor này thường tham chiếu đến terminal mà Shell đang chạy trên đó). Nếu việc chuyển hướng I/O (I/O redirection) được chỉ định trên dòng lệnh, thì Shell sẽ đảm bảo rằng các File Descriptor được chỉnh sửa phù hợp trước khi khởi động chương trình.

<span id="page-49-0"></span>**Bảng 4-1:** Các File Descriptor tiêu chuẩn

| File descriptor | Mục đích       | Tên POSIX     | Luồng stdio  |
|-----------------|-----------------|---------------|--------------|
| 0               | Đầu vào chuẩn   | STDIN_FILENO  | stdin        |
| 1               | Đầu ra chuẩn    | STDOUT_FILENO | stdout       |
| 2               | Lỗi chuẩn       | STDERR_FILENO | stderr       |

Khi tham chiếu đến các File Descriptor này trong chương trình, chúng ta có thể sử dụng các con số (0, 1 hoặc 2) hoặc, tốt hơn là sử dụng các tên chuẩn POSIX được định nghĩa trong `<unistd.h>`.

> Mặc dù các biến `stdin`, `stdout` và `stderr` ban đầu tham chiếu lần lượt đến đầu vào, đầu ra và lỗi chuẩn của tiến trình, chúng có thể được thay đổi để tham chiếu đến bất kỳ tập tin nào bằng cách sử dụng hàm thư viện `freopen()`. Là một phần trong quá trình hoạt động của mình, `freopen()` có thể thay đổi File Descriptor nằm bên dưới luồng được mở lại (reopened stream). Nói cách khác, sau khi gọi `freopen()` trên `stdout` chẳng hạn, việc giả định rằng File Descriptor bên dưới vẫn là 1 là không còn an toàn nữa.

Sau đây là bốn System Call cốt lõi để thực hiện File I/O (các ngôn ngữ lập trình và gói phần mềm thường chỉ sử dụng các lời gọi này một cách gián tiếp, thông qua các thư viện I/O):

- `fd = open(pathname, flags, mode)` mở tập tin được xác định bởi `pathname`, trả về một File Descriptor được dùng để tham chiếu đến tập tin đang mở trong các lời gọi tiếp theo. Nếu tập tin không tồn tại, `open()` có thể tạo mới nó, tùy thuộc vào cài đặt của tham số mặt nạ bit `flags`. Tham số `flags` cũng chỉ định liệu tập tin được mở để đọc, ghi, hay cả hai. Tham số `mode` chỉ định các quyền (permission) được thiết lập trên tập tin nếu nó được tạo bởi lời gọi này. Nếu lời gọi `open()` không được sử dụng để tạo tập tin, tham số này sẽ bị bỏ qua và có thể lược bỏ.
- `numread = read(fd, buffer, count)` đọc tối đa `count` byte từ tập tin đang mở được tham chiếu bởi `fd` và lưu trữ chúng vào `buffer`. Lời gọi `read()` trả về số lượng byte thực tế đã được đọc. Nếu không thể đọc thêm byte nào nữa (tức là đã gặp kết thúc tập tin - end-of-file), `read()` trả về 0.
- `numwritten = write(fd, buffer, count)` ghi tối đa `count` byte từ `buffer` vào tập tin đang mở được tham chiếu bởi `fd`. Lời gọi `write()` trả về số lượng byte thực tế đã được ghi, có thể nhỏ hơn `count`.
- `status = close(fd)` được gọi sau khi tất cả các thao tác I/O đã hoàn tất, nhằm giải phóng File Descriptor `fd` và các tài nguyên Kernel liên quan đến nó.

Trước khi đi sâu vào chi tiết của các System Call này, chúng ta sẽ cung cấp một ví dụ minh họa ngắn gọn về cách sử dụng chúng trong [Liệt kê 4-1](#page-50-0). Chương trình này là một phiên bản đơn giản của lệnh `cp(1)`. Nó sao chép nội dung của tập tin hiện có được đặt tên ở tham số dòng lệnh thứ nhất sang tập tin mới được đặt tên ở tham số dòng lệnh thứ hai.

Chúng ta có thể sử dụng chương trình trong [Liệt kê 4-1](#page-50-0) như sau:

#### \$ **./copy oldfile newfile**

#### <span id="page-50-0"></span>**Liệt kê 4-1:** Sử dụng các System Call I/O

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– fileio/copy.c
#include <sys/stat.h>
#include <fcntl.h>
#include "tlpi_hdr.h"
#ifndef BUF_SIZE /* Allow "cc -D" to override definition */
#define BUF_SIZE 1024
#endif
int
main(int argc, char *argv[])
{
 int inputFd, outputFd, openFlags;
 mode_t filePerms;
 ssize_t numRead;
 char buf[BUF_SIZE];
 if (argc != 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s old-file new-file\n", argv[0]);
 /* Open input and output files */
 inputFd = open(argv[1], O_RDONLY);
 if (inputFd == -1)
 errExit("opening file %s", argv[1]);
 openFlags = O_CREAT | O_WRONLY | O_TRUNC;
 filePerms = S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP |
 S_IROTH | S_IWOTH; /* rw-rw-rw- */
 outputFd = open(argv[2], openFlags, filePerms);
 if (outputFd == -1)
 errExit("opening file %s", argv[2]);
 /* Transfer data until we encounter end of input or an error */
 while ((numRead = read(inputFd, buf, BUF_SIZE)) > 0)
 if (write(outputFd, buf, numRead) != numRead)
 fatal("couldn't write whole buffer");
 if (numRead == -1)
 errExit("read");
 if (close(inputFd) == -1)
 errExit("close input");
 if (close(outputFd) == -1)
 errExit("close output");
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– fileio/copy.c
```

## **4.2 Tính vạn năng của I/O (Universality of I/O)**

Một trong những đặc điểm nổi bật của mô hình I/O trong UNIX là khái niệm tính vạn năng của I/O. Điều này có nghĩa là cùng một tập hợp bốn system call—`open()`, `read()`, `write()`, và `close()`—được sử dụng để thực hiện các thao tác I/O trên mọi loại file, bao gồm cả các thiết bị như terminal. Do đó, nếu chúng ta viết một chương trình chỉ sử dụng các system call này, chương trình đó sẽ hoạt động trên bất kỳ loại file nào. Ví dụ, các trường hợp sau đây đều là cách sử dụng hợp lệ của chương trình trong [Listing 4-1](#page-50-0):

```
$ ./copy test test.old Sao chép một file thông thường
$ ./copy a.txt /dev/tty Sao chép một file thông thường ra terminal này
$ ./copy /dev/tty b.txt Sao chép đầu vào từ terminal này vào một file thông thường
$ ./copy /dev/pts/16 /dev/tty Sao chép đầu vào từ một terminal khác
```

Tính vạn năng của I/O đạt được bằng cách đảm bảo rằng mỗi hệ thống file (file system) và trình điều khiển thiết bị (device driver) đều triển khai cùng một tập hợp các system call I/O. Vì các chi tiết cụ thể của hệ thống file hoặc thiết bị được xử lý bên trong kernel (Kernel Space), chúng ta thường có thể bỏ qua các yếu tố đặc thù của thiết bị khi viết các chương trình ứng dụng. Khi cần truy cập vào các tính năng cụ thể của một hệ thống file hoặc thiết bị, chương trình có thể sử dụng system call vạn năng `ioctl()` [\(Mục 4.8\)](#page-65-0), cung cấp một giao diện đến các tính năng nằm ngoài mô hình I/O thông thường.

# **4.3 Mở một File: open()**

System call `open()` dùng để mở một file đã tồn tại hoặc tạo và mở một file mới.

```
#include <sys/stat.h>
#include <fcntl.h>
int open(const char *pathname, int flags, ... /* mode_t mode */);
                               Trả về file descriptor khi thành công, hoặc –1 khi lỗi
```

File cần mở được xác định thông qua tham số `pathname`. Nếu `pathname` là một symbolic link, nó sẽ được giải tham chiếu (dereference). Khi thành công, `open()` trả về một `file descriptor` được dùng để tham chiếu đến file trong các system call tiếp theo. Nếu xảy ra lỗi, `open()` trả về –1 và `errno` được thiết lập tương ứng.

Tham số `flags` là một mặt nạ bit (bit mask) chỉ định chế độ truy cập cho file, sử dụng một trong các hằng số được hiển thị trong [Bảng 4-2.](#page-52-0)

> Các phiên bản UNIX thời kỳ đầu sử dụng các số 0, 1 và 2 thay vì các tên được hiển thị trong Bảng [4-2](#page-52-0). Hầu hết các phiên bản UNIX hiện đại đều định nghĩa các hằng số này mang các giá trị đó. Do đó, chúng ta có thể thấy rằng `O_RDWR` không tương đương với `O_RDONLY | O_WRONLY`; sự kết hợp sau là một lỗi logic.

Khi `open()` được sử dụng để tạo một file mới, tham số mặt nạ bit `mode` sẽ chỉ định các quyền hạn (permissions) được gán cho file đó. (Kiểu dữ liệu `mode_t` dùng để định kiểu cho `mode` là một kiểu số nguyên được quy định trong SUSv3). Nếu lời gọi `open()` không chỉ định `O_CREAT`, tham số `mode` có thể được bỏ qua.

<span id="page-52-0"></span>**Bảng 4-2:** Các chế độ truy cập file (File access modes)

| Chế độ truy cập | Mô tả                                    |
|-----------------|------------------------------------------|
| O_RDONLY        | Chỉ mở file để đọc                       |
| O_WRONLY        | Chỉ mở file để ghi                       |
| O_RDWR          | Mở file để cả đọc và ghi                 |

Chúng ta sẽ mô tả chi tiết về quyền hạn của file trong Mục 15.4. Sau này, chúng ta sẽ thấy rằng các quyền thực tế được gán cho một file mới không chỉ phụ thuộc vào tham số `mode`, mà còn phụ thuộc vào `umask` của tiến trình (process) (Mục 15.4.6) và danh sách kiểm soát truy cập mặc định (default access control list) (nếu có) của thư mục cha (Mục 17.6). Trong lúc này, chúng ta chỉ cần lưu ý rằng tham số `mode` có thể được chỉ định dưới dạng một số (thường là hệ bát phân - octal) hoặc, tốt hơn là, bằng cách kết hợp phép toán OR (|) với không hoặc nhiều hằng số mặt nạ bit được liệt kê trong Bảng 15-4 ở trang 295.

[Listing 4-2](#page-52-1) minh họa các ví dụ về việc sử dụng `open()`, trong đó một số ví dụ sử dụng thêm các bit cờ (flag bits) mà chúng ta sẽ mô tả ngay sau đây.
```

<span id="page-52-1"></span>**Listing 4-2:** Các ví dụ về việc sử dụng hàm open()

```
 /* Mở tệp tin hiện có để đọc */
 fd = open("startup", O_RDONLY);
 if (fd == -1)
 errExit("open");
   /* Mở tệp tin mới hoặc tệp tin hiện có để đọc và ghi, cắt ngắn (truncate) về 0 
      byte; quyền của tệp tin là đọc + ghi đối với chủ sở hữu (owner), không có quyền đối với tất cả các người dùng khác */
 fd = open("myfile", O_RDWR | O_CREAT | O_TRUNC, S_IRUSR | S_IWUSR);
 if (fd == -1)
 errExit("open");
 /* Mở tệp tin mới hoặc tệp tin hiện có để ghi; các thao tác ghi phải luôn luôn
 thêm vào cuối tệp tin (append) */
 fd = open("w.log", O_WRONLY | O_CREAT | O_TRUNC | O_APPEND,
 S_IRUSR | S_IWUSR);
 if (fd == -1)
 errExit("open");
```

#### **Số hiệu File Descriptor do open() trả về**

Tiêu chuẩn SUSv3 quy định rằng nếu hàm open() thành công, nó được đảm bảo sử dụng file descriptor chưa được sử dụng có số hiệu nhỏ nhất cho tiến trình (process). Chúng ta có thể tận dụng tính năng này để đảm bảo rằng một tệp tin được mở bằng một file descriptor cụ thể. Ví dụ, chuỗi lệnh sau đảm bảo rằng một tệp tin được mở bằng luồng đầu vào chuẩn (standard input - file descriptor 0).

```
if (close(STDIN_FILENO) == -1) /* Đóng file descriptor 0 */
 errExit("close");
fd = open(pathname, O_RDONLY);
if (fd == -1)
 errExit("open");
```

Vì file descriptor 0 chưa được sử dụng, hàm open() được đảm bảo sẽ mở tệp tin bằng descriptor đó. Trong [Mục 5.5](#page-75-0), chúng ta sẽ xem xét việc sử dụng các hàm dup2() và fcntl() để đạt được kết quả tương tự, nhưng với khả năng kiểm soát linh hoạt hơn đối với file descriptor được sử dụng. Trong mục đó, chúng ta cũng chỉ ra một ví dụ về lý do tại sao việc kiểm soát file descriptor mà một tệp tin được mở lên lại hữu ích.

## **4.3.1 Đối số flags của open()**

<span id="page-53-0"></span>Trong một số lời gọi open() mẫu được trình bày ở [Listing 4-2,](#page-52-1) chúng ta đã bao gồm các bit khác (O\_CREAT, O\_TRUNC, và O\_APPEND) trong tham số `flags` bên cạnh chế độ truy cập tệp tin (file access mode). Bây giờ chúng ta sẽ xem xét đối số `flags` chi tiết hơn. Bảng 4-3 tóm tắt toàn bộ tập hợp các hằng số có thể được kết hợp bằng phép toán OR theo từng bit (|) trong đối số `flags`. Cột cuối cùng cho biết những hằng số nào được chuẩn hóa trong SUSv3 hoặc SUSv4.

**Bảng 4-3:** Các giá trị cho đối số flags của open()

| Cờ (Flag)   | Mục đích                                                         | SUS? |
|-------------|------------------------------------------------------------------|------|
| O_RDONLY    | Chỉ mở để đọc                                                    | v3   |
| O_WRONLY    | Chỉ mở để ghi                                                    | v3   |
| O_RDWR      | Mở để đọc và ghi                                                 | v3   |
| O_CLOEXEC   | Thiết lập cờ close-on-exec (từ Linux 2.6.23)                     | v4   |
| O_CREAT     | Tạo tệp tin nếu nó chưa tồn tại                                  | v3   |
| O_DIRECT    | I/O tệp tin bỏ qua bộ nhớ đệm buffer cache                       |      |
| O_DIRECTORY | Thất bại nếu đường dẫn (pathname) không phải là thư mục          | v4   |
| O_EXCL      | Dùng với O_CREAT: tạo tệp tin độc quyền (exclusive)              | v3   |
| O_LARGEFILE | Được sử dụng trên hệ thống 32-bit để mở các tệp tin lớn          |      |
| O_NOATIME   | Không cập nhật thời gian truy cập tệp lần cuối khi gọi read() (từ Linux 2.6.8) |      |
| O_NOCTTY    | Không cho phép đường dẫn trở thành terminal điều khiển (controlling terminal) | v3   |
| O_NOFOLLOW  | Không giải tham chiếu liên kết tượng trưng (symbolic link)       | v4   |
| O_TRUNC     | Cắt ngắn tệp tin hiện có về độ dài bằng không                    | v3   |
| O_APPEND    | Các thao tác ghi luôn được nối vào cuối tệp tin                  | v3   |
| O_ASYNC     | Tạo ra một tín hiệu (signal) khi I/O khả dụng                    |      |
| O_DSYNC     | Cung cấp tính toàn vẹn dữ liệu I/O đồng bộ (từ Linux 2.6.33)     | v3   |
| O_NONBLOCK  | Mở ở chế độ phi chặn (nonblocking mode)                          | v3   |
| O_SYNC      | Làm cho các thao tác ghi tệp mang tính đồng bộ                   | v3   |

Các hằng số trong Bảng 4-3 được chia thành các nhóm sau:

-  Các cờ chế độ truy cập tệp tin (File access mode flags): Đây là các cờ O\_RDONLY, O\_WRONLY, và O\_RDWR được mô tả trước đó. Chúng có thể được truy xuất bằng thao tác fcntl() F\_GETFL [\(Mục 5.3](#page-72-0)).
-  Các cờ tạo tệp tin (File creation flags): Đây là các cờ được hiển thị ở phần thứ hai của Bảng 4-3. Chúng kiểm soát các khía cạnh khác nhau trong hành vi của lời gọi open(), cũng như các tùy chọn cho các thao tác I/O tiếp theo. Các cờ này không thể được truy xuất hoặc thay đổi.
-  Các cờ trạng thái tệp tin mở (Open file status flags): Đây là các cờ còn lại trong Bảng 4-3. Chúng có thể được truy xuất và sửa đổi bằng cách sử dụng các thao tác fcntl() F\_GETFL và F\_SETFL ([Mục](#page-72-0)[ 5.3](#page-72-0)). Các cờ này đôi khi được gọi đơn giản là cờ trạng thái tệp tin (file status flags).

Từ phiên bản kernel 2.6.22, các tệp tin đặc thù của Linux trong thư mục `/proc/PID/fdinfo` có thể được đọc để lấy thông tin về các file descriptor của bất kỳ tiến trình nào trên hệ thống. Có một tệp tin trong thư mục này tương ứng với mỗi file descriptor đang mở của tiến trình, với tên khớp với số hiệu của descriptor đó. Trường `pos` trong tệp tin này cho biết offset hiện tại của tệp tin ([Mục 4.7](#page-60-1)). Trường `flags` là một số hệ bát phân (octal) thể hiện các cờ chế độ truy cập tệp tin và cờ trạng thái tệp tin mở. (Để giải mã số này, chúng ta cần xem xét các giá trị số của các cờ này trong các tệp tiêu đề (header files) của thư viện C).

Chi tiết về các hằng số cờ (flag constants) như sau:

#### O\_APPEND

Các thao tác ghi (writes) luôn được nối vào cuối tệp (file). Chúng ta thảo luận về ý nghĩa của cờ này trong [Mục 5.1.](#page-69-0)

#### O\_ASYNC

Tạo ra một tín hiệu (signal) khi I/O khả dụng trên File Descriptor (mô tả tệp) do hàm open() trả về. Tính năng này, được gọi là I/O điều khiển bằng tín hiệu (signal-driven I/O), chỉ khả dụng đối với một số loại tệp nhất định, chẳng hạn như terminal, FIFO và socket. (Cờ O\_ASYNC không được quy định trong SUSv3; tuy nhiên, nó hoặc từ đồng nghĩa cũ hơn là FASYNC có thể được tìm thấy trên hầu hết các bản cài đặt UNIX). Trên Linux, việc chỉ định cờ O\_ASYNC khi gọi open() không có tác dụng. Để bật I/O điều khiển bằng tín hiệu, thay vào đó, chúng ta phải thiết lập cờ này bằng cách sử dụng thao tác fcntl() F\_SETFL [\(Mục 5.3](#page-72-0)). (Một số bản cài đặt UNIX khác cũng hoạt động tương tự). Tham khảo Mục 63.3 để biết thêm thông tin về cờ O\_ASYNC.

#### O\_CLOEXEC (từ Linux 2.6.23)

Bật cờ đóng khi thực thi (close-on-exec flag) (`FD_CLOEXEC`) cho File Descriptor mới. Chúng ta mô tả cờ FD\_CLOEXEC trong Mục 27.4. Việc sử dụng cờ O\_CLOEXEC cho phép một chương trình tránh được các thao tác fcntl() F\_SETFD và F\_SETFD bổ sung để thiết lập cờ close-on-exec. Nó cũng cần thiết trong các chương trình đa luồng (multithreaded programs) nhằm tránh tình trạng điều kiện tranh chấp (race condition) có thể xảy ra khi sử dụng kỹ thuật sau. Những hiện tượng tranh chấp này có thể xảy ra khi một Thread (luồng) mở một File Descriptor và sau đó cố gắng đánh dấu nó là close-on-exec cùng lúc với một Thread khác thực hiện gọi `fork()` và sau đó là `exec()` một chương trình tùy ý. (Giả sử rằng Thread thứ hai quản lý để thực hiện cả `fork()` và `exec()` trong khoảng thời gian giữa lúc Thread thứ nhất mở File Descriptor và sử dụng fcntl() để thiết lập cờ close-on-exec). Những trường hợp tranh chấp như vậy có thể dẫn đến việc các File Descriptor mở bị truyền vô tình cho các chương trình không an toàn. (Chúng ta sẽ nói nhiều hơn về tình trạng điều kiện tranh chấp trong [Mục 5.1](#page-69-0)).

#### O\_CREAT

Nếu tệp chưa tồn tại, nó sẽ được tạo mới như một tệp trống. Cờ này có hiệu lực ngay cả khi tệp chỉ được mở để đọc. Nếu chúng ta chỉ định O\_CREAT, thì chúng ta phải cung cấp một đối số `mode` trong lệnh gọi open(); nếu không, quyền (permissions) của tệp mới sẽ được thiết lập thành một giá trị ngẫu nhiên nào đó từ stack.

#### O\_NOATIME (từ Linux 2.6.8)

Không cập nhật thời gian truy cập tệp lần cuối (trường `st_atime` được mô tả trong Mục 15.1) khi đọc từ tệp này. Để sử dụng cờ này, Effective User ID (ID người dùng hiệu dụng) của Process (tiến trình) gọi phải khớp với chủ sở hữu của tệp, hoặc tiến trình đó phải có đặc quyền (`CAP_FOWNER`); nếu không, hàm open() sẽ thất bại với lỗi EPERM. (Trên thực tế, đối với một tiến trình không có đặc quyền, File-system User ID của tiến trình đó, chứ không phải Effective User ID của nó, mới là thứ phải khớp với User ID của tệp khi mở tệp với cờ O\_NOATIME, như được mô tả trong Mục 9.5). Cờ này là một phần mở rộng không chuẩn của Linux. Để hiển thị định nghĩa của nó từ `<fcntl.h>`, chúng ta phải định nghĩa macro kiểm tra tính năng `_GNU_SOURCE`. Cờ O\_NOATIME nhằm mục đích sử dụng bởi các chương trình lập chỉ mục (indexing) và sao lưu (backup). Việc sử dụng nó có thể làm giảm đáng kể lượng hoạt động của đĩa, bởi vì các thao tác tìm kiếm đĩa (disk seeks) lặp đi lặp lại qua lại trên đĩa là không cần thiết để đọc nội dung của một tệp và cập nhật thời gian truy cập lần cuối trong i-node của tệp (Mục 14.4). Tính năng tương tự như O\_NOATIME có thể sử dụng thông qua cờ `MS_NOATIME` của `mount()` (Mục 14.8.1) và cờ `FS_NOATIME_FL` (Mục 15.5).

#### O\_DIRECT

Cho phép I/O tệp bỏ qua bộ đệm bộ đệm (buffer cache). Tính năng này được mô tả trong Mục 13.6. Macro kiểm tra tính năng `_GNU_SOURCE` phải được định nghĩa để làm cho định nghĩa hằng số này có sẵn từ `<fcntl.h>`.

#### O\_DIRECTORY

Trả về một lỗi (`errno` bằng ENOTDIR) nếu đường dẫn (pathname) không phải là một thư mục. Cờ này là một phần mở rộng được thiết kế riêng để thực thi `opendir()` (Mục 18.8). Macro kiểm tra tính năng `_GNU_SOURCE` phải được định nghĩa để làm cho định nghĩa hằng số này có sẵn từ `<fcntl.h>`.

#### O\_DSYNC (từ Linux 2.6.33)

Thực hiện việc ghi tệp theo các yêu cầu về hoàn tất tính toàn vẹn dữ liệu I/O đồng bộ hóa (synchronized I/O data integrity completion). Xem phần thảo luận về bộ đệm I/O của Kernel trong Mục 13.3.

#### O\_EXCL

Cờ này được sử dụng kết hợp với O\_CREAT để chỉ ra rằng nếu tệp đã tồn tại, nó không được mở; thay vào đó, open() phải thất bại, với `errno` được đặt thành EEXIST. Nói cách khác, cờ này cho phép người gọi đảm bảo rằng chính Process của họ là tiến trình tạo ra tệp. Việc kiểm tra sự tồn tại và việc tạo tệp được thực hiện một cách nguyên tử (atomically). Chúng ta thảo luận về khái niệm tính nguyên tử (atomicity) trong [Mục 5.1](#page-69-0). Khi cả O\_CREAT và O\_EXCL đều được chỉ định trong `flags`, hàm open() sẽ thất bại (với lỗi EEXIST) nếu pathname là một symbolic link (liên kết tượng trưng). SUSv3 yêu cầu hành vi này để một ứng dụng có đặc quyền có thể tạo một tệp ở một vị trí đã biết mà không có khả năng symbolic link sẽ khiến tệp được tạo ở một vị trí khác (ví dụ: thư mục hệ thống), điều này có thể gây ra các vấn đề về bảo mật.

#### O\_LARGEFILE

Mở tệp với hỗ trợ tệp lớn (large file support). Cờ này được sử dụng trên các hệ thống 32-bit nhằm làm việc với các tệp lớn. Mặc dù không được quy định trong SUSv3, cờ O\_LARGEFILE vẫn được tìm thấy trên một số bản cài đặt UNIX khác. Trên các bản cài đặt Linux 64-bit như Alpha và IA-64, cờ này không có tác dụng. Xem [Mục 5.10](#page-83-0) để biết thêm thông tin.

#### O\_NOCTTY

Nếu tệp được mở là một thiết bị terminal, hãy ngăn chặn việc nó trở thành terminal điều khiển (controlling terminal). Terminal điều khiển được thảo luận trong Mục 34.4. Nếu tệp được mở không phải là terminal, cờ này không có tác dụng.

#### O\_NOFOLLOW

Thông thường, hàm open() thực hiện giải tham chiếu (dereference) `pathname` nếu nó là một liên kết tượng trưng (symbolic link). Tuy nhiên, nếu cờ O\_NOFOLLOW được chỉ định, thì open() sẽ thất bại (với `errno` được thiết lập thành `ELOOP`) nếu `pathname` là một liên kết tượng trưng. Cờ này rất hữu ích, đặc biệt trong các chương trình có đặc quyền (privileged programs), nhằm đảm bảo rằng open() không giải tham chiếu liên kết tượng trưng. Để hiển thị định nghĩa của cờ này từ `<fcntl.h>`, chúng ta phải định nghĩa macro kiểm tra tính năng `_GNU_SOURCE`.

#### O\_NONBLOCK

Mở tệp ở chế độ không chặn (nonblocking mode). Xem [Mục 5.9](#page-82-0).

#### O\_SYNC

Mở tệp để I/O đồng bộ (synchronous I/O). Xem phần thảo luận về bộ đệm I/O của kernel (kernel I/O buffering) trong Mục 13.3.

#### O\_TRUNC

Nếu tệp đã tồn tại và là một tệp thông thường (regular file), thì hãy cắt ngắn (truncate) nó về độ dài bằng không, làm mất toàn bộ dữ liệu hiện có. Trên Linux, việc cắt ngắn diễn ra bất kể tệp được mở để đọc hay viết (trong cả hai trường hợp, chúng ta phải có quyền ghi trên tệp). Chuẩn SUSv3 không quy định rõ sự kết hợp giữa `O_RDONLY` và `O_TRUNC`, nhưng hầu hết các cài đặt UNIX khác đều hoạt động giống như Linux.

## **4.3.2 Các lỗi từ open()**

Nếu xảy ra lỗi trong quá trình cố gắng mở tệp, open() sẽ trả về –1 và `errno` sẽ xác định nguyên nhân gây ra lỗi. Dưới đây là một số lỗi có thể xảy ra (ngoài những lỗi đã được lưu ý khi mô tả đối số `flags` ở trên):

#### EACCES

Quyền hạn của tệp không cho phép tiến trình gọi (calling process) mở tệp theo chế độ được chỉ định bởi `flags`. Ngoài ra, do quyền của thư mục, tệp có thể không được truy cập, hoặc tệp không tồn tại và không thể tạo mới.

EISDIR

Tệp được chỉ định là một thư mục và trình gọi đã cố gắng mở nó để ghi. Hành động này không được phép. (Mặt khác, có những trường hợp việc mở một thư mục để đọc lại hữu ích. Chúng ta sẽ xem xét một ví dụ trong Mục 18.11).

EMFILE

Giới hạn tài nguyên của tiến trình đối với số lượng mô-đun mô tả tệp đang mở (file descriptor) đã đạt tới mức tối đa (`RLIMIT_NOFILE`, được mô tả trong Mục 36.3).

ENFILE

Giới hạn trên toàn hệ thống (system-wide limit) đối với số lượng tệp đang mở đã đạt tới mức tối đa.

ENOENT

Tệp được chỉ định không tồn tại và `O_CREAT` không được chỉ định, hoặc `O_CREAT` được chỉ định nhưng một trong các thư mục trong `pathname` không tồn tại hoặc là một liên kết tượng trưng trỏ tới một đường dẫn không tồn tại (liên kết mồ côi - dangling link).

EROFS

Tệp được chỉ định nằm trên một hệ thống tệp chỉ đọc (read-only file system) và trình gọi đã cố gắng mở nó để ghi.

ETXTBSY

Tệp được chỉ định là một tệp thực thi (chương trình) hiện đang chạy. Không cho phép sửa đổi (tức là mở để ghi) tệp thực thi liên kết với một chương trình đang chạy. (Chúng ta phải chấm dứt chương trình trước để có thể sửa đổi tệp thực thi đó).

Khi sau này chúng ta mô tả các System Call (lời gọi hệ thống) hoặc hàm thư viện khác, chúng ta thường sẽ không liệt kê toàn bộ các lỗi có thể xảy ra theo cách trên. (Danh sách đó có thể được tìm thấy trong trang hướng dẫn (manual page) tương ứng cho từng System Call hoặc hàm thư viện). Chúng ta làm vậy ở đây vì hai lý do. Một là open() là System Call đầu tiên mà chúng ta mô tả chi tiết, và danh sách trên minh họa rằng một System Call hoặc hàm thư viện có thể thất bại vì một số lý do nào đó. Thứ hai, các lý do cụ thể khiến open() có thể thất bại tự chúng là một danh sách thú vị, minh họa một số yếu tố và cơ chế kiểm tra được kích hoạt khi một tệp được truy cập. (Danh sách trên chưa đầy đủ: hãy xem trang man open(2) để biết thêm các lý do khiến open() có thể thất bại).

# **4.3.3 System Call creat()**

Trong các bản cài đặt UNIX thời kỳ đầu, open() chỉ có hai đối số và không thể được sử dụng để tạo tệp mới. Thay vào đó, System Call creat() được sử dụng để tạo và mở một tệp mới.

```
#include <fcntl.h>
int creat(const char *pathname, mode_t mode);
                                          Trả về file descriptor, hoặc –1 nếu lỗi
```

System Call creat() tạo và mở một tệp mới với `pathname` đã cho, hoặc nếu tệp đã tồn tại, sẽ mở tệp đó và cắt ngắn về độ dài bằng không. Là kết quả trả về của hàm, creat() trả về một file descriptor có thể được sử dụng trong các System Call tiếp theo. Việc gọi creat() tương đương với lời gọi open() sau đây:

```
fd = open(pathname, O_WRONLY | O_CREAT | O_TRUNC, mode);
```

Vì đối số `flags` của open() cung cấp khả năng kiểm soát lớn hơn đối với cách tệp được mở (ví dụ: chúng ta có thể chỉ định `O_RDWR` thay vì `O_WRONLY`), creat() hiện nay đã lỗi thời (obsolete), mặc dù nó vẫn có thể xuất hiện trong các chương trình cũ.

# **4.4 Đọc từ một Tệp: read()**

System Call read() đọc dữ liệu từ tệp đang mở được trỏ bởi file descriptor `fd`.

```
#include <unistd.h>
ssize_t read(int fd, void *buffer, size_t count);
                        Trả về số byte đã đọc, 0 khi gặp EOF, hoặc –1 nếu lỗi
```

Đối số `count` chỉ định số lượng byte tối đa cần đọc. (Kiểu dữ liệu `size_t` là một kiểu số nguyên không dấu). Đối số `buffer` cung cấp địa chỉ của vùng đệm bộ nhớ (memory buffer) nơi dữ liệu đầu vào sẽ được đặt vào. Vùng đệm này phải có kích thước ít nhất là `count` byte.

> Các System Call (lời gọi hệ thống) không cấp phát bộ nhớ cho các vùng đệm được sử dụng để trả về thông tin cho tiến trình gọi. Thay vào đó, chúng ta phải truyền một con trỏ (pointer) trỏ đến một vùng đệm bộ nhớ đã được cấp phát trước với kích thước chính xác. Điều này trái ngược với một số hàm thư viện vốn tự cấp phát các vùng đệm bộ nhớ để trả về thông tin cho tiến trình gọi.

Một lời gọi `read()` thành công sẽ trả về số lượng byte thực sự được đọc, hoặc trả về 0 nếu gặp phải kết thúc tệp (end-of-file). Khi có lỗi, giá trị thông thường –1 sẽ được trả về. Kiểu dữ liệu `ssize_t` là một kiểu số nguyên có dấu được sử dụng để lưu trữ số lượng byte hoặc giá trị –1 biểu thị lỗi.

Một lời gọi `read()` có thể đọc số lượng byte ít hơn số lượng được yêu cầu. Đối với một tệp thông thường (regular file), lý do khả dĩ cho việc này là chúng ta đang ở gần cuối tệp.

Khi `read()` được áp dụng cho các loại tệp khác—như pipe, FIFO, socket hoặc terminal—cũng có nhiều trường hợp khác nhau mà nó có thể đọc ít byte hơn số lượng được yêu cầu. Ví dụ, theo mặc định, một thao tác đọc (`read()`) từ terminal chỉ đọc các ký tự cho đến ký tự xuống dòng (`\n`) tiếp theo. Chúng ta sẽ xem xét các trường hợp này khi đề cập đến các loại tệp khác trong các chương tiếp theo.

Sử dụng `read()` để nhập một chuỗi ký tự từ, giả sử là một terminal, chúng ta có thể mong đợi đoạn mã sau hoạt động:

```
#define MAX_READ 20
char buffer[MAX_READ];
if (read(STDIN_FILENO, buffer, MAX_READ) == -1)
 errExit("read");
printf("The input data was: %s\n", buffer);
```

Đầu ra từ đoạn mã này có thể sẽ kỳ lạ, vì nó có thể bao gồm các ký tự bổ sung ngoài chuỗi thực sự được nhập. Điều này là do `read()` không đặt một byte null kết thúc ở cuối chuỗi mà `printf()` được yêu cầu in. Suy ngẫm một chút, chúng ta nhận ra điều này là tất yếu, vì `read()` có thể được sử dụng để đọc bất kỳ chuỗi byte nào từ một tệp. Trong một số trường hợp, dữ liệu đầu vào này có thể là văn bản, nhưng trong các trường hợp khác, đầu vào có thể là các số nguyên nhị phân hoặc cấu trúc C dưới dạng nhị phân. Không có cách nào để `read()` phân biệt được sự khác biệt đó, và do đó nó không thể tuân theo quy ước của ngôn ngữ C về việc kết thúc chuỗi ký tự bằng ký tự null. Nếu một byte null kết thúc là bắt buộc ở cuối vùng đệm đầu vào, chúng ta phải tự đặt nó vào một cách tường minh:

```
char buffer[MAX_READ + 1];
ssize_t numRead;
numRead = read(STDIN_FILENO, buffer, MAX_READ);
if (numRead == -1)
 errExit("read");
buffer[numRead] = '\0';
printf("The input data was: %s\n", buffer);
```

Vì byte null kết thúc chiếm một byte bộ nhớ, kích thước của `buffer` phải lớn hơn ít nhất một đơn vị so với chuỗi dài nhất mà chúng ta dự kiến đọc.

# **4.5 Ghi vào một Tệp: write()**

System call `write()` ghi dữ liệu vào một tệp đang mở.

```
#include <unistd.h>
ssize_t write(int fd, void *buffer, size_t count);
                                Trả về số byte đã ghi, hoặc –1 nếu có lỗi
```

Các đối số của `write()` tương tự như các đối số của `read()`: `buffer` là địa chỉ của dữ liệu cần ghi; `count` là số lượng byte cần ghi từ `buffer`; và `fd` là một File Descriptor (mô tả tệp) tham chiếu đến tệp mà dữ liệu sẽ được ghi vào đó.

Khi thành công, `write()` trả về số lượng byte thực sự được ghi; giá trị này có thể nhỏ hơn `count`. Đối với một tệp trên đĩa (disk file), các nguyên nhân khả dĩ dẫn đến việc ghi một phần (partial write) như vậy là đĩa đã đầy hoặc tiến trình đã đạt đến giới hạn tài nguyên (resource limit) về kích thước tệp. (Giới hạn liên quan là `RLIMIT_FSIZE`, được mô tả trong Mục 36.3).

Khi thực hiện I/O trên một tệp đĩa, việc trả về thành công từ `write()` không đảm bảo rằng dữ liệu đã được truyền xuống đĩa, bởi vì kernel thực hiện việc đệm (buffering) I/O đĩa nhằm giảm thiểu hoạt động của đĩa và đẩy nhanh các lời gọi `write()`. Chúng ta sẽ xem xét các chi tiết này trong Chương 13.

# **4.6 Đóng một Tệp: close()**

System call `close()` đóng một File Descriptor đang mở, giải phóng nó để tiến trình có thể tái sử dụng cho các mục đích sau này. Khi một tiến trình kết thúc, tất cả các File Descriptor đang mở của nó sẽ tự động được đóng lại.

```
#include <unistd.h>
int close(int fd);
                                              Trả về 0 khi thành công, hoặc –1 nếu có lỗi
```

Thường thì việc đóng các File Descriptor không cần thiết một cách tường minh là một thực hành tốt (good practice), vì điều này giúp mã nguồn của chúng ta dễ đọc hơn và đáng tin cậy hơn trước các chỉnh sửa sau này. Hơn nữa, File Descriptor là một tài nguyên có giới hạn (consumable resource), vì vậy việc không đóng File Descriptor có thể dẫn đến việc tiến trình bị cạn kiệt các bộ mô tả. Đây là một vấn đề đặc biệt quan trọng khi viết các chương trình chạy dài hạn (long-lived programs) xử lý nhiều tệp, chẳng hạn như shell hoặc các máy chủ mạng (network server).

Giống như mọi System Call khác, một lời gọi `close()` nên được đặt trong khung kiểm tra lỗi, chẳng hạn như đoạn mã sau:

```
if (close(fd) == -1)
 errExit("close");
```

Điều này giúp bắt các lỗi như cố gắng đóng một File Descriptor chưa được mở hoặc đóng cùng một File Descriptor hai lần, đồng thời bắt các điều kiện lỗi mà một hệ thống tệp (file system) cụ thể có thể chẩn đoán trong quá trình thao tác đóng.

> NFS (Network File System) cung cấp một ví dụ về lỗi đặc trưng cho hệ thống tệp. Nếu xảy ra lỗi commit NFS, có nghĩa là dữ liệu không đến được đĩa từ xa (remote disk), thì lỗi này sẽ được truyền (propagate) lên ứng dụng như một thất bại trong lời gọi `close()`.

## <span id="page-60-1"></span>**4.7 Thay đổi vị trí con trỏ tệp: lseek()**

<span id="page-60-0"></span>Đối với mỗi tệp đang mở (open file), kernel ghi lại một vị trí con trỏ tệp (file offset), đôi khi cũng được gọi là vị trí đọc/ghi hoặc con trỏ đọc/ghi. Đây là vị trí trong tệp mà thao tác `read()` hoặc `write()` tiếp theo sẽ bắt đầu. Vị trí con trỏ tệp được thể hiện dưới dạng một vị trí byte thứ tự (ordinal byte position) tính từ điểm bắt đầu của tệp. Byte đầu tiên của tệp nằm ở offset 0.

Vị trí con trỏ tệp được thiết lập trỏ đến đầu tệp khi tệp được mở và tự động được điều chỉnh bởi mỗi lời gọi tiếp theo đến `read()` hoặc `write()` sao cho nó trỏ đến byte tiếp theo của tệp sau byte (hoặc các byte) vừa được đọc hoặc ghi. Do đó, các lời gọi `read()` và `write()` tuần tự tiến triển xuyên suốt một tệp.

System Call `lseek()` điều chỉnh vị trí con trỏ tệp của tệp đang mở được tham chiếu bởi File Descriptor `fd`, theo các giá trị được chỉ định trong `offset` và `whence`.

```c
#include <unistd.h>
off_t lseek(int fd, off_t offset, int whence);
                               Trả về vị trí con trỏ tệp mới nếu thành công, hoặc –1 nếu có lỗi
```

Tham số `offset` chỉ định một giá trị tính bằng byte. (Kiểu dữ liệu `off_t` là một kiểu số nguyên có dấu được quy định bởi SUSv3.) Tham số `whence` biểu thị điểm cơ sở từ đó `offset` sẽ được thông dịch, và nhận một trong các giá trị sau:

`SEEK_SET`

Vị trí con trỏ tệp được đặt cách điểm bắt đầu của tệp một khoảng bằng `offset` byte.

`SEEK_CUR`

Vị trí con trỏ tệp được điều chỉnh một khoảng `offset` byte tương đối so với vị trí con trỏ tệp hiện tại.

`SEEK_END`

Vị trí con trỏ tệp được đặt bằng kích thước của tệp cộng với `offset`. Nói cách khác, `offset` được hiểu tính từ byte tiếp theo sau byte cuối cùng của tệp.

Hình 4-1 minh họa cách tham số `whence` được thông dịch.

Trong các cài đặt UNIX trước đây, các số nguyên 0, 1 và 2 được sử dụng thay vì các hằng số `SEEK_*` được hiển thị trong văn bản chính. Các phiên bản BSD cũ hơn đã sử dụng các tên khác nhau cho các giá trị này: `L_SET`, `L_INCR` và `L_XTND`.

```txt
                      Tệp chứa N byte dữ liệu
        <-------------------------------------------------------->

số byte      0     1     ...     ...     N-2     N-1     N     N+1
           +-----+-----+-----+-----+-----+-----+-----+-----+-----+
           |  0  |  1  | ... | ... | N-2 | N-1 |     |     |     |
           +-----+-----+-----+-----+-----+-----+-----+-----+-----+
                                                  ^     ^
                                                  |     |
                                           Các byte chưa ghi
                                               sau EOF

                              ^
                              |
                       Vị trí con trỏ tệp hiện tại
```

**Hình 4-1:** Thông dịch tham số `whence` của `lseek()`

Nếu `whence` là `SEEK_CUR` hoặc `SEEK_END`, `offset` có thể là âm hoặc dương; đối với `SEEK_SET`, `offset` phải là số không âm.

Giá trị trả về từ một lời gọi `lseek()` thành công là vị trí con trỏ tệp mới. Lời gọi sau đây truy xuất vị trí hiện tại của con trỏ tệp mà không làm thay đổi nó:

```c
curr = lseek(fd, 0, SEEK_CUR);
```

Một số cài đặt UNIX (nhưng không phải Linux) có hàm `tell(fd)` không chuẩn, phục vụ cùng mục đích như lời gọi `lseek()` ở trên.

Dưới đây là một số ví dụ khác về các lời gọi `lseek()`, cùng với các chú thích cho biết vị trí con trỏ tệp được chuyển đến đâu:

```c
lseek(fd, 0, SEEK_SET); /* Đầu tệp */
lseek(fd, 0, SEEK_END); /* Byte tiếp theo sau phần kết thúc của tệp */
lseek(fd, -1, SEEK_END); /* Byte cuối cùng của tệp */
lseek(fd, -10, SEEK_CUR); /* Mười byte trước vị trí hiện tại */
lseek(fd, 10000, SEEK_END); /* 10001 byte sau byte cuối cùng của tệp */
```

Việc gọi `lseek()` chỉ đơn giản điều chỉnh bản ghi của kernel về vị trí con trỏ tệp được liên kết với một File Descriptor. Nó không gây ra bất kỳ truy cập thiết bị vật lý nào.

Chúng tôi mô tả thêm một số chi tiết về mối quan hệ giữa các vị trí con trỏ tệp, File Descriptor và các tệp đang mở trong Mục [5.4](#page-73-0).

Chúng ta không thể áp dụng `lseek()` cho tất cả các loại tệp. Việc áp dụng `lseek()` cho một pipe, FIFO, socket hoặc thiết bị đầu cuối (terminal) là không được phép; `lseek()` sẽ thất bại, với `errno` được đặt thành `ESPIPE`. Mặt khác, có thể áp dụng `lseek()` cho các thiết bị mà việc đó là hợp lý. Ví dụ, có thể di chuyển con trỏ đến một vị trí được chỉ định trên thiết bị đĩa hoặc băng từ (tape device).

> Chữ `l` trong tên `lseek()` bắt nguồn từ thực tế là cả tham số offset và giá trị trả về ban đầu đều có kiểu dữ liệu là `long`. Các bản cài đặt UNIX đầu tiên cung cấp System Call `seek()`, định nghĩa các giá trị này có kiểu `int`.

#### **Lỗ hỗng trong tệp (File holes)**

Điều gì xảy ra nếu một chương trình thực hiện con trỏ tệp (seek) vượt quá phần cuối của tệp (end of file) và sau đó thực hiện các thao tác I/O? Một lời gọi hàm `read()` sẽ trả về 0, cho biết đã đến cuối tệp (end-of-file). Hơi ngạc nhiên một chút, chúng ta hoàn toàn có thể ghi các byte tại một vị trí bất kỳ nằm sau phần cuối của tệp.

Khoảng giữa phần cuối trước đó của tệp và các byte vừa được ghi mới được gọi là một lỗ hỗng trong tệp (file hole). Từ góc độ lập trình, các byte trong lỗ hỗng này vẫn tồn tại, và việc đọc từ lỗ hỗng sẽ trả về một bộ đệm (buffer) gồm các byte chứa giá trị 0 (byte null).

Tuy nhiên, các lỗ hỗng trong tệp không chiếm bất kỳ dung lượng đĩa (disk space) nào. Hệ thống tệp (file system) không phân bổ bất kỳ khối đĩa (disk blocks) nào cho lỗ hỗng cho đến khi, tại một thời điểm sau đó, dữ liệu được ghi vào đó. Ưu điểm chính của các lỗ hỗng trong tệp là một tệp thưa thớt dữ liệu (sparsely populated file) sẽ tiêu tốn ít dung lượng đĩa hơn so với trường hợp các byte null thực sự cần phải được cấp phát trong các khối đĩa. Các tệp kết xuất bộ nhớ (Core dump files) (Mục 22.1) là những ví dụ phổ biến về các tệp chứa các lỗ hỗng lớn.

> Tuyên bố rằng các lỗ hỗng trong tệp không chiếm dung lượng đĩa cần phải được làm rõ thêm một chút. Trên hầu hết các hệ thống tệp, dung lượng tệp được phân bổ theo đơn vị khối (block) (Mục 14.3). Kích thước của một khối phụ thuộc vào hệ thống tệp, nhưng thường là 1024, 2048 hoặc 4096 byte. Nếu ranh giới của một lỗ hỗng nằm bên trong một khối, thay vì nằm trên ranh giới khối, thì toàn bộ khối đó sẽ được phân bổ để lưu trữ dữ liệu ở phần còn lại của khối, và phần tương ứng với lỗ hỗng sẽ được lấp đầy bằng các byte null.

Hầu hết các hệ thống tệp UNIX nguyên thủy đều hỗ trợ khái niệm lỗ hỗng trong tệp, nhưng nhiều hệ thống tệp không phải nguyên thủy (ví dụ: VFAT của Microsoft) thì không. Trên một hệ thống tệp không hỗ trợ lỗ hỗng, các byte null rõ ràng sẽ được ghi vào tệp.

Sự tồn tại của các lỗ hỗng đồng nghĩa với việc kích thước danh nghĩa (nominal size) của tệp có thể lớn hơn dung lượng lưu trữ trên đĩa mà nó thực sự sử dụng (trong một số trường hợp, lớn hơn đáng kể). Việc ghi các byte vào giữa lỗ hỗng của tệp sẽ làm giảm lượng dung lượng đĩa trống khi kernel phân bổ các khối để lấp đầy lỗ hỗng, mặc dù kích thước của tệp không thay đổi. Kịch bản như vậy ít khi xảy ra, nhưng dù sao cũng là điều cần lưu ý.

> SUSv3 quy định một hàm, `posix_fallocate(fd, offset, len)`, đảm bảo rằng dung lượng được phân bổ trên đĩa cho khoảng byte được chỉ định bởi `offset` và `len` đối với tệp trên đĩa được tham chiếu bởi bộ mô tả tệp (file descriptor) `fd`. Điều này cho phép một ứng dụng chắc chắn rằng lệnh `read()` hoặc `write()` sau đó tới tệp sẽ không bị thất bại do cạn kiệt dung lượng đĩa (điều này có thể xảy ra nếu một lỗ hỗng trong tệp được lấp đầy, hoặc một ứng dụng khác chiếm hết dung lượng trên đĩa). Về mặt lịch sử, việc triển khai glibc của hàm này đạt được kết quả mong muốn bằng cách ghi một byte 0 vào mỗi khối trong dải đã chỉ định. Kể từ phiên bản 2.6.23, Linux cung cấp system call `fallocate()`, cung cấp một cách hiệu quả hơn để đảm bảo rằng dung lượng cần thiết được phân bổ, và việc triển khai `posix_fallocate()` trong glibc tận dụng system call này khi nó khả dụng.

Mục 14.4 mô tả cách các lỗ hỗng được biểu diễn trong một tệp, và Mục 15.1 mô tả system call `stat()`, có thể cho chúng ta biết kích thước hiện tại của một tệp, cũng như số lượng khối thực sự được phân bổ cho tệp đó.

#### **Chương trình ví dụ**

[Liệt kê 4-3](#page-63-0) minh họa việc sử dụng `lseek()` kết hợp với `read()` và `write()`. Đối số dòng lệnh đầu tiên (command-line argument) cho chương trình này là tên của tệp cần mở. Các đối số còn lại chỉ định các thao tác I/O cần thực hiện trên tệp. Mỗi thao tác này bao gồm một chữ cái theo sau là một giá trị liên quan (không có khoảng trắng ngăn cách):

- `soffset`: Di chuyển con trỏ tệp (seek) đến độ lệch byte (byte offset) tính từ phần đầu của tệp.
- `rlength`: Đọc `length` byte từ tệp, bắt đầu từ độ lệch tệp hiện tại (current file offset), và hiển thị chúng dưới dạng văn bản (text).
- `Rlength`: Đọc `length` byte từ tệp, bắt đầu từ độ lệch tệp hiện tại, và hiển thị chúng dưới dạng hệ thập lục phân (hexadecimal).
- `wstr`: Ghi chuỗi các ký tự được chỉ định trong `str` tại độ lệch tệp hiện tại.

<span id="page-63-0"></span>**Liệt kê 4-3:** Minh họa các hàm `read()`, `write()`, và `lseek()`

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– fileio/seek_io.c
#include <sys/stat.h>
#include <fcntl.h>
#include <ctype.h>
#include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 size_t len;
 off_t offset;
 int fd, ap, j;
 char *buf;
 ssize_t numRead, numWritten;
 if (argc < 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s file {r<length>|R<length>|w<string>|s<offset>}...\n",
 argv[0]);
 fd = open(argv[1], O_RDWR | O_CREAT,
 S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP |
 S_IROTH | S_IWOTH); /* rw-rw-rw- */
 if (fd == -1)
 errExit("open");
 for (ap = 2; ap < argc; ap++) {
 switch (argv[ap][0]) {
 case 'r': /* Display bytes at current offset, as text */
 case 'R': /* Display bytes at current offset, in hex */
 len = getLong(&argv[ap][1], GN_ANY_BASE, argv[ap]);
```

```
 buf = malloc(len);
 if (buf == NULL)
 errExit("malloc");
 numRead = read(fd, buf, len);
 if (numRead == -1)
 errExit("read");
 if (numRead == 0) {
 printf("%s: end-of-file\n", argv[ap]);
 } else {
 printf("%s: ", argv[ap]);
 for (j = 0; j < numRead; j++) {
 if (argv[ap][0] == 'r')
 printf("%c", isprint((unsigned char) buf[j]) ?
 buf[j] : '?');
 else
 printf("%02x ", (unsigned int) buf[j]);
 }
 printf("\n");
 }
 free(buf);
 break;
 case 'w': /* Write string at current offset */
 numWritten = write(fd, &argv[ap][1], strlen(&argv[ap][1]));
 if (numWritten == -1)
 errExit("write");
 printf("%s: wrote %ld bytes\n", argv[ap], (long) numWritten);
 break;
 case 's': /* Change file offset */
 offset = getLong(&argv[ap][1], GN_ANY_BASE, argv[ap]);
 if (lseek(fd, offset, SEEK_SET) == -1)
 errExit("lseek");
 printf("%s: seek succeeded\n", argv[ap]);
 break;
 default:
 cmdLineErr("Argument must start with [rRws]: %s\n", argv[ap]);
 }
 }
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– fileio/seek_io.c
```

Nhật ký phiên shell sau đây minh họa việc sử dụng chương trình trong Danh mục [4-3,](#page-63-0), cho thấy điều gì xảy ra khi chúng ta cố gắng đọc các byte từ một khoảng trống trong tệp (file hole):

```
$ touch tfile Create new, empty file
$ ./seek_io tfile s100000 wabc Seek to offset 100,000, write "abc"
s100000: seek succeeded
wabc: wrote 3 bytes
```

\$ **ls -l tfile** Kiểm tra kích thước của tệp -rw-r--r-- 1 mtk users 100003 Th2 10 10:35 tfile s10000: tìm kiếm thành công

\$ **./seek\_io tfile s10000 R5** Di chuyển con trỏ đến offset 10.000, đọc 5 byte từ khoảng trống

R5: 00 00 00 00 00 Các byte trong khoảng trống chứa giá trị 0

# <span id="page-65-0"></span>**4.8 Các thao tác nằm ngoài Mô hình I/O Phổ quát: ioctl()**

System Call (lời gọi hệ thống) `ioctl()` là một cơ chế đa mục đích dùng để thực hiện các thao tác trên tệp và thiết bị nằm ngoài mô hình I/O phổ quát (universal I/O model) đã được mô tả trước đó trong chương này.

```
#include <sys/ioctl.h>
int ioctl(int fd, int request, ... /* argp */);
                   Giá trị trả về khi thành công phụ thuộc vào request, hoặc –1 nếu có lỗi
```

Đối số `fd` là một File Descriptor (mô tả tệp) đang mở cho thiết bị hoặc tệp mà trên đó thao tác điều khiển được chỉ định bởi `request` sẽ được thực hiện. Các tệp tiêu đề (header files) đặc thù của thiết bị sẽ định nghĩa các hằng số có thể được truyền vào đối số `request`.

Như được biểu thị bằng ký hiệu dấu chấm lửng (...) chuẩn trong ngôn ngữ C, đối số thứ ba của `ioctl()`, mà chúng ta đặt tên là `argp`, có thể thuộc bất kỳ kiểu dữ liệu nào. Giá trị của đối số `request` cho phép `ioctl()` xác định kiểu giá trị nào cần mong đợi trong `argp`. Thông thường, `argp` là một con trỏ trỏ đến một số nguyên (integer) hoặc một cấu trúc (structure); trong một số trường hợp, nó không được sử dụng.

Chúng ta sẽ thấy một số trường hợp sử dụng `ioctl()` trong các chương sau (ví dụ: xem Mục 15.5).

> Đặc tả duy nhất mà SUSv3 đưa ra cho `ioctl()` là dành cho các thao tác điều khiển thiết bị STREAMS. (Tiện ích STREAMS là một tính năng của System V không được hỗ trợ bởi Linux kernel chính thống, mặc dù một số bản cài đặt bổ sung đã được phát triển). Không có thao tác `ioctl()` nào khác được mô tả trong cuốn sách này được quy định trong SUSv3. Tuy nhiên, lời gọi `ioctl()` đã là một phần của hệ thống UNIX kể từ các phiên bản đầu tiên, và do đó, một số thao tác `ioctl()` mà chúng ta mô tả được cung cấp trên nhiều cài đặt UNIX khác nhau. Khi mô tả từng thao tác `ioctl()`, chúng tôi sẽ lưu ý các vấn đề về tính di động (portability).

# **4.9 Tóm tắt**

Để thực hiện I/O trên một tệp thông thường (regular file), trước tiên chúng ta phải lấy một File Descriptor bằng cách sử dụng `open()`. Sau đó, các thao tác I/O được thực hiện bằng `read()` và `write()`. Sau khi thực hiện tất cả các thao tác I/O, chúng ta nên giải phóng File Descriptor và các tài nguyên liên quan bằng `close()`. Các system call này có thể được sử dụng để thực hiện I/O trên tất cả các loại tệp.

Việc tất cả các loại tệp và trình điều khiển thiết bị (device drivers) đều thực thi cùng một giao diện I/O cho phép tính phổ quát của I/O (universality of I/O), có nghĩa là một chương trình thường có thể được sử dụng với bất kỳ loại tệp nào mà không cần mã nguồn cụ thể cho loại tệp đó.

Đối với mỗi tệp đang mở, kernel duy trì một File Offset (vị trí con trỏ tệp), thứ xác định vị trí mà lần đọc hoặc viết tiếp theo sẽ diễn ra. File Offset được cập nhật ngầm định bởi các thao tác đọc và viết. Bằng cách sử dụng `lseek()`, chúng ta có thể định vị lại một cách rõ ràng File Offset đến bất kỳ vị trí nào bên trong tệp hoặc vượt quá phần cuối của tệp (end of file). Việc ghi dữ liệu ở một vị trí vượt quá phần cuối tệp trước đó sẽ tạo ra một khoảng trống trong tệp (file hole). Các thao tác đọc từ khoảng trống trong tệp sẽ trả về các byte chứa giá trị số không (zeros).

System call `ioctl()` là một hàm vét cạn (catchall) cho các thao tác trên thiết bị và tệp không phù hợp với mô hình I/O tệp chuẩn.

## **4.10 Bài tập**

- **4-1.** Lệnh `tee` đọc đầu vào chuẩn (standard input) của nó cho đến khi gặp kết thúc tệp (end-of-file), đồng thời ghi một bản sao của đầu vào đó ra đầu ra chuẩn (standard output) và vào tệp có tên được chỉ định trong đối số dòng lệnh của nó. (Chúng tôi đưa ra một ví dụ về việc sử dụng lệnh này khi thảo luận về FIFO trong Mục 44.7). Hãy cài đặt `tee` bằng cách sử dụng các System Call (lệnh gọi hệ thống) I/O. Theo mặc định, `tee` ghi đè lên bất kỳ tệp nào đã tồn tại với tên được cho. Hãy cài đặt tùy chọn dòng lệnh `-a` (`tee -a file`), tùy chọn này khiến `tee` nối (append) văn bản vào cuối tệp nếu tệp đó đã tồn tại. (Tham khảo Phụ lục B để biết mô tả về hàm `getopt()`, hàm này có thể được sử dụng để phân tích cú pháp các tùy chọn dòng lệnh).
- **4-2.** Viết một chương trình giống như `cp` mà khi được sử dụng để sao chép một tệp thông thường (regular file) có chứa các vùng trống (hole - các chuỗi byte null), nó cũng sẽ tạo ra các vùng trống tương ứng trong tệp đích.
