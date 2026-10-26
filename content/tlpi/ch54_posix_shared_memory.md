# Chương 54: POSIX SHARED MEMORY

Trong các chương trước, chúng ta đã xem xét hai kỹ thuật cho phép các tiến trình (process) không có quan hệ họ hàng chia sẻ các vùng bộ nhớ để thực hiện IPC: System V shared memory (Chương 48) và ánh xạ tệp chia sẻ (shared file mappings - Mục 49.4.2). Cả hai kỹ thuật này đều có những nhược điểm tiềm ẩn:

- Mô hình System V shared memory, sử dụng các khóa (key) và định danh (identifier), không đồng nhất với mô hình I/O tiêu chuẩn của UNIX, vốn sử dụng tên tệp (filename) và bộ mô tả tệp (file descriptor). Sự khác biệt này có nghĩa là chúng ta cần một tập hợp hoàn toàn mới các system call (lời gọi hệ thống) và lệnh để làm việc với các phân đoạn System V shared memory.
- Việc sử dụng ánh xạ tệp chia sẻ (shared file mapping) cho IPC đòi hỏi phải tạo ra một tệp trên đĩa, ngay cả khi chúng ta không quan tâm đến việc có một kho lưu trữ hậu thuẫn (backing store) bền vững cho vùng chia sẻ hay không. Bên cạnh sự bất tiện khi phải tạo tệp, kỹ thuật này còn phát sinh thêm chi phí chung (overhead) về I/O tệp.

Do những nhược điểm này, tiêu chuẩn POSIX.1b đã định nghĩa một API chia sẻ bộ nhớ mới: POSIX shared memory, đây là chủ đề của chương này.

> POSIX sử dụng thuật ngữ đối tượng bộ nhớ chia sẻ (shared memory objects), trong khi System V gọi là các phân đoạn bộ nhớ chia sẻ (shared memory segments). Sự khác biệt về thuật ngữ này mang tính lịch sử—cả hai thuật ngữ đều được sử dụng để chỉ các vùng bộ nhớ được chia sẻ giữa các tiến trình.

## 54.1 Tổng quan

POSIX shared memory cho phép chúng ta chia sẻ một vùng được ánh xạ (mapped region) giữa các tiến trình không có quan hệ họ hàng mà không cần tạo một tệp được ánh xạ tương ứng. POSIX shared memory đã được hỗ trợ trên Linux kể từ Linux kernel 2.4.

Tiêu chuẩn SUSv3 không quy định bất kỳ chi tiết nào về cách thức triển khai POSIX shared memory. Cụ thể, không có yêu cầu nào về việc sử dụng hệ thống tệp (thực hoặc ảo) để định danh các đối tượng bộ nhớ chia sẻ, mặc dù nhiều hệ thống UNIX thực sự sử dụng hệ thống tệp cho mục đích này. Một số hệ thống UNIX tạo tên cho các đối tượng bộ nhớ chia sẻ dưới dạng tệp tại một vị trí đặc biệt trong hệ thống tệp tiêu chuẩn. Linux sử dụng một hệ thống tệp tmpfs chuyên dụng (Mục 14.10) được gắn kết (mount) dưới thư mục `/dev/shm`. Hệ thống tệp này có tính bền vững trong kernel (kernel persistence)—các đối tượng bộ nhớ chia sẻ nằm trong đó sẽ vẫn tồn tại ngay cả khi không có tiến trình nào đang mở chúng, nhưng chúng sẽ bị mất nếu hệ thống tắt nguồn (shutdown).

> Tổng lượng bộ nhớ trong tất cả các vùng POSIX shared memory trên hệ thống bị giới hạn bởi dung lượng của hệ thống tệp tmpfs bên dưới. Hệ thống tệp này thường được gắn kết khi khởi động hệ thống với một kích thước mặc định nào đó (ví dụ: 256 MB). Nếu cần thiết, người dùng siêu cấp (superuser) có thể thay đổi kích thước của hệ thống tệp bằng cách gắn kết lại (remount) nó bằng lệnh `mount –o remount,size=<num-bytes>`.

