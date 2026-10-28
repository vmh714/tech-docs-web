# Chương 23: Lời kết (Shutting Down)

## Trong chương này

Danh sách kiểm tra (Checklist)

Bước tiếp theo là gì? (What Next?)

Trước khi chuyển sang init runlevel 0, hãy cùng tóm tắt cách thức bắt đầu hành trình đưa Linux lên một thiết bị mới khi bạn cầm trên tay phần cứng đó. Dưới đây là một danh sách kiểm tra nhanh.

## Danh sách kiểm tra (Checklist)

- Xác định tính năng và công nghệ giao tiếp của thiết bị. Tùy thuộc vào những gì bạn tìm thấy, hãy xem lại chương mô tả phân hệ (subsystem) trình điều khiển thiết bị (device driver) tương ứng. Như bạn đã tìm hiểu, hầu như mọi phân hệ driver trên Linux đều chứa một lớp lõi (core layer) cung cấp các dịch vụ driver, và một lớp trừu tượng hóa (abstraction layer) giúp các ứng dụng độc lập với phần cứng bên dưới (xem lại Hình 18.3 trong Chương 18, "Nhúng Linux" - "Embedding Linux"). Driver của bạn cần phải phù hợp với kiến trúc này và tương tác với các thành phần khác trong phân hệ. Nếu thiết bị của bạn là một modem, hãy tìm hiểu cách thức hoạt động của các lớp UART, tty và line discipline. Nếu chip của bạn là RTC hoặc watchdog, hãy tìm hiểu cách tuân thủ các kernel API tương ứng. Nếu thiết bị bạn có là một con chuột (mouse), hãy tìm cách liên kết nó với lớp sự kiện đầu vào (input event layer). Nếu phần cứng của bạn là một bộ điều khiển video (video controller), hãy thu thập kiến thức chuyên môn về phân hệ khung đệm khung hình (frame buffer subsystem). Trước khi bắt tay vào viết driver cho một audio codec, hãy nghiên cứu kỹ khung làm việc ALSA (ALSA framework). **1.**
- Lấy bảng dữ liệu (data sheet) của thiết bị và hiểu rõ mô hình lập trình thanh ghi (register programming model) của nó. Ví dụ, đối với một bộ phát I2C DVI, hãy lấy địa chỉ slave của thiết bị và trình tự lập trình để khởi tạo. Đối với bộ điều khiển cảm ứng SPI, hãy hiểu cách triển khai cỗ máy trạng thái hữu hạn (finite state machine) của nó. Đối với thẻ PCI Ethernet, hãy tìm hiểu ngữ nghĩa không gian cấu hình (configuration space semantics). Đối với thiết bị USB, hãy xác định các điểm cuối (endpoint) được hỗ trợ và tìm hiểu cách giao tiếp với chúng. **2.**
- Tìm kiếm một driver điểm khởi đầu (starting point driver) bên trong cây mã nguồn kernel (kernel source tree) đồ sộ. Nghiên cứu các driver ứng cử viên và nhắm tới một driver phù hợp. Một số phân hệ nhất định cung cấp các driver khung xương (skeletal driver) mà bạn có thể dựa vào đó để làm mẫu nếu không tìm thấy driver nào khớp hoàn toàn. Ví dụ là *sound/drivers/dummy.c*, *drivers/usb/usb-skeleton.c*, *drivers/net/pciskeleton.c*, và *drivers/video/skeletonfb.c*. **3.**
- Nếu bạn lấy được một driver điểm khởi đầu, hãy điều tra sự khác biệt chính xác giữa thiết bị liên quan và phần cứng của bạn bằng cách so sánh các data sheet và sơ đồ mạch (schematics) tương ứng. Để minh họa, giả sử bạn đang đưa Linux lên một bo mạch tùy chỉnh (custom board) dựa trên phần cứng tham chiếu được hỗ trợ bởi bản phân phối (distribution). Bản phân phối của bạn bao gồm driver điều khiển USB đã được kiểm thử trên phần cứng tham chiếu, nhưng bo mạch tùy chỉnh **4.**

