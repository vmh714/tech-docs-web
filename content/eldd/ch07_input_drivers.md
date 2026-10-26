# Chương 7. Trình điều khiển thiết bị đầu vào (Input Drivers)

## Trong chương này

Trình điều khiển sự kiện đầu vào (Input Event Drivers)

Trình điều khiển thiết bị đầu vào (Input Device Drivers)

Gỡ lỗi (Debugging)

Tìm hiểu mã nguồn (Looking at the Sources)

Hệ thống con (subsystem) *input* của kernel được tạo ra để hợp nhất các trình điều khiển (driver) đang bị phân tán, chịu trách nhiệm xử lý các lớp thiết bị nhập dữ liệu (data-input devices) đa dạng khác nhau như bàn phím, chuột, bi lăn (trackball), tay cầm chơi game (joystick), bánh xe cuộn (roller wheel), màn hình cảm ứng (touch screen), gia tốc kế (accelerometer) và bảng vẽ điện tử (tablet). Hệ thống con input mang lại các ưu điểm sau:

- Xử lý đồng nhất các thiết bị đầu vào có chức năng tương tự nhau ngay cả khi chúng khác biệt về mặt vật lý. Ví dụ, tất cả các loại chuột như PS/2, USB hoặc Bluetooth đều được đối xử như nhau.
- Giao diện *sự kiện* (*event*) đơn giản để phân phối các báo cáo đầu vào (input report) đến các ứng dụng người dùng (user application). Driver của bạn không cần phải tự tạo và quản lý các nút */dev* cũng như các phương thức truy cập liên quan. Thay vào đó, nó có thể đơn giản gọi các API của input để gửi các chuyển động của chuột, thao tác nhấn phím, hoặc sự kiện cảm ứng hướng lên tầng người dùng (user land). Các ứng dụng như X Windows hoạt động một cách mượt mà thông qua các giao diện sự kiện do hệ thống con input xuất ra.
- Trích xuất các phần chung ra khỏi các input driver và tạo ra một lớp trừu tượng (abstraction) giúp đơn giản hóa các driver và mang lại tính nhất quán. Ví dụ, hệ thống con input cung cấp một tập hợp các driver cấp thấp gọi là *serio* cung cấp quyền truy cập vào phần cứng đầu vào như cổng nối tiếp (serial port) và bộ điều khiển bàn phím (keyboard controller).

Hình 7.1 minh họa hoạt động của hệ thống con input. Hệ thống con này chứa hai lớp driver hoạt động song song: driver *sự kiện* (*event*) và driver *thiết bị* (*device*). Event driver chịu trách nhiệm giao tiếp với các ứng dụng, trong khi device driver chịu trách nhiệm giao tiếp mức thấp với các thiết bị đầu vào. Bộ sinh sự kiện chuột, *mousedev*, là một ví dụ về loại thứ nhất và driver chuột PS/2 là một ví dụ về loại thứ hai. Cả event driver và device driver đều có thể tận dụng các dịch vụ của một lõi (core) hiệu quả, không có lỗi (bug-free) và có khả năng tái sử dụng cao, nằm ở trung tâm của hệ thống con input.

```
                          Hình 7.1 – Hệ thống con input (The input subsystem)

        +-----------+   +-----+   +-----+   +-------------------+
        | X Windows |   | Qt  |   | gpm |   | Custom Application|
        +-----------+   +-----+   +-----+   +-------------------+
                ^         ^         ^                 ^
                |         |         |                 |
                +---------+---------+-----------------+
                              |
                   +------------------------------------+
                   |  /dev/input/mice                   |
                   |  /dev/input/eventX                 |
                   |  /dev/input/js                     |
                   +------------------------------------+           
                              ^                     ^               
                              |                     |               
------------------- User Space / Kernel Space ------|------------------
                                                    |               
                       +-------------+              |        +---------+         
                       |  Input Core |--------|     |        | Console |         
                       +-------------+        |     |        +---------+         
                             |                |     |              ^
                             |                |     |              |
                             |                |     |  +--------------------------+                 
                             |                |     |  |      Virtual Terminal    |           
                             |                |     |  |      (keyboard input)    |                
                             |                |     |  +--------------------------+                
                             |                |     |              ^
                             v                V     |              |
                  +-------------------+   +-----------------------------+
                  | Input Device      |   | Input Event Drivers         |
                  | Drivers           |   | (mousedev, evdev,           |
                  +-------------------+   |  joydev, keyboard)          |
                       ^                  +-----------------------------+
                       |
                       |          
   ---------+-------------+----------------------------+-------------+----------------------+----------+----
            |             |                            |             |                      |          |                  
      +-------+        +--------+                +-----------+   +-----+                +------+   +-----+
      | Serio |        | USB Hid|                | Bluetooth |   | SPI |                |ISA/LPC|  |GPIO |
      +-------+        +--------+                |  Hidp     |   +-----+                +------+   +-----+
                                                 +-----------+
         ^                 ^                           ^             ^                      ^          ^
---------|-----------------|---------------------------|-------------|----------------------|----------|--------- Kernel Space / Hardware boundary
                      
 +----------------+   +----------------+   +----------------+   +------------+   +---------------+   +------------------+
 | PS/2 Keyboard, |   | USB Mouse and  |   | Bluetooth Mouse|   | SPI Touch  |   | Accelerometer |   | Roller Wheeler   |
 | PS/2 Mouse,    |   | Keyboard       |   | and Keyboard   |   | Controller |   +---------------+   +------------------+
 | Serial Touch   |   +----------------+   +----------------+   +------------+
 | Controller     |
 +----------------+      
```

Vì các trình điều khiển sự kiện (event driver) được chuẩn hóa và có sẵn cho mọi lớp thiết bị đầu vào (input class), bạn sẽ có nhiều khả năng phải triển khai một trình điều khiển thiết bị (device driver) hơn là một trình điều khiển sự kiện. Trình điều khiển thiết bị của bạn có thể sử dụng một trình điều khiển sự kiện hiện có phù hợp thông qua nhân lõi đầu vào (input core) để giao tiếp với các ứng dụng người dùng (user application). Lưu ý rằng chương này sử dụng thuật ngữ *trình điều khiển thiết bị* (*device driver*) để chỉ trình điều khiển thiết bị đầu vào (input device driver), trái ngược với trình điều khiển sự kiện đầu vào (input event driver).

## Trình Điều Khiển Sự Kiện Đầu Vào (Input Event Drivers)

Các giao diện sự kiện được xuất ra bởi hệ thống con đầu vào (input subsystem) đã tiến hóa thành một tiêu chuẩn mà nhiều hệ thống cửa sổ đồ họa (graphical windowing system) có thể hiểu được. Các trình điều khiển sự kiện cung cấp một lớp trừu tượng độc lập với phần cứng để giao tiếp với các thiết bị đầu vào, giống như giao diện bộ đệm khung (frame buffer interface - được thảo luận trong Chương 12, "Trình điều khiển Video") cung cấp một cơ chế chung để giao tiếp với các thiết bị hiển thị. Các trình điều khiển sự kiện, kết hợp với các trình điều khiển bộ đệm khung (frame buffer driver), giúp cách ly các *giao diện người dùng đồ họa* (*graphical user interfaces* - GUI) khỏi sự biến động của phần cứng bên dưới.

## Giao Diện Evdev

*Evdev* là một trình điều khiển sự kiện đầu vào tổng quát (generic input event driver). Mỗi gói sự kiện (event packet) do evdev tạo ra có định nghĩa cấu trúc sau, được định nghĩa trong *include/linux/input.h*:

```
struct input_event {
 struct timeval time; /* Timestamp */
 __u16 type; /* Event Type */
 __u16 code; /* Event Code */
 __s32 value; /* Event Value */
};
```

