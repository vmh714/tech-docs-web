# Chương 12: Trình điều khiển PCI

Mặc dù Chương 9 đã giới thiệu các mức điều khiển phần cứng thấp nhất, chương này cung cấp tổng quan về các kiến trúc bus cấp cao hơn. Một bus được cấu thành từ cả giao diện điện (electrical interface) và giao diện lập trình (programming interface). Trong chương này, chúng ta sẽ xử lý giao diện lập trình.

Chương này bao gồm một số kiến trúc bus. Tuy nhiên, trọng tâm chính là các hàm nhân (kernel functions) truy cập các thiết bị ngoại vi Giao tiếp Thành phần Ngoại vi (Peripheral Component Interconnect - PCI), bởi vì ngày nay bus PCI là bus ngoại vi được sử dụng phổ biến nhất trên máy tính để bàn và các máy tính lớn hơn. Đây là loại bus được hỗ trợ tốt nhất bởi nhân (kernel). Chuẩn ISA vẫn còn phổ biến đối với những người có sở thích về điện tử và sẽ được mô tả sau, mặc dù nó gần như là một loại bus "bare-metal" nguyên thủy, và không có nhiều điều để nói thêm ngoài những gì đã được đề cập trong Chương 9 và 10.

Giao diện PCI

Mặc dù nhiều người dùng máy tính coi PCI là một cách bố trí các đường dây điện, nhưng thực chất nó là một tập hợp các thông số kỹ thuật hoàn chỉnh xác định cách các phần khác nhau của máy tính tương tác với nhau.

Thông số kỹ thuật PCI bao phủ hầu hết các vấn đề liên quan đến giao diện máy tính. Chúng ta sẽ không đề cập đến tất cả ở đây; trong phần này, chúng ta chủ yếu quan tâm đến cách một trình điều khiển PCI (PCI driver) có thể tìm thấy phần cứng của nó và giành quyền truy cập vào đó. Các kỹ thuật dò tìm (probing) được thảo luận trong các phần "Tham số Module" (Module Parameters) ở Chương 2 và "Tự động phát hiện Số IRQ" (Autodetecting the IRQ Number) ở Chương 10 có thể được sử dụng với các thiết bị PCI, nhưng thông số kỹ thuật cung cấp một giải pháp thay thế ưu việt hơn so với việc dò tìm.

Kiến trúc PCI được thiết kế nhằm thay thế cho chuẩn ISA, với ba mục tiêu chính: đạt hiệu suất tốt hơn khi truyền dữ liệu giữa máy tính và các thiết bị ngoại vi của nó, đảm bảo tính độc lập nền tảng (platform independent) càng nhiều càng tốt, và đơn giản hóa việc thêm và bớt các thiết bị ngoại vi vào hệ thống.

Bus PCI đạt được hiệu suất tốt hơn bằng cách sử dụng xung nhịp (clock rate) cao hơn so với ISA; xung nhịp của nó chạy ở tần số 25 hoặc 33 MHz (tỷ lệ thực tế của nó là một hệ số của xung nhịp hệ thống), và các phiên bản triển khai 66 MHz thậm chí 133 MHz gần đây cũng đã được đưa vào sử dụng. Hơn nữa, nó được trang bị một bus dữ liệu 32-bit và một phần mở rộng 64-bit đã được bao gồm trong thông số kỹ thuật. Tính độc lập nền tảng thường là một mục tiêu trong thiết kế bus máy tính, và đây là một tính năng đặc biệt quan trọng của PCI, bởi vì thế giới PC từ lâu đã bị thống trị bởi các tiêu chuẩn giao diện phụ thuộc bộ vi xử lý (processor-specific). PCI hiện đang được sử dụng rộng rãi trên các hệ thống IA-32, Alpha, PowerPC, SPARC64 và IA-64, cùng với một số nền tảng khác.

Tuy nhiên, điều có liên quan nhất đối với người viết trình điều khiển (driver writer) là việc PCI hỗ trợ tính năng tự động phát hiện các bo mạch giao diện (autodetection of interface boards). Các thiết bị PCI không dùng jumper (không giống như hầu hết các thiết bị ngoại vi cũ) và được cấu hình tự động khi khởi động (boot time). Sau đó, trình điều khiển thiết bị (device driver) phải có khả năng truy cập thông tin cấu hình trong thiết bị để hoàn tất quá trình khởi tạo (initialization). Quá trình này diễn ra mà không cần phải thực hiện bất kỳ thao tác dò tìm (probing) nào.

## Địa chỉ hóa PCI (PCI Addressing)

Mỗi thiết bị ngoại vi PCI (PCI peripheral) được nhận diện bằng một số hiệu *bus* (bus number), một số hiệu *device* (device number) và một số hiệu *function* (function number). Đặc tả PCI cho phép một hệ thống đơn chứa tối đa 256 bus, nhưng vì 256 bus là không đủ đối với nhiều hệ thống lớn, Linux hiện nay hỗ trợ các *domain* (miền) PCI. Mỗi PCI domain có thể chứa tối đa 256 bus. Mỗi bus chứa tối đa 32 thiết bị, và mỗi thiết bị có thể là một bảng mạch đa chức năng (chẳng hạn như một thiết bị âm thanh đi kèm với ổ đĩa CD-ROM) với tối đa tám chức năng. Do đó, mỗi chức năng có thể được nhận diện ở cấp độ phần cứng bằng một địa chỉ hoặc khóa 16-bit. Tuy nhiên, các device driver được viết cho Linux không cần phải xử lý các địa chỉ nhị phân đó, bởi vì chúng sử dụng một cấu trúc dữ liệu cụ thể gọi là `pci_dev` để thao tác với các thiết bị.

Hầu hết các máy trạm gần đây đều có ít nhất hai PCI bus. Việc cắm nhiều hơn một bus vào một hệ thống đơn được thực hiện thông qua các *bridge* (cầu nối), là các thiết bị ngoại vi PCI chuyên dụng có nhiệm vụ kết nối hai bus lại với nhau. Bố cục tổng thể của một hệ thống PCI là một cấu trúc cây (tree), trong đó mỗi bus được kết nối với một bus tầng trên, lên đến bus 0 ở gốc của cây. Hệ thống thẻ CardBus PC-card cũng được kết nối với hệ thống PCI thông qua các bridge. Một hệ thống PCI điển hình được thể hiện trong Hình 12-1, trong đó các bridge khác nhau được làm nổi bật.

Các địa chỉ phần cứng 16-bit liên kết với các thiết bị ngoại vi PCI, mặc dù phần lớn được ẩn bên trong đối tượng `struct pci_dev`, đôi khi vẫn có thể nhìn thấy được, đặc biệt là khi các danh sách thiết bị đang được sử dụng. Một tình huống như vậy là đầu ra của lệnh *lspci* (một phần của gói *pciutils*, có sẵn với hầu hết các bản phân phối Linux) và bố cục thông tin trong */proc/pci* và */proc/bus/pci*. Biểu diễn sysfs của các thiết bị PCI cũng hiển thị sơ đồ địa chỉ hóa này, bổ sung thêm thông tin PCI domain.\* Khi địa chỉ phần cứng được hiển thị, nó có thể được biểu diễn dưới dạng hai giá trị (số hiệu bus 8-bit và một

Một số kiến trúc cũng hiển thị thông tin PCI domain trong các tệp */proc/pci* và */proc/bus/pci*.

```
Figure: Example PCI-based system topology

+-----------------------+
|        RAM   CPU      |
|    [memory][processor]|
+-----------------------+

The CPU/memory complex is connected to the PCI hierarchy through a
Host Bridge.

CPU / RAM
   |
   v
+-------------+
| Host Bridge |
+-------------+
        |
        +------------------ PCI Bus 0 ---------------------+
        |                                                  |
        v                                                  v
+-------------+                                      +-------------+
| ISA Bridge  |                                      | PCI Bridge |
+-------------+                                      +-------------+
        |                                                  |
        |                                                  +---- PCI Bus 1 ----+
        |                                                  |                    |
  legacy I/O buses                                    PCI devices           PCI devices
  and devices (ISA cards,                            (on bus 1)            (on bus 1)
  serial/parallel, etc.)

        |
        v
+----------------+
| CardBus Bridge |
+----------------+
        |
   CardBus / PCMCIA
   expansion slots (e.g., laptop
   plug-in cards)

On PCI Bus 0, the Host Bridge connects to:
- an ISA Bridge, which in turn connects to traditional legacy peripherals,
- a CardBus Bridge, which connects to CardBus/PCMCIA slots,
- and a PCI Bridge, which creates a secondary PCI Bus 1 hosting more PCI devices.
```

*Hình 12-1. Bố cục của một hệ thống PCI điển hình*

số hiệu thiết bị và chức năng 8-bit), dưới dạng ba giá trị (bus, device và function), hoặc dưới dạng bốn giá trị (domain, bus, device và function); tất cả các giá trị này thường được hiển thị ở hệ cơ số 16 (hexadecimal).

Ví dụ, */proc/bus/pci/devices* sử dụng một trường 16-bit duy nhất (để đơn giản hóa việc phân tích cú pháp và sắp xếp), trong khi */proc/bus/busnumber* tách địa chỉ thành ba trường. Phần sau đây minh họa cách các địa chỉ đó xuất hiện, chỉ hiển thị phần đầu của các dòng kết quả:

```
$ lspci | cut -d: -f1-3
0000:00:00.0 Host bridge
0000:00:00.1 RAM memory
0000:00:00.2 RAM memory
0000:00:02.0 USB Controller
0000:00:04.0 Multimedia audio controller
0000:00:06.0 Bridge
0000:00:07.0 ISA bridge
0000:00:09.0 USB Controller
0000:00:09.1 USB Controller
0000:00:09.2 USB Controller
0000:00:0c.0 CardBus bridge
0000:00:0f.0 IDE interface
0000:00:10.0 Ethernet controller
0000:00:12.0 Network controller
0000:00:13.0 FireWire (IEEE 1394)
0000:00:14.0 VGA compatible controller
$ cat /proc/bus/pci/devices | cut -f1
0000
0001
0002
0010
0020
0030
```

```
0038
0048
0049
004a
0060
0078
0080
0090
0098
```

#### 00a0 \$ **tree /sys/bus/pci/devices/**