của bạn có sử dụng các bộ thu phát (transceiver) USB khác không? Bạn có driver khung đệm khung hình (frame buffer driver) cho bộ điều khiển LCD, nhưng bo mạch của bạn có sử dụng giao diện bảng hiển thị (display panel interface) khác chẳng hạn như LVDS không? Có lẽ một EEPROM nằm trên bus I<sup>2</sup>C ở bo mạch tham chiếu nay lại nằm trên bus 1-wire. Bộ điều khiển Ethernet hiện có được kết nối với một chip PHY khác hoặc thậm chí với một chip switch Lớp 2 (Layer 2 switch chip) không? Hoặc có lẽ giao diện RS-232 kết nối với UART đã nhường chỗ cho RS-485 để có tầm hoạt động và độ tin cậy tốt hơn.

- Nếu bạn không có một điểm khởi đầu gần đúng hoặc nếu bạn quyết định tự viết driver từ đầu (from scratch), hãy dành thời gian thiết kế và kiến trúc hóa driver cùng các cấu trúc dữ liệu của nó. **5.**
- Bây giờ khi bạn đã có tất cả thông tin cần thiết, hãy tự trang bị các công cụ phần mềm (như ctags, cscope, và các trình gỡ lỗi - debugger) cùng các thiết bị phòng lab (như máy hiện sóng - oscilloscope, đồng hồ vạn năng - multimeter, và thiết bị phân tích - analyzer) và bắt đầu viết mã. **6.**

## Trong chương này

Danh sách kiểm tra (Checklist)

Bước tiếp theo là gì? (What Next?)

Trước khi chuyển sang init runlevel 0, hãy cùng tóm tắt cách thức bắt đầu hành trình đưa Linux lên một thiết bị mới khi bạn cầm trên tay phần cứng đó. Dưới đây là một danh sách kiểm tra nhanh.

## Danh sách kiểm tra (Checklist)

- Xác định tính năng và công nghệ giao tiếp của thiết bị. Tùy thuộc vào những gì bạn tìm thấy, hãy xem lại chương mô tả phân hệ (subsystem) trình điều khiển thiết bị (device driver) tương ứng. Như bạn đã tìm hiểu, hầu như mọi phân hệ driver trên Linux đều chứa một lớp lõi (core layer) cung cấp các dịch vụ driver, và một lớp trừu tượng hóa (abstraction layer) giúp các ứng dụng độc lập với phần cứng bên dưới (xem lại Hình 18.3 trong Chương 18, "Nhúng Linux" - "Embedding Linux"). Driver của bạn cần phải phù hợp với kiến trúc này và tương tác với các thành phần khác trong phân hệ. Nếu thiết bị của bạn là một modem, hãy tìm hiểu cách thức hoạt động của các lớp UART, tty và line discipline. Nếu chip của bạn là RTC hoặc watchdog, hãy tìm hiểu cách tuân thủ các kernel API tương ứng. Nếu thiết bị bạn có là một con chuột (mouse), hãy tìm cách liên kết nó với lớp sự kiện đầu vào (input event layer). Nếu phần cứng của bạn là một bộ điều khiển video (video controller), hãy thu thập kiến thức chuyên môn về phân hệ khung đệm khung hình (frame buffer subsystem). Trước khi bắt tay vào viết driver cho một audio codec, hãy nghiên cứu kỹ khung làm việc ALSA (ALSA framework). **1.**
- Lấy bảng dữ liệu (data sheet) của thiết bị và hiểu rõ mô hình lập trình thanh ghi (register programming model) của nó. Ví dụ, đối với một bộ phát I2C DVI, hãy lấy địa chỉ slave của thiết bị và trình tự lập trình để khởi tạo. Đối với bộ điều khiển cảm ứng SPI, hãy hiểu cách triển khai cỗ máy trạng thái hữu hạn (finite state machine) của nó. Đối với thẻ PCI Ethernet, hãy tìm hiểu ngữ nghĩa không gian cấu hình (configuration space semantics). Đối với thiết bị USB, hãy xác định các điểm cuối (endpoint) được hỗ trợ và tìm hiểu cách giao tiếp với chúng. **2.**

