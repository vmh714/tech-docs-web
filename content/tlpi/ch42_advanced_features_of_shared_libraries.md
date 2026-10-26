## Chapter 42

## CÁC TÍNH NĂNG NÂNG CAO CỦA THƯ VIỆN DÙNG CHUNG

Chương trước đã trình bày các nguyên lý cơ bản của thư viện dùng chung (shared library). Chương này mô tả một số tính năng nâng cao của thư viện dùng chung, bao gồm các nội dung sau:

- tải động các thư viện dùng chung;
- kiểm soát khả năng hiển thị của các ký hiệu (symbol) được định nghĩa bởi một thư viện dùng chung;
- sử dụng các tập lệnh của trình liên kết (linker script) để tạo các ký hiệu có phiên bản (versioned symbol);
- sử dụng các hàm khởi tạo và kết thúc để tự động thực thi mã nguồn khi một thư viện được nạp và gỡ nạp;
- nạp trước thư viện dùng chung (shared library preloading); và
- sử dụng `LD_DEBUG` để giám sát hoạt động của trình liên kết động (dynamic linker).

## 42.1 Thư viện được tải động

Khi một tệp thực thi khởi động, trình liên kết động (dynamic linker) sẽ tải tất cả các thư viện dùng chung trong danh sách phụ thuộc động của chương trình. Tuy nhiên, đôi khi việc tải các thư viện vào một thời điểm trễ hơn lại rất hữu ích. Ví dụ, một tiện ích bổ sung (plug-in) chỉ được tải khi cần thiết. Chức năng này được cung cấp bởi một API cho trình liên kết động. API này, thường được gọi là dlopen API, có nguồn gốc từ hệ điều hành Solaris và phần lớn hiện đã được quy định trong chuẩn SUSv3.

Dlopen API cho phép một chương trình mở một thư viện dùng chung tại thời điểm chạy (run time), tìm kiếm một hàm theo tên trong thư viện đó, và sau đó gọi hàm đó. Một thư viện dùng chung được tải tại thời điểm chạy theo cách này thường được gọi là thư viện được tải động (dynamically loaded library), và được tạo ra giống như bất kỳ thư viện dùng chung nào khác.

Dlopen API cốt lõi bao gồm các hàm sau (tất cả đều được quy định trong SUSv3):

- Hàm `dlopen()` mở một thư viện dùng chung, trả về một định danh (handle) được sử dụng bởi các lời gọi tiếp theo.
- Hàm `dlsym()` tìm kiếm trong một thư viện một ký hiệu (một chuỗi chứa tên của một hàm hoặc biến) và trả về địa chỉ của nó.
- Hàm `dlclose()` đóng một thư viện đã được mở trước đó bởi `dlopen()`.
- Hàm `dlerror()` trả về một chuỗi thông báo lỗi, và được sử dụng sau khi có giá trị trả về báo lỗi từ một trong các hàm trước đó.

Bản cài đặt trong glibc cũng bao gồm một số hàm liên quan, một trong số đó được chúng tôi mô tả dưới đây.

Để biên dịch các chương trình sử dụng dlopen API trên Linux, chúng ta phải chỉ định tùy chọn `-ldl`, nhằm liên kết với thư viện `libdl`.

### 42.1.1 Mở một thư viện dùng chung: dlopen()

Hàm `dlopen()` tải thư viện dùng chung có tên trong `libfilename` vào không gian địa chỉ ảo (virtual address space) của tiến trình gọi và tăng bộ đếm số lượng tham chiếu đang mở tới thư viện đó.

```c
## include <dlfcn.h>
void *dlopen(const char *libfilename, int flags);
                              Trả về định danh thư viện khi thành công, hoặc NULL khi lỗi
```

