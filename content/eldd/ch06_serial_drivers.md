# Chương 6. Trình điều khiển Nối tiếp (Serial Drivers)

```
Trong chương này

• Kiến trúc phân tầng .................. 173
• Trình điều khiển UART .................. 176
• Trình điều khiển TTY .................. 192
• Quy luật đường truyền (Line Disciplines)  ............. 194
• Khảo sát mã nguồn .................. 205
```

Cổng nối tiếp (serial port) là một kênh truyền thông cơ bản được sử dụng bởi hàng loạt công nghệ và ứng dụng. Một chip gọi là *Bộ thu phát bất đồng bộ vạn năng* (Universal Asynchronous Receiver Transmitter - UART) thường được sử dụng để triển khai giao tiếp nối tiếp. Trên phần cứng tương thích PC, UART là một phần của chipset Super I/O, như được thể hiện trong Hình 6.1.

**Hình 6.1. Sơ đồ kết nối của cổng nối tiếp PC.**

```
           +-----------+
           | Processor |
           +-----------+
                 ^
                 |
                 v
           +--------------+
           | North Bridge |
           +--------------+
                 ^
                 |
                 v
           +--------------+
           | South Bridge |
           +--------------+
                 |
               LPC Bus
                 |
        +----------------+
        |    Super I/O   |
        +----------------+
                 |
               UART
                 |
        +----------------------+
        | RS-232 Line Shifter |
        +----------------------+
                 |
           +-------------+
           | Serial Port |
           +-------------+
```

Mặc dù các kênh truyền thông RS-232 là loại phần cứng nối tiếp phổ biến, hệ thống con nối tiếp (serial subsystem) của kernel được kiến trúc theo cách tổng quát để phục vụ các đối tượng sử dụng đa dạng. Bạn sẽ tiếp xúc với hệ thống con nối tiếp nếu bạn:

- Chạy một phiên terminal qua liên kết nối tiếp RS-232
- Kết nối Internet thông qua modem quay số (dialup), di động (cellular), hoặc modem phần mềm
- Giao tiếp với các thiết bị như bộ điều khiển cảm ứng (touch controller), thẻ thông minh (smart card), chip Bluetooth, hoặc các thiết bị khóa hồng ngoại (Infrared dongle), vốn sử dụng phương thức truyền tải nối tiếp
- Mô phỏng cổng nối tiếp bằng bộ chuyển đổi USB sang nối tiếp (USB-to-serial)
- Giao tiếp qua liên kết RS-485, một biến thể đa điểm (multidrop) của RS-232 có phạm vi lớn hơn và khả năng chống nhiễu tốt hơn

Trong chương này, chúng ta hãy cùng tìm hiểu cách kernel cấu trúc hệ thống con nối tiếp. Chúng ta sẽ sử dụng ví dụ về một chiếc điện thoại di động Linux để tìm hiểu về các trình điều khiển UART cấp thấp (low-level driver) và ví dụ về bộ điều khiển cảm ứng nối tiếp để khám phá các chi tiết triển khai của quy luật đường truyền (line discipline) cấp cao hơn.

UART thường thấy trên PC là chip 16550 của National Semiconductor, hoặc các chip tương thích từ các nhà cung cấp khác, vì vậy bạn sẽ thấy các tài liệu tham khảo về "UART loại 16550" trong mã nguồn và tài liệu. Chip 8250 là tiền thân của 16550, do đó trình điều khiển Linux cho UART trên PC được đặt tên là *8250.c*.

## Kiến trúc phân tầng (Layered Architecture)

Như bạn vừa thấy, những người dùng của hệ thống con nối tiếp rất nhiều và khác nhau. Điều này đã thúc đẩy các nhà phát triển kernel cấu trúc một kiến trúc nối tiếp phân tầng bằng cách sử dụng các khối xây dựng sau:

- **1.** Các trình điều khiển cấp thấp (low-level driver) quan tâm đến các chi tiết bên trong của UART hoặc phần cứng nối tiếp cơ sở khác.
- Một tầng trình điều khiển tty giao tiếp với trình điều khiển cấp thấp. Trình điều khiển tty cách ly các tầng cao hơn khỏi sự phức tạp của phần cứng. **2.**
- Các quy luật đường truyền (line disciplines) "xử lý" (cook) dữ liệu được trao đổi với trình điều khiển tty. Line disciplines định hình hành vi của tầng nối tiếp và giúp tái sử dụng các tầng thấp hơn để hỗ trợ các công nghệ khác nhau. **3.**

Để hỗ trợ việc triển khai trình điều khiển tùy chỉnh, hệ thống con nối tiếp cũng cung cấp các API cốt lõi (core API) nhằm tách biệt các điểm chung ra khỏi các tầng này.

Hình 6.2 minh họa mối liên hệ giữa các tầng. N_TTY, N_IRDA, và N_PPP là các line discipline có thể cắm-vào (drop-in) giúp uốn nắn hệ thống con nối tiếp để lần lượt hỗ trợ các terminal, hồng ngoại (Infrared), và mạng quay số (dialup networking). Hình 6.3 ánh xạ hệ thống con nối tiếp tới các tệp mã nguồn kernel.

**Hình 6.2. Mối liên hệ giữa các tầng trong hệ thống con nối tiếp.**

```
                       /dev/ttySX        /dev/ircommX          ppp0
                          ^                  ^                  ^
                          |                  |                  |
+-------------------+   +------+          +------+          +------+
|   TTY I/O Core    |---| N_TTY|----------|N_IRDA|----------|N_PPP |
+-------------------+   +------+          +------+          +------+
         ^                                               Line Disciplines
         |
         v
+-------------+
| TTY Driver  |
+-------------+
       ^
       |
       v
+----------------------+
| UART/Low-Level Driver|
+----------------------+
       ^
       |
       v
+----------------------------+
| Serial Port/Low-Level HW   |
+----------------------------+
```

**Hình 6.3. Các tầng nối tiếp được ánh xạ tới mã nguồn kernel.**

[Xem hình ảnh kích thước đầy đủ]

```
------------------ Ứng dụng người dùng (Giao diện System Call) ------------------

                +-----------------+          +-----------------+     |    +-------------------+
                |     N_TTY       |          |     N_IRDA      |     |--->|     tty_io.c      |
                |    (n_tty.c)    |          |  (irtty_sir.c)  |     |    |    (Core Module)  |
                +-----------------+          +-----------------+     |    +-------------------+
                        ^
                        |
------------------------|-- Tầng Quy luật đường truyền (Line Discipline Layer) ----------------
                        |
                +-----------------+                                         
                |  serial_core.c  |                                              +-----------------+  
                +-----------------+                                              |  usb-serial.c   | 
                        ^                       +--------------------------+     | (Core Module)   |
                        |                       |  USB-Serial Converter    |<--->+-----------------+
------------------------|------ Tầng TTY -------|          Driver          |----------
                        |                       +--------------------------+
                +-----------------+                              ^
                |     8250.c      |                              |
                +-----------------+                              |
                        ^                                        |
------------------------|--- Trình điều khiển cấp thấp (Low-Level driver) -------|-------------
                        v                                        v
          16550-type UART           Infrared            USB-Serial Converter
                                                                 
                

------------------------------ Tầng vật lý (Physical Layer) --------------------------------
```

Để minh họa các ưu điểm của kiến trúc nối tiếp phân lớp (layered serial architecture), chúng ta hãy sử dụng một ví dụ. Giả sử bạn đang sử dụng bộ chuyển đổi USB sang cổng nối tiếp (USB-to-serial adapter) để có được khả năng giao tiếp nối tiếp trên một máy tính xách tay (laptop) vốn không có cổng serial. Một kịch bản khả thi là khi bạn đang gỡ lỗi (debugging) nhân hệ điều hành (kernel) trên một thiết bị nhúng đích (target embedded device) từ laptop chủ (host laptop) bằng cách sử dụng `kgdb` (kgdb được thảo luận trong Chương 21, "Debugging Device Drivers"), như được minh họa trong Hình 6.4.

**Hình 6.4. Sử dụng bộ chuyển đổi USB sang serial.**

```
[Host Laptop] --USB--> [USB–UART Adapter] --UART--> [Target Embedded Device]
```

Như được hiển thị trong Hình 6.3, trước tiên bạn cần một trình điều khiển tầng vật lý USB phù hợp (phương án tương đương USB của trình điều khiển UART) trên laptop chủ của bạn. Trình điều khiển này có mặt trong hệ thống con USB của nhân (kernel USB subsystem), *drivers/usb/.* Tiếp theo, bạn cần một trình điều khiển tty (tty driver) nằm phía trên tầng vật lý USB. Trình điều khiển `usbserial` (*drivers/usb/serial/usb-serial.c*) là tầng cốt lõi (core layer) thực thi một tty tổng quát (generic tty) thông qua các bộ chuyển đổi USB-serial. Trình điều khiển này, phối hợp với các phương thức tty đặc thù của thiết bị được đăng ký bởi trình điều khiển bộ chuyển đổi (*drivers/usb/serial/keyspan.c* nếu bạn đang sử dụng bộ chuyển đổi Keyspan chẳng hạn), tạo nên tầng tty (tty layer). Cuối cùng nhưng không kém phần quan trọng, bạn cần kỷ luật đường truyền N_TTY (N_TTY line discipline) để xử lý I/O của thiết bị đầu cuối (terminal I/O).

Trình điều khiển tty cách ly kỷ luật đường truyền (line discipline) và các tầng cao hơn khỏi các chi tiết bên trong của USB. Trên thực tế, kỷ luật đường truyền vẫn nghĩ rằng nó đang chạy trên một UART thông thường. Sở dĩ như vậy là vì trình điều khiển tty kéo dữ liệu từ các *Khối Yêu Cầu USB* hay URBs (USB Request Blocks - được thảo luận trong Chương 11, "Universal Serial Bus") và đóng gói nó theo định dạng mà kỷ luật đường truyền N_TTY mong đợi. Do đó, kiến trúc phân lớp giúp cho việc triển khai trở nên đơn giản hơn—tất cả các khối từ kỷ luật đường truyền trở lên đều có thể được tái sử dụng mà không cần thay đổi.

