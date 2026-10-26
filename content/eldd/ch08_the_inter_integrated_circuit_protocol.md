# Chương 8. Giao thức Inter-Integrated Circuit

| Trong chương này                        |     |
|-----------------------------------------|-----|
| I2C/SMBus là gì?                        | 234 |
| I2C Core                                | 235 |
| Các giao dịch trên Bus (Bus Transactions)| 237 |
| Ví dụ về thiết bị: EEPROM               | 238 |
| Ví dụ về thiết bị: Real Time Clock      | 247 |
| I2C-dev                                 | 251 |
| Giám sát phần cứng sử dụng LM Sensors   | 251 |
| Bus Serial Peripheral Interface         | 251 |
| Bus 1-Wire                              | 254 |
| Gỡ lỗi (Debugging)                      | 254 |
| Xem xét mã nguồn                         | 255 |

Giao diện Inter-Integrated Circuit, hay bus I2C (được phát âm là *I squared C*) và tập con của nó, *System Management Bus* (SMBus), là các giao diện nối tiếp đồng bộ (synchronous serial interfaces) rất phổ biến trên máy tính để bàn (desktops) và các thiết bị nhúng (embedded devices). Hãy cùng tìm hiểu cách kernel hỗ trợ các trình điều khiển bộ chuyển đổi máy chủ (host adapters) và các thiết bị khách (client devices) I2C/SMBus bằng cách triển khai các trình điều khiển mẫu để truy cập vào một EEPROM I2C và một RTC I2C. Và trước khi khép lại chương này, chúng ta cũng sẽ sơ lược qua hai giao diện nối tiếp khác được hỗ trợ bởi kernel: bus *Serial Peripheral Interface* hay SPI (thường được phát âm là *spy*) và bus 1-wire.

Tất cả các giao diện nối tiếp này (I2C, SMBus, SPI và 1-wire) đều có chung hai đặc điểm:

- Lượng dữ liệu trao đổi nhỏ.
- Tốc độ truyền dữ liệu yêu cầu thấp.

## I2C/SMBus là gì?

I <sup>2</sup>C là một bus nối tiếp được sử dụng rộng rãi trong máy tính để bàn và máy tính xách tay để kết nối bộ vi xử lý (processor) với các thiết bị như EEPROM, các codec âm thanh, và các chip chuyên dụng giám sát các thông số như nhiệt độ và điện áp nguồn cấp. Ngoài ra, I2C được sử dụng rộng rãi trong các thiết bị nhúng để giao tiếp với RTC, mạch pin thông minh (smart battery circuits), bộ ghép kênh (multiplexers), bộ mở rộng cổng (port expanders), bộ thu phát quang (optical transceivers) và các thiết bị tương tự khác. Vì I2C được hỗ trợ bởi một số lượng lớn các vi điều khiển (microcontrollers), có rất nhiều thiết bị I2C giá rẻ có sẵn trên thị trường hiện nay.

I <sup>2</sup>C và SMBus là các giao thức chủ-tớ (master-slave protocols) trong đó giao tiếp diễn ra giữa *host adapter* (hoặc *host controller*) và *client devices* (hoặc *slaves*). Host adapter thường là một phần của chipset South Bridge trên máy tính để bàn và là một phần của vi điều khiển trên các thiết bị nhúng. Hình 8.1 hiển thị một ví dụ về bus I2C trên phần cứng tương thích PC.

**Hình 8.1. I2C/SMBus trên phần cứng tương thích PC.**

```
+-----------+
| Processor |
+-----------+
      ^
      |
      v
+-------------+
| North Bridge|
+-------------+
      ^    |---------->I²C/SMBus Host Adapter
      |    |                    +--------+ 
      v    |               |----| EEPROM |-----------------------------|
+-------------+  I2C       |    +--------+                             |
| South Bridge|--------------------------------------------------------|-------------  (bus)
+-------------+         |Control            |                          v
      |                 |                   |                   I²C/SMBus Client Devices
      |  AC'97          |                   |                      ^   ^
      |              +-------+      +----------------------+       |   |
      |--------------| CODEC |      | Temperature Sensor   |-------|   |
                     +-------+      |        Chip          |           |
                          |         +----------------------+           |
                          |____________________________________________|
```

I <sup>2</sup>C và tập con SMBus của nó là các giao diện 2 dây được phát triển lần lượt bởi Philips và Intel. Hai dây này gồm dây *clock* và dây *data* hai chiều, các đường tín hiệu tương ứng được gọi là *Serial CLock* (SCL) và *Serial DAta* (SDA). Do bus I2C chỉ cần một cặp dây, nó tiêu tốn ít không gian hơn trên bo mạch chủ (circuit board). Tuy nhiên, băng thông được hỗ trợ cũng thấp. I2C cho phép tốc độ lên tới 100Kbps ở chế độ chuẩn (standard mode) và 400Kbps ở chế độ nhanh (fast mode). (Tuy nhiên, SMBus chỉ hỗ trợ tối đa 100Kbps.) Do đó, bus này chỉ phù hợp với các thiết bị ngoại vi chậm. Mặc dù I2C hỗ trợ trao đổi hai chiều, nhưng giao tiếp là bán song công (half duplex) vì chỉ có một đường dữ liệu duy nhất.

Các thiết bị I <sup>2</sup>C và SMBus sở hữu địa chỉ 7-bit. Giao thức này cũng hỗ trợ địa chỉ 10-bit, nhưng nhiều thiết bị chỉ phản hồi với địa chỉ 7-bit, cho phép tối đa 127 thiết bị trên bus. Do bản chất chủ-tớ của giao thức, các địa chỉ thiết bị còn được gọi là *slave addresses* (địa chỉ tớ).

#### I <sup>2</sup>C Core

I2C core là một cơ sở mã (code base) bao gồm các hàm (routines) và cấu trúc dữ liệu có sẵn cho các trình điều khiển host adapter và trình điều khiển client. Mã nguồn chung trong core giúp công việc của nhà phát triển trình điều khiển trở nên dễ dàng hơn. Core cũng cung cấp một mức độ gián tiếp (level of indirection) giúp các trình điều khiển client độc lập với host adapter, cho phép chúng hoạt động mà không cần thay đổi ngay cả khi thiết bị client được sử dụng trên một bo mạch có host adapter I2C khác. Triết lý về một tầng core (core layer) và các lợi ích đi kèm của nó cũng có giá trị đối với nhiều lớp trình điều khiển thiết bị khác trong kernel, chẳng hạn như PCMCIA, PCI và USB.

Ngoài nhân (core), hạ tầng I2C của Linux Kernel bao gồm các thành phần sau:

- Trình điều khiển thiết bị (Device drivers) cho các bộ điều khiển host I2C (host adapters). Chúng thuộc nhóm các trình điều khiển bus (bus drivers) và thường bao gồm một trình điều khiển *adapter* và một trình điều khiển *algorithm* (thuật toán). Trình điều khiển trước sử dụng trình điều khiển sau để giao tiếp với I2C bus.
- Trình điều khiển thiết bị cho các thiết bị client I2C (client devices).
- `i2c-dev`, cho phép triển khai các trình điều khiển client I2C ở chế độ người dùng (user mode).

Bạn có nhiều khả năng sẽ phải triển khai các trình điều khiển client hơn là trình điều khiển adapter hoặc algorithm bởi vì có nhiều thiết bị I<sup>2</sup>C hơn rất nhiều so với các bộ điều khiển host I2C. Do đó, chúng ta sẽ giới hạn phạm vi ở các trình điều khiển client trong chương này.

Hình 8.2 minh họa hệ thống con (subsystem) I2C của Linux. Nó cho thấy các module kernel I2C giao tiếp với một host adapter và một thiết bị client trên một I2C bus.

