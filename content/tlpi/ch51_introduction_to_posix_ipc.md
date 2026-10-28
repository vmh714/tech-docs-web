# Chương 51: Giới thiệu về POSIX IPC (Introduction to POSIX IPC)

Các tiện ích mở rộng thời gian thực POSIX.1b (realtime extensions) định nghĩa một tập hợp các cơ chế truyền thông giữa các tiến trình (IPC - Inter-Process Communication) tương tự như các cơ chế System V IPC đã được mô tả trong các Chương 45 đến 48. (Một trong những mục tiêu của các nhà phát triển chuẩn POSIX.1b là thiết kế một tập hợp cơ chế IPC khắc phục được những nhược điểm của cơ sở tiện ích System V IPC.) Các cơ chế này được gọi chung là **POSIX IPC**. Ba cơ chế POSIX IPC bao gồm:

- **Hàng đợi thông điệp (Message queues):** Được sử dụng để truyền thông điệp giữa các tiến trình. Tương tự như hàng đợi thông điệp của System V, ranh giới thông điệp được bảo toàn, giúp tiến trình đọc (reader) và tiến trình ghi (writer) trao đổi theo từng đơn vị thông điệp nguyên vẹn (trái ngược với luồng byte không có ranh giới phân định do đường ống - pipe cung cấp). Hàng đợi thông điệp POSIX cho phép gán độ ưu tiên (priority) cho từng thông điệp, nhờ đó các thông điệp có độ ưu tiên cao hơn sẽ được chèn vào trước các thông điệp có độ ưu tiên thấp hơn trong hàng đợi. Tính năng này cung cấp khả năng tương tự như trường `type` trong thông điệp của System V.
- **Semaphore:** Cho phép nhiều tiến trình đồng bộ hóa (synchronize) các thao tác với nhau. Giống như semaphore của System V, một semaphore POSIX là một giá trị số nguyên do kernel quản lý và không bao giờ giảm xuống dưới 0. Semaphore POSIX dễ sử dụng hơn semaphore System V: chúng được cấp phát riêng lẻ (trái ngược với các tập hợp semaphore - semaphore sets của System V), và được thao tác độc lập thông qua hai phép toán tăng/giảm giá trị semaphore đi 1 đơn vị (trái ngược với khả năng của lời gọi hệ thống `semop()` trong System V là thêm/bớt các giá trị tùy ý một cách nguyên tử trên nhiều semaphore cùng lúc).
- **Bộ nhớ chia sẻ (Shared memory):** Cho phép nhiều tiến trình truy cập chung một vùng nhớ. Giống như bộ nhớ chia sẻ System V, bộ nhớ chia sẻ POSIX cung cấp tốc độ truyền tải dữ liệu rất cao. Ngay khi một tiến trình cập nhật dữ liệu trên vùng nhớ chia sẻ, sự thay đổi đó lập tức hiển thị đối với tất cả các tiến trình khác đang chia sẻ cùng vùng nhớ đó.

Chương này cung cấp cái nhìn tổng quan về các tiện ích POSIX IPC, tập trung vào những đặc tính chung của chúng.

## 51.1 Tổng quan về API

Cả ba cơ chế POSIX IPC đều chia sẻ nhiều đặc tính chung. Bảng 51-1 tóm tắt các API của chúng và các trang tiếp theo sẽ đi chi tiết vào những tính năng chung này.

> [!NOTE]
> Ngoại trừ một đề cập ngắn trong Bảng 51-1, trong phần còn lại của chương này, chúng ta tạm thời bỏ qua việc semaphore POSIX có hai biến thể: semaphore có tên (named semaphores) và semaphore không tên (unnamed semaphores). Semaphore có tên tương tự như các cơ chế POSIX IPC khác được mô tả trong chương này: chúng được định danh bằng một tên gọi và mọi tiến trình có đủ quyền truy cập đều có thể sử dụng. Semaphore không tên không có định danh liên kết; thay vào đó, nó được đặt trực tiếp trong một vùng nhớ chia sẻ giữa một nhóm tiến trình hoặc giữa các luồng (thread) trong cùng một tiến trình. Chi tiết về cả hai loại semaphore sẽ được trình bày ở Chương 53.

