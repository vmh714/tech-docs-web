# Chương 2: Khám phá bên trong Kernel (A Peek Inside the Kernel)

| Trong Chương Này                           |    |
|------------------------------------------|----|
| Khởi Động (Booting Up)                   | 18 |
| Chế độ Kernel (Kernel Mode) và Chế độ User (User Mode) | 30 |
| Ngữ cảnh Tiến trình (Process Context) và Ngữ cảnh Ngắt (Interrupt Context) | 30 |
| Bộ định thời Kernel (Kernel Timers)     | 31 |
| Tính đồng thời trong Kernel (Concurrency in the Kernel) | 39 |
| Hệ thống tệp Tiến trình (Process Filesystem)| 49 |
| Cấp phát Bộ nhớ (Allocating Memory)        | 49 |
| Xem xét Mã nguồn (Looking at the Sources) | 52 |

Trước khi bắt đầu hành trình bước vào thế giới huyền bí của các Linux device driver (trình điều khiển thiết bị Linux), hãy làm quen với một số khái niệm cơ bản về kernel (nhân hệ điều hành) thông qua việc quan sát các vùng khác nhau của kernel dưới lăng kính của một lập trình viên viết driver. Chúng ta sẽ tìm hiểu về kernel timer (bộ định thời kernel), cơ chế đồng bộ hóa (synchronization mechanism) và cấp phát bộ nhớ (memory allocation). Nhưng trước tiên, hãy bắt đầu cuộc thám hiểm bằng góc nhìn tổng quan từ trên cao; chúng ta sẽ lướt qua các thông báo khởi động (boot message) được phát ra bởi kernel và dừng lại bất cứ khi nào có điểm thú vị xuất hiện.

## Khởi Động (Booting Up)

Hình 2.1 minh họa trình tự khởi động Linux trên máy tính kiến trúc x86. Quá trình khởi động Linux trên phần cứng x86 được kích hoạt khi BIOS tải *Master Boot Record* (MBR) từ thiết bị khởi động. Đoạn mã thường trú trong MBR sẽ đọc bảng phân vùng (partition table) và tải một Linux bootloader (trình nạp khởi động) như GRUB, LILO hoặc SYSLINUX từ phân vùng đang hoạt động (active partition). Giai đoạn cuối cùng của bootloader sẽ tải ảnh kernel (kernel image) đã nén và chuyển quyền điều khiển cho nó. Kernel sẽ tự giải nén và bắt đầu vận hành hệ thống.

```
+------------------+
|     Power On     |
+------------------+
          |
          v
+------------------+
|       BIOS       |
+------------------+
          |
          v
+---------------------------+
| Bootloader (GRUB/LILO/..)|
+---------------------------+
          |
          v
+---------------------------+
|    Real Mode Kernel       |   <- x86 Real Mode
+---------------------------+
          |
          |  switch to Protected Mode
          |  (arch/x86/boot/pm.c)
          v
+---------------------------+
| Protected Mode Kernel     |   <- x86 Protected Mode
+---------------------------+
          |
          v
+---------------------------+
|      The init Process     |
+---------------------------+
          |
          v
+---------------------------+
| User Processes & Daemons  |
+---------------------------+
```

**Hình 2.1. Trình tự khởi động Linux trên phần cứng kiến trúc x86.**

Bộ vi xử lý kiến trúc x86 có hai chế độ hoạt động: chế độ thực (*real mode*) và chế độ được bảo vệ (*protected mode*). Ở chế độ thực, bạn chỉ có thể truy cập 1MB bộ nhớ đầu tiên và điều này hoàn toàn không có sự bảo vệ nào. Chế độ được bảo vệ phức tạp hơn và cho phép bạn khai thác nhiều tính năng nâng cao của bộ vi xử lý, chẳng hạn như cơ chế phân trang (paging). CPU bắt buộc phải đi qua chế độ thực trên đường tiến tới chế độ được bảo vệ. Tuy nhiên, con đường này là đường một chiều; bạn không thể chuyển ngược từ chế độ được bảo vệ về chế độ thực.

Các bước khởi tạo kernel cấp độ đầu tiên được thực hiện bằng hợp ngữ (assembly) ở chế độ thực. Các bước khởi động tiếp theo được thực hiện ở chế độ được bảo vệ bởi hàm `start_kernel()` được định nghĩa trong tệp *init/main.c*, tệp mã nguồn mà bạn đã chỉnh sửa ở chương trước. `start_kernel()` bắt đầu bằng cách khởi tạo hệ thống con CPU (CPU subsystem). Quản lý bộ nhớ (memory management) và quản lý tiến trình (process management) được thiết lập ngay sau đó. Các bus ngoại vi (peripheral buses) và thiết bị I/O được khởi động tiếp theo. Bước cuối cùng trong trình tự khởi động là chương trình *init* — tiến trình cha của tất cả các tiến trình Linux — được gọi thi hành. Init thực thi các tập lệnh không gian người dùng (*user-space scripts*) để khởi động các dịch vụ kernel cần thiết. Cuối cùng, nó tạo ra các terminal trên các console và hiển thị lời nhắc đăng nhập (login prompt).

Mỗi tiêu đề phần tiếp theo dưới đây là một thông điệp từ Hình 2.2 được tạo ra trong quá trình khởi động trên một chiếc máy tính xách tay kiến trúc x86. Ngữ nghĩa và các thông điệp có thể thay đổi nếu bạn khởi động kernel trên các kiến trúc phần cứng khác. Nếu một số lời giải thích trong phần này có vẻ khó hiểu, đừng lo lắng; mục đích ở đây chỉ là cung cấp cho bạn một bức tranh tổng quan từ độ cao 100 feet và giúp bạn nếm thử hương vị đầu tiên của kernel. Nhiều khái niệm được đề cập lướt qua ở đây sẽ được trình bày một cách chiều sâu ở các phần sau.

**Hình 2.2. Các thông báo khởi động của Kernel.**

```
Linux version 2.6.23.1y (root@localhost.localdomain) (gcc version 4.1.1 20061011 (Red
Hat 4.1.1-30)) #7 SMP PREEMPT Thu Nov 1 11:39:30 IST 2007
BIOS-provided physical RAM map:
 BIOS-e820: 0000000000000000 - 000000000009f000 (usable)
 BIOS-e820: 000000000009f000 - 00000000000a0000 (reserved)
 ...
758MB LOWMEM available.
...
Kernel command line: ro root=/dev/hda1
...
Console: colour VGA+ 80x25
...
Calibrating delay using timer specific routine.. 1197.46 BogoMIPS (lpj=2394935)
...
CPU: L1 I cache: 32K, L1 D cache: 32K
CPU: L2 cache: 1024K
...
Checking 'hlt' instruction... OK.
...
Setting up standard PCI resources
...
NET: Registered protocol family 2
IP route cache hash table entries: 32768 (order: 5, 131072 bytes)
TCP established hash table entries: 131072 (order: 9, 2097152 bytes)
...
checking if image is initramfs... it is
Freeing initrd memory: 387k freed
...
io scheduler noop registered
io scheduler anticipatory registered (default)
...
00:0a: ttyS0 at I/O 0x3f8 (irq = 4) is a NS16550A
...
Uniform Multi-Platform E-IDE driver Revision: 7.00alpha2
ide: Assuming 33MHz system bus speed for PIO modes; override with idebus=xx
ICH4: IDE controller at PCI slot 0000:00:1f.1
Probing IDE interface ide0...
hda: HTS541010G9AT00, ATA DISK drive
hdc: HL-DT-STCD-RW/DVD DRIVE GCC-4241N, ATAPI CD/DVD-ROM drive
...
serio: i8042 KBD port at 0x60,0x64 irq 1
mice: PS/2 mouse device common for all mice
...
Synaptics Touchpad, model: 1, fw: 5.9, id: 0x2c6ab1, caps: 0x884793/0x0
...
agpgart: Detected an Intel 855GM Chipset.
...
Intel(R) PRO/1000 Network Driver - version 7.3.20-k2
...
ehci_hcd 0000:00:1d.7: EHCI Host Controller
...
```

```
Yenta: CardBus bridge found at 0000:02:00.0 [1014:0560]
...
Non-volatile memory driver v1.2
...
kjournald starting. Commit interval 5 seconds
EXT3 FS on hda2, internal journal
EXT3-fs: mounted filesystem with ordered data mode.
...
INIT: version 2.85 booting
...
```

### Bản đồ RAM vật lý do BIOS cung cấp (BIOS-Provided Physical RAM Map)

Kernel tổng hợp bản đồ bộ nhớ hệ thống (system memory map) từ BIOS, và đây là một trong những thông điệp khởi động (boot message) đầu tiên bạn sẽ thấy:

```
BIOS-provided physical RAM map:
BIOS-e820: 0000000000000000 - 000000000009f000 (usable)
...
BIOS-e820: 00000000ff800000 - 0000000100000000 (reserved)
```

Mã khởi động chế độ thực (Real mode initialization code) sử dụng dịch vụ BIOS int 0x15 với số hiệu hàm 0xe820 (do đó có chuỗi `BIOS-e820` trong thông điệp trước đó) để lấy bản đồ bộ nhớ hệ thống. Bản đồ bộ nhớ chỉ ra các dải bộ nhớ được dành riêng (reserved) và có thể sử dụng (usable), sau đó được kernel sử dụng để tạo ra vùng nhớ trống (free memory pool) của nó. Chúng ta sẽ thảo luận nhiều hơn về bản đồ bộ nhớ do BIOS cung cấp trong phần "Real Mode Calls" tại Phụ lục B, "Linux and the BIOS."

### Có sẵn 758MB LOWMEM (758MB LOWMEM Available)

Vùng nhớ kernel thông thường có thể định địa chỉ (< 896MB) được gọi là *bộ nhớ thấp* (*low memory*). Trình cấp phát bộ nhớ kernel (kernel memory allocator), `kmalloc()`, trả về bộ nhớ từ vùng này. Bộ nhớ vượt quá 896MB (được gọi là *bộ nhớ cao* - *high memory*) chỉ có thể được truy cập bằng cách sử dụng các ánh xạ đặc biệt (special mappings).

Trong quá trình khởi động, kernel tính toán và hiển thị tổng số trang (pages) có trong các vùng nhớ (memory zones) này. Chúng ta sẽ xem xét kỹ hơn về các vùng nhớ ở phần sau của chương này.

### Dòng lệnh Kernel (Kernel Command Line): ro root=/dev/hda1

Các bootloader của Linux thường truyền một dòng lệnh (command line) cho kernel. Các tham số trong dòng lệnh tương tự như danh sách `argv[]` được truyền cho hàm `main()` trong các chương trình C, ngoại trừ việc chúng được truyền cho kernel thay thế. Bạn có thể thêm các đối số dòng lệnh (command-line arguments) vào tệp cấu hình bootloader hoặc cung cấp chúng từ dấu nhắc (prompt) của bootloader tại thời điểm chạy (runtime).[1] Nếu bạn đang sử dụng bootloader GRUB, tệp cấu hình sẽ là */boot/grub/grub.conf* hoặc */boot/grub/menu.lst* tùy thuộc vào bản phân phối của bạn. Nếu bạn là người dùng LILO, tệp cấu hình là */etc/lilo.conf*. Một tệp *grub.conf* mẫu (có thêm các chú thích) được liệt kê ở đây. Bạn có thể tìm ra nguồn gốc của thông điệp khởi động trước đó nếu bạn nhìn vào dòng tiếp theo sau `title kernel 2.6.23`:

<sup>[1]</sup> Các bootloader trên thiết bị nhúng (embedded devices) thường rất "gọn nhẹ" (slim) và không hỗ trợ tệp cấu hình hoặc các cơ chế tương đương. Do đó, nhiều kiến trúc phi x86 hỗ trợ một tùy chọn cấu hình kernel có tên là `CONFIG_CMDLINE` mà bạn có thể sử dụng để cung cấp dòng lệnh kernel tại thời điểm biên dịch (build time).

```
timeout 5 #5 giây để thay đổi thứ tự khởi động hoặc tham số
title kernel 2.6.23 #Tùy chọn khởi động 1
## Ảnh khởi động (boot image) nằm ở phân vùng đầu tiên của đĩa đầu tiên
## dưới thư mục /boot/ và có tên là vmlinuz-2.6.23. 'ro'
## chỉ ra rằng phân vùng gốc (root partition) nên được gắn (mount) ở chế độ chỉ đọc.
 kernel (hd0,0)/boot/vmlinuz-2.6.23 ro root=/dev/hda1
## Xem mục "Freeing initrd memory:387k freed"
 initrd (hd0,0)/boot/initrd
## ...
```

Các đối số dòng lệnh ảnh hưởng đến luồng mã (code path) được đi qua trong quá trình khởi động. Dưới đây là một ví dụ đơn giản, giả sử đối số dòng lệnh mà bạn quan tâm có tên là `bootmode`. Nếu tham số này được đặt thành `1`, bạn muốn in ra một số thông điệp gỡ lỗi (debug messages) trong quá trình khởi động và chuyển sang runlevel `3` ở cuối quá trình khởi động. (Hãy đợi cho đến khi các thông điệp khởi động được in ra bởi tiến trình `init` để tìm hiểu ngữ nghĩa của các runlevel). Nếu `bootmode` thay vào đó được đặt thành `0`, bạn sẽ muốn quá trình khởi động diễn ra ngắn gọn hơn và runlevel được đặt thành `2`. Vì bạn đã quen thuộc với *init/main.c*, hãy thêm phần sửa đổi sau vào đó:

