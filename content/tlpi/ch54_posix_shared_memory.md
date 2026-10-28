# Chương 54: Bộ nhớ chia sẻ POSIX (POSIX Shared Memory)

Trong các chương trước, chúng ta đã xem xét hai kỹ thuật cho phép các tiến trình không có quan hệ cha-con (unrelated processes) chia sẻ các vùng bộ nhớ nhằm thực hiện giao tiếp liên tiến trình (IPC): System V shared memory (Chương 48) và ánh xạ tệp chia sẻ (shared file mappings - Mục 49.4.2). Cả hai kỹ thuật này đều tồn tại những nhược điểm tiềm ẩn:

- Mô hình System V shared memory, vốn sử dụng các khóa (key) và định danh (identifier), không nhất quán với mô hình I/O tiêu chuẩn của UNIX (vốn sử dụng tên tệp và bộ mô tả tệp - file descriptor). Sự khác biệt này đòi hỏi chúng ta phải có một tập hợp các system call và câu lệnh hoàn toàn mới để làm việc với các phân đoạn System V shared memory.
- Việc sử dụng ánh xạ tệp chia sẻ (shared file mapping) cho IPC đòi hỏi phải tạo một tệp trên đĩa, ngay cả khi chúng ta không có nhu cầu duy trì một kho lưu trữ nền bền vững (persistent backing store) cho vùng nhớ chia sẻ. Bên cạnh sự bất tiện khi phải tạo tệp, kỹ thuật này còn phát sinh chi phí phụ trội (overhead) cho các thao tác I/O tệp.

Chính vì những hạn chế này, tiêu chuẩn POSIX.1b đã định nghĩa một API chia sẻ bộ nhớ mới: **POSIX shared memory**, đây cũng là chủ đề chính của chương này.

> [!NOTE]
> POSIX sử dụng thuật ngữ *đối tượng bộ nhớ chia sẻ* (shared memory objects), trong khi System V gọi là *các phân đoạn bộ nhớ chia sẻ* (shared memory segments). Sự khác biệt về thuật ngữ này mang tính lịch sử—cả hai đều được dùng để chỉ các vùng bộ nhớ được chia sẻ giữa các tiến trình.

## 54.1 Tổng quan

POSIX shared memory cho phép chúng ta chia sẻ một vùng bộ nhớ được ánh xạ (mapped region) giữa các tiến trình không có quan hệ cha-con mà không cần phải tạo một tệp ánh xạ tương ứng trên đĩa. POSIX shared memory được hỗ trợ trên Linux từ kernel 2.4.

Tiêu chuẩn SUSv3 không quy định chi tiết về cách thức triển khai POSIX shared memory. Cụ thể, không có yêu cầu bắt buộc phải sử dụng một hệ thống tệp (thực hoặc ảo) để định danh các đối tượng bộ nhớ chia sẻ, mặc dù nhiều bản phân phối UNIX áp dụng phương pháp này. Một số hệ thống UNIX tạo tên cho các đối tượng bộ nhớ chia sẻ dưới dạng các tệp tại một vị trí đặc biệt trong hệ thống tệp tiêu chuẩn. Linux sử dụng một hệ thống tệp `tmpfs` chuyên dụng (Mục 14.10) được mount tại thư mục `/dev/shm`. Hệ thống tệp này có *tính bền vững cấp nhân* (kernel persistence)—các đối tượng bộ nhớ chia sẻ chứa trong đó vẫn tồn tại ngay cả khi không có tiến trình nào đang mở chúng, nhưng sẽ bị mất khi hệ thống tắt nguồn (shutdown).

> [!NOTE]
> Tổng dung lượng bộ nhớ dành cho tất cả các vùng POSIX shared memory trên hệ thống bị giới hạn bởi kích thước của hệ thống tệp `tmpfs` bên dưới. Hệ thống tệp này thường được mount lúc khởi động với một dung lượng mặc định (ví dụ: 256 MB). Nếu cần, người dùng quản trị (superuser) có thể thay đổi kích thước của hệ thống tệp bằng cách mount lại (remount) thông qua lệnh: `mount -o remount,size=<num-bytes>`.

Để sử dụng một đối tượng POSIX shared memory, chúng ta thực hiện hai bước:

1. Sử dụng hàm `shm_open()` để mở một đối tượng với tên được chỉ định. (Các quy tắc đặt tên cho đối tượng POSIX shared memory được mô tả trong Mục 51.1). Hàm `shm_open()` tương tự như system call `open()`. Nó có thể tạo một đối tượng bộ nhớ chia sẻ mới hoặc mở một đối tượng đã tồn tại. Kết quả trả về của `shm_open()` là một file descriptor tham chiếu đến đối tượng đó.
2. Truyền file descriptor nhận được từ bước trên vào hàm `mmap()` với cờ `MAP_SHARED` trong đối số `flags`. Thao tác này sẽ ánh xạ đối tượng bộ nhớ chia sẻ vào không gian địa chỉ ảo (virtual address space) của tiến trình. Tương tự như các trường hợp sử dụng `mmap()` khác, sau khi đã ánh xạ đối tượng, chúng ta có thể đóng file descriptor mà không làm ảnh hưởng đến vùng ánh xạ. Tuy nhiên, chúng ta có thể giữ file descriptor mở nếu cần sử dụng cho các lời gọi `fstat()` hoặc `ftruncate()` tiếp theo (xem Mục 54.2).

Mối quan hệ giữa `shm_open()` và `mmap()` trong POSIX shared memory tương tự như mối quan hệ giữa `shmget()` và `shmat()` trong System V shared memory. Nguồn gốc của quy trình hai bước (`shm_open()` kết hợp `mmap()`) thay vì dùng một hàm duy nhất thực hiện cả hai tác vụ mang tính lịch sử: khi ủy ban POSIX bổ sung tính năng này, lời gọi `mmap()` đã tồn tại từ trước ([Stevens, 1999]). Thực chất, chúng ta chỉ đang thay thế lời gọi `open()` bằng `shm_open()`, với điểm khác biệt là `shm_open()` không yêu cầu tạo tệp thực sự trên hệ thống tệp lưu trữ đĩa (disk-based file system).

Do đối tượng bộ nhớ chia sẻ được tham chiếu thông qua một file descriptor, chúng ta có thể tái sử dụng các system call thao tác trên file descriptor đã có sẵn trong hệ thống UNIX (ví dụ: `ftruncate()`), thay vì phải bổ sung các system call chuyên dụng mới (như cách làm của System V shared memory).

## 54.2 Tạo các đối tượng bộ nhớ chia sẻ

Hàm `shm_open()` tạo và mở một đối tượng bộ nhớ chia sẻ mới hoặc mở một đối tượng đã có sẵn. Các đối số của `shm_open()` tương tự như của `open()`.

```c
## include <fcntl.h>    /* Định nghĩa các hằng số O_* */
## include <sys/stat.h> /* Định nghĩa các hằng số mode */
## include <sys/mman.h>

int shm_open(const char *name, int oflag, mode_t mode);
// Trả về file descriptor khi thành công, hoặc -1 khi gặp lỗi
```

Đối số `name` định danh đối tượng bộ nhớ chia sẻ cần tạo hoặc mở. Đối số `oflag` là một mặt nạ bit (bit mask) điều chỉnh hành vi của lời gọi hàm. Các giá trị có thể kết hợp trong mặt nạ này được tóm tắt trong Bảng 54-1.

**Bảng 54-1:** Các giá trị bit cho đối số `oflag` của hàm `shm_open()`

| Cờ (Flag) | Mô tả |
| :--- | :--- |
| `O_CREAT` | Tạo đối tượng nếu nó chưa tồn tại |
| `O_EXCL` | Dùng kết hợp với `O_CREAT` để tạo độc quyền (báo lỗi nếu đối tượng đã tồn tại) |
| `O_RDONLY` | Mở đối tượng chỉ để đọc |
| `O_RDWR` | Mở đối tượng để đọc và ghi |
| `O_TRUNC` | Cắt ngắn (truncate) độ dài đối tượng về 0 |

Một mục đích của đối số `oflag` là xác định xem chúng ta đang mở một đối tượng đã tồn tại hay tạo mới. Nếu `oflag` không chứa `O_CREAT`, hàm sẽ mở đối tượng hiện có. Nếu chỉ định `O_CREAT`, đối tượng sẽ được tạo nếu chưa tồn tại. Việc kết hợp `O_EXCL` cùng `O_CREAT` nhằm đảm bảo tiến trình gọi chính là bên tạo ra đối tượng; nếu đối tượng đã tồn tại từ trước, hàm sẽ trả về lỗi (`EEXIST`).

