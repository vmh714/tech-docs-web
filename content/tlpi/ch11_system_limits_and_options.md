# Chương 11: Giới hạn và Tùy chọn hệ thống (System Limits and Options)

Mỗi bản cài đặt (implementation) UNIX đều thiết lập các giới hạn trên nhiều tính năng và tài nguyên hệ thống khác nhau, đồng thời cung cấp—hoặc chọn không cung cấp—các tùy chọn được định nghĩa trong các tiêu chuẩn khác nhau. Các ví dụ bao gồm:

- Một Process ( tiến trình) có thể mở đồng thời bao nhiêu file (tệp) tại một thời điểm?
- Hệ thống có hỗ trợ tín hiệu thời gian thực (realtime signal) hay không?
- Giá trị lớn nhất có thể được lưu trữ trong một biến kiểu `int` là bao nhiêu?
- Một chương trình có thể có danh sách đối số (argument list) lớn đến mức nào?
- Độ dài tối đa của một đường dẫn (pathname) là bao nhiêu?

Mặc dù chúng ta có thể mã hóa cứng (hard-code) các giới hạn và tùy chọn được giả định vào trong một ứng dụng, nhưng điều này làm giảm tính di động (portability), vì các giới hạn và tùy chọn có thể thay đổi:

- Giữa các bản cài đặt UNIX khác nhau: Mặc dù các giới hạn và tùy chọn có thể được cố định trên một bản cài đặt riêng lẻ, nhưng chúng có thể khác nhau giữa bản cài đặt UNIX này với bản cài đặt UNIX khác. Giá trị tối đa có thể được lưu trữ trong một biến `int` là một ví dụ về giới hạn như vậy.
- Tại thời điểm chạy (run time) trên một bản cài đặt cụ thể: Kernel (nhân) có thể đã được cấu hình lại để thay đổi một giới hạn chẳng hạn. Hoặc cách khác, ứng dụng có thể đã được biên dịch trên hệ thống này nhưng lại chạy trên hệ thống khác với các giới hạn và tùy chọn khác nhau.
- Từ hệ thống file (file system) này sang hệ thống file khác: Ví dụ, các hệ thống file System V truyền thống cho phép tên file dài tới 14 byte, trong khi các hệ thống file BSD truyền thống và hầu hết các hệ thống file gốc của Linux cho phép tên file dài tới 255 byte.

Vì các giới hạn và tùy chọn hệ thống ảnh hưởng đến những gì một ứng dụng có thể thực hiện, nên một ứng dụng có tính di động (portable application) cần các phương pháp để xác định giá trị giới hạn và xem xét liệu các tùy chọn có được hỗ trợ hay không. Các tiêu chuẩn ngôn ngữ lập trình C và SUSv3 cung cấp hai con đường chính để một ứng dụng có được thông tin đó:

- Một số giới hạn và tùy chọn có thể được xác định tại thời điểm biên dịch (compile time). Ví dụ, giá trị tối đa của một biến `int` được xác định bởi kiến trúc phần cứng và các lựa chọn thiết kế của trình biên dịch (compiler). Các giới hạn như vậy có thể được ghi lại trong các tệp tiêu đề (header file).
- Các giới hạn và tùy chọn khác có thể thay đổi tại thời điểm chạy (run time). Đối với các trường hợp này, SUSv3 định nghĩa ba hàm—`sysconf()`, `pathconf()`, và `fpathconf()`—mà một ứng dụng có thể gọi để kiểm tra các giới hạn và tùy chọn của bản cài đặt này.

SUSv3 chỉ định một phạm vi giới hạn mà một bản cài đặt tuân thủ chuẩn (conforming implementation) có thể thực thi, cũng như một tập hợp các tùy chọn mà mỗi tùy chọn có thể được cung cấp hoặc không bởi một hệ thống cụ thể. Chúng tôi mô tả một vài giới hạn và tùy chọn trong số này ở chương này, và mô tả các giới hạn khác tại các thời điểm thích hợp ở các chương sau.

## 11.1 Giới hạn hệ thống (System Limits)

Đối với mỗi giới hạn mà nó chỉ định, SUSv3 yêu cầu tất cả các bản cài đặt phải hỗ trợ một giá trị tối thiểu cho giới hạn đó. Trong hầu hết các trường hợp, giá trị tối thiểu này được định nghĩa là một hằng số trong `<limits.h>` với tên có tiền tố là chuỗi `_POSIX_` và (thường) chứa chuỗi `_MAX`; do đó, cấu trúc của tên là `_POSIX_XXX_MAX`.

Nếu một ứng dụng tự giới hạn ở các giá trị tối thiểu mà SUSv3 yêu cầu cho mỗi giới hạn, thì ứng dụng đó sẽ có tính di động cao trên tất cả các bản cài đặt tuân thủ tiêu chuẩn. Tuy nhiên, việc làm như vậy ngăn cản ứng dụng tận dụng lợi thế từ các bản cài đặt cung cấp giới hạn cao hơn. Vì lý do này, thường tốt hơn nếu xác định giới hạn trên một hệ thống cụ thể bằng cách sử dụng `<limits.h>`, `sysconf()`, hoặc `pathconf()`.

> [!NOTE]
> Việc sử dụng chuỗi `_MAX` trong các tên giới hạn do SUSv3 định nghĩa có vẻ gây nhầm lẫn, khi xét đến mô tả của chúng là các giá trị tối thiểu. Lý do cho những cái tên này sẽ trở nên rõ ràng khi chúng ta xem xét rằng mỗi hằng số này định nghĩa một giới hạn trên (upper limit) đối với một số tài nguyên hoặc tính năng nào đó, và các tiêu chuẩn đang nêu rõ rằng giới hạn trên này phải có một giá trị tối thiểu nhất định.

