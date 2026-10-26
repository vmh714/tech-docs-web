# Chương 4: Kỹ thuật Gỡ lỗi (Debugging Techniques)

Lập trình nhân (Kernel programming) mang lại những thử thách gỡ lỗi độc đáo của riêng nó. Mã nguồn nhân (Kernel code) không thể dễ dàng thực thi dưới một trình gỡ lỗi (debugger), cũng như không thể dễ dàng theo vết (trace), bởi vì nó là một tập hợp các chức năng không gắn liền với một tiến trình (process) cụ thể nào. Các lỗi trong mã nguồn nhân cũng cực kỳ khó tái tạo và có thể làm sập toàn bộ hệ thống (bring down the entire system), từ đó phá hủy phần lớn các dấu vết có thể được sử dụng để truy lùng chúng.

Chương này giới thiệu các kỹ thuật bạn có thể sử dụng để giám sát mã nguồn nhân và theo vết lỗi trong những hoàn cảnh khó khăn như vậy.

## Hỗ trợ Gỡ lỗi trong Nhân (Debugging Support in the Kernel)

Trong Chương 2, chúng tôi đã khuyến nghị bạn nên tự biên dịch và cài đặt nhân của riêng mình, thay vì chạy nhân mặc định đi kèm với bản phân phối (distribution) của bạn. Một trong những lý do thuyết phục nhất để chạy nhân tự biên dịch là các nhà phát triển nhân đã tích hợp một số tính năng gỡ lỗi ngay trong nhân. Các tính năng này có thể tạo ra thêm đầu ra (output) và làm giảm hiệu năng, vì vậy chúng thường không được bật trong các nhân môi trường sản xuất (production kernels) từ các nhà cung cấp bản phân phối. Tuy nhiên, với tư cách là một nhà phát triển nhân, bạn có các ưu tiên khác và sẽ sẵn sàng chấp nhận chi phí (tối thiểu) từ việc hỗ trợ gỡ lỗi nhân bổ sung.

Ở đây, chúng tôi liệt kê các tùy chọn cấu hình nên được bật cho các nhân dùng để phát triển. Trừ khi có quy định khác, tất cả các tùy chọn này đều nằm dưới menu "kernel hacking" trong bất kỳ công cụ cấu hình nhân nào bạn thích. Lưu ý rằng một số tùy chọn này không được hỗ trợ bởi tất cả các kiến trúc (architectures).

#### CONFIG\_DEBUG\_KERNEL

Tùy chọn này chỉ làm cho các tùy chọn gỡ lỗi khác khả dụng; nó nên được bật nhưng bản thân nó không kích hoạt bất kỳ tính năng nào.

#### CONFIG\_DEBUG\_SLAB

Tùy chọn quan trọng này bật một số loại kiểm tra trong các hàm cấp phát bộ nhớ nhân (kernel memory allocation functions); với các tính năng kiểm tra này được bật, có thể phát hiện ra một số lỗi tràn bộ nhớ (memory overrun) và lỗi thiếu khởi tạo (missing initialization). Mỗi byte bộ nhớ được cấp phát

được đặt thành giá trị `0xa5` trước khi được bàn giao cho bên gọi và sau đó được đặt thành `0x6b` khi nó được giải phóng. Nếu bạn từng thấy bất kỳ mẫu "độc hại" (poison) nào trong số đó lặp lại trong đầu ra từ trình điều khiển (driver) của bạn (hoặc thường xuyên trong danh sách lỗi oops), bạn sẽ biết chính xác loại lỗi nào cần tìm. Khi tính năng gỡ lỗi được bật, nhân cũng đặt các giá trị bảo vệ đặc biệt trước và sau mỗi đối tượng bộ nhớ được cấp phát; nếu những giá trị đó bị thay đổi, nhân sẽ biết rằng ai đó đã tràn vùng nhớ được cấp phát, và nó sẽ phàn nàn một cách mạnh mẽ. Các biện pháp kiểm tra khác nhau đối cho các lỗi khó hiểu hơn cũng được bật.

#### CONFIG\_DEBUG\_PAGEALLOC

Toàn bộ các trang (pages) bị xóa khỏi không gian địa chỉ nhân (kernel address space) khi được giải phóng. Tùy chọn này có thể làm chậm hệ thống đáng kể, nhưng nó cũng có thể nhanh chóng chỉ ra một số loại lỗi hỏng bộ nhớ (memory corruption).

### CONFIG\_DEBUG\_SPINLOCK

Khi tùy chọn này được bật, kernel sẽ bắt lỗi các thao tác trên các spinlock chưa được khởi tạo và một số lỗi khác (chẳng hạn như mở khóa một khóa hai lần).

#### CONFIG\_DEBUG\_SPINLOCK\_SLEEP

Tùy chọn này bật tính năng kiểm tra các nỗ lực ngủ (sleep) trong khi đang giữ một spinlock (khóa quay). Trên thực tế, nó sẽ cảnh báo nếu bạn gọi một hàm có khả năng gây ngủ, ngay cả khi lời gọi cụ thể đó không thực sự đi vào trạng thái ngủ.

#### CONFIG\_INIT\_DEBUG

Các mục được đánh dấu bằng `__init` (hoặc `__initdata`) sẽ bị hủy bỏ sau khi khởi động hệ thống hoặc thời điểm nạp module. Tùy chọn này bật các tính năng kiểm tra đối với mã nguồn cố gắng truy cập vào vùng nhớ khởi động sau khi quá trình khởi tạo đã hoàn tất.

#### CONFIG\_DEBUG\_INFO

Tùy chọn này khiến kernel được build kèm theo toàn bộ thông tin gỡ lỗi (debugging information). Bạn sẽ cần những thông tin này nếu muốn gỡ lỗi kernel bằng *gdb*. Bạn cũng có thể muốn bật `CONFIG_FRAME_POINTER` nếu có ý định sử dụng *gdb*.

### CONFIG\_MAGIC\_SYSRQ

Bật phím "magic SysRq". Chúng ta sẽ tìm hiểu về phím này trong phần "System Hangs" (Hệ thống bị treo) ở phần sau của chương này.

### CONFIG\_DEBUG\_STACKOVERFLOW

#### CONFIG\_DEBUG\_STACK\_USAGE

Các tùy chọn này có thể giúp truyش vết các trường hợp tràn ngăn xếp kernel (kernel stack overflows). Dấu hiệu chắc chắn của việc tràn ngăn xếp là một danh sách oops mà không có bất kỳ truy vết ngược (backtrace) hợp lý nào. Tùy chọn đầu tiên bổ sung các bước kiểm tra tràn ngăn xếp tường minh vào kernel; tùy chọn thứ hai khiến kernel giám sát việc sử dụng ngăn xếp và cung cấp một số số liệu thống kê thông qua phím magic SysRq.

#### CONFIG\_KALLSYMS

Tùy chọn này (nằm trong mục "General setup/Standard features") khiến thông tin ký hiệu kernel (kernel symbol information) được biên dịch trực tiếp vào kernel; nó được bật theo mặc định. Thông tin ký hiệu này được sử dụng trong các ngữ cảnh gỡ lỗi; nếu không có nó, một danh sách oops chỉ có thể cung cấp cho bạn truy vết ngăn xếp kernel (kernel traceback) dưới dạng hệ thập lục phân (hexadecimal), vốn không hữu ích cho lắm.

### CONFIG\_IKCONFIG

#### CONFIG\_IKCONFIG\_PROC

Các tùy chọn này (nằm trong menu "General setup") khiến toàn bộ trạng thái cấu hình kernel được biên dịch vào kernel và được hiển thị thông qua `/proc`. Hầu hết các nhà phát triển kernel đều biết cấu hình nào họ đã sử dụng và không cần các tùy chọn này (vốn làm cho kernel lớn hơn). Tuy nhiên, chúng có thể hữu ích nếu bạn đang cố gắng gỡ lỗi một sự cố trong kernel được build bởi người khác.

#### CONFIG\_ACPI\_DEBUG

Nằm trong mục "Power management/ACPI". Tùy chọn này bật thông tin gỡ lỗi ACPI (Advanced Configuration and Power Interface) chi tiết (verbose), rất hữu ích nếu bạn nghi ngờ có sự cố liên quan đến ACPI.

### CONFIG\_DEBUG\_DRIVER

Nằm trong mục "Device drivers". Bật thông tin gỡ lỗi trong nhân trình điều khiển (driver core), điều này có thể hữu ích để theo dõi các sự cố trong mã nguồn hỗ trợ mức thấp (low-level support code). Chúng ta sẽ tìm hiểu về driver core trong Chương 14.

### CONFIG\_SCSI\_CONSTANTS

Tùy chọn này, nằm trong mục "Device drivers/SCSI device support", sẽ tích hợp thông tin để xuất các thông báo lỗi SCSI chi tiết (verbose). Nếu bạn đang làm việc trên một SCSI driver, bạn có thể sẽ cần tùy chọn này.

#### CONFIG\_INPUT\_EVBUG

Tùy chọn này (trong mục "Device drivers/Input device support") bật tính năng ghi nhật ký chi tiết (verbose logging) của các sự kiện đầu vào (input events). Nếu bạn đang phát triển một driver cho thiết bị đầu vào (input device), tùy chọn này có thể rất hữu ích. Tuy nhiên, hãy lưu ý về các vấn đề bảo mật của tùy chọn này: nó ghi lại mọi thứ bạn gõ, bao gồm cả mật khẩu của bạn.

#### CONFIG\_PROFILING

Tùy chọn này nằm trong mục "Profiling support". Profiling thường được sử dụng để tối ưu hóa hiệu năng hệ thống (system performance tuning), nhưng nó cũng hữu ích trong việc truy lùng một số hiện tượng treo nhân (kernel hang) và các vấn đề liên quan.

Chúng ta sẽ quay lại xem xét một số tùy chọn trên khi tìm hiểu các phương pháp khác nhau để truy lùng các sự cố kernel. Nhưng trước tiên, chúng ta sẽ xem xét kỹ thuật gỡ lỗi (debugging) kinh điển: câu lệnh in (print statement).

## Gỡ lỗi bằng cách In (Debugging by Printing)

Kỹ thuật gỡ lỗi phổ biến nhất là giám sát (monitoring), trong lập trình ứng dụng thường được thực hiện bằng cách gọi *printf* tại các điểm thích hợp. Khi bạn đang gỡ lỗi mã nguồn kernel (kernel code), bạn có thể đạt được mục đích tương tự với *printk*.

### printk

Chúng ta đã sử dụng hàm *printk* trong các chương trước với giả định đơn giản hóa rằng nó hoạt động giống như *printf*. Bây giờ là lúc giới thiệu một số điểm khác biệt.

Một trong những điểm khác biệt là *printk* cho phép bạn phân loại các thông báo theo mức độ nghiêm trọng bằng cách liên kết các *loglevel* (mức nhật ký) hoặc mức ưu tiên khác nhau với thông báo. Bạn thường chỉ định loglevel bằng một macro. Ví dụ, KERN\_INFO, mà chúng ta đã thấy được nối thêm vào đầu một số câu lệnh print trước đó, là một trong những loglevel có thể có của thông báo. Macro loglevel mở rộng thành một chuỗi (string), chuỗi này được nối vào văn bản thông báo tại thời điểm biên dịch (compile time); đó là lý do tại sao không có dấu phẩy giữa mức độ ưu tiên và chuỗi định dạng trong các ví dụ sau. Dưới đây là hai ví dụ về lệnh *printk*, một thông báo gỡ lỗi và một thông báo nghiêm trọng:

```c
printk(KERN_DEBUG "Here I am: %s:%i\n", __FILE__, __LINE__);
printk(KERN_CRIT "I'm trashed; giving up on %p\n", ptr);
```

Có tám chuỗi loglevel có thể có, được định nghĩa trong tệp tiêu đề (header file) *<linux/kernel.h>*; chúng tôi liệt kê chúng theo thứ tự mức độ nghiêm trọng giảm dần:

#### KERN\_EMERG

Được sử dụng cho các thông báo khẩn cấp, thường là những thông báo trước một sự cố sập hệ thống (crash).

#### KERN\_ALERT

Một tình huống đòi hỏi hành động ngay lập tức.

#### KERN\_CRIT

Các điều kiện nghiêm trọng, thường liên quan đến lỗi phần cứng hoặc phần mềm trầm trọng.

#### KERN\_ERR

Được sử dụng để báo cáo các điều kiện lỗi; các device driver thường sử dụng KERN\_ERR để báo cáo các sự cố phần cứng.

#### KERN\_WARNING

Các cảnh báo về các tình huống có vấn đề nhưng bản thân chúng chưa gây ra sự cố nghiêm trọng cho hệ thống.

### KERN\_NOTICE

Các tình huống bình thường nhưng vẫn đáng chú ý. Một số điều kiện liên quan đến bảo mật được báo cáo ở mức này.

### KERN\_INFO

Các thông điệp mang tính thông tin. Nhiều trình điều khiển (driver) in ra thông tin về phần cứng mà chúng tìm thấy tại thời điểm khởi động ở mức này.

### KERN\_DEBUG

Được sử dụng cho các thông điệp gỡ lỗi (debugging).

Mỗi chuỗi (trong việc mở rộng macro - macro expansion) đại diện cho một số nguyên nằm trong dấu ngoặc nhọn. Các số nguyên nằm trong khoảng từ 0 đến 7, với giá trị nhỏ hơn đại diện cho độ ưu tiên cao hơn.

Một câu lệnh *printk* không được chỉ định mức độ ưu tiên sẽ nhận giá trị mặc định là DEFAULT\_MESSAGE\_LOGLEVEL, được định nghĩa trong *kernel/printk.c* dưới dạng một số nguyên. Trong phiên bản kernel 2.6.10, DEFAULT\_MESSAGE\_LOGLEVEL là KERN\_WARNING, nhưng điều này đã từng thay đổi trong các phiên bản trước đó.

Dựa vào mức nhật ký (loglevel), kernel có thể in thông điệp ra console hiện tại, có thể là một terminal chế độ văn bản (text-mode terminal), cổng nối tiếp (serial port), hoặc máy in song song (parallel printer). Nếu mức ưu tiên nhỏ hơn biến số nguyên console\_loglevel, thông điệp sẽ được gửi đến console từng dòng một (không có gì được gửi đi trừ khi có ký tự xuống dòng ở cuối). Nếu cả *klogd* và *syslogd* đang chạy trên hệ thống, các thông điệp của kernel sẽ được nối vào */var/log/messages* (hoặc được xử lý khác tùy thuộc vào cấu hình *syslogd* của bạn), độc lập với console\_loglevel. Nếu *klogd* không chạy, thông điệp sẽ không đến được User Space trừ khi bạn đọc */proc/kmsg* (thường được thực hiện dễ nhất bằng lệnh *dmesg*). Khi sử dụng *klogd*, bạn nên nhớ rằng nó không lưu các dòng giống nhau liên tiếp; nó chỉ lưu dòng đầu tiên như vậy và, tại một thời điểm sau đó, lưu số lần lặp lại mà nó nhận được.