Ví dụ trước sử dụng một trình điều khiển tty đặc thù theo công nghệ (technology-specific tty driver) và một kỷ luật đường truyền tổng quát (generic line discipline). Cách sử dụng ngược lại cũng rất phổ biến. Ngăn xếp Hồng ngoại (Infrared stack), được thảo luận trong Chương 16, "Linux Without Wires," sử dụng một trình điều khiển tty tổng quát và một kỷ luật đường truyền đặc thù theo công nghệ có tên là `N_IRDA`.

Như bạn có thể nhận thấy trong Hình 6.2 và Hình 6.3, mặc dù các trình điều khiển UART là các trình điều khiển ký tự (char drivers), chúng không trực tiếp lộ ra các giao diện (expose interfaces) cho các lời gọi hệ thống của nhân (kernel system calls) giống như các trình điều khiển ký tự thông thường mà chúng ta đã thấy ở chương trước. Thay vào đó, các trình điều khiển UART (giống như các trình điều khiển bàn phím được thảo luận trong chương tiếp theo) phục vụ một tầng nhân khác, đó là tầng tty (tty layer). Các lời gọi hệ thống I/O (I/O system calls) bắt đầu hành trình của chúng ở phía trên các kỷ luật đường truyền cấp cao (top-level line disciplines) và cuối cùng lan truyền xuống các trình điều khiển UART thông qua tầng tty.

Trong phần còn lại của chương này, chúng ta hãy cùng xem xét kỹ hơn các thành phần trình điều khiển khác nhau của tầng nối tiếp (serial layer). Chúng ta bắt đầu từ đáy của ngăn xếp nối tiếp (serial stack) với các trình điều khiển UART mức thấp (low-level UART drivers), chuyển sang các trình điều khiển tty mức trung (middle-level tty drivers), và sau đó tiến đến các trình điều khiển kỷ luật đường truyền mức cao (top-level line discipline drivers).

Các trình điều khiển UART xoay quanh ba cấu trúc dữ liệu chính. Cả ba đều được định nghĩa trong *include/linux/serial_core.h* :

Cấu trúc trình điều khiển trên mỗi UART (per-UART driver structure), `struct uart_driver` : **1.**

```
struct uart_driver {
 struct module *owner; /* Module sở hữu cấu trúc này */
 const char *driver_name; /* Tên */
 const char *dev_name; /* Tên nút /dev như ttyS */
 /* ... */
 int major; /* Số Major */
 int minor; /* Số Minor */
 /* ... */
 struct tty_driver *tty_driver; /* Trình điều khiển tty */
};
```

Các chú thích tương ứng với mỗi trường (field) giải thích ngữ nghĩa của chúng. Trường `owner` mang lại các lợi ích tương tự như đã được thảo luận trong chương trước đối với cấu trúc `file_operations`.

`struct uart_port` . Một thể hiện (instance) của cấu trúc này tồn tại cho mỗi cổng do trình điều khiển UART sở hữu: **2.**

```
struct uart_port {
 spinlock_t lock; /* Khóa cổng */
 unsigned int iobase; /* in/out[bwl]*/
 unsigned char __iomem *membase; /* read/write[bwl]*/
 unsigned int irq; /* Số ngắt irq */
 unsigned int uartclk; /* Xung nhịp UART cơ sở */
 unsigned char fifosize; /* Kích thước FIFO phát (tx fifo size) */
 unsigned char x_char; /* Điều khiển luồng xon/xoff */
 /* ... */
};
```

`struct uart_ops` . Đây là một tập siêu (superset) của các điểm nhập (entry points) mà mỗi trình điều khiển UART phải hỗ trợ và mô tả các thao tác có thể thực hiện trên phần cứng vật lý. Các phương thức trong cấu trúc này được gọi bởi tầng tty: **3.**

```
struct uart_ops {
 uint (*tx_empty)(struct uart_port *); /* TX FIFO có trống không? */
 void (*set_mctrl)(struct uart_port *,
 unsigned int mctrl); /* Thiết lập tham số điều khiển modem */
 uint (*get_mctrl)(struct uart_port *); /* Lấy tham số điều khiển modem */
 void (*stop_tx)(struct uart_port *); /* Dừng truyền */
 void (*start_tx)(struct uart_port *); /* Bắt đầu truyền */
 /* ... */
 void (*shutdown)(struct uart_port *); /* Vô hiệu hóa cổng */
```

```
 void (*set_termios)(struct uart_port *,
 struct termios *new,
 struct termios *old); /* Thiết lập tham số giao diện terminal */
 /* ... */
 void (*config_port)(struct uart_port *,
 int); /* Cấu hình cổng UART */
 /* ... */
};
```

Có hai bước quan trọng mà một UART driver (trình điều khiển UART) phải thực hiện để liên kết chính nó với kernel (nhân hệ điều hành): **1.**

Đăng ký với serial core (lõi serial) bằng cách gọi

```c
uart_register_driver(struct uart_driver *);
```

**2.** Gọi hàm `uart_add_one_port(struct uart_driver * , struct uart_port *)` để đăng ký từng port (cổng) riêng lẻ mà nó hỗ trợ. Nếu phần cứng serial của bạn hỗ trợ hotplug (cắm nóng), các port sẽ được đăng ký với core từ điểm vào (entry point) dùng để dò tìm sự hiện diện của thiết bị. Hãy xem trình điều khiển CardBus Modem trong Liệt kê 10.4 ở Chương 10, "Peripheral Component Interconnect," để có ví dụ về trường hợp thiết bị serial được cắm nóng. Lưu ý rằng một số trình điều khiển sử dụng hàm đăng ký bao bọc `serial8250_register_port(struct uart_port *)`, hàm này sẽ gọi nội bộ `uart_add_one_port()`.

Các cấu trúc dữ liệu (data structures) và hàm đăng ký này cấu thành nên mẫu số chung tối thiểu có mặt ở tất cả các UART driver. Được trang bị các cấu trúc và hàm này, chúng ta hãy cùng phát triển một UART driver mẫu.

## Ví dụ về Thiết bị: Điện thoại Di động

Hãy xem xét một chiếc điện thoại di động chạy Linux được xây dựng dựa trên một *System-on-Chip* (SoC) nhúng. SoC này có hai UART tích hợp sẵn, nhưng như được hiển thị trong Hình 6.5, cả hai đều đã được sử dụng hết: một để giao tiếp với cellular modem (modem di động), và cái còn lại để giao tiếp với một Bluetooth chipset (chipset Bluetooth). Vì không có UART nào rảnh rỗi cho mục đích gỡ lỗi (debug), chiếc điện thoại này sử dụng hai chip chuyển đổi USB sang serial (USB-to-serial converter): một chip để cung cấp một terminal gỡ lỗi cho máy tính host (PC host), và chip còn lại để lấy một port dự phòng. Các bộ chuyển đổi USB sang serial, như bạn đã thấy ở phần trước của chương này, cho phép bạn kết nối các thiết bị serial với PC của mình thông qua USB. Chúng ta sẽ thảo luận nhiều hơn về các bộ chuyển đổi USB sang serial trong Chương 11.

**Hình 6.5. Các port USB_UART trên một điện thoại di động Linux.**

[Xem hình ảnh kích thước đầy đủ]

```
                            Linux Cell Phone
     --------------------------------------------------------------------------|
     |                                                                         |          
     |   +----------+       UART1                        /dev/ttyUU1           |
     |   |GSM/GPRS  |<------------------------------.        ^                 |
     |   +----------+                               |        |                 |
     |                                              |        |                 |
     |   +-------------+        UART3          +-----------------------+       |
     |   | Embedded SoC|<--------------------->|         CPLD          |       |
     |   +-------------+        UART4          +-----------------------+       |
     |                                              ^            ^             |
     |   +----------+       UART2                   | Serial     | Serial      |
     |   |Bluetooth |<------------------------------'            |             |
     |   +----------+                                            |             |
     |                                              +-----------------------+  |
     |                                              | USB‑to‑Serial chip     |  |
     |                              USB <---------->|                       |  |
     |                                              +-----------------------+  |
     |                                              +-----------------------+  |
     |                                              | USB‑to‑Serial chip     |  |
     |                              USB <---------->|                       |  |
     |                                              +-----------------------+  |
     |                                      /dev/ttyUU0                     |  |
     ---------------------------------------------------------------------------
                                          |
                                          |
                                     /dev/ttyUSB0
                                          |
                                   +---------------+
                                   | Host Laptop   |
                                   +---------------+
```

Các đầu serial của hai chip chuyển đổi USB sang serial được kết nối với SoC thông qua một *Complex Programmable Logic Device* hay CPLD (xem mục "CPLD/FPGA" trong Chương 18, "Nhúng Linux"). CPLD tạo ra hai UART ảo (hoặc USB_UART) bằng cách cung cấp một giao diện gồm ba thanh ghi để truy cập vào mỗi chip chuyển đổi USB sang serial, như được hiển thị trong Bảng 6.1: một thanh ghi trạng thái (status register), một thanh ghi đọc dữ liệu (read-data register), và một thanh ghi ghi dữ liệu (write-data register). Để ghi một ký tự vào một USB_UART, hãy lặp trên một bit trong thanh ghi trạng thái—bit này sẽ được xóa (clear) khi có khoảng trống trong bộ nhớ *first-in first-out* (FIFO) truyền nội bộ của chip—và sau đó ghi byte đó vào thanh ghi ghi dữ liệu. Để đọc một ký tự, hãy đợi cho đến khi một bit được chỉ định trong thanh ghi trạng thái cho biết sự hiện diện của dữ liệu trong FIFO nhận và sau đó đọc từ thanh ghi đọc dữ liệu.

#### UU\_STATUS\_REGISTER

Các bit dùng để kiểm tra xem FIFO truyền (transmit FIFO) có đầy hay FIFO nhận (receive FIFO) có trống hay không 0x0

UU\_READ\_DATA\_REGISTER

Đọc một ký tự từ USB\_UART

0x1

UU\_WRITE\_DATA\_REGISTER

Ghi một ký tự vào USB\_UART 0x2

**Bảng 6.1. Bố cục thanh ghi của USB\_UART**

| Tên thanh ghi | Mô tả | Độ lệch (Offset) từ USB_UART |
|---------------|-------|------------------------------|
|               |       | Vùng nhớ cơ sở (Memory Base) |