Để tìm hiểu cách sử dụng evdev, hãy cùng triển khai một trình điều khiển thiết bị đầu vào cho một con chuột ảo (virtual mouse).

#### Ví Dụ Về Thiết Bị: Chuột V ảo (Virtual Mouse)

Đây là cách con chuột ảo của chúng ta hoạt động: Một ứng dụng (*coord.c*) mô phỏng các chuyển động của chuột và truyền thông tin tọa độ đến trình điều khiển chuột ảo (*vms.c*) thông qua một nút sysfs (sysfs node), */sys/devices/platform/vms/coordinates*. Trình điều khiển chuột ảo (gọi tắt là trình điều khiển *vms*) chuyển các chuyển động này hướng lên trên thông qua evdev. Hình 7.2 minh họa các chi tiết.

**Hình 7.2. Trình điều khiển đầu vào cho một con chuột ảo.**

[Xem hình kích thước đầy đủ]

```
                         Chuột mô phỏng (Không gian người dùng - User Space)
                         -------------------------------------------------

                         +---------------------------+
                         | Trình tạo tọa độ          |
                         |        (coord.c)          |
                         +-------------+-------------+
                                       |
                                       v
                         /sys/.../vms/coordinates
                                       |
=========================== User Space / Kernel Space ===========================

                                       v
                         +---------------------------+
                         |   Trình điều khiển chuột  |
                         |            ảo             |
                         |          (vms.c)          |
                         +-------------+-------------+
                                       |
                                       |
                                       |    Input Core
                                       |    /     \
                                       v   v       v
                                      Thiết bị    evdev
                                      đầu vào ảo    |
                                                    v
                                           /dev/input/eventX
                                                    |
                                                    v
                                                   gpm
                                                    |
                                                    v
                                                 Console
```

*General-purpose mouse* (*gpm*) là một máy chủ (server) cho phép bạn sử dụng chuột ở chế độ văn bản (text mode) mà không cần sự hỗ trợ từ máy chủ X (X server). Gpm hiểu các thông điệp evdev, vì vậy trình điều khiển vms có thể giao tiếp trực tiếp với nó. Sau khi bạn đã thiết lập mọi thứ hoàn tất, bạn có thể thấy con trỏ chuột di chuyển trên màn hình theo nhịp điệu của các chuyển động chuột ảo được truyền phát bởi *coord.c*.

Liệt kê 7.1 chứa mã nguồn của *coord.c*, liên tục tạo ra các tọa độ X và Y ngẫu nhiên. Chuột, không giống như joystick hay màn hình cảm ứng (touch screen), tạo ra tọa độ tương đối (relative coordinates), và đó là những gì *coord.c* thực hiện. Trình điều khiển vms được thể hiện trong Liệt kê 7.2.

**Liệt kê 7.1. Ứng dụng mô phỏng chuyển động chuột (coord.c)**

```
## include <fcntl.h>
int
main(int argc, char *argv[])
{
 int sim_fd;
 int x, y;
 char buffer[10];
 /* Open the sysfs coordinate node */
 sim_fd = open("/sys/devices/platform/vms/coordinates", O_RDWR);
 if (sim_fd < 0) {
 perror("Couldn't open vms coordinate file\n");
 exit(-1);
 }
 while (1) {
 /* Generate random relative coordinates */
 x = random()%20;
 y = random()%20;
 if (x%2) x = -x; if (y%2) y = -y;
 /* Convey simulated coordinates to the virtual mouse driver */
 sprintf(buffer, "%d %d %d", x, y, 0);
 write(sim_fd, buffer, strlen(buffer));
 fsync(sim_fd);
 sleep(1);
 }
 close(sim_fd);
}
```

#### Liệt kê 7.2. Trình điều khiển đầu vào cho chuột ảo (vms.c)

```
## include <linux/fs.h>
## include <asm/uaccess.h>
## include <linux/pci.h>
## include <linux/input.h>
## include <linux/platform_device.h>
struct input_dev *vms_input_dev; /* Representation of an input device */
static struct platform_device *vms_dev; /* Device structure */
 /* Sysfs method to input simulated
 coordinates to the virtual
 mouse driver */
static ssize_t
write_vms(struct device *dev,
 struct device_attribute *attr,
 const char *buffer, size_t count)
{
 int x,y;
 sscanf(buffer, "%d%d", &x, &y);
```

```c
 /* Báo cáo tọa độ tương đối thông qua
 giao diện sự kiện (event interface) */
 input_report_rel(vms_input_dev, REL_X, x);
 input_report_rel(vms_input_dev, REL_Y, y);
 input_sync(vms_input_dev);
 return count;
}
/* Gắn phương thức ghi sysfs */
DEVICE_ATTR(coordinates, 0644, NULL, write_vms);
/* Bộ mô tả thuộc tính (Attribute Descriptor) */
static struct attribute *vms_attrs[] = {
 &dev_attr_coordinates.attr,
 NULL
};
/* Nhóm thuộc tính (Attribute group) */
static struct attribute_group vms_attr_group = {
 .attrs = vms_attrs,
};
/* Khởi tạo Driver (Driver Initialization) */
int __init
vms_init(void)
{
 /* Đăng ký một platform device */
 vms_dev = platform_device_register_simple("vms", -1, NULL, 0);
 if (IS_ERR(vms_dev)) {
 PTR_ERR(vms_dev);
 printk("vms_init: error\n");
 }
 /* Tạo một node sysfs để đọc tọa độ giả lập */
 sysfs_create_group(&vms_dev->dev.kobj, &vms_attr_group);
 /* Cấp phát cấu trúc dữ liệu input device */
 vms_input_dev = input_allocate_device();
 if (!vms_input_dev) {
 printk("Bad input_alloc_device()\n");
 }
 /* Thông báo rằng chuột ảo sẽ tạo ra
 các tọa độ tương đối */
 set_bit(EV_REL, vms_input_dev->evbit);
 set_bit(REL_X, vms_input_dev->relbit);
 set_bit(REL_Y, vms_input_dev->relbit);
 /* Đăng ký với input subsystem */
 input_register_device(vms_input_dev);
 printk("Virtual Mouse Driver Initialized.\n");
 return 0;
}
/* Thoát Driver (Driver Exit) */
void
```

```c
vms_cleanup(void)
{
 /* Hủy đăng ký khỏi input subsystem */
 input_unregister_device(vms_input_dev);
 /* Dọn dẹp node sysfs */
 sysfs_remove_group(&vms_dev->dev.kobj, &vms_attr_group);
 /* Hủy đăng ký driver */
 platform_device_unregister(vms_dev);
 return;
}
module_init(vms_init);
module_exit(vms_cleanup);
```

Hãy cùng xem xét kỹ hơn Bảng liệt kê (Listing) 7.2. Trong quá trình khởi tạo, driver vms tự đăng ký nó như một input device driver. Để làm điều này, trước tiên nó cấp phát một cấu trúc `input_dev` bằng cách sử dụng API lõi (core API), `input_allocate_device()`:

```c
vms_input_dev = input_allocate_device();
```

Sau đó, nó thông báo rằng chuột ảo tạo ra các sự kiện tương đối (relative event):

```c
set_bit(EV_REL, vms_input_dev->evbit); /* Loại sự kiện (Event Type) là EV_REL */
```

Tiếp theo, nó khai báo các mã sự kiện (event code) mà chuột ảo tạo ra:

```c
set_bit(REL_X, vms_input_dev->relbit); /* Chuyển động 'X' tương đối */
set_bit(REL_Y, vms_input_dev->relbit); /* Chuyển động 'Y' tương đối */
```