```
/sys/bus/pci/devices/
|-- 0000:00:00.0 -> ../../../devices/pci0000:00/0000:00:00.0
|-- 0000:00:00.1 -> ../../../devices/pci0000:00/0000:00:00.1
|-- 0000:00:00.2 -> ../../../devices/pci0000:00/0000:00:00.2
|-- 0000:00:02.0 -> ../../../devices/pci0000:00/0000:00:02.0
|-- 0000:00:04.0 -> ../../../devices/pci0000:00/0000:00:04.0
|-- 0000:00:06.0 -> ../../../devices/pci0000:00/0000:00:06.0
|-- 0000:00:07.0 -> ../../../devices/pci0000:00/0000:00:07.0
|-- 0000:00:09.0 -> ../../../devices/pci0000:00/0000:00:09.0
|-- 0000:00:09.1 -> ../../../devices/pci0000:00/0000:00:09.1
|-- 0000:00:09.2 -> ../../../devices/pci0000:00/0000:00:09.2
|-- 0000:00:0c.0 -> ../../../devices/pci0000:00/0000:00:0c.0
|-- 0000:00:0f.0 -> ../../../devices/pci0000:00/0000:00:0f.0
|-- 0000:00:10.0 -> ../../../devices/pci0000:00/0000:00:10.0
|-- 0000:00:12.0 -> ../../../devices/pci0000:00/0000:00:12.0
|-- 0000:00:13.0 -> ../../../devices/pci0000:00/0000:00:13.0
`-- 0000:00:14.0 -> ../../../devices/pci0000:00/0000:00:14.0
```

Tất cả ba danh sách thiết bị đều được sắp xếp theo cùng một thứ tự, vì *lspci* sử dụng các tệp trong thư mục */proc* làm nguồn thông tin của nó. Lấy bộ điều khiển video VGA làm ví dụ, 0x00a0 có nghĩa là 0000:00:14.0 khi được chia thành domain (miền - 16 bit), bus (8 bit), device (thiết bị - 5 bit) và function (chức năng - 3 bit).

Mạch phần cứng của từng bo mạch ngoại vi (peripheral board) phản hồi các truy vấn liên quan đến ba không gian địa chỉ (address space): các vị trí bộ nhớ (memory location), cổng I/O (I/O port), và thanh ghi cấu hình (configuration register). Hai không gian địa chỉ đầu tiên được chia sẻ bởi tất cả các thiết bị trên cùng một bus PCI (nghĩa là, khi bạn truy cập một vị trí bộ nhớ, tất cả các thiết bị trên bus PCI đó sẽ thấy chu kỳ bus tại cùng một thời điểm). Ngược lại, không gian cấu hình khai thác tính năng *địa chỉ hóa theo vị trí địa lý* (geographical addressing). Các truy vấn cấu hình chỉ nhắm tới một khe cắm (slot) tại một thời điểm, do đó chúng không bao giờ xung đột.

Đối với driver, các vùng nhớ và I/O được truy cập theo các cách thông thường thông qua *inb*, *readb*, v.v. Ngược lại, các giao dịch cấu hình (configuration transaction) được thực hiện bằng cách gọi các hàm kernel (kernel function) cụ thể để truy cập các thanh ghi cấu hình. Về ngắt (interrupt), mọi khe cắm PCI đều có bốn chân ngắt (interrupt pin) và mỗi chức năng của thiết bị (device function) có thể sử dụng một trong các chân đó mà không cần quan tâm đến cách các chân đó được định tuyến (route) tới CPU. Việc định tuyến này là trách nhiệm của nền tảng máy tính (computer platform) và được thực hiện bên ngoài bus PCI. Vì đặc tả PCI yêu cầu các đường ngắt có thể được chia sẻ (shareable), nên ngay cả một bộ xử lý có số lượng đường IRQ hạn chế, chẳng hạn như x86, cũng có thể chứa nhiều bo mạch giao tiếp PCI (mỗi bo mạch có bốn chân ngắt).

Không gian I/O trong bus PCI sử dụng bus địa chỉ 32-bit (dẫn đến 4 GB cổng I/O), trong khi không gian bộ nhớ có thể được truy cập bằng địa chỉ 32-bit hoặc 64-bit. Địa chỉ 64-bit khả dụng trên các nền tảng mới hơn. Các địa chỉ được cho là duy nhất đối với một thiết bị, nhưng phần mềm có thể cấu hình nhầm lẫn hai thiết bị vào cùng một địa chỉ, khiến cho việc truy cập vào cả hai đều là bất khả thi. Tuy nhiên, sự cố này không bao giờ xảy ra trừ khi một driver cố ý can thiệp vào các thanh ghi mà lẽ ra nó không được chạm vào. Tin vui là mọi vùng địa chỉ bộ nhớ và I/O do bo mạch giao tiếp cung cấp đều có thể được ánh xạ lại (remap) thông qua các giao dịch cấu hình. Tức là, firmware khởi tạo phần cứng PCI khi hệ thống khởi động (system boot), ánh xạ mỗi vùng tới một địa chỉ khác nhau để tránh xung đột.\* Các địa chỉ mà các vùng này hiện đang được ánh xạ tới có thể được đọc từ không gian cấu hình, vì vậy driver Linux có thể truy cập các thiết bị của nó mà không cần dò tìm (probe). Sau khi đọc các thanh ghi cấu hình, driver có thể truy cập phần cứng của mình một cách an toàn.

Không gian cấu hình PCI bao gồm 256 byte cho mỗi chức năng thiết bị (ngoại trừ các thiết bị PCI Express, có 4 KB không gian cấu hình cho mỗi chức năng), và bố cục (layout) của các thanh ghi cấu hình được tiêu chuẩn hóa. Bốn byte của không gian cấu hình chứa một ID chức năng duy nhất, vì vậy driver có thể nhận dạng thiết bị của mình bằng cách tìm kiếm ID cụ thể cho thiết bị ngoại vi đó.† Tóm lại, mỗi bo mạch thiết bị được định địa chỉ theo vị trí địa lý để truy xuất các thanh ghi cấu hình của nó; thông tin trong các thanh ghi đó sau đó có thể được sử dụng để thực hiện truy cập I/O thông thường, mà không cần thêm việc định địa chỉ theo vị trí địa lý nào nữa.

Từ mô tả này, có thể thấy rõ rằng sự đổi mới chính của tiêu chuẩn giao diện PCI so với ISA chính là không gian địa chỉ cấu hình. Do đó, ngoài mã nguồn driver thông thường, một driver PCI cần có khả năng truy cập không gian cấu hình, nhằm tự cứu mình khỏi các tác vụ dò tìm (probing) rủi ro.

Trong phần còn lại của chương này, chúng tôi sử dụng từ *device* (thiết bị) để chỉ một chức năng thiết bị (device function), bởi vì mỗi chức năng trong một bo mạch đa chức năng (multifunction board) hoạt động như một thực thể độc lập. Khi chúng tôi đề cập đến một thiết bị, ý chúng tôi là bộ tuple (bộ giá trị) "số domain, số bus, số thiết bị và số chức năng" (domain number, bus number, device number, và function number).

### Thời điểm khởi động (Boot Time)

Để xem PCI hoạt động như thế nào, chúng ta bắt đầu từ quá trình khởi động hệ thống (system boot), vì đó là thời điểm các thiết bị được cấu hình.

- \* Trên thực tế, việc cấu hình đó không bị giới hạn ở thời điểm hệ thống khởi động; ví dụ, các thiết bị có tính năng cắm nóng (hotpluggable), không thể sẵn sàng tại thời điểm khởi động mà sẽ xuất hiện sau đó. Điểm chính ở đây là trình điều khiển thiết bị (device driver) không được phép thay đổi địa chỉ của các vùng I/O hoặc bộ nhớ (memory regions).
- † Bạn sẽ tìm thấy ID của bất kỳ thiết bị nào trong tài liệu phần cứng của chính nó. Một danh sách được bao gồm trong tệp *pci.ids*, là một phần của gói *pciutils* và mã nguồn nhân (kernel sources); nó không cố gắng đầy đủ hoàn toàn mà chỉ liệt kê các nhà vendor và thiết bị nổi tiếng nhất. Phiên bản nhân của tệp này sẽ không được bao gồm trong các dòng kernel (kernel series) trong tương lai.

Khi cấp nguồn cho một thiết bị PCI, phần cứng vẫn ở trạng thái không hoạt động (inactive). Nói cách khác, thiết bị chỉ phản hồi các giao dịch cấu hình (configuration transactions). Khi bật nguồn, thiết bị chưa có bộ nhớ và chưa có cổng I/O nào được ánh xạ (mapped) vào không gian địa chỉ (address space) của máy tính; mọi tính năng đặc thù khác của thiết bị, chẳng hạn như báo cáo ngắt (interrupt reporting), cũng đồng thời bị vô hiệu hóa.

May mắn thay, mọi bo mạch chủ (motherboard) PCI đều được trang bị phầnfirmware nhận biết PCI, được gọi là BIOS, NVRAM hoặc PROM, tùy thuộc vào nền tảng. Firmware này cung cấp quyền truy cập vào không gian địa chỉ cấu hình thiết bị (device configuration address space) bằng cách đọc và ghi các thanh ghi (registers) trong bộ điều khiển (controller) PCI.

Khi hệ thống khởi động, firmware (hoặc Linux kernel, nếu được cấu hình như vậy) thực hiện các giao dịch cấu hình với mọi thiết bị ngoại vi PCI nhằm cấp phát một vị trí an toàn cho từng vùng địa chỉ mà thiết bị đó cung cấp. Vào thời điểm trình điều khiển thiết bị (device driver) truy cập thiết bị, các vùng bộ nhớ và I/O của nó đã được ánh xạ vào không gian địa chỉ của bộ vi xử lý (processor's address space). Trình điều khiển có thể thay đổi phân bổ mặc định này, nhưng nó không bao giờ cần phải làm điều đó.

Như đã gợi ý, người dùng có thể xem danh sách thiết bị PCI và các thanh ghi cấu hình của thiết bị bằng cách đọc */proc/bus/pci/devices* và */proc/bus/pci/\*/\**. Tệp đầu tiên là một tệp văn bản chứa thông tin thiết bị (dưới dạng thập lục phân), và các tệp sau là các tệp nhị phân báo cáo một ảnh chụp nhanh (snapshot) của các thanh ghi cấu hình của từng thiết bị, mỗi tệp tương ứng với một thiết bị. Các thư mục thiết bị PCI riêng lẻ trong cây sysfs có thể được tìm thấy tại */sys/bus/pci/devices*. Một thư mục thiết bị PCI chứa một số tệp khác nhau:

#### \$ **tree /sys/bus/pci/devices/0000:00:10.0**

/sys/bus/pci/devices/0000:00:10.0

- |-- class
- |-- config
- |-- detach\_state
- |-- device
- |-- irq
- |-- power
- | `-- state
- |-- resource
- |-- subsystem\_device
- |-- subsystem\_vendor
- `-- vendor

Tệp *config* là một tệp nhị phân cho phép đọc thông tin cấu hình PCI thô (raw) từ thiết bị (giống như cách mà */proc/bus/pci/\*/\** cung cấp). Các tệp *vendor*, *device*, *subsystem\_device*, *subsystem\_vendor* và *class* đều đề cập đến các giá trị cụ thể của thiết bị PCI này (tất cả các thiết bị PCI đều cung cấp thông tin này). Tệp *irq* hiển thị IRQ hiện tại được gán cho thiết bị PCI này, và tệp *resource* hiển thị các tài nguyên bộ nhớ hiện tại được cấp phát bởi thiết bị này.

### Các thanh ghi cấu hình và quá trình khởi tạo (Configuration Registers and Initialization)

Trong phần này, chúng ta sẽ tìm hiểu về các thanh ghi cấu hình (configuration registers) mà các thiết bị PCI chứa đựng. Tất cả các thiết bị PCI đều có ít nhất một không gian địa chỉ (address space) 256 byte. 64 byte đầu tiên được chuẩn hóa, trong khi phần còn lại phụ thuộc vào từng thiết bị (device dependent). Hình 12-2 minh họa bố cục của không gian cấu hình độc lập với thiết bị (device-independent configuration space).

```
Offset 0x00
0x00  +----------------+----------------+
      |   Vendor ID    |   Device ID    |
      +----------------+----------------+

0x04  +----------------+----------------+
      | Command Reg    | Status Reg     |
      +----------------+----------------+

