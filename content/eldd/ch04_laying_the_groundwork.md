# Chương 4. Tạo Nền Móng

| Trong Chương Này                  |     |
|-----------------------------------|-----|
| Giới thiệu về Thiết bị và Driver  | 90  |
| Xử lý Ngắt (Interrupt Handling)   | 92  |
| Mô hình Thiết bị Linux            | 103 |
| Rào cản Bộ nhớ (Memory Barriers)  | 114 |
| Quản lý Nguồn điện                | 114 |
| Xem xét các Mã nguồn               | 115 |
|                                   |     |

Chúng ta hiện đang ở rất gần với việc viết một device driver. Tuy nhiên, trước khi làm điều đó, hãy tự trang bị cho mình một số khái niệm về driver. Chúng ta bắt đầu chương bằng việc tìm hiểu ý tưởng về bài toán của cuốn sách; chúng ta sẽ xem xét các thiết bị tiêu biểu và giao diện I/O hiện diện trên các hệ thống tương thích PC và máy tính nhúng. Xử lý ngắt (interrupt handling) là một phần không thể thiếu của hầu hết các driver, vì vậy phần tiếp theo chúng ta sẽ đề cập đến kỹ thuật viết các trình xử lý ngắt (interrupt handler). Sau đó, chúng ta chuyển sự chú ý sang mô hình thiết bị mới được giới thiệu trong kernel 2.6. Mô hình mới được xây dựng dựa trên các cõi trừu tượng (abstraction) như *sysfs*, *kobjects*, *device classes* và *udev*, nhằm cô đọng các điểm chung từ các device driver. Mô hình thiết bị mới này cũng loại bỏ các chính sách (policy) khỏi không gian nhân (kernel space) và đẩy chúng sang không gian người dùng (user space), dẫn đến việc đại tu hoàn toàn các tính năng như quản lý node */dev*, hotplug, coldplug, tự động nạp module (module autoload), và tải firmware.

## Giới thiệu về Thiết bị và Driver

Các ứng dụng người dùng (user application) không thể trực tiếp giao tiếp với phần cứng bởi vì điều đó đòi hỏi phải có các đặc quyền như thực thi các tập lệnh đặc biệt và xử lý ngắt (interrupt). Các device driver gánh vác phần nặng nhọc là tương tác với phần cứng và cung cấp các giao diện mà ứng dụng và phần còn lại của kernel có thể sử dụng để truy cập thiết bị. Các ứng dụng vận hành trên các thiết bị thông qua các node trong thư mục */dev* và thu thập thông tin thiết bị bằng cách sử dụng các node trong thư mục */sys*.[1]

[1] Như bạn sẽ tìm hiểu sau, các ứng dụng mạng định tuyến các yêu cầu của chúng đến driver bên dưới bằng một cơ chế khác.

Hình 4.1 hiển thị sơ đồ khối phần cứng của một hệ thống tương thích PC tiêu biểu. Như bạn có thể thấy, hệ thống hỗ trợ các thiết bị và công nghệ giao diện đa dạng như bộ nhớ, video, audio, USB, PCI, WiFi, PCMCIA, I2C, IDE, Ethernet, cổng nối tiếp (serial port), bàn phím, chuột, ổ đĩa mềm (floppy drive), cổng song song (parallel port) và Hồng ngoại (Infrared). Bộ điều khiển bộ nhớ (memory controller) và bộ điều khiển đồ họa (graphics controller) là một phần của chipset *North Bridge* trong kiến trúc PC, trong khi các bus ngoại vi bắt nguồn từ *South Bridge*.

**Hình 4.1. Sơ đồ khối phần cứng của một hệ thống tương thích PC.**

```
                              +-----------+
                              | Processor |
                              +-----------+
                                     |
                                     v
                         +------------------------+
                         |      North Bridge      |
                         | +--------------------+ |
 DRAM -------------------| | Memory Controller  | |
                         | +--------------------+ |
                         | +--------------------+ |
 Display Unit ---------- | | Graphics Control.  | |
                         | +--------------------+ |
                         +------------------------+
                                     |
                                     v
                         +------------------------+
                         |      South Bridge      |
                         +------------------------+
                                     |
                                     v
                           +------------------+
                           |  Hub Interface   |
                           +------------------+
          _____________________|_______________________________________________________________________________________________________________________________________________________
         /          |           |          |       |      \                                                     |                                                                    |
        v           v           v          v       v       v                                                    V                                                                    v

+-----------+  +---------+  +------+   +-----------+   +-----------+                                        +----------+      +----------------------+      +------------+         +-----------------+      +------------------+
| RTC/CMOS |   |  PCI    |  | IDE  |   |   I²C     |   |   LPC     |-----------------|                      |  USB     |----> |  External PCI Intf. |---->  | Ethernet   |         | AC'97 Controller|----> |  Audio CODEC     |----> Speaker / MIC
+-----------+  +---------+  +------+   +-----------+   +-----------+                 |                      +----------+      +----------------------+      +------------+         +-----------------+      +------------------+
                                |            |              |                        |                        |   |                     |
                                v            v              v                        v                        |   |                     v
                           +----------+  +--------+   +------------------+    +------------------------+      |   +--> WiFi Chipset     +--> CardBus Controller --> CardBus Card
                           | Hard Disk|  | EEPROM |   |  Super I/O       |    | Firmware Hub (BIOS)    |      |                         |
                           +----------+  +--------+   +------------------+    +------------------------+      +--> SCSI Host Adapter    +---------------------------> PCMCIA Card
                                                         | 
                                                         v
          -------------------------------------------------------------------------------------
          |    Serial Port | PS/2 Keyboard | PS/2 Mouse | Parallel | Floppy Drive | Infrared  |
          |                                |            |  Port    |              |           |
          |                                |            |          |              |           |
          |                                |            |          |              |           |
          |                                |            |          |              |           |
          |                                |            |          |              |           |
          -------------------------------------------------------------------------------------

```

Hình 4.2 minh họa một sơ đồ khối tươngอน (tương tự) cho một thiết bị nhúng (embedded device) giả định. Sơ đồ này chứa một số giao diện không điển hình trong thế giới máy tính cá nhân (PC), chẳng hạn như bộ nhớ flash, màn hình LCD, màn hình cảm ứng (touch screen) và modem di động (cellular modem).

**Hình 4.2. Sơ đồ khối phần cứng của một hệ thống nhúng (embedded system).**

```
                   +--------------------------------------------------+
                   | Domain-specific electronics /                    |
                   | Bluetooth / Infrared / GSM / GPRS / GPS /        |
                   | 3G / Biometrics / SmartCard / Encryption         |
                   +--------------------------------------------------+
                                 ^
                                 |      
                                 |
                    UART / USB / I2C / SPI / CAN                     Embedded SoC 
                         +-----------------------------------------------------------------------+
                         |                                                                       |
           SDRAM ------> |                  ADDR/Data/Chipselect     NAND UART                   | <----- Flash Memory
     Connectivity ---->  |  CPU Core                                        Controller           | <----- Debug Serial Port
                         |      |                     Internal Local Bus       |                 |
                   |-----|     --------------|--------------------------------------  GPIO Ports |
                   |     |  LCD Controller   |         |           |        |     |              |
                   |     |                   |         |           |        |     |              |    +-------------------+
                   |     |                   |         |           |        |     |              |----|Keys, Buttons, LEDS|
                   |     |                                                                       |    +-------------------+
                   |     |     I2C          I2S       SPI       USB OTG     SD   PCMCIA          |
                   |     +-----------------------------------------------------------------------+
                   |            |            |         |          |       |   |    |         +---------+
           +----------------+   |            |         |          |       |   |    |---------|CF Slot  |
           | LCD Panel      |   |        +---------+   |          |       |   |              +---------+
           +----------------+   |--------| CODEC   |   |     +---------+  |  +---------+
           | Touch Panel    |   |        +---------+   |     |USB Host |  |  |SD Slot  |
           +----------------+   |        +---------+   |     |  Port   |  |  +---------+
                  |   |         |        |   RTC   |---|     +---------+  |
                  |   |         |        +---------+   |  +---------+   +-----------+
                  |   |         |        |         |   |--|  EEPROM |   | USB Device|
                  |   |         |        |         |   |  |         |   | Port      |        
           +-----------------+  |--------| Smart   |   |  +---------+   +-----------+
           |                 |  |        | Battery |
           | Touch Controller|  |        +---------+ 
           +-----------------+   
              |
              V
     SPI/USB/Serial/ADC
```

Đương nhiên, khả năng truy cập các thiết bị ngoại vi (peripheral devices) là một phần cực kỳ quan trọng trong hoạt động của hệ thống. Trình điều khiển thiết bị (device drivers) cung cấp cơ chế để thực hiện điều này. Các chương còn lại trong cuốn sách này sẽ đi sâu vào giao diện thiết bị và hướng dẫn bạn cách hiện thực hóa (implement) device driver tương ứng.

## Xử lý Ngắt (Interrupt Handling)

Do bản chất không thể đoán trước (indeterminate nature) của các hoạt động I/O, và sự chênh lệch tốc độ giữa các thiết bị I/O và bộ xử lý (processor), các thiết bị sẽ yêu cầu sự chú ý của bộ xử lý bằng cách kích hoạt một số tín hiệu phần cứng nhất định một cách bất đồng bộ (asynchronously). Các tín hiệu phần cứng này được gọi là *ngắt* (interrupts). Mỗi thiết bị tạo ra ngắt sẽ được gán một định danh đi kèm gọi là số *yêu cầu ngắt* (interrupt request - IRQ). Khi bộ xử lý phát hiện thấy một ngắt đã được tạo ra trên một đường IRQ, nó sẽ lập tức dừng công việc đang làm lại và gọi một *thường lệ phục vụ ngắt* (interrupt service routine - ISR) đã được đăng ký cho IRQ tương ứng. Các * trình xử lý ngắt* (Interrupt handlers - ISRs) thực thi trong ngữ cảnh ngắt (interrupt context).

## Ngữ cảnh ngắt (Interrupt Context)

