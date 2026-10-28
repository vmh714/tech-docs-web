# Chương 8: Cấp phát bộ nhớ (Allocating Memory)

Cho đến nay, chúng ta đã sử dụng *kmalloc* và *kfree* để cấp phát và giải phóng bộ nhớ. Tuy nhiên, Linux kernel cung cấp một tập hợp các nguyên thủy cấp phát bộ nhớ phong phú hơn. Trong chương này, chúng ta sẽ xem xét các cách khác để sử dụng bộ nhớ trong trình điều khiển thiết bị (device driver) và cách tối ưu hóa tài nguyên bộ nhớ của hệ thống. Chúng ta sẽ không đi sâu vào việc các kiến trúc khác nhau thực sự quản lý bộ nhớ như thế nào. Các module (module) không tham gia vào các vấn đề phân đoạn (segmentation), phân trang (paging), v.v., vì kernel cung cấp một giao diện quản lý bộ nhớ thống nhất cho các driver. Thêm vào đó, chúng ta sẽ không mô tả các chi tiết bên trong của việc quản lý bộ nhớ trong chương này, mà để dành nó cho Chương 15.

## Bản chất thực sự của kmalloc

Bộ máy cấp phát *kmalloc* là một công cụ mạnh mẽ và dễ học do nó tương tự như *malloc*. Hàm này chạy nhanh (trừ khi nó bị chặn - block) và không xóa vùng bộ nhớ mà nó nhận được; vùng được cấp phát vẫn giữ nguyên nội dung trước đó.\* Vùng được cấp phát cũng nằm liên tục trong bộ nhớ vật lý (physical memory). Trong vài phần tiếp theo, chúng ta sẽ thảo luận chi tiết về *kmalloc*, để bạn có thể so sánh nó với các kỹ thuật cấp phát bộ nhớ mà chúng ta thảo luận sau này.

### Đối số Cờ (The Flags Argument)

Hãy nhớ rằng nguyên mẫu (prototype) cho *kmalloc* là:

```c
## include <linux/slab.h>

void *kmalloc(size_t size, int flags);
```

Trong số những điều khác, điều này ngụ ý rằng bạn nên chủ động xóa sạch bất kỳ bộ nhớ nào có thể bị lộ ra không gian người dùng (user space) hoặc được ghi vào thiết bị; nếu không, bạn có nguy cơ làm rò rỉ thông tin vốn dĩ phải được giữ kín.

Đối số đầu tiên của *kmalloc* là kích thước của khối cần cấp phát. Đối số thứ hai, các cờ cấp phát (allocation flags), thú vị hơn nhiều, bởi vì nó kiểm soát hành vi của *kmalloc* theo nhiều cách khác nhau.

Cờ được sử dụng phổ biến nhất, GFP\_KERNEL, có nghĩa là việc cấp phát (được thực hiện bên trong bằng cách gọi cuối cùng là *\_\_get\_free\_pages*, nguồn gốc của tiền tố GFP\_) được thực hiện thay mặt cho một tiến trình (process) đang chạy trong không gian hạt nhân (kernel space). Nói cách khác, điều này có nghĩa là hàm gọi đang thực thi một lời gọi hệ thống (system call) thay mặt cho một tiến trình. Sử dụng GFP\_KERNEL có nghĩa là *kmalloc* có thể đặt tiến trình hiện tại vào trạng thái ngủ (sleep) để chờ một trang (page) khi được gọi trong các tình huống thiếu bộ nhớ (low-memory situations). Do đó, một hàm cấp phát bộ nhớ sử dụng GFP\_KERNEL phải có khả năng tái nhập (reentrant) và không thể chạy trong ngữ cảnh nguyên tử (atomic context). Trong khi tiến trình hiện tại ngủ, kernel thực hiện hành động thích hợp để định vị một số bộ nhớ trống, bằng cách xả (flush) các bộ đệm xuống đĩa hoặc bằng cách hoán đổi (swap out) bộ nhớ từ một tiến trình người dùng.

GFP\_KERNEL không phải lúc nào cũng là cờ cấp phát phù hợp để sử dụng; đôi khi *kmalloc* được gọi từ bên ngoài ngữ cảnh của tiến trình. Loại lệnh gọi này có thể xảy ra, ví dụ, trong các trình xử lý ngắt (interrupt handler), tasklet, và bộ định thời kernel (kernel timer). Trong trường hợp này, tiến trình hiện tại không được đưa vào trạng thái ngủ, và driver nên sử dụng cờ GFP\_ATOMIC thay thế. Kernel thường cố gắng giữ một số trang trống xung quanh để đáp ứng việc cấp phát nguyên tử. Tuy nhiên, khi sử dụng GFP\_ATOMIC, *kmalloc* có thể sử dụng cả trang trống cuối cùng. Dù vậy, nếu trang cuối cùng đó không tồn tại, việc cấp phát sẽ thất bại.

Các cờ khác có thể được sử dụng thay thế cho hoặc bổ sung cho GFP\_KERNEL và GFP\_ATOMIC, mặc dù hai cờ đó đáp ứng phần lớn nhu cầu của các device driver. Tất cả các cờ được định nghĩa trong *<linux/gfp.h>*, và các cờ riêng lẻ có tiền tố là dấu gạch dưới kép, chẳng hạn như \_ \_GFP\_DMA. Ngoài ra, có các ký hiệu đại diện cho các tổ hợp cờ được sử dụng thường xuyên; chúng không có tiền tố và đôi khi được gọi là *ưu tiên cấp phát* (allocation priorities). Các ưu tiên này bao gồm:

#### GFP\_ATOMIC

Được sử dụng để cấp phát bộ nhớ từ các trình xử lý ngắt và mã nguồn khác bên ngoài ngữ cảnh tiến trình. Không bao giờ ngủ.

#### GFP\_KERNEL

Cấp phát bộ nhớ kernel thông thường. Có thể ngủ.

#### GFP\_USER

Được sử dụng để cấp phát bộ nhớ cho các trang không gian người dùng (user-space pages); nó có thể ngủ.

#### GFP\_HIGHUSER

Giống như GFP\_USER, nhưng cấp phát từ bộ nhớ cao (high memory), nếu có. Bộ nhớ cao được mô tả trong tiểu mục tiếp theo.

#### GFP\_NOIO

#### GFP\_NOFS

Các cờ này hoạt động giống như GFP\_KERNEL, nhưng chúng bổ sung các hạn chế về những gì kernel có thể làm để thỏa mãn yêu cầu. Việc cấp phát GFP\_NOFS không được phép thực hiện bất kỳ lời gọi hệ thống tập tin (filesystem call) nào, trong khi GFP\_NOIO không cho phép khởi tạo bất kỳ hoạt động I/O nào. Chúng được sử dụng chủ yếu trong mã hệ thống tập tin và bộ nhớ ảo (virtual memory) nơi việc cấp phát có thể được phép ngủ, nhưng các lời gọi hệ thống tập tin đệ quy sẽ là một ý tưởng tồi.

Các cờ cấp phát được liệt kê ở trên có thể được bổ sung bằng phép toán OR với bất kỳ cờ nào sau đây, làm thay đổi cách thức tiến hành cấp phát:

\_\_GFP\_DMA

Cờ này yêu cầu việc cấp phát diễn ra trong vùng nhớ có khả năng hỗ trợ DMA (DMA-capable memory zone). Ý nghĩa chính xác phụ thuộc vào nền tảng (platform-dependent) và được giải thích trong phần tiếp theo.

\_\_GFP\_HIGHMEM

Cờ này chỉ ra rằng bộ nhớ được cấp phát có thể nằm trong vùng nhớ cao (high memory).

\_\_GFP\_COLD

Thông thường, trình cấp phát bộ nhớ cố gắng trả về các trang "ấm cache" (cache warm pages)—những trang có nhiều khả năng nằm trong bộ nhớ đệm của bộ xử lý (processor cache). Thay vào đó, cờ này yêu cầu một trang "lạnh" (cold page), loại trang đã không được sử dụng trong một thời gian. Nó hữu ích cho việc cấp phát các trang cho các hoạt động đọc DMA, nơi việc hiện diện trong bộ nhớ đệm bộ xử lý là không hữu ích. Xem phần "Truy cập bộ nhớ trực tiếp" (Direct Memory Access) trong Chương 1 để có thảo luận đầy đủ về cách cấp phát bộ đệm DMA.

\_\_GFP\_NOWARN

Cờ ít khi được sử dụng này ngăn không cho kernel phát ra cảnh báo (bằng *printk*) khi một yêu cầu cấp phát (allocation) không thể được đáp ứng.

\_\_GFP\_HIGH

Cờ này đánh dấu một yêu cầu ưu tiên cao (high-priority request), được phép tiêu thụ ngay cả các trang bộ nhớ (memory page) cuối cùng được kernel dự trữ cho các trường hợp khẩn cấp.

\_\_GFP\_REPEAT

\_\_GFP\_NOFAIL

\_\_GFP\_NORETRY

Các cờ này sửa đổi cách trình cấp phát (allocator) xử lý khi gặp khó khăn trong việc đáp ứng một yêu cầu cấp phát. \_\_GFP\_REPEAT có nghĩa là "cố gắng thêm một chút" bằng cách lặp lại lần thử nhưng việc cấp phát vẫn có thể thất bại. Cờ \_\_GFP\_NOFAIL ra lệnh cho trình cấp phát không bao giờ được thất bại; nó sẽ nỗ lực hết mức cần thiết để đáp ứng yêu cầu. Việc sử dụng \_\_GFP\_NOFAIL bị khuyến cáo mạnh mẽ là không nên; có lẽ sẽ không bao giờ có lý do chính đáng để sử dụng nó trong một driver thiết bị (device driver). Cuối cùng, \_\_GFP\_NORETRY bảo trình cấp phát từ bỏ ngay lập tức nếu bộ nhớ được yêu cầu không có sẵn.

