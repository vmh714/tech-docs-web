## Chương 16
# <span id="page-0-0"></span>**THUỘC TÍNH MỞ RỘNG (EXTENDED ATTRIBUTES)**

Chương này mô tả các thuộc tính mở rộng (Extended Attributes - EAs), cho phép các siêu dữ liệu (metadata) tùy ý dưới dạng các cặp tên-giá trị (name-value pairs) được liên kết với các i-node của file. EAs được thêm vào Linux từ phiên bản 2.6.

# **16.1 Tổng quan**

EAs được sử dụng để thực thi danh sách điều khiển truy cập (access control list - Chương [17\)](#page-8-0) và các khả năng của file (file capabilities - Chương 39). Tuy nhiên, thiết kế của EAs đủ tổng quát để cho phép chúng được sử dụng cho các mục đích khác. Ví dụ, EAs có thể được dùng để ghi lại số phiên bản của file, thông tin về loại MIME hoặc bảng mã ký tự cho file, hoặc (một con trỏ đến) một biểu tượng đồ họa (icon).

EAs không được quy định trong SUSv3. Tuy nhiên, một tính năng tương tự được cung cấp trên một số cài đặt UNIX khác, đáng chú ý là các hệ thống BSD hiện đại (xem `extattr(2)`) và Solaris 9 trở lên (xem `fsattr(5)`).

EAs yêu cầu sự hỗ trợ từ hệ thống file bên dưới (underlying file system). Hỗ trợ này được cung cấp trong Btrfs, ext2, ext3, ext4, JFS, Reiserfs và XFS.

> Hỗ trợ EAs là tùy chọn đối với mỗi hệ thống file và được kiểm soát bởi các tùy chọn cấu hình kernel (kernel configuration options) trong menu File systems. EAs đã được hỗ trợ trên Reiserfs kể từ Linux 2.6.7.

### **Không gian tên của EA (EA namespaces)**

EAs có tên theo định dạng `namespace.name`. Thành phần không gian tên (`namespace`) dùng để phân tách EAs thành các lớp có chức năng riêng biệt. Thành phần tên (`name`) xác định duy nhất một EA trong không gian tên đã cho.

Bốn giá trị được hỗ trợ cho `namespace`: `user`, `trusted`, `system`, và `security`. Bốn loại EAs này được sử dụng như sau:

- EAs người dùng (`user`) có thể được thao tác bởi các tiến trình không có đặc quyền (unprivileged processes), tuân theo các kiểm tra quyền hạn của file: để truy xuất giá trị của một EA người dùng, cần có quyền đọc (read permission) trên file; để thay đổi giá trị của một EA người dùng, cần có quyền ghi (write permission). (Việc thiếu quyền hạn cần thiết sẽ dẫn đến lỗi `EACCES`.) Để liên kết các EA người dùng với một file trên hệ thống file ext2, ext3, ext4, hoặc Reiserfs, hệ thống file bên dưới phải được mount với tùy chọn `user_xattr`:

```
$ mount -o user_xattr device directory
```

- EAs tin cậy (`trusted`) giống với các EA người dùng ở chỗ chúng có thể được thao tác bởi các tiến trình người dùng. Điểm khác biệt là một tiến trình phải có đặc quyền (`CAP_SYS_ADMIN`) để thao tác với các EA tin cậy.
- EAs hệ thống (`system`) được sử dụng bởi kernel để liên kết các đối tượng hệ thống với một file. Hiện tại, loại đối tượng được hỗ trợ duy nhất là danh sách điều khiển truy cập (access control list - Chương [17\)](#page-8-0).
- EAs bảo mật (`security`) được sử dụng để lưu trữ nhãn bảo mật của file cho các module bảo mật của hệ điều hành, và để liên kết các khả năng (capabilities) với các file thực thi (Mục 39.3.2). Các EA bảo mật ban đầu được thiết kế để hỗ trợ Security-Enhanced Linux (SELinux, http://www.nsa.gov/research/selinux/).

Một i-node có thể có nhiều EA liên kết, trong cùng một không gian tên hoặc trong các không gian tên khác nhau. Các tên EA trong mỗi không gian tên là các tập hợp riêng biệt. Trong không gian tên `user` và `trusted`, tên EA có thể là các chuỗi ký tự tùy ý. Trong không gian tên `system`, chỉ những tên được kernel cho phép rõ ràng (ví dụ: các tên được sử dụng cho danh sách điều khiển truy cập) mới được chấp nhận.

> JFS hỗ trợ một không gian tên khác là `os2`, không được triển khai trong các hệ thống file khác. Không gian tên `os2` được cung cấp để hỗ trợ các EA của hệ thống file OS/2 kế thừa (legacy). Một tiến trình không cần phải có đặc quyền để tạo các EA `os2`.

### **Tạo và xem Extended Attribute từ shell**

Từ shell, chúng ta có thể sử dụng các lệnh setfattr(1) và getfattr(1) để thiết lập và xem các Extended Attribute (EA) trên một file:

```
$ touch tfile
$ setfattr -n user.x -v "The past is not dead." tfile
$ setfattr -n user.y -v "In fact, it's not even past." tfile
$ getfattr -n user.x tfile Lấy giá trị của một EA đơn lẻ
# file: tfile Thông tin thông báo từ getfattr
user.x="The past is not dead." Lệnh getfattr in ra một dòng trống
 sau các thuộc tính của mỗi file
$ getfattr -d tfile Kết xuất (dump) giá trị của tất cả user EA
# file: tfile
```

```
user.x="The past is not dead."
user.y="In fact, it's not even past."
$ setfattr -n user.x tfile Thay đổi giá trị của EA thành một chuỗi rỗng
$ getfattr -d tfile
# file: tfile
user.x
user.y="In fact, it's not even past."
$ setfattr -x user.y tfile Xóa một EA
$ getfattr -d tfile
# file: tfile
user.x
```

Một trong những điểm mà phiên làm việc shell trước đó minh họa là giá trị của một EA có thể là một chuỗi rỗng, điều này không giống với một EA chưa được định nghĩa (undefined). (Ở cuối phiên làm việc shell, giá trị của user.x là một chuỗi rỗng và user.y chưa được định nghĩa).

Theo mặc định, getfattr chỉ liệt kê các giá trị của các user EA. Tùy chọn `-m` có thể được sử dụng để chỉ định một mẫu biểu thức chính quy (regular expression pattern) nhằm lựa chọn tên các EA cần hiển thị:

```
$ getfattr -m 'pattern' file
```

Giá trị mặc định cho pattern là `^user\.`. Chúng ta có thể liệt kê tất cả các EA trên một file bằng cách sử dụng lệnh sau:

```
$ getfattr -m - file
```

# **16.2 Chi tiết cài đặt Extended Attribute**

Trong phần này, chúng ta sẽ mở rộng tổng quan của phần trước để bổ sung thêm một vài chi tiết về việc cài đặt các EA.

### **Các hạn chế đối với user extended attribute**

Chỉ có thể đặt các user EA trên file và thư mục. Các loại file khác bị loại trừ vì những lý do sau:

-  Đối với một symbolic link (liên kết tượng trưng), tất cả quyền đều được bật cho tất cả người dùng và các quyền này không thể thay đổi được. (Quyền của symbolic link không có ý nghĩa trên Linux, như được trình bày chi tiết trong Mục 18.2). Điều này có nghĩa là không thể dùng phân quyền để ngăn chặn những người dùng tùy ý đặt user EA lên một symbolic link. Giải pháp cho vấn đề này là ngăn cản tất cả người dùng tạo user EA trên symbolic link.
-  Đối với các file thiết bị (device file), socket và FIFO, quyền hạn sẽ kiểm soát quyền truy cập mà người dùng được cấp nhằm mục đích thực hiện I/O trên đối tượng cơ sở. Việc thao túng các quyền này để kiểm soát việc tạo user EA sẽ xung đột với mục đích đó.

Hơn nữa, một tiến trình không có quyền đặc biệt (unprivileged process) không thể đặt user EA lên một thư mục thuộc sở hữu của người dùng khác nếu sticky bit (Mục 15.4.5) được bật trên thư mục đó. Điều này ngăn cản những người dùng tùy ý gắn các EA vào các thư mục như `/tmp`, vốn là các thư mục cho phép ghi công khai (do đó có thể cho phép người dùng tùy ý thao túng EA trên thư mục), nhưng được bật sticky bit để ngăn người dùng xóa các file thuộc sở hữu của người dùng khác trong thư mục đó.

## **Giới hạn triển khai**

Linux VFS (Virtual File System) áp đặt các giới hạn sau đây đối với Extended Attribute (EA) trên tất cả các hệ thống tập tin (file systems):

-  Chiều dài của một tên EA được giới hạn tối đa 255 ký tự.
-  Giá trị của một EA bị giới hạn tối đa 64 kB.

Ngoài ra, một số hệ thống tập tin áp đặt các giới hạn khắt khe hơn về kích thước và số lượng EA có thể gắn với một tập tin:

-  Trên ext2, ext3 và ext4, tổng số byte được sử dụng bởi tên và giá trị của tất cả các EA trên một tập tin bị giới hạn bằng kích thước của một khối đĩa logic đơn (Phần 14.3): 1024, 2048 hoặc 4096 byte.
-  Trên JFS, có một giới hạn trên là 128 kB đối với tổng số byte được sử dụng bởi tên và giá trị của tất cả các EA trên một tập tin.

# **16.3 System Call thao tác với Extended Attribute**

Trong phần này, chúng ta sẽ xem xét các System Call được sử dụng để cập nhật, truy xuất và xóa các EA.

## **Tạo và sửa đổi EA**

Các System Call `setxattr()`, `lsetxattr()` và `fsetxattr()` thiết lập giá trị cho một trong các EA của tập tin.

```
#include <sys/xattr.h>
int setxattr(const char *pathname, const char *name, const void *value,
 size_t size, int flags);
int lsetxattr(const char *pathname, const char *name, const void *value,
 size_t size, int flags);
int fsetxattr(int fd, const char *name, const void *value,
 size_t size, int flags);
                                      Tất cả trả về 0 khi thành công, hoặc –1 khi lỗi
```

Sự khác biệt giữa ba lời gọi này tương tự như giữa `stat()`, `lstat()` và `fstat()` (Phần 15.1):

-  `setxattr()` định danh tập tin bằng đường dẫn `pathname`, và giải tham chiếu (dereference) tên tập tin nếu đó là một liên kết tượng trưng (symbolic link);
-  `lsetxattr()` định danh tập tin bằng đường dẫn `pathname`, nhưng không giải tham chiếu liên kết tượng trưng; và
-  `fsetxattr()` định danh tập tin bằng File Descriptor `fd` đang mở.

Sự phân biệt tương tự cũng áp dụng cho các nhóm System Call khác được mô tả trong phần còn lại của chương này.

Đối số `name` là một chuỗi kết thúc bằng ký tự null định nghĩa tên của EA. Đối số `value` là một con trỏ trỏ đến bộ đệm (buffer) xác định giá trị mới cho EA. Đối số `size` chỉ định chiều dài của bộ đệm này.

Theo mặc định, các System Call này tạo một EA mới nếu chưa tồn tại EA nào có tên được chỉ định, hoặc thay thế giá trị của EA nếu nó đã tồn tại. Đối số `flags` cung cấp khả năng kiểm soát chi tiết hơn đối với hành vi này. Nó có thể được chỉ định là 0 để nhận hành vi mặc định, hoặc là một trong các hằng số sau:

```
XATTR_CREATE
```

Thất bại (trả về `EEXIST`) nếu đã tồn tại một EA với tên được chỉ định.

XATTR\_REPLACE

Thất bại (trả về `ENODATA`) nếu chưa tồn tại EA nào với tên được chỉ định.

Dưới đây là một ví dụ về việc sử dụng `setxattr()` để tạo một user EA:

```
char *value;
value = "The past is not dead.";
if (setxattr(pathname, "user.x", value, strlen(value), 0) == -1)
 errExit("setxattr");
```

### **Truy xuất giá trị của một EA**

Các System Call `getxattr()`, `lgetxattr()` và `fgetxattr()` dùng để truy xuất giá trị của một EA (Extended Attribute).

```
#include <sys/xattr.h>
ssize_t getxattr(const char *pathname, const char *name, void *value,
 size_t size);
ssize_t lgetxattr(const char *pathname, const char *name, void *value,
 size_t size);
ssize_t fgetxattr(int fd, const char *name, void *value,
                size_t size);
           Tất cả đều trả về kích thước (không âm) của giá trị EA khi thành công, hoặc –1 khi lỗi
```

Tham số `name` là một chuỗi kết thúc bằng null (null-terminated string) để xác định EA mà chúng ta muốn truy xuất giá trị. Giá trị EA được trả về trong bộ đệm (buffer) do `value` trỏ tới. Bộ đệm này phải được cấp phát bởi bên gọi (caller), và độ dài của nó phải được chỉ định trong `size`. Khi thành công, các System Call này trả về số lượng byte được sao chép vào `value`.

Nếu tệp không có thuộc tính với tên đã cho, các System Call này sẽ thất bại với mã lỗi `ENODATA`. Nếu `size` quá nhỏ, các System Call này sẽ thất bại với mã lỗi `ERANGE`.

Có thể chỉ định `size` bằng 0, trong trường hợp này `value` sẽ bị bỏ qua nhưng System Call vẫn trả về kích thước của giá trị EA. Điều này cung cấp một cơ chế để xác định kích thước bộ đệm cần thiết cho một lời gọi tiếp theo nhằm thực sự lấy giá trị EA. Tuy nhiên, cần lưu ý rằng chúng ta vẫn không được đảm bảo rằng kích thước được trả về sẽ đủ lớn khi cố gắng truy xuất giá trị sau đó. Một Process ( tiến trình) khác có thể đã gán một giá trị lớn hơn cho thuộc tính trong khoảng thời gian đó, hoặc đã xóa hoàn toàn thuộc tính.

### **Xóa một EA**

Các System Call `removexattr()`, `lremovexattr()` và `fremovexattr()` dùng để xóa một EA khỏi một tệp.

```
#include <sys/xattr.h>
int removexattr(const char *pathname, const char *name);
int lremovexattr(const char *pathname, const char *name);
int fremovexattr(int fd, const char *name);
                                          Tất cả đều trả về 0 khi thành công, hoặc –1 khi lỗi
```

Chuỗi kết thúc bằng null được cung cấp trong `name` xác định EA cần bị xóa. Nỗ lực xóa một EA không tồn tại sẽ thất bại với mã lỗi `ENODATA`.

## **Truy xuất tên của tất cả các EA liên kết với một tệp**

Các System Call `listxattr()`, `llistxattr()` và `flistxattr()` trả về một danh sách chứa tên của tất cả các EA liên kết với một tệp.

```
#include <sys/xattr.h>
ssize_t listxattr(const char *pathname, char *list, size_t size);
ssize_t llistxattr(const char *pathname, char *list, size_t size);
ssize_t flistxattr(int fd, char *list, size_t size);
             Tất cả đều trả về số lượng byte được sao chép vào list khi thành công, hoặc –1 khi lỗi
```

Danh sách tên EA được trả về dưới dạng một chuỗi các chuỗi kết thúc bằng null nằm trong bộ đệm do `list` trỏ tới. Kích thước của bộ đệm này phải được chỉ định trong `size`. Khi thành công, các System Call này trả về số lượng byte được sao chép vào `list`.

Giống như `getxattr()`, có thể chỉ định `size` bằng 0, trong trường hợp này `list` bị bỏ qua, nhưng System Call sẽ trả về kích thước bộ đệm cần thiết cho một lời gọi tiếp theo để thực sự lấy danh sách tên EA (giả sử danh sách này không thay đổi).

Để truy xuất danh sách tên EA liên kết với một tệp, chỉ yêu cầu tệp đó có thể truy cập được (tức là chúng ta có quyền thực thi `execute access` đối với tất cả các thư mục có trong `pathname`). Không cần quyền hạn nào trên chính tệp đó.

Vì lý do bảo mật, tên EA được trả về trong `list` có thể loại trừ các thuộc tính mà Process gọi (calling process) không có quyền truy cập. Ví dụ, hầu hết các File System (hệ thống tệp) đều bỏ qua các thuộc tính đáng tin cậy (`trusted attributes`) khỏi danh sách được trả về bởi lời gọi `listxattr()` trong một Process không có đặc quyền (`unprivileged process`). Nhưng hãy chú ý từ "có thể" (`may`) trong câu trước, cho thấy rằng việc triển khai File System không bắt buộc phải làm điều này. Do đó, chúng ta cần tính đến khả năng lời gọi tiếp theo tới `getxattr()` sử dụng tên EA được trả về trong `list` có thể thất bại vì Process không có đặc quyền cần thiết để lấy giá trị của EA đó. (Một lỗi tương tự cũng có thể xảy ra nếu một Process khác xóa thuộc tính trong khoảng thời gian giữa các lần gọi `listxattr()` và `getxattr()`.)

### **Chương trình ví dụ**

Chương trình trong [Listing 16-1](#page-6-0) truy xuất và hiển thị tên và giá trị của tất cả các thuộc tính mở rộng (Extended Attribute - EA) của các tệp được liệt kê trên dòng lệnh của nó. Đối với mỗi tệp, chương trình sử dụng `listxattr()` để lấy tên của tất cả các EA được liên kết với tệp, sau đó thực thi một vòng lặp gọi `getxattr()` một lần cho mỗi tên để truy xuất giá trị tương ứng. Theo mặc định, các giá trị thuộc tính được hiển thị dưới dạng văn bản thuần túy (plain text). Nếu tùy chọn `-x` được cung cấp, các giá trị thuộc tính sẽ được hiển thị dưới dạng chuỗi thập lục phân (hexadecimal string). Nhật ký phiên dòng lệnh sau đây minh họa cách sử dụng chương trình này:

```
$ setfattr -n user.x -v "The past is not dead." tfile
$ setfattr -n user.y -v "In fact, it's not even past." tfile
$ ./xattr_view tfile
tfile:
 name=user.x; value=The past is not dead.
 name=user.y; value=In fact, it's not even past.
```

<span id="page-6-0"></span>**Listing 16-1:** Hiển thị các thuộc tính mở rộng của tệp

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– xattr/xattr_view.c
#include <sys/xattr.h>
#include "tlpi_hdr.h"
#define XATTR_SIZE 10000
static void
usageError(char *progName)
{
 fprintf(stderr, "Usage: %s [-x] file...\n", progName);
 exit(EXIT_FAILURE);
}
int
main(int argc, char *argv[])
{
 char list[XATTR_SIZE], value[XATTR_SIZE];
 ssize_t listLen, valueLen;
 int ns, j, k, opt;
 Boolean hexDisplay;
 hexDisplay = 0;
 while ((opt = getopt(argc, argv, "x")) != -1) {
 switch (opt) {
 case 'x': hexDisplay = 1; break;
 case '?': usageError(argv[0]);
 }
 }
 if (optind >= argc + 2)
 usageError(argv[0]);
```

```
 for (j = optind; j < argc; j++) {
 listLen = listxattr(argv[j], list, XATTR_SIZE);
 if (listLen == -1)
 errExit("listxattr");
 printf("%s:\n", argv[j]);
 /* Lặp qua tất cả các tên EA, hiển thị tên + giá trị */
 for (ns = 0; ns < listLen; ns += strlen(&list[ns]) + 1) {
 printf(" name=%s; ", &list[ns]);
 valueLen = getxattr(argv[j], &list[ns], value, XATTR_SIZE);
 if (valueLen == -1) {
 printf("couldn't get value");
 } else if (!hexDisplay) {
 printf("value=%.*s", (int) valueLen, value);
 } else {
 printf("value=");
 for (k = 0; k < valueLen; k++)
 printf("%02x ", (unsigned int) value[k]);
 }
 printf("\n");
 }
 printf("\n");
 }
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– xattr/xattr_view.c
```

# **16.4 Tổng kết**

Từ phiên bản 2.6 trở đi, Linux hỗ trợ các thuộc tính mở rộng (extended attribute), cho phép siêu dữ liệu (metadata) tùy ý được liên kết với một tệp dưới dạng các cặp tên-giá trị (name-value pair).

# **16.5 Bài tập**

**16-1.** Viết một chương trình có thể được sử dụng để tạo hoặc sửa đổi một EA người dùng (user EA) cho một tệp (tức là một phiên bản đơn giản của `setfattr(1)`). Tên tệp, tên EA và giá trị EA phải được cung cấp làm đối số dòng lệnh cho chương trình.
