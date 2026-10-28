# Chương 11: Bus nối tiếp vạn năng (USB - Universal Serial Bus)

| Trong chương này                 |     |
|-----------------------------------|-----|
| Kiến trúc USB                     | 312 |
| Hệ thống con Linux-USB            | 317 |
| Cấu trúc dữ liệu của Driver       | 317 |
| Quá trình định danh (Enumeration) | 324 |
| Ví dụ thiết bị: Thẻ đo từ xa      | 324 |
| Driver Lớp (Class Drivers)        | 338 |
| Driver Gadget (Gadget Drivers)    | 348 |
| Gỡ lỗi (Debugging)                | 349 |
| Khảo sát mã nguồn                  | 351 |
|                                   |     |

*Universal Serial Bus* (USB) là bus ngoại vi thực tế (de facto) trong các máy tính hiện đại. Với sự hỗ trợ cho cắm nóng (hotplugging), các driver lớp tổng quát (generic class drivers), và các chế độ truyền dữ liệu linh hoạt, USB là tuyến đường thông thường trong lĩnh vực điện tử tiêu dùng để mang lại một phổ công nghệ đa dạng cho các hệ thống máy tính. Sự phổ biến rộng rãi cùng với tính kinh tế theo quy mô đi kèm đã đóng một phần trong việc thúc đẩy sự chấp nhận và ứng dụng các công nghệ thiết bị ngoại vi máy tính trên toàn thế giới.

**Kiến trúc USB**

USB là một giao thức chủ-tớ (master-slave) trong đó bộ điều khiển host (host controller) giao tiếp với các thiết bị client. Hình 11.1 thể hiện USB trong môi trường máy tính cá nhân (PC). Bộ điều khiển host USB là một phần của chipset Cầu Nam (South Bridge) và giao tiếp với bộ xử lý (processor) qua bus PCI.

```
                 [ Processor ]
                       ^
                       |
                       v
                 [ North Bridge ]
                       ^
                       |
                       v
                 +---------------------------+
                 |            [ USB Host     |[ South Bridge ]
                 | PCI Bus ->   Controller ] |
                 +---------------------------+
                             |
                             |  
                 |-----------|---------------------|
                 |                                 |
                 |                                 |
      [ USB Host Transceiver ]            [ USB Host Transceiver ]
                 |                                   |
                 v                                   v
           [ 'A' Connector ]                   [ 'A' Connector ]
                 ^                                   ^
                 |                                   |
           [ USB Device ]                       [ USB Device ]
```

**Hình 11.1. USB trong môi trường máy tính cá nhân (PC).**

Hình 11.2 minh họa USB trên một thiết bị nhúng (embedded device). SoC trong hình có tích hợp sẵn phần cứng bộ điều khiển USB hỗ trợ bốn bus và ba chế độ hoạt động:

- Bus 1 chạy ở chế độ host và được nối dây với một ổ cắm loại A (A-type receptacle) thông qua một bộ thu phát USB (USB transceiver) (xem phần thông tin bên lề "Ổ cắm và Bộ thu phát USB"). Bạn có thể kết nối một ổ đĩa USB (pen drive) hoặc bàn phím vào cổng này.
- Bus 2 cũng hoạt động ở chế độ host nhưng bộ thu phát liên kết được kết nối với một thiết bị USB nội bộ (internal USB device) thay vì ổ cắm. Các ví dụ về thiết bị USB nội bộ bao gồm máy quét sinh học, các engine mã hóa, máy in, *Disk-On-Chips* (DOCs), bộ điều khiển cảm ứng, và các thẻ đo từ xa (telemetry cards).
- Bus 3 chạy ở chế độ thiết bị (device mode) và được nối dây với ổ cắm loại B (B-type receptacle) thông qua một bộ thu phát. Ổ cắm loại B kết nối với máy tính host thông qua cáp B-to-A. Trong chế độ này, thiết bị nhúng hoạt động, ví dụ như một ổ đĩa USB, và xuất một phân khúc lưu trữ (storage partition) ra thế giới bên ngoài. Các thiết bị nhúng như máy nghe nhạc MP3 và điện thoại di động có khả năng nằm ở phía thiết bị (device side) của USB cao hơn so với hệ thống PC, vì vậy nhiều SoC nhúng hỗ trợ bộ điều khiển thiết bị USB (USB device controller) bên cạnh bộ điều khiển host.
- Bus 4 được điều khiển bởi một bộ điều khiển *On-The-Go* (OTG). Bạn có thể sử dụng cổng này, ví dụ, để kết nối một ổ đĩa USB vào hệ thống của mình hoặc biến hệ thống thành một ổ đĩa USB và kết nối nó với một host. Không giống như các bus từ 1 đến 3, bus 4 sử dụng một bộ thu phát thông minh trao đổi thông tin điều khiển với bộ xử lý qua I2C. Bộ thu phát được nối dây với ổ cắm Mini-AB OTG. Nếu hai thiết bị nhúng hỗ trợ OTG, chúng có thể trực tiếp giao tiếp với nhau mà không cần sự can thiệp của máy tính host.

```
+------------------------------------------------------------------+
|                        Embedded SoC                              |
|                                                                  |
|   +------------------+                                           |
|   |     CPU Core     |                                           |
|   +------------------+                                           |
|            |                                                     |
|      Internal Local Bus                                          |
|            |                                                     |
|   +------------------+                                           |
|   | LCD Controller   |                                           |
|   +------------------+                                           |
|                                                                  |
|   +----------------------------------------------------------+   |
|   |                     USB Controller                       |   |
|   |----------------------------------------------------------|   |
|   | Host Controller  (Bus 1)                                |---+----> USB Host Transceiver
|   | Host Controller  (Bus 2)                                |---+----> USB Host Transceiver
|   | Device Controller (Bus 3)                               |---+----> USB Device Transceiver
|   | OTG Controller    (Bus 4)                               |---+----> USB OTG Transceiver
|   +----------------------------------------------------------+   |
|                               |                                  |
|                               +---- I2C (ULPI/PHY control)       |
+------------------------------------------------------------------+

USB Host Controller (Bus 1)
        |
        v
+---------------------+
| USB Host Transceiver|
+---------------------+
        |
       D+ / D-
        |
   'A' Connector
        |
     USB Pen Drive
     
USB Host Controller (Bus 2)
        |
        v
+---------------------+
| USB Host Transceiver|
+---------------------+
        |
     Internal USB
        |
Telemetry cards / Printers / RF cards /
Encryption engines / Disk-on-Chip /
Internal hubs / Bluetooth chips

USB Device Controller (Bus 3)
        |
        v
+-----------------------+
| USB Device Transceiver|
+-----------------------+
        |
       D+ / D-
        |
    'B' Connector
        |
       Host PC
       
USB OTG Controller (Bus 4)
        |
        v
+-------------------+
| USB OTG Transceiver|
+-------------------+
        |
     D+ / D- / ID
        |
   Mini-AB Connector
        |
   (Pen Drive or Host PC)    
```

**Hình 11.2. USB trên hệ thống nhúng.**

Phần lớn chương này được viết từ góc độ của một hệ thống nằm ở phía máy chủ (host-side) của USB. Chúng ta sẽ xem xét ngắn gọn chức năng của thiết bị trong phần "Gadget Drivers" (Trình điều khiển tiện ích). Các *trình điều khiển bộ điều khiển máy chủ* (*host controller drivers* - HCDs) chính thống hiện đã có sẵn, vì vậy trong chương này, chúng ta sẽ tiếp tục giới hạn ở các trình điều khiển cho thiết bị USB (còn được gọi là *client drivers* - trình điều khiển máy khách).

## Đầu cắm và bộ thu phát USB (USB Receptacles and Transceivers)

Các máy chủ USB sử dụng đầu cắm hình chữ nhật loại A bốn chân, trong khi các thiết bị USB kết nối thông qua đầu cắm hình vuông loại B bốn chân. Trong cả hai trường hợp, bốn chân bao gồm các tín hiệu dữ liệu vi sai D+ và D-, đường điện áp VBUS và nối đất (ground). VBUS được sử dụng để cung cấp nguồn từ máy chủ USB cho thiết bị USB. Do đó, VBUS được kéo lên mức cao (pulled high) trên đầu cắm loại A nhưng nhận nguồn trên đầu cắm loại B. Các bộ điều khiển USB OTG kết nối với đầu cắm hình chữ nhật Mini-AB năm chân có kích thước nhỏ gọn hơn. Bốn trong số các chân của Mini-AB giống với những gì chúng ta đã thảo luận trước đó; chân thứ năm là chân định danh (ID pin) được sử dụng để phát hiện xem thiết bị ngoại vi được kết nối là máy chủ (host) hay thiết bị (device).

Cùng một chip bộ thu phát (transceiver chip) (chẳng hạn như TUSB1105 từ Texas Instruments) có thể được sử dụng trên cả máy chủ và thiết bị USB. Do đó, bạn có thể chọn sử dụng cùng một linh kiện bộ thu phát trên các bus từ 1 đến 3 trong Hình 11.2. Tuy nhiên, OTG đòi hỏi một chip bộ thu phát chuyên dụng (chẳng hạn như ISP1301 từ Philips Semiconductors).

## Tốc độ Bus (Bus Speeds)

USB hỗ trợ ba tốc độ hoạt động. Đặc tả USB 1.0 ban đầu hỗ trợ 1.5MBps, được gọi là USB tốc độ thấp (low-speed USB). USB 1.1, phiên bản tiếp theo của đặc tả, xử lý 12MBps, được gọi là USB tốc độ đầy đủ (full-speed USB). Mức đặc tả hiện tại là USB 2.0, hỗ trợ 480MBps, hay USB tốc độ cao (high-speed USB). USB 2.0 tương thích ngược (backward-compatible) với các phiên bản đặc tả trước đó. Các thiết bị ngoại vi như bàn phím và chuột USB là ví dụ về thiết bị tốc độ thấp, và ổ lưu trữ USB là ví dụ về thiết bị tốc độ đầy đủ và tốc độ cao. Các hệ thống PC ngày nay tuân thủ USB 2.0 và cho phép cả ba tốc độ mục tiêu, nhưng một số bộ điều khiển nhúng tuân theo USB 1.1 và chỉ hỗ trợ các chế độ hoạt động tốc độ đầy đủ và tốc độ thấp.

## Bộ điều khiển máy chủ (Host Controllers)

Bộ điều khiển máy chủ USB tuân theo một số tiêu chuẩn sau:

- **Universal Host Controller Interface (UHCI):** Đặc tả UHCI được khởi xướng bởi Intel, vì vậy PC của bạn có nhiều khả năng sở hữu bộ điều khiển này nếu nó dựa trên nền tảng Intel.
- **Open Host Controller Interface (OHCI):** Đặc tả OHCI bắt nguồn từ các công ty như Compaq và Microsoft. Bộ điều khiển tương thích OHCI được tích hợp nhiều tính năng thông minh hơn vào phần cứng so với UHCI, do đó HCD của OHCI tương đối đơn giản hơn HCD của UHCI.
- **Enhanced Host Controller Interface (EHCI):** Đây là bộ điều khiển máy chủ hỗ trợ các thiết bị USB 2.0 tốc độ cao. Các bộ điều khiển EHCI thường có một bộ điều khiển đi kèm (companion controller) dạng UHCI hoặc OHCI để xử lý các thiết bị chậm hơn.
- **Bộ điều khiển USB OTG:** Chúng ngày càng trở nên phổ biến trong các vi điều khiển nhúng. Với hỗ trợ OTG, mỗi đầu giao tiếp có thể hoạt động như một *thiết bị đa vai trò* (*dual-role device* - DRD). Bằng cách bắt đầu một cuộc đối thoại sử dụng *Giao thức đàm phán máy chủ* (*Host Negotiation Protocol* - HNP), DRD có thể chuyển đổi chính nó sang chế độ máy chủ (host mode) hoặc chế độ thiết bị (device mode) dựa trên chức năng mong muốn.

Ngoài các bộ điều khiển máy chủ USB chính thống này, Linux còn hỗ trợ thêm một vài bộ điều khiển khác. Một ví dụ là HCD cho chip ISP116x.

Các bộ điều khiển máy chủ có một thành phần phần cứng tích hợp được gọi là *root hub* (hub gốc). Root hub là một hub ảo cung cấp các cổng USB. Đổi lại, các cổng này có thể kết nối với các hub vật lý bên ngoài hoặc bên trong và cung cấp thêm nhiều cổng, tạo ra một cấu trúc dạng cây (tree topology).

## Các Loại Truyền Dữ Liệu (Transfer Types)

Việc trao đổi dữ liệu với một thiết bị USB có thể thuộc một trong bốn loại:

- Truyền điều khiển (Control transfers), được sử dụng để truyền tải thông tin cấu hình và điều khiển.
- Truyền dữ liệu lớn (Bulk transfers) vận chuyển lượng lớn dữ liệu không nhạy cảm với thời gian.
- Truyền ngắt (Interrupt transfers) trao đổi lượng nhỏ dữ liệu nhạy cảm với thời gian.
- Truyền đẳng thời (Isochronous transfers) dành cho dữ liệu thời gian thực ở tốc độ bit có thể dự đoán trước.

