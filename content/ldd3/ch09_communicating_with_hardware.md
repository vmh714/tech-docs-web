# Chương 9: Giao tiếp với Phần cứng

Mặc dù việc vọc vạch với *scull* và các mô phỏng tương tự là bước khởi đầu tốt để làm quen với giao diện phần mềm của một Linux device driver, việc triển khai một thiết bị *thực tế* lại đòi hỏi phải có phần cứng. Driver đóng vai trò là lớp trừu tượng (abstraction layer) giữa các khái niệm phần mềm và vi mạch phần cứng; do đó, nó cần phải giao tiếp được với cả hai phía. Cho đến nay, chúng ta đã xem xét các cơ chế bên trong của các khái niệm phần mềm; chương này sẽ hoàn thiện bức tranh tổng thể bằng cách chỉ cho bạn cách một driver có thể truy cập các cổng I/O (I/O ports) và bộ nhớ I/O (I/O memory) trong khi vẫn đảm bảo tính di port (portable) giữa các nền tảng Linux khác nhau.

Chương này tiếp tục duy trì truyền thống độc lập với phần cứng cụ thể càng nhiều càng tốt. Tuy nhiên, ở những nơi cần ví dụ cụ thể, chúng tôi sử dụng các cổng I/O số đơn giản (chẳng hạn như cổng song song chuẩn trên PC) để minh họa cách các lệnh I/O hoạt động, và sử dụng bộ nhớ video frame-buffer thông thường để minh họa I/O ánh xạ bộ nhớ (memory-mapped I/O).

Chúng tôi chọn I/O số đơn giản vì đây là dạng cổng nhập/xuất dễ nhất. Thêm vào đó, cổng song song thực hiện I/O dạng thô (raw I/O) và có mặt trên hầu hết các máy tính: các bit dữ liệu được ghi vào thiết bị sẽ xuất hiện trên các chân đầu ra, và các mức điện áp trên các chân đầu vào có thể được bộ vi xử lý (processor) truy cập trực tiếp. Trên thực tế, bạn phải kết nối các đèn LED hoặc một máy in vào cổng để thực sự *nhìn thấy* kết quả của một thao tác I/O số, nhưng phần cứng nền tảng bên dưới lại cực kỳ dễ sử dụng.

## Cổng I/O và Bộ nhớ I/O (I/O Ports and I/O Memory)

Mỗi thiết bị ngoại vi (peripheral device) được điều khiển bằng cách ghi và đọc các thanh ghi (register) của nó. Phần lớn thời gian, một thiết bị có nhiều thanh ghi và chúng được truy cập tại các địa chỉ liên tiếp, hoặc nằm trong không gian địa chỉ bộ nhớ (memory address space) hoặc trong không gian địa chỉ I/O (I/O address space).

Ở cấp độ phần cứng, không có sự khác biệt về mặt khái niệm giữa các vùng bộ nhớ (memory regions) và vùng I/O (I/O regions): cả hai đều được truy cập bằng cách kích hoạt các tín hiệu điện trên bus địa chỉ và bus điều khiển (tức là tín hiệu *đọc* - *read* và *ghi* - *write*)\* và bằng cách đọc từ hoặc ghi vào bus dữ liệu (data bus).

Trong khi một số nhà sản xuất CPU tích hợp một không gian địa chỉ duy nhất trong các con chip của họ, những hãng khác lại quyết định rằng các thiết bị ngoại vi khác với bộ nhớ và do đó, chúng xứng đáng có một không gian địa chỉ riêng biệt. Một số bộ vi xử lý (đáng chú ý nhất là dòng x86) có các đường tín hiệu điện *đọc* và *ghi* riêng biệt cho các cổng I/O và các lệnh CPU đặc biệt để truy cập các cổng đó.

Vì các thiết bị ngoại vi được thiết kế để phù hợp với bus ngoại vi (peripheral bus), và các bus I/O phổ biến nhất được mô phỏng theo máy tính cá nhân, nên ngay cả các bộ vi xử lý không có không gian địa chỉ riêng cho cổng I/O cũng phải giả lập việc đọc và ghi cổng I/O khi truy cập một số thiết bị ngoại vi, thường là thông qua các chipset bên ngoài hoặc mạch bổ sung trong nhân CPU (CPU core). Giải pháp thứ hai rất phổ biến trong các bộ vi xử lý nhỏ gọn dành cho các ứng dụng nhúng (embedded use).

Vì lý do tương tự, Linux triển khai khái niệm cổng I/O trên tất cả các nền tảng máy tính mà nó chạy trên đó, ngay cả trên các nền tảng mà CPU chỉ triển khai một không gian địa chỉ duy nhất. Việc thực thi quyền truy cập cổng đôi khi phụ thuộc vào hãng sản xuất và model cụ thể của máy tính chủ (host computer) (vì các model khác nhau sử dụng các chipset khác nhau để ánh xạ các giao dịch bus vào không gian địa chỉ bộ nhớ).

Ngay cả khi bus ngoại vi có một không gian địa chỉ riêng biệt cho các cổng I/O, không phải tất cả các thiết bị đều ánh xạ các thanh ghi của chúng vào các cổng I/O. Mặc dù việc sử dụng cổng I/O rất phổ biến đối với các bo mạch ngoại vi ISA, hầu hết các thiết bị PCI lại ánh xạ các thanh ghi vào một vùng địa chỉ bộ nhớ. Cách tiếp cận bộ nhớ I/O (I/O memory) này thường được ưu tiên hơn, bởi vì nó không đòi hỏi sử dụng các lệnh xử lý chuyên dụng; các nhân CPU truy cập bộ nhớ hiệu quả hơn rất nhiều, và trình biên dịch (compiler) có nhiều sự tự do hơn trong việc phân bổ thanh ghi (register allocation) và lựa chọn chế độ định địa chỉ (addressing-mode selection) khi truy cập bộ nhớ.

### I/O Registers và Bộ nhớ thông thường

Mặc dù có sự tương đồng lớn giữa thanh ghi phần cứng (hardware register) và bộ nhớ, một lập trình viên khi truy cập các thanh ghi I/O (I/O register) phải cẩn thận để tránh bị đánh lừa bởi các tối ưu hóa của CPU (hoặc trình biên dịch) có thể làm thay đổi hành vi I/O mong đợi.

Sự khác biệt chính giữa các thanh ghi I/O và RAM là các thao tác I/O có hiệu ứng phụ (side effect), trong khi các thao tác trên bộ nhớ thì không: hiệu ứng duy nhất của việc ghi bộ nhớ là lưu một giá trị vào một vị trí, và việc đọc bộ nhớ trả về giá trị cuối cùng được ghi vào đó. Vì tốc độ truy cập bộ nhớ rất quan trọng đối với hiệu năng của CPU, trường hợp không có hiệu ứng phụ đã được tối ưu hóa theo nhiều cách: các giá trị được đưa vào bộ nhớ đệm (cache) và các lệnh đọc/ghi được sắp xếp lại (reorder).

Không phải mọi nền tảng máy tính đều sử dụng tín hiệu *đọc* (*read*) và *ghi* (*write*); một số nền tảng có các phương tiện khác để định địa chỉ cho các mạch ngoài. Tuy nhiên, sự khác biệt này không liên quan ở cấp độ phần mềm, và chúng ta sẽ giả định tất cả đều có *đọc* và *ghi* để đơn giản hóa thảo luận.

Trình biên dịch có thể lưu đệm các giá trị dữ liệu vào các thanh ghi CPU (CPU register) mà không ghi chúng vào bộ nhớ, và ngay cả khi nó lưu chúng, cả hai thao tác ghi và đọc đều có thể hoạt động trên bộ nhớ cache mà không bao giờ chạm tới RAM vật lý. Việc sắp xếp lại (reordering) cũng có thể xảy ra ở cả cấp độ trình biên dịch và cấp độ phần cứng: thường thì một chuỗi các lệnh có thể được thực thi nhanh chóng hơn nếu nó chạy theo thứ tự khác với thứ tự xuất hiện trong mã nguồn chương trình, ví dụ, để ngăn ngừa các hiện tượng kẹt luồng (interlock) trong đường ống lệnh RISC (RISC pipeline). Trên các bộ xử lý CISC, các thao tác tốn nhiều thời gian có thể được thực thi đồng thời với các thao tác khác nhanh hơn.

Những tối ưu hóa này mang tính trong suốt (transparent) và vô hại khi áp dụng cho bộ nhớ thông thường (ít nhất là trên các hệ thống đơn nhân - uniprocessor systems), nhưng chúng có thể gây tử vong đối với các thao tác I/O chính xác, bởi vì chúng can thiệp vào các "hiệu ứng phụ" đó – vốn là lý do chính khiến một trình điều khiển (driver) truy cập các thanh ghi I/O. Bộ xử lý không thể lường trước tình huống mà một tiến trình (process) khác (chạy trên một bộ xử lý riêng biệt, hoặc một sự kiện xảy ra bên trong bộ điều khiển I/O - I/O controller) phụ thuộc vào thứ tự truy cập bộ nhớ. Trình biên dịch hoặc CPU có thể cố gắng thông minh hơn bạn và sắp xếp lại các thao tác bạn yêu cầu; kết quả có thể là những lỗi kỳ lạ rất khó gỡ lỗi (debug). Do đó, một driver phải đảm bảo rằng không có việc caching nào được thực hiện và không có việc sắp xếp lại lệnh đọc hoặc ghi nào diễn ra khi truy cập các thanh ghi.

Vấn đề với caching phần cứng là vấn đề dễ đối phó nhất: phần cứng nền tảng đã được cấu hình sẵn (hoặc tự động hoặc bởi mã khởi tạo của Linux) để vô hiệu hóa mọi bộ nhớ cache phần cứng khi truy cập các vùng I/O (dù là vùng bộ nhớ hay vùng cổng - port region).

Giải pháp cho việc tối ưu hóa của trình biên dịch và sắp xếp lại của phần cứng là đặt một *rào cản bộ nhớ* (*memory barrier*) giữa các thao tác phải hiển thị với phần cứng (hoặc với một bộ xử lý khác) theo một thứ tự cụ thể. Linux cung cấp bốn macro để đáp ứng mọi nhu cầu sắp xếp thứ tự có thể:

