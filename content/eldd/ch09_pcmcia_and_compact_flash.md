# Chương 9: PCMCIA và Compact Flash (PCMCIA and Compact Flash)

| Trong Chương Này            |     |
|-----------------------------|-----|
| PCMCIA/CF là gì?            | 258 |
| Hệ thống con Linux-PCMCIA   | 260 |
| Trình điều khiển Host Controller | 262 |
| Nhân PCMCIA (PCMCIA Core)   | 263 |
| Dịch vụ Trình điều khiển    | 263 |
| Trình điều khiển Client     | 264 |
| Kết nối các Thành phần        | 271 |
| Bộ nhớ PCMCIA               | 272 |
| PCMCIA Nối tiếp             | 272 |
| Gỡ lỗi                      | 273 |
| Xem xét Mã nguồn             | 275 |
|                             |     |

Các công nghệ phổ biến ngày nay như Ethernet không dây và có dây, *General Packet Radio Service* (GPRS), *Global Positioning System* (GPS), bộ nhớ thu nhỏ, và modem đang rất phổ biến dưới dạng yếu tố hình thức (form factor) của thẻ PCMCIA (viết tắt của *Personal Computer Memory Card International Association*) hoặc CF (*Compact Flash*). Hầu hết máy tính xách tay (laptop) và nhiều thiết bị nhúng (embedded device) đều hỗ trợ giao diện PCMCIA hoặc CF, do đó cho phép chúng tận dụng ngay lập tức các công nghệ này. Trên các hệ thống nhúng (embedded system), các khe cắm PCMCIA/CF cung cấp một lộ trình nâng cấp công nghệ mà không cần phải thiết kế lại bảng mạch (re-spin the board). Ví dụ, một phiên bản tiết kiệm chi phí của thiết bị hỗ trợ Internet có thể sử dụng modem quay số PCMCIA, trong khi phiên bản cao cấp hơn có thể tích hợp WiFi.

Linux kernel hỗ trợ các thiết bị PCMCIA trên nhiều kiến trúc khác nhau. Trong chương này, chúng ta hãy cùng khám phá các cơ chế hỗ trợ có sẵn trong kernel dành cho các bộ điều khiển host (host adapter) và thiết bị client PCMCIA/CF.

## PCMCIA/CF là gì?

PCMCIA là một thông số kỹ thuật giao diện truyền dữ liệu 16-bit ban đầu được sử dụng cho các thẻ nhớ. Các thẻ CF có kích thước nhỏ hơn nhưng tương thích với PCMCIA, và thường được sử dụng trong các thiết bị cầm tay như PDA và máy ảnh kỹ thuật số. Thẻ CF chỉ có 50 chân nhưng có thể cắm vào khe cắm PCMCIA 68 chân của laptop thông qua một bộ chuyển đổi thụ động (passive adapter) từ CF sang PCMCIA. PCMCIA và CF chỉ giới hạn trong không gian máy tính xách tay và thiết bị cầm tay, và không thâm nhập được vào máy tính để bàn (desktop) cũng như các máy tính cao cấp khác.

Thông số kỹ thuật PCMCIA giờ đây đã phát triển để bao gồm cả việc hỗ trợ tốc độ cao hơn dưới dạng thẻ *CardBus* 32-bit. Thuật ngữ *PC Card* được sử dụng khi đề cập đến các thiết bị PCMCIA hoặc CardBus. CardBus có cấu trúc gần gũi với bus PCI hơn, vì vậy kernel đã chuyển phần hỗ trợ cho các thiết bị CardBus từ tầng PCMCIA sang tầng PCI. Thông số kỹ thuật công nghệ mới nhất từ nhóm tiêu chuẩn công nghiệp PCMCIA là *ExpressCard*, tương thích với *PCI Express*—một công nghệ bus mới dựa trên các khái niệm của PCI. Chúng ta sẽ xem xét CardBus và ExpressCard khi thảo luận về PCI ở chương tiếp theo.

Thẻ PC có ba loại theo thứ tự độ dày tăng dần: Loại I (3.3mm), Loại II (5mm) và Loại III (10.5mm).

Hình 9.1 minh họa kết nối bus PCMCIA trên laptop, và Hình 9.2 minh họa PCMCIA trên một thiết bị nhúng. Như bạn có thể nhận thấy, bộ điều khiển host PCMCIA (PCMCIA host controller) làm cầu nối giữa thẻ PCMCIA và system bus. Laptop và các biến thể của chúng thường có một chip host controller PCMCIA được kết nối với bus PCI, trong khi một số bộ điều khiển nhúng tích hợp sẵn host controller PCMCIA trực tiếp bên trong silicon của chúng. Bộ điều khiển này thực hiện ánh xạ (map) bộ nhớ của thẻ vào các cửa sổ I/O và bộ nhớ của host, đồng thời định tuyến các ngắt (interrupt) do thẻ tạo ra đến một đường ngắt bộ xử lý phù hợp.

**Hình 9.1. PCMCIA trên laptop.**

```
                    +-----------+
                    | Processor |
                    +-----------+
                          ^
                          |                              +-------------+
                          v                              | PCMCIA Card |
                    +-------------+                      +-------------+
                    | North Bridge|                             |
                    +-------------+                             v
                          ^                                 +--------+
                          |                                 | Socket |
                          |                                 +--------+
                          v                                   |    |
                    +-------------+                 +----------------------------------+
                    | South Bridge|           ------| PCMCIA / CardBus Controller      |
                    +-------------+           |     +----------------------------------+     
                          |                   |
                          |  PCI Bus          |
                          |                   |
        --------------------------------------|------------
        |                         |                      |
        v                         v                      v
   +-----------+             +-----------+          +-----------+
   | PCI Slot  |             | PCI Slot  |          |  ...      |
   +-----------+             +-----------+          +-----------+

```

**Hình 9.2. PCMCIA trên hệ thống nhúng.**

```
            Embedded Controller
       +--------------------------------------------------+
       |                                                  |
       |          [ CPU Core ]                            |
       |                |      Internal Local Bus         |
       |      -------------------------------------       |
       |        |             |                |          |
       |  [ PCMCIA   ...   [ LCD                          |
       |  Controller ]     Controller ]                   |
       +--------------------------------------------------+
                ^
                |
                v
             [ Socket ]  <--  [ PCMCIA Card ]
```

## Hệ thống con Linux-PCMCIA (Linux-PCMCIA Subsystem)

