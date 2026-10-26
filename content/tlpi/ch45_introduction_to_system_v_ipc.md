# Chương 45: GIỚI THIỆU VỀ SYSTEM V IPC

System V IPC là nhãn được dùng để chỉ ba cơ chế khác nhau dành cho giao tiếp giữa các tiến trình (Interprocess Communication - IPC):

- Hàng đợi thông điệp (Message Queues) có thể được sử dụng để truyền các thông điệp giữa các tiến trình (Process). Hàng đợi thông điệp có nét tương tự như các đường ống (Pipes), nhưng khác biệt ở hai điểm quan trọng. Thứ nhất, ranh giới thông điệp được giữ nguyên, do đó bộ đọc (reader) và bộ ghi (writer) giao tiếp với nhau theo từng đơn vị thông điệp, thay vì qua một luồng byte (byte stream) không phân định. Thứ hai, mỗi thông điệp bao gồm một trường kiểu số nguyên (integer type field), và người ta có thể chọn các thông điệp theo kiểu thay vì đọc chúng theo thứ tự mà chúng được ghi vào.
- Semaphore cho phép nhiều tiến trình đồng bộ hóa các hành động của chúng. Semaphore là một giá trị số nguyên do kernel duy trì (kernel-maintained integer value) và có thể nhìn thấy được đối với tất cả các tiến trình có quyền cần thiết. Một tiến trình thông báo cho các tiến trình đồng cấp (peers) của nó rằng nó đang thực hiện một hành động nào đó bằng cách sửa đổi phù hợp giá trị của semaphore.
- Bộ nhớ chia sẻ (Shared Memory) cho phép nhiều tiến trình chia sẻ cùng một vùng (được gọi là một phân đoạn - segment) bộ nhớ (nghĩa là, cùng các khung trang - page frames được ánh xạ vào bộ nhớ ảo - virtual memory của nhiều tiến trình). Vì quyền truy cập vào bộ nhớ không gian người dùng (user-space memory) là một thao tác nhanh, bộ nhớ chia sẻ là một trong những phương pháp IPC nhanh nhất: một khi một tiến trình đã cập nhật bộ nhớ chia sẻ, thay đổi đó sẽ ngay lập tức hiển thị với các tiến trình khác đang chia sẻ cùng phân đoạn đó.

Mặc dù ba cơ chế IPC này khá khác biệt về chức năng, nhưng có những lý do chính đáng để thảo luận về chúng cùng nhau. Một lý do là chúng được phát triển cùng nhau, lần đầu tiên xuất hiện vào cuối những năm 1970 trong Columbus UNIX. Đây là một bản cài đặt UNIX nội bộ của Bell được sử dụng cho các hệ thống cơ sở dữ liệu và xử lý giao dịch nhằm ghi chép và quản lý của công ty điện thoại. Khoảng năm 1983, các cơ chế IPC này đã đi vào UNIX dòng chính bằng cách xuất hiện trong System V, do đó có tên gọi là System V IPC.

Một lý do quan trọng hơn để thảo luận về các cơ chế System V IPC cùng nhau là các giao diện lập trình (programming interfaces) của chúng có chung một số đặc điểm, do đó nhiều khái niệm tương tự áp dụng cho tất cả các cơ chế này.

> Do System V IPC được SUSv3 yêu cầu để tuân thủ XSI, nên đôi khi nó còn được gọi thay thế là XSI IPC.

Chương này cung cấp cái nhìn tổng quan về các cơ chế System V IPC và trình bày chi tiết các tính năng chung cho cả ba cơ chế. Ba cơ chế này sau đó sẽ được thảo luận riêng lẻ trong các chương tiếp theo.

System V IPC là một tùy chọn của kernel (kernel option) được cấu hình thông qua tùy chọn `CONFIG_SYSVIPC`.

## 45.1 Tổng quan về API

Bảng 45-1 tóm tắt các tệp tiêu đề (header file) và System Call được sử dụng để làm việc với các đối tượng System V IPC.

Một số triển khai yêu cầu phải bao gồm (include) tệp `<sys/types.h>` trước khi bao gồm các tệp tiêu đề được hiển thị trong Bảng 45-1. Một số hệ thống UNIX cũ hơn cũng có thể yêu cầu bao gồm `<sys/ipc.h>`. (Không có phiên bản nào của Single UNIX Specification yêu cầu các tệp tiêu đề này).

> Trên hầu hết các kiến trúc phần cứng mà Linux hỗ trợ, một System Call duy nhất (`ipc(2)`) đóng vai trò là điểm vào (entry point) của Kernel (Kernel Space) cho tất cả các thao tác System V IPC, và tất cả các lời gọi được liệt kê trong Bảng 45-1 thực chất được triển khai như các hàm thư viện nằm chồng lên trên System Call này. (Hai ngoại lệ cho cơ chế này là Alpha và IA-64, nơi các hàm được liệt kê trong bảng thực sự được triển khai dưới dạng các System Call riêng lẻ). Cách tiếp cận có phần bất thường này là một hệ quả từ việc triển khai ban đầu của System V IPC dưới dạng một module Kernel có thể tải (loadable kernel module). Mặc dù thực chất chúng là các hàm thư viện trên hầu hết các kiến trúc Linux, nhưng xuyên suốt chương này, chúng ta sẽ gọi các hàm trong Bảng 45-1 là các System Call. Chỉ những nhà phát triển thư viện C mới cần sử dụng `ipc(2)`; bất kỳ việc sử dụng nào khác trong ứng dụng đều không có tính di-port (portable).

**Bảng 45-1:** Tóm tắt các giao diện lập trình cho các đối tượng System V IPC

| Giao diện                 | Hàng đợi thông điệp (Message queues)            | Semaphore                        | Bộ nhớ chia sẻ (Shared memory)    |
|---------------------------|-------------------------------------------------|----------------------------------|-----------------------------------|
| Tệp tiêu đề               | `<sys/msg.h>`                                   | `<sys/sem.h>`                    | `<sys/shm.h>`                     |
| Cấu trúc dữ liệu đi kèm   | `msqid_ds`                                      | `semid_ds`                       | `shmid_ds`                        |
| Tạo/mở đối tượng          | `msgget()`                                      | `semget()`                       | `shmget() + shmat()`              |
| Đóng đối tượng            | (không có)                                      | (không có)                       | `shmdt()`                         |
| Thao tác điều khiển       | `msgctl()`                                      | `semctl()`                       | `shmctl()`                        |
| Thực hiện IPC             | `msgsnd()`—ghi thông điệp<br>`msgrcv()`—đọc thông điệp | `semop()`—kiểm tra/điều chỉnh semaphore | truy cập bộ nhớ trong<br>vùng chia sẻ |

## Tạo và mở một đối tượng System V IPC

Mỗi cơ chế System V IPC đều có một system call (lời gọi hệ thống) tương ứng để khởi tạo (msgget(), semget(), hoặc shmget()), tương tự như system call open() được sử dụng cho các tệp (file). Với một khóa số nguyên (key) cho trước (tương tự như một tên tệp), lời gọi get sẽ thực hiện một trong hai việc:

- tạo một đối tượng IPC mới với khóa đã cho và trả về một định danh (identifier) duy nhất cho đối tượng đó; hoặc
- trả về định danh của một đối tượng IPC đã tồn tại với khóa đã cho.

Chúng ta sẽ gọi (một cách tương đối) trường hợp thứ hai là mở một đối tượng IPC đã tồn tại. Trong trường hợp này, tất cả những gì mà lời gọi get thực hiện chỉ là chuyển đổi một số này (khóa) thành một số khác (định danh).