- Tìm kiếm một trình điều khiển (driver) khởi điểm bên trong cây mã nguồn (source tree) kernel đầy uy lực. Nghiên cứu các driver ứng viên và chọn lọc ra một driver phù hợp. Một số phân hệ (subsystem) cung cấp các driver khung xương (skeletal driver) mà bạn có thể dựa vào đó làm mô hình nếu không tìm thấy driver nào khớp sát thực tế. Các ví dụ bao gồm *sound/drivers/dummy.c, drivers/usb/usb-skeleton.c, drivers/net/pciskeleton.c* và *drivers/video/skeletonfb.c*. **3.**
- Nếu bạn có được một driver khởi điểm, hãy khảo sát các điểm khác biệt chính xác giữa thiết bị liên quan và phần cứng của bạn bằng cách so sánh các bảng thông số kỹ thuật (data sheet) và sơ đồ mạch (schematic) tương ứng. Để minh họa, giả sử bạn đang cài đặt Linux lên một bo mạch tùy chỉnh (custom board) dựa trên phần cứng tham chiếu được hỗ trợ bởi bản phân phối (distribution). Bản phân phối của bạn bao gồm driver điều khiển USB đã được kiểm thử trên phần cứng tham chiếu, nhưng liệu bo mạch tùy chỉnh **4.**

của bạn có sử dụng các bộ thu phát (transceiver) USB khác không? Bạn có một driver bộ đệm khung hình (frame buffer driver) cho bộ điều khiển LCD, nhưng liệu bo mạch của bạn có sử dụng một giao diện bảng hiển thị khác như LVDS không? Có lẽ một EEPROM nằm trên bus $I^2C$ của bo mạch tham chiếu nay lại nằm trên bus 1-wire. Bộ điều khiển Ethernet hiện được kết nối với một chip PHY khác hay thậm chí với một chip chuyển mạch Lớp 2 (Layer 2 switch chip)? Hoặc có lẽ giao diện RS-232 kết nối với UART đã được nhường chỗ cho RS-485 nhằm cải thiện tầm hoạt động và độ trung thực.

- Nếu bạn không có một điểm khởi điểm gần sát hoặc nếu bạn quyết định tự viết driver hoàn toàn từ đầu (from scratch), hãy đầu tư thời gian vào việc thiết kế và kiến trúc hóa driver cùng các cấu trúc dữ liệu của nó. **5.**
- Giờ đây, khi đã có tất cả thông tin cần thiết, hãy tự trang bị các công cụ phần mềm (như ctags, cscope và trình gỡ lỗi - debugger) cùng các thiết bị phòng thí nghiệm (như máy hiện sóng - oscilloscope, đồng hồ vạn năng - multimeter, và thiết bị phân tích - analyzer) và bắt đầu viết mã. **6.**

## Bước Tiếp Theo Là Gì?

Linux sẽ còn phát triển lâu dài, nhưng các giao diện (interface) nội bộ của kernel có xu hướng trở nên cố định ngay khi ai đó tìm ra một cách thức thông minh hơn để thực hiện công việc. Không có mã nguồn kernel nào là được khắc đá vĩnh viễn. Như bạn đã học, ngay cả bộ lập lịch (scheduler), thành phần được coi là bất khả xâm phạm, cũng đã trải qua hai lần viết lại kể từ thời phiên bản 2.4. Số lượng dòng mã mới xuất hiện trong cây mã nguồn kernel lên tới hàng triệu dòng mỗi năm. Khi kernel tiến hóa, các tính năng và sự trừu tượng hóa (abstraction) mới liên tục được thêm vào, các giao diện lập trình được thiết kế lại, các phân hệ được tái cấu trúc để đạt hiệu năng tốt hơn, và các vùng mã có thể tái sử dụng được cô lọc vào các phần nhân chung (common core).

Giờ đây bạn đã có một nền tảng vững chắc, vì vậy bạn hoàn toàn có thể thích ứng với những thay đổi này. Để duy trì thế mạnh tiên phong của mình, hãy cập nhật cây mã nguồn kernel thường xuyên, theo dõi danh sách thư tín kernel (kernel mailing list) một cách thường xuyên, và viết mã bất cứ khi nào có thể. Linux chính là tương lai, và việc trở thành một chuyên gia kernel (kernel guru) mang lại rất nhiều giá trị. Hãy luôn đứng ở tuyến đầu!