Đối số `oflag` cũng quy định quyền truy cập của tiến trình gọi tới đối tượng bằng cách chỉ định chính xác một trong hai giá trị: `O_RDONLY` hoặc `O_RDWR`.

Cờ còn lại, `O_TRUNC`, khi được sử dụng sẽ làm cho một thao tác mở thành công đối tượng hiện có tự động cắt ngắn độ dài của đối tượng đó về 0 byte.

> [!NOTE]
> Trên Linux, việc cắt ngắn độ dài vẫn diễn ra ngay cả khi mở với cờ chỉ đọc (`O_RDONLY`). Tuy nhiên, SUSv3 quy định rằng kết quả của việc dùng `O_TRUNC` với `O_RDONLY` là không xác định (undefined), do đó không nên dựa vào hành vi này để đảm bảo tính di động (portability) của mã nguồn.

Khi một đối tượng bộ nhớ chia sẻ mới được tạo, UID và GID sở hữu của nó được lấy từ ID người dùng hiệu dụng (effective user ID) và ID nhóm hiệu dụng của tiến trình gọi `shm_open()`. Quyền truy cập của đối tượng được thiết lập theo mặt nạ bit truyền vào đối số `mode`. Các giá trị bit của `mode` tương tự như đối với tệp tin (Bảng 15-4). Giống như system call `open()`, mặt nạ quyền hạn trong `mode` sẽ được lọc qua `umask` của tiến trình (Mục 15.4.6). Khác với `open()`, đối số `mode` trong `shm_open()` luôn bắt buộc phải truyền vào; nếu không phải tạo mới đối tượng, giá trị này nên được đặt là `0`.

Cờ close-on-exec (`FD_CLOEXEC`, Mục 27.4) sẽ tự động được thiết lập trên file descriptor do `shm_open()` trả về, giúp file descriptor này tự động đóng lại khi tiến trình thực thi lời gọi `exec()`. (Điều này phù hợp với thực tế là các vùng ánh xạ bộ nhớ cũng sẽ bị hủy ánh xạ - unmapped - khi tiến trình thực hiện `exec()`).

Khi một đối tượng bộ nhớ chia sẻ mới được tạo, ban đầu nó có độ dài bằng 0. Do đó, sau khi tạo đối tượng, chúng ta thường phải gọi `ftruncate()` (Mục 5.8) để thiết lập kích thước cho đối tượng trước khi gọi `mmap()`. Sau khi đã ánh xạ bằng `mmap()`, chúng ta vẫn có thể dùng `ftruncate()` để mở rộng hoặc thu nhỏ đối tượng bộ nhớ chia sẻ tùy ý (cần lưu ý các điểm đã thảo luận ở Mục 49.4.3).

Khi một đối tượng bộ nhớ chia sẻ được mở rộng, các byte mới thêm vào sẽ tự động được khởi tạo bằng giá trị `0`.

Tại bất kỳ thời điểm nào, chúng ta có thể gọi `fstat()` (Mục 15.1) trên file descriptor do `shm_open()` trả về để lấy cấu trúc `stat` chứa thông tin về đối tượng, bao gồm kích thước (`st_size`), quyền hạn (`st_mode`), UID chủ sở hữu (`st_uid`), và GID nhóm (`st_gid`). (Đây là các trường duy nhất mà SUSv3 bắt buộc `fstat()` phải cập nhật đối với shared memory object, dù Linux vẫn trả về thông tin thời gian có ý nghĩa và một số thông tin khác).

Quyền hạn và quyền sở hữu của một đối tượng bộ nhớ chia sẻ có thể được thay đổi tương ứng bằng cách sử dụng `fchmod()` và `fchown()`.

### Chương trình ví dụ

