# Chương 64: PSEUDOTERMINAL

Pseudoterminal là một thiết bị ảo cung cấp một kênh IPC (Inter-Process Communication). Ở một đầu của kênh là một chương trình mong đợi được kết nối với một thiết bị terminal. Ở đầu kia là một chương trình điều khiển chương trình hướng-terminal (terminal-oriented program) bằng cách sử dụng kênh này để gửi dữ liệu đầu vào và đọc dữ liệu đầu ra của nó.

Chương trình này mô tả việc sử dụng pseudoterminal, cho thấy cách chúng được ứng dụng trong các chương trình như bộ giả lập terminal (terminal emulator), chương trình `script(1)`, và các chương trình như `ssh` cung cấp dịch vụ đăng nhập qua mạng.

## 64.1 Tổng quan

[Hình 64-1](#page-87-0) minh họa một trong những vấn đề mà pseudoterminal giúp chúng ta giải quyết: làm thế nào để cho phép một người dùng trên một host vận hành một chương trình hướng-terminal (ví dụ: `vi`) trên một host khác được kết nối qua mạng?

Như trong sơ đồ, bằng cách cho phép giao tiếp qua mạng, các socket cung cấp một phần cơ chế cần thiết để giải quyết vấn đề này. Tuy nhiên, chúng ta không thể kết nối trực tiếp đầu chuẩn vào (standard input), đầu chuẩn ra (standard output), và đầu lỗi chuẩn (standard error) của một chương trình hướng-terminal vào một socket. Lý do là chương trình hướng-terminal mong đợi được kết nối với một terminal — để có thể thực hiện các thao tác hướng-terminal được mô tả trong Chương 34 và [62](#page-0-0). Các thao tác này bao gồm chuyển terminal sang chế độ phi chuẩn (noncanonical mode), bật và tắt chế độ vọng (echoing), và thiết lập tiến trình nhóm foreground (foreground process group) của terminal. Nếu một chương trình cố gắng thực hiện các thao tác này trên một socket, thì các System Call liên quan sẽ thất bại.

Hơn nữa, một chương trình hướng-terminal mong đợi một trình điều khiển terminal (terminal driver) thực hiện một số kiểu xử lý nhất định đối với đầu vào và đầu ra của nó. Ví dụ, trong chế độ chuẩn (canonical mode), khi trình điều khiển terminal nhận diện được ký tự kết thúc file (thường là *Control-D*) ở đầu dòng, nó sẽ làm cho lệnh *read()* tiếp theo không trả về dữ liệu nào.

Cuối cùng, một chương trình hướng-terminal phải có một terminal điều khiển (controlling terminal). Điều này cho phép chương trình lấy một File Descriptor cho terminal điều khiển bằng cách mở `/dev/tty`, và cũng giúp tạo ra các tín hiệu kiểm soát công việc (job-control) và liên quan đến terminal (ví dụ: `SIGTSTP`, `SIGTTIN`, và `SIGINT`) cho chương trình.

Từ mô tả này, có thể thấy rõ rằng định nghĩa về một chương trình hướng-terminal là khá rộng. Nó bao gồm một phạm vi lớn các chương trình mà chúng ta thường chạy trong một phiên terminal tương tác (interactive terminal session).

```
                     Local host                                                           Remote host
            -------------------------------                                      -------------------------------
                     user space                                                              user space
            +---------------------------+                                        +-----------------------------+
            |      client program       |                                        |  terminal-oriented program  |
            +-----------+---------------+                                        +--------------+--------------+
                        ^                                                                       ^
                        |                                                                       |
                        | socket                                                                | socket
                        v                                                                       v
            ---------------------------------------------------------------       -------------------------------
                     kernel space                                                          kernel space
            +-----------+---------------+   +--------------+--------------+       +--------------+--------------+
            |         terminal          |   |        TCP/IP protocols     |       |        TCP/IP protocols     |
            +-----------+---------------+   +--------------+--------------+       +--------------+--------------+
                        |                                      ^                                 ^
                        |                                      |                                 |
                        v                                      |---------------------------------|
                  user at terminal                                          Network 
```

Hình 64-1: Vấn đề: làm thế nào để vận hành một chương trình hướng-terminal qua mạng?

### Các thiết bị master và slave của pseudoterminal

Pseudoterminal cung cấp mắt xích còn thiếu để tạo kết nối mạng đến một chương trình hướng-terminal. Một pseudoterminal là một cặp thiết bị ảo được kết nối với nhau: một thiết bị master (pseudoterminal master) và một thiết bị slave (pseudoterminal slave), đôi khi được gọi chung là một cặp pseudoterminal (pseudoterminal pair). Một cặp pseudoterminal cung cấp một kênh IPC giống như một pipe hai chiều (bidirectional pipe) — hai tiến trình có thể mở master và slave, sau đó truyền dữ liệu theo bất kỳ hướng nào thông qua pseudoterminal đó.

Điểm mấu chốt về thiết bị giả lập đầu cuối (pseudoterminal - pty) là thiết bị phụ (slave device) trông hoàn toàn giống như một terminal tiêu chuẩn. Tất cả các thao tác có thể áp dụng cho một thiết bị terminal cũng có thể được áp dụng cho thiết bị slave của pseudoterminal. Một số thao tác trong số này không có ý nghĩa đối với pseudoterminal (ví dụ: thiết lập tốc độ đường truyền hoặc tính chẵn lẻ của terminal), nhưng điều đó hoàn toàn bình thường, bởi vì pseudoterminal slave sẽ lờ đi một cách âm thầm.

### Cách các chương trình sử dụng pseudoterminal

Hình 64-2 minh họa cách hai chương trình thường sử dụng pseudoterminal. (Từ viết tắt pty trong sơ đồ này là dạng viết tắt phổ biến của pseudoterminal,

và chúng tôi sử dụng từ viết tắt này trong các sơ đồ và tên hàm khác nhau ở chương này.) Các luồng đầu vào, đầu ra và lỗi tiêu chuẩn (standard input, output, and error) của chương trình hướng terminal được kết nối với pseudoterminal slave, đồng thời đây cũng là terminal điều khiển (controlling terminal) của chương trình đó. Ở phía bên kia của pseudoterminal, một chương trình trình điều khiển (driver program) đóng vai trò là một proxy cho người dùng, cung cấp đầu vào cho chương trình hướng terminal và đọc đầu ra của chương trình đó.

```
                 (user space)
        ^ 
        | 
        |   +-------------------+      fork(), exec()      +-------------------------+
        |   |   driver          |  - - - - - - - - - - ->  | terminal-oriented       |
        |   |   program         |                          | program                 |
        |   +---------+---------+                          +-----------+-------------+
        |             ^                                                ^  |
        |             |                                                |  |
        |             |                                           stdin|  |stdout, stderr
        |             v                                                |  |
        |   +---------+---------+                          +-----------+--v----------+
        |   |     pty master    | <----------------------> |    pty slave           |
        |   +-------------------+                          +-----------+-------------+
        |                                                             
        |                                                             
        v                                                             
               (kernel space)                                         

```

**Hình 64-2:** Hai chương trình giao tiếp thông qua một pseudoterminal

Thông thường, driver program đang đồng thời đọc và ghi vào một kênh I/O khác. Nó đóng vai trò như một bộ chuyển tiếp (relay), truyền dữ liệu theo cả hai hướng giữa pseudoterminal và một chương trình khác. Để làm được điều này, driver program phải đồng thời giám sát dữ liệu đầu vào đến từ bất kỳ hướng nào. Thông thường, việc này được thực hiện bằng cách sử dụng ghép kênh I/O (I/O multiplexing - `select()` hoặc `poll()`), hoặc sử dụng một cặp Process (tiến trình) hoặc Thread (luồng) để thực hiện việc truyền dữ liệu theo từng hướng.

Một ứng dụng sử dụng pseudoterminal thường thực hiện theo các bước sau:

- 1. Driver program mở thiết bị chính của pseudoterminal (pseudoterminal master device).
- 2. Driver program gọi `fork()` để tạo một tiến trình con (child process). Tiến trình con thực hiện các bước sau:
  - a) Gọi `setsid()` để khởi ạo một phiên làm việc (session) mới, trong đó tiến trình con là tiến trình dẫn đầu phiên (session leader) (Mục 34.3). Bước này cũng khiến tiến trình con mất đi terminal điều khiển của nó.
  - b) Mở thiết bị pseudoterminal slave tương ứng với thiết bị master. Vì tiến trình con là một session leader và nó chưa có terminal điều khiển nào, pseudoterminal slave sẽ trở thành terminal điều khiển cho tiến trình con đó.
  - c) Sử dụng `dup()` (hoặc tương đương) để nhân bản File Descriptor (mô tả tệp) của thiết bị slave cho đầu vào, đầu ra và lỗi tiêu chuẩn.
  - d) Gọi `exec()` để khởi chạy chương trình hướng terminal sẽ được kết nối với pseudoterminal slave.