Hỗ trợ Linux-PCMCIA có sẵn trên các dòng máy tính xách tay (laptop) dựa trên kiến trúc Intel cũng như trên các kiến trúc như ARM, MIPS và PowerPC. Hệ thống con (subsystem) PCMCIA bao gồm các trình điều khiển thiết bị (device driver) cho các bộ điều khiển host PCMCIA, các trình điều khiển client (client driver) cho các loại card khác nhau, một tiến trình nền (daemon) hỗ trợ cắm nóng (hotplugging), các tiện ích chế độ người dùng (user mode utilities), và một mô-đun *Card Services* tương tác với tất cả các thành phần này.

Hình 9.3 minh họa sự tương tác giữa các mô-đun tạo nên hệ thống con Linux-PCMCIA.

```
========================= USER SPACE =========================

                                +-----------------+                                      +------------------+
                                |  pcmciautils    |                                      |  XX-Applications |
                                +-----------------+                                      +------------------+
                                         |                                                      ^
                                         |                                                      |
                                         v                                                      |
========================= KERNEL SPACE =======================                                  |
                                                                                                |
                    +----------------------------------+                                        |
                    |          PCMCIA Core             |                                        v
                    |----------------------------------|                                 +------------------+
                    |  CIS Routines                    |        +------------------+     | XX-Dependent     |
                    |                                  |<------>| Driver Services  |     | Layers           |
                    |  +----------------------------+  |        |      (ds)        |     +------------------+
                    |  |      Card Services         |  |        +------------------+            ^
                    |  |        (pccardd)           |  |                    ^                   |
                    |  +----------------------------+  |                    |                   |
                    |                                  |                    |                   |
                    |  sysfs / udev Interface          |                    |                   |
                    +----------------------------------+                    |                   |
                           __________|_________                             |                   |
                          |                   |                             |                   |
                          v                   v                             |                   v
        +----------------------+          +-------------------+             |             +---------+
        | Host Controller      |          |      XX_cs        |<------------|             | XX      |
        | Driver               |<-------->| (Client Driver)   |<------------------------->+---------+
        +----------------------+          +-------------------+         IRQ, I/O, Mem         ^
                 |                                      ^                                     |
                 |                                      | CIS Space                           |
                 |                                      |-----------------------------|       | Data
=================|======= HARDWARE ============================                       |       |
                 v                                                                    v       v
   +------------------------------------------+     +----------------+          +----------------+
   | PCMCIA/CardBus Host Controller Bridge    |-----| PCMCIA Socket  |<---------| PCMCIA Card XX |   
   +------------------------------------------+     +----------------+          +----------------+

```

**Hình 9.3. Hệ thống con Linux-PCMCIA.**

```

## Hệ thống con Linux-PCMCIA cũ

Hệ thống con Linux-PCMCIA gần đây đã trải qua một đợt đại tu. Để làm cho PCMCIA hoạt động với các phiên bản kernel 2.6.13 trở lên, bạn cần có gói *pcmciautils* [\(http://kernel.org/pub/linux/utils/kernel/pcmcia/howto.html\)](http://kernel.org/pub/linux/utils/kernel/pcmcia/howto.html), gói này thay thế cho gói *pcmcia-cs* ([http://pcmcia-cs.sourceforge.net\)](http://pcmcia-cs.sourceforge.net) được sử dụng với các kernel trước đó. Các giao diện lập trình kernel nội bộ và cấu trúc dữ liệu cũng đã thay đổi. Các kernel trước đây dựa vào một tiến trình nền (daemon) ở User Space có tên là *cardmgr* để hỗ trợ tính năng cắm nóng (hotplugging), nhưng việc triển khai PCMCIA mới xử lý cắm nóng (hotplug) bằng *udev*, giống như các hệ thống con bus khác. Vì vậy, với các thiết lập mới, bạn không cần *cardmgr* và phải đảm bảo rằng nó không được khởi động. Có một hướng dẫn di chuyển tại <http://kernel.org/pub/linux/utils/kernel/pcmcia/cardmgr-to-pcmciautils.html>.

### Hình 9.3 bao gồm các thành phần sau:

- Các trình điều khiển thiết bị bộ điều khiển máy chủ (host controller device driver) thực hiện các tiến trình (routine) mức thấp để giao tiếp với bộ điều khiển máy chủ PCMCIA (PCMCIA host controller). Thiết bị cầm tay và máy tính xách tay của bạn có các bộ điều khiển máy chủ khác nhau và do đó, sử dụng các trình điều khiển bộ điều khiển máy chủ khác nhau. Mỗi khe cắm PCMCIA mà bộ điều khiển máy chủ hỗ trợ được gọi là một *socket*.
- Các trình điều khiển client PCMCIA (XX_cs trong Hình 9.3) phản hồi các sự kiện socket như cắm và rút thẻ. Đây là trình điều khiển mà bạn có nhiều khả năng phải triển khai nhất khi cố gắng kích hoạt Linux cho một thẻ PCMCIA. Trình điều khiển XX_cs thường hoạt động song song với một trình điều khiển chung (XX trong Hình 9.3) không dành riêng cho PCMCIA. Liên quan đến Hình 9.3, nếu thiết bị của bạn là ổ đĩa IDE PCMCIA, XX là trình điều khiển ổ đĩa IDE, XX_cs là trình điều khiển ide_cs, các tầng phụ thuộc vào XX là các tầng hệ thống tập trung (filesystem layer), và các ứng dụng XX là các chương trình truy cập các tệp dữ liệu. XX_cs cấu hình trình điều khiển chung (XX) với các tài nguyên như IRQ, địa chỉ cơ sở I/O (I/O base address), và cửa sổ bộ nhớ (memory window).
- Nhân PCMCIA (PCMCIA core) cung cấp các dịch vụ cho trình điều khiển bộ điều khiển máy chủ và trình điều khiển client. Nhân cung cấp một cơ sở hạ tầng giúp việc triển khai trình điều khiển trở nên đơn giản hơn và thêm một mức độ gián tiếp (indirection) giúp các trình điều khiển client độc lập với các bộ điều khiển máy chủ. Bất kể bạn đang sử dụng thẻ Bluetooth CF của mình trên thiết bị cầm tay dựa trên XScale hay máy tính xách tay dựa trên x86, các trình điều khiển client tương tự vẫn có thể được đưa vào sử dụng.
- Một mô-đun *driver services* (*ds*) cung cấp các giao diện đăng ký và các dịch vụ bus cho các trình điều khiển client.
- Gói *pcmciautils*, chứa các công cụ như *pccardctl* để điều khiển trạng thái của các socket PCMCIA và lựa chọn giữa các sơ đồ cấu hình thẻ khác nhau.

Hình 9.4 kết nối các mô-đun kernel lên trên Hình 9.1 để minh họa cách hệ thống con Linux-PCMCIA tương tác với phần cứng trên hệ thống tương thích PC.

**Hình 9.4. Liên hệ các thành phần trình điều khiển PCMCIA với phần cứng PC.**

[Xem hình kích thước đầy đủ]

```