> [!NOTE]
> Trong một số trường hợp, các giá trị tối đa được cung cấp cho một giới hạn và các giá trị này có tên chứa chuỗi `_MIN`. Đối với các hằng số này, điều ngược lại sẽ đúng: chúng đại diện cho một giới hạn dưới (lower limit) đối với một số tài nguyên, và các tiêu chuẩn đang nêu rõ rằng, trên một bản cài đặt tuân thủ chuẩn, giới hạn dưới này không được lớn hơn một giá trị nhất định. Ví dụ, giới hạn `FLT_MIN` (1E-37) định nghĩa giá trị lớn nhất mà một bản cài đặt có thể thiết lập cho số dấu phẩy động nhỏ nhất có thể được biểu diễn, và tất cả các bản cài đặt tuân thủ sẽ có khả năng biểu diễn các số dấu phẩy động nhỏ ít nhất bằng mức này.

Mỗi giới hạn đều có một tên tương ứng với tên giá trị tối thiểu được mô tả ở trên, nhưng không có tiền tố `_POSIX_`. Một bản cài đặt có thể định nghĩa một hằng số với tên này trong `<limits.h>` để biểu thị giới hạn tương ứng cho bản cài đặt đó. Nếu được định nghĩa, giới hạn này sẽ luôn có kích thước ít nhất bằng giá trị tối thiểu được mô tả ở trên (tức là `XXX_MAX >= _POSIX_XXX_MAX`).

SUSv3 chia các giới hạn mà nó chỉ định thành ba loại: giá trị bất biến tại thời điểm chạy (runtime invariant values), giá trị biến đổi theo đường dẫn (pathname variable values), và giá trị có thể tăng tại thời điểm chạy (runtime increasable values). Trong các đoạn văn tiếp theo, chúng tôi mô tả các danh mục này và cung cấp một số ví dụ.

### Giá trị bất biến tại thời điểm chạy (có thể không xác định)

Giá trị bất biến tại thời điểm chạy là một giới hạn mà giá trị của nó, nếu được định nghĩa trong `<limits.h>`, sẽ được cố định đối với bản cài đặt. Tuy nhiên, giá trị có thể không xác định (có thể vì nó phụ thuộc vào không gian bộ nhớ khả dụng), và do đó bị lược bỏ khỏi `<limits.h>`. Trong trường hợp này (và ngay cả khi giới hạn cũng được định nghĩa trong `<limits.h>`), ứng dụng có thể sử dụng `sysconf()` để xác định giá trị tại thời điểm chạy (run time).

Giới hạn `MQ_PRIO_MAX` là một ví dụ về giá trị bất biến tại thời gian thực thi (runtime invariant value). Như đã lưu ý ở Mục 52.5.1, có một giới hạn về độ ưu tiên cho các thông điệp (message) trong hàng đợi thông điệp POSIX (POSIX message queues). Tiêu chuẩn SUSv3 định nghĩa hằng số `_POSIX_MQ_PRIO_MAX` với giá trị 32, là giá trị tối thiểu mà tất cả các hệ thống tuân thủ (conforming implementations) phải cung cấp cho giới hạn này. Điều này có nghĩa là chúng ta có thể chắc chắn rằng mọi hệ thống tuân thủ sẽ cho phép các mức ưu tiên từ 0 cho đến ít nhất là 31 đối với độ ưu tiên của thông điệp. Một bản cài đặt UNIX có thể thiết lập giới hạn cao hơn mức này bằng cách định nghĩa hằng số `MQ_PRIO_MAX` trong tập tin `<limits.h>` với giá trị giới hạn tương ứng của nó. Ví dụ, trên Linux, `MQ_PRIO_MAX` được định nghĩa với giá trị 32.768. Giá trị này cũng có thể được xác định tại thời gian thực thi (run time) bằng cách sử dụng lời gọi hàm (call) sau:

```
lim = sysconf(_SC_MQ_PRIO_MAX);
```

### Giá trị biến đường dẫn (Pathname variable values)

Giá trị biến đường dẫn là các giới hạn liên quan đến đường dẫn (tập tin, thư mục, thiết bị đầu cuối - terminal, v.v.). Mỗi giới hạn có thể cố định đối với hệ thống hoặc có thể thay đổi tùy theo hệ thống tập tin (file system). Trong các trường hợp giới hạn có thể thay đổi tùy thuộc vào đường dẫn, một ứng dụng có thể xác định giá trị của nó bằng cách sử dụng hàm `pathconf()` hoặc `fpathconf()`.

Giới hạn `NAME_MAX` là một ví dụ về giá trị biến đường dẫn. Giới hạn này định nghĩa kích thước tối đa cho một tên tập tin trên một hệ thống tập tin cụ thể. Tiêu chuẩn SUSv3 định nghĩa hằng số `_POSIX_NAME_MAX` với giá trị 14 (giới hạn của hệ thống tập tin System V cũ), là giá trị tối thiểu mà một hệ thống phải cho phép. Một hệ thống có thể định nghĩa `NAME_MAX` với giới hạn cao hơn mức này và/hoặc cung cấp thông tin về một hệ thống tập tin cụ thể thông qua một lời gọi hàm có dạng như sau:

```
lim = pathconf(directory_path, _PC_NAME_MAX)
```

Tham số `directory_path` là đường dẫn đến một thư mục nằm trên hệ thống tập tin cần quan tâm.