Ở phía PC, hãy sử dụng driver *usbserial* thích hợp của Linux (ví dụ: *drivers/usb/serial/ftdi\_sio.c* nếu bạn đang sử dụng chip FT232AM trên điện thoại di động) để tạo và quản lý các node thiết bị */dev/ttyUSBX* tương ứng với các cổng USB-serial. Bạn có thể chạy các trình giả lập terminal (terminal emulator) như *minicom* thông qua một trong các node thiết bị này để lấy console hoặc terminal gỡ lỗi (debug terminal) từ điện thoại di động. Ở phía điện thoại di động, chúng ta phải triển khai một UART driver cho USB\_UART. Driver này tạo và quản lý các node */dev/ttyUUX* chịu trách nhiệm giao tiếp ở phía thiết bị của liên kết (link).

Điện thoại di động được hiển thị trong Hình 6.5 có thể đóng vai trò là một cổng thông minh (intelligent gateway) cho các thiết bị Bluetooth — kết nối với mạng GSM và từ đó kết nối với Internet. Ví dụ, điện thoại có thể chuyển tiếp dữ liệu từ thiết bị theo dõi huyết áp Bluetooth của bạn tới máy chủ của nhà cung cấp dịch vụ y tế trên Internet. Hoặc nó có thể cảnh báo bác sĩ nếu phát hiện ra sự cố trong quá trình giao tiếp với thiết bị theo dõi nhịp tim hỗ trợ Bluetooth của bạn. Thiết bị phát MP3 Bluetooth được sử dụng trong Chương 13, "Driver Âm thanh" (Audio Drivers), và hộp chia thuốc Bluetooth được sử dụng trong Chương 16 cũng là những ví dụ về các thiết bị có thể sử dụng điện thoại di động Linux để hỗ trợ kết nối Internet.

Liệt kê 6.1 triển khai USB\_UART driver. Nó được triển khai như một *platform driver*. Platform là một pseudo-bus (giả bu-sơ) thường được sử dụng để liên kết các thiết bị gọn nhẹ tích hợp trong SoC với Linux device model (mô hình thiết bị Linux). Một platform bao gồm:

Một platform device (thiết bị nền tảng). Mã thiết lập dành riêng cho kiến trúc (architecture-specific setup code) sẽ thêm platform device bằng cách sử dụng `platform_device_register()` hoặc phiên bản đơn giản hơn của nó là `platform_device_register_simple()`. Bạn cũng có thể đăng ký nhiều platform device cùng lúc bằng cách sử dụng `platform_add_devices()`. Cấu trúc `platform_device` được định nghĩa trong *include/linux/platform\_device.h* đại diện cho một platform device: **1.**

```
struct platform_device {
 const char *name; /* Tên thiết bị */
 u32 id; /* Sử dụng trường này để đăng ký nhiều 
 thể hiện (instance) của một platform device. Trong
 ví dụ này, hai USB_UART có các ID khác nhau. */
 struct device dev; /* Chứa phương thức release() và
 dữ liệu platform */
 /* ... */
};
```

Một platform driver. Platform driver tự đăng ký vào hệ thống platform bằng cách sử dụng `platform_driver_register()`. Cấu trúc `platform_driver`, cũng được định nghĩa trong *include/linux/platform\_device.h*, đại diện cho một platform driver: **2.**

```
struct platform_driver {
 int (*probe)(struct platform_device *); /* Phương thức probe */
 int (*remove)(struct platform_device *);/* Phương thức remove */
 /* ... */
 /* Trường name trong cấu trúc sau phải khớp
 với trường name trong cấu trúc platform_device
 tương ứng */
 struct device_driver driver;
};
```

Xem *Documentation/driver-model/platform.txt* để biết thêm chi tiết về platform device và driver. Để đơn giản, driver mẫu của chúng ta đăng ký cả platform device lẫn platform driver.

Trong quá trình khởi tạo (initialization), USB\_UART driver trước tiên đăng ký chính nó với serial core bằng cách sử dụng `uart_register_driver()`. Khi hoàn tất, bạn sẽ thấy một dòng mới bắt đầu bằng `usb_uart` trong */proc/tty/drivers*. Tiếp theo, driver đăng ký hai platform device (mỗi cổng một USB\_UART) bằng cách sử dụng `platform_device_register_simple()`. Như đã đề cập trước đó, việc đăng ký platform device thường được thực hiện trong quá trình thiết lập bo mạch khi khởi động (boot-time board setup). Sau đó, driver đăng ký các điểm vào (entry point) của platform driver (`probe()`, `remove()`, `suspend()`, và `resume()`) bằng cách sử dụng `platform_driver_register()`. USB\_UART platform driver liên kết với cả hai platform device trên và có tên trùng khớp (`usb_uart`). Sau bước này, bạn sẽ thấy hai thư mục mới xuất hiện trong sysfs, mỗi thư mục tương ứng với một cổng USB\_UART: */sys/devices/platform/usb\_uart.0/* và */sys/devices/platform/usb\_uart.1/*.

Vì Linux device layer (tầng thiết bị Linux) hiện phát hiện ra một platform driver khớp với tên của các USB\_UART platform device đã đăng ký, nên nó sẽ gọi điểm vào `probe()`[1] (`usb_uart_probe()`) thuộc về platform driver, mỗi lần cho một USB\_UART. Điểm vào probe thêm cổng USB\_UART tương ứng bằng cách sử dụng `uart_add_one_port()`. Thao tác này kích hoạt việc gọi điểm vào `config_port()` (một phần của cấu trúc `uart_ops` đã thảo luận trước đó), dùng để yêu cầu (claim) và ánh xạ (map) vùng nhớ thanh ghi của USB\_UART. Nếu cả hai cổng USB\_UART được thêm thành công, serial core sẽ phát ra các thông điệp kernel sau:

[1] Các platform device như vậy thường không thể tháo lắp nóng (hotplugged). Ngữ nghĩa gọi của phương thức `probe()` này khác với những gì bạn sẽ tìm hiểu trong các chương sau đối với các thiết bị có thể tháo lắp nóng như PCMCIA, PCI và USB, nhưng cấu trúc tương tự của các điểm vào driver giúp Linux device model có cái nhìn đồng nhất và nhất quán đối với tất cả các thiết bị.

```
ttyUU0 tại MMIO 0xe8000000 (irq = 3) là một USB_UART
ttyUU1 tại MMIO 0xe9000000 (irq = 4) là một USB_UART
```

Tuy nhiên, việc yêu cầu ngắt (claiming the IRQ) được hoãn lại cho đến khi một ứng dụng mở cổng USB\_UART. Ngắt (IRQ) sẽ được giải phóng khi ứng dụng đóng USB\_UART. Bảng 6.2 mô tả chi tiết đường dẫn mã nguồn (code path) của trình điều khiển (driver) để yêu cầu và giải phóng các vùng nhớ (memory region) cũng như ngắt (IRQ).

```
Module Insert
usb_uart_init()
uart_register_driver()
usb_uart_probe()
uart_add_one_port()
usb_uart_config_port()
request_mem_region()
Module Unload
usb_uart_exit()
usb_unregister_driver()
usb_uart_remove()
uart_remove_one_port()
usb_uart_release_port()
release_mem_region()
Open /dev/ttyUUX
usb_uart_startup()
request_irq()
Close /dev/ttyUUX
usb_uart_shutdown()
free_irq()
Bảng 6.2.
Yêu cầu
   và
 Giải phóng
 Tài nguyên
 Bộ nhớ
 và IRQ
```

Trong đường dẫn truyền dữ liệu (transmit path), driver thu thập dữ liệu đi ra (egress data) từ bộ đệm vòng (circular buffer) liên kết với cổng UART. Dữ liệu nằm trong `port->info->xmit.buf[port->info->xmit.tail]` như đã thể hiện rõ từ điểm nhập (entry point) `start_tx()` của UART driver, cụ thể là hàm `usb_uart_start_tx()`.

Trong đường dẫn nhận dữ liệu (receive path), driver đẩy dữ liệu thu thập được từ USB\_UART sang TTY driver tương ứng bằng cách sử dụng `tty_insert_flip_char()` và `tty_flip_buffer_push()`. Quá trình này được thực hiện trong trình xử lý ngắt nhận (receive interrupt handler), hàm `usb_uart_rxint()`. Hãy xem lại hàm này sau khi đọc phần tiếp theo, "Trình điều khiển TTY (TTY Drivers)."

Liệt kê 6.1 sử dụng các chú thích (comment) để giải thích mục đích của các điểm nhập (entry point) trong driver và hoạt động của chúng. Nó bỏ qua một số điểm nhập trong cấu trúc `uart_ops` để lược bớt các chi tiết phụ.

#### Liệt kê 6.1. Trình điều khiển USB\_UART cho Điện thoại Linux

```
## include <linux/console.h>
## include <linux/platform_device.h>
## include <linux/tty.h>
## include <linux/tty_flip.h>
## include <linux/serial_core.h>
## include <linux/serial.h>
## include <asm/irq.h>
## include <asm/io.h>
## define USB_UART_MAJOR 200 /* Bạn phải đăng ký số major này */
## define USB_UART_MINOR_START 70 /* Bắt đầu đánh số minor từ đây */
## define USB_UART_PORTS 2 /* Điện thoại có 2 cổng USB_UART */
## define PORT_USB_UART 30 /* Kiểu UART. Thêm giá trị này vào
 include/linux/serial_core.h */
/* Mỗi USB_UART có một tập thanh ghi 3 byte bao gồm
 UU_STATUS_REGISTER tại offset 0, UU_READ_DATA_REGISTER tại
 offset 1, và UU_WRITE_DATA_REGISTER tại offset 2 như hiển thị
 trong Bảng 6.1 */