Các ISR (Interrupt Service Routine - Trình phục vụ ngắt) là những đoạn mã quan trọng giao tiếp trực tiếp với phần cứng. Chúng được trao đặc quyền thực thi ngay lập tức vì lợi ích lớn hơn của hiệu năng hệ thống. Tuy nhiên, nếu các ISR không nhanh và nhẹ, chúng sẽ mâu thuẫn với chính triết lý của mình. Các yếu nhân (VIP) được đối xử ưu đãi, nhưng trách nhiệm của họ là giảm thiểu sự bất tiện gây ra cho công chúng. Để bù đắp cho việc ngắt ngang tiến trình thực thi hiện tại một cách đột ngột, các ISR phải thực thi một cách lịch sự trong một môi trường bị hạn chế gọi là **ngữ cảnh ngắt** (interrupt context) hay còn gọi là *ngữ cảnh nguyên tử* (*atomic context*).

Dưới đây là danh sách những điều nên làm và không nên làm đối với mã đang thực thi trong ngữ cảnh ngắt:

- Đó là một "tội phạm đáng ngồi tù" nếu mã trong ngữ cảnh ngắt của bạn đi ngủ (sleep). Các trình xử lý ngắt (interrupt handler) không thể nhường bộ vi xử lý (processor) bằng cách gọi các hàm dễ ngủ như `schedule_timeout()`. Trước khi gọi một API của kernel từ trình xử lý ngắt của bạn, hãy xem xét kỹ chuỗi lệnh gọi lồng nhau và đảm bảo rằng nó không kích hoạt ngầm một thao tác chờ chặn (blocking wait). Ví dụ, `input_register_device()` trông có vẻ vô hại ở bề mặt, nhưng lại gọi ngầm `kmalloc()` ở bên dưới với tham số được chỉ định là `GFP_KERNEL`. Như bạn đã thấy ở Chương 2, "A Peek Inside the Kernel", nếu bộ nhớ trống của hệ thống giảm xuống dưới mức giới hạn (watermark), `kmalloc()` sẽ chuyển sang trạng thái ngủ-chờ (sleep-wait) để bộ nhớ được giải phóng bởi tiến trình hoán đổi (swapper), nếu bạn gọi nó theo cách này. **1.**
- Để bảo vệ các vùng tới hạn (critical section) bên trong các trình xử lý ngắt, bạn không thể sử dụng mutex vì chúng có thể đi ngủ. Thay vào đó, hãy sử dụng spinlock, và chỉ sử dụng chúng khi thực sự bắt buộc. **2.**
- Các trình xử lý ngắt không thể trao đổi dữ liệu trực tiếp với không gian người dùng (user space) vì chúng không được kết nối với vùng người dùng (user land) thông qua các ngữ cảnh tiến trình (process context). Điều này đưa chúng ta đến một lý do khác khiến trình xử lý ngắt không thể đi ngủ: Bộ lập lịch (scheduler) hoạt động ở mức độ chi tiết là tiến trình, vì vậy nếu các trình xử lý ngắt ngủ và bị loại bỏ khỏi lịch trình (scheduled out), làm thế nào chúng có thể được đưa trở lại hàng đợi chạy (run queue)? **3.**
- Các trình xử lý ngắt phải nhanh chóng hoàn thành nhiệm vụ nhưng vẫn phải đảm bảo công việc được giải quyết rốt ráo. Để vượt qua tình thế tiến lưỡng nan này, các trình xử lý ngắt thường chia công việc thành hai phần. *Nửa trên* (*top half*) gọn nhẹ của trình xử lý sẽ gắn cờ xác nhận rằng nó đã phục vụ ngắt nhưng trên thực tế, nó sẽ chuyển toàn bộ công việc nặng nhọc cho *nửa dưới* (*bottom half*) cồng kềnh hơn. Việc thực thi nửa dưới được hoãn lại đến một thời điểm sau đó khi tất cả các ngắt được bật. Bạn sẽ học cách phát triển nửa dưới khi thảo luận về *softirq* và *tasklet* sau đây. **4.**
- Bạn không cần phải thiết kế các trình xử lý ngắt theo kiểu tái nhập (reentrant). Khi một trình xử lý ngắt đang chạy, IRQ tương ứng sẽ bị vô hiệu hóa cho đến khi trình xử lý trả về. Vì vậy, không giống như mã trong ngữ cảnh tiến trình, các thể hiện (instance) khác nhau của cùng một trình xử lý sẽ không chạy đồng thời trên nhiều bộ vi xử lý. **5.**
- Các trình xử lý ngắt có thể bị ngắt bởi các trình xử lý liên kết với các IRQ có mức ưu tiên cao hơn. Bạn có thể ngăn chặn ngắt lồng nhau này bằng cách yêu cầu cụ thể kernel coi trình xử lý ngắt của bạn như một **6.**

trình xử lý *nhanh* (*fast* handler). Các trình xử lý nhanh chạy với tất cả các ngắt bị vô hiệu hóa trên bộ vi xử lý cục bộ. Trước khi vô hiệu hóa ngắt hoặc dán nhãn trình xử lý ngắt của bạn là nhanh, hãy lưu ý rằng thời gian tắt ngắt (interrupt-off time) rất có hại cho hiệu năng hệ thống. Thời gian tắt ngắt càng lớn, độ trễ ngắt (interrupt latency) càng cao, hay nói cách khác là độ trễ trước khi một ngắt được sinh ra được phục vụ càng lâu. Độ trễ ngắt tỷ lệ nghịch với khả năng phản hồi thời gian thực (real-time responsiveness) của hệ thống.

Một hàm có thể kiểm tra giá trị do `in_interrupt()` trả về để biết liệu nó có đang thực thi trong ngữ cảnh ngắt hay không.

Khác với các ngắt bất đồng bộ (asynchronous interrupt) được sinh ra bởi phần cứng ngoại vi, có các lớp ngắt đến một cách đồng bộ (synchronous). Các ngắt đồng bộ được gọi như vậy vì chúng không xuất hiện bất ngờ—chính bộ vi xử lý sinh ra chúng bằng cách thực thi một lệnh. Cả ngắt ngoại vi và ngắt đồng bộ đều được xử lý bởi kernel bằng các cơ chế giống hệt nhau.

Các ví dụ về ngắt đồng bộ bao gồm:

- Ngoại lệ (Exception), được sử dụng để báo cáo các lỗi nghiêm trọng khi chạy thời gian thực (runtime error)
- Ngắt phần mềm (Software interrupt) chẳng hạn như lệnh `int 0x80` được sử dụng để thực hiện các lời gọi hệ thống (system call) trên kiến trúc x86

### Phân bổ IRQ (Assigning IRQs)

Các trình điều khiển thiết bị (device drivers) phải kết nối số IRQ (IRQ number) của chúng với một trình xử lý ngắt (interrupt handler). Để làm điều này, chúng cần biết IRQ được gán cho thiết bị mà chúng đang điều khiển. Việc phân bổ IRQ có thể rất đơn giản hoặc có thể đòi hỏi quá trình dò tìm phức tạp (probing). Ví dụ, trong kiến trúc PC, ngắt bộ định thời (timer interrupts) được gán IRQ 0, và ngắt RTC (RTC interrupts) đáp ứng IRQ 8. Các công nghệ bus hiện đại như PCI đủ tinh vi để phản hồi các truy vấn liên quan đến IRQ của chúng (được BIOS gán khi nó quét qua bus trong quá trình khởi động). Các trình điều khiển PCI có thể thâm nhập vào các vùng được định sẵn trong không gian cấu hình (configuration space) của thiết bị để tìm ra IRQ. Đối với các thiết bị cũ hơn như các card dựa trên chuẩn *Industry Standard Architecture* (ISA), trình điều khiển có thể phải tận dụng kiến thức đặc thù về phần cứng để dò tìm và giải mã IRQ.

Hãy xem */proc/interrupts* để có danh sách các IRQ đang hoạt động trên hệ thống của bạn.

#### Ví dụ về thiết bị: Bánh xe cuộn (Roller Wheel)

Bây giờ bạn đã học các kiến thức cơ bản về xử lý ngắt, hãy cùng triển khai một trình xử lý ngắt cho một thiết bị bánh xe cuộn mẫu. Bánh xe cuộn có thể được tìm thấy trên một số điện thoại và PDA để dễ dàng điều hướng menu và có khả năng thực hiện ba chuyển động: xoay theo chiều kim đồng hồ, xoay ngược chiều kim đồng hồ và nhấn phím. Bánh xe cuộn giả định của chúng ta được đấu dây sao cho bất kỳ chuyển động nào trong số này đều ngắt bộ vi xử lý tại IRQ 7. Ba bit thấp của cổng *General Purpose I/O* (GPIO) Port D của bộ vi xử lý được kết nối với thiết bị bánh xe cuộn. Các dạng sóng được tạo ra trên các chân này tương ứng với các chuyển động khác nhau của bánh xe được thể hiện trong Hình 4.3. Công việc của trình xử lý ngắt là giải mã các chuyển động của bánh xe bằng cách quan sát thanh ghi dữ liệu GPIO của Port D.

**Hình 4.3. Các dạng sóng mẫu được tạo ra bởi bánh xe cuộn.**

```
Anticlockwise Rotation
----------------------

PORT D0:  ___■■■___■■■___■■■___
PORT D1: ______■■■___■■■___■■■_
PORT D2: _______________________   

Clockwise Rotation
------------------

PORT D0: ______■■■___■■■___■■■_
PORT D1:  ___■■■___■■■___■■■___
PORT D2: _______________________   (luôn mức thấp)

Key Press
---------

PORT D0: _________________________
PORT D1: _________________________
PORT D2: ______■■■■■■■■■■■■______   (xung mức cao dài khi nhấn phím)
```

Trình điều khiển trước tiên phải yêu cầu IRQ (request the IRQ) và liên kết một trình xử lý ngắt với nó:

```
## define ROLLER_IRQ 7
static irqreturn_t roller_interrupt(int irq, void *dev_id);
if (request_irq(ROLLER_IRQ, roller_interrupt, IRQF_DISABLED |
 IRQF_TRIGGER_RISING, "roll", NULL)) {
 printk(KERN_ERR "Roll: Can't register IRQ %d\n", ROLLER_IRQ);
 return -EIO;
}
```

