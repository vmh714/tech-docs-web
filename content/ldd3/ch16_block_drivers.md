# Chương 16: Driver khối (Block Drivers)

Cho đến nay, các cuộc thảo luận của chúng ta chỉ giới hạn ở các trình điều khiển ký tự (char drivers). Tuy nhiên, có những loại trình điều khiển khác trong các hệ thống Linux, và đã đến lúc chúng ta mở rộng tầm nhìn của mình hơn một chút. Theo đó, chương này thảo luận về các trình điều khiển khối (block drivers).

Trình điều khiển khối (block driver) cung cấp quyền truy cập vào các thiết bị truyền dữ liệu có thể truy cập ngẫu nhiên theo các khối có kích thước cố định — chủ yếu là các ổ đĩa. Nhân Linux (Linux kernel) coi các thiết bị khối (block devices) hoàn toàn khác biệt với các thiết bị ký tự (char devices); kết quả là các trình điều khiển khối có giao diện riêng biệt và những thách thức đặc thù của chúng.

Các trình điều khiển khối hiệu năng cao đóng vai trò cốt lõi đối với hiệu năng — và không chỉ đối với các thao tác đọc và ghi tường minh trong các ứng dụng người dùng (user applications). Các hệ thống hiện đại có bộ nhớ ảo (virtual memory) hoạt động bằng cách chuyển dịch dữ liệu (hy vọng là) không cần thiết sang bộ nhớ phụ, thường là ổ đĩa. Trình điều khiển khối là cầu nối giữa bộ nhớ chính (core memory) và bộ nhớ phụ; do đó, chúng có thể được xem là một phần của hệ thống con bộ nhớ ảo (virtual memory subsystem). Mặc dù có thể viết một trình điều khiển khối mà không cần biết về `struct page` và các khái niệm bộ nhớ quan trọng khác, bất kỳ ai cần viết một trình điều khiển hiệu năng cao đều phải tận dụng các tài liệu được đề cập trong Chương 15.

Phần lớn thiết kế của tầng khối (block layer) tập trung vào hiệu năng. Nhiều thiết bị ký tự có thể chạy dưới tốc độ tối đa của chúng mà hiệu năng của toàn bộ hệ thống không bị ảnh hưởng. Tuy nhiên, hệ thống không thể chạy tốt nếu hệ thống con I/O khối (block I/O subsystem) của nó không được tinh chỉnh tốt. Giao diện trình điều khiển khối của Linux cho phép bạn tận dụng tối đa thiết bị khối nhưng đồng thời cũng áp đặt một mức độ phức tạp nhất định mà bạn phải đối mặt. May mắn thay, giao diện khối của phiên bản 2.6 đã được cải thiện rất nhiều so với những gì có trong các nhân cũ hơn.

Các cuộc thảo luận trong chương này, như người ta có thể mong đợi, tập trung vào một trình điều khiển mẫu triển khai một thiết bị hướng khối, dựa trên bộ nhớ. Về cơ bản, nó là một đĩa RAM (ramdisk). Nhân Linux đã chứa sẵn một cài đặt ramdisk vượt trội hơn nhiều, nhưng trình điều khiển của chúng tôi (được gọi là *sbull*) cho phép chúng ta minh họa việc tạo ra một trình điều khiển khối đồng thời giảm thiểu tối đa các độ phức tạp không liên quan.

Trước khi đi vào chi tiết, chúng ta hãy định nghĩa chính xác một vài thuật ngữ. Một *khối* (*block*) là một khối dữ liệu có kích thước cố định, với kích thước được xác định bởi nhân. Các khối thường có kích thước 4096 byte, nhưng giá trị đó có thể thay đổi tùy thuộc vào kiến trúc và hệ thống tệp (filesystem) chính xác đang được sử dụng. Ngược lại, một *khu vực* (*sector*) là một khối nhỏ mà kích thước của nó thường được xác định bởi phần cứng bên dưới. Nhân mong đợi làm việc với các thiết bị triển khai các sector 512-byte. Nếu thiết bị của bạn sử dụng kích thước khác, nhân sẽ thích ứng và tránh tạo ra các yêu cầu I/O mà phần cứng không thể xử lý. Tuy nhiên, đáng chú ý là bất cứ khi nào nhân cung cấp cho bạn một số hiệu sector, nó đang làm việc trong thế giới của các sector 512-byte. Nếu bạn đang sử dụng kích thước sector phần cứng khác, bạn phải quy đổi số hiệu sector của nhân cho phù hợp. Chúng ta sẽ thấy cách điều đó được thực hiện trong trình điều khiển *sbull*.

## Đăng ký (Registration)

Trình điều khiển khối, giống như trình điều khiển ký tự, phải sử dụng một tập hợp các giao diện đăng ký để cung cấp thiết bị của chúng cho nhân. Các khái niệm tương tự nhau, nhưng chi tiết về việc đăng ký thiết bị khối hoàn toàn khác biệt. Bạn có một tập hợp hoàn toàn mới các cấu trúc dữ liệu và các thao tác thiết bị (device operations) để tìm hiểu.

## Đăng ký Trình điều khiển Khối (Block Driver Registration)

Bước đầu tiên được thực hiện bởi hầu hết các trình điều khiển khối là tự đăng ký với nhân. Hàm cho tác vụ này là *register\_blkdev* (được khai báo trong *<linux/fs.h>*):

int register\_blkdev(unsigned int major, const char \*name);

Các tham số là số chính (major number) mà thiết bị của bạn sẽ sử dụng và tên liên quan (mà nhân sẽ hiển thị trong */proc/devices*). Nếu major được truyền vào là 0, nhân sẽ cấp phát một số chính mới và trả về nó cho hàm gọi. Như thường lệ, giá trị trả về âm từ *register\_blkdev* cho biết đã có lỗi xảy ra.

Hàm tương ứng để hủy đăng ký trình điều khiển khối là:

int unregister\_blkdev(unsigned int major, const char \*name);

Ở đây, các tham số phải khớp với các tham số đã truyền cho *register\_blkdev*, nếu không hàm sẽ trả về -EINVAL và không hủy đăng ký bất cứ thứ gì.

Trong nhân 2.6, lời gọi đến *register\_blkdev* hoàn toàn là tùy chọn. Các chức năng được thực hiện bởi *register\_blkdev* đã giảm dần theo thời gian; các tác vụ duy nhất được thực hiện bởi lời gọi này tại thời điểm này là (1) cấp phát một số chính động nếu được yêu cầu, và (2) tạo một mục trong */proc/devices*. Trong các phiên bản nhân tương lai, *register\_blkdev* có thể bị loại bỏ hoàn toàn. Tuy nhiên, trong thời gian này, hầu hết các trình điều khiển vẫn gọi nó; đó là truyền thống.

## Đăng ký Đĩa (Disk Registration)

Mặc dù *register\_blkdev* có thể được sử dụng để lấy một số chính, nhưng nó không làm cho bất kỳ ổ đĩa nào khả dụng đối với hệ thống. Có một giao diện đăng ký riêng biệt mà bạn phải sử dụng để quản lý từng ổ đĩa riêng lẻ. Việc sử dụng giao diện này đòi hỏi sự quen thuộc với một cặp cấu trúc mới, đó là nơi chúng ta sẽ bắt đầu.

#### Các thao tác thiết bị khối (Block device operations)

Char device (Thiết bị ký tự) cung cấp các thao tác của chúng cho hệ thống thông qua cấu trúc `file_operations`. Một cấu trúc tương tự được sử dụng với block device (thiết bị khối); đó là `struct block_device_operations`, được khai báo trong *<linux/fs.h>*. Dưới đây là tổng quan ngắn gọn về các trường (field) có trong cấu trúc này; chúng ta sẽ xem xét lại chúng chi tiết hơn khi đi sâu vào các chi tiết của trình điều khiển (driver) *sbull*:

```
int (*open)(struct inode *inode, struct file *filp);
int (*release)(struct inode *inode, struct file *filp);
```

Các hàm hoạt động giống hệt như các hàm tương đương trong char driver; chúng được gọi bất cứ khi nào thiết bị được mở (open) và đóng (release). Một block driver có thể phản hồi lại lệnh gọi mở bằng cách quay đĩa, khóa cửa ổ đĩa (đối với phương tiện có thể tháo rời - removable media), v.v. Nếu bạn khóa phương tiện vào thiết bị, bạn chắc chắn nên mở khóa nó trong phương thức *release*.

```
int (*ioctl)(struct inode *inode, struct file *filp, unsigned int cmd,
 unsigned long arg);
```

Phương thức thực hiện System Call (Hệ thống gọi) *ioctl*. Tuy nhiên, tầng khối (block layer) trước tiên sẽ chặn một số lượng lớn các yêu cầu chuẩn; vì vậy phần lớn các phương thức *ioctl* của block driver khá ngắn gọn.

```
int (*media_changed) (struct gendisk *gd);
```

Phương thức được kernel (Nhân) gọi để kiểm tra xem người dùng đã thay đổi phương tiện trong ổ đĩa hay chưa, trả về một giá trị khác 0 nếu có. Rõ ràng, phương thức này chỉ áp dụng cho các ổ đĩa hỗ trợ phương tiện có thể tháo rời (và đủ thông minh để cung cấp cờ "media changed" cho driver); nó có thể được bỏ qua trong các trường hợp khác.

Đối số `struct gendisk` là cách kernel đại diện cho một đĩa đơn lẻ; chúng ta sẽ tìm hiểu cấu trúc đó trong phần tiếp theo.

```
int (*revalidate_disk) (struct gendisk *gd);
```

Phương thức *revalidate_disk* được gọi để phản hồi lại việc thay đổi phương tiện; nó cho phép driver thực hiện bất kỳ công việc nào cần thiết để làm cho phương tiện mới sẵn sàng sử dụng. Hàm trả về một giá trị kiểu `int`, nhưng giá trị đó bị kernel bỏ qua.

```
struct module *owner;
```

Con trỏ trỏ đến module sở hữu cấu trúc này; nó thường nên được khởi tạo là `THIS_MODULE`.

Những độc giả chú ý có thể nhận thấy một sự thiếu sót thú vị trong danh sách này: không có hàm nào thực sự đọc hoặc ghi dữ liệu. Trong hệ thống con I/O khối (block I/O subsystem), các thao tác này được xử lý bởi hàm `request`, một hàm rất quan trọng, xứng đáng có một phần riêng và sẽ được thảo luận sau trong chương này. Trước khi chúng ta có thể nói về việc xử lý các yêu cầu (request), chúng ta phải hoàn thành phần thảo luận về việc đăng ký đĩa (disk registration).

#### Cấu trúc gendisk

`struct gendisk` (được khai báo trong *<linux/genhd.h>*) là cách thể hiện của kernel đối với một thiết bị đĩa riêng lẻ. Trên thực tế, kernel cũng sử dụng cấu trúc `gendisk` để đại diện cho các phân vùng (partition), nhưng các nhà phát triển driver không cần phải bận tâm về điều đó. Có một số trường trong `struct gendisk` phải được khởi tạo bởi một block driver:

```
int major;
int first_minor;
int minors;
```

Các trường mô tả số thiết bị (device number) được sử dụng bởi đĩa. Tối thiểu, một ổ đĩa phải sử dụng ít nhất một số phụ (minor number). Tuy nhiên, nếu ổ đĩa của bạn có thể phân vùng được (và hầu hết các ổ đĩa nên như vậy), bạn sẽ muốn cấp phát một minor number cho mỗi phân vùng có thể xảy ra. Giá trị phổ biến cho `minors` là 16, cho phép có thiết bị "nguyên đĩa" (full disk) và 15 phân vùng. Một số disk driver sử dụng 64 minor number cho mỗi thiết bị.

```
char disk_name[32];
```

Trường nên được đặt thành tên của thiết bị đĩa. Nó xuất hiện trong */proc/partitions* và sysfs.

```
struct block_device_operations *fops;
```

Tập hợp các thao tác thiết bị từ phần trước.

```
struct request_queue *queue;
```

Cấu trúc được kernel sử dụng để quản lý các yêu cầu I/O cho thiết bị này; chúng ta sẽ kiểm tra nó trong phần "Xử lý yêu cầu" (Request Processing).

```
int flags;
```

Tập hợp các cờ (ít được sử dụng) mô tả trạng thái của ổ đĩa. Nếu thiết bị của bạn có phương tiện có thể tháo rời, bạn nên đặt cờ `GENHD_FL_REMOVABLE`. Các ổ đĩa CD-ROM có thể đặt cờ `GENHD_FL_CD`. Nếu vì lý do nào đó, bạn không muốn thông tin phân vùng hiển thị trong */proc/partitions*, hãy đặt cờ `GENHD_FL_SUPPRESS_PARTITION_INFO`.

```
sector_t capacity;
```

Dung lượng của ổ đĩa này, tính theo các sector 512 byte. Kiểu `sector_t` có thể có độ rộng 64 bit. Các driver không nên gán trực tiếp cho trường này; thay vào đó, hãy truyền số lượng sector vào hàm *set_capacity*.

```
void *private_data;
```

Block driver có thể sử dụng trường này cho một con trỏ trỏ đến dữ liệu nội bộ của riêng chúng.

Kernel cung cấp một tập hợp nhỏ các hàm để làm việc với các cấu trúc `gendisk`. Chúng ta giới thiệu chúng ở đây, sau đó xem cách *sbull* sử dụng chúng để cung cấp các thiết bị đĩa của nó cho hệ thống.

`struct gendisk` là một cấu trúc được cấp phát động (dynamically allocated) đòi hỏi sự can thiệp đặc biệt của kernel để được khởi tạo; các driver không thể tự mình cấp phát cấu trúc này. Thay vào đó, bạn phải gọi:

```
struct gendisk *alloc_disk(int minors);
```

Đối số `minors` phải là số lượng minor number mà đĩa này sử dụng; lưu ý rằng bạn không thể thay đổi trường `minors` sau đó và mong đợi mọi thứ hoạt động bình thường.

Khi một ổ đĩa (disk) không còn cần thiết nữa, nó nên được giải phóng bằng hàm:

```
void del_gendisk(struct gendisk *gd);
```