Nếu `libfilename` chứa dấu gạch chéo (`/`), `dlopen()` sẽ hiểu đó là một đường dẫn tuyệt đối hoặc tương đối. Nếu không, trình liên kết động sẽ tìm kiếm thư viện dùng chung theo các quy tắc được mô tả trong Mục [41.11](#page-121-1).

Khi thành công, `dlopen()` trả về một định danh (handle) có thể được sử dụng để tham chiếu đến thư viện trong các lời gọi tiếp theo đến các hàm trong dlopen API. Nếu có lỗi xảy ra (ví dụ: không tìm thấy thư viện), `dlopen()` trả về `NULL`.

Nếu thư viện dùng chung được chỉ định bởi `libfilename` có chứa các sự phụ thuộc vào các thư viện dùng chung khác, `dlopen()` cũng sẽ tự động tải các thư viện đó. Quá trình này diễn ra đệ quy nếu cần thiết. Chúng ta gọi tập hợp các thư viện được tải như vậy là cây phụ thuộc (dependency tree) của thư viện này.

Có thể gọi `dlopen()` nhiều lần trên cùng một tệp thư viện. Thư viện chỉ được tải vào bộ nhớ một lần (bởi lời gọi ban đầu) và tất cả các lời gọi đều trả về cùng một giá trị định danh. Tuy nhiên, dlopen API duy trì một bộ đếm tham chiếu (reference count) cho mỗi định danh thư viện. Bộ đếm này được tăng lên bởi mỗi lời gọi `dlopen()` và giảm đi bởi mỗi lời gọi `dlclose()`; chỉ khi bộ đếm về đến 0 thì `dlclose()` mới gỡ nạp thư viện khỏi bộ nhớ.

Tham số `flags` là một mặt nạ bit (bit mask) bắt buộc phải bao gồm chính xác một trong các hằng số `RTLD_LAZY` hoặc `RTLD_NOW`, với các ý nghĩa sau:

### RTLD_LAZY

Các ký hiệu hàm chưa được định nghĩa trong thư viện sẽ chỉ được phân giải (resolve) khi mã nguồn được thực thi. Nếu một đoạn mã yêu cầu một ký hiệu cụ thể không được thực thi, ký hiệu đó sẽ không bao giờ được phân giải. Việc phân giải lười (lazy resolution) chỉ được thực hiện cho các tham chiếu hàm; các tham chiếu đến biến luôn được phân giải ngay lập tức. Việc chỉ định cờ `RTLD_LAZY` cung cấp hành vi tương ứng với hoạt động bình thường của trình liên kết động khi tải các thư viện dùng chung được xác định trong danh sách phụ thuộc động của tệp thực thi.

### RTLD_NOW

Tất cả các ký hiệu chưa được định nghĩa trong thư viện phải được phân giải ngay lập tức trước khi `dlopen()` hoàn tất, bất kể chúng có cần thiết hay không. Hệ quả là việc mở thư viện sẽ chậm hơn, nhưng bất kỳ lỗi ký hiệu hàm chưa được định nghĩa tiềm ẩn nào cũng sẽ được phát hiện ngay lập tức thay vì tại một thời điểm nào đó sau đó. Điều này có thể hữu ích khi gỡ lỗi (debug) một ứng dụng, hoặc đơn giản là để đảm bảo rằng ứng dụng thất bại ngay lập tức đối với một ký hiệu chưa được phân giải, thay vì chỉ làm điều đó sau khi đã chạy trong một thời gian dài.

Bằng cách thiết lập biến môi trường `LD_BIND_NOW` thành một chuỗi không rỗng, chúng ta có thể ép bộ liên kết động (dynamic linker) phân giải ngay lập tức mọi ký hiệu (symbol) (tức là giống như `RTLD_NOW`) khi tải các thư viện chia sẻ (shared library) được xác định trong danh sách phụ thuộc động của một tệp thực thi. Biến môi trường này có hiệu lực từ glibc 2.1.1 trở đi. Việc thiết lập `LD_BIND_NOW` sẽ ghi đè lên hiệu ứng của cờ `RTLD_LAZY` trong hàm `dlopen()`.

Chúng ta cũng có thể bao gồm các giá trị bổ sung trong tham số `flags`. Các cờ sau được chỉ định trong SUSv3:

### `RTLD_GLOBAL`

Các ký hiệu trong thư viện này và cây phụ thuộc của nó sẽ có sẵn để phân giải các tham chiếu trong các thư viện khác được tải bởi tiến trình (process) này, đồng thời cho phép tra cứu thông qua `dlsym()`.

### `RTLD_LOCAL`

Đây là trạng thái ngược lại của `RTLD_GLOBAL` và là mặc định nếu không có hằng số nào được chỉ định. Nó chỉ định rằng các ký hiệu trong thư viện này và cây phụ thuộc của nó không có sẵn để phân giải các tham chiếu trong các thư viện được tải sau đó.

SUSv3 không quy định một giá trị mặc định nếu không có `RTLD_GLOBAL` hay `RTLD_LOCAL` nào được chỉ định. Hầu hết các triển khai UNIX đều giả định cùng một giá trị mặc định (`RTLD_LOCAL`) như Linux, nhưng một số ít lại giả định mặc định là `RTLD_GLOBAL`.

Linux cũng hỗ trợ một số cờ không được quy định trong SUSv3:

### `RTLD_NODELETE` (từ glibc 2.2)

Không gỡ tải (unload) thư viện trong quá trình gọi `dlclose()`, ngay cả khi bộ đếm tham chiếu (reference count) giảm xuống 0. Điều này có nghĩa là các biến tĩnh (static variable) của thư viện sẽ không được khởi tạo lại nếu thư viện sau đó được tải lại bằng `dlopen()`. (Chúng ta có thể đạt được hiệu quả tương tự đối với các thư viện được tải tự động bởi bộ liên kết động bằng cách chỉ định tùy chọn `-Wl,-znodelete` của gcc khi tạo thư viện).

### `RTLD_NOLOAD` (từ glibc 2.2)

Không tải thư viện. Điều này phục vụ hai mục đích. Đầu tiên, chúng ta có thể sử dụng cờ này để kiểm tra xem một thư viện cụ thể hiện có đang được tải như một phần của không gian địa chỉ (address space) của tiến trình hay không. Nếu có, `dlopen()` trả về handle của thư viện; nếu không, `dlopen()` trả về `NULL`. Thứ hai, chúng ta có thể sử dụng cờ này để "nâng cấp" các cờ của một thư viện đã được tải trước đó. Ví dụ, chúng ta có thể chỉ định `RTLD_NOLOAD | RTLD_GLOBAL` trong `flags` khi sử dụng `dlopen()` trên một thư viện trước đó đã được mở với cờ `RTLD_LOCAL`.

### `RTLD_DEEPBIND` (từ glibc 2.3.4)

Khi phân giải các tham chiếu ký hiệu được thực hiện bởi thư viện này, hãy tìm kiếm các định nghĩa bên trong thư viện trước khi tìm kiếm các định nghĩa trong các thư viện đã được tải trước đó. Điều này cho phép một thư viện tự chứa (self-contained), ưu tiên sử dụng các định nghĩa ký hiệu của chính nó thay vì các ký hiệu toàn cục có cùng tên được định nghĩa ở các thư viện chia sẻ khác đã được tải trước đó. (Điều này tương tự với hiệu ứng của tùy chọn bộ liên kết `-Bsymbolic` được mô tả trong Mục [41.12.](#page-121-2))

Các cờ `RTLD_NODELETE` và `RTLD_NOLOAD` cũng được triển khai trong API `dlopen` của Solaris, nhưng có sẵn trên rất ít các triển khai UNIX khác. Cờ `RTLD_DEEPBIND` là đặc thù của Linux (Linux-specific).

Như một trường hợp đặc biệt, chúng ta có thể chỉ định `libfilename` là `NULL`. Điều này khiến `dlopen()` trả về một handle cho chương trình chính. (SUSv3 gọi đây là handle cho "đối tượng ký hiệu toàn cục" - global symbol object). Việc chỉ định handle này trong lệnh gọi tiếp theo tới `dlsym()` sẽ khiến ký hiệu được yêu cầu được tìm kiếm trong chương trình chính, tiếp theo là tất cả các thư viện chia sẻ được tải khi khởi động chương trình, và sau đó là tất cả các thư viện được tải động với cờ `RTLD_GLOBAL`.

### 42.1.2 Chẩn đoán lỗi: dlerror()

Nếu chúng ta nhận được mã lỗi trả về từ `dlopen()` hoặc một hàm khác trong API `dlopen`, chúng ta có thể sử dụng `dlerror()` để lấy một con trỏ (pointer) trỏ đến chuỗi ký tự cho biết nguyên nhân gây ra lỗi.

```c
## include <dlfcn.h>
const char *dlerror(void);
                              Trả về con trỏ trỏ đến chuỗi chẩn đoán lỗi, hoặc NULL nếu
                             không có lỗi nào xảy ra kể từ lần gọi dlerror() trước đó
```

Hàm `dlerror()` trả về `NULL` nếu không có lỗi nào xảy ra kể từ lần gọi `dlerror()` cuối cùng. Chúng ta sẽ thấy tính năng này hữu ích như thế nào trong phần tiếp theo.

### 42.1.3 Lấy địa chỉ của một Symbol: dlsym()

Hàm `dlsym()` tìm kiếm `symbol` được chỉ định (một hàm hoặc biến) trong thư viện được tham chiếu bởi `handle` và trong các thư viện nằm trên cây phụ thuộc (dependency tree) của thư viện đó.

```c
## include <dlfcn.h>
void *dlsym(void *handle, char *symbol);
                          Trả về địa chỉ của symbol, hoặc NULL nếu không tìm thấy symbol
```

Nếu tìm thấy `symbol`, `dlsym()` sẽ trả về địa chỉ của nó; ngược lại, `dlsym()` trả về `NULL`. Đối số `handle` thông thường là một handle thư viện (library handle) được trả về bởi lần gọi `dlopen()` trước đó. Ngoài ra, nó cũng có thể là một trong các giả handle (pseudohandle) được mô tả bên dưới.

> Một hàm liên quan là `dlvsym(handle, symbol, version)`, có điểm tương đồng với `dlsym()`, nhưng có thể được sử dụng để tìm kiếm trong một thư viện có phiên bản symbol (symbol-versioned library) nhằm lấy định nghĩa của symbol có phiên bản khớp với chuỗi được chỉ định trong `version`. (Chúng ta sẽ mô tả về phiên bản symbol trong Mục [42.3.2](#page-137-0)). Macro kiểm tra tính năng `_GNU_SOURCE` phải được định nghĩa để có thể lấy được khai báo của hàm này từ `<dlfcn.h>`.

Giá trị của một `symbol` do `dlsym()` trả về có thể là `NULL`, điều này không thể phân biệt được với giá trị trả về khi "không tìm thấy symbol". Để phân biệt hai khả năng này, chúng ta phải gọi `dlerror()` trước đó (để đảm bảo rằng bất kỳ chuỗi lỗi nào được lưu giữ trước đó đã bị xóa) và sau đó, nếu sau lệnh gọi `dlsym()`, hàm `dlerror()` trả về một giá trị khác `NULL` (`non-NULL`), chúng ta biết rằng đã xảy ra lỗi.

Nếu `symbol` là tên của một biến, thì chúng ta có thể gán giá trị trả về của `dlsym()` cho một kiểu con trỏ thích hợp, và lấy giá trị của biến đó bằng cách giải tham chiếu (dereference) con trỏ:

```c
int *ip;
ip = (int *) dlsym(symbol, "myvar");
if (ip != NULL)
 printf("Value is %d\n", *ip);
```

Nếu `symbol` là tên của một hàm, thì con trỏ được trả về bởi `dlsym()` có thể được sử dụng để gọi hàm đó. Chúng ta có thể lưu trữ giá trị do `dlsym()` trả về trong một con trỏ có kiểu thích hợp, chẳng hạn như:

```c
int (*funcp)(int); /* Con trỏ trỏ đến một hàm nhận một đối số
 kiểu số nguyên và trả về một số nguyên */
```

Tuy nhiên, chúng ta không thể đơn giản gán kết quả của `dlsym()` cho một con trỏ như vậy, giống như ví dụ sau:

```c
funcp = dlsym(handle, symbol);
```

Lý do là tiêu chuẩn C99 cấm việc gán giữa một con trỏ hàm (function pointer) và `void *`. Giải pháp là sử dụng phép ép kiểu (có phần cồng kềnh) sau đây:

```c
*(void **) (&funcp) = dlsym(handle, symbol);
```

Sau khi sử dụng `dlsym()` để lấy con trỏ trỏ đến hàm, chúng ta có thể gọi hàm đó bằng cú pháp C thông thường để giải tham chiếu con trỏ hàm:

```c
res = (*funcp)(somearg);
```

Thay vì sử dụng cú pháp `*(void **)` được hiển thị ở trên, người ta có thể cân nhắc việc sử dụng đoạn mã có vẻ tương đương sau đây khi gán giá trị trả về của `dlsym()`:

```c
(void *) funcp = dlsym(handle, symbol);
```

Tuy nhiên, đối với đoạn mã này, `gcc –pedantic` sẽ đưa ra cảnh báo rằng "ANSI C cấm sử dụng các biểu thức ép kiểu làm v-value (lvalue)." Cú pháp `*(void **)` không gây ra cảnh báo này vì chúng ta đang gán giá trị cho một địa chỉ được trỏ tới bởi lvalue của phép gán.

Trên nhiều cài đặt UNIX, chúng ta có thể sử dụng các phép ép kiểu như sau để loại bỏ các cảnh báo từ trình biên dịch C (C compiler):

```c
funcp = (int (*) (int)) dlsym(handle, symbol);
```

Tuy nhiên, bản đặc tả của `dlsym()` trong SUSv3 Technical Corrigendum Number 1 lưu ý rằng tiêu chuẩn C99 vẫn yêu cầu các trình biên dịch phải tạo ra cảnh báo cho một phép chuyển đổi kiểu như vậy, đồng thời đề xuất sử dụng cú pháp `*(void **)` đã nêu ở trên.

> SUSv3 TC1 lưu ý rằng do nhu cầu sử dụng cú pháp `*(void **)`, một phiên bản tương lai của tiêu chuẩn có thể sẽ định nghĩa các API dạng `dlsym()` riêng biệt để xử lý con trỏ dữ liệu và con trỏ hàm. Tuy nhiên, SUSv4 không chứa bất kỳ thay đổi nào liên quan đến điểm này.

### Sử dụng các pseudohandle của thư viện với dlsym()

Thay vì chỉ định một handle thư viện (library handle) được trả về bởi lời gọi `dlopen()`, ta có thể sử dụng một trong các pseudohandle sau làm đối số `handle` cho hàm `dlsym()`:

RTLD\_DEFAULT

Tìm kiếm ký hiệu (symbol) bắt đầu từ chương trình chính (main program), sau đó tiếp tục lần lượt qua danh sách tất cả các thư viện liên kết chung (shared libraries) đã được nạp, bao gồm cả các thư viện được nạp động bởi `dlopen()` với cờ `RTLD\_GLOBAL`. Điều này tương ứng với mô hình tìm kiếm mặc định được sử dụng bởi trình liên kết động (dynamic linker).

RTLD\_NEXT

Tìm kiếm ký hiệu trong các thư viện liên kết chung được nạp sau thư viện gọi hàm `dlsym()`. Điều này rất hữu ích khi tạo một hàm bao (wrapper function) có cùng tên với một hàm được định nghĩa ở nơi khác. Ví dụ, trong chương trình chính, chúng ta có thể định nghĩa phiên bản `malloc()` của riêng mình (có thể thực hiện một số việc ghi chép sổ sách về cấp phát bộ nhớ), và hàm này có thể gọi hàm `malloc()` thực sự bằng cách lấy địa chỉ của nó thông qua lời gọi `func = dlsym(RTLD\_NEXT, "malloc")`.

Các giá trị pseudohandle được liệt kê ở trên không bắt buộc bởi chuẩn SUSv3 (mặc dù chuẩn này vẫn dành riêng chúng để sử dụng trong tương lai) và không có sẵn trên tất cả các hệ triển khai UNIX. Để lấy được định nghĩa của các hằng số này từ `<dlfcn.h>`, chúng ta phải định nghĩa macro kiểm tra tính năng `_GNU_SOURCE`.

### Chương trình ví dụ

[Liệt kê 42-1](#page-132-0) minh họa việc sử dụng API `dlopen`. Chương trình này nhận hai đối số dòng lệnh (command-line arguments): tên của một thư viện liên kết chung cần nạp và tên của một hàm cần thực thi bên trong thư viện đó. Các ví dụ sau đây minh họa cách sử dụng chương trình này:

```
$ ./dynload ./libdemo.so.1 x1
Called mod1-x1
```

```
$ LD_LIBRARY_PATH=. ./dynload libdemo.so.1 x1
Called mod1-x1
```

Trong lệnh đầu tiên ở trên, `dlopen()` nhận thấy đường dẫn thư viện có chứa dấu gạch chéo và do đó hiểu nó là một đường dẫn tương đối (trong trường hợp này là đến một thư viện trong thư mục làm việc hiện tại). Trong lệnh thứ hai, chúng ta chỉ định một đường dẫn tìm kiếm thư viện trong `LD\_LIBRARY\_PATH`. Đường dẫn tìm kiếm này được diễn giải theo các quy tắc thông thường của trình liên kết động (trong trường hợp này, cũng dùng để tìm thư viện trong thư mục làm việc hiện tại).

**Liệt kê 42-1:** Sử dụng API `dlopen`

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– shlibs/dynload.c
## include <dlfcn.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 void *libHandle; /* Handle cho thư viện liên kết chung */
 void (*funcp)(void); /* Con trỏ hàm không có đối số */
 const char *err;
 if (argc != 3 || strcmp(argv[1], "--help") == 0)
 usageErr("%s lib-path func-name\n", argv[0]);
 /* Nạp thư viện liên kết chung và lấy handle để sử dụng sau */
 libHandle = dlopen(argv[1], RTLD_LAZY);
 if (libHandle == NULL)
 fatal("dlopen: %s", dlerror());
 /* Tìm kiếm trong thư viện ký hiệu được chỉ định trong argv[2] */
 (void) dlerror(); /* Xóa lỗi dlerror() */
 *(void **) (&funcp) = dlsym(libHandle, argv[2]);
 err = dlerror();
 if (err != NULL)
 fatal("dlsym: %s", err);
 /* Nếu địa chỉ trả về bởi dlsym() khác NULL, thử gọi nó
 như một hàm không có đối số */
 if (funcp == NULL)
 printf("%s is NULL\n", argv[2]);
 else
 (*funcp)();
 dlclose(libHandle); /* Đóng thư viện */
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– shlibs/dynload.c
```

### 42.1.4 Đóng Thư viện Chia sẻ (Shared Library): dlclose()

Hàm `dlclose()` dùng để đóng một thư viện.

```
## include <dlfcn.h>
int dlclose(void *handle);
                                             Trả về 0 khi thành công, hoặc –1 khi lỗi
```

Hàm `dlclose()` giảm bộ đếm tham chiếu mở (open reference counter) của hệ thống đối với thư viện được trỏ tới bởi `handle`. Nếu bộ đếm tham chiếu này giảm về 0, và không có ký hiệu (symbol) nào trong thư viện bị yêu cầu bởi các thư viện khác, thì thư viện đó sẽ được gỡ tải (unloaded). Quy trình này cũng được thực hiện (một cách đệ quy) đối với các thư viện nằm trong cây phụ thuộc (dependency tree) của thư viện này. Một lệnh `dlclose()` ẩn (implicit) đối với tất cả các thư viện sẽ được thực thi khi tiến trình (process) kết thúc.

> Từ glibc 2.2.3 trở đi, một hàm bên trong thư viện chia sẻ (shared library) có thể sử dụng `atexit()` (hoặc `on_exit()`) để thiết lập một hàm được gọi tự động khi thư viện đó bị gỡ tải.

### 42.1.5 Lấy Thông tin Về các Ký hiệu Đã tải: dladdr()

Cho một địa chỉ trong `addr` (thường là địa chỉ lấy được từ lời gọi `dlsym()` trước đó), hàm `dladdr()` trả về một cấu trúc chứa thông tin về địa chỉ đó.

```
## define _GNU_SOURCE
## include <dlfcn.h>
int dladdr(const void *addr, Dl_info *info);
        Trả về giá trị khác 0 nếu tìm thấy addr trong thư viện chia sẻ, ngược lại trả về 0
```

Đối số `info` là một con trỏ trỏ đến cấu trúc do hàm gọi phân bổ, có dạng như sau:

```
typedef struct {
 const char *dli_fname; /* Đường dẫn của thư viện chia sẻ
 chứa 'addr' */
 void *dli_fbase; /* Địa chỉ cơ sở (base address) mà tại đó 
 thư viện chia sẻ được tải */
 const char *dli_sname; /* Tên của ký hiệu thời gian chạy (run-time symbol) 
 gần nhất có địa chỉ <= 'addr' */
 void *dli_saddr; /* Giá trị thực tế của ký hiệu
 được trả về trong 'dli_sname' */
} Dl_info;
```

Hai trường đầu tiên của cấu trúc `Dl_info` chỉ định đường dẫn và địa chỉ cơ sở thời gian chạy của thư viện chia sẻ chứa địa chỉ được chỉ định trong `addr`. Hai trường cuối cùng trả về thông tin về địa chỉ đó. Giả sử rằng `addr` trỏ đến chính xác địa chỉ của một ký hiệu trong thư viện chia sẻ, thì `dli_saddr` trả về giá trị giống như giá trị được truyền vào `addr`.

SUSv3 không quy định hàm `dladdr()`, và hàm này không khả dụng trên tất cả các hệ thống cài đặt UNIX.

### 42.1.6 Truy cập Ký hiệu trong Chương trình Chính

Giả sử rằng chúng ta sử dụng `dlopen()` để tải động một thư viện chia sẻ, sử dụng `dlsym()` để lấy địa chỉ của một hàm `x()` từ thư viện đó, và sau đó gọi `x()`. Nếu `x()` lại gọi tiếp một hàm `y()`, thì thông thường `y()` sẽ được tìm kiếm trong một trong các thư viện chia sẻ được tải bởi chương trình.

Đôi khi, thay vào đó, chúng ta lại muốn `x()` gọi một cài đặt của `y()` nằm trong chương trình chính. (Việc này tương tự như cơ chế callback). Để làm được điều này, chúng ta phải làm cho các ký hiệu (ở phạm vi toàn cục - global-scope) trong chương trình chính khả dụng đối với bộ liên kết động (dynamic linker), bằng cách liên kết chương trình sử dụng tùy chọn bộ liên kết `--export-dynamic`:

```
$ gcc -Wl,--export-dynamic main.c (cùng với các tùy chọn và đối số khác)
```

Tương tự, chúng ta có thể viết như sau:

```
$ gcc -export-dynamic main.c
```

Việc sử dụng một trong các tùy chọn này cho phép một thư viện được tải động có thể truy cập các ký hiệu toàn cục trong chương trình chính.

> Tùy chọn `gcc -rdynamic` và tùy chọn `gcc -Wl,-E` là các từ đồng nghĩa khác cho `Wl,--export-dynamic`.

## 42.2 Kiểm soát Khả năng Hiển thị của Ký hiệu (Symbol Visibility)

Một thư viện chia sẻ được thiết kế tốt chỉ nên hiển thị những ký hiệu (hàm và biến) tạo thành một phần giao diện nhị phân ứng dụng (application binary interface - ABI) được chỉ định của nó. Lý do cho việc này như sau:

- Nếu nhà thiết kế thư viện chia sẻ vô tình xuất ra các giao diện không được chỉ định, thì các lập trình viên viết ứng dụng sử dụng thư viện có thể chọn sử dụng các giao diện này. Điều này tạo ra vấn đề tương thích cho các bản nâng cấp tiếp theo của thư viện chia sẻ. Nhà phát triển thư viện kỳ vọng có thể thay đổi hoặc loại bỏ bất kỳ giao diện nào ngoài ABI đã được tài liệu hóa, trong khi người dùng thư viện lại mong muốn tiếp tục sử dụng các giao diện đó (với cùng ngữ nghĩa) mà họ đang dùng.
- Trong quá trình phân giải ký hiệu thời gian chạy (run-time symbol resolution), bất kỳ ký hiệu nào được xuất ra bởi thư viện chia sẻ đều có thể xen vào (interpose) các định nghĩa được cung cấp ở các thư viện chia sẻ khác (Mục [41.12](#page-121-2)).
- Việc xuất các ký hiệu không cần thiết làm tăng kích thước của bảng ký hiệu động (dynamic symbol table) phải được tải vào thời gian chạy.

Tất cả các vấn đề này có thể được giảm thiểu hoặc tránh hoàn toàn nếu nhà thiết kế thư viện đảm bảo rằng chỉ những ký hiệu được yêu cầu bởi ABI đã chỉ định của thư viện mới được xuất ra. Các kỹ thuật sau đây có thể được sử dụng để kiểm soát việc xuất ký hiệu:

Trong chương trình C, chúng ta có thể sử dụng từ khóa `static` để biến một ký hiệu thành riêng tư (private) đối với một mô-đun mã nguồn, qua đó làm cho nó không khả dụng để liên kết bởi các tệp đối tượng (object file) khác.

Bên cạnh việc làm cho ký hiệu trở thành riêng tư đối với một mô-đun mã nguồn, từ khóa `static` còn có một tác dụng ngược lại. Nếu một ký hiệu được đánh dấu là `static`, thì mọi tham chiếu đến ký hiệu đó trong cùng một tệp nguồn sẽ được liên kết với định nghĩa đó của ký hiệu. Do đó, các tham chiếu này sẽ không chịu sự chi phối bởi việc xen vào thời gian chạy (run-time interposition) từ các định nghĩa của các thư viện chia sẻ khác (theo cách đã mô tả ở Mục [41.12](#page-121-2)). Tác dụng này của từ khóa `static` tương tự như tùy chọn bộ liên kết `-Bsymbolic` được mô tả ở Mục [41.12](#page-121-2), với điểm khác biệt là từ khóa `static` ảnh hưởng đến một ký hiệu đơn lẻ bên trong một tệp nguồn đơn lẻ.

Trình biên dịch GNU C (`gcc`) cung cấp một khai báo thuộc tính đặc trưng cho trình biên dịch (compiler-specific attribute declaration) thực hiện tác vụ tương tự như từ khóa `static`:

```
void
__attribute__ ((visibility("hidden")))
func(void) {
 /* Code */
}
```

Trong khi từ khóa `static` giới hạn khả năng hiển thị của một ký hiệu (symbol) trong phạm vi một tệp mã nguồn duy nhất, thuộc tính `hidden` làm cho ký hiệu đó có sẵn trên tất cả các tệp mã nguồn cấu thành nên thư viện chia sẻ (shared library), nhưng ngăn không cho nó hiển thị bên ngoài thư viện đó.

> Giống như từ khóa `static`, thuộc tính `hidden` cũng mang lại hiệu quả ngược lại là ngăn chặn việc chèn ép ký hiệu (symbol interposition) tại thời điểm chạy (run time).

- Các script phiên bản (Version scripts - Mục [42.3](#page-135-0)) có thể được sử dụng để kiểm soát chính xác khả năng hiển thị của ký hiệu và lựa chọn phiên bản của ký hiệu mà một tham chiếu được liên kết (bound).
- Khi tải động một thư viện chia sẻ (shared library) (Mục [42.1.1](#page-127-0)), cờ `dlopen() RTLD_GLOBAL` có thể được sử dụng để chỉ định rằng các ký hiệu được định nghĩa bởi thư viện nên được cung cấp để liên kết bởi các thư viện được tải sau đó, và tùy chọn trình liên kết `--export-dynamic` (Mục [42.1.6](#page-134-0)) có thể được sử dụng để làm cho các ký hiệu toàn cục (global symbols) của chương trình chính khả dụng đối với các thư viện được tải động.

Để biết thêm chi tiết về chủ đề khả năng hiển thị của ký hiệu (symbol visibility), hãy xem [Drepper, 2004 (b)].

## 42.3 Script Phiên bản Trình liên kết (Linker Version Scripts)

Một script phiên bản là một tệp văn bản chứa các hướng dẫn cho trình liên kết (`ld`). Để sử dụng một script phiên bản, chúng ta phải chỉ định tùy chọn trình liên kết `--version-script`:

```
$ gcc -Wl,--version-script,myscriptfile.map ...
```

Các script phiên bản thường (nhưng không phải luôn luôn) được nhận diện bằng phần mở rộng `.map`. Các phần sau đây mô tả một số công dụng của script phiên bản.

### 42.3.1 Kiểm soát Khả năng Hiển thị Ký hiệu bằng Script Phiên bản (Controlling Symbol Visibility with Version Scripts)

Một công dụng của script phiên bản là kiểm soát khả năng hiển thị của các ký hiệu mà nếu không có nó, các ký hiệu đó có thể vô tình trở thành toàn cục (global) (tức là hiển thị đối với các ứng dụng liên kết với thư viện). Làm một ví dụ đơn giản, giả sử rằng chúng ta đang xây dựng một thư viện chia sẻ (shared library) từ ba tệp mã nguồn `vis_comm.c`, `vis_f1.c` và `vis_f2.c`, lần lượt định nghĩa các hàm `vis_comm()`, `vis_f1()` và `vis_f2()`. Hàm `vis_comm()` được gọi bởi `vis_f1()` và `vis_f2()`, nhưng không dành cho các ứng dụng liên kết với thư viện sử dụng trực tiếp. Giả sử chúng ta xây dựng thư viện chia sẻ theo cách thông thường:

```
$ gcc -g -c -fPIC -Wall vis_comm.c vis_f1.c vis_f2.c
$ gcc -g -shared -o vis.so vis_comm.o vis_f1.o vis_f2.o
```

Nếu chúng ta sử dụng lệnh `readelf` sau để liệt kê các ký hiệu động (dynamic symbols) được xuất ra bởi thư viện, chúng ta sẽ thấy kết quả sau:

```
$ readelf --syms --use-dynamic vis.so | grep vis_
 30 12: 00000790 59 FUNC GLOBAL DEFAULT 10 vis_f1
 25 13: 000007d0 73 FUNC GLOBAL DEFAULT 10 vis_f2
 27 16: 00000770 20 FUNC GLOBAL DEFAULT 10 vis_comm
```

Thư viện chia sẻ này xuất ra ba ký hiệu: `vis_comm()`, `vis_f1()` và `vis_f2()`. Tuy nhiên, chúng ta muốn đảm bảo rằng chỉ có các ký hiệu `vis_f1()` và `vis_f2()` được xuất ra bởi thư viện. Chúng ta có thể đạt được kết quả này bằng cách sử dụng script phiên bản sau:

```
$ cat vis.map
VER_1 {
 global:
 vis_f1;
 vis_f2;
 local:
 *;
};
```

Định danh `VER_1` là một ví dụ về thẻ phiên bản (version tag). Như chúng ta sẽ thấy trong phần thảo luận về phiên bản hóa ký hiệu (symbol versioning) ở Mục [42.3.2](#page-137-0), một script phiên bản có thể chứa nhiều nút phiên bản (version nodes), mỗi nút được nhóm trong các dấu ngoặc nhọn (`{}`) và có tiền tố là một thẻ phiên bản duy nhất. Nếu chúng ta chỉ sử dụng script phiên bản với mục đích kiểm soát khả năng hiển thị của ký hiệu, thì thẻ phiên bản là dư thừa; tuy nhiên, các phiên bản cũ của `ld` vẫn yêu cầu nó. Các phiên bản hiện đại của `ld` cho phép bỏ qua thẻ phiên bản; trong trường hợp này, nút phiên bản được gọi là có thẻ phiên bản ẩn danh (anonymous version tag) và không được phép có các nút phiên bản nào khác trong script.

Bên trong nút phiên bản, từ khóa `global` bắt đầu một danh sách các ký hiệu được phân tách bằng dấu chấm phẩy, những ký hiệu này sẽ được hiển thị ra bên ngoài thư viện. Từ khóa `local` bắt đầu một danh sách các ký hiệu sẽ bị ẩn khỏi thế giới bên ngoài. Dấu hoa thị (`*`) ở đây minh họa thực tế rằng chúng ta có thể sử dụng các mẫu ký tự đại diện (wildcard patterns) trong các thông số kỹ thuật ký hiệu này. Các ký tự đại diện giống với các ký tự được sử dụng để khớp tên tệp của shell—ví dụ: `*` và `?`. (Xem trang hướng dẫn thủ công `glob(7)` để biết thêm chi tiết). Trong ví dụ này, việc sử dụng dấu hoa thị cho thông số kỹ thuật `local` có nghĩa là mọi thứ không được khai báo rõ là `global` đều sẽ bị ẩn đi. Nếu chúng ta không làm điều này, thì `vis_comm()` sẽ vẫn hiển thị, vì mặc định là làm cho các ký hiệu C toàn cục (global C symbols) hiển thị bên ngoài thư viện chia sẻ (shared library).

Sau đó, chúng ta có thể xây dựng thư viện chia sẻ của mình bằng cách sử dụng script phiên bản như sau:

```
$ gcc -g -c -fPIC -Wall vis_comm.c vis_f1.c vis_f2.c
$ gcc -g -shared -o vis.so vis_comm.o vis_f1.o vis_f2.o \
 -Wl,--version-script,vis.map
```

Sử dụng `readelf` một lần nữa cho thấy rằng `vis_comm()` không còn hiển thị ra bên ngoài nữa:

```
$ readelf --syms --use-dynamic vis.so | grep vis_
 25 0: 00000730 73 FUNC GLOBAL DEFAULT 11 vis_f2
 29 16: 000006f0 59 FUNC GLOBAL DEFAULT 11 vis_f1
```

### 42.3.2 Quản lý Phiên bản Ký hiệu (Symbol Versioning)

Quản lý phiên bản ký hiệu (symbol versioning) cho phép một thư viện chia sẻ (shared library) duy nhất cung cấp nhiều phiên bản của cùng một hàm (function). Mỗi chương trình sử dụng phiên bản hàm tương ứng tại thời điểm chương trình được liên kết tĩnh (statically linked) với thư viện chia sẻ đó. Kết quả là, chúng ta có thể thực hiện một thay đổi không tương thích (incompatible change) đối với thư viện chia sẻ mà không cần tăng số hiệu phiên bản chính (major version number) của thư viện. Nếu đẩy lên cực đoan, quản lý phiên bản ký hiệu có thể thay thế mô hình quản lý phiên bản chính và phụ truyền thống của thư viện chia sẻ. Quản lý phiên bản ký hiệu được sử dụng theo cách này trong glibc 2.1 trở lên, sao cho tất cả các phiên bản glibc từ 2.0 trở đi đều được hỗ trợ bên trong một phiên bản thư viện chính duy nhất (`libc.so.6`).

Chúng ta minh họa việc sử dụng quản lý phiên bản ký hiệu bằng một ví dụ đơn giản. Chúng ta bắt đầu bằng cách tạo phiên bản đầu tiên của một thư viện chia sẻ sử dụng một tập lệnh phiên bản (version script):

```
$ cat sv_lib_v1.c
## include <stdio.h>
void xyz(void) { printf("v1 xyz\n"); }
$ cat sv_v1.map
VER_1 {
 global: xyz;
 local: *; # Hide all other symbols
};
$ gcc -g -c -fPIC -Wall sv_lib_v1.c
$ gcc -g -shared -o libsv.so sv_lib_v1.o -Wl,--version-script,sv_v1.map
```

Trong tập lệnh phiên bản (version script), ký tự thăng (#) bắt đầu một chú thích (comment).

(Để giữ cho ví dụ đơn giản, chúng ta tránh sử dụng các tên soname thư viện tường minh và số hiệu phiên bản chính của thư viện.)

Ở giai đoạn này, tập lệnh phiên bản của chúng ta, `sv_v1.map`, chỉ đóng vai trò kiểm soát khả năng hiển thị (visibility) các ký hiệu (symbol) của thư viện chia sẻ; `xyz()` được xuất (export), nhưng tất cả các ký hiệu khác (trong ví dụ nhỏ này không có ký hiệu nào khác) đều bị ẩn đi. Tiếp theo, chúng ta tạo một chương trình `p1`, sử dụng thư viện này:

```
$ cat sv_prog.c
## include <stdlib.h>
int
main(int argc, char *argv[])
{
 void xyz(void);
 xyz();
 exit(EXIT_SUCCESS);
}
$ gcc -g -o p1 sv_prog.c libsv.so
```

Khi chạy chương trình này, chúng ta thu được kết quả mong đợi:

```
$ LD_LIBRARY_PATH=. ./p1
v1 xyz
```

Bây giờ, giả sử chúng ta muốn sửa đổi định nghĩa của `xyz()` bên trong thư viện của mình, đồng thời vẫn đảm bảo rằng chương trình `p1` tiếp tục sử dụng phiên bản cũ của hàm này. Để làm điều này, chúng ta phải định nghĩa hai phiên bản của `xyz()` bên trong thư viện của mình:

```
$ cat sv_lib_v2.c
## include <stdio.h>
__asm__(".symver xyz_old,xyz@VER_1");
__asm__(".symver xyz_new,xyz@@VER_2");
void xyz_old(void) { printf("v1 xyz\n"); }
void xyz_new(void) { printf("v2 xyz\n"); }
void pqr(void) { printf("v2 pqr\n"); }
```

Hai phiên bản `xyz()` của chúng ta được cung cấp bởi các hàm `xyz_old()` và `xyz_new()`. Hàm `xyz_old()` tương ứng với định nghĩa ban đầu của `xyz()`, đây là hàm sẽ tiếp tục được sử dụng bởi chương trình `p1`. Hàm `xyz_new()` cung cấp định nghĩa của `xyz()` để các chương trình liên kết với phiên bản mới của thư viện sử dụng.

Hai chỉ thị trình hợp dịch (assembler directive) `.symver` là chất keo gắn kết hai hàm này với các thẻ phiên bản (version tag) khác nhau trong tập lệnh phiên bản đã sửa đổi (sẽ được trình bày ngay sau đây) mà chúng ta sử dụng để tạo phiên bản mới của thư viện chia sẻ. Chỉ thị đầu tiên trong số này cho biết `xyz_old()` là bản cài đặt của `xyz()` sẽ được sử dụng cho các ứng dụng liên kết với thẻ phiên bản `VER_1` (tức là chương trình `p1` trong ví dụ của chúng ta), và `xyz_new()` là bản cài đặt của `xyz()` sẽ được sử dụng bởi các ứng dụng liên kết với thẻ phiên bản `VER_2`.

Việc sử dụng `@@` thay vì `@` trong chỉ thị `.symver` thứ hai cho thấy đây là định nghĩa mặc định của `xyz()` mà các ứng dụng sẽ liên kết (bind) tới khi được liên kết tĩnh với thư viện chia sẻ này. Chính xác là một trong các chỉ thị `.symver` cho một ký hiệu phải được đánh dấu bằng `@@`.

Tập lệnh phiên bản tương ứng cho thư viện đã sửa đổi của chúng ta như sau:

```
$ cat sv_v2.map
VER_1 {
 global: xyz;
 local: *; # Hide all other symbols
};
VER_2 {
 global: pqr;
} VER_1;
```

Tập lệnh phiên bản này cung cấp một thẻ phiên bản mới, `VER_2`, phụ thuộc vào thẻ `VER_1`. Sự phụ thuộc này được biểu thị bằng dòng sau:

```
} VER_1;
```

Các phụ thuộc thẻ phiên bản biểu thị mối quan hệ giữa các phiên bản thư viện kế tiếp. Về mặt ngữ nghĩa, tác động duy nhất của các phụ thuộc thẻ phiên bản trên Linux là một nút phiên bản (version node) kế thừa các thông số đặc tả toàn cục (global) và cục bộ (local) từ nút phiên bản mà nó phụ thuộc.

Các phụ thuộc có thể được nối chuỗi (chain), sao cho chúng ta có thể có một nút phiên bản khác được gắn thẻ `VER_3`, phụ thuộc vào `VER_2`, cứ như vậy.

Tên của các thẻ phiên bản tự bản thân chúng không mang ý nghĩa gì đặc biệt. Mối quan hệ giữa chúng chỉ được xác định bởi các phụ thuộc phiên bản đã chỉ định, và chúng ta chọn các tên `VER_1` và `VER_2` đơn giản là để gợi ý về các mối quan hệ này. Để hỗ trợ công tác bảo trì, thực tiễn được khuyến nghị là sử dụng các thẻ phiên bản bao gồm tên gói (package name) và số phiên bản. Ví dụ, glibc sử dụng các thẻ phiên bản có tên như `GLIBC_2.0`, `GLIBC_2.1`, v.v.

```

Thẻ phiên bản `VER_2` cũng chỉ định rằng hàm mới `pqr()` được xuất (export) bởi thư viện và liên kết (bind) với thẻ phiên bản `VER_2`. Nếu chúng ta không khai báo `pqr()` theo cách này, thì chỉ thị `local` mà thẻ phiên bản `VER_2` kế thừa từ thẻ phiên bản `VER_1` sẽ làm cho `pqr()` trở nên ẩn (invisible) đối với bên ngoài thư viện. Lưu ý rằng nếu chúng ta lược bỏ hoàn toàn chỉ thị `local`, thì các ký hiệu (symbol) `xyz_old()` và `xyz_new()` cũng sẽ được xuất bởi thư viện (điều này thông thường không phải là thứ chúng ta muốn).

Bây giờ chúng ta xây dựng phiên bản mới của thư viện theo cách thông thường:

```

$ gcc -g -c -fPIC -Wall sv_lib_v2.c
$ gcc -g -shared -o libsv.so sv_lib_v2.o -Wl,--version-script,sv_v2.map

```

Bây giờ chúng ta có thể tạo một chương trình mới, `p2`, sử dụng định nghĩa mới của `xyz()`, trong khi chương trình `p1` sử dụng phiên bản cũ của `xyz()`.

```

$ gcc -g -o p2 sv_prog.c libsv.so
$ LD_LIBRARY_PATH=. ./p2
v2 xyz Uses xyz@VER_2
$ LD_LIBRARY_PATH=. ./p1
v1 xyz Uses xyz@VER_1

```

Các phụ thuộc về thẻ phiên bản của một tệp thực thi (executable) được ghi lại tại thời điểm liên kết tĩnh (static link time). Chúng ta có thể sử dụng `objdump -t` để hiển thị bảng ký hiệu (symbol table) của mỗi tệp thực thi, từ đó cho thấy các phụ thuộc thẻ phiên bản khác nhau của từng chương trình:

```

$ objdump -t p1 | grep xyz
08048380 F *UND* 0000002e xyz@@VER_1
$ objdump -t p2 | grep xyz
080483a0 F *UND* 0000002e xyz@@VER_2

```

Chúng ta cũng có thể sử dụng `readelf -s` để thu được thông tin tương tự.

Thông tin thêm về phiên bản ký hiệu (symbol versioning) có thể được tìm thấy bằng cách sử dụng lệnh `info ld scripts version` và tại http://people.redhat.com/drepper/symbol-versioning.

## 42.4 Các hàm Khởi tạo và Kết thúc

Có thể định nghĩa một hoặc nhiều hàm được thực thi tự động khi một thư viện chia sẻ (shared library) được tải (load) và gỡ tải (unload). Điều này cho phép chúng ta thực hiện các thao tác khởi tạo (initialization) và kết thúc (finalization) khi làm việc với các thư viện chia sẻ. Các hàm khởi tạo và kết thúc được thực thi bất kể thư viện được tải tự động hay được tải một cách tường minh (explicitly) bằng cách sử dụng giao diện `dlopen` (Mục [42.1](#page-126-0)).

Các hàm khởi tạo và kết thúc được định nghĩa bằng cách sử dụng các thuộc tính (attribute) `constructor` và `destructor` của `gcc`. Mỗi hàm được thực thi khi thư viện được tải nên được định nghĩa như sau:

```

void __attribute__ ((constructor)) some_name_load(void)
{
/* Mã nguồn khởi tạo */
}

```

Các hàm gỡ tải được định nghĩa tương tự:

```

void __attribute__ ((destructor)) some_name_unload(void)
{
/* Mã nguồn kết thúc */
}

```

Tên hàm `some_name_load()` và `some_name_unload()` có thể được thay thế bằng bất kỳ tên nào mong muốn.

> Cũng có thể sử dụng các thuộc tính `constructor` và `destructor` của `gcc` để tạo các hàm khởi tạo và kết thúc trong một chương trình chính (main program).

### Các hàm \_init() và \_fini()

Một kỹ thuật cũ hơn để khởi tạo và kết thúc thư viện chia sẻ (shared library initialization and finalization) là tạo hai hàm `_init()` và `_fini()` như một phần của thư viện. Hàm `void _init(void)` chứa mã nguồn sẽ được thực thi khi thư viện được tải lần đầu bởi một Process (tiến trình). Hàm `void _fini(void)` chứa mã nguồn sẽ được thực thi khi thư viện bị hủy tải (unloaded).

Nếu chúng ta tạo các hàm `_init()` và `_fini()`, thì chúng ta phải chỉ định tùy chọn `gcc -nostartfiles` khi xây dựng thư viện chia sẻ, nhằm ngăn trình liên kết (linker) tự động đưa vào các phiên bản mặc định của các hàm này. (Bằng cách sử dụng các tùy chọn linker `-Wl,-init` và `-Wl,-fini`, chúng ta có thể chọn các tên thay thế cho hai hàm này nếu muốn).

Việc sử dụng `_init()` và `_fini()` giờ đây được coi là lỗi thời (obsolete), thay vào đó người ta ưu tiên sử dụng các thuộc tính constructor và destructor của gcc. Các thuộc tính này mang lại nhiều ưu điểm, trong số đó là cho phép chúng ta định nghĩa nhiều hàm khởi tạo và kết thúc.

## 42.5 Tải trước các Thư viện chia sẻ (Preloading Shared Libraries)

Đối với mục đích kiểm thử, đôi khi việc ghi đè có chọn lọc các hàm (và các ký hiệu - symbol khác) mà thông thường sẽ được tìm thấy bởi trình liên kết động (dynamic linker) bằng cách sử dụng các quy tắc được mô tả trong Mục [41.11](#page-121-1) sẽ rất hữu ích. Để làm điều này, chúng ta có thể định nghĩa biến môi trường `LD_PRELOAD` là một chuỗi bao gồm tên của các thư viện chia sẻ được phân tách bằng dấu cách hoặc dấu hai chấm, những thư viện này sẽ được tải trước bất kỳ thư viện chia sẻ nào khác. Vì các thư viện này được tải trước tiên, bất kỳ hàm nào do chúng định nghĩa sẽ tự động được sử dụng nếu tệp thực thi (executable) yêu cầu, do đó ghi đè lên bất kỳ hàm nào khác cùng tên mà nếu không có nó thì trình liên kết động sẽ tìm kiếm. Ví dụ, giả sử chúng ta có một chương trình gọi các hàm `x1()` và `x2()`, được định nghĩa trong thư viện `libdemo` của chúng ta. Khi chúng ta chạy chương trình này, chúng ta thấy đầu ra sau:

```

$ ./prog
Called mod1-x1 DEMO
Called mod2-x2 DEMO

```

(Trong ví dụ này, chúng ta giả định rằng thư viện chia sẻ nằm trong một trong các thư mục tiêu chuẩn, và do đó chúng ta không cần sử dụng biến môi trường `LD_LIBRARY_PATH`).

Chúng ta có thể ghi đè có chọn lọc hàm `x1()` bằng cách tạo một thư viện chia sẻ khác, `libalt.so`, chứa một định nghĩa khác của `x1()`. Việc tải trước (preload) thư viện này khi chạy chương trình sẽ cho kết quả sau:

```

$ LD_PRELOAD=libalt.so ./prog
Called mod1-x1 ALT
Called mod2-x2 DEMO

```

Ở đây, chúng ta thấy rằng phiên bản của `x1()` được định nghĩa trong `libalt.so` được gọi, nhưng lệnh gọi `x2()` (vốn không có định nghĩa nào được cung cấp trong `libalt.so`) dẫn đến việc gọi hàm `x2()` được định nghĩa trong `libdemo.so`.

Biến môi trường `LD_PRELOAD` kiểm soát việc tải trước trên cơ sở từng tiến trình (per-process basis). Ngoài ra, tệp `/etc/ld.so.preload`, liệt kê các thư viện được phân tách bằng khoảng trắng (white space), có thể được sử dụng để thực hiện tác vụ tương tự trên toàn hệ thống (system-wide basis). (Các thư viện được chỉ định bởi `LD_PRELOAD` sẽ được tải trước các thư viện được chỉ định trong `/etc/ld.so.preload`).

Vì lý do bảo mật, các chương trình set-user-ID và set-group-ID sẽ bỏ qua `LD_PRELOAD`.

## 42.6 Giám sát Trình liên kết Động: LD\_DEBUG

Đôi khi, việc giám sát hoạt động của trình liên kết động (dynamic linker) là rất hữu ích, chẳng hạn để biết nó đang tìm kiếm các thư viện ở đâu. Chúng ta có thể sử dụng biến môi trường `LD_DEBUG` để làm điều này. Bằng cách gán biến này cho một (hoặc nhiều) từ khóa chuẩn, chúng ta có thể thu thập các loại thông tin gỡ lỗi (tracing information) khác nhau từ trình liên kết động.

Nếu chúng ta gán giá trị `help` cho `LD_DEBUG`, trình liên kết động sẽ hiển thị thông tin trợ giúp về `LD_DEBUG` và lệnh được chỉ định sẽ không được thực thi:

### \$ **LD\_DEBUG=help date**

Các tùy chọn hợp lệ cho biến môi trường `LD_DEBUG` bao gồm:

```

libs hiển thị đường dẫn tìm kiếm thư viện
reloc hiển thị quá trình xử lý định vị lại (relocation)
files hiển thị tiến trình của tệp đầu vào
symbols hiển thị quá trình xử lý bảng ký hiệu (symbol table)
bindings hiển thị thông tin về liên kết ký hiệu (symbol binding)
versions hiển thị sự phụ thuộc phiên bản
all kết hợp tất cả các tùy chọn trước đó
statistics hiển thị thống kê định vị lại
unused xác định các DSO không được sử dụng
help hiển thị thông báo trợ giúp này và thoát

```

Để chuyển hướng đầu ra gỡ lỗi vào một tệp thay vì đầu ra chuẩn (standard output), tên tệp có thể được chỉ định bằng cách sử dụng biến môi trường `LD_DEBUG_OUTPUT`. Ví dụ sau đây cho thấy một phiên bản rút gọn của đầu ra được cung cấp khi chúng ta yêu cầu theo dõi thông tin về việc tìm kiếm thư viện:

### \$ **LD\_DEBUG=libs date**

```

10687: find library=librt.so.1 [0]; searching
10687: search cache=/etc/ld.so.cache
10687: trying file=/lib/librt.so.1
10687: find library=libc.so.6 [0]; searching
10687: search cache=/etc/ld.so.cache
10687: trying file=/lib/libc.so.6
10687: find library=libpthread.so.0 [0]; searching
10687: search cache=/etc/ld.so.cache
10687: trying file=/lib/libpthread.so.0
10687: calling init: /lib/libpthread.so.0
10687: calling init: /lib/libc.so.6
10687: calling init: /lib/librt.so.1
10687: initialize program: date
10687: transferring control: date
Tue Dec 28 17:26:56 CEST 2010
10687: calling fini: date [0]
10687: calling fini: /lib/librt.so.1 [0]
10687: calling fini: /lib/libpthread.so.0 [0]
10687: calling fini: /lib/libc.so.6 [0]

```

Giá trị `10687` hiển thị ở đầu mỗi dòng là ID tiến trình (Process ID - PID) của tiến trình đang được theo dõi. Điều này rất hữu ích nếu chúng ta đang giám sát nhiều tiến trình (ví dụ: tiến trình cha và tiến trình con).

Theo mặc định, đầu ra của `LD_DEBUG` được ghi vào lỗi chuẩn (standard error), nhưng chúng ta có thể chuyển hướng nó đến nơi khác bằng cách gán một đường dẫn (pathname) cho biến môi trường `LD_DEBUG_OUTPUT`.

Nếu muốn, chúng ta có thể gán nhiều tùy chọn cho `LD_DEBUG` bằng cách phân tách chúng bằng dấu phẩy (không được có khoảng trắng). Đầu ra của tùy chọn `symbols` (theo dõi quá trình phân giải ký hiệu bởi trình liên kết động) thường rất lớn.

`LD_DEBUG` có hiệu lực đối với cả các thư viện được tải một cách ngầm định (implicitly loaded) bởi trình liên kết động và các thư viện được tải động bằng hàm `dlopen()`.

Vì lý do bảo mật, `LD_DEBUG` sẽ bị bỏ qua (kể từ phiên bản glibc 2.2.5) trong các chương trình `set-user-ID` và `set-group-ID`.

## 42.7 Tóm tắt

Trình liên kết động (dynamic linker) cung cấp API `dlopen`, cho phép các chương trình tải một cách tường minh (explicitly) các thư viện chia sẻ (shared library) bổ sung tại thời điểm chạy (run time). Điều này cho phép các chương trình thực thi tính năng dạng phần bổ trợ (plug-in).

Một khía cạnh quan trọng trong thiết kế thư viện chia sẻ là kiểm soát khả năng hiển thị ký hiệu (symbol visibility), sao cho thư viện chỉ xuất khẩu (export) những ký hiệu (hàm và biến) thực sự nên được sử dụng bởi các chương trình liên kết với thư viện đó. Chúng ta đã xem xét một loạt các kỹ thuật có thể được sử dụng để kiểm soát khả năng hiển thị ký hiệu. Trong số các kỹ thuật đó có việc sử dụng các tập lệnh phiên bản (version scripts), cung cấp khả năng kiểm soát chi tiết (fine-grained control) đối với khả năng hiển thị của ký hiệu.

Chúng ta cũng đã chỉ ra cách các tập lệnh phiên bản (version scripts) có thể được sử dụng để thực thi một lược đồ cho phép một thư viện chia sẻ duy nhất xuất khẩu nhiều định nghĩa của một ký hiệu để các ứng dụng khác nhau liên kết với thư viện đó sử dụng. (Mỗi ứng dụng sử dụng định nghĩa hiện hành tại thời điểm ứng dụng được liên kết tĩnh với thư viện). Kỹ thuật này cung cấp một giải pháp thay thế cho phương pháp quản lý phiên bản thư viện truyền thống là sử dụng số phiên bản chính (major) và phụ (minor) trong tên thực (real name) của thư viện chia sẻ.

Việc định nghĩa các hàm khởi tạo (initialization) và kết thúc (finalization) trong một thư viện chia sẻ cho phép chúng ta tự động thực thi mã nguồn khi thư viện được tải (loaded) và gỡ tải (unloaded).

Biến môi trường `LD_PRELOAD` cho phép chúng ta tải trước (preload) các thư viện chia sẻ. Sử dụng cơ chế này, chúng ta có thể ghi đè (override) một cách có chọn lọc các hàm và các ký hiệu khác mà trình liên kết động thông thường sẽ tìm thấy trong các thư viện chia sẻ khác.

Chúng ta có thể gán các giá trị khác nhau cho biến môi trường `LD_DEBUG` nhằm theo dõi hoạt động của trình liên kết động (dynamic linker).

### Thông tin thêm

Tham khảo các nguồn thông tin bổ sung được liệt kê tại Mục [41.14.](#page-123-0)

## 42.8 Bài tập

- **42-1.** Viết một chương trình để xác minh rằng nếu một thư viện bị đóng bằng `dlclose()`, nó sẽ không bị gỡ tải (unloaded) nếu bất kỳ ký hiệu nào của nó đang được sử dụng bởi một thư viện khác.
- **42-2.** Thêm lệnh gọi `dladdr()` vào chương trình trong [Liệt kê 42-1](#page-132-0) (`dynload.c`) để truy xuất thông tin về địa chỉ do `dlsym()` trả về. In ra các giá trị của các trường trong cấu trúc `Dl_info` được trả về, đồng thời xác minh xem chúng có đúng như mong đợi hay không.