0x08  +--------+--------+---------------+
      | Rev ID |  Prog  |  Subclass     |
      |        |  IF    |               |
      +--------+--------+---------------+
                \_______ Class Code _____/

0x0C  +--------+--------+-------------+--------+
      | Cache  | Latency| Header Type |  BIST  |
      | Line   | Timer  |             |        |
      +--------+--------+-------------+--------+
      
Offset 0x10 – Base Address Registers (BARs)
0x10  +----------------------+
      |   Base Address 0     |
      +----------------------+

0x14  +----------------------+
      |   Base Address 1     |
      +----------------------+

0x18  +----------------------+
      |   Base Address 2     |
      +----------------------+

0x1C  +----------------------+
      |   Base Address 3     |
      +----------------------+

0x20  +----------------------+
      |   Base Address 4     |
      +----------------------+

0x24  +----------------------+
      |   Base Address 5     |
      +----------------------+

Offset 0x28
0x28  +----------------------+
      |  CardBus CIS Pointer |
      +----------------------+    

Offset 0x2C
0x2C  +----------------+----------------+
      | Subsystem      | Subsystem      |
      | Vendor ID      | Device ID      |
      +----------------+----------------+
Offset 0x30
0x30  +----------------------+
      | Expansion ROM Base   |
      | Address              |
      +----------------------+
Offset 0x34 – 0x37
0x34  +----------------------+
      | Reserved / Cap Ptr   |
      +----------------------+
      
Offset 0x38
0x38  +--------+--------+--------+--------+
      | IRQ    | IRQ    | Min_Gnt| Max_Lat|
      | Line   | Pin    |        |        |
      +--------+--------+--------+--------+
```

Hình 12-2. Các thanh ghi cấu hình PCI được chuẩn hóa

Như hình vẽ đã cho thấy, một số thanh ghi cấu hình PCI là bắt buộc (required) và một số là tùy chọn (optional). Mọi thiết bị PCI phải chứa các giá trị có ý nghĩa trong các thanh ghi bắt buộc, trong khi nội dung của các thanh ghi tùy chọn phụ thuộc vào các tính năng thực tế của thiết bị ngoại vi (peripheral). Các trường tùy chọn (optional fields) không được sử dụng trừ khi nội dung của các trường bắt buộc cho biết chúng hợp lệ. Do đó, các trường bắt buộc xác định các khả năng của bo mạch (board's capabilities), bao gồm cả việc liệu các trường khác có sử dụng được hay không.

Thật thú vị khi lưu ý rằng các thanh ghi PCI luôn có thứ tự byte thấp trước (little-endian). Mặc dù tiêu chuẩn được thiết kế để độc lập với kiến trúc (architecture independent), các nhà thiết kế PCI đôi khi thể hiện sự thiên vị nhẹ đối với môi trường PC. Lập trình viên viết trình điều khiển (driver writer) nên cẩn thận về thứ tự byte (byte ordering) khi truy cập các thanh ghi cấu hình nhiều byte (multibyte configuration registers); mã nguồn chạy trên PC có thể không hoạt động trên các nền tảng khác. Các nhà phát triển Linux đã xử lý vấn đề thứ tự byte (xem phần tiếp theo, "Truy cập không gian cấu hình" - *Accessing the Configuration Space*), nhưng vấn đề này phải luôn được ghi nhớ. Nếu bạn cần chuyển đổi dữ liệu từ thứ tự của hệ thống chủ (host order) sang thứ tự PCI hoặc ngược lại, bạn có thể sử dụng các hàm được định nghĩa trong *<asm/byteorder.h>*, đã được giới thiệu ở Chương 11, với lưu ý rằng thứ tự byte của PCI là little-endian.

Việc mô tả tất cả các mục cấu hình nằm ngoài phạm vi của cuốn sách này. Thông thường, tài liệu kỹ thuật đi kèm với mỗi thiết bị sẽ mô tả các thanh ghi được hỗ trợ. Điều mà chúng ta quan tâm là làm thế nào một trình điều khiển (driver) có thể tìm kiếm thiết bị của nó và cách thức nó có thể truy cập không gian cấu hình của thiết bị.

Ba hoặc năm thanh ghi PCI xác định một thiết bị: `vendorID`, `deviceID`, và `class` là ba thanh ghi luôn được sử dụng. Mỗi nhà sản xuất PCI gán các giá trị thích hợp cho các thanh ghi chỉ đọc (read-only) này và trình điều khiển có thể sử dụng chúng để tìm kiếm thiết bị. Ngoài ra, các trường `subsystem vendorID` và `subsystem deviceID` đôi khi được thiết lập bởi nhà sản xuất để phân biệt rõ hơn các thiết bị tương tự nhau.

Hãy cùng xem xét các thanh ghi này một cách chi tiết hơn:

#### vendorID

Thanh ghi 16-bit này xác định nhà sản xuất phần cứng (hardware manufacturer). Ví dụ, mọi thiết bị của Intel đều được đánh dấu bằng cùng một mã nhà sản xuất là `0x8086`. Có một cơ quan đăng ký toàn cầu cho các số này, được duy trì bởi nhóm PCI Special Interest Group, và các nhà sản xuất phải đăng ký để được cấp một số duy nhất.

#### deviceID

Đây là một thanh ghi 16-bit khác, do nhà sản xuất lựa chọn; không bắt buộc phải đăng ký chính thức đối với mã định danh thiết bị (device ID). ID này thường được ghép nối với `vendorID` để tạo thành một định danh 32-bit duy nhất cho một thiết bị phần cứng. Chúng ta sử dụng thuật ngữ *chữ ký* (*signature*) để chỉ cặp `vendorID` và `deviceID`. Trình điều khiển thiết bị thường dựa vào chữ ký này để nhận dạng thiết bị của nó; bạn có thể tìm giá trị cần tìm trong tài liệu phần cứng của thiết bị đích.

#### class

Mọi thiết bị ngoại vi đều thuộc về một *class* (lớp). Thanh ghi class là một giá trị 16-bit mà 8 bit cao xác định "base class" (lớp cơ sở) (hoặc *group* [nhóm]). Ví dụ, "ethernet" và "token ring" là hai class thuộc về nhóm "network" (mạng), trong khi các class "serial" (nối tiếp) và "parallel" (song song) thuộc về nhóm "communication" (truyền thông). Một số driver (trình điều khiển) có thể hỗ trợ nhiều thiết bị tương tự nhau, mỗi thiết bị mang một chữ ký (signature) khác nhau nhưng tất cả đều thuộc cùng một class; các driver này có thể dựa vào thanh ghi class để nhận diện thiết bị ngoại vi của chúng, như sẽ được minh họa ở phần sau.

### subsystem vendorID

#### subsystem deviceID

Các trường này có thể được sử dụng để nhận diện thiết bị chi tiết hơn. Nếu chip là một chip giao diện tổng quát kết nối với bus cục bộ (trên bo mạch - onboard), nó thường được sử dụng trong một số vai trò hoàn toàn khác nhau, và driver phải xác định thiết bị thực tế mà nó đang giao tiếp. Các bộ nhận diện subsystem (hệ thống con) được sử dụng cho mục đích này.

Sử dụng các định danh khác nhau này, một PCI driver có thể cho kernel (nhân) biết loại thiết bị mà nó hỗ trợ. Cấu trúc `struct pci_device_id` được sử dụng để định nghĩa một danh sách các loại thiết bị PCI khác nhau mà driver hỗ trợ. Cấu trúc này chứa các trường sau:

```
__u32 vendor;
__u32 device;
```

Các trường này chỉ định ID nhà cung cấp (vendor) và thiết bị (device) PCI của một thiết bị. Nếu một driver có thể xử lý bất kỳ ID vendor hoặc device nào, giá trị `PCI_ANY_ID` nên được sử dụng cho các trường này.

```
__u32 subvendor;
```

\_\_u32 subdevice;

Các trường này chỉ định ID vendor hệ thống con (subsystem vendor) và ID thiết bị hệ thống con (subsystem device) của một thiết bị. Nếu một driver có thể xử lý bất kỳ loại ID subsystem nào, giá trị `PCI_ANY_ID` nên được sử dụng cho các trường này.

```
__u32 class;
__u32 class_mask;
```

Hai giá trị này cho phép driver chỉ định rằng nó hỗ trợ một loại thiết bị PCI class. Các class thiết bị PCI khác nhau (ví dụ như bộ điều khiển VGA) được mô tả trong đặc tả PCI. Nếu một driver có thể xử lý bất kỳ loại ID subsystem nào, giá trị `PCI_ANY_ID` nên được sử dụng cho các trường này.

```
kernel_ulong_t driver_data;
```

Giá trị này không được sử dụng để khớp (match) thiết bị mà được dùng để lưu trữ thông tin giúp PCI driver có thể phân biệt giữa các thiết bị khác nhau nếu nó muốn.

Có hai macro hỗ trợ nên được sử dụng để khởi tạo cấu trúc `struct pci_device_id`:

```
PCI_DEVICE(vendor, device)
```

Macro này tạo ra một `struct pci_device_id` chỉ khớp với một ID vendor và device cụ thể. Macro này thiết lập các trường subvendor và subdevice của cấu trúc thành `PCI_ANY_ID`.

```
PCI_DEVICE_CLASS(device_class, device_class_mask)
```

Macro này tạo ra một `struct pci_device_id` khớp với một PCI class cụ thể.

Ví dụ về việc sử dụng các macro này để định nghĩa loại thiết bị mà một driver hỗ trợ có thể được tìm thấy trong các tệp kernel sau:

```
drivers/usb/host/ehci-hcd.c:
```

drivers/i2c/busses/i2c-i810.c:

```
static const struct pci_device_id pci_ids[ ] = { {
 /* xử lý bất kỳ bộ điều khiển USB 2.0 EHCI nào */
 PCI_DEVICE_CLASS(((PCI_CLASS_SERIAL_USB << 8) | 0x20), ~0),
 .driver_data = (unsigned long) &ehci_driver,
 },
 { /* kết thúc: tất cả là số không */ }
};
```

```
static struct pci_device_id i810_ids[ ] = {
 { PCI_DEVICE(PCI_VENDOR_ID_INTEL, PCI_DEVICE_ID_INTEL_82810_IG1) },
 { PCI_DEVICE(PCI_VENDOR_ID_INTEL, PCI_DEVICE_ID_INTEL_82810_IG3) },
 { PCI_DEVICE(PCI_VENDOR_ID_INTEL, PCI_DEVICE_ID_INTEL_82810E_IG) },
 { PCI_DEVICE(PCI_VENDOR_ID_INTEL, PCI_DEVICE_ID_INTEL_82815_CGC) },
 { PCI_DEVICE(PCI_VENDOR_ID_INTEL, PCI_DEVICE_ID_INTEL_82845G_IG) },
 { 0, },
};
```

Các ví dụ này tạo ra một danh sách các cấu trúc `struct pci_device_id`, với một cấu trúc trống được thiết lập toàn bộ là số không làm giá trị cuối cùng trong danh sách. Mảng ID này được sử dụng trong `struct pci_driver` (được mô tả bên dưới), và nó cũng được dùng để thông báo cho không gian người dùng (`user space`) biết những thiết bị nào mà driver cụ thể này hỗ trợ.

### MODULE\_DEVICE\_TABLE

Cấu trúc `pci_device_id` này cần phải được xuất ra không gian người dùng (User Space) để cho phép các hệ thống hotplug (nóng) và tải module (module loading) biết được module nào hoạt động với thiết bị phần cứng nào. Macro `MODULE_DEVICE_TABLE` thực hiện điều này. Một ví dụ cụ thể:

```
MODULE_DEVICE_TABLE(pci, i810_ids);
```

Câu lệnh này tạo ra một biến cục bộ có tên là `__mod_pci_device_table` trỏ đến danh sách các `struct pci_device_id`. Sau đó trong quá trình biên dịch nhân (kernel build process), chương trình `depmod` sẽ tìm kiếm trong tất cả các module để tìm ký hiệu (symbol) `__mod_pci_device_table`. Nếu tìm thấy ký hiệu đó, nó sẽ trích xuất dữ liệu từ module và thêm vào tệp */lib/modules/ KERNEL_VERSION/modules.pcimap*. Sau khi `depmod` hoàn tất, tất cả các thiết bị PCI được hỗ trợ bởi các module trong kernel sẽ được liệt kê, cùng với tên module của chúng, trong tệp đó. Khi kernel thông báo cho hệ thống hotplug rằng một thiết bị PCI mới đã được tìm thấy, hệ thống hotplug sẽ sử dụng tệp *modules.pcimap* để tìm driver thích hợp cần tải.

### Đăng ký một PCI Driver

Cấu trúc chính mà tất cả các PCI driver phải tạo để được đăng ký đúng cách với kernel là cấu trúc `struct pci_driver`. Cấu trúc này bao gồm một số hàm gọi lại (function callbacks) và các biến mô tả PCI driver cho PCI core. Dưới đây là các trường trong cấu trúc này mà một PCI driver cần phải nắm rõ:

```
const char *name;
```

Tên của driver. Nó phải là duy nhất trong số tất cả các PCI driver trong kernel và thường được đặt giống với tên module của driver. Nó xuất hiện trong sysfs tại đường dẫn */sys/bus/pci/drivers/* khi driver được nạp vào kernel.

```
const struct pci_device_id *id_table;
```

Con trỏ trỏ tới bảng `struct pci_device_id` được mô tả ở phần trước trong chương này.

int (\*probe) (struct pci\_dev \*dev, const struct pci\_device\_id \*id);

Con trỏ trỏ tới hàm `probe` trong PCI driver. Hàm này được gọi bởi PCI core khi nó có một `struct pci_dev` mà nó cho rằng driver này muốn điều khiển. Một con trỏ trỏ tới `struct pci_device_id` mà PCI core sử dụng để đưa ra quyết định này cũng được truyền vào hàm này. Nếu PCI driver nhận quản lý `struct pci_dev` được truyền tới nó, nó nên khởi tạo thiết bị đúng cách và trả về 0. Nếu driver không muốn nhận quản lý thiết bị, hoặc xảy ra lỗi, nó nên trả về một giá trị lỗi âm. Chi tiết hơn về hàm này sẽ được trình bày ở phần sau của chương này.

void (\*remove) (struct pci\_dev \*dev);

Con trỏ trỏ tới hàm mà PCI core gọi khi `struct pci_dev` chuẩn bị bị gỡ bỏ khỏi hệ thống, hoặc khi PCI driver đang bị gỡ khỏi kernel. Chi tiết hơn về hàm này sẽ được trình bày ở phần sau của chương này.

int (\*suspend) (struct pci\_dev \*dev, u32 state);

Con trỏ trỏ tới hàm mà PCI core gọi khi `struct pci_dev` chuẩn bị chuyển sang trạng thái tạm nghỉ (suspend). Trạng thái suspend được truyền vào qua biến `state`. Hàm này là tùy chọn; driver không bắt buộc phải cung cấp nó.

int (\*resume) (struct pci\_dev \*dev);

Con trỏ trỏ tới hàm mà PCI core gọi khi `struct pci_dev` chuẩn bị tiếp tục hoạt động (resume). Nó luôn được gọi sau khi hàm `suspend` đã được gọi. Hàm này là tùy chọn; driver không bắt buộc phải cung cấp nó.

Tóm lại, để tạo một `struct pci_driver` hoàn chỉnh, chỉ cần khởi tạo bốn trường:

```
static struct pci_driver pci_driver = {
 .name = "pci_skel",
 .id_table = ids,
 .probe = probe,
 .remove = remove,
};
```

Để đăng ký `struct pci_driver` với PCI core, một lời gọi đến `pci_register_driver` được thực hiện với một con trỏ trỏ tới `struct pci_driver`. Việc này theo truyền thống được thực hiện trong mã nguồn khởi tạo module của PCI driver:

```
static int __init pci_skel_init(void)
{
 return pci_register_driver(&pci_driver);
}
```

Lưu ý rằng hàm `pci_register_driver` trả về một số âm biểu thị lỗi hoặc trả về 0 nếu mọi thứ được đăng ký thành công. Nó không trả về số lượng thiết bị đã được liên kết (bound) với driver hoặc số lỗi nếu không có thiết bị nào được liên kết với driver. Đây là một thay đổi so với các phiên bản kernel trước bản phát hành 2.6 và được thực hiện do các tình huống sau:

- Trên các hệ thống hỗ trợ PCI hotplug, hoặc các hệ thống CardBus, một thiết bị PCI có thể xuất hiện hoặc biến mất tại bất kỳ thời điểm nào. Sẽ rất hữu ích nếu các driver có thể được tải trước khi thiết bị xuất hiện, nhằm giảm thời gian cần thiết để khởi tạo thiết bị.
- Kernel 2.6 cho phép các ID PCI mới được cấp phát động cho một driver sau khi nó đã được tải. Điều này được thực hiện thông qua tệp `new_id` được tạo trong tất cả các thư mục PCI driver trong sysfs. Tính năng này vô cùng hữu ích nếu một thiết bị mới đang được sử dụng mà kernel chưa nhận biết được tại thời điểm đó. Người dùng có thể ghi các giá trị ID PCI vào tệp `new_id`, và sau đó driver sẽ liên kết với thiết bị mới đó. Nếu một driver không được phép tải cho đến khi thiết bị thực sự có mặt trong hệ thống, giao diện này sẽ không thể hoạt động được.

Khi driver PCI được gỡ tải (unload), cấu trúc `struct pci_driver` cần phải được hủy đăng ký (unregister) khỏi kernel. Việc này được thực hiện bằng cách gọi hàm *pci\_unregister\_driver*. Khi lời gọi này diễn ra, bất kỳ thiết bị PCI nào đang liên kết (bind) với driver này sẽ bị gỡ bỏ, và hàm *remove* của driver PCI đó sẽ được gọi trước khi hàm *pci\_unregister\_driver* trả về.

```
static void __exit pci_skel_exit(void)
{
 pci_unregister_driver(&pci_driver);
}
```

### Thăm dò PCI kiểu cũ (Old-Style PCI Probing)

Ở các phiên bản kernel cũ, hàm *pci\_register\_driver* không phải lúc nào cũng được sử dụng bởi các driver PCI. Thay vào đó, chúng hoặc sẽ tự duyệt qua danh sách các thiết bị PCI trong hệ thống bằng tay, hoặc sẽ gọi một hàm có khả năng tìm kiếm một thiết bị PCI cụ thể. Khả năng tự duyệt qua danh sách các thiết bị PCI trong hệ thống bên trong một driver đã bị loại bỏ khỏi kernel 2.6 nhằm ngăn chặn các driver làm crash kernel (kernel oops) trong trường hợp chúng vô tình sửa đổi danh sách thiết bị PCI trong khi một thiết bị đang đồng thời bị gỡ bỏ.

Nếu thực sự cần khả năng tìm kiếm một thiết bị PCI cụ thể, các hàm sau đây có sẵn để sử dụng:

```
struct pci_dev *pci_get_device(unsigned int vendor, unsigned int device,
 struct pci_dev *from);