Để sử dụng một đối tượng POSIX shared memory, chúng ta thực hiện hai bước:

- 1. Sử dụng hàm `shm_open()` để mở một đối tượng với một tên được chỉ định. (Chúng tôi đã mô tả các quy tắc chi phối việc đặt tên cho các đối tượng POSIX shared memory trong Mục [51.1](#page-1-0)). Hàm `shm_open()` tương tự như system call `open()`. Nó hoặc tạo một đối tượng bộ nhớ chia sẻ mới hoặc mở một đối tượng đã tồn tại. Là kết quả trả về của hàm, `shm_open()` trả về một file descriptor trỏ đến đối tượng đó.
- 2. Truyền file descriptor lấy được ở bước trước vào lệnh gọi `mmap()` với cờ `MAP_SHARED` được chỉ định trong đối số `flags`. Thao tác này ánh xạ đối tượng bộ nhớ chia sẻ vào không gian địa chỉ ảo (virtual address space) của tiến trình. Giống như các cách sử dụng `mmap()` khác, một khi chúng ta đã ánh xạ đối tượng, chúng ta có thể đóng file descriptor mà không làm ảnh hưởng đến việc ánh xạ. Tuy nhiên, chúng ta có thể cần giữ cho file descriptor mở để sử dụng tiếp trong các lệnh gọi `fstat()` và `ftruncate()` (xem Mục [54.2](#page-52-0)).

Mối quan hệ giữa `shm_open()` và `mmap()` đối với POSIX shared memory tương tự như mối quan hệ giữa `shmget()` và `shmat()` đối với System V shared memory. Nguồn gốc của quy trình hai bước (`shm_open()` cộng với `mmap()`) để sử dụng các đối tượng POSIX shared memory thay vì sử dụng một hàm duy nhất thực hiện cả hai tác vụ mang tính lịch sử. Khi ủy ban POSIX bổ sung tính năng này, lệnh gọi `mmap()` đã tồn tại sẵn ([Stevens, 1999]). Trên thực tế, tất cả những gì chúng ta đang làm là thay thế các lệnh gọi `open()` bằng các lệnh gọi `shm_open()`, với điểm khác biệt là việc sử dụng `shm_open()` không đòi hỏi phải tạo một tệp trên hệ thống tệp dựa trên đĩa (disk-based file system).

Vì một đối tượng bộ nhớ chia sẻ được tham chiếu thông qua một file descriptor, chúng ta có thể tận dụng hiệu quả các system call về file descriptor khác nhau đã được định nghĩa sẵn trong hệ thống UNIX (ví dụ: `ftruncate()`), thay vì cần đến các system call chuyên dụng hoàn toàn mới (như yêu cầu đối với System V shared memory).

## 54.2 Tạo các đối tượng bộ nhớ chia sẻ (Shared Memory Objects)

Hàm shm\_open() tạo và mở một đối tượng bộ nhớ chia sẻ (shared memory object) mới hoặc mở một đối tượng đã tồn tại. Các tham số truyền vào shm\_open() tương tự như các tham số của hàm open().

```
## include <fcntl.h> /* Định nghĩa các hằng số O_* */
## include <sys/stat.h> /* Định nghĩa các hằng số mode */
## include <sys/mman.h>
int shm_open(const char *name, int oflag, mode_t mode);
                             Trả về File Descriptor khi thành công, hoặc –1 khi lỗi
```

Tham số `name` xác định đối tượng bộ nhớ chia sẻ cần tạo hoặc mở. Tham số `oflag` là một mặt nạ bit (bit mask) làm thay đổi hành vi của lời gọi hàm. Các giá trị có thể được bao gồm trong mặt nạ này được tóm tắt tại [Bảng 54-1.](#page-52-1)

| Bảng 54-1: Các giá trị bit cho tham số | oflag | của shm_open() |
|----------------------------------------|-------|----------------|
|----------------------------------------|-------|----------------|

| Cờ (Flag) | Mô tả |
|----------|---|
| O_CREAT | Tạo đối tượng nếu nó chưa tồn tại |
| O_EXCL | Dùng kết hợp với O_CREAT, tạo độc quyền đối tượng |
| O_RDONLY | Mở với quyền chỉ đọc (read-only) |
| O_RDWR | Mở với quyền đọc-ghi (read-write) |
| O_TRUNC | Cắt ngắn đối tượng về độ dài bằng 0 |

Một trong những mục đích của tham số `oflag` là xác định xem chúng ta đang mở một đối tượng bộ nhớ chia sẻ đã tồn tại hay đang tạo và mở một đối tượng mới. Nếu `oflag` không bao gồm `O_CREAT`, chúng ta đang mở một đối tượng đã có sẵn. Nếu `O_CREAT` được chỉ định, đối tượng sẽ được tạo ra nếu nó chưa tồn tại. Việc chỉ định `O_EXCL` kết hợp cùng với `O_CREAT` là một yêu cầu nhằm đảm bảo rằng tiến trình gọi (calling process) là bên tạo ra đối tượng; nếu đối tượng đã tồn tại, lỗi sẽ xảy ra (EEXIST).

Tham số `oflag` cũng chỉ định loại truy cập mà tiến trình gọi sẽ thực hiện đối với đối tượng bộ nhớ chia sẻ, bằng cách chỉ định chính xác một trong các giá trị `O_RDONLY` hoặc `O_RDWR`.

Giá trị cờ còn lại, `O_TRUNC`, khiến cho một thao tác mở thành công đối tượng bộ nhớ chia sẻ đã tồn tại sẽ cắt ngắn đối tượng đó về độ dài bằng không.

> Trên Linux, việc cắt ngắn vẫn diễn ra ngay cả khi mở với quyền chỉ đọc. Tuy nhiên, tiêu chuẩn SUSv3 cho biết kết quả của việc sử dụng `O_TRUNC` với chế độ mở chỉ đọc là không xác định (undefined), vì vậy chúng ta không thể phụ thuộc vào hành vi cụ thể này trong các mã nguồn có tính tương thích cao (portable).

Khi một đối tượng bộ nhớ chia sẻ mới được tạo, quyền sở hữu người dùng và nhóm (ownership và group ownership) của nó được lấy từ ID người dùng hiệu dụng (effective user ID) và ID nhóm của tiến trình gọi shm\_open(), và quyền hạn của đối tượng được thiết lập theo giá trị được cung cấp trong tham số mặt nạ bit `mode`. Các giá trị bit cho `mode` giống như đối với các tệp tin (Bảng 15-4, trang 295). Giống như System Call open(), mặt nạ quyền hạn trong `mode` được lọc qua umask của tiến trình (Mục 15.4.6). Khác với open(), tham số `mode` là bắt buộc đối với mọi lời gọi shm\_open(); nếu chúng ta không tạo đối tượng mới, tham số này nên được chỉ định là 0.

Cờ đóng-khi-exec (close-on-exec flag - `FD_CLOEXEC`, Mục 27.4) được thiết lập trên file descriptor do shm\_open() trả về, nhờ đó file descriptor sẽ tự động được đóng lại nếu tiến trình thực thi một lời gọi `exec()`. (Điều này nhất quán với thực tế là các vùng nhớ ánh xạ - mappings - sẽ bị hủy ánh xạ - unmapped - khi một tiến trình thực hiện `exec()`.)

Khi một đối tượng bộ nhớ chia sẻ mới được tạo, ban đầu nó có độ dài bằng không. Điều này có nghĩa là sau khi tạo một đối tượng bộ nhớ chia sẻ mới, thông thường chúng ta gọi `ftruncate()` (Mục 5.8) để thiết lập kích thước của đối tượng trước khi gọi `mmap()`. Sau lời gọi `mmap()`, chúng ta cũng có thể sử dụng `ftruncate()` để mở rộng hoặc thu nhỏ đối tượng bộ nhớ chia sẻ theo ý muốn, với lưu ý cần ghi nhớ các điểm đã thảo luận ở Mục 49.4.3.

Khi một đối tượng bộ nhớ chia sẻ được mở rộng, các byte mới được thêm vào sẽ tự động được khởi tạo về giá trị 0.

Tại bất kỳ thời điểm nào, chúng ta có thể áp dụng `fstat()` (Mục 15.1) lên file descriptor do shm\_open() trả về để thu được một cấu trúc `stat` mà các trường của nó chứa thông tin về đối tượng bộ nhớ chia sẻ, bao gồm kích thước (`st_size`), quyền hạn (`st_mode`), chủ sở hữu (`st_uid`), và nhóm (`st_gid`). (Đây là các trường duy nhất mà SUSv3 yêu cầu `fstat()` phải thiết lập trong cấu trúc `stat`, mặc dù Linux cũng trả về thông tin có ý nghĩa trong các trường thời gian, cùng với một số thông tin ít hữu ích khác trong các trường còn lại).

Quyền hạn và quyền sở hữu của một đối tượng bộ nhớ chia sẻ có thể được thay đổi lần lượt bằng cách sử dụng `fchmod()` và `fchown()`.

### Chương trình ví dụ

[Listing 54-1](#page-53-0) cung cấp một ví dụ đơn giản về việc sử dụng `shm_open()`, `ftruncate()` và `mmap()`. Chương trình này tạo ra một đối tượng bộ nhớ chia sẻ (shared memory object) với kích thước được chỉ định bởi một tham số dòng lệnh (command-line argument), và ánh xạ (map) đối tượng đó vào không gian địa chỉ ảo (virtual address space) của tiến trình (Process). (Bước ánh xạ này là dư thừa vì chúng ta không thực sự thao tác gì với bộ nhớ chia sẻ, nhưng nó đóng vai trò minh họa cách sử dụng `mmap()`.) Chương trình cho phép sử dụng các tùy chọn dòng lệnh để chọn các cờ (flag) (`O_CREAT` và `O_EXCL`) cho lời gọi hàm `shm_open()`.

Trong ví dụ sau, chúng ta sử dụng chương trình này để tạo một đối tượng bộ nhớ chia sẻ có kích thước 10.000 byte, và sau đó sử dụng lệnh `ls` để hiển thị đối tượng này trong `/dev/shm`:

```
$ ./pshm_create -c /demo_shm 10000
$ ls -l /dev/shm
total 0
-rw------- 1 mtk users 10000 Jun 20 11:31 demo_shm
```

**Listing 54-1:** Tạo một đối tượng bộ nhớ chia sẻ POSIX (POSIX shared memory object)

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_create.c
## include <sys/stat.h>
## include <fcntl.h>
## include <sys/mman.h>
## include "tlpi_hdr.h"
```

```
static void
usageError(const char *progName)
{
 fprintf(stderr, "Usage: %s [-cx] name size [octal-perms]\n", progName);
 fprintf(stderr, " -c Create shared memory (O_CREAT)\n");
 fprintf(stderr, " -x Create exclusively (O_EXCL)\n");
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 int flags, opt, fd;
 mode_t perms;
 size_t size;
 void *addr;
 flags = O_RDWR;
 while ((opt = getopt(argc, argv, "cx")) != -1) {
 switch (opt) {
 case 'c': flags |= O_CREAT; break;
 case 'x': flags |= O_EXCL; break;
 default: usageError(argv[0]);
 }
 }
 if (optind + 1 >= argc)
 usageError(argv[0]);
 size = getLong(argv[optind + 1], GN_ANY_BASE, "size");
 perms = (argc <= optind + 2) ? (S_IRUSR | S_IWUSR) :
 getLong(argv[optind + 2], GN_BASE_8, "octal-perms");
 /* Tạo đối tượng bộ nhớ chia sẻ và thiết lập kích thước của nó */
 fd = shm_open(argv[optind], flags, perms);
 if (fd == -1)
 errExit("shm_open");
 if (ftruncate(fd, size) == -1)
 errExit("ftruncate");
 /* Ánh xạ đối tượng bộ nhớ chia sẻ */
 addr = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
 if (addr == MAP_FAILED)
 errExit("mmap");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_create.c
```

## 54.3 Sử dụng các đối tượng bộ nhớ chia sẻ

[Listing 54-2](#page-55-0) và [Listing 54-3](#page-56-0) minh họa việc sử dụng một đối tượng bộ nhớ chia sẻ để truyền dữ liệu từ tiến trình này sang tiến trình khác. Chương trình trong [Listing 54-2](#page-55-0) sao chép chuỗi ký tự nằm ở tham số dòng lệnh thứ hai của nó vào đối tượng bộ nhớ chia sẻ hiện có được đặt tên ở tham số dòng lệnh thứ nhất. Trước khi ánh xạ đối tượng và thực hiện việc sao chép, chương trình sử dụng `ftruncate()` để thay đổi kích thước đối tượng bộ nhớ chia sẻ sao cho bằng với độ dài của chuỗi cần sao chép.

**Listing 54-2:** Sao chép dữ liệu vào một đối tượng bộ nhớ chia sẻ POSIX

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_write.c
## include <fcntl.h>
## include <sys/mman.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int fd;
 size_t len; /* Kích thước của đối tượng bộ nhớ chia sẻ */
 char *addr;
 if (argc != 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s shm-name string\n", argv[0]);
 fd = shm_open(argv[1], O_RDWR, 0); /* Mở đối tượng đã tồn tại */
 if (fd == -1)
 errExit("shm_open");
 len = strlen(argv[2]);
 if (ftruncate(fd, len) == -1) /* Thay đổi kích thước đối tượng để chứa chuỗi */
 errExit("ftruncate");
 printf("Resized to %ld bytes\n", (long) len);
 addr = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
 if (addr == MAP_FAILED)
 errExit("mmap");
 if (close(fd) == -1)
 errExit("close"); /* 'fd' không còn cần thiết nữa */
 printf("copying %ld bytes\n", (long) len);
 memcpy(addr, argv[2], len); /* Sao chép chuỗi vào bộ nhớ chia sẻ */
   exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_write.c
```

Chương trình trong [Listing 54-3](#page-56-0) hiển thị chuỗi trong đối tượng bộ nhớ chia sẻ hiện có được chỉ định bởi tên trong tham số dòng lệnh ra đầu ra tiêu chuẩn (standard output). Sau khi gọi `shm_open()`, chương trình sử dụng `fstat()` để xác định kích thước của bộ nhớ chia sẻ và sử dụng kích thước đó trong lời gọi `mmap()` (để ánh xạ đối tượng) cũng như trong lời gọi `write()` (để in chuỗi).

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_read.c
## include <fcntl.h>
## include <sys/mman.h>
## include <sys/stat.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int fd;
 char *addr;
 struct stat sb;
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s shm-name\n", argv[0]);
 fd = shm_open(argv[1], O_RDONLY, 0); /* Mở đối tượng đã tồn tại */
 if (fd == -1)
 errExit("shm_open");
 /* Sử dụng kích thước đối tượng bộ nhớ chia sẻ làm đối tham số độ dài cho mmap()
 và làm số lượng byte cho write() */
 if (fstat(fd, &sb) == -1)
 errExit("fstat");
 addr = mmap(NULL, sb.st_size, PROT_READ, MAP_SHARED, fd, 0);
 if (addr == MAP_FAILED)
 errExit("mmap");
 if (close(fd) == -1); /* 'fd' không còn cần thiết nữa */
 errExit("close");
 write(STDOUT_FILENO, addr, sb.st_size);
 printf("\n");
   exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_read.c
```

Phiên làm việc shell dưới đây minh họa cách sử dụng các chương trình trong [Listing 54-2](#page-55-0) và [Listing 54-3.](#page-56-0) Đầu tiên, chúng ta tạo một đối tượng bộ nhớ chia sẻ (shared memory object) có độ dài bằng 0 bằng cách sử dụng chương trình trong [Listing 54-1](#page-53-0).

```
$ ./pshm_create -c /demo_shm 0
$ ls -l /dev/shm Kiểm tra kích thước của đối tượng
total 4
-rw------- 1 mtk users 0 Jun 21 13:33 demo_shm
```

Sau đó, chúng ta sử dụng chương trình trong [Listing 54-2](#page-55-0) để sao chép một chuỗi vào đối tượng bộ nhớ chia sẻ:

```
$ ./pshm_write /demo_shm 'hello'
$ ls -l /dev/shm Kiểm tra xem kích thước của đối tượng đã thay đổi chưa
total 4
-rw------- 1 mtk users 5 Jun 21 13:33 demo_shm
```

Từ kết quả đầu ra, chúng ta có thể thấy rằng chương trình đã thay đổi kích thước của đối tượng bộ nhớ chia sẻ để nó đủ lớn nhằm chứa chuỗi được chỉ định.

Cuối cùng, chúng ta sử dụng chương trình trong [Listing 54-3](#page-56-0) để hiển thị chuỗi nằm trong đối tượng bộ nhớ chia sẻ:

```
$ ./pshm_read /demo_shm
hello
```

Các ứng dụng thường phải sử dụng một số kỹ thuật đồng bộ hóa (synchronization technique) để cho phép các tiến trình (Process) phối hợp quyền truy cập của chúng vào bộ nhớ chia sẻ. Trong phiên làm việc shell được minh họa ở đây, việc phối hợp được thực hiện bởi người dùng khi chạy các chương trình nối tiếp nhau. Thông thường, các ứng dụng sẽ sử dụng một primitive đồng bộ hóa (synchronization primitive) (ví dụ: semaphore) để điều phối việc truy cập vào một đối tượng bộ nhớ chia sẻ.

## 54.4 Xóa các đối tượng bộ nhớ chia sẻ

SUSv3 yêu cầu các đối tượng bộ nhớ chia sẻ POSIX phải có ít nhất độ bền vững cấp nhân (kernel persistence); nghĩa là, chúng tiếp tục tồn tại cho đến khi bị xóa một cách tường minh hoặc hệ thống được khởi động lại (reboot). Khi một đối tượng bộ nhớ chia sẻ không còn cần thiết nữa, nó nên được xóa bằng cách sử dụng `shm_unlink()`.

```
## include <sys/mman.h>
int shm_unlink(const char *name);
                                            Trả về 0 nếu thành công, hoặc –1 nếu có lỗi
```

Hàm `shm_unlink()` sẽ xóa đối tượng bộ nhớ chia sẻ được chỉ định bởi `name`. Việc xóa một đối tượng bộ nhớ chia sẻ không làm ảnh hưởng đến các ánh xạ hiện có của đối tượng (vẫn sẽ giữ nguyên hiệu lực cho đến khi các tiến trình tương ứng gọi `munmap()` hoặc kết thúc), nhưng ngăn chặn các lời gọi `shm_open()` tiếp theo mở đối tượng đó. Một khi tất cả các tiến trình đã hủy ánh xạ (unmap) đối tượng, đối tượng sẽ bị xóa và nội dung của nó sẽ bị mất.

Chương trình trong [Listing 54-4](#page-57-0) sử dụng `shm_unlink()` để xóa đối tượng bộ nhớ chia sẻ được chỉ định trong tham số dòng lệnh (command-line argument) của chương trình.

**Listing 54-4:** Sử dụng `shm_unlink()` để hủy liên kết một đối tượng bộ nhớ chia sẻ POSIX

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_unlink.c
## include <fcntl.h>
## include <sys/mman.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s shm-name\n", argv[0]);
   if (shm_unlink(argv[1]) == -1)
 errExit("shm_unlink");
   exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– pshm/pshm_unlink.c
```

## 54.5 So sánh giữa các API chia sẻ bộ nhớ (Shared Memory APIs)

Đến đây, chúng ta đã xem xét một số kỹ thuật khác nhau để chia sẻ các vùng bộ nhớ (shared memory regions) giữa các tiến trình (process) không có quan hệ họ hàng:

- Bộ nhớ chia sẻ System V (System V shared memory - Chương 48);
- Ánh xạ tệp chia sẻ (shared file mappings - Mục 49.4.2); và
- Các đối tượng bộ nhớ chia sẻ POSIX (POSIX shared memory objects - chủ đề của chương này).

Nhiều điểm mà chúng ta đưa ra trong phần này cũng có liên quan đến các ánh xạ ẩn danh chia sẻ (shared anonymous mappings - Mục 49.4), được sử dụng để chia sẻ bộ nhớ giữa các tiến trình có quan hệ họ hàng thông qua `fork()`.

Một số điểm áp dụng cho tất cả các kỹ thuật này:

- Chúng cung cấp cơ chế IPC (Interprocess Communication) tốc độ cao và các ứng dụng thường phải sử dụng semaphore (hoặc các nguyên hàm đồng bộ hóa - synchronization primitive khác) để đồng bộ hóa quyền truy cập vào vùng được chia sẻ.
- Một khi vùng bộ nhớ chia sẻ đã được ánh xạ vào không gian địa chỉ ảo (virtual address space) của tiến trình, nó trông giống như bất kỳ phần nào khác trong không gian bộ nhớ của tiến trình.
- Hệ thống đặt các vùng bộ nhớ chia sẻ trong không gian địa chỉ ảo của tiến trình theo cách tương tự. Chúng ta đã phác thảo vị trí đặt này khi mô tả bộ nhớ chia sẻ System V ở Mục 48.5. Tệp `/proc/PID/maps` đặc thù của Linux liệt kê thông tin về tất cả các loại vùng bộ nhớ chia sẻ.
- Giả sử rằng chúng ta không cố gắng ánh xạ một vùng bộ nhớ chia sẻ tại một địa chỉ cố định (fixed address), chúng ta nên đảm bảo rằng tất cả các tham chiếu đến các vị trí trong vùng được tính toán dưới dạng phần bù (offset - thay vì con trỏ), vì vùng này có thể được đặt tại các địa chỉ ảo khác nhau bên trong các tiến trình khác nhau (Mục 48.6).
- Các hàm được mô tả trong Chương 50 hoạt động trên các vùng bộ nhớ ảo (virtual memory) có thể được áp dụng cho các vùng bộ nhớ chia sẻ được tạo bằng bất kỳ kỹ thuật nào trong số này.

Cũng có một số điểm khác biệt đáng chú ý giữa các kỹ thuật chia sẻ bộ nhớ:

- Thực tế là nội dung của một ánh xạ tệp chia sẻ được đồng bộ hóa với tệp được ánh xạ bên dưới (underlying mapped file) có nghĩa là dữ liệu được lưu trữ trong một vùng bộ nhớ chia sẻ có thể tồn tại bền vững qua các lần khởi động lại hệ thống (system restarts).
- Bộ nhớ chia sẻ System V và POSIX sử dụng các cơ chế khác nhau để định danh và tham chiếu đến một đối tượng bộ nhớ chia sẻ (shared memory object). System V sử dụng sơ đồ khóa (key) và định danh (identifier) của riêng mình, không phù hợp với mô hình I/O tiêu chuẩn của UNIX và yêu cầu các system call riêng biệt (ví dụ: `shmctl()`) cùng các câu lệnh (như `ipcs` và `ipcrm`). Ngược lại, bộ nhớ chia sẻ POSIX sử dụng tên và file descriptor, do đó các đối tượng bộ nhớ chia sẻ có thể được kiểm tra và thao tác bằng cách sử dụng các system call hiện có của UNIX (ví dụ: `fstat()` và `fchmod()`).
- Kích thước của một phân đoạn bộ nhớ chia sẻ System V được cố định tại thời điểm tạo (thông qua `shmget()`). Ngược lại, đối với một ánh xạ được hỗ trợ bởi tệp hoặc bởi một đối tượng bộ nhớ chia sẻ POSIX, chúng ta có thể sử dụng `ftruncate()` để điều chỉnh kích thước của đối tượng bên dưới, sau đó tạo lại ánh xạ bằng cách sử dụng `munmap()` và `mmap()` (hoặc hàm `mremap()` đặc thù của Linux).

Về mặt lịch sử, bộ nhớ chia sẻ System V có tính khả dụng rộng rãi hơn so với `mmap()` và bộ nhớ chia sẻ POSIX, mặc dù hầu hết các hệ thống thực thi UNIX hiện nay đều cung cấp tất cả các kỹ thuật này.

Ngoại trừ điểm cuối cùng liên quan đến tính di động (portability), các điểm khác biệt được liệt kê ở trên đều là ưu điểm nghiêng về phía ánh xạ tệp chia sẻ và các đối tượng bộ nhớ chia sẻ POSIX. Do đó, trong các ứng dụng mới, một trong những giao diện này có thể được ưu tiên hơn bộ nhớ chia sẻ System V. Việc chúng ta chọn giao diện nào phụ thuộc vào việc chúng ta có yêu cầu một kho lưu trữ nền tảng bền vững (persistent backing store) hay không. Các ánh xạ tệp chia sẻ cung cấp kho lưu trữ như vậy; trong khi các đối tượng bộ nhớ chia sẻ POSIX cho phép chúng ta tránh được chi phí chung (overhead) khi sử dụng tệp trên đĩa khi không cần kho lưu trữ nền tảng.

## 54.6 Tổng kết

Một đối tượng bộ nhớ chia sẻ POSIX (POSIX shared memory object) được sử dụng để chia sẻ một vùng bộ nhớ giữa các tiến trình không có quan hệ họ hàng (unrelated processes) với nhau mà không cần tạo ra một tệp đĩa cơ sở. Để làm điều này, chúng ta thay thế lời gọi `open()` vốn thường đi trước `mmap()` bằng một lời gọi `shm_open()`. Lời gọi `shm_open()` tạo ra một tệp trong hệ thống tệp dựa trên bộ nhớ (memory-based file system), và chúng ta có thể sử dụng các System Call thao tác trên File Descriptor (file descriptor system calls) truyền thống để thực hiện các thao tác khác nhau trên tệp ảo này. Cụ thể, `ftruncate()` phải được sử dụng để thiết lập kích thước của đối tượng bộ nhớ chia sẻ, vì ban đầu nó có độ dài bằng không.

Chúng ta đã mô tả ba kỹ thuật để chia sẻ các vùng bộ nhớ giữa các tiến trình không có quan hệ họ hàng: Bộ nhớ chia sẻ System V (System V shared memory), ánh xạ tệp chia sẻ (shared file mappings) và đối tượng bộ nhớ chia sẻ POSIX. Có một số điểm tương đồng giữa ba kỹ thuật này. Ngoài ra cũng có một số điểm khác biệt quan trọng, và ngoại trừ vấn đề tính di động (portability), những điểm khác biệt này nghiêng về phía ánh xạ tệp chia sẻ và đối tượng bộ nhớ chia sẻ POSIX.

## 54.7 Bài tập

**54-1.** Viết lại các chương trình trong Liệt kê 48-2 (`svshm_xfr_writer.c`) và Liệt kê 48-3 (`svshm_xfr_reader.c`) để sử dụng các đối tượng bộ nhớ chia sẻ POSIX thay vì bộ nhớ chia sẻ System V.