#### Các vùng nhớ (Memory zones)

Cả \_\_GFP\_DMA và \_\_GFP\_HIGHMEM đều có vai trò phụ thuộc vào nền tảng (platform-dependent), mặc dù việc sử dụng chúng là hợp lệ cho tất cả các nền tảng.

Linux kernel nhận biết tối thiểu ba *vùng nhớ* (*memory zones*): bộ nhớ hỗ trợ DMA (DMA-capable memory), bộ nhớ thông thường (normal memory), và bộ nhớ cao (high memory). Mặc dù việc cấp phát thường diễn ra trong

vùng *thông thường* (*normal*), việc thiết lập một trong hai bit vừa đề cập đòi hỏi bộ nhớ phải được cấp phát từ một vùng khác. Ý tưởng là mọi nền tảng máy tính phải nhận biết về các dải nhớ đặc biệt (thay vì coi mọi RAM là tương đương) sẽ rơi vào lớp trừu tượng này.

*Bộ nhớ hỗ trợ DMA* (*DMA-capable memory*) là bộ nhớ nằm trong một dải địa chỉ ưu tiên, nơi các thiết bị ngoại vi có thể thực hiện truy cập DMA. Trên hầu hết các nền tảng hợp lý, tất cả bộ nhớ đều nằm trong vùng này. Trên kiến trúc x86, vùng DMA được sử dụng cho 16 MB RAM đầu tiên, nơi các thiết bị ISA cũ có thể thực hiện DMA; các thiết bị PCI không có giới hạn này.

*Bộ nhớ cao* (*High memory*) là cơ chế được sử dụng để cho phép truy cập vào lượng bộ nhớ (tương đối) lớn trên các nền tảng 32-bit. Bộ nhớ này không thể được truy cập trực tiếp từ kernel nếu không thiết lập trước một ánh xạ đặc biệt (special mapping) và nhìn chung khó làm việc hơn. Tuy nhiên, nếu driver của bạn sử dụng lượng lớn bộ nhớ, nó sẽ hoạt động tốt hơn trên các hệ thống lớn nếu có thể sử dụng bộ nhớ cao. Xem mục "Bộ nhớ cao và thấp" ("High and Low Memory") trong Chương 1 để có mô tả chi tiết về cách thức hoạt động của bộ nhớ cao và cách sử dụng nó.

Bất cứ khi nào một trang mới được cấp phát để thỏa mãn yêu cầu cấp phát bộ nhớ, kernel sẽ xây dựng một danh sách các vùng nhớ có thể được sử dụng trong quá trình tìm kiếm. Nếu \_\_GFP\_DMA được chỉ định, chỉ vùng DMA được tìm kiếm: nếu không có bộ nhớ nào khả dụng ở các địa chỉ thấp, việc cấp phát sẽ thất bại. Nếu không có cờ đặc biệt nào hiện diện, cả bộ nhớ thông thường và DMA đều được tìm kiếm; nếu \_\_GFP\_HIGHMEM được thiết lập, cả ba vùng sẽ được sử dụng để tìm kiếm một trang trống. (Tuy nhiên, lưu ý rằng *kmalloc* không thể cấp phát bộ nhớ cao).

Tình hình sẽ phức tạp hơn trên các hệ thống truy cập bộ nhớ không đồng nhất (NUMA - Non-Uniform Memory Access). Theo nguyên tắc chung, trình cấp phát cố gắng định vị bộ nhớ cục bộ (local) với bộ xử lý thực hiện việc cấp phát, mặc dù có các cách để thay đổi hành vi đó.

Cơ chế đằng sau các vùng nhớ được hiện thực hóa trong *mm/page\_alloc.c*, trong khi việc khởi tạo vùng nhớ nằm trong các tệp cụ thể theo nền tảng, thường nằm trong *mm/init.c* bên trong cây thư mục *arch*. Chúng ta sẽ quay lại các chủ đề này trong Chương 15.

### Đối số Kích thước (The Size Argument)

Kernel quản lý bộ nhớ *vật lý* (physical memory) của hệ thống, vốn chỉ khả dụng theo các khối có kích thước bằng trang (pagesized chunks). Do đó, *kmalloc* trông khá khác biệt so với một cài đặt *malloc* thông thường ở user-space. Một kỹ thuật cấp phát đơn giản, hướng tới vùng nhớ heap (heap-oriented) sẽ nhanh chóng gặp sự cố; nó sẽ rất khó khăn trong việc xử lý các ranh giới trang (page boundaries). Do đó, kernel sử dụng một kỹ thuật cấp phát hướng trang (page-oriented) đặc biệt để tận dụng tối đa RAM của hệ thống.

Linux xử lý việc cấp phát bộ nhớ bằng cách tạo ra một tập hợp các pool chứa các đối tượng bộ nhớ có kích thước cố định. Các yêu cầu cấp phát (allocation requests) được xử lý bằng cách đi đến một pool chứa các đối tượng đủ lớn và trả lại toàn bộ khối bộ nhớ cho bên yêu cầu. Cơ chế quản lý bộ nhớ khá phức tạp và các chi tiết của nó thông thường không quá thú vị đối với các lập trình viên viết trình điều khiển thiết bị (device driver writers).

Tuy nhiên, điều duy nhất mà các lập trình viên driver cần ghi nhớ là kernel chỉ có thể cấp phát một số mảng byte có kích thước cố định, được xác định trước. Nếu bạn yêu cầu một lượng bộ nhớ tùy ý, bạn có thể sẽ nhận được nhiều hơn một chút so với yêu cầu, thậm chí lên đến gấp đôi. Ngoài ra, các lập trình viên nên nhớ rằng khoản cấp phát nhỏ nhất mà *kmalloc* có thể xử lý có kích thước lên tới 32 hoặc 64 byte, tùy thuộc vào kích thước trang được sử dụng bởi kiến trúc của hệ thống.

Có giới hạn trên cho kích thước của các khối bộ nhớ có thể được cấp phát bởi *kmalloc*. Giới hạn đó thay đổi tùy thuộc vào kiến trúc và các tùy chọn cấu hình kernel (kernel configuration options). Nếu mã nguồn của bạn cần tính di động (portable) hoàn toàn, nó không thể trông chờ vào việc có thể cấp phát bất kỳ thứ gì lớn hơn 128 KB. Tuy nhiên, nếu bạn cần nhiều hơn vài kilobyte, có những cách tốt hơn *kmalloc* để lấy bộ nhớ, mà chúng tôi sẽ mô tả sau trong chương này.

## Lookaside Cache (Lookaside Caches)

Một trình điều khiển thiết bị (device driver) thường kết thúc bằng việc cấp phát nhiều đối tượng có cùng kích thước, lặp đi lặp lại. Cho rằng kernel đã duy trì sẵn một tập hợp các pool bộ nhớ gồm các đối tượng có cùng kích thước, tại sao không thêm một số pool đặc biệt cho các đối tượng có tần suất sử dụng cao này? Trên thực tế, kernel thực sự cài đặt một cơ sở hạ tầng (facility) để tạo ra loại pool này, thường được gọi là *lookaside cache*. Các device driver thông thường không biểu hiện loại hành vi sử dụng bộ nhớ đủ để biện minh cho việc dùng lookaside cache, nhưng vẫn có các ngoại lệ; các driver USB và SCSI trong Linux 2.6 có sử dụng các cache này.

Trình quản lý cache trong Linux kernel đôi khi được gọi là "slab allocator". Vì lý do đó, các hàm và kiểu dữ liệu của nó được khai báo trong *<linux/slab.h>*. Slab allocator cài đặt các cache có kiểu là kmem\_cache\_t; chúng được tạo bằng lời gọi hàm *kmem\_cache\_create*:

```c
kmem_cache_t *kmem_cache_create(const char *name, size_t size,
 size_t offset,
 unsigned long flags,
 void (*constructor)(void *, kmem_cache_t *,
 unsigned long flags),
 void (*destructor)(void *, kmem_cache_t *,
 unsigned long flags));
```

Hàm này tạo ra một đối tượng cache mới có thể chứa bất kỳ số lượng vùng nhớ nào có cùng kích thước, được chỉ định bởi đối số `size`. Đối số `name` được liên kết với cache này và hoạt động như thông tin quản lý nội bộ (housekeeping information) hữu ích trong việc theo dõi lỗi; thông thường, nó được đặt thành tên của kiểu cấu trúc được cache. Cache lưu giữ một con trỏ trỏ đến tên thay vì sao chép nó, vì vậy driver nên truyền vào một con trỏ trỏ đến một tên nằm trong bộ nhớ tĩnh (static storage) (thường tên chỉ là một chuỗi ký tự hằng - literal string). Tên không được chứa khoảng trắng.

Đối số `offset` là phần bù (offset) của đối tượng đầu tiên trong trang; nó có thể được sử dụng để đảm bảo sự căn chỉnh (alignment) cụ thể cho các đối tượng được cấp phát, nhưng rất có thể bạn sẽ dùng 0 để yêu cầu giá trị mặc định. `flags` kiểm soát cách thức cấp phát được thực hiện và là một mặt nạ bit (bit mask) của các cờ sau:

#### SLAB\_NO\_REAP

Thiết lập cờ này bảo vệ cache khỏi bị thu hẹp khi hệ thống đang tìm kiếm bộ nhớ. Thiết lập cờ này thông thường là một ý tồi; việc tránh hạn chế quyền tự do hành động của trình cấp phát bộ nhớ (memory allocator) một cách không cần thiết là rất quan trọng.

