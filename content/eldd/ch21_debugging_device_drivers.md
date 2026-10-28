# Chương 21: Gỡ lỗi trình điều khiển thiết bị (Debugging Device Drivers)

| Trong chương này               |     |  |  |
|-------------------------------|-----|--|--|
| Trình gỡ lỗi Nhân (Kernel Debuggers) | 596 |  |  |
| Thăm dò Nhân (Kernel Probes) | 609 |  |  |
| Kexec và Kdump               | 620 |  |  |
| Đo hiệu năng (Profiling)      | 629 |  |  |
| Truy vết (Tracing)            | 634 |  |  |
| Dự án Kiểm thử Linux (Linux Test Project) | 638 |  |  |
| User Mode Linux               | 638 |  |  |
| Công cụ Chuẩn đoán (Diagnostic Tools) | 638 |  |  |
| Các Tùy chọn Cấu hình Hack Nhân (Kernel Hacking Config Options) | 639 |  |  |
| Thiết bị Kiểm thử (Test Equipment) | 640 |  |  |
|                               |     |  |  |

Giờ đây, khi chúng ta đã học cách triển khai các lớp trình điều khiển thiết bị (device driver) đa dạng, hãy lùi lại một bước và khám phá một số kỹ thuật gỡ lỗi (debugging). Việc đầu tư thời gian vào thiết kế logic và kỹ thuật phần mềm trước khi phát triển mã nguồn, cũng như tập trung nghiên cứu mã nguồn sau khi phát triển, có thể thiểu hóa hoặc thậm chí loại bỏ các lỗi (bug). Tuy nhiên, nói thì dễ hơn làm, và vì tất cả chúng ta đều là con người, các nhà phát triển (developer) vẫn cần đến các công cụ gỡ lỗi. Trong chương này, hãy cùng xem xét các phương pháp khác nhau để gỡ lỗi mã nguồn nhân (kernel code).

## Độ tin cậy, Tính sẵn sàng và Khả năng bảo trì (Reliability, Availability, Serviceability)

Nhiều hệ thống, đặc biệt là các hệ thống trọng yếu (mission-critical), có nhu cầu cao về độ tin cậy, tính sẵn sàng và khả năng bảo trì (Reliability, Availability, and Serviceability - RAS). Nỗ lực cải thiện RAS của Linux đã dẫn đến sự phát triển của một số công cụ mạnh mẽ. Các chương trình kiểm tra độ bền như Dự án Kiểm thử Linux (Linux Test Project - LTP) giúp đo lường độ tin cậy và tính ổn định của bản chuyển hệ (kernel port) của bạn. Tính năng cắm nóng CPU (CPU hotplugging) và dự án Tính sẵn sàng cao Linux (Linux High Availability - HA) thể hiện cho khía cạnh tính sẵn sàng. Các trình gỡ lỗi nhân (kernel debugger), Kprobes, Kdump, EDAC và Bộ công cụ Truy vết Linux (Linux Trace Toolkit - LTT) nằm trong phạm vi của khả năng bảo trì. Ranh giới phân chia các phân loại này đôi khi rất mỏng manh; bạn có thể sử dụng bất kỳ hoặc kết hợp các phương pháp này để đáp ứng nhu cầu gỡ lỗi của mình. Ví dụ, đầu ra từ một công cụ đo hiệu năng nhân (kernel profiler) như *OProfile* có thể được sử dụng để tìm kiếm các điểm nghẽn mã nguồn tiềm ẩn (độ tin cậy) hoặc để gỡ lỗi một sự cố thực tế ngoài hiện trường (khả năng bảo trì).

## Trình gỡ lỗi Nhân (Kernel Debuggers)

Nhân Linux không tích hợp sẵn hỗ trợ trình gỡ lỗi. Việc có nên đưa trình gỡ lỗi vào phần nhân gốc (stock kernel) hay không là một chủ đề thường xuyên gây tranh cãi trong các danh sách thư điện tử (mailing list) của nhân. Trình gỡ lỗi nhân ở mức lệnh *Kernel Debugger* (kdb) và Trình gỡ lỗi GNU cho Nhân ở mức mã nguồn *Kernel GNU Debugger* (kgdb) là hai trình gỡ lỗi nhân Linux chính. Cho đến nay, dù sử dụng kdb hay kgdb, bạn vẫn cần tải xuống các bản vá (patch) liên quan và áp dụng chúng vào mã nguồn nhân của mình. Ngay cả khi bạn muốn tránh khỏi rắc rối khi phải vá mã nguồn nhân để hỗ trợ gỡ lỗi, bạn vẫn có thể thu thập thông tin về hiện tượng hoảng loạn nhân (kernel panic) và xem lén các biến của nhân thông qua *Trình gỡ lỗi GNU* (GNU Debugger - gdb) thông thường. Các trình gỡ lỗi JTAG sử dụng tính năng gỡ lỗi hỗ trợ bằng phần cứng (hardware-assisted debugging), rất mạnh mẽ nhưng có chi phí cao.

