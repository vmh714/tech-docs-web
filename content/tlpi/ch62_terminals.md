# Chương 62: Thiết bị đầu cuối (Terminals)

Về mặt lịch sử, người dùng truy cập hệ thống UNIX bằng cách sử dụng một terminal được kết nối qua đường truyền nối tiếp (serial line) (kết nối RS-232). Terminal là các ống tia âm cực (Cathode Ray Tube - CRT) có khả năng hiển thị ký tự và trong một số trường hợp là đồ họa sơ khai. Thông thường, CRT cung cấp màn hình đơn sắc gồm 24 dòng và 80 cột. Theo tiêu chuẩn ngày nay, các màn hình CRT đó vừa nhỏ vừa đắt đỏ. Thậm chí trong thời kỳ đầu hơn, terminal đôi khi là các thiết bị teletype in giấy cứng (hard-copy). Các đường truyền nối tiếp cũng được sử dụng để kết nối các thiết bị khác, chẳng hạn như máy in và modem, với máy tính hoặc để kết nối máy tính này với máy tính khác.

> [!NOTE]
> Trên các hệ thống UNIX thời kỳ đầu, các đường terminal kết nối với hệ thống được thể hiện bằng các thiết bị ký tự (character device) có tên dạng `/dev/ttyn`. (Trên Linux, các thiết bị `/dev/ttyn` là các console ảo trên hệ thống.) Viết tắt `tty` (bắt nguồn từ teletype) thường được dùng làm từ viết tắt cho terminal.

Đặc biệt trong những năm đầu của UNIX, các thiết bị terminal không được tiêu chuẩn hóa, điều đó có nghĩa là cần có các chuỗi ký tự khác nhau để thực hiện các thao tác như di chuyển con trỏ về đầu dòng hoặc đầu màn hình. (Cuối cùng, một số phần cài đặt chuỗi thoát (escape sequence) của nhà vendor — ví dụ: VT-100 của Digital — đã trở thành tiêu chuẩn thực tế (de facto) và cuối cùng là tiêu chuẩn ANSI, nhưng vẫn tiếp tục tồn tại rất nhiều loại terminal khác nhau.) Sự thiếu tiêu chuẩn hóa này có nghĩa là rất khó để viết các chương trình di động (portable program) sử dụng các tính năng của terminal. Trình soạn thảo `vi` là một ví dụ điển hình thời kỳ đầu về một chương trình có các yêu cầu như vậy. Cơ sở dữ liệu `termcap` và `terminfo` (được mô tả trong [Strang et al., 1988]), chuyên lập bảng cách thực hiện các thao tác điều khiển màn hình khác nhau cho rất nhiều loại terminal, và thư viện `curses` ([Strang, 1986]) được phát triển để đáp ứng lại sự thiếu tiêu chuẩn hóa này.

Ngày nay, việc nhìn thấy một terminal thông਼ thường không còn phổ biến nữa. Giao diện thông thường đối với các hệ thống UNIX hiện đại là một trình quản lý cửa sổ X Window System trên màn hình đồ họa ánh-xạ-bit (bit-mapped) hiệu năng cao. (Một terminal kiểu cũ cung cấp chức năng tương đương với một cửa sổ terminal đơn lẻ — như `xterm` hoặc tương tự — trong X Window System. Thực tế là người dùng của một terminal như vậy chỉ có một "cửa sổ" duy nhất để thao tác với hệ thống chính là động lực đằng sau việc phát triển các cơ chế điều khiển tiến trình (job-control) được mô tả trong Mục 34.7.) Tương tự, nhiều thiết bị (ví dụ: máy in) trước đây từng được kết nối trực tiếp với máy tính thì nay thường là các thiết bị thông minh được kết nối qua mạng.

Tất cả những điều trên là phần mở đầu để nói rằng nhu cầu lập trình cho các thiết bị terminal nay đã ít thường xuyên hơn trước. Do đó, chương này tập trung vào các khía cạnh lập trình terminal có liên quan đặc biệt đến các trình giả lập terminal bằng phần mềm (software terminal emulator) (tức là `xterm` và các phần mềm tương tự). Chương này chỉ trình bày ngắn gọn về các đường truyền nối tiếp; các tài liệu tham khảo để tìm hiểu thêm về lập trình nối tiếp được cung cấp ở phần cuối của chương này.

## 62.1 Tổng quan

