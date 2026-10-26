# Chương 5: Tính đồng thời và Điều kiện tranh chấp (Concurrency and Race Conditions)

Cho đến nay, chúng ta ít chú ý đến vấn đề tính đồng thời (concurrency) — tức là những gì xảy ra khi hệ thống cố gắng thực hiện nhiều tác vụ cùng một lúc. Tuy nhiên, việc quản lý tính đồng thời là một trong những vấn đề cốt lõi trong lập trình hệ điều hành (operating systems programming). Các lỗi liên quan đến tính đồng thời thuộc loại dễ tạo ra nhất và khó tìm ra nhất. Ngay cả các lập trình viên nhân Linux (Linux kernel) kỳ cựu đôi khi cũng tạo ra các lỗi liên quan đến tính đồng thời.

Trong các phiên bản nhân Linux thời kỳ đầu, có tương đối ít nguồn gây ra tính đồng thời. Các hệ thống đa xử lý đối xứng (Symmetric Multiprocessing - SMP) chưa được nhân hỗ trợ, và nguyên nhân duy nhất dẫn đến việc thực thi đồng thời là việc xử lý các ngắt phần cứng (hardware interrupts). Cách tiếp cận đó mang lại sự đơn giản, nhưng nó không còn hiệu quả trong một thế giới mà người ta đề cao hiệu năng trên các hệ thống có ngày càng nhiều bộ xử lý, và yêu cầu hệ thống phải phản hồi các sự kiện một cách nhanh chóng. Để đáp ứng nhu cầu của phần cứng và ứng dụng hiện đại, nhân Linux đã tiến hóa đến mức có nhiều tác vụ diễn ra đồng thời hơn rất nhiều. Sự tiến hóa này đã mang lại hiệu năng và khả năng mở rộng (scalability) lớn hơn rất nhiều. Tuy nhiên, nó cũng làm cho công việc lập trình nhân trở nên phức tạp hơn đáng kể. Các lập trình viên trình điều khiển thiết bị (device driver programmers) giờ đây phải tính đến tính đồng thời trong thiết kế của họ ngay từ đầu, và họ phải hiểu rõ các cơ chế do nhân cung cấp để quản lý tính đồng thời.

Mục đích của chương này là bắt đầu quá trình xây dựng sự hiểu biết đó. Vì mục đích đó, chúng ta giới thiệu các cơ chế được áp dụng ngay lập tức cho trình điều khiển *scull* từ Chương 3. Các cơ chế khác được trình bày ở đây sẽ chưa được đưa vào sử dụng ngay trong một thời gian tới. Nhưng trước tiên, chúng ta hãy xem xét điều gì có thể xảy ra sai sót với trình điều khiển *scull* đơn giản của mình và cách tránh các vấn đề tiềm ẩn này.

## Các cạm bẫy trong scull

Chúng ta hãy xem nhanh một đoạn mã quản lý bộ nhớ của *scull*. Sâu bên trong logic hàm *write*, *scull* phải quyết định xem bộ nhớ mà nó yêu cầu đã được cấp phát hay chưa. Một đoạn mã xử lý tác vụ này là:

```c
 if (!dptr->data[s_pos]) {
 dptr->data[s_pos] = kmalloc(quantum, GFP_KERNEL);
 if (!dptr->data[s_pos])
 goto out;
 }
```

Giả sử trong giây lát rằng có hai tiến trình (Process) (chúng ta sẽ gọi chúng là "A" và "B") đang độc lập cố gắng ghi vào cùng một offset trong cùng một thiết bị *scull*. Mỗi tiến trình đạt đến phép kiểm tra `if` ở dòng đầu tiên của đoạn mã trên cùng một thời điểm. Nếu con trỏ đang xét có giá trị NULL, mỗi tiến trình sẽ quyết định cấp phát bộ nhớ, và mỗi tiến trình sẽ gán con trỏ kết quả vào `dptr->data[s_pos]`. Vì cả hai tiến trình đều gán vào cùng một vị trí, rõ ràng chỉ có một phép gán chiếm ưu thế.

Tất nhiên, điều sẽ xảy ra là tiến trình hoàn thành phép gán sau sẽ "chiến thắng". Nếu tiến trình A gán trước, phép gán của nó sẽ bị ghi đè bởi tiến trình B. Tại thời điểm đó, *scull* sẽ hoàn toàn quên mất vùng nhớ mà A đã cấp phát; nó chỉ giữ con trỏ trỏ đến vùng nhớ của B. Do đó, vùng nhớ do A cấp phát sẽ bị bỏ rơi và không bao giờ được trả lại cho hệ thống.

Chuỗi sự kiện này là một minh chứng cho **điều kiện tranh chấp** (*race condition*). Các điều kiện tranh chấp là kết quả của việc truy cập không kiểm soát vào dữ liệu được chia sẻ (shared data). Khi mẫu truy cập sai xảy ra, một kết quả bất ngờ sẽ xuất hiện. Đối với điều kiện tranh chấp được thảo luận ở đây, kết quả là rò rỉ bộ nhớ (memory leak). Điều đó đã đủ tệ rồi, nhưng các điều kiện tranh chấp thường cũng có thể dẫn đến sự cố hệ thống (system crashes), hỏng dữ liệu (corrupted data), hoặc các vấn đề bảo mật. Các lập trình viên có thể bị cám dỗ khi bỏ qua các điều kiện tranh chấp vì chúng là những sự kiện có xác suất cực kỳ thấp. Nhưng trong thế giới máy tính, các sự kiện "một trong một triệu" có thể xảy ra cứ sau vài giây và hậu quả có thể rất nghiêm trọng.

Chúng ta sẽ loại bỏ các điều kiện tranh chấp khỏi *scull* ngay sau đây, nhưng trước tiên chúng ta cần có cái nhìn tổng quát hơn về tính đồng thời.

## Tính đồng thời và việc quản lý

Trong một hệ thống Linux hiện đại, có rất nhiều nguồn gây ra tính đồng thời và do đó, có thể dẫn đến các điều kiện tranh chấp. Nhiều tiến trình không gian người dùng (user-space processes) đang chạy và chúng có thể truy cập mã của bạn theo các tổ hợp cách thức đáng ngạc nhiên. Các hệ thống SMP có thể thực thi mã của bạn đồng thời trên các bộ xử lý khác nhau. Mã nhân có thể bị ngắt quyền (preemptible); mã của trình điều khiển của bạn có thể bị mất quyền sở hữu bộ xử lý bất kỳ lúc nào, và tiến trình thay thế nó cũng có thể đang chạy trong trình điều khiển của bạn. Các ngắt thiết bị (device interrupts) là các sự kiện bất đồng bộ có thể gây ra việc thực thi đồng thời mã của bạn. Nhân cũng cung cấp các cơ chế khác nhau để thực thi mã bị hoãn, chẳng hạn như hàng đợi công việc (*workqueues*), *tasklets*, và bộ định thời (*timers*), những thứ

có thể khiến mã của bạn chạy bất cứ lúc nào theo những cách không liên quan đến những gì tiến trình hiện tại đang làm. Trong thế giới cắm-nóng (hot-pluggable) hiện đại, thiết bị của bạn có thể biến mất ngay khi bạn đang làm việc với nó.

Việc tránh các điều kiện tranh chấp có thể là một nhiệm vụ đáng sợ. Trong một thế giới mà bất cứ điều gì cũng có thể xảy ra bất cứ lúc nào, làm thế nào để một lập trình viên trình điều khiển tránh tạo ra sự hỗn loạn hoàn toàn? Hóa ra là, hầu hết các điều kiện tranh chấp có thể được tránh thông qua một chút suy nghĩ, các nguyên thủy điều khiển tính đồng thời (concurrency control primitives) của nhân, và việc áp dụng một vài nguyên tắc cơ bản. Chúng ta sẽ bắt đầu với các nguyên tắc trước, sau đó đi vào chi tiết cụ thể về cách áp dụng chúng.

Race Condition (điều kiện tranh chấp) phát sinh do việc truy cập chia sẻ các tài nguyên (shared access to resources). Khi hai thread of execution (luồng thực thi)\* có lý do để làm việc cùng một cấu trúc dữ liệu (hoặc tài nguyên phần cứng), tiềm năng xảy ra xung đột luôn tồn tại. Do đó, quy tắc vàng đầu tiên cần ghi nhớ khi thiết kế trình điều khiển (driver) của bạn là tránh sử dụng tài nguyên chia sẻ bất cứ khi nào có thể. Nếu không có truy cập đồng thời (concurrent access), sẽ không thể xảy ra race condition. Vì vậy, mã nguồn kernel (kernel code) được viết cẩn thận nên giảm thiểu tối đa việc chia sẻ. Ứng dụng rõ ràng nhất của tư tưởng này là tránh sử dụng các biến toàn cục (global variables). Nếu bạn đặt một tài nguyên ở nơi mà nhiều hơn một thread of execution có thể tìm thấy nó, thì phải có một lý do thực sự chính đáng để làm điều đó.

Tuy nhiên, thực tế là việc chia sẻ như vậy thường là bắt buộc. Tài nguyên phần cứng, về bản chất của chúng, là được chia sẻ, và tài nguyên phần mềm cũng thường phải khả dụng cho nhiều hơn một luồng. Hãy ghi nhớ rằng các biến toàn cục không phải là cách duy nhất để chia sẻ dữ liệu; bất cứ khi nào mã nguồn của bạn truyền một con trỏ (pointer) đến một phần nào đó của kernel, nó có khả năng đang tạo ra một tình huống chia sẻ mới. Chia sẻ là một thực tế của cuộc sống.

Dưới đây là quy tắc cứng nhắc về việc chia sẻ tài nguyên: bất cứ khi nào một tài nguyên phần cứng hoặc phần mềm được chia sẻ vượt quá một thread of execution duy nhất, và tồn tại khả năng một luồng có thể gặp phải một góc nhìn không nhất quán (inconsistent view) về tài nguyên đó, bạn phải quản lý rõ ràng việc truy cập vào tài nguyên đó. Trong ví dụ *scull* ở trên, góc nhìn của tiến trình (process) B về tình huống là không nhất quán; không biết rằng tiến trình A đã cấp phát bộ nhớ cho thiết bị (được chia sẻ), nó thực hiện việc cấp phát của riêng mình và ghi đè lên công sức của A. Trong trường hợp này, chúng ta phải kiểm soát việc truy cập vào cấu trúc dữ liệu *scull*. Chúng ta cần sắp xếp mọi thứ sao cho mã nguồn hoặc nhìn thấy bộ nhớ đã được cấp phát hoặc biết rằng không có bộ nhớ nào đã *hoặc sẽ được* cấp phát bởi bất kỳ ai khác. Kỹ thuật thông thường để quản lý truy cập được gọi là *locking* (khóa) hoặc *mutual exclusion* (loại trừ lẫn nhau)—đảm bảo rằng chỉ có một thread of execution có thể thao tác với một tài nguyên chia sẻ tại bất kỳ thời điểm nào. Phần lớn phần còn lại của chương này sẽ dành cho việc locking.

Nhằm mục đích của chương này, một "thread" (luồng) thực thi là bất kỳ ngữ cảnh (context) nào đang chạy mã nguồn. Mỗi process rõ ràng là một thread of execution, nhưng trình xử lý ngắt (interrupt handler) hoặc mã nguồn khác chạy để phản hồi lại một sự kiện kernel bất đồng bộ (asynchronous kernel event) cũng vậy.

Tuy nhiên, trước tiên, chúng ta phải xem xét ngắn gọn một quy tắc quan trọng khác. Khi mã nguồn kernel tạo ra một đối tượng sẽ được chia sẻ với bất kỳ phần nào khác của kernel, đối tượng đó phải tiếp tục tồn tại (và hoạt động bình thường) cho đến khi biết chắc chắn rằng không còn tham chiếu (reference) bên nào trỏ tới nó. Ngay tại thời điểm *scull* làm cho các thiết bị của nó khả dụng, nó phải sẵn sàng xử lý các yêu cầu trên các thiết bị đó. Và *scull* phải tiếp tục có khả năng xử lý các yêu cầu trên các thiết bị của mình cho đến khi nó biết rằng không có tham chiếu nào (chẳng hạn như các tệp không gian người dùng đang mở - open userspace files) tới các thiết bị đó tồn tại. Hai yêu cầu xuất phát từ quy tắc này: không đối tượng nào được phép đưa vào kernel cho đến khi nó ở trạng thái có thể hoạt động bình thường, và các tham chiếu đến các đối tượng đó phải được theo dõi (track). Trong hầu hết các trường hợp, bạn sẽ thấy rằng kernel tự động xử lý việc đếm tham chiếu (reference counting) cho bạn, nhưng luôn có những ngoại lệ.