Ví dụ, một ổ đĩa lưu trữ USB sử dụng truyền điều khiển để phát hành các lệnh truy cập đĩa và truyền dữ liệu lớn để trao đổi dữ liệu. Bàn phím sử dụng truyền ngắt để truyền tải các thao tác nhấn phím trong giới hạn độ trễ có thể dự đoán được. Một thiết bị cần phát trực tuyến (stream) dữ liệu âm thanh trong thời gian thực sẽ sử dụng truyền đẳng thời. Trách nhiệm của bốn loại truyền dữ liệu đối với các thiết bị USB Bluetooth được thảo luận trong phần "Ví dụ về thiết bị: Bộ điều hợp USB" (Device Example: USB Adapter) ở Chương 16, "Linux Không dây" (Linux Without Wires).

## Đánh Địa Chỉ (Addressing)

Mỗi đơn vị có thể định địa chỉ trong một thiết bị USB được gọi là một *endpoint* (điểm cuối). Địa chỉ được gán cho một endpoint được gọi là *endpoint address* (địa chỉ endpoint). Mỗi endpoint address có một loại truyền dữ liệu đi kèm. Ví dụ, nếu một endpoint chịu trách nhiệm truyền dữ liệu lớn, nó được gọi là một *bulk endpoint* (endpoint dữ liệu lớn). Endpoint address 0 được sử dụng độc quyền cho việc cấu hình thiết bị. Một đường ống điều khiển (control pipe) được gắn vào endpoint này để liệt kê thiết bị (enumeration) (xem phần "Liệt kê" (Enumeration)).

Một endpoint có thể liên kết với quá trình truyền dữ liệu chiều lên (upstream) hoặc chiều xuống (downstream). Dữ liệu đến upstream từ một thiết bị được gọi là truyền IN, trong khi dữ liệu chảy xuống downstream đến một thiết bị là truyền OUT. Truyền IN và OUT sở hữu các không gian địa chỉ riêng biệt. Do đó, bạn có thể có một endpoint bulk IN và một endpoint bulk OUT cùng đáp ứng cho một địa chỉ.

USB có nét giống với I2C ở một số điểm và giống với PCI ở các điểm khác như được tóm tắt trong Bảng 11.1. Việc đánh địa chỉ thiết bị của USB tương tự như I2C, trong khi nó hỗ trợ cắm nóng (hotplugging) giống như PCI. Địa chỉ thiết bị USB, giống như I2C tiêu chuẩn, không chiếm dụng một phần không gian địa chỉ của CPU. Thay vào đó, chúng nằm trong một không gian riêng tư dao động từ 1 đến 127.

**Bảng 11.1. Những điểm tương đồng của USB với I2C và PCI**

### Những điểm tương đồng của USB với I2C:

- USB và I2C là các giao thức chủ-tớ (master-slave).
- Địa chỉ thiết bị nằm trong không gian 7-bit riêng tư.
- Bộ nhớ thường trực trên thiết bị (device-resident memory) không được ánh xạ (mapped) vào bộ nhớ của CPU hoặc không gian I/O, do đó nó không tiêu tốn tài nguyên CPU.

### Những điểm tương đồng của USB với PCI:

- Các thiết bị có thể được cắm nóng (hotplugged).
- Kiến trúc trình điều khiển thiết bị (device driver architecture) giống với các trình điều khiển PCI. Cả hai lớp trình điều khiển này đều sở hữu các phương thức `probe()`/`disconnect()`[1] và các bảng ID xác định các thiết bị mà chúng hỗ trợ.
- Hỗ trợ tốc độ cao. Tuy nhiên, chậm hơn PCI. Xem Bảng 10.1 trong Chương 10, "Giao diện Kết nối Thành phần Ngoại vi" (Peripheral Component Interconnect), để biết tốc độ được hỗ trợ bởi các thành viên khác nhau trong gia đình PCI.
- Các bộ điều khiển máy chủ USB (USB host controllers), giống như bộ điều khiển PCI, thường có các công cụ DMA (DMA engines) tích hợp sẵn có thể chiếm quyền điều khiển bus (master the bus).
- Hỗ trợ các thiết bị đa chức năng (multifunction devices). USB hỗ trợ các mô tả giao diện (interface descriptors) cho mỗi chức năng. Mỗi chức năng thiết bị PCI có ID thiết bị và không gian cấu hình riêng.

[1] `disconnect()` được gọi là `remove()` theo thuật ngữ của PCI.

## Hệ thống con Linux-USB (Linux-USB Subsystem)

Hãy nhìn vào Hình 11.3 để hiểu kiến trúc của hệ thống con Linux-USB. Các thành phần cấu thành của hệ thống con này như sau:

- **USB Core** (Lõi USB): Giống như các tầng cốt lõi của hệ thống con trình điều khiển mà bạn đã thấy trong các chương trước, USB core là một cơ sở mã (code base) bao gồm các hàm (routines) và cấu trúc có sẵn cho các HCD và trình điều khiển client. Core này cũng cung cấp một mức độ gián tiếp (indirection) giúp cho các trình điều khiển client độc lập với các bộ điều khiển host (host controllers).
- **HCD** (Host Controller Drivers): Điều khiển các bộ điều khiển host khác nhau.
- Trình điều khiển hub (hub driver) cho hub gốc (root hub) và các hub vật lý, cùng với một tiến trình luồng nhân trợ giúp *khubd* (helper kernel thread) giám sát tất cả các cổng được kết nối với hub. Việc phát hiện các thay đổi trạng thái cổng và cấu hình các thiết bị cắm nóng (hotplugged) tốn nhiều thời gian và được thực hiện tốt nhất bằng cách sử dụng một luồng trợ giúp vì những lý do bạn đã học ở Chương 3, "Các Tiện ích Kernel" (Kernel Facilities). Tiến trình `khubd` mặc định ở trạng thái ngủ (asleep). Trình điều khiển hub sẽ đánh thức `khubd` bất cứ khi nào nó phát hiện ra sự thay đổi trạng thái trên cổng USB được kết nối với nó.
- Trình điều khiển thiết bị cho các thiết bị client USB.
- Hệ thống tệp USB *usbfs* cho phép bạn điều khiển các thiết bị USB từ không gian người dùng (User Space). Chúng tôi thảo luận về các trình điều khiển USB chế độ người dùng (user mode) ở Chương 19, "Trình điều khiển trong Không gian Người dùng" (Drivers in User Space).

**Hình 11.3. Hệ thống con Linux-USB.**

[Xem hình đầy đủ]

```
+-----------------------------+         +--------------------+
| USB User Mode Device Driver |         |  User Applications |
+-----------------------------+         +--------------------+
                          User Space          
-----------------------------------------------------------------
                          Kernel Space   
                
                  +---------+
                  |  usbfs  |
                  +---------+
                       ^
                       |
                       v
                  +---------+
    |------------>| usbcore |
    |             +---------+
    |                ^    ^
    |                |    |
    |                |    +---------------------------+
    |                |                                |
    |                v                                v
    |   +------------------------+       +-----------------------+
    |   | USB Host Controller    |       | USB Client Driver     |
    |   | Driver (HCD)           |       | (Class / Device drv)  |
    |   +------------------------+       +-----------------------+
    |                                                ^
    |                                                |
    |                                                |
    |             +---------+                  +----------------------+
    |-------------|  khubd  |                  | Other Kernel Layers  |
                  +---------+                  | (SCSI, Serial, Net,  |
                                               |  Input, Bluetooth...)|
                                               +----------------------+
                          Kernel Space          
-----------------------------------------------------------------
                          Hardware               
+-----------------------+          +------------------+
| USB Host Controller   | <------> |    USB Device    |
| (EHCI/OHCI/XHCI HW)   |          | (Flash, HID...)  |
+-----------------------+          +------------------+                        
```

Để vận hành toàn diện (end-to-end operation), hệ thống con USB (USB subsystem) gọi đến các tầng kernel khác nhau để hỗ trợ. Ví dụ, để hỗ trợ các thiết bị lưu trữ khối lượng lớn USB (USB mass storage devices), hệ thống con USB hoạt động song song với các trình điều khiển SCSI (SCSI drivers), như được thể hiện trong Hình 11.3. Để điều khiển bàn phím USB-Bluetooth, có bốn thành phần tham gia: hệ thống con USB, tầng Bluetooth (Bluetooth layer), hệ thống con đầu vào (input subsystem), và tầng tty (tty layer).

## Cấu trúc Dữ liệu Trình điều khiển (Driver Data Structures)

Khi bạn viết một trình điều khiển thiết bị USB (USB client driver), bạn phải làm việc với một vài cấu trúc dữ liệu. Hãy cùng xem xét các cấu trúc quan trọng.

## Cấu trúc usb\_device

Mỗi hệ thống con trình điều khiển thiết bị dựa trên một cấu trúc dữ liệu chuyên dụng để đại diện cho một thiết bị ở bên trong kernel. Cấu trúc `usb_device` đối với hệ thống con USB cũng giống như `pci_dev` đối với tầng PCI, và `net_device` đối với tầng trình điều khiển mạng (network driver layer). `usb_device` được định nghĩa trong *include/linux/usb.h* như sau:

```c
struct usb_device {
 /* ... */
 enum usb_device_state state; /* Configured, Not Attached, etc */
 enum usb_device_speed speed; /* High/full/low (or error) */
 /* ... */
 struct usb_device *parent; /* Our hub, unless we're the root */
 /* ... */
 struct usb_device_descriptor descriptor; /* Descriptor */
 struct usb_host_config *config; /* All of the configs */
 struct usb_host_config *actconfig; /* The active config */
 /* ... */
 int maxchild; /* No: of ports if hub */
 struct usb_device *children[USB_MAXCHILDREN]; /* Child devices */
 /* ... */
};
```

Chúng ta sẽ sử dụng cấu trúc này khi phát triển một trình điều khiển mẫu cho thẻ đo từ xa USB (USB telemetry card) sau đây.

## Khối Yêu cầu USB (USB Request Blocks)

*USB Request Block* (URB) là trung tâm của cơ chế truyền dữ liệu USB (USB data transfer mechanism). Một URB đối với stack USB cũng giống như `sk_buff` (được thảo luận trong Chương 15, "Card Giao diện Mạng" - Network Interface Cards) đối với mạng stack.

Hãy cùng nhìn vào bên trong một URB. Định nghĩa sau đây được lấy từ *include/linux/usb.h*, lược bỏ các trường không đặc biệt quan tâm đối với các trình điều khiển thiết bị:

```c
struct urb
{
 struct kref kref; /* Reference count of the URB */
 /* ... */
 struct usb_device *dev; /* (in) pointer to associated
 device */
 unsigned int pipe; /* (in) pipe information */
 int status; /* (return) non-ISO status */
 unsigned int transfer_flags; /* (in) URB_SHORT_NOT_OK | ...*/
 void *transfer_buffer; /* (in) associated data buffer */
 dma_addr_t transfer_dma; /* (in) dma addr for
 transfer_buffer */
 int transfer_buffer_length; /* (in) data buffer length */
```

```c
 /* ... */
 unsigned char *setup_packet; /* (in) setup packet */
 /* ... */
 int interval; /* (modify) transfer interval
 (INT/ISO) */
 /* ... */
 void *context; /* (in) context for completion */
 usb_complete_t complete; /* (in) completion routine */
 /* ... */
};
```

Có ba bước để sử dụng một URB: tạo (create), điền dữ liệu (populate), và gửi (submit). Để tạo một URB, hãy sử dụng `usb_alloc_urb()`. Hàm này cấp phát và gán giá trị không cho bộ nhớ URB, khởi tạo một đối tượng `kobject` liên kết với URB, và khởi tạo một `spinlock` để bảo vệ URB đó.

Để điền dữ liệu cho URB, hãy sử dụng các hàm trợ giúp (helper routines) sau đây do USB core cung cấp:

```c
void usb_fill_[control|int|bulk]_urb(
 struct urb *urb, /* URB pointer */
 struct usb_device *usb_dev, /* USB device structure */
 unsigned int pipe, /* Pipe encoding */
 unsigned char *setup_packet, /* For Control URBs only! */
 void *transfer_buffer, /* Buffer for I/O */
 int buffer_length, /* I/O buffer length */
 usb_complete_t completion_fn, /* Callback routine */
 void *context, /* For use by completion_fn */
 int interval); /* For Interrupt URBs only! */
```

Ngữ nghĩa của các hàm trước đó sẽ trở nên rõ ràng hơn khi chúng ta phát triển trình điều khiển mẫu ở phần sau. Các hàm trợ giúp này có sẵn cho các URB điều khiển (control), ngắt (interrupt), và hàng loạt (bulk) nhưng không áp dụng cho các URB đẳng thời (isochronous URBs).

Để gửi một URB nhằm truyền dữ liệu, hãy sử dụng `usb_submit_urb()`. Quá trình gửi URB mang tính bất đồng bộ (asynchronous). Các hàm `usb_fill_[control|int|bulk]_urb()` được liệt kê ở trên nhận địa chỉ của một hàm gọi lại (callback function) làm đối số. Trình tự gọi lại (callback routine) thực thi sau khi quá trình gửi URB hoàn tất và thực hiện các công việc như kiểm tra trạng thái gửi và giải phóng bộ nhớ đệm truyền dữ liệu (data-transfer buffer).