Hãy xem xét các tham số được truyền cho hàm request\_irq(). Số IRQ không được truy vấn hoặc dò tìm mà được mã hóa cứng (hard-coded) thành ROLLER\_IRQ trong trường hợp đơn giản này theo kết nối phần cứng. Tham số thứ hai, roller\_interrupt(), là hàm trình xử lý ngắt. Nguyên mẫu (prototype) của nó chỉ định kiểu trả về là irqreturn\_t, có thể là IRQ\_HANDLED nếu ngắt được xử lý thành công hoặc IRQ\_NONE nếu không. Giá trị trả về này mang ý nghĩa quan trọng hơn đối với các công nghệ I/O như PCI, nơi nhiều thiết bị có thể chia sẻ cùng một IRQ.

Cờ IRQF\_DISABLED chỉ định rằng trình xử lý ngắt này phải được đối xử như một trình xử lý nhanh (fast handler), vì vậy kernel phải vô hiệu hóa các ngắt trong lúc gọi trình xử lý. IRQF\_TRIGGER\_RISING thông báo rằng bánh xe cuộn tạo ra một sườn lên (rising edge) trên đường ngắt khi nó muốn ra hiệu một ngắt. Nói cách khác, bánh xe cuộn là một thiết bị *nhạy cảm theo sườn* (*edge-sensitive*). Ngược lại, một số thiết bị là *nhạy cảm theo mức* (*level-sensitive*) và giữ cho đường ngắt ở trạng thái kích hoạt cho đến khi CPU phục vụ nó. Để đánh dấu một ngắt là nhạy cảm theo mức, hãy sử dụng cờ IRQF\_TRIGGER\_HIGH. Các giá trị khả thi khác cho tham số này bao gồm IRQF\_SAMPLE\_RANDOM (được sử dụng trong mục "Pseudo Char Drivers" ở Chương 5, "Character Drivers") và IRQF\_SHARED (được sử dụng để chỉ định rằng IRQ này được chia sẻ giữa nhiều thiết bị).

Tham số tiếp theo, "roll", được sử dụng để nhận diện thiết bị này trong dữ liệu được tạo bởi các tệp như */proc/interrupts*. Tham số cuối cùng, được đặt thành NULL trong trường hợp này, chỉ có liên quan đối với các trình xử lý ngắt chia sẻ (shared interrupt handlers) và được sử dụng để nhận diện từng thiết bị đang chia sẻ đường IRQ.

Bắt đầu từ phiên bản kernel 2.6.19, đã có một số thay đổi đối với giao diện trình xử lý ngắt. Các trình xử lý ngắt trước đây nhận một tham số thứ ba (struct pt\_regs \*) chứa con trỏ trỏ đến các thanh ghi CPU, nhưng điều này đã bị loại bỏ bắt đầu từ kernel 2.6.19. Ngoài ra, họ cờ ngắt IRQF\_xxx đã thay thế cho họ cờ SA\_xxx. Ví dụ, với các phiên bản kernel trước đó, bạn phải sử dụng SA\_INTERRUPT thay vì IRQF\_DISABLED để đánh dấu một trình xử lý ngắt là trình xử lý nhanh.

Việc khởi tạo trình điều khiển không phải là thời điểm thích hợp để yêu cầu IRQ bởi vì điều đó có thể chiếm dụng tài nguyên quý giá ngay cả khi thiết bị không được sử dụng. Vì vậy, các trình điều khiển thiết bị thường yêu cầu IRQ khi thiết bị được mở bởi một ứng dụng. Tương tự như vậy, IRQ được giải phóng khi ứng dụng đóng thiết bị chứ không phải trong lúc thoát khỏi module trình điều khiển. Việc giải phóng một IRQ được thực hiện như sau:

```
free_irq(int irq, void *dev_id);
```

Liệt kê 4.1 (Listing 4.1) trình bày việc cài đặt hàm xử lý ngắt (interrupt handler) của bi lăn (roller). Hàm `roller_interrupt()` nhận hai tham số: số ngắt (IRQ) và định danh thiết bị (device identifier) được truyền vào như là tham số cuối cùng của hàm `request_irq()` tương ứng. Hãy quan sát Hình 4.3 (Figure 4.3) đặt song song với đoạn mã nguồn này.

#### Liệt kê 4.1. Hàm xử lý ngắt của bi lăn (The Roller Interrupt Handler)

```
spinlock_t roller_lock = SPIN_LOCK_UNLOCKED;
static DECLARE_WAIT_QUEUE_HEAD(roller_poll);
static irqreturn_t
roller_interrupt(int irq, void *dev_id)
{
 int i, PA_t, PA_delta_t, movement = 0;
 /* Get the waveforms from bits 0, 1 and 2
 of Port D as shown in Figure 4.3 */
 PA_t = PORTD & 0x07;
 /* Wait until the state of the pins change.
 (Add some timeout to the loop) */
 for (i=0; (PA_t==PA_delta_t); i++){
 PA_delta_t = PORTD & 0x07;
 }
 movement = determine_movement(PA_t, PA_delta_t); /* See below */
```

```
 spin_lock(&roller_lock);
 /* Store the wheel movement in a buffer for
 later access by the read()/poll() entry points */
 store_movements(movement);
 spin_unlock(&roller_lock);
 /* Wake up the poll entry point that might have
 gone to sleep, waiting for a wheel movement */
 wake_up_interruptible(&roller_poll);
 return IRQ_HANDLED;
}
int
determine_movement(int PA_t, int PA_delta_t)
{
 switch (PA_t){
 case 0:
 switch (PA_delta_t){
 case 1:
 movement = ANTICLOCKWISE;
 break;
 case 2:
 movement = CLOCKWISE;
 break;
 case 4:
 movement = KEYPRESSED;
 break;
 }
 break;
 case 1:
 switch (PA_delta_t){
 case 3:
 movement = ANTICLOCKWISE;
 break;
 case 0:
 movement = CLOCKWISE;
 break;
 }
 break;
 case 2:
 switch (PA_delta_t){
 case 0:
 movement = ANTICLOCKWISE;
 break;
 case 3:
 movement = CLOCKWISE;
 break;
 }
 break;
 case 3:
 switch (PA_delta_t){
 case 2:
 movement = ANTICLOCKWISE;
 break;
 case 1:
 movement = CLOCKWISE;
 break;
```

```
 }
 case 4:
 movement = KEYPRESSED;
 break;
 }
}
```

Các điểm vào (entry points) của trình điều khiển (driver) như `read()` và `poll()` hoạt động đồng bộ song song với `roller_interrupt()`. Ví dụ, khi hàm xử lý giải mã được chuyển động của bánh xe, nó sẽ đánh thức bất kỳ luồng (thread) `poll()` đang chờ nào mà trước đó đã chuyển sang trạng thái ngủ (sleep) để phản hồi lại system call `select()` được gọi bởi một ứng dụng như X Windows. Hãy xem lại Liệt kê 4.1 và tiến hành cài đặt hoàn chỉnh trình điều khiển bi lăn sau khi đã tìm hiểu các cơ chế bên trong của trình điều khiển thiết bị ký tự (character drivers) trong Chương 5.

Liệt kê 7.3 (Listing 7.3) ở Chương 7, "Trình điều khiển thiết bị đầu vào" (Input Drivers), tận dụng giao diện *input* của kernel để chuyển đổi bánh xe bi lăn này thành một con chuột bi lăn (roller mouse).

Hãy kết thúc phần này bằng việc giới thiệu một số hàm cho phép (enable) và vô hiệu hóa (disable) ngắt trên một số IRQ cụ thể. `enable_irq(ROLLER_IRQ)` cho phép tạo ra ngắt khi bi lăn chuyển động, trong khi `disable_irq(ROLLER_IRQ)` làm điều ngược lại. `disable_irq_nosync(ROLLER_IRQ)` vô hiệu hóa ngắt của bi lăn nhưng không chờ đợi bất kỳ thực thể (instance) nào đang thực thi của `roller_interrupt()` trả về. Biến thể không đồng bộ (nosync flavor) này của `disable_irq()` chạy nhanh hơn nhưng có khả năng gây ra tình trạng tranh chấp dữ liệu (race condition). Chỉ sử dụng hàm này khi bạn chắc chắn rằng không thể xảy ra tranh chấp. Một ví dụ sử dụng `disable_irq_nosync()` là *drivers/ide/ide-io.c*, nơi chặn các ngắt trong quá trình khởi tạo, bởi vì một số hệ thống gặp sự cố với việc đó.

### Softirq và Tasklet

Như đã thảo luận trước đó, các trình xử lý ngắt (interrupt handler) có hai yêu cầu mâu thuẫn nhau: Chúng chịu trách nhiệm xử lý phần lớn dữ liệu thiết bị, nhưng lại phải thoát ra càng nhanh càng tốt. Để giải quyết tình huống này, các trình xử lý ngắt được thiết kế gồm hai phần: nửa đầu (top half) khẩn trương và bận rộn tương tác với phần cứng, và nửa sau (bottom half) thảnh thơi hơn thực hiện phần lớn việc xử lý khi tất cả các ngắt được bật. Khác với ngắt, các nửa sau (bottom half) mang tính đồng bộ (synchronous) vì kernel quyết định thời điểm thực thi chúng. Các cơ chế sau đây có sẵn trong kernel để hoãn công việc sang nửa sau: softirq, tasklet và work queue.

Softirq là cơ chế nửa sau (bottom half) cơ bản và có các yêu cầu khóa (locking) rất chặt chẽ. Chúng chỉ được sử dụng bởi một vài hệ thống con nhạy cảm về hiệu năng như tầng mạng (networking layer), tầng SCSI và bộ định thời của kernel (kernel timer). Tasklet được xây dựng dựa trên softirq và dễ sử dụng hơn. Bạn nên sử dụng tasklet trừ khi bạn có các yêu cầu cực kỳ quan trọng về khả năng mở rộng (scalability) hoặc tốc độ. Sự khác biệt chính giữa softirq và tasklet là softirq có thể tái nhập (reentrant) trong khi tasklet thì không. Các thể hiện (instance) khác nhau của một softirq có thể chạy đồng thời trên các bộ vi xử lý khác nhau, nhưng điều đó không xảy ra với tasklet.