Biến console\_loglevel được khởi tạo bằng DEFAULT\_CONSOLE\_LOGLEVEL và có thể được sửa đổi thông qua System Call *sys\_syslog*. Một cách để thay đổi nó là chỉ định tùy chọn *–c* khi gọi *klogd*, như được quy định trong trang hướng dẫn (manpage) của *klogd*. Lưu ý rằng để thay đổi giá trị hiện tại, trước tiên bạn phải dừng (kill) *klogd* và sau đó khởi động lại nó với tùy chọn *–c*. Ngoài ra, bạn có thể viết một chương trình để thay đổi mức log của console. Bạn sẽ tìm thấy phiên bản của một chương trình như vậy trong *misc-progs/setlevel.c* trong các tệp mã nguồn được cung cấp trên trang FTP của O'Reilly. Mức mới được chỉ định dưới dạng một giá trị số nguyên từ 1 đến 8 (bao gồm cả 1 và 8). Nếu nó được đặt là 1, chỉ các thông điệp ở mức 0 (KERN\_EMERG) mới tới được console; nếu nó được đặt là 8, tất cả các thông điệp, bao gồm cả các thông điệp gỡ lỗi, sẽ được hiển thị.

Cũng có thể đọc và sửa đổi mức log của console bằng cách sử dụng tệp văn bản */proc/sys/kernel/printk*. Tệp này chứa bốn giá trị số nguyên: mức log hiện tại, mức mặc định cho các thông điệp thiếu mức log tường minh, mức log tối thiểu cho phép và mức log mặc định khi khởi động (boot-time). Việc ghi một giá trị duy nhất vào tệp này sẽ thay đổi mức log hiện tại thành giá trị đó; do đó, ví dụ, bạn có thể làm cho tất cả các thông điệp của kernel xuất hiện trên console bằng cách đơn giản gõ:

#### echo 8 > /proc/sys/kernel/printk

Bây giờ bạn có thể thấy rõ lý do tại sao mẫu *hello.c* lại có các dấu hiệu KERN\_ALERT; chúng ở đó để đảm bảo rằng các thông điệp xuất hiện trên console.

### Chuyển hướng Thông điệp Console (Redirecting Console Messages)

Linux cho phép một mức độ linh hoạt nhất định trong các chính sách ghi nhật ký console (console logging policies) bằng cách cho phép bạn gửi các thông điệp đến một console ảo (virtual console) cụ thể (nếu console của bạn hoạt động trên màn hình văn bản). Theo mặc định, "console" là terminal ảo (virtual terminal) hiện tại. Để chọn một terminal ảo khác nhận thông điệp, bạn có thể gọi lệnh `ioctl(TIOCLINUX)` trên bất kỳ thiết bị console nào. Chương trình sau đây, *setconsole*, có thể được sử dụng để chọn console nhận thông điệp kernel (kernel message); nó phải được chạy bởi siêu người dùng (superuser) và có sẵn trong thư mục *misc-progs*.

Dưới đây là toàn bộ mã nguồn của chương trình. Bạn nên chạy nó với một tham số duy nhất chỉ định số hiệu của console sẽ nhận thông điệp.

```c
int main(int argc, char **argv)
{
 char bytes[2] = {11,0}; /* 11 là số lệnh TIOCLINUX */
 if (argc==2) bytes[1] = atoi(argv[1]); /* console được chọn */
 else {
 fprintf(stderr, "%s: cần một tham số duy nhất\n",argv[0]); exit(1);
 }
 if (ioctl(STDIN_FILENO, TIOCLINUX, bytes)<0) { /* sử dụng stdin */
 fprintf(stderr,"%s: ioctl(stdin, TIOCLINUX): %s\n",
 argv[0], strerror(errno));
 exit(1);
 }
 exit(0);
}
```

*setconsole* sử dụng lệnh *ioctl* đặc biệt `TIOCLINUX`, thực thi các hàm đặc trưng của Linux (Linux-specific functions). Để sử dụng `TIOCLINUX`, bạn truyền cho nó một tham số là một con trỏ tới một mảng byte (byte array). Byte đầu tiên của mảng là một số chỉ định lệnh con (subcommand) được yêu cầu, và các byte tiếp theo là các tham số cụ thể của lệnh con đó. Trong *setconsole*, lệnh con số 11 được sử dụng và byte tiếp theo (được lưu trong `bytes[1]`) xác định console ảo. Mô tả đầy đủ về `TIOCLINUX` có thể được tìm thấy trong tệp *drivers/char/tty\_io.c*, nằm trong mã nguồn kernel (kernel source).

### Thông điệp được ghi nhật ký như thế nào (How Messages Get Logged)

Hàm *printk* ghi các thông điệp vào một bộ đệm vòng (circular buffer) có kích thước `__LOG_BUF_LEN` byte: một giá trị từ 4 KB đến 1 MB được chọn trong quá trình cấu hình kernel. Sau đó, hàm này đánh thức bất kỳ tiến trình (process) nào đang chờ thông điệp, nghĩa là bất kỳ tiến trình nào đang ngủ (sleeping) trong system call *syslog* hoặc đang đọc */proc/kmsg*. Hai giao diện này đến bộ máy ghi nhật ký (logging engine) hầu như tương đương nhau, nhưng lưu ý rằng việc đọc từ */proc/kmsg* sẽ tiêu thụ (consume) dữ liệu khỏi bộ đệm nhật ký (log buffer), trong khi system call *syslog* có thể tùy chọn trả về dữ liệu nhật ký đồng thời vẫn giữ lại dữ liệu đó cho các tiến trình khác. Nhìn chung, việc đọc tệp */proc* sẽ dễ hơn và là hành vi mặc định của *klogd*. Lệnh *dmesg* có thể được sử dụng để xem nội dung của bộ đệm mà không làm xả (flush) nó; thực tế, lệnh này trả về *stdout* toàn bộ nội dung của bộ đệm, bất kể nó đã được đọc hay chưa.

Nếu bạn đọc các thông điệp kernel thủ công sau khi đã dừng *klogd*, bạn sẽ thấy rằng tệp */proc* hoạt động giống như một FIFO, theo đó trình đọc (reader) sẽ bị chặn (block) và chờ thêm dữ liệu. Rõ ràng là bạn không thể đọc thông điệp theo cách này nếu *klogd* hoặc một tiến trình khác đang đọc cùng dữ liệu đó, bởi vì bạn sẽ tranh chấp (contend) dữ liệu với chúng.

Nếu bộ đệm vòng đầy, *printk* sẽ quay vòng (wrap around) và bắt đầu thêm dữ liệu mới vào đầu bộ đệm, ghi đè lên dữ liệu cũ nhất. Do đó, tiến trình ghi nhật ký sẽ mất đi dữ liệu cũ nhất.

Vấn đề này không đáng kể so với những lợi ích của việc sử dụng bộ đệm vòng như vậy. Ví dụ, bộ đệm vòng cho phép hệ thống chạy ngay cả khi không có tiến trình ghi nhật ký nào, đồng thời giảm thiểu lãng phí bộ nhớ bằng cách ghi đè dữ liệu cũ nếu không ai đọc nó. Một tính năng khác trong cách tiếp cận xử lý thông điệp của Linux là *printk* có thể được gọi từ bất cứ đâu, ngay cả từ một trình xử lý ngắt (interrupt handler), mà không có giới hạn về lượng dữ liệu có thể được in ra. Nhược điểm duy nhất là khả năng mất một ít dữ liệu.

Nếu tiến trình *klogd* đang chạy, nó sẽ lấy các thông điệp kernel và chuyển tiếp chúng đến *syslogd*, chương trình này sẽ kiểm tra */etc/syslog.conf* để tìm cách xử lý chúng. *syslogd* phân biệt các thông điệp dựa trên facility (cơ sở/nhóm nguồn) và priority (mức độ ưu tiên); các giá trị cho phép của cả facility và priority được định nghĩa trong *<sys/syslog.h>*. Các thông điệp kernel được ghi nhật ký bởi facility `LOG_KERN` với mức độ ưu tiên tương ứng với mức được sử dụng trong *printk* (ví dụ, `LOG_ERR` được sử dụng cho các thông điệp `KERN_ERR`). Nếu *klogd* không chạy, dữ liệu sẽ nằm trong bộ đệm vòng cho đến khi có ai đó đọc nó hoặc bộ đệm bị tràn (overflow).

Nếu bạn muốn tránh làm nhiễu nhật ký hệ thống của mình bằng các thông điệp giám sát từ trình điều khiển (driver) của bạn, bạn có thể chỉ định tùy chọn *–f* (file) cho *klogd* để hướng dẫn nó lưu thông điệp vào một tệp cụ thể, hoặc tùy chỉnh */etc/syslog.conf* cho phù hợp với nhu cầu của bạn. Một khả năng khác là sử dụng phương pháp thô bạo (brute-force): tắt *klogd* (kill *klogd*) và in thông điệp một cách chi tiết (verbose) trên một terminal ảo không sử dụng,\* hoặc chạy lệnh *cat /proc/kmsg* từ một cửa sổ *xterm* không dùng đến.

### Bật và Tắt Thông Điệp

Trong các giai đoạn đầu của quá trình phát triển driver, *printk* có thể hỗ trợ rất đáng kể trong việc gỡ lỗi (debugging) và kiểm thử mã nguồn mới. Mặt khác, khi chính thức phát hành driver, bạn nên loại bỏ, hoặc ít nhất là vô hiệu hóa, các câu lệnh in (print statement) đó. Thật không may, bạn có thể sẽ thấy rằng ngay khi bạn nghĩ mình không còn cần các thông điệp đó nữa và xóa chúng đi, bạn lại cài đặt một tính năng mới trong driver (hoặc ai đó tìm ra lỗi), và bạn lại muốn bật ít nhất một trong các thông điệp đó trở lại. Có một số cách để giải quyết cả hai vấn đề này, đó là bật hoặc tắt toàn bộ thông điệp gỡ lỗi (global enable/disable) và bật/tắt từng thông điệp riêng lẻ.

Dưới đây, chúng tôi trình bày một cách lập trình các lời gọi *printk* để bạn có thể bật và tắt chúng một cách riêng lẻ hoặc toàn cục; kỹ thuật này phụ thuộc vào việc định nghĩa một macro (macro) sẽ mở rộng thành một lời gọi *printk* (hoặc *printf*) khi bạn muốn:

- Mỗi câu lệnh in có thể được bật hoặc tắt bằng cách xóa hoặc thêm một ký tự duy nhất vào tên của macro.
- Tất cả các thông điệp có thể bị vô hiệu hóa cùng một lúc bằng cách thay đổi giá trị của biến CFLAGS trước khi biên dịch.

Ví dụ, sử dụng *setlevel 8; setconsole 10* để thiết lập terminal 10 hiển thị các thông điệp.

• Cùng một câu lệnh in có thể được sử dụng trong mã nguồn kernel (kernel code) và mã nguồn mức người dùng (user-level code), sao cho driver và các chương trình kiểm thử có thể được quản lý theo cùng một cách đối với các thông điệp bổ sung.

Đoạn mã sau đây thực thi các tính năng này và xuất phát trực tiếp từ tệp tiêu đề (header) *scull.h*:

```c
## undef PDEBUG /* hủy định nghĩa nếu có, đề phòng trường hợp đã tồn tại */
## ifdef SCULL_DEBUG
## ifdef __KERNEL__
 /* Trường hợp bật gỡ lỗi và chạy trong kernel space */
## define PDEBUG(fmt, args...) printk( KERN_DEBUG "scull: " fmt, ## args)
## else
 /* Trường hợp chạy trong user space */
## define PDEBUG(fmt, args...) fprintf(stderr, fmt, ## args)
## endif
## else
## define PDEBUG(fmt, args...) /* không gỡ lỗi: không làm gì cả */
## endif
## undef PDEBUGG
## define PDEBUGG(fmt, args...) /* không làm gì cả: đây chỉ là một placeholder */
```

Ký hiệu PDEBUG được định nghĩa hay hủy định nghĩa tùy thuộc vào việc SCULL\_DEBUG có được định nghĩa hay không, và hiển thị thông tin theo cách thức phù hợp với môi trường nơi mã nguồn đang chạy: nó sử dụng lời gọi hệ thống kernel *printk* khi ở trong kernel và lời gọi *libc* *fprintf* ra cổng lỗi chuẩn (standard error) khi chạy trong không gian người dùng (user space). Ngược lại, ký hiệu PDEBUGG không làm gì cả; nó có thể được sử dụng để "chú thích" (comment) các câu lệnh in một cách dễ dàng mà không cần phải xóa chúng hoàn toàn.

Để đơn giản hóa quá trình hơn nữa, hãy thêm các dòng sau vào tệp makefile của bạn:

```make
## Thêm/bỏ chú thích dòng sau để vô hiệu hóa/kích hoạt gỡ lỗi
DEBUG = y
## Thêm cờ gỡ lỗi của bạn (hoặc không) vào CFLAGS
ifeq ($(DEBUG),y)
 DEBFLAGS = -O -g -DSCULL_DEBUG # Cần có "-O" để mở rộng hàm inline
else
 DEBFLAGS = -O2
endif
CFLAGS += $(DEBFLAGS)
```

Các macro được trình bày trong phần này phụ thuộc vào một phần mở rộng của *gcc* đối với bộ tiền xử lý ANSI C (ANSI C preprocessor), hỗ trợ các macro có số lượng đối số thay đổi (variable number of arguments). Sự phụ thuộc vào *gcc* này không phải là vấn đề, bởi vì bản thân kernel cũng phụ thuộc rất nhiều vào các tính năng của *gcc*. Thêm vào đó, makefile phụ thuộc vào phiên bản *make* của GNU; một lần nữa, kernel đã phụ thuộc sẵn vào GNU *make*, vì vậy sự phụ thuộc này không có gì đáng ngại.

Nếu bạn đã quen thuộc với bộ tiền xử lý C (C preprocessor), bạn có thể mở rộng các định nghĩa đã cho để cài đặt khái niệm "mức gỡ lỗi" (debug level), định nghĩa các mức khác nhau và gán một giá trị số nguyên (hoặc mặt nạ bit - bit mask) cho mỗi mức để xác định mức độ chi tiết của thông điệp.

Nhưng mỗi driver đều có các tính năng riêng và nhu cầu giám sát riêng. Nghệ thuật lập trình giỏi nằm ở việc lựa chọn sự đánh đổi tốt nhất giữa tính linh hoạt và hiệu suất, và chúng tôi không thể biết điều gì là tốt nhất cho bạn. Hãy nhớ rằng các điều kiện tiền xử lý (cũng như các biểu thức hằng số trong mã nguồn) được thực thi tại thời điểm biên dịch (compile time), vì vậy bạn phải biên dịch lại để bật hoặc tắt các thông điệp. Một giải pháp thay thế khả thi là sử dụng các câu lệnh điều kiện của C, được thực thi tại thời điểm chạy (runtime) và do đó cho phép bạn bật và tắt thông điệp ngay trong quá trình chương trình thực thi. Đây là một tính năng hay, nhưng nó đòi hỏi phải xử lý bổ sung mỗi khi mã nguồn được thực thi, điều này có thể ảnh hưởng đến hiệu suất (performance) ngay cả khi các thông điệp bị vô hiệu hóa. Đôi khi sự suy giảm hiệu suất này là không thể chấp nhận được.

Các macro được trình bày trong phần này đã tự chứng minh tính hữu ích của chúng trong một số tình huống, với nhược điểm duy nhất là yêu cầu phải biên dịch lại một module sau bất kỳ thay đổi nào đối với các thông điệp của nó.