Việc tuân theo các quy tắc trên đòi hỏi sự lập kế hoạch và chú ý cẩn thận đến từng chi tiết. Thật dễ dàng bị bất ngờ bởi việc truy cập đồng thời vào các tài nguyên mà bạn không nhận ra là đã bị chia sẻ. Tuy nhiên, với một chút nỗ lực, hầu hết các race condition có thể được ngăn chặn trước khi chúng gây hại cho bạn—hoặc cho người dùng của bạn.

## Semaphores và Mutexes

Vì vậy, hãy xem xét cách chúng ta có thể thêm locking vào *scull*. Mục tiêu của chúng ta là làm cho các thao tác trên cấu trúc dữ liệu *scull* trở nên *atomic* (nguyên tử), có nghĩa là toàn bộ thao tác diễn ra ngay lập tức đối với các thread of execution khác. Đối với ví dụ rò rỉ bộ nhớ (memory leak) của chúng ta, chúng ta cần đảm bảo rằng nếu một luồng phát hiện ra một khối bộ nhớ cụ thể phải được cấp phát, nó có cơ hội thực hiện việc cấp phát đó trước khi bất kỳ luồng nào khác có thể thực hiện bài kiểm tra đó. Để đạt được mục đích này, chúng ta phải thiết lập các *critical section* (vùng tới hạn): đoạn mã chỉ có thể được thực thi bởi một luồng tại bất kỳ thời điểm nhất định nào.

Không phải tất cả các critical section đều giống nhau, vì vậy kernel cung cấp các primitive (nguyên thủy) khác nhau cho các nhu cầu khác nhau. Trong trường hợp này, mọi quyền truy cập vào cấu trúc dữ liệu *scull* đều diễn ra trong ngữ cảnh tiến trình (process context) như là kết quả của một yêu cầu trực tiếp từ người dùng; sẽ không có quyền truy cập nào được thực hiện từ interrupt handler hoặc các ngữ cảnh bất đồng bộ khác. Không có yêu cầu cụ thể nào về độ trễ (latency - thời gian phản hồi); các lập trình viên ứng dụng hiểu rằng các yêu cầu I/O thường không được thỏa mãn ngay lập tức. Hơn nữa, *scull* không giữ bất kỳ tài nguyên hệ thống quan trọng nào khác trong khi nó đang truy cập vào các cấu trúc dữ liệu của chính nó. Tất cả những điều này có nghĩa là nếu trình điều khiển *scull* đi vào trạng thái ngủ (go to sleep) trong khi chờ đến lượt truy cập cấu trúc dữ liệu, thì sẽ không có ai phàn nàn cả.

"Go to sleep" là một thuật ngữ được định nghĩa rõ ràng trong ngữ cảnh này. Khi một Linux process đạt đến điểm mà nó không thể tiến hành thêm bất kỳ tiến trình nào nữa, nó sẽ đi vào trạng thái ngủ (hoặc "block" - chặn), nhường bộ xử lý cho người khác cho đến một thời điểm nào đó trong tương lai khi nó có thể tiếp tục hoàn thành công việc. Các process thường ngủ khi đang chờ I/O hoàn tất. Khi chúng ta tiến
sâu hơn vào kernel, chúng ta sẽ gặp phải một số tình huống mà chúng ta không thể ngủ. Tuy nhiên, phương thức *write* trong *scull* không phải là một trong những tình huống đó. Vì vậy, chúng ta có thể sử dụng cơ chế locking có thể khiến tiến trình ngủ trong khi chờ quyền truy cập vào critical section.

Cũng quan trọng không kém, chúng ta sẽ thực hiện một thao tác (cấp phát bộ nhớ với *kmalloc*) có khả năng gây sleep (ngủ)—do đó việc sleep là một khả năng có thể xảy ra trong mọi trường hợp. Nếu các vùng găng (critical section) của chúng ta hoạt động bình thường, chúng ta phải sử dụng một cơ chế khóa (locking primitive) hoạt động được khi một Thread (luồng) sở hữu khóa tiến hành sleep. Không phải mọi cơ chế khóa đều có thể được sử dụng ở những nơi có khả năng xảy ra sleep (chúng ta sẽ thấy một số cơ chế không làm được điều này ở phần sau của chương). Tuy nhiên, đối với nhu cầu hiện tại của chúng ta, cơ chế phù hợp nhất là *semaphore* (tín hiệu đồng bộ).

Semaphore là một khái niệm đã được hiểu rõ trong khoa học máy tính. Về cốt lõi, một semaphore là một giá trị số nguyên đơn lẻ kết hợp với một cặp hàm thường được gọi là *P* và *V*. Một Process (tiến trình) muốn truy cập vào một vùng găng sẽ gọi *P* trên semaphore liên quan; nếu giá trị của semaphore lớn hơn không, giá trị đó sẽ bị giảm đi một và tiến trình tiếp tục chạy. Ngược lại, nếu giá trị của semaphore bằng 0 (hoặc nhỏ hơn), tiến trình phải chờ cho đến khi có tiến trình khác giải phóng semaphore. Việc mở khóa một semaphore được thực hiện bằng cách gọi *V*; hàm này sẽ làm tăng giá trị của semaphore và, nếu cần thiết, đánh thức các tiến trình đang chờ.

Khi semaphore được sử dụng để *mutual exclusion* (loại trừ lẫn nhau)—ngăn chặn nhiều tiến trình chạy đồng thời trong một vùng găng—giá trị ban đầu của chúng sẽ được đặt bằng 1. Một semaphore như vậy chỉ có thể được nắm giữ bởi một tiến trình hoặc luồng đơn lẻ tại bất kỳ thời điểm nào. Semaphore được sử dụng ở chế độ này đôi khi được gọi là *mutex*, tất nhiên đây là từ viết tắt của "mutual exclusion" (loại trừ lẫn nhau). Hầu hết mọi semaphore được tìm thấy trong Linux Kernel (nhân Linux) đều được sử dụng để loại trừ lẫn nhau.

### Triển khai Semaphore trong Linux

Linux Kernel cung cấp một cơ chế triển khai semaphore tuân theo các ngữ nghĩa nêu trên, mặc dù thuật ngữ có khác biệt đôi chút. Để sử dụng semaphore, mã nguồn kernel phải bao gồm *<asm/semaphore.h>*. Kiểu dữ liệu liên quan là struct semaphore; các semaphore thực tế có thể được khai báo và khởi động theo một vài cách. Một cách là tạo trực tiếp một semaphore, sau đó thiết lập nó bằng *sema_init*:

```c
void sema_init(struct semaphore *sem, int val);
```

trong đó val là giá trị ban đầu được gán cho semaphore.

Tuy nhiên, thông thường, semaphore được sử dụng ở chế độ mutex. Để làm cho trường hợp phổ biến này trở nên dễ dàng hơn một chút, kernel cung cấp một tập hợp các hàm trợ giúp (helper function) và macro. Do đó, một mutex có thể được khai báo và khởi tạo bằng một trong các cách sau:

```c
DECLARE_MUTEX(name);
DECLARE_MUTEX_LOCKED(name);
```

Ở đây, kết quả là một biến semaphore (được gọi là name) được khởi tạo thành 1 (với DECLARE_MUTEX) hoặc 0 (với DECLARE_MUTEX_LOCKED). Trong trường hợp sau, mutex bắt đầu ở trạng thái bị khóa (locked state); nó sẽ cần phải được mở khóa một cách tường minh trước khi bất kỳ luồng nào được phép truy cập.

Nếu mutex phải được khởi tạo tại thời điểm chạy (runtime) (ví dụ như khi nó được cấp phát động), hãy sử dụng một trong các hàm sau:

```c
init_MUTEX(struct semaphore *sem);
init_MUTEX_LOCKED(struct semaphore *sem);
```

Trong thế giới Linux, hàm *P* được gọi là *down*—hoặc một số biến thể của tên đó. Ở đây, "down" ám chỉ thực tế rằng hàm này làm giảm giá trị của semaphore và, có lẽ sau khi đưa tiến trình gọi nó đi ngủ một thời gian để chờ semaphore sẵn sàng, sẽ cấp quyền truy cập vào các tài nguyên được bảo vệ. Có ba phiên bản của *down*:

```c
void down(struct semaphore *sem);
int down_interruptible(struct semaphore *sem);
int down_trylock(struct semaphore *sem);
```

*down* làm giảm giá trị của semaphore và chờ đợi chừng nào còn cần thiết. *down_interruptible* cũng làm như vậy, nhưng thao tác này có thể bị ngắt (interruptible). Phiên bản có thể ngắt hầu như luôn là phiên bản bạn sẽ muốn dùng; nó cho phép một tiến trình ở User Space (không gian người dùng) đang chờ semaphore có thể bị ngắt bởi người dùng. Theo quy tắc chung, bạn không nên muốn sử dụng các thao tác không thể ngắt trừ khi thực sự không còn lựa chọn nào khác. Các thao tác không thể ngắt là một cách tốt để tạo ra các tiến trình không thể tiêu diệt (trạng thái "D state" đáng sợ được nhìn thấy trong *ps*) và làm phiền người dùng của bạn. Tuy nhiên, việc sử dụng *down_interruptible* đòi hỏi phải cẩn thận hơn một chút: nếu thao tác bị ngắt, hàm sẽ trả về một giá trị khác không, và tiến trình gọi *không* nắm giữ semaphore. Việc sử dụng đúng *down_interruptible* đòi hỏi phải luôn kiểm tra giá trị trả về và xử lý tương ứng.

Phiên bản cuối cùng (*down_trylock*) không bao giờ sleep; nếu semaphore không có sẵn tại thời điểm gọi, *down_trylock* trả về ngay lập tức với một giá trị trả về khác không.

Khi một luồng đã gọi thành công một trong các phiên bản của *down*, nó được cho là đang "nắm giữ" semaphore (hoặc đã "lấy ra" hoặc "thu giữ" semaphore). Luồng đó bây giờ có quyền truy cập vào vùng găng được bảo vệ bởi semaphore. Khi các thao tác yêu cầu loại trừ lẫn nhau hoàn tất, semaphore phải được trả lại. Tương đương với *V* trong Linux là *up*:

```c
void up(struct semaphore *sem);
```

Một khi hàm *up* được gọi, tiến trình gọi (caller) sẽ không còn nắm giữ semaphore (semaphore) đó nữa.

Như bạn có thể đoán trước, bất kỳ thread (thread) nào lấy ra một semaphore đều bắt buộc phải giải phóng nó bằng đúng một (và chỉ một) lần gọi hàm *up*. Cần đặc biệt cẩn thận trong các đường dẫn lỗi (error paths); nếu xảy ra lỗi trong khi một semaphore đang bị nắm giữ, semaphore đó phải được giải phóng trước khi trả về trạng thái lỗi cho tiến trình gọi. Quên giải phóng semaphore là một lỗi rất dễ mắc phải; hậu quả (các tiến trình bị treo ở những nơi có vẻ không liên quan) có thể rất khó tái tạo và truy vết.

### Sử dụng Semaphores trong scull

Cơ chế semaphore cung cấp cho *scull* một công cụ có thể được sử dụng để tránh tình trạng tranh chấp (race condition) trong khi truy cập cấu trúc dữ liệu `scull_dev`. Nhưng việc sử dụng công cụ đó một cách chính xác hoàn toàn phụ thuộc vào chúng ta. Chìa khóa để sử dụng đúng các nguyên hàm khóa (locking primitives) là xác định chính xác tài nguyên nào cần được bảo vệ và đảm bảo rằng mọi quyền truy cập vào các tài nguyên đó đều sử dụng cơ chế khóa phù hợp. Trong driver ví dụ của chúng ta, mọi thứ quan trọng đều nằm bên trong cấu trúc `scull_dev`, vì vậy đó là phạm vi hợp lý cho chế độ khóa của chúng ta.

Hãy nhìn lại cấu trúc đó một lần nữa:

```
struct scull_dev {
 struct scull_qset *data; /* Pointer to first quantum set */
 int quantum; /* the current quantum size */
 int qset; /* the current array size */
 unsigned long size; /* amount of data stored here */
 unsigned int access_key; /* used by sculluid and scullpriv */
 struct semaphore sem; /* mutual exclusion semaphore */
 struct cdev cdev; /* Char device structure */
};
```

Gần phía cuối cấu trúc là một thành viên có tên là `sem`, đây chính là semaphore của chúng ta. Chúng ta đã chọn sử dụng một semaphore riêng biệt cho mỗi thiết bị *scull* ảo. Việc sử dụng một semaphore toàn cục (global semaphore) duy nhất cũng sẽ đúng về mặt logic. Tuy nhiên, các thiết bị *scull* khác nhau không chia sẻ chung bất kỳ tài nguyên nào, và không có lý do gì để bắt một tiến trình phải chờ đợi trong khi một tiến trình khác đang làm việc với một thiết bị *scull* khác. Việc sử dụng một semaphore riêng biệt cho mỗi thiết bị cho phép các thao tác trên các thiết bị khác nhau được tiến hành song song và do đó, cải thiện hiệu năng (performance).