Các trình gỡ lỗi nhân giúp các thành phần bên trong nhân (kernel internals) trở nên minh bạch hơn. Bạn có thể thực thi từng lệnh một (single-step), dịch ngược các lệnh (disassemble), hiển thị và sửa đổi các biến của nhân, cũng như xem các vết ngăn xếp (stack trace). Trong chương này, hãy cùng tìm hiểu những kiến thức cơ bản về trình gỡ lỗi nhân thông qua một số ví dụ.

## Truy cập Trình gỡ lỗi (Entering a Debugger)

Bạn có thể truy cập kernel debugger (trình gỡ lỗi nhân) theo nhiều cách khác nhau. Một cách là truyền các tham số dòng lệnh (command-line arguments) yêu cầu kernel (nhân) bước vào trình gỡ lỗi trong quá trình khởi động (boot). Một cách khác là thông qua các *breakpoint* (điểm ngắt) phần mềm hoặc phần cứng. Breakpoint là một địa chỉ mà tại đó bạn muốn tiến trình thực thi bị dừng lại và quyền điều khiển được chuyển cho trình gỡ lỗi. Một breakpoint phần mềm sẽ thay thế câu lệnh tại địa chỉ đó bằng một lệnh khác gây ra ngoại lệ (exception). Bạn có thể thiết lập các breakpoint phần mềm bằng các lệnh của trình gỡ lỗi hoặc bằng cách chèn chúng trực tiếp vào mã nguồn của mình. Đối với các hệ thống dựa trên kiến trúc x86, bạn có thể đặt một breakpoint phần mềm trong mã nguồn kernel như sau:

```
asm(" int $3");
```

Ngoài ra, bạn có thể gọi macro `BREAKPOINT`, macro này sẽ được biên dịch thành câu lệnh phù hợp với kiến trúc vi xử lý tương ứng.

Bạn có thể sử dụng hardware breakpoint (breakpoint phần cứng) thay thế cho software breakpoint nếu câu lệnh cần dừng nằm trong bộ nhớ flash, nơi không thể bị thay thế bởi trình gỡ lỗi. Breakpoint phần cứng yêu cầu sự hỗ trợ từ bộ vi xử lý (processor). Địa chỉ tương ứng phải được thêm vào một thanh ghi gỡ lỗi (debug register). Số lượng breakpoint phần cứng bạn có thể sử dụng bị giới hạn bởi số lượng thanh ghi gỡ lỗi mà bộ vi xử lý hỗ trợ.

Bạn cũng có thể yêu cầu trình gỡ lỗi thiết lập một *watchpoint* (điểm quan sát) trên một biến. Trình gỡ lỗi sẽ dừng quá trình thực thi bất cứ khi nào một câu lệnh thực hiện thay đổi dữ liệu tại địa chỉ của watchpoint.

Một phương pháp phổ biến khác để truy cập trình gỡ lỗi là nhấn phím ngắt (attention key), nhưng sẽ có những trường hợp cách này không hoạt động. Nếu mã nguồn của bạn bị kẹt trong một vòng lặp bó chặt (tight loop) sau khi vô hiệu hóa ngắt (disabling interrupts), kernel sẽ không có cơ hội xử lý phím ngắt để bước vào trình gỡ lỗi. Ví dụ, bạn không thể truy cập trình gỡ lỗi thông qua phím ngắt nếu mã nguồn của bạn thực hiện một đoạn mã như sau:

```
unsigned long flags;
local_irq_save(flags);
while (1) continue;
local_irq_restore(flags);
```

Khi quyền điều khiển được chuyển cho trình gỡ lỗi, bạn có thể bắt đầu quá trình phân tích của mình bằng cách sử dụng các lệnh khác nhau của trình gỡ lỗi.

## Kernel Debugger (kdb)

Kdb là một trình gỡ lỗi cấp độ câu lệnh máy (instruction-level debugger) được sử dụng để gỡ lỗi mã nguồn kernel và các device driver (trình điều khiển thiết bị). Trước khi có thể sử dụng, bạn cần vá (patch) mã nguồn kernel của mình để hỗ trợ kdb và tiến hành biên dịch lại kernel. (Hãy tham khảo phần "Downloads" để biết thông tin về cách tải xuống các bản vá kdb). Ưu điểm chính của kdb là rất dễ thiết lập, bởi vì bạn không cần thêm một cỗ máy thứ hai để thực hiện việc gỡ lỗi (không giống như kgdb). Nhược điểm chính là bạn phải tự đối chiếu mã nguồn của mình với mã hợp ngữ đã được dịch ngược (disassembled code) (lại một lần nữa, khác với kgdb).

Hãy cùng làm quen với kdb thông qua một ví dụ thực tế. Giả sử tình huống xảy ra lỗi như sau: Bạn đã sửa đổi một kernel serial driver (trình điều khiển cổng nối tiếp của kernel) để làm việc với phần cứng dựa trên kiến trúc x86 của mình. Nhưng driver lại không hoạt động, và bạn muốn nhờ kdb trợ giúp để tóm gọn thủ phạm.

