# Chương 40: Ghi nhận đăng nhập (Login Accounting)

Kế toán đăng nhập (login accounting) liên quan đến việc ghi lại những người dùng nào hiện đang đăng nhập vào hệ thống (system), và ghi lại các phiên đăng nhập (login) cũng như đăng xuất (logout) trong quá khứ. Chương này xem xét các tệp kế toán đăng nhập và các hàm thư viện (library function) được sử dụng để truy xuất và cập nhật thông tin mà chúng chứa đựng. Chúng tôi cũng mô tả các bước mà một ứng dụng cung cấp dịch vụ đăng nhập nên thực hiện để cập nhật các tệp này khi người dùng đăng nhập và đăng xuất.

## 40.1 Tổng quan về các tệp utmp và wtmp

Các hệ thống UNIX duy trì hai tệp dữ liệu chứa thông tin về việc người dùng đăng nhập và đăng xuất khỏi hệ thống (system):

- Tệp utmp duy trì bản ghi về những người dùng hiện đang đăng nhập vào hệ thống (cùng với một số thông tin khác mà chúng ta sẽ mô tả sau). Khi mỗi người dùng đăng nhập, một bản ghi được ghi vào tệp utmp. Một trong các trường (field) trong bản ghi này, `ut_user`, ghi lại tên đăng nhập (login name) của người dùng. Bản ghi này sau đó sẽ bị xóa khi người dùng đăng xuất. Các chương trình như who(1) sử dụng thông tin trong tệp utmp để hiển thị danh sách những người dùng hiện đang đăng nhập.
- Tệp wtmp là một dấu vết kiểm toán (audit trail) của tất cả các lần người dùng đăng nhập và đăng xuất (cùng với một số thông tin khác mà chúng ta mô tả sau). Trong mỗi lần đăng nhập, một bản ghi chứa cùng thông tin được ghi vào tệp utmp sẽ được nối thêm (appended) vào tệp wtmp. Khi đăng xuất, một bản ghi bổ sung được nối thêm vào tệp. Bản ghi này chứa thông tin tương tự, ngoại trừ việc trường `ut_user` được đặt về giá trị không (zeroed out). Lệnh last(1) có thể được sử dụng để hiển thị và lọc nội dung của tệp wtmp.

Trên Linux, tệp utmp nằm tại `/var/run/utmp`, và tệp wtmp nằm tại `/var/log/wtmp`. Nhìn chung, các ứng dụng không cần phải biết về các đường dẫn (pathname) này, vì chúng được biên dịch sẵn (compiled into) vào glibc. Các chương trình cần tham chiếu đến vị trí của các tệp này nên sử dụng các hằng số đường dẫn `_PATH_UTMP` và `_PATH_WTMP`, được định nghĩa trong `<paths.h>` (và `<utmpx.h>`), thay vì mã hóa cứng (hard-coding) các đường dẫn trực tiếp vào chương trình.

> [!NOTE]
> SUSv3 không chuẩn hóa bất kỳ tên ký hiệu nào cho đường dẫn của các tệp utmp và wtmp. Các tên `_PATH_UTMP` và `_PATH_WTMP` được sử dụng trên Linux và các hệ thống BSD. Nhiều cài đặt UNIX khác thay vào đó định nghĩa các hằng số `UTMP_FILE` và `WTMP_FILE` cho các đường dẫn này. Linux cũng định nghĩa các tên này trong `<utmp.h>`, nhưng không định nghĩa chúng trong `<utmpx.h>` hay `<paths.h>`.

## 40.2 Giao diện lập trình ứng dụng utmpx (utmpx API)

Các tệp utmp và wtmp đã xuất hiện trong hệ thống UNIX từ những ngày đầu, nhưng đã trải qua quá trình tiến hóa liên tục và phân kỳ giữa các phiên bản cài đặt UNIX khác nhau, đặc biệt là giữa BSD và System V. System V Release 4 đã mở rộng đáng kể API, qua đó tạo ra một cấu trúc `utmpx` mới (song song) cùng với các tệp `utmpx` và `wtmpx` liên quan. Ký tự `x` cũng được đưa vào tên của các tệp header (header file) và các hàm bổ sung để xử lý các tệp mới này. Nhiều cài đặt UNIX khác cũng thêm các phần mở rộng của riêng họ vào API.

Trong chương này, chúng tôi mô tả utmpx API của Linux, đây là một hệ lai (hybrid) giữa các bản cài đặt BSD và System V. Linux không tuân theo System V trong việc tạo ra các tệp utmpx và wtmpx song song; thay vào đó, các tệp utmp và wtmp chứa tất cả thông tin cần thiết. Tuy nhiên, để tương thích với các cài đặt UNIX khác, Linux cung cấp cả API utmp truyền thống lẫn API utmpx bắt nguồn từ System V để truy cập nội dung của các tệp này. Trên Linux, hai API này trả về thông tin hoàn toàn giống nhau. (Một trong số ít khác biệt giữa hai API này là utmp API chứa các phiên bản tái nhập (reentrant) của một số hàm, trong khi utmpx API thì không.) Tuy nhiên, chúng ta sẽ giới hạn thảo luận ở giao diện utmpx, vì đó là API được chỉ định trong SUSv3 và do đó được ưu tiên để đảm bảo tính di động (portability) sang các cài đặt UNIX khác.

Đặc tả SUSv3 không bao hàm tất cả các khía cạnh của utmpx API (ví dụ: vị trí của các tệp utmp và wtmp không được chỉ định). Nội dung chính xác của các tệp kế toán đăng nhập có phần khác nhau giữa các phiên bản cài đặt, và các cài đặt khác nhau cung cấp các hàm kế toán đăng nhập bổ sung không được quy định trong SUSv3.

> [!NOTE]
> Chương 17 của [Frisch, 2002] tóm tắt một số biến thể về vị trí và cách sử dụng của các tệp wtmp và utmp trên các cài đặt UNIX khác nhau. Nó cũng mô tả việc sử dụng lệnh ac(1), có thể được dùng để tổng hợp thông tin đăng nhập từ tệp wtmp.

## 40.3 Cấu trúc utmpx