**Hình 8.2. Hệ thống con I2C của Linux.**

[Xem hình ảnh kích thước đầy đủ]

```
                          User Space
           +--------------------+                             +--------------------------+
           |   User Application |                             | I²C User Mode            |
           +--------------------+                             |   Device Driver          |
                     |                                        +--------------------------+
                     |                                                   ^
---------------------|----------Kernel Space / User Space ---------------|----------------------------------------
                     v                                                   |
                 +-----------+                                           |
                 | /sys,/dev |                                           |
                 +-----------+                                           |
                     ^                                                   |
                     |                                                   |
                     v                                                   v
              +----------------+          +----------------+       +----------------+
              | I²C Client     |<---------|   i2c-core     |<----->|   i2c-dev      |
              |   Driver       |          +----------------+       +----------------+
              +----------------+                |
                      ^                         V
                      |                 +-------------------+
                      |                 | I²C Adapter/Algo  |
                      |                 |       Driver      |
                      |                 +-------------------+
                      |                             ^
----------------------|-----------------------------|------------- Hardware / Kernel Space ---------------------------
                      v                             v
             +-------------+     I²C Bus      +--------------------+
             | I²C Device  |==================| I²C Host Controller|
             +-------------+                  +--------------------+
```

Vì SMBus là một tập con của I2C, nên việc chỉ sử dụng các lệnh SMBus để giao tiếp với thiết bị của bạn sẽ tạo ra một trình điều khiển tương thích với cả adapter SMBus và I2C. Bảng 8.1 liệt kê các hàm truyền dữ liệu tương thích với SMBus được cung cấp bởi I<sup>2</sup>C core.

**Bảng 8.1. Các hàm truy cập dữ liệu tương thích với SMBus do I2C Core cung cấp**

| Hàm                         | Mục đích                                                                                                                                |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| i2c_smbus_read_byte()       | Đọc một byte đơn từ thiết bị mà không cần chỉ định<br>vị trí offset. Sử dụng cùng một offset<br>như lệnh đã được phát hành trước đó.     |
| i2c_smbus_write_byte()      | Gửi một byte đơn đến thiết bị tại cùng một memory<br>offset như lệnh đã được phát hành trước đó.                                          |
| i2c_smbus_write_quick()     | Gửi một bit đơn đến thiết bị (thay thế cho bit<br>Rd/Wr được hiển thị trong Liệt kê 8.1).                                                 |
| i2c_smbus_read_byte_data()  | Đọc một byte đơn từ thiết bị tại một offset<br>được chỉ định.                                                                             |
| i2c_smbus_write_byte_data() | Gửi một byte đơn đến thiết bị tại một offset<br>được chỉ định.                                                                            |
| i2c_smbus_read_word_data()  | Đọc 2 byte từ offset được chỉ định.                                                                                                     |
| i2c_smbus_write_word_data() | Gửi 2 byte đến offset được chỉ định.                                                                                                    |

| Hàm (Function) | Mục đích (Purpose) |
|------------------------------|-----------------------------------------------------------------|
| i2c_smbus_read_block_data()  | Đọc một khối dữ liệu từ offset chỉ định.                |
| i2c_smbus_write_block_data() | Gửi một khối dữ liệu (<= 32 bytes) đến offset<br>được chỉ định. |

## Các Giao dịch trên Bus (Bus Transactions)

Trước khi triển khai một driver mẫu, hãy cùng tìm hiểu sâu hơn về giao thức I2C bằng cách quan sát kỹ các tín hiệu trên đường dây. Liệt kê 8.1 cho thấy một đoạn mã nguồn giao tiếp với một I2C EEPROM và các giao dịch tương ứng xảy ra trên bus. Các giao dịch này được bắt (capture) lại bằng cách kết nối một thiết bị phân tích bus I2C (I2C bus analyzer) trong khi chạy đoạn mã. Đoạn mã này sử dụng các hàm I2C ở chế độ người dùng (user mode). (Chúng ta sẽ thảo luận nhiều hơn về lập trình I2C ở User Space trong Chương 19, "Drivers in User Space".)

**Liệt kê 8.1. Các giao dịch trên I2C Bus**

```
/* ... */
/*
 * Kết nối với EEPROM. 0x50 là địa chỉ thiết bị (device address).
 * smbus_fp là một con trỏ tệp (file pointer) trỏ vào thiết bị SMBus.
 */
ioctl(smbus_fp, 0x50, slave);
/* Ghi một byte (0xAB) tại memory offset 0 trên EEPROM */
i2c_smbus_write_byte_data(smbus_fp, 0, 0xAB);
/*
 * Đây là giao dịch tương ứng được quan sát thấy
 * trên bus sau lệnh ghi:
 * S 0x50 Wr [A] 0 [A] 0xAB [A] P
 *
 * S là bit bắt đầu (start bit), 0x50 là địa chỉ slave 7-bit (7-bit slave address) (0101000b),
 * Wr là lệnh ghi (write command) (0b), A là bit chấp nhận (Accept bit) (hoặc
 * tín hiệu xác nhận - acknowledgment) được nhận bởi host từ slave, 0 là
 * offset địa chỉ trên thiết bị slave nơi byte dữ liệu sẽ được
 * ghi vào, 0xAB là dữ liệu cần ghi, và P là bit dừng (stop bit).
 * Dữ liệu được đặt trong dấu ngoặc vuông [] được gửi từ slave đến
 * host, trong khi các phần còn lại được gửi bởi host đến
 * slave.
 */
/* Đọc một byte từ offset 0 trên EEPROM */
res = i2c_smbus_read_byte_data(smbus_fp, 0);
/*
 * Đây là giao dịch tương ứng được quan sát thấy
 * trên bus sau lệnh đọc:
 * S 0x50 Wr [A] 0 [A] S 0x50 Rd [A] [0xAB] NA P
 *
 * Giải thích về các bit hoàn toàn tương tự như trước, ngoại trừ việc
 * Rd là viết tắt của lệnh đọc (Read command) (1b), 0xAB là dữ liệu nhận được
 * từ slave, và NA là bit không chấp nhận (Reverse Accept bit) (hoặc
 * tín hiệu xác nhận do host gửi cho slave).
 */
```

## Ví dụ về Thiết bị: EEPROM

Thiết bị client mẫu đầu tiên của chúng ta là một EEPROM nằm trên I2C bus, như được hiển thị trong Hình 8.1. Hầu hết các máy tính xách tay và máy tính để bàn đều có một EEPROM như vậy để lưu trữ thông tin cấu hình BIOS. EEPROM trong ví dụ có hai ngân hàng bộ nhớ (memory banks). Driver sẽ xuất ra các giao diện */dev* tương ứng với từng ngân hàng: */dev/eep/0* và */dev/eep/1.* Các ứng dụng thao tác trên các nút (nodes) này để trao đổi dữ liệu với EEPROM.

Mỗi thiết bị client I2C/SMBus được gán một địa chỉ slave (slave address) đóng vai trò là định danh thiết bị (device identifier). EEPROM trong ví dụ phản hồi lại hai địa chỉ slave là SLAVE\_ADDR1 và SLAVE\_ADDR2, mỗi địa chỉ tương ứng cho một ngân hàng bộ nhớ.

Driver mẫu sử dụng các lệnh I2C tương thích với SMBus, do đó nó hoạt động được với cả EEPROM chuẩn I2C và SMBus.

## Khởi tạo (Initializing)

Giống như tất cả các lớp trình điều khiển (driver classes) khác, các I2C client driver cũng sở hữu một điểm vào `init()`. Việc khởi tạo bao gồm cấp phát các cấu trúc dữ liệu (data structures), đăng ký driver với lõi I2C (I2C core), và kết nối với `sysfs` cũng như mô hình thiết bị Linux (Linux device model). Quá trình này được thể hiện trong Liệt kê 8.2 (Listing 8.2).