Hãy bắt đầu công cuộc tìm kiếm dấu vết bằng cách đặt một breakpoint tại điểm vào (entry point) của hàm `open()` trong serial driver. Hãy nhớ rằng, vì kdb không phải là một source-level debugger (trình gỡ lỗi cấp mã nguồn), bạn phải mở mã nguồn của mình lên và cố gắng khớp các câu lệnh máy với mã C tương ứng. Hãy xem xét đoạn mã nguồn đang cần kiểm tra dưới đây:

### *drivers/serial/myserial.c***:**

```
static int rs_open(struct tty_struct *tty, struct file *filp)
{
 struct async_struct *info;
 /* ... */
 retval = get_async_struct(line, &info);
 if (retval) return(retval);
 tty->driver_data = info;
 /* Point A */
 /* ... */
}
```

Nhấn phím Pause và truy cập vào kdb. Hãy cùng xem mã hợp ngữ (disassembled) của hàm `rs_open()` trông như thế nào. Như thường lệ, tất cả các phiên gỡ lỗi (debug session) được trình bày trong chương này đều đi kèm các giải thích sử dụng ký hiệu.

```
Entering kdb (current=0xc03f6000, pid 0) on processor 0 due to
Keyboard Entry
```

```
kdb> id rs_open Disassemble rs_open
0xc01cce00 rs_open: sub $0x1c, %esp
0xc01cce03 rs_open+0x03: mov $ffffffed, %ecx
...
0xc01cce4b rs_open+0x4b: call 0xc01ccca0, get_async_struct
...
0xc01cce56 rs_open+0x56: mov 0xc(%esp,1), %eax
0xc01cce5a rs_open+0x5a: mov %eax, 0x9a4(%ebx)
...
```

Điểm A (Point A) trong mã nguồn là một vị trí thích hợp để đặt điểm ngắt (breakpoint) bởi vì bạn có thể kiểm tra cả cấu trúc `tty` lẫn cấu trúc `info` để xem chuyện gì đang xảy ra.

Khi đặt mã nguồn và mã hợp ngữ cạnh nhau, `rs_open+0x5a` tương ứng với Điểm A. Lưu ý rằng việc đối chiếu sẽ dễ dàng hơn nếu kernel được biên dịch mà không bật các cờ tối ưu hóa (optimization flags).

Đặt một điểm ngắt tại `rs_open+0x5a` (tương ứng với địa chỉ `0xc01cce5a`) và tiếp tục thực thi bằng cách thoát khỏi trình gỡ lỗi (debugger):

```
kbd> bp rs_open+0x5a Set breakpoint
kbd> go Continue execution
```

Bây giờ bạn cần buộc kernel gọi hàm `rs_open()` để chạm tới điểm ngắt. Để kích hoạt điều này, hãy chạy một chương trình ở không gian người dùng (user-space program) phù hợp. Trong trường hợp này, hãy ghi một vài ký tự vào cổng nối tiếp tương ứng (*/dev/ttySX*):

**bash> echo "kerala monsoons" > /dev/ttySX**

Thao tác này dẫn đến việc gọi hàm `rs_open()`. Điểm ngắt bị chạm tới và kdb giành quyền kiểm soát:

Entering kdb on processor 0 due to Breakpoint @ 0xc01cce5a kdb>

Bây giờ chúng ta hãy tìm hiểu nội dung của cấu trúc `info`. Nếu quan sát mã hợp ngữ, tại một lệnh trước điểm ngắt (`rs_open+0x56`), bạn sẽ thấy thanh ghi EAX chứa địa chỉ của cấu trúc `info`. Hãy xem nội dung các thanh ghi:

```
kbd> r Dump register contents
eax = 0xcf1ae680 ebx = 0xce03b000 ecx = 0x00000000
...
```

Vậy, `0xcf1ae680` là địa chỉ của cấu trúc `info`. Hãy kết xuất (dump) nội dung của nó bằng lệnh `md`:

```
kbd> md 0xcf1ae680 Memory dump
0xcf1ae680 00005301 0000ABC 00000000 10000400
...
```

Để hiểu được kết xuất bộ nhớ này, chúng ta hãy xem định nghĩa cấu trúc tương ứng. `info` được định nghĩa là `struct async_struct` trong *include/linux/serialP.h* như sau:

```
struct async_struct {
 int magic; /* Magic Number */
 unsigned long port; /* I/O Port */
 int hub6;
 /* ... */
};
```

Nếu bạn đối chiếu kết xuất bộ nhớ với định nghĩa, `0x5301` là giá trị nhận dạng magic (magic number) và `0xABC` là cổng I/O (I/O port). Chà, điều này thật thú vị! `0xABC` trông không giống một cổng hợp lệ. Nếu bạn đã có đủ kinh nghiệm gỡ lỗi cổng nối tiếp (serial port), bạn sẽ biết rằng các địa chỉ cơ sở cổng I/O và ngắt IRQ được cấu hình trong *include/asm-x86/serial.h* đối với phần cứng dựa trên kiến trúc x86. Hãy thay đổi định nghĩa cổng thành giá trị chính xác, biên dịch lại kernel và tiếp tục quá trình kiểm thử của bạn!

