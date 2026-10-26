## Mục Lục

- [Lời tựa](#foreword)
- [Lời nói đầu](#preface)
- [Giới thiệu về sách](#about-the-book)
- [Tóm tắt các chương](#summary-of-chapters)
- [Lời cảm ơn](#acknowledgments)
- [Về tác giả](#about-the-author)
- [Chương 1. Giới thiệu](#chapter-1-introduction)
- [Chương 2. Khám phá bên trong Kernel](#chapter-2-a-peek-inside-the-kernel)
- [Chương 3. Các cơ chế của Kernel](#chapter-3-kernel-facilities)
- [Chương 4. Đặt nền móng](#chapter-4-laying-the-groundwork)
- [Chương 5. Trình điều khiển thiết bị ký tự](#chapter-5-character-drivers)
- [Chương 6. Trình điều khiển cổng nối tiếp](#chapter-6-serial-drivers)
- [Chương 7. Trình điều khiển thiết bị đầu vào](#chapter-7-input-drivers)
- [Chương 8. Giao thức Inter-Integrated Circuit](#chapter-8-the-inter-integrated-circuit-protocol)
- [Chương 9. PCMCIA và Compact Flash](#chapter-9-pcmcia-and-compact-flash)
- [Chương 10. Peripheral Component Interconnect](#chapter-10-peripheral-component-interconnect)
- [Chương 11. Universal Serial Bus](#chapter-11-universal-serial-bus)
- [Chương 12. Trình điều khiển video](#chapter-12-video-drivers)
- [Chương 17. Thiết bị công nghệ bộ nhớ](#chapter-17-memory-technology-devices)
- [Chương 18. Nhúng Linux](#chapter-18-embedding-linux)
- [Chương 19. Trình điều khiển trong User Space](#chapter-19-drivers-in-user-space)
- [Chương 20. Các thiết bị và trình điều khiển bổ sung](#chapter-20-more-devices-and-drivers)
- [Chương 21. Gỡ lỗi trình điều khiển thiết bị](#chapter-21-debugging-device-drivers)
- [Chương 22. Bảo trì và phát hành](#chapter-22-maintenance-and-delivery)
- [Chương 23. Tắt hệ thống](#chapter-23-shutting-down)

---

## Lời tựa

Nếu bạn đang cầm cuốn sách này trên tay, có lẽ bạn sẽ tự hỏi: Tại sao lại là "thêm một" cuốn sách về trình điều khiển thiết bị (device driver) Linux nữa? Chẳng phải đã có rất nhiều cuốn rồi sao?

Câu trả lời là: Cuốn sách này là một bước nhảy vọt về lượng (quantum leap) so với những cuốn khác.

Đầu tiên, nó mang tính cập nhật cao, bao gồm các phiên bản nhân (kernel) 2.6 gần đây. Thứ hai, và quan trọng hơn, cuốn sách này vô cùng *thấu đáo*. Hầu hết các sách về trình điều khiển thiết bị chỉ bao gồm các chủ đề được mô tả trong sách về kiến trúc nội tại Unix tiêu chuẩn hoặc sách hệ điều hành, chẳng hạn như đường truyền nối tiếp, ổ đĩa và hệ thống tập tin (filesystem), và nếu bạn may mắn, thì có thêm tầng mạng (networking stack).

Cuốn sách này đi xa hơn thế rất nhiều; nó không né tránh những phần khó khăn mà bạn phải đối mặt trên các phần cứng PC và thiết bị nhúng (embedded hardware) hiện đại, chẳng hạn như PCMCIA, USB, I2C, video, âm thanh, bộ nhớ flash (flash memory), truyền thông không dây, v.v. Bạn cứ nêu tên đi, nếu nhân Linux giao tiếp với nó, thì cuốn sách này sẽ kể cho bạn nghe về nó.

Không có ngóc ngách nào bị bỏ sót; không có góc tối nào không được chiếu sáng.

Hơn nữa, tác giả đã khẳng định được tên tuổi của mình: Thật là một trải nghiệm ly kỳ khi đọc mô tả của ông về việc đưa Linux lên một chiếc đồng hồ đeo tay vào cuối những năm 1990!

Tôi rất vui mừng và hào hứng khi cuốn sách này trở thành một phần của bộ sách Prentice Hall Open Source Software Development Series. Đây là một ví dụ điển hình về những điều thú vị đang diễn ra trong thế giới Mã nguồn mở (Open Source). Tôi hy vọng bạn sẽ tìm thấy ở đây những gì bạn cần cho công việc của mình trên kernel, và bạn cũng sẽ tận hưởng quá trình đó!

*Arnold Robbins - Chủ biên chuỗi sách*

## Lời nói đầu

Vào cuối những năm 1990, tại IBM, chúng tôi đang đưa nhân Linux lên một chiếc đồng hồ đeo tay. Thiết bị mục tiêu rất nhỏ, nhưng nhiệm vụ lại trở nên vô cùng gian nan. Hệ thống con Thiết bị Công nghệ Bộ nhớ (Memory Technology Devices subsystem) chưa tồn tại trong kernel, điều đó có nghĩa là trước khi một hệ thống tập tin có thể khởi chạy trên bộ nhớ flash của đồng hồ, chúng tôi phải tự phát triển trình điều khiển lưu trữ (storage driver) cần thiết từ con số không. Việc kết nối màn hình cảm ứng của đồng hồ với các ứng dụng người dùng rất phức tạp vì giao diện trình điều khiển sự kiện *đầu vào* (*input* event driver interface) của kernel lúc đó còn chưa được hình thành. Việc chạy X Windows trên màn hình LCD của đồng hồ không hề dễ dàng vì nó không tương thích tốt với các trình điều khiển bộ đệm khung (frame buffer driver). Chiếc đồng hồ đeo tay Linux chống nước sẽ có ích gì nếu bạn không thể phát trực tuyến giá cổ phiếu từ bồn tắm của mình? Việc tích hợp Bluetooth với Linux còn cách xa nhiều năm, và chúng tôi đã mất hàng tháng trời để port (chuyển hoả) một tầng Bluetooth độc quyền nhằm hỗ trợ kết nối Internet cho đồng hồ. Hỗ trợ quản lý nguồn (power management) lúc đó chỉ đủ tốt để vắt kiệt vài giờ hoạt động từ viên pin của đồng hồ; do đó, chúng tôi cũng có rất nhiều việc phải làm ở mặt trận đó. Linux-Infrared vẫn chưa ổn định, vì vậy chúng tôi phải thuyết phục tầng này hoạt động trước khi có thể sử dụng bàn phím hồng ngoại để nhập dữ liệu. Và chúng tôi phải biên dịch trình biên dịch (compiler) cũng như biên dịch chéo (cross-compile) một tập ứng dụng nhỏ gọn vì chưa có các bản phân phối (distribution) được chấp nhận rộng rãi trong lĩnh vực điện tử tiêu dùng.

Nhìn nhanh đến hiện tại: Chú chim cánh cụt nhỏ bé đã lớn lên thành một thiếu niên khỏe mạnh. Những gì từng tốn hàng nghìn dòng mã nguồn và một năm phát triển hồi đó giờ đây có thể được hoàn thành chỉ trong vài ngày với các kernel hiện tại. Nhưng để trở thành một kỹ sư kernel đa năng, người có thể dệt nên các giải pháp một cách kỳ diệu, bạn cần phải hiểu vô số tính năng và cơ chế mà Linux cung cấp ngày nay.

## Giới thiệu về sách

Trong số các hệ thống con nằm trong cây mã nguồn kernel, thư mục *drivers/* chiếm phần lớn nhất và lớn hơn gấp nhiều lần so với các thư mục khác. Với các công nghệ mới và đa dạng xuất hiện dưới các hình thức phổ biến, việc phát triển các trình điều khiển thiết bị mới trong kernel đang tăng tốc đều đặn. Các kernel mới nhất hỗ trợ hơn 70 họ trình điều khiển thiết bị (device driver families).

Cuốn sách này viết về việc lập trình Linux device driver (trình điều khiển thiết bị Linux). Sách đề cập đến thiết kế và phát triển các lớp thiết bị (device class) chính được hỗ trợ bởi kernel (nhân), bao gồm cả những thiết bị mà tôi đã bỏ lỡ trong những ngày làm việc với Linux-on-Watch. Phần thảo luận về mỗi họ driver bắt đầu bằng việc xem xét công nghệ tương ứng, chuyển sang phát triển một ví dụ thực tế, và kết thúc bằng việc nghiên cứu các mã nguồn kernel có liên quan. Tuy nhiên, trước khi dấn thân vào thế giới của device driver, cuốn sách này sẽ giới thiệu cho bạn về kernel và thảo luận về các tính năng quan trọng của Linux 2.6, nhấn mạnh vào những phần có ý nghĩa đặc biệt đối với các lập trình viên viết device driver.

## Đối tượng độc giả

Cuốn sách này dành cho các lập trình viên ở mức độ trung cấp, những người mong muốn tinh chỉnh kernel để hỗ trợ các thiết bị mới. Bạn cần có kiến thức làm việc về các khái niệm hệ điều hành (operating system). Ví dụ, bạn phải biết system call (lời gọi hệ thống) là gì và tại sao các vấn đề về concurrency (tính đồng thời) phải được tính đến khi viết mã nguồn kernel. Cuốn sách giả định rằng bạn đã tải xuống Linux trên hệ thống của mình, tìm hiểu qua mã nguồn kernel, và ít nhất đã đọc lướt qua một số tài liệu liên quan. Bạn cũng cần phải có tay nghề khá vững về ngôn ngữ C.

## Tóm tắt các chương

4 chương đầu tiên chuẩn bị cho bạn nền tảng để lĩnh hội phần còn lại của cuốn sách. 16 chương tiếp theo thảo luận về các driver cho các họ thiết bị khác nhau. Tiếp theo là một chương mô tả các kỹ thuật debugging (gỡ lỗi) device driver. Chương áp chót cung cấp góc nhìn về việc bảo trì (maintenance) và bàn giao (delivery). Chúng ta kết thúc bằng việc đi qua một bảng kiểm tra (checklist) tóm tắt cách thức bắt đầu hành trình hỗ trợ Linux (Linux-enablement) cho một thiết bị mới mà bạn có trong tay.

Chương 1, "Giới thiệu" (Introduction), bắt đầu mối duyên của chúng ta với Linux. Chương này sẽ nhanh chóng hướng dẫn bạn tải xuống mã nguồn kernel, thực hiện các thay đổi mã nguồn nhỏ, và biên dịch ra một image kernel có thể khởi động được.

- Chương 2, "Cái nhìn bên trong Kernel" (A Peek Inside the Kernel), điểm qua một cách nhanh chóng phần ruột gan của Linux kernel và dạy bạn một số khái niệm kernel bắt buộc phải biết. Chương này trước tiên đưa bạn đi qua quá trình khởi động (boot process), sau đó mô tả các dịch vụ kernel có liên quan đặc biệt đến việc phát triển driver, chẳng hạn như kernel timer (bộ định thời kernel), quản lý tính đồng thời (concurrency management), và phân bổ bộ nhớ (memory allocation).
- Chương 3, "Các tiện ích của Kernel" (Kernel Facilities), khảo sát một số dịch vụ kernel đóng vai trò là các thành phần hữu ích trong hộp công cụ của nhà phát triển driver. Chương này bắt đầu bằng việc xem xét kernel thread (luồng nhân), đây là một cách để thực hiện các tác vụ nền (background task) bên trong kernel. Sau đó, chương chuyển sang các giao diện hỗ trợ (helper interface) như danh sách liên kết (linked list), hàng đợi công việc (work queue), hàm hoàn thành (completion function), và chuỗi thông báo (notifier chain). Các tiện ích hỗ trợ này giúp đơn giản hóa mã nguồn của bạn, loại bỏ các thành phần dư thừa khỏi kernel, và hỗ trợ bảo trì lâu dài.
- Chương 4, "Đặt nền móng" (Laying the Groundwork), xây dựng nền tảng để làm chủ nghệ thuật viết Linux device driver. Chương này giới thiệu các thiết bị và driver bằng cách cung cấp cho bạn một cái nhìn toàn cảnh (bird's-eye view) về kiến trúc của một hệ thống tương thích PC tiêu biểu và một thiết bị nhúng (embedded device). Sau đó, chương xem xét các khái niệm driver cơ bản như xử lý ngắt (interrupt handling) và mô hình thiết bị của kernel (kernel's device model).
- Chương 5, "Trình điều khiển ký tự" (Character Drivers), xem xét kiến trúc của character device driver (trình điều khiển thiết bị ký tự). Một số khái niệm được giới thiệu trong chương này, chẳng hạn như polling (thăm dò), thông báo bất đồng bộ (asynchronous notification), và điều khiển I/O (I/O control), cũng có liên quan đến các chương tiếp theo, bởi vì nhiều lớp thiết bị được thảo luận trong phần còn lại của cuốn sách thực chất là các thiết bị ký tự "siêu cấp" ("super" character devices).
- Chương 6, "Trình điều khiển nối tiếp" (Serial Drivers), giải thích tầng kernel xử lý các thiết bị nối tiếp (serial device).
- Chương 7, "Trình điều khiển thiết bị đầu vào" (Input Drivers), thảo luận về hệ thống phụ đầu vào (input subsystem) của kernel chịu trách nhiệm phục vụ các thiết bị như bàn phím, chuột, và bộ điều khiển màn hình cảm ứng.
- Chương 8, "Giao thức Inter-Integrated Circuit" (The Inter-Integrated Circuit Protocol), mổ xẻ các driver cho các thiết bị như EEPROM được kết nối với bus I2C hoặc SMBus của hệ thống. Chương này cũng xem xét các giao diện nối tiếp khác như bus SPI và bus 1-wire.
- Chương 9, "PCMCIA và Compact Flash" (PCMCIA and Compact Flash), đào sâu vào hệ thống phụ PCMCIA. Chương này hướng dẫn bạn viết driver cho các thiết bị có định dạng (form factor) PCMCIA hoặc Compact Flash.
- Chương 10, "Giao tiếp linh kiện ngoại vi" (Peripheral Component Interconnect), xem xét sự hỗ trợ của kernel đối với PCI và các biến thể của nó.
- Chương 11, "Bus nối tiếp vạn năng" (Universal Serial Bus), khám phá kiến trúc USB và giải thích cách bạn có thể sử dụng các dịch vụ của hệ thống phụ Linux-USB để viết driver cho các thiết bị USB.
- Chương 12, "Trình điều khiển video" (Video Drivers), khảo sát hệ thống phụ Linux-Video. Chương này chỉ ra các ưu điểm được mang lại bởi sự trừu tượng hóa bộ đệm khung (frame buffer abstraction) và hướng dẫn bạn viết driver frame buffer.
- Chương 13, "Trình điều khiển âm thanh" (Audio Drivers), mô tả framework Linux-Audio và giải thích cách triển khai các audio driver.
- Chương 14, "Trình điều khiển khối" (Block Drivers), tập trung vào các driver cho thiết bị lưu trữ như ổ đĩa cứng. Trong chương này, bạn cũng tìm hiểu về các bộ lập lịch I/O (I/O scheduler) khác nhau được hỗ trợ bởi hệ thống phụ Linux-Block.
- Chương 15, "Thẻ giao diện mạng" (Network Interface Cards), dành riêng cho các network device driver (trình điều khiển thiết bị mạng). Bạn sẽ tìm hiểu về cấu trúc dữ liệu mạng của kernel và cách giao tiếp giữa network driver với các tầng giao thức (protocol layer).

- Chương 16, "Linux Không Dây" (Linux Without Wires), xem xét việc điều khiển các công nghệ không dây khác nhau như Bluetooth, Hồng ngoại (Infrared), WiFi và truyền thông di động (cellular communication).
- Chương 17, "Thiết bị Công nghệ Bộ nhớ" (Memory Technology Devices), thảo luận về việc hỗ trợ bộ nhớ flash trên các thiết bị nhúng (embedded devices). Chương này kết thúc bằng việc khảo sát các trình điều khiển (drivers) cho Firmware Hub được tìm thấy trên các hệ thống PC.
- Chương 18, "Nhúng Linux" (Embedding Linux), bước vào thế giới Linux nhúng (embedded Linux). Chương này dẫn dắt bạn qua các thành phần firmware chính của một giải pháp nhúng như bootloader, kernel và device driver. Do sự phổ biến tăng vọt của Linux trong lĩnh vực nhúng (embedded space), khả năng cao là bạn sẽ sử dụng các kỹ năng viết device driver mà bạn thu nhận được từ cuốn sách này để hỗ trợ các hệ thống nhúng (embedded systems).

Chương 19, "Trình điều khiển trong Không gian Người dùng" (Drivers in User Space), xem xét cách điều khiển các loại thiết bị khác nhau từ không gian người dùng (user space). Một số device driver, đặc biệt là những trình điều khiển nặng về chính sách (policy) và nhẹ về yêu cầu hiệu năng (performance), sẽ tốt hơn nếu được đặt ở vùng người dùng (user land). Chương này cũng giải thích cách bộ lập lịch tiến trình (process scheduler) của Linux ảnh hưởng đến thời gian phản hồi của các trình điều khiển chế độ người dùng (user mode drivers).

Chương 20, "Nhiều Thiết bị và Trình điều khiển Hơn" (More Devices and Drivers), thực hiện một chuyến tham quan qua một tập hợp các họ trình điều khiển chưa được đề cập cho đến nay, chẳng hạn như *Phát hiện và Sửa lỗi* (Error Detection And Correction - EDAC), FireWire và ACPI.

Chương 21, "Gỡ lỗi Trình điều khiển Thiết bị" (Debugging Device Drivers), giảng dạy về các loại trình gỡ lỗi (debugger) khác nhau mà bạn có thể sử dụng để gỡ lỗi mã nguồn kernel (kernel code). Trong chương này, bạn cũng học cách sử dụng các công cụ theo dõi (trace tools), kernel probe, crash-dump và các trình cấu hình hiệu năng (profiler). Khi bạn phát triển một driver, hãy tự trang bị các kỹ năng gỡ lỗi driver mà bạn học được trong chương này.

Chương 22, "Bảo trì và Bàn giao" (Maintenance and Delivery), cung cấp góc nhìn về vòng đời phát triển phần mềm (software development life cycle).

Chương 23, "Kết thúc" (Shutting Down), dẫn dắt bạn qua danh sách kiểm tra các hạng mục công việc khi bạn bắt tay vào việc hỗ trợ Linux cho một thiết bị mới (Linux-enabling a new device). Cuốn sách kết thúc bằng việc suy ngẫm về câu hỏi *Bước tiếp theo là gì?* (*What next?*).

Các device driver đôi khi cần thực thi các đoạn mã bằng hợp ngữ (assembly), vì vậy Phụ lục A, "Hợp ngữ Linux" (Linux Assembly), xem xét các khía cạnh khác nhau của lập trình hợp ngữ trên Linux. Một số device driver trên các hệ thống dựa trên x86 phụ thuộc trực tiếp hoặc gián tiếp vào BIOS, do đó Phụ lục B, "Linux và BIOS" (Linux and the BIOS), dạy bạn cách Linux tương tác với BIOS. Phụ lục C, "Tệp Seq" (Seq Files), mô tả các tệp seq, một giao diện hỗ trợ của kernel (kernel helper interface) được giới thiệu từ phiên bản kernel 2.6 mà các device driver có thể sử dụng để giám sát và theo dõi các điểm dữ liệu (data points).

Cuốn sách nhìn chung được tổ chức theo độ phức tạp của thiết bị và bus, kết hợp với các lý do thực tế về sự phụ thuộc giữa các chương. Do đó, chúng ta bắt đầu với các lớp thiết bị cơ bản như ký tự (character), nối tiếp (serial) và đầu vào (input). Tiếp theo, chúng ta xem xét các bus nối tiếp đơn giản như I/O và SMBus. Các bus I/O ngoại vi như PCMCIA, PCI và USB xuất hiện sau đó. Các thiết bị video, âm thanh, khối (block) và mạng (network) thường giao tiếp với bộ vi xử lý (processor) thông qua các bus I/O này, vì vậy chúng ta sẽ tìm hiểu chúng ngay sau đó. Các phần tiếp theo của cuốn sách hướng đến Linux nhúng và bao gồm các công nghệ như mạng không dây (wireless networking) và bộ nhớ flash. Các trình điều khiển không gian người dùng (user-space drivers) được thảo luận ở phần cuối của cuốn sách.

## Phiên bản Kernel

Cuốn sách này nhìn chung được cập nhật đến các phiên bản Linux Kernel 2.6.23/2.6.24. Hầu hết các đoạn mã nguồn trong sách đã được kiểm thử trên kernel 2.6.23. Nếu bạn đang sử dụng phiên bản mới hơn, hãy tham khảo các trang web Linux như lwn.net để tìm hiểu về các thay đổi của kernel kể từ phiên bản 2.6.23/24.

## Trang web của sách

Tôi đã thiết lập một trang web tại elinuxdd.com để cung cấp các bản cập nhật, danh sách lỗi (errata) và các thông tin khác liên quan đến cuốn sách này.

## Quy ước sử dụng

Mã nguồn (source code), tên hàm và các lệnh shell được trình bày theo định dạng này. Dấu nhắc lệnh shell được sử dụng là **bash>**. Tên tệp tin được viết nghiêng, *như thế này.* Chữ nghiêng cũng được sử dụng khi giới thiệu các thuật ngữ mới.

Một số chương có sửa đổi các tệp mã nguồn gốc của kernel trong quá trình triển khai các ví dụ mã. Để chỉ ra rõ ràng các thay đổi, các dòng mã mới được thêm vào có tiền tố là dấu **+** và các dòng mã bị xóa có tiền tố là dấu **-**.

Đôi khi, để đơn giản hóa, cuốn sách sử dụng các tham chiếu chung. Ví dụ, nếu nội dung hướng dẫn bạn đến thư mục *arch/your-arch/*, thì nó cần được dịch, chẳng hạn thành *arch/x86/* nếu bạn đang biên dịch kernel cho kiến trúc x86. Tương tự, bất kỳ đề cập nào đến thư mục *include/asm-your-arch/* cũng nên được đọc là *include/asmarm/* nếu bạn đang, ví dụ, xây dựng kernel cho kiến trúc ARM. Ký hiệu dấu sao (\*) và chữ *X* đôi khi được sử dụng làm ký tự đại diện (wildcard) trong tên tệp tin. Do đó, nếu một chương yêu cầu bạn xem *include/linux/time\*.h*, hãy xem các tệp tiêu đề (header files) *time.h, timer.h, times.h*, và *timex.h* nằm trong thư mục *include/linux/*. Nếu một phần đề cập đến */dev/input/eventX* hoặc */sys/devices/platform/i8042/serioX/*, thì *X* là số giao diện (interface number) mà kernel gán cho thiết bị của bạn trong ngữ cảnh cấu hình hệ thống của bạn.

Ký hiệu đôi khi được chèn vào giữa lệnh hoặc đầu ra của kernel để đính kèm các phần giải thích.

Các biểu thức chính quy (regular expressions) đơn giản đôi khi được sử dụng để liệt kê gọn gàng các nguyên mẫu hàm (function prototypes). Ví dụ, phần "Direct Memory Access" (Truy cập bộ nhớ trực tiếp) trong Chương 10, "Peripheral Component Interconnect", đề cập đến pci\_[map|unmap|dma\_sync]\_single() thay vì liệt kê rõ ràng pci\_map\_single(), pci\_umap\_single(), và pci\_dma\_sync\_single().

Một số chương tham chiếu đến bạn các tệp cấu hình ở tầng người dùng (user-space configuration files). Ví dụ, phần mô tả quá trình khởi động (boot process) sẽ mở tệp */etc/rc.sysinit*, và chương thảo luận về Bluetooth sẽ đề cập đến */etc/bluetooth/pin*. Tuy nhiên, tên chính xác và vị trí của các tệp này có thể thay đổi tùy thuộc vào bản phân phối Linux (Linux distribution) mà bạn sử dụng.

## Lời cảm ơn

Trước hết, tôi xin ngả mũ thán phục các biên tập viên của tôi tại Prentice Hall: Debra Williams Cauley, Anne Goebel và Keith Cline. Nếu không có sự hỗ trợ của họ, cuốn sách này đã không thể ra mắt. Tôi cảm ơn Mark Taub vì sự quan tâm của ông đối wa dự án này và là người khởi xướng nó.

Nhiều nguồn tài liệu đã đóng góp vào quá trình học tập của tôi trong thập kỷ qua: vô số đồng nghiệp mà tôi từng làm việc cùng trong các dự án Linux, mã nguồn kernel hùng mạnh, các danh sách gửi thư (mailing lists) và Internet. Tất cả những điều này đã đóng một phần giúp tôi viết nên cuốn sách này.

Martin Streicher của tạp chí *Linux Magazine* đã biến tôi từ một lập trình viên toàn thời gian thành một cây bút bán thời gian khi ông mời tôi phụ trách chuyên mục kernel "Gearheads" của tạp chí. Tôi bày tỏ lòng biết ơn sâu sắc đối với rất nhiều bài học về viết kỹ thuật mà tôi đã học được từ ông.

Tôi mang ơn đặc biệt đối với các chuyên gia phản biện kỹ thuật (technical reviewers) của mình. Vamsi Krishna đã kiên nhẫn đọc qua từng chương của bản thảo. Những gợi ý vô số của ông đã giúp cuốn sách này trở nên tốt hơn. Jim Lieb cung cấp những phản hồi có giá trị về một số chương. Arnold Robbins đã xem xét những chương đầu tiên và đưa ra những nhận xét sâu sắc.

Cuối cùng, tôi cảm ơn cha mẹ và người vợ của mình vì tình yêu và sự hỗ trợ của họ. Và cảm ơn cô con gái nhỏ của tôi vì đã liên tục nhắc nhở tôi dành thời gian (cycles) cho cuốn sách bằng dáng đi chập chững có nét tương tự đến kỳ lạ với dáng đi của một chú chim cánh cụt.

## Về tác giả

**Sreekrishnan Venkateswaran** có bằng thạc sĩ khoa học máy tính từ Viện Công nghệ Ấn Độ (Indian Institute of Technology), Kanpur, Ấn Độ. Trong 12 năm qua làm việc cho IBM, ông đã thực hiện porting (chuyển hoán) Linux sang các thiết bị nhúng (embedded devices) khác nhau như đồng hồ đeo tay, thiết bị cầm tay, máy nghe nhạc, điện thoại VoIP, thiết bị lập trình máy tạo nhịp tim và hệ thống giám sát bệnh nhân từ xa. Sreekrishnan từng là biên tập viên đóng góp và là cây bút chuyên mục kernel cho tạp chí *Linux Magazine* trong hơn 2 năm. Hiện tại, ông quản lý nhóm giải pháp nhúng tại IBM Ấn Độ.