USB core cũng cung cấp các giao diện bao bọc (wrapper interfaces) mang lại giao diện gửi URB đồng bộ (synchronous URB submission):

```c
int usb_[control|interrupt|bulk]_msg(struct usb_device *usb_dev,
 unsigned int pipe, ...);
```

Ví dụ, `usb_bulk_msg()` xây dựng một bulk URB, gửi nó, và chặn (blocks) cho đến khi thao tác hoàn tất. Bạn không cần phải cung cấp một hàm gọi lại vì một routine hoàn thành chung (generic completion routine) đảm nhận mục đích đó. Bạn cũng không cần phải tạo và điền dữ liệu cho URB một cách tường minh (explicitly), vì `usb_bulk_msg()` thực hiện việc đó cho bạn mà không tốn thêm chi phí nào. Chúng ta sẽ sử dụng giao diện này trong trình điều khiển mẫu của mình.

`usb_free_urb()` được sử dụng để giải phóng một tham chiếu (reference) đến một URB đã hoàn thành, trong khi `usb_unlink_urb()` hủy bỏ một thao tác URB đang chờ xử lý (pending URB operation).

Như đã đề cập trong phần "Sysfs, Kobjects, and Device Classes" ở Chương 4, "Đặt nền móng" (Laying the Groundwork), một URB chứa một đối tượng `kref` để theo dõi các tham chiếu đến nó. `usb_submit_urb()` tăng số lượng tham chiếu (reference count) bằng cách sử dụng `kref_get()`. `usb_free_urb()` giảm số lượng tham chiếu bằng cách sử dụng `kref_put()` và thực hiện việc giải phóng

thao tác chỉ khi không còn tham chiếu nào khác.

Một URB được liên kết với một khái niệm trừu tượng gọi là *pipe* (đường ống), mà chúng ta sẽ thảo luận ngay sau đây.

## Pipes (Đường ống)

Một pipe là một số nguyên mã hóa sự kết hợp của các yếu tố sau:

- Địa chỉ endpoint (điểm cuối)
- Hướng truyền dữ liệu (IN hoặc OUT)
- Loại truyền dữ liệu (control, interrupt, bulk, hoặc isochronous)

Một pipe là thành phần địa chỉ của mỗi lần truyền dữ liệu USB và là một trường quan trọng trong cấu trúc URB. Để giúp điền giá trị cho trường này, USB core cung cấp các macro hỗ trợ sau:

```
usb_[rcv|snd][ctrl|int|bulk|isoc]pipe(struct usb_device *usb_dev,
 __u8 endpointAddress);
```

trong đó `usb_dev` là một con trỏ tới cấu trúc `usb_device` liên quan, và `endpointAddress` là địa chỉ endpoint được gán nằm trong khoảng từ 1 đến 127. Ví dụ, để tạo một bulk pipe theo hướng OUT, hãy gọi `usb_sndbulkpipe()`. Đối với một control pipe theo hướng IN, hãy gọi `usb_rcvctrlpipe()`.

Khi đề cập đến một URB, nó thường được phân loại dựa theo loại truyền dữ liệu của pipe liên kết. Ví dụ, nếu một URB được gắn vào một bulk pipe, nó được gọi là một *bulk URB*.

## Cấu trúc Descriptor (Bộ mô tả)

Đặc tả kỹ thuật USB định nghĩa một chuỗi các *descriptor* để lưu giữ thông tin về một thiết bị. Linux-USB core định nghĩa các cấu trúc dữ liệu tương ứng với từng descriptor. Các descriptor gồm bốn loại:

- *Device descriptors* (Descriptor thiết bị) chứa thông tin chung như ID sản phẩm và ID nhà vendor của thiết bị. `usb_device_descriptor` là cấu trúc tương ứng với device descriptor.
- *Configuration descriptors* (Descriptor cấu hình) được sử dụng để mô tả các chế độ cấu hình khác nhau như hoạt động cấp nguồn từ bus (bus-powered) hoặc tự cấp nguồn (self-powered). `usb_config_descriptor` là cấu trúc dữ liệu liên quan đến configuration descriptor.
- *Interface descriptors* (Descriptor giao diện) cho phép các thiết bị USB hỗ trợ nhiều chức năng. `usb_interface_descriptor` định nghĩa interface descriptor.
- *Endpoint descriptors* (Descriptor điểm cuối) mang thông tin liên quan đến các endpoint cuối cùng của một thiết bị. `usb_endpoint_descriptor` là cấu trúc được nhắc đến.

Các định dạng descriptor này được định nghĩa trong Chương 9 của đặc tả USB, trong khi các cấu trúc tương ứng được định nghĩa trong *include/linux/usb/ch9.h*. Liệt kê 11.1 hiển thị cấu trúc liên kết phân cấp của các descriptor và in ra tất cả các địa chỉ endpoint liên kết với một thiết bị USB. Để làm được điều này, nó duyệt qua cây bao gồm bốn loại descriptor đã mô tả trước đó. Dưới đây là kết quả đầu ra được tạo ra bởi Liệt kê 11.1 cho một ổ đĩa CD USB:

```
Endpoint Address = 1
Endpoint Address = 82
Endpoint Address = 83
```

Địa chỉ đầu tiên thuộc về một endpoint bulk IN, địa chỉ thứ hai thuộc sở hữu của một endpoint bulk OUT, và địa chỉ thứ ba là một endpoint interrupt IN.

Có nhiều cấu trúc dữ liệu hơn liên quan đến các trình điều khiển client USB, chẳng hạn như `usb_device_id`, `usb_driver`, và `usb_class_driver`. Chúng ta sẽ gặp lại chúng khi thực hiện phát triển thực tế trong phần "Ví dụ về thiết bị: Thẻ đo từ xa (Telemetry Card)".

**Liệt kê 11.1. In Tất Cả Các Địa Chỉ Endpoint USB Trên Một Thiết Bị**

[Xem hình ảnh kích thước đầy đủ]

```
/* ... */
/* USB device */
struct usb device *udevice;
/* ... */
struct usb_device_descriptor(u d desc) = udevice->descriptor;
/* Device's active configuration
struct usb_host_config *uconfig;
struct usb_config_desriptor u c desc;
/* Interfaces in the active configuration
struct usb interface *uinterface;
/* Alternate Setting for this interface */
struct usb host interface *ualtsetting;
struct usb_interface_descriptor u i desc;
/* Endpoints for this altsetting */
struct usb_host_endpoint *uendpoint;
struct usb endpoint descriptor u e desc;
uconfig = udevice->actconfig;
                                                              Device Descriptor
u c desc = uconfig->desc;
for (i = 0; i < (u c desc) bNumInterfaces;
     i++) {
  uinterface = udevice->actconfig->interface[1];
                                                          Configuration
  for (j = 0; j < uinterface->num_altsetting; j++) {
ualtsetting = &uinterface->altsetting[j];
 \begin{array}{llllllllllllllllllllllllllllllllllll
   uendpoint = &ualtsetting->endpoint[k];
                                                        Interface
    u e desc = uendpoint->desc;
                                                        Descriptor
    printk ("Endpoint Address = %d\n",
            u e desc. EndpointAddress\n");
                                                     Endooint
                                                    Descriptor
```

## Enumeration (Quá trình liệt kê thiết bị)

Vòng đời của một thiết bị USB dạng cắm nóng (hotplugged) bắt đầu bằng một quá trình gọi là *enumeration* (liệt kê), nhờ đó host tìm hiểu về các khả năng của thiết bị và tiến hành cấu hình nó. Trình điều khiển hub (hub driver) là thành phần trong hệ thống con Linux-USB chịu trách nhiệm cho quá trình liệt kê. Hãy cùng xem xét chuỗi các bước thực hiện quá trình liệt kê thiết bị khi bạn cắm một ổ USB flash vào máy tính chủ (host):

- **1.** Root hub báo cáo sự thay đổi về dòng điện của cổng do thiết bị được gắn vào. Trình điều khiển hub (hub driver) phát hiện sự thay đổi trạng thái này, được gọi là `USB_PORT_STAT_C_CONNECTION` theo thuật ngữ Linux-USB, và đánh thức `khubd`.
- **2.** `Khubd` giải mã định danh của cổng USB chịu sự thay đổi trạng thái. Trong trường hợp này, đó là cổng mà bạn cắm ổ USB flash (pen drive) vào.
- **3.** Tiếp theo, `khubd` chọn một địa chỉ thiết bị (device address) nằm trong khoảng từ 1 đến 127 và gán nó cho endpoint bulk của ổ USB flash bằng cách sử dụng một `URB` điều khiển (control URB) được đính kèm vào endpoint 0.
- **4.** `Khubd` sử dụng control URB nói trên được đính kèm vào endpoint 0 để lấy mô tả thiết bị (device descriptor) từ ổ USB flash. Sau đó, nó yêu cầu các mô tả cấu hình (configuration descriptors) của thiết bị và chọn một mô tả phù hợp. Trong trường hợp của ổ USB flash, chỉ có một mô tả cấu hình duy nhất được cung cấp.
- **5.** `Khubd` yêu cầu lõi USB (USB core) liên kết (bind) một client driver tương thích với thiết bị vừa được cắm vào.

Khi quá trình liệt kê (enumeration) hoàn tất và thiết bị được liên kết với một driver, `khubd` sẽ gọi phương thức `probe()` của client driver tương ứng. Trong trường hợp này, `khubd` gọi `storage_probe()` được định nghĩa trong *drivers/usb/storage/usb.c*. Từ thời điểm này trở đi, mass storage driver chịu trách nhiệm cho hoạt động bình thường của thiết bị.

## Ví dụ về Thiết bị: Thẻ Đo từ xa (Telemetry Card)

Bây giờ bạn đã nắm được những kiến thức cơ bản về Linux-USB, đã đến lúc xem xét một thiết bị mẫu. Hãy cân nhắc một hệ thống được trang bị thẻ đo từ xa (telemetry card) kết nối với bộ vi xử lý (processor) thông qua USB nội bộ, như được hiển thị ở bus 2 của Hình 11.2. Thẻ này thu thập dữ liệu từ một thiết bị từ xa và chuyển nó đến bộ vi xử lý qua USB. Một ví dụ về thẻ đo từ xa là một bo mạch cấp y tế dùng để giám sát hoặc lập trình cho một thiết bị cấy ghép.

Hãy giả sử rằng thẻ đo từ xa mẫu của chúng tôi có các endpoint với ngữ nghĩa được mô tả trong Bảng 11.2:

- Một control endpoint được gắn vào thanh ghi cấu hình trên thẻ (on-card configuration register)
- Một bulk IN endpoint truyền thông tin đo từ xa từ xa được thu thập bởi thẻ đến bộ vi xử lý
- Một bulk OUT endpoint truyền dữ liệu theo chiều ngược lại

**Bảng 11.2. Không gian Thanh ghi (Register Space) trong Thẻ Đo từ xa**

| Thanh ghi (Register)             | Endpoint Liên quan                                                                |
|----------------------------------|-----------------------------------------------------------------------------------|
| Thanh ghi Cấu hình Đo từ xa      | Control endpoint 0 (độ lệch thanh ghi (register offset) 0xA).                     |
| Thanh ghi Dữ liệu Vào Đo từ xa   | Bulk IN endpoint. Địa chỉ endpoint được<br>gán trong quá trình liệt kê thiết bị.  |
| Thanh ghi Dữ liệu Ra Đo từ xa    | Bulk OUT endpoint. Địa chỉ endpoint được<br>gán trong quá trình liệt kê thiết bị. |

Hãy xây dựng một driver tối thiểu (minimal driver) cho thẻ này dựa một phần vào USB skeleton driver, *drivers/usb/usb-skeleton.c*.

Vì các thiết bị PCMCIA, PCI và USB có các đặc tính tương tự nhau như hỗ trợ cắm nóng (hotplug support), một số phương thức driver và cấu trúc dữ liệu thuộc các hệ thống con (subsystems) này có sự giống nhau. Điều này đặc biệt đúng đối với các phần chịu trách nhiệm khởi tạo (initializing) và dò tìm (probing). Khi chúng ta tìm hiểu sâu hơn về telemetry driver và nhận thấy những điểm tương đồng với những gì chúng ta đã học đối với PCI driver trong Chương 10, chúng ta sẽ dừng lại và lưu ý.

## Khởi tạo và Phát hiện (Initializing and Probing)

Giống như các driver PCI và PCMCIA, các USB driver có các phương thức `probe()/disconnect()`[2] để hỗ trợ tính năng cắm nóng (hotplugging), và một bảng chứa danh tính của các thiết bị mà chúng hỗ trợ. Một thiết bị USB được định nghĩa bởi cấu trúc `usb_device_id` được khai báo trong *include/linux/mod_devicetable.h*. Bạn có thể nhớ lại từ chương trước rằng cấu trúc `pci_device_id`, cũng được định nghĩa trong cùng tệp tiêu đề đó, dùng để định danh các thiết bị PCI.

[2] `disconnect()` được gọi là `remove()` trong thuật ngữ của PCI và PCMCIA.

```c
struct usb_device_id {
 /* ... */
 __u16 idVendor; /* Vendor ID */
```