```

Hàm này quét danh sách các thiết bị PCI hiện có trong hệ thống, và nếu các đối số đầu vào khớp với các ID vendor và device được chỉ định, nó sẽ tăng bộ đếm tham chiếu (reference count) trên biến `struct pci_dev` tìm được, và trả về nó cho bên gọi. Điều này ngăn cấu trúc không bị biến mất mà không có thông báo nào và đảm bảo rằng kernel không bị lỗi oops. Sau khi driver hoàn tất việc sử dụng `struct pci_dev` do hàm trả về, nó phải gọi hàm *pci\_dev\_put* để giảm

số lượng sử dụng xuống một cách chính xác nhằm cho phép kernel dọn dẹp thiết bị nếu nó bị gỡ bỏ.

Đối số `from` được sử dụng để nắm giữ nhiều thiết bị có cùng chữ ký (signature); đối số này nên trỏ đến thiết bị cuối cùng được tìm thấy, để quá trình tìm kiếm có thể tiếp tục thay vì khởi động lại từ đầu danh sách. Để tìm thiết bị đầu tiên, `from` được chỉ định là `NULL`. Nếu không tìm thấy thiết bị nào (nữa), `NULL` sẽ được trả về.

Một ví dụ về cách sử dụng hàm này đúng cách là:

```
struct pci_dev *dev;
dev = pci_get_device(PCI_VENDOR_FOO, PCI_DEVICE_FOO, NULL);
if (dev) {
 /* Sử dụng thiết bị PCI */
 ...
 pci_dev_put(dev);
}
```

Hàm này không thể được gọi từ ngữ cảnh ngắt (interrupt context). Nếu được gọi từ đó, một cảnh báo sẽ được in ra nhật ký hệ thống (system log).

```
struct pci_dev *pci_get_subsys(unsigned int vendor, unsigned int device,
 unsigned int ss_vendor, unsigned int ss_device, struct pci_dev *from);