Nếu chuột ảo của bạn cũng có khả năng tạo ra thao tác nhấp nút (button click), bạn cần thêm phần này vào `vms_init()`:

```c
set_bit(EV_KEY, vms_input_dev->evbit); /* Loại sự kiện (Event Type) là EV_KEY */
set_bit(BTN_0, vms_input_dev->keybit); /* Mã sự kiện (Event Code) là BTN_0 */
```

Cuối cùng là bước đăng ký:

```c
input_register_device(vms_input_dev);
```

`write_vms()` là phương thức `store()` của sysfs được gắn vào */sys/devices/platform/vms/coordinates*. Khi chương trình *coord.c* ghi một cặp tọa độ X/Y vào tệp này, `write_vms()` sẽ thực hiện các thao tác sau:

```c
input_report_rel(vms_input_dev, REL_X, x);
input_report_rel(vms_input_dev, REL_Y, y);
input_sync(vms_input_dev);
```

Câu lệnh đầu tiên tạo ra một sự kiện `REL_X` hoặc chuyển động thiết bị tương đối theo hướng X. Câu lệnh thứ hai tạo ra một sự kiện `REL_Y` hoặc chuyển động tương đối theo hướng Y. `input_sync()` chỉ ra rằng sự kiện này đã hoàn tất, vì vậy input subsystem sẽ thu thập hai sự kiện này thành một gói `evdev` duy nhất và gửi nó ra ngoài thông qua */dev/input/eventX*, với *X* là số thứ tự giao diện (interface number) được gán cho driver vms. Một ứng dụng đọc tệp này sẽ nhận được các gói sự kiện theo định dạng `input_event` đã được mô tả trước đó. Để yêu cầu `gpm` gắn kết vào giao diện sự kiện này và theo đó điều khiển con trỏ di chuyển quanh màn hình của bạn, hãy chạy lệnh sau:

#### bash> gpm -m /dev/input/eventX -t evdev

Driver bộ điều khiển cảm ứng ADS7846 và driver gia tốc kế (accelerometer driver), sẽ được thảo luận lần lượt trong các phần "Bộ điều khiển cảm ứng" (Touch Controllers) và "Gia tốc kế" (Accelerometers) sau đây, cũng là những người dùng `evdev` (evdev users).

#### Nhiều Giao diện Sự kiện Hơn (More Event Interfaces)

Driver vms tận dụng giao diện sự kiện `evdev` tổng quát, nhưng các thiết bị đầu vào như bàn phím, chuột và bộ điều khiển cảm ứng lại có các trình điều khiển sự kiện tùy chỉnh (custom event driver). Chúng ta sẽ tìm hiểu về chúng khi thảo luận các device driver tương ứng.

Để viết trình điều khiển sự kiện của riêng bạn và xuất nó ra user space thông qua */dev/input/mydev*, bạn phải điền dữ liệu vào một cấu trúc có tên là `input_handler` và đăng ký nó với input core như sau:

```c
static struct input_handler my_event_handler = {
 .event = mydev_event, /* Xử lý các báo cáo sự kiện được gửi bởi
 các input device driver sử dụng
 dịch vụ của event driver này */
 .fops = &mydev_fops, /* Các phương thức để quản lý
 /dev/input/mydev */
 .minor = MYDEV_MINOR_BASE, /* Số Minor của
                          /dev/input/mydev */
 .name = "mydev", /* Tên của event driver */
 .id_table = mydev_ids, /* Event driver này có thể xử lý
 các yêu cầu từ các ID này */
 .connect = mydev_connect, /* Được gọi nếu có sự
 khớp ID (ID match) */
 .disconnect = mydev_disconnect, /* Được gọi khi driver hủy đăng ký
 */
};
/* Khởi tạo Driver (Driver Initialization) */
static int __init
mydev_init(void)
{
 /* ... */
 input_register_handler(&my_event_handler);
 /* ... */
 return 0;
}
```

Xem phần cài đặt của mousedev (*drivers/input/mousedev.c*) để có một ví dụ hoàn chỉnh.

## Trình điều khiển thiết bị đầu vào (Input Device Drivers)

Bây giờ chúng ta hãy chuyển sự chú ý sang các trình điều khiển (drivers) cho các thiết bị đầu vào phổ biến như bàn phím (keyboards), chuột (mice) và màn hình cảm ứng (touch screens). Nhưng trước tiên, hãy cùng điểm qua một cơ chế truy cập phần cứng có sẵn dành cho các trình điều khiển đầu vào.

## Serio

Tầng *serio* cung cấp các thư viện hàm để truy cập phần cứng đầu vào kế thừa (legacy input hardware) như các bộ điều khiển bàn phím tương thích i8042 (i8042-compatible keyboard controllers) và cổng nối tiếp (serial port). Bàn phím và chuột PS/2 giao tiếp với loại đầu tiên, trong khi các bộ điều khiển cảm ứng cổng serial kết nối với loại thứ hai. Để giao tiếp với phần cứng được hỗ trợ bởi serio, ví dụ như gửi một lệnh đến chuột PS/2, hãy đăng ký các trình gọi lại (callback routines) được quy định với serio bằng cách sử dụng `serio_register_driver()`.

Để thêm một trình điều khiển mới như một phần của serio, hãy đăng ký các điểm đầu vào (entry points) `open()`/`close()`/`start()`/`stop()`/`write()` bằng cách sử dụng `serio_register_port()`. Hãy xem *drivers/input/serio/serport.c* để có một ví dụ.

Như bạn có thể thấy trong Hình 7.1, serio chỉ là một con đường để truy cập phần cứng mức thấp (low-level hardware). Thay vào đó, một số trình điều khiển thiết bị đầu vào dựa vào hỗ trợ mức thấp từ các tầng bus (bus layers) như USB hoặc SPI.

### Bàn phím (Keyboards)

Bàn phím có nhiều loại khác nhau — PS/2 kiểu cũ, USB, Bluetooth, Hồng ngoại (Infrared), v.v. Mỗi loại có một trình điều khiển thiết bị đầu vào cụ thể, nhưng tất cả đều sử dụng chung một trình điều khiển sự kiện bàn phím (keyboard event driver), qua đó đảm bảo một giao diện nhất quán cho người dùng. Tuy nhiên, trình điều khiển sự kiện bàn phím có một tính năng đặc biệt so với các trình điều khiển sự kiện khác: Nó truyền dữ liệu đến một hệ thống con kernel (kernel subsystem) khác (tầng tty), thay vì đến không gian người dùng (user space) thông qua các nút */dev*.

#### Bàn phím PC (PC Keyboards)

Bàn phím PC (còn gọi là bàn phím PS/2 hoặc bàn phím AT) giao tiếp với bộ vi xử lý thông qua bộ điều khiển bàn phím tương thích i8042. Máy tính để bàn thường có một bộ điều khiển bàn phím chuyên dụng, nhưng trên máy tính xách tay (laptops), việc giao tiếp với bàn phím là một trong những nhiệm vụ của bộ điều khiển nhúng đa năng (general-purpose embedded controller) (xem phần "Embedded Controllers" trong Chương 20, "More Devices and Drivers"). Khi bạn nhấn một phím trên bàn phím PC, đây là lộ trình mà nó đi qua:

- Bộ điều khiển bàn phím (hoặc bộ điều khiển nhúng) quét và giải mã ma trận bàn phím, đồng thời xử lý các chi tiết nhỏ như chống dội phím (key debouncing). **1.**
- Trình điều khiển thiết bị bàn phím, với sự trợ giúp của serio, đọc các *scancodes* thô từ bộ điều khiển bàn phím cho mỗi sự kiện nhấn và nhả phím. Sự khác biệt giữa việc nhấn và nhả nằm ở bit có trọng số cao nhất (most significant bit), được thiết lập (set) cho trường hợp nhả phím. Ví dụ, việc ấn phím "a" sẽ tạo ra một cặp scancodes: 0x1e và 0x9e. Các phím đặc biệt được thoát (escaped) bằng 0xE0, do đó, việc nhấp vào phím mũi tên phải sẽ tạo ra chuỗi (0xE0 0x4D 0xE0 0xCD). Bạn có thể sử dụng tiện ích *showkey* để quan sát các scancodes phát ra từ bộ điều khiển (ký hiệu đi kèm với các giải thích): **2.**

```
bash> showkey -s
kb mode was UNICODE
[ nếu bạn đang thử điều này trên X, nó có thể không hoạt động vì
 máy chủ X cũng đang đọc /dev/console ]
 nhấn phím bất kỳ (chương trình kết thúc sau 10 giây kể từ lần 
 nhấn phím cuối cùng)...
```

```
 ...
 0x1e 0x9e Thao tác ấn phím "a"
```

Trình điều khiển thiết bị bàn phím chuyển đổi các scancodes nhận được thành *keycodes*, dựa trên chế độ đầu vào (input mode). Để xem keycode tương ứng với phím "a": **3.**

```
bash> showkey
...
keycode 30 press Thao tác ấn phím "a"
keycode 30 release Thao tác nhả phím "a"
```

Để báo cáo keycode lên tầng trên (upstream), trình điều khiển tạo ra một sự kiện đầu vào (input event), sự kiện này chuyển quyền điều khiển cho trình điều khiển sự kiện bàn phím.

Trình điều khiển sự kiện bàn phím tiến hành dịch keycode tùy thuộc vào bản đồ phím (key map) được tải. (Xem trang man của *loadkeys* và các tệp bản đồ có trong */lib/kbd/keymaps.*) Nó kiểm tra xem keycode được dịch có gắn liền với các hành동 như chuyển đổi bảng điều khiển ảo (virtual console) hoặc khởi động lại hệ thống hay không. Để làm sáng các đèn LED CAPSLOCK và NUMLOCK thay vì khởi động lại hệ thống khi nhấn Ctrl+Alt+Del, hãy thêm đoạn mã sau vào trình xử lý Ctrl+Alt+Del của trình điều khiển sự kiện bàn phím tại *drivers/char/keyboard.c*: **4.**

```
static void fn_boot_it(struct vc_data *vc,
 struct pt_regs *regs)
{
+ set_vc_kbd_led(kbd, VC_CAPSLOCK);
+ set_vc_kbd_led(kbd, VC_NUMLOCK);
- ctrl_alt_del();
}
```

Đối với các phím thông thường, keycode đã dịch được gửi đến terminal ảo (virtual terminal) tương ứng và quy tắc đường truyền N_TTY (N_TTY line discipline). (Chúng ta đã thảo luận về virtual terminals và line disciplines trong Chương 6, "Serial Drivers.") Điều này được thực hiện như sau bởi *drivers/char/keyboard.c*: **5.**

```
/* Thêm keycode vào bộ đệm lật (flip buffer) */
tty_insert_flip_char(tty, keycode, 0);
/* Lên lịch trình */
con_schedule_flip(tty);
```

Quy tắc đường truyền N_TTY xử lý đầu vào nhận được từ bàn phím, phát lại (echo) nó ra bảng điều khiển ảo và cho phép các ứng dụng không gian người dùng đọc các ký tự từ nút */dev/ttyX* được kết nối với terminal ảo.

Hình 7.3 hiển thị luồng dữ liệu từ thời điểm bạn nhấn một phím trên bàn phím cho đến thời điểm nó được hiển thị (echo) trên bảng điều khiển ảo của bạn. Nửa bên trái của hình vẽ là dành riêng cho phần cứng (hardware-specific) và nửa bên phải là chung (generic). Theo mục tiêu thiết kế của hệ thống con đầu vào (input subsystem), giao diện phần cứng bên dưới là trong suốt (transparent) đối với trình điều khiển sự kiện bàn phím và tầng tty. Do đó, nhân đầu vào (input core) và các giao diện sự kiện được xác định rõ ràng giúp cách ly người dùng đầu vào khỏi sự phức tạp của phần cứng.

**Hình 7.3. Luồng dữ liệu từ một bàn phím tương thích PS/2.**

[Xem ảnh kích thước đầy đủ]

```
                     Hardware-Specific Half                          Generic Half

   ------------------------------                          ----------------------------
   | Input Hardware              |                         | Input User               |
   |                             |                         |                          |
   |  +----------------------+   |                         |   +------------------+   |
   |  | Keyboard Controller  |   |                         |   |   N_TTY          |   |
   |  | (Desktops)           |   |                         |   | Line Discipline  |   |
   |  | Embedded Controller  |   |                         |   +------------------+   |
   |  | (Laptops)            |   |                         |            ^             |
   |  +----------------------+   |                         |            |             |
   ------------------------------                          |   +------------------+   |
                 |                                         |   | Virtual Terminal |   |
                 |                                         |   +------------------+   |
              (keyboard)                                   |            ^             |
                 v                                         |            |             |
          ---------------------                            | +----------------------+ |
          |       Serio        |                           | | Key Handlers for     | |
          ---------------------                            | | Sysrq, Reboot,       | |
                 |                                         | | Scroll, Meta,        | |
                 |                                         | | Console switch,      | |
                 v                                         | | Caps...              | |
          ---------------------                            | +----------------------+ |
          |       ISR          |                           |            ^             |
          ---------------------                            |            |             |
                 |                                         | +--------------------+   |
                 v                                         | | Keyboard           |   |
          ---------------------                            | | Translation Tables |   |
          |     Scancode       |                           | +--------------------+   |
          ---------------------                            |            ^             |
                 |                                         |            |             |
                 v                                         |   +------------------+   |
          ---------------------                            |   |   Event Handler  |   |
          |     Keycode        |                           |   +------------------+   |
          ---------------------                            |            ^             |
                                                           |            |             |
                                                           | Input Event Driver       |
   ------------------------------                          | (drivers/char/           |
   | Input Device Driver        |                          |   keyboard.c)            |
   | (drivers/input/keyboard/   |                          ----------------------------
   |          atkbd.c)          |
   ------------------------------

                             \                             /
                              \                           /
                                   +----------------+
                                   |   Input Core   |
                                   +----------------+
```

**Bàn phím USB và Bluetooth (USB and Bluetooth Keyboards)**

Các thông số kỹ thuật của USB liên quan đến *thiết bị giao diện con người* (human interface devices - HID) quy định giao thức mà bàn phím USB, chuột, bàn phím số (keypads) và các thiết bị ngoại vi đầu vào khác sử dụng để giao tiếp. Trên Linux, điều này được triển khai thông qua driver client USB *usbhid*, chịu trách nhiệm quản lý lớp USB HID (0x03). Usbhid tự đăng ký như một driver thiết bị đầu vào (input device driver). Nó tuân thủ API đầu vào (Input API) và báo cáo các sự kiện đầu vào (input events) phù hợp với thiết bị HID được kết nối.

Để hiểu luồng mã nguồn (code path) cho bàn phím USB, hãy quay lại Hình 7.3 và sửa đổi nửa bên trái chuyên biệt theo phần cứng (hardware-specific left half). Thay thế bộ điều khiển bàn phím (keyboard controller) trong hộp Input Hardware bằng bộ điều khiển USB (USB controller), serio bằng lớp lõi USB (USB core layer), và hộp Input Device Driver bằng driver usbhid.

Đối với bàn phím Bluetooth, hãy thay thế bộ điều khiển bàn phím trong Hình 7.3 bằng một chipset Bluetooth, serio bằng lớp lõi Bluetooth (Bluetooth core layer), và hộp Input Device Driver bằng driver Bluetooth hidp.

