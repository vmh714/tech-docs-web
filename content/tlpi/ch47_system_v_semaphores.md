# Chương 47: SEMAPHORE SYSTEM V (SYSTEM V SEMAPHORES)

Chương trình này mô tả các semaphore System V (System V semaphores). Không giống như các cơ chế IPC (Inter-Process Communication) được mô tả trong các chương trước, semaphore System V không được sử dụng để truyền dữ liệu giữa các tiến trình (process). Thay vào đó, chúng cho phép các tiến trình đồng bộ hóa (synchronize) các hoạt động của mình. Một ứng dụng phổ biến của semaphore là đồng bộ hóa quyền truy cập vào một khối bộ nhớ chia sẻ (shared memory), nhằm ngăn chặn một tiến trình truy cập vào bộ nhớ chia sẻ cùng lúc với một tiến trình khác đang cập nhật nó.

Một semaphore là một số nguyên được quản lý bởi kernel (kernel-maintained integer) có giá trị bị giới hạn lớn hơn hoặc bằng 0. Nhiều thao tác khác nhau (tức là các system call) có thể được thực hiện trên một semaphore, bao gồm:

- thiết lập semaphore thành một giá trị tuyệt đối;
- cộng thêm một số vào giá trị hiện tại của semaphore;
- trừ đi một số từ giá trị hiện tại của semaphore; và
- chờ cho đến khi giá trị của semaphore bằng 0.