> Trong bối cảnh của System V IPC, từ "đối tượng" (object) không mang bất kỳ hàm ý nào liên quan đến lập trình hướng đối tượng (object-oriented programming). Thuật ngữ này đơn thuần dùng để phân biệt các cơ chế System V IPC với các tệp. Mặc dù có một số điểm tương đồng giữa các tệp và đối tượng System V IPC, nhưng việc sử dụng các đối tượng IPC có những điểm khác biệt quan trọng so với mô hình I/O tệp chuẩn của UNIX, và đây là nguồn gốc gây ra một số phức tạp khi sử dụng các cơ chế System V IPC.

Một định danh IPC (IPC identifier) tương tự như một bộ mô tả tệp (file descriptor) ở chỗ nó được sử dụng trong tất cả các system call tiếp theo để tham chiếu đến đối tượng IPC. Tuy nhiên, có một sự khác biệt quan trọng về mặt ngữ nghĩa. Trong khi file descriptor là một thuộc tính của tiến trình (process attribute), thì định danh IPC lại là một thuộc tính của chính đối tượng đó và có phạm vi hiển thị toàn hệ thống (system-wide). Tất cả các tiến trình truy cập vào cùng một đối tượng đều sử dụng chung một định danh. Điều này có nghĩa là nếu chúng ta biết một đối tượng IPC đã tồn tại, chúng ta có thể bỏ qua lời gọi get, miễn là chúng ta có một cách khác để biết được định danh của đối tượng đó. Ví dụ, tiến trình tạo ra đối tượng có thể ghi định danh vào một tệp mà các tiến trình khác có thể đọc sau đó.

Ví dụ sau đây cho thấy cách tạo một hàng đợi thông điệp (message queue) System V:

```c
id = msgget(key, IPC_CREAT | S_IRUSR | S_IWUSR);
if (id == -1)
 errExit("msgget");
```

Giống như tất cả các lời gọi get, khóa (key) là đối số đầu tiên và định danh được trả về như một kết quả của hàm. Chúng ta chỉ định các quyền (permissions) sẽ được gán cho đối tượng mới như một phần của đối số cuối cùng (flags) trong lời gọi get, sử dụng các hằng số mặt nạ bit (bit-mask constants) giống như được dùng cho các tệp (Bảng 15-4, trang 295). Trong ví dụ trên, quyền chỉ được cấp cho chủ sở hữu (owner) của đối tượng để đọc và ghi thông điệp trên hàng đợi.

Mặt nạ umask của tiến trình (Phần 15.4.6) không được áp dụng lên các quyền được gán cho một đối tượng IPC mới được tạo.

> Một số bản cài đặt UNIX định nghĩa các hằng số mặt nạ bit sau cho quyền IPC: MSG\_R, MSG\_W, SEM\_R, SEM\_A, SHM\_R, và SHM\_W. Chúng tương ứng với quyền đọc và ghi của chủ sở hữu (người dùng) cho từng cơ chế IPC. Để lấy các mặt nạ bit quyền của nhóm (group) và người khác (other) tương ứng, các hằng số này có thể được dịch phải 3 và 6 bit. Những hằng số này không được quy định bởi chuẩn SUSv3 (vốn sử dụng các mặt nạ bit giống như được dùng cho tệp) và không được định nghĩa trong các tệp tiêu đề (header files) của glibc.