#### Liệt kê 8.2. Khởi tạo EEPROM Driver (Initializing the EEPROM Driver)

```c
/* Driver entry points */
static struct file_operations eep_fops = {
 .owner = THIS_MODULE,
 .llseek = eep_llseek,
 .read = eep_read,
 .ioctl = eep_ioctl,
 .open = eep_open,
 .release = eep_release,
 .write = eep_write,
};
static dev_t dev_number; /* Allotted Device Number */
static struct class *eep_class; /* Device class */
/* Per-device client data structure for each
 * memory bank supported by the driver
 */
struct eep_bank {
 struct i2c_client *client; /* I2C client for this bank */
 unsigned int addr; /* Slave address of this bank */
 unsigned short current_pointer; /* File pointer */
 int bank_number; /* Actual memory bank number */
 /* ... */ /* Spinlocks, data cache for
 slow devices,.. */
};
## define NUM_BANKS 2 /* Two supported banks */
## define BANK_SIZE 2048 /* Size of each bank */
struct ee_bank *ee_bank_list; /* List of private data
 structures, one per bank */
```

```c
/*
 * Device Initialization
 */
int __init
eep_init(void)
{
 int err, i;
 /* Allocate the per-device data structure, ee_bank */
 ee_bank_list = kmalloc(sizeof(struct ee_bank)*NUM_BANKS,
 GFP_KERNEL);
 memset(ee_bank_list, 0, sizeof(struct ee_bank)*NUM_BANKS);
 /* Register and create the /dev interfaces to access the EEPROM
 banks. Refer back to Chapter 5, "Character Drivers" for
 more details */
 if (alloc_chrdev_region(&dev_number, 0,
 NUM_BANKS, "eep") < 0) {
 printk(KERN_DEBUG "Can't register device\n");
 return -1;
 }
 eep_class = class_create(THIS_MODULE, DEVICE_NAME);
 for (i=0; i < NUM_BANKS;i++) {
 /* Connect the file operations with cdev */
 cdev_init(&ee_bank[i].cdev, &eep_fops);
 /* Connect the major/minor number to the cdev */
 if (cdev_add(&ee_bank[i].cdev, (dev_number + i), 1)) {
 printk("Bad kmalloc\n");
 return 1;
 }
 class_device_create(eep_class, NULL, (dev_number + i),
 NULL, "eeprom%d", i);
 }
 /* Inform the I2C core about our existence. See the section
 "Probing the Device" for the definition of eep_driver */
 err = i2c_add_driver(&eep_driver);
 if (err) {
 printk("Registering I2C driver failed, errno is %d\n", err);
 return err;
 }
 printk("EEPROM Driver Initialized.\n");
 return 0;
}
```

Liệt kê 8.2 bắt đầu quá trình tạo các nút thiết bị (device nodes), nhưng để hoàn tất việc tạo lập chúng, hãy thêm dòng sau vào một tệp quy tắc (rule file) thích hợp trong thư mục */etc/udev/rules.d/*:

```bash
KERNEL:"eeprom[0-1]*", NAME="eep/%n"
```

Thao tác này sẽ tạo ra */dev/eep/0* và */dev/eep/1* để phải hồi lại việc nhận các sự kiện uevent tương ứng từ kernel. Một chương trình chế độ người dùng (user mode program) cần đọc từ ngân hàng bộ nhớ (memory bank) thứ $n$ sau đó có thể thao tác trực tiếp trên */dev/eep/n*.

Liệt kê 8.3 triển khai phương thức `open()` cho EEPROM driver. Kernel gọi hàm `eep_open()` khi một ứng dụng mở tệp */dev/eep/X*. Hàm `eep_open()` lưu trữ cấu trúc dữ liệu riêng của thiết bị (per-device data structure) vào một vùng nhớ riêng tư (private area) để nó có thể được truy cập trực tiếp từ các phương thức còn lại của driver.

#### Liệt kê 8.3. Mở EEPROM Driver (Opening the EEPROM Driver)

```c
 int
eep_open(struct inode *inode, struct file *file)
{
 /* The EEPROM bank to be opened */
 n = MINOR(file->f_dentry->d_inode->i_rdev);
 file->private_data = (struct ee_bank *)ee_bank_list[n];
 /* Initialize the fields in ee_bank_list[n] such as
 size, slave address, and the current file pointer */
 /* ... */
}
```

## Thử dò thiết bị (Probing the Device)

I2C client driver (trình điều khiển thiết bị khách I2C), phối hợp với host controller driver (trình điều khiển bộ điều khiển máy chủ) và I2C core (nhân I2C), tự động gắn kết (attach) với một slave device (thiết bị tớ) như sau:

Trong quá trình khởi tạo, nó đăng ký một phương thức `probe()`, phương thức này được I2C core gọi khi phát hiện thấy một host controller (bộ điều khiển máy chủ) tương ứng. Trong Liệt kê 8.2, `eep_init()` đã đăng ký `eep_probe()` bằng cách gọi hàm `i2c_add_driver()`: **1.**

```c
static struct i2c_driver eep_driver =
{
 .driver = {
 .name = "EEP", /* Tên */
 },
 .id = I2C_DRIVERID_EEP, /* ID */
 .attach_adapter = eep_probe, /* Phương thức Probe */
 .detach_client = eep_detach, /* Phương thức Detach */
};
i2c_add_driver(&eep_driver); 
```

Định danh trình điều khiển (driver identifier), `I2C_DRIVERID_EEP`, phải là duy nhất đối với thiết bị và phải được định nghĩa trong tệp *include/linux/i2c-id.h*.

Khi core gọi phương thức `probe()` của trình điều khiển để báo hiệu sự hiện diện của một host adapter (bộ điều hợp máy chủ), nó sẽ lần lượt gọi `i2c_probe()` với các đối số chỉ định địa chỉ của các slave device mà trình điều khiển chịu trách nhiệm, cùng với một hàm `attach()` liên quan. **2.**

Liệt kê 8.4 hiện thực hóa `eep_probe()`, phương thức `probe()` của trình điều khiển EEPROM. `normal_i2c` chỉ định các địa chỉ ngân hàng EEPROM và được điền dữ liệu như một phần của cấu trúc `i2c_client_address_data`. Các trường bổ sung trong cấu trúc này có thể được sử dụng để yêu cầu kiểm soát địa chỉ chi tiết hơn. Bạn có thể yêu cầu I2C core bỏ qua một dải địa chỉ bằng cách sử dụng trường `ignore`. Hoặc bạn có thể sử dụng trường `probe` để chỉ định các cặp (*adapter, slave address*) nếu bạn muốn liên kết một địa chỉ slave với một host adapter cụ thể. Điều này sẽ hữu ích, ví dụ, nếu bộ xử lý (processor) của bạn hỗ trợ hai I2C host adapter và bạn có một EEPROM trên bus 1 và một cảm biến nhiệt độ trên bus 2, cả hai đều phản hồi cùng một địa chỉ slave.