```
static unsigned int bootmode = 1;
static int __init
is_bootmode_setup(char *str)
{
 get_option(&str, &bootmode);
 return 1;
}
/* Xử lý tham số "bootmode=" */
__setup("bootmode=", is_bootmode_setup);
if (bootmode) {
 /* In ra đầu ra chi tiết (verbose output) */
 /* ... */
}
/* ... */
/* Nếu bootmode là 1, chọn init runlevel là 3, ngược lại
 chuyển sang run level là 2 */
if (bootmode) {
 argv_init[++args] = "3";
} else {
 argv_init[++args] = "2";
}
/* ... */
```

Biên dịch lại kernel giống như bạn đã làm trước đó và dùng thử sự thay đổi này. Chúng ta sẽ thảo luận nhiều hơn về các đối số dòng lệnh kernel trong phần "Memory Layout" tại Chương 18, "Embedding Linux."

### Calibrating Delay...1197.46 BogoMIPS (lpj=2394935)

Trong quá trình khởi động (boot), kernel tính toán số lần bộ vi xử lý (processor) có thể thực thi một vòng lặp trễ nội bộ trong một *jiffy* (khoảng thời gian giữa hai ngắt liên tiếp của bộ định thời hệ thống - system timer). Như bạn có thể dự đoán, phép tính này phải được hiệu chuẩn (calibrated) theo tốc độ xử lý của CPU của bạn. Kết quả của việc hiệu chuẩn này được lưu trữ trong một biến của kernel có tên là `loops_per_jiffy`. Một nơi mà kernel sử dụng `loops_per_jiffy` là khi một trình điều khiển thiết bị (device driver) muốn trì hoãn việc thực thi trong các khoảng thời gian ngắn theo thứ tự micro giây.

Để hiểu mã nguồn hiệu chuẩn vòng lặp trễ (delay-loop calibration), chúng ta hãy cùng xem xét bên trong `calibrate_delay()`, được định nghĩa trong *init/calibrate.c*. Hàm này một cách khéo léo tạo ra độ chính xác dấu phẩy động (floating-point precision) bằng cách sử dụng phép toán số nguyên trong kernel. Đoạn mã sau (với một số chú thích được thêm vào) cho thấy phần đầu của hàm nhằm tạo ra một giá trị thô cho `loops_per_jiffy`:

```c
loops_per_jiffy = (1 << 12); /* Initial approximation = 4096 */
```

printk(KERN_DEBUG "Calibrating delay loop... ");
while ((loops_per_jiffy <<= 1) != 0) {
ticks = jiffies; /* As you will find out in the section, "Kernel
Timers," the jiffies variable contains the
number of timer ticks since the kernel
started, and is incremented in the timer
interrupt handler */
while (ticks == jiffies); /* Wait until the start
of the next jiffy */
ticks = jiffies;
/* Delay */
__delay(loops_per_jiffy);
/* Did the wait outlast the current jiffy? Continue if
it didn't */
ticks = jiffies - ticks;
if (ticks) break;
}
loops_per_jiffy >>= 1; /* This fixes the most significant bit and is
the lower-bound of loops_per_jiffy */

```

Mã nguồn bên trên bắt đầu bằng cách giả định rằng loops\_per\_jiffy lớn hơn 4096, tương đương với tốc độ bộ vi xử lý khoảng một *triệu lệnh mỗi giây* (million instructions per second - MIPS). Sau đó, nó chờ một jiffy mới bắt đầu và thực thi vòng lặp trễ `__delay(loops_per_jiffy)`. Nếu vòng lặp trễ kéo dài hơn jiffy đó, giá trị trước đó của loops\_per\_jiffy (được lấy bằng cách dịch phải bit đi một) sẽ cố định *bit có ý nghĩa lớn nhất* (most significant bit - MSB) của nó. Ngược lại, hàm tiếp tục bằng cách kiểm tra xem liệu nó có lấy được MSB bằng cách dịch trái bit loops\_per\_jiffy hay không. Khi kernel tìm ra MSB của loops\_per\_jiffy theo cách này, nó sẽ xử lý các bit bậc thấp hơn và tinh chỉnh độ chính xác của nó như sau:

```

loopbit = loops_per_jiffy;
/* Gradually work on the lower-order bits */
while (lps_precision-- && (loopbit >>= 1)) {
loops_per_jiffy |= loopbit;
ticks = jiffies;
while (ticks == jiffies); /* Wait until the start
of the next jiffy */
ticks = jiffies;

```

```

/* Delay */
__delay(loops_per_jiffy);
if (jiffies != ticks) /* longer than 1 tick */
loops_per_jiffy &= ~loopbit;
}

```

Đoạn mã trên tính toán tổ hợp chính xác của các bit thấp hơn trong loops\_per\_jiffy khi vòng lặp trễ vượt qua ranh giới jiffy. Giá trị đã được hiệu chuẩn này được sử dụng để suy ra một thước đo phi khoa học về tốc độ của bộ vi xử lý, được gọi là *BogoMIPS*. Bạn có thể sử dụng chỉ số BogoMIPS làm thước đo tương đối về tốc độ chạy của CPU. Trên một máy tính xách tay sử dụng Pentium M 1.6GHz, quá trình hiệu chuẩn vòng lặp trễ mang lại giá trị 2394935 cho loops\_per\_jiffy như thông báo khởi động ở trên đã công bố. Giá trị BogoMIPS được tính như sau:

BogoMIPS = loops\_per\_jiffy \* Số lượng jiffies trong 1 giây \* Số lượng lệnh tiêu thụ bởi vòng lặp trễ nội bộ theo đơn vị 1 triệu

```

= (2394935 * HZ * 2) / (1 million)
= (2394935 * 250 * 2) / (1000000)
= 1197.46 (as displayed in the preceding boot message)

```

Chúng ta sẽ thảo luận thêm về jiffies, HZ và loops\_per\_jiffy trong phần "Bộ định thời Kernel" (Kernel Timers) ở phần sau của chương này.

## Kiểm tra lệnh HLT

Vì Linux Kernel được hỗ trợ trên nhiều nền tảng phần cứng khác nhau, mã nguồn khởi động (boot code) sẽ kiểm tra các lỗi phụ thuộc kiến trúc (architecture-dependent bugs). Việc xác thực tính hợp lệ của lệnh *halt* (HLT) là một trong những bài kiểm tra như vậy.

Lệnh HLT được hỗ trợ bởi các bộ vi xử lý x86 sẽ đưa CPU vào chế độ ngủ tiết kiệm điện năng (low-power sleep mode) cho đến khi ngắt phần cứng (hardware interrupt) tiếp theo xảy ra. Kernel sử dụng lệnh HLT khi muốn đưa CPU về trạng thái nhàn rỗi (idle state) (xem hàm `cpu_idle()` được định nghĩa trong *arch/x86/kernel/process_32.c*).

Đối với các CPU gặp lỗi, tham số dòng lệnh kernel `no-hlt` có thể được sử dụng để vô hiệu hóa lệnh HLT. Nếu `no-hlt` được bật, kernel sẽ thực hiện vòng lặp chờ bận (busy-waits) trong lúc nhàn rỗi, thay vì giữ cho CPU mát bằng cách đưa nó vào trạng thái HLT.

Thông điệp khởi động ở trên được tạo ra khi mã nguồn khởi động trong *init/main.c* gọi hàm `check_bugs()` được định nghĩa trong *include/asm-your-arch/bugs.h*.

#### NET: Registered Protocol Family 2

Tầng socket (socket layer) của Linux là một giao diện đồng nhất thông qua đó các ứng dụng người dùng (user applications) truy cập vào các giao thức mạng khác nhau. Mỗi giao thức tự đăng ký với tầng socket bằng một số định danh họ giao thức (family number) duy nhất (được định nghĩa trong *include/linux/socket.h*) được gán cho nó. Họ số 2 trong thông điệp trước đó là viết tắt của `AF_INET` (Giao thức Internet - Internet Protocol).

Một họ giao thức đã đăng ký khác thường được tìm thấy trong các thông điệp khởi động là `AF_NETLINK` (Họ số 16). Netlink socket cung cấp một phương thức để giao tiếp giữa các tiến trình người dùng (user processes) và kernel. Các tính năng được thực hiện thông qua netlink socket bao gồm việc truy cập bảng định tuyến (routing table) và bảng *Address Resolution Protocol* (ARP) (xem *include/linux/netlink.h* để biết danh sách cách sử dụng đầy đủ). Netlink socket phù hợp hơn các System Call (lệnh gọi hệ thống) để hoàn thành các tác vụ này vì chúng hoạt động không đồng bộ (asynchronous), dễ triển khai hơn và có thể liên kết động.

Một họ giao thức khác thường được bật trong kernel là `AF_UNIX` hoặc UNIX-domain socket. Các chương trình như X Windows sử dụng chúng để giao tiếp giữa các tiến trình (interprocess communication) trên cùng một hệ thống.

### Freeing Initrd Memory: 387k Freed

*Initrd* (Initial RAM Disk) là một ảnh đĩa ảo cư trú trong bộ nhớ (memory-resident virtual disk image) được tải bởi bộ nạp khởi động (bootloader). Nó được gắn kết (mount) như một hệ thống tệp gốc ban đầu (initial root filesystem) sau khi kernel khởi động, nhằm chứa các module có thể tải động bổ sung (dynamically loadable modules) cần thiết để mount phân vùng đĩa chứa hệ thống tệp gốc thực sự. Do kernel chạy trên các nền tảng phần cứng khác nhau sử dụng các bộ điều khiển lưu trữ (storage controllers) đa dạng, các bản phân phối (distributions) không thể kích hoạt trình điều khiển thiết bị (device driver) cho tất cả các ổ đĩa có thể có trong ảnh kernel cơ sở (base kernel image). Các driver cụ thể cho thiết bị lưu trữ của hệ thống được đóng gói bên trong initrd và được tải sau khi kernel khởi động, nhưng trước khi hệ thống tệp gốc được mount. Để tạo một ảnh initrd, hãy sử dụng lệnh `mkinitrd`.

Kernel 2.6 bao gồm một tính năng gọi là *initramfs* mang lại một số ưu điểm vượt trội so với initrd. Trong khi initrd giả lập một đĩa (do đó gọi là *initramdisk* hoặc *initrd*) và gánh chịu các chi phí phát sinh (overhead) liên quan đến hệ thống I/O khối của Linux (Linux block I/O subsystem) như việc lưu trữ cache, thì initramfs về cơ bản đưa chính bộ nhớ cache được mount như một hệ thống tệp (do đó gọi là *initramfs*).

Initramfs, giống như page cache mà nó được xây dựng dựa trên đó, phát triển và thu nhỏ lại một cách động, không giống như initrd, do đó làm giảm lãng phí bộ nhớ. Hơn nữa, không giống như initrd—yêu cầu bạn phải bao gồm driver hệ thống tệp đi kèm (ví dụ: driver EXT2 nếu bạn có hệ thống tệp EXT2 trên initrd của mình)—initramfs không cần bất kỳ hỗ trợ hệ thống tệp nào. Mã nguồn initramfs rất nhỏ gọn vì nó chỉ là một tầng nhỏ nằm trên page cache.

Bạn có thể đóng gói hệ thống tệp gốc ban đầu của mình thành một lưu trữ *cpio* nén[2] và truyền nó đến dòng lệnh kernel bằng tham số `initrd=` hoặc biên dịch nó như một phần của ảnh kernel bằng cách sử dụng tùy chọn menu `INITRAMFS_SOURCE` trong quá trình cấu hình kernel. Với cách sau, bạn có thể cung cấp tên tệp của một kho lưu trữ cpio hoặc đường dẫn đến một cây thư mục chứa bố cục initramfs của bạn. Trong quá trình khởi động, kernel sẽ giải nén các tệp vào một hệ thống tệp gốc initramfs (còn gọi là *rootfs*) và thực thi chương trình cấp cao */init* nếu tìm thấy nó. Phương pháp lấy rootfs ban đầu này đặc biệt hữu ích cho các nền tảng nhúng (embedded platforms), nơi mọi tài nguyên hệ thống đều rất khan hiếm. Để tạo một ảnh initramfs, hãy sử dụng `mkinitramfs`. Hãy tham khảo *Documentation/filesystems/ramfs-rootfsinitramfs.txt* để biết thêm tài liệu.

[2] cpio là một định dạng lưu trữ tệp của UNIX. Bạn có thể tải xuống từ www.gnu.org/software/cpio.

Trong trường hợp này, chúng ta đang sử dụng initramfs bằng cách cung cấp một kho lưu trữ cpio nén của hệ thống tệp gốc ban đầu cho kernel bằng tham số dòng lệnh `initrd=`. Sau khi giải nén nội dung của kho lưu trữ vào rootfs, kernel sẽ giải phóng bộ nhớ nơi kho lưu trữ đó cư trú (387K trong trường hợp này) và thông báo thông điệp khởi động ở trên. Các trang bộ nhớ (pages) được giải phóng sau đó sẽ được phân bổ cho các phần khác của kernel đang yêu cầu bộ nhớ.

Như đã thảo luận trong Chương 18, `initrd` và `initramfs` đôi khi được sử dụng để chứa hệ thống tệp gốc (root filesystem) thực tế trên các thiết bị nhúng (embedded devices) trong quá trình phát triển.

### IO Scheduler Anticipatory Registered (Mặc định)

Mục tiêu chính của bộ lập lịch I/O (I/O scheduler) là tăng thông lượng hệ thống (system throughput) bằng cách giảm thiểu thời gian tìm kiếm của ổ đĩa (disk seek times), đây là độ trễ khi di chuyển đầu đọc ghi của đĩa từ vị trí hiện tại đến sector đĩa cần truy cập. Nhân (kernel) 2.6 cung cấp bốn bộ lập lịch I/O khác nhau: *Deadline, Anticipatory, Complete Fair Queuing* và *Noop*. Như thông điệp nhân ở trên cho biết, nhân đặt *Anticipatory* làm bộ lập lịch I/O mặc định. Chúng ta sẽ xem xét việc lập lịch I/O trong Chương 14, "Trình điều khiển Khối" (Block Drivers).

#### Thiết lập Tài nguyên PCI Chuẩn

Giai đoạn tiếp theo của quá trình khởi động (boot process) sẽ dò tìm (probe) và khởi tạo các bus I/O và bộ điều khiển ngoại vi (peripheral controllers). Nhân dò tìm phần cứng PCI bằng cách duyệt qua bus PCI, và sau đó khởi tạo các hệ thống con I/O khác. Hãy xem các thông điệp khởi động trong Hình 2.3 để thấy các thông báo liên quan đến việc khởi tạo hệ thống con SCSI, bộ điều khiển USB, chip video (là một phần của chipset North Bridge 855 trong các thông điệp bên dưới), cổng nối tiếp (serial port - trong trường hợp này là 8250 UART), bàn phím và chuột PS/2, ổ đĩa mềm (floppy drive), ramdisk, thiết bị loopback, bộ điều khiển IDE

(là một phần của chipset South Bridge ICH4 trong ví dụ này), bàn phím cảm ứng (touchpad), bộ điều khiển Ethernet (e1000 trong trường hợp này), và bộ điều khiển PCMCIA. Danh tính của thiết bị I/O tương ứng được gán nhãn cho .

**Hình 2.3. Khởi tạo các bus và bộ điều khiển ngoại vi trong quá trình khởi động.**

```