### Giới hạn tốc độ (Rate Limiting)

Nếu không cẩn thận, bạn có thể thấy mình tạo ra hàng nghìn thông điệp bằng *printk*, làm ngập (overwhelm) console và có khả năng làm tràn tệp nhật ký hệ thống (system log file). Khi sử dụng một thiết bị console chậm (ví dụ: cổng nối tiếp - serial port), tốc độ thông điệp quá mức cũng có thể làm chậm hệ thống hoặc khiến nó trở nên không phản hồi (unresponsive). Sẽ rất khó để nắm bắt vấn đề gì đang xảy ra với hệ thống khi console liên tục phun ra dữ liệu không ngừng nghỉ. Do đó, bạn nên rất cẩn thận về những gì mình in ra, đặc biệt là trong các phiên bản driver chạy trên môi trường thực tế (production) và nhất là sau khi quá trình khởi tạo (initialization) hoàn tất. Nhìn chung, mã nguồn thực tế (production code) không bao giờ được in bất cứ thứ gì trong quá trình hoạt động bình thường; đầu ra được in ra chỉ nên là dấu hiệu của một tình huống ngoại lệ (exceptional situation) cần được chú ý.

Mặt khác, bạn có thể muốn phát ra một thông điệp nhật ký (log message) nếu thiết bị bạn đang điều khiển ngừng hoạt động. Nhưng bạn nên cẩn thận để không lạm dụng việc này. Một tiến trình (process) kém thông minh cứ tiếp tục lặp lại mãi khi đối mặt với các lỗi có thể tạo ra hàng nghìn lần thử lại mỗi giây; nếu driver của bạn in ra thông điệp "thiết bị của tôi bị hỏng" mỗi lần như vậy, nó có thể tạo ra lượng đầu ra khổng lồ và có khả năng ngốn CPU (hog the CPU) nếu thiết bị console chậm và không có ngắt (interrupt) nào được sử dụng để điều khiển console, ngay cả khi đó là cổng nối tiếp hay máy in dòng (line printer).

Trong nhiều trường hợp, hành vi tốt nhất là thiết lập một cờ (flag) mang ý nghĩa "Tôi đã phàn nàn về điều này rồi" và không in thêm bất kỳ thông điệp nào nữa một khi cờ đó đã được bật. Tuy nhiên, trong các trường hợp khác, có những lý do để thỉnh thoảng phát ra thông báo "thiết bị vẫn bị hỏng". Kernel đã cung cấp một hàm có thể hữu ích trong những trường hợp như vậy:

```c
int printk_ratelimit(void);
```

Hàm này nên được gọi trước khi bạn tính đến việc in một thông điệp có khả năng bị lặp lại thường xuyên. Nếu hàm trả về một giá trị khác không, hãy tiến hành in thông điệp của bạn, ngược lại hãy bỏ qua nó. Do đó, các lời gọi điển hình sẽ trông như thế này:

```c
if (printk_ratelimit( ))
    printk(KERN_NOTICE "The printer is still on fire\n");
```

*printk_ratelimit* hoạt động bằng cách theo dõi số lượng thông điệp được gửi tới console. Khi mức độ đầu ra vượt quá ngưỡng (threshold), *printk_ratelimit* bắt đầu trả về 0 và làm cho các thông điệp bị loại bỏ (dropped).

Hành vi của *printk_ratelimit* có thể được tùy chỉnh bằng cách chỉnh sửa `/proc/sys/kernel/printk_ratelimit` (số秒/giây phải đợi trước khi bật lại thông điệp) và `/proc/sys/kernel/printk_ratelimit_burst` (số lượng thông điệp được chấp nhận trước khi áp dụng giới hạn tốc độ).

### In số hiệu thiết bị (Printing Device Numbers)

Đôi khi, khi in một thông điệp từ một driver, bạn sẽ muốn in số hiệu thiết bị (device number) liên quan đến phần cứng đang quan tâm. Việc in số chính (major number) và số phụ (minor number) không phải là quá khó, nhưng vì lợi ích của sự thống nhất, kernel cung cấp một vài macro tiện ích (được định nghĩa trong `<linux/kdev_t.h>`) cho mục đích này:

```c
int print_dev_t(char *buffer, dev_t dev);
char *format_dev_t(char *buffer, dev_t dev);
```

Cả hai macro đều mã hóa số hiệu thiết bị vào bộ đệm (buffer) được cung cấp; sự khác biệt duy nhất là *print_dev_t* trả về số lượng ký tự được in, trong khi *format_dev_t* trả về buffer; do đó, nó có thể được sử dụng trực tiếp như một tham số cho lời gọi *printk*, mặc dù người ta phải nhớ rằng *printk* không thực hiện xả bộ đệm (flush) cho đến khi ký tự xuống dòng (newline) được cung cấp ở cuối. Bộ đệm phải đủ lớn để chứa một số hiệu thiết bị; vì số hiệu thiết bị 64-bit hoàn toàn có khả năng xuất hiện trong các phiên bản kernel tương lai, bộ đệm có lẽ nên dài ít nhất 20 byte.

## Gỡ lỗi bằng cách Truy vấn (Debugging by Querying)

Phần trước đã mô tả cách thức hoạt động của *printk* và cách sử dụng nó. Điều mà phần đó chưa đề cập đến là các nhược điểm của nó.

Việc sử dụng ồ ạt *printk* có thể làm chậm hệ thống một cách đáng kể, ngay cả khi bạn hạ thấp *console_loglevel* để tránh việc tải thiết bị console (console device), bởi vì *syslogd* liên tục đồng bộ hóa các tệp đầu ra của nó; do đó, mỗi dòng được in ra sẽ gây ra một thao tác ghi đĩa (disk operation). Đây là một cách triển khai chính xác từ góc nhìn của *syslogd*. Nó cố gắng ghi mọi thứ xuống đĩa phòng trường hợp hệ thống bị treo (crash) ngay sau khi thông điệp được in ra; tuy nhiên, bạn chắc chắn không muốn làm chậm hệ thống của mình chỉ vì các thông điệp gỡ lỗi (debugging message). Vấn đề này có thể được giải quyết bằng cách thêm tiền tố là dấu gạch ngang vào trước tên tệp nhật ký (log file) trong tệp */etc/syslogd.conf*.\* Vấn đề với việc thay đổi tệp cấu hình này là sự sửa đổi đó có thể vẫn giữ nguyên sau khi bạn đã gỡ lỗi xong, mặc dù trong quá trình vận hành hệ thống bình thường, bạn thực sự muốn các thông điệp được xả (flush) xuống đĩa càng sớm càng tốt. Một giải pháp thay thế cho sự thay đổi vĩnh viễn đó là chạy một chương trình khác ngoài *klogd* (chẳng hạn như *cat /proc/kmsg*, như đã gợi ý trước đó), nhưng điều này có thể không cung cấp một môi trường phù hợp cho việc vận hành hệ thống bình thường.

Thường thì cách tốt nhất để lấy thông tin có liên quan là truy vấn hệ thống khi bạn cần thông tin đó, thay vì liên tục tạo ra dữ liệu. Trên thực tế, mọi hệ thống Unix đều cung cấp nhiều công cụ để lấy thông tin hệ thống: *ps*, *netstat*, *vmstat*, v.v.

Có một vài kỹ thuật khả dụng cho các nhà phát triển trình điều khiển (driver developer) để truy vấn hệ thống: tạo một tệp trong hệ thống tệp */proc* (*/proc* filesystem), sử dụng phương thức trình điều khiển *ioctl* (*ioctl* driver method), và xuất các thuộc tính (attribute) thông qua *sysfs*. Việc sử dụng *sysfs* đòi hỏi khá nhiều kiến thức nền tảng về mô hình trình điều khiển (driver model). Nó được thảo luận trong Chương 14.

### Sử dụng Hệ thống tệp /proc (/proc Filesystem)

Hệ thống tệp */proc* là một hệ thống tệp đặc biệt, do phần mềm tạo ra, được kernel sử dụng để xuất thông tin ra bên ngoài. Mỗi tệp nằm dưới */proc* được gắn với một hàm kernel (kernel function) để tạo ra "nội dung" của tệp ngay lập tức khi tệp được đọc. Chúng ta đã thấy một số tệp này hoạt động; ví dụ, */proc/modules* luôn trả về danh sách các module hiện đang được tải.

*/proc* được sử dụng rất nhiều trong hệ thống Linux. Nhiều tiện ích trên một bản phân phối Linux hiện đại, chẳng hạn như *ps*, *top*, và *uptime*, lấy thông tin của chúng từ */proc*. Một số trình điều khiển thiết bị (device driver) cũng xuất thông tin thông qua */proc*, và trình điều khiển của bạn cũng có thể làm như vậy. Hệ thống tệp */proc* có tính động (dynamic), vì vậy module của bạn có thể thêm hoặc xóa các mục nhập (entry) bất kỳ lúc nào.

Các mục nhập */proc* đầy đủ tính năng có thể khá phức tạp; trong số những thứ khác, chúng có thể vừa được ghi vừa được đọc. Tuy nhiên, phần lớn thời gian, các mục nhập */proc* là các tệp chỉ đọc (read-only). Phần này tập trung vào trường hợp đơn giản là chỉ đọc. Những ai quan tâm đến việc triển khai một cái gì đó phức tạp hơn có thể tìm hiểu các cơ sở ở đây; mã nguồn kernel (kernel source) sau đó có thể được tham khảo để có cái nhìn toàn diện.

Tuy nhiên, trước khi tiếp tục, chúng ta nên đề cập rằng việc thêm các tệp dưới */proc* không được khuyến khích. Hệ thống tệp */proc* được các nhà phát triển kernel coi là một sự hỗn loạn không được kiểm soát, đã vượt xa mục đích ban đầu của nó (vốn là để cung cấp thông tin về các tiến trình đang chạy trong hệ thống). Cách được khuyến nghị để cung cấp thông tin trong mã nguồn mới là thông qua sysfs. Tuy nhiên, như đã gợi ý, việc làm việc với sysfs đòi hỏi phải hiểu rõ về mô hình thiết bị Linux (Linux device model), và chúng ta chưa đề cập đến điều đó cho đến Chương 14. Trong khi chờ đợi, các tệp dưới */proc* dễ tạo hơn một chút, và chúng hoàn toàn phù hợp cho mục đích gỡ lỗi, vì vậy chúng ta sẽ đề cập đến chúng ở đây.

\
Dấu gạch ngang, hay dấu trừ, là một điểm đánh dấu "ma thuật" để ngăn *syslogd* xả tệp xuống đĩa ở mỗi thông điệp mới, được tài liệu hóa trong *syslog.conf(5)*, một trang hướng dẫn (manpage) rất đáng đọc.

### Triển khai các tệp trong /proc

Tất cả các module làm việc với */proc* nên bao gồm tệp tiêu đề *<linux/proc\_fs.h>* để định nghĩa các hàm phù hợp.

Để tạo một tệp */proc* chỉ đọc (read-only), trình điều khiển (driver) của bạn phải triển khai một hàm để tạo ra dữ liệu khi tệp được đọc. Khi một tiến trình (process) nào đó đọc tệp (sử dụng System Call *read*), yêu cầu sẽ đến module của bạn thông qua hàm này. Chúng ta sẽ xem xét hàm này trước và tìm hiểu về giao diện đăng ký (registration interface) sau trong phần này.

Khi một tiến trình đọc từ tệp */proc* của bạn, kernel cấp phát một trang bộ nhớ (memory page) (tức là `PAGE_SIZE` byte) nơi driver có thể ghi dữ liệu để trả về không gian người dùng (User Space). Bộ đệm (buffer) đó được truyền cho hàm của bạn, đó là một phương thức (method) có tên là *read\_proc*:

```c
int (*read_proc)(char *page, char **start, off_t offset, int count,
 int eof, void *data);
```

Con trỏ `page` là bộ đệm nơi bạn sẽ ghi dữ liệu của mình; `start` được sử dụng bởi hàm để cho biết dữ liệu quan trọng đã được ghi vào `page` ở đâu (sẽ nói thêm về điều này sau); `offset` và `count` có ý nghĩa giống như đối với phương thức *read*. Đối số `eof` trỏ đến một số nguyên phải được thiết lập bởi driver để báo hiệu rằng nó không còn dữ liệu nào để trả về nữa, trong khi `data` là một con trỏ dữ liệu dành riêng cho driver mà bạn có thể sử dụng cho việc ghi chép nội bộ (internal bookkeeping).

Hàm này nên trả về số byte dữ liệu thực sự được đặt trong bộ đệm `page`, giống như phương thức *read* thực hiện đối với các tệp khác. Các giá trị đầu ra khác là `*eof` và `*start`. `eof` là một cờ (flag) đơn giản, nhưng việc sử dụng giá trị `start` có phần phức tạp hơn; mục đích của nó là giúp triển khai các tệp */proc* lớn (lớn hơn một trang).

Tham số `start` có cách sử dụng hơi phi truyền thống. Mục đích của nó là chỉ ra vị trí (trong `page`) tìm thấy dữ liệu sẽ được trả về cho người dùng. Khi phương thức *proc\_read* của bạn được gọi, `*start` sẽ là `NULL`. Nếu bạn để nó là `NULL`, kernel giả định rằng dữ liệu đã được đưa vào `page` như thể `offset` bằng 0; nói cách khác, nó giả định một phiên bản đơn giản của *proc\_read*, đặt toàn bộ nội dung của tệp ảo (virtual file) vào `page` mà không chú ý đến tham số `offset`. Ngược lại, nếu bạn đặt `*start` thành một giá trị khác `NULL`, kernel giả định rằng dữ liệu được trỏ bởi `*start` đã tính đến `offset` và sẵn sàng được trả về trực tiếp cho người dùng. Nhìn chung, các phương thức *proc\_read* đơn giản trả về lượng dữ liệu rất nhỏ sẽ bỏ qua `start`. Các phương thức phức tạp hơn sẽ đặt `*start` thành `page` và chỉ đặt dữ liệu bắt đầu từ `offset` được yêu cầu ở đó.

Từ lâu đã có một vấn đề lớn khác với các tệp */proc*, mà `*start` cũng nhằm giải quyết. Đôi khi biểu diễn ASCII của các cấu trúc dữ liệu kernel thay đổi giữa các lần gọi liên tiếp tới *read*, vì vậy tiến trình đọc có thể tìm thấy dữ liệu không nhất quán từ lần gọi này sang lần gọi khác. Nếu `*start` được đặt thành một giá trị số nguyên nhỏ, tiến trình gọi sẽ sử dụng nó để

tăng `filp->f_pos` một cách độc lập với lượng dữ liệu bạn trả về, do đó làm cho `f_pos` trở thành một số bản ghi nội bộ trong quy trình *read\_proc* của bạn. Ví dụ, nếu hàm *read\_proc* của bạn đang trả về thông tin từ một mảng cấu trúc lớn và năm trong số các cấu trúc đó đã được trả về trong lần gọi đầu tiên, `*start` có thể được đặt thành 5. Lần gọi tiếp theo cung cấp cùng một giá trị đó làm offset; khi đó driver biết phải bắt đầu trả về dữ liệu từ cấu trúc thứ sáu trong mảng. Điều này được thừa nhận là một "mẹo kỹ thuật" (hack) bởi các tác giả của nó và có thể được nhìn thấy trong *fs/proc/generic.c*.