+----------------------------+

|  Higher Layers/Applications|
+----------------------------+
+-----------+              +---------------------+                             ^                               +-------------+

| Processor |              | Host Controller     |<----------------------------|------------------------------>| PCMCIA Core |
+-----------+              | Driver              |                +------------+------------+                  +-------------+
^                    +---------------------+                |         XX.ko           |<----------------|      ^

|                        ^                                  +------------+------------+                 |      |
v                        | Interrupts that monitor                       ^                              |      |
+------------+                 | card status                         Device    |                   Resources  |      |

| NorthBridge|                 |                                   Interrupts  |                              |      |
+------------+                 |                                               v                              |      v
^                    +---------------------------+                     +----------------+             +-------------+

|                    | PCMCIA / CardBus          |   +--------+<-------| PCMCIA Card XX |<----------->|  XX_cs.ko   |
v                    | Controller                |---| Socket |        +----------------+             +-------------+
+------------+             +---------------------------+   +--------+

| SouthBridge|                   |
+------------+-------------------|---------|------------------|----------
PCI Bus         PCI Slot    |         PCI Slot |

```

Trong các phần tiếp theo, chúng ta hãy cùng tìm hiểu kỹ hơn về các thành phần cấu thành nên hệ thống con (subsystem) Linux-PCMCIA. Để hiểu rõ hơn về vai trò của các thành phần này và sự tương tác giữa chúng, chúng ta sẽ cắm một thẻ WiFi PCMCIA vào máy tính xách tay và theo dõi luồng mã nguồn (code flow) trong phần "Kết nối các thành phần lại với nhau" ("Tying the Pieces Together").

## Trình điều khiển Bộ điều khiển Host (Host Controller Drivers)

Trong khi trình điều khiển thẻ tổng quát (generic card driver) (XX) chịu trách nhiệm xử lý các ngắt (interrupts) do chức năng của thẻ tạo ra (ví dụ: ngắt nhận khi thẻ mạng PCMCIA nhận được các gói dữ liệu), thì trình điều khiển bộ điều khiển host (host controller driver) chịu trách nhiệm xử lý các ngắt đặc thù của bus (bus-specific interrupts) được kích hoạt bởi các sự kiện như cắm và rút thẻ.

Hình 9.2 cho thấy sơ đồ khối của một thiết bị nhúng (embedded device) được thiết kế xoay quanh một bộ điều khiển nhúng (embedded controller) có tích hợp sẵn hỗ trợ PCMCIA. Ngay cả khi bạn đang sử dụng một bộ điều khiển được hỗ trợ bởi tầng PCMCIA của kernel, bạn vẫn có thể cần phải tinh chỉnh trình điều khiển bộ điều khiển host (ví dụ: để cấu hình các đường GPIO dùng để phát hiện sự kiện cắm thẻ hoặc chuyển đổi nguồn điện cho socket), tùy thuộc vào thiết kế bo mạch (board) của bạn. Ví dụ, nếu bạn đang port (chuyển cảng) kernel sang một thiết bị cầm tay dựa trên kiến trúc StrongARM, hãy tùy chỉnh *drivers/pcmcia/sa1100\_assabet.c* cho phù hợp với phần cứng của bạn.

Chương này không đề cập đến việc cài đặt các trình điều khiển thiết bị bộ điều khiển host (host controller device drivers).

## Nhân PCMCIA (PCMCIA Core)

Card Services (Dịch vụ Thẻ) là thành phần chính của nhân PCMCIA (PCMCIA core). Nó cung cấp một tập hợp các dịch vụ cho các trình điều khiển client (client drivers) và trình điều khiển bộ điều khiển host. Nó chứa một kernel thread (luồng nhân) có tên là *pccardd* để thực hiện polling (thăm dò) các sự kiện liên quan đến socket. Pccardd thông báo cho trình xử lý sự kiện Driver Services (được thảo luận trong phần tiếp theo) khi bộ điều khiển host báo cáo các sự kiện như cắm thẻ và rút thẻ.

Một thành phần khác của nhân PCMCIA là một thư viện thao tác với *Cấu trúc Thông tin Thẻ* (*Card Information Structure* - CIS) vốn là một phần của các thẻ PCMCIA. Các thẻ PCMCIA/CF có hai vùng nhớ (memory spaces): Bộ nhớ *Thuộc tính* (*Attribute* memory) và Bộ nhớ *Chung* (*Common* memory). Bộ nhớ thuộc tính chứa CIS và các thanh ghi cấu hình thẻ. Ví dụ, bộ nhớ thuộc tính của một ổ đĩa cứng PCMCIA IDE chứa CIS của nó và các thanh ghi chỉ định số lượng cung từ (sector count) và số trụ (cylinder number). Bộ nhớ chung trong trường hợp này chứa mảng bộ nhớ lưu trữ dữ liệu ổ đĩa. Nhân PCMCIA cung cấp các hàm thao tác CIS như pccard\_get\_first\_tuple(), pccard\_get\_next\_tuple(), và pccard\_parse\_tuple() cho các trình điều khiển client. Liệt kê (Listing) 9.2 sử dụng sự hỗ trợ của một số hàm này.

Nhân PCMCIA chuyển thông tin CIS sang user space (vùng người dùng) thông qua sysfs và udev. Các tiện ích như pccardctl, một phần của gói pcmciautils, phụ thuộc vào sysfs và udev để hoạt động. Điều này đơn giản hóa cách tiếp cận thiết kế trước đây vốn phụ thuộc vào một cơ sở hạ tầng tùy chỉnh khi các tiện ích này chưa có sẵn trong kernel.

## Dịch vụ Trình điều khiển (Driver Services)

Driver Services cung cấp một cơ sở hạ tầng cung cấp các thành phần sau:

- Một trình xử lý (handler) bắt các cảnh báo sự kiện được điều phối bởi luồng nhân pccardd. Trình xử lý này quét và xác thực không gian CIS của thẻ, đồng thời kích hoạt việc nạp (load) một trình điều khiển client phù hợp.
- Một tầng có nhiệm vụ giao tiếp với bus core (lõi bus) của kernel. Để đạt được mục đích này, Driver Services thực thi pcmcia\_bus\_type và các thao tác bus liên quan.
- Các hàm dịch vụ (service routines) như pcmcia\_register\_driver() mà các trình điều khiển client sử dụng để đăng ký chúng với nhân PCMCIA. Trình điều khiển mẫu trong Liệt kê 9.1 sử dụng một số hàm này.

## Trình điều khiển Client (Client Drivers)

Trình điều khiển thiết bị client (XX\_cs trong Hình 9.3) xem xét không gian CIS của thẻ và cấu hình thẻ tùy thuộc vào thông tin mà nó thu thập được.

## Cấu trúc dữ liệu

Trước khi tiến hành phát triển một trình điều khiển thiết bị (driver) client PCMCIA ví dụ, hãy tìm hiểu một số cấu trúc dữ liệu liên quan:

Một thiết bị PCMCIA được định danh bằng cấu trúc pcmcia\_device\_id được định nghĩa trong *include/linux/mod\_devicetable.h*: **1.**

```