- Host controller duyệt qua bus để tìm các slave device được chỉ định ở Bước 2. Để làm điều này, nó tạo ra một giao dịch bus (bus transaction) như `S SLAVE_ADDR Wr`, trong đó `S` là bit bắt đầu (start bit), `SLAVE_ADDR` là địa chỉ slave 7-bit tương ứng như được chỉ định trong bảng thông số kỹ thuật (datasheet) của thiết bị, và `Wr` là lệnh ghi (write command), như được mô tả trong phần "Giao dịch Bus" (Bus Transactions). Nếu một slave device đang hoạt động tồn tại trên bus, nó sẽ phản hồi bằng cách gửi một bit xác nhận (`[A]` - acknowledgment bit). **3.**
- Nếu host adapter phát hiện ra một slave ở Bước 3, I2C core sẽ gọi hàm `attach()` được cung cấp thông qua đối số thứ ba cho `i2c_probe()` ở Bước 2. Đối với trình điều khiển EEPROM, hàm này là `eep_attach()`, dùng để đăng ký một cấu trúc dữ liệu client cho mỗi thiết bị (per-device client data structure), như minh họa trong Liệt kê 8.5. Nếu thiết bị của bạn yêu cầu một chuỗi lập trình ban đầu (ví dụ: các thanh ghi trên một chip truyền dẫn I2C Digital Visual Interface phải được khởi tạo trước khi chip có thể bắt đầu hoạt động), hãy thực hiện các thao tác đó trong hàm này. **4.**

### Listing 8.4. Kiểm tra sự tồn tại của các Bank EEPROM

```
## include <linux/i2c.h>
/* EEPROM có hai bank nhớ có địa chỉ lần lượt là SLAVE_ADDR1
 * và SLAVE_ADDR2
 */
static unsigned short normal_i2c[] = {
 SLAVE_ADDR1, SLAVE_ADDR2, I2C_CLIENT_END
};
static struct i2c_client_address_data addr_data = {
 .normal_i2c = normal_i2c,
 .probe = ignore,
 .ignore = ignore,
 .forces = ignore,
};
static int
eep_probe(struct i2c_adapter *adapter)
{
 /* Hàm callback eep_attach() được minh họa
 * trong Listing 8.5
 */
 return i2c_probe(adapter, &addr_data, eep_attach);
}
```

**Listing 8.5. Gắn kết một Client (Attaching a Client)**

```
int
eep_attach(struct i2c_adapter *adapter, int address, int kind)
{
 static struct i2c_client *eep_client;
 eep_client = kmalloc(sizeof(*eep_client), GFP_KERNEL);
 eep_client->driver = &eep_driver; /* Đã đăng ký trong Listing 8.2 */
 eep_client->addr = address; /* Địa chỉ được phát hiện */
 eep_client->adapter = adapter; /* Host Adapter */
 eep_client->flags = 0;
 strlcpy(eep_client->name, "eep", I2C_NAME_SIZE);
 /* Điền thông tin vào các trường trong cấu trúc dữ liệu trên mỗi thiết bị (per-device) */
 /* ... */
 /* Gắn kết */
 i2c_attach_client(new_client);
}
```

## Kiểm tra năng lực của Adapter (Checking Adapter Capabilities)

Mỗi host adapter có thể bị giới hạn bởi một tập hợp cácàng buộc. Một adapter có thể không hỗ trợ tất cả các lệnh có trong Bảng 8.1. Ví dụ, nó có thể cho phép lệnh đọc từ SMBus `read_word` nhưng lại không cho phép lệnh `read_block`. Driver client (client driver) phải kiểm tra xem một lệnh có được adapter hỗ trợ hay không trước khi sử dụng nó.

I2C core cung cấp hai hàm để thực hiện việc này:

- **1.** `i2c_check_functionality()` kiểm tra xem một chức năng cụ thể có được hỗ trợ hay không.
- **2.** `i2c_get_functionality()` trả về một mặt nạ (mask) chứa tất cả các chức năng được hỗ trợ.

Hãy tham khảo *include/linux/i2c.h* để biết danh sách các chức năng có thể có.

## Truy cập thiết bị (Accessing the Device)

Để đọc dữ liệu từ EEPROM, trước tiên hãy thu thập thông tin về luồng gọi (invocation thread) của nó từ trường dữ liệu riêng (private data field) được liên kết với nút thiết bị (device node). Tiếp theo, sử dụng các hàm truy cập dữ liệu tương thích với SMBus do I2C core cung cấp (Bảng 8.1 cho thấy các hàm khả dụng) để đọc dữ liệu. Cuối cùng, gửi dữ liệu đến không gian người dùng (user space) và tăng con trỏ file nội bộ (internal file pointer) để thao tác `read()`/`write()` tiếp theo bắt đầu từ vị trí mà thao tác trước đó kết thúc. Các bước này được thực hiện trong Listing 8.6. Listing này lược bỏ các bước kiểm tra tính hợp lệ (sanity check) và kiểm tra lỗi để cho gọn gàng.

#### Listing 8.6. Đọc từ EEPROM

```
ssize_t
eep_read(struct file *file, char *buf,
 size_t count, loff_t *ppos)
{
 int i, transferred, ret, my_buf[BANK_SIZE];
 /* Lấy cấu trúc dữ liệu client riêng cho bank này */
 struct ee_bank *my_bank =
 (struct ee_bank *)file->private_data;
 /* Kiểm tra xem chức năng smbus_read_word() có được hỗ trợ hay không */
 if (i2c_check_functionality(my_bank->client,
 I2C_FUNC_SMBUS_READ_WORD_DATA)) {
 /* Đọc dữ liệu */
 while (transferred < count) {
 ret = i2c_smbus_read_word_data(my_bank->client,
 my_bank->current_pointer+i);
 my_buf[i++] = (u8)(ret & 0xFF);
 my_buf[i++] = (u8)(ret >> 8);
 transferred += 2;
 }
 /* Sao chép dữ liệu sang user space và tăng con trỏ file nội bộ.
 Các bước kiểm tra tính hợp lệ được lược bỏ để đơn giản hóa */
 copy_to_user(buffer, (void *)my_buf, transferred);
 my_bank->current_pointer += transferred;
 }
 return transferred;
}
```

Việc ghi vào thiết bị cũng được thực hiện tương tự, ngoại trừ việc thay bằng hàm `i2c_smbus_write_XXX()`.

Một số chip EEPROM có bộ phát Nhận dạng Tần số Radio (Radio Frequency Identification - RFID) để truyền dữ liệu được lưu trữ một cách không dây. Điều này được sử dụng để tự động hóa các quy trình chuỗi cung ứng như giám sát hàng tồn kho và theo dõi tài sản. Các EEPROM như vậy thường thực hiện các biện pháp bảo vệ thông qua một bank bảo vệ truy cập (access protection bank) để kiểm soát quyền truy cập vào các bank dữ liệu. Trong những trường hợp như vậy, driver phải bật/tắt (wiggle) các bit tương ứng trong bank bảo vệ truy cập trước khi nó có thể thao tác trên các bank dữ liệu.

Để truy cập các bank EEPROM từ user space, hãy phát triển các ứng dụng hoạt động trên */dev/eep/n*. Để kết xuất (dump) nội dung của các bank EEPROM, hãy sử dụng `od`:

```
bash> od –a /dev/eep/0
0000000 S E R # dc4 ff soh R P nul nul nul nul nul nul nul
0000020 @ 1 3 R 1 1 5 3 Z J 1 V 1 L 4 6
0000040 5 1 0 H sp 1 S 2 8 8 8 7 J U 9 9
```

```
0000060 H 0 0 6 6 nul nul nul bs 3 8 L 5 0 0 3
0000100 Z J 1 N U B 4 6 8 6 V 7 nul nul nul nul
0000120 nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul nul
*
0000400
```

Như một bài tập thực hành, hãy thử sức sửa đổi driver EEPROM để tạo các giao diện */sys* cho các bank EEPROM thay vì các giao diện */dev*. Bạn có thể tái sử dụng mã nguồn từ Listing 5.7, "Sử dụng Sysfs để Điều khiển Bảng LED Song song" (Using Sysfs to Control the Parallel LED Board), trong Chương 5 để hỗ trợ bạn trong nỗ lực này.

## Các Phương Thức Khác