Semaphores phải được khởi tạo trước khi sử dụng. *scull* thực hiện việc khởi tạo này tại thời điểm nạp (load time) trong vòng lặp này:

```
 for (i = 0; i < scull_nr_devs; i++) {
 scull_devices[i].quantum = scull_quantum;
 scull_devices[i].qset = scull_qset;
 init_MUTEX(&scull_devices[i].sem);
 scull_setup_cdev(&scull_devices[i], i);
 }
```

Lưu ý rằng semaphore phải được khởi tạo *trước khi* thiết bị *scull* được làm cho sẵn sàng đối với phần còn lại của hệ thống. Do đó, *init\_MUTEX* được gọi trước *scull\_setup\_cdev*. Việc thực hiện các thao tác này theo thứ tự ngược lại sẽ tạo ra một tình trạng tranh chấp (race condition) trong đó semaphore có thể bị truy cập trước khi nó sẵn sàng.

Tiếp theo, chúng ta phải rà soát qua mã nguồn và đảm bảo rằng không có quyền truy cập nào vào cấu trúc dữ liệu `scull_dev` được thực hiện mà không nắm giữ semaphore. Do đó, ví dụ, hàm *scull\_write* bắt đầu bằng đoạn mã này:

```
 if (down_interruptible(&dev->sem))
 return -ERESTARTSYS;
```

Lưu ý việc kiểm tra giá trị trả về của *down\_interruptible*; nếu hàm này trả về giá trị khác không (nonzero), thao tác đã bị ngắt (interrupted). Việc thông thường nên làm trong tình huống này là trả về `-ERESTARTSYS`. Khi nhìn thấy mã trả về này, các tầng cao hơn của kernel sẽ hoặc là khởi động lại lời gọi từ đầu hoặc là trả về lỗi cho người dùng (user). Nếu bạn trả về `-ERESTARTSYS`, trước tiên bạn phải hoàn tác bất kỳ thay đổi nào có thể nhìn thấy đối với user (user-visible changes) đã được thực hiện, để hệ thống có thể xử lý đúng đắn khi system call (System Call) được thử lại. Nếu bạn không thể hoàn tác các thay đổi theo cách này, bạn nên trả về `-EINTR` thay thế.

*scull\_write* phải giải phóng semaphore cho dù nó có thể thực hiện thành công các tác vụ khác của mình hay không. Nếu mọi việc diễn ra tốt đẹp, luồng thực thi sẽ đi đến vài dòng cuối cùng của hàm:

```
out:
 up(&dev->sem);
 return retval;
```

Đoạn mã này giải phóng semaphore và trả về trạng thái tương ứng theo yêu cầu. Có một số nơi trong *scull\_write* mà mọi thứ có thể xảy ra lỗi; những lỗi này bao gồm lỗi cấp phát bộ nhớ (memory allocation failures) hoặc lỗi trang/ngoại lệ (fault) trong khi cố gắng sao chép dữ liệu từ không gian người dùng (User Space). Trong những trường hợp đó, mã nguồn thực hiện lệnh `goto out`, đảm bảo rằng việc dọn dẹp (cleanup) thích hợp được thực hiện.

```

### Reader/Writer Semaphores
Semaphore (Semaphore) thực hiện cơ chế loại trừ lẫn nhau (mutual exclusion) cho tất cả các tiến trình gọi (caller), bất kể mỗi luồng (thread) muốn làm gì. Tuy nhiên, nhiều tác vụ được chia thành hai loại công việc rõ rệt: các tác vụ chỉ cần đọc các cấu trúc dữ liệu được bảo vệ và các tác vụ phải thực hiện các thay đổi. Thường thì có thể cho phép nhiều người đọc đồng thời (concurrent readers), miễn là không ai cố gắng thực hiện bất kỳ thay đổi nào. Làm như vậy có thể tối ưu hóa hiệu năng đáng kể; các tác vụ chỉ đọc (read-only) có thể hoàn thành công việc của chúng một cách song song mà không phải chờ đợi những người đọc khác thoát khỏi vùng găng (critical section).

Linux kernel cung cấp một loại semaphore đặc biệt gọi là *rwsem* (hoặc "reader/writer semaphore") cho tình huống này. Việc sử dụng rwsem trong các driver là tương đối hiếm, nhưng chúng đôi khi rất hữu ích.

Mã nguồn sử dụng rwsem phải bao gồm *<linux/rwsem.h>*. Kiểu dữ liệu phù hợp cho semaphore đọc/ghi là `struct rw_semaphore`; một rwsem phải được khởi tạo tường minh (explicitly initialized) tại thời điểm chạy (runtime) với:

```

void init_rwsem(struct rw_semaphore *sem);

```

Một rwsem mới được khởi tạo sẽ sẵn sàng cho tác vụ tiếp theo (người đọc hoặc người viết) xuất hiện. Giao diện (interface) dành cho mã nguồn cần quyền truy cập chỉ đọc là:

```

void down_read(struct rw_semaphore *sem);
int down_read_trylock(struct rw_semaphore *sem);
void up_read(struct rw_semaphore *sem);

```

Một lời gọi đến *down\_read* cung cấp quyền truy cập chỉ đọc vào các tài nguyên được bảo vệ, có thể đồng thời với những người đọc khác. Lưu ý rằng *down\_read* có thể đưa tiến trình gọi (calling process) vào trạng thái ngủ không thể ngắt (uninterruptible sleep). *down\_read\_trylock* sẽ không chờ đợi nếu quyền truy cập đọc không khả dụng; nó trả về giá trị khác không nếu quyền truy cập được cấp, và 0 nếu ngược lại. Lưu ý rằng quy ước cho *down\_read\_trylock* khác với hầu hết các hàm trong kernel, nơi sự thành công được biểu thị bằng giá trị trả về là 0. Một rwsem lấy được bằng *down\_read* cuối cùng phải được giải phóng bằng *up\_read*.

Giao diện dành cho người viết (writer) cũng tương tự:

```

void down_write(struct rw_semaphore *sem);
int down_write_trylock(struct rw_semaphore *sem);
void up_write(struct rw_semaphore *sem);
void downgrade_write(struct rw_semaphore *sem);

```

*down\_write*, *down\_write\_trylock* và *up\_write* đều hoạt động giống như các hàm tương ứng dành cho người đọc, ngoại trừ việc chúng cung cấp quyền truy cập ghi. Nếu bạn có một tình huống cần khóa ghi (writer lock) cho một thay đổi nhanh chóng, tiếp theo là khoảng thời gian dài hơn chỉ đọc, bạn có thể sử dụng *downgrade\_write* để cho phép những người đọc khác vào sau khi bạn đã hoàn tất việc thực hiện các thay đổi.

Một rwsem cho phép hoặc một người viết hoặc một số lượng không giới hạn những người đọc nắm giữ semaphore. Người viết được ưu tiên; ngay khi một người viết cố gắng bước vào vùng găng (critical section), sẽ không có người đọc nào được phép vào cho đến khi tất cả người viết hoàn thành công việc của họ. Việc thực thi này có thể dẫn đến hiện tượng *starvation* (đói tài nguyên) của người đọc—nơi những người đọc bị từ chối quyền truy cập trong một thời gian dài—nếu bạn có một số lượng lớn người viết đang tranh chấp (contend) semaphore. Vì lý do này, rwsem được sử dụng tốt nhất khi quyền truy cập ghi chỉ hiếm khi được yêu cầu và quyền truy cập ghi được giữ trong khoảng thời gian ngắn.

## Completions
Một mẫu thiết kế phổ biến trong lập trình kernel liên quan đến việc khởi tạo một hoạt động nào đó bên ngoài luồng hiện tại (current thread), sau đó chờ đợi hoạt động đó hoàn thành. Hoạt động này có thể là việc tạo một kernel thread mới hoặc user-space process, một yêu cầu gửi đến một tiến trình hiện có, hoặc một loại hành động dựa trên phần cứng nào đó. Trong những trường hợp như vậy, việc sử dụng semaphore để đồng bộ hóa (synchronization) hai tác vụ có vẻ hấp dẫn, với đoạn mã như:

```

struct semaphore sem;
init_MUTEX_LOCKED(&sem);
start_external_task(&sem);
down(&sem);

```

Tác vụ bên ngoài sau đó có thể gọi `up(&sem)` khi công việc của nó hoàn thành.

Hóa ra, semaphore không phải là công cụ tốt nhất để sử dụng trong tình huống này. Trong sử dụng thông thường, mã nguồn cố gắng khóa (lock) một semaphore sẽ thấy semaphore đó khả dụng gần như mọi lúc; nếu có sự tranh chấp đáng kể đối với semaphore, hiệu năng sẽ suy giảm và lược đồ khóa (locking scheme) cần phải được xem xét lại. Vì vậy, các semaphore đã được tối ưu hóa mạnh mẽ cho trường hợp "khả dụng" (available). Tuy nhiên, khi được sử dụng để thông báo việc hoàn thành tác vụ theo cách hiển thị ở trên, luồng gọi *down* hầu như sẽ luôn phải chờ đợi; hiệu năng sẽ suy giảm tương ứng. Semaphore cũng có thể gặp phải tình trạng *race condition* (điều kiện tranh đua) (khó phát hiện) khi được sử dụng theo cách này nếu chúng được khai báo là biến tự động (automatic variables). Trong một số trường hợp, semaphore có thể biến mất trước khi tiến trình gọi *up* hoànmã nguồn sử dụng nó xong.

Những mối quan ngại này đã truyền cảm hứng cho việc bổ sung giao diện "completion" trong kernel phiên bản 2.4.7. Completion là một cơ chế gọn nhẹ (lightweight mechanism) với một nhiệm vụ duy nhất: cho phép một luồng thông báo cho luồng khác rằng công việc đã hoàn thành. Để sử dụng completion, mã nguồn của bạn phải bao gồm *<linux/completion.h>*. Một completion có thể được tạo bằng:

```

DECLARE_COMPLETION(my_completion);

```

Hoặc, nếu completion phải được tạo và khởi tạo một cách động (dynamically):

```

struct completion my_completion;
/* ... */
init_completion(&my_completion);

```

Việc chờ đợi hoàn thành (completion) được thực hiện đơn giản bằng cách gọi:

```

void wait_for_completion(struct completion *c);

```

Lưu ý rằng hàm này thực hiện một thao tác chờ không thể ngắt (uninterruptible wait). Nếu mã nguồn của bạn gọi *wait\_for\_completion* mà không có ai hoàn thành tác vụ đó, kết quả sẽ là một tiến trình (process) không thể tiêu diệt.\*

Ở phía bên kia, sự kiện hoàn thành thực tế có thể được phát tín hiệu (signal) bằng cách gọi một trong các hàm sau:

```

void complete(struct completion *c);
void complete_all(struct completion *c);

```

Hai hàm này hoạt động khác nhau nếu có nhiều hơn một luồng (thread) đang chờ cùng một sự kiện hoàn thành. *complete* chỉ đánh thức một trong các luồng đang chờ, trong khi *complete\_all* cho phép tất cả các luồng tiếp tục chạy. Trong hầu hết các trường hợp, chỉ có một tiến trình/luồng chờ (waiter), và hai hàm này sẽ tạo ra kết quả giống hệt nhau.

Một completion thông thường là một thiết bị dùng một lần (one-shot device); nó được sử dụng một lần rồi bị hủy bỏ. Tuy nhiên, có thể tái sử dụng các cấu trúc completion nếu cẩn thận. Nếu không sử dụng *complete\_all*, cấu trúc completion có thể được tái sử dụng mà không gặp bất kỳ vấn đề gì miễn là không có sự mơ hồ về sự kiện nào đang được phát tín hiệu. Tuy nhiên, nếu bạn sử dụng *complete\_all*, bạn phải khởi tạo lại cấu trúc completion trước khi tái sử dụng nó. Macro:

```

INIT_COMPLETION(struct completion c);

```

có thể được sử dụng để thực hiện việc khởi tạo lại này một cách nhanh chóng.

Như một ví dụ về cách sử dụng completion, hãy xem xét module *complete*, được bao gồm trong mã nguồn ví dụ. Module này định nghĩa một thiết bị có ngữ nghĩa đơn giản: bất kỳ tiến trình nào cố gắng đọc (read) từ thiết bị sẽ phải chờ (sử dụng *wait\_for\_completion*)

 Tại thời điểm viết bài này, các bản vá (patch) bổ sung các phiên bản có thể ngắt đang được lưu hành nhưng chưa được hợp nhất (merge) vào nhánh chính (mainline).

cho đến khi một tiến trình khác ghi (write) vào thiết bị. Mã nguồn triển khai hành vi này là:

```