## define USB_UART1_BASE 0xe8000000 /* Địa chỉ cơ sở bộ nhớ cho USB_UART1 */
## define USB_UART2_BASE 0xe9000000 /* Địa chỉ cơ sở bộ nhớ cho USB_UART2 */
## define USB_UART_REGISTER_SPACE 0x3
/* Ngữ nghĩa của các bit trong thanh ghi trạng thái */
## define USB_UART_TX_FULL 0x20 /* TX FIFO đã đầy */
## define USB_UART_RX_EMPTY 0x10 /* TX FIFO đang trống */
## define USB_UART_STATUS 0x0F /* Lỗi Parity/frame/overrun? */
## define USB_UART1_IRQ 3 /* Ngắt IRQ của USB_UART1 */
## define USB_UART2_IRQ 4 /* Ngắt IRQ của USB_UART2 */
## define USB_UART_FIFO_SIZE 32 /* Kích thước FIFO */
## define USB_UART_CLK_FREQ 16000000
static struct uart_port usb_uart_port[]; /* Được định nghĩa sau */
/* Ghi một ký tự vào cổng USB_UART */
static void
usb_uart_putc(struct uart_port *port, unsigned char c)
{
 /* Chờ cho đến khi có không gian trống trong TX FIFO của USB_UART.
 Nhận biết điều này bằng cách quan sát bit USB_UART_TX_FULL trong
 thanh ghi trạng thái */
 while (__raw_readb(port->membase) & USB_UART_TX_FULL);
 /* Ghi ký tự vào cổng dữ liệu */
 __raw_writeb(c, (port->membase+1));
}
/* Đọc một ký tự từ USB_UART */
static unsigned char
usb_uart_getc(struct uart_port *port)
{
 /* Chờ cho đến khi có sẵn dữ liệu trong RX_FIFO */
 while (__raw_readb(port->membase) & USB_UART_RX_EMPTY);
 /* Lấy dữ liệu */
```

```
 return(__raw_readb(port->membase+2));
}
/* Lấy trạng thái của USB_UART */
static unsigned char
usb_uart_status(struct uart_port *port)
{
 return(__raw_readb(port->membase) & USB_UART_STATUS);
}
/*
 * Yêu cầu vùng nhớ (memory region) gắn với cổng USB_UART. Được gọi
 * khi driver thêm một cổng USB_UART thông qua hàm uart_add_one_port().
 */
static int
usb_uart_request_port(struct uart_port *port)
{
 if (!request_mem_region(port->mapbase, USB_UART_REGISTER_SPACE,
 "usb_uart")) {
 return -EBUSY;
 }
 return 0;
}
/* Giải phóng vùng nhớ gắn với cổng USB_UART.
 * Được gọi khi driver gỡ bỏ một cổng USB_UART thông qua
 * hàm uart_remove_one_port().
 */
static void
usb_uart_release_port(struct uart_port *port)
{
 release_mem_region(port->mapbase, USB_UART_REGISTER_SPACE);
}
/*
 * Cấu hình USB_UART. Được gọi khi driver thêm một cổng USB_UART.
 */
static void
usb_uart_config_port(struct uart_port *port, int flags)
{
 if (flags & UART_CONFIG_TYPE && usb_uart_request_port(port) == 0)
 {
 port->type = PORT_USB_UART;
 }
}
/* Trình xử lý ngắt nhận dữ liệu (Receive interrupt handler) */
static irqreturn_t
usb_uart_rxint(int irq, void *dev_id)
{
 struct uart_port *port = (struct uart_port *) dev_id;
 struct tty_struct *tty = port->info->tty;
 unsigned int status, data;
 /* ... */
 do {
 /* ... */
 /* Đọc dữ liệu */
 data = usb_uart_getc(port);
```

```c
 /* Normal, overrun, parity, frame error? */
 status = usb_uart_status(port);
 /* Dispatch to the tty layer */
 tty_insert_flip_char(tty, data, status);
 /* ... */
 } while (more_chars_to_be_read()); /* More chars */
 /* ... */
 tty_flip_buffer_push(tty);
 return IRQ_HANDLED;
}
/* Được gọi khi một ứng dụng mở một USB_UART */
static int
usb_uart_startup(struct uart_port *port)
{
 int retval = 0;
 /* ... */
 /* Yêu cầu IRQ (Request IRQ) */
 if ((retval = request_irq(port->irq, usb_uart_rxint, 0,
 "usb_uart", (void *)port))) {
 return retval;
 }
 /* ... */
 return retval;
}
/* Được gọi khi một ứng dụng đóng một USB_UART */
static void
usb_uart_shutdown(struct uart_port *port)
{
 /* ... */
 /* Giải phóng IRQ (Free IRQ) */
 free_irq(port->irq, port);
 /* Vô hiệu hóa ngắt (Interrupt) bằng cách ghi vào các thanh ghi
 thích hợp */
 /* ... */
}
/* Đặt loại UART thành USB_UART */
static const char *
usb_uart_type(struct uart_port *port)
{
 return port->type == PORT_USB_UART ? "USB_UART" : NULL;
}
/* Bắt đầu truyền các byte dữ liệu */
static void
usb_uart_start_tx(struct uart_port *port)
{
 while (1) {
 /* Lấy dữ liệu từ bộ đệm vòng (circular buffer) của UART và
 ghi nó vào thanh ghi WRITE_DATA của USB_UART */
 usb_uart_putc(port,
 port->info->xmit.buf[port->info->xmit.tail]);
 /* Điều chỉnh con trỏ cuối (tail) của bộ đệm UART */
 port->info->xmit.tail = (port->info->xmit.tail + 1) &
 (UART_XMIT_SIZE - 1);
 /* Thống kê */
```

```
 port->icount.tx++;
 /* Kết thúc nếu không còn dữ liệu trong bộ đệm UART */
 if (uart_circ_empty(&port->info->xmit)) break;
 }
 /* ... */
}
/* Cấu trúc các thao tác UART (UART operations) */
static struct uart_ops usb_uart_ops = {
 .start_tx = usb_uart_start_tx, /* Bắt đầu truyền */
 .startup = usb_uart_startup, /* Ứng dụng mở USB_UART */
 .shutdown = usb_uart_shutdown, /* Ứng dụng đóng USB_UART */
 .type = usb_uart_type, /* Đặt loại UART */
 .config_port = usb_uart_config_port, /* Cấu hình khi trình điều khiển
 thêm một cổng USB_UART */
 .request_port = usb_uart_request_port,/* Yêu cầu cấp phát tài nguyên
 liên quan đến cổng
 USB_UART */
 .release_port = usb_uart_release_port,/* Giải phóng tài nguyên
 liên quan đến cổng
 USB_UART */
## if 0 /* Để trống (chưa triển khai) cho USB_UART */
 .tx_empty = usb_uart_tx_empty, /* Bộ phát có bận không? */
 .set_mctrl = usb_uart_set_mctrl, /* Đặt điều khiển modem */
 .get_mctrl = usb_uart_get_mctrl, /* Lấy điều khiển modem */
 .stop_tx = usb_uart_stop_tx, /* Dừng truyền */
 .stop_rx = usb_uart_stop_rx, /* Dừng nhận */
 .enable_ms = usb_uart_enable_ms, /* Bật tín hiệu trạng thái modem */
 .set_termios = usb_uart_set_termios, /* Đặt termios */
## endif
};
static struct uart_driver usb_uart_reg = {
 .owner = THIS_MODULE, /* Chủ sở hữu (Owner) */
 .driver_name = "usb_uart", /* Tên trình điều khiển */
 .dev_name = "ttyUU", /* Tên node thiết bị */
 .major = USB_UART_MAJOR, /* Số Major */
 .minor = USB_UART_MINOR_START, /* Số Minor bắt đầu */
 .nr = USB_UART_PORTS, /* Số lượng cổng UART */
 .cons = &usb_uart_console, /* Con trỏ đến cấu trúc console.
 Được thảo luận trong Chương 12,
 "Video Drivers" */
};
/* Được gọi khi trình điều khiển nền tảng (platform driver) bị hủy đăng ký */
static int
usb_uart_remove(struct platform_device *dev)
{
 platform_set_drvdata(dev, NULL);
 /* Xóa cổng USB_UART khỏi serial core */
 uart_remove_one_port(&usb_uart_reg, &usb_uart_port[dev->id]);
 return 0;
}
/* Sự kiện quản lý nguồn (Power Management) tạm ngưng (Suspend) */
static int
usb_uart_suspend(struct platform_device *dev, pm_message_t state)
```

```
{
 uart_suspend_port(&usb_uart_reg, &usb_uart_port[dev->id]);
 return 0;
}
/* Phục hồi (Resume) sau khi tạm ngưng */
static int
usb_uart_resume(struct platform_device *dev)
{
 uart_resume_port(&usb_uart_reg, &usb_uart_port[dev->id]);
 return 0;
}
/* Tham số của từng cổng USB_UART được hỗ trợ */
static struct uart_port usb_uart_port[] = {
 {
 .mapbase = (unsigned int) USB_UART1_BASE,
 .iotype = UPIO_MEM, /* Ánh xạ bộ nhớ (Memory mapped) */
 .irq = USB_UART1_IRQ, /* IRQ */
 .uartclk = USB_UART_CLK_FREQ, /* Tần số xung nhịp HZ */
 .fifosize = USB_UART_FIFO_SIZE, /* Kích thước FIFO */
 .ops = &usb_uart_ops, /* Các thao tác UART */
 .flags = UPF_BOOT_AUTOCONF, /* Cờ cổng UART */
 .line = 0, /* Số thứ tự cổng UART */
 },
 {
 .mapbase = (unsigned int)USB_UART2_BASE,
 .iotype = UPIO_MEM, /* Ánh xạ bộ nhớ (Memory mapped) */
 .irq = USB_UART2_IRQ, /* IRQ */
 .uartclk = USB_UART_CLK_FREQ, /* Tần số xung nhịp HZ */
 .fifosize = USB_UART_FIFO_SIZE, /* Kích thước FIFO */
 .ops = &usb_uart_ops, /* Các thao tác UART */
 .flags = UPF_BOOT_AUTOCONF, /* Cờ cổng UART */
 .line = 1, /* Số thứ tự cổng UART */
 }
};
/* Hàm thăm dò (Probe) của platform driver */
static int __init
usb_uart_probe(struct platform_device *dev)
{
 /* ... */
 /* Thêm một cổng USB_UART. Hàm này cũng đăng ký thiết bị này
 với tầng tty (tty layer) và kích hoạt việc gọi điểm vào (entry point) config_port() */
 uart_add_one_port(&usb_uart_reg, &usb_uart_port[dev->id]);
 platform_set_drvdata(dev, &usb_uart_port[dev->id]);
 return 0;
}
struct platform_device *usb_uart_plat_device1; /* Thiết bị nền tảng
 cho USB_UART 1 */
