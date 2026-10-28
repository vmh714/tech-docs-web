# Chương 10: Xử lý ngắt (Interrupt Handling)

Mặc dù một số thiết bị có thể được điều khiển mà không cần gì ngoài các vùng I/O của chúng, phần lớn các thiết bị thực tế lại phức tạp hơn thế một chút. Các thiết bị phải tương tác với thế giới bên ngoài, thường bao gồm các thành phần như đĩa quay, băng từ chuyển động, dây dẫn đến các khoảng cách xa, v.v. Rất nhiều việc phải được thực hiện trong một khung thời gian khác biệt và chậm hơn nhiều so với bộ vi xử lý (processor). Vì hầu như không bao giờ mong muốn để bộ xử lý phải chờ đợi các sự kiện bên ngoài, nên phải có một cơ chế để thiết bị thông báo cho bộ xử lý biết khi có sự kiện xảy ra.

Cơ chế đó, tất nhiên, chính là các ngắt (interrupts). Một *ngắt* (*interrupt*) đơn giản là một tín hiệu mà phần cứng có thể gửi đi khi nó muốn thu hút sự chú ý của bộ xử lý. Linux xử lý các ngắt theo cách rất giống với cách nó xử lý các tín hiệu (signals) trong không gian người dùng (user space). Phần lớn, một trình điều khiển (driver) chỉ cần đăng ký một hàm xử lý (handler) cho các ngắt của thiết bị, và xử lý chúng một cách thích hợp khi chúng đến. Tất nhiên, đằng sau bức tranh đơn giản đó vẫn ẩn chứa một số độ phức tạp; cụ thể là các hàm xử lý ngắt (interrupt handlers) bị giới hạn nhất định trong các hành động mà chúng có thể thực hiện do cách thức mà chúng được thực thi.

Thật khó để minh họa việc sử dụng ngắt mà không có một thiết bị phần cứng thực tế để tạo ra chúng. Do đó, mã nguồn mẫu được sử dụng trong chương này làm việc với cổng song song (parallel port). Các cổng như vậy đang bắt đầu trở nên khan hiếm trên phần cứng hiện đại, nhưng may mắn là hầu hết mọi người vẫn có thể tiếp cận được một hệ thống có sẵn cổng này. Chúng ta sẽ làm việc với module *short* từ chương trước; chỉ với một số bổ sung nhỏ, nó có thể tạo ra và xử lý các ngắt từ cổng song song. Tên của module, *short*, thực ra là viết tắt của *short int* (đây là ngôn ngữ C mà phải không?), để nhắc nhở chúng ta rằng nó xử lý các ngắt (*int*errupts).

Tuy nhiên, trước khi đi sâu vào chủ đề này, đã đến lúc đưa ra một lưu ý thận trọng. Về bản chất, các hàm xử lý ngắt chạy đồng thời (concurrently) với mã nguồn khác. Do đó, chúng không thể tránh khỏi việc đặt ra các vấn đề về tính đồng thời (concurrency) và tranh chấp (contention) đối với các cấu trúc dữ liệu và phần cứng. Nếu bạn đã bỏ qua phần thảo luận trong Chương 5 vì không cưỡng lại được sự cám dỗ, chúng tôi hoàn toàn thông cảm. Nhưng chúng tôi cũng khuyên bạn nên quay lại và xem xét lại nó ngay bây giờ. Nắm vững các kỹ thuật điều khiển tính đồng thời (concurrency control techniques) là điều tối quan trọng khi làm việc với các ngắt.

## Chuẩn bị Cổng Song Song (Preparing the Parallel Port)

Mặc dù giao diện song song rất đơn giản, nó vẫn có thể kích hoạt các ngắt. Khả năng này được sử dụng bởi trình điều khiển máy in (*lp* driver) để thông báo cho nó biết rằng nó đã sẵn sàng nhận ký tự tiếp theo trong bộ đệm (buffer).

Giống như hầu hết các thiết bị, cổng song song thực tế không tự động tạo ra ngắt trước khi được cấu hình làm việc đó; tiêu chuẩn song song nêu rõ rằng việc thiết lập bit 4 của cổng 2 (0x37a, 0x27a, hoặc tương tự) sẽ cho phép tính năng báo cáo ngắt. Một lời gọi hàm `outb` đơn giản để thiết lập bit này được thực hiện bởi *short* trong quá trình khởi tạo module.

Một khi các ngắt được kích hoạt, giao diện song song sẽ tạo ra một ngắt bất cứ khi nào tín hiệu điện tại chân 10 (còn gọi là bit ACK) chuyển từ mức thấp lên mức cao. Cách đơn giản nhất để ép giao diện tạo ra ngắt (nếu không muốn cắm một máy in vào cổng) là nối tắt chân 9 và chân 10 của đầu nối song song. Một đoạn dây dẫn ngắn được cắm vào các lỗ thích hợp trên đầu nối cổng song song ở mặt sau hệ thống của bạn sẽ tạo ra kết nối này. Sơ đồ chân (pinout) của cổng song song được thể hiện trong Hình 9-1.

Chân 9 là bit có trọng số cao nhất (most significant bit) của byte dữ liệu song song. Nếu bạn ghi dữ liệu nhị phân vào */dev/short0*, bạn sẽ tạo ra một vài ngắt. Tuy nhiên, việc ghi văn bản ASCII vào cổng sẽ không tạo ra bất kỳ ngắt nào, bởi vì tập ký tự ASCII không có mục nào được bật bit cao nhất.

Nếu bạn muốn tránh việc nối dây các chân với nhau, nhưng bạn có sẵn một máy in, bạn có thể chạy hàm xử lý ngắt mẫu bằng một máy in thực tế, như sẽ được trình bày sau đây. Tuy nhiên, lưu ý rằng các hàm dò tìm (probing functions) mà chúng ta giới thiệu phụ thuộc vào việc cầu nối (jumper) giữa chân 9 và 10 được cắm sẵn, và bạn cần nó để thử nghiệm việc dò tìm bằng mã nguồn của chúng tôi.

## Cài đặt một Hàm Xử lý Ngắt (Installing an Interrupt Handler)

Nếu bạn thực sự muốn "nhìn thấy" các ngắt được tạo ra, việc ghi vào thiết bị phần cứng là chưa đủ; một hàm xử lý phần mềm phải được cấu hình trong hệ thống. Nếu nhân Linux không được cấu hình để chờ đợi ngắt của bạn, nó sẽ đơn giản là xác nhận và bỏ qua ngắt đó.

Các đường ngắt là một tài nguyên quý giá và thường bị hạn chế, đặc biệt khi chỉ có 15 hoặc 16 đường ngắt. Nhân hệ điều hành duy trì một cơ chế đăng ký các đường ngắt, tương tự như việc đăng ký các cổng I/O. Một module được yêu cầu phải yêu cầu một kênh ngắt (hoặc IRQ, viết tắt của interrupt request) trước khi sử dụng và phải giải phóng nó khi hoàn thành. Trong nhiều tình huống, các module cũng được kỳ vọng có thể chia sẻ các đường ngắt với các trình điều khiển khác, như chúng ta sẽ thấy. Các hàm sau đây, được khai báo trong *<linux/interrupt.h>*, thực hiện giao diện đăng ký ngắt:

```c
int request_irq(unsigned int irq,
                irqreturn_t (*handler)(int, void *, struct pt_regs *),
                unsigned long flags,
                const char *dev_name,
                void *dev_id);

void free_irq(unsigned int irq, void *dev_id);
```

Giá trị trả về từ hàm *request\_irq* cho hàm gọi là 0 để biểu thị thành công hoặc một mã lỗi âm, như thông thường. Việc hàm trả về mã -EBUSY để ra hiệu rằng một driver khác đang sử dụng đường ngắt (interrupt line) được yêu cầu là điều không hiếm gặp. Các tham số của các hàm này như sau:

unsigned int irq

Số ngắt (interrupt number) đang được yêu cầu.

irqreturn\_t (\*handler)(int, void \*, struct pt\_regs \*)

Con trỏ trỏ tới hàm xử lý (handling function) đang được cài đặt. Chúng ta sẽ thảo luận về các tham số của hàm này và giá trị trả về của nó ở phần sau của chương này.

unsigned long flags

Như bạn có thể đoán trước, đây là một mặt nạ bit (bit mask) gồm các tùy chọn (được mô tả sau đây) liên quan đến quản lý ngắt (interrupt management).

const char \*dev\_name

Chuỗi được truyền vào *request\_irq* được sử dụng trong */proc/interrupts* để hiển thị chủ sở hữu của ngắt (xem phần tiếp theo).

void \*dev\_id

Con trỏ được sử dụng cho các đường ngắt chia sẻ (shared interrupt lines). Đây là một định danh duy nhất (unique identifier) được sử dụng khi đường ngắt được giải phóng và cũng có thể được driver sử dụng để trỏ tới vùng dữ liệu riêng tư của chính nó (để xác định thiết bị nào đang tạo ra ngắt). Nếu ngắt không được chia sẻ, *dev\_id* có thể được đặt thành NULL, nhưng dù sao đi nữa, sử dụng mục này để trỏ tới cấu trúc thiết bị (device structure) vẫn là một ý hay. Chúng ta sẽ thấy một cách sử dụng thực tế của *dev\_id* trong phần "Triển khai một hàm xử lý" (Implementing a Handler).

Các bit có thể được thiết lập trong *flags* như sau:

SA\_INTERRUPT

Khi được thiết lập, điều này biểu thị một trình xử lý ngắt "nhanh" (fast interrupt handler). Các trình xử lý nhanh được thực thi với các ngắt bị vô hiệu hóa trên bộ xử lý hiện tại (chủ đề này được đề cập trong phần "Trình xử lý nhanh và chậm" - Fast and Slow Handlers).

SA\_SHIRQ

Bit này báo hiệu rằng ngắt có thể được chia sẻ giữa các thiết bị. Khái niệm chia sẻ được phác thảo trong phần "Chia sẻ ngắt" (Interrupt Sharing).

SA\_SAMPLE\_RANDOM

Bit này biểu thị rằng các ngắt được tạo ra có thể đóng góp vào hồ chứa entropy (entropy pool) được sử dụng bởi */dev/random* và */dev/urandom*. Các thiết bị này trả về các số thực sự ngẫu nhiên khi được đọc và được thiết kế để giúp phần mềm ứng dụng chọn các khóa bảo mật cho việc mã hóa. Các số ngẫu nhiên như vậy được trích xuất từ một hồ chứa entropy được đóng góp bởi các sự kiện ngẫu nhiên khác nhau. Nếu thiết bị của bạn tạo ra các ngắt tại những thời điểm thực sự ngẫu nhiên, bạn nên thiết lập cờ này. Mặt khác, nếu các ngắt của bạn có thể dự đoán được (ví dụ: khoảng trống dọc - vertical blanking của một thiết bị thu khung hình - frame grabber), thì việc thiết lập cờ này là không đáng—dù sao thì nó cũng không đóng góp gì cho entropy của hệ thống. Các thiết bị có thể bị ảnh hưởng bởi kẻ tấn công không nên thiết lập cờ này; ví dụ, các driver mạng (network drivers) có thể phải chịu thời gian gói tin có thể dự đoán được từ bên ngoài và không nên đóng góp vào hồ chứa entropy. Xem các chú thích trong *drivers/char/random.c* để biết thêm thông tin.