Listing 54-1 minh họa cách sử dụng đơn giản các hàm `shm_open()`, `ftruncate()`, và `mmap()`. Chương trình này tạo một đối tượng bộ nhớ chia sẻ với kích thước nhận từ tham số dòng lệnh, sau đó ánh xạ đối tượng đó vào không gian địa chỉ ảo của tiến trình. (Bước ánh xạ ở đây mang tính chất minh họa cách dùng `mmap()`, vì chương trình không thực sự đọc/ghi dữ liệu vào vùng nhớ). Chương trình cho phép dùng các tùy chọn dòng lệnh để bật các cờ (`O_CREAT` và `O_EXCL`) cho lời gọi `shm_open()`.

Trong ví dụ dưới đây, chúng ta dùng chương trình này để tạo một đối tượng bộ nhớ chia sẻ có kích thước 10,000 byte, sau đó dùng lệnh `ls` để kiểm tra đối tượng trong `/dev/shm`:

```bash
$ ./pshm_create -c /demo_shm 10000
$ ls -l /dev/shm
total 0
-rw------- 1 mtk users 10000 Jun 20 11:31 demo_shm
```

**Listing 54-1:** Tạo đối tượng POSIX shared memory

```c
Wait, line below should not be executable
```

```c
/* pshm/pshm_create.c */

## include <sys/stat.h>
## include <fcntl.h>
## include <sys/mman.h>
## include "tlpi_hdr.h"

static void
usageError(const char *progName)
{
    fprintf(stderr, "Usage: %s [-cx] name size [octal-perms]\n", progName);
    fprintf(stderr, "  -c Create shared memory (O_CREAT)\n");
    fprintf(stderr, "  -x Create exclusively (O_EXCL)\n");
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

    /* Tạo đối tượng bộ nhớ chia sẻ và thiết lập kích thước */
    fd = shm_open(argv[optind], flags, perms);
    if (fd == -1)
        errExit("shm_open");

    if (ftruncate(fd, size) == -1)
        errExit("ftruncate");

    /* Ánh xạ đối tượng bộ nhớ chia sẻ vào không gian địa chỉ */
    addr = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (addr == MAP_FAILED)
        errExit("mmap");

    exit(EXIT_SUCCESS);
}
```

## 54.3 Sử dụng các đối tượng bộ nhớ chia sẻ

Listing 54-2 và Listing 54-3 minh họa việc sử dụng đối tượng bộ nhớ chia sẻ để truyền dữ liệu giữa hai tiến trình. Chương trình trong Listing 54-2 sao chép chuỗi ký tự ở đối số dòng lệnh thứ hai vào đối tượng bộ nhớ chia sẻ đã tồn tại (được đặt tên ở đối số thứ nhất). Trước khi ánh xạ đối tượng và sao chép dữ liệu, chương trình gọi `ftruncate()` để điều chỉnh kích thước bộ nhớ chia sẻ bằng đúng độ dài chuỗi ký tự.

**Listing 54-2:** Ghi dữ liệu vào đối tượng POSIX shared memory

```c
/* pshm/pshm_write.c */

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

    fd = shm_open(argv[1], O_RDWR, 0); /* Mở đối tượng hiện có */
    if (fd == -1)
        errExit("shm_open");

    len = strlen(argv[2]);
    if (ftruncate(fd, len) == -1) /* Thay đổi kích thước để chứa chuỗi */
        errExit("ftruncate");
    printf("Resized to %ld bytes\n", (long) len);

    addr = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (addr == MAP_FAILED)
        errExit("mmap");

    if (close(fd) == -1)
        errExit("close"); /* 'fd' không còn cần thiết sau khi đã mmap */

    printf("copying %ld bytes\n", (long) len);
    memcpy(addr, argv[2], len); /* Sao chép chuỗi vào bộ nhớ chia sẻ */

    exit(EXIT_SUCCESS);
}
```

Chương trình trong Listing 54-3 đọc và in chuỗi ký tự từ đối tượng bộ nhớ chia sẻ ra đầu ra tiêu chuẩn (stdout). Sau khi gọi `shm_open()`, chương trình dùng `fstat()` để lấy kích thước đối tượng và truyền kích thước đó vào lời gọi `mmap()` cũng như lời gọi `write()` hiển thị dữ liệu.