Để có được một trình điều khiển (driver) hoàn chỉnh tính năng, bạn cần bổ sung một số điểm vào (entry point) còn lại. Những điểm vào này hầu như không khác biệt so với các trình điều khiển thiết bị ký (character driver) thông thường đã được thảo luận trong Chương 5, do đó các đoạn mã nguồn sẽ không được hiển thị:

- Để hỗ trợ System Call `lseek()` gán một giá trị mới cho con trỏ tập tin nội bộ (internal file pointer), hãy hiện thực hóa phương thức driver `llseek()`. Con trỏ tập tin nội bộ lưu trữ thông tin trạng thái về quyền truy cập EEPROM.
- Để xác thực tính toàn vẹn của dữ liệu, driver EEPROM có thể hỗ trợ phương thức `ioctl()` nhằm điều chỉnh và kiểm tra mã tổng kiểm (checksum) của dữ liệu được lưu trữ.
- Các phương thức `poll()` và `fsync()` không liên quan đối với EEPROM.
- Nếu bạn chọn biên dịch driver dưới dạng một module, bạn phải cung cấp phương thức `exit()` để hủy đăng ký thiết bị (unregister) và dọn dẹp các cấu trúc dữ liệu dành riêng cho client. Việc hủy đăng ký driver khỏi I2C Core chỉ cần một dòng lệnh duy nhất:

```
i2c_del_driver(&eep_driver);
```

## Ví Dụ Về Thiết Bị: Đồng Hồ Thời Gian Thực (Real Time Clock)

Bây giờ chúng ta hãy lấy ví dụ về một chip RTC được kết nối với bộ điều khiển nhúng (embedded controller) thông qua bus I2C. Sơ đồ kết nối được thể hiện trong Hình 8.3.

```
+-------------------+         I²C Bus (SDA/SCL)          +---------+
| Embedded          | <================================> |   RTC   |
| Controller        |                                    +---------+
+-------------------+                                         |
                                                              | Battery Backup
                                                              |
                                                             ===
                                                             GND

                             [RTC cũng có một chân đầu ra CLK ở phía dưới được dán nhãn "CLK"]
```

**Hình 8.3. Một I2C RTC trên hệ thống nhúng.**

Giả sử rằng địa chỉ slave I2C của RTC là `0x60` và vùng nhớ thanh ghi (register space) của nó được tổ chức như thể hiện trong Bảng 8.2.

**Bảng 8.2. Bố cục thanh ghi trên I2C RTC**

| Tên thanh ghi   | Mô tả                       | Offset |  |
|-----------------|-----------------------------|--------|--|
| RTC_HOUR_REG    | Bộ đếm giờ                  | 0x0    |  |
| RTC_MINUTE_REG  | Bộ đếm phút                 | 0x1    |  |
| RTC_SECOND_REG  | Bộ đếm giây                 | 0x2    |  |
| RTC_STATUS_REG  | Cờ và trạng thái ngắt       | 0x3    |  |
| RTC_CONTROL_REG | Bật/tắt RTC                 | 0x4    |  |

Hãy xây dựng driver cho chip này dựa trên driver EEPROM đã thảo luận trước đó. Chúng ta sẽ coi kiến trúc I2C client driver, việc đăng ký slave, và các hàm I2C Core là mặc định, và chỉ hiện thực hóa đoạn mã giao tiếp với RTC.

Khi I2C Core phát hiện một thiết bị có địa chỉ slave của RTC (`0x60`) trên bus I2C, nó sẽ gọi hàm `myrtc_attach()`. Chuỗi lệnh gọi tương tự như đối với `eep_attach()` trong Đoạn mã 8.5. Giả sử bạn phải thực hiện các bước khởi tạo chip sau trong `myrtc_attach()`:

**1.** Xóa thanh ghi trạng thái RTC (`RTC_STATUS_REG`).

Khởi động RTC (nếu nó chưa chạy) bằng cách bật các bit thích hợp trong thanh ghi điều khiển RTC (`RTC_CONTROL_REG`). **2.**

Để làm điều này, hãy xây dựng một `i2c_msg` và tạo ra các giao dịch I2C (I2C transaction) trên bus bằng cách sử dụng `i2c_transfer()`. Cơ chế truyền dữ liệu này là độc quyền của I2C và không tương thích với SMBus. Để ghi vào hai thanh ghi RTC được đề cập trước đó, bạn phải xây dựng hai thông điệp `i2c_msg`. Thông điệp đầu tiên thiết lập offset của thanh ghi. Trong trường hợp của chúng ta, nó là `3`, là offset của `RTC_STATUS_REG`. Thông điệp thứ hai mang số lượng byte mong muốn đến offset được chỉ định. Trong ngữ cảnh này, nó truyền 2 byte, mỗi byte lần lượt cho `RTC_STATUS_REG` và `RTC_CONTROL_REG`.

```
```

```
## include <linux/i2c.h> /* Cho struct i2c_msg */
int
myrtc_attach(struct i2c_adapter *adapter, int addr, int kind)
{
 u8 buf[2];
 int offset = RTC_STATUS_REG; /* Thanh ghi trạng thái nằm ở đây */
 struct i2c_msg rtc_msg[2];
 /* Ghi 1 byte thông tin offset vào RTC */
 rtc_msg[0].addr = addr; /* Địa chỉ slave. Trong trường hợp của chúng ta,
 đây là 0x60 */
 rtc_msg[0].flags = I2C_M_WR; /* Lệnh Ghi (Write Command) */
 rtc_msg[0].buf = &offset; /* Offset thanh ghi cho
 giao dịch tiếp theo */
 rtc_msg[0].len = 1; /* Offset dài 1 byte */
 /* Ghi 2 byte dữ liệu (nội dung của thanh ghi trạng thái và
 điều khiển) tại offset được lập trình bởi i2c_msg trước đó */
 rtc_msg[1].addr = addr; /* Địa chỉ slave */
 rtc_msg[1].flags = I2C_M_WR; /* Lệnh ghi */
 rtc_msg[1].buf = &buf[0]; /* Dữ liệu được ghi vào thanh ghi điều khiển
 và trạng thái */
 rtc_msg[1].len = 2; /* Hai giá trị thanh ghi */
 buf[0] = 0; /* Đặt thanh ghi trạng thái về 0 */
 buf[1] |= ENABLE_RTC; /* Bật các bit thanh ghi điều khiển
 để khởi động RTC */
 /* Tạo các giao dịch bus tương ứng với hai thông điệp */
 i2c_transfer(adapter, rtc_msg, 2);
 /* ... */
 printk("My RTC Initialized\n");
}
```

Bây giờ RTC đã được khởi động và đang chạy, bạn có thể thu thập thời gian hiện tại bằng cách đọc nội dung của `RTC_HOUR_REG`, `RTC_MINUTE_REG`, và `RTC_SECOND_REG`. Quá trình này được thực hiện như sau:

```c
## include <linux/rtc.h> /* For struct rtc_time */
int
```

```c
myrtc_gettime(struct i2c_client *client, struct rtc_time *r_t)
{
 u8 buf[3]; /* Space to carry hour/minute/second */
 int offset = 0; /* Time-keeping registers start at offset 0 */
 struct i2c_msg rtc_msg[2];
 /* Write 1 byte of offset information to the RTC */
 rtc_msg[0].addr = addr; /* Slave address */
 rtc_msg[0].flags = 0; /* Write Command */
 rtc_msg[0].buf = &offset; /* Register offset for
 the next transaction */
 rtc_msg[0].len = 1; /* Offset is 1 byte long */
 /* Read current time by getting 3 bytes of data from offset 0
 (i.e., from RTC_HOUR_REG, RTC_MINUTE_REG, and RTC_SECOND_REG) */
 rtc_msg[1].addr = addr; /* Slave address */
 rtc_msg[1].flags = I2C_M_RD; /* Read command */
 rtc_msg[1].buf = &buf[0]; /* Data to be read from hour, minute
 and second registers */
 rtc_msg[1].len = 3; /* Three registers to read */
 /* Generate bus transactions corresponding to the above
 two messages */
 i2c_transfer(adapter, rtc_msg, 2);
 /* Read the time */
 r_t->tm_hour = BCD2BIN(buf[0]); /* Hour */
 r_t->tm_min = BCD2BIN(buf[1]); /* Minute */
 r_t->tm_sec = BCD2BIN(buf[2]); /* Second */
 return(0);
}
```