```

Hàm này hoạt động giống như *pci\_get\_device*, nhưng nó cho phép chỉ định các ID subsystem vendor và subsystem device khi tìm kiếm thiết bị.

Hàm này không thể được gọi từ ngữ cảnh ngắt (interrupt context). Nếu được gọi từ đó, một cảnh báo sẽ được in ra nhật ký hệ thống (system log).

```
struct pci_dev *pci_get_slot(struct pci_bus *bus, unsigned int devfn);
```

Hàm này tìm kiếm trong danh sách các thiết bị PCI của hệ thống trên `struct pci_bus` được chỉ định để tìm thiết bị PCI và số hàm (function number) tương ứng. Nếu tìm thấy một thiết bị khớp, bộ đếm tham chiếu của nó sẽ được tăng lên và một con trỏ trỏ tới nó sẽ được trả về. Khi bên gọi đã truy cập xong `struct pci_dev`, họ phải gọi *pci\_dev\_put*.

Tất cả các hàm này không thể được gọi từ ngữ cảnh ngắt (interrupt context). Nếu chúng được gọi, một cảnh báo sẽ được in ra nhật ký hệ thống (system log).

## Kích hoạt Thiết bị PCI (Enabling the PCI Device)

Trong hàm *probe* của PCI driver (trình điều khiển thiết bị PCI), trước khi driver có thể truy cập bất kỳ tài nguyên thiết bị nào (vùng I/O hoặc ngắt - interrupt) của thiết bị PCI, driver phải gọi hàm *pci\_enable\_device*:

```
int pci_enable_device(struct pci_dev *dev);
```

Hàm này thực sự kích hoạt thiết bị (enable the device). Nó đánh thức thiết bị dậy và trong một số trường hợp cũng gán đường ngắt (interrupt line) cùng các vùng I/O của thiết bị đó. Điều này xảy ra, ví dụ, với các thiết bị CardBus (những thiết bị đã được làm cho hoàn toàn tương đương với PCI ở cấp độ driver).

### Truy cập Không gian Cấu hình (Accessing the Configuration Space)

Sau khi driver đã phát hiện ra thiết bị, nó thường cần đọc hoặc ghi vào ba không gian địa chỉ (address spaces): bộ nhớ (memory), cổng (port), và cấu hình (configuration). Đặc biệt, việc truy cập không gian cấu hình (configuration space) đóng vai trò cực kỳ quan trọng đối với driver, bởi vì đó là cách duy nhất để nó tìm ra vị trí thiết bị được ánh xạ (mapped) trong bộ nhớ và trong không gian I/O.

Vì bộ vi xử lý không có cách nào để truy cập trực tiếp vào không gian cấu hình, nhà sản xuất máy tính phải cung cấp một cơ chế để thực hiện việc này. Để truy cập không gian cấu hình, CPU phải đọc và ghi các thanh ghi (registers) trong bộ điều khiển PCI (PCI controller), nhưng việc cài đặt chính xác sẽ phụ thuộc vào nhà vendor (nhà cung cấp) và không liên quan đến thảo luận này, bởi vì Linux cung cấp một giao diện chuẩn để truy cập không gian cấu hình.

Đối với driver, không gian cấu hình có thể được truy cập thông qua các thao tác truyền dữ liệu (data transfers) 8-bit, 16-bit, hoặc 32-bit. Các hàm liên quan được khai báo nguyên mẫu (prototyped) trong *<linux/pci.h>*:

```
int pci_read_config_byte(struct pci_dev *dev, int where, u8 *val);
int pci_read_config_word(struct pci_dev *dev, int where, u16 *val);
int pci_read_config_dword(struct pci_dev *dev, int where, u32 *val);
```

Đọc một, hai, hoặc bốn byte từ không gian cấu hình của thiết bị được xác định bởi `dev`. Đối số `where` là độ lệch byte (byte offset) tính từ phần đầu của không gian cấu hình. Giá trị lấy ra từ không gian cấu hình được trả về thông qua con trỏ `val`, và giá trị trả về của các hàm là một mã lỗi (error code). Các hàm *word* và *dword* chuyển đổi giá trị vừa đọc từ định dạng little-endian sang thứ tự byte tự nhiên (native byte order) của bộ vi xử lý, vì vậy bạn không cần phải bận tâm về vấn đề thứ tự byte (byte ordering).

```
int pci_write_config_byte(struct pci_dev *dev, int where, u8 val);
int pci_write_config_word(struct pci_dev *dev, int where, u16 val);
int pci_write_config_dword(struct pci_dev *dev, int where, u32 val);
```

Ghi một, hai, hoặc bốn byte vào không gian cấu hình. Thiết bị được xác định bởi `dev` như thường lệ, và giá trị cần ghi được truyền vào qua `val`. Các hàm *word* và *dword* chuyển đổi giá trị thành little-endian trước khi ghi vào thiết bị ngoại vi (peripheral device).

Tất cả các hàm trước đó được cài đặt dưới dạng các hàm inline (inline functions) thực chất sẽ gọi các hàm sau đây. Hãy thoải mái sử dụng các hàm này thay cho các hàm trên trong trường hợp driver không có quyền truy cập vào một `struct pci_dev` tại bất kỳ thời điểm cụ thể nào:

```
int pci_bus_read_config_byte (struct pci_bus *bus, unsigned int devfn, int
 where, u8 *val);
```

int pci\_bus\_read\_config\_word (struct pci\_bus \*bus, unsigned int devfn, int where, u16 \*val);

int pci\_bus\_read\_config\_dword (struct pci\_bus \*bus, unsigned int devfn, int where, u32 \*val);

Giống hệt các hàm *pci\_read\_*, nhưng các biến `struct pci_bus *` và `devfn` được yêu cầu thay cho `struct pci_dev *`.

```
int pci_bus_write_config_byte (struct pci_bus *bus, unsigned int devfn, int
 where, u8 val);