## Kernel GNU Debugger (kgdb)

Kgdb là một trình gỡ lỗi cấp độ mã nguồn (source-level debugger). Nó dễ sử dụng hơn kdb vì bạn không phải mất thời gian đối chiếu mã hợp ngữ (assembly code) với mã nguồn của mình. Tuy nhiên, việc thiết lập sẽ khó khăn hơn vì cần có một máy tính bổ sung để làm giao diện gỡ lỗi (front-end).

Bạn phải sử dụng gdb song song với kgdb để bước qua (step through) mã kernel. gdb chạy trên máy chủ (host machine), trong khi kernel đã được vá kgdb (tham khảo phần "Downloads" để biết thông tin tải các bản vá kgdb) chạy trên phần cứng mục tiêu (target hardware). Máy chủ và máy mục tiêu được kết nối thông qua một cáp serial null-modem, như được minh họa trong Hình 21.1. [1]

[1] Bạn cũng có thể khởi chạy các phiên gỡ lỗi kgdb qua Ethernet.

```text
KGDB Remote Debugging Setup
============================

  +---------------------------+                    +-------------------+
  |       Target Machine      |                    |   Host Machine    |
  |  (kernel patched with     |~~~~ Serial Cable ~~|  (running gdb)    |
  |        kgdb)              |                    |                   |
  +---------------------------+                    +-------------------+

Connection:
-----------
- Target machine running a kernel patched with kgdb
- Host running gdb
- Connected via Serial Cable
```

**Hình 21.1. Thiết lập Kgdb.**

Bạn phải thông báo cho kernel về định danh và tốc độbaud (baud rate) của cổng serial thông qua các tham số dòng lệnh (command-line arguments). Tùy thuộc vào bootloader được sử dụng, hãy thêm các tham số kernel sau vào *syslinux.cfg*, *lilo.conf* hoặc *grub.conf*:

kgdbwait kgdb8250=X,115200

kgdbwait yêu cầu kernel đợi cho đến khi kết nối được thiết lập với gdb ở phía máy chủ, X là cổng serial kết nối với máy chủ, và 115200 là tốc độ baud được sử dụng để truyền thông.

Bây giờ, hãy cấu hình tốc độ baud tương tự ở phía máy chủ:

Nếu máy tính chủ của bạn là một máy tính xách tay (laptop) không có cổng serial, bạn có thể sử dụng bộ chuyển đổi USB sang serial (USB-to-serial converter) cho phiên gỡ lỗi. Trong trường hợp đó, thay vì */dev/ttySX*, hãy sử dụng node */dev/ttyUSBX* được tạo bởi driver usbserial. Hình 6.4 trong Chương 6, "Serial Drivers," minh họa kịch bản này.

Hãy tìm hiểu các nguyên tắc cơ bản của kgdb bằng cách sử dụng ví dụ về một kernel module có lỗi (buggy). Các module dễ gỡ lỗi hơn vì toàn bộ kernel không cần phải biên dịch lại sau khi thực hiện các thay đổi mã, nhưng hãy nhớ biên dịch module của bạn với tùy chọn `-g` để tạo thông tin ký hiệu (symbolic information). Vì các module được tải một cách động (dynamically loaded), trình gỡ lỗi cần được thông báo về thông tin ký hiệu mà module đó chứa. Liệt kê (Listing) 21.1 chứa một hàm `trojan_function()` bị lỗi. Giả sử nó được định nghĩa trong *drivers/char/my_module.c*.

### Listing 21.1. Hàm chứa lỗi (Buggy Function)

```
char buffer;
int
trojan_function()
{
 int *my_variable = 0xAB, i;
 /* ... */
 Point A:
 i = *my_variable; /* Kernel Panic: my_variable trỏ
 tới vùng nhớ không hợp lệ */
 return(i);
}
```

Hãy nạp *my\_module.ko* lên thiết bị đích (target) và kiểm tra bên trong thư mục */sys/module/my\_module/sections/* để giải mã các địa chỉ của các phân đoạn ELF (*Executable and Linking Format*).[2] Phân đoạn `.text` trong tệp ELF chứa mã lệnh (code), `.data` chứa các biến đã được khởi tạo, `.rodata` chứa các biến chỉ đọc đã được khởi tạo như chuỗi ký tự (strings), và `.bss` chứa các biến chưa được khởi tạo trong quá trình khởi động. Địa chỉ của các phân đoạn này có sẵn dưới dạng các tệp *.text*, *.data*, *.rodata* và *.bss* trong */sys/module/my\_module/sections/* nếu bạn bật tùy chọn `CONFIG_KALLSYMS` trong quá trình cấu hình nhân (kernel configuration). Ví dụ, để lấy địa chỉ của phân đoạn mã lệnh (code section), hãy thực hiện:

[2] Nếu bạn vẫn đang sử dụng nhân 2.4, hãy lấy địa chỉ các phân đoạn bằng cách sử dụng tùy chọn `-m` của lệnh `insmod`:

#### bash> insmod my\_module.o –m

```
Using /lib/modules/2.x.y/kernel/drivers/char/my_module.o
Sections: Size Address Align
.this 00000060 e091a000 2**2
.text 00001ec0 e091a060 2**4
...
.rodata 0000004c e091d1fc 2**2
.data 00000048 e091d260 2**5
.bss 000000e4 e091d2c0 2**5
...
```

```
bash> cat /sys/module/my_module/sections/.text
0xe091a060
```

Bạn có thể tìm thêm thông tin về việc nạp module từ các tệp */proc/modules* và */proc/kallsyms*.