Trình xử lý ngắt (interrupt handler) có thể được cài đặt hoặc là lúc khởi tạo driver hoặc khi thiết bị được mở lần đầu tiên. Mặc dù việc cài đặt trình xử lý ngắt từ bên trong hàm khởi tạo của module (module's initialization function) nghe có vẻ là một ý hay, nhưng thường thì không phải vậy, đặc biệt là nếu thiết bị của bạn không chia sẻ ngắt. Vì số lượng đường ngắt là có hạn, bạn không muốn lãng phí chúng. Bạn có thể dễ dàng rơi vào tình trạng có nhiều thiết bị trong máy tính của mình hơn số lượng ngắt có sẵn. Nếu một module yêu cầu một IRQ tại thời điểm khởi tạo, nó sẽ ngăn bất kỳ driver nào khác sử dụng ngắt đó, ngay cả khi thiết bị nắm giữ nó không bao giờ được sử dụng. Ngược lại, việc yêu cầu ngắt tại thời điểm mở thiết bị (device open) cho phép chia sẻ một phần tài nguyên.

Ví dụ, có thể chạy một thiết bị thu khung hình (frame grabber) trên cùng một ngắt với một modem, miễn là bạn không sử dụng hai thiết bị cùng một lúc. Việc người dùng tải module cho một thiết bị đặc biệt khi khởi động hệ thống là khá phổ biến, ngay cả khi thiết bị đó hiếm khi được sử dụng. Một thiết bị thu thập dữ liệu (data acquisition gadget) có thể sử dụng cùng một ngắt với cổng nối tiếp thứ hai (second serial port). Mặc dù không quá khó để tránh kết nối với nhà cung cấp dịch vụ Internet (ISP) của bạn trong quá trình thu thập dữ liệu, nhưng việc bị buộc phải gỡ tải (unload) một module chỉ để sử dụng modem thực sự rất khó chịu.

Nơi chính xác để gọi *request\_irq* là khi thiết bị được mở lần đầu tiên, *trước khi* phần cứng được lệnh tạo ra ngắt. Nơi để gọi *free\_irq* là lần đóng thiết bị cuối cùng, *sau khi* phần cứng được bảo là không ngắt bộ xử lý nữa. Nhược điểm của kỹ thuật này là bạn cần phải duy trì một bộ đếm số lần mở trên mỗi thiết bị (per-device open count) để biết khi nào các ngắt có thể bị vô hiệu hóa.

Mặc dù có cuộc thảo luận này, *short* vẫn yêu cầu đường ngắt của nó tại thời điểm tải module (load time). Điều này được thực hiện để bạn có thể chạy các chương trình kiểm tra mà không cần phải chạy một tiến trình bổ sung để giữ cho thiết bị luôn mở. Do đó, *short* yêu cầu ngắt từ bên trong hàm khởi tạo của nó (*short\_init*) thay vì thực hiện việc đó trong *short\_open*, như một driver thiết bị thực tế sẽ làm.

Ngắt được yêu cầu bởi đoạn mã sau là *short\_irq*. Việc gán thực tế cho biến này (tức là xác định IRQ nào sẽ sử dụng) được thể hiện ở phần sau, vì nó không liên quan đến cuộc thảo luận hiện tại. *short\_base* là địa chỉ I/O cơ sở của giao diện song song đang được sử dụng; thanh ghi 2 của giao diện được ghi để bật tính năng báo cáo ngắt.

```c
if (short_irq >= 0) {
 result = request_irq(short_irq, short_interrupt,
 SA_INTERRUPT, "short", NULL);
 if (result) {
 printk(KERN_INFO "short: can't get assigned irq %i\n",
 short_irq);
```

```
 short_irq = -1;
 }
 else { /* thực tế kích hoạt nó -- giả sử đây *là* một cổng song song */
 outb(0x10,short_base+2);
 }
}
```

Đoạn mã cho thấy trình xử lý (handler) được cài đặt là một trình xử lý nhanh (fast handler) (`SA_INTERRUPT`), không hỗ trợ chia sẻ ngắt (interrupt sharing) (thiếu cờ `SA_SHIRQ`), và không đóng góp vào độ entropy của hệ thống (cũng thiếu cờ `SA_SAMPLE_RANDOM`). Lời gọi hàm *outb* sau đó sẽ kích hoạt việc báo cáo ngắt cho cổng song song (parallel port).

Để tham khảo, các kiến trúc i386 và x86_64 định nghĩa một hàm để truy vấn tính khả dụng của một đường ngắt (interrupt line):

```
int can_request_irq(unsigned int irq, unsigned long flags);
```

Hàm này trả về một giá trị khác 0 nếu nỗ lực cấp phát ngắt được chỉ định thành công. Tuy nhiên, hãy lưu ý rằng mọi thứ hoàn toàn có thể thay đổi trong khoảng thời gian giữa các lời gọi hàm *can_request_irq* và *request_irq*.

### Giao diện /proc

Bất cứ khi nào một ngắt phần cứng (hardware interrupt) đi đến bộ vi xử lý (processor), một bộ đếm nội bộ sẽ được tăng lên, cung cấp một cách để kiểm tra xem thiết bị có đang hoạt động như mong đợi hay không. Các ngắt được báo cáo sẽ hiển thị trong */proc/interrupts*. Bản chụp trạng thái (snapshot) sau đây được ghi lại trên một hệ thống Pentium hai bộ xử lý:

root@montalcino:/bike/corbet/write/ldd3/src/short# **m /proc/interrupts**

|      | CPU0    | CPU1    |                        |                |
|------|---------|---------|------------------------|----------------|
| 0:   | 4848108 | 34      | IO-APIC-edge timer     |                |
| 2:   | 0       | 0       |                        | XT-PIC cascade |
| 8:   | 3       | 1       | IO-APIC-edge rtc       |                |
| 10:  | 4335    | 1       | IO-APIC-level aic7xxx  |                |
| 11:  | 8903    | 0       | IO-APIC-level uhci_hcd |                |
| 12:  | 49      | 1       | IO-APIC-edge i8042     |                |
| NMI: | 0       | 0       |                        |                |
| LOC: | 4848187 | 4848186 |                        |                |
| ERR: | 0       |         |                        |                |
| MIS: | 0       |         |                        |                |

Cột đầu tiên là số hiệu IRQ. Từ các số IRQ bị thiếu, bạn có thể thấy rằng tệp này chỉ hiển thị các ngắt tương ứng với các trình xử lý đã được cài đặt. Ví dụ, cổng nối tiếp đầu tiên (sử dụng số ngắt 4) không được hiển thị, cho thấy rằng modem đang không được sử dụng. Trên thực tế, ngay cả khi modem đã được sử dụng trước đó nhưng không được sử dụng tại thời điểm chụp trạng thái, nó cũng sẽ không xuất hiện trong tệp; các cổng nối tiếp hoạt động rất chuẩn mực và giải phóng các trình xử lý ngắt của chúng khi thiết bị được đóng (closed).

Màn hình hiển thị của */proc/interrupts* cho biết có bao nhiêu ngắt đã được chuyển đến từng CPU trên hệ thống. Như bạn có thể thấy từ kết quả đầu ra, Linux kernel nhìn chung xử lý các ngắt trên CPU đầu tiên như một cách để tối đa hóa tính cục bộ của bộ nhớ cache (cache locality).\* Hai cột cuối cùng cung cấp thông tin về bộ điều khiển ngắt có thể lập trình (programmable interrupt controller) xử lý ngắt đó (thứ mà một lập trình viên viết driver không cần phải bận tâm), và tên của (các) thiết bị đã đăng ký trình xử lý cho ngắt đó (như được chỉ định trong tham số `dev_name` của hàm *request_irq*).

Cây thư mục */proc* chứa một tệp liên quan đến ngắt khác, */proc/stat*; đôi khi bạn sẽ thấy tệp này hữu ích hơn và đôi khi bạn sẽ thích tệp kia hơn. */proc/stat* ghi lại một số thống kê cấp thấp (low-level statistics) về hoạt động của hệ thống, bao gồm (nhưng không giới hạn ở) số lượng ngắt nhận được kể từ khi hệ thống khởi động (boot). Mỗi dòng của tệp *stat* bắt đầu bằng một chuỗi văn bản đóng vai trò là khóa (key) cho dòng đó; nhãn `intr` là thứ chúng ta đang tìm kiếm. Bản chụp trạng thái (đã được cắt bớt) sau đây được ghi lại ngay sau bản chụp trước đó:

intr 5167833 5154006 2 0 2 4907 0 2 68 4 0 4406 9291 50 0 0

Số đầu tiên là tổng của tất cả các ngắt, trong khi mỗi số tiếp theo đại diện cho một đường IRQ đơn lẻ, bắt đầu với ngắt 0. Tất cả các số đếm đều được cộng dồn trên tất cả các bộ vi xử lý trong hệ thống. Bản chụp trạng thái này cho thấy rằng ngắt số 4 đã được sử dụng 4907 lần, mặc dù *hiện tại* không có trình xử lý nào được cài đặt. Nếu driver bạn đang kiểm thử thực hiện cấp phát và giải phóng ngắt tại mỗi chu kỳ mở (open) và đóng (close), bạn có thể thấy */proc/stat* hữu ích hơn */proc/interrupts*.

Một điểm khác biệt nữa giữa hai tệp này là *interrupts* không phụ thuộc vào kiến trúc (architecture independent) (trừ, có lẽ là một vài dòng ở cuối), trong khi *stat* thì có; số lượng các trường (fields) phụ thuộc vào phần cứng cơ sở của kernel. Số lượng ngắt khả dụng thay đổi từ ít nhất là 15 trên kiến trúc SPARC cho đến tận 256 trên IA-64 và một số hệ thống khác. Thật thú vị khi lưu ý rằng số lượng ngắt được định nghĩa trên x86 hiện tại là 224, chứ không phải 16 như bạn có thể mong đợi; điều này, như được giải thích trong tệp *include/asm-i386/irq.h*, phụ thuộc vào việc Linux sử dụng giới hạn của kiến trúc thay vì giới hạn đặc thù của việc triển khai (chẳng hạn như 16 nguồn ngắt của bộ điều khiển ngắt PC kiểu cũ).

```

Dưới đây là bản chụp của */proc/interrupts* lấy từ một hệ thống IA-64. Như bạn có thể thấy, ngoài các định tuyến phần cứng (hardware routing) khác nhau đối với các nguồn ngắt (interrupt source) phổ biến, đầu ra này rất giống với hệ thống 32-bit được hiển thị trước đó.

|      | CPU0    | CPU1    |                              |               |
|------|---------|---------|------------------------------|---------------|
| 27:  | 1705    |         | 34141 IO-SAPIC-level qla1280 |               |
| 40:  | 0       | 0       |                              | SAPIC perfmon |
| 43:  | 913     |         | 6960 IO-SAPIC-level eth0     |               |
| 47:  | 26722   |         | 146 IO-SAPIC-level usb-uhci  |               |
| 64:  | 3       | 6       | IO-SAPIC-edge ide0           |               |
| 80:  | 4       | 2       | IO-SAPIC-edge keyboard       |               |
| 89:  | 0       | 0       | IO-SAPIC-edge PS/2 Mouse     |               |
| 239: | 5606341 | 5606052 |                              | SAPIC timer   |

Mặc dù vậy, một số hệ thống lớn hơn sử dụng rõ ràng các lược đồ cân bằng ngắt (interrupt balancing scheme) để phân bổ tải ngắt (interrupt load) trên toàn hệ thống.

254: 67575 52815 SAPIC IPI NMI: 0 0 ERR: 0

### Tự động phát hiện Số hiệu IRQ (Autodetecting the IRQ Number)
Một trong những vấn đề thách thức nhất đối với một trình điều khiển (driver) tại thời điểm khởi tạo (initialization time) có thể là làm thế nào để xác định đường dẫn IRQ nào sẽ được sử dụng bởi thiết bị. Trình điều khiển cần thông tin này để cài đặt trình xử lý (handler) một cách chính xác. Mặc dù một lập trình viên có thể yêu cầu người dùng chỉ định số hiệu ngắt tại thời điểm nạp (load time), đây lại là một thực hành tồi, bởi vì phần lớn thời gian người dùng không biết số hiệu đó, hoặc do họ chưa cấu hình các jumper (cầu nối) hoặc vì thiết bị không có jumper. Hầu hết người dùng muốn phần cứng của họ "chỉ chạy" và không quan tâm đến các vấn đề như số hiệu ngắt. Vì vậy, việc tự động phát hiện số hiệu ngắt là một yêu cầu cơ bản đối với tính khả dụng của trình điều khiển.

Đôi khi, việc tự động phát hiện phụ thuộc vào việc nắm rõ rằng một số thiết bị có hành vi mặc định hiếm khi (hoặc không bao giờ) thay đổi. Trong trường hợp này, trình điều khiển có thể giả định rằng các giá trị mặc định được áp dụng. Đây chính xác là cách mà *short* hoạt động theo mặc định với cổng song song (parallel port). Việc cài đặt khá đơn giản, như chính *short* thể hiện:

```

if (short_irq < 0) /* chưa được chỉ định: ép buộc dùng mặc định */
switch(short_base) {
case 0x378: short_irq = 7; break;
case 0x278: short_irq = 2; break;
case 0x3bc: short_irq = 5; break;
}

```

Mã nguồn này gán số hiệu ngắt theo địa chỉ I/O cơ sở (base I/O address) đã chọn, đồng thời cho phép người dùng ghi đè giá trị mặc định tại thời điểm nạp với một lệnh như:

```

insmod ./short.ko irq=x

```

`short_base` mặc định là `0x378`, vì vậy `short_irq` mặc định là `7`.

Một số thiết bị có thiết kế tiên tiến hơn và đơn giản là "thông báo" ngắt nào mà chúng sẽ sử dụng. Trong trường hợp này, trình điều khiển truy xuất số hiệu ngắt bằng cách đọc một byte trạng thái (status byte) từ một trong các cổng I/O của thiết bị hoặc không gian cấu hình PCI (PCI configuration space). Khi thiết bị đích là loại có khả năng thông báo cho trình điều khiển biết ngắt nào sẽ được sử dụng, việc tự động phát hiện số hiệu IRQ chỉ đơn giản có nghĩa là thăm dò (probe) thiết bị, mà không cần thêm công sức nào để thăm dò ngắt. May mắn thay, hầu hết phần cứng hiện đại đều hoạt động theo cách này; ví dụ, chuẩn PCI giải quyết vấn đề bằng cách yêu cầu các thiết bị ngoại vi khai báo đường ngắt nào chúng sẽ sử dụng. Chuẩn PCI được thảo luận trong Chương 12.

Thật không may, không phải mọi thiết bị đều thân thiện với lập trình viên, và việc tự động phát hiện có thể đòi hỏi một số thao tác thăm dò (probing). Kỹ thuật này khá đơn giản: trình điều khiển bảo thiết bị tạo ra các ngắt và quan sát điều gì xảy ra. Nếu mọi thứ diễn ra tốt đẹp, chỉ có một đường ngắt được kích hoạt.

Mặc dù việc thăm dò rất đơn giản về mặt lý thuyết, việc cài đặt thực tế có thể không rõ ràng. Chúng ta sẽ xem xét hai cách để thực hiện tác vụ này: gọi các hàm hỗ trợ do kernel định nghĩa (kernel-defined helper functions) và tự cài đặt phiên bản của riêng chúng ta.

### Dò tìm được hỗ trợ bởi Kernel (Kernel-assisted probing)

Linux kernel cung cấp một cơ chế mức thấp (low-level facility) để dò tìm số ngắt (interrupt number). Cơ chế này chỉ hoạt động đối với các ngắt không chia sẻ (nonshared interrupt), nhưng hầu hết phần cứng có khả năng hoạt động ở chế độ ngắt chia sẻ (shared interrupt mode) dù sao cũng cung cấp các cách tốt hơn để tìm số ngắt đã cấu hình. Cơ chế này bao gồm hai hàm, được khai báo trong *<linux/interrupt.h>* (nơi cũng mô tả hệ thống dò tìm):

```

unsigned long probe_irq_on(void);

```

Hàm này trả về một mặt nạ bit (bit mask) của các ngắt chưa được gán. Trình điều khiển (driver) phải lưu giữ mặt nạ bit được trả về này và truyền nó cho *probe\_irq\_off* sau đó. Sau lệnh gọi này, driver nên sắp xếp để thiết bị của nó tạo ra ít nhất một ngắt.

```

int probe_irq_off(unsigned long);

```

Sau khi thiết bị yêu cầu một ngắt, driver sẽ gọi hàm này, truyền vào đối số là mặt nạ bit đã được trả về trước đó bởi *probe\_irq\_on*. *probe\_irq_off* trả về số của ngắt đã được phát hành sau "probe_on". Nếu không có ngắt nào xảy ra, giá trị 0 được trả về (do đó, IRQ 0 không thể được dò tìm, nhưng dù sao thì không có thiết bị tùy chỉnh nào có thể sử dụng nó trên bất kỳ kiến trúc được hỗ trợ nào). Nếu có nhiều hơn một ngắt xảy ra (phát hiện mơ hồ - ambiguous detection), *probe\_irq\_off* trả về một giá trị âm.

Lập trình viên nên cẩn thận bật ngắt trên thiết bị *sau* lệnh gọi *probe\_irq\_on* và tắt chúng *trước* khi gọi *probe\_irq\_off*. Ngoài ra, bạn phải nhớ xử lý ngắt đang chờ (pending interrupt) trong thiết bị của mình sau *probe\_irq\_off*.

Module *short* minh họa cách sử dụng việc dò tìm như vậy. Nếu bạn tải (load) module với tham số `probe=1`, đoạn mã sau sẽ được thực thi để phát hiện đường ngắt (interrupt line) của bạn, với điều kiện chân 9 và 10 của cổng song song (parallel connector) được nối với nhau:

```

int count = 0;
do {
unsigned long mask;
mask = probe_irq_on( );
outb_p(0x10,short_base+2); /* enable reporting */
outb_p(0x00,short_base); /* clear the bit */
outb_p(0xFF,short_base); /* set the bit: interrupt! */
outb_p(0x00,short_base+2); /* disable reporting */
udelay(5); /* give it some time */
short_irq = probe_irq_off(mask);
if (short_irq = = 0) { /* none of them? */
printk(KERN_INFO "short: no irq reported by probe\n");
short_irq = -1;
}

```

```

/*

- if more than one line has been activated, the result is
- negative. We should service the interrupt (no need for lpt port)
- and loop over again. Loop at most five times, then give up
*/
} while (short_irq < 0 && count++ < 5);
if (short_irq < 0)
printk("short: probe failed %i times, giving up\n", count);

```

Lưu ý việc sử dụng *udelay* trước khi gọi *probe\_irq\_off*. Tùy thuộc vào tốc độ bộ xử lý của bạn, bạn có thể phải đợi một khoảng thời gian ngắn để ngắt có thời gian thực sự được chuyển đến.

Quá trình dò tìm có thể là một tác vụ tốn thời gian. Mặc dù điều này không đúng với *short*, nhưng việc dò tìm một thiết bị chụp khung hình (frame grabber) chẳng hạn, đòi hỏi độ trễ ít nhất là 20 ms (đối với bộ xử lý thì đây là một khoảng thời gian rất dài) và các thiết bị khác thậm chí có thể mất nhiều thời gian hơn. Do đó, tốt nhất là chỉ dò tìm đường ngắt một lần, lúc khởi tạo module (module initialization), bất kể bạn cài đặt hàm xử lý (handler) tại thời điểm mở thiết bị (device open) (như bạn nên làm) hay trong hàm khởi tạo (điều này không được khuyến khích).

Thật thú vị khi lưu ý rằng trên một số nền tảng (PowerPC, M68k, hầu hết các cài đặt MIPS và cả hai phiên bản SPARC), việc dò tìm là không cần thiết, và do đó, các hàm trước đó chỉ là các hàm giữ chỗ trống (empty placeholder), đôi khi được gọi là "vớ vẩn kiểu ISA vô tích sự" ("useless ISA nonsense"). Trên các nền tảng khác, việc dò tìm chỉ được thực thi cho các thiết bị ISA. Dù sao đi nữa, hầu hết các kiến trúc đều định nghĩa các hàm này (ngay cả khi chúng trống) để dễ dàng chuyển mã (porting) các trình điều khiển thiết bị hiện có.

### Tự dò thiết bị (Do-it-yourself probing)

Quá trình dò tìm (probing) cũng có thể được triển khai trực tiếp bên trong driver mà không gặp quá nhiều khó khăn. Rất hiếm driver phải tự triển khai cơ chế probing của riêng mình, nhưng việc tìm hiểu cách thức hoạt động của nó sẽ mang lại một số cái nhìn sâu sắc về tiến trình này. Nhằm mục đích đó, module *short* thực hiện việc tự phát hiện đường ngắt (IRQ line) nếu nó được nạp với tham số `probe=2`.

Cơ chế này hoàn toàn giống với cơ chế đã được mô tả trước đó: kích hoạt tất cả các ngắt chưa được sử dụng, sau đó chờ đợi và quan sát kết quả. Tuy nhiên, chúng ta có thể tận dụng sự hiểu biết của mình về thiết bị. Thông thường, một thiết bị có thể được cấu hình để sử dụng một số ngắt (IRQ number) nằm trong tập hợp ba hoặc bốn giá trị; việc dò tìm trên chính những ngắt đó cho phép chúng ta phát hiện ra ngắt chính xác mà không cần phải kiểm tra tất cả các ngắt có thể xảy ra.

Việc triển khai trong *short* giả định rằng 3, 5, 7 và 9 là các giá trị IRQ duy nhất có thể xảy ra. Trên thực tế, đây là những giá trị mà một số thiết bị cổng song song (parallel devices) cho phép bạn lựa chọn.

Đoạn mã sau đây thực hiện probing bằng cách kiểm tra tất cả các ngắt "có thể xảy ra" và quan sát kết quả. Mảng `trials` liệt kê các IRQ cần thử nghiệm và có giá trị `0` làm dấu hiệu kết thúc; mảng `tried` được sử dụng để theo dõi những trình xử lý (handler) nào đã thực sự được đăng ký bởi driver này.

```c

int trials[ ] = {3, 5, 7, 9, 0};
int tried[ ] = {0, 0, 0, 0, 0};
int i, count = 0;
/*

- install the probing handler for all possible lines. Remember
- the result (0 for success, or -EBUSY) in order to only free
- what has been acquired
*/
for (i = 0; trials[i]; i++)
tried[i] = request_irq(trials[i], short_probing,
SA_INTERRUPT, "short probe", NULL);
do {
short_irq = 0; /* none got, yet */
outb_p(0x10,short_base+2); /* enable */
outb_p(0x00,short_base);
outb_p(0xFF,short_base); /* toggle the bit */
outb_p(0x00,short_base+2); /* disable */
udelay(5); /* give it some time */
/* the value has been set by the handler */
if (short_irq = = 0) { /* none of them? */
printk(KERN_INFO "short: no irq reported by probe\n");
}
/*

- If more than one line has been activated, the result is
- negative. We should service the interrupt (but the lpt port
- doesn't need it) and loop over again. Do it at most 5 times
*/
} while (short_irq <=0 && count++ < 5);
/* end of loop, uninstall the handler */
for (i = 0; trials[i]; i++)
if (tried[i] = = 0)
free_irq(trials[i], NULL);
if (short_irq < 0)
printk("short: probe failed %i times, giving up\n", count);

```

Bạn có thể không biết trước các giá trị IRQ "có thể xảy ra" là gì. Trong trường hợp đó, bạn cần phải dò tất cả các ngắt còn trống, thay vì giới hạn bản thân trong một vài lần thử với mảng `trials[]`. Để dò tìm tất cả các ngắt, bạn phải quét từ IRQ 0 đến `NR_IRQS-1`, trong đó `NR_IRQS` được định nghĩa trong *<asm/irq.h>* và phụ thuộc vào từng nền tảng phần cứng (platform dependent).

Bây giờ chúng ta chỉ còn thiếu mỗi trình xử lý dò tìm (probing handler). Vai trò của trình xử lý này là cập nhật biến `short_irq` dựa trên các ngắt thực sự nhận được. Giá trị `0` trong `short_irq` có nghĩa là "chưa nhận được gì", trong khi một giá trị âm có nghĩa là "mơ hồ" (ambiguous). Những giá trị này được chọn để đảm bảo tính nhất quán với hàm `probe_irq_off` và cho phép cùng một đoạn mã có thể gọi bất kỳ loại probing nào trong tệp *short.c*.

```c

irqreturn_t short_probing(int irq, void *dev_id, struct pt_regs *regs)
{

```

```c

if (short_irq = = 0) short_irq = irq; /* found */
if (short_irq != irq) short_irq = -irq; /* ambiguous */
return IRQ_HANDLED;
}

```

Các tham số truyền vào trình xử lý sẽ được mô tả sau. Việc biết rằng `irq` chính là ngắt đang được xử lý là đủ để hiểu hàm vừa được trình bày ở trên.

### Trình xử lý nhanh và chậm (Fast and Slow Handlers)
Các phiên bản Linux Kernel cũ hơn đã tốn rất nhiều công sức để phân biệt giữa ngắt "nhanh" (fast) và ngắt "chậm" (slow). Ngắt nhanh là những ngắt có thể được xử lý rất nhanh, trong khi việc xử lý ngắt chậm mất nhiều thời gian hơn đáng kể. Ngắt chậm có thể ngốn tài nguyên bộ xử lý (processor) đáng kể, và việc cho phép bật lại ngắt (reenable interrupts) trong khi chúng đang được xử lý là rất đáng giá. Nếu không, các tác vụ yêu cầu phản hồi nhanh có thể bị trì hoãn quá lâu.

Trong các kernel hiện đại, phần lớn sự khác biệt giữa ngắt nhanh và ngắt chậm đã biến mất. Chỉ còn lại một điểm duy nhất: ngắt nhanh (những ngắt được yêu cầu với cờ `SA_INTERRUPT`) được thực thi khi tất cả các ngắt khác trên bộ xử lý hiện tại bị vô hiệu hóa (disabled). Lưu ý rằng các bộ xử lý khác vẫn có thể xử lý ngắt, mặc dù bạn sẽ không bao giờ thấy hai bộ xử lý cùng xử lý một IRQ tại cùng một thời điểm.

Vậy, trình điều khiển (driver) của bạn nên sử dụng loại ngắt nào? Trên các hệ thống hiện đại, `SA_INTERRUPT` chỉ được dùng trong một vài tình huống cụ thể như ngắt bộ định thời (timer interrupts). Trừ khi bạn có lý do thuyết phục để chạy trình xử lý ngắt (interrupt handler) của mình khi các ngắt khác bị vô hiệu hóa, bạn không nên sử dụng `SA_INTERRUPT`.

Mô tả này có lẽ đã làm hài lòng phần lớn độc giả, mặc dù một số người có sở thích tìm hiểu về phần cứng và có chút kinh nghiệm về máy tính của họ có thể muốn đào sâu hơn. Nếu bạn không quan tâm đến các chi tiết bên trong (internal details), bạn có thể chuyển sang phần tiếp theo.

### Hoạt động bên trong của việc xử lý ngắt trên kiến trúc x86
Mô tả này được ngoại suy từ *arch/i386/kernel/irq.c*, *arch/i386/kernel/apic.c*, *arch/i386/kernel/entry.S*, *arch/i386/kernel/i8259.c*, và *include/asm-i386/hw_irq.h* như chúng xuất hiện trong kernel phiên bản 2.6; mặc dù các khái niệm chung vẫn giữ nguyên, chi tiết phần cứng sẽ khác nhau trên các nền tảng khác nhau.

Cấp độ xử lý ngắt thấp nhất có thể được tìm thấy trong *entry.S*, một tệp mã hợp ngữ (assembly-language file) xử lý phần lớn công việc ở cấp độ máy. Bằng một chút thủ thuật hợp ngữ và một số macro, một đoạn mã được gán cho mọi ngắt có thể xảy ra. Trong mỗi trường hợp, mã này sẽ đẩy (push) số hiệu ngắt lên ngăn xếp (stack) và nhảy đến một phân đoạn chung, nơi gọi hàm *do_IRQ*, được định nghĩa trong *irq.c*.

Điều đầu tiên mà *do_IRQ* làm là xác nhận (acknowledge) ngắt để bộ điều khiển ngắt (interrupt controller) có thể chuyển sang các việc khác. Sau đó, nó lấy một khóa quay (spinlock) cho số hiệu IRQ được chỉ định, qua đó ngăn chặn bất kỳ CPU nào khác xử lý IRQ này. Nó xóa một vài bit trạng thái (bao gồm một bit gọi là `IRQ_WAITING` mà chúng ta sẽ xem xét ngay sau đây) và sau đó tra cứu (lookup) trình xử lý cho IRQ cụ thể này. Nếu không có trình xử lý nào, không có việc gì phải làm; khóa quay được giải phóng, mọi ngắt phần mềm (software interrupts) đang chờ xử lý sẽ được xử lý, và *do_IRQ* trả về.

Tuy nhiên, thông thường, nếu một thiết bị đang ngắt, sẽ có ít nhất một trình xử lý được đăng ký cho IRQ đó. Hàm *handle_IRQ_event* được gọi để thực sự kích hoạt các trình xử lý. Nếu trình xử lý thuộc loại chậm (`SA_INTERRUPT` không được thiết lập), các ngắt sẽ được bật lại ở cấp độ phần cứng và trình xử lý sẽ được kích hoạt. Sau đó, công việc chỉ là dọn dẹp, chạy các ngắt phần mềm và quay trở lại công việc thường ngày. "Công việc thường ngày" rất có thể đã thay đổi do kết quả của một ngắt (ví dụ, trình xử lý có thể đánh thức một tiến trình bằng *wake_up*), vì vậy điều cuối cùng xảy ra khi trả về từ một ngắt là việc lập lịch lại (rescheduling) bộ xử lý có thể xảy ra.

Việc thăm dò (probe) các IRQ được thực hiện bằng cách thiết lập bit trạng thái `IRQ_WAITING` cho mỗi IRQ hiện đang thiếu trình xử lý. Khi ngắt xảy ra, *do_IRQ* sẽ xóa bit đó rồi trả về, bởi vì không có trình xử lý nào được đăng ký. *probe_irq_off*, khi được gọi bởi một trình điều khiển, chỉ cần tìm kiếm IRQ không còn được thiết lập `IRQ_WAITING`.

## Triển khai một Trình xử lý (Implementing a Handler)
Cho đến nay, chúng ta đã học cách đăng ký một trình xử lý ngắt nhưng chưa học cách viết nó. Thực ra, không có gì bất thường về một trình xử lý — nó là mã C thông thường.

Điểm đặc biệt duy nhất là trình xử lý chạy tại thời điểm ngắt (interrupt time) và do đó, chịu một số hạn chế về những gì nó có thể làm. Những hạn chế này cũng giống như những gì chúng ta đã thấy với bộ định thời kernel (kernel timers). Một trình xử lý không thể truyền dữ liệu đến hoặc đi từ không gian người dùng (user space), bởi vì nó không thực thi trong ngữ cảnh của một tiến trình (process context). Các trình xử lý cũng không thể thực hiện bất kỳ hành động nào có thể gây ngủ (sleep), chẳng hạn như gọi *wait_event*, cấp phát bộ nhớ bằng bất kỳ thứ gì khác ngoài `GFP_ATOMIC`, hoặc khóa một semaphore. Cuối cùng, các trình xử lý không thể gọi *schedule*.

Vai trò của một trình xử lý ngắt là cung cấp phản hồi cho thiết bị của nó về việc tiếp nhận ngắt và đọc hoặc ghi dữ liệu theo ý nghĩa của ngắt đang được xử lý. Bước đầu tiên thường bao gồm việc xóa một bit trên bo mạch giao diện (interface board); hầu hết các thiết bị phần cứng sẽ không tạo ra các ngắt khác cho đến khi bit "đang chờ ngắt" ("interrupt-pending") của chúng bị xóa. Tùy thuộc vào cách phần cứng của bạn hoạt động, bước này có thể cần được thực hiện cuối cùng thay vì đầu tiên; không có quy tắc chung nào áp dụng cho tất cả ở đây. Một số thiết bị không yêu cầu bước này vì chúng không có bit "đang chờ ngắt"; các thiết bị như vậy chiếm số ít, mặc dù cổng song song (parallel port) là một trong số đó. Vì lý do đó, *short* không phải xóa một bit như vậy.

Một tác vụ điển hình của một trình xử lý ngắt (interrupt handler) là đánh thức các tiến trình đang ngủ (sleeping processes) trên thiết bị nếu ngắt báo hiệu sự kiện mà chúng đang chờ đợi, chẳng hạn như sự xuất hiện của dữ liệu mới.

Để bám sát ví dụ về bộ thu khung hình (frame grabber), một tiến trình có thể thu thập một chuỗi các ảnh bằng cách đọc liên tục thiết bị; lệnh gọi *read* sẽ bị chặn (block) trước khi đọc từng khung hình, trong khi trình xử lý ngắt sẽ đánh thức tiến trình ngay khi mỗi khung hình mới đến. Giả định rằng bộ thu khung hình ngắt bộ vi xử lý (processor) để báo hiệu sự thành công khi mỗi khung hình mới đến.

Lập trình viên nên cẩn thận viết một hàm thực thi trong khoảng thời gian tối thiểu, không phân biệt đó là trình xử lý nhanh hay chậm. Nếu một phép tính dài cần được thực hiện, cách tiếp cận tốt nhất là sử dụng tasklet hoặc workqueue để lên lịch (schedule) việc tính toán vào một thời điểm an toàn hơn (chúng ta sẽ xem xét cách công việc có thể bị trì hoãn theo cách này trong phần "Nửa trên và Nửa dưới - Top and Bottom Halves").

Mã nguồn mẫu của chúng tôi trong *short* phản hồi ngắt bằng cách gọi *do\_gettimeofday* và in thời gian hiện tại vào một bộ đệm vòng (circular buffer) có kích thước bằng một trang (page-sized). Sau đó, nó đánh thức bất kỳ tiến trình đọc nào, bởi vì hiện tại đã có dữ liệu sẵn sàng để đọc.

```c

irqreturn_t short_interrupt(int irq, void *dev_id, struct pt_regs *regs)
{
struct timeval tv;
int written;
do_gettimeofday(&tv);
/* Write a 16 byte record. Assume PAGE_SIZE is a multiple of 16 */
written = sprintf((char *)short_head,"%08u.%06u\n",
(int)(tv.tv_sec % 100000000), (int)(tv.tv_usec));
BUG_ON(written != 16);
short_incr_bp(&short_head, written);
wake_up_interruptible(&short_queue); /* awake any reading process */
return IRQ_HANDLED;
}

```

Đoạn mã này, mặc dù đơn giản, nhưng đại diện cho công việc điển hình của một trình xử lý ngắt. Ngược lại, nó gọi *short\_incr\_bp*, được định nghĩa như sau:

```c

static inline void short_incr_bp(volatile unsigned long *index, int delta)
{
unsigned long new = *index + delta;
barrier( ); /* Don't optimize these two together */
*index = (new >= (short_buffer + PAGE_SIZE)) ? short_buffer : new;
}

```

Hàm này được viết cẩn thận để cuộn con trỏ (wrap a pointer) vào bộ đệm vòng mà không làm lộ ra một giá trị không chính xác nào. Lệnh gọi *barrier* có mặt ở đó để ngăn chặn các tối ưu hóa của trình biên dịch (compiler optimizations) trên hai dòng còn lại của hàm. Nếu không có rào cản (barrier), trình biên dịch có thể quyết định tối ưu hóa biến mới và gán trực tiếp vào \*index. Tối ưu hóa đó có thể làm lộ giá trị không chính xác của chỉ mục (index) trong một khoảng thời gian ngắn trong trường hợp nó bị cuộn vòng. Bằng cách cẩn thận ngăn chặn việc một giá trị không nhất quán có thể bị nhìn thấy bởi các luồng (threads) khác, chúng ta có thể thao tác các con trỏ bộ đệm vòng một cách an toàn mà không cần khóa (locks).

Tệp thiết bị (device file) được sử dụng để đọc bộ đệm đang được lấp đầy tại thời điểm ngắt là */dev/shortint*. Tệp đặc biệt của thiết bị này, cùng với */dev/shortprint*, không được giới thiệu trong Chương 9, bởi vì việc sử dụng nó dành riêng cho việc xử lý ngắt. Các phần bên trong (internals) của */dev/shortint* được thiết kế riêng cho việc tạo và báo cáo ngắt. Ghi vào thiết bị sẽ tạo ra một ngắt cứ sau mỗi byte thứ hai; đọc thiết bị sẽ cung cấp thời gian khi mỗi ngắt được báo cáo.

Nếu bạn nối các chân 9 và 10 của cổng song song (parallel connector) lại với nhau, bạn có thể tạo ra các ngắt bằng cách nâng bit cao của byte dữ liệu song song. Điều này có thể được thực hiện bằng cách ghi dữ liệu nhị phân vào */dev/short0* hoặc bằng cách ghi bất cứ thứ gì vào */dev/shortint*.*

Đoạn mã sau thực thi *read* và *write* cho */dev/shortint*:

```c

ssize_t short_i_read (struct file *filp, char __user *buf, size_t count,
loff_t *f_pos)
{
int count0;
DEFINE_WAIT(wait);
while (short_head == short_tail) {
prepare_to_wait(&short_queue, &wait, TASK_INTERRUPTIBLE);
if (short_head == short_tail)
schedule( );
finish_wait(&short_queue, &wait);
if (signal_pending (current)) /* a signal arrived */
return -ERESTARTSYS; /* tell the fs layer to handle it */
}
/* count0 is the number of readable data bytes */
count0 = short_head - short_tail;
if (count0 < 0) /* wrapped */
count0 = short_buffer + PAGE_SIZE - short_tail;
if (count0 < count) count = count0;
if (copy_to_user(buf, (char *)short_tail, count))
return -EFAULT;
short_incr_bp (&short_tail, count);
return count;
}
ssize_t short_i_write (struct file *filp, const char __user *buf, size_t count,
loff_t *f_pos)
{
int written = 0, odd = *f_pos & 1;
unsigned long port = short_base; /* output to the parallel data latch */
void *address = (void *) short_base;
if (use_mem) {
while (written < count)
iowrite8(0xff * ((++written + odd) & 1), address);
} else {

```

Thiết bị *shortint* hoàn thành nhiệm vụ của mình bằng cách ghi lần lượt 0x00 và 0xff vào cổng song song.

```c

while (written < count)
outb(0xff * ((++written + odd) & 1), port);
}
*f_pos += count;
return written;
}

```

Tệp đặc biệt của thiết bị còn lại, */dev/shortprint*, sử dụng cổng song song để điều khiển máy in; bạn có thể sử dụng nó nếu bạn muốn tránh việc nối các chân 9 và 10 của đầu nối D-25. Việc thực thi hàm *write* của *shortprint* sử dụng một bộ đệm vòng để lưu trữ dữ liệu cần in, trong khi việc thực thi hàm *read* chính là đoạn mã vừa được hiển thị ở trên (vì vậy bạn có thể đọc thời gian máy in của bạn mất để tiêu thụ từng ký tự).

Để hỗ trợ hoạt động của máy in, trình xử lý ngắt (interrupt handler) đã được sửa đổi một chút so với ví dụ vừa trình bày, bổ sung thêm khả năng gửi byte dữ liệu tiếp theo đến máy in nếu có thêm dữ liệu cần truyền.

### Các đối số và Giá trị trả về của Trình xử lý (Handler Arguments and Return Value)
Mặc dù hàm *short* bỏ qua chúng, ba đối số được truyền tới một trình xử lý ngắt: `irq`, `dev_id`, và `regs`. Hãy cùng xem xét vai trò của từng đối số.

Số hiệu ngắt (`int irq`) rất hữu ích dưới dạng thông tin mà bạn có thể in ra trong các thông điệp nhật ký (log message) của mình, nếu có. Đối số thứ hai, `void *dev_id`, là một dạng dữ liệu khách (client data); một đối số kiểu `void *` được truyền tới hàm *request_irq*, và chính con trỏ này sau đó được truyền ngược lại làm đối số cho trình xử lý khi ngắt xảy ra. Bạn thường truyền một con trỏ trỏ đến cấu trúc dữ liệu thiết bị của mình trong `dev_id`, do đó một trình điều khiển (driver) quản lý nhiều thể hiện (instance) của cùng một thiết bị sẽ không cần bất kỳ mã nguồn bổ sung nào trong trình xử lý ngắt để tìm xem thiết bị nào đang phụ trách sự kiện ngắt hiện tại.

Cách sử dụng tiêu biểu của đối số này trong một trình xử lý ngắt như sau:

```c

static irqreturn_t sample_interrupt(int irq, void *dev_id, struct pt_regs
*regs)
{
struct sample_dev *dev = dev_id;
/* bây giờ `dev` trỏ đến phần cứng chính xác */
/* .... */
}

```

Mã nguồn hàm *open* tiêu biểu đi kèm với trình xử lý này trông như sau:

```c

static void sample_open(struct inode *inode, struct file *filp)
{
struct sample_dev *dev = hwinfo + MINOR(inode->i_rdev);
request_irq(dev->irq, sample_interrupt,
0 /* cờ */, "sample", dev /* dev_id */);
/*....*/
return 0;
}

```

**272 | Chương 10: Xử lý Ngắt (Interrupt Handling)**

Đối số cuối cùng, `struct pt_regs *regs`, rất ít khi được sử dụng. Nó lưu giữ một ảnh chụp (snapshot) ngữ cảnh của bộ xử lý trước khi bộ xử lý bước vào mã nguồn ngắt. Các thanh ghi (register) này có thể được sử dụng để giám sát và gỡ lỗi (debugging); thông thường chúng không cần thiết cho các tác vụ thông thường của trình điều khiển thiết bị (device driver).

Các trình xử lý ngắt nên trả về một giá trị cho biết liệu thực sự có ngắt nào cần được xử lý hay không. Nếu trình xử lý nhận thấy thiết bị của nó thực sự cần được chú ý, nó nên trả về `IRQ_HANDLED`; nếu không, giá trị trả về phải là `IRQ_NONE`. Bạn cũng có thể tạo giá trị trả về bằng macro này:

```c

IRQ_RETVAL(handled)

```

trong đó `handled` khác không nếu bạn có thể xử lý được ngắt đó. Giá trị trả về được kernel sử dụng để phát hiện và ngăn chặn các ngắt giả mạo (spurious interrupts). Nếu thiết bị của bạn không cung cấp cách nào để phân biệt xem nó có thực sự tạo ra ngắt hay không, bạn nên trả về `IRQ_HANDLED`.

### Bật và Tắt Ngắt (Enabling and Disabling Interrupts)
Có những thời điểm mà một trình điều khiển thiết bị (device driver) phải chặn việc phân phối các ngắt trong một khoảng thời gian (hy vọng là) ngắn (chúng ta đã thấy một tình huống như vậy trong phần "Spinlocks" ở Chương 5). Thông thường, các ngắt phải bị chặn trong khi đang giữ một spinlock để tránh gây ra tình trạng bế tắc (deadlock) cho hệ thống. Có các cách vô hiệu hóa ngắt không liên quan đến spinlock. Nhưng trước khi thảo luận về chúng, cần lưu ý rằng việc vô hiệu hóa ngắt phải là một hoạt động tương đối hiếm hoi, ngay cả trong các trình điều khiển thiết bị, và kỹ thuật này không bao giờ được sử dụng như một cơ chế loại trừ tương hỗ (mutual exclusion mechanism) bên trong một driver.

### Vô hiệu hóa một ngắt đơn lẻ

Đôi khi (nhưng rất hiếm khi!) một trình điều khiển (driver) cần vô hiệu hóa việc phân phối ngắt (interrupt delivery) cho một đường ngắt (interrupt line) cụ thể. Nhân hệ điều hành (Kernel) cung cấp ba hàm cho mục đích này, tất cả đều được khai báo trong *<asm/irq.h>*. Các hàm này là một phần của Kernel API, vì vậy chúng tôi giới thiệu chúng, nhưng việc sử dụng chúng bị hạn chế ở hầu hết các driver. Trong số các yếu tố khác, bạn không thể vô hiệu hóa các đường ngắt chia sẻ (shared interrupt lines), và trên các hệ thống hiện đại, ngắt chia sẻ là tiêu chuẩn. Dù vậy, chúng đây:

```c

void disable_irq(int irq);
void disable_irq_nosync(int irq);
void enable_irq(int irq);

```

Việc gọi bất kỳ hàm nào trong số này có thể cập nhật mặt nạ (mask) cho ngắt được chỉ định trong bộ điều khiển ngắt lập trình được (programmable interrupt controller - PIC), do đó vô hiệu hóa hoặc kích hoạt IRQ được chỉ định trên tất cả các bộ xử lý (processors). Các lệnh gọi đến các hàm này có thể được lồng nhau (nested) — nếu *disable_irq* được gọi liên tiếp hai lần, thì cần có hai lệnh gọi *enable_irq* trước khi IRQ thực sự được bật lại. Có thể gọi các hàm này từ một trình xử lý ngắt (interrupt handler), nhưng việc bật lại IRQ của chính bạn trong khi đang xử lý nó thường không phải là một thực hành tốt.

*disable_irq* không chỉ vô hiệu hóa ngắt được cung cấp mà còn đợi cho trình xử lý ngắt đang thực thi (nếu có) hoàn tất. Cần lưu ý rằng nếu tiến trình (thread) gọi *disable_irq* nắm giữ bất kỳ tài nguyên nào (chẳng hạn như khóa quay - spinlocks) mà trình xử lý ngắt cần, hệ thống có thể xảy ra tình trạng bế tắc (deadlock). *disable_irq_nosync* khác với *disable_irq* ở chỗ nó trả về ngay lập tức. Do đó, việc sử dụng *disable_irq_nosync* nhanh hơn một chút nhưng có thể khiến driver của bạn gặp phải các tình trạng tranh chấp dữ liệu (race conditions).

Nhưng tại sao lại phải vô hiệu hóa một ngắt? Tiếp tục với cổng song song (parallel port), hãy nhìn vào giao diện mạng *plip*. Thiết bị *plip* sử dụng cổng song song cơ bản để truyền dữ liệu. Vì chỉ có thể đọc năm bit từ đầu nối song song, chúng được diễn giải thành bốn bit dữ liệu và một tín hiệu xung nhịp/bắt tay (clock/handshake signal). Khi bốn bit đầu tiên của một gói tin được truyền bởi bên khởi tạo (giao diện gửi gói tin), đường xung nhịp được nâng lên, khiến giao diện nhận ngắt bộ xử lý (processor). Trình xử lý *plip* sau đó được gọi để xử lý dữ liệu mới đến.

Sau khi thiết bị được cảnh báo, quá trình truyền dữ liệu tiếp tục, sử dụng đường bắt tay để đồng bộ hóa (clock) dữ liệu mới đến giao diện nhận (đây có thể không phải là cách triển khai tối ưu nhất, nhưng nó cần thiết để tương thích với các driver gói tin khác sử dụng cổng song song). Hiệu suất sẽ không thể chấp nhận được nếu giao diện nhận phải xử lý hai ngắt cho mỗi byte nhận được. Do đó, driver sẽ vô hiệu hóa ngắt trong quá trình nhận gói tin; thay vào đó, một vòng lặp thăm dò và trễ (poll-and-delay loop) được sử dụng để lấy dữ liệu vào.

Tương tự, vì đường bắt tay từ máy thu đến máy phát được sử dụng để xác nhận việc nhận dữ liệu, giao diện phát sẽ vô hiệu hóa đường IRQ của nó trong quá trình truyền gói tin.

### Vô hiệu hóa tất cả các ngắt (Disabling all interrupts)
Nếu bạn cần vô hiệu hóa *tất cả* các ngắt thì sao? Trong kernel 2.6, bạn có thể tắt toàn bộ việc xử lý ngắt trên bộ vi xử lý hiện tại (current processor) bằng một trong hai hàm sau (được định nghĩa trong *<asm/system.h>*):

```c

void local_irq_save(unsigned long flags);
void local_irq_disable(void);

```

Một lời gọi đến *local\_irq\_save* sẽ vô hiệu hóa việc phân phối ngắt trên bộ vi xử lý hiện tại sau khi lưu trạng thái ngắt hiện tại vào biến `flags`. Lưu ý rằng `flags` được truyền trực tiếp, không phải bằng con trỏ (pointer). *local\_irq\_disable* ngắt việc phân phối ngắt cục bộ mà không lưu trạng thái; bạn chỉ nên sử dụng phiên bản này nếu bạn chắc chắn rằng các ngắt chưa bị vô hiệu hóa ở nơi nào khác.

Việc bật lại các ngắt được thực hiện bằng:

```c

void local_irq_restore(unsigned long flags);
void local_irq_enable(void);

```

Phiên bản đầu tiên khôi phục trạng thái đã được lưu vào `flags` bởi *local\_irq\_save*, trong khi *local\_irq\_enable* bật ngắt một cách vô điều kiện. Không giống như *disable\_irq*, *local\_irq\_disable* không theo dõi số lượng các lời gọi lồng nhau (multiple calls). Nếu có nhiều hơn một hàm trong chuỗi gọi (call chain) có thể cần vô hiệu hóa ngắt, thì nên sử dụng *local\_irq\_save*.

Trong kernel 2.6, không có cách nào để vô hiệu hóa tất cả các ngắt trên toàn bộ hệ thống (globally). Các nhà phát triển kernel đã quyết định rằng cái giá phải trả cho việc tắt tất cả ngắt là quá cao và dù sao thì cũng không cần đến khả năng đó. Nếu bạn đang làm việc với một driver cũ có gọi các hàm như *cli* và *sti*, bạn cần cập nhật nó để sử dụng cơ chế khóa (locking) thích hợp trước khi nó có thể hoạt động trên phiên bản 2.6.

## Nửa trên và Nửa dưới (Top and Bottom Halves)
Một trong những vấn đề chính với việc xử lý ngắt là làm thế nào để thực hiện các tác vụ dài (lengthy tasks) bên trong một trình xử lý (handler). Thường thì một lượng lớn công việc phải được thực hiện để phản hồi lại ngắt thiết bị, nhưng các trình xử lý ngắt cần phải hoàn thành nhanh chóng và không được để ngắt bị chặn (blocked) trong thời gian dài. Hai nhu cầu này (khối lượng công việc và tốc độ) mâu thuẫn với nhau, đặt người viết driver vào một tình thế khó xử.

Linux (cùng với nhiều hệ thống khác) giải quyết vấn đề này bằng cách chia trình xử lý ngắt thành hai nửa. Cái gọi là *nửa trên* (*top half*) là routine thực sự phản hồi lại ngắt — thứ mà bạn đăng ký bằng *request\_irq*. *Nửa dưới* (*bottom half*) là một routine được lên lịch (scheduled) bởi nửa trên để thực thi sau đó, vào một thời điểm an toàn hơn. Sự khác biệt lớn giữa trình xử lý nửa trên và nửa dưới là tất cả các ngắt đều được bật trong quá trình thực thi nửa dưới — đó là lý do tại sao nó chạy vào thời điểm an toàn hơn. Trong kịch bản điển hình, nửa trên lưu dữ liệu thiết bị vào một bộ đệm (buffer) dành riêng cho thiết bị, lên lịch cho nửa dưới của nó và thoát ra: thao tác này rất nhanh. Nửa dưới sau đó thực hiện bất kỳ công việc nào khác được yêu cầu, chẳng hạn như đánh thức các tiến trình (processes), khởi động một thao tác I/O khác, v.v. Thiết lập này cho phép nửa trên phục vụ một ngắt mới trong khi nửa dưới vẫn đang làm việc.

Hầu như mọi trình xử lý ngắt quan trọng đều được chia theo cách này. Ví dụ, khi một giao diện mạng (network interface) báo cáo về sự xuất hiện của một gói tin (packet) mới, trình xử lý chỉ lấy dữ liệu và đẩy nó lên lớp giao thức (protocol layer); việc xử lý thực tế gói tin đó được thực hiện ở nửa dưới.

Linux kernel có hai cơ chế khác nhau có thể được sử dụng để thực hiện việc xử lý ở nửa dưới, cả hai đều được giới thiệu trong Chương 7. Tasklet thường là cơ chế ưu tiên cho việc xử lý ở nửa dưới; chúng rất nhanh, nhưng tất cả mã nguồn tasklet phải mang tính nguyên tử (atomic). Giải pháp thay thế cho tasklet là hàng đợi công việc (workqueues), có thể có độ trễ (latency) cao hơn nhưng được phép ngủ (sleep).

Thảo luận sau đây tiếp tục làm việc với driver *short*. Khi được nạp với một tùy chọn module, *short* có thể được yêu cầu thực hiện xử lý ngắt ở chế độ nửa trên/nửa dưới với trình xử lý tasklet hoặc workqueue. Trong trường hợp này, nửa trên thực thi nhanh chóng; nó chỉ đơn giản ghi nhớ thời gian hiện tại và lên lịch xử lý cho nửa dưới. Nửa dưới sau đó có trách nhiệm mã hóa thời gian này và đánh thức bất kỳ tiến trình người dùng (user processes) nào có thể đang chờ dữ liệu.

### Tasklets (Tác vụ con)

Hãy nhớ rằng tasklet là một hàm đặc biệt có thể được lên lịch để chạy, trong ngữ cảnh ngắt phần mềm (software interrupt context), tại một thời điểm an toàn do hệ thống quyết định. Chúng có thể được lên lịch chạy nhiều lần, nhưng việc lên lịch cho tasklet không có tính cộng dồn (cumulative); tasklet sẽ chỉ chạy một lần, ngay cả khi nó được yêu cầu thực thi nhiều lần trước khi được khởi chạy. Không có tasklet nào tự chạy song song với chính nó, vì chúng chỉ chạy một lần, nhưng các tasklet có thể chạy song song với các tasklet khác trên các hệ thống đa xử lý đối xứng (SMP systems). Do đó, nếu trình điều khiển (driver) của bạn có nhiều tasklet, chúng phải sử dụng một số hình thức khóa (locking) nào đó để tránh xung đột lẫn nhau.

Tasklet cũng được đảm bảo sẽ chạy trên cùng một CPU với hàm đã lên lịch cho chúng lần đầu tiên. Do đó, một trình xử lý ngắt (interrupt handler) có thể yên tâm rằng một tasklet sẽ không bắt đầu thực thi trước khi trình xử lý hoàn tất. Tuy nhiên, một ngắt khác chắc chắn vẫn có thể được phân phối (delivered) trong khi tasklet đang chạy, vì vậy việc khóa giữa tasklet và trình xử lý ngắt vẫn có thể là cần thiết.

Tasklet phải được khai báo bằng macro `DECLARE_TASKLET`:

```

DECLARE_TASKLET(name, function, data);

```

`name` là tên được đặt cho tasklet, `function` là hàm được gọi để thực thi tasklet (nó nhận một đối số kiểu `unsigned long` và trả về `void`), và `data` là một giá trị `unsigned long` sẽ được truyền cho hàm của tasklet.

Trình điều khiển `short` khai báo tasklet của nó như sau:

```

void short_do_tasklet(unsigned long);
DECLARE_TASKLET(short_tasklet, short_do_tasklet, 0);

```

Hàm `tasklet_schedule` được sử dụng để lên lịch chạy cho một tasklet. Nếu `short` được nạp (loaded) với tham số `tasklet=1`, nó sẽ cài đặt một trình xử lý ngắt khác có chức năng lưu dữ liệu và lên lịch cho tasklet như sau:

```

irqreturn_t short_tl_interrupt(int irq, void *dev_id, struct pt_regs *regs)
{
do_gettimeofday((struct timeval *) tv_head); /* cast to stop 'volatile' warning
*/
short_incr_tv(&tv_head);
tasklet_schedule(&short_tasklet);
short_wq_count++; /* record that an interrupt arrived */
return IRQ_HANDLED;
}

```

Hàm xử lý tasklet thực tế, `short_do_tasklet`, sẽ được thực thi ngay sau đó (có thể nói là vậy) vào thời điểm thuận tiện của hệ thống. Như đã đề cập trước đó, hàm này thực hiện phần lớn công việc xử lý ngắt (bottom half); nó trông như thế này:

```

void short_do_tasklet (unsigned long unused)
{
int savecount = short_wq_count, written;
short_wq_count = 0; /* we have already been removed from the queue */
/*

- The bottom half reads the tv array, filled by the top half,

```

```

- and prints it to the circular text buffer, which is then consumed
- by reading processes
*/
/* First write the number of interrupts that occurred before this bh */
written = sprintf((char *)short_head,"bh after %6i\n",savecount);
short_incr_bp(&short_head, written);
/*

- Then, write the time values. Write exactly 16 bytes at a time,
- so it aligns with PAGE_SIZE
*/
do {
written = sprintf((char *)short_head,"%08u.%06u\n",
(int)(tv_tail->tv_sec % 100000000),
(int)(tv_tail->tv_usec));
short_incr_bp(&short_head, written);
short_incr_tv(&tv_tail);
} while (tv_tail != tv_head);
wake_up_interruptible(&short_queue); /* awake any reading process */

```

Trong số các tác vụ khác, tasklet này ghi lại số lượng ngắt đã đến kể từ lần gọi cuối cùng của nó. Một thiết bị như `short` có thể tạo ra rất nhiều ngắt trong một khoảng thời gian ngắn, vì vậy việc một số ngắt đến trước khi phần nửa dưới (bottom half) được thực thi là điều không hiếm gặp. Các trình điều khiển phải luôn chuẩn bị sẵn sàng cho khả năng này và phải có khả năng xác định khối lượng công việc cần thực hiện dựa trên thông tin để lại bởi phần nửa trên (top half).

### Workqueues

Hãy nhớ lại rằng các workqueue gọi một hàm tại một thời điểm nào đó trong tương lai trong ngữ cảnh của một tiến trình công nhân (worker process) đặc biệt. Vì hàm của *workqueue* chạy trong ngữ cảnh tiến trình (process context), nên nó có thể ngủ (sleep) nếu cần thiết. Tuy nhiên, bạn không thể sao chép dữ liệu vào không gian người dùng (user space) từ một workqueue, trừ khi bạn sử dụng các kỹ thuật nâng cao mà chúng tôi trình bày trong Chương 15; tiến trình công nhân không có quyền truy cập vào không gian địa chỉ (address space) của bất kỳ tiến trình nào khác.

Trình điều khiển (driver) *short*, nếu được nạp với tùy chọn `wq` được thiết lập thành một giá trị khác không, sẽ sử dụng một workqueue cho việc xử lý nửa sau (bottom-half processing) của nó. Nó sử dụng workqueue mặc định của hệ thống (system default workqueue), do đó không cần mã thiết lập đặc biệt nào; nếu driver của bạn có các yêu cầu đặc biệt về độ trễ (latency) (hoặc có thể ngủ trong một thời gian dài trong hàm *workqueue*), bạn có thể muốn tạo một workqueue chuyên dụng của riêng mình. Chúng ta thực sự cần một cấu trúc `work_struct`, được khai báo và khởi tạo bằng đoạn mã sau:

```c

static struct work_struct short_wq;
/* dòng này nằm trong hàm short_init( ) */
INIT_WORK(&short_wq, (void (*)(void *)) short_do_tasklet, NULL);

```

Hàm công nhân của chúng ta là *short\_do\_tasklet*, mà chúng ta đã thấy ở phần trước.

Khi làm việc với workqueue, *short* thiết lập thêm một trình xử lý ngắt (interrupt handler) khác trông như sau:

```c

irqreturn_t short_wq_interrupt(int irq, void *dev_id, struct pt_regs *regs)
{
/* Lấy thông tin thời gian hiện tại. */
do_gettimeofday((struct timeval *) tv_head);
short_incr_tv(&tv_head);
/* Đưa bh vào hàng đợi. Không cần lo lắng về việc đưa vào hàng đợi nhiều lần */
schedule_work(&short_wq);
short_wq_count++; /* ghi nhận rằng một ngắt đã đến */
return IRQ_HANDLED;
}

```

Như bạn có thể thấy, trình xử lý ngắt này rất giống với phiên bản tasklet, ngoại trừ việc nó gọi `schedule_work` để sắp xếp việc xử lý nửa sau (bottom-half processing).

## Chia sẻ Ngắt (Interrupt Sharing)
Khái niệm xung đột IRQ gần như đồng nghĩa với kiến trúc PC. Trước đây, các đường IRQ trên PC không thể phục vụ nhiều hơn một thiết bị, và chưa bao giờ có đủ số lượng IRQ cần thiết. Kết quả là, những người dùng khó chịu thường phải dành rất nhiều thời gian mở thùng máy tính của họ, cố gắng tìm cách làm sao cho tất cả các thiết bị ngoại vi của họ hoạt động hòa hợp với nhau.

Tất nhiên, phần cứng hiện đại đã được thiết kế để cho phép chia sẻ ngắt; bus PCI bắt buộc điều đó. Do đó, Linux kernel hỗ trợ chia sẻ ngắt trên tất cả các bus, thậm chí ngay cả trên những bus (như bus ISA) mà trước đây không hỗ trợ tính năng chia sẻ. Các trình điều khiển thiết bị (device driver) cho kernel 2.6 nên được viết để hoạt động với ngắt chia sẻ nếu phần cứng mục tiêu có thể hỗ trợ chế độ hoạt động đó. May mắn thay, việc làm việc với ngắt chia sẻ rất dễ dàng trong phần lớn các trường hợp.

### Cài đặt một Trình xử lý Chia sẻ (Shared Handler)
Các ngắt chia sẻ (shared interrupts) được cài đặt thông qua `request_irq` giống như các ngắt không chia sẻ, nhưng có hai điểm khác biệt:

- Cờ `SA_SHIRQ` phải được chỉ định trong tham số `flags` khi yêu cầu ngắt.
- Tham số `dev_id` *phải* là duy nhất. Bất kỳ con trỏ nào trỏ vào không gian địa chỉ (address space) của mô-đun đều được, nhưng `dev_id` tuyệt đối không được đặt là `NULL`.

Kernel duy trì một danh sách các trình xử lý chia sẻ được liên kết với đường ngắt đó, và `dev_id` có thể được xem như chữ ký (signature) để phân biệt giữa chúng. Nếu hai trình điều khiển (driver) cùng đăng ký `NULL` làm chữ ký của chúng trên cùng một đường ngắt, mọi thứ có thể bị xáo trộn tại thời điểm gỡ bỏ (unload), khiến kernel bị lỗi (oops) khi có ngắt xảy ra. Vì lý do này, các kernel hiện đại sẽ đưa ra cảnh báo mạnh mẽ nếu được truyền một `dev_id` là `NULL` khi đăng ký ngắt chia sẻ. Khi một ngắt chia sẻ được yêu cầu, `request_irq` sẽ thành công nếu một trong các điều kiện sau được thỏa mãn:

- Đường ngắt đang rảnh (free).
- Tất cả các trình xử lý đã được đăng ký cho đường ngắt đó cũng đã chỉ định rằng IRQ này được phép chia sẻ.

Bất cứ khi nào có từ hai trình điều khiển trở lên cùng chia sẻ một đường ngắt và phần cứng ngắt bộ xử lý trên đường đó, kernel sẽ gọi mọi trình xử lý đã đăng ký cho ngắt đó, truyền cho mỗi trình xử lý giá trị `dev_id` của riêng nó. Do đó, một trình xử lý chia sẻ phải có khả năng nhận biết các ngắt của chính thiết bị mình và phải nhanh chóng thoát ra khi thiết bị của nó không tạo ra ngắt. Hãy chắc chắn trả về `IRQ_NONE` bất cứ khi nào trình xử lý của bạn được gọi và phát hiện thấy thiết bị không phải là nguồn gây ngắt.

Nếu bạn cần dò tìm (probe) thiết bị của mình trước khi yêu cầu đường IRQ, kernel sẽ không thể giúp bạn. Không có hàm dò tìm nào khả dụng cho các trình xử lý chia sẻ. Cơ chế dò tìm tiêu chuẩn hoạt động nếu đường ngắt đang được sử dụng là rảnh, nhưng nếu đường ngắt đó đã bị chiếm giữ bởi một trình điều khiển khác có tính năng chia sẻ, quá trình dò tìm sẽ thất bại, ngay cả khi trình điều khiển của bạn đáng lẽ đã hoạt động hoàn hảo. May mắn thay, hầu hết phần cứng được thiết kế để chia sẻ ngắt cũng có khả năng thông báo cho bộ xử lý biết nó đang sử dụng ngắt nào, từ đó loại bỏ sự cần thiết phải dò tìm tường minh (explicit probing).

Việc giải phóng trình xử lý được thực hiện theo cách thông thường, sử dụng `free_irq`. Ở đây, tham số `dev_id` được sử dụng để chọn ra trình xử lý chính xác cần giải phóng khỏi danh sách các trình xử lý chia sẻ cho ngắt đó. Đó là lý do tại sao con trỏ `dev_id` phải là duy nhất.

Một trình điều khiển sử dụng trình xử lý chia sẻ cần phải cẩn thận thêm một điều nữa: nó không được phép nghịch ngợm với `enable_irq` hay `disable_irq`. Nếu làm vậy, mọi thứ có thể trở nên tồi tệ đối với các thiết bị khác đang chia sẻ cùng đường ngắt; việc vô hiệu hóa ngắt của thiết bị khác dù chỉ trong một khoảng thời gian ngắn có thể tạo ra độ trễ gây ra vấn đề cho thiết bị đó và người dùng của nó. Nhìn chung, lập trình viên phải ghi nhớ rằng trình điều khiển của mình không độc quyền sở hữu IRQ, và hành vi của nó phải mang tính "cộng đồng" hơn so với mức cần thiết khi độc quyền sở hữu đường ngắt.

### Thực thi Trình xử lý (Running the Handler)

Như đã đề cập trước đó, khi kernel nhận được một ngắt (interrupt), tất cả các trình xử lý (handler) đã đăng ký sẽ được gọi. Một trình xử lý chia sẻ (shared handler) phải có khả năng phân biệt giữa các ngắt mà nó cần xử lý và các ngắt do các thiết bị khác tạo ra.

Tải module *short* với tùy chọn *shared=1* sẽ cài đặt trình xử lý sau thay vì trình xử lý mặc định:

```c

irqreturn_t short_sh_interrupt(int irq, void *dev_id, struct pt_regs *regs)
{
int value, written;
struct timeval tv;
/* Nếu đây không phải ngắt của short, hãy trả về ngay lập tức */
value = inb(short_base);
if (!(value & 0x80))
return IRQ_NONE;
/* Xóa bit báo ngắt */
outb(value & 0x7F, short_base);
/* phần còn lại giữ nguyên */
do_gettimeofday(&tv);
written = sprintf((char *)short_head,"%08u.%06u\n",
(int)(tv.tv_sec % 100000000), (int)(tv.tv_usec));
short_incr_bp(&short_head, written);
wake_up_interruptible(&short_queue); /* đánh thức mọi tiến trình đang đọc */
return IRQ_HANDLED;
}

```

Có một vài điểm cần giải thích ở đây. Vì cổng song song (parallel port) không có bit "đang chờ ngắt" (interrupt-pending) để kiểm tra, trình xử lý sử dụng bit ACK cho mục đích này. Nếu bit này ở mức cao (high), ngắt được báo cáo là dành cho *short*, và trình xử lý sẽ xóa bit đó đi.

Trình xử lý đặt lại bit bằng cách đưa bit cao của cổng dữ liệu giao tiếp song song về 0 — *short* giả định rằng các chân 9 và 10 được nối với nhau. Nếu một trong các thiết bị khác chia sẻ IRQ với *short* tạo ra một ngắt, *short* sẽ thấy rằng đường truyền của chính nó vẫn không hoạt động và không làm gì cả.

Tất nhiên, một driver đầy đủ tính năng có thể chia công việc thành nửa trên (top half) và nửa dưới (bottom half), nhưng điều đó rất dễ bổ sung và không có bất kỳ ảnh hưởng nào đến mã nguồn triển khai tính năng chia sẻ. Một driver thực tế cũng có thể sẽ sử dụng đối số `dev_id` để xác định thiết bị nào trong số rất nhiều thiết bị có thể đang gây ra ngắt.

Lưu ý rằng nếu bạn đang sử dụng máy in (thay vì dây nối tắt - jumper wire) để kiểm tra việc quản lý ngắt với *short*, trình xử lý chia sẻ này sẽ không hoạt động như mong đợi, bởi vì giao thức máy in không cho phép chia sẻ và driver không thể biết được ngắt có xuất phát từ máy in hay không.

### Giao diện /proc và Ngắt chia sẻ (The /proc Interface and Shared Interrupts)

Việc cài đặt các trình xử lý chia sẻ trong hệ thống không làm ảnh hưởng đến */proc/stat*, thậm chí tệp này còn không "biết" về các trình xử lý. Tuy nhiên, */proc/interrupts* thay đổi một chút.

Tất cả các trình xử lý được cài đặt cho cùng một số hiệu ngắt (interrupt number) sẽ xuất hiện trên cùng một dòng của */proc/interrupts*. Đầu ra sau đây (từ một hệ thống x86_64) cho thấy các trình xử lý ngắt chia sẻ được hiển thị như thế nào:

|      | CPU0           |              |                                                              |
|------|----------------|--------------|--------------------------------------------------------------|
|      | 0: 892335412   | XT-PIC timer |                                                              |
| 1:   | 453971         | XT-PIC i8042 |                                                              |
| 2:   | 0              |              | XT-PIC cascade                                               |
| 5:   | 0              |              | XT-PIC libata, ehci_hcd                                      |
| 8:   | 0              | XT-PIC rtc   |                                                              |
| 9:   | 0              | XT-PIC acpi  |                                                              |
| 10:  | 11365067       |              | XT-PIC ide2, uhci_hcd, uhci_hcd, SysKonnect SK-98xx, EMU10K1 |
| 11:  | 4391962        |              | XT-PIC uhci_hcd, uhci_hcd                                    |
| 12:  | 224            | XT-PIC i8042 |                                                              |
| 14:  | 2787721        | XT-PIC ide0  |                                                              |
| 15:  | 203048         | XT-PIC ide1  |                                                              |
| NMI: | 41234          |              |                                                              |
|      | LOC: 892193503 |              |                                                              |
| ERR: | 102            |              |                                                              |
| MIS: | 0              |              |                                                              |

Hệ thống này có một số đường ngắt chia sẻ. IRQ 5 được sử dụng cho các bộ điều khiển serial ATA và IEEE 1394; IRQ 10 có một số thiết bị, bao gồm bộ điều khiển IDE, hai bộ điều khiển USB, một giao diện Ethernet và một card âm thanh; và IRQ 11 cũng được sử dụng bởi hai bộ điều khiển USB.

## Nhập/Xuất điều khiển bằng ngắt (Interrupt-Driven I/O)
Bất cứ khi nào việc truyền dữ liệu đến hoặc đi từ phần cứng được quản lý có thể bị trì hoãn vì bất kỳ lý do gì, người viết driver nên triển khai việc đệm dữ liệu (buffering). Các bộ đệm dữ liệu (data buffer) giúp tách biệt quá trình truyền và nhận dữ liệu khỏi các system call `write` và `read`, từ đó đem lại lợi ích về hiệu năng tổng thể của hệ thống.

Một cơ chế đệm (buffering mechanism) tốt dẫn đến *I/O điều khiển ngắt* (interrupt-driven I/O), trong đó một bộ đệm đầu vào (input buffer) được lấp đầy tại thời điểm ngắt và được làm rỗng bởi các tiến trình (process) đọc thiết bị; một bộ đệm đầu ra (output buffer) được lấp đầy bởi các tiến trình ghi vào thiết bị và được làm rỗng tại thời điểm ngắt. Một ví dụ về đầu ra điều khiển ngắt (interrupt-driven output) là việc cài đặt */dev/shortprint*.

Để việc truyền dữ liệu điều khiển ngắt (interrupt-driven data transfer) diễn ra thành công, phần cứng phải có khả năng tạo ra các ngắt với ngữ nghĩa sau:

- Đối với đầu vào, thiết bị sẽ ngắt bộ xử lý (processor) khi dữ liệu mới đã đến và sẵn sàng được lấy bởi bộ xử lý của hệ thống. Các hành động thực tế cần thực hiện phụ thuộc vào việc thiết bị sử dụng cổng I/O (I/O port), ánh xạ bộ nhớ (memory mapping), hay DMA (Direct Memory Access).
- Đối với đầu ra, thiết bị phát ra ngắt khi nó sẵn sàng chấp nhận dữ liệu mới hoặc để xác nhận việc truyền dữ liệu thành công. Các thiết bị hỗ trợ ánh xạ bộ nhớ và DMA thường tạo ngắt để thông báo cho hệ thống rằng chúng đã xử lý xong bộ đệm.

Mối quan hệ thời gian giữa thao tác *read* hoặc *write* với thời điểm dữ liệu thực sự đến đã được giới thiệu trong phần "Các thao tác chặn và không chặn" (Blocking and Nonblocking Operations) ở Chương 6.

### Ví dụ về đệm đầu ra (Write-Buffering Example)
Chúng ta đã nhắc đến trình điều khiển (driver) *shortprint* vài lần; bây giờ là lúc thực sự xem xét nó. Mô-đun này cài đặt một trình điều khiển rất đơn giản, hướng đầu ra cho cổng song song (parallel port); tuy nhiên, nó đủ để cho phép in các tệp tin. Dù vậy, nếu bạn chọn kiểm tra trình điều khiển này, hãy nhớ rằng bạn phải truyền cho máy in một tệp ở định dạng mà nó hiểu được; không phải máy in nào cũng phản hồi tốt khi nhận được một luồng dữ liệu tùy ý.

Trình điều khiển *shortprint* duy trì một bộ đệm đầu ra vòng tròn (circular output buffer) có kích thước một trang (one-page). Khi một tiến trình ở không gian người dùng (user-space process) ghi dữ liệu vào thiết bị, dữ liệu đó được đưa vào bộ đệm, nhưng phương thức *write* không thực sự thực hiện bất kỳ thao tác I/O nào. Thay vào đó, phần cốt lõi của *shortp\_write* trông như sau:

```c

while (written < count) {
/* Chờ cho đến khi có sẵn không gian trong bộ đệm. */
space = shortp_out_space( );
if (space <= 0) {
if (wait_event_interruptible(shortp_out_queue,
(space = shortp_out_space( )) > 0))
goto out;
}
/* Chuyển dữ liệu vào bộ đệm. */
if ((space + written) > count)
space = count - written;
if (copy_from_user((char *) shortp_out_head, buf, space)) {
up(&shortp_out_sem);
return -EFAULT;
}
shortp_incr_out_bp(&shortp_out_head, space);
buf += space;
written += space;
/* Nếu không có đầu ra nào đang hoạt động, hãy kích hoạt nó. */
spin_lock_irqsave(&shortp_out_lock, flags);
if (! shortp_output_active)
shortp_start_output( );
spin_unlock_irqrestore(&shortp_out_lock, flags);
}
out:
*f_pos += written;

```

Một semaphore (*shortp\_out\_sem*) kiểm soát quyền truy cập vào bộ đệm vòng tròn; *shortp\_write* lấy semaphore đó ngay trước đoạn mã ở trên. Trong khi giữ semaphore, nó cố gắng nạp dữ liệu vào bộ đệm vòng tròn. Hàm *shortp\_out\_space* trả về lượng không gian liên tục có sẵn (vì vậy không cần phải lo lắng về việc cuộn vòng bộ đệm - buffer wrap); nếu lượng không gian đó bằng 0, trình điều khiển sẽ chờ cho đến khi một phần không gian được giải phóng. Sau đó, nó sao chép càng nhiều dữ liệu càng tốt vào bộ đệm.

Một khi có dữ liệu cần xuất ra, *shortp\_write* phải đảm bảo rằng dữ liệu được ghi vào thiết bị. Quá trình ghi thực tế được thực hiện thông qua một hàm *workqueue*; *shortp\_write* phải kích hoạt hàm đó nếu nó chưa chạy. Sau khi lấy một spinlock riêng biệt kiểm soát quyền truy cập vào các biến được sử dụng ở phía tiêu thụ (consumer side) của bộ đệm đầu ra (bao gồm cả *shortp\_output\_active*), nó sẽ gọi *shortp\_start\_output* nếu cần thiết. Sau đó, công việc chỉ đơn giản là ghi nhận lượng dữ liệu đã được "ghi" vào bộ đệm và trả về.

Hàm khởi động quá trình đầu ra trông như sau:

```c

static void shortp_start_output(void)
{
if (shortp_output_active) /* Đáng lẽ không bao giờ xảy ra */
return;
/* Thiết lập bộ hẹn giờ 'ngắt bị bỏ lỡ' (missed interrupt timer) của chúng ta */
shortp_output_active = 1;
shortp_timer.expires = jiffies + TIMEOUT;
add_timer(&shortp_timer);
/* Và bắt đầu tiến trình. */
queue_work(shortp_workqueue, &shortp_work);
}

```

Thực tế khi làm việc với phần cứng là thỉnh thoảng bạn có thể bị mất một ngắt từ thiết bị. Khi điều này xảy ra, chắc chắn bạn không muốn trình điều khiển của mình dừng lại vĩnh viễn cho đến khi hệ thống được khởi động lại; đó không phải là cách làm việc thân thiện với người dùng. Sẽ tốt hơn rất nhiều nếu nhận ra rằng một ngắt đã bị bỏ lỡ, thu dọn hiện trạng và tiếp tục chạy. Để làm được điều đó, *shortprint* thiết lập một bộ hẹn giờ nhân (kernel timer) mỗi khi nó xuất dữ liệu ra thiết bị. Nếu bộ hẹn giờ hết hạn (expires), có thể chúng ta đã bỏ lỡ một ngắt. Chúng ta sẽ xem xét hàm xử lý bộ hẹn giờ này ngay sau đây, nhưng hiện tại, hãy tiếp tục với chức năng đầu ra chính. Chức năng đó được thực hiện trong hàm *workqueue* của chúng ta, như bạn có thể thấy ở trên, được lên lịch tại đây. Phần cốt lõi của hàm đó trông như sau:

```c

spin_lock_irqsave(&shortp_out_lock, flags);
/* Chúng ta đã ghi mọi thứ chưa? */
if (shortp_out_head == shortp_out_tail) { /* trống */
shortp_output_active = 0;
wake_up_interruptible(&shortp_empty_queue);
del_timer(&shortp_timer);
}
/* Chưa, ghi thêm một byte nữa */
else
shortp_do_write( );
/* Nếu có ai đang chờ, có lẽ hãy đánh thức họ dậy. */
if (((PAGE_SIZE + shortp_out_tail - shortp_out_head) % PAGE_SIZE) > SP_MIN_SPACE)
{

```

```c

wake_up_interruptible(&shortp_out_queue);
}
spin_unlock_irqrestore(&shortp_out_lock, flags);

```

Vì chúng ta đang xử lý các biến chia sẻ (shared variables) của phía đầu ra, chúng ta phải lấy khóa spinlock (spinlock). Sau đó, chúng ta kiểm tra xem còn dữ liệu nào cần gửi đi nữa không; nếu không, chúng ta ghi nhận rằng đầu ra không còn hoạt động, xóa bộ hẹn giờ (timer), và đánh thức bất kỳ tiến trình nào đang chờ hàng đợi (queue) trống hoàn toàn (kiểu chờ này thường được thực hiện khi thiết bị được đóng lại). Ngược lại, nếu vẫn còn dữ liệu cần ghi, chúng ta gọi *shortp\_do\_write* để thực sự gửi một byte tới phần cứng.

Sau đó, vì chúng ta có thể đã giải phóng không gian trong bộ đệm đầu ra (output buffer), chúng ta cân nhắc việc đánh thức bất kỳ tiến trình nào đang chờ để thêm dữ liệu vào bộ đệm đó. Tuy nhiên, chúng ta không thực hiện việc đánh thức này một cách vô điều kiện; thay vào đó, chúng ta chờ cho đến khi có một lượng dung lượng tối thiểu khả dụng. Sẽ chẳng có ích gì khi đánh thức một tiến trình ghi (writer) mỗi khi chúng ta lấy một byte ra khỏi bộ đệm; chi phí để đánh thức tiến trình, lập lịch cho nó chạy, và đưa nó trở lại trạng thái ngủ là quá cao đối với việc đó. Thay vào đó, chúng ta nên chờ cho đến khi tiến trình đó có thể chuyển một lượng dữ liệu đáng kể vào bộ đệm cùng một lúc. Kỹ thuật này rất phổ biến trong các trình điều khiển (driver) có đệm và điều khiển ngắt (interrupt-driven).

Để tính toàn diện, đây là mã nguồn thực sự ghi dữ liệu vào cổng (port):

```c

static void shortp_do_write(void)
{
unsigned char cr = inb(shortp_base + SP_CONTROL);
/* Có gì đó đã xảy ra; đặt lại bộ hẹn giờ */
mod_timer(&shortp_timer, jiffies + TIMEOUT);
/* Gửi một byte ra thiết bị */
outb_p(*shortp_out_tail, shortp_base+SP_DATA);
shortp_incr_out_bp(&shortp_out_tail, 1);
if (shortp_delay)
udelay(shortp_delay);
outb_p(cr | SP_CR_STROBE, shortp_base+SP_CONTROL);
if (shortp_delay)
udelay(shortp_delay);
outb_p(cr & ~SP_CR_STROBE, shortp_base+SP_CONTROL);
}

```

Ở đây, chúng ta đặt lại bộ hẹn giờ để phản ánh thực tế là chúng ta đã đạt được một số tiến bộ, gửi xung nhịp strobe byte ra thiết bị, và cập nhật con trỏ bộ đệm vòng (circular buffer pointer).

Hàm *workqueue* không tự đăng ký lại trực tiếp, vì vậy chỉ một byte duy nhất sẽ được ghi vào thiết bị. Tại một thời điểm nào đó, máy in, theo cách chậm chạp của nó, sẽ tiêu thụ byte đó và sẵn sàng cho byte tiếp theo; sau đó nó sẽ ngắt bộ xử lý (processor). Trình xử lý ngắt (interrupt handler) được sử dụng trong *shortprint* ngắn gọn và đơn giản:

```c

static irqreturn_t shortp_interrupt(int irq, void *dev_id, struct pt_regs *regs)
{
if (! shortp_output_active)
return IRQ_NONE;

```

**284 | Chương 10: Xử lý Ngắt (Interrupt Handling)**

```c

/* Ghi nhớ thời gian và chuyển phần còn lại cho hàm workqueue */
do_gettimeofday(&shortp_tv);
queue_work(shortp_workqueue, &shortp_work);
return IRQ_HANDLED;
}

```

Vì cổng song song (parallel port) không yêu cầu xác nhận ngắt rõ ràng (explicit interrupt acknowledgment), tất cả những gì trình xử lý ngắt thực sự cần làm là ra lệnh cho nhân hệ điều hành (kernel) chạy lại hàm *workqueue*.

Điều gì sẽ xảy ra nếu ngắt không bao giờ đến? Mã nguồn trình điều khiển mà chúng ta vừa xem xét sẽ đơn giản là bị dừng lại. Để ngăn chặn điều đó xảy ra, chúng ta đã thiết lập một bộ hẹn giờ ở vài trang trước. Hàm được thực thi khi bộ hẹn giờ đó hết hạn là:

```c

static void shortp_timeout(unsigned long unused)
{
unsigned long flags;
unsigned char status;
if (! shortp_output_active)
return;
spin_lock_irqsave(&shortp_out_lock, flags);
status = inb(shortp_base + SP_STATUS);
/* Nếu máy in vẫn bận, chúng ta chỉ cần đặt lại bộ hẹn giờ */
if ((status & SP_SR_BUSY) = = 0 || (status & SP_SR_ACK)) {
shortp_timer.expires = jiffies + TIMEOUT;
add_timer(&shortp_timer);
spin_unlock_irqrestore(&shortp_out_lock, flags);
return;
}
/* Ngược lại, chúng ta chắc chắn đã bỏ lỡ một ngắt. */
spin_unlock_irqrestore(&shortp_out_lock, flags);
shortp_interrupt(shortp_irq, NULL, NULL);
}

```

Nếu không có hoạt động đầu ra nào được cho là đang chạy, hàm bộ hẹn giờ sẽ đơn giản trả về; điều này giúp bộ hẹn giờ không tự đăng ký lại khi hệ thống đang được tắt. Sau đó, sau khi lấy khóa (lock), chúng ta truy vấn trạng thái của cổng; nếu nó thông báo là đang bận, nghĩa là nó vẫn chưa kịp gửi ngắt cho chúng ta, vì vậy chúng ta đặt lại bộ hẹn giờ và trả về. Đôi khi, máy in có thể mất rất nhiều thời gian để sẵn sàng; hãy tưởng tượng trường hợp máy in hết giấy trong lúc mọi người đi nghỉ cuối tuần dài ngày. Trong những tình huống như vậy, không còn cách nào khác ngoài việc kiên nhẫn chờ đợi cho đến khi có sự thay đổi.

Tuy nhiên, nếu máy in thông báo là đã sẵn sàng, chúng ta chắc chắn đã bỏ lỡ ngắt của nó. Trong trường hợp đó, chúng ta chỉ cần gọi thủ công trình xử lý ngắt của mình để quá trình xuất dữ liệu tiếp tục di chuyển trở lại.

Trình điều khiển *shortprint* không hỗ trợ việc đọc từ cổng; thay vào đó, nó hoạt động giống như *shortint* và trả về thông tin thời gian ngắt (interrupt timing information). Tuy nhiên, việc thực thi một phương thức *read* điều khiển bằng ngắt sẽ rất giống với những gì chúng ta đã thấy. Dữ liệu từ thiết bị sẽ được đọc vào một bộ đệm của trình điều khiển; nó sẽ chỉ được sao chép ra không gian người dùng (user space) khi một lượng dữ liệu đáng kể đã tích lũy trong bộ đệm, yêu cầu *read* đã được đáp ứng hoàn toàn, hoặc một loại thời gian chờ (timeout) nào đó xảy ra.
```

## Tài liệu tham khảo nhanh

Các ký hiệu liên quan đến quản lý ngắt (interrupt management) được giới thiệu trong chương này:

```c
## include <linux/interrupt.h>
int request_irq(unsigned int irq, irqreturn_t (*handler)( ), unsigned long
 flags, const char *dev_name, void *dev_id);
void free_irq(unsigned int irq, void *dev_id);
```

Các hàm dùng để đăng ký (register) và hủy đăng ký (unregister) một trình xử lý ngắt (interrupt handler).

```c
## include <linux/irq.h>
int can_request_irq(unsigned int irq, unsigned long flags);
```

Hàm này, có sẵn trên các kiến trúc i386 và x86_64, trả về một giá trị khác không nếu việc cố gắng cấp phát đường ngắt (interrupt line) chỉ định thành công.

```c
## include <asm/signal.h>
SA_INTERRUPT
SA_SHIRQ
SA_SAMPLE_RANDOM
```

Các cờ (flags) cho hàm *request\_irq*. SA\_INTERRUPT yêu cầu cài đặt một trình xử lý ngắt nhanh (fast handler) (trái ngược với trình xử lý chậm - slow handler). SA\_SHIRQ cài đặt một trình xử lý ngắt chia sẻ (shared handler), và cờ thứ ba khẳng định rằng dấu thời gian ngắt (interrupt timestamps) có thể được sử dụng để tạo ra độ hỗn loạn entropy cho hệ thống.

```
/proc/interrupts
/proc/stat
```

Các nút hệ thống tệp (filesystem nodes) báo cáo thông tin về các ngắt phần cứng (hardware interrupts) và các trình xử lý đã được cài đặt.

```
unsigned long probe_irq_on(void);
int probe_irq_off(unsigned long);
```

Các hàm được sử dụng bởi trình điều khiển thiết bị (driver) khi nó cần dò tìm để xác định đường ngắt nào đang được sử dụng bởi một thiết bị. Kết quả của *probe\_irq\_on* phải được truyền ngược lại cho *probe\_irq\_off* sau khi ngắt được sinh ra. Giá trị trả về của *probe\_irq\_off* là số hiệu ngắt được phát hiện.

```
IRQ_NONE
IRQ_HANDLED
IRQ_RETVAL(int x)
```

Các giá trị trả về có thể có từ một trình xử lý ngắt, cho biết liệu một ngắt thực tế từ thiết bị có xuất hiện hay không.

```
void disable_irq(int irq);
void disable_irq_nosync(int irq);
void enable_irq(int irq);
```

Trình điều khiển có thể bật và tắt việc báo cáo ngắt. Nếu phần cứng cố gắng sinh ra một ngắt trong khi các ngắt đang bị vô hiệu hóa, ngắt đó sẽ bị mất vĩnh viễn. Trình điều khiển sử dụng trình xử lý chia sẻ (shared handler) tuyệt đối không được sử dụng các hàm này.

```
void local_irq_save(unsigned long flags);
void local_irq_restore(unsigned long flags);
```

Sử dụng *local\_irq\_save* để vô hiệu hóa các ngắt trên bộ xử lý cục bộ (local processor) và ghi nhớ trạng thái trước đó của chúng. Các cờ này có thể được truyền cho *local\_irq\_restore* để khôi phục trạng thái ngắt trước đó.

```
void local_irq_disable(void);
void local_irq_enable(void);
```

Các hàm vô hiệu hóa và kích hoạt ngắt một cách vô điều kiện trên bộ xử lý hiện tại.
