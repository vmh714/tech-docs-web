# Chương 16: Thuộc tính mở rộng (Extended Attributes)

Chương này mô tả các thuộc tính mở rộng (Extended Attributes - EA), cho phép gán siêu dữ liệu (metadata) tùy ý dưới dạng các cặp tên-giá trị (name-value pairs) vào các i-node của file. EA được đưa vào Linux từ phiên bản 2.6.

## 16.1 Tổng quan

EA được sử dụng để hiện thực hóa danh sách điều khiển truy cập (Access Control Lists - Chương [17](#page-8-0)) và file capability (Chương 39). Tuy nhiên, thiết kế của EA đủ tính khái quát để có thể phục vụ nhiều mục đích khác. Chẳng hạn, EA có thể dùng để lưu trữ số phiên bản file, thông tin về kiểu MIME hoặc bảng mã ký tự (character set) của file, hay (một con trỏ chỉ tới) một biểu tượng đồ họa (icon).

EA không được quy định trong chuẩn SUSv3. Tuy nhiên, tính năng tương tự cũng xuất hiện trên một số bản triển khai UNIX khác, đáng chú ý nhất là các hệ điều hành BSD hiện đại (xem `extattr(2)`) và Solaris 9 trở về sau (xem `fsattr(5)`).

EA đòi hỏi sự hỗ trợ từ hệ thống file bên dưới (underlying file system). Tính năng này được hỗ trợ sẵn trong Btrfs, ext2, ext3, ext4, JFS, Reiserfs và XFS.

> [!NOTE]
> Khả năng hỗ trợ EA là tùy chọn đối với từng hệ thống file và được kiểm soát thông qua các tùy chọn cấu hình kernel (kernel configuration options) dưới menu *File systems*. EA được hỗ trợ trên Reiserfs kể từ Linux 2.6.7.

### Không gian tên của EA (EA namespaces)

EA có tên theo định dạng `namespace.name`. Thành phần `namespace` (không gian tên) có nhiệm vụ phân chia EA thành các nhóm chức năng riêng biệt. Thành phần `name` (tên) dùng để định danh duy nhất một EA trong không gian tên đó.

Bốn giá trị được hỗ trợ cho `namespace` gồm: `user`, `trusted`, `system`, và `security`. Bốn loại EA này được sử dụng như sau:

- **User EA** có thể được thao tác bởi các tiến trình không có đặc quyền (unprivileged processes), chịu sự kiểm tra quyền truy cập file thông thường: để đọc giá trị của một user EA đòi hỏi quyền đọc (`read`) trên file; để sửa đổi giá trị đòi hỏi quyền ghi (`write`). (Nếu thiếu quyền hạn cần thiết, hệ thống sẽ trả về lỗi `EACCES`.) Để gắn các user EA vào một file trên các hệ thống file ext2, ext3, ext4 hoặc Reiserfs, hệ thống file bên dưới phải được mount với tùy chọn `user_xattr`:

```bash
$ mount -o user_xattr device directory
```

- **Trusted EA** tương tự user EA ở chỗ có thể được thao tác bởi các tiến trình người dùng. Điểm khác biệt duy nhất là tiến trình phải có đặc quyền (`CAP_SYS_ADMIN`) mới có thể thao tác với trusted EA.
- **System EA** được kernel sử dụng để liên kết các đối tượng hệ thống với file. Hiện tại, loại đối tượng duy nhất được hỗ trợ là danh sách điều khiển truy cập (Chương [17](#page-8-0)).
- **Security EA** dùng để lưu trữ nhãn bảo mật file cho các Linux Security Modules (LSM), và liên kết các capability với các file thực thi (Mục 39.3.2). Ban đầu, security EA được thiết kế để phục vụ Security-Enhanced Linux (SELinux, `http://www.nsa.gov/research/selinux/`).

Một i-node có thể gắn kèm nhiều EA, trong cùng một không gian tên hoặc ở các không gian tên khác nhau. Tập hợp tên EA bên trong mỗi không gian tên là độc lập và phân biệt. Trong không gian tên `user` và `trusted`, tên EA có thể là các chuỗi ký tự tùy ý. Trong không gian tên `system`, chỉ những tên được kernel quy định rõ ràng (ví dụ: các tên dùng cho danh sách điều khiển truy cập) mới được phép sử dụng.

> [!NOTE]
> JFS hỗ trợ thêm một không gian tên khác là `os2` mà các hệ thống file khác không có. Không gian tên `os2` được cung cấp nhằm tương thích với các EA kế thừa từ hệ thống file OS/2 cũ. Tiến trình không cần đặc quyền vẫn có thể tạo các EA `os2`.

### Tạo và xem EA từ shell

Từ shell, chúng ta có thể sử dụng các lệnh `setfattr(1)` và `getfattr(1)` để thiết lập và kiểm tra các EA trên file:

```bash
$ touch tfile
$ setfattr -n user.x -v "The past is not dead." tfile
$ setfattr -n user.y -v "In fact, it's not even past." tfile
$ getfattr -n user.x tfile                       # Lấy giá trị của một EA đơn lẻ
## file: tfile                                    # Thông báo thông tin từ getfattr
user.x="The past is not dead."                   # getfattr in một dòng trống
## sau các thuộc tính của mỗi file
$ getfattr -d tfile                              # Trích xuất (dump) giá trị của tất cả user EA
## file: tfile
user.x="The past is not dead."
user.y="In fact, it's not even past."
$ setfattr -n user.x tfile                       # Đổi giá trị EA thành một chuỗi rỗng
$ getfattr -d tfile
## file: tfile
user.x
user.y="In fact, it's not even past."
$ setfattr -x user.y tfile                       # Xóa một EA
$ getfattr -d tfile
## file: tfile
user.x
```

Một trong những điểm mà phiên làm việc shell trên chứng minh là giá trị của một EA có thể là một chuỗi rỗng, và điều này hoàn toàn khác với việc EA đó không tồn tại (chưa được định nghĩa). (Ở cuối phiên làm việc, giá trị của `user.x` là chuỗi rỗng, còn `user.y` đã bị xóa hoàn toàn).

Theo mặc định, `getfattr` chỉ liệt kê các giá trị của user EA. Tùy chọn `-m` có thể được sử dụng để chỉ định một biểu thức chính quy (regex) nhằm lọc ra các tên EA cần hiển thị:

```bash
$ getfattr -m 'pattern' file
```

Giá trị mặc định của `pattern` là `^user\.`. Chúng ta có thể liệt kê tất cả các EA trên một file bằng lệnh sau:

```bash
$ getfattr -m - file
```

## 16.2 Chi tiết cài đặt thuộc tính mở rộng

Phần này sẽ đi sâu vào một số chi tiết kỹ thuật bên dưới của cơ chế triển khai EA.

### Các hạn chế đối với user extended attribute

User EA chỉ có thể áp dụng cho file thông thường (regular file) và thư mục (directory). Các loại file khác bị loại trừ vì những lý do sau:

- Đối với liên kết tượng trưng (symbolic link), mọi quyền hạn đều luôn được bật cho tất cả người dùng và không thể thay đổi. (Quyền của symbolic link hoàn toàn không có ý nghĩa trên Linux, như trình bày chi tiết ở Mục 18.2). Điều này đồng nghĩa với việc không thể dùng quyền để ngăn chặn người dùng bất kỳ gán user EA lên một symbolic link. Giải pháp xử lý là cấm toàn bộ người dùng tạo user EA trên symbolic link.
- Đối với file thiết bị (device file), socket và FIFO, các bit quyền hạn dùng để kiểm soát truy cập cho mục đích thực hiện thao tác I/O trên đối tượng phần cứng/luồng cơ sở. Việc can thiệp vào các quyền này để kiểm soát việc tạo user EA sẽ gây xung đột với mục đích ban đầu.

Hơn nữa, một tiến trình không có đặc quyền không thể gắn user EA lên một thư mục thuộc sở hữu của người dùng khác nếu thư mục đó có bật sticky bit (Mục 15.4.5). Quy tắc này ngăn người dùng tùy ý gắn các EA vào các thư mục như `/tmp` — nơi ai cũng có quyền ghi (và do đó có thể tùy tiện can thiệp EA trên thư mục), nhưng có sticky bit để ngăn chặn người này xóa file của người khác.

### Giới hạn triển khai

Linux VFS áp đặt các giới hạn sau đối với EA trên mọi hệ thống file:

- Độ dài của tên EA bị giới hạn tối đa 255 ký tự.
- Kích thước giá trị EA bị giới hạn tối đa 64 kB.

Ngoài ra, một số hệ thống file còn áp đặt thêm các giới hạn khắt khe hơn về kích thước và số lượng EA có thể gắn vào một file:

- Trên ext2, ext3 và ext4, tổng dung lượng byte của cả tên và giá trị của mọi EA trên một file bị giới hạn trong phạm vi kích thước của một khối đĩa logic (logical disk block - Mục 14.3): 1024, 2048 hoặc 4096 byte.
- Trên JFS, giới hạn trần cho tổng dung lượng byte của cả tên và giá trị của tất cả EA trên một file là 128 kB.

## 16.3 Các System Call thao tác với thuộc tính mở rộng

Phần này khảo sát các system call được dùng để tạo, truy xuất và xóa bỏ EA.

### Tạo và sửa đổi EA

Các system call `setxattr()`, `lsetxattr()` và `fsetxattr()` thiết lập giá trị cho một EA của file.

```c
## include <sys/xattr.h>

int setxattr(const char *pathname, const char *name, const void *value,
             size_t size, int flags);
int lsetxattr(const char *pathname, const char *name, const void *value,
              size_t size, int flags);
int fsetxattr(int fd, const char *name, const void *value,
              size_t size, int flags);

/* Tất cả trả về 0 khi thành công, hoặc -1 khi gặp lỗi */
```

Sự khác biệt giữa ba lời gọi này tương tự sự khác biệt giữa `stat()`, `lstat()` và `fstat()` (Mục 15.1):

- `setxattr()` định danh file thông qua đường dẫn `pathname`, và tự động giải tham chiếu (dereference) nếu đó là symbolic link;
- `lsetxattr()` định danh file thông qua đường dẫn `pathname`, nhưng không giải tham chiếu symbolic link;
- `fsetxattr()` định danh file thông qua file descriptor `fd` đang mở.

Nguyên lý phân biệt này cũng áp dụng tương tự cho các nhóm system call khác ở phần còn lại của chương.

Tham số `name` là một chuỗi kết thúc bằng ký tự null (null-terminated string) xác định tên của EA. Tham số `value` là con trỏ trỏ tới vùng đệm chứa dữ liệu giá trị mới cho EA. Tham số `size` chỉ định độ dài (tính bằng byte) của vùng đệm này.

Theo mặc định, các system call này sẽ tạo mới EA nếu tên chưa tồn tại, hoặc ghi đè giá trị nếu EA đã có sẵn. Tham số `flags` cho phép kiểm soát hành vi này chặt chẽ hơn. Có thể truyền `0` để chọn hành vi mặc định, hoặc chỉ định một trong các hằng số sau:

- `XATTR_CREATE`: Báo lỗi (`EEXIST`) nếu EA với tên chỉ định đã tồn tại.
- `XATTR_REPLACE`: Báo lỗi (`ENODATA`) nếu EA với tên chỉ định chưa từng tồn tại.

Dưới đây là ví dụ về việc sử dụng `setxattr()` để tạo một user EA:

```c
char *value;

value = "The past is not dead.";
if (setxattr(pathname, "user.x", value, strlen(value), 0) == -1)
    errExit("setxattr");
```

### Truy xuất giá trị của một EA

Các system call `getxattr()`, `lgetxattr()` và `fgetxattr()` dùng để lấy giá trị của một EA.

```c
## include <sys/xattr.h>

ssize_t getxattr(const char *pathname, const char *name, void *value,
                 size_t size);
ssize_t lgetxattr(const char *pathname, const char *name, void *value,
                  size_t size);
ssize_t fgetxattr(int fd, const char *name, void *value,
                  size_t size);

/* Tất cả trả về kích thước (không âm) của giá trị EA khi thành công, hoặc -1 khi gặp lỗi */
```

Tham số `name` là chuỗi null-terminated định danh EA cần truy xuất. Giá trị của EA được ghi vào vùng đệm do `value` trỏ tới. Vùng đệm này phải được cấp phát sẵn bởi tiến trình gọi, và dung lượng của nó được khai báo qua `size`. Khi thành công, các hàm này trả về số byte thực tế đã sao chép vào `value`.

Nếu file không có thuộc tính nào mang tên đã cho, system call thất bại với mã lỗi `ENODATA`. Nếu kích thước `size` quá nhỏ so với dữ liệu thực tế, system call báo lỗi `ERANGE`.

Ta có thể chỉ định `size` bằng 0; khi đó con trỏ `value` được bỏ qua nhưng system call vẫn trả về kích thước thực tế của giá trị EA. Kỹ thuật này cung cấp cơ chế thăm dò để xác định chính xác dung lượng bộ đệm cần cấp phát trước khi thực hiện lời gọi thứ hai để lấy dữ liệu. Tuy nhiên, lưu ý rằng không có gì đảm bảo kích thước vừa lấy được vẫn sẽ đủ lớn trong lần gọi tiếp theo: một tiến trình khác có thể đã cập nhật giá trị lớn hơn hoặc xóa bỏ luôn thuộc tính đó ngay giữa hai lần gọi.

### Xóa một EA

Các system call `removexattr()`, `lremovexattr()` và `fremovexattr()` dùng để loại bỏ một EA khỏi file.

```c
## include <sys/xattr.h>

int removexattr(const char *pathname, const char *name);
int lremovexattr(const char *pathname, const char *name);
int fremovexattr(int fd, const char *name);

/* Tất cả trả về 0 khi thành công, hoặc -1 khi gặp lỗi */
```

Chuỗi null-terminated truyền vào `name` chỉ định EA cần xóa. Thao tác xóa một EA không tồn tại sẽ thất bại với mã lỗi `ENODATA`.

### Truy xuất danh sách tên của tất cả các EA gắn trên file

Các system call `listxattr()`, `llistxattr()` và `flistxattr()` trả về danh sách chứa tên của toàn bộ các EA liên kết với một file.

```c
## include <sys/xattr.h>

ssize_t listxattr(const char *pathname, char *list, size_t size);
ssize_t llistxattr(const char *pathname, char *list, size_t size);
ssize_t flistxattr(int fd, char *list, size_t size);

/* Tất cả trả về số byte đã sao chép vào list khi thành công, hoặc -1 khi gặp lỗi */
```

Danh sách tên EA được trả về dưới dạng một chuỗi gồm nhiều chuỗi con kết thúc bằng ký tự null liên tiếp nhau trong vùng đệm do `list` trỏ tới. Kích thước vùng đệm này phải được khai báo qua `size`. Khi thành công, system call trả về tổng số byte đã ghi vào `list`.

Tương tự `getxattr()`, ta có thể truyền `size` bằng 0; khi đó `list` bị bỏ qua và hàm sẽ trả về kích thước vùng đệm cần thiết để chứa toàn bộ danh sách tên EA (với giả định danh sách không đổi).

Để lấy được danh sách tên EA của một file, hệ thống chỉ yêu cầu file đó ở trạng thái truy cập được (tức là tiến trình có quyền thực thi `x` trên tất cả các thư mục nằm trong `pathname`). Không đòi hỏi bất kỳ quyền hạn nào trên chính bản thân file đó.

Vì lý do bảo mật, danh sách tên trả về trong `list` có thể loại bỏ bớt các thuộc tính mà tiến trình gọi không có quyền truy cập. Ví dụ, hầu hết các hệ thống file đều chủ động ẩn các thuộc tính `trusted` khỏi danh sách trả về của `listxattr()` nếu tiến trình gọi không có đặc quyền. Tuy nhiên, lưu ý chữ "có thể" (*may*): bản triển khai hệ thống file không bắt buộc phải làm điều này. Do đó, mã nguồn luôn cần lường trước khả năng lời gọi `getxattr()` tiếp theo (sử dụng tên lấy từ `list`) có thể thất bại do tiến trình thiếu quyền đọc giá trị thuộc tính đó. (Tình huống lỗi tương tự cũng xảy ra nếu một tiến trình khác đã xóa thuộc tính đó giữa hai lần gọi `listxattr()` và `getxattr()`.)

### Chương trình ví dụ

Chương trình trong [Listing 16-1](#page-6-0) thực hiện truy xuất và hiển thị tên cùng giá trị của toàn bộ các EA trên các file được chỉ định từ dòng lệnh. Với mỗi file, chương trình dùng `listxattr()` để lấy danh sách tên, sau đó lặp qua từng tên và gọi `getxattr()` để đọc giá trị tương ứng. Mặc định, giá trị thuộc tính được in ra dưới dạng văn bản thô (plain text). Nếu truyền cờ `-x`, giá trị sẽ được hiển thị dưới dạng chuỗi hexa (hexadecimal). Đoạn log shell sau đây minh họa quá trình thực thi:

```bash
$ setfattr -n user.x -v "The past is not dead." tfile
$ setfattr -n user.y -v "In fact, it's not even past." tfile
$ ./xattr_view tfile
tfile:
 name=user.x; value=The past is not dead.
 name=user.y; value=In fact, it's not even past.
```

**Listing 16-1:** Hiển thị các thuộc tính mở rộng của file

```c
/*–––––––––––––––––––––––––––––––––––––––––––––––––––––––– xattr/xattr_view.c */
## include <sys/xattr.h>
## include "tlpi_hdr.h"

## define XATTR_SIZE 10000

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

    for (j = optind; j < argc; j++) {
        listLen = listxattr(argv[j], list, XATTR_SIZE);
        if (listLen == -1)
            errExit("listxattr");

        printf("%s:\n", argv[j]);

        /* Lặp qua tất cả các tên EA, hiển thị name + value */
        for (ns = 0; ns < listLen; ns += strlen(&list[ns]) + 1) {
            printf("        name=%s; ", &list[ns]);

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
/*–––––––––––––––––––––––––––––––––––––––––––––––––––––––– xattr/xattr_view.c */
```

## 16.4 Tổng kết

Kể từ phiên bản 2.6, Linux hỗ trợ các thuộc tính mở rộng (extended attributes - EA), cho phép gắn siêu dữ liệu tùy ý vào file dưới dạng các cặp tên-giá trị.

## 16.5 Bài tập

**16-1.** Viết chương trình dùng để tạo hoặc chỉnh sửa một user EA cho file (tương tự phiên bản rút gọn của lệnh `setfattr(1)`). Tên file, tên EA và giá trị EA sẽ được truyền vào từ các đối số dòng lệnh của chương trình.