Một `gendisk` là một cấu trúc được quản lý tham chiếu (reference-counted) (nó chứa một `kobject`). Có các hàm *get\_disk* và *put\_disk* sẵn có để thao tác với bộ đếm tham chiếu (reference count), nhưng các trình điều khiển (drivers) thường không bao giờ cần phải làm điều đó. Thông thường, lời gọi đến *del\_gendisk* sẽ xóa tham chiếu cuối cùng đến `gendisk`, nhưng không có sự đảm bảo nào cho điều đó. Do đó, cấu trúc này có thể vẫn tiếp tục tồn tại (và các phương thức của bạn có thể vẫn được gọi) sau một lời gọi *del\_gendisk*. Tuy nhiên, nếu bạn xóa cấu trúc khi không còn người dùng nào (nghĩa là sau hàm *release* cuối cùng hoặc trong hàm dọn dẹp module *cleanup* của bạn), bạn có thể chắc chắn rằng nó sẽ không còn xuất hiện trở lại nữa.

Việc cấp phát một cấu trúc `gendisk` không làm cho ổ đĩa khả dụng với hệ thống. Để làm được điều đó, bạn phải khởi tạo cấu trúc và gọi *add\_disk*:

```
void add_disk(struct gendisk *gd);
```

Hãy ghi nhớ một điều quan trọng sau đây: ngay khi bạn gọi *add\_disk*, ổ đĩa sẽ "sống" (live) và các phương thức của nó có thể được gọi bất cứ lúc nào. Trên thực tế, những lời gọi đầu tiên như vậy có thể sẽ diễn ra ngay cả trước khi *add\_disk* trả về; kernel sẽ đọc một vài block đầu tiên nhằm mục đích tìm bảng phân vùng (partition table). Vì vậy, bạn không nên gọi *add\_disk* cho đến khi trình điều khiển (driver) của bạn được khởi tạo hoàn toàn và sẵn sàng phản hồi các yêu cầu (requests) trên ổ đĩa đó.

## Khởi tạo trong sbull