```c
 __u16 idProduct; /* Device ID */
 /* ... */
 __u8 bDeviceClass; /* Device class */
 __u8 bDeviceSubClass; /* Device subclass */
 __u8 bDeviceProtocol; /* Device protocol */
 /* ... */
};
```

`idVendor` và `idProduct` lần lượt lưu trữ ID nhà sản xuất (manufacturer ID) và ID sản phẩm (product ID), trong khi `bDeviceClass`, `bDeviceSubClass` và `bDeviceProtocol` phân loại thiết bị dựa trên tính năng của nó. Việc phân loại này, được quy định bởi thông số kỹ thuật USB (USB specification), cho phép triển khai các client driver tổng quát như đã thảo luận trong phần "Class Drivers" sau đây.

Đoạn mã 11.2 (Listing 11.2) triển khai quy trình khởi tạo của telemetry driver, hàm `usb_tele_init()`, hàm này gọi `usb_register()` để đăng ký cấu trúc `usb_driver` của nó với USB core. Như được minh họa trong đoạn mã, `usb_driver` liên kết phương thức `probe()`, phương thức `disconnect()` và bảng `usb_device_id` của driver lại với nhau. `usb_driver` tương tự như `pci_driver`, ngoại trừ việc phương thức `disconnect()` ở driver trước có tên là `remove()` ở driver sau.

### Đoạn mã 11.2. Khởi tạo Driver (Listing 11.2. Initializing the Driver)

```c
## define USB_TELE_VENDOR_ID 0xABCD /* Manufacturer's Vendor ID */
## define USB_TELE_PRODUCT_ID 0xCDEF /* Device's Product ID */
/* Bảng ID USB chỉ định các thiết bị mà driver này hỗ trợ */
static struct usb_device_id tele_ids[] = {
 { USB_DEVICE(USB_TELE_VENDOR_ID, USB_TELE_PRODUCT_ID) },
 { } /* Kết thúc */
};
MODULE_DEVICE_TABLE(usb, tele_ids);
/* Cấu trúc usb_driver cho driver này */
static struct usb_driver tele_driver
{
 .name = "tele", /* Tên duy nhất */
 .probe = tele_probe, /* Xem Đoạn mã 11.3 */
 .disconnect = tele_disconnect, /* Xem Đoạn mã 11.3 */
 .id_table = tele_ids, /* Xem ở trên */
};
/* Khởi tạo Module */
static int __init
usb_tele_init(void)
{
 /* Đăng ký với USB core */
 result = usb_register(&tele_driver);
 /* ... */
 return 0;
}
/* Hủy Module (Module Exit) */
static void __exit
usb_tele_exit(void)
{
 /* Hủy đăng ký khỏi USB core */
```

```c
 usb_deregister(&tele_driver);
 return;
}
module_init(usb_tele_init);
module_exit(usb_tele_exit);
```

Macro `USB_DEVICE()` tạo ra một `usb_device_id` từ ID nhà sản xuất và ID sản phẩm được cung cấp cho nó. Điều này tương tự như macro `PCI_DEVICE()` đã được thảo luận trong chương trước. Macro `MODULE_DEVICE_TABLE()` đánh dấu `tele_ids` trong image của module để module có thể được tải theo nhu cầu (load on demand) nếu thẻ được cắm nóng. Điều này lại tương tự như những gì chúng ta đã thảo luận đối với các thiết bị PCMCIA và PCI trong hai chương trước.

Khi USB core phát hiện một thiết bị có các thuộc tính khớp với các thuộc tính được khai báo trong bảng `usb_device_id` thuộc về một client driver, nó sẽ gọi phương thức `probe()` đã được đăng ký bởi driver đó. Khi thiết bị bị rút ra hoặc nếu module bị gỡ bỏ (unload), USB core sẽ gọi phương thức `disconnect()` của driver.

Đoạn mã 11.3 (Listing 11.3) triển khai các phương thức `probe()` và `disconnect()` của telemetry driver. Nó bắt đầu bằng cách định nghĩa một cấu trúc đặc thù cho thiết bị, `tele_device_t`, chứa các trường dữ liệu sau:

- Một con trỏ trỏ đến `usb_device` liên quan.
- Một con trỏ trỏ đến `usb_interface`. Hãy xem lại Đoạn mã 11.1 (Listing 11.1) để thấy cấu trúc này được sử dụng.
- Một URB điều khiển (`ctrl_urb`) để giao tiếp với thanh ghi cấu hình telemetry, và một `ctrl_req` để thiết lập các yêu cầu lập trình tới thanh ghi này. Các trường này được mô tả trong phần tiếp theo "Truy cập các thanh ghi" (Accessing Registers).
- Thẻ có một endpoint bulk IN thông qua đó bạn có thể thu thập thông tin telemetry đã thu thập. Liên kết với endpoint này có ba trường: `bulk_in_addr`, lưu giữ địa chỉ endpoint; `bulk_in_buf`, lưu trữ dữ liệu nhận được; và `bulk_in_len`, chứa kích thước của bộ đệm dữ liệu nhận.
- Thẻ có một endpoint bulk OUT để hỗ trợ việc truyền dữ liệu xuống thiết bị (downstream). `tele_device_t` có một trường gọi là `bulk_out_addr` để lưu trữ địa chỉ của endpoint này. Có ít cấu trúc dữ liệu hơn theo hướng OUT bởi vì trong trường hợp đơn giản này, chúng ta sử dụng giao diện gửi URB đồng bộ (synchronous URB submission interface) giúp ẩn đi một số chi tiết triển khai.

Khubd gọi phương thức `probe()` của thẻ, `tele_probe()`, ngay sau quá trình liệt kê thiết bị (enumeration). `tele_probe()` thực hiện ba nhiệm vụ:

- **1.** Cấp phát bộ nhớ cho cấu trúc đặc thù của thiết bị, `tele_device_t`.
- **2.** Khởi tạo các trường sau trong `tele_device_t` liên quan đến các bulk endpoint của thiết bị: `bulk_in_buf`, `bulk_in_len`, `bulk_in_addr`, và `bulk_out_addr`. Để làm điều này, nó sử dụng dữ liệu được thu thập bởi hub driver trong quá trình liệt kê thiết bị. Dữ liệu này khả dụng trong các cấu trúc descriptor được thảo luận trong phần "Cấu trúc Descriptor" (Descriptor Structures).

- **3.** Xuất thiết bị ký tự (character device) */dev/tele* ra user space. Các ứng dụng thao tác thông qua */dev/tele* để trao đổi dữ liệu với card telemetry. Hàm `tele_probe()` gọi `usb_register_dev()` và cung cấp cho nó các `file_operations` tạo nên nền tảng cốt lõi của giao diện */dev/tele* thông qua cấu trúc `usb_class_driver`.

Địa chỉ của cấu trúc đặc thù theo thiết bị (device-specific structure) được cấp phát ở Bước 1 phải được lưu lại để các phương thức khác có thể truy cập đến nó. Để đạt được điều này, trình điều khiển (driver) telemetry sử dụng chiến lược ba hướng tùy thuộc vào các tham số hàm có sẵn cho các routine khác nhau của driver. Để lưu con trỏ cấu trúc này giữa các luồng (thread) gọi `probe()` và `open()`, driver sử dụng trường `driver_data` của thiết bị thông qua cặp hàm `usb_set_intfdata()` và `usb_get_intfdata()`. Để lưu địa chỉ của con trỏ cấu trúc giữa luồng `open()` và các điểm vào (entry point) khác, `open()` lưu nó vào trường `file->private_data` của */dev/tele*. Lý do là vì kernel cung cấp cho các entry point của thiết bị ký tự này con trỏ `inode` của */dev/tele* làm tham số thay vì con trỏ `usb_interface`. Để thu thập địa chỉ của cấu trúc đặc thù theo thiết bị từ các hàm gọi lại URB (URB callback function), các luồng gửi (submission thread) liên quan sử dụng trường `context` của URB làm vùng lưu trữ. Hãy xem các Danh sách (Listing) 11.3, 11.4 và 11.5 để thấy các cơ chế này hoạt động trong thực tế.

Tất cả các thiết bị ký tự USB đều phản hồi major number 180. Nếu bạn bật `CONFIG_USB_DYNAMIC_MINORS` trong quá trình cấu hình kernel, USB core sẽ tự động chọn một minor number từ pool có sẵn. Hành vi này tương tự như việc đăng ký các driver hỗn hợp (misc driver) sau khi chỉ định `MISC_DYNAMIC_MINOR` trong cấu trúc `miscdevice` (như đã thảo luận trong phần "Misc Drivers" ở Chương 5, "Character Drivers"). Nếu bạn chọn không bật `CONFIG_USB_DYNAMIC_MINORS`, hệ thống con USB (USB subsystem) sẽ chọn một minor number khả dụng bắt đầu từ minor base được thiết lập trong cấu trúc `usb_class_driver`.

**Danh sách 11.3. Thăm dò (Probing) và Ngắt kết nối (Disconnecting)**

```c
/* Cấu trúc đặc thù theo thiết bị */
typedef struct {
 struct usb_device *usbdev; /* Biểu diễn thiết bị */
 struct usb_interface *interface; /* Biểu diễn giao diện */
 struct urb *ctrl_urb; /* Control URB để truy cập thanh ghi */
 struct usb_ctrlrequest ctrl_req; /* Yêu cầu điều khiển theo thông số kỹ thuật */
 unsigned char *bulk_in_buf; /* Bộ đệm nhận dữ liệu */
 size_t bulk_in_len; /* Kích thước bộ đệm nhận */
 __u8 bulk_in_addr; /* Địa chỉ endpoint IN */
 __u8 bulk_out_addr; /* Địa chỉ endpoint OUT */
 /* ... */ /* Khóa (lock), hàng đợi chờ (waitqueue), thống kê.. */
} tele_device_t;
## define TELE_MINOR_BASE 0xAB /* Được gán bởi người duy trì hệ thống con Linux-USB */
/* Các điểm vào driver ký tự quy ước. 
 Xem Chương 5, "Character Drivers." */
static struct file_operations tele_fops =
{
 .owner = THIS_MODULE, /* Chủ sở hữu */
```

```c
 .read = tele_read, /* Phương thức đọc */
 .write = tele_write, /* Phương thức ghi */
 .ioctl = tele_ioctl, /* Phương thức ioctl */
 .open = tele_open, /* Phương thức mở */
 .release = tele_release, /* Phương thức đóng */
};
static struct usb_class_driver tele_class = {
 .name = "tele",
 .fops = &tele_fops, /* Kết nối với /dev/tele */
 .minor_base = TELE_MINOR_BASE, /* Bắt đầu minor number */
};
/* Phương thức probe() được gọi bởi khubd sau khi liệt kê thiết bị (device enumeration). 
 Tham số đầu tiên, interface, chứa thông tin thu thập được trong quá trình liệt kê. 
 id là mục trong bảng usb_device_id của driver khớp với các giá trị đọc từ card telemetry. 
 tele_probe() dựa trên skel_probe() được định nghĩa trong drivers/usb/usb-skeleton.c */
static int
tele_probe(struct usb_interface *interface,
 const struct usb_device_id *id)
{
 struct usb_host_interface *iface_desc;
 struct usb_endpoint_descriptor *endpoint;
 tele_device_t *tele_device;
 int retval = -ENOMEM;
 /* Cấp phát cấu trúc đặc thù theo thiết bị */
 tele_device = kzalloc(sizeof(tele_device_t), GFP_KERNEL);
 /* Điền thông tin usb_device và usb_interface */
 tele_device->usbdev =
 usb_get_dev(interface_to_usbdev(interface));
 tele_device->interface = interface;
 /* Thiết lập thông tin endpoint từ dữ liệu thu thập được trong quá trình liệt kê thiết bị */
 iface_desc = interface->cur_altsetting;
 for (int i = 0; i < iface_desc->desc.bNumEndpoints; ++i) {
 endpoint = &iface_desc->endpoint[i].desc;
 if (!tele_device->bulk_in_addr &&
 usb_endpoint_is_bulk_in(endpoint)) {
 /* Endpoint Bulk IN */
 tele_device->bulk_in_len =
 le16_to_cpu(endpoint->wMaxPacketSize);
 tele_device->bulk_in_addr = endpoint->bEndpointAddress;
 tele_device->bulk_in_buf =
 kmalloc(tele_device->bulk_in_len, GFP_KERNEL);
 }
 if (!tele_device->bulk_out_addr &&
 usb_endpoint_is_bulk_out(endpoint)) {
 /* Endpoint Bulk OUT */
 tele_device->bulk_out_addr = endpoint->bEndpointAddress;
 }
 }
```

```c
 if (!(tele_device->bulk_in_addr && tele_device->bulk_out_addr)) {
 return retval;
 }
 /* Gắn cấu trúc đặc thù theo thiết bị vào interface này. 
 Chúng ta sẽ truy xuất nó từ tele_open() */
 usb_set_intfdata(interface, tele_device);
 /* Đăng ký thiết bị */
 retval = usb_register_dev(interface, &tele_class);
 if (retval) {
 usb_set_intfdata(interface, NULL);
 return retval;
 }
 printk("Thiết bị Telemetry đã được gắn vào /dev/tele\n");
 return 0;
}
/* Phương thức disconnect(). Được gọi khi thiết bị bị rút ra hoặc khi module bị gỡ bỏ (unload) */
static void
tele_disconnect(struct usb_interface *interface)
{
 tele_device_t *tele_device;
 /* ... */
 /* Thao tác ngược lại của usb_set_intfdata() được gọi từ tele_probe() */
 tele_device = usb_get_intfdata(interface);
 /* Đặt dữ liệu interface về 0 */
 usb_set_intfdata(interface, NULL);
 /* Giải phóng /dev/tele */
 usb_deregister_dev(interface, &tele_class);
 /* Đặt interface thành NULL. Trong thực tế, hãy bảo vệ thao tác này bằng các cơ chế khóa */
 tele_device->interface = NULL;
 /* ... */
}
```