```c
## include <linux/kernel.h>
void barrier(void)
```

Hàm này ra lệnh cho trình biên dịch chèn một rào cản bộ nhớ nhưng không có tác động gì đến phần cứng. Mã đã biên dịch sẽ lưu vào bộ nhớ tất cả các giá trị hiện đang được sửa đổi và nằm trong các thanh ghi CPU, sau đó đọc lại chúng sau khi cần thiết. Lời gọi hàm *barrier* ngăn chặn các tối ưu hóa của trình biên dịch vượt qua rào cản nhưng để mặc cho phần cứng tự do sắp xếp lại theo ý nó.

```c
## include <asm/system.h>
void rmb(void);
void read_barrier_depends(void);
void wmb(void);
void mb(void);
```

Các hàm này chèn các rào cản bộ nhớ phần cứng vào luồng lệnh đã biên dịch; việc hiện thực hóa thực tế của chúng phụ thuộc vào từng nền tảng (platform dependent). Một *rmb* (rào cản bộ nhớ đọc - read memory barrier) đảm bảo rằng bất kỳ lệnh đọc nào xuất hiện trước rào cản đều được hoàn thành trước khi thực thi bất kỳ lệnh đọc tiếp theo nào. *wmb* đảm bảo thứ tự trong các thao tác ghi, và lệnh *mb* đảm bảo cả hai. Mỗi hàm này là một tập siêu (superset) của *barrier*.

*read_barrier_depends* là một dạng rào cản đọc đặc biệt và yếu hơn. Trong khi *rmb* ngăn chặn việc sắp xếp lại tất cả các lệnh đọc qua rào cản, *read_barrier_depends* chỉ chặn việc sắp xếp lại các lệnh đọc phụ thuộc vào dữ liệu từ các lệnh đọc khác. Sự khác biệt này rất nhỏ và nó không tồn tại trên tất cả các kiến trúc (architecture). Trừ khi bạn hiểu chính xác những gì đang diễn ra và bạn có lý do để tin rằng một rào cản đọc đầy đủ đang gây tốn kém hiệu năng quá mức, bạn có nên gắn bó với việc sử dụng *rmb*.

```c
void smp_rmb(void);
void smp_read_barrier_depends(void);
void smp_wmb(void);
void smp_mb(void);
```

Các phiên bản này của macro rào cản chỉ chèn các rào cản phần cứng khi kernel được biên dịch cho các hệ thống SMP (Symmetric Multiprocessing); nếu không, tất cả chúng sẽ mở rộng thành một lời gọi *barrier* đơn giản.

Một cách sử dụng điển hình của rào cản bộ nhớ trong một device driver có thể có dạng như sau:

```c
writel(dev->registers.addr, io_destination_address);
writel(dev->registers.size, io_size);
writel(dev->registers.operation, DEV_READ);
wmb( );
writel(dev->registers.control, DEV_GO);
```

Trong trường hợp này, điều quan trọng là phải đảm bảo rằng tất cả các thanh ghi của thiết bị (device register) điều khiển một hoạt động cụ thể đã được thiết lập đúng cách trước khi ra lệnh cho thiết bị bắt đầu. Hàng rào bộ nhớ (memory barrier) ép buộc việc hoàn thành các thao tác ghi (write) theo đúng thứ tự cần thiết.

Vì các hàng rào bộ nhớ ảnh hưởng đến hiệu năng (performance), chúng chỉ nên được sử dụng ở những nơi thực sự cần thiết. Các loại hàng rào khác nhau cũng có thể có các đặc tính hiệu năng khác nhau, vì vậy việc sử dụng loại cụ thể nhất có thể là điều rất đáng làm. Ví dụ, trên kiến trúc x86, hàm *wmb( )* hiện không làm gì cả, vì các thao tác ghi bên ngoài bộ xử lý không bị sắp xếp lại (reorder). Tuy nhiên, các thao tác đọc (read) lại bị sắp xếp lại, do đó hàm *mb( )* sẽ chậm hơn hàm *wmb( )*.

Cần lưu ý rằng hầu hết các nguyên hàm đồng bộ hóa (synchronization primitive) khác trong kernel, chẳng hạn như spinlock và các thao tác `atomic_t`, cũng hoạt động như các hàng rào bộ nhớ. Cũng đáng lưu ý là một số bus ngoại vi (peripheral bus) (chẳng hạn như bus PCI) có các vấn đề về bộ nhớ đệm (caching) của riêng chúng; chúng ta sẽ thảo luận về những vấn đề đó khi đề cập đến chúng trong các chương sau.

Một số kiến trúc cho phép kết hợp hiệu quả giữa một phép gán (assignment) và một hàng rào bộ nhớ. Kernel cung cấp một vài macro thực hiện việc kết hợp này; trong trường hợp mặc định, chúng được định nghĩa như sau:

```
## define set_mb(var, value) do {var = value; mb( );} while 0
## define set_wmb(var, value) do {var = value; wmb( );} while 0
## define set_rmb(var, value) do {var = value; rmb( );} while 0
```

Tại những nơi phù hợp, tệp *<asm/system.h>* định nghĩa các macro này để sử dụng các tập lệnh đặc thù theo kiến trúc nhằm hoàn thành công việc nhanh hơn. Lưu ý rằng *set_rmb* chỉ được định nghĩa bởi một số lượng nhỏ các kiến trúc. (Việc sử dụng cấu trúc `do...while` là một thành ngữ C chuẩn giúp cho macro sau khi mở rộng hoạt động như một câu lệnh C bình thường trong mọi ngữ cảnh).

## Sử dụng Cổng I/O (I/O Ports)

Cổng I/O (I/O port) là phương tiện mà qua đó các trình điều khiển (driver) giao tiếp với nhiều thiết bị, ít nhất là trong phần lớn thời gian. Phần dụng này đề cập đến các hàm khác nhau có sẵn để tận dụng các cổng I/O; chúng ta cũng sẽ chạm đến một số vấn đề về khả năng di port (portability).

### Cấp phát Cổng I/O (I/O Port Allocation)

Như bạn có thể đoán, bạn không nên tự ý lao vào và bắt đầu thao tác trên các cổng I/O mà không đảm bảo trước rằng bạn có quyền truy cập độc quyền (exclusive access) vào các cổng đó. Kernel cung cấp một giao diện đăng ký (registration interface) cho phép driver của bạn chiếm giữ các cổng mà nó cần. Hàm cốt lõi trong giao diện đó là *request_region*:

```
## include <linux/ioport.h>
struct resource *request_region(unsigned long first, unsigned long n,
 const char *name);
```

Hàm này thông báo cho kernel rằng bạn muốn sử dụng $n$ cổng, bắt đầu từ cổng `first`. Tham số `name` phải là tên thiết bị của bạn. Giá trị trả về khác NULL nếu việc cấp phát thành công. Nếu bạn nhận lại giá trị NULL từ *request_region*, bạn sẽ không thể sử dụng các cổng mong muốn.

Tất cả các phân bổ cổng đều hiển thị trong */proc/ioports*. Nếu bạn không thể cấp phát một tập hợp cổng cần thiết, đó là nơi bạn cần xem xét để biết ai đã chiếm giữ chúng trước.

Khi bạn đã hoàn tất với một tập hợp cổng I/O (có lẽ tại thời điểm gỡ module - module unload), chúng nên được trả lại cho hệ thống bằng hàm:

```
void release_region(unsigned long start, unsigned long n);
```

Ngoài ra còn có một hàm cho phép driver của bạn kiểm tra xem một tập hợp cổng I/O cho trước có sẵn sàng hay không:

```
int check_region(unsigned long first, unsigned long n);
```

Ở đây, giá trị trả về là một mã lỗi âm (negative error code) nếu các cổng được chỉ định không khả dụng. Hàm này đã lỗi thời (deprecated) vì giá trị trả về của nó không cung cấp đảm bảo nào về việc liệu việc cấp phát có thành công hay không; việc kiểm tra và sau đó cấp phát không phải là một thao tác nguyên tử (atomic operation). Chúng tôi liệt kê nó ở đây vì một số driver vẫn đang sử dụng nó, nhưng bạn nên luôn sử dụng *request_region*, hàm thực hiện việc khóa (locking) cần thiết để đảm bảo rằng việc cấp phát được thực hiện theo cách an toàn và mang tính nguyên tử.

### Thao tác với I/O Port

Sau khi một driver đã yêu cầu dải I/O port mà nó cần sử dụng cho các hoạt động của mình, nó phải tiến hành đọc và/hoặc ghi vào các port đó. Để thực hiện việc này, hầu hết phần cứng đều phân biệt giữa các port 8-bit, 16-bit và 32-bit. Thông thường, bạn không thể kết hợp chúng như cách bạn vẫn làm với việc truy cập bộ nhớ hệ thống.\*

Do đó, một chương trình C phải gọi các hàm khác nhau để truy cập các port có kích thước khác nhau. Như đã gợi ý trong phần trước, các kiến trúc máy tính chỉ hỗ trợ các thanh ghi I/O ánh xạ bộ nhớ (memory-mapped I/O registers) sẽ giả lập I/O port bằng cách ánh xạ lại (remapping) địa chỉ port thành địa chỉ bộ nhớ, và kernel sẽ che giấu các chi tiết này khỏi driver nhằm đơn giản hóa khả năng di động (portability). Các file header của Linux kernel (cụ thể là file header phụ thuộc kiến trúc *<asm/io.h>*) định nghĩa các hàm inline sau để truy cập I/O port:

unsigned inb(unsigned port);

void outb(unsigned char byte, unsigned port);

Đọc hoặc ghi các port dạng byte (độ rộng tám bit). Đối số `port` được định nghĩa là `unsigned long` trên một số nền tảng và `unsigned short` trên các nền tảng khác. Kiểu trả về của *inb* cũng khác nhau giữa các kiến trúc.

unsigned inw(unsigned port);

void outw(unsigned short word, unsigned port);

Các hàm này truy cập các port 16-bit (độ rộng một word); chúng không khả dụng khi biên dịch cho nền tảng S390, vốn chỉ hỗ trợ I/O dạng byte.