USB và Bluetooth được thảo luận chi tiết lần lượt trong Chương 11, "Universal Serial Bus," và Chương 16, "Linux Without Wires."

## Chuột (Mice)

Chuột, giống như bàn phím, có các tính năng khác nhau và có các tùy chọn giao tiếp khác nhau. Hãy cùng xem xét các loại phổ biến.

#### Chuột PS/2 (PS/2 Mice)

Chuột tạo ra các chuyển động tương đối trên các trục X và Y. Chúng cũng sở hữu một hoặc nhiều nút. Một số loại cũng có bánh xe cuộn (scroll wheel). Trình điều khiển thiết bị đầu vào (input device driver) cho chuột kiểu cũ tương thích với PS/2 dựa vào tầng serio (serio layer) để giao tiếp với bộ điều khiển bên dưới. Trình điều khiển sự kiện đầu vào (input event driver) cho chuột, có tên là *mousedev*, báo cáo các sự kiện chuột cho các ứng dụng người dùng (user application) thông qua */dev/input/mice*.

#### Ví dụ về Thiết bị: Chuột Con lăn (Roller Mouse)

Để có cảm nhận về một trình điều khiển thiết bị chuột trong thế giới thực, hãy chuyển đổi bánh xe con lăn được thảo luận trong Chương 4, "Laying the Groundwork," thành một biến thể của chuột PS/2 thông thường. "Chuột con lăn" tạo ra chuyển động một chiều trên trục Y. Các vòng quay theo chiều kim đồng hồ và ngược chiều kim đồng hồ của bánh xe tạo ra các tọa độ Y tương đối dương và âm tương ứng (giống như bánh xe cuộn trong chuột), trong khi việc nhấn vào bánh xe con lăn sẽ tạo ra sự kiện nút chuột trái. Do đó, chuột con lăn rất lý tưởng để điều hướng menu trong các thiết bị như điện thoại thông minh (smartphone), thiết bị cầm tay (handheld) và máy nghe nhạc.

Trình điều khiển thiết bị chuột con lăn được triển khai trong Liệt kê 7.3 (Listing 7.3) hoạt động với các hệ thống cửa sổ (windowing system) như X Windows. Hãy xem `roller_mouse_init()` để biết cách trình điều khiển khai báo các khả năng giống như chuột của nó. Không giống như trình điều khiển bánh xe con lăn trong Liệt kê 4.1 của Chương 4, trình điều khiển chuột con lăn không cần phương thức `read()` hoặc `poll()` vì các الأحداث (events) được báo cáo bằng cách sử dụng các API đầu vào (input APIs). Trình xử lý ngắt (interrupt handler) của chuột con lăn `roller_isr()` cũng thay đổi tương ứng. Những công việc quản lý nội bộ (housekeeping) được thực hiện trong trình xử lý ngắt bằng cách sử dụng hàng đợi chờ (wait queue), khóa quay (spinlock) và hàm `store_movement()` để hỗ trợ `read()` và `poll()` đã không còn nữa.

Trong Liệt kê 7.3, các dấu **+** và **-** ở đầu biểu thị sự khác biệt so với trình điều khiển bánh xe con lăn được triển khai trong Liệt kê 4.1 của Chương 4.

#### Liệt kê 7.3. Trình điều khiển Chuột Con lăn (The Roller Mouse Driver)

```c
+ #include <linux/input.h>
+ #include <linux/interrupt.h>
+ /* Device structure */
+ struct {
+ /* ... */
+ struct input_dev dev;
+ } roller_mouse;
+ static int __init
+ roller_mouse_init(void)
+ {
+ /* Allocate input device structure */
+ roller_mouse->dev = input_allocate_device();
+
```

```c
+ /* Can generate a click and a relative movement */
+ roller_mouse->dev->evbit[0] = BIT(EV_KEY) | BIT(EV_REL);
+ /* Can move only in the Y-axis */
+ roller_mouse->dev->relbit[0] = BIT(REL_Y);
+
+ /* My click should be construed as the left button
+ press of a mouse */
+ roller_mouse->dev->keybit[LONG(BTN_MOUSE)] = BIT(BTN_LEFT);
+ roller_mouse->dev->name = "roll";
+
+ /* For entries in /sys/class/input/inputX/id/ */
+ roller_mouse->dev->id.bustype = ROLLER_BUS;
+ roller_mouse->dev->id.vendor = ROLLER_VENDOR;
+ roller_mouse->dev->id.product = ROLLER_PROD;
+ roller_mouse->dev->id.version = ROLLER_VER;
+ /* Register with the input subsystem */
+ input_register_device(roller_mouse->dev);
+}
/* Global variables */
- spinlock_t roller_lock = SPIN_LOCK_UNLOCKED;
- static DECLARE_WAIT_QUEUE_HEAD(roller_poll);
/* The Roller Interrupt Handler */
static irqreturn_t
roller_interrupt(int irq, void *dev_id)
{
 int i, PA_t, PA_delta_t, movement = 0;
 /* Get the waveforms from bits 0, 1 and 2
 of Port D as shown in Figure 7.1 */
 PA_t = PORTD & 0x07;
 /* Wait until the state of the pins change.
 (Add some timeout to the loop) */
 for (i=0; (PA_t==PA_delta_t); i++){
 PA_delta_t = PORTD & 0x07;
 }
 movement = determine_movement(PA_t, PA_delta_t);
- spin_lock(&roller_lock);
-
- /* Store the wheel movement in a buffer for
- later access by the read()/poll() entry points */
- store_movements(movement);
-
- spin_unlock(&roller_lock);
-
- /* Wake up the poll entry point that might have
- gone to sleep, waiting for a wheel movement */
- wake_up_interruptible(&roller_poll);
-
+ if (movement == CLOCKWISE) {
+ input_report_rel(roller_mouse->dev, REL_Y, 1);
+ } else if (movement == ANTICLOCKWISE) {
```

```c
+ input_report_rel(roller_mouse->dev, REL_Y, -1);
+ } else if (movement == KEYPRESSED) {
+ input_report_key(roller_mouse->dev, BTN_LEFT, 1);
+ }
+ input_sync(roller_mouse->dev);
 return IRQ_HANDLED;
}
```

#### Trackpoints

*Trackpoint* là một thiết bị điều con trỏ được tích hợp sẵn với bàn phím kiểu PS/2 trên một số máy tính xách tay (laptop). Thiết bị này bao gồm một cần điều khiển (joystick) nằm giữa các phím và các nút chuột được định vị bên dưới phím cách (spacebar). Về cơ bản, trackpoint hoạt động như một con chuột, vì vậy bạn có thể vận hành nó bằng trình điều khiển chuột PS/2.