**Bảng 51-1:** Tóm tắt các giao diện lập trình cho các đối tượng POSIX IPC

| Giao diện | Hàng đợi thông điệp (Message queues) | Semaphore | Bộ nhớ chia sẻ (Shared memory) |
| :--- | :--- | :--- | :--- |
| **Tệp tiêu đề (Header file)** | `<mqueue.h>` | `<semaphore.h>` | `<sys/mman.h>` |
| **Handle đối tượng** | `mqd_t` | `sem_t *` | `int` (file descriptor) |
| **Tạo / Mở** | `mq_open()` | `sem_open()` | `shm_open()` + `mmap()` |
| **Đóng** | `mq_close()` | `sem_close()` | `munmap()` |
| **Hủy liên kết (Unlink)** | `mq_unlink()` | `sem_unlink()` | `shm_unlink()` |
| **Thực hiện IPC** | `mq_send()`, `mq_receive()` | `sem_post()`, `sem_wait()`, `sem_getvalue()` | Thao tác trực tiếp trên các vị trí thuộc vùng nhớ chia sẻ |
| **Các thao tác khác** | `mq_setattr()` — thiết lập thuộc tính<br>`mq_getattr()` — lấy thuộc tính<br>`mq_notify()` — yêu cầu thông báo | `sem_init()` — khởi tạo semaphore không tên<br>`sem_destroy()` — hủy semaphore không tên | *(không có)* |

### Tên đối tượng IPC

Để truy cập một đối tượng POSIX IPC, chúng ta cần một phương tiện định danh nó. Phương tiện duy nhất bảo đảm tính di động (portable) được SUSv3 quy định là sử dụng một tên gọi bắt đầu bằng một dấu gạch chéo `/`, theo sau bởi một hoặc nhiều ký tự không phải dấu gạch chéo; ví dụ: `/myobject`. Linux và một số hệ thống hiện thực khác (như Solaris) hỗ trợ cơ chế đặt tên chuẩn di động này cho các đối tượng IPC.

Trên Linux, tên của các đối tượng bộ nhớ chia sẻ và hàng đợi thông điệp POSIX bị giới hạn ở mức `NAME_MAX` (255) ký tự. Đối với semaphore, giới hạn này ít hơn 4 ký tự (tối đa 251 ký tự) do hệ thống tự động thêm tiền tố `sem.` vào trước tên semaphore.

SUSv3 không cấm các dạng tên khác ngoài dạng `/myobject`, nhưng quy định rằng ngữ nghĩa của các dạng tên đó do bản triển khai cụ thể quyết định (implementation-defined). Quy tắc tạo tên đối tượng IPC ở một số hệ điều hành có thể khác nhau. Ví dụ, trên Tru64 5.1, tên đối tượng IPC được tạo như một tên tệp trong hệ thống tệp chuẩn, và tên đó được hiểu là một đường dẫn tuyệt đối hoặc tương đối. Nếu tiến trình gọi không có quyền tạo tệp trong thư mục tương ứng, lời gọi mở IPC sẽ thất bại. Điều này có nghĩa là các chương trình không có quyền quản trị (unprivileged programs) không thể tạo tên dạng `/myobject` trên Tru64, vì người dùng thông thường không có quyền tạo tệp trong thư mục gốc (`/`). Một số bản triển khai khác cũng có quy định riêng biệt tương tự đối với việc cấu tạo tên truyền vào các lời gọi mở IPC. Do đó, đối với các ứng dụng đòi hỏi tính di động cao, chúng ta nên tách phần tạo tên đối tượng IPC thành một hàm riêng hoặc một tệp tiêu đề độc lập để dễ dàng tùy biến cho từng hệ điều hành đích.

### Tạo hoặc mở một đối tượng IPC

Mỗi cơ chế IPC có một lời gọi hàm mở tương ứng (`mq_open()`, `sem_open()`, hoặc `shm_open()`), hoạt động tương tự lời gọi hệ thống `open()` truyền thống dùng cho tệp tin. Khi được truyền một tên đối tượng IPC, lời gọi mở IPC sẽ:

- Tạo một đối tượng mới với tên đã cho, mở đối tượng đó và trả về một handle (thẻ quản lý / descriptor); hoặc
- Mở một đối tượng đã tồn tại và trả về handle của đối tượng đó.

Handle do lời gọi mở IPC trả về tương tự như mô tả tệp (file descriptor) từ lời gọi `open()` truyền thống — nó được dùng trong các lời gọi hàm tiếp theo để tham chiếu đến đối tượng IPC.

Kiểu của handle trả về tùy thuộc vào loại đối tượng IPC. Đối với hàng đợi thông điệp, đó là một descriptor hàng đợi thông điệp có kiểu `mqd_t`. Đối với semaphore, đó là một con trỏ kiểu `sem_t *`. Đối với bộ nhớ chia sẻ, đó là một file descriptor dạng `int`.

Tất cả các lời gọi mở IPC đều chấp nhận ít nhất 3 tham số — `name`, `oflag`, và `mode` — như ví dụ qua lời gọi `shm_open()` dưới đây:

```c
fd = shm_open("/mymem", O_CREAT | O_RDWR, S_IRUSR | S_IWUSR);
```

Các tham số này tương tự các tham số của lời gọi hệ thống `open()` truyền thống trên UNIX. Tham số `name` xác định đối tượng cần tạo hoặc mở. Tham số `oflag` là một mặt nạ bit (bit mask) chứa ít nhất các cờ sau:

`O_CREAT`
Tạo đối tượng nếu nó chưa tồn tại. Nếu cờ này không được chỉ định và đối tượng chưa tồn tại, hàm sẽ trả về lỗi (`ENOENT`).

`O_EXCL`
Nếu cờ `O_CREAT` cũng được bật và đối tượng đã tồn tại, hàm sẽ trả về lỗi (`EEXIST`). Hai bước — kiểm tra sự tồn tại và tạo mới — được thực hiện một cách nguyên tử (atomic, xem Mục 5.1). Cờ này không có hiệu lực nếu `O_CREAT` không được bật.

Tùy thuộc vào loại đối tượng IPC, `oflag` cũng có thể chứa một trong các giá trị `O_RDONLY`, `O_WRONLY`, hoặc `O_RDWR`, với ý nghĩa tương tự như trong `open()`. Một số cơ chế IPC có thể hỗ trợ thêm các cờ bổ sung.

Tham số còn lại, `mode`, là một mặt nạ bit chỉ định quyền truy cập (permissions) áp dụng cho đối tượng mới nếu nó được tạo ra (nghĩa là cờ `O_CREAT` được bật và đối tượng chưa tồn tại). Các giá trị có thể truyền vào `mode` giống hệt như đối với tệp tin (xem Bảng 15-4, trang 295). Tương tự như lời gọi hệ thống `open()`, mặt nạ quyền trong `mode` sẽ được áp mặt nạ lọc `umask` của tiến trình (Mục 15.4.6). Quyền sở hữu người dùng (user ownership) và sở hữu nhóm (group ownership) của một đối tượng IPC mới được lấy từ User ID hiệu dụng (effective user ID) và Group ID hiệu dụng của tiến trình gọi. (Chính xác hơn, trên Linux, quyền sở hữu của đối tượng POSIX IPC mới được quyết định bởi File-system ID của tiến trình — vốn thường trùng với Effective ID tương ứng. Chi tiết tham khảo Mục 9.5.)

> [!NOTE]
> Trên các hệ thống mà đối tượng IPC hiển thị trực tiếp trong hệ thống tệp chuẩn, SUSv3 cho phép bản triển khai thiết lập Group ID của đối tượng IPC mới theo Group ID của thư mục cha.

### Đóng một đối tượng IPC

Đối với hàng đợi thông điệp và semaphore POSIX, có một lời gọi đóng IPC chỉ định rằng tiến trình gọi đã hoàn tất việc sử dụng đối tượng và hệ thống có thể thu hồi (deallocate) các tài nguyên liên kết với đối tượng đó dành riêng cho tiến trình này. Đối với đối tượng bộ nhớ chia sẻ POSIX, nó được đóng bằng cách hủy ánh xạ qua lời gọi `munmap()`.