SCSI subsystem initialized                        -> SCSI
usbcore: registered new driver hub                -> USB
agpgart: Detected an Intel 855 Chipset.           -> Video
[drm] Initialized drm 1.0.0 20040925
PS/2 Controller [PNP0303:KBD, PNP0f13:MOU]
at 0x60,0x64 irq 1,12 serio: i8042 KBD port     -> Keyboard
serial8250: ttyS0 at I/O 0x3f8 (irq = 4)
is a NS16550A                                   -> Serial Port
Floppy drive(s): fd0 is 1.44M                     -> Floppy
RAMDISK driver initialized: 16 RAM disks
of 4096K size 1024 blocksize                    -> Ramdisk
loop: loaded (max 8 devices)                      -> Loop back
ICH4: IDE controller at PCI slot 0000:00:1f.1     -> Hard Disk
...

input: SynPS/2 Synaptics TouchPad as
/class/input/input1                             -> Touchpad
e1000: eth0: e1000_probe: Intel PRO/1000
Network Connection                              -> Ethernet
Yenta: CardBus bridge found at
0000:02:00.0 [1014:0560]                        -> PCMCIA/CardBus
...

```

Cuốn sách này thảo luận về nhiều hệ thống con trình điều khiển (driver subsystems) này trong các chương riêng biệt. Lưu ý rằng một số thông điệp này có thể chỉ xuất hiện sau đó trong quá trình khởi động nếu các trình điều khiển được liên kết động (dynamically linked) với nhân dưới dạng các mô-đun có thể tải (loadable modules).

#### EXT3-fs: Mounted Filesystem

Hệ thống tệp EXT3 đã trở thành hệ thống tệp thực tế (de facto filesystem) trên Linux. Nó bổ sung một lớp ghi nhật ký (journaling layer) lên trên hệ thống tệp EXT2 lâu đời nhằm tạo điều kiện phục hồi nhanh chóng sau một sự cố (crash). Mục đích là lấy lại trạng thái hệ thống tệp nhất quán (consistent filesystem state) mà không phải trải qua thao tác kiểm tra hệ thống tệp (fsck) tốn thời gian. EXT2 vẫn giữ vai trò là cỗ máy hoạt động, trong khi lớp EXT3 ghi nhật ký các giao dịch tệp (file transactions) trên một vùng nhớ được gọi là *journal* trước khi thực hiện các thay đổi thực sự lên đĩa. EXT3 có khả năng tương thích ngược (backward-compatible) với EXT2, vì vậy bạn có thể thêm lớp phủ EXT3 vào hệ thống tệp EXT2 hiện có của mình hoặc gỡ bỏ lớp EXT3 để lấy lại hệ thống tệp EXT2 ban đầu.

### EXT4

Phiên bản mới nhất trong dòng hệ thống tập tin (filesystem) EXT là EXT4, đã được đưa vào mainline kernel bắt đầu từ phiên bản phát hành 2.6.19, với nhãn "experimental" (thử nghiệm) và tên gọi là ext4dev. EXT4 có tính tương thích ngược phần lớn với EXT3. Trang chủ của dự án EXT4 nằm tại www.bullopensource.org/ext4.

EXT3 khởi chạy một luồng trợ giúp nhân (kernel helper thread) (chúng ta sẽ có một cuộc thảo luận chi tiết về các luồng nhân trong chương tiếp theo) có tên là *kjournald* để hỗ trợ cho tính năng ghi nhật ký (journaling). Khi EXT3 hoạt động, kernel (nhân) tiến hành mount (gắn kết) hệ thống tập tin gốc (root filesystem) và sẵn sàng hoạt động:

```

EXT3-fs: mounted filesystem with ordered data mode
kjournald starting. Commit interval 5 seconds
VFS: Mounted root (ext3 filesystem).
INIT: Version 2.85 Booting

```

*Init*, tiến trình cha của tất cả các tiến trình Linux (Linux processes), là chương trình đầu tiên chạy sau khi kernel hoàn tất chuỗi trình tự khởi động (boot sequence). Trong vài dòng cuối của *init/main.c*, kernel tìm kiếm các vị trí khác nhau trong nỗ lực định vị init:

```

if (ramdisk_execute_command) { /* Look for /init in initramfs */
run_init_process(ramdisk_execute_command);
}
if (execute_command) { /* You may override init and ask the kernel
to execute a custom program using the
"init=" kernel command-line argument. If
you do that, execute_command points to the
specified program */
run_init_process(execute_command);
}
/* Else search for init or sh in the usual places .. */
run_init_process("/sbin/init");
run_init_process("/etc/init");
run_init_process("/bin/init");
run_init_process("/bin/sh");
panic("No init found. Try passing init= option to kernel.");

```

Init nhận các chỉ dẫn từ */etc/inittab*. Trước tiên, nó thực thi các tập lệnh khởi tạo hệ thống (system initialization scripts) có trong */etc/rc.sysinit*. Một trong những trách nhiệm quan trọng của tập lệnh này là kích hoạt phân vùng swap (swap partition), điều này kích hoạt một thông điệp khởi động (boot message) như sau:

```

Adding 1552384k swap on /dev/hda6

```

Hãy cùng xem xét kỹ hơn ý nghĩa của điều này. Các tiến trình người dùng trên Linux (Linux user processes) sở hữu một không gian địa chỉ ảo (virtual address space) là 3GB (xem phần "Cấp phát Bộ nhớ" - Allocating Memory). Trong đó, các trang (pages) tạo nên "tập hợp làm việc" (working set) được giữ trong RAM. Tuy nhiên, khi có quá nhiều chương trình yêu cầu tài nguyên bộ nhớ, kernel sẽ giải phóng một số trang RAM đã sử dụng bằng cách lưu trữ chúng trong một phân vùng đĩa gọi là *vùng swap (swap space).* Theo một quy tắc chung (rule of thumb), kích thước của phân vùng swap nên gấp đôi lượng RAM. Trong trường hợp này, không gian swap nằm trong phân vùng đĩa */dev/hda6* và có kích thước 1552384K byte.

Init sau đó tiếp tục chạy các tập lệnh có trong thư mục */etc/rc.d/rcX.d/*, trong đó *X* là mức chạy (runlevel) được chỉ định trong inittab. Mức chạy là một trạng thái thực thi tương ứng với chế độ khởi động mong muốn. Ví dụ, chế độ văn bản đa người dùng (multiuser text mode) tương ứng với mức chạy 3, trong khi X Windows gắn liền với mức chạy 5. Vì vậy, nếu bạn nhìn thấy thông điệp `INIT: Entering runlevel 3`, init đã bắt đầu thực thi các tập lệnh trong thư mục */etc/rc.d/rc3.d/*. Các tập lệnh này khởi động hệ thống con đặt tên thiết bị động udev (dynamic device-naming subsystem) (mà chúng ta thảo luận trong Chương 4, "Đặt nền móng" - Laying the Groundwork) và tải các module nhân (kernel modules) chịu trách nhiệm điều khiển mạng, âm thanh, lưu trữ, v.v.:

```

Starting udev: [ OK ]
Initializing hardware... network audio storage [Done]
...

```

Cuối cùng, Init tạo ra (spawn) các terminal trên các console ảo. Bây giờ bạn có thể đăng nhập.

## Chế độ Nhân và Chế độ Người dùng (Kernel Mode and User Mode)

Một số hệ điều hành, chẳng hạn như MS-DOS, luôn thực thi ở một chế độ CPU duy nhất, nhưng các hệ điều hành giống UNIX sử dụng chế độ kép (dual modes) để triển khai hiệu quả cơ chế chia sẻ thời gian (time-sharing). Trên một máy tính Linux, CPU hoặc ở *chế độ nhân* đáng tin cậy (trusted *kernel mode*) hoặc ở *chế độ người dùng* bị hạn chế (restricted *user mode*). Tất cả các tiến trình người dùng (user processes) thực thi ở chế độ người dùng, trong khi bản thân kernel thực thi ở chế độ nhân.

Mã nguồn chạy ở chế độ nhân có quyền truy cập không hạn chế vào toàn bộ tập lệnh bộ xử lý (processor instruction set) cũng như toàn bộ không gian bộ nhớ và I/O. Nếu một tiến trình chế độ người dùng cần các đặc quyền này, nó phải chuyển tiếp các yêu cầu thông qua các trình điều khiển thiết bị (device drivers) hoặc mã nguồn chế độ nhân khác thông qua các lời gọi hệ thống (system calls). Tuy nhiên, mã nguồn chế độ người dùng được phép xảy ra lỗi trang (page fault), trong khi mã nguồn chế độ nhân thì không.

Trong các phiên bản kernel 2.4 và cũ hơn, chỉ có các tiến trình chế độ người dùng mới có thể bị chuyển đổi ngữ cảnh (context switched out) và thay thế bằng các tiến trình khác. Mã nguồn chế độ nhân có thể độc quyền bộ xử lý cho đến khi:

Nó tự nguyện từ bỏ CPU.

hoặc

Một ngắt (interrupt) hoặc một ngoại lệ (exception) xảy ra.

Với sự ra đời của tính năng chiếm quyền sẵn kernel (kernel preemption) trong phiên bản 2.6, phần lớn mã nguồn chế độ nhân cũng có thể bị chuyển đổi ngữ cảnh.

## Ngữ cảnh Tiến trình và Ngữ cảnh Ngắt (Process Context and Interrupt Context)

Kernel hoàn thành các công việc hữu ích bằng cách sử dụng kết hợp ngữ cảnh tiến trình (process contexts) và ngữ cảnh ngắt (interrupt contexts). Mã nguồn kernel phục vụ các lời gọi hệ thống do các ứng dụng người dùng ban hành chạy thay mặt cho các tiến trình ứng dụng tương ứng và được cho là thực thi trong ngữ cảnh tiến trình. Ngược lại, các trình xử lý ngắt (interrupt handlers) chạy không đồng bộ trong ngữ cảnh ngắt. Ngữ cảnh tiến trình không gắn liền với bất kỳ ngữ cảnh ngắt nào và ngược lại.

Mã nguồn kernel chạy trong tiến trình ngữ cảnh (process context) có khả năng bị ngắt (preemptible). Ngược lại, ngữ cảnh ngắt (interrupt context) luôn chạy cho đến khi hoàn thành và không thể bị ngắt (not preemptible). Do đó, có những hạn chế đối với những gì có thể được thực hiện từ ngữ cảnh ngắt. Mã thực thi từ ngữ cảnh ngắt không được phép thực hiện các thao tác sau:

- Chuyển sang trạng thái ngủ (go to sleep) hoặc nhường bộ vi xử lý (relinquish the processor)
- Chiếm giữ một mutex (acquire a mutex)
- Thực hiện các tác vụ tốn thời gian (time-consuming tasks)
- Truy cập bộ nhớ ảo không gian người dùng (user space virtual memory)

Hãy xem phần "Xử lý ngắt" (Interrupt Handling) trong Chương 4 để có cái nhìn toàn diện về ngữ cảnh ngắt.

## Bộ định thời Kernel (Kernel Timers)

Hoạt động của nhiều phần trong kernel phụ thuộc rất nhiều vào sự trôi qua của thời gian. Linux kernel tận dụng các bộ định thời (timer) khác nhau được cung cấp bởi phần cứng để cung cấp các dịch vụ phụ thuộc vào thời gian như bận-chờ (busy-waiting) và ngủ-chờ (sleep-waiting). Bộ xử lý lãng phí các chu kỳ (cycles) trong khi bận-chờ nhưng nhường CPU khi ngủ-chờ. Dĩ nhiên, phương án đầu tiên chỉ được thực hiện khi phương án thứ hai không khả thi. Kernel cũng hỗ trợ việc lập lịch (scheduling) cho các hàm muốn chạy sau khi một khoảng thời gian xác định đã trôi qua.

Trước tiên, hãy thảo luận về ngữ nghĩa của một số biến bộ định thời kernel quan trọng như `jiffies`, `HZ` và `xtime`. Tiếp theo, chúng ta hãy đo lường thời gian thực thi trên hệ thống dựa trên Pentium bằng cách sử dụng bộ đếm thời gian của Pentium (*Time Stamp Counter* - TSC). Chúng ta cũng hãy xem Linux sử dụng *Đồng hồ thời gian thực* (Real Time Clock - RTC) như thế nào.

### HZ và Jiffies

Bộ định thời hệ thống (system timers) ngắt bộ xử lý (hoặc "pop") theo các tần số có thể lập trình được. Tần số này, hay số lượng ngắt định thời (timer ticks) trên mỗi giây, được chứa trong biến kernel `HZ`. Việc lựa chọn giá trị cho `HZ` là một sự đánh đổi (trade-off). Giá trị `HZ` lớn dẫn đến độ chi tiết của bộ định thời (timer granularity) mịn hơn, và do đó độ phân giải lập lịch (scheduling resolution) tốt hơn. Tuy nhiên, các giá trị `HZ` lớn hơn cũng dẫn đến chi phí chung (overhead) lớn hơn và mức tiêu thụ điện năng cao hơn, bởi vì nhiều chu kỳ bị đốt cháy hơn trong ngữ cảnh ngắt định thời (interrupt context).

Giá trị của `HZ` phụ thuộc vào kiến trúc (architecture-dependent). Trên các hệ thống x86, `HZ` thường được đặt mặc định là 100 trong các kernel dòng 2.4. Với dòng 2.6, giá trị này thay đổi thành 1000, nhưng đến phiên bản 2.6.13, nó được hạ xuống thành 250. Trên các nền tảng dựa trên ARM, các kernel 2.6 đặt `HZ` thành 100. Với các kernel hiện tại, bạn có thể chọn giá trị cho `HZ` tại thời điểm biên dịch (build time) thông qua menu cấu hình. Cài đặt mặc định cho tùy chọn này phụ thuộc vào bản phân phối (distribution) của bạn.

Kernel 2.6.21 đã giới thiệu hỗ trợ cho kernel phi ngắt nhịp cố định (tickless kernel - `CONFIG_NO_HZ`), tính năng này kích hoạt ngắt định thời một cách động tùy thuộc vào tải của hệ thống. Việc triển khai hệ thống tickless nằm ngoài phạm vi của chương này.

`jiffies` lưu giữ số lần bộ định thời hệ thống đã ngắt kể từ khi hệ thống khởi động. Kernel tăng biến `jiffies` lên `HZ` lần mỗi giây. Do đó, trên một kernel có giá trị `HZ` là 100, một `jiffy` có thời lượng 10 mili-giây, trong khi trên kernel có `HZ` là 1000, một `jiffy` chỉ dài 1 mili-giây.

Để hiểu rõ hơn về `HZ` và `jiffies`, hãy xem xét đoạn mã sau từ trình điều khiển IDE (*drivers/ide/ide.c*) thực hiện thăm dò (poll) các ổ đĩa để kiểm tra trạng thái bận:

```c