#### SLAB\_HWCACHE\_ALIGN

Cờ này yêu cầu mỗi đối tượng dữ liệu phải được căn chỉnh theo một dòng cache (cache line); việc căn chỉnh thực tế phụ thuộc vào bố cục cache của nền tảng phần cứng chủ (host platform). Tùy chọn này có thể là một lựa chọn tốt nếu cache của bạn chứa các mục được truy cập thường xuyên trên các máy SMP. Tuy nhiên, phần đệm (padding) cần thiết để đạt được sự căn chỉnh dòng cache cuối cùng có thể làm lãng phí một lượng đáng kể bộ nhớ.

#### SLAB\_CACHE\_DMA

Cờ này yêu cầu mỗi đối tượng dữ liệu phải được cấp phát trong vùng nhớ DMA (DMA memory zone).

Ngoài ra còn có một tập hợp các cờ có thể được sử dụng trong quá trình gỡ lỗi (debugging) việc cấp phát cache; hãy xem *mm/slab.c* để biết chi tiết. Tuy nhiên, thông thường các cờ này được thiết lập toàn cục thông qua một tùy chọn cấu hình kernel trên các hệ thống dùng để phát triển.

Các đối số `constructor` và `destructor` của hàm là các hàm tùy chọn (nhưng không thể có destructor nếu không có constructor); hàm trước có thể được sử dụng để khởi tạo các đối tượng mới được cấp phát, và hàm sau có thể được sử dụng để "dọn dẹp" (clean up) các đối tượng trước khi bộ nhớ của chúng được giải phóng trở lại cho toàn bộ hệ thống.

Các hàm khởi tạo (constructor) và hủy (destructor) có thể hữu ích, nhưng có một vài ràng buộc mà bạn nên ghi nhớ. Một constructor được gọi khi bộ nhớ cho một tập hợp các đối tượng được cấp phát (allocate); bởi vì vùng nhớ đó có thể chứa nhiều đối tượng, constructor có thể được gọi nhiều lần. Bạn không thể giả định rằng constructor sẽ được gọi như một hiệu ứng tức thời của việc cấp phát một đối tượng. Tương tự, destructor có thể được gọi vào một thời điểm nào đó trong tương lai không xác định, chứ không phải ngay sau khi một đối tượng được giải phóng (free). Các constructor và destructor có thể được phép hoặc không được phép đưa tiến trình vào trạng thái ngủ (sleep), tùy thuộc vào việc chúng có được truyền cờ `SLAB_CTOR_ATOMIC` hay không (trong đó CTOR là viết tắt của *constructor*).

Để thuận tiện, một lập trình viên có thể sử dụng cùng một hàm cho cả constructor và destructor; bộ phân bổ slab (slab allocator) luôn truyền cờ `SLAB_CTOR_CONSTRUCTOR` khi hàm được gọi là constructor.

Một khi bộ nhớ đệm (cache) các đối tượng đã được tạo, bạn có thể cấp phát các đối tượng từ đó bằng cách gọi `kmem_cache_alloc`:

```c
void *kmem_cache_alloc(kmem_cache_t *cache, int flags);
```

Ở đây, đối số `cache` là bộ nhớ đệm mà bạn đã tạo trước đó; các `flags` giống như các cờ bạn sẽ truyền cho `kmalloc` và sẽ được tham khảo nếu `kmem_cache_alloc` cần phải tự đi ra ngoài và cấp phát thêm bộ nhớ.

Để giải phóng một đối tượng, hãy sử dụng `kmem_cache_free`:

```c
 void kmem_cache_free(kmem_cache_t *cache, const void *obj);
```

Khi mã nguồn trình điều khiển (driver code) đã hoàn tất việc sử dụng cache, thường là khi module được gỡ bỏ (unload), nó nên giải phóng cache của mình như sau:

```c
 int kmem_cache_destroy(kmem_cache_t *cache);
```

Thao tác hủy (destroy) chỉ thành công nếu tất cả các đối tượng được cấp phát từ cache đã được trả lại cho nó. Do đó, một module nên kiểm tra trạng thái trả về từ `kmem_cache_destroy`; một thất bại cho thấy một số loại rò rỉ bộ nhớ (memory leak) bên trong module (vì một số đối tượng đã bị bỏ sót).

Một lợi ích phụ của việc sử dụng các lookaside cache là kernel duy trì các số liệu thống kê (statistics) về việc sử dụng cache. Các số liệu thống kê này có thể lấy từ `/proc/slabinfo`.

### Một scull dựa trên các Slab Cache: scullc

Đã đến lúc cho một ví dụ. *scullc* là một phiên bản rút gọn của module *scull* chỉ thực hiện thiết bị tối giản — vùng nhớ bền vững (persistent memory region). Không giống như *scull* — sử dụng `kmalloc`, *scullc* sử dụng memory cache. Kích thước của lượng tử (quantum) có thể được sửa đổi tại thời điểm biên dịch (compile time) và tại thời điểm nạp (load time), nhưng không phải tại thời điểm chạy (runtime) — điều đó sẽ đòi hỏi phải tạo một memory cache mới, và chúng ta không muốn giải quyết những chi tiết thừa thãi này.

*scullc* là một ví dụ hoàn chỉnh có thể được sử dụng để dùng thử bộ phân bổ slab (slab allocator). Nó khác biệt với *scull* chỉ ở một vài dòng mã nguồn. Đầu tiên, chúng ta phải khai báo slab cache của riêng mình:

```c
/* khai báo một con trỏ cache: sử dụng nó cho tất cả các thiết bị */
kmem_cache_t *scullc_cache;
```

Việc tạo slab cache được xử lý (tại thời điểm nạp module) theo cách này:

```c
/* scullc_init: tạo một cache cho các lượng tử của chúng ta */
scullc_cache = kmem_cache_create("scullc", scullc_quantum,
 0, SLAB_HWCACHE_ALIGN, NULL, NULL); /* không có ctor/dtor */
if (!scullc_cache) {
 scullc_cleanup( );
 return -ENOMEM;
}
```

Đây là cách nó cấp phát các lượng tử bộ nhớ:

```c
/* Cấp phát một lượng tử bằng cách sử dụng memory cache */
if (!dptr->data[s_pos]) {
 dptr->data[s_pos] = kmem_cache_alloc(scullc_cache, GFP_KERNEL);
 if (!dptr->data[s_pos])
 goto nomem;
 memset(dptr->data[s_pos], 0, scullc_quantum);
}
```

Và các dòng này giải phóng bộ nhớ:

```c
for (i = 0; i < qset; i++)
if (dptr->data[i])
 kmem_cache_free(scullc_cache, dptr->data[i]);
```

Cuối cùng, tại thời điểm gỡ bỏ module, chúng ta phải trả lại cache cho hệ thống:

```c
/* scullc_cleanup: giải phóng cache các lượng tử của chúng ta */
if (scullc_cache)
 kmem_cache_destroy(scullc_cache);
```

Sự khác biệt chính khi chuyển từ *scull* sang *scullc* là cải thiện nhẹ về tốc độ và sử dụng bộ nhớ tốt hơn. Vì các lượng tử được cấp phát từ một vùng (pool) chứa các phân đoạn bộ nhớ có kích thước chính xác, vị trí của chúng trong bộ nhớ dày đặc nhất có thể, trái ngược với các lượng tử của *scull*, vốn mang lại sự phân mảnh bộ nhớ không thể đoán trước (unpredictable memory fragmentation).

### Memory Pools (Vùng nhớ đệm)

Có những nơi trong nhân hệ điều hành (kernel) mà các thao tác cấp phát bộ nhớ (memory allocation) không được phép thất bại. Để đảm bảo việc cấp phát trong các tình huống đó, các nhà phát triển kernel đã tạo ra một sự trừu tượng hóa (abstraction) được gọi là *memory pool* (hoặc "mempool"). Memory pool thực chất chỉ là một dạng của lookaside cache luôn cố gắng duy trì sẵn một danh sách bộ nhớ trống để sử dụng trong các trường hợp khẩn cấp (emergency).

Một memory pool có kiểu `mempool_t` (được định nghĩa trong *<linux/mempool.h>*); bạn có thể tạo một pool bằng hàm *mempool_create*:

```
mempool_t *mempool_create(int min_nr,
 mempool_alloc_t *alloc_fn,
 mempool_free_t *free_fn,
 void *pool_data);
```

Tham số `min_nr` là số lượng đối tượng (object) được cấp phát tối thiểu mà pool phải luôn duy trì sẵn. Việc cấp phát và giải phóng thực tế các đối tượng được xử lý bởi `alloc_fn` và `free_fn`, có các nguyên mẫu (prototype) sau:

```
typedef void *(mempool_alloc_t)(int gfp_mask, void *pool_data);
typedef void (mempool_free_t)(void *element, void *pool_data);
```

Tham số cuối cùng của *mempool_create* (`pool_data`) được truyền vào `alloc_fn` và `free_fn`.

Nếu cần thiết, bạn có thể viết các hàm chuyên dụng để xử lý việc cấp phát bộ nhớ cho mempool. Tuy nhiên, thông thường bạn chỉ muốn để slab allocator của kernel xử lý tác vụ đó giúp bạn. Có hai hàm (*mempool_alloc_slab* và *mempool_free_slab*) thực hiện việc khớp trở kháng (impedance matching) giữa các nguyên mẫu cấp phát của memory pool với *kmem_cache_alloc* và *kmem_cache_free*. Do đó, mã nguồn thiết lập memory thường trông giống như sau:

```
cache = kmem_cache_create(. . .);
pool = mempool_create(MY_POOL_MINIMUM,
 mempool_alloc_slab, mempool_free_slab,
 cache);
```