Các đối tượng IPC sẽ tự động được đóng nếu tiến trình kết thúc (terminate) hoặc thực thi một chương trình mới thông qua lời gọi `exec()`.

### Quyền truy cập đối tượng IPC

Các đối tượng IPC có mặt nạ quyền truy cập giống hệt tệp tin. Quyền truy cập đối tượng IPC tuân theo các quy tắc tương tự tệp tin (Mục 15.4.3), ngoại trừ việc quyền thực thi (execute permission) không có ý nghĩa đối với các đối tượng POSIX IPC.

Từ phiên bản kernel 2.6.19, Linux hỗ trợ sử dụng Danh sách điều khiển truy cập (ACL - Access Control Lists) để thiết lập quyền trên các đối tượng bộ nhớ chia sẻ POSIX và semaphore có tên. Hiện tại, ACL chưa hỗ trợ cho hàng đợi thông điệp POSIX.

### Xóa đối tượng IPC và tính bền vững của đối tượng

Tương tự như các tệp đang mở, các đối tượng POSIX IPC được quản lý bằng cơ chế đếm tham chiếu (reference counting) — kernel duy trì một số đếm số lượng tham chiếu đang mở tới đối tượng. So với System V IPC, cơ chế này giúp ứng dụng dễ dàng xác định thời điểm có thể xóa đối tượng một cách an toàn.

Mỗi loại đối tượng IPC có một lời gọi hủy liên kết (`unlink`) tương ứng, hoạt động tương tự lời gọi hệ thống `unlink()` cho tệp tin. Lời gọi `unlink` lập tức xóa tên của đối tượng khỏi hệ thống, và sẽ thực sự hủy đối tượng khi tất cả các tiến trình ngừng sử dụng nó (tức là khi số đếm tham chiếu giảm về 0). Đối với hàng đợi thông điệp và semaphore, đối tượng sẽ bị hủy sau khi mọi tiến trình đã đóng nó; đối với bộ nhớ chia sẻ, việc hủy diễn ra sau khi mọi tiến trình đã hủy ánh xạ vùng nhớ bằng `munmap()`.

Sau khi một đối tượng bị `unlink`, các lời gọi mở IPC tiếp theo chỉ định cùng tên đó sẽ tham chiếu đến một đối tượng hoàn toàn mới (hoặc báo lỗi nếu cờ `O_CREAT` không được bật).

Tương tự như System V IPC, các đối tượng POSIX IPC có **tính tồn tại theo kernel (kernel persistence)**. Khi đã được tạo ra, đối tượng tiếp tục tồn tại cho đến khi nó bị `unlink` hoặc khi hệ thống tắt (shutdown). Điều này cho phép một tiến trình tạo đối tượng, cập nhật trạng thái của nó rồi thoát, để lại đối tượng đó cho một tiến trình khác truy cập ở thời điểm sau.

### Liệt kê và xóa các đối tượng POSIX IPC qua dòng lệnh

System V IPC cung cấp hai lệnh tiện ích là `ipcs` và `ipcrm` để liệt kê và xóa các đối tượng IPC. Chuẩn POSIX không quy định các lệnh tiêu chuẩn tương đương cho POSIX IPC. Tuy nhiên, trên nhiều hệ thống (bao gồm Linux), các đối tượng POSIX IPC được hiện thực bên trong một hệ thống tệp thực hoặc ảo, được gắn (mount) tại một thư mục bên dưới thư mục gốc (`/`), do đó có thể dùng các lệnh `ls` và `rm` tiêu chuẩn để liệt kê và xóa chúng. (SUSv3 không quy định bắt buộc dùng `ls` và `rm` cho việc này). Khó khăn chính khi dùng các lệnh này là tính không chuẩn hóa về tên đối tượng POSIX IPC và vị trí lưu trữ của chúng trong hệ thống tệp trên các hệ điều hành khác nhau.

Trên Linux, các đối tượng POSIX IPC nằm trong các hệ thống tệp ảo được gắn dưới các thư mục có bật bit sticky (sticky bit set). Bit này đóng vai trò là cờ hạn chế xóa (restricted deletion flag, Mục 15.4.5); việc bật bit này đồng nghĩa với việc một tiến trình không có quyền quản trị chỉ có thể `unlink` các đối tượng POSIX IPC do chính nó sở hữu.