```

int pci\_bus\_write\_config\_word (struct pci\_bus \*bus, unsigned int devfn, int where, u16 val);

int pci\_bus\_write\_config\_dword (struct pci\_bus \*bus, unsigned int devfn, int where, u32 val);

Giống hệt các hàm *pci\_write\_*, nhưng các biến `struct pci_bus *` và `devfn` được yêu cầu thay cho `struct pci_dev *`.

Cách tốt nhất để thao tác với các biến cấu hình bằng cách sử dụng các hàm *pci\_read\_* là thông qua các tên tượng trưng (symbolic names) được định nghĩa trong *<linux/pci.h>*. Ví dụ, hàm nhỏ sau đây lấy ID phiên bản (revision ID) của một thiết bị bằng cách truyền tên tượng trưng cho tham số `where` vào hàm *pci\_read\_config\_byte*:

```
static unsigned char skel_get_revision(struct pci_dev *dev)
{
 u8 revision;
 pci_read_config_byte(dev, PCI_REVISION_ID, &revision);
 return revision;
}
```

### Truy cập Không gian I/O và Bộ nhớ (I/O and Memory Spaces)

Một thiết bị PCI (PCI device) triển khai tối đa sáu vùng địa chỉ I/O (I/O address regions). Mỗi vùng bao gồm các vị trí bộ nhớ (memory) hoặc I/O. Hầu hết các thiết bị triển khai các thanh ghi I/O (I/O registers) của chúng trong các vùng bộ nhớ, bởi vì đây là cách tiếp cận hợp lý hơn (như đã giải thích trong phần "Cổng I/O và Bộ nhớ I/O" - "I/O Ports and I/O Memory" tại Chương 9). Tuy nhiên, không giống như bộ nhớ thông thường (normal memory), các thanh ghi I/O không được phép lưu đệm (cached) bởi CPU vì mỗi lần truy cập có thể mang lại các hiệu ứng phụ (side effects). Thiết bị PCI triển khai các thanh ghi I/O dưới dạng một vùng bộ nhớ sẽ đánh dấu sự khác biệt bằng cách thiết lập một bit "bộ nhớ có thể nạp trước" (memory-is-prefetchable) trong thanh ghi cấu hình của nó.\* Nếu vùng bộ nhớ được đánh dấu là có thể nạp trước (prefetchable), CPU có thể lưu đệm nội dung của nó và thực hiện mọi hình thức tối ưu hóa; mặt khác, việc truy cập bộ nhớ không thể nạp trước (nonprefetchable memory access) không thể bị tối ưu hóa vì mỗi lần truy cập đều có thể có hiệu ứng phụ, giống như các cổng I/O (I/O ports). Các thiết bị ngoại vi (peripherals) ánh xạ các thanh ghi điều khiển của chúng vào một dải địa chỉ bộ nhớ sẽ khai báo dải đó là không thể nạp trước, trong khi các thành phần như bộ nhớ video (video memory) trên các bo mạch PCI thì có thể nạp trước. Trong phần này, chúng ta sử dụng từ *vùng* (*region*) để chỉ một không gian địa chỉ I/O chung được ánh xạ bộ nhớ (memory-mapped) hoặc ánh xạ cổng (port-mapped).

Một bo mạch giao diện (interface board) báo cáo kích thước và vị trí hiện tại của các vùng của nó bằng cách sử dụng các thanh ghi cấu hình—sáu thanh ghi 32-bit được thể hiện trong Hình 12-2, với các tên ký hiệu từ `PCI_BASE_ADDRESS_0` đến `PCI_BASE_ADDRESS_5`. Vì không gian I/O được định nghĩa bởi PCI là một không gian địa chỉ 32-bit, nên việc sử dụng cùng một giao diện cấu hình là điều hợp lý.

Thông tin này nằm trong một trong các bit thấp của các thanh ghi PCI địa chỉ cơ sở (base address). Các bit này được định nghĩa trong *<linux/pci.h>*.

đối với bộ nhớ và I/O. Nếu thiết bị sử dụng bus địa chỉ 64-bit (64-bit address bus), nó có thể khai báo các vùng trong không gian bộ nhớ 64-bit bằng cách sử dụng hai thanh ghi `PCI_BASE_ADDRESS` liên tiếp cho mỗi vùng, với các bit thấp đặt trước. Một thiết bị hoàn toàn có thể cung cấp cả vùng 32-bit và vùng 64-bit.

Trong kernel, các vùng I/O của thiết bị PCI đã được tích hợp vào hệ thống quản lý tài nguyên chung (generic resource management). Vì lý do này, bạn không cần phải truy cập các biến cấu hình để biết thiết bị của mình được ánh xạ ở đâu trong không gian bộ nhớ hoặc I/O. Giao diện ưu tiên để lấy thông tin vùng bao gồm các hàm sau:

```c
unsigned long pci_resource_start(struct pci_dev *dev, int bar);
```

Hàm này trả về địa chỉ đầu tiên (địa chỉ bộ nhớ hoặc số hiệu cổng I/O) được liên kết với một trong sáu vùng I/O PCI. Vùng được chọn bởi số nguyên `bar` (thanh ghi địa chỉ cơ sở - base address register), dao động từ 0–5 (bao gồm cả hai đầu mút).

```c
unsigned long pci_resource_end(struct pci_dev *dev, int bar);
```

Hàm này trả về địa chỉ cuối cùng là một phần của vùng I/O có số hiệu `bar`. Lưu ý rằng đây là địa chỉ cuối cùng có thể sử dụng được, chứ không phải địa chỉ đầu tiên nằm sau vùng đó.

```c
unsigned long pci_resource_flags(struct pci_dev *dev, int bar);
```

Hàm này trả về các cờ (flags) được liên kết với tài nguyên này.

Các cờ tài nguyên (resource flags) được sử dụng để định nghĩa một số tính năng của từng tài nguyên riêng lẻ. Đối với tài nguyên PCI được liên kết với các vùng I/O PCI, thông tin được trích xuất từ các thanh ghi địa chỉ cơ sở, nhưng có thể đến từ các nguồn khác đối với các tài nguyên không được liên kết với thiết bị PCI.

Tất cả các cờ tài nguyên đều được định nghĩa trong *<linux/ioport.h>*; các cờ quan trọng nhất là:

`IORESOURCE_IO` `IORESOURCE_MEM`

Nếu vùng I/O liên quan tồn tại, một và chỉ một trong các cờ này được thiết lập.

`IORESOURCE_PREFETCH` `IORESOURCE_READONLY`

Các cờ này cho biết một vùng bộ nhớ có thể nạp trước (prefetchable) và/hoặc được bảo vệ ghi (write protected) hay không. Cờ sau không bao giờ được thiết lập cho tài nguyên PCI.

Bằng cách tận dụng các hàm `pci_resource_`, một trình điều khiển thiết bị (device driver) có thể hoàn toàn bỏ qua các thanh ghi PCI cơ sở, vì hệ thống đã sử dụng chúng để cấu trúc hóa thông tin tài nguyên rồi.

## Ngắt PCI (PCI Interrupts)

Liên quan đến ngắt (interrupt), PCI rất dễ xử lý. Vào thời điểm Linux khởi động (boots), firmware của máy tính đã gán một số hiệu ngắt (interrupt number) duy nhất cho thiết bị, và driver chỉ cần sử dụng nó. Số hiệu ngắt được lưu trữ trong thanh ghi cấu hình 60 (`PCI_INTERRUPT_LINE`), có độ rộng một byte. Điều này cho phép tối đa 256 đường ngắt (interrupt line), nhưng giới hạn thực tế phụ thuộc vào CPU đang được sử dụng. Driver không cần bận tâm đến việc kiểm tra số hiệu ngắt, bởi vì giá trị tìm thấy trong `PCI_INTERRUPT_LINE` được đảm bảo là chính xác.

Nếu thiết bị không hỗ trợ ngắt, thanh ghi 61 (`PCI_INTERRUPT_PIN`) sẽ có giá trị là 0; ngược lại, nó có giá trị khác 0. Tuy nhiên, vì driver đã biết thiết bị của mình có sử dụng ngắt hay không, nên thông thường nó không cần phải đọc `PCI_INTERRUPT_PIN`.

Do đó, mã nguồn (code) đặc thù của PCI để xử lý ngắt chỉ cần đọc byte cấu hình để lấy số hiệu ngắt được lưu vào một biến cục bộ (local variable), như được thể hiện trong đoạn mã sau. Ngoài ra, các thông tin trong Chương 10 hoàn toàn có thể áp dụng được.

```c
result = pci_read_config_byte(dev, PCI_INTERRUPT_LINE, &myirq);
if (result) {
 /* xử lý lỗi */
}
```

Phần còn lại của mục này cung cấp thêm thông tin cho bạn đọc tò mò nhưng không bắt buộc phải có để viết driver.

Một đầu cắm (connector) PCI có bốn chân ngắt (interrupt pin), và các bo mạch ngoại vi (peripheral board) có thể sử dụng bất kỳ hoặc tất cả các chân đó. Mỗi chân được định tuyến (routed) độc lập đến bộ điều khiển ngắt (interrupt controller) của bo mạch chủ (motherboard), vì vậy các ngắt có thể được chia sẻ mà không gặp bất kỳ vấn đề điện nào. Bộ điều khiển ngắt sau đó chịu trách nhiệm ánh xạ (mapping) các đường dây ngắt (chân) vào phần cứng của bộ xử lý; thao tác phụ thuộc nền tảng (platform-dependent) này được giao cho bộ điều khiển nhằm đạt được tính độc lập nền tảng (platform independence) ngay trong bản thân bus.

Thanh ghi cấu hình chỉ đọc (read-only) nằm tại `PCI_INTERRUPT_PIN` được sử dụng để cho máy tính biết chân đơn nào thực sự được sử dụng. Cần nhớ rằng mỗi bo mạch thiết bị có thể chứa tới tám thiết bị; mỗi thiết bị sử dụng một chân ngắt đơn và báo cáo nó trong thanh ghi cấu hình của chính nó. Các thiết bị khác nhau trên cùng một bo mạch thiết bị có thể sử dụng các chân ngắt khác nhau hoặc chia sẻ chung một chân.

Mặt khác, thanh ghi `PCI_INTERRUPT_LINE` là loại có thể đọc/ghi (read/write). Khi máy tính khởi động, firmware quét các thiết bị PCI của nó và thiết lập thanh ghi cho mỗi thiết bị dựa trên cách chân ngắt được định tuyến cho khe cắm (slot) PCI đó. Giá trị được gán bởi firmware, bởi vì chỉ có firmware mới biết bo mạch chủ định tuyến các chân ngắt khác nhau đến bộ xử lý như thế nào. Tuy nhiên, đối với device driver, thanh ghi `PCI_INTERRUPT_LINE` là thanh ghi chỉ đọc. Thật thú vị, các phiên bản gần đây của Linux kernel trong một số trường hợp có thể gán các đường ngắt mà không cần nhờ đến BIOS.

### Trừu tượng hóa Phần cứng (Hardware Abstractions)

Chúng ta hoàn thành phần thảo luận về PCI bằng cách xem xét nhanh cách hệ thống xử lý vô số các bộ điều khiển (controller) PCI có sẵn trên thị trường. Đây chỉ là một phần mang tính thông tin, nhằm cho độc giả tò mò thấy bố cục hướng đối tượng (object-oriented) của kernel mở rộng đến tận các tầng thấp nhất như thế nào.

Cơ chế được sử dụng để thực hiện trừu tượng hóa phần cứng (hardware abstraction) là cấu trúc thông thường chứa các phương thức (method). Đây là một kỹ thuật mạnh mẽ chỉ bổ sung mức chi phí (overhead) tối thiểu của việc giải tham chiếu con trỏ (dereferencing a pointer) vào mức chi phí thông thường của một lệnh gọi hàm (function call). Trong trường hợp quản lý PCI, các thao tác duy nhất phụ thuộc vào phần cứng là các thao tác đọc và ghi các thanh ghi cấu hình (configuration register), bởi vì mọi thứ khác trong thế giới PCI đều được thực hiện bằng cách đọc và ghi trực tiếp các không gian địa chỉ bộ nhớ và I/O, và những không gian đó nằm dưới sự kiểm soát trực tiếp của CPU.

Do đó, cấu trúc liên quan đến việc truy cập thanh ghi cấu hình chỉ bao gồm hai trường (field):

```c
struct pci_ops {
 int (*read)(struct pci_bus *bus, unsigned int devfn, int where, int size,
 u32 *val);
 int (*write)(struct pci_bus *bus, unsigned int devfn, int where, int size,
 u32 val);
};
```

Cấu trúc này được định nghĩa trong *<linux/pci.h>* và được sử dụng bởi *drivers/pci/pci.c*, nơi các hàm công khai (public function) thực tế được định nghĩa.

Hai hàm tác động lên không gian cấu hình PCI có chi phí (overhead) lớn hơn việc giải tham chiếu một con trỏ; chúng sử dụng các con trỏ phân tầng (cascading pointer) do tính hướng đối tượng cao của mã nguồn, nhưng chi phí này không phải là vấn đề trong các thao tác hiếm khi được thực hiện và không bao giờ nằm trong các đường dẫn quan trọng về tốc độ (speed-critical path). Ví dụ, việc triển khai thực tế của *pci\_read\_config\_byte(dev, where, val)* sẽ được mở rộng thành:

```c
dev->bus->ops->read(bus, devfn, where, 8, val);
```

Các bus PCI khác nhau trong hệ thống được phát hiện khi khởi động hệ thống (system boot), và đó là lúc các mục struct pci\_bus được tạo ra và liên kết với các tính năng của chúng, bao gồm cả trường ops.

Việc triển khai trừu tượng hóa phần cứng thông qua các cấu trúc dữ liệu "thao tác phần cứng" (hardware operations) là điều điển hình trong Linux kernel. Một ví dụ quan trọng là cấu trúc dữ liệu struct alpha\_machine\_vector. Nó được định nghĩa trong *<asm-alpha/machvec.h>* và đảm nhận mọi thứ có thể thay đổi giữa các máy tính dựa trên kiến trúc Alpha khác nhau.

## Nhìn lại quá khứ: ISA

Bus ISA có thiết kế khá cũ và nổi tiếng là có hiệu năng kém, nhưng nó vẫn chiếm một phần lớn thị trường cho các thiết bị mở rộng. Nếu tốc độ không quan trọng và bạn muốn hỗ trợ các bo mạch chủ (motherboard) cũ, việc triển khai ISA sẽ được ưa chuộng hơn PCI. Một ưu điểm bổ sung của chuẩn cũ này là nếu bạn là một người có sở thích làm đồ điện tử (hobbyist), bạn có thể dễ dàng tự chế tạo các thiết bị ISA của riêng mình, điều chắc chắn không thể thực hiện được với PCI.

Mặt khác, một nhược điểm lớn của ISA là nó gắn chặt với kiến trúc PC; bus giao diện này có tất cả các giới hạn của bộ xử lý 80286 và gây ra vô số nỗi đau cho các lập trình viên hệ thống (system programmer). Vấn đề lớn khác với thiết kế ISA (thừa kế từ chiếc IBM PC nguyên bản) là việc thiếu định vị địa lý theo không gian vật lý (geographical addressing), dẫn đến nhiều vấn đề và các chu kỳ tốn thời gian gồm: rút ra - thay đổi jumper - cắm lại - kiểm tra để thêm thiết bị mới. Thật thú vị khi lưu ý rằng ngay cả những máy tính Apple II cổ nhất cũng đã tận dụng tính năng định vị địa lý và chúng có các bo mạch mở rộng không cần jumper (jumperless).

Bất chấp những nhược điểm lớn của nó, ISA vẫn được sử dụng ở một số nơi bất ngờ. Ví dụ, dòng bộ xử lý MIPS VR41xx được sử dụng trong một số máy tính cầm tay (palmtop) có trang bị bus mở rộng tương thích với ISA, nghe có vẻ kỳ lạ. Lý do đằng sau những lần sử dụng ISA bất ngờ này là chi phí cực kỳ thấp của một số phần cứng kế thừa (legacy hardware), chẳng hạn như các card Ethernet dựa trên chip 8390, vì vậy một CPU có tín hiệu điện của ISA có thể dễ dàng tận dụng các thiết bị PC tồi tệ nhưng giá rẻ đó.

### Tài nguyên phần cứng (Hardware Resources)

Một thiết bị ISA có thể được trang bị các cổng I/O (I/O ports), vùng nhớ (memory areas) và đường ngắt (interrupt lines).

Mặc dù các bộ xử lý x86 hỗ trợ bộ nhớ cổng I/O 64 KB (tức là bộ xử lý kích hoạt 16 đường địa chỉ), một số phần cứng PC cũ chỉ giải mã 10 đường địa chỉ thấp nhất. Điều này giới hạn không gian địa chỉ khả dụng ở mức 1024 cổng, bởi vì bất kỳ địa chỉ nào nằm trong dải từ 1 KB đến 64 KB đều bị nhầm thành địa chỉ thấp bởi bất kỳ thiết bị nào chỉ giải mã các đường địa chỉ thấp. Một số thiết bị ngoại vi (peripherals) khắc phục hạn chế này bằng cách ánh xạ chỉ một cổng vào kilobyte thấp và sử dụng các đường địa chỉ cao để lựa chọn giữa các thanh ghi thiết bị khác nhau. Ví dụ, một thiết bị được ánh xạ tại 0x340 có thể sử dụng an toàn các cổng 0x740, 0xB40, v.v.

Nếu tính khả dụng của các cổng I/O bị hạn chế, thì quyền truy cập bộ nhớ thậm chí còn tệ hơn. Một thiết bị ISA chỉ có thể sử dụng dải nhớ từ 640 KB đến 1 MB và từ 15 MB đến 16 MB cho thanh ghi I/O và điều khiển thiết bị. Dải nhớ từ 640 KB đến 1 MB được sử dụng bởi PC BIOS, bởi các bo mạch video tương thích VGA (VGA-compatible video boards) và bởi nhiều thiết bị khác, để lại rất ít không gian trống cho các thiết bị mới. Mặt khác, bộ nhớ ở mức 15 MB không được Linux hỗ trợ trực tiếp và việc chỉnh sửa (hacking) kernel để hỗ trợ nó hiện nay là một sự lãng phí thời gian lập trình.

Tài nguyên thứ ba có sẵn cho các bo mạch thiết bị ISA là các đường ngắt (interrupt lines). Một số lượng hạn chế các đường ngắt được định tuyến đến bus ISA (ISA bus) và chúng được chia sẻ bởi tất cả các bo mạch giao tiếp (interface boards). Kết quả là, nếu các thiết bị không được cấu hình đúng cách, chúng có thể gặp tình trạng sử dụng cùng một đường ngắt.

Mặc dù đặc tả ISA gốc không cho phép chia sẻ ngắt (interrupt sharing) giữa các thiết bị, hầu hết các bo mạch thiết bị đều cho phép điều đó.\* Việc chia sẻ ngắt ở cấp độ phần mềm được mô tả trong phần "Chia sẻ Ngắt" ("Interrupt Sharing") ở Chương 10.

### Lập trình ISA (ISA Programming)

Về mặt lập trình, không có sự hỗ trợ cụ thể nào trong kernel hoặc BIOS để đơn giản hóa việc truy cập vào các thiết bị ISA (như đối với PCI chẳng hạn). Các tiện ích duy nhất bạn có thể sử dụng là các thanh ghi của cổng I/O và đường IRQ, được mô tả trong phần "Cài đặt Trình xử lý Ngắt" ("Installing an Interrupt Handler") ở Chương 10.

Các kỹ thuật lập trình được trình bày xuyên suốt phần đầu của cuốn sách này được áp dụng cho các thiết bị ISA; trình điều khiển (driver) có thể dò tìm (probe) các cổng I/O và đường ngắt phải được tự động phát hiện (autodetected) bằng một trong các kỹ thuật được trình bày trong phần "Tự động phát hiện Số hiệu IRQ" ("Autodetecting the IRQ Number") ở Chương 10.

Các hàm hỗ trợ (helper functions) *isa\_readb* và các hàm tương tự đã được giới thiệu ngắn gọn trong phần "Sử dụng Bộ nhớ I/O" ("Using I/O Memory") ở Chương 9, và không có gì thêm cần bàn về chúng.

## Đặc tả Plug-and-Play

Một số bo mạch thiết bị ISA mới tuân theo các quy trình thiết kế đặc thù và yêu cầu một trình tự khởi tạo đặc biệt nhằm đơn giản hóa việc lắp đặt và cấu hình các bo mạch giao diện mở rộng. Đặc tả cho việc thiết kế các bo mạch này được gọi là *plug and play* (PnP) và bao gồm một tập hợp các quy tắc phức tạp để xây dựng và cấu hình các thiết bị ISA không cần jumper (jumperless). Các thiết bị PnP triển khai các vùng I/O (I/O region) có thể định vị lại; BIOS của máy tính chịu trách nhiệm cho việc định vị lại này—tương tự như PCI.

Tóm lại, mục tiêu của PnP là đạt được tính linh hoạt tương tự như các thiết bị PCI mà không cần thay đổi giao diện điện bên dưới (bus ISA). Để đạt được mục đích này, các đặc tả định nghĩa một tập hợp các thanh ghi cấu hình độc lập với thiết bị (device-independent configuration registers) và một cách thức để định địa chỉ theo vị trí (geographical addressing) các bo mạch giao diện, mặc dù bus vật lý không mang đường dây tín hiệu theo từng bo mạch—mọi đường tín hiệu ISA đều kết nối tới mọi khe cắm khả dụng.

Việc định địa chỉ theo vị trí hoạt động bằng cách gán một số nguyên nhỏ, được gọi là *số chọn thẻ* (card select number - CSN), cho từng thiết bị ngoại vi PnP trong máy tính. Mỗi thiết bị PnP có một định danh nối tiếp duy nhất (unique serial identifier), rộng 64 bit, được hàn cứng (hardwired) vào bo mạch ngoại vi. Việc gán CSN sử dụng số sê-ri duy nhất này để nhận diện các thiết bị PnP. Nhưng các CSN chỉ có thể được gán một cách an toàn tại thời điểm khởi động (boot time), điều này đòi hỏi BIOS phải hỗ trợ PnP.

Vấn đề với việc chia sẻ ngắt (interrupt sharing) là một vấn đề về kỹ thuật điện: nếu một thiết bị điều khiển đường tín hiệu về trạng thái không hoạt động (inactive)—bằng cách áp dụng mức điện áp trở kháng thấp—thức ngắt đó không thể được chia sẻ. Ngược lại, nếu thiết bị sử dụng một điện trở kéo lên (pull-up resistor) về mức logic không hoạt động, việc chia sẻ là khả thi. Đây là tiêu chuẩn phổ biến hiện nay. Tuy nhiên, vẫn có rủi ro tiềm ẩn về việc mất các sự kiện ngắt (interrupt event) vì ngắt ISA được kích hoạt theo sườn (edge triggered) thay vì kích hoạt theo mức (level triggered). Các ngắt kích hoạt theo sườn dễ thực hiện hơn về mặt phần cứng nhưng không phù hợp cho việc chia sẻ an toàn.

nhận biết. Vì lý do này, các máy tính đời cũ yêu cầu người dùng phải lấy và chèn một đĩa mềm cấu hình cụ thể (configuration diskette), ngay cả khi thiết bị đó có khả năng PnP.

Các bo mạch giao diện tuân theo đặc tả PnP rất phức tạp ở cấp độ phần cứng. Chúng phức tạp hơn nhiều so với các bo mạch PCI và đòi hỏi phần mềm phức tạp. Việc gặp khó khăn khi cài đặt các thiết bị này không phải là điều hiếm gặp, và ngay cả khi việc cài đặt diễn ra suôn sẻ, bạn vẫn phải đối mặt với các giới hạn về hiệu năng và không gian I/O hạn hẹp của bus ISA. Tốt hơn nhiều là nên cài đặt các thiết bị PCI bất cứ khi nào có thể và tận hưởng công nghệ mới thay vào đó.

Nếu bạn quan tâm đến phần mềm cấu hình PnP, bạn có thể tham khảo tệp nguồn *drivers/net/3c509.c*, có hàm dò tìm (probing function) xử lý các thiết bị PnP. Kernel 2.6 đã chứng kiến rất nhiều công sức đổ ra trong lĩnh vực hỗ trợ thiết bị PnP, do đó rất nhiều giao diện kém linh hoạt đã được làm sạch so với các phiên bản kernel trước đó.

## PC/104 và PC/104+

Hiện nay trong thế giới công nghiệp, có hai kiến trúc bus khá thịnh hành: PC/104 và PC/104+. Cả hai đều là tiêu chuẩn trong các máy tính đơn bo (single-board computer) loại PC.

Cả hai tiêu chuẩn đều đề cập đến các hệ số hình dạng (form factor) cụ thể cho các bo mạch in (printed circuit board), cũng như các đặc tả điện/cơ học cho việc kết nối giữa các bo mạch. Ưu điểm thực tế của các bus này là chúng cho phép các bo mạch mạch điện được xếp chồng lên nhau theo chiều dọc bằng cách sử dụng một loại đầu cắm và ổ cắm (plug-and-socket) ở một mặt của thiết bị.

Bố trí điện và logic của hai bus này giống hệt với ISA (PC/104) và PCI (PC/104+), vì vậy phần mềm sẽ không nhận thấy bất kỳ sự khác biệt nào giữa các bus máy tính để bàn thông thường và hai bus này.

## Các Bus PC Khác

PCI và ISA là các giao diện ngoại vi được sử dụng phổ biến nhất trong thế giới PC, nhưng chúng không phải là duy nhất. Dưới đây là tóm tắt các tính năng của các bus khác được tìm thấy trên thị trường PC.

### MCA

Kiến trúc Micro Channel (Micro Channel Architecture - MCA) là một chuẩn của IBM được sử dụng trong các máy tính PS/2 và một số máy tính xách tay (laptop). Ở cấp độ phần cứng, Micro Channel có nhiều tính năng hơn so với ISA. Nó hỗ trợ DMA đa chủ (multimaster DMA), các đường truyền dữ liệu và địa chỉ 32-bit, các đường ngắt chia sẻ (shared interrupt lines), và định vị địa chỉ theo vị trí địa lý (geographical addressing) để truy cập các thanh ghi cấu hình trên từng bo mạch. Các thanh ghi như vậy được gọi là *Programmable Option Select* (POS), nhưng chúng không có đầy đủ các tính năng của các thanh ghi PCI. Hỗ trợ của Linux đối mang Micro Channel bao gồm các hàm được xuất (export) ra các module.

Một trình điều khiển thiết bị (device driver) có thể đọc giá trị số nguyên `MCA_bus` để xem liệu nó có đang chạy trên một máy tính sử dụng Micro Channel hay không. Nếu ký hiệu này là một macro tiền xử lý (preprocessor macro), macro `MCA_bus__is_a_macro` cũng sẽ được định nghĩa. Nếu `MCA_bus__is_a_macro` chưa được định nghĩa, thì `MCA_bus` là một biến số nguyên được xuất ra mã nguồn dạng module (modularized code). Cả `MCA_BUS` và `MCA_bus__is_a_macro` đều được định nghĩa trong *<asm/processor.h>*.

### EISA

Bus ISA mở rộng (Extended ISA - EISA) là một phần mở rộng 32-bit của ISA, với đầu cắm giao tiếp tương thích; các bo mạch thiết bị ISA có thể cắm vào đầu cắm EISA. Các đường dây bổ sung được định路线 bên dưới các tiếp điểm ISA.

Giống như PCI và MCA, bus EISA được thiết kế để chứa các thiết bị không cần jumper (jumperless devices), và nó có các tính năng tương tự như MCA: các đường dữ liệu và địa chỉ 32-bit, multimaster DMA, và các đường ngắt chia sẻ. Các thiết bị EISA được cấu hình bằng phần mềm, nhưng chúng không cần bất kỳ sự hỗ trợ đặc biệt nào từ hệ điều hành (operating system). Các trình điều khiển EISA đã tồn tại trong Linux Kernel cho các thiết bị Ethernet và bộ điều khiển SCSI.

Một trình điều khiển EISA kiểm tra giá trị của `EISA_bus` để xác định xem máy tính chủ có trang bị bus EISA hay không. Giống như `MCA_bus`, `EISA_bus` có thể là một macro hoặc một biến, tùy thuộc vào việc `EISA_bus__is_a_macro` có được định nghĩa hay không. Cả hai ký hiệu đều được định nghĩa trong *<asm/processor.h>*.

Kernel hỗ trợ đầy đủ EISA cho các thiết bị tích hợp sysfs và tính năng quản lý tài nguyên (resource management). Điều này nằm trong thư mục *drivers/eisa*.

### VLB

Một phần mở rộng khác của ISA là bus giao tiếp VESA Local Bus (VLB), mở rộng các đầu cắm ISA bằng cách thêm khe cắm thứ ba theo chiều dọc. Một thiết bị có thể cắm trực tiếp vào đầu cắm bổ sung này (mà không cần cắm vào hai đầu cắm ISA đi kèm), bởi vì khe cắm VLB sao chép tất cả các tín hiệu quan trọng từ các đầu cắm ISA. Các ngoại vi VLB "độc lập" (standalone) không sử dụng khe cắm ISA rất hiếm, bởi vì hầu hết các thiết bị cần vươn tới mặt sau để các đầu cắm ngoại vi của chúng có thể sử dụng được.

Bus VESA có nhiều hạn chế về năng lực hơn so với các bus EISA, MCA và PCI, và đang dần biến mất khỏi thị trường. Không có sự hỗ trợ đặc biệt nào từ kernel dành cho VLB. Tuy nhiên, cả trình điều khiển Ethernet Lance và trình điều khiển đĩa IDE trong Linux 2.0 đều có thể xử lý các phiên bản VLB của thiết bị tương ứng.

## SBus

Trong khi hầu hết các máy tính ngày nay được trang bị bus giao tiếp PCI hoặc ISA, phần lớn các máy trạm (workstation) dựa trên kiến trúc SPARC đời cũ lại sử dụng SBus để kết nối các thiết bị ngoại vi của chúng.

SBus là một thiết kế khá tiên tiến, mặc dù nó đã xuất hiện từ rất lâu. Nó được định hướng là độc lập với bộ vi xử lý (processor independent) (mặc dù chỉ có các máy tính SPARC sử dụng nó) và được tối ưu hóa cho các bo mạch ngoại vi I/O. Nói cách khác, bạn không thể cắm thêm RAM vào các khe cắm SBus (các bo mạch mở rộng RAM đã bị lãng quên từ lâu ngay cả trong thế giới ISA, và PCI cũng không hỗ trợ chúng). Sự tối ưu hóa này nhằm đơn giản hóa thiết kế của cả thiết bị phần cứng lẫn phần mềm hệ thống (system software), đổi lại bằng việc tăng thêm một chút độ phức tạp ở bo mạch chủ (motherboard).

Đặc tính thiên về I/O này của bus dẫn đến việc các thiết bị ngoại vi sử dụng địa chỉ *ảo* (*virtual* addresses) để truyền dữ liệu, do đó bỏ qua sự cần thiết phải cấp phát một vùng đệm DMA liên tục (contiguous DMA buffer). Bo mạch chủ chịu trách nhiệm giải mã các địa chỉ ảo và ánh xạ (map) chúng thành các địa chỉ vật lý (physical addresses). Điều này đòi hỏi phải gắn một MMU (unit quản lý bộ nhớ - memory management unit) vào bus; chipset đảm nhận nhiệm vụ này được gọi là IOMMU. Mặc dù phức tạp hơn đôi chút so với việc sử dụng địa chỉ vật lý trên bus giao tiếp, thiết kế này được đơn giản hóa đi rất nhiều nhờ thực tế là các bộ vi xử lý SPARC luôn được thiết kế với nhân MMU tách biệt khỏi nhân CPU (về mặt vật lý hoặc ít nhất là về mặt khái niệm). Trên thực tế, lựa chọn thiết kế này cũng được chia sẻ bởi các thiết kế vi xử lý thông minh khác và mang lại lợi ích tổng thể rất lớn. Một tính năng khác của loại bus này là các bo mạch thiết bị khai thác tối đa việc định vị địa chỉ theo vị trí địa lý (geographical addressing), vì vậy không cần phải triển khai một bộ giải mã địa chỉ trong mọi thiết bị ngoại vi hoặc phải đối mặt với các xung đột địa chỉ (address conflicts).

Các thiết bị ngoại vi SBus sử dụng ngôn ngữ Forth trong các chip PROM của chúng để tự khởi tạo. Ngôn ngữ Forth được chọn bởi vì bộ thông dịch (interpreter) của nó rất nhẹ và do đó, có thể dễ dàng được triển khai trong firmware của bất kỳ hệ thống máy tính nào. Ngoài ra, đặc tả kỹ thuật của SBus vạch ra quá trình khởi động (boot process), sao cho các thiết bị I/O tuân thủ có thể hòa nhập dễ dàng vào hệ thống và được nhận diện khi khởi động hệ thống. Đây là một bước tiến lớn trong việc hỗ trợ các thiết bị đa nền tảng (multiplatform devices); nó là một thế giới hoàn toàn khác biệt so với các thiết bị ISA mang tâm lý xoay quanh PC (PC-centric) mà chúng ta từng quen thuộc. Tuy nhiên, nó đã không thành công vì nhiều lý do thương mại khác nhau.

Mặc dù các phiên bản kernel (nhân) hiện tại cung cấp sự hỗ trợ khá đầy đủ tính năng cho các thiết bị SBus, nhưng loại bus này ngày nay ít được sử dụng đến mức không đáng để đề cập chi tiết ở đây. Bạn đọc quan tâm có thể xem các tệp mã nguồn trong *arch/sparc/kernel* và *arch/sparc/mm*.

## NuBus

Một bus giao tiếp (interface bus) thú vị khác nhưng gần như đã bị lãng quên là NuBus. Nó được tìm thấy trên các dòng máy tính Mac cũ (những máy sử dụng họ CPU M68k).

Toàn bộ bus này được ánh xạ bộ nhớ (memory-mapped) (giống như mọi thứ với M68k), và các thiết bị chỉ được định địa chỉ theo vị trí địa lý (geographically addressed). Điều này tốt và rất điển hình của Apple, vì dòng máy Apple II cũ hơn nhiều đã có bố trí bus tương tự. Điều tồi tệ là hầu như không thể tìm thấy tài liệu về NuBus, do chính sách "đóng cửa mọi thứ" mà Apple luôn áp dụng với các máy tính Mac của họ (và không giống như Apple II trước đó, vốn có mã nguồn và sơ đồ mạch có sẵn với chi phí rất thấp).

Tệp *drivers/nubus/nubus.c* bao gồm hầu như mọi thứ chúng ta biết về loại bus này, và đó là một tài liệu đọc rất thú vị; nó cho thấy các nhà phát triển đã phải thực hiện côngλικỹ nghệ đảo ngược (reverse engineering) khó khăn đến mức nào.

## Bus Ngoại Vi (External Buses)

Một trong những bổ sung gần đây nhất trong lĩnh vực bus giao tiếp là toàn bộ nhóm bus ngoại vi (external bus). Điều này bao gồm USB, FireWire và IEEE1284 (bus ngoại vi dựa trên cổng song song - parallel port). Các giao diện này có phần tương tự với công nghệ cũ hơn và không quá ngoại vi, chẳng hạn như PCMCIA/CardBus và thậm chí cả SCSI.

Về mặt khái niệm, các bus này không phải là bus giao tiếp đầy đủ tính năng (giống như PCI) cũng không phải là các kênh truyền thông thô sơ (dumb communication channels) (giống như cổng nối tiếp - serial port). Thật khó để phân loại phần mềm cần thiết để khai thác các tính năng của chúng, vì nó thường được chia thành hai cấp độ: trình điều khiển (driver) cho bộ điều khiển phần cứng (hardware controller) (giống như các driver cho bộ điềuปรับ SCSI PCI hoặc bộ điều khiển PCI được giới thiệu trong phần "Giao diện PCI" - The PCI Interface) và driver cho thiết bị "client" cụ thể (giống như *sd.c* xử lý các đĩa SCSI chung và cái gọi là driver PCI xử lý các thẻ được cắm vào bus).

## Tóm Lược (Quick Reference)

Phần này tóm tắt các ký hiệu được giới thiệu trong chương:

## include <linux/pci.h>

Tệp tiêu đề (header) bao gồm các tên ký hiệu cho các thanh ghi PCI (PCI register) và một số giá trị ID của nhà vendor và device.

struct pci\_dev;

Cấu trúc đại diện cho một thiết bị PCI trong kernel.

struct pci\_driver;

Cấu trúc đại diện cho một trình điều khiển PCI (PCI driver). Tất cả các driver PCI phải định nghĩa cấu trúc này.

struct pci\_device\_id;

Cấu trúc mô tả các loại thiết bị PCI mà driver này hỗ trợ.

int pci\_register\_driver(struct pci\_driver \*drv);

int pci\_module\_init(struct pci\_driver \*drv);

void pci\_unregister\_driver(struct pci\_driver \*drv);

Các hàm đăng ký hoặc hủy đăng ký một driver PCI với kernel.

thay vào đó.

```
struct pci_dev *pci_find_device(unsigned int vendor, unsigned int device,
 struct pci_dev *from);