Sau khi đã có địa chỉ các phân đoạn, hãy khởi chạy `gdb` trên máy trạm phát triển (host-side machine):

```
bash> gdb vmlinux vmlinux là nhân chưa nén
(gdb) target remote /dev/ttySX Kết nối tới thiết bị đích
```

Vì bạn đã truyền `kgdbwait` làm đối số dòng lệnh của kernel (kernel command-line argument), `gdb` sẽ giành quyền kiểm soát khi nhân khởi động trên thiết bị đích. Bây giờ, hãy cung cấp các địa chỉ phân đoạn vừa tìm được cho `gdb` bằng lệnh `add-symbol-file`:

```
(gdb) add-symbol-file drivers/char/mymodule.ko 0xe091a060
 -s .rodata 0xe091d1fc -s .data 0xe091d260 -s .bss 0xe091d2c0
add symbol table from file "drivers/char/my_module.ko" at
 .text_addr = 0xe091a060
 .rodata_addr = 0xe091d1fc
 .data_addr = 0xe091d260
 .bss_addr = 0xe091d2c0
(y or n) y
Reading symbols from drivers/char/mymodule.ko ...done.
```

Để gỡ lỗi (debug) sự cố kernel panic, hãy đặt một điểm ngắt (breakpoint) tại `trojan_function()`:

```
(gdb) b trojan_function Đặt điểm ngắt
(gdb) c Tiếp tục thực thi
```

Khi `kgdb` chạm tới điểm ngắt, hãy xem dấu vết ngăn xếp (stack trace), thực hiện đơn bước (single-step) cho đến Điểm A (Point A), và hiển thị giá trị của `my_variable`:

```
(gdb) bt Truy vết ngăn xếp (stack trace)
## 0 trojan_function () at my_module.c :124
## 1 0xe091a108 in my_parent_function (my_var1=438, my_var2=0xe091d288)
..
(gdb) step
(gdb) step Tiếp tục đơn bước cho đến
 Điểm A
(gdb) p my_variable
$0 = 0
```

Có một lỗi rõ ràng ở đây. `my_variable` trỏ tới `NULL` vì `trojan_function()` quên cấp phát bộ nhớ cho nó. Hãy tiến hành cấp phát bộ nhớ bằng `kgdb`, né tránh việc kernel bị treo (crash), và tiếp tục kiểm thử:

```
(gdb) p &buffer In địa chỉ của buffer
$1 = 0xe091a100 ""
(gdb) set my_variable=0xe091a100 my_variable = &buffer
```

Các cổng `kgdb` hiện có sẵn cho nhiều kiến trúc (architecture) khác nhau như x86, ARM, và PowerPC. Khi bạn sử dụng `kgdb` để gỡ lỗi một thiết bị nhúng đích (thay vì máy tính cá nhân PC được hiển thị trong Hình 21.1), giao diện `gdb` (gdb front-end) mà bạn chạy trên hệ thống host cần phải được biên dịch để hoạt động với nền tảng đích (target platform) của bạn. Ví dụ, để gỡ lỗi một trình điều khiển thiết bị (device driver) được phát triển cho thiết bị nhúng dựa trên kiến trúc ARM từ hệ thống phát triển host dựa trên x86 của bạn, bạn phải sử dụng công cụ `gdb` được tạo ra phù hợp, thường có tên là `arm-linux-gdb`. Tên chính xác sẽ phụ thuộc vào bản phân phối (distribution) mà bạn đang sử dụng.

## GNU Debugger (gdb)

Như đã đề cập trước đó, bạn có thể sử dụng gdb thông thường để thu thập một số thông tin gỡ lỗi kernel (kernel debug information). Tuy nhiên, bạn không thể thực thi từng bước mã nguồn kernel (kernel code), đặt điểm dừng (breakpoint), hoặc sửa đổi các biến của kernel. Hãy sử dụng gdb để gỡ lỗi sự cố kernel panic do hàm bị lỗi trong Liệt kê 21.1 gây ra, nhưng lần này hãy giả sử rằng `trojan_function()` được biên dịch như một phần của kernel chứ không phải dưới dạng một module, bởi vì bạn không thể dễ dàng kiểm tra bên trong các module bằng gdb.

Đây là một phần của thông điệp "oops" được tạo ra khi `trojan_function()` được thực thi:

```
Unable to handle kernel NULL pointer dereference at
virtual address 000000ab
 ...
 eax: f7571de0 ebx: ffffe000 ecx: f6c78000 edx: f98df870
 ...
 Stack: c019d731 00000000
 ...
 bffffbe8 c0108fab
Call Trace: [<c019d731>] [<c013b8ac>] [<c0108fab>]
...
```

Sao chép thông điệp "oops" khó hiểu này vào tệp *oops.txt* và sử dụng tiện ích *ksymoops* để nhận được đầu ra chi tiết hơn. Bạn có thể cần phải sao chép thủ công thông điệp này nếu hệ thống bị treo (hang):

### bash> ksymoops oops.txt

```
Code; c019d710 <trojan_function+0/10>
00000000 <_EIP>:
Code; c019d710 <trojan_function+0/10> <=====
 0: a1 ab 00 00 00 mov 0xab,%eax <=====
Code; c019d715 <trojan_function+5/10>
 5: c3 ret
```

Các kernel phiên bản 2.6 xuất ra thông điệp "oops" có thể được sử dụng nguyên trạng mà không cần giải mã bằng *ksymoops* nếu bạn bật `CONFIG_KALLSYMS` trong quá trình cấu hình kernel.

Nhìn vào bản kết xuất (dump) trước đó, lỗi "oops" đã xảy ra bên trong `trojan_function()`. Hãy sử dụng gdb để lấy thêm thông tin. Trong lệnh gọi sau đây, *vmlinux* là ảnh kernel chưa nén (uncompressed kernel image), và */proc/kcore* là không gian địa chỉ kernel (kernel address space):

**bash> gdb vmlinux /proc/kcore**

```
(gdb) p xtime Kiểm tra hoạt động bằng cách in ra một biến kernel
$0 = 1113173755
```

Việc truy cập nhiều lần vào cùng một biến sẽ không mang lại các giá trị được làm mới do cơ chế truy cập được lưu đệm (cached access) của gdb. Bạn có thể ép buộc truy cập mới bằng cách đọc lại tệp core bằng lệnh `core-file` của gdb. Bây giờ chúng ta hãy xem mã hợp ngữ (disassembly) của `trojan_function()`:

```
(gdb) x/2i trojan_function Giải mã hợp ngữ trojan_function
0xc019d710 <trojan_function>: mov 0xab, %eax
0xc019d715 <trojan_function+5>: ret
```

`trojan_function()` trông rất ngắn gọn khi nhìn ở dạng hợp ngữ do các tối ưu hóa của trình biên dịch (compiler optimizations). Về cơ bản, nó đang sao chép nội dung của địa chỉ 0xab vào thanh ghi EAX, nơi lưu trữ giá trị trả về từ các hàm trên các hệ thống dựa trên kiến trúc x86. Nhưng 0xab trông không giống một địa chỉ kernel hợp lệ! Hãy sửa lỗi này bằng cách cấp phát không gian bộ nhớ hợp lệ cho `my_variable`, biên dịch lại và tiếp tục kiểm thử của bạn.

## Trình gỡ lỗi JTAG (JTAG Debuggers)

Trình gỡ lỗi JTAG sử dụng phần cứng hỗ trợ để gỡ lỗi mã nguồn. Bạn cần phần cứng giám sát chuyên dụng[3] và giao diện người dùng đầu cuối (frontend) (một số trình gỡ lỗi JTAG sử dụng gdb làm frontend) để thực thi mã từng bước. JTAG cũng có thể được sử dụng cho các mục đích khác ngoài gỡ lỗi, chẳng hạn như nạp mã (burn code) vào bộ nhớ flash trên bo mạch, như đã thảo luận trong Chương 18, "Nhúng Linux (Embedding Linux)". Các đầu nối JTAG rất phổ biến trên các bo mạch phát triển (development board) nhưng thường không có trên các bo mạch thương mại (production unit).

[3] Một số trình gỡ lỗi JTAG hoạt động với vài kiến trúc bộ xử lý nếu bạn thay thế phù hợp đầu dò (probe) kết nối trình gỡ lỗi với bo mạch đích (target board).

Trình gỡ lỗi JTAG thường kết nối với phần cứng đích thông qua cổng nối tiếp (serial port), USB hoặc Ethernet. Với Ethernet, bạn có thể truy cập từ xa vào trình gỡ lỗi JTAG, và do đó truy cập được vào bo mạch đích, ngay cả khi bản thân bo mạch đó không sở hữu giao diện mạng.

Hình 21.2 cho thấy một phiên gỡ lỗi từ xa dựa trên JTAG đang hoạt động. Trình gỡ lỗi JTAG được sử dụng trong kịch bản này hỗ trợ giao diện gdb frontend. Máy chủ phát triển (development host) và phần cứng JTAG được kết nối với một mạng LAN Ethernet. Cổng nối tiếp gỡ lỗi trên phần cứng đích được kết nối với cổng nối tiếp trên hộp JTAG. Hình 21.2 đạt được việc gỡ lỗi từ xa trên máy chủ phát triển Linux bằng cách sử dụng năm phiên dòng lệnh (terminal session). Terminal 1 chạy gdb, kết nối với hộp JTAG qua mạng sử dụng telnet:

```
(gdb) target remote 10.1.1.2:1001 10.1.1.2 là địa chỉ IP của
 phần cứng JTAG. 1001 là
 cổng TCP JTAG lắng nghe
 các kết nối gdb đến
```

**Hình 21.2. Ví dụ về thiết lập gỡ lỗi từ xa dựa trên JTAG.**

[Xem hình kích thước đầy đủ]

```text
Remote Linux Development Host - Debug Setup
============================================

Network Layout:
---------------
  [Remote Power Switch]  10.1.1.4
         |
  [Target Hardware]      10.1.1.3
         |  (Serial Port)
  [JTAG Debugger]        10.1.1.2
         |
         +----------- Ethernet ----------- [Remote Linux Development Host]  10.1.1.1

VNC Session on Remote Linux Development Host:
----------------------------------------------

+-------------------------------+  +-------------------------------+  +-------------------------------+
| Terminal 1 (GDB Session)      |  | Terminal 2 (Target Console)   |  | Terminal 3 (JTAG Control)     |
|-------------------------------|  |-------------------------------|  |-------------------------------|
| bash> gdb vmlinux             |  | bash> telnet 10.1.1.2 50      |  | bash> telnet 10.1.1.2         |
| (gdb) target remote           |  |                               |  | jtag>                         |
|       10.1.1.2:1001           |  | target:bash>                  |  |                               |
| (gdb)                         |  |                               |  |                               |
+-------------------------------+  +-------------------------------+  +-------------------------------+

+-------------------------------+  +------------------------------------------------------+
| Terminal 4 (Hard Reset)       |  | Terminal 5 (Exported Root Filesystem)                |
|-------------------------------|  |------------------------------------------------------|
| bash> elinks 10.1.1.4         |  | bash> cat /etc/exports                               |
|                               |  | /path/to/exported/root                               |
| [Target PowerON]              |  | 10.1.1.3(rw,sync,no_root_squash,no_all_squash)       |
| [Target PowerOFF]             |  | bash> cp testcode /path/to/exported/root             |
+-------------------------------+  +------------------------------------------------------+

IP Address Summary:
-------------------
  10.1.1.1  Remote Linux Development Host
  10.1.1.2  JTAG Debugger
  10.1.1.3  Target Hardware
  10.1.1.4  Remote Power Switch
```

Để gỡ lỗi (debug) các giai đoạn khởi động của kernel (boot portions of the kernel), ví dụ, hãy đặt một điểm dừng (breakpoint) của `gdb` tại hàm `start_kernel()`. (Bạn có thể tìm địa chỉ của nó từ tệp *System.map*, được tạo ra ở thư mục gốc của cây mã nguồn khi bạn biên dịch kernel).

Terminal 2 kết nối một console nối tiếp (serial console) với thiết bị đích (target). Một trình khách telnet (telnet client) chạy trên Terminal 2 kết nối tới một cổng TCP được chỉ định trước trên hộp JTAG (JTAG box), hộp này được cấu hình (sử dụng Terminal 3) để chuyển tiếp dữ liệu đến qua cổng nối tiếp của nó:

```
bash> telnet 10.1.1.2 50 10.1.1.2 là địa chỉ IP của
 phần cứng JTAG. 50 là
 cổng TCP JTAG thực hiện chuyển tiếp dữ liệu
 đến qua cổng nối tiếp của nó
```

Thao tác này tương đương với việc chạy một trình giả lập như *minicom* sau khi kết nối trực tiếp cổng nối tiếp gỡ lỗi của thiết bị đích với máy chủ (host) (thay vì nối qua hộp JTAG, như được hiển thị trong Hình 21.2), nhưng điều đó sẽ buộc máy chủ phải nằm ở vị trí vật lý sát cạnh thiết bị đích.

Terminal 3 kết nối telnet tới hộp JTAG và cung cấp các ngữ nghĩa đặc thù của trình gỡ lỗi (debugger-specific semantics). Ví dụ, bạn có thể sử dụng nó để thực hiện các thao tác sau:

Tải một tập lệnh định nghĩa JTAG (JTAG definition script) qua TFTP từ máy chủ và thực thi nó trong quá trình khởi động JTAG. Một tập lệnh định nghĩa JTAG thường khởi tạo bộ vi xử lý, các thanh ghi xung nhịp (clock registers), các thanh ghi chọn chip (chip select registers), và các ngân hàng bộ nhớ (memory banks). Sau khi hoàn tất, phần cứng JTAG đã sẵn sàng để tải mã nguồn xuống thiết bị đích và thực thi nó. Nhà sản xuất JTAG thường cung cấp các tệp định nghĩa cho tất cả các nền tảng được hỗ trợ, vì vậy bạn có thể có một điểm xuất phát thuận lợi cho bo mạch của mình.

