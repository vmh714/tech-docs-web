# Chương 11: Các Kiểu Dữ liệu trong Kernel

Trước khi tiếp tục với các chủ đề nâng cao hơn, chúng ta cần dừng lại một chút để lưu ý nhanh về các vấn đề tính tương thích (portability). Các phiên bản hiện đại của Linux kernel có tính tương thích cực kỳ cao, chạy trên vô số kiến trúc phần cứng khác nhau. Với bản chất đa nền tảng của Linux, các trình điều khiển (driver) được định hướng sử dụng nghiêm túc cũng phải có tính tương thích như vậy.

Nhưng một vấn đề cốt lõi đối với mã nguồn kernel (kernel code) là vừa có thể truy cập các mục dữ liệu có độ dài xác định (ví dụ: các cấu trúc dữ liệu hệ thống tập tin hoặc các thanh ghi trên bo mạch thiết bị), vừa khai thác được các khả năng của các bộ vi xử lý khác nhau (kiến trúc 32-bit và 64-bit, và có thể cả 16-bit).

Một số vấn đề mà các nhà phát triển kernel gặp phải khi chuyển đổi mã nguồn x86 sang các kiến trúc mới đều liên quan đến việc định kiểu dữ liệu không chính xác. Việc tuân thủ chặt chẽ việc định kiểu dữ liệu và biên dịch với các cờ `-Wall -Wstrict-prototypes` có thể ngăn chặn phần lớn các lỗi (bug).

Các kiểu dữ liệu được sử dụng bởi dữ liệu kernel được chia thành ba lớp chính: các kiểu C chuẩn như `int`, các kiểu có kích thước tường minh như `u32`, và các kiểu được sử dụng cho các đối tượng kernel cụ thể, như `pid_t`. Chúng ta sẽ tìm hiểu khi nào và làm thế nào mỗi lớp trong ba lớp định kiểu này nên được sử dụng. Các phần cuối của chương này bàn về một số vấn đề điển hình khác mà bạn có thể gặp phải khi chuyển đổi mã nguồn driver từ x86 sang các nền tảng khác, đồng thời giới thiệu hỗ trợ tổng quát cho danh sách liên kết (linked list) được xuất ra bởi các tệp tiêu đề (header file) kernel gần đây.

Nếu bạn tuân theo các nguyên tắc hướng dẫn mà chúng tôi cung cấp, driver của bạn sẽ biên dịch và chạy được ngay cả trên các nền tảng mà bạn không thể kiểm thử (test) trực tiếp.

## Sử dụng các Kiểu C Chuẩn (Standard C Types)

Mặc dù hầu hết lập trình viên đã quen với việc tự do sử dụng các kiểu chuẩn như `int` và `long`, việc viết các device driver đòi hỏi sự cẩn trọng nhất định để tránh xung đột kiểu và các lỗi khó hiểu.

Vấn đề là bạn không thể sử dụng các kiểu chuẩn khi bạn cần "một vùng đệm 2 byte" (2-byte filler) hoặc "thứ gì đó biểu diễn một chuỗi 4 byte", bởi vì các kiểu dữ liệu C thông thường không có cùng kích thước trên mọi kiến trúc. Để minh họa kích thước dữ liệu của các kiểu C khác nhau, chương trình *datasize* đã được đưa vào trong các tệp mẫu cung cấp trên trang FTP của O'Reilly trong thư mục *misc-progs*. Đây là một lần chạy mẫu của chương trình trên hệ thống i386 (bốn kiểu cuối cùng được hiển thị sẽ được giới thiệu ở phần tiếp theo):

```
morgana% misc-progs/datasize
arch Size: char short int long ptr long-long u8 u16 u32 u64
i686 1 2 4 4 4 8 1 2 4 8
```

Chương trình này có thể được sử dụng để cho thấy các số nguyên kiểu `long` và con trỏ (pointer) có kích thước khác nhau trên các nền tảng 64-bit, được minh chứng bằng cách chạy chương trình trên các máy tính Linux khác nhau:

| arch    |   | Size: char short int long |   |   |   | ptr long-long u8 u16 u32 u64 |   |   |   |   |
|---------|---|---------------------------|---|---|---|------------------------------|---|---|---|---|
| i386    | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| alpha   | 1 | 2                         | 4 | 8 | 8 | 8                            | 1 | 2 | 4 | 8 |
| armv4l  | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| ia64    | 1 | 2                         | 4 | 8 | 8 | 8                            | 1 | 2 | 4 | 8 |
| m68k    | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| mips    | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| ppc     | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| sparc   | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| sparc64 | 1 | 2                         | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| x86_64  | 1 | 2                         | 4 | 8 | 8 | 8                            | 1 | 2 | 4 | 8 |

Thật thú vị khi lưu ý rằng kiến trúc SPARC 64 chạy với một không gian người dùng (user space) 32-bit, do đó các con trỏ có độ rộng 32-bit ở đó, mặc dù chúng rộng 64-bit trong không gian kernel (kernel space). Điều này có thể được xác minh bằng cách nạp module *kdatasize* (có sẵn trong thư mục *miscmodules* nằm trong các tệp mẫu). Module này báo cáo thông tin kích thước tại thời điểm nạp (load time) bằng cách sử dụng `printk` và trả về một lỗi (vì vậy không cần phải gỡ module - unload):

```
kernel: arch Size: char short int long ptr long-long u8 u16 u32 u64
kernel: sparc64 1 2 4 8 8 8 1 2 4 8
```