## Truy cập các thanh ghi (Accessing Registers)

Phương thức `open()` khởi tạo thanh ghi cấu hình đo từ xa (telemetry) trên thẻ khi một ứng dụng mở */dev/tele*. Để thiết lập nội dung của thanh ghi này, `tele_open()` gửi (submits) một control URB được đính kèm vào default endpoint 0 (endpoint mặc định 0). Khi bạn gửi một control URB, bạn phải cung cấp một control request (yêu cầu điều khiển) đi kèm. Cấu trúc dùng để gửi một control request tới thiết bị USB phải tuân thủ Chương 9 của đặc tả USB và được định nghĩa như sau trong *include/linux/usb/ch9.h*:

```c
struct usb_ctrlrequest {
 __u8 bRequestType;
 __u8 bRequest;
```

```c
 __le16 wValue;
 __le16 wIndex;
 __le16 wLength;
} __attribute__ ((packed));
```

Hãy cùng xem xét các thành phần cấu thành nên một `usb_ctrlrequest`. Trưởng `bRequest` xác định yêu cầu điều khiển (control request). Trường `bRequestType` bổ nghĩa cho yêu cầu bằng cách mã hóa hướng truyền dữ liệu (data transfer direction), phân loại yêu cầu (request category), và xác định xem đối tượng nhận là thiết bị (device), giao diện (interface), endpoint, hay một đối tượng khác. `bRequest` có thể thuộc về một tập hợp các giá trị chuẩn hoặc do nhà cung cấp định nghĩa (vendor-defined). Trong ví dụ của chúng ta, `bRequest` dùng để ghi vào thanh ghi cấu hình telemetry là một yêu cầu do nhà cung cấp định nghĩa. `wValue` chứa dữ liệu cần ghi vào thanh ghi, `wIndex` là offset (độ lệch) mong muốn trong không gian thanh ghi (register space), và `wLength` là số byte sẽ được truyền.

Liệt kê (Listing) 11.4 thực thi hàm `tele_open()`. Nhiệm vụ chính của nó là cấu hình (program) thanh ghi cấu hình telemetry với các giá trị phù hợp. Trước khi xem xét đoạn mã, hãy xem lại cấu trúc `tele_device_t` được định nghĩa trong Liệt kê 11.3 và tập trung vào hai trường: `ctrl_urb` và `ctrl_req`. Trường đầu tiên là một control URB dùng để giao tiếp với thanh ghi cấu hình, trong khi trường thứ hai là `usb_ctrlrequest` tương ứng.

Để cấu hình thanh ghi telemetry, `tele_open()` thực hiện các bước sau:

- **1.** Cấp phát (allocates) một control URB để chuẩn bị cho việc ghi thanh ghi.
- **2.** Tạo một `usb_ctrlrequest` và điền các thông tin gồm định danh yêu cầu (request identifier), loại yêu cầu (request type), offset của thanh ghi, và giá trị cần cấu hình.
- **3.** Tạo một control pipe (đường ống điều khiển) được đính kèm vào endpoint 0 của thẻ telemetry để mang control URB.
- **4.** Do `tele_open()` gửi URB theo phương thức bất đồng bộ (asynchronously), hàm này cần đợi hàm callback tương ứng hoàn tất trước khi trả về cho hàm gọi nó. Để làm điều này, `tele_open()` sử dụng API hoàn thành (completion API) của kernel với hàm `init_completion()`. Bước 7 gọi hàm `wait_for_completion()` tương ứng để chờ cho đến khi hàm callback gọi `complete()`. Chúng ta đã thảo luận về completion API trong phần "Completion Interface" ở Chương 3.
- **5.** Khởi tạo các trường trong control URB bằng cách sử dụng `usb_fill_control_urb()`. Quá trình này bao gồm cả `usb_ctrlrequest` đã được điền thông tin ở Bước 2.
- **6.** Gửi URB đến USB core bằng cách sử dụng `usb_submit_urb()`.
- **7.** Chờ cho đến khi hàm callback báo hiệu rằng việc cấu hình thanh ghi đã hoàn tất.
- **8.** Trả về trạng thái (status).

### Listing 11.4. Khởi tạo Thanh ghi Cấu hình Telemetry

```
/* Offset of the Telemetry configuration register
 within the on-card register space */
## define TELEMETRY_CONFIG_REG_OFFSET 0x0A
/* Value to program in the configuration register */
## define TELEMETRY_CONFIG_REG_VALUE 0xBC
/* The vendor-defined bRequest for programming the
 configuration register */
```

## define TELEMETRY_REQUEST_WRITE 0x0D

/* The vendor-defined bRequestType */

## define TELEMETRY_REQUEST_WRITE_REGISTER 0x0E

/* Open method */
static int
tele_open(struct inode *inode, struct file *file)
{
struct completion tele_config_done;
tele_device_t *tele_device;
void *tele_ctrl_context;
char *tmp;
__le16 tele_config_index = TELEMETRY_CONFIG_REG_OFFSET;
unsigned int tele_ctrl_pipe;
struct usb_interface *interface;
/* Obtain the pointer to the device-specific structure.
We saved it using usb_set_intfdata() in tele_probe() */
interface = usb_find_interface(&tele_driver, iminor(inode));
tele_device = usb_get_intfdata(interface);
/* Allocate a URB for the control transfer */
tele_device->ctrl_urb = usb_alloc_urb(0, GFP_KERNEL);
if (!tele_device->ctrl_urb) {
return -EIO;
}
/* Populate the Control Request */
tele_device->ctrl_req.bRequestType = TELEMETRY_REQUEST_WRITE;
tele_device->ctrl_req.bRequest =
TELEMETRY_REQUEST_WRITE_REGISTER;
tele_device->ctrl_req.wValue =
cpu_to_le16(TELEMETRY_CONFIG_REG_VALUE);
tele_device->ctrl_req.wIndex =
cpu_to_le16p(&tele_config_index);
tele_device->ctrl_req.wLength = cpu_to_le16(1);
tele_device->ctrl_urb->transfer_buffer_length = 1;
tmp = kmalloc(1, GFP_KERNEL);
*tmp = TELEMETRY_CONFIG_REG_VALUE;
/* Create a control pipe attached to endpoint 0 */
tele_ctrl_pipe = usb_sndctrlpipe(tele_device->usbdev, 0);
/* Initialize the completion mechanism */
init_completion(&tele_config_done);
/* Set URB context. The context is part of the URB that is passed
to the callback function as an argument. In this case, the
context is the completion structure, tele_config_done */
tele_ctrl_context = (void *)&tele_config_done;
/* Initialize the fields in the control URB */
usb_fill_control_urb(tele_device->ctrl_urb, tele_device->usbdev,
tele_ctrl_pipe,
(char *) &tele_device->ctrl_req,
tmp, 1, tele_ctrl_callback,
tele_ctrl_context);
/* Submit the URB */

```

```

usb_submit_urb(tele_device->ctrl_urb, GFP_ATOMIC);
/* Wait until the callback returns indicating that the telemetry
configuration register has been successfully initialized */
wait_for_completion(&tele_config_done);
/* Release our reference to the URB */
usb_free_urb(urb);
kfree(tmp);
/* Save the device-specific object to the file's private_data
so that you can directly retrieve it from other entry points
such as tele_read() and tele_write() */
file->private_data = tele_device;
/* Return the URB transfer status */
return(tele_device->ctrl_urb->status);
}
/* Callback function */
static void
tele_ctrl_callback(struct urb *urb)
{
complete((struct completion *)urb->context);
}

```

Bạn có thể làm cho hàm `tele_open()` trở nên đơn giản hơn bằng cách sử dụng `usb_control_msg()`, một phiên bản chặn (blocking version) của `usb_submit_urb()` có tác dụng ẩn đi các chi tiết về đồng bộ hóa (synchronization) và hàm gọi lại (callback) cho các control URB (USB Request Block) ở mức bên dưới. Chúng ta ưu tiên cách tiếp cận bất đồng bộ (asynchronous approach) ở đây nhằm mục đích học tập.

## Truyền dữ liệu (Data Transfer)

Đoạn mã 11.5 (Listing 11.5) hiện thực hóa các điểm nhập (entry points) `read()` và `write()` của trình điều khiển (driver) telemetry. Các phương thức này thực hiện công việc thực tế khi một ứng dụng đọc hoặc ghi vào */dev/tele*. Hàm `tele_read()` thực hiện việc gửi URB (USB Request Block) đồng bộ (synchronous URB submission) bởi vì tiến trình gọi (calling process) muốn chặn (block) cho đến khi dữ liệu telemetry khả dụng. Ngược lại, `tele_write()` sử dụng phương thức gửi bất đồng bộ (asynchronous submission) và trả về cho luồng gọi (calling thread) mà không cần chờ xác nhận rằng dữ liệu được driver chấp nhận đã được truyền thành công tới thiết bị.

Vì các tệp truyền bất đồng bộ luôn đi kèm với một hàm gọi lại (callback routine), Đoạn mã 11.5 hiện thực hàm `tele_write_callback()`. Quy trình này kiểm tra `urb->status` để giải mã trạng thái gửi (submission status). Nó cũng giải phóng bộ đệm truyền (transfer buffer) đã được cấp phát bởi `tele_write()`.

### Đoạn mã 11.5. Trao đổi dữ liệu với Thẻ Telemetry

```c

/* Read entry point */
static ssize_t
tele_read(struct file *file, char *buffer,
size_t count, loff_t *ppos)
{

```

```c

int retval, bytes_read;
tele_device_t *tele_device;
/* Get the address of tele_device */
tele_device = (tele_device_t *)file->private_data;
/* ... */
/* Synchronous read */
retval = usb_bulk_msg(tele_device->usbdev, /* usb_device */
usb_rcvbulkpipe(tele_device->usbdev,
tele_device->bulk_in_addr), /* Pipe */
tele_device->bulk_in_buf, /* Read buffer */
min(tele_device->bulk_in_len, count), /* Bytes to read */
&bytes_read, /* Bytes read */
5000); /* Timeout in 5 sec */
/* Copy telemetry data to user space */
if (!retval) {
if (copy_to_user(buffer, tele_device->bulk_in_buf,
bytes_read)) {
return -EFAULT;
} else {
return bytes_read;
}
}
return retval;
}
/* Write entry point */
static ssize_t
tele_write(struct file *file, const char *buffer,
size_t write_count, loff_t *ppos)
{
char *tele_buf = NULL;
struct urb *urb = NULL;
tele_device_t *tele_device;
/* Get the address of tele_device */
tele_device = (tele_device_t *)file->private_data;
/* ... */
/* Allocate a bulk URB */
urb = usb_alloc_urb(0, GFP_KERNEL);
if (!urb) {
return -ENOMEM;
}
/* Allocate a DMA-consistent transfer buffer and copy in
data from user space. On return, tele_buf contains
the buffer's CPU address, while urb->transfer_dma
contains the DMA address */
tele_buf = usb_buffer_alloc(tele_dev->usbdev, write_count,
GFP_KERNEL, &urb->transfer_dma);
if (copy_from_user(tele_buf, buffer, write_count)) {
usb_buffer_free(tele_device->usbdev, write_count,
tele_buf, urb->transfer_dma);
usb_free_urb(urb);

```

```c

return -EFAULT
}
/* Populate bulk URB fields */
usb_fill_bulk_urb(urb, tele_device->usbdev,
usb_sndbulkpipe(tele_device->usbdev,
tele_device->bulk_out_addr),
tele_buf, write_count, tele_write_callback,
tele_device);
/* urb->transfer_dma is valid, so preferably utilize
that for data transfer */
urb->transfer_flags |= URB_NO_TRANSFER_DMA_MAP;
/* Submit URB asynchronously */
usb_submit_urb(urb, GFP_KERNEL);
/* Release URB reference */
usb_free_urb(urb);
return(write_count);
}
/* Write callback */
static void
tele_write_callback(struct urb *urb)
{
tele_device_t *tele_device;
/* Get the address of tele_device */
tele_device = (tele_device_t *)urb->context;
/* urb->status contains the submission status. It's 0 if
successful. Resubmit the URB in case of errors other than
-ENOENT, -ECONNRESET, and -ESHUTDOWN */
/* ... */
/* Free the transfer buffer. usb_buffer_free() is the
release-counterpart of usb_buffer_alloc() called
from tele_write() */
usb_buffer_free(urb->dev, urb->transfer_buffer_length,
urb->transfer_buffer, urb->transfer_dma);
}

