# Chương 13: Trình điều khiển USB (USB Drivers)

Bus nối tiếp vạn năng (Universal Serial Bus - USB) là kết nối giữa một máy tính chủ (host computer) và một số thiết bị ngoại vi. Ban đầu, nó được tạo ra để thay thế cho hàng loạt các loại bus chậm chạp và khác nhau—như các kết nối song song (parallel), nối tiếp (serial) và bàn phím—bằng một loại bus duy nhất mà mọi thiết bị đều có thể kết nối vào.\* USB đã phát triển vượt ra ngoài các kết nối chậm chạp này và hiện hỗ trợ hầu như mọi loại thiết bị có thể kết nối với một máy tính cá nhân (PC). Phiên bản sửa đổi mới nhất của đặc tả USB đã bổ sung các kết nối tốc độ cao với giới hạn tốc độ lý thuyết là 480 MBps.

Về mặt cấu trúc topo (topology), hệ thống con USB (USB subsystem) không được bố trí như một bus thuần túy; mà giống như một cây (tree) được xây dựng từ nhiều liên kết điểm-đểm (point-to-point). Các liên kết này là cáp bốn sợi (dây nối đất, nguồn và hai dây tín hiệu) kết nối giữa một thiết bị và một bộ tập trung (hub), giống như cáp mạng Ethernet đôi xoắn (twisted-pair Ethernet). Bộ điều khiển máy chủ USB (USB host controller) chịu trách nhiệm hỏi mọi thiết bị USB xem chúng có dữ liệu nào cần gửi hay không. Do cấu trúc topo này, một thiết bị USB không bao giờ có thể bắt đầu gửi dữ liệu mà không được sự cho phép trước từ host controller. Cấu hình này cho phép tạo ra một hệ thống cắm-là-chạy (plug-and-play) rất đơn giản, trong đó các thiết bị có thể được cấu hình tự động bởi máy tính chủ.

Bus này rất đơn giản ở cấp độ công nghệ, vì nó là một triển khai đơn chủ (single-master), trong đó máy tính chủ thực hiện thăm dò (poll) các thiết bị ngoại vi khác nhau. Mặc dù có giới hạn vốn có này, bus vẫn có một số tính năng thú vị, chẳng hạn như khả năng cho phép một thiết bị yêu cầu một băng thông cố định cho việc truyền dữ liệu của nó nhằm hỗ trợ đáng tin cậy cho việc nhập/xuất (I/O) âm thanh và video. Một tính năng quan trọng khác của USB là nó đóng vai trò thuần túy như một kênh giao tiếp giữa thiết bị và host, mà không yêu cầu ý nghĩa hay cấu trúc cụ thể nào đối với dữ liệu mà nó truyền tải.†

- \* Một phần của chương này dựa trên tài liệu trong nhân (in-kernel documentation) dành cho mã nguồn USB của Linux kernel, được viết bởi các nhà phát triển USB nhân và phát hành theo giấy phép GPL.
- † Trên thực tế, có một số cấu trúc tồn tại, nhưng nó chủ yếu xoay quanh yêu cầu giao tiếp phải phù hợp với một trong số ít các lớp được định nghĩa trước: ví dụ, bàn phím sẽ không phân bổ băng thông, trong khi một số máy quay video thì có.

Các đặc tả giao thức USB định nghĩa một tập hợp các tiêu chuẩn mà bất kỳ thiết bị nào thuộc một loại cụ thể đều có thể tuân theo. Nếu một thiết bị tuân theo tiêu chuẩn đó, thì một trình điều khiển đặc biệt (special driver) cho thiết bị đó là không cần thiết. Các loại khác nhau này được gọi là các lớp (classes) và bao gồm các thiết bị như thiết bị lưu trữ (storage devices), bàn phím, chuột, thiết bị điều khiển trò chơi (joysticks), thiết bị mạng và modem. Các loại thiết bị khác không nằm trong các lớp này đòi hỏi phải viết một trình điều khiển dành riêng cho nhà vendor (vendor-specific driver) cho thiết bị cụ thể đó. Các thiết bị video và thiết bị USB sang cổng nối tiếp (USB-to-serial) là một ví dụ điển hình, nơi không có tiêu chuẩn nào được định nghĩa và cần phải có một trình điều khiển cho từng thiết bị khác nhau từ các nhà sản xuất khác nhau.

Các tính năng này, cùng với khả năng cắm nóng (hotplug) vốn có của thiết kế, biến USB thành một cơ chế tiện dụng, chi phí thấp để kết nối (và ngắt kết nối) nhiều thiết bị với máy tính mà không cần phải tắt hệ thống, mở vỏ máy và bực dọc với các ốc vít hay dây điện.

Linux kernel hỗ trợ hai loại trình điều khiển USB chính: trình điều khiển trên hệ thống chủ (host system) và trình điều khiển trên thiết bị (device). Trình điều khiển USB cho hệ thống chủ điều khiển các thiết bị USB được cắm vào nó, từ góc nhìn của host (một host USB phổ biến là máy tính để bàn). Trình điều khiển USB trong một thiết bị sẽ điều khiển cách thiết bị đơn lẻ đó hiển thị trước máy tính chủ như một thiết bị USB. Vì thuật ngữ "trình điều khiển thiết bị USB" (USB device drivers) rất dễ gây nhầm lẫn, các nhà phát triển USB đã tạo ra thuật ngữ "trình điều khiển tiện ích USB" (USB gadget drivers) để mô tả các trình điều khiển điều khiển một thiết bị USB kết nối với máy tính (hãy nhớ rằng Linux cũng chạy trên các thiết bị nhúng nhỏ gọn đó). Chương này trình bày chi tiết cách thức hoạt động của hệ thống USB chạy trên máy tính để bàn. Các trình điều khiển USB gadget nằm ngoài phạm vi của cuốn sách này tại thời điểm hiện tại.

Như Hình 13-1 cho thấy, các trình điều khiển USB nằm giữa các hệ thống con khác nhau của nhân (khối - block, mạng - net, ký tự - char, v.v.) và các bộ điều khiển phần cứng USB. Lõi USB (USB core) cung cấp một giao diện để các trình điều khiển USB sử dụng nhằm truy cập và điều khiển phần cứng USB, mà không cần phải bận tâm về các loại bộ điều khiển phần cứng USB khác nhau hiện diện trên hệ thống.

## Cơ bản về Thiết bị USB (USB Device Basics)