unsigned long timeout = jiffies + (3*HZ);
while (hwgroup->busy) {
/* ... */
if (time_after(jiffies, timeout)) {
return -EBUSY;
}
/* ... */
}
return SUCCESS;

```

Đoạn mã trên trả về `SUCCESS` nếu điều kiện bận được giải quyết trong vòng chưa đầy 3 giây, và `-EBUSY` nếu ngược lại. `3*HZ` là số lượng `jiffies` có trong 3 giây. Khoảng thời gian chờ được tính toán, `(jiffies + 3*HZ)`, do đó là giá trị mới của `jiffies` sau khi thời gian chờ 3 giây trôi qua. Macro `time_after()` so sánh giá trị hiện tại của `jiffies` với thời gian chờ được yêu cầu, đồng thời xử lý việc tràn số (wraparound do overflows). Các hàm liên quan có sẵn để thực hiện các phép so sánh tương tự là `time_before()`, `time_before_eq()`, và `time_after_eq()`.

`jiffies` được định nghĩa là `volatile`, yêu cầu trình biên dịch không được tối ưu hóa việc truy cập biến này. Điều này đảm bảo rằng `jiffies`, được cập nhật bởi trình xử lý ngắt định thời (timer interrupt handler) trong mỗi chu kỳ ngắt nhịp (tick), được đọc lại trong mỗi lần lặp qua vòng lặp.

Để thực hiện việc chuyển đổi ngược lại từ `jiffies` sang giây, hãy xem xét đoạn mã này từ trình điều khiển USB host controller, *drivers/usb/host/ehci-sched.c*:

```c

if (stream->rescheduled) {
ehci_info(ehci, "ep%ds-iso rescheduled " "%lu times in %lu
seconds\n", stream->bEndpointAddress, is_in? "in":
"out", stream->rescheduled,
((jiffies – stream->start)/HZ));
}

```

Câu lệnh gỡ lỗi (debug statement) trước đó tính toán khoảng thời gian tính bằng giây trong đó luồng điểm cuối USB này (chúng ta thảo luận về USB trong Chương 11, "Universal Serial Bus") đã được lập lịch lại `stream->rescheduled` lần. `(jiffies-stream->start)` là số lượng `jiffies` đã trôi qua kể từ khi việc lập lịch lại bắt đầu. Phép chia cho `HZ` chuyển đổi giá trị đó thành giây.

Biến `jiffies` 32-bit sẽ bị tràn (overflow) sau khoảng 50 ngày, giả sử giá trị `HZ` là 1000. Bởi vì thời gian hoạt động của hệ thống (system uptimes) có thể lớn hơn nhiều lần khoảng thời gian đó, kernel cung cấp một biến gọi là `jiffies_64` để chứa `jiffies` 64-bit (`u64`). Bộ liên kết (linker) định vị `jiffies_64` sao cho 32 bit thấp của nó trùng khớp (collocate) với `jiffies`. Trên các máy 32-bit, trình biên dịch cần hai lệnh để gán một biến `u64` này cho biến khác, do đó việc đọc `jiffies_64` không phải là thao tác nguyên tử (not atomic). Để giải quyết vấn đề này, kernel cung cấp một hàm, `get_jiffies_64()`. Hãy xem `cpufreq_stats_update()` được định nghĩa trong *drivers/cpufreq/cpufreq_stats.c* để biết ví dụ về cách sử dụng.

#### Trễ Dài (Long Delays)

Theo thuật ngữ của kernel, các khoảng trễ cỡ độ dài của jiffies được coi là khoảng thời gian dài. Một cách có thể thực hiện nhưng không tối ưu để tạo ra các độ trễ dài là bằng cách bận-vòng (busy-looping). Một hàm chờ-bận (busy-waits) có thái độ "chiếm giữ độc quyền". Nó vừa không sử dụng bộ xử lý (processor) để thực hiện công việc có ích, vừa không cho phép các tiến trình khác sử dụng. Đoạn mã sau chiếm dụng bộ xử lý trong 1 giây:

```

unsigned long timeout = jiffies + HZ;
while (time_before(jiffies, timeout)) continue;

```

Một cách tiếp cận tốt hơn là chờ-ngủ (sleep-wait), thay vì chờ-bận. Mã của bạn nhường bộ xử lý cho các tiến trình khác trong khi chờ khoảng thời gian trễ trôi qua. Điều này được thực hiện bằng cách sử dụng `schedule_timeout()`:

```

unsigned long timeout = jiffies + HZ;
schedule_timeout(timeout); /* Cho phép các phần khác của
kernel chạy */

```

Sự đảm bảo về độ trễ chỉ nằm ở cận dưới của thời gian chờ (timeout). Dù từ Kernel Space hay từ User Space, rất khó để có được quyền kiểm soát thời gian chờ chính xác hơn độ chi tiết (granularity) của `HZ` vì các lát thời gian (time slice) của Process được cập nhật bởi kernel scheduler chỉ trong các ngắt bộ định thời (timer tick). Ngoài ra, ngay cả khi process của bạn được lên lịch để chạy sau khoảng thời gian chờ được chỉ định, scheduler vẫn có thể quyết định chọn một process khác từ hàng đợi chạy (run queue) dựa trên các mức ưu tiên.[3]

[3] Các đặc tính của scheduler này đã thay đổi kểจากการ xuất hiện của CFS scheduler trong kernel phiên bản 2.6.23. Các trình lập lịch tiến trình Linux (Linux process scheduler) được thảo luận trong Chương 19, "Trình điều khiển trong Không gian Người dùng" (Drivers in User Space).

Hai hàm khác hỗ trợ việc chờ-ngủ là `wait_event_timeout()` và `msleep()`. Cả hai đều được triển khai với sự trợ giúp của `schedule_timeout()`. `wait_event_timeout()` được sử dụng khi mã của bạn muốn tiếp tục thực thi nếu một điều kiện được chỉ định trở thành đúng hoặc nếu xảy ra thời gian chờ. `msleep()` thực hiện ngủ trong một số mili-giây được chỉ định.

Các kỹ thuật trễ dài như vậy chỉ thích hợp để sử dụng từ ngữ cảnh tiến trình (process context). Việc chờ-ngủ không thể được thực hiện từ ngữ cảnh ngắt (interrupt context) vì các trình xử lý ngắt (interrupt handler) không được phép gọi `schedule()` hoặc đi ngủ. (Xem phần "Xử lý Ngắt" - "Interrupt Handling" trong Chương 4 để biết danh sách những việc nên làm và không nên làm đối với mã thực thi trong ngữ cảnh ngắt). Chờ-bận trong một khoảng thời gian ngắn có thể thực hiện được từ ngữ cảnh ngắt, nhưng chờ-bận kéo dài trong ngữ cảnh đó được coi là một tội lỗi tày đình. Việc chờ-bận kéo dài khi các ngắt bị vô hiệu hóa (disabled) cũng là điều tối kỵ tương tự.

Kernel cũng cung cấp các API bộ định thời (timer API) để thực thi một hàm tại một thời điểm trong tương lai. Bạn có thể định động một timer bằng cách sử dụng `init_timer()` hoặc tạo tĩnh nó bằng `DEFINE_TIMER()`. Sau khi thực hiện việc này, hãy điền các thông tin vào một `timer_list` với địa chỉ và các tham số của hàm xử lý (handler function) của bạn, sau đó đăng ký nó bằng cách sử dụng `add_timer()`:

```

## include <linux/timer.h>

struct timer_list my_timer;
init_timer(&my_timer); /* Xem thêm setup_timer() */
my_timer.expire = jiffies + n*HZ; /* n là thời gian chờ tính bằng
số giây */
my_timer.function = timer_func; /* Hàm được thực thi
sau n giây */
my_timer.data = func_parameter; /* Tham số được truyền
tới timer_func */
add_timer(&my_timer); /* Bắt đầu timer */

```

Lưu ý rằng đây là một timer chạy một lần (one-shot timer). Nếu bạn muốn chạy `timer_func()` định kỳ, bạn cũng cần thêm đoạn mã trước đó vào bên trong `timer_func()` để nó tự lên lịch cho lần chờ tiếp theo:

```

static void timer_func(unsigned long func_parameter)
{
/* Thực hiện công việc cần làm định kỳ */
/* ... */
init_timer(&my_timer);
my_timer.expire = jiffies + n*HZ;
my_timer.data = func_parameter;
my_timer.function = timer_func;
add_timer(&my_timer);
}

```

Bạn có thể sử dụng `mod_timer()` để thay đổi thời điểm hết hạn của `my_timer`, `del_timer()` để hủy `my_timer`, và `timer_pending()` để kiểm tra xem `my_timer` có đang chờ xử lý hay không. Nếu bạn xem xét tệp *kernel/timer.c*, bạn sẽ thấy rằng `schedule_timeout()` sử dụng nội bộ chính các API này.

Các hàm ở user space như `clock_settime()` và `clock_gettime()` được sử dụng để truy cập các dịch vụ timer của kernel từ không gian người dùng. Một ứng dụng người dùng có thể sử dụng `setitimer()` và `getitimer()` để kiểm soát việc gửi tín hiệu cảnh báo (alarm signal) khi một khoảng thời gian chờ được chỉ định hết hạn.

### Độ trễ ngắn (Short Delays)

Theo thuật ngữ của kernel, độ trễ nhỏ hơn một jiffy (sub-jiffy delays) được coi là khoảng thời gian ngắn. Những độ trễ như vậy thường được yêu cầu từ cả ngữ cảnh tiến trình (process context) và ngữ cảnh ngắt (interrupt context). Do không thể sử dụng các phương pháp dựa trên jiffy để thực hiện độ trễ dưới một jiffy, các phương pháp được thảo luận trong phần trước để ngủ-chờ (sleep-wait) không thể áp dụng cho các khoảng thời gian chờ (timeout) nhỏ. Giải pháp duy nhất là bận-chờ (busy-wait).

Các API của kernel thực hiện độ trễ ngắn là `mdelay()`, `udelay()` và `ndelay()`, tương ứng hỗ trợ độ trễ tính bằng mili-giây, micro-giây và nano-giây. Việc hiện thực thực tế của các hàm này phụ thuộc vào kiến trúc (architecture-specific) và có thể không khả dụng trên tất cả các nền tảng.

Việc bận-chờ trong các khoảng thời gian ngắn được thực hiện bằng cách đo thời gian bộ vi xử lý (processor) mất để thực thi một lệnh và lặp lại trong số lần lặp cần thiết. Như đã thảo luận trước đó trong chương này, kernel thực hiện phép đo này trong quá trình khởi động (boot) và lưu trữ giá trị vào một biến gọi là `loops_per_jiffy`. Các API độ trễ ngắn sử dụng `loops_per_jiffy` để quyết định số lần chúng cần thực hiện vòng lặp bận (busy-loop). Để đạt được độ trễ 1 micro-giây trong quá trình bắt tay (handshake), trình điều khiển bộ điều khiển máy chủ USB (USB host controller driver), *drivers/usb/host/ehci-hcd.c*, gọi `udelay()`, hàm này sử dụng nội bộ `loops_per_jiffy`:

```c