Tại thời điểm này, hai chương trình có thể giao tiếp với nhau thông qua pseudoterminal. Bất cứ thứ gì mà driver program ghi vào master đều xuất hiện dưới dạng đầu vào cho chương trình hướng terminal ở phía slave, và bất cứ thứ gì chương trình hướng terminal ghi vào slave đều có thể được đọc bởi driver program ở phía master. Chúng ta sẽ xem xét thêm các chi tiết về I/O của pseudoterminal tại Mục [64.5.](#page-99-1)

Pseudoterminal cũng có thể được sử dụng để kết nối một cặp tiến trình bất kỳ (tức là không nhất thiết phải là quan hệ cha - con). Tất cả những gì được yêu cầu là tiến trình mở pseudoterminal master thông báo tên của thiết bị slave tương ứng cho tiến trình kia, có thể bằng cách ghi tên đó vào một tệp hoặc bằng cách truyền nó thông qua một cơ chế IPC (Inter-Process Communication) khác. (Khi chúng ta sử dụng `fork()` theo cách đã mô tả ở trên, tiến trình con sẽ tự động kế thừa đủ thông tin từ tiến trình cha để cho phép nó xác định tên của thiết bị slave.)

Cho đến nay, cuộc thảo luận của chúng ta về việc sử dụng pseudoterminal vẫn mang tính trừu tượng. [Hình 64-3](#page-89-0) hiển thị một ví dụ cụ thể: việc sử dụng pseudoterminal bởi `ssh`, một ứng dụng cho phép người dùng chạy một phiên đăng nhập an toàn trên một hệ thống từ xa được kết nối qua mạng. (Trên thực tế, sơ đồ này kết hợp thông tin từ [Hình 64-1](#page-87-0) và [Hình 64-2](#page-88-0).) Trên máy chủ từ xa (remote host), driver program cho pseudoterminal master chính là máy chủ `ssh` (`sshd`), và chương trình hướng terminal được kết nối với pseudoterminal slave là login shell. Máy chủ `ssh` là chất keo kết nối pseudoterminal thông qua một Socket với máy khách `ssh` (`ssh client`). Khi tất cả các chi tiết đăng nhập đã hoàn tất, mục đích chính của máy chủ và máy khách `ssh` là chuyển tiếp các ký tự theo cả hai hướng giữa terminal của người dùng trên máy cục bộ (local host) và shell trên máy từ xa.

> Chúng tôi lược bỏ việc mô tả nhiều chi tiết về ssh client và server. Ví dụ, các chương trình này mã hóa dữ liệu được truyền đi theo cả hai hướng qua mạng. Chúng tôi minh họa một tiến trình (process) ssh server đơn lẻ trên máy chủ từ xa (remote host), nhưng thực tế, ssh server là một network server đồng thời (concurrent network server). Nó trở thành một daemon và tạo ra một TCP socket thụ động (passive socket) để lắng nghe các kết nối đến từ các ssh client. Đối với mỗi kết nối, tiến trình ssh server chính (master) sẽ tạo một tiến trình con (forks a child process) để xử lý toàn bộ các chi tiết cho một phiên đăng nhập client duy nhất. (Chúng tôi gọi tiến trình con này là ssh server trong [Hình 64-3.](#page-89-0)) Ngoài các chi tiết về thiết lập pseudoterminal được mô tả ở trên, tiến trình con ssh server sẽ xác thực người dùng (authenticate), cập nhật các tệp tin kế toán đăng nhập (login accounting files) trên máy chủ từ xa (như được mô tả trong Chương 40), và sau đó thực thi shell đăng nhập (execs the login shell).

```
                             Local host                                   Remote host
                      +--------------------+                      +----------------------+
                      |      ssh client    |                      |      ssh server      |
                      +----+-----------+---+                      +----+-----------+-----+
                       ^   |           ^                               ^           ^
                  stdin|   |stdout     |                               |           |
                       |   |stderr     |                               |           |
                       |   |           +-----------------+             |  socket   |
                       |   |               socket        |             |           |
        +--------------+---v----+                      +-v----+--------+-----+     |
        |      terminal         |                      |   TCP/IP            |     |
        +-----------+-----------+                      |   protocols         |     |
                    ^                                  +----------+----------+     |
                    |                                             ^                |
                    |                                             |                |
             +------+---------+                                   |                |
             | user at        |                                   |                |
             | terminal       |                                   |                |
             +----------------+                                   |                |
                                                                  |                |
                                                              Network              |
                                                                  |                |
                                                                  v                v
                                                          +-------+---------+  +-------------------+
                                                          |   TCP/IP        |  |     pty master    |
                                                          |   protocols     |  +---------+---------+
                                                          +-------+---------+           ^
                                                                                        |                      
                                                                                        v                      
                                                                                  +------------------+   +------------------+
                                                                                  |     pty slave    |<->|   login shell    |
                                                                                  +---------+--------+   +---------+--------+
                                
```

**Hình 64-3:** Cách ssh sử dụng pseudoterminal

Trong một số trường hợp, nhiều tiến trình (process) có thể được kết nối với phía slave của pseudoterminal. Ví dụ về ssh của chúng tôi minh họa điểm này. Trưởng phiên làm việc (session leader) cho phía slave là một shell, shell này tạo ra các nhóm tiến trình (process groups) để thực thi các lệnh do người dùng từ xa nhập vào. Tất cả các tiến trình này đều có pseudoterminal slave làm terminal điều khiển (controlling terminal) của chúng. Giống như terminal thông thường, một trong các nhóm tiến trình này có thể là nhóm tiến trình foreground (foreground process group) cho pseudoterminal slave, và chỉ nhóm tiến trình này mới được phép đọc từ slave và (nếu bit TOSTOP được thiết lập) ghi vào đó.

### Các ứng dụng của pseudoterminal

Pseudoterminal cũng được sử dụng trong nhiều ứng dụng khác ngoài các dịch vụ mạng. Các ví dụ bao gồm:

- Chương trình expect(1) sử dụng pseudoterminal để cho phép một chương trình tương tác hướng terminal được điều khiển từ một tệp kịch bản (script file).
- Các trình giả lập terminal (terminal emulators) như xterm sử dụng pseudoterminal để cung cấp các tính năng liên quan đến terminal đi kèm với một cửa sổ terminal.

- Chương trình `screen(1)` sử dụng pseudoterminal để ghép kênh (multiplex) một terminal vật lý duy nhất (hoặc cửa sổ terminal) giữa nhiều tiến trình (process) (ví dụ: nhiều phiên shell (shell session)).
- Pseudoterminal được sử dụng trong chương trình `script(1)`, dùng để ghi lại toàn bộ đầu vào (input) và đầu ra (output) diễn ra trong một phiên shell.
- Đôi khi pseudoterminal rất hữu ích để vượt qua cơ chế đệm khối (block buffering) mặc định do các hàm stdio thực hiện khi ghi dữ liệu đầu ra vào một tệp trên đĩa (disk file) hoặc pipe (đường ống), trái ngược với cơ chế đệm dòng (line buffering) được dùng cho đầu ra của terminal. (Chúng ta sẽ xem xét điểm này kỹ hơn ở Bài tập [64-7.\)](#page-109-0)

### Pseudoterminal System V (UNIX 98) và BSD

BSD và System V cung cấp các giao diện khác nhau để tìm kiếm và mở hai nửa của một cặp pseudoterminal. Việc triển khai pseudoterminal theo kiểu BSD về mặt lịch sử được biết đến rộng rãi hơn, vì nó được sử dụng với nhiều ứng dụng mạng dựa trên socket (sockets-based network application). Vì lý do tương thích, cuối cùng nhiều hệ thống UNIX đã hỗ trợ cả hai phong cách pseudoterminal này.

Giao diện System V đơn giản hơn một chút so với giao diện BSD, và đặc tả pseudoterminal của SUSv3 dựa trên giao diện System V. (Đặc tả pseudoterminal lần đầu tiên xuất hiện trong SUSv1). Vì lý do lịch sử, trên các hệ thống Linux, loại pseudoterminal này thường được gọi là pseudoterminal UNIX 98, mặc dù tiêu chuẩn UNIX 98 (tức là SUSv2) yêu cầu pseudoterminal phải dựa trên STREAMS (STREAMS-based), nhưng việc triển khai pseudoterminal trên Linux thì không phải vậy. (SUSv3 không yêu cầu việc triển khai phải dựa trên STREAMS).

Các phiên bản Linux đầu tiên chỉ hỗ trợ pseudoterminal theo phong cách BSD, nhưng kể từ kernel 2.2, Linux đã hỗ trợ cả hai loại pseudoterminal. Trong chương này, chúng ta tập trung vào pseudoterminal UNIX 98. Chúng ta sẽ mô tả những điểm khác biệt đối với pseudoterminal BSD ở Mục [64.8](#page-106-0).

## 64.2 Pseudoterminal UNIX 98

Từng bước một, chúng ta sẽ tiến hành xây dựng một hàm `ptyFork()`, hàm này thực hiện phần lớn công việc để tạo ra thiết lập được minh họa trong [Hình 64-2.](#page-88-0) Sau đó, chúng ta sẽ sử dụng hàm này để hiện thực hóa chương trình `script(1)`. Tuy nhiên, trước khi làm điều đó, chúng ta hãy xem xét các hàm thư viện khác nhau được sử dụng với pseudoterminal UNIX 98:

- Hàm `posix_openpt()` mở một thiết bị master (master device) của pseudoterminal chưa được sử dụng, trả về một file descriptor (mô tả tệp) được dùng để tham chiếu đến thiết bị trong các lời gọi (call) tiếp theo.
- Hàm `grantpt()` thay đổi quyền sở hữu (ownership) và quyền hạn (permissions) của thiết bị slave (slave device) tương ứng với thiết bị master của pseudoterminal.
- Hàm `unlockpt()` mở khóa thiết bị slave tương ứng với thiết bị master của pseudoterminal, để thiết bị slave đó có thể được mở.
- Hàm `ptsname()` trả về tên của thiết bị slave tương ứng với thiết bị master của pseudoterminal. Thiết bị slave đó sau đó có thể được mở bằng hàm `open()`.

### 64.2.1 Mở một thiết bị Master chưa sử dụng: posix\_openpt()

Hàm `posix_openpt()` tìm kiếm và mở một thiết bị pseudoterminal master (pseudo-terminal master) chưa được sử dụng, đồng thời trả về một file descriptor (mô tả tệp) có thể được sử dụng sau đó để tham chiếu đến thiết bị này.

```
## define _XOPEN_SOURCE 600
## include <stdlib.h>
## include <fcntl.h>
int posix_openpt(int flags);
                                Trả về file descriptor nếu thành công, hoặc –1 nếu có lỗi
```

Đối số `flags` được cấu thành bằng cách kết hợp phép toán OR (hoặc bit) với không hoặc nhiều các hằng số sau đây:

`O_RDWR`

Mở thiết bị cho cả hai thao tác đọc và ghi. Thông thường, chúng ta sẽ luôn bao gồm hằng số này trong `flags`.

`O_NOCTTY`

Không biến thiết bị đầu cuối này thành thiết bị điều khiển (controlling terminal) cho process (tiến trình). Trên Linux, một pseudoterminal master không thể trở thành controlling terminal cho một process, bất kể cờ `O_NOCTTY` có được chỉ định hay không khi gọi `posix_openpt()`. (Điều này hoàn toàn hợp lý vì pseudoterminal master không thực sự là một terminal; nó là phía bên kia của terminal mà pseudoterminal slave được kết nối tới). Tuy nhiên, trên một số cài đặt (implementation), `O_NOCTTY` là bắt buộc nếu chúng ta muốn ngăn một process có được controlling terminal như là hệ quả của việc mở một thiết bị pseudoterminal master.

Giống như `open()`, `posix_openpt()` sử dụng file descriptor có giá trị thấp nhất hiện có để mở pseudoterminal master.

Việc gọi `posix_openpt()` cũng dẫn đến việc tạo ra một tệp thiết bị pseudoterminal slave tương ứng trong thư mục `/dev/pts`. Chúng ta sẽ thảo luận chi tiết hơn về tệp này khi mô tả hàm `ptsname()` dưới đây.

Hàm `posix_openpt()` xuất hiện lần đầu trong SUSv3, và là một phát minh của ủy ban POSIX. Trong cài đặt pseudoterminal System V ban đầu, việc lấy một pseudoterminal master khả dụng được thực hiện bằng cách mở thiết bị nhân bản (clone device) pseudoterminal master, `/dev/ptmx`. Việc mở thiết bị ảo này sẽ tự động định vị và mở pseudoterminal master chưa sử dụng tiếp theo, sau đó trả về một file descriptor cho nó. Thiết bị này được cung cấp trên Linux, nơi `posix_openpt()` được hiện thực như sau:

```
int
posix_openpt(int flags)
{
 return open("/dev/ptmx", flags);
}
```

### Giới hạn về số lượng pseudoterminal UNIX 98

Vì mỗi cặp pseudoterminal đang được sử dụng tiêu thụ một lượng nhỏ bộ nhớ kernel (kernel memory) không thể hoán đổi (nonswappable), kernel áp đặt một giới hạn đối với số lượng cặp pseudoterminal UNIX 98 trên hệ thống. Trong các phiên bản kernel cho đến 2.6.3, giới hạn này được kiểm soát bởi một tùy chọn cấu hình kernel (`CONFIG_UNIX98_PTYS`). Giá trị mặc định cho tùy chọn này là 256, nhưng chúng ta có thể thay đổi giới hạn thành bất kỳ giá trị nào trong khoảng từ 0 đến 2048.

Từ Linux 2.6.4 trở đi, tùy chọn cấu hình kernel `CONFIG_UNIX98_PTYS` đã bị loại bỏ để nhường chỗ cho một cách tiếp cận linh hoạt hơn. Thay vào đó, giới hạn về số lượng pseudoterminal được xác định bởi giá trị trong tệp đặc thù của Linux `/proc/sys/kernel/pty/max`. Giá trị mặc định cho tệp này là 4096 và nó có thể được thiết lập thành bất kỳ giá trị nào lên đến 1.048.576. Một tệp chỉ đọc liên quan, `/proc/sys/kernel/pty/nr`, hiển thị có bao nhiêu pseudoterminal UNIX 98 đang được sử dụng tại thời điểm đó.

### 64.2.2 Thay đổi Quyền sở hữu và Quyền truy cập của Slave: grantpt()

SUSv3 quy định việc sử dụng `grantpt()` để thay đổi quyền sở hữu (ownership) và quyền truy cập (permissions) của thiết bị slave (pseudoterminal slave) tương ứng với master pseudoterminal được tham chiếu bởi file descriptor `mfd`. Trên Linux, việc gọi `grantpt()` thực tế là không cần thiết. Tuy nhiên, việc sử dụng `grantpt()` lại là bắt buộc trên một số hệ thống (implementations), và các ứng dụng có khả năng di động (portable applications) nên gọi hàm này sau khi gọi `posix_openpt()`.

```c
## define _XOPEN_SOURCE 500
## include <stdlib.h>
int grantpt(int mfd);
                                             Thành công trả về 0, lỗi trả về –1
```

Trên các hệ thống yêu cầu `grantpt()`, hàm này tạo ra một tiến trình con (child process) để thực thi một chương trình mang cờ set-user-ID-root. Chương trình này, thường được gọi là `pt_chown`, thực hiện các thao tác sau trên thiết bị pseudoterminal slave:

- thay đổi quyền sở hữu của slave thành giống với effective user ID của tiến trình gọi;
- thay đổi group của slave thành `tty`; và

- thay đổi quyền truy cập trên slave sao cho owner có quyền đọc và ghi, còn group có quyền ghi.

Lý do của việc thay đổi group của terminal thành `tty` và bật quyền ghi cho group là vì các chương trình `wall(1)` và `write(1)` là các chương trình set-group-ID thuộc sở hữu của group `tty`.

Trên Linux, một pseudoterminal slave được tự động cấu hình theo cách thức nêu trên, đó là lý do tại sao việc gọi `grantpt()` là không cần thiết (nhưng vẫn nên được thực hiện).

> Do hàm này có thể tạo ra một tiến trình con (child process), SUSv3 nêu rõ rằng hành vi của `grantpt()` là không xác định (unspecified) nếu chương trình gọi đã cài đặt một trình xử lý tín hiệu (signal handler) cho `SIGCHLD`.

### 64.2.3 Mở khóa Slave: unlockpt()

Hàm `unlockpt()` gỡ bỏ một khóa nội bộ (internal lock) trên slave tương ứng với pseudoterminal master được tham chiếu bởi file descriptor `mfd`. Mục đích của cơ chế khóa này là cho phép tiến trình gọi thực hiện bất kỳ quá trình khởi tạo nào cần thiết cho pseudoterminal slave (ví dụ: gọi `grantpt()`) trước khi một tiến trình khác được phép mở nó.

```c
## define _XOPEN_SOURCE 500
## include <stdlib.h>
int unlockpt(int mfd);
                                             Thành cóng trả về 0, lỗi trả về –1
```

Nỗ lực mở một pseudoterminal slave trước khi nó được mở khóa bằng `unlockpt()` sẽ thất bại với mã lỗi `EIO`.

### 64.2.4 Lấy Tên của Slave: ptsname()

Hàm `ptsname()` trả về tên của pseudoterminal slave tương ứng với pseudoterminal master được tham chiếu bởi file descriptor `mfd`.

```c
## define _XOPEN_SOURCE 500
## include <stdlib.h>
char *ptsname(int mfd);
               Thành công trả về con trỏ tới chuỗi (có thể được cấp phát tĩnh),
                                                      hoặc NULL khi xảy ra lỗi
```

Trên Linux (giống như hầu hết các hệ thống), `ptsname()` trả về một tên có dạng `/dev/pts/nn`, trong đó `nn` được thay thế bằng một số nhận diện duy nhất (uniquely identifies) pseudoterminal slave này.

Bộ đệm (buffer) được sử dụng để trả về tên slave thông thường được cấp phát tĩnh (statically allocated). Do đó, nó sẽ bị ghi đè bởi các lời gọi tiếp theo tới `ptsname()`.

Thư viện GNU C cung cấp một hàm tương đương có khả năng tái nhập (reentrant) của `ptsname()` dưới dạng `ptsname_r(mfd, strbuf, buflen)`. Tuy nhiên, hàm này không chuẩn hóa (nonstandard) và chỉ có sẵn trên một số ít hệ thống UNIX khác. Macro kiểm tra tính năng `_GNU_SOURCE` phải được định nghĩa để có được khai báo của `ptsname_r()` từ `<stdlib.h>`.

Một khi chúng ta đã mở khóa thiết bị slave bằng `unlockpt()`, chúng ta có thể mở nó bằng system call `open()` truyền thống.

> Trên các hệ phái System V sử dụng STREAMS, có thể cần thực hiện một số bước bổ sung (đẩy các module STREAMS vào thiết bị slave sau khi mở nó). Ví dụ về cách thực hiện các bước này có thể được tìm thấy trong tài liệu [Stevens & Rago, 2005].

## 64.3 Mở một Master: ptyMasterOpen()

Bây giờ chúng ta sẽ trình bày một hàm, `ptyMasterOpen()`, sử dụng các hàm đã được mô tả trong các phần trước để mở một pseudoterminal master và lấy tên của pseudoterminal slave tương ứng. Lý do chúng tôi cung cấp hàm này gồm hai yếu tố:

- Hầu hết các chương trình thực hiện các bước này hoàn toàn giống nhau, vì vậy việc đóng gói (encapsulate) chúng vào một hàm duy nhất sẽ rất thuận tiện.
- Hàm `ptyMasterOpen()` của chúng tôi ẩn đi tất cả các chi tiết đặc thù của pseudoterminal chuẩn UNIX 98. Trong Mục [64.8,](#page-106-0) chúng tôi trình bày một cách cài đặt lại hàm này sử dụng pseudoterminal theo phong cách BSD (BSD-style pseudoterminal). Toàn bộ mã nguồn mà chúng tôi trình bày trong phần còn lại của chương này có thể hoạt động với bất kỳ cách cài đặt nào trong hai cách này.

```
## include "pty_master_open.h"
int ptyMasterOpen(char *slaveName, size_t snLen);
                               Trả về File Descriptor khi thành công, hoặc –1 khi lỗi
```

Hàm `ptyMasterOpen()` mở một pseudoterminal master chưa được sử dụng, gọi các hàm `grantpt()` và `unlockpt()` trên đó, sau đó sao chép tên của pseudoterminal slave tương ứng vào bộ đệm (buffer) do `slaveName` trỏ tới. Người gọi phải chỉ định dung lượng bộ nhớ có sẵn trong buffer này thông qua tham số `snLen`. Chúng tôi minh họa cách cài đặt hàm này trong [Liệt kê 64-1](#page-95-0).

> Sẽ hoàn toàn khả thi nếu bỏ qua các tham số `slaveName` và `snLen`, và để người gọi `ptyMasterOpen()` tự gọi trực tiếp `ptsname()` nhằm lấy tên của pseudoterminal slave. Tuy nhiên, chúng tôi sử dụng các tham số `slaveName` và `snLen` vì pseudoterminal kiểu BSD không cung cấp hàm tương đương với `ptsname()`, và cách cài đặt hàm tương đương dành cho pseudoterminal kiểu BSD của chúng tôi [\(Liệt kê 64-4\)](#page-107-0) đã đóng gói kỹ thuật của BSD để lấy tên của slave.

```
––––––––––––––––––––––––––––––––––––––––––––––––––––– pty/pty_master_open.c
## define _XOPEN_SOURCE 600
## include <stdlib.h>
## include <fcntl.h>
## include "pty_master_open.h" /* Khai báo ptyMasterOpen() */
## include "tlpi_hdr.h"
int
ptyMasterOpen(char *slaveName, size_t snLen)
{
 int masterFd, savedErrno;
 char *p;
 masterFd = posix_openpt(O_RDWR | O_NOCTTY); /* Mở pty master */
 if (masterFd == -1)
 return -1;
 if (grantpt(masterFd) == -1) { /* Cấp quyền truy cập cho slave pty */
 savedErrno = errno;
 close(masterFd); /* Có thể làm thay đổi 'errno' */
 errno = savedErrno;
 return -1;
 }
 if (unlockpt(masterFd) == -1) { /* Mở khóa slave pty */
 savedErrno = errno;
 close(masterFd); /* Có thể làm thay đổi 'errno' */
 errno = savedErrno;
 return -1;
 }
 p = ptsname(masterFd); /* Lấy tên slave pty */
 if (p == NULL) {
 savedErrno = errno;
 close(masterFd); /* Có thể làm thay đổi 'errno' */
 errno = savedErrno;
 return -1;
 }
 if (strlen(p) < snLen) {
 strncpy(slaveName, p, snLen);
 } else { /* Trả về lỗi nếu buffer quá nhỏ */
 close(masterFd);
 errno = EOVERFLOW;
 return -1;
 }
 return masterFd;
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– pty/pty_master_open.c
```

## 64.4 Kết nối các Tiến trình (Processes) bằng Pseudoterminal: ptyFork()

Bây giờ chúng ta đã sẵn sàng để hiện thực hóa (implement) một hàm thực hiện toàn bộ công việc thiết lập kết nối giữa hai tiến trình sử dụng một cặp pseudoterminal, như được minh họa trong [Hình 64-2](#page-88-0). Hàm `ptyFork()` tạo ra một tiến trình con (child process) được kết nối với tiến trình cha (parent) thông qua một cặp pseudoterminal.

```c
## include "pty_fork.h"
pid_t ptyFork(int *masterFd, char *slaveName, size_t snLen,
 const struct termios *slaveTermios, const struct winsize *slaveWS);
               Ở tiến trình cha: trả về ID tiến trình (process ID) của tiến trình con nếu thành công, hoặc –1 nếu lỗi;
                                  Ở tiến trình con được tạo thành công: luôn trả về 0
```

Việc hiện thực hóa `ptyFork()` được thể hiện trong [Liệt kê 64-2](#page-97-0). Hàm này thực hiện các bước sau:

- Mở một pseudoterminal master bằng cách sử dụng `ptyMasterOpen()` ([Liệt kê 64-1](#page-95-0)) q.
- Nếu tham số `slaveName` không phải là `NULL`, sao chép tên của pseudoterminal slave vào bộ đệm (buffer) này w. (Nếu `slaveName` không phải là `NULL`, thì nó phải trỏ đến một bộ đệm có kích thước ít nhất là `snLen` byte). Người gọi có thể sử dụng tên này để cập nhật các tệp kế toán đăng nhập (login accounting files) (Chương 40), nếu phù hợp. Việc cập nhật các tệp kế toán đăng nhập sẽ phù hợp cho các ứng dụng cung cấp dịch vụ đăng nhập—ví dụ: `ssh`, `rlogin` và `telnet`. Mặt khác, các chương trình như `script(1)` (Mục [64.6\)](#page-101-0) không cập nhật các tệp kế toán đăng nhập, bởi vì chúng không cung cấp dịch vụ đăng nhập.
- Gọi `fork()` để tạo một tiến trình con e.
- Tất cả những gì tiến trình cha thực hiện sau `fork()` là đảm bảo rằng file descriptor (mô tả tệp) cho pseudoterminal master được trả về cho người gọi thông qua số nguyên mà `masterFd` trỏ tới r.
- Sau `fork()`, tiến trình con thực hiện các bước sau:
  - Gọi `setsid()`, để tạo một phiên làm việc (session) mới (Mục 34.3) t. Tiến trình con là tiến trình lãnh đạo (leader) của phiên làm việc mới và mất đi terminal điều khiển (controlling terminal) của nó (nếu nó đã có một cái).
  - Đóng file descriptor cho pseudoterminal master, vì nó không cần thiết trong tiến trình con y.
  - Mở pseudoterminal slave u. Do tiến trình con đã mất terminal điều khiển ở bước trước, bước này khiến pseudoterminal slave trở thành terminal điều khiển cho tiến trình con.
  - Nếu macro `TIOCSCTTY` được định nghĩa, hãy thực hiện thao tác `ioctl()` với `TIOCSCTTY` trên file descriptor của pseudoterminal slave i. Mã nguồn này cho phép hàm `ptyFork()` của chúng ta hoạt động trên các nền tảng BSD, nơi terminal điều khiển chỉ có thể lấy được như một hệ quả của thao tác `TIOCSCTTY` tường minh (tham khảo Mục 34.4).
  - Nếu tham số `slaveTermios` khác `NULL`, hãy gọi `tcsetattr()` để thiết lập các thuộc tính terminal của slave thành các giá trị trong cấu trúc `termios` được trỏ bởi tham số này o. Việc sử dụng tham số này tạo sự thuận tiện cho một số chương trình tương tác nhất định (ví dụ: `script(1)`) sử dụng pseudoterminal và cần thiết lập các thuộc tính của thiết bị slave giống với các thuộc tính của terminal mà chương trình đang chạy dưới đó.

- Nếu tham số `slaveWS` khác `NULL`, hãy thực hiện thao tác `ioctl()` với `TIOCSWINSZ` để thiết lập kích thước cửa sổ (window size) của pseudoterminal slave thành các giá trị trong cấu trúc `winsize` được trỏ bởi tham số này a. Bước này được thực hiện vì lý do tương tự như bước trước.
- Sử dụng `dup2()` để nhân bản file descriptor của slave thành đầu vào chuẩn (standard input), đầu ra chuẩn (standard output) và lỗi chuẩn (standard error) cho tiến trình con s. Tại thời điểm này, tiến trình con có thể chạy hàm `exec` một chương trình tùy ý, và chương trình đó có thể sử dụng các file descriptor chuẩn để giao tiếp với pseudoterminal. Chương trình được `exec` có thể thực hiện tất cả các thao tác hướng terminal thông thường có thể được thực hiện bởi một chương trình chạy trên một terminal truyền thống.

Giống như `fork()`, `ptyFork()` trả về process ID của tiến trình con trong tiến trình cha, trả về 0 trong tiến trình con, hoặc –1 khi xảy ra lỗi.

Cuối cùng, tiến trình con được tạo bởi `ptyFork()` sẽ kết thúc (terminate). Nếu tiến trình cha không kết thúc cùng lúc đó, thì nó phải chờ tiến trình con (wait on) để loại bỏ tiến trình th zombie (zombie process) phát sinh. Tuy nhiên, bước này thường có thể được lược bỏ, vì các ứng dụng sử dụng pseudoterminal thường được thiết kế sao cho tiến trình cha kết thúc cùng lúc với tiến trình con.

> Các hệ phái BSD cung cấp hai hàm liên quan, không chuẩn (nonstandard) để làm việc với pseudoterminal. Hàm đầu tiên trong số này là `openpty()`, hàm này mở một cặp pseudoterminal, trả về các file descriptor cho master và slave, tùy chọn trả về tên của thiết bị slave, và tùy chọn thiết lập các thuộc tính terminal cũng như kích thước cửa sổ từ các tham số tương tự như `slaveTermios` và `slaveWS`. Hàm còn lại, `forkpty()`, cũng giống như `ptyFork()` của chúng ta, ngoại trừ việc nó không cung cấp phiên bản tương đương với tham số `snLen`. Trên Linux, cả hai hàm này đều được cung cấp bởi `glibc` và được tài liệu hóa trong trang hướng dẫn (man page) `openpty(3)`.

**Liệt kê 64-2:** Hiện thực hóa `ptyFork()`

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pty/pty_fork.c
## include <fcntl.h>
## include <termios.h>
## include <sys/ioctl.h>
## include "pty_master_open.h"
## include "pty_fork.h" /* Declares ptyFork() */
## include "tlpi_hdr.h"
## define MAX_SNAME 1000
pid_t
ptyFork(int *masterFd, char *slaveName, size_t snLen,
 const struct termios *slaveTermios, const struct winsize *slaveWS)
{
 int mfd, slaveFd, savedErrno;
 pid_t childPid;
 char slname[MAX_SNAME];
```

```c
q mfd = ptyMasterOpen(slname, MAX_SNAME);
   if (mfd == -1)
   return -1;
w if (slaveName != NULL) { /* Return slave name to caller */
   if (strlen(slname) < snLen) {
   strncpy(slaveName, slname, snLen);
   } else { /* 'slaveName' was too small */
   close(mfd);
   errno = EOVERFLOW;
   return -1;
   }
   }
e childPid = fork();
   if (childPid == -1) { /* fork() failed */
   savedErrno = errno; /* close() might change 'errno' */
   close(mfd); /* Don't leak file descriptors */
   errno = savedErrno;
   return -1;
   }
r if (childPid != 0) { /* Parent */
   *masterFd = mfd; /* Only parent gets master fd */
   return childPid; /* Like parent of fork() */
   }
   /* Child falls through to here */
t if (setsid() == -1) /* Start a new session */
   err_exit("ptyFork:setsid");
y close(mfd); /* Not needed in child */
u slaveFd = open(slname, O_RDWR); /* Becomes controlling tty */
   if (slaveFd == -1)
   err_exit("ptyFork:open-slave");
i #ifdef TIOCSCTTY /* Acquire controlling tty on BSD */
   if (ioctl(slaveFd, TIOCSCTTY, 0) == -1)
   err_exit("ptyFork:ioctl-TIOCSCTTY");
## endif
o if (slaveTermios != NULL) /* Set slave tty attributes */
   if (tcsetattr(slaveFd, TCSANOW, slaveTermios) == -1)
   err_exit("ptyFork:tcsetattr");
a if (slaveWS != NULL) /* Set slave tty window size */
   if (ioctl(slaveFd, TIOCSWINSZ, slaveWS) == -1)
   err_exit("ptyFork:ioctl-TIOCSWINSZ");
```

```c
 /* Duplicate pty slave to be child's stdin, stdout, and stderr */
s if (dup2(slaveFd, STDIN_FILENO) != STDIN_FILENO)
   err_exit("ptyFork:dup2-STDIN_FILENO");
   if (dup2(slaveFd, STDOUT_FILENO) != STDOUT_FILENO)
   err_exit("ptyFork:dup2-STDOUT_FILENO");
   if (dup2(slaveFd, STDERR_FILENO) != STDERR_FILENO)
   err_exit("ptyFork:dup2-STDERR_FILENO");
   if (slaveFd > STDERR_FILENO) /* Safety check */
   close(slaveFd); /* No longer need this fd */
   return 0; /* Like child of fork() */
  }
  ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pty/pty_fork.c
```

## 64.5 Nhập/Xuất Pseudoterminal (Pseudoterminal I/O)

Một cặp pseudoterminal (pseudoterminal pair) tương tự như một ống lọc (pipe) hai chiều. Bất cứ thứ gì được ghi vào thiết bị master sẽ xuất hiện dưới dạng đầu vào trên thiết bị slave, và bất cứ thứ gì được ghi trên slave sẽ xuất hiện dưới dạng đầu vào trên master.

Điểm phân biệt giữa một cặp pseudoterminal và một pipe hai chiều là phía slave hoạt động giống như một thiết bị terminal. Slave diễn giải dữ liệu đầu vào theo cách giống như một terminal điều khiển (controlling terminal) thông thường diễn giải đầu vào từ bàn phím. Ví dụ, nếu chúng ta ghi một ký tự Control-C (ký tự ngắt terminal thông thường) vào pseudoterminal master, slave sẽ tạo ra một tín hiệu `SIGINT` cho nhóm tiến trình nền trước (foreground process group) của nó. Giống như terminal thông thường, khi một pseudoterminal slave hoạt động ở chế độ canonical (canonical mode - mặc định), đầu vào được đệm theo từng dòng (line by line). Nói cách khác, chương trình đọc từ pseudoterminal slave sẽ chỉ nhìn thấy (một dòng) đầu vào khi chúng ta ghi một ký tự newline vào pseudoterminal master.

Giống như pipe, các pseudoterminal có dung lượng giới hạn. Nếu chúng ta làm cạn kiệt dung lượng này, các thao tác ghi (write) tiếp theo sẽ bị chặn (block) cho đến khi tiến trình ở phía bên kia của pseudoterminal tiêu thụ một số byte dữ liệu.

Trên Linux, dung lượng của pseudoterminal là khoảng 4 kB theo mỗi chiều.

Nếu chúng ta đóng tất cả các file descriptor tham chiếu đến pseudoterminal master, thì:

- Nếu thiết bị slave có một tiến trình điều khiển (controlling process), một tín hiệu `SIGHUP` sẽ được gửi đến tiến trình đó (xem Mục 34.6).
- Thao tác đọc (`read()`) từ thiết bị slave trả về dấu hiệu kết thúc file - end-of-file (0).
- Thao tác ghi (`write()`) vào thiết bị slave thất bại với lỗi `EIO`. (Trên một số hệ thống UNIX khác, `write()` thất bại với lỗi `ENXIO` trong trường hợp này).

Nếu chúng ta đóng tất cả các file descriptor tham chiếu đến pseudoterminal slave, thì:

Thao tác đọc (`read()`) từ thiết bị master thất bại với lỗi `EIO`. (Trên một số hệ thống UNIX khác, thao tác `read()` trả về end-of-file trong trường hợp này).

Thao tác ghi (`write()`) vào thiết bị master thành công, trừ khi hàng đợi đầu vào (input queue) của thiết bị slave đã đầy, trong trường hợp đó `write()` sẽ bị chặn (block). Nếu thiết bị slave sau đó được mở lại, các byte này có thể được đọc.

Các cài đặt UNIX có sự khác biệt lớn về hành vi trong trường hợp cuối cùng này. Trên một số hệ thống UNIX, `write()` thất bại với lỗi `EIO`. Trên các hệ thống khác, `write()` thành công, nhưng các byte đầu ra bị loại bỏ (nghĩa là chúng không thể được đọc nếu slave được mở lại). Nhìn chung, những biến thể này không gây ra vấn đề gì. Thông thường, tiến trình ở phía master phát hiện ra rằng slave đã bị đóng vì thao tác `read()` từ master trả về end-of-file hoặc thất bại. Tại thời điểm này, tiến trình không thực hiện thêm bất kỳ thao tác ghi nào vào master nữa.

### Packet mode (Chế độ gói tin)

Packet mode là một cơ chế cho phép tiến trình (process) đang chạy phía trên một pseudoterminal master (thiết bị giả lập đầu cuối chính) nhận được thông báo khi các sự kiện liên quan đến điều khiển luồng phần mềm (software flow control) xảy ra trên pseudoterminal slave (thiết bị giả lập đầu cuối phụ):

- hàng đợi đầu vào (input queue) hoặc đầu ra (output queue) bị xóa (flushed);
- đầu ra của terminal bị dừng hoặc bắt đầu (Control-S/Control-Q); hoặc
- điều khiển luồng được bật hoặc tắt.

Packet mode hỗ trợ việc xử lý điều khiển luồng phần mềm trong một số ứng dụng pseudoterminal cung cấp dịch vụ đăng nhập mạng (ví dụ: telnet và rlogin).

Packet mode được kích hoạt bằng cách áp dụng thao tác `ioctl()` với cờ `TIOCPKT` lên File Descriptor (mô tả tệp) trỏ tới pseudoterminal master:

```c
int arg;
arg = 1; /* 1 == bật; 0 == tắt */
if (ioctl(mfd, TIOCPKT, &arg) == -1)
 errExit("ioctl");
```

Khi packet mode đang hoạt động, các thao tác đọc (reads) từ pseudoterminal master sẽ trả về hoặc một byte điều khiển khác không duy nhất (là một bit mask biểu thị sự thay đổi trạng thái đã xảy ra trên thiết bị slave), hoặc một byte `0` theo sau bởi một hoặc nhiều byte dữ liệu được ghi trên pseudoterminal slave.

Khi một sự kiện thay đổi trạng thái xảy ra trên pseudoterminal đang hoạt động ở packet mode, hàm `select()` sẽ báo hiệu rằng một ngoại lệ (điều kiện ngoại lệ - ngoại lệ được chỉ định trong tham số `exceptfds`) đã xảy ra trên master, và `poll()` trả về cờ `POLLPRI` trong trường `revents`. (Tham khảo Chương [63](#page-36-0) để biết mô tả chi tiết về `select()` và `poll()`.)

Packet mode không được chuẩn hóa trong SUSv3 và một số chi tiết có thể khác nhau trên các hệ thống UNIX khác. Các chi tiết bổ sung về packet mode trên Linux, bao gồm cả các giá trị bit-mask dùng để biểu thị sự thay đổi trạng thái, có thể được tìm thấy trong trang hướng dẫn (manual page) `tty_ioctl(4)`.

## 64.6 Triển khai lệnh script(1)

Bây giờ chúng ta đã sẵn sàng để triển khai một phiên bản đơn giản của chương trình chuẩn `script(1)`. Chương trình này khởi động một phiên shell mới và ghi lại tất cả dữ liệu đầu vào và đầu ra từ phiên làm việc đó vào một tệp. Hầu hết các phiên shell được minh họa trong cuốn sách này đều được ghi lại bằng cách sử dụng `script`.

Trong một phiên đăng nhập thông thường, shell được kết nối trực tiếp với terminal của người dùng. Khi chúng ta chạy `script`, nó tự đặt chính nó vào giữa terminal của người dùng và shell, đồng thời sử dụng một cặp pseudoterminal để tạo ra một kênh giao tiếp giữa nó và shell (xem [Hình 64-4](#page-101-1)). Shell được kết nối với pseudoterminal slave. Tiến trình `script` được kết nối với pseudoterminal master. Tiến trình `script` đóng vai trò là một proxy cho người dùng, nhận dữ liệu đầu vào được nhập tại terminal và ghi nó vào pseudoterminal master, đồng thời đọc dữ liệu đầu ra từ pseudoterminal master và ghi nó ra terminal của người dùng.

Ngoài ra, `script` tạo ra một tệp đầu ra (mặc định có tên là `typescript`) chứa bản sao của tất cả các byte được xuất ra trên pseudoterminal master. Điều này có tác dụng ghi lại không chỉ đầu ra được tạo ra bởi phiên shell, mà còn cả dữ liệu đầu vào được cung cấp cho nó. Dữ liệu đầu vào được ghi lại bởi vì, giống như một thiết bị terminal thông thường, Kernel (nhân hệ điều hành) sẽ phản hồi lại các ký tự đầu vào (echoes input characters) bằng cách sao chép chúng vào hàng đợi đầu ra của terminal (xem [Hình 62-1,](#page-2-1) ở trang [1291](#page-2-1)). Tuy nhiên, khi tính năng phản hồi đầu ra của terminal (terminal echoing) bị vô hiệu hóa, chẳng hạn như bởi các chương trình đọc mật khẩu, đầu vào của pseudoterminal slave sẽ không bị sao chép vào hàng đợi đầu ra của slave, và do đó không được sao chép vào tệp đầu ra của `script`.

```
            tệp typescript
                   ^
                   |  (được sao chép)
          +--------+--------+                    +--------+--------+        ^
          | tiến trình script|      exec()        |     shell       |        |
          |     stdin       |------------------->|                 |        |   
          |     stdout      |      fork()        +-----------------+        |  User Space
          |     stderr      |                             ^                 |  (Không gian người dùng)
          +----+-------+----+                             |                 |
               ^       ^                                  |                 |
               |       |                                  |                 |
               v       v                                  v                 v
           terminal   pty master  <----------------> pty master             ^
               ^                                                            |  Kernel Space
               |                                                            v  (Không gian nhân)
               v
        người dùng tại terminal
```

**Hình 64-4:** Chương trình script

Việc triển khai chương trình `script` của chúng ta được minh họa trong [Danh sách mã nguồn 64-3](#page-103-0). Chương trình này thực hiện các bước sau:

- Lấy các thuộc tính và kích thước cửa sổ của terminal mà chương trình đang chạy trên đó q. Các thông tin này được truyền vào lời gọi tiếp theo tới hàm `ptyFork()`, hàm này sử dụng chúng để thiết lập các giá trị tương ứng cho thiết bị pseudoterminal slave.
- Gọi hàm `ptyFork()` của chúng ta ([Danh sách mã nguồn 64-2](#page-97-0)) để tạo ra một tiến trình con (child process) được kết nối với tiến trình cha (parent process) thông qua một cặp pseudoterminal w.

- Sau lời gọi `ptyFork()`, tiến trình con (child) thực thi một shell r. Việc lựa chọn shell được quyết định bởi thiết lập của biến môi trường `SHELL` e. Nếu biến `SHELL` không được thiết lập hoặc giá trị của nó là một chuỗi rỗng, thì tiến trình con sẽ thực thi `/bin/sh`.
- Sau lời gọi `ptyFork()`, tiến trình cha (parent) thực hiện các bước sau:
  - Mở tệp kịch bản (script file) đầu ra t. Nếu một đối số dòng lệnh (command-line argument) được cung cấp, nó sẽ được sử dụng làm tên của tệp kịch bản. Nếu không có đối số dòng lệnh nào được cung cấp, tên mặc định `typescript` sẽ được sử dụng.
  - Đặt thiết bị đầu cuối (terminal) ở chế độ thô (raw mode) (sử dụng hàm `ttySetRaw()` được thể hiện trong [Liệt kê 62-3](#page-21-1), ở trang [1310\)](#page-21-1), sao cho tất cả các ký tự đầu vào được chuyển trực tiếp đến chương trình kịch bản mà không bị sửa đổi bởi trình điều khiển terminal (terminal driver) y. Các ký tự xuất ra bởi chương trình kịch bản cũng tương tự như vậy, không bị sửa đổi bởi trình điều khiển terminal.

Việc terminal ở chế độ thô không có nghĩa là các ký tự điều khiển thô, chưa được diễn giải sẽ được truyền đến shell, hoặc bất kỳ nhóm tiến trình (process group) nào khác đang ở foreground (tiền cảnh) đối với thiết bị slave (phụ) của pseudoterminal, cũng như không có nghĩa là dữ liệu đầu ra từ nhóm tiến trình đó được truyền nguyên trạng đến terminal của người dùng. Thay vào đó, việc diễn giải các ký tự đặc biệt của terminal diễn ra bên trong thiết bị slave (trừ khi thiết bị slave cũng được đặt rõ ràng ở chế độ thô bởi một ứng dụng). Bằng cách đặt terminal của người dùng ở chế độ thô, chúng ta ngăn chặn việc xảy ra một vòng diễn giải thứ hai đối với các ký tự đầu vào và đầu ra.

- Gọi `atexit()` để thiết lập một trình xử lý thoát (exit handler) nhằm khôi phục terminal về chế độ ban đầu khi chương trình kết thúc u.
- Thực thi một vòng lặp truyền dữ liệu theo cả hai hướng giữa terminal và master (chính) của pseudoterminal i. Trong mỗi lần lặp, chương trình trước tiên sử dụng `select()` (Mục [63.2.1\)](#page-42-0) để theo dõi cả terminal và pseudoterminal master để chờ dữ liệu đầu vào o. Nếu terminal có dữ liệu đầu vào, chương trình sẽ đọc một phần dữ liệu đó và ghi nó vào pseudoterminal master a. Tương tự, nếu pseudoterminal master có dữ liệu đầu vào, chương trình sẽ đọc một phần dữ liệu đó và ghi nó vào terminal cũng như vào tệp kịch bản s. Vòng lặp tiếp tục chạy cho đến khi gặp lỗi hoặc phát hiện thấy kết thúc tệp (end-of-file) trên một trong các mô tả tệp (file descriptor) đang được giám sát.

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pty/script.c
## include <sys/stat.h>
## include <fcntl.h>
## include <libgen.h>
## include <termios.h>
## include <sys/select.h>
## include "pty_fork.h" /* Khai báo ptyFork() */
## include "tty_functions.h" /* Khai báo ttySetRaw() */
## include "tlpi_hdr.h"
## define BUF_SIZE 256
## define MAX_SNAME 1000
  struct termios ttyOrig;
  static void /* Khôi phục chế độ terminal khi chương trình thoát */
  ttyReset(void)
  {
   if (tcsetattr(STDIN_FILENO, TCSANOW, &ttyOrig) == -1)
   errExit("tcsetattr");
  }
  int
  main(int argc, char *argv[])
  {
   char slaveName[MAX_SNAME];
   char *shell;
   int masterFd, scriptFd;
   struct winsize ws;
   fd_set inFds;
   char buf[BUF_SIZE];
   ssize_t numRead;
   pid_t childPid;
q if (tcgetattr(STDIN_FILENO, &ttyOrig) == -1)
   errExit("tcgetattr");
   if (ioctl(STDIN_FILENO, TIOCGWINSZ, &ws) < 0)
   errExit("ioctl-TIOCGWINSZ");
w childPid = ptyFork(&masterFd, slaveName, MAX_SNAME, &ttyOrig, &ws);
   if (childPid == -1)
   errExit("ptyFork");
   if (childPid == 0) { /* Tiến trình con: thực thi một shell trên pty slave */
e shell = getenv("SHELL");
   if (shell == NULL || *shell == '\0')
   shell = "/bin/sh";
r execlp(shell, shell, (char *) NULL);
   errExit("execlp"); /* Nếu chạy đến đây, đã có lỗi xảy ra */
   }
```

```
 /* Tiến trình cha: chuyển tiếp dữ liệu giữa terminal và pty master */
t scriptFd = open((argc > 1) ? argv[1] : "typescript",
   O_WRONLY | O_CREAT | O_TRUNC,
   S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP |
   S_IROTH | S_IWOTH);
   if (scriptFd == -1)
   errExit("open typescript");
y ttySetRaw(STDIN_FILENO, &ttyOrig);
u if (atexit(ttyReset) != 0)
   errExit("atexit");
i for (;;) {
   FD_ZERO(&inFds);
   FD_SET(STDIN_FILENO, &inFds);
   FD_SET(masterFd, &inFds);
o if (select(masterFd + 1, &inFds, NULL, NULL, NULL) == -1)
   errExit("select");
a if (FD_ISSET(STDIN_FILENO, &inFds)) { /* stdin --> pty */
   numRead = read(STDIN_FILENO, buf, BUF_SIZE);
   if (numRead <= 0)
   exit(EXIT_SUCCESS);
   if (write(masterFd, buf, numRead) != numRead)
   fatal("ghi một phần/thất bại (masterFd)");
   }
s if (FD_ISSET(masterFd, &inFds)) { /* pty --> stdout+file */
   numRead = read(masterFd, buf, BUF_SIZE);
   if (numRead <= 0)
   exit(EXIT_SUCCESS);
   if (write(STDOUT_FILENO, buf, numRead) != numRead)
   fatal("ghi một phần/thất bại (STDOUT_FILENO)");
   if (write(scriptFd, buf, numRead) != numRead)
   fatal("ghi một phần/thất bại (scriptFd)");
   }
   }
  }
  –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– pty/script.c
```

Trong phiên shell tiếp theo, chúng tôi minh họa việc sử dụng chương trình trong [Liệt kê 64-3](#page-103-0). Chúng ta bắt đầu bằng cách hiển thị tên của pseudoterminal được sử dụng bởi xterm – nơi shell đăng nhập đang chạy – và ID tiến trình (process ID) của shell đăng nhập đó. Thông tin này sẽ hữu ích sau này trong phiên shell.

```
$ tty
/dev/pts/1
$ echo $$
7979
```

Sau đó, chúng ta khởi chạy một thể hiện (instance) của chương trình script, chương trình này gọi một subshell (shell con). Một lần nữa, chúng ta hiển thị tên của terminal mà shell đang chạy và Process ID (PID) của shell đó:

```
$ ./script
$ tty
/dev/pts/24 Pseudoterminal slave opened by script
$ echo $$
29825 PID of subshell process started by script
```

Bây giờ chúng ta sử dụng `ps(1)` để hiển thị thông tin về hai shell và tiến trình (process) đang chạy script, sau đó chấm dứt (terminate) shell do script khởi chạy:

```
$ ps -p 7979 -p 29825 -C script -o "pid ppid sid tty cmd"
 PID PPID SID TT CMD
 7979 7972 7979 pts/1 /bin/bash
29824 7979 7979 pts/1 ./script
29825 29824 29825 pts/24 /bin/bash
$ exit
```

Đầu ra của `ps(1)` cho thấy mối quan hệ cha-con (parent-child relationship) giữa login shell (shell đăng nhập), tiến trình đang chạy script, và subshell do script khởi chạy.

Tại thời điểm này, chúng ta đã quay trở lại login shell. Việc hiển thị nội dung của tệp `typescript` cho thấy bản ghi của toàn bộ đầu vào (input) và đầu ra (output) được tạo ra trong khi script đang chạy:

```
$ cat typescript
$ tty
/dev/pts/24
$ echo $$
29825
$ ps -p 7979 -p 29825 -C script -o "pid ppid sid tty cmd"
 PID PPID SID TT CMD
 7979 7972 7979 pts/1 /bin/bash
29824 7979 7979 pts/1 ./script
29825 29824 29825 pts/24 /bin/bash
$ exit
```

## 64.7 Thuộc tính Terminal và Kích thước Cửa sổ

Thiết bị master và slave chia sẻ các cấu trúc thuộc tính terminal (`termios`) và kích thước cửa sổ (`winsize`). (Cả hai cấu trúc này được mô tả trong Chương [62.](#page-0-0)) Điều này có nghĩa là chương trình chạy ở phía trên pseudoterminal master có thể thay đổi các thuộc tính này cho pseudoterminal slave bằng cách áp dụng `tcsetattr()` và `ioctl()` lên File Descriptor (mô tả tệp) của thiết bị master.

Một ví dụ về việc thay đổi thuộc tính terminal hữu ích là trong chương trình script. Giả lập rằng chúng ta đang chạy script trong một cửa sổ terminal emulator (trình giả lập terminal), và chúng ta thay đổi kích thước của cửa sổ đó. Trong trường hợp này, chương trình terminal emulator sẽ thông báo cho kernel về sự thay đổi kích thước của thiết bị terminal tương ứng, nhưng sự thay đổi này không được phản ánh trong bản ghi riêng của kernel dành cho pseudoterminal slave (xem [Hình 64-4](#page-101-1)). Kết quả là, các chương trình hướng màn hình (ví dụ: `vi`) chạy ở phía trên pseudoterminal slave sẽ tạo ra đầu ra gây nhầm lẫn, vì hiểu biết của chúng về kích thước cửa sổ terminal khác với kích thước thực tế của terminal. Chúng ta có thể giải quyết vấn đề này như sau:

- 1. Cài đặt một trình xử lý tín hiệu (signal handler) cho `SIGWINCH` trong tiến trình cha của script, để nó nhận được tín hiệu khi kích thước của cửa sổ terminal thay đổi.
- 2. Khi tiến trình cha của script nhận được tín hiệu `SIGWINCH`, nó sử dụng thao tác `ioctl()` với lệnh `TIOCGWINSZ` để truy xuất cấu trúc `winsize` cho cửa sổ terminal liên kết với standard input (đầu vào chuẩn) của nó. Sau đó, nó sử dụng cấu trúc này trong thao tác `ioctl()` với lệnh `TIOCSWINSZ` để thiết lập kích thước cửa sổ của pseudoterminal master.
- 3. Nếu kích thước cửa sổ pseudoterminal mới khác với kích thước cũ, kernel sẽ tạo ra một tín hiệu `SIGWINCH` cho foreground process group (nhóm tiến trình dạng nền trước) của pseudoterminal slave. Các chương trình quản lý màn hình như `vi` được thiết kế để bắt tín hiệu này và thực hiện thao tác `ioctl()` với lệnh `TIOCGWINSZ` nhằm cập nhật hiểu biết của chúng về kích thước cửa sổ terminal.

Chúng tôi đã mô tả chi tiết về kích thước cửa sổ terminal và các thao tác `ioctl()` `TIOCGWINSZ` cũng như `TIOCSWINSZ` trong Mục [62.9.](#page-30-1)

```

## 64.8 Pseudoterminal BSD

Trong phần lớn chương này, chúng ta đã tập trung vào pseudoterminal theo chuẩn UNIX 98, vì đây là kiểu pseudoterminal được chuẩn hóa trong SUSv3 và do đó nên được sử dụng trong mọi chương trình mới. Tuy nhiên, đôi khi chúng ta có thể bắt gặp pseudoterminal BSD trong các ứng dụng cũ (older application) hoặc khi port (chuyển cảng/chuyển đổi) chương trình sang Linux từ các hệ triển khai UNIX khác. Do đó, bây giờ chúng ta sẽ xem xét các chi tiết về pseudoterminal BSD.

> Việc sử dụng pseudoterminal BSD đã bị coi là lỗi thời (deprecated) trên Linux. Kể từ Linux 2.6.4 trở đi, hỗ trợ pseudoterminal BSD là một thành phần kernel tùy chọn có thể được cấu hình thông qua tùy chọn `CONFIG_LEGACY_PTYS`.

Pseudoterminal BSD chỉ khác biệt so với các phiên bản UNIX 98 tương đương ở chi tiết cách tìm kiếm và mở thiết bị master (pseudoterminal master) và slave (pseudoterminal slave). Một khi master và slave đã được mở, pseudoterminal BSD hoạt động theo cùng cách thức như pseudoterminal UNIX 98.

Với pseudoterminal UNIX 98, chúng ta lấy một pseudoterminal master chưa sử dụng bằng cách gọi hàm `posix_openpt()`, hàm này mở `/dev/ptmx` — thiết bị nhân bản master của pseudoterminal (pseudoterminal master clone device). Sau đó, chúng ta lấy tên của pseudoterminal slave tương ứng bằng cách sử dụng hàm `ptsname()`. Ngược lại, với pseudoterminal BSD, các cặp thiết bị master và slave là những entry được tạo trước trong thư mục `/dev`. Mỗi thiết bị master có tên dạng `/dev/ptyxy`, trong đó `x` được thay thế bằng một ký tự trong phạm vi 16 ký tự `[p-za-e]` và `y` được thay thế bằng một ký tự trong phạm vi 16 ký tự `[0-9a-f]`. Thiết bị slave tương ứng với một pseudoterminal master cụ thể có tên dạng `/dev/ttyxy`. Do đó, ví dụ, các thiết bị `/dev/ptyp0` và `/dev/ttyp0` tạo thành một cặp pseudoterminal BSD.

> Các hệ triển khai UNIX khác nhau về số lượng và tên của các cặp pseudoterminal BSD mà chúng cung cấp, với một số hệ thống chỉ cung cấp vỏn vẹn 32 cặp theo mặc định. Hầu hết các hệ triển khai đều cung cấp ít nhất 32 thiết bị master có tên nằm trong khoảng `/dev/pty[pq][0-9a-f]`, cùng với các thiết bị slave tương ứng.

Để tìm một cặp pseudoterminal chưa sử dụng, chúng ta thực hiện một vòng lặp (loop) cố gắng mở từng thiết bị master lần lượt cho đến khi mở thành công một thiết bị. Trong quá trình thực hiện vòng lặp này, có hai lỗi mà chúng ta có thể gặp phải khi gọi hàm `open()`:

- Nếu tên thiết bị master cho trước không tồn tại, hàm `open()` sẽ thất bại với mã lỗi `ENOENT`. Thông thường, điều này có nghĩa là chúng ta đã duyệt qua toàn bộ tập hợp tên pseudoterminal master trên hệ thống mà không tìm thấy thiết bị nào trống (tức là không có đủ dải thiết bị đầy đủ được liệt kê ở trên).
- Nếu thiết bị master đang được sử dụng, hàm `open()` sẽ thất bại với mã lỗi `EIO`. Chúng ta có thể bỏ qua lỗi này và thử thiết bị tiếp theo.

Trên HP-UX 11, hàm `open()` thất bại với mã lỗi `EBUSY` khi cố gắng mở một pseudoterminal master BSD đang được sử dụng.

Khi đã tìm thấy một thiết bị master khả dụng, chúng ta có thể lấy tên của thiết bị slave tương ứng bằng cách thay thế `pty` bằng `tty` trong tên của master. Sau đó, chúng ta có thể mở thiết bị slave bằng hàm `open()`.

> Với pseudoterminal BSD, không có cơ chế tương đương với hàm `grantpt()` để thay đổi quyền sở hữu (ownership) và quyền truy cập (permissions) của pseudoterminal slave. Nếu chúng ta cần làm điều này, chúng ta phải thực hiện các lời gọi tường minh đến hàm `chown()` (chỉ có thể trong một chương trình có đặc quyền - privileged program) và hàm `chmod()`, hoặc viết một chương trình set-user-ID (giống như `pt_chown`) để thực hiện tác vụ này cho một chương trình không có đặc quyền (unprivileged program).

[Listing 64-4](#page-107-0) minh họa việc triển khai lại hàm `ptyMasterOpen()` ở Mục [64.3](#page-94-0) bằng cách sử dụng pseudoterminal BSD. Việc thay thế bản cài đặt này là tất cả những gì cần thiết để làm cho chương trình script của chúng ta (Mục [64.6](#page-101-0)) hoạt động với pseudoterminal BSD.

**Listing 64-4:** Triển khai hàm `ptyMasterOpen()` sử dụng pseudoterminal BSD

```

––––––––––––––––––––––––––––––––––––––––––––––––– pty/pty_master_open_bsd.c

## include <fcntl.h>

## include "pty_master_open.h" /* Declares ptyMasterOpen() */

## include "tlpi_hdr.h"

## define PTYM_PREFIX "/dev/pty"

## define PTYS_PREFIX "/dev/tty"

## define PTY_PREFIX_LEN (sizeof(PTYM_PREFIX) - 1)

## define PTY_NAME_LEN (PTY_PREFIX_LEN + sizeof("XY"))

## define X_RANGE "pqrstuvwxyzabcde"

## define Y_RANGE "0123456789abcdef"

int
ptyMasterOpen(char *slaveName, size_t snLen)
{
int masterFd, n;
char *x, *y;
char masterName[PTY_NAME_LEN];
if (PTY_NAME_LEN > snLen) {
errno = EOVERFLOW;
return -1;
}

```

```

memset(masterName, 0, PTY_NAME_LEN);
strncpy(masterName, PTYM_PREFIX, PTY_PREFIX_LEN);
for (x = X_RANGE; *x != '\0'; x++) {
masterName[PTY_PREFIX_LEN] = *x;
for (y = Y_RANGE; *y != '\0'; y++) {
masterName[PTY_PREFIX_LEN + 1] = *y;
masterFd = open(masterName, O_RDWR);
if (masterFd == -1) {
if (errno == ENOENT) /* No such file */
return -1; /* Probably no more pty devices */
else /* Other error (e.g., pty busy) */
continue;
} else { /* Return slave name corresponding to master */
n = snprintf(slaveName, snLen, "%s%c%c", PTYS_PREFIX, *x, *y);
if (n >= snLen) {
errno = EOVERFLOW;
return -1;
} else if (n == -1) {
return -1;
}
return masterFd;
}
}
}
return -1; /* Tried all ptys without success */
}
––––––––––––––––––––––––––––––––––––––––––––––––– pty/pty_master_open_bsd.c

```

## 64.9 Tóm tắt

Một cặp thiết bị giả lập đầu cuối (pseudoterminal pair) bao gồm một thiết bị điều khiển (master device) và một thiết bị phụ (slave device) được kết nối với nhau. Cùng nhau, hai thiết bị này cung cấp một kênh IPC (Interprocess Communication) hai chiều. Ưu điểm của pseudoterminal là ở phía thiết bị slave của cặp thiết bị này, chúng ta có thể kết nối một chương trình hướng đầu cuối (terminal-oriented program) được điều khiển bởi chương trình đã mở thiết bị master. Thiết bị slave của pseudoterminal hoạt động giống hệt như một thiết bị terminal thông thường. Tất cả các thao tác có thể áp dụng cho một terminal thông thường đều có thể áp dụng cho slave, và dữ liệu đầu vào được truyền từ master sang slave được hiểu theo cách tương tự như dữ liệu đầu vào từ bàn phím trên một terminal thông thường.

Một ứng dụng phổ biến của pseudoterminal là trong các ứng dụng cung cấp dịch vụ đăng nhập mạng (network login services). Tuy nhiên, pseudoterminal cũng được sử dụng trong nhiều chương trình khác, chẳng hạn như các trình giả lập đầu cuối (terminal emulator) và chương trình `script(1)`.

Các API pseudoterminal khác nhau đã xuất hiện trên System V và BSD. Linux hỗ trợ cả hai API này, nhưng API của System V tạo thành nền tảng cho API pseudoterminal được chuẩn hóa trong SUSv3.

## 64.10 Bài tập

- **64-1.** Tiến trình cha `script` và tiến trình con shell kết thúc theo thứ tự nào khi người dùng gõ ký tự kết thúc file (thường là Control-D) trong lúc đang chạy chương trình trong [Listing 64-3?](#page-103-0) Tại sao?
- **64-2.** Thực hiện các sửa đổi sau đối với chương trình trong [Listing 64-3](#page-103-0) (`script.c`):
  - a) Chương trình `script(1)` tiêu chuẩn thêm các dòng vào phần đầu và phần cuối của file đầu ra cho biết thời điểm script bắt đầu và kết thúc. Hãy thêm tính năng này.
  - b) Thêm mã nguồn để xử lý các thay đổi về kích thước cửa sổ terminal như được mô tả trong Mục [64.7](#page-105-0). Bạn có thể thấy chương trình trong [Listing 62-5](#page-31-1) (`demo_SIGWINCH.c`) hữu ích cho việc kiểm tra tính năng này.
- **64-3.** Sửa đổi chương trình trong [Listing 64-3](#page-103-0) (`script.c`) để thay thế việc sử dụng `select()` bằng một cặp tiến trình: một tiến trình để xử lý việc truyền dữ liệu từ terminal sang pseudoterminal master, và tiến trình còn lại để xử lý việc truyền dữ liệu theo hướng ngược lại.
- **64-4.** Sửa đổi chương trình trong [Listing 64-3](#page-103-0) (`script.c`) để bổ sung tính năng ghi lại kèm dấu thời gian (time-stamped recording). Mỗi khi chương trình ghi một chuỗi vào file typescript, nó đồng thời phải ghi một chuỗi có gắn dấu thời gian vào file thứ hai (ví dụ: `typescript.timed`). Các bản ghi (record) được ghi vào file thứ hai này có thể có dạng tổng quát sau:

```

<timestamp> <space> <string> <newline>

```

Dấu thời gian nên được ghi lại dưới dạng văn bản là số mili-giây kể từ khi phiên script bắt đầu. Việc ghi dấu thời gian dưới dạng văn bản có ưu điểm là file kết quả có thể đọc được bằng con người (human-readable). Bên trong chuỗi, các ký tự xuống dòng thực tế sẽ cần phải được thoát (escape). Một khả năng là ghi lại ký tự xuống dòng dưới dạng chuỗi 2 ký tự `\n` và dấu gạch chéo ngược dưới dạng `\\`.

Viết chương trình thứ hai, `script_replay.c`, đọc file script có gắn dấu thời gian và hiển thị nội dung của nó ra đầu ra chuẩn (standard output) với tốc độ giống như khi chúng được ghi ban đầu. Cùng nhau, hai chương trình này cung cấp một tính năng ghi âm và phát lại đơn giản cho nhật ký phiên shell (shell session log).

- **64-5.** Thực thi các chương trình client và server để cung cấp tính năng đăng nhập từ xa kiểu telnet đơn giản. Thiết kế server để xử lý các client đồng thời (concurrently) (Mục 60.1). [Hình 64-3](#page-89-0) cho thấy thiết lập cần được thiết lập cho mỗi lần đăng nhập của client. Điều không được hiển thị trong sơ đồ đó là tiến trình server cha, xử lý các kết nối socket đến từ client và tạo ra một server con để xử lý từng kết nối. Lưu ý rằng toàn bộ công việc xác thực người dùng (authenticate) và khởi động login shell có thể được xử lý trong mỗi server con bằng cách để tiến trình (cháu) con được tạo bởi `ptyFork()` tiếp tục gọi `exec login(1)`.
- **64-6.** Thêm mã nguồn vào chương trình được phát triển trong bài tập trước để cập nhật các file kế toán đăng nhập (login accounting files) ở đầu và cuối phiên đăng nhập (Chương 40).
- **64-7.** Giả sử chúng ta thực thi một chương trình chạy lâu (long-running program) tạo ra đầu ra một cách chậm chạp và được chuyển hướng (redirect) đến một file hoặc pipe, như trong ví dụ này:
  - \$ **longrunner | grep str**

Một vấn đề với kịch bản trên là theo mặc định, gói stdio chỉ xả (flush) đầu ra chuẩn khi bộ đệm stdio (stdio buffer) đầy. Điều này có nghĩa là đầu ra từ chương trình `longrunner` sẽ xuất hiện theo từng đợt (burst) cách nhau bởi các khoảng thời gian dài. Một cách để tránh vấn đề này là viết một chương trình thực hiện những việc sau:

- a) Tạo một pseudoterminal.
- b) Thực thi (`exec`) chương trình được chỉ định trong các tham số dòng lệnh (command-line arguments) của nó với các file descriptor chuẩn được kết nối với pseudoterminal slave.
- c) Đọc đầu ra từ pseudoterminal master và ghi nó ngay lập tức vào đầu ra chuẩn (`STDOUT_FILENO`, file descriptor 1), và đồng thời, đọc đầu vào từ terminal và ghi nó vào pseudoterminal master, để nó có thể được đọc bởi chương trình được `exec`.

Một chương trình như vậy, mà chúng ta sẽ gọi là `unbuffer`, sẽ được sử dụng như sau:

### \$ **./unbuffer longrunner | grep str**

Hãy viết chương trình `unbuffer`. (Phần lớn mã nguồn cho chương trình này sẽ tương tự như [Listing 64-3.](#page-103-0))

**64-8.** Viết một chương trình triển khai một ngôn ngữ kịch bản (scripting language) có thể được sử dụng để điều khiển `vi` ở chế độ không tương tác (noninteractive mode). Vì `vi` yêu cầu được chạy từ một terminal, chương trình sẽ cần sử dụng một terminal giả lập (pseudoterminal).