Lưu ý rằng có một cách tốt hơn để triển khai các tệp */proc* lớn; nó được gọi là `seq_file`, và chúng ta sẽ thảo luận về nó ngay sau đây. Tuy nhiên, trước tiên, đã đến lúc xem xét một ví dụ. Dưới đây là một triển khai *read\_proc* đơn giản (có phần thô sơ) cho thiết bị *scull*:

```c
int scull_read_procmem(char *buf, char **start, off_t offset,
 int count, int *eof, void *data)
{
 int i, j, len = 0;
 int limit = count - 80; /* Không in nhiều hơn mức này */
 for (i = 0; i < scull_nr_devs && len <= limit; i++) {
 struct scull_dev *d = &scull_devices[i];
 struct scull_qset *qs = d->data;
 if (down_interruptible(&d->sem))
 return -ERESTARTSYS;
 len += sprintf(buf+len,"\nDevice %i: qset %i, q %i, sz %li\n",
 i, d->qset, d->quantum, d->size);
 for (; qs && len <= limit; qs = qs->next) { /* quét danh sách */
 len += sprintf(buf + len, " item at %p, qset at %p\n",
 qs, qs->data);
 if (qs->data && !qs->next) /* chỉ đổ dữ liệu mục cuối cùng */
 for (j = 0; j < d->qset; j++) {
 if (qs->data[j])
 len += sprintf(buf + len,
 " % 4i: %8p\n",
 j, qs->data[j]);
 }
 }
 up(&scull_devices[i].sem);
 }
 *eof = 1;
 return len;
}
```

Đây là một triển khai *read\_proc* khá tiêu biểu. Nó giả định rằng sẽ không bao giờ cần tạo ra nhiều hơn một trang dữ liệu và do đó bỏ qua các giá trị `start` và `offset`. Tuy nhiên, nó cẩn thận để không làm tràn bộ đệm (buffer overflow) của mình, chỉ để đề phòng.

### Một giao diện cũ hơn

Nếu bạn đọc qua mã nguồn (kernel source) của Linux Kernel, bạn có thể bắt gặp mã thực thi các tệp */proc* bằng một giao diện cũ hơn:

```
int (*get_info)(char *page, char **start, off_t offset, int count);
```

Tất cả các tham số đều có ý nghĩa giống như đối với *read\_proc*, nhưng các tham số eof và data bị thiếu. Giao diện này vẫn được hỗ trợ, nhưng nó có thể bị loại bỏ trong tương lai; mã mới nên sử dụng giao diện *read\_proc* thay thế.

### Tạo tệp /proc của bạn

Một khi bạn đã định nghĩa một hàm *read\_proc*, bạn cần liên kết nó với một mục (entry) trong hệ thống phân cấp của */proc*. Việc này được thực hiện thông qua lệnh gọi *create\_proc\_read\_entry*:

```
struct proc_dir_entry *create_proc_read_entry(const char *name,
 mode_t mode, struct proc_dir_entry *base,
 read_proc_t *read_proc, void *data);
```

Ở đây, name là tên của tệp cần tạo, mode là mặt nạ bảo vệ (protection mask) cho tệp (có thể truyền giá trị 0 để sử dụng mặc định toàn hệ thống), base chỉ định thư mục mà tệp sẽ được tạo trong đó (nếu base là NULL, tệp sẽ được tạo tại thư mục gốc của */proc*), *read\_proc* là hàm *read\_proc* thực thi tệp, và data bị bỏ qua bởi Kernel (nhưng được truyền cho hàm *read\_proc*). Dưới đây là lệnh gọi được sử dụng bởi *scull* để cung cấp hàm */proc* của nó dưới dạng */proc/scullmem*:

```
create_proc_read_entry("scullmem", 0 /* default mode */,
 NULL /* parent dir */, scull_read_procmem,
 NULL /* client data */);
```

Ở đây, chúng ta tạo một tệp có tên là *scullmem* nằm trực tiếp dưới */proc*, với các quyền bảo vệ mặc định và cho phép mọi người đọc (world-readable).

Con trỏ mục thư mục (directory entry pointer) có thể được sử dụng để tạo toàn bộ hệ thống phân cấp thư mục dưới */proc*. Tuy nhiên, cần lưu ý rằng một mục có thể được đặt trong một thư mục con của */proc* một cách dễ dàng hơn bằng cách chỉ cần cung cấp tên thư mục như một phần trong tên của mục—miễn là bản thân thư mục đó đã tồn tại. Ví dụ, một quy ước (thường bị bỏ qua) cho biết rằng các mục */proc* liên quan đến các trình điều khiển thiết bị (device driver) nên được đặt trong thư mục con *driver/*; *scull* có thể đặt mục của nó ở đó chỉ bằng cách cung cấp tên của nó là *driver/scullmem*.

Các mục trong */proc*, tất nhiên, phải được gỡ bỏ khi module bị gỡ tải (unloaded). *remove\_proc\_entry* là hàm hoàn tác những gì mà *create\_proc\_read\_entry* đã thực hiện trước đó:

```
remove_proc_entry("scullmem", NULL /* parent dir */);
```

Việc không gỡ bỏ các mục có thể dẫn đến các lệnh gọi vào những thời điểm không mong muốn, hoặc, nếu module của bạn đã bị gỡ tải, sẽ gây ra sự cố treo hạt nhân (kernel crash).

Khi sử dụng các tệp */proc* như đã minh họa, bạn phải ghi nhớ một số điểm phiền phức của quá trình triển khai—không có gì ngạc nhiên khi việc sử dụng nó không được khuyến khích trong thời gian gần đây.

Vấn đề quan trọng nhất nằm ở việc gỡ bỏ các mục */proc*. Việc gỡ bỏ này hoàn toàn có thể xảy ra trong khi tệp đang được sử dụng, vì không có chủ sở hữu (owner) nào được liên kết với các mục */proc*, do đó việc sử dụng chúng không làm thay đổi bộ đếm tham chiếu (reference count) của module. Vấn đề này có thể dễ dàng được kích hoạt bằng cách chạy lệnh *sleep 100 < /proc/myfile* ngay trước khi gỡ bỏ module chẳng hạn.

Một vấn đề khác liên quan đến việc đăng ký hai mục có cùng tên. Kernel tin tưởng trình điều khiển (driver) và không kiểm tra xem tên đó đã được đăng ký hay chưa, vì vậy nếu bạn không cẩn thận, bạn có thể kết thúc với hai hoặc nhiều mục có cùng tên. Đây là một vấn đề đã được ghi nhận xảy ra trong môi trường lớp học, và các mục như vậy không thể phân biệt được, cả khi bạn truy cập chúng lẫn khi bạn gọi hàm *remove\_proc\_entry*.

### Giao diện seq\_file

Như chúng ta đã lưu ý ở trên, việc triển khai các tệp lớn trong */proc* có phần phức tạp. Theo thời gian, các phương thức */proc* đã trở nên tai tiếng với các cách triển khai dễ sinh lỗi khi lượng đầu ra tăng lớn. Như một cách để dọn dẹp mã nguồn */proc* và giúp các lập trình viên kernel dễ thở hơn, giao diện `seq_file` đã được bổ sung. Giao diện này cung cấp một tập hợp các hàm đơn giản để triển khai các tệp ảo kernel lớn.

Giao diện `seq_file` giả định rằng bạn đang tạo một tệp ảo duyệt qua một chuỗi các mục (sequence of items) cần được trả về không gian người dùng (user space). Để sử dụng `seq_file`, bạn phải tạo một đối tượng "trợ vòng lặp" (iterator) đơn giản có khả năng thiết lập một vị trí trong chuỗi, bước tới trước (step forward) và xuất ra một mục trong chuỗi đó. Nghe có vẻ phức tạp, nhưng thực tế, quá trình này khá đơn giản. Chúng ta sẽ cùng đi qua các bước tạo một tệp */proc* trong trình điều khiển (driver) *scull* để thấy cách nó được thực hiện.

Bước đầu tiên, tất nhiên là việc bao gồm tệp tiêu đề *<linux/seq\_file.h>*. Sau đó, bạn phải tạo bốn phương thức iterator, gọi là *start*, *next*, *stop* và *show*.

Phương thức *start* luôn được gọi đầu tiên. Nguyên mẫu (prototype) cho hàm này là:

```c
void *start(struct seq_file *sfile, loff_t *pos);
```

Đối số `sfile` hầu như luôn có thể được bỏ qua. `pos` là một vị trí số nguyên chỉ định nơi việc đọc bắt đầu. Việc diễn giải vị trí này hoàn toàn tùy thuộc vào cách triển khai của bạn; nó không nhất thiết phải là một vị trí byte trong tệp kết quả. Vì việc triển khai `seq_file` thường bước qua một chuỗi các mục quan trọng, vị trí thường được diễn giải như một con trỏ (cursor) trỏ đến mục tiếp theo trong chuỗi. Trình điều khiển *scull* coi mỗi thiết bị là một mục trong chuỗi, do đó `pos` đầu vào đơn giản là một chỉ mục (index) trỏ vào mảng `scull_devices`. Do đó, phương thức *start* được sử dụng trong *scull* là:

```c
static void *scull_seq_start(struct seq_file *s, loff_t *pos)
{
 if (*pos >= scull_nr_devs)
 return NULL; /* Không còn gì để đọc */
 return scull_devices + *pos;
}
```

Giá trị trả về, nếu khác NULL, là một giá trị riêng tư (private value) có thể được sử dụng bởi quá trình triển khai iterator.

Hàm *next* sẽ di chuyển iterator đến vị trí tiếp theo, trả về `NULL` nếu không còn mục nào trong chuỗi. Nguyên mẫu của phương thức này là:

```c
void *next(struct seq_file *sfile, void *v, loff_t *pos);
```

Ở đây, `v` là iterator được trả về từ lệnh gọi trước đó tới *start* hoặc *next*, và `pos` là vị trí hiện tạitrong tệp. *next* nên tăng giá trị được trỏ tới bởi `pos`; tùy thuộc vào cách hoạt động của iterator, bạn có thể (dù có lẽ là không) muốn tăng `pos` lên nhiều hơn một. Đây là những gì *scull* thực hiện:

```c
static void *scull_seq_next(struct seq_file *s, void *v, loff_t *pos)
{
 (*pos)++;
 if (*pos >= scull_nr_devs)
 return NULL;
 return scull_devices + *pos;
}
```

Khi kernel hoàn tất việc xử lý iterator, nó sẽ gọi *stop* để dọn dẹp:

```c
void stop(struct seq_file *sfile, void *v);
```

Việc triển khai của *scull* không có công việc dọn dẹp nào cần làm, vì vậy phương thức *stop* của nó để trống.

Cần lưu ý rằng mã nguồn `seq_file`, theo thiết kế, không thực hiện sleep (dừng tiến trình) hoặc thực hiện các tác vụ không nguyên tử (nonatomic tasks) giữa các lệnh gọi *start* và *stop*. Bạn cũng được đảm bảo sẽ nhận được một lệnh gọi *stop* ngay sau lệnh gọi *start*. Do đó, việc phương thức *start* của bạn lấy semaphore hoặc spinlock là hoàn toàn an toàn. Miễn là các phương thức `seq_file` khác của bạn là nguyên tử (atomic), toàn bộ chuỗi các lệnh gọi sẽ mang tính nguyên tử. (Nếu đoạn này không có ý nghĩa với bạn, hãy quay lại đọc nó sau khi bạn đã đọc chương tiếp theo).

Giữa các lệnh gọi này, kernel gọi phương thức *show* để thực sự xuất ra một cái gì đó hữu ích cho không gian người dùng (user space). Nguyên mẫu của phương thức này là:

```c
int show(struct seq_file *sfile, void *v);
```

Phương thức này nên tạo ra đầu ra cho mục trong chuỗi được chỉ ra bởi iterator `v`. Tuy nhiên, nó không nên sử dụng *printk*; thay vào đó, có một tập hợp các hàm đặc biệt dành cho đầu ra của `seq_file`:

```c
int seq_printf(struct seq_file *sfile, const char *fmt, ...);
```

Đây là hàm tương đương với *printf* dành cho các cách triển khai `seq_file`; nó nhận chuỗi định dạng thông thường và các đối số giá trị bổ sung. Tuy nhiên, bạn cũng phải truyền cho nó cấu trúc `seq_file` được cung cấp cho hàm *show*. Nếu *seq\_printf* trả về một giá trị khác 0, điều đó có nghĩa là bộ đệm (buffer) đã đầy và đầu ra đang bị loại bỏ. Tuy nhiên, hầu hết các cách triển khai đều bỏ qua giá trị trả về này.

```c
int seq_putc(struct seq_file *sfile, char c);
int seq_puts(struct seq_file *sfile, const char *s);
```

Đây là các hàm tương đương với các hàm *putc* và *puts* trong không gian người dùng.

`int seq_escape(struct seq_file *m, const char *s, const char *esc);`

Hàm này tương đương với *seq\_puts* với ngoại lệ là bất kỳ ký tự nào trong `s` cũng được tìm thấy trong `esc` sẽ được in ra ở định dạng bát phân (octal format). Giá trị phổ biến cho `esc` là `" \t\n\\"`, giúp ngăn các khoảng trắng được nhúng làm hỏng đầu ra và có khả năng làm rối các tập lệnh shell.

```c
int seq_path(struct seq_file *sfile, struct vfsmount *m, struct dentry
 *dentry, char *esc);
```

Hàm này có thể được sử dụng để xuất ra tên tệp liên kết với một mục nhập thư mục (directory entry) cho trước. Nó không có nhiều hữu ích trong các trình điều khiển thiết bị (device drivers); chúng tôi đưa nó vào đây để tính trọn vẹn của tài liệu.

Quay lại với ví dụ của chúng tôi; phương thức *show* được sử dụng trong *scull* là:

```c
static int scull_seq_show(struct seq_file *s, void *v)
{
 struct scull_dev *dev = (struct scull_dev *) v;
 struct scull_qset *d;
 int i;
 if (down_interruptible(&dev->sem))
 return -ERESTARTSYS;
 seq_printf(s, "\nDevice %i: qset %i, q %i, sz %li\n",
 (int) (dev - scull_devices), dev->qset,
 dev->quantum, dev->size);
 for (d = dev->data; d; d = d->next) { /* quét danh sách */
 seq_printf(s, " item at %p, qset at %p\n", d, d->data);
 if (d->data && !d->next) /* chỉ đổ dữ liệu mục cuối cùng */
 for (i = 0; i < dev->qset; i++) {
 if (d->data[i])
 seq_printf(s, " % 4i: %8p\n",
 i, d->data[i]);
 }
 }
 up(&dev->sem);
 return 0;
}
```

Ở đây, cuối cùng chúng ta cũng diễn giải giá trị "iterator" (bộ lặp) của mình, vốn đơn giản là một con trỏ trỏ tới cấu trúc scull\_dev.

Bây giờ khi đã có một tập hợp đầy đủ các thao tác bộ lặp (iterator operations), *scull* phải đóng gói chúng lại và kết nối chúng với một tệp trong */proc*. Bước đầu tiên được thực hiện bằng cách điền thông tin vào cấu trúc seq\_operations:

```c
static struct seq_operations scull_seq_ops = {
 .start = scull_seq_start,
 .next = scull_seq_next,
 .stop = scull_seq_stop,
 .show = scull_seq_show
};
```

Với cấu trúc đó đã được thiết lập, chúng ta phải tạo một phần cài đặt tệp mà kernel (nhân hệ điều hành) hiểu được. Chúng ta không sử dụng phương thức *read\_proc* đã mô tả trước đó; khi sử dụng seq\_file, tốt nhất là kết nối vào */proc* ở một tầng thấp hơn một chút. Điều đó có nghĩa là tạo ra một cấu trúc file\_operations (vâng, chính là cấu trúc được sử dụng cho các char driver - trình điều khiển thiết bị ký tự) để thực thi tất cả các thao tác mà kernel cần để xử lý các lệnh đọc (read) và tìm kiếm (seek) trên

**Debugging by Querying | 89**

tệp. May mắn thay, công việc này khá đơn giản. Bước đầu tiên là tạo một phương thức *open* để kết nối tệp với các thao tác của seq\_file:

```c
static int scull_proc_open(struct inode *inode, struct file *file)
{
 return seq_open(file, &scull_seq_ops);
}
```

Lời gọi đến *seq\_open* sẽ kết nối cấu trúc file với các thao tác chuỗi (sequence operations) của chúng ta đã định nghĩa ở trên. Hóa ra, *open* là phương thức tệp duy nhất mà chúng ta phải tự triển khai, vì vậy giờ đây chúng ta có thể thiết lập cấu trúc file\_operations của mình:

```c
static struct file_operations scull_proc_ops = {
 .owner = THIS_MODULE,
 .open = scull_proc_open,
 .read = seq_read,
 .llseek = seq_lseek,
 .release = seq_release
};
```

Ở đây chúng ta chỉ định phương thức *open* của riêng mình, nhưng sử dụng các phương thức có sẵn (canned methods) là *seq\_read*, *seq\_lseek* và *seq\_release* cho mọi thứ còn lại.

Bước cuối cùng là tạo tệp thực tế trong */proc*:

```c
entry = create_proc_entry("scullseq", 0, NULL);
if (entry)
 entry->proc_fops = &scull_proc_ops;
```

Thay vì sử dụng *create\_proc\_read\_entry*, chúng ta gọi hàm *create\_proc\_entry* ở tầng thấp hơn, có nguyên mẫu (prototype) như sau:

```c
struct proc_dir_entry *create_proc_entry(const char *name,
 mode_t mode,
 struct proc_dir_entry *parent);
```

Các tham số tương tự như các tham số tương đương trong *create\_proc\_read\_entry*: tên của tệp, quyền bảo vệ tệp (permissions), và thư mục cha (parent directory).

Với đoạn mã trên, *scull* đã có một mục nhập */proc* mới trông rất giống với mục nhập trước đó. Tuy nhiên, nó vượt trội hơn ở chỗ nó hoạt động bất kể đầu ra của nó lớn đến mức nào, nó xử lý các lệnh seek một cách chính xác, và nhìn chung là dễ đọc và dễ duy trì (maintain) hơn. Chúng tôi khuyên dùng seq\_file để triển khai các tệp chứa nhiều hơn một số lượng dòng đầu ra rất nhỏ.

```

### Phương thức ioctl

*ioctl*, hàm mà chúng ta đã tìm hiểu cách sử dụng trong Chương 1, là một System Call (lệnh gọi hệ thống) tác động lên một File Descriptor (mô tả tệp); nó nhận một số định danh lệnh cần thực hiện và (tùy chọn) một đối số khác, thường là một con trỏ. Như một giải pháp thay thế cho việc sử dụng hệ thống tệp */proc*, bạn có thể triển khai một vài lệnh *ioctl* được thiết kế riêng cho việc gỡ lỗi (debugging). Các lệnh này có thể sao chép các cấu trúc dữ liệu liên quan từ driver sang User Space (không gian người dùng), nơi bạn có thể kiểm tra chúng.

Sử dụng *ioctl* theo cách này để lấy thông tin có phần khó hơn một chút so với việc sử dụng */proc*, bởi vì bạn cần một chương trình khác để gọi *ioctl* và hiển thị kết quả. Chương trình này phải được viết, biên dịch và duy trì sự đồng bộ với module mà bạn đang kiểm thử. Mặt khác, mã nguồn ở phía driver có thể đơn giản hơn những gì cần thiết để triển khai một tệp */proc*.

Có những thời điểm mà *ioctl* là cách tốt nhất để lấy thông tin, bởi vì nó chạy nhanh hơn việc đọc */proc*. Nếu một số công việc cần phải được thực hiện trên dữ liệu trước khi nó được ghi lên màn hình, việc truy xuất dữ liệu dưới dạng nhị phân (binary) sẽ hiệu quả hơn so với việc đọc một tệp văn bản. Ngoài ra, *ioctl* không yêu cầu phải chia nhỏ dữ liệu thành các đoạn nhỏ hơn một trang (page).

Một ưu điểm thú vị khác của phương pháp *ioctl* là các lệnh truy xuất thông tin có thể được giữ lại trong driver ngay cả khi tính năng gỡ lỗi bị vô hiệu hóa. Không giống như tệp */proc*, vốn hiển thị với bất kỳ ai nhìn vào thư mục (và có quá nhiều người có khả năng tự hỏi "tệp kỳ lạ đó là gì"), các lệnh *ioctl* không có tài liệu (undocumented) có khả năng vẫn không bị chú ý. Thêm vào đó, chúng vẫn sẽ ở đó nếu có điều gì kỳ lạ xảy ra với driver. Nhược điểm duy nhất là kích thước của module sẽ lớn hơn một chút.

## Gỡ lỗi bằng cách Theo dõi (Debugging by Watching)

Đôi khi các vấn đề nhỏ có thể được tìm ra bằng cách theo dõi hành vi của một ứng dụng ở User Space. Việc theo dõi các chương trình cũng có thể giúp củng cố niềm tin rằng một driver đang hoạt động chính xác. Ví dụ, chúng ta đã có thể cảm thấy tự tin về *scull* sau khi xem xét cách thức triển khai hàm *read* của nó phản hồi lại các yêu cầu đọc với các lượng dữ liệu khác nhau.

Có nhiều cách khác nhau để theo dõi một chương trình hoạt động ở User Space. Bạn có thể chạy một trình gỡ lỗi (debugger) trên chương trình đó để đi qua từng hàm của nó, thêm các câu lệnh in (print statements), hoặc chạy chương trình dưới công cụ *strace*. Ở đây chúng ta sẽ chỉ thảo luận về kỹ thuật cuối cùng, đây là kỹ thuật thú vị nhất khi mục tiêu thực sự là kiểm tra mã nguồn Kernel Space (không gian kernel).

Lệnh *strace* là một công cụ mạnh mẽ hiển thị tất cả các System Call được thực hiện bởi một chương trình ở User Space. Nó không chỉ hiển thị các lời gọi mà còn có thể hiển thị các đối số của các lời gọi đó và giá trị trả về của chúng dưới dạng ký hiệu. Khi một System Call thất bại, cả giá trị ký hiệu của lỗi (ví dụ: ENOMEM) và chuỗi tương ứng (Out of memory) đều được hiển thị. *strace* có nhiều tùy chọn dòng lệnh; hữu ích nhất trong số đó là *-t* để hiển thị thời điểm *khi nào* mỗi lời gọi được thực thi, *-T* để hiển thị thời gian tiêu tốn trong lời gọi, *-e* để giới hạn các loại lời gọi được theo dõi, và *-o* để chuyển hướng đầu ra vào một tệp. Theo mặc định, *strace* in thông tin theo dõi ra luồng lỗi chuẩn stderr.

*strace* nhận thông tin trực tiếp từ chính kernel. Điều này có nghĩa là một chương trình có thể được theo dõi bất kể nó có được biên dịch với hỗ trợ gỡ lỗi hay không (tùy chọn *-g* của *gcc*) và bất kể nó có bị lược bỏ các ký hiệu (stripped) hay không. Bạn cũng có thể gắn việc theo dõi vào một tiến trình đang chạy (running process), tương tự như cách một trình gỡ lỗi có thể kết nối với một tiến trình đang chạy và điều khiển nó.

Thông tin theo dõi thường được sử dụng để hỗ trợ các báo cáo lỗi được gửi cho các nhà phát triển ứng dụng, nhưng nó cũng vô giá đối với các lập trình viên kernel. Chúng ta đã thấy mã nguồn driver thực thi như thế nào bằng cách phản ứng với các System Call; *strace* cho phép chúng ta kiểm tra tính nhất quán của dữ liệu đầu vào và đầu ra của mỗi lời gọi.

Ví dụ, đoạn kết quả hiển thị trên màn hình sau đây cho thấy (phần lớn) các dòng cuối cùng khi chạy lệnh *strace ls /dev > /dev/scull0*:

```c

open("/dev", O_RDONLY|O_NONBLOCK|O_LARGEFILE|O_DIRECTORY) = 3
fstat64(3, {st_mode=S_IFDIR|0755, st_size=24576, ...}) = 0
fcntl64(3, F_SETFD, FD_CLOEXEC) = 0
getdents64(3, /* 141 entries */, 4096) = 4088
[...]
getdents64(3, /* 0 entries */, 4096) = 0
close(3) = 0
[...]
fstat64(1, {st_mode=S_IFCHR|0664, st_rdev=makedev(254, 0), ...}) = 0
write(1, "MAKEDEV\nadmmidi0\nadmmidi1\nadmmid"..., 4096) = 4000
write(1, "b\nptywc\nptywd\nptywe\nptywf\nptyx0\n"..., 96) = 96
write(1, "b\nptyxc\nptyxd\nptyxe\nptyxf\nptyy0\n"..., 4096) = 3904
write(1, "s17\nvcs18\nvcs19\nvcs2\nvcs20\nvcs21"..., 192) = 192
write(1, "\nvcs47\nvcs48\nvcs49\nvcs5\nvcs50\nvc"..., 673) = 673
close(1) = 0
exit_group(0) = ?

```

Rõ ràng từ lời gọi *write* đầu tiên rằng sau khi *ls* hoàn tất việc tìm kiếm trong thư mục đích, nó đã cố gắng ghi 4 KB. Một cách kỳ lạ (đối với *ls*), chỉ có 4000 byte được ghi, và thao tác đã được thử lại. Tuy nhiên, chúng ta biết rằng việc triển khai hàm *write* trong *scull* chỉ ghi một lượng tử (quantum) tại một thời điểm, vì vậy chúng ta có thể dự đoán trước việc ghi một phần (partial write) này. Sau một vài bước, mọi thứ đều trôi qua và chương trình thoát thành công.

Như một ví dụ khác, hãy *đọc* thiết bị *scull* (sử dụng lệnh *wc*):

```

[...]
open("/dev/scull0", O_RDONLY|O_LARGEFILE) = 3
fstat64(3, {st_mode=S_IFCHR|0664, st_rdev=makedev(254, 0), ...}) = 0
read(3, "MAKEDEV\nadmmidi0\nadmmidi1\nadmmid"..., 16384) = 4000
read(3, "b\nptywc\nptywd\nptywe\nptywf\nptyx0\n"..., 16384) = 4000
read(3, "s17\nvcs18\nvcs19\nvcs2\nvcs20\nvcs21"..., 16384) = 865
read(3, "", 16384) = 0
fstat64(1, {st_mode=S_IFCHR|0620, st_rdev=makedev(136, 1), ...}) = 0
write(1, "8865 /dev/scull0\n", 17) = 17
close(3) = 0
exit_group(0) = ?

```

Đúng như dự đoán, *read* chỉ có thể truy xuất 4000 byte mỗi lần, nhưng tổng lượng dữ liệu thì hoàn toàn giống với lượng dữ liệu đã được ghi trong ví dụ trước. Thật thú vị khi quan sát cách các thao tác thử lại (retry) được tổ chức trong ví dụ này, trái ngược với bản vết (trace) trước đó. *wc* được tối ưu hóa cho việc đọc nhanh và do đó, nó bỏ qua thư viện chuẩn (standard library), cố gắng đọc nhiều dữ liệu hơn chỉ với một System Call duy nhất. Bạn có thể thấy từ các dòng *read* trong bản vết cách mà *wc* cố gắng đọc 16 KB mỗi lần.

Các chuyên gia Linux có thể tìm thấy rất nhiều thông tin hữu ích trong đầu ra của *strace*. Nếu bạn cảm thấy bối rối bởi tất cả các ký hiệu này, bạn có thể tự giới hạn bản thân bằng cách quan sát cách các phương thức tập tin (*open*, *read*, v.v.) hoạt động với cờ efile.

Cá nhân chúng tôi thấy *strace* hữu ích nhất trong việc xác định chính xác các lỗi thời điểm chạy (runtime error) từ các System Call. Thường thì lệnh gọi *perror* trong ứng dụng hoặc chương trình demo không đủ chi tiết để hữu ích cho việc gỡ lỗi (debugging), và việc có thể biết chính xác đối số nào truyền vào System Call nào đã gây ra lỗi sẽ là một trợ giúp lớn.

## Gỡ lỗi Lỗi Hệ thống (Debugging System Faults)
Ngay cả khi bạn đã sử dụng tất cả các kỹ thuật theo dõi và gỡ lỗi, đôi khi các lỗi vẫn còn sót lại trong driver, và hệ thống sẽ xảy ra lỗi (fault) khi driver được thực thi. Khi điều này xảy ra, điều quan trọng là phải thu thập càng nhiều thông tin càng tốt để giải quyết vấn đề.

Lưu ý rằng "fault" không có nghĩa là "panic". Mã nguồn Linux đủ mạnh mẽ (robust) để phản ứng một cách uyển chuyển với hầu hết các lỗi: một lỗi fault thường dẫn đến việc tiến trình (Process) hiện tại bị hủy diệt trong khi hệ thống vẫn tiếp tục hoạt động. Hệ thống *có thể* xảy ra panic, và điều đó có thể xảy ra nếu một lỗi xảy ra bên ngoài ngữ cảnh của tiến trình (Process's context) hoặc nếu một phần quan trọng nào đó của hệ thống bị tổn hại. Nhưng khi vấn đề là do lỗi của driver, nó thường chỉ dẫn đến cái chết đột ngột của tiến trình không may đang sử dụng driver đó. Thiệt hại duy nhất không thể khôi phục khi một tiến trình bị hủy là một số bộ nhớ được cấp phát cho ngữ cảnh của tiến trình đó sẽ bị mất; ví dụ, các danh sách động (dynamic list) được cấp phát bởi driver thông qua *kmalloc* có thể bị mất. Tuy nhiên, vì kernel gọi thao tác *close* cho bất kỳ thiết bị nào đang mở khi một tiến trình chết, driver của bạn có thể giải phóng những gì đã được cấp phát bởi phương thức *open*.

Mặc dù một sự cố oops thường không làm sập toàn bộ hệ thống, bạn vẫn có thể thấy mình cần phải khởi động lại (reboot) sau khi nó xảy ra. Một driver chứa lỗi có thể để lại phần cứng ở trạng thái không thể sử dụng, để lại tài nguyên kernel ở trạng thái không nhất quán, hoặc tệ nhất là làm hỏng bộ nhớ kernel ở các vị trí ngẫu nhiên. Thông thường, bạn có thể đơn giản gỡ bỏ (unload) driver bị lỗi của mình và thử lại sau khi xảy ra oops. Tuy nhiên, nếu bạn thấy bất kỳ dấu hiệu nào cho thấy toàn bộ hệ thống không ổn định, lựa chọn tốt nhất thường là khởi động lại ngay lập tức.

Chúng tôi đã nói rằng khi mã nguồn kernel hoạt động bất thường, một thông báo mang tính thông tin sẽ được in ra bảng điều khiển (console). Phần tiếp theo giải thích cách giải mã và sử dụng các thông báo đó. Mặc dù chúng có vẻ khá khó hiểu đối với người mới bắt đầu, nhưng các bản kết xuất bộ nhớ của bộ xử lý (processor dump) chứa đầy thông tin thú vị, thường là đủ để xác định chính xác lỗi chương trình mà không cần thêm các bài kiểm tra bổ sung.

### Thông điệp Oops (Oops Messages)
Hầu hết các lỗi (bug) tự bộc lộ thông qua việc tham chiếu con trỏ NULL (NULL pointer dereference) hoặc sử dụng các giá trị con trỏ không hợp lệ khác. Kết quả thông thường của các lỗi như vậy là một thông điệp oops (oops message).

Hầu như bất kỳ địa chỉ nào được bộ vi xử lý (processor) sử dụng đều là địa chỉ ảo (virtual address) và được ánh xạ tới các địa chỉ vật lý thông qua một cấu trúc phức tạp gồm các bảng trang (page table) (ngoại trừ các địa chỉ vật lý được sử dụng bởi chính hệ thống con quản lý bộ nhớ - memory management subsystem). Khi một con trỏ không hợp lệ bị tham chiếu, cơ chế phân trang (paging mechanism) không thể ánh xạ con trỏ tới một địa chỉ vật lý, và bộ vi xử lý phát tín hiệu *lỗi trang* (*page fault*) tới hệ điều hành. Nếu địa chỉ đó không hợp lệ, kernel không thể "nạp trang" (*page in*) địa chỉ bị thiếu đó; nó (thường) sẽ tạo ra một oops nếu hiện tượng này xảy ra khi bộ vi xử lý đang ở chế độ giám sát (supervisor mode).

Một thông điệp oops hiển thị trạng thái của bộ vi xử lý tại thời điểm xảy ra lỗi, bao gồm nội dung của các thanh ghi CPU (CPU register) và các thông tin có vẻ khó hiểu khác. Thông điệp này được tạo ra bởi các câu lệnh *printk* trong trình xử lý lỗi (*arch/\*/kernel/traps.c*) và được phân phối như đã mô tả trước đó trong phần "printk".

Hãy cùng xem xét một thông điệp như vậy. Dưới đây là kết quả từ việc tham chiếu một con trỏ NULL trên một máy tính cá nhân (PC) chạy kernel Phiên bản 2.6. Thông tin quan trọng nhất ở đây là con trỏ lệnh (EIP - instruction pointer), địa chỉ của câu lệnh gây ra lỗi.

```

