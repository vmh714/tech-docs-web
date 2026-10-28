# Chương 43: Tổng quan về Giao tiếp liên tiến trình (Interprocess Communication Overview)

Chương này trình bày một cái nhìn tổng quan ngắn gọn về các cơ chế mà các tiến trình (process) và luồng (thread) có thể sử dụng để giao tiếp với nhau và đồng bộ hóa các hoạt động của chúng. Các chương tiếp theo sẽ cung cấp thêm chi tiết về các cơ chế này.

## 43.1 Phân loại các cơ chế IPC

[Hình 43-1](#page-1-0) tóm tắt sự đa dạng phong phú của các cơ chế giao tiếp và đồng bộ hóa trong UNIX, chia chúng thành ba danh mục chức năng chính:

- Giao tiếp (Communication): Các cơ chế này liên quan đến việc trao đổi dữ liệu giữa các tiến trình.
- Đồng bộ hóa (Synchronization): Các cơ chế này liên quan đến việc đồng bộ hóa các hành động của các tiến trình hoặc luồng.
- Tín hiệu (Signals): Mặc dù tín hiệu chủ yếu nhằm phục vụ các mục đích khác, chúng có thể được sử dụng làm kỹ thuật đồng bộ hóa trong một số trường hợp nhất định. Ít phổ biến hơn, tín hiệu có thể được sử dụng như một kỹ thuật giao tiếp: bản thân số hiệu tín hiệu (signal number) là một dạng thông tin, và các tín hiệu thời gian thực (realtime signals) có thể đi kèm với dữ liệu bổ sung (một số nguyên hoặc một con trỏ). Tín hiệu được mô tả chi tiết từ Chương 20 đến Chương 22.

Mặc dù một số cơ chế này liên quan đến đồng bộ hóa, thuật ngữ chung giao tiếp giữa các tiến trình (Interprocess Communication - IPC) thường được sử dụng để mô tả tất cả chúng.

![](_page_1_Figure_1.jpeg)

**Hình 43-1:** Phân loại các cơ chế IPC trong UNIX

Như [Hình 43-1](#page-1-0) minh họa, thường có nhiều cơ chế cung cấp chức năng IPC tương tự nhau. Có một vài lý do cho việc này:

- Các cơ chế tương tự đã tiến hóa trên các biến thể UNIX khác nhau, và sau đó được port (chuyển cảng) sang các hệ thống UNIX khác. Ví dụ, FIFO được phát triển trên System V, trong khi (stream) socket được phát triển trên BSD.
- Các cơ chế mới đã được phát triển để khắc phục những điểm yếu về thiết kế trong các cơ chế tương tự trước đó. Ví dụ, các cơ chế IPC của POSIX (hàng đợi thông điệp - message queues, semaphores, và bộ nhớ chia sẻ - shared memory) được thiết kế nhằm cải tiến các cơ chế IPC cũ của System V.

Trong một số trường hợp, các cơ chế được nhóm lại với nhau trong [Hình 43-1](#page-1-0) thực sự cung cấp các chức năng khác biệt đáng kể. Ví dụ, stream socket có thể được sử dụng để giao tiếp qua mạng, trong khi FIFO chỉ có thể được sử dụng để giao tiếp giữa các tiến trình trên cùng một máy.

## 43.2 Các cơ chế giao tiếp

Các cơ chế giao tiếp khác nhau được hiển thị trong [Hình 43-1](#page-1-0) cho phép các tiến trình trao đổi dữ liệu với nhau. (Các cơ chế này cũng có thể được sử dụng để trao đổi dữ liệu giữa các luồng của một tiến trình đơn lẻ, nhưng điều này hiếm khi cần thiết, vì các luồng có thể trao đổi thông tin thông qua các biến toàn cục được chia sẻ.)

Chúng ta có thể chia các cơ chế giao tiếp thành hai loại:

- Cơ chế truyền dữ liệu (Data-transfer facilities): Yếu tố chính phân biệt các cơ chế này là khái niệm ghi và đọc. Để giao tiếp, một tiến trình ghi dữ liệu vào cơ chế IPC và một tiến trình khác đọc dữ liệu đó. Các cơ chế này yêu cầu hai lần truyền dữ liệu giữa bộ nhớ người dùng (user memory) và bộ nhớ nhân (kernel memory): một lần truyền từ bộ nhớ người dùng sang bộ nhớ nhân trong quá trình ghi, và một lần truyền từ bộ nhớ nhân sang bộ nhớ người dùng trong quá trình đọc. ([Hình 43-2](#page-2-0) minh họa tình huống này đối với một pipe).
- Bộ nhớ chia sẻ (Shared memory): Bộ nhớ chia sẻ cho phép các tiến trình trao đổi thông tin bằng cách đặt nó vào một vùng nhớ được chia sẻ giữa các tiến trình. (Kernel thực hiện điều này bằng cách tạo các mục bảng trang - page-table entries trong mỗi tiến trình trỏ đến cùng các trang RAM, như được hiển thị trong [Hình 49-2](#page-149-0), ở trang [1026](#page-149-0)). Một tiến trình có thể làm cho dữ liệu có sẵn cho các tiến trình khác bằng cách đặt nó vào vùng nhớ chia sẻ. Bởi vì quá trình giao tiếp không yêu cầu System Call (giao tiếp hệ thống) hoặc truyền dữ liệu giữa bộ nhớ người dùng và bộ nhớ nhân, bộ nhớ chia sẻ có thể cung cấp tốc độ giao tiếp rất nhanh.

![](_page_2_Figure_6.jpeg)

**Hình 43-2:** Trao đổi dữ liệu giữa hai tiến trình sử dụng pipe

### Truyền dữ liệu (Data transfer)

Chúng ta có thể chia nhỏ các cơ chế truyền dữ liệu (data-transfer facilities) thành các tiểu mục sau:

- Dữ liệu dạng luồng byte (Byte stream): Dữ liệu được trao đổi thông qua các pipe, FIFO và socket datagram là một luồng byte không phân định ranh giới (undelimited byte stream). Mỗi thao tác đọc (read operation) có thể đọc một số lượng byte tùy ý từ cơ chế IPC (Inter-Process Communication), bất kể kích thước của các khối dữ liệu do bên ghi (writer) tạo ra. Mô hình này phản ánh mô hình "tệp dưới dạng một chuỗi các byte" truyền thống của UNIX.

- Thông điệp (Message): Dữ liệu được trao đổi thông qua hàng đợi thông điệp System V (System V message queues), hàng đợi thông điệp POSIX (POSIX message queues) và socket datagram có dạng các thông điệp được phân định rõ ràng (delimited messages). Mỗi thao tác đọc sẽ đọc toàn bộ một thông điệp do tiến trình ghi (writer process) tạo ra. Không thể đọc một phần của thông điệp và để phần còn lại trong cơ chế IPC; cũng không thể đọc nhiều thông điệp trong một thao tác đọc duy nhất.
- Giả thiết bị đầu cuối (Pseudoterminals): Giả thiết bị đầu cuối là một cơ chế giao tiếp được thiết kế để sử dụng trong các tình huống chuyên biệt. Chúng tôi sẽ cung cấp chi tiết trong Chương 64.

Một số đặc điểm chung phân biệt các cơ chế truyền dữ liệu với bộ nhớ chia sẻ (shared memory):

- Mặc dù một cơ chế truyền dữ liệu có thể có nhiều tiến trình đọc (reader), nhưng các thao tác đọc mang tính phá hủy (destructive). Một thao tác đọc sẽ tiêu thụ dữ liệu (consume data) và dữ liệu đó sẽ không còn khả dụng cho bất kỳ tiến trình nào khác.

> [!NOTE]
> Cờ `MSG_PEEK` có thể được sử dụng để thực hiện việc đọc không phá hủy (nondestructive read) từ một socket (Mục 61.3). Các socket UDP (datagram miền Internet) cho phép một thông điệp đơn lẻ được broadcast hoặc multicast tới nhiều người nhận (Mục 61.12).

- Đồng bộ hóa (Synchronization) giữa tiến trình đọc và tiến trình ghi diễn ra tự động. Nếu một tiến trình đọc cố gắng lấy dữ liệu từ một cơ chế truyền dữ liệu hiện không có dữ liệu, thì (theo mặc định) thao tác đọc sẽ bị chặn (block) cho đến khi có tiến trình ghi dữ liệu vào cơ chế đó.

## Bộ nhớ chia sẻ (Shared memory)

Hầu hết các hệ thống UNIX hiện đại đều cung cấp ba loại bộ nhớ chia sẻ: bộ nhớ chia sẻ System V (System V shared memory), bộ nhớ chia sẻ POSIX (POSIX shared memory) và ánh xạ bộ nhớ (memory mappings). Chúng ta sẽ xem xét sự khác biệt giữa chúng khi mô tả các cơ chế này trong các chương sau (đặc biệt xem Mục 54.5).

Lưu ý các điểm chung sau đây về bộ nhớ chia sẻ:

- Mặc dù bộ nhớ chia sẻ cung cấp khả năng giao tiếp nhanh chóng, lợi thế về tốc độ này lại bị đánh đổi bởi nhu cầu phải đồng bộ hóa các thao tác trên bộ nhớ chia sẻ đó. Ví dụ, một tiến trình không nên cố gắng truy cập một cấu trúc dữ liệu trong bộ nhớ chia sẻ trong khi một tiến trình khác đang cập nhật nó. Semaphore thường là phương pháp đồng bộ hóa được sử dụng cùng với bộ nhớ chia sẻ.
- Dữ liệu được đặt trong bộ nhớ chia sẻ có thể nhìn thấy được đối với tất cả các tiến trình cùng chia sẻ vùng nhớ đó. (Điều này trái ngược với ngữ nghĩa đọc phá hủy đã được mô tả ở trên đối với các cơ chế truyền dữ liệu).

## 43.3 Các Cơ chế Đồng bộ (Synchronization Facilities)

Các cơ chế đồng bộ được thể hiện trong [Hình 43-1](#page-1-0) cho phép các tiến trình (process) phối hợp hành động của chúng. Đồng bộ hóa cho phép các tiến trình tránh được việc thực hiện các thao tác như đồng thời cập nhật một vùng nhớ chia sẻ (shared memory region) hoặc cùng một phần của một tệp. Nếu không có đồng bộ, các cập nhật đồng thời như vậy có thể khiến ứng dụng tạo ra kết quả không chính xác.

Các hệ thống UNIX cung cấp các cơ chế đồng bộ sau:

- Semaphore: Semaphore là một số nguyên được kernel (nhân) duy trì mà giá trị của nó không bao giờ được phép giảm xuống dưới 0. Một tiến trình có thể giảm hoặc tăng giá trị của một semaphore. Nếu có nỗ lực giảm giá trị của semaphore xuống dưới 0, kernel sẽ chặn (block) thao tác đó cho đến khi giá trị của semaphore tăng lên mức cho phép thao tác được thực thi. (Ngoài ra, tiến trình có thể yêu cầu một thao tác không chặn (nonblocking operation); khi đó, thay vì bị chặn, kernel sẽ khiến thao tác trả về ngay lập tức kèm theo một mã lỗi cho biết thao tác không thể thực hiện ngay được). Ý nghĩa của một semaphore được quyết định bởi ứng dụng. Một tiến trình giảm giá trị semaphore (ví dụ từ 1 xuống 0) nhằm mục đích chiếm quyền truy cập độc quyền (exclusive access) vào một tài nguyên chia sẻ nào đó, và sau khi hoàn thành công việc trên tài nguyên đó, tiến trình sẽ tăng giá trị semaphore để tài nguyên chia sẻ được giải phóng cho tiến trình khác sử dụng. Việc sử dụng semaphore nhị phân (binary semaphore) — một semaphore có giá trị bị giới hạn ở 0 hoặc 1 — là rất phổ biến. Tuy nhiên, một ứng dụng xử lý nhiều thực thể (instance) của một tài nguyên chia sẻ sẽ sử dụng một semaphore có giá trị tối đa bằng số lượng tài nguyên chia sẻ đó. Linux cung cấp cả System V semaphore và POSIX semaphore, có chức năng cơ bản giống nhau.
- Khóa tệp (File locks): Khóa tệp là một phương pháp đồng bộ được thiết kế rõ ràng để phối hợp các hành động của nhiều tiến trình cùng thao tác trên một tệp. Chúng cũng có thể được sử dụng để điều phối quyền truy cập vào các tài nguyên chia sẻ khác. Khóa tệp có hai loại: khóa đọc (chia sẻ - read/shared locks) và khóa ghi (độc quyền - write/exclusive locks). Bất kỳ số lượng tiến trình nào cũng có thể giữ khóa đọc trên cùng một tệp (hoặc vùng của một tệp). Tuy nhiên, khi một tiến trình giữ khóa ghi trên một tệp (hoặc vùng tệp), các tiến trình khác sẽ bị ngăn không cho giữ cả khóa đọc hoặc khóa ghi trên tệp (hoặc vùng tệp) đó. Linux cung cấp các cơ chế khóa tệp thông qua các system call (lời gọi hệ thống) `flock()` và `fcntl()`. System call `flock()` cung cấp một cơ chế khóa đơn giản, cho phép các tiến trình đặt khóa chia sẻ hoặc khóa độc quyền trên toàn bộ tệp. Do tính năng bị hạn chế, cơ chế khóa `flock()` ngày nay ít khi được sử dụng. System call `fcntl()` cung cấp cơ chế khóa bản ghi (record locking), cho phép các tiến trình đặt nhiều khóa đọc và khóa ghi trên các vùng khác nhau của cùng một tệp.
- Mutex và biến điều kiện (Condition variables): Các cơ chế đồng bộ này thường được sử dụng với các luồng POSIX (POSIX threads), như được mô tả trong Chương 30.

Một số bản triển khai UNIX, bao gồm các hệ thống Linux có sử dụng glibc cung cấp cơ chế luồng NPTL (Native POSIX Thread Library), cũng cho phép mutex và biến điều kiện được chia sẻ giữa các tiến trình. SUSv3 cho phép, nhưng không bắt buộc, một bản triển khai phải hỗ trợ mutex và biến điều kiện chia sẻ giữa các tiến trình. Chúng không có sẵn trên tất cả các hệ thống UNIX, và do đó không được sử dụng phổ biến cho việc đồng bộ hóa tiến trình.

Khi thực hiện đồng bộ hóa giữa các tiến trình (interprocess synchronization), việc lựa chọn cơ chế thường được quyết định bởi các yêu cầu chức năng. Khi điều phối quyền truy cập vào một tệp, khóa bản ghi tệp (file record locking) thường là lựa chọn tốt nhất. Semaphore thường là lựa chọn tốt hơn để điều phối quyền truy cập vào các loại tài nguyên chia sẻ khác.

Các cơ chế truyền thông (communication facilities) cũng có thể được sử dụng để đồng bộ hóa. Ví dụ, trong Mục [44.3,](#page-20-0) chúng tôi chỉ ra cách một đường ống (pipe) có thể được sử dụng để đồng bộ hóa các hành động của tiến trình cha với các tiến trình con của nó. Tổng quát hơn, bất kỳ cơ chế truyền dữ liệu nào cũng có thể được sử dụng để đồng bộ hóa, với thao tác đồng bộ mang hình thức trao đổi thông điệp thông qua cơ chế đó.

> [!NOTE]
> Kể từ kernel phiên bản 2.6.22, Linux cung cấp một cơ chế đồng bộ bổ sung, không chuẩn thông qua system call `eventfd()`. System call này tạo ra một đối tượng `eventfd` có một số nguyên không dấu 8-byte đi kèm được duy trì bởi kernel. System call trả về một file descriptor (mô tả tệp) trỏ đến đối tượng đó. Việc ghi một số nguyên vào file descriptor này sẽ cộng số nguyên đó vào giá trị của đối tượng. Thao tác `read()` từ file descriptor sẽ bị chặn (block) nếu giá trị của đối tượng bằng 0. Nếu đối tượng có giá trị khác 0, thao tác `read()` sẽ trả về giá trị đó và đặt lại nó về 0. Ngoài ra, `poll()`, `select()`, hoặc `epoll` có thể được sử dụng để kiểm tra xem đối tượng có giá trị khác 0 hay không; nếu có, file descriptor cho biết nó ở trạng thái có thể đọc (readable). Một ứng dụng muốn sử dụng đối tượng `eventfd` để đồng bộ hóa trước tiên phải tạo đối tượng bằng `eventfd()`, sau đó gọi `fork()` để tạo các tiến trình có liên quan nhằm kế thừa các file descriptor trỏ đến đối tượng đó. Để biết thêm chi tiết, hãy xem trang tài liệu hướng dẫn (manual page) `eventfd(2)`.

## 43.4 So sánh các cơ chế IPC

Khi nói đến IPC (Inter-Process Communication - Giao tiếp giữa các tiến trình), chúng ta đối mặt với hàng loạt lựa chọn mà thoạt đầu có vẻ gây hoang mang. Trong các chương sau mô tả chi tiết từng cơ chế IPC, chúng tôi bao gồm các phần so sánh từng cơ chế với các cơ chế tương tự khác. Trong các trang tiếp theo, chúng ta sẽ xem xét một số điểm chung có thể quyết định việc lựa chọn cơ chế IPC.

## Nhận diện đối tượng IPC và định danh (handle) cho các đối tượng đã mở

Để truy cập một đối tượng IPC, tiến trình (process) phải có một số cách để nhận diện đối tượng đó, và một khi đối tượng đã được "mở", tiến trình phải sử dụng một loại định danh (handle) nào đó để tham chiếu đến đối tượng đã mở. [Bảng 43-1](#page-5-0) tóm tắt các thuộc tính này cho các loại cơ chế IPC khác nhau.

**Bảng 43-1:** Định danh và Handle dùng cho các loại cơ chế IPC khác nhau

| Loại cơ chế | Tên dùng để<br>nhận diện đối tượng | Handle dùng để tham chiếu<br>đối tượng trong chương trình |
|-------------------------|---------------------------------|-----------------------------------------------|
| Pipe (Đường ống) | không có tên | file descriptor (mô tả tệp) |
| FIFO | đường dẫn (pathname) | file descriptor |
| UNIX domain socket | đường dẫn (pathname) | file descriptor |
| Internet domain socket | địa chỉ IP + số cổng (port number) | file descriptor |
| Hàng đợi thông điệp System V (System V message queue) | khóa IPC System V (System V IPC key) | định danh IPC System V (System V IPC identifier) |
| Semaphore System V (System V semaphore) | khóa IPC System V (System V IPC key) | định danh IPC System V (System V IPC identifier) |
| Bộ nhớ chia sẻ System V (System V shared memory) | khóa IPC System V (System V IPC key) | định danh IPC System V (System V IPC identifier) |
| Hàng đợi thông điệp POSIX (POSIX message queue) | đường dẫn IPC POSIX (POSIX IPC pathname) | mqd_t (mô tả hàng đợi thông điệp - message queue descriptor) |
| Semaphore có tên POSIX (POSIX named semaphore) | đường dẫn IPC POSIX (POSIX IPC pathname) | sem_t * (con trỏ semaphore - semaphore pointer) |
| Semaphore không tên POSIX (POSIX unnamed semaphore) | không có tên | sem_t * (con trỏ semaphore) |
| Bộ nhớ chia sẻ POSIX (POSIX shared memory) | đường dẫn IPC POSIX (POSIX IPC pathname) | file descriptor |
| Ánh xạ ẩn danh (Anonymous mapping) | không có tên | không có |
| Tệp ánh xạ bộ nhớ (Memory-mapped file) | đường dẫn (pathname) | file descriptor |
| Khóa flock() | đường dẫn (pathname) | file descriptor |
| Khóa fcntl() | đường dẫn (pathname) | file descriptor |

### Tính năng

Có những khác biệt về tính năng giữa các cơ chế IPC (Interprocess Communication) khác nhau, điều này có thể quan trọng trong việc quyết định nên sử dụng cơ chế nào. Chúng ta bắt đầu bằng việc tóm tắt các điểm khác biệt giữa các cơ chế truyền dữ liệu (data-transfer) và bộ nhớ chia sẻ (shared memory):

- Các cơ chế truyền dữ liệu liên quan đến các thao tác đọc và ghi (read and write operations), trong đó dữ liệu được truyền đi chỉ có thể được tiêu thụ bởi một tiến trình (process) đọc duy nhất. Việc điều khiển luồng (flow control) giữa tiến trình ghi và tiến trình đọc, cũng như sự đồng bộ hóa (synchronization) — để một tiến trình đọc bị chặn (block) khi cố gắng đọc dữ liệu từ một cơ chế hiện đang trống — được xử lý tự động bởi kernel (nhân). Mô hình này rất phù hợp với nhiều thiết kế ứng dụng.
- Các thiết kế ứng dụng khác lại phù hợp hơn một cách tự nhiên với mô hình bộ nhớ chia sẻ. Bộ nhớ chia sẻ cho phép một tiến trình làm cho dữ liệu có thể hiển thị với bất kỳ số lượng tiến trình khác nào cùng chia sẻ một vùng nhớ (memory region). Các "thao tác" giao tiếp rất đơn giản — một tiến trình có thể truy cập dữ liệu trong bộ nhớ chia sẻ theo cách tương tự như cách nó truy cập bất kỳ bộ nhớ nào khác trong không gian địa chỉ ảo (virtual address space) của nó. Mặt khác, nhu cầu phải xử lý đồng bộ hóa (và có lẽ cả điều khiển luồng) có thể làm tăng độ phức tạp của một thiết kế bộ nhớ chia sẻ. Mô hình này rất phù hợp với các thiết kế ứng dụng cần duy trì trạng thái chia sẻ (ví dụ: một cấu trúc dữ liệu được chia sẻ).

Liên quan đến các cơ chế truyền dữ liệu khác nhau, các điểm sau đây rất đáng chú ý:

- Một số cơ chế truyền dữ liệu truyền dữ liệu dưới dạng luồng byte (byte stream) (pipes, FIFOs, và stream sockets); các cơ chế khác hướng thông điệp (message-oriented) (message queues và datagram sockets). Cách tiếp cận nào ưu việt hơn tùy thuộc vào ứng dụng. (Một ứng dụng cũng có thể áp dụng mô hình hướng thông điệp lên một cơ chế luồng byte, bằng cách sử dụng các ký tự phân tách, thông điệp có độ dài cố định, hoặc các tiêu đề thông điệp mã hóa tổng chiều dài thông điệp; xem Mục [44.8.](#page-32-0))
- Một tính năng đặc biệt của hàng đợi thông điệp System V (System V message queues) và POSIX (POSIX message queues), so với các cơ chế truyền dữ liệu khác, là khả năng gán một kiểu số hoặc mức ưu tiên cho một thông điệp, để các thông điệp có thể được phân phối theo thứ tự khác với thứ tự chúng được gửi đi.
- Pipes, FIFOs, và sockets được thực thi bằng cách sử dụng các bộ mô tả tệp (file descriptors). Tất cả các cơ chế IPC này đều hỗ trợ một loạt các mô hình I/O thay thế mà chúng ta mô tả trong Chương 63: I/O đa kênh (I/O multiplexing) (các system call `select()` và `poll()`), I/O điều khiển theo tín hiệu (signal-driven I/O), và API `epoll` đặc trưng của Linux. Lợi ích chính của các kỹ thuật này là chúng cho phép một ứng dụng đồng thời giám sát nhiều file descriptor để xem liệu I/O có khả thi trên bất kỳ bộ mô tả nào trong số đó hay không. Ngược lại, hàng đợi thông điệp System V không sử dụng file descriptor và không hỗ trợ các kỹ thuật này.

Trên Linux, hàng đợi thông điệp POSIX cũng được thực thi bằng cách sử dụng file descriptor và hỗ trợ các kỹ thuật I/O thay thế được mô tả ở trên. Tuy nhiên, hành vi này không được quy định trong SUSv3, và không được hỗ trợ trên hầu hết các bản thực thi khác.

Hàng đợi thông điệp POSIX cung cấp một cơ chế thông báo (notification facility) có thể gửi một tín hiệu đến một tiến trình, hoặc khởi tạo một thread (luồng) mới, khi một thông điệp đến một hàng đợi trước đó đang trống.

- UNIX domain sockets cung cấp một tính năng cho phép một file descriptor được truyền từ tiến trình này sang tiến trình khác. Điều này cho phép một tiến trình mở một tệp và làm cho nó có sẵn cho một tiến trình khác mà nếu không thì có thể không truy cập được tệp đó. Chúng ta mô tả ngắn gọn tính năng này trong Mục 61.13.3.
- UDP (Internet domain datagram) sockets cho phép một bên gửi phát sóng (broadcast) hoặc đa phát (multicast) một thông điệp tới nhiều người nhận. Chúng ta mô tả ngắn gọn tính năng này trong Mục 61.12.

Liên quan đến các cơ chế đồng bộ hóa tiến trình (process-synchronization facilities), các điểm sau đây rất đáng chú ý:

- Khóa bản ghi (record locks) được thiết lập bằng cách sử dụng `fcntl()` được coi là thuộc sở hữu của tiến trình đặt khóa. Kernel sử dụng thuộc tính quyền sở hữu này để phát hiện deadlock (tình trạng bế tắc) (các tình huống mà từ hai tiến trình trở lên đang giữ các khóa làm chặn các yêu cầu khóa tiếp theo của nhau). Nếu tình huống deadlock xảy ra, kernel sẽ từ chối yêu cầu khóa của một trong các tiến trình, trả về một mã lỗi từ lời gọi `fcntl()` để chỉ ra rằng đã xảy ra deadlock. Các semaphore của System V và POSIX không có thuộc tính quyền sở hữu; không có việc phát hiện deadlock nào diễn ra đối với các semaphore.
- Khóa bản ghi được thiết lập bằng cách sử dụng `fcntl()` sẽ tự động được giải phóng khi tiến trình sở hữu các khóa đó chấm dứt (terminate). Semaphore System V cung cấp một tính năng tương tự dưới dạng tính năng "undo", nhưng tính năng này không đáng tin cậy trong mọi hoàn cảnh (Mục [47.8](#page-109-0)). Semaphore POSIX không cung cấp tính năng tương đương nào cho tính năng này.

### Truyền thông mạng (Network communication)

Trong số tất cả các phương pháp IPC (Inter-Process Communication) được thể hiện ở [Hình 43-1,](#page-1-0) chỉ có các ổ cắm (sockets) cho phép các tiến trình (processes) giao tiếp qua mạng. Sockets thường được sử dụng trong một trong hai miền (domains): miền UNIX (UNIX domain), cho phép giao tiếp giữa các tiến trình trên cùng một hệ thống và miền Internet (Internet domain), cho phép giao tiếp giữa các tiến trình trên các máy chủ (hosts) khác nhau được kết nối qua mạng TCP/IP. Thông thường, chỉ cần những thay đổi nhỏ để chuyển đổi một chương trình sử dụng UNIX domain sockets sang sử dụng Internet domain sockets, do đó một ứng dụng được xây dựng bằng UNIX domain sockets có thể có khả năng truyền thông mạng với lượng công việc tương đối ít.

## Tính di động (Portability)

Các cài đặt UNIX hiện đại hỗ trợ hầu hết các cơ chế IPC được thể hiện trong [Hình 43-1.](#page-1-0) Tuy nhiên, các cơ chế POSIX IPC (hàng đợi thông tin - message queues, semaphores, và bộ nhớ chia sẻ - shared memory) không được hỗ trợ rộng rãi bằng các cơ chế tương đương trong System V IPC, đặc biệt là trên các hệ thống UNIX cũ hơn. (Việc cài đặt POSIX message queues và hỗ trợ đầy đủ cho POSIX semaphores chỉ xuất hiện trên Linux từ dòng kernel 2.6.x). Do đó, từ góc độ tính di động (portability), System V IPC có thể được ưu tiên hơn so với POSIX IPC.

## Các vấn đề thiết kế System V IPC

Các cơ chế System V IPC được thiết kế độc lập với mô hình I/O UNIX truyền thống, và do đó gặp phải một số điểm đặc thù khiến cho các giao diện lập trình của chúng trở nên phức tạp hơn khi sử dụng. Các cơ chế POSIX IPC tương ứng được thiết kế để giải quyết những vấn đề này. Các điểm sau đây là đáng chú ý nhất:

- Các cơ chế System V IPC không có kết nối (connectionless). Các cơ chế này không cung cấp khái niệm về một handle (như file descriptor - bộ mô tả tệp) tham chiếu đến một đối tượng IPC đang mở. Trong các chương sau, đôi khi chúng ta sẽ nói về việc "mở" (opening) một đối tượng System V IPC, nhưng đây thực chất chỉ là cách viết tắt để mô tả quá trình lấy một handle để tham chiếu đến đối tượng đó. Kernel không ghi nhận tiến trình là đã "mở" đối tượng (không giống như các loại đối tượng IPC khác). Điều này có nghĩa là kernel không thể duy trì bộ đếm tham chiếu (reference count) về số lượng tiến trình hiện đang sử dụng một đối tượng. Do đó, ứng dụng có thể phải tốn thêm công sức lập trình để biết khi nào một đối tượng có thể được xóa một cách an toàn.
- Các giao diện lập trình cho các cơ chế System V IPC không nhất quán với mô hình I/O UNIX truyền thống (chúng sử dụng các giá trị khóa dạng số nguyên - integer key values và định danh IPC - IPC identifiers thay vì tên đường dẫn - pathnames và file descriptors). Các giao diện lập trình cũng quá phức tạp. Điểm cuối cùng này đặc biệt áp dụng cho System V semaphores (tham khảo các Mục [47.11](#page-116-0) và 53.5).

Ngược lại, kernel đếm các tham chiếu mở đối với các đối tượng POSIX IPC. Điều này đơn giản hóa các quyết định về thời điểm một đối tượng có thể bị xóa. Hơn nữa, các cơ chế POSIX IPC cung cấp một giao diện đơn giản hơn và nhất quán hơn với mô hình UNIX truyền thống.

### Khả năng truy cập (Accessibility)

Cột thứ hai của [Bảng 43-2](#page-9-0) tóm tắt một đặc điểm quan trọng của từng loại đối tượng IPC (Inter-Process Communication): cơ chế phân quyền chi phối tiến trình (process) nào có thể truy cập vào đối tượng đó. Danh sách dưới đây bổ sung một số chi tiết về các cơ chế khác nhau:

- Đối với một số cơ chế IPC (ví dụ: FIFO và socket), tên đối tượng nằm trong hệ thống tập tin (file system) và khả năng truy cập được xác định dựa trên mặt nạ quyền hạn tập tin (file permissions mask) đi kèm, quy định quyền cho chủ sở hữu (owner), nhóm (group) và người dùng khác (other) (Mục 15.4). Mặc dù các đối tượng System V IPC không nằm trong hệ thống tập tin, mỗi đối tượng đều có một mặt nạ quyền hạn đi kèm với ngữ nghĩa tương tự như đối với các tập tin.
- Một số ít cơ chế IPC (pipe, ánh xạ bộ nhớ ẩn danh - anonymous memory mapping) được đánh dấu là chỉ có thể được truy cập bởi các tiến trình có quan hệ họ hàng (related processes). Ở đây, "có quan hệ họ hàng" có nghĩa là liên quan thông qua hàm `fork()`. Để hai tiến trình có thể truy cập đối tượng, một trong số chúng phải tạo đối tượng rồi gọi `fork()`. Hệ quả của việc gọi `fork()` là tiến trình con (child process) kế thừa một định danh (handle) trỏ đến đối tượng, cho phép cả hai tiến trình cùng chia sẻ đối tượng đó.
- Khả năng truy cập của một semaphore ẩn danh POSIX (POSIX unnamed semaphore) được quyết định bởi khả năng truy cập của vùng bộ nhớ chia sẻ (shared memory region) chứa semaphore đó.
- Để đặt một khóa (lock) lên một tập tin, tiến trình bắt buộc phải có một mô tả tập tin (file descriptor) trỏ đến tập tin đó (tức là trong thực tế, tiến trình phải có quyền mở tập tin đó).
- Không có hạn chế nào đối với việc truy cập (tức là kết nối hoặc gửi một datagram đến) một socket miền Internet (Internet domain socket). Nếu cần thiết, việc kiểm soát truy cập phải được triển khai ở tầng ứng dụng.

**Bảng 43-2:** Khả năng truy cập và tính bền vững đối với các loại cơ chế IPC khác nhau

| Loại cơ chế             | Khả năng truy cập                | Tính bền vững (Persistence) |
|-------------------------|----------------------------------|-------------|
| Pipe                    | Chỉ bởi các tiến trình có họ hàng| Tiến trình  |
| FIFO                    | Mặt nạ quyền hạn                 | Tiến trình  |
| UNIX domain socket      | Mặt nạ quyền hạn                 | Tiến trình  |
| Internet domain socket  | Bởi bất kỳ tiến trình nào        | Tiến trình  |
| System V message queue  | Mặt nạ quyền hạn                 | Kernel      |
| System V semaphore      | Mặt nạ quyền hạn                 | Kernel      |
| System V shared memory  | Mặt nạ quyền hạn                 | Kernel      |
| POSIX message queue     | Mặt nạ quyền hạn                 | Kernel      |
| POSIX named semaphore   | Mặt nạ quyền hạn                 | Kernel      |
| POSIX unnamed semaphore | Quyền của vùng nhớ cơ sở         | Tùy thuộc   |
| POSIX shared memory     | Mặt nạ quyền hạn                 | Kernel      |
| Anonymous mapping       | Chỉ bởi các tiến trình có họ hàng| Tiến trình  |
| Memory-mapped file      | Mặt nạ quyền hạn                 | Hệ thống tập tin |
| flock() file lock       | Thao tác open() của tập tin      | Tiến trình  |
| fcntl() file lock       | Thao tác open() của tập tin      | Tiến trình  |

## Tính bền bỉ (Persistence)

Thuật ngữ tính bền bỉ (persistence) đề cập đến vòng đời (lifetime) của một đối tượng IPC (IPC object). (Tham khảo cột thứ ba của [Bảng 43-2.](#page-9-0)). Chúng ta có thể phân biệt ba loại tính bền bỉ:

- Tính bền bỉ theo tiến trình (Process persistence): Một đối tượng IPC có tính bền bỉ theo tiến trình sẽ tiếp tục tồn tại chừng nào nó còn được mở bởi ít nhất một tiến trình (process). Nếu đối tượng bị đóng bởi tất cả các tiến trình, thì toàn bộ tài nguyên kernel (kernel resource) liên kết với đối tượng đó sẽ được giải phóng và mọi dữ liệu chưa đọc sẽ bị tiêu hủy. Pipe, FIFO và socket là các ví dụ về cơ chế IPC có tính bền bỉ theo tiến trình.

> [!NOTE]
> Tính bền bỉ của dữ liệu trong một FIFO không giống với tính bền bỉ của tên FIFO đó. Một FIFO có tên trong hệ thống tập tin (file system) vẫn tiếp tục tồn tại ngay cả sau khi tất cả các bộ mô tả tập tin (file descriptor) tham chiếu đến FIFO đó đã bị đóng.

- Tính bền bỉ theo kernel (Kernel persistence): Một đối tượng IPC có tính bền bỉ theo kernel sẽ tồn tại cho đến khi nó bị xóa một cách rõ ràng hoặc hệ thống bị tắt nguồn (shutdown). Vòng đời của đối tượng này độc lập với việc có bất kỳ tiến trình nào đang giữ mở đối tượng hay không. Điều này có nghĩa là, ví dụ, một tiến trình có thể tạo ra một đối tượng, ghi dữ liệu vào đó, rồi sau đó đóng nó lại (hoặc kết thúc tiến trình). Ở thời điểm sau đó, một tiến trình khác có thể mở đối tượng đó và đọc dữ liệu. Các ví dụ về cơ chế có tính bền bỉ theo kernel là System V IPC và POSIX IPC. Chúng ta tận dụng đặc tính này trong các chương trình mẫu được trình bày khi mô tả các cơ chế này ở các chương sau: đối với mỗi cơ chế, chúng ta triển khai các chương trình riêng biệt để tạo một đối tượng, xóa một đối tượng, và thực hiện truyền thông hoặc đồng bộ hóa (synchronization).
- Tính bền bỉ theo hệ thống tập tin (File-system persistence): Một đối tượng IPC có tính bền bỉ theo hệ thống tập tin vẫn giữ lại thông tin của nó ngay cả khi hệ thống được khởi động lại (reboot). Đối tượng tiếp tục tồn tại cho đến khi nó bị xóa một cách tường minh. Loại đối tượng IPC duy nhất thể hiện tính bền bỉ theo hệ thống tập tin là bộ nhớ chia sẻ (shared memory) dựa trên tập tin ánh xạ bộ nhớ (memory-mapped file).

## Hiệu năng (Performance)

Trong một số hoàn cảnh, các cơ chế IPC khác nhau có thể cho thấy sự khác biệt đáng kể về hiệu năng. Tuy nhiên, trong các chương sau, chúng ta nhìn chung sẽ tránh đưa ra các so sánh về hiệu năng, vì những lý do sau:

- Hiệu năng của một cơ chế IPC có thể không phải là nhân tố quyết định lớn đến hiệu năng tổng thể của một ứng dụng, và nó có thể không phải là yếu tố duy nhất để quyết định lựa chọn một cơ chế IPC.
- Hiệu năng tương đối giữa các cơ chế IPC khác nhau có thể thay đổi tùy theo các bản cài đặt UNIX hoặc giữa các phiên bản khác nhau của Linux kernel.
- Quan trọng nhất là, hiệu năng của một cơ chế IPC sẽ thay đổi tùy thuộc vào cách thức và môi trường chính xác mà nó được sử dụng. Các yếu tố liên quan bao gồm kích thước của các đơn vị dữ liệu được trao đổi trong mỗi thao tác IPC, lượng dữ liệu chưa đọc có thể đang tồn đọng trên cơ chế IPC, việc có hay không yêu cầu chuyển đổi ngữ cảnh tiến trình (process context switch) cho mỗi đơn vị dữ liệu được trao đổi, và tải công việc (load) khác trên hệ thống.

Nếu hiệu năng IPC là tối quan trọng, thì không có giải pháp nào thay thế được các chuẩn mực đánh giá hiệu năng (benchmark) đặc thù của ứng dụng được chạy trong một môi trường khớp với hệ thống mục tiêu. Để đạt được điều này, việc viết một lớp phần mềm trừu tượng (abstract software layer) ẩn đi các chi tiết về cơ chế IPC khỏi ứng dụng, sau đó kiểm tra hiệu năng khi thay thế các cơ chế IPC khác nhau bên dưới lớp trừu tượng đó, có thể là một việc đáng làm.

## 43.5 Tóm tắt

Trong chương này, chúng ta đã cung cấp một cái nhìn tổng quan về các cơ chế (facility) khác nhau mà các tiến trình (process) và luồng (thread) có thể sử dụng để giao tiếp với nhau và đồng bộ hóa các hoạt động của chúng.

Trong số các cơ chế giao tiếp được cung cấp trên Linux có đường ống (pipe), FIFO, socket, hàng đợi thông điệp (message queue) và bộ nhớ chia sẻ (shared memory). Các cơ chế đồng bộ hóa được cung cấp trên Linux bao gồm semaphore và khóa tập tin (file lock).

Trong nhiều trường hợp, chúng ta có một số lựa chọn về các kỹ thuật khác nhau cho việc giao tiếp và đồng bộ hóa khi thực hiện một tác vụ cụ thể. Trong xuyên suốt chương này, chúng ta đã so sánh các kỹ thuật khác nhau theo nhiều khía cạnh, nhằm làm nổi bật một số điểm khác biệt có thể ảnh hưởng đến việc lựa chọn kỹ thuật này thay vì kỹ thuật khác.

Trong các chương tiếp theo, chúng ta sẽ đi sâu vào chi tiết từng cơ chế giao tiếp và đồng bộ hóa.

## 43.6 Bài tập

**43-1.** Viết một chương trình đo lường băng thông (bandwidth) được cung cấp bởi các đường ống (pipe). Dưới dạng các đối số dòng lệnh (command-line argument), chương trình nên nhận số lượng khối dữ liệu cần gửi và kích thước của mỗi khối dữ liệu. Sau khi tạo một pipe, chương trình tách thành hai tiến trình: một tiến trình con ghi các khối dữ liệu vào pipe càng nhanh càng tốt và một tiến trình cha đọc các khối dữ liệu đó. Sau khi tất cả dữ liệu đã được đọc, tiến trình cha phải in ra thời gian đã trôi qua cần thiết và băng thông (số byte được truyền tải trên giây). Đo lường băng thông cho các kích thước khối dữ liệu khác nhau.

**43-2.** Lặp lại bài tập trước đối với hàng đợi thông điệp System V (System V message queue), hàng đợi thông điệp POSIX (POSIX message queue), socket miền UNIX kiểu luồng (UNIX domain stream socket) và socket miền UNIX kiểu datagram (UNIX domain datagram socket). Sử dụng các chương trình này để so sánh hiệu năng tương đối của các cơ chế IPC (Interprocess Communication) khác nhau trên Linux. Nếu bạn có quyền truy cập vào các hệ thống cài đặt UNIX khác, hãy thực hiện các phép so sánh tương tự trên các hệ thống đó.