struct pcmcia_device_id {
/* ... */
__u16 manf_id; /* Manufacturer ID */
__u16 card_id; /* Card ID */
__u8 func_id; /* Function ID */
/* ... */
};

```

manf\_id, card\_id và func\_id lần lượt lưu trữ ID nhà sản xuất (manufacturer ID), ID thẻ (card ID) và ID chức năng (function ID) của thẻ. Nhân (Kernel) PCMCIA cung cấp một macro mang tên PCMCIA\_DEVICE\_MANF\_CARD() dùng để tạo một cấu trúc pcmcia\_device\_id từ các ID nhà sản xuất và ID thẻ được cung cấp cho nó. Một macro kernel khác có tên MODULE\_DEVICE\_TABLE() đánh dấu các pcmcia\_device\_id được hỗ trợ trong image của module (module image) để module có thể được tải theo yêu cầu (on demand) khi thẻ được cắm vào và hệ thống con (subsystem) PCMCIA thu thập các ID nhà sản xuất/thẻ/chức năng khớp với nhau từ vùng không gian CIS (CIS space) của thẻ. Chúng ta đã khám phá cơ chế này trong phần "Module Autoload" ở Chương 4, "Đặt nền móng" (Laying the Groundwork). Quy trình này tương tự như quy trình được sử dụng bởi các device driver cho hai bus I/O phổ biến khác hỗ trợ tính năng cắm nóng (hotplugging): PCI và USB. Bảng 9.1 cung cấp cái nhìn tổng quan về những điểm tương đồng giữa các driver cho ba công nghệ bus này. Đừng lo lắng nếu điều đó khó tiêu hóa; chúng ta sẽ có một cuộc thảo luận chi tiết về PCI và USB trong các chương tiếp theo.

**Bảng 9.1. ID thiết bị và các phương thức cắm nóng (Hotplug) cho PCMCIA, PCI và USB**

|                                | PCMCIA                                 | PCI                     | USB                                 |
|--------------------------------|----------------------------------------|-------------------------|-------------------------------------|
| Cấu trúc bảng<br>ID thiết bị   | pcmcia_device_id                       | pci_device_id           | usb_device_id                       |
| Macro để tạo<br>một ID thiết bị| PCMCIA_DEVICE_MANF_CARD() PCI_DEVICE() |                         | USB_DEVICE()                        |
| Thể hiện<br>thiết bị           | struct pcmcia_device                   | struct pci_dev          | struct usb_device                   |
| Thể hiện<br>driver             | struct pcmcia_driver                   |                         | struct pci_driver struct usb_driver |
| Phương thức<br>cắm nóng        | probe() và remove()                    | probe() và<br>remove()  | probe() và<br>disconnect()          |
| Phát hiện sự kiện<br>cắm nóng  | pccardd kthread                        | Phụ thuộc<br>vào dòng PCI| khubd kthread                       |

Các PCMCIA client driver cần liên kết bảng pcmcia\_device\_id của chúng với các phương thức probe() và remove(). Sự kết hợp này đạt được thông qua cấu trúc pcmcia\_driver: **2.**

```

struct pcmcia_driver {
int (*probe)(struct pcmcia_device *dev); /* Probe
method */
void (*remove)(struct pcmcia_device *dev); /* Remove
method */
/* ... */
struct pcmcia_device_id *id_table; /* Device ID
table */
/* ... */
};

```

struct pcmcia\_device đại diện cho một thiết bị PCMCIA ở bên trong kernel và được định nghĩa như sau trong *drivers/pcmcia/ds.h*: **3.**

```

struct pcmcia_device {
/* ... */
io_req_t io; /* I/O attributes*/
irq_req_t irq; /* IRQ settings */
config_req_t conf; /* Configuration */
/* ... */
struct device dev; /* Connection to device model */
/* ... */
};

```

Các routines thao tác CIS sử dụng cấu trúc tuple\_t được định nghĩa trong *include/pcmcia/cistpl.h* để chứa một đơn vị thông tin CIS (CIS information unit). Ví dụ, một kiểu tuple CISTPL\_LONGLINK\_MFC chứa thông tin liên quan đến thẻ đa chức năng (multifunction card). Để có danh sách đầy đủ các tuple và mô tả của chúng, hãy xem *include/pcmcia/cistpl.h* và <http://pcmcia-cs.sourceforge.net/ftp/doc/PCMCIA-PROG.html>. **4.**

```

typedef struct tuple_t {
/* ... */
cisdata_t TupleCode; /* See
include/pcmcia/cistpl.h */
/* ... */
cisdata_t DesiredTuple; /* Identity of the desired
tuple */
/* ... */
cisdata_t *TupleData; /* Buffer space */
};

```

CIS chứa các mục bảng cấu hình (configuration table entries) cho mỗi cấu hình mà thẻ hỗ trợ. cistpl\_cftable\_entry\_t, được định nghĩa trong *include/pcmcia/cistpl.h*, lưu giữ một mục như vậy: **5.**

```

typedef struct cistpl_cftable_entry_t {
/* ... */
cistpl_power_t vcc, vpp1, vpp2; /* Voltage level */
cistpl_io_t io; /* I/O attributes */
cistpl_irq_t irq; /* IRQ settings */
cistpl_mem_t mem; /* Memory window */
/* ... */
};