Mặc dù bạn phải cẩn thận khi kết hợp các kiểu dữ liệu khác nhau, đôi khi có những lý do chính đáng để làm như vậy. Một tình huống như vậy là đối với các địa chỉ bộ nhớ (memory address), vốn là những đối tượng đặc biệt đối với kernel. Mặc dù về mặt khái niệm, các địa chỉ là con trỏ, việc quản lý bộ nhớ thường đạt hiệu quả tốt hơn khi sử dụng kiểu số nguyên không dấu (unsigned integer type); kernel coi bộ nhớ vật lý giống như một mảng khổng lồ, và một địa chỉ bộ nhớ chỉ đơn giản là một chỉ số (index) trong mảng đó. Hơn nữa, một con trỏ rất dễ bị giải tham chiếu (dereference); khi làm việc trực tiếp với các địa chỉ bộ nhớ, hầu như không bao giờ bạn muốn giải tham chiếu chúng theo cách này. Việc sử dụng kiểu số nguyên sẽ ngăn chặn việc giải tham chiếu này, từ đó tránh được các lỗi. Do đó, các địa chỉ bộ nhớ tổng quát trong kernel thường là `unsigned long`, tận dụng thực tế là con trỏ và số nguyên `long` luôn có cùng kích thước, ít nhất là trên tất cả các nền tảng hiện đang được Linux hỗ trợ.

Dù sao đi nữa, chuẩn C99 cũng định nghĩa các kiểu `intptr_t` và `uintptr_t` cho các biến số nguyên có khả năng chứa giá trị con trỏ (pointer value). Tuy nhiên, các kiểu này hầu như không được sử dụng trong kernel 2.6.

## Gán Kích Thước Cụ Thể Cho Các Mục Dữ Liệu

Đôi khi mã nguồn kernel (kernel code) yêu cầu các mục dữ liệu có kích thước cụ thể, có thể để khớp với các cấu trúc nhị phân được định nghĩa trước,\* để giao tiếp với không gian người dùng (User Space), hoặc để canh lề (align) dữ liệu bên trong các cấu trúc bằng cách chèn các trường "đệm" (padding field) (nhưng hãy tham khảo phần "Canh lề Dữ liệu" để biết thông tin về các vấn đề canh lề).

Kernel cung cấp các kiểu dữ liệu sau đây để sử dụng bất cứ khi nào bạn cần biết kích thước dữ liệu của mình. Tất cả các kiểu này được khai báo trong *<asm/types.h>*, file này lại được bao gồm (included) bởi *<linux/types.h>*:

```c
u8; /* unsigned byte (8 bits) */
u16; /* unsigned word (16 bits) */
u32; /* unsigned 32-bit value */
u64; /* unsigned 64-bit value */
```

Các kiểu có dấu (signed type) tương ứng cũng tồn tại, nhưng hiếm khi cần thiết; chỉ cần thay u bằng s trong tên nếu bạn cần dùng chúng.

Nếu một chương trình ở không gian người dùng (user-space program) cần sử dụng các kiểu này, nó có thể thêm hai dấu gạch dưới ở đầu tên: `__u8` và các kiểu khác được định nghĩa độc lập với `__KERNEL__`. Ví dụ, nếu một trình điều khiển (driver) cần trao đổi các cấu trúc nhị phân với một chương trình chạy trong User Space thông qua *ioctl*, các file header nên khai báo các trường 32-bit trong cấu trúc là `__u32`.

Điều quan trọng cần nhớ là các kiểu này mang tính đặc thù của Linux (Linux-specific), và việc sử dụng chúng gây cản trở việc port phần mềm sang các biến thể Unix khác. Các hệ thống sử dụng trình biên dịch (compiler) mới hỗ trợ các kiểu chuẩn C99, chẳng hạn như `uint8_t` và `uint32_t`; nếu khả năng tương thích (portability) là một mối quan tâm, các kiểu đó có thể được sử dụng thay cho loại đặc thù của Linux.

Bạn cũng có thể lưu ý rằng đôi khi kernel sử dụng các kiểu thông thường, chẳng hạn như `unsigned int`, cho các mục có kích thước độc lập với kiến trúc (architecture independent). Điều này thường được thực hiện để tương thích ngược (backward compatibility). Khi `u32` và các họ hàng của nó được giới thiệu trong Phiên bản 1.1.67, các nhà phát triển không thể thay đổi các cấu trúc dữ liệu hiện có sang các kiểu mới vì trình biên dịch sẽ đưa ra cảnh báo (warning) khi có sự không khớp về kiểu giữa trường cấu trúc và giá trị được gán cho nó.† Linus không mong đợi hệ điều hành (OS) mà anh ấy viết cho mục đích sử dụng riêng của mình lại trở thành đa nền tảng (multiplatform); kết quả là các cấu trúc cũ đôi khi được định nghĩa kiểu một cách lỏng lẻo.

Điều này xảy ra khi đọc bảng phân vùng (partition table), khi thực thi một file nhị phân, hoặc khi giải mã một gói tin mạng (network packet).

Trên thực tế, trình biên dịch báo hiệu sự không nhất quán về kiểu ngay cả khi hai kiểu chỉ là các tên khác nhau cho cùng một đối tượng, chẳng hạn như `unsigned long` và `u32` trên PC.

## Các Kiểu Đặc Thù Cho Giao Diện (Interface-Specific Types)

Một số kiểu dữ liệu được sử dụng phổ biến trong kernel có các câu lệnh `typedef` của riêng chúng, từ đó ngăn chặn bất kỳ vấn đề về khả năng tương thích (portability) nào. Ví dụ, định danh tiến trình (process identifier - pid) thường là `pid_t` thay vì `int`. Việc sử dụng `pid_t` che giấu mọi sự khác biệt có thể có trong việc gõ kiểu dữ liệu thực tế (actual data typing). Chúng tôi sử dụng thuật ngữ *đặc thù cho giao diện* (*interface-specific*) để chỉ một kiểu được định nghĩa bởi một thư viện nhằm cung cấp giao diện cho một cấu trúc dữ liệu cụ thể.