struct pci_dev *pci_find_device_reverse(unsigned int vendor, unsigned int
 device, const struct pci_dev *from);
struct pci_dev *pci_find_subsys (unsigned int vendor, unsigned int device,
 unsigned int ss_vendor, unsigned int ss_device, const struct pci_dev *from);
struct pci_dev *pci_find_class(unsigned int class, struct pci_dev *from);
   Các hàm tìm kiếm trong danh sách thiết bị để tìm các thiết bị có chữ ký (signature) cụ thể hoặc
   thuộc về một lớp (class) cụ thể. Giá trị trả về là NULL nếu không tìm thấy thiết bị nào. from được
   sử dụng để tiếp tục tìm kiếm; nó phải là NULL trong lần gọi hàm đầu tiên,
   và nó phải trỏ đến thiết bị vừa tìm được nếu bạn đang tìm kiếm thêm các thiết bị khác.
   Các hàm này không được khuyến khích sử dụng, hãy dùng các biến thể pci_get_
```

```
struct pci_dev *pci_get_device(unsigned int vendor, unsigned int device,
 struct pci_dev *from);
struct pci_dev *pci_get_subsys(unsigned int vendor, unsigned int device,
 unsigned int ss_vendor, unsigned int ss_device, struct pci_dev *from);
```

struct pci\_dev \*pci\_get\_slot(struct pci\_bus \*bus, unsigned int devfn); Các hàm tìm kiếm trong danh sách thiết bị để tìm các thiết bị có chữ ký cụ thể hoặc thuộc về một lớp cụ thể. Giá trị trả về là NULL nếu không tìm thấy thiết bị nào. from được sử dụng để tiếp tục tìm kiếm; nó phải là NULL trong lần gọi hàm đầu tiên, và nó phải trỏ đến thiết bị vừa tìm được nếu bạn đang tìm kiếm thêm các thiết bị khác. Cấu trúc được trả về sẽ có bộ đếm tham chiếu (reference count) được tăng lên, và sau khi trình gọi (caller) hoàn tất việc sử dụng, hàm *pci\_dev\_put* phải được gọi.

```
int pci_read_config_byte(struct pci_dev *dev, int where, u8 *val);
int pci_read_config_word(struct pci_dev *dev, int where, u16 *val);
int pci_read_config_dword(struct pci_dev *dev, int where, u32 *val);
int pci_write_config_byte (struct pci_dev *dev, int where, u8 *val);
int pci_write_config_word (struct pci_dev *dev, int where, u16 *val);
int pci_write_config_dword (struct pci_dev *dev, int where, u32 *val);
    Các hàm đọc hoặc ghi một thanh ghi cấu hình PCI (PCI configuration register). Mặc dù Linux
    kernel xử lý vấn đề thứ tự byte (byte ordering), lập trình viên vẫn phải cẩn thận về thứ tự
    byte khi lắp ráp các giá trị nhiều byte từ các byte riêng lẻ. Bus PCI
    sử dụng chuẩn little-endian.
```

```c
int pci_enable_device(struct pci_dev *dev);
    Kích hoạt một thiết bị PCI (PCI device).
unsigned long pci_resource_start(struct pci_dev *dev, int bar);
unsigned long pci_resource_end(struct pci_dev *dev, int bar);
unsigned long pci_resource_flags(struct pci_dev *dev, int bar);
    Các hàm xử lý tài nguyên của thiết bị PCI (PCI device resources).
```
