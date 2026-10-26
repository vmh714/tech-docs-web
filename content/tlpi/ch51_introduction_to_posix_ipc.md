## Chapter 51

## GIỚI THIỆU VỀ POSIX IPC

Các phần mở rộng thời gian thực POSIX.1b (realtime extensions) định nghĩa một tập hợp các cơ chế IPC (Inter-Process Communication) tương tự như các cơ chế System V IPC được mô tả trong Chương 45 đến 48. (Một trong những mục tiêu của các nhà phát triển POSIX.1b là thiết kế một tập hợp các cơ chế IPC không mắc phải các nhược điểm của cơ sở hạ tầng System V IPC.) Các cơ chế IPC này được gọi chung là POSIX IPC. Ba cơ chế POSIX IPC bao gồm:

- Hàng đợi thông điệp (Message queues) có thể được sử dụng để truyền thông điệp giữa các tiến trình (process). Giống như hàng đợi thông điệp System V, ranh giới thông điệp được bảo toàn, do đó người đọc (reader) và người ghi (writer) giao tiếp theo từng đơn vị thông điệp (trái ngược với luồng byte không phân định - undelimited byte stream do pipe cung cấp). Hàng đợi thông điệp POSIX cho phép gán mức độ ưu tiên (priority) cho mỗi thông điệp, cho phép các thông điệp có độ ưu tiên cao được đưa vào hàng đợi trước các thông điệp có độ ưu tiên thấp. Điều này cung cấp một số tính năng tương tự như tính năng có sẵn thông qua trường `type` của thông điệp System V.
- Semaphore cho phép nhiều tiến trình đồng bộ hóa (synchronize) các hoạt động của chúng. Giống như semaphore System V, semaphore POSIX là một số nguyên được kernel duy trì, có giá trị không bao giờ xuống dưới 0. Semaphore POSIX dễ sử dụng hơn semaphore System V: chúng được cấp phát riêng lẻ (trái ngược với các tập hợp semaphore - semaphore sets của System V), và được thao tác riêng lẻ bằng hai thao tác làm tăng và giảm giá trị của semaphore đi một đơn vị (trái ngược với khả năng của System Call `semop()` là thêm hoặc bớt các giá trị tùy ý một cách nguyên tử - atomically từ nhiều semaphore trong một tập hợp semaphore System V).

Bộ nhớ chia sẻ (Shared memory) cho phép nhiều tiến trình chia sẻ cùng một vùng nhớ. Giống như bộ nhớ chia sẻ System V, bộ nhớ chia sẻ POSIX cung cấp IPC tốc độ cao. Ngay sau khi một tiến trình cập nhật bộ nhớ chia sẻ, sự thay đổi sẽ hiển thị ngay lập tức đối với các tiến trình khác đang chia sẻ cùng vùng đó.

Chương này cung cấp cái nhìn tổng quan về các cơ sở hạ tầng POSIX IPC, tập trung vào các tính năng chung của chúng.

## 51.1 Tổng quan về API

Ba cơ chế POSIX IPC có một số tính năng chung. Bảng 51-1 tóm tắt các API của chúng và chúng ta sẽ đi vào chi tiết các tính năng chung của chúng trong những trang tiếp theo.