Sau khi pool được tạo, các đối tượng có thể được cấp phát và giải phóng bằng:

```
void *mempool_alloc(mempool_t *pool, int gfp_mask);
void mempool_free(void *element, mempool_t *pool);
```

Khi mempool được tạo, hàm cấp phát sẽ được gọi đủ số lần để tạo ra một pool gồm các đối tượng được cấp phát trước (preallocated object). Sau đó, các lời gọi đến *mempool_alloc* sẽ cố gắng lấy thêm các đối tượng từ hàm cấp phát; nếu việc cấp phát đó thất bại, một trong các đối tượng được cấp phát trước (nếu còn sót lại) sẽ được trả về. Khi một đối tượng được giải phóng bằng *mempool_free*, nó sẽ được giữ lại trong pool nếu số lượng đối tượng được cấp phát trước hiện đang thấp hơn mức tối thiểu; ngược lại, nó sẽ được trả về hệ thống.

Một mempool có thể được thay đổi kích thước bằng hàm:

```
int mempool_resize(mempool_t *pool, int new_min_nr, int gfp_mask);
```

Lời gọi này, nếu thành công, sẽ thay đổi kích thước pool có ít nhất là `new_min_nr` đối tượng.

Nếu bạn không còn cần đến memory pool nữa, hãy trả nó về hệ thống bằng:

```
void mempool_destroy(mempool_t *pool);
```

Bạn phải trả lại tất cả các đối tượng đã cấp phát trước khi hủy mempool, nếu không sẽ dẫn đến lỗi kernel oops.

Nếu bạn đang cân nhắc sử dụng mempool trong trình điều khiển (driver) của mình, hãy ghi nhớ một điều: mempool cấp phát một khối bộ nhớ nằm trong một danh sách, ở trạng thái nhàn rỗi (idle) và không khả dụng cho bất kỳ mục đích thực tế nào khác. Rất dễ tiêu tốn một lượng lớn bộ nhớ với mempool. Trong hầu hết mọi trường hợp, giải pháp thay thế được ưu tiên là không dùng mempool và thay vào đó hãy xử lý khả năng cấp phát thất bại. Nếu trình điều khiển của bạn có bất kỳ cách nào để phản ứng với việc cấp phát thất bại mà không làm tổn hại đến tính toàn vẹn của hệ thống, hãy làm theo cách đó. Việc sử dụng mempool trong mã nguồn driver nên rất hạn chế.

## get\_free\_page và các hàm liên quan

Nếu một module cần cấp phát các khối bộ nhớ lớn, thường thì tốt hơn hết là sử dụng kỹ thuật hướng trang (page-oriented). Việc yêu cầu các trang bộ nhớ nguyên vẹn cũng mang lại những ưu điểm khác, được giới thiệu trong Chương 15.

Để cấp phát các trang, các hàm sau có sẵn:

```
get_zeroed_page(unsigned int flags);
```

Trả về một con trỏ trỏ đến trang mới và làm sạch trang đó bằng các giá trị bằng 0 (zero-fill).

```
__get_free_page(unsigned int flags);
```

Tương tự như *get_zeroed_page*, nhưng không xóa sạch (clear) trang.

```
__get_free_pages(unsigned int flags, unsigned int order);
```

Cấp phát và trả về một con trỏ trỏ đến byte đầu tiên của một vùng nhớ có khả năng dài bằng nhiều trang (liên tục về mặt vật lý - physically contiguous) nhưng không làm sạch vùng nhớ đó.

Tham số `flags` hoạt động theo cách tương tự như với *kmalloc*; thường thì `GFP_KERNEL` hoặc `GFP_ATOMIC` được sử dụng, có thể được bổ sung thêm cờ `__GFP_DMA` (đối với bộ nhớ có thể được sử dụng cho các thao tác truy cập bộ nhớ trực tiếp - direct-memory-access của ISA) hoặc `__GFP_HIGHMEM` khi có thể sử dụng bộ nhớ cao (high memory).\* `order` là logarit cơ số 2 của số lượng trang bạn đang yêu cầu hoặc giải phóng (tức là $\log_2 N$). Ví dụ, `order` bằng 0 nếu bạn muốn một trang và bằng 3 nếu bạn yêu cầu tám trang. Nếu `order` quá lớn (không có vùng liên tục nào có kích thước đó khả dụng), việc cấp phát trang sẽ thất bại. Hàm *get_order*, nhận một tham số số nguyên, có thể được sử dụng để trích xuất `order` từ một kích thước (phải là lũy thừa của 2) cho nền tảng phần cứng đang chạy. Giá trị tối đa cho phép của `order` là 10 hoặc 11 (tương ứng với 1024 hoặc 2048 trang), tùy thuộc vào kiến trúc (architecture). Tuy nhiên, khả năng thành công của việc cấp phát `order-10` trên bất kỳ hệ thống nào khác ngoài một hệ thống vừa mới khởi động (freshly booted) với rất nhiều bộ nhớ trống là rất thấp.

Nếu bạn tò mò, */proc/buddyinfo* cho biết có bao nhiêu khối (block) thuộc mỗi bậc (order) có sẵn cho từng vùng bộ nhớ (memory zone) trên hệ thống.

Khi một chương trình đã dùng xong các trang (page), nó có thể giải phóng chúng bằng một trong các hàm sau. Hàm đầu tiên là một macro dựa trên nền tảng của hàm thứ hai:

```c
void free_page(unsigned long addr);
void free_pages(unsigned long addr, unsigned long order);
```

Nếu bạn cố gắng giải phóng một số lượng trang khác với số lượng đã cấp phát, bản đồ bộ nhớ (memory map) sẽ bị hỏng, và hệ thống sẽ gặp sự cố vào một thời điểm sau đó.

Cần nhấn mạnh rằng `__get_free_pages` và các hàm khác có thể được gọi tại bất kỳ thời điểm nào, tuân theo các quy tắc tương tự như chúng ta đã thấy đối với `kmalloc`. Các hàm này có thể không cấp phát được bộ nhớ trong một số hoàn cảnh nhất định, đặc biệt là khi sử dụng `GFP_ATOMIC`. Do đó, chương trình gọi các hàm cấp phát này phải chuẩn bị sẵn sàng để xử lý lỗi cấp phát.

Mặc dù `kmalloc(GFP_KERNEL)` đôi khi thất bại khi không có sẵn bộ nhớ, kernel vẫn cố gắng hết sức để đáp ứng các yêu cầu cấp phát. Do đó, rất dễ làm suy giảm khả năng phản hồi của hệ thống nếu cấp phát quá nhiều bộ nhớ. Ví dụ, bạn có thể làm sập máy tính bằng cách đẩy quá nhiều dữ liệu vào một thiết bị *scull*; hệ thống bắt đầu chạy ì ạch trong khi cố gắng hoán đổi (swap out) càng nhiều càng tốt để đáp ứng yêu cầu `kmalloc`. Vì mọi tài nguyên đều đang bị hút cạn bởi thiết bị phình to đó, máy tính nhanh chóng trở nên không thể sử dụng được; tại thời điểm đó, bạn thậm chí không thể khởi động một tiến trình (process) mới để cố gắng giải quyết vấn đề. Chúng ta không giải quyết vấn đề này trong *scull*, vì nó chỉ là một mô-đun mẫu chứ không phải là một công cụ thực tế để đưa vào hệ thống đa người dùng (multiuser system). Tuy nhiên, với tư cách là một lập trình viên, bạn vẫn phải cẩn thận, bởi vì một mô-đun là mã đặc quyền (privileged code) và có thể mở ra các lỗ hổng bảo mật mới trong hệ thống (khả năng cao nhất là lỗ hổng từ chối dịch vụ - denial-of-service giống như trường hợp vừa nêu).

Mặc dù `alloc_pages` (sẽ được mô tả ngay sau đây) thực sự nên được sử dụng để cấp phát các trang bộ nhớ vùng cao (high-memory pages), vì những lý do mà chúng ta chưa thể thảo luận kỹ cho đến Chương 15.

### Một scull sử dụng toàn bộ trang: scullp

Để kiểm tra việc cấp phát trang một cách thực tế, chúng tôi đã phát hành mô-đun *scullp* cùng với mã nguồn mẫu khác. Đây là một phiên bản *scull* thu gọn, giống như *scullc* đã giới thiệu trước đó.

Các lượng tử bộ nhớ (memory quanta) được cấp phát bởi *scullp* là các trang toàn vẹn hoặc tập hợp trang: biến `scullp_order` mặc định là 0 nhưng có thể thay đổi tại thời điểm biên dịch (compile time) hoặc thời điểm nạp (load time).

Các dòng sau đây cho thấy cách nó cấp phát bộ nhớ:

```c
/* Đây là việc cấp phát một lượng tử đơn lẻ */
if (!dptr->data[s_pos]) {
 dptr->data[s_pos] =
 (void *)__get_free_pages(GFP_KERNEL, dptr->order);
 if (!dptr->data[s_pos])
 goto nomem;
 memset(dptr->data[s_pos], 0, PAGE_SIZE << dptr->order);
}
```

Mã nguồn để thu hồi bộ nhớ trong *scullp* trông như thế này:

```c
/* Đoạn mã này giải phóng toàn bộ một tập hợp lượng tử */
for (i = 0; i < qset; i++)
 if (dptr->data[i])
 free_pages((unsigned long)(dptr->data[i]),
 dptr->order);
```

