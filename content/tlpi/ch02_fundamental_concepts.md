# Chương 2: Các khái niệm cơ bản (Fundamental Concepts)

Chương này giới thiệu một loạt các khái niệm liên quan đến lập trình hệ thống Linux (Linux system programming). Chương này dành cho độc giả đã quen làm việc chủ yếu với các hệ điều hành khác, hoặc chỉ có ít kinh nghiệm với Linux hoặc một hệ thống tương thích UNIX khác.

## 2.1 Hệ điều hành cốt lõi: Nhân hệ điều hành (Kernel)

Thuật ngữ hệ điều hành (operating system) thường được sử dụng với hai ý nghĩa khác nhau:

- Để chỉ toàn bộ gói phần mềm bao gồm phần mềm trung tâm quản lý tài nguyên của máy tính và tất cả các công cụ phần mềm tiêu chuẩn đi kèm, chẳng hạn như bộ thông dịch dòng lệnh (command-line interpreters), giao diện người dùng đồ họa (graphical user interfaces), các tiện ích tập tin và trình soạn thảo.
- Theo nghĩa hẹp hơn, để chỉ phần mềm trung tâm quản lý và phân bổ tài nguyên máy tính (tức là CPU, RAM và các thiết bị).

Thuật ngữ nhân hệ điều hành (kernel) thường được dùng như một từ đồng nghĩa với ý nghĩa thứ hai, và chính nghĩa thứ hai này của hệ điều hành là chủ đề chúng ta quan tâm trong cuốn sách này.

Mặc dù có thể chạy các chương trình trên máy tính mà không cần kernel, sự hiện diện của kernel giúp đơn giản hóa đáng kể việc viết và sử dụng các chương trình khác, đồng thời nâng cao sức mạnh và tính linh hoạt cho các lập trình viên. Kernel thực hiện điều này bằng cách cung cấp một tầng phần mềm (software layer) để quản lý các tài nguyên hạn chế của máy tính.

Tập tin thực thi của Linux kernel thường nằm ở đường dẫn `/boot/vmlinuz` hoặc một đường dẫn tương tự. Nguồn gốc của tên tập tin này mang tính lịch sử. Trên các hệ thống UNIX thời kỳ đầu, kernel được gọi là `unix`. Các phiên bản UNIX sau này, vốn hỗ trợ bộ nhớ ảo (virtual memory), đã đổi tên kernel thành `vmunix`. Trên Linux, tên tập tin phản ánh tên hệ thống, với chữ `z` thay thế cho chữ `x` ở cuối để biểu thị rằng kernel là một tập tin thực thi đã nén (compressed executable).

## Các tác vụ do kernel thực hiện

Bên cạnh các tác vụ khác, kernel thực hiện các công việc sau:

- Lập lịch tiến trình (Process scheduling): Một máy tính có một hoặc nhiều đơn vị xử lý trung tâm (CPU), thực thi các lệnh của chương trình. Giống như các hệ thống UNIX khác, Linux là một hệ điều hành đa nhiệm ưu tiên (preemptive multitasking operating system). Đa nhiệm có nghĩa là nhiều tiến trình (process) — tức là các chương trình đang chạy — có thể cùng lúc tồn tại trong bộ nhớ và mỗi tiến trình có thể được sử dụng (các) CPU. Ưu tiên có nghĩa là các quy tắc chi phối tiến trình nào được sử dụng CPU và trong bao lâu sẽ do bộ lập lịch tiến trình của kernel (kernel process scheduler) quyết định (chứ không phải do chính các tiến trình đó tự quyết định).
- Quản lý bộ nhớ (Memory management): Mặc dù bộ nhớ máy tính ngày nay rất khổng lồ so với tiêu chuẩn của một hoặc hai thập kỷ trước, kích thước của phần mềm cũng tăng lên tương ứng, do đó bộ nhớ vật lý (RAM) vẫn là một tài nguyên hạn chế mà kernel phải chia sẻ giữa các tiến trình một cách công bằng và hiệu quả. Giống như hầu hết các hệ điều hành hiện đại, Linux sử dụng tính năng quản lý bộ nhớ ảo (virtual memory management) (Mục 6.4), một kỹ thuật đem lại hai ưu điểm chính:
  - Các tiến trình được cô lập với nhau và với kernel, do đó một tiến trình không thể đọc hoặc sửa đổi bộ nhớ của tiến trình khác hoặc của kernel.
  - Chỉ một phần của tiến trình cần phải được giữ trong bộ nhớ, nhờ đó làm giảm yêu cầu bộ nhớ của mỗi tiến trình và cho phép nhiều tiến trình được giữ trong RAM cùng một lúc. Điều này dẫn đến việc sử dụng CPU tốt hơn, vì nó làm tăng khả năng có ít nhất một tiến trình mà (các) CPU có thể thực thi tại bất kỳ thời điểm nào.
- Cung cấp hệ thống tập tin (Provision of a file system): Kernel cung cấp một hệ thống tập tin (file system) trên đĩa, cho phép tạo, truy xuất, cập nhật, xóa các tập tin, v.v.
- Tạo và kết thúc tiến trình (Creation and termination of processes): Kernel có thể nạp một chương trình mới vào bộ nhớ, cung cấp cho nó các tài nguyên (ví dụ: CPU, bộ nhớ và quyền truy cập tập tin) cần thiết để chạy. Một thể hiện (instance) của chương trình đang chạy như vậy được gọi là một tiến trình (process). Khi một tiến trình hoàn thành việc thực thi, kernel đảm bảo rằng các tài nguyên nó sử dụng được giải phóng để các chương trình sau có thể tái sử dụng.

```

```

- Truy cập thiết bị (Access to devices): Các thiết bị (chuột, màn hình, bàn phím, ổ đĩa và ổ băng từ, v.v.) được kết nối với máy tính cho phép truyền thông tin giữa máy tính và thế giới bên ngoài, cho phép nhập, xuất hoặc cả hai. Kernel cung cấp cho các chương trình một giao diện giúp chuẩn hóa và đơn giản hóa việc truy cập thiết bị, đồng thời điều phối quyền truy cập của nhiều tiến trình vào từng thiết bị.