```c
/* pshm/pshm_read.c */

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

    fd = shm_open(argv[1], O_RDONLY, 0); /* Mở đối tượng hiện có */
    if (fd == -1)
        errExit("shm_open");

    /* Lấy kích thước đối tượng để dùng cho mmap() và write() */
    if (fstat(fd, &sb) == -1)
        errExit("fstat");

    addr = mmap(NULL, sb.st_size, PROT_READ, MAP_SHARED, fd, 0);
    if (addr == MAP_FAILED)
        errExit("mmap");

    if (close(fd) == -1)
        errExit("close"); /* 'fd' không còn cần thiết */

    write(STDOUT_FILENO, addr, sb.st_size);
    printf("\n");

    exit(EXIT_SUCCESS);
}
```

Kịch bản chạy thử nghiệm dưới đây trình bày cách kết hợp các chương trình trên. Đầu tiên, chúng ta tạo một đối tượng bộ nhớ chia sẻ có độ dài 0 bằng chương trình trong Listing 54-1:

```bash
$ ./pshm_create -c /demo_shm 0
$ ls -l /dev/shm
total 4
-rw------- 1 mtk users 0 Jun 21 13:33 demo_shm
```

Tiếp theo, ta dùng chương trình trong Listing 54-2 để ghi một chuỗi ký tự vào đối tượng:

```bash
$ ./pshm_write /demo_shm 'hello'
$ ls -l /dev/shm
total 4
-rw------- 1 mtk users 5 Jun 21 13:33 demo_shm
```

Kết quả cho thấy kích thước của đối tượng bộ nhớ chia sẻ đã được mở rộng thành 5 bytes để chứa đủ chuỗi ký tự.

Cuối cùng, ta dùng chương trình trong Listing 54-3 để đọc dữ liệu từ vùng nhớ chia sẻ:

```bash
$ ./pshm_read /demo_shm
hello
```

Trong thực tế, các ứng dụng bắt buộc phải áp dụng cơ chế đồng bộ hóa để điều phối quyền truy cập của các tiến trình vào bộ nhớ chia sẻ. Trong ví dụ chạy lệnh ở trên, việc điều phối đơn giản là do người dùng chủ động chạy lần lượt từng lệnh. Trong ứng dụng thực tế, người ta sẽ sử dụng các nguyên hàm đồng bộ hóa (synchronization primitives - ví dụ: semaphore) để quản lý truy cập.

## 54.4 Xóa các đối tượng bộ nhớ chia sẻ

Tiêu chuẩn SUSv3 quy định rằng các đối tượng POSIX shared memory phải có ít nhất *tính bền vững cấp nhân* (kernel persistence); tức là chúng tiếp tục tồn tại cho đến khi bị xóa một cách tường minh hoặc khi hệ thống được khởi động lại. Khi một đối tượng bộ nhớ chia sẻ không còn dùng tới, nó cần được giải phóng bằng hàm `shm_unlink()`.

```c
## include <sys/mman.h>

int shm_unlink(const char *name);
// Trả về 0 khi thành công, hoặc -1 khi gặp lỗi
```

Hàm `shm_unlink()` xóa đối tượng bộ nhớ chia sẻ có tên được truyền trong tham số `name`. Thao tác xóa không làm ảnh hưởng đến các ánh xạ (mappings) đang tồn tại (các ánh xạ này vẫn hiệu lực cho đến khi các tiến trình liên quan gọi `munmap()` hoặc kết thúc), nhưng nó sẽ ngăn chặn các lời gọi `shm_open()` tiếp theo mở đối tượng này. Khi tất cả các tiến trình đã hủy ánh xạ, đối tượng sẽ hoàn toàn bị loại bỏ và nội dung của nó sẽ mất đi.

Chương trình trong Listing 54-4 sử dụng `shm_unlink()` để xóa đối tượng bộ nhớ chia sẻ được truyền vào từ tham số dòng lệnh.

**Listing 54-4:** Sử dụng `shm_unlink()` để hủy liên kết đối tượng POSIX shared memory

```c
/* pshm/pshm_unlink.c */

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
```

## 54.5 So sánh giữa các API chia sẻ bộ nhớ

Cho đến nay, chúng ta đã nghiên cứu các kỹ thuật khác nhau để chia sẻ các vùng bộ nhớ giữa các tiến trình không có quan hệ cha-con:

- System V shared memory (Chương 48);
- Ánh xạ tệp chia sẻ (shared file mappings - Mục 49.4.2); và
- Đối tượng POSIX shared memory (chủ đề của chương này).