Để minh họa việc sử dụng softirq và tasklet, giả sử rằng bánh xe lăn trong ví dụ trước gặp các vấn đề vốn có về phần cứng do sự hiện diện của các bộ phận chuyển động (ví dụ: bánh xe đôi khi bị kẹt) dẫn đến việc tạo ra các dạng sóng nằm ngoài thông số kỹ thuật (out-of-spec). Một bánh xe bị kẹt có thể liên tục tạo ra các ngắt giả (spurious interrupt) và có khả năng làm đóng băng hệ thống. Để khắc phục vấn đề này, hãy thu ên sóng, thực hiện một số phân tích trên đó, và chuyển đổi động từ chế độ ngắt sang chế độ thăm dò (polled mode) nếu bánh xe có vẻ bị kẹt, và ngược lại nếu nó đã hết kẹt. Hãy thu dòng sóng từ trình xử lý ngắt và thực hiện phân tích từ nửa sau (bottom half). Liệt kê 4.2 (Listing 4.2) thực hiện việc này bằng cách sử dụng softirq và Liệt kê 4.3 (Listing 4.3) sử dụng tasklet. Cả hai đều là các biến thể đơn giản hóa của Liệt kê 4.1. Điều này thu gọn trình xử lý thành hai hàm: `roller_capture()` lấy một đoạn sóng từ Cổng GPIO D, và `roller_analyze()` thực hiện phân tích thuật toán trên sóng và chuyển sang chế độ thăm dò (polled mode) nếu cần thiết.

**Liệt kê 4.2. Sử dụng Softirq để Giảm tải Công việc từ Trình xử lý Ngắt**

```c
void __init
roller_init()
{
 /* ... */
 /* Mở softirq. Thêm một mục cho ROLLER_SOFT_IRQ vào
 danh sách enum trong include/linux/interrupt.h */
 open_softirq(ROLLER_SOFT_IRQ, roller_analyze, NULL);
}
/* Nửa sau (bottom half) */
void
roller_analyze()
{
 /* Phân tích các dạng sóng và chuyển sang chế độ thăm dò nếu cần */
}
/* Trình xử lý ngắt */
static irqreturn_t
roller_interrupt(int irq, void *dev_id)
{
 /* Thu thập dòng sóng */
 roller_capture();
 /* Đánh dấu softirq là đang chờ xử lý */
 raise_softirq(ROLLER_SOFT_IRQ);
 return IRQ_HANDLED;
}
```

Để định nghĩa một softirq, bạn phải thêm tĩnh một mục vào *include/linux/interrupt.h*. Bạn không thể định nghĩa động nó. `raise_softirq()` thông báo rằng softirq tương ứng đang chờ được thực thi. Kernel sẽ thực thi nó vào cơ hội có sẵn tiếp theo. Điều này có thể xảy ra trong quá trình thoát khỏi trình xử lý ngắt hoặc thông qua tiến trình nhân (kernel thread) *ksoftirqd*.

**Liệt kê 4.3. Sử dụng Tasklet để Giảm tải Công việc từ Trình xử lý Ngắt**

```c
struct roller_device_struct { /* Cấu trúc đặc thù của thiết bị */
 /* ... */
 struct tasklet_struct tsklt;
 /* ... */
}
void __init roller_init()
{
 struct roller_device_struct *dev_struct;
 /* ... */
 /* Khởi tạo tasklet */
 tasklet_init(&dev_struct->tsklt, roller_analyze, dev);
}
/* Nửa sau (bottom half) */
void
roller_analyze()
{
/* Phân tích các dạng sóng và chuyển sang
 chế độ thăm dò nếu cần */
}
/* Trình xử lý ngắt */
static irqreturn_t
roller_interrupt(int irq, void *dev_id)
{
 struct roller_device_struct *dev_struct;
 /* Thu thập dòng sóng */
 roller_capture();
 /* Đánh dấu tasklet là đang chờ xử lý */
 tasklet_schedule(&dev_struct->tsklt);
 return IRQ_HANDLED;
}
```

`tasklet_init()` khởi tạo động một tasklet. Hàm này không cấp phát bộ nhớ cho một `tasklet_struct`, thay vào đó bạn phải truyền địa chỉ của một cấu trúc đã được cấp phát. `tasklet_schedule()` thông báo rằng tasklet tương ứng đang chờ được thực thi. Giống như đối với ngắt, kernel cung cấp một loạt các hàm để kiểm soát trạng thái thực thi của tasklet trên các hệ thống có nhiều bộ vi xử lý:

- `tasklet_enable()` bật các tasklet.
- `tasklet_disable()` tắt các tasklet và đợi cho đến khi bất kỳ thể hiện tasklet nào đang thực thi kết thúc.
- `tasklet_disable_nosync()` có ngữ nghĩa tương tự như `disable_irq_nosync()`. Hàm này không đợi các thể hiện đang hoạt động của tasklet hoàn tất việc thực thi.

Bạn đã thấy sự khác biệt giữa trình xử lý ngắt và nửa sau (bottom half), nhưng cũng có một vài điểm tương đồng. Cả trình xử lý ngắt và tasklet đều không thể tái nhập (reentrant). Và không bên nào trong số chúng có thể đi vào trạng thái ngủ (sleep). Ngoài ra, trình xử lý ngắt, tasklet và softirq không thể bị chiếm quyền (preempt).

Hàng đợi công việc (work queue) là một phương pháp thứ ba để hoãn công việc (defer work) từ các trình xử lý ngắt (interrupt handler). Chúng thực thi trong ngữ cảnh tiến trình (process context) và được phép ngủ (sleep), vì vậy chúng có thể sử dụng các hàm có thể gây ngủ như mutex. Chúng ta đã thảo luận về work queue trong chương trước khi xem xét các tiện ích hỗ trợ khác nhau của kernel. Bảng 4.1 so sánh giữa softirq, tasklet và work queue.

**Bảng 4.1. So sánh Softirqs, Tasklets và Work Queues**

|                      | Softirqs                                                                                                  | Tasklets                                                                                                     | Work Queues                                  |
|----------------------|-----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|----------------------------------------------|
| Ngữ cảnh<br>thực thi | Công việc hoãn lại chạy trong<br>ngữ cảnh ngắt (interrupt context).                                       | Công việc hoãn lại chạy trong<br>ngữ cảnh ngắt (interrupt context).                                          | Công việc hoãn lại chạy trong<br>ngữ cảnh tiến trình (process context). |
| Tính tái nhập<br>(Reentrancy) | Có thể chạy đồng thời<br>trên các CPU khác nhau.                                                          | Không thể chạy đồng thời<br>trên các CPU khác nhau. Tuy nhiên,<br>các CPU khác nhau có thể chạy<br>các tasklet khác nhau. | Có thể chạy đồng thời<br>trên các CPU khác nhau. |
| Ngữ nghĩa<br>ngủ     | Không thể đi vào trạng thái ngủ (sleep).                                                                  | Không thể đi vào trạng thái ngủ (sleep).                                                                     | Có thể đi vào trạng thái ngủ (sleep).        |
| Khả năng<br>tiếm quyền | Không thể bị<br>tiếm quyền/lên lịch (preempted/scheduled).                                               | Không thể bị<br>tiếm quyền/lên lịch (preempted/scheduled).                                                   | Có thể bị<br>tiếm quyền/lên lịch (preempted/scheduled). |
| Tính dễ sử dụng      | Không dễ sử dụng.                                                                                         | Dễ sử dụng.                                                                                                  | Dễ sử dụng.                                  |
| Khi nào nên dùng     | Nếu công việc hoãn lại sẽ không<br>ngủ và bạn có các yêu cầu<br>tối quan trọng về khả năng mở rộng<br>hoặc tốc độ. | Nếu công việc hoãn lại sẽ không<br>ngủ.                                                                      | Nếu công việc hoãn lại có thể ngủ.           |

Đang có một cuộc tranh luận diễn ra trên LKML (Linux Kernel Mailing List) về tính khả thi của việc loại bỏ giao diện tasklet. Tasklet có mức độ ưu tiên cao hơn mã ngữ cảnh tiến trình, do đó chúng gây ra các vấn đề về độ trễ (latency). Hơn nữa, như bạn đã tìm hiểu, chúng bị ràng buộc là không được phép ngủ và phải thực thi trên cùng một CPU. Người ta đang đề xuất chuyển đổi tất cả các tasklet hiện có thành softirq hoặc work queue tùy theo từng trường hợp cụ thể.

Bộ bản vá `-rt` được nhắc đến trong Chương 2 chuyển việc xử lý ngắt sang các tiến trình luồng kernel (kernel thread) để đạt được phạm vi bao phủ chiếm quyền (preemption) rộng hơn.

## Mô hình thiết bị Linux (The Linux Device Model)

Mô hình thiết bị Linux mới giới thiệu các sự trừu tượng hóa mang tính chất giống như C++ nhằm tách biệt các điểm chung từ các trình điều khiển thiết bị (device driver) ra các tầng bus và tầng lõi (core layer). Hãy cùng xem xét các thành phần khác nhau cấu thành nên mô hình thiết bị như *udev*, *sysfs*, *kobjects*, và *device classes*, cũng như ảnh hưởng của chúng đối với các hệ thống con (subsystem) quan trọng của kernel như quản lý nút */dev* (*node management*), cắm nóng (*hotplug*), tải firmware (*firmware download*), và tự động nạp module (*module autoload*). *Udev* là góc nhìn thuận lợi nhất để thấy rõ các lợi ích của mô hình thiết bị, vì vậy hãy bắt đầu từ đó.

### Udev

Nhiều năm trước, khi Linux còn ở giai đoạn đầu, việc quản lý các nút thiết bị (device node) không hề dễ chịu chút nào. Tất cả các nút cần thiết (có thể lên tới hàng nghìn) phải được tạo một cách tĩnh (statically created) bên dưới thư mục */dev*. Trên thực tế, vấn đề này đã có từ thời các hệ thống UNIX ban đầu. Với sự xuất hiện của kernel phiên bản 2.4, *devfs* ra đời, mang lại cơ chế tạo nút thiết bị động (dynamic device node creation). Devfs cung cấp các dịch vụ để tạo nút thiết bị trong một hệ thống tập tin trên bộ nhớ (in-memory filesystem), nhưng gánh nặng đặt tên cho các nút thì vẫn thuộc về các trình điều khiển thiết bị (device driver). Tuy nhiên, chính sách đặt tên thiết bị mang tính chất quản trị (administrative) và không phù hợp khi được tích hợp vào kernel. Nơi thích hợp cho các chính sách này là các tệp tiêu đề (header file), tham số mô-đun kernel (kernel module parameter), hoặc không gian người dùng (user space). Udev xuất hiện để đẩy việc quản lý thiết bị ra ngoài user space.