```

## Trình điều khiển theo lớp (Class Drivers)

Đặc tả USB giới thiệu khái niệm về các lớp thiết bị (device classes) và mô tả chức năng của từng trình điều khiển theo lớp (class driver). Các ví dụ về lớp thiết bị tiêu chuẩn bao gồm thiết bị lưu trữ khối lượng lớn (mass storage), mạng, bộ tập trung (hubs), bộ chuyển đổi nối tiếp (serial converters), âm thanh, video, hình ảnh, modem, máy in và *thiết bị giao diện người dùng* (Human Interface Devices - HIDs). Các class driver có tính tổng quát và cho phép bạn cắm-và-chạy (plug-and-play) một loạt các thẻ (cards) mà không cần phải phát triển và cài đặt driver cho từng thiết bị riêng lẻ. Hệ thống con Linux-USB (Linux-USB subsystem) bao gồm sự hỗ trợ cho các class driver chính.

Mỗi thiết bị USB đều có mã lớp (class code) và mã lớp con (subclass code). Ví dụ, lớp lưu trữ khối lượng lớn (mass storage class) (0x08) hỗ trợ các lớp con như đĩa quang (compact disc) (0x02), băng từ (tape) (0x03) và bộ nhớ thể rắn (solid-state storage) (0x06). Như bạn đã thấy trước đó, các device driver điền thông tin vào cấu trúc `usb_device_id` với các lớp và lớp con mà chúng hỗ trợ. Bạn có thể thu thập thông tin về lớp và lớp con của thiết bị bằng cách xem các dòng bắt đầu bằng "I:" trong tệp đầu ra */proc/bus/usb/devices*.

Hãy cùng xem xét một số class driver quan trọng.

## Thiết bị lưu trữ dung lượng lớn (Mass Storage)

Trong thuật ngữ USB, thiết bị lưu trữ dung lượng lớn (mass storage) đề cập đến các ổ cứng USB, ổ đĩa flash (pen drive), ổ CD-ROM, ổ đĩa mềm và các thiết bị lưu trữ tương tự. Các thiết bị lưu trữ dung lượng lớn qua USB tuân thủ theo giao thức *Small Computer System Interface* (SCSI) để giao tiếp với hệ thống máy chủ (host system). Do đó, quyền truy cập khối (block access) vào các thiết bị lưu trữ USB được định tuyến (routed) thông qua hệ thống con SCSI (SCSI subsystem) của kernel. Hình 11.4 cung cấp cho bạn một cái nhìn tổng quan về sự tương tác giữa lưu trữ USB và các phân hệ SCSI. Như được minh họa trong hình, phân hệ SCSI được kiến trúc thành ba tầng:

- **1.** Các trình điều khiển tầng trên (top-level drivers) dành cho các thiết bị như đĩa cứng (*sd.c*) và ổ CD-ROM (*sr.c*)
- **2.** Tầng trung gian (middle-level layer) có nhiệm vụ quét bus, cấu hình thiết bị và liên kết các trình điều khiển tầng trên với các trình điều khiển tầng dưới
- **3.** Các trình điều khiển bộ điều hợp SCSI tầng dưới (low-level SCSI adapter drivers)

**Hình 11.4. Lưu trữ dung lượng lớn USB và SCSI.**

[Xem hình kích thước đầy đủ]

```

User Space
-----------------------------------------------------------------
"mount /dev/sda1 /mnt"

|
v
/dev/sd*, /dev/sr*
^

|
v
+---------------------------------------------------------------+
|          Disk (sd), CDROM (sr) drivers                        |--> Upper-level SCSI
+---------------------------------------------------------------+
^

|
v
+---------------------------------------------------------------+
|          Scan, Configure, Glue logic                          |--> Mid-level SCSI
+---------------------------------------------------------------+
^

|
SCSI Command Queue

|
v

---------------- Mass Storage Driver -------------

|                                                |
|   [ USB Mass Storage                           |
|     Virtual SCSI Adapter ]  --> Low-level SCSI |
|            ^        |          Adapter Driver  |
|            |        |                          |
|            |        |                          |
|            |        v                          |
|        [ Transport Layer ]                     |<------> [ USB Core ]
|                                                |
--------------------------------------------------
^

|
URBs
v
-----------------------------------------------------------------
Kernel Space / Hardware
-----------------------------------------------------------------
[ USB Storage Device ]

```

Trình điều khiển lưu trữ dung lượng lớn (mass storage driver) tự đăng ký như một bộ điều hợp SCSI ảo (virtual SCSI adapter). Bộ điều hợp ảo này giao tiếp hướng lên (upstream) thông qua các lệnh SCSI và hướng xuống (downstream) bằng cách sử dụng các URB (USB Request Block). Một đĩa USB xuất hiện đối với các tầng cao hơn như một thiết bị SCSI được gắn vào bộ điều hợp ảo này.

Để hiểu rõ hơn về các tương tác giữa tầng USB và tầng SCSI, chúng ta hãy thực hiện một sửa đổi đối với trình điều khiển lưu trữ dung lượng lớn USB. Nút *usbfs* */proc/bus/usb/devices* chứa các thuộc tính và chi tiết kết nối của tất cả các thiết bị USB được gắn vào hệ thống. Ví dụ, dòng "T:" trong kết quả đầu ra của */proc/bus/usb/devices* chứa số bus, độ sâu của thiết bị tính từ root hub, tốc độ hoạt động, v.v. Dòng "P:" chứa mã nhà sản xuất (vendor ID), mã sản phẩm (product ID) và số phiên bản sửa đổi (revision number) của thiết bị. Tất cả thông tin có sẵn trong */proc/bus/usb/devices* được quản lý bởi phân hệ USB (USB subsystem), nhưng có một mảnh thông tin còn thiếu thuộc thẩm quyền của phân hệ SCSI. Tên nút */dev* liên kết với thiết bị lưu trữ USB (*sd[a-z][1-9]* đối với đĩa và *sr[0-9]* đối với CD-ROM) không có sẵn trong */proc/bus/usb/devices*. Để khắc phục hạn chế này, chúng ta hãy bổ sung một dòng "N:" hiển thị tên nút */dev* liên kết với thiết bị. Liệt kê 11.6 cho thấy các thay đổi mã nguồn cần thiết dưới dạng một bản vá nguồn (source patch) áp dụng cho cây kernel 2.6.23.1.

### Liệt kê 11.6. Thêm Tên** */dev* **của ổ đĩa vào usbfs

```

include/scsi/scsi_host.h:
struct Scsi_Host {
/* ... */
void *shost_data;

- char snam[8]; /* /dev node name for this disk */
/* ... */
};
drivers/usb/storage/usb.h:
struct us_data {
/* ... */

- char magic[4];
};
include/linux/usb.h:
struct usb_interface {
/* ... */

- void *private_data;
};
drivers/usb/storage/usb.c:
static int storage_probe(struct usb_interface *intf,
const struct usb_device_id *id)
{
/* ... */
memset(us, 0, sizeof(struct us_data));

- intf->private_data = (void *) us;
- strncpy(us->magic, "disk", 4);
mutex_init(&(us->dev_mutex));
/* ... */
}
drivers/scsi/sd.c:
static int sd_probe(struct device *dev)
{
/* ... */
add_disk(gd);

- memset(sdp->host->snam,0, sizeof(sdp->host->snam));
- strncpy(sdp->host->snam, gd->disk_name, 3);
sdev_printk(KERN_NOTICE, sdp, "Attached scsi %sdisk %s\n",
sdp->removable ? "removable " : "", gd->disk_name);
/* ... */
}
drivers/scsi/sr.c:
static int sr_probe(struct device *dev)
{

```

```

/* ... */
add_disk(disk);

- memset(sdev->host->snam,0, sizeof(sdev->host->snam));
- strncpy(sdev->host->snam, cd->cdi.name, 3);
sdev_printk(KERN_DEBUG, sdev, "Attached scsi CD-ROM %s\n",
cd->cdi.name);
/* ... */
}
drivers/usb/core/devices.c:
/* ... */

## include <asm/uaccess.h>

- #include <scsi/scsi_host.h>
- #include "../storage/usb.h"
static ssize_t usb_device_dump(char __user **buffer, size_t *nbytes,
loff_t *skip_bytes, loff_t *file_offset,
struct usb_device *usbdev,
struct usb_bus *bus, int level,
int index, int count)
{
/* ... */
ssize_t total_written = 0;

- struct us_data *us_d;
- struct Scsi_Host *s_h;
/* ... */
data_end = pages_start + sprintf(pages_start, format_topo,
bus->busnum, level,
parent_devnum,
index, count, usbdev->devnum,
speed, usbdev->maxchild);

- /* Assume this device supports only one interface */
- us_d = (struct us_data *)
- (usbdev->actconfig->interface[0]->private_data);
+

- if ((us_d) && (!strncmp(us_d->magic, "disk", 4))) {
- s_h = (struct Scsi_Host *) container_of((void *)us_d,
- struct Scsi_Host,
- hostdata);
- data_end += sprintf(data_end, "N: ");
- data_end += sprintf(data_end, "Device=%.100s",s_h->snam);
- if (!strncmp(s_h->snam, "sr", 2)) {
- data_end += sprintf(data_end, " (CDROM)\n");
- } else if (!strncmp(s_h->snam, "sd", 2)) {
- data_end += sprintf(data_end, " (Disk)\n");
- }
- }
/* ... */
}

```

Để hiểu rõ Liệt kê 11.6, trước tiên chúng ta hãy Lần vết (trace) luồng mã nguồn, tiếp tục từ phần chúng ta đã dừng lại ở mục "Đánh số thiết bị" (Enumeration). Trong phần đó, chúng ta đã cắm một thiết bị USB pen drive và theo dõi chuỗi thực thi cho đến khi hàm `storage_probe()` được gọi, đây là phương thức `probe()` của driver lưu trữ dung lượng lớn (mass storage driver). Tiến xa hơn nữa:

- **1.** `storage_probe()` đăng ký một adapter SCSI ảo bằng cách gọi hàm `scsi_add_host()`, truyền vào một cấu trúc dữ liệu riêng (private data structure) có tên là `us_data` làm đối số. `scsi_add_host()` trả về một cấu trúc `Scsi_Host` cho adapter ảo này, với phần không gian ở cuối được dành riêng cho `us_data`.
- **2.** Nó khởi tạo một tiến trình nhân (kernel thread) có tên là *usb-storage* để xử lý tất cả các lệnh SCSI được đưa vào hàng đợi (queue) của adapter ảo.
- **3.** Nó lên lịch (schedule) cho một tiến trình nhân có tên là *usb-stor-scan*, tiến trình này yêu cầu tầng trung gian SCSI (SCSI middle-level layer) quét bus để tìm các thiết bị được kết nối.
- **4.** Quá trình quét thiết bị được khởi tạo ở Bước 3 phát hiện ra sự hiện diện của chiếc pen drive vừa cắm vào và gắn (bind) driver đĩa SCSI tầng trên (*sd.c*) vào thiết bị. Việc này dẫn đến việc gọi phương thức `probe()` của driver đĩa SCSI, cụ thể là hàm `sd_probe()`.
- **5.** Driver *sd* cấp phát một nút */dev/sd\** cho ổ đĩa. Từ thời điểm này trở đi, các ứng dụng (application) sử dụng giao diện này để truy cập ổ đĩa USB. Phân hệ SCSI (SCSI subsystem) đưa các lệnh đĩa vào hàng đợi của adapter ảo, và tiến trình nhân `usb-storage` sẽ xử lý các lệnh này bằng cách sử dụng các URB (USB Request Block) phù hợp.

Bây giờ bạn đã nắm được các nguyên tắc cơ bản, chúng ta hãy cùng phân tích chi tiết Liệt kê 11.6, trước tiên là xem xét các phần bổ sung trong cấu trúc dữ liệu. Đoạn mã thêm một trường `snam` vào cấu trúc `Scsi_Host` để lưu trữ tên thiết bị */dev* SCSI liên quan mà chúng ta quan tâm. Nó cũng thêm một trường `private` vào cấu trúc `usb_interface` để liên kết mỗi giao diện USB (USB interface) với cấu trúc `us_data` của nó. Vì `us_data` chỉ có ý nghĩa đối với các thiết bị lưu trữ (storage devices), chúng ta cần đảm bảo tính hợp lệ của trường `private` thuộc giao diện USB trước khi truy cập nó dưới dạng `us_data`. Để làm điều này, Liệt kê 11.6 thêm một chuỗi ma thuật (magic string) là "disk" vào `us_data`.

Sửa đổi trong *usbfs* tại Liệt kê 11.6 (đối với tệp `drivers/usb/core/devices.c`) trích xuất cấu trúc `us_data` được liên kết với mỗi giao diện thông qua trường dữ liệu riêng (`private data field`) của `usb_interface` tương ứng. Sau đó, nó bám vào cấu trúc `Scsi_Host` có liên quan bằng cách sử dụng hàm `container_of()`, bởi vì như bạn đã thấy ở Bước 1 trước đó, `usb_data` được gắn vào phần cuối của cấu trúc `Scsi_Host` tương ứng. Như bạn đã thấy tiếp ở Bước 5, `Scsi_Host` chứa các tên nút */dev* mà các driver `sd` và `sr` điền vào. Usbfs lắp ghép lại một dòng bắt đầu bằng "N:" bằng cách sử dụng thông tin này.

Dưới đây là phần văn bản đã được dịch sang tiếng Việt theo đúng các tiêu chuẩn kỹ thuật yêu cầu:

Dưới đây là kết quả đầu ra của */proc/bus/usb/devices* sau khi tích hợp các thay đổi trong Liệt kê (Listing) 11.6 và kết nối một ổ flash USB PNY, một ổ CD-ROM Addonics, và một ổ cứng Seagate với máy tính xách tay thông qua một USB hub. Các dòng "N:" thông báo định danh của node */dev* tương ứng với từng thiết bị (device):

### bash> cat /proc/bus/usb/devices

```