Rất nhiều phân tích trong phần này cũng đúng cho ánh xạ ẩn danh chia sẻ (shared anonymous mappings - Mục 49.7), vốn dùng để chia sẻ bộ nhớ giữa các tiến trình có quan hệ cha-con được tạo qua `fork()`.

### Các điểm chung của tất cả các kỹ thuật:

- Đều cung cấp cơ chế IPC tốc độ cao. Các ứng dụng thường phải dùng semaphore (hoặc các nguyên hàm đồng bộ hóa khác) để điều phối truy cập.
- Khi vùng bộ nhớ chia sẻ đã được ánh xạ vào không gian địa chỉ ảo của tiến trình, nó thao tác hoàn toàn giống như bất kỳ vùng nhớ thông thường nào khác của tiến trình.
- Kernel sắp xếp vị trí các vùng bộ nhớ chia sẻ trong không gian địa chỉ ảo tương tự như nhau (đã mô tả ở Mục 48.5). Tệp `/proc/PID/maps` trên Linux hiển thị chi tiết thông tin về tất cả các loại vùng bộ nhớ chia sẻ này.
- Trừ khi chúng ta cố tình ánh xạ vùng bộ nhớ tại một địa chỉ cố định, chúng ta phải đảm bảo mọi tham chiếu đến các vị trí trong vùng nhớ chia sẻ đều được tính toán theo địa chỉ tương đối (offset) thay vì dùng con trỏ (pointer) tuyệt đối, bởi vì vùng bộ nhớ có thể nằm ở các địa chỉ ảo khác nhau trong các tiến trình khác nhau (Mục 48.6).
- Các hàm thao tác trên vùng bộ nhớ ảo ở Chương 50 đều có thể áp dụng cho các vùng bộ nhớ chia sẻ được tạo bởi bất kỳ kỹ thuật nào ở trên.

### Các điểm khác biệt quan trọng:

- Dữ liệu trong ánh xạ tệp chia sẻ (shared file mapping) được đồng bộ hóa xuống tệp lưu trữ bên dưới, nghĩa là dữ liệu có thể tồn tại qua các lần khởi động lại hệ thống (persistent across system restarts).
- System V và POSIX shared memory sử dụng các cơ chế khác nhau để định danh đối tượng. System V dùng cơ chế khóa (key) và định danh (identifier) riêng biệt, không tương thích với mô hình I/O UNIX tiêu chuẩn và đòi hỏi các system call (`shmctl()`) cũng như các lệnh quản trị riêng (`ipcs`, `ipcrm`). Ngược lại, POSIX shared memory dùng tên gọi và file descriptor, giúp nó có thể dễ dàng kiểm tra và thao tác bằng các system call UNIX tiêu chuẩn (như `fstat()`, `fchmod()`).
- Kích thước của phân đoạn System V shared memory bị cố định ngay tại thời điểm tạo (qua `shmget()`). Trong khi đó, đối với ánh xạ tệp hoặc POSIX shared memory, chúng ta có thể linh hoạt dùng `ftruncate()` để điều chỉnh kích thước của đối tượng bên dưới, sau đó cập nhật lại ánh xạ bằng `munmap()`/`mmap()` (hoặc hàm `mremap()` riêng của Linux).

Về mặt lịch sử, System V shared memory có độ phủ phổ biến cao hơn so với `mmap()` và POSIX shared memory, dù ngày nay hầu hết các hệ điều hành UNIX hiện đại đều hỗ trợ đầy đủ cả ba kỹ thuật này.

Ngoại trừ yếu tố tính di động lịch sử ở trên, tất cả các ưu điểm còn lại đều nghiêng về phía ánh xạ tệp chia sẻ và POSIX shared memory. Do đó, đối với các ứng dụng mới, hai giao diện này luôn là sự lựa chọn ưu tiên so với System V shared memory. Lựa chọn cụ thể giữa hai giao diện sẽ phụ thuộc vào việc ứng dụng có cần kho lưu trữ nền bền vững trên đĩa hay không: Ánh xạ tệp chia sẻ cung cấp khả năng lưu trữ bền vững; trong khi POSIX shared memory giúp triệt tiêu hoàn toàn chi phí I/O đĩa khi không yêu cầu lưu trữ dữ liệu lâu dài.

## 5