unsigned inl(unsigned port);

void outl(unsigned longword, unsigned port);

Các hàm này truy cập các port 32-bit. `longword` được khai báo là `unsigned long` hoặc `unsigned int`, tùy thuộc vào nền tảng. Giống như word I/O, "long" I/O không khả dụng trên S390.

Từ bây giờ, khi chúng ta sử dụng từ `unsigned` mà không có thêm các thông số kỹ thuật về kiểu dữ liệu, chúng ta đang đề cập đến một định nghĩa phụ thuộc vào kiến trúc (architecture-dependent definition) mà bản chất chính xác của nó không quá quan trọng. Các hàm này hầu như luôn có thể mang tính di động (portable), bởi vì trình biên dịch sẽ tự động ép kiểu (cast) các giá trị trong quá trình gán—việc chúng là `unsigned` giúp ngăn ngừa các cảnh báo tại thời điểm biên dịch (compile-time warnings). Không có thông tin nào bị mất với các phép ép kiểu như vậy miễn là lập trình viên gán các giá trị hợp lý để tránh tràn bộ nhớ (overflow). Chúng ta sẽ tuân thủ quy ước "định kiểu chưa đầy đủ" (incomplete typing) này xuyên suốt chương trình của chương này.

Lưu ý rằng không có thao tác I/O port 64-bit nào được định nghĩa. Ngay cả trên các kiến trúc 64-bit, không gian địa chỉ port (port address space) vẫn sử dụng đường dẫn dữ liệu tối đa là 32-bit.

Đôi khi, các I/O port được sắp xếp giống như bộ nhớ, và bạn có thể (ví dụ) kết hợp hai lần ghi 8-bit thành một thao tác 16-bit duy nhất. Điều này áp dụng, chẳng hạn, cho các bo mạch video trên PC. Nhưng nhìn chung, bạn không thể dựa vào tính năng này.

### Truy cập I/O Port từ User Space

Các hàm vừa được mô tả chủ yếu nhằm mục đích được sử dụng bởi các device driver, nhưng chúng cũng có thể được sử dụng từ user space, ít nhất là trên các máy tính loại PC. Thư viện GNU C định nghĩa chúng trong *<sys/io.h>*. Các điều kiện sau đây phải được đáp ứng để *inb* và các hàm tương tự có thể được sử dụng trong mã nguồn user-space:

- Chương trình phải được biên dịch với tùy chọn *-O* để ép buộc mở rộng các hàm inline.
- System call *ioperm* hoặc *iopl* phải được sử dụng để lấy quyền thực hiện các thao tác I/O trên các port. *ioperm* lấy quyền cho từng port riêng lẻ, trong khi *iopl* lấy quyền cho toàn bộ không gian I/O. Cả hai hàm này đều dành riêng cho kiến trúc x86 (x86-specific).
- Chương trình phải chạy dưới quyền root để gọi *ioperm* hoặc *iopl*\*.\* Ngoài ra, một trong các tiến trình cha (ancestor) của nó phải đã có được quyền truy cập port khi chạy dưới quyền root.

Nếu nền tảng máy chủ không có system call *ioperm* và *iopl*, user space vẫn có thể truy cập các I/O port bằng cách sử dụng file thiết bị */dev/port*. Tuy nhiên, xin lưu ý rằng ý nghĩa của file này phụ thuộc rất nhiều vào nền tảng và có lẽ không có ích cho bất kỳ việc gì ngoài PC.

Các mã nguồn mẫu *misc-progs/inp.c* và *misc-progs/outp.c* là một công cụ tối giản để đọc và ghi các port từ dòng lệnh (command line), trong user space. Chúng được kỳ vọng sẽ được cài đặt dưới nhiều tên khác nhau (ví dụ: *inb*, *inw*, và *inl* và thao tác với các port byte, word, hoặc long tùy thuộc vào tên nào được người dùng gọi). Chúng sử dụng *ioperm* hoặc *iopl* trên x86, và */dev/port* trên các nền tảng khác.

Các chương trình này có thể được gán quyền setuid root, nếu bạn muốn sống liều lĩnh và mày mò với phần cứng của mình mà không cần có các đặc quyền tường minh. Tuy nhiên, xin vui lòng không cài đặt chúng với quyền setuid trên một hệ thống sản xuất (production system); chúng là một lỗ hổng bảo mật do thiết kế (security hole by design).

## Thao tác chuỗi (String Operations)

Ngoài các thao tác vào/ra đơn lẻ (single-shot in and out operations), một số bộ vi xử lý thực hiện các tập lệnh đặc biệt để truyền một chuỗi các byte, từ (word), hoặc từ dài (long) đến và đi từ một cổng I/O duy nhất hoặc cùng kích thước. Đây là các *tập lệnh chuỗi* (string instructions), và chúng thực hiện tác vụ nhanh hơn so với một vòng lặp bằng ngôn ngữ C. Các macro sau đây thực hiện khái niệm I/O chuỗi bằng cách sử dụng một tập lệnh máy đơn lẻ hoặc bằng cách thực thi một vòng lặp khít (tight loop) nếu bộ vi xử lý đích không có tập lệnh thực hiện I/O chuỗi. Các macro này hoàn toàn không được định nghĩa khi biên dịch cho nền tảng S390. Điều này không phải là vấn đề về tính di động (portability), vì nền tảng này thường không chia sẻ trình điều khiển thiết bị (device driver) với các nền tảng khác do các bus ngoại vi của nó khác biệt.

**Sử dụng Cổng I/O | 241**

Về mặt kỹ thuật, tiến trình phải có quyền năng `CAP_SYS_RAWIO`, nhưng quyền này cũng tương đương với việc chạy dưới quyền root trên hầu hết các hệ thống hiện tại.

Các nguyên mẫu (prototype) cho các hàm chuỗi là:

```c
void insb(unsigned port, void *addr, unsigned long count);
void outsb(unsigned port, void *addr, unsigned long count);
```

Đọc hoặc ghi `count` byte bắt đầu từ địa chỉ bộ nhớ `addr`. Dữ liệu được đọc từ hoặc ghi vào một cổng `port` duy nhất.

```c
void insw(unsigned port, void *addr, unsigned long count);
void outsw(unsigned port, void *addr, unsigned long count);
    Đọc hoặc ghi các giá trị 16-bit vào một cổng 16-bit duy nhất.
void insl(unsigned port, void *addr, unsigned long count);
void outsl(unsigned port, void *addr, unsigned long count);
    Đọc hoặc ghi các giá trị 32-bit vào một cổng 32-bit duy nhất.
```

Có một điều cần ghi nhớ khi sử dụng các hàm chuỗi: chúng di chuyển một luồng byte trực tiếp đến hoặc từ cổng. Khi cổng và hệ thống máy chủ (host system) có các quy tắc thứ tự byte (byte ordering) khác nhau, kết quả có thể gây bất ngờ. Việc đọc một cổng bằng *inw* sẽ hoán đổi các byte, nếu cần thiết, để làm cho giá trị đọc được khớp với thứ tự của máy chủ. Ngược lại, các hàm chuỗi không thực hiện việc hoán đổi này.

### Tạm dừng I/O (Pausing I/O)

Một số nền tảng—nổi bật nhất là i386—có thể gặp sự cố khi bộ xử lý cố gắng truyền dữ liệu quá nhanh đến hoặc đi từ bus. Các sự cố này có thể phát sinh khi bộ vi xử lý được ép xung so với bus ngoại vi (hãy nghĩ đến ISA ở đây) và có thể xuất hiện khi bo mạch thiết bị quá chậm. Giải pháp là chèn một độ trễ nhỏ sau mỗi lệnh I/O nếu có một lệnh tương tự theo sau. Trên kiến trúc x86, việc tạm dừng này đạt được bằng cách thực hiện một lệnh `outb` đến cổng `0x80` (thường là nhưng không phải luôn luôn không được sử dụng), hoặc bằng cách bận chờ (busy waiting). Xem tệp *io.h* trong thư mục con *asm* của nền tảng bạn để biết thêm chi tiết.

Nếu thiết bị của bạn bị mất dữ liệu, hoặc nếu bạn lo ngại nó có thể bỏ sót dữ liệu, bạn có thể sử dụng các hàm tạm dừng thay cho các hàm thông thường. Các hàm tạm dừng hoàn toàn giống với các hàm đã liệt kê trước đó, nhưng tên của chúng tận cùng bằng *\_p*; chúng được gọi là *inb_p*, *outb_p*, v.v. Các hàm này được định nghĩa cho hầu hết các kiến trúc được hỗ trợ, mặc dù chúng thường mở rộng thành cùng một mã lệnh giống như I/O không tạm dừng, bởi vì không cần thêm độ trễ nếu kiến trúc chạy với một bus ngoại vi tương đối hiện đại.

### Các Phụ thuộc Nền tảng (Platform Dependencies)

Các lệnh I/O (I/O instructions), về bản chất, phụ thuộc rất nhiều vào bộ xử lý (processor dependent). Do chúng làm việc với các chi tiết về cách bộ xử lý xử lý việc chuyển dữ liệu ra và vào, nên rất khó để ẩn đi sự khác biệt giữa các hệ thống. Do đó, phần lớn mã nguồn liên quan đến cổng I/O (port I/O) đều phụ thuộc vào nền tảng (platform-dependent).

Bạn có thể thấy một trong những điểm không tương thích, đó là kiểu dữ liệu (data typing), bằng cách nhìn lại danh sách các hàm, nơi các đối số được định nghĩa kiểu khác nhau dựa trên sự khác biệt về kiến trúc giữa các nền tảng.

Ví dụ, một cổng (port) có kiểu `unsigned short` trên x86 (nơi bộ xử lý hỗ trợ không gian I/O 64-KB), nhưng lại là `unsigned long` trên các nền tảng khác, nơi các cổng chỉ đơn giản là các vị trí đặc biệt nằm trong cùng không gian địa chỉ với bộ nhớ (memory-mapped).