struct platform_device *usb_uart_plat_device2; /* Thiết bị nền tảng
 cho USB_UART 2 */
static struct platform_driver usb_uart_driver = {
 .probe = usb_uart_probe, /* Phương thức probe */
 .remove = __exit_p(usb_uart_remove), /* Phương thức gỡ bỏ */
```

```c
 .suspend = usb_uart_suspend, /* Power suspend */
 .resume = usb_uart_resume, /* Resume after a suspend */
 .driver = {
 .name = "usb_uart", /* Driver name */
 },
};
/* Driver Initialization */
static int __init
usb_uart_init(void)
{
 int retval;
 /* Register the USB_UART driver with the serial core */
 if ((retval = uart_register_driver(&usb_uart_reg))) {
 return retval;
 }
 /* Register platform device for USB_UART 1. Usually called
 during architecture-specific setup */
 usb_uart_plat_device1 =
 platform_device_register_simple("usb_uart", 0, NULL, 0);
 if (IS_ERR(usb_uart_plat_device1)) {
 uart_unregister_driver(&usb_uart_reg);
 return PTR_ERR(usb_uart_plat_device1);
 }
 /* Register platform device for USB_UART 2. Usually called
 during architecture-specific setup */
 usb_uart_plat_device2 =
 platform_device_register_simple("usb_uart", 1, NULL, 0);
 if (IS_ERR(usb_uart_plat_device2)) {
 uart_unregister_driver(&usb_uart_reg);
 platform_device_unregister(usb_uart_plat_device1);
 return PTR_ERR(usb_uart_plat_device2);
 }
 /* Announce a matching driver for the platform
 devices registered above */
 if ((retval = platform_driver_register(&usb_uart_driver))) {
 uart_unregister_driver(&usb_uart_reg);
 platform_device_unregister(usb_uart_plat_device1);
 platform_device_unregister(usb_uart_plat_device2);
 }
 return 0;
}
/* Driver Exit */
static void __exit
usb_uart_exit(void)
{
 /* The order of unregistration is important. Unregistering the
 UART driver before the platform driver will crash the system */
 /* Unregister the platform driver */
 platform_driver_unregister(&usb_uart_driver);
 /* Unregister the platform devices */
 platform_device_unregister(usb_uart_plat_device1);
```

```c
 platform_device_unregister(usb_uart_plat_device2);
 /* Unregister the USB_UART driver */
 uart_unregister_driver(&usb_uart_reg);
}
module_init(usb_uart_init);
module_exit(usb_uart_exit);
```

## RS-485

RS-485 không phải là một chuẩn giao tiếp PC phổ biến như RS-232, nhưng trong lĩnh vực hệ thống nhúng (embedded space), bạn có thể bắt gặp các máy tính sử dụng kết nối RS-485 để giao tiếp ổn định với các hệ thống điều khiển. RS-485 sử dụng tín hiệu vi sai (differential signals) cho phép trao đổi dữ liệu trên khoảng cách lên tới vài nghìn feet, khác với RS-232 chỉ có phạm vi vài chục feet. Về phía bộ xử lý (processor), giao diện RS-485 thực chất là một UART hoạt động ở chế độ bán song công (half-duplex mode). Do đó, trước khi truyền dữ liệu từ FIFO truyền (transmit FIFO) ra đường truyền, trình điều khiển thiết bị UART (UART device driver) cần kích hoạt bộ phát RS-485 và vô hiệu hóa bộ thu, thông qua việc thao tác trên các chân GPIO liên quan. Để nhận dữ liệu từ đường truyền vào FIFO nhận (receive FIFO), trình điều khiển UART phải thực hiện thao tác ngược lại.

Bạn phải bật/tắt bộ phát/bộ thu RS-485 tại đúng các vị trí trong tầng nối tiếp (serial layer). Nếu bạn tắt bộ phát quá sớm, nó có thể không có đủ thời gian để xả (drain) các byte cuối cùng từ FIFO truyền, điều này có thể dẫn đến việc mất mát/cắt cụt dữ liệu (data truncation). Ngược lại, nếu bạn tắt bộ phát quá muộn, bạn sẽ ngăn cản việc nhận dữ liệu trong khoảng thời gian đó, có thể dẫn đến mất dữ liệu nhận (receive data loss).

RS-485 hỗ trợ đa điểm (multidrop), vì vậy giao thức tầng trên (higher-layer protocol) phải triển khai một cơ chế đánh địa chỉ phù hợp nếu bạn có nhiều thiết bị được kết nối vào bus. RS-485 không hỗ trợ các đường điều khiển luồng phần cứng (hardware flow control lines) sử dụng tín hiệu *Request To Send* (RTS) và *Clear To Send* (CTS).

## Trình điều khiển TTY (TTY Drivers)

Bây giờ, chúng ta hãy xem xét các cấu trúc và hàm đăng ký cốt lõi của các trình điều khiển tty. Có ba cấu trúc quan trọng đối với hoạt động của chúng:

Cấu trúc `struct tty_struct` được định nghĩa trong *include/linux/tty.h*. Cấu trúc này chứa tất cả thông tin trạng thái liên quan đến một tty đang mở. Đây là một cấu trúc rất lớn, nhưng dưới đây là một số trường quan trọng: **1.**

```c
 struct tty_struct {
 int magic; /* Magic marker */
 struct tty_driver *driver; /* Pointer to the tty
 driver */
 struct tty_ldisc ldisc; /* Attached Line
 discipline */
 /* ... */
 struct tty_flip_buffer flip; /* Flip Buffer. See
 below. */
 /* ... */
 wait_queue_head_t write_wait; /* See the section
 "Line Disciplines" */
 wait_queue_head_t read_wait; /* See the section
 "Line Disciplines" */
 /* ... */
 };
```

Cấu trúc `struct tty_flip_buffer` hoặc *flip buffer* được nhúng bên trong `tty_struct`. Đây là trung tâm của cơ chế thu thập và xử lý dữ liệu: **2.**

```c
 struct tty_flip_buffer {
 /* ... */
 struct semaphore pty_sem; /* Serialize */
 char *char_buf_ptr; /* Pointer to the flip
 buffer */
 /* ... */
 unsigned char char_buf[2*TTY_FLIPBUF_SIZE]; /* The flip
 buffer */
 /* ... */
 };
```

Trình điều khiển nối tiếp mức thấp (low-level serial driver) sử dụng một nửa của flip buffer để thu thập dữ liệu, trong khi kỷ luật dòng (line discipline) sử dụng nửa còn lại để xử lý dữ liệu đó. Các con trỏ bộ nhớ đệm (buffer pointers) được sử dụng bởi trình điều khiển nối tiếp và kỷ luật dòng sau đó được hoán đổi (flipped), và quá trình tiếp tục diễn ra. Hãy xem hàm `flush_to_ldisc()` trong *drivers/char/tty_io.c* để thấy quá trình hoán đổi này hoạt động thực tế như thế nào.

Trong các phiên bản kernel gần đây, cấu trúc `tty_flip_buffer` đã được thiết kế lại phần nào. Nó hiện được cấu thành từ một phần đầu bộ đệm (`tty_bufhead`) và một danh sách bộ đệm (`tty_buffer`):

```
struct tty_bufhead {
 /* ... */
 struct semaphore pty_sem; /* Serialize */
```

```
 struct tty_buffer *head, tail, free; /* Xem bên dưới */
 /* ... */
};
struct tty_buffer {
 struct tty_buffer *next;
 char *char_buf_ptr; /* Con trỏ tới flip buffer */
 /* ... */
 unsigned long data[0]; /* Flip buffer, vùng nhớ cho nó
 được cấp phát động */
};
```

Cấu trúc `struct tty_driver` được định nghĩa trong *include/linux/tty_driver.h*. Cấu trúc này chỉ định giao diện lập trình giữa các tty driver và các tầng cao hơn: **3.**

```
struct tty_driver {
 int magic; /* Số Magic */
 /* ... */
 int major; /* Số Major */
 int minor_start; /* Bắt đầu số minor */
 /* ... */
 /* Các hàm giao diện giữa tty driver và các tầng cao hơn */
 int (*open)(struct tty_struct *tty, struct file *filp);
 void (*close)(struct tty_struct *tty, struct file *filp);
 int (*write)(struct tty_struct *tty,
 const unsigned char *buf, int count);
 void (*put_char)(struct tty_struct *tty,
 unsigned char ch);
 /* ... */
};
```

Giống như một UART driver, một tty driver cần thực hiện hai bước để đăng ký chính nó với nhân hệ thống (kernel):

- **1.** Gọi `tty_register_driver(struct tty_driver *tty_d)` để đăng ký chính nó với tty core.
- **2.** Gọi

```
tty_register_device(struct tty_driver *tty_d,
 unsigned device_index,
 struct device *device)
