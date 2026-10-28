# Chương 10: Chuẩn liên kết thiết bị ngoại vi (PCI - Peripheral Component Interconnect)

| Trong Chương Này                        |     |
|----------------------------------------|-----|
| Họ thiết bị PCI                        | 278 |
| Địa chỉ hóa và Nhận dạng                 | 281 |
| Truy cập các Vùng nhớ PCI              | 285 |
| Truy nhập Bộ nhớ Trực tiếp (DMA)       | 288 |
| Ví dụ về Thiết bị: Thẻ Ethernet-Modem  | 292 |
| Gỡ lỗi (Debugging)                     | 308 |
| Xem xét Mã nguồn                        | 308 |

*Peripheral Component Interconnect* (PCI) là một trục xương sống I/O có mặt ở khắp mọi nơi. Cho dù bạn đang sao lưu dữ liệu trên máy chủ lưu trữ (storage server), quay video từ máy tính để bàn (desktop), hay lướt web từ máy tính xách tay (laptop), PCI có thể vẫn đang phục vụ bạn dưới hình thức này hay hình thức khác. PCI, cùng với các yếu tố hình thức (form factor) được phỏng theo hoặc bắt nguồn từ PCI như Mini PCI, CardBus, PCI Extended, PCI Express, PCI Express Mini Card và Express Card đã trở thành các công nghệ kết nối thiết bị ngoại vi thực tế (de facto) trên các máy tính ngày nay.

## Họ thiết bị PCI

PCI là một bus tốc độ cao được sử dụng để giao tiếp giữa CPU và các thiết bị I/O. Đặc tả kỹ thuật của PCI cho phép truyền 32 bit dữ liệu song song (in parallel) ở tần số 33MHz hoặc 66MHz, đạt thông lượng tối đa 266MBps.

CardBus là một biến thể của PCI và có hình thức của một thẻ PC Card. Các thẻ CardBus cũng có độ rộng 32-bit và chạy ở tần số 33MHz. Mặc dù các thẻ CardBus và PCMCIA sử dụng cùng loại đầu nối 68 chân, các thiết bị CardBus hỗ trợ 32 đường dữ liệu so với 16 đường của PCMCIA thông qua kỹ thuật ghép kênh (multiplexing) các đường địa chỉ và dữ liệu giống như cách thực hiện trong bus PCI.

Mini PCI, cũng là một bus 32-bit chạy ở tần số 33MHz, là một sự thích ứng khác của PCI được tìm thấy trong các máy tính có kích thước nhỏ gọn như laptop. Một thẻ PCI có thể giao tiếp thông qua khe cắm Mini PCI bằng cách sử dụng đầu nối tương thích.

Một phần mở rộng của PCI có tên gọi là PCI Extended (hoặc PCI-X) mở rộng độ rộng bus lên 64 bit, tần số lên 133MHz và thông lượng lên tới khoảng 1GBps. PCI-X 2.0 là phiên bản hiện tại của tiêu chuẩn này.

PCI Express (PCIe hoặc PCI-E) là thế hệ hiện tại của họ PCI. Không giống như bus PCI song sóng (parallel), PCIe sử dụng giao thức nối tiếp (serial protocol) để truyền dữ liệu. PCIe hỗ trợ tối đa 32 *liên kết* (link) nối tiếp. Mỗi liên kết PCIe (trong phiên bản đặc tả 1.1 được sử dụng phổ biến) mang lại thông lượng 250MBps theo mỗi chiều truyền, do đó tạo ra tốc độ dữ liệu PCIe tối đa 8GBps theo mỗi chiều. PCIe 2.0 là phiên bản hiện tại của tiêu chuẩn này và hỗ trợ tốc độ dữ liệu cao hơn.

Giao tiếp nối tiếp (serial communication) nhanh hơn và rẻ hơn so với truyền dữ liệu song song do không có các yếu tố như nhiễu tín hiệu (signal interference), vì vậy xu hướng của ngành công nghệ là chuyển dịch từ các bus song song sang các công nghệ nối tiếp. PCIe và các biến thể của nó nhằm thay thế PCI cùng các dẫn xuất của nó, và sự chuyển đổi này cũng là một phần của sự thay đổi phương pháp luận từ giao tiếp song song sang giao tiếp nối tiếp. Một số giao diện I/O được thảo luận trong cuốn sách này, chẳng hạn như RS-232, USB, FireWire, SATA, Ethernet, Fibre Channel và InfiniBand, đều là kiến trúc giao tiếp nối tiếp.

Tương đương với CardBus trong họ PCIe chính là Express Card. Các thẻ Express Card kết nối trực tiếp với bus hệ thống thông qua liên kết PCIe hoặc USB 2.0 (sẽ được thảo luận ở chương tiếp theo), và bỏ qua các thành phần trung gian như bộ điều khiển CardBus (CardBus controller). Người họ hàng của Mini PCI trong họ PCIe chính là PCI Express Mini Card.

Các dòng laptop gần đây hỗ trợ các khe cắm Express Card thay cho (hoặc bổ sung cho) CardBus, và các khe cắm PCI Express Mini Card thay cho Mini PCI. Hai loại trước có kích thước nhỏ gọn hơn và tốc độ cao hơn so với hai loại sau.

Bảng 10.1 tóm tắt các họ hàng quan trọng của PCI. Từ góc nhìn của nhân hệ điều hành (kernel), tất cả các công nghệ này đều tương thích với nhau. Một trình điều khiển (driver) PCI trong kernel sẽ hoạt động với tất cả các công nghệ liên quan đã đề cập trước đó; vì vậy mặc dù chúng ta dựa vào mã nguồn ví dụ trong chương này trên một thẻ CardBus, các khái niệm này vẫn áp dụng cho các biến thể PCI khác.

**Bảng 10.1. Các Anh em, Con cháu và Họ hàng của PCI**

| Tên Bus               | Đặc điểm                                                                                                                  | Yếu tố Hình thức (Form Factor)                                                                                            |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| PCI                   | Bus 32-bit ở tần số 33MHz hoặc 66MHz;<br>đạt thông lượng lên đến 266MBps.                                                 | Khe cắm bên trong máy tính để bàn<br>và máy chủ (server).                                                                 |
| Mini PCI              | Bus 32-bit ở tần số 33MHz.                                                                                                | Khe cắm bên trong máy tính xách tay (laptop).                                                                             |

| CardBus               | Bus 32-bit ở tần số 33MHz.                                                                                                  | Khe cắm thẻ PC (PC card) ngoài trên máy xách tay.<br>Tương thích với PCI.                                                   |
| PCI Extended (PCI-X)  | Bus 64-bit ở tần số 133 MHz, đạt<br>băng thông lên tới 1GBps.                                                               | Khe cắm trong trên máy tính để bàn và<br>máy chủ. Rộng hơn PCI, nhưng thẻ PCI<br>có thể cắm vào khe PCI-X.                 |
| PCI Express (PCIe)    | 250MBps cho mỗi liên kết PCIe (PCIe link) theo mỗi<br>hướng truyền, đạt thông lượng tối đa<br>8GBps theo mỗi hướng.         | Thay thế khe cắm PCI trong ở các hệ<br>thống mới hơn. PCIe là giao thức nối tiếp<br>khác với PCI nguyên bản vốn là giao<br>thức song song. |
| PCI Express Mini Card | 250MBps theo mỗi hướng nếu giao diện<br>dựa trên liên kết PCIe; 60MBps nếu giao<br>diện dựa trên USB 2.0.                     | Thay thế Mini PCI làm khe cắm trong ở các<br>máy xách tay mới hơn. Kích thước nhỏ gọn<br>hơn Mini PCI.                              |

| Tên Bus      | Đặc điểm                                                                                                                  | Yếu tố hình thức (Form Factor)                                                                                          |
|--------------|---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| Express Card | 250MBps theo mỗi hướng nếu giao diện<br>dựa trên liên kết PCIe; 60MBps nếu giao<br>diện dựa trên USB 2.0. | Khe cắm mỏng ở bên ngoài trên các máy<br>xách tay mới hơn nhằm thay thế CardBus.<br>Giao tiếp với system bus qua PCIe hoặc USB 2.0. |

Các giải pháp dựa trên họ PCI (PCI family) có sẵn cho rất nhiều lĩnh vực phần cứng:

- Các công nghệ mạng như Gigabit Ethernet, WiFi, ATM, Token Ring, và ISDN.
- Bộ điều hợp máy chủ (host adapter) cho các công nghệ lưu trữ, chẳng hạn như SCSI.
- Bộ điều khiển máy chủ (host controller) cho các I/O bus như USB, FireWire, IDE, I2C, và PCMCIA. Trên các hệ thống tương thích PC (PC-compatible systems), các host controller này hoạt động như các cầu nối (bridge) giữa bộ điều khiển PCI trên South Bridge và công nghệ bus mà chúng cung cấp nguồn. Hãy xác minh điều này bằng cách chạy lệnh *lspci* (sẽ được thảo luận sau).
- Đồ họa, phát trực tuyến video (video streaming), và thu nhận dữ liệu.
- Các card cổng nối tiếp (serial port) và cổng song song (parallel port).
- Card âm thanh.
- Các thiết bị như Watchdog, bộ điều khiển bộ nhớ hỗ trợ EDAC (EDAC-capable memory controllers), và cổng game.

Đối với nhà phát triển trình điều khiển (driver developer), họ PCI mang lại một ưu thế hấp dẫn: hệ thống cấu hình thiết bị tự động (automatic device configuration). Khác với các trình điều khiển cho thế hệ ISA cũ hơn, các PCI driver không cần phải triển khai logic thăm dò (probing logic) phức tạp. Trong quá trình khởi động, firmware khởi động kiểu BIOS (hoặc chính kernel nếu được cấu hình như vậy) sẽ duyệt qua bus PCI và phân bổ các tài nguyên như mức ngắt (interrupt level) và địa chỉ cơ sở I/O (I/O base address). Trình điều khiển thiết bị (device driver) thu thập thông tin phân bổ này bằng cách quan sát một vùng nhớ được gọi là không gian cấu hình PCI (PCI configuration space). Các thiết bị PCI sở hữu 256 byte bộ nhớ cấu hình. 64 byte đầu tiên của không gian cấu hình được chuẩn hóa và chứa các thanh ghi lưu trữ các chi tiết như trạng thái, đường ngắt (interrupt line), và địa chỉ cơ sở I/O. PCIe và PCI-X 2.0 cung cấp một không gian cấu hình mở rộng (extended configuration space) lên tới 4KB. Chúng ta sẽ tìm hiểu cách thao tác trên không gian cấu hình PCI ở phần sau.

Hình 10.1 minh họa PCI trong một hệ thống tương thích PC. Các thành phần được tích hợp vào South Bridge như silicon bộ điều khiển cho USB, IDE, I2C, LPC và Ethernet nằm ngoài bus PCI. Một số bộ điều khiển này chứa một cầu nối PCI-to-PCI bên trong để cung cấp một bus PCI chuyên dụng cho công nghệ I/O tương ứng. South Bridge bổ sung thêm một bus PCI bên ngoài để kết nối các thiết bị ngoại vi I/O như bộ điều khiển CardBus và các chipset WiFi. Hình 10.1 cũng hiển thị các bộ giá trị địa chỉ PCI (PCI address tuples) tương ứng với từng hệ thống con được kết nối. Điều này sẽ trở nên rõ ràng hơn khi chúng ta tìm hiểu về cách định địa chỉ PCI (PCI addressing) tiếp theo.