Hàm `myrtc_gettime()` hiện thực hóa tầng dưới (bottom layer) đặc thù của bus đối với RTC driver (trình điều khiển RTC). Tầng trên (top layer) của RTC driver nên tuân thủ RTC API của kernel, như đã thảo luận trong phần "RTC Subsystem" ở Chương 5. Ưu điểm của mô hình này là các ứng dụng có thể chạy mà không cần thay đổi, bất kể RTC của bạn nằm bên trong South Bridge của PC hay được kết nối ngoại vi với một bộ điều khiển nhúng (embedded controller) giống như trong ví dụ này.

RTC thường lưu trữ thời gian ở dạng *Binary Coded Decimal* (BCD), trong đó mỗi nibble đại diện cho một số từ 0 đến 9 (thay vì từ 0 đến 15). Kernel cung cấp một macro gọi là `BCD2BIN()` để chuyển đổi từ mã hóa BCD sang hệ thập phân và `BIN2BCD()` để thực hiện thao tác ngược lại. `myrtc_gettime()` sử dụng macro đầu tiên trong khi đọc thời gian từ các thanh ghi RTC.

Hãy tham khảo *drivers/rtc/rtc-ds1307.c* để xem ví dụ về một RTC driver xử lý dòng chip I2C RTC DS13XX của Dallas/Maxim.

Là một bus 2 dây (2-wire bus), bus I2C không có đường yêu cầu ngắt (interrupt request line) mà các thiết bị tớ (slave devices) có thể kích hoạt, nhưng một số bộ điều khiển chính (host adapters) I<sup>2</sup>C có khả năng ngắt bộ vi xử lý để báo hiệu việc hoàn tất các yêu cầu truyền dữ liệu. Tuy nhiên, hoạt động điều khiển bằng ngắt (interrupt-driven) này hoàn toàn trong suốt (transparent) đối với các I2C client driver và được ẩn bên trong các hàm dịch vụ do I2C core cung cấp. Giả sử rằng bộ điều khiển chính I2C (I2C host controller) nằm trong SoC nhúng ở Hình 8.3 có khả năng ngắt bộ xử lý, việc gọi `i2c_transfer()` trong `myrtc_attach()` có thể đang thực hiện cácσ công việc sau dưới gầm máy (under the hood):

- Xây dựng một giao dịch (transaction) tương ứng với `rtc_msg[0]` và ghi nó lên bus sử dụng các dịch vụ của trình điều khiển thiết bị bộ điều khiển chính (host controller device driver).
- Chờ cho đến khi bộ điều khiển chính khẳng định (assert) một ngắt hoàn thành truyền dữ liệu (transmit complete interrupt) báo hiệu rằng `rtc_msg[0]` hiện đang nằm trên đường truyền (wire).
- Bên trong trình xử lý ngắt (interrupt handler), kiểm tra thanh ghi trạng thái của bộ điều khiển chính I2C để xem đã nhận được tín hiệu xác nhận (acknowledgment) từ thiết bị tớ RTC hay chưa.
- Trả về lỗi nếu các thanh ghi trạng thái và điều khiển của bộ điều khiển chính cho thấy mọi thứ không suôn sẻ.
- Lặp lại quy trình tương tự cho `rtc_msg[1]`.

## I2C-dev

Đôi khi, khi bạn cần bật hỗ trợ cho một số lượng lớn các thiết bị I2C tốc độ chậm, việc điều khiển chúng hoàn toàn từ user space là điều hợp lý. Tầng I2C hỗ trợ một driver có tên là `i2c-dev` để đạt được điều này. Hãy chuyển đến phần "User Mode I2C" ở Chương 19 để xem ví dụ hiện thực hóa một I2C driver ở chế độ người dùng (user mode I2C driver) sử dụng `i2c-dev`.

## Giám sát phần cứng sử dụng LM-Sensors

Dự án *LM-Sensors*, được lưu trữ tại www.lm-sensors.org, mang lại các tính năng giám sát phần cứng cho Linux. Một số hệ thống máy tính sử dụng các chip cảm biến để theo dõi các tham số như nhiệt độ, điện áp nguồn và tốc độ quạt. Việc định kỳ theo dõi các tham số này có thể mang tính sống còn. Một quạt CPU bị hỏng có thể biểu hiện dưới dạng các sự cố phần mềm lạ và ngẫu nhiên. Hãy tưởng tượng hậu quả nếu hệ thống đó là một thiết bị y tế chuyên dụng (medical grade device)!

LM-Sensors đến giải cứu với các trình điều khiển thiết bị cho nhiều chip cảm biến, một tiện ích gọi là *sensors* để tạo báo cáo về tình trạng sức khỏe (health report), và một tập lệnh gọi là *sensors-detect* giúp quét hệ thống của bạn và giúp bạn tạo các tệp cấu hình phù hợp.

Hầu hết các chip cung cấp giao diện giám sát phần cứng với CPU thông qua I2C/SMBus. Trình điều khiển thiết bị cho các thiết bị như vậy là các I2C client driver thông thường nhưng nằm trong thư mục *drivers/hwmon/*, thay vì *drivers/i2c/chips/*. Một ví dụ là chip LM87 của National Semiconductor, có thể giám sát nhiều điện áp, nhiệt độ và quạt. Hãy xem *drivers/hwmon/lm87.c* để biết cách hiện thực driver của nó. Các ID của I2C driver từ 1000 đến 1999 được dành riêng cho các chip cảm biến (xem *include/linux/i2c-id.h*).

Một số chip cảm biến giao tiếp với CPU thông qua bus ISA/LPC thay vì I2C/SMBus. Các chip khác phát ra ngõ ra analog đến CPU thông qua *Analog-to-Digital Converter* (ADC). Trình điều khiển cho các chip như vậy chia sẻ thư mục *drivers/hwmon/* chung với các trình điều khiển cảm biến I2C. Một ví dụ về trình điều khiển cảm biến không phải I2C là *drivers/hwmon/hdaps.c*, trình điều khiển cho cảm biến gia tốc (accelerometer) có trong một số máy tính xách tay IBM/Lenovo mà chúng ta đã thảo luận ở Chương 7, "Input Drivers." Một ví dụ khác về cảm biến không phải I2C là chip Winbond 83627HF Super I/O, được điều khiển bởi *drivers/hwmon/w83627hf.c*.

```

## Bus Serial Peripheral Interface

Bus *Serial Peripheral Interface* (SPI) là một giao diện serial master-slave tương tự như I <sup>2</sup>C và được tích hợp sẵn trên nhiều vi điều khiển (microcontroller). Nó sử dụng bốn đường tín hiệu (so với hai đường trên I <sup>2</sup>C): *Serial CLocK* (SCLK), *Chip Select* (CS), *Master Out Slave In* (MOSI), và *Master In Slave Out* (MISO). MOSI được sử dụng để dịch chuyển dữ liệu (shift data) vào thiết bị slave, và MISO được sử dụng để dịch chuyển dữ liệu ra khỏi thiết bị slave. Do bus SPI có các đường truyền riêng biệt để truyền và nhận dữ liệu, nó có thể hoạt động ở chế độ song công hoàn toàn (full-duplex mode), không giống như bus I2C. Tốc độ hoạt động điển hình của SPI nằm trong dải vài megahertz, không giống như dải vài kilohertz trên I2C, vì vậy SPI mang lại thông lượng (throughput) cao hơn.

Các thiết bị ngoại vi SPI có sẵn trên thị trường hiện nay bao gồm các chip *Radio Frequency* (RF), giao diện thẻ thông minh, EEPROM, RTC, cảm biến cảm ứng và ADC.

Kernel cung cấp một core API để trao đổi các thông điệp qua bus SPI. Một SPI client driver điển hình thực hiện các bước sau:

Đăng ký các phương thức probe() và remove() với SPI core. Tùy chọn đăng ký các phương thức suspend() và resume(): **1.**

```

## include <linux/spi/spi.h>

static struct spi_driver myspi_driver = {
.driver = {
.name = "myspi",
.bus = &spi_bus_type,
.owner = THIS_MODULE,
},
.probe = myspidevice_probe,
.remove = __devexit_p(myspidevice_remove),
}
spi_register_driver(&myspi_driver);

```

SPI core tạo ra một cấu trúc `spi_device` tương ứng với thiết bị này và truyền nó như một đối số khi gọi các phương thức driver đã đăng ký.

Trao đổi các thông điệp với thiết bị SPI bằng cách sử dụng các hàm truy cập như `spi_sync()` và `spi_async()`. Hàm trước chờ cho thao tác hoàn tất, trong khi hàm sau kích hoạt bất đồng bộ (asynchronously) việc gọi một callback routine đã đăng ký khi việc truyền thông điệp hoàn tất. Các routine truy cập dữ liệu này được gọi từ các vị trí thích hợp như SPI interrupt handler, sysfs method, hoặc timer handler. Đoạn mã sau minh họa việc gửi thông điệp SPI: **2.**

```

## include <linux/spi/spi.h>

struct spi_device *spi; /* Biểu diễn của một
thiết bị SPI */
struct spi_transfer xfer; /* Chứa chi tiết về bộ đệm truyền
(transfer buffer) */
struct spi_message sm; /* Chuỗi các phân đoạn spi_transfer
*/
u8 *command_buffer; /* Dữ liệu cần truyền */