Unable to handle kernel NULL pointer dereference at virtual address 00000000
printing eip:
d083a064
Oops: 0002 [#1]
SMP
CPU: 0
EIP: 0060:[<d083a064>] Not tainted
EFLAGS: 00010246 (2.6.6)
EIP is at faulty_write+0x4/0x10 [faulty]
eax: 00000000 ebx: 00000000 ecx: 00000000 edx: 00000000
esi: cf8b2460 edi: cf8b2480 ebp: 00000005 esp: c31c5f74
ds: 007b es: 007b ss: 0068
Process bash (pid: 2086, threadinfo=c31c4000 task=cfa0a6c0)
Stack: c0150558 cf8b2460 080e9408 00000005 cf8b2480 00000000 cf8b2460 cf8b2460
fffffff7 080e9408 c31c4000 c0150682 cf8b2460 080e9408 00000005 cf8b2480
00000000 00000001 00000005 c0103f8f 00000001 080e9408 00000005 00000005
Call Trace:
[<c0150558>] vfs_write+0xb8/0x130
[<c0150682>] sys_write+0x42/0x70
[<c0103f8f>] syscall_call+0x7/0xb

```

Thông điệp này được tạo ra bằng cách ghi vào một thiết bị thuộc sở hữu của module *faulty*, một module được xây dựng có chủ đích để minh họa các lỗi. Việc triển khai phương thức *write* của *faulty.c* rất đơn giản:

Code: 89 15 00 00 00 00 c3 90 8d 74 26 00 83 ec 0c b8 00 a6 83 d0

```

ssize_t faulty_write (struct file *filp, const char __user *buf, size_t count,
loff_t *pos)
{

```

```

/* tạo một lỗi đơn giản bằng cách tham chiếu con trỏ NULL */
*(int *)0 = 0;
return 0;
}

```

Như bạn có thể thấy, những gì chúng ta làm ở đây là tham chiếu một con trỏ NULL. Vì 0 không bao giờ là một giá trị con trỏ hợp lệ, một lỗi (fault) xảy ra, mà kernel biến đổi thành thông điệp oops được hiển thị ở trên. Tiến trình gọi (calling process) sau đó bị tiêu diệt (killed).

Module *faulty* có một điều kiện lỗi khác trong phần triển khai hàm *read* của nó:

```

ssize_t faulty_read(struct file *filp, char __user *buf,
size_t count, loff_t *pos)
{
int ret;
char stack_buf[4];
/* Hãy thử tràn bộ đệm stack (buffer overflow) */
memset(stack_buf, 0xff, 20);
if (count > 4)
count = 4; /* sao chép 4 byte cho user */
ret = copy_to_user(buf, stack_buf, count);
if (!ret)
return count;
return ret;
}

```

Phương thức này sao chép một chuỗi vào một biến cục bộ (local variable); thật không may, chuỗi này dài hơn mảng đích. Việc tràn bộ đệm (buffer overflow) kết quả gây ra một oops khi hàm trả về (return). Vì lệnh trả về đưa con trỏ lệnh (instruction pointer) đến một vùng đất vô định, loại lỗi này khó truy vết hơn rất nhiều và bạn có thể nhận được một kết quả đại loại như sau:

```

EIP: 0010:[<00000000>]
Unable to handle kernel paging request at virtual address ffffffff
printing eip:
ffffffff
Oops: 0000 [#5]
SMP
CPU: 0
EIP: 0060:[<ffffffff>] Not tainted
EFLAGS: 00010296 (2.6.6)
EIP is at 0xffffffff
eax: 0000000c ebx: ffffffff ecx: 00000000 edx: bfffda7c
esi: cf434f00 edi: ffffffff ebp: 00002000 esp: c27fff78
ds: 007b es: 007b ss: 0068
Process head (pid: 2331, threadinfo=c27fe000 task=c3226150)
Stack: ffffffff bfffda70 00002000 cf434f20 00000001 00000286 cf434f00 fffffff7
bfffda70 c27fe000 c0150612 cf434f00 bfffda70 00002000 cf434f20 00000000
00000003 00002000 c0103f8f 00000003 bfffda70 00002000 00002000 bfffda70
Call Trace:
[<c0150612>] sys_read+0x42/0x70
[<c0103f8f>] syscall_call+0x7/0xb
Code: Bad EIP value.

```

Trong trường hợp này, chúng ta chỉ nhìn thấy một phần của stack gọi (*vfs\_read* và *faulty\_read* bị thiếu), và kernel phàn nàn về một "giá trị EIP kém" (*bad EIP value*). Lời phàn nàn đó, cùng với địa chỉ gây lỗi (ffffffff) được liệt kê ở phần đầu, đều là những manh mối cho thấy stack của kernel (kernel stack) đã bị hỏng (corrupted).

Nói chung, khi bạn đối mặt với một thông điệp oops, điều đầu tiên cần làm là xem xét vị trí xảy ra sự cố, thường được liệt kê tách biệt với stack gọi (call stack). Trong thông điệp oops đầu tiên hiển thị ở trên, dòng có liên quan là:

EIP is at faulty\_write+0x4/0x10 [faulty]

Ở đây, chúng ta thấy rằng chúng ta đang ở trong hàm *faulty\_write*, nằm trong module *faulty* (được liệt kê trong dấu ngoặc vuông). Các con số hệ thập lục phân (hex) cho biết con trỏ lệnh (instruction pointer) nằm ở offset 4 byte tính từ đầu hàm, và hàm này có độ dài 10 (hex) byte. Thường thì thông tin đó là đủ để tìm ra vấn đề là gì.

Nếu bạn cần thêm thông tin, call stack sẽ cho bạn biết cách bạn đi đến điểm xảy ra sự cố. Bản thân stack được in ở định dạng hex; với một chút nỗ lực, bạn thường có thể xác định các giá trị của biến cục bộ (local variable) và tham số hàm từ danh sách stack. Các lập trình viên kernel (kernel developer) giàu kinh nghiệm có thể tận dụng một mức độ nhận diện mẫu (pattern recognition) nào đó ở đây; ví dụ, nếu chúng ta nhìn vào danh sách stack từ lỗi oops của *faulty\_read*:

Stack: ffffffff bfffda70 00002000 cf434f20 00000001 00000286 cf434f00 fffffff7 bfffda70 c27fe000 c0150612 cf434f00 bfffda70 00002000 cf434f20 00000000 00000003 00002000 c0103f8f 00000003 bfffda70 00002000 00002000 bfffda70

Giá trị ffffffff ở đầu stack là một phần của chuỗi đã gây ra sự cố. Trên kiến trúc x86, theo mặc định, stack không gian người dùng (user-space stack) bắt đầu ngay bên dưới 0xc0000000; do đó, giá trị lặp lại 0xbfffda70 có thể là một địa chỉ stack không gian người dùng (user-space stack address); trên thực tế, đó chính là địa chỉ của bộ đệm (buffer) được truyền tới system call *read*, được nhân bản mỗi khi nó được truyền xuống chuỗi gọi kernel (kernel call chain). Trên x86 (lại một lần nữa, theo mặc định), không gian kernel (kernel space) bắt đầu từ 0xc0000000, vì vậy các giá trị lớn hơn mức đó hầu như chắc chắn là các địa chỉ không gian kernel (kernel-space address), v.v.

Cuối cùng, khi xem xét danh sách oops, hãy luôn cảnh giác với các giá trị "tẩm độc slab" (slab poisoning) đã được thảo luận ở phần đầu chương này. Do đó, ví dụ, nếu bạn nhận được một kernel oops mà địa chỉ gây lỗi là 0xa5a5a5a5, gần như chắc chắn bạn đã quên khởi tạo bộ nhớ động (dynamic memory) ở đâu đó.

Xin lưu ý rằng bạn chỉ nhìn thấy một call stack có ký hiệu (symbolic call stack) (như được hiển thị ở trên) nếu kernel của bạn được biên dịch với tùy chọn `CONFIG_KALLSYMS` được bật. Nếu không, bạn sẽ thấy một danh sách thô, hoàn toàn bằng hệ thập lục phân, sẽ ít hữu ích hơn rất nhiều cho đến khi bạn giải mã nó bằng các cách khác.

### Treo Hệ Thống (System Hangs)
Mặc dù hầu hết các lỗi trong mã nguồn kernel đều kết thông báo oops, đôi khi chúng có thể làm treo hoàn toàn hệ thống. Nếu hệ thống bị treo, không có thông báo nào được in ra. Ví dụ,

nếu đoạn mã bước vào một vòng lặp vô hạn (endless loop), kernel sẽ dừng lập lịch (schedule),\* và hệ thống không phản hồi với bất kỳ hành động nào, kể cả tổ hợp phím thần kỳ Ctrl-Alt-Del. Bạn có hai sự lựa chọn để đối phó với tình trạng treo hệ thống—hoặc ngăn chặn chúng trước hoặc có khả năng gỡ lỗi (debug) chúng sau khi sự việc đã xảy ra.

Bạn có thể ngăn chặn vòng lặp vô hạn bằng cách chèn các lời gọi *schedule* tại các điểm chiến lược. Lời gọi *schedule* (như bạn có thể đoán) sẽ gọi bộ lập lịch (scheduler) và do đó, cho phép các tiến trình khác cướp thời gian CPU từ tiến trình hiện tại. Nếu một tiến trình đang lặp trong không gian kernel (kernel space) do lỗi trong trình điều khiển (driver) của bạn, các lời gọi *schedule* sẽ cho phép bạn tiêu diệt (kill) tiến trình đó sau khi theo vết (trace) những gì đang xảy ra.

Tất nhiên, bạn nên lưu ý rằng bất kỳ lời gọi nào đến *schedule* cũng có thể tạo ra một nguồn bổ sung cho các lời gọi tái nhập (reentrant call) vào driver của bạn, vì nó cho phép các tiến trình khác chạy. Tính tái nhập (reentrancy) này thông thường không phải là vấn đề, giả sử rằng bạn đã sử dụng cơ chế khóa (locking) phù hợp trong driver của mình. Tuy nhiên, hãy đảm bảo rằng không gọi *schedule* vào bất kỳ thời điểm nào mà driver của bạn đang giữ một spinlock.

Nếu driver của bạn thực sự làm treo hệ thống và bạn không biết nên chèn các lời gọi *schedule* ở đâu, cách tốt nhất có thể là thêm một số thông báo in và ghi chúng ra console (bằng cách thay đổi giá trị *console\_loglevel* nếu cần).

Đôi khi hệ thống có vẻ như bị treo nhưng thực tế không phải vậy. Điều này có thể xảy ra, chẳng hạn như khi bàn phím bị khóa theo một cách kỳ lạ nào đó. Những hiện tượng treo giả này có thể được phát hiện bằng cách nhìn vào đầu ra của một chương trình mà bạn giữ chạy chỉ cho mục đích này. Đồng hồ hoặc bộ đo tải hệ thống trên màn hình của bạn là một trình giám sát trạng thái tốt; miễn là nó tiếp tục cập nhật, bộ lập lịch (scheduler) vẫn đang hoạt động.

Một công cụ không thể thiếu đối với nhiều trường hợp khóa hệ thống (lockup) là "phím SysRq thần kỳ" (magic SysRq key), có sẵn trên hầu hết các kiến trúc. Magic SysRq được kích hoạt bằng sự kết hợp của các phím Alt và SysRq trên bàn phím PC, hoặc với các phím đặc biệt khác trên các nền tảng khác (xem *Documentation/sysrq.txt* để biết chi tiết), và cũng có sẵn trên console nối tiếp (serial console). Một phím thứ ba, được nhấn cùng với hai phím này, thực hiện một trong số các hành động hữu ích:

- r Tắt chế độ thô của bàn phím (keyboard raw mode); hữu ích trong các tình huống mà một ứng dụng bị crash (chẳng hạn như X server) có thể đã để bàn phím của bạn ở trạng thái kỳ lạ.
- k Gọi hàm "phím chú ý bảo mật" (secure attention key - SAK). SAK tiêu diệt tất cả các tiến trình đang chạy trên console hiện tại, để lại cho bạn một terminal sạch sẽ.
- s Thực hiện đồng bộ hóa khẩn cấp tất cả các đĩa.
- u Umount. Cố gắng remount tất cả các đĩa ở chế độ chỉ đọc (read-only mode). Thao tác này, thường được gọi ngay sau *s*, có thể tiết kiệm rất nhiều thời gian kiểm tra hệ thống tập tin (filesystem) trong các trường hợp hệ thống gặp sự cố nghiêm trọng.

Thực tế, các hệ thống đa xử lý (multiprocessor) vẫn thực hiện lập lịch (schedule) trên các bộ vi xử lý khác, và thậm chí một máy đơn xử lý (uniprocessor) cũng có thể lập lịch lại nếu tính năng chiếm quyền tiền nhiệm của kernel (kernel preemption) được bật. Tuy nhiên, đối với trường hợp phổ biến nhất (đơn xử lý đã vô hiệu hóa preemption), hệ thống sẽ hoàn toàn dừng việc lập lịch lại.

- b Khởi động lại (Boot). Khởi động lại hệ thống ngay lập tức. Hãy chắc chắn rằng bạn đã đồng bộ (synchronize) và remount lại các đĩa trước.
- p In thông tin các thanh ghi của bộ vi xử lý (processor registers).
- t In danh sách tác vụ (task list) hiện tại.
- m In thông tin bộ nhớ (memory).

Vẫn tồn tại các chức năng Magic SysRq khác; hãy xem tệp *sysrq.txt* trong thư mục *Documentation* của mã nguồn kernel để có danh sách đầy đủ. Lưu ý rằng Magic SysRq phải được bật một cách tường minh trong cấu hình kernel (kernel configuration) và hầu hết các bản phân phối (distributions) không bật tính năng này vì các lý do bảo mật hiển nhiên. Tuy nhiên, đối với một hệ thống dùng để phát triển trình điều khiển (driver), việc bật Magic SysRq hoàn toàn xứng đáng với công sức tự biên dịch một kernel mới. Magic SysRq có thể bị vô hiệu hóa tại thời điểm chạy (runtime) bằng một lệnh như sau:

#### echo 0 > /proc/sys/kernel/sysrq

Bạn nên cân nhắc vô hiệu hóa nó nếu những người dùng không có đặc quyền (unprivileged users) có thể tiếp cận bàn phím hệ thống của bạn, nhằm phòng ngừa các thiệt hại vô tình hoặc cố ý. Một số phiên bản kernel trước đây đã vô hiệu hóa *sysrq* theo mặc định, do đó bạn cần phải bật nó tại thời điểm chạy bằng cách ghi số 1 vào chính tệp */proc/sys* đó.

Các thao tác *sysrq* cực kỳ hữu ích, vì vậy chúng đã được cung cấp cho các quản trị viên hệ thống (system administrators) những người không thể tiếp cận trực tiếp bảng điều khiển (console). Tệp */proc/sysrq-trigger* là một điểm vào chỉ-ghi (writeonly entry point), nơi bạn có thể kích hoạt một hành động *sysrq* cụ thể bằng cách ghi ký tự lệnh tương ứng; sau đó bạn có thể thu thập bất kỳ dữ liệu đầu ra nào từ các nhật ký của kernel (kernel logs). Điểm vào này của *sysrq* luôn hoạt động, ngay cả khi *sysrq* bị vô hiệu hóa trên console.

Nếu bạn đang gặp phải tình trạng "treo cứng" (live hang), trong đó driver của bạn bị kẹt trong một vòng lặp (loop) nhưng toàn bộ hệ thống vẫn đang hoạt động, có một vài kỹ thuật đáng chú ý. Thông thường, chức năng *p* của SysRq sẽ chỉ thẳng mặt thủ phạm gây lỗi. Nếu cách đó không thành công, bạn cũng có thể sử dụng chức năng profiling của kernel. Hãy xây dựng một kernel đã bật tính năng profiling, và khởi động nó với tham số `profile=2` trên dòng lệnh (command line). Đặt lại các bộ đếm profile (profile counters) bằng tiện ích *readprofile*, sau đó cho driver của bạn chạy vào vòng lặp của nó. Sau một khoảng thời gian ngắn, hãy sử dụng lại *readprofile* để xem kernel đang dành thời gian xử lý ở đâu. Một giải pháp thay thế nâng cao hơn là *oprofile*, mà bạn cũng có thể cân nhắc. Tệp *Documentation/basic\_profiling.txt* sẽ cung cấp cho bạn mọi thứ cần biết để bắt đầu sử dụng các công cụ profiler.

Một biện pháp phòng ngừa nên áp dụng khi truy lùng các lỗi treo hệ thống là mount tất cả các đĩa của bạn ở chế độ chỉ đọc - read-only (hoặc unmount chúng đi). Nếu các đĩa ở chế độ chỉ đọc hoặc đã bị unmount, sẽ không có rủi ro làm hỏng hệ thống tập tin (filesystem) hoặc để nó ở trạng thái không nhất quán (inconsistent state). Một khả năng khác là sử dụng một máy tính mount tất cả các hệ thống tập tin của nó thông qua NFS (network file system - hệ thống tập tin mạng). Tính năng "NFS-Root" phải được bật trong kernel, và các tham số đặc biệt phải được truyền vào tại thời điểm boot. Trong trường hợp này, bạn sẽ tránh được tình trạng hỏng hệ thống tập tin mà thậm chí không cần nhờ đến SysRq, bởi vì tính đồng nhất của hệ thống tập tin được quản lý bởi máy chủ NFS (NFS server), vốn không bị kéo sập bởi thiết bị driver của bạn.

## Trình gỡ lỗi và các công cụ liên quan (Debuggers and Related Tools)

Biện pháp cuối cùng trong việc gỡ lỗi (debugging) các module là sử dụng trình gỡ lỗi (debugger) để chạy từng bước qua mã nguồn, theo dõi giá trị của các biến và thanh ghi máy (machine registers). Cách tiếp cận này tốn nhiều thời gian và nên tránh bất cứ khi nào có thể. Dù vậy, góc nhìn chi tiết về mã nguồn đạt được thông qua trình gỡ lỗi đôi khi lại vô cùng giá trị.

Việc sử dụng trình gỡ lỗi tương tác (interactive debugger) trên kernel là một thử thách. Kernel chạy trong không gian địa chỉ riêng của nó (address space) đại diện cho tất cả các tiến trình trên hệ thống. Do đó, một số tính năng thông thường được cung cấp bởi các trình gỡ lỗi ở không gian người dùng (user-space debuggers), chẳng hạn như điểm dừng (breakpoint) và chạy từng bước (single-stepping), sẽ khó khăn hơn khi thực hiện trong kernel. Trong phần này, chúng ta sẽ xem xét một số cách để gỡ lỗi kernel; mỗi cách đều có những ưu điểm và nhược điểm riêng.

### Sử dụng gdb
*gdb* có thể khá hữu ích để kiểm tra các thành phần bên nội tại của hệ thống. Việc sử dụng thành thạo trình gỡ lỗi ở cấp độ này đòi hỏi sự tự tin nhất định với các câu lệnh của *gdb*, sự hiểu biết về mã hợp ngữ (assembly code) cho nền tảng đích, và khả năng đối chiếu giữa mã nguồn và mã hợp ngữ đã được tối ưu hóa.

Trình gỡ lỗi phải được gọi giống như thể kernel là một ứng dụng. Ngoài việc chỉ định tên tệp cho ảnh ELF của kernel (ELF kernel image), bạn cần cung cấp tên của một tệp lõi (core file) trên dòng lệnh. Đối với một kernel đang chạy, tệp lõi đó chính là ảnh lõi của kernel, */proc/kcore*. Một lệnh gọi *gdb* điển hình trông giống như sau:

gdb /usr/src/linux/vmlinux /proc/kcore

Đối số đầu tiên là tên của tệp thực thi ELF kernel chưa nén, không phải là *zImage*, *bzImage* hay bất kỳ thứ gì được biên dịch đặc biệt cho môi trường khởi động (boot environment).

Đối số thứ hai trên dòng lệnh *gdb* là tên của tệp lõi. Giống như bất kỳ tệp nào trong */proc*, */proc/kcore* được tạo ra khi nó được đọc. Khi system call *read* thực thi trong hệ thống tệp */proc*, nó ánh xạ tới một hàm tạo dữ liệu thay vì hàm truy xuất dữ liệu; chúng ta đã khai thác tính năng này trong phần "Sử dụng Hệ thống tệp /proc" (Using the /proc Filesystem) trước đó trong chương này. *kcore* được sử dụng để đại diện cho tệp "thực thi" của kernel theo định dạng của một tệp lõi (core file); đây là một tệp khổng lồ, bởi vì nó đại diện cho toàn bộ không gian địa chỉ của kernel (kernel address space), tương ứng với toàn bộ bộ nhớ vật lý (physical memory). Từ bên trong *gdb*, bạn có thể xem các biến của kernel bằng cách đưa ra các lệnh *gdb* tiêu chuẩn. Ví dụ: lệnh p jiffies in ra số lượng nhịp đồng hồ (clock ticks) kể từ khi hệ thống khởi động cho đến thời điểm hiện tại.

Khi bạn in dữ liệu từ *gdb*, kernel vẫn đang chạy và các mục dữ liệu khác nhau có các giá trị khác nhau tại các thời điểm khác nhau; tuy nhiên, *gdb* tối ưu hóa việc truy cập vào tệp lõi bằng cách lưu đệm (cache) dữ liệu đã được đọc. Nếu bạn thử xem biến jiffies một lần nữa, bạn sẽ nhận được kết quả giống như trước. Việc lưu đệm các giá trị để tránh truy cập đĩa bổ sung là hành vi chính xác đối với các tệp lõi thông thường nhưng lại bất tiện khi sử dụng ảnh lõi "động" (dynamic core image). Giải pháp là đưa ra lệnh *core-file /proc/kcore* bất cứ khi nào bạn muốn xóa bộ đệm (flush) của *gdb*; trình gỡ lỗi sẽ sẵn sàng sử dụng một tệp lõi mới và loại bỏ mọi thông tin cũ. Tuy nhiên, bạn sẽ không phải lúc nào cũng cần đưa ra lệnh *core-file* khi đọc một dữ liệu mới; *gdb* đọc lõi theo từng khối vài kilobyte và chỉ lưu đệm các khối mà nó đã tham chiếu.

Nhiều tính năng thường được cung cấp bởi *gdb* không khả dụng khi bạn làm việc với kernel. Ví dụ: *gdb* không thể sửa đổi dữ liệu của kernel; nó mong đợi được chạy một chương trình cần gỡ lỗi dưới sự kiểm soát của chính nó trước khi thao tác với ảnh bộ nhớ (memory image) của chương trình đó. Việc đặt điểm dừng (breakpoint), điểm quan sát (watchpoint), hoặc chạy từng bước qua các hàm của kernel cũng là điều không thể.

Lưu ý rằng, để có sẵn thông tin ký hiệu (symbol information) cho *gdb*, bạn phải biên dịch kernel của mình với tùy chọn CONFIG_DEBUG_INFO được thiết lập. Kết quả là một ảnh kernel lớn hơn nhiều trên đĩa, nhưng nếu không có thông tin đó, việc đào sâu vào các biến của kernel gần như là bất khả thi.

Với thông tin gỡ lỗi có sẵn, bạn có thể tìm hiểu rất nhiều điều về những gì đang diễn ra bên trong kernel. *gdb* sẵn lòng in ra các cấu trúc (structures), theo dõi các con trỏ (pointers), v.v. Tuy nhiên, một điều khó khăn hơn là kiểm tra các module. Vì các module không phải là một phần của ảnh *vmlinux* được truyền cho *gdb*, nên trình gỡ lỗi không biết gì về chúng. May mắn thay, kể từ phiên bản kernel 2.6.7, chúng ta có thể cung cấp cho *gdb* những gì nó cần biết để kiểm tra các module có thể tải (loadable modules).

Các module có thể tải của Linux là các tệp thực thi định dạng ELF; do đó, chúng được chia thành nhiều section. Một module điển hình có thể chứa một chục section trở lên, nhưng thường có ba section liên quan trong một phiên gỡ lỗi:

#### .text

Section này chứa mã thực thi cho module. Trình gỡ lỗi phải biết section này nằm ở đâu để có thể cung cấp dấu vết ngăn xếp (tracebacks) hoặc đặt điểm dừng (breakpoints). (Không có thao tác nào trong số này liên quan khi chạy trình gỡ lỗi trên */proc/kcore*, nhưng chúng có thể hữu ích khi làm việc với *kgdb*, được mô tả bên dưới).

#### .bss

#### .data

Hai phần (section) này chứa các biến của module (module's variables). Bất kỳ biến nào không được khởi tạo tại thời điểm biên dịch (compile time) đều nằm trong .bss, trong khi những biến đã được khởi tạo sẽ đi vào .data.

Để làm cho *gdb* hoạt động với các loadable module, chúng ta cần cung cấp thông tin cho trình gỡ lỗi (debugger) biết các phần của một module cụ thể đã được tải ở đâu. Thông tin đó có sẵn trong sysfs, tại thư mục */sys/module*. Ví dụ, sau khi tải module *scull*, thư mục */sys/module/scull/sections* chứa các tệp có tên như *.text*; nội dung của mỗi tệp chính là địa chỉ cơ sở (base address) cho phần đó.

Bây giờ chúng ta có thể đưa ra lệnh *gdb* để thông báo cho nó về module của chúng ta. Lệnh chúng ta cần dùng là add-symbol-file; lệnh này nhận các tham số gồm tên tệp đối tượng (object file) của module, địa chỉ cơ sở *.text*, và một chuỗi các tham số tùy chọn mô tả vị trí của bất kỳ phần quan trọng nào khác đã được đặt. Sau khi tìm hiểu dữ liệu phần module trong sysfs, chúng ta có thể xây dựng một lệnh như sau:

```

(gdb) add-symbol-file .../scull.ko 0xd0832000 \
-s .bss 0xd0837100 \
-s .data 0xd0836be0

```

Chúng ta đã đính kèm một tập lệnh nhỏ trong mã nguồn mẫu (*gdbline*) có thể tự động tạo lệnh này cho một module cho trước.

Bây giờ chúng ta có thể sử dụng *gdb* để kiểm tra các biến trong loadable module của mình. Dưới đây là một ví dụ nhanh được lấy từ phiên gỡ lỗi *scull*:

```

(gdb) add-symbol-file scull.ko 0xd0832000 \
-s .bss 0xd0837100 \
-s .data 0xd0836be0
add symbol table from file "scull.ko" at
.text_addr = 0xd0832000
.bss_addr = 0xd0837100
.data_addr = 0xd0836be0
(y or n) y
Reading symbols from scull.ko...done.
(gdb) p scull_devices[0]
$1 = {data = 0xcfd66c50,
quantum = 4000,
qset = 1000,
size = 20881,
access_key = 0,
...}

```

Ở đây chúng ta thấy rằng thiết bị *scull* đầu tiên hiện đang chứa 20.881 byte. Nếu muốn, chúng ta có thể đi theo chuỗi dữ liệu (data chain) hoặc xem bất kỳ thứ gì khác quan tâm trong module.

Một mẹo hữu ích khác đáng biết là:

```

(gdb) print *(address)

```

Ở đây, hãy điền một địa chỉ hệ thập lục phân (hex address) vào vị trí address; kết quả đầu ra sẽ là tên tệp và số dòng mã nguồn tương ứng với địa chỉ đó. Kỹ thuật này có thể hữu ích, ví dụ, để tìm ra con trỏ hàm (function pointer) thực sự trỏ tới đâu.

Chúng ta vẫn chưa thể thực hiện các tác vụ gỡ lỗi thôngكينا như đặt điểm dừng (breakpoint) hoặc sửa đổi dữ liệu; để thực hiện các thao tác đó, chúng ta cần sử dụng một công cụ như *kdb* (được mô tả tiếp theo) hoặc *kgdb* (sẽ được đề cập ngay sau đây).

### Trình gỡ lỗi nhân kdb (The kdb Kernel Debugger)
Nhiều độc giả có thể tự hỏi tại sao kernel không được tích hợp thêm các tính năng gỡ lỗi nâng cao. Câu trả lời, rất đơn giản, là Linus không tin tưởng vào các trình gỡ lỗi tương tác (interactive debugger). Ông ấy sợ rằng chúng dẫn đến những bản vá tồi—những bản vá chỉ khắc phục triệu chứng thay vì giải quyết nguyên nhân gốc rễ của vấn đề. Do đó, không có trình gỡ lỗi tích hợp sẵn nào cả.

Tuy nhiên, các nhà phát triển kernel khác lại nhận thấy thỉnh thoảng vẫn cần sử dụng các công cụ gỡ lỗi tương tác. Một công cụ như vậy là trình gỡ lỗi nhân tích hợp *kdb*, có sẵn dưới dạng một bản vá không chính thức từ *oss.sgi.com*. Để sử dụng *kdb*, bạn phải lấy bản vá (đảm bảo chọn phiên bản khớp với phiên bản kernel của bạn), áp dụng nó, sau đó biên dịch lại và cài đặt lại kernel. Lưu ý rằng, tính đến thời điểm viết bài này, *kdb* chỉ hoạt động trên các hệ thống IA-32 (x86) (mặc dù phiên bản dành cho IA-64 đã từng tồn tại trong mã nguồn kernel chính thống trước khi bị gỡ bỏ).

Khi bạn đang chạy một kernel đã được bật *kdb*, có một vài cách để truy cập vào trình gỡ lỗi. Nhấn phím Pause (hoặc Break) trên bảng điều khiển (console) sẽ khởi động trình gỡ lỗi. *kdb* cũng tự động khởi động khi xảy ra sự cố kernel oops hoặc khi gặp điểm dừng (breakpoint). Trong mọi trường hợp, bạn sẽ thấy một thông báo đại loại như thế này:

```

Entering kdb (0xc0347b80) on processor 0 due to Keyboard Entry
[0]kdb>

```

Lưu ý rằng hầu như mọi hoạt động của kernel sẽ dừng lại khi *kdb* đang chạy. Không có tiến trình (process) nào khác nên chạy trên hệ thống nơi bạn gọi *kdb*; đặc biệt, bạn không nên bật mạng ngoại trừ khi bạn đang gỡ lỗi một trình điều khiển mạng (network driver). Nhìn chung, bạn nên khởi động hệ thống ở chế độ người dùng đơn (single-user mode) nếu bạn định sử dụng *kdb*.

Ví dụ, hãy xem xét một phiên gỡ lỗi *scull* nhanh. Giả sử rằng driver đã được tải, chúng ta có thể yêu cầu *kdb* đặt một breakpoint trong hàm *scull\_read* như sau:

```

[0]kdb> bp scull_read
Instruction(i) BP #0 at 0xcd087c5dc (scull_read)
is enabled globally adjust 1
[0]kdb> go

```

Lệnh *bp* ra lệnh cho *kdb* dừng lại vào lần tiếp theo kernel thực thi vào *scull\_read*. Sau đó, bạn gõ **go** để tiếp tục thực thi. Sau khi đưa dữ liệu vào một trong các thiết bị *scull*, chúng ta có thể thử đọc nó bằng cách chạy lệnh *cat* trong một shell trên terminal khác, mang lại kết quả sau:

```

Instruction(i) breakpoint #0 at 0xd087c5dc (adjusted)
0xd087c5dc scull_read: int3
Entering kdb (current=0xcf09f890, pid 1575) on processor 0 due to
Breakpoint @ 0xd087c5dc
[0]kdb>

```

Chúng ta hiện đang đứng ở phần đầu của *scull\_read*. Để xem cách chúng ta đến được đó, chúng ta có thể lấy một chuỗi dấu vết ngăn xếp (stack trace):

```

[0]kdb> bt
ESP EIP Function (args)
0xcdbddf74 0xd087c5dc [scull]scull_read
0xcdbddf78 0xc0150718 vfs_read+0xb8
0xcdbddfa4 0xc01509c2 sys_read+0x42
0xcdbddfc4 0xc0103fcf syscall_call+0x7
[0]kdb>

```

*kdb* cố gắng in ra các đối số (argument) cho mọi hàm trong chuỗi gọi (call trace). Tuy nhiên, nó bị nhầm lẫn bởi các kỹ thuật tối ưu hóa được sử dụng bởi trình biên dịch (compiler). Do đó, nó không in được các đối số cho *scull\_read*.

Đã đến lúc xem xét một số dữ liệu. Lệnh *mds* thao tác với dữ liệu; chúng ta có thể truy vấn giá trị của con trỏ scull\_devices bằng một lệnh như:

```

[0]kdb> mds scull_devices 1
0xd0880de8 cf36ac00 ....

```

Ở đây chúng ta yêu cầu một từ (word) dữ liệu (4 byte) bắt đầu từ vị trí của scull\_devices; câu trả lời cho chúng ta biết rằng mảng thiết bị (device array) của chúng ta nằm ở địa chỉ 0xd0880de8; bản thân cấu trúc thiết bị (device structure) đầu tiên nằm ở 0xcf36ac00. Để xem cấu trúc thiết bị đó, chúng ta cần sử dụng địa chỉ đó:

```

[0]kdb> mds cf36ac00
0xcf36ac00 ce137dbc ....
0xcf36ac04 00000fa0 ....
0xcf36ac08 000003e8 ....
0xcf36ac0c 0000009b ....
0xcf36ac10 00000000 ....
0xcf36ac14 00000001 ....
0xcf36ac18 00000000 ....
0xcf36ac1c 00000001 ....

```

Tám dòng ở đây tương ứng với phần đầu của cấu trúc scull\_dev. Do đó, chúng ta thấy rằng bộ nhớ cho thiết bị đầu tiên được cấp phát tại 0xce137dbc, quantum là 4000 (hệ hex là fa0), kích thước tập quantum (quantum set size) là 1000 (hệ hex là 3e8) và hiện có 155 (hệ hex là 9b) byte được lưu trữ trong thiết bị.

*kdb* cũng có thể thay đổi dữ liệu. Giả sử chúng ta muốn cắt bớt một số dữ liệu khỏi thiết bị:

```

[0]kdb> mm cf26ac0c 0x50
0xcf26ac0c = 0x50

```

Một lệnh *cat* tiếp theo trên thiết bị bây giờ sẽ trả về ít dữ liệu hơn trước.

*kdb* có một số tính năng khác, bao gồm thực thi đơn bước (single-stepping) (theo các lệnh, không phải dòng mã nguồn C), đặt điểm dừng (breakpoint) trên quyền truy cập dữ liệu, dịch ngược (disassemble) mã, bước qua danh sách liên kết (linked list), truy cập dữ liệu thanh ghi (register), v.v. Sau khi bạn đã áp dụng bản vá *kdb*, một bộ tài liệu hướng dẫn (manual pages) đầy đủ có thể được tìm thấy trong thư mục *Documentation/kdb* trong cây mã nguồn kernel của bạn.

### Các bản vá kgdb
Hai phương pháp gỡ lỗi tương tác (interactive debugging) mà chúng ta đã xem xét cho đến nay (sử dụng *gdb* trên */proc/kcore* và *kdb*) đều không đạt được loại môi trường mà các nhà phát triển ứng dụng không gian người dùng (user-space application developer) đã quen thuộc. Sẽ tuyệt vời biết bao nếu có một trình gỡ lỗi (debugger) thực sự cho kernel hỗ trợ các tính năng như thay đổi biến, điểm dừng (breakpoint), v.v.?

Hóa ra, một giải pháp như vậy thực sự tồn tại. Tính đến thời điểm viết bài này, có hai bản vá riêng biệt đang lưu hành cho phép *gdb*, với đầy đủ các tính năng, chạy chống lại kernel. Gây nhầm lẫn ở chỗ, cả hai bản vá này đều được gọi là *kgdb*. Chúng hoạt động bằng cách tách biệt hệ thống chạy kernel thử nghiệm với hệ thống chạy trình gỡ lỗi (debugger); cả hai thường được kết nối qua cáp nối tiếp (serial cable). Do đó, nhà phát triển có thể chạy *gdb* trên hệ thống máy để bàn ổn định của họ, trong khi thao tác trên một kernel đang chạy trên một cỗ máy thử nghiệm hy sinh. Việc thiết lập *gdb* ở chế độ này mất một chút thời gian lúc ban đầu, nhưng khoản đầu tư đó có thể mang lại kết quả nhanh chóng khi một lỗi khó xuất hiện.

Các bản vá này đang trong trạng thái thay đổi mạnh mẽ và thậm chí có thể được hợp nhất vào một thời điểm nào đó, vì vậy chúng tôi tránh nói nhiều về chúng ngoài vị trí và các tính năng cơ bản của chúng. Readers quan tâm được khuyến khích tìm hiểu và xem xét tình hình hiện tại.

Bản vá *kgdb* đầu tiên hiện được tìm thấy trong cây kernel -mm — khu vực dàn dựng (staging area) cho các bản vá trên đường đi vào nhánh chính (mainline) 2.6. Phiên bản này của bản vá hỗ trợ các kiến trúc x86, SuperH, ia64, x86\_64, SPARC và PPC 32-bit. Ngoài chế độ hoạt động thông thường qua cổng nối tiếp (serial port), phiên bản *kgdb* này cũng có thể giao tiếp qua mạng cục bộ (local-area network). Vấn đề chỉ đơn giản là kích hoạt chế độ Ethernet và khởi động với tham số kgdboe được thiết lập để chỉ định địa chỉ IP mà từ đó các lệnh gỡ lỗi có thể bắt nguồn. Tài liệu trong thư mục *Documentation/i386/kgdb* mô tả cách thiết lập mọi thứ.\*

Như một giải pháp thay thế, bạn có thể sử dụng bản vá *kgdb* được tìm thấy trên *http://kgdb.sf.net/*. Phiên bản trình gỡ lỗi này không hỗ trợ chế độ giao tiếp mạng (mặc dù điều đó được cho là đang được phát triển), nhưng nó có một số hỗ trợ tích hợp để làm việc với các module có thể tải (loadable module). Nó hỗ trợ các kiến trúc x86, x86\_64, PowerPC và S/390.

### Cổng User-Mode Linux
User-Mode Linux (UML) là một khái niệm rất thú vị. Nó được cấu trúc như một cổng (port) riêng biệt của Linux kernel với thư mục con *arch/um* của riêng nó. Tuy nhiên, nó không chạy trên một loại phần cứng mới nào; thay vào đó, nó chạy trên một máy ảo (virtual machine) được thực thi dựa trên giao diện System Call (giao diện gọi hệ thống) của Linux. Do đó, UML cho phép Linux kernel chạy như một Process ( tiến trình) ở chế độ người dùng (user-mode process) riêng biệt trên một hệ thống Linux.

Việc có một bản sao của kernel chạy như một tiến trình ở chế độ người dùng mang lại rất nhiều ưu điểm. Do nó chạy trên một bộ xử lý ảo bị giới hạn, một kernel bị lỗi (buggy kernel) không thể làm hỏng hệ thống "thật". Các cấu hình phần cứng và phần mềm khác nhau có thể được thử nghiệm dễ dàng trên cùng một cỗ máy. Và có lẽ quan trọng nhất đối với các nhà phát triển kernel (kernel developer), kernel ở chế độ người dùng có thể được thao tác dễ dàng bằng *gdb* hoặc một trình gỡ lỗi (debugger) khác.

Tuy nhiên, tài liệu này lại quên chỉ ra rằng bạn nên biên dịch (build) trình điều khiển card mạng (network adapter driver) tích hợp sẵn vào trong kernel, nếu không, trình gỡ lỗi sẽ không thể tìm thấy nó tại thời điểm boot (khởi động) và sẽ tự tắt.

Rốt cuộc, nó cũng chỉ là một tiến trình khác. UML rõ ràng có tiềm năng thúc đẩy quá trình phát triển kernel.

Tuy nhiên, UML lại có một nhược điểm lớn từ góc độ của những người viết driver (trình điều khiển thiết bị): kernel ở chế độ người dùng không có quyền truy cập vào phần cứng của hệ thống chủ (host system). Do đó, mặc dù nó có thể hữu ích để gỡ lỗi hầu hết các driver mẫu trong cuốn sách này, UML vẫn chưa hữu ích cho việc gỡ lỗi các driver phải xử lý phần cứng thực tế.

Xem *http://user-mode-linux.sf.net/* để biết thêm thông tin về UML.

### Bộ công cụ Linux Trace Toolkit
Linux Trace Toolkit (LTT) là một bản vá kernel (kernel patch) và một tập hợp các tiện ích liên quan cho phép theo dõi (trace) các sự kiện trong kernel. Bản ghi vết (trace) bao gồm thông tin thời gian và có thể tạo ra một bức tranh tương đối hoàn chỉnh về những gì đã xảy ra trong một khoảng thời gian nhất định. Do đó, nó không chỉ được sử dụng để gỡ lỗi (debugging) mà còn để truy tìm các vấn đề về hiệu năng.

LTT, cùng với tài liệu hướng dẫn chi tiết, có thể được tìm thấy tại *http:*//*www.opersys.com/LTT*.

### Dynamic Probes
Dynamic Probes (hoặc DProbes) là một công cụ gỡ lỗi được phát hành (dưới giấy phép GPL) bởi IBM dành cho Linux trên kiến trúc IA-32. Nó cho phép đặt một "điểm thăm dò" (probe) ở hầu hết mọi nơi trong hệ thống, bao gồm cả User Space (khôn gian người dùng) và Kernel Space (không gian kernel). Điểm thăm dò này bao gồm một số đoạn mã (được viết bằng một ngôn ngữ chuyên biệt, hướng ngăn xếp) được thực thi khi quyền điều khiển (control) chạm đến điểm đã cho. Đoạn mã này có thể báo cáo thông tin trở lại user space, thay đổi các thanh ghi (register), hoặc thực hiện một số tác vụ khác. Tính năng hữu ích của DProbes là một khi tính năng này đã được tích hợp sẵn vào kernel, các điểm thăm dò có thể được chèn vào bất kỳ đâu trong một hệ thống đang chạy (running system) mà không cần phải biên dịch lại kernel hoặc khởi động lại (reboot). DProbes cũng có thể hoạt động cùng với LTT để chèn các sự kiện trace mới tại các vị trí tùy ý.

Công cụ DProbes có thể được tải xuống từ trang mã nguồn mở của IBM: *http:*//*oss.software.ibm.com*.