**Hình 10.1. PCI bên trong South Bridge của PC.**

```
=========================== CPU & CHIPSET ============================

           +-----------+
           | Processor |
           +-----------+
                 |
                 v
           +-------------+
           | North Bridge|
           +-------------+
                 |
                 v
           +----------------------------------+
           |           South Bridge           |
           |----------------------------------|
           | Hub Interface        0:1e.0      |
           |                                  |
           | IDE                 0:1f.0       |
           | I2C                 0:1f.1       |
           | LPC                 0:1f.2       |
           | Firewire            0:1f.3       |
           |                                  |
           | USB                 0:1d.X       |
           | Ethernet            1:0.0        |
           | External PCI IF     0:1e.0       |
           | AC'97 Audio         0:1f.1       |
           +----------------------------------+

=========================== PCI BUS ============================

                    (External PCI Interface)
                               |
                               v
        --------------------------------------------------
        |                     |                        |
        v                     v                        v

   +----------------+   +------------------+    +-------------------+
   | WiFi Chipset   |   | CardBus Ctrl     |    | SCSI Host Adapter|
   |    2:X.Y       |   |    2:0.0         |    |                   |
   +----------------+   +------------------+    +-------------------+
                                |
                                v
                          +------------------------+
                          | Ethernet-Modem Card    |
                          | 3:0.0  &  3:0.1        |
                          +------------------------+
```

## Định địa chỉ và Nhận diện (Addressing and Identification)