Các tệp utmp và wtmp bao gồm các bản ghi (record) `utmpx`. Cấu trúc `utmpx` được định nghĩa trong `<utmpx.h>`, như được minh họa trong [Liệt kê 40-1](#page-86-0).

Đặc tả SUSv3 của cấu trúc `utmpx` không bao gồm các trường `ut_host`, `ut_exit`, `ut_session`, hoặc `ut_addr_v6`. Các trường `ut_host` và `ut_exit` hiện diện trên hầu hết các cài đặt (implementation) khác; `ut_session` có mặt trên một số ít cài đặt khác; và `ut_addr_v6` là đặc trưng của Linux (Linux-specific). SUSv3 định nghĩa các trường `ut_line` và `ut_user`, nhưng không quy định độ dài của chúng.

Kiểu dữ liệu `int32_t` được sử dụng để định nghĩa trường `ut_addr_v6` của cấu trúc `utmpx` là một số nguyên 32-bit (32-bit integer).

**Liệt kê 40-1:** Định nghĩa cấu trúc `utmpx`

## define _GNU_SOURCE /* Nếu không có _GNU_SOURCE, hai tên trường

struct exit_status { ở dưới sẽ có tiền tố "__" ở phía trước */
short e_termination; /* Trạng thái kết thúc tiến trình (signal) */
short e_exit; /* Trạng thái thoát của tiến trình */
};

## define __UT_LINESIZE 32

## define __UT_NAMESIZE 32

## define __UT_HOSTSIZE 256

struct utmpx {
short ut_type; /* Loại bản ghi */
pid_t ut_pid; /* PID của tiến trình đăng nhập */
char ut_line[__UT_LINESIZE]; /* Tên thiết bị terminal */
char ut_id[4]; /* Hậu tố từ tên terminal, hoặc
trường ID từ inittab(5) */
char ut_user[__UT_NAMESIZE]; /* Tên người dùng */
char ut_host[__UT_HOSTSIZE]; /* Tên máy cho đăng nhập từ xa, hoặc phiên bản
kernel cho thông báo mức chạy (run-level) */
struct exit_status ut_exit; /* Trạng thái thoát của tiến trình được đánh dấu
là DEAD_PROCESS (không được điền
bởi init(8) trên Linux) */
long ut_session; /* ID phiên làm việc (Session ID) */
struct timeval ut_tv; /* Thời điểm bản ghi được tạo */
int32_t ut_addr_v6[4]; /* Địa chỉ IP của máy chủ từ xa (địa chỉ IPv4
chỉ sử dụng ut_addr_v6[0],
các phần tử còn lại được đặt thành 0) */
char __unused[20]; /* Dành riêng cho sử dụng trong tương lai */
};

```

Mỗi trường chuỗi (string field) trong cấu trúc `utmpx` đều được kết thúc bằng ký tự null (null-terminated) trừ khi nó lấp đầy hoàn toàn mảng tương ứng.

Đối với các tiến trình đăng nhập (login process), thông tin được lưu trữ trong các trường `ut_line` và `ut_id` được suy ra từ tên của thiết bị terminal. Trường `ut_line` chứa tên tệp hoàn chỉnh của thiết bị terminal. Trường `ut_id` chứa phần hậu tố của tên tệp—tức là chuỗi theo sau `tty`, `pts`, hoặc `pty` (hai cái sau lần lượt dành cho các pseudoterminal kiểu System-V và BSD). Do đó, đối với terminal `/dev/tty2`, `ut_line` sẽ là `tty2` và `ut_id` sẽ là `2`.

Trong môi trường có giao diện cửa sổ (windowing environment), một số trình giả lập terminal (terminal emulator) sử dụng trường `ut_session` để ghi lại ID phiên làm việc (session ID) cho cửa sổ terminal. (Tham khảo Mục 34.3 để biết lời giải thích về session ID.)

Trường `ut_type` là một số nguyên xác định loại bản ghi đang được ghi vào tệp. Tập hợp các hằng số sau đây (với các giá trị số tương ứng được hiển thị trong ngoặc đơn) có thể được sử dụng làm giá trị cho trường này:

### EMPTY (0)

Bản ghi này không chứa thông tin kế toán (accounting information) hợp lệ.

### RUN\_LVL (1)

Bản ghi này cho biết sự thay đổi về mức chạy (run-level) của hệ thống trong quá trình khởi động hoặc tắt máy. (Thông tin về các mức chạy có thể được tìm thấy trong trang hướng dẫn (manual page) `init(8)`). Macro kiểm tra tính năng `_GNU_SOURCE` phải được định nghĩa để lấy được định nghĩa của hằng số này từ `<utmpx.h>`.

### BOOT\_TIME (2)

Bản ghi này chứa thời gian khởi động hệ thống trong trường `ut_tv`. Tiến trình thường khởi tạo và ghi các bản ghi `RUN_LVL` và `BOOT_TIME` là `init`. Các bản ghi này được ghi vào cả tệp utmp và tệp wtmp.

### NEW\_TIME (3)

Bản ghi này chứa thời gian mới sau khi thay đổi đồng hồ hệ thống, được ghi lại trong trường `ut_tv`.

### OLD\_TIME (4)

Bản ghi này chứa thời gian cũ trước khi thay đổi đồng hồ hệ thống, được ghi lại trong trường `ut_tv`. Các bản ghi loại `OLD_TIME` và `NEW_TIME` được ghi vào tệp utmp và wtmp bởi tiến trình nền (daemon) NTP (hoặc tương tự) khi nó thực hiện thay đổi đối với đồng hồ hệ thống.

### INIT\_PROCESS (5)

Đây là bản ghi cho một tiến trình được sinh ra (spawn) bởi `init`, chẳng hạn như tiến trình `getty`. Tham khảo trang hướng dẫn `inittab(5)` để biết chi tiết.

### LOGIN\_PROCESS (6)

Đây là bản ghi cho một tiến trình trưởng nhóm phiên làm việc (session leader process) dùng cho việc đăng nhập của người dùng, chẳng hạn như tiến trình `login(1)`.

### USER\_PROCESS (7)

Đây là bản ghi cho một tiến trình người dùng (user process), thường là một phiên đăng nhập, với tên người dùng xuất hiện trong trường `ut_user`. Phiên đăng nhập có thể được bắt đầu bởi `login(1)` hoặc bởi một ứng dụng nào đó cung cấp tiện ích đăng nhập từ xa, chẳng hạn như `ftp` hoặc `ssh`.

### DEAD\_PROCESS (8)

Bản ghi này xác định một tiến trình đã thoát (exited).

Chúng tôi hiển thị các giá trị số của các hằng số này vì nhiều ứng dụng phụ thuộc vào việc các hằng số có thứ tự số như trên. Ví dụ, trong mã nguồn của chương trình `agetty`, chúng ta bắt gặp các phép kiểm tra như sau:

```

utp->ut_type >= INIT_PROCESS && utp->ut_type <= DEAD_PROCESS

```

Các bản ghi loại `INIT_PROCESS` thường tương ứng với việc gọi `getty(8)` (hoặc một chương trình tương tự, chẳng hạn như `agetty(8)` hoặc `mingetty(8)`). Khi khởi động hệ thống, tiến trình `init` tạo ra một tiến trình con cho mỗi đường truyền terminal (terminal line) và console ảo, và mỗi tiến trình con sẽ gọi `exec` chương trình `getty`. Chương trình `getty` mở terminal, nhắc người dùng nhập tên đăng nhập, và sau đó gọi `exec` `login(1)`. Sau khi xác thực thành công người dùng và thực hiện các bước khác nhau, `login` tạo ra một tiến trình con (fork) gọi `exec` shell đăng nhập của người dùng. Toàn bộ vòng đời của một phiên đăng nhập như vậy được thể hiện bằng bốn bản ghi được ghi vào tệp wtmp theo thứ tự sau:

- một bản ghi `INIT_PROCESS`, được ghi bởi `init`;
- một bản ghi `LOGIN_PROCESS`, được ghi bởi `getty`;
- một bản ghi `USER_PROCESS`, được ghi bởi `login`; và
- một bản ghi `DEAD_PROCESS`, được ghi bởi `init` khi nó phát hiện tiến trình (process) con `login` kết thúc (xảy ra khi người dùng đăng xuất).

Các chi tiết bổ sung về hoạt động của `getty` và `login` trong quá trình người dùng đăng nhập có thể được tìm thấy trong Chương 9 của [Stevens & Rago, 2005].

> Một số phiên bản của `init` khởi tạo (spawn) tiến trình `getty` trước khi cập nhật tệp `wtmp`. Do đó, `init` và `getty` tranh chấp (race) với nhau để cập nhật tệp `wtmp`, dẫn đến việc các bản ghi `INIT_PROCESS` và `LOGIN_PROCESS` có thể được ghi theo thứ tự ngược lại so với mô tả trong phần chính.

## 40.4 Truy xuất thông tin từ các tệp utmp và wtmp

Các hàm được mô tả trong phần này truy xuất các bản ghi từ các tệp chứa các bản ghi định dạng utmpx. Theo mặc định, các hàm này sử dụng tệp `utmp` tiêu chuẩn, nhưng điều này có thể được thay đổi bằng cách sử dụng hàm `utmpxname()` (được mô tả bên dưới).

Các hàm này áp dụng khái niệm vị trí hiện tại trong tệp mà từ đó chúng đang truy xuất các bản ghi. Vị trí này được cập nhật bởi mỗi hàm.

Hàm `setutxent()` đưa con trỏ tệp `utmp` quay lại vị trí ban đầu.

## include <utmpx.h>
void setutxent(void);
```

Thông thường, chúng ta nên gọi `setutxent()` trước khi sử dụng bất kỳ hàm `getutx*()` nào (được mô tả bên dưới). Điều này giúp ngăn ngừa sự nhầm lẫn có thể xảy ra nếu một hàm của bên thứ ba nào đó mà chúng ta đã gọi trước đó đã sử dụng các hàm này. Tùy thuộc vào tác vụ được thực hiện, việc gọi lại `setutxent()` tại các thời điểm thích hợp sau đó trong chương trình cũng có thể là cần thiết.

Hàm `setutxent()` và các hàm `getutx*()` sẽ mở tệp `utmp` nếu nó chưa được mở. Khi chúng ta đã sử dụng xong tệp, chúng ta có thể đóng nó lại bằng hàm `endutxent()`.

## include <utmpx.h>

void endutxent(void);

```

Các hàm `getutxent()`, `getutxid()`, và `getutxline()` đọc một bản ghi từ tệp `utmp` và trả về một con trỏ trỏ đến một cấu trúc (structure) `utmpx` (được cấp phát tĩnh).

## include <utmpx.h>
struct utmpx *getutxent(void);
struct utmpx *getutxid(const struct utmpx *ut);
struct utmpx *getutxline(const struct utmpx *ut);
                     Tất cả đều trả về một con trỏ trỏ đến cấu trúc utmpx được cấp phát tĩnh,
                          hoặc NULL nếu không tìm thấy bản ghi phù hợp hoặc gặp ký tự kết thúc tệp EOF
```

Hàm `getutxent()` truy xuất bản ghi tuần tự tiếp theo từ tệp `utmp`. Các hàm `getutxid()` và `getutxline()` thực hiện tìm kiếm, bắt đầu từ vị trí tệp hiện tại, cho một bản ghi khớp với các tiêu chí được chỉ định trong cấu trúc `utmpx` mà đối tượng `ut` trỏ tới.

Hàm `getutxid()` tìm kiếm trong tệp `utmp` một bản ghi dựa trên các giá trị được chỉ định trong các trường `ut_type` và `ut_id` của đối số `ut`:

- Nếu trường `ut_type` là `RUN_LVL`, `BOOT_TIME`, `NEW_TIME`, hoặc `OLD_TIME`, thì `getutxid()` sẽ tìm bản ghi tiếp theo có trường `ut_type` khớp với giá trị được chỉ định. (Các bản ghi thuộc các loại này không tương ứng với việc người dùng đăng nhập.) Điều này cho phép tìm kiếm các bản ghi về việc thay đổi thời gian hệ thống và mức chạy (run-level).
- Nếu trường `ut_type` là một trong các giá trị hợp lệ còn lại (`INIT_PROCESS`, `LOGIN_PROCESS`, `USER_PROCESS`, hoặc `DEAD_PROCESS`), thì `getutxid()` sẽ tìm bản ghi tiếp theo có trường `ut_type` khớp với bất kỳ giá trị nào trong số này và có trường `ut_id` khớp với giá trị được chỉ định trong đối số `ut` của nó. Điều này cho phép quét tệp để tìm các bản ghi tương ứng với một thiết bị đầu cuối (terminal) cụ thể.

Hàm `getutxline()` tìm kiếm hướng về phía trước để tìm một bản ghi có trường `ut_type` là `LOGIN_PROCESS` hoặc `USER_PROCESS`, và có trường `ut_line` khớp với giá trị được chỉ định trong đối số `ut`. Điều này rất hữu ích để tìm các bản ghi tương ứng với việc người dùng đăng nhập.

Cả `getutxid()` và `getutxline()` đều trả về `NULL` nếu việc tìm kiếm thất bại (tức là gặp kết thúc tệp mà không tìm thấy bản ghi phù hợp).

Trên một số triển khai UNIX, `getutxline()` và `getutxid()` coi vùng nhớ tĩnh dùng để trả về cấu trúc `utmpx` giống như một dạng bộ đệm (cache). Nếu chúng xác định rằng bản ghi được lưu trong bộ đệm này bởi một lệnh gọi `getutx*()` trước đó khớp với các tiêu chí được chỉ định trong `ut`, thì sẽ không có thao tác đọc tệp nào được thực hiện; lệnh gọi đơn giản là trả về lại chính bản ghi đó (SUSv3 cho phép hành vi này). Do đó, để tránh việc cùng một bản ghi bị trả về lặp đi lặp lại khi gọi `getutxline()` và `getutxid()` bên trong một vòng lặp (loop), chúng ta phải xóa sạch cấu trúc dữ liệu tĩnh này về 0, bằng cách sử dụng mã nguồn như sau:

```
struct utmpx *res = NULL;
/* Các mã nguồn khác được lược bỏ */
if (res != NULL) /* Nếu 'res' được thiết lập thông qua lệnh gọi trước đó */
 memset(res, 0, sizeof(struct utmpx));
res = getutxline(&ut);
```

Việc triển khai trong glibc không thực hiện kiểu bộ đệm này, nhưng chúng ta vẫn nên áp dụng kỹ thuật này vì mục đích tính di động (portability).

> [!NOTE]
> Do các hàm `getutx*()` trả về một con trỏ trỏ đến một cấu trúc được cấp phát tĩnh, nên chúng không thể tái nhập (non-reentrant). Thư viện GNU C cung cấp các phiên bản tái nhập cho các hàm `utmp` truyền thống (`getutent_r()`, `getutid_r()`, và `getutline_r()`), nhưng không cung cấp các phiên bản tái nhập cho các hàm tương đương thuộc `utmpx`. (SUSv3 không quy định các phiên bản tái nhập này.)

Theo mặc định, tất cả các hàm getutx\*() đều hoạt động trên tệp utmp tiêu chuẩn. Nếu chúng ta muốn sử dụng một tệp khác, chẳng hạn như tệp wtmp, thì trước tiên chúng ta phải gọi hàm utmpxname(), chỉ định đường dẫn tệp (pathname) mong muốn.

## define _GNU_SOURCE

## include <utmpx.h>

int utmpxname(const char *file);
Trả về 0 khi thành công, hoặc –1 nếu có lỗi

```

Hàm utmpxname() chỉ đơn thuần ghi lại một bản sao của đường dẫn (pathname) được truyền cho nó. Hàm này không mở tệp, nhưng sẽ đóng bất kỳ tệp nào đã được mở trước đó bởi một trong các lời gọi khác. Điều này có nghĩa là utmpxname() không trả về lỗi nếu một đường dẫn không hợp lệ được chỉ định. Thay vào đó, khi một trong các hàm getutx\*() được gọi sau đó, nó sẽ trả về lỗi (tức là trả về NULL, đồng thời biến errno được thiết lập thành ENOENT) khi không thể mở tệp.

> Mặc dù không được quy định trong tiêu chuẩn SUSv3, hầu hết các cài đặt UNIX đều cung cấp hàm utmpxname() hoặc hàm utmpname() tương tự.

### Chương trình ví dụ

Chương trình trong [Liệt kê 40-2](#page-91-0) sử dụng một số hàm được mô tả trong phần này để kết xuất (dump) nội dung của một tệp định dạng utmpx. Nhật ký phiên dòng lệnh (shell session log) sau đây minh họa kết quả khi chúng ta sử dụng chương trình này để kết xuất nội dung của `/var/run/utmp` (tệp mặc định được sử dụng bởi các hàm này nếu hàm utmpxname() không được gọi):

| \$ ./dump_utmpx |          |                |   |         |                          |  |
|-----------------|----------|----------------|---|---------|--------------------------|--|
| user            | type     | PID line       |   | id host | date/time                |  |
| LOGIN           | LOGIN_PR | 1761 tty1      | 1 |         | Sat Oct 23 09:29:37 2010 |  |
| LOGIN           | LOGIN_PR | 1762 tty2      | 2 |         | Sat Oct 23 09:29:37 2010 |  |
| lynley          | USER_PR  | 10482 tty3     | 3 |         | Sat Oct 23 10:19:43 2010 |  |
| david           | USER_PR  | 9664 tty4      | 4 |         | Sat Oct 23 10:07:50 2010 |  |
| liz             | USER_PR  | 1985 tty5      | 5 |         | Sat Oct 23 10:50:12 2010 |  |
| mtk             | USER_PR  | 10111 pts/0 /0 |   |         | Sat Oct 23 09:30:57 2010 |  |

Vì lý do ngắn gọn, chúng tôi đã lược bỏ phần lớn đầu ra do chương trình tạo ra. Các dòng khớp với từ `tty1` đến `tty5` dùng cho các phiên đăng nhập trên các console ảo (`/dev/tty[1-6]`). Dòng đầu ra cuối cùng dành cho một phiên xterm trên một thiết bị giả (pseudoterminal).

Đầu ra sau đây được tạo ra bằng cách kết xuất tệp `/var/log/wtmp` cho thấy rằng khi một người dùng đăng nhập và đăng xuất, hai bản ghi (record) được ghi vào tệp wtmp. (Chúng tôi đã lược bỏ tất cả các đầu ra khác do chương trình tạo ra). Bằng cách tìm kiếm tuần tự (sequential search) qua tệp wtmp (sử dụng getutxline()), các bản ghi này có thể được khớp thông qua trường `ut_line`.

```

$ ./dump_utmpx /var/log/wtmp
user type PID line id host date/time
lynley USER_PR 10482 tty3 3 Sat Oct 23 10:19:43 2010
DEAD_PR 10482 tty3 3 2.4.20-4G Sat Oct 23 10:32:54 2010

```

**Liệt kê 40-2:** Hiển thị nội dung của một tệp định dạng utmpx

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– loginacct/dump_utmpx.c

## define _GNU_SOURCE

## include <time.h>

## include <utmpx.h>

## include <paths.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct utmpx *ut;
if (argc > 1 && strcmp(argv[1], "--help") == 0)
usageErr("%s [utmp-pathname]\n", argv[0]);
if (argc > 1) /* Sử dụng tệp thay thế nếu được cung cấp */
if (utmpxname(argv[1]) == -1)
errExit("utmpxname");
setutxent();
printf("user type PID line id host date/time\n");
while ((ut = getutxent()) != NULL) { /* Quét tuần tự đến EOF */
printf("%-8s ", ut->ut_user);
printf("%-9.9s ",
(ut->ut_type == EMPTY) ? "EMPTY" :
(ut->ut_type == RUN_LVL) ? "RUN_LVL" :
(ut->ut_type == BOOT_TIME) ? "BOOT_TIME" :
(ut->ut_type == NEW_TIME) ? "NEW_TIME" :
(ut->ut_type == OLD_TIME) ? "OLD_TIME" :
(ut->ut_type == INIT_PROCESS) ? "INIT_PR" :
(ut->ut_type == LOGIN_PROCESS) ? "LOGIN_PR" :
(ut->ut_type == USER_PROCESS) ? "USER_PR" :
(ut->ut_type == DEAD_PROCESS) ? "DEAD_PR" : "???");
printf("%5ld %-6.6s %-3.5s %-9.9s ", (long) ut->ut_pid,
ut->ut_line, ut->ut_id, ut->ut_host);
printf("%s", ctime((time_t *) &(ut->ut_tv.tv_sec)));
}
endutxent();
exit(EXIT_SUCCESS);
}

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– **loginacct/dump\_utmpx.c**

## 40.5 Truy xuất Tên Đăng nhập: getlogin()

Hàm `getlogin()` trả về tên của người dùng đang đăng nhập trên thiết bị đầu cuối điều khiển (controlling terminal) của tiến trình gọi (`calling process`). Hàm này sử dụng thông tin được duy trì trong tệp `utmp`.

## include <unistd.h>
char *getlogin(void);
                            Trả về con trỏ tới chuỗi tên người dùng, hoặc NULL nếu có lỗi
```

Hàm `getlogin()` gọi `ttyname()` (Mục 62.10) để tìm tên của thiết bị đầu cuối (terminal) được liên kết với luồng đầu vào chuẩn (standard input) của tiến trình gọi. Sau đó, hàm này tìm kiếm trong tệp `utmp` một bản ghi (record) có giá trị trường `ut_line` khớp với tên terminal này. Nếu tìm thấy bản ghi khớp, `getlogin()` sẽ trả về chuỗi `ut_user` từ bản ghi đó.

Nếu không tìm thấy bản ghi khớp hoặc xảy ra lỗi, `getlogin()` trả về `NULL` và thiết lập `errno` để chỉ ra mã lỗi. Một lý do khiến `getlogin()` có thể thất bại là tiến trình không có terminal nào được liên kết với đầu vào chuẩn của nó (lỗi `ENOTTY`), có thể vì đó là một tiến trình nền (`daemon`). Một khả năng khác là phiên terminal này không được ghi lại trong tệp `utmp`; ví dụ, một số phần mềm mô phỏng terminal (terminal emulator) không tạo mục nhập trong tệp `utmp`.

Ngay cả trong trường hợp (không phổ biến) khi một ID người dùng (user ID) có nhiều tên đăng nhập trong `/etc/passwd`, `getlogin()` vẫn có thể trả về tên người dùng thực tế đã được sử dụng để đăng nhập trên terminal này nhờ dựa vào tệp `utmp`. Ngược lại, việc sử dụng `getpwuid(getuid())` luôn truy xuất bản ghi khớp đầu tiên từ `/etc/passwd`, bất kể tên nào đã thực sự được sử dụng để đăng nhập.

> [!NOTE]
> Một phiên bản tái nhập (reentrant version) của `getlogin()` được quy định bởi chuẩn SUSv3 dưới dạng `getlogin_r()`, và hàm này được cung cấp bởi glibc.

> [!NOTE]
> Biến môi trường `LOGNAME` cũng có thể được sử dụng để tìm tên đăng nhập của người dùng. Tuy nhiên, giá trị của biến này có thể bị thay đổi bởi người dùng, đồng nghĩa với việc nó không thể được dùng để định danh người dùng một cách bảo mật.

## 40.6 Cập nhật các Tệp utmp và wtmp cho một Phiên Đăng nhập

Khi viết một ứng dụng tạo phiên đăng nhập (theo cách thức của `login` hoặc `sshd`, chẳng hạn), chúng ta nên cập nhật các tệp `utmp` và `wtmp` như sau:

Khi đăng nhập, một bản ghi phải được ghi vào tệp `utmp` để chỉ ra rằng người dùng này đã đăng nhập. Ứng dụng phải kiểm tra xem bản ghi cho terminal này đã tồn tại trong tệp `utmp` hay chưa. Nếu đã tồn tại bản ghi trước đó, nó sẽ bị ghi đè; ngược lại, một bản ghi mới sẽ được nối thêm (appended) vào tệp. Thường thì việc gọi hàm `pututxline()` (được mô tả ngay sau đây) là đủ để đảm bảo các bước này được thực hiện chính xác (xem [Liệt kê 40-3](#page-95-0) để biết ví dụ). Bản ghi `utmpx` đầu ra phải được điền ít nhất các trường `ut_type`, `ut_user`, `ut_tv`, `ut_pid`, `ut_id`, và `ut_line`. Trường `ut_type` phải được đặt thành `USER_PROCESS`. Trường `ut_id` phải chứa phần hậu tố (suffix) của tên thiết bị (tức là terminal hoặc pseudoterminal) mà người dùng đang đăng nhập, và trường `ut_line` phải chứa tên của thiết bị đăng nhập, với chuỗi `/dev/` ở đầu đã được loại bỏ. (Ví dụ về nội dung của hai trường này được hiển thị trong các lần chạy mẫu của chương trình tại [Liệt kê 40-2.](#page-91-0)) Một bản ghi chứa thông tin y hệt được nối thêm vào tệp `wtmp`.

> [!NOTE]
> Tên terminal đóng vai trò (thông qua các trường `ut_line` và `ut_id`) như một khóa duy nhất (unique key) cho các bản ghi trong tệp `utmp`.

Khi đăng xuất (logout), bản ghi đã được ghi trước đó vào tệp `utmp` phải được xóa sạch. Thao tác này được thực hiện bằng cách tạo một bản ghi có `ut_type` được đặt thành `DEAD_PROCESS`, cùng giá trị `ut_id` và `ut_line` như bản ghi được ghi trong quá trình đăng nhập, nhưng với trường `ut_user` được đặt về giá trị không (zeroed out). Bản ghi này được ghi đè lên bản ghi trước đó. Một bản sao của chính bản ghi này được nối thêm vào tệp `wtmp`.

> [!NOTE]
> Nếu chúng ta không dọn dẹp bản ghi `utmp` khi đăng xuất, có thể do chương trình bị treo/sập (crash), thì ở lần khởi động lại (`reboot`) tiếp theo, `init` sẽ tự động dọn dẹp bản ghi đó, thiết lập `ut_type` thành `DEAD_PROCESS` và đặt các trường khác của bản ghi về giá trị không.

Các tệp `utmp` và `wtmp` thường được bảo vệ sao cho chỉ người dùng có đặc quyền (`privileged users`) mới có thể thực hiện cập nhật trên các tệp này. Tính chính xác của `getlogin()` phụ thuộc vào tính toàn vẹn của tệp `utmp`. Vì lý do này, cũng như các lý do khác, quyền hạn trên các tệp `utmp` và `wtmp` không bao giờ được thiết lập cho phép người dùng không có đặc quyền ghi dữ liệu vào.

Thế nào được coi là một phiên đăng nhập? Đúng như chúng ta dự đoán, các lượt đăng nhập thông qua `login`, `telnet`, và `ssh` được ghi lại trong các tệp kế toán đăng nhập (login accounting files). Hầu hết các cài đặt `ftp` cũng tạo các bản ghi kế toán đăng nhập. Tuy nhiên, liệu các bản ghi kế toán đăng nhập có được tạo cho mỗi cửa sổ terminal được khởi động trên hệ thống hay cho các lệnh gọi `su` chẳng hạn hay không? Câu trả lời cho câu hỏi đó khác nhau tùy theo các bản cài đặt UNIX khác nhau.

> [!NOTE]
> Dưới một số chương trình mô phỏng terminal (ví dụ: `xterm`), các tùy chọn dòng lệnh (command-line options) hoặc các cơ chế khác có thể được sử dụng để xác định xem chương trình có cập nhật các tệp kế toán đăng nhập hay không.

Hàm `pututxline()` ghi cấu trúc `utmpx` được trỏ tới bởi `ut` vào tệp `/var/run/utmp` (hoặc một tệp thay thế nếu hàm `utmpxname()` đã được gọi trước đó).

```c
## include <utmpx.h>
struct utmpx *pututxline(const struct utmpx *ut);
             Trả về con trỏ trỏ đến bản sao của bản tin được cập nhật thành công nếu thành công,
                                                                  hoặc NULL nếu có lỗi
```

Trước khi ghi bản ghi (record), `pututxline()` trước tiên sử dụng `getutxid()` để tìm kiếm tiến về phía trước một bản ghi có thể bị ghi đè. Nếu tìm thấy một bản ghi như vậy, nó sẽ bị ghi đè; nếu không, một bản ghi mới sẽ được nối thêm (append) vào cuối tệp (file). Trong nhiều trường hợp, một ứng dụng gọi một trong các hàm `getutx*()` trước lệnh gọi `pututxline()`, hàm này thiết lập vị trí tệp hiện tại đến bản ghi chính xác — nghĩa là bản ghi khớp với các tiêu chí kiểu `getutxid()` trong cấu trúc `utmpx` được trỏ bởi `ut`. Nếu `pututxline()` xác định rằng điều này đã xảy ra, nó sẽ không gọi `getutxid()`.

> [!NOTE]
> Nếu `pututxline()` thực hiện một lệnh gọi nội bộ đến `getutxid()`, lệnh gọi này không làm thay đổi vùng tĩnh (static area) được sử dụng bởi các hàm `getutx*()` để trả về cấu trúc `utmpx`. Tiêu chuẩn SUSv3 yêu cầu hành vi này từ một bản cài đặt (implementation).

Khi cập nhật tệp `wtmp`, chúng ta chỉ đơn giản là mở tệp và nối thêm một bản ghi vào đó. Vì đây là một thao tác tiêu chuẩn, glibc đóng gói nó trong hàm `updwtmpx()`.

```c
## define _GNU_SOURCE
## include <utmpx.h>
void updwtmpx(char *wtmpx_file, struct utmpx *ut);
```

Hàm `updwtmpx()` nối thêm bản ghi `utmpx` được trỏ bởi `ut` vào tệp được chỉ định trong `wtmpx_file`.

Tiêu chuẩn SUSv3 không quy định hàm `updwtmpx()`, và hàm này chỉ xuất hiện trên một số ít các bản cài đặt UNIX khác. Các bản cài đặt khác cung cấp các hàm liên quan — `login(3)`, `logout(3)`, và `logwtmp(3)` — cũng có trong glibc và được mô tả trong các trang manual (manual pages). Nếu các hàm này không có sẵn, chúng ta cần tự viết các hàm tương đương của riêng mình. (Việc cài đặt các hàm này không phức tạp).

### Chương trình ví dụ

[Liệt kê 40-3](#page-95-0) sử dụng các hàm được mô tả trong phần này để cập nhật các tệp `utmp` và `wtmp`. Chương trình này thực hiện các bản cập nhật cần thiết cho `utmp` và `wtmp` để đăng nhập người dùng có tên trên dòng lệnh (command line), và sau đó, sau khi tạm dừng (sleep) vài giây, lại đăng xuất họ. Thông thường, các hành động như vậy sẽ gắn liền với việc tạo và chấm dứt một phiên đăng nhập (login session) cho người dùng. Chương trình này sử dụng `ttyname()` để lấy tên của thiết bị terminal được liên kết với một file descriptor (mô tả tệp). Chúng ta mô tả `ttyname()` trong Mục 62.10.

Nhật ký phiên làm việc shell (shell session log) sau đây minh họa hoạt động của chương trình trong [Liệt kê 40-3](#page-95-0). Chúng ta giả định quyền đặc quyền (privilege) để có thể cập nhật các tệp kế toán đăng nhập (login accounting files), sau đó sử dụng chương trình để tạo một bản ghi cho người dùng `mtk`:

```bash
$ su
Password:
## ./utmpx_login mtk
Creating login entries in utmp and wtmp
 using pid 1471, line pts/7, id /7
Type Control-Z to suspend program
[1]+ Stopped ./utmpx_login mtk
```

Trong khi chương trình `utmpx_login` đang tạm dừng, chúng ta gõ Control-Z để tạm dừng chương trình và đẩy nó xuống nền sau (background). Tiếp theo, chúng ta sử dụng chương trình trong [Liệt kê 40-2](#page-91-0) để kiểm tra nội dung của tệp `utmp`:

```bash
## ./dump_utmpx /var/run/utmp
user type PID line id host date/time
cecilia USER_PR 249 tty1 1 Fri Feb 1 21:39:07 2008
mtk USER_PR 1471 pts/7 /7 Fri Feb 1 22:08:06 2008
## who
cecilia tty1 Feb 1 21:39
mtk pts/7 Feb 1 22:08
```

Ở trên, chúng ta đã sử dụng lệnh `who(1)` để cho thấy rằng đầu ra của `who` bắt nguồn từ `utmp`.

Tiếp theo, chúng ta sử dụng chương trình của mình để kiểm tra nội dung của tệp `wtmp`:

```bash
## ./dump_utmpx /var/log/wtmp
user type PID line id host date/time
cecilia USER_PR 249 tty1 1 Fri Feb 1 21:39:07 2008
mtk USER_PR 1471 pts/7 /7 Fri Feb 1 22:08:06 2008
## last mtk
mtk pts/7 Fri Feb 1 22:08 still logged in
```

Ở trên, chúng ta đã sử dụng lệnh `last(1)` để cho thấy rằng đầu ra của `last` bắt nguồn từ `wtmp`. (Để ngắn gọn, chúng tôi đã chỉnh sửa đầu ra của các lệnh `dump_utmpx` và `last` trong nhật ký phiên shell này để loại bỏ các dòng đầu ra không liên quan đến thảo luận của chúng ta.)

Tiếp theo, chúng ta sử dụng lệnh `fg` để tiếp tục chương trình `utmpx_login` ở nền trước (foreground). Sau đó, chương trình này ghi các bản ghi đăng xuất (logout records) vào các tệp `utmp` và `wtmp`.

```bash
## fg
./utmpx_login mtk
Creating logout entries in utmp and wtmp
```

Sau đó, chúng ta kiểm tra lại nội dung của tệp `utmp` một lần nữa. Chúng ta thấy rằng bản ghi `utmp` đã bị ghi đè:

```bash
## ./dump_utmpx /var/run/utmp
user type PID line id host date/time
cecilia USER_PR 249 tty1 1 Fri Feb 1 21:39:07 2008
 DEAD_PR 1471 pts/7 /7 Fri Feb 1 22:09:09 2008
## who
cecilia tty1 Feb 1 21:39
```

Dòng đầu ra cuối cùng cho thấy rằng `who` đã bỏ qua bản ghi `DEAD_PROCESS`.

Khi chúng ta kiểm tra tệp `wtmp`, chúng ta thấy rằng bản ghi `wtmp` đã được ghi nối tiếp vào tệp:

```bash
## ./dump_utmpx /var/log/wtmp
user type PID line id host date/time
cecilia USER_PR 249 tty1 1 Fri Feb 1 21:39:07 2008
mtk USER_PR 1471 pts/7 /7 Fri Feb 1 22:08:06 2008
 DEAD_PR 1471 pts/7 /7 Fri Feb 1 22:09:09 2008
## last mtk
mtk pts/7 Fri Feb 1 22:08 - 22:09 (00:01)
```

Dòng đầu ra cuối cùng ở trên minh họa rằng `last` khớp các bản ghi đăng nhập và đăng xuất trong `wtmp` để hiển thị thời gian bắt đầu và kết thúc của phiên đăng nhập đã hoàn tất.

**Liệt kê 40-3:** Cập nhật các tệp utmp và wtmp

```
––––––––––––––––––––––––––––––––––––––––––––––––––– loginacct/utmpx_login.c
## define _GNU_SOURCE
## include <time.h>
## include <utmpx.h>
## include <paths.h> /* Definitions of _PATH_UTMP and _PATH_WTMP */
## include "tlpi_hdr.h"
```

```
int
main(int argc, char *argv[])
 struct utmpx ut;
 char *devName;
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s username [sleep-time]\n", argv[0]);
 /* Initialize login record for utmp and wtmp files */
 memset(&ut, 0, sizeof(struct utmpx));
 ut.ut_type = USER_PROCESS; /* This is a user login */
 strncpy(ut.ut_user, argv[1], sizeof(ut.ut_user));
 if (time((time_t *) &ut.ut_tv.tv_sec) == -1)
 errExit("time"); /* Stamp with current time */
 ut.ut_pid = getpid();
 /* Set ut_line and ut_id based on the terminal associated with
 'stdin'. This code assumes terminals named "/dev/[pt]t[sy]*".
 The "/dev/" dirname is 5 characters; the "[pt]t[sy]" filename
 prefix is 3 characters (making 8 characters in all). */
 devName = ttyname(STDIN_FILENO);
 if (devName == NULL)
 errExit("ttyname");
 if (strlen(devName) <= 8) /* Should never happen */
 fatal("Terminal name is too short: %s", devName);
 strncpy(ut.ut_line, devName + 5, sizeof(ut.ut_line));
 strncpy(ut.ut_id, devName + 8, sizeof(ut.ut_id));
 printf("Creating login entries in utmp and wtmp\n");
 printf(" using pid %ld, line %.*s, id %.*s\n",
 (long) ut.ut_pid, (int) sizeof(ut.ut_line), ut.ut_line,
 (int) sizeof(ut.ut_id), ut.ut_id);
 setutxent(); /* Rewind to start of utmp file */
 if (pututxline(&ut) == NULL) /* Write login record to utmp */
 errExit("pututxline");
 updwtmpx(_PATH_WTMP, &ut); /* Append login record to wtmp */
 /* Sleep a while, so we can examine utmp and wtmp files */
 sleep((argc > 2) ? getInt(argv[2], GN_NONNEG, "sleep-time") : 15);
 /* Now do a "logout"; use values from previously initialized 'ut',
 except for changes below */
 ut.ut_type = DEAD_PROCESS; /* Required for logout record */
 time((time_t *) &ut.ut_tv.tv_sec); /* Stamp with logout time */
 memset(&ut.ut_user, 0, sizeof(ut.ut_user));
 /* Logout record has null username */
```

{

```
 printf("Creating logout entries in utmp and wtmp\n");
 setutxent(); /* Rewind to start of utmp file */
 if (pututxline(&ut) == NULL) /* Overwrite previous utmp record */
 errExit("pututxline");
 updwtmpx(_PATH_WTMP, &ut); /* Append logout record to wtmp */
 endutxent();
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––– loginacct/utmpx_login.c
```

## 40.7 Tệp lastlog

Tệp lastlog ghi lại thời điểm mỗi người dùng đăng nhập (login) vào hệ thống lần gần đây nhất. (Điều này khác với tệp wtmp, vốn ghi lại tất cả các lần đăng nhập và đăng xuất của mọi người dùng). Trong số các tính năng khác, tệp lastlog cho phép chương trình đăng nhập thông báo cho người dùng (vào đầu phiên đăng nhập mới) thời điểm họ đăng nhập lần gần nhất. Ngoài việc cập nhật các tệp utmp và wtmp, các ứng dụng cung cấp dịch vụ đăng nhập cũng nên cập nhật tệp lastlog.

Giống như các tệp utmp và wtmp, vị trí và định dạng của tệp lastlog có sự khác biệt tùy theo hệ thống. (Một số ít bản cài đặt UNIX không cung cấp tệp này). Trên Linux, tệp này nằm ở `/var/log/lastlog`, và hằng số `_PATH_LASTLOG` được định nghĩa trong `<paths.h>` để trỏ đến vị trí này. Tương tự như các tệp utmp và wtmp, tệp lastlog thường được bảo vệ để mọi người dùng đều có thể đọc nhưng chỉ các tiến trình có đặc quyền (privileged process) mới có thể cập nhật.

Các bản ghi (record) trong tệp lastlog có định dạng sau (được định nghĩa trong `<lastlog.h>`):

## define UT_NAMESIZE 32

## define UT_HOSTSIZE 256

struct lastlog {
time_t ll_time; /* Time of last login */
char ll_line[UT_NAMESIZE]; /* Terminal for remote login */
char ll_host[UT_HOSTSIZE]; /* Hostname for remote login */
};

```

Lưu ý rằng các bản ghi này không bao gồm tên người dùng (username) hoặc ID người dùng (user ID). Thay vào đó, tệp lastlog bao gồm một chuỗi các bản ghi được chỉ mục (index) theo user ID. Do đó, để tìm bản ghi lastlog cho user ID 1000, chúng ta sẽ dịch chuyển con trỏ tệp (seek) đến byte `(1000 * sizeof(struct lastlog))` của tệp. Điều này được minh họa trong [Liệt kê 40-4](#page-98-0), một chương trình cho phép chúng ta xem các bản ghi lastlog cho (các) người dùng được liệt kê trên dòng lệnh của nó. Điều này tương tự với chức năng được cung cấp bởi lệnh `lastlog(1)`. Dưới đây là ví dụ về đầu ra được tạo ra khi chạy chương trình này:

```

$ ./view_lastlog annie paulh
annie tty2 Mon Jan 17 11:00:12 2011
paulh pts/11 Sat Aug 14 09:22:14 2010

```

Việc thực hiện cập nhật trên tệp lastlog cũng tương tự, bao gồm việc mở tệp, dịch chuyển con trỏ đến đúng vị trí và thực hiện ghi dữ liệu (write).

Vì tệp lastlog được chỉ mục theo user ID, nên không thể phân biệt được các lần đăng nhập dưới các tên người dùng khác nhau nhưng lại có cùng một user ID. (Trong Mục 8.1, chúng ta đã lưu ý rằng có thể tồn tại nhiều tên đăng nhập có cùng một user ID, mặc dù điều này ít khi xảy ra).

**Liệt kê 40-4:** Hiển thị thông tin từ tệp lastlog

```

–––––––––––––––––––––––––––––––––––––––––––––––––– loginacct/view_lastlog.c

## include <time.h>

## include <lastlog.h>

## include <paths.h> /* Định nghĩa của _PATH_LASTLOG */

## include <fcntl.h>

## include "ugid_functions.h" /* Khai báo của userIdFromName() */

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct lastlog llog;
int fd, j;
uid_t uid;
if (argc > 1 && strcmp(argv[1], "--help") == 0)
usageErr("%s [username...]\n", argv[0]);
fd = open(_PATH_LASTLOG, O_RDONLY);
if (fd == -1)
errExit("open");
for (j = 1; j < argc; j++) {
uid = userIdFromName(argv[j]);
if (uid == -1) {
printf("No such user: %s\n", argv[j]);
continue;
}
if (lseek(fd, uid * sizeof(struct lastlog), SEEK_SET) == -1)
errExit("lseek");
if (read(fd, &llog, sizeof(struct lastlog)) <= 0) {
printf("read failed for %s\n", argv[j]); /* EOF hoặc lỗi */
continue;
}
printf("%-8.8s %-6.6s %-20.20s %s", argv[j], llog.ll_line,
llog.ll_host, ctime((time_t *) &llog.ll_time));
}
close(fd);
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––– loginacct/view_lastlog.c

```

## 40.8 Tổng kết

Tính toán kế toán đăng nhập (login accounting) ghi lại những người dùng hiện đang đăng nhập, cũng như tất cả các phiên đăng nhập trước đó. Thông tin này được duy trì trong ba tệp: tệp `utmp`, duy trì bản ghi của tất cả người dùng hiện đang đăng nhập; tệp `wtmp`, là một luồng kiểm toán (audit trail) của tất cả các lần đăng nhập và đăng xuất; và tệp `lastlog`, ghi lại thời gian đăng nhập lần cuối của mỗi người dùng. Các lệnh khác nhau, chẳng hạn như `who` và `last`, sử dụng thông tin trong các tệp này.

Thư viện C cung cấp các hàm để truy xuất và cập nhật thông tin trong các tệp kế toán đăng nhập. Các ứng dụng cung cấp dịch vụ đăng nhập (login services) nên sử dụng các hàm này để cập nhật tệp kế toán đăng nhập, sao cho các lệnh phụ thuộc vào thông tin này hoạt động chính xác.

### Thông tin thêm

Ngoài trang hướng dẫn sử dụng (manual page) `utmp(5)`, nơi hữu ích nhất để tìm thêm thông tin về các hàm kế toán đăng nhập là trong mã nguồn (source code) của các ứng dụng khác nhau sử dụng các hàm này. Ví dụ: hãy xem mã nguồn của mingetty (hoặc agetty), login, init, telnet, ssh và ftp.

## 40.9 Bài tập

- **40-1.** Hiện thực hàm `getlogin()`. Như đã lưu ý ở Mục [40.5,](#page-92-0) `getlogin()` có thể không hoạt động chính xác đối với các tiến trình (process) chạy dưới một số bộ giả lập thiết bị đầu cuối phần mềm (software terminal emulator); trong trường hợp đó, hãy kiểm tra từ một bảng điều khiển ảo (virtual console) thay thế.
- **40-2.** Sửa đổi chương trình trong [Liệt kê 40-3](#page-95-0) (`utmpx_login.c`) để nó cập nhật tệp `lastlog` ngoài các tệp `utmp` và `wtmp`.
- **40-3.** Đọc các trang hướng dẫn sử dụng cho `login(3)`, `logout(3)` và `logwtmp(3)`. Hiện thực các hàm này.
- **40-4.** Hiện thực một phiên bản đơn giản của lệnh `who(1)`.
