# Chương 15: CÁC THUỘC TÍNH TỆP (FILE ATTRIBUTES)

Trong chương này, chúng ta sẽ tìm hiểu về các thuộc tính khác nhau của tệp (metadata của tệp). Chúng ta bắt đầu với mô tả về system call `stat()`, trả về một cấu trúc chứa nhiều thuộc tính trong số này, bao gồm dấu thời gian của tệp (file timestamps), quyền sở hữu tệp (file ownership) và quyền truy cập tệp (file permissions). Tiếp theo, chúng ta sẽ xem xét các system call khác nhau được sử dụng để thay đổi những thuộc tính này. (Thảo luận về quyền tệp sẽ tiếp tục ở Chương 17, nơi chúng ta xem xét danh sách kiểm soát truy cập - access control lists). Chúng ta kết thúc chương bằng phần thảo luận về các cờ i-node (còn được gọi là các thuộc tính mở rộng tệp của ext2 - ext2 extended file attributes), những cờ này kiểm soát các khía cạnh khác nhau trong cách kernel xử lý tệp.

## 15.1 Truy xuất thông tin tệp: stat()

Các system call `stat()`, `lstat()`, và `fstat()` truy xuất thông tin về một tệp, phần lớn được lấy từ i-node của tệp.

```c
## include <sys/stat.h>
int stat(const char *pathname, struct stat *statbuf);
int lstat(const char *pathname, struct stat *statbuf);
int fstat(int fd, struct stat *statbuf);
                                           Tất cả trả về 0 khi thành công, hoặc –1 khi lỗi
```

Ba system call này chỉ khác nhau ở cách chỉ định tệp:

- `stat()` trả về thông tin về một tệp được chỉ định bằng tên đường dẫn;
- `lstat()` tương tự như `stat()`, ngoại trừ việc nếu tệp được chỉ định là một liên kết tượng trưng (symbolic link), thông tin về chính liên kết đó sẽ được trả về, thay vì thông tin về tệp mà liên kết trỏ tới; và
- `fstat()` trả về thông tin về một tệp được tham chiếu bởi một file descriptor đang mở.

Các system call `stat()` và `lstat()` không yêu cầu quyền trên chính tệp đó. Tuy nhiên, quyền thực thi (tìm kiếm - execute/search permission) là bắt buộc đối với tất cả các thư mục cha được chỉ định trong `pathname`. System call `fstat()` luôn thành công nếu được cung cấp một file descriptor hợp lệ.

Tất cả các system call này đều trả về một cấu trúc `stat` vào bộ đệm được trỏ bởi `statbuf`. Cấu trúc này có dạng như sau:

```
struct stat {
 dev_t st_dev; /* ID của thiết bị chứa tệp */
 ino_t st_ino; /* Số i-node của tệp */
 mode_t st_mode; /* Loại tệp và quyền truy cập */
 nlink_t st_nlink; /* Số lượng liên kết (cứng) tới tệp */
 uid_t st_uid; /* ID người dùng của chủ sở hữu tệp */
 gid_t st_gid; /* ID nhóm của chủ sở hữu tệp */
 dev_t st_rdev; /* ID cho các tệp đặc biệt thiết bị */
 off_t st_size; /* Tổng kích thước tệp (tính bằng byte) */
 blksize_t st_blksize; /* Kích thước khối tối ưu cho I/O (byte) */
 blkcnt_t st_blocks; /* Số lượng khối (512B) được cấp phát */
 time_t st_atime; /* Thời gian truy cập tệp lần cuối */
 time_t st_mtime; /* Thời gian chỉnh sửa tệp lần cuối */
 time_t st_ctime; /* Thời gian thay đổi trạng thái lần cuối */
};
```

Các kiểu dữ liệu khác nhau được sử dụng cho các trường trong cấu trúc `stat` đều được quy định trong SUSv3. Xem Mục 3.6.2 để biết thêm thông tin chi tiết về các kiểu dữ liệu này.

> Theo tiêu chuẩn SUSv3, khi `lstat()` được áp dụng cho một liên kết tượng trưng (symbolic link), nó chỉ cần trả về thông tin hợp lệ trong trường `st_size` và trong thành phần loại tệp (sẽ được mô tả ngay sau đây) của trường `st_mode`. Không có trường nào khác (ví dụ: các trường thời gian) bắt buộc phải chứa thông tin hợp lệ. Điều này tạo sự linh hoạt cho việc triển khai hệ thống trong việc không duy trì các trường đó nhằm tối ưu hiệu năng. Cụ thể, ý đồ của các chuẩn UNIX trước đây là cho phép một liên kết tượng trưng có thể được hiện thực hóa dưới dạng một i-node hoặc dưới dạng một mục (entry) trực tiếp trong thư mục. Dưới cách triển khai thứ hai, hệ thống không thể hỗ trợ đầy đủ tất cả các trường mà cấu trúc `stat` yêu cầu. (Trên tất cả các triển khai UNIX hiện đại ngày nay, liên kết tượng trưng đều được hiện thực hóa dưới dạng i-node). Trên Linux, `lstat()` trả về đầy đủ thông tin trong tất cả các trường của `stat` khi áp dụng cho liên kết tượng trưng.

Trong các trang tiếp theo, chúng ta sẽ xem xét kỹ hơn một số trường của cấu trúc `stat` và kết thúc bằng một chương trình mẫu hiển thị toàn bộ cấu trúc `stat`.

### Device IDs và số i-node