do {
result = ehci_readl(ehci, ptr);
/* ... */
if (result == done) return 0;
udelay(1); /* Sử dụng loops_per_jiffy ở bên trong */
usec--;
} while (usec > 0);

```

### Bộ đếm dấu thời gian Pentium (Pentium Time Stamp Counter)

*Time Stamp Counter* (TSC) là một thanh ghi 64-bit có mặt trong các bộ vi xử lý tương thích với Pentium, có nhiệm vụ đếm số chu kỳ xung nhịp mà bộ vi xử lý tiêu thụ kể từ khi khởi động. Do TSC được tăng lên theo tốc độ chu kỳ của bộ vi xử lý, nó cung cấp một bộ hẹn giờ độ phân giải cao (high-resolution timer). TSC thường được sử dụng để định hình (profiling) và đo đạc mã nguồn (instrumenting code). Nó được truy cập bằng cách sử dụng lệnh `rdtsc` để đo thời gian thực thi của đoạn mã ở giữa với độ chính xác đến micro-giây. Các nhịp TSC có thể được chuyển đổi thành giây bằng cách chia cho tốc độ xung nhịp CPU, có thể đọc được từ biến của kernel, `cpu_khz`.

Trong đoạn mã sau, `low_tsc_ticks` chứa 32 bit thấp của TSC, trongขณะ `high_tsc_ticks` chứa 32 bit cao. 32 bit thấp sẽ bị tràn (overflow) trong vài giây tùy thuộc vào tốc độ bộ vi xử lý của bạn, nhưng như vậy là đủ cho nhiều mục đích đo đạc mã nguồn như được minh họa ở đây:

```c

unsigned long low_tsc_ticks0, high_tsc_ticks0;
unsigned long low_tsc_ticks1, high_tsc_ticks1;
unsigned long exec_time;
rdtsc(low_tsc_ticks0, high_tsc_ticks0); /* Dấu thời gian trước */
printk("Hello World\n"); /* Mã nguồn cần định hình */
rdtsc(low_tsc_ticks1, high_tsc_ticks1); /* Dấu thời gian sau */
exec_time = low_tsc_ticks1 - low_tsc_ticks0;

```

`exec_time` đo được là 871 (hoặc nửa micro-giây) trên một máy Pentium 1.8GHz.

Hỗ trợ cho các bộ định thời độ phân giải cao (`CONFIG_HIGH_RES_TIMERS`) đã được hợp nhất vào kernel 2.6.21. Nó tận dụng các bộ định thời tốc độ cao đặc thù của phần cứng (hardware-specific high-speed timers) để cung cấp khả năng độ chính xác cao cho các API như `nanosleep()`. Trên các máy dòng Pentium, kernel tận dụng TSC để cung cấp tính năng này.

## Real Time Clock (Đồng hồ thời gian thực)

RTC theo dõi thời gian tuyệt đối trong bộ nhớ không bay hơi (nonvolatile memory). Trên các máy tính cá nhân x86, các thanh ghi RTC cấu thành vài vị trí cao nhất của một vùng nhớ nhỏ thuộc bộ nhớ *complementary metal oxide semiconductor* (CMOS) chạy bằng pin[4]. Hãy xem Hình 5.1 trong Chương 5, "Character Drivers" (Trình điều khiển ký tự), để biết vị trí của CMOS trong kiến trúc PC kế thừa (legacy PC architecture). Trên các hệ thống nhúng (embedded systems), RTC có thể được tích hợp bên trong bộ xử lý (processor), hoặc kết nối ngoại vi thông qua các bus I2C hoặc SPI được thảo luận trong Chương 8, "The Inter-Integrated Circuit Protocol."

[4] Pin RTC kéo dài trong nhiều năm và thường vượt quá tuổi thọ của máy tính, vì vậy bạn hầu như không bao giờ phải thay thế chúng.

Bạn có thể sử dụng RTC để thực hiện các công việc sau:

- Đọc và thiết lập đồng hồ tuyệt đối, đồng thời tạo ra các ngắt (interrupts) trong quá trình cập nhật đồng hồ.
- Tạo ra các ngắt định kỳ (periodic interrupts) với tần số dao động từ 2Hz đến 8192Hz.
- Thiết lập báo thức (alarms)

Nhiều ứng dụng cần khái niệm về thời gian tuyệt đối hoặc *wall time* (thời gian thực tế theo lịch). Bởi vì jiffies mang tính tương đối so với thời điểm hệ thống khởi động (boot), nó không chứa wall time. Kernel duy trì wall time trong một biến gọi là xtime. Trong quá trình khởi động, xtime được khởi tạo về thời gian thực tế hiện tại bằng cách đọc từ RTC. Khi hệ thống dừng hoạt động (halt), wall time được ghi trở lại RTC. Bạn có thể sử dụng `do_gettimeofday()` để đọc wall time với độ phân giải cao nhất được hỗ trợ bởi phần cứng:

```c

## include <linux/time.h>

static struct timeval curr_time;
do_gettimeofday(&curr_time);
my_timestamp = cpu_to_le32(curr_time.tv_sec); /* Record timestamp */

```

Ngoài ra còn có một loạt các hàm khả dụng cho mã tầng người dùng (user-space code) để truy cập wall time. Chúng bao gồm:

- `time()`, trả về thời gian lịch (calendar time), hoặc số giây kể từ mốc Epoch (00:00:00 ngày 1 tháng 1 năm 1970)
- `localtime()`, trả về thời gian lịch ở định dạng đã được tách thành các thành phần thời gian (broken-down format)
- `mktime()`, thực hiện chức năng ngược lại với `localtime()`

`gettimeofday()`, trả về thời gian lịch với độ chính xác đến micro giây nếu nền tảng của bạn hỗ trợ.

Một cách khác để sử dụng RTC từ không gian người dùng (user space) là thông qua thiết bị ký tự (character device), */dev/rtc*. Chỉ có một tiến trình (process) được phép truy cập thiết bị này tại một thời điểm.

Chúng tôi thảo luận chi tiết hơn về các trình điều khiển RTC (RTC drivers) trong Chương 5 và Chương 8. Trong Chương 19, chúng tôi xây dựng một ứng dụng ví dụ của người dùng sử dụng */dev/rtc* để thực hiện công việc định kỳ với độ chính xác đến micro giây.

## Tính đồng thời trong Kernel (Concurrency in the Kernel)

Với sự xuất hiện của các máy tính xách tay đa nhân (multicore laptops), *Symmetric Multi Processing* (SMP) không còn chỉ giới hạn trong lĩnh vực của những người dùng công nghệ cao. SMP và tính cướp quyền kernel (kernel preemption) là các kịch bản tạo ra nhiều luồng thực thi (threads of execution). Các luồng này có thể thao tác đồng thời trên các cấu trúc dữ liệu chia sẻ của kernel (shared kernel data structures). Do đó, việc truy cập vào các cấu trúc dữ liệu như vậy phải được tuần tự hóa (serialized).

Hãy thảo luận về những cơ bản của việc bảo vệ các tài nguyên chia sẻ của kernel khỏi việc truy cập đồng thời. Chúng ta bắt đầu với một ví dụ đơn giản và dần dần giới thiệu các độ phức tạp như ngắt (interrupts), cướp quyền kernel (kernel preemption), và SMP.

#### Spinlock và Mutex

Một vùng mã (code area) truy cập vào tài nguyên chia sẻ được gọi là vùng găng (*critical* section). Spinlock và mutex (viết tắt của *mutual exclusion* - loại trừ tương hỗ) là hai cơ chế cơ bản được sử dụng để bảo vệ các vùng găng trong kernel. Hãy cùng xem xét từng cơ chế.

Spinlock đảm bảo rằng chỉ có một luồng duy nhất đi vào vùng găng tại một thời điểm. Bất kỳ luồng nào khác muốn đi vào vùng găng đều phải tiếp tục quay vòng bận (busy-waiting) tại cửa cho đến khi luồng đầu tiên thoát ra. Lưu ý rằng chúng ta sử dụng thuật ngữ *luồng* (*thread*) để chỉ một luồng thực thi (thread of execution), chứ không phải là một luồng kernel (kernel thread).

Cách sử dụng cơ bản của spinlock như sau:

```c

## include <linux/spinlock.h>

spinlock_t mylock = SPIN_LOCK_UNLOCKED; /* Initialize */
/* Acquire the spinlock. This is inexpensive if there

- is no one inside the critical section. In the face of
- contention, spinlock() has to busy-wait.
*/
spin_lock(&mylock);
/* ... Critical Section code ... */
spin_unlock(&mylock); /* Release the lock */

```

Ngược lại với spinlock vốn đẩy các luồng vào trạng thái quay vòng bận nếu chúng cố gắng đi vào một vùng găng đang bận, mutex đưa các luồng đang tranh chấp (contending threads) vào trạng thái ngủ (sleep) cho đến lượt chúng chiếm giữ vùng găng. Vì việc tiêu tốn chu kỳ bộ xử lý để quay vòng (spin) là điều không tốt, mutex thích hợp hơn spinlock để bảo vệ các vùng găng khi thời gian chờ ước tính là dài. Theo thuật ngữ của mutex, bất kỳ điều gì lớn hơn hai lần chuyển đổi ngữ cảnh (context switches) đều được coi là dài, bởi vì mutex phải chuyển đổi luồng đang tranh chấp sang trạng thái ngủ và chuyển đổi nó trở lại khi đến thời điểm đánh thức nó dậy.

Do đó, trong nhiều trường hợp, rất dễ để quyết định khi nào nên sử dụng spinlock hoặc mutex:

- Nếu vùng găng cần phải ngủ (sleep), bạn không có lựa chọn nào khác ngoài việc sử dụng mutex. Việc lập lịch (schedule), cướp quyền (preempt), hoặc ngủ trên một hàng đợi chờ (wait queue) sau khi đã chiếm giữ một spinlock là điều vi phạm quy tắc (illegal).
- Bởi vì mutex đưa luồng gọi vào trạng thái ngủ khi xảy ra tranh chấp, bạn không có lựa chọn nào khác ngoài việc sử dụng spinlock bên trong các trình xử lý ngắt (interrupt handlers). (Bạn sẽ tìm hiểu thêm về các ràng buộc của ngữ cảnh ngắt trong Chương 4.)

Cách sử dụng mutex cơ bản như sau:

```

## include <linux/mutex.h>

/* Khai báo tĩnh một mutex. Để khởi tạo
động một mutex, sử dụng mutex_init() */
static DEFINE_MUTEX(mymutex);
/* Chiếm giữ mutex. Thao tác này có chi phí thấp nếu không có

- ai ở bên trong vùng găng (critical section). Khi xảy ra
- tranh chấp (contention), mutex_lock() sẽ đưa tiến trình (thread) gọi nó vào trạng thái ngủ.
*/
mutex_lock(&mymutex);
/* ... Mã nguồn của vùng găng ... */
mutex_unlock(&mymutex); /* Giải phóng mutex */

```

Để minh họa cho việc sử dụng cơ chế bảo vệ đồng thời (concurrency protection), hãy bắt đầu với một vùng găng chỉ tồn tại trong ngữ cảnh tiến trình (process context) và dần dần đưa ra các độ phức tạp theo thứ tự sau:

- Vùng găng chỉ tồn tại trong ngữ cảnh tiến trình trên máy đơn xử lý (Uniprocessor - UP) chạy nhân không cho phép trưng dụng (nonpreemptible kernel). **1.**
- Vùng găng tồn tại trong ngữ cảnh tiến trình và ngắt (interrupt contexts) trên máy UP chạy nhân không cho phép trưng dụng. **2.**
- **3.** Vùng găng tồn tại trong ngữ cảnh tiến trình và ngắt trên máy UP chạy nhân cho phép trưng dụng (preemptible kernel).
- Vùng găng tồn tại trong ngữ cảnh tiến trình và ngắt trên máy đa xử lý đối xứng (SMP) chạy nhân cho phép trưng dụng. **4.**

### Giao diện Semaphore Cũ

Giao diện mutex, dùng để thay thế cho giao diện semaphore cũ hơn, bắt nguồn từ nhánh –rt (–rt tree) và được hợp nhất vào nhánh chính (mainline) kể từ phiên bản nhân 2.6.16. Tuy nhiên, giao diện semaphore vẫn tồn tại. Cách sử dụng cơ bản của giao diện semaphore như sau:

```

## include <asm/semaphore.h> /* Tệp tiêu đề

phụ thuộc kiến trúc */
/* Khai báo tĩnh một semaphore. Để khởi tạo
động một semaphore, sử dụng init_MUTEX() */
static DECLARE_MUTEX(mysem);
down(&mysem); /* Chiếm giữ semaphore */
/* ... Mã nguồn của vùng găng ... */
up(&mysem); /* Giải phóng semaphore */

```

Semaphore có thể được cấu hình để cho phép một số lượng thread xác định trước cùng một lúc đi vào vùng găng. Tuy nhiên, các semaphore cho phép nhiều hơn một chủ sở hữu tại một thời điểm rất hiếm khi được sử dụng.

#### Trường hợp 1: Ngữ cảnh tiến trình, Máy UP, Không trưng dụng (No Preemption)

Đây là trường hợp đơn giản nhất và không cần cơ chế khóa (locking), vì vậy chúng ta sẽ không bàn thêm về trường hợp này.

#### Trường hợp 2: Ngữ cảnh tiến trình và ngắt, Máy UP, Không trưng dụng

Trong trường hợp này, bạn chỉ cần vô hiệu hóa ngắt (disable interrupts) để bảo vệ vùng găng. Để hiểu lý do tại sao, giả sử rằng A và B là các thread ở ngữ cảnh tiến trình, và C là một thread ở ngữ cảnh ngắt, tất cả cùng tranh giành để đi vào cùng một vùng găng, như được hiển thị trong Hình 2.4.

**Hình 2.4. Các thread ngữ cảnh tiến trình và ngắt bên trong một vùng găng.**

```