```

để đăng ký từng thiết bị tty riêng lẻ mà nó hỗ trợ.

Chúng ta sẽ không phát triển một tty driver mẫu, nhưng dưới đây là một số driver phổ biến được sử dụng trên Linux:

- Mô phỏng cổng nối tiếp (serial emulation) qua Bluetooth, được thảo luận trong Chương 16, được hiện thực dưới dạng một tty driver. Driver này (*drivers/net/bluetooth/rfcomm/tty.c*) gọi `tty_register_driver()` trong quá trình khởi tạo (initialization) và gọi `tty_register_device()` khi xử lý từng kết nối Bluetooth đến.
- Để làm việc với console của hệ thống trên Linux desktop, bạn cần các dịch vụ của *virtual terminal* (VT) nếu bạn đang ở chế độ văn bản (text mode) hoặc *pseudo terminal* (PTY) nếu bạn đang ở chế độ đồ họa (graphics mode). VT và PTY được hiện thực dưới dạng các tty driver và nằm lần lượt trong *drivers/char/vt.c* và *drivers/char/pty.c*.
- Tty driver được sử dụng qua các UART thông thường nằm trong *drivers/serial/serial_core.c*.
- Tty driver cho USB-serial nằm trong *drivers/usb/serial/usb-serial.c*.

## Line Disciplines (Kỷ luật đường truyền)

Line disciplines cung cấp một cơ chế tao nhã cho phép bạn sử dụng cùng một serial driver để chạy các công nghệ khác nhau. Trình điều khiển vật lý mức thấp (low-level physical driver) và tty driver xử lý việc truyền dữ liệu đến và đi từ phần cứng, trong khi các line discipline chịu trách nhiệm xử lý dữ liệu và chuyển đổi dữ liệu giữa kernel space (không gian nhân) và user space (không gian người dùng).

Hệ thống con serial hỗ trợ 17 tiêu chuẩn line discipline mặc định. Line discipline mặc định được đính kèm khi bạn mở một cổng serial (serial port) là `N_TTY`, cấu trúc này thực hiện việc xử lý I/O của terminal. `N_TTY` chịu trách nhiệm "xử lý" (cooking) các ký tự nhận được từ bàn phím. Tùy thuộc vào yêu cầu của người dùng, nó ánh xạ ký tự điều khiển thành ký tự xuống dòng, chuyển đổi chữ thường thành chữ hoa, mở rộng các tab và hiển thị lại (echo) các ký tự ra VT tương ứng. `N_TTY` cũng hỗ trợ chế độ *raw* (thô) được sử dụng bởi các trình soạn thảo, chế độ này để lại toàn bộ quá trình xử lý trước đó cho các ứng dụng người dùng. Xem Hình 7.3 trong chương tiếp theo, "Input Drivers" (Các trình điều khiển đầu vào), để tìm hiểu cách hệ thống con bàn phím được kết nối với `N_TTY`. Các tty driver mẫu được liệt kê ở cuối phần trước, "TTY Drivers", sử dụng `N_TTY` theo mặc định.

Các line discipline cũng hiện thực các giao diện mạng qua các giao thức truyền dẫn serial. Ví dụ, các line discipline là một phần của hệ thống con *Point-to-Point Protocol* (N_PPP) và *Serial Line Internet Protocol* (N_SLIP), thực hiện đóng gói các gói tin (frame packets), cấp phát và điền thông tin vào các cấu trúc dữ liệu mạng liên quan, sau đó chuyển dữ liệu sang ngăn xếp giao thức mạng (network protocol stack) tương ứng. Các line discipline khác xử lý *Infrared Data* (N_IRDA) và *Bluetooth Host Control Interface* (N_HCI).

### Ví dụ về Thiết bị: Bộ điều khiển Cảm ứng (Touch Controller)

Hãy cùng tìm hiểu sâu hơn về hoạt động bên trong của một line discipline (kỷ luật đường truyền) thông qua việc hiện thực hóa một line discipline đơn giản cho một bộ điều khiển màn hình cảm ứng nối tiếp (serial touchscreen controller). Hình 6.6 minh họa cách bộ điều khiển cảm ứng được kết nối trên một hệ thống máy tính xách tay nhúng phái sinh. *Máy trạng thái hữu hạn* (*Finite State Machine* - FSM) của bộ điều khiển cảm ứng là một ứng cử viên sáng giá để được hiện thực hóa dưới dạng một line discipline, vì nó có thể tận dụng các tiện ích và giao diện do tầng serial (serial layer) cung cấp.

**Hình 6.6. Sơ đồ kết nối của bộ điều khiển cảm ứng trên một thiết bị phái sinh từ PC.**

#### Mở và Đóng (Open and Close)

Để tạo một line discipline, hãy định nghĩa một `struct tty_ldisc` và đăng ký một tập hợp các điểm đầu vào (entry points) được quy định với kernel (nhân hệ điều hành). Liệt kê 6.2 chứa một đoạn mã thực hiện cả hai thao tác này cho ví dụ bộ điều khiển cảm ứng.

#### Liệt kê 6.2. Các Thao tác của Line Discipline

```c
struct tty_ldisc n_touch_ldisc = {
 TTY_LDISC_MAGIC, /* Magic */
 "n_tch", /* Tên của line discipline */
 N_TCH, /* Số định danh ID của line discipline */
 n_touch_open, /* Mở line discipline */
 n_touch_close, /* Đóng line discipline */
 n_touch_flush_buffer, /* Xóa bộ đệm đọc (read buffer) của line discipline */
 n_touch_chars_in_buffer, /* Lấy số lượng ký tự đã xử lý trong bộ đệm đọc của line discipline */
 n_touch_read, /* Được gọi khi dữ liệu được yêu cầu từ không gian người dùng (user space) */
 n_touch_write, /* Phương thức ghi (write method) */
 n_touch_ioctl, /* Các lệnh điều khiển I/O (I/O Control) */
 NULL, /* Chúng ta không có hàm set_termios */
 n_touch_poll, /* Poll */
 n_touch_receive_buf, /* Được gọi bởi trình điều khiển tầng thấp (low-level driver) để truyền dữ liệu tới user space*/
 n_touch_receive_room, /* Trả về dung lượng còn trống trong bộ đệm đọc của line discipline */
 n_touch_write_wakeup /* Được gọi khi trình điều khiển thiết bị tầng thấp sẵn sàng truyền thêm dữ liệu */
};
/* ... */
if ((err = tty_register_ldisc(N_TCH, &n_touch_ldisc))) {
 return err;
}
```

Trong Liệt kê 6.2, `n_tch` là tên của line discipline và `N_TCH` là số định danh của line discipline. Bạn phải chỉ định giá trị của `N_TCH` trong `include/linux/tty.h`, tệp tiêu đề (header file) chứa tất cả các định nghĩa line discipline. Các line discipline đang hoạt động trên hệ thống của bạn có thể được tìm thấy trong `/proc/tty/ldiscs`.

Các line discipline thu thập dữ liệu từ nửa phần của chúng trong bộ đệm lật tty (tty flip buffer), xử lý dữ liệu đó và sao chép dữ liệu kết quả vào một bộ đệm *read* cục bộ. Đối với `N_TCH`, hàm `n_touch_receive_room()` trả về dung lượng bộ nhớ còn lại trong bộ đệm đọc, trong khi `n_touch_chars_in_buffer()` trả về số lượng ký tự đã xử lý trong bộ đệm đọc sẵn sàng được chuyển giao cho user space. `n_touch_write()` và `n_touch_write_wakeup()` không làm gì cả vì `N_TCH` là thiết bị chỉ đọc (read-only). `n_touch_open()` đảm nhận việc cấp phát bộ nhớ cho các cấu trúc dữ liệu chính của line discipline, như được hiển thị trong Liệt kê 6.3.

#### Liệt kê 6.3. Mở Line Discipline

```c
/* Cấu trúc riêng tư được sử dụng để hiện thực hóa Máy trạng thái hữu hạn (FSM) 
cho bộ điều khiển cảm ứng. Bộ điều khiển và bộ vi xử lý giao tiếp với nhau 
bằng một giao thức cụ thể mà FSM hiện thực hóa */
struct n_touch {
 int current_state; /* Máy trạng thái hữu hạn (Finite State Machine) */
 spinlock_t touch_lock; /* Khóa quay (Spinlock) */
 struct tty_struct *tty; /* Cấu trúc tty liên kết */
 /* Thống kê và các tác vụ quản trị khác */
 /* ... */
} *n_tch;
/* Mở thiết bị open() */
static int
n_touch_open(struct tty_struct *tty)
{
 /* Cấp phát bộ nhớ cho n_tch */
 if (!(n_tch = kmalloc(sizeof(struct n_touch), GFP_KERNEL))) {
 return -ENOMEM;
 }
 memset(n_tch, 0, sizeof(struct n_touch));
 tty->disc_data = n_tch; /* Các điểm đầu vào khác giờ đây có thể truy cập trực tiếp vào n_tch */
 /* Cấp phát bộ nhớ đệm đọc cục bộ của line discipline 
 được sử dụng để sao chép dữ liệu ra khỏi tty flip buffer */
 tty->read_buf = kmalloc(BUFFER_SIZE, GFP_KERNEL);
 if (!tty->read_buf) return -ENOMEM;
 /* Xóa sạch bộ đệm đọc */
 memset(tty->read_buf, 0, BUFFER_SIZE);
 /* Khởi tạo khóa */
 spin_lock_init(&ntch->touch_lock);
 /* Khởi tạo các trường tty cần thiết khác. 
 Xem drivers/char/n_tty.c để biết ví dụ */
 /* ... */
 return 0;
}
```

Bạn có thể muốn thiết lập `N_TCH` làm line discipline mặc định (thay vì `N_TTY`) bất cứ khi nào cổng nối tiếp được kết nối với bộ điều khiển cảm ứng được mở. Hãy tham khảo phần "Thay đổi Line Discipline" ("Changing Line Disciplines") để xem cách thay đổi các line discipline từ user space.

#### Luồng Đọc (Read Path)

Đối với các thiết bị điều khiển bằng ngắt (interrupt-driven devices), luồng dữ liệu đọc thường bao gồm hai luồng (thread) hoạt động song song:

**1.** Một luồng phía trên (top thread) bắt nguồn từ tiến trình người dùng (user process) yêu cầu đọc.

**2.** Một luồng phía dưới (bottom thread) xuất phát từ trình phục vụ ngắt (interrupt service routine) thu thập dữ liệu từ thiết bị.

Hình 6.7 minh họa các luồng này được liên kết với luồng dữ liệu đọc. Trình xử lý ngắt (interrupt handler) đưa phương thức `receive_buf()` (`n_touch_receive_buf()` trong ví dụ của chúng ta) vào hàng đợi như một tác vụ (task). Bạn có thể ghi đè hành vi này bằng cách thiết lập cờ `tty->low_latency`.

```
                             read()

        Terminal I/O                           Network I/O
          (TTY, TCH)                 (PPP, SLIP, Bluetooth, IrDA)
               \                                  /
                \                                /
                 v                              v
              tty_read()              Networking Protocols
                 ^                             ^
                 |                             |
      ------------ Ranh giới User Space / Kernel Space ------------

                         Tầng Line Discipline
      -----------------------------------------------------------------
      { Bộ đệm đọc cục bộ (tty->read_buf) }          { sk_buff }

            ldisc.read()  --read_wait_queue-->  ldisc.receive_buf()
                    |                             ^         |
                    | Unthrottle                  |         |Throttle
                    v                             |         v 
             ldisc.chars_in_buf()                 |     ldisc.receive_room()
                                                  |
                                                  |
                                  ----------- queue_task -------------
                                                   ^
                                                   |
                                                   |
                                        tty_flip_buffer_push()      { Bộ đệm lật (tty->flip.char_buf) }
                                                   ^
                                                   |
                                                Serial ISR
