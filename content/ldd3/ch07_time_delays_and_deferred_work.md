# Chương 7: Thời gian, Độ trễ và Công việc Hoãn lại (Deferred Work)

Đến thời điểm này, chúng ta đã nắm được những kiến thức cơ bản về cách viết một module ký tự (char module) đầy đủ tính năng. Tuy nhiên, các driver trong thế giới thực cần phải làm nhiều việc hơn là chỉ triển khai các thao tác điều khiển thiết bị; chúng phải đối phó với các vấn đề như thời gian (timing), quản lý bộ nhớ, truy cập phần cứng, và nhiều thứ khác. May mắn thay, kernel cung cấp (exports) một số cơ sở hạ tầng để giảm bớt gánh nặng cho người viết driver. Trong các chương tiếp theo, chúng ta sẽ mô tả một số tài nguyên kernel mà bạn có thể sử dụng. Chương này mở đường bằng cách mô tả cách các vấn đề về thời gian được giải quyết. Việc xử lý thời gian bao gồm các tác vụ sau, sắp xếp theo thứ tự độ phức tạp tăng dần:

- Đo đạc khoảng thời gian trôi qua và so sánh thời gian
- Biết được thời gian hiện tại
- Trì hoãn hoạt động (delay) trong một khoảng thời gian xác định
- Lên lịch các hàm bất đồng bộ (asynchronous functions) để thực thi vào một thời điểm sau đó

## Đo Đạc Khoảng Thời Gian Trôi Qua (Measuring Time Lapses)

Kernel theo dõi dòng chảy của thời gian thông qua các ngắt bộ định thời (timer interrupts). Ngắt được trình bày chi tiết trong Chương 10.