Lưu ý rằng trong thời gian gần đây, tương đối ít kiểu đặc thù cho giao diện mới được định nghĩa. Việc sử dụng câu lệnh `typedef` đã trở nên kém phổ biến đối với nhiều nhà phát triển kernel, những người thích nhìn thấy thông tin kiểu thực tế được sử dụng trực tiếp trong mã nguồn hơn là bị ẩn đằng belakang một kiểu do người dùng định nghĩa. Tuy nhiên, nhiều kiểu đặc thù cho giao diện cũ vẫn còn trong kernel và chúng sẽ không sớm biến mất.

Ngay cả khi không có kiểu đặc thù cho giao diện nào được định nghĩa, việc sử dụng đúng kiểu dữ liệu một cách nhất quán với phần còn lại của kernel luôn là điều quan trọng. Ví dụ, một số đếm jiffies (jiffy count) luôn là `unsigned long`, độc lập với kích thước thực tế của nó, vì vậy kiểu `unsigned long` nên luôn được sử dụng khi làm việc với jiffies. Trong phần này, chúng ta tập trung vào việc sử dụng các kiểu kết thúc bằng `_t`.

Nhiều kiểu `_t` được định nghĩa trong *<linux/types.h>*, nhưng danh sách này hiếm khi hữu ích. Khi bạn cần một kiểu cụ thể, bạn sẽ tìm thấy nó trong nguyên mẫu (prototype) của các hàm bạn cần gọi hoặc trong các cấu trúc dữ liệu bạn sử dụng.

Bất cứ khi nào driver của bạn sử dụng các hàm yêu cầu các kiểu "tùy chỉnh" như vậy mà bạn không tuân theo quy ước, trình biên dịch sẽ đưa ra cảnh báo; nếu bạn sử dụng cờ trình biên dịch (compiler flag) `-Wall` và cẩn thận loại bỏ tất cả các cảnh báo, bạn có thể tự tin rằng mã nguồn của mình có khả năng tương thích cao.

Vấn đề chính với các mục dữ liệu kiểu `_t` là khi bạn cần in chúng, việc chọn định dạng *printk* hoặc *printf* chính xác không phải lúc nào cũng dễ dàng và các cảnh báo bạn đã giải quyết trên một kiến trúc này sẽ lại xuất hiện trên kiến trúc khác. Ví dụ, làm thế nào để bạn in một `size_t`, vốn là `unsigned long` trên một số nền tảng và `unsigned int` trên các nền tảng khác?

Bất cứ khi nào bạn cần in một số dữ liệu đặc thù cho giao diện, cách tốt nhất để làm điều đó là ép kiểu (cast) giá trị thành kiểu lớn nhất có thể (thường là `long` hoặc `unsigned long`) rồi in nó thông qua định dạng tương ứng. Kiểu tinh chỉnh này sẽ không tạo ra lỗi hoặc cảnh báo vì định dạng khớp với kiểu dữ liệu, và bạn sẽ không bị mất các bit dữ liệu vì thao tác ép kiểu hoặc là một phép toán rỗng (null operation) hoặc là việc mở rộng mục dữ liệu thành một kiểu dữ liệu lớn hơn.

Trong thực tế, các mục dữ liệu mà chúng ta đang bàn tới thường không dùng để in ra, do đó vấn đề này chỉ áp dụng cho các thông điệp gỡ lỗi (debugging messages). Thông thường, mã nguồn chỉ cần lưu trữ và so sánh các kiểu dữ liệu đặc thù của giao diện (interface-specific types), ngoài ra còn dùng để truyền chúng làm đối số cho các hàm của thư viện hoặc hàm kernel (Kernel Function).

Mặc dù các kiểu `_t` là giải pháp chính xác cho phần lớn các tình huống, đôi khi kiểu dữ liệu phù hợp lại không tồn tại. Điều này xảy ra đối với một số giao diện cũ chưa được dọn dẹp (cleaned up).

Điểm mơ hồ duy nhất mà chúng ta tìm thấy trong các header file của kernel là định nghĩa kiểu dữ liệu cho các hàm I/O, vốn được định nghĩa khá lỏng lẻo (xem mục "Phụ thuộc nền tảng" - Platform Dependencies trong Chương 9). Việc định nghĩa kiểu lỏng lẻo này chủ yếu là vì lý do lịch sử, nhưng nó có thể tạo ra các vấn đề khi viết mã nguồn. Ví dụ, người ta có thể gặp rắc rối khi hoán đổi các đối số của các hàm như `outb`; nếu có một kiểu `port_t`, trình biên dịch (compiler) sẽ phát hiện ra loại lỗi này.

## Các vấn đề khả chuyển khác (Other Portability Issues)

Ngoài việc định nghĩa kiểu dữ liệu, có một vài vấn đề phần mềm khác cần ghi nhớ khi viết một driver nếu bạn muốn nó có tính khả chuyển (portable) trên các nền tảng Linux khác nhau.

Một quy tắc chung là hãy cảnh giác với các giá trị hằng số tường minh (explicit constant values). Thông thường, mã nguồn đã được tham số hóa (parameterized) bằng cách sử dụng các macro bộ tiền xử lý (preprocessor macro). Phần này liệt kê các vấn đề khả chuyển quan trọng nhất. Bất cứ khi nào bạn gặp các giá trị khác đã được tham số hóa, bạn có thể tìm thấy các gợi ý trong các header file và trong các device driver được phân phối cùng với kernel chính thức.

### Khoảng thời gian (Time Intervals)