```

**Hình 6.7. Đường dẫn đọc của line discipline.**

Bộ điều khiển cảm ứng (touch controller) và bộ vi xử lý (processor) giao tiếp với nhau bằng một giao thức cụ thể được mô tả trong bảng thông số kỹ thuật (data sheet) của bộ điều khiển. Trình điều khiển (driver) triển khai giao thức giao tiếp này bằng cách sử dụng một FSM (Finite State Machine - Máy trạng thái hữu hạn) như đã nêu trước đó. Liệt kê 6.4 mã hóa FSM này như một phần của điểm vào nhận dữ liệu `receive_buf()`, cụ thể là `n_touch_receive_buf()`.

**Liệt kê 6.4. Phương thức n_touch_receive_buf()**

```
static void
n_touch_receive_buf(struct tty_struct *tty,
 const unsigned char *cp, char *fp, int count)
{
 /* Work on the data in the line discipline's half of
 the flip buffer pointed to by cp */
 /* ... */
 /* Implement the Finite State Machine to interpret commands/data
 arriving from the touch controller and put the processed data
 into the local read buffer */
....................................................................................
 /* Datasheet-dependent Code Region */
 switch (tty->disc_data->current_state) {
 case RESET:
 /* Issue a reset command to the controller */
 tty->driver->write(tty, 0, mode_stream_command,
 sizeof(mode_stream_command));
 tty->disc_data->current_state = STREAM_DATA;
 /* ... */
 break;
 case STREAM_DATA:
 /* ... */
 break;
 case PARSING:
 /* ... */
 tty->disc_data->current_state = PARSED;
 break;
 case PARSED:
 /* ... */
 }
....................................................................................
 if (tty->disc_data->current_state == PARSED) {
 /* If you have a parsed packet, copy the collected coordinate
 and direction information into the local read buffer */
 spin_lock_irqsave(&tty->disc_data->touch_lock, flags);
 for (i=0; i < PACKET_SIZE; i++) {
 tty->disc_data->read_buf[tty->disc_data->read_head] =
 tty->disc_data->current_pkt[i];
 tty->disc_data->read_head =
 (tty->disc_data->read_head + 1) & (BUFFER_SIZE - 1);
 tty->disc_data->read_cnt++;
 }
 spin_lock_irqrestore(&tty->disc_data->touch_lock, flags);
 /* ... */ /* See Listing 6.5 */
 }
}
```

`n_touch_receive_buf()` xử lý dữ liệu đến từ trình điều khiển nối tiếp (serial driver). Hàm này trao đổi một chuỗi các lệnh và phản hồi với bộ điều khiển cảm ứng, đồng thời đưa thông tin tọa độ và hướng (nhấn/nhả) nhận được vào bộ đệm đọc (read buffer) của line discipline. Các thao tác truy cập vào bộ đệm đọc phải được tuần tự hóa (serialized) bằng cách sử dụng một khóa quay (spinlock) vì nó được sử dụng bởi cả hai luồng (thread) `ldisc.receive_buf()` và `ldisc.read()` được minh họa trong Hình 6.7 (lần lượt là `n_touch_receive_buf()` và `n_touch_read()` trong ví dụ của chúng ta). Như bạn có thể thấy trong Liệt kê 6.4, `n_touch_receive_buf()` gửi các lệnh đến bộ điều khiển cảm ứng bằng cách gọi trực tiếp điểm vào `write()` của trình điều khiển nối tiếp.

`n_touch_receive_buf()` cần thực hiện thêm một vài công việc sau:

- Luồng đọc (`read()`) phía trên trong Hình 6.7 sẽ đưa tiến trình gọi (calling process) vào trạng thái ngủ nếu không có sẵn dữ liệu. Do đó, `n_touch_receive_buf()` phải đánh thức luồng đó dậy và cho phép nó đọc dữ liệu vừa được xử lý. **1.**
- Nếu line discipline sắp cạn kiệt không gian bộ đệm đọc, `n_touch_receive_buf()` phải yêu cầu trình điều khiển nối tiếp tiết chế (throttle) dữ liệu đến từ thiết bị. `ldisc.read()` chịu trách nhiệm yêu cầu hủy tiết chế (unthrottling) tương ứng khi nó chuyển dữ liệu đến không gian người dùng (user space) và giải phóng bộ nhớ trong bộ đệm đọc. Trình điều khiển nối tiếp sử dụng các cơ chế điều khiển luồng (flow control) bằng phần mềm hoặc phần cứng để thực hiện việc tiết chế và hủy tiết chế này. **2.**

Liệt kê 6.5 thực hiện hai thao tác này.

#### Liệt kê 6.5. Đánh thức luồng đọc và tiết chế trình điều khiển nối tiếp

```
/* n_touch_receive_buf() continued.. */
/* Wake up any threads waiting for data */
if (waitqueue_active(&tty->read_wait) &&
 (tty->read_cnt >= tty->minimum_to_wake))
 wake_up_interruptible(&tty->read_wait);
}
/* If we are running out of buffer space, request the
 serial driver to throttle incoming data */
if (n_touch_receive_room(tty) < TOUCH_THROTTLE_THRESHOLD) {
 tty->driver.throttle(tty);
}
/* ... */
```

Một hàng đợi chờ (`wait queue` - `tty->read_wait`) được sử dụng để đồng bộ hóa giữa các luồng `ldisc.read()` và `ldisc.receive_buf()`. `ldisc.read()` thêm tiến trình gọi vào hàng đợi chờ khi nó không tìm thấy dữ liệu để đọc, trong khi `n_touch_receive_buf()` đánh thức luồng `ldisc.read()` khi có sẵn dữ liệu để đọc. Do đó, `n_touch_read()` thực hiện các bước sau:

- Nếu chưa có dữ liệu để đọc, hãy đặt tiến trình gọi vào trạng thái ngủ trên hàng đợi `read_wait`. Tiến trình sẽ được đánh thức bởi `n_touch_receive_buf()` khi có dữ liệu đến.
- Nếu có sẵn dữ liệu, hãy thu thập dữ liệu đó từ bộ đệm đọc cục bộ (`tty->read_buf[tty->read_tail]`) và chuyển nó đến không gian người dùng (user space).
- Nếu trình điều khiển nối tiếp đã bị tiết chế và nếu còn đủ dung lượng trống trong bộ đệm đọc sau lần đọc này, hãy yêu cầu trình điều khiển nối tiếp hủy tiết chế.

Các line discipline mạng (networking line disciplines) thường cấp phát một `sk_buff` (cấu trúc dữ liệu mạng cơ bản của Linux được thảo luận trong Chương 15, "Card Giao diện Mạng" - Network Interface Cards) và sử dụng cấu trúc này làm bộ đệm đọc. Chúng không có phương thức `read()`, bởi vì phương thức `receive_buf()` tương ứng sẽ sao chép dữ liệu đã nhận vào `sk_buff` được cấp phát và chuyển tiếp trực tiếp nó đến ngăn xếp giao thức (protocol stack) liên quan.

#### Đường dẫn Ghi (Write Path)

Điểm vào (entry point) `write()` của một line discipline thực hiện bất kỳ hoạt động hậu xử lý (post-processing) nào cần thiết trước khi truyền dữ liệu xuống tầng driver mức thấp (low-level driver).

Nếu driver bên dưới không thể tiếp nhận toàn bộ dữ liệu mà line discipline cung cấp, line discipline sẽ đưa tiến trình (process/thread) đang yêu cầu vào trạng thái ngủ (sleep). Trình xử lý ngắt (interrupt handler) của driver sẽ đánh thức line discipline khi nó sẵn sàng nhận thêm dữ liệu. Để làm điều này, driver gọi phương thức `write_wakeup()` đã được đăng ký bởi line discipline. Quá trình đồng bộ hóa (synchronization) liên quan được thực hiện bằng cách sử dụng một hàng đợi chờ (wait queue - `tty->write_wait`), và thao tác này tương tự như hàng đợi chờ `read_wait` đã được mô tả trong phần trước.

Nhiều line discipline mạng không có phương thức `write()`. Việc triển khai giao thức sẽ truyền các khung (frame) trực tiếp xuống driver thiết bị nối tiếp (serial device driver). Tuy nhiên, các line discipline này thường vẫn có điểm vào `write_wakeup()` để phản hồi lại yêu cầu cần thêm dữ liệu truyền đi từ serial driver.

`N_TCH` cũng không cần phương thức `write()`, bởi vì bộ điều khiển cảm ứng (touch controller) là một thiết bị chỉ đọc (read-only device). Như bạn đã thấy trong Bảng liệt kê (Listing) 6.4, các hàm định rutina trong đường dẫn nhận (receive path) giao tiếp trực tiếp với driver UART mức thấp khi chúng cần gửi các khung lệnh đến bộ điều khiển.

#### Điều khiển Nhập/Xuất (I/O Control)

Một chương trình người dùng (user program) có thể gửi các lệnh đến một thiết bị thông qua các lời gọi `ioctl()`, như đã thảo luận trong Chương 5, "Driver Ký tự" (Character Drivers). Khi một ứng dụng mở một thiết bị nối tiếp (serial device), nó thường có thể phát ra ba nhóm lệnh `ioctl` tới thiết bị đó:

- Các lệnh được hỗ trợ bởi serial device driver, chẳng hạn như `TIOCMSET` dùng để thiết lập thông tin modem.
- Các lệnh được hỗ trợ bởi tty driver, chẳng hạn như `TIOCSETD` dùng để thay đổi line discipline được gắn kết.
- Các lệnh được hỗ trợ bởi line discipline đang gắn kết, chẳng hạn như lệnh đặt lại (reset) bộ điều khiển cảm ứng trong trường hợp của `N_TCH`.

Việc triển khai `ioctl()` cho `N_TCH` nhìn chung là chuẩn hóa. Các lệnh được hỗ trợ phụ thuộc vào giao thức được mô tả trong bảng dữ liệu (data sheet) của bộ điều khiển cảm ứng.

#### Các Thao Tác Khác

Một thao tác line discipline khác là `flush_buffer()`, được sử dụng để xả (flush) bất kỳ dữ liệu nào đang chờ xử lý trong bộ đệm đọc (read buffer). `flush_buffer()` cũng được gọi khi một line discipline bị đóng. Nó đánh thức bất kỳ tiến trình đọc (read thread) nào đang chờ thêm dữ liệu như sau:

```c
if (tty->link->packet){
 wake_up_interruptible(&tty->disc_data->read_wait);
}
```

Một điểm vào khác (không được hỗ trợ bởi `N_TCH`) là `set_termios()`. Line discipline `N_TTY` hỗ trợ giao diện `set_termios()`, được sử dụng để thiết lập các tùy chọn đặc thù cho việc xử lý dữ liệu của line discipline. Ví dụ, bạn có thể sử dụng `set_termios()` để đưa line discipline vào chế độ thô (raw mode) hoặc chế độ đã qua xử lý ("cooked" mode). Một số tùy chọn dành riêng cho bộ điều khiển cảm ứng (chẳng hạn như thay đổi tốc độ baud, độ chẵn lẻ - parity, và số bit dừng - stop bits) được triển khai bởi phương thức `set_termios()` của driver thiết bị bên dưới.

Các điểm vào còn lại như `poll()` khá chuẩn, và bạn có thể quay lại Chương 5 nếu cần hỗ trợ thêm.

Bạn có thể biên dịch line discipline của mình như một phần của kernel hoặc tải nó động dưới dạng một module. Nếu bạn chọn biên dịch nó dưới dạng module, tất nhiên bạn cũng phải cung cấp các hàm sẽ được gọi trong quá trình khởi tạo và thoát module. Hàm khởi tạo thường giống với phương thức `init()`. Hàm thoát cần phải dọn dẹp các cấu trúc dữ liệu riêng tư (private data structures) và hủy đăng ký (unregister) line discipline. Việc hủy đăng ký line discipline chỉ gồm một dòng lệnh:

```c
tty_unregister_ldisc(N_TCH);
```

Một cách dễ dàng hơn để điều khiển một serial touch controller là tận dụng các dịch vụ được cung cấp bởi hệ thống con *input* (input subsystem) của kernel và line discipline tích hợp sẵn *serport*. Chúng ta sẽ tìm hiểu kỹ thuật đó trong chương tiếp theo.

#### Thay Đổi Line Disciplines

`N_TCH` được liên kết (bind) với driver serial mức thấp khi một chương trình ở không gian người dùng (user space program) mở cổng serial được kết nối với bộ điều khiển cảm ứng. Nhưng đôi khi, một ứng dụng ở user space có thể muốn gắn một line discipline khác vào thiết bị. Ví dụ, bạn có thể muốn viết một chương trình kết xuất (dump) dữ liệu thô nhận được từ bộ điều khiển cảm ứng mà không cần xử lý nó. Bảng liệt kê 6.6 mở bộ điều khiển cảm ứng và thay đổi line discipline thành `N_TTY` để kết xuất dữ liệu đang đi vào.

#### Bảng liệt kê 6.6. Thay đổi một Line Discipline từ Không gian Người dùng (User Space)

```c
fd = open("/dev/ttySX", O_RDONLY | O_NOCTTY);
/* Tại thời điểm này, N_TCH được gắn vào /dev/ttySX, cổng serial được sử dụng
 bởi touch controller. Chuyển sang N_TTY */