Trường `st_dev` xác định thiết bị mà tệp nằm trên đó. Trường `st_ino` chứa số i-node (i-node number) của tệp. Sự kết hợp giữa `st_dev` và `st_ino` định danh duy nhất một tệp trên tất cả các hệ thống tệp (file system). Kiểu `dev_t` ghi lại ID chính (major ID) và ID phụ (minor ID) của một thiết bị (Mục [14.1](#page-19-0)).

Nếu đây là i-node của một thiết bị, thì trường `st_rdev` chứa ID chính và ID phụ của thiết bị đó.

ID chính và ID phụ của một giá trị kiểu `dev_t` có thể được trích xuất bằng cách sử dụng hai macro: `major()` và `minor()`. Tệp tiêu đề (header file) cần thiết để có được khai báo của hai macro này thay đổi tùy theo các bản cài đặt UNIX. Trên Linux, chúng được cung cấp bởi `<sys/types.h>` nếu macro `_BSD_SOURCE` được định nghĩa.

Kích thước của các giá trị số nguyên do `major()` và `minor()` trả về thay đổi tùy theo từng triển khai UNIX. Để đảm bảo tính khả chuyển (portability), chúng ta luôn ép kiểu (cast) các giá trị trả về thành `long` khi in chúng ra (xem Mục 3.6.2).

### Quyền sở hữu tệp (File ownership)

Các trường `st_uid` và `st_gid` lần lượt xác định chủ sở hữu (user ID) và nhóm (group ID) mà tệp thuộc về.

### Số lượng liên kết (Link count)

Trường `st_nlink` là số lượng liên kết cứng (hard link) trỏ tới tệp. Chúng ta sẽ mô tả chi tiết về các liên kết trong Chương 18.

### Loại tệp và quyền truy cập (File type and permissions)

Trường `st_mode` là một mặt nạ bit (bit mask) đóng vai trò kép: vừa xác định loại tệp (file type), vừa quy định các quyền truy cập tệp (file permissions). Các bit của trường này được bố trí như minh họa trong [Hình 15-1.](#page-48-0)

```text
←─ Loại tệp ─→ ←──────────── Quyền truy cập ────────────→
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│   │   │   │   │ U │ G │ T │ R │ W │ X │ R │ W │ X │ R │ W │ X │
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
                                └───────┘ └───────┘ └───────┘
                                  User      Group      Other
```

**Hình 15-1:** Bố cục của mặt nạ bit `st_mode`

Loại tệp có thể được trích xuất từ trường này bằng phép toán AND theo bit (`&`) với hằng số `S_IFMT`. (Trên Linux, 4 bit được sử dụng cho thành phần loại tệp của trường `st_mode`. Tuy nhiên, do tiêu chuẩn SUSv3 không đưa ra quy định cụ thể về cách biểu diễn loại tệp, chi tiết này có thể thay đổi giữa các hệ thống). Giá trị thu được sau đó có thể được so sánh với một dải hằng số để xác định loại tệp, ví dụ như sau:

```
if ((statbuf.st_mode & S_IFMT) == S_IFREG)
 printf("regular file\n");
```

Vì đây là một thao tác phổ biến, các macro tiêu chuẩn được cung cấp để đơn giản hóa đoạn mã trên thành như sau:

```
if (S_ISREG(statbuf.st_mode))
 printf("regular file\n");
```

Toàn bộ tập hợp các macro kiểm tra loại tệp (được định nghĩa trong `<sys/stat.h>`) được thể hiện trong Bảng 15-1. Tất cả các macro loại tệp trong Bảng 15-1 đều được quy định trong SUSv3 và có mặt trên Linux. Một số hệ thống UNIX khác định nghĩa thêm các loại tệp bổ sung (ví dụ: `S_IFDOOR`, dùng cho tệp door trên Solaris). Loại `S_IFLNK` chỉ được trả về bởi các lời gọi hàm `lstat()`, vì các lời gọi `stat()` luôn đi theo các liên kết tượng trưng (symbolic link).

Tiêu chuẩn POSIX.1 ban đầu không quy định các hằng số được hiển thị ở cột đầu tiên của Bảng 15-1, mặc dù phần lớn chúng xuất hiện trên hầu hết các hệ thống UNIX. Tiêu chuẩn SUSv3 yêu cầu các hằng số này.

> Để lấy được các định nghĩa của `S_IFSOCK` và `S_ISSOCK()` từ `<sys/stat.h>`, chúng ta phải định nghĩa macro kiểm tra tính năng `_BSD_SOURCE` hoặc định nghĩa `_XOPEN_SOURCE` với giá trị lớn hơn hoặc bằng 500. (Các quy tắc có đôi chút khác biệt giữa các phiên bản glibc: trong một số trường hợp, `_XOPEN_SOURCE` phải được định nghĩa với giá trị từ 600 trở lên).

| Bảng 15-1: Các macro kiểm tra loại tệp trong trường st_mode của cấu trúc stat |  |
|------------------------------------------------------------------------------|--|
|                                                                              |  |

| Hằng số | Macro kiểm tra | Loại tệp           |
|---------|----------------|--------------------|
| S_IFREG | S_ISREG()      | Tệp thường (Regular file) |
| S_IFDIR | S_ISDIR()      | Thư mục (Directory)|
| S_IFCHR | S_ISCHR()      | Thiết bị ký tự (Character device) |
| S_IFBLK | S_ISBLK()      | Thiết bị khối (Block device) |
| S_IFIFO | S_ISFIFO()     | FIFO hoặc đường ống (pipe) |
| S_IFSOCK| S_ISSOCK()     | Socket             |
| S_IFLNK | S_ISLNK()      | Liên kết tượng trưng (Symbolic link) |

12 bit thấp của trường `st_mode` định nghĩa các quyền truy cập cho tệp. Chúng ta sẽ mô tả các bit quyền truy cập tệp trong Mục [15.4](#page-61-1). Hiện tại, chúng ta chỉ cần lưu ý rằng 9 bit ít có ý nghĩa nhất (least significant bits) trong các bit quyền chính là quyền đọc (read), quyền ghi (write) và quyền thực thi (execute) cho từng nhóm đối tượng: chủ sở hữu (owner), nhóm (group) và các đối tượng khác (other).

### Kích thước tệp, các khối được cấp phát và kích thước khối I/O tối ưu

Đối với các tệp thông thường (regular files), trường `st_size` là tổng kích thước của tệp tính bằng byte. Đối với một liên kết tượng trưng (symbolic link), trường này chứa chiều dài (tính bằng byte) của tên đường dẫn mà liên kết trỏ tới. Đối với một đối tượng bộ nhớ chia sẻ (shared memory object) (Chương 54), trường này chứa kích thước của đối tượng đó.

Trường `st_blocks` biểu thị tổng số khối được cấp phát cho tệp, tính theo đơn vị khối 512-byte. Tổng số này bao gồm dung lượng được cấp phát cho các khối con trỏ (pointer blocks) (xem [Hình 14-2,](#page-25-0) ở trang [258\)](#page-25-0). Việc lựa chọn đơn vị đo lường 512-byte mang tính lịch sử—đây là kích thước khối nhỏ nhất trên bất kỳ hệ thống tệp (file system) nào từng được triển khai dưới hệ điều hành UNIX. Các hệ thống tệp hiện đại hơn sử dụng kích thước khối logic (logical block sizes) lớn hơn. Ví dụ, dưới hệ thống tệp ext2, giá trị trong `st_blocks` luôn là bội số của 2, 4 hoặc 8, tùy thuộc vào việc kích thước khối logic của ext2 là 1024, 2048 hay 4096 byte.

> SUSv3 không định nghĩa các đơn vị mà `st_blocks` được đo lường, điều này cho phép khả năng một bản triển khai sử dụng một đơn vị khác ngoài 512 byte. Hầu hết các bản triển khai UNIX đều sử dụng đơn vị 512-byte, nhưng HP-UX 11 sử dụng các đơn vị đặc trưng cho hệ thống tệp (ví dụ: 1024 byte trong một số trường hợp).

Trường `st_blocks` ghi lại số lượng khối đĩa thực tế được cấp phát. Nếu tệp chứa các khoảng trống (holes) (Mục 4.7), giá trị này sẽ nhỏ hơn mức có thể mong đợi từ số lượng byte tương ứng (`st_size`) có trong tệp. (Lệnh sử dụng đĩa, `du –k file`, hiển thị dung lượng thực tế được cấp phát cho một tệp tính bằng kilobyte; nghĩa là, một con số được tính toán từ giá trị `st_blocks` của tệp, thay vì giá trị `st_size`.)

Trường `st_blksize` có tên gọi hơi gây hiểu lầm. Đây không phải là kích thước khối của hệ thống tệp bên dưới, mà đúng hơn là kích thước khối tối ưu (tính bằng byte) cho các thao tác I/O trên các tệp thuộc hệ thống tệp này. Các thao tác I/O trong các khối nhỏ hơn kích thước này sẽ kém hiệu quả hơn (tham khảo Mục [13.1](#page-0-1)). Một giá trị tiêu biểu được trả về trong `st_blksize` là 4096.

### Các mốc thời gian của tệp (File timestamps)

Các trường `st_atime`, `st_mtime` và `st_ctime` lần lượt chứa thời điểm truy cập tệp lần cuối, thời điểm sửa đổi tệp lần cuối và thời điểm thay đổi trạng thái lần cuối. Các trường này có kiểu `time_t`, định dạng thời gian tiêu chuẩn của UNIX tính bằng số giây kể từ thời điểm mốc (Epoch). Chúng ta sẽ bàn kỹ hơn về các trường này trong Mục [15.2.](#page-52-0)

### Chương trình ví dụ

Chương trình trong [Danh sách 15-1](#page-51-0) sử dụng hàm `stat()` để truy xuất thông tin về tệp được chỉ định trên dòng lệnh của nó. Nếu tùy chọn dòng lệnh `–l` được chỉ định, chương trình sẽ thay thế bằng cách sử dụng hàm `lstat()` để chúng ta có thể truy xuất thông tin về một liên kết tượng trưng (symbolic link) thay vì tệp mà nó trỏ tới. Chương trình in ra tất cả các trường của cấu trúc `stat` được trả về. (Để có lời giải thích về lý do tại sao chúng ta ép kiểu các trường `st_size` và `st_blocks` sang kiểu `long long`, hãy xem Mục 5.10.) Hàm `filePermStr()` được sử dụng bởi chương trình này được thể hiện trong [Danh sách 15-4,](#page-63-0) ở trang [296.](#page-63-0)

Dưới đây là một ví dụ về việc sử dụng chương trình:

```
$ echo 'All operating systems provide services for programs they run' > apue
$ chmod g+s apue Bật bit set-group-ID; ảnh hưởng đến thời gian thay đổi trạng thái lần cuối
$ cat apue Ảnh hưởng đến thời gian truy cập tệp lần cuối
All operating systems provide services for programs they run
$ ./t_stat apue
File type: regular file
Device containing i-node: major=3 minor=11
I-node number: 234363
Mode: 102644 (rw-r--r--)
 special bits set: set-GID
Number of (hard) links: 1
Ownership: UID=1000 GID=100
File size: 61 bytes
Optimal I/O block size: 4096 bytes
512B blocks allocated: 8
Last file access: Mon Jun 8 09:40:07 2011
Last file modification: Mon Jun 8 09:39:25 2011
Last status change: Mon Jun 8 09:39:51 2011
```

**Danh sách 15-1:** Truy xuất và giải thích thông tin stat của tệp

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/t_stat.c
## define _BSD_SOURCE /* Lấy major() và minor() từ <sys/types.h> */
## include <sys/types.h>
## include <sys/stat.h>
## include <time.h>
## include "file_perms.h"
## include "tlpi_hdr.h"
static void
displayStatInfo(const struct stat *sb)
{
 printf("File type: ");
   switch (sb->st_mode & S_IFMT) {
 case S_IFREG: printf("regular file\n"); break;
 case S_IFDIR: printf("directory\n"); break;
 case S_IFCHR: printf("character device\n"); break;
 case S_IFBLK: printf("block device\n"); break;
 case S_IFLNK: printf("symbolic (soft) link\n"); break;
 case S_IFIFO: printf("FIFO or pipe\n"); break;
 case S_IFSOCK: printf("socket\n"); break;
 default: printf("unknown file type?\n"); break;
 }
 printf("Device containing i-node: major=%ld minor=%ld\n",
 (long) major(sb->st_dev), (long) minor(sb->st_dev));
   printf("I-node number: %ld\n", (long) sb->st_ino);
 printf("Mode: %lo (%s)\n",
 (unsigned long) sb->st_mode, filePermStr(sb->st_mode, 0));
   if (sb->st_mode & (S_ISUID | S_ISGID | S_ISVTX))
 printf(" special bits set: %s%s%s\n",
 (sb->st_mode & S_ISUID) ? "set-UID " : "",
 (sb->st_mode & S_ISGID) ? "set-GID " : "",
 (sb->st_mode & S_ISVTX) ? "sticky " : "");
 printf("Number of (hard) links: %ld\n", (long) sb->st_nlink);
   printf("Ownership: UID=%ld GID=%ld\n",
 (long) sb->st_uid, (long) sb->st_gid);
 if (S_ISCHR(sb->st_mode) || S_ISBLK(sb->st_mode))
 printf("Device number (st_rdev): major=%ld; minor=%ld\n",
 (long) major(sb->st_rdev), (long) minor(sb->st_rdev));
 printf("File size: %lld bytes\n", (long long) sb->st_size);
 printf("Optimal I/O block size: %ld bytes\n", (long) sb->st_blksize);
 printf("512B blocks allocated: %lld\n", (long long) sb->st_blocks);
```

```c
 printf("Last file access: %s", ctime(&sb->st_atime));
 printf("Last file modification: %s", ctime(&sb->st_mtime));
 printf("Last status change: %s", ctime(&sb->st_ctime));
}
int
main(int argc, char *argv[])
{
 struct stat sb;
 Boolean statLink; /* True if "-l" specified (i.e., use lstat) */
 int fname; /* Location of filename argument in argv[] */
 statLink = (argc > 1) && strcmp(argv[1], "-l") == 0;
 /* Simple parsing for "-l" */
 fname = statLink ? 2 : 1;
 if (fname >= argc || (argc > 1 && strcmp(argv[1], "--help") == 0))
 usageErr("%s [-l] file\n"
 " -l = use lstat() instead of stat()\n", argv[0]);
 if (statLink) {
 if (lstat(argv[fname], &sb) == -1)
 errExit("lstat");
 } else {
 if (stat(argv[fname], &sb) == -1)
 errExit("stat");
 }
 displayStatInfo(&sb);
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/t_stat.c
```

## 15.2 Thời gian của tệp (File Timestamps)

Các trường `st_atime`, `st_mtime` và `st_ctime` của cấu trúc `stat` chứa thông tin về thời gian của tệp (file timestamp). Các trường này lần lượt ghi lại thời gian lần truy cập tệp cuối cùng, lần sửa đổi tệp cuối cùng, và lần thay đổi trạng thái tệp cuối cùng (tức là lần thay đổi cuối cùng đối với thông tin i-node của tệp). Thời gian được ghi lại tính bằng số giây kể từ thời điểm mốc (Epoch - 1 tháng 1 năm 1970; xem Mục 10.1).

Hầu hết các hệ thống tệp (file system) gốc của Linux và UNIX đều hỗ trợ tất cả các trường thời gian này, nhưng một số hệ thống tệp không phải UNIX có thể không hỗ trợ.

Bảng 15-2 tóm tắt các trường thời gian nào (và trong một số trường hợp, các trường tương tự trong thư mục cha) bị thay đổi bởi các System Call (System Call) và hàm thư viện khác nhau được mô tả trong cuốn sách này. Trong các tiêu đề của bảng này, `a`, `m` và `c` lần lượt đại diện cho các trường `st_atime`, `st_mtime` và `st_ctime`. Trong phần lớn các trường hợp, thời gian liên quan được thiết lập thành thời gian hiện tại bởi System Call. Ngoại lệ là `utime()` và các lời gọi tương tự (được thảo luận trong Mục [15.2.1](#page-54-0) và [15.2.2](#page-56-0)), có thể được sử dụng để thiết lập tường minh thời gian truy cập và sửa đổi tệp cuối cùng thành các giá trị tùy ý.

**Bảng 15-2:** Ảnh hưởng của các hàm khác nhau đối với thời gian của tệp

| Hàm             |   | Tệp hoặc<br>thư mục |   |   | Thư mục cha |   | Ghi chú                                                                                                                                      |
|-----------------|---|---------------------|---|---|-------------|---|----------------------------------------------------------------------------------------------------------------------------------------------|
|                 | a | m                   | c | a | m           | c |                                                                                                                                              |
| chmod()         |   |                     | • |   |             |   | Tương tự cho fchmod()                                                                                                                        |
| chown()         |   |                     | • |   |             |   | Tương tự cho lchown() và fchown()                                                                                                            |
| exec()          | • |                     |   |   |             |   |                                                                                                                                              |
| link()          |   |                     | • |   | •           | • | Ảnh hưởng đến thư mục cha của đối số thứ hai                                                                                                 |
| mkdir()         | • | •                   | • |   | •           | • |                                                                                                                                              |
| mkfifo()        | • | •                   | • |   | •           | • |                                                                                                                                              |
| mknod()         | • | •                   | • |   | •           | • |                                                                                                                                              |
| mmap()          | • | •                   | • |   |             |   | `st_mtime` và `st_ctime` chỉ thay đổi khi cập nhật<br>ánh xạ `MAP_SHARED`                                                                    |
| msync()         |   | •                   | • |   |             |   | Chỉ thay đổi nếu tệp bị sửa đổi                                                                                                              |
| open(), creat() | • | •                   | • |   | •           | • | Khi tạo tệp mới                                                                                                                              |

```

| open(), creat() |   | •                    | • |   |                     |   | Khi cắt ngắn (truncate) tệp tin hiện có                                                                                                       |
| pipe()          | • | •                    | • |   |                     |   |                                                                                                                                              |
| read()          | • |                      |   |   |                     |   | Tương tự cho `readv()`, `pread()`, và `preadv()`                                                                                             |
| readdir()       | • |                      |   |   |                     |   | `readdir()` có thể đệm (buffer) các mục thư mục; dấu thời gian (timestamp)<br>chỉ được cập nhật nếu thư mục được đọc                         |
| removexattr()   |   |                      | • |   |                     |   | Tương tự cho `fremovexattr()` và `lremovexattr()`                                                                                            |
| rename()        |   |                      | • |   | •                   | • | Ảnh hưởng đến dấu thời gian ở cả hai thư mục cha;<br>SUSv3 không quy định việc thay đổi `st_ctime` của tệp, nhưng<br>lưu ý rằng một số cài đặt thực hiện việc này |
| rmdir()         |   |                      |   |   | •                   | • | Tương tự cho `remove(directory)`                                                                                                             |
| sendfile()      | • |                      |   |   |                     |   | Dấu thời gian thay đổi đối với tệp đầu vào                                                                                                   |
| setxattr()      |   |                      | • |   |                     |   | Tương tự cho `fsetxattr()` và `lsetxattr()`                                                                                                  |
| symlink()       | • | •                    | • |   | •                   | • | Thiết lập dấu thời gian của liên kết (không phải tệp đích)                                                                                   |
| truncate()      |   | •                    | • |   |                     |   | Tương tự cho `ftruncate()`; dấu thời gian chỉ thay đổi nếu<br>kích thước tệp thay đổi                                                        |
| unlink()        |   |                      | • |   | •                   | • | Tương tự cho `remove(file)`; `st_ctime` của tệp thay đổi nếu<br>số lượng liên kết trước đó lớn hơn 1                                         |
| utime()         | • | •                    | • |   |                     |   | Tương tự cho `utimes()`, `futimes()`, `futimens()`, `lutimes()`,<br>và `utimensat()`                                                         |
| write()         |   | •                    | • |   |                     |   | Tương tự cho `writev()`, `pwrite()`, và `pwritev()`                                                                                          |

Trong các Mục [14.8.1](#page-31-1) và [15.5](#page-71-1), chúng tôi mô tả các tùy chọn `mount(2)` và các cờ trên mỗi tệp (per-file flags) giúp ngăn chặn việc cập nhật thời gian truy cập lần cuối (last access time) của một tệp. Cờ `open()` `O_NOATIME` được mô tả trong Mục 4.3.1 cũng phục vụ một mục đích tương tự. Trong một số ứng dụng, điều này có thể hữu ích vì lý do hiệu năng (performance), vì nó làm giảm số lượng thao tác đĩa (disk operations) được yêu cầu khi một tệp được truy cập.

> Mặc dù hầu hết các hệ thống UNIX không ghi lại thời gian tạo của một tệp, trên các hệ thống BSD gần đây, thời gian này được ghi lại trong một trường `stat` có tên là `st_birthtime`.

### Nhãn thời gian độ chính xác nano giây (Nanosecond timestamps)

Từ phiên bản 2.6, Linux hỗ trợ độ chính xác nano giây cho ba trường nhãn thời gian (timestamp fields) của cấu trúc `stat`. Độ chính xác nano giây giúp cải thiện độ chính xác của các chương trình cần đưa ra quyết định dựa trên thứ tự tương đối của các nhãn thời gian tập tin (ví dụ: `make(1)`).

Chuẩn SUSv3 không quy định nhãn thời gian độ chính xác nano giây cho cấu trúc `stat`, nhưng SUSv4 đã bổ sung quy định này.

Không phải tất cả các hệ thống tập tin (file systems) đều hỗ trợ nhãn thời gian độ chính xác nano giây. JFS, XFS, ext4 và Btrfs có hỗ trợ, nhưng ext2, ext3 và Reiserfs thì không.

Dưới API của glibc (từ phiên bản 2.3), mỗi trường nhãn thời gian được định nghĩa như một cấu trúc `timespec` (chúng ta sẽ mô tả cấu trúc này khi thảo luận về `utimensat()` sau trong phần này), biểu diễn thời gian gồm các thành phần giây và nano giây. Các định nghĩa macro phù hợp giúp thành phần giây của các cấu trúc này hiển thị bằng cách sử dụng các tên trường truyền thống (`st_atime`, `st_mtime` và `st_ctime`). Các thành phần nano giây có thể được truy cập bằng các tên trường như `st_atim.tv_nsec`, dùng cho thành phần nano giây của thời gian truy cập tập tin lần cuối.

### 15.2.1 Thay đổi nhãn thời gian tập tin bằng utime() và utimes()

Nhãn thời gian truy cập và sửa đổi tập tin lần cuối được lưu trữ trong i-node của tập tin có thể được thay đổi một cách rõ ràng bằng cách sử dụng `utime()` hoặc một trong số các System Call có liên quan. Các chương trình như `tar(1)` và `unzip(1)` sử dụng các System Call này để thiết lập lại nhãn thời gian tập tin khi giải nén một tệp lưu trữ (archive).

```c

## include <utime.h>

int utime(const char *pathname, const struct utimbuf *buf);
Trả về 0 khi thành công, hoặc –1 nếu lỗi

```

Tham số `pathname` xác định tệp mà chúng ta muốn chỉnh sửa thời gian. Nếu `pathname` là một liên kết tượng trưng (symbolic link), nó sẽ được giải tham chiếu (dereferenced). Tham số `buf` có thể là `NULL` hoặc con trỏ trỏ đến một cấu trúc `utimbuf`:

```c

struct utimbuf {
time_t actime;  /* Thời gian truy cập */
time_t modtime; /* Thời gian sửa đổi */
};

```

Các trường trong cấu trúc này đo thời gian tính bằng số giây kể từ thời điểm mốc (Epoch) (Mục 10.1). Hai trường hợp khác nhau quyết định cách thức hoạt động của `utime()`:

 Nếu `buf` được chỉ định là `NULL`, thì cả thời gian truy cập lần cuối và thời gian sửa đổi lần cuối đều được thiết lập thành thời gian hiện tại. Trong trường hợp này, hoặc User ID hiệu dụng (effective user ID) của tiến trình (Process) phải khớp với User ID của tập tin (chủ sở hữu), tiến trình phải có quyền ghi (write permission) trên tập tin (điều này hợp lý, vì một tiến trình có quyền ghi trên tập tin có thể sử dụng các System Call khác có tác dụng phụ làm thay đổi các nhãn thời gian tập tin này), hoặc tiến trình phải có đặc quyền (privileged) (`CAP_FOWNER` hoặc `CAP_DAC_OVERRIDE`). (Để chính xác, trên Linux, User ID trên hệ thống tập tin của tiến trình, thay vì User ID hiệu dụng của nó, mới là thứ được kiểm tra so với User ID của tập tin, như được mô tả trong Mục 9.5).

 Nếu `buf` được chỉ định là một con trỏ trỏ đến cấu trúc `utimbuf`, thì thời gian truy cập và sửa đổi tập tin lần cuối được cập nhật bằng cách sử dụng các trường tương ứng của cấu trúc này. Trong trường hợp này, User ID hiệu dụng của tiến trình phải khớp với User ID của tập tin (việc có quyền ghi trên tập tin là chưa đủ) hoặc tiến trình gọi phải có đặc quyền (`CAP_FOWNER`).

Để chỉ thay đổi một trong các nhãn thời gian tập tin, trước tiên chúng ta sử dụng `stat()` để lấy cả hai mốc thời gian, sử dụng một trong các mốc thời gian này để khởi tạo cấu trúc `utimbuf`, và sau đó thiết lập mốc thời gian còn lại theo ý muốn. Điều này được minh họa trong đoạn mã sau, trong đó thời gian sửa đổi lần cuối của một tập tin được làm cho giống với thời gian truy cập lần cuối của nó:

```

struct stat sb;
struct utimbuf utb;
if (stat(pathname, &sb) == -1)
errExit("stat");
utb.actime = sb.st_atime; /* Giữ nguyên thời gian truy cập */
utb.modtime = sb.st_atime;
if (utime(pathname, &utb) == -1)
errExit("utime");

```

Một lời gọi thành công đến `utime()` luôn đặt thời gian thay đổi trạng thái lần cuối (last status change time) thành thời gian hiện tại.

Linux cũng cung cấp System Call `utimes()` có nguồn gốc từ BSD, thực hiện tác vụ tương tự như `utime()`.

```

## include <sys/time.h>

int utimes(const char *pathname, const struct timeval tv[2]);
Trả về 0 khi thành công, hoặc –1 nếu lỗi

```

Sự khác biệt đáng chú ý nhất giữa `utime()` và `utimes()` là `utimes()` cho phép các giá trị thời gian được chỉ định với độ chính xác micro giây (cấu trúc `timeval` được mô tả trong Mục 10.1). Điều này cung cấp quyền truy cập (một phần) vào độ chính xác nano giây mà nhãn thời gian tập tin được cung cấp trong Linux 2.6. Thời gian truy cập tập tin mới được chỉ định trong `tv[0]`, và thời gian sửa đổi mới được chỉ định trong `tv[1]`.

> Một ví dụ về việc sử dụng `utimes()` được cung cấp trong tập tin `files/t_utimes.c` trong mã nguồn phân phối của cuốn sách này.

Các hàm thư viện `futimes()` và `lutimes()` thực hiện tác vụ tương tự như `utimes()`. Chúng khác với `utimes()` ở tham số được sử dụng để chỉ định tập tin có nhãn thời gian cần thay đổi.

```

## include <sys/time.h>

int futimes(int fd, const struct timeval tv[2]);
int lutimes(const char *pathname, const struct timeval tv[2]);
Cả hai đều trả về 0 khi thành công, hoặc –1 nếu lỗi

```

Với `futimes()`, tệp được chỉ định thông qua một tệp mô tả (file descriptor) đang mở, `fd`.

Với `lutimes()`, tệp được chỉ định thông qua một đường dẫn (pathname), điểm khác biệt so với `utimes()` là nếu đường dẫn trỏ đến một liên kết tượng trưng (symbolic link), thì liên kết đó không được giải tham chiếu (dereference); thay vào đó, dấu thời gian (timestamp) của chính liên kết đó sẽ bị thay đổi.

Hàm `futimes()` được hỗ trợ kể từ glibc 2.3. Hàm `lutimes()` được hỗ trợ kể từ glibc 2.6.

### 15.2.2 Thay đổi Dấu thời gian Tệp với utimensat() và futimens()

System call `utimensat()` (được hỗ trợ từ kernel 2.6.22) và hàm thư viện `futimens()` (được hỗ trợ từ glibc 2.6) cung cấp chức năng mở rộng để thiết lập dấu thời gian lần truy cập cuối cùng (last access) và lần sửa đổi cuối cùng (last modification) của tệp. Những ưu điểm của các giao diện này bao gồm:

- Chúng ta có thể thiết lập dấu thời gian với độ chính xác đến nano-giây (nanosecond). Điều này cải thiện hơn mức độ chính xác micro-giây do `utimes()` cung cấp.
- Có thể thiết lập các dấu thời gian một cách độc lập (tức là từng cái một). Như đã chỉ ra trước đó, để thay đổi chỉ một trong các dấu thời gian bằng cách sử dụng các giao diện cũ, trước tiên chúng ta phải gọi `stat()` để lấy giá trị của dấu thời gian kia, sau đó chỉ định giá trị vừa lấy được cùng với dấu thời gian mà chúng ta muốn thay đổi. (Điều này có thể dẫn đến tình trạng tranh chấp điều kiện (race condition) nếu một tiến trình (process) khác thực hiện một thao tác cập nhật dấu thời gian giữa hai bước này).
- Chúng ta có thể thiết lập độc lập một trong hai dấu thời gian thành thời gian hiện tại. Để thay đổi chỉ một dấu thời gian thành thời gian hiện tại bằng các giao diện cũ, chúng ta cần gọi `stat()` để lấy thiết lập của dấu thời gian mà chúng ta muốn giữ nguyên, và gọi `gettimeofday()` để lấy thời gian hiện tại.

Các giao diện này không được quy định trong SUSv3, nhưng đã được bao gồm trong SUSv4.

System call `utimensat()` cập nhật dấu thời gian của tệp được chỉ định bởi `pathname` thành các giá trị được chỉ định trong mảng `times`.

```

## define _XOPEN_SOURCE 700 /* Hoặc định nghĩa _POSIX_C_SOURCE >= 200809 */

## include <sys/stat.h>

int utimensat(int dirfd, const char *pathname,
const struct timespec times[2], int flags);
Trả về 0 khi thành công, hoặc –1 nếu lỗi

```

Nếu `times` được chỉ định là `NULL`, thì cả hai dấu thời gian của tệp được cập nhật thành thời gian hiện tại. Nếu `times` khác `NULL`, thì dấu thời gian truy cập lần cuối mới được chỉ định trong `times[0]` và dấu thời gian sửa đổi lần cuối mới được chỉ định trong `times[1]`. Mỗi phần tử của mảng `times` là một cấu trúc (structure) có dạng sau:

```

struct timespec {
time_t tv_sec; /* Giây ('time_t' là một kiểu số nguyên) */
long tv_nsec; /* Nano-giây */
};

```

Các trường trong cấu trúc này chỉ định thời gian tính bằng giây và nano-giây kể từ mốc thời gian Epoch (Mục 10.1).

Để thiết lập một trong các dấu thời gian thành thời gian hiện tại, chúng ta chỉ định giá trị đặc biệt `UTIME_NOW` trong trường `tv_nsec` tương ứng. Để giữ nguyên một trong các dấu thời gian, chúng ta chỉ định giá trị đặc biệt `UTIME_OMIT` trong trường `tv_nsec` tương ứng. Trong cả hai trường hợp, giá trị trong trường `tv_sec` tương ứng sẽ bị bỏ qua.

Đối số `dirfd` có thể chỉ định `AT_FDCWD`, trong trường hợp này đối số `pathname` được hiểu giống như đối số trong `utimes()`, hoặc nó có thể chỉ định một tệp mô tả tham chiếu đến một thư mục. Mục đích của lựa chọn thứ hai được mô tả trong Mục 18.11.

Đối số `flags` có thể là `0` hoặc `AT_SYMLINK_NOFOLLOW`, có nghĩa là `pathname` không được giải tham chiếu nếu nó là một liên kết tượng trưng (tức là dấu thời gian của chính liên kết tượng trưng đó phải được thay đổi). Ngược lại, `utimes()` luôn giải tham chiếu các liên kết tượng trưng.

Đoạn mã sau thiết lập thời gian truy cập lần cuối thành thời gian hiện tại và giữ nguyên thời gian sửa đổi lần cuối:

```

struct timespec times[2];
times[0].tv_sec = 0;
times[0].tv_nsec = UTIME_NOW;
times[1].tv_sec = 0;
times[1].tv_nsec = UTIME_OMIT;
if (utimensat(AT_FDCWD, "myfile", times, 0) == -1)
errExit("utimensat");

```

Các quy tắc phân quyền để thay đổi dấu thời gian bằng `utimensat()` (và `futimens()`) tương tự như các quy tắc đối với API cũ và được trình bày chi tiết trong trang hướng dẫn (manual page) `utimensat(2)`.

Hàm thư viện `futimens()` cập nhật dấu thời gian của tệp được tham chiếu bởi tệp mô tả đang mở `fd`.

```

## include _GNU_SOURCE

## include <sys/stat.h>

int futimens(int fd, const struct timespec times[2]);
Trả về 0 khi thành công, hoặc –1 nếu lỗi

```

Đối số `times` của `futimens()` được sử dụng tương tự như đối với `utimensat()`.

## 15.3 Quyền sở hữu Tệp (File Ownership)

Mỗi tệp đều có một ID người dùng (User ID - UID) và ID nhóm (Group ID - GID) đi kèm. Các ID này xác định tệp thuộc về người dùng và nhóm nào. Bây giờ chúng ta sẽ xem xét các quy tắc xác định quyền sở hữu của các tệp mới và mô tả các system call được sử dụng để thay đổi quyền sở hữu của tệp.

### 15.3.1 Quyền sở hữu tệp mới (Ownership of New Files)

Khi một tệp mới được tạo, ID người dùng (user ID) của nó được lấy từ ID người dùng hiệu dụng (effective user ID) của tiến trình (process). ID nhóm (group ID) của tệp mới có thể được lấy từ ID nhóm hiệu dụng (effective group ID) của tiến trình (tương đương với hành vi mặc định của System V) hoặc ID nhóm của thư mục cha (hành vi của BSD). Khả năng thứ hai rất hữu ích khi tạo các thư mục dự án trong đó tất cả các tệp thuộc về một nhóm cụ thể và các thành viên của nhóm đó có thể truy cập được. Giá trị nào trong hai giá trị được sử dụng làm ID nhóm của tệp mới được xác định bởi nhiều yếu tố khác nhau, bao gồm cả loại hệ thống tệp (file system) mà trên đó tệp mới được tạo. Chúng ta bắt đầu bằng cách mô tả các quy tắc được tuân thủ bởi ext2 và một số hệ thống tệp khác.

> Để chính xác, trên Linux, tất cả các lần sử dụng thuật ngữ ID người dùng hoặc nhóm hiệu dụng (effective user or group ID) trong phần này thực chất phải là ID người dùng hoặc nhóm của hệ thống tệp (file-system user or group ID) (Mục 9.5).

Khi một hệ thống tệp ext2 được gắn kết (mount), tùy chọn `-o grpid` (hoặc từ đồng nghĩa `-o bsdgroups`) hoặc tùy chọn `-o nogrpid` (hoặc từ đồng nghĩa `-o sysvgroups`) có thể được chỉ định cho lệnh `mount`. (Nếu không có tùy chọn nào được chỉ định, mặc định là `-o nogrpid`.) Nếu `-o grpid` được chỉ định, thì tệp mới sẽ luôn kế thừa ID nhóm của nó từ thư mục cha. Nếu `-o nogrpid` được chỉ định, thì theo mặc định, tệp mới sẽ lấy ID nhóm từ ID nhóm hiệu dụng của tiến trình. Tuy nhiên, nếu bit set-group-ID được bật cho thư mục (thông qua `chmod g+s`), thì ID nhóm của tệp được kế thừa từ thư mục cha. Các quy tắc này được tóm tắt trong Bảng 15-3.

> Trong Mục 18.6, chúng ta sẽ thấy rằng khi bit set-group-ID được bật trên một thư mục, thì nó cũng được bật trên các thư mục con mới được tạo bên trong thư mục đó. Bằng cách này, hành vi set-group-ID được mô tả trong phần nội dung chính sẽ được truyền lan xuyên suốt toàn bộ cấu trúc cây thư mục (directory tree).

| Tùy chọn gắn kết<br>hệ thống tệp (File system mount option) | Bit set-group-ID được bật<br>trên thư mục cha? | Quyền sở hữu nhóm của<br>tệp mới được lấy từ | |
|-----------------------------------------------------------|------------------------------------------------|----------------------------------------------|--|
| –o grpid, –o bsdgroups | (bỏ qua) | ID nhóm của thư mục cha | |
| –o nogrpid, –o sysvgroups | không | ID nhóm hiệu dụng của tiến trình | |
| (mặc định) | có | ID nhóm của thư mục cha | |

**Bảng 15-3:** Các quy tắc xác định quyền sở hữu nhóm của một tệp mới được tạo

Tại thời điểm viết bài, các hệ thống tệp duy nhất hỗ trợ các tùy chọn gắn kết `grpid` và `nogrpid` là ext2, ext3, ext4 và (kể từ Linux 2.6.14) XFS. Các hệ thống tệp khác tuân theo các quy tắc của `nogrpid`.

### 15.3.2 Thay đổi quyền sở hữu tệp: chown(), fchown() và lchown()

Các system call (lệnh hệ thống) `chown()`, `lchown()` và `fchown()` thay đổi chủ sở hữu (user ID) và nhóm (group ID) của một tệp.

```c

## include <unistd.h>

int chown(const char *pathname, uid_t owner, gid_t group);

## define _XOPEN_SOURCE 500 /* Hoặc: #define _BSD_SOURCE */

## include <unistd.h>

int lchown(const char *pathname, uid_t owner, gid_t group);
int fchown(int fd, uid_t owner, gid_t group);
Tất cả trả về 0 nếu thành công, hoặc –1 nếu lỗi

```

Sự khác biệt giữa ba system call này tương tự như họ system call `stat()`:

- `chown()` thay đổi quyền sở hữu của tệp được chỉ định trong tham số `pathname`;
- `lchown()` thực hiện tương tự, ngoại trừ việc nếu `pathname` là một liên kết tượng trưng (symbolic link), thì quyền sở hữu của tệp liên kết được thay đổi, thay vì tệp mà nó trỏ tới; và
- `fchown()` thay đổi quyền sở hữu của tệp được trỏ bởi File Descriptor (mô tả tệp) đang mở, `fd`.

Tham số `owner` chỉ định ID người dùng mới cho tệp và tham số `group` chỉ định ID nhóm mới cho tệp. Để chỉ thay đổi một trong các ID, chúng ta có thể chỉ định `-1` cho tham số còn lại để giữ nguyên ID đó.

> Trước Linux 2.2, `chown()` không giải tham chiếu (dereference) các liên kết tượng trưng. Ngữ nghĩa của `chown()` đã được thay đổi kể từ Linux 2.2 và system call `lchown()` mới được thêm vào để cung cấp hành vi của system call `chown()` cũ.

Chỉ một tiến trình có đặc quyền (privileged process) (`CAP_CHOWN`) mới có thể sử dụng `chown()` để thay đổi ID người dùng của một tệp. Một tiến trình không có đặc quyền (unprivileged process) có thể sử dụng `chown()` để thay đổi ID nhóm của một tệp thuộc sở hữu của chính nó (nghĩa là ID người dùng hiệu dụng của tiến trình khớp với ID người dùng của tệp) thành bất kỳ nhóm nào mà tiến trình đó là thành viên. Một tiến trình có đặc quyền có thể thay đổi ID nhóm của tệp thành bất kỳ giá trị nào.

Nếu chủ sở hữu hoặc nhóm của một tệp bị thay đổi, thì cả hai bit quyền set-user-ID và set-group-ID đều bị tắt. Đây là một biện pháp phòng ngừa bảo mật nhằm đảm bảo rằng người dùng bình thường không thể bật bit set-user-ID (hoặc set-group-ID) trên một tệp thực thi và sau đó bằng cách nào đó làm cho nó thuộc sở hữu của một người dùng (hoặc nhóm) có đặc quyền nào đó, từ đó có được danh tính đặc quyền đó khi thực thi tệp.

> SUSv3 không quy định rõ liệu các bit set-user-ID và set-group-ID có bị tắt hay không khi siêu người dùng (superuser) thay đổi chủ sở hữu (owner) hoặc nhóm (group) của một tệp thực thi (executable file). Linux 2.0 đã thực hiện tắt các bit này trong trường hợp đó, trong khi một số phiên bản kernel 2.2 đầu (lên đến 2.2.12) thì không. Các phiên bản kernel 2.2 sau đó đã quay trở lại hành vi của phiên bản 2.0, trong đó các thay đổi của siêu người dùng được đối xử giống như mọi người dùng khác, và hành vi này được duy trì ở các phiên bản kernel tiếp theo. (Tuy nhiên, nếu chúng ta sử dụng lệnh chown(1) dưới quyền đăng nhập root để thay đổi quyền sở hữu của một tệp, thì sau khi gọi system call `chown(2)`, lệnh chown sẽ sử dụng system call `chmod()` để bật lại các bit set-user-ID và set-group-ID).

Khi thay đổi chủ sở hữu hoặc nhóm của một tệp, bit quyền set-group-ID sẽ không bị tắt nếu bit quyền group-execute đã tắt hoặc nếu chúng ta đang thay đổi quyền sở hữu của một thư mục (directory). Trong cả hai trường hợp này, bit set-group-ID đang được sử dụng cho một mục đích khác ngoài việc tạo ra một chương trình set-group-ID, do đó việc tắt bit này là không mong muốn. Các mục đích sử dụng khác của bit set-group-ID này bao gồm:

-  Nếu bit quyền group-execute đã tắt, thì bit quyền set-group-ID đang được sử dụng để bật tính năng khóa tệp bắt buộc (mandatory file locking) (được thảo luận tại Mục 55.4).
-  Trong trường hợp của một thư mục, bit set-group-ID được sử dụng để kiểm soát quyền sở hữu của các tệp mới được tạo bên trong thư mục đó (Mục [15.3.1](#page-58-0)).

Việc sử dụng `chown()` được minh họa trong [Liệt kê 15-2](#page-60-0), một chương trình cho phép người dùng thay đổi chủ sở hữu và nhóm của một số lượng tệp tùy ý, được chỉ định làm đối số dòng lệnh (command-line arguments). (Chương trình này sử dụng các hàm `userIdFromName()` và `groupIdFromName()` từ Liệt kê 8-1, ở trang 159, để chuyển đổi tên người dùng và tên nhóm thành các ID dạng số tương ứng).

**Liệt kê 15-2:** Thay đổi chủ sở hữu và nhóm của một tệp

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/t_chown.c

## include <pwd.h>

## include <grp.h>

## include "ugid_functions.h" /* Khai báo của userIdFromName()

và groupIdFromName() */

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
uid_t uid;
gid_t gid;
int j;
Boolean errFnd;
if (argc < 3 || strcmp(argv[1], "--help") == 0)
usageErr("%s owner group [file...]\n"
" owner hoặc group có thể là '-', "
"có nghĩa là giữ nguyên không đổi\n", argv[0]);
if (strcmp(argv[1], "-") == 0) { /* "-" ==> không đổi owner */
uid = -1;
} else { /* Chuyển tên user thành UID */
uid = userIdFromName(argv[1]);
if (uid == -1)
fatal("Không tồn tại user này (%s)", argv[1]);
}
if (strcmp(argv[2], "-") == 0) { /* "-" ==> không đổi group */
gid = -1;

```

```

} else { /* Chuyển tên group thành GID */
gid = groupIdFromName(argv[2]);
if (gid == -1)
fatal("Không tồn tại group user này (%s)", argv[1]);
}
/* Thay đổi quyền sở hữu của tất cả các tệp được chỉ định trong các đối số còn lại */
errFnd = FALSE;
for (j = 3; j < argc; j++) {
if (chown(argv[j], uid, gid) == -1) {
errMsg("chown: %s", argv[j]);
errFnd = TRUE;
}
}
exit(errFnd ? EXIT_FAILURE : EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/t_chown.c

```

## 15.4 Quyền truy cập tệp (File Permissions)

Trong mục này, chúng ta mô tả cơ chế phân quyền áp dụng cho các tệp và thư mục. Mặc dù chúng ta thảo luận về quyền ở đây chủ yếu theo cách chúng áp dụng cho các tệp thông thường (regular files) và thư mục, các quy tắc mà chúng ta mô tả đều áp dụng cho tất cả các loại tệp, bao gồm các thiết bị (devices), FIFO, và UNIX domain socket. Hơn nữa, các đối tượng giao tiếp giữa các tiến trình (Interprocess Communication - IPC) của System V và POSIX (bộ nhớ chia sẻ - shared memory, semaphore, và hàng đợi thông điệp - message queues) cũng có các mặt nạ quyền (permission masks), và các quy tắc áp dụng cho các đối tượng này cũng tương tự như đối với các tệp.

### 15.4.1 Quyền trên các Tệp thông thường (Regular Files)

Như đã lưu ý ở Mục [15.1,](#page-46-1) 12 bit thấp của trường `st_mode` trong cấu trúc `stat` xác định quyền đối với một tệp. 3 bit đầu tiên trong số này là các bit đặc biệt được gọi là set-user-ID, set-group-ID và sticky bit (được ký hiệu lần lượt là U, G và T trong [Hình 15-1](#page-48-0)). Chúng ta sẽ tìm hiểu chi tiết hơn về các bit này ở Mục [15.4.5](#page-67-0). 9 bit còn lại tạo thành mặt nạ xác định các quyền được cấp cho các nhóm người dùng khác nhau khi truy cập tệp. Mặt nạ quyền của tệp chia thế giới thành ba danh mục:

 Owner (còn gọi là user - người dùng): Các quyền được cấp cho chủ sở hữu của tệp.

Thuật ngữ user được sử dụng bởi các lệnh như chmod(1), lệnh này sử dụng chữ cái viết tắt u để chỉ danh mục quyền này.

-  Group (Nhóm): Các quyền được cấp cho những người dùng là thành viên của nhóm sở hữu tệp.
-  Other (Khác): Các quyền được cấp cho tất cả những người còn lại.

Ba quyền có thể được cấp cho mỗi danh mục người dùng:

-  Read (Đọc): Nội dung của tệp có thể được đọc.
-  Write (Ghi): Nội dung của tệp có thể bị thay đổi.

Execute (Thực thi): Tệp có thể được thực thi (tức là nó là một chương trình hoặc một tập lệnh - script). Để thực thi một tệp tập lệnh (ví dụ: một bash script), cả quyền đọc (read) và quyền thực thi (execute) đều là bắt buộc.

Quyền hạn (permissions) và quyền sở hữu (ownership) của một tệp có thể được xem bằng cách sử dụng lệnh `ls -l`, như trong ví dụ sau:

```

$ ls -l myscript.sh
-rwxr-x--- 1 mtk users 1667 Jan 15 09:22 myscript.sh

```

Trong ví dụ trên, quyền của tệp được hiển thị dưới dạng `rwxr-x---` (dấu gạch ngang ban đầu đứng trước chuỗi này biểu thị loại tệp: tệp thông thường - regular file). Để giải mã chuỗi này, chúng ta chia 9 ký tự này thành các nhóm gồm 3 ký tự, lần lượt biểu thị xem các quyền đọc, ghi (write) và thực thi có được bật hay không. Nhóm đầu tiên biểu thị quyền cho owner (chủ sở hữu), có các quyền đọc, ghi và thực thi được bật. Nhóm tiếp theo biểu thị quyền cho group (nhóm), có quyền đọc và thực thi được bật, nhưng không có quyền ghi. Nhóm cuối cùng là quyền cho other (những người dùng khác), không có bất kỳ quyền nào được bật.

Tệp tiêu đề `<sys/stat.h>` định nghĩa các hằng số có thể được dùng với phép toán AND theo bit (`&`) với trường `st_mode` của cấu trúc `stat`, nhằm kiểm tra xem các bit quyền cụ thể có được thiết lập hay không. (Các hằng số này cũng được định nghĩa thông qua việc bao hàm tệp `<fcntl.h>`, nơi khai báo nguyên mẫu cho system call `open()`.) Các hằng số này được thể hiện trong Bảng 15-4.

| Constant | Octal value | Permission bit |
|----------|-------------|----------------|
| S_ISUID  | 04000       | Set-user-ID    |
| S_ISGID  | 02000       | Set-group-ID   |
| S_ISVTX  | 01000       | Sticky         |
| S_IRUSR  | 0400        | User-read      |
| S_IWUSR  | 0200        | User-write     |
| S_IXUSR  | 0100        | User-execute   |
| S_IRGRP  | 040         | Group-read     |
| S_IWGRP  | 020         | Group-write    |
| S_IXGRP  | 010         | Group-execute  |
| S_IROTH  | 04          | Other-read     |
| S_IWOTH  | 02          | Other-write    |

S\_IXOTH 01 Other-execute

**Bảng 15-4:** Các hằng số cho các bit quyền của tệp

Ngoài các hằng số được hiển thị trong Bảng 15-4, ba hằng số được định nghĩa tương đương với các mặt nạ (masks) cho cả ba quyền đối với từng loại đối tượng là owner, group và other: `S_IRWXU` (0700), `S_IRWXG` (070) và `S_IRWXO` (07).

Tệp tiêu đề trong [Listing 15-3](#page-63-1) khai báo một hàm, `filePermStr()`, nhận đầu vào là mặt nạ quyền của tệp và trả về một chuỗi biểu diễn được cấp phát tĩnh của mặt nạ đó theo định dạng giống như được sử dụng bởi lệnh `ls(1)`.

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/file_perms.h

## ifndef FILE_PERMS_H

## define FILE_PERMS_H

## include <sys/types.h>

## define FP_SPECIAL 1 /* Bao gồm thông tin set-user-ID, set-group-ID và sticky

bit trong chuỗi được trả về */
char *filePermStr(mode_t perm, int flags);

## endif

–––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/file_perms.h

```

Nếu cờ `FP_SPECIAL` được thiết lập trong tham số `flags` của hàm `filePermStr()`, thì chuỗi trả về sẽ bao gồm trạng thái của các bit set-user-ID, set-group-ID và sticky, theo đúng phong cách của `ls(1)`.

Việc cài đặt hàm `filePermStr()` được thể hiện trong [Listing 15-4](#page-63-0). Chúng ta sử dụng hàm này trong chương trình tại [Listing 15-1](#page-51-0).

**Listing 15-4:** Chuyển đổi mặt nạ quyền tệp thành chuỗi

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/file_perms.c

## include <sys/stat.h>

## include <stdio.h>

## include "file_perms.h" /* Giao diện cho phần cài đặt này */

## define STR_SIZE sizeof("rwxrwxrwx")

char * /* Trả về chuỗi theo phong cách ls(1) cho mặt nạ quyền tệp */
filePermStr(mode_t perm, int flags)
{
static char str[STR_SIZE];
snprintf(str, STR_SIZE, "%c%c%c%c%c%c%c%c%c",
(perm & S_IRUSR) ? 'r' : '-', (perm & S_IWUSR) ? 'w' : '-',
(perm & S_IXUSR) ?
(((perm & S_ISUID) && (flags & FP_SPECIAL)) ? 's' : 'x') :
(((perm & S_ISUID) && (flags & FP_SPECIAL)) ? 'S' : '-'),
(perm & S_IRGRP) ? 'r' : '-', (perm & S_IWGRP) ? 'w' : '-',
(perm & S_IXGRP) ?
(((perm & S_ISGID) && (flags & FP_SPECIAL)) ? 's' : 'x') :
(((perm & S_ISGID) && (flags & FP_SPECIAL)) ? 'S' : '-'),
(perm & S_IROTH) ? 'r' : '-', (perm & S_IWOTH) ? 'w' : '-',
(perm & S_IXOTH) ?
(((perm & S_ISVTX) && (flags & FP_SPECIAL)) ? 't' : 'x') :
(((perm & S_ISVTX) && (flags & FP_SPECIAL)) ? 'T' : '-'));
return str;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/file_perms.c

```

### 15.4.2 Quyền trên Thư mục (Permissions on Directories)

Các thư mục có cơ chế phân quyền giống như các tệp. Tuy nhiên, ba quyền này được diễn giải theo cách khác nhau:

 Read (Đọc): Các nội dung (tức là danh sách tên tệp) của thư mục có thể được liệt kê (ví dụ: bằng lệnh `ls`).

> Khi thực nghiệm để xác minh hoạt động của bit quyền đọc thư mục, hãy lưu ý rằng một số bản phân phối Linux (Linux distributions) tạo alias (bí danh) cho lệnh `ls` để bao gồm các cờ (ví dụ: `-F`) yêu cầu quyền truy cập vào thông tin i-node của các tệp trong thư mục, và điều này đòi hỏi phải có quyền thực thi trên thư mục đó. Để đảm bảo rằng chúng ta đang sử dụng một lệnh `ls` nguyên bản không bị biến đổi, chúng ta có thể chỉ định đường dẫn đầy đủ của lệnh này (`/bin/ls`).

-  Write (Ghi): Các tệp tin có thể được tạo trong và xóa khỏi thư mục. Lưu ý rằng không cần phải có bất kỳ quyền nào đối với chính tệp tin đó để có thể xóa nó.
-  Execute (Thực thi): Các tệp tin bên trong thư mục có thể được truy cập. Quyền thực thi trên một thư mục đôi khi được gọi là quyền tìm kiếm (search permission).

Khi truy cập một tệp tin, quyền thực thi là bắt buộc trên tất cả các thư mục được liệt kê trong đường dẫn (pathname). Ví dụ, việc đọc tệp tin `/home/mtk/x` sẽ yêu cầu quyền thực thi trên `/`, `/home`, và `/home/mtk` (cũng như quyền đọc trên chính tệp tin `x`). Nếu thư mục làm việc hiện tại (current working directory) là `/home/mtk/sub1` và chúng ta truy cập đường dẫn tương đối (relative pathname) `../sub2/x`, thì chúng ta cần quyền thực thi trên `/home/mtk` và `/home/mtk/sub2` (nhưng không cần trên `/` hoặc `/home`).

Quyền đọc (read permission) trên một thư mục chỉ cho phép chúng ta xem danh sách tên các tệp tin trong thư mục đó. Chúng ta bắt buộc phải có quyền thực thi trên thư mục để có thể truy cập nội dung hoặc thông tin i-node của các tệp tin bên trong thư mục đó.

Ngược lại, nếu chúng ta có quyền thực thi trên một thư mục nhưng không có quyền đọc, thì chúng ta có thể truy cập một tệp tin trong thư mục đó nếu biết tên của nó, nhưng chúng ta không thể liệt kê nội dung của thư mục (tức là tên các tệp tin khác trong thư mục). Đây là một kỹ thuật đơn giản và thường được sử dụng để kiểm soát quyền truy cập vào nội dung của một thư mục công khai (public directory).

Để thêm hoặc xóa các tệp tin trong một thư mục, chúng ta cần cả quyền thực thi và quyền ghi trên thư mục đó.

### 15.4.3 Thuật toán Kiểm tra Quyền (Permission-Checking Algorithm)

Kernel kiểm tra quyền tệp tin bất cứ khi nào chúng ta chỉ định một đường dẫn trong một system call để truy cập tệp tin hoặc thư mục. Khi đường dẫn được truyền cho system call bao gồm một tiền tố thư mục (directory prefix), thì ngoài việc kiểm tra các quyền bắt buộc trên chính tệp tin đó, kernel cũng kiểm tra quyền thực thi trên từng thư mục trong tiền tố này. Các bước kiểm tra quyền được thực hiện bằng cách sử dụng effective user ID (ID người dùng hiệu dụng), effective group ID (ID nhóm hiệu dụng), và supplementary group IDs (các ID nhóm bổ sung) của process. (Để chính xác tuyệt đối, đối với việc kiểm tra quyền tệp tin trên Linux, file-system user và group ID được sử dụng thay vì các ID hiệu dụng tương ứng, như được mô tả trong Mục 9.5).

> Một khi tệp tin đã được mở bằng `open()`, không có việc kiểm tra quyền nào được thực hiện bởi các system call tiếp theo làm việc với file descriptor được trả về (chẳng hạn như `read()`, `write()`, `fstat()`, `fcntl()`, và `mmap()`).

Các quy tắc được áp dụng bởi kernel khi kiểm tra quyền như sau:

- 1. Nếu process có đặc quyền (privileged), mọi quyền truy cập đều được cấp.
- 2. Nếu effective user ID của process trùng với user ID (chủ sở hữu) của tệp tin, thì quyền truy cập được cấp dựa theo các quyền của chủ sở hữu (owner permissions) trên tệp tin đó. Ví dụ, quyền đọc được cấp nếu bit quyền đọc của chủ sở hữu được bật trong mặt nạ quyền tệp tin (file permissions mask); ngược lại, quyền đọc bị từ chối.
- 3. Nếu effective group ID của process hoặc bất kỳ supplementary group IDs nào của process khớp với group ID (nhóm sở hữu) của tệp tin, thì quyền truy cập được cấp dựa theo các quyền của nhóm (group permissions) trên tệp tin đó.
- 4. Mặt khác, quyền truy cập được cấp dựa theo các quyền khác (other permissions) trên tệp tin.

Trong mã nguồn kernel, các bài kiểm tra trên thực tế được cấu trúc sao cho việc kiểm tra xem một process có đặc quyền hay không chỉ được thực hiện nếu process đó không được cấp các quyền cần thiết thông qua một trong các bài kiểm tra khác. Điều này được thực hiện để tránh việc đặt cờ kế toán process ASU một cách không cần thiết, vốn chỉ ra rằng process đã tận dụng các đặc quyền siêu người dùng (super-user privileges) (Mục 28.1).

Việc kiểm tra đối với quyền của chủ sở hữu, nhóm và các quyền khác được thực hiện theo thứ tự, và quá trình kiểm tra sẽ dừng lại ngay khi tìm thấy quy tắc phù hợp. Điều này có thể dẫn đến một hậu quả bất ngờ: ví dụ, nếu các quyền dành cho nhóm vượt quá quyền của chủ sở hữu, thì chủ sở hữu thực tế sẽ có ít quyền đối với tệp tin hơn so với các thành viên trong nhóm của tệp tin đó, như minh họa bởi ví dụ sau:

```

$ echo 'Hello world' > a.txt
$ ls -l a.txt
-rw-r--r-- 1 mtk users 12 Jun 18 12:26 a.txt
$ chmod u-rw a.txt # Xóa quyền đọc và ghi của chủ sở hữu
$ ls -l a.txt
----r--r-- 1 mtk users 12 Jun 18 12:26 a.txt
$ cat a.txt
cat: a.txt: Permission denied # Chủ sở hữu không còn có thể đọc tệp tin
$ su avr # Chuyển sang người dùng khác...
Password:
$ groups # ai nằm trong nhóm sở hữu tệp tin...
users staff teach cs
$ cat a.txt # và do đó có thể đọc tệp tin
Hello world

```

Các nhận xét tương tự cũng áp dụng nếu nhóm khác (`other`) cấp nhiều quyền hơn chủ sở hữu hoặc nhóm (`group`).

Vì thông tin về quyền tệp tin và quyền sở hữu được duy trì bên trong một i-node của tệp tin, tất cả các tên tệp tin (liên kết - links) trỏ đến cùng một i-node sẽ chia sẻ thông tin này.

Linux 2.6 cung cấp các danh sách kiểm soát truy cập (Access Control Lists - ACLs), giúp cho việc định nghĩa quyền tệp tin trên cơ sở từng người dùng (per-user) và từng nhóm (per-group) trở nên khả thi. Nếu một tệp tin có ACL, một phiên bản sửa đổi của thuật toán trên sẽ được sử dụng. Chúng ta sẽ mô tả các ACL trong Chương 17.

### Kiểm tra quyền đối với các tiến trình có đặc quyền (privileged process)

Ở trên, chúng tôi đã đề cập rằng nếu một tiến trình (process) có đặc quyền, tất cả các quyền truy cập đều được cấp khi kiểm tra quyền. Chúng ta cần bổ sung thêm một ngoại lệ cho tuyên bố này. Đối với một tập tin không phải là thư mục (directory), Linux chỉ cấp quyền thực thi (execute permission) cho một tiến trình có đặc quyền nếu quyền đó được cấp cho ít nhất một trong các phân loại quyền của tập tin. Trên một số hệ thống UNIX khác, một tiến trình có đặc quyền có thể thực thi một tập tin ngay cả khi không có phân loại quyền nào cấp quyền thực thi. Khi truy cập vào một thư mục, một tiến trình có đặc quyền luôn được cấp quyền thực thi (tìm kiếm - search).

> Chúng ta có thể diễn giải lại mô tả của mình về một tiến trình có đặc quyền dựa trên hai năng lực của tiến trình Linux (process capabilities): `CAP_DAC_READ_SEARCH` và `CAP_DAC_OVERRIDE` (Mục 39.2). Một tiến trình có năng lực `CAP_DAC_READ_SEARCH` luôn có quyền đọc (read permission) đối với bất kỳ loại tập tin nào, và luôn có quyền đọc và thực thi đối với một thư mục (tức là, luôn có thể truy cập các tập tin bên trong thư mục và đọc danh sách các tập tin trong thư mục đó). Một tiến trình có năng lực `CAP_DAC_OVERRIDE` luôn có quyền đọc và ghi (write permission) đối với bất kỳ loại tập tin nào, và cũng có quyền thực thi nếu tập tin đó là một thư mục hoặc nếu quyền thực thi được cấp cho ít nhất một trong các phân loại quyền của tập tin.

### 15.4.4 Kiểm tra khả năng truy cập tệp: access()

Như đã lưu ý ở Mục [15.4.3,](#page-64-0) ID người dùng và ID nhóm hiệu dụng (effective user and group IDs), cùng với các ID nhóm bổ sung (supplementary group IDs), được sử dụng để xác định các quyền mà một tiến trình có được khi truy cập một tệp. Một chương trình (ví dụ: chương trình set-user-ID hoặc set-group-ID) cũng có thể kiểm tra khả năng truy cập tệp dựa trên ID người dùng và ID nhóm thực tế (real user and group IDs) của tiến trình.

System call `access()` kiểm tra khả năng truy cập của tệp được chỉ định trong `pathname` dựa trên ID người dùng và ID nhóm thực tế của tiến trình (và các ID nhóm bổ sung).

```c

## include <unistd.h>

int access(const char *pathname, int mode);
Trả về 0 nếu tất cả các quyền được cấp, ngược lại trả về –1

```

Nếu `pathname` là một liên kết tượng trưng (symbolic link), `access()` sẽ giải tham chiếu (dereference) liên kết đó.

Đối số `mode` là một mặt nạ bit (bit mask) bao gồm một hoặc nhiều hằng số được hiển thị trong [Bảng 15-5](#page-66-0), được kết hợp với nhau bằng phép toán OR (`|`). Nếu tất cả các quyền được chỉ định trong `mode` đều được cấp trên `pathname`, thì `access()` trả về 0; nếu ít nhất một trong các quyền được yêu cầu không khả dụng (hoặc xảy ra lỗi), thì `access()` trả về –1.

|  |  |  | Bảng 15-5: Các hằng số mode cho access() |  |  |
|--|--|--|-----------------------------------------|--|--|
|--|--|--|-----------------------------------------|--|--|

| Hằng số | Mô tả                     |
|---------|---------------------------|
| F_OK    | Tập tin có tồn tại không? |
| R_OK    | Tập tin có thể đọc không? |
| W_OK    | Tập tin có thể ghi không? |
| X_OK    | Tập tin có thể chạy không?|

Khoảng thời gian (time gap) giữa lệnh gọi `access()` và một thao tác tiếp theo trên tập tin đồng nghĩa với việc không có gì đảm bảo rằng thông tin do `access()` trả về sẽ vẫn chính xác tại thời điểm diễn ra thao tác sau đó (cho dù khoảng thời gian này có ngắn đến đâu). Tình huống này có thể dẫn đến các lỗ hổng bảo mật trong một số thiết kế ứng dụng.

Giả sử, ví dụ, chúng ta có một chương trình set-user-ID-root sử dụng `access()` để kiểm tra xem một tập tin có thể truy cập được bởi ID người dùng thực tế của chương trình hay không, và nếu có, sẽ thực hiện một thao tác trên tập tin đó (ví dụ: `open()` hoặc `exec()`).

Vấn đề là nếu `pathname` được truyền cho `access()` là một liên kết tượng trưng, và một người dùng độc hại cố gắng thay đổi liên kết đó để trỏ đến một tập tin khác trước bước thứ hai, thì chương trình set-user-ID-root có thể cuối cùng lại thao tác trên một tập tin mà ID người dùng thực tế không có quyền truy cập. (Đây là một ví dụ về loại điều kiện tranh chấp thời điểm kiểm tra, thời điểm sử dụng – time-of-check, time-of-use race condition được mô tả ở Mục 38.6). Vì lý do này, thực tiễn được khuyến nghị là tránh sử dụng hoàn toàn `access()` (xem, ví dụ, [Borisov, 2005]). Trong ví dụ vừa nêu, chúng ta có thể đạt được điều này bằng cách tạm thời thay đổi ID người dùng hiệu dụng (hoặc hệ thống tập tin - file system user ID) của tiến trình set-user-ID, thử thực hiện thao tác mong muốn (ví dụ: `open()` hoặc `exec()`), và sau đó kiểm tra giá trị trả về cùng với `errno` để xác định xem thao tác có thất bại do vấn đề quyền hạn hay không.

> Thư viện C của GNU (GNU C library) cung cấp một hàm tương tự nhưng không chuẩn là `euidaccess()` (hoặc đồng nghĩa là `eaccess()`), hàm này kiểm tra quyền truy cập tập tin bằng cách sử dụng ID người dùng hiệu dụng của tiến trình.

### 15.4.5 Các bit Set-User-ID, Set-Group-ID và Sticky

Cùng với 9 bit được sử dụng cho các quyền sở hữu (owner), nhóm (group) và các quyền khác (other), mặt nạ quyền tập tin (file permissions mask) chứa thêm 3 bit, được gọi là các bit set-user-ID (bit 04000), set-group-ID (bit 02000) và sticky (bit 01000). Chúng ta đã thảo luận về việc sử dụng các bit quyền set-user-ID và set-group-ID để tạo các chương trình có đặc quyền ở Mục 9.3. Bit set-group-ID cũng phục vụ hai mục đích khác mà chúng tôi mô tả ở các phần khác: kiểm soát quyền sở hữu nhóm của các tập tin mới được tạo trong một thư mục được mount với tùy chọn `nogrpid` (Mục [15.3.1\)](#page-58-0), và cho phép khóa bắt buộc (mandatory locking) trên một tập tin (Mục 55.4). Trong phần còn lại của mục này, chúng ta giới hạn thảo luận về việc sử dụng bit sticky.

Trên các phiên bản UNIX cũ, sticky bit được cung cấp như một cách để giúp các chương trình thường dùng chạy nhanh hơn. Nếu sticky bit được thiết lập trên một tệp chương trình, thì trong lần thực thi đầu tiên, một bản sao của phần văn bản chương trình (program text) sẽ được lưu vào vùng swap — do đó nó "được giữ lại" (sticks) trong swap, và được tải nhanh hơn ở các lần thực thi tiếp theo. Các phiên bản UNIX hiện đại có hệ thống quản lý bộ nhớ (memory-management system) tinh vi hơn, khiến cho việc sử dụng sticky permission bit này trở nên lỗi thời.

> Tên của hằng số dùng cho sticky permission bit được hiển thị trong Bảng 15-4, `S_ISVTX`, bắt nguồn từ một tên gọi khác của sticky bit: saved-text bit (bit lưu văn bản).

Trong các phiên bản UNIX hiện đại (bao gồm cả Linux), sticky permission bit phục vụ một mục đích khác, hoàn toàn khác biệt. Đối với các thư mục (directory), sticky bit đóng vai trò là cờ xóa hạn chế (restricted deletion flag). Việc thiết lập bit này trên một thư mục có nghĩa là một tiến trình không có đặc quyền (unprivileged process) chỉ có thể hủy liên kết (`unlink()`, `rmdir()`) và đổi tên (`rename()`) các tệp trong thư mục đó nếu nó có quyền ghi (write permission) trên thư mục và là chủ sở hữu (owner) của tệp hoặc thư mục đó. (Một tiến trình có capability `CAP_FOWNER` có thể bỏ qua việc kiểm tra quyền sở hữu sau). Điều này cho phép tạo ra một thư mục được chia sẻ bởi nhiều người dùng, nơi mà mỗi người dùng có thể tạo và xóa các tệp của riêng họ trong thư mục nhưng không thể xóa các tệp thuộc sở hữu của người dùng khác. Sticky permission bit thường được thiết lập trên thư mục `/tmp` vì lý do này.

Sticky permission bit của một tệp được thiết lập thông qua lệnh `chmod` (`chmod +t file`) hoặc thông qua System Call `chmod()`. Nếu sticky bit của một tệp được thiết lập, lệnh `ls -l` sẽ hiển thị chữ cái `t` viết thường hoặc viết hoa trong trường quyền thực thi của người khác (other-execute permission field), tùy thuộc vào việc bit quyền thực thi của người khác đang bật hay tắt, như trong ví dụ sau:

```

$ touch tfile
$ ls -l tfile
-rw-r--r-- 1 mtk users 0 Jun 23 14:44 tfile
$ chmod +t tfile
$ ls -l tfile
-rw-r--r-T 1 mtk users 0 Jun 23 14:44 tfile
$ chmod o+x tfile
$ ls -l tfile
-rw-r--r-t 1 mtk users 0 Jun 23 14:44 tfile

```

### 15.4.6 Mặt nạ tạo chế độ tệp của tiến trình: umask()

Bây giờ chúng ta sẽ xem xét chi tiết hơn về các quyền được gán cho một tệp hoặc thư mục mới được tạo. Đối với các tệp mới, kernel sử dụng các quyền được chỉ định trong đối số `mode` truyền vào `open()` hoặc `creat()`. Đối với các thư mục mới, quyền được thiết lập theo đối số `mode` truyền vào `mkdir()`. Tuy nhiên, các thiết lập này bị sửa đổi bởi mặt nạ tạo chế độ tệp (file mode creation mask), hay còn được gọi đơn giản là `umask`. `umask` là một thuộc tính của tiến trình (process attribute) dùng để chỉ định các bit quyền nào sẽ luôn bị tắt (không được cấp) khi các tệp hoặc thư mục mới được tạo bởi tiến trình đó.

Thông thường, một tiến trình chỉ sử dụng `umask` mà nó kế thừa từ shell cha của nó, với hệ quả (thường là mong muốn) là người dùng có thể kiểm soát `umask` của các chương trình được thực thi từ shell bằng cách sử dụng lệnh nội tại (built-in command) `umask` của shell, lệnh này làm thay đổi `umask` của tiến trình shell.

Các tệp khởi tạo (initialization files) cho hầu hết các shell thiết lập `umask` mặc định thành giá trị bát phân (octal value) `022` (`----w--w-`). Giá trị này chỉ định rằng quyền ghi (write permission) phải luôn bị tắt đối với nhóm (group) và người khác (other). Do đó, giả sử đối số `mode` trong lệnh gọi `open()` là `0666` (tức là cho phép đọc và ghi đối với tất cả người dùng, đây là mức thông thường), thì các tệp mới được tạo với quyền đọc và ghi cho chủ sở hữu (owner), và chỉ có quyền đọc cho tất cả những đối tượng còn lại (được hiển thị bởi `ls -l` là `-rw-r--r--`). Tương tự, giả sử đối số `mode` truyền vào `mkdir()` được chỉ định là `0777` (tức là tất cả quyền được cấp cho tất cả người dùng), các thư mục mới được tạo với tất cả quyền được cấp cho chủ sở hữu, và chỉ có quyền đọc và thực thi cho nhóm và người khác (tức là `rwxr-xr-x`).

System Call `umask()` thay đổi `umask` của một tiến trình thành giá trị được chỉ định trong đối số `mask`.

```

## include <sys/stat.h>

mode_t umask(mode_t mask);
Luôn trả về thành công umask trước đó của tiến trình

```

Đối số `mask` có thể được chỉ định dưới dạng một số bát phân hoặc bằng cách kết hợp các hằng số được liệt kê trong Bảng 15-4 bằng phép toán OR (`|`).

Một lời gọi tới `umask()` luôn thành công và trả về giá trị `umask` trước đó.

[Liệt kê 15-5](#page-69-0) minh họa việc sử dụng `umask()` kết hợp với `open()` và `mkdir()`. Khi chạy chương trình này, chúng ta thu được kết quả sau:

### \$ **./t\_umask**

```

Requested file perms: rw-rw---- This is what we asked for
Process umask: ----wx-wx This is what we are denied
Actual file perms: rw-r----- So this is what we end up with
Requested dir. perms: rwxrwxrwx
Process umask: ----wx-wx
Actual dir. perms: rwxr--r--

```

Trong [Liệt kê 15-5](#page-69-0), chúng ta sử dụng các system call `mkdir()` và `rmdir()` để tạo và xóa một thư mục, và system call `unlink()` để xóa một tệp. Chúng ta sẽ mô tả các system call này trong Chương 18.

### **Listing 15-5:** Sử dụng umask()

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/t_umask.c

## include <sys/stat.h>

## include <fcntl.h>

## include "file_perms.h"

## include "tlpi_hdr.h"

## define MYFILE "myfile"

## define MYDIR "mydir"

## define FILE_PERMS (S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP)

## define DIR_PERMS (S_IRWXU | S_IRWXG | S_IRWXO)

## define UMASK_SETTING (S_IWGRP | S_IXGRP | S_IWOTH | S_IXOTH)

int
main(int argc, char *argv[])
{
int fd;
struct stat sb;
mode_t u;
umask(UMASK_SETTING);
fd = open(MYFILE, O_RDWR | O_CREAT | O_EXCL, FILE_PERMS);
if (fd == -1)
errExit("open-%s", MYFILE);
if (mkdir(MYDIR, DIR_PERMS) == -1)
errExit("mkdir-%s", MYDIR);
u = umask(0); /* Lấy (và xóa) giá trị umask */
if (stat(MYFILE, &sb) == -1)
errExit("stat-%s", MYFILE);
printf("Requested file perms: %s\n", filePermStr(FILE_PERMS, 0));
printf("Process umask: %s\n", filePermStr(u, 0));
printf("Actual file perms: %s\n\n", filePermStr(sb.st_mode, 0));

```

```

if (stat(MYDIR, &sb) == -1)
errExit("stat-%s", MYDIR);
printf("Requested dir. perms: %s\n", filePermStr(DIR_PERMS, 0));
printf("Process umask: %s\n", filePermStr(u, 0));
printf("Actual dir. perms: %s\n", filePermStr(sb.st_mode, 0));
if (unlink(MYFILE) == -1)
errMsg("unlink-%s", MYFILE);
if (rmdir(MYDIR) == -1)
errMsg("rmdir-%s", MYDIR);
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– files/t_umask.c

```

### 15.4.7 Thay đổi quyền hạn tệp: chmod() và fchmod()

Các system call `chmod()` và `fchmod()` thay đổi quyền hạn (permissions) của một tệp.

```c

## include <sys/stat.h>

int chmod(const char *pathname, mode_t mode);

## define _XOPEN_SOURCE 500 /* Hoặc: #define _BSD_SOURCE */

## include <sys/stat.h>

int fchmod(int fd, mode_t mode);
Cả hai trả về 0 khi thành công, hoặc –1 khi lỗi

```

System call `chmod()` thay đổi quyền hạn của tệp được chỉ định bởi `pathname`. Nếu đối số này là một liên kết tượng trưng (symbolic link), `chmod()` sẽ thay đổi quyền hạn của tệp mà liên kết đó trỏ tới, thay vì thay đổi quyền hạn của chính liên kết đó. (Một symbolic link luôn được tạo với quyền đọc, ghi và thực thi được bật cho tất cả người dùng, và các quyền này không thể thay đổi được. Các quyền này sẽ bị bỏ qua khi tham chiếu ngược (dereference) liên kết.)

System call `fchmod()` thay đổi quyền hạn trên tệp được tham chiếu bởi file descriptor `fd` đang mở.

Đối số `mode` chỉ định quyền hạn mới của tệp, được biểu diễn theo hệ cơ số (bát phân - octal) hoặc dưới dạng một mặt nạ (mask) được hình thành bằng cách kết hợp phép toán OR bitwise (|) với các bit quyền được liệt kê trong Bảng 15-4. Để thay đổi quyền hạn trên một tệp, tiến trình (Process) phải có quyền đặc quyền (privileged) (`CAP_FOWNER`) hoặc effective user ID của nó phải khớp với chủ sở hữu (user ID) của tệp. (Nói một cách chính xác trên Linux, đối với một tiến trình không có đặc quyền (unprivileged process), filesystem user ID của tiến trình chứ không phải effective user ID của nó, mới là ID phải khớp với user ID của tệp, như được mô tả trong Mục 9.5.)

Để thiết lập quyền hạn trên một tệp sao cho chỉ cấp quyền đọc cho tất cả người dùng, chúng ta có thể sử dụng lời gọi sau:

```

if (chmod("myfile", S_IRUSR | S_IRGRP | S_IROTH) == -1)
errExit("chmod");
/* Hoặc tương đương: chmod("myfile", 0444); */

```

Để sửa đổi các bit cụ thể của quyền hạn tệp, trước tiên chúng ta lấy quyền hiện tại bằng cách sử dụng `stat()`, tinh chỉnh các bit chúng ta muốn thay đổi, và sau đó sử dụng `chmod()` để cập nhật quyền hạn:

```

struct stat sb;
mode_t mode;
if (stat("myfile", &sb) == -1)
errExit("stat");
mode = (sb.st_mode | S_IWUSR) & ~S_IROTH;
/* bật quyền ghi của chủ sở hữu, tắt quyền đọc của người khác, các bit còn lại giữ nguyên */
if (chmod("myfile", mode) == -1)
errExit("chmod");

```

Đoạn mã trên tương đương với lệnh shell sau:

```

$ chmod u+w,o-r myfile

```

Trong Mục [15.3.1,](#page-58-0) chúng tôi đã lưu ý rằng nếu một thư mục nằm trên hệ thống ext2 được gắn kết (mounted) với tùy chọn `-o bsdgroups`, hoặc trên hệ thống được gắn kết với tùy chọn `-o sysvgroups` và bit quyền set-group-ID được bật cho thư mục đó, thì một tệp mới tạo trong thư mục sẽ kế thừa quyền sở hữu từ thư mục cha, chứ không phải từ effective group ID của tiến trình đang tạo. Có thể xảy ra trường hợp group ID của một tệp như vậy không khớp với bất kỳ group ID nào của tiến trình tạo ra nó. Vì lý do này, khi một tiến trình không có đặc quyền (tiến trình không có capability `CAP_FSETID`) gọi `chmod()` (hoặc `fchmod()`) trên một tệp có group ID không bằng effective group ID hoặc bất kỳ supplementary group ID nào của tiến trình, kernel sẽ luôn xóa bit quyền set-group-ID. Đây là một biện pháp bảo mật được thiết kế nhằm ngăn chặn người dùng tạo ra một chương trình set-group-ID cho một nhóm mà họ không phải là thành viên. Các lệnh shell sau đây minh họa nỗ lực khai thác mà biện pháp này ngăn chặn:

```

$ mount | grep test Hmmm, /test được gắn kết với –o bsdgroups
/dev/sda9 on /test type ext3 (rw,bsdgroups)
$ ls -ld /test Thư mục có GID root, mọi người đều có quyền ghi
drwxrwxrwx 3 root root 4096 Jun 30 20:11 /test
$ id Tôi là một người dùng thông thường, không thuộc nhóm root
uid=1000(mtk) gid=100(users) groups=100(users),101(staff),104(teach)
$ cd /test
$ cp ~/myprog . Sao chép một chương trình độc hại nào đó vào đây
$ ls -l myprog Ô kìa! Nó nằm trong nhóm root!
-rwxr-xr-x 1 mtk root 19684 Jun 30 20:43 myprog
$ chmod g+s myprog Tôi có thể đặt nó thành set-group-ID của root không?
$ ls -l myprog Hừm, không được...
-rwxr-xr-x 1 mtk root 19684 Jun 30 20:43 myprog

```

## 15.5 Cờ I-node (Thuộc tính tệp mở rộng của ext2)

Một số hệ thống tệp (file system) trên Linux cho phép thiết lập các cờ i-node (i-node flags) khác nhau trên các tệp và thư mục. Tính năng này là một phần mở rộng không chuẩn của Linux.

> Các hệ thống BSD hiện đại cung cấp một tính năng tương tự như cờ i-node dưới dạng các cờ tệp (file flags) được thiết lập bằng cách sử dụng `chflags(1)` và `chflags(2)`.

Hệ thống tệp Linux đầu tiên hỗ trợ cờ i-node là ext2, và các cờ này đôi khi được gọi là các thuộc tính tệp mở rộng của ext2 (ext2 extended file attributes). Sau đó, việc hỗ trợ cờ i-node đã được bổ sung trên các hệ thống tệp khác, bao gồm Btrfs, ext3, ext4, Reiserfs (từ Linux 2.4.19), XFS (từ Linux 2.4.25 và 2.6), và JFS (từ Linux 2.6.17).

> Phạm vi các cờ i-node được hỗ trợ có sự khác biệt tùy theo từng hệ thống tệp. Để sử dụng cờ i-node trên hệ thống tệp Reiserfs, chúng ta phải sử dụng tùy chọn `mount –o attrs` khi tiến hành mount hệ thống tệp.

Từ shell, cờ i-node có thể được thiết lập và xem bằng cách sử dụng các lệnh `chattr` và `lsattr`, như được thể hiện trong ví dụ sau:

```

$ lsattr myfile
-------- myfile
$ chattr +ai myfile Turn on Append Only and Immutable flags
$ lsattr myfile
----ia-- myfile

```

Bên trong một chương trình, cờ i-node có thể được truy xuất và chỉnh sửa bằng cách sử dụng System Call `ioctl()`, sẽ được trình bày chi tiết ngay sau đây.

Cờ i-node có thể được thiết lập trên cả tệp thông thường (regular file) và thư mục. Hầu hết các cờ i-node được thiết kế để sử dụng với các tệp thông thường, mặc dù một số trong số chúng cũng có ý nghĩa (hoặc chỉ có ý nghĩa) đối với các thư mục. [Bảng 15-6](#page-72-0) tóm tắt phạm vi các cờ i-node khả dụng, hiển thị tên cờ tương ứng (được định nghĩa trong `<linux/fs.h>`) được sử dụng từ các chương trình trong các lệnh gọi `ioctl()`, và ký tự tùy chọn được sử dụng với lệnh `chattr`.

> Trước Linux 2.6.19, các hằng số `FS_*` được hiển thị trong [Bảng 15-6](#page-72-0) chưa được định nghĩa trong `<linux/fs.h>`. Thay vào đó, có một tập hợp các tệp header đặc trưng cho từng hệ thống tệp, định nghĩa các tên hằng số đặc trưng cho hệ thống tệp đó, tất cả đều có cùng giá trị. Do đó, ext2 có `EXT2_APPEND_FL`, được định nghĩa trong `<linux/ext2_fs.h>`; Reiserfs có `REISERFS_APPEND_FL`, được định nghĩa với cùng giá trị trong `<linux/reiser_fs.h>`; v.v. Vì mỗi tệp header đều định nghĩa các hằng số tương ứng với cùng một giá trị, trên các hệ thống cũ không cung cấp các định nghĩa trong `<linux/fs.h>`, chúng ta có thể bao gồm (include) bất kỳ tệp header nào trong số đó và sử dụng tên đặc trưng của hệ thống tệp đó.

**Bảng 15-6:** Cờ I-node

| Hằng số (Constant) | Tùy chọn chattr | Mục đích                                                 |
|--------------------|------------------|----------------------------------------------------------|
| FS_APPEND_FL       | a                | Chỉ cho phép nối thêm (Append only) (yêu cầu đặc quyền)  |
| FS_COMPR_FL        | c                | Bật nén tệp (chưa được triển khai)                       |
| FS_DIRSYNC_FL      | D                | Cập nhật thư mục đồng bộ (từ Linux 2.6)                  |
| FS_IMMUTABLE_FL    | i                | Bất biến - Immutable (yêu cầu đặc quyền)                 |
| FS_JOURNAL_DATA_FL | j                | Bật ghi nhật ký dữ liệu (data journaling) (yêu cầu đặc quyền) |
| FS_NOATIME_FL      | A                | Không cập nhật thời gian truy cập cuối cùng của tệp      |
| FS_NODUMP_FL       | d                | Không sao lưu (No dump)                                  |
| FS_NOTAIL_FL       | t                | Không gộp đuôi (No tail packing)                         |
| FS_SECRM_FL        | s                | Xóa bảo mật (Secure deletion) (chưa được triển khai)    |
| FS_SYNC_FL         | S                | Cập nhật tệp (và thư mục) đồng bộ                        |
| FS_TOPDIR_FL       | T                | Coi là thư mục cấp cao nhất cho thuật toán Orlov (từ Linux 2.6) |
| FS_UNRM_FL         | u                | Tệp có thể được khôi phục (chưa được triển khai)         |

Các cờ `FL_*` khác nhau và ý nghĩa của chúng như sau:

### FS\_APPEND\_FL

Tệp chỉ có thể được mở để ghi nếu cờ `O_APPEND` được chỉ định (do đó buộc mọi thao tác cập nhật tệp phải được nối thêm vào cuối tệp). Cờ này có thể được sử dụng cho tệp nhật ký (log file), chẳng hạn. Chỉ các tiến trình (Process) có đặc quyền (`CAP_LINUX_IMMUTABLE`) mới có thể thiết lập cờ này.

### FS\_COMPR\_FL

Lưu trữ tệp trên đĩa ở định dạng nén. Tính năng này không được triển khai như một phần chuẩn của bất kỳ hệ thống tệp gốc (native file system) lớn nào trên Linux. (Có các gói phần mềm thực thi tính năng này cho ext2 và ext3). Xét đến chi phí lưu trữ đĩa thấp, chi phí xử lý của CPU (CPU overhead) liên quan đến việc nén và giải nén, cùng với thực tế là việc nén một tệp đồng nghĩa với việc việc truy cập ngẫu nhiên vào nội dung tệp (thông qua `lseek()`) không còn đơn giản nữa, việc nén tệp là không mong muốn đối với nhiều ứng dụng.

### FS\_DIRSYNC\_FL (từ Linux 2.6)

Làm cho các cập nhật thư mục (ví dụ: `open(pathname, O_CREAT)`, `link()`, `unlink()` và `mkdir()`) trở nên đồng bộ (synchronous). Điều này tương tự như cơ chế cập nhật tệp đồng bộ được mô tả trong Mục [13.3.](#page-6-1) Giống như các bản cập nhật tệp đồng bộ, hiệu năng sẽ bị ảnh hưởng khi thực hiện các cập nhật thư mục đồng bộ. Thiết lập này chỉ có thể được áp dụng cho các thư mục. (Cờ mount `MS_DIRSYNC` được mô tả trong Mục [14.8.1](#page-31-1) cung cấp tính năng tương tự, nhưng áp dụng trên từng điểm mount - per-mount).

### FS\_IMMUTABLE\_FL

Làm cho tệp trở thành bất biến (immutable). Dữ liệu tệp không thể được cập nhật (`write()` và `truncate()`) và các thay đổi về metadata bị ngăn chặn (ví dụ: `chmod()`, `chown()`, `unlink()`, `link()`, `rename()`, `rmdir()`, `utime()`, `setxattr()` và `removexattr()`). Chỉ các tiến trình (Process) có đặc quyền (`CAP_LINUX_IMMUTABLE`) mới có thể thiết lập cờ này cho một tệp. Khi cờ này được thiết lập, ngay cả tiến trình có đặc quyền cũng không thể thay đổi nội dung hoặc metadata của tệp.

### FS\_JOURNAL\_DATA\_FL

Bật tính năng ghi nhật ký (journaling) dữ liệu. Cờ này chỉ được hỗ trợ trên hệ thống tệp (file system) ext3 và ext4. Các hệ thống tệp này cung cấp ba mức độ ghi nhật ký: journal, ordered và writeback. Tất cả các chế độ đều ghi nhật ký các cập nhật đối với metadata của tệp, nhưng chế độ journal ghi nhật ký bổ sung cả các cập nhật đối với dữ liệu của tệp. Trên một hệ thống tệp đang ghi nhật ký ở chế độ ordered hoặc writeback, một tiến trình có đặc quyền (`CAP_SYS_RESOURCE`) có thể bật tính năng ghi nhật ký các cập nhật dữ liệu trên cơ sở từng tệp bằng cách thiết lập cờ này. (Trang hướng dẫn sử dụng `mount(8)` mô tả sự khác biệt giữa chế độ ordered và writeback).

### FS\_NOATIME\_FL

Không cập nhật thời gian truy cập cuối cùng của tệp (last access time) khi tệp được truy cập. Điều này loại bỏ sự cần thiết phải cập nhật i-node của tệp mỗi khi tệp được truy cập, qua đó cải thiện hiệu năng I/O (xem mô tả về cờ `MS_NOATIME` tại Mục [14.8.1](#page-31-1)).

### FS\_NODUMP\_FL

Không bao gồm tệp này trong các bản sao lưu (backup) được tạo bằng lệnh `dump(8)`. Hiệu ứng của cờ này phụ thuộc vào tùy chọn `-h` được mô tả trong trang hướng dẫn sử dụng `dump(8)`.

### FS\_NOTAIL\_FL

Vô hiệu hóa tính năng dồn đuôi tệp (tail packing). Cờ này chỉ được hỗ trợ trên hệ thống tệp Reiserfs. Nó vô hiệu hóa tính năng tail-packing của Reiserfs, vốn cố gắng dồn các tệp nhỏ (và đoạn cuối cùng của các tệp lớn hơn) vào cùng một khối đĩa (disk block) với metadata của tệp. Tính năng dồn đuôi tệp cũng có thể bị vô hiệu hóa cho toàn bộ hệ thống tệp Reiserfs bằng cách mount nó với tùy chọn `mount –notail`.

### FS\_SECRM\_FL

Xóa tệp một cách bảo mật. Mục đích dự kiến của tính năng chưa được hiện thực hóa này là khi bị xóa, tệp sẽ được xóa một cách an toàn, nghĩa là nó sẽ được ghi đè trước tiên để ngăn chương trình quét đĩa đọc hoặc tạo lại tệp đó. (Vấn đề xóa thực sự bảo mật khá phức tạp: thực tế nó có thể đòi hỏi nhiều lần ghi trên thiết bị lưu trữ từ tính để xóa sạch dữ liệu đã được ghi trước đó; xem [Gutmann, 1996]).

### FS\_SYNC\_FL

Làm cho các cập nhật tệp trở nên đồng bộ (synchronous). Khi áp dụng cho các tệp, cờ này khiến các thao tác ghi vào tệp được thực hiện đồng bộ (giống như khi cờ `O_SYNC` được chỉ định trong tất cả các lần mở tệp này). Khi áp dụng cho một thư mục, cờ này có tác dụng tương tự như cờ cập nhật thư mục đồng bộ được mô tả ở trên.

### FS\_TOPDIR\_FL (từ Linux 2.6)

Cờ này đánh dấu một thư mục để được xử lý đặc biệt theo chiến lược cấp phát khối (block-allocation strategy) Orlov. Chiến lược Orlov là một bản chỉnh sửa lấy cảm hứng từ BSD đối với chiến lược cấp phát khối của ext2, nhằm cố gắng cải thiện khả năng các tệp có liên quan với nhau (ví dụ: các tệp trong một thư mục duy nhất) được đặt gần nhau trên đĩa, từ đó có thể cải thiện thời gian tìm kiếm đĩa (disk seek times). Để biết thêm chi tiết, hãy xem [Corbet, 2002] và [Kumar, et al. 2008]. `FS_TOPDIR_FL` chỉ có tác dụng đối với ext2 và các hệ thống kế thừa của nó là ext3 và ext4.

### FS\_UNRM\_FL

Cho phép tệp này có thể được khôi phục (hoàn tác xóa - undeleted) nếu nó bị xóa. Tính năng này chưa được hiện thực hóa (implemented), vì có thể triển khai các cơ chế khôi phục tệp ở bên ngoài kernel (User Space).

Nhìn chung, khi các cờ i-node (i-node flags) được thiết lập trên một thư mục, chúng sẽ tự động được kế thừa bởi các tệp mới và các thư mục con được tạo trong thư mục đó. Có một số ngoại lệ đối với quy tắc này:

- Cờ `FS_DIRSYNC_FL` (`chattr +D`), chỉ có thể áp dụng cho một thư mục, nhưng chỉ được kế thừa bởi các thư mục con được tạo bên trong thư mục đó.
- Khi cờ `FS_IMMUTABLE_FL` (`chattr +i`) được áp dụng cho một thư mục, nó không bị kế thừa bởi các tệp và thư mục con được tạo bên trong thư mục đó, vì cờ này ngăn cản việc các mục mới được thêm vào thư mục.

Bên trong một chương trình, các cờ i-node có thể được truy xuất và sửa đổi bằng cách sử dụng các thao tác `ioctl()` là `FS_IOC_GETFLAGS` và `FS_IOC_SETFLAGS`. (Các hằng số này được định nghĩa trong `<linux/fs.h>`.) Đoạn mã sau đây minh họa cách bật cờ `FS_NOATIME_FL` trên tệp được trỏ tới bởi file descriptor (mô tả tệp) `fd` đang mở:

```c

int attr;
if (ioctl(fd, FS_IOC_GETFLAGS, &attr) == -1) /* Lấy các cờ hiện tại */
errExit("ioctl");
attr |= FS_NOATIME_FL;
if (ioctl(fd, FS_IOC_SETFLAGS, &attr) == -1) /* Cập nhật các cờ */
errExit("ioctl");

```

Để thay đổi các cờ i-node của một tệp, ID người dùng hiệu dụng (effective user ID) của process ( tiến trình) phải khớp với ID người dùng (chủ sở hữu) của tệp, hoặc tiến trình đó phải có đặc quyền (có capability `CAP_FOWNER`). (Nói một cách chính xác, trên Linux, đối với một tiến trình không có đặc quyền, chính là ID người dùng hệ thống tệp - file-system user ID của tiến trình, chứ không phải ID người dùng hiệu dụng của nó, phải khớp với ID người dùng của tệp, như được mô tả trong Mục 9.5.)

## 15.6 Tóm tắt

System Call (lời gọi hệ thống) `stat()` truy xuất thông tin về một tệp (metadata), phần lớn trong số đó được lấy từ i-node của tệp. Thông tin này bao gồm quyền sở hữu tệp, quyền hạn tệp (file permissions) và các dấu thời gian của tệp (file timestamps).

Một chương trình có thể cập nhật thời gian truy cập lần cuối và thời gian sửa đổi lần cuối của tệp bằng cách sử dụng `utime()`, `utimes()` và các giao diện tương tự khác.

Mỗi tệp có một ID người dùng (chủ sở hữu) và ID nhóm đi kèm, cũng như một tập hợp các bit quyền hạn. Nhằm mục đích phân quyền, người dùng tệp được chia thành ba loại: chủ sở hữu (còn gọi là user), nhóm (group) và khác (other). Ba quyền hạn có thể được cấp cho mỗi loại người dùng: đọc (read), ghi (write) và thực thi (execute). Sơ đồ tương tự được sử dụng với các thư mục, mặc dù các bit quyền có ý nghĩa khác nhau một chút. Các system call `chown()` và `chmod()` thay đổi quyền sở hữu và quyền hạn của một tệp. System call `umask()` thiết lập một mặt nạ (mask) gồm các bit quyền luôn bị vô hiệu hóa khi tiến trình gọi tạo ra một tệp.

Ba bit quyền bổ sung được sử dụng cho các tệp và thư mục. Các bit quyền set-user-ID và set-group-ID có thể được áp dụng cho các tệp chương trình để tạo ra các chương trình khiến tiến trình đang thực thi đạt được đặc quyền bằng cách giả định một định danh người dùng hoặc nhóm hiệu dụng khác (định danh của tệp chương trình). Đối với các thư mục nằm trên hệ thống tệp được mount bằng tùy chọn `nogrpid` (`sysvgroups`), bit quyền set-group-ID có thể được dùng để kiểm soát việc các tệp mới được tạo trong thư mục đó kế thừa ID nhóm của chúng từ ID nhóm hiệu dụng của tiến trình hay từ ID nhóm của thư mục cha. Khi được áp dụng cho các thư mục, bit quyền sticky đóng vai trò là cờ xóa hạn chế (restricted deletion flag).

Các cờ i-node kiểm soát các hành vi khác nhau của tệp và thư mục. Mặc dù ban đầu được định nghĩa cho ext2, các cờ này hiện đã được hỗ trợ trên một số hệ thống tệp khác.

## 15.7 Bài tập

- **15-1.** Mục [15.4](#page-61-1) có chứa một số tuyên bố về các quyền (permissions) cần thiết cho các thao tác hệ thống tập tin (file-system operations) khác nhau. Hãy sử dụng các lệnh shell hoặc viết chương trình để kiểm chứng hoặc trả lời các câu hỏi sau:
  - a) Việc loại bỏ toàn bộ quyền của chủ sở hữu (owner permissions) khỏi một tập tin sẽ từ chối quyền truy cập của chính chủ sở hữu đó, mặc dù nhóm (group) và những người dùng khác (other) vẫn có quyền truy cập.
  - b) Trên một thư mục có quyền đọc (read permission) nhưng không có quyền thực thi (execute permission), tên của các tập tin bên trong thư mục đó có thể được liệt kê, nhưng bản thân các tập tin đó thì không thể truy cập được, bất kể quyền trên các tập tin đó là gì.
  - c) Những quyền nào là bắt buộc đối với thư mục cha (parent directory) và bản thân tập tin để tạo một tập tin mới, mở một tập tin để đọc, mở một tập tin để ghi, và xóa một tập tin? Những quyền nào là bắt buộc đối với thư mục nguồn và thư mục đích để đổi tên (rename) một tập tin? Nếu tập tin đích của một thao tác đổi tên đã tồn tại, những quyền nào là bắt buộc trên tập tin đó? Việc thiết lập bit quyền sticky (sticky permission bit - `chmod +t`) của một thư mục ảnh hưởng như thế nào đến các thao tác đổi tên và xóa?
- **15-2.** Bạn có kỳ vọng bất kỳ mốc thời gian nào trong ba mốc thời gian của tập tin (file timestamps) bị thay đổi bởi system call `stat()` hay không? Nếu không, hãy giải thích tại sao.
- **15-3.** Trên một hệ thống chạy Linux 2.6, hãy sửa đổi chương trình trong [Liệt kê 15-1](#page-51-0) (`t_stat.c`) sao cho các mốc thời gian của tập tin được hiển thị với độ chính xác đến nano giây (nanosecond accuracy).
- **15-4.** System call `access()` kiểm tra các quyền bằng cách sử dụng ID người dùng thực (real user ID) và ID nhóm thực (real group ID) của tiến trình (process). Hãy viết một hàm tương ứng thực hiện việc kiểm tra dựa theo ID người dùng hiệu dụng (effective user ID) và ID nhóm hiệu dụng (effective group ID) của tiến trình.
- **15-5.** Như đã lưu ý trong Mục [15.4.6](#page-68-0), `umask()` luôn thiết lập umask của tiến trình và đồng thời trả về một bản sao của umask cũ. Làm thế nào chúng ta có thể lấy được một bản sao của umask hiện tại của tiến trình mà không làm thay đổi nó?
- **15-6.** Lệnh `chmod a+rX file` bật quyền đọc cho mọi phân loại người dùng (categories of user), đồng thời cũng bật quyền thực thi cho mọi phân loại người dùng nếu `file` là một thư mục hoặc quyền thực thi đã được bật cho bất kỳ phân loại người dùng nào đối với `file`, như được minh họa trong ví dụ sau:

```

$ ls -ld dir file prog
dr-------- 2 mtk users 48 May 4 12:28 dir
-r-------- 1 mtk users 19794 May 4 12:22 file
-r-x------ 1 mtk users 19336 May 4 12:21 prog
$ chmod a+rX dir file prog
$ ls -ld dir file prog
dr-xr-xr-x 2 mtk users 48 May 4 12:28 dir
-r--r--r-- 1 mtk users 19794 May 4 12:22 file
-r-xr-xr-x 1 mtk users 19336 May 4 12:21 prog

```

Hãy viết một chương trình sử dụng `stat()` và `chmod()` để thực hiện chức năng tương đương với `chmod a+rX`.

**15-7.** Hãy viết một phiên bản đơn giản của lệnh `chattr(1)`, dùng để sửa đổi các cờ i-node của tập tin (file i-node flags). Hãy xem trang man page của `chattr(1)` để biết chi tiết về giao diện dòng lệnh (command-line interface) của lệnh chattr. (Bạn không cần phải triển khai các tùy chọn `-R`, `-V` và `-v`).