Một thiết bị USB là một thứ rất phức tạp, như được mô tả trong tài liệu USB chính thức (có sẵn tại *http://www.usb.org*). May mắn thay, Linux kernel cung cấp một hệ thống con gọi là *USB core* để xử lý phần lớn sự phức tạp đó. Chương này mô tả sự tương tác giữa một trình điều khiển (driver) và USB core. Hình 13-2 minh họa cách các thiết bị USB bao gồm các cấu hình (configurations), giao diện (interfaces), và điểm cuối (endpoints), cũng như cách các trình điều khiển USB liên kết (bind) với các giao diện USB, chứ không phải toàn bộ thiết bị USB.

### Endpoints (Điểm cuối)

Hình thức giao tiếp USB cơ bản nhất thông qua một thành phần gọi là *endpoint* (điểm cuối). Một USB endpoint chỉ có thể truyền dữ liệu theo một hướng duy nhất, hoặc từ máy tính chủ (host)

```
Figure: Linux USB software architecture

                         User
                          ^
                          |
                          v

+-----------------------------------------------------------------+
|                             Kernel                              |
|                                                                 |
|  +---------+---------+---------+---------+---------+---------+  |
|  | VFS     | block   | Net     | Char    | TTY     |  ...    |  |
|  | layer   | layer   | layer   | layer   | layer   |        |  |
|  +---------+---------+---------+---------+---------+---------+  |
|                             ^                                   |
|                             |                                   |
|                       USB Device Drivers                        |
|                                                                 |
|                             USB Core                            |
|                                                                 |
|                       USB Host Controllers                      |
+-----------------------------------------------------------------+
                          ^
                          |
                          v
                       Hardware
```

Hình 13-1. Tổng quan về trình điều khiển USB (USB driver)

```
+---------------------------------------------------+
|                     Device                        |
|  (Device Descriptor)                              |
|                                                   |
|  +---------------------------------------------+  |
|  |                 Config                      |  |
|  |         (Configuration Descriptor)          |  |
|  |                                             |  |
|  |   +-----------------------------+           |  |
|  |   |         Interface 0         | <--------+--- USB Driver
|  |   |   (Interface Descriptor)    |           |
|  |   |                             |           |
|  |   |   +---------------------+   |           |
|  |   |   |   Endpoint          |   |           |
|  |   |   +---------------------+   |           |
|  |   |   |   Endpoint          |   |           |
|  |   |   +---------------------+   |           |
|  |   |   |   Endpoint          |   |           |
|  |   |   +---------------------+   |           |
|  |   +-----------------------------+           |
|  |                                             |
|  |   +-----------------------------+           |
|  |   |         Interface 1         | <--------+--- USB Driver 
|  |   |   (Interface Descriptor)    |           |
|  |   |                             |           |
|  |   |   +---------------------+   |           |
|  |   |   |   Endpoint          |   |           |
|  |   |   +---------------------+   |           |
|  |   |   |   Endpoint          |   |           |
|  |   |   +---------------------+   |           |
|  |   |   |   Endpoint          |   |           |
|  |   |   +---------------------+   |           |
|  |   +-----------------------------+           |
|  +---------------------------------------------+  |
+---------------------------------------------------+
```

Hình 13-2. Tổng quan về thiết bị USB

tới thiết bị (được gọi là *OUT* endpoint) hoặc từ thiết bị về máy tính chủ (được gọi là *IN* endpoint). Các endpoint có thể được coi là các đường ống truyền dữ liệu một chiều (unidirectional pipes).

Một USB endpoint có thể thuộc một trong bốn loại khác nhau mô tả cách thức dữ liệu được truyền đi:

#### CONTROL (Điều khiển)

Các control endpoint được sử dụng để cho phép truy cập vào các phần khác nhau của thiết bị USB. Chúng thường được dùng để cấu hình thiết bị, truy vấn thông tin về thiết bị, gửi lệnh đến thiết bị, hoặc lấy báo cáo trạng thái về thiết bị. Các endpoint này thường có kích thước nhỏ. Mọi thiết bị USB đều có

một control endpoint gọi là "endpoint 0" được sử dụng bởi USB core (nhân USB) để cấu hình thiết bị tại thời điểm kết nối (insertion time). Các giao dịch truyền dữ liệu này được giao thức USB đảm bảo luôn có đủ băng thông dự trữ để truyền thành công đến thiết bị.

#### *INTERRUPT* (Ngắt)

Các interrupt endpoint truyền các gói dữ liệu nhỏ với tốc độ cố định mỗi khi USB host yêu cầu dữ liệu từ thiết bị. Các endpoint này là phương thức truyền tải chính cho bàn phím và chuột USB. Chúng cũng thường được dùng để gửi dữ liệu tới các thiết bị USB nhằm điều khiển thiết bị, nhưng nhìn chung không được sử dụng để truyền lượng dữ liệu lớn. Các giao dịch truyền dữ liệu này được giao thức USB đảm bảo luôn có đủ băng thông dự trữ để truyền đi thành công.

#### *BULK* (Hàng loạt)

Các bulk endpoint truyền lượng lớn dữ liệu. Các endpoint này thường lớn hơn nhiều (có thể chứa nhiều ký tự hơn cùng lúc) so với các interrupt endpoint. Chúng phổ biến đối với các thiết bị cần truyền bất kỳ dữ liệu nào mà phải được gửi qua mà không bị mất dữ liệu. Các giao dịch truyền dữ liệu này không được giao thức USB đảm bảo sẽ luôn hoàn thành trong một khoảng thời gian cụ thể. Nếu không có đủ không gian trên bus để gửi toàn bộ gói BULK, nó sẽ được chia nhỏ thành nhiều lần truyền (transfers) đến hoặc đi từ thiết bị. Các endpoint này rất phổ biến trên các thiết bị máy in, thiết bị lưu trữ và thiết bị mạng.

#### *ISOCHRONOUS (Đồng thời/Đẳng thời)*

Các endpoint (điểm cuối) isochronous cũng truyền các khối lượng dữ liệu lớn, nhưng dữ liệu không phải lúc nào cũng được đảm bảo sẽ truyền qua thành công. Các endpoint này được sử dụng trong các thiết bị có khả năng xử lý việc mất dữ liệu và phụ thuộc nhiều hơn vào việc duy trì một luồng dữ liệu liên tục. Các tập dữ liệu thời gian thực (real-time), chẳng hạn như các thiết bị âm thanh và video, hầu như luôn sử dụng các endpoint này.

Endpoint điều khiển (control) và bulk được sử dụng cho việc truyền dữ liệu không đồng bộ (asynchronous), bất cứ khi nào driver quyết định sử dụng chúng. Endpoint ngắt (interrupt) và isochronous mang tính chu kỳ (periodic). Điều này có nghĩa là các endpoint này được thiết lập để truyền dữ liệu liên tục tại các thời điểm cố định, khiến cho băng thông của chúng bị chiếm dụng (reserve) bởi USB core.

Các USB endpoint được mô tả trong kernel bằng cấu trúc `struct usb_host_endpoint`. Cấu trúc này chứa thông tin thực tế về endpoint trong một cấu trúc khác có tên là `struct usb_endpoint_descriptor`. Cấu trúc sau chứa toàn bộ dữ liệu đặc thù của USB theo đúng định dạng mà bản thân thiết bị đã chỉ định. Các trường của cấu trúc này mà các driver quan tâm bao gồm:

#### bEndpointAddress

Đây là địa chỉ USB của endpoint cụ thể này. Giá trị 8-bit này cũng bao gồm hướng (direction) của endpoint. Các mặt nạ bit (bitmask) `USB_DIR_OUT` và `USB_DIR_IN` có thể được áp dụng với trường này để xác định xem dữ liệu cho endpoint này được hướng đến thiết bị hay đến host.

#### bmAttributes

Đây là loại endpoint. Mặt nạ bit `USB_ENDPOINT_XFERTYPE_MASK` nên được áp dụng cho giá trị này để xác định xem endpoint thuộc loại

`USB_ENDPOINT_XFER_ISOC`, `USB_ENDPOINT_XFER_BULK`, hay loại `USB_ENDPOINT_XFER_INT`. Các macro này lần lượt định nghĩa một endpoint isochronous, bulk và interrupt.

#### wMaxPacketSize

Đây là kích thước tối đa tính bằng byte mà endpoint này có thể xử lý tại một thời điểm. Lưu ý rằng driver hoàn toàn có thể gửi lượng dữ liệu đến một endpoint lớn hơn giá trị này, nhưng dữ liệu sẽ được chia nhỏ thành các khối `wMaxPacketSize` khi thực sự được truyền đến thiết bị. Đối với các thiết bị tốc độ cao (high-speed devices), trường này có thể được sử dụng để hỗ trợ chế độ băng thông cao (high-bandwidth mode) cho endpoint bằng cách sử dụng một vài bit bổ sung ở phần trên của giá trị. Hãy xem đặc tả USB (USB specification) để biết thêm chi tiết về cách thực hiện việc này.

#### bInterval

Nếu endpoint này thuộc loại interrupt (ngắt), giá trị này chính là cài đặt khoảng thời gian (interval) cho endpoint — tức là khoảng thời gian giữa các yêu cầu ngắt cho endpoint đó. Giá trị này được biểu diễn bằng mili-giây (milliseconds).

Các trường của cấu trúc này không tuân theo sơ đồ đặt tên "truyền thống" của Linux kernel. Lý do là vì các trường này tương ứng trực tiếp với tên các trường trong đặc tả USB. Các lập trình viên USB kernel cảm thấy việc sử dụng các tên được chỉ định này quan trọng hơn — nhằm giảm bớt sự nhầm lẫn khi đọc tài liệu đặc tả — so với việc sử dụng các tên biến quen thuộc với các lập trình viên Linux.

### Giao diện (Interfaces)

Các USB endpoint được gom lại thành các *giao diện* (*interfaces*). Các USB interface chỉ xử lý một loại kết nối logic USB duy nhất, chẳng hạn như chuột, bàn phím hoặc luồng âm thanh (audio stream). Một số thiết bị USB có nhiều giao diện, ví dụ như loa USB có thể bao gồm hai giao diện: một bàn phím USB cho các nút bấm và một luồng âm thanh USB. Vì một giao diện USB đại diện cho chức năng cơ bản, nên mỗi driver USB sẽ điều khiển một giao diện; do đó, đối với ví dụ về chiếc loa, Linux cần hai driver khác nhau cho một thiết bị phần cứng.

Các giao diện USB có thể có các thiết lập thay thế (alternate settings), đây là các lựa chọn khác nhau cho các tham số của giao diện. Trạng thái ban đầu của một giao diện nằm ở thiết lập đầu tiên, được đánh số 0. Các thiết lập thay thế có thể được sử dụng để điều khiển các endpoint riêng lẻ theo các cách khác nhau, chẳng hạn như để dự trữ các mức băng thông USB khác nhau cho thiết bị. Mỗi thiết bị có chứa một isochronous endpoint đều sử dụng các thiết lập thay thế cho cùng một giao diện.

Các giao diện USB được mô tả trong kernel thông qua cấu trúc `struct usb_interface`. Cấu trúc này là thứ mà USB core truyền cho các USB driver và cũng là thứ mà USB driver chịu trách nhiệm điều khiển. Các trường quan trọng trong cấu trúc này gồm có:

#### struct usb\_host\_interface \*altsetting

Một mảng các cấu trúc giao diện chứa tất cả các thiết lập thay thế có thể được chọn cho giao diện này. Mỗi `struct usb_host_interface` bao gồm một tập hợp các cấu hình endpoint được định nghĩa bởi cấu trúc `struct usb_host_endpoint` đã được mô tả ở trên. Lưu ý rằng các cấu trúc giao diện này không tuân theo một thứ tự cụ thể nào.

unsigned num\_altsetting

Số lượng các thiết lập thay thế được trỏ tới bởi con trỏ `altsetting`.

struct usb\_host\_interface \*cur\_altsetting

Một con trỏ trỏ vào mảng `altsetting`, biểu thị thiết lập đang hoạt động hiện tại cho giao diện này.

int minor

Nếu USB driver liên kết (bound) với giao diện này sử dụng USB major number, biến này sẽ chứa minor number được cấp phát bởi USB core cho giao diện. Giá trị này chỉ hợp lệ sau khi gọi thành công hàm `usb_register_dev` (được mô tả sau trong chương này).

Có các trường khác trong cấu trúc `struct usb_interface`, nhưng các USB driver không cần phải bận tâm đến chúng.

### Cấu hình (Configurations)

Bản thân các giao diện USB lại được gom lại thành các *cấu hình* (*configurations*). Một thiết bị USB có thể có nhiều cấu hình và có thể chuyển đổi giữa chúng nhằm thay đổi trạng thái của thiết bị. Ví dụ, một số thiết bị cho phép tải xuống firmware chứa nhiều cấu hình để thực hiện việc này. Chỉ có một cấu hình duy nhất được kích hoạt tại một thời điểm. Linux không hỗ trợ tốt các thiết bị USB có nhiều cấu hình, nhưng may mắn thay, chúng rất hiếm gặp.

Linux mô tả các cấu hình USB bằng cấu trúc `struct usb_host_config` và toàn bộ thiết bị USB bằng cấu trúc `struct usb_device`. Nhìn chung, các device driver USB không bao giờ cần phải đọc hoặc ghi bất kỳ giá trị nào trong các cấu trúc này, do đó chúng không được định nghĩa chi tiết ở đây. Bạn đọc tò mò có thể tìm thấy mô tả về chúng trong tệp *include/linux/usb.h* nằm trong cây mã nguồn kernel.

Một device driver USB thông thường phải chuyển đổi dữ liệu từ một `struct usb_interface` cho trước thành một cấu trúc `struct usb_device` mà USB core cần để thực hiện hàng loạt các lời gọi hàm (function call). Để làm điều này, hàm `interface_to_usbdev` được cung cấp. Hy vọng rằng trong tương lai, tất cả các lời gọi USB hiện đang cần `struct usb_device` sẽ được chuyển đổi để nhận tham số là `struct usb_interface` và sẽ không đòi hỏi các driver phải tự thực hiện việc chuyển đổi này.

Tóm lại, các thiết bị USB khá phức tạp và được tạo thành từ nhiều unit logic khác nhau. Mối quan hệ giữa các unit này có thể được mô tả một cách đơn giản như sau:

- Các thiết bị thường có một hoặc nhiều cấu hình.
- Các cấu hình thường có một hoặc nhiều giao diện.
- Các giao diện thường có một hoặc nhiều thiết lập.
- Các giao diện có từ không endpoint trở lên.

## USB và Sysfs

Do độ phức tạp của một thiết bị vật lý USB đơn lẻ, cách biểu diễn của thiết bị đó trong sysfs cũng khá phức tạp. Cả thiết bị USB vật lý (được đại diện bởi `struct usb_device`) và từng giao diện USB riêng lẻ (được đại diện bởi `struct usb_interface`) đều được hiển thị trong sysfs như là các thiết bị độc lập. (Điều này là do cả hai cấu trúc đó đều chứa một `struct device` bên trong). Ví dụ, đối với một con chuột USB đơn giản chỉ chứa một giao diện USB duy nhất, cây thư mục sysfs cho thiết bị đó sẽ như sau:

```
/sys/devices/pci0000:00/0000:00:09.0/usb2/2-1
|-- 2-1:1.0
| |-- bAlternateSetting
| |-- bInterfaceClass
| |-- bInterfaceNumber
| |-- bInterfaceProtocol
| |-- bInterfaceSubClass
| |-- bNumEndpoints
| |-- detach_state
| |-- iInterface
| `-- power
| `-- state
|-- bConfigurationValue
|-- bDeviceClass
|-- bDeviceProtocol
|-- bDeviceSubClass
|-- bMaxPower
|-- bNumConfigurations
|-- bNumInterfaces
|-- bcdDevice
|-- bmAttributes
|-- detach_state
|-- devnum
|-- idProduct
|-- idVendor
|-- maxchild
|-- power
| `-- state
|-- speed
`-- version
```

Cấu trúc `struct usb_device` được thể hiện trong cây thư mục tại:

/sys/devices/pci0000:00/0000:00:09.0/usb2/2-1

trong khi giao diện USB (USB interface) cho con chuột—giao diện mà trình điều khiển (driver) chuột USB gắn kết (bind) vào—nằm tại thư mục:

/sys/devices/pci0000:00/0000:00:09.0/usb2/2-1/2-1:1.0

Để giúp hiểu rõ ý nghĩa của đường dẫn thiết bị dài này, chúng ta sẽ mô tả cách nhân hệ điều hành (kernel) đặt tên cho các thiết bị USB.

Thiết bị USB đầu tiên là một root hub (hub gốc). Đây chính là bộ điều khiển USB (USB controller), thường nằm bên trong một thiết bị PCI. Bộ điều khiển được gọi như vậy vì nó điều khiển toàn bộ bus USB được kết nối tới nó. Bộ điều khiển này đóng vai trò là cầu nối giữa bus PCI và bus USB, đồng thời cũng là thiết bị USB đầu tiên trên bus đó.

Tất cả các root hub đều được USB core (lõi USB) gán cho một số định danh duy nhất. Trong ví dụ của chúng ta, root hub được gọi là `usb2`, vì nó là root hub thứ hai được đăng ký với USB core. Không có giới hạn nào về số lượng root hub có thể tồn tại trong một hệ thống tại bất kỳ thời điểm nào.

Mọi thiết bị nằm trên bus USB đều lấy số của root hub làm con số đầu tiên trong tên của nó. Tiếp theo là ký tự `-` và sau đó là số cổng (port) mà thiết bị được cắm vào. Vì thiết bị trong ví dụ của chúng ta được cắm vào cổng đầu tiên, số `1` được thêm vào tên. Do đó, tên thiết bị cho thiết bị chuột USB chính là `2-1`. Do thiết bị USB này chứa một giao diện (interface), điều này khiến một thiết bị khác trong cây thư mục được thêm vào đường dẫn sysfs. Quy tắc đặt tên cho các giao diện USB chính là tên thiết bị tính đến thời điểm này: trong ví dụ của chúng ta là `2-1`, theo sau là dấu hai chấm (`:`) và số cấu hình USB (USB configuration number), sau đó là dấu chấm (`.`) và số giao diện (interface number). Vì vậy, đối với ví dụ này, tên thiết bị là `2-1:1.0` vì đây là cấu hình đầu tiên và có số giao diện là không.

Tóm lại, quy tắc đặt tên thiết bị USB trên sysfs là:

*root\_hub*-*hub\_port*:*config*.*interface*

Khi các thiết bị nằm sâu hơn trong cây USB, và khi có ngày càng nhiều hub USB được sử dụng, số cổng hub sẽ được nối thêm vào chuỗi phía sau số cổng hub trước đó trong chuỗi liên kết. Đối với một cây có độ sâu hai cấp, tên thiết bị sẽ có dạng:

*root\_hub*-*hub\_port*-*hub\_port*:*config*.*interface*

Như có thể thấy trong danh sách thư mục trước đó của thiết bị USB và giao diện, tất cả thông tin đặc thù của USB đều có sẵn trực tiếp thông qua sysfs (ví dụ: thông tin `idVendor`, `idProduct`, và `bMaxPower`). Một trong số các tệp này, *bConfigurationValue*, có thể được ghi dữ liệu vào để thay đổi cấu hình USB đang hoạt động. Điều này rất hữu ích đối với các thiết bị có nhiều cấu hình, khi mà nhân hệ điều hành không thể xác định cấu hình nào cần chọn để vận hành thiết bị đúng cách. Một số modem USB cần phải được ghi giá trị cấu hình phù hợp vào tệp này thì driver USB chính xác mới có thể gắn kết (bind) vào thiết bị.

Sysfs không phơi bày (expose) tất cả các thành phần khác nhau của một thiết bị USB, vì nó dừng lại ở mức giao diện (interface level). Bất kỳ cấu hình thay thế (alternate configuration) nào mà thiết bị có thể chứa đều không được hiển thị, cũng như các chi tiết về các điểm cuối (endpoint) liên kết với các giao diện đó. Thông tin này có thể được tìm thấy trong hệ thống tệp *usbfs*, được gắn (mount) tại thư mục `/proc/bus/usb/` trên hệ thống. Tệp `/proc/bus/usb/devices` có hiển thị tất cả thông tin giống như được phơi bày trong sysfs, cùng với thông tin về cấu hình thay thế và điểm cuối (endpoint) cho tất cả các thiết bị USB hiện có trong hệ thống. *usbfs* cũng cho phép các chương trình ở không gian người dùng (user-space programs) giao tiếp trực tiếp với các thiết bị USB, điều này đã cho phép rất nhiều driver của kernel được chuyển ra không gian người dùng (user space), nơi việc bảo trì và gỡ lỗi (debug) trở nên dễ dàng hơn. Driver máy quét USB (USB scanner driver) là một ví dụ điển hình cho việc này, vì nó không còn tồn tại trong nhân hệ điều hành nữa do chức năng của nó giờ đây nằm trong các chương trình thư viện SANE ở không gian người dùng.

## USB Urb

Mã nguồn USB trong Linux kernel giao tiếp với tất cả các thiết bị USB bằng sử dụng một cơ chế gọi là *urb* (USB request block - khối yêu cầu USB). Khối yêu cầu này được mô tả bằng cấu trúc `struct urb` và có thể tìm thấy trong tệp `include/linux/usb.h`.

Một urb được sử dụng để gửi hoặc nhận dữ liệu đến hoặc từ một endpoint USB cụ thể trên một thiết bị USB cụ thể theo phương thức bất đồng bộ (asynchronous). Nó được sử dụng gần giống như cách cấu trúc `kiocb` được dùng trong mã nguồn I/O bất đồng bộ của hệ thống tệp, hoặc cách `struct skbuff` được dùng trong mã nguồn mạng (networking code). Một driver thiết bị USB có thể cấp phát nhiều urb cho một endpoint duy nhất hoặc có thể táiusing một urb duy nhất cho nhiều endpoint khác nhau, tùy thuộc vào nhu cầu của driver. Mọi endpoint trong một thiết bị có thể quản lý một hàng đợi (queue) các urb, nhờ đó nhiều urb có thể được gửi đến cùng một endpoint trước khi hàng đợi đó trống. Vòng đời điển hình của một urb diễn ra như sau:

- Được tạo bởi một USB device driver.
- Được gán cho một endpoint cụ thể của một thiết bị USB cụ thể.
- Được gửi (submit) đến USB core bởi USB device driver.
- Được USB core gửi tiếp đến driver bộ điều khiển host USB (USB host controller driver) cụ thể cho thiết bị được chỉ định.

- Được xử lý bởi trình điều khiển bộ điều khiển máy chủ USB (USB host controller driver) để thực hiện một lượt truyền USB (USB transfer) tới thiết bị.
- Khi urb hoàn tất, trình điều khiển bộ điều khiển máy chủ USB sẽ thông báo cho trình điều khiển thiết bị USB (USB device driver).

Urbs cũng có thể bị hủy bất cứ lúc nào bởi trình điều khiển đã gửi urb đó, hoặc bởi nhân USB (USB core) nếu thiết bị bị gỡ bỏ khỏi hệ thống. Urbs được tạo động (dynamically created) và chứa một bộ đếm tham chiếu nội bộ (internal reference count) cho phép chúng tự động được giải phóng (freed) khi người dùng cuối cùng của urb giải phóng nó.

Quy trình được mô tả trong chương này để xử lý urbs rất hữu ích, bởi vì nó cho phép truyền dữ liệu dòng (streaming) và các giao tiếp phức tạp, chồng chéo khác giúp các trình điều khiển đạt được tốc độ truyền dữ liệu cao nhất có thể. Nhưng các quy trình ít cồng kềnh hơn cũng có sẵn nếu bạn chỉ muốn gửi các thông điệp bulk hoặc control riêng lẻ và không quan tâm đến tốc độ thông lượng dữ liệu (data throughput rates). (Xem phần "Truyền USB Không Cần Urbs" - "USB Transfers Without Urbs.")

### struct urb

Các trường của cấu trúc `struct urb` quan trọng đối với một trình điều khiển thiết bị USB (USB device driver) là:

struct usb\_device \*dev

Con trỏ trỏ đến `struct usb\_device` mà urb này được gửi đến. Biến này phải được khởi tạo bởi trình điều khiển USB trước khi urb có thể được gửi đến nhân USB (USB core).

unsigned int pipe

Thông tin điểm cuối (endpoint) cho `struct usb\_device` cụ thể mà urb này sẽ được gửi đến. Biến này phải được khởi tạo bởi trình điều khiển USB trước khi urb có thể được gửi đến nhân USB (USB core).

Để thiết lập các trường của cấu trúc này, trình điều khiển sử dụng các hàm sau đây cho phù hợp, tùy thuộc vào hướng truyền dữ liệu. Lưu ý rằng mỗi điểm cuối (endpoint) chỉ có thể thuộc về một loại duy nhất.

unsigned int usb\_sndctrlpipe(struct usb\_device \*dev, unsigned int endpoint)

Chỉ định một điểm cuối điều khiển OUT (control OUT endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_rcvctrlpipe(struct usb\_device \*dev, unsigned int endpoint)

Chỉ định một điểm cuối điều khiển IN (control IN endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_sndbulkpipe(struct usb\_device \*dev, unsigned int endpoint)

Chỉ định một điểm cuối hàng loạt OUT (bulk OUT endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_rcvbulkpipe(struct usb\_device \*dev, unsigned int endpoint)

Chỉ định một điểm cuối hàng loạt IN (bulk IN endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_sndintpipe(struct usb\_device \*dev, unsigned int endpoint) Chỉ định một điểm cuối ngắt OUT (interrupt OUT endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_rcvintpipe(struct usb\_device \*dev, unsigned int endpoint) Chỉ định một điểm cuối ngắt IN (interrupt IN endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_sndisocpipe(struct usb\_device \*dev, unsigned int endpoint)

Chỉ định một điểm cuối đẳng thời OUT (isochronous OUT endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

unsigned int usb\_rcvisocpipe(struct usb\_device \*dev, unsigned int endpoint)

Chỉ định một điểm cuối đẳng thời IN (isochronous IN endpoint) cho thiết bị USB được chỉ định với số điểm cuối được chỉ định.

#### unsigned int transfer\_flags

Biến này có thể được thiết lập thành một số giá trị bit khác nhau, tùy thuộc vào những gì trình điều khiển USB muốn xảy ra đối với urb. Các giá trị có sẵn là:

#### URB\_SHORT\_NOT\_OK

Khi được thiết lập, nó chỉ định rằng bất kỳ lượt đọc ngắn (short read) nào trên một điểm cuối IN có thể xảy ra phải được nhân USB (USB core) coi là một lỗi. Giá trị này chỉ hữu ích cho các urb được đọc từ thiết bị USB, không dùng cho các urb ghi.

#### URB\_ISO\_ASAP

Nếu urb là dạng đẳng thời (isochronous), bit này có thể được thiết lập nếu trình điều khiển muốn urb được lên lịch ngay khi việc sử dụng băng thông cho phép, và thiết lập biến `start_frame` trong urb tại thời điểm đó. Nếu bit này không được thiết lập cho một urb đẳng thời, trình điều khiển phải chỉ định giá trị `start_frame` và phải có khả năng phục hồi đúng cách nếu quá trình truyền không thể bắt đầu vào thời điểm đó. Xem phần tiếp theo về urb đẳng thời để biết thêm thông tin.

#### URB\_NO\_TRANSFER\_DMA\_MAP

Nên được thiết lập khi urb chứa một bộ đệm DMA (DMA buffer) cần truyền. Nhân USB (USB core) sử dụng bộ đệm trỏ tới bởi biến `transfer_dma` chứ không phải bộ đệm trỏ tới bởi biến `transfer_buffer`.

#### URB\_NO\_SETUP\_DMA\_MAP

Giống như bit `URB_NO_TRANSFER_DMA_MAP`, bit này được sử dụng cho các urb điều khiển (control urbs) đã thiết lập sẵn bộ đệm DMA. Nếu được thiết lập, nhân USB (USB core) sẽ sử dụng bộ đệm trỏ tới bởi biến `setup_dma` thay vì biến `setup_packet`.

#### URB\_ASYNC\_UNLINK

Nếu được thiết lập, lệnh gọi hàm *usb\_unlink\_urb* cho urb này sẽ trả về gần như ngay lập tức, và urb bị ngắt liên kết (unlinked) ở chế độ nền (background). Ngược lại, hàm sẽ đợi cho đến khi urb hoàn toàn bị ngắt liên kết và kết thúc rồi mới trả về. Hãy sử dụng bit này một cách cẩn thận, vì nó có thể làm cho các vấn đề đồng bộ hóa (synchronization issues) rất khó gỡ lỗi (debug).

#### URB\_NO\_FSBR

Chỉ được sử dụng bởi trình điều khiển bộ điều khiển máy chủ UHCI USB (UHCI USB Host controller driver) và ra lệnh cho nó không cố gắng thực hiện logic thu hồi Front Side Bus (Front Side Bus Reclamation). Bit này nhìn chung không nên được thiết lập, bởi vì các máy tính có bộ điều khiển máy chủ UHCI tạo ra rất nhiều chi phí chung cho CPU (CPU overhead), và bus PCI bị bão hòa khi chờ một urb thiết lập bit này.

#### URB\_ZERO\_PACKET

Nếu được thiết lập (set), một bulk out URB (`urb`) sẽ kết thúc bằng cách gửi một gói tin ngắn (short packet) không chứa dữ liệu khi dữ liệu được căn chỉnh (aligned) với ranh giới gói tin của endpoint (endpoint packet boundary). Điều này là bắt buộc đối với một số thiết bị USB bị lỗi (chẳng hạn như một số thiết bị USB sang IR) để có thể hoạt động bình thường.

#### URB\_NO\_INTERRUPT

Nếu được thiết lập, phần cứng có thể không tạo ra ngắt (interrupt) khi URB hoàn tất. Bit này nên được sử dụng một cách cẩn trọng và chỉ khi xếp hàng đợi (queuing) nhiều URB tới cùng một endpoint. Các hàm của USB core sử dụng tính năng này để thực hiện việc truyền bộ đệm DMA (DMA buffer transfers).

#### void \*transfer\_buffer

Con trỏ trỏ đến bộ đệm (buffer) được sử dụng khi gửi dữ liệu đến thiết bị (đối với OUT URB) hoặc khi nhận dữ liệu từ thiết bị (đối với IN URB). Để host controller có thể truy cập bộ đệm này một cách chính xác, nó phải được khởi tạo bằng một lời gọi hàm `kmalloc`, không được cấp phát trên stack hoặc tĩnh (statically). Đối với các control endpoint, bộ đệm này dành cho giai đoạn truyền dữ liệu (data stage) của quá trình truyền.

#### dma\_addr\_t transfer\_dma

Bộ đệm được sử dụng để truyền dữ liệu tới thiết bị USB sử dụng DMA.

#### int transfer\_buffer\_length

Độ dài của bộ đệm được trỏ bởi biến `transfer_buffer` hoặc `transfer_dma` (vì chỉ một trong hai có thể được sử dụng cho một URB). Nếu giá trị này bằng 0, không có bộ đệm truyền nào được sử dụng bởi USB core.

Đối với một OUT endpoint, nếu kích thước tối đa của endpoint nhỏ hơn giá trị được chỉ định trong biến này, quá trình truyền đến thiết bị USB sẽ được chia thành các phần nhỏ hơn để truyền dữ liệu một cách chính xác. Quá trình truyền lớn này diễn ra trong các khung USB liên tiếp (consecutive USB frames). Việc gửi một khối dữ liệu lớn trong một URB và để USB host controller tự chia nhỏ thành các phần nhỏ sẽ nhanh hơn rất nhiều so với việc gửi các bộ đệm nhỏ hơn theo thứ tự liên tiếp.

#### unsigned char \*setup\_packet

Con trỏ trỏ đến gói tin thiết lập (setup packet) cho một control URB. Nó được truyền trước dữ liệu trong bộ đệm truyền (`transfer buffer`). Biến này chỉ hợp lệ đối với các control URB.

#### dma\_addr\_t setup\_dma

Bộ đệm DMA cho gói tin thiết lập của một control URB. Nó được truyền trước dữ liệu trong bộ đệm truyền thông thường. Biến này chỉ hợp lệ đối với các control URB.

#### usb\_complete\_t complete

Con trỏ trỏ đến hàm xử lý hoàn tất (completion handler function) được gọi bởi USB core khi URB được truyền xong hoàn toàn hoặc khi xảy ra lỗi với URB. Bên trong hàm này, USB driver có thể kiểm tra URB, giải phóng nó hoặc gửi lại nó cho một lần truyền khác. (Xem phần "Completing Urbs: The Completion Callback Handler" để biết thêm chi tiết về hàm xử lý hoàn tất).

Kiểu dữ liệu `usb_complete_t` được định nghĩa là:

```c
typedef void (*usb_complete_t)(struct urb *, struct pt_regs *);
```

#### void \*context

Con trỏ trỏ đến một vùng dữ liệu (data blob) có thể được thiết lập bởi USB driver. Nó có thể được sử dụng trong hàm xử lý hoàn tất khi URB được trả về cho driver. Xem phần tiếp theo để biết thêm chi tiết về biến này.

#### int actual\_length

Khi URB hoàn tất, biến này được đặt thành độ dài thực tế của dữ liệu hoặc được gửi bởi URB (đối với OUT URB) hoặc được nhận bởi URB (đối với IN URB). Đối với IN URB, biến này phải được sử dụng thay cho biến `transfer_buffer_length`, bởi vì dữ liệu nhận được có thể nhỏ hơn toàn bộ kích thước bộ đệm.

#### int status

Khi URB hoàn tất hoặc đang được xử lý bởi USB core, biến này được thiết lập thành trạng thái hiện tại của URB. Thời điểm duy nhất mà một USB driver có thể truy cập an toàn vào biến này là bên trong hàm xử lý hoàn tất URB (được mô tả trong phần "Completing Urbs: The Completion Callback Handler"). Hạn chế này nhằm ngăn chặn các tình trạng tranh chấp dữ liệu (race conditions) xảy ra trong khi URB đang được xử lý bởi USB core. Đối với các isochronous URB, giá trị thành công (0) trong biến này chỉ đơn giản biểu thị việc URB đã được hủy liên kết (unlinked) hay chưa. Để lấy trạng thái chi tiết về các isochronous URB, các biến `iso_frame_desc` cần phải được kiểm tra.

Các giá trị hợp lệ cho biến này bao gồm:

0

Quá trình truyền URB đã thành công.

### -ENOENT

URB đã bị dừng bởi một lời gọi tới *usb\_kill\_urb*.

### -ECONNRESET

URB đã bị ngắt liên kết (unlinked) bởi một lời gọi tới *usb\_unlink\_urb*, và biến `transfer_flags` của URB được thiết lập thành `URB_ASYNC_UNLINK`.

### -EINPROGRESS

URB vẫn đang được xử lý bởi các bộ điều khiển host USB (USB host controllers). Nếu trình điều khiển (driver) của bạn gặp phải giá trị này, đó là một lỗi trong trình điều khiển của bạn.

### -EPROTO

Một trong các lỗi sau đã xảy ra với URB này:

- Lỗi nhồi bit (bitstuff error) xảy ra trong quá trình truyền.
- Phần cứng không nhận được gói tin phản hồi (response packet) kịp thời.

#### -EILSEQ

Có sự không khớp CRC (CRC mismatch) trong quá trình truyền URB.

#### -EPIPE

Endpoint hiện đang bị tạm dừng (stalled). Nếu endpoint liên quan không phải là một control endpoint, lỗi này có thể được xóa thông qua một lời gọi tới hàm *usb\_clear\_halt*.

#### -ECOMM

Dữ liệu được nhận trong quá trình truyền nhanh hơn tốc độ có thể ghi vào bộ nhớ hệ thống (system memory). Giá trị lỗi này chỉ xảy ra đối với một IN urb.

#### -ENOSR

Không thể truy xuất dữ liệu từ bộ nhớ hệ thống (system memory) trong quá trình truyền đủ nhanh để theo kịp tốc độ dữ liệu USB được yêu cầu. Giá trị lỗi này chỉ xảy ra đối với một OUT urb.

#### -EOVERFLOW

Lỗi "babble" đã xảy ra đối với URB. Lỗi "babble" xảy ra khi endpoint nhận được nhiều dữ liệu hơn kích thước gói tin tối đa được chỉ định của endpoint đó.

#### -EREMOTEIO

Chỉ xảy ra nếu cờ `URB_SHORT_NOT_OK` được thiết lập trong biến `transfer_flags` của URB, có nghĩa là lượng dữ liệu đầy đủ được yêu cầu bởi URB đã không được nhận đủ.

#### -ENODEV

Thiết bị USB hiện đã biến mất khỏi hệ thống.

#### -EXDEV

Chỉ xảy ra đối với URB đồng bộ (isochronous urb) và có nghĩa là quá trình truyền chỉ hoàn thành một phần. Để xác định những gì đã được truyền, trình điều khiển phải xem xét trạng thái của từng frame riêng lẻ.

#### -EINVAL

Một sự cố rất tồi tệ đã xảy ra với URB. Tài liệu nhân Linux (kernel documentation) mô tả ý nghĩa của giá trị này:

ISO madness, if this happens: Log off and go home (Sự điên rồ của ISO, nếu điều này xảy ra: Đăng xuất và đi về nhà)

Nó cũng có thể xảy ra nếu một tham số được thiết lập không chính xác trong cấu trúc URB hoặc nếu một tham số hàm không chính xác trong lời gọi *usb\_submit\_urb* đã gửi URB tới lõi USB (USB core).

### -ESHUTDOWN

Đã xảy ra một lỗi nghiêm trọng với trình điều khiển bộ điều khiển host USB (USB host controller driver); nó hiện đã bị vô hiệu hóa, hoặc thiết bị đã bị ngắt kết nối khỏi hệ thống, và URB được gửi sau khi thiết bị đã bị gỡ bỏ. Nó cũng có thể xảy ra nếu cấu hình của thiết bị bị thay đổi trong khi URB đang được gửi tới thiết bị.

Nhìn chung, các giá trị lỗi `-EPROTO`, `-EILSEQ`, và `-EOVERFLOW` biểu thị các vấn đề về phần cứng với thiết bị, phầnfirmware của thiết bị, hoặc cáp kết nối thiết bị với máy tính.

int start\_frame

Thiết lập hoặc trả về số frame ban đầu sẽ được sử dụng cho các lần truyền đồng bộ (isochronous transfers).

int interval

Khoảng thời gian (interval) mà URB được thăm dò (polled). Điều này chỉ hợp lệ đối với URB ngắt (interrupt) hoặc URB đồng bộ (isochronous). Đơn vị của giá trị này khác nhau tùy thuộc vào tốc độ của thiết bị. Đối với các thiết bị tốc độ thấp (low-speed) và tốc độ đầy đủ (full-speed), đơn vị là các frame, tương đương với mili-giây. Đối với các thiết bị khác, đơn vị nằm trong các microframe, tương đương với 1/8 mili-giây. Giá trị này phải được thiết lập bởi trình điều khiển USB cho các URB đồng bộ hoặc ngắt trước khi URB được gửi đến lõi USB (USB core).

int number\_of\_packets

Chỉ hợp lệ đối với các URB đồng bộ và chỉ định số lượng bộ đệm truyền đồng bộ (isochronous transfer buffers) được xử lý bởi URB này. Giá trị này phải được thiết lập bởi trình điều khiển USB cho các URB đồng bộ trước khi URB được gửi đến lõi USB (USB core).

int error\_count

Được thiết lập bởi lõi USB (USB core) chỉ đối với các URB đồng bộ sau khi chúng hoàn thành. Nó chỉ định số lượng các lần truyền đồng bộ báo cáo bất kỳ loại lỗi nào.

struct usb\_iso\_packet\_descriptor iso\_frame\_desc[0]

Chỉ hợp lệ đối với các URB đồng bộ. Biến này là một mảng các cấu trúc `struct usb_iso_packet_descriptor` tạo nên URB này. Cấu trúc này cho phép một URB duy nhất định nghĩa một số lần truyền đồng bộ cùng một lúc. Nó cũng được sử dụng để thu thập trạng thái truyền của từng lần truyền riêng lẻ.

Cấu trúc `struct usb_iso_packet_descriptor` bao gồm các trường sau:

unsigned int offset

Độ lệch (offset) vào bộ đệm truyền (bắt đầu từ 0 cho byte đầu tiên) nơi dữ liệu của gói tin này nằm.

unsigned int length

Độ dài của bộ đệm truyền cho gói tin này.

unsigned int actual\_length

Độ dài của dữ liệu được nhận vào bộ đệm truyền cho gói tin đồng bộ này.

unsigned int status

Trạng thái của lần truyền đồng bộ riêng lẻ của gói tin này. Nó có thể nhận các giá trị trả về giống như biến `status` của cấu trúc `struct urb` chính.

### Tạo và Hủy Urbs (Creating and Destroying Urbs)

Cấu trúc `struct urb` tuyệt đối không được tạo một cách tĩnh (statically) trong một driver hoặc bên trong một cấu trúc dữ liệu khác, bởi vì điều đó sẽ làm phá vỡ cơ chế đếm tham chiếu (reference counting scheme) do USB core sử dụng cho các urb. Nó bắt buộc phải được tạo thông qua lời gọi hàm *usb\_alloc\_urb*. Hàm này có nguyên mẫu (prototype):

```c
struct urb *usb_alloc_urb(int iso_packets, int mem_flags);
```

Tham số đầu tiên, `iso_packets`, là số lượng gói tin đẳng thời (isochronous packets) mà urb này nên chứa. Nếu bạn không muốn tạo một urb đẳng thời, biến này nên được đặt giá trị là 0. Tham số thứ hai, `mem_flags`, là loại cờ tương tự được truyền vào lời gọi hàm *kmalloc* để cấp phát bộ nhớ từ kernel (xem phần "Tham số Cờ" trong Chương 8 để biết chi tiết về các cờ này). Nếu hàm cấp phát thành công đủ không gian cho urb, một con trỏ trỏ tới urb sẽ được trả về cho bên gọi. Nếu giá trị trả về là `NULL`, đã có lỗi xảy ra bên trong USB core và driver cần phải tiến hành dọn dẹp (clean up) một cách thích hợp.

Sau khi một urb được tạo, nó phải được khởi tạo đúng cách trước khi có thể được sử dụng bởi USB core. Hãy xem các phần tiếp theo để biết cách khởi tạo các loại urb khác nhau.

Để thông báo cho USB core rằng driver đã hoàn tất việc sử dụng urb, driver phải gọi hàm *usb\_free\_urb*. Hàm này chỉ có một đối số duy nhất:

```c
void usb_free_urb(struct urb *urb);
```

Đối số này là một con trỏ trỏ tới `struct urb` mà bạn muốn giải phóng. Sau khi hàm này được gọi, cấu trúc urb sẽ biến mất và driver không thể truy cập nó thêm lần nào nữa.

### Interrupt urbs

Hàm *usb\_fill\_int\_urb* là một hàm hỗ trợ (helper function) để khởi tạo đúng cách một urb được gửi đến một endpoint ngắt (interrupt endpoint) của một thiết bị USB:

```c
void usb_fill_int_urb(struct urb *urb, struct usb_device *dev,
 unsigned int pipe, void *transfer_buffer,
 int buffer_length, usb_complete_t complete,
 void *context, int interval);
```

Hàm này chứa rất nhiều tham số:

```c
struct urb *urb
```

Con trỏ trỏ tới urb cần được khởi tạo.

```c
struct usb_device *dev
```

Thiết bị USB mà urb này sẽ được gửi tới.

```c
unsigned int pipe
```

Endpoint cụ thể của thiết bị USB mà urb này được gửi tới. Giá trị này được tạo bằng các hàm *usb\_sndintpipe* hoặc *usb\_rcvintpipe* đã đề cập trước đó.

```c
void *transfer_buffer
```

Con trỏ trỏ tới bộ đệm (buffer) chứa dữ liệu gửi đi hoặc nơi nhận dữ liệu đi tới. Lưu ý rằng đây không được là một bộ đệm tĩnh (static buffer) và bắt buộc phải được tạo bằng lời gọi hàm *kmalloc*.

```c
int buffer_length
```

Độ dài của bộ đệm được trỏ tới bởi con trỏ `transfer_buffer`.

```c
usb_complete_t complete
```

Con trỏ trỏ tới trình xử lý hoàn thành (completion handler) được gọi khi urb này hoàn tất.

```c
void *context
```

Con trỏ trỏ tới khối dữ liệu (blob) được thêm vào cấu trúc urb để hàm xử lý hoàn thành có thể truy xuất lại sau này.

```c
int interval
```

Khoảng thời gian (interval) mà urb này nên được lên lịch (scheduled). Xem phần mô tả trước đó về cấu trúc `struct urb` để tìm đơn vị thích hợp cho giá trị này.

### Bulk urbs

Các urb hàng loạt (bulk urbs) được khởi tạo rất giống với các urb ngắt (interrupt urbs). Hàm thực hiện việc này là *usb\_fill\_bulk\_urb*, có cấu trúc như sau:

```
void usb_fill_bulk_urb(struct urb *urb, struct usb_device *dev,
 unsigned int pipe, void *transfer_buffer,
 int buffer_length, usb_complete_t complete,
 void *context);
```

Các tham số của hàm đều giống như trong hàm *usb\_fill\_int\_urb*. Tuy nhiên, không có tham số khoảng thời gian (interval) vì bulk urbs không có giá trị khoảng thời gian. Xin lưu ý rằng biến `unsigned int pipe` phải được khởi tạo bằng một lời gọi đến hàm *usb\_sndbulkpipe* hoặc *usb\_rcvbulkpipe*.

Hàm *usb\_fill\_int\_urb* không thiết lập biến `transfer_flags` trong urb, vì vậy bất kỳ sửa đổi nào đối với trường này đều phải do chính driver thực hiện.

### Control urbs

Các urb điều khiển (control urbs) được khởi tạo gần như tương tự như bulk urbs, thông qua lời gọi đến hàm *usb\_fill\_control\_urb*:

```
void usb_fill_control_urb(struct urb *urb, struct usb_device *dev,
 unsigned int pipe, unsigned char *setup_packet,
 void *transfer_buffer, int buffer_length,
 usb_complete_t complete, void *context);
```

Các tham số của hàm đều giống như trong hàm *usb\_fill\_bulk\_urb*, ngoại trừ việc có thêm một tham số mới là `unsigned char *setup_packet`, phải trỏ đến dữ liệu gói thiết lập (setup packet data) sẽ được gửi đến điểm cuối (endpoint). Ngoài ra, biến `unsigned int pipe` phải được khởi tạo bằng một lời gọi đến hàm *usb\_sndctrlpipe* hoặc *usb\_rcvictrlpipe*.

Hàm *usb\_fill\_control\_urb* không thiết lập biến `transfer_flags` trong urb, do đó mọi sửa đổi đối với trường này phải do chính driver thực hiện. Hầu hết các driver không sử dụng hàm này, vì việc sử dụng các lời gọi API đồng bộ (synchronous API calls) như được mô tả trong phần "Truyền dữ liệu USB không dùng Urb" (USB Transfers Without Urbs) sẽ đơn giản hơn nhiều.

### Isochronous urbs

Đáng tiếc là các urb đẳng thời (isochronous urbs) không có hàm khởi tạo riêng giống như interrupt, control và bulk urbs. Do đó, chúng phải được khởi tạo "thủ công" (by hand) trong driver trước khi có thể được gửi (submit) lên USB core. Dưới đây là một ví dụ về cách khởi tạo đúng loại urb này. Đoạn mã được lấy từ driver kernel *konicawc.c* nằm trong thư mục *drivers/usb/media* thuộc cây mã nguồn kernel chính.

```
urb->dev = dev;
urb->context = uvd;
urb->pipe = usb_rcvisocpipe(dev, uvd->video_endp-1);
urb->interval = 1;
urb->transfer_flags = URB_ISO_ASAP;
urb->transfer_buffer = cam->sts_buf[i];
urb->complete = konicawc_isoc_irq;
urb->number_of_packets = FRAMES_PER_DESC;
urb->transfer_buffer_length = FRAMES_PER_DESC;
for (j=0; j < FRAMES_PER_DESC; j++) {
 urb->iso_frame_desc[j].offset = j;
 urb->iso_frame_desc[j].length = 1;
}
```

### Gửi URB (Submitting Urbs)

Một khi URB (USB Request Block) đã được khởi tạo và cấu hình đúng cách bởi driver USB, nó đã sẵn sàng để được gửi đến USB core nhằm truyền tải tới thiết bị USB. Việc này được thực hiện bằng cách gọi hàm *usb\_submit\_urb*:

```c
int usb_submit_urb(struct urb *urb, int mem_flags);
```

Tham số `urb` là một con trỏ trỏ tới URB sẽ được gửi đến thiết bị. Tham số `mem_flags` tương đương với tham số được truyền vào hàm *kmalloc* và được dùng để chỉ cho USB core biết cách cấp phát các bộ đệm bộ nhớ (memory buffer) tại thời điểm đó.

Sau khi một URB được gửi thành công đến USB core, driver tuyệt đối không được truy cập bất kỳ trường (field) nào của cấu trúc URB cho đến khi hàm `complete` được gọi.

Vì hàm *usb\_submit\_urb* có thể được gọi tại bất kỳ thời điểm nào (kể cả từ bên trong một ngữ cảnh ngắt - interrupt context), việc chỉ định biến `mem_flags` phải chính xác. Thực tế chỉ có ba giá trị hợp lệ nên được sử dụng, tùy thuộc vào thời điểm *usb\_submit\_urb* được gọi:

#### GFP\_ATOMIC

Giá trị này nên được sử dụng khi bất kỳ điều kiện nào sau đây đúng:

- Người gọi đang nằm trong một hàm xử lý hoàn thành URB (completion handler), một ngắt (interrupt), nửa dưới (bottom half), tasklet, hoặc hàm gọi lại của bộ định thời (timer callback).
- Người gọi đang giữ một spinlock hoặc rwlock. Lưu ý rằng nếu một semaphore đang được giữ, giá trị này là không bắt buộc.
- `current->state` không phải là `TASK_RUNNING`. Trạng thái này luôn là `TASK_RUNNING` trừ khi bản thân driver đã thay đổi trạng thái hiện tại.

#### GFP\_NOIO

Giá trị này nên được sử dụng nếu driver nằm trong đường dẫn I/O của khối (block I/O path). Nó cũng nên được sử dụng trong đường dẫn xử lý lỗi của tất cả các thiết bị kiểu lưu trữ (storage-type device).

#### GFP\_KERNEL

Giá trị này nên được sử dụng cho tất cả các tình huống khác không thuộc các danh mục đã đề cập ở trên.

### Hoàn thành URB: Hàm xử lý gọi lại hoàn thành (The Completion Callback Handler)

Nếu lời gọi *usb\_submit\_urb* thành công, việc chuyển quyền kiểm soát URB cho USB core hoàn tất, hàm sẽ trả về 0; nếu không, một mã lỗi âm sẽ được trả về. Nếu hàm thành công, hàm xử lý hoàn thành (completion handler) của URB (được chỉ định bởi con trỏ hàm `complete`) sẽ được gọi chính xác một lần khi URB hoàn thành. Khi hàm này được gọi, USB core đã xử lý xong URB và quyền kiểm soát đối với nó giờ đây được trả lại cho device driver.

Chỉ có ba cách để một URB hoàn thành và hàm `complete` được gọi:

- URB được gửi thành công đến thiết bị và thiết bị trả về tín hiệu xác nhận (acknowledgment) phù hợp. Đối với URB chiều ra (OUT urb), dữ liệu đã được gửi thành công và đối với URB chiều vào (IN urb), dữ liệu được yêu cầu đã được nhận thành công. Nếu điều này xảy ra, biến `status` trong URB được đặt thành 0.
- Một loại lỗi nào đó đã xảy ra khi gửi hoặc nhận dữ liệu từ thiết bị. Điều này được ghi nhận bởi giá trị lỗi trong biến `status` nằm trong cấu trúc URB.
- URB bị "hủy liên kết" (unlinked) khỏi USB core. Điều này xảy ra khi driver yêu cầu USB core hủy một URB đã được gửi bằng cách gọi *usb\_unlink\_urb* hoặc *usb\_kill\_urb*, hoặc khi một thiết bị bị gỡ bỏ khỏi hệ thống trong khi một URB vẫn đang được gửi đến nó.

Một ví dụ về cách kiểm tra các giá trị trả về khác nhau bên trong một hàm gọi lại hoàn thành URB sẽ được trình bày sau trong chương này.

### Hủy Urb (Canceling Urbs)

Để dừng một urb đã được gửi (submitted) đến USB core, các hàm *usb\_kill\_urb* hoặc *usb\_unlink\_urb* cần được gọi:

```c
int usb_kill_urb(struct urb *urb);
int usb_unlink_urb(struct urb *urb);
```

Tham số `urb` cho cả hai hàm này là một con trỏ trỏ tới urb cần hủy.

Khi sử dụng hàm *usb\_kill\_urb*, vòng đời (lifecycle) của urb sẽ bị dừng lại. Hàm này thường được sử dụng khi thiết bị bị ngắt kết nối khỏi hệ thống, nằm trong hàm gọi lại ngắt kết nối (disconnect callback).

Đối với một số driver, hàm *usb\_unlink\_urb* nên được sử dụng để yêu cầu USB core dừng một urb. Hàm này không đợi urb dừng hoàn toàn trước khi trả về cho tiến trình gọi (caller). Điều này rất hữu ích để dừng urb khi đang ở trong trình xử lý ngắt (interrupt handler) hoặc khi đang giữ một spinlock, vì việc chờ đợi urb dừng hoàn toàn đòi hỏi USB core phải có khả năng đưa tiến trình gọi vào trạng thái ngủ (sleep). Hàm này yêu cầu cờ `URB_ASYNC_UNLINK` phải được thiết lập trong urb cần dừng để có thể hoạt động chính xác.

## Viết một USB Driver

Phương pháp tiếp cận để viết một driver thiết bị USB cũng tương tự như `pci_driver`: driver đăng ký đối tượng driver của mình với hệ thống con USB (USB subsystem) và sau đó sử dụng các định danh nhà sản xuất (vendor identifier) và thiết bị (device identifier) để nhận biết xem phần cứng của nó đã được cài đặt hay chưa.

### Driver Hỗ Trợ Những Thiết Bị Nào?

Cấu trúc `struct usb_device_id` cung cấp một danh sách các loại thiết bị USB khác nhau được hỗ trợ bởi driver này. Danh sách này được sử dụng bởi USB core để quyết định giao thiết bị cho driver nào, và được sử dụng bởi các tập lệnh hotplug để quyết định driver nào sẽ được tự động tải khi một thiết bị cụ thể được cắm vào hệ thống.

Cấu trúc `struct usb_device_id` được định nghĩa với các trường sau:

\_\_u16 match\_flags

Xác định trường nào trong cấu trúc dưới đây sẽ được dùng để so khớp với thiết bị. Đây là một trường bit (bit field) được định nghĩa bởi các giá trị `USB_DEVICE_ID_MATCH_*` khác nhau được chỉ định trong tệp *include/linux/mod\_devicetable.h*. Trường này thường không bao giờ được thiết lập trực tiếp mà được khởi tạo bởi các macro kiểu `USB_DEVICE` được mô tả sau đây.

\_\_u16 idVendor

Mã ID nhà sản xuất USB (vendor ID) cho thiết bị. Con số này được cấp phát bởi diễn đàn USB (USB forum) cho các thành viên của mình và không ai khác có thể tự ý tạo ra.

\_\_u16 idProduct

Mã ID sản phẩm USB (product ID) cho thiết bị. Tất cả các nhà sản xuất đã được cấp ID nhà sản xuất đều có thể quản lý mã ID sản phẩm của riêng họ theo bất kỳ cách nào họ muốn.

\_\_u16 bcdDevice\_lo

\_\_u16 bcdDevice\_hi

Xác định giới hạn thấp và cao của dải số phiên bản sản phẩm do nhà sản xuất gán. Giá trị `bcdDevice_hi` mang tính bao gồm (inclusive); giá trị của nó là số của thiết bị có số thứ tự cao nhất. Cả hai giá trị này được biểu diễn dưới dạng thập phân mã hóa nhị phân (Binary-Coded Decimal - BCD). Các biến này, kết hợp với `idVendor` và `idProduct`, được sử dụng để xác định một phiên bản cụ thể của thiết bị.

- \_\_u8 bDeviceClass
- \_\_u8 bDeviceSubClass
- \_\_u8 bDeviceProtocol

Lần lượt xác định lớp (class), lớp con (subclass), và giao thức (protocol) của thiết bị. Những con số này được cấp phát bởi diễn đàn USB và được định nghĩa trong thông số kỹ thuật USB (USB specification). Các giá trị này quy định hành vi cho toàn bộ thiết bị, bao gồm tất cả các giao diện (interfaces) trên thiết bị đó.

- \_\_u8 bInterfaceClass
- \_\_u8 bInterfaceSubClass
- \_\_u8 bInterfaceProtocol

Tương tự như các giá trị đặc trưng cho thiết bị ở trên, các trường này lần lượt xác định lớp, lớp con và giao thức của từng giao diện riêng lẻ. Những con số này được cấp phát bởi diễn đàn USB và được định nghĩa trong thông số kỹ thuật USB.

#### kernel\_ulong\_t driver\_info

Giá trị này không được dùng để so khớp, nhưng nó chứa thông tin mà driver có thể sử dụng để phân biệt các thiết bị khác nhau với nhau trong hàm gọi lại `probe` của USB driver.

Giống như các thiết bị PCI, có một số macro được sử dụng để khởi tạo cấu trúc này:

#### USB\_DEVICE(vendor, product)

Tạo một `struct usb_device_id` có thể được sử dụng để chỉ so khớp với các giá trị ID nhà sản xuất và sản phẩm được chỉ định. Điều này rất thường được sử dụng cho các thiết bị USB cần một driver cụ thể.

#### USB\_DEVICE\_VER(vendor, product, lo, hi)

Tạo một `struct usb_device_id` có thể được sử dụng để chỉ so khớp với các giá trị ID nhà sản xuất và sản phẩm được chỉ định nằm trong một dải phiên bản.

#### USB\_DEVICE\_INFO(class, subclass, protocol)

Tạo một `struct usb_device_id` có thể được sử dụng để so khớp với một lớp thiết bị USB cụ thể.

#### USB\_INTERFACE\_INFO(class, subclass, protocol)

Tạo một `struct usb_device_id` có thể được sử dụng để so khớp với một lớp giao diện USB cụ thể.

Vì vậy, đối với một driver thiết bị USB đơn giản chỉ điều khiển một thiết bị USB duy nhất từ một nhà sản xuất duy nhất, bảng `struct usb_device_id` sẽ được định nghĩa như sau:

```c
/* bảng các thiết bị hoạt động với driver này */
static struct usb_device_id skel_table [ ] = {
 { USB_DEVICE(USB_SKEL_VENDOR_ID, USB_SKEL_PRODUCT_ID) },
 { } /* Phần tử kết thúc bảng */
};
MODULE_DEVICE_TABLE (usb, skel_table);
```

Giống như driver PCI, macro `MODULE_DEVICE_TABLE` là cần thiết để cho phép các công cụ ở không gian người dùng (user-space tools) nhận diện được những thiết bị nào mà driver này có thể điều khiển. Tuy nhiên, đối với các USB driver, chuỗi `usb` phải là giá trị đầu tiên trong macro.

### Đăng ký một USB Driver

Cấu trúc chính mà tất cả các USB driver phải khởi tạo là `struct usb_driver`. Cấu trúc này phải được điền đầy đủ bởi USB driver và bao gồm một số hàm callback cùng các biến mô tả USB driver cho mã nguồn USB core (USB core code):

```
struct module *owner
```

Con trỏ trỏ tới module sở hữu driver này. USB core sử dụng nó để thực hiện tham chiếu (reference count) đúng cách đối với USB driver này nhằm đảm bảo nó không bị gỡ tải (unload) vào những thời điểm không thích hợp. Biến này nên được gán bằng macro `THIS_MODULE`.

```
const char *name
```

Con trỏ trỏ tới tên của driver. Nó phải là duy nhất (unique) trong số tất cả các USB driver trong kernel và thường được đặt trùng với tên module của driver. Nó xuất hiện trong sysfs tại đường dẫn */sys/bus/usb/drivers/* khi driver được nạp vào kernel.

```
const struct usb_device_id *id_table
```

Con trỏ trỏ tới bảng `struct usb_device_id`, nơi chứa danh sách tất cả các loại thiết bị USB khác nhau mà driver này có thể chấp nhận. Nếu biến này không được thiết lập, hàm callback `probe` trong USB driver sẽ không bao giờ được gọi. Nếu bạn muốn driver của mình luôn được gọi cho mọi thiết bị USB có trong hệ thống, hãy tạo một mục chỉ thiết lập trường `driver_info`:

```
static struct usb_device_id usb_ids[ ] = {
 {.driver_info = 42},
 { }
};
```

int (\*probe) (struct usb\_interface \*intf, const struct usb\_device\_id \*id)

Con trỏ trỏ tới hàm `probe` trong USB driver. Hàm này (được mô tả trong phần "Chi tiết về probe và disconnect") được gọi bởi USB core khi nó cho rằng có một `struct usb_interface` mà driver này có thể xử lý. Một con trỏ trỏ tới `struct usb_device_id` mà USB core đã dùng để đưa ra quyết định này cũng được truyền vào hàm. Nếu USB driver nhận quản lý `struct usb_interface` được truyền cho nó, nó phải khởi tạo thiết bị đúng cách và trả về 0. Nếu driver không muốn nhận thiết bị, hoặc xảy ra lỗi, nó phải trả về một giá trị lỗi âm (negative error value).

```
void (*disconnect) (struct usb_interface *intf)
```

Con trỏ trỏ tới hàm `disconnect` trong USB driver. Hàm này (được mô tả trong phần "Chi tiết về probe và disconnect") được gọi bởi USB core khi `struct usb_interface` bị gỡ khỏi hệ thống hoặc khi driver đang bị gỡ tải khỏi USB core.

Vì vậy, để tạo một cấu trúc `struct usb_driver` hợp lệ, chỉ cần khởi tạo năm trường:

```
static struct usb_driver skel_driver = {
 .owner = THIS_MODULE,
 .name = "skeleton",
 .id_table = skel_table,
 .probe = skel_probe,
 .disconnect = skel_disconnect,
};
```

`struct usb_driver` thực ra chứa một số callback khác, nhưng chúng thường ít khi được sử dụng và không bắt buộc để một USB driver hoạt động bình thường:

int (\*ioctl) (struct usb\_interface \*intf, unsigned int code, void \*buf) Con trỏ trỏ tới hàm *ioctl* trong USB driver. Nếu hàm này tồn tại, nó sẽ được gọi khi một chương trình ở không gian người dùng (user-space program) thực hiện lệnh gọi *ioctl* trên mục thiết bị hệ thống tệp *usbfs* liên kết với một thiết bị USB gắn vào USB driver này. Trên thực tế, chỉ có driver USB hub sử dụng ioctl này, vì không có nhu cầu thực tế nào khác để các USB driver khác phải dùng đến nó.

int (\*suspend) (struct usb\_interface \*intf, u32 state) Con trỏ trỏ tới hàm suspend trong USB driver. Nó được gọi khi thiết bị chuẩn bị bị chuyển sang trạng thái tạm nghỉ (suspended) bởi USB core.

int (\*resume) (struct usb\_interface \*intf) Con trỏ trỏ tới hàm resume trong USB driver. Nó được gọi khi thiết bị đang được đánh thức trở lại (resumed) bởi USB core.

Để đăng ký `struct usb_driver` với USB core, một lời gọi hàm `usb_register_driver` được thực hiện kèm theo con trỏ trỏ tới `struct usb_driver`. Thao tác này thường được thực hiện trong mã nguồn khởi tạo module của USB driver:

```
static int __init usb_skel_init(void)
{
 int result;
 /* đăng ký driver này với hệ thống con USB */
 result = usb_register(&skel_driver);
 if (result)
 err("usb_register failed. Error number %d", result);
 return result;
}
```

Khi USB driver bị gỡ tải, `struct usb_driver` cần phải được hủy đăng ký khỏi kernel. Việc này được thực hiện thông qua lời gọi `usb_deregister_driver`. Khi lời gọi này diễn ra, mọi giao diện USB (USB interfaces) đang liên kết (bind) với driver này sẽ bị ngắt kết nối và hàm `disconnect` sẽ được gọi cho các giao diện đó.

```
static void __exit usb_skel_exit(void)
{
 /* hủy đăng ký driver này với hệ thống con USB */
 usb_deregister(&skel_driver);
}
```

### Chi tiết về probe và disconnect

Trong cấu trúc `struct usb_driver` được mô tả ở phần trước, trình điều khiển (driver) chỉ định hai hàm mà USB core (nhân USB) sẽ gọi tại các thời điểm thích hợp. Hàm *probe* được gọi khi một thiết bị được kết nối mà USB core cho rằng driver này nên xử lý; hàm *probe* sẽ thực hiện việc kiểm tra các thông tin được truyền tới nó về thiết bị và quyết định xem driver có thực sự phù hợp với thiết bị đó hay không. Hàm *disconnect* được gọi khi driver không còn nên điều khiển thiết bị vì một lý do nào đó và có thể thực hiện việc dọn dẹp (clean-up).

Cả hai hàm callback *probe* và *disconnect* đều được gọi trong ngữ cảnh của luồng nhân (kernel thread) USB hub, vì vậy việc ngủ (sleep) bên trong các hàm này là hoàn toàn hợp pháp. Tuy nhiên, nếu có thể, bạn nên để phần lớn công việc được thực hiện khi thiết bị được mở (opened) bởi người dùng, nhằm giảm thiểu tối đa thời gian dò tìm thiết bị (USB probing time). Lý do là vì USB core xử lý việc thêm và gỡ bỏ thiết bị USB trong một luồng duy nhất, do đó bất kỳ driver thiết bị nào chạy chậm cũng có thể khiến thời gian nhận diện thiết bị USB bị chậm đi và người dùng có thể nhận thấy rõ điều đó.

Trong hàm callback *probe*, driver USB nên khởi tạo bất kỳ cấu trúc cục bộ (local structure) nào mà nó có thể sử dụng để quản lý thiết bị USB. Nó cũng nên lưu lại bất kỳ thông tin cần thiết nào về thiết bị vào cấu trúc cục bộ đó, vì việc thực hiện việc này tại thời điểm này thường là dễ dàng nhất. Ví dụ, các driver USB thường muốn phát hiện địa chỉ endpoint (điểm cuối) và kích thước bộ đệm (buffer size) của thiết bị, vì chúng là những thông tin cần thiết để giao tiếp với thiết bị. Dưới đây là đoạn mã nguồn mẫu dùng để phát hiện cả hai endpoint IN và OUT thuộc loại BULK, đồng thời lưu trữ một số thông tin về chúng trong cấu trúc thiết bị cục bộ:

```c
/* thiết lập thông tin endpoint */
/* chỉ sử dụng endpoint bulk-in và bulk-out đầu tiên */
iface_desc = interface->cur_altsetting;
for (i = 0; i < iface_desc->desc.bNumEndpoints; ++i) {
 endpoint = &iface_desc->endpoint[i].desc;
 if (!dev->bulk_in_endpointAddr &&
 (endpoint->bEndpointAddress & USB_DIR_IN) &&
 ((endpoint->bmAttributes & USB_ENDPOINT_XFERTYPE_MASK)
 = = USB_ENDPOINT_XFER_BULK)) {
 /* chúng ta đã tìm thấy endpoint bulk in */
 buffer_size = endpoint->wMaxPacketSize;
 dev->bulk_in_size = buffer_size;
 dev->bulk_in_endpointAddr = endpoint->bEndpointAddress;
 dev->bulk_in_buffer = kmalloc(buffer_size, GFP_KERNEL);
 if (!dev->bulk_in_buffer) {
 err("Could not allocate bulk_in_buffer");
 goto error;
 }
 }
 if (!dev->bulk_out_endpointAddr &&
 !(endpoint->bEndpointAddress & USB_DIR_IN) &&
 ((endpoint->bmAttributes & USB_ENDPOINT_XFER_MASK)
```

```c
 = = USB_ENDPOINT_XFER_BULK)) {
 /* chúng ta đã tìm thấy endpoint bulk out */
 dev->bulk_out_endpointAddr = endpoint->bEndpointAddress;
 }
}
if (!(dev->bulk_in_endpointAddr && dev->bulk_out_endpointAddr)) {
 err("Could not find both bulk-in and bulk-out endpoints");
 goto error;
}
```

Khối mã nguồn này trước tiên lặp qua mọi endpoint hiện diện trong giao diện (interface) này và gán một con trỏ cục bộ tới cấu trúc endpoint để giúp việc truy cập sau này trở nên dễ dàng hơn:

```c
for (i = 0; i < iface_desc->desc.bNumEndpoints; ++i) {
 endpoint = &iface_desc->endpoint[i].desc;
```

Sau đó, khi đã có một endpoint và chúng ta chưa tìm thấy endpoint loại bulk IN nào trước đó, chúng ta kiểm tra xem hướng của endpoint này có phải là IN hay không. Điều này có thể được kiểm tra bằng cách xem liệu mặt nạ bit (bitmask) `USB_DIR_IN` có nằm trong biến endpoint `bEndpointAddress` hay không. Nếu điều này đúng, chúng ta xác định xem kiểu endpoint có phải là bulk hay không bằng cách trước tiên lọc biến `bmAttributes` với mặt nạ bit `USB_ENDPOINT_XFERTYPE_MASK`, sau đó kiểm tra xem nó có khớp với giá trị `USB_ENDPOINT_XFER_BULK` hay không:

```c
if (!dev->bulk_in_endpointAddr &&
 (endpoint->bEndpointAddress & USB_DIR_IN) &&
 ((endpoint->bmAttributes & USB_ENDPOINT_XFERTYPE_MASK)
 = = USB_ENDPOINT_XFER_BULK)) {
```

Nếu tất cả các điều kiện kiểm tra trên đều đúng, driver biết rằng nó đã tìm đúng loại endpoint và có thể lưu thông tin về endpoint đó — thứ mà nó sẽ cần sau này để giao tiếp qua endpoint đó — vào một cấu trúc cục bộ:

```c
/* chúng ta đã tìm thấy endpoint bulk in */
buffer_size = endpoint->wMaxPacketSize;
dev->bulk_in_size = buffer_size;
dev->bulk_in_endpointAddr = endpoint->bEndpointAddress;
dev->bulk_in_buffer = kmalloc(buffer_size, GFP_KERNEL);
if (!dev->bulk_in_buffer) {
 err("Could not allocate bulk_in_buffer");
 goto error;
}
```

Vì driver USB cần truy xuất cấu trúc dữ liệu cục bộ được liên kết với `struct usb_interface` này ở các giai đoạn sau trong vòng đời của thiết bị, hàm `usb_set_intfdata` có thể được gọi:

```c
/* lưu con trỏ dữ liệu của chúng ta vào thiết bị giao diện này */
usb_set_intfdata(interface, dev);
```

Hàm này chấp nhận một con trỏ trỏ tới bất kỳ kiểu dữ liệu nào và lưu nó vào cấu trúc `struct usb_interface` để có thể truy cập sau này. Để truy xuất dữ liệu, hàm `usb_get_intfdata` nên được gọi:

```c
struct usb_skel *dev;
struct usb_interface *interface;
```

```c
int subminor;
int retval = 0;
subminor = iminor(inode);
interface = usb_find_interface(&skel_driver, subminor);
if (!interface) {
 err ("%s - error, can't find device for minor %d",
 __FUNCTION__, subminor);
 retval = -ENODEV;
 goto exit;
}
dev = usb_get_intfdata(interface);
if (!dev) {
 retval = -ENODEV;
 goto exit;
}
```

*usb_get_intfdata* thường được gọi trong hàm *open* của USB driver và được gọi lại trong hàm *disconnect*. Nhờ hai hàm này, các USB driver không cần phải duy trì một mảng tĩnh (static array) chứa các con trỏ trỏ đến từng cấu trúc thiết bị riêng lẻ cho tất cả các thiết bị hiện có trong hệ thống. Việc tham chiếu gián tiếp đến thông tin thiết bị cho phép mọi USB driver hỗ trợ một số lượng thiết bị không giới hạn.

Nếu USB driver không liên kết với một loại subsystem khác xử lý tương tác của người dùng với thiết bị (như input, tty, video, v.v.), driver có thể sử dụng USB major number để dùng giao diện char driver truyền thống với User Space. Để làm điều này, USB driver phải gọi hàm *usb_register_dev* trong hàm *probe* khi nó muốn đăng ký một thiết bị với USB core. Hãy đảm bảo rằng thiết bị và driver đang ở trạng thái phù hợp để xử lý việc người dùng muốn truy cập thiết bị ngay khi hàm này được gọi.

```c
/* bây giờ chúng ta có thể đăng ký thiết bị vì nó đã sẵn sàng */
retval = usb_register_dev(interface, &skel_class);
if (retval) {
 /* có điều gì đó ngăn cản chúng ta đăng ký driver này */
 err("Not able to get a minor for this device.");
 usb_set_intfdata(interface, NULL);
 goto error;
}
```

Hàm *usb_register_dev* yêu cầu một con trỏ trỏ đến struct usb_interface và một con trỏ trỏ đến struct usb_class_driver. Cấu trúc struct usb_class_driver này được sử dụng để định nghĩa một số tham số khác nhau mà USB driver muốn USB core biết khi đăng ký một minor number. Cấu trúc này bao gồm các biến sau:

#### char \*name

Tên mà sysfs sử dụng để mô tả thiết bị. Đường dẫn tiền tố (leading pathname), nếu có, chỉ được sử dụng trong devfs và không được đề cập trong cuốn sách này. Nếu số hiệu của thiết bị cần có trong tên, các ký tự `%d` nên xuất hiện trong chuỗi tên. Ví dụ, để tạo tên devfs `usb/foo1` và tên sysfs class `foo1`, chuỗi tên phải được đặt là `usb/foo%d`.

```c
struct file_operations *fops;
```

Con trỏ trỏ đến struct file_operations mà driver này đã định nghĩa để sử dụng cho việc đăng ký như một character device. Xem Chương 3 để biết thêm thông tin về cấu trúc này.

#### mode\_t mode;

Chế độ (mode) cho tệp devfs sẽ được tạo cho driver này; nếu không sẽ không được sử dụng. Một thiết lập điển hình cho biến này là giá trị `S_IRUSR` kết hợp với giá trị `S_IWUSR`, điều này chỉ cho phép quyền đọc và ghi đối với chủ sở hữu (owner) của tệp thiết bị.

#### int minor\_base;

Đây là điểm bắt đầu của dải minor number được chỉ định cho driver này. Tất cả các thiết bị liên kết với driver này được tạo ra với các minor number tăng dần và duy nhất bắt đầu từ giá trị này. Chỉ cho phép tối đa 16 thiết bị liên kết với driver này tại bất kỳ thời điểm nào trừ khi tùy chọn cấu hình `CONFIG_USB_DYNAMIC_MINORS` đã được bật cho Kernel. Nếu vậy, biến này sẽ bị bỏ qua và tất cả các minor number cho thiết bị sẽ được cấp phát theo nguyên tắc đến trước được phục vụ trước. Khuyến nghị rằng các hệ thống đã bật tùy chọn này nên sử dụng một chương trình như *udev* để quản lý các nút thiết bị (device node) trong hệ thống, vì cây thư mục */dev* tĩnh sẽ hoạt động không chính xác.

Khi thiết bị USB bị ngắt kết nối, tất cả tài nguyên liên kết với thiết bị phải được dọn dẹp (cleaned up) nếu có thể. Tại thời điểm này, nếu *usb_register_dev* đã được gọi để cấp phát một minor number cho thiết bị USB này trong hàm *probe*, thì hàm *usb_deregister_dev* phải được gọi để trả lại minor number cho USB core.

Trong hàm *disconnect*, điều quan trọng nữa là lấy lại từ interface mọi dữ liệu đã được thiết lập trước đó bằng lệnh gọi *usb_set_intfdata*. Sau đó, đặt con trỏ dữ liệu trong cấu trúc struct usb_interface thành `NULL` để ngăn chặn bất kỳ sai sót nào trong tương lai do truy cập dữ liệu không đúng cách:

```c
static void skel_disconnect(struct usb_interface *interface)
{
 struct usb_skel *dev;
 int minor = interface->minor;
 /* ngăn chặn skel_open() xảy ra race condition với skel_disconnect() */
 lock_kernel( );
 dev = usb_get_intfdata(interface);
 usb_set_intfdata(interface, NULL);
 /* trả lại minor của chúng ta */
 usb_deregister_dev(interface, &skel_class);
 unlock_kernel( );
```

```c
 /* giảm số đếm sử dụng (usage count) của chúng ta */
 kref_put(&dev->kref, skel_delete);
 info("USB Skeleton #%d now disconnected", minor);
}
```

Hãy chú ý đến lệnh gọi *lock_kernel* trong đoạn mã trước. Thao tác này chiếm khóa Big Kernel Lock (BKL), để hàm callback *disconnect* không gặp phải tình trạng tranh chấp dữ liệu (Race Condition) với hàm *open* khi cố gắng lấy con trỏ trỏ đến cấu trúc dữ liệu interface chính xác. Bởi vì hàm *open* được gọi khi đã nắm giữ Big Kernel Lock, nếu hàm *disconnect* cũng nắm giữ cùng khóa đó, thì chỉ có một phần của driver có thể truy cập và sau đó thiết lập con trỏ dữ liệu interface.

Ngay trước khi hàm *disconnect* được gọi cho một thiết bị USB (USB device), tất cả các urb hiện đang trong quá trình truyền dữ liệu cho thiết bị đó sẽ bị hủy bởi lõi USB (USB core), vì vậy driver không cần phải gọi tường minh *usb\_kill\_urb* cho các urb này. Nếu driver cố gắng gửi một urb đến một thiết bị USB sau khi nó đã bị ngắt kết nối bằng một lời gọi hàm *usb\_submit\_urb*, tiến trình gửi sẽ thất bại với mã lỗi trả về là -EPIPE.

### Gửi và Điều khiển một Urb

Khi driver có dữ liệu cần gửi đến thiết bị USB (như thường xảy ra trong hàm ghi - write function của driver), một urb phải được cấp phát để truyền dữ liệu đến thiết bị:

```c
urb = usb_alloc_urb(0, GFP_KERNEL);
if (!urb) {
 retval = -ENOMEM;
 goto error;
}
```

Sau khi urb được cấp phát thành công, một vùng đệm DMA (DMA buffer) cũng nên được tạo để gửi dữ liệu đến thiết bị theo cách hiệu quả nhất, và dữ liệu được truyền tới driver sẽ được sao chép vào vùng đệm đó:

```c
buf = usb_buffer_alloc(dev->udev, count, GFP_KERNEL, &urb->transfer_dma);
if (!buf) {
 retval = -ENOMEM;
 goto error;
}
if (copy_from_user(buf, user_buffer, count)) {
 retval = -EFAULT;
 goto error;
}
```

Một khi dữ liệu đã được sao chép đúng cách từ không gian người dùng (user space) sang bộ đệm cục bộ (local buffer), urb phải được khởi tạo chính xác trước khi nó có thể được gửi tới lõi USB (USB core):

```c
/* khởi tạo urb đúng cách */
usb_fill_bulk_urb(urb, dev->udev,
 usb_sndbulkpipe(dev->udev, dev->bulk_out_endpointAddr),
 buf, count, skel_write_bulk_callback, dev);
urb->transfer_flags |= URB_NO_TRANSFER_DMA_MAP;
```

Bây giờ urb đã được cấp phát, dữ liệu đã được sao chép, và urb đã được khởi tạo hoàn chỉnh, nó có thể được gửi đến lõi USB (USB core) để truyền tải đến thiết bị:

```c
/* gửi dữ liệu qua cổng bulk */
retval = usb_submit_urb(urb, GFP_KERNEL);
if (retval) {
 err("%s - failed submitting write urb, error %d", __FUNCTION__, retval);
 goto error;
}
```

Sau khi urb được truyền thành công đến thiết bị USB (hoặc có sự cố xảy ra trong quá trình truyền), hàm callback của urb sẽ được gọi bởi lõi USB (USB core). Trong ví dụ của chúng tôi, chúng ta đã khởi tạo urb trỏ tới hàm *skel\_write\_bulk\_callback*, và đó là hàm sẽ được gọi:

```c
static void skel_write_bulk_callback(struct urb *urb, struct pt_regs *regs)
{
 /* lỗi hủy liên kết đồng bộ/bất đồng bộ (sync/async unlink faults) không phải là lỗi */
 if (urb->status &&
 !(urb->status = = -ENOENT ||
 urb->status = = -ECONNRESET ||
 urb->status = = -ESHUTDOWN)) {
 dbg("%s - nonzero write bulk status received: %d",
 __FUNCTION__, urb->status);
 }
 /* giải phóng bộ đệm đã cấp phát của chúng ta */
 usb_buffer_free(urb->dev, urb->transfer_buffer_length,
 urb->transfer_buffer, urb->transfer_dma);
}
```

Việc đầu tiên mà hàm callback thực hiện là kiểm tra trạng thái của urb để xác định xem urb này hoàn thành thành công hay không. Các giá trị lỗi -ENOENT, -ECONNRESET, và -ESHUTDOWN không phải là lỗi truyền thực sự, mà chỉ là các thông báo về các trạng thái đi kèm với một quá trình truyền thành công. (Xem danh sách các lỗi có thể xảy ra đối với urb được trình bày chi tiết trong mục "struct urb"). Sau đó, hàm callback sẽ giải phóng bộ đệm đã được cấp phát được gán cho urb này để truyền dữ liệu.

Việc một urb khác được gửi tới thiết bị trong khi hàm callback của urb đang chạy là điều rất phổ biến. Điều này rất hữu ích khi truyền phát dữ liệu (streaming data) đến một thiết bị. Hãy nhớ rằng hàm callback của urb đang chạy trong ngữ cảnh ngắt (interrupt context), vì vậy nó không nên thực hiện bất kỳ việc cấp phát bộ nhớ nào, giữ các semaphore (hold any semaphores), hoặc làm bất cứ điều gì khác có thể khiến tiến trình đi vào trạng thái ngủ (sleep). Khi gửi một urb từ bên trong một hàm callback, hãy sử dụng cờ `GFP_ATOMIC` để ra lệnh cho lõi USB (USB core) không được đưa tiến trình vào trạng thái ngủ (sleep) nếu nó cần cấp phát các khối bộ nhớ mới trong quá trình gửi.

## Truyền dữ liệu USB Không cần Urbs (USB Transfers Without Urbs)

Đôi khi, một USB driver không muốn phải trải qua tất cả sự phức tạp của việc tạo một `struct urb`, khởi tạo nó, và sau đó chờ đợi hàm hoàn thành urb (urb completion function) chạy, chỉ để gửi hoặc nhận một số dữ liệu USB đơn giản. Hai hàm có sẵn để cung cấp một giao diện đơn giản hơn.

### usb\_bulk\_msg

*usb\_bulk\_msg* tạo một USB bulk urb và gửi nó đến thiết bị được chỉ định, sau đó chờ cho đến khi hoàn tất trước khi trả về cho hàm gọi. Nó được định nghĩa như sau:

```c
int usb_bulk_msg(struct usb_device *usb_dev, unsigned int pipe,
 void *data, int len, int *actual_length,
 int timeout);
```

Các tham số của hàm này là:

```c
struct usb_device *usb_dev
```

Con trỏ trỏ tới thiết bị USB (USB device) mà thông điệp bulk sẽ được gửi đến.

```c
unsigned int pipe
```

Endpoint cụ thể của thiết bị USB nơi thông điệp bulk này được gửi tới. Giá trị này được tạo thông qua một lời gọi tới *usb\_sndbulkpipe* hoặc *usb\_rcvbulkpipe*.

```c
void *data
```

Con trỏ trỏ tới dữ liệu cần gửi đến thiết bị nếu đây là một endpoint OUT. Nếu đây là một endpoint IN, đây là con trỏ trỏ tới vị trí dữ liệu sẽ được lưu trữ sau khi được đọc từ thiết bị.

```c
int len
```

Độ dài của bộ đệm (buffer) được trỏ tới bởi tham số `data`.

```c
int *actual_length
```

Con trỏ trỏ tới vị trí mà hàm sẽ đặt số byte thực tế đã được truyền đến thiết bị hoặc nhận từ thiết bị, tùy thuộc vào hướng của endpoint.

```c
int timeout
```

Khoảng thời gian, tính bằng đơn vị jiffies, sẽ chờ trước khi xảy ra quá thời gian (timeout). Nếu giá trị này bằng 0, hàm sẽ chờ vô thời hạn cho đến khi thông điệp hoàn tất.

Nếu hàm thực hiện thành công, giá trị trả về là 0; ngược lại, một mã lỗi âm sẽ được trả về. Mã lỗi này tương ứng với các mã lỗi đã được mô tả trước đó cho urb trong phần "struct urb". Nếu thành công, tham số `actual_length` sẽ chứa số byte đã được truyền đi hoặc nhận về từ thông điệp này.

Dưới đây là một ví dụ về cách sử dụng lời gọi hàm này:

```c
/* thực hiện một thao tác đọc bulk đồng bộ (blocking) để lấy dữ liệu từ thiết bị */
retval = usb_bulk_msg(dev->udev,
 usb_rcvbulkpipe(dev->udev, dev->bulk_in_endpointAddr),
 dev->bulk_in_buffer,
 min(dev->bulk_in_size, count),
 &count, HZ*10);
/* nếu đọc thành công, sao chép dữ liệu sang không gian người dùng (user space) */
if (!retval) {
 if (copy_to_user(buffer, dev->bulk_in_buffer, count))
 retval = -EFAULT;
 else
 retval = count;
}
```

Ví dụ này minh họa một thao tác đọc bulk đơn giản từ một endpoint IN. Nếu quá trình đọc thành công, dữ liệu sau đó sẽ được sao chép sang không gian người dùng (user space). Việc này thường được thực hiện bên trong hàm `read` của một driver USB.

Hàm *usb\_bulk\_msg* không thể được gọi từ bên trong ngữ cảnh ngắt (interrupt context) hoặc khi đang giữ một spinlock. Ngoài ra, hàm này không thể bị hủy bởi bất kỳ hàm nào khác, vì vậy hãy cẩn thận khi sử dụng nó; hãy đảm bảo rằng hàm *disconnect* của driver có đủ cơ chế để chờ cho lời gọi hoàn tất trước khi cho phép driver bị gỡ tải (unload) khỏi bộ nhớ.

### usb\_control\_msg

Hàm *usb\_control\_msg* hoạt động giống hệt như hàm *usb\_bulk\_msg*, ngoại trừ việc nó cho phép một driver (trình điều khiển) gửi và nhận các thông điệp điều khiển USB (USB control messages):

```c
int usb_control_msg(struct usb_device *dev, unsigned int pipe,
 __u8 request, __u8 requesttype,
 __u16 value, __u16 index,
 void *data, __u16 size, int timeout);
```

Các tham số của hàm này hầu như giống với *usb\_bulk\_msg*, với một vài điểm khác biệt quan trọng:

```c
struct usb_device *dev
```

Con trỏ trỏ tới thiết bị USB (USB device) mà thông điệp điều khiển sẽ được gửi tới.

```c
unsigned int pipe
```

Endpoint cụ thể của thiết bị USB mà thông điệp điều khiển này được gửi đến. Giá trị này được tạo bằng cách gọi hàm *usb\_sndctrlpipe* hoặc *usb\_rcvctrlpipe*.

```c
__u8 request
```

Giá trị yêu cầu USB (USB request value) cho thông điệp điều khiển.

```c
__u8 requesttype
```

Giá trị loại yêu cầu USB (USB request type value) cho thông điệp điều khiển.

\_\_u16 value

Giá trị thông điệp USB (USB message value) cho thông điệp điều khiển.

\_\_u16 index

Giá trị chỉ mục thông điệp USB (USB message index value) cho thông điệp điều khiển.

void \*data

Con trỏ trỏ tới dữ liệu cần gửi đến thiết bị nếu đây là một endpoint OUT. Nếu đây là một endpoint IN, đây là con trỏ trỏ tới vị trí dữ liệu sẽ được lưu sau khi đọc từ thiết bị.

\_\_u16 size

Kích thước của bộ đệm (buffer) được trỏ tới bởi tham số data.

int timeout

Khoảng thời gian, tính bằng jiffies, cần chờ trước khi xảy ra timeout (hết thời gian chờ). Nếu giá trị này bằng 0, hàm sẽ chờ vô thời hạn cho đến khi thông điệp hoàn thành.

Nếu hàm thực thi thành công, nó trả về số byte đã được truyền đến hoặc đi từ thiết bị. Nếu không thành công, nó trả về một số âm biểu diễn mã lỗi.

Các tham số request, requesttype, value và index đều ánh xạ trực tiếp tới đặc tả USB (USB specification) về cách định nghĩa một thông điệp điều khiển USB. Để biết thêm thông tin về các giá trị hợp lệ cho các tham số này và cách chúng được sử dụng, hãy xem Chương 9 của đặc tả USB.

Giống như hàm *usb\_bulk\_msg*, hàm *usb\_control\_msg* không thể được gọi từ ngữ cảnh ngắt (interrupt context) hoặc khi đang giữ một spinlock. Ngoài ra, hàm này không thể bị hủy bởi bất kỳ hàm nào khác, vì vậy hãy cẩn thận khi sử dụng nó; hãy đảm bảo rằng hàm *disconnect* của driver hiểu rõ việc phải đợi lệnh gọi hoàn tất trước khi cho phép chính nó bị gỡ khỏi bộ nhớ (unloaded from memory).

### Các hàm dữ liệu USB khác

Một số hàm hỗ trợ (helper functions) trong nhân USB (USB core) có thể được sử dụng để truy xuất thông tin chuẩn từ tất cả các thiết bị USB. Các hàm này không thể được gọi từ ngữ cảnh ngắt (interrupt context) hoặc khi đang giữ một spinlock.

Hàm *usb\_get\_descriptor* truy xuất descriptor USB được chỉ định từ thiết bị được chỉ định. Hàm này được định nghĩa như sau:

```c
int usb_get_descriptor(struct usb_device *dev, unsigned char type,
 unsigned char index, void *buf, int size);
```

Hàm này có thể được sử dụng bởi một driver USB để truy xuất từ cấu trúc `struct usb_device` bất kỳ descriptor nào của thiết bị mà chưa có sẵn trong các cấu trúc `struct usb_device` và `struct usb_interface` hiện có, chẳng hạn như audio descriptor hoặc thông tin đặc thù của class khác. Các tham số của hàm là:

struct usb\_device \*usb\_dev

Con trỏ trỏ tới thiết bị USB mà descriptor cần được truy xuất từ đó.

unsigned char type

Loại descriptor (descriptor type). Loại này được mô tả trong đặc tả USB và có thể là một trong các loại sau:

`USB_DT_DEVICE`, `USB_DT_CONFIG`

```c
USB_DT_STRING
USB_DT_INTERFACE
USB_DT_ENDPOINT
USB_DT_DEVICE_QUALIFIER
USB_DT_OTHER_SPEED_CONFIG
USB_DT_INTERFACE_POWER
USB_DT_OTG
USB_DT_DEBUG
USB_DT_INTERFACE_ASSOCIATION
USB_DT_CS_DEVICE
USB_DT_CS_CONFIG
USB_DT_CS_STRING
USB_DT_CS_INTERFACE
USB_DT_CS_ENDPOINT
```

unsigned char index

Số thứ tự của descriptor cần được truy xuất từ thiết bị.

void \*buf

Con trỏ trỏ tới bộ đệm (buffer) nơi bạn sao chép descriptor vào.

int size

Kích thước của vùng nhớ được trỏ tới bởi biến buf.

Nếu hàm này thực thi thành công, nó trả về số byte đọc được từ thiết bị. Ngược lại, nó trả về một số âm biểu diễn mã lỗi được trả về từ lệnh gọi cơ sở *usb\_control\_msg* mà hàm này thực hiện.

Một trong những trường hợp sử dụng phổ biến nhất cho lời gọi *usb\_get\_descriptor* là truy xuất một chuỗi (string) từ thiết bị USB. Vì điều này khá phổ biến, nên có một hàm hỗ trợ dành riêng cho nó mang tên *usb\_get\_string*:

```c
int usb_get_string(struct usb_device *dev, unsigned short langid,
 unsigned char index, void *buf, int size);
```

Nếu thành công, hàm này trả về số byte mà thiết bị nhận được cho chuỗi ký tự. Ngược lại, nó trả về một số âm biểu diễn mã lỗi do lệnh gọi cơ sở *usb\_control\_msg* trả về.

Nếu hàm này thực thi thành công, nó trả về một chuỗi được mã hóa theo định dạng UTF-16LE (Unicode, 16 bit cho mỗi ký tự, theo thứ tự byte ít có nghĩa nhất trước - little-endian) nằm trong bộ đệm được trỏ tới bởi tham số buf. Vì định dạng này thường không mấy hữu dụng, nên có một hàm khác mang tên *usb\_string*, có chức năng trả về một chuỗi được đọc từ thiết bị USB và đã được chuyển đổi sẵn sang chuỗi định dạng ISO 8859-1. Bộ ký tự này là tập con 8-bit của Unicode và là định dạng phổ biến nhất cho các chuỗi bằng tiếng Anh và các ngôn ngữ Tây Âu khác. Vì đây thường là định dạng của các chuỗi trên thiết bị USB, bạn nên sử dụng hàm *usb\_string* thay vì hàm *usb\_get\_string*.

## Tài liệu tham khảo nhanh

Phần này tóm tắt các ký hiệu đã được giới thiệu trong chương:

## include <linux/usb.h>

Tệp tiêu đề (Header file) chứa mọi thứ liên quan đến USB. Tất cả các trình điều khiển thiết bị USB (USB device driver) đều phải bao gồm tệp này.

struct usb\_driver;

Cấu trúc mô tả một trình điều khiển USB (USB driver).

struct usb\_device\_id;

Cấu trúc mô tả các loại thiết bị USB mà trình điều khiển này hỗ trợ.

int usb\_register(struct usb\_driver \*d);

void usb\_deregister(struct usb\_driver \*d);

Các hàm được sử dụng để đăng ký và hủy đăng ký một trình điều khiển USB với lõi USB (USB core).

struct usb\_device \*interface\_to\_usbdev(struct usb\_interface \*intf);

Truy xuất con trỏ cấu trúc `struct usb\_device *` từ một cấu trúc `struct usb\_interface *`.

struct usb\_device;

Cấu trúc điều khiển toàn bộ một thiết bị USB.

struct usb\_interface;

Cấu trúc thiết bị USB chính mà tất cả các trình điều khiển USB sử dụng để giao tiếp với lõi USB (USB core).

void usb\_set\_intfdata(struct usb\_interface \*intf, void \*data);

void \*usb\_get\_intfdata(struct usb\_interface \*intf);

Các hàm để thiết lập và lấy quyền truy cập vào vùng con trỏ dữ liệu riêng tư (private data pointer) bên trong cấu trúc `struct usb\_interface`.

struct usb\_class\_driver;

Cấu trúc mô tả một trình điều khiển USB muốn sử dụng số chính (major number) của USB để giao tiếp với các chương trình ở không gian người dùng (user-space programs).

int usb\_register\_dev(struct usb\_interface \*intf, struct usb\_class\_driver \*class\_driver);

void usb\_deregister\_dev(struct usb\_interface \*intf, struct usb\_class\_driver \*class\_driver);

Các hàm được sử dụng để đăng ký và hủy đăng ký một cấu trúc `struct usb\_interface *` cụ thể với một cấu trúc `struct usb\_class\_driver *`.

struct urb;

Cấu trúc mô tả một quá trình truyền dữ liệu USB (USB data transmission).

struct urb \*usb\_alloc\_urb(int iso\_packets, int mem\_flags);

void usb\_free\_urb(struct urb \*urb);

Các hàm được sử dụng để tạo và hủy một cấu trúc `struct urb *`.

```c
int usb_submit_urb(struct urb *urb, int mem_flags);
int usb_kill_urb(struct urb *urb);
int usb_unlink_urb(struct urb *urb);
    Các hàm được sử dụng để bắt đầu và dừng một quá trình truyền dữ liệu USB.
```

void usb\_fill\_int\_urb(struct urb \*urb, struct usb\_device \*dev, unsigned int pipe, void \*transfer\_buffer, int buffer\_length, usb\_complete\_t complete, void \*context, int interval);

void usb\_fill\_bulk\_urb(struct urb \*urb, struct usb\_device \*dev, unsigned int pipe, void \*transfer\_buffer, int buffer\_length, usb\_complete\_t complete, void \*context);

void usb\_fill\_control\_urb(struct urb \*urb, struct usb\_device \*dev, unsigned int pipe, unsigned char \*setup\_packet, void \*transfer\_buffer, int buffer\_length, usb\_complete\_t complete, void \*context);

Các hàm được sử dụng để khởi tạo một `struct urb` trước khi nó được gửi (submit) đến lõi USB (USB core).

int usb\_bulk\_msg(struct usb\_device \*usb\_dev, unsigned int pipe, void \*data, int len, int \*actual\_length, int timeout);

int usb\_control\_msg(struct usb\_device \*dev, unsigned int pipe, \_\_u8 request, \_\_u8 requesttype, \_\_u16 value, \_\_u16 index, void \*data, \_\_u16 size, int timeout);

Các hàm được sử dụng để gửi hoặc nhận dữ liệu USB mà không cần phải sử dụng `struct urb`.