Udev phụ thuộc vào các yếu tố sau để thực hiện công việc của mình:

- Hỗ trợ *sysfs* từ kernel, đây là một phần quan trọng của mô hình thiết bị Linux (Linux device model). Sysfs là một hệ thống tập tin trên bộ nhớ được gắn (mount) bên dưới */sys* tại thời điểm khởi động (xem */etc/fstab* để biết thông số cụ thể). Chúng ta sẽ tìm hiểu về sysfs trong phần tiếp theo, nhưng hiện tại, hãy mặc định rằng các thao tác truy cập tệp sysfs tương ứng là hoạt động bình thường. **1.**
- **2.** Một tập hợp các tiến ngầm (daemon) và tiện ích ở user space như *udevd* và *udevinfo*.
- Các quy tắc do người dùng chỉ định nằm trong thư mục */etc/udev/rules.d/*. Bạn có thể thiết lập các quy tắc để có một góc nhìn nhất quán về các thiết bị của mình. **3.**

Để hiểu cách sử dụng udev, hãy xem xét một ví dụ. Giả sử bạn có một ổ DVD USB và một ổ CD-RW USB. Tùy thuộc vào thứ tự bạn cắm nóng (hotplug) các thiết bị này, một trong số chúng sẽ được gán tên */dev/sr0* và thiết bị còn lại nhận tên */dev/sr1*. Vào những ngày trước khi có udev, bạn phải tự tìm ra các tên liên kết trước khi có thể sử dụng thiết bị. Nhưng với udev, bạn có thể nhìn nhận ổ DVD một cách nhất quán (ví dụ: */dev/usbdvd*) và ổ CD-RW (ví dụ: */dev/usbcdrw*) bất kể thứ tự cắm vào hay rút ra của chúng.

Đầu tiên, hãy trích xuất các thuộc tính sản phẩm từ các tệp tương ứng trong sysfs. Giả sử ổ DVD (của Targus) được gán nút thiết bị */dev/sr0* và ổ CD-RW (của Addonics) được đặt tên là */dev/sr1*. Sử dụng udevinfo để thu thập thông tin thiết bị:

```
bash> udevinfo -a -p /sys/block/sr0
...
looking at the device chain at
'/sys/devices/pci0000:00/0000:00:1d.7/usb1/1-4':
 BUS=»usb»
 ID=»1-4»
 SYSFS{bConfigurationValue}=»1»
 ...
```

```
 SYSFS{idProduct}=»0701»
 SYSFS{idVendor}=»05e3»
 SYSFS{manufacturer}=»Genesyslogic»
 SYSFS{maxchild}=»0»
 SYSFS{product}=»USB Mass Storage Device»
 ...
bash> udevinfo -a -p /sys/block/sr1
 ...
 looking at the device chain at
 '/sys/devices/pci0000:00/0000:00:1d.7/usb1/1-3':
 BUS=»usb»
 ID=»1-3»
 SYSFS{bConfigurationValue}=»2»
 ...
 SYSFS{idProduct}=»0302»
 SYSFS{idVendor}=»0dbf»
 SYSFS{manufacturer}=»Addonics»
 SYSFS{maxchild}=»0»
 SYSFS{product}=»USB to IDE Cable»
 ...
```

Tiếp theo, hãy sử dụng thông tin sản phẩm vừa thu thập được để nhận diện thiết bị và thêm các quy tắc đặt tên của udev. Tạo một tệp có tên */etc/udev/rules.d/40-cdvd.rules* và thêm các quy tắc sau vào tệp đó:

```
BUS="usb", SYSFS{idProduct}="0701", SYSFS{idVendor}="05e3",
KERNEL="sr[0-9]*", NAME="%k", SYMLINK="usbdvd"
BUS="usb", SYSFS{idProduct}="0302", SYSFS{idVendor}="0dbf",
KERNEL="sr[0-9]*", NAME="%k", SYMLINK="usbcdrw"
```

Quy tắc đầu tiên thông báo cho udev rằng bất cứ khi nào nó tìm thấy một thiết bị USB có ID sản phẩm là 0x0701, ID nhà sản xuất là 0x05e3 và tên bắt đầu bằng *sr*, nó nên tạo một nút có cùng tên bên dưới */dev* và tạo một liên kết tượng trưng (symbolic link) có tên *usbdvd* trỏ đến nút vừa được tạo. Tương tự, quy tắc thứ hai ra lệnh tạo một liên kết tượng trưng có tên *usbcdrw* cho ổ CD-RW.

Để kiểm tra lỗi cú pháp trong các quy tắc của bạn, hãy chạy udevtest trên */sys/block/sr\**. Để bật các thông báo chi tiết (verbose messages) trong */var/log/messages*, hãy đặt udev\_log thành "yes" trong */etc/udev/udev.conf*. Để cập nhật lại thư mục */dev* với các quy tắc mới được thêm vào một cách tức thời (on-the-fly), hãy khởi động lại udev bằng cách sử dụng udevstart. Khi hoàn tất, ổ DVD của bạn sẽ luôn hiển thị nhất quán đối với hệ thống dưới dạng */dev/usbdvd*, và ổ CD-RW của bạn sẽ luôn hiển thị dưới dạng */dev/usbcdrw*. Bạn có thể gắn kết (mount) chúng một cách có tính toán từ các tập lệnh shell (shell script) bằng các lệnh như sau:

```
mount /dev/usbdvd /mnt/dvd
```

Việc đặt tên nhất quán cho các nút thiết bị (và giao diện mạng) không phải là khả năng duy nhất của udev. Nó cũng đã chuyển hóa thành trình quản lý cắm nóng (hotplug manager) của Linux. Udev cũng chịu trách nhiệm tự động tải các mô-đun theo yêu cầu (on demand) và tải xuống vi mã (microcode) vào các thiết bị cần chúng. Nhưng trước khi đào sâu vào các khả năng đó, hãy cùng nắm vững những hiểu biết cơ bản về bên trong của mô hình thiết bị (device model).

**Sysfs, Kobjects và Device Classes**

Sysfs, kobjects và device classes là các khối xây dựng (building block) của mô hình thiết bị nhưng chúng khá "kín tiếng" và thích ở phía sau hậu trường. Chúng chủ yếu nằm trong phạm vi sử dụng của các tầng thực thi bus và core, đồng thời ẩn mình bên trong các API cung cấp dịch vụ cho các trình điều khiển thiết bị.

Sysfs là sự thể hiện ở không gian người dùng (user-space) của mô hình thiết bị (device model) có cấu trúc trong kernel. Nó tương tự như procfs ở chỗ cả hai đều là các hệ thống tệp trong bộ nhớ (in-memory filesystem) chứa thông tin về các cấu trúc dữ liệu của kernel (kernel data structures). Trong khi procfs là một cửa sổ tổng quát để nhìn vào bên trong kernel (kernel internals), thì sysfs lại dành riêng cho mô hình thiết bị. Do đó, sysfs không phải là sự thay thế cho procfs. Các thông tin như bộ mô tả tiến trình (process descriptors) và tham số sysctl thuộc về procfs chứ không phải sysfs. Như sẽ sớm thấy rõ, udev phụ thuộc vào sysfs cho hầu hết các chức năng mở rộng của nó.

Kobjects giới thiệu sự đóng gói các thuộc tính đối tượng chung như bộ đếm tham chiếu sử dụng (usage reference counts). Chúng thường được nhúng bên trong các cấu trúc lớn hơn. Dưới đây là các trường chính của một kobject, được định nghĩa trong *include/linux/kobject.h*:

Một đối tượng *kref* thực hiện quản lý bộ đếm tham chiếu (reference count management). Giao diện `kref_init()` khởi tạo một kref, `kref_get()` tăng bộ đếm tham chiếu liên quan đến kref đó, và `kref_put()` giảm bộ đếm tham chiếu và giải phóng đối tượng nếu không còn tham chiếu nào. Cấu trúc URB (được giải thích trong Chương 11, "Universal Serial Bus"), chẳng hạn, chứa một kref để theo dõi số lượng tham chiếu đến nó.[2] **1.**

```
[2] Giao diện usb_alloc_urb() gọi kref_init(), usb_submit_urb() gọi kref_get(), và usb_free_urb() gọi
kref_put().
```

- **2.** Con trỏ trỏ tới một *kset*, là một tập hợp đối tượng (object set) mà kobject đó thuộc về.
- **3.** Một *kobj_type*, là một kiểu đối tượng (object type) mô tả kobject.

Kobjects gắn liền với sysfs. Mọi kobject được khởi tạo (instantiated) bên trong kernel đều có một bản thể hiện (representation) trong sysfs.