Không giống như một con chuột thông thường, trackpoint cung cấp khả năng kiểm soát chuyển động nhiều hơn. Bạn có thể ra lệnh cho bộ điều khiển trackpoint thay đổi các thuộc tính như độ nhạy (sensitivity) và độ ì (inertia). Kernel có một trình điều khiển đặc biệt, *drivers/input/mouse/trackpoint.c*, để tạo và quản lý các node sysfs liên quan. Để có toàn bộ tập hợp các tùy chọn cấu hình trackpoint, hãy tìm bên dưới thư mục */sys/devices/platform/i8042/serioX/serioY/*.

#### Touchpad (Bàn di chuột)

*Touchpad* là một thiết bị trỏ (pointing device) giống như chuột, thường được tìm thấy trên máy tính xách tay (laptop). Khác với chuột thông thường, touchpad không có các bộ phận chuyển động cơ học. Nó có thể tạo ra các tọa độ tương đối (relative coordinates) tương thích với chuột, nhưng thường được hệ điều hành sử dụng ở một chế độ mạnh mẽ hơn là tạo ra các tọa độ tuyệt đối (absolute coordinates). Giao thức truyền thông được sử dụng ở chế độ tuyệt đối tương tự như giao thức chuột PS/2, nhưng không hoàn toàn tương thích với nó.

Driver chuột PS/2 cơ bản có khả năng hỗ trợ các thiết bị tuân theo các biến thể khác nhau của giao thức chuột PS/2 thuần túy (bare PS/2). Bạn có thể thêm hỗ trợ cho một giao thức chuột mới vào driver cơ sở bằng cách cung cấp một driver giao thức (protocol driver) thông qua cấu trúc `psmouse`. Ví dụ, nếu laptop của bạn sử dụng touchpad Synaptics ở chế độ tuyệt đối, driver chuột PS/2 cơ sở sẽ sử dụng các dịch vụ của driver giao thức Synaptics để thông dịch dữ liệu dạng luồng (streaming data). Để có cái nhìn toàn diện từ đầu đến cuối (end-to-end) về cách giao thức Synaptics hoạt động song song với driver PS/2 cơ sở, hãy xem bốn vùng mã nguồn được tập hợp trong Bảng 7.4 (Listing 7.4):

- Driver chuột PS/2, *drivers/input/mouse/psmouse-base.c*, khởi tạo (instantiates) một cấu trúc `psmouse_protocol` chứa thông tin về các giao thức chuột được hỗ trợ (bao gồm cả giao thức touchpad Synaptics).
- Cấu trúc `psmouse`, được định nghĩa trong *drivers/input/mouse/psmouse.h*, liên kết các giao thức PS/2 khác nhau lại với nhau.
- `synaptics_init()` điền vào cấu trúc `psmouse` địa chỉ của các hàm giao thức liên quan.
- Hàm xử lý giao thức `synaptics_process_byte()`, được gán trong `synaptics_init()`, sẽ được gọi từ ngữ cảnh ngắt (interrupt context) khi `serio` phát hiện chuyển động của chuột. Nếu bạn mở rộng hàm `synaptics_process_byte()`, bạn sẽ thấy các chuyển động của touchpad được báo cáo về các ứng dụng người dùng (user applications) thông qua `mousedev`.

#### Bảng 7.4. Driver giao thức chuột PS/2 cho Touchpad Synaptics

```
drivers/input/mouse/psmouse-base.c:
/* List of supported PS/2 mouse protocols */
static struct psmouse_protocol psmouse_protocols[] = {
 {
 .type = PSMOUSE_PS2, /* The bare PS/2 handler */
 .name = "PS/2",
 .alias = "bare",
 .maxproto = 1,
 .detect = ps2bare_detect,
 },
 /* ... */
 {
 .type = PSMOUSE_SYNAPTICS, /* Synaptics TouchPad Protocol */
 .name = "SynPS/2",
 .alias = "synaptics",
 .detect = synaptics_detect, /* Is the protocol detected? */
 .init = synaptics_init, /* Initialize Protocol Handler */
 },
 /* ... */
}
drivers/input/mouse/psmouse.h:
/* The structure that ties various mouse protocols together */
struct psmouse {
 struct input_dev *dev; /* The input device */
 /* ... */
 /* Protocol Methods */
 psmouse_ret_t (*protocol_handler)
 (struct psmouse *psmouse, struct pt_regs *regs);
 void (*set_rate)(struct psmouse *psmouse, unsigned int rate);
 void (*set_resolution)
 (struct psmouse *psmouse, unsigned int resolution);
 int (*reconnect)(struct psmouse *psmouse);
 void (*disconnect)(struct psmouse *psmouse);
 /* ... */
};
drivers/input/mouse/synaptics.c:
/* init() method of the Synaptics protocol */
int synaptics_init(struct psmouse *psmouse)
{
 struct synaptics_data *priv;
 psmouse->private = priv = kmalloc(sizeof(struct synaptics_data),
 GFP_KERNEL);
 /* ... */
 /* This is called in interrupt context when mouse
 movement is sensed */
 psmouse->protocol_handler = synaptics_process_byte;
 /* More protocol methods */
 psmouse->set_rate = synaptics_set_rate;
 psmouse->disconnect = synaptics_disconnect;
 psmouse->reconnect = synaptics_reconnect;
 /* ... */
```

```
}
drivers/input/mouse/synaptics.c:
/* If you unfold synaptics_process_byte() and look at
 synaptics_process_packet(), you can see the input
 events being reported to user applications via mousedev */