```

cisparse\_t, cũng được định nghĩa trong *include/pcmcia/cistpl.h*, lưu giữ một tuple đã được phân tích cú pháp (parsed) bởi nhân PCMCIA: **6.**

```

typedef union cisparse_t {
/* ... */
cistpl_manfid_t manfid; /* Manf ID */
/* ... */
cistpl_cftable_entry_t cftable_entry; /* Configuration
table entry */
/* ... */
} cisparse_t;

```

## Ví dụ về thiết bị: Thẻ PCMCIA (PCMCIA Card)

Hãy phát triển một trình điều khiển thiết bị (device driver) khách dạng khung (skeletal client device driver) — vì quá nhiều chi tiết sẽ làm cho nội dung trở nên quá tải — để tìm hiểu cách thức hoạt động của hệ thống con (subsystem) PCMCIA. Việc cài đặt mang tính tổng quát, vì vậy bạn có thể sử dụng nó làm mẫu (template) bất kể thẻ của bạn thực hiện tính năng mạng (networking), lưu trữ (storage), hay công nghệ nào khác. Chỉ có trình điều khiển `XX_cs` được cài đặt; trình điều khiển chung `XX` được giả định là đã có sẵn dưới dạng thương mại (off the shelf).

Như đã đề cập trước đó, các trình điều khiển PCMCIA chứa các phương thức `probe()` và `remove()` để hỗ trợ tính năng cắm nóng (hotplugging). Liệt kê 9.1 (Listing 9.1) đăng ký phương thức `probe()`, phương thức `remove()`, và bảng `pcmcia_device_id` của trình điều khiển với lõi (core) PCMCIA. `XX_probe()` được gọi (invoked) khi thẻ PCMCIA tương ứng được cắm vào, và `XX_remove()` được gọi khi thẻ bị đẩy ra.

**Liệt kê 9.1. Đăng ký một Trình điều khiển Khách (Client Driver)**

```c

## include <pcmcia/ds.h> /* Definition of struct pcmcia_device */

static struct pcmcia_driver XX_cs_driver = {
.owner = THIS_MODULE,
.drv = {
.name = "XX_cs", /* Name */
},
.probe = XX_probe, /* Probe */
.remove = XX_remove, /* Release */
.id_table = XX_ids, /* ID table */
.suspend = XX_suspend, /* Power management */
.resume = XX_resume, /* Power management */
};

## define XX_MANFUFACTURER_ID 0xABCD /* Device's manf_id */

## define XX_CARD_ID 0xCDEF /* Device's card_id */

/* Identity of supported cards */
static struct pcmcia_device_id XX_ids[] = {
PCMCIA_DEVICE_MANF_CARD(XX_MANFUFACTURER_ID, XX_CARD_ID),
PCMCIA_DEVICE_NULL,
};
MODULE_DEVICE_TABLE(pcmcia, XX_ids); /* For module autoload */
/* Initialization */
static int __init
init_XX_cs(void)
{
return pcmcia_register_driver(&XX_cs_driver);
}

```

```c

/* Probe Method */
static int
XX_probe(struct pcmcia_device *link)
{
/* Populate the pcmcia_device structure allotted for this card by
the core. First fill in general information */
/* ... */
/* Fill in attributes related to I/O windows and
interrupt levels */
XX_config(link); /* See Listing 9.2 */
}

```

Liệt kê 9.2 hiển thị hàm thủ tục (routine) cấu hình trình điều khiển thiết bị chung (`XX`) với các thông tin tài nguyên như địa chỉ cơ sở của cửa sổ I/O và bộ nhớ (I/O and memory window base addresses). Sau bước này, luồng dữ liệu đến và đi từ thẻ PCMCIA sẽ đi qua `XX` và trở nên trong suốt (transparent) đối với các tầng còn lại. Bất kỳ ngắt (interrupt) nào được tạo ra bởi thẻ PCMCIA, chẳng hạn như các ngắt liên quan đến việc nhận dữ liệu hoặc hoàn tất truyền dữ liệu đối với thẻ mạng, sẽ được xử lý bởi trình xử lý ngắt (interrupt handler) vốn là một phần của `XX`. Liệt kê 9.2 được xây dựng dựa trên `drivers/net/wireless/airo_cs.c`, trình điều khiển khách dành cho dòng thẻ PCMCIA WiFi Cisco Aironet 4500 và 4800. Liệt kê này sử dụng các dịch vụ của lõi PCMCIA để thực hiện các công việc sau:

- Lấy một bộ dữ liệu (tuple) mục nhập bảng cấu hình phù hợp từ CIS của thẻ
- Phân tích cú pháp (parse) bộ dữ liệu đó
- Thu thập thông tin cấu hình thẻ như địa chỉ cơ sở I/O và các thiết lập nguồn điện từ bộ dữ liệu đã phân tích
- Yêu cầu cấp phát một đường ngắt (interrupt line)

Sau đó, nó cấu hình trình điều khiển đặc thù cho chipset (`XX`) bằng thông tin đã thu được trước đó.

### Liệt kê 9.2. Cấu hình Trình điều khiển Thiết bị Tổng quát (Generic Device Driver)

```c

## include <pcmcia/cistpl.h>

## include <pcmcia/ds.h>

## include <pcmcia/cs.h>

## include <pcmcia/cisreg.h>