Các thiết bị PCI được định địa chỉ bằng cách sử dụng số *bus*, *device* (thiết bị) và *function* (chức năng), đồng thời chúng được nhận diện thông qua *vendorID* (mã nhà cung cấp), *deviceID* (mã thiết bị) và *class code* (mã lớp). Hãy tìm hiểu các khái niệm này thông tin qua tiện ích *lspci* nằm trong gói *PCI Utilities* có thể tải về từ [http://mj.ucw.cz/pciutils.shtml.](http://mj.ucw.cz/pciutils.shtml)

Giả sử bạn đang sử dụng một thẻ CardBus đa chức năng Xircom Ethernet-Modem trên một máy tính xách tay dòng Pentium được phục vụ bởi bộ điều khiển Texas Instruments PCI4510 CardBus, như được hiển thị trong Hình 10.1. Chạy lệnh lspci:

### bash>lspci

```
00:00.0 Host bridge: Intel Corporation 82852/82855 GM/GME/PM/GMV Processor to I/O
Controller (rev 02)
...
02:00.0 CardBus bridge: Texas Instruments PCI4510 PC card Cardbus Controller (rev 03)
...
03:00.0 Ethernet controller: Xircom Cardbus Ethernet 10/100 (rev 03)
03:00.1 Serial controller: Xircom Cardbus Ethernet + 56k Modem (rev 03)
```

Hãy xem xét bộ giá trị (tuple) (XX:YY.Z) ở đầu mỗi mục trong phần đầu ra ở trên. XX đại diện cho số PCI bus. Một miền (PCI domain) có thể chứa tối đa 256 bus. Trong máy tính xách tay được sử dụng trước đó, cầu nối CardBus (CardBus bridge) được kết nối với PCI bus 2. Cầu nối này cung cấp một PCI bus khác mang số 3 chứa thẻ Xircom.

YY là số thiết bị PCI (PCI device number). Mỗi bus có thể kết nối với tối đa 32 thiết bị PCI. Ngược lại, mỗi thiết bị có thể triển khai tối đa tám chức năng được biểu thị bằng Z. Thẻ Xircom có thể thực hiện đồng thời hai chức năng. Do đó, `03:00.0` định địa chỉ cho chức năng Ethernet của thẻ, trong khi `03:00.1` tương ứng với chức năng truyền thông modem của nó. Hãy chạy lệnh `lspci –t` để hiển thị bố cục dạng cây của các PCI bus và thiết bị trên hệ thống của bạn:

```
bash> lspci –t
```

```
-[0000:00]-+-00.0
 +-00.1
 +-00.3
 +-02.0
 +-02.1
 +-1d.0
 +-1d.1
 +-1d.2
 +-1d.7
 +-1e.0-[0000:02-05]--+-[0000:03]-+-00.0
 | | \-00.1
 | \-[0000:02]-+-00.0
 | +-00.1
 | +-01.0
 | \-02.0
 +-1f.0
```

Như bạn có thể thấy từ phần đầu ra trước đó (và trong Hình 10.1), để đi qua (walk) PCI bus và đến được modem Xircom (`03:00.01`) hoặc bộ điều khiển Ethernet (`03:00.0`), bạn phải bắt đầu từ miền PCI của mình (được gán nhãn `0000` trong đầu ra trước đó), đi qua cầu nối PCI-to-PCI (`00:1e.0`), và sau đó vượt qua bộ điều khiển chủ PCI-to-CardBus (`02:0.0`). Phần thể hiện trong sysfs của hệ thống con PCI phản ánh bố cục này:

```
bash> ls /sys/devices/pci0000:00/0000:00:1e.0/0000:02:00.0/0000:03:00.0/
...
net:eth2 Ethernet
...
bash> ls /sys/devices/pci0000:00/0000:00:1e.0/0000:02:00.0/0000:03:00.1/
...
tty:ttyS1 Modem
...
```

Như bạn đã thấy trước đó, các thiết bị PCI sở hữu một vùng nhớ 256 byte chứa các thanh ghi cấu hình (configuration registers). Không gian này là chìa khóa để nhận diện nhà sản xuất và các tính năng của thẻ PCI. Hãy cùng xem xét bên trong không gian cấu hình (configuration spaces) của bộ điều khiển CardBus và thẻ đa chức năng Xircom đã được sử dụng trước đó. Thẻ Xircom có hai không gian cấu hình, mỗi không gian tương ứng với một chức năng được hỗ trợ:

## Xem mã nguồn:

```
bash> lspci –x
00:00.0 Host bridge: Intel Corporation 82852/82855 GM/GME/PM/GMV Processor to I/O
Controller (rev 02)
00: 86 80 80 35 06 01 90 20 02 00 00 06 00 00 80 00
10: 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
20: 00 00 00 00 00 00 00 00 00 00 00 00 14 10 5c 05
30: 00 00 00 00 40 00 00 00 00 00 00 00 00 00 00 00
...
02:00.0 CardBus bridge: Texas Instruments PCI4510 PC card Cardbus Controller (rev 03)
00: 4c 10 44 ac 07 00 10 02 03 00 07 06 20 a8 82 00
10: 00 00 00 b0 a0 00 00 22 02 03 04 b0 00 00 00 f0
20: 00 f0 ff f1 00 00 00 d2 00 f0 ff d3 00 30 00 00
30: fc 30 00 00 00 34 00 00 fc 34 00 00 0b 01 00 05
...
03:00.0 Ethernet controller: Xircom Cardbus Ethernet 10/100 (rev 03)
00: 5d 11 03 00 07 00 10 02 03 00 00 02 00 40 80 00
10: 01 30 00 00 00 00 00 d2 00 08 00 d2 00 00 00 00
20: 00 00 00 00 00 00 00 00 07 01 00 00 5d 11 81 11
30: 00 00 00 00 dc 00 00 00 00 00 00 00 0b 01 14 28
03:00.1 Serial controller: Xircom Cardbus Ethernet + 56k Modem (rev 03)
00: 5d 11 03 01 03 00 10 02 03 02 00 07 00 00 80 00
10: 81 30 00 00 00 10 00 d2 00 18 00 d2 00 00 00 00
20: 00 00 00 00 00 00 00 00 07 02 00 00 5d 11 81 11
30: 00 00 00 00 dc 00 00 00 00 00 00 00 0b 01 00 00
```

Các thanh ghi PCI (PCI registers) sử dụng thứ tự byte little-endian (little-endian), vì vậy hãy lưu ý điều này khi diễn giải kết quả đầu ra trước đó. Bạn cũng có thể kết xuất (dump) các vùng cấu hình PCI thông qua `sysfs`. Ví dụ, để xem không gian cấu hình (configuration space) của chức năng Ethernet trên thẻ Xircom, hãy thực hiện lệnh sau:

```
bash> od -x /sys/devices/pci0000:00/0000:00:1e.0/0000:02:00.0/0000:03:00.1/config
0000000 115d 0003 0007 0210 0003 0200 4000 0080
0000020 3001 0000 0000 d200 0800 d200 0000 0000
0000040 0000 0000 0000 0000 0107 0000 115d 1181
```

...

Bảng 10.2 giải thích một số giá trị được hiển thị trong kết quả kết xuất ở trên. Hai byte đầu tiên chứa mã nhà cung cấp (vendor ID), dùng để xác định công ty sản xuất thẻ. Các ID nhà cung cấp PCI được quản lý và cấp phát trên toàn cầu. (Bạn có thể truy cập trang web www.pcidatabase.com để tra cứu cơ sở dữ liệu). Như bạn có thể giải mã từ kết quả đầu ra trước đó, Intel, Texas Instruments và Xircom (nay đã được Intel mua lại) lần lượt sở hữu các ID nhà cung cấp là 0x8086, 0x104C và 0x115D. Hai byte tiếp theo đặc trưng cho chức năng của thẻ và cấu thành ID thiết bị (device ID) của nó. Từ kết quả trên, chức năng Ethernet của thẻ Xircom có ID thiết bị là 0x0003, trong khi modem có ID thiết bị là 0x0103. Các thẻ PCI bổ sung thêm ID tiểu nhà cung cấp (subvendor ID) và ID tiểu thiết bị (subdevice ID) (xem các từ tại vị trí bù 44 và 46 trong kết quả kết xuất ở trên) để xác định danh tính của chúng một cách chính xác hơn.

**Bảng 10.2. Ngữ nghĩa không gian cấu hình PCI (PCI Configuration Space Semantics)**

| Vị trí bù không gian cấu hình (Configuration Space Offset) | Ngữ nghĩa (Semantics) | Giá trị từ kết quả kết xuất cho thẻ Xircom (Values from the Dump Output for the Xircom Card) |
|----------------------------------------------------------|-----------------------|----------------------------------------------------------------------------------------------|
| 0                                                        | ID nhà cung cấp (Vendor ID) | 0x115D                                                                                       |
| 2                                                        | ID thiết bị (Device ID) | 0x0003                                                                                       |
| 10                                                       | Mã phân lớp (Class code) | 0x0200                                                                                       |
| 16 đến 39                                                | Thanh ghi địa chỉ cơ sở 0 (BAR 0) đến BAR5 | 0x30010000                                                                                   |
| 44                                                       | ID tiểu nhà cung cấp (Subvendor ID) | 0x115D                                                                                       |
| 46                                                       | ID tiểu thiết bị (Subdevice ID) | 0x1181                                                                                       |

Cách mười byte trong không gian cấu hình là mã mô tả phân lớp của thiết bị. Các cầu nối PCI (PCI bridges) có mã phân lớp bắt đầu bằng 0x06, các thiết bị mạng có mã phân lớp bắt đầu bằng 0x02 và các thiết bị truyền thông có mã phân lớp bắt đầu bằng 0x07. Do đó, trong ví dụ trước, cầu nối CardBus, thẻ Ethernet và modem nối tiếp lần lượt sở hữu các mã phân lớp là 0x0607, 0x0200 và 0x0700. Bạn có thể tìm các định nghĩa mã phân lớp trong tệp *include/linux/pci\_ids.h*.

Các trình điều khiển PCI (PCI drivers) đăng ký các ID nhà cung cấp, ID thiết bị và mã phân lớp mà chúng hỗ trợ với hệ thống con PCI (PCI subsystem). Sử dụng cơ sở dữ liệu này, hệ thống con PCI sẽ liên kết một thẻ được cắm vào với trình điều khiển thiết bị (device driver) phù hợp sau khi thu thập danh tính của thẻ từ không gian cấu hình của nó. Chúng ta sẽ tìm hiểu cách thực hiện việc này khi triển khai một trình điều khiển mẫu ở phần sau.

## Truy cập các vùng PCI (Accessing PCI Regions)

Các thiết bị PCI chứa ba vùng có thể định địa chỉ: không gian cấu hình (configuration space), cổng I/O (I/O ports) và bộ nhớ thiết bị (device memory). Hãy cùng tìm hiểu cách truy cập các vùng bộ nhớ này từ một trình điều khiển thiết bị.

## Không gian cấu hình (Configuration Space)

Kernel cung cấp một tập hợp gồm sáu hàm mà driver của bạn có thể sử dụng để thao tác trên không gian cấu hình PCI (PCI configuration space):

```c
pci_read_config_[byte|word|dword](struct pci_dev *pdev,
 int offset, int *value);
và
pci_write_config_[byte|word|dword](struct pci_dev *pdev,
 int offset, int value);
```

Trong danh sách tham số, `struct pci_dev` là cấu trúc thiết bị PCI (PCI device structure), và `offset` là vị trí byte trong không gian cấu hình mà bạn muốn truy cập. Đối với các hàm đọc, `value` là một con trỏ trỏ tới vùng đệm dữ liệu được cung cấp, và đối với các hàm ghi, nó chứa dữ liệu cần ghi.

Hãy xem xét một số ví dụ:

Để giải mã số IRQ được gán cho một chức năng của card, hãy sử dụng đoạn mã sau:

```c
unsigned char irq;
pci_read_config_byte(pdev, PCI_INTERRUPT_LINE, &irq);
```

Theo đặc tả PCI (PCI specification), offset 60 bên trong không gian cấu hình PCI chứa số IRQ được gán cho card. Tất cả các offset của thanh ghi cấu hình (configuration register) đều được định nghĩa rõ ràng trong *include/linux/pci\_regs.h*, vì vậy hãy sử dụng `PCI_INTERRUPT_LINE` thay vì số 60 để chỉ định offset này. Tương tự, để đọc thanh ghi trạng thái PCI (PCI status register - hai byte tại offset sáu trong không gian cấu hình), hãy thực hiện như sau:

```c
unsigned short status;
pci_read_config_word(pdev, PCI_STATUS, &status);
```

Chỉ 64 byte đầu tiên của không gian cấu hình là được chuẩn hóa. Nhà sản xuất thiết bị sẽ định nghĩa ngữ nghĩa mong muốn cho phần còn lại. Card Xircom được sử dụng trước đó gán bốn byte tại offset 64 cho các mục đích quản lý nguồn (power management). Để vô hiệu hóa quản lý nguồn, driver Xircom CardBus, *drivers/net/tulip/xircom\_cb.c*, thực hiện như sau:

```c
## define PCI_POWERMGMT 0x40
pci_write_config_dword(pdev, PCI_POWERMGMT, 0x0000);
```

## I/O và Bộ nhớ (I/O and Memory)

Các card PCI có tối đa sáu vùng I/O hoặc bộ nhớ. Các vùng I/O chứa các thanh ghi, và các vùng bộ nhớ chứa dữ liệu. Ví dụ, các card video có không gian I/O để chứa các thanh ghi điều khiển và các vùng bộ nhớ ánh xạ tới bộ đệm khung hình (frame buffer). Tuy nhiên, không phải tất cả các card đều có các vùng nhớ có thể định địa chỉ. Ngữ nghĩa của không gian I/O và bộ nhớ phụ thuộc vào phần cứng (hardware-dependent) và có thể được tìm thấy trong tài liệu thông số kỹ thuật của thiết bị (data sheet).

Giống như bộ nhớ cấu hình, kernel cung cấp một tập hợp các hàm hỗ trợ (helper functions) để thao tác trên các vùng I/O và bộ nhớ của thiết bị PCI:

```c
unsigned long pci_resource_[start|len|end|flags] (struct pci_dev *pdev, int bar);
```

Để thao tác trên một vùng I/O như các thanh ghi điều khiển thiết bị của một card video PCI, driver cần thực hiện các bước sau:

**1.** Lấy địa chỉ cơ sở I/O (I/O base address) từ thanh ghi địa chỉ cơ sở (BAR - Base Address Register) tương ứng trong không gian cấu hình:

```c
unsigned long io_base = pci_resource_start(pdev, bar);
```

Thao tác này giả định rằng các thanh ghi điều khiển thiết bị cho card này được ánh xạ tới vùng bộ nhớ liên kết với `bar`, với giá trị có thể nằm trong khoảng từ 0 đến 5, như được hiển thị trong Bảng 10.2.

**2.** Đánh dấu vùng này là đang được sử dụng (được cấp phép), bằng cơ chế quản lý `request_region()` của kernel đã được thảo luận trong Chương 5, "Character Drivers":

```c
request_region(io_base, length, "my_driver");
```

Ở đây, `length` là kích thước của không gian thanh ghi điều khiển và `my_driver` định danh chủ sở hữu của vùng đó. Hãy tìm mục chứa `my_driver` trong */proc/ioports* để nhận diện vùng bộ nhớ này.

Thay vào đó, bạn có thể sử dụng hàm wrapper `pci_request_region()`, được định nghĩa trong *drivers/pci/pci.c*.

**3.** Cộng offset của thanh ghi (lấy từ tài liệu thông số kỹ thuật) với địa chỉ cơ sở đã thu được ở Bước 1. Thao tác trên địa chỉ này bằng cách sử dụng nhóm hàm `inb()` và `outb()` đã thảo luận trong Chương 5:

```c
/* Đọc */
register_data = inl(io_base + REGISTER_OFFSET);
/* Sử dụng */
/* ... */
/* Ghi */
outl(register_data, iobase + REGISTER_OFFSET);
```

Để thao tác trên một vùng bộ nhớ như bộ đệm khung hình (frame buffer) trên card video PCI ở trên, hãy thực hiện các bước sau:

**1.** Lấy địa chỉ cơ sở, chiều dài và các cờ (flags) liên kết với vùng bộ nhớ:

```c
unsigned long mmio_base = pci_resource_start(pdev, bar);
unsigned long mmio_length = pci_resource_length(pdev, bar);
unsigned long mmio_flags = pci_resource_flags(pdev, bar);
```

Thao tác này giả định rằng bộ nhớ này được ánh xạ tới thanh ghi địa chỉ cơ sở, `bar`.

**2.** Đánh dấu quyền sở hữu của vùng này bằng cơ chế quản lý `request_mem_region()` của kernel:

```c
request_mem_region(mmio_base, mmio_length, "my_driver");
```

Thay vào đó, bạn có thể sử dụng hàm wrapper `pci_request_region()`, đã đề cập trước đó.

**3.** Lấy quyền truy cập của CPU (CPU access) đối với bộ nhớ thiết bị đã thu được ở Bước 1. Một số vùng bộ nhớ nhất định, chẳng hạn như các vùng chứa thanh ghi, cần phải đề phòng các tác dụng phụ (side effects), vì vậy chúng được đánh dấu là không thể nạp trước (non-prefetchable) hoặc không thể lưu bộ đệm (non-cacheable) bởi CPU. Các vùng khác, chẳng hạn như vùng được sử dụng trong ví dụ này, có thể được lưu bộ đệm (cached). Tùy thuộc vào cờ truy cập (access flag), hãy sử dụng hàm thích hợp để lấy địa chỉ ảo của kernel (kernel virtual addresses) tương ứng với vùng đã ánh xạ:

```c
void __iomem *buffer;
if (flags & IORESOURCE_CACHEABLE) {
 buffer = ioremap(mmio_base, mmio_length);
} else {
 buffer = ioremap_nocache(mmio_base, mmio_length);
}
```

Để an toàn và tránh phải thực hiện các bước kiểm tra trước đó, thay vào đó hãy sử dụng các dịch vụ của hàm `pci_iomap()` được định nghĩa trong *lib/iomap.c*:

```
buffer = pci_iomap(pdev, bar, mmio_length);
```

## Truy cập bộ nhớ trực tiếp (Direct Memory Access)

*Truy cập bộ nhớ trực tiếp* (Direct Memory Access - DMA) là khả năng truyền dữ liệu từ một thiết bị ngoại vi (peripheral) vào bộ nhớ chính (main memory) mà không cần sự can thiệp của CPU. DMA làm tăng hiệu năng của các thiết bị ngoại vi lên gấp nhiều lần, bởi vì nó không tiêu tốn chu kỳ của CPU (CPU cycles) để di chuyển dữ liệu. Các card mạng PCI và ổ đĩa cứng IDE là những ví dụ phổ biến về các thiết bị ngoại vi phụ thuộc vào DMA để truyền dữ liệu.

DMA được khởi tạo bởi một DMA master. Bo mạch chủ PC có một bộ điều khiển DMA (DMA controller) nằm trên cầu Nam (South Bridge) có thể làm chủ bus I/O (I/O bus) và khởi tạo DMA đến hoặc từ một thiết bị ngoại vi. Đây thường là trường hợp đối với các card ISA cũ (legacy ISA cards). Tuy nhiên, các bus như PCI có thể làm chủ bus và khởi tạo các hoạt động truyền DMA. Các card CardBus tương tự như PCI và cũng hỗ trợ khả năng làm chủ DMA (DMA mastering). Ngược lại, các thiết bị PCMCIA không hỗ trợ DMA mastering, nhưng bộ điều khiển PCMCIA (thường được nối dây với bus PCI) có thể có khả năng DMA mastering.

Vấn đề *nhất quán bộ đệm* (cache coherency) đi liền với DMA. Để đạt hiệu năng tối ưu, bộ xử lý (processor) lưu đệm các byte mới được truy cập gần đây, vì vậy dữ liệu truyền qua lại giữa CPU và bộ nhớ chính sẽ chảy qua bộ đệm của bộ xử lý (processor cache). Tuy nhiên, trong quá trình DMA, dữ liệu di chuyển trực tiếp giữa bộ điều khiển DMA và bộ nhớ chính, do đó bỏ qua bộ đệm của bộ xử lý. Sự bỏ qua này có khả năng gây ra sự không nhất quán vì bộ xử lý có thể thao tác trên dữ liệu cũ (stale data) nằm trong bộ đệm của nó. Một số kiến trúc tự động đồng bộ hóa bộ đệm với bộ nhớ chính bằng cách sử dụng một kỹ thuật gọi là *bus snooping*. Tuy nhiên, nhiều kiến trúc khác lại phụ thuộc vào phần mềm để đạt được tính nhất quán. Chúng ta sẽ tìm hiểu cách thực hiện các thao tác DMA nhất quán (coherent DMA operations) sau khi giới thiệu thêm một vài chủ đề nữa.

DMA có thể diễn ra theo kiểu *đồng bộ* (synchronously) hoặc *bất đồng bộ* (asynchronously). Một ví dụ về kiểu đồng bộ là DMA từ vùng đệm khung hình hệ thống (system frame buffer) đến bộ điều khiển LCD. Một ứng dụng người dùng ghi dữ liệu điểm ảnh (pixel data) vào vùng đệm khung hình được ánh xạ DMA thông qua */dev/fbX*, trong khi bộ điều khiển LCD sử dụng DMA để thu thập dữ liệu này một cách đồng bộ theo các khoảng thời gian định sẵn. Chúng ta sẽ thảo luận chi tiết hơn về vấn đề này trong Chương 12, "Trình điều khiển Video" (Video Drivers). Một ví dụ về DMA bất đồng bộ là việc truyền và nhận các khung dữ liệu (data frames) giữa CPU và card mạng được thảo luận trong Chương 15, "Card giao tiếp mạng" (Network Interface Cards).

Các vùng bộ nhớ hệ thống là nguồn hoặc đích của các hoạt động truyền DMA được gọi là các bộ đệm DMA (DMA buffers). Nếu một giao diện bus có các giới hạn về đánh địa chỉ (addressing limitations), điều đó sẽ ảnh hưởng đến dải bộ nhớ có thể chứa các bộ đệm DMA. Vì vậy, các bộ đệm DMA thích hợp cho bus 24-bit như ISA chỉ có thể nằm trong 16MB thấp của bộ nhớ hệ thống được gọi là `ZONE_DMA` (xem phần "Cấp phát bộ nhớ" trong Chương 2, "Cái nhìn bên trong Kernel"). Theo mặc định, các bus PCI có độ rộng 32-bit, vì vậy bạn thường sẽ không gặp phải những giới hạn như vậy trên các nền tảng 32-bit. Để thông báo cho kernel về bất kỳ nhu cầu đặc biệt nào của các vùng đệm có khả năng hỗ trợ DMA (DMA-able buffers), hãy sử dụng hàm sau:

```
dma_set_mask(struct device *dev, u64 mask);
```

Nếu hàm này trả về thành công, bạn có thể thực hiện DMA đến bất kỳ địa chỉ nào có độ dài bằng số bit của mặt nạ (mask bits in length). Ví dụ, trình điều khiển e1000 PCI-X Gigabit Ethernet (*drivers/net/e1000/e1000_main.c*) thực hiện các thao tác sau:

```
if (!(err = pci_set_dma_mask(pdev, DMA_64BIT_MASK))) {
 /* Hệ thống hỗ trợ DMA 64-bit */
 pci_using_dac = 1;
} else {
 /* Xem xét liệu DMA 32-bit có được hỗ trợ hay không */
 if ((err = pci_set_dma_mask(pdev, DMA_32BIT_MASK))) {
 /* Không, hãy hủy bỏ */
 E1000_ERR("Không có cấu hình DMA khả dụng, đang hủy bỏ\n");
 return err;
 }
 /* DMA 32-bit */
 pci_using_dac = 0;
}
```

Các thiết bị I/O nhìn nhận các bộ đệm DMA thông qua lăng kính của bộ điều khiển bus (bus controller) và bất kỳ *đơn vị quản lý bộ nhớ I/O* (I/O memory management unit - IOMMU) trung gian nào. Do đó, các thiết bị I/O làm việc với các địa chỉ *bus* (bus addresses) thay vì các địa chỉ vật lý (physical addresses) hay địa chỉ ảo của kernel (kernel virtual addresses). Vì vậy, khi bạn thông báo cho một card PCI về vị trí của một bộ đệm DMA, bạn phải cho nó biết địa chỉ bus của bộ đệm đó. Các hàm dịch vụ DMA sẽ ánh xạ địa chỉ ảo kernel của bộ đệm DMA thành các địa chỉ bus để cả thiết bị và CPU đều có thể truy cập các bộ đệm này. Các địa chỉ bus có kiểu `dma_addr_t`, được định nghĩa trong *include/asm-your-arch/types.h*.

Có một vài khái niệm nữa rất đáng để tìm hiểu về DMA. Một là ý tưởng về *bộ đệm nảy* (bounce buffers). Các bộ đệm nảy nằm trong các vùng có hỗ trợ DMA (DMA-able regions) và được sử dụng làm bộ nhớ tạm thời khi có yêu cầu DMA đến/từ các vùng bộ nhớ không hỗ trợ DMA. Một ví dụ là DMA tới một địa chỉ cao hơn 4GB từ một thiết bị ngoại vi PCI 32-bit khi không có IOMMU trung gian. Dữ liệu trước tiên được truyền đến một bộ đệm nảy và sau đó được sao chép đến đích cuối cùng. Khái niệm thứ hai là một biến thể của DMA được gọi là *scatter-gather* (phân tán-tập hợp). Khi dữ liệu cần thực hiện DMA nằm rải rác trên các vùng không liên tục, khả năng scatter-gather cho phép phần cứng thu thập nội dung của các vùng đệm bị phân tán đó trong một lần duy nhất. Điều ngược lại xảy ra khi dữ liệu được DMA từ card vào các bộ đệm nằm rải rác trong bộ nhớ. Khả năng scatter-gather giúp tăng hiệu năng bằng cách loại bỏ sự cần thiết phải phục vụ nhiều yêu cầu DMA.

Kernel cung cấp một API hoàn chỉnh giúp ẩn đi nhiều chi tiết nội bộ trong việc cấu hình DMA. API này trở nên đơn giản hơn nếu bạn đang viết một driver cho thẻ PCI hỗ trợ tính năng bus mastering (Hầu hết các thẻ PCI đều hỗ trợ tính năng này). Các hàm PCI DMA thực chất là các lớp vỏ bọc (wrappers) xung quanh các hàm dịch vụ DMA tổng quát và được định nghĩa trong *include/asmgeneric/pci-dma-compat.h*. Trong chương này, chúng ta chỉ sử dụng PCI DMA API.

Kernel cung cấp hai lớp hàm dịch vụ DMA cho các driver PCI:

Các phương thức truy cập DMA *Consistent* (hoặc coherent - đồng nhất). Các hàm này đảm bảo tính đồng nhất của dữ liệu (data coherency) trước hoạt động của DMA. Nếu cả thiết bị PCI và CPU đều có khả năng thao tác thường xuyên trên một bộ đệm DMA (DMA buffer), tính đồng nhất là tối quan trọng, do đó hãy sử dụng Consistent API. Sự đánh đổi ở đây là một mức độ suy giảm hiệu năng (performance penalty). Để lấy một bộ đệm DMA đồng nhất, hãy gọi hàm dịch vụ sau: **1.**

```c
void *pci_alloc_consistent(struct pci_dev *pdev,
 size_t size,
 dma_addr_t *dma_handle);
```

Hàm này cấp phát một bộ đệm DMA, tạo địa chỉ bus của nó, và trả về địa chỉ ảo kernel (kernel virtual address) tương ứng. Hai tham số đầu tiên lần lượt chứa cấu trúc thiết bị PCI (sẽ được thảo luận sau) và kích thước của bộ đệm DMA được yêu cầu. Tham số thứ ba, `dma_handle`, là một con trỏ trỏ tới địa chỉ bus do lời gọi hàm tạo ra. Đoạn mã sau đây tiến hành cấp phát và giải phóng một bộ đệm DMA đồng nhất:

```c
/* Cấp phát */
void *vaddr = pci_alloc_consistent(pdev, size,
 &dma_handle);
/* Sử dụng */
/* ... */
/* Giải phóng */
pci_free_consistent(pdev, size, vaddr, dma_handle);
```

Các phương thức truy cập DMA dạng *Streaming* (luồng). Các hàm này không đảm bảo tính đồng nhất và do đó có tốc độ nhanh hơn. Chúng hữu ích khi không có nhiều nhu cầu truy cập chia sẻ giữa CPU và thiết bị I/O. Khi một bộ đệm streaming đã được ánh xạ (mapped) để thiết bị truy cập, driver phải chủ động hủy ánh xạ (unmap) hoặc đồng bộ (sync) nó trước khi CPU có thể thao tác một cách đáng tin cậy trên đó. Có hai họ hàm truy cập streaming: `pci_[map|unmap|dma_sync]_single()` và `pci_[map|unmap|dma_sync]_sg()`. **2.**

Họ hàm thứ nhất thực hiện ánh xạ, hủy ánh xạ và đồng bộ một bộ đệm DMA đơn được cấp phát sẵn. `pci_map_single()` có nguyên mẫu (prototype) như sau:

```c
dma_addr_t pci_map_single(struct pci_dev *pdev, void *ptr,
 size_t size, int direction);
```

Ba tham số đầu tiên lần lượt chứa cấu trúc thiết bị PCI, địa chỉ ảo kernel của bộ đệm DMA đã cấp phát trước, và kích thước của bộ đệm được cung cấp. Tham số thứ tư, `direction` (hướng), có thể nhận một trong các giá trị sau: `PCI_DMA_BIDIRECTION`, `PCI_DMA_TODEVICE`, `PCI_DMA_FROMDEVICE`, hoặc `PCI_DMA_NONE`. Tên của các tùy chọn này đã mang ý nghĩa tự giải thích, nhưng tùy chọn đầu tiên tốn kém chi phí (expensive) và tùy chọn cuối cùng dùng cho việc gỡ lỗi (debugging). Chúng ta sẽ thảo luận sâu hơn về ánh xạ streaming DMA khi phát triển một driver ví dụ sau này.

Họ hàm thứ hai thực hiện ánh xạ, hủy ánh xạ và đồng bộ một danh sách phân tán-tập trung (scatter-gather list) các bộ đệm DMA. `pci_map_sg()` có nguyên mẫu như sau:

```c
int pci_map_sg(struct pci_dev *pdev,
 struct scatterlist *sgl,
 int num_entries, int direction);
```

Danh sách phân tán được chỉ định thông qua tham số thứ hai, `struct scatterlist`, được định nghĩa trong *include/asmyour-arch/scatterlist.h*. `num_entries` là số lượng phần tử trong scatterlist. Tham số đầu tiên và cuối cùng giống như đã mô tả đối với `pci_map_single()`. Hàm trả về số lượng phần tử đã được ánh xạ:

```c
num_mapped = pci_map_sg(pdev, sgl, num_entries,
 PCI_DMA_TODEVICE);
for (i=0; i<num_mapped; i++) {
 /* sg_dma_address(&sgl[i]) trả về địa chỉ bus
 của phần tử này */
 /* sg_dma_len(&sgl[i]) trả về độ dài của vùng này
 */
}
```

Hãy tóm tắt các đặc tính của coherent DMA và streaming DMA để giúp bạn quyết định sự phù hợp của chúng đối với kịch bản sử dụng của mình:

- Ánh xạ coherent dễ lập trình nhưng tốn kém khi sử dụng. Ánh xạ streaming có đặc tính ngược lại.
- Ánh xạ coherent được ưu tiên khi cả CPU và thiết bị I/O cần thường xuyên thao tác trên bộ đệm DMA. Đây thường là trường hợp đối với DMA đồng bộ (synchronous DMA). Một ví dụ là driver framebuffer đã đề cập trước đó, nơi mỗi DMA hoạt động trên cùng một bộ đệm. Vì CPU và bộ điều khiển video liên tục truy cập framebuffer, việc sử dụng ánh xạ coherent trong tình huống này là hợp lý.
- Sử dụng ánh xạ streaming khi thiết bị I/O sở hữu bộ đệm trong thời gian dài. Streamed DMA phổ biến đối với các hoạt động bất đồng bộ (asynchronous operation) khi mỗi DMA hoạt động trên một bộ đệm khác nhau. Một ví dụ là driver mạng (network driver), nơi các bộ đệm mang gói tin truyền đi được ánh xạ và hủy ánh xạ ngay lúc chạy (on-the-fly).
- Các bộ mô tả DMA (DMA descriptors) là ứng cử viên sáng giá cho ánh xạ coherent. DMA descriptors chứa siêu dữ liệu (metadata) về các bộ đệm DMA như địa chỉ và độ dài của chúng, và được truy cập thường xuyên bởi cả CPU lẫn thiết bị. Việc ánh xạ các descriptor này ngay lúc chạy rất tốn kém vì nó đòi hỏi các thao tác hủy ánh xạ và ánh xạ lại (hoặc đồng bộ) liên tục.

## Ví dụ về thiết bị: Thẻ Ethernet-Modem

Với những kiến thức đã thu thập được cho đến nay, chúng ta hãy bắt tay vào việc viết một trình điều khiển thiết bị (device driver) khung cho một thẻ CardBus đa chức năng Ethernet-Modem giả định và xem nó có thể được sử dụng như thế nào cho mạng LAN cũng như để thiết lập kết nối quay số (dialup connection) tới nhà cung cấp dịch vụ Internet. Về cơ bản, bạn sẽ cần một trình điều khiển thiết bị cho mỗi chức năng được hỗ trợ. Giả sử rằng bạn đã có sẵn một trình điều khiển cổng nối tiếp (serial driver) (chúng ta đã học cách viết serial driver trong Chương 6, "Serial Drivers") và một trình điều khiển Ethernet (chúng ta sẽ học cách triển khai network driver trong Chương 15) hỗ trợ các chipset được sử dụng trên thẻ, hãy tinh chỉnh các trình điều khiển đó để làm cho chúng hoạt động với giao diện CardBus (CardBus interface). Ví dụ ở đây mang tính tổng quát nhưng dựa phần lớn trên trình điều khiển kernel cho thẻ Xircom mà chúng ta đã sử dụng trước đó. Các phần Ethernet và modem của trình điều khiển Xircom nằm tách biệt lần lượt tại *drivers/net/tulip/xircom\_cb.c* và *drivers/serial/8250\_pci.c*.

## Khởi tạo và Thăm dò (Initializing and Probing)

Các trình điều khiển PCI (PCI drivers) sử dụng một mảng các cấu trúc `pci_device_id` được định nghĩa trong *include/linux/mod\_devicetable.h* để mô tả nhận dạng của các thẻ mà chúng hỗ trợ:

```c
struct pci_device_id {
 __u32 vendor, device; /* Vendor and Device IDs */
 __u32 subvendor, subdevice; /* Subvendor and Subdevice IDs */
 __u32 class, classmask; /* Class and class mask */
 kernel_ulong_t driver_data; /* Private data */
};
```

Ngữ nghĩa của sáu trường đầu tiên trong `pci_device_id` tuân theo thuật ngữ PCI đã thảo luận trước đó. Trường cuối cùng `driver_data` là riêng tư đối với trình điều khiển (driver) và thường được sử dụng để liên kết thông tin cấu hình nếu trình điều khiển hỗ trợ nhiều thẻ.

Thẻ Ethernet-Modem có ID thiết bị và một không gian cấu hình (configuration space) tương ứng với mỗi chức năng trong hai chức năng của nó. Do hai chức năng của thẻ là độc lập với nhau, bạn cần các trình điều khiển PCI riêng biệt để xử lý chúng. Thư mục *drivers/net/* là một nơi thích hợp để chứa trình điều khiển Ethernet, và *drivers/serial/* là vị trí phù hợp để đặt trình điều khiển nối tiếp tương ứng của nó. Trình điều khiển Ethernet trong Liệt kê 10.1 hỗ trợ chức năng mạng và công bố một tập hợp các ID liên quan trong bảng `pci_device_id` của nó. Trình điều khiển nối tiếp trong Liệt kê 10.2 cũng tương tự, ngoại trừ việc nó chịu trách nhiệm cho chức năng modem. Các mã lớp (class codes) và mặt nạ lớp (class masks) liên quan được cả hai trình điều khiển để trống vì sự kết hợp giữa ID nhà vendor ID/device ID đã xác định duy nhất tính năng của chúng.

Hệ thống con PCI (PCI subsystem) cung cấp các macro như `PCI_DEVICE()` và `PCI_DEVICE_CLASS()` để đơn giản hóa việc tạo bảng `pci_device_id`. Ví dụ, `PCI_DEVICE()` tạo một phần tử `pci_device_id` từ vendor ID và device ID được chỉ định. Do đó, bạn có thể viết lại `network_device_pci_table` trong Liệt kê 10.1 như sau:

```c
struct pci_device_id network_driver_pci_table[] __devinitdata = {
 {PCI_DEVICE(MY_VENDOR_ID, MY_DEVICE_ID_NET)
 .driver_data = (unsigned long)network_driver_private_data},
 {0},
};
```

Macro `MODULE_DEVICE_TABLE()` trong Liệt kê 10.1 và Liệt kê 10.2 đánh dấu bảng `pci_device_id` trong tệp hình ảnh module (module image). Thông tin này sẽ tải module theo yêu cầu (on demand) khi thẻ CardBus được cắm vào. Chúng ta đã khám phá cơ chế này trong phần "Tự động tải Module" (Module Autoload) ở Chương 4, "Đặt nền móng" (Laying the Groundwork), và đã sử dụng nó trongữ cảnh của `pcmcia_device_id` ở Chương 9, "PCMCIA và Compact Flash".

Khi tầng hotplug PCI (PCI hotplug layer) phát hiện sự hiện diện của một thẻ có các thuộc tính khớp với các thuộc tính được công bố bởi bảng `pci_device_id` của một trình điều khiển, nó sẽ gọi phương thức `probe()` thuộc về trình điều khiển đó. Điều này tạo cơ hội cho trình điều khiển nhận sở hữu thẻ đó. Rõ ràng, các trình điều khiển PCI phải liên kết bảng `pci_device_id` của chúng với phương thức `probe()`. Việc gắn kết này được thực hiện thông qua cấu trúc `pci_driver` mà các trình điều khiển đăng ký với hệ thống con PCI trong quá trình khởi tạo. Để thực hiện việc đăng ký này, các trình điều khiển gọi hàm `pci_register_driver()`.

**Liệt kê 10.1. Đăng ký Chức năng Mạng**

```c
## include <linux/pci.h>
## define MY_VENDOR_ID 0xABCD
## define MY_DEVICE_ID_NET 0xEF01
/* Tập hợp các thẻ PCI mà trình điều khiển này hỗ trợ. Trong trường hợp của chúng ta chỉ có một mục duy nhất. Hãy xem include/linux/mod_devicetable.h để biết định nghĩa về pci_device_id */
struct pci_device_id network_driver_pci_table[] __devinitdata = {
{
 { MY_VENDOR_ID, /* ID nhà sản xuất chip giao tiếp */
 MY_DEVICE_ID_NET, /* ID thiết bị cho chức năng mạng */
 PCI_ANY_ID, /* Wildcard ID nhà cung cấp phụ */
 PCI_ANY_ID, /* Wildcard ID thiết bị phụ */
 0, 0, /* class và classmask không được chỉ định */
 network_driver_private_data /* Sử dụng để liên kết thông tin cấu hình nếu trình điều khiển hỗ trợ nhiều thẻ. Có thể là một kiểu liệt kê (enumerated type). */
 }, {0},
};
/* Cấu trúc struct pci_driver được định nghĩa trong include/linux/pci.h */
struct pci_driver network_pci_driver = {
 .name = "ntwrk", /* Tên duy nhất */
 .probe = net_driver_probe, /* Xem Liệt kê 10.3 */
 .remove = __devexit_p(net_driver_remove),/* Xem Liệt kê 10.3 */
 .id_table = network_driver_pci_table, /* Xem ở trên */
 /* Các phương thức suspend() và resume() thực hiện quản lý nguồn (power management) không được sử dụng bởi trình điều khiển này */
};
/* Khởi tạo trình điều khiển Ethernet */
static int __init
network_driver_init(void)
{
 pci_register_driver(&network_pci_driver);
 return 0;
}
/* Thoát trình điều khiển Ethernet */
static void __exit
network_driver_exit(void)
{
 pci_unregister_driver(&network_pci_driver);
}
```

```
module_init(network_driver_init);
module_exit(network_driver_exit);
MODULE_DEVICE_TABLE(pci, network_driver_pci_table);
```

### Liệt kê 10.2. Đăng ký Chức năng Modem

## include <linux/pci.h>

## define MY_VENDOR_ID 0xABCD

## define MY_DEVICE_ID_MDM 0xEF02

/* Tập hợp các thẻ PCI mà trình điều khiển này hỗ trợ */
struct pci_device_id modem_driver_pci_table[] __devinitdata = {
{
{ MY_VENDOR_ID, /* ID nhà sản xuất chip giao tiếp */
MY_DEVICE_ID_MDM, /* ID thiết bị cho chức năng
modem */
PCI_ANY_ID, /* Ký tự đại diện cho ID nhà cung cấp phụ */
PCI_ANY_ID, /* Ký tự đại diện cho ID thiết bị phụ */
0, 0, /* class và classmask không được
chỉ định rõ */
modem_driver_private_data /* Sử dụng cái này để liên kết
thông tin cấu hình nếu trình điều khiển
hỗ trợ nhiều thẻ. Có thể là kiểu liệt kê. */
}, {0},
};
struct pci_driver modem_pci_driver = {
.name = "mdm", /* Tên duy nhất */
.probe = modem_driver_probe, /* Xem Liệt kê 10.4 */
.remove = __devexit_p(modem_driver_remove),/* Xem Liệt kê 10.4 */
.id_table = modem_driver_pci_table, /* Xem ở trên */
/* Các phương thức suspend() và resume() thực thi quản lý nguồn
không được sử dụng bởi trình điều khiển này */
};
/* Khởi tạo trình điều khiển modem */
static int __init
modem_driver_init(void)
{
pci_register_driver(&modem_pci_driver);
return 0;
}
/* Thoát trình điều khiển modem */
static void __exit
modem_driver_exit(void)
{
pci_unregister_driver(&modem_pci_driver);
}
module_init(modem_driver_init);
module_exit(modem_driver_exit);

```

```

MODULE_DEVICE_TABLE(pci, modem_driver_pci_table);

```

Liệt kê 10.3 thực thi phương thức `probe()` cho chức năng mạng. Trình điều khiển này:

- Kích hoạt thiết bị PCI (PCI device)
- Khám phá thông tin tài nguyên như các địa chỉ cơ sở I/O (I/O base address) và IRQ
- Cấp phát và điền dữ liệu vào cấu trúc dữ liệu mạng được liên kết với thiết bị này
- Đăng ký chính nó với tầng mạng của kernel (kernel networking layer)

Liệt kê 10.4 thực hiện công việc tương tự cho chức năng modem. Trong trường hợp này, trình điều khiển đăng ký với tầng nối tiếp của kernel (kernel serial layer) thay vì tầng mạng.

Các Liệt kê 10.3 và 10.4 cũng thực thi các phương thức `remove()`, được gọi khi thẻ CardBus bị rút ra hoặc khi mô-đun trình điều khiển (driver module) bị gỡ tải. `remove()` là hàm ngược lại của `probe()`; nó giải phóng tài nguyên và hủy đăng ký trình điều khiển khỏi các hệ thống con (subsystem) liên quan. Macro `__devexit_p()` mà Liệt kê 10.1 sử dụng để khai báo phương thức `remove()` sẽ loại bỏ hàm được cung cấp tại thời điểm biên dịch (compile time) nếu bạn chưa bật hỗ trợ cắm nóng (hotplug support) và nếu trình điều khiển không phải là một mô-đun có thể tải động (dynamically loadable module).

Hệ thống con PCI (PCI subsystem) gọi `probe()` với hai tham số:

- Con trỏ trỏ tới `pci_dev`, cấu trúc dữ liệu mô tả thiết bị PCI này. Cấu trúc này, được định nghĩa trong *include/linux/pci.h*, được duy trì bởi hệ thống con PCI cho mỗi thiết bị PCI trên hệ thống của bạn. **1.**
- Con trỏ trỏ tới `pci_device_id`, mục nhập trong bảng `pci_device_id` của trình điều khiển khớp với thông tin được tìm thấy trong không gian cấu hình (configuration space) của thẻ được cắm vào. **2.**

### Listing 10.3. Thử nghiệm hàm Mạng (Probing the Network Function)

## include <linux/pci.h>
unsigned long ioaddr;
/* Phương thức probe */
static int __devinit
net_driver_probe(struct pci_dev *pdev,
 const struct pci_device_id *id)
{
 /* Cấu trúc net_device được định nghĩa trong include/linux/netdevice.h.
 Xem Chương 15, "Card Giao Tiếp Mạng" (Network Interface Cards), để biết mô tả */
```

```
 struct net_device *net_dev;
 /* Yêu cầu mã nguồn PCI cấp thấp bật các vùng I/O và bộ nhớ cho
 thiết bị này. Tra cứu IRQ cho thiết bị mà hệ thống con PCI
 đã phân bổ khi nó quét bus (walked the bus) */
 pci_enable_device(pdev);
 /* Sử dụng thiết bị này ở chế độ bus mastering, vì chức năng mạng
 của thẻ này có khả năng thực hiện DMA */
 pci_set_master(pdev);
 /* Cấp phát một giao diện Ethernet và điền các giá trị chung vào
 cấu trúc net_dev. prv_data là cấu trúc dữ liệu riêng của trình điều khiển (private driver data)
 chứa các vùng đệm (buffer), khóa (lock), v.v. Điều này
 được để trống chưa định nghĩa. Hãy chờ đến Chương 15 để biết thêm về
 alloc_etherdev() */
 net_dev = alloc_etherdev(sizeof(struct prv_data));
 /* Điền vào net_dev các phương thức trình điều khiển thiết bị mạng của bạn */
 net_dev->hard_start_xmit = &mydevice_xmit; /* Xem Listing 10.6 */
 /* Khởi tạo bổ sung cho net_dev */
 /* ... */
 /* Lấy địa chỉ I/O cho vùng PCI này. Tất cả các thanh ghi của thẻ
 được chỉ định trong Bảng 10.3 được giả định nằm trong bar 0 */
 ioaddr = pci_resource_start(pdev, 0);
 /* Yêu cầu một vùng I/O 128-byte */
 request_region(ioaddr, 128, "ntwrk");
 /* Điền thông tin tài nguyên lấy được từ tầng PCI */
 net_dev->base_addr = ioaddr;
 net_dev->irq = pdev->irq;
 /* ... */
 /* Thiết lập DMA. Được định nghĩa trong Listing 10.5 */
 dma_descriptor_setup(pdev);
 /* Đăng ký trình điều khiển với tầng mạng (networking layer). Thao tác này sẽ phân bổ
 một giao diện ethX chưa sử dụng */
 register_netdev(net_dev);
 /* ... */
}
/* Phương thức remove */
static void __devexit
net_driver_remove(struct pci_dev *pdev)
{
 /* Giải phóng vùng đệm DMA truyền và nhận.
 Được định nghĩa trong Listing 10.5 */
 dma_descriptor_release(pdev);
 /* Giải phóng các vùng nhớ */
 /* ... */
 /* Hủy đăng ký khỏi tầng mạng */
 unregister_netdev(dev);
 free_netdev(dev);
```

```
 /* ... */
}
```

### Listing 10.4. Thử nghiệm hàm Modem (Probing the Modem Function)

```
/* Phương thức probe */
static int __devinit
modem_driver_probe(struct pci_dev *pdev,
 const struct pci_device_id *id)
{
 struct uart_port port; /* Xem Chương 6, "Trình điều khiển nối tiếp" (Serial Drivers) */
 /* Yêu cầu mã nguồn PCI cấp thấp bật các vùng I/O và bộ nhớ
 cho thiết bị PCI này */
 pci_enable_device(pdev);
 /* Lấy ngắt IRQ và địa chỉ I/O của PCI sẽ được sử dụng và điền vào
 cấu trúc uart_port (xem Chương 6) với các tài nguyên này. Xem
 include/linux/pci.h để biết các hàm hỗ trợ (helper functions) */
 /* ... */
 /* Đăng ký thông tin này với tầng serial (serial layer) và nhận một
 cổng ttySX chưa sử dụng được phân bổ cho thẻ. Xem Chương 6 để biết
 thêm về trình điều khiển nối tiếp */
 serial8250_register_port(&port);
 /* ... */
}
/* Phương thức remove */
static void __devexit
modem_driver_remove(struct pci_dev *dev)
{
 /* Hủy đăng ký cổng khỏi tầng serial */
 serial8250_unregister_port(&port);
 /* Tắt thiết bị */
 pci_disable_device(dev);
}
```

Để tóm tắt lại, hãy theo dõi đường dẫn mã nguồn từ thời điểm bạn cắm thẻ Ethernet-Modem CardBus cho đến khi bạn được phân bổ một giao diện mạng (`ethX`) và một cổng nối tiếp (`/dev/ttySX`):

Đối với mỗi chức năng CardBus được hỗ trợ, routine khởi tạo trình điều khiển tương ứng sẽ đăng ký một bảng `pci_device_id` gồm các thẻ được hỗ trợ và một routine `probe()`. Điều này được thể hiện trong Listing 10.1 và Listing 10.2. **1.**

- Tầng PCI hotplug phát hiện việc cắm thẻ và thu thập ID nhà sản xuất (vendor ID) cùng ID thiết bị (device ID) của từng chức năng thiết bị từ không gian cấu hình PCI (PCI configuration space) của thẻ. **2.**
- Do các ID khớp với các ID đã được đăng ký bởi trình điều khiển Ethernet và serial của thẻ, các phương thức `probe()` tương ứng sẽ được gọi. Điều này dẫn đến việc gọi `net_driver_probe()` và `modem_driver_probe()` được mô tả lần lượt trong Listing 10.3 và Listing 10.4. **3.**
- Các phương thức `probe()` cấu hình phần Ethernet và modem của trình điều khiển PCI với thông tin tài nguyên. Điều này dẫn đến việc cấp phát một giao diện mạng (`ethX`) và một cổng nối tiếp (`ttySX`) cho thẻ. Từ thời điểm này trở đi, dữ liệu ứng dụng sẽ truyền qua các giao diện này. **4.**

## Truyền dữ liệu (Data Transfer)

Chức năng mạng thuộc thiết bị CardBus mẫu sử dụng chiến lược sau để truyền dữ liệu: Card yêu cầu device driver cung cấp một mảng gồm hai receive DMA descriptor (bộ mô tả DMA nhận) và một mảng gồm hai transmit DMA descriptor (bộ mô tả DMA truyền). Mỗi DMA descriptor chứa địa chỉ của một data buffer (vùng đệm dữ liệu) liên kết, chiều dài của nó và một control word (từ điều khiển). Bạn có thể sử dụng control word để thông báo cho thiết bị biết liệu descriptor có chứa dữ liệu hợp lệ hay không. Đối với một transmit descriptor, bạn cũng có thể lập trình nó để yêu cầu một interrupt (ngắt) sau khi truyền dữ liệu xong. Card sẽ tìm kiếm một descriptor hợp lệ và thực hiện DMA dữ liệu đến/từ data buffer liên kết. Để phù hợp với lược đồ đơn giản này, driver mẫu chỉ sử dụng giao diện coherent DMA (DMA nhất quán). Driver tiến hành cấp phát một cách nhất quán (coherently allocate) một vùng đệm lớn chứa các descriptor và các data buffer liên kết của chúng. Các receive buffer và transmit buffer có chiều dài 1536 byte để khớp với *maximum transmission unit* (MTU - đơn vị truyền tải tối đa) của các khung Ethernet. Các descriptor và buffer được minh họa trực quan trong Hình 10.2. 24 byte trên cùng của mỗi mảng trong hình chứa hai DMA descriptor 12-byte, và phần bộ nhớ còn lại được chiếm bởi hai DMA buffer 1536-byte. Bố cục descriptor 12-byte được hiển thị trong hình giả định là khớp với định dạng được chỉ định trong bảng dữ liệu (data sheet) của card.

**Hình 10.2. Các DMA descriptor và buffer cho thiết bị CardBus.**

```
Receive DMA Descriptors and Buffers                                             Transmit DMA Descriptors and Buffers
(dma_buffer_rx / dma_bus_rx)                                                        (dma_buffer_tx / dma_bus_tx)

     |--------------+----------------------------------+         |--------------+----------------------------------+
     |              | Bus Addr of DMA Buffer 1         |  0      |              | Bus Addr of DMA Buffer 1         |  0
     |              +----------------------------------+         |              +----------------------------------+
     |              | Length of DMA Buffer 1           |  4      |              | Length of DMA Buffer 1           |  4
     |              +----------------------------------+         |              +----------------------------------+
     |              | Control Word 1                   |  8      |              | Control Word 1                   |  8
     |              +----------------------------------+         |              +----------------------------------+
     |      |-------| Bus Addr of DMA Buffer 2         | 12      |      |-------| Bus Addr of DMA Buffer 2         | 12
     |      |       +----------------------------------+         |      |       +----------------------------------+
     |      |       | Length of DMA Buffer 2           | 16      |      |       | Length of DMA Buffer 2           | 16
     |------|------>+----------------------------------+         |------|------>+----------------------------------+
            |       | Control Word 2                   | 20             |       | Control Word 2                   | 20
            |       +----------------------------------+                |       +----------------------------------+
            |       | 1536-byte RX DMA Buffer 1        | 24             |       | 1536-byte TX DMA Buffer 1        | 24
            |       +----------------------------------+                |       +----------------------------------+
            |       | 1536-byte RX DMA Buffer 2        |1560            |       | 1536-byte TX DMA Buffer 2        |1560
            |------>+----------------------------------+                |------>+----------------------------------+
                                                        3096                                                        3096
```

Bảng 10.3 hiển thị bố cục thanh ghi (register layout) của chức năng mạng trên card.

**Bảng 10.3. Bố cục thanh ghi của chức năng mạng trên Card**

| Tên thanh ghi   | Mô tả                                                                                        | Độ lệch (Offset) trong Không gian I/O |
|-----------------|----------------------------------------------------------------------------------------------|-----------------------|
| DMA_RX_REGISTER | Chứa địa chỉ bus của mảng receive DMA<br>descriptor (dma_bus_rx)                             | 0x0                   |
| DMA_TX_REGISTER | Chứa địa chỉ bus của mảng transmit DMA<br>descriptor (dma_bus_tx)                            | 0x4                   |
|                 | CONTROL_REGISTER Từ điều khiển ra lệnh cho card khởi tạo<br>DMA, dừng DMA, v.v.             | 0x8                   |

**Liệt kê 10.5. Thiết lập các DMA Descriptor và Buffer**

```c
/* Device-specific data structure for the Ethernet Function */
struct device_data {
 struct pci_dev *pdev; /* The PCI Device structure */
 struct net_device *ndev; /* The Net Device structure */
 void *dma_buffer_rx; /* Kernel virtual address of the
 receive descriptor */
```

```c
 dma_addr_t dma_bus_rx; /* Địa chỉ Bus của descriptor nhận */
 void *dma_buffer_tx; /* Địa chỉ ảo Kernel của descriptor truyền */
 dma_addr_t dma_bus_tx; /* Địa chỉ Bus của descriptor truyền */
 /* ... */
 spin_lock_t device_lock; /* Đồng bộ hóa (Serialize) */
} *mydev_data;
/* Các thanh ghi trên card liên quan đến DMA */
## define DMA_RX_REGISTER_OFFSET 0x0 /* Offset của thanh ghi chứa địa chỉ bus của RX descriptor */
## define DMA_TX_REGISTER_OFFSET 0x4 /* Offset của thanh ghi chứa địa chỉ bus của TX descriptor */
## define CONTROL_REGISTER 0x8 /* Offset của thanh ghi điều khiển */
/* Định nghĩa cho Thanh ghi Điều khiển */
## define INITIATE_XMIT 0x1
/* Định nghĩa từ điều khiển descriptor */
## define FREE_FLAG 0x1 /* Descriptor trống */
## define INTERRUPT_FLAG 0x2 /* Kích hoạt ngắt sau khi DMA */
/* Được gọi từ Listing 10.3 */
static void
dma_descriptor_setup(struct pci_dev *pdev)
{
 /* Cấp phát các DMA descriptor và bộ đệm nhận */
 mydev_data->dma_buffer_rx =
 pci_alloc_consistent(pdev, 3096, &mydev_data->dma_bus_rx);
 /* Điền thông tin cho hai descriptor nhận như minh họa trong Hình 10.2 */
 /* RX descriptor 1 */
 mydev_data->dma_buffer_rx[0] = cpu_to_le32((unsigned long)
 (mydev_data->dma_bus_rx + 24)); /* Địa chỉ bộ đệm */
 mydev_data->dma_buffer_rx[1] = 1536; /* Đồ dài bộ đệm */
 mydev_data->dma_buffer_rx[2] = FREE_FLAG; /* Descriptor đang trống */
 /* RX descriptor 2 */
 mydev_data->dma_buffer_rx[3] = cpu_to_le32((unsigned long)
 (mydev_data->dma_bus_rx + 1560)); /* Địa chỉ bộ đệm */
 mydev_data->dma_buffer_rx[4] = 1536; /* Độ dài bộ đệm */
 mydev_data->dma_buffer_rx[5] = FREE_FLAG; /* Descriptor đang trống */
 wmb(); /* Hàng rào bộ nhớ ghi (Write Memory Barrier) */
 /* Ghi địa chỉ của descriptor nhận vào thanh ghi thích hợp
 trên card. Địa chỉ cơ sở I/O, ioaddr, đã được gán
 trong Listing 10.3 */
 outl(cpu_to_le32((unsigned long)mydev_data->dma_bus_rx),
 ioaddr + DMA_RX_REGISTER_OFFSET);
 /* Cấp phát các DMA descriptor và bộ đệm truyền */
 mydev_data->dma_buffer_tx =
 pci_alloc_consistent(pdev, 3096, &mydev_data->dma_bus_tx);
 /* Điền thông tin cho hai descriptor truyền như minh họa trong Hình 10.2 */
 /* TX descriptor 1 */
```

```c
 mydev_data->dma_buffer_tx[0] = cpu_to_le32((unsigned long)
 (mydev_data->dma_bus_tx + 24)); /* Địa chỉ bộ đệm */
 mydev_data->dma_buffer_tx[1] = 1536; /* Độ dài bộ đệm */
 /* Descriptor hợp lệ. Tạo ra một ngắt
 sau khi hoàn tất quá trình DMA */
 mydev_data->dma_buffer_tx[2] = (FREE_FLAG | INTERRUPT_FLAG);
 /* TX descriptor 2 */
 mydev_data->dma_buffer_tx[3] = cpu_to_le32((unsigned long)
 (mydev_data->dma_bus_tx + 1560)); /* Địa chỉ bộ đệm */
 mydev_data->dma_buffer_tx[4] = 1536; /* Độ dài bộ đệm */
 mydev_data->dma_buffer_tx[5] = (FREE_FLAG | INTERRUPT_FLAG);
 wmb(); /* Hàng rào bộ nhớ ghi (Write Memory Barrier) */
 /* Ghi địa chỉ của descriptor truyền vào thanh ghi tương ứng
 trên card. Địa chỉ cơ sở I/O, ioaddr, đã được gán trong
 Listing 10.3 */
 outl(cpu_to_le32((unsigned long)mydev_data->dma_bus_tx),
 ioaddr + DMA_TX_REGISTER_OFFSET);
}
/* Được gọi từ Listing 10.3 */
static void
dma_descriptor_release(struct pci_dev *pdev)
{
 pci_free_consistent(pdev, 3096, mydev_data->dma_bus_tx);
 pci_free_consistent(pdev, 3096, mydev_data->dma_bus_rx);
}
```

Listing 10.5 thực thi một hàng rào ghi bằng cách gọi hàm `wmb()` để ngăn CPU sắp xếp lại lệnh `outl()` trước khi điền dữ liệu vào DMA descriptor. Trên bộ xử lý x86, `wmb()` được rút gọn thành một lệnh NOP vì các CPU Intel bắt buộc thực hiện các lệnh ghi theo đúng thứ tự chương trình (program order). Khi ghi địa chỉ DMA descriptor vào card và khi điền địa chỉ bus của bộ đệm vào bên trong DMA descriptor, driver thực hiện chuyển đổi thứ tự byte gốc sang định dạng PCI little-endian bằng cách sử dụng `cpu_to_le32()`. Trên các CPU Intel, thao tác này tiếp tục không có tác dụng gì vì cả PCI và bộ xử lý Intel đều giao tiếp theo chuẩn little-endian. Trên một số kiến trúc khác, ví dụ như CPU ARM9 chạy ở chế độ big-endian, cả `wmb()` và `cpu_to_le32()` đều mang ý nghĩa quan trọng.

Bây giờ các descriptor và bộ đệm đã được ánh xạ (mapped) và sẵn sàng hoạt động, đã đến lúc xem xét cách dữ liệu được trao đổi giữa hệ thống và thiết bị CardBus, như được minh họa trong Listing 10.6. Chúng ta sẽ không đi sâu vào các giao diện mạng (network interfaces) và cấu trúc dữ liệu mạng vì Chương 15 được dành riêng cho việc đó.

**Listing 10.6. Nhận và Truyền Dữ liệu**

```c
/* Trình xử lý ngắt (Interrupt Handler) */
static irqreturn_t
mydevice_interrupt(int irq, void *devid)
{
 struct sk_buff *skb;
 /* ... */
 /* Nếu đây là ngắt nhận (receive interrupt), thu thập gói tin và chuyển nó
 lên các tầng cao hơn. Kiểm tra từ điều khiển (control word) trong mỗi RX DMA
 descriptor để xác định xem nó có chứa dữ liệu hay không. Giả sử để cho thuận tiện
 rằng RX descriptor đầu tiên đã được card sử dụng
```

```c
 để thực hiện DMA gói tin nhận được này */
 packet_size = mydev_data->dma_buffer_rx[1];
 /* Trong các driver thực tế, sk_buff được cấp phát trước, ánh xạ luồng (stream-mapped),
 và cung cấp cho card sau khi thiết lập FREE_FLAG trong hàm open() của thiết bị.
 Dữ liệu nhận được được DMA trực tiếp vào sk_buff này thay vì sử dụng memcpy()
 như thực hiện ở đây, bạn sẽ tìm hiểu điều này trong Chương 15. Card sẽ xóa
 FREE_FLAG trước khi thực hiện DMA */
 skb = dev_alloc_skb(packet_size); /* Xem Hình 15.2 của Chương 15 */
 skb->dev = mydev_data->ndev; /* Thiết bị mạng sở hữu */
 memcpy(skb, mydev_data->dma_buffer_rx[24], packet_size);
 /* Chuyển dữ liệu nhận được cho các giao thức tầng cao hơn */
 skb_put(skb, packet_size);
 netif_rx(skb);
 /* ... */
 /* Làm cho descriptor có thể được sử dụng lại bởi card */
 mydev_data->dma_buffer_rx[2] |= FREE_FLAG;
}
/* Hàm này được đăng ký trong Listing 10.3 và được gọi từ
 tầng mạng. Tìm hiểu thêm về giao diện thiết bị mạng trong
 Chương 15 */
static int
mydevice_xmit(struct sk_buff *skb, struct net_device *dev)
{
 /* Sử dụng một TX descriptor hợp lệ. Hãy xem Hình 10.2 */
 /* Việc khóa (locking) đã được lược bỏ để đơn giản hóa */
 if (mydev_data->dma_buffer_tx[2] & FREE_FLAG) {
 /* Sử dụng TX descriptor đầu tiên */
 /* Trong thực tế, DMA diễn ra trực tiếp từ sk_buff
 như bạn sẽ học sau này! */
 memcpy(mydev_data->dma_buffer_tx[24], skb->data, skb->len);
 mydev_data->dma_buffer_tx[1] = skb->len;
 mydev_data->dma_buffer_tx[2] &= ~FREE_FLAG;
 mydev_data->dma_buffer_tx[2] |= INTERRUPT_FLAG;
 } else if (mydev_data->dma_buffer[5] & FREE_FLAG) {
 /* Sử dụng TX descriptor thứ hai */
 memcpy(mydev_data->dma_buffer_tx[1560], skb->data, skb->len);
 mydev_data->dma_buffer_tx[4] = skb->len;
 mydev_data->dma_buffer_tx[5] &= ~FREE_FLAG;
 mydev_data->dma_buffer_tx[5] |= INTERRUPT_FLAG;
 } else {
 return –EIO; /* Báo lỗi cho hàm gọi */
 }
 wmb(); /* Không sắp xếp lại các thao tác ghi qua hàng rào này */
 /* Yêu cầu card khởi tạo DMA. ioaddr được định nghĩa
 trong Listing 10.3 */
 outl(INITIATE_XMIT, ioaddr + CONTROL_REGISTER);
}
```

Khi thiết bị CardBus nhận được một gói tin mạng (Ethernet packet), nó thực hiện DMA (Direct Memory Access) gói tin đó vào một descriptor nhận (RX descriptor) trống và ngắt (interrupt) CPU. Hàm xử lý ngắt `mydevice_interrupt()` thu thập gói tin từ bộ đệm DMA nhận (receive DMA buffer), sao chép nó vào một cấu trúc dữ liệu mạng (`sk_buff`), và chuyển nó lên các tầng giao thức cao hơn.

Thường trực truyền (transmit routine) `my_device_xmit()` chịu trách nhiệm khởi tạo DMA theo hướng ngược lại. Nó thực hiện DMA các gói tin truyền vào bộ nhớ của thẻ (card memory). Để làm điều này, `my_device_xmit()` chọn một TX DMA descriptor chưa được sử dụng bởi thẻ (hoặc có cờ `FREE_FLAG` được thiết lập) và sử dụng bộ đệm truyền liên kết để truyền dữ liệu. `FREE_FLAG` được xóa ngay sau đó, báo hiệu rằng descriptor hiện thuộc về thẻ. Descriptor được giải phóng trong hàm xử lý ngắt (`FREE_FLAG` lại được thiết lập) khi thẻ khẳng định (assert) một ngắt sau khi hoàn tất việc truyền (không được hiển thị trong Liệt kê 10.6).

Trình điều khiển (driver) ví dụ này sử dụng một lược đồ quản lý bộ đệm đơn giản không nhạy cảm với hiệu năng. Các trình điều khiển mạng tốc độ cao thực hiện một kế hoạch phức tạp hơn, sử dụng kết hợp các ánh xạ DMA nhất quán (coherent DMA mappings) và dòng chảy (streaming DMA mappings). Chúng duy trì các danh sách liên kết (linked lists) của các descriptor truyền và nhận, đồng thời thực hiện các vùng chứa (pool) trống và đang sử dụng để quản lý bộ đệm. Các cấu trúc dữ liệu nhận và truyền của chúng trông như sau:

```c
/* Ring of receive buffers */
struct rx_list {
 void *dma_buffer_rx; /* Kernel virtual address of the
 transmit descriptor */
 dma_addr_t dma_bus_rx; /* Bus address of the transmit
 descriptor */
 unsigned int size; /* Buffer size */
 struct list_head next_desc; /* Pointer to the next element */
 struct sk_buff *skb; /* Network Packet */
 dma_addr_t sk_bus; /* Bus address of network packet */
} *rxlist;
/* Ring of transmit buffers */
struct tx_list {
 void *dma_buffer_tx; /* Kernel virtual address of the
 receive descriptor */
 dma_addr_t dma_bus_tx; /* Bus address of the transmit
 descriptor */
 unsigned int size; /* Buffer size */
 struct list_head next_desc; /* Pointer to the next element */
 struct sk_buff *skb; /* Network Packet */
 dma_addr_t sk_bus; /* Bus address of network packet */
} *txlist;
```

Các DMA descriptor nhận và truyền (`rxlist->dma_buffer_rx` và `txlist->dma_buffer_tx`) được ánh xạ nhất quán (coherently mapped) như đã thực hiện trong Liệt kê 10.5. Tuy nhiên, các bộ đệm dữ liệu tải trọng (`rxlist->skb->data` và `txlist->skb->data`) được ánh xạ bằng cách sử dụng streaming DMA. Các bộ đệm nhận được cấp phát trước (preallocated) và được ánh xạ dòng (stream mapped) vào một pool trống trong quá trình thiết bị mở (device open), trong khi các bộ đệm truyền được ánh xạ tức thời (on-the-fly). Điều này giúp tránh việc sao chép dữ liệu bổ sung được thực hiện bởi `mydevice_interrupt()` từ bộ đệm DMA nhận được ánh xạ nhất quán sang bộ đệm mạng (và việc sao chép bổ sung được thực hiện bởi `mydevice_xmit()` theo hướng ngược lại).

```c
/* Preallocating/replenishing receive buffers. Also see the section, "Buffer
 Management and Concurrency Control" in Chapter 15 */
/* ... */
struct sk_buff *skb = dev_alloc_skb();
skb_reserve(skb, NET_IP_ALIGN);
/* Map using streaming DMA */
rxlist->sk_bus = pci_map_single(pdev, rxlist->skb->data,
 rxlist->skb->len, PCI_DMA_TODEVICE);
```

```c
/* Cấp phát một DMA descriptor và điền địa chỉ đã ánh xạ ở trên vào đó. Thêm descriptor vào vòng descriptor nhận */
/* ... */
```

$\langle \cdot \rangle$

## Gỡ lỗi (Debugging)

Kích hoạt *Bus Options PCI Support PCI Debugging* trong menu cấu hình nhân (kernel configuration menu) để yêu cầu PCI core phát ra các thông báo gỡ lỗi. Khám phá `/proc/bus/pci/devices` và `/sys/devices/pciX:Y/` để biết thông tin về các thiết bị PCI trên hệ thống của bạn, chẳng hạn như thẻ CardBus Ethernet-Modem được thảo luận trong chương này. `/proc/interrupts` liệt kê các IRQ đang hoạt động trên hệ thống của bạn, bao gồm cả những IRQ được sử dụng bởi tầng PCI.

Như bạn đã thấy, `lspci` thu thập thông tin về tất cả các bus và thiết bị PCI trên hệ thống của bạn. Bạn cũng có thể sử dụng nó để kết xuất (dump) không gian cấu hình (configuration space) của các thẻ PCI.

Bộ phân tích bus PCI (PCI bus analyzer) có thể giúp gỡ lỗi các vấn đề cấp thấp và tối ưu hóa hiệu năng.

## Xem xét Mã nguồn (Looking at the Sources)

PCI core và các hàm truy cập bus nằm trong *drivers/pci/*. Để lấy danh sách các hàm hỗ trợ (helper routines) được cung cấp bởi hệ thống con PCI (PCI subsystem), hãy tìm kiếm `EXPORT_SYMBOL` bên trong thư mục này. Đối với các định nghĩa và nguyên mẫu (prototypes) liên quan đến tầng PCI, hãy xem *include/linux/pci\*.h*.

Bạn có thể phát hiện một số trình điều khiển thiết bị PCI trong các thư mục con dưới *drivers/net/*, *drivers/scsi/* và *drivers/video/*. Để định vị tất cả các trình điều khiển PCI, hãy grep đệ quy cây *drivers/* cho `pci_register_driver()`.

Nếu bạn không tìm thấy một điểm khởi đầu tốt để phát triển một trình điều khiển mạng PCI tùy chỉnh, hãy bắt đầu với trình điều khiển mạng PCI khung xương (skeletal PCI network driver) *drivers/net/pci-skeleton.c*. Để có một hướng dẫn ngắn gọn về lập trình PCI, hãy xem *Documentation/pci.txt*. Để có mô tả về API PCI DMA, hãy đọc *Documentation/DMA-mapping.txt*.

Bảng 10.4 tóm tắt các cấu trúc dữ liệu chính được sử dụng trong chương này. Bảng 10.5 liệt kê các giao diện lập trình nhân (kernel programming interfaces) chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

**Bảng 10.4. Tóm tắt các Cấu trúc Dữ liệu (Data Structures)**

| Cấu trúc Dữ liệu (Data Structure) | Vị trí (Location)                   | Mô tả (Description)                                                         |
|-----------------------------------|-------------------------------------|-----------------------------------------------------------------------------|
| pci_dev                           | include/linux/pci.h                 | Đại diện cho một thiết bị PCI (PCI device)                                  |
| pci_driver                        | include/linux/pci.h                 | Đại diện cho một trình điều khiển PCI (PCI driver)                          |
| pci_device_id                     | include/linux/mod_devicetable.h     | Định danh của một thẻ PCI (PCI card)                                        |
| dma_addr_t                        | include/asm-your-arch/types.h       | Địa chỉ bus của một bộ đệm DMA (DMA buffer)                                 |
| scatterlist                       | include/asm-your-arch/scatterlist.h | Danh sách scatter-gather của các bộ đệm<br>DMA (DMA buffers)                |
| sk_buff                           | include/linux/skbuff.h              | Cấu trúc dữ liệu mạng chính<br>(xem Chương 15 để biết thêm<br>chi tiết)     |

**Bảng 10.5. Tóm tắt các Giao diện Lập trình Kernel (Kernel Programming Interfaces)**

| Giao diện Kernel (Kernel Interface)                                                                                                                           | Vị trí (Location)                           | Mô tả (Description)                                                                                                               |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| pci_read_config_byte()<br>pci_read_config_word()<br>pci_read_config_dword()<br>pci_write_config_byte()<br>pci_write_config_word()<br>pci_write_config_dword() | include/linux/pci.h<br>drivers/pci/access.c | Các hàm thực thi thao tác trên không gian<br>cấu hình PCI (PCI configuration space).                                             |
| pci_resource_start()<br>pci_resource_len()<br>pci_resource_end()<br>pci_resource_flags()                                                                      | include/linux/pci.h                         | Các hàm này thao tác trên các vùng bộ nhớ<br>và I/O của PCI để lấy địa chỉ cơ sở, chiều dài,<br>địa chỉ kết thúc và các cờ điều khiển. |
| pci_request_region()                                                                                                                                          | drivers/pci/pci.c                           | Dự trữ các vùng bộ nhớ hoặc I/O của PCI.<br>                                                                                      |

| Giao diện Kernel (Kernel Interface)                 | Vị trí (Location)                                                                    | Mô tả (Description)                                                                                          |
|-----------------------------------------------------|--------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| ioremap()<br>ioremap_nocache()<br>pci_iomap()       | include/asm-your<br>arch/io.h                                                        | Lấy quyền truy cập của CPU vào bộ nhớ<br>thiết bị (device memory).                                             |
|                                                     | arch/your<br>arch/mm/ioremap.c                                                       |                                                                                                              |
|                                                     | lib/iomap.c                                                                          |                                                                                                              |
| pci_set_dma_mask()                                  | drivers/pci/pci.c                                                                    | Nếu hàm này trả về thành công, bạn<br>có thể thực hiện DMA đến bất kỳ địa chỉ nào<br>trong mặt nạ (mask) được chỉ định làm đối số. |
| pci_alloc_consistent()                              | include/asm<br>generic/pci-dma<br>compat.h include/asm<br>your-arch/dma<br>mapping.h | Lấy một ánh xạ bộ đệm DMA đồng nhất<br>với bộ nhớ cache (cache-coherent DMA buffer mapping).                  |
| pci_free_consistent()                               | include/asm<br>generic/pci-dma<br>compat.h include/asm<br>your-arch/dma<br>mapping.h | Hủy ánh xạ một bộ đệm DMA đồng nhất với<br>bộ nhớ cache (cache-coherent DMA buffer).                         |

| pci_map_single() | include/asm<br>generic/pci-dma<br>compat.h include/asm<br>your-arch/dma<br>mapping.h | Lấy một ánh xạ vùng đệm DMA dạng streaming (streaming DMA buffer mapping). |
| pci_unmap_single() | include/asm<br>generic/pci-dma<br>compat.h include/asm<br>your-arch/dma<br>mapping.h | Hủy ánh xạ vùng đệm DMA dạng streaming. |
| pci_dma_sync_single() | include/asm<br>generic/pci-dma<br>compat.h include/asm<br>your-arch/dma<br>mapping.h | Đồng bộ hóa một vùng đệm DMA dạng streaming để CPU có thể thao tác với nó một cách đáng tin cậy. |
| pci_map_sg()<br>pci_unmap_sg()<br>pci_dma_sync_sg() | include/asm<br>generic/pci-dma<br>compat.h include/asm<br>your-arch/dma<br>mapping.h | Ánh xạ/hủy ánh xạ/đồng bộ hóa danh sách scatter-gather của các vùng đệm DMA dạng streaming. |
| pci_register_driver() | include/linux/pci.h<br>drivers/pci/pci-driver.c | Đăng ký một trình điều khiển (driver) với tầng lõi PCI (PCI core). |
| pci_unregister_driver() | drivers/pci/pci-driver.c | Hủy đăng ký một trình điều khiển khỏi tầng lõi PCI (PCI core). |
| pci_enable_device() | drivers/pci/pci.c | Yêu cầu mã nguồn PCI cấp thấp bật các vùng I/O và bộ nhớ cho thiết bị này. |

| Giao diện Kernel     | Vị trí            | Mô tả                                         |
|----------------------|-------------------|-----------------------------------------------|
| pci_disable_device() | drivers/pci/pci.c | Ngược lại với<br>pci_enable_device().         |
| pci_set_master()     | drivers/pci/pci.c | Đặt thiết bị vào chế độ DMA bus<br>mastering. |