static void synaptics_process_packet(struct psmouse *psmouse)
{
 /* ... */
 if (hw.z > 0) {
 /* Absolute X Coordinate */
 input_report_abs(dev, ABS_X, hw.x);
 /* Absolute Y Coordinate */
 input_report_abs(dev, ABS_Y,
 YMAX_NOMINAL + YMIN_NOMINAL - hw.y);
 }
 /* Absolute Z Coordinate */
 input_report_abs(dev, ABS_PRESSURE, hw.z);
 /* ... */
 /* Left TouchPad button */
 input_report_key(dev, BTN_LEFT, hw.left);
 /* Right TouchPad button */
 input_report_key(dev, BTN_RIGHT, hw.right);
 /* ... */
}
```

#### Chuột USB và Bluetooth (USB and Bluetooth Mice)

Chuột USB được xử lý bởi cùng một input driver (`usbhid`) dùng để điều khiển bàn phím USB. Tương tự, driver `hidp` thực hiện việc hỗ trợ bàn phím Bluetooth cũng đồng thời đảm nhận việc điều khiển chuột Bluetooth.

Đúng như bạn có thể dự đoán, các driver chuột USB và Bluetooth chuyển hướng dữ liệu thiết bị thông qua `mousedev`.

## Bộ điều khiển cảm ứng (Touch Controllers)

Trong Chương 6, chúng ta đã triển khai một trình điều khiển thiết bị (device driver) cho bộ điều khiển cảm ứng nối tiếp dưới dạng một kỷ luật dòng (line discipline) có tên là `N_TCH`. Hệ thống con đầu vào (input subsystem) cung cấp một cách tốt hơn và dễ dàng hơn để triển khai trình điều khiển đó. Hãy thiết kế lại cỗ máy trạng thái hữu hạn (finite state machine) trong `N_TCH` thành một trình điều khiển thiết bị đầu vào (input device driver) với các thay đổi sau:

- Serio cung cấp một kỷ luật dòng (line discipline) có tên là *serport* để truy cập các thiết bị được kết nối với cổng nối tiếp (serial port). Hãy sử dụng các dịch vụ của serport để giao tiếp với bộ điều khiển cảm ứng. **1.**
- Thay vì truyền thông tin tọa độ tới tầng tty (tty layer), hãy tạo ra các báo cáo đầu vào (input reports) thông qua evdev như bạn đã làm trong Liệt kê 7.2 cho con chuột ảo (virtual mouse). **2.**

Với cách này, màn hình cảm ứng có thể được truy cập từ không gian người dùng (user space) thông qua `/dev/input/eventX.` Việc triển khai trình điều khiển thực tế được để lại như một bài tập.

Một ví dụ về bộ điều khiển cảm ứng không giao tiếp qua cổng nối tiếp là chip Analog Devices ADS7846, giao tiếp qua *Giao diện Ngoại vi Nối tiếp* (Serial Peripheral Interface - SPI). Trình điều khiển cho thiết bị này sử dụng các dịch vụ của lõi SPI (SPI core) thay vì serio. Mục "The Serial Peripheral Interface Bus" trong Chương 8, "The Inter-Integrated Circuit Protocol," thảo luận về SPI. Giống như hầu hết các trình điều khiển cảm ứng, trình điều khiển ADS7846 sử dụng giao diện evdev để phân phối thông tin cảm ứng đến các ứng dụng người dùng (user applications).

Một số bộ điều khiển cảm ứng giao tiếp qua USB. Một ví dụ là bộ điều khiển cảm ứng USB 3M, được điều khiển bởi `drivers/input/touchscreen/usbtouchscreen.c`.

Nhiều thiết bị PDA có các tấm nền cảm ứng điện trở bốn dây chồng lên màn hình LCD của chúng. Các bản cực X và Y của tấm nền (hai dây cho mỗi trục) kết nối với bộ chuyển đổi tương tự sang số (analog-to-digital converter - ADC), cung cấp giá trị đọc số của sự chênh lệch điện áp tương tự phát sinh từ việc chạm vào màn hình. Trình điều khiển đầu vào (input driver) thu thập tọa độ từ ADC và phân phối nó đến không gian người dùng (user space).

Các thể hiện (instances) khác nhau của cùng một tấm nền cảm ứng có thể tạo ra các dải tọa độ hơi khác nhau (các giá trị tối đa theo hướng X và Y) do đặc thù của quy trình sản xuất. Để tách biệt các ứng dụng khỏi sự biến động này, màn hình cảm ứng được *hiệu chuẩn* (calibrated) trước khi sử dụng. Việc hiệu chuẩn thường được khởiinitiated bởi giao diện đồ họa người dùng (GUI) bằng cách hiển thị các dấu chữ thập ở ranh giới màn hình và các điểm thuận lợi khác, đồng thời yêu cầu người dùng chạm vào các điểm đó. Các tọa độ được tạo ra sẽ được lập trình ngược lại vào bộ điều khiển cảm ứng bằng cách sử dụng các lệnh phù hợp nếu nó hỗ trợ tự hiệu chuẩn, hoặc được sử dụng để điều chỉnh tỷ lệ (scale) luồng tọa độ trong phần mềm nếu không.

Hệ thống con đầu vào (input subsystem) cũng chứa một trình điều khiển sự kiện (event driver) có tên là *tsdev*, tạo ra thông tin tọa độ theo giao thức màn hình cảm ứng Compaq. Nếu hệ thống của bạn báo cáo các sự kiện cảm ứng thông qua *tsdev*, các ứng dụng hiểu giao thức này có thể thu thập đầu vào cảm ứng từ `/dev/input/tsX.` Tuy nhiên, trình điều khiển này đã được lên lịch để loại bỏ khỏi nhân chính (mainline kernel) nhằm ưu tiên cho thư viện *tslib* ở không gian người dùng (user space). Tệp *Documentation/feature-removalschedule.txt* liệt kê các tính năng sắp bị loại bỏ khỏi cây mã nguồn nhân (kernel source tree).

## Cảm biến gia tốc (Accelerometers)

Cảm biến gia tốc (accelerometer) dùng để đo gia tốc. Một số dòng máy tính xách tay của IBM/Lenovo tích hợp cảm biến gia tốc nhằm phát hiện các chuyển động đột ngột. Thông tin thu được dùng để bảo vệ ổ đĩa cứng (hard disk) khỏi hư hỏng thông qua cơ chế gọi là *Hệ thống bảo vệ ổ cứng chủ động* (Hard Drive Active Protection System - HDAPS), tương tự như cách túi khí trên ô tô bảo vệ hành khách khỏi chấn thương. Trình điều khiển (driver) HDAPS được hiện thực hóa như một platform driver đăng ký với input subsystem (hệ thống con đầu vào). Nó sử dụng `evdev` để truyền phát (stream) các thành phần gia tốc trục X và Y. Các ứng dụng có thể đọc các sự kiện gia tốc thông qua */dev/input/eventX* để phát hiện các tình trạng như sốc (shock) và rung (vibe), từ đó thực hiện hành động phòng thủ, chẳng hạn như đưa đầu đọc của ổ cứng về vị trí an toàn (parking the hard drive's head). Lệnh sau sẽ in ra dữ liệu nếu bạn di chuyển máy tính xách tay (giả sử `event3` được gán cho HDAPS):

**bash> od –x /dev/input/event3** 0000000 a94d 4599 1f19 0007 0003 0000 ffed ffff ...

Cảm biến gia tốc cũng cung cấp các thông tin như nhiệt độ, hoạt động của bàn phím và hoạt động của chuột, tất cả đều có thể thu thập thông qua các tệp trong */sys/devices/platform/hdaps/*. Do đó, trình điều khiển HDAPS là một phần của hệ thống con giám sát phần cứng (*hwmon*) trong mã nguồn nhân (kernel sources). Chúng ta sẽ bàn về vấn đề giám sát phần cứng trong mục "Giám sát phần cứng với LM-Sensors" ở chương tiếp theo.

### Sự kiện đầu ra (Output Events)

Một số trình điều khiển thiết bị đầu vào (input device drivers) cũng xử lý các sự kiện đầu ra (output events). Ví dụ, trình điều khiển bàn phím có thể làm sáng đèn LED CAPSLOCK, và trình điều khiển loa PC (PC speaker driver) có thể phát ra tiếng beep. Hãy cùng phân tích kỹ hơn về trường hợp thứ hai. Trong quá trình khởi tạo (initialization), trình điều khiển loa khai báo khả năng đầu ra (output capability) của nó bằng cách thiết lập các *evbit* phù hợp và đăng ký một hàm gọi lại (callback routine) để xử lý sự kiện đầu ra:

```
drivers/input/misc/pcspkr.c:
static int __devinit pcspkr_probe(struct platform_device *dev)
{
 /* ... */
 /* Capability Bits */
 pcspkr_dev->evbit[0] = BIT(EV_SND);
 pcspkr_dev->sndbit[0] = BIT(SND_BELL) | BIT(SND_TONE);
 /* The Callback routine */
 pcspkr_dev->event = pcspkr_event;
 err = input_register_device(pcspkr_dev);
 /* ... */
}
/* The callback routine */
static int pcspkr_event(struct input_dev *dev, unsigned int type,
 unsigned int code, int value)
{
 /* ... */
 /* I/O programming to sound a beep */
 outb_p(inb_p(0x61) | 3, 0x61);
 /* set command for counter 2, 2 byte write */
 outb_p(0xB6, 0x43);
 /* select desired HZ */
 outb_p(count & 0xff, 0x42);
 outb((count >> 8) & 0xff, 0x42);
 /* ... */
}
```

Để phát ra tiếng beep, trình điều khiển sự kiện bàn phím (keyboard event driver) tạo ra một sự kiện âm thanh (EV\_SND) như sau:

```
input_event(handle->dev, EV_SND, /* Type */
 SND_TONE, /* Code */
 hz /* Value */);