Cả terminal thông thường lẫn terminal giả lập (terminal emulator) đều có một trình điều khiển terminal (terminal driver) đi kèm để xử lý quá trình nhập và xuất trên thiết bị. (Trong trường hợp của terminal emulator, thiết bị là một terminal giả - pseudoterminal. Chúng ta sẽ mô tả pseudoterminal ở Chương [64](#page-86-0).) Nhiều khía cạnh hoạt động khác nhau của terminal driver có thể được điều khiển bằng cách sử dụng các hàm được mô tả trong chương này.

Khi thực hiện việc nhập dữ liệu (input), driver có khả năng hoạt động ở một trong hai chế độ sau:

- Chế độ chuẩn (Canonical mode): Ở chế độ này, dữ liệu nhập từ terminal được xử lý theo từng dòng và tính năng chỉnh sửa dòng được bật. Các dòng được kết thúc bằng một ký tự xuống dòng (newline character), được tạo ra khi người dùng nhấn phím Enter. Lệnh gọi `read()` từ terminal chỉ trả về khi có sẵn một dòng dữ liệu hoàn chỉnh, và trả về tối đa một dòng. (Nếu lệnh `read()` yêu cầu ít byte hơn số byte có sẵn trong dòng hiện tại, thì các byte còn lại sẽ dành cho lần gọi `read()` tiếp theo.) Đây là chế độ nhập mặc định.
- Chế độ phi chuẩn (Noncanonical mode): Dữ liệu nhập từ terminal không được gom thành các dòng. Các chương trình như `vi`, `more`, và `less` đưa terminal về chế độ phi chuẩn để chúng có thể đọc từng ký tự đơn lẻ mà người dùng không cần phải nhấn phím Enter.

Terminal driver cũng thông dịch một loạt các ký tự đặc biệt, chẳng hạn như ký tự ngắt (interrupt character - thông thường là Control-C) và ký tự kết thúc tập tin (end-of-file character - thông thường là Control-D). Việc thông dịch như vậy có thể dẫn đến việc một tín hiệu (signal) được tạo ra cho nhóm tiến trình tiền cảnh (foreground process group) hoặc một loại điều kiện đầu vào nào đó xảy ra đối với chương trình đang đọc từ terminal. Các chương trình đưa terminal vào chế độ phi chuẩn thường cũng vô hiệu hóa việc xử lý một số hoặc toàn bộ các ký tự đặc biệt này.

Một terminal driver vận hành hai hàng đợi (queue) (Hình 62-1): một cho các ký tự đầu vào được truyền từ thiết bị terminal đến (các) tiến trình đọc và hàng đợi còn lại cho các ký tự đầu xuất được truyền từ các tiến trình đến terminal. Nếu tính năng vọng lại của terminal (terminal echoing) được bật, thì terminal driver sẽ tự động nối thêm một bản sao của bất kỳ ký tự đầu vào nào vào cuối hàng đợi đầu xuất, sao cho các ký tự đầu vào cũng xuất hiện trên terminal.

> [!NOTE]
> SUSv3 quy định giới hạn `MAX_INPUT`, mà một bản cài đặt (implementation) có thể sử dụng để chỉ ra độ dài tối đa của hàng đợi đầu vào của terminal. Một giới hạn liên quan là `MAX_CANON`, xác định số lượng byte tối đa trong một dòng đầu vào ở chế độ chuẩn. Trên Linux, `sysconf(_SC_MAX_INPUT)` và `sysconf(_SC_MAX_CANON)` đều trả về giá trị 255. Tuy nhiên, không có giới hạn nào trong số này thực sự được kernel sử dụng; thay vào đó, kernel chỉ đơn giản áp dụng giới hạn 4096 byte cho hàng đợi đầu vào. Một giới hạn tương ứng về kích thước của hàng đợi đầu xuất cũng tồn tại. Tuy nhiên, các ứng dụng không cần phải bận tâm về điều này, bởi vì nếu một tiến trình tạo ra dữ liệu đầu xuất nhanh hơn mức terminal driver có thể xử lý, kernel sẽ tạm dừng việc thực thi tiến trình ghi cho đến khi lại có không gian trống trong hàng đợi đầu xuất.

> [!NOTE]
> Trên Linux, chúng ta có thể gọi `ioctl(fd, FIONREAD, &cnt)` để lấy số lượng byte chưa đọc trong hàng đợi đầu vào của terminal được trỏ bởi file descriptor `fd`. Tính năng này không được quy định trong SUSv3.

```
                         +---------------------------------+
                         |   Process(es) performing I/O    | 
                         +-------------+-------------------+
                         |                                 ^
  characters read by     |                                 |    characters written by
  process                |                                 |        process
                         |                                 |
          +--------------v---------------------------------|----------------------+
          |                             Terminal driver                           |
          |                                                                       |
          |   +---------------------+ if echoing enabled +---------------------+  |
          |   |     Input queue     | ------------------>|     Input queue     |  |
          |   +---------------------+                    +---------------------+  |      
          +-------------^-------------------------------------------|-------------+        
                        |                                           |
                        |               +-------------+             |
                        +---------------| Terminal    |<------------+
                                        | device      |
                                        +-------------+
```

**Hình 62-1:** Các hàng đợi đầu vào và đầu xuất cho một thiết bị terminal

## 62.2 Truy xuất và Sửa đổi Thuộc tính Terminal

Các hàm `tcgetattr()` và `tcsetattr()` thực hiện việc truy xuất và sửa đổi các thuộc tính của một terminal.

```c
## include <termios.h>
int tcgetattr(int fd, struct termios *termios_p);
int tcsetattr(int fd, int optional_actions, const struct termios *termios_p);
                                         /* Cả hai đều trả về 0 khi thành công, hoặc –1 khi lỗi */
```

Tham số `fd` là một mô tả tệp (File Descriptor) trỏ đến một terminal. (Nếu `fd` không trỏ đến terminal, các hàm này sẽ thất bại với mã lỗi `ENOTTY`.)

Tham số `termios_p` là một con trỏ tới cấu trúc `termios`, nơi lưu trữ các thuộc tính của terminal:

```
struct termios {
 tcflag_t c_iflag; /* Cờ đầu vào (Input flags) */
 tcflag_t c_oflag; /* Cờ đầu ra (Output flags) */
 tcflag_t c_cflag; /* Cờ điều khiển (Control flags) */
 tcflag_t c_lflag; /* Chế độ cục bộ (Local modes) */
 cc_t c_line; /* Kỷ luật dòng - Line discipline (phi chuẩn)*/
 cc_t c_cc[NCCS]; /* Ký tự đặc biệt của terminal */
 speed_t c_ispeed; /* Tốc độ đầu vào (phi chuẩn; không sử dụng) */
 speed_t c_ospeed; /* Tốc độ đầu ra (phi chuẩn; không sử dụng) */
};
```

Bốn trường đầu tiên của cấu trúc `termios` là các mặt nạ bit (bit mask) (kiểu dữ liệu `tcflag_t` là một kiểu số nguyên có kích thước phù hợp) chứa các cờ điều khiển các khía cạnh khác nhau trong hoạt động của trình điều khiển terminal (terminal driver):

- `c_iflag` chứa các cờ điều khiển đầu vào của terminal;
- `c_oflag` chứa các cờ điều khiển đầu ra của terminal;
- `c_cflag` chứa các cờ liên quan đến việc điều khiển phần cứng của đường truyền terminal; và
- `c_lflag` chứa các cờ điều khiển giao diện người dùng cho đầu vào của terminal.

Tất cả các cờ được sử dụng trong các trường trên được liệt kê trong Bảng 62-2 (trang 1302).

Trường `c_line` chỉ định kỷ luật dòng (line discipline) cho terminal này. Đối với mục đích lập trình trình giả lập terminal (terminal emulator), line discipline sẽ luôn được đặt thành `N_TTY`, cái gọi là kỷ luật mới (new discipline), một thành phần trong mã xử lý terminal của kernel thực hiện xử lý I/O chế độ chuẩn tắc (canonical mode I/O processing). Việc thiết lập line discipline có thể quan trọng khi lập trình các đường truyền nối tiếp (serial line).

Mảng `c_cc` chứa các ký tự đặc biệt của terminal (ngắt, tạm dừng, v.v.) cũng như các trường điều khiển hoạt động của đầu vào chế độ phi chuẩn tắc (noncanonical mode input). Kiểu dữ liệu `cc_t` là một kiểu số nguyên không dấu thích hợp để chứa các giá trị này, và hằng số `NCCS` chỉ định số lượng phần tử trong mảng này. Chúng ta sẽ mô tả các ký tự đặc biệt của terminal trong Mục [62.4.](#page-7-0)

Các trường `c_ispeed` và `c_ospeed` không được sử dụng trên Linux (và không được chỉ định trong SUSv3). Chúng tôi giải thích cách Linux lưu trữ tốc độ đường truyền terminal trong Mục [62.7.](#page-27-0)

> [!NOTE]
> Trình điều khiển terminal (thường gọi là tty driver) trong Phiên bản thứ bảy (Seventh Edition) và các hệ thống BSD thời kỳ đầu đã phình to theo thời gian đến mức nó sử dụng không dưới bốn cấu trúc dữ liệu khác nhau để biểu diễn thông tin tương đương với cấu trúc `termios`. System V đã thay thế cơ chế phức tạp này bằng một cấu trúc duy nhất có tên là `termios`. Ủy ban POSIX ban đầu đã chọn API của System V gần như nguyên trạng, đồng thời đổi tên nó thành `termios`.

Khi thay đổi các thuộc tính terminal bằng `tcsetattr()`, tham số `optional_actions` xác định thời điểm thay đổi có hiệu lực. Tham số này được chỉ định bằng một trong các giá trị sau:

### TCSANOW

Thay đổi được thực hiện ngay lập tức.

### TCSADRAIN

Thay đổi có hiệu lực sau khi tất cả dữ liệu đầu ra đang chờ trong hàng đợi đã được truyền đến terminal. Thông thường, cờ này nên được chỉ định khi thực hiện các thay đổi ảnh hưởng đến đầu ra của terminal, để chúng ta không làm ảnh hưởng đến phần đầu ra đã nằm trong hàng đợi nhưng chưa được hiển thị.

### TCSAFLUSH

Thay đổi có hiệu lực tương tự như `TCSADRAIN`, nhưng ngoài ra, bất kỳ dữ liệu đầu vào nào vẫn đang chờ xử lý tại thời điểm thay đổi có hiệu lực sẽ bị hủy bỏ. Điều này rất hữu ích, ví dụ, khi đọc mật khẩu, nơi chúng ta muốn vô hiệu hóa tính năng lặp lại ký tự (terminal echoing) và ngăn người dùng gõ phím trước (type-ahead).

Cách thông thường (và được khuyến nghị) để thay đổi thuộc tính terminal là sử dụng `tcgetattr()` để truy xuất cấu trúc `termios` chứa bản sao các thiết lập hiện tại, thay đổi các thuộc tính mong muốn, và sau đó sử dụng `tcsetattr()` để đẩy cấu trúc đã cập nhật trở lại trình điều khiển. (Cách tiếp cận này đảm bảo rằng chúng ta truyền một cấu trúc đã được khởi tạo đầy đủ cho `tcsetattr()`.) Ví dụ, chúng ta có thể sử dụng chuỗi lệnh sau để tắt tính năng lặp lại ký tự của terminal:

```
struct termios tp;
if (tcgetattr(STDIN_FILENO, &tp) == -1)
 errExit("tcgetattr");
tp.c_lflag &= ~ECHO;
if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &tp) == -1)
 errExit("tcsetattr");
```

Hàm `tcsetattr()` trả về thành công nếu bất kỳ thay đổi nào được yêu cầu đối với thuộc tính terminal có thể được thực hiện; nó chỉ thất bại khi không có thay đổi nào trong số các yêu cầu có thể thực hiện được. Điều này có nghĩa là, khi thực hiện nhiều thay đổi thuộc tính cùng lúc, đôi khi cần phải gọi thêm `tcgetattr()` để truy xuất các thuộc tính terminal mới và so sánh chúng với các thay đổi đã yêu cầu.

> [!NOTE]
> Trong Mục 34.7.2, chúng ta đã lưu ý rằng nếu `tcsetattr()` được gọi từ một tiến trình nằm trong một nhóm tiến trình nền (background process group), thì trình điều khiển terminal sẽ tạm dừng nhóm tiến trình đó bằng cách gửi tín hiệu `SIGTTOU`, và nếu được gọi từ một nhóm tiến trình mồ côi (orphaned process group), `tcsetattr()` sẽ thất bại với mã lỗi `EIO`. Các phát biểu tương tự cũng áp dụng cho nhiều hàm khác được mô tả trong chương này, bao gồm `tcflush()`, `tcflow()`, `tcsendbreak()` và `tcdrain()`.

> [!NOTE]
> Trong các cài đặt UNIX trước đây, các thuộc tính của thiết bị đầu cuối (terminal attributes) được truy cập thôngging qua các lời gọi `ioctl()` (`ioctl() calls`). Giống như một số hàm khác được mô tả trong chương này, các hàm `tcgetattr()` và `tcsetattr()` là những phát minh của POSIX được thiết kế để giải quyết vấn đề kiểm tra kiểu dữ liệu (type checking) của đối số thứ ba trong `ioctl()` là không thể thực hiện được. Trên Linux, cũng như trong nhiều cài đặt UNIX khác, đây là các hàm thư viện (library functions) được xây dựng lớp phủ phía trên `ioctl()`.

## 62.3 Lệnh stty

Lệnh `stty` là phiên bản dòng lệnh (command-line analog) tương đương với các hàm `tcgetattr()` và `tcsetattr()`, cho phép chúng ta xem và thay đổi các thuộc tính terminal ngay từ shell. Điều này rất hữu ích khi cần theo dõi, gỡ lỗi (debug), hoặc hoàn tác các hiệu ứng từ các chương trình làm thay đổi thuộc tính terminal.

Chúng ta có thể xem các thiết lập hiện tại của tất cả các thuộc tính terminal bằng lệnh sau (được thực hiện trên một console ảo):

```
$ stty -a
speed 38400 baud; rows 25; columns 80; line = 0;
intr = ^C; quit = ^\; erase = ^?; kill = ^U; eof = ^D; eol = <undef>;
eol2 = <undef>; start = ^Q; stop = ^S; susp = ^Z; rprnt = ^R;
werase = ^W; lnext = ^V; flush = ^O; min = 1; time = 0;
-parenb -parodd cs8 hupcl -cstopb cread -clocal -crtscts
-ignbrk brkint -ignpar -parmrk -inpck -istrip -inlcr -igncr icrnl ixon -ixoff 
-iuclc -ixany imaxbel -iutf8
opost -olcuc -ocrnl onlcr -onocr -onlret -ofill -ofdel nl0 cr0 tab0 bs0 vt0 ff0
isig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop -echoprt 
echoctl echoke
```

Dòng đầu tiên của kết quả trên hiển thị tốc độ đường truyền terminal (tính bằng số bit trên giây - bits per second), kích thước cửa sổ terminal, và kỷ luật dòng (line discipline) dưới dạng số (0 tương ứng với `N_TTY`, kỷ luật dòng mới).

Ba dòng tiếp theo hiển thị các thiết lập của các ký tự đặc biệt khác nhau trên terminal. Ký hiệu `^C` biểu thị Control-C, v.v. Chuỗi `<undef>` có nghĩa là ký tự đặc biệt tương ứng của terminal hiện chưa được định nghĩa. Các giá trị `min` và `time` liên quan đến chế độ đầu vào phi chính tắc (noncanonical mode input), và được mô tả trong Mục [62.6.2](#page-18-0).

Các dòng còn lại hiển thị thiết lập của các cờ (flags) khác nhau từ (theo thứ tự) các trường `c_cflag`, `c_iflag`, `c_oflag`, và `c_lflag` của cấu trúc `termios`. Khi tên cờ có dấu gạch nối (-) đứng trước, cờ đó hiện đang bị vô hiệu hóa (disabled); ngược lại, nó đang được kích hoạt (enabled).

Khi được nhập mà không có các đối số dòng lệnh, `stty` chỉ hiển thị tốc độ đường truyền terminal, kỷ luật dòng, và bất kỳ thiết nào khác lệch khỏi các giá trị hợp lý (sane values).

Chúng ta có thể thay đổi các thiết lập của các ký tự đặc biệt trên terminal bằng các lệnh như sau:

```
$ stty intr ^L Biến ký tự ngắt (interrupt character) thành Control-L
```

Khi chỉ định một ký tự điều khiển (control character) làm đối số cuối cùng, chúng ta có thể thực hiện theo nhiều cách khác nhau:

- dưới dạng chuỗi 2 ký tự bao gồm dấu mũ (^) theo sau là ký tự tương ứng (như minh họa ở trên);
- dưới dạng số bát phân (octal) hoặc thập lục phân (hexadecimal) (ví dụ: `014` hoặc `0xC`); hoặc
- bằng cách gõ trực tiếp chính ký tự đó.

Nếu chúng ta sử dụng tùy chọn cuối cùng, và ký tự được đề cập là một ký tự được diễn giải đặc biệt bởi shell hoặc trình điều khiển terminal (terminal driver), thì chúng ta phải đặt trước nó bằng ký tự theo sau nghĩa đen (literal next character) (thường là Control-V):

```
$ stty intr Control-V Control-L
```

(Mặc dù để dễ đọc, một khoảng trắng được hiển thị giữa Control-V và Control-L trong ví dụ trên, nhưng không được gõ bất kỳ ký tự khoảng trắng nào giữa Control-V và ký tự mong muốn.)

Có thể, mặc dù không phổ biến, định nghĩa các ký tự đặc biệt của terminal thành một ký tự khác ngoài ký tự điều khiển:

```
$ stty intr q Biến ký tự ngắt thành q
```

Tất nhiên, khi làm điều này, chúng ta không thể sử dụng phím `q` cho mục đích thông thường của nó nữa (tức là tạo ra chữ cái `q`).

Để thay đổi các cờ của terminal, chẳng hạn như cờ `TOSTOP`, chúng ta có thể sử dụng các lệnh như sau:

```
$ stty tostop Kích hoạt cờ TOSTOP
$ stty -tostop Vô hiệu hóa cờ TOSTOP
```

Đôi khi, khi phát triển các chương trình làm thay đổi thuộc tính terminal, chương trình có thể bị treo (crash), để lại terminal ở trạng thái hầu như không thể sử dụng được. Trên một trình giả lập terminal (terminal emulator), chúng ta có sự tiện lợi là chỉ cần đóng cửa sổ terminal lại và mở một cửa sổ khác. Ngoài ra, chúng ta có thể nhập chuỗi ký tự sau để khôi phục các cờ và ký tự đặc biệt của terminal về trạng thái hợp lý:

```
Control-J stty sane Control-J
```

Ký tự `Control-J` chính là ký tự xuống dòng thực sự (ASCII 10 thập phân). Chúng ta sử dụng ký tự này bởi vì, trong một số chế độ, trình điều khiển terminal có thể không còn ánh xạ phím Enter (ASCII 13 thập phân) thành ký tự xuống dòng nữa. Chúng ta gõ một ký tự `Control-J` ban đầu để đảm bảo rằng chúng ta có một dòng lệnh mới không có các ký tự đi trước. Điều này có thể không dễ xác minh nếu, ví dụ, tính năng phản hồi ký tự của terminal (terminal echoing) đã bị vô hiệu hóa.

Lệnh `stty` hoạt động trên terminal được tham chiếu bởi đầu vào chuẩn (standard input). Sử dụng tùy chọn `-F`, chúng ta có thể (tuân theo các kiểm tra quyền hạn - permission checks) theo dõi và thiết lập các thuộc tính của một terminal khác với terminal mà lệnh `stty` đang chạy trên đó:

```bash
$ su # Cần quyền đặc trị để truy cập terminal của người dùng khác
Password:
## stty -a -F /dev/tty3 # Lấy thuộc tính của terminal /dev/tty3
(Nội dung đầu ra được giản lược)
```

Tùy chọn `-F` là một phần mở rộng đặc trưng của Linux đối với lệnh `stty`. Trên nhiều cài đặt UNIX khác, `stty` luôn thao tác trên terminal được trỏ bởi chuẩn đầu vào (standard input), và chúng ta phải sử dụng hình thức thay thế sau (cũng có thể sử dụng trên Linux):

## stty -a < /dev/tty3

```

## 62.4 Các Ký tự Đặc biệt của Terminal (Terminal Special Characters)

Bảng 62-1 liệt kê các ký tự đặc biệt được nhận dạng bởi trình điều khiển terminal (terminal driver) của Linux. Hai cột đầu tiên hiển thị tên của ký tự và hằng số tương ứng có thể được sử dụng làm chỉ số (subscript) trong mảng `c_cc`. (Như có thể thấy, các hằng số này đơn giản là thêm tiền tố chữ cái V vào trước tên ký tự). Các ký tự CR và NL không có chỉ số `c_cc` tương ứng, bởi vì giá trị của các ký tự này không thể thay đổi được.

Cột Cài đặt mặc định (Default setting) của bảng hiển thị giá trị mặc định thông thường cho ký tự đặc biệt. Ngoài việc có thể đặt một ký tự đặc biệt của terminal thành một giá trị cụ thể, chúng ta cũng có thể vô hiệu hóa ký tự đó bằng cách gán cho nó giá trị được trả về bởi lời gọi hàm `fpathconf(fd, _PC_VDISABLE)`, trong đó `fd` là một mô tả file (`File Descriptor`) trỏ đến một terminal. (Trên hầu hết các cài đặt UNIX, lời gọi này trả về giá trị 0).

Hoạt động của mỗi ký tự đặc biệt tuân theo cài đặt của các cờ khác nhau trong các trường mặt nạ bit termios (termios bit-mask fields) (được mô tả trong Mục [62.5](#page-12-0)), như được hiển thị ở cột kế cuối của bảng.

Cột cuối cùng chỉ ra những ký tự nào được quy định bởi SUSv3. Bất kể thông số kỹ thuật của SUSv3 ra sao, hầu hết các ký tự này đều được hỗ trợ trên tất cả các cài đặt UNIX.

|  |  |  |  |  | Bảng 62-1: Các ký tự đặc biệt của terminal |
|--|--|--|--|--|-----------------------------------------|
|--|--|--|--|--|-----------------------------------------|

| Character | c_cc<br>subscript | Description           | Default<br>setting | Relevant<br>bit-mask flags | SUSv3 |
|-----------|-------------------|-----------------------|--------------------|----------------------------|-------|
| CR        | (none)            | Carriage return       | ^M                 | ICANON, IGNCR, ICRNL,      | •     |
|           |                   |                       |                    | OPOST, OCRNL, ONOCR        |       |
| DISCARD   | VDISCARD          | Discard output        | ^O                 | (not implemented)          |       |
| EOF       | VEOF              | End-of-file           | ^D                 | ICANON                     | •     |
| EOL       | VEOL              | End-of-line           |                    | ICANON                     | •     |
| EOL2      | VEOL2             | Alternate end-of-line |                    | ICANON, IEXTEN             |       |
| ERASE     | VERASE            | Erase character       | ^?                 | ICANON                     | •     |
| INTR      | VINTR             | Interrupt (SIGINT)    | ^C                 | ISIG                       | •     |
| KILL      | VKILL             | Erase line            | ^U                 | ICANON                     | •     |
| LNEXT     | VLNEXT            | Literal next          | ^V                 | ICANON, IEXTEN             |       |
| NL        | (none)            | Newline               | ^J                 | ICANON, INLCR, ECHONL,     | •     |
|           |                   |                       |                    | OPOST, ONLCR, ONLRET       |       |
| QUIT      | VQUIT             | Quit (SIGQUIT)        | ^\                 | ISIG                       | •     |
| REPRINT   | VREPRINT          | Reprint input line    | ^R                 | ICANON, IEXTEN, ECHO       |       |
| START     | VSTART            | Start output          | ^Q                 | IXON, IXOFF                | •     |
| STOP      | VSTOP             | Stop output           | ^S                 | IXON, IXOFF                | •     |
| SUSP      | VSUSP             | Suspend (SIGTSTP)     | ^Z                 | ISIG                       | •     |
| WERASE    | VWERASE           | Erase word            | ^W                 | ICANON, IEXTEN             |       |

Các đoạn văn bản sau đây cung cấp giải thích chi tiết hơn về các ký tự đặc biệt của terminal. Lưu ý rằng nếu trình điều khiển terminal thực hiện việc diễn giải đầu vào đặc biệt của nó trên một trong các ký tự này, thì ngoại trừ CR, EOL, EOL2 và NL, ký tự đó sẽ bị loại bỏ (tức là nó không được truyền đến bất kỳ tiến trình đọc `reading process` nào).

### CR

CR là ký tự về đầu dòng (carriage return). Ký tự này được truyền đến tiến trình đọc (`reading process`). Ở chế độ chuẩn (`canonical mode` - cờ `ICANON` được thiết lập) với cờ `ICRNL` (ánh xạ CR thành NL ở đầu vào) được thiết lập (mặc định), ký tự này trước tiên được chuyển đổi thành một ký tự xuống dòng (Newline) (ASCII 10 thập phân, ^J) trước khi được truyền đến tiến trình đọc. Nếu cờ `IGNCR` (bỏ qua CR) được thiết lập, thì ký tự này sẽ bị bỏ qua ở đầu vào (trong trường hợp đó, ký tự xuống dòng thực sự phải được sử dụng để kết thúc một dòng đầu vào). Một ký tự CR đầu ra khiến terminal di chuyển con trỏ về đầu dòng.

### DISCARD

DISCARD là ký tự đầu ra hủy bỏ (discard output character). Mặc dù ký tự này được định nghĩa trong mảng `c_cc`, nhưng nó không có tác dụng trên Linux. Trên một số triển khai UNIX khác, việc gõ ký tự này một lần sẽ khiến đầu ra của chương trình bị hủy bỏ. Ký tự này hoạt động như một công tắc chuyển đổi (toggle) — gõ lại lần nữa sẽ bật lại hiển thị đầu ra. Điều này hữu ích khi một chương trình tạo ra lượng lớn đầu ra và chúng ta muốn bỏ qua một phần trong số đó. (Tính năng này hữu ích hơn nhiều trên các thiết bị đầu cuối (terminal) truyền thống, nơi tốc độ dòng thấp hơn và các "cửa sổ terminal" khác không khả dụng). Ký tự này không được truyền đến tiến trình đọc (reading process).

### EOF

EOF là ký tự kết thúc tệp (end-of-file character) ở chế độ chuẩn hóa (canonical mode) (thường là Control-D). Nhập ký tự này ở đầu một dòng sẽ khiến điều kiện kết thúc tệp được phát hiện bởi tiến trình đang đọc từ thiết bị đầu cuối (tức là `read()` trả về 0). Nếu được gõ ở bất kỳ vị trí nào khác ngoài ký tự đầu tiên của một dòng, thì ký tự này đơn giản sẽ làm cho hàm `read()` hoàn tất ngay lập tức, trả về các ký tự đã được nhập vào dòng cho đến thời điểm đó. Trong cả hai trường hợp, bản thân ký tự EOF không được truyền đến tiến trình đọc (reading process).

### EOL và EOL2

EOL và EOL2 là các ký tự phân tách dòng bổ sung hoạt động giống như ký tự dòng mới (newline - NL) tiêu chuẩn cho đầu vảo ở chế độ chuẩn hóa (canonical mode input), kết thúc một dòng đầu vào và cung cấp nó cho tiến trình đọc (reading process). Theo mặc định, các ký tự này chưa được định nghĩa. Nếu chúng được định nghĩa, chúng sẽ được truyền đến tiến trình đọc. Ký tự EOL2 chỉ hoạt động nếu cờ IEXTEN (xử lý đầu vào mở rộng - extended input processing) được thiết lập (mặc định là vậy).

Các ký tự này rất hiếm khi được sử dụng. Một ứng dụng có sử dụng chúng là telnet. Bằng cách thiết lập EOL hoặc EOL2 thành ký tự thoát (escape character) của telnet (thường là Control-], hoặc cách khác là ký tự ngã, ~, nếu hoạt động ở chế độ rlogin), telnet có thể ngay lập tức bắt lấy ký tự đó, ngay cả khi đang đọc đầu vào ở chế độ chuẩn hóa (canonical mode).

### ERASE

Ở chế độ chuẩn hóa (canonical mode), việc gõ ký tự ERASE sẽ xóa ký tự được nhập trước đó trên dòng hiện tại. Ký tự bị xóa và bản thân ký tự ERASE không được truyền đến tiến trình đọc (reading process).

### INTR

INTR là ký tự ngắt (interrupt character). Nếu cờ ISIG (bật tín hiệu - enable signals) được thiết lập (mặc định), việc gõ ký tự này sẽ khiến tín hiệu ngắt (`SIGINT`) được gửi đến nhóm tiến trình tiền cảnh (foreground process group) của terminal (Mục 34.2). Bản thân ký tự INTR không được truyền đến tiến trình đọc (reading process).

### KILL

KILL là ký tự xóa dòng (erase line), còn được gọi là ký tự hủy dòng (kill line). Ở chế độ chuẩn hóa (canonical mode), việc gõ ký tự này sẽ khiến dòng đầu vào hiện tại bị hủy bỏ (tức là các ký tự đã gõ cho đến lúc đó, cũng như bản thân ký tự KILL, không được truyền đến tiến trình đọc).

### LNEXT

LNEXT là ký tự theo nghĩa đen tiếp theo (literal next character). Trong một số trường hợp, chúng ta có thể muốn coi một trong các ký tự đặc biệt của thiết bị đầu cuối giống như một ký tự bình thường đối với đầu vào của tiến trình đọc (reading process). Việc gõ ký tự theo nghĩa đen tiếp theo (thường là Control-V) khiến ký tự tiếp theo được xử lý theo đúng nghĩa đen, vô hiệu hóa bất kỳ diễn giải đặc biệt nào đối với ký tự đó mà trình điều khiển thiết bị đầu cuối (terminal driver) thường thực hiện. Do đó, chúng ta có thể nhập chuỗi 2 ký tự Control-V Control-C để cung cấp một ký tự Control-C thực sự (ASCII 3) làm đầu vào cho tiến trình đọc. Bản thân ký tự LNEXT không được truyền đến tiến trình đọc. Ký tự này chỉ được diễn giải ở chế độ chuẩn hóa (canonical mode) khi cờ IEXTEN (xử lý đầu vào mở rộng - extended input processing) được thiết lập (đây là mặc định).

### NL

NL là ký tự dòng mới (newline character). Ở chế độ chuẩn hóa (canonical mode), ký tự này chấm dứt một dòng đầu vào. Bản thân ký tự NL được bao gồm trong dòng trả về cho tiến trình đọc (reading process). (Ký tự CR thông thường được chuyển đổi thành NL ở chế độ chuẩn hóa). Một ký tự NL đầu ra khiến thiết bị đầu cuối di chuyển con trỏ xuống một dòng. Nếu các cờ OPOST và ONLCR (ánh xạ NL sang CR-NL) được thiết lập (mặc định), thì khi xuất ra, một ký tự dòng mới sẽ được ánh xạ thành chuỗi 2 ký tự CR cộng với NL. (Sự kết hợp giữa các cờ ICRNL và ONLCR có nghĩa là CR đầu vào được chuyển đổi thành NL, sau đó được phản hồi (echo) thành CR cộng với NL).

### QUIT

Nếu cờ ISIG được thiết lập (mặc định), việc gõ ký tự QUIT sẽ khiến tín hiệu thoát (`SIGQUIT`) được gửi đến nhóm tiến trình chạy nền trước (foreground process group) của thiết bị đầu cuối (Mục 34.2). Bản thân ký tự QUIT không được truyền đến tiến trình đọc (reading process).

### REPRINT

REPRINT là ký tự in lại đầu vào (reprint input character). Ở chế độ chuẩn hóa (canonical mode) với cờ IEXTEN được thiết lập (mặc định), việc gõ ký tự này sẽ khiến dòng đầu vào hiện tại (chưa hoàn chỉnh) được hiển thị lại trên thiết bị đầu cuối. Điều này rất hữu ích nếu một chương trình khác (ví dụ: `wall(1)` hoặc `write(1)`) đã ghi đầu ra làm rối màn hình thiết bị đầu cuối. Bản thân ký tự REPRINT không được truyền đến tiến trình đọc (reading process).

### START và STOP

START và STOP là các ký tự bắt đầu đầu ra và dừng đầu ra (start output và stop output characters), hoạt động nếu cờ IXON (bật điều khiển đầu ra bắt đầu/dừng - enable start/stop output control) được kích hoạt (mặc định). (Các ký tự START và STOP không được tôn trọng bởi một số trình giả lập thiết bị đầu cuối (terminal emulator)).

Việc gõ ký tự STOP sẽ tạm dừng đầu ra của terminal (terminal output). Bản thân ký tự STOP không được truyền đến tiến trình đang đọc (reading process). Nếu cờ `IXOFF` được thiết lập và hàng đợi đầu vào của terminal (terminal input queue) đầy, thì trình điều khiển terminal (terminal driver) sẽ tự động gửi một ký tự STOP để điều tiết đầu vào.

Việc gõ ký tự START làm cho đầu ra của terminal tiếp tục sau khi đã bị dừng trước đó bởi ký tự STOP. Bản thân ký tự START không được truyền đến tiến trình đang đọc. Nếu cờ `IXOFF` (bật điều khiển đầu vào start/stop) được thiết lập (cờ này bị tắt theo mặc định) và trình điều khiển terminal trước đó đã gửi một ký tự STOP do hàng đợi đầu vào đầy, trình điều khiển terminal sẽ tự động tạo ra một ký tự START khi có không gian trống trở lại trong hàng đợi đầu vào.

Nếu cờ `IXANY` được thiết lập, thì bất kỳ ký tự nào, không chỉ riêng START, đều có thể được gõ để khởi động lại đầu ra (và ký tự đó cũng tương tự không được truyền đến tiến trình đang đọc).

Các ký tự START và STOP được sử dụng để điều khiển luồng phần mềm (software flow control) theo bất kỳ hướng nào giữa máy tính và thiết bị terminal. Một chức năng của các ký tự này là cho phép người dùng dừng và khởi động đầu ra của terminal. Đây là điều khiển luồng đầu ra (output flow control), được bật bởi `IXON`. Tuy nhiên, điều khiển luồng theo hướng ngược lại (tức là điều khiển luồng đầu vào từ thiết bị đến máy tính, được bật bởi `IXOFF`) cũng rất quan trọng khi, ví dụ, thiết bị đang xét là một modem hoặc một máy tính khác. Điều khiển luồng đầu vào đảm bảo rằng không có dữ liệu nào bị mất nếu ứng dụng xử lý đầu vào chậm và các bộ đệm kernel (kernel buffers) bị đầy.

Với tốc độ đường truyền cao hơn vốn là tiêu chuẩn hiện nay, điều khiển luồng phần mềm đã được thay thế bằng điều khiển luồng phần cứng (RTS/CTS), theo đó luồng dữ liệu được bật và tắt bằng cách sử dụng các tín hiệu được gửi qua các dây riêng biệt trên cổng nối tiếp (serial port). (RTS viết tắt của Request To Send, và CTS viết tắt của Clear To Send.)

### SUSP

SUSP là ký tự tạm dừng (suspend character). Nếu cờ `ISIG` được thiết lập (mặc định), việc gõ ký tự này sẽ khiến tín hiệu tạm dừng terminal (`SIGTSTP`) được gửi đến nhóm tiến trìnhforeground (foreground process group) của terminal (Phần 34.2). Bản thân ký tự SUSP không được truyền đến tiến trình đang đọc.

### WERASE

WERASE là ký tự xóa từ (word erase character). Ở chế độ chuẩn (canonical mode), với cờ `IEXTEN` được thiết lập (mặc định), việc gõ ký tự này sẽ xóa tất cả các ký tự quay lại đầu của từ trước đó. Một từ được coi là một chuỗi các chữ cái, chữ số và ký tự gạch dưới. (Trên một số cài đặt UNIX, một từ được coi là bị giới hạn bởi khoảng trắng.)

### Các ký tự đặc biệt khác của terminal

Các cài đặt UNIX khác cung cấp các ký tự đặc biệt của terminal bổ sung cho các ký tự được liệt kê trong Bảng 62-1.

BSD cung cấp các ký tự DSUSP và STATUS. Ký tự DSUSP (thường là Control-Y) hoạt động tương tự như ký tự SUSP, nhưng chỉ tạm dừng nhóm tiến trình foreground khi nó cố gắng đọc ký tự đó (tức là sau khi tất cả đầu vào trước đó đã được đọc). Một số cài đặt không có nguồn gốc từ BSD cũng cung cấp ký tự DSUSP.

Ký tự STATUS (thường là Control-T) làm cho kernel hiển thị thông tin trạng thái trên terminal (bao gồm trạng thái của tiến trình foreground và thời gian CPU mà nó đã tiêu thụ), đồng thời gửi tín hiệu `SIGINFO` đến nhóm tiến trình foreground. Nếu muốn, các tiến trình có thể bắt (catch) tín hiệu này và hiển thị thêm thông tin trạng thái. (Linux cung cấp một tính năng tương tự dưới dạng phím SysRq ma thuật; xem tệp mã nguồn kernel `Documentation/sysrq.txt` để biết chi tiết.)

Các dẫn xuất của System V cung cấp ký tự SWTCH. Ký tự này được sử dụng để chuyển đổi các shell dưới các lớp shell (shell layers), một tiền bối của System V dùng cho việc điều khiển công việc (job control).

### Chương trình ví dụ

[Liệt kê 62-1](#page-12-1) cho thấy việc sử dụng `tcgetattr()` và `tcsetattr()` để thay đổi ký tự ngắt (interrupt character) của terminal. Chương trình này thiết lập ký tự ngắt thành ký tự có giá trị số được cung cấp dưới dạng tham số dòng lệnh (command-line argument) của chương trình, hoặc vô hiệu hóa ký tự ngắt nếu không có tham số dòng lệnh nào được cung cấp.

Phiên shell sau đây minh họa việc sử dụng chương trình này. Chúng ta bắt đầu bằng cách đặt ký tự ngắt thành Control-L (ASCII 12), sau đó xác minh sự thay đổi bằng lệnh `stty`:

```

$ ./new_intr 12
$ stty
speed 38400 baud; line = 0;
intr = ^L;

```

Sau đó, chúng ta khởi chạy một tiến trình chạy `sleep(1)`. Chúng ta thấy rằng việc gõ Control-C không còn tác dụng thông là chấm dứt tiến trình nữa, nhưng gõ Control-L lại chấm dứt tiến trình.

```

$ sleep 10
^C Control-C không có tác dụng; nó chỉ được in lặp lại (echoed)
Gõ Control-L để chấm dứt sleep

```

Bây giờ chúng ta hiển thị giá trị của biến `$?` trong shell, cho biết trạng thái chấm dứt (termination status) của lệnh cuối cùng:

```

$ echo $?
130

```

Chúng ta thấy rằng trạng thái chấm dứt của tiến trình là 130. Điều này cho biết tiến trình đã bị tiêu diệt (killed) bởi tín hiệu 130 – 128 = 2; số hiệu tín hiệu 2 là `SIGINT`.

Tiếp theo, chúng ta sử dụng chương trình của mình để vô hiệu hóa ký tự ngắt (interrupt character).

```

$ ./new_intr
$ stty Kiểm tra lại sự thay đổi
speed 38400 baud; line = 0;
intr = <undef>;

```

Bây giờ chúng ta thấy rằng cả Control-C lẫn Control-L đều không tạo ra tín hiệu `SIGINT`, và thay vào đó chúng ta phải sử dụng Control-\ để kết thúc một chương trình:

```

$ sleep 10
^C^L Control-C và Control-L chỉ đơn giản được lặp lại (echoed)
Gõ Control-\ để tạo ra SIGQUIT
Quit
$ stty sane Đưa terminal về trạng thái bình thường (sane state)

```

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– tty/new_intr.c

## include <termios.h>

## include <ctype.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct termios tp;
int intrChar;
if (argc > 1 && strcmp(argv[1], "--help") == 0)
usageErr("%s [intr-char]\n", argv[0]);
/* Xác định thiết lập INTR mới từ dòng lệnh */
if (argc == 1) { /* Vô hiệu hóa */
intrChar = fpathconf(STDIN_FILENO, _PC_VDISABLE);
if (intrChar == -1)
errExit("Không thể xác định VDISABLE");
} else if (isdigit((unsigned char) argv[1][0])) {
intrChar = strtoul(argv[1], NULL, 0); /* Cho phép hệ cơ số 16, cơ số 8 */
} else { /* Ký tự dạng chuỗi/ký tự đơn */
intrChar = argv[1][0];
}
/* Lấy các thiết lập terminal hiện tại, sửa đổi ký tự INTR, và
đẩy các thay đổi trở lại trình điều khiển terminal (terminal driver) */
if (tcgetattr(STDIN_FILENO, &tp) == -1)
errExit("tcgetattr");
tp.c_cc[VINTR] = intrChar;
if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &tp) == -1)
errExit("tcsetattr");
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– tty/new_intr.c

```

## 62.5 Các cờ Terminal (Terminal Flags)

Bảng 62-2 liệt kê các thiết lập được điều khiển bởi mỗi trường trong số bốn trường cờ (flag fields) của cấu trúc `termios`. Các hằng số được liệt kê trong bảng này tương ứng với các bit đơn, ngoại trừ những hằng số chỉ định mặt nạ term (term mask), là các giá trị trải dài trên nhiều bit; chúng có thể chứa một giá trị nằm trong dải giá trị được hiển thị trong dấu ngoặc đơn. Cột có nhãn SUSv3 cho biết cờ đó có được quy định trong chuẩn SUSv3 hay không. Cột Mặc định (Default) hiển thị các thiết lập mặc định cho một phiên đăng nhập giao diện điều khiển ảo (virtual console login).

Nhiều shell cung cấp tính năng chỉnh sửa dòng lệnh (command-line editing facilities) tự thực hiện các thao tác thay đổi trên các cờ được liệt kê ở Bảng 62-2. Điều này có nghĩa là nếu chúng ta thử sử dụng lệnh `stty(1)` để thử nghiệm với các thiết lập này, thì các thay đổi có thể không có hiệu lực khi nhập các câu lệnh shell. Để tránh hành vi này, chúng ta phải vô hiệu hóa tính năng chỉnh sửa dòng lệnh trong shell. Ví dụ: việc chỉnh sửa dòng lệnh có thể bị vô hiệu hóa bằng cách chỉ định tùy chọn dòng lệnh `--noediting` khi khởi chạy `bash`.

**Bảng 62-2:** Các cờ terminal (Terminal flags)

| Trường/Cờ (Field/Flag) | Mô tả (Description) | Mặc định (Default) | SUSv3 |
|------------------------|----------------------------------------------------------|-------------------|-------|
| c_iflag | | | |
| BRKINT | Gửi tín hiệu ngắt (SIGINT) khi gặp điều kiện BREAK | on | • |
| ICRNL | Ánh xạ CR thành NL ở đầu vào (input) | on | • |
| IGNBRK | Bỏ qua điều kiện BREAK | off | • |
| IGNCR | Bỏ qua CR ở đầu vào | off | • |
| IGNPAR | Bỏ qua các ký tự gặp lỗi chẵn lẻ (parity errors) | off | • |
| IMAXBEL | Chuông kêu khi hàng đợi đầu vào terminal đầy (không dùng) | (on) | |
| INLCR | Ánh xạ NL thành CR ở đầu vào | off | • |
| INPCK | Bật tính năng kiểm tra chẵn lẻ đầu vào (input parity checking) | off | • |
| ISTRIP | Loại bỏ bit cao (bit 8) khỏi các ký tự đầu vào | off | • |
| IUTF8 | Đầu vào là định dạng UTF-8 (từ Linux 2.6.4) | off | |
| IUCLC | Ánh xạ chữ hoa thành chữ thường ở đầu vào (nếu `IEXTEN` cũng được bật) | off | |
| IXANY | Cho phép bất kỳ ký tự nào khởi động lại đầu ra đang bị dừng | off | • |
| IXOFF | Bật điều khiển luồng đầu vào dạng bắt đầu/dừng (start/stop input flow control) | off | • |
| IXON | Bật điều khiển luồng đầu ra dạng bắt đầu/dừng (start/stop output flow control) | on | • |
| PARMRK | Đánh dấu lỗi chẵn lẻ (với 2 byte tiền tố: 0377 + 0) | off | • |
| c_oflag | | | |
| BSDLY | Mặt nạ độ trễ phím Backspace (BS0, BS1) | BS0 | • |
| CRDLY | Mặt nạ độ trễ CR (CR0, CR1, CR2, CR3) | CR0 | • |
| FFDLY | Mặt nạ độ trễ Form-feed (FF0, FF1) | FF0 | • |
| NLDLY | Mặt nạ độ trễ Newline (NL0, NL1) | NL0 | • |
| OCRNL | Ánh xạ CR thành NL ở đầu ra (xem thêm `ONOCR`) | off | • |
| OFDEL | Sử dụng DEL (0177) làm ký tự đệm (fill character); ngược lại dùng NUL (0) | off | • |

| OFILL      | Sử dụng ký tự đệm (fill character) cho độ trễ (thay vì độ trễ theo thời gian) | off           | • |
| OLCUC      | Chuyển đổi chữ thường thành chữ hoa khi xuất dữ liệu    | off           |   |
| ONLCR      | Chuyển đổi NL thành CR-NL khi xuất dữ liệu               | on            | • |
| ONLRET     | Giả định NL thực hiện chức năng của CR (chuyển về đầu dòng) | off           | • |
| ONOCR      | Không xuất CR nếu đã ở cột 0 (đầu dòng)                  | off           | • |
| OPOST      | Thực hiện hậu xử lý dữ liệu xuất (output postprocessing)| on            | • |
| TABDLY     | Mặt nạ độ trễ tab ngang (TAB0, TAB1, TAB2, TAB3)         | TAB0          | • |
| VTDLY      | Mặt nạ độ trễ tab dọc (VT0, VT1)                         | VT0           | • |
| c_cflag    |                                                          |               |   |
| CBAUD      | Mặt nạ tốc độ truyền (baud/bit rate) (B0, B2400, B9600, v.v.) | B38400     |   |
| CBAUDEX    | Mặt nạ tốc độ truyền mở rộng (cho tốc độ > 38,400)       | off           |   |
| CIBAUD     | Tốc độ truyền đầu vào (input baud), nếu khác đầu ra (không dùng) | (off) |   |
| CLOCAL     | Bỏ qua các đường trạng thái modem (không kiểm tra tín hiệu sóng mang - carrier signal) | off | • |
| CMSPAR     | Sử dụng parity "stick" (mark/space)                      | off           |   |

**Bảng 62-2:** Các cờ Terminal (tiếp theo)

| Trường/Cờ  | Mô tả                                                   | Mặc định SUSv3 |   |
|------------|---------------------------------------------------------|----------------|---|
| CREAD      | Cho phép nhận dữ liệu đầu vào                           | on             | • |
| CRTSCTS    | Bật điều khiển luồng (flow control) phần cứng RTS/CTS   | off            |   |
| CSIZE      | Mặt nạ kích thước ký tự (5 đến 8 bit: CS5, CS6, CS7, CS8)| CS8            | • |
| CSTOPB     | Sử dụng 2 bit dừng (stop bit) cho mỗi ký tự; ngược lại dùng 1 | off      | • |
| HUPCL      | Ngắt kết nối (ngắt kết nối modem) khi đóng lần cuối     | on             | • |
| PARENB     | Bật kiểm tra tính chẵn lẻ (Parity enable)               | off            | • |
| PARODD     | Sử dụng parity lẻ; ngược lại dùng chẵn                  | off            |   |
| c_lflag    |                                                         |                |   |
| ECHO       | Phản hồi (echo) các ký tự đầu vào                       | on             | • |
| ECHOCTL    | Phản hồi các ký tự điều khiển trực quan (ví dụ: ^L)     | on             |   |
| ECHOE      | Thực hiện thao tác ERASE trực quan                      | on             |   |
| ECHOK      | Thực hiện thao tác KILL trực quan                       | on             |   |
| ECHOKE     | Không xuất ký tự dòng mới (newline) sau khi echo KILL   | off            |   |
| ECHONL     | Echo NL (trong chế độ canonical) ngay cả khi tính năng echo bị tắt | off | • |
| ECHOPRT    | Echo các ký tự bị xóa theo chiều ngược lại (giữa \ và /)  | off            |   |
| FLUSHO     | Dữ liệu xuất đang bị xóa đệm (flushed) (không dùng)     | -              |   |
| ICANON     | Chế độ đầu vào canonical (theo từng dòng)               | on             | • |
| IEXTEN     | Bật xử lý mở rộng đối với các ký tự đầu vào             | on             | • |
| ISIG       | Bật các ký tự tạo tín hiệu (INTR, QUIT, SUSP)           | on             | • |
| NOFLSH     | Tắt việc xóa đệm khi gặp INTR, QUIT và SUSP             | off            |   |
| PENDIN     | Hiển thị lại dữ liệu đầu vào đang chờ ở lần đọc tiếp (chưa được cài đặt) | (off) | |
| TOSTOP     | Tạo tín hiệu SIGTTOU cho đầu ra ở nền (Mục 34.7.1)      | off            | • |
| XCASE      | Trình bày chữ hoa/chữ thường theo kiểu canonical (chưa được cài đặt) | (off) | |

Một số cờ được liệt kê trong Bảng 62-2 được cung cấp cho các terminal lịch sử có năng lực hạn chế và những cờ này ít có giá trị sử dụng trên các hệ thống hiện đại. Ví dụ, các cờ IUCLC, OLCUC và XCASE từng được sử dụng với các terminal chỉ có khả năng hiển thị chữ in hoa. Trên nhiều hệ thống UNIX cũ, nếu một người dùng cố gắng đăng nhập bằng tên người dùng viết hoa, chương trình đăng nhập sẽ giả định rằng người dùng đang ngồi trước một terminal như vậy và sẽ thiết lập các cờ này, sau đó lời nhắc nhập mật khẩu (password prompt) sau đây sẽ xuất hiện:

### \PASSWORD:

Từ thời điểm này trở đi, tất cả các ký tự chữ thường đều được xuất ra dưới dạng chữ hoa, và các ký tự chữ hoa thực sự sẽ có dấu gạch chéo ngược (\) đứng trước. Tương tự đối với đầu vào, một ký tự chữ hoa thực sự có thể được chỉ định bằng cách đặt dấu gạch chéo ngược ở phía trước. Cờ ECHOPRT cũng được thiết kế cho các terminal có năng lực hạn chế.

Các mặt nạ độ trễ khác nhau cũng mang tính lịch sử, phục vụ cho các terminal và máy in mất nhiều thời gian hơn để phản hồi các ký tự như xuống dòng (carriage return) và sang trang (form feed). Các cờ liên quan OFILL và OFDEL chỉ định cách thức thực hiện độ trễ đó. Hầu hết các cờ này không được sử dụng trên Linux. Một ngoại lệ là thiết lập TAB3 cho mặt nạ TABDLY, khiến các ký tự tab được xuất ra thành (tối đa tám) khoảng trắng.

Các đoạn văn sau đây cung cấp thêm chi tiết về một số cờ (flag) termios.

### BRKINT

Nếu cờ BRKINT được thiết lập và cờ IGNBRK không được thiết lập, thì một tín hiệu `SIGINT` sẽ được gửi tới nhóm tiến trình foreground (foreground process group) khi xảy ra điều kiện BREAK.

> Hầu hết các thiết bị đầu cuối (terminal) thô sơ thông truyền thống đều cung cấp một phím BREAK. Việc nhấn phím này thực tế không tạo ra một ký tự nào, mà thay vào đó gây ra điều kiện BREAK, trong đó một chuỗi các bit 0 được gửi tới trình điều khiển terminal (terminal driver) trong một khoảng thời gian được chỉ định, thường là 0,25 hoặc 0,5 giây (tức là lâu hơn thời gian cần thiết để truyền một byte đơn). (Trừ khi cờ IGNBRK đã được thiết lập, kết quả là trình điều khiển terminal sẽ chuyển một byte 0 duy nhất đến tiến trình đang đọc). Trên nhiều hệ thống UNIX, điều kiện BREAK đóng vai trò như một tín hiệu gửi đến một máy chủ từ xa (remote host) để thay đổi tốc độ đường truyền (baud) của nó thành một mức phù hợp với terminal. Do đó, người dùng sẽ nhấn phím BREAK cho đến khi một lời nhắc đăng nhập hợp lệ xuất hiện, cho biết tốc độ đường truyền lúc này đã phù hợp với terminal này.

> Trên một console ảo (virtual console), chúng ta có thể tạo ra điều kiện BREAK bằng cách nhấn Control-Break.

### ECHO

Việc thiết lập cờ ECHO cho phép việc vọng lại (echoing) các ký tự đầu vào. Việc vô hiệu hóa tính năng echo rất hữu ích khi đọc mật khẩu. Tính năng echo cũng bị vô hiệu hóa trong chế độ lệnh (command mode) của `vi`, nơi các ký tự bàn phím được diễn giải như các lệnh chỉnh sửa thay vì là đầu vào dạng văn bản. Cờ ECHO có hiệu lực ở cả hai chế độ canonical và noncanonical.

### ECHOCTL

Nếu ECHO được thiết lập, thì việc bật cờ ECHOCTL sẽ khiến các ký tự điều khiển (control character) ngoại trừ tab, newline, START và STOP được vọng lại dưới dạng `^A` (cho Control-A), cứ thế tiếp tục. Nếu ECHOCTL bị vô hiệu hóa, các ký tự điều khiển sẽ không bị vọng lại.

> Các ký tự điều khiển là những ký tự có mã ASCII nhỏ hơn 32, cộng với ký tự DEL (127 hệ thập phân). Một ký tự điều khiển $x$ được vọng lại bằng cách sử dụng dấu mũ (`^`) theo sau là ký tự kết quả từ biểu thức `(x ^ 64)`. Đối với tất cả các ký tự ngoại trừ DEL, tác dụng của toán tử XOR (`^`) trong biểu thức này là cộng thêm 64 vào giá trị của ký tự. Do đó, Control-A (ASCII 1) được vọng lại thành dấu mũ cộng với A (ASCII 65). Đối với DEL, biểu thức có tác dụng trừ 64 khỏi 127, mang lại giá trị 63, là mã ASCII cho dấu `?`, do đó DEL được vọng lại thành `^?`.

### ECHOE

Trong chế độ canonical, việc thiết lập cờ ECHOE khiến thao tác ERASE được thực hiện trực quan bằng cách xuất chuỗi backspace-space-backspace ra terminal. Nếu ECHOE bị vô hiệu hóa, thì thay vào đó, ký tự ERASE sẽ được vọng lại (ví dụ: thành `^?`), nhưng vẫn thực hiện chức năng xóa một ký tự của nó.

### ECHOK và ECHOKE

Các cờ ECHOK và ECHOKE điều khiển việc hiển thị trực quan khi sử dụng ký tự KILL (xóa dòng) trong chế độ canonical. Ở trường hợp mặc định (cả hai cờ đều được bật), một dòng sẽ được xóa trực quan (xem ECHOE). Nếu một trong hai cờ này bị vô hiệu hóa, thì việc xóa trực quan sẽ không được thực hiện (nhưng dòng đầu vào vẫn bị hủy bỏ), và ký tự KILL sẽ được vọng lại (ví dụ: thành `^U`). Nếu ECHOK được thiết lập nhưng ECHOKE thì không, thì một ký tự newline cũng được xuất ra.

### ICANON

Việc thiết lập cờ ICANON bật chế độ đầu vào canonical (canonical mode input). Đầu vào được gom thành các dòng và việc diễn giải đặc biệt các ký tự EOF, EOL, EOL2, ERASE, LNEXT, KILL, REPRINT và WERASE được bật (nhưng lưu ý hiệu ứng của cờ IEXTEN được mô tả bên dưới).

### IEXTEN

Việc thiết lập cờ IEXTEN cho phép xử lý mở rộng các ký tự đầu vào. Cờ này (cũng như ICANON) phải được thiết lập để các ký tự sau đây được diễn giải: EOL2, LNEXT, REPRINT và WERASE. Cờ IEXTEN cũng phải được thiết lập để cờ IUCLC có hiệu lực. SUSv3 chỉ đơn thuần nêu rằng cờ IEXTEN bật các chức năng mở rộng (do hệ thống định nghĩa - implementation-defined); các chi tiết có thể khác nhau trên các cài đặt UNIX khác.

### IMAXBEL

Trên Linux, cài đặt của cờ IMAXBEL sẽ bị bỏ qua. Khi đăng nhập qua console, chuông (bell) sẽ luôn kêu khi hàng đợi đầu vào (input queue) đầy.

### IUTF8

Việc thiết lập cờ IUTF8 bật chế độ cooked (Mục [62.6.3](#page-20-0)) để xử lý chính xác đầu vào UTF-8 khi thực hiện chỉnh sửa dòng.

### NOFLSH

Theo mặc định, khi một tín hiệu (signal) được tạo ra bằng cách gõ ký tự INTR, QUIT hoặc SUSP, bất kỳ dữ liệu tồn đọng nào trong hàng đợi đầu vào và đầu ra của terminal sẽ bị xả sạch (flush - tức là bị loại bỏ). Việc thiết lập cờ NOFLSH sẽ vô hiệu hóa quá trình xả sạch này.

### OPOST

Việc thiết lập cờ OPOST bật tính năng hậu xử lý đầu ra (output postprocessing). Cờ này phải được thiết lập để bất kỳ cờ nào trong trường `c_oflag` của cấu trúc `termios` có hiệu lực. (Nói ngược lại, việc vô hiệu hóa cờ OPOST sẽ ngăn chặn toàn bộ quá trình hậu xử lý đầu ra).

### PARENB, IGNPAR, INPCK, PARMRK và PARODD

Các cờ PARENB, IGNPAR, INPCK, PARMRK và PARODD liên quan đến việc tạo và kiểm tra parity (parity generation and checking).

Cờ PARENB cho phép tạo các bit kiểm tra parity cho các ký tự đầu ra và kiểm tra parity cho các ký tự đầu vào. Nếu chúng ta chỉ muốn thực hiện việc tạo parity đầu ra, chúng ta có thể vô hiệu hóa tính năng kiểm tra parity đầu vào bằng cách tắt INPCK. Nếu cờ PARODD được thiết lập, thì parity lẻ sẽ được sử dụng trong cả hai trường hợp; ngược lại, parity chẵn sẽ được sử dụng.

Các cờ còn lại xác định cách xử lý một ký tự đầu vào gặp lỗi chẵn lẻ (parity error). Nếu cờ `IGNPAR` được thiết lập (set), ký tự đó sẽ bị loại bỏ (không được chuyển đến tiến trình đọc - reading process). Ngược lại, nếu cờ `PARMRK` được thiết lập, ký tự đó sẽ được chuyển đến tiến trình đọc, nhưng đi trước bởi chuỗi 2 byte `0377 + 0`. (Nếu cờ `PARMRK` được thiết lập và `ISTRIP` bị xóa (clear), thì một ký tự `0377` thực sự sẽ được nhân đôi thành `0377 + 0377`.) Nếu `PARMRK` không được thiết lập, nhưng `INPCK` được thiết lập, thì ký tự đó sẽ bị loại bỏ và một byte `0` sẽ được chuyển đến tiến trình đọc thay thế. Nếu không có cờ nào trong `IGNPAR`, `PARMRK` hoặc `INPCK` được thiết lập, thì ký tự sẽ được chuyển nguyên trạng tới tiến trình đọc.

### Chương trình ví dụ

[Liệt kê 62-2](#page-17-0) minh họa việc sử dụng `tcgetattr()` và `tcsetattr()` để tắt cờ `ECHO`, nhằm mục đích các ký tự đầu vào không bị lặp lại (echo). Dưới đây là ví dụ về những gì chúng ta thấy khi chạy chương trình này:

```

$ ./no_echo
Enter text: We type some text, which is not echoed,
Read: Knock, knock, Neo. but was nevertheless read

```

**Liệt kê 62-2:** Vô hiệu hóa tính năng echo của terminal

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––tty/no_echo.c

## include <termios.h>

## include "tlpi_hdr.h"

## define BUF_SIZE 100

int
main(int argc, char *argv[])
{
struct termios tp, save;
char buf[BUF_SIZE];
/* Lấy cấu hình terminal hiện tại, tắt tính năng echo */
if (tcgetattr(STDIN_FILENO, &tp) == -1)
errExit("tcgetattr");
save = tp; /* Để có thể khôi phục cấu hình sau đó */
tp.c_lflag &= ~ECHO; /* Tắt ECHO, các bit khác giữ nguyên */
if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &tp) == -1)
errExit("tcsetattr");
/* Đọc một số dữ liệu đầu vào và hiển thị lại cho người dùng */
printf("Enter text: ");
fflush(stdout);
if (fgets(buf, BUF_SIZE, stdin) == NULL)
printf("Got end-of-file/error on fgets()\n");
else
printf("\nRead: %s", buf);
/* Khôi phục cấu hình terminal ban đầu */
if (tcsetattr(STDIN_FILENO, TCSANOW, &save) == -1)
errExit("tcsetattr");
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––tty/no_echo.c

```

## 62.6 Các chế độ I/O của Terminal (Terminal I/O Modes)

Chúng ta đã lưu ý rằng trình điều khiển terminal (terminal driver) có khả năng xử lý đầu vào ở chế độ quy chuẩn (canonical mode) hoặc chế độ phi quy chuẩn (noncanonical mode), tùy thuộc vào trạng thái thiết lập của cờ `ICANON`. Bây giờ chúng ta sẽ mô tả chi tiết hai chế độ này. Sau đó, chúng ta sẽ mô tả ba chế độ terminal hữu ích—cooked, cbreak và raw—từng có sẵn trong Seventh Edition UNIX, đồng thời chỉ ra cách các chế độ này được mô phỏng trên các hệ thống UNIX hiện đại thông qua việc thiết lập các giá trị thích hợp trong cấu trúc `termios`.

### 62.6.1 Chế độ Canonical (Canonical Mode)

Đầu vào ở chế độ canonical (Canonical mode input) được kích hoạt bằng cách thiết lập cờ `ICANON`. Đầu vào của terminal ở chế độ canonical được phân biệt bởi các đặc điểm sau:

- Dữ liệu đầu vào được gom thành các dòng (line), kết thúc bằng một trong các ký tự phân tách dòng: `NL`, `EOL`, `EOL2` (nếu cờ `IEXTEN` được bật), `EOF` (ở bất kỳ vị trí nào khác ngoài vị trí đầu tiên trong dòng), hoặc `CR` (nếu cờ `ICRNL` được kích hoạt). Ngoại trừ trường hợp `EOF`, ký tự phân tách dòng được trả ngược về tiến trình (Process) đang đọc (như là ký tự cuối cùng trong dòng).
- Tính năng chỉnh sửa dòng được kích hoạt, cho phép dòng đầu vào hiện tại có thể được sửa đổi. Do đó, các ký tự sau được kích hoạt: `ERASE`, `KILL` và, nếu cờ `IEXTEN` được bật, thì có thêm `WERASE`.
- Nếu cờ `IEXTEN` được bật, các ký tự `REPRINT` và `LNEXT` cũng được kích hoạt.

Trong chế độ canonical, một lời gọi hàm `read()` trên terminal sẽ trả về khi một dòng đầu vào hoàn chỉnh đã sẵn sàng. (Bản thân `read()` có thể chỉ lấy một phần của dòng đó nếu nó yêu cầu ít byte hơn; các byte còn lại sẽ được lấy bởi các lời gọi `read()` tiếp theo.) Một lời gọi `read()` cũng có thể kết thúc nếu bị ngắt bởi một trình xử lý tín hiệu (Signal Handler) và việc khởi động lại System Call không được kích hoạt cho tín hiệu này (Mục 21.5).

> Khi mô tả cờ `NOFLSH` ở Mục [62.5](#page-12-0), chúng tôi đã lưu ý rằng các ký tự tạo ra tín hiệu (signal) cũng khiến trình điều khiển terminal (Terminal Driver) làm sạch (flush) hàng đợi đầu vào của terminal. Việc làm sạch này diễn ra bất kể tín hiệu đó có bị bắt (caught) hay bị bỏ qua (ignored) bởi một ứng dụng hay không. Chúng ta có thể ngăn chặn việc làm sạch này bằng cách bật cờ `NOFLSH`.

### 62.6.2 Chế độ Noncanonical (Noncanonical Mode)

Một số ứng dụng (ví dụ: `vi` và `less`) cần đọc các ký tự từ terminal mà người dùng không cần phải cung cấp ký tự phân tách dòng. Chế độ noncanonical được cung cấp cho mục đích này. Ở chế độ noncanonical (`ICANON` không được thiết lập), không có xử lý đầu vào đặc biệt nào được thực hiện. Cụ thể, đầu vào không còn được gom thành các dòng nữa, mà thay vào đó có sẵn ngay lập tức.

Trong những trường hợp nào thì một lời gọi `read()` ở chế độ noncanonical hoàn tất? Chúng ta có thể chỉ định rằng một lời gọi `read()` noncanonical sẽ kết thúc sau một khoảng thời gian nhất định, sau khi một số lượng byte nhất định đã được đọc, hoặc cả hai kết hợp lại. Hai phần tử của mảng `c_cc` trong cấu trúc `termios` quyết định hành vi này: `TIME` và `MIN`. Phần tử `TIME` (được chỉ mục bằng hằng số `VTIME`) chỉ định giá trị thời gian chờ (timeout) tính bằng phần mười giây. Phần tử `MIN` (được chỉ mục bằng `VMIN`) chỉ định số lượng byte tối thiểu cần đọc. (Các thiết lập `MIN` và `TIME` không có tác dụng đối với I/O terminal ở chế độ canonical.)

Hoạt động chính xác và sự tương tác giữa các tham số `MIN` và `TIME` phụ thuộc vào việc mỗi tham số có giá trị khác không hay không. Bốn trường hợp có thể xảy ra được mô tả dưới đây. Lưu ý rằng trong mọi trường hợp, nếu tại thời điểm gọi `read()`, đã có đủ số byte sẵn sàng để thỏa mãn các yêu cầu do `MIN` chỉ định, thì `read()` sẽ trả về ngay lập tức với số lượng byte nhỏ hơn giữa số byte hiện có và số byte được yêu cầu.

### MIN == 0, TIME == 0 (đọc thăm dò - polling read)

Nếu dữ liệu có sẵn tại thời điểm gọi hàm, thì `read()` trả về ngay lập tức với giá trị nhỏ hơn giữa số byte có sẵn hoặc số byte được yêu cầu. Nếu không có byte nào có sẵn, `read()` hoàn tất ngay lập tức và trả về 0.

Trường hợp này đáp ứng các yêu cầu thông thường của việc thăm dò (polling), cho phép ứng dụng kiểm tra xem có dữ liệu đầu vào hay không mà không bị chặn (blocking) nếu không có. Chế độ này có phần tương tự như việc thiết lập cờ `O_NONBLOCK` cho thiết bị đầu cuối (Terminal) (Mục 5.9). Tuy nhiên, với `O_NONBLOCK`, nếu không có byte nào sẵn sàng để đọc, thì `read()` sẽ trả về –1 kèm theo mã lỗi `EAGAIN`.

### MIN > 0, TIME == 0 (đọc chặn - blocking read)

Hàm `read()` thực hiện chặn (có thể là vô thời hạn) cho đến khi đạt được giá trị nhỏ hơn giữa số byte được yêu cầu hoặc số byte `MIN` có sẵn, và trả về giá trị nhỏ hơn trong hai giá trị đó.

Các chương trình như `less` thường thiết lập `MIN` thành 1 và `TIME` thành 0. Điều này cho phép chương trình chờ các thao tác nhấn phím đơn mà không cần lãng phí thời gian của CPU bằng cách thăm dò trong một vòng lặp bận (busy loop).

Nếu một thiết bị đầu cuối được đặt ở chế độ phi chuẩn tắc (noncanonical mode) với `MIN` được đặt thành 1 và `TIME` được đặt thành 0, thì các kỹ thuật được mô tả trong Chương [63](#page-36-0) có thể được sử dụng để kiểm tra xem một ký tự đơn lẻ (thay vì một dòng hoàn chỉnh) đã được gõ tại thiết bị đầu cuối đó hay chưa.

### MIN == 0, TIME > 0 (đọc với thời gian chờ - read with timeout)

Một bộ định thời (timer) được khởi động khi `read()` được gọi. Lời gọi hàm trả về ngay khi có ít nhất 1 byte sẵn sàng, hoặc khi khoảng thời gian `TIME` (tính bằng phần mười giây) trôi qua. Trong trường hợp sau, `read()` trả về 0.

Trường hợp này hữu ích cho các chương trình giao tiếp với một thiết bị nối tiếp (serial device, ví dụ như modem). Chương trình có thể gửi dữ liệu đến thiết bị và sau đó chờ phản hồi, sử dụng thời gian chờ (timeout) để tránh bị treo vĩnh viễn trong trường hợp thiết bị không phản hồi.

### MIN > 0, TIME > 0 (đọc với thời gian chờ giữa các byte - read with interbyte timeout)

Sau khi byte dữ liệu đầu vào đầu tiên xuất hiện, một bộ định thời (timer) sẽ được khởi động lại khi mỗi byte tiếp theo được nhận. Hàm `read()` sẽ trả về khi đã đọc được số lượng nhỏ hơn giữa `MIN` byte hoặc số byte được yêu cầu, hoặc khi khoảng thời gian giữa việc nhận các byte liên tiếp vượt quá `TIME` phần mười giây. Vì bộ định thời chỉ được khởi động sau khi byte đầu tiên xuất hiện, nên sẽ có ít nhất 1 byte được trả về. (Hàm `read()` có thể bị chặn vô thời hạn trong trường hợp này.)

Trường hợp này rất hữu ích để xử lý các phím trên thiết bị đầu cuối tạo ra chuỗi thoát (escape sequence). Ví dụ, trên nhiều thiết bị đầu cuối, phím mũi tên trái tạo ra chuỗi 3 ký tự bao gồm Escape theo sau là `OD`. Các ký tự này được truyền đi trong một khoảng thời gian ngắn liên tiếp. Các ứng dụng xử lý các chuỗi như vậy cần phân biệt giữa việc nhấn một phím kiểu đó với tình huống người dùng gõ chậm từng ký tự một một cách riêng lẻ. Điều này có thể được thực hiện bằng cách thực hiện lệnh `read()` với một thời gian chờ giữa các byte ngắn, chẳng hạn như 0,2 giây. Kỹ thuật như vậy được sử dụng trong chế độ lệnh (command mode) của một số phiên bản `vi`. (Tùy thuộc vào độ dài của thời gian chờ, trong các ứng dụng đó, chúng ta có thể mô phỏng thao tác nhấn phím mũi tên trái bằng cách gõ nhanh chuỗi 3 ký tự đã đề cập ở trên.)

### Sửa đổi và khôi phục MIN và TIME một cách uyển chuyển (portably)

Để tương thích ngược với một số bản cài đặt UNIX trước đây, SUSv3 cho phép các giá trị của hằng số `VMIN` và `VTIME` trùng với `VEOF` và `VEOL`, đồng nghĩa với việc các phần tử này trong mảng `c_cc` của cấu trúc `termios` có thể trùng nhau. (Trên Linux, giá trị của các hằng số này là phân biệt). Điều này khả thi vì `VEOF` và `VEOL` không được sử dụng ở chế độ phi chuẩn tắc (noncanonical mode). Việc `VMIN` và `VEOF` có thể mang cùng một giá trị đòi hỏi sự cẩn trọng trong chương trình chuyển sang chế độ phi chuẩn tắc, thiết lập `MIN` (thường là 1) và sau đó quay trở lại chế độ chuẩn tắc (canonical mode). Khi quay lại chế độ chuẩn tắc, `EOF` sẽ không còn giữ giá trị thông thường của nó là ASCII 4 (Control-D). Cách xử lý mang tính tương thích (portable) cho vấn đề này là lưu lại một bản sao của các thiết lập `termios` trước khi chuyển sang chế độ phi chuẩn tắc, và sau đó sử dụng cấu trúc đã lưu này để quay trở lại chế độ chuẩn tắc.

### 62.6.3 Các chế độ Cooked, Cbreak và Raw

Trình điều khiển terminal (terminal driver) trong phiên bản Seventh Edition UNIX (cũng như trong các phiên bản BSD đầu tiên) có khả năng xử lý đầu vào (input) ở ba chế độ: cooked, cbreak và raw. Sự khác biệt giữa ba chế độ này được tóm tắt trong [Bảng 62-3](#page-20-1).

| Tính năng                                 | Chế độ       |                |                |  |
|-------------------------------------------|--------------|----------------|----------------|--|
|                                           | Cooked       | Cbreak         | Raw            |  |
| Đầu vào khả dụng                          | từng dòng    | từng ký tự     | từng ký tự     |  |
| Có chỉnh sửa dòng (Line-editing)?         | có           | không          | không          |  |
| Ký tự tạo tín hiệu có được biên dịch không? | có           | có             | không          |  |
| START/STOP có được biên dịch không?       | có           | có             | không          |  |
| Các ký tự đặc biệt khác có được dịch không? | có           | không          | không          |  |
| Có thực hiện xử lý đầu vào khác không?    | có           | có             | không          |  |
| Có thực hiện xử lý đầu ra khác không?     | có           | có             | không          |  |
| Đầu vào có được phản hồi (echo) không?    | có           | có thể         | không          |  |

**Bảng 62-3:** Sự khác biệt giữa các chế độ terminal cooked, cbreak và raw

Chế độ Cooked về cơ bản là chế độ chuẩn tắc (canonical mode) với tất cả các xử lý ký tự đặc biệt mặc định được bật (ví dụ: biên dịch các ký tự CR, NL và EOF; bật tính năng chỉnh sửa dòng; xử lý các ký tự tạo tín hiệu; ICRNL; OCRNL; v.v.).

Chế độ Raw thì ngược lại: chế độ phi chuẩn tắc (noncanonical mode), với toàn bộ quá trình xử lý đầu vào và đầu ra, cũng như tính năng phản hồi (echoing), bị tắt hoàn toàn. (Một ứng dụng cần đảm bảo rằng trình điều khiển terminal tuyệt đối không thực hiện bất kỳ thay đổi nào đối với dữ liệu được truyền qua đường truyền nối tiếp (serial line) sẽ sử dụng chế độ này).

Chế độ Cbreak nằm ở trung gian giữa chế độ cooked và raw. Đầu vào ở chế độ phi chuẩn tắc (noncanonical), nhưng các ký tự tạo tín hiệu vẫn được biên dịch, và các phép biến đổi đầu vào/đầu ra khác nhau vẫn có thể xảy ra (tùy thuộc vào thiết lập của từng cờ riêng lẻ). Chế độ Cbreak không vô hiệu hóa tính năng phản hồi (echoing), nhưng các ứng dụng sử dụng chế độ này thường cũng sẽ vô hiệu hóa echo. Chế độ Cbreak rất hữu ích trong các ứng dụng xử lý màn hình (chẳng hạn như `less`) cho phép nhập dữ liệu theo từng ký tự, nhưng vẫn cần cho phép biên dịch các ký tự như `INTR`, `QUIT` và `SUSP`.

### Ví dụ: thiết lập chế độ raw và cbreak

Trong trình điều khiển terminal của Seventh Edition và BSD nguyên bản, có thể chuyển sang chế độ raw hoặc cbreak bằng cách tinh chỉnh các bit đơn lẻ (được gọi là `RAW` và `CBREAK`) trong các cấu trúc dữ liệu của trình điều khiển terminal. Khi chuyển đổi sang giao diện POSIX termios (hiện được hỗ trợ trên tất cả các hệ triển khai UNIX), các bit đơn lẻ để chọn chế độ raw và cbreak không còn khả dụng nữa và các ứng dụng mô phỏng các chế độ này phải thay đổi tường minh (explicitly) các trường bắt buộc của cấu trúc `termios`. [Liệt kê 62-3](#page-21-0) cung cấp hai hàm, `ttySetCbreak()` và `ttySetRaw()`, thực hiện các chức năng tương đương với các chế độ terminal này.

> Các ứng dụng sử dụng thư viện `ncurses` có thể gọi các hàm `cbreak()` và `raw()`, những hàm này thực hiện các tác vụ tương tự như các hàm của chúng ta trong [Liệt kê 62-3](#page-21-0).

**Liệt kê 62-3:** Chuyển đổi terminal sang chế độ cbreak và raw

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––––tty/tty_functions.c

## include <termios.h>

## include <unistd.h>

## include "tty_functions.h" /* Declares functions defined here */

```

/* Place terminal referred to by 'fd' in cbreak mode (noncanonical mode
with echoing turned off). This function assumes that the terminal is
currently in cooked mode (i.e., we shouldn't call it if the terminal
is currently in raw mode, since it does not undo all of the changes
made by the ttySetRaw() function below). Return 0 on success, or -1
on error. If 'prevTermios' is non-NULL, then use the buffer to which
it points to return the previous terminal settings. */
int
ttySetCbreak(int fd, struct termios *prevTermios)
{
struct termios t;
if (tcgetattr(fd, &t) == -1)
return -1;
if (prevTermios != NULL)
*prevTermios = t;
t.c_lflag &= ~(ICANON | ECHO);
t.c_lflag |= ISIG;
t.c_iflag &= ~ICRNL;

```

```c

t.c_cc[VMIN] = 1; /* Character-at-a-time input */
t.c_cc[VTIME] = 0; /* with blocking */
if (tcsetattr(fd, TCSAFLUSH, &t) == -1)
return -1;
return 0;
}
/* Place terminal referred to by 'fd' in raw mode (noncanonical mode
with all input and output processing disabled). Return 0 on success,
or -1 on error. If 'prevTermios' is non-NULL, then use the buffer to
which it points to return the previous terminal settings. */
int
ttySetRaw(int fd, struct termios *prevTermios)
{
struct termios t;
if (tcgetattr(fd, &t) == -1)
return -1;
if (prevTermios != NULL)
*prevTermios = t;
t.c_lflag &= ~(ICANON | ISIG | IEXTEN | ECHO);
/* Noncanonical mode, disable signals, extended
input processing, and echoing */
t.c_iflag &= ~(BRKINT | ICRNL | IGNBRK | IGNCR | INLCR |
INPCK | ISTRIP | IXON | PARMRK);
/* Disable special handling of CR, NL, and BREAK.
No 8th-bit stripping or parity error handling.
Disable START/STOP output flow control. */
t.c_oflag &= ~OPOST; /* Disable all output processing */
t.c_cc[VMIN] = 1; /* Character-at-a-time input */
t.c_cc[VTIME] = 0; /* with blocking */
if (tcsetattr(fd, TCSAFLUSH, &t) == -1)
return -1;
return 0;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––tty/tty_functions.c

```

Một chương trình đưa terminal vào chế độ `raw` hoặc `cbreak` (raw/cbreak mode) phải cẩn thận khôi phục terminal về trạng thái có thể sử dụng được khi nó kết thúc (terminates). Trong số các tác vụ khác, việc này đòi hỏi phải xử lý tất cả các tín hiệu (signals) có khả năng được gửi tới chương trình, sao cho chương trình không bị kết thúc sớm. (Các tín hiệu điều khiển công việc - job-control signals vẫn có thể được tạo ra từ bàn phím ở chế độ `cbreak`).

Một ví dụ về cách thực hiện việc này được cung cấp trong [Listing 62-4.](#page-24-0) Chương trình này thực hiện các bước sau:

- Đặt terminal sang chế độ `cbreak` o hoặc chế độ `raw` d, tùy thuộc vào việc có đối dòng lệnh (command-line argument) (bất kỳ chuỗi nào) được cung cấp hay không i. Các thiết lập terminal trước đó được lưu trong biến toàn cục `userTermios` q.
- Nếu terminal được đưa vào chế độ `cbreak`, thì các tín hiệu có thể được tạo ra từ terminal. Các tín hiệu này cần được xử lý sao cho việc kết thúc hoặc tạm dừng (suspending) chương trình sẽ để lại terminal ở trạng thái mà người dùng mong đợi. Chương trình cài đặt cùng một trình xử lý (handler) cho SIGQUIT và SIGINT a. Tín hiệu SIGTSTP yêu cầu xử lý đặc biệt, vì vậy một trình xử lý khác được cài đặt cho tín hiệu đó s.
- Cài đặt một trình xử lý cho tín hiệu SIGTERM, nhằm bắt tín hiệu mặc định được gửi bởi lệnh `kill` f.
- Thực thi một vòng lặp đọc từng ký tự một từ `stdin` và hiển thị (echoes) chúng ra đầu ra chuẩn (standard output) g. Chương trình xử lý các ký tự đầu vào khác nhau một cách đặc biệt trước khi xuất chúng h:
  - Tất cả các chữ cái được chuyển đổi thành chữ thường (lowercase) trước khi được xuất ra.
  - Các ký tự xuống dòng (`\n`) và về đầu dòng (`\r`) được hiển thị mà không thay đổi.
  - Các ký tự điều khiển (Control characters) ngoại trừ ký tự xuống dòng và về đầu dòng được hiển thị dưới dạng chuỗi 2 ký tự: dấu mũ (`^`) cộng với chữ cái in hoa tương ứng (ví dụ: Control-A hiển thị là `^A`).
  - Tất cả các ký tự khác được hiển thị dưới dạng dấu hoa thị (`*`).
  - Chữ cái `q` làm cho vòng lặp kết thúc j.
- Khi thoát khỏi vòng lặp, khôi phục terminal về trạng thái được thiết lập gần nhất bởi người dùng, và sau đó kết thúc k.

Chương trình cài đặt cùng một trình xử lý cho SIGQUIT, SIGINT và SIGTERM. Trình xử lý này khôi phục terminal về trạng thái được thiết lập gần nhất bởi người dùng và kết thúc chương trình w.

Trình xử lý cho tín hiệu SIGTSTP e xử lý tín hiệu theo cách được mô tả trong Mục 34.7.3. Lưu ý các chi tiết bổ sung sau đây về hoạt động của trình xử lý tín hiệu này:

- Khi bắt đầu, trình xử lý lưu các thiết lập terminal hiện tại (vào `ourTermios`) r, và sau đó thiết lập lại terminal về các thiết lập có hiệu lực (được lưu trong `userTermios`) khi chương trình được khởi động t, trước khi một lần nữa phát ra (raising) SIGTSTP để thực sự dừng tiến trình (process).
- Khi tiếp tục thực thi sau khi nhận được SIGCONT, trình xử lý một lần nữa lưu các thiết lập terminal hiện tại vào `userTermios` y, vì người dùng có thể đã thay đổi các thiết lập trong khi chương trình đang dừng (ví dụ: sử dụng lệnh `stty`). Trình xử lý sau đó trả terminal về trạng thái (`ourTermios`) được yêu cầu bởi chương trình u.

```c

–––––––––––––––––––––––––––––––––––––––––––––––––– tty/test_tty_functions.c

## include <termios.h>

## include <signal.h>

## include <ctype.h>

## include "tty_functions.h" /* Declarations of ttySetCbreak() and ttySetRaw() */

## include "tlpi_hdr.h"

static struct termios userTermios; /* Terminal settings as defined by user */

static void /* General handler: restore tty settings and exit */
handler(int sig)
{
if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &userTermios) == -1)
errExit("tcsetattr");
_exit(EXIT_SUCCESS);
}

```

static void /* Handler for SIGTSTP */
e tstpHandler(int sig)
{
struct termios ourTermios; /* To save our tty settings */
sigset_t tstpMask, prevMask;
struct sigaction sa;
int savedErrno;
savedErrno = errno; /* We might change 'errno' here */
/* Save current terminal settings, restore terminal to
state at time of program startup */
r if (tcgetattr(STDIN_FILENO, &ourTermios) == -1)
errExit("tcgetattr");
t if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &userTermios) == -1)
errExit("tcsetattr");
/* Set the disposition of SIGTSTP to the default, raise the signal
once more, and then unblock it so that we actually stop */
if (signal(SIGTSTP, SIG_DFL) == SIG_ERR)
errExit("signal");
raise(SIGTSTP);
sigemptyset(&tstpMask);
sigaddset(&tstpMask, SIGTSTP);
if (sigprocmask(SIG_UNBLOCK, &tstpMask, &prevMask) == -1)
errExit("sigprocmask");
/* Execution resumes here after SIGCONT */
if (sigprocmask(SIG_SETMASK, &prevMask, NULL) == -1)
errExit("sigprocmask"); /* Reblock SIGTSTP */

```

```c

sigemptyset(&sa.sa_mask); /* Reestablish handler */
sa.sa_flags = SA_RESTART;
sa.sa_handler = tstpHandler;
if (sigaction(SIGTSTP, &sa, NULL) == -1)
errExit("sigaction");
/* The user may have changed the terminal settings while we were
stopped; save the settings so we can restore them later */
y if (tcgetattr(STDIN_FILENO, &userTermios) == -1)
errExit("tcgetattr");
/* Restore our terminal settings */
u if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &ourTermios) == -1)
errExit("tcsetattr");
errno = savedErrno;
}
int
main(int argc, char *argv[])
{
char ch;
struct sigaction sa, prev;
ssize_t n;
sigemptyset(&sa.sa_mask);
sa.sa_flags = SA_RESTART;
i if (argc > 1) { /* Use cbreak mode */
o if (ttySetCbreak(STDIN_FILENO, &userTermios) == -1)
errExit("ttySetCbreak");
/* Terminal special characters can generate signals in cbreak
mode. Catch them so that we can adjust the terminal mode.
We establish handlers only if the signals are not being ignored. */
a sa.sa_handler = handler;
if (sigaction(SIGQUIT, NULL, &prev) == -1)
errExit("sigaction");
if (prev.sa_handler != SIG_IGN)
if (sigaction(SIGQUIT, &sa, NULL) == -1)
errExit("sigaction");
if (sigaction(SIGINT, NULL, &prev) == -1)
errExit("sigaction");
if (prev.sa_handler != SIG_IGN)
if (sigaction(SIGINT, &sa, NULL) == -1)
errExit("sigaction");
s sa.sa_handler = tstpHandler;

```

```c

if (sigaction(SIGTSTP, NULL, &prev) == -1)
errExit("sigaction");
if (prev.sa_handler != SIG_IGN)
if (sigaction(SIGTSTP, &sa, NULL) == -1)
errExit("sigaction");
} else { /* Use raw mode */
d if (ttySetRaw(STDIN_FILENO, &userTermios) == -1)
errExit("ttySetRaw");
}
f sa.sa_handler = handler;
if (sigaction(SIGTERM, &sa, NULL) == -1)
errExit("sigaction");
setbuf(stdout, NULL); /* Disable stdout buffering */
g for (;;) { /* Read and echo stdin */
n = read(STDIN_FILENO, &ch, 1);
if (n == -1) {
errMsg("read");
break;
}
if (n == 0) /* Can occur after terminal disconnect */
break;
h if (isalpha((unsigned char) ch)) /* Letters --> lowercase */
putchar(tolower((unsigned char) ch));
else if (ch == '\n' || ch == '\r')
putchar(ch);
else if (iscntrl((unsigned char) ch))
printf("^%c", ch ^ 64); /* Echo Control-A as ^A, etc. */
else
putchar('*'); /* All other chars as '*' */
j if (ch == 'q') /* Quit loop */
break;
}
k if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &userTermios) == -1)
errExit("tcsetattr");
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––– tty/test_tty_functions.c

```

Dưới đây là một ví dụ về những gì chúng ta thấy khi yêu cầu chương trình trong Liệt kê (Listing) 62-4 sử dụng chế độ thô (raw mode):

```

$ stty Initial terminal mode is sane (cooked)
speed 38400 baud; line = 0;
$ ./test_tty_functions
abc Type abc, and Control-J
def Type DEF, Control-J, and Enter

```

**^C^Z** Nhập Control-C, Control-Z và Control-J

**q**\$ Nhập q để thoát

Ở dòng cuối cùng của phiên shell trước, chúng ta thấy rằng shell đã in dấu nhắc lệnh (prompt) của nó trên cùng một dòng với ký tự `q` đã khiến chương trình chấm dứt (terminate).

Phần sau đây cho thấy một ví dụ chạy sử dụng chế độ cbreak (cbreak mode):

```

$ ./test_tty_functions x
XYZ Type XYZ and Control-Z
[1]+ Stopped ./test_tty_functions x
$ stty Verify that terminal mode was restored
speed 38400 baud; line = 0;
$ fg Resume in foreground
./test_tty_functions x
*** Type 123 and Control-J
$ Type Control-C to terminate program
Press Enter to get next shell prompt
$ stty Verify that terminal mode was restored
speed 38400 baud; line = 0;

```

## 62.7 Tốc độ Đường truyền Terminal (Tốc độ truyền bit - Bit Rate)

Các terminal khác nhau (và các đường truyền nối tiếp - serial lines) có khả năng truyền và nhận ở các tốc độ khác nhau (tính bằng bit trên giây). Các hàm `cfgetispeed()` và `cfsetispeed()` dùng để truy xuất và sửa đổi tốc độ đường truyền đầu vào (input line speed). Các hàm `cfgetospeed()` và `cfsetospeed()` dùng để truy xuất và sửa đổi tốc độ đường truyền đầu ra (output line speed).

> Thuật ngữ baud thường được sử dụng như một từ đồng nghĩa với tốc độ đường truyền terminal (tính bằng bit trên giây), mặc dù cách sử dụng này không hoàn toàn chính xác về mặt kỹ thuật. Chính xác hơn, baud là tốc độ (mỗi giây) mà tại đó các thay đổi tín hiệu có thể xảy ra trên đường truyền, điều này không nhất thiết giống với số lượng bit được truyền mỗi giây, vì tốc độ thứ hai phụ thuộc vào cách các bit được mã hóa thành tín hiệu. Tuy nhiên, thuật ngữ baud vẫn tiếp tục được sử dụng đồng nghĩa với tốc độ bit (bit trên giây). (Thuật ngữ tốc độ baud - baud rate đôi khi cũng được dùng đồng nghĩa với baud, nhưng điều này bị dư thừa; bản thân baud theo định nghĩa đã là một tốc độ rồi.) Để tránh nhầm lẫn, chúng ta thường sẽ sử dụng các thuật ngữ như tốc độ đường truyền (line speed) hoặc tốc độ bit (bit rate).

```

## include <termios.h>

speed_t cfgetispeed(const struct termios *termios_p);
speed_t cfgetospeed(const struct termios *termios_p);
Cả hai đều trả về tốc độ đường truyền từ cấu trúc termios đã cho
int cfsetospeed(struct termios *termios_p, speed_t speed);
int cfsetispeed(struct termios *termios_p, speed_t speed);
Cả hai đều trả về 0 khi thành công, hoặc –1 khi lỗi

```

Mỗi hàm này hoạt động trên một cấu trúc `termios` mà cấu trúc đó phải được khởi tạo trước đó bằng một lệnh gọi đến `tcgetattr()`.

Ví dụ, để tìm tốc độ đường truyền đầu ra hiện tại của terminal, chúng ta sẽ thực hiện các bước sau:

```

struct termios tp;
speed_t rate;
if (tcgetattr(fd, &tp) == -1)
errExit("tcgetattr");
rate = cfgetospeed(&tp);
if (rate == -1)
errExit("cfgetospeed");

```

Nếu sau đó chúng ta muốn thay đổi tốc độ đường truyền này, chúng ta sẽ tiếp tục như sau:

```

if (cfsetospeed(&tp, B38400) == -1)
errExit("cfsetospeed");
if (tcsetattr(fd, TCSAFLUSH, &tp) == -1)
errExit("tcsetattr");

```

Kiểu dữ liệu `speed_t` được sử dụng để lưu trữ tốc độ đường truyền. Thay vì gán trực tiếp các giá trị số cho tốc độ đường truyền, một tập hợp các hằng số tượng trưng (được định nghĩa trong `<termios.h>`) được sử dụng. Các hằng số này xác định một chuỗi các giá trị rời rạc. Một số ví dụ về các hằng số này là `B300`, `B2400`, `B9600` và `B38400`, tương ứng với các tốc độ đường truyền lần lượt là 300, 2400, 9600 và 38.400 bit trên giây. Việc sử dụng một tập hợp các giá trị rời rạc phản ánh thực tế rằng các terminal thường được thiết kế để hoạt động với một tập hợp giới hạn các tốc độ đường truyền khác nhau (được tiêu chuẩn hóa), bắt nguồn từ việc chia một tốc độ cơ sở nào đó (ví dụ: 115.200 là mức điển hình trên PC) cho các giá trị nguyên (ví dụ: 115.200 / 12 = 9600).

SUSv3 quy định rằng tốc độ đường truyền terminal (terminal line speeds) được lưu trữ trong cấu trúc termios, nhưng (có chủ ý) không chỉ định vị trí cụ thể. Nhiều hệ thống triển khai, bao gồm cả Linux, duy trì các giá trị này trong trường `c_cflag`, sử dụng mặt nạ (mask) `CBAUD` và cờ (flag) `CBAUDEX`. (Trong Mục [62.2](#page-2-0), chúng ta đã lưu ý rằng các trường phi tiêu chuẩn `c_ispeed` và `c_ospeed` của cấu trúc termios trên Linux không được sử dụng.)

Mặc dù các hàm cfsetispeed() và cfsetospeed() cho phép chỉ định tốc độ đường truyền đầu vào và đầu ra tách biệt, trên nhiều terminal, hai tốc độ này bắt buộc phải giống nhau. Hơn nữa, Linux chỉ sử dụng một trường duy nhất để lưu trữ tốc độ đường truyền (tức là hai mức tốc độ này được giả định là luôn luôn giống nhau), điều này có nghĩa là tất cả các hàm tốc độ đường truyền đầu vào và đầu ra đều truy cập vào cùng một trường termios.

> Việc chỉ định tốc độ bằng 0 trong lời gọi hàm cfsetispeed() có nghĩa là "đặt tốc độ đầu vào bằng bất kỳ tốc độ đầu ra nào khi tcsetattr() được gọi sau đó." Điều tính năng này hữu ích trên các hệ thống nơi mà hai tốc độ đường truyền được duy trì như các giá trị riêng biệt.

## 62.8 Điều khiển Đường truyền Terminal (Terminal Line Control)

Các hàm tcsendbreak(), tcdrain(), tcflush(), và tcflow() thực hiện các tác vụ mà thông thường được nhóm chung lại dưới thuật ngữ điều khiển đường truyền (line control). (Các hàm này là các phát minh của POSIX được thiết kế để thay thế các thao tác ioctl() khác nhau.)

```c

## include <termios.h>

int tcsendbreak(int fd, int duration);
int tcdrain(int fd);
int tcflush(int fd, int queue_selector);
int tcflow(int fd, int action);
Tất cả đều trả về 0 khi thành công, hoặc –1 khi có lỗi

```

Trong mỗi hàm, `fd` là một tệp mô tả (file descriptor) trỏ đến một terminal hoặc thiết bị từ xa khác trên đường truyền nối tiếp (serial line).

Hàm tcsendbreak() tạo ra một điều kiện BREAK, bằng cách truyền một luồng liên tục các bit 0. Đối số `duration` chỉ định độ dài của quá trình truyền. Nếu `duration` bằng 0, các bit 0 sẽ được truyền trong 0.25 giây. (SUSv3 quy định ít nhất là 0.25 và không quá 0.5 giây.) Nếu `duration` lớn hơn 0, các bit 0 sẽ được truyền trong khoảng thời gian bằng `duration` mili-giây. SUSv3 không quy định chi tiết trường hợp này; việc xử lý giá trị `duration` khác 0 có sự khác biệt lớn trên các hệ thống triển khai UNIX khác (các chi tiết được mô tả ở đây là dành cho glibc).

Hàm tcdrain() thực hiện chặn (block) cho đến khi tất cả dữ liệu đầu ra đã được truyền đi (tức là cho đến khi hàng đợi đầu ra của terminal được làm trống).

Hàm tcflush() xóa (hủy bỏ) dữ liệu trong hàng đợi đầu vào của terminal, hàng đợi đầu ra của terminal, hoặc cả hai hàng đợi (xem Hình 62-1). Việc xóa hàng đợi đầu vào sẽ hủy bỏ dữ liệu đã được trình điều khiển terminal (terminal driver) nhận nhưng chưa được đọc bởi bất kỳ tiến trình (process) nào. Ví dụ, một ứng dụng có thể sử dụng tcflush() để loại bỏ dữ liệu nhập trước (type-ahead) của terminal trước khi hiển thị lời nhắc nhập mật khẩu. Việc xóa hàng đợi đầu ra sẽ hủy bỏ dữ liệu đã được ghi (được chuyển đến trình điều khiển terminal) nhưng chưa được truyền đến thiết bị. Đối số `queue_selector` chỉ định một trong các giá trị được hiển thị trong [Bảng 62-4](#page-29-0).

> Lưu ý rằng thuật ngữ xóa (flush) được sử dụng theo một ý nghĩa khác với tcflush() so với khi nói về I/O tệp (file I/O). Đối với I/O tệp, việc flush có nghĩa là ép buộc dữ liệu đầu ra phải được chuyển từ bộ nhớ không gian người dùng (user-space memory) sang bộ đệm cache (buffer cache) trong trường hợp của hàm stdio fflush(), hoặc từ bộ đệm cache xuống đĩa cứng trong trường hợp của fsync(), fdatasync(), và sync().

**Bảng 62-4:** Các giá trị cho đối số `queue_selector` của hàm tcflush()

| Giá trị | Mô tả |
|---|---|
| TCIFLUSH | Xóa hàng đợi đầu vào |
| TCOFLUSH | Xóa hàng đợi đầu ra |
| TCIOFFLUSH | Xóa cả hai hàng đợi đầu vào và đầu ra |

Hàm tcflow() điều khiển luồng dữ liệu theo cả hai hướng giữa máy tính và terminal (hoặc thiết bị từ xa khác). Đối số `action` là một trong các giá trị được hiển thị trong [Bảng 62-5](#page-30-0). Các giá trị `TCIOFF` và `TCION` chỉ có hiệu lực nếu terminal có khả năng diễn giải các ký tự STOP và START, trong trường hợp đó các thao tác này sẽ khiến terminal tạm dừng và tiếp tục gửi dữ liệu đến máy tính.

**Bảng 62-5:** Các giá trị cho đối số `action` của hàm tcflow()

| Giá trị | Mô tả |
|---|---|
| TCOOFF | Tạm dừng đầu ra đến terminal |
| TCOON | Tiếp tục đầu ra đến terminal |
| TCIOFF | Truyền một ký tự STOP đến terminal |
| TCION | Truyền một ký tự START đến terminal |

## 62.9 Kích thước Cửa sổ Terminal

Trong môi trường giao diện cửa sổ (windowing environment), một ứng dụng xử lý màn hình cần phải có khả năng theo dõi kích thước của cửa sổ terminal (terminal window), để màn hình có thể được vẽ lại một cách phù hợp nếu người dùng thay đổi kích thước cửa sổ. Kernel cung cấp hai cơ chế hỗ trợ để cho phép điều này diễn ra:

- Một tín hiệu (signal) `SIGWINCH` được gửi đến tiến trình nhóm foreground (foreground process group) sau khi kích thước cửa sổ terminal thay đổi. Theo mặc định, tín hiệu này bị bỏ qua.
- Tại bất kỳ thời điểm nào—thường là sau khi nhận được tín hiệu `SIGWINCH`—một tiến trình có thể sử dụng thao tác `ioctl()` với cờ `TIOCGWINSZ` để tìm kích thước hiện tại của cửa sổ terminal.

Thao tác `ioctl()` `TIOCGWINSZ` được sử dụng như sau:

```c

if (ioctl(fd, TIOCGWINSZ, &ws) == -1)
errExit("ioctl");

```

Đối số `fd` là một file descriptor (mô tả tệp) tham chiếu đến một cửa sổ terminal. Đối số cuối cùng của `ioctl()` là một con trỏ trỏ đến cấu trúc `winsize` (được định nghĩa trong `<sys/ioctl.h>`), được sử dụng để trả về kích thước cửa sổ terminal:

```c

struct winsize {
unsigned short ws_row; /* Số hàng (ký tự) */
unsigned short ws_col; /* Số cột (ký tự) */
unsigned short ws_xpixel; /* Kích thước ngang (pixel) */
unsigned short ws_ypixel; /* Kích thước dọc (pixel) */
};

```

Giống như nhiều hệ thống triển khai khác, Linux không sử dụng các trường kích thước theo pixel của cấu trúc `winsize`.

[Listing 62-5](#page-31-0) minh họa việc sử dụng tín hiệu `SIGWINCH` và thao tác `ioctl()` `TIOCGWINSZ`. Phần dưới đây hiển thị ví dụ về đầu ra được tạo ra khi chương trình này chạy dưới một trình quản lý cửa sổ (window manager) và kích thước cửa sổ terminal bị thay đổi ba lần:

### \$ **./demo\_SIGWINCH**

```text

Caught SIGWINCH, new window size: 35 rows * 80 columns
Caught SIGWINCH, new window size: 35 rows * 73 columns
Caught SIGWINCH, new window size: 22 rows * 73 columns
Type Control-C to terminate program

```

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––– tty/demo_SIGWINCH.c

## include <signal.h>

## include <termios.h>

## include <sys/ioctl.h>

## include "tlpi_hdr.h"

static void
sigwinchHandler(int sig)
{
}
int
main(int argc, char *argv[])
{
struct winsize ws;
struct sigaction sa;
sigemptyset(&sa.sa_mask);
sa.sa_flags = 0;
sa.sa_handler = sigwinchHandler;
if (sigaction(SIGWINCH, &sa, NULL) == -1)
errExit("sigaction");
for (;;) {
pause(); /* Đợi tín hiệu SIGWINCH */
if (ioctl(STDIN_FILENO, TIOCGWINSZ, &ws) == -1)
errExit("ioctl");
printf("Caught SIGWINCH, new window size: "
"%d rows * %d columns\n", ws.ws_row, ws.ws_col);
}
}

```

Cũng có thể thay đổi khái niệm của trình điều khiển terminal (terminal driver) về kích thước cửa sổ bằng cách truyền một cấu trúc `winsize` đã được khởi tạo trong thao tác `ioctl()` với `TIOCSWINSZ`:

–––––––––––––––––––––––––––––––––––––––––––––––––––––– **tty/demo\_SIGWINCH.c**

```c

ws.ws_row = 40;
ws.ws_col = 100;
if (ioctl(fd, TIOCSWINSZ, &ws) == -1)
errExit("ioctl");

```

Nếu các giá trị mới trong cấu trúc `winsize` khác với khái niệm hiện tại của trình điều khiển terminal về kích thước cửa sổ terminal, hai điều sẽ xảy ra:

- Các cấu trúc dữ liệu của trình điều khiển terminal được cập nhật bằng cách sử dụng các giá trị được cung cấp trong đối số `ws`.
- Một tín hiệu `SIGWINCH` được gửi đến tiến trình nhóm foreground của terminal.

Tuy nhiên, cần lưu ý rằng bản thân các sự kiện này là chưa đủ để thay đổi kích thước thực tế của cửa sổ đang hiển thị, vốn được điều khiển bởi phần mềm nằm ngoài kernel (chẳng hạn như trình quản lý cửa sổ hoặc chương trình giả lập terminal - terminal emulator).

Mặc dù không được chuẩn hóa trong SUSv3, hầu hết các hệ thống triển khai UNIX đều cung cấp quyền truy cập vào kích thước cửa sổ terminal bằng cách sử dụng các thao tác `ioctl()` được mô tả trong phần này.

## 62.10 Nhận diện Terminal

Trong Mục 34.4, chúng ta đã mô tả hàm ctermid(), trả về tên của terminal điều khiển (controlling terminal) cho một tiến trình (`process`) (thường là /dev/tty trên các hệ thống UNIX). Các hàm được mô tả trong mục này cũng hữu ích để nhận diện một terminal.

Hàm isatty() cho phép chúng ta xác định xem một file descriptor (`file descriptor`), fd, có được liên kết với một terminal hay không (khác với các loại tệp khác).

```

## include <unistd.h>

int isatty(int fd);
Trả về giá trị true (1) nếu fd liên kết với terminal, ngược lại trả về false (0)

```

Hàm isatty() rất hữu ích trong các trình soạn thảo (editors) và các chương trình xử lý màn hình khác cần xác định xem đầu vào và đầu ra chuẩn (`standard input and output`) của chúng có được chuyển hướng đến một terminal hay không.

Cho trước một file descriptor, hàm ttyname() trả về tên của thiết bị terminal được liên kết.

```

## include <unistd.h>

char *ttyname(int fd);
Trả về con trỏ tới chuỗi (được cấp phát tĩnh) chứa
tên terminal, hoặc NULL khi có lỗi

```

Để tìm tên của terminal, ttyname() sử dụng các hàm opendir() và readdir() được mô tả trong Mục 18.8 để duyệt qua các thư mục chứa tên thiết bị terminal, kiểm tra từng mục nhập thư mục (directory entry) cho đến khi tìm thấy mục nhập có ID thiết bị (trường `st_rdev` của cấu trúc `stat`) khớp với thiết bị được trỏ tới bởi file descriptor fd. Các mục nhập thiết bị terminal thường nằm trong hai thư mục: /dev và /dev/pts. Thư mục /dev chứa các mục nhập cho console ảo (ví dụ: /dev/tty1) và pseudoterminal BSD. Thư mục /dev/pts chứa các mục nhập cho các thiết bị phụ pseudoterminal (kiểu System V). (Chúng ta mô tả pseudoterminal trong Chương [64.](#page-86-0))

Một phiên bản tái nhập (`reentrant`) của ttyname() tồn tại dưới dạng ttyname_r().

Lệnh tty(1), hiển thị tên của terminal được trỏ tới bởi đầu vào chuẩn của nó, là lệnh tương đương trên dòng lệnh (`command-line`) của ttyname().

## 62.11 Tóm tắt

Trên các hệ thống UNIX thời kỳ đầu, các terminal là các thiết bị phần cứng thực sự được kết nối với máy tính thông qua các đường truyền nối tiếp (`serial lines`). Các terminal đời đầu không được chuẩn hóa, nghĩa là các chuỗi thoát (`escape sequences`) khác nhau là bắt buộc để lập trình các terminal do các nhà sản xuất khác nhau chế tạo. Trên các máy trạm hiện đại, các terminal này đã được thay thế bằng các màn hình bản đồ bit (`bitmapped monitors`) chạy Hệ thống X Window (`X Window System`). Tuy nhiên, khả năng lập trình terminal vẫn là cần thiết khi làm việc với các thiết bị ảo, chẳng hạn như console ảo và bộ mô phỏng terminal (`terminal emulators`) (sử dụng pseudoterminal), và các thiết bị thực được kết nối qua đường truyền nối tiếp.

Các thiết lập terminal (ngoại trừ kích thước cửa sổ terminal) được duy trì trong một cấu trúc kiểu termios, bao gồm bốn trường mặt nạ bit (`bit-mask fields`) điều khiển các thiết lập terminal khác nhau và một mảng xác định các ký tự đặc biệt khác nhau được diễn giải bởi trình điều khiển terminal (`terminal driver`). Các hàm tcgetattr() và tcsetattr() cho phép một chương trình truy xuất và sửa đổi các thiết lập terminal.

Khi thực hiện nhập dữ liệu, trình điều khiển terminal có thể hoạt động ở hai chế độ khác nhau. Ở chế độ chuẩn (`canonical mode`), đầu vào được tập hợp thành các dòng (được kết thúc bằng một trong các ký tự phân cách dòng) và tính năng chỉnh sửa dòng được bật. Ngược lại, chế độ phi chuẩn (`noncanonical mode`) cho phép một ứng dụng đọc đầu vào terminal từng ký tự một, mà không cần phải đợi người dùng gõ ký tự phân cách dòng. Chế độ chỉnh sửa dòng bị vô hiệu hóa ở chế độ phi chuẩn. Việc hoàn thành một thao tác đọc ở chế độ phi chuẩn được điều khiển bởi các trường MIN và TIME của cấu trúc termios, xác định số lượng ký tự tối thiểu cần đọc và thời gian chờ (`timeout`) áp dụng cho thao tác đọc. Chúng ta đã mô tả bốn trường hợp khác nhau cho hoạt động đọc phi chuẩn.

Về mặt lịch sử, các trình điều khiển terminal của phiên bản Seventh Edition và BSD cung cấp ba chế độ đầu vào—cooked, cbreak, và raw—thực hiện các mức độ xử lý khác nhau đối với đầu vào và đầu ra của terminal. Các chế độ Cbreak và raw có thể được mô phỏng bằng cách thay đổi các trường khác nhau trong cấu trúc termios.

Một loạt các hàm thực hiện các thao tác terminal khác nhau khác. Chúng bao gồm việc thay đổi tốc độ đường truyền terminal (`terminal line speed`) và thực hiện các thao tác điều khiển đường truyền (tạo điều kiện ngắt/break, tạm dừng cho đến khi đầu ra được truyền đi, xóa bộ đệm đầu vào và đầu ra của terminal, và tạm dừng hoặc tiếp tục truyền dữ liệu theo cả hai hướng giữa terminal và máy tính). Các hàm khác cho phép chúng ta kiểm tra xem một file descriptor cho trước có trỏ tới một terminal hay không và lấy tên của terminal đó. System Call (`system call`) ioctl() có thể được sử dụng để truy xuất và sửa đổi kích thước cửa sổ terminal được ghi nhận bởi nhân hệ điều hành (`kernel`), và thực hiện một loạt các thao tác liên quan đến terminal khác.

### Thông tin thêm

[Stevens, 1992] cũng mô tả việc lập trình terminal và đi sâu hơn rất nhiều vào chi tiết lập trình cổng nối tiếp (`serial ports`). Một số tài nguyên trực tuyến hữu ích thảo luận về lập trình terminal. Được lưu trữ tại trang web LDP (http://www.tldp.org) là Serial HOWTO và Text-terminal HOWTO, cả hai đều do David S. Lawyer viết. Một nguồn thông tin hữu ích khác là Serial Programming Guide for POSIX Operating Systems bởi Michael R. Sweet, có sẵn trực tuyến tại http://www.easysw.com/~mike/serial/.

## 62.12 Bài tập

- **62-1.** Triển khai hàm `isatty()`. (Bạn có thể thấy việc đọc phần mô tả của `tcgetattr()` trong Mục [62.2](#page-2-0) là hữu ích).
- **62-2.** Triển khai hàm `ttyname()`.
- **62-3.** Triển khai hàm `getpass()` đã được mô tả trong Mục 8.5. (Hàm `getpass()` có thể lấy một bộ mô tả tệp (file descriptor) cho terminal điều khiển bằng cách mở `/dev/tty`).
- **62-4.** Viết một chương trình hiển thị thông tin cho biết terminal được trỏ bởi đầu vào chuẩn (standard input) đang ở chế độ quy tắc (canonical mode) hay chế độ phi quy tắc (noncanonical mode). Nếu ở chế độ phi quy tắc, hãy hiển thị các giá trị của `TIME` và `MIN`.