Hai thao tác cuối cùng có thể khiến tiến trình gọi (calling process) bị block (chặn). Khi giảm giá trị của semaphore, kernel sẽ chặn mọi nỗ lực làm cho giá trị giảm xuống dưới 0. Tương tự, việc chờ semaphore bằng 0 sẽ block tiến trình gọi nếu giá trị semaphore hiện tại khác 0. Trong cả hai trường hợp, tiến trình gọi vẫn tiếp tục bị block cho đến khi một tiến trình khác thay đổi semaphore thành một giá trị cho phép thao tác được tiếp tục, tại thời điểm đó kernel sẽ đánh thức (wake) tiến trình bị block. [Hình 47-1](#page-89-0) minh họa việc sử dụng một semaphore để đồng bộ hóa các hành động của hai tiến trình luân phiên thay đổi giá trị semaphore giữa 0 và 1.

![](_page_89_Figure_1.jpeg)

**Hình 47-1:** Sử dụng semaphore để đồng bộ hóa hai tiến trình

Xét về mặt điều khiển các hành động của một tiến trình, bản thân semaphore không mang ý nghĩa gì nếu đứng độc lập. Ý nghĩa của nó chỉ được quyết định bởi các mối liên kết được gán cho nó bởi các tiến trình sử dụng semaphore đó. Thông thường, các tiến trình thống nhất một quy ước liên kết semaphore với một tài nguyên dùng chung (shared resource), chẳng hạn như một vùng nhớ chia sẻ. Các mục đích sử dụng khác của semaphore cũng có thể thực hiện được, chẳng hạn như đồng bộ hóa giữa tiến trình cha và tiến trình con sau lời gọi hàm `fork()`. (Ở Mục 24.5, chúng ta đã xem xét việc sử dụng tín hiệu - signal để hoàn thành tác vụ tương tự).

## 47.1 Tổng quan (Overview)

Các bước chung để sử dụng một semaphore System V bao gồm:

- Tạo hoặc mở một tập hợp semaphore (semaphore set) bằng cách sử dụng `semget()`.
- Khởi tạo các semaphore trong tập hợp bằng cách sử dụng thao tác `SETVAL` hoặc `SETALL` của `semctl()`. (Chỉ một tiến trình nên thực hiện việc này).
- Thực hiện các thao tác trên giá trị semaphore bằng cách sử dụng `semop()`. Các tiến trình sử dụng semaphore thường dùng các thao tác này để biểu thị việc chiếm giữ (acquisition) và giải phóng (release) một tài nguyên dùng chung.
- Khi tất cả các tiến trình đã hoàn tất việc sử dụng tập hợp semaphore, hãy xóa tập hợp đó bằng cách sử dụng thao tác `IPC_RMID` của `semctl()`. (Chỉ một tiến trình nên thực hiện việc này).

Hầu hết các hệ điều hành đều cung cấp một số loại nguyên thủy semaphore (semaphore primitive) để sử dụng trong các chương trình ứng dụng. Tuy nhiên, semaphore System V trở nên phức tạp một cách bất thường do chúng được cấp phát theo các nhóm gọi là tập hợp semaphore (semaphore set). Số lượng semaphore trong một tập hợp được chỉ định khi tập hợp được tạo bằng system call `semget()`. Mặc dù việc thao tác trên một semaphore đơn lẻ tại một thời điểm là phổ biến, system call `semop()` cho phép chúng ta thực hiện một nhóm các thao tác một cách nguyên tử (atomically) trên nhiều semaphore trong cùng một tập hợp.

Vì semaphore System V được tạo và khởi tạo theo các bước riêng biệt, các điều kiện tranh chấp (race condition) có thể phát sinh nếu hai tiến trình cố gắng thực hiện các bước này cùng một lúc. Việc mô tả điều kiện tranh chấp này và cách tránh nó đòi hỏi chúng ta phải mô tả `semctl()` trước khi mô tả `semop()`, điều này có nghĩa là có khá nhiều tài liệu cần phải được bao phủ trước khi chúng ta có tất cả các chi tiết cần thiết để hiểu rõ hoàn toàn về semaphore.

Trong lúc này, chúng ta cung cấp [Đoạn mã 47-1](#page-91-0) như một ví dụ đơn giản về việc sử dụng các system call semaphore khác nhau. Chương trình này hoạt động ở hai chế độ:

- Nhận một đối số dòng lệnh (command-line argument) là một số nguyên duy nhất, chương trình tạo một tập hợp semaphore mới chứa một semaphore duy nhất và khởi tạo semaphore thành giá trị được cung cấp trong đối số dòng lệnh. Chương trình hiển thị định danh (identifier) của tập hợp semaphore mới.
- Nhận hai đối số dòng lệnh, chương trình giải thích chúng lần lượt là (theo thứ tự) định danh của một tập hợp semaphore hiện có và một giá trị sẽ được cộng vào semaphore đầu tiên (đánh số 0) trong tập hợp đó. Chương trình thực hiện thao tác được chỉ định trên semaphore đó. Để cho phép chúng ta theo dõi hoạt động của semaphore, chương trình in ra các thông báo trước và sau khi thao tác. Mỗi thông báo này bắt đầu bằng PID (Process ID), để chúng ta có thể phân biệt đầu ra của nhiều tiến trình chạy chương trình.

Nhật ký phiên shell (shell session log) sau đây minh họa việc sử dụng chương trình trong [Đoạn mã 47-1](#page-91-0). Chúng ta bắt đầu bằng cách tạo một semaphore được khởi tạo bằng 0:

```
$ ./svsem_demo 0
Semaphore ID = 98307 ID of new semaphore set
```

Sau đó, chúng ta thực thi một câu lệnh chạy ngầm (background command) cố gắng giảm giá trị của semaphore đi 2:

```
$ ./svsem_demo 98307 -2 &
23338: about to semop at 10:19:42
[1] 23338
```

Câu lệnh này bị chặn (blocked) vì giá trị của semaphore không thể giảm xuống dưới 0. Bây giờ, chúng ta thực thi một câu lệnh cộng thêm 3 vào giá trị của semaphore:

```
$ ./svsem_demo 98307 +3
23339: about to semop at 10:19:55
23339: semop completed at 10:19:55
23338: semop completed at 10:19:55
[1]+ Done ./svsem_demo 98307 -2
```

Thao tác tăng semaphore thành công ngay lập tức và khiến thao tác giảm semaphore trong câu lệnh chạy ngầm được tiếp tục, vì thao tác đó lúc này có thể được thực hiện mà không làm cho giá trị của semaphore giảm xuống dưới 0.

**Listing 47-1:** Tạo và thao tác với System V semaphore

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_demo.c
## include <sys/types.h>
## include <sys/sem.h>
## include <sys/stat.h>
## include "curr_time.h" /* Declaration of currTime() */
## include "semun.h" /* Definition of semun union */
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int semid;
 if (argc < 2 || argc > 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s init-value\n"
 " or: %s semid operation\n", argv[0], argv[0]);
 if (argc == 2) { /* Create and initialize semaphore */
 union semun arg;
 semid = semget(IPC_PRIVATE, 1, S_IRUSR | S_IWUSR);
 if (semid == -1)
 errExit("semid");
 arg.val = getInt(argv[1], 0, "init-value");
 if (semctl(semid, /* semnum= */ 0, SETVAL, arg) == -1)
 errExit("semctl");
 printf("Semaphore ID = %d\n", semid);
 } else { /* Perform an operation on first semaphore */
 struct sembuf sop; /* Structure defining operation */
 semid = getInt(argv[1], 0, "semid");
 sop.sem_num = 0; /* Specifies first semaphore in set */
 sop.sem_op = getInt(argv[2], 0, "operation");
 /* Add, subtract, or wait for 0 */
 sop.sem_flg = 0; /* No special options for operation */
 printf("%ld: about to semop at %s\n", (long) getpid(), currTime("%T"));
 if (semop(semid, &sop, 1) == -1)
 errExit("semop");
 printf("%ld: semop completed at %s\n", (long) getpid(), currTime("%T"));
 }
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_demo.c
```

## 47.2 Tạo hoặc Mở một Semaphore Set

System Call `semget()` tạo một semaphore set mới hoặc lấy định danh (identifier) của một set đã tồn tại.

```
## include <sys/types.h> /* For portability */
## include <sys/sem.h>
int semget(key_t key, int nsems, int semflg);
                    Returns semaphore set identifier on success, or –1 on error
```

Đối số `key` là một khóa được tạo bằng một trong các phương pháp được mô tả trong Mục [45.2](#page-48-1) (nghĩa là, thường là giá trị `IPC_PRIVATE` hoặc một khóa do hàm `ftok()` trả về).

Nếu chúng ta sử dụng `semget()` để tạo một semaphore set mới, thì `nsems` chỉ định số lượng semaphore trong set đó và bắt buộc phải lớn hơn 0. Nếu chúng ta sử dụng `semget()` để lấy định danh của một set đã tồn tại, thì `nsems` phải nhỏ hơn hoặc bằng kích thước của set đó (nếu không sẽ dẫn đến lỗi `EINVAL`). Không thể thay đổi số lượng semaphore trong một set đã tồn tại.

Đối số `semflg` là một mặt nạ bit (bit mask) chỉ định các quyền được thiết lập trên một semaphore set mới hoặc được kiểm tra đối với một set đã tồn tại. Các quyền này được chỉ định tương tự như đối với các tệp (Bảng 15-4, trang 295). Ngoài ra, có thể kết hợp (dùng toán tử OR `|`) không hoặc nhiều cờ sau đây vào `semflg` để điều khiển hoạt động của `semget()`:

`IPC_CREAT`

Nếu chưa có semaphore set nào với khóa được chỉ định tồn tại, hãy tạo một set mới.

`IPC_EXCL`

Nếu `IPC_CREAT` cũng được chỉ định và một semaphore set với khóa được chỉ định đã tồn tại, hàm sẽ thất bại và trả về lỗi `EEXIST`.

Các cờ này được mô tả chi tiết hơn trong Mục [45.1.](#page-45-0)

Khi thành công, `semget()` trả về định danh cho semaphore set mới hoặc đã tồn tại. Các system call tiếp theo tham chiếu đến từng semaphore riêng lẻ phải chỉ định cả định danh của semaphore set và số hiệu (number) của semaphore trong set đó. Các semaphore trong một set được đánh số bắt đầu từ 0.

```

## 47.3 Các Thao Tác Điều Khiển Semaphore (Semaphore Control Operations)

System Call `semctl()` thực hiện nhiều thao tác điều khiển khác nhau trên một tập hợp semaphore (semaphore set) hoặc trên một semaphore đơn lẻ bên trong một tập hợp.

```

## include <sys/types.h> /* For portability */

## include <sys/sem.h>

int semctl(int semid, int semnum, int cmd, ... /* union semun arg */);
Trả về số nguyên không âm khi thành công (xem văn bản); trả về –1 khi lỗi

```

Đối số `semid` là định danh (identifier) của tập hợp semaphore mà trên đó thao tác sẽ được thực hiện. Đối với các thao tác được thực hiện trên một semaphore đơn lẻ, đối số `semnum` xác định một semaphore cụ thể trong tập hợp. Đối với các thao tác khác, đối số này bị bỏ qua và chúng ta có thể chỉ định nó là 0. Đối số `cmd` chỉ định thao tác cần thực hiện.

Một số thao tác nhất định yêu cầu đối số thứ tư cho `semctl()`, mà chúng ta gọi là `arg` trong phần còn lại của mục này. Đối số này là một union được định nghĩa như trong Liệt kê 47-2 (Listing 47-2). Chúng ta phải định nghĩa tường minh union này trong các chương trình của mình. Chúng ta thực hiện điều này trong các chương trình ví dụ của mình bằng cách bao gồm tệp tiêu đề (header file) trong Liệt kê 47-2.

> Mặc dù việc đặt định nghĩa của union `semun` vào một tệp tiêu đề chuẩn là hợp lý, SUSv3 lại yêu cầu lập trình viên phải tự định nghĩa nó một cách tường minh. Tuy nhiên, một số triển khai UNIX thực sự cung cấp định nghĩa này trong `<sys/sem.h>`. Các phiên bản glibc cũ hơn (từ phiên bản 2.0 trở xuống) cũng cung cấp định nghĩa này. Để tuân thủ SUSv3, các phiên bản glibc gần đây hơn thì không, và macro `_SEM_SEMUN_UNDEFINED` được định nghĩa với giá trị 1 trong `<sys/sem.h>` để chỉ ra thực tế này (nghĩa là một ứng dụng được biên dịch với glibc có thể kiểm tra macro này để xác định xem chương trình có phải tự định nghĩa union `semun` hay không).

**Liệt kê 47-2 (Listing 47-2):** Định nghĩa của union `semun`

```

––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––svsem/semun.h

## ifndef SEMUN_H

## define SEMUN_H /* Prevent accidental double inclusion */

## include <sys/types.h> /* For portability */

## include <sys/sem.h>

union semun { /* Used in calls to semctl() */
int val;
struct semid_ds * buf;
unsigned short * array;

## if defined(__linux__)

struct seminfo * __buf;

## endif

};

## endif

––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––svsem/semun.h

```

SUSv2 và SUSv3 quy định rằng đối số cuối cùng cho `semctl()` là tùy chọn (optional). Tuy nhiên, một số ít triển khai UNIX (chủ yếu là các phiên bản cũ) và các phiên bản glibc cũ hơn đã định nghĩa nguyên mẫu (prototype) cho `semctl()` như sau:

```

int semctl(int semid, int semnum, int cmd, union semun arg);

```

Điều này có nghĩa là đối số thứ tư là bắt buộc ngay cả trong những trường hợp nó không thực sự được sử dụng (ví dụ: các thao tác `IPC_RMID` và `GETVAL` được mô tả bên dưới). Để đảm bảo tính di động (portability) đầy đủ, chúng ta chỉ định một đối số cuối cùng giả (dummy final argument) cho `semctl()` trong các lệnh gọi mà nó không bắt buộc.

Trong phần còn lại của mục này, chúng ta sẽ xem xét các thao tác điều khiển khác nhau có thể được chỉ định cho `cmd`.

### Các thao tác điều khiển chung (Generic control operations)

Các thao tác sau đây tương tự như các thao tác có thể được áp dụng cho các loại đối tượng System V IPC khác. Trong mỗi trường hợp, đối số `semnum` bị bỏ qua. Các chi tiết bổ sung về những thao tác này, bao gồm cả các đặc quyền và quyền hạn mà tiến trình gọi (calling process) yêu cầu, được cung cấp tại Mục [45.3](#page-50-0).

IPC\_RMID

Xóa ngay lập tức tập hợp semaphore và cấu trúc dữ liệu `semid_ds` liên quan của nó. Bất kỳ tiến trình nào đang bị chặn (blocked) trong các lời gọi `semop()` đang chờ các semaphore trong tập hợp này sẽ được đánh thức ngay lập tức, với `semop()` báo cáo lỗi `EIDRM`. Đối số `arg` là không bắt buộc.

IPC\_STAT

Đặt một bản sao của cấu trúc dữ liệu `semid_ds` liên quan đến tập hợp semaphore này vào bộ đệm mà `arg.buf` trỏ tới. Chúng tôi mô tả cấu trúc `semid_ds` trong Mục [47.4.](#page-95-0)

IPC\_SET

Cập nhật các trường được chọn của cấu trúc dữ liệu `semid_ds` liên quan đến tập hợp semaphore này bằng cách sử dụng các giá trị trong bộ đệm do `arg.buf` trỏ tới.

### Truy xuất và khởi tạo giá trị semaphore

Các thao tác sau đây truy xuất hoặc khởi tạo giá trị của một semaphore riêng lẻ hoặc của tất cả các semaphore trong một tập hợp. Việc truy xuất giá trị semaphore yêu cầu quyền đọc (read permission) trên semaphore, trong khi việc khởi tạo giá trị yêu cầu quyền thay đổi (alter - write permission).

GETVAL

Là kết quả hàm của nó, `semctl()` trả về giá trị của semaphore thứ `semnum` trong tập hợp semaphore được chỉ định bởi `semid`. Đối số `arg` là không bắt buộc.

SETVAL

Giá trị của semaphore thứ `semnum` trong tập hợp được trỏ tới bởi `semid` được khởi tạo thành giá trị được chỉ định trong `arg.val`.

GETALL

Truy xuất giá trị của tất cả các semaphore trong tập hợp được trỏ tới bởi `semid`, đặt chúng vào mảng do `arg.array` trỏ tới. Lập trình viên phải đảm bảo rằng mảng này có đủ kích thước. (Số lượng semaphore trong một tập hợp có thể lấy từ trường `sem_nsems` của cấu trúc dữ liệu `semid_ds` được truy xuất bằng thao tác `IPC_STAT`.) Đối số `semnum` bị bỏ qua. Một ví dụ về việc sử dụng thao tác `GETALL` được cung cấp trong [Listing 47-3](#page-96-0).

SETALL

Khởi tạo tất cả các semaphore trong tập hợp được trỏ tới bởi `semid`, sử dụng các giá trị được cung cấp trong mảng do `arg.array` trỏ tới. Đối số `semnum` bị bỏ qua. [Listing 47-4](#page-97-0) minh họa việc sử dụng thao tác `SETALL`.

Nếu một tiến trình khác đang chờ thực hiện một thao tác trên (các) semaphore bị sửa đổi bởi thao tác `SETVAL` hoặc `SETALL`, và (các) thay đổi được thực hiện cho phép thao tác đó tiếp tục, thì kernel sẽ đánh thức tiến trình đó dậy.

Thay đổi giá trị của semaphore bằng `SETVAL` hoặc `SETALL` sẽ xóa các mục nhập hoàn tác (undo entries) cho semaphore đó trong tất cả các tiến trình. Chúng tôi mô tả các mục nhập hoàn tác semaphore trong Mục [47.8](#page-109-1).

Lưu ý rằng thông tin do `GETVAL` và `GETALL` trả về có thể đã lỗi thời vào thời điểm tiến trình gọi sử dụng nó. Bất kỳ chương trình nào phụ thuộc vào thông tin do các thao tác này trả về mà không thay đổi đều có thể gặp phải tình trạng tranh chấp điều kiện dạng thời điểm kiểm tra, thời điểm sử dụng (time-of-check, time-of-use race conditions - Mục 38.6).

## Truy xuất thông tin cho từng semaphore

Các thao tác sau đây trả về (thông qua giá trị trả về của hàm) thông tin về semaphore thứ `semnum` của tập hợp được tham chiếu bởi `semid`. Đối với tất cả các thao tác này, quyền đọc (read permission) là bắt buộc trên tập hợp semaphore (semaphore set), và đối số `arg` là không cần thiết.

GETPID

Trả về ID tiến trình (Process ID) của tiến trình gần đây nhất thực hiện hàm `semop()` trên semaphore này; đây được gọi là giá trị `sempid`. Nếu chưa có tiến trình nào thực hiện `semop()` trên semaphore này, giá trị `0` sẽ được trả về.

GETNCNT

Trả về số lượng tiến trình hiện đang chờ giá trị của semaphore này tăng lên; đây được gọi là giá trị `semncnt`.

GETZCNT

Trả về số lượng tiến trình hiện đang chờ giá trị của semaphore này trở về `0`; đây được gọi là giá trị `semzcnt`.

Giống như các thao tác `GETVAL` và `GETALL` được mô tả ở trên, thông tin do các thao tác `GETPID`, `GETNCNT`, và `GETZCNT` trả về có thể đã lỗi thời vào thời điểm tiến trình gọi (calling process) sử dụng nó.

[Li스팅 47-3](#page-96-0) minh họa việc sử dụng ba thao tác này.

## 47.4 Cấu trúc dữ liệu liên kết với Semaphore

Mỗi tập hợp semaphore có một cấu trúc dữ liệu `semid_ds` đi kèm theo định dạng sau:

```c

struct semid_ds {
struct ipc_perm sem_perm; /* Quyền sở hữu và phân quyền */
time_t sem_otime; /* Thời gian thực hiện semop() gần nhất */
time_t sem_ctime; /* Thời gian thay đổi gần nhất */
unsigned long sem_nsems; /* Số lượng semaphore trong tập hợp */
};

```

SUSv3 yêu cầu tất cả các trường mà chúng ta hiển thị trong cấu trúc `semid_ds`. Một số cài đặt UNIX khác bao gồm các trường phi tiêu chuẩn bổ sung. Trên Linux 2.4 trở lên, trường `sem_nsems` được định kiểu là `unsigned long`. SUSv3 quy định kiểu của trường này là `unsigned short`, và nó được định nghĩa như vậy trên Linux 2.2 và trên hầu hết các cài đặt UNIX khác.

Các trường của cấu trúc `semid_ds` được cập nhật ngầm định (implicitly updated) bởi các System Call về semaphore khác nhau, và một số trường con (subfield) của trường `sem_perm` có thể được cập nhật tường minh (explicitly updated) bằng cách sử dụng thao tác `semctl()` `IPC_SET`. Chi tiết như sau:

### sem\_perm

Khi tập hợp semaphore được tạo, các trường của cấu trúc con này được khởi tạo như được mô tả trong Mục [45.3.](#page-50-0) Các trường con `uid`, `gid`, và `mode` có thể được cập nhật thông qua `IPC_SET`.

sem\_otime

Trường này được đặt thành `0` khi tập hợp semaphore được tạo, và sau đó được đặt thành thời gian hiện tại tại mỗi lệnh `semop()` thành công, hoặc khi giá trị semaphore bị sửa đổi do kết quả của thao tác `SEM_UNDO` (Mục [47.8](#page-109-1)). Trường này và `sem_ctime` được định kiểu là `time_t`, và lưu trữ thời gian tính bằng giây kể từ mốc thời gian Epoch.

sem\_ctime

Trường này được đặt thành thời gian hiện tại khi tập hợp semaphore được tạo và tại mỗi thao tác `IPC_SET`, `SETALL`, hoặc `SETVAL` thành công. (Trên một số cài đặt UNIX, các thao tác `SETALL` và `SETVAL` không sửa đổi `sem_ctime`.)

sem\_nsems

Khi tập hợp được tạo, trường này được khởi tạo bằng số lượng semaphore có trong tập hợp.

Trong phần còn lại của mục này, chúng ta sẽ xem xét hai chương trình mẫu sử dụng cấu trúc dữ liệu `semid_ds` và một số thao tác `semctl()` được mô tả trong Mục [47.3](#page-92-0). Chúng ta minh họa việc sử dụng cả hai chương trình này trong Mục [47.6](#page-101-0).

## Giám sát một tập hợp semaphore (Monitoring a semaphore set)

Chương trình trong [Listing 47-3](#page-96-0) sử dụng các thao tác `semctl()` khác nhau để hiển thị thông tin về một tập hợp semaphore (semaphore set) hiện có, với định danh (identifier) của nó được truyền vào làm đối số dòng lệnh (command-line argument). Đầu tiên, chương trình hiển thị các trường thời gian (time fields) từ cấu trúc dữ liệu `semid_ds`. Sau đó, đối với mỗi semaphore trong tập hợp, chương trình hiển thị giá trị hiện tại của semaphore, cũng như các giá trị `sempid`, `semncnt` và `semzcnt` của nó.

**Listing 47-3:** Chương trình giám sát semaphore

```

–––––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_mon.c

## include <sys/types.h>

## include <sys/sem.h>

## include <time.h>

## include "semun.h" /* Định nghĩa union semun */

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct semid_ds ds;
union semun arg, dummy; /* Đối số thứ tư cho semctl() */
int semid, j;

```

```

if (argc != 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s semid\n", argv[0]);
semid = getInt(argv[1], 0, "semid");
arg.buf = &ds;
if (semctl(semid, 0, IPC_STAT, arg) == -1)
errExit("semctl");
printf("Semaphore changed: %s", ctime(&ds.sem_ctime));
printf("Last semop(): %s", ctime(&ds.sem_otime));
/* Hiển thị thông tin cho từng semaphore */
arg.array = calloc(ds.sem_nsems, sizeof(arg.array[0]));
if (arg.array == NULL)
errExit("calloc");
if (semctl(semid, 0, GETALL, arg) == -1)
errExit("semctl-GETALL");
printf("Sem # Value SEMPID SEMNCNT SEMZCNT\n");
for (j = 0; j < ds.sem_nsems; j++)
printf("%3d %5d %5d %5d %5d\n", j, arg.array[j],
semctl(semid, j, GETPID, dummy),
semctl(semid, j, GETNCNT, dummy),
semctl(semid, j, GETZCNT, dummy));
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_mon.c

```

### Khởi tạo tất cả semaphore trong một tập hợp (Initializing all semaphores in a set)

Chương trình trong [Listing 47-4](#page-97-0) cung cấp một giao diện dòng lệnh (command-line interface) để khởi tạo tất cả các semaphore trong một tập hợp có sẵn. Đối số dòng lệnh đầu tiên là định danh của tập hợp semaphore cần khởi tạo. Các đối số dòng lệnh còn lại chỉ định các giá trị mà các semaphore sẽ được khởi tạo theo (phải có số lượng đối số này bằng với số lượng semaphore trong tập hợp).

**Listing 47-4:** Sử dụng thao tác SETALL để khởi tạo một tập hợp System V semaphore

```

––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_setall.c

## include <sys/types.h>

## include <sys/sem.h>

## include "semun.h" /* Định nghĩa union semun */

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct semid_ds ds;
union semun arg; /* Đối số thứ tư cho semctl() */
int j, semid;

```

```

if (argc < 3 || strcmp(argv[1], "--help") == 0)
usageErr("%s semid val...\n", argv[0]);
semid = getInt(argv[1], 0, "semid");
/* Lấy kích thước của tập hợp semaphore */
arg.buf = &ds;
if (semctl(semid, 0, IPC_STAT, arg) == -1)
errExit("semctl");
if (ds.sem_nsems != argc - 2)
cmdLineErr("Set contains %ld semaphores, but %d values were supplied\n",
(long) ds.sem_nsems, argc - 2);
/* Thiết lập mảng giá trị; thực hiện khởi tạo semaphore */
arg.array = calloc(ds.sem_nsems, sizeof(arg.array[0]));
if (arg.array == NULL)
errExit("calloc");
for (j = 2; j < argc; j++)
arg.array[j - 2] = getInt(argv[j], 0, "val");
if (semctl(semid, 0, SETALL, arg) == -1)
errExit("semctl-SETALL");
printf("Semaphore values changed (PID=%ld)\n", (long) getpid());
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_setall.c

```

## 47.5 Khởi tạo Semaphore (Semaphore Initialization)

Theo tiêu chuẩn SUSv3, một bản cài đặt (implementation) không bắt buộc phải khởi tạo giá trị của các semaphore trong một tập hợp được tạo bởi `semget()`. Thay vào đó, lập trình viên phải chủ động khởi tạo các semaphore bằng cách sử dụng System Call `semctl()`. (Trên Linux, các semaphore trả về bởi `semget()` thực tế được khởi tạo bằng 0, nhưng chúng ta không thể phụ thuộc vào hành vi này một cách có tính di động - portably). Như đã nêu trước đó, việc tạo và khởi tạo semaphore phải được thực hiện bằng các system call riêng biệt, thay vì trong một bước nguyên tử (atomic step) duy nhất, dẫn đến khả năng xảy ra điều kiện tranh chấp (race condition) khi khởi tạo semaphore. Trong phần này, chúng ta sẽ mô tả chi tiết bản chất của tranh chấp và xem xét một phương pháp tránh nó dựa trên ý tưởng được mô tả trong [Stevens, 1999].

Giả sử rằng chúng ta có một ứng dụng bao gồm nhiều tiến trình ngang hàng (peer process) sử dụng một semaphore để phối hợp các hành động của chúng. Vì không có tiến trình đơn lẻ nào được đảm bảo là tiến trình đầu tiên sử dụng semaphore (đây là ý nghĩa của thuật ngữ peer), mỗi tiến trình phải sẵn sàng tạo và khởi tạo semaphore nếu nó chưa tồn tại. Cho mục đích này, chúng ta có thể cân nhắc sử dụng đoạn mã được hiển thị trong [Listing 47-5](#page-99-0).

```

–––––––––––––––––––––––––––––––––––––––––––––––––from svsem/svsem_bad_init.c
/* Tạo một tập hợp chứa 1 semaphore */
semid = semget(key, 1, IPC_CREAT | IPC_EXCL | perms);
if (semid != -1) { /* Tạo semaphore thành công */
union semun arg;
/* XXXX */
arg.val = 0; /* Khởi tạo semaphore */
if (semctl(semid, 0, SETVAL, arg) == -1)
errExit("semctl");
} else { /* Chúng ta không tạo semaphore */
if (errno != EEXIST) { /* Lỗi không mong đợi từ semget() */
errExit("semget");
semid = semget(key, 1, perms); /* Lấy ID của tập hợp đã tồn tại */
if (semid == -1)
errExit("semget");
}
/* Bây giờ thực hiện một số thao tác trên semaphore */
sops[0].sem_op = 1; /* Cộng 1... */
sops[0].sem_num = 0; /* vào semaphore 0 */
sops[0].sem_flg = 0;
if (semop(semid, sops, 1) == -1)
errExit("semop");
–––––––––––––––––––––––––––––––––––––––––––––––––from svsem/svsem_bad_init.c

```

Vấn đề với đoạn mã trong Listing 47-5 là nếu hai tiến trình (process) thực thi nó cùng lúc, thì trình tự được hiển thị trong [Hình 47-2](#page-101-1) có thể xảy ra, nếu lát cắt thời gian (time slice) của tiến trình đầu tiên vô tình hết hạn tại điểm được đánh dấu XXXX trong mã. Trình tự này gây ra vấn đề vì hai lý do. Thứ nhất, tiến trình B thực hiện `semop()` trên một semaphore chưa được khởi tạo (nghĩa là giá trị của nó là tùy ý). Thứ hai, lệnh gọi `semctl()` trong tiến trình A ghi đè lên các thay đổi do tiến trình B thực hiện.

Giải pháp cho vấn đề này dựa trên một tính năng lịch sử, và hiện đã được chuẩn hóa, trong việc khởi tạo trường `sem_otime` trong cấu trúc dữ liệu `semid_ds` liên kết với tập hợp semaphore (semaphore set). Khi một tập hợp semaphore được tạo lần đầu, trường `sem_otime` được khởi tạo bằng 0, và nó chỉ bị thay đổi bởi một lệnh gọi `semop()` tiếp theo. Chúng ta có thể khai thác tính năng này để loại bỏ tình trạng tranh chấp (race condition) được mô tả ở trên. Chúng ta thực hiện điều này bằng cách chèn thêm mã để buộc tiến trình thứ hai (tức là tiến trình không tạo semaphore) phải đợi cho đến khi tiến trình đầu tiên đã khởi tạo semaphore và thực thi một lệnh gọi `semop()` giúp cập nhật trường `sem_otime`, nhưng không làm thay đổi giá trị của semaphore. Đoạn mã đã sửa đổi được hiển thị trong Listing 47-6.

> [!NOTE]
> Thật không may, giải pháp cho vấn đề khởi tạo được mô tả trong văn bản chính không hoạt động trên tất cả các triển khai UNIX. Trong một số phiên bản của các hệ thống phái sinh BSD hiện đại, `semop()` không cập nhật trường `sem_otime`.

```c

–––––––––––––––––––––––––––––––––––––––––––––––– from svsem/svsem_good_init.c
semid = semget(key, 1, IPC_CREAT | IPC_EXCL | perms);
if (semid != -1) { /* Đã tạo semaphore thành công */
union semun arg;
struct sembuf sop;
arg.val = 0; /* Khởi tạo nó bằng 0 */
if (semctl(semid, 0, SETVAL, arg) == -1)
errExit("semctl");
/* Thực hiện một thao tác semaphore "no-op" - thay đổi sem_otime
để các tiến trình khác có thể thấy chúng ta đã khởi tạo tập hợp. */
sop.sem_num = 0; /* Thao tác trên semaphore 0 */
sop.sem_op = 0; /* Đợi giá trị bằng 0 */
sop.sem_flg = 0;
if (semop(semid, &sop, 1) == -1)
errExit("semop");
} else { /* Chúng ta không tạo tập hợp semaphore */
const int MAX_TRIES = 10;
int j;
union semun arg;
struct semid_ds ds;
if (errno != EEXIST) { /* Lỗi không mong đợi từ semget() */
errExit("semget");
semid = semget(key, 1, perms); /* Truy xuất ID của tập hợp hiện có */
if (semid == -1)
errExit("semget");
/* Đợi cho đến khi một tiến trình khác đã gọi semop() */
arg.buf = &ds;
for (j = 0; j < MAX_TRIES; j++) {
if (semctl(semid, 0, IPC_STAT, arg) == -1)
errExit("semctl");
if (ds.sem_otime != 0) /* semop() đã được thực hiện? */
break; /* Có, thoát vòng lặp */
sleep(1); /* Nếu chưa, đợi và thử lại */
}
if (ds.sem_otime == 0) /* Vòng lặp đã chạy đến hoàn tất! */
fatal("Semaphore hiện có chưa được khởi tạo");
}
/* Bây giờ thực hiện một số thao tác trên semaphore */
–––––––––––––––––––––––––––––––––––––––––––––––– from svsem/svsem_good_init.c

```

Chúng ta có thể sử dụng các biến thể của kỹ thuật được hiển thị trong Listing 47-6 để đảm bảo rằng nhiều semaphore trong một tập hợp được khởi tạo chính xác, hoặc một semaphore được khởi tạo với giá trị khác không.

Giải pháp khá phức tạp cho vấn đề tranh chấp này không cần thiết trong tất cả các ứng dụng. Chúng ta không cần nó nếu một tiến trình được đảm bảo có thể tạo và khởi tạo semaphore trước khi bất kỳ tiến trình nào khác cố gắng sử dụng nó. Ví dụ, điều này sẽ xảy ra nếu một tiến trình cha (parent process) tạo và khởi tạo semaphore trước khi tạo các tiến trình con (child process) mà nó chia sẻ semaphore cùng. Trong những trường hợp như vậy, tiến trình đầu tiên chỉ cần thực hiện lệnh gọi `semctl()` với `SETVAL` hoặc `SETALL` ngay sau lệnh gọi `semget()`.

![](_page_101_Figure_1.jpeg)

**Hình 47-2:** Hai tiến trình tranh chấp để khởi tạo cùng một semaphore

## 47.6 Các thao tác Semaphore

System call `semop()` thực hiện một hoặc nhiều thao tác trên các semaphore trong tập hợp semaphore được xác định bởi `semid`.

```c

## include <sys/types.h> /* Để đảm bảo tính di động */

## include <sys/sem.h>

int semop(int semid, struct sembuf *sops, unsigned int nsops);
Trả về 0 khi thành công, hoặc –1 khi có lỗi

```

Đối số `sops` là một con trỏ đến một mảng chứa các thao tác cần thực hiện, và `nsops` cung cấp kích thước của mảng này (phải chứa ít nhất một phần tử). Các thao tác được thực hiện một cách nguyên tử (atomically) và theo thứ tự trong mảng. Các phần tử của mảng `sops` là các cấu trúc có dạng sau:

```c

struct sembuf {
unsigned short sem_num; /* Số thứ tự semaphore */
short sem_op; /* Thao tác cần thực hiện */
short sem_flg; /* Các cờ thao tác (IPC_NOWAIT và SEM_UNDO) */
};

```

Trường `sem_num` xác định semaphore trong tập hợp mà thao tác sẽ được thực hiện trên đó. Trường `sem_op` chỉ định thao tác cần thực hiện:

-  Nếu `sem_op` lớn hơn 0, giá trị của `sem_op` được cộng vào giá trị semaphore. Kết quả là, các tiến trình khác đang đợi để giảm giá trị semaphore có thể được đánh thức và thực hiện các thao tác của chúng. Tiến trình gọi phải có quyền thay đổi (ghi) trên semaphore.

- Nếu `sem_op` bằng 0, giá trị của semaphore (tập tín hiệu/semaphores) được kiểm tra xem hiện tại có bằng 0 hay không. Nếu có, thao tác hoàn tất ngay lập tức; ngược lại, `semop()` sẽ bị chặn (block) cho đến khi giá trị semaphore trở về 0. Tiến trình gọi (calling process) phải có quyền đọc (read permission) trên semaphore đó.
- Nếu `sem_op` nhỏ hơn 0, giá trị của semaphore sẽ bị giảm đi một lượng được chỉ định trong `sem_op`. Nếu giá trị hiện tại của semaphore lớn hơn hoặc bằng giá trị tuyệt đối của `sem_op`, thao tác hoàn tất ngay lập tức. Ngược lại, `semop()` sẽ bị chặn (block) cho đến khi giá trị semaphore được tăng lên đến mức cho phép thực hiện thao tác mà không dẫn đến giá trị âm. Tiến trình gọi (calling process) phải có quyền thay đổi (alter permission) trên semaphore đó.

Về mặt ngữ nghĩa, việc tăng giá trị của semaphore tương ứng với việc giải phóng một tài nguyên (make a resource available) để các tiến trình khác có thể sử dụng, trong khi việc giảm giá trị của semaphore tương ứng với việc đặt trước (reserve) một tài nguyên để tiến trình này sử dụng (độc quyền - exclusive). Khi giảm giá trị của semaphore, thao tác sẽ bị chặn nếu giá trị semaphore quá thấp—nghĩa là, nếu một tiến trình khác đã đặt trước tài nguyên đó.

Khi một lời gọi `semop()` bị chặn (block), tiến trình sẽ tiếp tục ở trạng thái bị chặn cho đến khi một trong các sự kiện sau xảy ra:

- Một tiến trình khác sửa đổi giá trị của semaphore sao cho thao tác được yêu cầu có thể tiếp tục.
- Một tín hiệu (signal) ngắt lời gọi `semop()`. Trong trường hợp này, lỗi `EINTR` sẽ xảy ra. (Như đã lưu ý trong Mục 21.5, `semop()` không bao giờ tự động được khởi động lại sau khi bị ngắt bởi một trình xử lý tín hiệu - signal handler).
- Một tiến trình khác xóa semaphore được tham chiếu bởi `semid`. Trong trường hợp này, `semop()` thất bại với mã lỗi `EIDRM`.

Chúng ta có thể ngăn không cho `semop()` bị chặn khi thực hiện thao tác trên một semaphore cụ thể bằng cách chỉ định cờ `IPC_NOWAIT` trong trường `sem_flg` tương ứng. Trong trường hợp này, nếu `semop()` đáng lẽ phải bị chặn, nó sẽ thất bại và trả về lỗi `EAGAIN` thay thế.

Mặc dù thông thường chúng ta thao tác trên một semaphore đơn lẻ tại một thời điểm, nhưng vẫn có thể thực hiện một lời gọi `semop()` để thao tác trên nhiều semaphore trong một tập hợp (set). Điểm quan trọng cần lưu ý là nhóm các thao tác này được thực hiện một cách nguyên tử (atomically); nghĩa là, `semop()` hoặc sẽ thực hiện tất cả các thao tác ngay lập tức (nếu có thể), hoặc sẽ bị chặn cho đến khi có thể thực hiện đồng thời tất cả các thao tác đó.

> Rất ít hệ thống tài liệu hóa thực tế rằng `semop()` thực hiện các thao tác theo thứ tự mảng (array order), mặc dù tất cả các hệ thống mà tác giả biết đều làm như vậy, và một số ứng dụng phụ thuộc vào hành vi này. Tiêu chuẩn SUSv4 bổ sung văn bản yêu cầu rõ ràng hành vi này.

Đoạn mã liệt kê (Listing) 47-7 minh họa việc sử dụng `semop()` để thực hiện các thao tác trên ba semaphore trong một tập hợp. Các thao tác trên semaphore 0 và 2 có thể không tiếp tục được ngay lập tức, tùy thuộc vào giá trị hiện tại của các semaphore. Nếu thao tác trên semaphore 0 không thể thực hiện ngay lập tức, thì không có thao tác nào trong số các thao tác được yêu cầu được thực hiện và `semop()` sẽ bị chặn. Mặt khác, nếu thao tác trên semaphore 0 có thể thực hiện ngay lập tức, nhưng thao tác trên semaphore 2 thì không—vì cờ `IPC_NOWAIT` đã được chỉ định—nên không có thao tác nào được thực hiện và `semop()` trả về ngay lập tức với lỗi `EAGAIN`.

System Call `semtimedop()` thực hiện tác vụ giống như `semop()`, ngoại trừ việc đối số `timeout` chỉ định giới hạn trên cho khoảng thời gian mà lời gọi sẽ bị chặn.

```c

## define _GNU_SOURCE

## include <sys/types.h> /* For portability */

## include <sys/sem.h>

int semtimedop(int semid, struct sembuf *sops, unsigned int nsops,
struct timespec *timeout);
Trả về 0 khi thành công, hoặc –1 khi lỗi

```

Đối số `timeout` là con trỏ trỏ đến một cấu trúc `timespec` (Mục 23.4.2), cho phép biểu diễn khoảng thời gian dưới dạng số giây và nano giây. Nếu khoảng thời gian được chỉ định hết hạn trước khi hoàn thành thao tác semaphore, `semtimedop()` sẽ thất bại với lỗi `EAGAIN`. Nếu `timeout` được chỉ định là `NULL`, `semtimedop()` hoạt động hoàn toàn giống như `semop()`.

System Call `semtimedop()` được cung cấp như một phương pháp hiệu quả hơn để thiết lập thời gian chờ (timeout) cho một thao tác semaphore so với việc sử dụng kết hợp `setitimer()` và `semop()`. Lợi ích hiệu năng nhỏ mà phương pháp này mang lại rất quan trọng đối với một số ứng dụng nhất định (đặc biệt là một số hệ thống cơ sở dữ liệu) cần thực hiện các thao tác đó thường xuyên. Tuy nhiên, `semtimedop()` không được định nghĩa trong SUSv3 và chỉ xuất hiện trên một vài cài đặt UNIX khác.

> System Call `semtimedop()` xuất hiện như một tính năng mới trong Linux 2.6 và sau đó đã được back-port vào Linux 2.4, bắt đầu từ phiên bản kernel 2.4.22.

```c

struct sembuf sops[3];
sops[0].sem_num = 0; /* Trừ 1 khỏi semaphore 0 */
sops[0].sem_op = -1;
sops[0].sem_flg = 0;
sops[1].sem_num = 1; /* Cộng 2 vào semaphore 1 */
sops[1].sem_op = 2;
sops[1].sem_flg = 0;
sops[2].sem_num = 2; /* Chờ semaphore 2 bằng 0 */
sops[2].sem_op = 0;
sops[2].sem_flg = IPC_NOWAIT; /* Nhưng không chặn nếu thao tác
không thể thực hiện ngay lập tức */
if (semop(semid, sops, 3) == -1) {
if (errno == EAGAIN) /* Semaphore 2 đáng lẽ đã bị chặn */
printf("Thao tác sẽ bị chặn\n");
else
errExit("semop"); /* Lỗi khác */
}

```

## Chương trình ví dụ

Chương trình trong [Liệt kê 47-8](#page-105-0) cung cấp giao diện dòng lệnh (command-line interface) cho System Call `semop()`. Đối số đầu tiên của chương trình này là định danh (identifier) của tập semaphore (semaphore set) mà trên đó các thao tác sẽ được thực hiện.

Mỗi đối số dòng lệnh còn lại chỉ định một nhóm các thao tác semaphore sẽ được thực hiện trong một lời gọi `semop()` duy nhất. Các thao tác trong một đối số dòng lệnh đơn lẻ được phân tách bằng dấu phẩy. Mỗi thao tác tuân theo một trong các dạng sau:

-  `semnum+value`: cộng `value` vào semaphore `semnum`.
-  `semnum-value`: trừ `value` ra khỏi semaphore `semnum`.
-  `semnum=0`: kiểm tra semaphore `semnum` xem có bằng 0 hay không.

Ở cuối mỗi thao tác, chúng ta có thể tùy chọn đính kèm ký tự `n`, `u`, hoặc cả hai. Ký tự `n` có nghĩa là bao gồm cờ `IPC_NOWAIT` trong giá trị `sem_flg` cho thao tác này. Ký tự `u` có nghĩa là bao gồm cờ `SEM_UNDO` trong `sem_flg`. (Chúng ta sẽ mô tả cờ `SEM_UNDO` trong Mục [47.8](#page-109-1)).

Dòng lệnh sau đây chỉ định hai lời gọi `semop()` trên tập semaphore có định danh là 0:

### \$ **./svsem_op 0 0=0 0-1,1-2n**

Đối số dòng lệnh đầu tiên chỉ định một lời gọi `semop()` chờ cho đến khi semaphore số 0 bằng 0. Đối số thứ hai chỉ định một lời gọi `semop()` trừ 1 từ semaphore 0, và trừ 2 từ semaphore 1. Đối với thao tác trên semaphore 0, `sem_flg` là 0; đối với thao tác trên semaphore 1, `sem_flg` là `IPC_NOWAIT`.

**Liệt kê 47-8:** Thực hiện các thao tác semaphore System V bằng `semop()`

```c

––––––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_op.c

## include <sys/types.h>

## include <sys/sem.h>

## include <ctype.h>

## include "curr_time.h" /* Declaration of currTime() */

## include "tlpi_hdr.h"

## define MAX_SEMOPS 1000 /* Maximum operations that we permit for

a single semop() */
static void
usageError(const char *progName)
{
fprintf(stderr, "Usage: %s semid op[,op...] ...\n\n", progName);
fprintf(stderr, "'op' is either: <sem#>{+|-}<value>[n][u]\n");
fprintf(stderr, " or: <sem#>=0[n]\n");
fprintf(stderr, " \"n\" means include IPC_NOWAIT in 'op'\n");
fprintf(stderr, " \"u\" means include SEM_UNDO in 'op'\n\n");
fprintf(stderr, "The operations in each argument are "
"performed in a single semop() call\n\n");
fprintf(stderr, "e.g.: %s 12345 0+1,1-2un\n", progName);
fprintf(stderr, " %s 12345 0=0n 1+1,2-1u 1=0\n", progName);
exit(EXIT_FAILURE);
}
/* Parse comma-delimited operations in 'arg', returning them in the
array 'sops'. Return number of operations as function result. */
static int
parseOps(char *arg, struct sembuf sops[])
{
char *comma, *sign, *remaining, *flags;
int numOps; /* Number of operations in 'arg' */
for (numOps = 0, remaining = arg; ; numOps++) {
if (numOps >= MAX_SEMOPS)
cmdLineErr("Too many operations (maximum=%d): \"%s\"\n",
MAX_SEMOPS, arg);
if (*remaining == '\0')
fatal("Trailing comma or empty argument: \"%s\"", arg);
if (!isdigit((unsigned char) *remaining))
cmdLineErr("Expected initial digit: \"%s\"\n", arg);
sops[numOps].sem_num = strtol(remaining, &sign, 10);
if (*sign == '\0' || strchr("+-=", *sign) == NULL)
cmdLineErr("Expected '+', '-', or '=' in \"%s\"\n", arg);
if (!isdigit((unsigned char) *(sign + 1)))
cmdLineErr("Expected digit after '%c' in \"%s\"\n", *sign, arg);
sops[numOps].sem_op = strtol(sign + 1, &flags, 10);

```

```c

if (*sign == '-') /* Reverse sign of operation */
sops[numOps].sem_op = - sops[numOps].sem_op;
else if (*sign == '=') /* Should be '=0' */
if (sops[numOps].sem_op != 0)
cmdLineErr("Expected \"=0\" in \"%s\"\n", arg);
sops[numOps].sem_flg = 0;
for (;; flags++) {
if (*flags == 'n')
sops[numOps].sem_flg |= IPC_NOWAIT;
else if (*flags == 'u')
sops[numOps].sem_flg |= SEM_UNDO;
else
break;
}
if (*flags != ',' && *flags != '\0')
cmdLineErr("Bad trailing character (%c) in \"%s\"\n", *flags, arg);
comma = strchr(remaining, ',');
if (comma == NULL)
break; /* No comma --> no more ops */
else
remaining = comma + 1;
}
return numOps + 1;
}
int
main(int argc, char *argv[])
{
struct sembuf sops[MAX_SEMOPS];
int ind, nsops;
if (argc < 2 || strcmp(argv[1], "--help") == 0)
usageError(argv[0]);
for (ind = 2; argv[ind] != NULL; ind++) {
nsops = parseOps(argv[ind], sops);
printf("%5ld, %s: about to semop() [%s]\n", (long) getpid(),
currTime("%T"), argv[ind]);
if (semop(getInt(argv[1], 0, "semid"), sops, nsops) == -1)
errExit("semop (PID=%ld)", (long) getpid());
printf("%5ld, %s: semop() completed [%s]\n", (long) getpid(),
currTime("%T"), argv[ind]);
}
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/svsem_op.c

```

Sử dụng chương trình trong [Liệt kê 47-8](#page-105-0), cùng với nhiều chương trình khác được trình bày trong chương này, chúng ta có thể nghiên cứu hoạt động của semaphore System V, như được minh họa trong phiên làm việc shell dưới đây. Chúng ta bắt đầu bằng cách sử dụng một chương trình tạo ra một tập semaphore chứa hai semaphore, mà chúng ta khởi tạo lần lượt là 1 và 0:

```

$ ./svsem_create -p 2
32769 ID of semaphore set
$ ./svsem_setall 32769 1 0
Semaphore values changed (PID=3658)

```

Chúng tôi không hiển thị mã nguồn của chương trình svsem/svsem\_create.c trong chương này, nhưng nó được cung cấp trong gói mã nguồn của cuốn sách này. Chương trình này thực hiện chức năng tương đối giống với chương trình trong [Listing 46-1](#page-61-1) (ở trang [938](#page-61-1)) đối với hàng đợi thông điệp (message queue); nghĩa là nó tạo ra một tập hợp semaphore (semaphore set). Điểm khác biệt đáng chú ý duy nhất là svsem\_create.c nhận thêm một đối số chỉ định kích thước của tập hợp semaphore cần tạo.

Tiếp theo, chúng ta khởi chạy ba tiến trình nền (background instance) của chương trình trong [Listing 47-8](#page-105-0) để thực hiện các thao tác `semop()` trên tập hợp semaphore. Chương trình in ra các thông báo trước và sau mỗi thao tác semaphore. Các thông báo này bao gồm thời gian, để chúng ta có thể thấy thời điểm mỗi thao tác bắt đầu và hoàn thành, cùng với định danh tiến trình (Process ID - PID), giúp chúng ta theo dõi hoạt động của nhiều tiến trình cùng lúc. Lệnh đầu tiên thực hiện yêu cầu giảm cả hai semaphore đi 1 đơn vị:

```

$ ./svsem_op 32769 0-1,1-1 & Operation 1
3659, 16:02:05: about to semop() [0-1,1-1]
[1] 3659

```

Trong phần kết quả trên, chúng ta thấy rằng chương trình đã in ra thông báo cho biết thao tác `semop()` sắp được thực hiện, nhưng không in thêm bất kỳ thông báo nào nữa, bởi vì lời gọi `semop()` bị chặn (block). Lời gọi bị chặn vì semaphore 1 đang có giá trị là 0.

Tiếp theo, chúng ta thực hiện một lệnh đưa ra yêu cầu giảm semaphore 1 đi 1 đơn vị:

```

$ ./svsem_op 32769 1-1 & Operation 2
3660, 16:02:22: about to semop() [1-1]
[2] 3660

```

Lệnh này cũng bị chặn. Tiếp theo, chúng ta thực hiện một lệnh chờ cho đến khi giá trị của semaphore 0 bằng 0:

```

$ ./svsem_op 32769 0=0 & Operation 3
3661, 16:02:27: about to semop() [0=0]
[3] 3661

```

Một lần nữa, lệnh này bị chặn, trong trường hợp này là do giá trị của semaphore 0 hiện đang là 1.

Bây giờ, chúng ta sử dụng chương trình trong [Listing 47-3](#page-96-0) để kiểm tra tập hợp semaphore:

```

$ ./svsem_mon 32769
Semaphore changed: Sun Jul 25 16:01:53 2010
Last semop(): Thu Jan 1 01:00:00 1970
Sem # Value SEMPID SEMNCNT SEMZCNT
0 1 0 1 1
1 0 0 2 0

```

Khi một tập hợp semaphore được tạo, trường `sem_otime` của cấu trúc dữ liệu `semid\_ds` liên quan được khởi tạo bằng 0. Một giá trị thời gian lịch (calendar time) bằng 0 tương ứng với mốc thời gian gốc (Epoch) (Mục 10.1), và hàm `ctime()` hiển thị giá trị này là 1 giờ sáng, ngày 1 tháng 1 năm 1970, do múi giờ cục bộ là Trung Âu, đi trước giờ UTC một tiếng.

Kiểm tra kỹ hơn phần kết quả, chúng ta có thể thấy rằng đối với semaphore 0, giá trị `semncnt` là 1 vì thao tác 1 đang chờ để giảm giá trị semaphore, và `semzcnt` là 1 vì thao tác 3 đang chờ semaphore này bằng 0. Đối với semaphore 1, giá trị `semncnt` bằng 2 phản ánh thực tế là cả thao tác 1 và thao tác 2 đều đang chờ để giảm giá trị của semaphore này.

Tiếp theo, chúng ta thử một thao tác không chặn (nonblocking operation) trên tập hợp semaphore. Thao tác này chờ cho semaphore 0 bằng 0. Vì thao tác này không thể được thực hiện ngay lập tức, `semop()` thất bại với mã lỗi `EAGAIN`:

```

$ ./svsem_op 32769 0=0n Operation 4
3673, 16:03:13: about to semop() [0=0n]
ERROR [EAGAIN/EWOULDBLOCK Resource temporarily unavailable] semop (PID=3673)

```

Bây giờ chúng ta cộng thêm 1 vào semaphore 1. Thao tác này khiến hai trong số các tiến trình bị chặn trước đó (thao tác 1 và 3) được giải phóng (unblock):

```

$ ./svsem_op 32769 1+1 Operation 5
3674, 16:03:29: about to semop() [1+1]
3659, 16:03:29: semop() completed [0-1,1-1] Operation 1 completes
3661, 16:03:29: semop() completed [0=0] Operation 3 completes
3674, 16:03:29: semop() completed [1+1] Operation 5 completes
[1] Done ./svsem_op 32769 0-1,1-1
[3]+ Done ./svsem_op 32769 0=0

```

Khi sử dụng chương trình giám sát của mình để kiểm tra trạng thái của tập hợp semaphore, chúng ta thấy rằng trường `sem_otime` của cấu trúc dữ liệu `semid\_ds` liên quan đã được cập nhật, và các giá trị `sempid` của cả hai semaphore cũng được cập nhật. Chúng ta cũng thấy rằng giá trị `semncnt` của semaphore 1 hiện là 1, vì thao tác 2 vẫn đang bị chặn và chờ giảm giá trị của semaphore này:

### \$ **./svsem\_mon 32769** Semaphore changed: Sun Jul 25 16:01:53 2010 Last semop(): Sun Jul 25 16:03:29 2010 Sem # Value SEMPID SEMNCNT SEMZCNT 0 0 3661 0 0 1 0 3659 1 0

Từ kết quả trên, chúng ta thấy rằng giá trị `sem_otime` đã được cập nhật. Chúng ta cũng thấy rằng semaphore 0 chịu tác động gần nhất bởi tiến trình có PID 3661 (thao tác 3) và semaphore 1 chịu tác động gần nhất bởi tiến trình có PID 3659 (thao tác 1).

Cuối cùng, chúng ta xóa tập hợp semaphore. Thao tác này khiến cho thao tác 2 (vẫn đang bị chặn) thất bại với mã lỗi `EIDRM`:

```

$ ./svsem_rm 32769
ERROR [EIDRM Identifier removed] semop (PID=3660)

```

Chúng tôi không hiển thị mã nguồn của chương trình svsem/svsem\_rm.c trong chương này, nhưng nó được cung cấp trong gói mã nguồn của cuốn sách. Chương trình này thực hiện việc xóa tập hợp semaphore được xác định bởi đối số dòng lệnh của nó.
```

## 47.7 Xử lý các Thao tác Semaphore Bị Chặn Đồng Thời

Nếu có nhiều tiến trình (process) bị chặn khi cố gắng giảm giá trị của một semaphore đi cùng một lượng, thì không thể xác định trước tiến trình nào sẽ được phép thực hiện thao tác trước khi điều kiện cho phép (tức là tiến trình nào có thể thực hiện thao tác sẽ phụ thuộc vào sự ngẫu nhiên của thuật toán lập lịch tiến trình trong kernel).

Mặt khác, nếu các tiến trình bị chặn khi cố gắng giảm giá trị semaphore đi các lượng khác nhau, thì các yêu cầu sẽ được phục vụ theo thứ tự mà chúng trở nên khả thi. Giả sử rằng một semaphore hiện có giá trị là 0, và tiến trình A yêu cầu giảm giá trị của semaphore đi 2, sau đó tiến trình B yêu cầu giảm giá trị đi 1. Nếu một tiến trình thứ ba sau đó cộng thêm 1 vào semaphore, tiến trình B sẽ là tiến trình đầu tiên được bỏ chặn (unblock) và thực hiện thao tác của mình, mặc dù tiến trình A là tiến trình đưa ra yêu cầu đối với semaphore trước. Trong các ứng dụng được thiết kế kém, các kịch bản như vậy có thể dẫn đến hiện tượng đói tài nguyên (starvation), trong đó một tiến trình bị chặn vĩnh viễn vì trạng thái của semaphore không bao giờ đạt đến mức mà thao tác được yêu cầu có thể tiếp tục. Tiếp tục ví dụ của chúng ta, chúng ta có thể tưởng tượng ra các kịch bản trong đó nhiều tiến trình điều chỉnh semaphore sao cho giá trị của nó không bao giờ vượt quá 1, kết quả là tiến trình A vẫn bị chặn vĩnh viễn.

Hiện tượng đói tài nguyên (starvation) cũng có thể xảy ra nếu một tiến trình bị chặn khi cố gắng thực hiện các thao tác trên nhiều semaphore. Hãy xem xét kịch bản sau, được thực hiện trên một cặp semaphore, cả hai đều có giá trị ban đầu là 0:

- 1. Tiến trình A đưa ra yêu cầu trừ 1 từ semaphore 0 và 1 (bị chặn).
- 2. Tiến trình B đưa ra yêu cầu trừ 1 từ semaphore 0 (bị chặn).
- 3. Tiến trình C cộng 1 vào semaphore 0.

Tại thời điểm này, tiến trình B được bỏ chặn và hoàn thành yêu cầu của mình, mặc dù nó đưa ra yêu cầu sau tiến trình A. Một lần nữa, có thể thiết kế các kịch bản trong đó tiến trình A bị đói tài nguyên trong khi các tiến trình khác điều chỉnh và bị chặn trên giá trị của từng semaphore riêng lẻ.

## 47.8 Giá trị Hoàn tác Semaphore (Semaphore Undo Values)

Giả sử rằng, sau khi đã điều chỉnh giá trị của một semaphore (ví dụ: giảm giá trị semaphore xuống mức hiện tại là 0), một tiến trình sau đó chấm dứt hoạt động (terminates), dù là có chủ ý hay vô tình. Theo mặc định, giá trị của semaphore được giữ nguyên không đổi. Điều này có thể gây ra vấn đề cho các tiến trình khác đang sử dụng semaphore, vì chúng có thể bị chặn khi đang chờ semaphore đó—tức là chờ tiến trình đã chấm dứt hoàn tác sự thay đổi mà nó đã thực hiện.

Để tránh những vấn đề như vậy, chúng ta có thể sử dụng cờ `SEM_UNDO` khi thay đổi giá trị của một semaphore thông qua hàm `semop()`. Khi cờ này được chỉ định, kernel sẽ ghi lại hiệu ứng của thao tác semaphore, và sau đó sẽ hoàn tác thao tác đó nếu tiến trình chấm dứt. Việc hoàn tác này diễn ra bất kể tiến trình chấm dứt một cách bình thường hay bất thường.

Kernel không cần phải lưu giữ bản ghi của tất cả các thao tác được thực hiện bằng cách sử dụng `SEM_UNDO`. Chỉ cần ghi lại tổng của tất cả các thao tác điều chỉnh semaphore được thực hiện bằng `SEM_UNDO` trong một biến tổng số nguyên tính trên mỗi semaphore, mỗi tiến trình, được gọi là giá trị `semadj` (điều chỉnh semaphore - semaphore adjustment). Khi tiến trình chấm dứt, tất cả những gì cần thiết là trừ tổng số này khỏi giá trị hiện tại của semaphore.

> Kể từ Linux 2.6, các tiến trình (luồng - thread) được tạo bằng hàm `clone()` sẽ chia sẻ các giá trị `semadj` nếu cờ `CLONE_SYSVSEM` được sử dụng. Việc chia sẻ như vậy là bắt buộc để triển khai chuẩn POSIX threads. Thư viện luồng NPTL sử dụng `CLONE_SYSVSEM` để triển khai hàm `pthread_create()`.

Khi giá trị của một semaphore được thiết lập bằng thao tác `SETVAL` hoặc `SETALL` của hàm `semctl()`, các giá trị `semadj` tương ứng sẽ được xóa (tức là được đặt về 0) trong tất cả các tiến trình đang sử dụng semaphore đó. Điều này là hoàn toàn hợp lý, vì việc thiết lập tuyệt đối giá trị của một semaphore sẽ phá hủy giá trị liên quan đến bản ghi lịch sử được duy trì trong tổng `semadj`.

Một tiến trình con được tạo thông qua `fork()` không kế thừa các giá trị `semadj` của tiến trình cha; việc tiến trình con hoàn tác các thao tác semaphore của tiến trình cha là không có ý nghĩa. Mặt khác, các giá trị `semadj` được bảo toàn qua lời gọi `exec()`. Điều này cho phép chúng ta điều chỉnh giá trị semaphore bằng cách sử dụng `SEM_UNDO`, và sau đó `exec()` một chương trình không thực hiện thao tác nào trên semaphore, nhưng lại tự động điều chỉnh semaphore khi tiến trình chấm dứt. (Điều này có thể được sử dụng như một kỹ thuật cho phép một tiến trình khác phát hiện ra khi nào tiến trình này chấm dứt hoạt động).

## Ví dụ về hiệu ứng của SEM_UNDO

Nhật ký phiên shell sau đây cho thấy hiệu ứng của việc thực hiện các thao tác trên hai semaphore: một thao tác có cờ `SEM_UNDO` và một thao tác không có. Chúng ta bắt đầu bằng cách tạo một tập hợp (set) chứa hai semaphore:

```
$ ./svsem_create -p 2
131073
```

Tiếp theo, chúng ta thực thi một lệnh cộng 1 vào cả hai semaphore và sau đó kết thúc (terminate). Thao tác trên semaphore 0 có chỉ định cờ `SEM_UNDO`:

```
$ ./svsem_op 131073 0+1u 1+1
 2248, 06:41:56: about to semop()
 2248, 06:41:56: semop() completed
```

Bây giờ, chúng ta sử dụng chương trình trong [Listing 47-3](#page-96-0) để kiểm tra trạng thái của các semaphore:

```
$ ./svsem_mon 131073
Semaphore changed: Sun Jul 25 06:41:34 2010
Last semop(): Sun Jul 25 06:41:56 2010
Sem # Value SEMPID SEMNCNT SEMZCNT
 0 0 2248 0 0
 1 1 2248 0 0
```

Nhìn vào giá trị của các semaphore ở hai dòng cuối của kết quả đầu ra trên, chúng ta có thể thấy rằng thao tác trên semaphore 0 đã được hoàn tác (undone), nhưng thao tác trên semaphore 1 thì không.

## Những hạn chế của SEM_UNDO

Chúng ta kết luận bằng cách lưu ý rằng cờ `SEM_UNDO` ít hữu ích hơn vẻ bề ngoài của nó, vì hai lý do. Một là vì việc sửa đổi một semaphore thường tương ứng với việc có được (acquiring) hoặc giải phóng (releasing) một tài nguyên chia sẻ (shared resource) nào đó, bản thân việc sử dụng `SEM_UNDO` có thể là chưa đủ để cho phép một ứng dụng đa tiến trình (multiprocess application) phục hồi trong trường hợp một tiến trình đột ngột kết thúc (unexpectedly terminates). Trừ khi việc tiến trình kết thúc cũng tự động đưa trạng thái tài nguyên chia sẻ về một trạng thái nhất quán (không có khả năng xảy ra trong nhiều kịch bản), việc hoàn tác một thao tác semaphore có lẽ là không đủ để cho phép ứng dụng phục hồi.

Yếu tố thứ hai hạn chế tính hữu ích của `SEM_UNDO` là, trong một số trường hợp, không thể thực hiện việc điều chỉnh semaphore khi một tiến trình kết thúc. Hãy xem xét kịch bản sau, áp dụng cho một semaphore có giá trị ban đầu bằng 0:

- 1. Tiến trình A tăng giá trị của một semaphore lên 2, chỉ định cờ `SEM_UNDO` cho thao tác này.
- 2. Tiến trình B giảm giá trị của semaphore xuống 1, khiến giá trị của nó trở thành 1.
- 3. Tiến trình A kết thúc.

Tại thời điểm này, không thể hoàn tác hoàn toàn hiệu ứng của thao tác do tiến trình A thực hiện ở bước 1, vì giá trị của semaphore quá thấp. Có ba cách khả thi để giải quyết tình huống này:

- Buộc tiến trình phải chặn (block) cho đến khi việc điều chỉnh semaphore khả thi.
- Giảm giá trị semaphore xuống mức thấp nhất có thể (tức là về 0) rồi thoát.
- Thoát mà không thực hiện bất kỳ sự điều chỉnh semaphore nào.

Giải pháp đầu tiên không khả thi vì nó có thể buộc một tiến trình đang kết thúc phải bị chặn vĩnh viễn. Linux áp dụng giải pháp thứ hai. Một số cài đặt UNIX khác áp dụng giải pháp thứ ba. Tiêu chuẩn SUSv3 không đưa ra quy định nào về việc một hệ thống cài đặt nên làm gì trong tình huống này.

> Một thao tác hoàn tác (undo operation) cố gắng nâng giá trị của semaphore vượt quá giá trị tối đa cho phép là 32.767 (giới hạn `SEMVMX`, được mô tả tại Mục [47.10](#page-114-0)) cũng gây ra hành vi bất thường. Trong trường hợp này, kernel luôn thực hiện việc điều chỉnh, qua đó (một cách không hợp lệ) nâng giá trị của semaphore vượt quá `SEMVMX`.

## 47.9 Triển khai Giao thức Semaphore Nhị phân

API cho System V semaphore rất phức tạp, bởi vì giá trị của semaphore có thể được điều chỉnh bằng các khoảng giá trị tùy ý, và vì semaphore được cấp phát cũng như thao tác theo tập hợp (set). Cả hai tính năng này đều cung cấp nhiều chức năng hơn mức thường cần thiết trong các ứng dụng, do đó việc triển khai một số giao thức (API) đơn giản hơn dựa trên System V semaphore là rất hữu ích.

Một giao thức thường được sử dụng là semaphore nhị phân (binary semaphore). Semaphore nhị phân có hai giá trị: khả dụng (available/free) và đã được chiếm giữ (reserved/in use). Hai thao tác được định nghĩa cho semaphore nhị phân:

Reserve (Chiếm giữ): Cố gắng chiếm giữ semaphore này để sử dụng độc quyền (exclusive use). Nếu semaphore đã bị chiếm giữ bởi một Process khác, thì tiến hành chặn (block) cho đến khi semaphore được giải phóng.

Release (Giải phóng): Giải phóng một semaphore hiện đang bị chiếm giữ, để nó có thể được chiếm giữ bởi một Process khác.

> Trong khoa học máy tính hàn lâm, hai thao tác này thường được gọi bằng tên P và V, là các chữ cái đầu trong thuật ngữ tiếng Hà Lan dùng cho các thao tác này. Danh pháp này được đặt ra bởi nhà khoa học máy tính quá cố người Hà Lan Edsger Dijkstra, người đã thực hiện phần lớn công trình lý thuyết ban đầu về semaphore. Các thuật ngữ down (giảm giá trị semaphore) và up (tăng giá trị semaphore) cũng được sử dụng. POSIX gọi hai thao tác này là wait và post.

Thao tác thứ ba đôi khi cũng được định nghĩa:

Reserve conditionally (Chiếm giữ có điều kiện): Thực hiện một nỗ lực không chặn (nonblocking) để chiếm giữ semaphore này nhằm sử dụng độc quyền. Nếu semaphore đã bị chiếm giữ, ngay lập tức trả về trạng thái cho biết semaphore không khả dụng.

Khi triển khai semaphore nhị phân, chúng ta phải chọn cách biểu diễn các trạng thái khả dụng và đã chiếm giữ, cũng như cách triển khai các thao tác trên. Suy ngẫm một chút sẽ giúp chúng ta nhận ra rằng cách tốt nhất để biểu diễn các trạng thái là sử dụng giá trị `1` cho trạng thái trống (free) và giá trị `0` cho trạng thái đã chiếm giữ (reserved), với các thao tác chiếm giữ và giải phóng sẽ lần lượt làm giảm và tăng giá trị của semaphore đi một đơn vị.

[Listing 47-9](#page-112-0) và [Listing 47-10](#page-113-0) cung cấp một bản triển khai semaphore nhị phân sử dụng System V semaphore. Ngoài việc cung cấp các nguyên mẫu (prototype) hàm trong bản triển khai, tệp tiêu đề (header file) ở [Listing 47-9](#page-112-0) còn khai báo hai biến Boolean toàn cục được phơi bày (expose) bởi bản triển khai. Biến `bsUseSemUndo` điều khiển việc bản triển khai có sử dụng cờ `SEM_UNDO` trong các lời gọi hàm `semop()` hay không. Biến `bsRetryOnEintr` điều khiển việc bản triển khai có thực hiện lại (restart) các lời gọi `semop()` bị ngắt bởi tín hiệu (signal) hay không.

**Listing 47-9:** Tệp tiêu đề cho `binary_sems.c`

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/binary_sems.h
## ifndef BINARY_SEMS_H /* Prevent accidental double inclusion */
## define BINARY_SEMS_H
## include "tlpi_hdr.h"
/* Variables controlling operation of functions below */
extern Boolean bsUseSemUndo; /* Use SEM_UNDO during semop()? */
extern Boolean bsRetryOnEintr; /* Retry if semop() interrupted by
 signal handler? */
int initSemAvailable(int semId, int semNum);
int initSemInUse(int semId, int semNum);
int reserveSem(int semId, int semNum);
int releaseSem(int semId, int semNum);
## endif
–––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/binary_sems.h
```

[Listing 47-10](#page-113-0) minh họa việc triển khai các hàm semaphore nhị phân. Mỗi hàm trong bản triển khai này nhận hai tham số, dùng để xác định một tập hợp semaphore (semaphore set) và số thứ tự của một semaphore trong tập hợp đó. (Các hàm này không xử lý việc tạo và xóa các tập hợp semaphore; chúng cũng không xử lý hiện tượng Race Condition được mô tả trong Mục [47.5](#page-98-0)). Chúng ta sử dụng các hàm này trong các chương trình ví dụ được trình bày ở Mục [48.4](#page-124-0).

**Listing 47-10:** Triển khai semaphore nhị phân sử dụng System V semaphore

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/binary_sems.c
## include <sys/types.h>
## include <sys/sem.h>
## include "semun.h" /* Definition of semun union */
## include "binary_sems.h"
Boolean bsUseSemUndo = FALSE;
Boolean bsRetryOnEintr = TRUE;
int /* Initialize semaphore to 1 (i.e., "available") */
initSemAvailable(int semId, int semNum)
{
 union semun arg;
 arg.val = 1;
 return semctl(semId, semNum, SETVAL, arg);
}
int /* Initialize semaphore to 0 (i.e., "in use") */
initSemInUse(int semId, int semNum)
{
 union semun arg;
 arg.val = 0;
 return semctl(semId, semNum, SETVAL, arg);
}
/* Reserve semaphore (blocking), return 0 on success, or -1 with 'errno'
 set to EINTR if operation was interrupted by a signal handler */
int /* Reserve semaphore - decrement it by 1 */
reserveSem(int semId, int semNum)
{
 struct sembuf sops;
 sops.sem_num = semNum;
 sops.sem_op = -1;
 sops.sem_flg = bsUseSemUndo ? SEM_UNDO : 0;
 while (semop(semId, &sops, 1) == -1)
 if (errno != EINTR || !bsRetryOnEintr)
 return -1;
 return 0;
}
```

```c
int /* Release semaphore - increment it by 1 */
releaseSem(int semId, int semNum)
{
 struct sembuf sops;
 sops.sem_num = semNum;
 sops.sem_op = 1;
 sops.sem_flg = bsUseSemUndo ? SEM_UNDO : 0;
 return semop(semId, &sops, 1);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– svsem/binary_sems.c
```

## 47.10 Giới hạn Semaphore (Semaphore Limits)

Hầu hết các bản cài đặt UNIX đều áp đặt các giới hạn khác nhau đối với hoạt động của System V semaphore. Dưới đây là danh sách các giới hạn semaphore trên Linux. System Call bị ảnh hưởng bởi giới hạn và mã lỗi trả về nếu đạt đến giới hạn đó được ghi trong ngoặc đơn.

SEMAEM

Đây là giá trị tối đa có thể được ghi lại trong tổng giá trị `semadj`. SEMAEM được định nghĩa có giá trị giống như SEMVMX (được mô tả bên dưới). (`semop()`, `ERANGE`)

SEMMNI

Đây là giới hạn trên toàn hệ thống về số lượng định danh semaphore (nói cách khác là tập hợp semaphore - semaphore set) có thể được tạo. (`semget()`, `ENOSPC`)

SEMMSL

Đây là số lượng semaphore tối đa có thể được cấp phát trong một tập hợp semaphore. (`semget()`, `EINVAL`)

SEMMNS

Đây là giới hạn trên toàn hệ thống về tổng số lượng semaphore trong tất cả các tập hợp semaphore. Số lượng semaphore trên hệ thống cũng bị giới hạn bởi SEMMNI và SEMMSL; trên thực tế, giá trị mặc định cho SEMMNS là tích của các giá trị mặc định của hai giới hạn này. (`semget()`, `ENOSPC`)

SEMOPM

Đây là số lượng thao tác tối đa trên mỗi lần gọi `semop()`. (`semop()`, `E2BIG`)

SEMVMX

Đây là giá trị tối đa cho một semaphore. (`semop()`, `ERANGE`)

Các giới hạn trên xuất hiện trên hầu hết các bản cài đặt UNIX. Một số bản cài đặt UNIX (nhưng không phải Linux) áp đặt các giới hạn bổ sung sau liên quan đến các thao tác hoàn tác semaphore (semaphore undo operations) (Mục [47.8](#page-109-1)):

SEMMNU

Đây là giới hạn trên toàn hệ thống về tổng số lượng cấu trúc hoàn tác semaphore (semaphore undo structure). Các cấu trúc hoàn tác được cấp phát để lưu trữ các giá trị `semadj`.

SEMUME

Đây là số lượng mục hoàn tác tối đa trên mỗi cấu trúc hoàn tác semaphore.

Khi khởi động hệ thống, các giới hạn semaphore được đặt thành các giá trị mặc định. Các giá trị mặc định này có thể thay đổi tùy theo các phiên bản kernel. (Kernel của một số nhà phân phối đặt các giá trị mặc định khác với các kernel thuần - vanilla kernel). Một số giới hạn này có thể được sửa đổi bằng cách thay đổi các giá trị được lưu trữ trong tệp `/proc/sys/kernel/sem` đặc trưng của Linux. Tệp này chứa bốn số được phân tách bằng khoảng trắng, theo thứ tự định nghĩa các giới hạn SEMMSL, SEMMNS, SEMOPM và SEMMNI. (Các giới hạn SEMVMX và SEMAEM không thể thay đổi; cả hai đều được cố định ở mức 32.767). Ví dụ, dưới đây là các giới hạn mặc định mà chúng ta thấy đối với Linux 2.6.31 trên một hệ thống x86-32:

```
$ cd /proc/sys/kernel
$ cat sem
250 32000 32 128
```

Các định dạng được sử dụng trong hệ thống tệp `/proc` của Linux không đồng nhất cho ba cơ chế System V IPC. Đối với hàng đợi thông báo (message queue) và bộ nhớ chia sẻ (shared memory), mỗi giới hạn cấu hình được quản lý bởi một tệp riêng biệt. Đối với semaphore, một tệp duy nhất chứa tất cả các giới hạn có thể cấu hình. Đây là một sự trùng hợp lịch sử xuất hiện trong quá trình phát triển các API này và rất khó để khắc phục vì lý do tương thích.

[Bảng 47-1](#page-115-0) hiển thị giá trị tối đa mà mỗi giới hạn có thể được nâng lên trên kiến trúc x86-32. Lưu ý các thông tin bổ sung sau cho bảng này:

- Có thể nâng SEMMSL lên các giá trị lớn hơn 65.536 và tạo các tập hợp semaphore có kích thước lớn hơn mức đó. Tuy nhiên, không thể sử dụng `semop()` để điều chỉnh các semaphore trong tập hợp vượt quá phần tử thứ 65.536.

> Do những giới hạn nhất định trong cách triển khai hiện tại, giới hạn trên thực tế được khuyến nghị cho kích thước của một tập hợp semaphore là khoảng 8000.

- Giới hạn trên thực tế đối với giới hạn SEMMNS được chi phối bởi lượng RAM khả dụng trên hệ thống.
- Giá trị giới hạn trên cho SEMOPM được xác định bởi các nguyên hàm cấp phát bộ nhớ (memory allocation primitive) được sử dụng bên trong kernel. Mức tối đa được khuyến nghị là 1000. Trong sử dụng thực tế, hiếm khi hữu ích khi thực hiện nhiều hơn một vài thao tác trong một lần gọi `semop()` duy nhất.

**Bảng 47-1:** Giới hạn System V semaphore

| Giới hạn | Giá trị giới hạn trên (x86-32) | |
|----------|--------------------------------|-|
| SEMMNI | 32768 (IPCMNI) | |
| SEMMSL | 65536 | |
| SEMMNS | 2147483647 (INT_MAX) | |
| SEMOPM | Xem văn bản | |

Thao tác `SEM_INFO` đặc trưng của Linux `semctl()` truy xuất một cấu trúc kiểu `seminfo`, chứa các giá trị của các giới hạn semaphore khác nhau:

```
union semun arg;
struct seminfo buf;
arg.__buf = &buf;
semctl(0, 0, IPC_INFO, arg);
```

Một thao tác liên quan đặc trưng của Linux, `SEM_INFO`, truy xuất cấu trúc `seminfo` chứa thông tin về các tài nguyên thực tế được sử dụng cho các đối tượng semaphore. Một ví dụ về việc sử dụng `SEM_INFO` được cung cấp trong tệp `svsem/svsem_info.c` trong gói mã nguồn của cuốn sách này.

Chi tiết về `IPC_INFO`, `SEM_INFO` và cấu trúc `seminfo` có thể được tìm thấy trong trang hướng dẫn thủ công (manual page) `semctl(2)`.

```

## 47.11 Nhược điểm của System V Semaphores

System V semaphores (Semaphore System V) có nhiều nhược điểm giống với hàng đợi thông điệp (message queues) (Mục [46.9\)](#page-84-1), bao gồm các điểm sau:

-  Semaphore được tham chiếu thông qua các định danh (identifiers) thay vì các bộ mô tả tập tin (file descriptors) được sử dụng bởi hầu hết các cơ chế I/O và IPC khác trong UNIX. Điều này gây khó khăn khi thực hiện các thao tác như vừa chờ trên một semaphore, vừa chờ dữ liệu đầu vào từ một file descriptor. (Có thể giải quyết khó khăn này bằng cách tạo một tiến trình con hoặc luồng (`thread`) hoạt động trên semaphore và ghi các thông điệp vào một pipe được giám sát, cùng với các file descriptor khác, sử dụng một trong các phương pháp được mô tả trong Chương 63.)
-  Việc sử dụng các khóa (keys) thay vì tên tập tin (filenames) để nhận diện semaphore làm tăng thêm độ phức tạp trong lập trình.
-  Việc sử dụng các system call (lời gọi hệ thống) riêng biệt để tạo và khởi tạo semaphore đồng nghĩa với việc, trong một số trường hợp, chúng ta phải tốn thêm công sức lập trình để tránh tình trạng tranh chấp (race conditions) khi khởi tạo một semaphore.
-  Kernel (nhân) không duy trì bộ đếm số lượng tiến trình đang tham chiếu đến một tập hợp semaphore (semaphore set). Điều này làm phức tạp quyết định về thời điểm thích hợp để xóa một tập hợp semaphore và gây khó khăn trong việc đảm bảo rằng một tập hợp không còn sử dụng được xóa bỏ.
-  Giao diện lập trình được cung cấp bởi System V quá phức tạp. Trong trường hợp thông thường, một chương trình chỉ thao tác trên một semaphore đơn lẻ. Khả năng thao tác đồng thời trên nhiều semaphore trong một tập hợp là không cần thiết.
-  Có nhiều giới hạn khác nhau đối có các hoạt động của semaphore. Các giới hạn này có thể cấu hình được, nhưng nếu một ứng dụng hoạt động ngoài phạm vi giới hạn mặc định, điều này vẫn đòi hỏi thêm công sức khi cài đặt ứng dụng.

Tuy nhiên, không giống như tình trạng với message queues, có ít lựa chọn thay thế hơn cho System V semaphores, và do đó có nhiều tình huống hơn mà chúng ta có thể chọn sử dụng chúng. Một giải pháp thay thế cho việc sử dụng semaphore là khóa bản ghi (record locking), mà chúng tôi mô tả trong Chương 55. Ngoài ra, từ kernel phiên bản 2.6 trở đi, Linux hỗ trợ sử dụng POSIX semaphores cho việc đồng bộ hóa tiến trình (process synchronization). Chúng tôi mô tả POSIX semaphores trong Chương 53.

## 47.12 Tóm tắt

System V semaphores cho phép các tiến trình đồng bộ hóa các hành động của chúng. Điều này rất hữu ích khi một tiến trình phải giành quyền truy cập độc quyền (exclusive access) vào một tài nguyên được chia sẻ nào đó, chẳng hạn như một vùng bộ nhớ chia sẻ (shared memory).

Semaphore được tạo và thao tác trong các tập hợp chứa một hoặc nhiều semaphore. Mỗi semaphore trong một tập hợp là một số nguyên có giá trị luôn lớn hơn hoặc bằng 0. System call `semop()` cho phép tiến trình gọi (caller) cộng một số nguyên vào semaphore, trừ một số nguyên khỏi semaphore, hoặc chờ cho semaphore bằng 0. Hai thao tác sau có thể khiến tiến trình gọi bị chặn (`block`).

Việc cài đặt semaphore không bắt buộc phải khởi tạo các thành phần của một tập hợp semaphore mới, vì vậy một ứng dụng phải tự khởi tạo tập hợp sau khi tạo nó. Khi có nhiều tiến trình ngang hàng (peer processes) cùng cố gắng tạo và khởi tạo semaphore, cần phải đặc biệt cẩn thận để tránh tình trạng tranh chấp (race condition) phát sinh từ thực tế là hai bước này được thực hiện thông qua các system call riêng biệt.

Khi nhiều tiến trình đang cố gắng giảm một semaphore đi cùng một lượng, sẽ không thể xác định trước tiến trình nào thực sự được phép thực hiện thao tác trước. Tuy nhiên, khi các tiến trình khác nhau cố gắng giảm một semaphore đi các lượng khác nhau, các thao tác sẽ hoàn thành theo thứ tự mà chúng có thể thực hiện được, và chúng ta có thể cần cẩn thận để tránh các kịch bản trong đó một tiến trình bị bỏ đói (starved) vì giá trị semaphore không bao giờ đạt đến mức cho phép thao tác của tiến trình đó tiếp tục.

Cờ `SEM_UNDO` cho phép các thao tác semaphore của một tiến trình được tự động hoàn tác khi tiến trình chấm dứt (termination). Điều này có thể hữu ích để tránh các kịch bản trong đó một tiến trình đột ngột kết thúc, để lại semaphore ở trạng thái khiến các tiến trình khác bị chặn vô thời hạn để chờ giá trị của semaphore được thay đổi bởi tiến trình đã kết thúc.

System V semaphores được cấp phát và thao tác theo các tập hợp, đồng thời có thể được tăng hoặc giảm một lượng tùy ý. Điều này cung cấp nhiều tính năng hơn mức cần thiết của hầu hết các ứng dụng. Một yêu cầu phổ biến là đối với các semaphore nhị phân (binary semaphores) đơn lẻ, chỉ nhận các giá trị 0 và 1. Chúng tôi đã trình cách triển khai binary semaphores dựa trên nền tảng của System V semaphores.

## Thông tin thêm

[Bovet & Cesati, 2005] và [Maxwell, 1999] cung cấp một số nền tảng về việc cài đặt semaphore (semaphore) trên Linux. [Dijkstra, 1968] là một tài liệu kinh điển ban đầu về lý thuyết semaphore.

## 47.13 Bài tập

- **47-1.** Thử nghiệm với chương trình trong [Listing 47-8](#page-105-0) (`svsem_op.c`) để xác nhận sự hiểu biết của bạn về System Call `semop()`.
- **47-2.** Sửa đổi chương trình trong Listing 24-6 (`fork_sig_sync.c`, trang 528) để sử dụng semaphore thay vì signal (tín hiệu) nhằm đồng bộ hóa tiến trình (process) cha và tiến trình con.
- **47-3.** Thử nghiệm với chương trình trong [Listing 47-8](#page-105-0) (`svsem_op.c`) và các chương trình semaphore khác được cung cấp trong chương này để xem điều gì xảy ra với giá trị `sempid` nếu một tiến trình đang thoát thực hiện thao tác điều chỉnh `SEM_UNDO` đối với một semaphore.
- **47-4.** Thêm hàm `reserveSemNB()` vào mã nguồn trong [Listing 47-10](#page-113-0) (`binary_sems.c`) để thực hiện thao tác đặt trước có điều kiện (conditionally operation), sử dụng cờ `IPC_NOWAIT`.

- **47-5.** Đối với hệ điều hành VMS, hãng Digital cung cấp một phương pháp đồng bộ hóa tương tự như semaphore nhị phân (binary semaphore), gọi là cờ sự kiện (event flag). Một cờ sự kiện có hai giá trị có thể có: đã xóa (`clear`) và đã thiết lập (`set`), và bốn thao tác sau có thể được thực hiện: `setEventFlag` để thiết lập cờ; `clearEventFlag` để xóa cờ; `waitForEventFlag` để chặn (block) cho đến khi cờ được thiết lập; và `getFlagState` để lấy trạng thái hiện tại của cờ. Hãy thiết kế một phương pháp cài đặt cờ sự kiện bằng cách sử dụng semaphore System V. Việc cài đặt này sẽ yêu cầu hai đối số cho mỗi hàm ở trên: định danh semaphore (semaphore identifier) và số hiệu semaphore (semaphore number). (Việc cân nhắc thao tác `waitForEventFlag` sẽ khiến bạn nhận ra rằng các giá trị được chọn cho `clear` và `set` không phải là các giá trị hiển nhiên).
- **47-6.** Cài đặt một giao thức semaphore nhị phân sử dụng đường ống có tên (named pipe). Cung cấp các hàm để đặt trước, giải phóng, và đặt trước có điều kiện semaphore.
- **47-7.** Viết một chương trình tương tự như chương trình trong [Listing 46-6](#page-76-1) (`svmsg_ls.c`, trang [953\)](#page-76-1), sử dụng các thao tác `SEM_INFO` và `SEM_STAT` của `semctl()` để lấy và hiển thị danh sách tất cả các tập hợp semaphore trên hệ thống.
