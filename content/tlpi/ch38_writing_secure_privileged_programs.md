# Chương 38: VIẾT CHƯƠNG TRÌNH ĐẶC QUYỀN BẢO MẬT

Các chương trình đặc quyền (privileged programs) có quyền truy cập vào các tính năng và tài nguyên (tệp, thiết bị, v.v.) không khả dụng đối với người dùng thông thường. Một chương trình có thể chạy với đặc quyền thông qua hai phương thức chính:

- Chương trình được khởi chạy dưới một định danh người dùng đặc quyền (privileged user ID). Nhiều tiến trình nền (daemon) và máy chủ mạng (network server), thường chạy dưới quyền root, thuộc loại này.
- Chương trình được thiết lập bit phân quyền set-user-ID hoặc set-group-ID. Khi một chương trình set-user-ID (set-group-ID) được thực thi (exec), nó sẽ thay đổi định danh người dùng (nhóm) hiệu dụng (effective user/group ID) của tiến trình thành giống với chủ sở hữu (nhóm) của tệp chương trình. (Chúng ta lần đầu mô tả các chương trình set-user-ID và set-group-ID tại Mục 9.3). Trong chương này, thỉnh thoảng chúng ta sẽ sử dụng thuật ngữ set-user-ID-root để phân biệt một chương trình set-user-ID cấp quyền siêu người dùng (superuser) cho tiến trình với một chương trình cấp cho tiến trình một định danh hiệu dụng khác.

Nếu một chương trình đặc quyền chứa lỗi (bug), hoặc có thể bị lợi dụng bởi một kẻ tấn công độc hại (malicious user), thì tính bảo mật của hệ thống hoặc ứng dụng sẽ bị tổn hại. Từ góc độ bảo mật, chúng ta nên viết các chương trình sao cho giảm thiểu tối đa khả năng xảy ra sự cố xâm phạm cũng như mức độ thiệt hại có thể gây ra nếu sự cố thực sự xảy ra. Những chủ đề này là trọng tâm của chương này, nơi cung cấp tập hợp các thực hành được khuyến nghị cho lập trình bảo mật, đồng thời mô tả các cạm bẫy khác nhau cần tránh khi viết các chương trình đặc quyền.

## 38.1 Có Cần Thiết Phải Dùng Chương Trình Set-User-ID hoặc Set-Group-ID Không?

Một trong những lời khuyên hữu ích nhất liên quan đến các chương trình set-user-ID và set-group-ID là hãy tránh viết chúng bất cứ khi nào có thể. Nếu có một phương pháp thay thế để thực hiện một tác vụ mà không cần cấp đặc quyền cho chương trình, chúng ta nhìn chung nên áp dụng phương pháp thay thế đó, vì nó loại bỏ hoàn toàn khả năng bị xâm phạm bảo mật.

Đôi khi, chúng ta có thể cô lập chức năng cần đặc quyền thành một chương trình riêng biệt chỉ thực hiện một tác vụ duy nhất, và thực thi (exec) chương trình đó trong một tiến trình con (child process) khi cần thiết. Kỹ thuật này đặc biệt hữu ích đối với các thư viện (library). Một ví dụ về việc sử dụng như vậy là chương trình `pt_chown` được mô tả tại Mục 64.2.2.

Ngay cả trong các trường hợp cần dùng set-user-ID hoặc set-group-ID, chương trình set-user-ID không nhất thiết phải cấp thông tin xác thực (credential) gốc của root cho tiến trình. Nếu việc cấp một số thông tin xác thực khác là đủ, thì nên ưu tiên tùy chọn này, vì chạy với quyền root sẽ mở cửa cho các nguy cơ xâm phạm bảo mật tiềm ẩn.

Hãy xét một chương trình set-user-ID cần cho phép người dùng cập nhật một tệp mà họ không có quyền ghi (write permission). Một cách an toàn hơn để thực hiện việc này là tạo một tài khoản nhóm chuyên dụng (dedicated group ID) cho chương trình này, chuyển quyền sở hữu nhóm của tệp sang nhóm đó (và làm cho tệp có thể ghi bởi nhóm đó), sau đó viết một chương trình set-group-ID có chức năng thiết lập ID nhóm hiệu dụng (effective group ID) của tiến trình thành ID nhóm chuyên dụng đó. Vì ID nhóm chuyên dụng này không mang các đặc quyền nào khác, điều này giúp giới hạn đáng kể mức độ thiệt hại có thể xảy ra nếu chương trình chứa lỗi hoặc bị lợi dụng theo cách khác.

## 38.2 Vận Hành với Đặc Quyền Thấp Nhất (Least Privilege)

Một chương trình set-user-ID (hoặc set-group-ID) thông thường chỉ yêu cầu đặc quyền để thực hiện một số hoạt động nhất định. Khi chương trình (đặc biệt là chương trình giả định quyền siêu người dùng) đang thực hiện các công việc khác, nó nên vô hiệu hóa các đặc quyền này. Khi không còn cần đến đặc quyền nữa, chúng nên bị loại bỏ vĩnh viễn. Nói cách khác, chương trình phải luôn vận hành với đặc quyền thấp nhất cần thiết (least privilege) để hoàn thành các tác vụ mà nó đang thực hiện. Cơ chế lưu trữ set-user-ID (saved set-user-ID facility) được thiết kế chính cho mục đích này (Mục 9.4).

### Chỉ giữ đặc quyền khi thực sự cần thiết

Trong một chương trình set-user-ID, chúng ta có thể sử dụng chuỗi các lời gọi `seteuid()` sau đây để tạm thời hạ và sau đó lấy lại đặc quyền (privileges):

```
uid_t orig_euid;
orig_euid = geteuid();
if (seteuid(getuid()) == -1) /* Hạ đặc quyền */
 errExit("seteuid");
/* Thực hiện công việc không cần đặc quyền */
if (seteuid(orig_euid) == -1) /* Lấy lại đặc quyền */
 errExit("seteuid");
/* Thực hiện công việc cần đặc quyền */
```

Lời gọi đầu tiên làm cho ID người dùng hiệu dụng (effective user ID) của tiến trình gọi (calling process) giống với ID thực (real ID) của nó. Lời gọi thứ hai khôi phục ID người dùng hiệu dụng về giá trị được lưu trong saved set-user-ID.

Đối với các chương trình set-group-ID, saved set-group-ID lưu trữ ID nhóm hiệu dụng (effective group ID) ban đầu của chương trình và `setegid()` được sử dụng để hạ và lấy lại đặc quyền. Chúng tôi mô tả `seteuid()`, `setegid()`, và các System Call tương tự khác được đề cập trong các khuyến nghị sau đây tại Chương 9, đồng thời tóm tắt chúng trong Bảng 9-1 (trang 181).

