## Chapter 63

## CÁC MÔ HÌNH I/O THAY THẾ (ALTERNATIVE I/O MODELS)

Chương này thảo luận về ba phương án thay thế cho mô hình I/O tệp thông thường mà chúng ta đã sử dụng trong phần lớn các chương trình được trình bày trong cuốn sách này:

- Đa kênh I/O (I/O multiplexing - các system call `select()` và `poll()`);
- I/O điều khiển bằng tín hiệu (signal-driven I/O); và
- API `epoll` đặc thù của Linux.

## 63.1 Tổng quan (Overview)

Hầu hết các chương trình mà chúng ta đã trình bày cho đến nay trong cuốn sách này đều sử dụng một mô hình I/O trong đó một tiến trình (process) thực hiện I/O trên chỉ một file descriptor tại một thời điểm, và mỗi system call I/O sẽ ở trạng thái chờ (block) cho đến khi dữ liệu được truyền đi. Ví dụ, khi đọc từ một ống dẫn (pipe), một lời gọi hàm `read()` thông thường sẽ block nếu hiện tại không có dữ liệu nào trong pipe, và một lời gọi `write()` sẽ block nếu không đủ dung lượng trong pipe để chứa dữ liệu cần ghi. Hành vi tương tự xảy ra khi thực hiện I/O trên các loại tệp khác nhau, bao gồm FIFO và socket.

Các tệp trên đĩa (disk file) là một trường hợp đặc biệt. Như được mô tả trong Chương 13, kernel sử dụng bộ đệm (buffer cache) để tăng tốc các yêu cầu I/O đĩa. Do đó, một thao tác `write()` vào đĩa sẽ trả về ngay khi dữ liệu được yêu cầu đã được chuyển vào buffer cache của kernel, thay vì phải chờ cho đến khi dữ liệu thực sự được ghi xuống đĩa (trừ khi cờ `O_SYNC` được chỉ định khi mở tệp). Tương ứng, một thao tác `read()` sẽ truyền dữ liệu từ buffer cache sang một bộ đệm của người dùng (user buffer), và nếu dữ liệu được yêu cầu không có trong buffer cache, kernel sẽ đưa tiến trình vào trạng thái ngủ (sleep) trong khi quá trình đọc đĩa được thực hiện.

Mô hình I/O block truyền thống là đủ cho nhiều ứng dụng, nhưng không phải tất cả. Cụ thể, một số ứng dụng cần có khả năng thực hiện một hoặc cả hai điều sau:

- Kiểm tra xem I/O có khả thi trên một file descriptor hay không mà không bị block nếu nó không khả thi.
- Giám sát nhiều file descriptor để xem liệu I/O có khả thi trên bất kỳ file descriptor nào trong số đó hay không.

Chúng ta đã gặp hai kỹ thuật có thể được sử dụng để giải quyết một phần các nhu cầu này: I/O phi block (nonblocking I/O) và việc sử dụng nhiều tiến trình (processes) hoặc luồng (threads).

Chúng ta đã mô tả nonblocking I/O khá chi tiết trong Mục 5.9 và 44.9. Nếu chúng ta đặt một file descriptor ở chế độ phi block bằng cách bật cờ trạng thái mở tệp `O_NONBLOCK`, thì một system call I/O không thể hoàn thành ngay lập tức sẽ trả về một mã lỗi thay vì bị block. Nonblocking I/O có thể được sử dụng với các pipe, FIFO, socket, terminal, pseudoterminal và một số loại thiết bị khác.

Nonblocking I/O cho phép chúng ta định kỳ kiểm tra ("poll") xem I/O có khả thi trên một file descriptor hay không. Ví dụ, chúng ta có thể làm cho một file descriptor đầu vào trở thành phi block, và sau đó định kỳ thực hiện các thao tác đọc phi block. Nếu chúng ta cần giám sát nhiều file descriptor, chúng ta sẽ đánh dấu tất cả chúng là phi block, và lần lượt poll từng cái một. Tuy nhiên, việc polling theo cách này thường không được mong muốn. Nếu việc polling chỉ được thực hiện thỉnh thoảng, thì độ trễ (latency) trước khi ứng dụng phản hồi lại một sự kiện I/O có thể dài một cách không thể chấp nhận được; mặt khác, việc polling trong một vòng lặp chặt (tight loop) sẽ lãng phí thời gian CPU.

> Trong chương này, chúng ta sử dụng từ poll theo hai nghĩa khác nhau. Một nghĩa là tên của system call đa kênh I/O, `poll()`. Nghĩa còn lại, chúng ta hiểu là "thực hiện một kiểm tra phi block về trạng thái của một file descriptor".

Nếu chúng ta không muốn một tiến trình bị block khi thực hiện I/O trên một file descriptor, thay vào đó, chúng ta có thể tạo một tiến trình mới để thực hiện I/O đó. Tiến trình cha (parent process) sau đó có thể tiếp tục thực hiện các tác vụ khác, trong khi tiến trình con (child process) bị block cho đến khi I/O hoàn tất. Nếu chúng ta cần xử lý I/O trên nhiều file descriptor, chúng ta có thể tạo một tiến trình con cho mỗi descriptor. Vấn đề với cách tiếp cận này là chi phí và độ phức tạp. Việc tạo và duy trì các tiến trình gây ra gánh nặng cho hệ thống, và thông thường, các tiến trình con sẽ cần sử dụng một hình thức IPC (Inter-Process Communication) nào đó để thông báo cho tiến trình cha về trạng thái của các thao tác I/O.

Sử dụng nhiều luồng (threads) thay vì tiến trình sẽ ít tốn tài nguyên hơn, nhưng các luồng có thể vẫn cần giao tiếp thông tin với nhau về trạng thái của các thao tác I/O, và việc lập trình có thể phức tạp, đặc biệt nếu chúng ta đang sử dụng các bể luồng (thread pools) để giảm thiểu số lượng luồng được sử dụng nhằm xử lý số lượng lớn các client đồng thời. (Một nơi mà các luồng có thể đặc biệt hữu ích là khi ứng dụng cần gọi một thư viện của bên thứ ba thực hiện I/O dạng block. Trong trường hợp này, ứng dụng có thể tránh bị block bằng cách thực hiện lời gọi thư viện trong một luồng riêng biệt).

Do những hạn chế của cả nonblocking I/O và việc sử dụng nhiều luồng hoặc tiến trình, một trong các phương án thay thế sau đây thường được ưu tiên hơn:

- Đa kênh I/O (I/O multiplexing) cho phép một tiến trình đồng thời giám sát nhiều file descriptor để tìm hiểu xem I/O có khả thi trên bất kỳ cái nào trong số chúng hay không. Các system call `select()` và `poll()` thực hiện việc đa kênh I/O.
- I/O điều khiển bằng tín hiệu (Signal-driven I/O) là một kỹ thuật trong đó một tiến trình yêu cầu kernel gửi cho nó một tín hiệu (signal) khi có dữ liệu đầu vào hoặc khi dữ liệu có thể được ghi trên một file descriptor được chỉ định. Tiến trình sau đó có thể tiếp tục thực hiện các hoạt động khác, và được thông báo khi I/O trở nên khả thi thông qua việc nhận được tín hiệu. Khi giám sát số lượng lớn các file descriptor, signal-driven I/O mang lại hiệu năng cao hơn đáng kể so với `select()` và `poll()`.

- API `epoll` là một tính năng đặc thù của Linux (Linux-specific), xuất hiện lần đầu trong Linux 2.6. Giống như các API I/O multiplexing khác, API `epoll` cho phép một tiến trình (process) giám sát nhiều bộ mô tả tệp (file descriptor) để kiểm tra xem liệu có thể thực hiện I/O trên bất kỳ bộ mô tả nào trong số đó hay không. Tương tự như I/O hướng tín hiệu (signal-driven I/O), API `epoll` mang lại hiệu năng tốt hơn nhiều khi giám sát một số lượng lớn các bộ mô tả tệp.

Trong phần còn lại của chương này, chúng ta sẽ chủ yếu thảo luận về các kỹ thuật nêu trên dưới góc độ các tiến trình (process). Tuy nhiên, các kỹ thuật này cũng có thể được áp dụng trong các ứng dụng đa luồng (multithreaded applications).

Về cơ bản, I/O multiplexing, signal-driven I/O và `epoll` đều là các phương pháp đạt được cùng một kết quả—giám sát một hoặc thường là nhiều bộ mô tả tệp cùng lúc để xem liệu chúng đã sẵn sàng thực hiện I/O hay chưa (chính xác hơn là để xem liệu một lời gọi hệ thống (system call) I/O có thể được thực hiện mà không bị chặn (blocking) hay không). Sự chuyển đổi của một bộ mô tả tệp sang trạng thái sẵn sàng được kích hoạt bởi một loại sự kiện I/O nào đó, chẳng hạn như dữ liệu đầu vào vừa đến, hoàn tất kết nối socket, hoặc có sẵn không gian trong bộ đệm gửi (send buffer) của socket vốn đã đầy trước đó sau khi TCP truyền dữ liệu xếp hàng đến đối tác (socket peer). Việc giám sát nhiều bộ mô tả tệp rất hữu ích trong các ứng dụng như máy chủ mạng (network server) cần giám sát đồng thời nhiều socket của máy khách, hoặc các ứng dụng cần giám sát đồng thời dữ liệu đầu vào từ terminal, pipe hoặc socket.

Lưu ý rằng không kỹ thuật nào trong số này thực hiện thao tác I/O. Chúng chỉ đơn thuần thông báo cho chúng ta biết rằng một bộ mô tả tệp đã sẵn sàng. Sau đó, một lời gọi hệ thống khác phải được sử dụng để thực sự thực hiện I/O.

> Một mô hình I/O mà chúng ta không mô tả trong chương này là POSIX asynchronous I/O (AIO). POSIX AIO cho phép một tiến trình xếp hàng (queue) một thao tác I/O vào một tệp và sau đó nhận thông báo khi thao tác hoàn tất. Ưu điểm của POSIX AIO là lời gọi I/O ban đầu trả về ngay lập tức, do đó tiến trình không bị treo để chờ dữ liệu được truyền đến kernel hoặc chờ thao tác hoàn tất. Điều này cho phép tiến trình thực hiện các tác vụ khác song song với I/O (có thể bao gồm việc xếp hàng các yêu cầu I/O tiếp theo). Đối với một số loại ứng dụng nhất định, POSIX AIO có thể mang lại những lợi ích hiệu năng hữu ích. Hiện tại, Linux cung cấp một bản triển khai POSIX AIO dựa trên luồng (threads-based) bên trong glibc. Tại thời điểm viết bài này, công việc đang được tiến hành để cung cấp một bản triển khai POSIX AIO ngay trong kernel, điều này sẽ mang lại hiệu năng mở rộng (scaling performance) tốt hơn. POSIX AIO được mô tả trong [Gallmeister, 1995] và [Robbins & Robbins, 2003].

### Nên chọn kỹ thuật nào?

Trong suốt chương này, chúng ta sẽ xem xét các lý do tại sao chúng ta có thể chọn kỹ thuật này thay vì kỹ thuật khác. Trong khi chờ đợi, chúng ta tóm tắt một vài điểm sau:

- Các lời gọi hệ thống `select()` và `poll()` là các giao diện lâu đời đã có mặt trên các hệ thống UNIX trong nhiều năm. So với các kỹ thuật khác, ưu điểm chính của chúng là tính di động (portability). Nhược điểm chính là chúng không mở rộng tốt (scale well) khi giám sát một số lượng lớn (hàng trăm hoặc hàng nghìn) bộ mô tả tệp.
- Ưu điểm chính của API `epoll` là nó cho phép một ứng dụng giám sát hiệu quả một số lượng lớn các bộ mô tả tệp. Nhược điểm chính của nó là đây là một API đặc thù của Linux.

Một số bản triển khai UNIX khác cung cấp các cơ chế (không chuẩn) tương tự như `epoll`. Ví dụ, Solaris cung cấp tệp đặc biệt `/dev/poll` (được mô tả trong trang hướng dẫn `poll(7d)` của Solaris), và một số hệ thống BSD cung cấp API `kqueue` (cung cấp cơ sở giám sát đa năng hơn so với `epoll`). [Stevens et al., 2004] mô tả ngắn gọn hai cơ chế này; một cuộc thảo luận dài hơn về `kqueue` có thể được tìm thấy trong [Lemon, 2001].

