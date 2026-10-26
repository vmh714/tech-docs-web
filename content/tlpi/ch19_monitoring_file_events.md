# Chương 19: GIÁM SÁT SỰ KIỆN TỆP

Một số ứng dụng cần có khả năng giám sát các tệp (file) hoặc thư mục (directory) nhằm xác định xem các sự kiện có xảy ra đối với các đối tượng được giám sát hay không. Ví dụ, một trình quản lý tệp giao diện đồ họa (graphical file manager) cần có khả năng xác định khi nào tệp được thêm vào hoặc xóa khỏi thư mục đang được hiển thị, hoặc một tiến trình nền (daemon) có thể muốn giám sát tệp cấu hình của nó để biết liệu tệp đó đã bị thay đổi hay chưa.

Bắt đầu từ phiên bản kernel 2.6.13, Linux cung cấp cơ chế `inotify`, cho phép một ứng dụng giám sát các sự kiện tệp. Chương này mô tả cách sử dụng `inotify`.

Cơ chế `inotify` thay thế cho một cơ chế cũ hơn là `dnotify`, vốn chỉ cung cấp một tập con các chức năng của `inotify`. Chúng ta sẽ thảo luận ngắn gọn về `dnotify` ở phần cuối của chương này, tập trung vào lý do tại sao `inotify` lại ưu việt hơn.

Cơ chế `inotify` và `dnotify` là đặc trưng của Linux (Linux-specific). (Một số hệ thống khác cung cấp các cơ chế tương tự. Ví dụ, các hệ thống BSD cung cấp API `kqueue`).