Ở tầng người dùng (user level), sự khác biệt cảm nhận được chủ yếu là sự cải thiện về tốc độ và việc sử dụng bộ nhớ tốt hơn, bởi vì không có hiện tượng phân mảnh nội bộ (internal fragmentation) của bộ nhớ. Chúng tôi đã chạy một số thử nghiệm sao chép 4 MB từ *scull0* sang *scull1* và sau đó từ *scullp0* sang *scullp1*; kết quả cho thấy một sự cải thiện nhỏ trong việc sử dụng bộ xử lý ở không gian kernel (kernel-space processor usage).

Sự cải thiện hiệu năng không quá kịch tính, bởi vì `kmalloc` được thiết kế để hoạt động nhanh. Lợi ích chính của việc cấp phát ở cấp độ trang không thực sự là tốc độ, mà là việc sử dụng bộ nhớ hiệu quả hơn. Việc cấp phát theo trang không làm lãng phí bộ nhớ, trong khi việc sử dụng `kmalloc` làm lãng phí một lượng bộ nhớ không thể đoán trước do độ mịn của kích thước cấp phát (allocation granularity).

Nhưng ưu điểm lớn nhất của các hàm `__get_free_page` là các trang nhận được hoàn toàn thuộc về bạn, và về lý thuyết, bạn có thể tập hợp các trang thành một vùng tuyến tính (linear area) bằng cách tinh chỉnh phù hợp các bảng trang (page tables). Ví dụ, bạn có thể cho phép một tiến trình người dùng thực hiện `mmap` các vùng bộ nhớ lấy được dưới dạng các trang đơn lẻ không liên quan đến nhau. Chúng ta sẽ thảo luận về loại thao tác này trong Chương 15, nơi chúng tôi trình bày cách *scullp* cung cấp tính năng ánh xạ bộ nhớ (memory mapping), thứ mà *scull* không thể cung cấp.

### Giao diện alloc\_pages

Để tính toàn vẹn, chúng tôi giới thiệu một giao diện cấp phát bộ nhớ khác, mặc dù chúng ta chưa sẵn sàng sử dụng nó cho đến sau Chương 15. Hiện tại, chỉ cần hiểu rằng `struct page` là một cấu trúc nhân (kernel structure) nội bộ mô tả một trang (page) bộ nhớ. Như chúng ta sẽ thấy, có rất nhiều nơi trong kernel cần làm việc với các cấu trúc trang; chúng đặc biệt hữu ích trong bất kỳ tình huống nào bạn có thể phải xử lý bộ nhớ cao (high memory), vốn không có một địa chỉ cố định trong không gian nhân (kernel space).

Cốt lõi *thực sự* của trình cấp phát trang (page allocator) Linux là một hàm có tên là *alloc\_pages\_node*:

```c
struct page *alloc_pages_node(int nid, unsigned int flags,
 unsigned int order);
```

Hàm này cũng có hai biến thể (vốn chỉ là các macro); đây là các phiên bản mà bạn rất có thể sẽ sử dụng:

```c
struct page *alloc_pages(unsigned int flags, unsigned int order);
struct page *alloc_page(unsigned int flags);
```

Hàm cốt lõi, *alloc\_pages\_node*, nhận ba đối số. `nid` là ID của NUMA node\* có bộ nhớ cần cấp phát, `flags` là các cờ cấp phát `GFP_` thông thường và `order` là kích thước của vùng cấp phát. Giá trị trả về là một con trỏ trỏ đến cấu trúc trang đầu tiên (có thể có nhiều trang) mô tả bộ nhớ được cấp phát, hoặc như thường lệ, trả về `NULL` nếu thất bại.

*alloc\_pages* đơn giản hóa tình huống bằng cách cấp phát bộ nhớ trên NUMA node hiện tại (nó gọi *alloc\_pages\_node* với giá trị trả về từ *numa\_node\_id* làm tham số `nid`). Và tất nhiên, *alloc\_page* bỏ qua tham số `order` và cấp phát một trang duy nhất.

Để giải phóng các trang được cấp phát theo cách này, bạn nên sử dụng một trong các hàm sau:

```c
void __free_page(struct page *page);
void __free_pages(struct page *page, unsigned int order);
void free_hot_page(struct page *page);
void free_cold_page(struct page *page);
```

Nếu bạn có kiến thức cụ thể về việc liệu nội dung của một trang đơn có khả năng nằm trong bộ nhớ đệm của bộ vi xử lý (processor cache) hay không, bạn nên thông báo điều đó cho kernel bằng *free\_hot\_page* (đối với các trang nằm trong cache) hoặc *free\_cold\_page*. Thông tin này giúp trình cấp phát bộ nhớ tối ưu hóa việc sử dụng bộ nhớ trên toàn hệ thống.

## vmalloc và các hàm liên quan

Hàm cấp phát bộ nhớ tiếp theo mà chúng tôi giới thiệu cho bạn là *vmalloc*, hàm này cấp phát một vùng nhớ liên tục trong không gian địa chỉ *ảo* (*virtual* address space). Mặc dù các trang không liên tiếp nhau trong bộ nhớ vật lý (mỗi trang được lấy bằng một lời gọi riêng biệt tới *alloc\_page*), nhưng kernel nhìn nhận chúng như một dải địa chỉ liên tục. *vmalloc* trả về 0 (địa chỉ `NULL`) nếu xảy ra lỗi, mặt khác, nó trả về một con trỏ trỏ đến vùng nhớ tuyến tính có kích thước ít nhất là `size`.

Máy tính NUMA (truy cập bộ nhớ không đồng nhất - nonuniform memory access) là các hệ thống đa vi xử lý (multiprocessor systems) nơi bộ nhớ là "cục bộ" (local) đối với các nhóm bộ xử lý cụ thể ("node"). Việc truy cập bộ nhớ cục bộ nhanh hơn so với việc truy cập bộ nhớ không phải cục bộ. Trên các hệ thống như vậy, việc cấp phát bộ nhớ trên đúng node là rất quan trọng. Tuy nhiên, các tác giả viết trình điều khiển (driver) thường không phải lo lắng về các vấn đề NUMA.

Chúng tôi mô tả *vmalloc* ở đây vì nó là một trong những cơ chế cấp phát bộ nhớ cơ bản của Linux. Tuy nhiên, chúng ta cần lưu ý rằng việc sử dụng *vmalloc* không được khuyến khích trong hầu hết các tình huống. Bộ nhớ lấy từ *vmalloc* kém hiệu quả hơn một chút khi làm việc, và trên một số kiến trúc, lượng không gian địa chỉ dành riêng cho *vmalloc* là tương đối nhỏ. Mã nguồn sử dụng *vmalloc* có thể sẽ nhận được sự đón nhận lạnh nhạt nếu được gửi để đưa vào kernel. Nếu có thể, bạn nên làm việc trực tiếp với từng trang riêng lẻ thay vì cố gắng giải quyết mọi thứ bằng *vmalloc*.

Đã nói như vậy, chúng ta hãy xem *vmalloc* hoạt động như thế nào. Các nguyên mẫu (prototype) của hàm này và các hàm họ hàng của nó (*ioremap*, vốn không hoàn toàn là một hàm cấp phát, được thảo luận sau trong phần này) như sau:

```c
## include <linux/vmalloc.h>
void *vmalloc(unsigned long size);
void vfree(void *addr);
void *ioremap(unsigned long offset, unsigned long size);
void iounmap(void *addr);
```

Cần nhấn mạnh rằng các địa chỉ bộ nhớ do *kmalloc* và *\_\_get\_free\_pages* trả về cũng là các địa chỉ ảo. Giá trị thực tế của chúng vẫn được xử lý bởi MMU (đơn vị quản lý bộ nhớ - memory management unit, thường là một phần của CPU) trước khi được sử dụng để truy cập bộ nhớ vật lý.\* *vmalloc* không khác biệt ở cách nó sử dụng phần cứng, mà khác ở cách kernel thực hiện tác vụ cấp phát.

Dải địa chỉ (ảo) được sử dụng bởi *kmalloc* và *\_\_get\_free\_pages* có đặc điểm ánh xạ một-một (one-to-one mapping) tới bộ nhớ vật lý, có thể bị dịch chuyển một giá trị `PAGE_OFFSET` không đổi; các hàm không cần phải sửa đổi bảng trang (page tables) cho dải địa chỉ đó. Ngược lại, dải địa chỉ được sử dụng bởi *vmalloc* và *ioremap* hoàn toàn là nhân tạo (synthetic), và mỗi lần cấp phát sẽ xây dựng vùng nhớ (ảo) bằng cách thiết lập các bảng trang một cách thích hợp.

Sự khác biệt này có thể nhận thấy bằng cách so sánh các con trỏ do các hàm cấp phát trả về. Trên một số nền tảng (ví dụ: x86), các địa chỉ do *vmalloc* trả về nằm ngay sau các địa chỉ mà *kmalloc* sử dụng. Trên các nền tảng khác (ví dụ: MIPS, IA-64 và x86\_64), chúng thuộc về một dải địa chỉ hoàn toàn khác. Các địa chỉ có sẵn cho *vmalloc* nằm trong khoảng từ `VMALLOC_START` đến `VMALLOC_END`. Cả hai ký hiệu này đều được định nghĩa trong *<asm/pgtable.h>*.

Các địa chỉ được cấp phát bởi *vmalloc* không thể được sử dụng bên ngoài vi xử lý (microprocessor), bởi vì chúng chỉ có ý nghĩa khi đi qua MMU (Memory Management Unit) của bộ xử lý. Khi một trình điều khiển (driver) cần một địa chỉ vật lý (physical address) thực sự (chẳng hạn như địa chỉ DMA, được sử dụng bởi phần cứng ngoại vi để điều khiển bus của hệ thống), bạn không thể sử dụng *vmalloc* một cách đơn giản. Thời điểm thích hợp để gọi *vmalloc* là khi