> Ngoại trừ một đề cập trong Bảng 51-1, trong phần còn lại của chương này, chúng ta sẽ bỏ qua thực tế là semaphore POSIX có hai loại: semaphore có tên (named semaphores) và semaphore không tên (unnamed semaphores). Semaphore có tên giống như các cơ chế POSIX IPC khác mà chúng ta mô tả trong chương này: chúng được nhận dạng bằng một tên và có thể được truy cập bởi bất kỳ tiến trình nào có quyền thích hợp đối với đối tượng đó. Semaphore không tên không có định danh liên kết; thay vào đó, nó được đặt trong một vùng nhớ được chia sẻ bởi một nhóm tiến trình hoặc bởi các luồng (thread) của một tiến trình đơn. Chúng ta sẽ đi chi tiết vào cả hai loại semaphore trong Chương [53](#page-32-0).

**Bảng 51-1:** Tóm tắt các giao diện lập trình cho các đối tượng POSIX IPC

| Giao diện | Hàng đợi thông điệp (Message queues) | Semaphore | Bộ nhớ chia sẻ (Shared memory) |
|---------------|-----------------------|-----------------------------|-----------------------|
| Tệp tiêu đề (Header file) | <mqueue.h></mqueue.h> | <semaphore.h></semaphore.h> | <sys mman.h=""></sys> |
| Handle đối tượng | mqd_t | sem_t * | int (file descriptor) |
| Tạo/mở | `mq_open()` | `sem_open()` | `shm_open()` + `mmap()` |
| Đóng | `mq_close()` | `sem_close()` | `munmap()` |
| Hủy liên kết | `mq_unlink()` | `sem_unlink()` | `shm_unlink()` |
| Thực hiện IPC | `mq_send()`, | `sem_post()`, `sem_wait()`, | thao tác trên các vị trí |
| | `mq_receive()` | `sem_getvalue()` | trong vùng nhớ chia sẻ |
| Các thao tác | `mq_setattr()` — thiết lập | `sem_init()` — khởi tạo | (không có) |
| khác | thuộc tính | semaphore không tên | |
| | `mq_getattr()` — lấy | `sem_destroy()` — hủy | |
| | thuộc tính | semaphore không tên | |
| | `mq_notify()` — yêu cầu | | |
| | thông báo | | |

### Tên đối tượng IPC (IPC object names)

Để truy cập một đối tượng POSIX IPC, chúng ta phải có một số phương tiện để nhận dạng nó. Phương tiện khảportable (di động) duy nhất mà SUSv3 chỉ định để nhận dạng một đối tượng POSIX IPC là thông qua một tên bao gồm một dấu gạch chéo ở đầu, theo sau là một hoặc nhiều ký tự không phải dấu gạch chéo; ví dụ: `/myobject`. Linux và một số hệ thống triển khai khác (ví dụ: Solaris) cho phép kiểu đặt tên có tính di động này cho các đối tượng IPC.

Trên Linux, tên cho các đối tượng bộ nhớ chia sẻ POSIX và hàng đợi thông điệp bị giới hạn ở `NAME_MAX` (255) ký tự. Đối với semaphore, giới hạn ít hơn 4 ký tự, vì hệ thống triển khai sẽ nối thêm chuỗi `sem.` vào trước tên của semaphore.

SUSv3 không cấm các tên có định dạng khác ngoài `/myobject`, nhưng nêu rõ rằng ngữ nghĩa của các tên đó do hiện thực (implementation-defined) quyết định. Các quy tắc tạo tên đối tượng IPC trên một số hệ thống là khác nhau. Ví dụ, trên Tru64 5.1, tên đối tượng IPC được tạo dưới dạng các tên bên trong hệ thống tập tin (file system) tiêu chuẩn và tên này được diễn giải là một đường dẫn tuyệt đối hoặc tương đối. Nếu tiến trình gọi (caller) không có quyền tạo tệp trong thư mục đó, thì lệnh gọi mở IPC sẽ thất bại. Điều này có nghĩa là các chương trình không có đặc quyền (unprivileged programs) không thể tạo tên có định dạng `/myobject` trên Tru64, vì người dùng không có đặc quyền thông thường không thể tạo tệp trong thư mục gốc (`/`). Một số hiện thực khác cũng có các quy tắc đặc thù tương tự đối với việc cấu trúc tên được truyền vào các lệnh gọi mở IPC. Do đó, trong các ứng dụng di portable (portable applications), chúng ta nên tách việc tạo tên đối tượng IPC thành một hàm riêng biệt hoặc một tệp tiêu đề (header file) có thể được tùy chỉnh cho hệ thống hiện thực đích.

### Tạo hoặc mở một đối tượng IPC

Mỗi cơ chế IPC đều có một lệnh gọi mở tương ứng (`mq_open()`, `sem_open()`, hoặc `shm_open()`), tương tự như System Call `open()` truyền thống của UNIX dùng cho các tệp. Với một tên đối tượng IPC cho trước, lệnh gọi mở IPC sẽ thực hiện một trong hai hành động sau:

- tạo một đối tượng mới với tên đã cho, mở đối tượng đó và trả về một handle (tay cầm/thẻ định danh); hoặc
- mở một đối tượng đã tồn tại và trả về một handle cho đối tượng đó.

Handle do lệnh gọi mở IPC trả về tương tự như File Descriptor do System Call `open()` truyền thống trả về — nó được sử dụng trong các lệnh gọi tiếp theo để tham chiếu đến đối tượng.

Loại handle trả về bởi lệnh gọi mở IPC phụ thuộc vào loại đối tượng. Đối với hàng đợi thông điệp (message queues), đó là một descriptor hàng đợi thông điệp, có giá trị kiểu `mqd_t`. Đối với semaphores, đó là một con trỏ kiểu `sem_t *`. Đối với bộ nhớ chia sẻ (shared memory), đó là một File Descriptor.

Tất cả các lệnh gọi mở IPC đều cho phép ít nhất ba tham số — `name`, `oflag`, và `mode` — như được minh họa qua lệnh gọi `shm_open()` sau:

```c
fd = shm_open("/mymem", O_CREAT | O_RDWR, S_IRUSR | S_IWUSR);
```

Các tham số này tương tự như các tham số của System Call `open()` truyền thống trên UNIX. Tham số `name` dùng để định danh đối tượng cần tạo hoặc mở. Tham số `oflag` là một mặt nạ bit (bit mask) có thể bao gồm ít nhất các cờ sau:

O\_CREAT

Tạo đối tượng nếu nó chưa tồn tại. Nếu cờ này không được chỉ định và đối tượng không tồn tại, một lỗi sẽ xảy ra (`ENOENT`).

O\_EXCL

Nếu `O\_CREAT` đồng thời được chỉ định và đối tượng đã tồn tại, một lỗi sẽ xảy ra (`EEXIST`). Hai bước — kiểm tra sự tồn tại và tạo mới — được thực hiện một cách nguyên tử (atomic) (Mục 5.1). Cờ này không có tác dụng nếu `O\_CREAT` không được chỉ định.

Tùy thuộc vào loại đối tượng, `oflag` cũng có thể bao gồm một trong các giá trị `O_RDONLY`, `O_WRONLY`, hoặc `O_RDWR`, với ý nghĩa tương tự như trong `open()`. Các cờ bổ sung được phép sử dụng cho một số cơ chế IPC.

Tham số còn lại, `mode`, là một mặt nạ bit xác định các quyền sẽ được gán cho một đối tượng mới, nếu đối tượng đó được tạo bởi lệnh gọi (nghĩa là `O_CREAT` được chỉ định và đối tượng chưa tồn tại trước đó). Các giá trị có thể được chỉ định cho `mode` cũng giống như đối với các tệp (Bảng 15-4, trang 295). Giống như System Call `open()`, mặt nạ quyền trong `mode` sẽ được kết hợp (mask) với umask của Process (Mục 15.4.6). Quyền sở hữu người dùng (ownership) và quyền sở hữu nhóm (group ownership) của một đối tượng IPC mới được lấy từ User ID hiệu dụng (effective user ID) và Group ID hiệu dụng của tiến trình thực hiện lệnh gọi mở IPC. (Để chính xác hoàn toàn, trên Linux, quyền sở hữu của một đối tượng POSIX IPC mới được xác định bởi File-system ID của tiến trình, vốn thông thường có giá trị giống với các ID hiệu dụng tương ứng. Tham khảo Mục 9.5.)

> Trên các hệ thống mà các đối tượng IPC xuất hiện trong hệ thống tệp tiêu chuẩn, SUSv3 cho phép một hiện thực thiết lập Group ID của đối tượng IPC mới thành Group ID của thư mục cha.

### Đóng một đối tượng IPC

Đối với hàng đợi thông điệp POSIX (POSIX message queues) và semaphores, có một lệnh gọi đóng IPC (IPC close call) biểu thị rằng tiến trình gọi đã hoàn tất việc sử dụng đối tượng và hệ thống có thể giải deallocate (thu hồi) bất kỳ tài nguyên nào đã được liên kết với đối tượng cho tiến trình này. Một đối tượng bộ nhớ chia sẻ POSIX (POSIX shared memory object) được đóng bằng cách hủy ánh xạ (unmapping) nó với `munmap()`.

Các đối tượng IPC sẽ tự động được đóng nếu tiến trình kết thúc (terminate) hoặc thực thi một lệnh `exec()`.

### Quyền truy cập đối tượng IPC

Các đối tượng IPC có mặt nạ quyền truy cập giống như các tệp. Quyền truy cập vào một đối tượng IPC tương tự như quyền truy cập vào các tệp (Mục 15.4.3), ngoại trừ việc quyền thực thi (execute permission) không có ý nghĩa đối với các đối tượng POSIX IPC.

Kể từ kernel phiên bản 2.6.19, Linux hỗ trợ sử dụng danh sách điều khiển truy cập (Access Control Lists - ACLs) để thiết lập quyền trên các đối tượng bộ nhớ chia sẻ POSIX và semaphore có tên (named semaphores). Hiện tại, ACL chưa được hỗ trợ cho hàng đợi thông điệp POSIX.

### Xóa đối tượng IPC và tính bền vững của đối tượng

Giống như các tệp được mở (open files), các đối tượng POSIX IPC được quản lý bằng cơ chế đếm tham chiếu (reference counted)—kernel duy trì một số đếm các tham chiếu đang mở đến đối tượng. So với các đối tượng System V IPC, điều này giúp các ứng dụng dễ dàng xác định thời điểm đối tượng có thể bị xóa một cách an toàn.

Mỗi đối tượng IPC có một lời gọi hàm unlink tương ứng, hoạt động tương tự như System Call `unlink()` truyền thống dành cho tệp. Lời gọi unlink sẽ loại bỏ ngay lập tức tên của đối tượng, và sau đó hủy đối tượng khi tất cả các tiến trình (Process) ngừng sử dụng nó (tức là khi bộ đếm tham chiếu giảm về không). Đối với hàng đợi thông điệp (message queue) và semaphore, điều này có nghĩa là đối tượng bị hủy sau khi tất cả các tiến trình đã đóng đối tượng đó; đối với bộ nhớ chia sẻ (shared memory), việc hủy xảy ra sau khi tất cả các tiến trình đã hủy ánh xạ (unmap) đối tượng bằng cách sử dụng `munmap()`.

Sau khi một đối tượng bị unlink, các lời gọi mở IPC (IPC open calls) chỉ định cùng tên đối tượng sẽ tham chiếu đến một đối tượng mới (hoặc thất bại, nếu `O_CREAT` không được chỉ định).

Giống như System V IPC, các đối tượng POSIX IPC có tính bền vững của kernel (kernel persistence). Một khi đã được tạo, một đối tượng tiếp tục tồn tại cho đến khi nó bị unlink hoặc hệ thống tắt (shutdown). Điềuนี้ cho phép một tiến trình tạo ra một đối tượng, sửa đổi trạng thái của nó, và sau đó kết thúc, để lại đối tượng cho một tiến trình khác được khởi động vào thời điểm sau đó truy cập.

### Liệt kê và xóa các đối tượng POSIX IPC thông qua dòng lệnh

System V IPC cung cấp hai lệnh, `ipcs` và `ipcrm`, để liệt kê và xóa các đối tượng IPC. Không có lệnh chuẩn nào được cung cấp để thực hiện các tác vụ tương tự đối với các đối tượng POSIX IPC. Tuy nhiên, trên nhiều hệ thống, bao gồm cả Linux, các đối tượng IPC được thực thi bên trong một hệ thống tệp thực hoặc ảo (real or virtual file system), được gắn kết (mount) ở đâu đó dưới thư mục gốc (`/`), và các lệnh `ls` và `rm` chuẩn có thể được sử dụng để liệt kê và xóa các đối tượng IPC. (SUSv3 không quy định việc sử dụng `ls` và `rm` cho các tác vụ này). Vấn đề chính khi sử dụng các lệnh này là tính phi chuẩn của tên đối tượng POSIX IPC và vị trí của chúng trong hệ thống tệp (file system).

Trên Linux, các đối tượng POSIX IPC được chứa trong các hệ thống tệp ảo được gắn kết dưới các thư mục có bật bit sticky (sticky bit set). Bit này là cờ xóa hạn chế (restricted deletion flag) (Phần 15.4.5); việc bật nó có nghĩa là một tiến trình không có đặc quyền (unprivileged process) chỉ có thể unlink các đối tượng POSIX IPC do chính nó sở hữu.

### Biên dịch các chương trình sử dụng POSIX IPC trên Linux

Trên Linux, các chương trình sử dụng cơ chế POSIX IPC phải được liên kết (link) với thư viện thờigian thực, `librt`, bằng cách chỉ định tùy chọn `-lrt` cho lệnh `cc`.

## 51.2 So sánh System V IPC và POSIX IPC

Khi chúng ta xem xét các cơ chế POSIX IPC trong các chương tiếp theo, chúng ta sẽ so sánh từng cơ chế với đối phần tương ứng của nó trong System V. Ở đây, chúng ta xem xét một số so sánh tổng quát cho hai loại IPC này.

POSIX IPC có các ưu điểm chung sau khi so sánh với System V IPC:

- Giao diện POSIX IPC đơn giản hơn giao diện System V IPC.
- Mô hình POSIX IPC—việc sử dụng tên thay vì khóa (keys), và các hàm `open`, `close`, và `unlink`—nhất quán hơn với mô hình tệp UNIX truyền thống.
- Các đối tượng POSIX IPC được đếm tham chiếu (reference counted). Điều này đơn giản hóa việc xóa đối tượng, bởi vì chúng ta có thể unlink một đối tượng POSIX IPC mà biết rằng nó sẽ chỉ bị hủy khi tất cả các tiến trình đã đóng nó.

Tuy nhiên, có một ưu điểm đáng chú ý nghiêng về phía System V IPC: tính di port (portability). POSIX IPC ít tính di động hơn System V IPC ở các khía cạnh sau:

System V IPC được quy định trong SUSv3 và được hỗ trợ trên hầu hết mọi bản cài đặt UNIX. Ngược lại, mỗi cơ chế POSIX IPC là một thành phần tùy chọn trong SUSv3. Một số bản cài đặt UNIX không hỗ trợ (tất cả) các cơ chế POSIX IPC. Tình hình này phản ánh ở quy mô nhỏ trên Linux: bộ nhớ chia sẻ POSIX chỉ được hỗ trợ kể từ kernel 2.4; bản cài đặt đầy đủ của POSIX semaphore chỉ khả dụng kể từ kernel 2.6; và hàng đợi thông điệp POSIX chỉ được hỗ trợ kể từ kernel 2.6.6.

- Mặc dù có quy định của SUSv3 về tên đối tượng POSIX IPC, các bản cài đặt khác nhau tuân theo các quy ước khác nhau để đặt tên cho các đối tượng IPC. Những khác biệt này đòi hỏi chúng ta phải tốn thêm (một chút) công sức để viết các ứng dụng có tính di động.
- Các chi tiết khác nhau của POSIX IPC không được quy định trong SUSv3. Cụ thể, không có lệnh nào được quy định để hiển thị và xóa các đối tượng IPC tồn tại trên một hệ thống. (Trong nhiều bản cài đặt, các lệnh hệ thống tệp chuẩn được sử dụng, nhưng chi tiết về các đường dẫn (pathnames) được sử dụng để xác định các đối tượng IPC sẽ khác nhau).

## 51.3 Tóm tắt

POSIX IPC là tên chung được đặt cho ba cơ chế IPC—hàng đợi thông điệp (message queues), semaphores (semaphores), và bộ nhớ chia sẻ (shared memory)—được thiết kế bởi chuẩn POSIX.1b nhằm thay thế cho các cơ chế System V IPC tương tự.

Giao diện POSIX IPC nhất quán hơn với mô hình tệp (file) UNIX truyền thống. Các đối tượng IPC được định danh bằng tên (names), và được quản lý thông bằng các lời gọi `open`, `close`, và `unlink` hoạt động theo cách thức tương tự như các System Call liên quan đến tệp tương ứng.

POSIX IPC cung cấp một giao diện vượt trội hơn về nhiều mặt so với giao diện System V IPC. Tuy nhiên, POSIX IPC có độ tương thích đa nền tảng (portable) kém hơn một chút so với System V IPC.