Khi xử lý các khoảng thời gian, đừng giả định rằng có 1000 `jiffies` mỗi giây. Mặc dù điều này hiện tại đúng với kiến trúc `i386`, không phải mọi nền tảng Linux đều chạy ở tốc độ này. Giả định này có thể sai ngay cả đối với `x86` nếu bạn can thiệp vào giá trị `HZ` (như một số người vẫn làm), và không ai biết điều gì sẽ xảy ra trong các phiên bản kernel tương lai. Bất cứ khi nào bạn tính toán các khoảng thời gian bằng cách sử dụng `jiffies`, hãy quy đổi thời gian của bạn bằng cách sử dụng `HZ` (số lần ngắt bộ định thời - timer interrupt mỗi giây). Ví dụ, để kiểm tra thời gian chờ (timeout) là nửa giây, hãy so sánh thời gian trôi qua với `HZ/2`. Tổng quát hơn, số lượng `jiffies` tương ứng với `msec` mili-giây luôn là `msec*HZ/1000`.

### Kích thước trang (Page Size)

Khi thao tác với bộ nhớ (playing games with memory), hãy nhớ rằng một trang bộ nhớ (memory page) có kích thước là `PAGE_SIZE` byte, chứ không phải 4 KB. Giả định rằng kích thước trang là 4 KB và cố định giá trị này (hardcoding) là một lỗi phổ biến đối với các lập trình viên viết ứng dụng cho PC. Thay vào đó, các nền tảng được hỗ trợ có kích thước trang từ 4 KB đến 64 KB, và đôi khi chúng khác nhau giữa các cài đặt (implementation) khác nhau của cùng một nền tảng. Các macro có liên quan là `PAGE_SIZE` và `PAGE_SHIFT`. Macro sau chứa số lượng bit cần dịch chuyển (shift) một địa chỉ để lấy số trang của nó. Số lượng này hiện tại là 12 hoặc lớn hơn đối với các trang có kích thước từ 4 KB trở lên. Các macro này được định nghĩa trong *<asm/page.h>*; các chương trình ở không gian người dùng (user-space programs) có thể sử dụng hàm thư viện *getpagesize* nếu chúng cần thông tin đó.

Hãy xem xét một tình huống phức tạp hơn. Nếu một driver cần 16 KB cho dữ liệu tạm thời, nó không nên chỉ định một `order` là 2 cho hàm *get_free_pages*. Bạn cần một giải pháp khả chuyển (portable solution). May mắn thay, một giải pháp như vậy đã được các nhà phát triển kernel viết sẵn và được gọi là *get_order*:

```c
## include <asm/page.h>
int order = get_order(16*1024);
buf = get_free_pages(GFP_KERNEL, order);
```

Hãy nhớ rằng đối số truyền vào *get_order* phải là một lũy thừa của hai.

### Byte Order (Thứ tự Byte)

Hãy cẩn thận đừng đưa ra các giả định về thứ tự byte (byte ordering). Trong khi PC lưu trữ các giá trị đa byte với byte thấp đứng trước (little-endian), một số nền tảng cao cấp lại hoạt động theo cách ngược lại (big-endian). Bất cứ khi nào có thể, mã nguồn của bạn nên được viết sao cho không phụ thuộc vào thứ tự byte trong dữ liệu mà nó thao tác. Tuy nhiên, đôi khi một driver cần xây dựng một số nguyên từ các byte đơn lẻ hoặc làm ngược lại, hoặc nó phải giao tiếp với một thiết bị yêu cầu một thứ tự cụ thể.

Tệp tiêu đề *<asm/byteorder.h>* định nghĩa \_\_BIG\_ENDIAN hoặc \_\_LITTLE\_ENDIAN, tùy thuộc vào thứ tự byte của bộ vi xử lý. Khi xử lý các vấn đề về thứ tự byte, bạn có thể viết một loạt các điều kiện `#ifdef \_\_LITTLE\_ENDIAN`, nhưng có một cách tốt hơn. Linux kernel định nghĩa một tập hợp các macro xử lý việc chuyển đổi giữa thứ tự byte của bộ vi xử lý và thứ tự byte của dữ liệu mà bạn cần lưu trữ hoặc tải. Ví dụ:

```c
u32 cpu_to_le32 (u32);
u32 le32_to_cpu (u32);
```

Hai macro này chuyển đổi một giá trị từ bất kỳ định dạng nào mà CPU đang sử dụng sang một đại lượng 32-bit, little-endian, không dấu và ngược lại. Chúng hoạt động bất kể CPU của bạn là big-endian hay little-endian, và cũng không phụ thuộc vào việc đó có phải là bộ vi xử lý 32-bit hay không. Chúng trả về đối số không thay đổi trong trường hợp không cần thực hiện chuyển đổi. Việc sử dụng các macro này giúp dễ dàng viết mã nguồn di động (portable code) mà không cần phải sử dụng nhiều cấu trúc biên dịch có điều kiện.

Có hàng chục routine tương tự; bạn có thể xem danh sách đầy đủ trong *<linux/byteorder/big\_endian.h>* và *<linux/byteorder/little\_endian.h>*. Sau một thời gian, các quy luật này không khó để nắm bắt. *be64\_to\_cpu* chuyển đổi một giá trị 64-bit, big-endian, không dấu sang biểu diễn nội bộ của CPU. Ngược lại, *le16\_to\_cpus* xử lý các đại lượng 16-bit, little-endian, có dấu. Khi làm việc với con trỏ, bạn cũng có thể sử dụng các hàm như *cpu\_to\_le32p*, nhận một con trỏ đến giá trị cần chuyển đổi thay vì chính giá trị đó. Hãy xem tệp tiêu đề để biết thêm chi tiết.

### Data Alignment (Căn chỉnh Dữ liệu)