Thực tế, một số kiến trúc định nghĩa các dải địa chỉ "ảo" (virtual address) được dành riêng để trỏ tới bộ nhớ vật lý. Khi điều này xảy ra, Linux kernel tận dụng tính năng đó, và cả địa chỉ của kernel lẫn *\_\_get\_free\_pages* đều nằm trong một trong những dải bộ nhớ đó. Sự khác biệt này là trong suốt đối với các device driver và mã nguồn khác không tham gia trực tiếp vào hệ thống con quản lý bộ nhớ (memory-management kernel subsystem) của kernel.

bạn đang cấp phát bộ nhớ cho một vùng đệm tuần tự lớn (large sequential buffer) chỉ tồn tại ở phần mềm. Điều quan trọng cần lưu ý là *vmalloc* có overhead lớn hơn *\_\_get\_free\_pages*, bởi vì nó phải vừa thu hồi bộ nhớ vừa xây dựng các bảng trang (page table). Do đó, việc gọi *vmalloc* chỉ để cấp phát một trang (page) duy nhất là không hợp lý.

Một ví dụ về hàm trong kernel sử dụng *vmalloc* là system call (lời gọi hệ thống) *create\_module*, hàm này sử dụng *vmalloc* để lấy không gian cho module đang được tạo. Mã nguồn và dữ liệu của module sau đó được sao chép vào không gian đã cấp phát bằng cách sử dụng *copy\_from\_user*. Bằng cách này, module có vẻ như được tải vào bộ nhớ liên tục (contiguous memory). Bạn có thể xác minh, bằng cách xem trong */proc/kallsyms*, rằng các ký hiệu kernel (kernel symbol) được xuất ra bởi các module nằm ở một dải bộ nhớ khác với các ký hiệu được xuất ra bởi bản thân kernel.

Bộ nhớ được cấp phát bằng *vmalloc* được giải phóng bởi *vfree*, tương tự như cách *kfree* giải phóng bộ nhớ được cấp phát bởi *kmalloc*.

Giống như *vmalloc*, *ioremap* xây dựng các page table mới; tuy nhiên, không giống như *vmalloc*, nó không thực sự cấp phát bất kỳ bộ nhớ nào. Giá trị trả về của *ioremap* là một địa chỉ ảo đặc biệt có thể được sử dụng để truy cập dải địa chỉ vật lý được chỉ định; địa chỉ ảo thu được cuối cùng sẽ được giải phóng bằng cách gọi *iounmap*.

*ioremap* hữu ích nhất trong việc ánh xạ (map) địa chỉ (vật lý) của một PCI buffer vào không gian kernel ảo (virtual kernel space). Ví dụ, nó có thể được sử dụng để truy cập bộ đệm khung (frame buffer) của một thiết bị video PCI; các bộ đệm như vậy thường được ánh xạ ở các địa chỉ vật lý cao, nằm ngoài dải địa chỉ mà kernel xây dựng các page table vào thời điểm khởi động (boot time). Các vấn đề về PCI được giải thích chi tiết hơn trong Chương 12.

Cần lưu ý rằng vì lý do tính di động (portability), bạn không nên trực tiếp truy cập các địa chỉ do *ioremap* trả về như thể chúng là các con trỏ bộ nhớ (pointer). Thay vào đó, bạn nên luôn sử dụng *readb* và các hàm I/O khác đã được giới thiệu trong Chương 9. Yêu cầu này áp dụng vì một số nền tảng, chẳng hạn như Alpha, không thể ánh xạ trực tiếp các vùng nhớ PCI vào không gian địa chỉ bộ xử lý do có sự khác biệt giữa thông số kỹ thuật PCI và bộ xử lý Alpha trong cách dữ liệu được truyền tải.

Cả *ioremap* và *vmalloc* đều định hướng theo trang (page oriented) — chúng hoạt động bằng cách sửa đổi các page table; do đó, kích thước được định vị lại hoặc cấp phát sẽ được làm tròn lên ranh giới trang gần nhất (*page boundary*). *ioremap* mô phỏng một ánh xạ không canh lề (unaligned mapping) bằng cách "làm tròn xuống" (rounding down) địa chỉ cần ánh xạ lại và trả về một offset nằm trong trang được ánh xạ lại đầu tiên.

Một nhược điểm nhỏ của *vmalloc* là nó không thể được sử dụng trong ngữ cảnh nguyên tử (atomic context) bởi vì, ở bên trong, nó sử dụng *kmalloc(GFP\_KERNEL)* để lấy không gian lưu trữ cho các page table, và do đó có thể gây ngủ (sleep). Điều này không phải là vấn đề lớn — nếu việc sử dụng *\_\_get\_free\_page* chưa đủ tốt cho một trình xử lý ngắt (interrupt handler), thì thiết kế phần mềm cần phải được tinh chỉnh lại.

### Sử dụng Địa chỉ Ảo: scullv

Mã nguồn mẫu sử dụng *vmalloc* được cung cấp trong module *scullv*. Giống như *scullp*, module này là một phiên bản rút gọn của *scull* nhưng sử dụng một hàm cấp phát khác để lấy không gian (space) lưu trữ dữ liệu cho thiết bị.

Module này cấp phát bộ nhớ mỗi lần 16 trang (page). Việc cấp phát được thực hiện theo các khối lớn (large chunks) nhằm đạt hiệu quả hiệu năng tốt hơn so dengan *scullp* (so với *scullp*) và để minh họa một trường hợp mà các kỹ thuật cấp phát khác mất quá nhiều thời gian để có thể khả thi. Việc cấp phát nhiều hơn một trang bằng *\_\_get\_free\_pages* rất dễ dẫn đến thất bại, và ngay cả khi thành công, nó cũng có thể diễn ra chậm chạp. Như chúng ta đã thấy trước đó, *vmalloc* nhanh hơn các hàm khác khi cấp phát vài trang, nhưng lại chậm hơn một chút khi thu hồi (retrieving) một trang đơn lẻ, do chi phí phát sinh (overhead) từ việc xây dựng bảng trang (page-table building). *scullv* được thiết kế tương tự như *scullp*. `order` chỉ định "thứ bậc" (order) của mỗi lần cấp phát và mặc định là 4. Sự khác biệt duy nhất giữa *scullv* và *scullp* nằm ở phần quản lý cấp phát. Các dòng sau sử dụng *vmalloc* để lấy bộ nhớ mới:

```c
/* Allocate a quantum using virtual addresses */
    if (!dptr->data[s_pos]) {
     dptr->data[s_pos] =
     (void *)vmalloc(PAGE_SIZE << dptr->order);
     if (!dptr->data[s_pos])
     goto nomem;
     memset(dptr->data[s_pos], 0, PAGE_SIZE << dptr->order);
    }
and these lines release memory:
    /* Release the quantum-set */
    for (i = 0; i < qset; i++)
     if (dptr->data[i])
     vfree(dptr->data[i]);
```

Nếu bạn biên dịch cả hai module ở chế độ bật gỡ lỗi (debugging), bạn có thể xem cách chúng cấp phát dữ liệu bằng cách đọc các tệp mà chúng tạo ra trong thư mục */proc*. Bản chụp nhanh (snapshot) này được thực hiện trên một hệ thống x86\_64:

```bash
salma% cat /tmp/bigfile > /dev/scullp0; head -5 /proc/scullpmem
Device 0: qset 500, order 0, sz 1535135
 item at 000001001847da58, qset at 000001001db4c000
 0:1001db56000
 1:1003d1c7000
salma% cat /tmp/bigfile > /dev/scullv0; head -5 /proc/scullvmem
Device 0: qset 500, order 4, sz 1535135
 item at 000001001847da58, qset at 0000010013dea000
 0:ffffff0001177000
 1:ffffff0001188000
```

Ngược lại, đầu ra sau đây đến từ một hệ thống x86:

```bash
rudo% cat /tmp/bigfile > /dev/scullp0; head -5 /proc/scullpmem
Device 0: qset 500, order 0, sz 1535135
 item at ccf80e00, qset at cf7b9800
 0:ccc58000
 1:cccdd000
rudo% cat /tmp/bigfile > /dev/scullv0; head -5 /proc/scullvmem
Device 0: qset 500, order 4, sz 1535135
 item at cfab4800, qset at cf8e4000
 0:d087a000
 1:d08d2000
```

Các giá trị cho thấy hai hành vi khác nhau. Trên x86\_64, địa chỉ vật lý (physical address) và địa chỉ ảo (virtual address) được ánh xạ tới các dải địa chỉ hoàn toàn khác nhau (0x100 và 0xffffff00), trong khi trên máy tính x86, *vmalloc* trả về các địa chỉ ảo nằm ngay phía trên vùng ánh xạ được sử dụng cho bộ nhớ vật lý.

## Biến Theo-CPU (Per-CPU Variables)

Biến theo-CPU (Per-CPU variable) là một tính năng thú vị của kernel 2.6. Khi bạn tạo một biến per-CPU, mỗi bộ xử lý (processor) trên hệ thống sẽ nhận được một bản sao (copy) riêng của biến đó. Điều này thoạt nhìn có vẻ là một việc kỳ lạ cần làm, nhưng nó lại mang lại những ưu điểm riêng. Việc truy cập vào các biến per-CPU (hầu như) không cần khóa (lock), vì mỗi processor làm việc với bản sao của chính nó. Các biến per-CPU cũng có thể nằm lại trong bộ nhớ đệm (cache) tương ứng của từng processor, dẫn đến hiệu năng tốt hơn đáng kể đối với các đại lượng được cập nhật thường xuyên.