/* Điều này làm cho thiết bị XX khả dụng đối với hệ thống. XX_config()
dựa trên airo_config(), được định nghĩa trong
drivers/net/wireless/airo_cs.c */
static int
XX_config(struct pcmcia_device *link)
{
tuple_t tuple;
cisparse_t parse;
u_char buf[64];
/* Điền thông tin nhận dạng của tuple mong muốn vào cấu trúc tuple_t.
Trong trường hợp này, chúng ta đang tìm kiếm một mục
mục cấu hình bảng (configuration table entry) */
tuple.DesiredTuple = CISTPL_CFTABLE_ENTRY;
tuple.Attributes = 0;
tuple.TupleData = buf;
tuple.TupleDataMax = sizeof(buf);
/* Quét không gian CIS để tìm tuple khớp và thu thập thông tin
cấu hình thẻ như các địa chỉ cơ sở của cửa sổ I/O (I/O window base addresses) */
/* Lấy tuple đầu tiên */
CS_CHECK(GetFirstTuple, pcmcia_get_first_tuple(link, &tuple));
while (1){
cistpl_cftable_entry_t dflt = {0};
cistpl_cftable_entry_t *cfg = &(parse.cftable_entry);
/* Đọc một tuple cấu hình từ không gian CIS của thẻ */
if (pcmcia_get_tuple_data(link, &tuple) != 0 ||
pcmcia_parse_tuple(link, &tuple, &parse) != 0) {
goto next_entry;
}
/* Chúng ta đã có một tuple khớp! */
/* Cấu hình các thiết lập nguồn trong pcmcia_device dựa trên
những gì được tìm thấy trong mục tuple đã phân tích */
if (cfg->vpp1.present & (1<<CISTPL_POWER_VNOM))
link->conf.Vpp = cfg->vpp1.param[CISTPL_POWER_VNOM]/10000;
/* ... */
/* Cấu hình các thiết lập cửa sổ I/O trong pcmcia_device dựa trên
những gì được tìm thấy trong mục tuple đã phân tích */
if ((cfg->io.nwin > 0) || (dflt.io.nwin > 0)) {
cistpl_io_t *io = (cfg->io.nwin) ? &cfg->io : &dflt.io;
/* ... */
if (!(io->flags & CISTPL_IO_8BIT)) {
link->io.Attributes1 = IO_DATA_PATH_WIDTH_16;
}
link->io.BasePort1 = io->win[0].base;
/* ... */
}
/* ... */
break;
next_entry:
CS_CHECK(GetNextTuple, pcmcia_get_next_tuple(link, &tuple);
}
/* Cấp phát IRQ */
if (link->conf.Attributes & CONF_ENABLE_IRQ) {
CS_CHECK(RequestIRQ, pcmcia_request_irq(link, &link->irq));
}
/* ... */
/* Gọi init_XX_card(), hàm này là một phần của trình điều khiển XX
tổng quát (generic) (do đó không được hiển thị trong đoạn mã này), và truyền
thông tin cơ sở I/O và IRQ thu được ở trên */
init_XX_card(link->irq.AssignedIRQ, link->io.BasePort1,
1, &handle_to_dev(link));

```

```c

/* Trình điều khiển đặc thù cho chip (không phụ thuộc vào form factor) đã sẵn sàng
tiếp quản trách nhiệm của thẻ này từ thời điểm này trở đi! */
}

```

## Kết nối các thành phần lại với nhau

Như bạn đã thấy trong Hình 9.3, tầng (layer) PCMCIA bao gồm nhiều thành phần khác nhau. Đường đi dữ liệu (data-flow path) giữa các thành phần đôi khi có thể trở nên phức tạp. Hãy cùng theo dõi luồng mã nguồn (code path) từ thời điểm bạn cắm thẻ PCMCIA cho đến khi một ứng dụng bắt đầu truyền dữ liệu tới thẻ. Giả sử rằng thẻ Cisco Aironet PCMCIA được cắm vào một máy tính xách tay có bộ điều khiển máy chủ (host controller) PCMCIA tương thích với 82365:

- **1.** Trình điều khiển bộ điều khiển máy chủ PCMCIA (*drivers/pcmcia/yenta\_socket.c*) phát hiện sự kiện cắm thẻ thông qua routine dịch vụ ngắt (interrupt service routine) của nó và ghi nhận lại sự kiện này bằng cách sử dụng các cấu trúc dữ liệu phù hợp.
- **2.** Luồng nhân (kernel thread) `pccardd` là một phần của Dịch vụ Thẻ (Card Services - *drivers/pcmcia/cs.c*) sẽ ngủ (sleep) trên hàng đợi chờ (wait queue) cho đến khi trình điều khiển bộ điều khiển máy chủ đánh thức nó dậy khi phát hiện ra sự kiện cắm thẻ ở Bước 1.
- **3.** Dịch vụ Thẻ (Card Services) phân phối sự kiện cắm thẻ cho Dịch vụ Trình điều khiển (Driver Services - *drivers/pcmcia/ds.c*). Điều này kích hoạt việc thực thi bộ xử lý sự kiện (event handler) được đăng ký bởi Dịch vụ Trình điều khiển trong quá trình khởi tạo.
- **4.** Dịch vụ Trình điều khiển xác thực không gian CIS của thẻ, xác định thông tin về thiết bị được cắm vào như ID nhà sản xuất (manufacturer ID) và ID thẻ (card ID), đồng thời đăng ký thiết bị với kernel. Trình điều khiển thiết bị khách (client device driver) phù hợp (*drivers/net/wireless/airo\_cs.c*) sau đó được tải vào. Hãy xem lại phần thảo luận trước đó của chúng tôi về `MODULE_DEVICE_TABLE()` để thấy cách thức này được thực hiện.
- **5.** Trình điều khiển khách (*airo\_cs.c*) được tải ở Bước 4 sẽ tự khởi tạo và đăng ký bằng cách sử dụng `pcmcia_register_driver()`, như được hiển thị trong Liệt kê 9.1. Giao diện đăng ký này thiết lập ngầm định (internally) loại bus của thiết bị thành `pcmcia_bus_type`. Các thao tác trên bus PCMCIA như `probe()` và `remove()`, được định nghĩa bởi Dịch vụ Trình điều khiển (*ds.c*), cũng được đăng ký ngầm định bên trong.
- **6.** Kernel gọi thao tác `probe()` của bus được đăng ký bởi Dịch vụ Trình điều khiển ở Bước 5. Thao tác này, lần lượt, gọi phương thức `probe()` thuộc về trình điều khiển khách phù hợp (`airo_probe()`), cũng được đăng ký ở Bước 5. Routine `probe()` của client điền các thiết lập như cửa sổ I/O và đường ngắt, đồng thời cấu hình trình điều khiển tổng quát đặc thù cho chipset (*drivers/net/wireless/airo.c*), như được minh họa trong Liệt kê 9.2.
- **7.** Trình điều khiển chipset (*airo.c*) tạo ra một giao diện mạng (`ethX`) và chịu trách nhiệm cho hoạt động bình thường kể từ thời điểm này trở đi. Chính trình điều khiển này xử lý các ngắt do thẻ tạo ra để phản hồi lại việc nhận gói tin (packet reception) và hoàn tất truyền tin (transmit completion). Hình dạng kích thước vật lý (form factor) của thiết bị (ví dụ: đó là thẻ PCMCIA hay thẻ PCI) là hoàn toàn trong suốt (transparent) đối với trình điều khiển chipset cũng như đối với các ứng dụng hoạt động thông qua `ethX`.

## Lưu trữ PCMCIA (PCMCIA Storage)

Hỗ trợ lưu trữ PCMCIA/CF hiện nay đạt mật độ dung lượng lên đến cấp độ gigabyte. Các thẻ lưu trữ có nhiều chủng loại khác nhau:

- Các ổ đĩa cứng IDE thu nhỏ hoặc microdrive. Đây là những phiên bản thu nhỏ của ổ đĩa cứng cơ học sử dụng phương tiện lưu trữ từ tính. Tốc độ truyền dữ liệu của chúng thường cao hơn các thiết bị bộ nhớ thể rắn (solid-state memory devices), nhưng ổ đĩa IDE có độ trễ khởi động (spin-up) và tìm kiếm (seek latency) trước khi dữ liệu có thể được truyền đi. Trình điều khiển Dịch vụ Thẻ IDE (IDE Card Services driver) *ide\_cs*, kết hợp với các trình điều khiển IDE kế thừa (legacy IDE drivers), được sử dụng để giao tiếp với các thẻ nhớ như vậy.
- Các thẻ nhớ thể rắn (solid-state memory cards) giả lập IDE. Các thẻ này không có bộ phận chuyển động và thường dựa trên bộ nhớ flash (flash memory), điều này vốn trong suốt (transparent) đối với hệ điều hành nhờ vào việc giả lập IDE. Do các ổ đĩa này thực chất dựa trên nền tảng IDE, nên cùng một trình điều khiển Dịch vụ Thẻ IDE (`ide_cs`) có thể được sử dụng để giao tiếp với chúng.
- Các thẻ nhớ sử dụng bộ nhớ flash, nhưng không giả lập IDE. Trình điều khiển Dịch vụ Thẻ *memory\_cs* cung cấp các giao diện khối (block interfaces) và giao diện ký tự (character interfaces) cho các thẻ đó. Giao diện khối được sử dụng để đưa một hệ thống tập tin (filesystem) lên bộ nhớ của thẻ, trong khi giao diện ký tự được sử dụng để truy cập dữ liệu thô (raw data). Bạn cũng có thể sử dụng `memory_cs` để đọc vùng nhớ thuộc tính (attribute memory space) của bất kỳ thẻ PCMCIA nào.

## PCMCIA nối tiếp (Serial PCMCIA)

Nhiều công nghệ mạng như *Dịch vụ vô tuyến gói chung* (General Packet Radio Service - GPRS), *Hệ thống toàn cầu cho truyền thông di động* (Global System for Mobile Communications - GSM), *Hệ thống định vị toàn cầu* (Global Positioning System - GPS) và Bluetooth sử dụng cơ chế truyền dữ liệu nối tiếp (serial transport mechanism) để giao tiếp với các hệ thống máy chủ (host systems). Trong phần này, chúng ta hãy cùng tìm hiểu cách tầng PCMCIA xử lý các thẻ có các công nghệ như vậy. Lưu ý rằng phần này chỉ nhằm giúp bạn hiểu phần giao diện bus của các thẻ GPRS, GSM và Bluetooth có form factor PCMCIA/CF. Bản thân các công nghệ này được thảo luận chi tiết trong Chương 16, "Linux Không dây" (Linux Without Wires).

Trình điều khiển Dịch vụ Thẻ nối tiếp tổng quát (generic serial Card Services driver), *serial\_cs*, cho phép phần còn lại của hệ điều hành nhìn nhận thẻ PCMCIA/CF như một thiết bị nối tiếp (serial device). Thiết bị nối tiếp chưa sử dụng đầu tiên, */dev/ttySX*, sẽ được cấp phát cho thẻ. Do đó, `serial_cs` giả lập một cổng nối tiếp (serial port) trên các thẻ GPRS, GSM và GPS. Nó cũng cho phép các thẻ Bluetooth PCMCIA/CF sử dụng phương thức truyền nối tiếp để chuyển các gói tin *Giao diện Điều khiển Máy chủ* (Host Control Interface - HCI) sang các tầng giao thức Bluetooth.

Hình 9.5 minh họa cách các mô-đun nhân (kernel modules) thực thi các công nghệ mạng khác nhau tương tác với `serial_cs` để giao tiếp với các thẻ tương ứng của chúng.

**Hình 9.5. Mạng với các thẻ PCMCIA/CF sử dụng phương thức truyền nối tiếp.**

[Xem hình kích thước đầy đủ]

```

Không gian Người dùng (User Space)
-----------------------------------------------------------------
[ Mạng Bluetooth ]         [ Trình quay số điện thoại, Ứng dụng mạng ]
[ (Duyệt WEP..)                    ]   [ Ứng dụng GPS ]
^                             ^                                   ^

|                             |                                   |
v                             v                                   |
[ Ngăn xếp Bluetooth BlueZ ]   [ Cấu hình GPRS/GSM ]                       |
^                             ^                                   |

|                             |                                   |
v                             v                                   |
[ Kỷ luật đường truyền HCI ]   [ Ngăn xếp PPP ]                            |
^                             ^                                   |

|                             |                                   |
v                             v                                   |
(Bluetooth)               [ Kỷ luật đường truyền PPP ]                |
\                    ^                                     |
\                  /                                      |
\                /                                       |
\              /                                        |
\            /                                         |
\          /     |------------------------------------|
v        v      v
[ Trình điều khiển Nối tiếp (Serial Driver) ]

^  \
|   \  IRQ, Cửa sổ I/O (I/O Windows)
|    v
|  [ serial_cs ]<-------------------|
|        ^                          |
|        |                          |
|        v                          |
|   [ Nhân PCMCIA (PCMCIA Core) ]   |
|                                   |
v                                   |
[ Thẻ PCMCIA Nối tiếp ]<--------------------|

|
v
[ Socket PCMCIA ]

|
|
[ Cầu nối Bộ điều khiển Máy chủ PCMCIA/CardBus ]

```

Giao thức *Point-to-Point Protocol* (PPP) cho phép các giao thức mạng như TCP/IP chạy trên một liên kết nối tiếp (serial link). Trong bối cảnh của Hình 9.5, PPP giúp các ứng dụng TCP/IP chạy trên các kết nối quay số (dialup) GPRS và GSM. Tiến trình nền PPP daemon (*pppd*) kết nối thông qua các cổng nối tiếp ảo (virtual serial ports) được mô phỏng bởi serial\_cs. Các module nhân (kernel modules) của PPP—*ppp\_generic, ppp\_async*, và *slhc*—phải được nạp (load) để pppd có thể hoạt động. Hãy gọi (invoke) pppd như sau:

### bash> pppd ttySX call connection-script

trong đó *connection-script* là một tập tin chứa các chuỗi lệnh mà pppd trao đổi với nhà cung cấp dịch vụ để thiết lập một liên kết. Kịch bản kết nối này phụ thuộc vào thẻ (card) cụ thể đang được sử dụng. Một thẻ GPRS sẽ cần một chuỗi ngữ cảnh (context string) được gửi như một phần của kịch bản kết nối, trong khi một thẻ GSM có thể cần trao đổi mật khẩu. Một kịch bản kết nối ví dụ được mô tả trong phần "GPRS" ở Chương 16.

## Gỡ lỗi (Debugging)

Để gỡ lỗi hiệu quả cho các trình điều khiển khách (client drivers) PCMCIA/CF, bạn cần xem các thông báo gỡ lỗi được phát ra bởi nhân PCMCIA (PCMCIA core). Đối với việc này, hãy bật tùy chọn CONFIG\_PCMCIA\_DEBUG (*Bus options PCCARD support Enable PCCARD debugging*) trong quá trình cấu hình nhân (kernel configuration). Các mức độ chi tiết (verbosity levels) của đầu ra gỡ lỗi có thể được điều khiển thông qua tham số dòng lệnh nhân `pcmcia_core.pc_debug` hoặc sử dụng tham số nạp module `pc_debug`.

Thông tin về các trình điều khiển khách PC Card có sẵn trong mục của hệ thống tập tin tiến trình (process filesystem), */proc/bus/pccard/drivers*. Hãy xem tại */sys/bus/pcmcia/devices/\** để biết các thông tin cụ thể về thẻ như nhà sản xuất và ID của thẻ. Hãy kiểm tra bên trong */proc/bus/pci/* để biết thêm chi tiết về bộ điều khiển máy chủ (host controller) PCMCIA của bạn nếu hệ thống sử dụng cầu nối PCI-to-PCMCIA. */proc/interrupts* liệt kê các IRQ đang hoạt động trên hệ thống của bạn, bao gồm cả các IRQ được sử dụng bởi tầng PCMCIA.

Có một danh sách thư điện tử (mailing list) dành riêng cho Linux-PCMCIA tại [http://lists.infradead.org/mailman/listinfo/linux-pcmcia.](http://lists.infradead.org/mailman/listinfo/linux-pcmcia)

## Xem xét mã nguồn (Looking at the Sources)

Trong cây mã nguồn Linux (Linux source tree), thư mục *drivers/pcmcia/* chứa mã nguồn cho Dịch vụ Thẻ (Card Services), Dịch vụ Trình điều khiển (Driver Services) và các trình điều khiển bộ điều khiển máy chủ (host controller drivers). Hãy xem *drivers/pcmcia/yenta\_socket.c* để biết trình điều khiển bộ điều khiển máy chủ chạy trên nhiều máy tính xách tay dựa trên kiến trúc x86. Các tập tin tiêu đề (header files) có trong *include/pcmcia/* chứa các định nghĩa cấu trúc liên quan đến PCMCIA.

Các trình điều khiển khách (client drivers) nằm cùng với các trình điều khiển khác thuộc lớp thiết bị liên quan (associated device class). Do đó, bạn sẽ tìm thấy các trình điều khiển cho thẻ mạng PCMCIA bên trong *drivers/net/pcmcia/*. Trình điều khiển khách cho các thiết bị bộ nhớ PCMCIA mô phỏng IDE là *drivers/ide/legacy/ide-cs.c*. Hãy xem *drivers/serial/serial\_cs.c* đối với trình điều khiển khách được sử dụng bởi modem PCMCIA.

Bảng 9.2 tóm tắt các cấu trúc dữ liệu chính được sử dụng trong chương này và vị trí của chúng trong cây nhân (kernel tree). Bảng 9.3 liệt kê các giao diện lập trình nhân (kernel programming interfaces) chính mà bạn đã sử dụng trong chương này cùng với vị trí các định nghĩa của chúng.

**Bảng 9.2. Tóm tắt các cấu trúc dữ liệu**

| Cấu trúc dữ liệu                               | Vị trí                                                     | Mô tả                                                                        |
|------------------------------------------------|------------------------------------------------------------|------------------------------------------------------------------------------|
| pcmcia_device_id                               | include/linux/mod_devicetable.h Nhận diện của một thẻ PCMCIA. |                                                                              |
| pcmcia_device                                  | include/pcmcia/ds.h                                        | Sự thể hiện của một thiết bị<br>PCMCIA.                                      |
| pcmcia_driver                                  | include/pcmcia/ds.h                                        | Sự thể hiện của một trình điều khiển<br>khách PCMCIA.                        |
| tuple_t                                        | include/pcmcia/cistpl.h                                    | Các hàm xử lý CIS sử dụng cấu<br>trúc tuple_t để lưu trữ thông tin.          |
| cistpl_cftable_entry_t include/pcmcia/cistpl.h |                                                            | Mục nhập bảng cấu hình trong<br>không gian CIS.                              |
| cisparse_t                                     | include/pcmcia/cistpl.h                                    | Một tuple CIS đã được phân tích cú pháp.     |

**Bảng 9.3. Tóm tắt các Giao diện Lập trình Nhân**

| Giao diện Nhân (Kernel Interface)                                           | Vị trí                                                      | Mô tả                                  |
|-----------------------------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------|

| pcmcia_register_driver()                                                    | drivers/pcmcia/ds.c                                         | Đăng ký một driver với PCMCIA core<br>(lõi PCMCIA) |
| pcmcia_unregister_driver() drivers/pcmcia/ds.c                              |                                                             | Hủy đăng ký một driver khỏi PCMCIA core<br>(lõi PCMCIA) |
| pcmcia_get_first_tuple()<br>pcmcia_get_tuple_data()<br>pcmcia_parse_tuple() | include/pcmcia/cistpl.c<br>drivers/pcmcia/cistpl.c          | Các hàm thư viện để thao tác<br>trên CIS space (khu vực CIS) |
| pcmcia_request_irq()                                                        | drivers/pcmcia/pcmcia_resource.c Nhận một IRQ được gán cho một | Thẻ PCMCIA (PCMCIA card) |