DECLARE_COMPLETION(comp);
ssize_t complete_read (struct file *filp, char __user *buf, size_t count, loff_t
*pos)
{
printk(KERN_DEBUG "process %i (%s) going to sleep\n",
current->pid, current->comm);
wait_for_completion(&comp);
printk(KERN_DEBUG "awoken %i (%s)\n", current->pid, current->comm);
return 0; /* EOF */
}
ssize_t complete_write (struct file *filp, const char __user *buf, size_t count,
loff_t *pos)
{
printk(KERN_DEBUG "process %i (%s) awakening the readers...\n",
current->pid, current->comm);
complete(&comp);
return count; /* succeed, to avoid retrial */
}

```

Có thể có nhiều tiến trình cùng "đọc" từ thiết bị này tại một thời điểm. Mỗi thao tác ghi vào thiết bị sẽ khiến đúng một thao tác đọc hoàn thành, nhưng không có cách nào để biết đó sẽ là tiến trình nào.

Một cách sử dụng điển hình của cơ chế completion là kết thúc luồng kernel (kernel thread termination) tại thời điểm thoát module (module exit time). Trong trường hợp mẫu, một phần hoạt động bên trong của trình điều khiển (driver) được thực hiện bởi một kernel thread trong vòng lặp `while (1)`. Khi module sẵn sàng để dọn dẹp, hàm thoát (exit function) sẽ ra lệnh cho luồng thoát và sau đó chờ hoàn thành. Nhằm mục đích này, kernel bao gồm một hàm cụ thể để luồng sử dụng:

void complete\_and\_exit(struct completion \*c, long retval);

## Spinlocks (Khóa quay)
Semaphore là một công cụ hữu ích để loại trừ lẫn nhau (mutual exclusion), nhưng chúng không phải là công cụ duy nhất thuộc loại này được cung cấp bởi kernel. Thay vào đó, hầu hết việc khóa được thực hiện bằng một cơ chế gọi là *spinlock*. Không giống như semaphore, spinlock có thể được sử dụng trong mã nguồn không thể ngủ (code that cannot sleep), chẳng hạn như trình xử lý ngắt (interrupt handler). Khi được sử dụng đúng cách, spinlock mang lại hiệu suất cao hơn semaphore nói chung. Tuy nhiên, chúng đi kèm với một tập hợp các ràng buộc khác nhau khi sử dụng.

Spinlock rất đơn giản về mặt khái niệm. Spinlock là một thiết bị loại trừ lẫn nhau chỉ có thể có hai giá trị: "đã khóa" (locked) và "đã mở khóa" (unlocked). Nó thường được triển khai dưới dạng một bit duy nhất trong một giá trị số nguyên. Mã nguồn muốn chiếm một khóa cụ thể sẽ kiểm tra bit có liên quan. Nếu khóa khả dụng, bit "đã khóa" được thiết lập và mã nguồn tiếp tục đi vào vùng găng (critical section). Ngược lại, nếu khóa đã bị chiếm bởi người khác, mã nguồn sẽ đi vào

một vòng lặp chặt (tight loop) nơi nó liên tục kiểm tra khóa cho đến khi khóa khả dụng. Vòng lặp này chính là phần "quay" (spin) của một spinlock.

Tất nhiên, việc triển khai thực tế của một spinlock phức tạp hơn một chút so với mô tả ở trên. Thao tác "kiểm tra và thiết lập" (test and set) phải được thực hiện một cách nguyên tử (atomic manner) để chỉ một luồng có thể nhận được khóa, ngay cả khi có vài luồng đang quay tại bất kỳ thời điểm nào. Cũng phải cẩn thận để tránh tình trạng bế tắc (deadlock) trên các chip xử lý *hyperthreaded* - những chip triển khai nhiều CPU ảo chia sẻ chung một lõi xử lý và bộ nhớ cache. Vì vậy, việc triển khai spinlock thực tế là khác nhau đối với mọi kiến trúc mà Linux hỗ trợ. Tuy nhiên, cốt lõi khái niệm là giống nhau trên tất cả các hệ thống: khi có sự tranh chấp (contention) về spinlock, các bộ xử lý đang chờ sẽ thực hiện một vòng lặp chặt và không hoàn thành công việc hữu ích nào.

Bản thân spinlock được thiết kế để sử dụng trên các hệ thống đa bộ xử lý (multiprocessor systems), mặc dù một máy trạm đơn xử lý (uniprocessor workstation) chạy kernel có khả năng ưu tiên (preemptive kernel) hoạt động giống như SMP (Symmetric Multiprocessing), xét về mặt đồng thời (concurrency). Nếu một hệ thống đơn xử lý không có khả năng ưu tiên mà rơi vào trạng thái quay trên một khóa, nó sẽ quay mãi mãi; không có luồng nào khác có thể giành được CPU để giải phóng khóa. Vì lý do này, các thao tác spinlock trên hệ thống đơn xử lý không bật tính năng ưu tiên được tối ưu hóa để không làm gì cả, ngoại trừ các thao tác thay đổi trạng thái che ngắt (IRQ masking status). Do tính năng ưu tiên (preemption), ngay cả khi bạn không bao giờ mong đợi mã của mình chạy trên hệ thống SMP, bạn vẫn cần triển khai việc khóa đúng cách.

### Giới thiệu về Spinlock API
Tệp bao hàm (include file) bắt buộc cho các nguyên hàm spinlock (spinlock primitives) là *<linux/spinlock.h>*. Một khóa thực tế có kiểu dữ liệu là `spinlock_t`. Giống như bất kỳ cấu trúc dữ liệu nào khác, một spinlock phải được khởi tạo. Việc khởi tạo này có thể được thực hiện tại thời điểm biên dịch (compile time) như sau:

```c

spinlock_t my_lock = SPIN_LOCK_UNLOCKED;

```

hoặc tại thời điểm chạy (runtime) với:

```c

void spin_lock_init(spinlock_t *lock);

```

Trước khi bước vào vùng tới hạn (critical section), mã nguồn của bạn phải lấy được khóa cần thiết bằng hàm:

```c

void spin_lock(spinlock_t *lock);

```

Lưu ý rằng tất cả các thao tác chờ spinlock, theo bản chất của chúng, đều không thể ngắt (uninterruptible). Một khi bạn gọi *spin\_lock*, bạn sẽ quay vòng (spin) cho đến khi khóa khả dụng.

Để giải phóng một khóa mà bạn đã có được, hãy truyền nó vào:

```c

void spin_unlock(spinlock_t *lock);

```

Có rất nhiều hàm spinlock khác, và chúng ta sẽ xem xét tất cả chúng trong thời gian ngắn tới. Nhưng không có hàm nào đi chệch khỏi ý tưởng cốt lõi được thể hiện qua các hàm được liệt kê ở trên. Có rất ít việc mà người ta có thể làm với một khóa, ngoài việc khóa và giải phóng nó. Tuy nhiên, có một vài quy tắc về cách bạn phải làm việc với spinlocks. Chúng ta sẽ dành chút thời gian để xem xét những quy tắc đó trước khi đi vào giao diện spinlock đầy đủ.

### Spinlocks và Ngữ cảnh Nguyên tử (Atomic Context)
Hãy tưởng tượng trong giây lát rằng trình điều khiển (driver) của bạn có được một spinlock và thực hiện công việc của nó bên trong vùng tới hạn (critical section). Ở đâu đó ở giữa, trình điều khiển của bạn mất bộ vi xử lý (processor). Có lẽ nó đã gọi một hàm (chẳng hạn như *copy\_from\_user*) đưa tiến trình (process) vào trạng thái ngủ (sleep). Hoặc, có lẽ, tính năng tiền chiếm quyền nhân kernel preemption bắt đầu hoạt động, và một tiến trình có độ ưu tiên cao hơn đẩy mã nguồn của bạn sang một bên. Mã nguồn của bạn bây giờ đang giữ một khóa mà nó sẽ không giải phóng trong bất kỳ thời gian nào có thể thấy trước. Nếu một luồng (thread) khác cố gắng lấy cùng một khóa đó, trong trường hợp tốt nhất, nó sẽ chờ (quay vòng trong bộ vi xử lý) trong một thời gian rất dài. Trong trường hợp xấu nhất, hệ thống có thể bị deadlock (bế tắc) hoàn toàn.

Hầu hết độc giả sẽ đồng ý rằng kịch bản này tốt nhất nên tránh. Do đó, quy tắc cốt lõi áp dụng cho spinlocks là bất kỳ mã nguồn nào cũng phải ở trạng thái nguyên tử (atomic) trong khi giữ một spinlock. Nó không thể ngủ (sleep); trên thực tế, nó không thể nhường bộ vi xử lý vì bất kỳ lý do gì ngoại trừ việc phục vụ ngắt (interrupt) (và đôi khi thậm chí không thể ngay cả khi đó).

Trường hợp tiền chiếm quyền nhân (kernel preemption) được xử lý bởi chính mã nguồn spinlock. Bất cứ khi nào mã nhân giữ một spinlock, tính năng tiền chiếm quyền bị vô hiệu hóa trên bộ xử lý liên quan. Ngay cả các hệ thống đơn xử lý (uniprocessor) cũng phải vô hiệu hóa tiền chiếm quyền theo cách này để tránh tình trạng tranh chấp điều kiện (race conditions). Đó là lý do tại sao việc khóa đúng cách là bắt buộc ngay cả khi bạn không bao giờ mong đợi mã nguồn của mình chạy trên máy đa xử lý (multiprocessor).

Việc tránh ngủ (sleep) trong khi giữ khóa có thể khó khăn hơn; nhiều hàm nhân có thể ngủ, và hành vi này không phải lúc nào cũng được tài liệu hóa rõ ràng. Sao chép dữ liệu đến hoặc đi từ vùng nhớ người dùng (user space) là một ví dụ rõ ràng: trang nhớ (page) không gian người dùng được yêu cầu có thể cần phải được hoán đổi (swap) từ đĩa trước khi việc sao chép có thể tiếp tục, và thao tác đó rõ ràng đòi hỏi một giấc ngủ. Hầu như bất kỳ thao tác nào phải cấp phát bộ nhớ đều có thể ngủ; *kmalloc* có thể quyết định từ bỏ bộ vi xử lý và chờ bộ nhớ trống khả dụng trừ khi nó được hướng dẫn rõ ràng là không làm vậy. Giấc ngủ có thể xảy ra ở những nơi bất ngờ; việc viết mã sẽ thực thi dưới một spinlock đòi hỏi phải chú ý đến mọi hàm mà bạn gọi.

Đây là một kịch bản khác: trình điều khiển của bạn đang thực thi và vừa lấy được một khóa điều khiển quyền truy cập vào thiết bị của nó. Trong khi khóa đang được giữ, thiết bị phát ra một ngắt, khiến trình xử lý ngắt (interrupt handler) của bạn chạy. Trình xử lý ngắt, trước khi truy cập thiết bị, cũng phải lấy được khóa. Việc lấy spinlock trong trình xử lý ngắt là một việc hợp lệ; đó là một trong những lý do tại sao các thao tác spinlock không ngủ. Nhưng điều gì xảy ra nếu chương trình con ngắt thực thi trên cùng một bộ xử lý với mã nguồn đã lấy khóa ban đầu? Trong khi trình xử lý ngắt đang quay vòng (spinning), mã không phải ngắt sẽ không thể chạy để giải phóng khóa. Bộ xử lý đó sẽ quay vòng mãi mãi.

Để tránh cái bẫy này, cần phải vô hiệu hóa các ngắt (chỉ trên CPU cục bộ) trong khi spinlock được giữ. Có các biến thể của hàm spinlock sẽ vô hiệu hóa ngắt cho bạn (chúng ta sẽ thấy chúng ở phần tiếp theo). Tuy nhiên, một cuộc thảo luận đầy đủ về ngắt phải đợi đến Chương 10.

Quy tắc quan trọng cuối cùng đối với việc sử dụng spinlock là spinlocks phải luôn được giữ trong thời gian ngắn nhất có thể. Bạn càng giữ khóa lâu, thì một bộ xử lý khác càng phải chờ lâu để bạn giải phóng nó, và cơ hội nó phải quay vòng (spin) càng lớn. Thời gian giữ khóa lâu cũng ngăn cản bộ xử lý hiện tại lên lịch (scheduling), nghĩa là một tiến trình có độ ưu tiên cao hơn — thực sự nên được nhận CPU — có thể phải đợi. Các nhà phát triển nhân đã nỗ lực rất nhiều để giảm độ trễ của nhân (kernel latency - thời gian mà một tiến trình có thể phải đợi để được lên lịch) trong chuỗi phát triển 2.5. Một trình điều khiển được viết kém có thể xóa sạch toàn bộ tiến trình đó chỉ bằng cách giữ khóa quá lâu. Để tránh tạo ra loại vấn đề này, hãy chú ý giữ thời gian giữ khóa của bạn ở mức ngắn.

### Các hàm Spinlock
Chúng ta đã tìm hiểu hai hàm là *spin\_lock* và *spin\_unlock* dùng để thao tác với spinlock (khóa quay). Tuy nhiên, có một số hàm khác có tên và mục đích tương tự. Bây giờ chúng ta sẽ trình bày toàn bộ tập hợp này. Phần thảo luận này sẽ dẫn chúng ta đến những nội dung mà ta chưa thể nắm bắt hoàn toàn trong một vài chương tới; việc hiểu rõ toàn diện về Spinlock API đòi hỏi phải hiểu về xử lý ngắt (interrupt handling) và các khái niệm liên quan.

Thực tế có bốn hàm có thể khóa một spinlock:

```c