- Giống như `epoll`, signal-driven I/O cho phép một ứng dụng giám sát hiệu quả một số lượng lớn các bộ mô tả tệp. Tuy nhiên, `epoll` cung cấp một số ưu điểm so với signal-driven I/O:
  - Chúng ta tránh được sự phức tạp khi phải xử lý các tín hiệu (signals).
  - Chúng ta có thể chỉ định loại giám sát mà chúng ta muốn thực hiện (ví dụ: sẵn sàng để đọc hoặc sẵn sàng để ghi).
  - Chúng ta có thể chọn thông báo theo mức (level-triggered) hoặc theo cạnh (edge-triggered) (được mô tả trong Mục [63.1.1](#page-40-0)).

Hơn nữa, việc tận dụng tối đa signal-driven I/O đòi hỏi phải sử dụng các tính năng không di động, đặc thù của Linux, và nếu chúng ta làm điều này, signal-driven I/O cũng không có tính di động cao hơn `epoll`.

Vì một mặt, `select()` và `poll()` có tính di động cao hơn, trong khi signal-driven I/O và `epoll` mang lại hiệu năng tốt hơn, nên đối với một số ứng dụng, việc viết một lớp phần mềm trừu tượng để giám sát các sự kiện bộ mô tả tệp có thể rất đáng giá. Với một lớp như vậy, các chương trình có tính di động có thể sử dụng `epoll` (hoặc một API tương tự) trên các hệ thống hỗ trợ nó, và quay lại sử dụng `select()` hoặc `poll()` trên các hệ thống khác.

> Thư viện `libevent` là một lớp phần mềm cung cấp sự trừu tượng hóa để giám sát các sự kiện bộ mô tả tệp. Nó đã được chuyển đổi (port) sang một số hệ thống UNIX. Là cơ chế nền tảng, `libevent` có thể (một cách trong suốt) sử dụng bất kỳ kỹ thuật nào được mô tả trong chương này: `select()`, `poll()`, signal-driven I/O, hoặc `epoll`, cũng như giao diện `/dev/poll` đặc thù của Solaris hoặc giao diện `kqueue` của BSD. (Do đó, `libevent` cũng đóng vai trò là một ví dụ về cách sử dụng từng kỹ thuật này.) Được viết bởi Niels Provos, `libevent` có sẵn tại http://monkey.org/~provos/libevent/.

### 63.1.1 Thông báo theo mức (Level-Triggered) và theo cạnh (Edge-Triggered)

Trước khi thảo luận chi tiết về các cơ chế I/O thay thế khác nhau, chúng ta cần phân biệt hai mô hình thông báo trạng thái sẵn sàng cho một file descriptor:

- Thông báo theo mức (Level-triggered notification): Một file descriptor được coi là sẵn sàng nếu có thể thực hiện một system call I/O mà không bị chặn (blocking).
- Thông báo theo cạnh (Edge-triggered notification): Thông báo được cung cấp nếu có hoạt động I/O (ví dụ: dữ liệu đầu vào mới) trên một file descriptor kể từ lần giám sát cuối cùng.

[Bảng 63-1](#page-40-1) tóm tắt các mô hình thông báo được sử dụng bởi I/O multiplexing, signal-driven I/O và epoll. API epoll khác với hai mô hình I/O còn lại ở chỗ nó có thể sử dụng cả thông báo theo mức (mặc định) và thông báo theo cạnh.

**Bảng 63-1:** Sử dụng các mô hình thông báo theo mức và theo cạnh

| Mô hình I/O       | Theo mức (Level-triggered)? | Theo cạnh (Edge-triggered)? |
|-------------------|-----------------------------|-----------------------------|
| select(), poll()  | •                           |                             |
| Signal-driven I/O |                             | •                           |
| epoll             | •                           | •                           |

Chi tiết về sự khác biệt giữa hai mô hình thông báo này sẽ trở nên rõ ràng hơn trong suốt chương này. Hiện tại, chúng ta sẽ mô tả cách lựa chọn mô hình thông báo ảnh hưởng đến cách thiết kế chương trình.

Khi sử dụng thông báo theo mức, chúng ta có thể kiểm tra trạng thái sẵn sàng của một file descriptor bất cứ lúc nào. Điều này có nghĩa là khi xác định được một file descriptor đã sẵn sàng (ví dụ: có dữ liệu đầu vào), chúng ta có thể thực hiện một số thao tác I/O trên descriptor đó, sau đó lặp lại thao tác giám sát để kiểm tra xem descriptor đó còn sẵn sàng hay không (ví dụ: vẫn còn dữ liệu đầu vào), trong trường hợp đó chúng ta có thể thực hiện thêm các thao tác I/O khác, và cứ tiếp tục như vậy. Nói cách khác, vì mô hình theo mức cho phép chúng ta lặp lại thao tác giám sát I/O bất cứ lúc nào, nên không nhất thiết phải thực hiện càng nhiều I/O càng tốt (ví dụ: đọc càng nhiều byte càng tốt) trên file descriptor đó (hoặc thậm chí không cần thực hiện bất kỳ thao tác I/O nào) mỗi khi nhận được thông báo rằng file descriptor đã sẵn sàng.

Ngược lại, khi sử dụng thông báo theo cạnh, chúng ta chỉ nhận được thông báo khi một sự kiện I/O xảy ra. Chúng ta sẽ không nhận được thêm bất kỳ thông báo nào cho đến khi một sự kiện I/O khác xuất hiện. Hơn nữa, khi một sự kiện I/O được thông báo cho một file descriptor, chúng ta thường không biết có thể thực hiện bao nhiêu I/O (ví dụ: có bao nhiêu byte sẵn sàng để đọc). Do đó, các chương trình sử dụng thông báo theo cạnh thường được thiết kế theo các quy tắc sau:

Sau khi nhận thông báo về một sự kiện I/O, chương trình nên—tại một thời điểm nào đó—thực hiện càng nhiều I/O càng tốt (ví dụ: đọc càng nhiều byte càng tốt) trên file descriptor tương ứng. Nếu chương trình không làm điều này, nó có thể bỏ lỡ cơ hội thực hiện I/O, vì nó sẽ không biết được nhu cầu thao tác trên file descriptor đó cho đến khi một sự kiện I/O khác xảy ra. Điều này có thể dẫn đến mất dữ liệu giả hoặc gây tắc nghẽn trong chương trình. Chúng ta nói "tại một thời điểm nào đó" vì đôi khi việc thực hiện tất cả các thao tác I/O ngay lập tức sau khi xác định file descriptor đã sẵn sàng có thể không phải là lựa chọn tối ưu. Vấn đề là chúng ta có thể:

- Khiến các file descriptor khác bị bỏ quên nếu chúng ta thực hiện quá nhiều I/O trên một file descriptor duy nhất. Chúng ta sẽ xem xét điểm này chi tiết hơn khi mô tả mô hình thông báo theo cạnh cho epoll trong Mục [63.4.6.](#page-77-0)
- Nếu chương trình sử dụng một vòng lặp để thực hiện càng nhiều I/O càng tốt trên file descriptor, và descriptor đó được đánh dấu là blocking, thì cuối cùng một system call I/O sẽ bị chặn khi không còn I/O nào có thể thực hiện được nữa. Vì lý do này, mỗi file descriptor được giám sát thường được đặt ở chế độ nonblocking, và sau khi nhận thông báo về một sự kiện I/O, các thao tác I/O sẽ được thực hiện lặp đi lặp lại cho đến khi system call liên quan (ví dụ: `read()` hoặc `write()`) trả về lỗi `EAGAIN` hoặc `EWOULDBLOCK`.

### 63.1.2 Sử dụng I/O Không Chặn (Nonblocking I/O) kết hợp với các Mô hình I/O Khác

I/O không chặn (Nonblocking I/O) (cờ `O_NONBLOCK`) thường được sử dụng kết hợp với các mô hình I/O được mô tả trong chương này. Dưới đây là một số ví dụ về lý do tại sao cách tiếp cận này lại hữu ích:

- Như đã giải thích trong phần trước, nonblocking I/O thường được sử dụng kết hợp với các mô hình I/O cung cấp cơ chế thông báo theo sự kiện kích hoạt cạnh (edge-triggered notification) đối với các sự kiện I/O.
- Nếu nhiều tiến trình (process) hoặc luồng (thread) đang thực hiện I/O trên cùng một mô tả tệp mở (open file description), thì từ góc nhìn của một tiến trình cụ thể, trạng thái sẵn sàng (readiness) của một bộ mô tả (descriptor) có thể thay đổi trong khoảng thời gian từ lúc bộ mô tả được thông báo là đã sẵn sàng cho đến thời điểm thực hiện lời gọi I/O (I/O call) tiếp theo. Do đó, một lời gọi blocking I/O có thể bị chặn (block), từ đó ngăn cản tiến trình theo dõi các bộ mô tả tệp khác. (Điều này có thể xảy ra đối với tất cả các mô hình I/O mà chúng ta mô tả trong chương này, bất kể chúng sử dụng cơ chế thông báo theo mức - level-triggered hay theo cạnh - edge-triggered).
- Ngay cả sau khi một API kích hoạt theo mức (level-triggered API) như `select()` hoặc `poll()` thông báo cho chúng ta biết rằng bộ mô tả tệp của một socket luồng (stream socket) đã sẵn sàng để ghi, nếu chúng ta ghi một khối dữ liệu đủ lớn trong một lời gọi `write()` hoặc `send()` duy nhất, thì lời gọi đó vẫn sẽ bị chặn.
- Trong một số ít trường hợp, các API kích hoạt theo mức như `select()` và `poll()` có thể trả về các thông báo sẵn sàng giả mạo (spurious readiness notifications) — chúng có thể thông báo sai rằng một bộ mô tả tệp đã sẵn sàng. Nguyên nhân có thể do lỗi kernel (kernel bug) hoặc là hành vi mong đợi trong một kịch bản không phổ biến.

Mục 16.6 của [Stevens et al., 2004] mô tả một ví dụ về thông báo sẵn sàng giả mạo trên các hệ thống BSD đối với một socket đang lắng nghe (listening socket). Nếu một client kết nối đến socket lắng nghe của server và sau đó đặt lại (reset) kết nối đó, hàm `select()` được thực hiện bởi server giữa hai sự kiện này sẽ chỉ ra rằng socket lắng nghe có thể đọc được (readable), nhưng lời gọi `accept()` tiếp theo được thực hiện sau khi client reset sẽ bị chặn.

## 63.2 Đa hợp I/O (I/O Multiplexing)

Đa hợp I/O (I/O multiplexing) cho phép chúng ta đồng thời theo dõi nhiều bộ mô tả tệp (file descriptor) để xem liệu I/O có khả thi trên bất kỳ bộ mô tả nào trong số đó hay không. Chúng ta có thể thực hiện đa hợp I/O bằng cách sử dụng một trong hai System Call có chức năng cơ bản giống nhau. System Call đầu tiên là `select()`, xuất hiện cùng với API socket trong BSD. Về mặt lịch sử, đây là system call phổ biến rộng rãi hơn trong hai system call. System Call còn lại là `poll()`, xuất hiện trong System V. Cả `select()` và `poll()` ngày nay đều được yêu cầu bởi chuẩn SUSv3.

Chúng ta có thể sử dụng `select()` và `poll()` để theo dõi các bộ mô tả tệp đối với các tệp thông thường (regular file), terminal, pseudoterminal, pipe, FIFO, socket và một số loại thiết bị ký tự (character device). Cả hai system call này đều cho phép một tiến trình hoặc là chặn vô thời hạn (block indefinitely) để chờ các bộ mô tả tệp trở nên sẵn sàng, hoặc chỉ định một khoảng thời gian chờ (timeout) cho lời gọi.

### 63.2.1 System Call select()

System call select() thực hiện block (chặn) tiến trình cho đến khi một hoặc nhiều file descriptor (mô tả tệp) trong tập hợp trở nên sẵn sàng.

```
## include <sys/time.h> /* For portability */
## include <sys/select.h>
int select(int nfds, fd_set *readfds, fd_set *writefds, fd_set *exceptfds,
 struct timeval *timeout);
         Trả về số lượng file descriptor sẵn sàng, 0 nếu hết thời gian (timeout), hoặc –1 khi có lỗi
```

Các tham số nfds, readfds, writefds, và exceptfds chỉ định các file descriptor mà select() cần theo dõi. Tham số timeout có thể được sử dụng để thiết lập giới hạn thời gian tối đa mà select() sẽ block. Chúng ta sẽ mô tả chi tiết từng tham số này dưới đây.

> Trong phần khai báo nguyên mẫu (prototype) của select() hiển thị ở trên, chúng tôi bao gồm <sys/time.h> bởi vì đó là tệp header được chỉ định trong SUSv2, và một số cài đặt UNIX yêu cầu tệp header này. (Tệp header <sys/time.h> có sẵn trên Linux, và việc thêm nó vào không gây ra vấn đề gì.)

### Tập hợp file descriptor (File descriptor sets)

Các tham số readfds, writefds, và exceptfds là các con trỏ trỏ đến các tập hợp file descriptor, được biểu diễn bằng kiểu dữ liệu fd\_set. Các tham số này được sử dụng như sau:

- readfds là tập hợp các file descriptor cần kiểm tra xem có thể đọc dữ liệu (input) được hay không;
- writefds là tập hợp các file descriptor cần kiểm tra xem có thể ghi dữ liệu (output) được hay không; và
- exceptfds là tập hợp các file descriptor cần kiểm tra xem có điều kiện ngoại lệ (exceptional condition) xảy ra hay không.

Thuật ngữ điều kiện ngoại lệ (exceptional condition) thường bị hiểu nhầm là một loại điều kiện lỗi nào đó đã phát sinh trên file descriptor. Thực tế không phải vậy. Một điều kiện ngoại lệ chỉ xảy ra trong hai trường hợp trên Linux (các hệ thống UNIX khác cũng tương tự):

- Xảy ra thay đổi trạng thái trên một đầu nô lệ pseudoterminal (pseudoterminal slave) được kết nối với một đầu chính (master) đang ở chế độ gói (packet mode) (Mục [64.5](#page-99-0)).
- Dữ liệu băng thông ngoài (out-of-band data) được nhận trên một stream socket (Mục 61.13.1).

Thông thường, kiểu dữ liệu fd\_set được cài đặt dưới dạng một mặt nạ bit (bit mask). Tuy nhiên, chúng ta không cần phải nắm rõ các chi tiết này, vì mọi thao tác trên tập hợp file descriptor đều được thực hiện thông qua bốn macro: FD\_ZERO(), FD\_SET(), FD\_CLR(), và FD\_ISSET().

```
## include <sys/select.h>
void FD_ZERO(fd_set *fdset);
void FD_SET(int fd, fd_set *fdset);
void FD_CLR(int fd, fd_set *fdset);
int FD_ISSET(int fd, fd_set *fdset);
                              Trả về true (1) nếu fd nằm trong fdset, ngược lại trả về false (0)
```

Các macro này hoạt động như sau:

- FD\_ZERO() khởi tạo tập hợp được trỏ bởi fdset thành tập rỗng.
- FD\_SET() thêm file descriptor fd vào tập hợp được trỏ bởi fdset.
- FD\_CLR() xóa file descriptor fd khỏi tập hợp được trỏ bởi fdset.
- FD\_ISSET() trả về true nếu file descriptor fd là một thành viên của tập hợp được trỏ bởi fdset.

Một tập hợp file descriptor có kích thước tối đa, được xác định bởi hằng số FD\_SETSIZE. Trên Linux, hằng số này có giá trị là 1024. (Các hệ thống UNIX khác có các giá trị tương tự cho giới hạn này.)

> Mặc dù các macro FD\_\* đang thao tác trên các cấu trúc dữ liệu ở user-space (không gian người dùng), và việc cài đặt select() trong kernel (nhân) có thể xử lý các tập hợp mô tả có kích thước lớn hơn, nhưng glibc không cung cấp cách thức đơn giản nào để sửa đổi định nghĩa của FD\_SETSIZE. Nếu muốn thay đổi giới hạn này, chúng ta phải sửa đổi định nghĩa trong các tệp header của glibc. Tuy nhiên, vì những lý do mà chúng ta sẽ mô tả sau trong chương này, nếu cần theo dõi số lượng lớn các descriptor, việc sử dụng epoll có lẽ sẽ ưu việt hơn so với việc dùng select().

Các tham số readfds, writefds, và exceptfds đều mang tính chất giá trị-kết quả (value-result). Trước khi gọi hàm select(), các cấu trúc fd\_set được trỏ bởi các tham số này phải được khởi tạo (sử dụng FD\_ZERO() và FD\_SET()) để chứa tập hợp các file descriptor cần quan tâm. Lệnh gọi select() sẽ sửa đổi từng cấu trúc này sao cho, khi trả về, chúng chứa tập hợp các file descriptor đã sẵn sàng. (Vì các cấu trúc này bị thay đổi sau lời gọi hàm, chúng ta phải đảm bảo khởi tạo lại chúng nếu gọi select() lặp đi lặp lại bên trong một vòng lặp.) Sau đó, các cấu trúc này có thể được kiểm tra bằng hàm FD\_ISSET().

Nếu chúng ta không quan tâm đến một nhóm sự kiện cụ thể nào đó, tham số fd\_set tương ứng có thể được truyền vào là NULL. Chúng ta sẽ bàn kỹ hơn về ý nghĩa chính xác của từng loại trong ba loại sự kiện này tại Mục [63.2.3.](#page-52-0)

Tham số nfds phải được thiết lập lớn hơn một đơn vị so với số hiệu file descriptor cao nhất có mặt trong cả ba tập hợp file descriptor. Tham số này giúp cho select() hoạt động hiệu quả hơn, vì khi đó kernel biết được rằng không cần phải kiểm tra xem các số hiệu file descriptor lớn hơn giá trị này có nằm trong các tập hợp file descriptor hay không.

### Tham số timeout

Tham số timeout điều khiển hành vi block của select(). Nó có thể được chỉ định là NULL (trong trường hợp này select() sẽ block vô thời hạn), hoặc là một con trỏ trỏ đến một cấu trúc timeval:

```
struct timeval {
 time_t tv_sec; /* Giây */
 suseconds_t tv_usec; /* Micro giây (long int) */
};
```

Nếu cả hai trường của timeout đều là 0, thì select() không block (chặn); nó chỉ đơn giản là thăm dò (poll) các file descriptor được chỉ định để xem cái nào đã sẵn sàng và trả về ngay lập tức. Ngược lại, timeout xác định giới hạn trên về thời gian mà select() sẽ chờ đợi.

Mặc dù cấu trúc timeval cung cấp độ chính xác đến cấp độ microsecond (micro-giây), độ chính xác của lời gọi hàm bị giới hạn bởi độ phân giải (granularity) của đồng hồ phần mềm (Phần 10.6). SUSv3 quy định rằng khoảng thời gian timeout được làm tròn lên nếu nó không phải là bội số chính xác của độ phân giải này.

> SUSv3 yêu cầu khoảng thời gian timeout tối đa cho phép phải ít nhất là 31 ngày. Hầu hết các cài đặt trên UNIX cho phép giới hạn cao hơn đáng kể. Vì Linux/x86-32 sử dụng một số nguyên 32-bit cho kiểu `time_t`, giới hạn trên có thể kéo dài nhiều năm.

Khi timeout là NULL, hoặc trỏ đến một cấu trúc chứa các trường khác không, select() sẽ block (chặn) cho đến khi một trong các điều kiện sau xảy ra:

- ít nhất một trong các file descriptor được chỉ định trong readfds, writefds, hoặc exceptfds trở nên sẵn sàng;
- lời gọi hàm bị ngắt bởi một signal handler (trình xử lý tín hiệu); hoặc
- khoảng thời gian do timeout chỉ định đã trôi qua.

Trong các cài đặt UNIX cũ thiếu lời gọi hàm sleep với độ chính xác dưới giây (ví dụ: nanosleep()), select() đã được sử dụng để mô phỏng tính năng này bằng cách chỉ định nfds là 0; readfds, writefds, và exceptfds là NULL; và khoảng thời gian sleep mong muốn trong timeout.

Trên Linux, nếu select() trả về do một hoặc nhiều file descriptor trở nên sẵn sàng, và nếu timeout là non-NULL (khác NULL), thì select() sẽ cập nhật cấu trúc mà timeout trỏ tới để cho biết còn lại bao nhiêu thời gian trước khi lời gọi hàm lẽ ra đã bị timeout. Tuy nhiên, hành vi này phụ thuộc vào từng cài đặt (implementation-specific). SUSv3 cũng cho phép khả năng một cài đặt giữ nguyên cấu trúc do timeout trỏ tới không đổi và hầu hết các cài đặt UNIX khác không sửa đổi cấu trúc này. Các ứng dụng có thể di port (portable application) sử dụng select() bên trong một vòng lặp nên luôn đảm bảo rằng cấu trúc do timeout trỏ tới được khởi tạo trước mỗi lần gọi select(), đồng thời nên bỏ qua thông tin được trả về trong cấu trúc sau lời gọi hàm.

SUSv3 nêu rằng cấu trúc do timeout trỏ tới chỉ được sửa đổi khi select() trả về thành công. Tuy nhiên, trên Linux, nếu select() bị ngắt bởi một signal handler (khiến nó thất bại với lỗi EINTR), thì cấu trúc này sẽ bị sửa đổi để cho biết thời gian còn lại cho đến khi timeout xảy ra (tức là giống như một lần trả về thành công).

Nếu chúng ta sử dụng system call (lời gọi hệ thống) personality() đặc trưng của Linux để thiết lập một personality (đặc tính tiến trình) bao gồm bit personality STICKY_TIMEOUTS, thì select() sẽ không sửa đổi cấu trúc do timeout trỏ tới.

### Giá trị trả về từ select()

Là kết quả của hàm, select() trả về một trong các giá trị sau:

- Giá trị trả về –1 cho biết đã xảy ra lỗi. Các lỗi có thể xảy ra bao gồm EBADF và EINTR. EBADF cho biết một trong các file descriptor trong readfds, writefds, hoặc exceptfds không hợp lệ (ví dụ: hiện không được mở). EINTR cho biết lời gọi hàm đã bị ngắt bởi một signal handler. (Như đã lưu ý trong Phần 21.5, select() không bao giờ được tự động khởi động lại nếu bị ngắt bởi một signal handler.)
- Giá trị trả về là 0 có nghĩa là lời gọi hàm đã bị timeout trước khi bất kỳ file descriptor nào trở nên sẵn sàng. Trong trường hợp này, mỗi tập hợp file descriptor trả về sẽ trống.
- Giá trị trả về dương cho biết một hoặc nhiều file descriptor đã sẵn sàng. Giá trị trả về là số lượng các descriptor đã sẵn sàng. Trong trường hợp này, mỗi tập hợp file descriptor trả về phải được kiểm tra (sử dụng FD_ISSET()) để tìm xem các sự kiện I/O nào đã xảy ra. Nếu cùng một file descriptor được chỉ định trong nhiều hơn một tập hợp readfds, writefds, và exceptfds, nó sẽ được tính nhiều lần nếu nó sẵn sàng cho nhiều hơn một sự kiện. Nói cách khác, select() trả về tổng số lượng file descriptor được đánh dấu là sẵn sàng trong cả ba tập hợp trả về.

### Chương trình mẫu

Chương trình trong [Liệt kê 63-1](#page-45-0) minh họa việc sử dụng select(). Bằng cách sử dụng các đối số dòng lệnh (command-line arguments), chúng ta có thể chỉ định thời gian timeout và các file descriptor mà chúng ta muốn giám sát. Đối số dòng lệnh đầu tiên chỉ định thời gian timeout cho select(), tính bằng giây. Nếu một dấu gạch nối (-) được chỉ định ở đây, thì select() được gọi với timeout là NULL, có nghĩa là block vô thời hạn. Mỗi đối số dòng lệnh tiếp theo chỉ định số hiệu của một file descriptor cần giám sát, theo sau là các chữ cái biểu thị các thao tác mà descriptor đó cần được kiểm tra. Các chữ cái chúng ta có thể chỉ định ở đây là r (sẵn sàng đọc - ready for read) và w (sẵn sàng ghi - ready for write).

**Liệt kê 63-1:** Sử dụng select() để giám sát nhiều file descriptor

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/t_select.c
## include <sys/time.h>
## include <sys/select.h>
## include "tlpi_hdr.h"
static void
usageError(const char *progName)
{
 fprintf(stderr, "Usage: %s {timeout|-} fd-num[rw]...\n", progName);
 fprintf(stderr, " - means infinite timeout; \n");
 fprintf(stderr, " r = monitor for read\n");
 fprintf(stderr, " w = monitor for write\n\n");
 fprintf(stderr, " e.g.: %s - 0rw 1w\n", progName);
 exit(EXIT_FAILURE);
}
```

```c
int
main(int argc, char *argv[])
 fd_set readfds, writefds;
 int ready, nfds, fd, numRead, j;
 struct timeval timeout;
 struct timeval *pto;
 char buf[10]; /* Đủ lớn để chứa "rw\0" */
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
 usageError(argv[0]);
 /* Thời gian timeout cho select() được chỉ định trong argv[1] */
 if (strcmp(argv[1], "-") == 0) {
 pto = NULL; /* Timeout vô hạn (Infinite timeout) */
 } else {
 pto = &timeout;
 timeout.tv_sec = getLong(argv[1], 0, "timeout");
 timeout.tv_usec = 0; /* Không có microsecond */
 }
 /* Xử lý các đối số còn lại để xây dựng tập file descriptor (file descriptor sets) */
 nfds = 0;
 FD_ZERO(&readfds);
 FD_ZERO(&writefds);
 for (j = 2; j < argc; j++) {
 numRead = sscanf(argv[j], "%d%2[rw]", &fd, buf);
 if (numRead != 2)
 usageError(argv[0]);
 if (fd >= FD_SETSIZE)
 cmdLineErr("file descriptor vượt quá giới hạn (%d)\n", FD_SETSIZE);
 if (fd >= nfds)
 nfds = fd + 1; /* Ghi lại giá trị max fd + 1 */
 if (strchr(buf, 'r') != NULL)
 FD_SET(fd, &readfds);
 if (strchr(buf, 'w') != NULL)
 FD_SET(fd, &writefds);
 }
 /* Chúng ta đã xây dựng xong các đối số; bây giờ gọi select() */
 ready = select(nfds, &readfds, &writefds, NULL, pto);
 /* Bỏ qua các sự kiện ngoại lệ (exceptional events) */
 if (ready == -1)
 errExit("select");
 /* Hiển thị kết quả của select() */
 printf("ready = %d\n", ready);
```

{

```c
 for (fd = 0; fd < nfds; fd++)
 printf("%d: %s%s\n", fd, FD_ISSET(fd, &readfds) ? "r" : "",
 FD_ISSET(fd, &writefds) ? "w" : "");
 if (pto != NULL)
 printf("timeout sau select(): %ld.%03ld\n",
 (long) timeout.tv_sec, (long) timeout.tv_usec / 10000);
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/t_select.c
```

Trong nhật ký phiên shell (shell session log) tiếp theo, chúng tôi minh họa việc sử dụng chương trình trong [List](#page-45-0)[ing 63-1](#page-45-0). Trong ví dụ đầu tiên, chúng ta tạo một yêu cầu giám sát file descriptor 0 để đọc (input) với thời gian timeout là 10 giây:

```bash
$ ./t_select 10 0r
Nhấn Enter, để một dòng đầu vào có sẵn trên file descriptor 0
ready = 1
0: r
timeout sau select(): 8.003
$ Dấu nhắc lệnh shell tiếp theo được hiển thị
```

Kết quả đầu ra ở trên cho chúng ta thấy rằng `select()` đã xác định có một file descriptor sẵn sàng. Đó chính là file descriptor 0, đang sẵn sàng để đọc (ready for reading). Chúng ta cũng có thể thấy rằng giá trị timeout đã bị thay đổi. Dòng đầu ra cuối cùng, chỉ bao gồm dấu nhắc shell `$`, xuất hiện vì chương trình `t_select` không đọc ký tự xuống dòng (newline character) đã làm cho file descriptor 0 trở nên sẵn sàng, và do đó ký tự đó đã được shell đọc, dẫn đến việc shell phản hồi bằng cách in ra một dấu nhắc mới.

Trong ví dụ tiếp theo, chúng ta lại giám sát file descriptor 0 để nhận đầu vào, nhưng lần này với thời gian timeout là 0 giây:

```bash
$ ./t_select 0 0r
ready = 0
timeout sau select(): 0.000
```

Lời gọi hàm `select()` trả về ngay lập tức và không tìm thấy file descriptor nào sẵn sàng.

Trong ví dụ tiếp theo, chúng ta giám sát hai file descriptor: descriptor 0, để kiểm tra xem có đầu vào hay không, và descriptor 1, để kiểm tra xem có thể ghi (output) được không. Trong trường hợp này, chúng ta chỉ định timeout là `NULL` (đối số dòng lệnh đầu tiên là dấu gạch ngang), có nghĩa là vô hạn:

```bash
$ ./t_select - 0r 1w
ready = 1
0:
1: w
```

Lời gọi hàm `select()` trả về ngay lập tức, thông báo cho chúng ta rằng việc ghi dữ liệu là khả thi trên file descriptor 1.

### 63.2.2 Lời gọi hệ thống poll()

Lời gọi hệ thống (`System Call`) `poll()` thực hiện một tác vụ tương tự như `select()`. Sự khác biệt lớn nhất giữa hai lời gọi hệ thống này nằm ở cách chúng ta chỉ định các tệp mô tả (`File Descriptor`) cần theo dõi. Với `select()`, chúng ta cung cấp ba tập hợp (sets), mỗi tập hợp được đánh dấu để chỉ định các tệp mô tả quan tâm. Với `poll()`, chúng ta cung cấp một danh sách các tệp mô tả, mỗi tệp được đánh dấu bằng tập hợp các sự kiện quan tâm.

```
## include <poll.h>
int poll(struct pollfd fds[], nfds_t nfds, int timeout);
          Trả về số lượng tệp mô tả sẵn sàng, 0 khi hết thời gian (timeout), hoặc –1 khi lỗi
```

Đối số `fds` và mảng `pollfd` (`nfds`) chỉ định các tệp mô tả mà `poll()` sẽ theo dõi. Đối số `timeout` có thể được sử dụng để thiết lập giới hạn trên cho thời gian mà `poll()` sẽ chặn (`block`). Chúng ta mô tả chi tiết từng đối số này dưới đây.

### Mảng pollfd

Đối số `fds` liệt kê các tệp mô tả sẽ được theo dõi bởi `poll()`. Đối số này là một mảng các cấu trúc `pollfd`, được định nghĩa như sau:

```
struct pollfd {
 int fd; /* Tệp mô tả (File descriptor) */
 short events; /* Mặt nạ bit sự kiện yêu cầu (Requested events bit mask) */
 short revents; /* Mặt nạ bit sự kiện trả về (Returned events bit mask) */
};
```

Đối số `nfds` chỉ định số lượng phần tử trong mảng `fds`. Kiểu dữ liệu `nfds_t` được sử dụng cho đối số `nfds` là một kiểu số nguyên không dấu (`unsigned integer type`).

Các trường `events` và `revents` của cấu trúc `pollfd` là các mặt nạ bit (`bit masks`). Tiến trình gọi (`caller`) khởi tạo `events` để chỉ định các sự kiện cần theo dõi đối với tệp mô tả `fd`. Khi `poll()` trả về, `revents` được thiết lập để chỉ ra sự kiện nào trong số đó thực sự đã xảy ra đối với tệp mô tả này.

Bảng 63-2 liệt kê các bit có thể xuất hiện trong các trường `events` và `revents`. Nhóm bit đầu tiên trong bảng này (`POLLIN`, `POLLRDNORM`, `POLLRDBAND`, `POLLPRI`, và `POLLRDHUP`) liên quan đến các sự kiện đầu vào (`input events`). Nhóm bit tiếp theo (`POLLOUT`, `POLLWRNORM`, và `POLLWRBAND`) liên quan đến các sự kiện đầu ra (`output events`). Nhóm bit thứ ba (`POLLERR`, `POLLHUP`, và `POLLNVAL`) được thiết lập trong trường `revents` để trả về thông tin bổ sung về tệp mô tả. Nếu được chỉ định trong trường `events`, ba bit này sẽ bị bỏ qua. Bit cuối cùng (`POLLMSG`) không được sử dụng bởi `poll()` trên Linux.

> Trên các cài đặt UNIX cung cấp thiết bị STREAMS, `POLLMSG` cho biết một thông điệp chứa tín hiệu `SIGPOLL` đã đến đầu của luồng (stream). `POLLMSG` không được sử dụng trên Linux, bởi vì Linux không cài đặt STREAMS.

**Bảng 63-2:** Giá trị mặt nạ bit cho các trường `events` và `revents` của cấu trúc `pollfd`

| Bit        | Đầu vào trong | Trả về trong| Mô tả                                          |
|------------|--------------|-------------|------------------------------------------------|
|            | events?      | revents?    |                                                |
| POLLIN     | •            | •           | Dữ liệu khác dữ liệu ưu tiên cao có thể đọc    |
| POLLRDNORM | •            | •           | Tương đương với POLLIN                         |
| POLLRDBAND | •            | •           | Dữ liệu ưu tiên có thể đọc (không dùng trên Linux) |
| POLLPRI    | •            | •           | Dữ liệu ưu tiên cao có thể đọc                 |
| POLLRDHUP  | •            | •           | Ngắt kết nối (shutdown) trên socket đối tác    |
| POLLOUT    | •            | •           | Dữ liệu thông thường có thể ghi                |
| POLLWRNORM | •            | •           | Tương đương với POLLOUT                        |
| POLLWRBAND | •            | •           | Dữ liệu ưu tiên có thể ghi                     |
| POLLERR    |              | •           | Đã xảy ra lỗi                                  |
| POLLHUP    |              | •           | Đã xảy ra sự cố ngắt kết nối (hangup)          |
| POLLNVAL   |              | •           | Tệp mô tả không mở                             |
| POLLMSG    |              |             | Không dùng trên Linux (và không được định nghĩa trong SUSv3) |

Phần này cho phép chỉ định `events` là 0 nếu chúng ta không quan tâm đến các sự kiện trên một tệp mô tả cụ thể. Hơn nữa, việc chỉ định một giá trị âm cho trường `fd` (ví dụ: đổi dấu giá trị của nó nếu khác không) sẽ khiến trường `events` tương ứng bị bỏ qua và trường `revents` luôn trả về là 0. Bất kỳ kỹ thuật nào trong số này đều có thể được sử dụng để (có thể tạm thời) vô hiệu hóa việc theo dõi một tệp mô tả đơn lẻ, mà không cần phải xây dựng lại toàn bộ danh sách `fds`.

Lưu ý các điểm sau đây liên quan đến việc cài đặt `poll()` trên Linux:

- Mặc dù được định nghĩa là các bit riêng biệt, `POLLIN` và `POLLRDNORM` đồng nghĩa với nhau.
- Mặc dù được định nghĩa là các bit riêng biệt, `POLLOUT` và `POLLWRNORM` đồng nghĩa với nhau.
- `POLLRDBAND` nhìn chung không được sử dụng; nghĩa là, nó bị bỏ qua trong trường `events` và không được thiết lập trong `revents`.

Nơi duy nhất mà `POLLRDBAND` được thiết lập là trong mã nguồn cài đặt giao thức mạng DECnet (đã lỗi thời).

Mặc dù được thiết lập cho các socket trong một số trường hợp nhất định, `POLLWRBAND` không truyền tải thông tin hữu ích nào. (Không có trường hợp nào mà `POLLWRBAND` được thiết lập khi `POLLOUT` và `POLLWRNORM` không đồng thời được thiết lập.)

> POLLRDBAND và POLLWRBAND có ý nghĩa trên các hệ thống triển khai cung cấp System V STREAMS (mà Linux không hỗ trợ). Dưới STREAMS, một thông điệp (message) có thể được gán một mức ưu tiên khác 0, và các thông điệp như vậy được đưa vào hàng đợi (queue) gửi đến bên nhận theo thứ tự ưu tiên giảm dần, trong một dải băng (band) nằm trước các thông điệp thông thường (ưu tiên 0).

Macro kiểm tra tính năng `_XOPEN_SOURCE` phải được định nghĩa để lấy được các định nghĩa của các hằng số `POLLRDNORM`, `POLLRDBAND`, `POLLWRNORM` và `POLLWRBAND` từ `<poll.h>`.

- `POLLRDHUP` là một cờ đặc trưng của Linux (Linux-specific flag) có sẵn kể từ kernel 2.6.17. Để lấy định nghĩa này từ `<poll.h>`, macro kiểm tra tính năng `_GNU_SOURCE` phải được định nghĩa.
- `POLLNVAL` được trả về nếu mô tả tệp (File Descriptor) được chỉ định đã bị đóng tại thời điểm gọi hàm `poll()`.

Tóm tắt các điểm trên, các cờ `poll()` thực sự đáng quan tâm là `POLLIN`, `POLLOUT`, `POLLPRI`, `POLLRDHUP`, `POLLHUP`, và `POLLERR`. Chúng ta sẽ xem xét ý nghĩa của các cờ này chi tiết hơn ở Mục [63.2.3](#page-52-0).

### Tham số timeout

Tham số `timeout` quyết định hành vi chặn (blocking behavior) của `poll()` như sau:

- Nếu `timeout` bằng –1, tiến trình sẽ chặn (block) cho đến khi một trong các mô tả tệp được liệt kê trong mảng `fds` sẵn sàng (như được xác định bởi trường `events` tương ứng) hoặc một tín hiệu (signal) bị bắt.
- Nếu `timeout` bằng 0, không chặn—chỉ thực hiện kiểm tra để xem mô tả tệp nào đã sẵn sàng.
- Nếu `timeout` lớn hơn 0, chặn tối đa trong khoảng thời gian `timeout` tính bằng mili-giây, cho đến khi một trong các mô tả tệp trong `fds` sẵn sàng, hoặc cho đến khi một tín hiệu bị bắt.

Giống như `select()`, độ chính xác của `timeout` bị giới hạn bởi độ chi tiết (granularity) của đồng hồ phần mềm (software clock) (Mục 10.6), và SUSv3 quy định rằng `timeout` luôn được làm tròn lên nếu nó không phải là một bội số chính xác của độ chi tiết đồng hồ.

### Giá trị trả về từ poll()

Là kết quả hàm của nó, `poll()` trả về một trong các giá trị sau:

- Giá trị trả về là –1 cho biết đã xảy ra lỗi. Một lỗi có thể xảy ra là `EINTR`, cho biết lời gọi đã bị gián đoạn bởi một trình xử lý tín hiệu (signal handler). (Như đã lưu ý trong Mục 21.5, `poll()` không bao giờ tự động khởi động lại nếu bị gián đoạn bởi trình xử lý tín hiệu).
- Giá trị trả về là 0 có nghĩa là lời gọi đã hết thời gian chờ (timeout) trước khi bất kỳ mô tả tệp nào trở nên sẵn sàng.
- Giá trị trả về dương cho biết một hoặc nhiều mô tả tệp đã sẵn sàng. Giá trị được trả về là số lượng cấu trúc `pollfd` trong mảng `fds` có trường `revents` khác 0.

Lưu ý sự khác biệt nhỏ về ý nghĩa của giá trị trả về dương giữa `select()` và `poll()`. System Call `select()` đếm một mô tả tệp nhiều lần nếu nó xuất hiện trong nhiều hơn một tập hợp mô tả tệp được trả về. System Call `poll()` trả về số lượng mô tả tệp sẵn sàng, và một mô tả tệp chỉ được đếm một lần, ngay cả khi có nhiều bit được thiết lập trong trường `revents` tương ứng.

### Chương trình ví dụ

Danh sách 63-2 cung cấp một minh họa đơn giản về việc sử dụng `poll()`. Chương trình này tạo ra một số đường ống (pipe) (mỗi pipe sử dụng một cặp mô tả tệp liên tiếp), ghi các byte vào đầu ghi của các pipe được chọn ngẫu nhiên, và sau đó thực hiện `poll()` để xem pipe nào có dữ liệu sẵn sàng để đọc.

Phiên dòng lệnh (shell session) sau đây cho thấy một ví dụ về những gì chúng ta thấy khi chạy chương trình này. Các tham số dòng lệnh truyền vào chương trình chỉ định rằng mười pipe nên được tạo, và các thao tác ghi sẽ được thực hiện trên ba pipe được chọn ngẫu nhiên.

```
$ ./poll_pipes 10 3
Writing to fd: 4 (read fd: 3)
Writing to fd: 14 (read fd: 13)
Writing to fd: 14 (read fd: 13)
poll() returned: 2
Readable: 3
Readable: 13
```

Từ kết quả đầu ra trên, chúng ta có thể thấy rằng `poll()` đã tìm thấy hai pipe có sẵn dữ liệu để đọc.

**Danh sách 63-2:** Sử dụng `poll()` để giám sát nhiều mô tả tệp (file descriptor)

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/poll_pipes.c
## include <time.h>
## include <poll.h>
## include "tlpi_hdr.h"
int
main(int argc, char *argv[])
{
 int numPipes, j, ready, randPipe, numWrites;
 int (*pfds)[2]; /* File descriptors cho tất cả các pipe */
 struct pollfd *pollFd;
 if (argc < 2 || strcmp(argv[1], "--help") == 0)
 usageErr("%s num-pipes [num-writes]\n", argv[0]);
 /* Cấp phát các mảng mà chúng ta sử dụng. Kích thước các mảng được xác định
 dựa trên số lượng pipe được chỉ định trên dòng lệnh */
 numPipes = getInt(argv[1], GN_GT_0, "num-pipes");
 pfds = calloc(numPipes, sizeof(int [2]));
 if (pfds == NULL)
 errExit("malloc");
 pollFd = calloc(numPipes, sizeof(struct pollfd));
 if (pollFd == NULL)
 errExit("malloc");
 /* Tạo số lượng pipe được chỉ định trên dòng lệnh */
 for (j = 0; j < numPipes; j++)
 if (pipe(pfds[j]) == -1)
 errExit("pipe %d", j);
 /* Thực hiện số lần ghi được chỉ định vào các pipe ngẫu nhiên */
 numWrites = (argc > 2) ? getInt(argv[2], GN_GT_0, "num-writes") : 1;
```

```
 srandom((int) time(NULL));
 for (j = 0; j < numWrites; j++) {
 randPipe = random() % numPipes;
 printf("Writing to fd: %3d (read fd: %3d)\n",
 pfds[randPipe][1], pfds[randPipe][0]);
 if (write(pfds[randPipe][1], "a", 1) == -1)
 errExit("write %d", pfds[randPipe][1]);
 }
 /* Xây dựng danh sách mô tả tệp để cung cấp cho poll(). Danh sách này
 được thiết lập để chứa các mô tả tệp cho đầu đọc của tất cả
 các pipe. */
 for (j = 0; j < numPipes; j++) {
 pollFd[j].fd = pfds[j][0];
 pollFd[j].events = POLLIN;
 }
 ready = poll(pollFd, numPipes, -1); /* Không chặn (Nonblocking) */
 if (ready == -1)
 errExit("poll");
 printf("poll() returned: %d\n", ready);
 /* Kiểm tra xem pipe nào có dữ liệu sẵn sàng để đọc */
 for (j = 0; j < numPipes; j++)
 if (pollFd[j].revents & POLLIN)
 printf("Readable: %d %3d\n", j, pollFd[j].fd);
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/poll_pipes.c
```

### 63.2.3 Khi nào một File Descriptor sẵn sàng?

Sử dụng chính xác các hàm `select()` và `poll()` đòi hỏi sự hiểu biết về các điều kiện dưới đây mà một bộ mô tả tệp (`file descriptor`) được biểu thị là đã sẵn sàng. Tiêu chuẩn SUSv3 nêu rõ rằng một `file descriptor` (với cờ `O_NONBLOCK` được xóa) được coi là sẵn sàng nếu một lời gọi hàm I/O không bị chặn (block), bất kể hàm đó có thực sự truyền dữ liệu hay không. Điểm mấu chốt được in nghiêng: `select()` và `poll()` cho chúng ta biết liệu một thao tác I/O có bị chặn hay không, thay vì cho biết liệu nó có truyền dữ liệu thành công hay không. Dưới góc độ này, chúng ta hãy xem xét các System Call này hoạt động như thế nào đối với các loại `file descriptor` khác nhau. Chúng tôi hiển thị thông tin này trong các bảng bao gồm hai cột:

- Cột `select()` cho biết liệu một `file descriptor` được đánh dấu là có thể đọc (r), có thể ghi (w), hoặc có một điều kiện ngoại lệ (x).
- Cột `poll()` cho biết các bit được trả về trong trường `revents`. Trong các bảng này, chúng tôi bỏ qua việc nhắc đến `POLLRDNORM`, `POLLWRNORM`, `POLLRDBAND` và `POLLWRBAND`. Mặc dù một số cờ này có thể được trả về trong `revents` dưới nhiều hoàn cảnh khác nhau (nếu chúng được chỉ định trong `events`), chúng không truyền tải thông tin hữu ích nào ngoài những gì được cung cấp bởi `POLLIN`, `POLLOUT`, `POLLHUP` và `POLLERR`.

### Tệp thông thường (Regular files)

Các `file descriptor` tham chiếu đến các tệp thông thường luôn được đánh dấu là có thể đọc và ghi bởi `select()`, và được trả về với `POLLIN` và `POLLOUT` được thiết lập trong `revents` đối với `poll()`, vì những lý do sau:

- Một hàm `read()` sẽ luôn trả về ngay lập tức dữ liệu, kết thúc tệp (end-of-file), hoặc một lỗi (ví dụ: tệp không được mở để đọc).
- Một hàm `write()` sẽ luôn truyền dữ liệu ngay lập tức hoặc thất bại với một lỗi nào đó.

SUSv3 cho biết `select()` cũng nên đánh dấu một `file descriptor` cho tệp thông thường là có điều kiện ngoại lệ (mặc dù điều này không có ý nghĩa rõ ràng đối với tệp thông thường). Chỉ một số cài đặt (implementations) làm điều này; Linux là một trong những hệ thống không làm vậy.

### Thiết bị đầu cuối và thiết bị đầu cuối giả (Terminals and pseudoterminals)

[Bảng 63-3](#page-53-0) tóm tắt hành vi của `select()` và `poll()` đối với các terminal và pseudoterminal (Chương [64\)](#page-86-0).

Khi một nửa của một cặp pseudoterminal bị đóng, thiết lập `revents` được trả về bởi `poll()` cho nửa còn lại của cặp phụ thuộc vào việc cài đặt. Trên Linux, ít nhất cờ `POLLHUP` được thiết lập. Tuy nhiên, các cài đặt khác trả về nhiều cờ khác nhau để biểu thị sự kiện này—ví dụ: `POLLHUP`, `POLLERR`, hoặc `POLLIN`. Hơn nữa, trên một số cài đặt, các cờ được thiết lập phụ thuộc vào việc thiết bị master hay slave đang được giám sát.

| Điều kiện hoặc sự kiện                                          | select() | poll()   |
|-----------------------------------------------------------------|----------|----------|
| Có sẵn đầu vào (Input available)                                | r        | POLLIN   |
| Có thể ghi đầu ra (Output possible)                             | w        | POLLOUT  |
| Sau khi close() bởi pseudoterminal peer                         | rw       | Xem văn bản |
| Pseudoterminal master ở chế độ gói (packet mode) phát hiện thay đổi trạng thái slave | x        | POLLPRI  |

### Pipes và FIFOs

[Bảng 63-4](#page-54-0) tóm tắt các chi tiết cho đầu đọc của một pipe hoặc FIFO. Cột Data in pipe? cho biết liệu pipe có ít nhất 1 byte dữ liệu có sẵn để đọc hay không. Trong bảng này, chúng ta giả định rằng `POLLIN` được chỉ định trong trường `events` cho `poll()`.

Trên một số cài đặt UNIX khác, nếu đầu ghi của một pipe bị đóng, thì thay vì trả về với `POLLHUP` được thiết lập, `poll()` trả về với bit `POLLIN` được thiết lập (vì một hàm `read()` sẽ trả về ngay lập tức với kết thúc tệp). Các ứng dụng khả chuyển (portable applications) nên kiểm tra xem một trong hai bit có được thiết lập hay không để biết liệu một hàm `read()` có bị chặn hay không.

Bảng 63-5 tóm tắt các chi tiết cho đầu ghi của một pipe. Trong bảng này, chúng ta giả định rằng `POLLOUT` được chỉ định trong trường `events` cho `poll()`. Cột Space for PIPE_BUF bytes? cho biết liệu pipe có chỗ trống để ghi nguyên tử (atomically) `PIPE_BUF` byte mà không bị chặn hay không. Đây là tiêu chuẩn mà Linux coi một pipe sẵn sàng để ghi. Một số cài đặt UNIX khác sử dụng cùng tiêu chuẩn này; số khác coi một pipe có thể ghi ngay cả khi chỉ một byte duy nhất có thể được ghi. (Trong Linux 2.6.10 trở về trước, dung lượng của một pipe giống với `PIPE_BUF`. Điều này có nghĩa là một pipe được coi là không thể ghi nếu nó chứa thậm chí chỉ một byte dữ liệu duy nhất.)

Trên một số cài đặt UNIX khác, nếu đầu đọc của một pipe bị đóng, thì thay vì trả về với `POLLERR` được thiết lập, `poll()` trả về với bit `POLLOUT` hoặc bit `POLLHUP` được thiết lập. Các ứng dụng khả chuyển cần kiểm tra xem bất kỳ bit nào trong số này có được thiết lập hay không để xác định xem một hàm `write()` có bị chặn hay không.

**Bảng 63-4:** Các chỉ báo của `select()` và `poll()` cho đầu đọc của một pipe hoặc FIFO

|               | Điều kiện hoặc sự kiện |          |                  |  |
|---------------|------------------------|----------|------------------|--|

|---------------|--------------------|----------|------------------|--|
| Data trong pipe? | Đầu ghi (write end) mở? | select() | poll() | |
| không | không | r | POLLHUP | |
| có | có | r | POLLIN | |
| có | không | r | POLLIN POLLHUP | |

**Bảng 63-5:** Các chỉ báo của select() và poll() đối với đầu ghi của một pipe hoặc FIFO

| Điều kiện hoặc sự kiện | | | |
|---------------------------------------------|-----|----------|-------------------|
| Còn đủ chỗ chứa PIPE_BUF bytes?<br>Đầu đọc (read end) mở? | | select() | poll() |
| không | không | w | POLLERR |
| có | có | w | POLLOUT |
| có | không | w | POLLOUT POLLERR |

### Sockets

[Bảng 63-6](#page-54-1) tóm tắt hành vi của select() và poll() đối với các socket. Đối với cột poll(), chúng ta giả sử rằng sự kiện (events) được chỉ định là `(POLLIN | POLLOUT | POLLPRI)`. Đối với cột select(), chúng ta giả sử rằng File Descriptor (mô tả tệp) đang được kiểm tra để xem liệu có khả năng đọc dữ liệu (input), khả năng ghi dữ liệu (output), hay xảy ra một điều kiện ngoại lệ (exceptional condition) hay không (nghĩa là File Descriptor được chỉ định trong cả ba tập hợp truyền vào hàm select()). Bảng này chỉ đề cập đến các trường hợp phổ biến, không bao gồm tất cả các kịch bản có thể xảy ra.

> Hành vi của poll() trên Linux đối với UNIX domain socket sau khi bên kia gọi close() sẽ khác với những gì được thể hiện trong [Bảng 63-6](#page-54-1). Ngoài các cờ khác, poll() còn trả về bổ sung `POLLHUP` trong trường `revents`.

**Bảng 63-6:** Các chỉ báo của select() và poll() đối với sockets

| Điều kiện hoặc sự kiện | select() | poll() |
|-----------------------------------------------------------------------|----------|---------------------------------|
| Có sẵn dữ liệu đầu vào (Input available) | r | POLLIN |
| Có khả năng ghi đầu ra (Output possible) | w | POLLOUT |
| Kết nối đến đã được thiết lập trên listening socket | r | POLLIN |
| Nhận được dữ liệu băng thông ngoài - Out-of-band data (chỉ áp dụng cho TCP) | x | POLLPRI |
| Bên đầu kia của stream socket đã đóng kết nối hoặc thực thi<br>shutdown(SHUT_WR) | rw | POLLIN POLLOUT <br>POLLRDHUP |

Cờ `POLLRDHUP` đặc thù của Linux (có sẵn từ Linux 2.6.17) cần được giải thích kỹ hơn một chút. Cờ này—thực tế ở dạng `EPOLLRDHUP`—được thiết kế chủ yếu để sử dụng với chế độ kích hoạt theo sườn (edge-triggered mode) của API epoll (Mục [63.4](#page-66-0)). Nó được trả về khi phía đầu xa của một kết nối stream socket đã đóng (shut down) nửa ghi của kết nối. Việc sử dụng cờ này cho phép một ứng dụng sử dụng giao diện edge-triggered của epoll có thể viết mã nguồn đơn giản hơn để nhận biết việc đầu xa đóng kết nối. (Giải pháp thay thế là ứng dụng phải lưu ý rằng cờ `POLLIN` được thiết lập và sau đó thực hiện lệnh read(), việc này sẽ báo hiệu đầu xa đã đóng kết nối bằng giá trị trả về là 0).

### 63.2.4 So sánh select() và poll()

Trong phần này, chúng ta xem xét một số điểm tương đồng và khác biệt giữa select() và poll().

### Chi tiết cài đặt

Bên trong Linux kernel, cả `select()` và `poll()` đều sử dụng cùng một tập hợp các hàm poll nội bộ của kernel (kernel-internal poll routines). Các hàm poll này tách biệt với chính System Call `poll()`. Mỗi hàm trả về thông tin về trạng thái sẵn sàng (readiness) của một File Descriptor duy nhất. Thông tin trạng thái sẵn sàng này có dạng một mặt nạ bit (bit mask) mà giá trị của chúng tương ứng với các bit được trả về trong trường `revents` bởi System Call `poll()` (Bảng 63-2). Việc cài đặt System Call `poll()` bao gồm việc gọi hàm poll của kernel cho từng File Descriptor và đặt thông tin kết quả vào trường `revents` tương ứng.

Để cài đặt `select()`, một tập hợp các macro được sử dụng để chuyển đổi thông tin do các hàm poll của kernel trả về thành các loại sự kiện tương ứng do `select()` trả về:

```
## define POLLIN_SET (POLLRDNORM | POLLRDBAND | POLLIN | POLLHUP | POLLERR)
 /* Sẵn sàng đọc */
## define POLLOUT_SET (POLLWRBAND | POLLWRNORM | POLLOUT | POLLERR)
 /* Sẵn sàng ghi */
## define POLLEX_SET (POLLPRI) /* Điều kiện ngoại lệ */
```

Các định nghĩa macro này cho thấy mối tương quan ngữ nghĩa giữa thông tin do `select()` và `poll()` trả về. (Nếu chúng ta nhìn vào các cột `select()` và `poll()` trong các bảng ở Mục [63.2.3,](#page-52-0) chúng ta thấy rằng các chỉ báo được cung cấp bởi mỗi System Call là nhất quán với các macro trên). Thông tin bổ sung duy nhất chúng ta cần để hoàn thiện bức tranh là `poll()` trả về `POLLNVAL` trong trường `revents` nếu một trong các File Descriptor được giám sát đã bị đóng tại thời điểm gọi, trong khi `select()` trả về –1 với `errno` được thiết lập thành `EBADF`.

### Sự khác biệt về API

Dưới đây là một số điểm khác biệt giữa API của `select()` và `poll()`:

- Việc sử dụng kiểu dữ liệu `fd_set` áp đặt một giới hạn trên (`FD_SETSIZE`) đối với dải các File Descriptor có thể được giám sát bởi `select()`. Theo mặc định, giới hạn này là 1024 trên Linux và việc thay đổi nó đòi hỏi phải biên dịch lại ứng dụng. Ngược lại, `poll()` không áp đặt giới hạn nội tại nào đối với dải các File Descriptor có thể được giám sát.
- Vì các đối số `fd_set` của `select()` đóng vai trò vừa là đầu vào vừa là đầu ra (value-result), chúng ta phải khởi tạo lại chúng nếu thực hiện các lời gọi `select()` lặp đi lặp lại bên trong một vòng lặp. Bằng cách sử dụng các trường sự kiện riêng biệt cho `events` (đầu vào) và `revents` (đầu ra), `poll()` tránh được yêu cầu này.

- Độ chính xác của timeout do `select()` cung cấp (đơn vị micro giây) lớn hơn độ chính xác do `poll()` cung cấp (đơn vị mili giây). (Tuy nhiên, độ chính xác về thời gian chờ của cả hai System Call này vẫn bị giới hạn bởi độ chi tiết của đồng hồ phần mềm - software clock granularity).
- Nếu một trong các File Descriptor đang được giám sát đã bị đóng, thì `poll()` thông báo cho chúng ta biết chính xác đó là cái nào, thông qua bit `POLLNVAL` trong trường `revents` tương ứng. Ngược lại, `select()` chỉ đơn thuần trả về –1 với `errno` được thiết lập thành `EBADF`, để mặc chúng ta phải tự xác định File Descriptor nào đã bị đóng bằng cách kiểm tra lỗi khi thực hiện một I/O System Call trên Descriptor đó. Tuy nhiên, đây thường không phải là một sự khác biệt quan trọng, vì một ứng dụng thường có thể theo dõi được những File Descriptor nào nó đã đóng.

### Tính khả chuyển (Portability)

Trong lịch sử, `select()` có tính khả chuyển rộng rãi hơn so với `poll()`. Ngày nay, cả hai giao diện đều được chuẩn hóa bởi SUSv3 và có sẵn rộng rãi trên các hệ thống hiện đại. Tuy nhiên, có một số biến thể trong hành vi của `poll()` giữa các hệ thống khác nhau, như đã được lưu ý trong Mục [63.2.3.](#page-52-0)

### Hiệu năng

Hiệu năng của `poll()` và `select()` tương tự nhau nếu một trong các điều kiện sau đây đúng:

- Dải các File Descriptor cần giám sát nhỏ (tức là số hiệu File Descriptor tối đa thấp).
- Một số lượng lớn File Descriptor đang được giám sát, nhưng chúng được phân bố dày đặc (tức là hầu hết hoặc tất cả các File Descriptor từ 0 cho đến một giới hạn nào đó đều đang được giám sát).

Tuy nhiên, hiệu năng của `select()` và `poll()` có thể khác biệt rõ rệt nếu tập hợp các File Descriptor cần giám sát có tính thưa thớt (sparse); nghĩa là số hiệu File Descriptor tối đa, $N$, rất lớn, nhưng chỉ có một hoặc một vài Descriptor trong dải từ 0 đến $N$ đang được giám sát. Trong trường hợp này, `poll()` có thể mang lại hiệu năng tốt hơn `select()`. Chúng ta có thể hiểu lý do cho điều này bằng cách xem xét các đối số được truyền vào hai System Call. Với `select()`, chúng ta truyền một hoặc nhiều tập hợp File Descriptor và một số nguyên `nfds`, lớn hơn một đơn vị so với File Descriptor tối đa cần kiểm tra trong mỗi tập hợp. Đối số `nfds` có giá trị như nhau, bất kể chúng ta đang giám sát tất cả các File Descriptor trong dải từ 0 đến (`nfds` – 1) hay chỉ giám sát riêng Descriptor (`nfds` – 1). Trong cả hai trường hợp, kernel đều phải kiểm tra `nfds` phần tử trong mỗi tập hợp để xác định chính xác những File Descriptor nào cần được giám sát. Ngược lại, khi sử dụng `poll()`, chúng ta chỉ định rõ các File Descriptor mà chúng ta quan tâm, và kernel chỉ kiểm tra những Descriptor đó mà thôi.

> Sự khác biệt về hiệu năng giữa `poll()` và `select()` với các tập hợp mô tả thưa thớt (sparse descriptor sets) là khá đáng kể trong Linux 2.4. Một số tối ưu hóa trong Linux 2.6 đã thu hẹp đáng kể khoảng cách hiệu năng này.

Chúng ta sẽ xem xét hiệu năng của `select()` và `poll()` chi tiết hơn ở Mục [63.4.5](#page-76-0), nơi chúng ta so sánh hiệu năng của các system call này với `epoll`.

### 63.2.5 Các vấn đề với select() và poll()

Các system call `select()` và `poll()` là các phương thức có tính di port, tồn tại lâu đời và được sử dụng rộng rãi để giám sát trạng thái sẵn sàng của nhiều File Descriptor (mô tả tệp). Tuy nhiên, các API này gặp phải một số vấn đề khi giám sát một số lượng lớn File Descriptor:

- Trong mỗi lần gọi `select()` hoặc `poll()`, kernel phải kiểm tra tất cả các File Descriptor được chỉ định để xem chúng đã sẵn sàng hay chưa. Khi giám sát một số lượng lớn File Descriptor nằm trong một dải phân bố dày đặc (densely packed range), thời gian cần thiết cho thao tác này vượt trội hơn hẳn thời gian cần thiết cho hai thao tác tiếp theo.
- Trong mỗi lần gọi `select()` hoặc `poll()`, chương trình phải truyền một cấu trúc dữ liệu (data structure) cho kernel mô tả tất cả các File Descriptor cần giám sát, và sau khi kiểm tra các mô tả này, kernel trả về một phiên bản đã chỉnh sửa của cấu trúc dữ liệu này cho chương trình. (Hơn nữa, đối với `select()`, chúng ta phải khởi tạo cấu trúc dữ liệu trước mỗi lần gọi). Đối với `poll()`, kích thước của cấu trúc dữ liệu tăng lên theo số lượng File Descriptor đang được giám sát, và tác vụ sao chép nó từ User Space (không gian người dùng) sang Kernel Space (không gian nhân) và ngược lại tiêu tốn một lượng đáng kể thời gian CPU khi giám sát nhiều File Descriptor. Đối với `select()`, kích thước của cấu trúc dữ liệu được cố định bởi `FD_SETSIZE`, bất kể số lượng File Descriptor đang được giám sát là bao nhiêu.
- Sau khi gọi `select()` hoặc `poll()`, chương trình phải kiểm tra mọi phần tử của cấu trúc dữ liệu được trả về để xem File Descriptor nào đã sẵn sàng.

Hệ quả của các điểm trên là thời gian CPU mà `select()` và `poll()` yêu cầu sẽ tăng lên theo số lượng File Descriptor đang được giám sát (xem Mục [63.4.5](#page-76-0) để biết thêm chi tiết). Điều này gây ra vấn đề cho các chương trình giám sát số lượng lớn File Descriptor.

Hiệu năng mở rộng kém (poor scaling performance) của `select()` và `poll()` xuất phát từ một giới hạn đơn giản của các API này: thông thường, một chương trình thực hiện các lời gọi lặp đi lặp lại để giám sát cùng một tập hợp File Descriptor; tuy nhiên, kernel không ghi nhớ danh sách các File Descriptor cần giám sát giữa các lần gọi liên tiếp.

I/O hướng tín hiệu (Signal-driven I/O) và `epoll`, mà chúng ta sẽ tìm hiểu ở các phần tiếp theo, đều là những cơ chế cho phép kernel ghi lại một danh sách duy trì (persistent list) các File Descriptor mà một Process (tiến trình) quan tâm. Việc làm này loại bỏ các vấn đề về khả năng mở rộng hiệu năng của `select()` và `poll()`, mang lại các giải pháp mở rộng theo số lượng sự kiện I/O xảy ra, thay vì theo số lượng File Descriptor đang được giám sát. Do đó, Signal-driven I/O và `epoll` cung cấp hiệu năng vượt trội khi giám sát số lượng lớn File Descriptor.

## 63.3 I/O Hướng sự kiện tín hiệu (Signal-Driven I/O)

Với đa hợp I/O (I/O multiplexing), một tiến trình (process) thực hiện một lời gọi hệ thống (system call) (`select()` hoặc `poll()`) nhằm kiểm tra xem thao tác I/O có khả thi trên một mô tả tệp (file descriptor) hay không. Với I/O hướng sự kiện tín hiệu (signal-driven I/O), một tiến trình yêu cầu kernel gửi cho nó một tín hiệu (signal) khi I/O khả thi trên một mô tả tệp. Tiến trình sau đó có thể thực hiện bất kỳ hoạt động nào khác cho đến khi I/O khả thi, tại thời điểm đó tín hiệu được chuyển đến tiến trình. Để sử dụng signal-driven I/O, một chương trình thực hiện các bước sau:

- 1. Thiết lập một hàm xử lý (handler) cho tín hiệu được phân phối bởi cơ chế signal-driven I/O. Theo mặc định, tín hiệu thông báo này là `SIGIO`.
- 2. Đặt chủ sở hữu (owner) của mô tả tệp — nghĩa là tiến trình hoặc nhóm tiến trình (process group) sẽ nhận tín hiệu khi I/O khả thi trên mô tả tệp đó. Thông thường, chúng ta biến tiến trình gọi (calling process) thành chủ sở hữu. Chủ sở hữu được thiết lập bằng cách sử dụng thao tác `fcntl()` với `F_SETOWN` có dạng sau:

```
fcntl(fd, F_SETOWN, pid);
```

- 3. Bật I/O không chặn (nonblocking I/O) bằng cách thiết lập cờ trạng thái tệp mở `O_NONBLOCK`.
- 4. Bật signal-driven I/O bằng cách bật cờ trạng thái tệp mở `O_ASYNC`. Bước này có thể được kết hợp với bước trước, vì cả hai đều yêu cầu sử dụng thao tác `fcntl()` với `F_SETFL` (Mục 5.3), như trong ví dụ sau:

```
flags = fcntl(fd, F_GETFL); /* Lấy các cờ hiện tại */
fcntl(fd, F_SETFL, flags | O_ASYNC | O_NONBLOCK);
```

- 5. Tiến trình gọi giờ đây có thể thực hiện các tác vụ khác. Khi I/O trở nên khả thi, kernel tạo ra một tín hiệu cho tiến trình và gọi hàm xử lý tín hiệu đã được thiết lập ở bước 1.
- 6. Signal-driven I/O cung cấp thông báo kích hoạt theo cạnh (edge-triggered notification) (Mục [63.1.1](#page-40-0)). Điều này có nghĩa là một khi tiến trình đã nhận được thông báo rằng I/O là khả thi, nó nên thực hiện càng nhiều thao tác I/O (ví dụ: đọc càng nhiều byte càng tốt) càng tốt. Giả sử đang dùng mô tả tệp không chặn, điều này có nghĩa là thực thi một vòng lặp thực hiện các system call I/O cho đến khi một lời gọi thất bại với lỗi `EAGAIN` hoặc `EWOULDBLOCK`.

Trên Linux 2.4 trở về trước, signal-driven I/O có thể được áp dụng cho các mô tả tệp của socket, terminal, pseudoterminal và một số loại thiết bị nhất định khác. Linux 2.6 bổ sung cho phép sử dụng signal-driven I/O với pipe và FIFO. Kể từ Linux 2.6.25, signal-driven I/O cũng có thể được sử dụng với các mô tả tệp `inotify`.

Trong các trang tiếp theo, trước tiên chúng ta trình bày một ví dụ về việc sử dụng signal-driven I/O, sau đó giải thích chi tiết hơn một số bước nêu trên.

> Về mặt lịch sử, signal-driven I/O đôi khi được gọi là I/O bất đồng bộ (asynchronous I/O), và điều này được thể hiện qua tên gọi (`O_ASYNC`) của cờ trạng thái tệp mở liên quan. Tuy nhiên, ngày nay, thuật ngữ asynchronous I/O được dùng để chỉ loại chức năng được cung cấp bởi đặc tả POSIX AIO. Sử dụng POSIX AIO, một tiến trình yêu cầu kernel thực hiện một thao tác I/O, và kernel khởi tạo thao tác đó nhưng ngay lập tức trả quyền điều khiển về cho tiến trình gọi; tiến trình sau đó sẽ được thông báo khi thao tác I/O hoàn tất hoặc xảy ra lỗi.

> `O_ASYNC` được quy định trong POSIX.1g, nhưng không được đưa vào SUSv3 vì đặc tả về hành vi yêu cầu đối với cờ này bị cho là chưa đầy đủ.

> Một số bản cài đặt UNIX, đặc biệt là các bản cũ, không định nghĩa hằng số `O_ASYNC` để sử dụng với `fcntl()`. Thay vào đó, hằng số có tên là `FASYNC`, và glibc định nghĩa tên sau như một từ đồng nghĩa với `O_ASYNC`.

### Chương trình ví dụ

[Liệt kê 63-3](#page-59-0) cung cấp một ví dụ đơn giản về việc sử dụng signal-driven I/O. Chương trình này thực hiện các bước được mô tả ở trên để bật signal-driven I/O trên luồng đầu vào chuẩn (standard input), sau đó đưa terminal vào chế độ cbreak (Mục [62.6.3](#page-20-2)), để dữ liệu đầu vào khả thi từng ký tự một. Chương trình sau đó bước vào một vòng lặp vô hạn, thực hiện "công việc" tăng một biến, `cnt`, trong khi chờ đợi dữ liệu đầu vào khả thi. Bất cứ khi nào đầu vào khả thi, trình xử lý `SIGIO` sẽ đặt một cờ, `gotSigio`, được giám sát bởi chương trình chính. Khi chương trình chính thấy cờ này được bật, nó sẽ đọc tất cả các ký tự đầu vào khả thi và in chúng ra cùng với giá trị hiện tại của `cnt`. Nếu một ký tự thăng (`#`) được đọc từ đầu vào, chương trình sẽ chấm dứt.

Dưới đây là một ví dụ về những gì chúng ta thấy khi chạy chương trình này và gõ ký tự `x` một số lần, theo sau là ký tự thăng (`#`):

```
$ ./demo_sigio
cnt=37; read x
cnt=100; read x
cnt=159; read x
cnt=223; read x
cnt=288; read x
cnt=333; read #
```

**Liệt kê 63-3:** Sử dụng signal-driven I/O trên terminal

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/demo_sigio.c
## include <signal.h>
## include <ctype.h>
## include <fcntl.h>
## include <termios.h>
## include "tty_functions.h" /* Khai báo của ttySetCbreak() */
## include "tlpi_hdr.h"
static volatile sig_atomic_t gotSigio = 0;
 /* Đặt thành khác 0 khi nhận được SIGIO */
static void
sigioHandler(int sig)
{
 gotSigio = 1;
}
int
main(int argc, char *argv[])
{
 int flags, j, cnt;
 struct termios origTermios;
 char ch;
 struct sigaction sa;
 Boolean done;
```

```
 /* Thiết lập trình xử lý (handler) cho tín hiệu "I/O possible" */
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = SA_RESTART;
 sa.sa_handler = sigioHandler;
 if (sigaction(SIGIO, &sa, NULL) == -1)
 errExit("sigaction");
 /* Đặt tiến trình sở hữu (owner process) sẽ nhận tín hiệu "I/O possible" */
 if (fcntl(STDIN_FILENO, F_SETOWN, getpid()) == -1)
 errExit("fcntl(F_SETOWN)");
 /* Bật cơ chế phát tín hiệu "I/O possible" và chuyển I/O sang chế độ không chặn (nonblocking)
 cho file descriptor */
 flags = fcntl(STDIN_FILENO, F_GETFL);
 if (fcntl(STDIN_FILENO, F_SETFL, flags | O_ASYNC | O_NONBLOCK) == -1)
 errExit("fcntl(F_SETFL)");
 /* Đưa terminal về chế độ cbreak */
 if (ttySetCbreak(STDIN_FILENO, &origTermios) == -1)
 errExit("ttySetCbreak");
 for (done = FALSE, cnt = 0; !done ; cnt++) {
 for (j = 0; j < 100000000; j++)
 continue; /* Làm chậm vòng lặp chính lại một chút */
 if (gotSigio) { /* Dữ liệu đầu vào đã sẵn sàng chưa? */
 /* Đọc toàn bộ dữ liệu đầu vào có sẵn cho đến khi gặp lỗi (có thể là EAGAIN)
 hoặc EOF (thực tế không xảy ra ở chế độ cbreak) hoặc ký tự
 thăng (#) được đọc */
 while (read(STDIN_FILENO, &ch, 1) > 0 && !done) {
 printf("cnt=%d; read %c\n", cnt, ch);
 done = ch == '#';
 }
 gotSigio = 0;
 }
 }
 /* Khôi phục các thiết lập ban đầu của terminal */
 if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &origTermios) == -1)
 errExit("tcsetattr");
 exit(EXIT_SUCCESS);
}
––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/demo_sigio.c
```

### Thiết lập trình xử lý tín hiệu trước khi bật I/O điều khiển theo tín hiệu (Signal-driven I/O)

Vì hành vi mặc định của SIGIO là chấm dứt (terminate) tiến trình, chúng ta nên kích hoạt trình xử lý (handler) cho SIGIO trước khi bật tính năng I/O điều khiển theo tín hiệu (signal-driven I/O) trên một `file descriptor`. Nếu chúng ta bật signal-driven I/O trước khi thiết lập trình xử lý SIGIO, sẽ có một khoảng thời gian mà nếu I/O trở nên khả dụng, việc gửi tín hiệu SIGIO sẽ chấm dứt tiến trình.

Trên một số hệ thống UNIX, SIGIO bị bỏ qua theo mặc định.

### Thiết lập chủ sở hữu của file descriptor (File Descriptor Owner)

Chúng ta thiết lập chủ sở hữu của `file descriptor` bằng một thao tác `fcntl()` có dạng sau:

```
fcntl(fd, F_SETOWN, pid);
```

Chúng ta có thể chỉ định rằng một tiến trình đơn lẻ hoặc tất cả các tiến trình trong một nhóm tiến trình (process group) sẽ nhận được tín hiệu khi I/O khả dụng trên `file descriptor`. Nếu `pid` là số dương, nó được hiểu là ID tiến trình (Process ID). Nếu `pid` là số âm, giá trị tuyệt đối của nó chỉ định ID nhóm tiến trình (Process Group ID).

> Trên các hệ thống UNIX cũ hơn, một thao tác `ioctl()`—hoặc là `FIOSETOWN` hoặc `SIOCSPGRP`—được sử dụng để đạt được hiệu quả tương tự như `F_SETOWN`. Để tương thích, các thao tác `ioctl()` này cũng được hỗ trợ trên Linux.

Thông thường, `pid` được chỉ định là ID tiến trình của tiến trình gọi (để tín hiệu được gửi đến tiến trình đang mở `file descriptor`). Tuy nhiên, có thể chỉ định một tiến trình khác hoặc một nhóm tiến trình (ví dụ: nhóm tiến trình của tiến trình gọi), và các tín hiệu sẽ được gửi đến đích đó, tuân theo các kiểm tra quyền được mô tả trong Mục 20.5, trong đó tiến trình gửi được coi là tiến trình thực hiện lệnh `F_SETOWN`.

Thao tác `fcntl()` với cờ `F_GETOWN` trả về ID của tiến trình hoặc nhóm tiến trình sẽ nhận tín hiệu khi I/O khả dụng trên một `file descriptor` được chỉ định:

```
id = fcntl(fd, F_GETOWN);
if (id == -1)
 errExit("fcntl");
```

ID của nhóm tiến trình được trả về dưới dạng một số âm bởi lời gọi này.

Thao tác `ioctl()` tương ứng với `F_GETOWN` trên các hệ thống UNIX cũ là `FIOGETOWN` hoặc `SIOCGPGRP`. Cả hai thao tác `ioctl()` này cũng được cung cấp trên Linux.

Một hạn chế trong quy ước System Call được sử dụng trên một số kiến trúc Linux (đặc biệt là x86) có nghĩa là nếu một `file descriptor` thuộc sở hữu của một nhóm tiến trình có ID nhỏ hơn 4096, thì thay vì trả về ID đó dưới dạng kết quả hàm âm từ thao tác `fcntl()` `F_GETOWN`, glibc hiểu nhầm nó thành một lỗi System Call. Do đó, hàm bao (wrapper function) `fcntl()` trả về –1, và `errno` chứa ID nhóm tiến trình (dương). Đây là hệ quả của việc giao diện System Call của kernel biểu thị lỗi bằng cách trả về một giá trị `errno` âm làm kết quả hàm, và có một số ít trường hợp cần thiết phải phân biệt các kết quả đó với một lời gọi thành công trả về một giá trị âm hợp lệ. Để tạo sự phân biệt này, glibc hiểu các giá trị trả về của System Call trong khoảng từ –1 đến –4095 là biểu thị lỗi, sao chép giá trị (tuyệt đối) này vào `errno`, và trả về –1 làm kết quả hàm cho chương trình ứng dụng. Kỹ thuật này nhìn chung là đủ để xử lý một số ít routine dịch vụ System Call có thể trả về kết quả âm hợp lệ; thao tác `fcntl()` `F_GETOWN` là trường hợp thực tế duy nhất mà nó thất bại. Hạn chế này có nghĩa là một ứng dụng sử dụng các nhóm tiến trình để nhận tín hiệu "I/O possible" (điều này ít khi xảy ra) không thể sử dụng một cách đáng tin cậy `F_GETOWN` để tìm xem nhóm tiến trình nào sở hữu một `file descriptor`.

> Kể từ phiên bản glibc 2.11, hàm wrapper `fcntl()` đã khắc phục sự cố của `F_GETOWN` với các ID nhóm tiến trình nhỏ hơn 4096. Nó thực hiện điều này bằng cách triển khai `F_GETOWN` trong không gian người dùng (`User Space`) sử dụng thao tác `F_GETOWN_EX` (Mục [63.3.2\)](#page-63-0), được cung cấp từ Linux 2.6.32 trở lên.

### 63.3.1 Khi Nào "I/O Khả Thi" (I/O Possible) Được Báo Hiệu?

Bây giờ chúng ta sẽ xem xét chi tiết về thời điểm "I/O khả thi" được báo hiệu cho các loại file (file types) khác nhau.

### Terminal và pseudoterminal

Đối với terminal và pseudoterminal, một tín hiệu (signal) được tạo ra bất cứ khi nào có dữ liệu đầu vào (input) mới, ngay cả khi dữ liệu đầu vào trước đó chưa được đọc. "Input khả thi" cũng được báo hiệu nếu điều kiện kết thúc file (end-of-file) xảy ra trên terminal (nhưng không xảy ra trên pseudoterminal).

Không có báo hiệu "output khả thi" (output possible) đối với terminal. Việc ngắt kết nối terminal (terminal disconnect) cũng không được báo hiệu.

Bắt đầu từ phiên bản kernel 2.4.19, Linux cung cấp tính năng báo hiệu "output khả thi" cho phía slave của pseudoterminal. Tín hiệu này được tạo ra bất cứ khi nào dữ liệu đầu vào được tiêu thụ ở phía master của pseudoterminal.

### Pipe và FIFO

Đối với đầu đọc (read end) của một pipe hoặc FIFO, một tín hiệu được tạo ra trong các trường hợp sau:

- Dữ liệu được ghi vào pipe (ngay cả khi đã có dữ liệu đầu vào chưa đọc sẵn có).
- Đầu ghi (write end) của pipe bị đóng.

Đối với đầu ghi của một pipe hoặc FIFO, một tín hiệu được tạo ra trong các trường hợp sau:

- Thao tác đọc từ pipe làm tăng lượng không gian trống trong pipe sao cho hiện tại có thể ghi `PIPE_BUF` byte mà không bị chặn (blocking).
- Đầu đọc của pipe bị đóng.

### Socket

I/O điều khiển theo tín hiệu (Signal-driven I/O) hoạt động đối với datagram socket ở cả hai miền UNIX và Internet. Một tín hiệu được tạo ra trong các trường hợp sau:

- Một datagram đầu vào đến socket (ngay cả khi đã có sẵn các datagram chưa đọc đang chờ được đọc).
- Một lỗi bất đồng bộ (asynchronous error) xảy ra trên socket.

I/O điều khiển theo tín hiệu hoạt động đối với stream socket ở cả hai miền UNIX và Internet. Một tín hiệu được tạo ra trong các trường hợp sau:

- Một kết nối mới được tiếp nhận trên một listening socket.
- Một yêu cầu TCP `connect()` hoàn tất; nghĩa là, đầu chủ động (active end) của một kết nối TCP bước vào trạng thái `ESTABLISHED`, như được minh họa trong Hình 61-5 (trang 1272). Điều kiện tương tự không được báo hiệu đối với UNIX domain socket.
- Dữ liệu đầu vào mới được nhận trên socket (ngay cả khi đã có sẵn dữ liệu đầu vào chưa đọc).
- Đầu ngang hàng (peer) đóng nửa kết nối dùng để ghi của nó bằng hàm `shutdown()`, hoặc đóng hoàn toàn socket của nó bằng hàm `close()`.
- Output khả thi trên socket (ví dụ: không gian đã trống trong bộ đệm gửi (send buffer) của socket).
- Một lỗi bất đồng bộ xảy ra trên socket.

### inotify file descriptor

Một tín hiệu được tạo ra khi inotify file descriptor trở nên có thể đọc được (readable)—nghĩa là, khi một sự kiện xảy ra đối với một trong các file được giám sát bởi inotify file descriptor đó.

### 63.3.2 Tối ưu hóa việc sử dụng I/O hướng sự kiện tín hiệu (Signal-Driven I/O)

Trong các ứng dụng cần đồng thời giám sát một số lượng rất lớn (nghĩa là hàng nghìn) các mô tả tệp (file descriptor)—ví dụ, một số loại máy chủ mạng (network server) nhất định—I/O hướng sự kiện tín hiệu (signal-driven I/O) có thể mang lại những ưu thế đáng kể về hiệu năng so với `select()` và `poll()`. I/O hướng sự kiện tín hiệu mang lại hiệu suất vượt trội vì kernel "ghi nhớ" danh sách các mô tả tệp cần giám sát và chỉ phát tín hiệu (signal) cho chương trình khi các sự kiện I/O thực sự xảy ra trên những mô tả tệp đó. Kết quả là, hiệu năng của một chương trình sử dụng I/O hướng sự kiện tín hiệu tỉ lệ thuận với số lượng sự kiện I/O xảy ra, thay vì số lượng mô tả tệp đang được giám sát.

Để tận dụng triệt để I/O hướng sự kiện tín hiệu, chúng ta phải thực hiện hai bước:

- Sử dụng một thao tác `fcntl()` đặc trưng của Linux là `F_SETSIG`, để chỉ định một tín hiệu thời gian thực (realtime signal) sẽ được gửi thay vì `SIGIO` khi I/O khả dụng trên một mô tả tệp.
- Chỉ định cờ `SA_SIGINFO` khi sử dụng `sigaction()` để thiết lập hàm xử lý (handler) cho tín hiệu thời gian thực đã dùng ở bước trước (xem Mục 21.4).

Thao tác `fcntl()` với `F_SETSIG` chỉ định một tín hiệu thay thế sẽ được gửi đi thay cho `SIGIO` khi I/O khả dụng trên một mô tả tệp:

```c
if (fcntl(fd, F_SETSIG, sig) == -1)
 errExit("fcntl");
```

Thao tác `F_GETSIG` thực hiện chức năng ngược lại với `F_SETSIG`, truy xuất tín hiệu hiện đang được thiết lập cho một mô tả tệp:

```c
sig = fcntl(fd, F_GETSIG);
if (sig == -1)
 errExit("fcntl");
```

(Để lấy các định nghĩa của hằng số `F_SETSIG` và `F_GETSIG` từ `<fcntl.h>`, chúng ta phải định nghĩa macro kiểm tra tính năng `_GNU_SOURCE`.)

Việc sử dụng `F_SETSIG` để thay đổi tín hiệu dùng cho thông báo "I/O khả dụng" phục vụ hai mục đích, cả hai đều cần thiết nếu chúng ta đang giám sát số lượng lớn các sự kiện I/O trên nhiều mô tả tệp:

- Tín hiệu "I/O khả dụng" mặc định, `SIGIO`, là một trong các tín hiệu chuẩn không xếp hàng đợi (non-queuing signal). Nếu có nhiều sự kiện I/O được báo hiệu trong lúc `SIGIO` đang bị chặn (block)—có thể do hàm xử lý `SIGIO` đang được thực thi—tất cả các thông báo ngoại trừ thông báo đầu tiên sẽ bị mất. Nếu chúng ta dùng `F_SETSIG` để chỉ định một tín hiệu thời gian thực làm tín hiệu "I/O khả dụng", nhiều thông báo có thể được xếp hàng đợi (queue).
- Nếu hàm xử lý tín hiệu được thiết lập bằng lệnh gọi `sigaction()` trong đó cờ `SA_SIGINFO` được chỉ định trong trường `sa.sa_flags`, thì một cấu trúc `siginfo_t` sẽ được truyền làm đối số thứ hai cho hàm xử lý tín hiệu (Mục 21.4). Cấu trúc này chứa các trường xác định mô tả tệp nơi sự kiện xảy ra, cũng như loại sự kiện.

Lưu ý rằng việc sử dụng đồng thời cả `F_SETSIG` và `SA_SIGINFO` là bắt buộc để một cấu trúc `siginfo_t` hợp lệ được truyền đến hàm xử lý tín hiệu.

Nếu chúng ta thực hiện thao tác `F_SETSIG` với `sig` bằng 0, chúng ta sẽ quay trở lại hành vi mặc định: `SIGIO` được gửi đến và đối số `siginfo_t` không được cung cấp cho hàm xử lý.

Đối với sự kiện "I/O khả dụng", các trường quan tâm trong cấu trúc `siginfo_t` được truyền tới hàm xử lý tín hiệu bao gồm:

- `si_signo`: số hiệu của tín hiệu đã gây ra việc gọi hàm xử lý. Giá trị này giống với đối số đầu tiên của hàm xử lý tín hiệu.
- `si_fd`: mô tả tệp mà sự kiện I/O đã xảy ra.
- `si_code`: mã chỉ định loại sự kiện đã xảy ra. Các giá trị có thể xuất hiện trong trường này, kèm theo mô tả chung của chúng, được thể hiện trong [Bảng 63-7.](#page-64-0)
- `si_band`: mặt nạ bit (bit mask) chứa các bit giống như được trả về trong trường `revents` bởi lời gọi hệ thống (system call) `poll()`. Giá trị được thiết lập trong `si_code` có mối tương quan một-một với thiết lập mặt nạ bit trong `si_band`, như được hiển thị trong [Bảng 63-7](#page-64-0).

**Bảng 63-7:** Các giá trị `si_code` và `si_band` trong cấu trúc `siginfo_t` cho các sự kiện "I/O khả dụng"

| si_code  | si_band mask value                | Description                            |
|----------|-----------------------------------|----------------------------------------|
| POLL_IN  | POLLIN   POLLRDNORM               | Input available; end-of-file condition |
| POLL_OUT | POLLOUT   POLLWRNORM   POLLWRBAND | Output possible                        |
| POLL_MSG | POLLIN   POLLRDNORM   POLLMSG     | Input message available (unused)       |
| POLL_ERR | POLLERR                           | I/O error                              |
| POLL_PRI | POLLPRI   POLLRDNORM              | High-priority input available          |
| POLL_HUP | POLLHUP   POLLERR                 | Hangup occurred                        |

Trong một ứng dụng hoàn toàn hướng đầu vào (input-driven), chúng ta có thể tối ưu hóa hơn nữa việc sử dụng `F_SETSIG`. Thay vì giám sát các sự kiện I/O thông qua hàm xử lý tín hiệu, chúng ta có thể chặn (block) tín hiệu "I/O khả dụng" đã chỉ định, sau đó tiếp nhận các tín hiệu trong hàng đợi thông qua các lời gọi `sigwaitinfo()` hoặc `sigtimedwait()` (Mục 22.10). Các lời gọi hệ thống này trả về một cấu trúc `siginfo_t` chứa thông tin tương tự như thông tin được truyền tới hàm xử lý tín hiệu được thiết lập với `SA_SIGINFO`. Việc tiếp nhận các tín hiệu theo cách này đưa chúng ta trở lại mô hình xử lý sự kiện đồng bộ (synchronous model), nhưng với ưu điểm là chúng ta được thông báo hiệu quả hơn rất nhiều về các mô tả tệp nơi sự kiện I/O đã xảy ra so với khi sử dụng `select()` hoặc `poll()`.

### Xử lý tràn hàng đợi tín hiệu (signal-queue overflow)

Chúng ta đã thấy ở Mục 22.8 rằng có một giới hạn về số lượng tín hiệu thời gian thực (realtime signal) có thể được đưa vào hàng đợi (queue). Nếu đạt đến giới hạn này, kernel sẽ quay trở lại việc gửi tín hiệu mặc định `SIGIO` cho các thông báo "I/O khả dụng" (I/O possible). Điều này thông báo cho tiến trình (process) rằng hiện tượng tràn hàng đợi tín hiệu (signal-queue overflow) đã xảy ra. Khi điều này xảy ra, chúng ta sẽ mất thông tin về việc những file descriptor nào có sự kiện I/O, bởi vì `SIGIO` không được đưa vào hàng đợi. (Hơn nữa, trình xử lý `SIGIO` không nhận đối số `siginfo_t`, điều này có nghĩa là trình xử lý tín hiệu không thể xác định được file descriptor nào đã tạo ra tín hiệu.)

Chúng ta có thể giảm khả năng xảy ra tràn hàng đợi tín hiệu bằng cách tăng giới hạn số lượng tín hiệu thời gian thực có thể được đưa vào hàng đợi, như được mô tả ở Mục 22.8. Tuy nhiên, điều này không loại bỏ hoàn toàn nhu cầu phải xử lý khả năng xảy ra tràn. Một ứng dụng được thiết kế đúng đắn sử dụng `F_SETSIG` để thiết lập một tín hiệu thời gian thực làm cơ chế thông báo "I/O khả dụng" cũng phải thiết lập một trình xử lý cho `SIGIO`. Nếu `SIGIO` được gửi đến, ứng dụng có thể làm cạn kiệt (drain) hàng đợi tín hiệu thời gian thực bằng cách sử dụng `sigwaitinfo()` và tạm thời quay lại việc sử dụng `select()` hoặc `poll()` để lấy danh sách đầy đủ các file descriptor đang có sự kiện I/O chưa được xử lý.

### Sử dụng I/O hướng sự kiện tín hiệu (signal-driven I/O) với các ứng dụng đa luồng (multithreaded application)

Bắt đầu từ kernel 2.6.32, Linux cung cấp hai thao tác `fcntl()` mới, phi tiêu chuẩn, có thể được sử dụng để thiết lập đích đến cho các tín hiệu "I/O khả dụng": `F_SETOWN_EX` và `F_GETOWN_EX`.

Thao tác `F_SETOWN_EX` giống như `F_SETOWN`, nhưng bên cạnh việc cho phép chỉ định đích đến là một tiến trình (process) hoặc nhóm tiến trình (process group), nó còn cho phép chỉ định một luồng (thread) làm đích cho các tín hiệu "I/O khả dụng". Đối với thao tác này, đối số thứ ba của `fcntl()` là một con trỏ trỏ đến một cấu trúc có dạng sau:

```c
struct f_owner_ex {
 int type;
 pid_t pid;
};
```

Trường `type` xác định ý nghĩa của trường `pid`, và nhận một trong các giá trị sau:

### `F_OWNER_PGRP`

Trường `pid` chỉ định ID của một nhóm tiến trình (process group) sẽ là đích đến của các tín hiệu "I/O khả dụng". Khác với `F_SETOWN`, ID nhóm tiến trình được chỉ định dưới dạng một giá trị dương.

### `F_OWNER_PID`

Trường `pid` chỉ định ID của một tiến trình sẽ là đích đến của các tín hiệu "I/O khả dụng".

### `F_OWNER_TID`

Trường `pid` chỉ định ID của một luồng (thread) sẽ là đích đến của các tín hiệu "I/O khả dụng". ID được chỉ định trong `pid` là giá trị do `clone()` hoặc `gettid()` trả về.

Thao tác `F_GETOWN_EX` là phần ngược lại của thao tác `F_SETOWN_EX`. Nó sử dụng cấu trúc `f_owner_ex` mà con trỏ ở đối số thứ ba của `fcntl()` trỏ tới để trả về các thiết lập được định nghĩa bởi một thao tác `F_SETOWN_EX` trước đó.

> [!NOTE]
> Do các thao tác `F_SETOWN_EX` và `F_GETOWN_EX` biểu diễn các ID nhóm tiến trình dưới dạng giá trị dương, `F_GETOWN_EX` không gặp phải vấn đề đã được mô tả trước đó đối với `F_GETOWN` khi sử dụng các ID nhóm tiến trình nhỏ hơn 4096.

## 63.4 Giao diện lập trình epoll

Giống như các System Call (system call) đa kênh I/O (I/O multiplexing) và I/O hướng sự kiện tín hiệu (signal-driven I/O), giao diện lập trình (API) `epoll` (event poll) trên Linux được sử dụng để giám sát nhiều File Descriptor (file descriptor) nhằm kiểm tra xem chúng đã sẵn sàng cho các hoạt động I/O hay chưa. Các ưu điểm chính của `epoll` bao gồm:

- Hiệu năng của `epoll` có khả năng mở rộng (scale) tốt hơn rất nhiều so với `select()` và `poll()` khi giám sát số lượng lớn File Descriptor.
- Giao diện `epoll` cho phép thông báo theo cơ chế kích hoạt theo mức (level-triggered) hoặc kích hoạt theo sườn (edge-triggered). Ngược lại, `select()` và `poll()` chỉ cung cấp thông báo theo mức, trong khi I/O hướng sự kiện tín hiệu chỉ cung cấp thông báo theo sườn.

Hiệu năng của `epoll` và I/O hướng sự kiện tín hiệu là tương đương nhau. Tuy nhiên, `epoll` có một số ưu điểm vượt trội hơn so với I/O hướng sự kiện tín hiệu:

- Tránh được sự phức tạp trong việc xử lý tín hiệu (signal handling) (ví dụ: tràn hàng đợi tín hiệu - signal-queue overflow).
- Có sự linh hoạt cao hơn trong việc chỉ định loại giám sát mà chúng ta muốn thực hiện (ví dụ: kiểm tra xem một File Descriptor của Socket (socket) đã sẵn sàng để đọc, ghi, hoặc cả hai).

Giao diện `epoll` là đặc thù của hệ điều hành Linux và xuất hiện lần đầu từ phiên bản Linux 2.6.

Cấu trúc dữ liệu (data structure) cốt lõi của `epoll` là một thể hiện `epoll` (epoll instance), được tham chiếu thông qua một File Descriptor đang mở. File Descriptor này không được sử dụng cho các hoạt động I/O trực tiếp. Thay vào đó, nó đóng vai trò là một định danh (handle) cho các cấu trúc dữ liệu trong Kernel Space (không gian nhân) phục vụ hai mục đích:

- Ghi lại danh sách các File Descriptor mà tiến trình (process) này đã đăng ký quan tâm giám sát — gọi là danh sách quan tâm (interest list); và
- Duy trì danh sách các File Descriptor đã sẵn sàng cho I/O — gọi là danh sách sẵn sàng (ready list).

Các phần tử trong danh sách sẵn sàng là một tập hợp con của danh sách quan tâm.

Đối với mỗi File Descriptor được giám sát bởi `epoll`, chúng ta có thể chỉ định một mặt nạ bit (bit mask) biểu thị các sự kiện mà chúng ta muốn theo dõi. Các mặt nạ bit này tương ứng chặt chẽ với các mặt nạ bit được sử dụng trong `poll()`.

Giao diện `epoll` bao gồm ba System Call:

- System Call `epoll_create()` tạo ra một thể hiện `epoll` và trả về một File Descriptor tham chiếu đến thể hiện đó.
- System Call `epoll_ctl()` thao tác với danh sách quan tâm liên kết với một thể hiện `epoll`. Bằng cách sử dụng `epoll_ctl()`, chúng ta có thể thêm một File Descriptor mới vào danh sách, xóa một Descriptor hiện có khỏi danh sách, và sửa đổi mặt nạ xác định các sự kiện cần giám sát đối với một Descriptor.
- System Call `epoll_wait()` trả về các mục từ danh sách sẵn sàng liên kết với một thể hiện `epoll`.

### 63.4.1 Tạo một thể hiện epoll: epoll\_create()

System Call `epoll_create()` tạo một thể hiện `epoll` mới với danh sách quan tâm ban đầu ở trạng thái rỗng.

```c
## include <sys/epoll.h>
int epoll_create(int size);
                                Trả về file descriptor nếu thành công, hoặc –1 nếu lỗi
```

Tham số `size` chỉ định số lượng File Descriptor mà chúng ta dự kiến sẽ giám sát thông qua thể hiện `epoll` này. Tham số này không phải là giới hạn trên, mà đúng hơn là một gợi ý (hint) cho kernel về cách phân bổ kích thước ban đầu cho các cấu trúc dữ liệu nội bộ. (Kể từ Linux 2.6.8, tham số `size` bị bỏ qua, bởi vì các thay đổi trong cài đặt đồng nghĩa với việc thông tin mà nó cung cấp không còn cần thiết nữa).

Là kết quả trả về của hàm, `epoll_create()` trả về một File Descriptor tham chiếu đến thể hiện `epoll` mới. File Descriptor này được sử dụng để trỏ tới thể hiện `epoll` trong các System Call `epoll` khác. Khi File Descriptor không còn cần thiết nữa, nó nên được đóng theo cách thông thường bằng hàm `close()`. Khi tất cả các File Descriptor tham chiếu đến một thể hiện `epoll` bị đóng, thể hiện đó sẽ bị hủy và các tài nguyên liên quan sẽ được giải phóng trả về cho hệ thống. (Nhiều File Descriptor có thể cùng trỏ tới một thể hiện `epoll` do hệ quả của các lời gọi `fork()` hoặc nhân bản Descriptor bằng `dup()` hoặc các hàm tương tự).

> Bắt đầu từ phiên bản Kernel 2.6.27, Linux hỗ trợ một System Call mới là `epoll_create1()`. System Call này thực hiện tác vụ giống như `epoll_create()`, nhưng loại bỏ tham số `size` đã lỗi thời và bổ sung thêm tham số `flags` có thể được sử dụng để thay đổi hành vi của System Call. Hiện tại có một cờ (flag) được hỗ trợ: `EPOLL_CLOEXEC`, khiến kernel bật cờ đóng khi thực thi (`FD_CLOEXEC`) cho File Descriptor mới. Cờ này hữu ích vì những lý do tương tự như cờ `O_CLOEXEC` của hàm `open()` được mô tả tại Mục 4.3.1.

### 63.4.2 Sửa đổi Danh sách Quan tâm của epoll: epoll_ctl()

System Call (lời gọi hệ thống) `epoll_ctl()` dùng để sửa đổi danh sách quan tâm (interest list) của đối tượng (instance) `epoll` được trỏ đến bởi File Descriptor (mô tả tệp) `epfd`.

```
## include <sys/epoll.h>
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *ev);
                                             Trả về 0 khi thành công, hoặc –1 nếu có lỗi
```

Đối số `fd` xác định File Descriptor nào trong danh sách quan tâm sẽ bị thay đổi thiết lập. Đối số này có thể là một File Descriptor cho pipe (đường ống), FIFO, socket, hàng đợi thông điệp POSIX (POSIX message queue), đối tượng `inotify`, thiết bị đầu cuối (terminal), thiết bị, hoặc thậm chí là một bộ mô tả `epoll` khác (nghĩa là chúng ta có thể xây dựng một dạng phân cấp các bộ mô tả được giám sát). Tuy nhiên, `fd` không thể là File Descriptor cho một tệp thông thường (regular file) hoặc thư mục (sẽ trả về lỗi `EPERM`).

Đối số `op` chỉ định thao tác cần thực hiện và nhận một trong các giá trị sau:

```
EPOLL_CTL_ADD
```

Thêm File Descriptor `fd` vào danh sách quan tâm cho `epfd`. Tập hợp các sự kiện mà chúng ta quan tâm muốn giám sát đối với `fd` được chỉ định trong bộ đệm do `ev` trỏ tới, như được mô tả bên dưới. Nếu chúng ta cố gắng thêm một File Descriptor đã có sẵn trong danh sách quan tâm, `epoll_ctl()` sẽ thất bại và trả về lỗi `EEXIST`.

```
EPOLL_CTL_MOD
```

Sửa đổi thiết lập sự kiện cho File Descriptor `fd`, sử dụng thông tin được chỉ định trong bộ đệm do `ev` trỏ tới. Nếu chúng ta cố gắng sửa đổi cài đặt của một File Descriptor không nằm trong danh sách quan tâm của `epfd`, `epoll_ctl()` sẽ thất bại và trả về lỗi `ENOENT`.

```
EPOLL_CTL_DEL
```

Xóa File Descriptor `fd` khỏi danh sách quan tâm của `epfd`. Đối số `ev` sẽ bị bỏ qua đối với thao tác này. Nếu chúng ta cố gắng xóa một File Descriptor không có trong danh sách quan tâm của `epfd`, `epoll_ctl()` sẽ thất bại và trả về lỗi `ENOENT`. Việc đóng (closing) một File Descriptor sẽ tự động xóa nó khỏi tất cả các danh sách quan tâm `epoll` mà nó là thành viên.

Đối số `ev` là con trỏ trỏ tới một cấu trúc (structure) kiểu `epoll_event`, được định nghĩa như sau:

```
struct epoll_event {
 uint32_t events; /* Các sự kiện epoll (mặt nạ bit) */
 epoll_data_t data; /* Dữ liệu người dùng */
};
```

Trường `data` của cấu trúc `epoll_event` được định kiểu như sau:

```
typedef union epoll_data {
 void *ptr; /* Con trỏ tới dữ liệu do người dùng định nghĩa */
 int fd; /* File descriptor */
 uint32_t u32; /* Số nguyên 32-bit */
 uint64_t u64; /* Số nguyên 64-bit */
} epoll_data_t;
```

Đối số `ev` chỉ định các thiết lập cho File Descriptor `fd` như sau:

- Trường con `events` là một mặt nạ bit (bit mask) chỉ định tập hợp các sự kiện mà chúng ta quan tâm muốn giám sát đối với `fd`. Chúng ta sẽ thảo luận chi tiết hơn về các giá trị bit có thể được sử dụng trong trường này ở phần tiếp theo.
- Trường con `data` là một khối union, trong đó một trong các thành viên có thể được sử dụng để chỉ định thông tin được truyền ngược lại cho Process (tiến trình) gọi (thông qua `epoll_wait()`) nếu `fd` sau đó chuyển sang trạng thái sẵn sàng (ready).

[Liệt kê 63-4](#page-69-0) minh họa một ví dụ về việc sử dụng `epoll_create()` và `epoll_ctl()`.

### **Liệt kê 63-4:** Sử dụng epoll_create() và epoll_ctl()

```
 int epfd;
 struct epoll_event ev;
 epfd = epoll_create(5);
 if (epfd == -1)
 errExit("epoll_create");
 ev.data.fd = fd;
 ev.events = EPOLLIN;
 if (epoll_ctl(epfd, EPOLL_CTL_ADD, fd, ev) == -1)
 errExit("epoll_ctl");
```

### Giới hạn max\_user\_watches

Vì mỗi File Descriptor (mô tả tệp) được đăng ký trong danh sách quan tâm (interest list) của epoll yêu cầu một lượng nhỏ bộ nhớ nhân (kernel memory) không thể hoán đổi (nonswappable), nhân hệ điều hành cung cấp một giao diện xác định giới hạn về tổng số File Descriptor mà mỗi người dùng có thể đăng ký trong tất cả các danh sách quan tâm của epoll. Giá trị của giới hạn này có thể được xem và sửa đổi thông qua `max\_user\_watches`, một tệp đặc trưng của Linux nằm trong thư mục `/proc/sys/fs/epoll`. Giá trị mặc định của giới hạn này được tính toán dựa trên bộ nhớ hệ thống khả dụng (xem trang hướng dẫn thủ công `epoll(7)`).

### 63.4.3 Chờ sự kiện: epoll\_wait()

System Call (lời gọi hệ thống) `epoll_wait()` trả về thông tin về các File Descriptor đã sẵn sàng từ epoll instance (thể hiện epoll) được tham chiếu bởi File Descriptor `epfd`. Một lời gọi `epoll_wait()` đơn lẻ có thể trả về thông tin cho nhiều File Descriptor sẵn sàng cùng lúc.

```
## include <sys/epoll.h>
int epoll_wait(int epfd, struct epoll_event *evlist, int maxevents, int timeout);
          Trả về số lượng File Descriptor sẵn sàng, 0 nếu hết thời gian chờ (timeout), hoặc –1 nếu có lỗi
```

Thông tin về các File Descriptor sẵn sàng được trả về trong mảng các cấu trúc `epoll_event` được trỏ tới bởi `evlist`. (Cấu trúc `epoll_event` đã được mô tả ở phần trước). Mảng `evlist` được cấp phát bởi tiến trình gọi, và số lượng phần tử mà nó chứa được chỉ định trong `maxevents`.

Mỗi mục trong mảng `evlist` trả về thông tin về một File Descriptor sẵn sàng duy nhất. Trường con `events` trả về một mặt nạ (mask) các sự kiện đã xảy ra trên Descriptor này. Trường con `data` trả về bất kỳ giá trị nào được chỉ định trong `ev.data` khi chúng ta đăng ký quan tâm đến File Descriptor này bằng cách sử dụng `epoll_ctl()`. Lưu ý rằng trường `data` cung cấp cơ chế duy nhất để tìm ra số hiệu của File Descriptor được liên kết với sự kiện này. Do đó, khi chúng ta thực hiện lời gọi `epoll_ctl()` để đưa một File Descriptor vào danh sách quan tâm, chúng ta nên đặt `ev.data.fd` thành số hiệu File Descriptor (như minh họa trong [Danh sách 63-4](#page-69-0)) hoặc đặt `ev.data.ptr` trỏ tới một cấu trúc chứa số hiệu File Descriptor đó.

Đối số `timeout` xác định hành vi chặn (blocking behavior) của `epoll_wait()`, cụ thể như sau:

- Nếu `timeout` bằng –1, tiến trình sẽ chặn (block) cho đến khi một sự kiện xảy ra đối với một trong các File Descriptor trong danh sách quan tâm của `epfd` hoặc cho đến khi một tín hiệu (signal) bị bắt.
- Nếu `timeout` bằng 0, thực hiện kiểm tra không chặn (nonblocking check) để xem sự kiện nào hiện đang khả dụng trên các File Descriptor trong danh sách quan tâm của `epfd`.
- Nếu `timeout` lớn hơn 0, chặn tối đa trong khoảng thời gian `timeout` tính bằng mili-giây, cho đến khi một sự kiện xảy ra trên một trong các File Descriptor trong danh sách quan tâm của `epfd`, hoặc cho đến khi một tín hiệu bị bắt.

Khi thành công, `epoll_wait()` trả về số lượng mục đã được đặt vào mảng `evlist`, hoặc 0 nếu không có File Descriptor nào sẵn sàng trong khoảng thời gian được chỉ định bởi `timeout`. Khi xảy ra lỗi, `epoll_wait()` trả về –1, với `errno` được thiết lập để chỉ rõ lỗi đó.

Trong một chương trình đa luồng (multithreaded program), một luồng hoàn toàn có thể sử dụng `epoll_ctl()` để thêm các File Descriptor vào danh sách quan tâm của một epoll instance đang được giám sát bởi `epoll_wait()` ở một luồng khác. Những thay đổi đối với danh sách quan tâm này sẽ được ghi nhận ngay lập tức, và lời gọi `epoll_wait()` sẽ trả về thông tin trạng thái sẵn sàng về các File Descriptor vừa được thêm vào.

### Các sự kiện epoll (epoll events)

Các giá trị bit có thể được chỉ định trong `ev.events` khi chúng ta gọi `epoll_ctl()` và được đặt vào các trường `evlist[].events` do `epoll_wait()` trả về được hiển thị trong Bảng 63-8. Với việc bổ sung thêm tiền tố `E`, hầu hết các bit này có tên giống với các bit sự kiện tương ứng được sử dụng với `poll()`. (Ngoại lệ là `EPOLLET` và `EPOLLONESHOT`, mà chúng ta sẽ mô tả chi tiết hơn bên dưới). Lý do của sự tương ứng này là khi được chỉ định làm đầu vào cho `epoll_ctl()` hoặc được trả về làm đầu ra thông qua `epoll_wait()`, các bit này truyền tải ý nghĩa hoàn toàn giống với các bit sự kiện `poll()` tương ứng.

**Bảng 63-8:** Các giá trị mặt nạ bit cho trường sự kiện epoll

| Bit          | Đầu vào cho<br>epoll_ctl()? | Do epoll_wait()<br>trả về? | Mô tả                                          |
|--------------|-----------------------------|----------------------------|------------------------------------------------|
| EPOLLIN      | •                           | •                          | Dữ liệu không phải dữ liệu ưu tiên cao có thể đọc |
| EPOLLPRI     | •                           | •                          | Dữ liệu ưu tiên cao có thể đọc                 |
| EPOLLRDHUP   | •                           | •                          | Ngắt kết nối (shutdown) trên socket đối tác (từ Linux 2.6.17) |
| EPOLLOUT     | •                           | •                          | Dữ liệu thông thường có thể ghi                |
| EPOLLET      | •                           |                            | Sử dụng cơ chế thông báo sự kiện theo sườn (edge-triggered event notification) |

| EPOLLONESHOT | •                        |                              | Vô hiệu hóa việc giám sát sau khi có thông báo sự kiện (event notification) |
| EPOLLERR     |                          | •                            | Đã xảy ra lỗi                                              |
| EPOLLHUP     |                          | •                            | Đã xảy ra sự cố ngắt kết nối (hangup)                       |

### Cờ EPOLLONESHOT

Theo mặc định, một khi File Descriptor (file descriptor) đã được thêm vào danh sách quan tâm (interest list) của epoll bằng thao tác `epoll_ctl()` với `EPOLL_CTL_ADD`, nó vẫn giữ trạng thái hoạt động (tức là các lời gọi tiếp theo tới `epoll_wait()` sẽ thông báo cho chúng ta bất cứ khi nào file descriptor sẵn sàng) cho đến khi chúng ta chủ động xóa nó khỏi danh sách bằng thao tác `epoll_ctl()` với `EPOLL_CTL_DEL`. Nếu chúng ta muốn chỉ nhận thông báo một lần duy nhất về một file descriptor cụ thể nào đó, chúng ta có thể chỉ định cờ `EPOLLONESHOT` (có sẵn từ Linux 2.6.2) trong giá trị `ev.events` được truyền vào `epoll_ctl()`. Nếu cờ này được chỉ định, thì sau lời gọi `epoll_wait()` tiếp theo thông báo rằng file descriptor tương ứng đã sẵn sàng, file descriptor đó sẽ được đánh dấu là không hoạt động (inactive) trong danh sách quan tâm và chúng ta sẽ không nhận được thông báo về trạng thái của nó từ các lời gọi `epoll_wait()` trong tương lai. Nếu muốn, sau đó chúng ta có thể bật lại (reenable) việc giám sát file descriptor này bằng thao tác `epoll_ctl()` với `EPOLL_CTL_MOD`. (Chúng ta không thể sử dụng thao tác `EPOLL_CTL_ADD` cho mục đích này, bởi vì file descriptor đang ở trạng thái không hoạt động vẫn là một phần của danh sách quan tâm epoll.)

### Chương trình ví dụ

[Liệt kê 63-5](#page-73-0) minh họa cách sử dụng epoll API. Là các tham số dòng lệnh (command-line arguments), chương trình này mong đợi đường dẫn (pathnames) của một hoặc nhiều thiết bị terminal hoặc FIFO. Chương trình thực hiện các bước sau:

- Tạo một epoll instance `q`.
- Mở từng file có tên trên dòng lệnh để nhận đầu vào `w` và thêm file descriptor kết quả vào danh sách quan tâm của epoll instance `e`, chỉ định tập hợp các sự kiện cần giám sát là `EPOLLIN`.
- Thực thi một vòng lặp `r` gọi `epoll_wait()` `t` để giám sát danh sách quan tâm của epoll instance và xử lý các sự kiện được trả về từ mỗi lời gọi. Lưu ý các điểm sau về vòng lặp này:
  - Sau lời gọi `epoll_wait()`, chương trình kiểm tra giá trị trả về `EINTR` `y`, hiện tượng này có thể xảy ra nếu chương trình bị dừng bởi một tín hiệu (signal) ở giữa lời gọi `epoll_wait()` và sau đó được tiếp tục bởi `SIGCONT`. (Tham khảo Mục 21.5.) Nếu điều này xảy ra, chương trình sẽ khởi động lại lời gọi `epoll_wait()`.
  - Nếu lời gọi `epoll_wait()` thành công, chương trình sử dụng một vòng lặp tiếp theo để kiểm tra từng mục sẵn sàng trong `evlist` `u`. Đối với mỗi mục trong `evlist`, chương trình kiểm tra trường `events` xem có sự hiện diện không chỉ của `EPOLLIN` `i`, mà cả `EPOLLHUP` và `EPOLLERR` `o` hay không. Các sự kiện sau có thể xảy ra nếu đầu kia của FIFO bị đóng hoặc xảy ra sự cố ngắt kết nối terminal. Nếu `EPOLLIN` được trả về, chương trình sẽ đọc một số dữ liệu đầu vào từ file descriptor tương ứng và hiển thị nó ra thiết bị chuẩn đầu ra (standard output). Ngược lại, nếu `EPOLLHUP` hoặc `EPOLLERR` xảy ra, chương trình sẽ đóng file descriptor tương ứng `a` và giảm bộ đếm các file đang mở (`numOpenFds`).
  - Vòng lặp kết thúc khi tất cả các file descriptor đang mở đã bị đóng (tức là khi `numOpenFds` bằng 0).

Các nhật ký phiên shell sau đây minh họa việc sử dụng chương trình trong [Liệt kê 63-5.](#page-73-0) Chúng ta sử dụng hai cửa sổ terminal. Trong một cửa sổ, chúng ta sử dụng chương trình trong [Liệt kê 63-5](#page-73-0) để giám sát hai FIFO cho dữ liệu đầu vào. (Mỗi lần mở FIFO để đọc bởi chương trình này sẽ chỉ hoàn tất sau khi một tiến trình khác đã mở FIFO để ghi, như được mô tả trong Mục 44.7.) Trong cửa sổ kia, chúng ta chạy các instance của `cat(1)` để ghi dữ liệu vào các FIFO này.

```
Terminal window 1 Terminal window 2
$ mkfifo p q
$ ./epoll_input p q
 $ cat > p
Opened "p" on fd 4
 Type Control-Z to suspend cat
 [1]+ Stopped cat >p
 $ cat > q
Opened "q" on fd 5
About to epoll_wait()
Type Control-Z to suspend the epoll_input program
[1]+ Stopped ./epoll_input p q
```

Ở trên, chúng ta đã tạm dừng chương trình giám sát của mình để giờ đây chúng ta có thể tạo dữ liệu đầu vào trên cả hai FIFO và đóng đầu ghi của một trong số chúng:

```
 qqq
            Type Control-D to terminate "cat > q"
 $ fg %1
 cat >p
 ppp
```

Bây giờ chúng ta tiếp tục chương trình giám sát của mình bằng cách đưa nó lên chạy ở foreground (tiền cảnh), tại thời điểm đó `epoll_wait()` trả về hai sự kiện:

```
$ fg
./epoll_input p q
About to epoll_wait()
Ready: 2
 fd=4; events: EPOLLIN
 read 4 bytes: ppp
 fd=5; events: EPOLLIN EPOLLHUP
 read 4 bytes: qqq
 closing fd 5
About to epoll_wait()
```

Hai dòng trống trong kết quả đầu ra ở trên là các ký tự xuống dòng (newlines) được đọc bởi các instance của cat, được ghi vào các FIFO, sau đó được đọc và lặp lại (echoed) bởi chương trình giám sát của chúng ta.

Bây giờ chúng ta gõ Control-D ở cửa sổ terminal thứ hai để chấm dứt instance còn lại của cat, việc này khiến `epoll_wait()` một lần nữa trả về kết quả, lần này chỉ với một sự kiện duy nhất:

```
 Nhấn Control-D để kết thúc "cat >p"
Ready: 1
 fd=4; events: EPOLLHUP
 đang đóng fd 4
Tất cả các file descriptor đã được đóng; tạm biệt
```

```
––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/epoll_input.c
## include <sys/epoll.h>
## include <fcntl.h>
## include "tlpi_hdr.h"
## define MAX_BUF 1000 /* Số byte tối đa được lấy bởi một lời gọi read() đơn lẻ */
## define MAX_EVENTS 5 /* Số lượng sự kiện tối đa được trả về từ
   một lời gọi epoll_wait() đơn lẻ */
  int
  main(int argc, char *argv[])
  {
   int epfd, ready, fd, s, j, numOpenFds;
   struct epoll_event ev;
   struct epoll_event evlist[MAX_EVENTS];
   char buf[MAX_BUF];
   if (argc < 2 || strcmp(argv[1], "--help") == 0)
   usageErr("%s file...\n", argv[0]);
q epfd = epoll_create(argc - 1);
   if (epfd == -1)
   errExit("epoll_create");
   /* Mở từng file trên dòng lệnh, và thêm nó vào "interest list"
   cho instance epoll */
w for (j = 1; j < argc; j++) {
   fd = open(argv[j], O_RDONLY);
   if (fd == -1)
   errExit("open");
   printf("Opened \"%s\" on fd %d\n", argv[j], fd);
   ev.events = EPOLLIN; /* Chỉ quan tâm đến các sự kiện đầu vào */
   ev.data.fd = fd;
e if (epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &ev) == -1)
   errExit("epoll_ctl");
   }
   numOpenFds = argc - 1;
r while (numOpenFds > 0) {
   /* Lấy tối đa MAX_EVENTS mục từ danh sách sẵn sàng (ready list) */
   printf("About to epoll_wait()\n");
t ready = epoll_wait(epfd, evlist, MAX_EVENTS, -1);
   if (ready == -1) {
y if (errno == EINTR)
   continue; /* Khởi động lại nếu bị ngắt bởi tín hiệu (signal) */
   else
   errExit("epoll_wait");
   }
```

```
 printf("Ready: %d\n", ready);
   /* Xử lý danh sách các sự kiện được trả về */
u for (j = 0; j < ready; j++) {
   printf(" fd=%d; events: %s%s%s\n", evlist[j].data.fd,
   (evlist[j].events & EPOLLIN) ? "EPOLLIN " : "",
   (evlist[j].events & EPOLLHUP) ? "EPOLLHUP " : "",
   (evlist[j].events & EPOLLERR) ? "EPOLLERR " : "");
i if (evlist[j].events & EPOLLIN) {
   s = read(evlist[j].data.fd, buf, MAX_BUF);
   if (s == -1)
   errExit("read");
   printf(" read %d bytes: %.*s\n", s, s, buf);
o } else if (evlist[j].events & (EPOLLHUP | EPOLLERR)) {
   /* Nếu cả EPOLLIN và EPOLLHUP đều được thiết lập, thì có thể
   có nhiều hơn MAX_BUF byte cần đọc. Do đó, chúng ta đóng
   file descriptor chỉ khi EPOLLIN không được thiết lập.
   Chúng ta sẽ đọc các byte tiếp theo sau lời gọi epoll_wait() kế tiếp. */
   printf(" closing fd %d\n", evlist[j].data.fd);
a if (close(evlist[j].data.fd) == -1)
   errExit("close");
   numOpenFds--;
   }
   }
   }
   printf("All file descriptors closed; bye\n");
   exit(EXIT_SUCCESS);
  }
  ––––––––––––––––––––––––––––––––––––––––––––––––––––––– altio/epoll_input.c
```

### 63.4.4 Tìm hiểu kỹ hơn về Ngữ nghĩa của epoll

Bây giờ chúng ta sẽ xem xét một số điểm tinh tế trong sự tương tác giữa các tệp mở (open files), File Descriptor (mô tả tệp), và epoll. Để phục vụ cho phần thảo luận này, bạn nên xem lại Hình 5-2 (trang 95), trong đó minh họa mối quan hệ giữa các File Descriptor, Open File Description (mô tả tệp mở), và bảng i-node tệp trên toàn hệ thống (system-wide file i-node table).

Khi chúng ta tạo một instance (thể hiện) epoll bằng cách sử dụng `epoll_create()`, kernel sẽ tạo một i-node trong bộ nhớ (in-memory i-node) và Open File Description mới, đồng thời cấp phát một File Descriptor mới trong process (tiến trình) gọi đến tham chiếu tới Open File Description đó. Interest list (danh sách quan tâm) của một instance epoll được liên kết với Open File Description, chứ không phải với File Descriptor của epoll. Điều này dẫn đến các hệ quả sau:

Nếu chúng ta nhân bản (duplicate) một File Descriptor của epoll bằng cách sử dụng `dup()` (hoặc tương tự), thì Descriptor được nhân bản sẽ tham chiếu đến cùng Interest list và Ready list (danh sách sẵn sàng) của epoll giống như Descriptor gốc. Chúng ta có thể sửa đổi Interest list bằng cách chỉ định bất kỳ File Descriptor nào

- làm đối số `epfd` trong lời gọi hàm `epoll_ctl()`. Tương tự, chúng ta có thể lấy các mục từ Ready list bằng cách chỉ định một trong hai File Descriptor làm đối số `epfd` trong lời gọi `epoll_wait()`.
- Điểm nêu trên cũng áp dụng sau một lời gọi `fork()`. Process con kế thừa một bản sao (duplicate) của File Descriptor epoll từ process cha, và Descriptor được nhân bản này tham chiếu đến cùng cấu trúc dữ liệu epoll.

Khi chúng ta thực hiện thao tác `epoll_ctl()` với `EPOLL_CTL_ADD`, kernel sẽ thêm một mục vào Interest list của epoll, ghi lại cả số hiệu của File Descriptor được giám sát lẫn tham chiếu đến Open File Description tương ứng. Đối với các lời gọi `epoll_wait()`, kernel sẽ giám sát Open File Description. Điều này có nghĩa là chúng ta phải làm rõ lại phát biểu trước đây của mình rằng khi một File Descriptor bị đóng (closed), nó sẽ tự động bị xóa khỏi bất kỳ Interest list nào của epoll mà nó là thành viên. Sự làm rõ ở đây là: một Open File Description sẽ bị xóa khỏi Interest list của epoll ngay khi tất cả các File Descriptor tham chiếu đến nó đều đã bị đóng. Điều nghĩa là nếu chúng ta tạo các Descriptor được nhân bản tham chiếu đến một tệp mở—bằng cách sử dụng `dup()` (hoặc tương tự) hoặc `fork()`—thì tệp mở đó sẽ chỉ bị xóa sau khi Descriptor gốc và tất cả các bản sao đã bị đóng.

Những ngữ nghĩa này có thể dẫn đến một số hành vi thoạt đầu có vẻ đáng ngạc nhiên. Giả sử rằng chúng ta thực thi mã nguồn được hiển thị trong [Liệt kê 63-6.](#page-75-0) Lời gọi `epoll_wait()` trong đoạn mã này sẽ cho chúng ta biết rằng File Descriptor `fd1` đã sẵn sàng (nói cách khác, `evlist[0].data.fd` sẽ bằng `fd1`), mặc dù `fd1` đã bị đóng. Điều này xảy ra là do vẫn còn một File Descriptor đang mở là `fd2`, tham chiếu đến Open File Description nằm trong Interest list của epoll. Một kịch bản tương tự cũng xảy ra khi hai process cùng giữ các Descriptor được nhân bản cho cùng một Open File Description (thường là kết quả của lệnh `fork()`), và process thực hiện `epoll_wait()` đã đóng File Descriptor của chính nó, nhưng process kia vẫn giữ Descriptor được nhân bản đó ở trạng thái mở.

**Liệt kê 63-6:** Ngữ nghĩa của epoll với các File Descriptor được nhân bản

```
 int epfd, fd1, fd2;
 struct epoll_event ev;
 struct epoll_event evlist[MAX_EVENTS];
 /* Đã lược bỏ: mã nguồn mở 'fd1' và tạo File Descriptor epoll 'epfd' ... */
 ev.data.fd = fd1
 ev.events = EPOLLIN;
 if (epoll_ctl(epfd, EPOLL_CTL_ADD, fd1, ev) == -1)
 errExit("epoll_ctl");
 /* Giả sử rằng 'fd1' lúc này trở nên sẵn sàng để đọc dữ liệu */
 fd2 = dup(fd1);
 close(fd1);
 ready = epoll_wait(epfd, evlist, MAX_EVENTS, -1);
 if (ready == -1)
 errExit("epoll_wait");
```

### 63.4.5 Hiệu năng của epoll so với I/O Multiplexing

[Bảng 63-9](#page-76-1) hiển thị kết quả (trên Linux 2.6.25) khi chúng ta giám sát $N$ File Descriptor (mô tả tệp) liền kề trong dải từ 0 đến $N – 1$ bằng cách sử dụng poll(), select() và epoll. (Thử nghiệm được sắp xếp sao cho trong mỗi thao tác giám sát, có đúng một File Descriptor được chọn ngẫu nhiên ở trạng thái sẵn sàng - ready). Từ bảng này, chúng ta thấy rằng khi số lượng File Descriptor cần giám sát trở nên lớn, poll() và select() cho hiệu năng kém. Ngược lại, hiệu năng của epoll hầu như không suy giảm khi $N$ tăng lớn. (Sự sụt giảm nhỏ về hiệu năng khi $N$ tăng có thể là kết quả của việc chạm giới hạn CPU cache trên hệ thống thử nghiệm).

> Phục vụ cho mục đích của bài kiểm tra này, FD\_SETSIZE đã được thay đổi thành 16.384 trong các tệp header của glibc để cho phép chương trình thử nghiệm giám sát số lượng lớn các File Descriptor bằng cách sử dụng select().

| Số lượng mô tả được<br>giám sát (N) | Thời gian CPU của poll()<br>(giây) | Thời gian CPU của select()<br>(giây) | Thời gian CPU của epoll()<br>(giây) |
|----------------------------------------|------------------------------|--------------------------------|-----------------------------|
| 10                                     | 0.61                         | 0.73                           | 0.41                        |
| 100                                    | 2.9                          | 3.0                            | 0.42                        |
| 1000                                   | 35                           | 35                             | 0.53                        |
| 10000                                  | 990                          | 930                            | 0.66                        |

<span id="page-76-1">**Bảng 63-9:** Thời gian thực hiện của poll(), select() và epoll cho 100.000 thao tác giám sát

Trong Mục [63.2.5,](#page-57-0) chúng ta đã thấy lý do tại sao select() và poll() hoạt động kém hiệu quả khi giám sát số lượng lớn File Descriptor. Bây giờ chúng ta xem xét các lý do khiến epoll hoạt động tốt hơn:

- Trong mỗi lần gọi select() hoặc poll(), Kernel (hạt nhân) phải kiểm tra tất cả các File Descriptor được chỉ định trong lời gọi. Ngược lại, khi chúng ta đánh dấu một mô tả để giám sát bằng epoll\_ctl(), Kernel sẽ ghi lại thực tế này vào một danh sách liên kết với mô tả tệp mở bên dưới (open file description), và bất cứ khi nào một thao tác I/O làm cho File Descriptor sẵn sàng được thực hiện, Kernel sẽ thêm một mục vào danh sách sẵn sàng (ready list) cho epoll descriptor. (Một sự kiện I/O trên một mô tả tệp mở đơn lẻ có thể làm cho nhiều File Descriptor liên kết với mô tả đó chuyển sang trạng thái sẵn sàng). Các lời gọi epoll\_wait() tiếp theo đơn giản chỉ lấy các mục từ danh sách sẵn sàng này.
- Mỗi khi chúng ta gọi select() hoặc poll(), chúng ta truyền một cấu trúc dữ liệu cho Kernel để xác định tất cả các File Descriptor cần giám sát, và khi trả về, Kernel truyền ngược lại một cấu trúc dữ liệu mô tả trạng thái sẵn sàng của tất cả các mô tả này. Ngược lại, với epoll, chúng ta sử dụng epoll\_ctl() để xây dựng một cấu trúc dữ liệu trong Kernel Space (không gian hạt nhân) liệt kê tập hợp các File Descriptor cần giám sát. Một khi cấu trúc dữ liệu này đã được xây dựng, mỗi lời gọi epoll\_wait() sau đó không cần phải truyền bất kỳ thông tin nào về các File Descriptor cho Kernel, và lời gọi chỉ trả về thông tin về những mô tả nào đang sẵn sàng.

Ngoài các điểm trên, đối với select(), chúng ta phải khởi tạo cấu trúc dữ liệu đầu vào trước mỗi lời gọi, và đối với cả select() và poll(), chúng ta phải kiểm tra cấu trúc dữ liệu được trả về để tìm xem trong số $N$ File Descriptor nào đang sẵn sàng. Tuy nhiên, một số thử nghiệm cho thấy thời gian cần thiết cho các bước khác này là không đáng kể so với thời gian cần thiết cho System Call (lời gọi hệ thống) để giám sát $N$ mô tả. [Bảng 63-9](#page-76-1) không bao gồm thời gian cho bước kiểm tra.

Nói một cách rất đại khái, chúng ta có thể nói rằng đối với các giá trị lớn của $N$ (số lượng File Descriptor đang được giám sát), hiệu năng của select() và poll() tỉ lệ tuyến tính (scales linearly) theo $N$. Chúng ta bắt đầu thấy hành vi này đối với các trường hợp $N = 100$ và $N = 1000$ trong [Bảng 63-9.](#page-76-1) Khi đạt đến $N = 10000$, mức độ mở rộng thực tế đã trở nên tệ hơn cả tuyến tính.

Ngược lại, epoll mở rộng (tuyến tính) theo số lượng sự kiện I/O xảy ra. Do đó, API epoll tỏ ra đặc biệt hiệu quả trong một kịch bản phổ biến ở các máy chủ xử lý nhiều client đồng thời: trong số nhiều File Descriptor đang được giám sát, phần lớn là ở trạng thái nhàn rỗi (idle); chỉ một số ít mô tả là sẵn sàng.

### 63.4.6 Thông báo kích hoạt theo cạnh (Edge-Triggered Notification)

Theo mặc định, cơ chế `epoll` cung cấp thông báo kích hoạt theo mức (level-triggered notification). Điều này có nghĩa là `epoll` cho chúng ta biết liệu một thao tác I/O có thể được thực hiện trên một bộ mô tả tệp (file descriptor) mà không bị chặn (blocking) hay không. Đây cũng là loại thông báo tương tự do `poll()` và `select()` cung cấp.

API `epoll` cũng cho phép thông báo kích hoạt theo cạnh (edge-triggered notification)—nghĩa là, một lời gọi đến `epoll_wait()` sẽ cho biết liệu có hoạt động I/O nào xảy ra trên bộ mô tả tệp kể từ lần gọi `epoll_wait()` trước đó hay không (hoặc kể từ khi bộ mô tả được mở, nếu chưa có lời gọi nào trước đó). Sử dụng `epoll` với thông báo kích hoạt theo cạnh có ngữ nghĩa tương tự với I/O điều khiển theo tín hiệu (signal-driven I/O), ngoại trừ việc nếu có nhiều sự kiện I/O xảy ra, `epoll` sẽ gom chúng lại thành một thông báo duy nhất được trả về thông qua `epoll_wait()`; trong khi với signal-driven I/O, nhiều tín hiệu có thể được tạo ra.

Để sử dụng thông báo kích hoạt theo cạnh, chúng ta chỉ định cờ `EPOLLET` trong `ev.events` khi gọi `epoll_ctl()`:

```c
struct epoll_event ev;
ev.data.fd = fd;
ev.events = EPOLLIN | EPOLLET;
if (epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &ev) == -1)
 errExit("epoll_ctl");
```

Chúng ta minh họa sự khác biệt giữa thông báo `epoll` kích hoạt theo mức và kích hoạt theo cạnh bằng một ví dụ. Giả sử rằng chúng ta đang sử dụng `epoll` để theo dõi một socket nhận dữ liệu đầu vào (`EPOLLIN`), và các bước sau đây diễn ra:

- 1. Dữ liệu đầu vào đến socket.
- 2. Chúng ta thực hiện một lời gọi `epoll_wait()`. Lời gọi này sẽ cho chúng ta biết rằng socket đã sẵn sàng, bất kể chúng ta đang sử dụng thông báo kích hoạt theo mức hay kích hoạt theo cạnh.
- 3. Chúng ta thực hiện lời gọi thứ hai tới `epoll_wait()`.

Nếu chúng ta đang sử dụng thông báo kích hoạt theo mức, thì lời gọi `epoll_wait()` thứ hai sẽ thông báo cho chúng ta biết rằng socket đã sẵn sàng. Nếu chúng ta đang sử dụng thông báo kích hoạt theo cạnh, thì lời gọi thứ hai tới `epoll_wait()` sẽ bị chặn (block), bởi vì không có dữ liệu đầu vào mới nào đến kể từ lời gọi `epoll_wait()` trước đó.

Như chúng ta đã lưu ý ở Mục [63.1.1](#page-40-0), thông báo kích hoạt theo cạnh thường được sử dụng kết hợp với các bộ mô tả tệp không chặn (nonblocking file descriptor). Do đó, khuôn mẫu chung để sử dụng thông báo `epoll` kích hoạt theo cạnh như sau:

- 1. Đặt tất cả các bộ mô tả tệp cần theo dõi ở chế độ không chặn (nonblocking).
- 2. Xây dựng danh sách quan tâm (interest list) của `epoll` bằng cách sử dụng `epoll_ctl()`.
- 3. Xử lý các sự kiện I/O bằng vòng lặp sau:
  - a) Truy xuất danh sách các bộ mô tả sẵn sàng bằng cách sử dụng `epoll_wait()`.
  - b) Đối với mỗi bộ mô tả tệp đã sẵn sàng, tiến hành xử lý I/O cho đến khi system call (lời gọi hệ thống) liên quan (ví dụ: `read()`, `write()`, `recv()`, `send()`, hoặc `accept()`) trả về lỗi `EAGAIN` hoặc `EWOULDBLOCK`.

### Phòng tránh tình trạng đói bộ mô tả tệp (file-descriptor starvation) khi sử dụng thông báo kích hoạt theo cạnh

Giả sử rằng chúng ta đang theo dõi nhiều bộ mô tả tệp bằng thông báo kích hoạt theo cạnh, và một bộ mô tả tệp đã sẵn sàng có lượng lớn dữ liệu đầu vào (có thể là một luồng vô tận). Nếu sau khi phát hiện bộ mô tả tệp này đã sẵn sàng, chúng ta cố gắng tiêu thụ toàn bộ dữ liệu đầu vào bằng các lệnh đọc không chặn (nonblocking reads), thì chúng ta có nguy cơ làm cho các bộ mô tả tệp khác bị "đói" (starving), tức là không được quan tâm xử lý (nghĩa là có thể mất một thời gian dài chúng ta mới kiểm tra lại trạng thái sẵn sàng của chúng và thực hiện I/O trên đó). Một giải pháp cho vấn đề này là ứng dụng duy trì một danh sách các bộ mô tả tệp đã được thông báo là sẵn sàng, và thực thi một vòng lặp liên tục thực hiện các hành động sau:

- 1. Theo dõi các bộ mô tả tệp bằng `epoll_wait()` và thêm các bộ mô tả đã sẵn sàng vào danh sách của ứng dụng. Nếu có bất kỳ bộ mô tả tệp nào đã được đăng ký là sẵn sàng trong danh sách của ứng dụng, thì thời gian chờ (timeout) cho bước theo dõi này phải nhỏ hoặc bằng 0, để nếu không có bộ mô tả tệp mới nào sẵn sàng, ứng dụng có thể nhanh chóng chuyển sang bước tiếp theo và phục vụ bất kỳ bộ mô tả tệp nào đã được biết là sẵn sàng.
- 2. Thực hiện một lượng I/O giới hạn trên các bộ mô tả tệp đã được đăng ký là sẵn sàng trong danh sách của ứng dụng (có thể duyệt vòng tròn qua chúng theo thuật toán round-robin, thay vì luôn bắt đầu từ đầu danh sách sau mỗi lần gọi `epoll_wait()`). Một bộ mô tả tệp có thể bị xóa khỏi danh sách của ứng dụng khi system call I/O không chặn tương ứng gặp lỗi `EAGAIN` hoặc `EWOULDBLOCK`.

Mặc dù đòi hỏi thêm công sức lập trình, phương pháp này mang lại các lợi ích khác ngoài việc ngăn chặn tình trạng đói bộ mô tả tệp. Ví dụ, chúng ta có thể bao gồm các bước khác trong vòng lặp trên, chẳng hạn như xử lý bộ định thời (timers) và tiếp nhận tín hiệu bằng `sigwaitinfo()` (hoặc tương tự).

Các cân nhắc về tình trạng đói (starvation) cũng có thể áp dụng khi sử dụng signal-driven I/O, vì nó cũng cung cấp cơ chế thông báo kích hoạt theo cạnh. Ngược lại, các cân nhắc về tình trạng đói không nhất thiết áp dụng cho các ứng dụng sử dụng cơ chế thông báo kích hoạt theo mức. Điều này là do chúng ta có thể sử dụng các bộ mô tả tệp ở chế độ chặn (blocking) với thông báo kích hoạt theo mức và sử dụng một vòng lặp liên tục kiểm tra tính sẵn sàng của các bộ mô tả, sau đó thực hiện một số thao tác I/O trên các bộ mô tả đã sẵn sàng trước khi kiểm tra lại các bộ mô tả tệp sẵn sàng một lần nữa.

## 63.5 Chờ Tín hiệu (Signals) và Bộ mô tả Tệp (File Descriptors)

Đôi khi, một tiến trình (process) cần đồng thời chờ cho các thao tác I/O khả dụng trên một tập hợp các bộ mô tả tệp (file descriptor) hoặc chờ phân phối tín hiệu (signal delivery). Chúng ta có thể thử thực hiện thao tác này bằng cách sử dụng `select()`, như được minh họa trong [Liệt kê 63-7.](#page-79-0)

**Liệt kê 63-7:** Phương pháp sai khi bỏ chặn tín hiệu và gọi hàm `select()`

```
sig_atomic_t gotSig = 0;
void
handler(int sig)
{
 gotSig = 1;
}
int
main(int argc, char *argv[])
{
 struct sigaction sa;
 ...
 sa.sa_sigaction = handler;
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = 0;
 if (sigaction(SIGUSR1, &sa, NULL) == -1)
 errExit("sigaction");
 /* Chuyện gì xảy ra nếu tín hiệu được gửi đến ngay lúc này? */
 ready = select(nfds, &readfds, NULL, NULL, NULL);
 if (ready > 0) {
 printf("%d file descriptors ready\n", ready);
 } else if (ready == -1 && errno == EINTR) {
 if (gotSig)
 printf("Got signal\n");
 } else {
 /* Một số lỗi khác */
 }
 ...
}
```

Vấn đề với đoạn mã này là nếu tín hiệu (`SIGUSR1` trong ví dụ này) đến sau khi thiết lập hàm xử lý (handler) nhưng trước khi `select()` được gọi, thì lời gọi `select()` vẫn sẽ bị chặn (block). (Đây là một dạng của điều kiện tranh chấp - race condition). Bây giờ chúng ta sẽ xem xét một số giải pháp cho vấn đề này.

> Kể từ phiên bản 2.6.27, Linux cung cấp một kỹ thuật bổ sung có thể được sử dụng để đồng thời chờ tín hiệu và bộ mô tả tệp: cơ chế `signald` được mô tả trong Mục 22.11. Sử dụng cơ chế này, chúng ta có thể nhận tín hiệu thông qua một bộ mô tả tệp được giám sát (cùng với các bộ mô tả tệp khác) bằng cách sử dụng `select()`, `poll()`, hoặc `epoll_wait()`.

### 63.5.1 Lời gọi Hệ thống pselect()

Lời gọi hệ thống (System Call) `pselect()` thực hiện một tác vụ tương tự như `select()`. Sự khác biệt chính về mặt ngữ nghĩa là một tham số bổ sung, `sigmask`, xác định tập hợp các tín hiệu sẽ được bỏ chặn trong khi lời gọi bị chặn.

```
## define _XOPEN_SOURCE 600
## include <sys/select.h>
int pselect(int nfds, fd_set *readfds, fd_set *writefds, fd_set *exceptfds,
 struct timespec *timeout, const sigset_t *sigmask);
         Trả về số lượng bộ mô tả tệp sẵn sàng, 0 nếu hết thời gian (timeout), hoặc –1 nếu lỗi
```

Chính xác hơn, giả sử chúng ta có lời gọi `pselect()` sau:

```
ready = pselect(nfds, &readfds, &writefds, &exceptfds, timeout, &sigmask);
```

Lời gọi này tương đương với việc thực hiện một cách nguyên tử (atomically) các bước sau:

```
sigset_t origmask;
sigprocmask(SIG_SETMASK, &sigmask, &origmask);
ready = select(nfds, &readfds, &writefds, &exceptfds, timeout);
sigprocmask(SIG_SETMASK, &origmask, NULL); /* Khôi phục mặt nạ tín hiệu - signal mask */
```

Sử dụng `pselect()`, chúng ta có thể viết lại phần đầu của thân chương trình chính trong [Liệt kê 63-7](#page-79-0) như được thể hiện trong [Liệt kê 63-8](#page-81-0).

Ngoài tham số `sigmask`, `select()` và `pselect()` khác nhau ở các điểm sau:

- Tham số `timeout` của `pselect()` là một cấu trúc `timespec` (Mục 23.4.2), cho phép chỉ định thời gian chờ với độ chính xác đến nano giây (thay vì micro giây).
- SUSv3 nêu rõ rằng `pselect()` không sửa đổi tham số `timeout` khi trả về.

Nếu chúng ta chỉ định tham số `sigmask` của `pselect()` là `NULL`, thì `pselect()` tương đương với `select()` (tức là nó không thao tác trên mặt nạ tín hiệu của tiến trình), ngoại trừ các điểm khác biệt vừa nêu.

Giao diện `pselect()` là một phát minh của POSIX.1g, và ngày nay đã được tích hợp vào SUSv3. Nó không có sẵn trên tất cả các cài đặt UNIX, và chỉ được thêm vào Linux từ phiên bản kernel 2.6.16.

> Trước đây, một hàm thư viện `pselect()` được cung cấp bởi glibc, nhưng cách cài đặt này không cung cấp các đảm bảo tính nguyên tử (atomicity guarantees) cần thiết cho hoạt động chính xác của lời gọi. Các đảm bảo này chỉ có thể được cung cấp bởi việc cài đặt `pselect()` trong kernel (kernel implementation).

```
 sigset_t emptyset, blockset;
 struct sigaction sa;
 sigemptyset(&blockset);
 sigaddset(&blockset, SIGUSR1);
 if (sigprocmask(SIG_BLOCK, &blockset, NULL) == -1)
 errExit("sigprocmask");
 sa.sa_sigaction = handler;
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = SA_RESTART;
 if (sigaction(SIGUSR1, &sa, NULL) == -1)
 errExit("sigaction");
 sigemptyset(&emptyset);
 ready = pselect(nfds, &readfds, NULL, NULL, NULL, &emptyset);
 if (ready == -1)
 errExit("pselect");
```

### Các lời gọi hệ thống ppoll() và epoll\_pwait()

Linux 2.6.16 cũng bổ sung một lời gọi hệ thống mới, phi tiêu chuẩn là `ppoll()`, mối quan hệ của nó với `poll()` cũng tương tự như mối quan hệ của `pselect()` đối với `select()`. Tương tự, bắt đầu từ kernel 2.6.19, Linux cũng bao gồm `epoll_pwait()`, cung cấp một phần mở rộng tương tự cho `epoll_wait()`. Xem các trang hướng dẫn (manual pages) `ppoll(2)` và `epoll_pwait(2)` để biết thêm chi tiết.

### 63.5.2 Thủ thuật Self-Pipe

Vì `pselect()` không được hỗ trợ rộng rãi, các ứng dụng có tính di động (portable applications) phải sử dụng các chiến lược khác để tránh tình trạng tranh chấp (race condition) khi vừa phải chờ tín hiệu (signal) vừa gọi `select()` trên một tập hợp các tệp mô tả (File Descriptor). Một giải pháp phổ biến như sau:

- 1. Tạo một đường ống (pipe), và đánh dấu cả hai đầu đọc và ghi của nó là không chặn (nonblocking).
- 2. Bên cạnh việc giám sát tất cả các File Descriptor quan tâm khác, hãy đưa đầu đọc của pipe vào tập hợp `readfds` được truyền cho `select()`.
- 3. Cài đặt một trình xử lý (handler) cho tín hiệu cần quan tâm. Khi trình xử lý tín hiệu này được gọi, nó sẽ ghi một byte dữ liệu vào pipe. Lưu ý các điểm sau về trình xử lý tín hiệu:
  - Đầu ghi của pipe được đánh dấu là không chặn ở bước đầu tiên nhằm ngăn chặn khả năng các tín hiệu đến quá dồn dập khiến việc gọi liên tiếp trình xử lý tín hiệu làm đầy pipe, dẫn đến việc hàm `write()` của trình xử lý tín hiệu (và do đó là cả tiến trình - Process) bị chặn (blocked). (Việc ghi vào một pipe đã đầy bị lỗi không quan trọng, vì các lần ghi trước đó đã báo hiệu về việc tín hiệu được gửi đến rồi).

- Trình xử lý tín hiệu được cài đặt sau khi tạo pipe nhằm ngăn chặn race condition có thể xảy ra nếu một tín hiệu được gửi đến trước khi pipe được tạo.
- Sử dụng `write()` bên trong trình xử lý tín hiệu là an toàn, bởi vì đây là một trong những hàm an toàn với tín hiệu bất đồng bộ (async-signal-safe functions) được liệt kê trong Bảng 21-1, trang 426.
- 4. Đặt lệnh gọi `select()` trong một vòng lặp để nó được khởi động lại (restart) nếu bị gián đoạn bởi một trình xử lý tín hiệu. (Việc khởi động lại theo cách này không phải lúc nào cũng bắt buộc; nó chỉ đơn giản có nghĩa là chúng ta có thể kiểm tra xem tín hiệu có đến hay không bằng cách kiểm tra `readfds`, thay vì kiểm tra lỗi trả về `EINTR`).
- 5. Khi hàm `select()` hoàn tất thành công, chúng ta có thể xác định xem có tín hiệu nào đến hay không bằng cách kiểm tra xem File Descriptor của đầu đọc pipe có được thiết lập trong `readfds` hay không.
- 6. Bất cứ khi nào có tín hiệu đến, hãy đọc tất cả các byte có trong pipe. Vì nhiều tín hiệu có thể đến cùng lúc, hãy sử dụng một vòng lặp đọc các byte cho đến khi hàm `read()` (không chặn) trả về lỗi `EAGAIN`. Sau khi làm rỗng pipe, hãy thực hiện bất kỳ hành động nào cần thiết để phản hồi lại việc tín hiệu được gửi đến.

Kỹ thuật này thường được gọi là thủ thuật self-pipe (self-pipe trick), và mã nguồn minh họa kỹ thuật này được thể hiện trong [Liệt kê 63-9.](#page-82-0)

Các biến thể của kỹ thuật này cũng có thể được áp dụng tương tự với `poll()` và `epoll_wait()`.

**Liệt kê 63-9:** Sử dụng thủ thuật self-pipe

```c
––––––––––––––––––––––––––––––––––––––––––––––––––––– from altio/self_pipe.c
static int pfd[2]; /* File descriptors for pipe */
static void
handler(int sig)
{
 int savedErrno; /* In case we change 'errno' */
 savedErrno = errno;
 if (write(pfd[1], "x", 1) == -1 && errno != EAGAIN)
 errExit("write");
 errno = savedErrno;
}
int
main(int argc, char *argv[])
{
 fd_set readfds;
 int ready, nfds, flags;
 struct timeval timeout;
 struct timeval *pto;
 struct sigaction sa;
 char ch;
```

```c
 /* ... Initialize 'timeout', 'readfds', and 'nfds' for select() */
 if (pipe(pfd) == -1)
 errExit("pipe");
 FD_SET(pfd[0], &readfds); /* Add read end of pipe to 'readfds' */
 nfds = max(nfds, pfd[0] + 1); /* And adjust 'nfds' if required */
 flags = fcntl(pfd[0], F_GETFL);
 if (flags == -1)
 errExit("fcntl-F_GETFL");
 flags |= O_NONBLOCK; /* Make read end nonblocking */
 if (fcntl(pfd[0], F_SETFL, flags) == -1)
 errExit("fcntl-F_SETFL");
 flags = fcntl(pfd[1], F_GETFL);
 if (flags == -1)
 errExit("fcntl-F_GETFL");
 flags |= O_NONBLOCK; /* Make write end nonblocking */
 if (fcntl(pfd[1], F_SETFL, flags) == -1)
 errExit("fcntl-F_SETFL");
 sigemptyset(&sa.sa_mask);
 sa.sa_flags = SA_RESTART; /* Restart interrupted read()s */
 sa.sa_handler = handler;
 if (sigaction(SIGINT, &sa, NULL) == -1) 
      errExit("sigaction");
 while ((ready = select(nfds, &readfds, NULL, NULL, pto)) == -1 &&
 errno == EINTR)
 continue; /* Restart if interrupted by signal */
 if (ready == -1) /* Unexpected error */
 errExit("select");
 if (FD_ISSET(pfd[0], &readfds)) { /* Handler was called */
 printf("A signal was caught\n");
 for (;;) { /* Consume bytes from pipe */
 if (read(pfd[0], &ch, 1) == -1) {
 if (errno == EAGAIN)
 break; /* No more bytes */
 else
 errExit("read"); /* Some other error */
 }
 /* Perform any actions that should be taken in response to signal */
 }
 }
 /* Examine file descriptor sets returned by select() to see
 which other file descriptors are ready */
}
––––––––––––––––––––––––––––––––––––––––––––––––––––– from altio/self_pipe.c
```

## 63.6 Tóm tắt

Trong chương này, chúng ta đã khám phá các phương pháp thay thế khác nhau cho mô hình thực hiện I/O tiêu chuẩn: đa kênh I/O (I/O multiplexing) (`select()` và `poll()`), I/O hướng tín hiệu (signal-driven I/O), và API `epoll` đặc thù của Linux. Tất cả các cơ chế này đều cho phép chúng ta giám sát nhiều mô tả tệp (File Descriptor) để kiểm tra xem thao tác I/O có khả thi trên bất kỳ mô tả tệp nào trong số đó hay không. Không có cơ chế nào trong số này thực sự thực hiện thao tác I/O. Thay vào đó, một khi chúng ta xác định được một File Descriptor đã sẵn sàng, chúng ta sẽ sử dụng các System Call I/O truyền thống để thực hiện I/O.

Các hàm đa kênh I/O `select()` và `poll()` đồng thời giám sát nhiều File Descriptor để xem I/O có khả thi trên bất kỳ mô tả nào hay không. Với cả hai System Call này, chúng ta truyền một danh sách đầy đủ các File Descriptor cần kiểm tra vào Kernel ở mỗi lần gọi System Call, và Kernel trả về một danh sách đã được sửa đổi cho biết những mô tả nào đã sẵn sàng. Việc danh sách toàn bộ File Descriptor được truyền và kiểm tra trong mỗi lần gọi đồng nghĩa với việc `select()` và `poll()` hoạt động kém hiệu quả khi giám sát một số lượng lớn File Descriptor.

I/O hướng tín hiệu (signal-driven I/O) cho phép một Tiến trình (Process) nhận được tín hiệu (signal) khi I/O khả thi trên một File Descriptor. Để bật I/O hướng tín hiệu, chúng ta phải thiết lập một hàm xử lý (handler) cho tín hiệu `SIGIO`, đặt Process sở hữu sẽ nhận tín hiệu đó, và kích hoạt việc tạo tín hiệu bằng cách thiết lập cờ trạng thái tệp mở `O_ASYNC`. Cơ chế này mang lại những lợi ích hiệu năng đáng kể so với đa kênh I/O khi giám sát số lượng lớn File Descriptor. Linux cho phép chúng ta thay đổi tín hiệu được sử dụng để thông báo, và nếu thay vào đó chúng ta sử dụng tín hiệu thời gian thực (realtime signal), thì nhiều thông báo có thể được đưa vào hàng đợi (queue), và hàm xử lý tín hiệu có thể sử dụng đối số `siginfo_t` của nó để xác định File Descriptor và loại sự kiện đã tạo ra tín hiệu đó.

Giống như I/O hướng tín hiệu, `epoll` mang lại hiệu năng vượt trội khi giám sát số lượng lớn File Descriptor. Lợi thế về hiệu năng của `epoll` (và I/O hướng tín hiệu) xuất phát từ việc Kernel "ghi nhớ" danh sách các File Descriptor mà một Process đang giám sát (trái ngược với `select()` và `poll()`, nơi mà mỗi System Call phải thông báo lại cho Kernel biết những File Descriptor nào cần kiểm tra). API `epoll` có một số ưu điểm nổi bật hơn so với việc sử dụng I/O hướng tín hiệu: chúng ta tránh được sự phức tạp trong việc xử lý các tín hiệu và có thể chỉ định loại sự kiện I/O nào (ví dụ: đầu vào hoặc đầu ra) cần được giám sát.

Trong xuyên suốt chương này, chúng ta đã phân biệt giữa thông báo trạng thái sẵn sàng theo mức (level-triggered) và theo sườn (edge-triggered). Với mô hình thông báo theo mức (level-triggered), chúng ta được thông báo liệu I/O hiện có khả thi trên một File Descriptor hay không. Ngược lại, thông báo theo sườn (edge-triggered) cho chúng ta biết liệu hoạt động I/O có xảy ra trên một File Descriptor kể từ lần giám sát cuối cùng của nó hay không. Các System Call đa kênh I/O cung cấp mô hình thông báo theo mức; I/O hướng tín hiệu xấp xỉ mô hình theo sườn; và `epoll` có khả năng hoạt động dưới cả hai mô hình (mức là mặc định). Thông báo theo sườn thường được sử dụng kết hợp với I/O không chặn (nonblocking I/O).

Chúng ta đã kết thúc chương bằng việc xem xét một vấn đề đôi khi đối mặt với các chương trình giám sát nhiều File Descriptor: làm thế nào để đồng thời chờ đợi việc phân phối một tín hiệu. Giải pháp thông thường cho vấn đề này là cái gọi là mẹo tự nối ống (self-pipe trick), trong đó hàm xử lý tín hiệu ghi một byte vào một Pipe mà đầu đọc của nó nằm trong tập hợp các File Descriptor được giám sát. SUSv3 chỉ định `pselect()`, một biến thể của `select()` cung cấp một giải pháp khác cho vấn đề này. Tuy nhiên, `pselect()` không khả dụng trên tất cả các cài đặt UNIX. Linux cũng cung cấp các hàm tương tự (nhưng không theo chuẩn) là `ppoll()` và `epoll_pwait()`.

### Thông tin thêm

[Stevens et al., 2004] mô tả đa kênh I/O và I/O hướng tín hiệu, với điểm nhấn đặc biệt về việc sử dụng các cơ chế này với Socket. [Gammo et al, 2004] là một bài báo so sánh hiệu năng của `select()`, `poll()`, và `epoll()`.

Một tài nguyên trực tuyến đặc biệt thú vị tại http://www.kegel.com/c10k.html. Được viết bởi Dan Kegel và có tựa đề "Vấn đề C10K" (The C10K problem), trang web này khám phá các vấn đề mà các nhà phát triển máy chủ web (web server) gặp phải khi được thiết kế để phục vụ đồng thời hàng chục ngàn client. Trang web bao gồm một loạt các liên kết đến thông tin liên quan.

## 63.7 Bài tập

- **63-1.** Sửa đổi chương trình trong [Liệt kê 63-2](#page-85-0) (`poll_pipes.c`) để sử dụng `select()` thay vì `poll()`.
- **63-2.** Viết một echo server (xem Mục 60.2 và 60.3) xử lý cả hai loại client TCP và UDP. Để làm được điều này, server phải tạo cả một listening TCP socket và một UDP socket, sau đó giám sát cả hai socket này bằng cách sử dụng một trong các kỹ thuật được mô tả trong chương này.
- **63-3.** Mục [63.5](#page-79-1) đã lưu ý rằng `select()` không thể được sử dụng để chờ đồng thời cả tín hiệu (signal) và File Descriptor (mô tả tệp), đồng thời mô tả một giải pháp sử dụng trình xử lý tín hiệu (signal handler) và một pipe. Một vấn đề liên quan phát sinh khi một chương trình cần chờ dữ liệu đầu vào trên cả File Descriptor và hàng đợi thông điệp System V (System V message queue) (vì hàng đợi thông điệp System V không sử dụng File Descriptor). Một giải pháp là tạo một tiến trình con (child process) riêng biệt để sao chép từng thông điệp từ hàng đợi vào một pipe nằm trong số các File Descriptor được giám sát bởi tiến trình cha (parent process). Viết một chương trình sử dụng mô hình này với `select()` để giám sát đầu vào từ cả thiết bị đầu cuối (terminal) và hàng đợi thông điệp.
- **63-4.** Bước cuối cùng trong phần mô tả kỹ thuật self-pipe tại Mục [63.5.2](#page-81-1) nêu rõ rằng chương trình trước tiên nên làm cạn (drain) pipe, sau đó mới thực hiện bất kỳ hành động nào cần được thực hiện để phản hồi lại tín hiệu. Điều gì có thể xảy ra nếu các bước con này bị đảo ngược?
- **63-5.** Sửa đổi chương trình trong [Liệt kê 63-9](#page-82-0) (`self_pipe.c`) để sử dụng `poll()` thay vì `select()`.
- **63-6.** Viết một chương trình sử dụng `epoll_create()` để tạo một epoll instance và sau đó ngay lập tức chờ trên File Descriptor được trả về bằng cách sử dụng `epoll_wait()`. Khi, giống như trong trường hợp này, `epoll_wait()` được cung cấp một epoll file descriptor với một danh sách quan tâm (interest list) trống, điều gì sẽ xảy ra? Tại sao điều này có thể hữu ích?
- **63-7.** Giả sử chúng ta có một epoll file descriptor đang giám sát nhiều File Descriptor, tất cả đều luôn trong trạng thái sẵn sàng (ready). Nếu chúng ta thực hiện một chuỗi các lệnh gọi `epoll_wait()` trong đó `maxevents` nhỏ hơn nhiều so với số lượng File Descriptor sẵn sàng (ví dụ: `maxevents` bằng 1), mà không thực hiện tất cả các thao tác I/O có thể trên các mô tả tệp sẵn sàng giữa các lần gọi, thì epoll_wait() sẽ trả về (các) mô tả tệp nào trong mỗi lần gọi? Viết một chương trình để xác định câu trả lời. (Đối với mục đích của thí nghiệm này, việc không thực hiện bất kỳ thao tác I/O nào giữa các System Call `epoll_wait()` là đủ). Tại sao hành vi này có thể hữu ích?
- **63-8.** Sửa đổi chương trình trong [Liệt kê 63-3](#page-59-0) (`demo_sigio.c`) để sử dụng tín hiệu thời gian thực (realtime signal) thay vì `SIGIO`. Sửa đổi trình xử lý tín hiệu để chấp nhận đối số `siginfo_t` và hiển thị các giá trị của các trường `si_fd` và `si_code` của cấu trúc này.