Ngắt bộ định thời được tạo ra bởi phần cứng định thời của hệ thống (system's timing hardware) ở các khoảng thời gian đều đặn; khoảng thời gian này được lập trình vào thời điểm khởi động (boot time) bởi kernel dựa trên giá trị của `HZ`, đây là một giá trị phụ thuộc vào kiến trúc (architecture-dependent) được định nghĩa trong *<linux/param.h>* hoặc một file subplatform được include bởi nó. Các giá trị mặc định trong mã nguồn kernel được phân phối dao động từ 50 đến 1200 tick mỗi giây trên phần cứng thực, và giảm xuống 24 đối với các trình mô phỏng phần mềm (software simulators). Hầu hết các nền tảng chạy ở mức 100 hoặc 1000 ngắt mỗi giây; PC x86 phổ biến có giá trị mặc định là 1000, mặc dù nó từng là 100 trong các phiên bản trước (lên đến và bao gồm cả phiên bản 2.4). Theo nguyên tắc chung, ngay cả khi bạn biết giá trị của `HZ`, bạn không bao giờ nên phụ thuộc vào giá trị cụ thể đó khi lập trình.

Bạn có thể thay đổi giá trị của `HZ` đối với những ai muốn hệ thống có tần suất ngắt xung nhịp (clock interrupt frequency) khác. Nếu bạn thay đổi `HZ` trong file header, bạn cần biên dịch lại

kernel và tất cả các module với giá trị mới. Bạn có thể muốn tăng `HZ` để có độ phân giải tinh vi hơn (fine-grained resolution) trong các tác vụ bất đồng bộ của mình, nếu bạn sẵn sàng đánh đổi chi phí chung (overhead) của các ngắt bộ định thời bổ sung để đạt được mục tiêu của mình. Trên thực tế, việc tăng `HZ` lên 1000 khá phổ biến với các hệ thống công nghiệp x86 sử dụng phiên bản 2.4 hoặc 2.2 của kernel. Tuy nhiên, với các phiên bản hiện tại, cách tiếp cận tốt nhất đối với ngắt bộ định thời là giữ nguyên giá trị mặc định cho `HZ`, nhờ vào niềm tin tuyệt đối của chúng ta vào các nhà phát triển kernel, những người chắc chắn đã chọn ra giá trị tốt nhất. Bên cạnh đó, một số phép tính nội bộ hiện chỉ được triển khai cho `HZ` nằm trong khoảng từ 12 đến 1535 (xem *<linux/timex.h>* và RFC-1589).

Mỗi khi một ngắt bộ định thời xảy ra, giá trị của một bộ đếm nội bộ trong kernel (internal kernel counter) sẽ được tăng lên. Bộ đếm được khởi tạo về 0 khi hệ thống khởi động, vì vậy nó đại diện cho số lượng chu kỳ xung nhịp (clock ticks) kể từ lần khởi động gần nhất. Bộ đếm này là một biến 64-bit (ngay cả trên các kiến trúc 32-bit) và được gọi là `jiffies_64`. Tuy nhiên, những người viết driver thường truy cập biến `jiffies`, một số nguyên không dấu (unsigned long) có giá trị giống như `jiffies_64` hoặc các bit ít quan trọng nhất (least significant bits) của nó. Việc sử dụng `jiffies` thường được ưu tiên hơn vì nó nhanh hơn, và việc truy cập vào giá trị 64-bit `jiffies_64` không nhất thiết là nguyên tử (atomic) trên tất cả các kiến trúc.

Ngoài cơ chế jiffy do kernel quản lý với độ phân giải thấp, một số nền tảng CPU còn trang bị một bộ đếm độ phân giải cao (high-resolution counter) mà phần mềm có thể đọc được. Mặc dù việc sử dụng thực tế của nó có đôi chút khác biệt giữa các nền tảng, nhưng đôi khi nó là một công cụ rất mạnh mẽ.

### Sử dụng Bộ đếm Jiffies

Bộ đếm và các hàm tiện ích để đọc nó nằm trong *<linux/jiffies.h>*, mặc dù thông thường bạn chỉ cần include *<linux/sched.h>*, vì tệp này sẽ tự động nạp *jiffies.h*. Không cần phải nói, cả `jiffies` và `jiffies_64` đều phải được xem là chỉ đọc (read-only).

Bất cứ khi nào mã nguồn của bạn cần ghi nhớ giá trị hiện tại của `jiffies`, nó có thể truy cập trực tiếp vào biến `unsigned long` này (biến được khai báo là `volatile` để yêu cầu trình biên dịch không tối ưu hóa các thao tác đọc bộ nhớ). Bạn cần đọc bộ đếm hiện tại bất cứ khi nào mã nguồn của bạn cần tính toán một mốc thời gian trong tương lai, như được thể hiện trong ví dụ sau:

```
## include <linux/jiffies.h>
unsigned long j, stamp_1, stamp_half, stamp_n;
j = jiffies; /* đọc giá trị hiện tại */
stamp_1 = j + HZ; /* 1 giây trong tương lai */
stamp_half = j + HZ/2; /* nửa giây */
stamp_n = j + n * HZ / 1000; /* n mili-giây */
```

Đoạn mã này không gặp vấn đề gì với việc `jiffies` bị tràn (wrap around), miễn là các giá trị khác nhau được so sánh theo đúng cách. Mặc dù trên các kiến trúc nền tảng 32-bit (32-bit platforms), bộ đếm chỉ tràn một lần sau mỗi 50 ngày khi `HZ` là 1000, mã nguồn của bạn vẫn nên được chuẩn bị để đối phó với sự kiện đó. Để so sánh giá trị đã lưu trong bộ đệm (như `stamp_1` ở trên) và giá trị hiện tại, bạn nên sử dụng một trong các macro sau:

```
## include <linux/jiffies.h>
int time_after(unsigned long a, unsigned long b);
```

```
int time_before(unsigned long a, unsigned long b);
int time_after_eq(unsigned long a, unsigned long b);
int time_before_eq(unsigned long a, unsigned long b);
```

Macro đầu tiên trả về giá trị đúng (true) khi *a*, dưới dạng một ảnh chụp nhanh (snapshot) của `jiffies`, đại diện cho một thời điểm sau *b*; macro thứ hai trả về giá trị đúng khi thời điểm *a* trước thời điểm *b*; và hai macro cuối cùng dùng để so sánh "sau hoặc bằng" và "trước hoặc bằng". Đoạn mã hoạt động bằng cách chuyển đổi các giá trị sang kiểu `signed long`, trừ chúng cho nhau và so sánh kết quả. Nếu bạn cần biết khoảng chênh lệch giữa hai thời điểm `jiffies` một cách an toàn, bạn có thể dùng chính mẹo đó: `diff = (long)t2 - (long)t1;`.

Bạn có thể chuyển đổi độ chênh lệch `jiffies` sang mili-giây một cách đơn giản thông qua:

```
msec = diff * 1000 / HZ;
```

Tuy nhiên, đôi khi bạn cần trao đổi các biểu diễn thời gian với các chương trình ở không gian người dùng (user space programs) vốn có xu hướng biểu diễn giá trị thời gian bằng cấu trúc `struct timeval` và `struct timespec`. Hai cấu trúc này biểu diễn một đại lượng thời gian chính xác bằng hai con số: giây và micro-giây được sử dụng trong cấu trúc `struct timeval` cũ và phổ biến, còn giây và nano-giây được sử dụng trong cấu trúc `struct timespec` mới hơn. Kernel xuất ra (export) bốn hàm hỗ trợ để chuyển đổi các giá trị thời gian biểu diễn dưới dạng `jiffies` sang và từ các cấu trúc đó:

```
## include <linux/time.h>
unsigned long timespec_to_jiffies(struct timespec *value);
void jiffies_to_timespec(unsigned long jiffies, struct timespec *value);
unsigned long timeval_to_jiffies(struct timeval *value);
void jiffies_to_timeval(unsigned long jiffies, struct timeval *value);
```

Việc truy cập bộ đếm jiffy 64-bit không đơn giản như truy cập `jiffies`. Trong khi trên các kiến trúc máy tính 64-bit, hai biến này thực chất chỉ là một, thì việc truy cập giá trị lại không mang tính nguyên tử (atomic) đối với các bộ vi xử lý 32-bit. Điều này có nghĩa là bạn có thể đọc phải giá trị sai nếu cả hai nửa của biến bị cập nhật trong lúc bạn đang đọc chúng. Rất khó có khả năng bạn cần phải đọc bộ đếm 64-bit này, nhưng nếu có, bạn sẽ thấy vui khi biết rằng kernel xuất ra một hàm hỗ trợ cụ thể thực hiện việc khóa (locking) thích hợp cho bạn:

```
## include <linux/jiffies.h>
u64 get_jiffies_64(void);
```

Trong nguyên mẫu (prototype) trên, kiểu `u64` được sử dụng. Đây là một trong các kiểu được định nghĩa bởi *<linux/types.h>*, đã được thảo luận trong Chương 11, và đại diện cho kiểu số nguyên không dấu 64-bit.

Nếu bạn đang tự hỏi làm thế nào các nền tảng 32-bit cập nhật đồng thời cả bộ đếm 32-bit và 64-bit, hãy đọc tệp lệnh liên kết (linker script) cho nền tảng của bạn (tìm một tệp có tên khớp với *vmlinux\*.lds\**). Ở đó, ký hiệu `jiffies` được định nghĩa để truy cập từ có trọng số thấp nhất (least significant word) của giá trị 64-bit, tùy thuộc vào việc nền tảng là kiểu little-endian hay big-endian. Trên thực tế, cùng một mẹo này cũng được sử dụng cho các nền tảng 64-bit, sao cho các biến `unsigned long` và `u64` được truy cập tại cùng một địa chỉ.

Cuối cùng, lưu ý rằng tần số xung nhịp (clock frequency) thực tế hầu như bị ẩn hoàn toàn khỏi không gian người dùng (user space). Macro `HZ` luôn mở rộng thành 100 khi các chương trình ở không gian người dùng include *param.h*, và mọi bộ đếm được báo cáo cho không gian người dùng đều được chuyển đổi tương ứng. Điều này áp dụng cho *clock(3)*, *times(2)* và bất kỳ hàm liên quan nào. Bằng chứng duy nhất có sẵn cho người dùng về giá trị `HZ` là tốc độ xảy ra ngắt bộ định thời (timer interrupts), như được hiển thị trong */proc/interrupts*. Ví dụ, bạn có thể lấy được `HZ` bằng cách chia số đếm này cho thời gian hoạt động của hệ thống (system uptime) được báo cáo trong */proc/uptime*.

### Các thanh ghi đặc thù của bộ xử lý (Processor-Specific Registers)

Nếu bạn cần đo đạc các khoảng thời gian rất ngắn hoặc cần độ chính xác cực cao trong các số liệu của mình, bạn có thể viện đến các tài nguyên phụ thuộc vào nền tảng (platform-dependent), đây là sự đánh đổi giữa độ chính xác và khả năng tính di động (portability).

Trong các bộ xử lý hiện đại, nhu cầu cấp thiết về các số liệu hiệu năng thực nghiệm thường bị cản trở bởi tính khó đoán vốn có của thời gian thực thi lệnh trong hầu hết các thiết kế CPU do bộ nhớ cache, lập lịch lệnh (instruction scheduling) và dự đoán r nhánh (branch prediction). Để đáp ứng, các nhà sản xuất CPU đã giới thiệu một cách đếm chu kỳ xung nhịp (clock cycle) như một phương pháp đơn giản và đáng tin cậy để đo khoảng thời gian trôi qua. Do đó, hầu hết các bộ xử lý hiện đại đều tích hợp một thanh ghi đếm được tăng dần đều đặn một lần ở mỗi chu kỳ xung nhịp. Ngày nay, bộ đếm xung nhịp này là cách đáng tin cậy duy nhất để thực hiện các tác vụ đo thời gian độ phân giải cao (high-resolution timekeeping).

Các chi tiết khác nhau tùy theo nền tảng: thanh ghi có thể đọc được hoặc không đọc được từ User Space, có thể ghi được hoặc không ghi được, và có độ rộng 32 hoặc 64 bit. Trong trường hợp cuối cùng, bạn phải chuẩn bị sẵn sàng để xử lý hiện tượng tràn bộ đếm (overflow) giống như cách chúng ta đã làm với bộ đếm `jiffy`. Thanh ghi thậm chí có thể không tồn tại đối với nền tảng của bạn, hoặc nó có thể được triển khai trong một thiết bị ngoại vi bởi nhà thiết kế phần cứng, nếu CPU thiếu tính năng này và bạn đang xử lý một hệ thống máy tính chuyên dụng (special-purpose computer).

Cho dù thanh ghi có thể được đặt về 0 hay không, chúng tôi đặc biệt khuyên bạn không nên thiết lập lại nó, ngay cả khi phần cứng cho phép. Rốt cuộc, bạn có thể không phải là người duy nhất sử dụng bộ đếm vào bất kỳ thời điểm nào; ví dụ, trên một số nền tảng hỗ trợ SMP (Symmetric Multiprocessing), kernel phụ thuộc vào một bộ đếm như vậy để được đồng bộ hóa giữa các bộ xử lý. Vì bạn luôn có thể đo lường sự chênh lệch giữa các giá trị, miễn là sự chênh lệch đó không vượt quá thời gian tràn (overflow time), bạn có thể hoàn thành công việc mà không cần chiếm quyền sở hữu độc quyền đối với thanh ghi bằng cách sửa đổi giá trị hiện tại của nó.

Thanh ghi đếm nổi tiếng nhất là TSC (timestamp counter), được giới thiệu trong các bộ xử lý x86 kể từ dòng Pentium và có mặt trong tất cả các thiết kế CPU kể từ đó—bao gồm cả nền tảng `x86_64`. Đây là một thanh ghi 64-bit đếm các chu kỳ xung nhịp CPU; nó có thể được đọc từ cả Kernel Space và User Space.

Sau khi bao gồm *<asm/msr.h>* (một tệp tiêu đề đặc thù cho x86 có tên viết tắt từ "machine-specific registers"), bạn có thể sử dụng một trong các macro sau:

```c
rdtsc(low32,high32);
rdtscl(low32);
rdtscll(var64);
```

Macro đầu tiên đọc nguyên tử (atomically) giá trị 64-bit vào hai biến 32-bit; macro tiếp theo ("read low half") đọc nửa thấp của thanh ghi vào một biến 32-bit, bỏ qua nửa cao; macro cuối cùng đọc giá trị 64-bit vào một biến `long long`, do đó có tên gọi như vậy. Tất cả các macro này lưu trữ giá trị vào các đối số của chúng.

Việc đọc nửa thấp của bộ đếm là đủ cho hầu hết các mục đích sử dụng thông thường của TSC. Một CPU 1-GHz chỉ làm tràn nó một lần mỗi 4,2 giây, vì vậy bạn sẽ không cần phải xử lý các biến đa thanh ghi nếu khoảng thời gian bạn đang benchmark chắc chắn tốn ít thời gian hơn. Tuy nhiên, khi tần số CPU ngày càng tăng theo thời gian và các yêu cầu về thời gian ngày càng khắt khe, rất có thể bạn sẽ cần phải đọc bộ đếm 64-bit thường xuyên hơn trong tương lai.

Như một ví dụ chỉ sử dụng nửa thấp của thanh ghi, các dòng lệnh sau đo lường việc thực thi của chính câu lệnh đó:

```c
unsigned long ini, end;
rdtscl(ini); rdtscl(end);
printk("time lapse: %li\n", end - ini);
```

Một số nền tảng khác cung cấp chức năng tương tự, và các tệp tiêu đề của kernel cung cấp một hàm độc lập với kiến trúc (architecture-independent) mà bạn có thể sử dụng thay cho `rdtsc`. Nó được gọi là `get_cycles`, được định nghĩa trong *<asm/timex.h>* (được bao bởi *<linux/timex.h>*). Nguyên mẫu (prototype) của nó là:

```c
## include <linux/timex.h>
 cycles_t get_cycles(void);
```

Hàm này được định nghĩa cho mọi nền tảng, và nó luôn trả về 0 trên các nền tảng không có thanh ghi đếm chu kỳ. Kiểu dữ liệu `cycles_t` là một kiểu dữ liệu không dấu (unsigned type) thích hợp để lưu trữ giá trị đọc được.

Mặc dù có sẵn một hàm độc lập với kiến trúc, chúng tôi muốn tận dụng cơ hội này để hiển thị một ví dụ về mã assembly nội tuyến (inline assembly code). Nhằm mục đích này, chúng tôi triển khai một hàm `rdtscl` cho các bộ xử lý MIPS hoạt động theo cùng cách thức như trên x86.

Chúng tôi dựa trên MIPS cho ví dụ này vì hầu hết các bộ xử lý MIPS đều có bộ đếm 32-bit đóng vai trò là thanh ghi 9 của "coprocessor 0" bên trong chúng. Để truy cập thanh ghi này (chỉ có thể đọc từ Kernel Space), bạn có thể định nghĩa macro sau để thực hiện câu lệnh assembly "move from coprocessor 0":\*

```c
## define rdtscl(dest) \
 __asm__ __volatile__("mfc0 %0,$9; nop" : "=r" (dest))
```

Với macro này được thiết lập, bộ xử lý MIPS có thể thực thi cùng một đoạn mã được hiển thị trước đó cho x86.

Lệnh *nop* theo sau là bắt buộc để ngăn trình biên dịch truy cập thanh ghi đích ngay trong câu lệnh tiếp theo sau lệnh *mfc0*. Kiểu khóa liên động (interlock) này rất đặc trưng của các bộ xử lý RISC, và trình biên dịch vẫn có thể lập lịch các lệnh hữu ích vào các khe trễ (delay slots). Trong trường hợp này, chúng tôi sử dụng *nop* bởi vì assembly nội tuyến là một hộp đen (black box) đối với trình biên dịch và không thể thực hiện tối ưu hóa nào.

Với cú pháp assembly nội tuyến (*inline assembly*) của *gcc*, việc cấp phát các thanh ghi đa năng (general-purpose registers) được giao cho trình biên dịch (compiler). Macro vừa được trình bày sử dụng `%0` làm placeholder (ký tự giữ chỗ) cho "đối số 0", sau đó được chỉ định là "bất kỳ thanh ghi (r) nào được sử dụng làm đầu ra (=)". Macro này cũng nêu rõ rằng thanh ghi đầu ra phải tương ứng với biểu thức C `dest`. Cú pháp cho assembly nội tuyến rất mạnh mẽ nhưng hơi phức tạp, đặc biệt đối với các kiến trúc có các ràng buộc về chức năng của từng thanh ghi (cụ thể là dòng họ x86). Cú pháp này được mô tả trong tài liệu của *gcc*, thường có sẵn trong cây tài liệu *info*.

Đoạn mã C ngắn được trình bày trong mục này đã chạy trên bộ xử lý x86 thế hệ K7 và MIPS VR4181 (sử dụng macro vừa mô tả). Bộ xử lý thứ nhất báo cáo khoảng thời gian trôi qua là 11 chu kỳ xung nhịp (clock ticks) và bộ xử lý thứ hai chỉ mất 2 chu kỳ xung nhịp. Con số nhỏ này là điều có thể đoán trước, vì các bộ xử lý RISC thường thực hiện một lệnh trong mỗi chu kỳ xung nhịp.

Có một điều khác đáng biết về các bộ đếm thời gian (timestamp counters): chúng không nhất thiết phải được đồng bộ hóa giữa các bộ xử lý trong một hệ thống SMP (Symmetric Multiprocessing). Để đảm bảo nhận được một giá trị nhất quán (coherent value), bạn nên vô hiệu hóa tính năng tiền chiếm quyền (preemption) đối với đoạn mã đang truy vấn bộ đếm.

## Biết Giờ Hiện Tại (Knowing the Current Time)

Mã kernel (Kernel code) luôn có thể truy xuất một bản thể biểu diễn của thời gian hiện tại bằng cách xem giá trị của `jiffies`. Thông thường, việc giá trị này chỉ thể hiện khoảng thời gian kể từ lần khởi động cuối cùng là không quan trọng đối với trình điều khiển (driver), bởi vì vòng đời của nó bị giới hạn trong thời gian hoạt động của hệ thống (system uptime). Như đã chỉ ra, các driver có thể sử dụng giá trị hiện tại của `jiffies` để tính toán khoảng thời gian giữa các sự kiện (ví dụ: để phân biệt cú pháp nhấn đúp và nhấn đơn trong các input device driver hoặc tính toán thời gian chờ timeouts). Tóm lại, việc xem xét `jiffies` hầu như luôn đủ khi bạn cần đo các khoảng thời gian. Nếu bạn cần các phép đo rất chính xác cho các khoảng thời gian ngắn, các thanh ghi đặc thù của bộ xử lý sẽ giải cứu bạn (mặc dù chúng mang lại các vấn đề nghiêm trọng về tính di động - portability).

Rất khó có khả năng một driver cần biết thời gian thực (wall-clock time), được tính bằng tháng, ngày và giờ; thông tin này thường chỉ cần thiết cho các chương trình ở user space (không gian người dùng) như *cron* và *syslogd*. Việc xử lý thời gian thực tế thường tốt nhất nên để cho user space, nơi thư viện C cung cấp sự hỗ trợ tốt hơn; bên cạnh đó, mã nguồn như vậy thường gắn liền với chính sách (policy-related) nên không thuộc về kernel. Tuy nhiên, *có* một hàm kernel chuyển đổi thời gian thực thành giá trị `jiffies`:

```c
## include <linux/time.h>
unsigned long mktime (unsigned int year, unsigned int mon,
 unsigned int day, unsigned int hour,
 unsigned int min, unsigned int sec);
```

Nhắc lại rằng: việc xử lý trực tiếp thời gian thực trong một driver thường là dấu hiệu cho thấy chính sách (policy) đang được thực thi và do đó cần phải được xem xét lại.

Mặc dù bạn sẽ không phải xử lý các dạng biểu diễn thời gian dễ đọc đối với con người, nhưng đôi khi bạn cần xử lý dấu thời gian tuyệt đối (absolute timestamp) ngay cả trong kernel space. Nhằm mục đích này, `<linux/time.h>` xuất khẩu (exports) hàm `do_gettimeofday`. Khi được gọi, nó điền vào một

con trỏ `struct timeval`—cùng loại được sử dụng trong system call (lời gọi hệ thống) `gettimeofday`—với các giá trị giây và micro giây quen thuộc. Nguyên mẫu (prototype) cho `do_gettimeofday` là:

```c
## include <linux/time.h>
 void do_gettimeofday(struct timeval *tv);
```

Mã nguồn nêu rõ rằng `do_gettimeofday` có "độ phân giải gần bằng micro giây", bởi vì nó hỏi phần cứng thời gian xem phần nào của `jiffy` hiện tại đã trôi qua. Tuy nhiên, độ chính xác thay đổi từ kiến trúc này sang kiến trúc khác, vì nó phụ thuộc vào các cơ chế phần cứng thực tế đang được sử dụng. Ví dụ, một số bộ xử lý `m68knommu`, hệ thống Sun3, và các hệ thống `m68k` khác không thể cung cấp độ phân giải cao hơn một `jiffy`. Ngược lại, các hệ thống Pentium cung cấp các phép đo dưới mức chu kỳ (subtick) rất nhanh và chính xác bằng cách đọc bộ đếm thời gian đã được mô tả trước đó trong chương này.

Thời gian hiện tại cũng có sẵn (mặc dù với độGranularity là `jiffy`) từ biến `xtime`, một giá trị `struct timespec`. Việc sử dụng trực tiếp biến này không được khuyến khích vì rất khó để truy cập nguyên tử (atomically) cả hai trường (fields). Do đó, kernel cung cấp hàm tiện ích `current_kernel_time`:

```c
## include <linux/time.h>
struct timespec current_kernel_time(void);
```

Mã nguồn để truy xuất thời gian hiện tại theo nhiều cách khác nhau có sẵn trong module *jit* ("just in time") nằm trong các tệp mã nguồn được cung cấp trên trang FTP của O'Reilly. *jit* tạo ra một tệp có tên là `/proc/currentime`, trả về các mục sau dưới dạng ASCII khi đọc:

- Các giá trị `jiffies` và `jiffies_64` hiện tại dưới dạng số thập lục phân (hex numbers)
- Thời gian hiện tại do `do_gettimeofday` trả về
- Cấu trúc `timespec` do `current_kernel_time` trả về

Chúng tôi chọn sử dụng tệp `/proc` động để giữ cho mã nguồn nền tảng (boilerplate code) ở mức tối thiểu—không đáng để tạo ra cả một thiết bị chỉ để trả về một chút thông tin văn bản.

Tệp này trả về các dòng văn bản liên tục miễn là module được nạp (loaded); mỗi system call `read` thu thập và trả về một tập dữ liệu, được tổ chức thành hai dòng để dễ đọc hơn. Bất cứ khi nào bạn đọc nhiều tập dữ liệu trong thời gian ngắn hơn một chu kỳ ngắt bộ đếm thời gian (timer tick), bạn sẽ thấy sự khác biệt giữa `do_gettimeofday` (truy vấn phần cứng) và các giá trị khác (chỉ được cập nhật khi bộ đếm thời gian ngắt).

```
phon% head -8 /proc/currentime
0x00bdbc1f 0x0000000100bdbc1f 1062370899.630126
 1062370899.629161488
0x00bdbc1f 0x0000000100bdbc1f 1062370899.630150
 1062370899.629161488
0x00bdbc20 0x0000000100bdbc20 1062370899.630208
 1062370899.630161336
0x00bdbc20 0x0000000100bdbc20 1062370899.630233
 1062370899.630161336
```

Trong đoạn trích ở trên, có hai điểm thú vị cần lưu ý. Đầu tiên, giá trị *current_kernel_time*, mặc dù được biểu diễn bằng nano giây, nhưng chỉ có độ chi tiết (granularity) theo clock tick (chu kỳ nhịp đồng hồ);

*do_gettimeofday* luôn báo cáo thời điểm muộn hơn nhưng không muộn hơn clock tick tiếp theo. Thứ hai, bộ đếm jiffies 64-bit có bit ít quan trọng nhất (least-significant bit) của từ 32-bit cao được thiết lập. Điều này xảy ra vì giá trị mặc định của INITIAL_JIFFIES, được sử dụng vào thời điểm khởi động (boot time) để khởi tạo bộ đếm, ép buộc việc tràn từ thấp (low-word overflow) diễn ra chỉ vài phút sau khi khởi động nhằm giúp phát hiện các vấn đề liên quan chính xác đến sự cố tràn đó. Độ lệch ban đầu này trong bộ đếm không gây ra ảnh hưởng gì, bởi vì jiffies không liên quan đến thời gian thực (wall-clock time). Trong */proc/uptime*, nơi kernel trích xuất thời gian hoạt động từ bộ đếm, độ lệch ban đầu này sẽ bị loại bỏ trước khi chuyển đổi.

## Trì hoãn thực thi (Delaying Execution)

Các trình điều khiển thiết bị (device driver) thường cần trì hoãn việc thực thi của một đoạn mã nào đó trong một khoảng thời gian, thông thường là để cho phép phần cứng hoàn thành một tác vụ nào đó. Trong phần này, chúng ta sẽ đề cập đến một số kỹ thuật khác nhau để đạt được độ trễ. Hoàn cảnh của từng trường hợp cụ thể sẽ quyết định kỹ thuật nào là tốt nhất nên sử dụng; chúng ta sẽ điểm qua tất cả và chỉ ra ưu, nhược điểm của từng kỹ thuật.

Một điều quan trọng cần xem xét là khoảng thời gian trễ bạn cần so sánh thế nào với clock tick, khi cân nhắc dải giá trị HZ trên các nền tảng khác nhau. Các khoảng trễ dài hơn đáng kể so với clock tick, và không bị ảnh hưởng bởi độ chi tiết thô của nó, có thể tận dụng đồng hồ hệ thống (system clock). Các khoảng trễ rất ngắn thường phải được thực hiện bằng các vòng lặp phần mềm (software loop). Nằm giữa hai trường hợp này là một vùng xám. Trong chương này, chúng tôi sử dụng cụm từ độ trễ "dài" (long delay) để chỉ độ trễ là bội số của jiffy, có thể ngắn bằng vài mili-giây trên một số nền tảng, nhưng vẫn được coi là dài đối với CPU và kernel.

Các phần sau đây sẽ bàn về các mức độ trễ khác nhau theo một lộ trình khá dài, đi từ các giải pháp mang tính trực giác nhưng không phù hợp cho đến giải pháp chính xác. Chúng tôi chọn con đường này vì nó cho phép thảo luận sâu hơn về các vấn đề của kernel liên quan đến thời gian. Nếu bạn đang nóng lòng muốn tìm mã nguồn chính xác, bạn có thể lướt nhanh qua phần này.

### Độ trễ dài (Long Delays)

Thỉnh thoảng, một driver cần trì hoãn việc thực thi trong những khoảng thời gian tương đối dài — lớn hơn một clock tick. Có một vài cách để thực hiện loại độ trễ này; chúng ta bắt đầu với kỹ thuật đơn giản nhất, sau đó tiến tới các kỹ thuật nâng cao hơn.

#### Chờ bận (Busy waiting)

Nếu bạn muốn trì hoãn việc thực thi theo một bội số của clock tick, cho phép một chút độ dung sai (slack) về giá trị, cách triển khai dễ dàng nhất (mặc dù không được khuyến nghị) là một vòng lặp giám sát bộ đếm jiffy. Việc triển khai *busy-waiting* thường giống như đoạn mã sau, trong đó j1 là giá trị của jiffies khi hết thời gian trễ:

```
while (time_before(jiffies, j1))
 cpu_relax( );
```

Lời gọi *cpu_relax* kích hoạt một phương thức đặc trưng của kiến trúc (architecture-specific) nhằm thông báo rằng bạn hiện không thực hiện nhiều tác vụ trên bộ xử lý tại thời điểm đó. Trên nhiều hệ thống, nó không làm gì cả; trên các hệ thống đa luồng đối xứng ("hyperthreaded"), nó có thể nhường lõi cho luồng khác. Dù ở trường hợp nào đi nữa, cách tiếp cận này chắc chắn nên tránh bất cứ khi nào có thể. Chúng tôi trình bày nó ở đây vì thỉnh thoảng bạn có thể muốn chạy đoạn mã này để hiểu rõ hơn về các cơ chế bên nội tại (internals) của các đoạn mã khác.

Vì vậy, hãy xem đoạn mã này hoạt động như thế nào. Vòng lặp được đảm bảo là hoạt động vì jiffies được khai báo là `volatile` bởi các tệp tiêu đề (header) của kernel và do đó, nó được lấy từ bộ nhớ bất cứ khi nào một đoạn mã C truy cập vào nó. Mặc dù về mặt kỹ thuật là chính xác (theo nghĩa là nó hoạt động đúng như thiết kế), vòng lặp bận này làm giảm nghiêm trọng hiệu năng hệ thống. Nếu bạn không cấu hình kernel của mình hỗ trợ vận hành tiền chiếm chỗ (preemptive operation), vòng lặp sẽ chiếm hoàn toàn bộ xử lý trong suốt thời gian trễ; trình lập lịch (scheduler) không bao giờ tiền chiếm chỗ (preempt) một tiến trình đang chạy trong kernel space, và máy tính trông hoàn toàn tê liệt cho đến khi đạt đến thời điểm j1. Vấn đề sẽ ít nghiêm trọng hơn nếu bạn đang chạy một preemptive kernel, bởi vì trừ khi đoạn mã đang giữ một khóa (lock), một phần thời gian của bộ xử lý có thể được khôi phục cho các mục đích khác. Tuy nhiên, busy wait vẫn rất tốn kém trên các hệ thống có hỗ trợ preemption.

Tồi tệ hơn nữa, nếu ngắt (interrupt) vô tình bị vô hiệu hóa khi bạn bước vào vòng lặp, jiffies sẽ không được cập nhật, và điều kiện trong vòng lặp `while` sẽ mãi mãi đúng. Chạy một preemptive kernel cũng sẽ không giúp ích gì, và bạn sẽ buộc phải nhấn nút nguồn màu đỏ lớn (big red button).

Cách triển khai mã trì hoãn này có sẵn, giống như các cách tiếp cận sau, trong module *jit*. Các tệp */proc/jit\** được tạo bởi module này sẽ trì hoãn đúng một giây mỗi khi bạn đọc một dòng văn bản, và các dòng được đảm bảo dài đúng 20 byte. Nếu bạn muốn kiểm tra mã busy-wait, bạn có thể đọc */proc/jitbusy*, nó thực hiện vòng lặp bận trong một giây cho mỗi dòng mà nó trả về.

```

Hãy chắc chắn rằng bạn đọc tối đa một dòng (hoặc một vài dòng) tại một thời điểm từ */proc/jitbusy*. Cơ chế kernel đơn giản hóa để đăng ký các tệp */proc* gọi phương thức *read* lặp đi lặp lại để lấp đầy bộ đệm dữ liệu mà tiến trình người dùng (user process) yêu cầu. Do đó, một lệnh như *cat /proc/jitbusy*, nếu nó đọc 4 KB tại một thời điểm, sẽ làm treo máy tính trong 205 giây.

Lệnh được đề xuất để đọc */proc/jitbusy* là *dd bs=20 < /proc/jitbusy*, có thể chỉ định thêm số lượng khối (block). Mỗi dòng 20 byte được trả về bởi tệp thể hiện giá trị của bộ đếm jiffy trước và sau khoảng thời gian trễ. Đây là một mẫu thực thi trên một máy tính không có tải (unloaded computer):

|  | phon% dd bs=20 count=5 < /proc/jitbusy |
|--|----------------------------------------|
|  |                                        |

| 1687518 |
|---------|
| 1688519 |
| 1689520 |
| 1690520 |
| 1691521 |
|         |

Mọi thứ trông có vẻ ổn: thời gian trễ chính xác là một giây (1000 jiffy), và System Call *read* tiếp theo bắt đầu ngay lập tức sau khi System Call trước đó kết thúc. Nhưng hãy xem điều gì xảy ra trên một hệ thống chạy số lượng lớn các tiến trình tiêu tốn nhiều CPU (và kernel không có tính năng trưng dụng - nonpreemptive kernel):

#### phon% **dd bs=20 count=5 < /proc/jitbusy** 1911226 1912226 1913323 1914323 1919529 1920529 1925632 1926632 1931835 1932835

Ở đây, mỗi System Call *read* bị trễ chính xác một giây, nhưng kernel có thể mất hơn 5 giây trước khi lên lịch (schedule) cho tiến trình *dd* để nó có thể thực hiện System Call tiếp theo. Đó là điều được mong đợi trong một hệ thống đa nhiệm (multitasking system); thời gian CPU được chia sẻ giữa tất cả các tiến trình đang chạy, và một tiến trình tiêu tốn nhiều CPU sẽ bị giảm độ ưu tiên động (dynamic priority). (Thảo luận về các chính sách lập lịch - scheduling policy nằm ngoài phạm vi của cuốn sách này).

Bài kiểm tra dưới tải được hiển thị ở trên đã được thực hiện trong khi chạy chương trình mẫu *load50*. Chương trình này tạo ra (fork) một số tiến trình không làm gì cả, nhưng thực hiện việc đó theo cách ngốn CPU. Chương trình này là một phần của các tệp mẫu đi kèm với cuốn sách này, và tạo ra 50 tiến trình theo mặc định, mặc dù số lượng có thể được chỉ định trên dòng lệnh. Trong chương trình này, và ở những nơi khác trong cuốn sách, các bài kiểm tra với hệ thống có tải đã được thực hiện khi *load50* đang chạy trên một máy tính vốn dĩ đang ở trạng thái nhàn rỗi (idle).

Nếu bạn lặp lại lệnh trong khi chạy một kernel có hỗ trợ trưng dụng (preemptive kernel), bạn sẽ thấy không có sự khác biệt đáng chú ý nào trên một CPU nhàn rỗi và có hành vi sau đây dưới tải:

```

phon% dd bs=20 count=5 < /proc/jitbusy
14940680 14942777
14942778 14945430
14945431 14948491
14948492 14951960
14951961 14955840

```

Ở đây, không có độ trễ đáng kể nào giữa phần kết thúc của một System Call và phần bắt đầu của System Call tiếp theo, nhưng thời gian trễ riêng lẻ lại dài hơn nhiều so với một giây: lên tới 3.8 giây trong ví dụ được hiển thị và tăng dần theo thời gian. Các giá trị này chứng minh rằng tiến trình đã bị ngắt trong khoảng thời gian trễ của nó, nhường chỗ cho việc lên lịch các tiến trình khác. Khoảng trống giữa các System Call không phải là tùy chọn lập lịch duy nhất cho tiến trình này, do đó không có độ trễ đặc biệt nào có thể được nhìn thấy ở đó.

#### Nhường bộ vi xử lý (Yielding the processor)
Như chúng ta đã thấy, việc chờ bận (busy waiting) áp đặt một tải nặng lên toàn bộ hệ thống; chúng ta muốn tìm một kỹ thuật tốt hơn. Thay đổi đầu tiên xuất hiện trong đầu là

giải phóng CPU một cách rõ ràng khi chúng ta không sử dụng đến nó. Điều này được thực hiện bằng cách gọi hàm *schedule*, được khai báo trong *<linux/sched.h>*:

```

while (time_before(jiffies, j1)) {
schedule( );
}

```

Vòng lặp này có thể được kiểm tra bằng cách đọc */proc/jitsched* giống như chúng ta đọc */proc/jitbusy* ở trên. Tuy nhiên, nó vẫn chưa phải là tối ưu. Tiến trình hiện tại không làm gì ngoài việc giải phóng CPU, nhưng nó vẫn nằm trong hàng đợi chạy (run queue). Nếu nó là tiến trình duy nhất có thể chạy được, nó thực sự sẽ chạy (nó gọi bộ lập lịch - scheduler, bộ lập lịch chọn chính tiến trình đó, tiến trình đó lại gọi bộ lập lịch, cứ thế...). Nói cách khác, tải của máy (số lượng trung bình các tiến trình đang chạy) ít nhất là một, và tác vụ nhàn rỗi (idle task - tiến trình số 0, còn được gọi là *swapper* vì lý do lịch sử) không bao giờ chạy. Mặc dù vấn đề này có vẻ không quan trọng, việc chạy tác vụ nhàn rỗi khi máy tính không có việc gì làm sẽ làm giảm khối lượng công việc của bộ vi xử lý, làm giảm nhiệt độ và tăng tuổi thọ của nó, cũng như kéo dài thời lượng pin nếu máy tính hóa ra là máyδ tính xách tay của bạn. Hơn nữa, vì tiến trình thực sự đang thực thi trong thời gian trễ, nó phải chịu trách nhiệm cho toàn bộ thời gian mà nó tiêu thụ.

Hành vi của */proc/jitsched* thực ra tương tự như việc chạy */proc/jitbusy* dưới một preemptive kernel. Đây là một mẫu chạy, trên một hệ thống không có tải:

```

phon% dd bs=20 count=5 < /proc/jitsched

```

```

1760205 1761207
1761209 1762211
1762212 1763212
1763213 1764213
1764214 1765217

```

Thật thú vị khi lưu ý rằng mỗi *read* đôi khi kết thúc bằng việc chờ thêm một vài chu kỳ xung nhịp (clock tick) so với yêu cầu. Vấn đề này ngày càng trở nên tồi tệ hơn khi hệ thống bận rộn, và trình điều khiển (driver) có thể kết thúc bằng việc chờ đợi lâu hơn dự kiến. Một khi một tiến trình giải phóng bộ vi xử lý bằng *schedule*, không có gì đảm bảo rằng tiến trình đó sẽ lấy lại được bộ vi xử lý trong thời gian sớm. Do đó, việc gọi *schedule* theo cách này không phải là một giải pháp an toàn cho các nhu cầu của driver, ngoài việc gây hại cho toàn bộ hệ thống máy tính. Nếu bạn kiểm tra *jitsched* trong khi chạy *load50*, bạn có thể thấy rằng độ trễ liên quan đến mỗi dòng bị kéo dài thêm vài giây, bởi vì các tiến trình khác đang sử dụng CPU khi thời gian chờ (timeout) hết hạn.

#### Thời gian chờ (Timeouts)
Các vòng lặp trễ dưới mức tối ưu (suboptimal delay loops) được trình bày cho đến nay hoạt động bằng cách theo dõi bộ đếm `jiffy` mà không báo cho ai biết. Tuy nhiên, như bạn có thể tưởng tượng, cách tốt nhất để triển khai độ trễ thường là yêu cầu kernel thực hiện điều đó thay cho bạn. Có hai cách để thiết lập thời gian chờ dựa trên `jiffy` (jiffybased timeouts), tùy thuộc vào việc driver của bạn có đang chờ các sự kiện khác hay không.

Nếu driver của bạn sử dụng một hàng đợi chờ (wait queue) để đợi một sự kiện nào đó, nhưng bạn cũng muốn đảm bảo rằng nó chạy trong một khoảng thời gian nhất định, nó có thể sử dụng `wait_event_timeout` hoặc `wait_event_interruptible_timeout`:

```

## include <linux/wait.h>

long wait_event_timeout(wait_queue_head_t q, condition, long timeout);
long wait_event_interruptible_timeout(wait_queue_head_t q,
condition, long timeout);

```

Các hàm này ngủ (sleep) trên hàng đợi chờ được chỉ định, nhưng chúng sẽ trả về sau khi thời gian chờ (được tính bằng `jiffies`) kết thúc. Do đó, chúng thực hiện một khoảng ngủ có giới hạn (bounded sleep) và không kéo dài mãi mãi. Lưu ý rằng giá trị timeout đại diện cho số lượng `jiffies` cần chờ, chứ không phải là một giá trị thời gian tuyệt đối. Giá trị này được biểu diễn bằng một số có dấu (signed number), bởi vì đôi khi nó là kết quả của phép trừ, mặc dù các hàm sẽ đưa ra cảnh báo thông qua câu lệnh `printk` nếu timeout được cung cấp là số âm. Nếu hết thời gian chờ, các hàm trả về 0; nếu tiến trình (process) được đánh thức bởi một sự kiện khác, nó sẽ trả về khoảng thời gian trễ còn lại tính bằng `jiffies`. Giá trị trả về không bao giờ là số âm, ngay cả khi độ trễ lớn hơn dự kiến do tải của hệ thống (system load).

Tệp `/proc/jitqueue` hiển thị độ trễ dựa trên `wait_event_interruptible_timeout`, mặc dù module không có sự kiện nào để chờ và sử dụng 0 làm điều kiện (condition):

```

wait_queue_head_t wait;
init_waitqueue_head (&wait);
wait_event_interruptible_timeout(wait, 0, delay);

```

Hành vi quan sát được khi đọc `/proc/jitqueue` gần như tối ưu, ngay cả khi chịu tải:

```

phon% dd bs=20 count=5 < /proc/jitqueue
2027024 2028024
2028025 2029025
2029026 2030026
2030027 2031027
2031028 2032028

```

Vì tiến trình đọc (tiến trình `dd` ở trên) không nằm trong hàng đợi chạy (run queue) khi đang chờ timeout, bạn sẽ không thấy sự khác biệt nào về hành vi cho dù mã nguồn được chạy trên một preemptive kernel hay không.

`wait_event_timeout` và `wait_event_interruptible_timeout` được thiết kế với một hardware driver trong tâm trí, nơi việc thực thi có thể được tiếp tục theo một trong hai cách: hoặc ai đó gọi `wake_up` trên wait queue, hoặc timeout hết hạn. Điều này không áp dụng cho `jitqueue`, vì không ai gọi `wake_up` trên wait queue cả (xốt cho cùng, không có đoạn mã nào khác biết về nó), do đó tiến trình luôn thức dậy khi timeout hết hạn. Để đáp ứng tình huống này, khi bạn muốn trì hoãn việc thực thi mà không chờ đợi một sự kiện cụ thể nào, kernel cung cấp hàm `schedule_timeout` để bạn có thể tránh việc phải khai báo và sử dụng một `wait_queue_head` thừa thãi:

```

## include <linux/sched.h>

signed long schedule_timeout(signed long timeout);

```

Ở đây, timeout là số lượng `jiffies` cần trì hoãn. Giá trị trả về là 0 trừ khi hàm trả về trước khi timeout được chỉ định trôi qua (để phản hồi lại một tín hiệu - signal). `schedule_timeout` yêu cầu người gọi trước tiên phải thiết lập trạng thái tiến trình hiện tại (current process state), do đó một lời gọi điển hình sẽ có dạng:

```

set_current_state(TASK_INTERRUPTIBLE);
schedule_timeout (delay);

```

Các dòng trước đó (từ `/proc/jitschedto`) khiến tiến trình đi vào trạng thái ngủ cho đến khi thời gian chỉ định trôi qua. Vì `wait_event_interruptible_timeout` dựa vào `schedule_timeout` ở bên trong, chúng tôi sẽ không bận tâm hiển thị các con số mà `jitschedto` trả về, bởi vì chúng giống với các con số của `jitqueue`. Một lần nữa, cần lưu ý rằng một khoảng thời gian bổ sung có thể trôi qua giữa thời điểm timeout hết hạn và thời điểm tiến trình của bạn thực sự được lên lịch (scheduled) để thực thi.

Trong ví dụ vừa hiển thị, dòng đầu tiên gọi `set_current_state` để thiết lập sao cho bộ lập lịch (scheduler) sẽ không chạy lại tiến trình hiện tại cho đến khi timeout đưa nó trở lại trạng thái `TASK_RUNNING`. Để đạt được độ trễ không thể ngắt (uninterruptible delay), hãy sử dụng `TASK_UNINTERRUPTIBLE` thay thế. Nếu bạn quên thay đổi trạng thái của tiến trình hiện tại, một lời gọi đến `schedule_timeout` sẽ hành xử giống như một lời gọi đến `schedule` (nghĩa là hành vi của `jitsched`), thiết lập một bộ định thời (timer) nhưng không được sử dụng.

Nếu bạn muốn thử nghiệm với bốn tệp `jit` dưới các tình huống hệ thống khác nhau hoặc các kernel khác nhau, hoặc thử các cách khác để trì hoãn việc thực thi, bạn có thể cấu hình lượng độ trễ khi tải module bằng cách thiết lập tham số module `delay`.

### Khoảng Trễ Ngắn (Short Delays)
Khi một device driver (trình điều khiển thiết bị) cần xử lý các độ trễ (latency) trong phần cứng của nó, các khoảng trễ liên quan thường tối đa chỉ vài chục microsecond. Trong trường hợp này, việc dựa vào xung nhịp hệ thống (clock tick) chắc chắn không phải là giải pháp phù hợp.

Các hàm trong kernel là *ndelay*, *udelay* và *mdelay* hỗ trợ rất tốt cho các khoảng trễ ngắn, làm chậm quá trình thực thi (execution) tương ứng theo số lượng nanosecond, microsecond hoặc millisecond được chỉ định.\* Nguyên mẫu (prototype) của chúng là:

```c

## include <linux/delay.h>

void ndelay(unsigned long nsecs);
void udelay(unsigned long usecs);
void mdelay(unsigned long msecs);

```

Việc hiện thực thực tế của các hàm này nằm trong *<asm/delay.h>*, mang tính phụ thuộc kiến trúc (architecture-specific) và đôi khi dựa trên một hàm bên ngoài. Mọi kiến trúc đều hiện thực *udelay*, nhưng các hàm khác có thể được định nghĩa hoặc không; nếu chúng không được định nghĩa, *<linux/delay.h>* sẽ cung cấp một phiên bản mặc định dựa trên *udelay*. Trong mọi trường hợp, khoảng trễ đạt được ít nhất bằng giá trị được yêu cầu nhưng có thể lớn hơn; trên thực tế, hiện tại không có nền tảng nào đạt được độ chính xác đến mức nanosecond, mặc dù một số nền tảng cung cấp độ chính xác dưới mức microsecond.

\*** Chữ u trong *udelay* đại diện cho chữ cái Hy Lạp mu và viết tắt của *micro*.

độ chính xác. Việc tạo độ trễ lớn hơn giá trị được yêu cầu thường không phải là vấn đề, vì các khoảng trễ ngắn trong một driver thường cần thiết để chờ phần cứng, và các yêu cầu là phải chờ *ít nhất* một khoảng thời gian cho trước.

Việc hiện thực *udelay* (và có thể cả *ndelay*) sử dụng một vòng lặp phần mềm (software loop) dựa trên tốc độ bộ vi xử lý (processor speed) được tính toán tại thời điểm khởi động (boot time), sử dụng biến số nguyên `loops_per_jiffy`. Tuy nhiên, nếu bạn muốn xem mã nguồn thực tế, hãy lưu ý rằng việc hiện thực trên *x86* khá phức tạp do các nguồn tính thời gian (timing source) khác nhau mà nó sử dụng, dựa trên loại CPU đang chạy mã nguồn đó.

Để tránh hiện tượng tràn số nguyên (integer overflow) trong các phép tính vòng lặp, *udelay* và *ndelay* áp đặt giới hạn trên (upper bound) đối với giá trị được truyền vào chúng. Nếu module của bạn không thể tải (load) và hiển thị một ký hiệu chưa được phân giải (unresolved symbol), `__bad_udelay`, điều đó có đối nghĩa là bạn đã gọi *udelay* với một tham số quá lớn. Tuy nhiên, lưu ý rằng việc kiểm tra tại thời điểm biên dịch (compile-time) chỉ có thể được thực hiện trên các giá trị hằng số và không phải mọi nền tảng đều hiện thực tính năng này. Theo nguyên tắc chung, nếu bạn đang cố gắng tạo độ trễ hàng nghìn nanosecond, bạn nên sử dụng *udelay* thay vì *ndelay*; tương tự như vậy, các khoảng trễ ở quy mô millisecond nên được thực hiện bằng *mdelay* chứ không phải là một trong các hàm có độ chi tiết cao hơn (finer-grained).

Điều quan trọng cần nhớ là ba hàm độ trễ này thực hiện việc chờ bận (busy-waiting); các tiến trình (task) khác không thể chạy trong khoảng thời gian trễ đó. Do đó, chúng tái tạo lại hành vi của *jitbusy*, mặc dù ở một quy mô khác. Vì vậy, các hàm này chỉ nên được sử dụng khi không có giải pháp thay thế thực tế nào khác.

Có một cách khác để đạt được độ trễ tính bằng millisecond (và dài hơn) mà không liên quan đến việc chờ bận (busy waiting). Tệp *<linux/delay.h>* khai báo các hàm sau:

```c

void msleep(unsigned int millisecs);
unsigned long msleep_interruptible(unsigned int millisecs);
void ssleep(unsigned int seconds)

```

Hai hàm đầu tiên đưa tiến trình gọi (calling process) vào trạng thái ngủ (sleep) trong một số lượng millisecond cho trước. Lời gọi đến *msleep* là không thể ngắt (uninterruptible); bạn có thể chắc chắn rằng tiến trình sẽ ngủ ít nhất là số lượng millisecond đã cho. Nếu driver của bạn đang nằm trên một hàng đợi chờ (wait queue) và bạn muốn một tín hiệu đánh thức (wakeup) làm gián đoạn giấc ngủ, hãy sử dụng *msleep_interruptible*. Giá trị trả về từ *msleep_interruptible* thông thường là 0; tuy nhiên, nếu tiến trình bị đánh thức sớm, giá trị trả về sẽ là số lượng millisecond còn lại trong khoảng thời gian ngủ được yêu cầu ban đầu. Lời gọi đến *ssleep* đưa tiến trình vào trạng thái ngủ không thể ngắt trong số giây đã cho.

Nhìn chung, nếu bạn có thể chấp nhận độ trễ dài hơn mức được yêu cầu, bạn nên sử dụng *schedule_timeout*, *msleep* hoặc *ssleep*.

## Bộ định thời Kernel (Kernel Timers)
Bất cứ khi nào bạn cần lên lịch cho một hành động xảy ra sau đó, mà không làm khóa (block) tiến trình hiện tại cho đến thời điểm đó đến, bộ định thời kernel (kernel timer) chính là công cụ dành cho bạn. Các bộ định thời này

được sử dụng để lên lịch thực thi một hàm vào một thời điểm cụ thể trong tương lai, dựa trên xung nhịp hệ thống (clock tick), và có thể được dùng cho nhiều tác vụ khác nhau; ví dụ, thăm dò thiết bị (polling) bằng cách kiểm tra trạng thái của nó theo các khoảng thời gian đều đặn khi phần cứng không thể kích hoạt ngắt (interrupt). Các ứng dụng điển hình khác của bộ định thời kernel là tắt động tác của ổ đĩa mềm (floppy motor) hoặc hoàn tất một thao tác tắt máy dài dòng khác. Trong những trường hợp như vậy, việc trì hoãn việc trả về từ hàm *close* sẽ áp đặt một chi phí không cần thiết (và gây bất ngờ) cho chương trình ứng dụng. Cuối cùng, chính kernel cũng sử dụng các bộ định thời trong một số tình huống, bao gồm cả việc hiện thực *schedule_timeout*.

Một bộ định thời kernel là một cấu trúc dữ liệu (data structure) hướng dẫn kernel thực thi một hàm do người dùng định nghĩa với một tham số do người dùng định nghĩa tại một thời điểm do người dùng định nghĩa. Việc hiện thực nằm trong *<linux/timer.h>* và *kernel/timer.c*, đồng thời được mô tả chi tiết trong phần "Việc hiện thực các bộ định thời Kernel" (The Implementation of Kernel Timers).

Các hàm được lên lịch để chạy hầu như chắc chắn *không* chạy trong khi tiến trình (process) đăng ký chúng đang thực thi. Thay vào đó, chúng được chạy một cách bất đồng bộ (asynchronously). Cho đến nay, mọi thứ chúng ta đã làm trong các trình điều khiển mẫu (sample driver) của mình đều chạy trong ngữ cảnh tiến trình (process context) thực thi các system call (lời gọi hệ thống). Tuy nhiên, khi một bộ định thời (timer) chạy, tiến trình đã lên lịch cho nó có thể đang ngủ (asleep), đang thực thi trên một bộ xử lý (processor) khác, hoặc rất có thể đã thoát hoàn toàn.

Quá trình thực thi bất đồng bộ này giống với những gì xảy ra khi một ngắt phần cứng (hardware interrupt) xảy ra (được thảo luận chi tiết trong Chương 10). Trên thực tế, kernel timer chạy như là kết quả của một "ngắt phần mềm" (software interrupt). Khi chạy trong loại ngữ cảnh nguyên tử (atomic context) này, mã nguồn (code) của bạn phải tuân theo một số ràng buộc. Các hàm timer phải mang tính nguyên tử theo tất cả các cách mà chúng ta đã thảo luận trong phần "Spinlocks và Atomic Context" ở Chương 1, nhưng có một số vấn đề bổ sung phát sinh do thiếu ngữ cảnh tiến trình (process context). Chúng ta sẽ giới thiệu các ràng buộc này ngay bây giờ; chúng sẽ lại xuất hiện ở nhiều nơi trong các chương sau. Việc lặp lại là cần thiết vì các quy tắc đối với ngữ cảnh nguyên tử (atomic context) phải tuân thủ một cách nghiêm ngặt, nếu không hệ thống sẽ gặp rắc rối lớn.

Một số hành동 yêu cầu ngữ cảnh tiến trình (process context) để có thể thực thi. Khi bạn ở bên ngoài ngữ cảnh tiến trình (tức là trong ngữ cảnh ngắt - interrupt context), bạn phải tuân thủ các quy tắc sau:

- Không được phép truy cập vào không gian người dùng (user space). Do không có ngữ cảnh tiến trình (process context), nên không có đường dẫn nào đến không gian người dùng (user space) được liên kết với bất kỳ tiến trình cụ thể nào.
- Con trỏ `current` không có ý nghĩa ở chế độ nguyên tử (atomic mode) và không thể được sử dụng vì mã nguồn liên quan không có kết nối nào với tiến trình đã bị ngắt.
- Không được phép thực hiện việc ngủ (sleep) hay lập lịch (scheduling). Mã nguyên tử (atomic code) không được gọi hàm *schedule* hoặc bất kỳ biến thể nào của *wait\_event*, cũng không được gọi bất kỳ hàm nào khác có thể gây ngủ. Ví dụ, việc gọi *kmalloc(..., GFP\_KERNEL)* là vi phạm quy tắc. Semaphore cũng không được sử dụng vì chúng có thể gây ngủ (sleep).

Mã kernel (kernel code) có thể biết liệu nó có đang chạy trong ngữ cảnh ngắt (interrupt context) hay không bằng cách gọi hàm *in\_interrupt( )*, hàm này không nhận tham số nào và trả về giá trị khác không nếu bộ xử lý (processor) hiện đang chạy trong ngữ cảnh ngắt, bao gồm cả ngắt phần cứng hoặc ngắt phần mềm.

Một hàm liên quan đến *in\_interrupt( )* là *in\_atomic( )*. Giá trị trả về của nó khác không bất cứ khi nào việc lập lịch (scheduling) không được phép; điều này bao gồm các ngữ cảnh ngắt phần cứng và phần mềm cũng như bất kỳ thời điểm nào mà spinlock đang được giữ. Trong trường hợp sau, `current` có thể hợp lệ, nhưng việc truy cập vào không gian người dùng (user space) bị cấm, vì nó có thể làm cho việc lập lịch xảy ra. Bất cứ khi nào bạn sử dụng *in\_interrupt( )*, bạn thực sự nên cân nhắc xem *in\_atomic( )* có phải là điều bạn thực sự muốn hay không. Cả hai hàm đều được khai báo trong *<asm/hardirq.h>*

Một tính năng quan trọng khác của kernel timer là một tác vụ (task) có thể tự đăng ký lại để chạy lại vào một thời điểm sau đó. Điều này có thể thực hiện được vì mỗi cấu trúc `timer_list` sẽ bị hủy liên kết (unlinked) khỏi danh sách các timer đang hoạt động trước khi chạy và do đó, có thể được liên kết lại ngay lập tức ở nơi khác. Mặc dù việc lên lịch lại cho cùng một tác vụ hết lần này đến lần khác có vẻ là một thao tác vô nghĩa, nhưng đôi khi nó lại hữu ích. Ví dụ, nó có thể được sử dụng để triển khai việc quét vòng (polling) các thiết bị.

Cũng đáng biết rằng trong một hệ thống SMP (Symmetric Multiprocessing), hàm timer được thực thi bởi chính CPU đã đăng ký nó, nhằm đạt được tính cục bộ bộ nhớ đệm (cache locality) tốt hơn bất cứ khi nào có thể. Do đó, một timer tự đăng ký lại luôn chạy trên cùng một CPU.

Tuy nhiên, một tính năng quan trọng của timer không nên quên đó là chúng là một nguồn tiềm ẩn gây ra tình trạng tranh chấp dữ liệu (race condition), ngay cả trên các hệ thống đơn nhân (uniprocessor system). Đây là kết quả trực tiếp từ việc chúng chạy bất đồng bộ với các mã nguồn khác. Do đó, bất kỳ cấu trúc dữ liệu nào được truy cập bởi hàm timer đều phải được bảo vệ khỏi việc truy cập đồng thời (concurrent access), bằng cách sử dụng các kiểu dữ liệu nguyên tử (atomic types - được thảo luận trong phần "Atomic Variables" ở Chương 1) hoặc bằng cách sử dụng spinlock (được thảo luận trong Chương 5).

### API Bộ định thời (Timer API)
Kernel cung cấp cho các trình điều khiển (drivers) một số hàm để khai báo, đăng ký và gỡ bỏ các bộ định thời nhân (kernel timers). Đoạn mã trích dẫn sau đây thể hiện các thành phần xây dựng cơ bản:

```

## include <linux/timer.h>

struct timer_list {
/* ... */
unsigned long expires;
void (*function)(unsigned long);
unsigned long data;
};
void init_timer(struct timer_list *timer);
struct timer_list TIMER_INITIALIZER(_function, _expires, _data);
void add_timer(struct timer_list * timer);
int del_timer(struct timer_list * timer);

```

Cấu trúc dữ liệu này bao gồm nhiều trường (fields) hơn so với những gì được hiển thị, nhưng ba trường đó là những trường được thiết kế để truy cập từ bên ngoài mã nguồn của chính bộ định thời. Trường `expires` biểu diễn giá trị `jiffies` khi bộ định thời dự kiến sẽ chạy; vào thời điểm đó, hàm `function` được gọi với `data` làm đối số. Nếu bạn cần truyền nhiều mục trong đối số, bạn có thể đóng gói chúng thành một cấu trúc dữ liệu duy nhất và truyền một con trỏ đã được ép kiểu thành `unsigned long`, đây là một thực hành an toàn trên tất cả các kiến trúc được hỗ trợ và khá phổ biến trong quản lý bộ nhớ (như đã thảo luận trong Chương 15). Giá trị `expires` không phải là một mục `jiffies_64` bởi vì các bộ định thời không được kỳ vọng sẽ hết hạn ở quá xa trong tương lai, và các thao tác 64-bit chạy chậm trên các nền tảng 32-bit.

Cấu trúc này phải được khởi tạo trước khi sử dụng. Bước này đảm bảo rằng tất cả các trường đều được thiết lập đúng cách, bao gồm cả những trường ẩn (opaque) đối với bên gọi. Việc khởi tạo có thể được thực hiện bằng cách gọi hàm `init_timer` hoặc gán `TIMER_INITIALIZER` cho một cấu trúc tĩnh (static structure), tùy theo nhu cầu của bạn. Sau khi khởi tạo, bạn có thể thay đổi ba trường công khai trước khi gọi `add_timer`. Để vô hiệu hóa một bộ định thời đã đăng ký trước khi nó hết hạn, hãy gọi `del_timer`.

Module `jit` bao gồm một tệp mẫu, `/proc/jitimer` (viết tắt của "just in timer"), trả về một dòng tiêu đề và sáu dòng dữ liệu. Các dòng dữ liệu biểu diễn môi trường hiện tại nơi mã nguồn đang chạy; dòng đầu tiên được tạo bởi thao tác tệp `read` và các dòng còn lại được tạo bởi một bộ định thời. Kết quả đầu ra sau đây được ghi lại trong quá trình biên dịch một kernel:

| phon% cat /proc/jitimer |    |             |      |   |             |
|-------------------------|----|-------------|------|---|-------------|
| time                    |    | delta inirq | pid  |   | cpu command |
| 33565837                | 0  | 0           | 1269 | 0 | cat         |
| 33565847                | 10 | 1           | 1271 | 0 | sh          |
| 33565857                | 10 | 1           | 1273 | 0 | cpp0        |
| 33565867                | 10 | 1           | 1273 | 0 | cpp0        |
| 33565877                | 10 | 1           | 1274 | 0 | cc1         |
| 33565887                | 10 | 1           | 1274 | 0 | cc1         |

Trong kết quả đầu ra này, trường `time` là giá trị của `jiffies` khi mã nguồn chạy, `delta` là sự thay đổi về `jiffies` kể từ dòng trước đó, `inirq` là giá trị Boolean được trả về bởi `in_interrupt`, `pid` và `command` đề cập đến tiến trình (process) hiện tại, và `cpu` là số hiệu của CPU đang được sử dụng (luôn là 0 trên hệ thống đơn bộ xử lý - uniprocessor systems).

Nếu bạn đọc tệp `/proc/jitimer` khi hệ thống đang ở trạng thái rảnh (unloaded), bạn sẽ thấy rằng ngữ cảnh (context) của bộ định thời là tiến trình 0 (process 0), tác vụ nhàn rỗi (idle task), được gọi là "swapper" chủ yếu vì lý do lịch sử.

Bộ định thời được sử dụng để tạo dữ liệu cho `/proc/jitimer` chạy sau mỗi 10 `jiffies` theo mặc định, nhưng bạn có thể thay đổi giá trị này bằng cách thiết lập tham số `tdelay` (độ trễ bộ định thời - timer delay) khi tải module.

Đoạn mã trích dẫn sau đây thể hiện phần của `jit` liên quan đến bộ định thời `jitimer`. Khi một tiến trình cố gắng đọc tệp của chúng ta, chúng ta thiết lập bộ định thời như sau:

```

unsigned long j = jiffies;
/* điền dữ liệu cho hàm bộ định thời của chúng ta */
data->prevjiffies = j;

```

```

data->buf = buf2;
data->loops = JIT_ASYNC_LOOPS;
/* đăng ký bộ định thời */
data->timer.data = (unsigned long)data;
data->timer.function = jit_timer_fn;
data->timer.expires = j + tdelay; /* tham số */
add_timer(&data->timer);
/* chờ cho bộ đệm được lấp đầy */
wait_event_interruptible(data->wait, !data->loops);
Hàm bộ định thời thực tế trông như sau:
void jit_timer_fn(unsigned long arg)
{
struct jit_data *data = (struct jit_data *)arg;
unsigned long j = jiffies;
data->buf += sprintf(data->buf, "%9li %3li %i %6i %i %s\n",
j, j - data->prevjiffies, in_interrupt( ) ? 1 : 0,
current->pid, smp_processor_id( ), current->comm);
if (--data->loops) {
data->timer.expires += tdelay;
data->prevjiffies = j;
add_timer(&data->timer);
} else {
wake_up_interruptible(&data->wait);
}
}

```

API bộ định thời bao gồm một vài hàm nữa ngoài những hàm đã được giới thiệu ở trên. Tập hợp sau đây hoàn thiện danh sách các dịch vụ mà kernel cung cấp:

int mod\_timer(struct timer\_list \*timer, unsigned long expires);

Cập nhật thời gian hết hạn của một bộ định thời, một tác vụ phổ biến thường dùng đến bộ định thời chờ (timeout timer) (một lần nữa, bộ định thời tắt động cơ ổ đĩa mềm là một ví dụ điển hình). `mod_timer` cũng có thể được gọi trên các bộ định thời không hoạt động (inactive timers), trường hợp mà thông thường bạn sẽ dùng `add_timer`.

int del\_timer\_sync(struct timer\_list \*timer);

Hoạt động giống như *del\_timer*, nhưng cũng đảm bảo rằng khi nó trả về, hàm timer không đang chạy trên bất kỳ CPU nào. *del\_timer\_sync* được sử dụng để tránh tình trạng tranh chấp (race condition) trên các hệ thống SMP và tương tự như *del\_timer* trong các kernel UP (Uniprocessor). Hàm này nên được ưu tiên sử dụng hơn *del\_timer* trong hầu hết các tình huống. Hàm này có thể đi vào trạng thái ngủ (sleep) nếu được gọi từ ngữ cảnh phi nguyên tử (non-atomic context) nhưng sẽ bận chờ (busy wait) trong các tình huống khác. Hãy hết sức cẩn thận khi gọi *del\_timer\_sync* trong lúc đang nắm giữ các khóa (lock); nếu hàm timer cố gắng lấy cùng một khóa đó, hệ thống có thể dẫn đến bế tắc (deadlock). Nếu hàm timer tự đăng ký lại (reregister), người gọi phải đảm bảo trước rằng việc đăng ký lại này sẽ không xảy ra; điều này thường được thực hiện bằng cách thiết lập một cờ "đang tắt" (shutting down flag), cờ này sẽ được kiểm tra bởi hàm timer.

int timer\_pending(const struct timer\_list \* timer);

Trả về giá trị true hoặc false để cho biết liệu timer hiện tại có được lên lịch chạy hay không bằng cách đọc một trong các trường ẩn (opaque field) của cấu trúc.

### Triển khai Timer trong Kernel (Kernel Timers)
Mặc dù bạn không cần phải biết cách kernel timer được triển khai để sử dụng chúng, nhưng việc triển khai này rất thú vị và việc tìm hiểu các cơ chế bên trong của nó là rất đáng giá.

Việc triển khai các timer đã được thiết kế để đáp ứng các yêu cầu và giả định sau:

- Quản lý timer phải có chi phí thấp nhất có thể (lightweight).
- Thiết kế phải có khả năng mở rộng tốt (scale well) khi số lượng timer hoạt động tăng lên.
- Hầu hết các timer hết hạn trong vòng vài giây hoặc tối đa là vài phút, trong khi các timer có độ trễ dài là khá hiếm.
- Một timer phải chạy trên cùng CPU đã đăng ký nó.

Giải pháp được các nhà phát triển kernel nghĩ ra dựa trên cấu trúc dữ liệu theo từng CPU (per-CPU data structure). Cấu trúc *timer\_list* bao gồm một con trỏ trỏ đến cấu trúc dữ liệu đó trong trường `base` của nó. Nếu `base` là `NULL`, timer không được lên lịch chạy; ngược lại, con trỏ cho biết cấu trúc dữ liệu nào (và do đó, CPU nào) sẽ chạy nó. Các mục dữ liệu theo từng CPU (per-CPU data item) được mô tả trong phần "Biến theo từng CPU" (Per-CPU Variables) ở Chương 8.

Bất cứ khi nào mã nguồn kernel đăng ký một timer (thông qua *add\_timer* hoặc *mod\_timer*), thao tác này cuối cùng được thực hiện bởi *internal\_add\_timer* (trong `kernel/timer.c`), hàm này sẽ thêm timer mới vào danh sách liên kết đôi (double-linked list) các timer nằm trong một "bảng phân tầng" (cascading table) liên kết với CPU hiện tại.

Bảng phân tầng hoạt động như sau: nếu timer hết hạn trong khoảng từ 0 đến 255 jiffies tiếp theo, nó được thêm vào một trong 256 danh sách dành cho các timer tầm ngắn sử dụng các bit ít quan trọng nhất (least significant bits) của trường `expires`. Nếu nó hết hạn xa hơn trong tương lai (nhưng trước 16.384 jiffies), nó được thêm vào một trong 64 danh sách dựa trên các bit 9–14 của trường `expires`. Đối với các timer hết hạn ở xa hơn nữa, thủ thuật tương tự được sử dụng cho các bit 15–20, 21–26 và 27–31. Các timer có trường `expires` trỏ xa hơn nữa trong tương lai (điều chỉ có thể xảy ra trên các nền tảng 64-bit) được băm (hash) với giá trị độ trễ là `0xffffffff`, và các timer có thời gian hết hạn trong quá khứ sẽ được lên lịch chạy ở ngắt thời gian (timer tick) tiếp theo. (Một timer đã hết hạn đôi khi có thể được đăng ký trong các tình huống tải cao, đặc biệt là nếu bạn chạy một kernel có thể ngắt quyền - preemptible kernel).

Khi *\_\_run\_timers* được kích hoạt, nó thực thi tất cả các timer đang chờ xử lý cho ngắt thời gian hiện tại. Nếu `jiffies` hiện tại là bội số của 256, hàm này cũng sẽ băm lại (rehash) một trong các danh sách timer cấp tiếp theo vào 256 danh sách ngắn hạn, có thể phân tầng một hoặc nhiều cấp độ khác theo biểu diễn bit của `jiffies`.

Phương pháp này, mặc dù thoạt nhìn có vẻ cực kỳ phức tạp, nhưng lại hoạt động rất tốt cả với số lượng timer ít lẫn số lượng lớn. Thời gian cần thiết để quản lý mỗi timer hoạt động là độc lập với số lượng timer đã được đăng ký và giới hạn ở một vài phép toán logic trên biểu diễn nhị phân của trường `expires` của nó. Chi phí duy nhất liên quan đến việc triển khai này là bộ nhớ cho 512 đầu danh sách (256 danh sách ngắn hạn và 4 nhóm gồm 64 danh sách nữa)—tức là 4 KB dung lượng lưu trữ.

Hàm *\_\_run\_timers*, như được thể hiện qua `/proc/jitimer`, chạy trong ngữ cảnh nguyên tử (atomic context). Ngoài các giới hạn mà chúng ta đã mô tả, điều này mang lại một tính năng thú vị: timer hết hạn đúng lúc, ngay cả khi bạn không chạy kernel có thể ngắt quyền (preemptible kernel) và CPU đang bận trong không gian nhân (Kernel Space). Bạn có thể thấy điều gì xảy ra khi bạn đọc `/proc/jitbusy` ở chế độ nền (background) và `/proc/jitimer` ở chế độ tiền cảnh (foreground). Mặc dù hệ thống có vẻ bị treo cứng bởi System Call bận chờ (busy-waiting), các kernel timer vẫn hoạt động bình thường.

Tuy nhiên, hãy nhớ rằng một kernel timer hoàn hảo là điều không thể, vì nó chịu ảnh hưởng của hiện tượng trễ thời gian (jitter) và các hiện tượng giả tạo khác do ngắt phần cứng (hardware interrupt), cũng như các timer khác và các tác vụ bất đồng bộ (asynchronous task) khác. Mặc dù một timer liên quan đến I/O kỹ thuật số đơn giản có thể đủ cho các tác vụ đơn giản như chạy động cơ bước (stepper motor) hoặc các thiết bị điện tử nghiệp dư khác, nhưng nó thường không phù hợp cho các hệ thống thương mại trong môi trường công nghiệp. Đối với các tác vụ như vậy, rất có thể bạn sẽ cần phải nhờ đến phần mở rộng kernel thời gian thực (real-time kernel extension).

## Tasklets

Một cơ chế khác trong nhân hệ điều hành (kernel facility) liên quan đến vấn đề thời gian là cơ chế *tasklet*. Nó được sử dụng chủ yếu trong việc quản lý ngắt (interrupt management - chúng ta sẽ gặp lại ở Chương 10).

Tasklets có một số điểm tương đồng với bộ định thời của nhân (kernel timers). Chúng luôn chạy tại thời điểm ngắt (interrupt time), luôn chạy trên cùng CPU đã lên lịch cho chúng, và nhận một tham số kiểu `unsigned long`. Tuy nhiên, không giống như kernel timers, bạn không thể yêu cầu thực thi hàm vào một thời điểm cụ thể. Bằng cách lên lịch cho một tasklet, bạn đơn giản chỉ yêu cầu nó được thực thi vào một thời điểm sau đó do nhân (kernel) lựa chọn. Hành vi này đặc biệt hữu ích với các trình xử lý ngắt (interrupt handlers), nơi ngắt phần cứng (hardware interrupt) phải được xử lý càng nhanh càng tốt, nhưng phần lớn việc quản lý dữ liệu có thể được hoãn lại một cách an toàn sang thời điểm sau. Thực tế, một tasklet, giống như một kernel timer, được thực thi (ở chế độ nguyên tử - atomic mode) trong ngữ cảnh của một "ngắt mềm" (soft interrupt) — một cơ chế của nhân thực thi các tác vụ bất đồng bộ (asynchronous tasks) khi ngắt phần cứng được bật (enabled).

Một tasklet tồn tại dưới dạng một cấu trúc dữ liệu (data structure) cần được khởi tạo trước khi sử dụng. Việc khởi tạo có thể được thực hiện bằng cách gọi một hàm cụ thể hoặc bằng cách khai báo cấu trúc sử dụng một số macro nhất định:

```

## include <linux/interrupt.h>

struct tasklet_struct {
/* ... */

```

```

void (*func)(unsigned long);
unsigned long data;
};
void tasklet_init(struct tasklet_struct *t,
void (*func)(unsigned long), unsigned long data);
DECLARE_TASKLET(name, func, data);
DECLARE_TASKLET_DISABLED(name, func, data);

```

Tasklets cung cấp một số tính năng thú vị:

- Một tasklet có thể bị vô hiệu hóa (disabled) và kích hoạt lại sau đó; nó sẽ không được thực thi cho đến khi được kích hoạt lại đủ số lần tương ứng với số lần nó bị vô hiệu hóa.
- Giống như timers, một tasklet có thể tự đăng ký lại (reregister itself).
- Một tasklet có thể được lên lịch thực thi ở độ ưu tiên bình thường (normal priority) hoặc độ ưu tiên cao (high priority). Nhóm thứ hai luôn được thực thi trước.
- Tasklets có thể được chạy ngay lập tức nếu hệ thống không chịu tải nặng (heavy load) nhưng không muộn hơn lần ngắt định thời (timer tick) tiếp theo.
- Một tasklet có thể chạy đồng thời (concurrent) với các tasklet khác nhưng được tuần tự hóa nghiêm ngặt đối với chính nó — cùng một tasklet không bao giờ chạy đồng thời trên nhiều hơn một bộ vi xử lý. Ngoài ra, như đã lưu ý, một tasklet luôn chạy trên cùng CPU đã lên lịch cho nó.

Mô-đun *jit* bao gồm hai tệp, */proc/jitasklet* và */proc/jitasklethi*, trả về dữ liệu giống như */proc/jitimer* đã được giới thiệu trong phần "Kernel Timers". Khi bạn đọc một trong các tệp này, bạn nhận lại một dòng tiêu đề (header) và sáu dòng dữ liệu. Dòng dữ liệu đầu tiên mô tả ngữ cảnh của tiến trình gọi (calling process), và các dòng khác mô tả ngữ cảnh của các lần chạy liên tiếp của một thủ tục tasklet. Đây là một mẫu chạy trong khi đang biên dịch một kernel:

#### phon% **cat /proc/jitasklet** time delta inirq pid cpu command 6076139 0 0 4370 0 cat 6076140 1 1 4368 0 cc1 6076141 1 1 4368 0 cc1 6076141 0 1 2 0 ksoftirqd/0 6076141 0 1 2 0 ksoftirqd/0 6076141 0 1 2 0 ksoftirqd/0

Như được xác nhận bởi dữ liệu trên, tasklet được chạy tại timer tick tiếp theo miễn là CPU đang bận chạy một tiến trình, nhưng nó được chạy ngay lập tức khi CPU đang ở trạng thái rảnh rỗi (idle). Nhân cung cấp một tập hợp các luồng nhân (kernel threads) *ksoftirqd*, mỗi CPU một luồng, chỉ để chạy các trình xử lý "ngắt mềm" (soft interrupt handlers), chẳng hạn như hàm *tasklet_action*. Do đó, ba lần chạy cuối cùng của tasklet diễn ra trong ngữ cảnh của luồng nhân *ksoftirqd* được liên kết với CPU 0. Việc triển khai *jitasklethi* sử dụng một tasklet ưu tiên cao, được giải thích trong danh sách các hàm sắp tới.

Mã nguồn thực tế trong *jit* triển khai */proc/jitasklet* và */proc/jitasklethi* gần như giống hệt với mã nguồn triển khai */proc/jitimer*, nhưng nó sử dụng các lời gọi tasklet thay vì các lời gọi timer. Danh sách sau đây trình bày chi tiết giao diện nhân đối với tasklets sau khi cấu trúc tasklet đã được khởi tạo:

#### void tasklet_disable(struct tasklet_struct *t);

Hàm này vô hiệu hóa tasklet được chỉ định. Tasklet vẫn có thể được lên lịch bằng *tasklet_schedule*, nhưng việc thực thi của nó bị hoãn lại cho đến khi tasklet được kích hoạt lại. Nếu tasklet hiện đang chạy, hàm này sẽ thực hiện chờ bận (busy-waits) cho đến khi tasklet thoát; do đó, sau khi gọi *tasklet_disable*, bạn có thể chắc chắn rằng tasklet không đang chạy ở bất kỳ đâu trong hệ thống.

#### void tasklet_disable_nosync(struct tasklet_struct *t);

Vô hiệu hóa tasklet, nhưng không đợi bất kỳ hàm nào đang chạy thoát. Khi hàm này trả về, tasklet đã bị vô hiệu hóa và sẽ không được lên lịch trong tương lai cho đến khi được kích hoạt lại, nhưng nó vẫn có thể đang chạy trên một CPU khác khi hàm trả về.

#### void tasklet_enable(struct tasklet_struct *t);

Kích hoạt lại một tasklet trước đó đã bị vô hiệu hóa. Nếu tasklet đã được lên lịch từ trước, nó sẽ sớm chạy. Một lời gọi *tasklet_enable* phải tương ứng với mỗi lời gọi *tasklet_disable*, vì nhân theo dõi "số lần vô hiệu hóa" (disable count) cho mỗi tasklet.

#### void tasklet_schedule(struct tasklet_struct *t);

Lên lịch thực thi cho tasklet (schedule). Nếu một tasklet được lên lịch lần nữa trước khi nó có cơ hội chạy, nó sẽ chỉ chạy một lần duy nhất. Tuy nhiên, nếu nó được lên lịch *trong khi* đang chạy, nó sẽ chạy lại sau khi hoàn tất; điều này đảm bảo rằng các sự kiện xảy ra trong lúc các sự kiện khác đang được xử lý vẫn nhận được sự chú ý thích đáng. Hành vi này cũng cho phép một tasklet tự lên lịch lại cho chính nó.

#### void tasklet\_hi\_schedule(struct tasklet\_struct \*t);

Lên lịch thực thi cho tasklet với độ ưu tiên cao hơn (higher priority). Khi trình xử lý ngắt mềm (soft interrupt handler) chạy, nó sẽ xử lý các tasklet độ ưu tiên cao trước các tác vụ ngắt mềm khác, bao gồm cả các tasklet "bình thường". Về mặt lý tưởng, chỉ những tác vụ có yêu cầu độ trễ thấp (low-latency requirements) (chẳng hạn như lấp đầy bộ đệm âm thanh) mới nên sử dụng hàm này để tránh độ trễ bổ sung do các trình xử lý ngắt mềm khác gây ra. Trên thực tế, */proc/jitasklethi* không cho thấy sự khác biệt nào có thể nhận thấy bằng mắt thường so với */proc/jitasklet*.

#### void tasklet\_kill(struct tasklet\_struct \*t);

Hàm này đảm bảo rằng tasklet không bị lên lịch chạy lại nữa; nó thường được gọi khi một thiết bị đang được đóng (close) hoặc module bị gỡ bỏ (remove). Nếu tasklet đang được lên lịch chạy, hàm sẽ đợi cho đến khi nó thực thi xong. Nếu tasklet tự lên lịch lại, bạn phải ngăn chặn việc nó tự lên lịch lại trước khi gọi *tasklet\_kill*, tương tự như với *del\_timer\_sync*.

Các tasklet được triển khai trong *kernel/softirq.c*. Hai danh sách tasklet (bình thường và ưu tiên cao) được khai báo như các cấu trúc dữ liệu trên mỗi CPU (per-CPU data structures), sử dụng cơ chế tương thích CPU (CPU-affinity mechanism) giống như bộ định thời nhân (kernel timers). Cấu trúc dữ liệu được sử dụng trong quản lý tasklet là một danh sách liên kết (linked list) đơn giản, bởi vì các tasklet không có bất kỳ yêu cầu sắp xếp nào giống như bộ định thời nhân.

## Hàng đợi công việc (Workqueues)
*Workqueues* thoạt nhìn có nét tương tự như tasklet; chúng cho phép mã nguồn nhân (kernel code) yêu cầu một hàm được gọi tại một thời điểm nào đó trong tương lai. Tuy nhiên, có một số điểm khác biệt đáng kể giữa hai cơ chế này, bao gồm:

- Tasklet chạy trong ngữ cảnh ngắt phần mềm (software interrupt context) dẫn đến việc tất cả mã nguồn tasklet phải ở dạng nguyên tử (atomic). Ngược lại, các hàm workqueue chạy trong ngữ cảnh của một tiến trình nhân đặc biệt (special kernel process); do đó, chúng có tính linh hoạt cao hơn. Cụ thể, các hàm workqueue có thể ngủ (sleep).
- Tasklet luôn chạy trên bộ xử lý mà từ đó chúng được gửi đi ban đầu. Theo mặc định, Workqueues cũng hoạt động theo cách tương tự.
- Mã nguồn nhân có thể yêu cầu hoãn việc thực thi các hàm workqueue trong một khoảng thời gian rõ ràng (explicit interval).

Điểm khác biệt chính giữa hai cơ chế là tasklet thực thi nhanh chóng, trong một khoảng thời gian ngắn và ở chế độ nguyên tử (atomic mode), trong khi các hàm workqueue có thể có độ trễ cao hơn nhưng không bắt buộc phải ở chế độ nguyên tử. Mỗi cơ chế sẽ phù hợp với những hoàn cảnh cụ thể riêng.

Workqueues có kiểu cấu trúc `struct workqueue_struct`, được định nghĩa trong *<linux/workqueue.h>*. Một workqueue phải được tạo một cách tường minh (explicitly created) trước khi sử dụng, bằng cách sử dụng một trong hai hàm sau:

```c

struct workqueue_struct *create_workqueue(const char *name);
struct workqueue_struct *create_singlethread_workqueue(const char *name);

```

Mỗi workqueue có một hoặc nhiều tiến trình chuyên trách ("luồng nhân" - kernel threads), chịu trách nhiệm chạy các hàm được gửi vào hàng đợi. Nếu bạn sử dụng *create\_workqueue*, bạn sẽ nhận được một workqueue có một luồng chuyên trách cho mỗi bộ xử lý trên hệ thống. Trong nhiều trường hợp, tất cả các luồng đó hoàn toàn là dư thừa; nếu chỉ một luồng công việc (worker thread) là đủ, hãy tạo workqueue bằng *create\_singlethread\_workqueue* thay thế.

Để gửi một tác vụ (task) vào workqueue, bạn cần điền thông tin vào cấu trúc `struct work_struct`. Việc này có thể được thực hiện tại thời điểm biên dịch (compile time) như sau:

```c

DECLARE_WORK(name, void (*function)(void *), void *data);

```

Trong đó `name` là tên của cấu trúc cần khai báo, `function` là hàm sẽ được gọi từ workqueue, và `data` là giá trị được truyền cho hàm đó. Nếu bạn cần thiết lập cấu trúc `struct work_struct` tại thời điểm chạy (runtime), hãy sử dụng hai macro sau:

```c

INIT_WORK(struct work_struct *work, void (*function)(void *), void *data);
PREPARE_WORK(struct work_struct *work, void (*function)(void *), void *data);

```

*INIT\_WORK* thực hiện công việc khởi tạo cấu trúc một cách kỹ lưỡng hơn; bạn nên sử dụng nó trong lần đầu tiên cấu trúc được thiết lập. *PREPARE\_WORK* thực hiện công việc hầu như tương tự, nhưng nó không khởi tạo các con trỏ dùng để liên kết cấu trúc `struct work_struct` vào workqueue. Nếu có bất kỳ khả năng nào cho thấy cấu trúc đó hiện có thể đang được gửi vào một workqueue và bạn cần thay đổi cấu trúc đó, hãy sử dụng *PREPARE\_WORK* thay vì *INIT\_WORK*.

Có hai hàm dùng để gửi công việc vào workqueue:

```c

int queue_work(struct workqueue_struct *queue, struct work_struct *work);
int queue_delayed_work(struct workqueue_struct *queue,
struct work_struct *work, unsigned long delay);

```

Cả hai hàm đều thêm công việc vào hàng đợi được chỉ định. Tuy nhiên, nếu sử dụng *queue\_delayed\_work*, công việc thực tế sẽ chưa được thực hiện cho đến khi ít nhất khoảng thời gian `delay` jiffies trôi qua. Giá trị trả về từ các hàm này là 0 nếu công việc được thêm vào hàng đợi thành công; kết quả khác 0 có nghĩa là cấu trúc `struct work_struct` này đã chờ sẵn trong hàng đợi và không được thêm vào lần thứ hai.

Vào một thời điểm nào đó trong tương lai, hàm công việc (work function) sẽ được gọi với giá trị dữ liệu đã cho. Hàm này sẽ chạy trong ngữ cảnh của luồng công việc (worker thread), do đó nó có thể ngủ (sleep) nếu cần thiết—mặc dù bạn nên lưu ý về việc giấc ngủ đó có thể ảnh hưởng như thế nào đến bất kỳ tác vụ nào khác được gửi (submit) vào cùng một hàng đợi công việc (workqueue). Tuy nhiên, điều mà hàm này không thể làm là truy cập không gian người dùng (user space). Vì nó đang chạy bên trong một luồng nhân (kernel thread), nên hoàn toàn không có user space nào để truy cập.

Nếu bạn cần hủy một mục workqueue đang chờ xử lý (pending), bạn có thể gọi:

```

int cancel_delayed_work(struct work_struct *work);

```

Giá trị trả về là khác không (nonzero) nếu mục đó đã bị hủy trước khi nó bắt đầu thực thi. Kernel đảm bảo rằng việc thực thi mục được chỉ định sẽ không được khởi tạo sau lệnh gọi *cancel\_delayed\_work*. Tuy nhiên, nếu *cancel\_delayed\_work* trả về 0, mục đó có thể đã đang chạy trên một bộ xử lý (processor) khác và vẫn có thể tiếp tục chạy sau lệnh gọi *cancel\_delayed\_work*. Để hoàn toàn chắc chắn rằng hàm công việc không đang chạy ở bất kỳ đâu trong hệ thống sau khi *cancel\_delayed\_work* trả về 0, bạn phải nối tiếp lệnh gọi đó bằng một lệnh gọi đến:

```

void flush_workqueue(struct workqueue_struct *queue);

```

Sau khi *flush\_workqueue* trả về, không có hàm công việc nào được gửi trước thời điểm gọi hàm đang chạy ở bất kỳ đâu trong hệ thống.

Khi bạn đã làm việc xong với một workqueue, bạn có thể loại bỏ nó bằng:

```

void destroy_workqueue(struct workqueue_struct *queue);

```

### Hàng đợi Dùng chung (The Shared Queue)
Trong nhiều trường hợp, một trình điều khiển thiết bị (device driver) không cần workqueue riêng của mình. Nếu bạn chỉ thỉnh thoảng gửi các tác vụ vào hàng đợi, sẽ hiệu quả hơn nếu bạn chỉ đơn giản sử dụng workqueue dùng chung (shared), mặc định do kernel cung cấp. Tuy nhiên, nếu bạn sử dụng hàng đợi này, bạn phải lưu ý rằng bạn sẽ phải chia sẻ nó với những đối tượng khác. Trong số những điều khác, điều đó có nghĩa là bạn không được độc chiếm hàng đợi trong thời gian dài (không ngủ lâu) và các tác vụ của bạn có thể mất nhiều thời gian hơn để đến lượt trên bộ xử lý.

Mô-đun *jiq* ("just in queue") xuất ra hai tệp minh họa cách sử dụng shared workqueue. Chúng sử dụng một cấu trúc `struct work_struct` duy nhất, được thiết lập theo cách sau:

```

static struct work_struct jiq_work;
/* dòng này nằm trong jiq_init( ) */
INIT_WORK(&jiq_work, jiq_print_wq, &jiq_data);

```

Khi một tiến trình (process) đọc */proc/jiqwq*, mô-đun sẽ bắt đầu một loạt các lần chạy thông qua shared workqueue mà không có độ trễ. Hàm mà nó sử dụng là:

```

int schedule_work(struct work_struct *work);

```

Lưu ý rằng một hàm khác được sử dụng khi làm việc với shared queue; nó chỉ yêu cầu cấu trúc `work_struct` làm đối số. Mã nguồn thực tế trong *jiq* trông như sau:

```

prepare_to_wait(&jiq_wait, &wait, TASK_INTERRUPTIBLE);
schedule_work(&jiq_work);
schedule( );
finish_wait(&jiq_wait, &wait);

```

Hàm công việc thực tế in ra một dòng giống như mô-đun *jit* thực hiện, sau đó, nếu cần thiết, sẽ gửi lại cấu trúc `work_struct` vào workqueue. Dưới đây là toàn bộ hàm *jiq\_print\_wq*:

```

static void jiq_print_wq(void *ptr)
{
struct clientdata *data = (struct clientdata *) ptr;
if (! jiq_print (ptr))
return;
if (data->delay)
schedule_delayed_work(&jiq_work, data->delay);
else
schedule_work(&jiq_work);
}

```

Nếu người dùng đang đọc thiết bị có độ trễ (*/proc/jiqwqdelay*), hàm công việc sẽ tự gửi lại chính nó ở chế độ trễ với *schedule\_delayed\_work*:

```

int schedule_delayed_work(struct work_struct *work, unsigned long delay);

```

Nếu bạn nhìn vào đầu ra (output) từ hai thiết bị này, nó sẽ có dạng như sau:

#### % **cat /proc/jiqwq**

```

time delta preempt pid cpu command
1113043 0 0 7 1 events/1
1113043 0 0 7 1 events/1
1113043 0 0 7 1 events/1
1113043 0 0 7 1 events/1
1113043 0 0 7 1 events/1
% cat /proc/jiqwqdelay
time delta preempt pid cpu command
1122066 1 0 6 0 events/0

```

| 6 | 0 | 1 | 1122067 |  |
|---|---|---|---------|--|
| 6 | 0 | 1 | 1122068 |  |
| 6 | 0 | 1 | 1122069 |  |
| 6 | 0 | 1 | 1122070 |  |

Khi */proc/jiqwq* được đọc, không có độ trễ rõ ràng giữa việc in ra mỗi dòng. Ngược lại, khi */proc/jiqwqdelay* được đọc, có một độ trễ chính xác là một jiffy giữa mỗi dòng. Trong cả hai trường hợp, chúng ta thấy cùng một tên tiến trình được in ra; đó là tên của kernel thread thực hiện shared workqueue. Số CPU được in ra sau dấu gạch chéo; chúng ta không bao giờ biết CPU nào sẽ chạy khi tệp */proc* được đọc, nhưng sau đó hàm công việc sẽ luôn chạy trên cùng một bộ xử lý đó.

Nếu bạn cần hủy một mục công việc đã gửi vào shared queue, bạn có thể sử dụng *cancel\_delayed\_work*, như đã mô tả ở trên. Tuy nhiên, việc xả (flush) shared workqueue đòi hỏi một hàm riêng biệt:

```

void flush_scheduled_work(void);

```

Vì bạn không biết ai khác có thể đang sử dụng hàng đợi này, bạn không bao giờ thực sự biết sẽ mất bao lâu để *flush\_scheduled\_work* trả về.

## Tài liệu tham khảo nhanh (Quick Reference)
Chương này đã giới thiệu các ký hiệu sau đây.

### Quản lý thời gian (Timekeeping)
```

## include <linux/param.h>

HZ

```

Ký hiệu `HZ` chỉ định số lượng ngắt nhịp đồng hồ (clock tick) được tạo ra trong một giây.

```

## include <linux/jiffies.h>

volatile unsigned long jiffies
u64 jiffies_64

```

Biến `jiffies_64` được tăng lên một lần cho mỗi nhịp đồng hồ; do đó, nó được tăng `HZ` lần trong một giây. Mã nguồn Kernel thường tham chiếu đến `jiffies`, tương đương với `jiffies_64` trên các nền tảng 64-bit và là nửa có trọng số thấp (least significant half) của nó trên các nền tảng 32-bit.

```

int time_after(unsigned long a, unsigned long b);
int time_before(unsigned long a, unsigned long b);
int time_after_eq(unsigned long a, unsigned long b);
int time_before_eq(unsigned long a, unsigned long b);

```

Các biểu thức Boolean này so sánh `jiffies` một cách an toàn, không gặp vấn đề trong trường hợp tràn bộ đếm (counter overflow) và không cần truy cập trực tiếp vào `jiffies_64`.

```

u64 get_jiffies_64(void);

```

Truy xuất `jiffies_64` mà không gặp các điều kiện tranh chấp (race conditions).

```

## include <linux/time.h>

unsigned long timespec_to_jiffies(struct timespec *value);
void jiffies_to_timespec(unsigned long jiffies, struct timespec *value);
unsigned long timeval_to_jiffies(struct timeval *value);
void jiffies_to_timeval(unsigned long jiffies, struct timeval *value);
Chuyển đổi các biểu diễn thời gian giữa jiffies và các biểu diễn khác.

## include <asm/msr.h>

rdtsc(low32,high32);
rdtscl(low32);
rdtscll(var32);
Các macro đặc thù của x86 dùng để đọc bộ đếm dấu thời gian (timestamp counter). Chúng đọc
dưới dạng hai nửa 32-bit, chỉ đọc nửa thấp, hoặc đọc toàn bộ vào một biến long long.

## include <linux/timex.h>

cycles_t get_cycles(void);
Trả về bộ đếm dấu thời gian theo cách độc lập với nền tảng (platform-independent). Nếu CPU không cung cấp
tính năng dấu thời gian, giá trị 0 sẽ được trả về.

## include <linux/time.h>

unsigned long mktime(year, mon, day, h, m, s);
Trả về số giây kể từ mốc thời gian cơ sở (Epoch), dựa trên sáu tham số số nguyên không dấu (unsigned int).
void do_gettimeofday(struct timeval *tv);
Trả về thời gian hiện tại, tính bằng giây và micro giây kể từ mốc Epoch, với độ phân giải
tốt nhất mà phần cứng có thể cung cấp. Trên hầu hết các nền tảng, độ phân giải là một
micro giây hoặc tốt hơn, mặc dù một số nền tảng chỉ cung cấp độ phân giải theo jiffies.
struct timespec current_kernel_time(void);

```

### Độ trễ (Delays)
```

## include <linux/wait.h>

long wait_event_interruptible_timeout(wait_queue_head_t *q, condition, signed
long timeout);
Đưa tiến trình (process) hiện tại vào trạng thái ngủ trên hàng đợi chờ (wait queue), thiết lập giá trị thời gian chờ (timeout)

```

được tính bằng `jiffies`. Sử dụng `schedule_timeout` (dưới đây) cho các giấc ngủ không thể ngắt (noninterruptible sleeps).

```

## include <linux/sched.h>

signed long schedule_timeout(signed long timeout);

```

Trả về thời gian hiện tại với độ phân giải là một `jiffy`.

Gọi bộ lập lịch (scheduler) sau khi đảm bảo rằng tiến trình hiện tại được đánh thức khi hết thời gian chờ (timeout). Người gọi phải thực thi `set_current_state` trước để đưa chính nó vào trạng thái ngủ có thể ngắt (interruptible) hoặc không thể ngắt (noninterruptible).

```

## include <linux/delay.h>

void ndelay(unsigned long nsecs);
void udelay(unsigned long usecs);
void mdelay(unsigned long msecs);

```

Tạo ra độ trễ với một số nguyên là nanosecond, microsecond và millisecond. Độ trễ đạt được ít nhất là giá trị được yêu cầu, nhưng có thể lớn hơn. Tham số truyền vào mỗi hàm không được vượt quá giới hạn đặc thù của nền tảng (thường là vài nghìn).

```

void msleep(unsigned int millisecs);
unsigned long msleep_interruptible(unsigned int millisecs);
void ssleep(unsigned int seconds);

```

Đưa tiến trình vào trạng thái ngủ trong một số mili-giây (hoặc giây, trong trường hợp của `ssleep`) được chỉ định.

### Kernel Timers (Trình bấm giờ Nhân)
```

## include <asm/hardirq.h>

int in_interrupt(void);
int in_atomic(void);

```

Trả về một giá trị kiểu Boolean cho biết liệu mã nguồn đang gọi có đang thực thi trong ngữ cảnh ngắt (interrupt context) hay ngữ cảnh nguyên tử (atomic context) hay không. Ngữ cảnh ngắt nằm ngoài ngữ cảnh tiến trình (process context), diễn ra trong quá trình xử lý ngắt phần cứng hoặc phần mềm. Ngữ cảnh nguyên tử là khi bạn không thể lên lịch (schedule) ngắt hoặc ngữ cảnh của tiến trình khi đang giữ một khóa quay (spinlock).

```

## include <linux/timer.h>

void init_timer(struct timer_list * timer);
struct timer_list TIMER_INITIALIZER(_function, _expires, _data);

```

Hàm này và lệnh khai báo tĩnh cấu trúc timer là hai cách để khởi tạo cấu trúc dữ liệu `timer_list`.

```

void add_timer(struct timer_list * timer);

```

Đăng ký cấu trúc timer để chạy trên CPU hiện tại.

```

int mod_timer(struct timer_list *timer, unsigned long expires);

```

Thay đổi thời gian hết hạn của một cấu trúc timer đã được lên lịch trước đó. Nó cũng có thể hoạt động như một giải pháp thay thế cho *add_timer*.

```

int timer_pending(struct timer_list * timer);

```

Macro trả về giá trị kiểu Boolean cho biết cấu trúc timer đã được đăng ký để chạy hay chưa.

```

void del_timer(struct timer_list * timer);
void del_timer_sync(struct timer_list * timer);

```

Xóa một timer khỏi danh sách các timer đang hoạt động. Hàm sau (`del_timer_sync`) đảm bảo rằng timer hiện không chạy trên một CPU khác.

### Tasklets
```

## include <linux/interrupt.h>

DECLARE_TASKLET(name, func, data);
DECLARE_TASKLET_DISABLED(name, func, data);
void tasklet_init(struct tasklet_struct *t, void (*func)(unsigned long),
unsigned long data);

```

Hai macro đầu tiên khai báo một cấu trúc tasklet, trong khi hàm *tasklet_init* khởi tạo một cấu trúc tasklet đã được cấp phát hoặc thu được bằng các phương thức khác. Macro DECLARE thứ hai đánh dấu tasklet ở trạng thái vô hiệu hóa (disabled).

```

void tasklet_disable(struct tasklet_struct *t);
void tasklet_disable_nosync(struct tasklet_struct *t);
void tasklet_enable(struct tasklet_struct *t);

```

Vô hiệu hóa và kích hoạt lại một tasklet. Mỗi lần gọi *disable* phải tương ứng với một lần gọi *enable* (bạn có thể vô hiệu hóa tasklet ngay cả khi nó đã bị vô hiệu hóa từ trước). Hàm *tasklet_disable* sẽ chờ cho đến khi tasklet kết thúc nếu nó đang chạy trên một CPU khác. Phiên bản *nosync* không thực hiện bước bổ sung này.

```

void tasklet_schedule(struct tasklet_struct *t);
void tasklet_hi_schedule(struct tasklet_struct *t);

```

Lên lịch để chạy một tasklet, dưới dạng tasklet "bình thường" hoặc ưu tiên cao (high-priority). Khi các ngắt mềm (soft interrupts) được thực thi, các tasklet ưu tiên cao sẽ được xử lý trước, trong khi các tasklet bình thường chạy sau cùng.

```

void tasklet_kill(struct tasklet_struct *t);

```

Xóa tasklet khỏi danh sách các tasklet đang hoạt động nếu nó đã được lên lịch chạy. Giống như *tasklet_disable*, hàm này có thể bị chặn (block) trên các hệ thống đa xử lý đối xứng (SMP systems) để chờ tasklet kết thúc nếu nó đang chạy trên một CPU khác.

## Workqueues (Hàng đợi công việc)
```

## include <linux/workqueue.h>

struct workqueue_struct;
struct work_struct;

```

Các cấu trúc đại diện cho một workqueue (hàng đợi công việc) và một mục công việc (work entry).

```

struct workqueue_struct *create_workqueue(const char *name);
struct workqueue_struct *create_singlethread_workqueue(const char *name);
void destroy_workqueue(struct workqueue_struct *queue);

```

Các hàm dùng để tạo và hủy các workqueue. Lời gọi hàm *create\_workqueue* tạo ra một hàng đợi với một worker thread (luồng xử lý) trên mỗi bộ vi xử lý trong hệ thống; trong khi đó, *create\_singlethread\_workqueue* tạo ra một workqueue chỉ với một tiến trình xử lý duy nhất (worker process).

```

DECLARE_WORK(name, void (*function)(void *), void *data);
INIT_WORK(struct work_struct *work, void (*function)(void *), void *data);
PREPARE_WORK(struct work_struct *work, void (*function)(void *), void *data);
Các macro dùng để khai báo và khởi tạo các mục workqueue.
int queue_work(struct workqueue_struct *queue, struct work_struct *work);
int queue_delayed_work(struct workqueue_struct *queue, struct work_struct
*work, unsigned long delay);
Các hàm dùng để đưa công việc vào hàng đợi để thực thi từ một workqueue.
int cancel_delayed_work(struct work_struct *work);
void flush_workqueue(struct workqueue_struct *queue);
Sử dụng cancel_delayed_work để loại bỏ một mục khỏi workqueue; flush_workqueue
đảm bảo rằng không có mục workqueue nào đang chạy ở bất kỳ đâu trong hệ thống.
int schedule_work(struct work_struct *work);
int schedule_delayed_work(struct work_struct *work, unsigned long delay);
void flush_scheduled_work(void);
Các hàm làm việc với workqueue dùng chung (shared workqueue).

```