Khái niệm về các lớp thiết bị (device classes) là một tính năng khác của mô hình thiết bị và là một giao diện mà bạn có nhiều khả năng sử dụng hơn trong một trình điều khiển (driver). Giao diện class mang lại sự trừu tượng hóa cho ý tưởng rằng mỗi thiết bị thuộc về một lớp (hoặc danh mục) thiết bị rộng hơn. Một con chuột USB, một bàn phím PS/2 và một cần điều khiển (joystick) đều thuộc lớp *input* và sở hữu các mục nhập (entries) dưới thư mục */sys/class/input/*.

Hình 4.4 hiển thị hệ thống phân cấp sysfs trên một máy tính xách tay (laptop) có kết nối một con chuột USB ngoài. Các thư mục cấp cao nhất *bus*, *class* và *device* được mở rộng để cho thấy sysfs cung cấp một góc nhìn về con chuột USB dựa trên loại thiết bị cũng như kết nối vật lý của nó. Con chuột là một thiết bị lớp input nhưng về mặt vật lý là một thiết bị USB phản hồi hai địa chỉ điểm cuối (endpoint addresses), một điểm cuối điều khiển *ep00* và một điểm cuối ngắt *ep81*. Cổng USB đang xét thuộc về bộ điều khiển máy chủ USB (USB host controller) trên bus 2, và bản thân bộ điều khiển máy chủ USB này được bắc cầu (bridged) tới CPU thông qua bus PCI. Nếu những chi tiết này chưa rõ ràng ở thời điểm hiện tại, đừng lo lắng; hãy quay lại phần này sau khi đọc các chương hướng dẫn về trình điều khiển input (Chương 7), trình điều khiển PCI (Chương 10, "Peripheral Component Interconnect"), và trình điều khiển USB (Chương 11).

**Hình 4.4. Hệ thống phân cấp sysfs của một con chuột USB.**

```
[/sys]
 +[block]
 -[bus]—[usb]—[devices]—[usb2]—[2-2]—[2-2:1.0]-[usbendpoint:usbdev2.2-ep81]
 -[class]-[input]—[mouse2]—[device]—[bus]—[usbendpoint:usbdev2.2-ep81]
 -[usb_device]—[usbdev2.2]—[device]—[bus]
 -[usb_endpoint]—[usbdev2.2-ep00]—[device]
 —[usbdev2.2-ep81]—[device]
 -[devices]—[pci0000:00]—[0000:00:1d:1]—[usb2]—[2-2]—[2-2:1.0]
 +[firmware]
 +[fs]
 +[kernel]
 +[module]
 +[power]
```

Hãy duyệt qua */sys* để tìm các mục nhập liên kết với một thiết bị khác (ví dụ: thẻ mạng của bạn) nhằm hiểu rõ hơn về tổ chức phân cấp của nó. Mục "Addressing and Identification" trong Chương 10 minh họa cách sysfs phản ánh kết nối vật lý của một thẻ CardBus Ethernet-Modem trên một máy tính xách tay.

Giao diện lập trình class được xây dựng dựa trên kobjects và sysfs, vì vậy đây là một nơi tốt để bắt đầu tìm hiểu sâu nhằm nắm bắt các tương tác toàn diện (end-to-end interactions) giữa các thành phần của mô hình thiết bị. Hãy chuyển sang trình điều khiển RTC để lấy ví dụ. Trình điều khiển RTC (*drivers/char/rtc.c*) là một trình điều khiển tạp nham (miscellaneous - hoặc gọi tắt là "misc"). Chúng ta sẽ thảo luận chi tiết về các trình điều khiển misc khi xem xét các trình điều khiển thiết bị ký tự (character device drivers) trong Chương 5.

Chèn mô-đun trình điều khiển RTC vào và xem xét các nút được tạo dưới */sys* và */dev:*

```
bash> modprobe rtc
bash> ls -lR /sys/class/misc
drwr-xr-x 2 root root 0 Jan 15 01:23 rtc
/sys/class/misc/rtc:
total 0
-r--r--r-- 1 root root 4096 Jan 15 01:23 dev
--w------- 1 root root 4096 Jan 15 01:23 uevent
bash> ls -l /dev/rtc
crw-r--r-- 1 root root 10, 135 Jan 15 01:23 /dev/rtc
```

*/sys/class/misc/rtc/dev* chứa số chính và số phụ (major and minor numbers - được thảo luận trong chương tiếp theo) được gán cho thiết bị này, */sys/class/misc/rtc/uevent* được sử dụng cho việc cắm thiết bị lạnh - coldplugging (được thảo luận trong phần tiếp theo), và */dev/rtc* được các ứng dụng sử dụng để truy cập trình điều khiển RTC.

Hãy tìm hiểu luồng mã nguồn (code flow) thông qua mô hình thiết bị. Các trình điều khiển misc tận dụng các dịch vụ của `misc_register()` trong quá trình khởi tạo, trông sẽ như thế này nếu bạn lược bỏ bớt một phần mã nguồn:

```c
/* ... */
dev = MKDEV(MISC_MAJOR, misc->minor);
misc->class = class_device_create(misc_class, NULL, dev,
 misc->dev,
 "%s", misc->name);
if (IS_ERR(misc->class)) {
 err = PTR_ERR(misc->class);
 goto out;
```

```
}
/* ... */
```

Hình 4.5 tiếp tục bóc tách thêm các lớp để đi sâu vào bản chất của mô hình thiết bị (device modeling). Hình này minh họa các quá trình chuyển đổi lan truyền qua các lớp (classes), `kobject`, `sysfs` và `udev`, dẫn đến việc tạo ra các tệp trong */sys* và */dev* đã được liệt kê trước đó.

```
User Space                     Kernel Space
-----------                    -------------------------------

modprobe rtc  ---------------->  rtc_init()
                                   |
                                   v
                           misc_register(&rtc_dev)
                                   |
                                   v
                           class_device_register()
                                   |
        -----------------------------------------------------------------------------
        |                         |                  |                              |
        v                         |                  v                              v
   kobject_add()                  |      class_device_add_attrs()        kobject_uevent(KOBJ_ADD)
        |                         |                  |                             |
        v                         v                  |                             v
sysfs_create_dir()   class_device_create_file()      |                     kobject_uevent_env()
        |                         |                  v                             |
        v                         v        class_device_create_file()              v
/sys/class/misc/rtc/      sysfs_create_file()        |                     udevd receives the uevent via 
                                |                    |                     netlink sockets and creates /dev
                                v                    v                     nodes after consulting its rules
                   /sys/class/misc/rtc/uevent    sysfs_create_file()       database
                                                         |                         |
                                                         v                         v
                                             /sys/class/misc/rtc/dev             /dev/rtc
```

**Hình 4.5. Kết nối các thành phần của mô hình thiết bị (device model).**

Hãy xem xét trình điều khiển (driver) LED cổng song song (Liệt kê 5.6 trong phần "Giao tiếp với cổng song song" ở Chương 5) và trình điều khiển đầu vào chuột ảo (Liệt kê 7.2 trong phần "Ví dụ về thiết bị: Chuột ảo" ở Chương 7) để tìm các ví dụ về cách tạo tệp điều khiển thiết bị bên trong `sysfs`.

Một lớp trừu tượng (abstraction) khác là một phần của mô hình thiết bị (device model) chính là giao diện lập trình *bus-device-driver* (bus-thiết bị-trình điều khiển). Hỗ trợ thiết bị trong Kernel được cấu trúc rõ ràng thành các bus, thiết bị và trình điều khiển. Điều này giúp cho việc cài đặt từng trình điều khiển riêng lẻ trở nên đơn giản và tổng quát hơn. Ví dụ, các cài đặt *Bus* có thể tìm kiếm các trình điều khiển có khả năng xử lý một thiết bị cụ thể.

Hãy xem xét hệ thống con I2C của Kernel (được khám phá trong Chương 8, "Giao thức Inter-Integrated Circuit"). Tầng I2C bao gồm cơ sở hạ tầng cốt lõi (core infrastructure), các trình điều khiển thiết bị cho bộ điều адаптер bus (bus adapters) và các trình điều khiển cho thiết bị khách (client devices). Tầng cốt lõi I2C

đăng ký từng bộ điều hợp bus I2C được phát hiện bằng cách sử dụng `bus_register()`. Khi một thiết bị khách I2C (ví dụ: một chip *Electrically Erasable Programmable Read-Only Memory* [EEPROM]) được thăm dò (probed) và phát hiện, sự tồn tại của nó sẽ được ghi lại thông qua `device_register()`. Cuối cùng, trình điều khiển khách I2C EEPROM tự đăng ký bằng cách sử dụng `driver_register()`. Các thao tác đăng ký này được thực hiện một cách gián tiếp thông qua các hàm dịch vụ do phần lõi I2C cung cấp.

`bus_register()` thêm một mục tương ứng vào */sys/bus/*, trong khi `device_register()` thêm các mục dưới */sys/devices/*. `struct bus_type`, `struct device`, và `struct device_driver` là các cấu trúc dữ liệu chính được sử dụng tương ứng bởi các bus, thiết bị và trình điều khiển. Hãy xem qua tệp *include/linux/device.h* để biết định nghĩa của chúng.

```

## Hotplug và Coldplug

Các thiết bị được kết nối vào hệ thống đang chạy một cách tức thời được gọi là *hotplugged* (cắm nóng), trong khi những thiết bị được kết nối trước khi khởi động hệ thống được coi là *coldplugged* (cắm nguội). Trước đây, kernel (nhân) thường thông báo cho user space (vùng người dùng) về các sự kiện hotplug bằng cách gọi một chương trình trợ giúp (helper program) được đăng ký thông qua hệ thống tệp */proc*. Nhưng khi các kernel hiện đại phát hiện hotplug, chúng sẽ gửi các uevent đến user space thông qua netlink socket. Netlink socket là một cơ chế hiệu quả để giao tiếp giữa kernel space (vùng nhân) và user space sử dụng các API socket. Ở phía user space, udevd — tiến ngầm (daemon) quản lý việc tạo và xóa device node (nút thiết bị) — sẽ nhận các uevent và quản lý hotplug.

Để thấy cách việc xử lý hotplug đã tiến hóa gần đây như thế nào, hãy xem xét các cấp độ tiến triển của udev chạy các phiên bản khác nhau của dòng kernel 2.6:

Với gói *udev-039* và kernel 2.6.9, khi kernel phát hiện một sự kiện hotplug, nó sẽ gọi chương trình trợ giúp user space được đăng ký với */proc/sys/kernel/hotplug*. Mặc định chương trình này là */sbin/hotplug*, nó nhận các thuộc tính của thiết bị hotplug trong môi trường của nó. */sbin/hotplug* tìm bên trong thư mục cấu hình hotplug (thường là */etc/hotplug.d/default/*) và chạy, ví dụ, */etc/hotplug.d/default/10-udev.hotplug*, sau khi thực thi các script khác dưới */etc/hotplug/*. **1.**

```

bash> ls -l /etc/hotplug.d/default/
...
lrwcrwxrwx 1 root root 14 May 11 2005 10-udev.hotplug -> /sbin/udevsend
...

```

Khi */sbin/udevsend* được thực thi như vậy, nó chuyển thông tin thiết bị hotplug sang udevd.

Với udev-058 và kernel 2.6.11, câu chuyện thay đổi đôi chút. Tiện ích udevsend thay thế */sbin/hotplug*: **2.**

```

bash> cat /proc/sys/kernel/hotplug
/sbin/udevsend

```

Với các phiên bản udev và kernel mới nhất, udevd đảm nhận toàn bộ trách nhiệm quản lý hotplug mà không phụ thuộc vào udevsend. Giờ đây, nó lấy các sự kiện hotplug trực tiếp từ kernel thông qua netlink socket (xem Hình 4.4). */proc/sys/kernel/hotplug* không chứa gì cả: **3.**

```

bash> cat /proc/sys/kernel/hotplug
bash>

```

Udev cũng xử lý coldplug. Bởi vì udev là một phần của user space và chỉ được khởi động sau khi kernel boot (khởi động), một cơ chế đặc biệt là cần thiết để giả lập các sự kiện hotplug trên các thiết bị coldplug. Tại thời điểm boot, kernel tạo một tệp có tên là *uevent* dưới sysfs cho tất cả các thiết bị và phát ra các sự kiện coldplug đến các tệp đó. Khi udev khởi động, nó đọc tất cả các tệp *uevent* từ */sys* và tạo ra các uevent hotplug cho mỗi thiết bị coldplug.

#### Tải vi mã (Microcode Download)

Bạn phải cung cấp microcode cho một số thiết bị trước khi chúng có thể sẵn sàng hoạt động. Microcode được thực thi bởi một vi điều khiển (microcontroller) trên card. Các device driver (trình điều khiển thiết bị) trước đây thường lưu trữ microcode bên trong các mảng tĩnh (static array) trong các tệp header. Nhưng điều này đã trở nên không khả thi vì microcode thường được phân phối dưới dạng ảnh nhị phân độc quyền (proprietary binary image) bởi các nhà vendor thiết bị, và điều đó không hòa hợp đồng nhất với kernel mang giấy phép GPL. Một lý do khác chống lại việc trộn firmware với mã nguồn kernel là chúng chạy trên các mốc thời gian phát hành khác nhau. Giải pháp rõ ràng là duy trì microcode một cách riêng biệt ở user space và chuyển nó xuống kernel khi cần thiết. Sysfs và udev cung cấp một cơ sở hạ tầng để đạt được điều này.

Hãy lấy ví dụ về card Intel PRO/Wireless 2100 WiFi mini PCI được tìm thấy trên một số máy tính xách tay. Card được xây dựng xung quanh một vi điều khiển cần thực thi microcode được cung cấp từ bên ngoài để hoạt động bình thường. Hãy cùng đi qua các bước mà driver Linux thực hiện để tải microcode xuống card. Giả sử rằng bạn đã lấy được tệp ảnh microcode cần thiết (*ipw2100-1.3.fw*) từ <http://ipw2100.sourceforge.net/firmware.php> và lưu nó dưới thư mục */lib/firmware/* trên hệ thống của bạn, và bạn đã nạp module driver *ipw2100.ko*:

**1.** Trong quá trình khởi tạo (initialization), driver gọi hàm sau:

```

request_firmware(..,"ipw2100-1.3.fw",..);

```

- **2.** Thao tác này gửi một uevent hotplug đến user space, cùng với định danh của tệp ảnh microcode được yêu cầu.
- **3.** Udevd nhận được uevent và phản hồi bằng cách gọi */sbin/firmware_helper*. Để làm điều này, nó sử dụng một quy tắc (rule) tương tự như quy tắc sau từ một tệp nằm dưới */etc/udev/rules.d/*:

```

ACTION=="add", SUBSYSTEM=="firmware", RUN="/sbin/firmware_helper"

```

- **4.** */sbin/firmware_helper* tìm kiếm bên trong */lib/firmware/* và định vị tệp ảnh microcode được yêu cầu *ipw2100-1.3.fw*. Nó đổ (dump) tệp ảnh vào */sys/class/0000:02:02.0/data*. (0000:02:02 là định danh PCI *bus:device:function* của card WiFi trong trường hợp này).
- **5.** Driver nhận được microcode và tải nó xuống thiết bị. Khi hoàn tất, nó gọi hàm `release_firmware()` để giải phóng các cấu trúc dữ liệu tương ứng.
- **6.** Driver tiếp tục phần còn lại của quá trình khởi tạo và bộ điều hợp WiFi bắt đầu phát tín hiệu (beacon).

## Tự động tải Module (Module Autoload)

Tự động tải các kernel module (module nhân) theo nhu cầu là một tính năng tiện lợi mà Linux hỗ trợ. Để hiểu cách kernel phát ra "lỗi module" (module fault) và cách udev xử lý nó, hãy cắm một bộ chuyển đổi Xircom CardBus Ethernet vào khe cắm PC Card của máy tính xách tay:

**1.** Trong quá trình biên dịch (compile time), danh tính của các thiết bị được hỗ trợ sẽ được tạo ra như một phần của đối tượng driver module. Hãy xem xét driver hỗ trợ card kết hợp Xircom CardBus Ethernet (*drivers/net/tulip/xircom\_cb.c*) và tìm đoạn mã sau:

```c

static struct pci_device_id xircom_pci_table[] = {
{0x115D, 0x0003, PCI_ANY_ID, PCI_ANY_ID,},
{0,},
};
/* Mark the device table */
MODULE_DEVICE_TABLE(pci, xircom_pci_table);

```

Điều này khai báo rằng driver có thể hỗ trợ bất kỳ card nào có PCI vendor ID là 0x115D và PCI device ID là 0x0003 (thêm chi tiết về điều này ở Chương 10). Khi bạn cài đặt driver module, tiện ích `depmod` sẽ kiểm tra bên trong hình ảnh module (module image) và giải mã các ID có trong bảng thiết bị (device table). Sau đó, nó thêm mục nhập sau vào */lib/modules/kernel-version/modules.alias*:

```

alias pci:v0000115Dd00000003sv*sd*bc*sc*i* xircom_cb

```

trong đó `v` là viết tắt của VendorID (ID nhà cung cấp), `d` là DeviceID (ID thiết bị), `sv` là subvendorID, và `*` là khớp ký tự đại diện (wildcard match).

**2.** Khi bạn cắm nóng (hotplug) card Xircom vào khe cắm CardBus, kernel tạo ra một uevent thông báo danh tính của thiết bị vừa được cắm vào. Bạn có thể xem uevent được tạo ra bằng cách sử dụng `udevmonitor`:

```bash

bash> udevmonitor --env
...
MODALIAS=pci:v0000115Dd00000003sv0000115Dsd00001181bc02sc00i00
...

```

**3.** `udevd` nhận uevent thông qua một netlink socket và gọi `modprobe` với MODALIAS ở trên mà kernel đã chuyển lên cho nó:

```bash

modprobe pci:v0000115Dd00000003sv0000115Dsd00001181bc02sc00i00

```

**4.** `modprobe` tìm mục nhập khớp trong */lib/modules/kernel-version/modules.alias* được tạo ra trong Bước 1, và tiến hành nạp *xircom\_cb*:

### **bash> lsmod** Module Size Used by xircom\_cb 10433 0 ...

Card bây giờ đã sẵn sàng để sử dụng.

Bạn có thể muốn xem lại phần này sau khi đọc Chương 10.

### Udev trên Thiết bị Nhúng (Embedded Devices)

Một luồng quan điểm phản đối việc sử dụng `udev` để chuyển sang dùng các nút thiết bị (device node) được tạo sẵn tĩnh trên các thiết bị nhúng vì các lý do sau:

- `udev` tạo ra các nút */dev* trong mỗi lần khởi động lại (reboot), so với các nút tĩnh chỉ được tạo một lần trong quá trình cài đặt phần mềm. Nếu thiết bị nhúng của bạn sử dụng bộ nhớ flash, các trang flash (flash page) chứa các nút */dev* sẽ phải chịu một chu kỳ xóa-ghi (erase-write cycle) trong mỗi lần khởi động ở trường hợp đầu, và điều này làm giảm tuổi thọ của bộ nhớ flash. (Bộ nhớ flash được thảo luận chi tiết trong Chương 17, "Memory Technology Devices".) Tuy nhiên, bạn có tùy chọn gắn kết (mount) */dev* trên một hệ thống tập tin dựa trên RAM (RAM-based filesystem).
- `udev` góp phần làm tăng thời gian khởi động (boot time).
- Các tính năng của `udev` như việc tạo động (dynamic creation) các nút */dev* và tự động tải module tạo ra một mức độ bất định (indeterminism) mà một số nhà thiết kế giải pháp thích tránh trên các thiết bị nhúng chuyên dụng, đặc biệt là những thiết bị không tương tác với thế giới bên ngoài thông qua các bus cắm nóng (hotpluggable bus). Theo quan điểm này, việc tạo nút tĩnh và nạp mọi module tại thời điểm khởi động (boot-time) mang lại khả năng kiểm soát hệ thống tốt hơn và giúp việc kiểm thử trở nên dễ dàng hơn.

## Hàng rào Bộ nhớ (Memory Barriers)

Nhiều bộ vi xử lý và trình biên dịch sắp xếp lại thứ tự các lệnh để đạt được tốc độ thực thi tối ưu. Việc sắp xếp lại được thực hiện sao cho luồng lệnh mới có ý nghĩa tương đương với luồng ban đầu. Tuy nhiên, nếu bạn đang, ví dụ, ghi vào các thanh ghi được ánh xạ bộ nhớ (memory-mapped register) trên một thiết bị I/O, việc sắp xếp lại lệnh có thể tạo ra các hiệu ứng phụ không mong muốn. Để ngăn bộ xử lý sắp xếp lại các lệnh, bạn có thể chèn một hàng rào (barrier) vào mã nguồn của mình. Hàm `wmb()` chèn một chốt chặn ngăn các lệnh ghi vượt qua nó, `rmb()` cung cấp một hàng rào đọc không cho phép các lệnh đọc vượt qua nó, và `mb()` tạo ra một hàng rào đọc-ghi (read-write barrier).

Ngoài các tương tác giữa CPU và phần cứng được đề cập trước đó, các hàng rào bộ nhớ cũng có liên quan đến các tương tác giữa CPU với CPU trên hệ thống SMP (Symmetric Multiprocessing). Nếu bộ nhớ cache dữ liệu của CPU đang hoạt động ở chế độ ghi lại (write-back mode — trong đó dữ liệu không được sao chép từ cache vào bộ nhớ cho đến khi thực sự cần thiết), bạn có thể muốn tạm dừng luồng lệnh cho đến khi hàng đợi từ cache đến bộ nhớ được xả sạch. Điều này có liên quan, ví dụ, khi bạn gặp các lệnh thu giữ (acquire) hoặc giải phóng (release) khóa (lock). Các hàng rào được sử dụng trong kịch bản này để đạt được một góc nhìn nhất quán giữa các CPU.

Chúng ta sẽ quay lại chủ đề hàng rào bộ nhớ khi thảo luận về PCI driver trong Chương 10 và flash map driver trong Chương 17. Trong thời gian chờ đợi, hãy ghé qua tài liệu *Documentation/memory-barriers.txt* để có giải thích chi tiết về các loại hàng rào bộ nhớ khác nhau.

## Quản lý Nguồn điện (Power Management)

Quản lý nguồn điện là cực kỳ quan trọng đối với các thiết bị chạy bằng pin, chẳng hạn như máy tính xách tay và thiết bị cầm tay. Các Linux driver cần phải nhận thức được các trạng thái nguồn điện (power state) và phải chuyển đổi giữa các trạng thái để phản hồi lại các sự kiện như *chờ (standby), ngủ (sleep)*, và *pin yếu (low battery)*. Các driver tận dụng các tính năng tiết kiệm năng lượng được hỗ trợ bởi phần cứng bên dưới khi chúng chuyển sang các chế độ tiêu thụ ít điện năng hơn. Ví dụ, driver lưu trữ (storage driver) làm quay chậm đĩa (spin down), trong khi driver video làm trống màn hình (blank the display).

Mã nguồn tối ưu hóa năng lượng (power-aware code) trong các trình điều khiển thiết bị (device drivers) chỉ là một mảnh ghép trong tổng thể khung quản lý nguồn (power management framework). Quản lý nguồn (Power Management) cũng có sự tham gia từ các tiến hiệu nền (daemon) ở không gian người dùng (User Space), các tiện ích (utilities), tệp cấu hình (configuration files) và firmware khởi động (boot firmware). Hai cơ chế quản lý nguồn phổ biến là APM (được thảo luận trong phần "Protected Mode Calls" tại Phụ lục B, "Linux and the BIOS") và *Giao diện Cấu hình và Năng lượng Nâng cao* (*Advanced Configuration and Power Interface* - ACPI). APM đang dần lỗi thời, trong khi ACPI đã nổi lên thành chiến lược quản lý nguồn mặc định (de facto) trên các hệ thống Linux. ACPI được thảo luận chi tiết hơn trong Chương 20, "More Devices and Drivers."

## Khám phá Mã nguồn

Mã xử lý ngắt (interrupt handling) cốt lõi mang tính tổng quát và nằm trong thư mục *kernel/irq/*. Các phần phụ thuộc kiến trúc (architecture-specific portions) có thể được tìm thấy trong *arch/your-arch/kernel/irq.c*. Hàm do\_IRQ() được định nghĩa trong tệp này là một điểm khởi đầu tốt để bạn bắt đầu tìm hiểu về cơ chế xử lý ngắt của kernel (kernel interrupt handling mechanism).

Các phần cài đặt softirq và tasklet của kernel nằm trong *kernel/softirq.c*. Tệp này cũng chứa các hàm bổ sung cung cấp khả năng điều khiển chi tiết (fine-grained control) hơn đối với softirq và tasklet. Hãy xem *include/linux/interrupt.h* để biết các phép liệt kê vector softirq (softirq vector enumerations) và các nguyên mẫu (prototypes) cần thiết để triển khai trình xử lý ngắt (interrupt handler) của bạn. Đối với một ví dụ thực tế về việc viết trình xử lý ngắt và nửa dưới (bottom halves), hãy bắt đầu từ trình xử lý là một phần của *drivers/net/lib8390.c* và theo dõi luồng thực thi đi vào ngăn xếp mạng (networking stack).

Phần cài đặt kobject và các giao diện lập trình liên quan nằm trong *lib/kobject.c* và *include/linux/kobject.h*. Hãy xem *drivers/base/sys.c* để tìm hiểu về việc cài đặt sysfs. Bạn sẽ tìm thấy các API lớp thiết bị (device class APIs) trong *drivers/base/class.c*. Việc phát các sự kiện nóng (hotplug uevents) thông qua các socket netlink (netlink sockets) được thực hiện bởi *lib/kobject\_uevent.c*. Bạn có thể tải xuống mã nguồn và tài liệu udev từ www.kernel.org/pub/linux/utils/kernel/hotplug/udev.html.

Để hiểu sâu hơn về cách APM được cài đặt trên Linux x86, hãy xem các tệp *arch/x86/kernel/apm\_32.c, include/linux/apm\_bios.h*, và *include/asm-x86/mach-default/apm.h* trong cây mã nguồn kernel (kernel tree). Nếu bạn tò mò muốn biết cách APM được cài đặt trên các kiến trúc không có BIOS như ARM, hãy xem *include/linux/apm-emulation.h* và các tệp sử dụng nó. Phần cài đặt ACPI của kernel nằm trong *drivers/acpi/*.

Bảng 4.2 chứa phần tóm tắt các cấu trúc dữ liệu chính được sử dụng trong chương này cùng với vị trí định nghĩa của chúng trong cây mã nguồn. Bảng 4.3 liệt kê các giao diện lập trình kernel chính mà bạn đã sử dụng trong chương này kèm theo vị trí định nghĩa của chúng.

**Bảng 4.2. Tóm tắt các Cấu trúc Dữ liệu**

| Vị trí Cấu trúc Dữ liệu     |                                          | Mô tả                                                        |
|-----------------------------|------------------------------------------|--------------------------------------------------------------------|
|                             | tasklet_struct include/linux/interrupt.h | Quản lý một tasklet, vốn là một phương pháp để<br>cài đặt nửa dưới (bottom halves) |
| kobject                     | include/linux/kobject.h                  | Đóng gói các thuộc tính chung của một<br>đối tượng kernel (kernel object)               |
| kset                        | include/linux/kobject.h                  | Một tập hợp đối tượng mà một kobject thuộc về                           |
| kobj_type                   | include/linux/kobject.h                  | Một loại đối tượng mô tả một kobject                            |
| class                       | include/linux/device.h                   | Trừu tượng hóa ý tưởng rằng một trình điều khiển<br>thuộc về một danh mục rộng hơn |
| bus device<br>device_driver | include/linux/device.h                   | Các cấu trúc tạo nên các trụ cột trong<br>mô hình thiết bị Linux (Linux device model)   |

**Bảng 4.3. Tóm tắt các Giao diện Lập trình Kernel**

| Giao diện Kernel | Vị trí            | Mô tả                                                    |
|------------------|---------------------|----------------------------------------------------------------|
| request_irq()    | kernel/irq/manage.c | Yêu cầu một IRQ và liên kết một<br>trình xử lý ngắt (interrupt handler) với nó |
| free_irq()       | kernel/irq/manage.c | Giải phóng một IRQ                                                   |

| Giao diện Kernel                                                                                                                                                 | Vị trí                                                                       | Mô tả                                                                                                                                             |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|

| disable_irq()                                                                                                                                                    | kernel/irq/manage.c                                                            | Vô hiệu hóa ngắt (interrupt) liên kết với<br>một IRQ được cung cấp                                                                                                |
| disable_irq_nosync()                                                                                                                                             | kernel/irq/manage.c                                                            | Vô hiệu hóa ngắt liên kết với<br>một IRQ được cung cấp mà không chờ đợi<br>bất kỳ instance nào của trình xử lý ngắt (interrupt handler)<br>đang thực thi trả về |
| enable_irq()                                                                                                                                                     | kernel/irq/manage.c                                                            | Bật lại ngắt đã bị vô hiệu hóa<br>bằng disable_irq()<br>hoặc disable_irq_nosync()                                                       |
| open_softirq()                                                                                                                                                   | kernel/softirq.c                                                               | Mở một softirq                                                                                                                                         |
| raise_softirq()                                                                                                                                                  | kernel/softirq.c                                                               | Đánh dấu softirq đang chờ<br>được thực thi (pending)                                                                                                               |
| tasklet_init()                                                                                                                                                   | kernel/softirq.c                                                               | Khởi tạo động một tasklet                                                                                                                       |
| tasklet_schedule()                                                                                                                                               | include/linux/interrupt.h<br>kernel/softirq.c                                  | Đánh dấu một tasklet đang chờ thực thi                                                                                                                  |
| tasklet_enable()                                                                                                                                                 | include/linux/interrupt.h                                                      | Bật một tasklet                                                                                                                                       |
| tasklet_disable()                                                                                                                                                | include/linux/interrupt.h                                                      | Vô hiệu hóa một tasklet                                                                                                                                      |
| tasklet_disable_nosync()                                                                                                                                         | include/linux/interrupt.h                                                      | Vô hiệu hóa một tasklet mà không chờ đợi<br>các instance đang hoạt động hoàn tất việc thực thi                                                          |
| class_device_register()                                                                                                                                          | drivers/base/class.c                                                           | Nhóm các hàm trong mô hình thiết bị<br>(device model) của Linux                                                                                         |
| kobject_add()                                                                                                                                                    | lib/kobject.c                                                                  | tạo/hủy một class, device class,<br>và các thành phần liên quan                                                                               |

| sysfs_create_dir()                                                                                                                                               | lib/kobject_uevent.c                                                           | kobjects và các tệp sysfs (sysfs files)                                                                                                                 |
| class_device_create()                                                                                                                                            | fs/sysfs/dir.c                                                                 |                                                                                                                                                         |
| class_device_destroy()<br>class_create()<br>class_destroy()<br>class_device_create_file()<br>sysfs_create_file()<br>class_device_add_attrs()<br>kobject_uevent() | fs/sysfs/file.c                                                                |                                                                                                                                                         |

Phần này khép lại quá trình khám phá các khái niệm về trình điều khiển thiết bị (device driver). Bạn có thể muốn tham khảo lại chương này trong quá trình phát triển driver của mình.