- Mạng (Networking): Kernel truyền và nhận các thông điệp mạng (gói tin - packets) thay mặt cho các tiến trình người dùng (user processes). Tác vụ này bao gồm việc định tuyến các gói tin mạng đến hệ thống đích.
- Cung cấp giao diện lập trình ứng dụng system call (API): Các tiến trình có thể yêu cầu kernel thực hiện các tác vụ khác nhau bằng cách sử dụng các điểm vào kernel (kernel entry points) được gọi là system call. API system call của Linux là chủ đề chính của cuốn sách này. Mục [3.1](#page-22-0) trình bày chi tiết các bước diễn ra khi một tiến trình thực hiện một system call.

Ngoài các tính năng trên, các hệ điều hành đa người dùng (multiuser operating systems) như Linux thường cung cấp cho người dùng sự trừu tượng hóa của một máy tính ảo riêng (virtual private computer); nghĩa là, mỗi người dùng có thể đăng nhập vào hệ thống và hoạt động phần lớn độc lập với những người dùng khác. Ví dụ, mỗi người dùng có không gian lưu trữ đĩa riêng (thư mục chính - home directory). Ngoài ra, người dùng có thể chạy các chương trình, mỗi chương trình nhận một phần chia CPU và hoạt động trong không gian địa chỉ ảo (virtual address space) của riêng mình, và các chương trình này có thể truy cập độc lập các thiết bị cũng như truyền thông tin qua mạng. Kernel giải quyết các xung đột tiềm ẩn trong việc truy cập tài nguyên phần cứng, do đó người dùng và tiến trình thường không nhận thức được các xung đột đó.

## Chế độ nhân và chế độ người dùng (Kernel mode and user mode)

Các kiến trúc bộ vi xử lý hiện đại thường cho phép CPU hoạt động ở ít nhất hai chế độ khác nhau: chế độ người dùng (user mode) và chế độ nhân (kernel mode) (đôi khi còn gọi là chế độ giám sát - supervisor mode). Các lệnh phần cứng cho phép chuyển đổi từ chế độ này sang chế độ khác. Tương ứng, các vùng bộ nhớ ảo (virtual memory) có thể được đánh dấu là thuộc về không gian người dùng (user space) hoặc không gian nhân (kernel space). Khi chạy ở chế độ người dùng, CPU chỉ có thể truy cập bộ nhớ được đánh dấu là thuộc không gian người dùng; các cố gắng truy cập bộ nhớ trong không gian nhân sẽ dẫn đến một ngoại lệ phần cứng (hardware exception). Khi chạy ở chế độ nhân, CPU có thể truy cập được cả không gian bộ nhớ của người dùng và của nhân.

Một số thao tác nhất định chỉ có thể được thực hiện khi bộ xử lý đang hoạt động ở chế độ nhân. Ví dụ bao gồm việc thực thi lệnh dừng hệ thống (halt instruction), truy cập phần cứng quản lý bộ nhớ, và khởi tạo các thao tác I/O thiết bị. Bằng cách tận dụng thiết kế phần cứng này để đặt hệ điều hành (operating system) vào không gian nhân, những người phát triển và hiện thực hệ điều hành có thể đảm bảo rằng các tiến trình người dùng (user process) không thể truy cập vào các chỉ thị lệnh và cấu trúc dữ liệu của nhân (kernel), hoặc thực hiện các thao tác có thể ảnh hưởng bất lợi đến hoạt động của hệ thống.

```

```

### Góc nhìn của tiến trình so với góc nhìn của nhân về hệ thống

Trong nhiều tác vụ lập trình hàng ngày, chúng ta đã quen với việc tư duy về lập trình theo hướng hướng-tiến trình (process-oriented). Tuy nhiên, khi xem xét các chủ đề khác nhau được đề cập sau này trong cuốn sách này, việc định hướng lại góc nhìn của chúng ta để xem xét mọi thứ từ quan điểm của nhân (kernel) sẽ rất hữu ích. Để làm nổi bật sự tương phản này, bây giờ chúng ta sẽ xem xét mọi thứ trông như thế nào đầu tiên từ góc nhìn của tiến trình và sau đó từ góc nhìn của nhân.

Một hệ thống đang chạy thường có rất nhiều tiến trình (process). Đối với một tiến trình, nhiều thứ diễn ra một cách bất đồng bộ (asynchronously). Một tiến trình đang thực thi không biết khi nào đến lượt nó bị hết thời gian (time out), tiến trình nào khác sẽ được lập lịch (schedule) cho CPU (và theo thứ tự nào), hoặc khi nào nó sẽ tiếp tục được lập lịch. Việc phân phối tín hiệu (signal) và sự xuất hiện của các sự kiện giao tiếp giữa các tiến trình (interprocess communication) được trung gian hóa bởi nhân, và có thể xảy ra bất cứ lúc nào đối với một tiến trình. Nhiều thứ diễn ra một cách trong suốt (transparently) đối với một tiến trình. Một tiến trình không biết nó được định vị ở đâu trong RAM hoặc, nói chung là, liệu một phần cụ thể trong không gian bộ nhớ của nó hiện đang nằm thường trú trong bộ nhớ hay được lưu giữ trong vùng swap (một vùng không gian đĩa được dành riêng để bổ sung cho RAM của máy tính). Tương tự, một tiến trình không biết các tệp mà nó truy cập được lưu giữ ở đâu trên ổ đĩa; nó đơn giản là tham chiếu đến các tệp bằng tên. Một tiến trình hoạt động cô lập (in isolation); nó không thể trực tiếp giao tiếp với một tiến trình khác. Bản thân một tiến trình không thể tự tạo ra một tiến trình mới hoặc thậm chí kết thúc sự tồn tại của chính nó. Cuối cùng, một tiến trình không thể giao tiếp trực tiếp với các thiết bị đầu vào và đầu ra được kết nối với máy tính.

Ngược lại, một hệ thống đang chạy chỉ có một nhân duy nhất, là thành phần biết và kiểm soát mọi thứ. Nhân tạo điều kiện cho việc chạy của tất cả các tiến trình trên hệ thống. Nhân quyết định tiến trình nào sẽ tiếp theo có quyền truy cập vào CPU, khi nào sẽ làm điều đó, và trong bao lâu. Nhân duy trì các cấu trúc dữ liệu chứa thông tin về tất cả các tiến trình đang chạy và cập nhật các cấu trúc này khi các tiến trình được tạo, thay đổi trạng thái, và kết thúc. Nhân duy trì tất cả các cấu trúc dữ liệu cấp thấp cho phép các tên tệp được sử dụng bởi các chương trình được dịch thành các vị trí vật lý trên đĩa. Nhân cũng duy trì các cấu trúc dữ liệu ánh xạ (map) bộ nhớ ảo của mỗi tiến trình vào bộ nhớ vật lý của máy tính và (các) vùng swap trên đĩa. Tất cả giao tiếp giữa các tiến trình được thực hiện thông qua các cơ chế do nhân cung cấp. Để đáp ứng các yêu cầu từ các tiến trình, nhân tạo ra các tiến trình mới và chấm dứt các tiến trình hiện có. Cuối cùng, nhân (cụ thể là các trình điều khiển thiết bị - device drivers) thực hiện tất cả các giao tiếp trực tiếp với các thiết bị đầu vào và đầu ra, truyền thông tin đến và đi từ các tiến trình người dùng theo yêu cầu.

Sau này trong cuốn sách này, chúng ta sẽ nói những câu đại loại như "một tiến trình có thể tạo ra một tiến trình khác," "một tiến trình có thể tạo ra một pipe," "một tiến trình có thể ghi dữ liệu vào một tệp," và "một tiến trình có thể kết thúc bằng cách gọi exit()." Tuy nhiên, hãy nhớ rằng nhân là trung gian cho tất cả các hành động như vậy, và những phát biểu này chỉ là cách nói tắt cho "một tiến trình có thể yêu cầu nhân tạo ra một tiến trình khác," v.v.

### Thông tin thêm

Các tài liệu hiện đại bao gồm các khái niệm và thiết kế hệ điều hành, đặc biệt tham khảo đến các hệ thống UNIX, bao gồm [Tanenbaum, 2007], [Tanenbaum & Woodhull, 2006], và [Vahalia, 1996], trong đó tài liệu cuối cùng chứa nhiều chi tiết về kiến trúc bộ nhớ ảo (virtual memory). [Goodheart & Cox, 1994] cung cấp các chi tiết về System V Release 4. [Maxwell, 1999] cung cấp bản chú giải mã nguồn chi tiết cho các phần được chọn lọc trong nhân (kernel) Linux 2.2.5.

```

``` [Lions, 1996] là một tài liệu trình bày chi tiết về mã nguồn UNIX Phiên bản thứ Sáu, vẫn là một tài liệu nhập môn hữu ích về cấu trúc bên trong (internals) của hệ điều hành UNIX. [Bovet & Cesati, 2005] mô tả việc cài đặt và hiện thực nhân Linux 2.6.

## 2.2 Shell

Shell là một chương trình chuyên dụng được thiết kế để đọc các câu lệnh do người dùng gõ vào và thực thi các chương trình tương ứng để đáp ứng các câu lệnh đó. Một chương trình như vậy đôi khi được gọi là trình thông dịch lệnh (command interpreter).

Thuật ngữ shell đăng nhập (login shell) được dùng để chỉ tiến trình (process) được tạo ra để chạy shell khi người dùng đăng nhập lần đầu tiên.

Trong khi trên một số hệ điều hành, trình thông dịch lệnh là một phần tích hợp của kernel, thì trên các hệ thống UNIX, shell là một tiến trình người dùng (user process). Tồn tại rất nhiều loại shell khác nhau, và những người dùng khác nhau (hoặc thậm chí, một người dùng đơn lẻ) trên cùng một máy tính có thể sử dụng đồng thời các shell khác nhau. Một số shell quan trọng đã xuất hiện theo thời gian:

- Bourne shell (sh): Đây là shell lâu đời nhất trong số các shell được sử dụng rộng rãi, do Steve Bourne viết. Đây là shell chuẩn cho UNIX Phiên bản thứ Bảy. Bourne shell chứa nhiều tính năng quen thuộc trong tất cả các shell: chuyển hướng I/O (I/O redirection), đường ống (pipeline), tạo tên tệp (globbing - mở rộng wildcard), các biến, thao tác với biến môi trường (environment variable), thay thế câu lệnh (command substitution), thực thi câu lệnh nền (background command execution), và các hàm (function). Tất cả các phiên bản UNIX sau này đều bao gồm Bourne shell bên cạnh bất kỳ shell nào khác mà chúng cung cấp.
- C shell (csh): Shell này được viết bởi Bill Joy tại Đại học California tại Berkeley. Tên gọi bắt nguồn từ sự tương đồng của nhiều cấu trúc điều khiển luồng (flow-control construct) của shell này với ngôn ngữ lập trình C. C shell cung cấp một số tính năng tương tác hữu ích không có trong Bourne shell, bao gồm lịch sử câu lệnh (command history), chỉnh sửa dòng lệnh (command-line editing), quản lý tiến trình công việc (job control), và các bí danh (alias). C shell không tương thích ngược (backward compatible) với Bourne shell. Mặc dù shell tương tác chuẩn trên BSD là C shell, nhưng các tập lệnh shell (shell script - được mô tả ngay sau đây) thường được viết cho Bourne shell để đảm bảo tính khả chuyển (portable) trên tất cả các phiên bản UNIX.
- Korn shell (ksh): Shell này được viết như một phiên bản kế nhiệm của Bourne shell bởi David Korn tại AT&T Bell Laboratories. Trong khi vẫn duy trì tính tương thích ngược với Bourne shell, nó cũng tích hợp các tính năng tương tác tương tự như những gì được cung cấp bởi C shell.
- Bourne again shell (bash): Shell này là bản hiện thực lại Bourne shell của dự án GNU. Nó cung cấp các tính năng tương tác tương tự như những tính năng có sẵn trong C và Korn shell. Các tác giả chính của bash là Brian Fox và Chet Ramey. Bash có lẽ là shell được sử dụng rộng rãi nhất trên Linux. (Trên Linux, Bourne shell, sh, thực chất được cung cấp bởi bash bằng cách mô phỏng sh sát nhất có thể).

POSIX.2-1992 đã quy định một chuẩn cho shell dựa trên phiên bản Korn shell lúc bấy giờ. Ngày nay, Korn shell và bash đều tuân thủ POSIX, nhưng cung cấp một số phần mở rộng (extension) cho chuẩn này, và nhiều phần mở rộng trong số đó có sự khác biệt giữa hai shell.

Các shell được thiết kế không chỉ để sử dụng tương tác, mà còn để thông dịch các tập lệnh shell (shell script), vốn là các tệp văn bản chứa các câu lệnh shell. Cho mục đích này, mỗi shell đều có các tiện ích thường gắn liền với các ngôn ngữ lập trình: biến, câu lệnh vòng lặp và điều kiện, câu lệnh I/O, và các hàm.

Mỗi shell thực hiện các tác vụ tương tự nhau, mặc dù có sự khác biệt về cú pháp. Trừ khi đề cập đến hoạt động của một shell cụ thể, chúng ta thường gọi chung là "shell", với ngầm hiểu rằng tất cả các shell hoạt động theo phương thức đã mô tả. Hầu hết các ví dụ trong cuốn sách này yêu cầu sử dụng shell đều dùng bash, nhưng trừ khi có chú thích khác, người đọc có thể giả định rằng các ví dụ này hoạt động theo cùng một cách trên các shell kiểu Bourne khác.

## 2.3 Users and Groups (Người dùng và Nhóm)

Mỗi người dùng trên hệ thống được định danh một cách duy nhất, và người dùng có thể thuộc về các nhóm (groups).

### Users (Người dùng)

Mỗi người dùng của hệ thống có một tên đăng nhập duy nhất (username) và một ID người dùng số (numeric user ID - UID) tương ứng. Đối với mỗi người dùng, các thông tin này được định nghĩa bởi một dòng trong tệp mật khẩu của hệ thống, `/etc/passwd`, bao gồm các thông tin bổ sung sau:

- Group ID: ID nhóm số của nhóm đầu tiên trong số các nhóm mà người dùng là thành viên.
- Home directory (Thư mục chính): Thư mục ban đầu mà người dùng được đặt vào sau khi đăng nhập.
- Login shell: Tên của chương trình sẽ được thực thi để thông dịch các lệnh của người dùng.

Bản ghi mật khẩu cũng có thể bao gồm mật khẩu của người dùng, ở dạng mã hóa. Tuy nhiên, vì lý do bảo mật, mật khẩu thường được lưu trữ trong một tệp mật khẩu ẩn (shadow password file) riêng biệt, chỉ những người dùng có đặc quyền (privileged users) mới có thể đọc được.

### Groups (Nhóm)

Vì mục đích quản trị—đặc biệt là để kiểm soát quyền truy cập vào các tệp và tài nguyên hệ thống khác—việc tổ chức người dùng thành các nhóm rất hữu ích. Ví dụ, những người trong một nhóm làm việc cùng một dự án, và do đó chia sẻ một tập hợp tệp chung, có thể đều trở thành thành viên của cùng một nhóm. Trong các triển khai UNIX thời kỳ đầu, một người dùng chỉ có thể là thành viên của một nhóm duy nhất. BSD cho phép một người dùng đồng thời thuộc về nhiều nhóm, một ý tưởng sau đó được áp dụng bởi các triển khai UNIX khác và tiêu chuẩn POSIX.1-1990. Mỗi nhóm được định danh bằng một dòng duy nhất trong tệp nhóm của hệ thống, `/etc/group`, bao gồm các thông tin sau:

- Group name (Tên nhóm): Tên (độc nhất) của nhóm.
- Group ID (GID): ID số liên kết với nhóm này.
- User list (Danh sách người dùng): Danh sách phân tách bằng dấu phẩy gồm các tên đăng nhập của những người dùng là thành viên của nhóm này (và không được định danh là thành viên của nhóm theo trường ID nhóm trong bản ghi tệp mật khẩu của họ).

### Superuser (Siêu người dùng)

Một người dùng, được gọi là siêu người dùng (superuser), có các đặc quyền đặc biệt trong hệ thống. Tài khoản siêu người dùng có ID người dùng bằng 0 và thông thường có tên đăng nhập là `root`. Trên các hệ thống UNIX điển hình, siêu người dùng bỏ qua tất cả các kiểm tra quyền (permission checks) trong hệ thống. Do đó, ví dụ, siêu người dùng có thể truy cập bất kỳ tệp nào trong hệ thống, bất kể quyền hạn trên tệp đó là gì, và có thể gửi tín hiệu (signals) đến bất kỳ tiến trình người dùng (user process) nào trong hệ thống. Quản trị viên hệ thống (system administrator) sử dụng tài khoản siêu người dùng để thực hiện các tác vụ quản trị khác nhau trên hệ thống.

## 2.4 Cây phân cấp thư mục đơn nhất, Thư mục, Liên kết và Tệp (Single Directory Hierarchy, Directories, Links, and Files)

```

```

Kernel duy trì một cấu trúc thư mục phân cấp đơn (single hierarchical directory structure) để tổ chức tất cả các tệp trong hệ thống. (Điều này trái ngược với các hệ điều hành như Microsoft Windows, nơi mỗi thiết bị đĩa có hệ thống phân cấp thư mục riêng của nó). Ở gốc của hệ thống phân cấp này là *thư mục gốc* (*root directory*), được đặt tên là `/` (dấu gạch chéo). Tất cả các tệp và thư mục đều là con hoặc các hậu bối tiếp theo của thư mục gốc. Hình 2-1 hiển thị một ví dụ về cấu trúc tệp phân cấp này.

```text
/                    (directory)
├── bin              (directory)
│   └── bash         (regular file)
├── boot             (directory)
│   └── vmlinuz      (regular file)
├── etc              (directory)
│   ├── group        (regular file)
│   └── passwd       (regular file)
├── home             (directory)
│   ├── avr          (directory)
│   │   └── java     (directory)
│   │       └── Go.java   (regular file)
│   └── mtk          (directory)
│       └── .bashrc  (regular file)
└── usr              (directory)
    └── include      (directory)
        ├── sys      (directory)
        │   └── types.h   (regular file)
        └── stdio.h  (regular file)
```

Hình 2-1: Tập con của hệ thống phân cấp thư mục đơn Linux

### File types (Các loại tệp)

Bên trong hệ thống tệp (file system), mỗi tệp được đánh dấu bằng một *loại* (*type*), cho biết đó là loại tệp nào. Một trong các loại tệp này biểu thị các tệp dữ liệu thông thường, thường được gọi là tệp *thông thường* (*regular* hoặc *plain files*) để phân biệt chúng với các loại tệp khác. Các loại tệp khác này bao gồm thiết bị (devices), đường ống (pipes), socket, thư mục (directories) và liên kết tượng trưng (symbolic links).

Thuật ngữ *tệp* (*file*) thường được sử dụng để chỉ một tệp thuộc bất kỳ loại nào, không chỉ riêng tệp thông thường.

### Directories and links (Thư mục và liên kết)

Một *thư mục* (*directory*) là một tệp đặc biệt có nội dung ở dạng một bảng gồm các tên tệp đi kèm với các tham chiếu đến các tệp tương ứng. Sự kết hợp giữa tên tệp và tham chiếu này được gọi là một *liên kết* (*link*), và các tệp có thể có nhiều liên kết, do đó có nhiều tên, trong cùng một thư mục hoặc trong các thư mục khác nhau.

Các thư mục có thể chứa các liên kết đến cả tệp và các thư mục khác. Các liên kết giữa các thư mục thiết lập nên hệ thống phân cấp thư mục được minh họa trong Hình 2-1.

Mọi thư mục đều chứa ít nhất hai mục nhập (entries): `.` (dấu chấm), là một liên kết trỏ đến chính thư mục đó, và `..` (hai dấu chấm), là một liên kết trỏ đến *thư mục cha* (*parent directory*) của nó, tức là thư mục nằm ngay phía trên nó trong cấu trúc phân cấp. Mọi thư mục, ngoại trừ thư mục gốc, đều có thư mục cha. Đối với thư mục gốc, mục nhập `..` là một liên kết trỏ đến chính thư mục gốc đó (do đó, `/..` tương đương với `/`).

### Symbolic links (Liên kết tượng trưng)

Giống như một liên kết thông thường, liên kết tượng trưng (symbolic link) cung cấp một tên thay thế cho một tệp. Nhưng trong khi liên kết thông thường là một mục nhập tên-tệp-kèm-con-trỏ trong danh sách thư mục, thì liên kết tượng trưng là một tệp được đánh dấu đặc biệt chứa tên của một tệp khác. (Nói cách khác, liên kết tượng trưng có một mục nhập tên-tệp-kèm-con-trỏ trong thư mục, và tệp được trỏ tới bởi con trỏ đó chứa một chuỗi ký tự đặt tên cho một tệp khác). Tệp sau này thường được gọi là đích (target) của liên kết tượng trưng, và người ta thường nói rằng liên kết tượng trưng "trỏ" (*points*) hoặc "tham chiếu" (*refers*) tới tệp đích. Khi một đường dẫn (pathname) được chỉ định trong một System Call, trong hầu hết các trường hợp, kernel sẽ tự động giải tham chiếu (*dereferences* hoặc gọi đồng nghĩa là *follows* - đi theo) từng liên kết tượng trưng có trong đường dẫn đó, thay thế nó bằng tên tệp mà nó trỏ tới. Quá trình này có thể diễn ra đệ quy (recursively) nếu đích của một liên kết tượng trưng bản thân nó lại là một liên kết tượng trưng. (Kernel áp đặt giới hạn về số lần giải tham chiếu để xử lý trường hợp có các chuỗi vòng tròn của liên kết tượng trưng). Nếu một liên kết tượng trưng tham chiếu đến một tệp không tồn tại, nó được gọi là một liên kết lơ lửng / đứt gãy (dangling link).

```

```

Thường thì hard link (liên kết cứng) và soft link (liên kết mềm) được dùng làm các thuật ngữ thay thế cho normal link (liên kết thông thường) và symbolic link (liên kết tượng trưng). Lý do tồn tại hai loại liên kết khác nhau này được giải thích trong Chương 18.

### Tên tệp (Filenames)

Trên hầu hết các hệ thống tệp (file system) Linux, tên tệp (filename) có độ dài lên tới 255 ký tự. Tên tệp có thể chứa bất kỳ ký tự nào ngoại trừ dấu gạch chéo (`/`) và ký tự null (`\0`). Tuy nhiên, bạn chỉ nên sử dụng các chữ cái, chữ số và các ký tự dấu chấm (`.`), dấu gạch dưới (`_`), và dấu gạch ngang (`-`). Tập hợp 65 ký tự này, `[-._a-zA-Z0-9]`, được gọi trong SUSv3 là tập ký tự tên tệp di động (portable filename character set).

Chúng ta nên tránh sử dụng các ký tự nằm ngoài tập ký tự tên tệp di động trong tên tệp, bởi vì những ký tự đó có thể mang ý nghĩa đặc biệt bên trong shell, trong biểu thức chính quy (regular expression), hoặc trong các ngữ cảnh khác. Nếu một tên tệp chứa các ký tự có ý nghĩa đặc biệt xuất hiện trong các ngữ cảnh như vậy, thì các ký tự này phải được thoát (escape); nghĩa là được đánh dấu đặc biệt—thường là bằng một dấu gạch chéo ngược (`\`) đứng trước để biểu thị rằng chúng không được hiểu theo các ý nghĩa đặc biệt đó. Trong những ngữ cảnh không có cơ chế escape nào khả dụng, tên tệp sẽ không thể sử dụng được.

Chúng ta cũng nên tránh các tên tệp bắt đầu bằng dấu gạch ngang (`-`), vì những tên tệp như vậy có thể bị nhầm lẫn với các tùy chọn (options) khi được chỉ định trong một lệnh shell.

### Đường dẫn (Pathnames)

Đường dẫn (pathname) là một chuỗi bao gồm một dấu gạch chéo khởi đầu tùy chọn (`/`) theo sau là một chuỗi các tên tệp được phân tách bằng dấu gạch chéo. Tất cả các tên tệp thành phần ngoại trừ tên cuối cùng đều xác định một thư mục (hoặc một symbolic link phân giải thành một thư mục). Thành phần cuối cùng của một đường dẫn có thể xác định bất kỳ loại tệp nào, kể cả thư mục. Chuỗi các tên tệp thành phần đứng trước dấu gạch chéo cuối cùng đôi khi được gọi là phần thư mục (directory part) của đường dẫn, trong khi tên theo sau dấu gạch chéo cuối cùng đôi khi được gọi là phần tệp hoặc phần cơ sở (file or base part) của đường dẫn.

Một đường dẫn được đọc từ trái sang phải; mỗi tên tệp nằm trong thư mục được chỉ định bởi phần trước của đường dẫn. Chuỗi `..` có thể được sử dụng ở bất kỳ đâu trong đường dẫn để chỉ đến thư mục cha (parent) của vị trí được chỉ định cho đến thời điểm đó trong đường dẫn.

Một đường dẫn mô tả vị trí của một tệp trong cấu trúc phân cấp thư mục duy nhất (single directory hierarchy), và có thể là tuyệt đối (absolute) hoặc tương đối (relative):

- Một đường dẫn tuyệt đối (absolute pathname) bắt đầu bằng một dấu gạch chéo (`/`) và chỉ định vị trí của một tệp tính từ thư mục gốc (root directory). Ví dụ về các đường dẫn tuyệt đối cho các tệp trong [Hình 2-1](#page-6-0) là `/home/mtk/.bashrc`, `/usr/include`, và `/` (đường dẫn của thư mục gốc).
- Một đường dẫn tương đối (relative pathname) chỉ định vị trí của một tệp tương đối với thư mục làm việc hiện tại (current working directory) của một process (tiến trình) (xem bên dưới), và được phân biệt với đường dẫn tuyệt đối bởi việc không có dấu gạch chéo ở đầu. Trong [Hình 2-1,](#page-6-0) từ thư mục `usr`, tệp `types.h` có thể được tham chiếu bằng đường dẫn tương đối `include/sys/types.h`, trong khi từ thư mục `avr`, tệp `.bashrc` có thể được truy cập bằng đường dẫn tương đối `../mtk/.bashrc`.

## Thư mục làm việc hiện tại

Mỗi tiến trình (process) có một thư mục làm việc hiện tại (current working directory - đôi khi chỉ gọi là thư mục làm việc của tiến trình hoặc thư mục hiện tại). Đây là "vị trí hiện tại" của tiến trình trong hệ thống phân cấp thư mục đơn lẻ (single directory hierarchy), và các tên đường dẫn tương đối (relative pathnames) sẽ được diễn giải đối với tiến trình dựa trên thư mục này.

Một tiến trình kế thừa thư mục làm việc hiện tại từ tiến trình cha (parent process) của nó. Một shell đăng nhập (login shell) có thư mục làm việc hiện tại ban đầu được thiết lập tới vị trí được chỉ định trong trường thư mục chính (home directory) của mục nhập trong tệp mật khẩu của người dùng. Thư mục làm việc hiện tại của shell có thể được thay đổi bằng lệnh `cd`.

### Quyền sở hữu và quyền hạn tệp

Mỗi tệp có một ID người dùng (user ID) và ID nhóm (group ID) đi kèm, xác định chủ sở hữu của tệp và nhóm mà tệp đó thuộc về. Quyền sở hữu của một tệp được sử dụng để xác định các quyền truy cập khả dụng cho người dùng đối với tệp đó.

Nhằm mục đích truy cập tệp, hệ thống chia người dùng thành ba loại: chủ sở hữu của tệp (đôi khi được gọi là người dùng của tệp - user), những người dùng là thành viên của nhóm khớp với ID nhóm của tệp (nhóm - group), và phần còn lại của thế giới (khác - other). Ba bit quyền có thể được thiết lập cho mỗi loại người dùng này (tạo thành tổng cộng chín bit quyền): quyền đọc (read permission) cho phép đọc nội dung của tệp; quyền ghi (write permission) cho phép sửa đổi nội dung của tệp; và quyền thực thi (execute permission) cho phép thực thi tệp, có thể là một chương trình hoặc một tập lệnh (script) được xử lý bởi một trình thông dịch nào đó (thường là, nhưng không phải luôn luôn, một trong các shell).

Các quyền này cũng có thể được thiết lập trên các thư mục, mặc dù ý nghĩa của chúng có khác đi một chút: quyền đọc cho phép liệt kê nội dung của thư mục (tức là các tên tệp trong thư mục); quyền ghi cho phép thay đổi nội dung của thư mục (tức là tên tệp có thể được thêm, xóa và thay đổi); và quyền thực thi (đôi khi được gọi là quyền tìm kiếm - search permission) cho phép truy cập vào các tệp bên trong thư mục (tùy thuộc vào các quyền trên chính các tệp đó).

## 2.5 Mô hình I/O Tệp

Một trong những đặc điểm nổi bật của mô hình I/O trên hệ thống UNIX là khái niệm tính phổ quát của I/O (universality of I/O). Điều này có nghĩa là các System Call giống nhau (`open()`, `read()`, `write()`, `close()`, v.v.) được sử dụng để thực hiện I/O trên tất cả các loại tệp, bao gồm cả các thiết bị. (Kernel dịch các yêu cầu I/O của ứng dụng thành các thao tác hệ thống tệp hoặc trình điều khiển thiết bị - device driver phù hợp để thực hiện I/O trên tệp hoặc thiết bị đích). Do đó, một chương trình sử dụng các system call này sẽ hoạt động trên bất kỳ loại tệp nào.

Kernel thực chất cung cấp một loại tệp duy nhất: một luồng byte tuần tự (sequential stream of bytes), mà trong trường hợp là các tệp đĩa, ổ đĩa và thiết bị băng từ, có thể được truy cập ngẫu nhiên (randomly accessed) bằng cách sử dụng system call `lseek()`.

Nhiều ứng dụng và thư viện diễn giải ký tự dòng mới (newline character - mã ASCII 10 thập phân, đôi khi còn được gọi là linefeed) là kết thúc một dòng văn bản và bắt đầu một dòng tiếp theo. Các hệ thống UNIX không có ký tự kết thúc tệp (end-of-file character); phần kết thúc của một tệp được phát hiện bởi một thao tác đọc (`read`) trả về không có dữ liệu.

## File descriptors (Bộ mô tả tệp)

Các system call (lời gọi hệ thống) I/O tham chiếu đến các tệp đang mở bằng một file descriptor (bộ mô tả tệp), vốn là một số nguyên không âm (thường có giá trị nhỏ). Một file descriptor thường được lấy thông qua lời gọi hàm `open()`, nhận đối số là một đường dẫn (pathname) chỉ định tệp mà trên đó các thao tác I/O sẽ được thực hiện.

Thông thường, một process (tiến trình) sẽ kế thừa ba file descriptor khi nó được khởi động bởi shell: descriptor 0 là standard input (đầu vào chuẩn), là tệp mà từ đó tiến trình nhận dữ liệu đầu vào; descriptor 1 là standard output (đầu ra chuẩn), là tệp mà tiến trình ghi dữ liệu đầu ra của mình vào đó; và descriptor 2 là standard error (lỗi chuẩn), là tệp mà tiến trình ghi các thông báo lỗi và thông báo về các điều kiện ngoại lệ hoặc bất thường. Trong một shell hoặc chương trình tương tác, ba descriptor này thường được kết nối với thiết bị đầu cuối (terminal). Trong thư viện stdio, các descriptor này tương ứng với các luồng tệp `stdin`, `stdout` và `stderr`.

## Thư viện stdio

Để thực hiện I/O trên tệp, các chương trình C thường sử dụng các hàm I/O có trong thư viện chuẩn của ngôn ngữ C. Tập hợp các hàm này, được gọi là thư viện stdio, bao gồm `fopen()`, `fclose()`, `scanf()`, `printf()`, `fgets()`, `fputs()`, v.v. Các hàm stdio được xây dựng phân tầng dựa trên các system call I/O (`open()`, `close()`, `read()`, `write()`, v.v.).

> [!NOTE]
> Chúng tôi giả định rằng bạn đọc đã quen thuộc với các hàm I/O chuẩn (stdio) của C và sẽ không đề cập chi tiết đến chúng trong cuốn sách này. Thông tin thêm về thư viện stdio có thể được tìm thấy trong [Kernighan & Ritchie, 1988], [Harbison & Steele, 2002], [Plauger, 1992], và [Stevens & Rago, 2005].

## 2.6 Chương trình

Các chương trình thường tồn tại ở hai dạng. Dạng thứ nhất là source code (mã nguồn), là văn bản có thể đọc được bằng con người, bao gồm một chuỗi các câu lệnh được viết bằng một ngôn ngữ lập trình như C. Để được thực thi, mã nguồn phải được chuyển đổi sang dạng thứ hai: các lệnh mã máy nhị phân mà máy tính có thể hiểu được. (Điều này tương phản với một script, vốn là một tệp văn bản chứa các lệnh được xử lý trực tiếp bởi một chương trình như shell hoặc bộ thông dịch lệnh khác). Hai ý nghĩa của thuật ngữ "chương trình" thường được coi là đồng nghĩa, vì bước biên dịch (compiling) và liên kết (linking) sẽ chuyển đổi mã nguồn thành mã máy nhị phân có ngữ nghĩa tương đương.

### Bộ lọc (Filters)

Bộ lọc là tên thường được dùng để chỉ một chương trình đọc dữ liệu đầu vào từ `stdin`, thực hiện một số phép biến đổi trên dữ liệu đó, và ghi dữ liệu đã được biến đổi ra `stdout`. Các ví dụ về bộ lọc bao gồm `cat`, `grep`, `tr`, `sort`, `wc`, `sed`, và `awk`.

## Đối số dòng lệnh (Command-line arguments)

Trong ngôn ngữ C, các chương trình có thể truy cập vào các command-line arguments (đối số dòng lệnh), là các từ được cung cấp trên dòng lệnh khi chương trình được chạy. Để truy cập các đối số dòng lệnh này, hàm `main()` của chương trình được khai báo như sau:

```c
int main(int argc, char *argv[])
```

Biến `argc` chứa tổng số lượng các đối số dòng lệnh, và các đối số riêng lẻ có thể được truy cập dưới dạng các chuỗi ký tự được trỏ tới bởi các phần tử của mảng `argv`. Chuỗi đầu tiên trong số này, `argv[0]`, định danh tên của chính chương trình đó.

## 2.7 Tiến trình (Processes)

Nói một cách đơn giản nhất, một process (tiến trình) là một thể hiện (instance) của một chương trình đang được thực thi. Khi một chương trình được thực thi, kernel (nhân) sẽ tải mã của chương trình vào virtual memory (bộ nhớ ảo), cấp phát không gian cho các biến của chương trình, và thiết lập các cấu trúc dữ liệu sổ sách kế toán của kernel để ghi lại các thông tin khác nhau (như process ID - định danh tiến trình, trạng thái kết thúc, user ID - định danh người dùng, và group ID - định danh nhóm) về tiến trình đó.

Từ góc độ của kernel, các tiến trình là các thực thể mà qua đó kernel phải chia sẻ các tài nguyên khác nhau của máy tính. Đối với các tài nguyên có giới hạn, chẳng hạn như bộ nhớ, ban đầu kernel cấp phát một lượng tài nguyên nhất định cho tiến trình, và điều chỉnh mức cấp phát này trong suốt vòng đời của tiến trình để đáp ứng nhu cầu của tiến trình đó cũng như nhu cầu chung của toàn hệ thống. Khi tiến trình kết thúc, tất cả các tài nguyên như vậy sẽ được giải phóng để các tiến trình khác có thể tái sử dụng. Các tài nguyên khác, chẳng hạn như CPU và băng thông mạng, có thể tái tạo nhưng phải được chia sẻ một cách công bằng giữa tất cả các tiến trình.

## Bố cục bộ nhớ tiến trình (Process memory layout)

Một tiến trình được chia về mặt logic thành các phần sau, được gọi là các phân đoạn (segments):

- Text (Mã chương trình): Các chỉ thị (instructions) của chương trình.
- Data (Dữ liệu): Các biến tĩnh (static variables) được sử dụng bởi chương trình.
- Heap (Vùng nhớ động): Một vùng mà từ đó các chương trình có thể cấp phát động thêm bộ nhớ.
- Stack (Vùng nhớ ngăn xếp): Một vùng bộ nhớ tăng và giảm kích thước khi các hàm được gọi và trả về, được dùng để cấp phát lưu trữ cho các biến cục bộ (local variables) và thông tin liên kết gọi hàm (function call linkage information).

## Tạo tiến trình và thực thi chương trình (Process creation and program execution)

Một tiến trình có thể tạo một tiến trình mới bằng cách sử dụng System Call `fork()`. Tiến trình gọi `fork()` được gọi là tiến trình cha (parent process), và tiến trình mới được gọi là tiến trình con (child process). Kernel tạo tiến trình con bằng cách tạo ra một bản sao của tiến trình cha. Tiến trình con kế thừa các bản sao từ các phân đoạn data, stack và heap của tiến trình cha, và sau đó nó có thể chỉnh sửa các phân đoạn này một cách độc lập với các bản sao của tiến trình cha. (Phần text của chương trình, được đặt trong bộ nhớ được đánh dấu là chỉ đọc - read-only, được chia sẻ bởi cả hai tiến trình).

Tiến trình con tiếp tục thực thi một tập hợp các hàm khác trong cùng mã nguồn với tiến trình cha, hoặc thường là sử dụng System Call `execve()` để nạp và thực thi một chương trình hoàn toàn mới. Một lời gọi `execve()` sẽ phá hủy các phân đoạn text, data, stack và heap hiện có, thay thế chúng bằng các phân đoạn mới dựa trên mã của chương trình mới.

Một số hàm thư viện C có liên quan được xây dựng tầng trên (layered on top of) `execve()`, mỗi hàm cung cấp một giao diện hơi khác nhau cho cùng một chức năng. Tất cả các hàm này đều có tên bắt đầu bằng chuỗi `exec`, và trong trường hợp sự khác biệt không quan trọng, chúng ta sẽ sử dụng ký hiệu `exec()` để chỉ chung các hàm này. Tuy nhiên, hãy lưu ý rằng không có hàm thực tế nào mang tên `exec()`.

Thông thường, chúng ta sẽ sử dụng động từ "to exec" để mô tả thao tác mà `execve()` và các hàm thư viện nằm trên nó thực hiện.

## Mã định danh tiến trình và mã định danh tiến trình cha (Process ID and parent process ID)

Mỗi tiến trình có một mã định danh tiến trình (process identifier - PID) dạng số nguyên duy nhất. Mỗi tiến trình cũng có một thuộc tính mã định danh tiến trình cha (parent process identifier - PPID), dùng để xác định tiến trình đã yêu cầu kernel tạo ra tiến trình này.

## Kết thúc tiến trình và trạng thái kết thúc (Process termination and termination status)

Một tiến trình có thể kết thúc theo một trong hai cách: bằng cách yêu cầu tự kết thúc sử dụng System Call `_exit()` (hoặc hàm thư viện `exit()` có liên quan), hoặc bằng cách bị tiêu diệt do nhận được một tín hiệu (signal). Trong cả hai trường hợp, tiến trình trả về một trạng thái kết thúc (termination status), một giá trị số nguyên không âm nhỏ mà tiến trình cha có thể kiểm tra bằng cách sử dụng System Call `wait()`. Trong trường hợp gọi `_exit()`, tiến trình chỉ định rõ ràng trạng thái kết thúc của chính nó. Nếu một tiến trình bị tiêu diệt bởi một tín hiệu, trạng thái kết thúc sẽ được thiết lập tương ứng với loại tín hiệu đã gây ra cái chết của tiến trình đó. (Đôi khi, chúng ta sẽ gọi đối số được truyền vào `_exit()` là trạng thái thoát - exit status của tiến trình, để phân biệt với trạng thái kết thúc - termination status, vốn là giá trị được truyền vào `_exit()` hoặc là một chỉ báo về tín hiệu đã tiêu diệt tiến trình).

Theo quy ước, trạng thái kết thúc bằng 0 cho biết tiến trình đã thành công và trạng thái khác 0 cho biết đã xảy ra lỗi nào đó. Hầu hết các shell đều cung cấp trạng thái kết thúc của chương trình được thực thi gần nhất thông qua một biến shell có tên là `$?`.

## Định danh người dùng và nhóm của tiến trình (Process user and group identifiers - credentials)

```

```

Mỗi tiến trình (process) có một số định danh người dùng (User ID - UID) và định danh nhóm (Group ID - GID) đi kèm. Các định danh này bao gồm:

- Định danh người dùng thực và định danh nhóm thực (Real user ID và real group ID): Các ID này xác định người dùng và nhóm mà tiến trình thuộc về. Một tiến trình mới kế thừa các ID này từ tiến trình cha (parent) của nó. Một shell đăng nhập (login shell) lấy ID người dùng thực và ID nhóm thực từ các trường tương ứng trong tệp mật khẩu của hệ thống.

- Định danh người dùng hiệu dụng và định danh nhóm hiệu dụng (Effective user ID và effective group ID): Hai ID này (kết hợp với các ID nhóm bổ sung được thảo luận ngay sau đây) được sử dụng để xác định các quyền mà tiến trình có khi truy cập vào các tài nguyên được bảo vệ như tệp và các đối tượng giao tiếp liên tiến trình (interprocess communication objects). Thông thường, các ID hiệu dụng của tiến trình có giá trị giống như các ID thực tương ứng. Việc thay đổi các ID hiệu dụng là một cơ chế cho phép một tiến trình giả định các đặc quyền của một người dùng hoặc nhóm khác, như sẽ được mô tả ngay sau đây.
- Định danh nhóm bổ sung (Supplementary group IDs): Các ID này xác định các nhóm bổ sung mà một tiến trình thuộc về. Một tiến trình mới kế thừa các ID nhóm bổ sung của nó từ tiến trình cha. Một shell đăng nhập lấy các ID nhóm bổ sung từ tệp nhóm của hệ thống.

## Tiến trình đặc quyền (Privileged processes)

Theo truyền thống, trên các hệ thống UNIX, một tiến trình đặc quyền (privileged process) là tiến trình có ID người dùng hiệu dụng là 0 (siêu người dùng - superuser). Một tiến trình như vậy sẽ bỏ qua các giới hạn quyền thường được áp dụng bởi kernel. Ngược lại, thuật ngữ không có đặc quyền (unprivileged hoặc nonprivileged) được áp dụng cho các tiến trình do những người dùng khác chạy. Các tiến trình này có ID người dùng hiệu dụng khác 0 và phải tuân theo các quy tắc phân quyền được thực thi bởi kernel.

Một tiến trình có thể có đặc quyền vì nó được tạo ra bởi một tiến trình đặc quyền khác — ví dụ, bởi một shell đăng nhập được khởi động bởi root (superuser). Một cách khác để một tiến trình trở thành tiến trình đặc quyền là thông qua cơ chế set-user-ID, cho phép một tiến trình nhận ID người dùng hiệu dụng giống với ID người dùng của tệp chương trình mà nó đang thực thi.

## Các khả năng (Capabilities)

Kể từ kernel 2.2, Linux chia các đặc quyền vốn được cấp cho siêu người dùng theo truyền thống thành một tập hợp các đơn vị riêng biệt được gọi là các khả năng (capabilities). Mỗi thao tác đặc quyền được liên kết với một khả năng cụ thể và một tiến trình chỉ có thể thực hiện một thao tác nếu nó có khả năng tương ứng. Một tiến trình siêu người dùng truyền thống (có ID người dùng hiệu dụng bằng 0) tương ứng với một tiến trình được bật tất cả các khả năng.

Việc cấp một tập hợp con các khả năng cho một tiến trình cho phép nó thực hiện một số thao tác thông thường chỉ cho phép đối với siêu người dùng, đồng thời ngăn cản nó thực hiện các thao tác khác.

Các khả năng được mô tả chi tiết trong Chương 39. Trong phần còn lại của cuốn sách, khi lưu ý rằng một thao tác cụ thể chỉ có thể được thực hiện bởi một tiến trình đặc quyền, chúng ta thường sẽ xác định khả năng cụ thể trong ngoặc đơn. Tên các khả năng bắt đầu bằng tiền tố `CAP_`, như trong `CAP_KILL`.

## Tiến trình init (The init process)

Khi khởi động hệ thống (booting the system), kernel tạo ra một tiến trình đặc biệt gọi là init, "tiến trình cha của mọi tiến trình", bắt nguồn từ tệp chương trình `/sbin/init`. Tất cả các tiến trình trên hệ thống đều được tạo (sử dụng `fork()`) hoặc bởi init hoặc bởi một trong các tiến trình hậu duệ của nó. Tiến trình init luôn có định danh tiến trình (Process ID - PID) bằng 1 và chạy với quyền siêu người dùng (superuser privileges). Tiến trình init không thể bị tiêu diệt (kể cả bởi siêu người dùng), và nó chỉ kết thúc khi hệ thống tắt nguồn (shut down). Nhiệm vụ chính của init là tạo và giám sát một loạt các tiến trình cần thiết cho một hệ thống đang chạy. (Để biết thêm chi tiết, xem trang hướng dẫn `init(8)` - manual page).

### Tiến trình nền (Daemon processes)

Daemon là một tiến trình chuyên dụng được hệ thống tạo và xử lý giống như các tiến trình khác, nhưng được phân biệt bởi các đặc điểm sau:

- Nó tồn tại lâu dài (long-lived). Một tiến trình daemon thường được khởi động khi hệ thống khởi động và tiếp tục tồn tại cho đến khi hệ thống tắt nguồn.
- Nó chạy ngầm (in the background) và không có terminal điều khiển (controlling terminal) để có thể đọc dữ liệu đầu vào hoặc ghi dữ liệu đầu ra.

Các ví dụ về tiến trình daemon bao gồm `syslogd`, ghi lại các thông điệp vào nhật ký hệ thống (system log), và `httpd`, phục vụ các trang web thông qua Giao thức truyền tải siêu văn bản (Hypertext Transfer Protocol - HTTP).

### Danh sách biến môi trường (Environment list)

Mỗi tiến trình có một danh sách biến môi trường (environment list), đây là một tập hợp các biến môi trường (environment variables) được duy trì trong vùng nhớ không gian người dùng (user-space memory) của tiến trình. Mỗi phần tử trong danh sách này bao gồm một tên và một giá trị tương ứng. Khi một tiến trình mới được tạo thông qua `fork()`, nó kế thừa một bản sao môi trường của tiến trình cha. Do đó, môi trường cung cấp một cơ chế để tiến trình cha truyền đạt thông tin cho tiến trình con. Khi một tiến trình thay thế chương trình mà nó đang chạy bằng cách sử dụng `exec()`, chương trình mới sẽ hoặc là kế thừa môi trường được sử dụng bởi chương trình cũ, hoặc nhận được một môi trường mới được chỉ định như một phần của lời gọi `exec()`.

Các biến môi trường được tạo bằng lệnh `export` trong hầu hết các shell (hoặc lệnh `setenv` trong C shell), như trong ví dụ sau:

### \$ **export MYVAR='Hello world'**

Bất cứ khi nào chúng tôi trình bày một bản ghi phiên làm việc shell (shell session log) hiển thị đầu vào và đầu ra tương tác, văn bản đầu vào luôn được in đậm. Đôi khi, chúng tôi đưa các chú thích vào bản ghi bằng chữ nghiêng, thêm các ghi chú về các lệnh đã nhập hoặc đầu ra được tạo ra.

Các chương trình C có thể truy cập môi trường bằng cách sử dụng một biến ngoại vi (`char **environ`), và các hàm thư viện khác nhau cho phép một tiến trình truy xuất và sửa đổi các giá trị trong môi trường của nó.

Các biến môi trường được sử dụng cho nhiều mục đích khác nhau. Ví dụ, shell định nghĩa và sử dụng một loạt các biến có thể được truy cập bởi các tập lệnh (scripts) và chương trình thực thi từ shell. Các biến này bao gồm biến `HOME`, chỉ định đường dẫn (pathname) của thư mục đăng nhập của người dùng, và biến `PATH`, chỉ định một danh sách các thư mục mà shell nên tìm kiếm khi tìm các chương trình tương ứng với các lệnh do người dùng nhập.

### Giới hạn tài nguyên (Resource limits)

Mỗi tiến trình tiêu thụ các tài nguyên, chẳng hạn như tệp đang mở (open files), bộ nhớ (memory) và thời gian CPU (CPU time). Sử dụng lời gọi hệ thống `setrlimit()` (system call), một tiến trình có thể thiết lập các giới hạn trên đối với mức tiêu thụ các tài nguyên khác nhau của nó. Mỗi giới hạn tài nguyên như vậy có hai giá trị đi kèm: giới hạn mềm (soft limit), giới hạn lượng tài nguyên mà tiến trình được phép tiêu thụ; và giới hạn cứng (hard limit), là mức trần cho giá trị mà giới hạn mềm có thể được điều chỉnh đến. Một tiến trình không có đặc quyền (unprivileged process) có thể thay đổi giới hạn mềm của nó đối với một tài nguyên cụ thể thành bất kỳ giá trị nào trong phạm vi từ 0 đến giới hạn cứng tương ứng, nhưng chỉ có thể hạ thấp giới hạn cứng của nó.

Khi một tiến trình mới được tạo bằng `fork()`, nó kế thừa các bản sao cài đặt giới hạn tài nguyên của tiến trình cha.

Các giới hạn tài nguyên của shell có thể được điều chỉnh bằng lệnh `ulimit` (`limit` trong C shell). Các cài đặt giới hạn này được kế thừa bởi các tiến trình con mà shell tạo ra để thực thi các lệnh.

## 2.8 Ánh xạ Bộ nhớ (Memory Mappings)

System call (lời gọi hệ thống) `mmap()` tạo ra một memory mapping (ánh xạ bộ nhớ) mới trong virtual address space (không gian địa chỉ ảo) của tiến trình gọi.

```

```

Các ánh xạ được chia thành hai loại:

- File mapping (ánh xạ tệp) ánh xạ một vùng của tệp vào bộ nhớ ảo của tiến trình gọi. Một khi đã được ánh xạ, nội dung của tệp có thể được truy cập thông qua các thao tác trên các byte trong vùng nhớ tương ứng. Các trang (page) của ánh xạ được tự động tải từ tệp khi cần thiết.
- Ngược lại, anonymous mapping (ánh xạ ẩn) không có tệp tương ứng. Thay vào đó, các trang của ánh xạ được khởi tạo bằng 0.

Bộ nhớ trong ánh xạ của một tiến trình có thể được chia sẻ với các ánh xạ ở các tiến trình khác. Điều này có thể xảy ra do hai tiến trình cùng ánh xạ một vùng của một tệp, hoặc do một tiến trình con được tạo bởi `fork()` kế thừa ánh xạ từ tiến trình cha của nó.

Khi hai hoặc nhiều tiến trình chia sẻ chung các trang bộ nhớ, mỗi tiến trình có thể nhìn thấy các thay đổi do các tiến trình khác thực hiện trên nội dung của các trang đó, tùy thuộc vào việc ánh xạ được tạo ở dạng private (riêng tư) hay shared (chia sẻ). Khi một ánh xạ là private, các chỉnh sửa đối với nội dung ánh xạ sẽ không hiển thị với các tiến trình khác và không được ghi xuống tệp cơ sở (underlying file). Khi một ánh xạ là shared, các chỉnh sửa đối với nội dung ánh xạ sẽ hiển thị với các tiến trình khác đang chia sẻ cùng ánh xạ đó và được ghi trực tiếp xuống tệp cơ sở.

Memory mapping phục vụ nhiều mục đích khác nhau, bao gồm việc khởi tạo text segment (đoạn mã văn bản) của tiến trình từ đoạn tương ứng của tệp thực thi, cấp phát bộ nhớ mới (đã được lấp đầy bằng số 0), I/O tệp (memory-mapped I/O), và interprocess communication (giao tiếp giữa các tiến trình - IPC thông qua ánh xạ chia sẻ).

## 2.9 Thư viện Tĩnh và Thư viện Động (Static and Shared Libraries)

Object library (thư viện đối tượng) là một tệp chứa mã đối tượng (object code) đã được biên soạn cho một tập hợp các hàm (thường có liên quan chặt chẽ về mặt logic) có thể được gọi từ các chương trình ứng dụng. Việc đặt mã cho một tập hợp các hàm vào trong một thư viện đối tượng duy nhất giúp đơn giản hóa các tác vụ tạo và bảo trì chương trình. Các hệ thống UNIX hiện đại cung cấp hai loại thư viện đối tượng: static libraries (thư viện tĩnh) và shared libraries (thư viện chia sẻ/động).

## Thư viện tĩnh (Static libraries)

Thư viện tĩnh (thỉnh thoảng còn được gọi là archive - kho lưu trữ) là loại thư viện duy nhất trên các hệ thống UNIX đời đầu. Thư viện tĩnh thực chất là một gói có cấu trúc chứa các object module (mô-đun đối tượng) đã biên dịch. Để sử dụng các hàm từ thư viện tĩnh, chúng ta chỉ định thư viện đó trong lệnh liên kết (link command) được dùng để xây dựng chương trình. Sau khi phân giải các tham chiếu hàm khác nhau từ chương trình chính đến các mô-đun trong thư viện tĩnh, linker (trình liên kết) sẽ trích xuất các bản sao của các object module cần thiết từ thư viện và sao chép chúng vào tệp thực thi kết quả. Chúng ta gọi một chương trình như vậy là statically linked (được liên kết tĩnh).

Việc mỗi chương trình liên kết tĩnh tự bao gồm bản sao các object module cần thiết từ thư viện tạo ra một số bất lợi. Một trong số đó là sự trùng lặp object code ở các tệp thực thi khác nhau gây lãng phí dung lượng đĩa. Sự lãng phí bộ nhớ tương ứng cũng xảy ra khi các chương trình liên kết tĩnh sử dụng cùng một hàm thư viện được chạy cùng một lúc; mỗi chương trình đều yêu cầu một bản sao riêng của hàm đó nằm trong bộ nhớ. Thêm vào đó, nếu một hàm thư viện cần được sửa đổi, thì sau khi biên dịch lại hàm đó và thêm nó vào thư viện tĩnh, tất cả các ứng dụng cần sử dụng hàm đã cập nhật này phải được liên kết lại (relink) với thư viện.

## Thư viện chia sẻ (Shared libraries)

Các thư viện chia sẻ (shared libraries) được thiết kế nhằm giải quyết các vấn đề của thư viện tĩnh (static libraries).

Nếu một chương trình được liên kết (linked) với một thư viện chia sẻ, thì thay vì sao chép các module đối tượng (object modules) từ thư viện vào tệp thực thi (executable), trình liên kết (linker) chỉ ghi một bản ghi vào tệp thực thi để chỉ ra rằng tại thời điểm chạy (run time), tệp thực thi cần sử dụng thư viện chia sẻ đó. Khi tệp thực thi được nạp vào bộ nhớ (memory) tại thời điểm chạy, một chương trình gọi là trình liên kết động (dynamic linker) sẽ đảm bảo rằng các thư viện chia sẻ mà tệp thực thi yêu cầu được tìm thấy và nạp vào bộ nhớ, đồng thời thực hiện liên kết thời gian chạy (run-time linking) để phân giải các lời gọi hàm (function calls) trong tệp thực thi thành các định nghĩa tương ứng trong thư viện chia sẻ. Tại thời điểm chạy, chỉ cần duy nhất một bản sao mã thực thi (code) của thư viện chia sẻ nằm thường trú trong bộ nhớ; tất cả các chương trình đang chạy đều có thể dùng chung bản sao đó.

```

```

Việc một thư viện chia sẻ chứa phiên bản đã biên dịch duy nhất của một hàm giúp tiết kiệm không gian đĩa (disk space). Nó cũng giúp đơn giản hóa đáng kể công việc đảm bảo rằng các chương trình sử dụng phiên bản mới nhất của một hàm. Việc xây dựng lại (rebuilding) thư viện chia sẻ với định nghĩa hàm mới sẽ khiến các chương trình hiện có tự động sử dụng định nghĩa mới trong lần thực thi tiếp theo của chúng.

## 2.10 Giao tiếp và Đồng bộ hóa Tiến trình (Interprocess Communication and Synchronization)

Một hệ thống Linux đang chạy bao gồm nhiều tiến trình (processes), phần lớn trong số đó hoạt động độc lập với nhau. Tuy nhiên, một số tiến trình cần hợp tác để đạt được các mục đích dự kiến của chúng, và các tiến trình này cần các phương thức để giao tiếp với nhau cũng như đồng bộ hóa các hành động của chúng.

Một cách để các tiến trình giao tiếp là đọc và ghi thông tin trong các tệp trên đĩa (disk files). Tuy nhiên, đối với nhiều ứng dụng, cách này quá chậm và kém linh hoạt. Do đó, Linux, giống như tất cả các hệ thống UNIX hiện đại, cung cấp một tập hợp phong phú các cơ chế giao tiếp giữa các tiến trình (Interprocess Communication - IPC), bao gồm:

- tín hiệu (signals), được sử dụng để thông báo rằng một sự kiện đã xảy ra;
- đường ống (pipes) (quen thuộc với người dùng shell qua toán tử `|`) và FIFO, có thể được sử dụng để truyền dữ liệu giữa các tiến trình;
- socket (sockets), có thể được sử dụng để truyền dữ liệu từ tiến trình này sang tiến trình khác, hoặc trên cùng một máy chủ (host computer) hoặc trên các máy chủ khác nhau được kết nối qua mạng;
- khóa tệp (file locking), cho phép một tiến trình khóa các vùng của một tệp nhằm ngăn các tiến trình khác đọc hoặc cập nhật nội dung tệp;
- hàng đợi thông điệp (message queues), được sử dụng để trao đổi thông điệp (các gói dữ liệu) giữa các tiến trình;
- semaphore (semaphores), được sử dụng để đồng bộ hóa các hành động giữa các tiến trình; và
- bộ nhớ chia sẻ (shared memory), cho phép hai hoặc nhiều tiến trình chia sẻ một vùng nhớ.

```

Khi một tiến trình thay đổi nội dung của vùng nhớ chia sẻ, tất cả các tiến trình khác có thể thấy ngay lập tức các thay đổi đó.

Sự đa dạng lớn của các cơ chế IPC trên hệ thống UNIX, đôi khi có chức năng chồng chéo nhau, một phần là do quá trình phát triển của chúng dưới các biến thể khác nhau của hệ thống UNIX và các yêu cầu từ nhiều tiêu chuẩn khác nhau. Ví dụ, FIFO và UNIX domain socket thực chất thực hiện cùng một chức năng là cho phép các tiến trình không liên quan trên cùng một hệ thống trao đổi dữ liệu. Cả hai đều tồn tại trong các hệ thống UNIX hiện đại vì FIFO xuất phát từ System V, trong khi socket xuất phát từ BSD.

## 2.11 Tín hiệu (Signals)

Mặc dù chúng tôi đã liệt kê chúng như một phương pháp IPC trong phần trước, tín hiệu thường được sử dụng trong một loạt các ngữ cảnh khác và do đó xứng đáng được thảo luận kỹ hơn.

Tín hiệu thường được mô tả là các "ngắt phần mềm" (software interrupts). Sự xuất hiện của một tín hiệu thông báo cho một tiến trình biết rằng một sự kiện hoặc điều kiện ngoại lệ nào đó đã xảy ra. Có nhiều loại tín hiệu khác nhau, mỗi loại xác định một sự kiện hoặc điều kiện khác nhau. Mỗi loại tín hiệu được định danh bằng một số nguyên khác nhau, được định nghĩa bằng các tên ký hiệu có dạng `SIGxxxx`.

Tín hiệu được gửi đến một tiến trình bởi kernel, bởi một tiến trình khác (với các quyền hạn phù hợp), hoặc bởi chính tiến trình đó. Ví dụ, kernel có thể gửi tín hiệu đến một tiến trình khi một trong các trường hợp sau xảy ra:

- người dùng gõ ký tự ngắt (thường là Control-C) trên bàn phím;
- một trong các tiến trình con (children) của tiến trình đã kết thúc;
- một bộ hẹn giờ (alarm clock) do tiến trình thiết lập đã hết hạn; hoặc
- tiến trình cố gắng truy cập vào một địa chỉ bộ nhớ không hợp lệ.

Trong shell, lệnh `kill` có thể được sử dụng để gửi tín hiệu đến một tiến trình. System Call `kill()` cung cấp tính năng tương tự bên trong các chương trình.

Khi một tiến trình nhận được một tín hiệu, nó sẽ thực hiện một trong các hành động sau, tùy thuộc vào loại tín hiệu:

- bỏ qua tín hiệu (ignores the signal);
- bị chấm dứt bởi tín hiệu (is killed by the signal); hoặc
- bị tạm dừng (suspended) cho đến khi được tiếp tục (resumed) thông qua việc nhận một tín hiệu chuyên dụng.

Đối với hầu hết các loại tín hiệu, thay vì chấp nhận hành động tín hiệu mặc định, một chương trình có thể chọn bỏ qua tín hiệu (hữu ích nếu hành động mặc định của tín hiệu không phải là bị bỏ qua), hoặc thiết lập một trình xử lý tín hiệu (signal handler). Trình xử lý tín hiệu là một hàm do lập trình viên định nghĩa được tự động gọi (invoked) khi tín hiệu được chuyển đến tiến trình. Hàm này thực hiện một hành động phù hợp với điều kiện đã sinh ra tín hiệu đó.

Trong khoảng thời gian từ khi được tạo ra cho đến khi được gửi đi, một signal (tín hiệu) được coi là pending (chờ xử lý) đối với một process (tiến trình). Thông thường, một pending signal sẽ được gửi đi ngay khi process nhận signal được lên lịch chạy tiếp theo, hoặc ngay lập tức nếu process đó đang chạy. Tuy nhiên, cũng có thể block (chặn) một signal bằng cách thêm nó vào signal mask (mặt nạ tín hiệu) của process. Nếu một signal được tạo ra trong khi nó đang bị block, nó sẽ ở trạng thái pending cho đến khi được unblock (bỏ chặn) sau đó (tức là được loại khỏi signal mask).

## 2.12 Threads (Luồng)

Trong các cài đặt UNIX hiện đại, mỗi process có thể có nhiều threads of execution (luồng thực thi). Một cách để hình dung về các thread là một tập hợp các process cùng chia sẻ virtual memory (bộ nhớ ảo) giống nhau, cũng như một loạt các thuộc tính khác. Mỗi thread thực thi cùng một đoạn mã chương trình và chia sẻ chung vùng dữ liệu (data area) và heap. Tuy nhiên, mỗi thread có stack riêng chứa các biến cục bộ (local variables) và thông tin liên kết lệnh gọi hàm (function call linkage information).

Các thread có thể giao tiếp với nhau thông qua các biến toàn cục (global variables) mà chúng chia sẻ. Threading API cung cấp các biến điều kiện (condition variables) và mutex, đây là các primitive (nguyên thủy đồng bộ) cho phép các thread của một process giao tiếp và đồng bộ hóa các hành động của chúng, cụ thể là việc sử dụng các biến được chia sẻ. Các thread cũng có thể giao tiếp với nhau bằng cách sử dụng các cơ chế IPC và đồng bộ hóa được mô tả trong [Mục 2.10.](#page-15-0)

Ưu điểm chính của việc sử dụng thread là chúng giúp dễ dàng chia sẻ dữ liệu (thông qua các biến toàn cục) giữa các thread cộng tác và một số thuật toán thích hợp tự nhiên hơn với việc cài đặt đa luồng (multithreaded) so với cài đặt đa tiến trình (multiprocess). Hơn nữa, một ứng dụng đa luồng có thể tận dụng một cách trong suốt (transparently) các khả năng xử lý song song trên phần cứng đa vi xử lý (multiprocessor).

## 2.13 Process Groups và Quản lý Job của Shell

Mỗi chương trình được thực thi bởi shell đều được khởi chạy trong một tiến trình (process) mới.

```

Ví dụ, shell tạo ra ba process để thực thi chuỗi lệnh pipeline sau (hiển thị danh sách các file trong thư mục làm việc hiện tại được sắp xếp theo kích thước file):

\$ **ls -l | sort -k5n | less**

Tất cả các shell chính, ngoại trừ Bourne shell, đều cung cấp một tính năng tương tác gọi là job control (quản lý job), cho phép người dùng đồng thời thực thi và thao tác với nhiều lệnh hoặc pipeline. Trong các shell hỗ trợ job-control, tất cả các process trong một pipeline được đặt vào một process group (nhóm tiến trình) hoặc job mới. (Trong trường hợp đơn giản của một dòng lệnh shell chứa một lệnh duy nhất, một process group mới chỉ chứa một process duy nhất sẽ được tạo ra). Mỗi process trong một process group có cùng một định danh số nguyên là process group identifier (ID nhóm tiến trình), trùng với ID của một trong các process thuộc nhóm đó, được gọi là process group leader (trưởng nhóm tiến trình).

Kernel cho phép thực hiện các hành động khác nhau, đáng chú ý nhất là việc gửi signal, cho tất cả các thành viên của một process group. Các shell hỗ trợ job-control sử dụng tính năng này để cho phép người dùng tạm dừng (suspend) hoặc tiếp tục (resume) tất cả các process trong một pipeline, như được mô tả trong phần tiếp theo.

## 2.14 Phiên, Terminal điều khiển và Tiến trình điều khiển (Sessions, Controlling Terminals, and Controlling Processes)

```

```

Một session (phiên làm việc) là một tập hợp các process group (nhóm tiến trình hay công việc - jobs). Tất cả các tiến trình trong một session đều có chung một session identifier (định danh phiên làm việc - session ID). Session leader (tiến trình lãnh đạo phiên) là tiến trình đã tạo ra session đó và process ID của nó sẽ trở thành session ID.

Sessions chủ yếu được sử dụng bởi các shell điều khiển công việc (job-control shell). Tất cả các process group được tạo bởi một job-control shell đều thuộc cùng một session với shell đó, và shell chính là session leader.

Sessions thường có một controlling terminal (terminal điều khiển) đi kèm. Controlling terminal được thiết lập khi tiến trình session leader mở một thiết bị terminal lần đầu tiên. Đối với một session được tạo bởi một shell tương tác (interactive shell), đây chính là terminal mà người dùng đã đăng nhập. Một terminal có thể là controlling terminal của tối đa một session.

Là hệ quả của việc mở controlling terminal, session leader trở thành controlling process (tiến trình điều khiển) cho terminal đó. Controlling process sẽ nhận được một tín hiệu `SIGHUP` nếu xảy ra sự cố ngắt kết nối terminal (ví dụ: khi cửa sổ terminal bị đóng).

Tại bất kỳ thời điểm nào, có một process group trong session đóng vai trò là foreground process group (nhóm tiến trình tiền cảnh - công việc tiền cảnh), có quyền đọc đầu vào từ terminal và gửi đầu ra tới đó. Nếu người dùng gõ ký tự ngắt (thường là Control-C) hoặc ký tự tạm dừng (thường là Control-Z) trên controlling terminal, thì trình điều khiển terminal (terminal driver) sẽ gửi một tín hiệu để tiêu diệt hoặc tạm dừng (tức là dừng hẳn) foreground process group. Một session có thể có bất kỳ số lượng background process group (nhóm tiến trình hậu cảnh - công việc hậu cảnh) nào, được tạo ra bằng cách kết thúc một lệnh với ký tự và (`&`).

Các job-control shell cung cấp các lệnh để liệt kê tất cả các công việc, gửi tín hiệu đến các công việc, và chuyển đổi các công việc giữa tiền cảnh và hậu cảnh.

## 2.15 Thiết bị đầu cuối giả lập (Pseudoterminals)

```

```

Pseudoterminal (terminal giả) là một cặp thiết bị ảo được kết nối với nhau, được gọi là master (thiết bị chính) và slave (thiết bị phụ). Cặp thiết bị này cung cấp một kênh IPC (Inter-Process Communication) cho phép truyền dữ liệu theo cả hai chiều giữa hai thiết bị.

Điểm mấu chốt của một pseudoterminal là thiết bị slave cung cấp một giao diện hoạt động giống như một terminal thực thụ, giúp cho việc kết nối một chương trình hướng-terminal (terminal-oriented program) với thiết bị slave trở nên khả thi. Sau đó, người ta có thể sử dụng một chương trình khác kết nối với thiết bị master để điều khiển chương trình hướng-terminal đó. Đầu ra được ghi bởi chương trình điều khiển (driver program) sẽ trải qua quá trình xử lý đầu vào thông thường do terminal driver thực hiện (ví dụ: ở chế độ mặc định, ký tự xuống dòng carriage return được ánh xạ thành newline) và sau đó được chuyển thành đầu vào cho chương trình hướng-terminal được kết nối với slave. Bất kỳ thứ gì mà chương trình hướng-terminal ghi vào slave đều được chuyển (sau khi thực hiện tất cả các bước xử lý đầu ra terminal thông thường) thành đầu vào cho chương trình điều khiển. Nói cách khác, chương trình điều khiển đang thực hiện chức năng mà thông thường do người dùng thực hiện tại một terminal thông thường.

Pseudoterminals được sử dụng trong nhiều ứng dụng khác nhau, nổi bật nhất là trong việc hiện thực hóa các cửa sổ terminal được cung cấp trong phiên đăng nhập X Window System và trong các ứng dụng cung cấp dịch vụ đăng nhập qua mạng, chẳng hạn như `telnet` và `ssh`.

## 2.16 Ngày và Giờ (Date and Time)

Có hai loại thời gian mà một tiến trình (process) quan tâm:

- Thời gian thực (Real time) được đo lường hoặc từ một mốc tiêu chuẩn nào đó (thời gian lịch - calendar time) hoặc từ một mốc cố định trong vòng đời của một tiến trình, thường là thời điểm bắt đầu (thời gian đã trôi qua hoặc thời gian đồng hồ tường - elapsed or wall clock time). Trên các hệ thống UNIX, thời gian lịch được tính bằng số giây kể từ nửa đêm ngày 1 tháng 1 năm 1970 theo giờ Phối hợp Quốc tế (Universal Coordinated Time, thường được viết tắt là UTC), và được điều phối dựa trên điểm mốc cho các múi giờ được xác định bởi đường kinh tuyến đi qua Greenwich, Anh. Ngày này, vốn gần với thời điểm ra đời của hệ thống UNIX, được gọi là Kỷ nguyên (Epoch).
- Thời gian tiến trình (Process time), còn được gọi là thời gian CPU (CPU time), là tổng lượng thời gian CPU mà một tiến trình đã sử dụng kể từ khi bắt đầu. Thời gian CPU lại được chia thành thời gian CPU hệ thống (system CPU time) – khoảng thời gian thực thi mã lệnh ở chế độ nhân (kernel mode) (tức là thực hiện các System Call và thực hiện các dịch vụ nhân khác thay mặt cho tiến trình), và thời gian CPU người dùng (user CPU time) – khoảng thời gian thực thi mã lệnh ở chế độ người dùng (user mode) (tức là thực thi mã chương trình thông thường).

Lệnh `time` hiển thị thời gian thực, thời gian CPU hệ thống và thời gian CPU người dùng cần thiết để thực thi các tiến trình trong một đường ống (pipeline).

## 2.17 Kiến trúc Client-Server (Client-Server Architecture)

```

Tại nhiều thời điểm khác nhau trong cuốn sách này, chúng ta thảo luận về thiết kế và việc hiện thực hóa các ứng dụng client-server.

Một ứng dụng client-server là ứng dụng được chia thành hai tiến trình thành phần:

- một client (máy khách), yêu cầu server thực hiện một dịch vụ nào đó bằng cách gửi cho nó một thông điệp yêu cầu (request message); và
- một server (máy chủ), kiểm tra yêu cầu của client, thực hiện các hành động thích hợp, sau đó gửi một thông điệp phản hồi (response message) trở lại cho client.

Đôi khi, client và server có thể tham gia vào một cuộc đối thoại kéo dài gồm các yêu cầu và phản hồi.

Thông thường, ứng dụng client tương tác với người dùng, trong khi ứng dụng server cung cấp quyền truy cập vào một tài nguyên được chia sẻ nào đó. Phổ biến là có nhiều thể hiện (instance) của các tiến trình client giao tiếp với một hoặc một vài thể hiện của tiến trình server.

Client và server có thể cư trú trên cùng một máy tính chủ (host computer) hoặc trên các host riêng biệt được kết nối qua mạng (network). Để giao tiếp với nhau, client và server sử dụng các cơ chế IPC đã được thảo luận trong [Mục 2.10](#page-15-0).

Các server có thể hiện thực hóa nhiều dịch vụ khác nhau, chẳng hạn như:

- cung cấp quyền truy cập vào cơ sở dữ liệu hoặc tài nguyên thông tin được chia sẻ khác;
- cung cấp quyền truy cập vào một tập tin từ xa qua mạng;
- đóng gói một số logic nghiệp vụ (business logic);
- cung cấp quyền truy cập vào tài nguyên phần cứng được chia sẻ (ví dụ: máy in); hoặc
- phục vụ các trang web (web pages).

Việc đóng gói một dịch vụ bên trong một server duy nhất hữu ích vì nhiều lý do, chẳng hạn như:

- Hiệu quả (Efficiency): Việc cung cấp một thể hiện của tài nguyên (ví dụ: máy in) được quản lý bởi một server có thể tiết kiệm chi phí hơn so với việc cung cấp cùng tài nguyên đó cục bộ trên mọi máy tính.
- Kiểm soát, điều phối và bảo mật (Control, coordination, and security): Bằng cách giữ một tài nguyên (đặc biệt là tài nguyên thông tin) tại một vị trí duy nhất, server có thể điều phối quyền truy cập vào tài nguyên đó (ví dụ: để hai client không cùng lúc cập nhật một mẩu thông tin) hoặc bảo mật nó để chỉ cung cấp cho các client được chọn.
- Hoạt động trong môi trường dị thể (Operation in a heterogeneous environment): Trong một mạng, các client khác nhau và server có thể chạy trên các nền tảng phần cứng và hệ điều hành khác nhau.

## 2.18 Thời gian thực (Realtime)

Các ứng dụng thời gian thực (realtime applications) là những ứng dụng cần phản hồi đầu vào một cách kịp thời. Thường thì các đầu vào này đến từ một cảm biến ngoài hoặc một thiết bị đầu vào chuyên dụng, và đầu ra có dạng điều khiển một số phần cứng bên ngoài. Ví dụ về các ứng dụng có yêu cầu phản hồi thời gian thực bao gồm dây chuyền lắp ráp tự động, máy rút tiền tự động (ATM) của ngân hàng, và các hệ thống định vị hàng không.

Mặc dù nhiều ứng dụng thời gian thực yêu cầu phản hồi nhanh chóng đối với đầu vào, yếu tố quyết định là phản hồi được đảm bảo phải hoàn thành trong một khoảng thời gian giới hạn (deadline) sau sự kiện kích hoạt.

Việc cung cấp khả năng đáp ứng thời gian thực (realtime responsiveness), đặc biệt là nơi yêu cầu thời gian phản hồi ngắn, đòi hỏi sự hỗ trợ từ hệ điều hành nền tảng (underlying operating system). Hầu hết các hệ điều hành không cung cấp sẵn hỗ trợ này vì các yêu cầu về khả năng đáp ứng thời gian thực có thể mâu thuẫn với các yêu cầu của hệ điều hành chia sẻ thời gian đa người dùng (multiuser timesharing operating systems). Các cài đặt UNIX truyền thống không phải là hệ điều hành thời gian thực (realtime operating systems), mặc dù các biến thể thời gian thực đã được thiết kế. Các biến thể thời gian thực của Linux cũng đã được tạo ra, và các nhân Linux gần đây đang hướng tới việc hỗ trợ nguyên bản đầy đủ (full native support) cho các ứng dụng thời gian thực.

POSIX.1b đã định nghĩa một số phần mở rộng cho POSIX.1 để hỗ trợ các ứng dụng thời gian thực. Chúng bao gồm I/O bất đồng bộ (asynchronous I/O), bộ nhớ chia sẻ (shared memory), các tệp được ánh xạ bộ nhớ (memory-mapped files), khóa bộ nhớ (memory locking), đồng hồ và bộ định thời gian thực (realtime clocks and timers), các chính sách lập lịch thay thế (alternative scheduling policies), tín hiệu thời gian thực (realtime signals), hàng đợi thông điệp (message queues), và semaphore (semaphores). Mặc dù chúng không hoàn toàn đủ điều kiện là thời gian thực theo nghĩa nghiêm ngặt, hầu hết các hệ thống UNIX hiện nay đều hỗ trợ một phần hoặc toàn bộ các phần mở rộng này. (Trong xuyên suốt cuốn sách này, chúng tôi mô tả các tính năng của POSIX.1b được hỗ trợ bởi Linux).

> Trong cuốn sách này, chúng tôi sử dụng thuật ngữ "real time" (thời gian thực) để chỉ khái niệm thời gian lịch hoặc thời gian trôi qua, và thuật ngữ "realtime" (thời gian thực) để chỉ một hệ điều hành hoặc ứng dụng cung cấp loại khả năng đáp ứng được mô tả trong phần này.

## 2.19 Hệ thống tệp /proc (The /proc File System)

Giống như một số hệ thống cài đặt UNIX khác, Linux cung cấp hệ thống tệp `/proc`, bao gồm một tập hợp các thư mục và tệp được gắn kết (mounted) dưới thư mục `/proc`.

Hệ thống tệp `/proc` là một hệ thống tệp ảo (virtual file system) cung cấp giao diện đến các cấu trúc dữ liệu của kernel dưới dạng trông giống như các tệp và thư mục trên một hệ thống tệp. Điều này cung cấp một cơ chế dễ dàng để xem và thay đổi các thuộc tính khác nhau của hệ thống. Ngoài ra, một tập hợp các thư mục có tên dạng `/proc/PID`, trong đó PID là ID của tiến trình (process ID), cho phép chúng ta xem thông tin về từng tiến trình đang chạy trên hệ thống.

Nội dung của các tệp `/proc` thường ở dạng văn bản con người có thể đọc được (human-readable text form) và có thể được phân tích cú pháp (parsed) bởi các shell script. Một chương trình có thể đơn giản là mở và đọc từ, hoặc ghi vào, tệp mong muốn. Trong hầu hết các trường hợp, một tiến trình phải có đặc quyền (privileged) để sửa đổi nội dung của các tệp trong thư mục `/proc`.

Khi chúng tôi mô tả các phần khác nhau của giao diện lập trình Linux, chúng tôi cũng sẽ mô tả các tệp `/proc` có liên quan. Mục 12.1 cung cấp thêm thông tin chung về hệ thống tệp này. Hệ thống tệp `/proc` không được quy định bởi bất kỳ tiêu chuẩn nào, và các chi tiết mà chúng tôi mô tả là mang tính đặc trưng của Linux (Linux-specific).

## 2.20 Tóm tắt

Trong chương này, chúng ta đã khảo sát một loạt các khái niệm cơ bản liên quan đến lập trình hệ thống Linux (Linux system programming). Việc thấu hiểu các khái niệm này sẽ cung cấp cho những độc giả có ít kinh nghiệm về Linux hoặc UNIX nền tảng đầy đủ để bắt đầu học tập lập trình hệ thống.
