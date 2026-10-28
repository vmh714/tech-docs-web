# Chương 59: Socket: Miền Internet (Sockets: Internet Domains)

Sau khi đã tìm hiểu các khái niệm socket tổng quát (generic sockets concepts) và bộ giao thức TCP/IP ở các chương trước, trong chương này, chúng ta sẽ sẵn sàng tìm hiểu về lập trình với socket trong miền (domain) IPv4 (`AF_INET`) và IPv6 (`AF_INET6`).

Như đã lưu ý ở Chương [58,](#page-30-0) địa chỉ socket miền Internet bao gồm một địa chỉ IP và một số cổng (port number). Mặc dù máy tính sử dụng biểu diễn nhị phân của địa chỉ IP và số cổng, con người lại dễ làm việc với tên gọi hơn là các con số. Do đó, chúng ta sẽ mô tả các kỹ thuật được sử dụng để xác định các máy chủ (host) và cổng bằng cách sử dụng tên. Chúng ta cũng sẽ xem xét việc sử dụng các hàm thư viện để lấy (các) địa chỉ IP cho một tên máy chủ (hostname) cụ thể và số cổng tương ứng với một tên dịch vụ (service name) cụ thể. Thảo luận của chúng ta về tên máy chủ bao gồm mô tả về Hệ thống Phân giải Tên Miền (Domain Name System - DNS), hệ thống này thực hiện một cơ sở dữ liệu phân tán (distributed database) ánh xạ tên máy chủ thành địa chỉ IP và ngược lại.

## 59.1 Socket Miền Internet (Internet Domain Sockets)

Socket luồng (stream sockets) miền Internet được triển khai dựa trên TCP. Chúng cung cấp một kênh giao tiếp luồng byte (byte-stream) đáng tin cậy, hai chiều (bidirectional).

Socket datagram (datagram sockets) miền Internet được triển khai dựa trên UDP. Socket UDP tương tự như các đối tác của chúng trong miền UNIX (UNIX domain counterparts), nhưng cần lưu ý các điểm khác biệt sau:

- Socket datagram miền UNIX thì đáng tin cậy, nhưng socket UDP thì không—các datagram có thể bị mất, bị trùng lặp hoặc đến theo thứ tự khác với thứ tự chúng được gửi đi.
- Việc gửi trên socket datagram miền UNIX sẽ bị chặn (block) nếu hàng đợi dữ liệu của socket nhận đã đầy. Ngược lại, với UDP, nếu datagram đến làm tràn hàng đợi của bên nhận, thì datagram đó sẽ âm thầm bị loại bỏ (silently dropped).

## 59.2 Thứ Tự Byte Mạng (Network Byte Order)

Địa chỉ IP và số cổng là các giá trị số nguyên. Một vấn đề chúng ta gặp phải khi truyền các giá trị này qua mạng là các kiến trúc phần cứng khác nhau lưu trữ các byte của một số nguyên đa byte theo các thứ tự khác nhau. Như được minh họa trong [Hình 59-1,](#page-49-0) các kiến trúc lưu trữ số nguyên với byte có ý nghĩa lớn nhất (most significant byte) trước (tức là ở địa chỉ bộ nhớ thấp nhất) được gọi là big endian; những kiến trúc lưu trữ byte có ý nghĩa nhỏ nhất (least significant byte) trước được gọi là little endian. (Các thuật ngữ này bắt nguồn từ tiểu thuyết châm biếm năm 1726 "Gulliver du ký" của Jonathan Swift, trong đó các thuật ngữ này ám chỉ các phe phái chính trị đối lập đập vỡ quả trứng luộc của họ ở các đầu khác nhau.) Ví dụ nổi tiếng nhất về kiến trúc little-endian là x86. (Kiến trúc VAX của Digital là một ví dụ quan trọng khác về mặt lịch sử, vì BSD được sử dụng rộng rãi trên máy đó). Hầu hết các kiến trúc khác là big endian. Một số ít kiến trúc phần cứng có thể chuyển đổi giữa hai định dạng này. Thứ tự byte được sử dụng trên một máy cụ thể được gọi là thứ tự byte máy chủ (host byte order).

|                             | Số nguyên 2-byte |                  | Số nguyên 4-byte |              |                  |                  |                  |
|-----------------------------|------------------|------------------|------------------|--------------|------------------|------------------|------------------|
|                             | địa chỉ<br>N     | địa chỉ<br>N + 1 |                  | địa chỉ<br>N | địa chỉ<br>N + 1 | địa chỉ<br>N + 2 | địa chỉ<br>N + 3 |
| Thứ tự byte<br>Big-endian   | 1<br>(MSB)       | 0<br>(LSB)       |                  | 3<br>(MSB)   | 2                | 1                | 0<br>(LSB)       |
|                             | địa chỉ<br>N     | địa chỉ<br>N + 1 |                  | địa chỉ<br>N | địa chỉ<br>N + 1 | địa chỉ<br>N + 2 | địa chỉ<br>N + 3 |
| Thứ tự byte<br>Little-endian| 0<br>(LSB)       | 1<br>(MSB)       |                  | 0<br>(LSB)   | 1                | 2                | 3<br>(MSB)       |

MSB = Most Significant Byte (Byte có ý nghĩa lớn nhất), LSB = Least Significant Byte (Byte có ý nghĩa nhỏ nhất)

**Hình 59-1:** Thứ tự byte big-endian và little-endian cho số nguyên 2-byte và 4-byte

Vì số cổng và địa chỉ IP phải được truyền giữa và được hiểu bởi tất cả các máy chủ trên mạng, nên phải sử dụng một thứ tự chuẩn. Thứ tự này được gọi là thứ tự byte mạng (network byte order), và thực tế nó chính là big endian.

Sau này trong chương này, chúng ta sẽ xem xét các hàm khác nhau chuyển đổi tên máy chủ (ví dụ: `www.kernel.org`) và tên dịch vụ (ví dụ: `http`) thành các dạng số tương ứng. Các hàm này thường trả về các số nguyên theo thứ tự byte mạng và các số nguyên này có thể được sao chép trực tiếp vào các trường có liên quan của một cấu trúc địa chỉ socket (socket address structure).

Tuy nhiên, đôi khi chúng ta sử dụng trực tiếp các hằng số nguyên cho địa chỉ IP và số cổng. Ví dụ, chúng ta có thể chọn mã hóa cứng (hard-code) một số cổng vào chương trình của mình, chỉ định số cổng làm đối số dòng lệnh (command-line argument) cho chương trình, hoặc sử dụng các hằng số như `INADDR_ANY` và `INADDR_LOOPBACK` khi chỉ định một địa chỉ IPv4. Các giá trị này được biểu diễn trong C theo quy ước của máy chủ, do đó chúng ở dạng thứ tự byte máy chủ. Chúng ta phải chuyển đổi các giá trị này sang thứ tự byte mạng trước khi lưu trữ chúng trong các cấu trúc địa chỉ socket.

Các hàm htons(), htonl(), ntohs() và ntohl() được định nghĩa (thường là các macro) để chuyển đổi các số nguyên theo cả hai chiều giữa thứ tự byte của máy chủ (host byte order) và thứ tự byte của mạng (network byte order).

```c
## include <arpa/inet.h>
uint16_t htons(uint16_t host_uint16);
                           Trả về host_uint16 đã được chuyển đổi sang network byte order
uint32_t htonl(uint32_t host_uint32);
                           Trả về host_uint32 đã được chuyển đổi sang network byte order
uint16_t ntohs(uint16_t net_uint16);
                                Trả về net_uint16 đã được chuyển đổi sang host byte order
uint32_t ntohl(uint32_t net_uint32);
                                Trả về net_uint32 đã được chuyển đổi sang host byte order
```

Trong những thời kỳ đầu, các hàm này có các nguyên mẫu (prototype) như sau:

```
unsigned long htonl(unsigned long hostlong);
```

Điều này cho thấy nguồn gốc của tên các hàm — trong trường hợp này là host to network long (chuyển đổi số nguyên dài từ máy chủ sang mạng). Trên hầu hết các hệ thống đời đầu triển khai socket (Socket), các số nguyên ngắn (short integer) có kích thước 16 bit, và các số nguyên dài (long integer) có kích thước 32 bit. Điều này không còn đúng trên các hệ thống hiện đại (ít nhất là đối với các số nguyên dài), vì vậy các nguyên mẫu được cung cấp ở trên mang lại định nghĩa chính xác hơn về các kiểu dữ liệu mà các hàm này xử lý, mặc dù tên hàm vẫn được giữ nguyên. Các kiểu dữ liệu uint16_t và uint32_t lần lượt là các số nguyên không dấu (unsigned integer) 16-bit và 32-bit.

Nói một cách nghiêm ngặt, việc sử dụng bốn hàm này chỉ cần thiết trên các hệ thống mà thứ tự byte của máy chủ (host byte order) khác với thứ tự byte của mạng (network byte order). Tuy nhiên, các hàm này nên luôn được sử dụng để các chương trình có tính di động (portable) trên các kiến trúc phần cứng khác nhau. Trên các hệ thống mà thứ tự byte của máy chủ giống với thứ tự byte của mạng, các hàm này đơn giản là trả về các tham số đầu vào mà không thay đổi gì.

## 59.3 Biểu diễn dữ liệu (Data Representation)

Khi viết các chương trình mạng (network program), chúng ta cần lưu ý đến thực tế là các kiến trúc máy tính khác nhau sử dụng các quy ước khác nhau để biểu diễn các kiểu dữ liệu khác nhau. Chúng ta đã lưu ý rằng các kiểu số nguyên có thể được lưu trữ ở dạng big-endian hoặc little-endian. Ngoài ra còn có những sự khác biệt tiềm ẩn khác. Ví dụ, kiểu dữ liệu long trong C có thể là 32 bit trên một số hệ thống và 64 bit trên các hệ thống khác. Khi chúng ta xem xét các cấu trúc (structure), vấn đề càng trở nên phức tạp hơn bởi thực tế là các cách triển khai khác nhau áp dụng các quy tắc khác nhau để căn chỉnh các trường (field) của cấu trúc theo các ranh giới địa chỉ (address boundary) trên hệ thống máy chủ, để lại các số lượng byte đệm (padding byte) khác nhau giữa các trường.

Do những sự khác biệt trong việc biểu diễn dữ liệu này, các ứng dụng trao đổi dữ liệu giữa các hệ thống không đồng nhất (heterogeneous system) qua mạng phải áp dụng một quy ước chung nào đó để mã hóa dữ liệu đó. Bên gửi phải mã hóa dữ liệu theo quy ước này, trong khi bên nhận giải mã tuân theo cùng quy ước đó. Quá trình đưa dữ liệu vào một định dạng chuẩn để truyền qua mạng được gọi là sắp xếp dữ liệu (marshalling). Tồn tại nhiều tiêu chuẩn marshalling khác nhau, chẳng hạn như XDR (External Data Representation, được mô tả trong RFC 1014), ASN.1-BER (Abstract Syntax Notation 1, http://www.asn1.org/), CORBA và XML. Thông thường, các tiêu chuẩn này định nghĩa một định dạng cố định cho mỗi kiểu dữ liệu (ví dụ: định nghĩa thứ tự byte và số lượng bit được sử dụng). Ngoài việc được mã hóa theo định dạng yêu cầu, mỗi mục dữ liệu còn được đính kèm các trường bổ sung xác định kiểu của nó (và có thể là cả độ dài).

Tuy nhiên, một cách tiếp cận đơn giản hơn marshalling thường được áp dụng: mã hóa tất cả dữ liệu được truyền đi dưới dạng văn bản (text), với các mục dữ liệu riêng biệt được phân tách bằng một ký tự được chỉ định, thường là ký tự xuống dòng (newline). Một ưu điểm của cách tiếp cận này là chúng ta có thể sử dụng `telnet` để gỡ lỗi (debug) một ứng dụng. Để làm điều này, chúng ta sử dụng lệnh sau:

### \$ **telnet** *host port*

Sau đó, chúng ta có thể gõ các dòng văn bản để truyền đến ứng dụng và xem các phản hồi do ứng dụng gửi về. Chúng tôi minh họa kỹ thuật này trong Mục [59.11.](#page-70-0)

> [!NOTE]
> Các vấn đề liên quan đến sự khác biệt trong cách biểu diễn trên các hệ thống không đồng nhất không chỉ áp dụng cho việc truyền dữ liệu qua mạng, mà còn áp dụng cho bất kỳ cơ chế trao đổi dữ liệu nào giữa các hệ thống đó. Ví dụ, chúng ta phải đối mặt với các vấn đề tương tự khi truyền các tệp trên đĩa hoặc băng từ giữa các hệ thống không đồng nhất. Lập trình mạng đơn giản là ngữ cảnh lập trình phổ biến nhất mà chúng ta có khả năng gặp phải vấn đề này ngày nay.

Nếu chúng ta mã hóa dữ liệu được truyền trên một socket luồng (stream socket) dưới dạng văn bản phân tách bằng ký tự xuống dòng, thì việc định nghĩa một hàm như readLine(), được hiển thị trong [Liệt kê 59-1](#page-52-0), sẽ rất thuận tiện.

```c
## include "read_line.h"
ssize_t readLine(int fd, void *buffer, size_t n);
                           Trả về số lượng byte được sao chép vào buffer (không bao gồm
                        byte null kết thúc), hoặc 0 khi kết thúc tệp (end-of-file), hoặc –1 khi có lỗi
```

Hàm readLine() đọc các byte từ tệp được tham chiếu bởi tham số bộ mô tả tệp (file descriptor) `fd` cho đến khi gặp ký tự xuống dòng. Chuỗi byte đầu vào được trả về tại vị trí trỏ tới bởi `buffer`, nơi phải trỏ tới một vùng bộ nhớ có ít nhất `n` byte. Chuỗi được trả về luôn được kết thúc bằng ký tự null (null-terminated); do đó, tối đa (n – 1) byte dữ liệu thực tế sẽ được trả về. Khi thành công, readLine() trả về số lượng byte dữ liệu được đặt trong `buffer`; byte null kết thúc không được tính vào số lượng này.

```
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/read_line.c
## include <unistd.h>
## include <errno.h>
## include "read_line.h" /* Khai báo hàm readLine() */
ssize_t
readLine(int fd, void *buffer, size_t n)
{
 ssize_t numRead; /* Số byte được đọc bởi lần gọi read() cuối cùng */
 size_t totRead; /* Tổng số byte đã đọc tính đến hiện tại */
 char *buf;
 char ch;
 if (n <= 0 || buffer == NULL) {
 errno = EINVAL;
 return -1;
 }
 buf = buffer; /* Không thực hiện phép toán con trỏ trên kiểu "void *" */
 totRead = 0;
 for (;;) {
 numRead = read(fd, &ch, 1);
 if (numRead == -1) {
 if (errno == EINTR) /* Bị ngắt --> khởi động lại read() */
 continue;
 else
 return -1; /* Lỗi khác */
 } else if (numRead == 0) { /* EOF (Kết thúc file/luồng) */
 if (totRead == 0) /* Không có byte nào được đọc; trả về 0 */
 return 0;
 else /* Đã đọc được một số byte; thêm ký tự kết thúc chuỗi '\0' */
 break;
 } else { /* 'numRead' bắt buộc phải bằng 1 nếu chạy đến đây */
 if (totRead < n - 1) { /* Loại bỏ các byte > (n - 1) */
 totRead++;
 *buf++ = ch;
 }
 if (ch == '\n')
 break;
 }
 }
 *buf = '\0';
 return totRead;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/read_line.c
```

Nếu số lượng byte đọc được trước khi gặp ký tự xuống dòng lớn hơn hoặc bằng (n – 1), thì hàm `readLine()` sẽ loại bỏ các byte thừa (bao gồm cả ký tự xuống dòng). Nếu một ký tự xuống dòng được đọc trong phạm vi (n – 1) byte đầu tiên, nó sẽ được bao gồm trong chuỗi trả về. (Do đó, chúng ta có thể xác định xem các byte có bị loại bỏ hay không bằng cách kiểm tra xem ký tự xuống dòng có đứng trước byte null kết thúc trong bộ đệm (buffer) trả về hay không.) Chúng ta áp dụng phương pháp này để các giao thức ứng dụng dựa trên việc xử lý đầu vào theo từng đơn vị dòng không bị xử lý nhầm một dòng dài thành nhiều dòng. Điều này có thể làm hỏng giao thức, vì các ứng dụng ở hai đầu sẽ bị mất đồng bộ (desynchronized). Một cách tiếp cận thay thế là để `readLine()` chỉ đọc đủ số byte để lấp đầy bộ đệm được cung cấp, và để lại bất kỳ byte nào còn lại cho đến ký tự xuống dòng tiếp theo cho lần gọi `readLine()` kế tiếp. Trong trường hợp này, bên gọi `readLine()` sẽ phải xử lý khả năng đọc được một dòng không hoàn chỉnh.

Chúng ta sử dụng hàm `readLine()` trong các chương trình ví dụ được trình bày tại Mục [59.11](#page-70-0).

## 59.4 Địa chỉ Socket Internet (Internet Socket Addresses)

Có hai loại địa chỉ Internet domain socket: IPv4 và IPv6.

### Địa chỉ socket IPv4: struct sockaddr\_in

Một địa chỉ socket IPv4 được lưu trữ trong cấu trúc `sockaddr_in`, được định nghĩa trong `<netinet/in.h>` như sau:

```
struct in_addr { /* Địa chỉ IPv4 4 byte */
 in_addr_t s_addr; /* Số nguyên không dấu 32-bit */
};
struct sockaddr_in { /* Địa chỉ socket IPv4 */
 sa_family_t sin_family; /* Họ địa chỉ (AF_INET) */
 in_port_t sin_port; /* Số hiệu cổng (Port number) */
 struct in_addr sin_addr; /* Địa chỉ IPv4 */
 unsigned char __pad[X]; /* Đệm cho khớp kích thước của cấu trúc
 'sockaddr' (16 byte) */
};
```

Tại Mục [56.4](#page-5-0), chúng ta đã thấy rằng cấu trúc `sockaddr` tổng quát bắt đầu bằng một trường xác định miền socket (socket domain). Trường này tương ứng với trường `sin_family` trong cấu trúc `sockaddr_in`, luôn được thiết lập thành `AF_INET`. Các trường `sin_port` và `sin_addr` lần lượt là số hiệu cổng và địa chỉ IP, cả hai đều ở định dạng thứ tự byte mạng (network byte order). Các kiểu dữ liệu `in_port_t` và `in_addr_t` lần lượt là các kiểu số nguyên không dấu có độ dài 16 và 32 bit.

### Địa chỉ socket IPv6: struct sockaddr\_in6

Giống như địa chỉ IPv4, một địa chỉ socket IPv6 bao gồm một địa chỉ IP cộng với một số hiệu cổng. Điểm khác biệt là địa chỉ IPv6 có kích thước 128 bit thay vì 32 bit. Một địa chỉ socket IPv6 được lưu trữ trong cấu trúc `sockaddr_in6`, được định nghĩa trong `<netinet/in.h>` như sau:

```
struct in6_addr { /* Cấu trúc địa chỉ IPv6 */
 uint8_t s6_addr[16]; /* 16 byte == 128 bit */
};
```

```
struct sockaddr_in6 { /* Địa chỉ socket IPv6 */
 sa_family_t sin6_family; /* Họ địa chỉ (AF_INET6) */
 in_port_t sin6_port; /* Số hiệu cổng */
 uint32_t sin6_flowinfo; /* Thông tin luồng IPv6 (IPv6 flow information) */
 struct in6_addr sin6_addr; /* Địa chỉ IPv6 */
 uint32_t sin6_scope_id; /* ID phạm vi (Scope ID - mới có từ kernel 2.4) */
};
```

Trường `sin_family` được thiết lập thành `AF_INET6`. Các trường `sin6_port` và `sin6_addr` là số hiệu cổng và địa chỉ IP. (Kiểu dữ liệu `uint8_t`, được sử dụng để định kiểu cho các byte của cấu trúc `in6_addr`, là một số nguyên không dấu 8-bit). Các trường còn lại, `sin6_flowinfo` và `sin6_scope_id`, nằm ngoài phạm vi của cuốn sách này; đối với mục đích của chúng ta, chúng luôn được đặt bằng 0. Tất cả các trường trong cấu trúc `sockaddr_in6` đều ở định dạng thứ tự byte mạng (network byte order).

> [!NOTE]
> Địa chỉ IPv6 được mô tả trong RFC 4291. Thông tin về điều khiển luồng IPv6 (`sin6_flowinfo`) có thể được tìm thấy trong Phụ lục A của [Stevens et al., 2004] và trong các tài liệu RFC 2460 và 3697. Các RFC 3493 và 4007 cung cấp thông tin về `sin6_scope_id`.

IPv6 có các phiên bản tương đương với địa chỉ wildcard (địa chỉ đại diện) và loopback của IPv4. Tuy nhiên, việc sử dụng chúng trở nên phức tạp do thực tế là địa chỉ IPv6 được lưu trữ trong một mảng (thay vì sử dụng kiểu dữ liệu vô hướng - scalar type). Chúng ta sử dụng địa chỉ wildcard IPv6 (0::0) để minh họa điểm này. Hằng số `IN6ADDR_ANY_INIT` được định nghĩa cho địa chỉ này như sau:

```c
## define IN6ADDR_ANY_INIT { { 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 } }
```

Trên Linux, một số chi tiết trong các tệp header (header files) khác với mô tả của chúng ta trong phần này. Cụ thể, cấu trúc `in6_addr` chứa một định nghĩa union (union definition) chia địa chỉ IPv6 128-bit thành 16 byte, tám số nguyên 2-byte, hoặc bốn số nguyên 32-byte (lưu ý: nguyên bản tiếng Anh nhầm lẫn 32-byte nhưng thực chất là 32-bit/4-byte, tuy nhiên ta dịch sát nghĩa). Do sự hiện diện của định nghĩa này, định nghĩa `IN6ADDR_ANY_INIT` trong glibc thực tế bao gồm nhiều hơn một tập dấu ngoặc nhọn lồng nhau so với được hiển thị trong phần nội dung chính.

Chúng ta có thể sử dụng hằng số `IN6ADDR_ANY_INIT` trong trình khởi tạo (initializer) đi kèm với việc khai báo biến, nhưng không thể sử dụng nó ở vế phải của một câu lệnh gán, vì cú pháp của ngôn ngữ C không cho phép các hằng số có cấu trúc được sử dụng trong các phép gán. Thay vào đó, chúng ta phải sử dụng một biến được định nghĩa sẵn, `in6addr_any`, được khởi tạo như sau bởi thư viện C (C library):

```
const struct in6_addr in6addr_any = IN6ADDR_ANY_INIT;
```

Do đó, chúng ta có thể khởi tạo một cấu trúc địa chỉ socket IPv6 (IPv6 socket address structure) sử dụng địa chỉ wildcard (wildcard address) như sau:

```
struct sockaddr_in6 addr;
memset(&addr, 0, sizeof(struct sockaddr_in6));
addr.sin6_family = AF_INET6;
addr.sin6_addr = in6addr_any;
addr.sin6_port = htons(SOME_PORT_NUM);
```

Hằng số và biến tương ứng cho địa chỉ loopback IPv6 (::1) lần lượt là `IN6ADDR_LOOPBACK_INIT` và `in6addr_loopback`.

Không giống như các đối trọng ở IPv4, các bộ khởi tạo hằng số và biến của IPv6 đều ở định dạng thứ tự byte mạng (network byte order). Tuy nhiên, như được hiển thị trong đoạn mã trên, chúng ta vẫn phải đảm bảo rằng số hiệu cổng (port number) nằm ở định dạng thứ tự byte mạng.

Nếu IPv4 và IPv6 cùng tồn tại trên một host, chúng sẽ chia sẻ cùng một không gian số hiệu cổng (port-number space). Điều này có nghĩa là nếu, ví dụ, một ứng dụng bind một socket IPv6 vào cổng TCP 2000 (sử dụng địa chỉ wildcard IPv6), thì một socket TCP IPv4 không thể được bind vào cùng cổng đó. (Việc cài đặt giao thức TCP/IP đảm bảo rằng các socket trên các host khác có thể giao tiếp với socket này, bất kể các host đó đang chạy IPv4 hay IPv6.)

### Cấu trúc sockaddr\_storage

Với API socket IPv6 (IPv6 sockets API), cấu trúc chung mới `sockaddr_storage` đã được giới thiệu. Cấu trúc này được định nghĩa đủ lớn để chứa bất kỳ loại địa chỉ socket nào (nghĩa là, bất kỳ loại cấu trúc địa chỉ socket nào cũng có thể được ép kiểu - cast - và lưu trữ bên trong nó). Cụ thể, cấu trúc này cho phép chúng ta lưu trữ một cách trong suốt (transparently) hoặc là địa chỉ socket IPv4 hoặc IPv6, qua đó loại bỏ các sự phụ thuộc về phiên bản IP ra khỏi mã nguồn của chúng ta. Cấu trúc `sockaddr_storage` được định nghĩa trên Linux như sau:

```c
## define __ss_aligntype uint32_t /* Trên các kiến trúc 32-bit */
struct sockaddr_storage {
 sa_family_t ss_family;
 __ss_aligntype __ss_align; /* Buộc căn chỉnh bộ nhớ (alignment) */
 char __ss_padding[SS_PADSIZE]; /* Đệm đến 128 byte */
};
```

## 59.5 Tổng quan về các hàm chuyển đổi Host và Service

Máy tính biểu diễn các địa chỉ IP và số hiệu cổng dưới dạng nhị phân. Tuy nhiên, con người thấy tên gọi dễ nhớ hơn các con số. Việc sử dụng tên tượng trưng (symbolic names) cũng cung cấp một mức độ gián tiếp (level of indirection) hữu ích; người dùng và chương trình có thể tiếp tục sử dụng cùng một tên ngay cả khi giá trị số bên dưới thay đổi.

Hostname là định danh tượng trưng cho một hệ thống được kết nối với mạng (có thể có nhiều địa chỉ IP). Tên dịch vụ (service name) là biểu diễn tượng trưng của một số hiệu cổng (port number).

Các phương pháp sau đây có sẵn để biểu diễn địa chỉ host và port:

- Địa chỉ host có thể được biểu diễn dưới dạng giá trị nhị phân, dưới dạng hostname tượng trưng, hoặc ở định dạng trình bày (presentation format) (dạng chấm-thập phân - dotted-decimal cho IPv4 hoặc chuỗi thập lục phân - hex-string cho IPv6).
- Một port có thể được biểu diễn dưới dạng giá trị nhị phân hoặc dưới dạng tên dịch vụ tượng trưng (symbolic service name).

Nhiều hàm thư viện khác nhau được cung cấp để chuyển đổi giữa các định dạng này. Phần này tóm tắt ngắn gọn các hàm đó. Các phần tiếp theo mô tả chi tiết các API hiện đại (`inet_ntop()`, `inet_pton()`, `getaddrinfo()`, `getnameinfo()`, v.v.). Trong Mục [59.13,](#page-81-0) chúng ta thảo luận ngắn gọn về các API đã lỗi thời (obsolete APIs) (`inet_aton()`, `inet_ntoa()`, `gethostbyname()`, `getservbyname()`, v.v.).

```

## Chuyển đổi địa chỉ IPv4 giữa dạng nhị phân và dạng con người đọc được

Các hàm `inet_aton()` và `inet_ntoa()` chuyển đổi địa chỉ IPv4 theo ký pháp chấm-thập phân (dotted-decimal notation) sang dạng nhị phân và ngược lại. Chúng ta mô tả các hàm này chủ yếu vì chúng xuất hiện trong mã nguồn lịch sử (historical code). Ngày nay, chúng đã lỗi thời (obsolete). Các chương trình hiện đại cần thực hiện việc chuyển đổi này nên sử dụng các hàm mà chúng ta sẽ mô tả tiếp theo.

## Chuyển đổi địa chỉ IPv4 và IPv6 giữa dạng nhị phân và dạng con người đọc được

Các hàm `inet_pton()` và `inet_ntop()` tương tự như `inet_aton()` và `inet_ntoa()`, nhưng khác ở chỗ chúng cũng xử lý được địa chỉ IPv6. Chúng chuyển đổi địa chỉ IPv4 và IPv6 dạng nhị phân qua lại định dạng trình bày (presentation format) — nghĩa là ký pháp chấm-thập phân hoặc chuỗi thập lục phân (hexstring notation).

Vì con người dễ làm việc với tên gọi hơn là các con số, thông thường chúng ta chỉ thỉnh thoảng sử dụng các hàm này trong các chương trình. Một công dụng của `inet_ntop()` là tạo ra một biểu diễn có thể in được của địa chỉ IP nhằm mục đích ghi nhật ký (logging). Đôi khi, việc sử dụng hàm này sẽ tốt hơn so với việc chuyển đổi ("phân giải" - resolving) một địa chỉ IP thành tên máy chủ (hostname), vì các lý do sau:

- Phân giải một địa chỉ IP thành tên máy chủ liên quan đến một yêu cầu có thể tốn thời gian tới máy chủ DNS (DNS server).
- Trong một số trường hợp, có thể không có bản ghi DNS (bản ghi PTR) ánh xạ địa chỉ IP thành tên máy chủ tương ứng.

Chúng ta mô tả các hàm này (tại Mục [59.6](#page-57-0)) trước `getaddrinfo()` và `getnameinfo()`, các hàm thực hiện việc chuyển đổi giữa biểu diễn nhị phân và tên tượng trưng tương ứng, chủ yếu vì chúng cung cấp một API đơn giản hơn rất nhiều. Điều này cho phép chúng ta nhanh chóng minh họa một số ví dụ hoạt động về việc sử dụng Socket miền Internet (Internet domain socket).

## Chuyển đổi tên máy chủ và tên dịch vụ qua lại dạng nhị phân (Đã lỗi thời)

Hàm `gethostbyname()` trả về (các) địa chỉ IP nhị phân tương ứng với tên máy chủ (hostname) và hàm `getservbyname()` trả về số hiệu cổng (port number) tương ứng với tên dịch vụ (service name). Việc chuyển đổi ngược lại được thực hiện bởi `gethostbyaddr()` và `getservbyport()`. Chúng ta mô tả các hàm này vì chúng được sử dụng rộng rãi trong mã nguồn hiện có. Tuy nhiên, hiện tại chúng đã lỗi thời (SUSv3 đánh dấu các hàm này là lỗi thời và SUSv4 đã loại bỏ các thông số kỹ thuật của chúng). Mã nguồn mới nên sử dụng các hàm `getaddrinfo()` và `getnameinfo()` (được mô tả tiếp theo) cho các phép chuyển đổi này.

## Chuyển đổi tên máy chủ và tên dịch vụ qua lại dạng nhị phân (Hiện đại)

Hàm `getaddrinfo()` là sự kế thừa hiện đại cho cả `gethostbyname()` và `getservbyname()`. Nhận vào tên máy chủ và tên dịch vụ, `getaddrinfo()` trả về một tập hợp các cấu trúc chứa (các) địa chỉ IP nhị phân và số hiệu cổng tương ứng. Không giống như `gethostbyname()`, `getaddrinfo()` xử lý một cách trong suốt (transparently) cả địa chỉ IPv4 và IPv6. Do đó, chúng ta có thể sử dụng nó để viết các chương trình không phụ thuộc vào phiên bản IP đang được sử dụng. Tất cả mã nguồn mới nên sử dụng `getaddrinfo()` để chuyển đổi tên máy chủ và tên dịch vụ sang biểu diễn nhị phân.

Hàm `getnameinfo()` thực hiện phép dịch ngược lại, chuyển đổi địa chỉ IP và số hiệu cổng thành tên máy chủ và tên dịch vụ tương ứng.

Chúng ta cũng có thể sử dụng `getaddrinfo()` và `getnameinfo()` để chuyển đổi địa chỉ IP nhị phân qua lại định dạng trình bày.

Thảo luận về `getaddrinfo()` và `getnameinfo()` tại Mục [59.10](#page-64-0), đòi hỏi phải có phần mô tả đi kèm về DNS (Mục [59.8](#page-60-0)) và tệp `/etc/services` (Mục [59.9](#page-63-0)). DNS cho phép các máy chủ cộng tác duy trì một cơ sở dữ liệu phân tán (distributed database) ánh xạ địa chỉ IP nhị phân thành tên máy chủ và ngược lại. Sự tồn tại của một hệ thống như DNS đóng vai trò thiết yếu đối với hoạt động của Internet, vì việc quản lý tập trung một tập hợp khổng lồ các tên máy chủ trên Internet là điều bất khả thi. Tệp `/etc/services` ánh xạ các số hiệu cổng thành tên dịch vụ mang tính tượng trưng.

## 59.6 Các hàm inet\_pton() và inet\_ntop()

Các hàm `inet_pton()` và `inet_ntop()` cho phép chuyển đổi cả địa chỉ IPv4 và IPv6 giữa dạng nhị phân và ký pháp chấm-thập phân hoặc chuỗi thập lục phân.

```c

## include <arpa/inet.h>

int inet_pton(int domain, const char *src_str, void *addrptr);
Trả về 1 khi chuyển đổi thành công, 0 nếu src_str không ở
định dạng trình bày, hoặc –1 khi có lỗi
const char *inet_ntop(int domain, const void *addrptr, char *dst_str, size_t len);
Trả về con trỏ trỏ tới dst_str khi thành công, hoặc NULL khi có lỗi

```

Ký tự `p` trong tên của các hàm này là viết tắt của "presentation" (trình bày), và ký tự `n` là viết tắt của "network" (mạng). Định dạng trình bày là một chuỗi con người đọc được, chẳng hạn như:

- 204.152.189.116 (địa chỉ IPv4 chấm-thập phân);
- `::1` (địa chỉ IPv6 phân tách bằng dấu hai chấm theo hệ thập lục phân); hoặc
- `::FFFF:204.152.189.116` (địa chỉ IPv6 được ánh xạ từ IPv4 - IPv4-mapped IPv6 address).

Hàm `inet_pton()` chuyển đổi chuỗi trình bày có trong `src_str` thành địa chỉ IP nhị phân theo thứ tự byte mạng (network byte order). Đối số `domain` cần được chỉ định là `AF_INET` hoặc `AF_INET6`. Địa chỉ đã được chuyển đổi sẽ được lưu vào cấu trúc do `addrptr` trỏ tới, con trỏ này phải trỏ đến cấu trúc `in_addr` hoặc `in6_addr`, tùy thuộc vào giá trị được chỉ định trong `domain`.

Hàm `inet_ntop()` thực hiện quá trình chuyển đổi ngược lại. Tương tự, domain phải được chỉ định là `AF_INET` hoặc `AF_INET6`, và `addrptr` phải trỏ đến cấu trúc `in_addr` hoặc `in6_addr` mà chúng ta muốn chuyển đổi. Chuỗi kết quả có ký tự null kết thúc (null-terminated string) được đặt vào bộ đệm (buffer) do `dst_str` trỏ tới. Đối số `len` phải chỉ định kích thước của bộ đệm này. Khi thành công, `inet_ntop()` trả về `dst_str`. Nếu `len` quá nhỏ, `inet_ntop()` trả về `NULL` và `errno` được thiết lập thành `ENOSPC`.

Để định kích thước chính xác cho bộ đệm do `dst_str` trỏ tới, chúng ta có thể sử dụng hai hằng số được định nghĩa trong `<netinet/in.h>`. Các hằng số này biểu thị độ dài tối đa (bao gồm cả byte null kết thúc) của các chuỗi biểu diễn (presentation string) cho địa chỉ IPv4 và IPv6:

```c

## define INET_ADDRSTRLEN 16  /* Maximum IPv4 dotted-decimal string */

## define INET6_ADDRSTRLEN 46 /* Maximum IPv6 hexadecimal string */

```

Chúng tôi cung cấp các ví dụ về việc sử dụng `inet_pton()` và `inet_ntop()` trong phần tiếp theo.

## 59.7 Ví dụ về Client-Server (Datagram Socket)

Trong phần này, chúng ta lấy các chương trình server và client chuyển đổi chữ hoa-chữ thường được trình bày trong Mục [57.3](#page-22-2) và sửa đổi chúng để sử dụng datagram socket trong domain `AF_INET6`. Chúng tôi trình bày các chương trình này với lượng chú thích tối thiểu, vì cấu trúc của chúng tương tự như các chương trình trước đó. Sự khác biệt chính trong các chương trình mới nằm ở việc khai báo và khởi tạo cấu trúc địa chỉ socket IPv6, điều mà chúng tôi đã mô tả trong Mục [59.4.](#page-53-0)

Cả client và server đều sử dụng tệp tiêu đề (header file) được hiển thị trong [Liệt kê 59-2.](#page-58-0) Tệp tiêu đề này định nghĩa số hiệu cổng (port number) của server và kích thước tối đa của các thông điệp mà client và server có thể trao đổi với nhau.

**Liệt kê 59-2:** Tệp tiêu đề được sử dụng bởi `i6d_ucase_sv.c` và `i6d_ucase_cl.c`

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/i6d_ucase.h

## include <netinet/in.h>

## include <arpa/inet.h>

## include <sys/socket.h>

## include <ctype.h>

## include "tlpi_hdr.h"

## define BUF_SIZE 10 /* Maximum size of messages exchanged

between client and server */

## define PORT_NUM 50002 /* Server port number */

–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/i6d_ucase.h

```

[Liệt kê 59-3](#page-59-0) hiển thị chương trình server. Server sử dụng hàm `inet_ntop()` để chuyển đổi địa chỉ host của client (được lấy thông qua lời gọi `recvfrom()`) sang dạng có thể in được.

Chương trình client được hiển thị trong [Liệt kê 59-4](#page-60-1) chứa hai sửa đổi đáng chú ý so với phiên bản domain UNIX trước đó ([Liệt kê 57-7](#page-24-1), ở trang [1173](#page-24-1)). Sự khác biệt đầu tiên là client giải thích đối số dòng lệnh (command-line argument) đầu tiên của nó là địa chỉ IPv6 của server. (Các đối số dòng lệnh còn lại được truyền dưới dạng các datagram riêng biệt tới server). Client chuyển đổi địa chỉ server sang dạng nhị phân bằng cách sử dụng `inet_pton()`. Sự khác biệt khác là client không bind socket của mình với một địa chỉ nào cả. Như đã lưu ý trong Mục [58.6.1](#page-39-0), nếu một Internet domain socket không được bind tới một địa chỉ, kernel sẽ bind socket đó tới một cổng tạm thời (ephemeral port) trên hệ thống host. Chúng ta có thể quan sát điều này trong nhật ký phiên shell sau đây, nơi chúng ta chạy server và client trên cùng một host:

```

$ ./i6d_ucase_sv &
[1] 31047
$ ./i6d_ucase_cl ::1 ciao Send to server on local host
Server received 4 bytes from (::1, 32770)
Response 1: CIAO

```

Từ kết quả đầu ra ở trên, chúng ta thấy rằng lời gọi `recvfrom()` của server đã có thể lấy được địa chỉ của socket phía client, bao gồm cả số hiệu cổng tạm thời, bất chấp thực tế là client không thực hiện thao tác `bind()`.

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/i6d_ucase_sv.c

## include "i6d_ucase.h"

int
main(int argc, char *argv[])
{
struct sockaddr_in6 svaddr, claddr;
int sfd, j;
ssize_t numBytes;
socklen_t len;
char buf[BUF_SIZE];
char claddrStr[INET6_ADDRSTRLEN];
sfd = socket(AF_INET6, SOCK_DGRAM, 0);
if (sfd == -1)
errExit("socket");
memset(&svaddr, 0, sizeof(struct sockaddr_in6));
svaddr.sin6_family = AF_INET6;
svaddr.sin6_addr = in6addr_any; /* Wildcard address */
svaddr.sin6_port = htons(PORT_NUM);
if (bind(sfd, (struct sockaddr *) &svaddr,
sizeof(struct sockaddr_in6)) == -1)
errExit("bind");
/* Receive messages, convert to uppercase, and return to client */
for (;;) {
len = sizeof(struct sockaddr_in6);
numBytes = recvfrom(sfd, buf, BUF_SIZE, 0,
(struct sockaddr *) &claddr, &len);
if (numBytes == -1)
errExit("recvfrom");
if (inet_ntop(AF_INET6, &claddr.sin6_addr, claddrStr,
INET6_ADDRSTRLEN) == NULL)
printf("Couldn't convert client address to string\n");
else
printf("Server received %ld bytes from (%s, %u)\n",
(long) numBytes, claddrStr, ntohs(claddr.sin6_port));
for (j = 0; j < numBytes; j++)
buf[j] = toupper((unsigned char) buf[j]);
if (sendto(sfd, buf, numBytes, 0, (struct sockaddr *) &claddr, len) !=
numBytes)
fatal("sendto");
}
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/i6d_ucase_sv.c

```

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/i6d_ucase_cl.c

## include "i6d_ucase.h"

int
main(int argc, char *argv[])
{
struct sockaddr_in6 svaddr;
int sfd, j;
size_t msgLen;
ssize_t numBytes;
char resp[BUF_SIZE];
if (argc < 3 || strcmp(argv[1], "--help") == 0)
usageErr("%s host-address msg...\n", argv[0]);
sfd = socket(AF_INET6, SOCK_DGRAM, 0); /* Tạo client socket */
if (sfd == -1)
errExit("socket");
memset(&svaddr, 0, sizeof(struct sockaddr_in6));
svaddr.sin6_family = AF_INET6;
svaddr.sin6_port = htons(PORT_NUM);
if (inet_pton(AF_INET6, argv[1], &svaddr.sin6_addr) <= 0)
fatal("inet_pton failed for address '%s'", argv[1]);
/* Gửi các thông điệp đến server; in các phản hồi ra màn hình chuẩn (stdout) */
for (j = 2; j < argc; j++) {
msgLen = strlen(argv[j]);
if (sendto(sfd, argv[j], msgLen, 0, (struct sockaddr *) &svaddr,
sizeof(struct sockaddr_in6)) != msgLen)
fatal("sendto");
numBytes = recvfrom(sfd, resp, BUF_SIZE, 0, NULL, NULL);
if (numBytes == -1)
errExit("recvfrom");
printf("Response %d: %.*s\n", j - 1, (int) numBytes, resp);
}
exit(EXIT_SUCCESS);
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/i6d_ucase_cl.c

```

## 59.8 Hệ thống tên miền (Domain Name System - DNS)

Trong Mục [59.10,](#page-64-0) chúng tôi mô tả hàm `getaddrinfo()`, hàm này dùng để lấy (các) địa chỉ IP tương ứng với một tên máy (hostname), và hàm `getnameinfo()`, thực hiện nhiệm vụ ngược lại. Tuy nhiên, trước khi tìm hiểu các hàm này, chúng ta sẽ giải thích cách DNS được sử dụng để duy trì mối quan hệ ánh xạ giữa tên máy và địa chỉ IP.

Trước khi DNS ra đời, các ánh xạ giữa tên máy và địa chỉ IP được định nghĩa trong một tệp cục bộ được duy trì thủ công là `/etc/hosts`, chứa các bản ghi có định dạng sau:

```

## IP-address canonical hostname [aliases]

127.0.0.1 localhost

```

Hàm `gethostbyname()` (tiền thân của `getaddrinfo()`) lấy địa chỉ IP bằng cách tìm kiếm trong tệp này, tìm kiếm sự trùng khớp với tên chính tắc (canonical hostname - tức là tên chính thức hoặc tên chính của máy chủ) hoặc một trong các bí danh (aliases) (tùy chọn, phân tách bằng khoảng trắng).

Tuy nhiên, cơ chế `/etc/hosts` có khả năng mở rộng (scale) rất kém, và sau đó trở nên bất khả thi khi số lượng máy chủ trong mạng tăng lên (ví dụ: mạng Internet với hàng triệu máy chủ). DNS được phát minh ra để giải quyết vấn đề này. Các tư tưởng cốt lõi của DNS bao gồm:

- Tên máy được tổ chức thành một không gian tên phân cấp (hierarchical namespace) [\(Hình 59-2](#page-62-0)). Mỗi nút trong hệ thống phân cấp DNS có một nhãn (tên), có độ dài tối đa lên tới 63 ký tự. Ở gốc của hệ thống phân cấp là một nút không tên, gọi là "gốc ẩn danh" (anonymous root).
- Tên miền (domain name) của một nút bao gồm tất cả các tên từ nút đó lên đến gốc được nối lại với nhau, mỗi tên được phân tách bằng một dấu chấm (.). Ví dụ, `google.com` là tên miền cho nút `google`.
- Tên miền đủ điều kiện (fully qualified domain name - FQDN), chẳng hạn như `www.kernel.org.`, xác định một máy chủ trong hệ thống phân cấp. Một tên miền đủ điều kiện được phân biệt bởi việc kết thúc bằng một dấu chấm, mặc dù trong nhiều ngữ cảnh, dấu chấm này có thể được lược bỏ.
- Không có một tổ chức hoặc hệ thống đơn lẻ nào quản lý toàn bộ hệ thống phân cấp. Thay vào đó, có một hệ thống phân cấp các máy chủ DNS (DNS server), mỗi máy chủ quản lý một nhánh (một vùng - zone) của cây. Thông thường, mỗi vùng có một máy chủ tên chính sơ cấp (primary master name server) và một hoặc nhiều máy chủ tên phụ (slave name server) (thỉnh thoảng cũng được gọi là máy chủ tên chính thứ cấp - secondary master name server), cung cấp khả năng dự phòng trong trường hợp máy chủ tên chính sơ cấp bị sự cố. Bản thân các vùng có thể được chia thành các vùng nhỏ hơn được quản lý riêng biệt. Khi một máy chủ được thêm vào trong một vùng, hoặc ánh xạ của tên máy sang địa chỉ IP bị thay đổi, quản trị viên chịu trách nhiệm về máy chủ tên cục bộ tương ứng sẽ cập nhật cơ sở dữ liệu tên trên máy chủ đó. (Không cần thay đổi thủ công nào trên cơ sở dữ liệu của bất kỳ máy chủ tên nào khác trong hệ thống phân cấp).

Việc triển khai máy chủ DNS được sử dụng trên Linux là gói phần mềm Berkeley Internet Name Domain (BIND) rất phổ biến, có tên là `named(8)`, do Internet Systems Consortium duy trì (http://www.isc.org/). Hoạt động của daemon này được điều khiển bởi tệp `/etc/named.conf` (xem trang tài liệu hướng dẫn `named.conf(5)`). Tài liệu tham khảo chính về DNS và BIND là [Albitz & Liu, 2006]. Thông tin về DNS cũng có thể được tìm thấy trong Chương 14 của [Stevens, 1994], Chương 11 của [Stevens et al., 2004], và Chương 24 của [Comer, 2000].

Khi một chương trình gọi `getaddrinfo()` để phân giải (resolve) (tức là lấy địa chỉ IP cho) một tên miền, `getaddrinfo()` sử dụng một tập hợp các hàm thư viện (thư viện resolver) giao tiếp với máy chủ DNS cục bộ. Nếu máy chủ này không thể cung cấp thông tin được yêu cầu, nó sẽ giao tiếp với các máy chủ DNS khác trong hệ thống phân cấp để lấy thông tin. Đôi khi, quá trình phân giải này có thể mất một khoảng thời gian đáng chú ý, và các máy chủ DNS sử dụng các kỹ thuật lưu trữ đệm (caching) để tránh việc giao tiếp không cần thiết đối với các tên miền được truy vấn thường xuyên.

Sử dụng phương pháp trên cho phép DNS xử lý các không gian tên (namespace) lớn và không yêu cầu quản lý tập trung các tên miền.

![](_page_62_Figure_1.jpeg)

**Hình 59-2:** Một tập con của hệ thống phân cấp DNS

### Yêu cầu phân giải đệ quy và lặp (Recursive and iterative resolution requests)

Các yêu cầu phân giải DNS thuộc hai loại: đệ quy (recursive) và lặp (iterative). Trong một yêu cầu đệ quy, bên yêu cầu (requester) đề nghị máy chủ (server) xử lý toàn bộ tác vụ phân giải, bao gồm cả tác vụ giao tiếp với bất kỳ máy chủ DNS nào khác nếu cần thiết. Khi một ứng dụng trên máy chủ cục bộ (local host) gọi hàm `getaddrinfo()`, hàm đó sẽ thực hiện một yêu cầu đệ quy đến máy chủ DNS cục bộ (local DNS server). Nếu bản thân máy chủ DNS cục bộ không có sẵn thông tin để thực hiện việc phân giải, nó sẽ tiến hành phân giải tên miền theo phương pháp lặp.

Chúng ta giải thích quá trình phân giải lặp thông qua một ví dụ. Giả sử máy chủ DNS cục bộ nhận được yêu cầu phân giải tên `www.otago.ac.nz`. Để làm điều này, trước tiên nó giao tiếp với một trong số ít máy chủ tên gốc (root name server) mà mọi máy chủ DNS đều bắt buộc phải biết. (Chúng ta có thể lấy danh sách các máy chủ này bằng lệnh `dig . NS` hoặc từ trang web tại http://www.root-servers.org/.) Với tên `www.otago.ac.nz`, máy chủ tên gốc sẽ chuyển hướng (refer) máy chủ DNS cục bộ đến một trong các máy chủ DNS thuộc miền `nz`. Máy chủ DNS cục bộ sau đó truy vấn máy chủ `nz` với tên `www.otago.ac.nz` và nhận được phản hồi chuyển hướng nó tiếp tục đến máy chủ `ac.nz`. Tiếp theo, máy chủ DNS cục bộ truy vấn máy chủ `ac.nz` với tên `www.otago.ac.nz` và lại được chuyển hướng đến máy chủ `otago.ac.nz`. Cuối cùng, máy chủ DNS cục bộ truy vấn máy chủ `otago.ac.nz` với tên `www.otago.ac.nz` và thu được địa chỉ IP cần thiết.

Nếu chúng ta cung cấp một tên miền chưa đầy đủ (incomplete domain name) cho hàm `gethostbyname()`, bộ giải quyết (resolver) sẽ cố gắng hoàn thiện nó trước khi tiến hành phân giải. Các quy tắc về cách một tên miền được hoàn thiện như thế nào được định nghĩa trong tệp `/etc/resolv.conf` (xem trang hướng dẫn thủ công `resolv.conf(5)`). Theo mặc định, bộ giải quyết sẽ ít nhất thử hoàn thiện bằng cách sử dụng tên miền của máy chủ cục bộ. Ví dụ, nếu chúng ta đăng nhập vào máy `oghma.otago.ac.nz` và gõ lệnh `ssh octavo`, truy vấn DNS kết quả sẽ là cho tên `octavo.otago.ac.nz`.

### Miền cấp cao nhất (Top-level domains)

Các nút nằm ngay bên dưới nút gốc ẩn danh (anonymous root) tạo thành các miền cấp cao nhất (Top-Level Domains - TLDs). (Bên dưới các miền này là các miền cấp hai - second-level domains, và cứ tiếp tục như vậy). Các TLD thuộc hai loại: chung (generic) và quốc gia (country).

Về mặt lịch sử, có bảy TLD chung, phần lớn trong số đó có thể được coi là mang tính quốc tế. Chúng ta đã minh họa bốn trong số các TLD chung ban đầu trong [Hình 59-2](#page-62-0). Ba TLD còn lại là `int`, `mil` và `gov`; hai TLD sau được dành riêng cho Hoa Kỳ. Trong thời gian gần đây, một số TLD chung mới đã được bổ sung (ví dụ: `info`, `name` và `museum`).

Mỗi quốc gia đều có một TLD quốc gia (hoặc theo địa lý) tương ứng (được chuẩn hóa theo tiêu chuẩn ISO 3166-1) với tên gồm 2 ký tự. Trong [Hình 59-2](#page-62-0), chúng ta đã thể hiện một số trong số chúng: `de` (Đức, Deutschland), `eu` (một TLD địa lý siêu quốc gia dành cho Liên minh Châu Âu), `nz` (New Zealand) và `us` (Hợp chủng quốc Hoa Kỳ). Một số quốc gia chia TLD của họ thành một tập hợp các miền cấp hai theo cách tương tự như các miền chung. Ví dụ, New Zealand có `ac.nz` (các tổ chức học thuật), `co.nz` (thương mại) và `govt.nz` (chính phủ).

## 59.9 Tệp /etc/services

Như đã lưu ý trong Mục [58.6.1](#page-39-0), các số hiệu cổng nổi tiếng (well-known port numbers) được đăng ký tập trung bởi IANA. Mỗi cổng này đều có một tên dịch vụ (service name) tương ứng. Do các số hiệu dịch vụ được quản lý tập trung và ít biến động hơn địa chỉ IP, một hệ thống tương đương với máy chủ DNS thường là không cần thiết. Thay vào đó, các số hiệu cổng và tên dịch vụ được ghi lại trong tệp `/etc/services`. Các hàm `getaddrinfo()` và `getnameinfo()` sử dụng thông tin trong tệp này để chuyển đổi tên dịch vụ thành số hiệu cổng và ngược lại.

Tệp `/etc/services` bao gồm các dòng chứa ba cột, như được thể hiện trong các ví dụ sau:

|        | # Service name port/protocol [aliases] |                                 |
|--------|----------------------------------------|---------------------------------|
| echo   | 7/tcp                                  | Echo<br># echo service          |
| echo   | 7/udp                                  | Echo                            |
| ssh    | 22/tcp                                 | # Secure Shell                  |
| ssh    | 22/udp                                 |                                 |
| telnet | 23/tcp                                 | # Telnet                        |
| telnet | 23/udp                                 |                                 |
| smtp   | 25/tcp                                 | # Simple Mail Transfer Protocol |
| smtp   | 25/udp                                 |                                 |

| domain | 53/tcp                                 | # Domain Name Server            |
| domain | 53/udp                                 |                                 |
| http   | 80/tcp                                 | # Hypertext Transfer Protocol   |
| http   | 80/udp                                 |                                 |
| ntp    | 123/tcp                                | # Network Time Protocol         |
| ntp    | 123/udp                                |                                 |
| login  | 513/tcp                                | # rlogin(1)                     |
| who    | 513/udp                                | # rwho(1)                       |
| shell  | 514/tcp                                | # rsh(1)                        |
| syslog | 514/udp                                | # syslog                        |

Giao thức thường là `tcp` hoặc `udp`. Các bí danh (alias) tùy chọn (được phân tách bằng khoảng trắng) chỉ định các tên thay thế cho dịch vụ. Ngoài các mục trên, các dòng có thể bao gồm các chú thích bắt đầu bằng ký tự `#`.

Như đã lưu ý trước đây, một số hiệu cổng (port number) cụ thể ám chỉ các thực thể riêng biệt đối với UDP và TCP, nhưng chính sách của IANA gán cả hai số hiệu cổng cho một dịch vụ, ngay cả khi dịch vụ đó chỉ sử dụng một giao thức. Ví dụ: telnet, ssh, HTTP và SMTP đều sử dụng TCP, nhưng cổng UDP tương ứng cũng được gán cho các dịch vụ này. Ngược lại, NTP chỉ sử dụng UDP, nhưng cổng TCP 123 cũng được gán cho dịch vụ này. Trong một số trường hợp, một dịch vụ sử dụng cả UDP và TCP; DNS và echo là những ví dụ về các dịch vụ như vậy. Cuối cùng, có rất ít trường hợp các cổng UDP và TCP có cùng số hiệu được gán cho các dịch vụ khác nhau; ví dụ, rsh sử dụng cổng TCP 514, trong khi tiến trình nền (daemon) syslog (Mục 37.5) sử dụng cổng UDP 514. Điều này là do các số hiệu cổng này đã được gán trước khi chính sách hiện tại của IANA được áp dụng.

> Tệp `/etc/services` đơn thuần là một bản ghi các ánh xạ tên-sang-số. Nó không phải là một cơ chế đặt trước: sự xuất hiện của một số hiệu cổng trong `/etc/services` không đảm bảo rằng nó thực sự sẽ khả dụng để liên kết (binding) bởi một dịch vụ cụ thể.

## 59.10 Chuyển đổi Host và Service Độc lập với Giao thức

Hàm `getaddrinfo()` chuyển đổi tên host và service thành địa chỉ IP và số hiệu cổng. Nó được định nghĩa trong POSIX.1g như là một kế nhiệm (có thể tái nhập - reentrant) thay thế cho các hàm lỗi thời `gethostbyname()` và `getservbyname()`. (Việc thay thế việc sử dụng `gethostbyname()` bằng `getaddrinfo()` cho phép chúng ta loại bỏ sự phụ thuộc giữa IPv4 và IPv6 khỏi các chương trình của mình.)

Hàm `getnameinfo()` là hàm ngược lại của `getaddrinfo()`. Nó dịch một cấu trúc địa chỉ socket (socket address structure) (hoặc IPv4 hoặc IPv6) thành các chuỗi chứa tên host và service tương ứng. Hàm này là tương đương (có thể tái nhập - reentrant) của các hàm lỗi thời `gethostbyaddr()` và `getservbyport()`.

> Chương 11 của [Stevens et al., 2004] mô tả chi tiết về `getaddrinfo()` và `getnameinfo()`, đồng thời cung cấp các bản cài đặt của các hàm này. Các hàm này cũng được mô tả trong RFC 3493.

### 59.10.1 Hàm getaddrinfo()

Được cung cấp một tên host và một tên service, `getaddrinfo()` trả về một danh sách các cấu trúc địa chỉ socket, mỗi cấu trúc chứa một địa chỉ IP và số hiệu cổng.

```c

## include <sys/socket.h>

## include <netdb.h>

int getaddrinfo(const char *host, const char *service,
const struct addrinfo *hints, struct addrinfo **result);
Trả về 0 khi thành công, hoặc một số khác 0 khi lỗi

```

Là các đầu vào, `getaddrinfo()` nhận các đối số `host`, `service` và `hints`. Đối số `host` chứa tên host hoặc một chuỗi địa chỉ dạng số, được thể hiện theo ký pháp thập phân có dấu chấm của IPv4 (IPv4 dotted-decimal notation) hoặc ký pháp chuỗi hex của IPv6. (Chính xác hơn, `getaddrinfo()` chấp nhận các chuỗi số IPv4 theo ký pháp số-và-dấm-chấm tổng quát hơn được mô tả ở Mục [59.13.1](#page-81-1).) Đối số `service` chứa tên service hoặc một số hiệu cổng dạng thập phân. Đối số `hints` trỏ đến một cấu trúc `addrinfo` chỉ định các tiêu chí sâu hơn để chọn các cấu trúc địa chỉ socket được trả về thông qua `result`. Chúng ta sẽ mô tả chi tiết hơn về đối số `hints` bên dưới.

Là đầu ra, `getaddrinfo()` cấp phát động một danh sách liên kết (linked list) các cấu trúc `addrinfo` và thiết lập `result` trỏ đến phần đầu của danh sách này. Mỗi cấu trúc `addrinfo` này bao gồm một con trỏ trỏ đến một cấu trúc địa chỉ socket tương ứng với `host` và `service` ([Hình 59-3](#page-66-0)). Cấu trúc `addrinfo` có dạng sau:

```

struct addrinfo {
int ai_flags; /* Các cờ đầu vào (hằng số AI_*) */
int ai_family; /* Họ địa chỉ (Address family) */
int ai_socktype; /* Kiểu: SOCK_STREAM, SOCK_DGRAM */
int ai_protocol; /* Giao thức socket */
size_t ai_addrlen; /* Kích thước của cấu trúc mà ai_addr trỏ tới */
char *ai_canonname; /* Tên chuẩn tắc (canonical name) của host */
struct sockaddr *ai_addr; /* Con trỏ tới cấu trúc địa chỉ socket */
struct addrinfo *ai_next; /* Cấu trúc tiếp theo trong danh sách liên kết */
};

```

Tham số `result` trả về một danh sách các cấu trúc (structures) thay vì một cấu trúc đơn lẻ, bởi vì có thể có nhiều tổ hợp giữa host (máy chủ) và service (dịch vụ) tương ứng với các tiêu chí được chỉ định trong `host`, `service` và `hints`. Ví dụ, nhiều cấu trúc địa chỉ có thể được trả về cho một máy chủ có nhiều hơn một giao diện mạng (network interface). Hơn nữa, nếu `hints.ai_socktype` được chỉ định là 0, thì hai cấu trúc có thể được trả về — một cho socket `SOCK_DGRAM`, cấu trúc kia cho socket `SOCK_STREAM` — nếu dịch vụ được cho khả dụng cho cả UDP và TCP.

Các trường của mỗi cấu trúc `addrinfo` được trả về thông qua `result` mô tả các thuộc tính của cấu trúc địa chỉ socket (socket address structure) liên quan. Trường `ai_family` được đặt thành `AF_INET` hoặc `AF_INET6`, cho chúng ta biết loại cấu trúc địa chỉ socket. Trường `ai_socktype` được đặt thành `SOCK_STREAM` hoặc `SOCK_DGRAM`, cho biết cấu trúc địa chỉ này dành cho dịch vụ TCP hay UDP. Trường `ai_protocol` trả về một giá trị giao thức (protocol value) phù hợp với họ địa chỉ (address family) và loại socket. (Ba trường `ai_family`, `ai_socktype`, và `ai_protocol` cung cấp các giá trị cần thiết cho các tham số được sử dụng khi gọi `socket()` để tạo một socket cho địa chỉ này). Trường `ai_addrlen` cung cấp kích thước (tính bằng byte) của cấu trúc địa chỉ socket được trỏ tới bởi `ai_addr`. Trường `in_addr` trỏ tới cấu trúc địa chỉ socket (cấu trúc `in_addr` cho IPv4 hoặc cấu trúc `in6_addr` cho IPv6). Trường `ai_flags` không được sử dụng (nó được dùng cho tham số `hints`). Trường `ai_canonname` chỉ được sử dụng trong cấu trúc `addrinfo` đầu tiên, và chỉ khi cờ `AI_CANONNAME` được sử dụng trong `hints.ai_flags`, như được mô tả bên dưới.

Giống như `gethostbyname()`, `getaddrinfo()` có thể cần gửi một yêu cầu đến máy chủ DNS (DNS server), và yêu cầu này có thể mất một chút thời gian để hoàn tất. Điều tương tự cũng áp dụng cho `getnameinfo()`, mà chúng tôi mô tả trong Mục [59.10.4](#page-69-0).

Chúng tôi minh họa việc sử dụng `getaddrinfo()` trong Mục [59.11](#page-70-0).

![](_page_66_Picture_0.jpeg)

**Hình 59-3:** Các cấu trúc được cấp phát và trả về bởi `getaddrinfo()`

## Tham số hints

Tham số `hints` chỉ định các tiêu chí bổ sung để lựa chọn các cấu trúc địa chỉ socket được trả về bởi `getaddrinfo()`. Khi được sử dụng làm tham số `hints`, chỉ các trường `ai_flags`, `ai_family`, `ai_socktype`, và `ai_protocol` của cấu trúc `addrinfo` mới có thể được thiết lập. Các trường khác không được sử dụng và nên được khởi tạo về 0 hoặc `NULL`, tùy theo trường hợp phù hợp.

Trường `hints.ai_family` chọn miền (domain) cho các cấu trúc địa chỉ socket được trả về. Nó có thể được chỉ định là `AF_INET` hoặc `AF_INET6` (hoặc một hằng số `AF_*` nào khác, nếu hệ thống hỗ trợ). Nếu chúng ta quan tâm đến việc nhận lại tất cả các loại cấu trúc địa chỉ socket, chúng ta có thể chỉ định giá trị `AF_UNSPEC` cho trường này.

Trường `hints.ai_socktype` chỉ định loại socket mà cấu trúc địa chỉ được trả về sẽ được sử dụng cho nó. Nếu chúng ta chỉ định trường này là `SOCK_DGRAM`, thì một thao tác tra cứu (lookup) được thực hiện cho dịch vụ UDP, và cấu trúc địa chỉ socket tương ứng sẽ được trả về thông qua `result`. Nếu chúng ta chỉ định `SOCK_STREAM`, một thao tác tra cứu cho dịch vụ TCP sẽ được thực hiện. Nếu `hints.ai_socktype` được chỉ định là 0, bất kỳ loại socket nào cũng được chấp nhận.

Trường `hints.ai_protocol` chọn giao thức socket cho các cấu trúc địa chỉ được trả về. Đối với các mục đích của chúng ta, trường này luôn được chỉ định là 0, có nghĩa là bên gọi (caller) sẽ chấp nhận bất kỳ giao thức nào.

Trường `hints.ai_flags` là một mặt nạ bit (bit mask) làm thay đổi hànhvi của `getaddrinfo()`. Trường này được hình thành bằng cách kết hợp phép toán OR từ không hoặc nhiều giá trị sau đây:

### AI_ADDRCONFIG

Chỉ trả về các địa chỉ IPv4 nếu có ít nhất một địa chỉ IPv4 được cấu hình cho hệ thống cục bộ (local system) (ngoài địa chỉ IPv4 loopback), và chỉ trả về các địa chỉ IPv6 nếu có ít nhất một địa chỉ IPv6 được cấu hình cho hệ thống cục bộ (ngoài địa chỉ IPv6 loopback).

### AI_ALL

Xem phần mô tả về `AI_V4MAPPED` bên dưới.

### AI_CANONNAME

Nếu `host` không phải là `NULL`, trả về một con trỏ trỏ đến một chuỗi kết thúc bằng ký tự null chứa tên chính tắc (canonical name) của máy chủ. Con trỏ này được trả về trong một vùng đệm (buffer) được trỏ tới bởi trường `ai_canonname` của cấu trúc `addrinfo` đầu tiên trong số các cấu trúc được trả về thông qua `result`.

### AI_NUMERICHOST

Buộc diễn giải `host` dưới dạng một chuỗi địa chỉ dạng số (numeric address string). Điều này được sử dụng để ngăn chặn quá trình phân giải tên (name resolution) trong các trường hợp không cần thiết, vì quá trình phân giải tên có thể tốn nhiều thời gian.

### AI_NUMERICSERV

Diễn giải `service` dưới dạng một số hiệu cổng dạng số (numeric port number). Cờ này ngăn chặn việc gọi bất kỳ dịch vụ phân giải tên nào, vốn là không cần thiết nếu `service` là một chuỗi số.

### AI_PASSIVE

Trả về các cấu trúc địa chỉ socket phù hợp cho việc mở bị động (passive open) (tức là, một socket đang lắng nghe - listening socket). Trong trường hợp này, `host` phải là `NULL`, và thành phần địa chỉ IP của (các) cấu trúc địa chỉ socket được trả về bởi `result` sẽ chứa một địa chỉ IP đại diện tổng quát - wildcard (tức là `INADDR_ANY` hoặc `IN6ADDR_ANY_INIT`). Nếu cờ này không được thiết lập, thì (các) cấu trúc địa chỉ được trả về thông qua `result` sẽ phù hợp để sử dụng với `connect()` và `sendto()`; nếu `host` là `NULL`, thì địa chỉ IP trong các cấu trúc địa chỉ socket được trả về sẽ được đặt thành địa chỉ IP loopback (hoặc `INADDR_LOOPBACK` hoặc `IN6ADDR_LOOPBACK_INIT`, tùy theo miền).

### AI_V4MAPPED

Nếu `AF_INET6` được chỉ định trong trường `ai_family` của `hints`, thì các cấu trúc địa chỉ IPv6 ánh xạ IPv4 (IPv4-mapped IPv6 address structures) sẽ được trả về trong `result` nếu không tìm thấy địa chỉ IPv6 phù hợp nào. Nếu `AI_ALL` được chỉ định kết hợp với `AI_V4MAPPED`, thì cả cấu trúc địa chỉ IPv6 và IPv4 đều được trả về trong `result`, trong đó các địa chỉ IPv4 được trả về dưới dạng cấu trúc địa chỉ IPv6 ánh xạ IPv4.

Như đã lưu ý ở trên đối với `AI_PASSIVE`, `host` có thể được chỉ định là `NULL`. Cũng có thể chỉ định `service` là `NULL`, trong trường hợp đó số hiệu cổng (port number) trong các cấu trúc địa chỉ được trả về được đặt thành 0 (nghĩa là chúng ta chỉ quan tâm đến việc phân giải tên máy chủ thành địa chỉ). Tuy nhiên, không được phép chỉ định cả `host` và `service` đều là `NULL`.

Nếu chúng ta không cần chỉ định bất kỳ tiêu chí lựa chọn nào ở trên trong `hints`, thì `hints` có thể được chỉ định là `NULL`, trong trường hợp đó `ai_socktype` và `ai_protocol` được mặc định là 0, `ai_flags` được mặc định là `(AI_V4MAPPED | AI_ADDRCONFIG)`, và `ai_family` được mặc định là `AF_UNSPEC`. (Việc triển khai trong glibc có chủ ý đi lệch khỏi chuẩn SUSv3, vốn quy định rằng nếu `hints` là `NULL`, `ai_flags` sẽ được mặc định là 0).

### 59.10.2 Giải phóng Danh sách addrinfo: freeaddrinfo()

Hàm `getaddrinfo()` cấp phát bộ nhớ động (dynamically allocates memory) cho tất cả các cấu trúc được trỏ tới bởi `result` (Hình 59-3 [\(Figure 59-3](#page-66-0)). Do đó, tiến trình gọi (caller) phải giải phóng (deallocate) các cấu trúc này khi chúng không còn cần thiết nữa. Hàm `freeaddrinfo()` được cung cấp để thực hiện việc giải phóng này một cách thuận tiện chỉ trong một bước duy nhất.

```c

## include <sys/socket.h>

## include <netdb.h>

void freeaddrinfo(struct addrinfo *result);

```

Nếu chúng ta muốn giữ lại một bản sao của một trong các cấu trúc `addrinfo` hoặc cấu trúc địa chỉ socket (socket address structure) liên quan của nó, thì chúng ta phải nhân bản (duplicate) các cấu trúc trước khi gọi `freeaddrinfo()`.

### 59.10.3 Chẩn đoán Lỗi: gai_strerror()

Khi xảy ra lỗi, `getaddrinfo()` trả về một trong các mã lỗi khác không được hiển thị trong Bảng 59-1 ([Table 59-1.](#page-68-0))

| Bảng 59-1: Các mã lỗi trả về của getaddrinfo() và getnameinfo() |  |  |  |  |  |
|---------------------------------------------------------------|--|--|--|--|--|
|---------------------------------------------------------------|--|--|--|--|--|

| Hằng số lỗi | Mô tả |
|----------------|------------------------------------------------------------------------------|
| EAI_ADDRFAMILY | Không có địa chỉ nào cho host tồn tại trong hints.ai_family (không có trong SUSv3, nhưng được định nghĩa trên hầu hết các hệ thống; chỉ dành cho getaddrinfo()) |
| EAI_AGAIN      | Lỗi tạm thời trong quá trình phân giải tên (thử lại sau) |
| EAI_BADFLAGS   | Một cờ (flag) không hợp lệ đã được chỉ định trong hints.ai_flags |
| EAI_FAIL       | Lỗi không thể phục hồi khi truy cập máy chủ tên (name server) |
| EAI_FAMILY     | Họ địa chỉ (address family) được chỉ định trong hints.ai_family không được hỗ trợ |
| EAI_MEMORY     | Lỗi cấp phát bộ nhớ (memory allocation failure) |
| EAI_NODATA     | Không có địa chỉ nào được liên kết với host (không có trong SUSv3, nhưng được định nghĩa trên hầu hết các hệ thống; chỉ dành cho getaddrinfo()) |
| EAI_NONAME     | Không rõ host hoặc service, hoặc cả host và service đều là NULL, hoặc AI_NUMERICSERV được chỉ định nhưng service không trỏ tới chuỗi số |
| EAI_OVERFLOW   | Tràn bộ đệm đối số (argument buffer overflow) |
| EAI_SERVICE    | Service được chỉ định không được hỗ trợ cho hints.ai_socktype (chỉ dành cho getaddrinfo()) |
| EAI_SOCKTYPE   | hints.ai_socktype được chỉ định không được hỗ trợ (chỉ dành cho getaddrinfo()) |
| EAI_SYSTEM     | Lỗi hệ thống được trả về trong errno |

Nhận vào một trong các mã lỗi trong Bảng 59-1 ([Table 59-1](#page-68-0)), hàm `gai_strerror()` trả về một chuỗi mô tả lỗi. (Chuỗi này thường ngắn gọn hơn mô tả được hiển thị trong Bảng 59-1 ([Table 59-1](#page-68-0))).

```c

## include <netdb.h>

const char *gai_strerror(int errcode);
Trả về con trỏ tới chuỗi chứa thông báo lỗi

```

Chúng ta có thể sử dụng chuỗi do `gai_strerror()` trả về như một phần của thông báo lỗi được hiển thị bởi một ứng dụng.

### 59.10.4 Hàm getnameinfo()

Hàm `getnameinfo()` là hàm ngược lại của `getaddrinfo()`. Với một cấu trúc địa chỉ socket (socket address structure) cho trước (hoặc IPv4 hoặc IPv6), nó trả về các chuỗi chứa tên host (host name) và tên service (service name) tương ứng, hoặc các giá trị tương đương dạng số nếu không thể phân giải được tên.

```c

## include <sys/socket.h>

## include <netdb.h>

int getnameinfo(const struct sockaddr *addr, socklen_t addrlen, char *host,
size_t hostlen, char *service, size_t servlen, int flags);
Trả về 0 khi thành công, hoặc khác 0 khi lỗi

```

Tham số `addr` là một con trỏ trỏ tới cấu trúc địa chỉ socket cần được chuyển đổi. Kích thước của cấu trúc đó được chỉ định trong `addrlen`. Thông thường, các giá trị cho `addr` và `addrlen` được lấy từ một lời gọi tới `accept()`, `recvfrom()`, `getsockname()`, hoặc `getpeername()`.

Tên host và service kết quả được trả về dưới dạng chuỗi kết thúc bằng ký tự null (null-terminated strings) trong các bộ đệm (buffers) do `host` và `service` trỏ tới. Các bộ đệm này phải được cấp phát bởi tiến trình gọi (caller), và kích thước của chúng phải được truyền vào qua `hostlen` và `servlen`. Tệp tiêu đề `<netdb.h>` định nghĩa hai hằng số để hỗ trợ việc xác định kích thước cho các bộ đệm này. `NI_MAXHOST` chỉ ra kích thước tối đa, tính bằng byte, cho chuỗi tên host được trả về. Nó được định nghĩa là 1025. `NI_MAXSERV` chỉ ra kích thước tối đa, tính bằng byte, cho chuỗi tên service được trả về. Nó được định nghĩa là 32. Hai hằng số này không được quy định trong SUSv3, nhưng chúng được định nghĩa trên tất cả các cài đặt UNIX cung cấp hàm `getnameinfo()`. (Kể từ glibc 2.8, chúng ta phải định nghĩa một trong các macro tính năng `_BSD_SOURCE`, `_SVID_SOURCE`, hoặc `_GNU_SOURCE` để có được các định nghĩa của `NI_MAXHOST` và `NI_MAXSERV`.)

Nếu chúng ta không quan tâm đến việc lấy tên host, chúng ta có thể chỉ định `host` là `NULL` và `hostlen` là 0. Tương tự, nếu chúng ta không cần tên service, chúng ta có thể chỉ định `service` là `NULL` và `servlen` là 0. Tuy nhiên, ít nhất một trong hai tham số `host` hoặc `service` phải khác `NULL` (và tham số kích thước tương ứng phải khác 0).

Tham số cuối cùng, `flags`, là một mặt nạ bit (bit mask) điều khiển hành vi của `getnameinfo()`. Các hằng số sau đây có thể được kết hợp bằng phép toán OR (`|`) để tạo thành mặt nạ bit này:

`NI_DGRAM`

Theo mặc định, `getnameinfo()` trả về tên tương ứng với một service socket hướng kết nối (stream socket) (tức là TCP). Thông thường, điều này không quan trọng, bởi vì như đã lưu ý trong Mục [59.9](#page-63-0), tên các service thường giống nhau đối với các cổng TCP và UDP tương ứng. Tuy nhiên, trong một vài trường hợp tên khác nhau, cờ `NI_DGRAM` ép buộc trả về tên của service socket datagram (tức là UDP).

### `NI_NAMEREQD`

Theo mặc định, nếu không thể phân giải được tên host, một chuỗi địa chỉ dạng số sẽ được trả về trong `host`. Nếu cờ `NI_NAMEREQD` được chỉ định, một lỗi (`EAI_NONAME`) sẽ được trả về thay thế.

### `NI_NOFQDN`

Theo mặc định, tên miền đủ điều kiện hoàn toàn (fully qualified domain name) của host sẽ được trả về. Việc chỉ định cờ `NI_NOFQDN` làm cho chỉ phần đầu tiên (tức là tên host) của tên được trả về, nếu đây là một host trên mạng cục bộ.

### `NI_NUMERICHOST`

Ép buộc trả về một chuỗi địa chỉ dạng số trong `host`. Điều này hữu ích nếu chúng ta muốn tránh một lời gọi có khả năng tốn thời gian tới máy chủ DNS.

### `NI_NUMERICSERV`

Ép buộc trả về một chuỗi số hiệu cổng thập phân trong `service`. Điều này hữu ích trong các trường hợp chúng ta biết rằng số hiệu cổng không tương ứng với tên service — ví dụ, nếu đó là một số hiệu cổng tạm thời (ephemeral port number) được gán cho socket bởi kernel — và chúng ta muốn tránh sự kém hiệu quả do việc tìm kiếm không cần thiết trong tệp `/etc/services`.

Khi thành công, `getnameinfo()` trả về 0. Khi lỗi, nó trả về một trong các mã lỗi khác 0 được hiển thị trong [Bảng 59-1](#page-68-0).

## 59.11 Ví dụ về Client-Server (Stream Sockets)

Bây giờ chúng ta đã có đủ thông tin để xem xét một ứng dụng client-server đơn giản sử dụng TCP socket. Công việc được thực hiện bởi ứng dụng này cũng giống như công việc được thực hiện bởi ứng dụng FIFO client-server được trình bày trong Mục 44.8: cấp phát các số thứ tự duy nhất (hoặc các dải số thứ tự) cho các client.

Để xử lý khả năng các số nguyên (integers) có thể được biểu diễn theo các định dạng khác nhau trên host server và client, chúng ta mã hóa tất cả các số nguyên được truyền đi dưới dạng chuỗi kết thúc bằng ký tự xuống dòng (newline), và sử dụng hàm `readLine()` của chúng ta ([Liệt kê 59-1](#page-52-0)) để đọc các chuỗi này.

### Tệp tiêu đề chung (Common header file)

Cả server và client đều bao gồm tệp tiêu đề được hiển thị trong [Liệt kê 59-5](#page-71-0). Tệp này bao gồm nhiều tệp tiêu đề khác nhau và định nghĩa số cổng TCP sẽ được sử dụng bởi ứng dụng.

### Chương trình Server

Chương trình server được hiển thị trong [Liệt kê 59-6](#page-72-0) thực hiện các bước sau:

 Khởi tạo số thứ tự của server là 1 hoặc là giá trị được cung cấp trong tham số dòng lệnh tùy chọn `q`.

-  Bỏ qua tín hiệu `SIGPIPE` `w`. Điều này ngăn không cho server nhận tín hiệu `SIGPIPE` nếu nó cố gắng ghi vào một socket có phía bên kia (peer) đã bị đóng; thay vào đó, lời gọi `write()` sẽ thất bại với lỗi `EPIPE`.

- Gọi `getaddrinfo()` r để lấy một tập hợp các cấu trúc địa chỉ socket (socket address structures) cho một TCP socket sử dụng số hiệu cổng `PORT_NUM`. (Thay vì sử dụng một số hiệu cổng được mã hóa cứng (hard-coded), thông thường chúng ta sẽ sử dụng tên dịch vụ (service name).) Chúng ta chỉ định cờ `AI_PASSIVE` e để socket kết quả được bind (gắn kết) vào địa chỉ wildcard (địa chỉ đại diện) (Mục [58.5](#page-37-1)). Kết quả là, nếu máy chủ chạy trên một host đa giao diện (multihomed host), nó có thể chấp nhận các yêu cầu kết nối được gửi đến bất kỳ địa chỉ mạng nào của host đó.
- Bước vào một vòng lặp duyệt qua các cấu trúc địa chỉ socket trả về bởi bước trước t. Vòng lặp kết thúc khi chương trình tìm thấy một cấu trúc địa chỉ có thể được sử dụng để tạo và bind socket thành công u.
- Thiết lập tùy chọn `SO_REUSEADDR` cho socket được tạo ở bước trước y. Chúng ta hoãn thảo luận về tùy chọn này cho đến Mục [61.10,](#page-130-0) nơi chúng ta lưu ý rằng một TCP server nên luôn thiết lập tùy chọn này trên socket lắng nghe (listening socket) của nó.
- Đánh dấu socket là một socket lắng nghe i.
- Bắt đầu một vòng lặp `for` vô hạn o để phục vụ các client theo phương thức lặp (iterative) (Chương [60](#page-90-0)). Yêu cầu của mỗi client được phục vụ trước khi yêu cầu của client tiếp theo được chấp nhận. Đối với mỗi client, server thực hiện các bước sau:
  - Chấp nhận một kết nối mới a. Server truyền các con trỏ khác NULL (non-NULL pointers) cho đối số thứ hai và thứ ba của hàm `accept()`, nhằm lấy được địa chỉ của client. Server hiển thị địa chỉ của client (địa chỉ IP cộng với số hiệu cổng) lên thiết bị xuất chuẩn (standard output) s.
  - Đọc thông điệp của client d, bao gồm một chuỗi kết thúc bằng ký tự xuống dòng (newline-terminated string) chỉ định số lượng số thứ tự (sequence numbers) mà client muốn. Server chuyển đổi chuỗi này thành một số nguyên và lưu trữ nó trong biến `reqLen` f.
  - Gửi giá trị hiện tại của số thứ tự (`seqNum`) trở lại client, mã hóa nó dưới dạng một chuỗi kết thúc bằng ký tự xuống dòng g. Client có thể giả định rằng nó đã được cấp phát tất cả các số thứ tự trong dải từ `seqNum` đến `(seqNum + reqLen – 1)`.
  - Cập nhật giá trị số thứ tự của server bằng cách cộng `reqLen` vào `seqNum` h.

**Listing 59-5:** Tệp tiêu đề (header file) được sử dụng bởi is\_seqnum\_sv.c và is\_seqnum\_cl.c

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_seqnum.h

## include <netinet/in.h>

## include <sys/socket.h>

## include <signal.h>

## include "read_line.h" /* Declaration of readLine() */

## include "tlpi_hdr.h"

## define PORT_NUM "50000" /* Port number for server */

## define INT_LEN 30 /* Size of string able to hold largest

integer (including terminating '\n') */
–––––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_seqnum.h

```

**Listing 59-6:** Một iterative server sử dụng stream socket để giao tiếp với các client

```c

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_seqnum_sv.c

## define _BSD_SOURCE /* To get definitions of NI_MAXHOST and

NI_MAXSERV from <netdb.h> */

## include <netdb.h>

## include "is_seqnum.h"

## define BACKLOG 50

int
main(int argc, char *argv[])
{
uint32_t seqNum;
char reqLenStr[INT_LEN]; /* Length of requested sequence */
char seqNumStr[INT_LEN]; /* Start of granted sequence */
struct sockaddr_storage claddr;
int lfd, cfd, optval, reqLen;
socklen_t addrlen;
struct addrinfo hints;
struct addrinfo *result, *rp;

## define ADDRSTRLEN (NI_MAXHOST + NI_MAXSERV + 10)

char addrStr[ADDRSTRLEN];
char host[NI_MAXHOST];
char service[NI_MAXSERV];
if (argc > 1 && strcmp(argv[1], "--help") == 0)
usageErr("%s [init-seq-num]\n", argv[0]);
q seqNum = (argc > 1) ? getInt(argv[1], 0, "init-seq-num") : 0;
w if (signal(SIGPIPE, SIG_IGN) == SIG_ERR)
errExit("signal");
/* Call getaddrinfo() to obtain a list of addresses that
we can try binding to */
memset(&hints, 0, sizeof(struct addrinfo));
hints.ai_canonname = NULL;
hints.ai_addr = NULL;
hints.ai_next = NULL;
hints.ai_socktype = SOCK_STREAM;
hints.ai_family = AF_UNSPEC; /* Allows IPv4 or IPv6 */
e hints.ai_flags = AI_PASSIVE | AI_NUMERICSERV;
/* Wildcard IP address; service name is numeric */
r if (getaddrinfo(NULL, PORT_NUM, &hints, &result) != 0)
errExit("getaddrinfo");
/* Walk through returned list until we find an address structure
that can be used to successfully create and bind a socket */
optval = 1;
t for (rp = result; rp != NULL; rp = rp->ai_next) {
lfd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
if (lfd == -1)
continue; /* On error, try next address */

```

```c

y if (setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval))
== -1)
errExit("setsockopt");
u if (bind(lfd, rp->ai_addr, rp->ai_addrlen) == 0)
break; /* Success */
/* bind() failed: close this socket and try next address */
close(lfd);
}
if (rp == NULL)
fatal("Could not bind socket to any address");
i if (listen(lfd, BACKLOG) == -1)
errExit("listen");
freeaddrinfo(result);
o for (;;) { /* Handle clients iteratively */
/* Accept a client connection, obtaining client's address */
addrlen = sizeof(struct sockaddr_storage);
a cfd = accept(lfd, (struct sockaddr *) &claddr, &addrlen);
if (cfd == -1) {
errMsg("accept");
continue;
}
s if (getnameinfo((struct sockaddr *) &claddr, addrlen,
host, NI_MAXHOST, service, NI_MAXSERV, 0) == 0)
snprintf(addrStr, ADDRSTRLEN, "(%s, %s)", host, service);
else
snprintf(addrStr, ADDRSTRLEN, "(?UNKNOWN?)");
printf("Connection from %s\n", addrStr);
/* Read client request, send sequence number back */
d if (readLine(cfd, reqLenStr, INT_LEN) <= 0) {
close(cfd);
continue; /* Failed read; skip request */
}
f reqLen = atoi(reqLenStr);
if (reqLen <= 0) { /* Watch for misbehaving clients */
close(cfd);
continue; /* Bad request; skip it */
}
g snprintf(seqNumStr, INT_LEN, "%d\n", seqNum);
if (write(cfd, &seqNumStr, strlen(seqNumStr)) != strlen(seqNumStr))
fprintf(stderr, "Error on write");

```

```

seqNum += reqLen; /* Cập nhật số thứ tự (sequence number) */
if (close(cfd) == -1) /* Đóng kết nối (connection) */
errMsg("close");
}
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_seqnum_sv.c

```

### Chương trình Client

Chương trình client được thể hiện trong [Listing 59-7.](#page-75-0) Chương trình này nhận hai tham số dòng lệnh. Tham số đầu tiên là tên của host mà server đang chạy, đây là tham số bắt buộc. Tham số thứ hai (không bắt buộc) là độ dài của chuỗi (sequence) mà client muốn yêu cầu. Độ dài mặc định là 1. Client thực hiện các bước sau:

- Gọi `getaddrinfo()` để lấy một tập hợp các cấu trúc địa chỉ socket (socket address structures) phù hợp để kết nối với một TCP server được gắn kết (bound) với host q chỉ định. Đối với số hiệu cổng (port number), client chỉ định `PORT_NUM`.
- Vào một vòng lặp w duyệt qua các cấu trúc địa chỉ socket được trả về từ bước trước, cho đến khi client tìm thấy một cấu trúc có thể được sử dụng để tạo thành công e và kết nối r một socket tới server. Vì client chưa thực hiện bind socket của mình, lời gọi `connect()` khiến kernel gán một cổng tạm thời (ephemeral port) cho socket.
- Gửi một số nguyên chỉ định độ dài chuỗi mà client mong muốn t. Số nguyên này được gửi dưới dạng một chuỗi ký tự kết thúc bằng ký tự xuống dòng (newline-terminated string).
- Đọc số thứ tự do server gửi lại (cũng là một chuỗi kết thúc bằng ký tự xuống dòng) y và in nó ra màn hình chuẩn (standard output) u.

Khi chúng ta chạy server và client trên cùng một host, chúng ta thấy kết quả như sau:

```

$ ./is_seqnum_sv &
[1] 4075
$ ./is_seqnum_cl localhost Client 1: yêu cầu 1 số thứ tự
Connection from (localhost, 33273) Server hiển thị địa chỉ + cổng của client
Sequence number: 0 Client hiển thị số thứ tự được trả về
$ ./is_seqnum_cl localhost 10 Client 2: yêu cầu 10 số thứ tự
Connection from (localhost, 33274)
Sequence number: 1
$ ./is_seqnum_cl localhost Client 3: yêu cầu 1 số thứ tự
Connection from (localhost, 33275)
Sequence number: 11

```

Tiếp theo, chúng ta minh họa việc sử dụng `telnet` để gỡ lỗi (debug) ứng dụng này:

```

$ telnet localhost 50000 Server của chúng ta sử dụng số cổng này
Dòng trống được in bởi telnet
Trying 127.0.0.1...
Connection from (localhost, 33276)
Connected to localhost.
Escape character is '^]'.
1 Nhập độ dài của chuỗi được yêu cầu
12 telnet hiển thị số thứ tự và
Connection closed by foreign host. phát hiện rằng server đã đóng kết nối

```

Trong nhật ký phiên shell (shell session log), chúng ta thấy rằng kernel tuần tự quay vòng qua các số hiệu cổng tạm thời (ephemeral port numbers). (Các cài đặt khác cũng thể hiện hành vi tương tự). Trên Linux, hành vi này là kết quả của việc tối ưu hóa nhằm giảm thiểu việc tra cứu bảng băm (hash lookups) trong bảng liên kết socket cục bộ của kernel. Khi đạt đến giới hạn trên của các số này, kernel sẽ bắt đầu cấp phát lại một số khả dụng bắt đầu từ mức thấp của dải (được định nghĩa bởi tệp `/proc/sys/net/ipv4/ip_local_port_range` đặc trưng của Linux).

**Listing 59-7:** Một client sử dụng stream socket (stream sockets)

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_seqnum_cl.c

## include <netdb.h>

## include "is_seqnum.h"

int
main(int argc, char *argv[])
{
char *reqLenStr; /* Độ dài chuỗi được yêu cầu */
char seqNumStr[INT_LEN]; /* Điểm bắt đầu của chuỗi được cấp */
int cfd;
ssize_t numRead;
struct addrinfo hints;
struct addrinfo *result, *rp;
if (argc < 2 || strcmp(argv[1], "--help") == 0)
usageErr("%s server-host [sequence-len]\n", argv[0]);
/* Gọi getaddrinfo() để lấy danh sách các địa chỉ
mà chúng ta có thể thử kết nối */
memset(&hints, 0, sizeof(struct addrinfo));
hints.ai_canonname = NULL;
hints.ai_addr = NULL;
hints.ai_next = NULL;
hints.ai_family = AF_UNSPEC; /* Cho phép IPv4 hoặc IPv6 */
hints.ai_socktype = SOCK_STREAM;
hints.ai_flags = AI_NUMERICSERV;
q if (getaddrinfo(argv[1], PORT_NUM, &hints, &result) != 0)
errExit("getaddrinfo");
/* Duyệt qua danh sách được trả về cho đến khi tìm thấy một cấu trúc địa chỉ
có thể được sử dụng để kết nối socket thành công */
w for (rp = result; rp != NULL; rp = rp->ai_next) {
e cfd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
if (cfd == -1)
continue; /* Nếu lỗi, thử địa chỉ tiếp theo */
r if (connect(cfd, rp->ai_addr, rp->ai_addrlen) != -1)
break; /* Thành công */

```

```

/* Kết nối thất bại: đóng socket này và thử địa chỉ tiếp theo */
close(cfd);
}
if (rp == NULL)
fatal("Không thể kết nối socket tới bất kỳ địa chỉ nào");
freeaddrinfo(result);
/* Gửi độ dài chuỗi được yêu cầu, kèm theo ký tự xuống dòng kết thúc */
t reqLenStr = (argc > 2) ? argv[2] : "1";
if (write(cfd, reqLenStr, strlen(reqLenStr)) != strlen(reqLenStr))
fatal("Ghi một phần/thất bại (reqLenStr)");
if (write(cfd, "\n", 1) != 1)
fatal("Ghi một phần/thất bại (newline)");
/* Đọc và hiển thị số thứ tự được trả về bởi server */
y numRead = readLine(cfd, seqNumStr, INT_LEN);
if (numRead == -1)
errExit("readLine");
if (numRead == 0)
fatal("EOF bất ngờ từ server");
u printf("Sequence number: %s", seqNumStr); /* Bao gồm cả '\n' */
exit(EXIT_SUCCESS); /* Đóng 'cfd' */
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/is_seqnum_cl.c

```

## 59.12 Thư viện Internet Domain Sockets

Trong phần này, chúng ta sử dụng các hàm đã được trình bày ở Mục [59.10](#page-64-0) để triển khai một thư viện gồm các hàm thực hiện các tác vụ thường được yêu cầu đối với Internet domain sockets. (Thư viện này trừu tượng hóa nhiều bước được minh họa trong các chương trình mẫu ở Mục [59.11](#page-70-0)). Vì các hàm này sử dụng các hàm `getaddrinfo()` và `getnameinfo()` độc lập với giao thức (protocol-independent), nên chúng có thể được sử dụng với cả IPv4 và IPv6. [Liệt kê 59-8](#page-77-0) hiển thị tệp tiêu đề (header file) khai báo các hàm này.

Nhiều hàm trong thư viện này có các tham số tương tự nhau:

- Tham số `host` là một chuỗi chứa tên máy chủ (hostname) hoặc địa chỉ dạng số (theo định dạng IPv4 dotted-decimal hoặc IPv6 hex-string). Ngoài ra, `host` có thể được chỉ định là con trỏ `NULL` để biểu thị rằng địa chỉ IP loopback sẽ được sử dụng.
- Tham số `service` là tên dịch vụ hoặc số cổng (port number) được chỉ định dưới dạng chuỗi thập phân (decimal string).
- Tham số `type` là kiểu socket (socket type), được chỉ định là `SOCK_STREAM` hoặc `SOCK_DGRAM`.

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/inet_sockets.h

## ifndef INET_SOCKETS_H

## define INET_SOCKETS_H /* Prevent accidental double inclusion */

## include <sys/socket.h>

## include <netdb.h>

int inetConnect(const char *host, const char *service, int type);
int inetListen(const char *service, int backlog, socklen_t *addrlen);
int inetBind(const char *service, int type, socklen_t *addrlen);
char *inetAddressStr(const struct sockaddr *addr, socklen_t addrlen,
char *addrStr, int addrStrLen);

## define IS_ADDR_STR_LEN 4096

/* Suggested length for string buffer that caller
should pass to inetAddressStr(). Must be greater
than (NI_MAXHOST + NI_MAXSERV + 4) */

## endif

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/inet_sockets.h

```

Hàm `inetConnect()` tạo một socket với kiểu socket được cung cấp, và kết nối nó tới địa chỉ được chỉ định bởi `host` và `service`. Hàm này được thiết kế cho các TCP hoặc UDP client cần kết nối socket của chúng tới một server socket.

```

## include "inet_sockets.h"

int inetConnect(const char *host, const char *service, int type);
Trả về một file descriptor khi thành công, hoặc –1 khi lỗi

```

File descriptor của socket mới được trả về làm kết quả của hàm.

Hàm `inetListen()` tạo một socket stream đang lắng nghe (`SOCK_STREAM`) được bind tới địa chỉ IP đại diện chung (wildcard IP address) trên cổng TCP được chỉ định bởi `service`. Hàm này được thiết kế để sử dụng bởi các TCP server.

```

## include "inet_sockets.h"

int inetListen(const char *service, int backlog, socklen_t *addrlen);
Trả về một file descriptor khi thành công, hoặc –1 khi lỗi

```

File descriptor của socket mới được trả về làm kết quả của hàm.

Tham số `backlog` chỉ định giới hạn số lượng kết nối đang chờ (pending connections) được phép (giống như trong hàm `listen()`).

Nếu `addrlen` được chỉ định là một con trỏ khác `NULL`, thì vùng nhớ mà nó trỏ tới sẽ được dùng để trả về kích thước của cấu trúc địa chỉ socket tương ứng với file descriptor được trả về. Giá trị này cho phép chúng ta cấp phát một bộ đệm (buffer) địa chỉ socket với kích thước phù hợp để truyền vào lời gọi `accept()` sau đó nếu chúng ta muốn lấy địa chỉ của một client đang kết nối.

Hàm `inetBind()` tạo một socket với kiểu đã cho, được bind tới địa chỉ IP đại diện chung (wildcard IP address) trên cổng được chỉ định bởi `service` và `type`. (Kiểu socket cho biết đây là dịch vụ TCP hay UDP). Hàm này được thiết kế (chủ yếu) cho các UDP server và client để tạo một socket được bind tới một địa chỉ cụ thể.

```

## include "inet_sockets.h"

int inetBind(const char *service, int type, socklen_t *addrlen);
Trả về một file descriptor khi thành công, hoặc –1 khi lỗi

```

File descriptor của socket mới được trả về làm kết quả của hàm.

Giống như `inetListen()`, `inetBind()` trả về độ dài của cấu trúc địa chỉ socket liên kết với socket này tại vùng nhớ được trỏ tới bởi `addrlen`. Điều này hữu ích nếu chúng ta muốn cấp phát một bộ đệm để truyền vào `recvfrom()` nhằm lấy địa chỉ của socket gửi datagram. (Nhiều bước cần thiết cho `inetListen()` và `inetBind()` là giống nhau, và các bước này được triển khai bên trong thư viện bởi một hàm duy nhất là `inetPassiveSocket()`.)

Hàm `inetAddressStr()` chuyển đổi một địa chỉ Internet socket sang dạng có thể in được (printable form).

```

## include "inet_sockets.h"

char *inetAddressStr(const struct sockaddr *addr, socklen_t addrlen,
char *addrStr, int addrStrLen);
Trả về con trỏ tới addrStr, một chuỗi chứa tên host và service

```

Với một cấu trúc địa chỉ socket trong `addr`, có độ dài được chỉ định trong `addrlen`, `inetAddressStr()` trả về một chuỗi kết thúc bằng ký tự null (null-terminated string) chứa tên máy chủ và số cổng tương ứng theo định dạng sau:

```

(hostname, port-number)

```

Chuỗi ký tự này được trả về trong vùng đệm (buffer) do `addrStr` trỏ tới. Bên gọi (caller) phải chỉ định kích thước của vùng đệm này trong `addrStrLen`. Nếu chuỗi trả về vượt quá `(addrStrLen – 1)` byte, nó sẽ bị cắt cụt (truncated). Hằng số `IS_ADDR_STR_LEN` định nghĩa kích thước được đề xuất cho vùng đệm `addrStr`, đủ lớn để xử lý tất cả các chuỗi trả về có thể xảy ra. Với tư cách là kết quả hàm của nó, `inetAddressStr()` trả về `addrStr`.

Việc hiện thực (implementation) các hàm được mô tả trong phần này được trình bày tại [Listing 59-9.](#page-79-0)

```

–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/inet_sockets.c

## define _BSD_SOURCE /* To get NI_MAXHOST and NI_MAXSERV

definitions from <netdb.h> */

## include <sys/socket.h>

## include <netinet/in.h>

## include <arpa/inet.h>

## include <netdb.h>

## include "inet_sockets.h" /* Declares functions defined here */

## include "tlpi_hdr.h"

int
inetConnect(const char *host, const char *service, int type)
{
struct addrinfo hints;
struct addrinfo *result, *rp;
int sfd, s;
memset(&hints, 0, sizeof(struct addrinfo));
hints.ai_canonname = NULL;
hints.ai_addr = NULL;
hints.ai_next = NULL;
hints.ai_family = AF_UNSPEC; /* Allows IPv4 or IPv6 */
hints.ai_socktype = type;
s = getaddrinfo(host, service, &hints, &result);
if (s != 0) {
errno = ENOSYS;
return -1;
}
/* Walk through returned list until we find an address structure
that can be used to successfully connect a socket */
for (rp = result; rp != NULL; rp = rp->ai_next) {
sfd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
if (sfd == -1)
continue; /* On error, try next address */
if (connect(sfd, rp->ai_addr, rp->ai_addrlen) != -1)
break; /* Success */
/* Connect failed: close this socket and try next address */
close(sfd);
}
freeaddrinfo(result);
return (rp == NULL) ? -1 : sfd;
}

```

```

static int /* Public interfaces: inetBind() and inetListen() */
inetPassiveSocket(const char *service, int type, socklen_t *addrlen,
Boolean doListen, int backlog)
{
struct addrinfo hints;
struct addrinfo *result, *rp;
int sfd, optval, s;
memset(&hints, 0, sizeof(struct addrinfo));
hints.ai_canonname = NULL;
hints.ai_addr = NULL;
hints.ai_next = NULL;
hints.ai_socktype = type;
hints.ai_family = AF_UNSPEC; /* Allows IPv4 or IPv6 */
hints.ai_flags = AI_PASSIVE; /* Use wildcard IP address */
s = getaddrinfo(NULL, service, &hints, &result);
if (s != 0)
return -1;
/* Walk through returned list until we find an address structure
that can be used to successfully create and bind a socket */
optval = 1;
for (rp = result; rp != NULL; rp = rp->ai_next) {
sfd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
if (sfd == -1)
continue; /* On error, try next address */
if (doListen) {
if (setsockopt(sfd, SOL_SOCKET, SO_REUSEADDR, &optval,
sizeof(optval)) == -1) {
close(sfd);
freeaddrinfo(result);
return -1;
}
}
if (bind(sfd, rp->ai_addr, rp->ai_addrlen) == 0)
break; /* Success */
/* bind() failed: close this socket and try next address */
close(sfd);
}
if (rp != NULL && doListen) {
if (listen(sfd, backlog) == -1) {
freeaddrinfo(result);
return -1;
}
}
if (rp != NULL && addrlen != NULL)
*addrlen = rp->ai_addrlen; /* Return address structure size */

```

```

freeaddrinfo(result);
return (rp == NULL) ? -1 : sfd;
}
int
inetListen(const char *service, int backlog, socklen_t *addrlen)
{
return inetPassiveSocket(service, SOCK_STREAM, addrlen, TRUE, backlog);
}
int
inetBind(const char *service, int type, socklen_t *addrlen)
{
return inetPassiveSocket(service, type, addrlen, FALSE, 0);
}
char *
inetAddressStr(const struct sockaddr *addr, socklen_t addrlen,
char *addrStr, int addrStrLen)
{
char host[NI_MAXHOST], service[NI_MAXSERV];
if (getnameinfo(addr, addrlen, host, NI_MAXHOST,
service, NI_MAXSERV, NI_NUMERICSERV) == 0)
snprintf(addrStr, addrStrLen, "(%s, %s)", host, service);
else
snprintf(addrStr, addrStrLen, "(?UNKNOWN?)");
addrStr[addrStrLen - 1] = '\0'; /* Ensure result is null-terminated */
return addrStr;
}
–––––––––––––––––––––––––––––––––––––––––––––––––––– sockets/inet_sockets.c

```

## 59.13 Các API cũ để chuyển đổi Host và Service

Trong các phần tiếp theo, chúng tôi mô tả các hàm cũ, hiện đã lỗi thời (obsolete) dùng để chuyển đổi tên host (host name) và tên service (service name) qua lại giữa định dạng nhị phân (binary format) và định dạng hiển thị (presentation format). Mặc dù các chương trình mới nên thực hiện các phép chuyển đổi này bằng cách sử dụng các hàm hiện đại đã được mô tả trước đó trong chương này, việc hiểu biết về các hàm lỗi thời này vẫn rất hữu ích vì chúng ta có thể bắt gặp chúng trong các mã nguồn cũ.

### 59.13.1 Các hàm inet\_aton() và inet\_ntoa()

Các hàm `inet_aton()` và `inet_ntoa()` chuyển đổi các địa chỉ IPv4 giữa ký hiệu dạng chấm-thập phân (dotted-decimal notation) và dạng nhị phân (theo thứ tự byte mạng - network byte order). Các hàm này ngày nay đã trở nên lỗi thời (obsolete) bởi `inet_pton()` và `inet_ntop()`.

Hàm `inet_aton()` ("ASCII to network") chuyển đổi chuỗi chấm-thập phân (dotted-decimal) do `str` trỏ tới thành một địa chỉ IPv4 ở định dạng thứ tự byte mạng (network byte order), giá trị này được trả về trong cấu trúc `in_addr` do `addr` trỏ tới.

```

## include <arpa/inet.h>

int inet_aton(const char *str, struct in_addr *addr);
Trả về 1 (true) nếu str là một địa chỉ chấm-thập phân hợp lệ, hoặc 0 (false) khi có lỗi

```

Hàm `inet_aton()` trả về 1 nếu việc chuyển đổi thành công, hoặc 0 nếu `str` không hợp lệ.

Các thành phần số của chuỗi được truyền vào `inet_aton()` không nhất thiết phải là hệ thập phân (decimal). Chúng có thể là hệ bát phân (octal - được chỉ định bằng số 0 ở đầu) hoặc hệ thập lục phân (hexadecimal - được chỉ định bằng tiền tố `0x` hoặc `0X`). Hơn nữa, `inet_aton()` hỗ trợ các dạng viết tắt cho phép chỉ định một địa chỉ sử dụng ít hơn bốn thành phần số. (Xem trang hướng dẫn manual page `inet(3)` để biết thêm chi tiết). Thuật ngữ ký hiệu số-và-chấm (numbers-and-dots notation) được sử dụng cho các chuỗi địa chỉ tổng quát hơn có sử dụng các tính năng này.

SUSv3 không quy định hàm `inet_aton()`. Tuy nhiên, hàm này khả dụng trên hầu hết các cài đặt (implementations). Trên Linux, chúng ta phải định nghĩa một trong các macro kiểm tra tính năng (feature test macros) `_BSD_SOURCE`, `_SVID_SOURCE`, hoặc `_GNU_SOURCE` để có được khai báo của `inet_aton()` từ `<arpa/inet.h>`.

Hàm `inet_ntoa()` ("network to ASCII") thực hiện chức năng ngược lại với `inet_aton()`.

```

## include <arpa/inet.h>

char *inet_ntoa(struct in_addr addr);
Trả về con trỏ tới phiên bản chuỗi
chấm-thập phân (được cấp phát tĩnh) của addr

```

Với một cấu trúc `in_addr` cho trước (địa chỉ IPv4 32-bit ở thứ tự byte mạng), `inet_ntoa()` trả về một con trỏ tới chuỗi (được cấp phát tĩnh) chứa địa chỉ theo ký hiệu chấm-thập phân.

Vì chuỗi do `inet_ntoa()` trả về được cấp phát tĩnh, nó sẽ bị ghi đè bởi các lời gọi tiếp theo.

### 59.13.2 Các hàm gethostbyname() và gethostbyaddr()

Các hàm `gethostbyname()` và `gethostbyaddr()` cho phép chuyển đổi giữa tên máy (hostname) và địa chỉ IP. Các hàm này ngày nay đã trở nên lỗi thời (obsolete) và được thay thế bởi `getaddrinfo()` và `getnameinfo()`.

```

## include <netdb.h>

extern int h_errno;
struct hostent *gethostbyname(const char *name);
struct hostent *gethostbyaddr(const char *addr, socklen_t len, int type);
Cả hai đều trả về con trỏ tới cấu trúc hostent (được cấp phát tĩnh)
khi thành công, hoặc NULL khi có lỗi

```

Hàm `gethostbyname()` phân giải tên máy được cung cấp trong `name`, trả về một con trỏ tới cấu trúc `hostent` được cấp phát tĩnh chứa thông tin về tên máy đó. Cấu trúc này có dạng như sau:

```

struct hostent {
char *h_name; /* Tên chính thức (canonical) của máy */
char **h_aliases; /* Mảng kết thúc bằng NULL chứa các con trỏ
tới các chuỗi tên thay thế (alias) */
int h_addrtype; /* Kiểu địa chỉ (AF_INET hoặc AF_INET6) */
int h_length; /* Độ dài (tính bằng byte) của các địa chỉ được trỏ
tới bởi h_addr_list (4 byte cho AF_INET,
16 byte cho AF_INET6) */
char **h_addr_list; /* Mảng kết thúc bằng NULL chứa các con trỏ tới
các địa chỉ IP của máy (cấu trúc in_addr hoặc in6_addr)
ở thứ tự byte mạng */
};

## define h_addr h_addr_list[0]

```

Trường `h_name` trả về tên chính thức của máy, dưới dạng một chuỗi kết thúc bằng ký tự null. Trường `h_aliases` trỏ đến một mảng các con trỏ tới các chuỗi kết thúc bằng ký tự null chứa các tên bí danh (tên thay thế) cho tên máy này.

Trường `h_addr_list` là một mảng các con trỏ tới các cấu trúc địa chỉ IP của máy này. (Một máy đa kết nối mạng - multihomed host - có nhiều hơn một địa chỉ). Danh sách này bao gồm các cấu trúc `in_addr` hoặc `in6_addr`. Chúng ta có thể xác định kiểu của các cấu trúc này từ trường `h_addrtype` (chứa `AF_INET` hoặc `AF_INET6`), và độ dài của chúng từ trường `h_length`. Định nghĩa `h_addr` được cung cấp để đảm bảo tính tương thích ngược với các phiên bản trước đó (ví dụ: 4.2BSD) vốn chỉ trả về một địa chỉ duy nhất trong cấu trúc `hostent`. Một số mã nguồn hiện có dựa vào tên này (và do đó không hỗ trợ máy đa kết nối mạng).

Với các phiên bản hiện đại của `gethostbyname()`, `name` cũng có thể được chỉ định dưới dạng chuỗi địa chỉ IP dạng số; nghĩa là ký hiệu số-và-chấm cho IPv4 hoặc ký hiệu chuỗi thập lục phân cho IPv6. Trong trường hợp này, không có quá trình tra cứu (lookup) nào được thực hiện; thay vào đó, `name` được sao chép vào trường `h_name` của cấu trúc `hostent`, và `h_addr_list` được thiết lập bằng giá trị nhị phân tương đương của `name`.

Hàm `gethostbyaddr()` thực hiện chức năng ngược lại với `gethostbyname()`. Với một địa chỉ IP nhị phân cho trước, hàm này trả về một cấu trúc `hostent` chứa thông tin về máy có địa chỉ đó.

Khi xảy ra lỗi (ví dụ: không thể phân giải tên máy), cả `gethostbyname()` và `gethostbyaddr()` đều trả về con trỏ `NULL` và thiết lập biến toàn cục `h_errno`. Đúng như tên gọi, biến này tương tự như `errno` (các giá trị có thể được đặt trong biến này được mô tả trong trang hướng dẫn `gethostbyname(3)`), và các hàm `herror()` cùng `hstrerror()` tương tự như `perror()` và `strerror()`.

Hàm `herror()` hiển thị (trên luồng lỗi chuẩn `standard error`) chuỗi được truyền vào `str`, theo sau là dấu hai chấm (`:`), và sau đó là thông báo lỗi tương ứng với giá trị lỗi hiện tại trong `h_errno`. Ngoài ra, chúng ta có thể sử dụng `hstrerror()` để lấy con trỏ trỏ đến chuỗi tương ứng với giá trị lỗi được chỉ định trong `err`.

```

## define _BSD_SOURCE /* Hoặc _SVID_SOURCE hoặc _GNU_SOURCE */

## include <netdb.h>

void herror(const char *str);
const char *hstrerror(int err);
Trả về con trỏ trỏ đến chuỗi lỗi h_errno tương ứng với err

```

[Danh sách 59-10](#page-84-0) minh họa cách sử dụng hàm `gethostbyname()`. Chương trình này hiển thị thông tin `hostent` cho từng host được chỉ định trên dòng lệnh của nó. Phiên shell sau đây minh họa cách sử dụng chương trình này:

### \$ **./t\_gethostbyname www.jambit.com** Tên chính tắc (Canonical name): jamjam1.jambit.com tên thay thế (alias): www.jambit.com loại địa chỉ (address type): AF\_INET địa chỉ (address): 62.245.207.90

**Danh sách 59-10:** Sử dụng `gethostbyname()` để truy xuất thông tin host

```

––––––––––––––––––––––––––––––––––––––––––––––––– sockets/t_gethostbyname.c

## define _BSD_SOURCE /* Để nhận khai báo hstrerror() từ <netdb.h> */

## include <netdb.h>

## include <netinet/in.h>

## include <arpa/inet.h>

## include "tlpi_hdr.h"

int
main(int argc, char *argv[])
{
struct hostent *h;
char **pp;
char str[INET6_ADDRSTRLEN];
for (argv++; *argv != NULL; argv++) {
h = gethostbyname(*argv);
if (h == NULL) {
fprintf(stderr, "gethostbyname() thất bại cho '%s': %s\n",
*argv, hstrerror(h_errno));
continue;
}
printf("Tên chính tắc: %s\n", h->h_name);
printf(" tên thay thế: ");
for (pp = h->h_aliases; *pp != NULL; pp++)
printf(" %s", *pp);
printf("\n");

```

```

printf(" loại địa chỉ: %s\n",
(h->h_addrtype == AF_INET) ? "AF_INET" :
(h->h_addrtype == AF_INET6) ? "AF_INET6" : "???");
if (h->h_addrtype == AF_INET || h->h_addrtype == AF_INET6) {
printf(" địa chỉ: ");
for (pp = h->h_addr_list; *pp != NULL; pp++)
printf(" %s", inet_ntop(h->h_addrtype, *pp,
str, INET6_ADDRSTRLEN));
printf("\n");
}
}
exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––– sockets/t_gethostbyname.c

```

### 59.13.3 Các hàm getservbyname() và getservbyport()

Các hàm `getservbyname()` và `getservbyport()` truy xuất các bản ghi từ tệp `/etc/services` (Mục [59.9](#page-63-0)). Ngày nay, các hàm này đã trở nên lỗi thời (obsolete) và được thay thế bởi `getaddrinfo()` và `getnameinfo()`.

```

## include <netdb.h>

struct servent *getservbyname(const char *name, const char *proto);
struct servent *getservbyport(int port, const char *proto);
Cả hai đều trả về con trỏ trỏ đến một cấu trúc servent (được cấp phát tĩnh)
khi thành công, hoặc NULL nếu không tìm thấy hoặc xảy ra lỗi

```

Hàm `getservbyname()` tra cứu bản ghi có tên dịch vụ (hoặc một trong các tên thay thế của nó) khớp với `name` và có giao thức (protocol) khớp với `proto`. Đối số `proto` là một chuỗi như `tcp` hoặc `udp`, hoặc nó có thể là `NULL`. Nếu `proto` được chỉ định là `NULL`, bất kỳ bản ghi nào có tên dịch vụ khớp với `name` đều được trả về. (Điều này thường là đủ vì trong trường hợp cả bản ghi UDP và TCP có cùng tên tồn tại trong tệp `/etc/services`, chúng thường có cùng số cổng). Nếu tìm thấy bản ghi phù hợp, `getservbyname()` sẽ trả về một con trỏ trỏ đến một cấu trúc được cấp phát tĩnh thuộc loại sau:

```

struct servent {
char *s_name; /* Tên dịch vụ chính thức */
char **s_aliases; /* Các con trỏ trỏ đến tên thay thế (kết thúc bằng NULL) */
int s_port; /* Số cổng (theo thứ tự byte mạng - network byte order) */
char *s_proto; /* Giao thức */
};

```

Thông thường, chúng ta gọi `getservbyname()` chỉ để lấy số cổng, được trả về trong trường `s_port`.

Hàm `getservbyport()` thực hiện chức năng ngược lại với `getservbyname()`. Nó trả về một bản ghi `servent` chứa thông tin từ bản ghi `/etc/services` có số cổng khớp với `port` và giao thức khớp với `proto`. Một lần nữa, chúng ta có thể chỉ định `proto` là `NULL`, trong trường hợp đó lệnh gọi sẽ trả về bất kỳ bản ghi nào có số cổng khớp với số cổng được chỉ định trong `port`. (Điều này có thể không mang lại kết quả mong muốn trong một số ít trường hợp được đề cập ở trên, nơi cùng một số cổng ánh xạ tới các tên dịch vụ khác nhau trong UDP và TCP).

> Một ví dụ về việc sử dụng hàm `getservbyname()` được cung cấp trong tệp `files/t_getservbyname.c` trong gói mã nguồn của cuốn sách này.

## 59.14 UNIX Domain Socket so với Internet Domain Socket

Khi viết các ứng dụng giao tiếp qua mạng, chúng ta bắt buộc phải sử dụng Internet domain socket. Tuy nhiên, khi sử dụng socket để giao tiếp giữa các ứng dụng trên cùng một hệ thống (system), chúng ta có lựa chọn sử dụng Internet hoặc UNIX domain socket. Trong trường hợp đó, chúng ta nên sử dụng domain nào và tại sao?

Viết một ứng dụng chỉ sử dụng Internet domain socket thường là cách tiếp cận đơn giản nhất, vì nó sẽ hoạt động trên cả một host đơn lẻ và trên toàn mạng. Tuy nhiên, có một số lý do khiến chúng ta có thể chọn sử dụng UNIX domain socket:

- Trên một số hệ thống triển khai, UNIX domain socket (ổ cắm miền UNIX) có tốc độ nhanh hơn Internet domain socket (ổ cắm miền Internet).
- Chúng ta có thể sử dụng quyền hạn của thư mục (và trên Linux là tệp) để kiểm soát quyền truy cập vào UNIX domain socket, sao cho chỉ các ứng dụng có ID người dùng hoặc nhóm (user or group ID) được chỉ định mới có thể kết nối tới một stream socket đang lắng nghe (listening stream socket) hoặc gửi một datagram tới một datagram socket. Điều này cung cấp một phương pháp đơn giản để xác thực (authenticate) client. Với Internet domain socket, chúng ta cần tốn nhiều công sức hơn nếu muốn xác thực client.
-  Sử dụng UNIX domain socket, chúng ta có thể chuyển (pass) các File Descriptor (bộ mô tả tệp) đang mở và thông tin định danh của bên gửi (sender credentials), như đã được tóm tắt trong Mục [61.13.3](#page-135-1).

## 59.15 Thông tin bổ sung

Có rất nhiều tài nguyên dạng bản in và trực tuyến về TCP/IP và API socket (sockets API):

- Cuốn sách cốt lõi về lập trình mạng với sockets API là [Stevens et al., 2004]. [Snader, 2000] bổ sung một số hướng dẫn hữu ích về lập trình socket.
- [Stevens, 1994] và [Wright & Stevens, 1995] mô tả chi tiết về TCP/IP. [Comer, 2000], [Comer & Stevens, 1999], [Comer & Stevens, 2000], [Kozierok, 2005] và [Goralksi, 2009] cũng cung cấp phạm vi bao quát tốt về cùng chủ đề này.
- [Tanenbaum, 2002] cung cấp kiến thức nền tảng chung về mạng máy tính.
- [Herbert, 2004] mô tả chi tiết về ngăn xếp (stack) TCP/IP trên Linux 2.6.
- Tài liệu hướng dẫn thư viện GNU C (trực tuyến tại http://www.gnu.org/) có phần thảo luận rộng rãi về sockets API.
- Cuốn IBM Redbook, TCP/IP Tutorial and Technical Overview, cung cấp phần trình bày chi tiết về các khái niệm mạng, nội hàm bên trong (internals) của TCP/IP, sockets API và hàng loạt các chủ đề liên quan. Tài liệu này có thể tải xuống miễn phí từ http://www.redbooks.ibm.com/.
- [Gont, 2008] và [Gont, 2009b] cung cấp các đánh giá bảo mật về IPv4 và TCP.
- Nhóm tin Usenet comp.protocols.tcp-ip dành riêng cho các câu hỏi liên quan đến các giao thức mạng TCP/IP.

- [Sarolahti & Kuznetsov, 2002] mô tả việc kiểm soát tắc nghẽn (congestion control) và các chi tiết khác của việc triển khai TCP trên Linux.
- Thông tin cụ thể về Linux có thể được tìm thấy trong các trang manual (man pages) sau: socket(7), ip(7), raw(7), tcp(7), udp(7), và packet(7).
- Xem thêm danh sách RFC trong Mục [58.7](#page-44-1).

## 59.16 Tóm tắt

Internet domain socket cho phép các ứng dụng trên các host (máy chủ) khác nhau giao tiếp thông qua mạng TCP/IP. Địa chỉ của Internet domain socket bao gồm một địa chỉ IP và một số hiệu cổng (port number). Trong IPv4, địa chỉ IP là một số 32-bit; trong IPv6, đó là một số 128-bit. Internet domain datagram socket hoạt động dựa trên UDP, cung cấp phương thức giao tiếp hướng thông điệp (message-oriented), phi kết nối (connectionless) và không đáng tin cậy. Internet domain stream socket hoạt động dựa trên TCP, cung cấp kênh giao tiếp luồng byte (byte-stream) hai chiều, đáng tin cậy giữa hai ứng dụng đã kết nối.

Các kiến trúc máy tính khác nhau sử dụng các quy ước khác nhau để biểu diễn các kiểu dữ liệu. Ví dụ, số nguyên (integer) có thể được lưu trữ theo định dạng little-endian hoặc big-endian, và các máy tính khác nhau có thể sử dụng số lượng byte khác nhau để biểu diễn các kiểu dữ liệu số như `int` hoặc `long`. Những khác biệt này đồng nghĩa với việc chúng ta cần sử dụng một biểu diễn độc lập với kiến trúc khi truyền dữ liệu giữa các máy tính không đồng nhất (heterogeneous machines) kết nối qua mạng. Chúng ta đã lưu ý rằng có nhiều tiêu chuẩn sắp xếp dữ liệu (marshalling standards) tồn tại để giải quyết vấn đề này, đồng thời cũng mô tả một giải pháp đơn giản được nhiều ứng dụng sử dụng: mã hóa tất cả dữ liệu được truyền đi dưới dạng văn bản, với các trường được phân tách bằng một ký tự chỉ định (thường là ký tự xuống dòng - newline).

Chúng ta đã xem xét một loạt các hàm có thể được sử dụng để chuyển đổi giữa biểu diễn chuỗi (dạng số) của các địa chỉ IP (dạng thập phân có dấu chấm cho IPv4 và chuỗi hex cho IPv6) và dạng nhị phân tương đương của chúng. Tuy nhiên, việc sử dụng tên host và tên dịch vụ (service name) thường được ưu tiên hơn so với các con số, vì tên dễ ghi nhớ hơn và vẫn có thể sử dụng được ngay cả khi con số tương ứng bị thay đổi. Chúng ta đã xem xét các hàm khác nhau thực hiện việc chuyển đổi tên host và tên dịch vụ thành dạng số tương đương và ngược lại. Hàm hiện đại để dịch tên host và tên dịch vụ thành địa chỉ socket là `getaddrinfo()`, nhưng việc bắt gặp các hàm lịch sử `gethostbyname()` và `getservbyname()` trong mã nguồn hiện có là điều rất phổ biến.

Việc xem xét các phép chuyển đổi tên host đã dẫn chúng ta đến phần thảo luận về DNS, hệ thống thực thi một cơ sở dữ liệu phân tán (distributed database) cho một dịch vụ thư mục phân cấp (hierarchical directory service). Ưu điểm của DNS là việc quản lý cơ sở dữ liệu không bị tập trung hóa (centralized). Thay vào đó, các quản trị viên vùng cục bộ (local zone administrators) sẽ cập nhật các thay đổi cho thành phần phân cấp của cơ sở dữ liệu mà họ chịu trách nhiệm, và các máy chủ DNS giao tiếp với nhau để phân giải (resolve) tên host.

## 59.17 Bài tập

**59-1.** Khi đọc dữ liệu số lượng lớn, hàm `readLine()` được hiển thị trong [Liệt kê (Listing) 59-1](#page-52-0) kém hiệu quả, vì cần có một System Call (lời gọi hệ thống) để đọc từng ký tự. Một giao diện hiệu quả hơn sẽ đọc một khối ký tự vào bộ đệm (buffer) và trích xuất từng dòng một từ bộ đệm này. Một giao diện như vậy có thể bao gồm hai hàm. Hàm đầu tiên, có thể gọi là `readLineBufInit(fd, &rlbuf)`, khởi tạo cấu trúc dữ liệu quản lý sổ sách (bookkeeping data structure) được trỏ tới bởi `rlbuf`. Cấu trúc này bao gồm không gian cho một bộ đệm dữ liệu, kích thước của bộ đệm đó và một con trỏ tới ký tự "chưa đọc" tiếp theo trong bộ đệm đó. Nó cũng bao gồm một bản sao của File Descriptor được cung cấp qua tham số `fd`. Hàm thứ hai, `readLineBuf(&rlbuf)`, trả về dòng tiếp theo từ bộ đệm được liên kết với `rlbuf`. Nếu cần thiết, hàm này sẽ đọc thêm một khối dữ liệu từ File Descriptor được lưu trong `rlbuf`. Hãy hiện thực hóa (implement) hai hàm này. Sửa đổi các chương trình trong [Liệt kê 59-6](#page-72-0) (`is_seqnum_sv.c`) và [Liệt kê 59-7](#page-75-0) (`is_seqnum_cl.c`) để sử dụng các hàm này.

- **59-2.** Sửa đổi các chương trình trong [Listing 59-6](#page-72-0) (`is_seqnum_sv.c`) và [Listing 59-7](#page-75-0) (`is_seqnum_cl.c`) để sử dụng các hàm `inetListen()` và `inetConnect()` được cung cấp trong [Listing 59-9](#page-79-0) (`inet_sockets.c`).
- **59-3.** Viết một thư viện Unix domain socket với một API tương tự như thư viện Internet domain socket được trình bày ở Mục [59.12](#page-76-0). Viết lại các chương trình trong [Listing 57-3](#page-19-1) (`us_xfr_sv.c`, ở trang [1168](#page-19-1)) và [Listing 57-4](#page-20-1) (`us_xfr_cl.c`, ở trang [1169](#page-20-1)) để sử dụng thư viện này.
- **59-4.** Viết một máy chủ mạng (network server) lưu trữ các cặp tên-giá trị (name-value pairs). Máy chủ này phải cho phép các client thêm, xóa, sửa và truy vấn các tên. Viết một hoặc nhiều chương trình client để kiểm thử máy chủ. Tùy chọn, hãy triển khai một cơ chế bảo mật nào đó cho phép chỉ client đã tạo ra tên mới có quyền xóa nó hoặc sửa đổi giá trị liên quan đến nó.
- **59-5.** Giả sử rằng chúng ta tạo hai Internet domain datagram socket, được liên kết (bound) với các địa chỉ cụ thể và kết nối socket thứ nhất với socket thứ hai. Điều gì sẽ xảy ra nếu chúng ta tạo một datagram socket thứ ba và cố gắng gửi (`sendto()`) một datagram thông qua socket đó đến socket thứ nhất? Hãy viết một chương trình để xác định câu trả lời.