Một ví dụ điển hình về việc sử dụng biến per-CPU có thể được tìm thấy trong hệ thống mạng (networking subsystem). Kernel duy trì vô số bộ đếm (counter) để theo dõi số lượng mỗi loại gói tin (packet) đã được nhận; các bộ đếm này có thể được cập nhật hàng ngàn lần mỗi giây. Thay vì phải đối phó với các vấn đề về caching và locking, các nhà phát triển mạng đã đưa các bộ đếm thống kê này vào các biến per-CPU. Các thao tác cập nhật giờ đây không cần khóa (lockless) và diễn ra rất nhanh chóng. Trong những trường hợp hiếm hoi mà không gian người dùng (user space) yêu cầu xem giá trị của các bộ đếm, việc cộng dồn phiên bản của từng processor và trả về tổng số là một thao tác vô cùng đơn giản.

Các khai báo cho biến per-CPU có thể được tìm thấy trong *<linux/percpu.h>*. Để tạo một biến per-CPU tại thời điểm biên dịch (compile time), hãy sử dụng macro sau:

```c
DEFINE_PER_CPU(type, name);
```

Nếu biến (sẽ được đặt tên là `name`) là một mảng (array), hãy bao gồm thông tin kích thước (dimension) cùng với kiểu dữ liệu. Do đó, một mảng per-CPU gồm ba số nguyên (integer) sẽ được tạo bằng:

```c
DEFINE_PER_CPU(int[3], my_percpu_array);
```

Các biến per-CPU có thể được thao tác mà không cần khóa tường minh (explicit locking) — hầu như là vậy. Hãy nhớ rằng kernel 2.6 hỗ trợ quyền chiếm quyền điều khiển (preemptible); sẽ không ổn chút nào nếu một processor bị ngắt quyền (preempted) ở giữa một vùng găng (critical section) đang sửa đổi một biến per-CPU. Sẽ cũng không tốt nếu tiến trình (process) của bạn bị chuyển sang một processor khác ở giữa quá trình truy cập biến per-CPU. Vì lý do này, bạn phải sử dụng tường minh macro *get\_cpu\_var* để truy cập bản sao của biến chỉ định trên processor hiện tại, và gọi *put\_cpu\_var* khi bạn hoàn tất. Lời gọi *get\_cpu\_var* trả về một lvalue (giá trị trái) cho phiên bản biến của processor hiện tại và vô hiệu hóa tính năng tiền chiếm quyền (preemption). Vì một lvalue được trả về, nó có thể được gán giá trị hoặc thao tác trực tiếp. Ví dụ, một bộ đếm trong mã nguồn mạng được tăng giá trị bằng hai câu lệnh sau:

```c
get_cpu_var(sockets_in_use)++;
put_cpu_var(sockets_in_use);
```

Bạn có thể truy cập bản sao của biến trên một bộ vi xử lý (processor) khác bằng cách sử dụng:

```c
per_cpu(variable, int cpu_id);
```

Nếu bạn viết mã nguồn liên quan đến việc các bộ vi xử lý (processor) truy xuất vào biến `per-CPU` của nhau, dĩ nhiên bạn phải triển khai một cơ chế khóa (locking scheme) để đảm bảo việc truy cập đó được an toàn.

Các biến `per-CPU` được cấp phát động (dynamically allocated) cũng khả thi. Những biến này có thể được cấp phát bằng:

```c
void *alloc_percpu(type);
void *__alloc_percpu(size_t size, size_t align);
```

Trong phần lớn các trường hợp, *alloc\_percpu* là đủ dùng; bạn có thể gọi *\_\_alloc\_percpu* trong các trường hợp yêu cầu một sự căn chỉnh (alignment) cụ thể. Dù ở trường hợp nào, một biến `per-CPU` có thể được trả lại cho hệ thống bằng hàm *free\_percpu*. Việc truy cập vào một biến `per-CPU` được cấp phát động được thực hiện thông qua *per\_cpu\_ptr*:

```c
per_cpu_ptr(void *per_cpu_var, int cpu_id);
```

Macro này trả về một con trỏ (pointer) trỏ đến phiên bản của `per_cpu_var` tương ứng với `cpu_id` được chỉ định. Nếu bạn đơn giản là đang đọc phiên bản biến của một CPU khác, bạn có thể giải tham chiếu (dereference) con trỏ đó là xong. Tuy nhiên, nếu bạn đang thao tác trên phiên bản của bộ vi xử lý hiện tại (current processor), bạn có lẽ cần phải đảm bảo rằng trước tiên bạn không bị chuyển (migrated) sang bộ vi xử lý khác. Nếu toàn bộ quá trình truy cập của bạn vào biến `per-CPU` diễn ra trong khi một spinlock đang được giữ (held), thì mọi thứ đều ổn. Mặc dù vậy, thông thường bạn cần sử dụng *get\_cpu* để chặn quyền tiền chiếm (preemption) trong khi làm việc với biến. Do đó, mã nguồn sử dụng các biến `per-CPU` động thường có dạng như sau:

```c
int cpu;
cpu = get_cpu( );
ptr = per_cpu_ptr(per_cpu_var, cpu);
/* làm việc với ptr */
put_cpu( );
```

Khi sử dụng các biến `per-CPU` được khai báo tại thời điểm biên dịch (compile-time), các macro *get\_cpu\_var* và *put\_cpu\_var* sẽ tự động xử lý các chi tiết này. Các biến `per-CPU` động đòi hỏi cơ chế bảo vệ tường minh (explicit protection) hơn.

Các biến `per-CPU` có thể được xuất ra các module (export to modules), nhưng bạn phải sử dụng một phiên bản macro đặc biệt:

```c
EXPORT_PER_CPU_SYMBOL(per_cpu_var);
EXPORT_PER_CPU_SYMBOL_GPL(per_cpu_var);
```

Để truy cập một biến như vậy bên trong một module, hãy khai báo nó với:

```c
DECLARE_PER_CPU(type, name);
```

Việc sử dụng *DECLARE\_PER\_CPU* (thay vì *DEFINE\_PER\_CPU*) báo cho trình biên dịch biết rằng một tham chiếu ngoài (external reference) đang được thực hiện.

Nếu bạn muốn sử dụng các biến `per-CPU` để tạo một bộ đếm số nguyên đơn giản (simple integer counter), hãy tham khảo phần triển khai có sẵn trong *<linux/percpu\_counter.h>*. Cuối cùng, cần lưu ý rằng một số kiến trúc (architectures) có không gian địa chỉ (address space) bị giới hạn dành cho các biến `per-CPU`. Nếu bạn tạo các biến `per-CPU` trong mã nguồn của mình, bạn nên cố gắng giữ cho kích thước của chúng nhỏ gọn.

## Nhận các Bộ đệm Lớn (Obtaining Large Buffers)

Như chúng ta đã lưu ý trong các phần trước, việc cấp phát các bộ đệm bộ nhớ lớn và liên tục (large, contiguous memory buffers) rất dễ dẫn đến thất bại. Bộ nhớ hệ thống bị phân mảnh (fragments) theo thời gian, và khả năng cao là một vùng nhớ thực sự lớn đơn giản là sẽ không có sẵn. Vì thường có các cách khác để hoàn thành công việc mà không cần các bộ đệm khổng lồ, các nhà phát triển nhân (kernel developers) không đặt độ ưu tiên cao cho việc làm cho các tiến trình cấp phát lớn hoạt động được. Trước khi bạn cố gắng lấy một vùng nhớ lớn, bạn thực sự nên cân nhắc các giải pháp thay thế. Cho đến nay, cách tốt nhất để thực hiện các thao tác I/O lớn là thông qua các thao tác phân tán/tập hợp (scatter/gather operations), mà chúng ta thảo luận trong phần "Ánh xạ phân tán-tập hợp" (Scatter-gather mappings) ở Chương 1.

## Cấp phát một vùng đệm riêng biệt tại thời điểm khởi động (Boot Time)

Nếu bạn thực sự cần một vùng đệm (buffer) rất lớn gồm các trang bộ nhớ vật lý liên tục (physically contiguous memory), cách tiếp cận tốt nhất thường là cấp phát nó bằng cách yêu cầu bộ nhớ tại thời điểm khởi động hệ thống (boot time). Cấp phát tại thời điểm khởi động là cách duy nhất để lấy lại các trang bộ nhớ liên tục (consecutive memory pages) mà không bị giới hạn bởi các ràng buộc của *\_\_get\_free\_pages* đối với kích thước vùng đệm, bao gồm cả giới hạn về kích thước tối đa cho phép và sự hạn chế trong việc chọn kích thước. Việc cấp phát bộ nhớ lúc khởi động là một kỹ thuật "thô", bởi vì nó bỏ qua tất cả các chính sách quản lý bộ nhớ (memory management policies) bằng cách dành riêng một vùng nhớ riêng tư (private memory pool). Kỹ thuật này không thanh lịch và thiếu linh hoạt, nhưng lại là cách ít có khả năng thất bại nhất. Đương nhiên, một module (kernel module) không thể cấp phát bộ nhớ tại thời điểm khởi động; chỉ có các trình điều khiển (driver) được liên kết trực tiếp với kernel mới có thể làm được điều đó.

Một vấn đề đáng chú ý với việc cấp phát lúc khởi động là nó không phải là một tùy chọn khả thi đối với người dùng thông thường, vì cơ chế này chỉ có sẵn cho mã nguồn được liên kết trong hình ảnh kernel (kernel image). Một trình điều khiển thiết bị (device driver) sử dụng loại cấp phát này chỉ có thể được cài đặt hoặc thay thế bằng cách biên dịch lại kernel và khởi động lại máy tính.