Mỗi tiến trình muốn truy cập vào cùng một đối tượng IPC sẽ thực hiện một lời gọi get, chỉ định cùng một khóa để thu được cùng một định danh cho đối tượng đó. Chúng ta sẽ xem xét cách chọn một khóa cho ứng dụng ở Phần [45.2.](#page-48-0)

Nếu không có đối tượng IPC nào tương ứng với khóa đã cho hiện đang tồn tại, và cờ IPC\_CREAT (tương tự như cờ O\_CREAT của open()) được chỉ định như một phần của đối số flags, thì lời gọi get sẽ tạo một đối tượng IPC mới. Nếu không có đối tượng IPC tương ứng nào hiện đang tồn tại và IPC\_CREAT không được chỉ định (và khóa không được chỉ định là IPC\_PRIVATE, được mô tả ở Phần [45.2](#page-48-0)), thì lời gọi get sẽ thất bại với mã lỗi ENOENT.

Một tiến trình có thể đảm bảo rằng nó là tiến trình duy nhất tạo ra một đối tượng IPC bằng cách chỉ định cờ IPC\_EXCL (tương tự như cờ O\_EXCL của open()). Nếu IPC\_EXCL được chỉ định và đối tượng IPC tương ứng với khóa đã cho đã tồn tại, thì lời gọi get sẽ thất bại với mã lỗi EEXIST.

## Xóa đối tượng IPC và tính bền bỉ của đối tượng

System call `ctl` (`msgctl()`, `semctl()`, `shmctl()`) cho mỗi cơ chế System V IPC thực hiện một loạt các thao tác điều khiển (control operations) đối với đối tượng. Nhiều thao tác trong số này đặc trưng cho cơ chế IPC, nhưng một số ít mang tính tổng quát cho tất cả các cơ chế IPC. Một ví dụ về thao tác điều khiển tổng quát là `IPC_RMID`, được sử dụng để xóa một đối tượng. Ví dụ, chúng ta có thể sử dụng lời gọi sau để xóa một đối tượng bộ nhớ chia sẻ (shared memory object):

```c
if (shmctl(id, IPC_RMID, NULL) == -1)
 errExit("shmctl");
```

Đối với hàng đợi thông điệp (message queues) và semaphore, việc xóa đối tượng IPC diễn ra ngay lập tức và mọi thông tin chứa bên trong đối tượng đó sẽ bị hủy, bất kể có tiến trình (process) nào khác vẫn đang sử dụng đối tượng hay không. (Đây là một trong số những điểm mà hoạt động của các đối tượng System V IPC không tương tự như các tập tin. Tại Mục 18.3, chúng ta đã thấy rằng nếu chúng ta xóa liên kết cuối cùng đến một tập tin, thì tập tin đó thực sự chỉ bị xóa sau khi tất cả các File Descriptor (mô tả tập tin) mở tham chiếu đến nó đã được đóng lại).

Việc xóa các đối tượng bộ nhớ chia sẻ diễn ra theo một cách khác. Sau lời gọi `shmctl(id, IPC_RMID, NULL)`, phân đoạn bộ nhớ chia sẻ (shared memory segment) chỉ bị xóa sau khi tất cả các tiến trình sử dụng phân đoạn đó thực hiện gỡ bỏ kết nối (detach) khỏi nó (sử dụng `shmdt()`). (Điều này giống hơn rất nhiều với tình huống xóa tập tin).

Các đối tượng System V IPC có tính bền bỉ trong kernel (kernel persistence). Một khi đã được tạo, một đối tượng sẽ tiếp tục tồn tại cho đến khi nó bị xóa một cách tường minh (explicitly deleted) hoặc hệ thống bị tắt nguồn (shutdown). Tính chất này của các đối tượng System V IPC có thể mang lại lợi thế. Một tiến trình có thể tạo ra một đối tượng, sửa đổi trạng thái của nó, rồi sau đó kết thúc (exit), để lại đối tượng đó cho một tiến trình khác được khởi động vào thời điểm sau đó truy cập. Nó cũng có thể mang lại bất lợi vì những lý do sau:

- Có các giới hạn do hệ thống áp đặt về số lượng đối tượng IPC của từng loại. Nếu chúng ta không xóa các đối tượng không dùng đến, cuối cùng chúng ta có thể gặp phải các lỗi ứng dụng do đạt đến các giới hạn này.
- Khi xóa một hàng đợi thông điệp hoặc đối tượng semaphore, một ứng dụng đa tiến trình (multiprocess application) có thể không dễ dàng xác định được tiến trình nào sẽ là tiến trình cuối cùng cần truy cập vào đối tượng, và do đó khi nào thì đối tượng có thể được xóa một cách an toàn. Vấn đề là các đối tượng này không có kết nối (connectionless)—kernel không duy trì bản ghi về những tiến trình nào đang mở đối tượng. (Bất lợi này không áp dụng cho các phân đoạn bộ nhớ chia sẻ, do ngữ nghĩa xóa khác biệt của chúng đã được mô tả ở trên).

## 45.2 Khóa IPC (IPC Keys)

Khóa System V IPC (System V IPC keys) là các giá trị số nguyên được biểu diễn bằng kiểu dữ liệu `key_t`. Các lời gọi get IPC (IPC get calls) dịch một khóa thành định danh (identifier) IPC dạng số nguyên tương ứng. Các lời gọi này đảm bảo rằng nếu chúng ta tạo một đối tượng IPC mới, thì đối tượng đó sẽ có một định danh duy nhất (unique identifier), và nếu chúng ta chỉ định khóa của một đối tượng hiện có, thì chúng ta sẽ luôn nhận được (cùng một) định danh cho đối tượng đó. (Về mặt nội bộ, kernel duy trì các cấu trúc dữ liệu ánh xạ các khóa tới các định danh cho từng cơ chế IPC, như được mô tả trong Mục [45.5](#page-54-0)).

Vậy, làm thế nào để chúng ta cung cấp một khóa duy nhất — một khóa đảm bảo rằng chúng ta sẽ không vô tình nhận được định danh của một đối tượng IPC hiện có do một ứng dụng khác sử dụng? Có ba khả năng:

- Ngẫu nhiên chọn một giá trị khóa số nguyên nào đó, thường được đặt trong một tệp tiêu đề (header file) được bao gồm bởi tất cả các chương trình sử dụng đối tượng IPC. Khó khăn với cách tiếp cận này là chúng ta có thể vô tình chọn một giá trị đang được sử dụng bởi một ứng dụng khác.
- Chỉ định hằng số `IPC_PRIVATE` làm giá trị khóa cho lời gọi get khi tạo đối tượng IPC, điều này luôn dẫn đến việc tạo ra một đối tượng IPC mới được đảm bảo có một khóa duy nhất.
- Sử dụng hàm `ftok()` để tạo ra một khóa (có khả năng là duy nhất).

Sử dụng `IPC_PRIVATE` hoặc `ftok()` là kỹ thuật thông thường.

## Tạo khóa duy nhất với IPC\_PRIVATE

Khi tạo một đối tượng IPC mới, khóa (key) có thể được chỉ định là `IPC_PRIVATE`, như sau:

```
id = msgget(IPC_PRIVATE, S_IRUSR | S_IWUSR);
```

Trong trường hợp này, không cần thiết phải chỉ định cờ `IPC_CREAT` hoặc `IPC_EXCL`.

Kỹ thuật này đặc biệt hữu ích trong các ứng dụng đa tiến trình (multiprocess applications), trong đó tiến trình cha (parent process) tạo đối tượng IPC trước khi thực hiện hàm `fork()`, dẫn đến việc tiến trình con (child process) kế thừa định danh (identifier) của đối tượng IPC đó. Chúng ta cũng có thể sử dụng kỹ thuật này trong các ứng dụng client-server (nghĩa là các ứng dụng liên quan đến các tiến trình không có quan hệ họ hàng), nhưng các client phải có cách để lấy được định danh của các đối tượng IPC do server tạo ra (và ngược lại). Ví dụ, sau khi tạo một đối tượng IPC, server có thể ghi định danh của nó vào một tệp (file) mà các client có thể đọc được.

## Tạo khóa duy nhất với ftok()

Hàm `ftok()` (file to key) trả về một giá trị khóa (key value) thích hợp để sử dụng trong một lời gọi tiếp theo tới một trong các System V IPC get system call.

```
## include <sys/ipc.h>
key_t ftok(char *pathname, int proj);
                                  Trả về khóa kiểu số nguyên nếu thành công, hoặc –1 nếu lỗi
```

Giá trị khóa này được tạo từ `pathname` và giá trị `proj` được cung cấp bằng cách sử dụng một thuật toán do cài đặt hệ thống quy định (implementation-defined algorithm). Tiêu chuẩn SUSv3 đưa ra các yêu cầu sau:

- Chỉ có 8 bit ít có nghĩa nhất (least significant 8 bits) của `proj` được thuật toán sử dụng.
- Ứng dụng phải đảm bảo rằng `pathname` trỏ tới một tệp tồn tại mà hàm `stat()` có thể áp dụng được (nếu không, `ftok()` sẽ trả về –1).
- Nếu các đường dẫn (liên kết - links) khác nhau cùng trỏ đến một tệp (nghĩa là cùng một i-node) được truyền cho `ftok()` với cùng một giá trị `proj`, thì cùng một giá trị khóa phải được trả về.

Nói cách khác, `ftok()` sử dụng số i-node thay vì tên của tệp để tạo giá trị khóa. (Do thuật toán của `ftok()` phụ thuộc vào số i-node, tệp không nên bị xóa và tạo lại trong vòng đời của ứng dụng, vì rất có thể tệp đó sẽ được tạo lại với một số i-node khác.) Mục đích của giá trị `proj` đơn giản là cho phép chúng ta tạo ra nhiều khóa từ cùng một tệp, điều này rất hữu ích khi một ứng dụng cần tạo nhiều đối tượng IPC cùng loại. Về mặt lịch sử, tham số `proj` có kiểu `char`, và nó thường được chỉ định như vậy trong các lời gọi đến `ftok()`.

> SUSv3 không quy định hành vi của `ftok()` nếu `proj` bằng 0. Dưới hệ điều hành AIX 5.1, `ftok()` trả về –1 nếu `proj` được chỉ định là 0. Trên Linux, giá trị này không có ý nghĩa đặc biệt nào. Tuy nhiên, các ứng dụng di động (portable applications) nên tránh chỉ định `proj` bằng 0; chúng ta vẫn còn 255 giá trị khác để lựa chọn.

Thông thường, đường dẫn `pathname` truyền cho `ftok()` trỏ tới một trong các tệp hoặc thư mục tạo thành một phần của, hoặc được tạo bởi, ứng dụng và các tiến trình phối hợp (cooperating processes) sẽ truyền cùng một `pathname` cho `ftok()`.

Trên Linux, khóa do `ftok()` trả về là một giá trị 32-bit, được tạo bằng cách lấy 8 bit ít có nghĩa nhất từ tham số `proj`, 8 bit ít có nghĩa nhất của số hiệu thiết bị (nghĩa là số hiệu thiết bị phụ - minor device number) của thiết bị chứa hệ thống tệp (file system) mà tệp đó đang nằm trên đó, và 16 bit ít có nghĩa nhất của số i-node của tệp được trỏ bởi `pathname`. (Hai thông tin sau được lấy bằng cách gọi `stat()` trên `pathname`).

Thuật toán `ftok()` của glibc tương tự như thuật toán được sử dụng trên các hệ implementation UNIX khác, và gặp phải một hạn chế tương tự: có một khả năng (rất nhỏ) là hai tệp khác nhau có thể tạo ra cùng một giá trị khóa. Điều này có thể xảy ra vì có khả năng các bit ít có nghĩa của số i-node có thể giống nhau đối với hai tệp trên các hệ thống tệp khác nhau, kết hợp với khả năng hai thiết bị đĩa khác nhau (trên một hệ thống có nhiều bộ điều khiển đĩa) có thể có cùng số hiệu thiết bị phụ (minor device number). Tuy nhiên, trên thực tế, khả năng trùng lặp giá trị khóa cho các ứng dụng khác nhau là đủ nhỏ để việc sử dụng `ftok()` nhằm tạo khóa trở thành một kỹ thuật khả thi.

Một cách sử dụng điển hình của `ftok()` là như sau:

```
key_t key;
int id;
key = ftok("/mydir/myfile", 'x');
if (key == -1)
 errExit("ftok");
```

```
id = msgget(key, IPC_CREAT | S_IRUSR | S_IWUSR);
if (id == -1)
 errExit("msgget");
```

## 45.3 Cấu trúc dữ liệu liên kết và Quyền hạn đối tượng

Kernel duy trì một cấu trúc dữ liệu liên kết (associated data structure) cho mỗi thể hiện (instance) của đối tượng System V IPC. Hình thức của cấu trúc dữ liệu này thay đổi tùy theo cơ chế IPC (hàng đợi thông điệp - message queue, semaphore, hoặc bộ nhớ chia sẻ - shared memory) và được định nghĩa trong tệp header tương ứng cho cơ chế IPC đó (xem Bảng 45-1). Chúng ta sẽ thảo luận chi tiết về từng cấu trúc dữ liệu này theo cơ chế cụ thể trong các chương tiếp theo.

Cấu trúc dữ liệu liên kết cho một đối tượng IPC được khởi tạo khi đối tượng được tạo thông qua system call get phù hợp. Khi đối tượng đã được tạo, một chương trình có thể lấy một bản sao của cấu trúc dữ liệu này bằng cách sử dụng system call ctl phù hợp, thông qua việc chỉ định loại thao tác là `IPC_STAT`. Ngược lại, một số phần của cấu trúc dữ liệu có thể được sửa đổi bằng cách sử dụng thao tác `IPC_SET`.

Ngoài dữ liệu đặc thù cho từng loại đối tượng IPC (IPC object), cấu trúc dữ liệu liên kết cho cả ba cơ chế IPC đều bao gồm một cấu trúc con (substructure), `ipc_perm`, chứa thông tin được sử dụng để xác định quyền hạn được cấp trên đối tượng:

```
struct ipc_perm {
 key_t __key; /* Key, as supplied to 'get' call */
 uid_t uid; /* Owner's user ID */
 gid_t gid; /* Owner's group ID */
 uid_t cuid; /* Creator's user ID */
 gid_t cgid; /* Creator's group ID */
 unsigned short mode; /* Permissions */
 unsigned short __seq; /* Sequence number */
};
```

Tiêu chuẩn SUSv3 quy định tất cả các trường của `ipc_perm` được hiển thị ở đây, ngoại trừ `__key` và `__seq`. Tuy nhiên, hầu hết các cài đặt UNIX đều cung cấp một số phiên bản của các trường này.

Các trường `uid` và `gid` chỉ định quyền sở hữu của đối tượng IPC. Các trường `cuid` và `cgid` chứa ID người dùng (User ID) và ID nhóm (Group ID) của Process đã tạo ra đối tượng đó. Ban đầu, các trường ID người dùng tương ứng và ID người tạo có cùng giá trị, được lấy từ các ID hiệu dụng (effective ID) của Process gọi hàm. Các ID của người tạo là bất biến (immutable), nhưng các ID của chủ sở hữu có thể được thay đổi thông qua thao tác `IPC_SET`. Đoạn mã sau minh họa cách thay đổi trường `uid` cho một phân đoạn bộ nhớ chia sẻ (shared memory segment - cấu trúc dữ liệu liên kết có kiểu `shmid_ds`):

```
struct shmid_ds shmds;
if (shmctl(id, IPC_STAT, &shmds) == -1) /* Fetch from kernel */
 errExit("shmctl");
shmds.shm_perm.uid = newuid; /* Change owner UID */
if (shmctl(id, IPC_SET, &shmds) == -1) /* Update kernel copy */
 errExit("shmctl");
```

Trường `mode` của cấu trúc con `ipc_perm` chứa mặt nạ quyền (permissions mask) cho đối tượng IPC. Các quyền này được khởi tạo bằng cách sử dụng 9 bit thấp của các cờ (flag) được chỉ định trong System Call `get` dùng để tạo đối tượng, nhưng có thể được thay đổi sau đó bằng cách sử dụng thao tác `IPC_SET`.

Giống như các tập tin (file), quyền hạn được chia thành ba loại — chủ sở hữu (owner, còn gọi là người dùng - user), nhóm (group), và loại khác (other) — và có thể chỉ định các quyền khác nhau cho từng loại. Tuy nhiên, có một số điểm khác biệt đáng chú ý so với cơ chế được sử dụng cho các tập tin:

- Chỉ có quyền đọc (read) và ghi (write) là có ý nghĩa đối với các đối tượng IPC. (Đối với Semaphore, quyền ghi thường được gọi là quyền chỉnh sửa - alter permission). Quyền thực thi (execute) không có ý nghĩa và bị bỏ qua khi thực hiện hầu hết các kiểm tra quyền truy cập.
- Các kiểm tra quyền hạn được thực hiện dựa trên User ID hiệu dụng (effective user ID), Group ID hiệu dụng (effective group IDs), và Group ID bổ sung (supplementary group IDs) của Process. (Điều này trái ngược với các kiểm tra quyền hạn hệ thống tập tin trên Linux, được thực hiện bằng cách sử dụng các ID hệ thống tập tin của Process, như được mô tả trong Mục 9.5).

Các quy tắc chính xác chi phối quyền hạn mà một Process được cấp trên một đối tượng IPC như sau:

- 1. Nếu Process có đặc quyền (`CAP_IPC_OWNER`), thì tất cả các quyền đều được cấp trên đối tượng IPC.
- 2. Nếu User ID hiệu dụng của Process khớp với User ID của chủ sở hữu hoặc người tạo đối tượng IPC, thì Process được cấp các quyền được xác định cho chủ sở hữu (người dùng) của đối tượng.
- 3. Nếu Group ID hiệu dụng hoặc bất kỳ Group ID bổ sung nào của Process khớp với Group ID của chủ sở hữu hoặc người tạo đối tượng IPC, thì Process được cấp các quyền nhóm được xác định cho đối tượng.
- 4. Ngược lại, Process được cấp các quyền được xác định cho đối tượng khác (other).

Trong mã nguồn Kernel, các phép kiểm tra trên được xây dựng sao cho phép kiểm tra xem một Process có đặc quyền hay không chỉ được thực hiện nếu Process đó không được cấp các quyền mà nó cần thông qua một trong các phép kiểm tra khác. Điều này được thực hiện nhằm tránh việc thiết lập không cần thiết cờ kế toán Process ASU, cho thấy rằng Process đã sử dụng các đặc quyền siêu người dùng - superuser privileges (Mục 28.1).

Lưu ý rằng việc sử dụng giá trị khóa `IPC_PRIVATE` hay sự hiện diện của cờ `IPC_EXCL` đều không ảnh hưởng đến việc Process nào có thể truy cập đối tượng IPC; quyền truy cập đó được xác định hoàn toàn bởi quyền sở hữu và quyền hạn của đối tượng.

Cách hiểu quyền đọc và quyền ghi đối với một đối tượng, và liệu chúng có bắt buộc hay không, tùy thuộc vào loại đối tượng và thao tác đang được thực hiện.

Khi một lệnh gọi `get` được thực hiện để lấy định danh (identifier) của một đối tượng IPC hiện có, một bước kiểm tra quyền ban đầu được thực hiện để xác định xem các quyền được chỉ định trong tham số cờ có tương thích với các quyền trên đối tượng hiện có hay không. Nếu không, lệnh gọi `get` sẽ thất bại với mã lỗi `EACCES`. (Trừ khi có quy định khác, mã lỗi này cũng được trả về khi quyền bị từ chối trong từng trường hợp được liệt kê bên dưới). Để minh họa, hãy xem xét ví dụ về hai người dùng khác nhau trong cùng một nhóm, với một người dùng tạo một hàng đợi thông điệp (message queue) bằng lệnh gọi sau:

```
msgget(key, IPC_CREAT | S_IRUSR | S_IWUSR | S_IRGRP);
 /* rw-r----- */
```

Một nỗ lực của người dùng thứ hai nhằm lấy định danh cho hàng đợi thông điệp này bằng cách sử dụng lệnh gọi sau sẽ thất bại, vì người dùng đó không được phép truy cập quyền ghi vào hàng đợi thông điệp:

```
msgget(key, S_IRUSR | S_IWUSR);
```

Người dùng thứ hai có thể bỏ qua bước kiểm tra này bằng cách chỉ định giá trị `0` cho đối số thứ hai của lời gọi `msgget()`, trong trường hợp đó lỗi sẽ chỉ xảy ra khi chương trình cố gắng thực hiện một thao tác yêu cầu quyền ghi (write permission) trên đối tượng IPC (ví dụ: ghi một thông điệp bằng `msgsnd()`).

> Lời gọi lấy (get call) đại diện cho một trường hợp duy nhất mà quyền thực thi (execute permission) không bị bỏ qua. Mặc dù nó không có ý nghĩa đối với các đối tượng IPC (IPC object), nhưng nếu quyền thực thi được yêu cầu trong một lời gọi get đối với một đối tượng đã tồn tại, thì việc kiểm tra sẽ được thực hiện để xem quyền đó có được cấp hay không.

Các quyền được yêu cầu cho các thao tác phổ biến khác như sau:

- Để trích xuất thông tin từ đối tượng (ví dụ: đọc một thông điệp từ hàng đợi thông điệp - message queue, lấy giá trị của một semaphore, hoặc gắn kết một phân đoạn bộ nhớ chia sẻ - shared memory segment để đọc) yêu cầu quyền đọc (read permission).
- Để cập nhật thông tin bên trong đối tượng (ví dụ: ghi một thông điệp vào hàng đợi thông điệp, thay đổi giá trị của một semaphore, hoặc gắn kết một phân đoạn bộ nhớ chia sẻ để ghi) yêu cầu quyền ghi (write permission).
- Để lấy bản sao của cấu trúc dữ liệu liên kết cho một đối tượng IPC (thao tác điều khiển `IPC_STAT`) yêu cầu quyền đọc.
- Để xóa một đối tượng IPC (thao tác điều khiển `IPC_RMID`) hoặc thay đổi cấu trúc dữ liệu liên kết của nó (thao tác điều khiển `IPC_SET`) không yêu cầu cả quyền đọc lẫn quyền ghi. Thay vào đó, tiến trình gọi (calling process) phải có đặc quyền (có capability `CAP_SYS_ADMIN`) hoặc có ID người dùng hiệu dụng (effective user ID) khớp với ID người dùng sở hữu (owner user ID) hoặc ID người dùng tạo ra (creator user ID) của đối tượng (nếu không, lỗi `EPERM` sẽ xảy ra).

Có thể thiết lập các quyền trên một đối tượng IPC sao cho chủ sở hữu hoặc người tạo không thể sử dụng `IPC_STAT` để lấy cấu trúc dữ liệu liên kết chứa các quyền của đối tượng (nghĩa là đối tượng sẽ không được hiển thị bởi lệnh `ipcs(1)` được mô tả trong Mục [45.6](#page-57-0)), mặc dù `IPC_SET` vẫn có thể được sử dụng để thay đổi chúng.

Nhiều thao tác cụ thể theo cơ chế khác yêu cầu quyền đọc hoặc quyền ghi, hoặc capability `CAP_IPC_OWNER`. Chúng tôi sẽ lưu ý các quyền được yêu cầu trong các chương tiếp theo khi các thao tác được mô tả.

## 45.4 Định danh IPC và Ứng dụng Client-Server

Trong các ứng dụng client-server, server thường tạo ra các đối tượng System V IPC, trong khi client đơn giản là truy cập chúng. Nói cách khác, server thực hiện một lời gọi lấy IPC chỉ định cờ `IPC_CREAT`, trong khi client bỏ qua cờ này trong lời gọi get của nó.

Giả sử một client tham gia vào một phiên trao đổi kéo dài với một server, với nhiều thao tác IPC được thực hiện bởi mỗi tiến trình (ví dụ: nhiều thông điệp được trao đổi, một chuỗi các thao tác semaphore, hoặc nhiều cập nhật đối với bộ nhớ chia sẻ). Điều gì xảy ra nếu tiến trình server bị sự cố (crash) hoặc bị dừng có chủ ý rồi sau đó được khởi động lại? Tại thời điểm này, việc tái sử dụng một cách mù quáng đối với đối tượng IPC hiện có được tạo bởi tiến trình server trước đó sẽ là vô nghĩa, vì tiến trình server mới không có bất kỳ thông tin lịch sử nào liên quan đến trạng thái hiện tại của đối tượng IPC. (Ví dụ, có thể có một yêu cầu thứ cấp bên trong hàng đợi thông điệp được gửi bởi một client để phản hồi một thông điệp trước đó từ tiến trình server cũ.)

Trong kịch bản như vậy, lựa chọn duy nhất cho server có thể là từ bỏ tất cả các client hiện tại, xóa các đối tượng IPC được tạo bởi tiến trình server trước đó, và tạo các thể hiện (instance) mới của các đối tượng IPC. Một server mới khởi động sẽ xử lý khả năng một thể hiện trước đó của server đã chấm dứt sớm bằng cách trước tiên cố gắng tạo một đối tượng IPC bằng cách chỉ định cả hai cờ `IPC_CREAT` và `IPC_EXCL` trong lời gọi get. Nếu lời gọi get thất bại vì một đối tượng với key được chỉ định đã tồn tại, thì server giả định rằng đối tượng đã được tạo bởi một tiến trình server cũ; do đó, nó sử dụng thao tác điều khiển `IPC_RMID` để xóa đối tượng, và thực hiện một lần nữa lời gọi get để tạo đối tượng. (Điều này có thể được kết hợp với các bước khác để đảm bảo rằng không có tiến trình server nào khác đang chạy, chẳng hạn như những bước được mô tả trong Mục 55.6.) Đối với một hàng đợi thông điệp, các bước này có thể xuất hiện như trong [Liệt kê 45-1.](#page-53-0)

**Liệt kê 45-1:** Dọn dẹp các đối tượng IPC bên trong một server

```
––––––––––––––––––––––––––––––––––––––––––––––––– svipc/svmsg_demo_server.c
## include <sys/types.h>
## include <sys/ipc.h>
## include <sys/msg.h>
## include <sys/stat.h>
## include "tlpi_hdr.h"
## define KEY_FILE "/some-path/some-file"
 /* Nên là một tệp tồn tại hoặc một tệp
 mà chương trình này tạo ra */
int
main(int argc, char *argv[])
{
 int msqid;
 key_t key;
 const int MQ_PERMS = S_IRUSR | S_IWUSR | S_IWGRP; /* rw--w---- */
 /* Mã nguồn tùy chọn ở đây để kiểm tra xem một tiến trình server khác
 có đang chạy hay không */
 /* Tạo key cho hàng đợi thông điệp */
 key = ftok(KEY_FILE, 1);
 if (key == -1)
 errExit("ftok");
```

```
 /* Trong khi msgget() thất bại, hãy thử tạo hàng đợi độc quyền */
 while ((msqid = msgget(key, IPC_CREAT | IPC_EXCL | MQ_PERMS)) == -1) {
 if (errno == EEXIST) { /* MQ với cùng key đã tồn tại
 - xóa nó và thử lại */
 msqid = msgget(key, 0);
 if (msqid == -1)
 errExit("msgget() không thể trích xuất ID hàng đợi cũ");
 if (msgctl(msqid, IPC_RMID, NULL) == -1)
 errExit("msgget() không thể xóa hàng đợi cũ");
 printf("Đã xóa hàng đợi thông điệp cũ (id=%d)\n", msqid);
 } else { /* Lỗi nào khác --> bỏ cuộc */
 errExit("msgget() thất bại");
 }
 }
 /* Khi kết thúc vòng lặp, chúng ta đã tạo thành công hàng đợi thông điệp,
 và sau đó có thể tiếp tục thực hiện công việc khác... */
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––– svipc/svmsg_demo_server.c
```

Ngay cả khi một tiến trình server khởi động lại tạo lại các đối tượng IPC (IPC objects), vẫn sẽ tồn tại một vấn đề tiềm ẩn nếu việc cung cấp cùng một key cho lời gọi get luôn tạo ra cùng một định danh (identifier) bất cứ khi nào một đối tượng IPC mới được tạo. Hãy xem xét giải pháp vừa nêu dưới góc độ của client. Nếu các đối tượng IPC được tạo lại bởi server sử dụng cùng các định danh, thì client sẽ không có cách nào nhận biết được rằng server đã bị khởi động lại và các đối tượng IPC đó không chứa thông tin lịch sử như mong đợi.

Để giải quyết vấn đề này, kernel áp dụng một thuật toán (được mô tả trong phần tiếp theo) nhằm đảm bảo thông thường rằng khi một đối tượng IPC mới được tạo, định danh của đối tượng đó sẽ khác đi, ngay cả khi cùng một key được truyền vào. Do đó, bất kỳ client nào của tiến trình server cũ cố gắng sử dụng định danh cũ sẽ nhận được lỗi từ System Call IPC liên quan.

> Các giải pháp như được minh họa trong [Listing 45-1](#page-53-0) không giải quyết hoàn toàn vấn đề nhận diện việc server khởi động lại khi sử dụng bộ nhớ chia sẻ System V (System V shared memory), vì một đối tượng bộ nhớ chia sẻ chỉ bị xóa khi tất cả các tiến trình đã ngắt kết nối (detached) nó khỏi không gian địa chỉ ảo (virtual address space) của chúng. Tuy nhiên, các đối tượng bộ nhớ chia sẻ thường được sử dụng kết hợp với semaphore System V (System V semaphores), vốn bị xóa ngay lập tức để đáp ứng lại thao tác `IPC_RMID`. Điều này có nghĩa là một tiến trình client sẽ nhận biết được việc server khởi động lại khi nó cố gắng truy cập đối tượng semaphore đã bị xóa.

## 45.5 Thuật toán được sử dụng bởi các System Call get của System V IPC

[Hình 45-1](#page-55-0) minh họa một số cấu trúc được sử dụng nội bộ bởi kernel để biểu diễn thông tin về các đối tượng System V IPC (trong trường hợp này là semaphore, nhưng các chi tiết cũng tương tự đối với các cơ chế IPC khác), bao gồm các trường (fields) được dùng để tính toán các key IPC. Đối với mỗi cơ chế IPC (bộ nhớ chia sẻ, hàng đợi thông điệp - message queue, hoặc semaphore), kernel duy trì một cấu trúc `ipc_ids` đi kèm nhằm ghi lại các thông tin toàn cục (global) khác nhau về tất cả các thể hiện (instances) của cơ chế IPC đó. Thông tin này bao gồm một mảng con trỏ có kích thước động, các `entries`, trỏ đến cấu trúc dữ liệu liên kết cho từng thể hiện đối tượng (cấu trúc `semid_ds` trong trường hợp semaphore). Kích thước hiện tại của mảng `entries` được ghi lại trong trường `size`, với trường `max_id` lưu giữ chỉ mục (index) của phần tử có giá trị cao nhất đang được sử dụng.

![](_page_55_Figure_1.jpeg)

**Hình 45-1:** Cấu trúc dữ liệu kernel được sử dụng để biểu diễn các đối tượng System V IPC (semaphore)

Khi một System Call IPC get được thực hiện, thuật toán được sử dụng trên Linux (các hệ thống khác sử dụng thuật toán tương tự) diễn ra xấp xỉ như sau:

- 1. Danh sách các cấu trúc dữ liệu liên kết (được trỏ tới bởi các phần tử của mảng `entries`) được tìm kiếm để tìm một cấu trúc có trường `key` khớp với key được chỉ định trong lời gọi get.
  - a) Nếu không tìm thấy kết quả khớp và `IPC_CREAT` không được chỉ định, thì lỗi `ENOENT` sẽ được trả về.
  - b) Nếu tìm thấy kết quả khớp, nhưng cả `IPC_CREAT` và `IPC_EXCL` đều được chỉ định, thì lỗi `EEXIST` sẽ được trả về.
  - c) Ngược lại, nếu tìm thấy kết quả khớp, bước tiếp theo sẽ bị bỏ qua.
- 2. Nếu không tìm thấy kết quả khớp và `IPC_CREAT` được chỉ định, một cấu trúc dữ liệu liên kết đặc trưng cho cơ chế mới (`semid_ds` trong [Hình 45-1](#page-55-0)) sẽ được cấp phát và khởi tạo. Quá trình này cũng bao gồm việc cập nhật các trường khác nhau của cấu trúc `ipc_ids`, và có thể bao gồm việc thay đổi kích thước của mảng `entries`. Một con trỏ trỏ đến cấu trúc mới được đặt vào phần tử trống đầu tiên của `entries`. Hai bước phụ được bao gồm như một phần của quá trình khởi tạo này:
  - a) Giá trị key được cung cấp trong lời gọi get được sao chép vào trường `xxx_perm.__key` của cấu trúc vừa được cấp phát.
  - b) Giá trị hiện tại của trường `seq` thuộc cấu trúc `ipc_ids` được sao chép vào trường `xxx_perm.__seq` của cấu trúc dữ liệu liên kết, và trường `seq` được tăng lên một đơn vị.

3. Định danh cho đối tượng IPC được tính toán bằng cách sử dụng công thức sau:

```c
identifier = index + xxx_perm.__seq * SEQ_MULTIPLIER
```

Trong công thức dùng để tính toán định danh IPC, `index` là chỉ mục của thể hiện đối tượng này bên trong mảng `entries`, và `SEQ_MULTIPLIER` là một hằng số được định nghĩa với giá trị 32.768 (`IPCMNI` trong tệp mã nguồn kernel `include/linux/ipc.h`). Ví dụ, trong [Hình 45-1](#page-55-0), định danh được tạo cho semaphore có giá trị key `0x4b079002` sẽ là `(2 + 5 * 32.768) = 163.842`.

Lưu ý các điểm sau về thuật toán được sử dụng bởi các lời gọi get:

Ngay cả khi một đối tượng IPC mới được tạo với cùng một key, gần như chắc chắn nó sẽ có một định danh khác, vì định danh được tính toán dựa trên giá trị `seq` được lưu trong cấu trúc dữ liệu liên kết, và giá trị này được tăng lên một đơn vị trong quá trình tạo ra mỗi đối tượng thuộc loại này.

> Thuật toán được sử dụng bên trong kernel sẽ quay vòng (wrap) giá trị `seq` trở về 0 khi nó đạt đến giá trị `(INT_MAX / IPCMNI)`—tức là `2.147.483.647 / 32.768 = 65.535`. Do đó, một đối tượng IPC mới có thể có cùng định danh với một đối tượng trước đó nếu có 65.535 đối tượng được tạo trong khoảng thời gian đó và đối tượng mới tái sử dụng cùng một phần tử trong mảng `entries` giống như đối tượng trước (nghĩa là phần tử này cũng phải được giải phóng trong khoảng thời gian đó). Tuy nhiên, xác suất xảy ra điều này là rất thấp.

- Thuật toán tạo ra một tập hợp các giá trị định danh (identifier) riêng biệt cho mỗi chỉ mục (index) của mảng `entries`.
- Vì hằng số `IPCMNI` xác định giới hạn trên về số lượng đối tượng System V IPC của mỗi loại, thuật toán đảm bảo rằng mỗi đối tượng IPC hiện có đều có một định danh (identifier) duy nhất.
- Cho trước một giá trị định danh, chỉ mục tương ứng trong mảng `entries` có thể được tính toán nhanh chóng bằng công thức sau:

```
index = identifier % SEQ_MULTIPLIER
```

Khả năng thực hiện tính toán này một cách nhanh chóng là cần thiết cho hoạt động hiệu quả của các system call IPC được cung cấp định danh của một đối tượng IPC (nghĩa là các lời gọi trong Bảng 45-1 ngoại trừ các lời gọi `get`).

Nhân tiện, cần lưu ý rằng hai lỗi khác nhau có thể xảy ra nếu một tiến trình (process) thực hiện một system call IPC (ví dụ: `msgctl()`, `semop()`, hoặc `shmat()`) chỉ định một định danh không tương ứng với một đối tượng hiện có. Nếu chỉ mục tương ứng của `entries` trống, lỗi `EINVAL` sẽ xảy ra. Nếu chỉ mục trỏ đến một cấu trúc dữ liệu liên kết, nhưng số thứ tự (sequence number) được lưu trữ trong cấu trúc đó không tạo ra cùng giá trị định danh, thì người ta giả định rằng một đối tượng cũ được trỏ bởi chỉ mục mảng này đã bị xóa và chỉ mục đã được tái sử dụng. Kịch bản này được chẩn đoán với lỗi `EIDRM`.

## 45.6 Các lệnh ipcs và ipcrm

Các lệnh `ipcs` và `ipcrm` là các công cụ tương đương trong System V IPC của các lệnh tệp `ls` và `rm`. Bằng cách sử dụng `ipcs`, chúng ta có thể nhận thông tin về các đối tượng IPC trên hệ thống. Theo mặc định, `ipcs` hiển thị tất cả các đối tượng, như trong ví dụ sau:

### \$ **ipcs**

```
------ Shared Memory Segments --------
key shmid owner perms bytes nattch status
0x6d0731db 262147 mtk 600 8192 2
------ Semaphore Arrays --------
key semid owner perms nsems
0x6107c0b8 0 cecilia 660 6
0x6107c0b6 32769 britta 660 1
------ Message Queues --------
key msqid owner perms used-bytes messages
0x71075958 229376 cecilia 620 12 2
```

Trên Linux, `ipcs(1)` chỉ hiển thị thông tin về các đối tượng IPC mà chúng ta có quyền đọc (read permission), bất kể chúng ta có sở hữu các đối tượng đó hay không. Trên một số triển khai UNIX, `ipcs` hiển thị hành vi giống như trên Linux. Tuy nhiên, trên các triển khai khác, `ipcs` hiển thị tất cả các đối tượng bất kể người dùng có được cấp quyền đọc hay không.

Theo mặc định, đối với mỗi đối tượng, `ipcs` hiển thị khóa (key), định danh (identifier), chủ sở hữu (owner) và quyền (được biểu diễn dưới dạng số bát phân - octal number), theo sau là thông tin cụ thể của đối tượng:

- Đối với bộ nhớ chia sẻ (shared memory), `ipcs` hiển thị kích thước của vùng nhớ chia sẻ, số lượng tiến trình hiện đang đính kèm (attach) vùng nhớ chia sẻ vào không gian địa chỉ ảo (virtual address space) của chúng, và các cờ trạng thái (status flags). Các cờ trạng thái cho biết liệu vùng nhớ đã được khóa vào RAM để ngăn chặn việc hoán đổi (swapping) hay chưa (Mục [48.7](#page-134-0)) và liệu vùng nhớ đã được đánh dấu để hủy khi tất cả các tiến trình gỡ đính kèm (detach) nó hay chưa.
- Đối với các semaphore, `ipcs` hiển thị kích thước của tập hợp semaphore.
- Đối với hàng đợi thông điệp (message queues), `ipcs` hiển thị tổng số byte dữ liệu và số lượng thông điệp trong hàng đợi.

Trang hướng dẫn sử dụng (man page) `ipcs(1)` tài liệu hóa các tùy chọn khác nhau để hiển thị thông tin khác về các đối tượng IPC.

Lệnh `ipcrm` xóa một đối tượng IPC. Dạng tổng quát của lệnh này là một trong các dạng sau:

```
$ ipcrm -X key
$ ipcrm -x id
```

Trong phần trên, chúng ta chỉ định `key` là khóa đối tượng IPC hoặc `id` là định danh đối tượng IPC, và chữ cái `x` được thay thế bằng chữ hoa hoặc chữ thường `q` (cho hàng đợi thông điệp), `s` (cho semaphore), hoặc `m` (cho bộ nhớ chia sẻ). Do đó, chúng ta có thể sử dụng lệnh sau để xóa tập hợp semaphore có định danh `65538`:

```
$ ipcrm -s 65538
```

## 45.7 Lấy danh sách tất cả các đối tượng IPC

Linux cung cấp hai phương pháp phi tiêu chuẩn để lấy danh sách tất cả các đối tượng IPC trên hệ thống:

- các tệp trong thư mục `/proc/sysvipc` liệt kê tất cả các đối tượng IPC; và
- việc sử dụng các lệnh ctl đặc trưng của Linux (Linux-specific ctl calls).

Chúng ta mô tả các tệp trong thư mục `/proc/sysvipc` ở đây, và hoãn thảo luận về các lệnh ctl cho đến Mục [46.6](#page-74-0), nơi chúng tôi cung cấp một chương trình ví dụ liệt kê tất cả các hàng đợi thông điệp System V trên hệ thống.

> Một số triển khai UNIX khác có các phương pháp phi tiêu chuẩn của riêng chúng để lấy danh sách tất cả các định danh IPC; ví dụ, Solaris cung cấp các system call `msgids()`, `semids()`, và `shmids()` cho mục đích này.

Ba tệp chỉ đọc trong thư mục `/proc/sysvipc` cung cấp cùng một thông tin có thể lấy được thông qua `ipcs`:

- `/proc/sysvipc/msg` liệt kê tất cả các hàng đợi thông điệp và thuộc tính của chúng.
- `/proc/sysvipc/sem` liệt kê tất cả các tập hợp semaphore và thuộc tính của chúng.
- `/proc/sysvipc/shm` liệt kê tất cả các phân đoạn bộ nhớ chia sẻ và thuộc tính của chúng.

Không giống như lệnh `ipcs`, các tệp này luôn hiển thị tất cả các đối tượng của loại tương ứng, bất kể có quyền đọc trên các đối tượng đó hay không.

Một ví dụ về nội dung của `/proc/sysvipc/sem` như sau (với một số khoảng trắng đã được lược bỏ để vừa vặn với trang này):

```
$ cat /proc/sysvipc/sem
key semid perms nsems uid gid cuid cgid otime ctime
 0 16646144 600 4 1000 100 1000 100 0 1010166460
```

Ba tệp `/proc/sysvipc` cung cấp một phương pháp (không diable - nonportable) cho các chương trình và tập lệnh (script) để duyệt qua danh sách tất cả các đối tượng IPC (IPC object) hiện có thuộc một loại đã cho.

> Điều tốt nhất chúng ta có thể đạt được đối với cách tiếp cận có tính di động (portable approach) để lấy danh sách tất cả các đối tượng IPC thuộc một loại đã cho là phân tích cú pháp (parse) đầu ra của lệnh `ipcs(1)`.

## 45.8 Giới hạn IPC (IPC Limits)

Vì các đối tượng System V IPC tiêu thụ tài nguyên hệ thống (system resources), kernel áp đặt các giới hạn khác nhau đối với từng lớp đối tượng IPC nhằm ngăn chặn việc cạn kiệt tài nguyên. Các phương pháp đặt ra giới hạn cho các đối tượng System V IPC không được quy định bởi SUSv3, nhưng hầu hết các cài đặt UNIX (bao gồm cả Linux) đều tuân theo một khuôn khổ tương tự đối với các loại giới hạn có thể được thiết lập. Khi chúng ta tìm hiểu từng cơ chế System V IPC trong các chương tiếp theo, chúng ta sẽ thảo luận về các giới hạn liên quan và lưu ý những điểm khác biệt so với các cài đặt UNIX khác.

Mặc dù các loại giới hạn có thể đặt ra cho mỗi lớp đối tượng IPC nhìn chung là tương tự nhau trên các cài đặt UNIX khác nhau, nhưng các phương pháp để xem và thay đổi những giới hạn này thì không. Các phương pháp được mô tả trong các chương tiếp theo là đặc thù của Linux (thường liên quan đến việc sử dụng các tệp trong thư mục `/proc/sys/kernel`); mọi thứ được thực hiện khác đi trên các cài đặt hệ thống khác.

Trên Linux, lệnh `ipcs –l` có thể được sử dụng để liệt kê các giới hạn trên từng cơ chế IPC. Các chương trình có thể sử dụng thao tác điều khiển `IPC_INFO` đặc thù của Linux để truy xuất thông tin tương tự.

## 45.9 Tóm tắt

System V IPC là tên gọi được đặt cho ba cơ chế IPC lần đầu tiên xuất hiện rộng rãi trong System V, và sau đó đã đượcported (chuyển cả) sang hầu hết các cài đặt UNIX và được đưa vào các tiêu chuẩn khác nhau. Ba cơ chế IPC đó là hàng đợi thông điệp (message queue), cho phép các tiến trình (process) trao đổi thông điệp; semaphore, cho phép các tiến trình đồng bộ hóa (synchronize) quyền truy cập vào các tài nguyên chia sẻ; và bộ nhớ chia sẻ (shared memory), cho phép hai hoặc nhiều tiến trình chia sẻ cùng các trang bộ nhớ (memory page).

Ba cơ chế IPC này có nhiều điểm tương đồng trong các API và ngữ nghĩa (semantics) của chúng. Đối với mỗi cơ chế IPC, một System Call `get` sẽ tạo hoặc mở một đối tượng. Với một khóa số nguyên (integer key), các lệnh gọi `get` trả về một định danh số nguyên (integer identifier) được sử dụng để tham chiếu đến đối tượng trong các system call tiếp theo. Mỗi cơ chế IPC cũng có một System Call `ctl` tương ứng được sử dụng để xóa một đối tượng và để truy xuất hoặc sửa đổi các thuộc tính khác nhau (ví dụ: quyền sở hữu và quyền truy cập) trong cấu trúc dữ liệu liên kết của đối tượng.

Thuật toán được sử dụng để tạo ra các định danh cho các đối tượng IPC mới được thiết kế để giảm thiểu khả năng một định danh bị tái sử dụng (ngay lập tức) nếu một đối tượng bị xóa, ngay cả khi cùng một khóa được sử dụng để tạo một đối tượng mới. Điều này cho phép các ứng dụng client-server hoạt động chính xác — một tiến trình server được khởi động lại có thể phát hiện và xóa các đối tượng IPC do tiến trình tiền nhiệm của nó tạo ra, và hành động này làm mất hiệu lực của các định danh đang được nắm giữ bởi bất kỳ client nào của tiến trình server trước đó.

Lệnh `ipcs` liệt kê các đối tượng System V IPC hiện đang tồn tại trên hệ thống. Lệnh `ipcrm` được sử dụng để xóa các đối tượng System IPC.

Trên Linux, các tệp trong thư mục `/proc/sysvipc` có thể được sử dụng để lấy thông tin về tất cả các đối tượng System V IPC trên hệ thống.

Mỗi cơ chế IPC có một tập hợp các giới hạn liên quan có thể được sử dụng để tránh cạn kiệt tài nguyên hệ thống bằng cách ngăn chặn việc tạo ra một số lượng đối tượng IPC tùy ý. Các tệp khác nhau nằm dưới thư mục `/proc/sys/kernel` có thể được sử dụng để xem và sửa đổi các giới hạn này.

## Thông tin thêm

Thông tin về việc cài đặt System V IPC trên Linux có thể được tìm thấy trong [Maxwell, 1999] và [Bovet & Cesati, 2005]. [Goodheart & Cox, 1994] mô tả việc cài đặt System V IPC cho System V Release 4.

## 45.10 Bài tập

- **45-1.** Viết một chương trình để xác minh rằng thuật toán được sử dụng bởi `ftok()` sử dụng số i-node (i-node number) của tệp, số thiết bị phụ (minor device number) và giá trị `proj`, như được mô tả trong Mục [45.2](#page-48-0). (Chỉ cần in tất cả các giá trị này, cũng như giá trị trả về từ `ftok()`, dưới dạng hệ thập lục giác (hexadecimal) và kiểm tra kết quả cho một số ví dụ).
- **45-2.** Triển khai lại hàm `ftok()`.
- **45-3.** Xác minh (thông qua thực nghiệm) các nhận định được đưa ra trong Mục [45.5](#page-54-0) về thuật toán được sử dụng để tạo ra các định danh System V IPC (System V IPC identifiers).