...
T: Bus=04 Lev=02 Prnt=02 Port=00 Cnt=01 Dev#= 3 Spd=480 MxCh= 0
N: Device=sda(Disk)
D: Ver= 2.00 Cls=00(>ifc ) Sub=00 Prot=00 MxPS=64 #Cfgs= 1
P: Vendor=154b ProdID=0002 Rev= 1.00
S: Manufacturer=PNY
S: Product=USB 2.0 FD
S: SerialNumber=6E5C07005B4F
C:* #Ifs= 1 Cfg#= 1 Atr=80 MxPwr= 0mA
I:* If#= 0 Alt= 0 #EPs= 2 Cls=08(stor.) Sub=06 Prot=50 Driver=usb-
storage
E: Ad=81(I) Atr=02(Bulk) MxPS= 512 Ivl=0ms
E: Ad=02(O) Atr=02(Bulk) MxPS= 512 Ivl=0ms
T: Bus=04 Lev=02 Prnt=02 Port=01 Cnt=02 Dev#= 5 Spd=480 MxCh= 0
N: Device=sr0(CDROM)
D: Ver= 2.00 Cls=00(>ifc ) Sub=00 Prot=00 MxPS=64 #Cfgs= 1
P: Vendor=0bf6 ProdID=a002 Rev= 3.00
S: Manufacturer=Addonics

```

```

S: Product=USB to IDE Cable
S: SerialNumber=1301011002A9AFA9
C:* #Ifs= 1 Cfg#= 2 Atr=c0 MxPwr= 98mA
I:* If#= 0 Alt= 0 #EPs= 3 Cls=08(stor.) Sub=06 Prot=50 Driver=usb-
storage
E: Ad=01(O) Atr=02(Bulk) MxPS= 512 Ivl=125us
E: Ad=82(I) Atr=02(Bulk) MxPS= 512 Ivl=0ms
E: Ad=83(I) Atr=03(Int.) MxPS= 2 Ivl=32ms
T: Bus=04 Lev=02 Prnt=02 Port=02 Cnt=03 Dev#= 4 Spd=480 MxCh= 0
N: Device=sdb(Disk)
D: Ver= 2.00 Cls=00(>ifc ) Sub=00 Prot=00 MxPS=64 #Cfgs= 1
P: Vendor=0bc2 ProdID=0501 Rev= 0.01
S: Manufacturer=Seagate
S: Product=USB Mass Storage
S: SerialNumber=000000062459
C:* #Ifs= 1 Cfg#= 1 Atr=c0 MxPwr= 0mA
I:* If#= 0 Alt= 0 #EPs= 2 Cls=08(stor.) Sub=06 Prot=50 Driver=usb-
storage
E: Ad=02(O) Atr=02(Bulk) MxPS= 512 Ivl=0ms
E: Ad=88(I) Atr=02(Bulk) MxPS= 512 Ivl=0ms
...

```

Như bạn có thể thấy, hệ thống con SCSI (SCSI subsystem) đã phân bổ *sda* cho ổ flash, *sr0* cho ổ CD-ROM, và *sdb* cho ổ cứng. Các ứng dụng không gian người dùng (user-space applications) thao tác trên các node này để giao tiếp với các thiết bị tương ứng. Tuy nhiên, như bạn đã thấy ở Chương 4, với sự xuất hiện của `udev`, bạn có tùy chọn tạo ra các lớp trừu tượng (abstraction) cấp cao hơn để nhận diện từng thiết bị mà không cần phụ thuộc vào định danh của các tên */dev* do hệ thống con SCSI cấp phát.

## USB-Serial

Các bộ chuyển đổi USB sang nối tiếp (USB-to-serial converter) mang lại khả năng sử dụng cổng nối tiếp (serial port) cho máy tính của bạn thông qua USB. Ví dụ, bạn có thể sử dụng bộ chuyển đổi USB-serial để lấy một console gỡ lỗi nối tiếp (serial debug console) từ một thiết bị nhúng (embedded device) trên một máy tính xách tay phát triển không có cổng serial nào.

Trong Chương 6, "Trình điều khiển Serial" (Serial Drivers), bạn đã tìm hiểu các lợi ích của kiến trúc serial phân lớp của kernel. Hình 11.5 minh họa cách lớp USB-Serial (USB-Serial layer) khớp với framework serial của kernel.

**Hình 11.5. Lớp USB-Serial.**

[Xem hình kích thước đầy đủ]

```

Ứng dụng Người dùng (Giao diện System Call)
-----------------------------------------------------------------

[ N_TTY (n_tty.c) ]   -----------> [ Trình điều khiển Bộ chuyển đổi USB-Serial ]  <---- [ Bộ chuyển đổi USB-Serial ]
^                                   |             |

|       Lớp Line Discipline         v             |
|                             [ usb_serial.c ]    |
[ serial_core.c ]                                        |
^                                                 |

|           Lớp TTY                               |
|                                                 |
[ 8250.c ]                                            |
^                                                 v
|        Trình điều khiển Cấp thấp                [USB Core]
|
[ UART loại 16550 ]
^

|
Lớp Vật lý

```

Một trình điều khiển USB-serial cũng tương tự như các trình điều khiển client USB khác, ngoại trừ việc nó tận dụng các dịch vụ của một USB-Serial core (lõi USB-Serial) bên cạnh USB core. USB-Serial core cung cấp các tính năng sau:

- Một trình điều khiển tty (tty driver) giúp cô lập các trình điều khiển bộ chuyển đổi USB-serial cấp thấp khỏi các lớp serial bậc cao hơn như các quy tắc đường truyền (line disciplines).
- Các hàm khởi tạo `probe()` và hủy kết nối `disconnect()` chung mà các trình điều khiển USB-serial riêng lẻ có thể tận dụng.
- Các node thiết bị để truy cập các cổng USB-serial từ không gian người dùng (user space). Các ứng dụng thao tác trên các cổng USB-serial thông qua */dev/ttyUSBX*, trong đó *X* là số thứ tự cổng serial. Các trình giả lập terminal (terminal emulator) như *minicom* và các giao thức như PPP chạy mà không cần thay đổi trên các giao diện này.

Về cơ bản, một trình điều khiển bộ chuyển đổi USB-serial cấp thấp thực hiện những việc sau:

Đăng ký một cấu trúc `usb_serial_driver` với USB-Serial core bằng cách sử dụng `usb_serial_register()`. Các điểm đầu vào (entry point) được cung cấp như một phần của `usb_serial_driver` tạo nên cốt lõi của trình điều khiển. **1.**

Điền thông tin vào cấu trúc `usb_driver` và đăng ký nó với USB core (lõi USB) bằng hàm `usb_register()`. Việc này tương tự như những gì driver telemetry (đo từ xa) mẫu thực hiện, ngoại trừ việc một driver bộ chuyển đổi nối tiếp (serial converter driver) có thể tận dụng các hàm `probe()` và `disconnect()` chung do USB-Serial core cung cấp. **2.**

Liệt kê 11.7 chứa các đoạn mã nguồn từ FTDI driver (*drivers/usb/serial/ftdi\_sio.c*) để thực hiện hai việc đăng ký này cho các bộ chuyển đổi USB sang serial dựa trên các dòng chip FTDI.

**Liệt kê 11.7. Một đoạn mã từ FTDI Driver**

```

/* Cấu trúc usb_driver */
static struct usb_driver ftdi_driver = {
.name = "ftdi_sio", /* Tên */
.probe = usb_serial_probe, /* Được cung cấp bởi
USB-Serial core */
.disconnect = usb_serial_disconnect,/* Được cung cấp bởi
USB-Serial core */
.id_table = id_table_combined, /* Danh sách các thiết bị được hỗ trợ
xây dựng
quanh chip FTDI */
.no_dynamic_id = 1, /* ID được hỗ trợ không thể được
thêm một cách động */
};
/* Cấu trúc usb_serial_driver */
static struct usb_serial_driver ftdi_sio_device = {
/* ... */
.num_ports = 1,
.probe = ftdi_sio_probe,
.port_probe = ftdi_sio_port_probe,
.port_remove = ftdi_sio_port_remove,
.open = ftdi_open,
.close = ftdi_close,
.throttle = ftdi_throttle,
.unthrottle = ftdi_unthrottle,
.write = ftdi_write,
.write_room = ftdi_write_room,
.chars_in_buffer = ftdi_chars_in_buffer,
.read_bulk_callback = ftdi_read_bulk_callback,
.write_bulk_callback = ftdi_write_bulk_callback,
/* ... */
};
/* Khởi tạo Driver */
static int __init ftdi_init(void)
{
/* ... */
/* Đăng ký với USB-Serial core */
retval = usb_serial_register(&ftdi_sio_device);
/* ... */
/* Đăng ký với USB core */
retval = usb_register(&ftdi_driver);
/* ... */
}

```

## Thiết bị Giao diện Người dùng (Human Interface Devices)

Các thiết bị như bàn phím và chuột được gọi là *thiết bị giao diện người dùng* (human interface devices - HIDs). Hãy xem mục "USB and Bluetooth Keyboards" trong Chương 7, "Input Drivers," để thảo luận về lớp USB HID.

## Bluetooth

Một USB-Bluetooth dongle là cách nhanh chóng để trang bị tính năng Bluetooth cho máy tính của bạn nhằm giao tiếp với các thiết bị được tích hợp Bluetooth như điện thoại di động, chuột hoặc thiết bị cầm tay. Chương 16 thảo luận về lớp USB Bluetooth.

## Gadget Drivers (Driver Thiết bị ngoại vi)

Trong kịch bản sử dụng điển hình, một thiết bị nhúng kết nối với một máy tính host qua cổng USB. Các máy tính nhúng thường đóng vai trò là phía thiết bị (device side) của USB, không giống như các hệ thống PC hoạt động như các USB host. Vì Linux chạy trên cả hệ thống nhúng lẫn PC, nó cần hỗ trợ chạy ở cả hai đầu của kết nối USB. Dự án USB Gadget mang lại khả năng hoạt động ở chế độ thiết bị USB (USB device mode) cho các hệ thống Linux nhúng. Bus 3 của thiết bị Linux nhúng trong Hình 11.2 có thể, ví dụ, sử dụng một *gadget driver* để cho phép thiết bị hoạt động như một ổ đĩa lưu trữ khối lớn (mass storage drive) khi được kết nối với máy tính host.

Trước khi tiếp tục, chúng ta hãy điểm qua một số thuật ngữ liên quan. Bộ điều khiển USB ở phía thiết bị được gọi bằng nhiều tên khác nhau như *device controller* (bộ điều khiển thiết bị), *peripheral controller* (bộ điều khiển ngoại vi), *client controller* (bộ điều khiển máy khách), hoặc *function controller* (bộ điều khiển chức năng). Các thuật ngữ *gadget* và *gadget driver* thường được sử dụng thay cho các từ bị lạm dụng quá nhiều là *device* (thiết bị) và *device driver* (driver thiết bị).

Hỗ trợ USB gadget hiện là một phần của nhân chính thống (mainline kernel) và bao gồm các thành phần sau:

- Các driver cho bộ điều khiển thiết bị USB được tích hợp sẵn trong các dòng SoC như Intel PXA, Texas Instruments OMAP, và Atmel AT91. Các driver này đồng thời cung cấp một *gadget API* mà các gadget driver có thể sử dụng.
- Các gadget driver cho các lớp thiết bị như lưu trữ (storage), mạng (networking), và bộ chuyển đổi nối tiếp (serial converters). Các driver này phản hồi lại lớp của chúng khi nhận được các yêu cầu liệt kê (enumeration requests) từ phần mềm ở phía host. Ví dụ, một storage gadget driver tự xác định nó là một thiết bị lớp 0x08 (lớp lưu trữ khối lớn - mass storage class) và xuất một phân vùng lưu trữ ra host. Bạn có thể chỉ định nút thiết bị khối (block device node) hoặc tên tệp liên quan thông qua một tham số truyền vào khi chèn module (module-insertion parameter). Do vùng được xuất ra phải hiển thị với host như một thiết bị lưu trữ khối lớn, gadget driver sẽ thực hiện các tương tác SCSI cần thiết theo giao thức lưu trữ khối lớn USB (USB mass storage protocol). Các gadget driver cũng có sẵn cho các thiết bị Ethernet và serial.
- Một gadget driver dạng khung xương (skeletal gadget driver), *drivers/usb/gadget/zero.c*, mà bạn có thể sử dụng để kiểm thử các driver bộ điều khiển thiết bị.

Các gadget driver sử dụng các dịch vụ của gadget API được cung cấp bởi các driver bộ điều khiển thiết bị. Chúng điền thông tin vào cấu trúc `usb_gadget_driver` và đăng ký nó với kernel bằng hàm `usb_gadget_register_driver()`. Các chi tiết cụ thể về phần cứng được ẩn bên trong việc triển khai gadget API do từng driver bộ điều khiển thiết bị cung cấp, vì vậy bản thân các gadget driver không phụ thuộc vào phần cứng.

*Documentation/DocBook/gadget.tmpl* cung cấp một cái nhìn tổng quan về gadget API. Hãy xem trang [http://linux](http://linux-)usb.org/gadget/ để biết thêm thông tin về dự án gadget.

## Gỡ lỗi (Debugging)

Một bộ phân tích bus USB (USB bus analyzer) giúp phóng to các hoạt động diễn ra trên bus và rất hữu ích trong việc gỡ lỗi các vấn đề ở tầng thấp (low-level). Nếu bạn không có sẵn bộ phân tích, bạn có thể tạm dùng trình theo dõi USB mềm của kernel, *usbmon*. Công cụ này nắm bắt lưu lượng giữa các bộ điều khiển host USB và các thiết bị. Để thu thập dữ liệu vết (trace), hãy đọc từ tệp *debugfs*[3] tại */sys/kernel/debug/usbmon/Xt*, trong đó *X* là số thứ tự bus mà thiết bị của bạn đang kết nối.

[3] Một hệ thống tệp trong bộ nhớ (in-memory filesystem) để xuất dữ liệu gỡ lỗi kernel (kernel debug data) ra không gian người dùng (user space).

Ví dụ, hãy xem xét một ổ đĩa USB được kết nối với PC. Từ dòng "T:" tương ứng trong */proc/bus/usb/devices*, bạn có thể thấy ổ đĩa được gắn vào bus 1:

```