void spin_lock(spinlock_t *lock);
void spin_lock_irqsave(spinlock_t *lock, unsigned long flags);
void spin_lock_irq(spinlock_t *lock);
void spin_lock_bh(spinlock_t *lock)

```

Chúng ta đã biết *spin\_lock* hoạt động như thế nào. *spin\_lock\_irqsave* thực hiện vô hiệu hóa các ngắt (chỉ trên bộ vi xử lý cục bộ - local processor) trước khi lấy spinlock; trạng thái ngắt trước đó được lưu trữ trong biến `flags`. Nếu bạn hoàn toàn chắc chắn rằng không có tiến trình/đoạn mã nào khác đã vô hiệu hóa ngắt trên bộ xử lý của bạn (nói cách khác, bạn chắc chắn rằng mình nên bật lại ngắt khi giải phóng spinlock), bạn có thể sử dụng *spin\_lock\_irq* thay thế mà không cần phải theo dõi biến `flags`. Cuối cùng, *spin\_lock\_bh* vô hiệu hóa các ngắt phần mềm (software interrupts) trước khi lấy khóa, nhưng vẫn cho phép các ngắt phần cứng (hardware interrupts) hoạt động.

Nếu bạn có một spinlock có thể bị chiếm giữ bởi mã chạy trong ngữ cảnh ngắt (interrupt context - phần cứng hoặc phần mềm), bạn phải sử dụng một trong các biến thể của *spin\_lock* có tính năng vô hiệu hóa ngắt. Nếu không làm như vậy, hệ thống có thể sớm hay muộn rơi vào trạng thái bế tắc (deadlock). Nếu bạn không truy cập khóa của mình trong trình xử lý ngắt phần cứng (hardware interrupt handler), nhưng lại truy cập thông qua ngắt phần mềm (chẳng hạn như trong đoạn mã chạy từ tasklet, một chủ đề được đề cập trong Chương 7), bạn có thể sử dụng *spin\_lock\_bh* để tránh deadlock một cách an toàn trong khi vẫn cho phép các ngắt phần cứng được phục vụ.

Cũng có bốn cách để giải phóng một spinlock; phương thức bạn sử dụng phải tương ứng với hàm mà bạn đã dùng để lấy khóa đó:

```c

void spin_unlock(spinlock_t *lock);
void spin_unlock_irqrestore(spinlock_t *lock, unsigned long flags);
void spin_unlock_irq(spinlock_t *lock);
void spin_unlock_bh(spinlock_t *lock);

```

Mỗi biến thể *spin\_unlock* sẽ hoàn tác công việc mà hàm *spin\_lock* tương ứng đã thực hiện. Đối số `flags` được truyền cho *spin\_unlock\_irqrestore* bắt buộc phải là cùng một biến đã được truyền cho *spin\_lock\_irqsave*. Bạn cũng phải gọi *spin\_lock\_irqsave* và *spin\_unlock\_irqrestore* trong cùng một hàm; nếu không, mã nguồn của bạn có thể bị lỗi trên một số kiến trúc phần cứng (architectures).

Ngoài ra còn có một tập hợp các thao tác spinlock không chặn (nonblocking):

```c

int spin_trylock(spinlock_t *lock);
int spin_trylock_bh(spinlock_t *lock);

```

Các hàm này trả về giá trị khác không khi thành công (đã lấy được khóa), và trả về 0 trong trường hợp ngược lại. Không có phiên bản "try" nào thực hiện việc vô hiệu hóa ngắt.

### Reader/Writer Spinlocks (Khóa quay Đọc/Ghi)
Kernel cung cấp một dạng khóa quay (spinlock) đọc/giữ quyền ghi (reader/writer), tương tự trực tiếp với các semaphore đọc/ghi mà chúng ta đã thấy trước đó trong chương này. Các khóa này cho phép bất kỳ số lượng tiến trình đọc nào cùng lúc truy cập vào một vùng găng (critical section), nhưng các tiến trình ghi (writer) phải có quyền truy cập độc quyền. Khóa đọc/ghi có kiểu dữ liệu `rwlock_t`, được định nghĩa trong *<linux/spinlock.h>*. Chúng có thể được khai báo và khởi tạo theo hai cách:

```

rwlock_t my_rwlock = RW_LOCK_UNLOCKED; /* Cách tĩnh */
rwlock_t my_rwlock;
rwlock_init(&my_rwlock); /* Cách động */

```

Danh sách các hàm khả dụng lúc này sẽ trông khá quen thuộc. Đối với các tiến trình đọc, các hàm sau đây được hỗ trợ:

```

void read_lock(rwlock_t *lock);
void read_lock_irqsave(rwlock_t *lock, unsigned long flags);
void read_lock_irq(rwlock_t *lock);
void read_lock_bh(rwlock_t *lock);
void read_unlock(rwlock_t *lock);
void read_unlock_irqrestore(rwlock_t *lock, unsigned long flags);
void read_unlock_irq(rwlock_t *lock);
void read_unlock_bh(rwlock_t *lock);

```

Điều thú vị là không có hàm *read\_trylock*.

```

Các hàm dành cho quyền truy cập ghi cũng tương tự:

```

```

void write_lock(rwlock_t *lock);
void write_lock_irqsave(rwlock_t *lock, unsigned long flags);

```

```

void write_lock_irq(rwlock_t *lock);
void write_lock_bh(rwlock_t *lock);
int write_trylock(rwlock_t *lock);
void write_unlock(rwlock_t *lock);
void write_unlock_irqrestore(rwlock_t *lock, unsigned long flags);
void write_unlock_irq(rwlock_t *lock);
void write_unlock_bh(rwlock_t *lock);