Thực tiễn an toàn nhất là hạ đặc quyền ngay lập tức khi khởi động chương trình, sau đó tạm thời lấy lại chúng khi cần thiết tại các thời điểm sau trong chương trình. Nếu tại một thời điểm nào đó, các đặc quyền sẽ không bao giờ còn cần thiết nữa, thì chương trình nên hạ chúng một cách vĩnh viễn bằng cách đảm bảo rằng saved set-user-ID cũng được thay đổi. Điều này loại bỏ khả năng chương trình bị đánh lừa để lấy lại đặc quyền, có thể thông qua kỹ thuật stack-crashing được mô tả trong Mục [38.9.](#page-59-0)

### Hạ đặc quyền vĩnh viễn khi không bao giờ còn cần thiết nữa

Nếu một chương trình set-user-ID hoặc set-group-ID hoàn thành tất cả các tác vụ đòi hỏi đặc quyền, thì nó nên hạ đặc quyền của mình vĩnh viễn nhằm loại bỏ mọi rủi ro bảo mật có thể xảy ra do chương trình bị tổn hại bởi một lỗi (bug) hoặc hành vi bất ngờ khác. Việc hạ đặc quyền vĩnh viễn được thực hiện bằng cách thiết lập lại tất cả các ID người dùng (nhóm) của tiến trình (`process user (group) IDs`) về cùng giá trị với ID thực (real ID).

Từ một chương trình set-user-ID-root có ID người dùng hiệu dụng hiện tại là 0, chúng ta có thể thiết lập lại tất cả các ID người dùng bằng đoạn mã sau:

```
if (setuid(getuid()) == -1)
 errExit("setuid");
```

Tuy nhiên, đoạn mã trên không thiết lập lại saved set-user-ID nếu ID người dùng hiệu dụng của tiến trình gọi hiện tại khác 0: khi được gọi từ một chương trình có ID người dùng hiệu dụng khác 0, `setuid()` chỉ thay đổi ID người dùng hiệu dụng (Mục 9.7.1). Nói cách khác, trong một chương trình set-user-ID-root, chuỗi mã sau không làm mất vĩnh viễn ID người dùng 0:

```
/* Các UIDs ban đầu: real=1000 effective=0 saved=0 */
/* 1. Lời gọi thông thường để tạm thời hạ đặc quyền */
orig_euid = geteuid();
if (seteuid(getuid() == -1)
 errExit("seteuid");
/* Các UIDs đã thay đổi thành: real=1000 effective=1000 saved=0 */
/* 2. Trông có vẻ là cách đúng để hạ vĩnh viễn đặc quyền (SAI!) */
if (setuid(getuid() == -1)
 errExit("setuid");
/* Các UIDs không đổi: real=1000 effective=1000 saved=0 */
```

Thay vào đó, chúng ta phải lấy lại đặc quyền trước khi hạ nó vĩnh viễn, bằng cách chèn lời gọi sau giữa bước 1 và bước 2 ở trên:

```
if (seteuid(orig_euid) == -1)
 errExit("seteuid");
```

Mặt khác, nếu chúng ta có một chương trình set-user-ID thuộc sở hữu của một người dùng khác không phải root, thì vì `setuid()` là không đủ để thay đổi định danh set-user-ID, chúng ta phải sử dụng `setreuid()` hoặc `setresuid()` để hạ vĩnh viễn định danh đặc quyền đó. Ví dụ, chúng ta có thể đạt được kết quả mong muốn bằng cách sử dụng `setreuid()` như sau:

```
if (setreuid(getuid(), getuid()) == -1)
 errExit("setreuid");
```

Đoạn mã này dựa vào một tính năng trong cài đặt Linux của `setreuid()`: nếu đối số đầu tiên (`ruid`) không phải là –1, thì saved set-user-ID cũng được đặt thành cùng giá trị với ID người dùng hiệu dụng (mới). SUSv3 không quy định tính năng này, nhưng nhiều hệ thống cài đặt khác hoạt động tương tự như Linux.

System Call `setregid()` hoặc `setresgid()` cũng phải được sử dụng tương tự để hạ vĩnh viễn ID nhóm đặc quyền trong một chương trình set-group-ID, bởi vì khi ID người dùng hiệu dụng của chương trình khác 0, `setgid()` chỉ thay đổi ID nhóm hiệu dụng của tiến trình gọi.

### Các điểm chung về việc thay đổi thông tin xác thực tiến trình (process credentials)

Trong các trang trước, chúng tôi đã mô tả các kỹ thuật để tạm thời và vĩnh viễn hạ đặc quyền. Bây giờ chúng tôi bổ sung một số điểm chung liên quan đến việc sử dụng các kỹ thuật này:

- Ngữ nghĩa (semantics) của một số System Call làm thay đổi thông tin xác thực tiến trình có sự khác nhau giữa các hệ thống. Hơn nữa, ngữ nghĩa của một số System Call này thay đổi tùy thuộc vào việc người gọi có đặc quyền hay không (ID người dùng hiệu dụng bằng 0). Để biết chi tiết, hãy xem Chương 9, đặc biệt là Mục 9.7.4. Do những biến thể này, [Tsafrir et al., 2008] khuyến nghị rằng các ứng dụng nên sử dụng các System Call phi tiêu chuẩn đặc thù của hệ thống để thay đổi thông tin xác thực tiến trình, bởi vì trong nhiều trường hợp, các System Call phi tiêu chuẩn này cung cấp ngữ nghĩa đơn giản và nhất quán hơn so với các tương đương tiêu chuẩn của chúng. Trên Linux, điều này đồng nghĩa với việc sử dụng `setresuid()` và `setresgid()` để thay đổi thông tin xác thực người dùng và nhóm. Mặc dù các System Call này không có mặt trên tất cả các hệ thống, việc sử dụng chúng có thể ít gặp lỗi hơn. ([Tsafrir et al., 2008] đề xuất một thư viện các hàm thực hiện thay đổi thông tin xác thực bằng cách sử dụng những gì họ cho là giao diện tốt nhất có sẵn trên mỗi nền tảng.)

- Trên Linux, ngay cả khi tiến trình gọi (caller) có effective user ID là 0, các system call (lời gọi hệ thống) dùng để thay đổi định danh (credential) có thể không hoạt động như mong đợi nếu chương trình đã chủ động thao túng các capability của nó. Ví dụ, nếu capability `CAP_SETUID` bị vô hiệu hóa, thì các nỗ lực thay đổi user ID của Process (tiến trình) sẽ thất bại hoặc tồi tệ hơn là chỉ âm thầm thay đổi một phần các user ID được yêu cầu.

- Do các khả năng được liệt kê trong hai mục trước, thực tiễn được khuyến nghị cao (ví dụ: xem [Tsafrir et al., 2008]) là không chỉ kiểm tra xem một system call thay đổi credential có thành công hay không, mà còn phải xác minh rằng sự thay đổi đó đã diễn ra đúng như mong đợi. Ví dụ, nếu chúng ta đang tạm thời từ bỏ hoặc khôi phục một privileged user ID (user ID có đặc quyền) bằng cách sử dụng `seteuid()`, thì chúng ta nên theo sau lời gọi đó bằng một lời gọi `geteuid()` để xác minh rằng effective user ID đúng như những gì chúng ta mong đợi. Tương tự, nếu chúng ta đang từ bỏ vĩnh viễn một privileged user ID, thì chúng ta phải xác minh rằng real user ID, effective user ID và saved set-user-ID đều đã được thay đổi thành công thành unprivileged user ID (user ID không có đặc quyền). Thật không may, mặc dù có các system call tiêu chuẩn để truy xuất real ID và effective ID, nhưng lại không có system call tiêu chuẩn nào để truy xuất saved set ID. Linux và một số ít hệ thống khác cung cấp `getresuid()` và `getresgid()` cho mục đích này; trên một số hệ thống khác, chúng ta có thể cần phải áp dụng các kỹ thuật như phân tích cú pháp thông tin trong các tệp `/proc`.
- Một số thay đổi về credential chỉ có thể được thực hiện bởi các tiến trình có effective user ID là 0. Do đó, khi thay đổi nhiều ID — supplementary group ID (ID nhóm bổ sung), group ID và user ID — chúng ta nên từ bỏ privileged effective user ID cuối cùng khi hạ quyền. Ngược lại, chúng ta nên nâng privileged effective user ID đầu tiên khi cấp quyền.

## 38.3 Thận Trọng Khi Thực Thi Một Chương Trình

Cần phải thận trọng khi một chương trình có đặc quyền thực thi một chương trình khác, hoặc trực tiếp thông qua hàm `exec()`, hoặc gián tiếp thông qua `system()`, `popen()` hoặc một hàm thư viện tương tự.

### Từ bỏ đặc quyền vĩnh viễn trước khi thực thi (exec) một chương trình khác

Nếu một chương trình set-user-ID (hoặc set-group-ID) thực thi một chương trình khác, thì chương trình đó phải đảm bảo rằng tất cả các user ID (group ID) của tiến trình được đặt lại về cùng một giá trị với real user (group) ID, sao cho chương trình mới không khởi động với các đặc quyền và cũng không thể lấy lại chúng. Một cách để làm điều này là đặt lại tất cả các ID trước khi thực hiện `exec()`, bằng cách sử dụng các kỹ thuật được mô tả trong Mục [38.2](#page-51-0).

Kết quả tương tự có thể đạt được bằng cách đặt lệnh gọi `setuid(getuid())` ngay trước `exec()`. Mặc dù lệnh gọi `setuid()` này chỉ thay đổi effective user ID trong một tiến trình có effective user ID khác không, nhưng các đặc quyền vẫn bị loại bỏ bởi vì (như được mô tả trong Mục 9.4) một lệnh gọi `exec()` thành công sẽ tiếp tục sao chép effective user ID sang saved set-user-ID. (Nếu `exec()` thất bại, thì saved set-user-ID được giữ nguyên không thay đổi. Điều này có thể hữu ích nếu chương trình sau đó cần thực hiện các công việc có đặc quyền khác do `exec()` đã thất bại.)

Một phương pháp tương tự (`setgid(getgid())`) có thể được sử dụng với các chương trình set-group-ID, vì một lệnh gọi `exec()` thành công cũng sao chép effective group ID sang saved set-group-ID.

Ví dụ, giả sử chúng ta có một chương trình set-user-ID thuộc sở hữu của user ID 200. Khi chương trình này được thực thi bởi một người dùng có ID là 1000, các user ID của tiến trình kết quả sẽ như sau:

real=1000 effective=200 saved=200

Nếu chương trình này sau đó thực thi lời gọi `setuid(getuid())`, thì các user ID của tiến trình sẽ được thay đổi thành:

real=1000 effective=1000 saved=200

Khi tiến trình thực thi một chương trình không có đặc quyền, effective user ID của tiến trình được sao chép vào saved set-user-ID, dẫn đến tập hợp các user ID của tiến trình như sau:

real=1000 effective=1000 saved=1000

### Tránh thực thi Shell (hoặc trình thông dịch khác) với đặc quyền

Các chương trình có đặc quyền chạy dưới sự kiểm soát của người dùng không bao giờ được `exec` một shell, dù là trực tiếp hay gián tiếp (thông qua `system()`, `popen()`, `execlp()`, `execvp()` hoặc các hàm thư viện tương tự khác). Sự phức tạp và mạnh mẽ của các shell (và các trình thông dịch không bị ràng buộc khác như `awk`) đồng nghĩa với việc hầu như không thể loại bỏ tất cả các lỗ hổng bảo mật, ngay cả khi shell được thực thi không cho phép truy cập tương tác. Rủi ro hệ quả là người dùng có thể thực thi các câu lệnh shell tùy ý dưới effective user ID của tiến trình. Nếu bắt buộc phải `exec` một shell, hãy đảm bảo rằng các đặc quyền đã được từ bỏ vĩnh viễn trước đó.

> Một ví dụ về loại lỗ hổng bảo mật có thể xảy ra khi `exec` một shell đã được lưu ý trong phần thảo luận về `system()` ở Mục 27.6.

Một số cài đặt UNIX tôn trọng các bit quyền set-user-ID và set-group-ID khi chúng được áp dụng cho các tập lệnh trình thông dịch (interpreter script) (Mục 27.3), do đó, khi tập lệnh được chạy, tiến trình thực thi tập lệnh đó sẽ mang danh tính của một người dùng (có đặc quyền) khác. Do những rủi ro bảo mật vừa được mô tả, Linux, cũng như một số hệ thống UNIX khác, sẽ âm thầm bỏ qua các bit quyền set-user-ID và set-group-ID khi thực thi (`exec`) một tập lệnh. Ngay cả trên các hệ thống mà tập lệnh set-user-ID và set-group-ID được cho phép, việc sử dụng chúng vẫn nên được tránh.

### Đóng tất cả các file descriptor không cần thiết trước một lời gọi exec()

Trong Mục 27.4, chúng ta đã lưu ý rằng, theo mặc định, các file descriptor vẫn duy trì trạng thái mở sau một lời gọi `exec()`. Một chương trình đặc quyền (privileged program) có thể mở một tệp mà các tiến trình (process) thông thường không thể truy cập. File descriptor mở kết quả đại diện cho một tài nguyên đặc quyền. File descriptor này nên được đóng lại trước một lời gọi `exec()`, để chương trình được thực thi qua `exec` không thể truy cập vào tệp liên quan. Chúng ta có thể thực hiện việc này bằng cách đóng tường minh file descriptor đó hoặc bằng cách thiết lập cờ close-on-exec của nó (Mục 27.4).

## 38.4 Tránh làm lộ thông tin nhạy cảm

Khi một chương trình đọc mật khẩu hoặc các thông tin nhạy cảm khác, nó nên thực hiện mọi quá trình xử lý cần thiết, và sau đó ngay lập tức xóa thông tin đó khỏi bộ nhớ (memory). (Chúng ta đưa ra một ví dụ về điều này trong Mục 8.5). Việc để lại thông tin như vậy trong bộ nhớ là một rủi ro bảo mật, vì những lý do sau:

Trang bộ nhớ ảo (virtual memory page) chứa dữ liệu có thể bị hoán đổi ra ngoài (swapped out) (trừ khi nó được khóa trong bộ nhớ bằng cách sử dụng `mlock()` hoặc hàm tương tự), và sau đó có thể bị đọc từ vùng không gian swap bởi một chương trình đặc quyền.

Nếu tiến trình nhận được một tín hiệu (signal) khiến nó tạo ra tệp kết xuất lõi (core dump file), thì tệp đó có thể bị đọc để lấy thông tin.

Tiếp theo ý cuối cùng, như một nguyên tắc chung, một chương trình bảo mật nên ngăn chặn các tệp core dump, sao cho tệp core dump không thể bị kiểm tra để lấy thông tin nhạy cảm. Một chương trình có thể đảm bảo rằng tệp core dump không được tạo ra bằng cách sử dụng `setrlimit()` để đặt giới hạn tài nguyên `RLIMIT_CORE` thành 0 (xem Mục [36.3](#page-27-0)).

> Theo mặc định, Linux không cho phép một chương trình set-user-ID thực hiện kết xuất lõi (core dump) để phản hồi lại một tín hiệu (Mục 22.1), ngay cả khi chương trình đã từ bỏ tất cả các đặc quyền. Tuy nhiên, các cài đặt UNIX khác có thể không cung cấp tính năng bảo mật này.

## 38.5 Giới hạn tiến trình (Confine the Process)

Trong phần này, chúng ta xem xét các cách thức mà qua đó chúng ta có thể giới hạn (confine) một chương trình nhằm giảm thiểu thiệt hại xảy ra nếu chương trình bị xâm phạm (compromised).

### Cân nhắc sử dụng các capability

Mơ hình capability của Linux chia mô hình đặc quyền UNIX truyền thống dạng "tất cả hoặc không có gì" (all-or-nothing) thành các đơn vị riêng biệt gọi là các capability. Một tiến trình có thể bật hoặc tắt một cách độc lập các capability riêng lẻ. Bằng cách chỉ bật những capability mà nó cần, một chương trình hoạt động với ít đặc quyền hơn so với khi chạy với đầy đủ đặc quyền root. Điều này làm giảm khả năng gây thiệt hại nếu chương trình bị xâm phạm.

Hơn nữa, bằng cách sử dụng các capability và các cờ securebits, chúng ta có thể tạo ra một tiến trình có một tập hợp các capability bị giới hạn nhưng không thuộc sở hữu của root (tức là tất cả các ID người dùng của nó đều khác không). Một tiến trình như vậy không thể sử dụng `exec()` để lấy lại toàn bộ tập hợp capability nữa. Chúng ta mô tả các capability và các cờ securebits trong Chương [39](#page-64-0).

### Cân nhắc sử dụng chroot jail

Một kỹ thuật bảo mật hữu ích trong một số trường hợp là thiết lập một `chroot jail` (vùng cô lập chroot) nhằm giới hạn tập hợp các thư mục và tệp mà một chương trình có thể truy cập. (Hãy đảm bảo cũng gọi `chdir()` để thay đổi thư mục làm việc hiện tại của tiến trình (`current working directory`) thành một vị trí bên trong vùng cô lập này). Tuy nhiên, cần lưu ý rằng một `chroot jail` là chưa đủ để giới hạn một chương trình `set-user-ID-root` (xem Mục 18.12).

> Một giải pháp thay thế cho việc sử dụng `chroot jail` là máy chủ ảo (virtual server), là một máy chủ được triển khai trên nền tảng của một nhân ảo (virtual kernel). Do mỗi nhân ảo được cô lập với các nhân ảo khác có thể đang chạy trên cùng phần cứng, máy chủ ảo mang lại tính bảo mật và linh hoạt cao hơn so với `chroot jail`. (Một số hệ điều hành hiện đại khác cũng cung cấp các phiên bản triển khai máy chủ ảo của riêng chúng). Bản triển khai ảo hóa cũ nhất trên Linux là User-Mode Linux (UML), vốn là một thành phần tiêu chuẩn của nhân Linux 2.6. Thông tin thêm về UML có thể được tìm thấy tại http://user-mode-linux.sourceforge.net/. Các dự án nhân ảo gần đây hơn bao gồm Xen (http://www.cl.cam.ac.uk/Research/SRG/ netos/xen/) và KVM (http://kvm.qumranet.com/).

## 38.6 Đề phòng Tín hiệu và Tình trạng tranh chấp (Race Conditions)

Một người dùng có thể gửi các tín hiệu (`signal`) tùy ý tới một chương trình `set-user-ID` mà họ đã khởi động. Các tín hiệu như vậy có thể đến bất cứ lúc nào và với bất kỳ tần suất nào. Chúng ta cần xem xét các tình trạng tranh chấp (`race conditions`) có thể xảy ra nếu một tín hiệu được chuyển đến (`delivered`) tại bất kỳ thời điểm nào trong quá trình thực thi chương trình. Khi thích hợp, các tín hiệu nên được bắt (`caught`), chặn (`blocked`), hoặc bỏ qua (`ignored`) để ngăn ngừa các vấn đề bảo mật tiềm ẩn. Hơn nữa, thiết kế của các trình xử lý tín hiệu (`signal handlers`) phải càng đơn giản càng tốt, nhằm giảm thiểu rủi ro vô tình tạo ra một tình trạng tranh chấp.

Vấn đề này đặc biệt quan trọng đối với các tín hiệu làm dừng một tiến trình (ví dụ: `SIGTSTP` và `SIGSTOP`). Kịch bản gây ra vấn đề như sau:

- 1. Một chương trình `set-user-ID` xác định một số thông tin về môi trường chạy thời gian thực (`run-time environment`) của nó.
- 2. Người dùng thành công dừng tiến trình đang chạy chương trình và thay đổi các chi tiết của môi trường chạy thời gian thực. Những thay đổi này có thể bao gồm việc sửa đổi quyền hạn trên một tệp, thay đổi đích đến của một liên kết tượng trưng (`symbolic link`), hoặc xóa một tệp mà chương trình phụ thuộc vào.
- 3. Người dùng tiếp tục tiến trình bằng tín hiệu `SIGCONT`. Tại thời điểm này, chương trình sẽ tiếp tục thực thi dựa trên các giả định hiện đã sai lệch về môi trường chạy thời gian thực của nó, và những giả định này có thể dẫn đến một lỗ hổng bảo mật.

Tình huống được mô tả ở đây thực chất chỉ là một trường hợp đặc biệt của tình trạng tranh chấp dạng thời điểm kiểm tra, thời điểm sử dụng (`time-of-check, time-of-use race condition`). Một tiến trình đặc quyền (`privileged process`) nên tránh thực hiện các thao tác dựa trên các lần xác minh trước đó mà có thể không còn đúng nữa (tham khảo thảo luận về system call `access()` trong Mục 15.4.4 để biết một ví dụ cụ thể). Nguyên tắc này được áp dụng ngay cả khi người dùng không thể gửi tín hiệu đến tiến trình. Khả năng dừng một tiến trình đơn giản là cho phép người dùng nới rộng khoảng thời gian giữa thời điểm kiểm tra và thời điểm sử dụng.

> Mặc dù có thể khó khăn trong một lần thử duy nhất để dừng một tiến trình nằm giữa khoảng thời gian kiểm tra và thời gian sử dụng, một kẻ tấn công độc hại có thể thực thi một chương trình `set-user-ID` lặp đi lặp lại, và sử dụng một chương trình khác hoặc một shell script để liên tục gửi tín hiệu dừng tới chương trình `set-user-ID` đó đồng thời thay đổi môi trường chạy thời gian thực. Điều này làm tăng đáng kể cơ hội lật đổ chương trình `set-user-ID`.

## 38.7 Những cạm bẫy khi thực hiện các thao tác trên tệp và File I/O

Nếu một tiến trình đặc quyền cần tạo một tệp, thì chúng ta phải cẩn thận về quyền sở hữu (`ownership`) và quyền hạn (`permissions`) của tệp đó để đảm bảo rằng không bao giờ có thời điểm nào, dù là ngắn ngủi nhất, mà tệp đó dễ bị thao túng bởi mã độc. Các nguyên tắc sau đây được áp dụng:

- Giá trị umask của tiến trình (Mục 15.4.6) phải được thiết lập ở mức đảm bảo rằng tiến trình không bao giờ tạo ra các tệp có quyền ghi công khai (`publicly writable files`), vì chúng có thể bị sửa đổi bởi một người dùng độc hại.
- Vì quyền sở hữu của một tệp được lấy từ hiệu dụng `user ID` (effective user ID) của tiến trình đang tạo ra nó, nên việc sử dụng hợp lý `seteuid()` hoặc `setreuid()` để thay đổi tạm thời thông tin định danh (`credentials`) của tiến trình có thể là cần thiết nhằm đảm bảo rằng tệp mới được tạo không thuộc về sai người dùng. Vì quyền sở hữu nhóm (`group ownership`) của tệp có thể được lấy từ hiệu dụng `group ID` của tiến trình (xem Mục 15.3.1), một tuyên bố tương tự cũng áp dụng đối với các chương trình `set-group-ID`, và các hàm `group ID` tương ứng có thể được sử dụng để tránh các vấn đề như vậy. (Nói một cách chính xác hoàn toàn, trên Linux, chủ sở hữu của một tệp mới được xác định bởi `file-system user ID` của tiến trình, thông thường có giá trị giống như `effective user ID` của tiến trình; hãy tham khảo Mục 9.5).

- Nếu một chương trình `set-user-ID-root` phải tạo một tệp mà ban đầu nó phải làm chủ, nhưng sau đó sẽ thuộc sở hữu của một người dùng khác, tệp đó phải được tạo sao cho ban đầu không cho phép các người dùng khác ghi vào, bằng cách sử dụng một đối số `mode` phù hợp cho hàm `open()` hoặc bằng cách thiết lập `umask` của tiến trình trước khi gọi `open()`. Sau đó, chương trình có thể thay đổi quyền sở hữu của nó bằng `fchown()`, và rồi thay đổi quyền hạn của nó, nếu cần thiết, bằng `fchmod()`. Điểm mấu chốt là một chương trình `set-user-ID` phải đảm bảo rằng nó không bao giờ tạo ra một tệp thuộc sở hữu của chủ sở hữu chương trình mà thậm chí chỉ trong khoảnh khắc lại cho phép người dùng khác ghi vào.

- Các bước kiểm tra thuộc tính tệp (file attribute) nên được thực hiện trên các bộ mô tả tệp (File Descriptor) đã mở (ví dụ: `open()` sau đó là `fstat()`), thay vì kiểm tra các thuộc tính liên quan đến đường dẫn (pathname) rồi mới mở tệp (ví dụ: `stat()` sau đó là `open()`). Phương pháp sau tạo ra một lỗ hổng dạng "thời điểm sử dụng so với thời điểm kiểm tra" (time-of-use, time-of-check - TOCTOU problem).
- Nếu một chương trình bắt buộc phải đảm bảo nó là bên tạo ra tệp, thì cờ `O_EXCL` nên được sử dụng khi gọi hàm `open()`.
- Một chương trình có đặc quyền (privileged program) nên tránh việc tạo ra hoặc phụ thuộc vào các tệp nằm trong các thư mục mà mọi người đều có quyền ghi (publicly writable directories) như `/tmp`, vì điều này khiến chương trình dễ bị tổn thương trước các cuộc tấn công độc hại nhằm tạo ra các tệp trái phép mang tên mà chương trình có đặc quyền đang mong đợi. Một chương trình bắt buộc phải tạo tệp trong thư mục công cộng này ít nhất phải đảm bảo rằng tệp đó có tên không thể đoán trước, bằng cách sử dụng một hàm như `mkstemp()` (Mục 5.12).

## 38.8 Không Tin Tưởng Đầu Vào Hoặc Môi Trường

Các chương trình có đặc quyền (privileged program) nên tránh đưa ra các giả định về dữ liệu đầu vào mà chúng nhận được, hoặc môi trường mà chúng đang chạy.

### Không tin tưởng danh sách biến môi trường

Các chương trình set-user-ID và set-group-ID không nên cho rằng giá trị của các biến môi trường (environment variable) là đáng tin cậy. Hai biến có tính liên quan đặc biệt là `PATH` và `IFS`.

`PATH` xác định nơi shell (và do đó bao gồm cả `system()` và `popen()`), cũng như `execlp()` và `execvp()`, tìm kiếm các chương trình. Một người dùng độc hại có thể đặt `PATH` thành một giá trị nhằm đánh lừa một chương trình set-user-ID sử dụng một trong các hàm này để thực thi một chương trình tùy ý với quyền hạn cao. Nếu các hàm này bắt buộc phải được sử dụng, `PATH` nên được thiết lập thành một danh sách thư mục đáng tin cậy (nhưng tốt hơn hết là nên chỉ định đường dẫn tuyệt vời (absolute pathname) khi thực thi các chương trình qua họ hàm `exec`). Tuy nhiên, như đã lưu ý trước đó, cách tốt nhất là từ bỏ đặc quyền (drop privileges) trước khi thực thi một shell hoặc sử dụng một trong các hàm đã nêu ở trên.

`IFS` chỉ định các ký tự phân tách mà shell hiểu là dùng để tách các từ trong một dòng lệnh. Biến này nên được thiết lập thành một chuỗi rỗng, điều này có nghĩa là chỉ các ký tự khoảng trắng (white-space characters) mới được shell hiểu là ký tự phân tách từ. Một số shell luôn thiết lập `IFS` theo cách này khi khởi động. (Mục 27.6 mô tả một lỗ hổng liên quan đến `IFS` từng xuất hiện trong các phiên bản Bourne shell cũ).

Trong một số trường hợp, cách an toàn nhất là xóa sạch toàn bộ danh sách biến môi trường (Mục 6.7), sau đó khôi phục các biến môi trường đã chọn bằng các giá trị được biết là an toàn, đặc biệt là khi thực thi các chương trình khác hoặc gọi các thư viện có thể bị ảnh hưởng bởi cài đặt biến môi trường.

### Xử lý đầu vào từ người dùng không đáng tin cậy một cách phòng thủ

Một chương trình đặc quyền (privileged program) cần phải xác thực (validate) cẩn thận tất cả các đầu vào từ các nguồn không đáng tin cậy trước khi thực hiện hành động dựa trên các đầu vào đó. Quá trình xác thực này có thể bao gồm việc kiểm tra xem các con số có nằm trong giới hạn cho phép hay không, và các chuỗi ký tự có độ dài hợp lệ cũng như bao gồm các ký tự hợp lệ hay không. Trong số các đầu vào cần được xác thực theo cách này bao gồm các đầu vào đến từ tệp do người dùng tạo, tham số dòng lệnh (command-line argument), đầu vào tương tác, đầu vào CGI, thông điệp email, biến môi trường (environment variable), các kênh giao tiếp liên tiến trình (interprocess communication channel - như FIFO, bộ nhớ chia sẻ - shared memory, v.v.) mà người dùng không đáng tin cậy có thể truy cập được, và các gói tin mạng (network packet).

### Tránh các giả định không đáng tin cậy về môi trường chạy của tiến trình

Một chương trình set-user-ID nên tránh đưa ra các giả định không đáng tin cậy về môi trường chạy ban đầu của nó. Ví dụ, đầu vào chuẩn (standard input), đầu ra chuẩn (standard output), hoặc lỗi chuẩn (standard error) có thể đã bị đóng. (Các mô tả tệp - file descriptor này có thể đã bị đóng trong chương trình thực thi - exec chương trình set-user-ID). Trong trường hợp này, việc mở một tệp có thể vô tình tái sử dụng mô tả tệp 1 (chẳng hạn), do đó, trong khi chương trình nghĩ rằng nó đang ghi ra đầu ra chuẩn, thì thực tế nó lại đang ghi vào tệp mà nó vừa mở.

Có nhiều khả năng khác cần xem xét. Ví dụ, một tiến trình có thể làm cạn kiệt các giới hạn tài nguyên khác nhau, chẳng hạn như giới hạn về số lượng tiến trình có thể được tạo, giới hạn tài nguyên thời gian CPU, hoặc giới hạn tài nguyên kích thước tệp, dẫn đến việc các lời hệ thống (system call) khác nhau có thể thất bại hoặc các tín hiệu (signal) khác nhau có thể được tạo ra. Người dùng độc hại có thể cố tình thiết kế tình trạng cạn kiệt tài nguyên nhằm mục đích phá hoại chương trình.

## 38.9 Đề phòng Tràn bộ nhớ đệm (Buffer Overrun)

Hãy đề phòng việc tràn bộ nhớ đệm (buffer overrun / overflow), xảy ra khi một giá trị đầu vào hoặc chuỗi ký tự được sao chép vượt quá không gian bộ nhớ đệm đã được cấp phát. Không bao giờ sử dụng `gets()`, và hãy thận trọng khi dùng các hàm như `scanf()`, `sprintf()`, `strcpy()`, và `strcat()` (ví dụ: bảo vệ việc sử dụng chúng bằng các câu lệnh `if` để ngăn chặn tình trạng tràn bộ nhớ đệm).

Tràn bộ nhớ đệm cho phép các kỹ thuật như làm sập ngăn xếp (stack crashing, còn được gọi là stack smashing), trong đó người dùng độc hại tận dụng việc tràn bộ nhớ đệm để đặt các byte mã hóa cẩn thận vào một khung ngăn xếp (stack frame) nhằm buộc chương trình đặc quyền thực thi mã tùy ý (arbitrary code). (Một số nguồn trực tuyến giải thích chi tiết về kỹ thuật làm sập ngăn xếp; xem thêm [Erickson, 2008] và [Anley, 2007]). Tràn bộ nhớ đệm có lẽ là nguồn gốc phổ biến nhất gây ra các lỗ hổng bảo mật trên hệ thống máy tính, điều này được minh chứng bằng tần suất các bản cảnh báo được đăng tải bởi CERT (http://www.cert.org/) và lên Bugtraq (http://www.securityfocus.com/). Tràn bộ nhớ đệm đặc biệt nguy hiểm trong các máy chủ mạng (network server), vì chúng khiến hệ thống dễ bị tấn công từ xa từ bất kỳ đâu trên mạng. Để làm cho việc làm sập ngăn xếp trở nên khó khăn hơn — cụ thể là làm cho các cuộc tấn công đó tiêu tốn nhiều thời gian hơn khi thực hiện từ xa nhắm vào các máy chủ mạng — bắt đầu từ phiên bản kernel 2.6.12, Linux đã triển khai tính năng ngẫu nhiên hóa không gian địa chỉ (address-space randomization). Kỹ thuật này làm thay đổi ngẫu nhiên vị trí của ngăn xếp (stack) trên dải 8 MB ở phía trên cùng của bộ nhớ ảo (virtual memory). Ngoài ra, vị trí của các vùng ánh xạ bộ nhớ (memory mapping) cũng có thể được ngẫu nhiên hóa, nếu giới hạn mềm `RLIMIT_STACK` không phải là vô hạn và tệp `/proc/sys/vm/legacy_va_layout` đặc thù của Linux chứa giá trị 0.

Các kiến trúc x86-32 gần đây hơn cung cấp hỗ trợ phần cứng để đánh dấu các bảng trang (page table) là NX ("no execute" - không thực thi). Tính năng này được sử dụng để ngăn chặn việc thực thi mã chương trình trên ngăn xếp, từ đó làm cho việc làm sập ngăn xếp trở nên khó khăn hơn.

Có các giải pháp thay thế an toàn cho nhiều hàm được đề cập ở trên — ví dụ như `snprintf()`, `strncpy()`, và `strncat()` — cho phép người gọi chỉ định số lượng ký tự tối đa nên được sao chép. Các hàm này tính đến mức tối đa được chỉ định để tránh làm tràn bộ nhớ đệm đích. Nhìn chung, các giải pháp thay thế này được ưu tiên hơn, nhưng vẫn phải được xử lý cẩn thận. Cụ thể, cần lưu ý các điểm sau:

- Với hầu hết các hàm này, nếu đạt đến mức tối đa được chỉ định, một phiên bản bị cắt ngắn (truncated) của chuỗi nguồn sẽ được đặt vào bộ nhớ đệm đích. Vì một chuỗi bị cắt ngắn như vậy có thể vô nghĩa về mặt ngữ nghĩa của chương trình, người gọi phải kiểm tra xem việc cắt ngắn có xảy ra hay không (ví dụ: sử dụng giá trị trả về từ `snprintf()`), và thực hiện hành động thích hợp nếu có.
- Việc sử dụng `strncpy()` có thể gây ảnh hưởng đến hiệu năng. Nếu trong lời gọi `strncpy(s1, s2, n)`, chuỗi được trỏ tới bởi `s2` có độ dài nhỏ hơn `n` byte, thì các byte null đệm (padding null bytes) sẽ được ghi vào `s1` để đảm bảo rằng tổng cộng có `n` byte được ghi.
- Nếu giá trị kích thước tối đa được truyền vào `strncpy()` không đủ lớn để bao gồm ký tự kết thúc null (null-terminating character), thì chuỗi đích sẽ không được kết thúc bằng ký tự null.

Một số triển khai UNIX cung cấp hàm `strlcpy()`, hàm này nhận một đối số độ dài `n`, sao chép tối đa `n – 1` byte vào bộ nhớ đệm đích và luôn đính kèm một ký tự null ở cuối bộ nhớ đệm. Tuy nhiên, hàm này không được quy định trong SUSv3 và không được triển khai trong glibc. Hơn nữa, trong các trường hợp người gọi không kiểm tra kỹ độ dài chuỗi, hàm này chỉ thay thế vấn đề này (tràn bộ nhớ đệm) bằng vấn đề khác (âm thầm loại bỏ dữ liệu).

## 38.10 Cảnh giác với các cuộc tấn công từ chối dịch vụ (Denial-of-Service Attacks)

Cùng với sự gia tăng của các dịch vụ dựa trên Internet là sự gia tăng tương ứng về cơ hội xảy ra các cuộc tấn công từ chối dịch vụ từ xa (remote denial-of-service attacks). Các cuộc tấn công này nhằm mục đích làm cho một dịch vụ không khả dụng đối với các khách hàng (client) hợp pháp, bằng cách gửi cho máy chủ (server) dữ liệu bị lỗi định dạng (malformed data) khiến nó bị treo (crash) hoặc bằng cách làm quá tải máy chủ bằng các yêu cầu giả mạo.

> Các cuộc tấn công từ chối dịch vụ cục bộ (local denial-of-service attacks) cũng có thể xảy ra. Ví dụ nổi tiếng nhất là khi một người dùng chạy một fork bomb đơn giản (một chương trình liên tục gọi `fork`, từ đó tiêu thụ toàn bộ các khe tiến trình - process slots trên hệ thống). Tuy nhiên, nguồn gốc của các cuộc tấn công từ chối dịch vụ cục bộ dễ xác định hơn rất nhiều và chúng thường có thể được ngăn chặn bằng các biện pháp bảo mật vật lý và mật khẩu phù hợp.

Việc xử lý các yêu cầu bị lỗi định dạng (malformed requests) khá đơn giản—một máy chủ nên được lập trình để kiểm tra nghiêm ngặt đầu vào của nó và tránh hiện tượng tràn bộ đệm (buffer overruns), như đã mô tả ở trên.

Các cuộc tấn công quá tải (overload attacks) khó đối phó hơn. Vì máy chủ không thể kiểm soát hành vi của các client từ xa hoặc tốc độ mà chúng gửi yêu cầu, nên không thể ngăn chặn các cuộc tấn công như vậy. (Máy chủ thậm chí có thể không xác định được nguồn gốc thực sự của cuộc tấn công, vì địa chỉ IP nguồn của một gói tin mạng có thể bị giả mạo - spoofed. Ngoài ra, các cuộc tấn công phân tán - distributed attacks có thể lợi dụng các máy chủ trung gian không hề hay biết để hướng một cuộc tấn công vào hệ thống mục tiêu.) Mặc dù vậy, các biện pháp khác nhau có thể được áp dụng để giảm thiểu rủi ro và hậu quả của một cuộc tấn công quá tải:

- Máy chủ nên thực hiện điều tiết tải (load throttling), loại bỏ các yêu cầu khi tải vượt quá một giới hạn định trước nào đó. Điều này sẽ dẫn đến việc loại bỏ các yêu cầu hợp pháp, nhưng ngăn chặn việc máy chủ và máy tính chủ (host machine) bị quá tải. Việc sử dụng giới hạn tài nguyên (resource limits) và hạn mức đĩa (disk quotas) cũng có thể hữu ích trong việc hạn chế tải quá mức. (Tham khảo http://sourceforge.net/projects/linuxquota/ để biết thêm thông tin về hạn mức đĩa.)
- Máy chủ nên sử dụng thời gian chờ (timeouts) cho việc giao tiếp với một client, sao cho nếu client (có thể là cố ý) không phản hồi, máy chủ sẽ không bị kẹt vô thời hạn để chờ client đó.
- Trong trường hợp bị quá tải, máy chủ nên ghi lại các thông báo thích hợp để quản trị viên hệ thống (system administrator) được thông báo về sự cố. (Tuy nhiên, việc ghi log nên được điều tiết để bản thân việc ghi log không làm quá tải hệ thống.)
- Máy chủ nên được lập trình sao cho nó không bị treo khi đối mặt với một lượng tải bất ngờ. Ví dụ, việc kiểm tra biên (bounds checking) phải được thực hiện nghiêm ngặt để đảm bảo rằng các yêu cầu quá mức không làm tràn một cấu trúc dữ liệu (data structure).
- Các cấu trúc dữ liệu nên được thiết kế để tránh các cuộc tấn công phức tạp về mặt thuật toán (algorithmic-complexity attacks). Ví dụ, một cây nhị phân (binary tree) có thể được cân bằng và mang lại hiệu năng chấp nhận được dưới tải thông thường. Tuy nhiên, kẻ tấn công có thể tạo ra một chuỗi đầu vào dẫn đến một cây không cân bằng (tương đương với một danh sách liên kết - linked list trong trường hợp xấu nhất), điều này có thể làm tê liệt hiệu năng. [Crosby & Wallach, 2003] chi tiết hóa bản chất của các cuộc tấn công như vậy và thảo luận về các kỹ thuật cấu trúc dữ liệu có thể được sử dụng để tránh chúng.

## 38.11 Kiểm tra trạng thái trả về và Thất bại một cách an toàn (Fail Safely)

Một chương trình có đặc quyền (privileged program) phải luôn kiểm tra xem các System Call và hàm thư viện có thành công hay không, và chúng có trả về các giá trị mong đợi hay không. (Tất nhiên điều này đúng với tất cả các chương trình, nhưng đặc biệt quan trọng đối với các chương trình có đặc quyền.) Các System Call khác nhau có thể thất bại, ngay cả đối với một chương trình chạy với quyền root. Ví dụ, `fork()` có thể thất bại nếu gặp phải giới hạn trên toàn hệ thống về số lượng tiến trình, một lệnh `open()` để ghi có thể thất bại trên hệ thống tập tin chỉ đọc (read-only file system), hoặc `chdir()` có thể thất bại nếu thư mục đích không tồn tại.

Ngay cả khi một System Call thành công, việc kiểm tra kết quả của nó vẫn là cần thiết. Ví dụ, trong các trường hợp quan trọng, một chương trình có đặc quyền phải kiểm tra xem một lệnh `open()` thành công có trả về một trong ba File Descriptor tiêu chuẩn hay không: 0, 1 hoặc 2.

Cuối cùng, nếu một chương trình có đặc quyền gặp phải tình huống bất ngờ, hành vi thích hợp thường là chấm dứt (terminate) hoặc, trong trường hợp của một máy chủ, là hủy yêu cầu của client. Việc cố gắng khắc phục các sự cố bất ngờ thường đòi hỏi phải đưa ra các giả định có thể không hợp lý trong mọi hoàn cảnh và có thể dẫn đến việc tạo ra các lỗ hổng bảo mật. Trong những tình huống như vậy, sẽ an toàn hơn nếu để chương trình chấm dứt, hoặc để máy chủ ghi lại một thông báo log và loại bỏ yêu cầu của client.

## 38.12 Tổng kết

Các chương trình đặc quyền (privileged program) có quyền truy cập vào các tài nguyên hệ thống mà người dùng thông thường không thể tiếp cận. Nếu những chương trình này bị thao túng hoặc chiếm quyền (subverted), thì bảo mật của hệ thống có thể bị tổn hại. Trong chương này, chúng tôi đã trình bày một tập hợp các nguyên tắc hướng dẫn để viết các chương trình đặc quyền. Mục đích của các hướng dẫn này gồm hai mặt: giảm thiểu khả năng một chương trình đặc quyền bị chiếm quyền, và giảm thiểu thiệt hại có thể xảy ra trong trường hợp chương trình đặc quyền đó bị xâm phạm.

### Thông tin thêm

[Viega & McGraw, 2002] bao quát một phạm vi rộng lớn các chủ đề liên quan đến thiết kế và triển khai phần mềm bảo mật. Thông tin chung về bảo mật trên các hệ thống UNIX, cùng với một chương về các kỹ thuật lập trình bảo mật có thể được tìm thấy trong [Garfinkel et al., 2003]. Bảo mật máy tính được trình bày khá chi tiết trong [Bishop, 2005], và chi tiết hơn nữa bởi chính tác giả đó trong [Bishop, 2003]. [Peikari & Chuvakin, 2004] mô tả về bảo mật máy tính với trọng tâm là các phương thức đa dạng mà hệ thống có thể bị tấn công. Cả [Erickson, 2008] và [Anley, 2007] đều cung cấp một cuộc thảo luận thấu đáo về các lỗ hổng khai thác bảo mật (security exploit) khác nhau, cung cấp đủ chi tiết để các lập trình viên khôn ngoan có thể tránh được những lỗ hổng này. [Chen et al., 2002] là một bài báo mô tả và phân tích mô hình set-user-ID trên UNIX. [Tsafrir et al., 2008] xem xét lại và cải tiến phần thảo luận về các điểm khác nhau trong [Chen et al., 2002]. [Drepper, 2009] cung cấp vô số mẹo về lập trình bảo mật và phòng thủ trên Linux.

Một số nguồn thông tin về việc viết các chương trình bảo mật có sẵn trực tuyến, bao gồm các nguồn sau:

- Matt Bishop đã viết một loạt các bài báo liên quan đến bảo mật, có sẵn trực tuyến tại http://nob.cs.ucdavis.edu/~bishop/secprog. Bài báo thú vị nhất trong số này là "How to Write a Setuid Program," (được xuất bản lần đầu trong ;login: 12(1) Tháng 1/Tháng 2 năm 1986). Mặc dù có phần lỗi thời, bài báo này vẫn chứa rất nhiều mẹo hữu ích.
- The Secure Programming for Linux and Unix HOWTO, được viết bởi David Wheeler, có sẵn tại http://www.dwheeler.com/secure-programs/.
- Một danh sách kiểm tra (checklist) hữu ích để viết các chương trình set-user-ID có sẵn trực tuyến tại http://www.homeport.org/~adam/setuid.7.html.

## 38.13 Bài tập

- **38-1.** Đăng nhập với tư cách là một người dùng thông thường, không có đặc quyền (unprivileged user), tạo một tệp thực thi (hoặc sao chép một tệp có sẵn như `/bin/sleep`), và bật bit quyền set-user-ID trên tệp đó (`chmod u+s`). Hãy thử sửa đổi tệp (ví dụ: `cat >> file`). Chuyện gì xảy ra với các quyền của tệp như là kết quả của việc đó (`ls –l`)? Tại sao điều này lại xảy ra?
- **38-2.** Viết một chương trình set-user-ID-root tương tự như chương trình `sudo(8)`. Chương trình này nhận các tùy chọn dòng lệnh (command-line options) và các đối số (arguments) như sau:
  - \$ **./douser [-u** *user* **]** *program-file arg1 arg2* **...**

Chương trình `douser` thực thi `program-file`, với các đối số được cung cấp, giống như thể nó được chạy bởi `user`. (Nếu tùy chọn `-u` bị lược bỏ, thì `user` mặc định sẽ là `root`.) Trước khi thực thi `program-file`, `douser` nên yêu cầu mật khẩu cho `user`, xác thực nó dựa trên tệp mật khẩu tiêu chuẩn (xem Bảng 8-2, trang 164), và sau đó thiết lập tất cả các ID người dùng và nhóm của tiến trình (process user and group IDs) thành các giá trị chính xác cho người dùng đó.
