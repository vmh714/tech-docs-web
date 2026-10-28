# Chương 50: Các thao tác bộ nhớ ảo (Virtual Memory Operations)

Chương này xem xét các System Call (lời hệ thống) khác nhau thực hiện các thao tác trên không gian địa chỉ ảo (virtual address space) của một tiến trình (process):

- System Call `mprotect()` thay đổi quyền bảo vệ trên một vùng bộ nhớ ảo (virtual memory).
- Các System Call `mlock()` và `mlockall()` khóa một vùng bộ nhớ ảo vào bộ nhớ vật lý (physical memory), do đó ngăn không cho nó bị hoán đổi ra ngoài (swapped out).
- System Call `mincore()` cho phép một tiến trình xác định xem các trang (page) trong một vùng bộ nhớ ảo có đang thường trú trong bộ nhớ vật lý hay không.
- System Call `madvise()` cho phép một tiến trình đưa ra khuyến nghị cho kernel về các kiểu mẫu sử dụng vùng bộ nhớ ảo của nó trong tương lai.

Một số System Call này đặc biệt hữu ích khi kết hợp với các vùng bộ nhớ chia sẻ (shared memory regions) (Chương 48, 49 và 54), nhưng chúng có thể được áp dụng cho bất kỳ vùng bộ nhớ ảo nào của tiến trình.

> [!NOTE]
> Các kỹ thuật được mô tả trong chương này thực ra không liên quan gì đến IPC (Interprocess Communication), nhưng chúng tôi đưa chúng vào phần này của cuốn sách bởi vì đôi khi chúng được sử dụng cùng với bộ nhớ chia sẻ (shared memory).

## 50.1 Thay đổi Quyền Bảo Vệ Bộ Nhớ: mprotect()

System Call `mprotect()` thay đổi quyền bảo vệ trên các trang bộ nhớ ảo trong phạm vi bắt đầu từ `addr` và kéo dài trong `length` byte.

```c
## include <sys/mman.h>
int mprotect(void *addr, size_t length, int prot);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Giá trị được truyền vào `addr` phải là bội số của kích thước trang hệ thống (system page size) (như được trả về bởi `sysconf(_SC_PAGESIZE)`). (SUSv3 quy định rằng `addr` phải được căn chỉnh theo trang (page-aligned). SUSv4 nêu rằng một bản cài đặt có thể yêu cầu đối số này phải được căn chỉnh theo trang). Bởi vì các quyền bảo vệ được thiết lập trên toàn bộ trang, `length` trên thực tế sẽ được làm tròn lên đến bội số tiếp theo của kích thước trang hệ thống.

Đối số `prot` là một bit mask chỉ định quyền bảo vệ mới cho vùng bộ nhớ này. Nó phải được chỉ định là `PROT_NONE` hoặc là sự kết hợp được tạo ra bằng cách thực hiện phép toán OR trên một hoặc nhiều cờ `PROT_READ`, `PROT_WRITE` và `PROT_EXEC`. Tất cả các giá trị này có ý nghĩa tương tự như đối với `mmap()` (Bảng 49-2, trang 1020).

Nếu một tiến trình cố gắng truy cập vào một vùng bộ nhớ theo cách vi phạm quyền bảo vệ bộ nhớ, kernel sẽ tạo ra một tín hiệu (signal) `SIGSEGV` cho tiến trình đó.

Một công dụng của `mprotect()` là thay đổi quyền bảo vệ của một vùng bộ nhớ được ánh xạ (mapped memory) ban đầu được thiết lập trong lệnh gọi `mmap()`, như được minh họa trong [Liệt kê 50-1](#page-1-0). Chương trình này tạo ra một ánh xạ ẩn danh (anonymous mapping) ban đầu có tất cả các quyền truy cập bị từ chối (`PROT_NONE`). Sau đó, chương trình thay đổi quyền bảo vệ trên vùng này thành đọc và ghi (read plus write). Trước và sau khi thực hiện thay đổi, chương trình sử dụng hàm `system()` để thực thi một lệnh shell hiển thị dòng từ tệp `/proc/PID/maps` tương ứng với vùng được ánh xạ, để chúng ta có thể thấy sự thay đổi trong quyền bảo vệ bộ nhớ. (Chúng ta có thể lấy thông tin ánh xạ bằng cách phân tích cú pháp trực tiếp `/proc/self/maps`, nhưng chúng tôi đã sử dụng lệnh gọi `system()` vì nó giúp chương trình ngắn gọn hơn). Khi chúng ta chạy chương trình này, chúng ta sẽ thấy kết quả sau:

```
$ ./t_mprotect
Before mprotect()
b7cde000-b7dde000 ---s 00000000 00:04 18258 /dev/zero (deleted)
After mprotect()
b7cde000-b7dde000 rw-s 00000000 00:04 18258 /dev/zero (deleted)
```

Từ dòng đầu ra cuối cùng, chúng ta có thể thấy rằng `mprotect()` đã thay đổi quyền của vùng bộ nhớ thành `PROT_READ | PROT_WRITE`. (Để biết giải thích về chuỗi `(deleted)` xuất hiện sau `/dev/zero` trong đầu ra của shell, hãy tham khảo Mục 48.5).

**Liệt kê 50-1:** Thay đổi quyền bảo vệ bộ nhớ bằng `mprotect()`

```c
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– vmem/t_mprotect.c
## define _BSD_SOURCE /* Lấy định nghĩa MAP_ANONYMOUS từ <sys/mman.h> */
## include <sys/mman.h>
## include "tlpi_hdr.h"
## define LEN (1024 * 1024)
## define SHELL_FMT "cat /proc/%ld/maps | grep zero"
## define CMD_SIZE (sizeof(SHELL_FMT) + 20)
 /* Cho phép thêm dung lượng cho chuỗi số nguyên */