Khi kernel khởi động, nó có quyền truy cập vào toàn bộ bộ nhớ vật lý có sẵn trong hệ thống. Sau đó, nó khởi tạo từng hệ thống con (subsystem) bằng cách gọi hàm khởi tạo của hệ thống con đó, cho phép mã khởi tạo cấp phát một vùng đệm bộ nhớ dùng riêng bằng cách giảm lượng RAM còn lại cho hoạt động thông thường của hệ thống.

Việc cấp phát bộ nhớ lúc khởi động được thực hiện bằng cách gọi một trong các hàm sau:

```c
## include <linux/bootmem.h>
void *alloc_bootmem(unsigned long size);
void *alloc_bootmem_low(unsigned long size);
void *alloc_bootmem_pages(unsigned long size);
void *alloc_bootmem_low_pages(unsigned long size);
```

Các hàm này cấp phát toàn bộ các trang bộ nhớ (nếu kết thúc bằng hậu tố `_pages`) hoặc các vùng nhớ không căn chỉnh theo trang (non-pagealigned memory areas). Bộ nhớ được cấp phát có thể là bộ nhớ cao (high memory) trừ khi sử dụng một trong các phiên bản có hậu tố `_low`. Nếu bạn đang cấp phát vùng đệm này cho một device driver, có thể bạn muốn dùng nó cho các hoạt động DMA (Direct Memory Access), và điều đó không phải lúc hợp lệ với high memory; do đó, bạn nên sử dụng một trong các biến thể `_low`.

Rất hiếm khi giải phóng bộ nhớ được cấp phát tại thời điểm khởi động; gần như chắc chắn bạn không thể lấy lại được nó sau này nếu muốn. Tuy nhiên, vẫn có một giao diện (interface) để giải phóng bộ nhớ này:

```
void free_bootmem(unsigned long addr, unsigned long size);
```

Lưu ý rằng các trang bộ nhớ một phần (partial pages) được giải phóng theo cách này sẽ không được trả lại cho hệ thống—nhưng nếu bạn đang sử dụng kỹ thuật này, có lẽ bạn đã cấp phát khá nhiều toàn bộ trang ngay từ đầu.

Nếu bạn buộc phải sử dụng việc cấp phát lúc khởi động, bạn cần liên kết driver của mình trực tiếp vào kernel. Hãy xem các tệp trong mã nguồn kernel tại thư mục *Documentation/kbuild* để biết thêm thông tin chi tiết về cách thực hiện việc này.

## Tóm tắt nhanh (Quick Reference)

Các hàm và ký hiệu liên quan đến việc cấp phát bộ nhớ bao gồm:

```c
## include <linux/slab.h>
void *kmalloc(size_t size, int flags);
void kfree(void *obj);
    Giao diện được sử dụng thường xuyên nhất để cấp phát bộ nhớ.
## include <linux/mm.h>
GFP_USER
GFP_KERNEL
GFP_NOFS
GFP_NOIO
GFP_ATOMIC
```

Các cờ (flags) kiểm soát cách thức thực hiện việc cấp phát bộ nhớ, được sắp xếp từ ít hạn chế nhất đến hạn chế nhất. Các mức ưu tiên `GFP_USER` và `GFP_KERNEL` cho phép tiến trình (process) hiện tại bị đưa vào trạng thái ngủ (sleep) để đáp ứng yêu cầu. `GFP_NOFS` và `GFP_NOIO` lần lượt vô hiệu hóa các hoạt động trên hệ thống tập tin (filesystem operations) và mọi hoạt động I/O, trong khi việc cấp phát bằng `GFP_ATOMIC` hoàn toàn không được phép đi ngủ (cannot sleep).

```
__GFP_DMA
__GFP_HIGHMEM
__GFP_COLD
__GFP_NOWARN
__GFP_HIGH
__GFP_REPEAT
__GFP_NOFAIL
__GFP_NORETRY
    Các cờ này thay đổi hành vi của kernel khi cấp phát bộ nhớ.
## include <linux/malloc.h>
kmem_cache_t *kmem_cache_create(char *name, size_t size, size_t offset,
 unsigned long flags, constructor( ), destructor( ));
int kmem_cache_destroy(kmem_cache_t *cache);
    Tạo và hủy một slab cache. Cache có thể được sử dụng để cấp phát nhiều
    đối tượng (object) có cùng kích thước.
SLAB_NO_REAP
SLAB_HWCACHE_ALIGN
SLAB_CACHE_DMA
    Các cờ có thể được chỉ định khi tạo một cache.
SLAB_CTOR_ATOMIC
SLAB_CTOR_CONSTRUCTOR
    Các cờ mà trình cấp phát (allocator) có thể truyền vào các hàm khởi tạo (constructor) và hủy (destructor).
void *kmem_cache_alloc(kmem_cache_t *cache, int flags);
void kmem_cache_free(kmem_cache_t *cache, const void *obj);
    Cấp phát và giải phóng một đối tượng đơn lẻ từ cache.
/proc/slabinfo
    Một tệp ảo (virtual file) chứa các thống kê về việc sử dụng slab cache.
## include <linux/mempool.h>
mempool_t *mempool_create(int min_nr, mempool_alloc_t *alloc_fn, mempool_free_t
 *free_fn, void *data);
void mempool_destroy(mempool_t *pool);
    Các hàm dùng để tạo ra các bể bộ nhớ (memory pools), giúp tránh tình trạng
    thất bại khi cấp phát bộ nhớ bằng cách duy trì một "danh sách khẩn cấp"
    (emergency list) gồm các mục đã được cấp phát sẵn.
void *mempool_alloc(mempool_t *pool, int gfp_mask);
void mempool_free(void *element, mempool_t *pool);
    Các hàm để cấp phát các mục từ (và trả chúng về) mempool.
```

```c
unsigned long get_zeroed_page(int flags);
unsigned long __get_free_page(int flags);
unsigned long __get_free_pages(int flags, unsigned long order);
    Các hàm cấp phát theo trang (page-oriented allocation functions). get_zeroed_page trả về một trang đơn đã được làm sạch (zero-filled). Tất cả các phiên bản gọi khác không khởi tạo nội dung của (các) trang được trả về.
int get_order(unsigned long size);
    Trả về thứ tự cấp phát (allocation order) tương ứng với kích thước trên nền tảng hiện tại, dựa theo PAGE_SIZE. Đối số phải là một lũy thừa của hai, và giá trị trả về ít nhất là 0.
void free_page(unsigned long addr);
void free_pages(unsigned long addr, unsigned long order);
    Các hàm giải phóng vùng cấp phát theo trang.
struct page *alloc_pages_node(int nid, unsigned int flags, unsigned int order);
struct page *alloc_pages(unsigned int flags, unsigned int order);
struct page *alloc_page(unsigned int flags);
    Tất cả các biến thể của trình cấp phát trang (page allocator) cấp thấp nhất trong Linux Kernel.
void __free_page(struct page *page);
void __free_pages(struct page *page, unsigned int order);
void free_hot_page(struct page *page);
void free_cold_page(struct page *page);
    Các cách khác nhau để giải phóng các trang được cấp phát bằng một trong các dạng của alloc_page.
## include <linux/vmalloc.h>
void * vmalloc(unsigned long size);
void vfree(void * addr);
## include <asm/io.h>
void * ioremap(unsigned long offset, unsigned long size);
void iounmap(void *addr);
    Các hàm cấp phát hoặc giải phóng một không gian địa chỉ ảo liên tục (contiguous virtual address space). ioremap truy cập bộ nhớ vật lý (physical memory) thông qua các địa chỉ ảo (virtual addresses), trong khi vmalloc cấp phát các trang trống. Các vùng được ánh xạ (mapped) bằng ioremap được giải phóng bằng iounmap, trong khi các trang lấy từ vmalloc được giải phóng bằng vfree.
## include <linux/percpu.h>
DEFINE_PER_CPU(type, name);
DECLARE_PER_CPU(type, name);
    Các macro định nghĩa và khai báo biến theo từng CPU (per-CPU variable).
per_cpu(variable, int cpu_id)
get_cpu_var(variable)
put_cpu_var(variable)
    Các macro cung cấp quyền truy cập vào các biến per-CPU được khai báo tĩnh (statically declared).
```

```c
void *alloc_percpu(type);
void *__alloc_percpu(size_t size, size_t align);
void free_percpu(void *variable);
    Các hàm thực hiện việc cấp phát và giải phóng thời gian chạy (runtime allocation and freeing) cho các biến per-CPU.
int get_cpu( );
void put_cpu( );
per_cpu_ptr(void *variable, int cpu_id)
    get_cpu lấy một tham chiếu đến vi xử lý hiện tại (do đó, ngăn chặn việc tiền chiếm dụng - pre-emption và chuyển sang vi xử lý khác) và trả về số ID của vi xử lý đó; put_cpu trả lại tham chiếu đó. Để truy cập một biến per-CPU được cấp phát động (dynamically allocated), hãy sử dụng per_cpu_ptr với ID của CPU có phiên bản cần truy cập. Các thao tác trên phiên bản của CPU hiện tại đối với một biến per-CPU động có lẽ nên được bao bọc bởi các lời gọi đến get_cpu và put_cpu.
```

```c
## include <linux/bootmem.h>
void *alloc_bootmem(unsigned long size);
void *alloc_bootmem_low(unsigned long size);
void *alloc_bootmem_pages(unsigned long size);
void *alloc_bootmem_low_pages(unsigned long size);
void free_bootmem(unsigned long addr, unsigned long size);
```

Các hàm (chỉ có thể được sử dụng bởi các trình điều khiển - drivers được liên kết trực tiếp vào kernel) thực hiện việc cấp phát và giải phóng bộ nhớ tại thời điểm khởi động hệ thống (system bootstrap time).