Ngữ cảnh tiến trình              Ngữ cảnh tiến trình              Ngữ cảnh ngắt
Thread A                         Thread B                        Thread C
(A)                             (B)                             (C)

|                               |                               |
|                               |                               |
v                               v                               v
+---+                           +---+                            +---+

| A |                           | B |                            | C |
+---+                           +---+                            +---+
|                               |                               |  ^
|                               |                               |  |
|-------------------------------.-------------------------------|  |
\               |              /                   |
\  ____________|             /                    |
_____________v v                         v                    |

|        +-----|---------------------------------+             |
|        |     |         VÙNG GĂNG               |             |
|        +-----|---------------------------------+             |
|             / \                                              |
|     Thread A   Thread B                                      |
Vô hiệu hóa ngắt <---|                                                              |

|
Khôi phục trạng thái ngắt <--------------------------------------------------------------|

```

Vì Thread C đang thực thi trong ngữ cảnh ngắt và luôn chạy cho đến khi hoàn thành trước khi nhường quyền cho Thread A hoặc Thread B, nó không cần phải lo lắng về việc bảo vệ. Về phần mình, Thread A không cần phải bận tâm về Thread B (và ngược lại) vì nhân không cho phép trưng dụng (nonpreemptible). Do đó, Thread A và Thread B chỉ cần đề phòng khả năng Thread C đột nhập vào vùng găng trong khi chúng đang ở bên trong cùng vùng đó. Chúng đạt được điều này bằng cách vô hiệu hóa ngắt trước khi bước vào vùng găng:

```

Point A:
local_irq_disable(); /* Vô hiệu hóa ngắt trên CPU cục bộ */
/* ... Vùng Găng (Critical Section) ... */
local_irq_enable(); /* Bật lại ngắt trên CPU cục bộ */

```

Tuy nhiên, nếu các ngắt đã bị vô hiệu hóa từ trước khi tiến trình thực thi đến Point A, hàm `local_irq_enable()` sẽ tạo ra một tác dụng phụ không mong muốn là bật lại ngắt, thay vì khôi phục trạng thái ngắt ban đầu. Vấn đề này có thể được khắc phục như sau:

```

unsigned long flags;
Point A:
local_irq_save(flags); /* Vô hiệu hóa ngắt */
/* ... Vùng Găng (Critical Section) ... */
local_irq_restore(flags); /* Khôi phục trạng thái về đúng
như tại Point A */

```

Cách này hoạt động chính xác bất kể trạng thái ngắt tại Point A là gì.

**Trường hợp 3: Ngữ cảnh Tiến trình (Process Context) và Ngữ cảnh Ngắt (Interrupt Context), Máy tính đơn nhân (UP Machine), Chế độ Tiếm quyền (Preemption)**

Nếu tính năng tiền chiếm (preemption) được bật, việc chỉ đơn thuần vô hiệu hóa ngắt sẽ không thể bảo vệ vùng găng (critical region) của bạn khỏi bị xâm phạm. Tồn tại khả năng có nhiều luồng (thread) đồng thời truy cập vào vùng găng trong ngữ cảnh tiến trình (process context). Nhìn lại Hình 2.4 trong kịch bản này, Thread A và Thread B giờ đây cần phải tự bảo vệ lẫn nhau, đồng thời phải đề phòng cả Thread C. Giải pháp hiển nhiên là vô hiệu hóa khả năng tiền chiếm nhân (kernel preemption) trước khi bắt đầu vùng găng và bật lại nó ở cuối, bên cạnh việc vô hiệu hóa/bật lại ngắt.

Đối với việc này, Thread A và Thread B sử dụng biến thể *irq* của khóa quay (spinlock):

```

unsigned long flags;
Point A:
/* Lưu trạng thái ngắt.

- Vô hiệu hóa ngắt - thao tác này đồng thời vô hiệu hóa tiền chiếm (preemption) */
spin_lock_irqsave(&mylock, flags);
/* ... Vùng Găng (Critical Section) ... */
/* Khôi phục trạng thái ngắt về như tại Point A */
spin_unlock_irqrestore(&mylock, flags);

```

Trạng thái tiền chiếm (preemption state) không cần phải được khôi phục một cách tường minh về như tại Point A, bởi vì nhân hệ điều hành (kernel) sẽ tự động làm thay bạn thông qua một biến được gọi là *bộ đếm tiền chiếm (preemption counter).* Bộ đếm này sẽ tăng lên bất cứ khi nào tiền chiếm bị vô hiệu hóa (sử dụng `preempt_disable()`) và giảm đi bất cứ khi nào tiền chiếm được bật lại (sử dụng `preempt_enable()`). Tiền chiếm chỉ thực sự diễn ra khi giá trị bộ đếm bằng không.

#### Trường hợp 4: Ngữ cảnh Tiến trình (Process Context) và Ngữ cảnh Ngắt (Interrupt Context), Máy tính đa nhân (SMP Machine), Chế độ Tiếm quyền (Preemption)

Bây giờ, chúng ta giả sử rằng vùng găng được thực thi trên một máy tính đa xử lý đối xứng (SMP machine). Nhân hệ điều hành của bạn đã được cấu hình với `CONFIG_SMP` và `CONFIG_PREEMPT` được bật.

Trong các kịch bản đã thảo luận cho đến nay, các nguyên thủy khóa quay (spinlock primitives) hầu như chỉ làm nhiệm vụ bật/tắt tiền chiếm và ngắt. Chức năng khóa thực sự đã được loại bỏ khi biên dịch (compile away). Khi có mặt của SMP, logic khóa sẽ được biên dịch vào mã nguồn, và các nguyên thủy spinlock trở nên an toàn trong môi trường SMP (SMP-safe). Ngữ nghĩa hỗ trợ SMP diễn ra như sau:

```

unsigned long flags;
Point A:
/*

- Lưu trạng thái ngắt trên CPU cục bộ (local CPU)
- Vô hiệu hóa ngắt trên CPU cục bộ. Thao tác này đồng thời vô hiệu hóa
tiền chiếm (preemption).

- Khóa vùng này để điều tiết quyền truy cập từ các CPU khác
*/
spin_lock_irqsave(&mylock, flags);
/* ... Vùng Găng (Critical Section) ... */
/*

- Khôi phục trạng thái ngắt và tiền chiếm về như
tại Point A đối với CPU cục bộ

- Nhả khóa (Release lock)
*/
spin_unlock_irqrestore(&mylock, flags);

```

Trên các hệ thống SMP, chỉ có các ngắt trên CPU cục bộ bị vô hiệu hóa khi một spinlock được chiếm giữ. Do đó, một luồng trong ngữ cảnh tiến trình (chẳng hạn Thread A trong Hình 2.4) có thể đang chạy trên một CPU, trong khi trình xử lý ngắt (interrupt handler, chẳng hạn Thread C trong Hình 2.4) đang thực thi trên một CPU khác. Do đó, một trình xử lý ngắt trên bộ vi xử lý phi cục bộ (nonlocal processor) cần phải quay vòng chờ đợi (spin-wait) cho đến khi mã nguồn ngữ cảnh tiến trình trên bộ vi xử lý cục bộ thoát khỏi vùng găng. Mã nguồn trong ngữ cảnh ngắt gọi `spin_lock()`/`spin_unlock()` để thực hiện việc này:

```

spin_lock(&mylock);
/* ... Vùng Găng (Critical Section) ... */
spin_unlock(&mylock);

```

Tương tự như các biến thể irq, spinlock cũng có các biến thể *nửa dưới* (bottom half - BH). `spin_lock_bh()` vô hiệu hóa các nửa dưới khi khóa được chiếm giữ, trong khi `spin_unlock_bh()` bật lại các nửa dưới khi khóa được nhả ra. Chúng ta sẽ thảo luận về nửa dưới (bottom halves) ở Chương 4.

> **Nhánh –rt (The –rt tree)**
>
> Nhánh thời gian thực (-rt) (real-time tree), hay còn gọi là tập bản vá `CONFIG_PREEMPT_RT` (CONFIG_PREEMPT_RT patch-set), triển khai các sửa đổi có độ trễ thấp (low-latency) cho nhân hệ điều hành. Tập bản vá này có thể tải xuống từ www.kernel.org/pub/linux/kernel/projects/rt, cho phép phần lớn nhân hệ điều hành có thể bị tiền chiếm (preempted), một phần bằng cách thay thế nhiều spinlock bằng các mutex. Nó cũng tích hợp các bộ định thời độ phân giải cao (high-resolution timers). Một số tính năng của nhánh -rt đã được tích hợp vào nhân chính thống (mainline kernel). Bạn sẽ tìm thấy tài liệu chi tiết tại trang wiki của dự án được lưu trữ tại http://rt.wiki.kernel.org/.

Nhân hệ điều hành sở hữu các nguyên thủy khóa chuyên biệt trong kho công cụ của mình giúp cải thiện hiệu suất trong các điều kiện cụ thể. Việc sử dụng một cơ chế loại trừ lẫn nhau (mutual-exclusion scheme) được thiết kế riêng cho nhu cầu của bạn sẽ làm cho mã nguồn trở nên mạnh mẽ hơn. Hãy cùng xem xét một số cơ chế loại trừ chuyên biệt.

## Các toán tử nguyên tử (Atomic Operators)
```

*Các toán tử nguyên tử* (Atomic operators) được sử dụng để thực hiện các thao tác một lần (one-shot) gọn nhẹ như tăng giảm bộ đếm, tăng có điều kiện và thiết lập vị trí bit. Các thao tác nguyên tử được đảm bảo là tuần tự hóa (serialized) và không cần khóa (lock) để bảo vệ chống lại việc truy cập đồng thời (concurrent access). Việc triển khai các toán tử nguyên tử phụ thuộc vào kiến trúc phần cứng (architecture-dependent).

Để kiểm tra xem có còn tham chiếu dữ liệu nào trước khi giải phóng một bộ đệm mạng kernel (gọi là skbuff) hay không, hàm `skb_release_data()` được định nghĩa trong *net/core/skbuff.c* thực hiện các thao tác sau:

```
if (!skb->cloned ||
 /* Giảm giá trị nguyên tử và kiểm tra xem giá trị trả về có bằng không hay không */
 !atomic_sub_return(skb->nohdr ? (1 << SKB_DATAREF_SHIFT) + 1 :
 1,&skb_shinfo(skb)->dataref)) {
 /* ... */
 kfree(skb->head);
}
```

Trong khi `skb_release_data()` đang được thực thi như vậy, một luồng (thread) khác sử dụng `skb_clone()` (được định nghĩa trong cùng tệp) có thể đồng thời tăng bộ đếm tham chiếu dữ liệu:

```
/* ... */
/* Tăng bộ đếm tham chiếu dữ liệu một cách nguyên tử */
atomic_inc(&(skb_shinfo(skb)->dataref));
/* ... */
```

Việc sử dụng các toán tử nguyên tử giúp bảo vệ bộ đếm tham chiếu dữ liệu khỏi bị ghi đè hỗn loạn bởi hai luồng này. Nó cũng loại bỏ sự phức tạp khi phải sử dụng các khóa (lock) để bảo vệ một biến số nguyên đơn lẻ khỏi việc truy cập đồng thời.

Kernel cũng hỗ trợ các toán tử như `set_bit()`, `clear_bit()`, và `test_and_set_bit()` để thực hiện các thao tác trên bit một cách nguyên tử. Hãy tham khảo *include/asm-your-arch/atomic.h* để biết các toán tử nguyên tử được hỗ trợ trên kiến trúc của bạn.

### Khóa Đọc-Ghi (Reader-Writer Locks)

Một cơ chế điều tiết tính đồng thời (concurrency) chuyên biệt khác là biến thể đọc-ghi của spinlock (reader-writer variant of spinlocks). Nếu việc sử dụng một vùng găng (critical section) theo kiểu các luồng riêng biệt hoặc chỉ đọc hoặc chỉ ghi vào một cấu trúc dữ liệu chia sẻ, chứ không thực hiện cả hai, thì các khóa này là sự lựa chọn hoàn hảo. Nhiều luồng đọc được phép truy cập vào bên trong một vùng găng cùng một lúc. Spinlock đọc (reader spinlock) được định nghĩa như sau:

```
rwlock_t myrwlock = RW_LOCK_UNLOCKED;
read_lock(&myrwlock); /* Lấy khóa đọc */
/* ... Vùng găng (Critical Region) ... */
read_unlock(&myrwlock); /* Giải phóng khóa */
```

Tuy nhiên, nếu một luồng ghi (writer thread) bước vào vùng găng, các luồng đọc hoặc ghi khác sẽ không được phép đi vào. Để sử dụng spinlock ghi (writer spinlock), bạn sẽ viết như sau:

```
rwlock_t myrwlock = RW_LOCK_UNLOCKED;
write_lock(&myrwlock); /* Lấy khóa ghi */
/* ... Vùng găng (Critical Region) ... */
write_unlock(&myrwlock); /* Giải phóng khóa */
```

Hãy xem mã định tuyến IPX có trong *net/ipx/ipx_route.c* để có một ví dụ thực tế về spinlock đọc-ghi. Một khóa đọc-ghi có tên là `ipx_routes_lock` bảo vệ bảng định tuyến IPX khỏi việc truy cập đồng thời. Các luồng cần tra cứu bảng định tuyến để chuyển tiếp gói tin sẽ yêu cầu khóa đọc. Các luồng cần thêm hoặc xóa các mục khỏi bảng định tuyến sẽ lấy khóa ghi. Điều này cải thiện hiệu suất vì số lượng các lệnh tra cứu bảng định tuyến thường lớn hơn rất nhiều so với các lệnh cập nhật bảng định tuyến.