### Giá trị có thể tăng tại thời gian thực thi (Runtime increasable values)

Giá trị có thể tăng tại thời gian thực thi là một giới hạn có giá trị tối thiểu cố định cho một hệ thống cụ thể và tất cả các hệ thống chạy hệ thống đó sẽ cung cấp ít nhất giá trị tối thiểu này. Tuy nhiên, một hệ thống cụ thể có thể tăng giới hạn này tại thời gian thực thi và một ứng dụng có thể tìm ra giá trị thực tế được hỗ trợ trên hệ thống bằng cách sử dụng hàm `sysconf()`.

Một ví dụ về giá trị có thể tăng tại thời gian thực thi là `NGROUPS_MAX`, định nghĩa số lượng tối đa các ID nhóm phụ (supplementary group IDs) đồng thời cho một tiến trình (Process) (Mục [9.6](#page-19-1)). Tiêu chuẩn SUSv3 định nghĩa giá trị tối thiểu tương ứng, `_POSIX_NGROUPS_MAX`, với giá trị là 8. Tại thời gian thực thi, một ứng dụng có thể truy xuất giới hạn này bằng cách sử dụng lời gọi `sysconf(_SC_NGROUPS_MAX)`.

### Tóm tắt các giới hạn SUSv3 được chọn lọc

Bảng 11-1 liệt kê một số giới hạn được định nghĩa bởi SUSv3 có liên quan đến cuốn sách này (các giới hạn khác sẽ được giới thiệu ở các chương sau).

**Bảng 11-1:** Các giới hạn SUSv3 được chọn lọc

| Tên giới hạn             | Giá trị | sysconf() / pathconf()        | Mô tả                                                                                                                                                      |
|--------------------------|---------|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ( <limits.h>)</limits.h> | tối     | tên ( <unistd.h>)</unistd.h> |                                                                                                                                                            |
|                          | thiểu   |                               |                                                                                                                                                            |
| ARG_MAX                  | 4096    | _SC_ARG_MAX                   | Số byte tối đa cho các tham số (`argv`)<br>cộng với biến môi trường (`environ`) có thể được<br>truyền cho hàm `exec()` (Mục 6.7 và 27.2.3)                  |
| none                     | none    | _SC_CLK_TCK                   | Đơn vị đo lường thời gian cho hàm `times()`                                                                                                                |
| LOGIN_NAME_MAX           | 9       | _SC_LOGIN_NAME_MAX            | Kích thước tối đa của tên đăng nhập (bao<br>gồm cả byte null kết thúc)                                                                                     |
| OPEN_MAX                 | 20      | _SC_OPEN_MAX                  | Số lượng bộ mô tả tệp (`file descriptor`) tối đa<br>mà một tiến trình có thể mở cùng lúc, và lớn hơn<br>chỉ số bộ mô tả (descriptor number) khả dụng<br>lớn nhất một đơn vị (Mục 36.2) |
| NGROUPS_MAX              | 8       | _SC_NGROUPS_MAX               | Số lượng tối đa các nhóm phụ mà một<br>tiến trình có thể là thành viên<br>(Mục 9.7.3)                                                                        |
| none                     | 1       | _SC_PAGESIZE                  | Kích thước của một trang bộ nhớ ảo<br>(`_SC_PAGE_SIZE` là một từ đồng nghĩa)                                                                                |

| RTSIG_MAX                | 8     | _SC_RTSIG_MAX                 | Số lượng tối đa các tín hiệu realtime<br>(realtime signal) phân biệt (Mục 22.8)                                                                                              |
| SIGQUEUE_MAX             | 32    | _SC_SIGQUEUE_MAX              | Số lượng tối đa các tín hiệu realtime<br>được đưa vào hàng đợi (queued realtime signal) (Mục 22.8)                                                                          |
| STREAM_MAX               | 8     | _SC_STREAM_MAX                | Số lượng luồng stdio tối đa có thể<br>được mở cùng một lúc                                                                                                  |
| NAME_MAX                 | 14    | _PC_NAME_MAX                  | Số byte tối đa trong một tên tệp (filename),<br>không bao gồm byte null kết thúc                                                                            |
| PATH_MAX                 | 256   | _PC_PATH_MAX                  | Số byte tối đa trong một<br>đường dẫn (pathname), bao gồm cả byte<br>null kết thúc                                                                          |
| PIPE_BUF                 | 512   | _PC_PIPE_BUF                  | Số byte tối đa có thể được ghi<br>một cách nguyên tử (atomic) vào một pipe hoặc FIFO<br>(Mục 44.1)                                                        |

Cột đầu tiên của Bảng 11-1 cung cấp tên của giới hạn, có thể được định nghĩa như một hằng số trong `<limits.h>` để chỉ định giới hạn cho một cài đặt cụ thể. Cột thứ hai là mức tối thiểu do SUSv3 định nghĩa cho giới hạn đó (cũng được định nghĩa trong `<limits.h>`). Trong hầu hết các trường hợp, mỗi giá trị tối thiểu được định nghĩa là một hằng số có tiền tố là chuỗi `_POSIX_`. Ví dụ, hằng số `_POSIX_RTSIG_MAX` (được định nghĩa với giá trị 8) chỉ định mức tối thiểu do SUSv3 yêu cầu tương ứng với hằng số cài đặt `RTSIG_MAX`. Cột thứ ba chỉ định tên hằng số có thể được truyền tại thời điểm chạy (run time) cho hàm `sysconf()` hoặc `pathconf()` nhằm truy xuất giới hạn cài đặt. Các hằng số bắt đầu bằng `_SC_` dùng cho `sysconf()`; các hằng số bắt đầu bằng `_PC_` dùng cho `pathconf()` và `fpathconf()`.

Lưu ý các thông tin bổ sung cho nội dung trong Bảng 11-1:

- Hàm `getdtablesize()` là một hàm thay thế đã lỗi thời (obsolete) dùng để xác định giới hạn file descriptor (bộ mô tả tệp) của tiến trình (`OPEN_MAX`). Hàm này từng được quy định trong SUSv2 (đánh dấu là LEGACY), nhưng đã bị loại bỏ trong SUSv3.
- Hàm `getpagesize()` là một hàm thay thế đã lỗi thời dùng để xác định kích thước trang (page size) của hệ thống (`_SC_PAGESIZE`). Hàm này được quy định trong SUSv2 (được đánh dấu là LEGACY), nhưng đã bị loại bỏ trong SUSv3.
- Hằng số `FOPEN_MAX`, được định nghĩa trong `<stdio.h>`, đồng nghĩa với `STREAM_MAX`.
- `NAME_MAX` không bao gồm byte null kết thúc, trong khi `PATH_MAX` bao gồm byte này. Sự bất nhất này đã khắc phục một điểm bất nhất trước đó trong chuẩn POSIX.1 vốn từng gây không rõ ràng về việc liệu `PATH_MAX` có bao gồm byte null kết thúc hay không. Việc định nghĩa `PATH_MAX` bao gồm ký tự kết thúc có nghĩa là các ứng dụng cấp phát đúng `PATH_MAX` byte cho một tên đường dẫn vẫn sẽ tuân thủ tiêu chuẩn.

### Xác định các giới hạn và tùy chọn từ shell: getconf

Từ shell, chúng ta có thể sử dụng lệnh `getconf` để lấy các giới hạn và tùy chọn được hiện thực hóa bởi một hệ thống UNIX cụ thể. Dạng tổng quát của lệnh này như sau:

```
$ getconf variable-name [ pathname ]
```

Biến `variable-name` xác định giới hạn cần quan tâm và là một trong những tên giới hạn chuẩn của SUSV3, chẳng hạn như `ARG_MAX` hoặc `NAME_MAX`. Khi giới hạn liên quan đến một đường dẫn (`pathname`), chúng ta phải chỉ định một đường dẫn làm đối số thứ hai cho lệnh, giống như trong ví dụ thứ hai dưới đây.

```
$ getconf ARG_MAX
131072
$ getconf NAME_MAX /boot
255
```

## 11.2 Truy xuất Giới hạn Hệ thống (và Các Tùy chọn) tại Thời điểm Chạy

Hàm sysconf() cho phép một ứng dụng lấy các giá trị của giới hạn hệ thống (system limit) tại thời điểm chạy (run time).

```c
## include <unistd.h>
long sysconf(int name);
                                         Trả về giá trị của giới hạn được chỉ định bởi name,
                              hoặc –1 nếu giới hạn không xác định hoặc xảy ra lỗi
```

Tham số `name` là một trong các hằng số `_SC_*` được định nghĩa trong `<unistd.h>`, một số trong đó được liệt kê ở Bảng 11-1. Giá trị của giới hạn được trả về dưới dạng kết quả của hàm.

Nếu một giới hạn không thể được xác định, sysconf() sẽ trả về –1. Nó cũng có thể trả về –1 nếu có lỗi xảy ra. (Lỗi duy nhất được chỉ định là `EINVAL`, cho biết rằng `name` không hợp lệ). Để phân biệt trường hợp giới hạn không xác định (indeterminate limit) với lỗi, chúng ta phải đặt `errno` về 0 trước khi gọi hàm; nếu lệnh gọi trả về –1 và `errno` được thiết lập sau khi gọi, thì đã xảy ra lỗi.

> [!NOTE]
> Các giá trị giới hạn được trả về bởi sysconf() (cũng như pathconf() và fpathconf()) luôn là số nguyên kiểu (long). Trong phần tài liệu lý giải (rationale text) cho sysconf(), SUSv3 lưu ý rằng chuỗi (string) đã được xem xét làm giá trị trả về khả dĩ, nhưng đã bị loại bỏ vì độ phức tạp trong việc triển khai và sử dụng.

Liệt kê [11-1](#page-63-0) minh họa việc sử dụng sysconf() để hiển thị các giới hạn hệ thống khác nhau. Chạy chương trình này trên một hệ thống Linux 2.6.31/x86-32 cho kết quả như sau:

```
$ ./t_sysconf
   _SC_ARG_MAX: 2097152
   _SC_LOGIN_NAME_MAX: 256
   _SC_OPEN_MAX: 1024
   _SC_NGROUPS_MAX: 65536
   _SC_PAGESIZE: 4096
   _SC_RTSIG_MAX: 32
Liệt kê 11-1: Sử dụng sysconf()
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– syslim/t_sysconf.c
## include "tlpi_hdr.h"
static void /* In 'msg' cộng với giá trị sysconf() cho 'name' */
sysconfPrint(const char *msg, int name)
{
 long lim;
 errno = 0;
 lim = sysconf(name);
 if (lim != -1) { /* Lệnh gọi thành công, giới hạn có thể xác định */
 printf("%s %ld\n", msg, lim);
 } else {
 if (errno == 0) /* Lệnh gọi thành công, giới hạn không xác định */
 printf("%s (indeterminate)\n", msg);
 else /* Lệnh gọi thất bại */
 errExit("sysconf %s", msg);
 }
}
int
main(int argc, char *argv[])
{
 sysconfPrint("_SC_ARG_MAX: ", _SC_ARG_MAX);
 sysconfPrint("_SC_LOGIN_NAME_MAX: ", _SC_LOGIN_NAME_MAX);
```

```
 sysconfPrint("_SC_OPEN_MAX: ", _SC_OPEN_MAX);
 sysconfPrint("_SC_NGROUPS_MAX: ", _SC_NGROUPS_MAX);
 sysconfPrint("_SC_PAGESIZE: ", _SC_PAGESIZE);
 sysconfPrint("_SC_RTSIG_MAX: ", _SC_RTSIG_MAX);
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– syslim/t_sysconf.c
```

SUSv3 yêu cầu giá trị do sysconf() trả về cho một giới hạn cụ thể phải là hằng số trong suốt vòng đời của tiến trình gọi (calling process). Ví dụ, chúng ta có thể giả định rằng giá trị trả về cho `_SC_PAGESIZE` sẽ không thay đổi khi một tiến trình đang chạy.

> [!NOTE]
> Trên Linux, có một số ngoại lệ (hợp lý) đối với nhận định rằng các giá trị giới hạn là hằng số trong suốt vòng đời của một tiến trình (process). Một tiến trình có thể sử dụng setrlimit() (Mục 36.2) để thay đổi các giới hạn tài nguyên tiến trình (process resource limit) khác nhau ảnh hưởng đến các giá trị giới hạn được báo cáo bởi sysconf(): `RLIMIT_NOFILE`, quyết định số lượng tệp mà tiến trình có thể mở (`_SC_OPEN_MAX`); `RLIMIT_NPROC` (một giới hạn tài nguyên thực tế không được quy định trong SUSv3), là giới hạn trên mỗi người dùng (per-user) về số lượng tiến trình có thể được tạo bởi tiến trình này (`_SC_CHILD_MAX`); và `RLIMIT_STACK`, kể từ Linux 2.6.23, quyết định giới hạn về không gian cho phép đối với các tham số dòng lệnh (command-line argument) và biến môi trường (environment) của tiến trình (`_SC_ARG_MAX`; xem trang hướng dẫn thủ công execve(2) để biết thêm chi tiết).

## 11.3 Truy xuất các giới hạn (và tùy chọn) liên quan đến tệp tại thời điểm chạy (Run Time)

Các hàm `pathconf()` và `fpathconf()` cho phép một ứng dụng lấy các giá trị của các giới hạn liên quan đến tệp tại thời điểm chạy (run time).

```c
## include <unistd.h>
long pathconf(const char *pathname, int name);
long fpathconf(int fd, int name);
                                    Cả hai đều trả về giá trị giới hạn được chỉ định bởi name,
                              hoặc –1 nếu giới hạn không xác định hoặc xảy ra lỗi
```

Sự khác biệt duy nhất giữa `pathconf()` và `fpathconf()` là cách thức chỉ định một tệp hoặc thư mục. Đối với `pathconf()`, việc chỉ định được thực hiện thông qua đường dẫn (`pathname`); đối với `fpathconf()`, việc chỉ định được thực hiện thông qua một File Descriptor (mô tả tệp) (đã được mở trước đó).

Đối số `name` là một trong số các hằng số `_PC_*` được định nghĩa trong `<unistd.h>`, một vài trong số đó được liệt kê trong Bảng 11-1. Bảng [11-2](#page-65-0) cung cấp thêm một số chi tiết về các hằng số `_PC_*` đã được hiển thị trong Bảng 11-1.

Giá trị của giới hạn được trả về dưới dạng kết quả của hàm. Chúng ta có thể phân biệt giữa giá trị trả về không xác định và giá trị trả về do lỗi theo cách tương tự như đối với `sysconf()`.

Không giống như `sysconf()`, chuẩn SUSv3 không yêu cầu các giá trị do `pathconf()` và `fpathconf()` trả về phải giữ nguyên không đổi trong vòng đời của một Process (tiến trình), bởi vì, ví dụ, một File System (hệ thống tệp) có thể được ngắt kết nối (dismount) và gắn kết lại (remount) với các đặc tính khác nhau trong khi một tiến trình đang chạy.

**Bảng 11-2:** Chi tiết về các tên `_PC_*` được chọn cho `pathconf()`

| Hằng số | Ghi chú |
|--------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| _PC_NAME_MAX | Đối với một thư mục, điều này tạo ra giá trị cho các tệp trong thư mục đó. Hành vi đối với các loại tệp khác không được xác định. |
| _PC_PATH_MAX | Đối với một thư mục, điều này tạo ra độ dài tối đa cho một đường dẫn tương đối (relative pathname) bắt đầu từ thư mục này. Hành vi đối với các loại tệp khác không được xác định. |
| _PC_PIPE_BUF | Đối với một FIFO hoặc một pipe, điều này tạo ra giá trị áp dụng cho tệp được tham chiếu. Đối với một thư mục, giá trị áp dụng cho một FIFO được tạo trong thư mục đó. Hành vi đối với các loại tệp khác không được xác định. |

Đoạn mã [11-2](#page-65-1) minh họa việc sử dụng `fpathconf()` để truy xuất các giới hạn khác nhau cho tệp được trỏ tới bởi đầu vào chuẩn (standard input) của nó. Khi chúng ta chạy chương trình này bằng cách chỉ định đầu vào chuẩn là một thư mục trên một hệ thống tệp ext2, chúng ta sẽ thấy kết quả sau:

```
$ ./t_fpathconf < .
   _PC_NAME_MAX: 255
   _PC_PATH_MAX: 4096
   _PC_PIPE_BUF: 4096
Liệt kê 11-2: Sử dụng fpathconf()
–––––––––––––––––––––––––––––––––––––––––––––––––––––– syslim/t_fpathconf.c
## include "tlpi_hdr.h"
static void /* In ra 'msg' cộng với giá trị của fpathconf(fd, name) */
fpathconfPrint(const char *msg, int fd, int name)
{
 long lim;
 errno = 0;
 lim = fpathconf(fd, name);
 if (lim != -1) { /* Lời gọi thành công, giới hạn xác định */
 printf("%s %ld\n", msg, lim);
 } else {
 if (errno == 0) /* Lời gọi thành công, giới hạn không xác định */
 printf("%s (không xác định)\n", msg);
 else /* Lời gọi thất bại */
 errExit("fpathconf %s", msg);
 }
}
int
main(int argc, char *argv[])
{
 fpathconfPrint("_PC_NAME_MAX: ", STDIN_FILENO, _PC_NAME_MAX);
 fpathconfPrint("_PC_PATH_MAX: ", STDIN_FILENO, _PC_PATH_MAX);
 fpathconfPrint("_PC_PIPE_BUF: ", STDIN_FILENO, _PC_PIPE_BUF);
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– syslim/t_fpathconf.c
```

## 11.4 Giới hạn bất định (Indeterminate Limits)

Đôi khi, chúng ta có thể thấy rằng một số giới hạn hệ thống (system limit) không được định nghĩa bằng một hằng số giới hạn của bản cài đặt (implementation limit constant) (ví dụ: PATH\_MAX), và hàm `sysconf()` hoặc `pathconf()` thông báo rằng giới hạn đó (ví dụ: `_PC_PATH_MAX`) là bất định (indeterminate). Trong trường hợp này, chúng ta có thể áp dụng một trong các chiến lược sau:

- Khi viết một ứng dụng có khả năng di động (portable) trên nhiều bản cài đặt UNIX khác nhau, chúng ta có thể chọn sử dụng giá trị giới hạn tối thiểu do SUSv3 chỉ định. Đây là các hằng số có tên dạng `_POSIX_*_MAX`, được mô tả trong Mục [11.1.](#page-59-0) Đôi khi, cách tiếp cận này có thể không khả thi vì giới hạn quá thấp một cách phi thực tế, như trong các trường hợp của `_POSIX_PATH_MAX` và `_POSIX_OPEN_MAX`.
- Trong một số trường hợp, một giải pháp thực tế có thể là bỏ qua việc kiểm tra giới hạn và thay vào đó thực hiện lệnh gọi hàm hệ thống (system call) hoặc hàm thư viện liên quan. (Các lập luận tương tự cũng có thể áp dụng đối với một số tùy chọn SUSv3 được mô tả trong Mục [11.5](#page-66-0).) Nếu lời gọi thất bại và biến `errno` chỉ ra rằng lỗi xảy ra do vượt quá giới hạn hệ thống nào đó, thì chúng ta có thể thử lại, đồng thời sửa đổi hành vi của ứng dụng cho phù hợp. Ví dụ, hầu hết các bản cài đặt UNIX đều áp dụng giới hạn về số lượng tín hiệu thời gian thực (realtime signal) có thể được xếp hàng đợi (queue) tới một tiến trình (process). Khi đạt đến giới hạn này, các cố gắng gửi thêm tín hiệu (sử dụng hàm `sigqueue()`) sẽ thất bại với mã lỗi `EAGAIN`. Trong trường hợp này, tiến trình gửi có thể đơn giản thử lại, có thể sau một khoảng thời gian trễ nhất định. Tương tự, việc cố gắng mở một tệp tin có tên quá dài sẽ trả về lỗi `ENAMETOOLONG`, và ứng dụng có thể xử lý việc này bằng cách thử lại với một tên ngắn hơn.
- Chúng ta có thể viết chương trình hoặc hàm của riêng mình để suy luận hoặc ước tính giới hạn. Trong mỗi trường hợp, lệnh gọi `sysconf()` hoặc `pathconf()` tương ứng được thực hiện, và nếu giới hạn này là bất định, hàm sẽ trả về một giá trị "phỏng đoán hợp lý" (good guess). Dù không hoàn hảo, một giải pháp như vậy thường khả thi trong thực tế.
- Chúng ta có thể sử dụng một công cụ như GNU Autoconf, một công cụ có thể mở rộng nhằm xác định sự tồn tại và các thiết lập của các tính năng cũng như giới hạn khác nhau của hệ thống. Chương trình Autoconf tạo ra các tệp tiêu đề (header file) dựa trên thông tin mà nó xác định được, và các tệp này sau đó có thể được bao gồm (include) trong các chương trình C. Bạn có thể tìm thêm thông tin về Autoconf tại http://www.gnu.org/software/autoconf/.

## 11.5 Tùy chọn hệ thống (System Options)

Cùng với việc chỉ định các giới hạn cho các tài nguyên hệ thống khác nhau, SUSv3 cũng quy định các tùy chọn khác nhau mà một bản cài đặt UNIX có thể hỗ trợ. Các tùy chọn này bao gồm việc hỗ trợ các tính năng như tín hiệu thời gian thực (realtime signal), bộ nhớ chia sẻ POSIX (POSIX shared memory), điều khiển công việc (job control), và luồng POSIX (POSIX thread). Ngoại trừ một số trường hợp ngoại lệ, các bản cài đặt không bắt buộc phải hỗ trợ các tùy chọn này. Thay vào đó, SUSv3 cho phép một bản cài đặt thông báo — ở cả thời điểm biên dịch (compile time) và thời điểm chạy (run time) — liệu nó có hỗ trợ một tính năng cụ thể hay không.

Một bản cài đặt có thể quảng bá khả năng hỗ trợ cho một tùy chọn SUSv3 cụ thể tại thời điểm biên dịch bằng cách định nghĩa một hằng số tương ứng trong `<unistd.h>`. Mỗi hằng số như vậy bắt đầu bằng một tiền tố cho biết tiêu chuẩn mà nó xuất phát (ví dụ: `_POSIX_` hoặc `_XOPEN_`).

Mỗi hằng số tùy chọn, nếu được định nghĩa, sẽ mang một trong các giá trị sau:

- Giá trị –1 có nghĩa là tùy chọn không được hỗ trợ. Trong trường hợp này, các tệp tiêu đề, kiểu dữ liệu (data type) và giao diện hàm (function interface) liên quan đến tùy chọn không cần phải được định nghĩa bởi bản cài đặt. Chúng ta có thể cần xử lý khả năng này bằng phương pháp biên dịch có điều kiện (conditional compilation) sử dụng các chỉ thị tiền xử lý (preprocessor directive) `#if`.
- Giá trị 0 có nghĩa là tùy chọn có thể được hỗ trợ. Một ứng dụng phải kiểm tra tại thời điểm chạy (run time) để xem tùy chọn đó có được hỗ trợ hay không.
- Giá trị lớn hơn 0 có nghĩa là tùy chọn được hỗ trợ. Tất cả các tệp tiêu đề, kiểu dữ liệu và giao diện hàm liên quan đến tùy chọn này đều được định nghĩa và hoạt động theo đúng quy định. Trong nhiều trường hợp, SUSv3 yêu cầu giá trị dương này phải là `200112L`, một hằng số tương ứng với số năm và tháng mà SUSv3 được phê duyệt làm tiêu chuẩn. (Giá trị tương tự cho SUSv4 là `200809L`.)

Khi một hằng số được định nghĩa với giá trị 0, ứng dụng có thể sử dụng các hàm `sysconf()` và `pathconf()` (hoặc `fpathconf()`) để kiểm tra tại thời điểm chạy xem tùy chọn đó có được hỗ trợ hay không. Các đối số tên được truyền vào các hàm này nhìn chung có hình thức giống như các hằng số tại thời điểm biên dịch tương ứng, nhưng với tiền tố được thay thế bằng `_SC_` hoặc `_PC_`. Bản cài đặt phải cung cấp ít nhất các tệp tiêu đề, hằng số và giao diện hàm cần thiết để thực hiện việc kiểm tra lúc chạy.

> [!NOTE]
> SUSv3 chưa rõ ràng về việc liệu một hằng số tùy chọn không được định nghĩa có mang ý nghĩa giống như việc định nghĩa hằng số đó với giá trị 0 ("tùy chọn có thể được hỗ trợ") hay với giá trị –1 ("tùy chọn không được hỗ trợ"). Ủy ban tiêu chuẩn sau đó đã đưa ra quyết định rằng trường hợp này phải có ý nghĩa tương đương với việc định nghĩa hằng số có giá trị –1, và SUSv4 đã nêu rõ điều này một cách tường minh.

Bảng [11-3](#page-68-0) liệt kê một số tùy chọn được quy định trong SUSv3. Cột đầu tiên của bảng cung cấp tên của hằng số thời điểm biên dịch (compile-time constant) tương ứng cho tùy chọn (được định nghĩa trong `<unistd.h>`), cũng như đối số tên `sysconf()` (`_SC_*`) hoặc `pathconf()` (`_PC_*`) tương ứng. Lưu ý các điểm sau đây về các tùy chọn cụ thể:

- Một số tùy chọn bắt buộc phải có bởi SUSv3; nghĩa là hằng số thời điểm biên dịch luôn đánh giá ra một giá trị lớn hơn 0. Trước đây, các tùy chọn này thực sự mang tính tùy chọn (optional), nhưng ngày nay thì không. Các tùy chọn này được đánh dấu bằng ký tự `+` trong cột Ghi chú (Notes). (Trong SUSv4, một loạt các tùy chọn vốn mang tính tùy chọn trong SUSv3 đã trở thành bắt buộc).

> [!NOTE]
> Mặc dù các tùy chọn như vậy là bắt buộc theo SUSv3, một số hệ thống UNIX tuy nhiên vẫn có thể được cài đặt ở cấu hình không tuân thủ (nonconforming). Do đó, đối với các ứng dụng có tính di động (portable applications), việc kiểm tra xem một tùy chọn có ảnh hưởng đến ứng dụng có được hỗ trợ hay không có thể vẫn rất đáng giá, bất kể tiêu chuẩn có yêu cầu tùy chọn đó hay không.

- Đối với một số tùy chọn nhất định, hằng số thời điểm biên dịch phải có giá trị khác –1. Nói cách khác, hoặc tùy chọn phải được hỗ trợ hoặc việc hỗ trợ phải có khả năng kiểm tra được tại thời điểm chạy (run time). Các tùy chọn này được đánh dấu bằng ký tự `*` trong cột Ghi chú (Notes).

**Bảng 11-3:** Các tùy chọn SUSv3 được chọn lọc

| Tên tùy chọn (hằng số)<br>(Tên sysconf() / pathconf())     | Mô tả                                                                                                                                          | Ghi chú |
|-------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|-------|
| _POSIX_ASYNCHRONOUS_IO<br>(_SC_ASYNCHRONOUS_IO)             | Nhập/xuất bất đồng bộ (Asynchronous I/O)                                                                                                       |       |
| _POSIX_CHOWN_RESTRICTED<br>(_PC_CHOWN_RESTRICTED)           | Chỉ các tiến trình (Process) có đặc quyền mới có thể sử dụng chown() và<br>fchown() để thay đổi ID người dùng và ID nhóm của một<br>tệp thành các giá trị tùy ý (Mục 15.3.2) | *     |
| _POSIX_JOB_CONTROL<br>(_SC_JOB_CONTROL)                     | Điều khiển công việc (Job Control) (Mục 34.7)                                                                                                  | +     |
| _POSIX_MESSAGE_PASSING<br>(_SC_MESSAGE_PASSING)             | Hàng đợi thông điệp POSIX (POSIX Message Queues) (Chương 52)                                                                                    |       |
| _POSIX_PRIORITY_SCHEDULING<br>(_SC_PRIORITY_SCHEDULING)     | Lập lịch tiến trình (Process Scheduling) (Mục 35.3)                                                                                            |       |
| _POSIX_REALTIME_SIGNALS<br>(_SC_REALTIME_SIGNALS)           | Phần mở rộng tín hiệu thời gian thực (Realtime Signals Extension) (Mục 22.8)                                                                   |       |
| _POSIX_SAVED_IDS<br>(none)                                  | Tiến trình hỗ trợ cơ chế saved set-user-ID và saved set-group-ID (Mục 9.4)                                                     | +     |
| _POSIX_SEMAPHORES<br>(_SC_SEMAPHORES)                       | Semaphore POSIX (POSIX Semaphores) (Chương 53)                                                                                                 |       |
| _POSIX_SHARED_MEMORY_OBJECTS<br>(_SC_SHARED_MEMORY_OBJECTS) | Đối tượng bộ nhớ chia sẻ POSIX (POSIX Shared Memory Objects) (Chương 54)                                                                       |       |
| _POSIX_THREADS<br>(_SC_THREADS)                             | Luồng POSIX (POSIX Threads)                                                                                                                    |       |
| _XOPEN_UNIX<br>(_SC_XOPEN_UNIX)                             | Phần mở rộng XSI được hỗ trợ (Mục 1.3.4)                                                                                                       |       |

## 11.6 Tổng kết

SUSv3 quy định các giới hạn mà một hệ thống thực thi (implementation) có thể áp đặt và các tùy chọn hệ thống (system options) mà hệ thống đó có thể hỗ trợ.

Thông thường, việc không nên cứng nhắc (hard-code) các giả định về giới hạn và tùy chọn hệ thống vào trong một chương trình là điều rất đáng mong đợi, bởi vì chúng có thể thay đổi giữa các hệ thống thực thi khác nhau và ngay trên cùng một hệ thống, hoặc tại thời điểm chạy (run time) hoặc trên các file system khác nhau. Do đó, SUSv3 chỉ định các phương pháp mà qua đó một hệ thống thực thi có thể công bố (advertise) các giới hạn và tùy chọn mà nó hỗ trợ. Đối với hầu hết các giới hạn, SUSv3 quy định một giá trị tối thiểu mà mọi hệ thống thực thi phải hỗ trợ. Thêm vào đó, mỗi hệ thống thực thi có thể công bố các giới hạn và tùy chọn đặc thù của riêng nó tại thời điểm biên dịch (compile time) (thông qua định nghĩa hằng số trong `<limits.h>` hoặc `<unistd.h>`) và/hoặc tại thời điểm chạy (thông qua lời gọi đến `sysconf()`, `pathconf()`, hoặc `fpathconf()`). Các kỹ thuật này tương tự cũng có thể được sử dụng để tìm hiểu xem hệ thống thực thi hỗ trợ những tùy chọn SUSv3 nào. Trong một số trường hợp, việc xác định một giới hạn cụ thể bằng cả hai phương pháp trên có thể là bất khả thi. Đối với các giới hạn không xác định (indeterminate limits) như vậy, chúng ta buộc phải sử dụng các kỹ thuật đặc thù (ad hoc techniques) để xác định giới hạn mà ứng dụng cần tuân thủ.

### Thông tin thêm

Chương 2 của [Stevens & Rago, 2005] và Chương 2 của [Gallmeister, 1995] đề cập đến các nội dung tương tự như chương này. [Lewine, 1991] cũng cung cấp nhiều nền tảng hữu ích (dù hiện tại đã hơi lỗi thời). Một số thông tin về các tùy chọn POSIX kèm theo chú thích về chi tiết glibc và Linux có thể được tìm thấy tại http://people.redhat.com/drepper/posix-option-groups.html. Các trang hướng dẫn sử dụng (manual pages) sau của Linux cũng rất liên quan: `sysconf(3)`, `pathconf(3)`, `feature_test_macros(7)`, `posixoptions(7)`, và `standards(7)`.

Các nguồn thông tin tốt nhất (mặc dù đôi khi hơi khó đọc) là các phần liên quan trong SUSv3, đặc biệt là Chương 2 từ phần Định nghĩa Cơ bản (Base Definitions - XBD), và các thông số kỹ thuật cho `<unistd.h>`, `<limits.h>`, `sysconf()`, và `fpathconf()`. [Josey, 2004] cung cấp hướng dẫn về việc sử dụng SUSv3.

## 11.7 Bài tập

- **11-1.** Hãy thử chạy chương trình trong [Listing 11-1](#page-63-0) trên các hệ thống UNIX khác nếu bạn có quyền truy cập vào chúng.
- **11-2.** Hãy thử chạy chương trình trong [Listing 11-2](#page-65-1) trên các file system khác nhau.