Vấn đề cuối cùng cần xem xét khi viết mã nguồn di động là cách truy cập dữ liệu không được căn chỉnh (unaligned data)—ví dụ: cách đọc một giá trị 4-byte được lưu trữ tại một địa chỉ không phải là bội số của 4 byte. Người dùng i386 thường truy cập các mục dữ liệu không căn chỉnh, nhưng không phải tất cả các kiến trúc đều cho phép điều này. Nhiều kiến trúc hiện đại tạo ra một ngoại lệ (exception) mỗi khi chương trình cố gắng truyền dữ liệu không căn chỉnh; việc truyền dữ liệu sau đó được xử lý bởi trình xử lý ngoại lệ (exception handler), gây ra sự sụt giảm hiệu năng đáng kể. Nếu bạn cần truy cập dữ liệu không căn chỉnh, bạn nên sử dụng các macro sau:

```c
## include <asm/unaligned.h>
get_unaligned(ptr);
put_unaligned(val, ptr);
```

Các macro này không định kiểu (typeless) và hoạt động với mọi mục dữ liệu, bất kể chúng dài một, hai, bốn hay tám byte. Chúng được định nghĩa trong mọi phiên bản kernel.

Một vấn đề khác liên quan đến căn chỉnh là tính di động của các cấu trúc dữ liệu (data structures) giữa các nền tảng. Cùng một cấu trúc dữ liệu (như được định nghĩa trong tệp nguồn ngôn ngữ C) có thể được biên dịch khác nhau trên các nền tảng khác nhau. Trình biên dịch sắp xếp các trường trong cấu trúc để căn chỉnh theo các quy ước khác nhau tùy thuộc vào từng nền tảng.

Để viết các cấu trúc dữ liệu cho các mục dữ liệu có thể di chuyển giữa các kiến trúc, bạn nên luôn thực thi việc căn chỉnh tự nhiên (natural alignment) của các mục dữ liệu bên cạnh việc chuẩn hóa theo một endianness cụ thể. *Căn chỉnh tự nhiên* có nghĩa là lưu trữ các mục dữ liệu tại một địa chỉ là bội số của kích thước của chúng (ví dụ: các mục 8-byte nằm ở địa chỉ là bội số của 8). Để thực thi căn chỉnh tự nhiên trong khi ngăn trình biên dịch sắp xếp các trường theo những cách khó dự đoán, bạn nên sử dụng các trường đệm (filler fields) để tránh để lại các khoảng trống trong cấu trúc dữ liệu.

Để minh họa cách trình biên dịch thực thi việc căn chỉnh, chương trình *dataalign* được phân phối trong thư mục *misc-progs* của mã nguồn mẫu, và một module tương đương là *kdataalign* nằm trong *misc-modules*. Dưới đây là kết quả đầu ra của chương trình trên một số nền tảng và kết quả đầu ra của module trên SPARC64:

| arch Align: char short int long |   |   |   |   |   | ptr long-long u8 u16 u32 u64 |   |   |   |   |
|---------------------------------|---|---|---|---|---|------------------------------|---|---|---|---|
| i386                            | 1 | 2 | 4 | 4 | 4 | 4                            | 1 | 2 | 4 | 4 |
| i686                            | 1 | 2 | 4 | 4 | 4 | 4                            | 1 | 2 | 4 | 4 |
| alpha                           | 1 | 2 | 4 | 8 | 8 | 8                            | 1 | 2 | 4 | 8 |
| armv4l                          | 1 | 2 | 4 | 4 | 4 | 4                            | 1 | 2 | 4 | 4 |
| ia64                            | 1 | 2 | 4 | 8 | 8 | 8                            | 1 | 2 | 4 | 8 |
| mips                            | 1 | 2 | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |

| ppc                             | 1 | 2 | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| sparc                           | 1 | 2 | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| sparc64                         | 1 | 2 | 4 | 4 | 4 | 8                            | 1 | 2 | 4 | 8 |
| x86_64                          | 1 | 2 | 4 | 8 | 8 | 8                            | 1 | 2 | 4 | 8 |

kernel: arch Align: char short int long ptr long-long u8 u16 u32 u64 kernel: sparc64 1 2 4 8 8 8 1 2 4 8

Thật thú vị khi lưu ý rằng không phải tất cả các nền tảng (platform) đều căn chỉnh (align) các giá trị 64-bit trên các biên (boundary) 64-bit, vì vậy bạn cần các trường đệm (filler fields) để ép buộc việc căn chỉnh và đảm bảo tính di port (portability).

Cuối cùng, hãy lưu ý rằng trình biên dịch (compiler) có thể tự động chèn các khoảng đệm (padding) vào bên trong cấu trúc (structure) để đảm bảo rằng mọi trường đều được căn chỉnh nhằm đạt hiệu năng tốt trên bộ vi xử lý mục tiêu (target processor). Nếu bạn đang định nghĩa một cấu trúc nhằm khớp với cấu trúc được mong đợi bởi một thiết bị (device), việc đệm tự động này có thể làm hỏng nỗ lực của bạn. Cách giải quyết vấn đề này là thông báo cho trình biên dịch rằng cấu trúc phải được "đóng gói" (packed), không thêm các phần đệm nào. Ví dụ, tệp header của kernel *<linux/edd.h>* định nghĩa một số cấu trúc dữ liệu được sử dụng trong việc giao tiếp với x86 BIOS, và nó bao gồm định nghĩa sau:

```
struct {
 u16 id;
 u64 lun;
 u16 reserved1;
 u32 reserved2;
} __attribute__ ((packed)) scsi;
```

Nếu không có `__attribute__ ((packed))`, trường `lun` sẽ được đứng trước bởi hai byte đệm hoặc sáu byte nếu chúng ta biên dịch cấu trúc trên một nền tảng 64-bit.

### Con trỏ và Giá trị Lỗi (Pointers and Error Values)

