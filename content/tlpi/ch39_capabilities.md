# Chương 39: Cơ chế Capabilities (Linux Capabilities)

Chương này mô tả cơ chế capability của Linux, cơ chế này chia mô hình đặc quyền "được tất cả hoặc mất tất cả" (all-or-nothing) truyền thống của UNIX thành các capability riêng lẻ có thể được bật hoặc tắt một cách độc lập. Việc sử dụng capability cho phép một chương trình thực hiện một số thao tác đặc quyền (privileged operation), đồng thời ngăn cản nó thực hiện các thao tác khác.

## 39.1 Cơ sở lý luận cho Capabilities

Mô hình đặc quyền UNIX truyền thống chia các tiến trình (Process) thành hai loại: những tiến trình có ID người dùng hiệu dụng (effective user ID) là 0 (siêu người dùng - superuser), qua mặt tất cả các kiểm tra đặc quyền, và tất cả các tiến trình khác chịu sự kiểm tra đặc quyền theo ID người dùng và nhóm của chúng.

Độ chi tiết thô (coarse granularity) của mô hình này là một vấn đề. Nếu chúng ta muốn cho phép một tiến trình thực hiện một thao tác nào đó chỉ cho phép siêu người dùng thực hiện — ví dụ, thay đổi thời gian hệ thống — thì chúng ta phải chạy tiến trình đó với effective user ID là 0. (Nếu một người dùng không có đặc quyền cần thực hiện các thao tác như vậy, điều này thường được triển khai bằng cách sử dụng chương trình set-user-ID-root). Tuy nhiên, điều này cũng cấp cho tiến trình các đặc quyền để thực hiện hàng loạt hành động khác — ví dụ, qua mặt tất cả các kiểm tra quyền khi truy cập tệp — từ đó mở đường cho một loạt lỗ hổng bảo mật nếu chương trình hành xử theo những cách bất ngờ (có thể là hậu quả của các tình huống không lường trước được, hoặc do sự can thiệp có chủ ý từ một người dùng độc hại). Cách truyền thống để giải quyết vấn đề này đã được nêu ở Chương [38:](#page-50-0) chúng ta bỏ các đặc quyền hiệu dụng (effective privilege) (nghĩa là thay đổi từ effective user ID là 0, trong khi vẫn duy trì giá trị 0 trong saved set-user-ID) và tạm thời lấy lại chúng chỉ khi cần thiết.

Cơ chế capability của Linux tinh chỉnh việc xử lý vấn đề này. Thay vì sử dụng một đặc quyền duy nhất (nghĩa là effective user ID bằng 0) khi thực hiện kiểm tra bảo mật trong kernel (Kernel Space), đặc quyền siêu người dùng được chia thành các đơn vị riêng biệt, gọi là capability. Mỗi thao tác đặc quyền được liên kết với một capability cụ thể và một tiến trình chỉ có thể thực hiện thao tác đó nếu nó có capability tương ứng (bất kể effective user ID của nó là gì). Nói một cách khác, bất cứ nơi nào trong cuốn sách này chúng ta nói về một tiến trình đặc quyền (privileged process) trên Linux, điều mà chúng ta thực sự muốn nói đến là một tiến trình có capability liên quan để thực hiện thao tác cụ thể đó.

Hầu hết thời gian, cơ chế capability của Linux là vô hình đối với chúng ta. Lý do là khi một ứng dụng không nhận thức được capability giả định một effective user ID bằng 0, kernel sẽ cấp cho tiến trình đó toàn bộ dải capability.

Việc triển khai capability trên Linux dựa trên tiêu chuẩn dự thảo POSIX 1003.1e (http://wt.tuxomania.net/publications/posix.1e/). Nỗ lực chuẩn hóa này đã thất bại vào cuối những năm 1990 trước khi được hoàn thành, nhưng các bản triển khai capability khác nhau vẫn dựa trên bản dự thảo tiêu chuẩn này. (Một số capability được liệt kê trong Bảng 39-1 được định nghĩa trong dự thảo POSIX.1e, nhưng nhiều cái là phần mở rộng của Linux).

> [!NOTE]
> Các cơ chế capability được cung cấp trong một số triển khai UNIX khác, chẳng hạn như trong Solaris 10 của Sun và các bản phát hành Trusted Solaris trước đó, Trusted Irix của SGI, và là một phần của dự án TrustedBSD cho FreeBSD ([Watson, 2000]). Các cơ chế tương tự cũng tồn tại trong một số hệ điều hành khác; ví dụ, cơ chế đặc quyền trong hệ thống VMS của Digital.

## 39.2 Các Linux Capabilities

Bảng 39-1 liệt kê các quyền năng (capabilities) của Linux và cung cấp một hướng dẫn tóm tắt (và chưa đầy đủ) về các thao tác mà chúng áp dụng.

## 39.3 Process và File Capabilities

Mỗi tiến trình (process) có ba tập hợp quyền năng (capability sets) đi kèm — được gọi là permitted (được phép), effective (hiệu lực) và inheritable (có thể kế thừa) — có thể chứa không hoặc nhiều quyền năng được liệt kê trong Bảng 39-1. Tương tự, mỗi file cũng có thể có ba tập hợp quyền năng đi kèm với cùng tên gọi. (Vì những lý do sẽ trở nên rõ ràng sau, tập hợp quyền năng hiệu lực của file thực chất chỉ là một bit đơn lẻ được bật hoặc tắt.) Chúng ta sẽ đi sâu vào chi tiết của từng tập hợp quyền năng này trong các phần tiếp theo.

### 39.3.1 Process Capabilities

Đối với mỗi tiến trình, kernel duy trì ba tập hợp quyền năng (được triển khai dưới dạng mặt nạ bit - bit masks), trong đó không hoặc nhiều quyền năng được chỉ định trong Bảng 39-1 được bật. Ba tập hợp đó như sau:

- Permitted: Đây là các quyền năng mà một tiến trình có thể sử dụng. Tập hợp permitted là một tập siêu hạn chế (limiting superset) đối với các quyền năng có thể được thêm vào tập effective và inheritable. Nếu một tiến trình loại bỏ một quyền năng khỏi tập permitted của mình, nó sẽ không bao giờ có thể lấy lại được quyền năng đó (trừ khi nó thực thi một chương trình mà chương trình đó trao lại quyền năng một lần nữa).
- Effective: Đây là các quyền năng được kernel sử dụng để thực hiện việc kiểm tra quyền hạn (privilege checking) cho tiến trình. Miễn là nó vẫn duy trì một quyền năng trong tập permitted của mình, một tiến trình có thể tạm thời vô hiệu hóa quyền năng đó bằng cách loại bỏ nó khỏi tập effective, và sau đó khôi phục lại quyền năng đó vào tập này sau.
- Inheritable: Đây là các quyền năng có thể được chuyển sang tập permitted khi một chương trình được thực thi (execed) bởi tiến trình này.

Chúng ta có thể xem biểu diễn dạng thập lục phân (hexadecimal) của ba tập hợp quyền năng cho bất kỳ tiến trình nào trong ba trường `CapInh`, `CapPrm` và `CapEff` nằm trong file đặc trưng của Linux `/proc/PID/status`.

> [!NOTE]
> Chương trình `getpcap` (một phần của gói `libcap` được mô tả ở Mục [39.7](#page-74-0)) có thể được sử dụng để hiển thị các quyền năng của một tiến trình theo định dạng dễ đọc hơn.

Một tiến trình con được tạo ra thông qua hàm `fork()` sẽ kế thừa các bản sao từ các tập hợp quyền năng của tiến trình cha. Chúng ta mô tả việc xử lý các tập hợp quyền năng trong suốt quá trình `exec()` tại Mục [39.5](#page-72-0).

> [!NOTE]
> Trên thực tế, các quyền năng là một thuộc tính trên mỗi luồng (per-thread attribute) có thể được điều chỉnh độc lập cho từng luồng trong một tiến trình. Các quyền năng của một luồng cụ thể trong một tiến trình đa luồng (multithreaded process) được hiển thị trong file `/proc/PID/task/TID/status`. File `/proc/PID/status` hiển thị các quyền năng của luồng chính (main thread).

> [!NOTE]
> Trước phiên bản kernel 2.6.25, Linux biểu diễn các tập hợp quyền năng bằng 32 bit. Việc bổ sung thêm các quyền năng trong kernel 2.6.25 đòi hỏi phải chuyển sang sử dụng các tập hợp 64 bit.

### 39.3.2 Khả năng của Tệp (File Capabilities)

Nếu một tệp có đính kèm các tập hợp khả năng (capability sets), thì các tập hợp này được sử dụng để xác định các quyền năng (capabilities) được cấp cho một Process (tiến trình) khi nó thực thi (`exec()`) tệp đó. Có ba tập hợp khả năng của tệp:

- Permitted (Được phép): Đây là tập hợp các khả năng có thể được thêm vào tập permitted của tiến trình trong quá trình thực hiện `exec()`, bất kể các khả năng hiện có của tiến trình đó là gì.
- Effective (Hiệu lực): Đây chỉ là một bit đơn lẻ. Nếu bit này được bật, thì trong quá trình `exec()`, các khả năng được bật trong tập permitted mới của tiến trình cũng sẽ được bật trong tập effective mới của tiến trình. Nếu bit effective của tệp bị tắt, thì sau khi `exec()`, tập effective mới của tiến trình ban đầu sẽ trống.
- Inheritable (Có thể kế thừa): Tập hợp này được lọc (mask) với tập inheritable của tiến trình để xác định tập hợp các khả năng sẽ được bật trong tập permitted của tiến trình sau một lệnh `exec()`.

Mục 39.5 cung cấp các chi tiết về cách các khả năng của tệp được sử dụng trong quá trình `exec()`.

Các khả năng permitted và inheritable của tệp trước đây được gọi là forced (bắt buộc) và allowed (cho phép). Các thuật ngữ đó hiện đã lỗi thời, nhưng chúng vẫn mang tính mô tả trực quan. Các khả năng permitted của tệp là những quyền năng bị ép buộc đưa vào tập permitted của tiến trình trong quá trình `exec()`, bất kể các khả năng hiện tại của tiến trình đó là gì. Các khả năng inheritable của tệp là những quyền năng mà tệp cho phép được đưa vào tập permitted của tiến trình trong quá trình `exec()`, miễn là các khả năng đó cũng được bật trong tập khả năng inheritable của tiến trình.

Các khả năng liên quan đến một tệp được lưu trữ trong một thuộc tính mở rộng bảo mật (security extended attribute) (Mục 16.1) có tên là `security.capability`. Cần phải có quyền `CAP_SETFCAP` để cập nhật thuộc tính mở rộng này.

**Bảng 39-1:** Các thao tác được cho phép bởi mỗi Linux capability

| Capability           | Cho phép tiến trình thực hiện                                                                                                                                                                                                                                                                                                                                                                                                 |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CAP_AUDIT_CONTROL    | (Từ Linux 2.6.11) Bật và tắt ghi nhật ký kiểm toán kernel (kernel audit logging); thay đổi quy tắc<br>lọc cho việc kiểm toán; truy xuất trạng thái kiểm toán và các quy tắc lọc                                                                                                                                                                                                                                  |
| CAP_AUDIT_WRITE      | (Từ Linux 2.6.11) Ghi các bản ghi vào nhật ký kiểm toán của kernel                                                                                                                                                                                                                                                                                                                                                      |
| CAP_CHOWN            | Thay đổi ID người dùng (chủ sở hữu) của tệp hoặc thay đổi ID nhóm của tệp thành một nhóm mà<br>tiến trình không phải là thành viên (`chown()`)                                                                                                                                                                                                                                                                    |
| CAP_DAC_OVERRIDE     | Bỏ qua các kiểm tra quyền đọc, ghi và thực thi tệp (DAC là viết tắt của<br>kiểm soát truy cập tùy ý - discretionary access control); đọc nội dung của các liên kết tượng trưng (symbolic links) cwd, exe và root trong `/proc/PID`                                                                                                                                                                                             |
| CAP_DAC_READ_SEARCH  | Bỏ qua các kiểm tra quyền đọc tệp và kiểm tra quyền đọc và thực thi (tìm kiếm) thư mục                                                                                                                                                                                                                                                                                                                    |
| CAP_FOWNER           | Nhìn chung bỏ qua việc kiểm tra quyền đối với các thao tác thông thường yêu cầu ID người dùng hệ thống tệp<br>của tiến trình phải khớp với ID người dùng của tệp (`chmod()`, `utime()`); đặt cờ i-node trên các tệp tùy ý; đặt và sửa đổi ACL trên các tệp tùy ý; bỏ qua<br>hiệu ứng của bit sticky thư mục khi xóa tệp (`unlink()`, `rmdir()`, `rename()`);<br>chỉ định cờ `O_NOATIME` cho các tệp tùy ý trong `open()` và `fcntl(F_SETFL)` |

| CAP_FSETID           | Sửa đổi một file mà kernel không tự động tắt các bit set-user-ID và set-group-ID (`write()`, `truncate()`); cho phép bật bit set-group-ID cho một file mà ID nhóm của nó không khớp với ID nhóm hệ thống file (file-system group ID) hoặc các ID nhóm bổ sung (supplementary group IDs) của tiến trình (`Process`) (`chmod()`) |
| CAP_IPC_LOCK         | Bỏ qua các hạn chế khóa bộ nhớ (memory-locking) (`mlock()`, `mlockall()`, `shmctl(SHM_LOCK)`, `shmctl(SHM_UNLOCK)`); sử dụng cờ `SHM_HUGETLB` của `shmget()` và cờ `MAP_HUGETLB` của `mmap()`. |
| CAP_IPC_OWNER        | Bỏ qua các kiểm tra quyền (permission checks) đối với các thao tác trên các đối tượng System V IPC |
| CAP_KILL             | Bỏ qua các kiểm tra quyền đối với việc gửi tín hiệu (`Signal`) (`kill()`, `sigqueue()`) |
| CAP_LEASE            | (Kể từ Linux 2.4) Thiết lập các lease (cho thuê file) trên các file bất kỳ (`fcntl(F_SETLEASE)`) |
| CAP_LINUX_IMMUTABLE  | Thiết lập các cờ i-node append (chỉ cho phép nối thêm) và immutable (bất biến) |
| CAP_MAC_ADMIN        | (Kể từ Linux 2.6.25) Cấu hình hoặc thực hiện thay đổi trạng thái đối với kiểm soát truy cập bắt buộc (Mandatory Access Control - MAC) (được thực thi bởi một số Linux security modules) |
| CAP_MAC_OVERRIDE     | (Kể từ Linux 2.6.25) Ghi đè MAC (được thực thi bởi một số Linux security modules) |
| CAP_MKNOD            | (Kể từ Linux 2.4) Sử dụng `mknod()` để tạo các thiết bị (`Device`) |
| CAP_NET_ADMIN        | Thực hiện các thao tác liên quan đến mạng khác nhau (ví dụ: thiết lập các tùy chọn socket có đặc quyền (`privileged socket options`), bật multicast, cấu hình các giao diện mạng, và sửa đổi bảng định tuyến (`routing tables`)) |
| CAP_NET_BIND_SERVICE | Bind (gắn kết) với các cổng socket có đặc quyền (privileged socket ports) |
| CAP_NET_BROADCAST    | (Không sử dụng) Thực hiện phát sóng socket (`socket broadcasts`) và lắng nghe multicast |

| CAP_NET_RAW          | Sử dụng raw socket và packet socket                                                                                                                                                                                                                                                                                                                                                                             |
| CAP_SETGID           | Thực hiện các thay đổi tùy ý đối với ID nhóm tiến trình (process group ID) (`setgid()`, `setegid()`, `setregid()`,<br>`setresgid()`, `setfsgid()`, `setgroups()`, `initgroups()`); giả mạo ID nhóm khi truyền<br>thông tin xác thực (credential) qua UNIX domain socket (`SCM_CREDENTIALS`)                                                                                                                                                                                          |
| CAP_SETFCAP          | (Từ Linux 2.6.24) Thiết lập capability cho tệp (file capability)                                                                                                                                                                                                                                                                                                                                                                   |

**Bảng 39-1:** Các thao tác được cho phép bởi mỗi Linux capability (tiếp theo)

| Capability         | Cho phép tiến trình thực hiện                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CAP_SETPCAP        | Nếu file capability không được hỗ trợ, cấp phát và loại bỏ capability trong tập permitted của tiến trình tới hoặc từ bất kỳ tiến trình nào khác (bao gồm cả chính nó); nếu file capability được hỗ trợ, thêm bất kỳ capability nào trong tập capability bounding set của tiến trình vào tập inheritable của nó, loại bỏ capability khỏi bounding set, và thay đổi các cờ `securebits` |
| CAP_SETUID         | Thực hiện các thay đổi tùy ý đối với ID người dùng tiến trình (process user ID) (`setuid()`, `seteuid()`, `setreuid()`,<br>`setresuid()`, `setfsuid()`); giả mạo ID người dùng khi truyền thông tin xác thực qua UNIX domain<br>socket (`SCM_CREDENTIALS`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

| CAP_SYS_ADMIN      | Vượt quá giới hạn `/proc/sys/fs/file-max` trong các System Call (lời gọi hệ thống) mở file (ví dụ: `open()`, `shm_open()`, `pipe()`, `socket()`, `accept()`, `exec()`, `acct()`, `epoll_create()`); thực hiện các thao tác quản trị hệ thống khác nhau, bao gồm `quotactl()` (kiểm soát quota ổ đĩa), `mount()` và `umount()`, `swapon()` và `swapoff()`, `pivot_root()`, `sethostname()` và `setdomainname()`; thực hiện các thao tác `syslog(2)` khác nhau; ghi đè giới hạn tài nguyên `RLIMIT_NPROC` (`fork()`); gọi `lookup_dcookie()`; thiết lập các thuộc tính mở rộng tin cậy và bảo mật (trusted và security extended attributes); thực hiện các thao tác `IPC_SET` và `IPC_RMID` trên các đối tượng System V IPC bất kỳ; giả mạo ID Process (process ID) khi truyền thông tin xác thực qua UNIX domain socket (`SCM_CREDENTIALS`); sử dụng `ioprio_set()` để chỉ định lớp lập lịch (scheduling class) `IOPRIO_CLASS_RT`; sử dụng `TIOCCONS ioctl()`; sử dụng cờ `CLONE_NEWNS` với `clone()` và `unshare()`; thực hiện các thao tác `KEYCTL_CHOWN` và `KEYCTL_SETPERM` của `keyctl()`; quản trị thiết bị `random(4)`; các thao tác đặc thù trên thiết bị khác nhau |
| CAP_SYS_BOOT       | Sử dụng `reboot()` để khởi động lại hệ thống; gọi `kexec_load()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CAP_SYS_CHROOT     | Sử dụng `chroot()` để thiết lập thư mục gốc của Process (process root directory)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CAP_SYS_MODULE     | Tải và gỡ tải các Kernel Module (mô-đun nhân) (`init_module()`, `delete_module()`, `create_module()`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CAP_SYS_NICE       | Tăng giá trị nice (`nice()`, `setpriority()`); thay đổi giá trị nice cho các Process bất kỳ (`setpriority()`); thiết lập các chính sách lập lịch thời gian thực (realtime scheduling policies) `SCHED_RR` và `SCHED_FIFO` cho Process gọi; đặt lại cờ `SCHED_RESET_ON_FORK`; thiết lập các chính sách lập lịch và độ ưu tiên cho các Process bất kỳ (`sched_setscheduler()`, `sched_setparam()`); thiết lập lớp lập lịch I/O và độ ưu tiên cho các Process bất kỳ (`ioprio_set()`); thiết lập độ gắn kết CPU (CPU affinity) cho các Process bất kỳ (`sched_setaffinity()`); sử dụng `migrate_pages()` để di chuyển các Process bất kỳ và cho phép các Process được di chuyển đến các Node bất kỳ; áp dụng `move_pages()` cho các Process bất kỳ; sử dụng cờ `MPOL_MF_MOVE_ALL` với `mbind()` và `move_pages()` |

| CAP_SYS_PACCT      | Sử dụng `acct()` để bật hoặc tắt tính năng hạch toán tiến trình (process accounting).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CAP_SYS_PTRACE     | Theo dõi (trace) các tiến trình tùy ý sử dụng `ptrace()`; truy cập `/proc/PID/environ` cho<br>các tiến trình tùy ý; áp dụng `get_robust_list()` cho các tiến trình tùy ý.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CAP_SYS_RAWIO      | Thực hiện các thao tác trên cổng I/O (I/O port) sử dụng `iopl()` và `ioperm()`; truy cập `/proc/kcore`;<br>mở `/dev/mem` và `/dev/kmem`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CAP_SYS_RESOURCE   | Sử dụng dung lượng vùng nhớ dự trữ trên hệ thống tập tin (file system); thực hiện các lời gọi `ioctl()` để điều khiển<br>nhật ký (journal) của ext3; vượt qua các giới hạn hạn ngạch đĩa (disk quota); tăng giới hạn tài nguyên cứng (hard resource limit) (`setrlimit()`);<br>vượt qua giới hạn tài nguyên `RLIMIT_NPROC` (`fork()`); nâng giới hạn `msg_qbytes` cho hàng đợi thông điệp System V (System V message queue) vượt quá giới hạn trong `/proc/sys/kernel/msgmnb`; bỏ qua các giới hạn hàng đợi thông điệp POSIX (POSIX message queue) khác nhau được định nghĩa bởi các tệp dưới `/proc/sys/fs/mqueue`. |
| CAP_SYS_TIME       | Sửa đổi đồng hồ hệ thống (`settimeofday()`, `stime()`, `adjtime()`, `adjtimex()`); đặt đồng hồ<br>phần cứng (hardware clock).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

| CAP_SYS_TTY_CONFIG | Thực hiện ngắt kết nối ảo (virtual hangup) của terminal hoặc pseudoterminal sử dụng hàm vhangup() |

### 39.3.3 Mục đích của Tập Capability Được phép (Permitted) và Tập Capability Hiệu lực (Effective) của Tiến trình

Tập capability được phép của tiến trình (process permitted capability set) xác định các capability mà một tiến trình có thể sử dụng. Tập capability hiệu lực của tiến trình (process effective capability set) xác định các capability hiện đang có hiệu lực đối với tiến trình đó — nghĩa là tập hợp các capability mà kernel sử dụng khi kiểm tra xem tiến trình có đặc quyền (privilege) cần thiết để thực hiện một thao tác cụ thể hay không.

Tập capability được phép áp đặt một giới hạn trên (upper bound) đối với tập capability hiệu lực. Một tiến trình chỉ có thể bật (raise) một capability trong tập hiệu lực nếu capability đó nằm trong tập được phép. (Các thuật ngữ "thêm vào" [add to] và "đặt" [set] đôi khi được sử dụng đồng nghĩa với "bật" [raise]. Thao tác ngược lại là "bỏ" [drop], hoặc đồng nghĩa là "gỡ bỏ" [remove] hoặc "xóa" [clear].)

> [!NOTE]
> Mối quan hệ giữa tập quyền hiệu lực và tập quyền hợp pháp tương tự như mối quan hệ giữa ID người dùng hiệu lực (effective user ID) và ID người dùng đã lưu (saved set-user-ID) đối với một chương trình set-user-ID-root. Việc loại bỏ một quyền khỏi tập hiệu lực tương tự như việc tạm thời bỏ ID người dùng hiệu lực là 0, trong khi vẫn duy trì giá trị 0 ở ID người dùng đã lưu. Việc loại bỏ một quyền khỏi cả tập hiệu lực lẫn tập hợp pháp tương tự như việc vĩnh viễn từ bỏ đặc quyền siêu người dùng (superuser privileges) bằng cách đặt cả ID người dùng hiệu lực và ID người dùng đã lưu thành các giá trị khác 0.

### 39.3.4 Mục đích của Tập quyền Hợp pháp (Permitted) và Tập quyền Hiệu lực (Effective) của Tệp

Tập quyền hợp pháp của tệp (file permitted capability set) cung cấp một cơ chế giúp tệp thực thi (executable file) có thể cấp quyền cho một tiến trình. Nó chỉ định một nhóm các quyền sẽ được gán cho tập quyền hợp pháp của tiến trình trong quá trình thực thi hàm `exec()`.

Tập quyền hiệu lực của tệp (file effective capability set) là một cờ đơn (bit) có thể được bật hoặc tắt. Để hiểu tại sao tập này chỉ bao gồm một bit duy nhất, chúng ta cần xem xét hai trường hợp xảy ra khi một chương trình được thực thi qua `exec()`:

- Chương trình có thể là dạng không nhận biết quyền (capability-dumb), nghĩa là nó không biết gì về quyền (tức là nó được thiết kế như một chương trình set-user-ID-root truyền thống). Một chương trình như vậy sẽ không biết rằng nó cần phải bật các quyền trong tập hiệu lực của mình để có thể thực hiện các thao tác đặc quyền. Đối với các chương trình như vậy, hàm `exec()` sẽ mang lại hiệu quả là tất cả các quyền hợp pháp mới của tiến trình sẽ tự động được gán vào tập hiệu lực của nó. Kết quả này đạt được bằng cách bật bit hiệu lực của tệp (file effective bit).
- Chương trình có thể là dạng nhận biết quyền (capability-aware), nghĩa là nó được thiết kế với mô hình quản lý quyền (capabilities framework) trong tâm trí, và nó sẽ thực hiện các system call phù hợp (sẽ được thảo luận sau) để bật và bỏ các quyền trong tập hiệu lực của mình. Đối với các chương trình như vậy, các cân nhắc về nguyên tắc đặc quyền tối thiểu (least-privilege) có nghĩa là, sau một lệnh `exec()`, tất cả các quyền ban đầu phải được vô hiệu hóa trong tập quyền hiệu lực của tiến trình. Kết quả này đạt được bằng cách tắt bit quyền hiệu lực của tệp.

### 39.3.5 Mục đích của các tập hợp kế thừa (Inheritable Sets) của Tiến trình và Tệp

Ban đầu, việc sử dụng các tập hợp được phép (permitted sets) và tập hợp có hiệu lực (effective sets) cho tiến trình (process) và tệp (file) có vẻ đã là một khuôn khổ đầy đủ cho hệ thống phân quyền capabilities. Tuy nhiên, có một số tình huống mà chúng vẫn chưa đủ đáp ứng. Ví dụ, điều gì sẽ xảy ra nếu một tiến trình thực thi lệnh `exec()` muốn bảo lưu một số quyền (capabilities) hiện tại của nó qua lời gọi `exec()`? Có vẻ như việc triển khai capabilities có thể cung cấp tính năng này đơn giản bằng cách bảo lưu các capabilities được phép của tiến trình qua `exec()`. Tuy nhiên, cách tiếp cận này sẽ không xử lý được các trường hợp sau:

- Việc thực thi `exec()` có thể yêu cầu một số đặc quyền nhất định (ví dụ: `CAP_DAC_OVERRIDE`) mà chúng ta không muốn giữ lại sau khi `exec()`.
- Giả sử rằng chúng ta đã chủ động loại bỏ một số capabilities được phép mà chúng ta không muốn giữ lại qua `exec()`, nhưng sau đó `exec()` lại thất bại. Trong trường hợp này, chương trình có thể cần một số capabilities được phép mà nó đã (vĩnh viễn) loại bỏ trước đó.

Vì những lý do này, các capabilities được phép của tiến trình không được bảo lưu qua `exec()`. Thay vào đó, một tập hợp capability khác được giới thiệu: tập hợp kế thừa (inheritable set). Tập hợp inheritable cung cấp một cơ chế giúp tiến trình có thể giữ lại một số capabilities của mình qua một lời gọi `exec()`.

Tập hợp capability kế thừa của tiến trình chỉ định một nhóm các capabilities có thể được gán vào tập hợp capability được phép của tiến trình trong quá trình `exec()`. Tập hợp kế thừa của tệp tương ứng sẽ được lọc (phép toán AND) với tập hợp capability kế thừa của tiến trình để xác định những capabilities nào thực sự được thêm vào tập hợp capability được phép của tiến trình trong quá trình `exec()`.

> [!NOTE]
> Có một lý do sâu xa hơn về mặt triết lý đằng sau việc không đơn giản bảo lưu tập hợp capability được phép của tiến trình qua `exec()`. Ý tưởng cốt lõi của hệ thống capabilities là tất cả các đặc quyền cấp cho một tiến trình đều được cấp phát hoặc kiểm soát bởi tệp mà tiến trình đó thực thi (`exec`). Mặc dù tập hợp inheritable của tiến trình chỉ định các capabilities được chuyển qua `exec()`, nhưng các capabilities này vẫn bị lọc (mask) bởi tập hợp inheritable của tệp.

### 39.3.6 Gán và Xem Capabilities của Tệp từ Shell

Các lệnh `setcap(8)` và `getcap(8)`, nằm trong gói `libcap` được mô tả tại Mục [39.7](#page-74-0), có thể được sử dụng để thao tác với các tập hợp capability của tệp. Chúng ta minh họa việc sử dụng các lệnh này bằng một ví dụ ngắn gọn sử dụng chương trình chuẩn `date(1)`. (Chương trình này là một ví dụ về một ứng dụng "mù capability" - capability-dumb application theo định nghĩa tại Mục [39.3.4](#page-69-0).) Khi chạy với đặc quyền, `date(1)` có thể được dùng để thay đổi thời gian hệ thống. Chương trình `date` không phải là tệp set-user-ID-root, vì vậy thông thường cách duy nhất để chạy nó với đặc quyền là trở thành siêu người dùng (superuser).

Chúng ta bắt đầu bằng cách hiển thị thời gian hiện tại của hệ thống, sau đó thử thay đổi thời gian với tư cách là một người dùng không có đặc quyền (unprivileged user):

```
$ date
Tue Dec 28 15:54:08 CET 2010
$ date -s '2018-02-01 21:39'
date: cannot set date: Operation not permitted
Thu Feb 1 21:39:00 CET 2018
```

Ở trên, chúng ta thấy rằng lệnh `date` đã không thể thay đổi thời gian hệ thống, nhưng nó vẫn hiển thị đối số (argument) theo định dạng chuẩn.

Tiếp theo, chúng ta chuyển sang quyền siêu người dùng (superuser), cho phép chúng ta thay đổi thời gian hệ thống thành công:

```
$ sudo date -s '2018-02-01 21:39'
root's password:
Thu Feb 1 21:39:00 CET 2018
$ date
Thu Feb 1 21:39:02 CET 2018
```

Bây giờ chúng ta tạo một bản sao của chương trình `date` và gán cho nó capability cần thiết:

```
$ whereis -b date Find location of date binary
date: /bin/date
$ cp /bin/date .
$ sudo setcap "cap_sys_time=pe" date
root's password:
$ getcap date
date = cap_sys_time+ep
```

Lệnh `setcap` được hiển thị ở trên gán capability `CAP_SYS_TIME` vào hai tập hợp capability được phép (`p` - permitted) và có hiệu lực (`e` - effective) của tệp thực thi. Sau đó, chúng ta sử dụng lệnh `getcap` để xác minh các capabilities đã được gán cho tệp. (Cú pháp được sử dụng bởi `setcap` và `getcap` để biểu diễn các tập hợp capability được mô tả trong trang hướng dẫn sử dụng `cap_from_text(3)` đi kèm trong gói `libcap`.)

Các file capabilities của bản sao chương trình `date` cho phép chương trình này được sử dụng bởi những người dùng không có đặc quyền để thiết lập lại thời gian hệ thống:

```
$ ./date -s '2010-12-28 15:55'
Tue Dec 28 15:55:00 CET 2010
$ date
Tue Dec 28 15:55:02 CET 2010
```

## 39.4 Việc Triển Khai Các Tính Năng Hiện Đại (Modern Capabilities Implementation)

Một việc triển khai đầy đủ các capability (tính năng/đặc quyền) yêu cầu những điểm sau:

- Đối với mỗi thao tác có đặc quyền (privileged operation), kernel (nhân) nên kiểm tra xem process ( tiến trình) có capability liên quan hay không, thay vì kiểm tra xem effective (hoặc file system) user ID có bằng 0 hay không.
- Kernel phải cung cấp các system call (lời gọi hệ thống) cho phép truy xuất và sửa đổi các capability của một process.
- Kernel phải hỗ trợ khái niệm gắn các capability vào một tệp thực thi (executable file), sao cho process nhận được các capability tương ứng khi tệp đó được thực thi thông qua `exec()`. Điều này tương tự như bit set-user-ID, nhưng cho phép chỉ định độc lập tất cả các capability trên tệp thực thi. Ngoài ra, hệ thống phải cung cấp một tập hợp các giao diện lập trình (programming interface) và câu lệnh để thiết lập và xem các capability được gắn vào một tệp thực thi.

Cho đến phiên bản kernel 2.6.23 (bao gồm cả phiên bản này), Linux mới chỉ đáp ứng hai yêu cầu đầu tiên. Kể từ kernel 2.6.24, việc gắn các capability vào một tệp đã khả thi. Nhiều tính năng khác đã được thêm vào trong các kernel 2.6.25 và 2.6.26 nhằm hoàn thiện việc triển khai capability.

Trong phần lớn các thảo luận về capability, chúng ta sẽ tập trung vào việc triển khai hiện đại. Ở Mục [39.10](#page-81-0), chúng ta sẽ xem xét việc triển khai khác biệt như thế nào trước khi file capability được giới thiệu. Hơn nữa, file capability là một thành phần kernel tùy chọn trong các kernel hiện đại, nhưng đối với phần chính của nội dung thảo luận, chúng ta sẽ giả định rằng thành phần này được bật. Sau đây, chúng ta sẽ mô tả các điểm khác biệt xảy ra nếu file capability không được bật. (Ở một số khía cạnh, hành vi này tương tự như của Linux trong các phiên bản kernel trước 2.6.24, nơi file capability chưa được triển khai.)

Trong các phần tiếp theo, chúng ta sẽ đi sâu hơn vào chi tiết về việc triển khai capability trên Linux.

## 39.5 Sự Biến Đổi Các Capability Của Process Trong suôt `exec()`

Trong quá trình thực thi `exec()`, kernel thiết lập các capability mới cho process dựa trên các capability hiện tại của process và các tập hợp capability (capability sets) của tệp đang được thực thi. Kernel tính toán các capability mới của process bằng cách sử dụng các quy tắc sau:

```
P'(permitted) = (P(inheritable) & F(inheritable)) | (F(permitted) & cap_bset)
P'(effective) = F(effective) ? P'(permitted) : 0
P'(inheritable) = P(inheritable)
```

Trong các quy tắc trên, P ký hiệu giá trị của một tập hợp capability trước `exec()`, P' ký hiệu giá trị của một tập hợp capability sau `exec()`, và F ký hiệu một tập hợp capability của tệp (file capability set). Định danh `cap_bset` ký hiệu giá trị của tập hợp giới hạn capability (capability bounding set). Lưu ý rằng `exec()` giữ nguyên tập hợp capability inheritable (có thể thừa kế) của process mà không thay đổi.

### 39.5.1 Tập giới hạn Capability (Capability Bounding Set)

Tập giới hạn capability (capability bounding set) là một cơ chế bảo mật được sử dụng để giới hạn các capability mà một tiến trình (process) có thể đạt được trong quá trình thực thi hàm `exec()`. Tập này được sử dụng như sau:

- Trong quá trình `exec()`, tập giới hạn capability được thực hiện phép toán AND với tập capability cho phép của tệp (file permitted capabilities) nhằm xác định các capability cho phép sẽ được cấp cho chương trình mới. Nói cách khác, tập capability cho phép của một tệp thực thi không thể cấp capability cho một tiến trình nếu capability đó không nằm trong tập giới hạn (bounding set).
- Tập giới hạn capability đóng vai trò là một tập siêu tập giới hạn (limiting superset) cho các capability có thể được thêm vào tập kế thừa (inheritable set) của tiến trình. Điều này có nghĩa là, trừ khi capability nằm trong tập giới hạn, một tiến trình không thể thêm một capability cho phép của mình vào tập kế thừa và sau đó — thông qua quy tắc biến đổi capability đầu tiên được mô tả ở trên — giữ lại capability đó trong tập cho phép của nó khi nó thực thi một tệp có chứa capability đó trong tập kế thừa của tệp.

Tập giới hạn capability là một thuộc tính trên mỗi tiến trình (per-process attribute) được kế thừa bởi tiến trình con (child process) được tạo ra thông qua `fork()` và được bảo toàn qua lệnh `exec()`. Trên một kernel hỗ trợ các file capability, tiến trình `init` (tổ tiên của tất cả các tiến trình) khởi tạo với một tập giới hạn capability chứa tất cả các capability.

Nếu một tiến trình có capability `CAP_SETPCAP`, nó có thể (vĩnh viễn không thể hoàn tác) loại bỏ các capability khỏi tập giới hạn của mình bằng cách sử dụng thao tác `prctl()` với `PR_CAPBSET_DROP`. (Việc loại bỏ một capability khỏi tập giới hạn không ảnh hưởng đến các tập capability cho phép, hiệu lực và kế thừa của tiến trình). Một tiến trình có thể xác định xem một capability có nằm trong tập giới hạn của nó hay không bằng cách sử dụng thao tác `prctl()` với `PR_CAPBSET_READ`.

> [!NOTE]
> Chính xác hơn, tập giới hạn capability là một thuộc tính trên mỗi luồng (per-thread attribute). Bắt đầu từ Linux 2.6.26, thuộc tính này được hiển thị dưới dạng trường `CapBnd` trong tệp đặc thù của Linux `/proc/PID/task/TID/status`. Tệp `/proc/PID/status` hiển thị tập giới hạn của luồng chính (main thread) trong tiến trình.

### 39.5.2 Bảo toàn ngữ nghĩa của root (root Semantics)

Để duy trì ngữ nghĩa truyền thống đối với người dùng `root` (tức là `root` có mọi đặc quyền) khi thực thi một tệp, bất kỳ tập capability nào liên quan đến tệp đó đều bị bỏ qua. Thay vào đó, nhằm phục vụ cho thuật toán được trình bày tại Mục [39.5,](#page-72-0) các tập capability của tệp được định nghĩa mang tính khái niệm như sau trong quá trình `exec()`:

- Nếu một chương trình set-user-ID-root đang được thực thi, hoặc nếu real UID (ID người dùng thực) hoặc effective UID (ID người dùng hiệu lực) của tiến trình gọi `exec()` là 0, thì các tập kế thừa và cho phép của tệp được định nghĩa là bật toàn bộ (all ones).
- Nếu một chương trình set-user-ID-root đang được thực thi, hoặc effective UID của tiến trình gọi `exec()` là 0, thì bit hiệu lực của tệp (file effective bit) được định nghĩa là được thiết lập.

Giả sử rằng chúng ta đang thực thi một chương trình set-user-ID-root, các định nghĩa khái niệm này về các tập capability của tệp đồng nghĩa với việc quá trình tính toán các tập capability cho phép và hiệu lực mới của tiến trình trong Mục [39.5](#page-72-0) được đơn giản hóa như sau:

```
P'(permitted) = P(inheritable) | cap_bset
P'(effective) = P'(permitted)
```

## 39.6 Ảnh hưởng đến Process Capabilities khi thay đổi User ID

Để duy trì tính tương thích với ý nghĩa truyền thống của các chuyển đổi giữa giá trị user ID bằng 0 và khác 0, kernel thực hiện các thao tác sau khi thay đổi user ID của tiến trình (process user IDs) (sử dụng `setuid()`, v.v.):

- 1. Nếu real user ID, effective user ID hoặc saved set-user-ID trước đó có giá trị là 0 và, do kết quả của việc thay đổi các user ID, cả ba ID này đều có giá trị khác 0, thì tập capability được phép (`permitted capability set`) và tập capability hiệu dụng (`effective capability set`) sẽ bị xóa (tức là tất cả các capability sẽ bị thu hồi vĩnh viễn).
- 2. Nếu effective user ID được thay đổi từ 0 sang một giá trị khác 0, thì tập capability hiệu dụng sẽ bị xóa (tức là các effective capability bị thu hồi, nhưng những capability trong tập permitted có thể được bật lại).
- 3. Nếu effective user ID được thay đổi từ một giá trị khác 0 thành 0, thì tập capability được phép sẽ được sao chép vào tập capability hiệu dụng (tức là tất cả các permitted capability trở thành effective).

4. Nếu file-system user ID được thay đổi từ 0 sang một giá trị khác 0, thì các capability liên quan đến tệp sau đây sẽ bị xóa khỏi tập capability hiệu dụng: `CAP_CHOWN`, `CAP_DAC_OVERRIDE`, `CAP_DAC_READ_SEARCH`, `CAP_FOWNER`, `CAP_FSETID`, `CAP_LINUX_IMMUTABLE` (từ Linux 2.6.30 trở đi), `CAP_MAC_OVERRIDE`, và `CAP_MKNOD` (từ Linux 2.6.30 trở đi). Ngược lại, nếu file-system user ID được thay đổi từ một giá trị khác 0 thành 0, thì bất kỳ capability nào trong số này được bật trong tập permitted sẽ được bật trong tập effective. Các thao tác này được thực hiện nhằm duy trì ngữ nghĩa truyền thống đối với việc thao tác trên file-system user ID đặc thù của Linux.

## 39.7 Thay đổi Process Capabilities bằng Lập trình

Một tiến trình (process) có thể bật (raise) hoặc hủy (drop) các capability khỏi các tập capability của nó bằng cách sử dụng System Call `capset()` hoặc, tốt hơn là sử dụng thư viện `libcap` API mà chúng tôi mô tả bên dưới. Các thay đổi đối với process capabilities phải tuân theo các quy tắc sau:

- 1. Nếu tiến trình không có capability `CAP_SETPCAP` trong tập effective của nó, thì tập inheritable mới phải là một tập con (subset) của sự kết hợp giữa các tập inheritable và permitted hiện có.
- 2. Tập inheritable mới phải là một tập con của sự kết hợp giữa tập inheritable hiện có và tập giới hạn capability (`capability bounding set`).
- 3. Tập permitted mới phải là một tập con của tập permitted hiện có. Nói cách khác, một tiến trình không thể tự cấp cho mình các permitted capability mà nó vốn không có. Nói theo một cách khác, một capability đã bị xóa khỏi tập permitted thì không thể lấy lại được nữa.
- 4. Tập effective mới chỉ được phép chứa các capability đồng thời cũng có mặt trong tập permitted mới.

### API libcap

Cho đến thời điểm này, chúng ta có chủ ý không hiển thị nguyên mẫu (prototype) của System Call `capset()`, hoặc System Call tương đương của nó là `capget()`, dùng để truy xuất các tập Capability (Capability sets) của một Process. Lý do là vì việc sử dụng các System Call này nên được tránh. Thay vào đó, các hàm trong thư viện `libcap` nên được sử dụng. Các hàm này cung cấp một giao diện tuân thủ tiêu chuẩn dự thảo POSIX 1003.1e đã rút gọn, cùng với một số phần mở rộng của Linux.

Vì lý do giới hạn không gian, chúng ta sẽ không mô tả chi tiết API `libcap`. Tóm lại, chúng ta lưu ý rằng các chương trình sử dụng các hàm này thường thực hiện các bước sau:

- 1. Sử dụng hàm `cap_get_proc()` để truy xuất một bản sao các tập Capability hiện tại của Process từ Kernel (nhân) và đặt nó vào một cấu trúc (structure) được cấp phát bởi hàm trong User Space (không gian người dùng). (Ngoài ra, chúng ta có thể sử dụng hàm `cap_init()` để tạo một cấu trúc tập Capability trống mới). Trong API `libcap`, kiểu dữ liệu `cap_t` là một con trỏ được sử dụng để tham chiếu đến các cấu trúc như vậy.
- 2. Sử dụng hàm `cap_set_flag()` để cập nhật cấu trúc ở User Space nhằm nâng cao (`CAP_SET`) và hạ thấp (`CAP_CLEAR`) các Capability từ các tập permitted (được phép), effective (hiệu lực), và inheritable (có thể kế thừa) được lưu trữ trong cấu trúc User Space đã truy xuất ở bước trước.
- 3. Sử dụng hàm `cap_set_proc()` để truyền ngược cấu trúc User Space về cho Kernel nhằm thay đổi các Capability của Process.
- 4. Sử dụng hàm `cap_free()` để giải phóng cấu trúc đã được cấp phát bởi API `libcap` ở bước đầu tiên.

Tại thời điểm viết bài, công việc đang được tiến hành trên `libcap-ng`, một API thư viện Capability mới và cải tiến hơn. Chi tiết có thể được tìm thấy tại http://freshmeat.net/projects/libcap-ng.

### Chương trình ví dụ

Trong Liệt kê (Listing) 8-2, ở trang 164, chúng ta đã trình bày một chương trình xác thực tên người dùng (username) cộng với mật khẩu dựa trên cơ sở dữ liệu mật khẩu chuẩn. Chúng ta đã lưu ý rằng chương trình yêu cầu đặc quyền (privilege) để đọc tệp mật khẩu shadow, vốn được bảo vệ để ngăn chặn việc đọc bởi những người dùng khác ngoài root hoặc các thành viên của nhóm shadow. Cách truyền thống để cung cấp cho chương trình này các đặc quyền mà nó yêu cầu là chạy chương trình dưới quyền đăng nhập root hoặc biến nó thành một chương trình set-user-ID-root. Bây giờ chúng ta trình bày một phiên bản đã sửa đổi của chương trình này sử dụng các Capability và API `libcap`.

Để đọc tệp mật khẩu shadow với tư cách là một người dùng thông thường (unprivileged user), chúng ta cần bỏ qua các quyền kiểm tra phân quyền tệp tiêu chuẩn. Quét các Capability được liệt kê trong Bảng 39-1, chúng ta thấy rằng Capability phù hợp là `CAP_DAC_READ_SEARCH`. Phiên bản đã sửa đổi của chương trình xác thực mật khẩu được minh họa trong [Liệt kê 39-1.](#page-75-0) Chương trình này sử dụng API `libcap` để nâng cao `CAP_DAC_READ_SEARCH` trong tập Capability effective của nó ngay trước khi truy cập tệp mật khẩu shadow, và sau đó hạ thấp Capability đó ngay lập tức sau khi truy cập xong. Để một người dùng không có đặc quyền có thể sử dụng chương trình, chúng ta phải thiết lập Capability này trong tập permitted của tệp, như được hiển thị trong phiên shell sau:

```
$ sudo setcap "cap_dac_read_search=p" check_password_caps
root's password:
$ getcap check_password_caps
check_password_caps = cap_dac_read_search+p
$ ./check_password_caps
Username: mtk
Password:
Successfully authenticated: UID=1000
```

**Liệt kê 39-1:** Một chương trình nhận biết Capability thực hiện xác thực người dùng

```
––––––––––––––––––––––––––––––––––––––––––––––––– cap/check_password_caps.c
## define _BSD_SOURCE /* Get getpass() declaration from <unistd.h> */
## define _XOPEN_SOURCE /* Get crypt() declaration from <unistd.h> */
## include <sys/capability.h>
## include <unistd.h>
## include <limits.h>
## include <pwd.h>
## include <shadow.h>
## include "tlpi_hdr.h"
/* Change setting of capability in caller's effective capabilities */
static int
modifyCap(int capability, int setting)
```

```
{
 cap_t caps;
 cap_value_t capList[1];
 /* Retrieve caller's current capabilities */
 caps = cap_get_proc();
 if (caps == NULL)
 return -1;
 /* Change setting of 'capability' in the effective set of 'caps'. The
 third argument, 1, is the number of items in the array 'capList'. */
 capList[0] = capability;
 if (cap_set_flag(caps, CAP_EFFECTIVE, 1, capList, setting) == -1) {
 cap_free(caps);
 return -1;
 }
 /* Push modified capability sets back to kernel, to change
 caller's capabilities */
 if (cap_set_proc(caps) == -1) {
 cap_free(caps);
 return -1;
 }
 /* Free the structure that was allocated by libcap */
 if (cap_free(caps) == -1)
 return -1;
 return 0;
}
static int /* Raise capability in caller's effective set */
raiseCap(int capability)
{
 return modifyCap(capability, CAP_SET);
}
/* An analogous dropCap() (unneeded in this program), could be
 defined as: modifyCap(capability, CAP_CLEAR); */
static int /* Drop all capabilities from all sets */
dropAllCaps(void)
{
 cap_t empty;
 int s;
 empty = cap_init();
 if (empty == NULL)
 return -1;
 s = cap_set_proc(empty);
```

```c
 if (cap_free(empty) == -1)
 return -1;
 return s;
}
int
main(int argc, char *argv[])
{
 char *username, *password, *encrypted, *p;
 struct passwd *pwd;
 struct spwd *spwd;
 Boolean authOk;
 size_t len;
 long lnmax;
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
 username[len - 1] = '\0'; /* Xóa ký tự xuống dòng ở cuối */
 pwd = getpwnam(username);
 if (pwd == NULL)
 fatal("không thể lấy bản ghi mật khẩu");
 /* Chỉ nâng cao CAP_DAC_READ_SEARCH trong thời gian cần thiết */
 if (raiseCap(CAP_DAC_READ_SEARCH) == -1)
 fatal("raiseCap() thất bại");
 spwd = getspnam(username);
 if (spwd == NULL && errno == EACCES)
 fatal("không có quyền đọc tệp mật khẩu shadow");
 /* Tại thời điểm này, chúng ta không cần thêm capability nào nữa,
 nên hãy loại bỏ tất cả capability khỏi mọi tập */
 if (dropAllCaps() == -1)
 fatal("dropAllCaps() thất bại");
 if (spwd != NULL) /* Nếu có bản ghi mật khẩu shadow */
 pwd->pw_passwd = spwd->sp_pwdp; /* Sử dụng mật khẩu shadow */
```

```c
 password = getpass("Password: ");
 /* Mã hóa mật khẩu và xóa ngay lập tức phiên bản dạng văn bản rõ */
 encrypted = crypt(password, pwd->pw_passwd);
 for (p = password; *p != '\0'; )
 *p++ = '\0';
 if (encrypted == NULL)
 errExit("crypt");
 authOk = strcmp(encrypted, pwd->pw_passwd) == 0;
 if (!authOk) {
 printf("Mật khẩu không chính xác\n");
 exit(EXIT_FAILURE);
 }
 printf("Xác thực thành công: UID=%ld\n", (long) pwd->pw_uid);
 /* Bây giờ thực hiện công việc đã được xác thực... */
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––– cap/check_password_caps.c
```

## 39.8 Tạo Môi Trường Chỉ Dùng Capability (Capabilities-Only Environments)

Trong các trang trước, chúng ta đã mô tả các cách khác nhau mà một Process có ID người dùng (user ID) bằng 0 (root) được đối xử đặc biệt liên quan đến các capability:

- Khi một Process có một hoặc nhiều user ID bằng 0 thiết lập tất cả user ID của nó thành các giá trị khác 0, các tập capability được phép (`permitted`) và hiệu lực (`effective`) của nó sẽ bị xóa sạch. (Xem Mục [39.6](#page-73-0))
- Khi một Process có user ID hiệu lực bằng 0 thay đổi user ID đó thành một giá trị khác 0, nó sẽ mất các capability hiệu lực (`effective capabilities`). Khi thực hiện thay đổi ngược lại, tập capability được phép (`permitted`) được sao chép sang tập hiệu lực (`effective set`). Một thủ tục tương tự được tuân theo cho một tập con các capability khi user ID hệ thống tệp (file-system user ID) của Process chuyển đổi giữa 0 và các giá trị khác 0. (Xem Mục [39.6](#page-73-0))
- Nếu một Process có user ID thực (`real user ID`) hoặc hiệu lực là root thực hiện `exec` một chương trình, hoặc bất kỳ Process nào thực hiện `exec` một chương trình set-user-ID-root, thì các tập kế thừa file (`file inheritable`) và được phép (`permitted`) trên lý thuyết được định nghĩa là có tất cả các bit bằng 1. Nếu user ID hiệu lực của Process là 0, hoặc nó đang `exec` một chương trình set-user-ID-root, thì bit hiệu lực của file (`file effective bit`) trên lý thuyết được định nghĩa là 1. (Xem Mục [39.5.2](#page-73-1)) Trong các trường hợp thông thường (tức là cả real user ID và effective user ID đều là root, hoặc một chương trình set-user-ID-root đang được `exec`), điều này có nghĩa là Process nhận được tất cả các capability trong tập permitted và effective của nó.

Trong một hệ thống hoàn toàn dựa trên capability (fully capability-based system), kernel sẽ không cần thực hiện bất kỳ cách xử lý đặc biệt nào đối với root. Sẽ không có các chương trình set-user-ID-root, và file capability sẽ được sử dụng để cấp đúng các capability tối thiểu mà một chương trình yêu cầu.

Vì các ứng dụng hiện có không được thiết kế để tận dụng cơ sở hạ tầng file capability, kernel phải duy trì cách xử lý truyền thống đối với các Process có user ID 0. Mặc dù vậy, chúng ta có thể muốn một ứng dụng chạy trong một môi trường thuần túy dựa trên capability, trong đó root không nhận được bất kỳ sự xử lý đặc biệt nào được mô tả ở trên. Bắt đầu từ kernel 2.6.26, và nếu file capability được bật trong kernel, Linux cung cấp cơ chế `securebits`, cơ chế này kiểm soát một tập hợp các cờ trên mỗi Process (per-process flags) để bật hoặc tắt từng cơ chế xử lý đặc biệt đối với root. (Chính xác hơn, các cờ `securebits` thực ra là một thuộc tính trên mỗi Thread - per-thread attribute.)

Cơ chế `securebits` kiểm soát các cờ được hiển thị trong [Bảng 39-2](#page-79-0). Các cờ tồn tại dưới dạng các cặp liên quan gồm một cờ cơ sở (base flag) và một cờ khóa tương ứng (corresponding locked flag). Mỗi cờ cơ sở kiểm soát một trong các cách xử lý đặc biệt đối với root được mô tả ở trên. Việc thiết lập cờ khóa tương ứng là một thao tác một lần (one-time operation) nhằm ngăn chặn các thay đổi tiếp theo đối với cờ cơ sở liên quan — một khi đã được thiết lập, cờ khóa không thể bị hủy thiết lập.

**Bảng 39-2:** Các cờ securebits

| Cờ (Flag) | Ý nghĩa nếu được thiết lập |
|---|---|
| SECBIT_KEEP_CAPS              | Không tước bỏ các quyền hạn được phép (`permitted capabilities`) khi một tiến trình (`process`) có một hoặc nhiều ID người dùng (user ID) bằng 0 thiết lập tất cả các ID người dùng của nó thành các giá trị khác 0. Cờ này chỉ có tác dụng nếu cờ `SECBIT_NO_SETUID_FIXUP` không được thiết lập đồng thời. Cờ này sẽ bị xóa (`cleared`) khi thực hiện lệnh `exec()`. |
| SECBIT_NO_SETUID_FIXUP        | Không thay đổi các quyền hạn (`capabilities`) khi ID người dùng hiệu dụng (`effective`) hoặc ID người dùng hệ thống tệp (`file-system user ID`) được chuyển đổi giữa giá trị 0 và các giá trị khác 0.                                                                                                                               |
| SECBIT_NOROOT                 | Nếu một tiến trình có ID người dùng thực (`real user ID`) hoặc ID người dùng hiệu dụng (`effective user ID`) bằng 0 thực hiện lệnh `exec()`, hoặc nó thực thi một chương trình set-user-ID-root, thì không cấp quyền hạn cho nó (trừ khi tệp thực thi có các quyền hạn tệp - `file capabilities`).                                                  |
| SECBIT_KEEP_CAPS_LOCKED       | Khóa cờ `SECBIT_KEEP_CAPS`.                                                                                                                                                                                                                   |
| SECBIT_NO_SETUID_FIXUP_LOCKED | Khóa cờ `SECBIT_NO_SETUID_FIXUP`.                                                                                                                                                                                                                 |
| SECBIT_NOROOT_LOCKED          | Khóa cờ `SECBIT_NOROOT`.                                                                                                                                                                                                                          |

Các thiết lập cờ securebits được kế thừa trong tiến trình con (child process) được tạo bởi `fork()`. Tất cả các thiết lập cờ đều được giữ nguyên trong quá trình `exec()`, ngoại trừ `SECBIT_KEEP_CAPS`, cờ này bị xóa vì lý do tương thích lịch sử với thiết lập `PR_SET_KEEPCAPS` được mô tả bên dưới.

Một tiến trình có thể truy xuất các cờ securebits bằng cách sử dụng thao tác `prctl()` với `PR_GET_SECUREBITS`. Nếu một tiến trình có quyền hạn `CAP_SETPCAP`, nó có thể sửa đổi các cờ securebits bằng cách sử dụng thao tác `prctl()` với `PR_SET_SECUREBITS`. Một ứng dụng thuần túy dựa trên quyền hạn (`capability-based application`) có thể vô hiệu hóa vĩnh viễn sự đối xử đặc biệt đối với tài khoản root cho tiến trình gọi (`calling process`) và tất cả các tiến trình con cháu (`descendants`) của nó bằng cách sử dụng lời gọi sau:

```
if (prctl(PR_SET_SECUREBITS,
 /* SECBIT_KEEP_CAPS off */
 SECBIT_NO_SETUID_FIXUP | SECBIT_NO_SETUID_FIXUP_LOCKED |
 SECBIT_NOROOT | SECBIT_NOROOT_LOCKED)
 == -1)
 errExit("prctl");
```

Sau lời gọi này, cách duy nhất để tiến trình này và các tiến trình con cháu của nó có được quyền hạn là thực thi các chương trình có các quyền hạn tệp (`file capabilities`).

### SECBIT\_KEEP\_CAPS và thao tác prctl() PR\_SET\_KEEPCAPS

Cờ SECBIT\_KEEP\_CAPS ngăn không cho các quyền hạn (capabilities) bị hủy bỏ khi một tiến trình (process) có một hoặc nhiều ID người dùng (user ID) mang giá trị 0 thiết lập tất cả các user ID của nó thành các giá trị khác không. Nói một cách đại khái, SECBIT\_KEEP\_CAPS cung cấp một nửa tính năng mà SECBIT\_NO\_SETUID\_FIXUP cung cấp. (Như đã lưu ý trong [Bảng 39-2](#page-79-0), SECBIT\_KEEP\_CAPS chỉ có hiệu lực nếu SECBIT\_NO\_SETUID\_FIXUP chưa được thiết lập.) Cờ này tồn tại nhằm cung cấp một cờ securebits phản ánh thao tác prctl() PR\_SET\_KEEPCAPS cũ hơn, vốn điều khiển cùng một thuộc tính đó. (Điểm khác biệt duy nhất giữa hai cơ chế này là một tiến trình không cần quyền hạn CAP\_SETPCAP để sử dụng thao tác prctl() PR\_SET\_KEEPCAPS.)

> [!NOTE]
> Trước đó, chúng ta đã lưu ý rằng tất cả các cờ securebits đều được giữ lại trong quá trình thực thi hàm exec(), ngoại trừ SECBIT\_KEEP\_CAPS. Việc thiết lập bit SECBIT\_KEEP\_CAPS được làm ngược lại so với các thiết lập securebits khác nhằm duy trì tính nhất quán với cách xử lý thuộc tính do thao tác prctl() PR\_SET\_KEEPCAPS thiết lập.

Thao tác prctl() PR\_SET\_KEEPCAPS được thiết kế để sử dụng bởi các chương trình set-user-ID-root chạy trên các kernel cũ không hỗ trợ file capabilities. Các chương trình như vậy vẫn có thể cải thiện tính bảo mật của chúng bằng cách chủ động hủy bỏ và cấp phát lại các quyền hạn theo yêu cầu (tham khảo Mục [39.10](#page-81-0)).

Tuy nhiên, ngay cả khi một chương trình set-user-ID-root như vậy hủy bỏ tất cả các quyền hạn ngoại trừ những quyền mà nó yêu cầu, nó vẫn duy trì hai đặc quyền (privileges) quan trọng: khả năng truy cập các tệp do root sở hữu và khả năng lấy lại các quyền hạn bằng cách thực thi một chương trình thông qua hàm exec (Mục [39.5.2](#page-73-1)). Cách duy nhất để hủy bỏ vĩnh viễn các đặc quyền này là thiết lập tất cả các user ID của tiến trình thành các giá trị khác không. Nhưng việc đó thông thường dẫn đến việc xóa sạch các tập hợp quyền hạn được phép (permitted capability set) và có hiệu lực (effective capability set) (xem bốn điểm trong Mục [39.6](#page-73-0) liên quan đến ảnh hưởng của việc thay đổi user ID đối với các quyền hạn). Điều này đi ngược lại mục đích vốn là hủy bỏ vĩnh viễn user ID 0, trong khi vẫn duy trì một số quyền hạn. Để cho phép khả năng này, thao tác prctl() PR\_SET\_KEEPCAPS có thể được sử dụng để thiết lập thuộc tính tiến trình nhằm ngăn không cho tập hợp quyền hạn được phép bị xóa khi tất cả các user ID được thay đổi thành giá trị khác không. (Tập hợp quyền hạn có hiệu lực của tiến trình luôn bị xóa trong trường hợp này, bất kể thiết lập của thuộc tính "giữ quyền hạn" - keep capabilities là gì.)

## 39.9 Khám phá các quyền hạn được yêu cầu bởi một chương trình

Giả sử chúng ta có một chương trình không nhận thức về các quyền hạn (capabilities-unaware) và chỉ được cung cấp dưới dạng nhị phân (binary), hoặc chúng ta có một chương trình có mã nguồn quá lớn khiến chúng ta khó có thể đọc để xác định những quyền hạn nào có thể được yêu cầu để chạy nó. Nếu chương trình đó yêu cầu các đặc quyền, nhưng không nên là một chương trình set-user-ID-root, thì làm cách nào chúng ta có thể xác định các quyền hạn được phép gán cho tệp thực thi bằng lệnh setcap(8)? Có hai cách để trả lời câu hỏi này:

Sử dụng strace(1) (Phụ lục A) để xem system call nào thất bại với lỗi EPERM, lỗi được sử dụng để chỉ ra việc thiếu một quyền hạn được yêu cầu. Bằng cách tham khảo trang hướng dẫn (man page) của system call hoặc mã nguồn kernel, chúng ta có thể suy ra quyền hạn nào được yêu cầu. Cách tiếp cận này không phải là hoàn hảo, bởi vì lỗi EPERM đôi khi có thể được sinh ra vì các lý do khác, một số trong đó có thể không liên quan gì đến các yêu cầu về quyền hạn của chương trình. Hơn nữa, các chương trình có thể thực hiện một cách hợp pháp một system call yêu cầu đặc quyền, và sau đó thay đổi hành vi của chúng sau khi xác định rằng chúng không có đặc quyền cho một thao tác cụ thể. Đôi khi rất khó để phân biệt những "dương tính giả" (false positives) này khi cố gắng xác định các quyền hạn mà một tệp thực thi thực sự cần.

Sử dụng một kernel probe để tạo ra đầu ra giám sát khi kernel được yêu cầu thực hiện việc kiểm tra quyền hạn. Một ví dụ về cách thực hiện việc này được cung cấp trong [Hallyn, 2007], một bài viết được viết bởi một trong những nhà phát triển của file capabilities. Đối với mỗi yêu cầu kiểm tra một quyền hạn, probe được hiển thị trong bài viết sẽ ghi lại (log) hàm kernel đã được gọi, quyền hạn đã được yêu cầu, và tên của chương trình đang yêu cầu. Mặc dù cách tiếp cận này đòi hỏi nhiều công sức hơn so với việc sử dụng strace(1), nó cũng có thể giúp chúng ta xác định chính xác hơn các quyền hạn mà một chương trình yêu cầu.

## 39.10 Các Kernel cũ và hệ thống không hỗ trợ File Capabilities

Trong phần này, chúng ta mô tả các khác biệt khác nhau trong việc triển khai các quyền hạn trong các kernel cũ. Chúng ta cũng mô tả các khác biệt xuất hiện trên các kernel nơi file capabilities không được hỗ trợ. Có hai kịch bản mà Linux không hỗ trợ file capabilities:

- Trước Linux 2.6.24, file capabilities chưa được triển khai.
- Kể từ Linux 2.6.24, file capabilities có thể bị vô hiệu hóa nếu kernel được biên dịch (build) mà không có tùy chọn CONFIG\_SECURITY\_FILE\_CAPABILITIES.

Mặc dù Linux đã giới thiệu các capability (đặc quyền) và cho phép gán chúng cho các process ( tiến trình) bắt đầu từ phiên bản kernel 2.2, việc hiện thực hóa file capabilities (đặc quyền tệp) chỉ xuất hiện vài năm sau đó. Lý do khiến file capabilities bị chậm trễ trong việc hiện thực hóa là vấn đề về chính sách (policy) chứ không phải do khó khăn về kỹ thuật. (Các extended attribute - thuộc tính mở rộng, được mô tả trong Chương 16, vốn được dùng để hiện thực hóa file capabilities, đã có sẵn kể từ kernel 2.6). Quan điểm áp đảo của các nhà phát triển kernel (kernel developer) là việc yêu cầu các system administrator (quản trị viên hệ thống) phải thiết lập và giám sát các tập capability khác nhau — mà một số hậu quả của chúng mang tính tinh vi nhưng có tầm ảnh hưởng lớn — cho mỗi chương trình có đặc quyền sẽ tạo ra một nhiệm vụ quản trị phức tạp đến mức không thể quản lý nổi. Ngược lại, các system administrator đã quen thuộc với mô hình đặc quyền UNIX hiện có, biết cách đối xử với các chương trình set-user-ID với sự cẩn trọng thích đáng, và có thể định vị các chương trình set-user-ID và set-group-ID trên hệ thống bằng các lệnh `find` đơn giản. Mتمhư vậy, các nhà phát triển file capabilities đã đưa ra lập luận rằng file capabilities có thể được làm cho khả thi về mặt quản trị, và cuối cùng đã cung cấp đủ các luận điểm thuyết phục để tích hợp file capabilities vào kernel.

### Capability CAP\_SETPCAP

Trên các kernel không hỗ trợ file capabilities (tức là bất kỳ kernel nào trước phiên bản 2.6.24, và các kernel từ phiên bản 2.6.24 trở đi nhưng đã vô hiệu hóa file capabilities), ngữ nghĩa của capability `CAP_SETPCAP` sẽ khác. Tuân theo các quy tắc tương tự như những quy tắc được mô tả trong Mục [39.7,](#page-74-0) một process có capability `CAP_SETPCAP` trong effective set (tập đặc quyền hiệu dụng) của nó về mặt lý thuyết có thể thay đổi các capability của các process khác không phải chính nó. Các thay đổi có thể được thực hiện đối với capability của một process khác, tất cả các thành viên của một process group (nhóm tiến trình) được chỉ định, hoặc tất cả các process trên hệ thống ngoại trừ `init` và chính process gọi. Trường hợp cuối cùng loại trừ `init` vì nó đóng vai trò nền tảng cho hoạt động của hệ thống. Trường hợp này cũng loại trừ process gọi vì process gọi có thể đang cố gắng tước bỏ capability của mọi process khác trên hệ thống, và chúng ta không muốn tước bỏ capability của chính process đang thực hiện lệnh gọi đó.

Tuy nhiên, việc thay đổi capability của các process khác chỉ là một khả năng mang tính lý thuyết. Trên các kernel cũ và trên các kernel hiện đại mà tính năng hỗ trợ file capabilities bị vô hiệu hóa, capability bounding set (tập giới hạn đặc quyền - được thảo luận tiếp theo) luôn che khuất (mask out) capability `CAP_SETPCAP`.

### Capability bounding set (Tập giới hạn đặc quyền)

Kể từ Linux 2.6.25, capability bounding set là một thuộc tính theo từng tiến trình (per-process attribute). Tuy nhiên, trên các kernel cũ hơn, capability bounding set là một thuộc tính toàn hệ thống (system-wide attribute) ảnh hưởng đến tất cả các process trên hệ thống. Capability bounding set toàn hệ thống được khởi tạo sao cho nó luôn che khuất `CAP_SETPCAP` (như đã mô tả ở trên).

> [!NOTE]
> Trên các kernel sau phiên bản 2.6.25, việc loại bỏ các capability khỏi per-process bounding set chỉ được hỗ trợ nếu file capabilities được kích hoạt trong kernel. Trong trường hợp đó, `init`, tiến trình tổ tiên của mọi process, khởi động với một bounding set chứa tất cả các capability, và một bản sao của bounding set đó được kế thừa bởi các process khác được tạo ra trên hệ thống. Nếu file capabilities bị vô hiệu hóa, thì do sự khác biệt về ngữ nghĩa của `CAP_SETPCAP` được mô tả ở trên, `init` khởi động với một bounding set chứa tất cả các capability ngoại trừ `CAP_SETPCAP`.

Có thêm một thay đổi nữa trong ngữ nghĩa của capability bounding set trong Linux 2.6.25. Như đã lưu ý trước đó [\(Mục 39.5.1\)](#page-72-1), trên Linux 2.6.25 trở về sau, per-process capability bounding set đóng vai trò là một tập siêu hạn chế (limiting superset) cho các capability có thể được thêm vào inheritable set (tập đặc quyền kế thừa) của process. Trong Linux 2.6.24 và các phiên bản trước đó, system-wide capability bounding set không có hiệu ứng che khuất này. (Nó không cần thiết, bởi vì các kernel này không hỗ trợ file capabilities).

Capability bounding set toàn hệ thống có thể truy cập thông qua tệp đặc thù của Linux `/proc/sys/kernel/cap-bound`. Một process phải có capability `CAP_SYS_MODULE` để có thể thay đổi nội dung của `cap-bound`. Tuy nhiên, chỉ có tiến trình `init` mới có thể bật các bit trong mặt nạ (mask) này; các process có đặc quyền khác chỉ có thể tắt các bit. Hệ quả của những giới hạn này là trên một hệ thống không hỗ trợ file capabilities, chúng ta không bao giờ có thể cấp capability `CAP_SETPCAP` cho một process. Điều này là hợp lý, vì capability đó có thể được sử dụng để phá hoại toàn bộ hệ thống kiểm tra đặc quyền của kernel. (Trong trường hợp hy hữu mà chúng ta muốn thay đổi giới hạn này, chúng ta phải tải một kernel module làm thay đổi giá trị trong tập hợp, sửa đổi mã nguồn của chương trình `init`, hoặc thay đổi việc khởi tạo capability bounding set trong mã nguồn kernel và tiến hành biên dịch lại kernel - kernel rebuild).

> [!NOTE]
> Gây bối rối ở chỗ, mặc dù là một bit mask (mặt nạ bit), giá trị trong tệp `cap-bound` toàn hệ thống lại được hiển thị dưới dạng một số nguyên có dấu (signed decimal number). Ví dụ, giá trị ban đầu của tệp này là –257. Đây là cách diễn giải bù 2 (two's complement) của bit mask với tất cả các bit ngoại trừ (1 << 8) được bật (tức là ở hệ nhị phân, `11111111 11111111 11111110 11111111`); `CAP_SETPCAP` có giá trị là 8.

### Sử dụng capabilities trong một chương trình trên hệ thống không hỗ trợ file capabilities

Ngay cả trên một hệ thống không hỗ trợ file capabilities (tính năng capabilities gắn liền với tệp), chúng ta vẫn có thể áp dụng capabilities để cải thiện tính bảo mật của một chương trình. Chúng ta thực hiện việc này như sau:

- 1. Chạy chương trình trong một tiến trình (process) có effective user ID bằng 0 (thường là một chương trình set-user-ID-root). Tiến trình như vậy sẽ được cấp tất cả các capabilities (ngoại trừ CAP\_SETPCAP, như đã lưu ý trước đó) trong các tập hợp permitted và effective của nó.
- 2. Khi khởi động chương trình, sử dụng libcap API để loại bỏ tất cả các capabilities khỏi tập effective, và loại bỏ tất cả các capabilities ngoại trừ những cái có thể cần đến sau này khỏi tập permitted.
- 3. Thiết lập cờ `SECBIT_KEEP_CAPS` (hoặc sử dụng thao tác `prctl()` với `PR_SET_KEEPCAPS` để đạt được kết quả tương tự), nhằm đảm bảo bước tiếp theo không làm mất đi các capabilities.
- 4. Đặt tất cả các user ID thành các giá trị khác 0, nhằm ngăn chặn tiến trình truy cập vào các tệp thuộc sở hữu của root hoặc đạt được các capabilities thông qua một lệnh `exec()`.

Chúng ta có thể thay thế hai bước trước đó bằng một bước duy nhất là thiết lập cờ `SECBIT_NOROOT`, nếu chúng ta muốn ngăn chặn tiến trình lấy lại các đặc quyền (privileges) khi thực thi `exec()`, nhưng vẫn phải cho phép nó truy cập vào các tệp thuộc sở hữu của root. (Tất nhiên, việc cho phép truy cập vào các tệp thuộc sở hữu của root vẫn để ngỏ rủi ro về một số lỗ hổng bảo mật).

5. Trong suốt phần thời gian còn lại của vòng đời chương trình, hãy sử dụng libcap API để bật (raise) và tắt (drop) các permitted capabilities còn lại từ tập effective khi cần thiết nhằm thực hiện các tác vụ đòi hỏi đặc quyền (privileged tasks).

Một số ứng dụng được xây dựng cho Linux kernel trước phiên bản 2.6.24 đã áp dụng phương pháp này.

> [!NOTE]
> Trong số các nhà phát triển kernel phản đối việc triển khai capabilities cho các tệp thực thi, một trong những ưu điểm được nhìn nhận của phương pháp được mô tả trong phần chính là nhà phát triển ứng dụng biết rõ tệp thực thi đó yêu cầu những capability nào. Ngược lại, một quản trị viên hệ thống (system administrator) có thể không dễ dàng xác định được thông tin này.

## 39.11 Tóm tắt

Mô hình Linux capabilities chia các thao tác đặc quyền (privileged operations) thành các danh mục riêng biệt, và cho phép một tiến trình được cấp một số capabilities trong khi bị từ chối các capabilities khác. Mô hình này đại diện cho một sự cải tiến so với cơ chế đặc quyền "tất cả hoặc không có gì" (all-or-nothing privilege mechanism) truyền thống, theo đó một tiến trình hoặc có đặc quyền thực hiện mọi thao tác (user ID 0) hoặc không có đặc quyền nào (user ID khác 0). Kể từ kernel 2.6.24, Linux hỗ trợ gắn capabilities vào các tệp, nhờ đó một tiến trình có thể có được các capabilities được chọn lọc bằng cách thực thi (`exec`) một chương trình.

## 39.12 Bài tập

**39-1.** Chỉnh sửa chương trình trong [Listing 35-2](#page-10-1) (`sched_set.c`, ở trang [743](#page-10-1)) để sử dụng file capabilities, sao cho nó có thể được sử dụng bởi một người dùng không có đặc quyền (unprivileged user).