Đã đến lúc đi vào một số ví dụ thực tế. Trình điều khiển *sbull* (có sẵn trên trang FTP của O'Reilly cùng với phần mã nguồn ví dụ còn lại) triển khai một tập hợp các ổ đĩa ảo lưu trú trên bộ nhớ (in-memory virtual disk drives). Đối với mỗi ổ đĩa, *sbull* cấp phát (bằng hàm *vmalloc*, để đơn giản hóa) một mảng bộ nhớ; sau đó nó làm cho mảng đó có thể truy cập được thông qua các thao tác khối (block operations). Trình điều khiển *sbull* có thể được kiểm thử bằng cách phân vùng thiết bị ảo, xây dựng các hệ thống tập tin (filesystems) trên đó, và gắn kết (mount) nó vào hệ thống phân cấp của hệ thống.

Giống như các trình điều khiển ví dụ khác của chúng tôi, *sbull* cho phép chỉ định số major (major number) tại thời điểm biên dịch hoặc lúc tải module. Nếu không có số major nào được chỉ định, một số sẽ được cấp phát động. Vì lời gọi *register\_blkdev* là bắt buộc đối nên cho việc cấp phát động, *sbull* thực hiện việc đó:

```
sbull_major = register_blkdev(sbull_major, "sbull");
if (sbull_major <= 0) {
```

**468 | Chương 16: Trình điều khiển Khối (Block Drivers)**

```
 printk(KERN_WARNING "sbull: không thể lấy số major\n");
 return -EBUSY;
 }
```

Ngoài ra, giống như các thiết bị ảo khác mà chúng tôi đã trình bày trong cuốn sách này, thiết bị *sbull* được mô tả bởi một cấu trúc nội bộ:

```
struct sbull_dev {
 int size; /* Kích thước thiết bị tính bằng sector */
 u8 *data; /* Mảng dữ liệu */
 short users; /* Số lượng người dùng */
 short media_change; /* Cờ báo thay đổi phương tiện? */
 spinlock_t lock; /* Dùng để loại trừ lẫn nhau (mutual exclusion) */
 struct request_queue *queue; /* Hàng đợi yêu cầu (request queue) của thiết bị */
 struct gendisk *gd; /* Cấu trúc gendisk */
 struct timer_list timer; /* Dùng để mô phỏng thay đổi phương tiện */
};
```

Cần có một số bước để khởi tạo cấu trúc này và làm cho thiết bị liên quan khả dụng với hệ thống. Chúng ta bắt đầu với việc khởi tạo cơ bản và cấp phát bộ nhớ nền tảng:

```
memset (dev, 0, sizeof (struct sbull_dev));
dev->size = nsectors*hardsect_size;
dev->data = vmalloc(dev->size);
if (dev->data = = NULL) {
 printk (KERN_NOTICE "vmalloc thất bại.\n");
 return;
}
spin_lock_init(&dev->lock);
```

Việc cấp phát và khởi tạo một khóa quay (spinlock) trước bước tiếp theo là rất quan trọng, bước tiếp theo đó chính là cấp phát hàng đợi yêu cầu (request queue). Chúng ta sẽ xem xét quá trình này chi tiết hơn khi đến phần xử lý yêu cầu (request processing); hiện tại, chỉ cần biết rằng lời gọi cần thiết là:

```
dev->queue = blk_init_queue(sbull_request, &dev->lock);
```

Ở đây, *sbull\_request* là hàm yêu cầu (*request* function) của chúng ta—hàm thực sự thực hiện các yêu cầu đọc và ghi khối (block read and write requests). Khi chúng ta cấp phát một hàng đợi yêu cầu, chúng ta phải cung cấp một spinlock điều khiển quyền truy cập vào hàng đợi đó. Khóa này được cung cấp bởi trình điều khiển thay vì các thành phần chung của kernel bởi vì, thường thì, hàng đợi yêu cầu và các cấu trúc dữ liệu khác của trình điều khiển nằm trong cùng một vùng găng (critical section); chúng có xu hướng được truy cập cùng nhau. Giống như bất kỳ hàm nào cấp phát bộ nhớ, *blk\_init\_queue* có thể thất bại, vì vậy bạn phải kiểm tra giá trị trả về trước khi tiếp tục.

Một khi chúng ta đã có bộ nhớ thiết bị và hàng đợi yêu cầu sẵn sàng, chúng ta có thể cấp phát, khởi tạo và cài đặt cấu trúc `gendisk` tương ứng. Đoạn mã thực hiện công việc này là:

```
dev->gd = alloc_disk(SBULL_MINORS);
if (! dev->gd) {
 printk (KERN_NOTICE "alloc_disk thất bại\n");
 goto out_vfree;
}
dev->gd->major = sbull_major;
```

```
dev->gd->first_minor = which*SBULL_MINORS;
dev->gd->fops = &sbull_ops;
dev->gd->queue = dev->queue;
dev->gd->private_data = dev;
snprintf (dev->gd->disk_name, 32, "sbull%c", which + 'a');
set_capacity(dev->gd, nsectors*(hardsect_size/KERNEL_SECTOR_SIZE));
add_disk(dev->gd);
```

Ở đây, `SBULL_MINORS` là số lượng số minor (minor numbers) mà mỗi thiết bị *sbull* hỗ trợ. Khi chúng ta thiết lập số minor đầu tiên cho mỗi thiết bị, chúng ta phải tính toán tất cả các số đã bị chiếm dụng bởi các thiết bị trước đó. Tên của ổ đĩa được thiết lập sao cho ổ đĩa đầu tiên là *sbulla*, ổ đĩa thứ hai là *sbullb*, cứ như vậy. Không gian người dùng (User space) sau đó có thể thêm các số phân vùng (partition numbers) để phân vùng thứ ba trên thiết bị thứ hai có thể là */dev/sbullb3*.

Khi mọi thứ đã được thiết lập xong, chúng ta kết thúc bằng một lời gọi đến `add_disk`. Rất có thể một số phương thức của chúng ta sẽ được gọi cho đĩa đó vào thời điểm `add_disk` trả về, vì vậy chúng ta cần cẩn thận thực hiện lời gọi đó làm bước cuối cùng trong quá trình khởi tạo thiết bị của mình.

## Một lưu ý về Kích thước Sector (Sector Sizes)

Như chúng ta đã đề cập trước đây, kernel coi mọi ổ đĩa (disk) là một mảng tuyến tính gồm các sector 512 byte. Tuy nhiên, không phải tất cả phần cứng đều sử dụng kích thước sector đó. Việc làm cho một thiết bị có kích thước sector khác hoạt động không quá khó; đó chỉ là vấn đề xử lý một vài chi tiết. Thiết bị *sbull* xuất ra một tham số `hardsect_size` có thể được sử dụng để thay đổi kích thước sector "phần cứng" của thiết bị; bằng cách nhìn vào phần cài đặt của nó, bạn có thể thấy cách thêm hỗ trợ loại này cho các trình điều khiển (driver) của riêng bạn.

Chi tiết đầu tiên trong số đó là thông báo cho kernel về kích thước sector mà thiết bị của bạn hỗ trợ. Kích thước sector phần cứng là một tham số nằm trong hàng đợi yêu cầu (request queue), thay vì trong cấu trúc `gendisk`. Kích thước này được thiết lập bằng một lời gọi đến `blk_queue_hardsect_size` ngay sau khi hàng đợi được phân bổ (allocate):

```c
blk_queue_hardsect_size(dev->queue, hardsect_size);
```

Khi điều đó hoàn tất, kernel sẽ tuân theo kích thước sector phần cứng của thiết bị bạn. Tất cả các yêu cầu I/O (I/O requests) đều được căn chỉnh (align) đúng cách ở phần đầu của một sector phần cứng và độ dài của mỗi yêu cầu là một số nguyên lần của sector. Tuy nhiên, bạn phải nhớ rằng kernel luôn thể hiện mọi thứ bằng các sector 512 byte; do đó, cần phải dịch tất cả các số hiệu sector cho phù hợp. Vì vậy, ví dụ, khi *sbull* thiết lập dung lượng (capacity) của thiết bị trong cấu trúc `gendisk` của nó, lời gọi sẽ trông như sau:

```c
set_capacity(dev->gd, nsectors*(hardsect_size/KERNEL_SECTOR_SIZE));
```

`KERNEL_SECTOR_SIZE` là một hằng số được định nghĩa cục bộ mà chúng ta sử dụng để quy đổi giữa các sector 512 byte của kernel và bất kỳ kích thước nào mà chúng ta đã được yêu cầu sử dụng. Loại tính toán này xuất hiện thường xuyên khi chúng ta xem xét logic xử lý yêu cầu của *sbull*.

## Các Thao tác Thiết bị Khối (Block Device Operations)

Chúng ta đã có một phần giới thiệu ngắn gọn về cấu trúc `block_device_operations` ở phần trước. Bây giờ chúng ta dành chút thời gian để xem xét các thao tác này chi tiết hơn một chút trước khi đi vào xử lý yêu cầu. Để làm được điều đó, đã đến lúc đề cập đến một tính năng khác của trình điều khiển *sbull*: nó đóng vai trò là một thiết bị có thể tháo rời (removable device). Bất cứ khi nào người dùng cuối cùng đóng (close) thiết bị, một bộ hẹn giờ (timer) 30 giây được thiết lập; nếu thiết bị không được mở trong thời gian đó, nội dung của thiết bị sẽ bị xóa và kernel sẽ được thông báo rằng phương tiện lưu trữ (media) đã bị thay đổi. Thời gian trễ 30 giây giúp người dùng có thời gian, ví dụ, mount một thiết bị *sbull* sau khi tạo hệ thống tệp (filesystem) trên đó.

## Các phương thức open và release

Để cài đặt tính năng giả lập tháo rời phương tiện, *sbull* phải biết khi nào người dùng cuối cùng đã đóng thiết bị. Việc đếm số lượng người dùng được duy trì bởi trình điều khiển. Công việc của các phương thức `open` và `close` là giữ cho số đếm đó luôn cập nhật.

Phương thức `open` trông rất giống với phương thức tương đương của trình điều khiển ký tự (char-driver); nó nhận các con trỏ cấu trúc `inode` và `file` có liên quan làm đối số. Khi một `inode` trỏ đến một thiết bị khối (block device), trường `i_bdev->bd_disk` chứa một con trỏ đến cấu trúc `gendisk` liên kết; con trỏ này có thể được sử dụng để truy cập vào các cấu trúc dữ liệu nội bộ của trình điều khiển cho thiết bị. Trên thực tế, đó là việc đầu tiên mà phương thức *sbull open* thực hiện:

```c
static int sbull_open(struct inode *inode, struct file *filp)
{
 struct sbull_dev *dev = inode->i_bdev->bd_disk->private_data;
 del_timer_sync(&dev->timer);
 filp->private_data = dev;
 spin_lock(&dev->lock);
 if (! dev->users)
 check_disk_change(inode->i_bdev);
 dev->users++;
 spin_unlock(&dev->lock);
 return 0;
}
```

Khi *sbull_open* đã có con trỏ cấu trúc thiết bị của mình, nó gọi `del_timer_sync` để xóa bộ hẹn giờ "tháo rời phương tiện", nếu có bộ hẹn giờ nào đang hoạt động. Lưu ý rằng chúng ta không khóa spinlock của thiết bị cho đến sau khi bộ hẹn giờ đã được xóa; nếu làm khác đi sẽ dẫn đến tình trạng bế tắc (deadlock) nếu hàm xử lý timer chạy trước khi chúng ta có thể xóa nó. Khi thiết bị đã được khóa, chúng ta gọi một hàm kernel có tên là `check_disk_change` để kiểm tra xem việc thay đổi phương tiện có xảy ra hay không. Người ta có thể tranh luận rằng kernel nên thực hiện lời gọi đó, nhưng mô hình tiêu chuẩn là các trình điều khiển tự xử lý nó tại thời điểm `open`.

Bước cuối cùng là tăng số lượng người dùng và trả về.

**Các Thao tác Thiết bị Khối | 471**

Ngược lại, nhiệm vụ của phương thức `release` là giảm số lượng người dùng và, nếu được chỉ định, khởi động bộ hẹn giờ tháo rời phương tiện:

```c
static int sbull_release(struct inode *inode, struct file *filp)
{
 struct sbull_dev *dev = inode->i_bdev->bd_disk->private_data;
 spin_lock(&dev->lock);
 dev->users--;
 if (!dev->users) {
 dev->timer.expires = jiffies + INVALIDATE_DELAY;
 add_timer(&dev->timer);
 }
 spin_unlock(&dev->lock);
 return 0;
}
```

Trong một trình điều khiển xử lý một thiết bị phần cứng thực tế, các phương thức `open` và `release` sẽ thiết lập trạng thái của trình điều khiển và phần cứng cho phù hợp. Công việc này có thể bao gồm việc quay đĩa lên hoặc xuống (spin up/down), khóa cửa của thiết bị tháo rời, phân bổ bộ đệm DMA (DMA buffers), v.v.

Bạn có thể đang tự hỏi ai thực sự là người mở một thiết bị khối (block device). Có một số thao tác khiến một thiết bị khối bị mở trực tiếp từ không gian người dùng (user space); các thao tác này bao gồm phân vùng đĩa (partitioning a disk), xây dựng hệ thống tập tin (filesystem) trên một phân vùng, hoặc chạy chương trình kiểm tra hệ thống tập tin (filesystem checker). Một trình điều khiển khối (block driver) cũng nhận được lời gọi *open* khi một phân vùng được gắn kết (mount). Trong trường hợp này, không có tiến trình (process) ở không gian người dùng nào nắm giữ một file descriptor (mô tả tệp) đang mở cho thiết bị; thay vào đó, tệp đang mở được nắm giữ bởi chính kernel. Trình điều khiển khối không thể phân biệt được sự khác biệt giữa thao tác *mount* (thao tác mở thiết bị từ không gian kernel - kernel space) và việc thực thi một tiện ích như *mkfs* (thao tác mở thiết bị từ không gian người dùng).

## Hỗ trợ phương tiện tháo lắp (Removable Media)

Cấu trúc `block_device_operations` bao gồm hai phương thức để hỗ trợ các phương tiện tháo lắp (removable media). Nếu bạn đang viết một trình điều khiển cho một thiết bị không thể tháo rời, bạn có thể bỏ qua các phương thức này một cách an toàn. Việc cài đặt chúng tương đối đơn giản.

Phương thức *media_changed* được gọi (từ `check_disk_change`) để xem phương tiện đã bị thay đổi hay chưa; nó phải trả về một giá trị khác không nếu điều này đã xảy ra. Việc cài đặt trong *sbull* rất đơn giản; nó truy vấn một cờ (flag) được thiết lập nếu bộ hẹn giờ tháo gỡ phương tiện đã hết hạn:

```c
int sbull_media_changed(struct gendisk *gd)
{
 struct sbull_dev *dev = gd->private_data;
 return dev->media_change;
}
```

Phương thức *revalidate* được gọi sau khi thay đổi phương tiện; công việc của nó là thực hiện bất kỳ điều gì cần thiết để chuẩn bị cho trình điều khiển thực hiện các thao tác trên phương tiện mới, nếu có. Sau lời gọi *revalidate*, kernel cố gắng đọc lại bảng phân vùng (partition table) và khởi động lại với thiết bị. Việc cài đặt trong *sbull* đơn giản là đặt lại cờ `media_change` và xóa sạch bộ nhớ thiết bị để mô phỏng việc lắp một đĩa trống.

```c
int sbull_revalidate(struct gendisk *gd)
{
 struct sbull_dev *dev = gd->private_data;
 if (dev->media_change) {
 dev->media_change = 0;
 memset (dev->data, 0, dev->size);
 }
 return 0;
}
```

## Phương thức ioctl

Các thiết bị khối có thể cung cấp một phương thức *ioctl* để thực hiện các chức năng điều khiển thiết bị. Tuy nhiên, mã hệ thống con khối (block subsystem) ở cấp cao hơn sẽ chặn một số lượng lệnh *ioctl* trước khi trình điều khiển của bạn kịp nhìn thấy chúng (xem `drivers/block/ioctl.c` trong mã nguồn kernel để biết toàn bộ tập lệnh). Trên thực tế, một trình điều khiển khối hiện đại có thể không cần phải cài đặt quá nhiều lệnh *ioctl*.

Phương thức *sbull ioctl* chỉ xử lý một lệnh duy nhất—một yêu cầu về hình học (geometry) của thiết bị:

```c
int sbull_ioctl (struct inode *inode, struct file *filp,
 unsigned int cmd, unsigned long arg)
{
 long size;
 struct hd_geometry geo;
 struct sbull_dev *dev = filp->private_data;
 switch(cmd) {
 case HDIO_GETGEO:
 /*
 * Lấy hình học: vì chúng ta là một thiết bị ảo, chúng ta phải bịa ra
 * một cái gì đó hợp lý. Vì vậy, chúng ta tuyên bố 16 cung, bốn đầu đọc,
 * và tính toán số lượng trụ (cylinder) tương ứng. Chúng ta đặt
 * điểm bắt đầu dữ liệu ở cung thứ bốn.
 */
 size = dev->size*(hardsect_size/KERNEL_SECTOR_SIZE);
 geo.cylinders = (size & ~0x3f) >> 6;
 geo.heads = 4;
 geo.sectors = 16;
 geo.start = 4;
 if (copy_to_user((void __user *) arg, &geo, sizeof(geo)))
 return -EFAULT;
```

```c
 return 0;
 }
 return -ENOTTY; /* lệnh không xác định */
}
```

Việc cung cấp thông tin hình học có vẻ là một nhiệm vụ kỳ lạ, vì thiết bị của chúng ta hoàn toàn là ảo và không có gì liên quan đến các rãnh (track) và trụ (cylinder). Ngay cả phần lớn phần cứng thiết bị khối thực tế cũng đã được trang bị các cấu trúc phức tạp hơn nhiều từ nhiều năm trước. Kernel không quan tâm đến hình học của một thiết bị khối; nó coi thiết bị đơn giản là một mảng tuyến tính các cung (sectors). Tuy nhiên, có một số tiện ích ở không gian người dùng vẫn mong đợi có thể truy vấn hình học của đĩa. Cụ thể, công cụ *fdisk*, dùng để chỉnh sửa bảng phân vùng, phụ thuộc vào thông tin trụ và sẽ không hoạt động bình thường nếu thông tin đó không có sẵn.

Chúng ta muốn thiết bị *sbull* có thể phân vùng được, ngay cả với các công cụ cũ, đơn giản. Vì vậy, chúng ta đã cung cấp một phương thức *ioctl* tạo ra một giả định đáng tin cậy về hình học có thể khớp với dung lượng của thiết bị chúng ta. Hầu hết các trình điều khiển đĩa đều làm điều gì đó tương tự. Lưu ý rằng, như thường lệ, số lượng cung được dịch chuyển, nếu cần thiết, để khớp với quy ước 512 byte được sử dụng bởi kernel.

## Xử lý Yêu cầu (Request Processing)

Trọng tâm của mọi trình điều khiển khối là hàm *request* của nó. Hàm này là nơi công việc thực sự được thực hiện—hoặc ít nhất là được bắt đầu; tất cả những phần còn lại là chi phí chung (overhead). Do đó, chúng ta dành một lượng thời gian đáng kể để xem xét việc xử lý yêu cầu trong các trình điều khiển khối.

Hiệu năng của một trình điều khiển đĩa có thể là một phần quan trọng đối với hiệu năng của toàn bộ hệ thống. Do đó, hệ thống con khối của kernel được viết với việc tối ưu hiệu năng được đặt lên hàng đầu; nó làm mọi thứ có thể để cho phép trình điều khiển của bạn tận dụng tối đa các thiết bị mà nó điều khiển. Đây là một điều tốt, ở chỗ nó cho phép I/O nhanh đến chóng mặt. Mặt khác, hệ thống con khối lại phơi bày một cách bất đắc dĩ sự phức tạp rất lớn trong API của trình điều khiển. Bạn hoàn toàn có thể viết một hàm *request* rất đơn giản (chúng ta sẽ thấy một hàm như vậy ngay sau đây), nhưng nếu trình điều khiển của bạn phải hoạt động ở mức độ cao trên phần cứng phức tạp, nó sẽ chẳng đơn giản chút nào.

## Giới thiệu về phương thức request

Phương thức *request* của block driver có nguyên mẫu (prototype) như sau:

```c
void request(request_queue_t *queue);
```

Hàm này được gọi bất cứ khi nào kernel cho rằng đã đến lúc driver của bạn xử lý các thao tác đọc, ghi hoặc các thao tác khác trên thiết bị. Hàm *request* không nhất thiết phải hoàn thành toàn bộ các yêu cầu trên hàng đợi (queue) trước khi trả về (return); trên thực tế, đối với hầu hết các thiết bị thực tế, nó có thể không hoàn thành yêu cầu nào trong số đó ngay lập tức. Tuy nhiên, nó bắt buộc phải khởi động các yêu cầu đó và đảm bảo rằng tất cả cuối cùng sẽ được driver xử lý.

Mỗi thiết bị đều có một hàng đợi yêu cầu (request queue). Điều này là do các hoạt động truyền tải dữ liệu thực tế đến và đi từ ổ đĩa có thể diễn ra vào thời điểm hoàn toàn khác biệt so với lúc kernel yêu cầu, và vì kernel cần sự linh hoạt để lên lịch (schedule) cho mỗi lần truyền tại thời điểm thuận lợi nhất (ví dụ: nhóm các yêu cầu tác động đến các sector nằm gần nhau trên ổ đĩa lại với nhau). Và như bạn có thể nhớ, hàm *request* được liên kết với một request queue khi queue đó được tạo ra. Hãy nhìn lại cách *sbull* tạo queue của nó:

```c
dev->queue = blk_init_queue(sbull_request, &dev->lock);
```

Do đó, khi hàng đợi được tạo, hàm *request* được liên kết với nó. Chúng ta cũng cung cấp một spinlock như một phần của quá trình tạo hàng đợi. Bất cứ khi nào hàm *request* của chúng ta được gọi, khóa đó sẽ được giữ bởi kernel. Kết quả là, hàm *request* đang chạy trong một ngữ cảnh nguyên tử (atomic context); nó phải tuân thủ tất cả các quy tắc thông thường đối với mã nguyên tử (atomic code) đã được thảo luận trong Chương 5.

Khóa của hàng đợi (queue lock) cũng ngăn không cho kernel xếp hàng (queue) bất kỳ yêu cầu nào khác cho thiết bị của bạn trong khi hàm *request* đang giữ khóa. Trong một số điều kiện, bạn có thể muốn cân nhắc việc nhả khóa (dropping the lock) này trong khi hàm *request* đang chạy. Tuy nhiên, nếu bạn làm như vậy, bạn phải đảm bảo không truy cập vào request queue, hoặc bất kỳ cấu trúc dữ liệu nào khác được bảo vệ bởi khóa, trong khoảng thời gian khóa không được giữ. Bạn cũng phải lấy lại khóa (reacquire the lock) trước khi hàm *request* trả về.

Cuối cùng, việc gọi hàm *request* (thường là) hoàn toàn bất đồng bộ (asynchronous) đối với các hành động của bất kỳ tiến trình không gian người dùng (user-space process) nào. Bạn không thể giả định rằng kernel đang chạy trong ngữ cảnh của tiến trình đã khởi tạo yêu cầu hiện tại. Bạn cũng không biết liệu bộ đệm I/O (I/O buffer) do yêu cầu cung cấp nằm trong kernel space hay user space. Vì vậy, bất kỳ loại thao tác nào truy cập trực tiếp vào user space đều là sai lầm và chắc chắn sẽ dẫn đến rắc rối. Như bạn sẽ thấy, mọi thứ mà driver của bạn cần biết về yêu cầu đều được chứa bên trong các cấu trúc dữ liệu được truyền cho bạn thông qua request queue.

## Một phương thức request đơn giản

Driver mẫu *sbull* cung cấp một vài phương thức khác nhau để xử lý yêu cầu. Theo mặc định, *sbull* sử dụng một phương thức gọi là *sbull_request*, nhằm mục đích làm ví dụ về phương thức *request* đơn giản nhất có thể. Không dài dòng thêm nữa, đây là mã nguồn:

```c
static void sbull_request(request_queue_t *q)
{
 struct request *req;
 while ((req = elv_next_request(q)) != NULL) {
 struct sbull_dev *dev = req->rq_disk->private_data;
 if (! blk_fs_request(req)) {
```

```c
 printk (KERN_NOTICE "Skip non-fs request\n");
 end_request(req, 0);
 continue;
 }
 sbull_transfer(dev, req->sector, req->current_nr_sectors,
 req->buffer, rq_data_dir(req));
 end_request(req, 1);
 }
}
```

Hàm này giới thiệu cấu trúc `struct request`. Chúng ta sẽ tìm hiểu rất chi tiết về `struct request` sau; hiện tại, chỉ cần biết rằng nó đại diện cho một yêu cầu I/O khối (block I/O request) để chúng ta thực thi.

Kernel cung cấp hàm *elv_next_request* để lấy yêu cầu chưa hoàn thành đầu tiên trên hàng đợi; hàm này trả về `NULL` khi không còn yêu cầu nào cần xử lý. Lưu ý rằng *elv_next_request* không loại bỏ yêu cầu khỏi hàng đợi. Nếu bạn gọi nó hai lần mà không có thao tác can thiệp nào ở giữa, nó sẽ trả về cùng một cấu trúc request trong cả hai lần. Ở chế độ hoạt động đơn giản này, các yêu cầu chỉ được lấy ra khỏi hàng đợi khi chúng đã hoàn thành.

Một block request queue có thể chứa các yêu cầu thực tế không di chuyển các khối dữ liệu đến và đi từ ổ đĩa. Các yêu cầu như vậy có thể bao gồm các thao tác chẩn đoán cấp thấp, dành riêng cho nhà vendor, hoặc các lệnh liên quan đến các chế độ thiết bị chuyên biệt, chẳng hạn như chế độ ghi gói (packet writing mode) cho các phương tiện có thể ghi (recordable media). Hầu hết các block driver không biết cách xử lý các yêu cầu như vậy và sẽ trả về thất bại; *sbull* cũng hoạt động theo cách này. Lời gọi đến *block_fs_request* cho chúng ta biết liệu chúng ta có đang xử lý một yêu cầu hệ thống tập tin (filesystem request) hay không — loại yêu cầu di chuyển các khối dữ liệu. Nếu một yêu cầu không phải là yêu cầu hệ thống tập tin, chúng ta sẽ chuyển nó cho *end_request*:

```c
void end_request(struct request *req, int succeeded);
```

Khi chúng ta xử lý các yêu cầu không phải hệ thống tập tin, chúng ta truyền tham số `succeeded` là `0` để chỉ ra rằng chúng ta đã không hoàn thành yêu cầu một cách thành công. Ngược lại, chúng ta gọi *sbull_transfer* để thực hiện việc di chuyển dữ liệu thực tế, sử dụng một tập hợp các trường (fields) được cung cấp trong cấu trúc request:

```c
sector_t sector;
```

Chỉ số của sector bắt đầu trên thiết bị của chúng ta. Hãy nhớ rằng số sector này, giống như tất cả các số tương tự được truyền giữa Linux Kernel (nhân Linux) và driver (trình điều khiển), đều được thể hiện bằng các sector 512-byte. Nếu phần cứng của bạn sử dụng kích thước sector khác, bạn cần điều chỉnh tỷ lệ (scale) sector cho phù hợp. Ví dụ, nếu phần cứng sử dụng sector 2048-byte, bạn cần chia số sector bắt đầu cho bốn trước khi đưa nó vào một request (yêu cầu) cho phần cứng.

```
unsigned long nr_sectors;
```

Số lượng sector (512-byte) cần được truyền (transfer).

```c
char *buffer;
```

Con trỏ trỏ đến buffer (vùng đệm) nơi dữ liệu được truyền đến hoặc truyền đi. Con trỏ này là một địa chỉ ảo của kernel (kernel virtual address) và driver có thể trực tiếp tham chiếu giải tham chiếu (dereference) nếu cần thiết.

```
rq_data_dir(struct request *req);
```

Macro này trích xuất hướng truyền dữ liệu từ request; giá trị trả về bằng 0 biểu thị một thao tác đọc từ thiết bị và giá trị trả về khác 0 biểu thị một thao tác ghi vào thiết bị.

Với thông tin này, driver *sbull* có thể triển khai việc truyền dữ liệu thực tế bằng một lời gọi *memcpy* đơn giản—xốt cho cùng, dữ liệu của chúng ta đã nằm sẵn trong bộ nhớ. Hàm thực hiện thao tác sao chép này (*sbull_transfer*) cũng xử lý việc điều chỉnh tỷ lệ kích thước sector và đảm bảo rằng chúng ta không cố gắng sao chép vượt quá giới hạn của thiết bị ảo:

```c
static void sbull_transfer(struct sbull_dev *dev, unsigned long sector,
 unsigned long nsect, char *buffer, int write)
{
 unsigned long offset = sector*KERNEL_SECTOR_SIZE;
 unsigned long nbytes = nsect*KERNEL_SECTOR_SIZE;
 if ((offset + nbytes) > dev->size) {
 printk (KERN_NOTICE "Beyond-end write (%ld %ld)\n", offset, nbytes);
 return;
 }
 if (write)
 memcpy(dev->data + offset, buffer, nbytes);
 else
 memcpy(buffer, dev->data + offset, nbytes);
}
```

Với đoạn mã này, *sbull* triển khai một thiết bị đĩa dựa trên RAM (RAM-based disk device) hoàn chỉnh và đơn giản. Tuy nhiên, đây không phải là một driver thực tế cho nhiều loại thiết bị, vì một số lý do.

Lý do đầu tiên là *sbull* thực thi các request một cách đồng bộ (synchronously), từng cái một. Các thiết bị đĩa hiệu suất cao có khả năng xử lý nhiều request đồng thời; bộ điều khiển tích hợp trên đĩa (onboard controller) sau đó có thể chọn thực thi chúng theo thứ tự tối ưu (hy vọng là vậy). Miễn là chúng ta chỉ xử lý request đầu tiên trong hàng đợi (queue), chúng ta không bao giờ có thể có nhiều request được hoàn thành tại một thời điểm nhất định. Khả năng làm việc với nhiều hơn một request đòi hỏi sự hiểu biết sâu sắc hơn về các hàng đợi request và cấu trúc request; vài phần tiếp theo sẽ giúp xây dựng sự hiểu biết đó.

Tuy nhiên, có một vấn đề khác cần xem xét. Hiệu suất tốt nhất từ các thiết bị đĩa đạt được khi hệ thống thực hiện các thao tác truyền lớn liên quan đến nhiều sector nằm gần nhau trên đĩa. Chi phí lớn nhất trong một thao tác đĩa luôn là việc định vị đầu đọc và ghi (read and write heads); một khi quá trình đó hoàn tất, thời gian cần thiết để thực sự đọc hoặc ghi dữ liệu gần như không đáng kể. Các nhà phát triển thiết kế và triển khai hệ thống tập tin (filesystem) và phân hệ bộ nhớ ảo (virtual memory subsystem) hiểu được điều này, vì vậy họ cố gắng hết sức để đặt dữ liệu liên quan một cách liên tục (contiguously) trên đĩa và truyền càng nhiều sector càng tốt trong một request duy nhất. Phân hệ khối (block subsystem) cũng hỗ trợ về mặt này;

các hàng đợi request chứa đựng một lượng lớn logic nhằm mục đích tìm kiếm các request liền kề và gộp (coalesce) chúng thành các thao tác lớn hơn.

Tuy nhiên, driver *sbull* lại bỏ qua toàn bộ công sức đó. Chỉ có một buffer được truyền tại một thời điểm, có nghĩa là thao tác truyền đơn lớn nhất hầu như không bao giờ vượt quá kích thước của một trang (page) đơn lẻ. Một block driver (driver thiết bị khối) có thể làm tốt hơn thế rất nhiều, nhưng nó đòi hỏi sự hiểu biết sâu sắc hơn về các cấu trúc request và các cấu trúc bio mà từ đó các request được xây dựng.

Các phần tiếp theo sẽ đi sâu hơn vào cách block layer (lớp khối) thực hiện công việc của mình và các cấu trúc dữ liệu xuất phát từ công việc đó.

## Hàng đợi Request (Request Queues)

Theo nghĩa đơn giản nhất, một hàng đợi request khối chính xác là như vậy: một hàng đợi các request I/O khối (block I/O requests). Nếu bạn nhìn vào bên trong, hóa ra một hàng đợi request lại là một cấu trúc dữ liệu phức tạp đến bất ngờ. May mắn thay, các driver không cần phải lo lắng về phần lớn sự phức tạp đó.

Các hàng đợi request theo dõi các request I/O khối đang chờ xử lý (outstanding). Nhưng chúng cũng đóng một vai trò quan trọng trong việc tạo ra các request đó. Hàng đợi request lưu trữ các tham số mô tả loại request nào mà thiết bị có thể phục vụ: kích thước tối đa của chúng, bao nhiêu phân đoạn (segment) riêng biệt có thể đi vào một request, kích thước sector phần cứng, các yêu cầu căn chỉnh (alignment), v.v. Nếu hàng đợi request của bạn được cấu hình đúng cách, nó sẽ không bao giờ chuyển cho bạn một request mà thiết bị của bạn không thể xử lý.

Các hàng đợi request cũng triển khai một giao diện plug-in cho phép sử dụng nhiều *lập lịch I/O* (*I/O schedulers* - hoặc *thang máy* - *elevators*). Công việc của một bộ lập lịch I/O là trình bày các request I/O cho driver của bạn theo cách tối đa hóa hiệu suất. Để đạt được mục đích này, hầu hết các bộ lập lịch I/O tích lũy một loạt các request, sắp xếp chúng theo thứ tự chỉ số khối tăng dần (hoặc giảm dần), và trình bày các request cho driver theo thứ tự đó. Đầu đĩa, khi được cung cấp một danh sách các request đã được sắp xếp, sẽ di chuyển từ đầu này sang đầu kia của đĩa, giống như một chiếc thang máy đầy khách di chuyển theo một hướng duy nhất cho đến khi tất cả các "request" của nó (những người đang chờ xuống) đã được thỏa mãn. Kernel 2.6 bao gồm một "lập lịch hạn chót" (deadline scheduler), nỗ lực đảm bảo rằng mọi request được thỏa mãn trong một khoảng thời gian tối đa được thiết lập trước, và một "lập lịch dự đoán" (anticipatory scheduler), thực tế tạm dừng thiết bị một chút sau một request đọc với dự đoán rằng một request đọc liền kề khác sẽ đến gần như ngay lập tức. Tính đến thời điểm viết bài này, bộ lập lịch mặc định là lập lịch dự đoán, dường như mang lại hiệu suất hệ thống tương tác tốt nhất.

Bộ lập lịch I/O (I/O scheduler) cũng chịu trách nhiệm gộp các yêu cầu (request) liền kề lại với nhau. Khi một yêu cầu I/O mới được chuyển cho bộ lập lịch, nó sẽ tìm kiếm trong hàng đợi (queue) các yêu cầu liên quan đến các sector liền kề; nếu tìm thấy một yêu cầu như vậy và nếu yêu cầu kết quả không quá lớn, thì hai yêu cầu sẽ được gộp lại.

Hàng đợi yêu cầu (request queue) có kiểu `struct request_queue` hoặc `request_queue_t`. Kiểu dữ liệu này và nhiều hàm thao tác với nó được định nghĩa trong *<linux/blkdev.h>*. Nếu bạn quan tâm đến việc triển khai các hàng đợi yêu cầu, bạn có thể tìm thấy phần lớn mã nguồn trong *drivers/block/ll_rw_block.c* và *elevator.c*.

### Tạo và hủy hàng đợi (Queue creation and deletion)

Như chúng ta đã thấy trong mã nguồn ví dụ, hàng đợi yêu cầu là một cấu trúc dữ liệu động phải được tạo bởi hệ thống con I/O khối (block I/O subsystem). Hàm để tạo và khởi tạo một hàng đợi yêu cầu là:

```c
request_queue_t *blk_init_queue(request_fn_proc *request, spinlock_t *lock);
```

Các tham số, tất nhiên, là hàm *request* cho hàng đợi này và một khóa spinlock (`spinlock_t`) dùng để kiểm soát quyền truy cập vào hàng đợi. Hàm này cấp phát bộ nhớ (thực tế là khá nhiều bộ nhớ) và có thể thất bại vì lý do này; bạn nên luôn luôn kiểm tra giá trị trả về trước khi cố gắng sử dụng hàng đợi.

Như một phần trong quá trình khởi tạo hàng đợi yêu cầu, bạn có thể thiết lập trường `queuedata` (là một con trỏ kiểu `void *`) thành bất kỳ giá trị nào bạn muốn. Trường này tương đương với `private_data` mà chúng ta đã thấy ở các cấu trúc khác đối với hàng đợi yêu cầu.

Để trả lại hàng đợi yêu cầu cho hệ thống (thường là tại thời điểm gỡ module - module unload time), hãy gọi *blk_cleanup_queue*:

```c

void blk_cleanup_queue(request_queue_t *);

```

Sau lời gọi này, driver của bạn sẽ không nhận thêm yêu cầu nào từ hàng đợi đã cho nữa và không được tham chiếu lại nó.

#### Các hàm quản lý hàng đợi (Queueing functions)

Chỉ có một tập hợp rất nhỏ các hàm để thao tác với các yêu cầu trên hàng đợi—ít nhất là đối với các driver. Bạn phải giữ khóa hàng đợi (queue lock) trước khi gọi các hàm này.

Hàm trả về yêu cầu tiếp theo cần xử lý là *elv_next_request*:

```c

struct request *elv_next_request(request_queue_t *queue);

```

Chúng ta đã thấy hàm này trong ví dụ *sbull* đơn giản. Nó trả về một con trỏ trỏ đến yêu cầu tiếp theo cần xử lý (do bộ lập lịch I/O quyết định) hoặc `NULL` nếu không còn yêu cầu nào cần xử lý. *elv_next_request* giữ lại yêu cầu trên hàng đợi nhưng đánh dấu nó là đang hoạt động (active); đánh dấu này ngăn bộ lập lịch I/O cố gắng gộp các yêu cầu khác với yêu cầu này một khi bạn bắt đầu thực thi nó.

Để thực sự loại bỏ một yêu cầu khỏi hàng đợi, hãy sử dụng *blkdev_dequeue_request*:

```c

void blkdev_dequeue_request(struct request *req);

```

Nếu driver của bạn xử lý đồng thời nhiều yêu cầu từ cùng một hàng đợi, nó phải lấy ra khỏi hàng đợi (dequeue) theo cách này.

Nếu vì lý do nào đó mà bạn cần đưa một yêu cầu đã bị lấy ra khỏi hàng đợi quay trở lại hàng đợi, bạn có thể gọi:

```c

void elv_requeue_request(request_queue_t *queue, struct request *req);

```

#### Các hàm điều khiển hàng đợi (Queue control functions)

Tầng khối (block layer) cung cấp một tập hợp các hàm có thể được driver sử dụng để kiểm soát cách thức hoạt động của hàng đợi yêu cầu. Các hàm này bao gồm:

```c

void blk_stop_queue(request_queue_t *queue);
void blk_start_queue(request_queue_t *queue);

```

Nếu thiết bị của bạn đã đạt đến trạng thái không thể xử lý thêm lệnh nào đang chờ (outstanding command) nữa, bạn có thể gọi *blk_stop_queue* để thông báo cho tầng khối. Sau lời gọi này, hàm *request* của bạn sẽ không được gọi cho đến khi bạn gọi *blk_start_queue*. Không cần phải nói, bạn không nên quên khởi động lại hàng đợi khi thiết bị của bạn có khả năng xử lý thêm các yêu cầu. Khóa hàng đợi (queue lock) phải được giữ khi gọi một trong hai hàm này.

```c

void blk_queue_bounce_limit(request_queue_t *queue, u64 dma_addr);

```

Hàm thông báo cho kernel biết địa chỉ vật lý cao nhất mà thiết bị của bạn có thể thực hiện DMA. Nếu một yêu cầu đến có chứa tham chiếu đến vùng nhớ vượt quá giới hạn đó, một bộ đệm chuyển tiếp (bounce buffer) sẽ được sử dụng cho thao tác này; đây dĩ nhiên là một cách tốn kém để thực hiện I/O khối và nên tránh bất cứ khi nào có thể. Bạn có thể cung cấp bất kỳ địa chỉ vật lý hợp lý nào trong tham số này, hoặc sử dụng các ký hiệu được định nghĩa sẵn như `BLK_BOUNCE_HIGH` (sử dụng bounce buffer cho các trang bộ nhớ cao - high-memory pages), `BLK_BOUNCE_ISA` (driver chỉ có thể DMA vào vùng nhớ ISA 16-MB), hoặc `BLK_BOUNCE_ANY` (driver có thể thực hiện DMA đến bất kỳ địa chỉ nào). Giá trị mặc định là `BLK_BOUNCE_HIGH`.

```c

void blk_queue_max_sectors(request_queue_t *queue, unsigned short max);
void blk_queue_max_phys_segments(request_queue_t *queue, unsigned short max);
void blk_queue_max_hw_segments(request_queue_t *queue, unsigned short max);
void blk_queue_max_segment_size(request_queue_t *queue, unsigned int max);

```

Các hàm thiết lập các tham số mô tả các yêu cầu có thể được đáp ứng bởi thiết bị này. *blk_queue_max_sectors* có thể được sử dụng để thiết lập kích thước tối đa của bất kỳ yêu cầu nào tính theo các sector (512 byte); mặc định là 255. Cả *blk_queue_max_phys_segments* và *blk_queue_max_hw_segments* đều kiểm soát số lượng phân đoạn vật lý (các vùng không liền kề trong bộ nhớ hệ thống) có thể được chứa trong một yêu cầu duy nhất. Hãy sử dụng *blk_queue_max_phys_segments* để cho biết driver của bạn có thể xử lý bao nhiêu phân đoạn; ví dụ, đây có thể là kích thước của một danh sách phân tán (scatterlist) được cấp phát tĩnh. Ngược lại, *blk_queue_max_hw_segments* là số lượng phân đoạn tối đa mà chính thiết bị có thể xử lý. Cả hai tham số này có giá trị mặc định là 128. Cuối cùng, *blk_queue_max_segment_size* cho kernel biết kích thước của bất kỳ phân đoạn riêng lẻ nào trong một yêu cầu có thể lớn đến mức nào tính theo byte; mặc định là 65.536 byte.

`blk_queue_segment_boundary(request_queue_t *queue, unsigned long mask);` Một số thiết bị không thể xử lý các request vượt qua ranh giới bộ nhớ (memory boundary) có kích thước cụ thể; nếu thiết bị của bạn là một trong số đó, hãy sử dụng hàm này để thông báo cho kernel (kernel) về ranh giới đó. Ví dụ, nếu thiết bị của bạn gặp sự cố với các request vượt qua ranh giới 4-MB, hãy truyền vào một mặt nạ (mask) là `0x3fffff`. Mặt nạ mặc định là `0xffffffff`.

`void blk_queue_dma_alignment(request_queue_t *queue, int mask);` Hàm thông báo cho kernel về các ràng buộc căn chỉnh bộ nhớ (memory alignment constraints) mà thiết bị của bạn áp dụng đối với các hoạt động truyền tải DMA (DMA transfers). Tất cả các request được tạo với độ căn chỉnh cho trước, và độ dài của request cũng khớp với độ căn chỉnh đó. Mặt nạ mặc định là `0x1ff`, khiến cho tất cả các request được căn chỉnh theo ranh giới 512 byte.

`void blk_queue_hardsect_size(request_queue_t *queue, unsigned short max);` Thông báo cho kernel biết kích thước sector phần cứng (hardware sector size) của thiết bị. Tất cả các request do kernel tạo ra đều là bội số của kích thước này và được căn chỉnh phù hợp. Tuy nhiên, mọi giao tiếp giữa tầng block (block layer) và trình điều khiển (driver) vẫn tiếp tục được biểu diễn bằng các sector 512 byte.

## Giải phẫu của một Request (The Anatomy of a Request)

Trong ví dụ đơn giản của chúng ta, chúng ta đã gặp cấu trúc `request`. Tuy nhiên, chúng ta mới chỉ chạm đến bề mặt của cấu trúc dữ liệu phức tạp đó. Trong phần này, chúng ta sẽ xem xét chi tiết về cách các request I/O khối (block I/O request) được biểu diễn trong Linux kernel.

Mỗi cấu trúc `request` đại diện cho một request I/O khối, mặc dù nó có thể được hình thành thông qua việc hợp nhất (merger) của một vài request độc lập ở tầng cao hơn. Các sector cần truyền tải cho bất kỳ request cụ thể nào có thể được phân tán khắp bộ nhớ chính (main memory), mặc dù chúng luôn tương ứng với một tập hợp các sector liên tiếp trên thiết bị khối (block device). Request được biểu diễn dưới dạng một tập hợp các đoạn (segment), mỗi đoạn tương ứng với một bộ đệm trong bộ nhớ (in-memory buffer). Kernel có thể ghép nhiều request liên quan đến các sector kề nhau trên đĩa, nhưng nó không bao giờ kết hợp các thao tác đọc và ghi trong một cấu trúc `request` duy nhất. Kernel cũng đảm bảo không kết hợp các request nếu kết quả vi phạm bất kỳ giới hạn hàng đợi request (request queue limit) nào được mô tả trong phần trước.

Một cấu trúc `request` được thực thi, về cơ bản, như một danh sách liên kết (linked list) của các cấu trúc `bio` kết hợp với một số thông tin quản lý (housekeeping information) để cho phép driver theo dõi vị trí của nó khi xử lý request. Cấu trúc `bio` là một mô tả cấp thấp của một phần request I/O khối; chúng ta sẽ xem xét nó ngay bây giờ.

#### Cấu trúc bio (The bio structure)

Khi kernel, dưới hình thức là một hệ thống tập tin (filesystem), hệ thống con bộ nhớ ảo (virtual memory subsystem), hoặc một system call, quyết định rằng một tập hợp các khối (block) phải được truyền tải đến hoặc đi từ một thiết bị I/O khối; nó sẽ tạo ra một cấu trúc `bio` để mô tả thao tác đó. Cấu trúc đó sau đó được chuyển cho mã nguồn I/O khối (block I/O code), mã này sẽ hợp nhất nó vào một cấu trúc `request` hiện có hoặc, nếu cần thiết, tạo một cấu trúc mới. Cấu trúc `bio` chứa mọi thứ mà một block driver cần để thực hiện request mà không cần tham chiếu đến tiến trình không gian người dùng (user-space process) đã khởi tạo request đó.

Cấu trúc `bio`, được định nghĩa trong *<linux/bio.h>*, chứa một số trường (field) có thể hữu ích cho các tác giả viết driver:

```

sector_t bi_sector;

```

Sector (512-byte) đầu tiên cần được truyền tải cho bio này.

```

unsigned int bi_size;

```

Kích thước của dữ liệu cần truyền tải, tính bằng byte. Thay vào đó, thường dễ dàng hơn khi sử dụng `bio_sectors(bio)`, một macro trả về kích thước tính bằng số sector.

```

unsigned long bi_flags;

```

Một tập hợp cờ (flag) mô tả bio; bit ít có ý nghĩa nhất (least significant bit) được thiết lập nếu đây là một request ghi (mặc dù macro `bio_data_dir(bio)` nên được sử dụng thay vì kiểm tra trực tiếp các cờ).

```

unsigned short bio_phys_segments;
unsigned short bio_hw_segments;

```

Số lượng đoạn vật lý (physical segment) chứa trong BIO này và số lượng đoạn mà phần cứng nhìn thấy sau khi ánh xạ DMA (DMA mapping) hoàn tất, tương ứng.

Tuy nhiên, cốt lõi của một `bio` là một mảng có tên là `bi_io_vec`, được cấu thành từ cấu trúc sau:

```

struct bio_vec {
struct page *bv_page;
unsigned int bv_len;
unsigned int bv_offset;
};

```

Hình 16-1 minh họa cách các cấu trúc này liên kết lại với nhau. Như bạn có thể thấy, vào thời điểm một request I/O khối được biến đổi thành cấu trúc `bio`, nó đã được chia nhỏ thành các trang bộ nhớ vật lý (physical memory page) riêng lẻ. Tất cả những gì driver cần làm là duyệt qua mảng các cấu trúc này (có tổng cộng `bi_vcnt` phần tử) và truyền tải dữ liệu bên trong mỗi trang (nhưng chỉ `len` byte bắt đầu từ `offset`).

```

+-----------------+          +-----------------+          +--------------------+

|     struct bio  |          |  struct bio_vec |          |  System memory     |
|-----------------|   --->   |-----------------|   --->   |       map          |
|  bi_next        |          |  bv_page        |          |  [page]            |
|  bi_io_vec      |          +-----------------+          |  [page]            |
+-----------------+          |  struct bio_vec |          |  [page]            |

|-----------------|          |  ...               |
+-----------------+          |  bv_page        |          |  [page]            |

|     struct bio  |          +-----------------+          |  [page]            |
|-----------------|          |  struct bio_vec |          |  [page]            |
|  bi_next        |          |-----------------|          +--------------------+
|  bi_io_vec      |          |  bv_page        |
+-----------------+          +-----------------+

```

*Hình 16-1. Cấu trúc bio*

Việc thao tác trực tiếp với mảng `bi_io_vec` không được khuyến khích nhằm giúp các nhà phát triển kernel (kernel developers) có thể thay đổi cấu trúc `bio` trong tương lai mà không làm hỏng tính tương thích. Để đạt được mục đích đó, một tập hợp các macro đã được cung cấp nhằm đơn giản hóa quá trình làm việc với cấu trúc `bio`. Điểm khởi đầu là `bio_for_each_segment`, macro này thực hiện vòng lặp qua từng mục chưa được xử lý trong mảng `bi_io_vec`. Macro này nên được sử dụng như sau:

```c

int segno;
struct bio_vec *bvec;
bio_for_each_segment(bvec, bio, segno) {
/* Thực hiện một số thao tác với segment này */
}

```

Bên trong vòng lặp này, `bvec` trỏ tới mục `bio_vec` hiện tại và `segno` là số thứ tự segment hiện tại. Các giá trị này có thể được sử dụng để thiết lập các tệp truyền dữ liệu DMA (DMA transfers) (một cách thay thế sử dụng `blk_rq_map_sg` được mô tả trong phần "Yêu cầu khối và DMA" - Block requests and DMA). Nếu bạn cần truy cập trực tiếp các trang bộ nhớ (`page`), trước tiên bạn nên đảm bảo rằng một địa chỉ ảo kernel (kernel virtual address) hợp lệ tồn tại; để làm điều đó, bạn có thể sử dụng:

```c

char *__bio_kmap_atomic(struct bio *bio, int i, enum km_type type);
void __bio_kunmap_atomic(char *buffer, enum km_type type);

```

Hàm mức thấp (low-level function) này cho phép bạn ánh xạ (map) trực tiếp bộ đệm (buffer) nằm trong một `bio_vec` cho trước, được chỉ định bởi chỉ mục `i`. Một ánh xạ kmap nguyên tử (atomic kmap) được tạo ra; người gọi phải cung cấp khe cắm (slot) thích hợp để sử dụng (như được mô tả trong phần "Bản đồ bộ nhớ và Cấu trúc trang" - The Memory Map and Struct Page tại Chương 15).

Tầng khối (block layer) cũng duy trì một tập hợp các con trỏ bên trong cấu trúc `bio` để theo dõi trạng thái hiện tại của quá trình xử lý yêu cầu (request processing). Một số macro tồn tại để cung cấp quyền truy cập vào trạng thái đó:

```c

struct page *bio_page(struct bio *bio);

```

Trả về một con trỏ tới cấu trúc `page` đại diện cho trang sẽ được truyền tiếp theo.

```c

int bio_offset(struct bio *bio);

```

Trả về độ lệch (offset) bên trong trang đối với dữ liệu cần truyền.

```c

int bio_cur_sectors(struct bio *bio);

```

Trả về số lượng sector cần truyền từ trang hiện tại.

```c

char *bio_data(struct bio *bio);

```

Trả về một địa chỉ logic của kernel (kernel logical address) trỏ tới dữ liệu cần truyền. Lưu ý rằng địa chỉ này chỉ có sẵn nếu trang đang xét không nằm trong bộ nhớ cao (high memory); việc gọi nó trong các trường hợp khác là một lỗi (bug). Theo mặc định, hệ thống con khối (block subsystem) không chuyển các bộ đệm bộ nhớ cao (high-memory buffers) đến trình điều khiển (driver) của bạn, nhưng nếu bạn đã thay đổi cài đặt đó bằng `blk_queue_bounce_limit`, có lẽ bạn không nên sử dụng `bio_data`.

```c

char *bio_kmap_irq(struct bio *bio, unsigned long *flags);
void bio_kunmap_irq(char *buffer, unsigned long *flags);

```

`bio_kmap_irq` trả về một địa chỉ ảo kernel cho bất kỳ bộ đệm nào, bất kể nó nằm trong bộ nhớ cao hay bộ nhớ thấp (high or low memory). Một kmap nguyên tử được sử dụng, vì vậy trình điều khiển của bạn không được phép ngủ (sleep) trong khi ánh xạ này đang hoạt động. Sử dụng `bio_kunmap_irq` để hủy ánh xạ (unmap) bộ đệm. Lưu ý rằng đối số `flags` được truyền bằng con trỏ ở đây. Cũng cần lưu ý rằng vì kmap nguyên tử được sử dụng, bạn không thể ánh xạ nhiều hơn một segment tại một thời điểm.

Tất cả các hàm vừa được mô tả đều truy cập vào bộ đệm "hiện tại"—bộ đệm đầu tiên mà, theo hiểu biết của kernel, chưa được truyền. Các trình điều khiển thường muốn làm việc thông qua một số bộ đệm trong `bio` trước khi báo hiệu hoàn thành cho bất kỳ bộ đệm nào trong số đó (với `end_that_request_first`, sẽ được mô tả ngay sau đây), vì vậy các hàm này thường không hữu ích. Một số macro khác tồn tại để làm việc với các thành phần bên trong của cấu trúc `bio` (xem chi tiết tại `<linux/bio.h>`).

### Các trường trong cấu trúc yêu cầu (Request structure fields)

Bây giờ chúng ta đã có hình dung về cách cấu trúc `bio` hoạt động, chúng ta có thể đi sâu vào `struct request` và xem xét cách thức xử lý yêu cầu (request processing) diễn ra như thế nào. Các trường của cấu trúc này bao gồm:

sector\_t hard\_sector; unsigned long hard\_nr\_sectors; unsigned int hard\_cur\_sectors;

> [!NOTE]
> Các trường theo dõi các sector mà trình điều khiển (driver) chưa hoàn thành. Sector đầu tiên *chưa* được truyền được lưu trữ trong `hard_sector`, tổng số sector chưa truyền nằm trong `hard_nr_sectors`, và số lượng sector còn lại trong `bio` hiện tại là `hard_cur_sectors`. Các trường này chỉ dành cho việc sử dụng nội bộ trong phân hệ khối (block subsystem); các driver không nên sử dụng chúng.

struct bio \*bio;

`bio` là danh sách liên kết (linked list) của các cấu trúc `bio` cho yêu cầu này. Bạn không nên truy cập trực tiếp trường này; thay vào đó hãy sử dụng `rq_for_each_bio` (được mô tả sau).

char \*buffer;

Ví dụ về driver đơn giản trước đó trong chương này đã sử dụng trường này để tìm bộ đệm (buffer) cho việc truyền dữ liệu. Với sự hiểu biết sâu sắc hơn, giờ đây chúng ta có thể thấy rằng trường này đơn giản là kết quả của việc gọi hàm `bio_data` trên `bio` hiện tại.

unsigned short nr\_phys\_segments;

Số lượng các đoạn (segment) riêng biệt chiếm bởi yêu cầu này trong bộ nhớ vật lý (physical memory) sau khi các trang (page) liền kề đã được gộp lại.

struct list\_head queuelist;

Cấu trúc danh sách liên kết (như được mô tả trong phần "Danh sách liên kết" ở Chương 11) liên kết yêu cầu vào hàng đợi yêu cầu (request queue). Nếu (và chỉ nếu) bạn loại bỏ yêu cầu khỏi hàng đợi bằng hàm `blkdev_dequeue_request`, bạn có thể sử dụng đầu danh sách này để theo dõi yêu cầu trong một danh sách nội bộ được duy trì bởi driver của bạn.

Hình 16-2 cho thấy cấu trúc yêu cầu và các cấu trúc `bio` thành phần của nó khớp với nhau như thế nào. Trong hình, yêu cầu đã được xử lý một phần; các trường `cbio` và `buffer` trỏ đến `bio` đầu tiên chưa được truyền.

```

+-----------------+        +-----------------+          +--------------------+

| struct request  |        |       bio       |          |      Memory        |
|-----------------|        |-----------------|          | [page]             |
+--+----->|   queuelist     |  +---->|  bi_io_vec      |--------->| [page]             |

|  |      +-----------------+  |     |  bi_next        |          | [page]             |
|  |                           |     +-----------------+          |  ...               |
|  |      +-----------------+  |     +-----------------+          | [page]             |
|  |      | struct request  |  |     |       bio       |--------->| [page]             |
|  |      |-----------------|  |     |-----------------|     +--->| [page]             |
|  +----->|   queuelist     |  +---->|  bi_io_vec      |     |    +--------------------+
|  +----->|   bio           |------->|  bi_next        |     |
|  |      |   cbio          |        +-----------------+     |
|  |      |   buffer        |        +-----------------+     |
|  |      +-----------------+        |       bio       |     |
|  |                                 |-----------------|     |
|  |      +-----------------+        |  bi_io_vec      |     |
|  |      | struct request  |        |  bi_next        |-----+
|  |      |-----------------|        +-----------------+
+--+----->|   queuelist     |
+-----------------+

```

*Hình 16-2. Hàng đợi yêu cầu (request queue) với một yêu cầu được xử lý một phần*

Có rất nhiều trường khác bên trong cấu trúc yêu cầu, nhưng danh sách trong phần này sẽ là đủ đối với hầu hết các nhà phát triển driver.

#### Yêu cầu rào cản (Barrier requests)

Tầng khối (block layer) sắp xếp lại các yêu cầu trước khi driver của bạn nhìn thấy chúng nhằm cải thiện hiệu năng I/O. Driver của bạn cũng có thể sắp xếp lại các yêu cầu nếu có lý do để làm như vậy. Thông thường, việc sắp xếp lại này diễn ra bằng cách chuyển nhiều yêu cầu đến ổ đĩa và để phần cứng tự tìm ra thứ tự tối ưu. Tuy nhiên, có một vấn đề với việc sắp xếp lại yêu cầu một cách không hạn chế: một số ứng dụng yêu cầu đảm bảo rằng các thao tác nhất định phải hoàn thành trước khi các thao tác khác bắt đầu. Ví dụ, các trình quản lý cơ sở dữ liệu quan hệ (relational database managers) phải hoàn toàn chắc chắn rằng thông tin nhật ký (journaling) của chúng đã được xả (flush) xuống ổ đĩa trước khi thực thi một giao dịch (transaction) trên nội dung cơ sở dữ liệu. Các hệ thống tập tin nhật ký (journaling filesystems), hiện đang được sử dụng trên phần lớn các hệ thống Linux, có các ràng buộc về thứ tự rất giống nhau. Nếu các thao tác sai bị sắp xếp lại, kết quả có thể dẫn đến tình trạng hỏng dữ liệu nghiêm trọng mà không được phát hiện.

Tầng khối phiên bản 2.6 giải quyết vấn đề này với khái niệm *yêu cầu rào cản* (*barrier request*). Nếu một yêu cầu được đánh dấu bằng cờ `REQ_HARDBARRER`, nó phải được ghi xuống ổ đĩa trước khi bất kỳ yêu cầu tiếp theo nào được khởi tạo. Bằng cụm từ "được ghi xuống ổ đĩa", ý chúng tôi là dữ liệu phải thực sự nằm và tồn tại bền vững (persistent) trên phương tiện lưu trữ vật lý. Nhiều ổ đĩa thực hiện việc lưu đệm (caching) các yêu cầu ghi; việc lưu đệm này giúp cải thiện hiệu năng, nhưng nó có thể làm mất đi mục đích của các yêu cầu rào cản. Nếu sự cố mất điện xảy ra khi dữ liệu quan trọng vẫn còn đang nằm trong

bộ đệm của ổ đĩa, dữ liệu đó vẫn sẽ bị mất ngay cả khi ổ đĩa đã thông báo hoàn tất. Do đó, một driver thực thi các yêu cầu rào cản (barrier request) phải thực hiện các bước để ép ổ đĩa thực sự ghi dữ liệu xuống phương tiện lưu trữ (media).

Nếu driver của bạn hỗ trợ các yêu cầu rào cản, bước đầu tiên là thông báo cho tầng khối (block layer) về thực tế này. Việc xử lý rào cản là một tính năng khác của hàng đợi yêu cầu (request queue); nó được thiết lập bằng hàm:

```c

void blk_queue_ordered(request_queue_t *queue, int flag);

```

Để chỉ định rằng driver của bạn thực thi các yêu cầu rào cản, hãy đặt tham số `flag` thành một giá trị khác không.

Việc triển khai thực tế các yêu cầu rào cản đơn giản là kiểm tra cờ (flag) liên quan trong cấu trúc yêu cầu (`request structure`). Một macro đã được cung cấp để thực hiện việc kiểm tra này:

```c

int blk_barrier_rq(struct request *req);

```

Nếu macro này trả về một giá trị khác không, yêu cầu đó là một yêu cầu rào cản. Tùy thuộc vào cách phần cứng của bạn hoạt động, bạn có thể phải ngừng nhận các yêu cầu từ hàng đợi (queue) cho đến khi yêu cầu rào cản được hoàn thành. Các ổ đĩa khác có thể tự hiểu các yêu cầu rào cản; trong trường hợp này, tất cả những gì driver của bạn phải làm là phát ra các thao tác phù hợp cho các ổ đĩa đó.

#### Các yêu cầu không thể thử lại (Nonretryable requests)

Các block driver thường cố gắng thử lại các yêu cầu gặp lỗi trong lần chạy đầu tiên. Hành vi này có thể dẫn đến một hệ thống đáng tin cậy hơn và giúp tránh mất dữ liệu. Tuy nhiên, kernel đôi khi đánh dấu các yêu cầu là không được phép thử lại. Các yêu cầu như vậy sẽ phải thất bại càng nhanh càng tốt nếu chúng không thể được thực thi ngay trong lần thử đầu tiên.

Nếu driver của bạn đang cân nhắc việc thử lại một yêu cầu bị lỗi, trước tiên nó nên gọi hàm:

```c

int blk_noretry_request(struct request *req);

```

Nếu macro này trả về một giá trị khác không, driver của bạn nên hủy bỏ yêu cầu (abort) bằng một mã lỗi thay vì thử lại nó.

## Các hàm hoàn thành yêu cầu (Request Completion Functions)

Như chúng ta sẽ thấy, có một số cách khác nhau để xử lý một cấu trúc yêu cầu (`request structure`). Tuy nhiên, tất cả chúng đều sử dụng một vài hàm chung, xử lý việc hoàn thành một yêu cầu I/O (I/O request) hoặc một phần của yêu cầu. Cả hai hàm này đều là nguyên tử (atomic) và có thể được gọi một cách an toàn từ ngữ cảnh nguyên tử (atomic context).

Khi thiết bị của bạn đã hoàn tất việc truyền một phần hoặc toàn bộ các sector trong một yêu cầu I/O, nó phải thông báo cho hệ thống con khối (block subsystem) bằng hàm:

```c

int end_that_request_first(struct request *req, int success, int count);

```

Hàm này thông báo cho mã lệnh của khối (block code) rằng driver của bạn đã hoàn tất việc truyền `count` sector bắt đầu từ vị trí bạn đã dừng lại lần trước. Nếu I/O thành công, hãy truyền tham số `success` là 1; ngược lại hãy truyền 0. Lưu ý rằng bạn phải báo hiệu hoàn thành theo thứ tự từ sector đầu tiên đến sector cuối cùng; nếu driver và thiết bị của bạn bằng cách nào đó lại hoàn thành các yêu cầu sai thứ tự, bạn phải lưu trữ trạng thái hoàn thành sai thứ tự đó cho đến khi các sector nằm giữa đã được truyền xong.

Giá trị trả về từ *end\_that\_request\_first* là dấu hiệu cho biết tất cả các sector trong yêu cầu này đã được truyền hay chưa. Giá trị trả về là 0 có nghĩa là tất cả các sector đã được truyền và yêu cầu đã hoàn tất. Tại thời điểm đó, bạn phải loại bỏ yêu cầu khỏi hàng đợi (dequeue) bằng hàm *blkdev\_dequeue\_request* (nếu bạn chưa làm điều đó) và truyền nó tới:

```c

void end_that_request_last(struct request *req);

```

*end\_that\_request\_last* thông báo cho bất kỳ tiến trình nào đang chờ yêu cầu rằng nó đã hoàn tất và thu hồi lại cấu trúc yêu cầu (`request structure`); nó phải được gọi khi đang giữ khóa hàng đợi (queue lock).

Trong ví dụ *sbull* đơn giản của chúng ta, chúng ta đã không sử dụng bất kỳ hàm nào ở trên. Thay vào đó, ví dụ đó gọi *end\_request*. Để cho thấy hiệu ứng của lệnh gọi này, dưới đây là toàn bộ hàm *end\_request* như được thấy trong kernel phiên bản 2.6.10:

```c

void end_request(struct request *req, int uptodate)
{
if (!end_that_request_first(req, uptodate, req->hard_cur_sectors)) {
add_disk_randomness(req->rq_disk);
blkdev_dequeue_request(req);
end_that_request_last(req);
}
}

```

Hàm *add\_disk\_randomness* sử dụng thời gian thực hiện các yêu cầu block I/O để đóng góp entropy cho bể số ngẫu nhiên (random number pool) của hệ thống; nó chỉ nên được gọi nếu thời gian của ổ đĩa thực sự ngẫu nhiên. Điều đó đúng với hầu hết các thiết bị cơ học, nhưng không đúng đối với một thiết bị ảo dựa trên bộ nhớ, chẳng hạn như *sbull*. Vì lý do này, phiên bản phức tạp hơn của *sbull* được trình bày trong phần tiếp theo không gọi *add\_disk\_randomness*.

#### Làm việc với bios

Bây giờ bạn đã biết đủ để viết một block driver hoạt động trực tiếp với các cấu trúc bio tạo nên một yêu cầu. Tuy nhiên, một ví dụ sẽ hữu ích hơn. Nếu driver *sbull* được tải với tham số `request_mode` được đặt thành 1, nó sẽ đăng ký một hàm *request* nhận biết bio (bio-aware) thay vì hàm đơn giản mà chúng ta đã thấy ở trên. Hàm đó trông như thế này:

```c

static void sbull_full_request(request_queue_t *q)
{
struct request *req;
int sectors_xferred;
struct sbull_dev *dev = q->queuedata;
while ((req = elv_next_request(q)) != NULL) {
if (! blk_fs_request(req)) {
printk (KERN_NOTICE "Skip non-fs request\n");

```

```c

end_request(req, 0);
continue;
}
sectors_xferred = sbull_xfer_request(dev, req);
if (! end_that_request_first(req, 1, sectors_xferred)) {
blkdev_dequeue_request(req);
end_that_request_last(req);
}
}
}

```

Hàm này đơn giản là nhận từng request (yêu cầu), chuyển nó đến *sbull\_xfer\_request*, sau đó hoàn tất request đó bằng *end\_that\_request\_first* và, nếu cần thiết, *end\_that\_request\_last*. Như vậy, hàm này đang xử lý các phần quản lý request và hàng đợi (queue) ở mức cao (high-level) của vấn đề. Tuy nhiên, công việc thực thi một request thực tế lại thuộc về *sbull\_xfer\_request*:

```c

static int sbull_xfer_request(struct sbull_dev *dev, struct request *req)
{
struct bio *bio;
int nsect = 0;
rq_for_each_bio(bio, req) {
sbull_xfer_bio(dev, bio);
nsect += bio->bi_size/KERNEL_SECTOR_SIZE;
}
return nsect;
}

```

Ở đây chúng ta giới thiệu một macro khác: *rq\_for\_each\_bio*. Đúng như bạn có thể đoán, macro này đơn giản là duyệt qua từng cấu trúc bio trong request, cung cấp cho chúng ta một con trỏ để có thể truyền tới *sbull\_xfer\_bio* nhằm thực hiện việc truyền dữ liệu. Hàm đó có dạng như sau:

```c

static int sbull_xfer_bio(struct sbull_dev *dev, struct bio *bio)
{
int i;
struct bio_vec *bvec;
sector_t sector = bio->bi_sector;
/* Xử lý từng đoạn (segment) một cách độc lập. */
bio_for_each_segment(bvec, bio, i) {
char *buffer = __bio_kmap_atomic(bio, i, KM_USER0);
sbull_transfer(dev, sector, bio_cur_sectors(bio),
buffer, bio_data_dir(bio) = = WRITE);
sector += bio_cur_sectors(bio);
__bio_kunmap_atomic(bio, KM_USER0);
}
return 0; /* Luôn "thành công" */
}

```

Hàm này đơn giản là duyệt qua từng segment trong cấu trúc bio, lấy một địa chỉ ảo của kernel (kernel virtual address) để truy cập bộ đệm (buffer), sau đó gọi hàm *sbull\_transfer* quen thuộc mà chúng ta đã thấy trước đó để sao chép dữ liệu sang.

Mỗi thiết bị có các yêu cầu riêng của mình, nhưng theo nguyên tắc chung, đoạn mã vừa được hiển thị sẽ đóng vai trò như một mô hình cho nhiều tình huống cần đào sâu vào các cấu trúc bio.

#### Block requests và DMA

Nếu bạn đang làm việc trên một trình điều khiển khối (block driver) hiệu suất cao, rất có thể bạn sẽ sử dụng DMA cho việc truyền dữ liệu thực tế. Một block driver hoàn toàn có thể duyệt qua các cấu trúc bio như đã mô tả ở trên, tạo một ánh xạ DMA (DMA mapping) cho từng cấu trúc, và truyền kết quả cho thiết bị. Tuy nhiên, có một cách dễ dàng hơn nếu thiết bị của bạn có khả năng thực hiện I/O dạng phân tán/tập trung (scatter/gather I/O). Hàm sau:

```c

int blk_rq_map_sg(request_queue_t *queue, struct request *req,
struct scatterlist *list);

```

sẽ điền vào danh sách được cung cấp toàn bộ tập hợp các segment từ request cho trước. Các segment nằm kề nhau trong bộ nhớ sẽ được gộp lại (coalesced) trước khi được chèn vào scatterlist, vì vậy bạn không cần phải tự mình tìm cách phát hiện chúng. Giá trị trả về là số lượng mục nhập (entries) trong danh sách. Hàm này cũng trả về thông qua tham số thứ ba của nó một scatterlist thích hợp để truyền cho *dma\_map\_sg*. (Xem phần "Scatter-gather mappings" trong Chương 15 để biết thêm thông tin về *dma\_map\_sg*.)

Trình điều khiển (driver) của bạn phải cấp phát bộ nhớ cho scatterlist trước khi gọi *blk\_rq\_map\_sg*. Danh sách phải có khả năng chứa ít nhất số lượng mục nhập tương ứng với số segment vật lý mà request có; trường struct request `nr_phys_segments` lưu giữ số lượng đó, và nó sẽ không vượt quá số lượng tối đa các segment vật lý được chỉ định bởi *blk\_queue\_max\_phys\_segments*.

Nếu bạn không muốn *blk\_rq\_map\_sg* gộp các segment kề nhau lại, bạn có thể thay đổi hành vi mặc định bằng một lời gọi như:

```c

clear_bit(QUEUE_FLAG_CLUSTER, &queue->queue_flags);

```

Một số trình điều khiển đĩa SCSI đánh dấu hàng đợi request của chúng theo cách này, vì chúng không nhận được lợi ích gì từ việc gộp các request.

#### Xử lý không cần hàng đợi request (request queue)

Trước đây, chúng ta đã thảo luận về công việc mà kernel thực hiện để tối ưu hóa thứ tự các request trong hàng đợi; công việc này bao gồm việc sắp xếp các request và, có lẽ, thậm chí tạm dừng hàng đợi để cho phép một request dự kiến xuất hiện. Những kỹ thuật này giúp cải thiện hiệu suất của hệ thống khi xử lý một ổ đĩa quay thực tế. Tuy nhiên, chúng hoàn toàn lãng phí đối với một thiết bị như *sbull*. Nhiều thiết bị định hướng khối (block-oriented devices), chẳng hạn như mảng bộ nhớ flash, trình đọc thẻ nhớ dùng trong máy ảnh kỹ thuật số, và đĩa RAM (RAM disks), có hiệu suất truy cập hoàn toàn ngẫu nhiên (random-access) và không hưởng lợi từ logic xếp hàng request nâng cao. Các thiết bị khác, chẳng hạn như mảng RAID phần mềm hoặc đĩa ảo được tạo bởi trình quản lý ổ đĩa logic (logical volume managers), không có các đặc tính hiệu suất mà hàng đợi request của tầng khối (block layer) tối ưu hóa cho chúng. Đối với loại thiết bị này, sẽ

tốt hơn nếu chấp nhận các request trực tiếp từ block layer mà không cần bận tâm đến request queue làm gì.

Đối với những tình huống này, block layer hỗ trợ chế độ hoạt động "không có hàng đợi" ("no queue"). Để sử dụng chế độ này, driver của bạn phải cung cấp một hàm "tạo request" (make request), thay vì một hàm *request*. Hàm *make\_request* có nguyên mẫu (prototype) như sau:

```c

typedef int (make_request_fn) (request_queue_t *q, struct bio *bio);

```

```

Lưu ý rằng một hàng đợi yêu cầu (request queue) vẫn hiện diện, mặc dù trên thực tế nó sẽ không bao giờ chứa bất kỳ yêu cầu nào. Hàm *make_request* nhận tham số chính là một cấu trúc bio (`struct bio`), đại diện cho một hoặc nhiều bộ đệm (buffer) cần được truyền dữ liệu. Hàm *make_request* có thể thực hiện một trong hai việc: hoặc thực hiện việc truyền dữ liệu trực tiếp, hoặc chuyển hướng yêu cầu sang một thiết bị khác.

Việc thực hiện truyền dữ liệu trực tiếp chỉ đơn giản là làm việc thông qua bio bằng các phương thức truy cập (accessor methods) mà chúng ta đã mô tả trước đó. Tuy nhiên, vì không có cấu trúc request (`struct request`) để làm việc cùng, hàm của bạn nên báo hiệu việc hoàn thành trực tiếp cho người tạo ra cấu trúc bio bằng một lời gọi đến *bio_endio*:

```c

void bio_endio(struct bio *bio, unsigned int bytes, int error);

```

Ở đây, `bytes` là số byte mà bạn đã truyền cho đến thời điểm hiện tại. Nó có thể nhỏ hơn tổng số byte mà bio đại diện; bằng cách này, bạn có thể báo hiệu hoàn thành một phần (partial completion), và cập nhật các con trỏ "bộ đệm hiện tại" ("current buffer" pointers) bên trong bio. Bạn nên gọi lại *bio_endio* khi thiết bị của bạn tiến hành thêm các bước xử lý tiếp theo, hoặc báo hiệu một lỗi nếu bạn không thể hoàn thành yêu cầu. Các lỗi được biểu thị bằng cách cung cấp một giá trị khác không cho tham số `error`; giá trị này thông thường là một mã lỗi chẳng hạn như `-EIO`. Hàm *make_request* phải trả về `0`, bất kể thao tác I/O có thành công hay không.

Nếu *sbull* được nạp với `request_mode=2`, nó hoạt động với một hàm *make_request*. Vì *sbull* đã có sẵn một hàm có thể truyền một bio đơn lẻ, hàm *make_request* rất đơn giản:

```c

static int sbull_make_request(request_queue_t *q, struct bio *bio)
{
struct sbull_dev *dev = q->queuedata;
int status;
status = sbull_xfer_bio(dev, bio);
bio_endio(bio, bio->bi_size, status);
return 0;
}

```

Xin lưu ý rằng bạn không bao giờ được gọi *bio_endio* từ một hàm *request* thông thường; công việc đó thay vào đó được xử lý bởi *end_that_request_first*.

Một số trình điều khiển khối (block driver), chẳng hạn như các trình điều khiển triển khai trình quản lý ổ đĩa (volume manager) và các mảng RAID phần mềm (software RAID array), thực sự cần chuyển hướng yêu cầu sang một thiết bị khác để xử lý thao tác I/O thực tế. Việc viết một trình điều khiển như vậy nằm ngoài phạm vi của cuốn sách này. Tuy nhiên, chúng ta lưu ý rằng nếu hàm *make_request* trả về một giá trị khác không, bio sẽ được gửi lại (submitted again). Do đó, một trình điều khiển "xếp tầng" ("stacking" driver) có thể sửa đổi trường `bi_bdev` để trỏ tới một thiết bị khác, thay đổi giá trị sector bắt đầu, sau đó trả về; hệ thống khối (block system) sau đó sẽ chuyển bio sang thiết bị mới. Ngoài ra còn có một lời gọi *bio_split* có thể được sử dụng để chia một bio thành nhiều phần (chunk) để gửi đến nhiều hơn một thiết bị. Mặc dù nếu các tham số của hàng đợi được thiết lập chính xác, việc chia một bio theo cách này hầu như không bao giờ cần thiết.

Dù theo cách nào đi nữa, bạn phải thông báo cho hệ thống con khối (block subsystem) rằng trình điều khiển của bạn đang sử dụng một hàm *make_request* tùy chỉnh. Để làm điều đó, bạn phải cấp phát một hàng đợi yêu cầu (request queue) bằng:

```c

request_queue_t *blk_alloc_queue(int flags);

```

Hàm này khác với *blk_init_queue* ở chỗ nó không thực sự thiết lập hàng đợi để chứa các yêu cầu. Đối số `flags` là một tập hợp các cờ cấp phát (allocation flags) sẽ được sử dụng khi cấp phát bộ nhớ cho hàng đợi; thông thường giá trị phù hợp là `GFP_KERNEL`. Một khi bạn đã có một hàng đợi, hãy truyền nó và hàm *make_request* của bạn vào *blk_queue_make_request*:

```c

void blk_queue_make_request(request_queue_t *queue, make_request_fn *func);

```

Mã nguồn của *sbull* để thiết lập hàm *make_request* trông giống như sau:

```c

dev->queue = blk_alloc_queue(GFP_KERNEL);
if (dev->queue == NULL)
goto out_vfree;
blk_queue_make_request(dev->queue, sbull_make_request);

```

Dành cho những ai tò mò, sau một khoảng thời gian đào sâu vào `drivers/block/ll_rw_block.c`, ta thấy rằng tất cả các hàng đợi đều có một hàm *make_request*. Phiên bản mặc định, *generic_make_request*, xử lý việc kết hợp bio vào một cấu trúc request. Bằng cách cung cấp hàm *make_request* của riêng mình, một trình điều khiển thực chất chỉ đang ghi đè lên một phương thức *request queue* cụ thể và tự giải quyết phần lớn công việc.

## Một số chi tiết khác

Phần này bao gồm một vài khía cạnh khác của tầng khối (block layer) có thể đáng quan tâm đối với các trình điều khiển nâng cao. Không có cơ sở nào sau đây cần phải được sử dụng để viết một trình điều khiển chính xác, nhưng chúng có thể hữu ích trong một số tình huống.

## Chuẩn bị trước lệnh (Command Pre-Preparation)

Tầng khối cung cấp một cơ chế cho các trình điều khiển kiểm tra và tiền xử lý các yêu cầu trước khi chúng được trả về từ *elv_next_request*. Cơ chế này cho phép các trình điều khiển thiết lập trước các lệnh ổ đĩa thực tế, quyết định xem yêu cầu có thể được xử lý hay không, hoặc thực hiện các loại công việc dọn dẹp (housekeeping) khác.

Nếu bạn muốn sử dụng tính năng này, hãy tạo một hàm chuẩn bị lệnh phù hợp với nguyên mẫu (prototype) sau:

```c

typedef int (prep_rq_fn) (request_queue_t *queue, struct request *req);

```

Cấu trúc request bao gồm một trường gọi là `cmd`, là một mảng có kích thước `BLK_MAX_CDB` byte; mảng này có thể được sử dụng bởi hàm chuẩn bị để lưu trữ lệnh phần cứng thực tế (hoặc bất kỳ thông tin hữu ích nào khác). Hàm này nên trả về một trong các giá trị sau:

#### BLKPREP\_OK

Việc chuẩn bị lệnh diễn ra bình thường và request có thể được chuyển đến hàm *request* của trình điều khiển (driver).

#### BLKPREP\_KILL

Request này không thể hoàn thành; nó thất bại kèm theo một mã lỗi (error code).

#### BLKPREP\_DEFER

Request này chưa thể hoàn thành tại thời điểm này. Nó nằm ở đầu hàng đợi (queue) nhưng không được chuyển đến hàm *request*.

Hàm chuẩn bị được gọi bởi *elv\_next\_request* ngay trước khi request được trả về cho trình điều khiển của bạn. Nếu hàm này trả về BLKPREP\_DEFER, giá trị trả về từ *elv\_next\_request* cho trình điều khiển của bạn sẽ là NULL. Chế độ hoạt động này có thể hữu ích nếu, ví dụ, thiết bị của bạn đã đạt đến số lượng request đang xử lý tối đa (outstanding requests) cho phép.

Để tầng khối (block layer) gọi hàm chuẩn bị của bạn, hãy truyền nó tới:

```

void blk_queue_prep_rq(request_queue_t *queue, prep_rq_fn *func);

```

Theo mặc định, các hàng đợi request không có hàm chuẩn bị nào.

## Tagged Command Queueing

Phần cứng có thể xử lý nhiều request hoạt động cùng một lúc thường hỗ trợ một dạng xếp hàng lệnh có thẻ (tagged command queueing - TCQ). TCQ đơn giản là kỹ thuật gắn một "thẻ" (tag) dạng số nguyên vào mỗi request để khi ổ đĩa hoàn thành một trong những request đó, nó có thể cho trình điều khiển biết đó là request nào. Trong các phiên bản kernel trước đây, các trình điều khiển khối (block driver) triển khai TCQ phải tự mình làm tất cả mọi việc; ở phiên bản 2.6, một hạ tầng hỗ trợ TCQ đã được thêm vào tầng khối (block layer) để mọi trình điều khiển có thể sử dụng.

Nếu ổ đĩa của bạn thực hiện xếp hàng lệnh có thẻ, bạn nên thông báo cho kernel biết điều đó tại thời điểm khởi tạo bằng lời gọi:

```

int blk_queue_init_tags(request_queue_t *queue, int depth,
struct blk_queue_tag *tags);

```

Ở đây, `queue` là hàng đợi request của bạn và `depth` là số lượng request được gắn thẻ mà thiết bị của bạn có thể xử lý đồng thời tại bất kỳ thời điểm nào. `tags` là một con trỏ tùy chọn trỏ đến một mảng các cấu trúc `struct blk_queue_tag`; phải có đúng `depth` phần tử trong mảng này. Thông thường, `tags` có thể được truyền dưới dạng NULL và *blk\_queue\_init\_tags* sẽ tự cấp phát mảng đó. Tuy nhiên, nếu bạn cần chia sẻ cùng một tập thẻ giữa nhiều thiết bị, bạn có thể truyền con trỏ mảng thẻ (được lưu trữ trong trường `queue_tags`) từ một hàng đợi request khác. Bạn không bao giờ nên tự mình cấp phát mảng thẻ; tầng khối (block layer) cần khởi tạo mảng này và không xuất hàm khởi tạo ra các module.

Vì *blk\_queue\_init\_tags* thực hiện cấp phát bộ nhớ (memory allocation), nó có thể thất bại; trong trường hợp đó, nó sẽ trả về một mã lỗi âm cho hàm gọi.

Nếu số lượng thẻ mà thiết bị của bạn có thể xử lý thay đổi, bạn có thể thông báo cho kernel bằng:

```

int blk_queue_resize_tags(request_queue_t *queue, int new_depth);

```

Khóa hàng đợi (queue lock) phải được giữ trong suốt lời gọi này. Lời gọi này có thể thất bại và trả về một mã lỗi âm trong trường hợp đó.

Việc liên kết một thẻ với cấu trúc request được thực hiện bằng hàm *blk\_queue\_start\_tag*, hàm này phải được gọi khi đang giữ khóa hàng đợi (queue lock):

```

int blk_queue_start_tag(request_queue_t *queue, struct request *req);

```

Nếu có sẵn một thẻ, hàm này sẽ cấp phát thẻ đó cho request này, lưu số thẻ vào `req->tag` và trả về 0. Nó cũng lấy request ra khỏi hàng đợi (dequeue) và liên kết nó vào cấu trúc theo dõi thẻ của chính nó, vì vậy trình điều khiển của bạn cần lưu ý không tự ý lấy request ra khỏi hàng đợi nếu đang sử dụng thẻ. Nếu không còn thẻ nào có sẵn, *blk\_queue\_start\_tag* sẽ giữ nguyên request trong hàng đợi và trả về một giá trị khác không.

Khi tất cả các quá trình truyền dữ liệu cho một request cụ thể đã hoàn tất, trình điều khiển của bạn nên trả lại thẻ bằng:

```

void blk_queue_end_tag(request_queue_t *queue, struct request *req);

```

Một lần nữa, bạn phải giữ khóa hàng đợi trước khi gọi hàm này. Lời gọi này nên được thực hiện sau khi *end\_that\_request\_first* trả về 0 (có nghĩa là request đã hoàn tất) nhưng trước khi gọi *end\_that\_request\_last*. Hãy nhớ rằng request đã được lấy ra khỏi hàng đợi từ trước, vì vậy sẽ là một lỗi nếu trình điều khiển của bạn làm điều đó lần nữa tại thời điểm này.

Nếu bạn cần tìm request liên kết với một thẻ cụ thể (ví dụ: khi ổ đĩa báo cáo hoàn thành), hãy sử dụng *blk\_queue\_find\_tag*:

```

struct request *blk_queue_find_tag(request_queue_t *qeue, int tag);

```

Giá trị trả về là cấu trúc request được liên kết, trừ khi có điều gì đó thực sự sai sót xảy ra.

Nếu mọi chuyện thực sự tồi tệ, trình điều khiển của bạn có thể phải thực hiện reset hoặc thực hiện một số hành động khắc phục mạnh mẽ khác đối với một trong các thiết bị của nó. Trong trường hợp đó, bất kỳ lệnh gắn thẻ nào đang chờ xử lý sẽ không được hoàn thành. Tầng khối (block layer) cung cấp một hàm có thể hỗ trợ nỗ lực khôi phục trong những tình huống như vậy:

```

void blk_queue_invalidate_tags(request_queue_t *queue);

```

Hàm này trả tất cả các thẻ đang chờ xử lý về lại pool và đưa các request liên kết quay trở lại hàng đợi request. Khóa hàng đợi (queue lock) phải được giữ khi bạn gọi hàm này.

## Tài liệu tham khảo nhanh (Quick Reference)

```c

## include <linux/fs.h>

int register_blkdev(unsigned int major, const char *name);
int unregister_blkdev(unsigned int major, const char *name);
register_blkdev đăng ký một block driver với kernel và tùy chọn cấp phát một
major number. Có thể hủy đăng ký driver bằng unregister_blkdev.
struct block_device_operations
Cấu trúc chứa hầu hết các phương thức dành cho block driver.

## include <linux/genhd.h>

struct gendisk;
Cấu trúc mô tả một block device đơn lẻ bên trong kernel.
struct gendisk *alloc_disk(int minors);
void add_disk(struct gendisk *gd);
Các hàm cấp phát cấu trúc gendisk và trả chúng về hệ thống.
void set_capacity(struct gendisk *gd, sector_t sectors);
Lưu trữ dung lượng của thiết bị (tính bằng các sector 512 byte) vào trong cấu trúc gendisk.
void add_disk(struct gendisk *gd);
Thêm một đĩa vào kernel. Ngay khi hàm này được gọi, các phương thức của đĩa
có thể được kernel gọi thực thi.
int check_disk_change(struct block_device *bdev);
Hàm kernel kiểm tra việc thay đổi thiết bị lưu trữ (media change) trong ổ đĩa được chỉ định và
thực hiện các hành động dọn dẹp cần thiết khi phát hiện sự thay đổi đó.

## include <linux/blkdev.h>

request_queue_t blk_init_queue(request_fn_proc *request, spinlock_t *lock);
void blk_cleanup_queue(request_queue_t *);
Các hàm xử lý việc tạo và xóa hàng đợi request của thiết bị khối.
struct request *elv_next_request(request_queue_t *queue);
void end_request(struct request *req, int success);
elv_next_request lấy request tiếp theo từ hàng đợi request; end_request có thể
được sử dụng trong các trình điều khiển rất đơn giản để đánh dấu việc hoàn thành (hoặc một phần) request.
void blkdev_dequeue_request(struct request *req);
void elv_requeue_request(request_queue_t *queue, struct request *req);
Các hàm loại bỏ request khỏi hàng đợi và đưa nó trở lại nếu cần thiết.
void blk_stop_queue(request_queue_t *queue);
void blk_start_queue(request_queue_t *queue);
Nếu bạn cần ngăn chặn các lời gọi tiếp theo đến phương thức request của mình, gọi blk_stop_queue
sẽ đạt được mục đích đó. Lời gọi blk_start_queue là cần thiết để khiến phương thức request
của bạn được gọi lại một lần nữa.

void blk_queue_bounce_limit(request_queue_t *queue, u64 dma_addr);
void blk_queue_max_sectors(request_queue_t *queue, unsigned short max);
void blk_queue_max_phys_segments(request_queue_t *queue, unsigned short max);
void blk_queue_max_hw_segments(request_queue_t *queue, unsigned short max);
void blk_queue_max_segment_size(request_queue_t *queue, unsigned int max);
blk_queue_segment_boundary(request_queue_t *queue, unsigned long mask);
void blk_queue_dma_alignment(request_queue_t *queue, int mask);
void blk_queue_hardsect_size(request_queue_t *queue, unsigned short max);
Các hàm thiết lập các tham số hàng đợi (queue parameter) khác nhau nhằm kiểm soát cách các request (yêu cầu) được tạo cho một thiết bị cụ thể; các tham số này được mô tả trong phần "Hàm điều khiển hàng đợi (Queue control functions)."

## include <linux/bio.h>

struct bio;

```

Cấu trúc cấp thấp đại diện cho một phần của request I/O khối (block I/O request).

```c

bio_sectors(struct bio *bio);
bio_data_dir(struct bio *bio);

```

Hai macro trả về kích thước và hướng (direction) của một lượt truyền dữ liệu được mô tả bởi một cấu trúc `bio`.

```c

bio_for_each_segment(bvec, bio, segno);

```

Một cấu trúc giả điều khiển (pseudocontrol structure) được sử dụng để lặp qua các phân đoạn (segment) cấu thành nên một cấu trúc `bio`.

```c

char *__bio_kmap_atomic(struct bio *bio, int i, enum km_type type);
void __bio_kunmap_atomic(char *buffer, enum km_type type);

```

`__bio_kmap_atomic` có thể được sử dụng để tạo một địa chỉ ảo nhân (kernel virtual address) cho một segment cho trước bên trong cấu trúc `bio`. Việc ánh xạ này phải được hủy bỏ bằng `__bio_kunmap_atomic`.

```c

struct page *bio_page(struct bio *bio);
int bio_offset(struct bio *bio);
int bio_cur_sectors(struct bio *bio);
char *bio_data(struct bio *bio);
char *bio_kmap_irq(struct bio *bio, unsigned long *flags);
void bio_kunmap_irq(char *buffer, unsigned long *flags);

```

Một tập hợp các macro truy cập (accessor macro) cung cấp quyền truy cập vào segment "hiện tại" bên trong cấu trúc `bio`.

```c

void blk_queue_ordered(request_queue_t *queue, int flag);
int blk_barrier_rq(struct request *req);

```

Gọi `blk_queue_ordered` nếu trình điều khiển (driver) của bạn hỗ trợ các request rào cản (barrier request)—lẽ ra nên làm vậy. Macro `blk_barrier_rq` trả về một giá trị khác không nếu request hiện tại là một barrier request.

`int blk_noretry_request(struct request *req);` Macro này trả về một giá trị khác không nếu request được chỉ định không nên được thử lại (retry) khi xảy ra lỗi. `int end_that_request_first(struct request *req, int success, int count);` `void end_that_request_last(struct request *req);` Sử dụng *end_that_request_first* để chỉ ra việc hoàn thành một phần của block I/O request. Khi hàm đó trả về 0, request đã hoàn tất và nên được chuyển đến *end_that_request_last*. `rq_for_each_bio(bio, request)` Một cấu trúc điều khiển được triển khai bằng macro khác; nó duyệt qua từng `bio` cấu thành nên một request. `int blk_rq_map_sg(request_queue_t *queue, struct request *req, struct scatterlist *list);` Điền vào danh sách `scatterlist` được chỉ định các thông tin cần thiết để ánh xạ các vùng đệm (buffer) trong request cho trước đối với quá trình truyền dữ liệu DMA (DMA transfer). `typedef int (make_request_fn) (request_queue_t *q, struct bio *bio);` Nguyên mẫu (prototype) cho hàm *make_request*. `void bio_endio(struct bio *bio, unsigned int bytes, int error);` Báo hiệu hoàn thành cho một `bio` cho trước. Hàm này chỉ nên được sử dụng nếu driver của bạn lấy `bio` trực tiếp từ tầng khối (block layer) thông qua hàm *make_request*. `request_queue_t *blk_alloc_queue(int flags);` `void blk_queue_make_request(request_queue_t *queue, make_request_fn *func);` Sử dụng *blk_alloc_queue* để cấp phát một hàng đợi request được sử dụng với một hàm *make_request* tùy chỉnh. Hàm đó nên được thiết lập bằng *blk_queue_make_request*. `typedef int (prep_rq_fn) (request_queue_t *queue, struct request *req);` `void blk_queue_prep_rq(request_queue_t *queue, prep_rq_fn *func);` Nguyên mẫu và các hàm thiết lập cho một hàm chuẩn bị lệnh (command preparation function), có thể được sử dụng để chuẩn bị lệnh phần cứng cần thiết trước khi request được chuyển đến hàm *request* của bạn. `int blk_queue_init_tags(request_queue_t *queue, int depth, struct blk_queue_tag *tags);` `int blk_queue_resize_tags(request_queue_t *queue, int new_depth);` `int blk_queue_start_tag(request_queue_t *queue, struct request *req);` `void blk_queue_end_tag(request_queue_t *queue, struct request *req);`

`struct request *blk_queue_find_tag(request_queue_t *qeue, int tag);`

Các hàm hỗ trợ cho các driver sử dụng xếp hàng lệnh có thẻ (tagged command queueing).

```c

void blk_queue_invalidate_tags(request_queue_t *queue);

```
