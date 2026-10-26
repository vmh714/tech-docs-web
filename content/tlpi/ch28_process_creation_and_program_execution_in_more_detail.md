# Chương 28: CHI TIẾT VỀ TẠO TIẾN TRÌNH VÀ THỰC THI CHƯƠNG TRÌNH

Chương này mở rộng nội dung đã trình bày từ Chương [24](#page-0-0) đến [27](#page-50-0) bằng cách đề cập đến nhiều chủ đề liên quan đến việc tạo tiến trình (process creation) và thực thi chương trình (program execution). Chúng tôi mô tả tính năng kế toán tiến trình (process accounting), một tính năng của kernel có nhiệm vụ ghi lại một bản ghi kế toán cho mỗi tiến trình trên hệ thống khi nó kết thúc (terminate). Sau đó, chúng ta sẽ tìm hiểu về System Call `clone()` đặc trưng của Linux, đây là API mức thấp (low-level API) được sử dụng để tạo các luồng (thread) trên Linux. Tiếp theo là phần so sánh hiệu năng giữa `fork()`, `vfork()` và `clone()`. Cuối cùng, chúng ta kết thúc chương bằng bản tổng kết về ảnh hưởng của `fork()` và `exec()` đối với các thuộc tính của một tiến trình (process).

## 28.1 Kế toán tiến trình (Process Accounting)

Khi tính năng kế toán tiến trình được bật, kernel sẽ ghi một bản ghi kế toán vào tệp kế toán tiến trình của toàn hệ thống (system-wide process accounting file) khi mỗi tiến trình kết thúc. Bản ghi kế toán này chứa nhiều thông tin khác nhau được duy trì bởi kernel về tiến trình đó, bao gồm trạng thái kết thúc (termination status) và lượng thời gian CPU mà nó đã tiêu thụ. Tệp kế toán có thể được phân tích bởi các công cụ tiêu chuẩn (công cụ `sa(8)` tổng hợp thông tin từ tệp kế toán và `lastcomm(1)` liệt kê thông tin về các lệnh đã thực thi trước đó) hoặc bởi các ứng dụng được thiết kế riêng.

Trong các phiên bản kernel trước 2.6.10, một bản ghi kế toán tiến trình riêng biệt được ghi lại cho mỗi thread được tạo bằng cách sử dụng cơ chế thực thi luồng NPTL (NPTL threading implementation). Kể từ kernel 2.6.10, một bản ghi kế toán duy nhất sẽ được ghi lại cho toàn bộ process khi thread cuối cùng kết thúc. Theo cơ chế thực thi luồng LinuxThreads cũ hơn, một bản ghi kế toán tiến trình đơn lẻ luôn được ghi cho từng thread.

Về mặt lịch sử, mục đích chính của tính năng kế toán tiến trình là tính cước người dùng dựa trên mức độ tiêu thụ tài nguyên hệ thống trên các hệ thống UNIX đa người dùng (multiuser UNIX systems). Tuy nhiên, kế toán tiến trình cũng rất hữu ích để thu thập thông tin về một tiến trình vốn không được giám sát và báo cáo bởi tiến trình cha (parent) của nó.

Mặc dù có sẵn trên hầu hết các bản triển khai UNIX, kế toán tiến trình không được quy định trong chuẩn SUSv3. Định dạng của các bản ghi kế toán, cũng như vị trí của tệp kế toán, có sự khác biệt nhất định giữa các hệ thống. Chúng tôi mô tả chi tiết dành cho Linux trong phần này, đồng thời lưu ý một số điểm khác biệt từ các hệ thống UNIX khác xuyên suốt nội dung.

> Trên Linux, kế toán tiến trình là một thành phần kernel tùy chọn được cấu hình thông qua tùy chọn `CONFIG_BSD_PROCESS_ACCT`.

### Bật và tắt tính năng kế toán tiến trình

System Call `acct()` được sử dụng bởi một tiến trình có đặc quyền (`CAP_SYS_PACCT`) để bật và tắt tính năng kế toán tiến trình. System Call này hiếm khi được sử dụng trong các chương trình ứng dụng. Thông thường, kế toán tiến trình được bật ở mỗi lần khởi động lại hệ thống bằng cách đặt các lệnh thích hợp vào các tập lệnh khởi động hệ thống (system boot scripts).

```c
## define _BSD_SOURCE
## include <unistd.h>
int acct(const char *acctfile);
                                              Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Để bật kế toán tiến trình, chúng ta cung cấp đường dẫn (pathname) của một tệp thông thường (regular file) đang tồn tại vào tham số `acctfile`. Đường dẫn điển hình cho tệp kế toán là `/var/log/pacct` hoặc `/usr/account/pacct`. Để tắt kế toán tiến trình, chúng ta truyền giá trị `NULL` cho `acctfile`.

Chương trình trong [Liệt kê 28-1](#page-79-0) sử dụng `acct()` để bật và tắt tính năng kế toán tiến trình. Chức năng của chương trình này tương tự như lệnh shell `accton(8)`.

**Liệt kê 28-1:** Bật và tắt tính năng kế toán tiến trình

––––––––––––––––––––––––––––––––––––––––––––––––––––––– **procexec/acct_on.c** #define _BSD_SOURCE #include <unistd.h> #include "tlpi_hdr.h" int main(int argc, char *argv[]) { if (argc > 2 || (argc > 1 && strcmp(argv[1], "--help") == 0)) usageErr("%s [file]\n");

```
 if (acct(argv[1]) == -1)
 errExit("acct");
 printf("Process accounting %s\n",
 (argv[1] == NULL) ? "disabled" : "enabled");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/acct_on.c
```

### Bản ghi kế toán tiến trình (Process Accounting Records)

Một khi tính năng kế toán tiến trình được bật, một bản ghi `acct` sẽ được ghi vào tệp kế toán khi mỗi tiến trình kết thúc. Cấu trúc `acct` được định nghĩa trong `<sys/acct.h>` như sau:

```
typedef u_int16_t comp_t; /* Xem văn bản */
struct acct {
 char ac_flag; /* Các cờ kế toán (xem văn bản) */
 u_int16_t ac_uid; /* User ID của tiến trình */
 u_int16_t ac_gid; /* Group ID của tiến trình */
 u_int16_t ac_tty; /* Terminal điều khiển cho tiến trình (có thể là
 0 nếu không có, ví dụ: đối với một daemon) */
 u_int32_t ac_btime; /* Thời gian bắt đầu (time_t; số giây tính từ thời điểm Epoch) */
 comp_t ac_utime; /* Thời gian CPU ở User Space (số nhịp xung nhịp - clock ticks) */
 comp_t ac_stime; /* Thời gian CPU ở Kernel Space (số nhịp xung nhịp - clock ticks) */
 comp_t ac_etime; /* Thời gian đã trôi qua - thực tế (số nhịp xung nhịp - clock ticks) */
 comp_t ac_mem; /* Mức sử dụng bộ nhớ trung bình (kilobyte) */
 comp_t ac_io; /* Số byte được truyền bởi read(2) và write(2)
 (không sử dụng) */
 comp_t ac_rw; /* Số khối được đọc/ghi (không sử dụng) */
 comp_t ac_minflt; /* Lỗi trang thứ cấp - Minor page fault (đặc trưng của Linux) */
 comp_t ac_majflt; /* Lỗi trang sơ cấp - Major page fault (đặc trưng của Linux) */
 comp_t ac_swaps; /* Số lần swap (không sử dụng; đặc trưng của Linux) */
 u_int32_t ac_exitcode; /* Trạng thái kết thúc tiến trình */
## define ACCT_COMM 16
 char ac_comm[ACCT_COMM+1];
 /* Tên lệnh (được kết thúc bằng ký tự null)
 (tên cơ sở của tệp được exec gần nhất) */
 char ac_pad[10]; /* Vùng đệm - Padding (dành riêng cho sử dụng trong tương lai) */
};
```

Lưu ý các điểm sau đây liên quan đến cấu trúc `acct`:

- Các kiểu dữ liệu `u_int16_t` và `u_int32_t` lần lượt là số nguyên không dấu (unsigned integer) 16-bit và 32-bit.
- Trường `ac_flag` là một mặt nạ bit (bit mask) ghi lại các sự kiện khác nhau của tiến trình (Process). Các bit có thể xuất hiện trong trường này được thể hiện trong Bảng 28-1. Như được chỉ ra trong bảng, một số bit trong số này không có mặt trên tất cả các hệ triển khai UNIX. Một số ít hệ triển khai khác cung cấp các bit bổ sung trong trường này.
- Trường `ac_comm` ghi lại tên của lệnh (tệp chương trình) cuối cùng được thực thi bởi tiến trình này. Kernel ghi lại giá trị này trên mỗi lệnh `execve()`. Trên một số hệ triển khai UNIX khác, trường này bị giới hạn ở 8 ký tự.

- Kiểu *comp_t* là một dạng số thực chấm động (floating-point number). Các giá trị của kiểu này đôi khi được gọi là *compressed clock ticks* (chu kỳ xung nhịp được nén). Giá trị dấu phẩy động bao gồm một số mũ cơ số 8 có độ dài 3-bit, theo sau là một phần định trị (mantissa) 13-bit; số mũ có thể đại diện cho một hệ số trong dải từ 8<sup>0</sup>=1 đến 8<sup>7</sup> (2.097.152). Ví dụ, phần định trị bằng 125 và số mũ bằng 1 đại diện cho giá trị 1000. Listing 28-2 định nghĩa một hàm (*comptToLL()*) để chuyển đổi kiểu này sang *long long*. Chúng ta cần sử dụng kiểu *long long* bởi vì 32 bit được sử dụng để biểu diễn một *unsigned long* trên x86-32 là không đủ để chứa giá trị lớn nhất có thể được biểu diễn trong *comp_t*, đó là (2<sup>13</sup> - 1) \* 8<sup>7</sup>.
- Ba trường thời gian được định nghĩa với kiểu *comp_t* đại diện cho thời gian tính bằng chu kỳ xung nhịp hệ thống (system clock ticks). Do đó, chúng ta phải chia các khoảng thời gian này cho giá trị được trả về bởi `sysconf(_SC_CLK_TCK)` để chuyển đổi chúng sang giây.
- Trường *ac_exitcode* chứa trạng thái kết thúc (termination status) của tiến trình (được mô tả trong Mục 26.1.3). Hầu hết các hệ triển khai UNIX khác thay vào đó cung cấp một trường đơn byte có tên là *ac_stat*, chỉ ghi lại tín hiệu (signal) đã tiêu diệt tiến trình (nếu nó bị tiêu diệt bởi một signal) và một bit cho biết liệu signal đó có khiến tiến trình tạo ra tập tin lõi (core dump) hay không. Các hệ triển khai có nguồn gốc từ BSD không cung cấp bất kỳ trường nào trong hai trường này.

**Bảng 28-1:** Các giá trị bit cho trường *ac_flag* của bản ghi kế toán tiến trình (process accounting records)

| Bit   | Mô tả                                                                               |
|-------|-------------------------------------------------------------------------------------|
| AFORK | Tiến trình được tạo bởi <i>fork()</i>, nhưng không gọi <i>exec()</i> trước khi kết thúc |
| ASU   | Tiến trình đã sử dụng các đặc quyền siêu người dùng (superuser privileges)           |
| AXSIG | Tiến trình bị kết thúc bởi một signal (không có trên một số hệ triển khai)          |
| ACORE | Tiến trình tạo ra một core dump (không có trên một số hệ triển khai)                 |

Vì các bản ghi kế toán (accounting records) chỉ được ghi lại khi các tiến trình kết thúc, chúng được sắp xếp theo thời gian kết thúc (một giá trị không được ghi lại trong bản ghi), thay vì theo thời gian bắt đầu tiến trình (*ac_btime*).

Nếu hệ thống bị treo (crash), không có bản ghi kế toán nào được ghi lại cho bất kỳ tiến trình nào vẫn đang thực thi.

Vì việc ghi các bản ghi vào tệp kế toán có thể nhanh chóng làm cạn kiệt dung lượng đĩa, Linux cung cấp tệp ảo `/proc/sys/kernel/acct` để điều khiển hoạt động của tính năng kế toán tiến trình (process accounting). Tệp này chứa ba số, định nghĩa (theo thứ tự) các tham số high-water (ngưỡng trên), low-water (ngưỡng dưới), và frequency (tần suất). Các giá trị mặc định điển hình cho ba tham số này là 4, 2 và 30. Nếu tính năng kế toán tiến trình được bật và dung lượng đĩa trống giảm xuống dưới phần trăm low-water, quá trình kế toán sẽ bị tạm dừng. Nếu dung lượng đĩa trống sau đó tăng lên vượt quá phần trăm high-water, hoạt động kế toán sẽ được tiếp tục. Giá trị tần suất chỉ định khoảng thời gian (tính bằng giây) để kiểm tra tỷ lệ phần trăm dung lượng đĩa trống.

### Chương trình ví dụ

Chương trình trong Listing 28-2 hiển thị các trường được chọn từ các bản ghi trong một tệp kế toán tiến trình. Phiên shell sau đây minh họa việc sử dụng chương trình này. Chúng ta bắt đầu bằng cách tạo một tệp kế toán tiến trình mới, trống và bật tính năng kế toán tiến trình:

```
$ su Cần đặc quyền để bật tính năng kế toán tiến trình
Password:
## touch pacct
## ./acct_on pacct Tiến trình này sẽ là mục nhập đầu tiên trong tệp kế toán
Process accounting enabled
## exit Ngừng làm siêu người dùng
```

Tại thời điểm này, ba tiến trình đã kết thúc kể từ khi chúng ta bật tính năng kế toán tiến trình. Các tiến trình này đã thực thi các chương trình `acct_on`, `su`, và `bash`. Tiến trình `bash` được khởi động bởi `su` để chạy phiên shell có đặc quyền.

Bây giờ chúng ta chạy một chuỗi các lệnh để thêm các bản ghi bổ sung vào tệp kế toán:

```
$ sleep 15 &
[1] 18063
$ ulimit -c unlimited Cho phép tạo core dump (lệnh nội bộ của shell)
$ cat Tạo một tiến trình
Nhập Control-\ (tạo ra SIGQUIT, signal 3) để tiêu diệt tiến trình cat
Quit (core dumped)
$
Nhấn Enter để xem thông báo hoàn thành của sleep từ shell trước dấu nhắc lệnh tiếp theo
[1]+ Done sleep 15
$ grep xxx badfile grep thất bại với trạng thái 2
grep: badfile: No such file or directory
$ echo $? Shell lấy được trạng thái của grep (lệnh nội bộ của shell)
2
```

Hai lệnh tiếp theo chạy các chương trình mà chúng ta đã trình bày trong các chương trước ([Liệt kê 27-1](#page-53-2), ở trang [566](#page-53-2), và [Liệt kê 24-1](#page-4-1), ở trang [517](#page-4-1)). Lệnh đầu tiên chạy một chương trình thực thi (exec) tệp `/bin/echo`; điều này tạo ra một bản ghi thống kê (accounting record) với tên lệnh là `echo`. Lệnh thứ hai tạo ra một tiến trình con (child process) không thực hiện hàm `exec()`.

```
$ ./t_execve /bin/echo
hello world goodbye
$ ./t_fork
PID=18350 (child) idata=333 istack=666
PID=18349 (parent) idata=111 istack=222
```

Cuối cùng, chúng ta sử dụng chương trình trong Liệt kê 28-2 để xem nội dung của tệp thống kê (accounting file):

### \$ **./acct\_view pacct**

| command flags |    |        | term. user | start time          | CPU  | elapsed |
|---------------|----|--------|------------|---------------------|------|---------|
|               |    | status |            |                     | time | time    |
| acct_on       | -S | 0      | root       | 2010-07-23 17:19:05 | 0.00 | 0.00    |
| bash          |    | 0      | root       | 2010-07-23 17:18:55 | 0.02 | 21.10   |
| su            | -S | 0      | root       | 2010-07-23 17:18:51 | 0.01 | 24.94   |
| cat           | XC | 0x83   | mtk        | 2010-07-23 17:19:55 | 0.00 | 1.72    |
| sleep         |    | 0      | mtk        | 2010-07-23 17:19:42 | 0.00 | 15.01   |
| grep          |    | 0x200  | mtk        | 2010-07-23 17:20:12 | 0.00 | 0.00    |
| echo          |    | 0      | mtk        | 2010-07-23 17:21:15 | 0.01 | 0.01    |
| t_fork        | F  | 0      | mtk        | 2010-07-23 17:21:36 | 0.00 | 0.00    |
| t_fork        |    | 0      | mtk        | 2010-07-23 17:21:36 | 0.00 | 3.01    |

Trong phần đầu ra, chúng ta thấy một dòng cho mỗi tiến trình được tạo ra trong phiên shell (shell session). Các lệnh `ulimit` và `echo` là các lệnh tích hợp sẵn của shell (shell built-in commands), vì vậy chúng không dẫn đến việc tạo ra các tiến trình mới. Lưu ý rằng mục nhập cho `sleep` xuất hiện trong tệp thống kê sau mục nhập `cat` bởi vì lệnh `sleep` kết thúc sau lệnh `cat`.

Hầu hết phần đầu ra đều rất trực quan và dễ hiểu. Cột `flags` hiển thị các chữ cái đơn biểu thị cờ `ac_flag` nào được bật (set) trong mỗi bản ghi (xem Bảng 28-1). Mục [26.1.3](#page-32-2) mô tả cách giải thích các giá trị trạng thái kết thúc (termination status) được hiển thị trong cột `term. status`.

**Liệt kê 28-2:** Hiển thị dữ liệu từ một tệp thống kê tiến trình (process accounting file)

```c
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/acct_view.c
## include <fcntl.h>
## include <time.h>
## include <sys/stat.h>
## include <sys/acct.h>
## include <limits.h>
## include "ugid_functions.h" /* Khai báo hàm userNameFromId() */
## include "tlpi_hdr.h"
## define TIME_BUF_SIZE 100
static long long /* Chuyển đổi giá trị comp_t sang long long */
comptToLL(comp_t ct)
{
 const int EXP_SIZE = 3; /* Số mũ 3-bit, cơ số 8 */
 const int MANTISSA_SIZE = 13; /* Đi kèm phần định trị 13-bit */
 const int MANTISSA_MASK = (1 << MANTISSA_SIZE) - 1;
 long long mantissa, exp;
 mantissa = ct & MANTISSA_MASK;
 exp = (ct >> MANTISSA_SIZE) & ((1 << EXP_SIZE) - 1);
 return mantissa << (exp * 3); /* Lũy thừa của 8 = dịch trái 3 bit */
}
int
main(int argc, char *argv[])
{
 int acctFile;
 struct acct ac;
 ssize_t numRead;
 char *s;
 char timeBuf[TIME_BUF_SIZE];
 struct tm *loc;
 time_t t;
 if (argc != 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s file\n", argv[0]);
 acctFile = open(argv[1], O_RDONLY);
 if (acctFile == -1)
 errExit("open");

 printf("command flags term. user "
 "start time CPU elapsed\n");
 printf(" status "
 " time time\n");
 while ((numRead = read(acctFile, &ac, sizeof(struct acct))) > 0) {
 if (numRead != sizeof(struct acct))
 fatal("partial read");
 printf("%-8.8s ", ac.ac_comm);
 printf("%c", (ac.ac_flag & AFORK) ? 'F' : '-') ;
 printf("%c", (ac.ac_flag & ASU) ? 'S' : '-') ;
 printf("%c", (ac.ac_flag & AXSIG) ? 'X' : '-') ;
 printf("%c", (ac.ac_flag & ACORE) ? 'C' : '-') ;
## ifdef __linux__
 printf(" %#6lx ", (unsigned long) ac.ac_exitcode);
## else /* Nhiều hệ thống khác cung cấp trường ac_stat thay thế */
 printf(" %#6lx ", (unsigned long) ac.ac_stat);
## endif
 s = userNameFromId(ac.ac_uid);
 printf("%-8.8s ", (s == NULL) ? "???" : s);
 t = ac.ac_btime;
 loc = localtime(&t);
 if (loc == NULL) {
 printf("???Unknown time??? ");
 } else {
 strftime(timeBuf, TIME_BUF_SIZE, "%Y-%m-%d %T ", loc);
 printf("%s ", timeBuf);
 }
 printf("%5.2f %7.2f ", (double) (comptToLL(ac.ac_utime) +
 comptToLL(ac.ac_stime)) / sysconf(_SC_CLK_TCK),
 (double) comptToLL(ac.ac_etime) / sysconf(_SC_CLK_TCK));
 printf("\n");
 }
 if (numRead == -1)
 errExit("read");
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/acct_view.c
```

## Định dạng tệp process accounting Phiên bản 3

Bắt đầu từ Linux kernel 2.6.8, Linux đã giới thiệu một phiên bản thay thế tùy chọn của tệp process accounting nhằm giải quyết một số hạn chế của tệp accounting truyền thống. Để sử dụng phiên bản thay thế này, được gọi là Phiên bản 3 (Version 3), tùy chọn cấu hình kernel `CONFIG_BSD_PROCESS_ACCT_V3` phải được bật trước khi biên dịch kernel (kernel build).

Khi sử dụng tùy chọn Phiên bản 3, sự khác biệt duy nhất trong hoạt động của process accounting nằm ở định dạng của các bản ghi (records) được ghi vào tệp accounting. Định dạng mới được định nghĩa như sau:

```
struct acct_v3 {
 char ac_flag; /* Accounting flags */
 char ac_version; /* Accounting version (3) */
 u_int16_t ac_tty; /* Controlling terminal for process */
 u_int32_t ac_exitcode; /* Process termination status */
 u_int32_t ac_uid; /* 32-bit user ID of process */
 u_int32_t ac_gid; /* 32-bit group ID of process */
 u_int32_t ac_pid; /* Process ID */
 u_int32_t ac_ppid; /* Parent process ID */
 u_int32_t ac_btime; /* Start time (time_t) */
 float ac_etime; /* Elapsed (real) time (clock ticks) */
 comp_t ac_utime; /* User CPU time (clock ticks) */
 comp_t ac_stime; /* System CPU time (clock ticks) */
 comp_t ac_mem; /* Average memory usage (kilobytes) */
 comp_t ac_io; /* Bytes read/written (unused) */
 comp_t ac_rw; /* Blocks read/written (unused) */
 comp_t ac_minflt; /* Minor page faults */
 comp_t ac_majflt; /* Major page faults */
 comp_t ac_swaps; /* Number of swaps (unused; Linux-specific) */
## define ACCT_COMM 16
 char ac_comm[ACCT_COMM]; /* Command name */
};
```

Dưới đây là những điểm khác biệt chính giữa cấu trúc `acct_v3` và cấu trúc `acct` truyền thống của Linux:

- Trường `ac_version` được bổ sung. Trường này chứa số phiên bản của loại bản ghi accounting này. Trường này luôn có giá trị là 3 đối với một bản ghi `acct_v3`.
- Các trường `ac_pid` và `ac_ppid`, chứa ID tiến trình (Process ID) và ID tiến trình cha của tiến trình đã chấm dứt, được bổ sung.
- Các trường `ac_uid` và `ac_gid` được mở rộng từ 16 bit lên 32 bit, nhằm tương thích với ID người dùng và ID nhóm 32-bit được giới thiệu trong Linux 2.4. (Các ID người dùng và nhóm có kích thước lớn không thể được biểu diễn chính xác trong tệp acct truyền thống).
- Kiểu dữ liệu của trường `ac_etime` được thay đổi từ `comp_t` thành `float`, cho phép ghi lại thời gian trôi qua lớn hơn.

Chúng tôi cung cấp một phiên bản tương đương với Phiên bản 3 của chương trình trong [Danh mục 28-2](#page-83-0) tại tệp `procexec/acct_v3_view.c` trong mã nguồn phân phối của cuốn sách này.

## 28.2 System Call clone()

Giống như `fork()` và `vfork()`, system call đặc trưng của Linux `clone()` tạo ra một tiến trình (Process) mới. Nó khác với hai lời gọi kia ở chỗ cho phép kiểm soát chi tiết hơn đối với các bước diễn ra trong quá trình tạo tiến trình. Mục đích chính của `clone()` là để triển khai các thư viện luồng (threading libraries). Do `clone()` không có tính khả chuyển (nonportable), nên việc sử dụng trực tiếp nó trong các chương trình ứng dụng thường nên tránh. Chúng tôi mô tả nó ở đây vì đây là nền tảng hữu ích cho phần thảo luận về POSIX threads trong các Chương từ 29 đến 33, đồng thời cũng giúp làm sáng tỏ thêm hoạt động của `fork()` và `vfork()`.

```c
## define _GNU_SOURCE
## include <sched.h>
int clone(int (*func) (void *), void *child_stack, int flags, void *func_arg, ...
 /* pid_t *ptid, struct user_desc *tls, pid_t *ctid */ );
                          Trả về ID của tiến trình con khi thành công, hoặc –1 khi lỗi
```

Giống như `fork()`, một tiến trình con được tạo bằng `clone()` là bản sao gần như chính xác của tiến trình cha (Parent Process). Không giống như `fork()`, tiến trình con được clone không tiếp tục chạy từ điểm gọi hàm, mà thay vào đó bắt đầu bằng cách gọi hàm được chỉ định trong tham số `func`; chúng ta sẽ gọi đây là hàm tiến trình con (child function). Khi được gọi, hàm tiến trình con sẽ nhận được giá trị được chỉ định trong `func_arg`. Bằng cách ép kiểu (casting) phù hợp, hàm tiến trình con có thể tự do diễn giải tham số này; ví dụ, như một `int` hoặc như một con trỏ trỏ đến một cấu trúc (structure). (Việc diễn giải nó như một con trỏ là khả thi vì tiến trình con được clone hoặc nhận được một bản sao, hoặc chia sẻ vùng nhớ của tiến trình gọi).

> Bên trong kernel, `fork()`, `vfork()`, và `clone()` cuối cùng được triển khai bởi cùng một hàm (`do_fork()` trong `kernel/fork.c`). Ở cấp độ này, việc clone gần gũi hơn rất nhiều với việc fork: `sys_clone()` không có các tham số `func` và `func_arg`, và sau khi gọi, `sys_clone()` trả về ở tiến trình con theo cách thức giống như `fork()`. Phần nội dung chính mô tả hàm bao bọc (wrapper function) `clone()` mà glibc cung cấp cho `sys_clone()`. (Hàm này được định nghĩa trong các mã nguồn hợp ngữ glibc đặc thù theo kiến trúc, chẳng hạn như trong `sysdeps/unix/sysv/linux/i386/clone.S`). Hàm bao bọc này sẽ gọi `func` sau khi `sys_clone()` trả về ở tiến trình con.

Tiến trình con được clone sẽ chấm dứt hoạt động khi `func` trả về (trong trường hợp đó giá trị trả về của nó chính là trạng thái thoát của tiến trình) hoặc khi tiến trình thực hiện lời gọi đến `exit()` (hoặc `_exit()`). Tiến trình cha có thể chờ tiến trình con được clone theo cách thông thường bằng cách sử dụng `wait()` hoặc các hàm tương tự.

Vì một tiến trình con được tạo bằng clone (cloned child) có thể (giống như `vfork()`) chia sẻ bộ nhớ của tiến trình cha (parent), nó không thể sử dụng stack của tiến trình cha. Thay vào đó, tiến trình gọi (`caller`) phải cấp phát một khối bộ nhớ có kích thước phù hợp để làm stack cho tiến trình con và truyền một con trỏ trỏ đến khối bộ nhớ đó trong tham số `child_stack`. Trên hầu hết các kiến trúc phần cứng (hardware architecture), stack phát triển theo chiều giảm dần (grows downward), do đó tham số `child_stack` phải trỏ tới vùng địa chỉ cao (high end) của khối bộ nhớ đã được cấp phát.

> Sự phụ thuộc vào kiến trúc đối với hướng phát triển của stack là một điểm thiết kế chưa tối ưu của `clone()`. Trên kiến trúc Intel IA-64, một API `clone` cải tiến được cung cấp dưới dạng `clone2()`. System Call này định nghĩa phạm vi stack của tiến trình con theo cách không phụ thuộc vào hướng phát triển của stack, bằng cách cung cấp cả địa chỉ bắt đầu (start address) và kích thước (size) của stack. Xem trang tài liệu hướng dẫn (manual page) để biết thêm chi tiết.

Tham số `flags` của `clone()` phục vụ hai mục đích. Đầu tiên, byte thấp (lower byte) của nó chỉ định tín hiệu kết thúc (termination signal) của tiến trình con, đây là tín hiệu sẽ được gửi tới tiến trình cha khi tiến trình con kết thúc. (Nếu một cloned child bị dừng bởi một tín hiệu, tiến trình cha vẫn nhận được `SIGCHLD`.) Byte này có thể mang giá trị 0, trong trường hợp đó không có tín hiệu nào được tạo ra. (Bằng cách sử dụng tệp đặc trưng của Linux là `/proc/PID/stat`, chúng ta có thể xác định tín hiệu kết thúc của bất kỳ Process nào; hãy xem trang manual `proc(5)` để biết thêm chi tiết.)

Với `fork()` và `vfork()`, chúng ta không có cách nào để chọn tín hiệu kết thúc; nó luôn luôn là `SIGCHLD`.

Các byte còn lại của tham số `flags` chứa một bit mask điều khiển hoạt động của `clone()`. Chúng tôi tóm tắt các giá trị bit-mask này trong [Bảng 28-2,](#page-87-0) và mô tả chi tiết hơn trong Mục [28.2.1.](#page-90-0)

**Bảng 28-2:** Các giá trị bit-mask của cờ `clone()`

| Cờ (Flag)            | Hiệu ứng nếu được bật                                       |  |
|----------------------|-------------------------------------------------------------|--|
| CLONE_CHILD_CLEARTID | Xóa ctid khi tiến trình con gọi `exec()` hoặc `_exit()` (từ bản 2.6 trở đi) |  |
| CLONE_CHILD_SETTID   | Ghi Thread ID của tiến trình con vào ctid (từ bản 2.6 trở đi) |  |
| CLONE_FILES          | Tiến trình cha và con chia sẻ bảng File Descriptor mở (open file descriptors) |  |
| CLONE_FS             | Tiến trình cha và con chia sẻ các thuộc tính liên quan đến hệ thống tệp (file system) |  |
| CLONE_IO             | Tiến trình con chia sẻ ngữ cảnh I/O (I/O context) của tiến trình cha (từ bản 2.6.25 trở đi) |  |
| CLONE_NEWIPC         | Tiến trình con nhận Namespace IPC System V mới (từ bản 2.6.19 trở đi) |  |
| CLONE_NEWNET         | Tiến trình con nhận Network Namespace mới (từ bản 2.4.24 trở đi) |  |
| CLONE_NEWNS          | Tiến trình con nhận bản sao Mount Namespace của tiến trình cha (từ bản 2.4.19 trở đi) |  |
| CLONE_NEWPID         | Tiến trình con nhận Process-ID Namespace mới (từ bản 2.6.19 trở đi) |  |
| CLONE_NEWUSER        | Tiến trình con nhận User-ID Namespace mới (từ bản 2.6.23 trở đi) |  |
| CLONE_NEWUTS         | Tiến trình con nhận UTS (`utsname()`) Namespace mới (từ bản 2.6.19 trở đi) |  |
| CLONE_PARENT         | Đặt tiến trình cha của tiến trình con giống với tiến trình cha của tiến trình gọi (từ bản 2.4 trở đi) |  |
| CLONE_PARENT_SETTID  | Ghi Thread ID của tiến trình con vào ptid (từ bản 2.6 trở đi) |  |
| CLONE_PID            | Cờ lỗi thời chỉ được sử dụng bởi tiến trình khởi động hệ thống (system boot process) (đến bản 2.4) |  |
| CLONE_PTRACE         | Nếu tiến trình cha đang bị trace, thì trace cả tiến trình con |  |
| CLONE_SETTLS         | `tls` mô tả bộ nhớ cục bộ luồng (thread-local storage) cho tiến trình con (từ bản 2.6 trở đi) |  |
| CLONE_SIGHAND        | Tiến trình cha và con chia sẻ cơ chế xử lý tín hiệu (signal dispositions) |  |
| CLONE_SYSVSEM        | Tiến trình cha và con chia sẻ giá trị undo semaphore (từ bản 2.6 trở đi) |  |
| CLONE_THREAD         | Đặt tiến trình con vào cùng Thread Group với tiến trình cha (từ bản 2.4 trở đi) |  |
| CLONE_UNTRACED       | Không thể ép buộc `CLONE_PTRACE` trên tiến trình con (từ bản 2.6 trở đi) |  |
| CLONE_VFORK          | Tiến trình cha bị tạm dừng cho đến khi tiến trình con gọi `exec()` hoặc `_exit()` |  |
| CLONE_VM             | Tiến trình cha và con chia sẻ Virtual Memory |  |

Các tham số còn lại của `clone()` là `ptid`, `tls` và `ctid`. Các tham số này liên quan đến việc cài đặt luồng (thread implementation), cụ thể là việc sử dụng Thread ID và Thread-Local Storage. Chúng tôi đề cập đến việc sử dụng các tham số này khi mô tả các giá trị bit-mask của cờ trong Mục [28.2.1](#page-90-0). (Trong Linux 2.4 và các phiên bản trước đó, ba tham số này không được cung cấp bởi `clone()`. Chúng được thêm vào cụ thể trong Linux 2.6 để hỗ trợ việc cài đặt POSIX threads qua NPTL).

### Chương trình ví dụ

[Liệt kê 28-3](#page-88-0) hiển thị một ví dụ đơn giản về việc sử dụng `clone()` để tạo một tiến trình con. Chương trình chính thực hiện các bước sau:

- Mở một File Descriptor (cho `/dev/null`) sẽ bị đóng bởi tiến trình con w.
- Đặt giá trị cho tham số `flags` của `clone()` thành `CLONE_FILES` e nếu một đối số dòng lệnh (command-line argument) được cung cấp, sao cho tiến trình cha và con sẽ chia sẻ chung một bảng File Descriptor. Nếu không có đối số dòng lệnh nào được cung cấp, `flags` được đặt thành 0.
- Cấp phát một stack để tiến trình con sử dụng r.

- Nếu `CHILD_SIG` khác 0 và không bằng `SIGCHLD`, hãy bỏ qua nó, đề phòng trường hợp đó là một tín hiệu (signal) sẽ làm chấm dứt tiến trình (process). Chúng ta không bỏ qua `SIGCHLD`, bởi vì việc làm đó sẽ ngăn cản việc chờ đợi tiến trình con để thu thập trạng thái của nó.
- Gọi hàm `clone()` để tạo tiến trình con `y`. Đối số thứ ba (mặt nạ bit - bit-mask) bao gồm tín hiệu kết thúc. Đối số thứ tư (`func_arg`) chỉ định file descriptor (bản mô tả tệp) đã được mở trước đó (tại `w`).
- Chờ tiến trình con kết thúc `u`.
- Kiểm tra xem file descriptor (được mở tại `w`) có còn mở hay không bằng cách thử gọi `write()` vào nó `i`. Chương trình sẽ thông báo thao tác `write()` thành công hay thất bại.

Việc thực thi của tiến trình con được tạo bằng `clone` bắt đầu trong `childFunc()`, nhận (trong đối số `arg`) file descriptor được mở bởi chương trình chính (tại `w`). Tiến trình con đóng file descriptor này và sau đó kết thúc bằng cách thực hiện lệnh `return q`.

**Liệt kê 28-3:** Sử dụng `clone()` để tạo một tiến trình con

––––––––––––––––––––––––––––––––––––––––––––––––––– **procexec/t_clone.c** #define _GNU_SOURCE #include <signal.h> #include <sys/wait.h> #include <fcntl.h> #include <sched.h> #include "tlpi_hdr.h" #ifndef CHILD_SIG #define CHILD_SIG SIGUSR1 /* Tín hiệu được sinh ra khi tiến trình con clone kết thúc */ #endif static int /* Hàm khởi động cho tiến trình con clone */ childFunc(void *arg) { q if (close(*((int *) arg)) == -1) errExit("close"); return 0; /* Tiến trình con kết thúc tại đây */ } int main(int argc, char *argv[]) { const int STACK_SIZE = 65536; /* Kích thước stack cho tiến trình con clone */ char *stack; /* Bắt đầu vùng đệm stack */ char *stackTop; /* Kết thúc vùng đệm stack */ int s, fd, flags; w fd = open("/dev/null", O_RDWR); /* Tiến trình con sẽ đóng fd này */ if (fd == -1) errExit("open");

```c
 /* Nếu argc > 1, tiến trình con chia sẻ bảng file descriptor với tiến trình cha */
e flags = (argc > 1) ? CLONE_FILES : 0;
   /* Cấp phát stack cho tiến trình con */
r stack = malloc(STACK_SIZE);
   if (stack == NULL)
   errExit("malloc");
   stackTop = stack + STACK_SIZE; /* Giả sử stack tăng trưởng về phía địa chỉ thấp */
   /* Bỏ qua CHILD_SIG, đề phòng trường hợp nó là tín hiệu có hành vi mặc định là
   chấm dứt tiến trình; nhưng không bỏ qua SIGCHLD (vốn bị bỏ qua theo
   mặc định), vì điều đó sẽ ngăn cản việc tạo tiến trình thây ma (zombie). */
t if (CHILD_SIG != 0 && CHILD_SIG != SIGCHLD)
   if (signal(CHILD_SIG, SIG_IGN) == SIG_ERR)
   errExit("signal");
   /* Tạo tiến trình con; tiến trình con bắt đầu thực thi tại childFunc() */
y if (clone(childFunc, stackTop, flags | CHILD_SIG, (void *) &fd) == -1)
   errExit("clone");
   /* Tiến trình cha chạy tiếp xuống đây. Chờ tiến trình con; __WCLONE là
   cần thiết khi tiến trình con thông báo bằng tín hiệu khác với SIGCHLD. */
u if (waitpid(-1, NULL, (CHILD_SIG != SIGCHLD) ? __WCLONE : 0) == -1)
   errExit("waitpid");
   printf("child has terminated\n");
   /* Việc gọi close() trên file descriptor ở tiến trình con có ảnh hưởng đến tiến trình cha không? */
i s = write(fd, "x", 1);
   if (s == -1 && errno == EBADF)
   printf("file descriptor %d has been closed\n", fd);
   else if (s == -1)
   printf("write() on file descriptor %d failed "
   "unexpectedly (%s)\n", fd, strerror(errno));
   else
   printf("write() on file descriptor %d succeeded\n", fd);
   exit(EXIT_SUCCESS);
  }
  ––––––––––––––––––––––––––––––––––––––––––––––––––– procexec/t_clone.c
  Khi chúng ta chạy chương trình trong Liệt kê 28-3 mà không có đối số dòng lệnh, chúng ta
  thấy kết quả sau:
      $ ./t_clone Không sử dụng CLONE_FILES
      child has terminated
      write() on file descriptor 3 succeeded Việc đóng file descriptor của tiến trình con không ảnh hưởng đến tiến trình cha
```

Khi chúng ta chạy chương trình với một đối số dòng lệnh, chúng ta có thể thấy rằng hai tiến trình chia sẻ bảng file descriptor:

$ **./t_clone x** Sử dụng `CLONE_FILES`

child has terminated file descriptor 3 has been closed Việc đóng file descriptor của tiến trình con đã ảnh hưởng đến tiến trình cha

> Chúng tôi minh họa một ví dụ phức tạp hơn về việc sử dụng `clone()` trong tệp `procexec/demo_clone.c` nằm trong gói mã nguồn của cuốn sách này.

### 28.2.1 Đối số flags của clone()

Đối số `flags` của hàm `clone()` là sự kết hợp (phép toán OR) của các giá trị mặt nạ bit (bit-mask) được mô tả trong các trang tiếp theo. Thay vì trình bày các cờ (flag) này theo thứ tự bảng chữ cái, chúng tôi trình bày chúng theo thứ tự giúp dễ giải thích hơn, và bắt đầu với những cờ được sử dụng trong việc cài đặt POSIX threads. Từ góc độ cài đặt luồng (thread), nhiều lần sử dụng từ tiến trình (process) dưới đây có thể được thay thế bằng luồng (thread).

Tại thời điểm này, cần lưu ý rằng, ở một mức độ nào đó, chúng ta đang chơi chữ khi cố gắng vạch ra ranh giới phân biệt giữa các thuật ngữ luồng (thread) và tiến trình (process). Việc giới thiệu thuật ngữ thực thể lập lịch nhân (kernel scheduling entity - KSE) sẽ giúp ích phần nào. Thuật ngữ này được sử dụng trong một số tài liệu để chỉ các đối tượng được xử lý bởi bộ lập lịch của kernel (kernel scheduler). Thực chất, luồng (thread) và tiến trình (process) đơn giản là các KSE cung cấp mức độ chia sẻ thuộc tính (bộ nhớ ảo, File Descriptor đang mở, cơ chế xử lý tín hiệu - signal disposition, ID tiến trình, v.v.) lớn hơn hoặc nhỏ hơn với các KSE khác. Đặc tả POSIX threads cung cấp chỉ một trong số các định nghĩa khả dĩ về việc những thuộc tính nào nên được chia sẻ giữa các luồng.

Trong quá trình mô tả sau đây, đôi khi chúng tôi sẽ đề cập đến hai bản cài đặt chính của POSIX threads có sẵn trên Linux: bản cài đặt LinuxThreads cũ hơn và bản cài đặt NPTL gần đây hơn. Thông tin thêm về hai bản cài đặt này có thể được tìm thấy trong Mục 33.5.

> Bắt đầu từ kernel phiên bản 2.6.16, Linux cung cấp một System Call mới là `unshare()`, cho phép một tiến trình con (child process) được tạo ra bằng `clone()` (hoặc `fork()`, `vfork()`) hủy bỏ một phần việc chia sẻ thuộc tính (tức là đảo ngược các tác động của một số bit cờ `clone()`) đã được thiết lập khi tiến trình con đó được tạo. Để biết thêm chi tiết, hãy xem trang tài liệu hướng dẫn (manual page) `unshare(2)`.

## Chia sẻ bảng File Descriptor: CLONE\_FILES

Nếu cờ `CLONE\_FILES` được chỉ định, tiến trình cha (parent) và tiến trình con (child) sẽ chia sẻ chung một bảng chứa các File Descriptor đang mở. Điều này có nghĩa là việc cấp phát hoặc giải phóng File Descriptor (`open()`, `close()`, `dup()`, `pipe()`, `socket()`, v.v.) trong bất kỳ tiến trình nào sẽ hiển thị đối với tiến trình còn lại. Nếu cờ `CLONE\_FILES` không được thiết lập, thì bảng File Descriptor không được chia sẻ, và tiến trình con nhận được một bản sao bảng của tiến trình cha tại thời điểm gọi hàm `clone()`. Các Descriptor được sao chép này tham chiếu đến cùng các mô tả tệp mở (open file descriptions) giống như các Descriptor tương ứng ở tiến trình cha (giống như `fork()` và `vfork()`).

Đặc tả của POSIX threads yêu cầu tất cả các luồng trong một tiến trình phải chia sẻ chung các File Descriptor đang mở.

### Chia sẻ thông tin liên quan đến hệ thống tệp (File System): CLONE\_FS

Nếu cờ `CLONE\_FS` được chỉ định, thì tiến trình cha và tiến trình con sẽ chia sẻ thông tin liên quan đến hệ thống tệp—bao gồm umask, thư mục gốc (root directory), và thư mục làm việc hiện tại (current working directory). Điều này có nghĩa là các lệnh gọi `umask()`, `chdir()`, hoặc `chroot()` trong bất kỳ tiến trình nào sẽ ảnh hưởng đến tiến trình còn lại. Nếu cờ `CLONE\_FS` không được thiết lập, thì tiến trình cha và tiến trình con sẽ có các bản sao riêng biệt của thông tin này (giống như `fork()` và `vfork()`).

Việc chia sẻ thuộc tính do `CLONE\_FS` cung cấp là bắt buộc đối với POSIX threads.

### Chia sẻ cơ chế xử lý tín hiệu (Signal Dispositions): CLONE\_SIGHAND

Nếu cờ `CLONE\_SIGHAND` được thiết lập, thì tiến trình cha và tiến trình con sẽ chia sẻ chung bảng cơ chế xử lý tín hiệu (signal dispositions). Việc sử dụng `sigaction()` hoặc `signal()` để thay đổi cách xử lý tín hiệu trong một tiến trình sẽ ảnh hưởng đến cách xử lý tín hiệu đó ở tiến trình kia. Nếu cờ `CLONE\_SIGHAND` không được thiết lập, thì các cơ chế xử lý tín hiệu không được chia sẻ; thay vào đó, tiến trình con nhận được một bản sao bảng xử lý tín hiệu của tiến trình cha (giống như `fork()` và `vfork()`). Cờ `CLONE\_SIGHAND` không ảnh hưởng đến mặt nạ tín hiệu của tiến trình (process signal mask) và tập hợp các tín hiệu đang chờ xử lý (pending signals), vốn luôn độc lập đối với hai tiến trình. Từ Linux 2.6 trở đi, `CLONE\_VM` cũng phải được bao gồm trong `flags` nếu `CLONE\_SIGHAND` được chỉ định.

Việc chia sẻ cơ chế xử lý tín hiệu là bắt buộc đối với POSIX threads.

### Chia sẻ bộ nhớ ảo của tiến trình cha: CLONE\_VM

Nếu cờ `CLONE\_VM` được thiết lập, thì tiến trình cha và tiến trình con sẽ chia sẻ chung các trang bộ nhớ ảo (virtual memory pages) (giống như `vfork()`). Các bản cập nhật bộ nhớ hoặc lệnh gọi `mmap()` hay `munmap()` từ bất kỳ tiến trình nào sẽ hiển thị đối với tiến trình còn lại. Nếu cờ `CLONE\_VM` không được thiết lập, thì tiến trình con nhận được một bản sao bộ nhớ ảo của tiến trình cha (giống như `fork()`).

Chia sẻ cùng một bộ nhớ ảo là một trong những thuộc tính định nghĩa của luồng (thread), và là yêu cầu bắt buộc đối với POSIX threads.

## Nhóm luồng (Thread groups): CLONE\_THREAD

Nếu cờ `CLONE_THREAD` được thiết lập (set), tiến trình con (child) sẽ được đặt vào cùng một nhóm luồng (thread group) với tiến trình cha (parent). Nếu cờ này không được thiết lập, tiến trình con sẽ được đặt vào một nhóm luồng mới của riêng nó.

Các nhóm luồng được giới thiệu từ Linux 2.4 để cho phép các thư viện luồng hỗ trợ yêu cầu của POSIX threads (luồng POSIX) rằng tất cả các luồng trong một tiến trình (process) phải chia sẻ một định danh tiến trình (process ID) duy nhất (tức là hàm `getpid()` trong mỗi luồng phải trả về cùng một giá trị). Một nhóm luồng là một tập hợp các KSE chia sẻ chung một định danh nhóm luồng (Thread Group Identifier - TGID), như được minh họa trong [Hình 28-1](#page-92-0). Trong phần còn lại khi thảo luận về `CLONE_THREAD`, chúng ta sẽ gọi các KSE này là các luồng (threads).

Kể từ Linux 2.4, `getpid()` trả về TGID của luồng gọi hàm. Nói cách khác, TGID chính là process ID.

> Việc cài đặt `clone()` trong Linux 2.2 trở về trước không cung cấp `CLONE_THREAD`. Thay vào đó, LinuxThreads cài đặt các POSIX threads dưới dạng các tiến trình chia sẻ nhiều thuộc tính khác nhau (ví dụ: bộ nhớ ảo - virtual memory) nhưng lại có các process ID khác nhau. Vì lý do tương thích, ngay cả trên các nhân Linux hiện đại, cơ chế cài đặt của LinuxThreads vẫn không sử dụng cờ `CLONE_THREAD`, do đó các luồng trong cơ chế đó tiếp tục có các process ID riêng biệt.

```text
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Tiến trình với PID 2001 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│                                                                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │Thread A  │   │Thread B  │   │Thread C  │   │Thread D  │         │
│  ├──────────┤   ├──────────┤   ├──────────┤   ├──────────┤         │
│  │PPID=1900 │   │PPID=1900 │   │PPID=1900 │   │PPID=1900 │         │
│  ├──────────┤   ├──────────┤   ├──────────┤   ├──────────┤         │
│  │TGID=2001 │   │TGID=2001 │   │TGID=2001 │   │TGID=2001 │         │
│  ├──────────┤   ├──────────┤   ├──────────┤   ├──────────┤         │
│  │TID=2001  │   │TID=2002  │   │TID=2003  │   │TID=2004  │         │
│  │          │   │          │   │          │   │          │         │
│  │          │   │          │   │          │   │          │         │
│  │          │   │          │   │          │   │          │         │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘         │
│      ▲                                                             │
└ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
       │
       └─── Trưởng nhóm luồng (Thread group leader - TID trùng với TGID)
```

**Hình 28-1:** Một nhóm luồng chứa bốn luồng

Mỗi luồng trong một nhóm luồng được phân biệt bằng một định danh luồng (Thread Identifier - TID) duy nhất. Linux 2.4 đã giới thiệu một system call mới là `gettid()`, cho phép một luồng lấy được ID luồng của chính nó (giá trị này giống với giá trị trả về cho luồng gọi hàm `clone()`). Một thread ID được biểu diễn bằng cùng kiểu dữ liệu được sử dụng cho process ID, là `pid_t`. Các Thread ID là duy nhất trên toàn hệ thống (system-wide), và kernel đảm bảo rằng không có thread ID nào trùng với bất kỳ process ID nào trên hệ thống, ngoại trừ trường hợp một luồng đồng thời là trưởng nhóm luồng (thread group leader) của một tiến trình.

Luồng đầu tiên trong một nhóm luồng mới có thread ID trùng với thread group ID của nó. Luồng này được gọi là trưởng nhóm luồng (thread group leader).

> Các thread ID mà chúng ta đang thảo luận ở đây không giống với các thread ID (kiểu dữ liệu `pthread_t`) được sử dụng bởi các POSIX threads. Các định danh phía sau được tạo ra và quản lý nội bộ (trong user space) bởi thư viện cài đặt POSIX threads.

Tất cả các luồng trong một nhóm luồng đều có chung một parent process ID — đó là ID của trưởng nhóm luồng. Chỉ khi tất cả các luồng trong một nhóm luồng đã chấm dứt hoạt động (terminate), tín hiệu `SIGCHLD` (hoặc một tín hiệu kết thúc khác) mới được gửi đến tiến trình cha đó. Ngữ nghĩa này tương ứng với các yêu cầu của POSIX threads.

Khi một luồng được tạo bằng `CLONE_THREAD` kết thúc, không có tín hiệu nào được gửi đến luồng đã tạo ra nó bằng `clone()`. Tương ứng, không thể sử dụng `wait()` (hoặc các hàm tương tự) để chờ đợi một luồng được tạo bằng `CLONE_THREAD`. Điều này hoàn toàn phù hợp với các yêu cầu của POSIX. Một POSIX thread không giống với một tiến trình, và không thể chờ đợi (wait) bằng hàm `wait()`; thay vào đó, nó phải được đồng bộ kết thúc bằng hàm `pthread_join()`. Để phát hiện việc kết thúc của một luồng được tạo bằng `CLONE_THREAD`, một nguyên thủy đồng bộ hóa (synchronization primitive) đặc biệt gọi là `futex` được sử dụng (xem phần thảo luận về cờ `CLONE_PARENT_SETTID` bên dưới).

Nếu bất kỳ luồng nào trong một nhóm luồng thực thi hàm `exec()`, thì tất cả các luồng ngoại trừ trưởng nhóm luồng sẽ bị chấm dứt (hành vi này tương ứng với ngữ nghĩa được yêu cầu cho POSIX threads), và chương trình mới sẽ được thực thi (`execed`) trong trưởng nhóm luồng. Nói cách khác, trong chương trình mới, `gettid()` sẽ trả về thread ID của trưởng nhóm luồng. Trong quá trình `exec()`, tín hiệu kết thúc mà tiến trình này nên gửi cho tiến trình cha của nó được thiết lập lại thành `SIGCHLD`.

Nếu một trong các luồng (thread) trong một nhóm luồng (thread group) tạo ra một tiến trình con (child) sử dụng `fork()` hoặc `vfork()`, thì bất kỳ luồng nào trong nhóm đều có thể giám sát tiến trình con đó bằng cách sử dụng `wait()` hoặc các hàm tương tự.

Từ phiên bản Linux 2.6 trở đi, cờ `CLONE_SIGHAND` cũng phải được bao gồm trong `flags` nếu `CLONE_THREAD` được chỉ định. Điều này tương ứng với các yêu cầu tiếp theo của chuẩn POSIX threads; để biết chi tiết, hãy xem phần mô tả về cách các luồng POSIX và tín hiệu (signals) tương tác trong Mục 33.2. (Việc kernel xử lý các tín hiệu cho các nhóm luồng `CLONE_THREAD` phản ánh các yêu cầu của POSIX về cách các luồng trong một tiến trình phản ứng với tín hiệu).

## Hỗ trợ từ thư viện luồng: CLONE_PARENT_SETTID, CLONE_CHILD_SETTID, và CLONE_CHILD_CLEARTID

Các cờ `CLONE_PARENT_SETTID`, `CLONE_CHILD_SETTID`, và `CLONE_CHILD_CLEARTID` được thêm vào từ Linux 2.6 để hỗ trợ việc triển khai POSIX threads. Các cờ này ảnh hưởng đến cách hàm `clone()` xử lý các đối số `ptid` và `ctid` của nó. `CLONE_PARENT_SETTID` và `CLONE_CHILD_CLEARTID` được sử dụng trong cơ chế triển khai luồng NPTL (Native POSIX Threads Library).

Nếu cờ `CLONE_PARENT_SETTID` được thiết lập, nhân hệ thống (kernel) sẽ ghi định danh luồng (thread ID) của luồng con vào vùng nhớ được trỏ tới bởi `ptid`. Định danh luồng được sao chép vào `ptid` trước khi bộ nhớ của tiến trình cha được nhân đôi (duplicated). Điều này có nghĩa là, ngay cả khi cờ `CLONE_VM` không được chỉ định, cả tiến trình cha và tiến trình con đều có thể nhìn thấy ID luồng của tiến trình con tại vị trí này. (Như đã lưu ý ở trên, cờ `CLONE_VM` được chỉ định khi tạo các POSIX threads).

Cờ `CLONE_PARENT_SETTID` tồn tại nhằm cung cấp một phương thức đáng tin cậy để việc triển khai luồng có thể lấy được ID của luồng mới. Lưu ý rằng việc lấy ID luồng mới thông qua giá trị trả về của `clone()` là chưa đủ, ví dụ như sau:

```
tid = clone(...);
```

Vấn đề là đoạn mã này có thể dẫn đến các tình trạng tranh chấp điều kiện (race conditions) khác nhau, bởi vì phép gán chỉ xảy ra sau khi `clone()` trả về. Ví dụ, giả sử luồng mới kết thúc và trình xử lý (handler) tín hiệu kết thúc của nó được gọi trước khi việc gán cho biến `tid` hoàn tất. Trong trường hợp này, trình xử lý không thể truy cập `tid` một cách hữu ích. (Trong một thư viện luồng, `tid` có thể là một mục trong cấu trúc quản lý toàn cục dùng để theo dõi trạng thái của tất cả các luồng). Các chương trình gọi trực tiếp `clone()` thường có thể được thiết kế để tránh tình trạng tranh chấp điều kiện này. Tuy nhiên, một thư viện luồng không thể kiểm soát các hành động của chương trình gọi nó. Việc sử dụng `CLONE_PARENT_SETTID` để đảm bảo rằng ID luồng mới được đặt vào vị trí trỏ tới bởi `ptid` trước khi `clone()` trả về cho phép thư viện luồng tránh được các tình trạng tranh chấp điều kiện như vậy.

Nếu cờ `CLONE_CHILD_SETTID` được thiết lập, thì `clone()` sẽ ghi định danh luồng của luồng con vào vị trí được trỏ tới bởi `ctid`. Việc thiết lập `ctid` chỉ được thực hiện trong không gian bộ nhớ của luồng con, nhưng điều này sẽ ảnh hưởng đến tiến trình cha nếu `CLONE_VM` cũng được chỉ định. Mặc dù NPTL không cần `CLONE_CHILD_SETTID`, cờ này vẫn được cung cấp nhằm mang lại tính linh hoạt cho các cách triển khai thư viện luồng khác có thể có.

Nếu cờ `CLONE_CHILD_CLEARTID` được thiết lập, `clone()` sẽ xóa sạch (đặt về số không) vùng nhớ được trỏ tới bởi `ctid` khi luồng con kết thúc.

Đối số `ctid` là cơ chế (sẽ được mô tả ngay sau đây) mà qua đó việc triển khai luồng NPTL nhận được thông báo về việc kết thúc một luồng. Thông báo như vậy là bắt buộc đối với hàm `pthread_join()`, đây là cơ chế POSIX threads dùng để cho phép một luồng chờ đợi sự kết thúc của một luồng khác.

Khi một luồng được tạo bằng `pthread_create()`, NPTL thực hiện một lời gọi `clone()` trong đó `ptid` và `ctid` trỏ đến cùng một vị trí. (Đó là lý do tại sao `CLONE_CHILD_SETTID` không bắt buộc đối với NPTL). Cờ `CLONE_PARENT_SETTID` khiến cho vị trí đó được khởi tạo bằng ID của luồng mới. Khi luồng con kết thúc và `ctid` được xóa sạch, sự thay đổi đó sẽ hiển thị với tất cả các luồng trong tiến trình (vì cờ `CLONE_VM` cũng được chỉ định).

Nhân hệ thống coi vị trí được trỏ tới bởi `ctid` như một futex (fast userspace mutex), một cơ chế đồng bộ hóa (synchronization mechanism) hiệu quả. (Xem trang hướng dẫn thủ công futex(2) để biết thêm chi tiết về futex). Có thể nhận được thông báo về việc kết thúc luồng bằng cách thực hiện một lời gọi hệ thống (system call) `futex()` để chặn (block) và chờ đợi sự thay đổi giá trị tại vị trí được trỏ tới bởi `ctid`. (Đằng sau hậu trường, đây chính là những gì `pthread_join()` thực hiện). Cùng lúc nhân hệ thống xóa sạch `ctid`, nó cũng đánh thức bất kỳ thực thể lập lịch nào của nhân (kernel scheduling entity, tức là luồng) đang bị chặn khi đang thực hiện thao tác chờ futex (futex wait) trên địa chỉ đó. (Ở cấp độ POSIX threads, điều này làm cho lời gọi `pthread_join()` được bỏ chặn / unblock).

### Bộ nhớ cục bộ của luồng (Thread-local storage): CLONE_SETTLS

Nếu cờ `CLONE_SETTLS` được thiết lập, thì đối số `tls` sẽ trỏ tới một cấu trúc `user_desc` mô tả vùng đệm bộ nhớ cục bộ của luồng (thread-local storage buffer) được sử dụng cho luồng này. Cờ này đã được thêm vào trong Linux 2.6 để hỗ trợ việc triển khai bộ nhớ cục bộ của luồng trong NPTL (Mục 31.4). Để biết chi tiết về cấu trúc `user_desc`, hãy xem định nghĩa và cách sử dụng cấu trúc này trong mã nguồn nhân 2.6 và trang hướng dẫn thủ công `set_thread_area(2)`.

### Chia sẻ giá trị undo của System V semaphore: CLONE\_SYSVSEM

Nếu cờ `CLONE\_SYSVSEM` được thiết lập, tiến trình cha (parent) và tiến trình con (child) sẽ chia sẻ chung một danh sách các giá trị undo của System V semaphore (Mục 47.8). Nếu cờ này không được thiết lập, tiến trình cha và con sẽ có các danh sách undo riêng biệt, và danh sách undo của tiến trình con ban đầu sẽ trống.

Cờ `CLONE\_SYSVSEM` có sẵn từ phiên bản kernel 2.6 trở đi, và cung cấp ngữ nghĩa chia sẻ (sharing semantics) được yêu cầu bởi các luồng POSIX (POSIX threads).

### Namespace gắn kết theo từng tiến trình: CLONE\_NEWNS

Từ kernel 2.4.19 trở đi, Linux hỗ trợ khái niệm namespace gắn kết theo từng tiến trình (per-process mount namespace). Một mount namespace là tập hợp các điểm gắn kết (mount point) được duy trì bởi các lời gọi đến `mount()` và `umount()`. Mount namespace ảnh hưởng đến cách tên đường dẫn (pathname) được phân giải thành các tệp thực tế, cũng như hoạt động của các System Call như `chdir()` và `chroot()`.

Theo mặc định, tiến trình cha và tiến trình con chia sẻ chung một mount namespace, nghĩa là các thay đổi đối với namespace của một tiến trình sử dụng `mount()` và `umount()` sẽ có thể nhìn thấy được ở tiến trình còn lại (giống như `fork()` và `vfork()`). Một tiến trình có đặc quyền (`CAP\_SYS\_ADMIN`) có thể chỉ định cờ `CLONE\_NEWNS` để tiến trình con nhận được một bản sao mount namespace của tiến trình cha. Sau đó, các thay đổi đối với namespace của một tiến trình sẽ không còn hiển thị ở tiến trình kia nữa. (Trong các kernel 2.4.x trước đó, cũng như các kernel cũ hơn, chúng ta có thể coi tất cả các tiến trình trên hệ thống đang chia sẻ một mount namespace duy nhất trên toàn hệ thống).

Per-process mount namespace có thể được sử dụng để tạo ra các môi trường tương tự như các "jail" của `chroot()`, nhưng bảo mật và linh hoạt hơn; ví dụ, một tiến trình bị giam giữ (jailed process) có thể được cung cấp một điểm gắn kết mà các tiến trình khác trên hệ thống không thể nhìn thấy. Mount namespace cũng rất hữu ích trong việc thiết lập các môi trường máy chủ ảo (virtual server environment).

Việc chỉ định đồng thời cả `CLONE\_NEWNS` và `CLONE\_FS` trong cùng một lời gọi `clone()` là vô nghĩa và không được phép.

### Đặt tiến trình cha của tiến trình con giống với tiến trình gọi: CLONE\_PARENT

Theo mặc định, khi chúng ta tạo một tiến trình mới bằng `clone()`, tiến trình cha của tiến trình đó (được trả về bởi `getppid()`) chính là tiến trình gọi `clone()` (giống như `fork()` và `vfork()`). Nếu cờ `CLONE\_PARENT` được thiết lập, tiến trình cha của tiến trình con sẽ là tiến trình cha của người gọi (caller's parent). Nói cách khác, `CLONE\_PARENT` tương đương với việc thiết lập `child.PPID = caller.PPID`. (Trong trường hợp mặc định, không có `CLONE\_PARENT`, nó sẽ là `child.PPID = caller.PID`). Tiến trình cha (`child.PPID`) là tiến trình sẽ nhận được tín hiệu (signal) khi tiến trình con kết thúc.

Cờ `CLONE\_PARENT` có sẵn trong Linux 2.4 và các phiên bản sau này. Ban đầu, nó được thiết kế hữu ích cho việc triển khai các luồng POSIX (POSIX threads implementations), nhưng kernel 2.6 đã theo đuổi một cách tiếp cận hỗ trợ luồng (việc sử dụng `CLONE\_THREAD`, được mô tả ở trên) giúp loại bỏ sự cần thiết của cờ này.

### Đặt PID của tiến trình con giống với PID của tiến trình cha: CLONE\_PID (đã lỗi thời)

Nếu cờ `CLONE\_PID` được thiết lập, tiến trình con sẽ có ID tiến trình (Process ID) giống với tiến trình cha. Nếu cờ này không được thiết lập, tiến trình cha và con sẽ có các ID tiến trình khác nhau (giống như `fork()` và `vfork()`). Chỉ tiến trình khởi động hệ thống (System boot process - ID tiến trình bằng 0) mới có thể chỉ định cờ này; nó được sử dụng khi khởi tạo hệ thống đa xử lý (multiprocessor system).

Cờ `CLONE\_PID` không dành cho các ứng dụng người dùng (user application) sử dụng. Trong Linux 2.6, nó đã bị loại bỏ và được thay thế bởi `CLONE\_IDLETASK`, cờ này làm cho ID tiến trình của tiến trình mới được đặt thành 0. `CLONE\_IDLETASK` chỉ có sẵn để sử dụng nội bộ trong kernel (nếu được chỉ định trong đối số `flags` của `clone()`, nó sẽ bị bỏ qua). Nó được sử dụng để tạo tiến trình ẩn danh chạy ở trạng thái nghỉ trên mỗi CPU (per-CPU idle process), trong đó nhiều thể hiện (instance) có thể tồn tại trên các hệ thống đa xử lý.

### Process tracing: CLONE\_PTRACE và CLONE\_UNTRACED

Nếu cờ `CLONE_PTRACE` được thiết lập và tiến trình gọi (calling process) đang bị tracing (gọi vết tiến trình), thì tiến trình con (child) cũng sẽ bị trace. Để biết chi tiết về việc trace tiến trình (được sử dụng bởi các trình gỡ lỗi - debugger và lệnh strace), hãy tham khảo trang hướng dẫn (manual page) `ptrace(2)`.

Từ phiên bản kernel 2.6 trở đi, cờ `CLONE_UNTRACED` có thể được thiết lập, đồng nghĩa với việc tiến trình đang trace không thể ép buộc cờ `CLONE_PTRACE` lên tiến trình con này. Cờ `CLONE_UNTRACED` được sử dụng nội bộ bởi nhân hệ điều hành (kernel) trong quá trình tạo các luồng nhân (kernel thread).

### Tạm dừng tiến trình cha cho đến khi tiến trình con thoát hoặc exec: CLONE\_VFORK

Nếu cờ `CLONE_VFORK` được thiết lập, quá trình thực thi của tiến trình cha (parent) sẽ bị tạm dừng cho đến khi tiến trình con giải phóng các tài nguyên bộ nhớ ảo (virtual memory resources) của nó thông qua lời gọi `exec()` hoặc `_exit()` (tương tự như `vfork()`).

## Các cờ clone() mới hỗ trợ containers

Một số giá trị cờ `clone()` mới đã được thêm vào Linux 2.6.19 và các phiên bản sau đó: `CLONE_IO`, `CLONE_NEWIPC`, `CLONE_NEWNET`, `CLONE_NEWPID`, `CLONE_NEWUSER`, và `CLONE_NEWUTS`. (Xem trang manual page `clone(2)` để biết chi tiết về các cờ này).

Hầu hết các cờ này được cung cấp để hỗ trợ việc triển khai các container ([Bhattiprolu et al., 2008]). Container là một dạng ảo hóa nhẹ (lightweight virtualization), nhờ đó các nhóm tiến trình chạy trên cùng một kernel có thể được cô lập với nhau trong các môi trường có vẻ giống như các máy riêng biệt. Các container cũng có thể được lồng vào nhau, cái này nằm trong cái kia. Tiêp cận container trái ngược với ảo hóa toàn phần (full virtualization), nơi mỗi môi trường ảo hóa chạy một kernel riêng biệt.

Để triển khai các container, các nhà phát triển kernel phải cung cấp một lớp gián tiếp (layer of indirection) bên trong kernel xung quanh từng tài nguyên hệ thống toàn cục (global system resources)—chẳng hạn như ID tiến trình (process ID), ngăn xếp mạng (networking stack), các định danh được trả về bởi `uname()`, các đối tượng System V IPC, và không gian tên (namespace) ID người dùng và nhóm—để mỗi container có thể cung cấp thể hiện (instance) riêng của các tài nguyên này.

Có nhiều mục đích sử dụng khác nhau cho container, bao gồm các điểm sau:

- kiểm soát việc cấp phát tài nguyên trên hệ thống, chẳng hạn như băng thông mạng hoặc thời gian CPU (ví dụ: một container có thể được cấp 75% thời gian CPU, trong khi container kia nhận 25%);
- cung cấp nhiều máy chủ ảo nhẹ (lightweight virtual server) trên một máy chủ vật lý duy nhất;
- đóng băng (freezing) một container, sao cho việc thực thi tất cả các tiến trình trong container bị tạm dừng, để sau đó khởi động lại, có thể sau khi di chuyển (migrate) sang một máy khác; và
- cho phép trạng thái của một ứng dụng được kết xuất (checkpointed) và sau đó được khôi phục (restored) (có thể sau khi ứng dụng bị crash, hoặc do việc tắt hệ thống có kế hoạch hay không có kế hoạch) để tiếp tục tính toán từ thời điểm checkpoint.

### Sử dụng các cờ clone()

Nhìn chung, chúng ta có thể nói rằng một lời gọi `fork()` tương ứng với một lời gọi `clone()` với các cờ được chỉ định đơn giản là `SIGCHLD`, trong khi `vfork()` tương ứng với lời gọi `clone()` chỉ định các cờ như sau:

```
CLONE_VM | CLONE_VFORK | SIGCHLD
```

Kể từ phiên bản 2.3.3, trình bao bọc (wrapper) `fork()` của glibc được cung cấp như một phần của việc triển khai luồng NPTL sẽ bỏ qua system call `fork()` của kernel và gọi `clone()`. Hàm wrapper này gọi bất kỳ trình xử lý fork (fork handler) nào đã được thiết lập bởi tiến trình gọi sử dụng `pthread_atfork()` (xem Mục 33.3).

Việc triển khai luồng LinuxThreads sử dụng `clone()` (chỉ với bốn đối số đầu tiên) để tạo các luồng bằng cách chỉ định các cờ như sau:

```
CLONE_VM | CLONE_FILES | CLONE_FS | CLONE_SIGHAND
```

Việc triển khai luồng NPTL sử dụng `clone()` (với cả bảy đối số) để tạo các luồng bằng cách chỉ định các cờ như sau:

```
CLONE_VM | CLONE_FILES | CLONE_FS | CLONE_SIGHAND | CLONE_THREAD |
CLONE_SETTLS | CLONE_PARENT_SETTID | CLONE_CHILD_CLEARTID | CLONE_SYSVSEM
```

### 28.2.2 Phần mở rộng của waitpid() dành cho các Tiến trình con được Clone

Để chờ các tiến trình con được tạo ra bởi hàm clone(), các giá trị bổ sung (đặc trưng của Linux) sau đây có thể được đưa vào đối số mặt nạ bit (bit-mask) `options` của các hàm waitpid(), wait3(), và wait4():

```
__WCLONE
```

Nếu được thiết lập, hệ thống sẽ chỉ chờ các tiến trình con được clone. Nếu không được thiết lập, hệ thống chỉ chờ các tiến trình con không phải loại clone (nonclone). Trong ngữ cảnh này, một tiến trình con clone là tiến trình gửi một tín hiệu (signal) khác với SIGCHLD tới tiến trình cha (parent process) khi kết thúc. Bit này sẽ bị bỏ qua nếu `__WALL` cũng được chỉ định.

`__WALL` (từ Linux 2.4)

Chờ tất cả các tiến trình con, bất kể loại nào (clone hay nonclone).

`__WNOTHREAD` (từ Linux 2.4)

Theo mặc định, các lời gọi chờ (wait calls) không chỉ chờ các tiến trình con của tiến trình gọi (calling process), mà còn chờ các tiến trình con của bất kỳ tiến trình nào khác nằm trong cùng nhóm luồng (thread group) với tiến trình gọi. Việc chỉ định cờ `__WNOTHREAD` sẽ giới hạn phạm vi chờ chỉ ở các tiến trình con của riêng tiến trình gọi.

Các cờ này không thể được sử dụng cùng với waitid().

## 28.3 Tốc độ Tạo Tiến trình

[Bảng 28-3](#page-97-1) minh họa một số so sánh về tốc độ đối với các phương pháp tạo tiến trình khác nhau. Kết quả được thu thập bằng cách sử dụng một chương trình kiểm thử thực thi một vòng lặp liên tục tạo ra một tiến trình con (child process) rồi chờ nó kết thúc. Bảng này so sánh các phương pháp khác nhau sử dụng ba kích thước bộ nhớ tiến trình khác nhau, được biểu thị qua giá trị Tổng bộ nhớ ảo (Total virtual memory). Sự khác biệt về kích thước bộ nhớ được mô phỏng bằng cách cho chương trình gọi `malloc()` để cấp phát thêm bộ nhớ trên vùng nhớ heap trước khi tiến hành đo thời gian.

> Các giá trị về kích thước tiến trình (Tổng bộ nhớ ảo) trong [Bảng 28-3](#page-97-1) được lấy từ giá trị VSZ do lệnh `ps –o "pid vsz cmd"` hiển thị.

| Phương pháp tạo | Tổng Bộ Nhớ Ảo       |       |                   |       |                   |       |  |  |  |
|------------------|----------------------|-------|-------------------|-------|-------------------|-------|--|--|--|
| tiến trình       | 1.70 MB              |       | 2.70 MB           |       | 11.70 MB          |       |  |  |  |
|                  | Thời gian (giây)     | Tốc độ| Thời gian (giây)  | Tốc độ| Thời gian (giây)  | Tốc độ|  |  |  |
| fork()           | 22.27<br>(7.99)      | 4544  | 26.38<br>(8.98)   | 4135  | 126.93<br>(52.55) | 1276  |  |  |  |
| vfork()          | 3.52<br>(2.49)       | 28955 | 3.55<br>(2.50)    | 28621 | 3.53<br>(2.51)    | 28810 |  |  |  |
| clone()          | 2.97<br>(2.14)       | 34333 | 2.98<br>(2.13)    | 34217 | 2.93<br>(2.10)    | 34688 |  |  |  |
| fork() + exec()  | 135.72<br>(12.39)    | 764   | 146.15<br>(16.69) | 719   | 260.34<br>(61.86) | 435   |  |  |  |
| vfork() + exec() | 107.36<br>(6.27)     | 969   | 107.81<br>(6.35)  | 964   | 107.97<br>(6.38)  | 960   |  |  |  |

**Bảng 28-3:** Thời gian cần thiết để tạo 100.000 tiến trình sử dụng fork(), vfork(), và clone()

Đối với mỗi kích thước tiến trình, hai loại thống kê được cung cấp trong Bảng 28-3:

Thống kê đầu tiên bao gồm hai phép đo thời gian. Phép đo chính (lớn hơn) là tổng thời gian đã trôi qua (thời gian thực - real time) để hoàn thành 100.000 thao tác tạo tiến trình. Thời gian thứ hai, được hiển thị trong ngoặc đơn, là thời gian CPU (CPU time) mà tiến trình cha tiêu thụ. Do các bài kiểm thử này được chạy trên một máy tính không gánh tác vụ nào khác, sự khác biệt giữa hai giá trị thời gian này đại diện cho tổng thời gian mà các tiến trình con được tạo ra trong suốt bài kiểm thử tiêu thụ.

Thống kê thứ hai cho mỗi bài kiểm thử thể hiện tốc độ tạo tiến trình trên mỗi giây (thực). Các số liệu thống kê được hiển thị là giá trị trung bình của 20 lần chạy cho mỗi trường hợp, và được thu thập bằng cách sử dụng nhân Linux (kernel) phiên bản 2.6.27 chạy trên hệ thống x86-32.

Ba hàng dữ liệu đầu tiên cho thấy thời gian đối với việc tạo tiến trình đơn giản (không thực hiện `exec` một chương trình mới trong tiến trình con). Trong mỗi trường hợp, các tiến trình con sẽ thoát ngay lập tức sau khi chúng được tạo, và tiến trình cha sẽ chờ từng tiến trình con kết thúc trước khi tạo tiến trình tiếp theo.

Hàng dữ liệu đầu tiên chứa các giá trị cho System Call fork(). Từ dữ liệu, chúng ta có thể thấy rằng khi một tiến trình trở nên lớn hơn, hàm fork() mất nhiều thời gian hơn. Những sự khác biệt về thời gian này cho thấy thời gian bổ sung cần thiết để sao chép bảng trang (page table) ngày càng lớn cho tiến trình con và đánh dấu tất cả các mục trang của đoạn dữ liệu (data segment), vùng nhớ heap, và vùng nhớ stack là chỉ-đọc (read-only). (Không có trang nhớ nào được sao chép thực tế, vì tiến trình con không chỉnh sửa dữ liệu hoặc các đoạn stack của nó).

Hàng dữ liệu thứ hai cung cấp các số liệu thống kê tương tự cho hàm vfork(). Chúng ta thấy rằng khi kích thước tiến trình tăng lên, thời gian vẫn giữ nguyên—bởi vì không có bảng trang hoặc trang nhớ nào được sao chép trong suốt quá trình vfork(), kích thước bộ nhớ ảo của tiến trình gọi không gây ra ảnh hưởng nào. Sự khác biệt giữa các số liệu thống kê của fork() và vfork() thể hiện tổng thời gian cần thiết cho việc sao chép bảng trang của tiến trình trong mỗi trường hợp.

> Những biến động nhỏ ở các giá trị của vfork() và clone() trong [Bảng 28-3](#page-97-1) là do sai số lấy mẫu và sự biến động của bộ lập lịch (scheduler). Ngay cả khi tạo các tiến trình có kích thước lên tới 300 MB, thời gian thực thi cho hai system call này vẫn được duy trì ở mức không đổi.

Dòng dữ liệu thứ ba cho thấy các thống kê về việc tạo tiến trình (Process) sử dụng hàm `clone()` với các cờ (flags) sau:

```
CLONE_VM | CLONE_VFORK | CLONE_FS | CLONE_SIGHAND | CLONE_FILES
```

Hai cờ đầu tiên trong số này mô phỏng hành vi của hàm `vfork()`. Các cờ còn lại chỉ định rằng tiến trình cha (Parent Process) và tiến trình con (Child Process) phải chia sẻ các thuộc tính hệ thống tệp (File-system attributes) của chúng (gồm umask, thư mục gốc và thư mục làm việc hiện tại), bảng xử lý tín hiệu (Table of signal dispositions), và bảng mô tả tệp đang mở (Table of open file descriptors). Sự khác biệt giữa dữ liệu của `clone()` và `vfork()` thể hiện một lượng nhỏ công việc bổ sung được thực hiện trong `vfork()` để sao chép thông tin này sang tiến trình con. Chi phí sao chép các thuộc tính hệ thống tệp và bảng xử lý tín hiệu là một hằng số. Tuy nhiên, chi phí sao chép bảng mô tả tệp đang mở thay đổi tùy theo số lượng mô tả tệp (File Descriptor). Ví dụ, việc mở 100 mô tả tệp trong tiến trình cha đã làm tăng thời gian thực của `vfork()` (ở cột đầu tiên của bảng) từ 3.52 lên 5.04 giây, nhưng không làm thay đổi thời gian đối với `clone()`.

> Thời gian đo được đối với `clone()` là dành cho hàm bao bọc (Wrapper function) `clone()` của glibc, chứ không phải các lệnh gọi trực tiếp đến System Call `sys_clone()`. Các thử nghiệm khác (không được tóm tắt ở đây) cho thấy sự khác biệt về thời gian không đáng kể giữa việc sử dụng `sys_clone()` và việc gọi `clone()` với một hàm con thoát ngay lập tức.

Sự khác biệt giữa `fork()` và `vfork()` là khá rõ rệt. Tuy nhiên, cần ghi nhớ các điểm sau:

- Cột dữ liệu cuối cùng, nơi `vfork()` nhanh hơn `fork()` hơn 30 lần, tương ứng với một tiến trình lớn. Các tiến trình thông thường sẽ nằm ở đâu đó gần với hai cột đầu tiên của bảng hơn.
- Do thời gian cần thiết để tạo tiến trình thường nhỏ hơn rất nhiều so với thời gian cần thiết cho một lệnh `exec()`, sự khác biệt sẽ ít rõ rệt hơn nhiều nếu một lệnh `fork()` hoặc `vfork()` được theo sau bởi một lệnh `exec()`. Điều này được minh họa bằng cặp dòng dữ liệu cuối cùng trong [Table 28-3](#page-97-1), nơi mỗi tiến trình con thực thi một lệnh `exec()` thay vì thoát ngay lập tức. Chương trình được thực thi là lệnh `true` (`/bin/true`, được chọn vì nó không tạo ra đầu ra). Trong trường hợp này, chúng ta thấy rằng sự khác biệt tương đối giữa `fork()` và `vfork()` thấp hơn nhiều.

> Trên thực tế, dữ liệu được hiển thị trong [Table 28-3](#page-97-1) không cho thấy toàn bộ chi phí của một lệnh `exec()`, bởi vì tiến trình con thực thi cùng một chương trình trong mỗi vòng lặp của bài kiểm tra. Do đó, chi phí I/O đĩa để đọc chương trình vào bộ nhớ thực tế đã bị loại bỏ, vì chương trình sẽ được đọc vào bộ đệm ẩn của kernel (Kernel Buffer Cache - Page Cache) trong lần thực thi `exec()` đầu tiên và sau đó vẫn ở đó. Nếu mỗi vòng lặp của bài kiểm tra thực thi một chương trình khác nhau (ví dụ: một bản sao có tên khác của cùng một chương trình đó), thì chúng ta sẽ quan sát thấy chi phí lớn hơn cho một lệnh `exec()`.

## 28.4 Ảnh hưởng của exec() và fork() đối với các Thuộc tính Tiến trình (Process Attributes)

Một tiến trình (process) có rất nhiều thuộc tính, một số trong số đó đã được chúng tôi mô tả ở các chương trước, và các thuộc tính khác sẽ được khám phá trong các chương sau. Liên quan đến các thuộc tính này, có hai câu hỏi được đặt ra:

- Điều gì xảy ra với các thuộc tính này khi một tiến trình thực hiện hàm `exec()`?
- Thuộc tính nào được tiến trình con (child process) kế thừa khi thực hiện hàm `fork()`?

Bảng 28-4 tổng hợp câu trả lời cho các câu hỏi này. Cột `exec()` chỉ ra các thuộc tính nào được bảo tồn trong quá trình thực hiện `exec()`. Cột `fork()` chỉ ra các thuộc tính nào được kế thừa (hoặc trong một số trường hợp là được chia sẻ) bởi tiến trình con sau hàm `fork()`. Ngoại trừ các thuộc tính được chỉ định là dành riêng cho Linux (Linux-specific), tất cả các thuộc tính được liệt kê đều xuất hiện trong các cài đặt UNIX chuẩn, và việc xử lý chúng trong `exec()` và `fork()` tuân thủ các yêu cầu của tiêu chuẩn SUSv3.

**Bảng 28-4:** Ảnh hưởng của `exec()` và `fork()` đối với các thuộc tính tiến trình (Process Attributes)

| Thuộc tính tiến trình (Process attribute) | exec()       | fork()               | Các giao diện (interfaces) ảnh hưởng đến thuộc tính; ghi chú bổ sung                                                                                                                              |  |  |  |
|------------------------------------------|--------------|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--|--|--|
| Không gian địa chỉ tiến trình (Process address space) | | | | | | |
| Phân đoạn mã lệnh (Text segment)         | Không        | Chia sẻ (Shared)     | Tiến trình con chia sẻ phân đoạn mã lệnh với tiến trình cha (parent process).                                                                                                     |  |  |  |
| Phân đoạn ngăn xếp (Stack segment)       | Không        | Có                   | Vào/ra hàm; các hàm `alloca()`, `longjmp()`,<br>`siglongjmp()`.                                                                                                                     |  |  |  |
| Phân đoạn dữ liệu và vùng nhớ heap (Data and heap segments) | Không | Có           | Các hàm `brk()`, `sbrk()`.                                                                                                                                                          |  |  |  |
| Biến môi trường (Environment variables)  | Xem<br>ghi chú | Có                 | Các hàm `putenv()`, `setenv()`; sửa đổi trực tiếp biến `environ`.<br>Bị ghi đè bởi `execle()` và `execve()`, và được bảo tồn<br>bởi các lời gọi `exec()` còn lại.                     |  |  |  |
| Ánh xạ bộ nhớ (Memory mappings)          | Không        | Có;<br>xem<br>ghi chú | Các hàm `mmap()`, `munmap()`. Cờ `MAP_NORESERVE` của một ánh xạ được kế thừa qua `fork()`. Các ánh xạ đã<br>được đánh dấu bằng `madvise(MADV_DONTFORK)`<br>sẽ không được kế thừa qua `fork()`. |  |  |  |
| Khóa bộ nhớ (Memory locks)               | Không        | Không                | Các hàm `mlock()`, `munlock()`.                                                                                                                                                     |  |  |  |

**Bảng 28-4:** Ảnh hưởng của `exec()` và `fork()` đối với các thuộc tính tiến trình (tiếp theo)

| Thuộc tính tiến trình (Process attribute) | exec()          | fork()               | Các giao diện (interfaces) ảnh hưởng đến thuộc tính; ghi chú bổ sung                                                                                                                                                              |  |  |
|------------------------------------------|-----------------|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--|--|
| Định danh tiến trình và thông tin xác thực (Process identifiers and credentials) | | | | | |
| ID tiến trình (Process ID)                 | Có              | Không                |                                                                                                                                                                                                                                   |  |  |
| ID tiến trình cha (Parent process ID)      | Có              | Không                |                                                                                                                                                                                                                                   |  |  |

| Process group ID (ID nhóm tiến trình) | Có | Có | setpgid(). | | |
| Session ID (ID phiên) | Có | Có | setsid(). | | |
| Real IDs (ID thực) | Có | Có | setuid(), setgid(), và các system call liên quan. | | |
| Effective and saved set IDs (ID hiệu dụng và ID tập hợp đã lưu) | Xem<br>ghi chú | Có | setuid(), setgid(), và các system call liên quan. Chương 9<br>giải thích cách exec() ảnh hưởng đến các ID này. | | |
| Supplementary group IDs (ID nhóm bổ sung) | Có | Có | setgroups(), initgroups(). | | |
| Files, file I/O, and directories (Tệp, I/O tệp, và thư mục) | | | | | |
| Open file descriptors (File descriptor đang mở) | Xem<br>ghi chú | Có | open(), close(), dup(), pipe(), socket(), và<br>tương tự. File descriptor được bảo toàn<br>qua exec() trừ khi được đánh dấu close-on-exec.<br>Descriptor ở tiến trình con và tiến trình cha trỏ đến cùng<br>một mô tả tệp mở (open file description); xem Mục 5.4. | | |
| Close-on-exec flag (Cờ đóng khi exec) | Có<br>(nếu tắt) | Có | fcntl(F_SETFD). | | |
| File offsets (Vị trí con trỏ tệp) | Có | Chia sẻ | lseek(), read(), write(), readv(), writev(). Tiến trình con<br>chia sẻ vị trí con trỏ tệp với tiến trình cha. | | |
| Open file status flags (Cờ trạng thái tệp mở) | Có | Chia sẻ | open(), fcntl(F_SETFL). Tiến trình con chia sẻ cờ trạng thái<br>tệp mở với tiến trình cha. | | |
| Asynchronous I/O operations (Các thao tác I/O bất đồng bộ) | Xem<br>ghi chú | Không | aio_read(), aio_write(), và các lệnh gọi liên quan.<br>Các thao tác chưa hoàn tất sẽ bị hủy<br>trong quá trình thực thi exec(). | | |
| Directory streams (Luồng thư mục) | Không | Có;<br>xem<br>ghi chú | opendir(), readdir(). Tiêu chuẩn SUSv3 nêu rằng tiến trình con nhận được<br>một bản sao các luồng thư mục của tiến trình cha, nhưng các bản sao<br>này có thể có hoặc không chia sẻ vị trí luồng<br>thư mục. Trên Linux, vị trí luồng thư mục<br>không được chia sẻ. | | |
| File system (Hệ thống tệp) | | | | | |
| Current working directory (Thư mục làm việc hiện tại) | Có | Có | chdir(). | | |
| Root directory (Thư mục gốc) | Có | Có | chroot(). | | |
| File mode creation mask (Mặt nạ tạo chế độ tệp) | Có | Có | umask(). | | |

| Signals                             |                 |                      |                                                                                                                                                                                                                                   |  |  |
| Xử lý tín hiệu (Signal dispositions) | Xem<br>ghi chú  | Có                   | signal(), sigaction(). Trong quá trình exec(), các tín hiệu<br>có cách xử lý được đặt về mặc định hoặc bỏ qua sẽ<br>không đổi; các tín hiệu bị bắt sẽ quay về cách xử lý<br>mặc định của chúng. Xem Mục 27.5. |  |  |
| Mặt nạ tín hiệu (Signal mask)       | Có              | Có                   | Việc gửi tín hiệu (Signal delivery), sigprocmask(), sigaction().                                                                                                                                  |  |  |
| Tập tín hiệu đang chờ (Pending signal set) | Có       | Không                | Việc gửi tín hiệu; raise(), kill(), sigqueue().                                                                                                                                                   |  |  |
| Ngăn xếp tín hiệu thay thế (Alternate signal stack) | Không | Có            | sigaltstack().<br>(tiếp theo)                                                                                                                                                                     |  |  |

**Bảng 28-4:** Ảnh hưởng của exec() và fork() đối với các thuộc tính tiến trình (tiếp theo)

| Thuộc tính tiến trình                  | exec()       | fork()       | Các giao diện (interfaces) ảnh hưởng đến thuộc tính; ghi chú bổ sung                                                                                                                          |
|----------------------------------------|--------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Bộ định thời (Timers)                  |              |              |                                                                                                                                                                                               |
| Bộ định thời khoảng (Interval timers)  | Có           | Không        | setitimer().                                                                                                                                                                                  |
| Bộ định thời được đặt bởi alarm()       | Có           | Không        | alarm().                                                                                                                                                                                      |
| Bộ định thời POSIX (POSIX timers)      | Không        | Không        | timer_create() và các lời gọi liên quan.                                                                                                                                                      |
| Luồng POSIX (POSIX threads)            |              |              |                                                                                                                                                                                               |
| Luồng (Threads)                        | Không        | Xem<br>ghi chú | Trong quá trình fork(), chỉ có luồng gọi được nhân bản trong tiến trình con (child).                                                                                                          |
| Trạng thái và kiểu hủy luồng<br>(Thread cancelability state and type) | Không | Có | Sau một exec(), kiểu và trạng thái hủy được đặt lại thành PTHREAD_CANCEL_ENABLE và PTHREAD_CANCEL_DEFERRED tương ứng.                                                                         |
| Mutex và biến điều kiện<br>(Mutexes and condition variables) | Không | Có  | Xem Mục 33.3 để biết chi tiết về việc xử lý mutex và các tài nguyên luồng khác trong quá trình fork().                                                                                        |
| Độ ưu tiên và lập lịch (Priority and scheduling) |          |              |                                                                                                                                                                                               |
| Giá trị nice (Nice value)              | Có           | Có           | nice(), setpriority().                                                                                                                                                                        |

| Chính sách lập lịch (Scheduling policy) và độ ưu tiên (priority) | Có | Có | `sched_setscheduler()`, `sched_setparam()`. |
| Tài nguyên và thời gian CPU (CPU time) | | | |
| Giới hạn tài nguyên (Resource limits) | Có | Có | `setrlimit()`. |
| Thời gian CPU của tiến trình (Process) và tiến trình con | Có | Không | Như được trả về bởi `times()`. |
| Mức sử dụng tài nguyên (Resource usages) | Có | Không | Như được trả về bởi `getrusage()`. |
| Giao tiếp giữa các tiến trình (Interprocess communication) | | | |
| Các phân đoạn bộ nhớ<br>chia sẻ System V (System V shared memory segments) | Không | Có | `shmat()`, `shmdt()`. |
| Bộ nhớ chia sẻ POSIX (POSIX shared memory) | Không | Có | `shm_open()` và các lời gọi liên quan. |
| Hàng đợi thông điệp POSIX (POSIX message queues) | Không | Có | `mq_open()` và các lời gọi liên quan. Các File Descriptor trong tiến trình con và tiến trình cha tham chiếu đến cùng một mô tả hàng đợi thông điệp đang mở. Tiến trình con không kế thừa các đăng ký thông báo thông điệp (message notification registrations) của tiến trình cha. |
| Semaphore có tên POSIX (POSIX named semaphores) | Không | Chia sẻ | `sem_open()` và các lời gọi liên quan. Tiến trình con chia sẻ các tham chiếu đến cùng các semaphore như tiến trình cha. |
| Semaphore không tên POSIX (POSIX unnamed semaphores) | Không | Xem<br>ghi chú | `sem_init()` và các lời gọi liên quan. Nếu các semaphore nằm trong vùng bộ nhớ chia sẻ (shared memory region), tiến trình con sẽ chia sẻ semaphore với tiến trình cha; ngược lại, tiến trình con có bản sao semaphore riêng của mình. |
| Các điều chỉnh semaphore System V<br>(System V semaphore adjustments) | Có | Không | `semop()`. Xem Mục 47.8. |
| Khóa file (File locks) | Có | Xem<br>ghi chú | `flock()`. Tiến trình con kế thừa tham chiếu đến cùng một khóa như tiến trình cha. |
| Khóa bản ghi (Record locks) | Xem<br>ghi chú | Không | `fcntl(F_SETLK).` Các khóa được bảo toàn qua `exec()` trừ khi file descriptor trỏ tới file được đánh dấu là đóng khi thực thi (`close-on-exec`); xem Mục 55.3.5. |

**Bảng 28-4:** Ảnh hưởng của `exec()` và `fork()` lên các thuộc tính của tiến trình (tiếp theo)

| Thuộc tính tiến trình (Process attribute) | exec() | fork() | Các giao diện ảnh hưởng đến thuộc tính; ghi chú bổ sung |
|--------------------------------|--------------|--------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Khác (Miscellaneous) | | | |
| Cài đặt miền địa phương (Locale settings) | Không | Có | `setlocale()`. Là một phần của quá trình khởi tạo thư viện chuẩn C (C run-time initialization), lệnh tương đương với `setlocale(LC_ALL, "C")` được thực thi sau khi một chương trình mới được `execed`. |
| Môi trường dấu chấm động (Floating-point environment) | Không | Có | Khi một chương trình mới được `execed`, trạng thái của môi trường dấu chấm động được đặt lại về mặc định; xem `fenv(3)`. |

| Controlling terminal (Thiết bị đầu cuối điều khiển) | Có | Có | |
| Exit handlers (Hàm xử lý thoát) | Không | Có | atexit(), on_exit(). |
| Linux-specific (Đặc thù của Linux) | | | |
| File-system IDs (ID hệ thống tệp) | Xem<br>ghi chú | Có | setfsuid(), setfsgid(). Các ID này cũng thay đổi bất cứ<br>khi nào các ID hiệu dụng (effective IDs) tương ứng<br>thay đổi. |
| timerfd timers (Bộ hẹn giờ timerfd) | Có | Xem<br>ghi chú | timerfd_create(); tiến trình con (child) kế thừa các bộ mô tả tệp (file descriptors)<br>trỏ đến cùng bộ hẹn giờ như tiến trình cha (parent). |
| Capabilities (Đặc quyền tiến trình) | Xem<br>ghi chú | Có | capset(). Việc xử lý capabilities trong quá trình<br>exec() được mô tả tại Mục 39.5. |
| Capability bounding set (Tập giới hạn capability) | Có | Có | |
| Capabilities securebits flags (Cờ securebits của capability) | Xem<br>ghi chú | Có | Tất cả các cờ securebits đều được giữ nguyên trong<br>suốt quá trình exec() ngoại trừ SECBIT_KEEP_CAPS, cờ này<br>luôn bị xóa. |
| CPU affinity (Độ gắn kết CPU) | Có | Có | sched_setaffinity(). |
| SCHED_RESET_ON_FORK | Có | Không | Xem Mục 35.3.2. |
| Allowed CPUs (Các CPU được phép) | Có | Có | Xem cpuset(7). |
| Allowed memory nodes (Các nút bộ nhớ được phép) | Có | Có | Xem cpuset(7). |
| Memory policy (Chính sách bộ nhớ) | Có | Có | Xem set_mempolicy(2). |
| File leases (Cho thuê tệp) | Có | Xem<br>ghi chú | fcntl(F_SETLEASE). Tiến trình con kế thừa tham chiếu đến<br>cùng một hợp đồng thuê (lease) như tiến trình cha. |
| Directory change notifications (Thông báo thay đổi thư mục) | Có | Không | API dnotify, khả dụng thông qua fcntl(F_NOTIFY). |
| prctl(PR_SET_DUMPABLE) | Xem<br>ghi chú | Có | Trong quá trình exec(), cờ PR_SET_DUMPABLE được thiết lập,<br>trừ khi thực thi (execing) một chương trình set-user-ID hoặc set-group-ID,<br>trong trường hợp đó nó bị xóa. |
| prctl(PR_SET_PDEATHSIG) | Có | Không | |
| prctl(PR_SET_NAME) | Không | Có | |
| oom_adj | Có | Có | Xem Mục 49.9. |
| coredump_filter | Có | Có | Xem Mục 22.1. |

## 28.5 Tóm tắt

Khi tính năng kế toán tiến trình (process accounting) được bật, kernel sẽ ghi một bản ghi kế toán (accounting record) vào một tệp cho mỗi tiến trình kết thúc trên hệ thống. Bản ghi này chứa các thống kê về tài nguyên được sử dụng bởi tiến trình.

Giống như `fork()`, system call `clone()` đặc trưng của Linux tạo ra một tiến trình mới, nhưng cho phép kiểm soát chi tiết hơn về các thuộc tính nào được chia sẻ giữa tiến trình cha (parent) và tiến trình con (child). System call này chủ yếu được sử dụng để hiện thực hóa các thư viện luồng (threading libraries).

Chúng ta đã so sánh tốc độ tạo tiến trình sử dụng `fork()`, `vfork()`, và `clone()`. Mặc dù `vfork()` nhanh hơn `fork()`, khoảng thời gian chênh lệch giữa các system call này là rất nhỏ khi so sánh với thời gian cần thiết để tiến trình con thực hiện một lệnh `exec()` tiếp theo.

Khi một tiến trình con được tạo thông qua `fork()`, nó kế thừa các bản sao của (hoặc trong một số trường hợp là chia sẻ) các thuộc tính tiến trình nhất định từ tiến trình cha, trong khi các thuộc tính tiến trình khác thì không được kế thừa. Ví dụ, tiến trình con kế thừa các bản sao của bảng mô tả tệp (file descriptor table) và cấu hình tín hiệu (signal dispositions) của tiến trình cha, nhưng không kế thừa bộ định thời khoảng (interval timers), khóa bản ghi (record locks), hoặc tập hợp các tín hiệu đang chờ xử lý (pending signals) của tiến trình cha. Tương tự, khi một tiến trình thực hiện một lệnh `exec()`, một số thuộc tính tiến trình giữ nguyên không đổi, trong khi các thuộc tính khác được đặt lại về mặc định. Ví dụ, ID tiến trình (process ID) giữ nguyên, các bộ mô tả tệp vẫn mở (trừ khi được đánh dấu là `close-on-exec`), bộ định thời khoảng được giữ nguyên, và các tín hiệu đang chờ xử lý vẫn ở trạng thái chờ, nhưng các tín hiệu có trình xử lý sẽ được đặt lại về cấu hình mặc định của chúng và các phân đoạn bộ nhớ chia sẻ (shared memory segments) bị tách rời (detached).

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê trong Mục [24.6.](#page-16-0) Chương 17 của [Frisch, 2002] mô tả việc quản trị tính năng kế toán tiến trình, cũng như một số biến thể giữa các phiên bản cài đặt UNIX khác nhau. [Bovet & Cesati, 2005] mô tả việc hiện thực hóa system call `clone()`.

## 28.6 Bài tập

**28-1.** Viết một chương trình để kiểm tra tốc độ của các system call `fork()` và `vfork()` trên hệ thống của bạn. Mỗi tiến trình con phải thoát ngay lập tức, và tiến trình cha phải gọi `wait()` cho mỗi tiến trình con trước khi tạo tiến trình tiếp theo. So sánh sự khác biệt tương đối giữa hai system call này với [Bảng 28-3](#page-97-1). Lệnh tích hợp sẵn của shell `time` có thể được sử dụng để đo thời gian thực thi của một chương trình.