> Một số thư viện cung cấp một API có tính trừu tượng và khả năng khả chuyển (portable) cao hơn so với `inotify` và `dnotify`. Việc sử dụng các thư viện này có thể được ưu tiên hơn đối với một số ứng dụng. Một số thư viện trong số đó sử dụng `inotify` hoặc `dnotify` trên các hệ thống hỗ trợ chúng. Hai thư viện như vậy là FAM (File Alteration Monitor, http://oss.sgi.com/projects/fam/) và Gamin (http://www.gnome.org/~veillard/gamin/).

## 19.1 Tổng quan

Các bước chính trong việc sử dụng `inotify` API như sau:

- 1. Ứng dụng sử dụng `inotify_init()` để tạo một thể hiện `inotify` (inotify instance). System call này trả về một file descriptor được dùng để tham chiếu đến thể hiện `inotify` trong các thao tác sau đó.
- 2. Ứng dụng thông báo cho kernel biết những tệp nào cần quan tâm bằng cách sử dụng `inotify_add_watch()` để thêm các mục vào danh sách giám sát (watch list) của thể hiện `inotify` đã được tạo ở bước trước. Mỗi mục giám sát (watch item) bao gồm một đường dẫn (pathname) và một mặt nạ bit (bit mask) đi kèm. Mặt nạ bit chỉ định tập hợp các sự kiện cần giám sát cho đường dẫn đó. Kết quả trả về của hàm `inotify_add_watch()` là một bộ mô tả giám sát (watch descriptor), được sử dụng để tham chiếu đến mục giám sát trong các thao tác sau. (System call `inotify_rm_watch()` thực hiện công việc ngược lại, loại bỏ một mục giám sát đã được thêm vào thể hiện `inotify` trước đó).
- 3. Để nhận các thông báo sự kiện, ứng dụng thực hiện các thao tác `read()` trên file descriptor của `inotify`. Mỗi lần `read()` thành công sẽ trả về một hoặc nhiều cấu trúc `inotify_event`, mỗi cấu trúc chứa thông tin về một sự kiện đã xảy ra trên một trong các đường dẫn đang được giám sát thông qua thể hiện `inotify` này.
- 4. Khi ứng dụng đã hoàn tất việc giám sát, nó sẽ đóng file descriptor của `inotify`. Thao tác này sẽ tự động xóa tất cả các mục giám sát liên quan đến thể hiện `inotify` đó.

Cơ chế `inotify` có thể được sử dụng để giám sát các tệp hoặc thư mục. Khi giám sát một thư mục, ứng dụng sẽ được thông báo về các sự kiện xảy ra đối với chính thư mục đó và đối với các tệp bên trong thư mục.

Cơ chế giám sát của `inotify` không mang tính đệ quy (recursive). Nếu một ứng dụng muốn giám sát các sự kiện trong toàn bộ một cây thư mục (directory subtree), ứng dụng đó phải gọi `inotify_add_watch()` cho từng thư mục có trong cây.

Một file descriptor của `inotify` có thể được giám sát bằng cách sử dụng `select()`, `poll()`, `epoll`, và kể từ Linux 2.6.25, là I/O hướng sự kiện tín hiệu (signal-driven I/O). Nếu có các sự kiện sẵn sàng để đọc, các giao diện này sẽ chỉ ra rằng file descriptor của `inotify` có thể đọc được (readable). Xem Chương 63 để biết thêm chi tiết về các giao diện này.

> Cơ chế `inotify` là một thành phần tùy chọn của Linux kernel được cấu hình thông qua các tùy chọn `CONFIG_INOTIFY` và `CONFIG_INOTIFY_USER`.

## 19.2 Giao diện inotify (the inotify API)

System call `inotify_init()` tạo ra một thể hiện (instance) inotify mới.

```c
## include <sys/inotify.h>
int inotify_init(void);
                                Trả về file descriptor khi thành công, hoặc –1 khi lỗi
```

Là kết quả hàm của nó, `inotify_init()` trả về một file descriptor. File descriptor này là định danh (handle) được sử dụng để tham chiếu đến thể hiện inotify (inotify instance) trong các thao tác tiếp theo.

Bắt đầu từ phiên bản kernel 2.6.27, Linux hỗ trợ một system call mới không chuẩn (nonstandard), `inotify_init1()`. System call này thực hiện tác vụ giống như `inotify_init()`, nhưng cung cấp thêm một tham số `flags`, có thể được sử dụng để sửa đổi hành vi của system call. Hai cờ (flag) được hỗ trợ. Cờ `IN_CLOEXEC` khiến kernel bật cờ close-on-exec (`FD_CLOEXEC`) cho file descriptor mới. Cờ này hữu ích vì những lý do tương tự như cờ `O_CLOEXEC` của hàm `open()` được mô tả trong Mục 4.3.1. Cờ `IN_NONBLOCK` khiến kernel bật cờ `O_NONBLOCK` trên open file description cơ sở, nhờ đó các thao tác đọc (read) trong tương lai sẽ là không chặn (nonblocking). Điều này giúp tiết kiệm các lời gọi `fcntl()` bổ sung để đạt được cùng một kết quả.

System call `inotify_add_watch()` hoặc thêm một mục theo dõi (watch item) mới, hoặc sửa đổi một mục theo dõi hiện có trong danh sách theo dõi (watch list) cho thể hiện inotify được tham chiếu bởi file descriptor `fd`. (Tham khảo [Hình 19-1.](#page-2-0))

```c
## include <sys/inotify.h>
int inotify_add_watch(int fd, const char *pathname, uint32_t mask);
                            Trả về watch descriptor khi thành công, hoặc –1 khi lỗi
```

```
                 inotify instance
                        |
        +---------------+---------------+
        |               |               |
   watch descriptor 1  watch descriptor 2  watch descriptor 3
        |               |               |
        v               v               v
     +--------+      +--------+      +--------+
     |  path  |      |  path  |      |  path  |
     |  mask  |      |  mask  |      |  mask  |
     +--------+      +--------+      +--------+
        ^               ^               ^
        +---------------+---------------+
                    watch items
```

**Hình 19-1:** Một thể hiện inotify (inotify instance) và các cấu trúc dữ liệu kernel liên quan

Tham số `pathname` xác định tệp mà một mục theo dõi (watch item) sẽ được tạo hoặc sửa đổi. Tiến trình gọi (caller) phải có quyền đọc (read permission) đối với tệp này. (Việc kiểm tra quyền tệp được thực hiện một lần, tại thời điểm gọi `inotify_add_watch()`. Miễn là mục theo dõi vẫn tiếp tục tồn tại, tiến trình gọi sẽ tiếp tục nhận được các thông báo tệp ngay cả khi quyền của tệp sau đó bị thay đổi khiến tiến trình gọi không còn quyền đọc trên tệp nữa).

Tham số `mask` là một mặt nạ bit (bit mask) chỉ định các sự kiện cần được giám sát đối với `pathname`. Chúng ta sẽ thảo luận chi tiết hơn về các giá trị bit có thể được chỉ định trong `mask` ngay sau đây.

Nếu `pathname` chưa từng được thêm vào danh sách theo dõi (watch list) cho `fd`, thì `inotify_add_watch()` sẽ tạo một mục theo dõi mới trong danh sách và trả về một watch descriptor mới, không âm (nonnegative), được sử dụng để tham chiếu đến mục theo dõi trong các thao tác sau đó. Watch descriptor này là duy nhất (unique) đối với thể hiện inotify này.

Nếu `pathname` đã được thêm vào danh sách theo dõi cho `fd` trước đó, thì `inotify_add_watch()` sẽ sửa đổi mặt nạ (`mask`) của mục theo dõi hiện có cho `pathname` và trả về watch descriptor cho mục đó. (Watch descriptor này sẽ giống với watch descriptor được trả về bởi lời gọi `inotify_add_watch()` ban đầu đã thêm `pathname` vào danh sách theo dõi này). Chúng ta sẽ nói thêm về cách `mask` có thể được sửa đổi khi mô tả cờ `IN_MASK_ADD` trong phần tiếp theo.

System call `inotify_rm_watch()` xóa mục theo dõi được chỉ định bởi `wd` khỏi thể hiện inotify được tham chiếu bởi file descriptor `fd`.

```c
## include <sys/inotify.h>
int inotify_rm_watch(int fd, uint32_t wd);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Tham số `wd` là một watch descriptor được trả về bởi lời gọi `inotify_add_watch()` trước đó. (Kiểu dữ liệu `uint32_t` là số nguyên không dấu 32-bit).

Việc xóa một theo dõi sẽ làm cho sự kiện `IN_IGNORED` được tạo ra cho watch descriptor này. Chúng ta sẽ thảo luận chi tiết hơn về sự kiện này ngay sau đây.

## 19.3 Sự kiện inotify (inotify Events)

Khi chúng ta tạo hoặc chỉnh sửa một mục giám sát (watch) bằng cách sử dụng `inotify_add_watch()`, đối số mặt nạ bit `mask` (bit-mask argument) sẽ xác định các sự kiện cần được theo dõi cho đường dẫn (`pathname`) được chỉ định. Các bit sự kiện có thể được chỉ định trong mask được thể hiện bởi cột In trong Bảng 19-1.

**Bảng 19-1:** Các sự kiện inotify (inotify events)

| Giá trị Bit      | In | Out | Mô tả                                                    |
|------------------|----|-----|----------------------------------------------------------|
| IN_ACCESS        | h  | h   | File đã bị truy cập (read())                             |
| IN_ATTRIB        | h  | h   | Siêu dữ liệu (metadata) của file đã thay đổi             |
| IN_CLOSE_WRITE   | h  | h   | File được mở để ghi đã bị đóng                           |
| IN_CLOSE_NOWRITE | h  | h   | File được mở ở chế độ chỉ đọc đã bị đóng                 |
| IN_CREATE        | h  | h   | File/thư mục được tạo bên trong thư mục đang giám sát    |
| IN_DELETE        | h  | h   | File/thư mục bị xóa khỏi bên trong thư mục đang giám sát |
| IN_DELETE_SELF   | h  | h   | Bản thân file/thư mục đang giám sát đã bị xóa            |
| IN_MODIFY        | h  | h   | File đã bị sửa đổi                                       |
| IN_MOVE_SELF     | h  | h   | Bản thân file/thư mục đang giám sát đã bị di chuyển      |
| IN_MOVED_FROM    | h  | h   | File bị di chuyển ra khỏi thư mục đang giám sát          |
| IN_MOVED_TO      | h  | h   | File được di chuyển vào trong thư mục đang giám sát      |
| IN_OPEN          | h  | h   | File đã được mở                                          |
| IN_ALL_EVENTS    | h  |     | Viết tắt gộp chung cho tất cả các sự kiện đầu vào ở trên |
| IN_MOVE          | h  |     | Viết tắt cho IN_MOVED_FROM<br>  IN_MOVED_TO              |
| IN_CLOSE         | h  |     | Viết tắt cho IN_CLOSE_WRITE<br>  IN_CLOSE_NOWRITE        |
| IN_DONT_FOLLOW   | h  |     | Không giải tham chiếu (dereference) liên kết tượng trưng (symbolic link) (từ Linux 2.6.15) |
| IN_MASK_ADD      | h  |     | Thêm các sự kiện vào mặt nạ giám sát hiện tại cho đường dẫn |
| IN_ONESHOT       | h  |     | Giám sát đường dẫn chỉ cho một sự kiện duy nhất          |
| IN_ONLYDIR       | h  |     | Thất bại nếu đường dẫn không phải là một thư mục (từ Linux 2.6.15) |
| IN_IGNORED       |    | h   | Cơ chế giám sát đã bị xóa bởi ứng dụng hoặc kernel       |
| IN_ISDIR         |    | h   | Tên file được trả về trong name là một thư mục           |
| IN_Q_OVERFLOW    |    | h   | Tràn (overflow) trên hàng đợi sự kiện (event queue)      |
| IN_UNMOUNT       |    | h   | Hệ thống file (file system) chứa đối tượng đã bị ngắt kết nối (unmount) |

Ý nghĩa của hầu hết các bit trong Bảng 19-1 đều có thể thấy rõ từ tên của chúng. Danh sách sau đây làm rõ một vài chi tiết:

- Sự kiện `IN_ATTRIB` xảy ra khi siêu dữ liệu (metadata) của file như quyền truy cập (permissions), quyền sở hữu (ownership), số lượng liên kết (link count), thuộc tính mở rộng (extended attributes), ID người dùng (user ID), hoặc ID nhóm (group ID) bị thay đổi.
- Sự kiện `IN_DELETE_SELF` xảy ra khi một đối tượng (tức là một file hoặc một thư mục) đang được giám sát bị xóa. Sự kiện `IN_DELETE` xảy ra khi đối tượng được giám sát là một thư mục và một trong các file chứa bên trong nó bị xóa.
- Sự kiện `IN_MOVE_SELF` xảy ra khi một đối tượng đang được giám sát bị đổi tên. Các sự kiện `IN_MOVED_FROM` và `IN_MOVED_TO` xảy ra khi một đối tượng bị đổi tên bên trong các thư mục đang được giám sát. Sự kiện trước xảy ra đối với thư mục chứa tên cũ, và sự kiện sau xảy ra đối với thư mục chứa tên mới.
- Các bit `IN_DONT_FOLLOW`, `IN_MASK_ADD`, `IN_ONESHOT`, và `IN_ONLYDIR` không chỉ định các sự kiện cần giám sát. Thay vào đó, chúng điều khiển hoạt động của lời gọi `inotify_add_watch()`.
- `IN_DONT_FOLLOW` chỉ định rằng đường dẫn (`pathname`) không nên được giải tham chiếu nếu nó là một liên kết tượng trưng (symbolic link). Điều này cho phép một ứng dụng giám sát chính liên kết tượng trưng, thay vì file mà nó trỏ tới.
- Nếu chúng ta thực hiện một lời gọi `inotify_add_watch()` chỉ định một đường dẫn đã đang được giám sát thông qua File Descriptor inotify này, thì theo mặc định, mặt nạ (`mask`) được cung cấp sẽ được sử dụng để thay thế mặt nạ hiện tại cho mục giám sát này. Nếu `IN_MASK_ADD` được chỉ định, thì mặt nạ hiện tại thay vào đó sẽ được sửa đổi bằng cách thực hiện phép toán OR với giá trị được cung cấp trong `mask`.
- `IN_ONESHOT` cho phép một ứng dụng giám sát một đường dẫn (`pathname`) cho một sự kiện duy nhất. Sau sự kiện đó, mục giám sát sẽ tự động bị xóa khỏi danh sách giám sát.
- `IN_ONLYDIR` cho phép một ứng dụng giám sát một đường dẫn chỉ khi đó là một thư mục. Nếu đường dẫn không phải là một thư mục, thì `inotify_add_watch()` sẽ thất bại với lỗi `ENOTDIR`. Việc sử dụng cờ (flag) này giúp ngăn chặn các tình trạng tranh chấp (race condition) có thể xảy ra nếu chúng ta muốn đảm bảo rằng mình đang giám sát một thư mục.

## 19.4 Đọc các sự kiện inotify (Reading inotify Events)

Sau khi đã đăng ký các mục trong danh sách giám sát (watch list), một ứng dụng có thể xác định các sự kiện nào đã xảy ra bằng cách sử dụng `read()` để đọc các sự kiện từ file descriptor (mô tả tệp) của inotify. Nếu chưa có sự kiện nào xảy ra, thì `read()` sẽ chặn (block) cho đến khi một sự kiện xảy ra (trừ khi cờ trạng thái `O_NONBLOCK` đã được thiết lập cho file descriptor, trong trường hợp đó `read()` sẽ thất bại ngay lập tức với lỗi `EAGAIN` nếu không có sự kiện nào sẵn sàng).

Sau khi các sự kiện xảy ra, mỗi lần gọi `read()` sẽ trả về một bộ đệm (buffer) (xem Hình 19-2) chứa một hoặc nhiều cấu trúc thuộc kiểu dữ liệu sau:

```c
struct inotify_event {
 int wd; /* Watch descriptor mà tại đó sự kiện xảy ra */
 uint32_t mask; /* Các bit mô tả sự kiện đã xảy ra */
 uint32_t cookie; /* Cookie cho các sự kiện liên quan (đối với rename()) */
 uint32_t len; /* Kích thước của trường 'name' */
 char name[]; /* Tên tệp kết thúc bằng null tùy chọn */
};
```

```
<-------------------- giá trị trả về từ read() -------------------->

Sự kiện 1:
+------+--------+--------+------+--------------------+----+
| wd   | mask   | cookie | len  | name               | 0  |
+------+--------+--------+------+--------------------+----+
                                                        ^ ký tự null kết thúc
                                                        + các byte null đệm (padding)

Sự kiện 2:
+------+--------+--------+------+--------------------+----+
| wd   | mask   | cookie | len  | name               | 0  |
+------+--------+--------+------+--------------------+----+
                                                        ^ ký tự null kết thúc
                                                        + các byte null đệm (padding)

Sự kiện 3:
+------+--------+--------+------+--------------------+----+
| wd   | mask   | cookie | len  | name               | 0  |
+------+--------+--------+------+--------------------+----+
                                                        ^ ký tự null kết thúc
                                                        + các byte null đệm (padding)
```

**Hình 19-2:** Một bộ đệm đầu vào chứa ba cấu trúc `inotify_event`

Trường `wd` cho chúng ta biết watch descriptor (mô tả giám sát) mà tại đó sự kiện này đã xảy ra. Trường này chứa một trong các giá trị được trả về bởi lệnh gọi `inotify_add_watch()` trước đó. Trường `wd` rất hữu ích khi một ứng dụng đang giám sát nhiều tệp hoặc thư mục thông qua cùng một file descriptor inotify. Nó cung cấp mối liên kết cho phép ứng dụng xác định tệp hoặc thư mục cụ thể mà tại đó sự kiện đã xảy ra. (Để làm điều này, ứng dụng phải duy trì một cấu trúc dữ liệu sổ sách (bookkeeping data structure) liên kết các watch descriptor với các đường dẫn tệp - pathname.)

Trường `mask` trả về một bit mask mô tả sự kiện. Dải các bit có thể xuất hiện trong `mask` được chỉ ra thông qua cột Out của Bảng 19-1. Lưu ý các chi tiết bổ sung sau đây về các bit cụ thể:

- Một sự kiện `IN_IGNORED` được tạo ra khi một giám sát bị xóa. Điều này có thể xảy ra vì hai lý do: ứng dụng đã sử dụng lệnh gọi `inotify_rm_watch()` để xóa tường minh giám sát, hoặc giám sát đã bị kernel (nhân) tự động xóa vì đối tượng được giám sát đã bị xóa hoặc hệ thống tệp (file system) chứa nó đã bị unmount (gỡ kết nối). Sự kiện `IN_IGNORED` không được tạo ra khi một giám sát được thiết lập với `IN_ONESHOT` bị xóa tự động vì một sự kiện đã được kích hoạt.
- Nếu đối tượng của sự kiện là một thư mục, thì ngoài một số bit khác, bit `IN_ISDIR` sẽ được bật (set) trong `mask`.

- Sự kiện `IN_UNMOUNT` thông báo cho ứng dụng rằng hệ thống tệp chứa đối tượng được giám sát đã bị unmount. Sau sự kiện này, một sự kiện tiếp theo chứa bit `IN_IGNORED` sẽ được gửi đến.
- Chúng ta sẽ mô tả `IN_Q_OVERFLOW` trong Mục [19.5](#page-10-0), nơi thảo luận về các giới hạn đối với các sự kiện inotify nằm trong hàng đợi (queue).

Trường `cookie` được sử dụng để liên kết các sự kiện có liên quan lại với nhau. Hiện tại, trường này chỉ được sử dụng khi một tệp được đổi tên (rename). Khi điều này xảy ra, sự kiện `IN_MOVED_FROM` được tạo ra cho thư mục mà từ đó tệp bị đổi tên đi, và sau đó sự kiện `IN_MOVED_TO` được tạo ra cho thư mục mà tệp được chuyển đến. (Nếu một tệp được đổi tên mới trong cùng một thư mục, thì cả hai sự kiện đều xảy ra đối với cùng một thư mục đó.) Hai sự kiện này sẽ có cùng một giá trị duy nhất trong trường `cookie` của chúng, do đó cho phép ứng dụng liên kết chúng lại với nhau.

Khi một sự kiện xảy ra đối với một tệp nằm bên trong một thư mục được giám sát, trường `name` được sử dụng để trả về một chuỗi kết thúc bằng ký tự null nhằm nhận diện tệp đó. Nếu sự kiện xảy ra đối với chính đối tượng được giám sát, thì trường `name` không được sử dụng và trường `len` sẽ chứa giá trị 0.

Trường `len` cho biết có bao nhiêu byte thực sự được cấp phát cho trường `name`. Trường này là cần thiết bởi vì có thể có các byte đệm (padding bytes) bổ sung giữa phần kết thúc của chuỗi được lưu trữ trong `name` và phần bắt đầu của cấu trúc `inotify_event` tiếp theo nằm trong bộ đệm do `read()` trả về (xem Hình 19-2). Do đó, chiều dài của một sự kiện inotify riêng lẻ là `sizeof(struct inotify_event) + len`.

Nếu bộ đệm (buffer) được truyền vào hàm `read()` quá nhỏ để chứa cấu trúc `inotify_event` tiếp theo, thì `read()` sẽ thất bại và trả về lỗi `EINVAL` để cảnh báo ứng dụng về vấn đề này. (Trong các phiên bản kernel trước 2.6.21, `read()` trả về 0 trong trường hợp này. Việc chuyển sang sử dụng lỗi `EINVAL` cung cấp dấu hiệu rõ ràng hơn cho thấy đã xảy ra lỗi lập trình). Ứng dụng có thể phản hồi bằng cách thực hiện một lần gọi `read()` khác với bộ đệm lớn hơn. Tuy nhiên, vấn đề này có thể được tránh hoàn toàn bằng cách đảm bảo rằng bộ đệm luôn đủ lớn để chứa ít nhất một sự kiện: bộ đệm được cấp cho `read()` phải có kích thước ít nhất là `(sizeof(struct inotify_event) + NAME_MAX + 1)` byte, trong đó `NAME_MAX` là độ dài tối đa của một tên tệp, cộng thêm một byte cho ký tự null kết thúc.

Sử dụng kích thước bộ đệm lớn hơn mức tối thiểu cho phép một ứng dụng truy xuất hiệu quả nhiều sự kiện chỉ với một lần gọi `read()`. Một lệnh `read()` từ một File Descriptor của inotify sẽ trả về giá trị nhỏ hơn giữa số lượng sự kiện hiện đang có sẵn và số lượng sự kiện có thể chứa vừa vặn trong bộ đệm được cung cấp.

> Lời gọi `ioctl(fd, FIONREAD, &numbytes)` trả về số lượng byte hiện có sẵn để đọc từ thể hiện (instance) inotify được tham chiếu bởi File Descriptor `fd`.

Các sự kiện được đọc từ một File Descriptor inotify tạo thành một hàng đợi có thứ tự (ordered queue). Do đó, ví dụ, được đảm bảo rằng khi một tệp được đổi tên, sự kiện `IN_MOVED_FROM` sẽ được đọc trước sự kiện `IN_MOVED_TO`.

Khi thêm một sự kiện mới vào cuối hàng đợi sự kiện (event queue), kernel sẽ gộp (coalesce) sự kiện đó với sự kiện ở cuối hàng đợi (sao cho sự kiện mới thực chất không bị đưa vào hàng đợi), nếu hai sự kiện có cùng giá trị cho `wd`, `mask`, `cookie`, và `name`. Điều này được thực hiện vì nhiều ứng dụng không cần phải biết về các lần lặp lại của cùng một sự kiện, và việc loại bỏ các sự kiện dư thừa sẽ làm giảm lượng bộ nhớ (kernel space) cần thiết cho hàng đợi sự kiện. Tuy nhiên, điều này có nghĩa là chúng ta không thể sử dụng inotify để xác định một cách đáng tin cậy có bao nhiêu lần hoặc mức độ thường xuyên mà một sự kiện lặp lại xảy ra.

### Chương trình ví dụ

Mặc dù có rất nhiều chi tiết trong phần mô tả trước đó, API inotify thực ra khá đơn giản để sử dụng. Liệt kê 19-1 minh họa việc sử dụng inotify.

**Liệt kê 19-1:** Sử dụng API inotify

```c
–––––––––––––––––––––––––––––––––––––––––––––––––––– inotify/demo_inotify.c
## include <sys/inotify.h>
## include <limits.h>
## include "tlpi_hdr.h"
static void /* Hiển thị thông tin từ cấu trúc inotify_event */
```

displayInotifyEvent(struct inotify_event *i)
{
printf(" wd =%2d; ", i->wd);
if (i->cookie > 0)
printf("cookie =%4d; ", i->cookie);
printf("mask = ");
if (i->mask & IN_ACCESS) printf("IN_ACCESS ");
if (i->mask & IN_ATTRIB) printf("IN_ATTRIB ");
if (i->mask & IN_CLOSE_NOWRITE) printf("IN_CLOSE_NOWRITE ");
if (i->mask & IN_CLOSE_WRITE) printf("IN_CLOSE_WRITE ");
if (i->mask & IN_CREATE) printf("IN_CREATE ");
if (i->mask & IN_DELETE) printf("IN_DELETE ");
if (i->mask & IN_DELETE_SELF) printf("IN_DELETE_SELF ");
if (i->mask & IN_IGNORED) printf("IN_IGNORED ");
if (i->mask & IN_ISDIR) printf("IN_ISDIR ");
if (i->mask & IN_MODIFY) printf("IN_MODIFY ");
if (i->mask & IN_MOVE_SELF) printf("IN_MOVE_SELF ");
if (i->mask & IN_MOVED_FROM) printf("IN_MOVED_FROM ");
if (i->mask & IN_MOVED_TO) printf("IN_MOVED_TO ");
if (i->mask & IN_OPEN) printf("IN_OPEN ");
if (i->mask & IN_Q_OVERFLOW) printf("IN_Q_OVERFLOW ");
if (i->mask & IN_UNMOUNT) printf("IN_UNMOUNT ");
printf("\n");
if (i->len > 0)
printf(" name = %s\n", i->name);
}

```

```c

## define BUF_LEN (10 * (sizeof(struct inotify_event) + NAME_MAX + 1))

int
main(int argc, char *argv[])

```
  {
   int inotifyFd, wd, j;
   char buf[BUF_LEN];
   ssize_t numRead;
   char *p;
   struct inotify_event *event;
   if (argc < 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s pathname... \n", argv[0]);
q inotifyFd = inotify_init(); /* Tạo thể hiện inotify */
   if (inotifyFd == -1)
   errExit("inotify_init");
   for (j = 1; j < argc; j++) {
w wd = inotify_add_watch(inotifyFd, argv[j], IN_ALL_EVENTS);
   if (wd == -1)
   errExit("inotify_add_watch");
   printf("Đang theo dõi %s sử dụng wd %d\n", argv[j], wd);
   }
   for (;;) { /* Đọc sự kiện liên tục */
e numRead = read(inotifyFd, buf, BUF_LEN);
   if (numRead == 0)
   fatal("read() từ inotify fd trả về 0!");
   if (numRead == -1)
   errExit("read");
   printf("Đã đọc %ld byte từ inotify fd\n", (long) numRead);
   /* Xử lý tất cả sự kiện trong bộ đệm do read() trả về */
   for (p = buf; p < buf + numRead; ) {
   event = (struct inotify_event *) p;
r displayInotifyEvent(event);
            p += sizeof(struct inotify_event) + event->len;
   }
   }
   exit(EXIT_SUCCESS);
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––––– inotify/demo_inotify.c
```

Chương trình trong Liệt kê 19-1 thực hiện các bước sau:

- Sử dụng `inotify_init()` để tạo một File Descriptor inotify q.

- Sử dụng `inotify_add_watch()` để thêm một mục giám sát (watch item) cho mỗi tệp được chỉ định trong đối số dòng lệnh của chương trình `w`. Mỗi mục giám sát sẽ theo dõi tất cả các sự kiện có thể xảy ra.
- Thực thi một vòng lặp vô hạn (infinite loop) để:
  - Đọc một bộ đệm (buffer) chứa các sự kiện từ File Descriptor (`inotify fd`) `e`.
  - Gọi hàm `displayInotifyEvent()` để hiển thị nội dung của từng cấu trúc `inotify_event` bên trong bộ đệm đó `r`.

Phiên làm việc trên shell sau đây minh họa cách sử dụng chương trình trong Bảng liệt kê (Listing) 19-1. Chúng ta khởi chạy một tiến trình (Process) chạy ngầm (background) để giám sát hai thư mục:

```
$ ./demo_inotify dir1 dir2 &
[1] 5386
Watching dir1 using wd 1
Watching dir2 using wd 2
```

Sau đó, chúng ta thực thi các lệnh tạo ra sự kiện trong hai thư mục này. Bắt đầu bằng việc tạo một tệp bằng lệnh `cat(1)`:

```
$ cat > dir1/aaa
Read 64 bytes from inotify fd
 wd = 1; mask = IN_CREATE
 name = aaa
 wd = 1; mask = IN_OPEN
 name = aaa
```

Đầu ra ở trên do chương trình chạy nền tạo ra cho thấy hàm `read()` đã lấy về một bộ đệm chứa hai sự kiện. Chúng ta tiếp tục nhập một số nội dung cho tệp và sau đó nhấn ký tự kết thúc tệp (end-of-file character) trên thiết bị đầu cuối (terminal):

```
Hello world
Read 32 bytes from inotify fd
 wd = 1; mask = IN_MODIFY
 name = aaa
Type Control-D
Read 32 bytes from inotify fd
 wd = 1; mask = IN_CLOSE_WRITE
 name = aaa
```

Tiếp theo, chúng ta đổi tên tệp và di chuyển nó sang thư mục được giám sát còn lại. Thao tác này tạo ra hai sự kiện: một sự kiện cho thư mục nguồn mà tệp được chuyển đi (với Watch Descriptor là 1) và sự kiện còn lại cho thư mục đích (với Watch Descriptor là 2):

```
$ mv dir1/aaa dir2/bbb
Read 64 bytes from inotify fd
 wd = 1; cookie = 548; mask = IN_MOVED_FROM
 name = aaa
 wd = 2; cookie = 548; mask = IN_MOVED_TO
 name = bbb
```

Hai sự kiện này chia sẻ cùng một giá trị `cookie`, cho phép ứng dụng liên kết chúng lại với nhau.

Khi chúng ta tạo một thư mục con (subdirectory) bên trong một trong các thư mục đang được giám sát, cờ (mask) trong sự kiện kết quả sẽ bao gồm bit `IN_ISDIR`, cho biết đối tượng của sự kiện là một thư mục:

```
$ mkdir dir2/ddd
Read 32 bytes from inotify fd
 wd = 1; mask = IN_CREATE IN_ISDIR
 name = ddd
```

Tại thời điểm này, cần nhắc lại rằng cơ chế giám sát của inotify không mang tính đệ quy (recursive). Nếu ứng dụng muốn giám sát các sự kiện trong thư mục con vừa được tạo, ứng dụng đó sẽ cần phải gọi thêm hàm `inotify_add_watch()` với đường dẫn (pathname) của thư mục con đó.

Cuối cùng, chúng ta xóa một trong các thư mục đang được giám sát:

```
$ rmdir dir1
Read 32 bytes from inotify fd
 wd = 1; mask = IN_DELETE_SELF
 wd = 1; mask = IN_IGNORED
```

Sự kiện cuối cùng, `IN_IGNORED`, được tạo ra để thông báo cho ứng dụng biết rằng kernel (nhân hệ điều hành) đã xóa mục giám sát này khỏi danh sách theo dõi (watch list).

## 19.5 Giới hạn Hàng đợi và Các tệp /proc

Việc đưa các sự kiện inotify vào hàng đợi (queue) yêu cầu bộ nhớ kernel (Kernel Memory). Vì lý do này, kernel thiết lập các giới hạn khác nhau đối với hoạt động của cơ chế inotify. Người dùng siêu đặc quyền (superuser) có thể cấu hình các giới hạn này thông qua ba tệp nằm trong thư mục `/proc/sys/fs/inotify`:

```
max_queued_events
```

Khi `inotify_init()` được gọi, giá trị này được sử dụng để thiết lập giới hạn trên (upper limit) cho số lượng sự kiện có thể được đưa vào hàng đợi trên thể hiện (instance) inotify mới. Nếu đạt đến giới hạn này, một sự kiện `IN_Q_OVERFLOW` sẽ được tạo ra và các sự kiện vượt quá sẽ bị loại bỏ. Trường `wd` cho sự kiện tràn (overflow) sẽ có giá trị là –1.

```
max_user_instances
```

Đây là giới hạn về số lượng thể hiện inotify có thể được tạo cho mỗi ID người dùng thực (real user ID).

```
max_user_watches
```

Đây là giới hạn về số lượng mục theo dõi (watch item) có thể được tạo cho mỗi ID người dùng thực (real user ID).

Các giá trị mặc định điển hình cho ba tệp này lần lượt là 16.384, 128 và 8192.

## 19.6 Một Hệ thống Cũ hơn để Giám sát Sự kiện Tệp: dnotify

Linux cung cấp một cơ chế khác để giám sát các sự kiện tệp. Cơ chế này, được gọi là dnotify, đã có từ kernel 2.4 nhưng sau đó đã bị thay thế và trở nên lỗi thời bởi inotify. Cơ chế dnotify vướng phải một số hạn chế so với inotify:

- Cơ chế dnotify cung cấp thông báo về các sự kiện bằng cách gửi các tín hiệu (signal) đến ứng dụng. Việc sử dụng signal làm cơ chế thông báo làm cho thiết kế ứng dụng trở nên phức tạp (Mục 22.12). Nó cũng làm cho việc sử dụng dnotify bên trong một thư viện (library) trở nên khó khăn, vì chương trình gọi có thể thay đổi cách xử lý (disposition) của (các) signal thông báo. Cơ chế inotify không sử dụng signal.
- Đơn vị giám sát của dnotify là một thư mục (directory). Ứng dụng được thông báo khi một thao tác được thực hiện trên bất kỳ tệp nào trong thư mục đó. Ngược lại, inotify có thể được sử dụng để giám sát các thư mục hoặc các tệp riêng lẻ.
- Để giám sát một thư mục, dnotify yêu cầu ứng dụng phải mở một file descriptor (mô tả tệp) cho thư mục đó. Việc sử dụng file descriptor gây ra hai vấn đề. Đầu tiên, vì đang bận, hệ thống tệp (file system) chứa thư mục đó không thể bị unmount. Thứ hai, vì mỗi thư mục yêu cầu một file descriptor riêng, ứng dụng có thể dẫn đến việc chiếm dụng một số lượng rất lớn file descriptor. Do inotify không sử dụng file descriptor, nó tránh được các vấn đề này.
- Thông tin do dnotify cung cấp về các sự kiện tệp kém chính xác hơn so với thông tin do inotify cung cấp. Khi một tệp bị thay đổi bên trong một thư mục được giám sát, dnotify cho chúng ta biết rằng một sự kiện đã xảy ra, nhưng không cho biết tệp nào đã tham gia vào sự kiện đó. Ứng dụng phải xác định điều này bằng cách lưu trữ đệm (caching) thông tin về nội dung thư mục. Hơn nữa, inotify cung cấp thông tin chi tiết hơn dnotify về loại sự kiện đã xảy ra.
- Trong một số trường hợp, dnotify không cung cấp thông báo đáng tin cậy về các sự kiện tệp.

Thông tin thêm về dnotify có thể được tìm thấy trong phần mô tả của thao tác `F_NOTIFY` tại trang manual `fcntl(2)`, và trong tệp mã nguồn kernel `Documentation/dnotify.txt`.

## 19.7 Tổng kết

Cơ chế `inotify` đặc trưng của Linux cho phép một ứng dụng nhận các thông báo khi các sự kiện (tệp được mở, đóng, tạo, xóa, sửa đổi, đổi tên, v.v.) xảy ra đối với một tập hợp các tệp và thư mục được giám sát. Cơ chế `inotify` thay thế cho cơ chế `dnotify` cũ hơn.

## 19.8 Bài tập

**19-1.** Viết một chương trình ghi nhật ký (log) tất cả các thao tác tạo, xóa và đổi tên tệp nằm bên trong thư mục được chỉ định trong tham số dòng lệnh (command-line argument) của nó. Chương trình nên giám sát các sự kiện trong tất cả các thư mục con bên dưới thư mục đã cho. Để lấy danh sách tất cả các thư mục con này, bạn sẽ cần sử dụng hàm `nftw()` (Mục 18.9). Khi một thư mục con mới được thêm vào cây thư mục hoặc một thư mục bị xóa, tập hợp các thư mục con được giám sát cần phải được cập nhật tương ứng.