Giống như các spinlock thông thường, khóa đọc-ghi cũng có các biến thể ngắt (irq variants) tương ứng—cụ thể là `read_lock_irqsave()`, `read_lock_irqrestore()`, `write_lock_irqsave()`, và `write_lock_irqrestore()`. Ngữ nghĩa của các hàm này tương tự như các hàm của spinlock thông thường.

Khóa tuần tự hay *seqlock* (sequence locks), được giới thiệu trong kernel 2.6, là các khóa đọc-ghi trong đó các tiến trình ghi được ưu tiên hơn các tiến trình đọc. Điều này rất hữu ích nếu các thao tác ghi trên một biến vượt trội hơn nhiều so với số lần truy cập đọc. Một ví dụ là biến `jiffies_64` được thảo luận trước đó trong chương này. Các luồng ghi không phải chờ đợi các luồng đọc có thể đang ở bên trong vùng găng. Do đó, các luồng đọc có thể phát hiện ra rằng việc truy cập vào vùng găng của chúng đã thất bại và có thể cần phải thử lại:

```
u64 get_jiffies_64(void) /* Được định nghĩa trong kernel/time.c */
{
 unsigned long seq;
 u64 ret;
 do {
 seq = read_seqbegin(&xtime_lock);
 ret = jiffies_64;
 } while (read_seqretry(&xtime_lock, seq));
 return ret;
}
```

Người ghi bảo vệ các vùng găng bằng cách sử dụng `write_seqlock()` và `write_sequnlock()`.

Kernel 2.6 đã giới thiệu một cơ chế khác có tên là *Cập nhật Đọc-Sao chép* (Read-Copy Update - RCU), mang lại hiệu suất cải thiện khi số lượng luồng đọc vượt trội hơn nhiều so với luồng ghi. Ý tưởng cơ bản là các luồng đọc có thể thực thi mà không cần khóa (locking). Các luồng ghi phức tạp hơn. Chúng thực hiện các thao tác cập nhật trên một bản sao của cấu trúc dữ liệu và thay thế con trỏ mà các luồng đọc nhìn thấy. Bản sao ban đầu được duy trì cho đến lần chuyển ngữ cảnh (context switch) tiếp theo trên tất cả các CPU để đảm bảo hoàn thành tất cả các thao tác đọc đang diễn ra. Xin lưu ý rằng việc sử dụng RCU phức tạp hơn so với việc sử dụng các nguyên thủy (primitives) đã thảo luận cho đến nay và chỉ nên được sử dụng nếu bạn chắc chắn đó là công cụ phù hợp cho công việc. Các cấu trúc dữ liệu và hàm giao diện RCU được định nghĩa trong *include/linux/rcupdate.h.* Có rất nhiều tài liệu trong *Documentation/RCU/\**.

Để xem ví dụ về cách sử dụng RCU, hãy xem *fs/dcache.c.* Trên Linux, mỗi tệp được liên kết với thông tin mục thư mục (được lưu trữ trong một cấu trúc gọi là *dentry*), thông tin siêu dữ liệu (được lưu trữ trong một inode) và dữ liệu thực tế (được lưu trữ trong các khối dữ liệu). Mỗi khi bạn thao tác trên một tệp, các thành phần trong đường dẫn tệp được phân tích cú pháp và các dentry tương ứng sẽ được lấy ra. Các dentry được giữ trong bộ nhớ đệm (cache) trong một cấu trúc dữ liệu gọi là *dcache*, nhằm tăng tốc độ các thao tác trong tương lai. Tại bất kỳ thời điểm nào, số lượng thao tác tra cứu dcache lớn hơn rất nhiều so với các thao tác cập nhật dcache, vì vậy các tham chiếu đến dcache được bảo vệ bằng cách sử dụng các nguyên thủy RCU.

### Gỡ lỗi (Debugging)

