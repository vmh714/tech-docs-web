## Chapter 7

## CẤP PHÁT BỘ NHỚ

Nhiều chương trình hệ thống cần có khả năng cấp phát thêm bộ nhớ cho các cấu trúc dữ liệu động (ví dụ: danh sách liên kết và cây nhị phân), có kích thước phụ thuộc vào thông tin chỉ có sẵn tại thời điểm chạy (run time). Chương này mô tả các hàm được sử dụng để cấp phát bộ nhớ trên heap hoặc stack.

## 7.1 Cấp phát Bộ nhớ trên Heap

Một tiến trình (process) có thể cấp phát bộ nhớ bằng cách tăng kích thước của heap, một phân đoạn (segment) bộ nhớ ảo liên tục có kích thước biến đổi, bắt đầu ngay sau phân đoạn dữ liệu chưa khởi tạo của tiến trình và lớn lên hoặc thu lại khi bộ nhớ được cấp phát và giải phóng (xem Hình 6-1 ở trang 119). Giới hạn hiện tại của heap được gọi là điểm ngắt chương trình (program break).

Để cấp phát bộ nhớ, các chương trình C thường sử dụng các hàm thuộc họ `malloc`, mà chúng ta sẽ mô tả ngay sau đây. Tuy nhiên, chúng ta bắt đầu với mô tả về `brk()` và `sbrk()`, là nền tảng để xây dựng các hàm `malloc`.

### 7.1.1 Điều chỉnh Điểm ngắt Chương trình: brk() và sbrk()

Việc thay đổi kích thước heap (tức là cấp phát hoặc thu hồi bộ nhớ) thực ra đơn giản chỉ là yêu cầu kernel điều chỉnh vị trí của điểm ngắt chương trình (program break) của tiến trình. Ban đầu, điểm ngắt chương trình nằm ngay phía sau phần cuối của phân đoạn dữ liệu chưa khởi tạo (tức là cùng vị trí với `&end`, được minh họa trong Hình 6-1).

Sau khi điểm ngắt chương trình được tăng lên, chương trình có thể truy cập bất kỳ địa chỉ nào trong vùng mới được cấp phát, nhưng chưa có trang bộ nhớ vật lý (physical memory page) nào được cấp phát ngay lúc đó. Kernel sẽ tự động cấp phát các trang vật lý mới trong lần đầu tiên tiến trình cố gắng truy cập các địa chỉ nằm trong các trang đó.

Theo truyền thống, hệ thống UNIX đã cung cấp hai System Call để thao tác với điểm ngắt chương trình và cả hai đều có sẵn trên Linux: `brk()` và `sbrk()`. Mặc dù các System Call này hiếm khi được sử dụng trực tiếp trong các chương trình, việc hiểu rõ chúng giúp làm sáng tỏ cách thức hoạt động của việc cấp phát bộ nhớ.

```c
## include <unistd.h>
int brk(void *end_data_segment);
                                            Trả về 0 khi thành công, hoặc –1 khi lỗi
void *sbrk(intptr_t increment);
             Trả về điểm ngắt chương trình trước đó khi thành công, hoặc (void *) –1 khi lỗi
```

System Call `brk()` thiết lập điểm ngắt chương trình đến vị trí được chỉ định bởi `end_data_segment`. Vì bộ nhớ ảo được cấp phát theo đơn vị trang (page), `end_data_segment` sẽ được làm tròn lên ranh giới trang tiếp theo một cách hiệu quả.

Các cố gắng thiết lập điểm ngắt chương trình thấp hơn giá trị ban đầu của nó (tức là thấp hơn `&end`) có thể dẫn đến hành vi không mong đợi, chẳng hạn như lỗi phân đoạn (segmentation fault - tín hiệu `SIGSEGV`, được mô tả trong Mục 20.2) khi cố gắng truy cập dữ liệu trong các phần hiện không tồn tại của phân đoạn dữ liệu đã khởi tạo hoặc chưa khởi tạo. Giới hạn trên chính xác cho việc thiết lập điểm ngắt chương trình phụ thuộc vào một loạt yếu tố, bao gồm: giới hạn tài nguyên của tiến trình đối với kích thước của phân đoạn dữ liệu (`RLIMIT_DATA`, được mô tả trong Mục 36.3); và vị trí của các ánh xạ bộ nhớ (memory mapping), các phân đoạn bộ nhớ chia sẻ (shared memory segment) và thư viện chia sẻ (shared library).

Một lời gọi đến `sbrk()` sẽ điều chỉnh điểm ngắt chương trình bằng cách cộng thêm `increment` vào đó. (Trên Linux, `sbrk()` là một hàm thư viện được cài đặt dựa trên `brk()`.) Kiểu `intptr_t` được sử dụng để khai báo `increment` là một kiểu dữ liệu số nguyên. Khi thành công, `sbrk()` trả về địa chỉ trước đó của điểm ngắt chương trình. Nói cách khác, nếu chúng ta tăng điểm ngắt chương trình, giá trị trả về sẽ là một con trỏ trỏ đến điểm bắt đầu của khối bộ nhớ vừa được cấp phát.

Lời gọi `sbrk(0)` trả về thiết lập hiện tại của điểm ngắt chương trình mà không làm thay đổi nó. Điều này có thể hữu ích nếu chúng ta muốn theo dõi kích thước của heap, có lẽ để giám sát hành vi của một gói cấp phát bộ nhớ.

> SUSv2 đã chỉ định `brk()` và `sbrk()` (đánh dấu chúng là DI SẢN - LEGACY). SUSv3 đã loại bỏ các thông số kỹ thuật của chúng.

### 7.1.2 Cấp phát Bộ nhớ trên Heap: malloc() và free()

Nhìn chung, các chương trình C sử dụng các hàm thuộc họ `malloc` để cấp phát và giải phóng bộ nhớ trên heap. Các hàm này mang lại một số ưu điểm so với `brk()` và `sbrk()`. Cụ thể, chúng:

- được chuẩn hóa như một phần của ngôn ngữ C;
- dễ sử dụng hơn trong các chương trình đa luồng (threaded program);

- cung cấp một giao diện đơn giản cho phép cấp phát bộ nhớ theo các đơn vị nhỏ; và
- cho phép chúng ta tùy ý giải phóng các khối bộ nhớ, các khối này được duy trì trong một danh sách trống (free list) và được tái chế trong các lời gọi cấp phát bộ nhớ tiếp theo.

Hàm `malloc()` cấp phát `size` byte từ heap và trả về một con trỏ trỏ đến điểm bắt đầu của khối bộ nhớ vừa được cấp phát. Bộ nhớ được cấp phát không được khởi tạo giá trị.

```c
## include <stdlib.h>
void *malloc(size_t size);
               Trả về con trỏ đến bộ nhớ được cấp phát khi thành công, hoặc NULL khi lỗi
```

Vì `malloc()` trả về kiểu `void *`, chúng ta có thể gán nó cho bất kỳ kiểu con trỏ C nào. Khối bộ nhớ do `malloc()` trả về luôn được căn chỉnh (aligned) trên ranh giới byte phù hợp cho bất kỳ loại cấu trúc dữ liệu C nào. Trong thực tế, điều này có nghĩa là nó được cấp phát trên ranh giới 8 byte hoặc 16 byte trên hầu hết các kiến trúc.

> SUSv3 quy định rằng lời gọi `malloc(0)` có thể trả về `NULL` hoặc một con trỏ trỏ đến một vùng nhớ nhỏ mà có thể (và nên) được giải phóng bằng hàm `free()`. Trên Linux, `malloc(0)` tuân theo hành vi thứ hai.

Nếu bộ nhớ không thể được cấp phát (có thể vì chúng ta đã chạm tới giới hạn mà tại đó `program break` có thể được nâng lên), thì `malloc()` trả về `NULL` và thiết lập `errno` để chỉ ra lỗi. Mặc dù khả năng thất bại trong việc cấp phát bộ nhớ là rất nhỏ, tất cả các lời gọi đến `malloc()`, và các hàm liên quan mà chúng ta mô tả sau đây, đều nên kiểm tra giá trị trả về lỗi này.

Hàm `free()` giải phóng khối bộ nhớ được trỏ tới bởi đối số `ptr` của nó, đây phải là một địa chỉ từng được trả về trước đó bởi `malloc()` hoặc một trong các hàm cấp phát bộ nhớ heap khác mà chúng ta sẽ mô tả sau trong chương này.

```c
## include <stdlib.h>
void free(void *ptr);
```

Nói chung, `free()` không làm hạ thấp `program break`, mà thay vào đó, nó thêm khối bộ nhớ vào một danh sách các khối trống (free blocks) để được tái sử dụng bởi các lời gọi `malloc()` trong tương lai. Điều này được thực hiện vì một số lý do sau:

- Khối bộ nhớ đang được giải phóng thường nằm ở đâu đó ở giữa vùng heap, chứ không phải ở cuối, do đó việc hạ thấp `program break` là không khả thi.
- Nó giảm thiểu số lượng lời gọi `sbrk()` mà chương trình phải thực hiện. (Như đã lưu ý trong Mục 3.1, các System Call có chi phí ẩn (overhead) nhỏ nhưng đáng kể).
- Trong nhiều trường hợp, việc hạ thấp `break` sẽ không giúp ích gì cho các chương trình cấp phát lượng lớn bộ nhớ, vì chúng thường có xu hướng giữ lại bộ nhớ đã cấp phát hoặc liên tục giải phóng rồi cấp phát lại bộ nhớ, thay vì giải phóng toàn bộ rồi tiếp tục chạy trong một khoảng thời gian dài.

Nếu đối số truyền vào `free()` là một con trỏ `NULL`, thì lời gọi này không làm gì cả. (Nói cách khác, việc truyền một con trỏ `NULL` vào `free()` không phải là lỗi).

Việc sử dụng bất kỳ phần nào của `ptr` sau khi gọi `free()` — ví dụ, truyền nó vào `free()` lần thứ hai — là một lỗi có thể dẫn đến kết quả không thể đoán trước.

### Chương trình ví dụ