```

```

int len; /* Độ dài dữ liệu cần
truyền */
spi_message_init(&sm); /* Khởi tạo spi_message */
xfer.tx_buf = command_buffer; /* Dữ liệu đặc thù của thiết bị */
xfer.len = len; /* Độ dài dữ liệu */
spi_message_add_tail(&xfer, &sm); /* Thêm thông điệp */
spi_sync(spi, &sm); /* Yêu cầu truyền đồng bộ (blocking) */

```

Đối với một thiết bị SPI mẫu, hãy xem xét bộ điều khiển màn hình cảm ứng ADS7846 mà chúng ta đã thảo luận ngắn gọn ở Chương 7. Driver này thực hiện các công việc sau:

- Đăng ký các phương thức probe(), remove(), suspend(), và resume() với SPI core bằng cách sử dụng `spi_register_driver()`. **1.**
- Phương thức probe() đăng ký driver với input subsystem bằng cách sử dụng `input_register_device()` và yêu cầu một IRQ bằng cách sử dụng `request_irq()`. **2.**
- Driver thu thập tọa độ cảm ứng từ interrupt handler của nó bằng cách sử dụng `spi_async()`. Hàm này kích hoạt việc gọi một callback routine đã đăng ký khi việc truyền thông điệp SPI hoàn tất. **3.**
- Ngược lại, hàm callback sẽ báo cáo tọa độ cảm ứng và các thao tác click thông qua input event interface, */dev/input/eventX*, bằng cách sử dụng `input_report_abs()` và `input_report_key()`, như đã thảo luận ở Chương 7. Các ứng dụng như X Windows và gpm hoạt động mượt mà với event interface và phản hồi lại dữ liệu đầu vào từ cảm ứng. **4.**

Một driver thực hiện việc "vẫy" các chân I/O (wiggles I/O pins) để chúng giao tiếp theo một giao thức được gọi là driver *bit-banging*. Để xem một ví dụ về driver SPI bit-banging, hãy nhìn vào *drivers/spi/spi_butterfly.c*, đây là một driver dùng để giao tiếp với các chip DataFlash có mặt trên các bo mạch *Butterfly* do Atmel xây dựng xung quanh dòng bộ vi xử lý AVR của họ. Đối với việc này, hãy kết nối cổng song song (parallel port) của hệ thống host với AVR Butterfly bằng một cáp chuyển đổi (dongle) được chế tạo đặc biệt và sử dụng driver *spi_butterfly* để thực hiện bit banging. Hãy xem *Documentation/spi/butterfly* để có mô tả chi tiết về driver này.

Hiện tại không có sự hỗ trợ nào cho các user space SPI driver theo phong cách i2c-dev. Bạn chỉ có lựa chọn viết một kernel driver để giao tiếp với thiết bị SPI của mình.

Trong thế giới nhúng (embedded world), bạn có thể bắt gặp các giải pháp trong đó bộ vi xử lý sử dụng một chip đi kèm (companion chip) tích hợp nhiều chức năng khác nhau. Một ví dụ là Freescale MC13783 Power Management and Audio Component (PMAC) được sử dụng song song với bộ điều khiển i.MX27 dựa trên kiến trúc ARM9. PMAC tích hợp RTC, bộ sạc pin, giao diện màn hình cảm ứng, module ADC và một audio codec. Vi xử lý và PMAC giao tiếp thông qua SPI. Bus SPI không chứa đường ngắt (interrupt line), vì vậy PMAC có khả năng ngắt bộ vi xử lý từ bên ngoài bằng cách sử dụng một chân GPIO được cấu hình cho mục đích này.

## Bus 1-Wire

*Giao thức 1-wire* (1-wire protocol) do Dallas/Maxim phát triển sử dụng bus 1-wire (hoặc *w1*) truyền cả nguồn điện lẫn tín hiệu; đường dẫn nối đất (ground) trả về được cung cấp bằng các phương pháp khác. Nó cung cấp một cách đơn giản để giao tiếp với các thiết bị tốc độ chậm bằng cách giảm thiểu không gian, chi phí và độ phức tạp. Một thiết bị ví dụ hoạt động bằng giao thức này là *ibutton* (www.ibutton.com), được sử dụng để đo nhiệt độ, mang dữ liệu hoặc chứa các định danh duy nhất (unique ID).

Một chip w1 khác giao tiếp thông qua một chân cổng đơn của bộ điều khiển nhúng (embedded controller) là DS2433 4kb 1-wire EEPROM từ Dallas/Maxim. Trình điều khiển (driver) cho chip này, *drivers/w1/slaves/w1\_ds2433.c*, xuất quyền truy cập vào EEPROM thông qua một node sysfs.

Các cấu trúc dữ liệu chính liên quan đến một driver thiết bị w1 là w1\_family và w1\_family\_ops, cả hai đều được định nghĩa trong *w1\_family.h*.

## Gỡ lỗi (Debugging)

Để thu thập các thông báo gỡ lỗi dành riêng cho I2C (I2C-specific debugging messages), hãy bật một tổ hợp thích hợp gồm *I2C Core debugging messages*, *I2C Algorithm debugging messages*, *I2C Bus debugging messages* và *I2C Chip debugging messages* trong mục *Device Drivers I2C Support* của menu cấu hình kernel (kernel configuration menu). Tương tự, đối với việc gỡ lỗi SPI, hãy bật *Debug Support for SPI drivers* trong mục *Device Drivers SPI Support*.

Để hiểu luồng các gói tin I2C trên bus, hãy kết nối một thiết bị phân tích bus I2C (I2C bus analyzer) với bo mạch của bạn giống như cách chúng tôi đã làm khi chạy Listing 8.1. Gói phần mềm lm-sensors chứa một công cụ gọi là i2cdump để kết xuất (dump) nội dung thanh ghi của các thiết bị trên bus I2C.

Có một danh sách gửi thư (mailing list) dành riêng cho Linux I2C tại <http://lists.lm-sensors.org/mailman/listinfo/i2c>.

## Xem xét mã nguồn (Sources)

Trong cây mã nguồn kernel 2.4, một thư mục duy nhất (*drivers/i2c/*) chứa tất cả mã nguồn liên quan đến I2C/SMBus. Mã nguồn I <sup>2</sup>C trong các kernel 2.6 được tổ chức theo phân cấp: Thư mục *drivers/i2c/busses/* chứa các driver bộ điều khiển (adapter drivers), thư mục *drivers/i2c/algos/* chứa các driver thuật toán (algorithm drivers), và thư mục *drivers/i2c/chips/* chứa các driver client. Bạn cũng có thể tìm thấy các driver client ở các vùng khác của cây mã nguồn. Ví dụ, thư mục *drivers/sound/* bao gồm các driver cho các chipset âm thanh sử dụng giao diện điều khiển I2C. Hãy xem bên trong thư mục *Documentation/i2c/* để biết các mẹo và nhiều ví dụ hơn.

Các hàm dịch vụ SPI của kernel nằm ở *drivers/spi/spi.c.* Driver SPI cho bộ điều khiển cảm ứng ADS7846 được triển khai trong *drivers/input/touchscreen/ads7846.c.* Hệ thống con MTD (MTD subsystem) được thảo luận trong Chương 17, "Memory Technology Devices", thực hiện việc triển khai các driver cho chip flash SPI. Một ví dụ là *drivers/mtd/devices/mtd\_dataflash.c*, driver để truy cập các chip Atmel DataFlash SPI.

Thư mục *drivers/w1/* chứa hỗ trợ của kernel cho giao thức w1. Các driver cho phía host controller của giao diện w1 nằm ở *drivers/w1/masters/*, và các driver cho thiết bị tớ (slave) w1 nằm ở *drivers/w1/slaves/*.

Bảng 8.3 tóm tắt các cấu trúc dữ liệu chính được sử dụng trong chương này và vị trí của chúng trong cây kernel. Bảng 8.4 liệt kê các giao diện lập trình kernel chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

**Bảng 8.3. Tóm tắt các Cấu trúc Dữ liệu**

| Cấu trúc dữ liệu          | Vị trí                  | Mô tả                                                                                  |
|-------------------------|-------------------------|----------------------------------------------------------------------------------------|
| i2c_driver              | include/linux/i2c.h     | Biểu diễn của một I2C driver                                                           |
| i2c_client_address_data | include/linux/i2c.h     | Các địa chỉ slave mà một I2C<br>client driver phụ trách                                |
| i2c_client              | include/linux/i2c.h     | Định danh một chip được kết nối với một<br>bus I2C                                       |
| i2c_msg                 | include/linux/i2c.h     | Thông tin liên quan đến một<br>giao dịch (transaction) mà bạn muốn<br>tạo ra trên bus I2C |
| spi_driver              | include/linux/spi/spi.h | Biểu diễn của một SPI driver                                                           |
| spi_device              | include/linux/spi/spi.h | Biểu diễn của một thiết bị SPI                                                         |
| spi_transfer            | include/linux/spi/spi.h | Chi tiết về một bộ đệm truyền SPI (SPI transfer buffer)                                |
| spi_message             | include/linux/spi/spi.h | Chuỗi các phân đoạn spi_transfer<br>(spi_transfer segments)                            |
| w1_family               |                         | drivers/w1/w1_family.h Biểu diễn của một driver thiết bị tớ<br>w1                      |
| w1_family_ops           |                         | drivers/w1/w1_family.h Các điểm vào (entry points) của một driver thiết bị tớ w1        |

**Bảng 8.4. Tóm tắt các Giao diện Lập trình Kernel (Kernel Programming Interfaces)**

| Giao diện Kernel (Kernel Interface)                | Vị trí (Location)                             | Mô tả (Description)                                                                                                                                                                                      |
|----------------------------------------------------|-----------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| i2c_add_driver()                                   | include/linux/l2c.h<br>drivers/l2c/l2c-core.c | Đăng ký các điểm vào của trình điều khiển (driver entry points) với lõi (core) I <sup>2</sup> C.                                                                                           |
| 2c_del_driver()                                    | drivers/l2c/l2c-core.c                        | Hủy đăng ký hoặc xóa một driver khỏi lõi I <sup>2</sup> C.                                                                                                                                              |
| 2c_probe()                                         | drivers/i2c/i2c-core.c                        | Chỉ định các địa chỉ của thiết bị tớ (slave device) mà driver chịu trách nhiệm và một hàm `attach()` liên quan sẽ được gọi nếu một trong các địa chỉ được chỉ định bị phát hiện bởi lõi I <sup>2</sup> C. |
| c_attach_client()                                  | drivers/i2c/i2c-core.c                        | Thêm một client mới vào danh sách các client được phục vụ bởi host adapter I <sup>2</sup> C tương ứng.                                                                                                   |
| c_detach_client()                                  | drivers/i2c/i2c-core.c                        | Ngắt kết nối một client đang hoạt động. Thường được thực hiện khi client driver hoặc host adapter tương ứng hủy đăng ký.                                                                                 |
| c_check_functionality()                            | include/linux/i2c.h                           | Xác minh xem một chức năng cụ thể có được hỗ trợ bởi host adapter hay không.                                                                                                                             |
| c_get_functionality()                              | include/linux/i2c.h                           | Lấy một mặt nạ (mask) chứa tất cả các chức năng được hỗ trợ bởi host adapter.                                                                                                                             |
| c_add_adapter()                                    | drivers/i2c/i2c-core.c                        | Đăng ký một host adapter.                                                                                                                                                                                |
| _del_adapter()                                     | drivers/i2c/i2c-core.c                        | Hủy đăng ký một host adapter.                                                                                                                                                                            |
| us-compatible I <sup>2</sup> C data<br>ss routines | drivers/i2c/i2c-core.c                        | Xem Bảng 8.1.                                                                                                                                                                                            |
| _transfer()                                        | drivers/i2c/i2c-core.c                        | Gửi một `i2c_msg` qua bus I <sup>2</sup> C. Hàm này không tương thích với SMBus.                                                                                                                         |
| i_register_driver()                                | drivers/spi/spi.c                             | Đăng ký các điểm vào của trình điều khiển với lõi SPI.                                                                                                                                                   |
| _unregister_driver()                               | include/linux/spi/spi.h                       | Hủy đăng ký một SPI driver.                                                                                                                                                                              |
| _message_init()                                    | include/linux/spi/spi.h                       | Khởi tạo một thông điệp (message) SPI.                                                                                                                                                                  |

| _message_add_tail()                                | include/linux/spi/spi.h                       | Thêm một SPI message vào danh sách truyền dữ liệu (transfer list).                                                                                                                                                                  |
| i_sync()                                           | drivers/spi/spi.c                             | Truyền dữ liệu đồng bộ (synchronously) qua bus SPI. Hàm này sẽ chặn (block) cho đến khi hoàn tất.                                                                                                                    |
| pi_async()                                         | include/linux/spi/spi.h                       | Truyền dữ liệu bất đồng bộ (asynchronously) qua bus SPI sử dụng cơ chế gọi lại hoàn tất (completion callback mechanism).                                                                                                                    |
|                                                    |                                               |                                                                                                                                                                                                          |