Các phụ thuộc nền tảng khác phát sinh từ những khác biệt cấu trúc cơ bản trong các bộ xử lý và do đó, là điều không thể tránh khỏi. Chúng ta sẽ không đi sâu vào chi tiết về sự khác biệt này, bởi vì chúng tôi giả định rằng bạn sẽ không viết một trình điều khiển thiết bị (device driver) cho một hệ thống cụ thể nào mà lại không hiểu rõ về phần cứng bên dưới. Thay vào đó, dưới đây là tổng quan về các khả năng của các kiến trúc được hỗ trợ bởi nhân hệ điều hành (kernel):

#### *IA-32 (x86)*

#### *x86\_64*

Kiến trúc này hỗ trợ tất cả các hàm được mô tả trong chương này. Các số hiệu cổng (port numbers) có kiểu `unsigned short`.

#### *IA-64 (Itanium)*

Tất cả các hàm đều được hỗ trợ; các cổng có kiểu `unsigned long` (và được ánh xạ vào bộ nhớ - memory-mapped). Các hàm chuỗi (string functions) được triển khai bằng ngôn ngữ C.

#### *Alpha*

Tất cả các hàm đều được hỗ trợ, và các cổng được ánh xạ vào bộ nhớ (memory-mapped). Việc triển khai cổng I/O (port I/O) khác nhau tùy theo các nền tảng Alpha khác nhau, tùy thuộc vào chipset mà chúng sử dụng. Các hàm chuỗi được triển khai bằng C và được định nghĩa trong *arch/alpha/lib/io.c*. Các cổng có kiểu `unsigned long`.

#### *ARM*

Các cổng được ánh xạ vào bộ nhớ, và tất cả các hàm đều được hỗ trợ; các hàm chuỗi được triển khai bằng C. Các cổng có kiểu `unsigned int`.

#### *Cris*

Kiến trúc này không hỗ trợ sự trừu tượng hóa cổng I/O (I/O port abstraction) ngay cả ở chế độ giả lập (emulated mode); các thao tác cổng khác nhau được định nghĩa là không làm gì cả.

#### *M68k*

#### *M68k-nommu*

Các cổng được ánh xạ vào bộ nhớ. Các hàm chuỗi được hỗ trợ, và kiểu cổng là `unsigned char *`.

#### *MIPS*

#### *MIPS64*

Cổng MIPS hỗ trợ tất cả các hàm. Các thao tác chuỗi được triển khai bằng các vòng lặp hợp ngữ (assembly loops) chặt chẽ, bởi vì bộ xử lý thiếu tính năng I/O chuỗi cấp độ máy (machine-level string I/O). Các cổng được ánh xạ vào bộ nhớ; chúng có kiểu `unsigned long`.

#### *PA-RISC*

Tất cả các hàm đều được hỗ trợ; các cổng có kiểu `int` trên các hệ thống dựa trên PCI và `unsigned short` trên các hệ thống dựa trên EISA, ngoại trừ các thao tác chuỗi, vốn sử dụng số hiệu cổng kiểu `unsigned long`.

*PowerPC*

*PowerPC64*

Tất cả các hàm đều được hỗ trợ; các cổng có kiểu `unsigned char *` trên các hệ thống 32-bit và `unsigned long` trên các hệ thống 64-bit.

*S390*

Tương tự như M68k, tệp tiêu đề (header) cho nền tảng này chỉ hỗ trợ I/O cổng độ rộng một byte (byte-wide port I/O) mà không có các thao tác chuỗi. Các cổng là các con trỏ kiểu char và được ánh xạ vào bộ nhớ.

*Super-H*

Các cổng có kiểu `unsigned int` (được ánh xạ vào bộ nhớ), và tất cả các hàm đều được hỗ trợ.

*SPARC*

*SPARC64*

Một lần nữa, không gian I/O được ánh xạ vào bộ nhớ. Các phiên bản của hàm cổng được định nghĩa để làm việc với các cổng kiểu `unsigned long`.

Bạn đọc tò mò có thể khai thác thêm thông tin từ các tệp *io.h*, đôi khi chúng định nghĩa một số hàm đặc thù cho kiến trúc (architecture-specific functions) bổ sung cho những hàm mà chúng ta mô tả trong chương này. Tuy nhiên, hãy cảnh giác rằng một số tệp này khá khó đọc.

Thật thú vị khi lưu ý rằng không có bộ xử lý nào bên ngoài họ x86 có không gian địa chỉ dành riêng cho các cổng, mặc dù một số họ bộ xử lý được hỗ trợ đi kèm với các khe cắm ISA và/hoặc PCI (và cả hai bus này đều triển khai các không gian địa chỉ bộ nhớ và I/O riêng biệt).

Hơn nữa, một số bộ xử lý (đáng chú ý nhất là các dòng Alpha đời đầu) thiếu các lệnh di chuyển một hoặc hai byte tại một thời điểm.\* Do đó, các chipset ngoại vi của chúng mô phỏng việc truy cập I/O 8-bit và 16-bit bằng cách ánh xạ chúng tới các dải địa chỉ đặc biệt trong không gian địa chỉ bộ nhớ. Do đó, một lệnh `inb` và một lệnh `inw` tác động lên cùng một cổng được triển khai bằng hai lần đọc bộ nhớ 32-bit (32-bit memory reads) hoạt động trên các địa chỉ khác nhau. May mắn thay, tất cả điều này đều được ẩn khỏi người viết trình điều khiển thiết bị (device driver writer) bởi phần bên trong của các macro được mô tả trong phần này, nhưng chúng tôi cảm thấy đây là một tính năng thú vị cần lưu ý. Nếu bạn muốn tìm hiểu sâu hơn, hãy tìm các ví dụ trong *include/asm-alpha/core\_lca.h*.