```

Thao tác này kích hoạt việc thực thi hàm gọi lại `pcspkr_event()`, và bạn sẽ nghe thấy tiếng beep.

## Gỡ lỗi (Debugging)

Bạn có thể sử dụng mô-đun *evbug* làm công cụ hỗ trợ gỡ lỗi nếu đang phát triển một trình điều khiển đầu vào (input driver). Nó kết xuất (dumps) bộ ba (*type*, *code*, *value*) (xem `struct input_event` đã được định nghĩa trước đó) tương ứng với các sự kiện do input subsystem tạo ra. Hình 7.4 chứa dữ liệu được ghi lại bởi evbug trong khi thao tác với một số thiết bị đầu vào:

**Hình 7.4. Kết xuất đầu ra của Evbug.**

```
/* Touchpad Movement */
evbug.c Event. Dev: isa0060/serio1/input0: Type: 3, Code: 28, Value: 0
evbug.c Event. Dev: isa0060/serio1/input0: Type: 1, Code: 325, Value: 0
evbug.c Event. Dev: isa0060/serio1/input0: Type: 0, Code: 0, Value: 0
/* Trackpoint Movement */
evbug.c Event. Dev: synaptics-pt/serio0/input0: Type: 2, Code: 0, Value: -1
evbug.c Event. Dev: synaptics-pt/serio0/input0: Type: 2, Code: 1, Value: -2
evbug.c Event. Dev: synaptics-pt/serio0/input0: Type: 0, Code: 0, Value: 0
/* USB Mouse Movement */
evbug.c Event. Dev: usb-0000:00:1d.1-2/input0: Type: 2, Code: 1, Value: -1
evbug.c Event. Dev: usb-0000:00:1d.1-2/input0: Type: 0, Code: 0, Value: 0
evbug.c Event. Dev: usb-0000:00:1d.1-2/input0: Type: 2, Code: 0, Value: 1
evbug.c Event. Dev: usb-0000:00:1d.1-2/input0: Type: 0, Code: 0, Value: 0
/* PS/2 Keyboard keypress 'a' */
evbug.c Event. Dev: isa0060/serio0/input0: Type: 4, Code: 4, Value: 30
evbug.c Event. Dev: isa0060/serio0/input0: Type: 1, Code: 30, Value: 0
evbug.c Event. Dev: isa0060/serio0/input0: Type: 0, Code: 0, Value: 0
/* USB keyboard keypress 'a' */
evbug.c Event. Dev: usb-0000:00:1d.1-1/input0: Type: 1, Code: 30, Value: 1
evbug.c Event. Dev: usb-0000:00:1d.1-1/input0: Type: 0, Code: 0, Value: 0
evbug.c Event. Dev: usb-0000:00:1d.1-2/input0: Type: 1, Code: 30, Value: 0
evbug.c Event. Dev: usb-0000:00:1d.1-2/input0: Type: 0, Code: 0, Value: 0
```

Để hiểu được dữ liệu kết xuất trong Hình 7.4, hãy ghi nhớ rằng bàn di chuột (touchpads) tạo ra các tọa độ tuyệt đối (EV\_ABS) tương ứng với loại sự kiện 0x03, trackpoint tạo ra các tọa độ tương đối (EV\_REL) tương ứng với loại sự kiện 0x02, và bàn phím phát ra các sự kiện phím (EV\_KEY) tương ứng với loại sự kiện 0x01. Loại sự kiện 0x0 tương ứng với việc gọi hàm `input_sync()`, thực hiện công việc sau:

```
input_event(dev, EV_SYN, SYN_REPORT, 0);
```

Điều này dịch thành một bộ (tuple) (*type, code, value*) gồm (0x0, 0x0, 0x0) và hoàn tất mỗi sự kiện đầu vào (input event).

## Khảo sát Mã nguồn

Hầu hết các trình điều khiển sự kiện đầu vào (input event driver) đều nằm trong thư mục *drivers/input/*. Tuy nhiên, trình điều khiển sự kiện bàn phím (keyboard event driver) lại nằm ở *drivers/char/keyboard.c*, vì nó được kết nối với các terminal ảo thay vì các nút thiết bị (device node) dưới thư mục */dev/input/*.

Bạn có thể tìm thấy các trình điều khiển thiết bị đầu vào (input device driver) ở nhiều nơi. Các trình điều khiển cho bàn phím, chuột và joystick cũ (legacy) nằm ở các thư mục con riêng biệt dưới *drivers/input/*. Các trình điều khiển đầu vào Bluetooth nằm trong *net/bluetooth/hidp/*. Bạn cũng có thể tìm thấy các trình điều khiển đầu vào ở các vùng như *drivers/hwmon/* và *drivers/media/video/*. Các loại (type), mã (code) và giá trị (value) của sự kiện được định nghĩa trong *include/linux/input.h*.

Hệ thống con serio (serio subsystem) nằm trong *drivers/input/serio/*. Mã nguồn cho line discipline serport nằm trong *drivers/input/serio/serport.c*. Thư mục *Documentation/input/* chứa thêm chi tiết về các giao diện đầu vào khác nhau.

Bảng 7.1 tóm tắt các cấu trúc dữ liệu chính được sử dụng trong chương này và vị trí của chúng bên trong cây mã nguồn (source tree). Bảng 7.2 liệt kê các giao diện lập trình kernel (kernel programming interface) chính mà bạn đã sử dụng trong chương này cùng với vị trí định nghĩa của chúng.

**Bảng 7.1. Tóm tắt các Cấu trúc Dữ liệu**

| Cấu trúc Dữ liệu | Vị trí                                              | Mô tả                                                        |
|-------------------|-----------------------------------------------------|--------------------------------------------------------------|
| input_event       | include/linux/input.h                               | Mỗi gói sự kiện (event packet) được tạo ra<br>bởi evdev đều có định dạng này. |
| input_dev         | include/linux/input.h                               | Sự thể hiện của một thiết bị<br>đầu vào (input device).      |
| input_handler     | include/linux/serial_core.h                         | Chứa các điểm nhập (entry point) được<br>hỗ trợ bởi một event driver. |
|                   | psmouse_protocol drivers/input/mouse/psmouse-base.c | Thông tin về một trình điều khiển giao thức<br>chuột PS/2 được hỗ trợ. |
| psmouse           | drivers/input/mouse/psmouse.h                       | Các phương thức được hỗ trợ bởi trình điều khiển<br>chuột PS/2. |

**Bảng 7.2. Tóm tắt các Giao diện Lập trình Kernel**

| Giao diện Kernel          | Vị trí                | Mô tả                                                         |
|---------------------------|-----------------------|---------------------------------------------------------------|
| input_register_device()   | drivers/input/input.c | Đăng ký một thiết bị với input<br>core                        |
| input_unregister_device() | drivers/input/input.c | Hủy đăng ký (gỡ bỏ) một thiết bị khỏi<br>input core           |
| input_report_rel()        | include/linux/input.h | Tạo ra chuyển động tương đối<br>(relative movement) theo một hướng chỉ định |
| input_report_abs()        | include/linux/input.h | Tạo ra chuyển động tuyệt đối<br>(absolute movement) theo một hướng chỉ định |
| input_report_key()        | include/linux/input.h | Tạo ra một sự kiện nhấn phím<br>hoặc nút                      |

| Giao diện Kernel                                          | Vị trí                   | Mô tả                                                                                                                                                       |
|-----------------------------------------------------------|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| input_sync()                                              | include/linux/input.h    | Chỉ ra rằng hệ thống con đầu vào<br>(input subsystem) có thể thu thập các sự kiện<br>đã được tạo trước đó thành một gói evdev<br>và gửi nó đến user space<br>thông qua /dev/input/inputX |
| input_register_handler()                                  | drivers/input/input.c    | Đăng ký một event driver tùy chỉnh                                                                                                                          |
| sysfs_create_group()                                      | fs/sysfs/group.c         | Tạo một nhóm nút sysfs với các<br>thuộc tính được chỉ định                                                                                                  |
| sysfs_remove_group()                                      | fs/sysfs/group.c         | Xóa một nhóm sysfs được tạo<br>bằng sysfs_create_group()                                                                                                    |
| tty_insert_flip_char()                                    | include/linux/tty_flip.h | Gửi một ký tự đến tầng line<br>discipline                                                                                                                   |

| platform_device_register_simple() drivers/base/platform.c |                          | Tạo một platform device đơn giản                                                                                                                            |
| platform_device_unregister()                              | drivers/base/platform.c  | Hủy đăng ký một platform device                                                                                                                               |
