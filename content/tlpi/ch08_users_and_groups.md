# Chương 8: Người dùng và Nhóm (Users and Groups)

Mỗi người dùng (user) có một tên đăng nhập (login name) duy nhất và một mã định danh người dùng dạng số (numeric user identifier - UID) đi kèm. Người dùng có thể thuộc về một hoặc nhiều nhóm (group). Mỗi nhóm cũng có một tên duy nhất và một mã định danh nhóm (group identifier - GID).

Mục đích chính của các định danh người dùng và nhóm là để xác định quyền sở hữu các tài nguyên hệ thống khác nhau và kiểm soát các quyền (permissions) được cấp cho các tiến trình (processes) khi truy cập các tài nguyên đó. Ví dụ, mỗi tệp (file) thuộc về một người dùng và nhóm cụ thể, và mỗi tiến trình có một số ID người dùng và nhóm để xác định ai là chủ sở hữu tiến trình đó và tiến trình có những quyền gì khi truy cập một tệp (xem [Chương 9](#page-14-0) để biết chi tiết).

Trong chương này, chúng ta sẽ xem xét các tệp hệ thống được sử dụng để định nghĩa người dùng và nhóm trên hệ thống, sau đó mô tả các hàm thư viện (library functions) dùng để truy xuất thông tin từ các tệp này. Kết thúc chương là phần thảo luận về hàm `crypt()`, được sử dụng để mã hóa và xác thực mật khẩu đăng nhập.

## 8.1 Tệp Mật khẩu: /etc/passwd

Tệp mật khẩu của hệ thống, `/etc/passwd`, chứa một dòng cho mỗi tài khoản người dùng trên hệ thống. Mỗi dòng bao gồm bảy trường (fields) được phân tách bằng dấu hai chấm (:), như trong ví dụ sau:

mtk:x:1000:100:Michael Kerrisk:/home/mtk:/bin/bash

Theo thứ tự, các trường này bao gồm:

- Tên đăng nhập (Login name): Đây là tên duy nhất mà người dùng phải nhập để đăng nhập. Thường thì tên này cũng được gọi là tên người dùng (username). Chúng ta cũng có thể coi tên đăng nhập là định danh có thể đọc được bằng con người (mang tính tượng trưng) tương ứng với định danh người dùng dạng số (sẽ được mô tả ngay sau đây). Các chương trình như `ls(1)` hiển thị tên này thay vì ID người dùng dạng số liên kết với tệp, khi được yêu cầu hiển thị quyền sở hữu của một tệp (như trong `ls –l`).
- Mật khẩu đã mã hóa (Encrypted password): Trường này chứa một mật khẩu đã mã hóa dài 13 ký tự, mà chúng ta sẽ mô tả chi tiết hơn trong Mục [8.5](#page-9-0). Nếu trường mật khẩu chứa bất kỳ chuỗi nào khác — cụ thể là một chuỗi có độ dài khác 13 ký tự — thì việc đăng nhập vào tài khoản này sẽ bị vô hiệu hóa, vì chuỗi như vậy không thể đại diện cho một mật khẩu mã hóa hợp lệ. Tuy nhiên, lưu ý rằng trường này sẽ bị bỏ qua nếu mật khẩu ẩn (shadow passwords) đã được bật (đây là cấu hình phổ biến). Trong trường hợp này, trường mật khẩu trong `/etc/passwd` theo quy ước sẽ chứa chữ cái `x` (mặc dù bất kỳ chuỗi ký tự không rỗng nào cũng có thể xuất hiện), và mật khẩu đã mã hóa thay vào đó được lưu trữ trong tệp mật khẩu ẩn (Mục [8.2](#page-2-0)). Nếu trường mật khẩu trong `/etc/passwd` trống, thì không cần mật khẩu để đăng nhập vào tài khoản này (điều này vẫn đúng ngay cả khi mật khẩu ẩn được bật).

Ở đây, chúng ta giả định rằng mật khẩu được mã hóa bằng thuật toán Data Encryption Standard (DES), cơ chế mã hóa mật khẩu lịch sử và vẫn được sử dụng rộng rãi trên UNIX. Có thể thay thế DES bằng các cơ chế khác, chẳng hạn như MD5, tạo ra một mã băm thông điệp (message digest) 128-bit (một dạng hàm băm - hash) từ đầu vào của nó. Giá trị này được lưu trữ dưới dạng một chuỗi 34 ký tự trong tệp mật khẩu (hoặc tệp mật khẩu ẩn).

- ID người dùng (User ID - UID): Đây là ID dạng số của người dùng này. Nếu trường này có giá trị `0`, thì tài khoản này có các đặc quyền siêu người dùng (superuser privileges). Thông thường chỉ có một tài khoản như vậy, với tên đăng nhập là `root`. Trên Linux 2.2 trở về trước, ID người dùng được duy trì dưới dạng giá trị 16-bit, cho phép dải giá trị từ 0 đến 65.535; trên Linux 2.4 trở về sau, chúng được lưu trữ bằng 32-bit, cho phép một dải giá trị lớn hơn nhiều.

> [!NOTE]
> Có thể (nhưng không phổ biến) có nhiều hơn một bản ghi trong tệp mật khẩu có cùng ID người dùng, do đó cho phép nhiều tên đăng nhập cho cùng một ID người dùng. Điều này cho phép nhiều người dùng truy cập vào cùng một tài nguyên (ví dụ: tệp) bằng các mật khẩu khác nhau. Các tên đăng nhập khác nhau có thể được liên kết với các tập hợp ID nhóm khác nhau.

- ID nhóm (Group ID - GID): Đây là ID dạng số của nhóm đầu tiên mà người dùng này là thành viên. Các tư cách thành viên nhóm bổ sung cho người dùng này được định nghĩa trong tệp nhóm của hệ thống (system group file).
- Chú thích (Comment): Trường này chứa văn bản thông tin về người dùng. Văn bản này được hiển thị bởi các chương trình khác nhau, chẳng hạn như `finger(1)`.
- Thư mục chính (Home directory): Đây là thư mục khởi tạo mà người dùng được đặt vào sau khi đăng nhập. Trường này trở thành giá trị của biến môi trường `HOME`.
- Shell đăng nhập (Login shell): Đây là chương trình mà quyền điều khiển được chuyển đến ngay khi người dùng đăng nhập. Thông thường, đây là một trong các shell, chẳng hạn như `bash`, nhưng nó có thể là bất kỳ chương trình nào. Nếu trường này trống, thì shell đăng nhập mặc định sẽ là `/bin/sh`, Bourne shell. Trường này trở thành giá trị của biến môi trường `SHELL`.

Trên một hệ thống độc lập (stand-alone system), toàn bộ thông tin mật khẩu nằm trong tệp `/etc/passwd`. Tuy nhiên, nếu chúng ta đang sử dụng một hệ thống như Network Information System (NIS) hoặc Lightweight Directory Access Protocol (LDAP) để phân phối mật khẩu trong một môi trường mạng, một phần hoặc toàn bộ thông tin này sẽ nằm trên một hệ thống từ xa (remote system). Miễn là các chương trình truy cập thông tin mật khẩu sử dụng các hàm được mô tả sau trong chương này (`getpwnam()`, `getpwuid()`, v.v.), việc sử dụng NIS hoặc LDAP sẽ hoàn toàn trong suốt (transparent) đối với các ứng dụng. Các nhận xét tương tự cũng áp dụng cho các tệp mật khẩu ẩn và tệp nhóm được thảo luận trong các mục tiếp theo.

## 8.2 Tệp Mật khẩu Ẩn (Shadow Password File): /etc/shadow

Về mặt lịch sử, các hệ thống UNIX duy trì toàn bộ thông tin người dùng, bao gồm cả mật khẩu đã mã hóa (encrypted password), trong tệp `/etc/passwd`. Điều này gây ra một vấn đề bảo mật. Vì các tiện ích hệ thống không có đặc quyền (unprivileged) khác nhau cần có quyền đọc (read access) đối với các thông tin khác trong tệp mật khẩu, nó bắt buộc phải được đặt ở trạng thái mở quyền đọc cho tất cả người dùng. Điều này mở đường cho các chương trình bẻ khóa mật khẩu (password-cracking programs), vốn cố gắng mã hóa các danh sách lớn gồm các mật khẩu dễ đoán (ví dụ: các từ điển chuẩn hoặc tên của con người) để xem chúng có khớp với mật khẩu đã mã hóa của người dùng hay không. Tệp mật khẩu ẩn (shadow password file), `/etc/shadow`, được phát minh như một phương pháp ngăn chặn các cuộc tấn công như vậy. Ý tưởng là tất cả thông tin người dùng không nhạy cảm nằm trong tệp mật khẩu có quyền đọc công khai, trong khi các mật khẩu đã mã hóa được duy trì trong tệp mật khẩu ẩn, vốn chỉ có thể được đọc bởi các chương trình có đặc quyền (privileged programs).

Ngoài tên đăng nhập (login name) – thứ dùng để khớp với bản ghi tương ứng trong tệp mật khẩu – và mật khẩu đã mã hóa, tệp mật khẩu ẩn còn chứa một số trường (fields) liên quan đến bảo mật khác. Các chi tiết thêm về các trường này có thể được tìm thấy trong trang hướng dẫn (manual page) `shadow(5)`. Chúng ta sẽ chủ yếu quan tâm đến trường mật khẩu đã mã hóa, thứ mà chúng ta sẽ thảo luận chi tiết hơn khi xem xét hàm thư viện `crypt()` sau đây trong Mục [8.5](#page-9-0).

SUSv3 không quy định về mật khẩu ẩn (shadow passwords), và không phải tất cả các bản cài đặt UNIX đều cung cấp tính năng này.

## 8.3 Tệp Nhóm (Group File): /etc/group

Vì các mục đích quản trị khác nhau, cụ thể là kiểm soát quyền truy cập vào các tệp và tài nguyên hệ thống khác, việc tổ chức người dùng thành các nhóm (groups) là rất hữu ích.

Tập hợp các nhóm mà một người dùng thuộc về được xác định bởi sự kết hợp giữa trường ID nhóm (group ID) trong mục nhập mật khẩu của người dùng và các nhóm mà người dùng được liệt kê trong tệp nhóm (group file). Sự phân tách thông tin kỳ lạ qua hai tệp này bắt nguồn từ lịch sử. Trong các bản cài đặt UNIX đầu tiên, một người dùng chỉ có thể là thành viên của một nhóm tại một thời điểm. Tư cách thành viên nhóm ban đầu của người dùng khi đăng nhập được xác định bởi trường ID nhóm của tệp mật khẩu và có thể thay đổi sau đó bằng lệnh `newgrp(1)`, lệnh này yêu cầu người dùng cung cấp mật khẩu nhóm (nếu nhóm đó được bảo vệ bằng mật khẩu). 4.2BSD giới thiệu khái niệm tư cách thành viên nhiều nhóm đồng thời (multiple simultaneous group memberships), sau đó được tiêu chuẩn hóa trong POSIX.1-1990. Theo sơ đồ này, tệp nhóm liệt kê các tư cách thành viên nhóm bổ sung của mỗi người dùng. (Lệnh `groups(1)` hiển thị các nhóm mà tiến trình shell (shell process) là thành viên, hoặc, nếu một hoặc nhiều tên người dùng được cung cấp làm đối số dòng lệnh (command-line arguments), thì hiển thị tư cách thành viên nhóm của những người dùng đó.)

Tệp nhóm, `/etc/group`, chứa một dòng cho mỗi nhóm trong hệ thống. Mỗi dòng bao gồm bốn trường ngăn cách nhau bằng dấu hai chấm (colon-separated fields), như trong các ví dụ sau:

```
users:x:100:
jambit:x:106:claus,felli,frank,harti,markus,martin,mtk,paul
```

Theo thứ tự, các trường này lần lượt là:

- Tên nhóm (Group name): Đây là tên của nhóm. Giống như tên đăng nhập trong tệp mật khẩu, chúng ta có thể coi đây là định danh dạng con người có thể đọc được (ký hiệu) tương ứng với định danh nhóm dạng số (numeric group identifier).
- Mật khẩu đã mã hóa (Encrypted password): Trường này chứa một mật khẩu tùy chọn cho nhóm. Sự ra đời của tư cách thành viên nhiều nhóm khiến cho mật khẩu nhóm ngày nay hiếm khi được sử dụng trên các hệ thống UNIX. Mặc dù vậy, vẫn có thể đặt mật khẩu cho một nhóm (một người dùng có đặc quyền có thể làm điều này bằng cách sử dụng lệnh `passwd`). Nếu người dùng không phải là thành viên của nhóm, `newgrp(1)` sẽ yêu cầu mật khẩu này trước khi khởi động một shell mới có tư cách thành viên nhóm bao gồm nhóm đó. Nếu tính năng ẩn mật khẩu nhóm (password shadowing) được bật, thì trường này sẽ bị bỏ qua (trong trường hợp này, theo quy ước, nó chỉ chứa ký tự `x`, nhưng bất kỳ chuỗi nào, kể cả chuỗi rỗng, đều có thể xuất hiện) và các mật khẩu đã mã hóa thực sự được giữ trong tệp nhóm ẩn `/etc/gshadow`, vốn chỉ có thể được truy cập bởi người dùng và chương trình có đặc quyền. Mật khẩu nhóm được mã hóa theo cách tương tự như mật khẩu người dùng (Mục [8.5\)](#page-9-0).
- ID Nhóm (Group ID - GID): Đây là ID dạng số của nhóm này. Thông thường có một nhóm được định nghĩa với ID nhóm là 0, có tên là `root` (giống như bản ghi `/etc/passwd` với ID người dùng là 0). Trên Linux 2.2 trở về trước, ID nhóm được duy trì dưới dạng giá trị 16-bit, cho phép dải từ 0 đến 65.535; trên Linux 2.4 trở về sau, chúng được lưu trữ bằng 32-bit.
- Danh sách người dùng (User list): Đây là danh sách ngăn cách bằng dấu phẩy gồm tên của những người dùng là thành viên của nhóm này. (Danh sách này bao gồm tên người dùng thay vì ID người dùng, bởi vì như đã lưu ý trước đó, ID người dùng không nhất thiết phải là duy nhất trong tệp mật khẩu).

Để ghi lại rằng người dùng `avr` là thành viên của các nhóm `users`, `staff` và `teach`, chúng ta sẽ thấy bản ghi sau trong tệp mật khẩu:

```
avr:x:1001:100:Anthony Robins:/home/avr:/bin/bash
```

Và các bản ghi sau sẽ xuất hiện trong tệp nhóm:

```
users:x:100:
staff:x:101:mtk,avr,martinl
teach:x:104:avr,rlb,alc
```

Trường thứ tư của bản ghi mật khẩu (password record), chứa ID nhóm (group ID) 100, chỉ định tư cách thành viên của nhóm `users`. Các tư cách thành viên nhóm còn lại được thể hiện bằng cách liệt kê `avr` một lần trong mỗi bản ghi có liên quan trong tệp nhóm (group file).

## 8.4 Truy xuất thông tin Người dùng và Nhóm

Trong phần này, chúng ta sẽ xem xét các hàm thư viện (library functions) cho phép chúng ta truy xuất các bản ghi riêng lẻ từ tệp mật khẩu (password file), tệp mật khẩu ẩn (shadow password file) và tệp nhóm (group file), cũng như quét tất cả các bản ghi trong mỗi tệp này.

### Truy xuất các bản ghi từ tệp mật khẩu

Các hàm `getpwnam()` và `getpwuid()` thực hiện truy xuất các bản ghi từ tệp mật khẩu.

```c
## include <pwd.h>
struct passwd *getpwnam(const char *name);
struct passwd *getpwuid(uid_t uid);
                              Cả hai đều trả về một con trỏ khi thành công, hoặc NULL khi có lỗi;
                            xem phần văn bản chính để biết mô tả về trường hợp "không tìm thấy"
```

Với tên đăng nhập (login name) được cung cấp trong `name`, hàm `getpwnam()` trả về một con trỏ trỏ đến một cấu trúc (structure) có kiểu dữ liệu như sau, chứa thông tin tương ứng từ bản ghi mật khẩu:

```
struct passwd {
 char *pw_name; /* Tên đăng nhập (tên người dùng) */
 char *pw_passwd; /* Mật khẩu đã mã hóa */
 uid_t pw_uid; /* ID người dùng (User ID) */
 gid_t pw_gid; /* ID nhóm (Group ID) */
 char *pw_gecos; /* Chú thích (thông tin người dùng) */
 char *pw_dir; /* Thư mục làm việc ban đầu (thư mục home) */
 char *pw_shell; /* Shell đăng nhập */
};
```

Các trường `pw_gecos` và `pw_passwd` của cấu trúc `passwd` không được định nghĩa trong SUSv3, nhưng có sẵn trên tất cả các hệ triển khai UNIX. Trường `pw_passwd` chỉ chứa thông tin hợp lệ nếu tính năng mật khẩu ẩn (password shadowing) không được bật. (Về mặt lập trình, cách đơn giản nhất để xác định xem mật khẩu ẩn có được bật hay không là thực hiện một lời gọi hàm `getpwnam()` thành công, tiếp theo là gọi hàm `getspnam()` — sẽ được mô tả ngay sau đây — để xem nó có trả về bản ghi mật khẩu ẩn cho cùng tên người dùng đó hay không). Một số hệ triển khai khác cung cấp các trường bổ sung không chuẩn trong cấu trúc này.

> [!NOTE]
> Trường `pw_gecos` có nguồn gốc từ các hệ triển khai UNIX thời kỳ đầu, nơi trường này chứa thông tin được sử dụng để giao tiếp với một máy tính chạy Hệ điều hành Tổng hợp General Electric (General Electric Comprehensive Operating System - GECOS). Mặc dù cách sử dụng này từ lâu đã trở nên lỗi thời, tên trường vẫn được giữ lại và trường này được sử dụng để ghi lại thông tin về người dùng.

Hàm `getpwuid()` trả về chính xác thông tin giống như `getpwnam()`, nhưng thực hiện tra cứu bằng cách sử dụng ID người dùng dạng số (numeric user ID) được truyền vào qua tham số `uid`.

Cả `getpwnam()` và `getpwuid()` đều trả về một con trỏ trỏ đến một cấu trúc được cấp phát tĩnh (statically allocated structure). Cấu trúc này sẽ bị ghi đè mỗi khi gọi bất kỳ hàm nào trong hai hàm này (hoặc hàm `getpwnent()` được mô tả bên dưới).

Vì chúng trả về một con trỏ trỏ đến bộ nhớ được cấp phát tĩnh, `getpwnam()` và `getpwuid()` không phải là hàm tái nhập (reentrant). Thực tế, tình hình còn phức tạp hơn, vì cấu trúc `passwd` được trả về có chứa các con trỏ trỏ đến các thông tin khác (ví dụ: trường `pw_name`) cũng được cấp phát tĩnh. (Chúng tôi giải thích về tính tái nhập - reentrancy trong Mục 21.1.2). Các tuyên bố tương tự cũng áp dụng cho các hàm `getgrnam()` và `getgrgid()` (sẽ được mô tả ngay sau đây).

SUSv3 chỉ định một tập hợp tương đương các hàm tái nhập (reentrant functions) — `getpwnam_r()`, `getpwuid_r()`, `getgrnam_r()`, và `getgrgid_r()` — bao gồm các tham số là một cấu trúc `passwd` (hoặc `group`) và một vùng đệm (buffer area) để chứa các cấu trúc khác mà các trường của cấu trúc `passwd` (`group`) trỏ tới. Số lượng byte cần thiết cho bộ nhớ đệm bổ sung này có thể được lấy bằng cách sử dụng lời gọi `sysconf(_SC_GETPW_R_SIZE_MAX)` (hoặc `sysconf(_SC_GETGR_R_SIZE_MAX)` trong trường hợp các hàm liên quan đến nhóm). Xem các trang hướng dẫn sử dụng (manual pages) để biết chi tiết về các hàm này.

Theo SUSv3, nếu không thể tìm thấy một bản ghi `passwd` khớp, thì `getpwnam()` và `getpwuid()` phải trả về `NULL` và giữ nguyên giá trị của `errno`. Điều này có nghĩa là chúng ta có thể phân biệt giữa trường hợp lỗi và trường hợp "không tìm thấy" bằng cách sử dụng mã nguồn như sau:

```
struct passwd *pwd;
errno = 0;
pwd = getpwnam(name);
if (pwd == NULL) {
 if (errno == 0)
 /* Không tìm thấy */;
 else
 /* Lỗi */;
 }
```

Tuy nhiên, một số hệ triển khai UNIX không tuân thủ SUSv3 điểm này. Nếu không tìm thấy bản ghi `passwd` khớp, các hàm này sẽ trả về `NULL` và đặt `errno` thành một giá trị khác 0, chẳng hạn như `ENOENT` hoặc `ESRCH`. Trước phiên bản 2.7, glibc trả về lỗi `ENOENT` cho trường hợp này, nhưng kể từ phiên bản 2.7, glibc đã tuân thủ các yêu cầu của SUSv3. Sự khác biệt giữa các hệ triển khai này một phần phát sinh do POSIX.1-1990 không yêu cầu các hàm này phải thiết lập `errno` khi xảy ra lỗi và cho phép chúng thiết lập `errno` cho trường hợp "không tìm thấy". Kết quả là, thực tế không thể phân biệt một cách tương thích khả chuyển (portably) giữa trường hợp lỗi và trường hợp "không tìm thấy" khi sử dụng các hàm này.

```

### Truy xuất bản ghi từ tệp nhóm (group file)

Các hàm `getgrnam()` và `getgrgid()` truy xuất các bản ghi từ tệp nhóm (group file).

```c

## include <grp.h>

struct group *getgrnam(const char *name);
struct group *getgrgid(gid_t gid);
Cả hai đều trả về con trỏ khi thành công, hoặc NULL khi lỗi;
xem phần văn bản chính để biết mô tả về trường hợp "không tìm thấy"

```

Hàm `getgrnam()` tra cứu thông tin nhóm theo tên nhóm (group name), và hàm `getgrgid()` thực hiện tra cứu theo ID nhóm (group ID). Cả hai hàm đều trả về một con trỏ trỏ đến một cấu trúc (structure) có kiểu như sau:

```

struct group {
char *gr_name; /* Tên nhóm */
char *gr_passwd; /* Mật khẩu mã hóa (nếu không dùng password shadowing) */
gid_t gr_gid; /* ID nhóm */
char **gr_mem; /* Mảng kết thúc bằng NULL chứa các con trỏ trỏ đến tên
của các thành viên được liệt kê trong /etc/group */
};

```

Trường `gr_passwd` của cấu trúc nhóm không được chỉ định trong SUSv3, nhưng có sẵn trên hầu hết các cài đặt UNIX.

Giống như các hàm mật khẩu (password function) tương ứng đã mô tả ở trên, cấu trúc này sẽ bị ghi đè (overwritten) trên mỗi lần gọi đến một trong các hàm này.

Nếu các hàm này không thể tìm thấy bản ghi nhóm khớp, chúng sẽ thể hiện các biến đổi hành vi tương tự như những gì chúng ta đã mô tả đối với `getpwnam()` và `getpwuid()`.

### Chương trình ví dụ

Một công dụng phổ biến của các hàm mà chúng ta đã mô tả trong phần này là chuyển đổi tên người dùng (user name) và tên nhóm (group name) dạng ký hiệu thành ID dạng số và ngược lại. Liệt kê [8-1](#page-6-0) minh họa các phép chuyển đổi này, dưới dạng bốn hàm: `userNameFromId()`, `userIdFromName()`, `groupNameFromId()`, và `groupIdFromName()`. Để thuận tiện cho hàm gọi (caller), `userIdFromName()` và `groupIdFromName()` cũng cho phép đối số tên (name argument) là một chuỗi thuần số (numeric string); trong trường hợp đó, chuỗi được chuyển đổi trực tiếp thành một số và trả về cho hàm gọi. Chúng ta sẽ sử dụng các hàm này trong một số chương trình ví dụ sau trong cuốn sách này.

**Liệt kê 8-1:** Các hàm chuyển đổi ID người dùng và nhóm thành tên và ngược lại

```

–––––––––––––––––––––––––––––––––––––––––––––– users_groups/ugid_functions.c

## include <pwd.h>

## include <grp.h>

## include <ctype.h>

## include "ugid_functions.h" /* Khai báo các hàm được định nghĩa ở đây */

char * /* Trả về tên tương ứng với 'uid', hoặc NULL khi lỗi */
userNameFromId(uid_t uid)
{
struct passwd *pwd;
pwd = getpwuid(uid);
return (pwd == NULL) ? NULL : pwd->pw_name;
}
uid_t /* Trả về UID tương ứng với 'name', hoặc -1 khi lỗi */
userIdFromName(const char *name)
{
struct passwd *pwd;
uid_t u;
char *endptr;

```

```

if (name == NULL || *name == '\0') /* Khi NULL hoặc chuỗi rỗng */
return -1; /* trả về lỗi */
u = strtol(name, &endptr, 10); /* Để thuận tiện cho hàm gọi */
if (*endptr == '\0') /* cho phép một chuỗi số */
return u;
pwd = getpwnam(name);
if (pwd == NULL)
return -1;
return pwd->pw_uid;
}
char * /* Trả về tên tương ứng với 'gid', hoặc NULL khi lỗi */
groupNameFromId(gid_t gid)
{
struct group *grp;
grp = getgrgid(gid);
return (grp == NULL) ? NULL : grp->gr_name;
}
gid_t /* Trả về GID tương ứng với 'name', hoặc -1 khi lỗi */
groupIdFromName(const char *name)
{
struct group *grp;
gid_t g;
char *endptr;
if (name == NULL || *name == '\0') /* Khi NULL hoặc chuỗi rỗng */
return -1; /* trả về lỗi */
g = strtol(name, &endptr, 10); /* Để thuận tiện cho hàm gọi */
if (*endptr == '\0') /* cho phép một chuỗi số */
return g;
grp = getgrnam(name);
if (grp == NULL)
return -1;
return grp->gr_gid;
}
–––––––––––––––––––––––––––––––––––––––––––––– users_groups/ugid_functions.c

```

### Quét toàn bộ bản ghi trong tệp mật khẩu và tệp nhóm

Các hàm `setpwent()`, `getpwent()`, và `endpwent()` được sử dụng để thực hiện quét tuần tự (sequential scan) các bản ghi trong tệp mật khẩu (password file).

```c

## include <pwd.h>

struct passwd *getpwent(void);
Trả về con trỏ khi thành công, hoặc NULL khi kết thúc luồng hoặc lỗi
void setpwent(void);
void endpwent(void);

```

Hàm `getpwent()` trả về các bản ghi từ tệp mật khẩu từng cái một, trả về `NULL` khi không còn bản ghi nào nữa (hoặc xảy ra lỗi). Ở lần gọi đầu tiên, `getpwent()` sẽ tự động mở tệp mật khẩu. Khi chúng ta làm việc xong với tệp, chúng ta gọi `endpwent()` để đóng tệp lại.

Chúng ta có thể duyệt qua toàn bộ tệp mật khẩu để in ra tên đăng nhập (login name) và ID người dùng (user ID) bằng đoạn mã sau:

```

struct passwd *pwd;
while ((pwd = getpwent()) != NULL)
printf("%-8s %5ld\n", pwd->pw_name, (long) pwd->pw_uid);
endpwent();

```

Việc gọi `endpwent()` là cần thiết để bất kỳ lệnh gọi `getpwent()` nào tiếp theo (có thể ở một phần khác trong chương trình của chúng ta hoặc trong một hàm thư viện nào đó mà chúng ta gọi) sẽ mở lại tệp mật khẩu và bắt đầu từ đầu. Mặt khác, nếu chúng ta đang ở giữa tệp, chúng ta có thể sử dụng hàm `setpwent()` để bắt đầu lại từ đầu.

Các hàm `getgrent()`, `setgrent()`, và `endgrent()` thực hiện các tác vụ tương tự đối với tệp nhóm (group file). Chúng tôi lược bỏ các nguyên mẫu (prototype) cho các hàm này vì chúng tương tự như các hàm của tệp mật khẩu (password file) đã mô tả ở trên; hãy xem các trang tài liệu hướng dẫn (manual pages) để biết chi tiết.

### Truy xuất các bản ghi từ tệp mật khẩu ẩn (shadow password file)

Các hàm sau đây được sử dụng để truy xuất các bản ghi riêng lẻ từ tệp mật khẩu ẩn (`shadow password file`) và để quét tất cả các bản ghi trong tệp đó.

```c

## include <shadow.h>

struct spwd *getspnam(const char *name);
Trả về con trỏ khi thành công, hoặc NULL khi không tìm thấy hoặc lỗi
struct spwd *getspent(void);
Trả về con trỏ khi thành công, hoặc NULL khi kết thúc luồng hoặc lỗi
void setspent(void);
void endspent(void);

```

Chúng tôi sẽ không mô tả chi tiết các hàm này, vì hoạt động của chúng tương tự như các hàm tệp mật khẩu tương ứng. (Các hàm này không được chỉ định trong SUSv3 và không có mặt trên tất cả các cài đặt UNIX).

Các hàm `getspnam()` và `getspent()` trả về con trỏ trỏ tới một cấu trúc (structure) kiểu `spwd`. Cấu trúc này có dạng sau:

```

struct spwd {
char *sp_namp; /* Tên đăng nhập (username) */
char *sp_pwdp; /* Mật khẩu đã mã hóa */
/* Các trường còn lại hỗ trợ "quá trình lão hóa mật khẩu" (password aging),
một tính năng tùy chọn buộc người dùng phải thường xuyên thay đổi
mật khẩu của họ, sao cho ngay cả khi kẻ tấn công lấy được
mật khẩu, thì cuối cùng nó cũng sẽ trở nên không thể sử dụng được. */
long sp_lstchg; /* Thời điểm thay đổi mật khẩu lần cuối
(số ngày kể từ ngày 1 tháng 1 năm 1970) */
long sp_min; /* Số ngày tối thiểu giữa các lần thay đổi mật khẩu */
long sp_max; /* Số ngày tối đa trước khi bắt buộc phải thay đổi */
long sp_warn; /* Số ngày trước đó mà người dùng được
cảnh báo về việc mật khẩu sắp hết hạn */
long sp_inact; /* Số ngày sau khi hết hạn mà tài khoản
được coi là không hoạt động (inactive) và bị khóa */
long sp_expire; /* Ngày tài khoản hết hạn
(số ngày kể từ ngày 1 tháng 1 năm 1970) */
unsigned long sp_flag; /* Dành riêng cho việc sử dụng trong tương lai */
};

```

Chúng tôi minh họa việc sử dụng `getspnam()` trong Liệt kê 8-2 (Listing 8-2).

## 8.5 Mã hóa Mật khẩu và Xác thực Người dùng (Password Encryption and User Authentication)

Một số ứng dụng yêu cầu người dùng tự xác thực (authenticate). Quá trình xác thực thường có dạng tên người dùng (tên đăng nhập) và mật khẩu. Một ứng dụng có thể duy trì cơ sở dữ liệu riêng về tên người dùng và mật khẩu cho mục đích này. Tuy nhiên, đôi khi việc cho phép người dùng nhập tên người dùng và mật khẩu tiêu chuẩn của họ như được định nghĩa trong `/etc/passwd` và `/etc/shadow` là cần thiết hoặc thuận tiện. (Đối với phần còn lại của mục này, chúng ta giả định một hệ thống đã bật tính năng mật khẩu ẩn - password shadowing, và do đó mật khẩu đã mã hóa được lưu trữ trong `/etc/shadow`.) Các ứng dụng mạng cung cấp một dạng đăng nhập nào đó vào hệ thống từ xa (remote system), chẳng hạn như `ssh` và `ftp`, là những ví dụ điển hình cho các chương trình như vậy. Các ứng dụng này phải xác thực (validate) tên người dùng và mật khẩu theo cùng cách mà chương trình đăng nhập tiêu chuẩn (standard login program) thực hiện.

Vì lý do bảo mật, các hệ thống UNIX mã hóa mật khẩu bằng thuật toán mã hóa một chiều (one-way encryption algorithm), có nghĩa là không có phương pháp nào để tạo lại mật khẩu ban đầu từ dạng mã hóa của nó. Do đó, cách duy nhất để xác thực một mật khẩu ứng viên (candidate password) là mã hóa nó bằng cùng phương pháp và xem kết quả mã hóa có khớp với giá trị được lưu trữ trong `/etc/shadow` hay không. Thuật toán mã hóa được đóng gói trong hàm `crypt()`.

```c

## define _XOPEN_SOURCE

## include <unistd.h>

char *crypt(const char *key, const char *salt);
Trả về con trỏ trỏ tới chuỗi được cấp phát tĩnh chứa
mật khẩu đã mã hóa nếu thành công, hoặc NULL nếu lỗi

```

Thuật toán `crypt()` nhận một khóa (`key`, tức là mật khẩu) dài tối đa 8 ký tự và áp dụng một biến thể của thuật toán Tiêu chuẩn Mã hóa Dữ liệu (Data Encryption Standard - DES) vào đó. Đối số `salt` là một chuỗi 2 ký tự có giá trị dùng để làm nhiễu (thay đổi) thuật toán, một kỹ thuật được thiết kế để làm cho việc bẻ khóa mật khẩu đã mã hóa trở nên khó khăn hơn. Hàm trả về một con trỏ trỏ tới một chuỗi 13 ký tự được cấp phát tĩnh chính là mật khẩu đã mã hóa.

> Chi tiết về DES có thể được tìm thấy tại http://www.itl.nist.gov/fipspubs/fip46-2.htm. Như đã lưu ý trước đó, các thuật toán khác có thể được sử dụng thay cho DES. Ví dụ, MD5 tạo ra một chuỗi 34 ký tự bắt đầu bằng ký hiệu đô la (\$), cho phép `crypt()` phân biệt mật khẩu được mã hóa theo chuẩn DES với mật khẩu được mã hóa theo chuẩn MD5.

> Trong phần thảo luận về mã hóa mật khẩu, chúng ta đang sử dụng từ "mã hóa" (encryption) theo một nghĩa tương đối rộng. Chính xác hơn, DES sử dụng chuỗi mật khẩu được cung cấp làm khóa mã hóa để mã hóa một chuỗi bit cố định, trong khi MD5 là một kiểu hàm băm (hashing function) phức tạp. Kết quả trong cả hai trường hợp đều giống nhau: một phép biến đổi không thể giải mã và không thể đảo ngược đối với mật khẩu đầu vào.

Cả đối số `salt` và mật khẩu đã mã hóa đều bao gồm các ký tự được chọn từ tập hợp 64 ký tự `[a-zA-Z0-9/.]`. Do đó, đối số `salt` gồm 2 ký tự có thể làm cho thuật toán mã hóa thay đổi theo bất kỳ cách nào trong số 64 \* 64 = 4096 cách khác nhau. Điều này có nghĩa là thay vì mã hóa trước toàn bộ từ điển và kiểm tra mật khẩu đã mã hóa với tất cả các từ trong từ điển, kẻ tấn công (cracker) sẽ cần phải kiểm tra mật khẩu với 4096 phiên bản mã hóa khác nhau của từ điển đó.

Mật khẩu được mã hóa do hàm `crypt()` trả về chứa một bản sao của giá trị muối (salt value) gốc nằm ở hai ký tự đầu tiên. Điều này có nghĩa là khi mã hóa một mật khẩu ứng viên (candidate password), chúng ta có thể lấy giá trị muối phù hợp từ chuỗi mật khẩu đã mã hóa hiện được lưu trữ trong `/etc/shadow`. (Các chương trình như `passwd(1)` sẽ tạo ra một giá trị muối ngẫu nhiên khi mã hóa một mật khẩu mới). Trên thực tế, hàm `crypt()` sẽ bỏ qua bất kỳ ký tự nào trong chuỗi muối vượt quá hai ký tự đầu tiên. Do đó, chúng ta có thể chỉ định chính mật khẩu đã mã hóa làm đối số muối (salt argument).

Để sử dụng `crypt()` trên Linux, chúng ta phải biên dịch các chương trình với tùy chọn `-lcrypt`, để chúng được liên kết (linked) với thư viện crypt.

### Chương trình ví dụ

Liệt kê 8-2 minh họa cách sử dụng `crypt()` để xác thực người dùng (authenticate a user). Chương trình này trước tiên đọc tên người dùng (username), sau đó truy xuất bản ghi mật khẩu tương ứng và (nếu tồn tại) bản ghi mật khẩu ẩn (shadow password record). Chương trình sẽ in ra thông báo lỗi và thoát nếu không tìm thấy bản ghi mật khẩu nào, hoặc nếu chương trình không có quyền đọc từ tệp mật khẩu ẩn (shadow password file) (việc này đòi hỏi đặc quyền siêu người dùng - superuser privilege hoặc phải là thành viên của nhóm shadow). Sau đó, chương trình đọc mật khẩu của người dùng bằng cách sử dụng hàm `getpass()`.

```c

## define _BSD_SOURCE

## include <unistd.h>

char *getpass(const char *prompt);
Trả về con trỏ tới chuỗi mật khẩu đầu vào được cấp phát tĩnh
khi thành công, hoặc NULL khi lỗi

```

Hàm `getpass()` trước tiên vô hiệu hóa việc hiển thị ký tự lặp lại trên màn hình (echoing) và mọi quá trình xử lý các ký tự đặc biệt của thiết bị đầu cuối (terminal special characters) (chẳng hạn như ký tự ngắt, thường là Control-C). (Chúng tôi giải thích cách thay đổi các thiết lập thiết bị đầu cuối này trong Chương 62). Sau đó, hàm in ra chuỗi trỏ tới bởi `prompt`, và đọc một dòng đầu vào, trả về chuỗi đầu vào kết thúc bằng ký tự null (null-terminated input string) với ký tự xuống dòng ở cuối bị loại bỏ, như là kết quả của hàm. (Chuỗi này được cấp phát tĩnh, do đó sẽ bị ghi đè trong lệnh gọi `getpass()` tiếp theo). Trước khi trả về, `getpass()` khôi phục các thiết lập thiết bị đầu cuối về trạng thái ban đầu của chúng.

Sau khi đọc mật khẩu bằng `getpass()`, chương trình trong Liệt kê 8-2 tiến hành xác thực mật khẩu đó bằng cách sử dụng `crypt()` để mã hóa nó và kiểm tra xem chuỗi kết quả có khớp với mật khẩu đã mã hóa được lưu trong tệp mật khẩu ẩn hay không. Nếu mật khẩu khớp, ID của người dùng sẽ được hiển thị, như trong ví dụ sau:

```bash

$ su Cần có đặc quyền để đọc tệp mật khẩu ẩn
Password:

## ./check_password

Username: mtk
Password: Chúng ta gõ mật khẩu, nội dung này không hiển thị trên màn hình
Successfully authenticated: UID=1000

```

Chương trình trong Liệt kê 8-2 định kích thước cho mảng ký tự chứa tên người dùng bằng cách sử dụng giá trị trả về bởi `sysconf(_SC_LOGIN_NAME_MAX)`, giá trị này trả về kích thước tối đa của một tên người dùng trên hệ thống sở tại. Chúng tôi giải thích cách sử dụng `sysconf()` trong [Mục 11.2](#page-62-0).

**Liệt kê 8-2:** Xác thực người dùng dựa trên tệp mật khẩu ẩn
REPLACE:

```

–––––––––––––––––––––––––––––––––––––––––––––– users_groups/check_password.c

## define _BSD_SOURCE /* Lấy khai báo getpass() từ <unistd.h> */

## define _XOPEN_SOURCE /* Lấy khai báo crypt() từ <unistd.h> */

## include <unistd.h>

## include <limits.h>

## include <pwd.h>

## include <shadow.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
char *username, *password, *encrypted, *p;
struct passwd *pwd;
struct spwd *spwd;
Boolean authOk;
size_t len;
long lnmax;

```

```

lnmax = sysconf(_SC_LOGIN_NAME_MAX);
if (lnmax == -1) /* Nếu giới hạn không xác định */
lnmax = 256; /* đưa ra một phỏng đoán */
username = malloc(lnmax);
if (username == NULL)
errExit("malloc");
printf("Username: ");
fflush(stdout);
if (fgets(username, lnmax, stdin) == NULL)
exit(EXIT_FAILURE); /* Thoát khi gặp EOF */
len = strlen(username);
if (username[len - 1] == '\n')
username[len - 1] = '\0'; /* Loại bỏ ký tự '\n' ở cuối */
pwd = getpwnam(username);
if (pwd == NULL)
fatal("không thể lấy bản ghi mật khẩu");
spwd = getspnam(username);
if (spwd == NULL && errno == EACCES)
fatal("không có quyền đọc tệp mật khẩu bóng tối");
if (spwd != NULL) /* Nếu có bản ghi mật khẩu bóng tối */
pwd->pw_passwd = spwd->sp_pwdp; /* Sử dụng mật khẩu bóng tối */
password = getpass("Password: ");
/* Mã hóa mật khẩu và xóa ngay phiên bản văn bản thuần túy (cleartext) */
encrypted = crypt(password, pwd->pw_passwd);
for (p = password; *p != '\0'; )
*p++ = '\0';
if (encrypted == NULL)
errExit("crypt");
authOk = strcmp(encrypted, pwd->pw_passwd) == 0;
if (!authOk) {
printf("Incorrect password\n");
exit(EXIT_FAILURE);
}
printf("Successfully authenticated: UID=%ld\n", (long) pwd->pw_uid);
/* Thực hiện các công việc sau khi xác thực... */
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––– users_groups/check_password.c

```

Liệt kê 8-2 minh họa một điểm bảo mật quan trọng. Các chương trình đọc mật khẩu nên ngay lập tức mã hóa mật khẩu đó và xóa phiên bản chưa mã hóa khỏi bộ nhớ (memory). Điều này giúp giảm thiểu khả năng chương trình bị treo (crash) tạo ra tệp kết xuất lõi (core dump file) mà tệp đó có thể bị đọc để phát hiện ra mật khẩu.

> Có những cách khác mà mật khẩu chưa mã hóa có thể bị lộ. Ví dụ, mật khẩu có thể bị đọc từ tệp swap (swap file) bởi một chương trình có đặc quyền (privileged program) nếu trang bộ nhớ ảo (virtual memory page) chứa mật khẩu đó bị đẩy ra bộ nhớ phụ (swapped out). Ngoài ra, một tiến trình (process) có đủ đặc quyền có thể đọc /dev/mem (một thiết bị ảo hiển thị bộ nhớ vật lý của máy tính dưới dạng một luồng byte tuần tự) nhằm mục đích tìm kiếm mật khẩu.

> Hàm getpass() xuất hiện trong SUSv2, trong đó đánh dấu nó là LEGACY (cũ), lưu ý rằng tên hàm dễ gây hiểu lầm và chức năng này vốn dĩ rất dễ tự triển khai. Đặc tả của getpass() đã bị loại bỏ trong SUSv3. Mặc dù vậy, nó vẫn hiện diện trên hầu hết các bản cài đặt UNIX.

## 8.6 Tóm tắt

Mỗi người dùng có một tên đăng nhập (login name) duy nhất và một định danh người dùng dạng số (numeric user ID) đi kèm. Người dùng có thể thuộc về một hoặc nhiều nhóm (groups), mỗi nhóm cũng có một tên duy nhất và một định danh dạng số đi kèm. Mục đích chính của các định danh này là thiết lập quyền sở hữu đối với các tài nguyên hệ thống khác nhau (ví dụ: các tệp) và quyền hạn để truy cập chúng.

Tên và ID của người dùng được xác định trong tệp /etc/passwd, tệp này cũng chứa các thông tin khác về người dùng. Tư cách thành viên nhóm của người dùng được xác định bởi các trường trong tệp /etc/passwd và /etc/group. Một tệp bổ sung là /etc/shadow, chỉ có thể được đọc bởi các tiến trình có đặc quyền (privileged processes), được sử dụng để tách biệt thông tin mật khẩu nhạy cảm khỏi thông tin người dùng có sẵn công khai trong /etc/passwd. Nhiều hàm thư viện khác nhau được cung cấp để truy xuất thông tin từ mỗi tệp này.

Hàm crypt() mã hóa mật khẩu theo cùng một cách với chương trình đăng nhập chuẩn (standard login program), rất hữu ích cho các chương trình cần xác thực người dùng (authenticate users).

## 8.7 Bài tập

**8-1.** Khi chúng ta thực thi đoạn mã sau, chúng ta thấy rằng nó hiển thị cùng một số hai lần, mặc dù hai người dùng có các ID khác nhau trong tệp mật khẩu. Tại sao lại như vậy?

```

printf("%ld %ld\n", (long) (getpwnam("avr")->pw_uid),
(long) (getpwnam("tsr")->pw_uid));

```

**8-2.** Hãy triển khai hàm getpwnam() bằng cách sử dụng setpwent(), getpwent(), và endpwent().