Cách các thao tác I/O được thực hiện trên mỗi nền tảng được mô tả rất rõ trong tài hướng dẫn dành cho lập trình viên (programmer's manual) của từng nền tảng; các tài liệu hướng dẫn đó thường có sẵn để tải xuống dưới dạng tệp PDF trên Web.

I/O đơn byte (Single-byte I/O) không quan trọng như người ta có thể tưởng tượng, bởi vì đây là một thao tác hiếm khi xảy ra. Để đọc/ghi một byte đơn tới bất kỳ không gian địa chỉ nào, bạn cần triển khai một đường dẫn dữ liệu (data path) kết nối các bit thấp của bus dữ liệu tập thanh ghi (register-set data bus) với bất kỳ vị trí byte nào trong bus dữ liệu ngoại vi (external data bus). Các đường dẫn dữ liệu này đòi hỏi các cổng logic bổ sung làm cản trở mọi quá trình truyền dữ liệu. Việc loại bỏ các lệnh nạp và lưu độ rộng theo byte (byte-wide loads and stores) có thể mang lại lợi ích cho hiệu năng tổng thể của hệ thống.

## Ví dụ về Cổng I/O (I/O Port)

Mã nguồn mẫu mà chúng ta sử dụng để minh họa hoạt động xuất/nhập cổng (port I/O) từ bên trong một trình điều khiển thiết bị (device driver) sẽ tác động lên các cổng I/O số đa dụng (general-purpose digital I/O port); những cổng như vậy có mặt trong hầu hết các hệ thống máy tính.

Một cổng I/O số, ở dạng phổ biến nhất của nó, là một vùng I/O có độ rộng bằng một byte (byte-wide), được ánh xạ bộ nhớ (memory-mapped) hoặc ánh xạ theo cổng (port-mapped). Khi bạn ghi một giá trị vào vị trí xuất (output location), tín hiệu điện xuất hiện trên các chân đầu ra (output pin) sẽ thay đổi tương ứng với từng bit dữ liệu được ghi. Khi bạn đọc một giá trị từ vị trí nhập (input location), mức logic hiện tại trên các chân đầu vào (input pin) sẽ được trả về dưới dạng các giá trị từng bit một.

Việc hiện thực hóa thực tế và giao diện phần mềm của các cổng I/O như vậy sẽ khác nhau tùy theo hệ thống. Phần lớn thời gian, các chân I/O được điều khiển bởi hai vị trí I/O: một vị trí cho phép lựa chọn chân nào được dùng làm đầu vào và chân nào được dùng làm đầu ra, và một vị trí khác nơi bạn thực sự có thể đọc hoặc ghi các mức logic. Tuy nhiên, đôi khi mọi thứ thậm chí còn đơn giản hơn, các bit được nối cứng (hardwired) sẵn là đầu vào hoặc đầu ra (nhưng trong trường hợp này, chúng không còn được gọi là "I/O đa dụng" nữa); cổng song song (parallel port) được tìm thấy trên tất cả các máy tính cá nhân là một ví dụ về loại cổng I/O không-đa-dụng như vậy. Dù theo cách nào đi nữa, các chân I/O vẫn có thể sử dụng được thông qua đoạn mã mẫu mà chúng ta sẽ giới thiệu ngay sau đây.

### Tổng quan về Cổng Song Song (Parallel Port)

Vì chúng tôi kỳ vọng phần lớn độc giả đang sử dụng nền tảng x86 dưới dạng được gọi là "máy tính cá nhân" (personal computer), chúng tôi thấy rằng việc giải thích cách thiết kế cổng song song trên máy tính cá nhân là rất hữu ích. Cổng song song là giao diện ngoại vi được lựa chọn hàng đầu để chạy mã nguồn mẫu I/O số trên một máy tính cá nhân. Mặc dù hầu hết độc giả có lẽ đã có sẵn các thông số kỹ thuật của cổng song song, chúng tôi vẫn tóm tắt lại chúng ở đây để bạn tiện tham khảo.

Giao diện song song, ở cấu hình tối thiểu của nó (chúng ta bỏ qua các chế độ ECP và EPP), được cấu thành từ ba cổng 8-bit. Tiêu chuẩn của máy tính cá nhân (PC standard) bắt đầu các cổng I/O cho giao diện song song thứ nhất tại địa chỉ `0x378` và giao diện thứ hai tại `0x278`. Cổng đầu tiên là một thanh ghi dữ liệu hai chiều (bidirectional data register); nó kết nối trực tiếp với các chân từ 2 đến 9 trên đầu cắm vật lý (physical connector). Cổng thứ hai là một thanh ghi trạng thái chỉ-đọc (read-only status register); khi cổng song song được sử dụng cho máy in, thanh ghi này báo cáo một số khía cạnh về trạng thái của máy in, chẳng hạn như đang trực tuyến (online), hết giấy (out of paper), hoặc đang bận (busy). Cổng thứ ba là một thanh ghi điều khiển chỉ-ghi (output-only control register), trong số các chức năng khác, nó điều khiển việc ngắt (interrupt) có được cho phép (enable) hay không.

Các mức tín hiệu được sử dụng trong truyền thông song song là các mức logic transistor-transistor tiêu chuẩn (TTL - transistor-transistor logic): 0 và 5 volt, với ngưỡng logic ở khoảng 1,2 volt. Bạn có thể tin tưởng rằng các cổng này ít nhất đáp ứng được các định mức dòng điện TTL LS tiêu chuẩn, mặc dù hầu hết các cổng song song hiện đại đều có các định mức dòng điện và điện áp tốt hơn thế.

Đầu cắm song song không được cách ly khỏi mạch điện bên trong của máy tính, điều này rất hữu ích nếu bạn muốn kết nối các cổng logic trực tiếp với cổng này. Nhưng bạn phải cẩn thận để đi dây cho đúng; mạch của cổng song song rất dễ bị hỏng khi bạn nghịch ngợm với mạch tùy chỉnh của riêng mình, trừ khi bạn thêm bộ cách ly quang (optoisolator) vào mạch của mình. Bạn có thể chọn sử dụng các thẻ cắm cổng song song rời (plug-in parallel port) nếu bạn sợ làm hỏng bo mạch chủ (motherboard) của mình.

Các thông số kỹ thuật của từng bit được phác thảo trong Hình 9-1. Bạn có thể truy cập 12 bit đầu ra và 5 bit đầu vào, một số trong đó bị đảo ngược về mặt logic trên đường truyền tín hiệu của chúng. Bit duy nhất không có chân tín hiệu liên quan là bit 4 (`0x10`) của cổng 2, dùng để cho phép ngắt từ cổng song song. Chúng ta sẽ sử dụng bit này như một phần trong việc hiện thực hóa trình xử lý ngắt (interrupt handler) trong Chương 10.

```text
PARALLEL PORT REGISTER MAP
==========================

Control port: base_addr + 2
  Bit:  7  6  5  4  3  2  1  0
       [ ][ ][ ][ ][ ][17][16][14][1]
                            |
                        irq enable

Status port: base_addr + 1
  Bit:  7  6  5  4  3  2  1  0
       [11][10][12][13][15][ ][ ][ ]

Data port: base_addr + 0
  Bit:  7  6  5  4  3  2  1  0
       [ 9][ 8][ 7][ 6][ 5][ 4][ 3][ 2]

PIN MAPPING (DB-25 Connector)
==============================

                                            Pin 1  ──────────────────→  (Control)
Data bit 0 (pin 2)  ──[>]──────────────→   Pin 2  ●
Data bit 1 (pin 3)  ──[>]──────────────→   Pin 3  ●
Data bit 2 (pin 4)  ──[>]──────────────→   Pin 4  ●
Data bit 3 (pin 5)  ──[>]──────────────→   Pin 5  ●
Data bit 4 (pin 6)  ──[>]──────────────→   Pin 6  ●
Data bit 5 (pin 7)  ──[>]──────────────→   Pin 7  ●
Data bit 6 (pin 8)  ──[>]──────────────→   Pin 8  ●
Data bit 7 (pin 9)  ──[>]──────────────→   Pin 9  ●
Status bit 15       ────────────────────   Pin 10 ●  (input)
Status bit 11       ──[inv]─────────────   Pin 11 ●  (input, inverted)
Status bit 12       ────────────────────   Pin 12 ●  (input)
Status bit 13       ────────────────────   Pin 13 ●  (input)
Control bit 14      ──[inv]─────────────→  Pin 14 ●  (output, inverted)
                                           Pin 25 ●──── GND
```

```
KEY
====
  ──────   Input line (Đường tín hiệu vào)
  ──────   Output line (Đường tín hiệu ra)
  [>]      Non-inverting buffer (output) (Bộ đệm không đảo - ngõ ra)
  [inv]    Inverting buffer (Bộ đệm đảo)

  Bit #:   3  2
  Pin #:  17 16   (black = inverted, white = noninverted) (đen = đảo, trắng = không đảo)
``

*Hình 9-1. Sơ đồ chân của cổng song song (parallel port)*

### Một Driver Mẫu
Driver mà chúng tôi giới thiệu có tên là *short* (Simple Hardware Operations and Raw Tests - Các thao tác phần cứng đơn giản và kiểm tra thô). Tất cả những gì nó làm là đọc và ghi một vài cổng 8-bit, bắt đầu từ cổng mà bạn chọn tại thời điểm nạp (load time). Theo mặc định, nó sử dụng dải cổng được gán cho giao diện song song của máy tính PC. Mỗi device node (với một minor number duy nhất) truy cập đến một cổng khác nhau. Driver *short* không thực hiện bất kỳ chức năng hữu ích nào thực tế; nó chỉ cô lập để sử dụng bên ngoài như một tập lệnh đơn lẻ tác động lên một cổng. Nếu bạn chưa quen với việc xuất/nhập cổng (port I/O), bạn có thể sử dụng *short* để làm quen với nó; bạn có thể đo thời gian cần thiết để truyền dữ liệu qua một cổng hoặc thực hiện các thử nghiệm khác.

Để *short* hoạt động trên hệ thống của bạn, nó phải có quyền truy cập tự do vào thiết bị phần cứng bên dưới (theo mặc định là giao diện song song); do đó, không có driver nào khác được phép cấp phát nó. Hầu hết các bản phân phối hiện đại thiết lập các driver cổng song song dưới dạng module chỉ được nạp khi cần thiết, vì vậy tranh chấp địa chỉ I/O (I/O address) thường không phải là vấn đề. Tuy nhiên, nếu bạn nhận được lỗi "can't get I/O address" từ *short* (trên console hoặc trong tệp nhật ký hệ thống - system log file), có thể một driver nào khác đã chiếm giữ cổng đó. Một cái nhìn nhanh vào */proc/ioports* thường sẽ cho bạn biết driver nào đang gây cản trở. Lưu ý tương tự cũng áp dụng cho các thiết bị I/O khác nếu bạn không sử dụng giao diện song song.

Từ bây giờ, chúng tôi chỉ gọi đơn giản là "giao diện song song" để đơn giản hóa thảo luận. Tuy nhiên, bạn có thể thiết lập tham số module cơ sở tại thời điểm nạp để chuyển hướng *short* sang các thiết bị I/O khác. Tính năng này cho phép mã nguồn mẫu chạy trên bất kỳ nền tảng Linux nào mà bạn có quyền truy cập vào giao diện I/O số có thể truy cập thông qua *outb* và *inb* (mặc dù phần cứng thực tế được ánh xạ bộ nhớ - memory-mapped trên tất cả các nền tảng ngoại trừ x86). Sau đó, trong phần "Sử dụng bộ nhớ I/O" (Using I/O Memory), chúng tôi sẽ chỉ cách *short* có thể được sử dụng với I/O số ánh xạ bộ nhớ tổng quát.

Để quan sát những gì xảy ra trên đầu nối song song và nếu bạn có chút hứng thú làm việc với phần cứng, bạn có thể hàn một vài đèn LED vào các chân ngõ ra. Mỗi đèn LED nên được mắc nối tiếp với một điện trở 1-KΩ dẫn đến chân nối đất (ground pin) (trừ khi, tất nhiên, đèn LED của bạn đã tích hợp sẵn điện trở). Nếu bạn kết nối chân ngõ ra với chân ngõ vào, bạn sẽ tự tạo ra tín hiệu ngõ vào để đọc từ các cổng ngõ vào.

Lưu ý rằng bạn không thể chỉ kết nối máy in với cổng song song và thấy dữ liệu được gửi đến *short*. Driver này triển khai việc truy cập đơn giản vào các cổng I/O và không thực hiện quá trình bắt tay (handshake) mà máy in cần để xử lý dữ liệu. Trong chương tiếp theo, chúng tôi sẽ trình bày một driver mẫu (có tên là *shortprint*), có khả năng điều khiển máy printer song song; tuy nhiên, driver đó sử dụng ngắt (interrupt), vì vậy chúng ta chưa thể tìm hiểu ngay bây giờ.

Nếu bạn định quan sát dữ liệu song song bằng cách hàn đèn LED vào đầu nối kiểu D (D-type connector), chúng tôi khuyên bạn không nên sử dụng chân 9 và 10, vì chúng ta sẽ nối chúng lại với nhau sau để chạy mã nguồn mẫu được trình bày trong Chương 10.

Đối với *short*, */dev/short0* ghi vào và đọc từ cổng 8-bit nằm ở địa chỉ I/O cơ sở base (0x378 trừ khi thay đổi tại thời điểm nạp). */dev/short1* ghi vào cổng 8-bit nằm ở base + 1, v.v. cho đến base + 7.

Thao tác ngõ ra thực tế được thực hiện bởi */dev/short0* dựa trên một vòng lặp chặt chẽ (tight loop) sử dụng *outb*. Một lệnh rào cản bộ nhớ (memory barrier instruction) được sử dụng để đảm bảo rằng thao tác ngõ ra thực sự diễn ra và không bị tối ưu hóa mất đi:

```

while (count--) {
outb(*(ptr++), port);
wmb( );
}

```

Bạn có thể chạy lệnh sau để thắp sáng các đèn LED của mình:

```

echo -n "any string" > /dev/short0

```

Mỗi đèn LED giám sát một bit đơn của cổng ngõ ra. Hãy nhớ rằng chỉ ký tự cuối cùng được ghi mới giữ nguyên trạng thái trên các chân ngõ ra đủ lâu để mắt bạn có thể nhậnω ra. Vì lý do đó, chúng tôi khuyên bạn nên ngăn chặn việc tự động chèn ký tự xuống dòng ở cuối (trailing newline) bằng cách truyền tùy chọn *-n* cho *echo*.

Quá trình đọc được thực hiện bằng một hàm tương tự, được xây dựng xung quanh *inb* thay vì *outb*. Để đọc các giá trị "có ý nghĩa" từ cổng song song, bạn cần có một phần cứng nào đó được kết nối với các chân ngõ vào của đầu nối để tạo ra tín hiệu. Nếu không có tín hiệu, bạn sẽ đọc một dòng vô tận các byte giống hệt nhau. Nếu bạn chọn đọc từ một cổng ngõ ra, rất có thể bạn sẽ nhận lại giá trị cuối cùng được ghi vào cổng đó (điều này áp dụng cho giao diện song song và hầu hết các mạch I/O số khác đang được sử dụng phổ biến). Do đó, những ai không thích cầm mỏ hàn có thể đọc giá trị ngõ ra hiện tại trên cổng 0x378 bằng cách chạy một lệnh như:

```

dd if=/dev/short0 bs=1 count=1 | od -t x1

```

Để minh họa việc sử dụng tất cả các tập lệnh I/O, có ba biến thể của mỗi thiết bị *short*: */dev/short0* thực hiện vòng lặp vừa hiển thị, */dev/short0p* sử dụng *outb\_p* và *inb\_p* thay cho các hàm "nhanh" (fast functions), và */dev/short0s* sử dụng các tập lệnh chuỗi (string instructions). Có tám thiết bị như vậy, từ *short0* đến *short7*. Mặc dù giao diện song song của PC chỉ có ba cổng, bạn có thể cần nhiều hơn thế nếu sử dụng một thiết bị I/O khác để chạy các thử nghiệm của mình.
```

Driver *short* thực hiện việc điều khiển phần cứng ở mức tối thiểu tuyệt đối nhưng lại đủ để minh họa cách sử dụng các chỉ thị cổng I/O (I/O port instructions). Bạn đọc quan tâm có thể xem mã nguồn của các module *parport* và *parport\_pc* để thấy thiết bị này có thể trở nên phức tạp như thế nào trong thực tế nhằm hỗ trợ nhiều loại thiết bị khác nhau (máy in, thiết bị lưu trữ băng từ, giao diện mạng) trên cổng song song (parallel port).

## Sử dụng Bộ nhớ I/O (I/O Memory)

Bất chấp mức độ phổ biến của các cổng I/O trong thế giới x86, cơ chế chính được sử dụng để giao tiếp với các thiết bị là thông qua các thanh ghi ánh xạ bộ nhớ (memory-mapped registers) và bộ nhớ thiết bị. Cả hai đều được gọi là *bộ nhớ I/O* (*I/O memory*) bởi vì sự khác biệt giữa các thanh ghi và bộ nhớ là trong suốt (transparent) đối với phần mềm.

Bộ nhớ I/O đơn giản là một vùng chứa các ô nhớ có tính chất giống RAM mà thiết bị cung cấp cho bộ xử lý (processor) thông qua bus. Bộ nhớ này có thể được sử dụng cho nhiều mục đích khác nhau, chẳng hạn như chứa dữ liệu video hoặc các gói tin Ethernet, cũng như triển khai các thanh ghi thiết bị hoạt động giống hệt như các cổng I/O (tức là chúng có các tác dụng phụ - side effects liên quan đến việc đọc và ghi dữ liệu lên chúng).

Cách thức truy cập bộ nhớ I/O phụ thuộc vào kiến trúc máy tính, bus và thiết bị đang được sử dụng, mặc dù các nguyên lý là như nhau ở mọi nơi. Phần thảo luận

trong chương này chủ yếu đề cập đến bộ nhớ ISA và PCI, đồng thời cố gắng truyền tải các thông tin chung. Mặc dù việc truy cập bộ nhớ PCI được giới thiệu ở đây, nhưng cuộc thảo luận chi tiết về PCI sẽ được dời lại sang Chương 12.

Tùy thuộc vào nền tảng máy tính và bus đang được sử dụng, bộ nhớ I/O có thể hoặc không cần được truy cập thông qua các bảng trang (page tables). Khi việc truy cập đi qua các bảng trang, kernel trước tiên phải sắp xếp để địa chỉ vật lý (physical address) hiển thị từ driver của bạn, và điều này thường có nghĩa là bạn phải gọi hàm *ioremap* trước khi thực hiện bất kỳ thao tác I/O nào. Nếu không cần bảng trang, các vị trí bộ nhớ I/O trông rất giống các cổng I/O, và bạn có thể chỉ cần đọc và ghi vào chúng bằng cách sử dụng các hàm bao bọc (wrapper functions) thích hợp.

Dù có yêu cầu *ioremap* để truy cập bộ nhớ I/O hay không, việc sử dụng trực tiếp các con trỏ (pointers) trỏ tới bộ nhớ I/O là điều không được khuyến khích. Mặc dù (như đã giới thiệu trong phần "Cổng I/O và Bộ nhớ I/O" - I/O Ports and I/O Memory) bộ nhớ I/O được định địa chỉ giống như RAM thông thường ở cấp độ phần cứng, nhưng những lưu ý bổ sung được phác thảo trong phần "Thanh ghi I/O và Bộ nhớ Quy ước" (I/O Registers and Conventional Memory) cho thấy việc nên tránh sử dụng các con trỏ thông thường. Các hàm bao bọc được sử dụng để truy cập bộ nhớ I/O là an toàn trên mọi nền tảng và được tối ưu hóa loại bỏ bất cứ khi nào thao tác giải tham chiếu con trỏ trực tiếp (straight pointer dereferencing) có thể thực hiện được thao tác đó.

Do đó, mặc dù việc giải tham chiếu một con trỏ vẫn hoạt động (ở thời điểm hiện tại) trên kiến trúc x86, việc không sử dụng các macro thích hợp sẽ làm cản trở tính di port (portability) và tính dễ đọc của driver.

### Cấp phát và Ánh xạ Bộ nhớ I/O (I/O Memory Allocation and Mapping)

Các vùng bộ nhớ I/O (I/O memory regions) phải được cấp phát trước khi sử dụng. Giao diện để cấp phát các vùng bộ nhớ (được định nghĩa trong *<linux/ioport.h>*) là:

```c
struct resource *request_mem_region(unsigned long start, unsigned long len,
 char *name);
```

Hàm này cấp phát một vùng bộ nhớ có kích thước `len` byte, bắt đầu từ địa chỉ `start`. Nếu mọi việc thuận lợi, một con trỏ khác `NULL` sẽ được trả về; ngược lại, giá trị trả về sẽ là `NULL`. Tất cả các phân bổ bộ nhớ I/O được liệt kê trong */proc/iomem*.

Các vùng bộ nhớ nên được giải phóng khi không còn cần thiết nữa:

```c
void release_mem_region(unsigned long start, unsigned long len);
```

Cũng có một hàm cũ dùng để kiểm tra tính khả dụng của vùng bộ nhớ I/O:

```c
int check_mem_region(unsigned long start, unsigned long len);
```

Tuy nhiên, giống như *check\_region*, hàm này không an toàn và nên tránh sử dụng.

Cấp phát bộ nhớ I/O không phải là bước bắt buộc duy nhất trước khi bộ nhớ đó có thể được truy cập. Bạn cũng phải đảm bảo rằng bộ nhớ I/O này đã được làm cho khả dụng đối với kernel. Việc tiếp cận bộ nhớ I/O không chỉ đơn thuần là giải tham chiếu (dereference) một con trỏ; trên nhiều hệ thống, bộ nhớ I/O hoàn toàn không thể truy cập trực tiếp theo cách đó. Vì vậy, một ánh xạ (mapping) phải được thiết lập trước. Đây là vai trò của hàm *ioremap*, đã được giới thiệu trong mục "vmalloc and Friends" ở Chương 1. Hàm này được thiết kế đặc biệt để gán các địa chỉ ảo (virtual addresses) cho các vùng bộ nhớ I/O.

Một khi đã trang bị *ioremap* (và *iounmap*), một trình điều khiển thiết bị (device driver) có thể truy cập bất kỳ địa chỉ bộ nhớ I/O nào, cho dù nó có được ánh xạ trực tiếp vào không gian địa chỉ ảo (virtual address space) hay không. Tuy nhiên, hãy nhớ rằng các địa chỉ trả về từ *ioremap* không nên bị giải tham chiếu trực tiếp; thay vào đó, các hàm truy cập do kernel cung cấp nên được sử dụng. Trước khi đi sâu vào các hàm đó, chúng ta nên xem lại các nguyên mẫu (prototypes) của *ioremap* và giới thiệu một vài chi tiết mà chúng ta đã bỏ qua ở chương trước.

Các hàm này được gọi theo định nghĩa sau:

```c
## include <asm/io.h>
void *ioremap(unsigned long phys_addr, unsigned long size);
void *ioremap_nocache(unsigned long phys_addr, unsigned long size);
void iounmap(void * addr);
```

Trước hết, bạn nhận thấy hàm mới *ioremap\_nocache*. Chúng ta đã không đề cập đến nó trong Chương 8, bởi vì ý nghĩa của nó chắc chắn liên quan đến phần cứng (hardware related). Trích dẫn từ một trong các tệp tiêu đề (header) của kernel: "Nó hữu ích nếu một số thanh ghi điều khiển nằm trong một khu vực như vậy, và việc kết hợp ghi (write combining) hoặc đệm đọc (read caching) là không mong muốn." Trên thực tế, việc thực thi của hàm này giống hệt với *ioremap* trên hầu hết các nền tảng máy tính: trong các tình huống mà toàn bộ bộ nhớ I/O đã hiển thị thông qua các địa chỉ không thể lưu đệm (noncacheable addresses), không có lý do gì để triển khai một phiên bản riêng biệt, không lưu đệm của *ioremap*.

### Truy cập Bộ nhớ I/O (I/O Memory)

Trên một số nền tảng, bạn có thể lách luật bằng cách sử dụng giá trị trả về từ *ioremap* như một con trỏ thông thường. Tuy nhiên, việc sử dụng như vậy không mang tính diพ. (portable), và các nhà phát triển kernel ngày càng nỗ lực loại bỏ mọi cách sử dụng như vậy. Cách thức đúng đắn để truy cập bộ nhớ I/O (I/O memory) là thông qua một tập hợp các hàm (được định nghĩa qua *<asm/io.h>*) được cung cấp cho mục đích này.

Để đọc từ bộ nhớ I/O (I/O memory), hãy sử dụng một trong các hàm sau:

```c
unsigned int ioread8(void *addr);
unsigned int ioread16(void *addr);
unsigned int ioread32(void *addr);
```

Ở đây, `addr` phải là một địa chỉ nhận được từ *ioremap* (có thể đi kèm với một khoảng lệch dạng số nguyên - integer offset); giá trị trả về chính là nội dung được đọc từ vùng nhớ I/O đã cho.

Có một tập hợp các hàm tương tự để ghi vào bộ nhớ I/O (I/O memory):

```c
void iowrite8(u8 value, void *addr);
void iowrite16(u16 value, void *addr);
void iowrite32(u32 value, void *addr);
```

Nếu bạn bắt buộc phải đọc hoặc ghi một chuỗi các giá trị tại một địa chỉ bộ nhớ I/O (I/O memory) cho trước, bạn có thể sử dụng các phiên bản lặp (repeating versions) của các hàm này:

```c
void ioread8_rep(void *addr, void *buf, unsigned long count);
void ioread16_rep(void *addr, void *buf, unsigned long count);
```

```c
void ioread32_rep(void *addr, void *buf, unsigned long count);
void iowrite8_rep(void *addr, const void *buf, unsigned long count);
void iowrite16_rep(void *addr, const void *buf, unsigned long count);
void iowrite32_rep(void *addr, const void *buf, unsigned long count);
```

Các hàm này thực hiện việc đọc hoặc ghi `count` giá trị từ `buf` đã cho đến `addr` đã cho. Lưu ý rằng `count` được tính bằng kích thước của dữ liệu đang được ghi; *ioread32\_rep* sẽ đọc `count` giá trị 32-bit bắt đầu từ `buf`.

Các hàm được mô tả ở trên thực hiện toàn bộ các thao tác I/O đến `addr` đã cho. Nếu thay vào đó, bạn cần thao tác trên cả một khối bộ nhớ I/O (I/O memory), bạn có thể sử dụng một trong các hàm sau:

```c
void memset_io(void *addr, u8 value, unsigned int count);
void memcpy_fromio(void *dest, void *source, unsigned int count);
void memcpy_toio(void *dest, void *source, unsigned int count);
```

Các hàm này hoạt động tương tự như các hàm tương đương trong thư viện chuẩn C.

Nếu bạn đọc lướt qua mã nguồn kernel (kernel source), bạn sẽ thấy rất nhiều lời gọi đến một tập hợp hàm cũ hơn khi sử dụng bộ nhớ I/O (I/O memory). Các hàm này vẫn hoạt động, nhưng việc sử dụng chúng trong mã nguồn mới không được khuyến khích (discouraged). Một trong những lý do là chúng ít an toàn hơn vì không thực hiện kiểm tra kiểu dữ liệu (type checking) tương tự. Dù vậy, chúng ta vẫn mô tả chúng ở đây:

```c
unsigned readb(address);
unsigned readw(address);
unsigned readl(address);
```

Các macro này được sử dụng để lấy các giá trị dữ liệu 8-bit, 16-bit và 32-bit từ bộ nhớ I/O (I/O memory).

```c
void writeb(unsigned value, address);
void writew(unsigned value, address);
void writel(unsigned value, address);
```

Giống như các hàm trước đó, các hàm (macro) này được sử dụng để ghi các phần tử dữ liệu kích thước 8-bit, 16-bit và 32-bit.

Một số nền tảng 64-bit cũng cung cấp *readq* và *writeq*, dùng cho các thao tác bộ nhớ từ kép - quad-word (8 byte) trên bus PCI. Thuật ngữ *quad-word* là một di sản lịch sử từ thời mà tất cả các bộ vi xử lý thực thụ chỉ có từ (word) 16-bit. Trên thực tế, quy ước đặt tên *L* (long) được dùng cho các giá trị 32-bit hiện cũng không còn hoàn toàn chính xác nữa, nhưng việc đổi tên mọi thứ sẽ chỉ làm cho mọi chuyện trở nên phức tạp hơn mà thôi.

### Cổng (Port) dưới dạng Bộ nhớ I/O

Một số phần cứng có một đặc tính thú vị: một số phiên bản sử dụng các cổng I/O (I/O ports), trong khi các phiên bản khác lại sử dụng bộ nhớ I/O (I/O memory). Các thanh ghi (registers) được xuất ra bộ xử lý là giống nhau trong cả hai trường hợp, nhưng phương thức truy cập thì khác nhau. Để đơn giản hóa công việc cho các driver xử lý loại phần cứng này, và nhằm giảm thiểu sự khác biệt rõ rệt giữa việc truy cập cổng I/O và truy cập bộ nhớ, nhân Linux (kernel) phiên bản 2.6 cung cấp một hàm gọi là *ioport\_map*:

void \*ioport\_map(unsigned long port, unsigned int count);

Hàm này ánh xạ lại (remap) count cổng I/O và làm cho chúng xuất hiện dưới dạng bộ nhớ I/O. Kể từ thời điểm đó trở đi, driver có thể sử dụng *ioread8* và các hàm tương tự trên các địa chỉ được trả về và hoàn toàn có thể quên mất rằng mình đang sử dụng các cổng I/O.

Việc ánh xạ này nên được hủy bỏ (unmap) khi không còn cần thiết nữa:

```
void ioport_unmap(void *addr);
```

Các hàm này làm cho các cổng I/O trông giống như bộ nhớ. Tuy nhiên, xin lưu ý rằng các cổng I/O vẫn phải được cấp phát bằng *request\_region* trước khi chúng có thể được ánh xạ lại theo cách này.

### Tái sử dụng *short* cho Bộ nhớ I/O

Module mẫu *short*, được giới thiệu trước đó để truy cập các cổng I/O, cũng có thể được sử dụng để truy cập bộ nhớ I/O. Để đạt được mục đích này, bạn phải cấu hình nó sử dụng bộ nhớ I/O tại thời điểm nạp module (load time); ngoài ra, bạn cần thay đổi địa chỉ cơ sở (base address) để nó trỏ tới vùng bộ nhớ I/O của bạn.

Ví dụ, đây là cách chúng ta đã sử dụng *short* để bật các đèn LED gỡ lỗi (debug LEDs) trên một bo mạch phát triển MIPS:

```
mips.root# ./short_load use_mem=1 base=0xb7ffffc0
mips.root# echo -n 7 > /dev/short0
```

Việc sử dụng *short* cho bộ nhớ I/O cũng tương tự như đối với các cổng I/O.

Đoạn mã sau đây minh họa vòng lặp được sử dụng bởi *short* khi ghi vào một vị trí bộ nhớ:

```
while (count--) {
 iowrite8(*ptr++, address);
 wmb( );
}
```

Hãy chú ý đến việc sử dụng rào cản bộ nhớ ghi (write memory barrier) ở đây. Vì *iowrite8* có thể chuyển thành một lệnh gán trực tiếp trên nhiều kiến trúc (architectures), rào cản bộ nhớ là cần thiết để đảm bảo rằng các thao tác ghi diễn ra theo đúng thứ tự mong đợi.

*short* sử dụng *inb* và *outb* để minh họa cách thực hiện điều đó. Tuy nhiên, việc thay đổi *short* để ánh xạ lại các cổng I/O bằng *ioport\_map* và đơn giản hóa phần còn lại của mã nguồn sẽ là một bài tập đơn giản cho bạn đọc.

### Bộ nhớ ISA dưới 1 MB

Một trong những vùng bộ nhớ I/O nổi tiếng nhất là dải ISA được tìm thấy trên máy tính cá nhân. Đây là dải bộ nhớ nằm giữa 640 KB (0xA0000) và 1 MB (0x100000). Do đó, nó xuất hiện ngay ở giữa không gian RAM hệ thống thông thường. Vị trí này có vẻ hơi kỳ lạ; nó là hệ quả của một quyết định được đưa ra vào đầu những năm 1980, khi 640 KB bộ nhớ dường như là nhiều hơn bất cứ thứ gì mà ai đó có thể sử dụng hết.

Dải bộ nhớ này thuộc nhóm bộ nhớ không được ánh xạ trực tiếp (non-directly-mapped class of memory).\* Bạn có thể đọc/ghi một vài byte trong dải bộ nhớ đó bằng cách sử dụng module *short* như đã giải thích trước đó, nghĩa là bằng cách thiết lập use\_mem tại thời điểm nạp module.

Mặc dù bộ nhớ I/O ISA chỉ tồn tại trên các máy tính lớp x86, chúng tôi cho rằng việc dành vài lời và một driver mẫu cho nó là hoàn toàn xứng đáng.

Chúng ta sẽ không thảo luận về bộ nhớ PCI trong chương này, vì đây là loại bộ nhớ I/O sạch sẽ nhất: một khi bạn biết địa chỉ vật lý (physical address), bạn có thể đơn giản là ánh xạ lại và truy cập nó. "Vấn đề" với bộ nhớ I/O PCI là nó không phù hợp để tạo ra một ví dụ hoạt động được cho chương này, bởi vì chúng ta không thể biết trước các địa chỉ vật lý mà bộ nhớ PCI của bạn được ánh xạ tới, hoặc liệu việc truy cập vào các dải địa chỉ đó có an toàn hay không. Chúng tôi chọn mô tả dải bộ nhớ ISA, vì nó vừa ít sạch sẽ hơn vừa phù hợp hơn để chạy mã nguồn mẫu.

Để minh họa việc truy cập bộ nhớ ISA, chúng ta sử dụng một module nhỏ ngớ ngẩn khác (nằm trong mã nguồn mẫu). Trên thực tế, module này được gọi là *silly*, viết tắt của cụm từ Công cụ đơn giản để Gỡ và In Dữ liệu ISA (Simple Tool for Unloading and Printing ISA Data), hoặc đại loại như vậy.

Module này bổ sung cho chức năng của *short* bằng cách cho phép truy cập vào toàn bộ không gian bộ nhớ 384-KB và hiển thị tất cả các hàm I/O khác nhau. Nó có bốn node thiết bị (device nodes) thực hiện cùng một tác vụ bằng cách sử dụng các hàm truyền dữ liệu khác nhau. Các thiết bị *silly* đóng vai trò như một cửa sổ nhìn vào bộ nhớ I/O, theo cách tương tự như */dev/mem*. Bạn có thể đọc và ghi dữ liệu, đồng thời sử dụng *lseek* đến một địa chỉ bộ nhớ I/O tùy ý.

Vì *silly* cung cấp quyền truy cập vào bộ nhớ ISA, nó phải bắt đầu bằng cách ánh xạ các địa chỉ vật lý ISA thành các địa chỉ ảo của nhân (kernel virtual addresses). Trong những ngày đầu của nhân Linux, người ta có thể đơn giản gán một con trỏ tới địa chỉ ISA quan tâm, sau đó tham chiếu trực tiếp (dereference) nó. Tuy nhiên, trong thế giới hiện đại, chúng ta phải làm việc với hệ thống bộ nhớ ảo (virtual memory system) và ánh xạ lại dải bộ nhớ trước. Việc ánh xạ này được thực hiện bằng *ioremap*, như đã giải thích trước đó đối với *short*:

```
## define ISA_BASE 0xA0000
## define ISA_MAX 0x100000 /* dành cho việc truy cập bộ nhớ nói chung */
 /* dòng này xuất hiện trong hàm silly_init */
 io_base = ioremap(ISA_BASE, ISA_MAX - ISA_BASE);
```

*ioremap* trả về một giá trị con trỏ có thể được sử dụng với *ioread8* và các hàm khác được giải thích trong phần "Truy cập Bộ nhớ I/O" (Accessing I/O Memory).

Hãy cùng nhìn lại module mẫu của chúng ta để xem các hàm này có thể được sử dụng như thế nào. */dev/sillyb*, với minor number là 0, truy cập I/O memory bằng *ioread8* và *iowrite8*. Đoạn mã sau đây minh họa việc cài đặt hàm *read*, hàm này ánh xạ địa chỉ

Thực tế, điều này không hoàn toàn đúng. Dải bộ nhớ này rất nhỏ và được sử dụng thường xuyên đến mức kernel xây dựng các bảng trang (page tables) ngay tại thời điểm khởi động để truy cập các địa chỉ đó. Tuy nhiên, địa chỉ ảo (virtual address) được sử dụng để truy cập chúng không giống với địa chỉ vật lý (physical address), và do đó *ioremap* vẫn là cần thiết.

dải từ 0xA0000-0xFFFFF khả dụng dưới dạng một tệp ảo trong dải từ 0-0x5FFFF. Hàm *read* được cấu trúc dưới dạng một câu lệnh switch dựa trên các chế độ truy cập khác nhau; dưới đây là trường hợp của *sillyb*:

```
case M_8:
 while (count) {
 *ptr = ioread8(add);
 add++;
 count--;
 ptr++;
 }
 break;
```

Hai thiết bị tiếp theo là */dev/sillyw* (minor number 1) và */dev/sillyl* (minor number 2). Chúng hoạt động giống như */dev/sillyb*, ngoại trừ việc chúng sử dụng các hàm 16-bit và 32-bit. Dưới đây là phần cài đặt hàm *write* của *sillyl*, tiếp tục là một phần của câu lệnh switch:

```
case M_32:
 while (count >= 4) {
 iowrite8(*(u32 *)ptr, add);
 add += 4;
 count -= 4;
 ptr += 4;
 }
 break;
```

Thiết bị cuối cùng là */dev/sillycp* (minor number 3), sử dụng các hàm *memcpy\_\*io* để thực hiện cùng một tác vụ. Dưới đây là cốt lõi của phần cài đặt hàm *read*:

```
case M_memcpy:
 memcpy_fromio(ptr, add, count);
 break;
```

Vì *ioremap* đã được sử dụng để cung cấp quyền truy cập vào vùng nhớ ISA, *silly* phải gọi *iounmap* khi module bị gỡ bỏ (unloaded):

```
iounmap(io_base);
```

## isa\_readb và các hàm tương tự

Một cái nhìn vào mã nguồn kernel (kernel source) sẽ cho thấy một tập hợp các hàm khác có tên như *isa\_readb*. Trên thực tế, mỗi hàm vừa được mô tả đều có một hàm tương đương bắt đầu bằng *isa\_*. Các hàm này cung cấp quyền truy cập vào bộ nhớ ISA mà không cần thông qua bước *ioremap* riêng biệt. Tuy nhiên, theo các nhà phát triển kernel, các hàm này chỉ nhằm mục đích hỗ trợ tạm thời cho việc chuyển đổi driver (driver-porting) và chúng có thể bị loại bỏ trong tương lai. Do đó, bạn nên tránh sử dụng chúng.

## Tài liệu tham khảo nhanh (Quick Reference)

Chương này đã giới thiệu các ký hiệu sau liên quan đến việc quản lý phần cứng:

```
## include <linux/kernel.h>
void barrier(void)
```

Hàng rào bộ nhớ "phần mềm" (software memory barrier) này yêu cầu trình biên dịch coi tất cả các vùng nhớ là dễ thay đổi (volatile) qua chỉ thị này.

```
## include <asm/system.h>
void rmb(void);
void read_barrier_depends(void);
void wmb(void);
void mb(void);
```

Các hàng rào bộ nhớ phần cứng (hardware memory barriers). Chúng yêu cầu CPU (và trình biên dịch) kiểm tra và đồng bộ hóa tất cả các thao tác đọc bộ nhớ, ghi bộ nhớ, hoặc cả hai qua chỉ thị này.

```
## include <asm/io.h>
unsigned inb(unsigned port);
void outb(unsigned char byte, unsigned port);
unsigned inw(unsigned port);
void outw(unsigned short word, unsigned port);
unsigned inl(unsigned port);
void outl(unsigned doubleword, unsigned port);
```

Các hàm được sử dụng để đọc và ghi các cổng I/O (I/O ports). Chúng cũng có thể được gọi bởi các chương trình ở User Space, miễn là chúng có các quyền (privileges) phù hợp để truy cập cổng.

```
unsigned inb_p(unsigned port);
```

...

Nếu cần một khoảng trễ nhỏ (small delay) sau một thao tác I/O, bạn có thể sử dụng sáu biến thể có độ trễ (pausing counterparts) của các hàm đã được giới thiệu trong phần trước; các hàm có độ trễ này có tên kết thúc bằng hậu tố *\_p*.

```
void insb(unsigned port, void *addr, unsigned long count);
void outsb(unsigned port, void *addr, unsigned long count);
void insw(unsigned port, void *addr, unsigned long count);
void outsw(unsigned port, void *addr, unsigned long count);
void insl(unsigned port, void *addr, unsigned long count);
void outsl(unsigned port, void *addr, unsigned long count);
```

Các "hàm chuỗi" (string functions) được tối ưu hóa để truyền dữ liệu từ một cổng đầu vào đến một vùng nhớ, hoặc ngược lại. Các việc truyền dữ liệu này được thực hiện bằng cách đọc hoặc ghi cùng một cổng với số lần lặp lại là `count`.

```
## include <linux/ioport.h>
struct resource *request_region(unsigned long start, unsigned long len, char
 *name);
void release_region(unsigned long start, unsigned long len);
int check_region(unsigned long start, unsigned long len);
    Các hàm cấp phát tài nguyên (resource allocators) cho các cổng I/O. Hàm kiểm tra (đã lỗi thời - deprecated) trả về 0 nếu thành công và nhỏ hơn 0 trong trường hợp xảy ra lỗi.
struct resource *request_mem_region(unsigned long start, unsigned long len,
 char *name);
void release_mem_region(unsigned long start, unsigned long len);
int check_mem_region(unsigned long start, unsigned long len);
    Các hàm xử lý việc cấp phát tài nguyên cho các vùng nhớ (memory regions).
## include <asm/io.h>
void *ioremap(unsigned long phys_addr, unsigned long size);
void *ioremap_nocache(unsigned long phys_addr, unsigned long size);
void iounmap(void *virt_addr);
    ioremap ánh xạ lại một dải địa chỉ vật lý vào không gian địa chỉ ảo (virtual address space) của bộ xử lý, làm cho nó khả dụng đối với kernel. iounmap giải phóng ánh xạ khi không còn cần thiết nữa.
## include <asm/io.h>
unsigned int ioread8(void *addr);
unsigned int ioread16(void *addr);
unsigned int ioread32(void *addr);
void iowrite8(u8 value, void *addr);
void iowrite16(u16 value, void *addr);
void iowrite32(u32 value, void *addr);
    Các hàm truy cập (accessor functions) được sử dụng để làm việc với I/O memory.
void ioread8_rep(void *addr, void *buf, unsigned long count);
void ioread16_rep(void *addr, void *buf, unsigned long count);
void ioread32_rep(void *addr, void *buf, unsigned long count);
void iowrite8_rep(void *addr, const void *buf, unsigned long count);
void iowrite16_rep(void *addr, const void *buf, unsigned long count);
void iowrite32_rep(void *addr, const void *buf, unsigned long count);
    Các phiên bản "lặp lại" (repeating versions) của các hàm nguyên thủy I/O memory.
```

```c
unsigned readb(address);
unsigned readw(address);
unsigned readl(address);
void writeb(unsigned value, address);
void writew(unsigned value, address);
void writel(unsigned value, address);
memset_io(address, value, count);
memcpy_fromio(dest, source, nbytes);
memcpy_toio(dest, source, nbytes);
    Các hàm cũ, không an toàn về kiểu dữ liệu (type-unsafe) dùng để truy cập bộ nhớ I/O (I/O memory).
void *ioport_map(unsigned long port, unsigned int count);
void ioport_unmap(void *addr);
    Một nhà phát triển driver muốn xử lý các cổng I/O (I/O ports) giống như bộ nhớ I/O có thể chuyển các cổng đó cho hàm ioport_map. Việc hủy ánh xạ (mapping) nên được thực hiện (bằng ioport_unmap) khi không còn cần thiết nữa.
```