### Biên dịch các chương trình sử dụng POSIX IPC trên Linux

Trên Linux, các chương trình sử dụng các cơ chế POSIX IPC bắt buộc phải liên kết với thư viện thời gian thực `librt` bằng cách thêm tùy chọn `-lrt` vào lệnh biên dịch `cc`.

## 51.2 So sánh System V IPC và POSIX IPC

Khi tìm hiểu chi tiết từng cơ chế POSIX IPC ở các chương sau, chúng ta sẽ so sánh từng cơ chế với đối phần tương ứng của nó trong System V. Tại đây, chúng ta hãy xem xét một số điểm so sánh tổng quan giữa hai dòng IPC này.

POSIX IPC sở hữu các ưu điểm chung sau so với System V IPC:

- Giao diện lập trình (API) của POSIX IPC đơn giản hơn so với System V IPC.
- Mô hình POSIX IPC — sử dụng tên gọi thay cho khóa (`key`), cùng các hàm `open`, `close`, và `unlink` — nhất quán hơn với mô hình thao tác tệp truyền thống của UNIX.
- Các đối tượng POSIX IPC được quản lý theo cơ chế đếm tham chiếu (reference counting). Điều này đơn giản hóa việc giải phóng đối tượng, vì chúng ta có thể gọi `unlink` một đối tượng mà vẫn an tâm rằng nó chỉ thực sự bị hủy khi mọi tiến trình đã đóng nó hoàn toàn.

Tuy nhiên, System V IPC có một ưu điểm nổi bật: **Tính di động (Portability)**. POSIX IPC kém di động hơn System V IPC ở các khía cạnh sau:

- System V IPC được định nghĩa chính thức trong SUSv3 và hỗ trợ trên hầu như mọi hệ điều hành UNIX. Ngược lại, mỗi cơ chế trong POSIX IPC chỉ là một thành phần tùy chọn (optional component) trong SUSv3. Một số hệ thống UNIX không hỗ trợ đầy đủ các cơ chế POSIX IPC. Thực trạng này cũng được phản ánh trên Linux: Bộ nhớ chia sẻ POSIX chỉ được hỗ trợ từ kernel 2.4; bản cài đặt đầy đủ của POSIX semaphore chỉ có từ kernel 2.6; và Hàng đợi thông điệp POSIX chỉ được hỗ trợ từ kernel 2.6.6.
- Dù SUSv3 đã quy định về dạng tên của đối tượng POSIX IPC, các hệ điều hành khác nhau vẫn tuân theo các quy ước đặt tên không hoàn toàn giống nhau. Sự khác biệt này buộc lập trình viên phải xử lý thêm một chút công việc để ứng dụng đạt tính di động tuyệt đối.
- Nhiều chi tiết vận hành của POSIX IPC không được quy định trong SUSv3. Cụ thể, không có lệnh chuẩn nào được quy định để hiển thị và xóa các đối tượng IPC đang tồn tại trên hệ thống. (Mặc dù nhiều bản triển khai cho phép dùng các lệnh hệ thống tệp thông thường, nhưng đường dẫn cụ thể để định danh đối tượng IPC vẫn khác nhau giữa các hệ thống).

## 51.3 Tóm tắt

POSIX IPC là tên gọi chung cho ba cơ chế truyền thông giữa các tiến trình — hàng đợi thông điệp, semaphore, và bộ nhớ chia sẻ — được thiết kế trong chuẩn POSIX.1b nhằm thay thế cho các cơ chế tương tự của System V IPC.

Giao diện POSIX IPC có độ nhất quán cao hơn với mô hình tệp tin UNIX truyền thống. Các đối tượng IPC được định danh bằng tên gọi (names), được quản lý thông qua các lời gọi hàm `open`, `close`, và `unlink` hoạt động tương tự như các lời gọi hệ thống làm việc với tệp tin.

POSIX IPC cung cấp một giao diện lập trình vượt trội về nhiều mặt so với System V IPC. Tuy nhiên, POSIX IPC có tính di động đa nền tảng thấp hơn một chút so với System V IPC.