ldisc = N_TTY;
ioctl(fd, TIOCSETD, &ldisc);
/* Đặt termios sang chế độ raw và kết xuất dữ liệu đi vào */
/* ... */
```

Lời gọi `ioctl()` `TIOCSETD` sẽ đóng line discipline hiện tại và mở line discipline mới được yêu cầu.

## Xem Xét Mã Nguồn

Lõi serial (serial core) nằm trong thư mục *drivers/serial/*, nhưng các cấu trúc triển khai tty và low-level driver lại nằm rải rác khắp cây mã nguồn (source tree). Các tệp driver được đề cập trong Hình 6.3, ví dụ, nằm trong bốn thư mục khác nhau: *drivers/serial/, drivers/char/, drivers/usb/serial/*, và *drivers/net/irda/*. Thư mục *drivers/serial/_, nơi hiện tại cũng chứa các driver UART, đã không tồn tại trong nhân 2.4 (2.4 kernel); mã nguồn dành riêng cho UART trước đây từng bị phân tán giữa các thư mục _drivers/char/* và *arch/your-arch/*. Việc phân vùng mã nguồn hiện tại hợp lý hơn vì các UART driver không phải là những đối tượng duy nhất truy cập vào tầng serial — các thiết bị như bộ chuyển đổi USB sang serial (USB-to-serial converters) và cổng hồng ngoại IrDA cũng cần giao tiếp với serial core.

Hãy tham khảo *drivers/serial/imx.c* để xem một driver UART (UART driver) mức thấp (low-level) thực tế. Nó xử lý các UART nằm trong dòng bộ điều khiển nhúng (embedded controller) i.MX của Freescale.

Để có danh sách các line discipline được hỗ trợ trên Linux, hãy xem *include/linux/tty.h*. Để nắm bắt về các line discipline mạng (networking line discipline), hãy xem các tệp mã nguồn tương ứng cho PPP (*drivers/net/ppp\_async.c*), Bluetooth (*drivers/bluetooth/hci\_ldisc.c*), Hồng ngoại (Infrared) (*drivers/net/irda/irtty-sir.c*), và SLIP (*drivers/net/slip.c*).

Bảng 6.3 chứa tóm tắt các cấu trúc dữ liệu (data structure) chính được sử dụng trong chương này và vị trí định nghĩa của chúng trong cây mã nguồn (source tree). Bảng 6.4 liệt kê các giao diện lập trình kernel (kernel programming interface) chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

**Bảng 6.3. Tóm tắt các Cấu trúc Dữ liệu**

| Cấu trúc Dữ liệu             | Vị trí                        | Mô tả                                                                       |
|----------------------------|---------------------------------|-----------------------------------------------------------------------------|
| uart_driver                | include/linux/serial_core.h     | Sự thể hiện của một driver UART<br>mức thấp.                                |
| uart_port                  | include/linux/serial_core.h     | Sự thể hiện của một cổng UART.                                              |
| uart_ops                   | include/linux/serial_core.h     | Các điểm vào (entry point) được hỗ trợ bởi<br>driver UART.                   |
| platform_device            | include/linux/platform_device.h | Sự thể hiện của một thiết bị nền tảng<br>(platform device).                 |
| platform_driver            | include/linux/platform_device.h | Sự thể hiện của một driver nền tảng<br>(platform driver).                   |
| tty_struct                 | include/linux/tty.h             | Thông tin trạng thái về một tty.                                            |
| tty_bufhead,<br>tty_buffer | include/linux/tty.h             | Hai cấu trúc này thực thi<br>flip buffer được liên kết với một tty.         |
| tty_driver                 | include/linux/tty_driver.h      | Giao diện lập trình giữa các driver<br>tty và các tầng cao hơn.               |
| tty_ldisc                  | include/linux/tty_ldisc.h       | Các điểm vào được hỗ trợ bởi một<br>line discipline.                         |

**Bảng 6.4. Tóm tắt các Giao diện Lập trình Kernel**

| Giao diện Kernel                                                                          | Vị trí                        | Mô tả                                                                  |
|-------------------------------------------------------------------------------------------|-------------------------------|------------------------------------------------------------------------|
| uart_register_driver()                                                                    | drivers/serial/sderial_core.c | Đăng ký một driver UART với serial core                                |
| uart_add_one_port()                                                                       | drivers/serial/sderial_core.c | Đăng ký một cổng UART được hỗ trợ<br>bởi driver UART                    |
| uart_unregister_driver()                                                                  | drivers/serial/sderial_core.c | Gỡ bỏ một driver UART khỏi serial core                                 |
| platform_device register()<br>platform_device_register_simple()<br>platform_add_devices() | drivers/base/platform.c       | Đăng ký một thiết bị nền tảng (platform device)                        |
| platform_device_unregister()                                                              | drivers/base/platform.c       | Hủy đăng ký một thiết bị nền tảng                                      |
| platform_driver_register()/<br>platform_driver_unregister()                               | drivers/base/platform.c       | Đăng ký/hủy đăng ký một driver nền tảng<br>(platform driver)             |
| tty_insert_flip_char()                                                                    | include/linux/tty_flip.h      | Thêm một ký tự vào tty flip buffer                                     |
| tty_flip_buffer_push()                                                                    | drivers/char/tty_io.c         | Xếp hàng yêu cầu đẩy (push) flip buffer<br>đến line discipline          |
| tty_register_driver()                                                                     | drivers/char/tty_io.c         | Đăng ký một driver tty với serial core                                 |
| tty_unregister_driver()                                                                   | drivers/char/tty_io.c         | Gỡ bỏ một driver tty khỏi serial core                                  |

| tty_register_ldisc()                                                                      | drivers/char/tty_io.c         | Tạo một line discipline bằng cách<br>đăng ký các điểm vào (entry points)<br>đã quy định |
| tty_unregister_ldisc()                                                                    | drivers/char/tty_io.c         | Gỡ bỏ một line discipline khỏi<br>serial core                      |

Một số kịch bản truyền dữ liệu nối tiếp (serial data transfer) rất phức tạp. Bạn có thể cần kết hợp và phối hợp các khối tầng serial khác nhau, như bạn đã thấy ở Hình 6.3. Một số tình huống có thể đòi hỏi đường đi dữ liệu (data path) phải đi qua nhiều line discipline. Ví dụ, việc thiết lập kết nối quay số (dialup connection) qua Bluetooth liên quan đến quá trình luân chuyển dữ liệu thông qua HCI line discipline cũng như PPP line discipline. Nếu có thể, hãy thiết lập một kết nối như vậy và bước qua luồng mã nguồn (code flow) bằng một kernel debugger.

Hãy xem phần cài đặt của mousedev (*drivers/input/mousedev.c*) để có một ví dụ hoàn chỉnh.