Nhiều hàm nội bộ của nhân hệ điều hành (kernel function) trả về một giá trị con trỏ (pointer value) cho hàm gọi (caller). Nhiều hàm trong số đó cũng có thể thất bại. Trong hầu hết các trường hợp, sự thất bại được biểu thị bằng cách trả về một giá trị con trỏ `NULL`. Kỹ thuật này hoạt động tốt, nhưng nó không thể truyền đạt bản chất chính xác của vấn đề. Một số giao diện (interface) thực sự cần trả về một mã lỗi thực tế (actual error code) để hàm gọi có thể đưa ra quyết định đúng đắn dựa trên những gì thực sự đã xảy ra.

Một số giao diện kernel trả về thông tin này bằng cách mã hóa mã lỗi (error code) vào bên trong giá trị con trỏ. Các hàm như vậy phải được sử dụng cẩn thận, vì giá trị trả về của chúng không thể đơn giản so sánh với `NULL`. Để hỗ trợ trong việc tạo và sử dụng loại giao diện này, một tập hợp nhỏ các hàm đã được cung cấp sẵn (trong *<linux/err.h>*).

Một hàm trả về kiểu con trỏ có thể trả về một giá trị lỗi bằng cách sử dụng:

```
void *ERR_PTR(long error);
```

trong đó `error` là mã lỗi âm thông thường. Hàm gọi có thể sử dụng `IS_ERR` để kiểm tra xem con trỏ được trả về có phải là mã lỗi hay không:

```
long IS_ERR(const void *ptr);
```

Nếu bạn cần mã lỗi thực tế, nó có thể được trích xuất bằng:

```
long PTR_ERR(const void *ptr);
```

Bạn chỉ nên sử dụng `PTR_ERR` trên một giá trị mà `IS_ERR` trả về giá trị đúng (true); bất kỳ giá trị nào khác đều là một con trỏ hợp lệ (valid pointer).

## Danh sách liên kết (Linked Lists)

Các kernel hệ điều hành (operating system kernel), giống như nhiều chương trình khác, thường cần duy trì các danh sách các cấu trúc dữ liệu. Linux kernel đôi khi từng chứa nhiều cài đặt danh sách liên kết khác nhau cùng một lúc. Để giảm lượng mã nguồn trùng lặp, các nhà phát triển kernel (kernel developer) đã tạo ra một bản cài đặt chuẩn cho danh sách liên kết kép vòng tròn (circular, doubly linked lists); những ai cần thao tác với danh sách được khuyến khích sử dụng tiện ích này.

Khi làm việc với giao diện danh sách liên kết, bạn nên luôn ghi nhớ rằng các hàm danh sách không thực hiện cơ chế khóa (locking). Nếu có khả năng driver của bạn có thể cố gắng thực hiện các thao tác đồng thời (concurrent operations) trên cùng một danh sách, bạn có trách nhiệm phải thực thi một sơ đồ khóa (locking scheme). Các lựa chọn thay thế (cấu trúc danh sách bị hỏng, mất dữ liệu, kernel panic) thường rất khó chẩn đoán.

Để sử dụng cơ chế danh sách này, driver của bạn phải bao gồm tệp *<linux/list.h>*. Tệp này định nghĩa một cấu trúc đơn giản có kiểu `list_head`:

```
struct list_head {
 struct list_head *next, *prev;
};
```

Danh sách liên kết được sử dụng trong mã nguồn thực tế hầu như luôn bao gồm một số loại cấu trúc, mỗi cấu trúc mô tả một phần tử (entry) trong danh sách. Để sử dụng tiện ích danh sách của Linux trong mã nguồn của bạn, bạn chỉ cần nhúng (embed) một `list_head` vào bên trong các cấu trúc tạo nên danh sách. Nếu driver của bạn duy trì một danh sách các công việc cần làm (todo), giả sử vậy, khai báo của nó sẽ trông giống như thế này:

```
struct todo_struct {
 struct list_head list;
 int priority; /* đặc thù của driver */
 /* ... thêm các trường đặc thù khác của driver */
};
```

Phần đầu danh sách (head of the list) thường là một cấu trúc `list_head` độc lập. Hình 11-1 minh họa cách `struct list_head` đơn giản được sử dụng để duy trì một danh sách các cấu trúc dữ liệu.

```
Figure: Doubly linked list in <linux/list.h> and the list_entry macro

1. Basic list structure

struct list_head {
    struct list_head *prev;
    struct list_head *next;
};

Representation:

+------+------+
| prev | next |
+------+------+

--------------------------------------------

2. Empty list

       +------+------+
head   | prev | next |
       +------+------+
         ^       |
         |       v
         +-------+

head->next == head
head->prev == head

--------------------------------------------

3. List head with a two‑item list

       +------+------+
head   | prev | next |
       +------+------+
         ^       |
         |       v
         |   +------------------+       +------------------+
         |   |   struct item    |       |   struct item    |
         |   |   (data ...)     |       |   (data ...)     |
         |   +------------------+       +------------------+
         |   |  prev  |  next   |<---->|  prev  |  next   |
         |   +--------+---------+       +--------+---------+
         |                                   |
         +-----------------------------------+

Link chain:
head.next -> &item1.list
item1.list.next -> &item2.list
item2.list.next -> &head
(and similarly for prev in the reverse direction)

--------------------------------------------

4. Custom structure embedding list_head

struct my_item {
    /* other data fields */
    ...
    struct list_head list;   // link node for the list
};

Representation:

+------------------------------+
|        data fields           |   <-- vùng màu xám trong hình
|             ...              |
+--------------+---------------+
|    prev      |     next      |   <-- struct list_head
+--------------+---------------+

--------------------------------------------

5. Effect of the list_entry macro

/*
 * ptr   : con trỏ trỏ đến trường struct list_head được nhúng
 * type  : kiểu của cấu trúc bên ngoài (outer struct)
 * member: tên của trường list_head trong cấu trúc đó
 */
list_entry(ptr, type, member)

Example:
struct my_item *item = list_entry(pos, struct my_item, list);

Meaning:
- Bắt đầu từ con trỏ pos (trỏ đến my_item.list),
- list_entry tính toán và trả về con trỏ trỏ đến cấu trúc bên ngoài my_item.
```