- Tải bootloader, kernel, hoặc mã nguồn độc lập (stand-alone code) của bạn từ máy chủ qua TFTP, vào bộ nhớ flash hoặc RAM trên thiết bị đích. Các định dạng tệp như ELF và binary thường được hỗ trợ bởi các trình gỡ lỗi JTAG.
- Chạy từng bước lệnh (single-step code), đặt các điểm dừng (breakpoints), kiểm tra các thanh ghi, và kết xuất các vùng nhớ (dump memory regions).
- Khởi động lại thiết bị đích (reset the target).

Việc gỡ lỗi JTAG đôi khi có thể không ổn định (flaky), vì vậy nếu bạn đang gỡ lỗi từ xa, sẽ là một ý hay nếu cấp nguồn cho thiết bị đích thông qua một công tắc điều khiển nguồn từ xa (remote power control switch), như được hiển thị trong Hình 21.2. Bằng cách đó, bạn có thể khởi động cứng (hard-reset) thiết bị đích từ máy chủ bằng một trình duyệt web, như được hiển thị trong Terminal 4. Bạn cũng có thể chọn cấp nguồn cho phần cứng JTAG thông qua một công tắc nguồn từ xa. Điều đó sẽ cho phép bạn thử nghiệm chạy một bootloader trực tiếp từ bộ nhớ flash mà không cần sự can thiệp của JTAG và các tệp định nghĩa của nó.

Nếu bo mạch đích sở hữu một giao diện mạng (network interface), nó có thể gắn kết (mount) hệ thống tệp gốc (root filesystem) qua NFS từ máy chủ phát triển. (Xem phần "NFS-Mounted Root" trong Chương 18 để biết chi tiết về cách thực hiện việc này). Terminal 5 trên máy chủ hoạt động cục bộ trên hệ thống tệp gốc đã được xuất (exported root filesystem).[4]

[4] Bạn có thể có nhiều terminal như vậy tùy thuộc vào kịch bản gỡ lỗi của bạn. Ví dụ, nếu bạn đang sử dụng một máy hiện sóng (oscilloscope) có khả năng hiển thị từ xa, bạn có thể vận hành nó thông qua trình duyệt web trên một terminal khác.

Nếu nhóm của bạn phân tán về mặt địa lý, hãy chạy các Terminal từ 1 đến 5 trong một môi trường như *Virtual Network Computing* (VNC). Nếu VNC chưa có sẵn trong bản phân phối của bạn, hãy tải xuống từ www.realvnc.com. Với thiết lập như vậy, bạn có thể gỡ lỗi các electron trên bo mạch từ xa của mình ngay từ sự thoải mái tại nhà của bạn! Một số nhà cung cấp JTAG cung cấp một môi trường phát triển tích hợp tinh vi[5] (sophisticated integrated development environment) bao gồm tất cả các tính năng đã được trình bày chi tiết ở trên, do đó bạn không cần phải quản lý các phiên terminal VNC nếu bạn đang sử dụng một trong số chúng.

[5] Trong khi phần cứng JTAG độc lập với hệ điều hành đích, giao diện phía trước (front-end interface) có thể có các phụ thuộc vào hệ điều hành (OS dependencies).

Trong quá trình khởi tạo phần cứng (hardware bring-up), khi bạn đang port bootloader hoặc mã nguồn độc lập khác của mình sang thiết bị đích, tốt nhất là trước tiên nên tạo một ảnh ELF (ELF image) và gỡ lỗi nó từ RAM trước khi chạy nó từ bộ nhớ flash. Tuy nhiên, hãy nhớ loại bỏ các phần khởi tạo của bootloader bị trùng lặp với những phần do tập lệnh định nghĩa JTAG thực hiện.

Một ưu điểm cốt lõi của các trình gỡ lỗi JTAG là bạn có thể sử dụng một công cụ duy nhất để gỡ lỗi các thành phần khác nhau cấu thành nên giải pháp firmware của bạn. Vì vậy, bạn có thể sử dụng cùng một trình gỡ lỗi để gỡ lỗi BIOS, bootloader, kernel cơ sở, các module trình điều khiển thiết bị (device driver modules), cũng như các ứng dụng không gian người dùng (user-space applications), ở cấp độ mã nguồn (source level).

## Tải xuống

Bạn có thể tải xuống các bản vá (patch) `kdb` cho kiến trúc x86 và IA64 tại [http://oss.sgi.com/projects/kdb.](http://oss.sgi.com/projects/kdb) Mỗi phiên bản kernel được hỗ trợ cần có hai bản vá: một bản chung (common) và một bản phụ thuộc vào kiến trúc (architecture-dependent).

Trang chủ của dự án `kgdb` là [http://kgdb.sourceforge.net.](http://kgdb.sourceforge.net) Trang web này cũng cung cấp tài liệu về cách cấu hình và sử dụng `kgdb`.

Nếu bản phân phối Linux (Linux distribution) của bạn chưa có sẵn `gdb`, bạn có thể tải nó từ www.gnu.org/software/gdb/gdb.html.