T: Bus=01 Lev=01 Prnt=01 Port=03 Cnt=01 Dev#= 2 Spd=480 MxCh= 0

```

Đảm bảo rằng bạn đã bật hỗ trợ *debugfs* (CONFIG\_DEBUG\_FS) và usbmon (CONFIG\_USB\_MON) trong kernel của mình. Đây là một bản chụp (snapshot) của đầu ra usbmon khi đang sao chép một tệp từ ổ đĩa:

```

bash> mount -t debugfs none_debugs /sys/kernel/debug/
bash> cat /sys/kernel/debug/usbmon/1u
...
ee6a5c40 3718782540 S Bi:1:002:1 -115 20480 <
ee6a5cc0 3718782567 S Bi:1:002:1 -115 65536 <
ee6a5d40 3718782595 S Bi:1:002:1 -115 36864 <
ee6a5c40 3718788189 C Bi:1:002:1 0 20480 = 0f846801 118498f\ 15c60500 01680106
5e846801 608498fe 6f280087 68000000
ee6a5cc0 3718800994 C Bi:1:002:1 0 65536 = 118498fe 15c60500\ 01680106 5e846801
608498fe 6f280087 68000000 00884800
ee6a5d40 3718801001 C Bi:1:002:1 0 36864 = 13608498 fe4f4a01\ 00514a01 006f2800
87680000 00008848 00000100 b7f00100
...

```

Mỗi dòng đầu ra bắt đầu bằng địa chỉ URB, tiếp theo là dấu thời gian sự kiện (event timestamp). Ký tự *S* ở cột tiếp theo biểu thị việc gửi URB (URB submission), và *C* thông báo một lệnh gọi lại (callback). Trường tiếp theo có định dạng URBType:Bus#:DeviceAddress:Endpoint#. Trong phần đầu ra ở trên, URBType là Bi viết tắt cho một bulk URB theo hướng IN. Sau phần này, usbmon kết xuất (dump) trạng thái URB, độ dài dữ liệu, thẻ dữ liệu (data tag, là `=` hoặc `<` trong đầu ra trước đó), và các từ dữ liệu (data words) (nếu thẻ là `=`). Ba dòng cuối cùng trong phần đầu ra trước đó là các callback liên kết với các bulk URB được gửi ở các dòng trước đó. Bạn có thể khớp các callback với các lượt gửi liên quan bằng cách sử dụng địa chỉ URB. *Documentation/usb/usbmon.txt* trình bày chi tiết cú pháp của usbmon và chứa mã nguồn mẫu để phân tích đầu ra thành dạng con người có thể đọc được (human readable form).

Nếu bạn bật *Device Drivers USB Support USB Verbose Debug Messages* trong quá trình cấu hình kernel, kernel sẽ in ra nội dung của tất cả các câu lệnh dev\_dbg() có trong hệ thống con USB (USB subsystem).

Bạn có thể thu thập thông tin cụ thể về thiết bị và bus từ nút hệ thống tệp USB (*usbfs*), */proc/bus/usb/devices*. Và như chúng ta thảo luận trong Chương 19, "Drivers in User Space" (Trình điều khiển trong không gian người dùng), usbfs cũng cho phép bạn triển khai các trình điều khiển thiết bị USB (USB device driver) ở user space. Ngay cả khi đích đến cuối cùng của trình điều khiển USB nằm bên trong kernel, việc bắt đầu với một trình điều khiển ở user space có thể giúp đơn giản hóa quá trình gỡ lỗi (debugging) và kiểm thử (testing).

Danh sách gửi thư (mailing list) linux-usb-devel là diễn đàn để thảo luận các câu hỏi liên quan đến trình điều khiển thiết bị USB. Truy cập https://lists.sourceforge.net/lists/listinfo/linux-usb-devel để biết thông tin đăng ký và truy xuất kho lưu trữ (archive). Đọc www.linux-usb.org/usbtest để có ý tưởng về kiểm thử USB.

Trang chủ của dự án Linux-USB là www.linux-usb.org. Bạn có thể tải xuống thông số kỹ thuật USB 2.0, phần bổ sung OTG (OTG supplement), và các tiêu chuẩn liên quan khác từ www.usb.org/developers/docs.

## Xem xét Mã nguồn (Looking at the Sources)

Tầng lõi USB (USB core layer) nằm trong *drivers/usb/core/*. Thư mục này cũng chứa các hàm (routines) thao tác URB và phần triển khai usbfs. Trình điều khiển hub và khubd là một phần của *drivers/usb/core/hub.c*. Thư mục *drivers/usb/host/* chứa các trình điều khiển thiết bị bộ điều khiển máy chủ (host controller device driver). Các định nghĩa tệp tiêu đề (header definition) liên quan đến USB nằm trong *include/linux/usb\*.h*. Bộ theo dõi usbmon nằm ở *drivers/usb/mon/*. Hãy tìm bên trong *Documentation/usb/* để có tài liệu về Linux-USB.

Các trình điều khiển lớp USB (USB class driver) nằm trong các thư mục con khác nhau dưới *drivers/usb/*. Trình điều khiển lưu trữ dung lượng lớn (mass storage driver) *drivers/usb/storage/*, song hành với hệ thống con SCSI *drivers/scsi/*, triển khai giao thức lưu trữ dung lượng lớn USB (USB mass storage protocol). Cây thư mục *drivers/input/*[4] bao gồm các trình điều khiển cho các thiết bị đầu vào USB như bàn phím và chuột; *drivers/usb/serial/* có các trình điều khiển cho bộ chuyển đổi USB sang nối tiếp (USB-to-serial converter); *drivers/usb/media/* hỗ trợ các thiết bị đa phương tiện USB; *drivers/net/usb/*[5] có các trình điều khiển cho các thiết bị USB Ethernet (Ethernet dongle); và *drivers/usb/misc/* chứa các trình điều khiển cho các thiết bị USB hỗn hợp như đèn LED, màn hình LCD và cảm biến vân tay. Hãy xem *drivers/usb/usb-skeleton.c* để tìm mẫu trình điều khiển khởi đầu (driver template) nếu bạn không thể tìm thấy một kết quả khớp sát hơn.

[4] Trước phiên bản phát hành kernel 2.6.22, các trình điều khiển thiết bị đầu vào USB thường nằm trong *drivers/usb/input/*.

[5] Trước phiên bản phát hành kernel 2.6.22, các trình điều khiển thiết bị mạng USB thường nằm trong *drivers/usb/net/*.

Hệ thống con tiện ích USB (USB gadget subsystem) nằm trong *drivers/usb/gadget/*. Thư mục này chứa các trình điều khiển bộ điều khiển thiết bị USB (USB device controller driver), và các trình điều khiển tiện ích (gadget driver) cho lưu trữ dung lượng lớn (*file\_storage.c*), bộ chuyển đổi nối tiếp (*serial.c*), và mạng Ethernet (*ether.c*).

Bảng 11.3 chứa các cấu trúc dữ liệu chính được sử dụng trong chương này và vị trí của chúng trong cây mã nguồn. Bảng 11.4 liệt kê các giao diện lập trình kernel (kernel programming interface) chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

| Bảng 11.3. Tóm tắt các Cấu trúc Dữ liệu | | |
|-----------------------------------|----------|---------------------------------------------------------|
| Cấu trúc dữ liệu (Data Structure)                                                                     | Vị trí (Location)                                        | Mô tả (Description)                                     |
| urb                                                                                                   | include/linux/usb.h                                      | Tâm điểm của cơ chế truyền dữ liệu USB<br>(USB data transfer mechanism) |
| pipe                                                                                                  | include/linux/usb.h                                      | Thành phần địa chỉ của một URB                          |
| usb_device_descriptor<br>usb_config_descriptor<br>usb_interface_descriptor<br>usb_endpoint_descriptor | include/linux/usb/ch9.h                                  | Các bộ mô tả (Descriptor) chứa thông tin về thiết bị USB |
| usb_device                                                                                            | include/linux/usb.h                                      | Đại diện cho một thiết bị USB (USB Device)              |
| usb_device_id                                                                                         | include/linux/mod_devicetable.h                          | Định danh của một thiết bị USB                          |
| usb_driver                                                                                            | include/linux/usb.h                                      | Đại diện cho một trình điều khiển client USB (USB Client Driver) |
| usb_gadget_driver                                                                                     | include/linux/usb_gadget.h                               | Đại diện cho một trình điều khiển USB gadget (USB Gadget Driver) |

**Bảng 11.4. Tóm tắt các Giao diện Lập trình Kernel (Kernel Programming Interfaces)**

| Giao diện Kernel (Kernel Interface)                         | Vị trí (Location)                                   | Mô tả (Description)                                                   |
|-------------------------------------------------------------|-----------------------------------------------------|-----------------------------------------------------------------------|
| usb_register()                                              | include/linux/usb.h<br>drivers/usb/core/driver.c    | Đăng ký một `usb_driver` với USB core                                 |
| usb_deregister()                                            | drivers/usb/core/driver.c                           | Hủy đăng ký một `usb_driver` khỏi USB core                            |
| usb_set_intfdata()                                          | include/linux/usb.h                                 | Gắn dữ liệu riêng của thiết bị vào một `usb_interface`                |
| usb_get_intfdata()                                          | include/linux/usb.h                                 | Tách dữ liệu riêng của thiết bị ra khỏi một `usb_interface`           |
| usb_register_dev()                                          | drivers/usb/core/file.c                             | Liên kết một giao diện ký tự (character interface) với một USB client driver |
| usb_deregister_dev()                                        | drivers/usb/core/file.c                             | Hủy liên kết giao diện ký tự khỏi một USB client driver                |
| usb_alloc_urb()                                             | drivers/usb/core/urb.c                              | Cấp phát một URB                                                      |
| usb_fill_[control int bulk]_urb()                           | include/linux/usb.h                                 | Điền dữ liệu cho một URB                                              |
| usb_[control interrupt bulk]_msg()                          | drivers/usb/core/message.c                          | Các hàm bao bọc (wrapper) để gửi URB đồng bộ (synchronous URB submission) |
| usb_submit_urb()                                            | drivers/usb/core/urb.c                              | Gửi một URB tới USB core                                              |
| usb_free_urb()                                              | drivers/usb/core/urb.c                              | Giải phóng tham chiếu đến một URB đã hoàn thành                        |
| usb_unlink_urb()                                            | drivers/usb/core/urb.c                              | Giải phóng tham chiếu đến một URB đang chờ xử lý (pending URB)         |
| usb_[rcv snd][ctrl int bulk isoc]pipe()                     | include/linux/usb.h                                 | Tạo một đường ống USB (USB pipe)                                      |

| usb_find_interface()                                        | drivers/usb/core/usb.c                              | Lấy cấu trúc `usb_interface`<br>được liên kết với một USB client driver         |
| usb_buffer_alloc()                                          | drivers/usb/core/usb.c                              | Cấp phát một vùng đệm (buffer)<br>truyền DMA nhất quán (consistent DMA) |
| usb_buffer_free()                                           | drivers/usb/core/usb.c                              | Giải phóng một vùng đệm đã được<br>cấp phát bằng `usb_buffer_alloc()`         |
| usb_serial_register()                                       | drivers/usb/serial/usb<br>serial.c                  | Đăng ký một driver với USB<br>Serial core                           |
| usb_serial_deregister()                                     | drivers/usb/serial/usb<br>serial.c                  | Hủy đăng ký một driver khỏi USB<br>Serial core                      |
| usb_gadget_register_driver()                                | Device controller drivers trong<br>drivers/usb/gadget/ | Đăng ký một gadget với một device<br>controller driver                 |