Chương trình trong [Liệt kê 7-1](#page-3-0) có thể được sử dụng để minh họa ảnh hưởng của `free()` đối với `program break`. Chương trình này cấp phát nhiều khối bộ nhớ và sau đó giải phóng một phần hoặc toàn bộ chúng, tùy thuộc vào các đối số dòng lệnh (tùy chọn) của nó.

Hai đối số dòng lệnh đầu tiên chỉ định số lượng và kích thước của các khối cần cấp phát. Đối số dòng lệnh thứ ba chỉ định bước nhảy vòng lặp (loop step unit) sẽ được sử dụng khi giải phóng các khối bộ nhớ. Nếu chúng ta chỉ định `1` ở đây (đây cũng là giá trị mặc định nếu bỏ qua đối số này), thì chương trình sẽ giải phóng mọi khối bộ nhớ; nếu là `2`, thì giải phóng cứ mỗi khối được cấp phát thứ hai; và cứ thế tiếp tục. Đối số dòng lệnh thứ tư và thứ năm chỉ định phạm vi các khối mà chúng ta muốn giải phóng. Nếu các đối số này bị bỏ qua, thì tất cả các khối đã cấp phát (theo các bước được chỉ định bởi đối số dòng lệnh thứ ba) sẽ được giải phóng.

**Liệt kê 7-1:** Minh họa điều gì xảy ra với `program break` khi bộ nhớ được giải phóng

```
––––––––––––––––––––––––––––––––––––––––––––––––––– memalloc/free_and_sbrk.c
## include "tlpi_hdr.h"
## define MAX_ALLOCS 1000000
int
main(int argc, char *argv[])
{
 char *ptr[MAX_ALLOCS];
 int freeStep, freeMin, freeMax, blockSize, numAllocs, j;
 printf("\n");
 if (argc < 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s num-allocs block-size [step [min [max]]]\n", argv[0]);
 numAllocs = getInt(argv[1], GN_GT_0, "num-allocs");
 if (numAllocs > MAX_ALLOCS)
 cmdLineErr("num-allocs > %d\n", MAX_ALLOCS);
 blockSize = getInt(argv[2], GN_GT_0 | GN_ANY_BASE, "block-size");
 freeStep = (argc > 3) ? getInt(argv[3], GN_GT_0, "step") : 1;
 freeMin = (argc > 4) ? getInt(argv[4], GN_GT_0, "min") : 1;
 freeMax = (argc > 5) ? getInt(argv[5], GN_GT_0, "max") : numAllocs;
 if (freeMax > numAllocs)
 cmdLineErr("free-max > num-allocs\n");
 printf("Initial program break: %10p\n", sbrk(0));
 printf("Allocating %d*%d bytes\n", numAllocs, blockSize);
```

```
 for (j = 0; j < numAllocs; j++) {
 ptr[j] = malloc(blockSize);
 if (ptr[j] == NULL)
 errExit("malloc");
 }
 printf("Program break is now: %10p\n", sbrk(0));
 printf("Freeing blocks from %d to %d in steps of %d\n",
 freeMin, freeMax, freeStep);
 for (j = freeMin - 1; j < freeMax; j += freeStep)
 free(ptr[j]);
 printf("After free(), program break is: %10p\n", sbrk(0));
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––– memalloc/free_and_sbrk.c
```

Chạy chương trình trong Liệt kê [7-1](#page-3-0) với dòng lệnh sau khiến chương trình cấp phát 1000 khối bộ nhớ và sau đó giải phóng cứ mỗi khối thứ hai:

### \$ **./free\_and\_sbrk 1000 10240 2**

Kết quả đầu ra cho thấy sau khi các khối này đã được giải phóng, `program break` vẫn giữ nguyên không thay đổi so với mức mà nó đạt được khi tất cả các khối bộ nhớ được cấp phát:

```
Initial program break: 0x804a6bc
Allocating 1000*10240 bytes
Program break is now: 0x8a13000
Freeing blocks from 1 to 1000 in steps of 2
After free(), program break is: 0x8a13000
```

Dòng lệnh sau đây chỉ định rằng tất cả các khối đã cấp phát ngoại trừ khối cuối cùng sẽ được giải phóng. Một lần nữa, ranh giới chương trình (program break) vẫn giữ nguyên ở mức "đỉnh" của nó.

```
$ ./free_and_sbrk 1000 10240 1 1 999
Initial program break: 0x804a6bc
Allocating 1000*10240 bytes
Program break is now: 0x8a13000
Freeing blocks from 1 to 999 in steps of 1
After free(), program break is: 0x8a13000
```

Tuy nhiên, nếu chúng ta giải phóng toàn bộ tập hợp các khối ở đầu trên (top end) của vùng nhớ heap, chúng ta sẽ thấy rằng ranh giới chương trình (program break) giảm xuống khỏi giá trị đỉnh của nó, cho thấy rằng hàm `free()` đã sử dụng `sbrk()` để hạ thấp ranh giới chương trình (program break). Ở đây, chúng ta giải phóng 500 khối bộ nhớ được cấp phát cuối cùng:

```
$ ./free_and_sbrk 1000 10240 1 500 1000
Initial program break: 0x804a6bc
Allocating 1000*10240 bytes
Program break is now: 0x8a13000
Freeing blocks from 500 to 1000 in steps of 1
After free(), program break is: 0x852b000
```

Trong trường hợp này, hàm `free()` của glibc có khả năng nhận biết rằng toàn bộ vùng nhớ ở đầu trên của heap là trống, bởi vì khi giải phóng các khối, nó gộp (coalesce) các khối trống lân cận thành một khối lớn duy nhất. (Việc gộp như vậy được thực hiện để tránh việc có quá nhiều mảnh nhỏ trên danh sách trống (free list), mà tất cả chúng đều có thể quá nhỏ để đáp ứng các yêu cầu `malloc()` tiếp theo).

> Hàm `free()` của glibc chỉ gọi `sbrk()` để hạ thấp ranh giới chương trình (program break) khi khối trống ở đầu trên "đủ" lớn, trong đó từ "đủ" được quyết định bởi các tham số điều khiển hoạt động của gói `malloc` (128 kB là một giá trị điển hình). Điều này làm giảm số lượng lệnh gọi `sbrk()` (tức là số lượng System Call `brk()`) phải thực hiện.

### Nên gọi free() hay không?

Khi một tiến trình (process) kết thúc, toàn bộ bộ nhớ của nó được trả lại cho hệ thống, bao gồm cả bộ nhớ heap được cấp phát bởi các hàm trong gói `malloc`. Trong các chương trình cấp phát bộ nhớ và tiếp tục sử dụng nó cho đến khi chương trình kết thúc, việc bỏ qua các lệnh gọi `free()` là điều phổ biến, dựa vào hành vi này để tự động giải phóng bộ nhớ. Điều này có thể đặc biệt hữu ích trong các chương trình cấp phát nhiều khối bộ nhớ, vì việc thêm nhiều lệnh gọi `free()` có thể tốn kém về thời gian CPU, cũng như có thể phức tạp trong việc viết mã.

Mặc dù việc dựa vào việc kết thúc tiến trình để tự động giải phóng bộ nhớ là có thể chấp nhận được đối với nhiều chương trình, nhưng có một vài lý do tại sao việc giải phóng rõ ràng (explicitly) toàn bộ bộ nhớ đã cấp phát lại là điều nên làm:

- Việc gọi rõ ràng hàm `free()` có thể làm cho chương trình dễ đọc hơn và dễ bảo trì hơn đối với các sửa đổi trong tương lai.
- Nếu chúng ta đang sử dụng một thư viện gỡ lỗi malloc (được mô tả bên dưới) để tìm các lỗi rò rỉ bộ nhớ (memory leak) trong một chương trình, thì bất kỳ bộ nhớ nào không được giải phóng rõ ràng sẽ được báo cáo là rò rỉ bộ nhớ. Điều này có thể làm phức tạp thêm nhiệm vụ tìm kiếm các lỗi rò rỉ bộ nhớ thực sự.

### 7.1.3 Triển khai của malloc() và free()

Mặc dù `malloc()` và `free()` cung cấp một giao diện cấp phát bộ nhớ dễ sử dụng hơn nhiều so với `brk()` và `sbrk()`, việc mắc phải các lỗi lập trình khác nhau khi sử dụng chúng vẫn là điều có thể xảy ra. Việc hiểu rõ cách `malloc()` và `free()` được triển khai mang lại cho chúng ta cái nhìn sâu sắc về nguyên nhân gây ra các lỗi này và cách chúng ta có thể tránh chúng.

Việc triển khai `malloc()` khá đơn giản. Đầu tiên, hàm này quét danh sách các khối bộ nhớ đã được giải phóng trước đó bởi `free()` để tìm một khối có kích thước lớn hơn hoặc bằng yêu cầu. (Các chiến lược khác nhau có thể được áp dụng cho quá trình quét này tùy thuộc vào việc triển khai; ví dụ như chiến lược *first-fit* - khớp đầu tiên, hoặc *best-fit* - khớp nhất). Nếu khối có kích thước chính xác, nó sẽ được trả về cho hàm gọi (caller). Nếu khối này lớn hơn, nó sẽ được chia tách (split) để một khối có kích thước chính xác được trả về cho hàm gọi và một khối trống nhỏ hơn được giữ lại trong danh sách trống (free list).

Nếu không có khối nào trong danh sách trống đủ lớn, `malloc()` sẽ gọi `sbrk()` để cấp phát thêm bộ nhớ. Để giảm số lần gọi `sbrk()`, thay vì cấp phát chính xác số byte được yêu cầu, `malloc()` tăng *program break* theo các đơn vị lớn hơn (một số lần bội của kích thước trang bộ nhớ ảo - virtual memory page size), và đưa phần bộ nhớ dư thừa vào danh sách trống.

Khi xem xét việc triển khai của `free()`, mọi thứ bắt đầu trở nên thú vị hơn. Khi `free()` đưa một khối bộ nhớ vào danh sách trống, làm thế nào nó biết được kích thước của khối đó? Điều này được thực hiện thông qua một thủ thuật. Khi `malloc()` cấp phát khối, nó cấp phát thêm các byte để chứa một số nguyên (integer) lưu kích thước của khối đó. Số nguyên này nằm ở đầu khối; địa chỉ thực tế trả về cho hàm gọi trỏ đến vị trí ngay sau giá trị độ dài này, như được minh họa trong Hình 7-1.

```
+-----------------+------------------------------+
| Length of block |   Memory for use by caller   |
|       (L)       |                              |
+-----------------+------------------------------+
          ^
          |
          +-- Address returned by malloc()
```

**Hình 7-1:** Khối bộ nhớ được trả về bởi `malloc()`

Khi một khối được đưa vào danh sách trống liên kết đôi (doubly linked free list), `free()` sử dụng chính các byte của khối đó để thêm khối vào danh sách, như được minh họa trong Hình 7-2.

```
+-------------------+------------------------------+----------------------------+------------------------------+
| Length of block   | Pointer to previous          | Pointer to next            | Remaining bytes of           |
|        (L)        |     free block (P)           |     free block (N)         |        free block            |
+-------------------+------------------------------+----------------------------+------------------------------+
                        ^                               ^
                        |                               |
                 previous free block              next free block
```

Hình 7-2: Một khối trong danh sách trống

Theo thời gian, khi các khối được giải phóng và cấp phát lại, các khối trong danh sách trống sẽ đan xen với các khối bộ nhớ đang được cấp phát và sử dụng, như được minh họa trong Hình 7-3.

```
  Head of free list
     |
     v
+--+----+----+----+----+----+----+----+----+----+----+--+
|  |free|....|free|    |free|....|free|    |free|....|  |
+--+----+----+----+----+----+----+----+----+----+----+--+
 ^                  ^                   ^              ^        
 |                  |                   |              |        
 +------------------+-------------------+--------------+
         doubly-linked free list via P / N pointers

Block on free list (has headers L, P, N):

+---+---+---+-------+
| L | P | N |  ...  |
+---+---+---+-------+

Allocated, in-use block (only length header L):

+---+-----------+
| L |   data    |
+---+-----------+

"-" = pointer value marking end of list
```

Hình 7-3: Vùng nhớ heap chứa các khối được cấp phát và danh sách trống

Bây giờ hãy xem xét thực tế là ngôn ngữ C cho phép chúng ta tạo các con trỏ đến bất kỳ vị trí nào trong heap, và sửa đổi các vị trí mà chúng trỏ tới, bao gồm cả các con trỏ `length` (độ dài), `previous free block` (khối trống trước đó), và `next free block` (khối trống tiếp theo) được duy trì bởi `free()` và `malloc()`. Kết hợp điều này với mô tả ở trên, chúng ta có một hỗn hợp khá dễ bùng nổ khi tạo ra các lỗi lập trình khó hiểu. Ví dụ, nếu do một con trỏ bị lệch hướng, chúng ta vô tình làm tăng một trong các giá trị độ dài đứng trước một khối bộ nhớ được cấp phát, và sau đó giải phóng khối đó, thì `free()` sẽ ghi nhận khối bộ nhớ có sai kích thước vào danh sách trống. Sau đó, `malloc()` có thể cấp phát lại khối này, dẫn đến kịch bản chương trình có các con trỏ trỏ đến hai khối bộ nhớ được cấp phát mà nó hiểu là riêng biệt, nhưng thực tế lại chồng chéo lên nhau. Nhiều kịch bản lỗi khác cũng có thể xảy ra.

Để tránh những loại lỗi này, chúng ta nên tuân thủ các quy tắc sau:

- Sau khi cấp phát một khối bộ nhớ (allocated memory), chúng ta cần cẩn thận không thao tác với bất kỳ byte nào nằm ngoài phạm vi của khối đó. Điều này có thể xảy ra, ví dụ, do kết quả của việc tính toán con trỏ sai (faulty pointer arithmetic) hoặc lỗi lệch một (off-by-one errors) trong các vòng lặp cập nhật nội dung của khối bộ nhớ.
- Việc giải phóng (free) cùng một vùng nhớ đã cấp phát nhiều hơn một lần là một lỗi. Với glibc trên Linux, chúng ta thường nhận được lỗi vi phạm phân đoạn (segmentation violation - tín hiệu `SIGSEGV`). Điều này là tốt, vì nó cảnh báo chúng ta rằng mình đã mắc lỗi lập trình. Tuy nhiên, nói chung, việc giải phóng cùng một vùng nhớ hai lần sẽ dẫn đến hành vi không xác định (unpredictable behavior).
- Chúng ta tuyệt đối không được gọi hàm `free()` với một giá trị con trỏ (pointer value) không phải do một lệnh gọi đến một trong các hàm trong gói malloc trả về.
- Nếu chúng ta đang viết một chương trình chạy dài (long-running program) (ví dụ: một shell hoặc một tiến trình daemon mạng) liên tục cấp phát bộ nhớ cho nhiều mục đích khác nhau, thì chúng ta phải đảm bảo rằng mình sẽ giải phóng (deallocate) bất kỳ bộ nhớ nào sau khi đã sử dụng xong. Việc không làm như vậy có nghĩa là vùng nhớ heap sẽ liên tục phình to cho đến khi chúng ta chạm tới giới hạn của bộ nhớ ảo (virtual memory) khả dụng, tại thời điểm đó, các lần cố gắng cấp phát bộ nhớ tiếp theo sẽ thất bại. Trạng thái như vậy được gọi là rò rỉ bộ nhớ (memory leak).

### Công cụ và thư viện gỡ lỗi malloc

Việc không tuân thủ các quy tắc được liệt kê ở trên có thể dẫn đến việc tạo ra các lỗi rất khó phát hiện và khó tái hiện. Công việc tìm kiếm những lỗi như vậy có thể được giảm nhẹ đáng kể bằng cách sử dụng các công cụ gỡ lỗi malloc do glibc cung cấp hoặc một trong số các thư viện gỡ lỗi malloc được thiết kế cho mục đích này.

Trong số các công cụ gỡ lỗi malloc do glibc cung cấp có các công cụ sau:

- Các hàm `mtrace()` và `muntrace()` cho phép một chương trình bật và tắt tính năng theo dõi (trace) các lệnh gọi cấp phát bộ nhớ. Các hàm này được sử dụng kết hợp với biến môi trường `MALLOC_TRACE`, biến này nên được định nghĩa để chứa tên của một tệp mà thông tin theo dõi sẽ được ghi vào đó. Khi `mtrace()` được gọi, nó sẽ kiểm tra xem tệp này đã được định nghĩa hay chưa và có thể mở để ghi hay không; nếu có, thì tất cả các lệnh gọi đến các hàm trong gói malloc sẽ được theo dõi và ghi lại vào tệp. Do tệp kết quả không dễ đọc đối với con người, một tập lệnh (script) — cũng có tên là `mtrace` — được cung cấp để phân tích tệp và tạo ra một bản tóm tắt dễ đọc. Vì lý do bảo mật, các lệnh gọi đến `mtrace()` sẽ bị bỏ qua bởi các chương trình `set-user-ID` và `set-group-ID`.
- Các hàm `mcheck()` và `mprobe()` cho phép chương trình thực hiện các kiểm tra tính nhất quán (consistency checks) trên các khối bộ nhớ được cấp phát; ví dụ, bắt các lỗi như cố gắng ghi vào một vị trí nằm sau phần cuối của khối bộ nhớ đã cấp phát. Các hàm này cung cấp chức năng có phần trùng lặp với các thư viện gỡ lỗi malloc được mô tả bên dưới. Các chương trình sử dụng các hàm này phải được liên kết (link) với thư viện `mcheck` bằng cách sử dụng tùy chọn `cc –lmcheck`.
- Biến môi trường `MALLOC_CHECK_` (lưu ý có dấu gạch dưới ở cuối) phục vụ mục đích tương tự như `mcheck()` và `mprobe()`. (Một điểm khác biệt đáng chú ý giữa hai kỹ thuật này là việc sử dụng `MALLOC_CHECK_` không đòi hỏi phải sửa đổi và biên dịch lại chương trình). Bằng cách đặt biến này thành các giá trị số nguyên khác nhau, chúng ta có thể điều khiển cách chương trình phản hồi lại các lỗi cấp phát bộ nhớ. Các thiết lập có thể là: `0`, nghĩa là bỏ qua lỗi; `1`, nghĩa là in các lỗi chẩn đoán ra luồng lỗi chuẩn `stderr`; và `2`, nghĩa là gọi `abort()` để chấm dứt chương trình. Không phải tất cả các lỗi cấp phát và giải phóng bộ nhớ đều có thể được phát hiện thông qua việc sử dụng `MALLOC_CHECK_`; nó chỉ tìm thấy những lỗi phổ biến. Tuy nhiên, kỹ thuật này nhanh, dễ sử dụng và có chi phí vận hành thời gian chạy (run-time overhead) thấp so với việc sử dụng các thư viện gỡ lỗi malloc. Vì lý do bảo mật, cài đặt của `MALLOC_CHECK_` sẽ bị bỏ qua bởi các chương trình `set-user-ID` và `set-group-ID`.

Thông tin thêm về tất cả các tính năng trên có thể được tìm thấy trong tài liệu hướng dẫn của glibc (glibc manual). Một thư viện gỡ lỗi malloc cung cấp cùng một API như gói malloc tiêu chuẩn, nhưng thực hiện thêm các công việc phụ để bắt lỗi cấp phát bộ nhớ. Để sử dụng một thư viện như vậy, chúng ta liên kết ứng dụng của mình với thư viện đó thay vì gói malloc trong thư viện chuẩn C. Do các thư viện này thường hoạt động với cái giá là thời gian chạy chậm hơn, mức tiêu thụ bộ nhớ tăng lên, hoặc cả hai, chúng ta chỉ nên sử dụng chúng cho mục đích gỡ lỗi (debugging), sau đó quay lại liên kết với gói malloc tiêu chuẩn cho phiên bản phát hành thương mại (production version) của ứng dụng. Trong số các thư viện đó có Electric Fence (http://www.perens.com/FreeSoftware/), dmalloc (http://dmalloc.com/), Valgrind (http://valgrind.org/), và Insure++ (http://www.parasoft.com/).

> Cả Valgrind và Insure++ đều có khả năng phát hiện nhiều loại lỗi khác ngoài các lỗi liên quan đến việc cấp phát vùng nhớ heap. Hãy xem các trang web tương ứng của chúng để biết chi tiết.

### Điều khiển và giám sát gói malloc

Tài liệu hướng dẫn của glibc mô tả một loạt các hàm phi chuẩn (nonstandard functions) có thể được sử dụng để giám sát và điều khiển việc cấp phát bộ nhớ bởi các hàm trong gói malloc, bao gồm các hàm sau:

- Hàm `mallopt()` thay đổi các tham số khác nhau điều khiển thuật toán được sử dụng bởi `malloc()`. Ví dụ, một tham số như vậy chỉ định dung lượng tối thiểu có thể giải phóng phải tồn tại ở cuối danh sách bộ nhớ trống (free list) trước khi `sbrk()` được sử dụng để thu nhỏ vùng nhớ heap (heap). Một tham số khác chỉ định giới hạn trên cho kích thước của các khối sẽ được cấp phát từ heap; các khối lớn hơn giới hạn này được cấp phát bằng cách sử dụng System Call `mmap()` (tham khảo Mục 49.7).
- Hàm `mallinfo()` trả về một cấu trúc (structure) chứa các thống kê khác nhau về bộ nhớ được cấp phát bởi `malloc()`.

Nhiều bản cài đặt UNIX cung cấp các phiên bản của `mallopt()` và `mallinfo()`. Tuy nhiên, giao diện do các hàm này cung cấp có sự khác biệt giữa các triển khai, do đó chúng không có tính khả chuyển (portable).

### 7.1.4 Các phương pháp cấp phát bộ nhớ khác trên Heap

Cũng giống như `malloc()`, thư viện C cung cấp một loạt các hàm khác để cấp phát bộ nhớ trên heap, và chúng ta sẽ mô tả các hàm đó ở đây.

### Cấp phát bộ nhớ với `calloc()` và `realloc()`

Hàm `calloc()` cấp phát bộ nhớ cho một mảng gồm các phần tử giống hệt nhau.

```c
## include <stdlib.h>
void *calloc(size_t numitems, size_t size);
               Trả về con trỏ đến vùng nhớ được cấp phát khi thành công, hoặc NULL khi lỗi
```

Đối số `numitems` chỉ định có bao nhiêu phần tử cần cấp phát và `size` chỉ định kích thước của chúng. Sau khi cấp phát một khối bộ nhớ có kích thước phù hợp, `calloc()` trả về một con trỏ trỏ đến đầu khối nhớ (hoặc `NULL` nếu không thể cấp phát bộ nhớ). Không giống như `malloc()`, `calloc()` khởi tạo vùng nhớ được cấp phát về giá trị 0.

Dưới đây là một ví dụ về việc sử dụng `calloc()`:

```
struct { /* Một số định nghĩa trường dữ liệu */ } myStruct;
struct myStruct *p;
p = calloc(1000, sizeof(struct myStruct));
if (p == NULL)
 errExit("calloc");
```

Hàm `realloc()` được sử dụng để thay đổi kích thước (thường là mở rộng) của một khối bộ nhớ đã được cấp phát trước đó bởi một trong các hàm trong gói `malloc`.

```c
## include <stdlib.h>
void *realloc(void *ptr, size_t size);
               Trả về con trỏ đến vùng nhớ được cấp phát khi thành công, hoặc NULL khi lỗi
```

Đối số `ptr` là một con trỏ trỏ tới khối bộ nhớ cần thay đổi kích thước. Đối số `size` chỉ định kích thước mới mong muốn của khối nhớ.

Khi thành công, `realloc()` trả về một con trỏ trỏ đến vị trí của khối nhớ đã được thay đổi kích thước. Vị trí này có thể khác với vị trí của nó trước khi gọi hàm. Khi có lỗi, `realloc()` trả về `NULL` và giữ nguyên khối bộ nhớ được trỏ tới bởi `ptr` (SUSv3 yêu cầu điều này).

Khi `realloc()` tăng kích thước của một khối bộ nhớ đã được cấp phát, nó không khởi tạo các byte được cấp phát thêm.

Bộ nhớ được cấp phát bằng cách sử dụng `calloc()` hoặc `realloc()` nên được giải phóng bằng `free()`.

Lời gọi `realloc(ptr, 0)` tương đương với việc gọi `free(ptr)` theo sau bởi `malloc(0)`. Nếu `ptr` được chỉ định là `NULL`, thì `realloc()` tương đương với việc gọi `malloc(size)`.

Đối với trường hợp thông thường, khi chúng ta tăng kích thước của khối bộ nhớ, `realloc()` cố gắng gộp (coalesce) khối nhớ đó với khối bộ nhớ liền kề ngay sau nó trong danh sách bộ nhớ trống (free list), nếu tồn tại một khối như vậy và đủ lớn. Nếu khối nằm ở cuối heap, thì `realloc()` sẽ mở rộng heap. Nếu khối bộ nhớ nằm ở giữa heap và không có đủ không gian trống liền kề ngay sau nó, `realloc()` sẽ cấp phát một khối bộ nhớ mới và sao chép tất cả dữ liệu hiện có từ khối cũ sang khối mới. Trường hợp cuối cùng này rất phổ biến và tốn nhiều tài nguyên CPU (CPU-intensive). Nhìn chung, bạn nên hạn chế tối đa việc sử dụng `realloc()`.

Vì `realloc()` có thể định vị lại (relocate) khối bộ nhớ, chúng ta phải sử dụng con trỏ trả về từ `realloc()` cho các tham chiếu đến khối bộ nhớ trong tương lai. Chúng ta có thể sử dụng `realloc()` để cấp phát lại một khối được trỏ tới bởi biến `ptr` như sau:

```
nptr = realloc(ptr, newsize);
if (nptr == NULL) {
 /* Xử lý lỗi */
} else { /* realloc() thành công */
 ptr = nptr;
}
```

Trong ví dụ này, chúng ta không gán giá trị trả về của `realloc()` trực tiếp cho `ptr` bởi vì, nếu `realloc()` thất bại, `ptr` sẽ bị gán thành `NULL`, khiến cho khối bộ nhớ hiện tại không thể truy cập được nữa.

Vì `realloc()` có thể di chuyển khối bộ nhớ, bất kỳ con trỏ nào trỏ đến các vị trí bên trong khối trước lời gọi `realloc()` có thể không còn hợp lệ sau lời gọi đó. Loại tham chiếu duy nhất đến một vị trí trong khối được đảm bảo là vẫn hợp lệ là tham chiếu được hình thành bằng cách cộng thêm một độ lệch (offset) vào con trỏ trỏ tới đầu khối. Chúng ta thảo luận chi tiết hơn về vấn đề này trong Mục 48.6.

### Cấp phát bộ nhớ căn chỉnh (aligned memory): memalign() và posix\_memalign()

Các hàm memalign() và posix\_memalign() được thiết kế để cấp phát bộ nhớ bắt đầu tại một địa chỉ được căn chỉnh (aligned) theo ranh giới lũy thừa của hai (power-of-two) được chỉ định, một tính năng hữu ích cho một số ứng dụng (xem, ví dụ, Liệt kê 13-1, ở trang 247).

```c
## include <malloc.h>
void *memalign(size_t boundary, size_t size);
               Trả về con trỏ đến vùng nhớ được cấp phát nếu thành công, hoặc NULL nếu lỗi
```

Hàm memalign() cấp phát `size` byte bắt đầu tại một địa chỉ được căn chỉnh theo bội số của `boundary`, giá trị này bắt buộc phải là một lũy thừa của hai. Địa chỉ của vùng nhớ được cấp phát được trả về làm kết quả của hàm.

Hàm memalign() không có mặt trên tất cả các hệ triển khai UNIX (UNIX implementations). Hầu hết các hệ triển khai UNIX khác cung cấp memalign() yêu cầu bao gồm `<stdlib.h>` thay vì `<malloc.h>` để lấy khai báo hàm.

SUSv3 không quy định memalign(), nhưng thay vào đó quy định một hàm tương tự có tên là posix\_memalign(). Hàm này là một bổ sung gần đây của các ủy ban tiêu chuẩn, và chỉ xuất hiện trên một số ít hệ triển khai UNIX.

```c
## include <stdlib.h>
int posix_memalign(void **memptr, size_t alignment, size_t size);
                      Trả về 0 nếu thành công, hoặc một số lỗi dương nếu xảy ra lỗi
```

Hàm posix\_memalign() khác với memalign() ở hai điểm:

- Địa chỉ của vùng nhớ được cấp phát được trả về trong `memptr`.
- Bộ nhớ được căn chỉnh theo bội số của `alignment`, giá trị này phải là bội số lũy thừa của hai của `sizeof(void *)` (4 hoặc 8 byte trên hầu hết các kiến trúc phần cứng).

Cũng cần lưu ý về giá trị trả về bất thường của hàm này — thay vì trả về –1 khi lỗi, nó trả về một mã lỗi (tức là một số nguyên dương thuộc kiểu thường được trả về trong `errno`).

Nếu `sizeof(void *)` là 4, thì chúng ta có thể sử dụng posix\_memalign() để cấp phát 65.536 byte bộ nhớ căn chỉnh trên ranh giới 4096 byte như sau:

```
int s;
void *memptr;
s = posix_memalign(&memptr, 1024 * sizeof(void *), 65536);
if (s != 0)
 /* Xử lý lỗi */
```

Các khối bộ nhớ được cấp phát bằng cách sử dụng memalign() hoặc posix\_memalign() nên được giải phóng bằng `free()`.

> Trên một số hệ triển khai UNIX, việc gọi `free()` trên một khối bộ nhớ được cấp phát thông qua memalign() là không khả thi, bởi vì việc triển khai memalign() sử dụng `malloc()` để cấp phát một khối bộ nhớ, sau đó trả về một con trỏ tới địa chỉ có độ căn chỉnh phù hợp trong khối đó. Việc triển khai memalign() của glibc không gặp phải hạn chế này.

## 7.2 Cấp phát bộ nhớ trên Stack: alloca()

Giống như các hàm trong gói malloc, alloca() cấp phát bộ nhớ một cách động (dynamically). Tuy nhiên, thay vì lấy bộ nhớ từ heap (`heap`), alloca() lấy bộ nhớ từ stack (`stack`) bằng cách tăng kích thước của khung stack (`stack frame`). Điều này có thể thực hiện được bởi vì hàm gọi chính là hàm mà khung stack của nó, theo định nghĩa, nằm ở đỉnh của stack (`top of the stack`). Do đó, có không gian phía trên khung để mở rộng, việc này có thể đạt được đơn giản bằng cách sửa đổi giá trị của con trỏ stack (`stack pointer`).

```c
## include <alloca.h>
void *alloca(size_t size);
                                  Trả về con trỏ đến khối bộ nhớ được cấp phát
```

Đối số `size` chỉ định số lượng byte cần cấp phát trên stack. Hàm alloca() trả về một con trỏ tới vùng nhớ được cấp phát làm kết quả của hàm.

Chúng ta không cần — thực ra là không được phép — gọi `free()` để giải phóng bộ nhớ được cấp phát bằng alloca(). Tương tự, không thể sử dụng `realloc()` để thay đổi kích thước của một khối bộ nhớ do alloca() cấp phát.

Mặc dù alloca() không phải là một phần của SUSv3, nó được cung cấp trên hầu hết các hệ triển khai UNIX và do đó có tính di động (portable) tương đối cao.

Các phiên bản cũ của glibc, và một số hệ triển khai UNIX khác (chủ yếu là các dẫn xuất từ BSD), yêu cầu bao gồm `<stdlib.h>` thay vì `<alloca.h>` để lấy khai báo của alloca().

Nếu stack bị tràn (overflow) do hậu quả của việc gọi alloca(), thì hành vi của chương trình sẽ không thể đoán trước được. Cụ thể, chúng ta không nhận được giá trị trả về `NULL` để thông báo lỗi. (Trên thực tế, trong hoàn cảnh này, chúng ta có thể nhận được tín hiệu `SIGSEGV`. Tham khảo Mục 21.3 để biết thêm chi tiết).

Lưu ý rằng chúng ta không thể sử dụng alloca() bên trong danh sách đối số của hàm, như trong ví dụ này:

```
func(x, alloca(size), z); /* SAI! */
```

Điều này là do không gian stack được cấp phát bởi alloca() sẽ nằm ở giữa không gian dành cho các đối số của hàm (được đặt ở các vị trí cố định trong khung stack). Thay vào đó, chúng ta phải sử dụng mã nguồn như thế này:

```
void *y;
y = alloca(size);
func(x, y, z);
```

Sử dụng alloca() để cấp phát bộ nhớ có một vài ưu điểm so với `malloc()`. Một trong số đó là việc cấp phát các khối bộ nhớ bằng alloca() nhanh hơn so với `malloc()`, bởi vì alloca() được trình biên dịch triển khai dưới dạng mã nội tuyến (`inline code`) trực tiếp điều chỉnh con trỏ stack. Hơn nữa, alloca() không cần duy trì một danh sách các khối trống (`free blocks`).

Một ưu điểm khác của `alloca()` là bộ nhớ mà nó cấp phát sẽ tự động được giải phóng khi khung ngăn xếp (stack frame) bị gỡ bỏ; cụ thể là khi hàm gọi `alloca()` trả về. Điều này xảy ra là do mã lệnh được thực thi trong quá trình hàm trả về sẽ thiết lập lại giá trị của thanh ghi con trỏ ngăn xếp (stack pointer register) về cuối của khung trước đó (tức là, giả sử ngăn xếp phát triển theo chiều hướng xuống, về địa chỉ nằm ngay phía trên điểm bắt đầu của khung hiện tại). Vì chúng ta không cần phải bận tâm đến việc đảm bảo bộ nhớ đã cấp phát được giải phóng trên tất cả các đường dẫn trả về (return path) của một hàm, việc lập trình một số hàm trở nên đơn giản hơn rất nhiều.

Sử dụng `alloca()` có thể đặc biệt hữu ích nếu chúng ta dùng `longjmp()` (Mục 6.8) hoặc `siglongjmp()` (Mục 21.2.1) để thực hiện một lệnh nhảy phi cục bộ (nonlocal goto) từ một trình xử lý tín hiệu (signal handler). Trong trường hợp này, việc tránh rò rỉ bộ nhớ (memory leak) là rất khó hoặc thậm chí bất khả thi nếu chúng ta cấp phát bộ nhớ trong các hàm bị nhảy qua bằng `malloc()`. Ngược lại, `alloca()` giải quyết triệt để vấn đề này, bởi vì khi ngăn xếp được cuộn mở (unwound) bởi các lời gọi này, bộ nhớ đã cấp phát sẽ tự động được giải phóng.

## 7.3 Tổng kết

Sử dụng các hàm thuộc họ `malloc`, một tiến trình (process) có thể cấp phát và giải phóng bộ nhớ động trên heap. Khi xem xét việc cài đặt các hàm này, chúng ta thấy rằng nhiều vấn đề khác nhau có thể xảy ra trong một chương trình xử lý sai các khối bộ nhớ được cấp phát, và chúng ta đã lưu ý rằng có một số công cụ gỡ lỗi (debugging tool) sẵn có để giúp định vị nguồn gốc của các lỗi đó.

Hàm `alloca()` cấp phát bộ nhớ trên ngăn xếp (stack). Bộ nhớ này sẽ tự động được thu hồi khi hàm gọi `alloca()` trả về.

## 7.4 Bài tập

- **7-1.** Chỉnh sửa chương trình trong [Liệt kê 7-1](#page-3-0) (`free_and_sbrk.c`) để in ra giá trị hiện tại của program break sau mỗi lần thực thi `malloc()`. Chạy chương trình với kích thước khối cấp phát nhỏ được chỉ định. Điều này sẽ chứng minh rằng `malloc()` không sử dụng `sbrk()` để điều chỉnh program break trên mỗi lời gọi, mà thay vào đó sẽ định kỳ cấp phát các khối bộ nhớ lớn hơn và từ đó phân chia các mảnh nhỏ trả về cho bên gọi.
- **7-2.** (Nâng cao) Tự cài đặt `malloc()` và `free()`.