*Hình 11-1. Cấu trúc dữ liệu list_head*

Các phần đầu danh sách (list head) phải được khởi tạo trước khi sử dụng bằng macro `INIT_LIST_HEAD`. Một đầu danh sách "các việc cần làm" (things to do) có thể được khai báo và khởi tạo bằng:

```
struct list_head todo_list;
INIT_LIST_HEAD(&todo_list);
```

Ngoài ra, các danh sách có thể được khởi tạo tại thời điểm biên dịch (compile time):

```
LIST_HEAD(todo_list);
```

Một số hàm được định nghĩa trong *<linux/list.h>* để thao tác với danh sách:

```
list_add(struct list_head *new, struct list_head *head);
```

Thêm một mục mới (new entry) ngay sau đầu danh sách—thông thường là ở phần đầu của danh sách. Do đó, nó có thể được sử dụng để xây dựng các cấu trúc ngăn xếp (stack). Tuy nhiên, cần lưu ý rằng đầu danh sách không nhất thiết phải là phần đầu danh nghĩa của danh sách; nếu bạn truyền một cấu trúc `list_head` nằm ở đâu đó giữa danh sách, mục mới sẽ được chèn ngay sau nó. Vì danh sách liên kết trong Linux (Linux list) là danh sách vòng (circular), đầu danh sách nhìn chung không khác biệt so với bất kỳ mục nào khác.

`list_add_tail(struct list_head *new, struct list_head *head);`

Thêm một mục mới ngay trước đầu danh sách được chỉ định—nói cách khác là ở cuối danh sách. Do đó, *list_add_tail* có thể được sử dụng để xây dựng các hàng đợi vào-trước-ra-trước (first-in first-out queues).

```
list_del(struct list_head *entry);
```

```
list_del_init(struct list_head *entry);
```

Mục được chỉ định sẽ bị xóa khỏi danh sách. Nếu mục đó có khả năng được chèn lại vào một danh sách khác, bạn nên sử dụng *list_del_init*, hàm này sẽ khởi tạo lại các con trỏ của danh sách liên kết (linked list).

`list_move(struct list_head *entry, struct list_head *head);`

```
list_move_tail(struct list_head *entry, struct list_head *head);
```

Mục được chỉ định sẽ bị xóa khỏi danh sách hiện tại của nó và được thêm vào đầu của `head`. Để đưa mục đó vào cuối danh sách mới, hãy sử dụng *list_move_tail* thay thế.

`list_empty(struct list_head *head);`

Trả về một giá trị khác không (nonzero) nếu danh sách được chỉ định trống.

`list_splice(struct list_head *list, struct list_head *head);`

Nối hai danh sách bằng cách chèn `list` vào ngay sau `head`.

Các cấu trúc `list_head` rất hữu ích để triển khai một danh sách gồm các cấu trúc tương tự nhau, nhưng chương trình gọi thường quan tâm nhiều hơn đến các cấu trúc lớn hơn tạo nên toàn bộ danh sách. Một macro, *list_entry*, được cung cấp để ánh xạ ngược một con trỏ cấu trúc `list_head` thành một con trỏ trỏ đến cấu trúc chứa nó. Nó được gọi như sau:

```
list_entry(struct list_head *ptr, type_of_struct, field_name);
```

trong đó `ptr` là một con trỏ tới `struct list_head` đang được sử dụng, `type_of_struct` là kiểu của cấu trúc chứa `ptr`, và `field_name` là tên của trường danh sách bên trong cấu trúc đó. Trong cấu trúc `todo_struct` của chúng ta trước đây, trường danh sách được đặt tên đơn giản là `list`. Do đó, chúng ta có thể chuyển đổi một mục danh sách (list entry) thành cấu trúc chứa nó bằng một dòng mã như:

```
struct todo_struct *todo_ptr =
 list_entry(listptr, struct todo_struct, list);
```

Macro *list_entry* cần một chút thời gian để làm quen nhưng không quá khó sử dụng.

Việc duyệt qua các danh sách liên kết rất dễ dàng: người ta chỉ cần lần theo các con trỏ `prev` và `next`. Ví dụ, giả sử chúng ta muốn giữ danh sách các mục `todo_struct` được sắp xếp theo thứ tự ưu tiên giảm dần. Một hàm để thêm một mục mới sẽ trông giống như thế này:

```
void todo_add_entry(struct todo_struct *new)
{
 struct list_head *ptr;
 struct todo_struct *entry;
 for (ptr = todo_list.next; ptr != &todo_list; ptr = ptr->next) {
 entry = list_entry(ptr, struct todo_struct, list);
 if (entry->priority < new->priority) {
 list_add_tail(&new->list, ptr);
 return;
 }
 }
 list_add_tail(&new->list, &todo_struct)
}
```

Tuy nhiên, như một quy tắc chung, tốt hơn hết là sử dụng một trong các macro được định nghĩa sẵn để tạo các vòng lặp duyệt qua danh sách. Ví dụ, vòng lặp trước đó có thể được viết lại thành:

```
void todo_add_entry(struct todo_struct *new)
{
 struct list_head *ptr;
 struct todo_struct *entry;
 list_for_each(ptr, &todo_list) {
 entry = list_entry(ptr, struct todo_struct, list);
 if (entry->priority < new->priority) {
 list_add_tail(&new->list, ptr);
 return;
 }
 }
 list_add_tail(&new->list, &todo_struct)
}
```