```

Khóa đọc/ghi có thể gây đói tài nguyên (starvation) đối với tiến trình đọc giống như cách hoạt động của `rwsem`. Hành vi này hiếm khi là một vấn đề lớn; tuy nhiên, nếu có sự tranh chấp khóa (lock contention) đủ lớn để dẫn đến tình trạng đói tài nguyên, hiệu năng hệ thống dù sao đi nữa cũng sẽ rất kém.

## Locking Traps (Những cạm bẫy khi sử dụng khóa)
Nhiều năm kinh nghiệm làm việc với các cơ chế khóa — kinh nghiệm có từ trước cả Linux — đã cho thấy rằng việc triển khai khóa chính xác là một thử thách rất lớn. Quản lý tính đồng thời (concurrency) bản chất là một công việc phức tạp và có rất nhiều cách để mắc lỗi. Trong phần này, chúng ta sẽ điểm qua nhanh những sự cố có thể xảy ra.

### Ambiguous Rules (Quy tắc mơ hồ)
Như đã đề cập ở trên, một lược đồ khóa (locking scheme) đúng đắn đòi hỏi phải có các quy tắc rõ ràng và tường minh. Khi bạn tạo ra một tài nguyên có thể được truy cập đồng thời, bạn phải xác định rõ khóa nào sẽ kiểm soát quyền truy cập đó. Việc thiết kế khóa nên được lên kế hoạch ngay từ đầu; việc cố gắng bổ sung khóa vào sau đó có thể rất khó khăn. Thời gian đầu tư vào giai đoạn đầu thường sẽ mang lại kết quả đền đáp xứng đáng trong quá trình gỡ lỗi (debugging).

Khi viết mã nguồn, chắc chắn bạn sẽ gặp một số hàm đều yêu cầu quyền truy cập vào các cấu trúc được bảo vệ bởi một khóa cụ thể. Tại thời điểm này, bạn phải rất cẩn thận: nếu một hàm đã chiếm giữ một khóa (acquire a lock) và sau đó gọi một hàm khác cũng cố gắng chiếm giữ chính khóa đó, mã nguồn của bạn sẽ bị deadlock (treo deadlock). Cả semaphore lẫn spinlock đều không cho phép một tiến trình đang giữ khóa có thể chiếm giữ lại khóa đó lần thứ hai; nếu bạn cố gắng làm như vậy, hệ thống sẽ bị treo.

Để cơ chế khóa hoạt động chính xác, bạn phải viết một số hàm với giả định rằng hàm gọi chúng đã chiếm giữ (acquire) khóa liên quan từ trước. Thông thường, chỉ các hàm nội bộ và tĩnh (static) của bạn mới có thể được viết theo cách này; các hàm được gọi từ bên ngoài phải xử lý việc khóa một cách rõ ràng. Khi bạn viết các hàm nội bộ đưa ra các giả định về việc khóa, hãy làm ơn cho chính mình (và bất kỳ ai khác làm việc với mã nguồn của bạn) và ghi chép lại các giả định đó một cách tường minh. Sẽ rất khó khăn nếu sau nhiều tháng quay lại và phải tìm xem bạn có cần giữ khóa để gọi một hàm cụ thể nào đó hay không.

Trong trường hợp của *scull*, quyết định thiết kế được đưa ra là yêu cầu tất cả các hàm được gọi trực tiếp từ các System Call phải chiếm giữ semaphore áp dụng cho cấu trúc thiết bị

đang được truy cập. Tất cả các hàm nội bộ, vốn chỉ được gọi từ các hàm *scull* khác, khi đó có thể mặc định rằng semaphore đã được chiếm giữ đúng cách.

### Quy tắc Thứ tự Khóa (Lock Ordering Rules)
Trong các hệ thống có số lượng lớn các khóa (lock) (và kernel đang dần trở thành một hệ thống như vậy), việc mã nguồn cần giữ (hold) nhiều hơn một khóa cùng lúc là điều không hiếm gặp. Nếu một dạng tính toán nào đó phải được thực hiện bằng cách sử dụng hai tài nguyên khác nhau, mỗi tài nguyên lại có khóa riêng của nó, thì thường không có cách nào khác ngoài việc phải chiếm giữ (acquire) cả hai khóa.

Tuy nhiên, việc lấy nhiều khóa có thể rất nguy hiểm. Nếu bạn có hai khóa, gọi là *Lock1* và *Lock2*, và đoạn mã cần phải chiếm giữ cả hai cùng một lúc, bạn sẽ phải đối mặt với nguy cơ deadlock (tắc nghẽn). Hãy tưởng tượng một thread (luồng) khóa *Lock1* trong khi một thread khác đồng thời chiếm lấy *Lock2*. Sau đó, mỗi thread cố gắng lấy cái mà nó chưa có. Cả hai thread sẽ bị deadlock.

Giải pháp cho vấn đề này thường khá đơn giản: khi phải chiếm giữ nhiều khóa, chúng phải luôn được lấy theo cùng một thứ tự. Miễn là quy tắc này tuân thủ, các deadlock đơn giản như trường hợp được mô tả ở trên có thể được tránh khỏi. Tuy nhiên, việc tuân thủ các quy tắc thứ tự khóa nói dễ hơn làm. Rất hiếm khi các quy tắc như vậy thực sự được viết ra ở bất kỳ đâu. Thường thì cách tốt nhất bạn có thể làm là xem các đoạn mã khác đang xử lý thế nào.

Một vài quy tắc kinh nghiệm (rule of thumb) có thể hữu ích. Nếu bạn phải lấy một khóa cục bộ (local) trong đoạn mã của mình (ví dụ như khóa thiết bị - device lock) cùng với một khóa thuộc về một phần trung tâm hơn của kernel, hãy lấy khóa của bạn trước. Nếu bạn có sự kết hợp giữa semaphore và spinlock, tất nhiên bạn phải lấy (các) semaphore trước; việc gọi hàm `down` (có thể gây sleep) trong khi đang giữ một spinlock là một lỗi cực kỳ nghiêm trọng. Nhưng hơn hết, hãy cố gắng tránh các tình huống mà bạn cần nhiều hơn một khóa.

### Khóa Mịn (Fine-Grained) so với Khóa Thô (Coarse-Grained)
Kernel Linux đầu tiên hỗ trợ hệ thống đa xử lý (multiprocessor) là phiên bản 2.0; nó chỉ chứa đúng một spinlock duy nhất. *Big kernel lock* (khóa nhân lớn) đã biến toàn bộ kernel thành một vùng critical section (miền găng) lớn duy nhất; chỉ một CPU có thể thực thi mã kernel tại bất kỳ thời điểm nào. Khóa này giải quyết vấn đề đồng thời (concurrency) đủ tốt để cho phép các nhà phát triển kernel giải quyết tất cả các vấn đề khác liên quan đến việc hỗ trợ SMP. Nhưng nó lại không có khả năng mở rộng (scale) tốt. Ngay cả một hệ thống hai bộ xử lý cũng có thể dành một lượng thời gian đáng kể chỉ để chờ đợi big kernel lock. Hiệu năng của một hệ thống bốn bộ xử lý thậm chí còn không bằng một phần của bốn cỗ máy độc lập.

Vì vậy, các phiên bản kernel tiếp theo đã bao gồm cơ chế khóa mịn hơn (finer-grained locking). Trong phiên bản 2.2, một spinlock kiểm soát quyền truy cập vào hệ thống con I/O khối (block I/O subsystem); một spinlock khác hoạt động cho mạng, v.v. Một kernel hiện đại có thể chứa hàng ngàn khóa, mỗi khóa bảo vệ một tài nguyên nhỏ. Loại khóa mịn này rất tốt cho khả năng mở rộng (scalability); nó cho phép mỗi bộ xử lý làm việc trên tác vụ cụ thể của mình mà không phải tranh chấp (contend) các khóa được sử dụng bởi các bộ xử lý khác. Rất ít người cảm thấy tiếc nuối big kernel lock.\*

Tuy nhiên, khóa mịn cũng đi kèm với cái giá của nó. Trong một kernel với hàng ngàn khóa, việc biết được bạn cần những khóa nào—và theo thứ tự nào bạn nên chiếm giữ chúng—để thực hiện một thao tác cụ thể có thể trở nên rất khó khăn. Hãy nhớ rằng các lỗi liên quan đến khóa (locking bug) có thể rất khó phát hiện; có nhiều khóa hơn đồng nghĩa với việc tạo thêm cơ hội cho các lỗi khóa thực sự tồi tệ lẻn vào kernel. Khóa mịn có thể mang lại mức độ phức tạp mà về lâu dài, sẽ có tác động xấu lớn đến khả năng bảo trì (maintainability) của kernel.

Việc khóa trong trình điều khiển thiết bị (device driver) thường tương đối đơn giản; bạn có thể có một khóa duy nhất bao trùm mọi thứ bạn làm, hoặc bạn có thể tạo một khóa cho mỗi thiết bị mà bạn quản lý. Theo nguyên tắc chung, bạn nên bắt đầu với cơ chế khóa tương đối thô (coarse locking) trừ khi bạn có lý do thực sự để tin rằng sự tranh chấp khóa (lock contention) có thể là một vấn đề. Hãy chống lại sự thôi thúc tối ưu hóa quá sớm; các ràng buộc hiệu năng thực tế thường xuất hiện ở những nơi bất ngờ.

Nếu bạn thực sự nghi ngờ rằng sự tranh chấp khóa đang làm giảm hiệu năng, bạn có thể thấy công cụ *lockmeter* rất hữu ích. Bản vá này (có sẵn tại *http://oss.sgi.com/projects/lockmeter/*) thiết bị hóa (instrument) kernel để đo lường thời gian dành ra để chờ trong các khóa. Bằng cách xem xét báo cáo, bạn có thể nhanh chóng xác định xem sự tranh chấp khóa có thực sự là vấn đề hay không.

## Các Giải pháp Thay thế cho Khóa (Alternatives to Locking)
Kernel Linux cung cấp một số primitive khóa mạnh mẽ có thể được sử dụng để ngăn kernel tự vấp ngã. Nhưng như chúng ta đã thấy, thiết kế và cài đặt của một lược đồ khóa (locking scheme) không phải là không có cạm bẫy. Thường thì không có giải pháp thay thế nào cho semaphore và spinlock; chúng có thể là cách duy nhất để hoàn thành công việc một cách chính xác. Tuy nhiên, có những tình huống mà việc truy cập nguyên tử (atomic access) có thể được thiết lập mà không cần đến cơ chế khóa toàn diện. Phần này xem xét các cách khác để thực hiện công việc đó.

## Các thuật toán không dùng khóa (Lock-Free Algorithms)

Đôi khi, bạn có thể thiết kế lại các thuật toán của mình để loại bỏ hoàn toàn nhu cầu sử dụng khóa (locking). Một số tình huống đọc/ghi (reader/writer) — nếu chỉ có một tiến trình ghi (writer) — thường có thể hoạt động theo cách này. Nếu người ghi cẩn thận đảm bảo rằng cấu trúc dữ liệu luôn ở trạng thái nhất quán từ góc nhìn của người đọc (reader), thì hoàn toàn có thể xây dựng một cấu trúc dữ liệu không dùng khóa (lock-free data structure).

Một cấu trúc dữ liệu thường rất hữu ích cho các tác vụ sản xuất/tiêu thụ (producer/consumer) không dùng khóa là *bản đệm vòng* (circular buffer). Thuật toán này liên quan đến việc một tiến trình sản xuất (producer) đặt dữ liệu vào một đầu của một

Khóa này vẫn tồn tại trong phiên bản 2.6, mặc dù hiện tại nó bao phủ rất ít phần của kernel. Nếu bạn vô tình bắt gặp một lời gọi hàm `lock_kernel`, tức là bạn đã tìm thấy Khóa Kernel Lớn (Big Kernel Lock - BKL). Tuy nhiên, đừng bao giờ nghĩ đến việc sử dụng nó trong bất kỳ mã nguồn mới nào.

mảng, trong khi tiến trình tiêu thụ (consumer) lấy dữ liệu ra từ đầu kia. Khi đến cuối mảng, tiến trình sản xuất sẽ quay vòng trở lại từ đầu. Do đó, một bản đệm vòng yêu cầu một mảng và hai giá trị chỉ số (index) để theo dõi vị trí đặt giá trị mới tiếp theo và giá trị nào nên được lấy ra khỏi bản đệm tiếp theo.

Khi được triển khai cẩn thận, một bản đệm vòng không yêu cầu khóa nếu không có nhiều tiến trình sản xuất hoặc tiêu thụ cùng hoạt động. Tiến trình sản xuất là luồng (thread) duy nhất được phép sửa đổi chỉ số ghi (write index) và vị trí mảng mà nó trỏ tới. Miễn là người ghi lưu một giá trị mới vào bản đệm trước khi cập nhật chỉ số ghi, người đọc sẽ luôn nhìn thấy một góc nhìn nhất quán. Ngược lại, người đọc là luồng duy nhất có thể truy cập chỉ số đọc (read index) và giá trị mà nó trỏ tới. Chỉ cần cẩn trọng một chút để đảm bảo rằng hai con trỏ không vượt qua mặt nhau (overrun), tiến trình sản xuất và tiêu thụ có thể truy cập bản đệm đồng thời mà không gặp phải tình trạng tranh chấp dữ liệu (race condition).

Hình 5-1 minh họa bản đệm vòng ở một số trạng thái chứa dữ liệu khác nhau. Bản đệm này được định nghĩa sao cho trạng thái trống (empty) được biểu thị bằng việc con trỏ đọc và con trỏ ghi bằng nhau, trong khi trạng thái đầy (full) xảy ra bất cứ khi nào con trỏ ghi nằm ngay phía sau con trỏ đọc (cần chú ý tính toán đến trường hợp quay vòng!). Khi được lập trình cẩn thận, bản đệm này có thể được sử dụng mà không cần đến khóa.

```text

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │░░░░░░░░░░░░░░░░░│    │                 │
│                 │    │░░░░░░░░░░░░░░░░░│    │                 │
│                 │    │░░░░░░░░░░░░░░░░░│    │                 │
│  Read ───────→  │    │░░░░░░░░░░░░░░░░░│    │                 │
│░░░░░░░░░░░░░░░░░│    │  Write ────────→│    │                 │
│░░░░░░░░░░░░░░░░░│    │  Read  ────────→│    │  Write ────────→│
│░░░░░░░░░░░░░░░░░│    │░░░░░░░░░░░░░░░░░│    │  Read  ────────→│
│░░░░░░░░░░░░░░░░░│    │░░░░░░░░░░░░░░░░░│    │                 │
│░░░░░░░░░░░░░░░░░│    │░░░░░░░░░░░░░░░░░│    │                 │
│  Write ────────→│    │░░░░░░░░░░░░░░░░░│    │                 │
│                 │    │░░░░░░░░░░░░░░░░░│    │                 │
│                 │    │░░░░░░░░░░░░░░░░░│    │                 │
│                 │    │░░░░░░░░░░░░░░░░░│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
Bản đệm vòng          Bản đệm đầy           Bản đệm trống

░ = dữ liệu (đã điền)    (trắng) = không gian trống

```

*Hình 5-1. Bản đệm vòng*

Bản đệm vòng xuất hiện khá thường xuyên trong các trình điều khiển thiết bị (device drivers). Đặc biệt, các bộ điều hợp mạng (networking adapters) thường sử dụng bản đệm vòng để trao đổi dữ liệu (các gói tin) với bộ xử lý. Lưu ý rằng, kể từ phiên bản 2.6.10, đã có sẵn một triển khai bản đệm vòng tổng quát (generic circular buffer) trong kernel; hãy tham khảo *<linux/kfifo.h>* để biết thông tin về cách sử dụng nó.

### Biến Nguyên tử (Atomic Variables)

Đôi khi, một tài nguyên chia sẻ (shared resource) chỉ đơn thuần là một giá trị số nguyên (integer). Giả sử driver của bạn duy trì một biến chia sẻ `n_op` cho biết có bao nhiêu thao tác thiết bị (device operations) hiện đang chưa hoàn thành. Thông thường, ngay cả một thao tác đơn giản như:

`n_op++;`

cũng sẽ yêu cầu cơ chế khóa (locking). Một số bộ xử lý (processors) có thể thực hiện thao tác tăng giá trị đó theo cách nguyên tử (atomic manner), nhưng bạn không thể trông chờ hoàn toàn vào điều đó. Tuy nhiên, một cơ chế khóa đầy đủ lại có vẻ quá cồng kềnh (overhead) cho một giá trị số nguyên đơn giản. Đối với những trường hợp như vậy, nhân hệ điều hành (kernel) cung cấp một kiểu số nguyên nguyên tử gọi là `atomic_t`, được định nghĩa trong *<asm/atomic.h>*.

Một `atomic_t` chứa một giá trị `int` trên tất cả các kiến trúc (architectures) được hỗ trợ. Tuy nhiên, do cách thức hoạt động của kiểu dữ liệu này trên một số bộ xử lý, toàn bộ dải số nguyên (integer range) có thể không khả dụng; do đó, bạn không nên kỳ vọng một `atomic_t` có thể lưu trữ nhiều hơn 24 bit. Các thao tác sau đây được định nghĩa cho kiểu dữ liệu này và được đảm bảo là mang tính nguyên tử (atomic) đối với tất cả các bộ xử lý của một máy tính SMP (Symmetric Multiprocessing). Các thao tác này rất nhanh, bởi vì chúng được biên dịch thành một lệnh máy đơn lẻ (single machine instruction) bất cứ khi nào có thể.

```c

void atomic_set(atomic_t *v, int i);
atomic_t v = ATOMIC_INIT(0);

```

Thiết lập biến nguyên tử `v` thành giá trị số nguyên `i`. Bạn cũng có thể khởi tạo các giá trị nguyên tử tại thời điểm biên dịch (compile time) bằng macro `ATOMIC_INIT`.

```c

int atomic_read(atomic_t *v);
Trả về giá trị hiện tại của v.

```

```c

void atomic_add(int i, atomic_t *v);

```

Cộng `i` vào biến nguyên tử được trỏ tới bởi `v`. Giá trị trả về là `void`, bởi vì việc trả về giá trị mới sẽ phát sinh thêm chi phí (extra cost), và phần lớn thời gian chúng ta không cần thiết phải biết giá trị đó.

```c

void atomic_sub(int i, atomic_t *v);
Trừ i khỏi *v.

```

```c

void atomic_inc(atomic_t *v);
void atomic_dec(atomic_t *v);

```

Tăng hoặc giảm một biến nguyên tử.

```c

int atomic_inc_and_test(atomic_t *v);
int atomic_dec_and_test(atomic_t *v);
int atomic_sub_and_test(int i, atomic_t *v);

```

Thực hiện thao tác được chỉ định và kiểm tra kết quả; nếu sau khi thực hiện thao tác, giá trị nguyên tử bằng 0, thì giá trị trả về là true (đúng); ngược lại, là false (sai). Lưu ý rằng không có hàm *atomic_add_and_test*.

```c

int atomic_add_negative(int i, atomic_t *v);

```

Cộng biến số nguyên `i` vào `v`. Giá trị trả về là true nếu kết quả là số âm, và false trong các trường hợp khác.

```c

int atomic_add_return(int i, atomic_t *v);
int atomic_sub_return(int i, atomic_t *v);
int atomic_inc_return(atomic_t *v);
int atomic_dec_return(atomic_t *v);