Các vấn đề liên quan đến tính đồng thời (concurrency) nhìn chung rất khó gỡ lỗi (debug) vì chúng thường khó tái tạo lại. Bạn nên bật SMP (`CONFIG_SMP`) và tính năng chiếm quyền tiền nhiệm (preemption - `CONFIG_PREEMPT`) khi biên dịch và kiểm thử mã nguồn của mình, ngay cả khi kernel sản xuất (production kernel) của bạn sẽ chạy trên máy đơn xử lý (UP machine) đã vô hiệu hóa tính năng preemption. Có một tùy chọn cấu hình kernel nằm trong mục *Kernel hacking* có tên là *Spinlock and rw-lock debugging* (`CONFIG_DEBUG_SPINLOCK`) có thể giúp bạn phát hiện một số lỗi spinlock phổ biến. Ngoài ra, các công cụ như lockmeter [\(http://oss.sgi.com/projects/lockmeter/](http://oss.sgi.com/projects/lockmeter/)) chuyên thu thập các số liệu thống kê liên quan đến khóa (lock) cũng sẵn có để sử dụng.

Một vấn đề đồng thời phổ biến xảy ra khi bạn quên khóa việc truy cập vào một tài nguyên được chia sẻ (shared resource). Điều này dẫn đến việc các luồng (thread) khác nhau "cạnh tranh" (*racing*) qua quyền truy cập đó một cách không có kiểm soát. Vấn đề này, được gọi là *race condition* (điều kiện tranh chấp), có thể biểu hiện dưới dạng hành vi mã nguồn kỳ lạ thỉnh thoảng xuất hiện.

Một vấn đề tiềm ẩn khác phát sinh khi bạn bỏ sót việc giải phóng các khóa đang giữ trên một số đường dẫn mã nguồn nhất định, dẫn đến tình trạng bế tắc (*deadlock*). Để hiểu điều này, hãy xem xét ví dụ sau:

```c
spin_lock(&mylock); /* Lấy khóa (Acquire lock) */
/* ... Vùng găng (Critical Section) ... */
if (error) { /* Điều kiện lỗi này hiếm khi xảy ra */
 return -EIO; /* Quên giải phóng khóa! */
}
spin_unlock(&mylock); /* Giải phóng khóa (Release lock) */
```

Sau khi điều kiện lỗi xảy ra, bất kỳ luồng nào cố gắng lấy khóa `mylock` đều sẽ bị bế tắc (deadlock), và kernel có thể bị đóng băng (freeze).

Nếu vấn đề xuất hiện lần đầu tiên vào nhiều tháng hoặc nhiều năm sau khi bạn viết mã, việc quay lại và gỡ lỗi nó sẽ càng trở nên khó khăn hơn gấp bội. (Có một ví dụ gỡ lỗi liên quan trong phần "Kdump" ở Chương 21, "Gỡ lỗi Trình điều khiển Thiết bị" [Debugging Device Drivers]). Để tránh những tình huống khó chịu như vậy, logic đồng thời nên được thiết kế ngay từ khi bạn kiến trúc hóa phần mềm của mình.

## Hệ thống tệp Tiến trình (Process Filesystem)

Hệ thống tệp tiến trình (*procfs*) là một hệ thống tệp ảo tạo ra các "cửa sổ" nhìn vào bên trong ruột gan của kernel. Dữ liệu bạn thấy khi duyệt procfs được kernel tạo ra ngay tại thời điểm đó (on-the-fly). Các tệp trong procfs được sử dụng để cấu hình các tham số của kernel, xem các cấu trúc kernel, thu thập số liệu thống kê từ các trình điều khiển thiết bị (device drivers) và lấy thông tin hệ thống chung.

Procfs là một hệ thống tệp giả (pseudo filesystem). Điều này có nghĩa là các tệp nằm trong procfs không được liên kết với các thiết bị lưu trữ vật lý như ổ đĩa cứng. Thay vào đó, dữ liệu trong các tệp đó được tạo động theoπ yêu cầu bởi các điểm entry point tương ứng trong kernel. Do đó, kích thước tệp trong procfs luôn được hiển thị bằng không. Procfs thường được gắn kết (mount) dưới thư mục */proc* trong quá trình khởi động kernel; bạn có thể thấy điều này bằng cách gọi lệnh `mount`.

Để có cảm nhận ban đầu về các tính năng của procfs, hãy kiểm tra nội dung của */proc/cpuinfo*, */proc/meminfo*, */proc/interrupts*, */proc/tty/driver/serial*, */proc/bus/usb/devices*, và */proc/stat*. Một số tham số kernel nhất định có thể được thay đổi tại thời điểm chạy (runtime) bằng cách ghi vào các tệp dưới thư mục */proc/sys/*. Ví dụ, bạn có thể thay đổi các mức nhật ký printk của kernel bằng cách ghi đè một tập hợp giá trị mới vào */proc/sys/kernel/printk*. Nhiều tiện ích (chẳng hạn như `ps`) và các công cụ giám sát hiệu suất hệ thống (chẳng hạn như `sysstat`) lấy thông tin một cách nội bộ từ các tệp nằm dưới thư mục */proc*.

*Seq files* (Tệp chuỗi), được giới thiệu trong nhân 2.6, giúp đơn giản hóa các thao tác procfs quy mô lớn. Chúng được mô tả trong Phụ lục C, "Seq Files."

## Cấp phát Bộ nhớ (Allocating Memory)

Một số trình điều khiển thiết bị (device drivers) cần phải nhận thức được sự tồn tại của các *vùng nhớ* (*memory zones*). Thêm vào đó, nhiều trình điều khiển cần các dịch vụ của các hàm cấp phát bộ nhớ (memory-allocation functions). Trong phần này, chúng ta hãy thảo luận ngắn gọn về cả hai vấn đề này.

Kernel tổ chức bộ nhớ vật lý thành các *trang* (*pages*). Kích thước trang phụ thuộc vào kiến trúc phần cứng. Trên các máy tính dựa trên kiến trúc x86, kích thước này là 4096 byte. Mỗi trang trong bộ nhớ vật lý đều có một cấu trúc `struct page` (được định nghĩa trong *include/linux/mm_types.h*) đi kèm:

```c
struct page {
 unsigned long flags; /* Trạng thái trang (Page status) */
 atomic_t _count; /* Số đếm tham chiếu (Reference count) */
 /* ... */
 void * virtual; /* Sẽ được giải thích sau */
};
```

Trên các hệ thống x86 32-bit, cấu hình kernel mặc định chia không gian địa chỉ 4GB có sẵn thành không gian bộ nhớ ảo 3GB dành cho các tiến trình người dùng (user processes) và không gian 1GB dành cho kernel, như được minh họa trong Hình 2.5. Điều này áp đặt giới hạn 1GB đối với lượng bộ nhớ vật lý mà kernel có thể quản lý. Trên thực tế, giới hạn này là 896MB vì 128MB của không gian địa chỉ đã bị chiếm dụng bởi các cấu trúc dữ liệu của kernel. Bạn có thể tăng giới hạn này bằng cách thay đổi tỷ lệ chia 3GB/1GB trong quá trình cấu hình kernel, nhưng bạn sẽ vấp phải sự không hài lòng từ các ứng dụng ngốn nhiều bộ nhớ nếu bạn thu nhỏ không gian địa chỉ ảo của các tiến trình người dùng.

```
        4GB                                        4GB
+----------------------+                +----------------------+
|      ZONE_HIGH       |                |    KERNEL SPACE      |
|   (896MB -> 4GB)     |                |   (3GB  ->  4GB)     |
+----------------------+ 896MB          +----------------------+
|     ZONE_NORMAL      |                |                      |
|   (16MB -> 896MB)    |                |                      |
+----------------------+ 16MB           |                      |
|      ZONE_DMA        |                |     USER SPACE       |
|    (0  -> 16MB)      |                |   (0    ->  3GB)     |
+----------------------+ 0              +----------------------+
  Không gian địa chỉ vật lý             Không gian địa chỉ ảo
  (Physical Address Space)              (Virtual Address Space)
```

**Hình 2.5. Phân chia không gian địa chỉ mặc định trên hệ thống PC 32-bit.**

Các địa chỉ nhân (kernel addresses) ánh xạ tới 896MB thấp khác với địa chỉ vật lý (physical addresses) một khoảng offset hằng số và được gọi là *địa chỉ logic* (*logical addresses*). Với sự hỗ trợ của "bộ nhớ cao" (*high memory*), nhân hệ điều hành (kernel) có thể truy cập bộ nhớ vượt quá 896MB bằng cách tạo ra các *địa chỉ ảo* (*virtual addresses*) cho các vùng đó thông qua các ánh xạ đặc biệt. Tất cả các địa chỉ logic đều là địa chỉ ảo của nhân, nhưng chiều ngược lại thì không đúng.

Điều này dẫn đến các vùng nhớ của nhân (kernel memory zones) sau đây:

- ZONE\_DMA (<16MB), vùng được sử dụng cho *Truy cập bộ nhớ trực tiếp* (*Direct Memory Access* - DMA). Do các thiết bị ISA kế thừa (legacy ISA devices) có 24 đường địa chỉ và chỉ có thể truy cập 16MB đầu tiên, nhân cố gắng dành riêng khu vực này cho các thiết bị đó. **1.**
- ZONE\_NORMAL (16MB đến 896MB), vùng có thể định địa chỉ thông thường, còn gọi là bộ nhớ thấp (low memory). Trường `virtual` trong struct page cho các trang bộ nhớ thấp chứa các địa chỉ logic tương ứng. **2.**
- ZONE\_HIGH (>896MB), không gian mà nhân chỉ có thể truy cập sau khi ánh xạ các trang thường trú (resident pages) vào các vùng trong ZONE\_NORMAL (sử dụng `kmap()` và `kunmap()`). Các địa chỉ nhân tương ứng là địa chỉ ảo chứ không phải địa chỉ logic. Trường `virtual` trong struct page cho các trang bộ nhớ cao trỏ tới NULL nếu trang đó chưa được ánh xạ qua `kmap()`. **3.**

`kmalloc()` là một hàm cấp phát bộ nhớ trả về bộ nhớ liền kề (contiguous memory) từ ZONE\_NORMAL. Nguyên mẫu hàm như sau:

```c
void *kmalloc(int count, int flags);
```

Trong đó `count` là số byte cần cấp phát, và `flags` là một bộ định danh chế độ (mode specifier). Tất cả các cờ được hỗ trợ đều được liệt kê trong *include/linux/gfp.h* (`gfp` là viết tắt của *get free pages*), nhưng đây là những cờ được sử dụng phổ biến:

- GFP\_KERNEL Được sử dụng bởi mã ngữ cảnh tiến trình (process context code) để cấp phát bộ nhớ. Nếu cờ này được chỉ định, `kmalloc()` được phép chuyển sang trạng thái ngủ (sleep) và chờ các trang bộ nhớ được giải phóng. **1.**
- GFP\_ATOMIC Được sử dụng bởi mã ngữ cảnh ngắt (interrupt context code) để nắm giữ bộ nhớ. Ở chế độ này, `kmalloc()` không được phép ngủ-chờ các trang trống, do đó xác suất cấp phát thành công với `GFP_ATOMIC` thấp hơn so với `GFP_KERNEL`. **2.**

Vì bộ nhớ do `kmalloc()` trả về vẫn giữ nguyên nội dung từ lần sử dụng trước đó, nên có thể có rủi ro bảo mật nếu nó bị lộ ra không gian người dùng (user space). Để nhận được vùng nhớ `kmalloc()` đã được làm sạch về 0, hãy sử dụng `kzalloc()`.

Nếu bạn cần cấp phát các bộ nhớ đệm (buffer) lớn và không yêu cầu bộ nhớ phải liên kề về mặt vật lý, hãy sử dụng `vmalloc()` thay vì `kmalloc()`:

```c
void *vmalloc(unsigned long count);
```

Ở đây `count` là kích thước cấp phát được yêu cầu. Hàm này trả về các địa chỉ ảo của nhân (kernel virtual addresses).

`vmalloc()` có giới hạn kích thước cấp phát lớn hơn `kmalloc()` nhưng chậm hơn và không thể được gọi từ ngữ cảnh ngắt (interrupt context). Hơn nữa, bạn không thể sử dụng bộ nhớ không liên kề vật lý do `vmalloc()` trả về để thực hiện *Truy cập bộ nhớ trực tiếp* (*Direct Memory Access* - DMA). Các trình điều khiển mạng hiệu năng cao thường sử dụng `vmalloc()` để cấp phát các vòng mô tả (descriptor rings) lớn khi thiết bị được mở.

Nhân hệ điều hành cung cấp các kỹ thuật cấp phát bộ nhớ tinh vi hơn. Chúng bao gồm *bộ nhớ đệm tra cứu* (*look aside buffers*), *slab*, và *mempool*, nằm ngoài phạm vi của chương này.

## Khảo sát mã nguồn (Looking at the Sources)

Quá trình khởi động của nhân (kernel boot) bắt đầu bằng việc thực thi mã hợp ngữ chế độ thực (real mode assembly code) nằm trong thư mục *arch/x86/boot/*. Hãy xem *arch/x86/kernel/setup\_32.c* để biết cách nhân ở chế độ được bảo vệ (protected mode kernel) lấy thông tin được thu thập bởi nhân chế độ thực.

Thông điệp khởi động đầu tiên được in bởi mã nằm trong *init/main.c.* Đào sâu vào *init/calibrate.c* để tìm hiểu thêm về hiệu chỉnh BogoMIPS và *include/asm-your-arch/bugs.h* để có cái nhìn sâu sắc về các kiểm tra phụ thuộc kiến trúc (architecture-dependent checks).

```

Các dịch vụ bộ định thời (timer services) trong nhân bao gồm các phần phụ thuộc kiến trúc nằm trong *arch/your-arch/kernel/* và các phần chung được triển khai trong *kernel/timer.c.* Đối với các định nghĩa liên quan, hãy xem các tệp tiêu đề (header files), *include/linux/time\*.h*.

`jiffies` được định nghĩa trong *linux/jiffies.h.* Giá trị cho `HZ` phụ thuộc vào bộ xử lý và có thể được tìm thấy trong *include/asmyour-arch/param.h*.

Mã nguồn quản lý bộ nhớ (memory management sources) nằm ở thư mục cấp cao nhất *mm/*.

Bảng 2.1 chứa tóm tắt các cấu trúc dữ liệu chính được sử dụng trong chương này và vị trí định nghĩa của chúng trong cây mã nguồn (source tree). Bảng 2.2 liệt kê các giao diện lập trình nhân chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

**Bảng 2.1. Tóm tắt các Cấu trúc Dữ liệu**

| Cấu trúc Dữ liệu              | Vị trí                               | Mô tả                                                                                                 |
|-----------------------------|--------------------------------------|---------------------------------------------------------------------------------------------------------|
| HZ                          | include/asm-your-arch/param.h        | Số lần bộ định thời hệ thống (system timer)<br>ngắt trong 1 giây                                        |
| loops_per_jiffy             | init/main.c                          | Số lần bộ xử lý thực hiện<br>một vòng lặp trễ nội bộ trong 1 jiffy                                       |

| timer_list                  | include/linux/timer.h                | Dùng để lưu trữ địa chỉ của một routine<br>mà bạn muốn thực thi tại một thời điểm<br>nào đó trong tương lai       |
| timeval                     | include/linux/time.h                 | Dấu thời gian (Timestamp)                                                                                               |
| spinlock_t                  | include/linux/spinlock_types.h       | Cơ chế khóa bận (busy-locking mechanism) nhằm đảm bảo<br>rằng chỉ có một luồng duy nhất (single thread) bước vào vùng găng (critical section) |
| semaphore                   | include/asm-your<br>arch/semaphore.h | Cơ chế khóa ngủ (sleep-locking mechanism) cho phép một<br>số lượng người dùng được xác định trước bước vào vùng găng (critical section) |
| mutex                       | include/linux/mutex.h                | Giao diện mới thay thế cho semaphore                                                            |
| rwlock_t                    | include/linux/spinlock_types.h       | Khóa quay đọc-ghi (Reader-writer spinlock)                                                                                  |
| page                        | include/linux/mm_types.h             | Biểu diễn của Kernel đối với một trang bộ nhớ vật lý<br>(physical memory page)                                                    |

**Bảng 2.2. Tóm tắt các Giao diện Lập trình Kernel (Kernel Programming Interfaces)**

| Giao diện Kernel (Kernel Interface)                                 | Vị trí (Location)                                              | Mô tả (Description)                                                                                                                             |
|---------------------------------------------------------------------|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| time_after()<br>time_after_eq()<br>time_before()<br>ime_before_eq() | include/linux/jiffies.h                                        | So sánh giá trị hiện tại của jiffies với một<br>giá trị tương lai được chỉ định                                                                 |
| schedule_timeout()                                                  | kernel/timer.c                                                 | Lên lịch cho một tiến trình (process) chạy sau khi một khoảng<br>timeout xác định đã trôi qua                                                   |
| wait_event_timeout()                                                | include/linux/wait.h                                           | Tiếp tục thực thi nếu một điều kiện được chỉ định<br>trở thành đúng (true) hoặc nếu xảy ra timeout                                             |
| DEFINE_TIMER()                                                      | include/linux/timer.h                                          | Định nghĩa một bộ định thời (timer) theo tĩnh (statically)                                                                                      |
| init_timer()                                                        | kernel/timer.c                                                 | Định nghĩa một timer theo động (dynamically)                                                                                                    |
| add_timer()                                                         | include/linux/timer.h                                          | Lên lịch thực thi cho timer sau khi khoảng thời gian<br>timeout đã trôi qua                                                                     |
| mod_timer()                                                         | kernel/timer.c                                                 | Thay đổi thời điểm hết hạn của timer                                                                                                            |
| timer_pending()                                                     | include/linux/timer.h                                          | Kiểm tra xem một timer có đang chờ xử lý (pending) tại thời điểm hiện tại hay không                                                             |
| udelay()                                                            | include/asm-your<br>arch/delay.h arch/your<br>arch/lib/delay.c | Chờ bận (busy-wait) trong số lượng micro giây<br>được chỉ định                                                                                  |
| rdtsc()                                                             | include/asm-x86/msr.h                                          | Lấy giá trị của TSC trên các bộ vi xử lý<br>tương thích Pentium                                                                                 |
| do_gettimeofday()                                                   | kernel/time.c                                                  | Lấy thời gian thực tế (wall time)                                                                                                               |

| local_irq_disable()                                                 | include/asm-your<br>arch/system.h                              | Vô hiệu hóa ngắt (interrupts) trên CPU cục bộ (local CPU)                                                                                      |
| local_irq_enable()                                                  | include/asm-your<br>arch/system.h                              | Kích hoạt ngắt trên CPU cục bộ                                                                                                                  |
| local_irq_save()                                                    | include/asm-your<br>arch/system.h                              | Lưu trạng thái ngắt và vô hiệu hóa ngắt                                                                                                         |
| local_irq_restore()                                                 | include/asm-your<br>arch/system.h                              | Khôi phục trạng thái ngắt về lại như thời điểm<br>gọi hàm `local_irq_save()` tương ứng                                                          |
| spin_lock()                                                         | include/linux/spinlock.h<br>kernel/spinlock.c                  | Chiếm giữ một spinlock.                                                                                                                         |
| spin_unlock()                                                       | include/linux/spinlock.h                                       | Giải phóng một spinlock                                                                                                                         |
| spin_lock_irqsave()                                                 | include/linux/spinlock.h<br>kernel/spinlock.c                  | Lưu trạng thái ngắt, vô hiệu hóa ngắt và<br>tiền chiếm chỗ (preemption) trên CPU cục bộ, đồng thời khóa vùng tới hạn (critical section) của chúng để điều tiết quyền truy cập từ các CPU khác |
| spin_unlock_irqrestore()                                            | include/linux/spinlock.h<br>kernel/spinlock.c                  | Khôi phục trạng thái ngắt và tiền chiếm chỗ, đồng thời<br>giải phóng khóa                                                                     |
```

| DEFINE_MUTEX()                                                      | include/linux/mutex.h                                          | Khai báo tĩnh một mutex                                                                                                                         |
| mutex_init()                                                        | include/linux/mutex.h                                          | Khai báo động một mutex                                                                                                                         |
| mutex_lock()                                                        | kernel/mutex.c                                                 | Chiếm giữ một mutex                                                                                                                             |

| Giao diện Kernel                                                                                                                                                   | Vị trí                                        | Mô tả                                                                                        |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|----------------------------------------------------------------------------------------------|
| mutex_unlock()                                                                                                                                                     | kernel/mutex.c                                | Giải phóng một mutex                                                                         |
| DECLARE_MUTEX()                                                                                                                                                    | include/asm-your<br>arch/semaphore.h          | Khai báo tĩnh một semaphore                                                                  |
| init_MUTEX()                                                                                                                                                       | include/asm-your<br>arch/semaphore.h          | Khai báo động một semaphore                                                                  |
| up()                                                                                                                                                               | arch/your<br>arch/kernel/semaphore.c          | Giải phóng/Tăng giá trị semaphore (Release semaphore)                                        |

| down()                                                                                                                                                             | arch/your<br>arch/kernel/semaphore.c          | Chiếm giữ/Giảm giá trị semaphore (Acquire/Wait on semaphore)                                 |

```
| atomic_inc()<br>atomic_inc_and_test()<br>atomic_dec()<br>atomic_dec_and_test()<br>clear_bit()<br>set_bit()<br>test_bit()<br>test_and_set_bit()                     | include/asm-your<br>arch/atomic.h             | Các toán tử nguyên tử (atomic operator) để thực hiện các thao tác trọng lượng nhẹ (lightweight) |
| read_lock()<br>read_unlock()<br>read_lock_irqsave()<br>read_lock_irqrestore()<br>write_lock()<br>write_unlock()<br>write_lock_irqsave()<br>write_lock_irqrestore() | include/linux/spinlock.h<br>kernel/spinlock.c | Biến thể đọc-ghi (reader-writer) của Spinlock                                                |
| down_read()<br>up_read()<br>down_write()<br>up_write()                                                                                                             | kernel/rwsem.c                                | Biến thể đọc-ghi (reader-writer) của Semaphore                                               |
| read_seqbegin()<br>read_seqretry()<br>write_seqlock()<br>write_sequnlock()                                                                                         | include/linux/seqlock.h                       | Các thao tác Seqlock                                                                         |
| kmalloc()                                                                                                                                                          | include/linux/slab.h<br>mm/slab.c             | Cấp phát bộ nhớ liên tục về mặt vật lý (physically contiguous memory) từ `ZONE_NORMAL`       |
| kzalloc()                                                                                                                                                          | include/linux/slab.h<br>mm/util.c             | Lấy bộ nhớ đã được gán giá trị không (zeroed) từ `kmalloc`                                   |
| kfree()                                                                                                                                                            | mm/slab.c                                     | Giải phóng bộ nhớ đã cấp phát bằng `kmalloc`                                                 |
| vmalloc()                                                                                                                                                          | mm/vmalloc.c                                  | Cấp phát bộ nhớ liên tục về mặt ảo (virtually contiguous memory) nhưng không đảm bảo liên tục về mặt vật lý. |