```

```
int
main(int argc, char *argv[])
{
 char cmd[CMD_SIZE];
 char *addr;
 /* Tạo một ánh xạ ẩn danh với tất cả quyền truy cập bị từ chối */
 addr = mmap(NULL, LEN, PROT_NONE, MAP_SHARED | MAP_ANONYMOUS, -1, 0);
 if (addr == MAP_FAILED)
 errExit("mmap");
 /* Hiển thị dòng từ /proc/self/maps tương ứng với ánh xạ */
 printf("Before mprotect()\n");
 snprintf(cmd, CMD_SIZE, SHELL_FMT, (long) getpid());
 system(cmd);
 /* Thay đổi quyền bảo vệ trên bộ nhớ cho phép truy cập đọc và ghi */
 if (mprotect(addr, LEN, PROT_READ | PROT_WRITE) == -1)
 errExit("mprotect");
 printf("After mprotect()\n");
 system(cmd); /* Kiểm tra lại quyền bảo vệ thông qua /proc/self/maps */
 exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– vmem/t_mprotect.c
```

## 50.2 Khóa Bộ Nhớ: mlock() và mlockall()

Trong một số ứng dụng, việc khóa một phần hoặc toàn bộ bộ nhớ ảo của tiến trình là rất hữu ích để đảm bảo rằng nó luôn nằm trong bộ nhớ vật lý. Một lý do để làm điều này là nhằm cải thiện hiệu năng. Các truy cập vào các trang đã khóa được đảm bảo sẽ không bao giờ bị trì hoãn bởi lỗi trang (page fault). Điều này rất hữu ích cho các ứng dụng phải đảm bảo thời gian phản hồi nhanh chóng.

Một lý do khác để khóa bộ nhớ (locking memory) chính là bảo mật. Nếu một trang bộ nhớ ảo (virtual memory page) chứa dữ liệu nhạy cảm không bao giờ bị hoán đổi ra ngoài (swapped out), thì sẽ không có bản sao nào của trang đó từng được ghi xuống đĩa (disk). Nếu trang đó được ghi xuống đĩa, về mặt lý thuyết, nó có thể được đọc trực tiếp từ thiết bị lưu trữ vào một thời điểm nào đó sau đó. (Một kẻ tấn công có thể cố tình dàn dựng tình huống này bằng cách chạy một chương trình tiêu thụ một lượng lớn bộ nhớ, từ đó ép bộ nhớ của các tiến trình khác phải hoán đổi ra đĩa.) Việc đọc thông tin từ vùng swap (swap space) thậm chí có thể được thực hiện sau khi tiến trình đã kết thúc, vì kernel không đưa ra đảm bảo nào về việc xóa sạch (zeroing out) dữ liệu được lưu trong vùng swap. (Thông thường, chỉ có các tiến trình có đặc quyền (privileged processes) mới có thể đọc từ thiết bị swap).

> [!NOTE]
> Chế độ tạm nghỉ (suspend mode) trên máy tính xách tay, cũng như một số hệ thống máy tính để bàn, sẽ lưu một bản sao RAM của hệ thống xuống đĩa, bất kể trạng thái khóa bộ nhớ.

Trong phần này, chúng ta sẽ xem xét các System Call được sử dụng để khóa và mở khóa một phần hoặc toàn bộ bộ nhớ ảo của một tiến trình (process). Tuy nhiên, trước khi làm điều đó, trước tiên chúng ta sẽ tìm hiểu về một giới hạn tài nguyên (resource limit) chi phối việc khóa bộ nhớ.

### Giới hạn tài nguyên RLIMIT\_MEMLOCK

Trong Mục 36.3, chúng ta đã mô tả ngắn gọn về giới hạn RLIMIT\_MEMLOCK, xác định hạn mức về số byte mà một tiến trình có thể khóa vào bộ nhớ. Bây giờ chúng ta sẽ xem xét giới hạn này một cách chi tiết hơn.

Trong các phiên bản Linux kernel trước 2.6.9, chỉ các tiến trình có đặc quyền (`CAP_IPC_LOCK`) mới có thể khóa bộ nhớ, và giới hạn tài nguyên mềm (soft resource limit) RLIMIT\_MEMLOCK đặt ra mức trần cho số byte mà một tiến trình có đặc quyền có thể khóa.

Bắt đầu từ Linux 2.6.9, các thay đổi đối với mô hình khóa bộ nhớ cho phép các tiến trình không có đặc quyền (unprivileged processes) khóa một lượng nhỏ bộ nhớ. Điều này hữu ích cho một ứng dụng cần đặt một lượng nhỏ thông tin nhạy cảm vào bộ nhớ bị khóa nhằm đảm bảo nó không bao giờ bị ghi vào vùng swap trên đĩa; ví dụ, `gpg` thực hiện điều này với các cụm mật khẩu (pass phrases). Kết quả của những thay đổi này là:

- không có giới hạn nào được đặt ra đối với lượng bộ nhớ mà một tiến trình có đặc quyền có thể khóa (tức là RLIMIT\_MEMLOCK bị bỏ qua); và
- một tiến trình không có đặc quyền giờ đây có thể khóa bộ nhớ lên đến giới hạn mềm do RLIMIT\_MEMLOCK định nghĩa.

Giá trị mặc định cho cả hai giới hạn mềm (soft) và cứng (hard) của RLIMIT\_MEMLOCK là 8 trang (tức là 32.768 byte trên kiến trúc x86-32).

Giới hạn RLIMIT\_MEMLOCK ảnh hưởng đến:

- `mlock()` và `mlockall()`;
- cờ `MAP_LOCKED` của `mmap()`, được sử dụng để khóa một ánh xạ bộ nhớ (memory mapping) khi nó được tạo ra, như được mô tả trong Mục 49.6; và
- thao tác `shmctl()` `SHM_LOCK`, được sử dụng để khóa các phân đoạn bộ nhớ chia sẻ System V (System V shared memory segments), như được mô tả trong Mục 48.7.

Vì bộ nhớ ảo được quản lý theo đơn vị trang (pages), các khóa bộ nhớ sẽ áp dụng cho toàn bộ các trang. Khi thực hiện kiểm tra giới hạn, RLIMIT\_MEMLOCK được làm tròn xuống (rounded down) thành bội số gần nhất của kích thước trang hệ thống (system page size).

Mặc dù giới hạn tài nguyên này chỉ có một giá trị duy nhất (mềm), trên thực tế, nó định nghĩa hai giới hạn riêng biệt:

- Đối với `mlock()`, `mlockall()`, và thao tác `mmap()` `MAP_LOCKED`, RLIMIT\_MEMLOCK định nghĩa giới hạn trên mỗi tiến trình (per-process limit) đối với số byte trong không gian địa chỉ ảo (virtual address space) của tiến trình đó mà nó được phép khóa.
- Đối với thao tác `shmctl()` `SHM_LOCK`, RLIMIT\_MEMLOCK định nghĩa giới hạn trên mỗi người dùng (per-user limit) đối với số byte trong các phân đoạn bộ nhớ chia sẻ có thể bị khóa bởi ID người dùng thực (real user ID) của tiến trình này. Khi một tiến trình thực hiện thao tác `shmctl()` `SHM_LOCK`, kernel sẽ kiểm tra tổng số byte bộ nhớ chia sẻ System V đã được ghi nhận là đang bị khóa bởi ID người dùng thực của tiến trình gọi. Nếu kích thước của phân đoạn sắp khóa không vượt quá tổng giới hạn RLIMIT\_MEMLOCK của tiến trình đó, thao tác sẽ thành công.

Lý do khiến RLIMIT\_MEMLOCK có ngữ nghĩa khác đối với bộ nhớ chia sẻ System V là vì một phân đoạn bộ nhớ chia sẻ có thể tiếp tục tồn tại ngay cả khi nó không được gắn kết (attached) bởi bất kỳ tiến trình nào. (Nó chỉ bị xóa sau một thao tác `shmctl()` `IPC_RMID` rõ ràng, và chỉ sau khi tất cả các tiến trình đã gỡ kết nối (detached) nó khỏi không gian địa chỉ của họ.)

### Khóa và mở khóa các vùng nhớ

Một tiến trình (process) có thể sử dụng mlock() và munlock() để khóa và mở khóa các vùng nhớ.

```c
## include <sys/mman.h>
int mlock(void *addr, size_t length);
int munlock(void *addr, size_t length);
                                         Cả hai đều trả về 0 khi thành công, hoặc –1 khi có lỗi
```

System Call (lệnh hệ thống) mlock() thực hiện khóa tất cả các trang nhớ (page) thuộc dải địa chỉ ảo (virtual address range) của tiến trình gọi, bắt đầu từ địa chỉ `addr` và kéo dài trong `length` byte. Không giống như các đối số tương ứng được truyền vào một số System Call liên quan đến bộ nhớ khác, `addr` không bắt buộc phải căn chỉnh theo trang (page-aligned): kernel sẽ khóa các trang nhớ bắt đầu từ ranh giới trang (page boundary) ngay phía dưới `addr`. Tuy nhiên, SUSv3 cho phép tùy chọn một hệ thống cài đặt (implementation) yêu cầu `addr` phải là bội số của kích thước trang hệ thống (system page size), và các ứng dụng có tính di động (portable applications) nên đảm bảo điều này khi gọi mlock() và munlock().

Vì việc khóa được thực hiện theo đơn vị là toàn bộ trang nhớ, điểm kết thúc của vùng nhớ bị khóa sẽ là ranh giới trang tiếp theo lớn hơn `length` cộng với `addr`. Ví dụ, trên một hệ thống mà kích thước trang là 4096 byte, lời gọi mlock(2000, 4000) sẽ khóa các byte từ 0 đến 8191.

> [!NOTE]
> Chúng ta có thể xem xét có bao nhiêu bộ nhớ mà một tiến trình hiện đang khóa bằng cách kiểm tra mục VmLck trong tệp đặc thù của Linux `/proc/PID/status`.

Sau một lời gọi mlock() thành công, tất cả các trang trong dải đã chỉ định được đảm bảo là đã khóa và thường trú trong bộ nhớ vật lý (physical memory). System Call mlock() sẽ thất bại nếu không có đủ bộ nhớ vật lý để khóa tất cả các trang được yêu cầu hoặc nếu yêu cầu vi phạm giới hạn tài nguyên mềm (soft resource limit) `RLIMIT_MEMLOCK`.

Chúng ta có thể xem một ví dụ về việc sử dụng mlock() tại [Liệt kê 50-2.](#page-7-0)

System Call munlock() thực hiện chức năng ngược lại với mlock(), gỡ bỏ một khóa bộ nhớ đã được thiết lập trước đó bởi tiến trình gọi. Các đối số `addr` và `length` được diễn giải tương tự như đối với mlock(). Việc mở khóa một tập hợp các trang không đảm bảo rằng chúng sẽ ngừng thường trú trong bộ nhớ: các trang chỉ bị xóa khỏi RAM khi có nhu cầu về bộ nhớ từ các tiến trình khác.

Ngoài việc sử dụng tường minh munlock(), các khóa bộ nhớ sẽ tự động bị gỡ bỏ trong các trường hợp sau:

- khi tiến trình chấm dứt (termination);
- nếu các trang bị khóa bị hủy ánh xạ (unmap) thông qua munmap(); hoặc
- nếu các trang bị khóa bị ghi đè bằng cách sử dụng cờ `MAP_FIXED` của mmap().

### Chi tiết về ngữ nghĩa của việc khóa bộ nhớ

Trong các đoạn văn sau, chúng ta lưu ý một số chi tiết về ngữ nghĩa của các khóa bộ nhớ. Các khóa bộ nhớ không được kế thừa bởi một tiến trình con được tạo thông qua fork(), và không được duy trì qua lệnh exec().

Trong trường hợp nhiều tiến trình chia sẻ một tập hợp các trang (ví dụ: một ánh xạ `MAP_SHARED`), các trang này vẫn bị khóa trong bộ nhớ chừng nào ít nhất một trong các tiến trình vẫn giữ khóa bộ nhớ trên các trang đó.

Các khóa bộ nhớ không có tính lồng nhau (nest) đối với một tiến trình đơn lẻ. Nếu một tiến trình liên tục gọi mlock() trên một dải địa chỉ ảo nhất định, chỉ có một khóa duy nhất được thiết lập, và khóa này sẽ bị gỡ bỏ chỉ bằng một lời gọi munlock() duy nhất. Mặt khác, nếu chúng ta sử dụng mmap() để ánh xạ cùng một tập hợp các trang (tức là cùng một tệp) tại nhiều vị trí khác nhau trong một tiến trình đơn lẻ, và sau đó khóa từng ánh xạ này, các trang sẽ tiếp tục bị khóa trong RAM cho đến khi tất cả các ánh xạ đã được mở khóa.

Việc các khóa bộ nhớ được thực hiện theo đơn vị trang và không thể lồng nhau đồng nghĩa với việc không đúng về mặt logic khi áp dụng độc lập các lời gọi mlock() và munlock() cho các cấu trúc dữ liệu khác nhau trên cùng một trang ảo. Ví dụ, giả sử chúng ta có hai cấu trúc dữ liệu nằm trong cùng một trang bộ nhớ ảo được trỏ tới bởi các con trỏ `p1` và `p2`, và chúng ta thực hiện các lời gọi sau:

```
mlock(*p1, len1);
mlock(*p2, len2); /* Thực tế không có tác dụng */
munlock(*p1, len1);
```

Tất cả các lời gọi trên sẽ thành công, nhưng kết thúc chuỗi này, toàn bộ trang nhớ sẽ được mở khóa; nghĩa là, cấu trúc dữ liệu được trỏ tới bởi `p2` không còn bị khóa trong bộ nhớ nữa.

Lưu ý rằng ngữ nghĩa của thao tác shmctl() `SHM_LOCK` (Mục 48.7) khác với ngữ nghĩa của mlock() và mlockall(), cụ thể như sau:

- Sau thao tác `SHM_LOCK`, các trang chỉ được khóa vào bộ nhớ khi chúng xảy ra lỗi trang (fault in) bởi các tham chiếu tiếp theo. Ngược lại, mlock() và mlockall() thực hiện nạp tất cả các trang bị khóa vào bộ nhớ (fault all) trước khi lời gọi trả về.
- Thao tác `SHM_LOCK` thiết lập một thuộc tính của phân đoạn bộ nhớ chia sẻ (shared memory segment), thay vì của tiến trình. (Vì lý do này, giá trị trong trường VmLck của `/proc/PID/status` không bao gồm kích thước của bất kỳ phân đoạn bộ nhớ chia sẻ System V nào đã được đính kèm và khóa bằng cách sử dụng `SHM_LOCK`.) Điều này có nghĩa là, một khi đã được nạp vào bộ nhớ, các trang vẫn thường trú ngay cả khi tất cả các tiến trình ngắt kết nối (detach) khỏi phân đoạn bộ nhớ chia sẻ đó. Ngược lại, một vùng nhớ bị khóa bằng cách sử dụng mlock() (hoặc mlockall()) sẽ chỉ duy trì trạng thái khóa chừng nào ít nhất một tiến trình còn giữ khóa trên vùng nhớ đó.

### Khóa và mở khóa toàn bộ bộ nhớ của một tiến trình (Process)

Một tiến trình (process) có thể sử dụng mlockall() và munlockall() để khóa và mở khóa toàn bộ bộ nhớ của chính nó.

```c
## include <sys/mman.h>
int mlockall(int flags);
int munlockall(void);
                                         Cả hai trả về 0 khi thành công, hoặc –1 khi lỗi
```

System call mlockall() khóa tất cả các trang (page) hiện đang được ánh xạ trong không gian địa chỉ ảo (virtual address space) của tiến trình, tất cả các trang được ánh xạ trong tương lai, hoặc cả hai, tùy theo mặt nạ cờ (flag bit mask) được chỉ định bằng cách kết hợp OR một hoặc cả hai hằng số sau:

### MCL\_CURRENT

Khóa tất cả các trang hiện đang được ánh xạ vào không gian địa chỉ ảo của tiến trình gọi. Điều này bao gồm tất cả các trang hiện được cấp phát cho mã chương trình (program text), các phân đoạn dữ liệu (data segment), các vùng ánh xạ bộ nhớ (memory mapping), và stack. Sau một lời gọi thành công chỉ định cờ MCL\_CURRENT, tất cả các trang của tiến trình gọi được đảm bảo thường trú trong bộ nhớ (memory-resident). Cờ này không ảnh hưởng đến các trang được cấp phát sau đó trong không gian địa chỉ ảo của tiến trình; để làm điều này, chúng ta phải sử dụng MCL\_FUTURE.

### MCL\_FUTURE

Khóa tất cả các trang được ánh xạ sau đó vào không gian địa chỉ ảo của tiến trình gọi. Các trang như vậy có thể, ví dụ, là một phần của vùng bộ nhớ chia sẻ (shared memory region) được ánh xạ thông qua mmap() hoặc shmat(), hoặc một phần của heap đang tăng trưởng lên trên hay stack đang phát triển xuống dưới. Do hậu quả của việc chỉ định cờ MCL\_FUTURE, một thao tác cấp phát bộ nhớ sau đó (ví dụ: mmap(), sbrk(), hoặc malloc()) có thể thất bại, hoặc việc tăng stack có thể sinh ra tín hiệu SIGSEGV, nếu hệ thống cạn kiệt RAM để cấp phát cho tiến trình hoặc gặp giới hạn tài nguyên mềm RLIMIT\_MEMLOCK.

Các quy tắc tương tự liên quan đến các ràng buộc, vòng đời, và sự kế thừa của các khóa bộ nhớ được tạo ra bằng mlock() cũng áp dụng cho các khóa bộ nhớ được tạo ra thông qua mlockall().

System call munlockall() mở khóa tất cả các trang của tiến trình gọi và hoàn tác hiệu ứng của bất kỳ lời gọi mlockall(MCL\_FUTURE) trước đó nào. Giống như munlock(), các trang được mở khóa không được đảm bảo sẽ bị loại khỏi RAM bởi lời gọi này.

> [!NOTE]
> Trước Linux 2.6.9, quyền hạn (capability `CAP_IPC_LOCK`) là bắt buộc để gọi munlockall() (một cách không nhất quán, quyền hạn không bắt buộc đối với mlock()). Kể từ Linux 2.6.9, quyền hạn không còn là bắt buộc nữa.

## 50.3 Xác định tính thường trú trong bộ nhớ: mincore()

System call mincore() là phần bổ trợ cho các system call khóa bộ nhớ. Nó báo cáo những trang nào trong một dải địa chỉ ảo hiện đang thường trú trong RAM, và do đó sẽ không gây ra lỗi trang (page fault) nếu được truy cập.

SUSv3 không quy định mincore(). Nó có sẵn trên nhiều, nhưng không phải tất cả, các phiên bản UNIX. Trên Linux, mincore() đã có sẵn kể từ kernel phiên bản 2.4.

```c
## define _BSD_SOURCE /* Hoặc: #define _SVID_SOURCE */
## include <sys/mman.h>
int mincore(void *addr, size_t length, unsigned char *vec);
                                          Trả về 0 khi thành công, hoặc –1 khi lỗi
```

System call mincore() trả về thông tin thường trú trong bộ nhớ về các trang trong dải địa chỉ ảo bắt đầu từ addr và kéo dài trong length byte. Địa chỉ được cung cấp trong addr phải được căn chỉnh theo kích thước trang (page-aligned), và vì thông tin được trả về tính trên toàn bộ các trang, length sẽ được làm tròn lên thành bội số tiếp theo của kích thước trang hệ thống (system page size).

Thông tin về tính thường trú trong bộ nhớ được trả về trong vec, bắt buộc phải là một mảng có kích thước `(length + PAGE\_SIZE – 1) / PAGE\_SIZE` byte. (Trên Linux, vec có kiểu `unsigned char *`; trên một số hệ thống UNIX khác, vec có kiểu `char *`.) Bit ít ý nghĩa nhất (least significant bit) của mỗi byte được thiết lập nếu trang tương ứng thường trú trong bộ nhớ. Trạng thái của các bit khác là không xác định trên một số hệ thống UNIX, vì vậy các ứng dụng di động (portable application) chỉ nên kiểm tra bit này.

Thông tin do mincore() trả về có thể thay đổi giữa thời điểm lời gọi được thực hiện và thời điểm các phần tử của vec được kiểm tra. Các trang duy nhất được đảm bảo tiếp tục thường trú trong bộ nhớ là những trang được khóa bằng mlock() hoặc mlockall().

> [!NOTE]
> Trước Linux 2.6.21, nhiều vấn đề về cài đặt đồng nghĩa với việc mincore() không báo cáo chính xác thông tin thường trú trong bộ nhớ cho các ánh xạ MAP\_PRIVATE hoặc cho các ánh xạ phi tuyến tính (được thiết lập bằng cách sử dụng remap\_file\_pages()).

[Listing 50-2](#page-7-0) minh họa cách sử dụng mlock() và mincore(). Sau khi cấp phát và ánh xạ một vùng bộ nhớ bằng mmap(), chương trình này sử dụng mlock() để khóa toàn bộ vùng hoặc các nhóm trang theo các khoảng thời gian đều đặn. (Mỗi đối số dòng lệnh (command-line argument) truyền vào chương trình được biểu diễn bằng số lượng trang; chương trình chuyển đổi các giá trị này thành byte, theo yêu cầu của các lời gọi mmap(), mlock(), và mincore().) Trước và sau lời gọi mlock(), chương trình sử dụng mincore() để truy xuất thông tin về tính thường trú trong bộ nhớ của các trang trong vùng và hiển thị thông tin này dưới dạng đồ họa.

**Listing 50-2:** Sử dụng mlock() và mincore()

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– vmem/memlock.c
## define _BSD_SOURCE /* Lấy khai báo mincore() và định nghĩa MAP_ANONYMOUS
 từ <sys/mman.h> */
## include <sys/mman.h>
## include "tlpi_hdr.h"
/* Hiển thị tính thường trú của các trang trong dải [addr .. (addr + length - 1)] */
static void
displayMincore(char *addr, size_t length)
{
 unsigned char *vec;
 long pageSize, numPages, j;
 pageSize = sysconf(_SC_PAGESIZE);
 numPages = (length + pageSize - 1) / pageSize;
 vec = malloc(numPages);
 if (vec == NULL)
 errExit("malloc");
```

```c
 if (mincore(addr, length, vec) == -1)
 errExit("mincore");
 for (j = 0; j < numPages; j++) {
 if (j % 64 == 0)
 printf("%s%10p: ", (j == 0) ? "" : "\n", addr + (j * pageSize));
 printf("%c", (vec[j] & 1) ? '*' : '.');
 }
 printf("\n");
 free(vec);
}
int
main(int argc, char *argv[])
{
 char *addr;
 size_t len, lockLen;
 long pageSize, stepSize, j;
 if (argc != 4 || strcmp(argv[1], "--help") == 0)
 usageErr("%s num-pages lock-page-step lock-page-len\n", argv[0]);
 pageSize = sysconf(_SC_PAGESIZE);
 if (pageSize == -1)
 errExit("sysconf(_SC_PAGESIZE)");
 len = getInt(argv[1], GN_GT_0, "num-pages") * pageSize;
 stepSize = getInt(argv[2], GN_GT_0, "lock-page-step") * pageSize;
 lockLen = getInt(argv[3], GN_GT_0, "lock-page-len") * pageSize;
 addr = mmap(NULL, len, PROT_READ, MAP_SHARED | MAP_ANONYMOUS, -1, 0);
 if (addr == MAP_FAILED)
 errExit("mmap");
 printf("Allocated %ld (%#lx) bytes starting at %p\n",
 (long) len, (unsigned long) len, addr);
 printf("Before mlock:\n");
 displayMincore(addr, len);
   /* Khóa các trang được chỉ định bởi tham số dòng lệnh vào bộ nhớ */
 for (j = 0; j + lockLen <= len; j += stepSize)
 if (mlock(addr + j, lockLen) == -1)
 errExit("mlock");
 printf("After mlock:\n");
 displayMincore(addr, len);
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– vmem/memlock.c
```

Phiên bản shell dưới đây minh họa một lần chạy mẫu của chương trình trong [Liệt kê 50-2](#page-7-0). Trong ví dụ này, chúng ta cấp phát 32 trang (page), và trong mỗi nhóm 8 trang, chúng ta khóa 3 trang liên tiếp:

```
$ su Giả định quyền siêu người dùng
Password:
## ./memlock 32 8 3
Allocated 131072 (0x20000) bytes starting at 0x4014a000
Before mlock:
0x4014a000: ................................
After mlock:
0x4014a000: ***.....***.....***.....***.....
```

Trong phần đầu ra của chương trình, các dấu chấm đại diện cho các trang không nằm thường trú trong bộ nhớ (resident in memory), và dấu hoa thị đại diện cho các trang đang thường trú trong bộ nhớ. Như chúng ta có thể thấy từ dòng đầu ra cuối cùng, cứ trong mỗi nhóm 8 trang thì có 3 trang thường trú trong bộ nhớ.

Trong ví dụ này, chúng ta giả định có quyền siêu người dùng (superuser privilege) để chương trình có thể sử dụng `mlock()`. Điều này là không bắt buộc từ Linux 2.6.9 trở về sau nếu lượng bộ nhớ cần khóa nằm trong giới hạn tài nguyên mềm `RLIMIT_MEMLOCK` (soft resource limit).

## 50.4 Khuyến nghị Mẫu Sử dụng Bộ nhớ trong Tương lai: madvise()

System Call (lời gọi hệ thống) `madvise()` được sử dụng để cải thiện hiệu năng của một ứng dụng bằng cách thông báo cho kernel về cách sử dụng dự kiến của tiến trình gọi (calling process) đối với các trang trong dải bắt đầu từ `addr` và kéo dài trong `length` byte. Kernel có thể sử dụng thông tin này để nâng cao hiệu quả của các thao tác I/O được thực hiện trên ánh xạ tệp (file mapping) làm nền tảng cho các trang đó. (Xem Mục 49.4 để thảo luận về file mapping). Trên Linux, `madvise()` đã khả dụng kể từ kernel 2.4.

```c
## define _BSD_SOURCE
## include <sys/mman.h>
int madvise(void *addr, size_t length, int advice);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Giá trị được chỉ định trong `addr` phải được căn chỉnh theo kích thước trang (page-aligned), và `length` sẽ được làm tròn lên thành bội số tiếp theo của kích thước trang hệ thống. Tham số `advice` là một trong các giá trị sau:

### MADV_NORMAL

Đây là hành vi mặc định. Các trang được truyền theo cụm (một bội số nhỏ của kích thước trang hệ thống). Điều này dẫn đến việc đọc trước (read-ahead) và đọc lùi (read-behind) ở một mức độ nhất định.

### MADV_RANDOM

Các trang trong vùng này sẽ được truy cập ngẫu nhiên, vì vậy việc đọc trước (read-ahead) sẽ không mang lại lợi ích nào. Do đó, kernel nên nạp lượng dữ liệu tối thiểu cho mỗi lần đọc.

### MADV\_SEQUENTIAL

Các trang (pages) trong vùng này sẽ được truy cập một lần theo tuần tự. Do đó, kernel có thể thực hiện thao tác đọc trước (read ahead) một cách chủ động, và các trang có thể được giải phóng nhanh chóng sau khi chúng được truy cập.

### MADV_WILLNEED

Đọc trước các trang trong vùng này để chuẩn bị cho việc truy cập trong tương lai. Thao tác `MADV_WILLNEED` có hiệu quả tương tự như System Call `readahead()` đặc trưng của Linux và thao tác `POSIX_FADV_WILLNEED` của POSIX.

### MADV_DONTNEED

Tiến trình gọi (calling process) không còn yêu cầu các trang trong vùng này phải thường trú trong bộ nhớ (memory-resident). Hiệu quả chính xác của cờ này thay đổi tùy theo các bản cài đặt (implementations) của UNIX. Đầu tiên, chúng ta lưu ý hành vi trên Linux. Đối với vùng `MAP_PRIVATE`, các trang được ánh xạ sẽ bị hủy bỏ một cách rõ ràng, có nghĩa là các sửa đổi đối với các trang đó sẽ bị mất. Dải địa chỉ bộ nhớ ảo (virtual memory address range) vẫn có thể truy cập được, nhưng lần truy cập tiếp theo vào mỗi trang sẽ dẫn đến một lỗi trang (page fault) để khởi tạo lại trang đó, hoặc với nội dung của tệp mà nó được ánh xạ tới, hoặc bằng các số không trong trường hợp ánh xạ ẩn danh (anonymous mapping). Điều này có thể được sử dụng như một phương pháp để khởi tạo lại nội dung của vùng `MAP_PRIVATE` một cách rõ ràng. Đối với vùng `MAP_SHARED`, kernel có thể hủy bỏ các trang đã bị sửa đổi trong một số trường hợp, tùy thuộc vào kiến trúc (hành vi này không xảy ra trên x86). Một số bản cài đặt UNIX khác cũng có hành vi tương tự như Linux. Tuy nhiên, trên một số bản cài đặt UNIX, `MADV_DONTNEED` chỉ đơn giản thông báo cho kernel rằng các trang được chỉ định có thể được hoán đổi ra ngoài (swapped out) nếu cần thiết. Các ứng dụng có tính di động (portable applications) không nên phụ thuộc vào ngữ nghĩa hủy diệt của Linux đối với `MADV_DONTNEED`.

Linux 2.6.16 đã bổ sung ba giá trị gợi ý phi

## 50.5 Tổng kết

Trong chương này, chúng ta đã xem xét các thao tác khác nhau có thể được thực hiện trên bộ nhớ ảo (virtual memory) của một tiến trình (process):

- System Call `mprotect()` thay đổi quyền bảo vệ (protection) trên một vùng bộ nhớ ảo.
- Các system call `mlock()` và `mlockall()` khóa một phần hoặc toàn bộ không gian địa chỉ ảo (virtual address space) của tiến trình vào bộ nhớ vật lý (physical memory).
- System Call `mincore()` báo cáo những trang (page) nào trong một vùng bộ nhớ ảo hiện đang thường trú trong bộ nhớ vật lý.
- System Call `madvise()` và hàm `posix_madvise()` cho phép một tiến trình đưa ra lời khuyên cho kernel về các mẫu sử dụng bộ nhớ dự kiến của tiến trình đó.

## 50.6 Bài tập

- **50-1.** Xác minh hiệu ứng của giới hạn tài nguyên `RLIMIT_MEMLOCK` bằng cách viết một chương trình thiết lập một giá trị cho giới hạn này và sau đó cố gắng khóa nhiều bộ nhớ hơn mức giới hạn.
- **50-2.** Viết một chương trình để xác minh hoạt động của thao tác `madvise()` với cờ `MADV_DONTNEED` đối với một ánh xạ `MAP_PRIVATE` có thể ghi được (writable).