```

Hoạt động giống hệt như *atomic_add* và các hàm tương tự, ngoại trừ việc chúng trả về giá trị mới của biến nguyên tử cho hàm gọi (caller).

Như đã trình bày trước đó, các mục dữ liệu `atomic_t` chỉ được phép truy cập thông qua các hàm này. Nếu bạn truyền một mục dữ liệu nguyên tử vào một hàm mong đợi một đối số là số nguyên thông thường, bạn sẽ gặp lỗi trình biên dịch (compiler error).

Bạn cũng nên ghi nhớ rằng các giá trị `atomic_t` chỉ hoạt động hiệu quả khi số lượng được đề cập thực sự mang tính nguyên tử. Các thao tác đòi hỏi nhiều biến `atomic_t` vẫn cần phải sử dụng một số hình thức khóa khác. Hãy xem xét đoạn mã sau:

```c

atomic_sub(amount, &first_atomic);
atomic_add(amount, &second_atomic);

```

Có một khoảng thời gian mà `amount` đã bị trừ khỏi biến nguyên tử thứ nhất nhưng vẫn chưa được cộng vào biến thứ hai. Nếu trạng thái này có thể gây ra rắc rối cho mã nguồn chạy xen kẽ giữa hai thao tác trên, thì một hình thức khóa nào đó bắt buộc phải được sử dụng.

### Các Thao tác Bit (Bit Operations)

Kiểu `atomic_t` rất phù hợp để thực hiện các phép toán số học trên số nguyên (integer arithmetic). Tuy nhiên, nó lại không hoạt động tốt khi bạn cần thao tác trên từng bit một cách nguyên tử (atomic manner). Thay vào đó, nhân hệ thống (kernel) cung cấp một tập hợp các hàm có khả năng sửa đổi hoặc kiểm tra từng bit một cách nguyên tử cho mục đích này. Do toàn bộ thao tác diễn ra trong một bước duy nhất, không ngắt (interrupt) hay bộ xử lý (processor) nào khác có thể gây can thiệp.

Các thao tác bit nguyên tử (atomic bit operations) rất nhanh, vì chúng thực hiện thao tác bằng cách sử dụng một lệnh máy đơn lẻ (single machine instruction) mà không cần vô hiệu hóa ngắt (disable interrupts) bất cứ khi nào nền tảng bên dưới hỗ trợ điều đó. Các hàm này phụ thuộc vào kiến trúc (architecture dependent) và được khai báo trong *<asm/bitops.h>*. Chúng được đảm bảo tính nguyên tử ngay cả trên các máy tính đa xử lý đối xứng (SMP computers) và rất hữu ích trong việc duy trì tính đồng nhất (coherence) giữa các bộ xử lý.

Đáng tiếc là việc định kiểu dữ liệu (data typing) trong các hàm này cũng phụ thuộc vào kiến trúc. Đối số `nr` (mô tả bit nào cần thao tác) thường được định nghĩa là `int`, nhưng lại là `unsigned long` đối với một số ít kiến trúc. Địa chỉ cần sửa đổi thường là một con trỏ kiểu `unsigned long`, nhưng một số ít kiến trúc lại sử dụng `void *`.

Các thao tác bit khả dụng bao gồm:

```c

void set_bit(nr, void *addr);

```

Thiết lập (set) bit số `nr` trong vùng dữ liệu được trỏ tới bởi `addr`.

```c

void clear_bit(nr, void *addr);

```

Xóa (clear) bit được chỉ định trong dữ liệu kiểu `unsigned long` nằm tại `addr`. Về mặt ngữ nghĩa, các điểm khác đều giống với `set_bit`.

```c

void change_bit(nr, void *addr);

```

Đảo trạng thái (toggle) của bit.

```c

test_bit(nr, void *addr);

```

Hàm này là thao tác bit duy nhất không cần phải mang tính nguyên tử; nó đơn giản là trả về giá trị hiện tại của bit đó.

```c

int test_and_set_bit(nr, void *addr);
int test_and_clear_bit(nr, void *addr);
int test_and_change_bit(nr, void *addr);

```

Hoạt động một cách nguyên tử tương tự như các hàm được liệt kê trước đó, điểm khác biệt là chúng đồng thời trả về giá trị trước đó của bit.

Khi các hàm này được sử dụng để truy cập và sửa đổi một cờ chia sẻ (shared flag), bạn không phải làm gì ngoài việc gọi chúng; chúng thực hiện các thao tác của mình theo cách nguyên tử. Ngược lại, việc sử dụng các thao tác bit để quản lý một biến khóa (lock variable) nhằm kiểm soát quyền truy cập vào một biến được chia sẻ (shared variable) thì phức tạp hơn một chút và cần có một ví dụ minh họa. Hầu hết mã nguồn hiện đại không sử dụng các thao tác bit theo cách này, nhưng các đoạn mã giống như dưới đây vẫn tồn tại trong kernel.

Một đoạn mã cần truy cập vào một mục dữ liệu được chia sẻ (shared data item) sẽ cố gắng chiếm giữ một khóa (lock) một cách nguyên tử bằng cách sử dụng `test_and_set_bit` hoặc `test_and_clear_bit`. Triển khai thông thường được minh họa ở đây; nó giả định rằng khóa nằm ở bit `nr` của địa chỉ `addr`. Nó cũng giả định rằng bit có giá trị bằng 0 khi khóa rảnh (free) hoặc khác không khi khóa đang bận (busy).

```c

/* thử thiết lập khóa */
while (test_and_set_bit(nr, addr) != 0)
wait_for_a_while( );
/* thực hiện công việc của bạn */
/* nhả khóa, và kiểm tra... */
if (test_and_clear_bit(nr, addr) == 0)
something_went_wrong( ); /* đã bị nhả trước đó: lỗi */

```

Nếu bạn đọc qua mã nguồn kernel, bạn sẽ tìm thấy các đoạn mã hoạt động giống như ví dụ này. Tuy nhiên, sẽ tốt hơn rất nhiều nếu sử dụng các spinlock trong mã nguồn mới; spinlock đã được gỡ lỗi (debug) kỹ càng, chúng xử lý tốt các vấn đề như ngắt và tính cướp quyền của nhân (kernel preemption), và những người khác khi đọc mã nguồn của bạn sẽ không phải mất công tìm hiểu xem bạn đang làm gì.

### seqlocks

Kernel 2.6 chứa một vài cơ chế mới nhằm cung cấp quyền truy cập nhanh, không dùng khóa (lockless) vào một tài nguyên được chia sẻ (shared resource). Seqlocks hoạt động trong các tình huống mà tài nguyên cần bảo vệ có kích thước nhỏ, đơn giản, được truy cập thường xuyên, và việc truy cập ghi (write access) rất hiếm khi xảy ra nhưng đòi hỏi phải thực hiện nhanh chóng. Về cơ bản, chúng hoạt động bằng cách cho phép các luồng đọc (readers) truy cập tự do vào tài nguyên nhưng yêu cầu các luồng đọc đó phải kiểm tra xung đột (collisions) với các luồng ghi (writers), và khi xung đột xảy ra, chúng phải thực hiện lại (retry) quá trình truy cập của mình. Nhìn chung, seqlocks không thể được sử dụng để bảo vệ các cấu trúc dữ liệu có chứa con trỏ (pointers), bởi vì luồng đọc có thể đang đi theo một con trỏ không hợp lệ trong khi luồng ghi đang thay đổi cấu trúc dữ liệu đó.

Seqlocks được định nghĩa trong *<linux/seqlock.h>*. Có hai phương pháp thông thường để khởi tạo một seqlock (có kiểu `seqlock_t`):

```c

seqlock_t lock1 = SEQLOCK_UNLOCKED;
seqlock_t lock2;
seqlock_init(&lock2);

```

Quyền truy cập đọc (read access) hoạt động bằng cách lấy một giá trị chuỗi số nguyên (integer sequence value) (không dấu) khi bước vào vùng găng (critical section). Khi rời khỏi, giá trị chuỗi đó được so sánh với giá trị hiện tại; nếu có sự không khớp (mismatch), quyền truy cập đọc phải được thực hiện lại. Kết quả là, mã nguồn của luồng đọc sẽ có dạng như sau:

```c

unsigned int seq;
do {
seq = read_seqbegin(&the_lock);
/* Thực hiện những gì bạn cần làm */
} while (read_seqretry(&the_lock, seq));

```

Loại khóa này thường được sử dụng để bảo vệ một số loại tính toán đơn giản đòi hỏi nhiều giá trị nhất quán. Nếu bài kiểm tra ở cuối quá trình tính toán cho thấy một thao tác ghi đồng thời (concurrent write) đã xảy ra, các kết quả có thể đơn giản là bị loại bỏ và tính toán lại.

Nếu seqlock của bạn có thể được truy cập từ một trình xử lý ngắt (interrupt handler), bạn nên sử dụng các phiên bản an toàn với ngắt (IRQ-safe) thay thế:

```c

unsigned int read_seqbegin_irqsave(seqlock_t *lock,
unsigned long flags);
int read_seqretry_irqrestore(seqlock_t *lock, unsigned int seq,
unsigned long flags);

```

Các luồng ghi phải lấy được một khóa độc quyền (exclusive lock) để bước vào vùng găng được bảo vệ bởi seqlock. Để làm điều đó, hãy gọi:

```c

void write_seqlock(seqlock_t *lock);

```

Khóa ghi được triển khai bằng một spinlock, vì vậy tất cả các ràng buộc thông thường đều được áp dụng. Hãy gọi:

```c

void write_sequnlock(seqlock_t *lock);

```

để nhả khóa (release the lock). Vì spinlocks được sử dụng để kiểm soát quyền truy cập ghi, tất cả các biến thể thông thường đều có sẵn:

```c

void write_seqlock_irqsave(seqlock_t *lock, unsigned long flags);
void write_seqlock_irq(seqlock_t *lock);
void write_seqlock_bh(seqlock_t *lock);
void write_sequnlock_irqrestore(seqlock_t *lock, unsigned long flags);
void write_sequnlock_irq(seqlock_t *lock);
void write_sequnlock_bh(seqlock_t *lock);

```

Ngoài ra còn có hàm *write\_tryseqlock* trả về giá trị khác không nếu nó có thể lấy được khóa.

### Read-Copy-Update
Read-copy-update (RCU) là một cơ chế loại trừ lẫn nhau (mutual exclusion scheme) nâng cao, có thể mang lại hiệu suất cao trong các điều kiện phù hợp. Việc sử dụng nó trong các trình điều khiển thiết bị (drivers) rất hiếm nhưng không phải là không có, vì vậy việc tổng quan nhanh về nó ở đây là rất đáng giá. Những ai quan tâm đến toàn bộ chi tiết của thuật toán RCU có thể tìm thấy chúng trong tài liệu trắng (white paper) do chính tác giả công bố (*http://www.rdrop.com/users/paulmck/rclock/intro/rclock\_intro.html*).

RCU áp dụng một số ràng buộc đối với loại cấu trúc dữ liệu mà nó có thể bảo vệ. Nó được tối ưu hóa cho các tình huống mà các thao tác đọc diễn ra phổ biến và thao tác ghi hiếm khi xảy ra. Các tài nguyên được bảo vệ nên được truy cập thông qua con trỏ (pointers), và mọi tham chiếu đến các tài nguyên đó chỉ được nắm giữ bởi mã nguồn có tính nguyên tử (atomic code). Khi cấu trúc dữ liệu cần được thay đổi, luồng ghi (writing thread) sẽ tạo ra một bản sao, thay đổi bản sao đó, sau đó hướng con trỏ liên quan đến phiên bản mới—do đó có tên gọi của thuật toán. Khi kernel chắc chắn rằng không còn tham chiếu nào đến phiên bản cũ tồn tại, nó có thể giải phóng phiên bản đó.

Như một ví dụ về việc sử dụng RCU trong thế giới thực, hãy xem xét các bảng định tuyến mạng (network routing tables). Mỗi gói tin đi ra (outgoing packet) đòi hỏi phải kiểm tra các bảng định tuyến để xác định giao diện nào nên được sử dụng. Việc kiểm tra diễn ra nhanh chóng, và một khi kernel đã tìm thấy giao diện đích, nó không cần đến mục nhập bảng định tuyến (routing table entry) đó nữa. RCU cho phép thực hiện việc tra cứu tuyến đường (route lookups) mà không cần khóa (locking), mang lại những lợi ích đáng kể về hiệu suất. Trình điều khiển IP vô tuyến Star-mode trong kernel cũng sử dụng RCU để theo dõi danh sách các thiết bị của nó.

Mã nguồn sử dụng RCU nên bao gồm tệp tiêu đề *<linux/rcupdate.h>*.

Về phía đọc (read side), mã nguồn sử dụng cấu trúc dữ liệu được bảo vệ bởi RCU nên bao bọc các tham chiếu của nó bằng các lệnh gọi *rcu\_read\_lock* và *rcu\_read\_unlock*. Kết quả là, mã nguồn RCU thường có dạng như sau:

```

struct my_stuff *stuff;
rcu_read_lock( );
stuff = find_the_stuff(args...);
do_something_with(stuff);
rcu_read_unlock( );