Việc sử dụng các macro được cung cấp giúp tránh các lỗi lập trình đơn giản; các nhà phát triển các macro này cũng đã nỗ lực để đảm bảo chúng hoạt động hiệu quả. Có một số biến thể tồn tại:

`list_for_each(struct list_head *cursor, struct list_head *list)`

Macro này tạo ra một vòng lặp `for` chạy một lần với `cursor` trỏ tới từng mục tiếp theo trong danh sách. Hãy cẩn thận khi thay đổi danh sách trong lúc đang duyệt qua nó.

`list_for_each_prev(struct list_head *cursor, struct list_head *list)` Phiên bản này duyệt ngược qua danh sách.

`list_for_each_safe(struct list_head *cursor, struct list_head *next, struct list_head *list)`

Nếu vòng lặp của bạn có thể xóa các mục trong danh sách, hãy sử dụng phiên bản này. Nó đơn giản là lưu trữ mục tiếp theo trong danh sách vào `next` ở đầu vòng lặp, do đó nó sẽ không bị nhầm lẫn nếu mục được trỏ bởi `cursor` bị xóa.

`list_for_each_entry(type *cursor, struct list_head *list, member)` `list_for_each_entry_safe(type *cursor, type *next, struct list_head *list, member)`

Các macro này giúp đơn giản hóa quá trình xử lý một danh sách liên kết chứa một kiểu cấu trúc xác định. Ở đây, `cursor` là con trỏ trỏ đến kiểu cấu trúc chứa nó, và `member` là tên của cấu trúc `list_head` nằm bên trong cấu trúc chứa đó. Với các macro này, bạn không cần phải gọi hàm `list_entry` bên trong vòng lặp.

Nếu bạn xem xét bên trong tệp *<linux/list.h>*, bạn sẽ thấy một số khai báo bổ sung. Kiểu `hlist` là một danh sách liên kết kép (doubly linked list) với một kiểu phần đầu danh sách (list head) dạng con trỏ đơn riêng biệt; nó thường được sử dụng để tạo các bảng băm (hash tables) và các cấu trúc tương tự. Ngoài ra còn có các macro dùng để lặp qua cả hai loại danh sách được thiết kế để hoạt động với cơ chế đọc-sao chép-cập nhật (read-copy-update - được mô tả trong phần "Read-Copy-Update" ở Chương 5). Các hàm nguyên thủy (primitives) này ít có khả năng hữu ích trong các trình điều khiển thiết bị (device drivers); hãy xem tệp tiêu đề (header file) nếu bạn muốn biết thêm thông tin về cách chúng hoạt động.

## Tài liệu tham khảo nhanh (Quick Reference)

Các ký hiệu sau đây đã được giới thiệu trong chương này:

## include <linux/types.h> typedef u8; typedef u16; typedef u32;

typedef u64;

Các kiểu dữ liệu được đảm bảo là giá trị số nguyên không dấu (unsigned integer) 8, 16, 32 và 64-bit. Các kiểu có dấu tương ứng cũng tồn tại. Trong không gian người dùng (user space), bạn có thể tham chiếu đến các kiểu này dưới dạng `__u8`, `__u16`, v.v.

```
## include <asm/page.h>
PAGE_SIZE
PAGE_SHIFT
    Các ký hiệu xác định số byte trên mỗi trang (page) cho kiến trúc hiện tại
    và số bit trong độ lệch trang (page offset) (12 cho các trang 4-KB và 13 cho các trang 8-KB).
## include <asm/byteorder.h>
__LITTLE_ENDIAN
__BIG_ENDIAN
    Chỉ một trong hai ký hiệu được định nghĩa, tùy thuộc vào kiến trúc.
## include <asm/byteorder.h>
u32 __cpu_to_le32 (u32);
u32 __le32_to_cpu (u32);
    Các hàm chuyển đổi giữa các thứ tự byte đã biết và thứ tự byte của bộ xử lý.
    Có hơn 60 hàm như vậy; hãy xem các tệp khác nhau trong include/linux/
    byteorder/ để có danh sách đầy đủ và các cách chúng được định nghĩa.
## include <asm/unaligned.h>
get_unaligned(ptr);
put_unaligned(val, ptr);
    Một số kiến trúc cần bảo vệ việc truy cập dữ liệu không căn chỉnh (unaligned data access)
    bằng cách sử dụng các macro này. Các macro này sẽ mở rộng thành các thao tác hủy tham chiếu 
    con trỏ thông thường đối với các kiến trúc cho phép bạn truy cập dữ liệu không căn chỉnh.
## include <linux/err.h>
void *ERR_PTR(long error);
long PTR_ERR(const void *ptr);
long IS_ERR(const void *ptr);
    Các hàm cho phép mã lỗi (error codes) được trả về bởi các hàm trả về giá trị con trỏ.
## include <linux/list.h>
list_add(struct list_head *new, struct list_head *head);
list_add_tail(struct list_head *new, struct list_head *head);
list_del(struct list_head *entry);
list_del_init(struct list_head *entry);
list_empty(struct list_head *head);
list_entry(entry, type, member);
list_move(struct list_head *entry, struct list_head *head);
list_move_tail(struct list_head *entry, struct list_head *head);
list_splice(struct list_head *list, struct list_head *head);
    Các hàm thao tác với danh sách liên kết kép vòng (circular, doubly linked lists).
```

`list_for_each(struct list_head *cursor, struct list_head *list)` `list_for_each_prev(struct list_head *cursor, struct list_head *list)` `list_for_each_safe(struct list_head *cursor, struct list_head *next, struct list_head *list)` `list_for_each_entry(type *cursor, struct list_head *list, member)` `list_for_each_entry_safe(type *cursor, type *next, struct list_head *list, member)`

Các macro tiện ích để lặp qua các danh sách liên kết.