```

Lệnh gọi *rcu\_read\_lock* diễn ra rất nhanh; nó vô hiệu hóa tính năng tiền chiếm quyền của kernel (kernel preemption) nhưng không đợi bất cứ điều gì. Đoạn mã thực thi trong khi "khóa" đọc được giữ phải mang tính nguyên tử (atomic). Không có tham chiếu nào đến tài nguyên được bảo vệ được phép sử dụng sau lệnh gọi *rcu\_read\_unlock*.

Mã nguồn cần thay đổi cấu trúc được bảo vệ phải thực hiện một vài bước. Phần đầu tiên rất đơn giản; nó cấp phát một cấu trúc mới, sao chép dữ liệu từ cấu trúc cũ nếu cần thiết, sau đó thay thế con trỏ mà mã đọc nhìn thấy. Tại thời điểm này, đối với phía đọc, việc thay đổi đã hoàn tất; bất kỳ đoạn mã nào đi vào vùng tới hạn (critical section) đều nhìn thấy phiên bản dữ liệu mới.

Tất cả những gì còn lại là giải phóng phiên bản cũ. Vấn đề, tất nhiên, là mã nguồn đang chạy trên các bộ vi xử lý (processors) khác có thể vẫn đang giữ tham chiếu đến dữ liệu cũ hơn, vì vậy nó không thể được giải phóng ngay lập tức. Thay vào đó, mã ghi phải đợi cho đến khi nó biết rằng không có tham chiếu nào như vậy

có thể tồn tại. Vì tất cả mã nguồn nắm giữ các tham chiếu đến cấu trúc dữ liệu này phải (theo quy tắc) mang tính nguyên tử, chúng ta biết rằng một khi mọi bộ vi xử lý trên hệ thống đã được lên lịch (scheduled) ít nhất một lần, tất cả các tham chiếu chắc chắn đã biến mất. Vì vậy, đó là những gì RCU làm; nó thiết lập một hàm gọi lại (callback) chờ đợi cho đến khi tất cả các bộ vi xử lý đã được lên lịch; hàm gọi lại đó sau đó được chạy để thực hiện công việc dọn dẹp (cleanup work).

Mã nguồn thay đổi cấu trúc dữ liệu được bảo vệ bằng RCU phải lấy hàm gọi lại dọn dẹp của nó bằng cách cấp phát một struct rcu\_head, mặc dù nó không cần phải khởi tạo cấu trúc đó theo bất kỳ cách nào. Thông thường, cấu trúc đó được nhúng đơn giản bên trong tài nguyên lớn hơn được bảo vệ bởi RCU. Sau khi thay đổi đối với tài nguyên đó hoàn tất, một lệnh gọi nên được thực hiện tới:

```

void call_rcu(struct rcu_head *head, void (*func)(void *arg), void *arg);

```

Hàm func được chỉ định sẽ được gọi khi việc giải phóng tài nguyên là an toàn; nó được truyền cùng một đối số arg đã được truyền cho *call\_rcu*. Thông thường, việc duy nhất func cần làm là gọi *kfree*.

Giao diện RCU đầy đủ phức tạp hơn những gì chúng ta đã thấy ở đây; ví dụ, nó bao gồm các hàm tiện ích để làm việc với các danh sách liên kết được bảo vệ (protected linked lists). Hãy xem các tệp tiêu đề liên quan để biết toàn bộ chi tiết.

## Tóm tắt nhanh (Quick Reference)
Chương này đã giới thiệu một tập hợp đáng kể các ký hiệu để quản lý tính đồng thời (concurrency). Các ký hiệu quan trọng nhất trong số đó được tóm tắt ở đây:

```

## include <asm/semaphore.h>

```

Tệp tiêu đề định nghĩa semaphore và các thao tác trên chúng.

```

DECLARE_MUTEX(name);
DECLARE_MUTEX_LOCKED(name);

```

Hai macro để khai báo và khởi tạo một semaphore được sử dụng ở chế độ loại trừ lẫn nhau (mutual exclusion mode).

```

void init_MUTEX(struct semaphore *sem);
void init_MUTEX_LOCKED(struct semaphore *sem);

```

Hai hàm này có thể được sử dụng để khởi tạo một semaphore tại thời điểm chạy (runtime).

```

void down(struct semaphore *sem);
int down_interruptible(struct semaphore *sem);
int down_trylock(struct semaphore *sem);
void up(struct semaphore *sem);

```

Khóa và mở khóa một semaphore. *down* đưa tiến trình gọi (calling process) vào trạng thái ngủ không thể ngắt (uninterruptible sleep) nếu cần thiết; ngược lại, *down\_interruptible* có thể bị ngắt bởi một tín hiệu (signal). *down\_trylock* không đi ngủ; thay vào đó, nó trả về ngay lập tức nếu semaphore không khả dụng. Mã nguồn khóa semaphore cuối cùng phải mở khóa nó bằng *up*.

```c

struct rw_semaphore;
init_rwsem(struct rw_semaphore *sem);
Phiên bản semaphore (semaphore) dành cho người đọc/người viết (reader/writer) và hàm khởi tạo nó.
void down_read(struct rw_semaphore *sem);
int down_read_trylock(struct rw_semaphore *sem);
void up_read(struct rw_semaphore *sem);
Các hàm dùng để lấy và giải phóng quyền truy cập đọc đối với semaphore đọc/viết (reader/writer semaphore).
void down_write(struct rw_semaphore *sem)
int down_write_trylock(struct rw_semaphore *sem)
void up_write(struct rw_semaphore *sem)
void downgrade_write(struct rw_semaphore *sem)
Các hàm dùng để quản lý quyền truy cập viết đối với semaphore đọc/viết (reader/writer semaphore).

## include <linux/completion.h>

DECLARE_COMPLETION(name);
init_completion(struct completion *c);
INIT_COMPLETION(struct completion c);
Tệp tiêu đề (include file) mô tả cơ chế hoàn thành (completion mechanism) của Linux và các phương thức thông thường
để khởi tạo các completion. `INIT_COMPLETION` chỉ nên được sử dụng để khởi tạo lại một completion
đã được sử dụng trước đó.
void wait_for_completion(struct completion *c);
Chờ một sự kiện hoàn thành (completion event) được phát tín hiệu (signal).
void complete(struct completion *c);
void complete_all(struct completion *c);
Phát tín hiệu cho một sự kiện hoàn thành. `complete` đánh thức tối đa một thread đang chờ, trong khi
`complete_all` đánh thức tất cả các thread đang chờ (waiter).
void complete_and_exit(struct completion *c, long retval);
Phát tín hiệu sự kiện hoàn thành bằng cách gọi `complete` và gọi `exit` cho thread hiện tại.

## include <linux/spinlock.h>

spinlock_t lock = SPIN_LOCK_UNLOCKED;
spin_lock_init(spinlock_t *lock);
Tệp tiêu đề định nghĩa giao diện spinlock (spinlock interface) và hai cách khởi tạo
khóa (lock).
void spin_lock(spinlock_t *lock);
void spin_lock_irqsave(spinlock_t *lock, unsigned long flags);
void spin_lock_irq(spinlock_t *lock);
void spin_lock_bh(spinlock_t *lock);
Các cách khác nhau để khóa một spinlock và, nếu có thể, vô hiệu hóa ngắt (disable interrupts).

```

```c

int spin_trylock(spinlock_t *lock);
int spin_trylock_bh(spinlock_t *lock);
Các phiên bản không-quay (nonspinning) của các hàm trên; chúng trả về 0 trong trường hợp không thể lấy được
khóa, và trả về giá trị khác 0 nếu thành công.
void spin_unlock(spinlock_t *lock);
void spin_unlock_irqrestore(spinlock_t *lock, unsigned long flags);
void spin_unlock_irq(spinlock_t *lock);
void spin_unlock_bh(spinlock_t *lock);
Các cách tương ứng để giải phóng một spinlock.
rwlock_t lock = RW_LOCK_UNLOCKED
rwlock_init(rwlock_t *lock);
Hai cách khởi tạo khóa đọc/viết (reader/writer lock).
void read_lock(rwlock_t *lock);
void read_lock_irqsave(rwlock_t *lock, unsigned long flags);
void read_lock_irq(rwlock_t *lock);
void read_lock_bh(rwlock_t *lock);
Các hàm dùng để lấy quyền truy cập đọc đối với khóa đọc/viết (reader/writer lock).
void read_unlock(rwlock_t *lock);
void read_unlock_irqrestore(rwlock_t *lock, unsigned long flags);
void read_unlock_irq(rwlock_t *lock);
void read_unlock_bh(rwlock_t *lock);
Các hàm dùng để giải phóng quyền truy cập đọc đối với spinlock đọc/viết (reader/writer spinlock).
void write_lock(rwlock_t *lock);
void write_lock_irqsave(rwlock_t *lock, unsigned long flags);
void write_lock_irq(rwlock_t *lock);
void write_lock_bh(rwlock_t *lock);
Các hàm dùng để lấy quyền truy cập viết đối với khóa đọc/viết (reader/writer lock).
void write_unlock(rwlock_t *lock);
void write_unlock_irqrestore(rwlock_t *lock, unsigned long flags);
void write_unlock_irq(rwlock_t *lock);
void write_unlock_bh(rwlock_t *lock);

```

Các hàm dùng để giải phóng quyền truy cập viết đối với spinlock đọc/viết (reader/writer spinlock).

```c

## include <asm/atomic.h>

atomic_t v = ATOMIC_INIT(value);
void atomic_set(atomic_t *v, int i);
int atomic_read(atomic_t *v);
void atomic_add(int i, atomic_t *v);
void atomic_sub(int i, atomic_t *v);
void atomic_inc(atomic_t *v);
void atomic_dec(atomic_t *v);
int atomic_inc_and_test(atomic_t *v);
int atomic_dec_and_test(atomic_t *v);
int atomic_sub_and_test(int i, atomic_t *v);
int atomic_add_negative(int i, atomic_t *v);
int atomic_add_return(int i, atomic_t *v);
int atomic_sub_return(int i, atomic_t *v);
int atomic_inc_return(atomic_t *v);
int atomic_dec_return(atomic_t *v);
Truy cập các biến số nguyên một cách nguyên tử (atomically). Các biến `atomic_t` phải được truy cập
chỉ thông qua các hàm này.

## include <asm/bitops.h>

void set_bit(nr, void *addr);
void clear_bit(nr, void *addr);
void change_bit(nr, void *addr);
test_bit(nr, void *addr);
int test_and_set_bit(nr, void *addr);
int test_and_clear_bit(nr, void *addr);
int test_and_change_bit(nr, void *addr);
Truy cập các giá trị bit một cách nguyên tử; chúng có thể được sử dụng cho các cờ (flags) hoặc biến khóa (lock variables). Sử dụng
các hàm này giúp ngăn chặn bất kỳ tình trạng tranh chấp dữ liệu (race condition) nào liên quan đến việc truy cập đồng thời vào bit.

## include <linux/seqlock.h>

seqlock_t lock = SEQLOCK_UNLOCKED;
seqlock_init(seqlock_t *lock);
Tệp tiêu đề định nghĩa seqlock (seqlock) và hai cách khởi tạo chúng.
unsigned int read_seqbegin(seqlock_t *lock);
unsigned int read_seqbegin_irqsave(seqlock_t *lock, unsigned long flags);
int read_seqretry(seqlock_t *lock, unsigned int seq);
int read_seqretry_irqrestore(seqlock_t *lock, unsigned int seq, unsigned long
flags);

```

Các hàm để lấy quyền truy cập đọc (read access) đối với tài nguyên được bảo vệ bằng seqlock.

```

void write_seqlock(seqlock_t *lock);
void write_seqlock_irqsave(seqlock_t *lock, unsigned long flags);
void write_seqlock_irq(seqlock_t *lock);
void write_seqlock_bh(seqlock_t *lock);
int write_tryseqlock(seqlock_t *lock);
Các hàm để lấy quyền truy cập ghi (write access) đối với tài nguyên được bảo vệ bằng seqlock.
void write_sequnlock(seqlock_t *lock);
void write_sequnlock_irqrestore(seqlock_t *lock, unsigned long flags);
void write_sequnlock_irq(seqlock_t *lock);
void write_sequnlock_bh(seqlock_t *lock);
Các hàm để giải phóng quyền truy cập ghi đối với tài nguyên được bảo vệ bằng seqlock.

## include <linux/rcupdate.h>

Tệp tiêu đề (include file) cần thiết để sử dụng cơ chế Read-Copy-Update (RCU).
void rcu_read_lock;
void rcu_read_unlock;
Các macro để lấy quyền truy cập đọc nguyên tử (atomic read access) đối với tài nguyên được bảo vệ bởi RCU.
void call_rcu(struct rcu_head *head, void (*func)(void *arg), void *arg);
Sắp xếp để một hàm gọi lại (callback) chạy sau khi tất cả các bộ xử lý (processors) đã được lên lịch (scheduled) và tài nguyên được bảo vệ bởi RCU có thể được giải phóng một cách an toàn.

```
