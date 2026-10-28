# Lời nói đầu và Lời cảm ơn (Frontmatter)

## Mục lục

- [Lời nói đầu](#lời-nói-đầu)
- [Chương 1: Giới thiệu về Trình điều khiển Thiết bị (Device Drivers)](#chương-1-giới-thiệu-về-trình-điều-khiển-thiết-bị-device-drivers)
- [Chương 2: Xây dựng và Chạy các Module](#chương-2-xây-dựng-và-chạy-các-module)
- [Chương 3: Trình điều khiển Ký tự (Char Drivers)](#chương-3-trình-điều-khiển-ký-tự-char-drivers)
- [Chương 4: Kỹ thuật Gỡ lỗi (Debugging Techniques)](#chương-4-kỹ-thuật-gỡ-lỗi-debugging-techniques)
- [Chương 5: Tính đồng thời và Tình trạng tranh chấp (Concurrency and Race Conditions)](#chương-5-tính-đồng-thời-và-tình-trạng-tranh-chấp-concurrency-and-race-conditions)
- [Chương 6: Các thao tác Trình điều khiển Ký tự Nâng cao](#chương-6-các-thao-tác-trình-điều-khiển-ký-tự-nâng-cao)
- [Chương 7: Thời gian, Độ trễ và Công việc hoãn lại (Deferred Work)](#chương-7-thời-gian-độ-trễ-và-công-việc-hoãn-lại-deferred-work)
- [Chương 8: Cấp phát Bộ nhớ (Allocating Memory)](#chương-8-cấp-phát-bộ-nhớ-allocating-memory)
- [Chương 9: Giao tiếp với Phần cứng](#chương-9-giao-tiếp-với-phần-cứng)
- [Chương 10: Xử lý Ngắt (Interrupt Handling)](#chương-10-xử-lý-ngắt-interrupt-handling)
- [Chương 11: Kiểu dữ liệu trong Kernel](#chương-11-kiểu-dữ-liệu-trong-kernel)
- [Chương 12: Trình điều khiển PCI (PCI Drivers)](#chương-12-trình-điều-khiển-pci-pci-drivers)
- [Chương 13: Trình điều khiển USB (USB Drivers)](#chương-13-trình-điều-khiển-usb-usb-drivers)
- [Chương 14: Mô hình Thiết bị Linux (The Linux Device Model)](#chương-14-mô-hình-thiết-bị-linux-the-linux-device-model)
- [Chương 15: Ánh xạ Bộ nhớ và DMA (Memory Mapping and DMA)](#chương-15-ánh-xạ-bộ-nhớ-và-dma-memory-mapping-and-dma)
- [Chương 16: Trình điều khiển Khối (Block Drivers)](#chương-16-trình-điều-khiển-khối-block-drivers)
- [Chương 17: Trình điều khiển Mạng (Network Drivers)](#chương-17-trình-điều-khiển-mạng-network-drivers)
- [Chương 18: Trình điều khiển TTY (TTY Drivers)](#chương-18-trình-điều-khiển-tty-tty-drivers)

---

## Lời nói đầu

Nói một cách bề ngoài, đây là một cuốn sách về việc viết trình điều khiển thiết bị (device drivers) cho hệ thống Linux. Tất nhiên, đó là một mục tiêu đáng trân trọng; dòng sản phẩm phần cứng mới có lẽ sẽ không chậm lại trong tương lai gần, và sẽ luôn cần có ai đó làm cho tất cả các thiết bị mới đó hoạt động được với Linux. Nhưng cuốn sách này cũng nói về cách Linux kernel hoạt động và cách thích ứng các hoạt động của nó theo nhu cầu hoặc sở thích của bạn. Linux là một hệ thống mở; với cuốn sách này, chúng tôi hy vọng nó sẽ trở nên cởi mở và dễ tiếp cận hơn đối với một cộng đồng lập trình viên lớn hơn.

Đây là lần tái bản thứ ba của cuốn *Linux Device Drivers*. Kernel đã thay đổi rất nhiều kể từ khi cuốn sách này được xuất bản lần đầu tiên, và chúng tôi đã cố gắng phát triển nội dung văn bản để bắt kịp sự thay đổi đó. Phiên bản này bao gồm kernel 2.6.10 một cách đầy đủ nhất có thể. Lần này, chúng tôi đã chọn lược bỏ phần thảo luận về khả năng tương thích ngược với các phiên bản kernel trước đó. Các thay đổi từ phiên bản 2.4 là quá lớn, và giao diện của phiên bản 2.4 vẫn được tài liệu hóa rất tốt trong lần tái bản thứ hai (được cung cấp miễn phí).

Phiên bản này chứa khá nhiều tài liệu mới liên quan đến kernel 2.6. Phần thảo luận về cơ chế khóa (locking) và tính đồng thời (concurrency) đã được mở rộng và chuyển thành một chương riêng. Mô hình thiết bị Linux (Linux device model), vốn là một điểm mới trong phiên bản 2.6, được đề cập chi tiết. Có các chương mới về bus USB và hệ thống con trình điều khiển nối tiếp (serial driver subsystem); chương về PCI cũng đã được cải tiến. Mặc dù cấu trúc tổ chức của phần còn lại trong cuốn sách vẫn giống với các phiên bản trước, mọi chương đều đã được cập nhật kỹ lưỡng.

Chúng tôi hy vọng bạn sẽ thích đọc cuốn sách này cũng nhiều như chúng tôi đã thích thú khi viết nó.

## Giới thiệu của Jon

Việc xuất bản ấn bản này trùng với năm thứ mười hai tôi làm việc với Linux và, thật đáng ngạc nhiên, là năm thứ hai mươi lăm của tôi trong lĩnh vực máy tính. Điện toán có vẻ là một lĩnh vực chuyển động nhanh vào năm 1980, nhưng mọi thứ đã tăng tốc rất nhiều kể từ đó. Việc duy trì cuốn *Linux Device Drivers* luôn cập nhật ngày càng là một thử thách; các lập trình viên kernel (kernel hackers) tiếp tục cải tiến mã nguồn của họ, và họ có rất ít sự kiên nhẫn đối với tài liệu không theo kịp tiến độ đó.

Linux tiếp tục thành công trên thị trường và, quan trọng hơn hết, trong trái tim và khối óc của các nhà phát triển trên toàn thế giới. Thành công của Linux rõ ràng minh chứng cho chất lượng kỹ thuật của nó và nhiều lợi ích của phần mềm tự do (free software) nói chung. Nhưng chìa khóa thực sự cho thành công của nó, theo quan điểm của tôi, nằm ở thực tế là nó đã mang niềm vui trở lại với ngành điện toán. Với Linux, bất kỳ ai cũng có thể nhúng tay vào hệ thống và vọc vạch trong một hộp cát (sandbox), nơi mọi đóng góp từ bất kỳ hướng nào đều được chào đón, nhưng nơi sự xuất sắc về mặt kỹ thuật được đặt lên hàng đầu. Linux không chỉ cung cấp cho chúng ta một hệ điều hành (operating system) chất lượng hàng đầu; nó mang lại cho chúng ta cơ hội trở thành một phần trong sự phát triển tương lai của nó và có được niềm vui trong quá trình đó.

Trong 25 năm làm việc trong lĩnh vực này, tôi đã có nhiều cơ hội thú vị, từ lập trình những cỗ máy Cray đầu tiên (bằng ngôn ngữ Fortran, trên thẻ đục lỗ - punch cards) đến việc chứng kiến các làn sóng máy tính mini (minicomputer) và trạm làm việc Unix (Unix workstation), xuyên suốt cho đến kỷ nguyên hiện tại bị thống trị bởi vi xử lý (microprocessor). Tuy nhiên, chưa bao giờ tôi thấy lĩnh vực này tràn đầy sức sống, cơ hội và niềm vui như vậy. Chưa bao giờ chúng ta có quyền kiểm soát lớn đến thế đối với các công cụ của chính mình và sự tiến hóa của chúng. Linux, và phần mềm tự do (free software) nói chung, rõ ràng là động lực thúc đẩy đằng sau những thay đổi đó.

Hy vọng của tôi là ấn bản này sẽ giúp mang lại niềm vui và cơ hội đó cho một thế hệ lập trình viên Linux mới. Dù mối quan tâm của bạn nằm ở kernel hay ở không gian người dùng (user space), tôi hy vọng bạn sẽ thấy cuốn sách này là một cẩm nang hữu ích và thú vị về cách kernel tương tác với phần cứng (hardware). Tôi hy vọng nó sẽ giúp ích và truyền cảm hứng cho bạn để khởi chạy trình soạn thảo (editor) của mình và làm cho hệ điều hành tự do, chung của chúng ta ngày càng tốt hơn nữa. Linux đã đi được một chặng đường dài, nhưng nó cũng chỉ mới bắt đầu; sẽ vô cùng thú vị khi được quan sát—và tham gia vào—những gì sẽ diễn ra từ đây trở đi.

## Giới thiệu của Alessandro

Tôi luôn thích máy tính vì chúng có thể giao tiếp với phần cứng ngoại vi (external hardware). Vì vậy, sau khi hàn các mạch thiết bị của mình cho dòng máy Apple II và ZX Spectrum, được hậu thuẫn bởi kiến thức chuyên môn về Unix và phần mềm tự do (free software) mà trường đại học đã trang bị, tôi có thể thoát khỏi cái bẫy DOS bằng cách cài đặt GNU/Linux lên một chiếc máy 386 hoàn toàn mới mẻ và bật mỏ hàn lên một lần nữa.

Hồi đó, cộng đồng còn rất nhỏ và không có nhiều tài liệu về việc viết driver, vì vậy tôi bắt đầu viết bài cho tờ Linux Journal. Mọi chuyện bắt đầu như vậy đấy: khi sau đó tôi phát hiện ra mình không thích viết các bài báo nghiên cứu, tôi đã rời trường đại học và thấy mình đang cầm trên tay một bản hợp đồng với O'Reilly.

Đó là năm 1996. Đã từ rất lâu rồi.

Thế giới điện toán ngày nay đã khác: phần mềm tự do (free software) trông có vẻ là một giải pháp khả thi, cả về mặt kỹ thuật lẫn chính trị, nhưng vẫn còn rất nhiều việc phải làm trong cả hai lĩnh vực đó. Tôi hy vọng cuốn sách này thúc đẩy hai mục đích: truyền bá kiến thức kỹ thuật và nâng cao nhận thức về sự cần thiết phải truyền bá kiến thức đó. Đó là lý do tại sao, sau khi ấn bản đầu tiên chứng minh được sức hút đối với công chúng, hai tác giả của ấn bản thứ hai đã chuyển sang sử dụng giấy phép tự do (free license),

được sự hậu thuẫn bởi biên tập viên và nhà xuất bản của chúng tôi. Tôi cá rằng đây là cách tiếp cận đúng đắn đối với thông tin, và thật tuyệt vời khi được hợp tác với những người khác có chung tầm nhìn này.

Tôi rất phấn khích trước những gì mình chứng kiến trong lĩnh vực hệ thống nhúng (embedded arena), và tôi hy vọng tài liệu này có thể đóng góp nhiều hơn nữa; nhưng các ý tưởng đang phát triển rất nhanh trong thời gian này, và đã đến lúc lên kế hoạch cho ấn bản thứ tư, đồng thời tìm kiếm một đồng tác giả thứ tư để giúp sức.

## Giới thiệu của Greg

Có vẻ như đã từ rất lâu rồi khi tôi cầm trên tay cuốn sách *Linux Device Drivers* phiên bản đầu tiên để tìm hiểu cách viết một Linux driver thực thụ. Phiên bản đầu tiên đó là một cẩm nang tuyệt vời giúp tôi hiểu được các cơ chế bên trong (internals) của hệ điều hành này — thứ mà tôi đã sử dụng trong nhiều năm nhưng chưa bao giờ dành thời gian tìm hiểu phần nhân (kernel) của nó. Với kiến thức thu được từ cuốn sách đó, cùng với việc đọc mã nguồn của các lập trình viên khác đã có sẵn trong kernel, driver đầu tiên đầy rẫy lỗi, hỏng hóc và hoàn toàn không an toàn cho đa xử lý đối xứng (SMP-unsafe) của tôi đã được cộng đồng kernel chấp nhận đưa vào cây mã nguồn chính (main kernel tree). Mặc dù nhận được báo cáo lỗi (bug report) đầu tiên chỉ năm phút sau đó, tôi đã thực sự say mê và muốn làm mọi thứ có thể để biến hệ điều hành này trở nên hoàn thiện nhất có thể.

Tôi rất vinh dự khi có cơ hội đóng góp cho cuốn sách này. Tôi hy vọng nó sẽ giúp những người khác tìm hiểu chi tiết về kernel, nhận ra rằng việc phát triển driver không phải là một lĩnh vực đáng sợ hay cấm địa, và có lẽ sẽ khuyến khích nhiều người khác tham gia cùng đóng góp vào nỗ lực chung nhằm giúp hệ điều hành này hoạt động trên mọi nền tảng điện toán với mọi loại thiết bị có sẵn. Quy trình phát triển rất thú vị, cộng đồng mang lại nhiều phần thưởng xứng đáng, và tất cả mọi người đều hưởng lợi từ nỗ lực này.

Bây giờ là lúc quay trở lại công việc biến phiên bản này thành lỗi thời bằng cách sửa các lỗi hiện tại, thay đổi các API để hoạt động tốt hơn, đơn giản hơn để mọi người dễ hiểu, và thêm các tính năng mới. Hãy cùng tham gia; chúng tôi luôn cần sự giúp đỡ từ các bạn.

## Đối tượng độc giả của cuốn sách này

Cuốn sách này sẽ là một nguồn thông tin thú vị dành cho cả những ai muốn thử nghiệm với máy tính của mình lẫn các lập trình viên kỹ thuật đang đối mặt với nhu cầu xử lý các tầng bên trong của một cỗ máy Linux. Lưu ý rằng "một cỗ máy Linux" là một khái niệm rộng hơn "một cỗ máy tính cá nhân chạy Linux," vì hệ điều hành của chúng tôi hỗ trợ rất nhiều nền tảng, và việc lập trình kernel tuyệt然 không bị giới hạn ở một nền tảng cụ thể nào. Chúng tôi hy vọng cuốn sách này sẽ hữu ích như một điểm khởi đầu cho những ai muốn trở thành các hacker kernel (kernel hacker) nhưng chưa biết bắt đầu từ đâu.

Về mặt kỹ thuật, tài liệu này sẽ mang lại cách tiếp cận thực tế (hands-on) để hiểu về cơ chế bên trong của kernel và một số lựa chọn thiết kế được thực hiện bởi các nhà phát triển Linux. Mặc dù mục tiêu chính thức và quan trọng nhất của cuốn sách là dạy cách viết device driver, tài liệu này cũng cung cấp một cái nhìn tổng quan thú vị về cách cài đặt (implementation) của kernel.

Mặc dù các hacker thực thụ có thể tìm thấy tất cả thông tin cần thiết trong mã nguồn chính thức của kernel, thông thường một tài liệu dạng văn bản có thể hữu ích trong việc phát triển các kỹ năng lập trình. Tài liệu mà bạn đang tiếp cận là kết quả của hàng giờ kiên nhẫn tìm kiếm (`grep`) qua mã nguồn kernel, và chúng tôi hy vọng kết quả cuối cùng xứng đáng với công sức đã bỏ ra.

Người đam mê Linux sẽ tìm thấy trong cuốn sách này lượng thông tin phong phú để bắt đầu vọc vạch với mã nguồn (code base) và có thể gia nhập nhóm các nhà phát triển đang liên tục làm việc trên các tính năng mới và cải thiện hiệu năng. Tất nhiên, cuốn sách này không bao trọn toàn bộ Linux kernel, nhưng các tác giả viết Linux device driver cần biết cách làm việc với nhiều phân hệ (subsystems) của kernel. Do đó, đây là một tài liệu nhập môn tốt về lập trình kernel nói chung. Linux vẫn là một công việc đang tiến hành (work in progress), và luôn có chỗ cho các lập trình viên mới tham gia vào cuộc chơi.

Mặt khác, nếu bạn chỉ đang cố gắng viết một device driver cho thiết bị của riêng mình và không muốn can thiệp sâu vào các cơ chế bên trong của kernel, tài liệu này cũng đủ tính mô-đun (modularized) để đáp ứng nhu cầu của bạn. Nếu bạn không muốn đi sâu vào các chi tiết, bạn có thể bỏ qua các phần mang tính kỹ thuật cao nhất và bám sát các API chuẩn được sử dụng bởi các device driver để tích hợp mượt mà với phần còn lại của kernel.

## Tổ chức tài liệu

Cuốn sách giới thiệu các chủ đề theo thứ tự độ phức tạp tăng dần và được chia thành hai phần. Phần đầu tiên (từ Chương 1 đến Chương 11) bắt đầu bằng việc thiết lập đúng đắn các kernel module (mô-đun nhân) và tiếp tục mô tả các khía cạnh lập trình khác nhau mà bạn cần để viết một trình điều khiển (driver) đầy đủ tính năng cho một thiết bị định hướng ký tự (char-oriented device). Mỗi chương đề cập đến một vấn đề riêng biệt và bao gồm một phần tóm tắt nhanh ở cuối chương, có thể được sử dụng làm tài liệu tham khảo trong quá trình phát triển thực tế.

Trong suốt phần đầu của cuốn sách, việc sắp xếp tài liệu diễn ra theo hướng từ các khái niệm thuần phần mềm (software-oriented) sang các khái niệm liên quan đến phần cứng (hardware-related). Cách sắp xếp này nhằm cho phép bạn thử nghiệm phần mềm trên máy tính của chính mình càng nhiều càng tốt mà không cần cắm các thiết bị phần cứng ngoại vi vào máy. Mỗi chương đều bao gồm mã nguồn và trỏ đến các driver mẫu mà bạn có thể chạy trên bất kỳ máy tính Linux nào. Tuy nhiên, trong Chương 1 và Chương 2, chúng tôi yêu cầu bạn kết nối một đoạn dây dài một inch với cổng song song (parallel port) để kiểm tra việc xử lý phần cứng, nhưng yêu cầu này hầu như ai cũng có thể thực hiện được.

Nửa sau của cuốn sách (từ Chương 12 đến Chương 18) mô tả các khối driver (block driver) và giao diện mạng (network interface), đồng thời đi sâu hơn vào các chủ đề nâng cao hơn, chẳng hạn như làm việc với hệ thống con bộ nhớ ảo (virtual memory subsystem) và các bus PCI, USB. Nhiều tác giả viết driver không cần toàn bộ các nội dung này, nhưng chúng tôi vẫn khuyến khích bạn tiếp tục đọc. Phần lớn tài liệu trong đó rất thú vị như một góc nhìn về cách thức hoạt động của Linux kernel, ngay cả khi bạn không cần đến nó cho một dự án cụ thể nào đó.

## Thông tin nền tảng

Để có thể sử dụng cuốn sách này, bạn cần thành thạo lập trình C. Bạn cũng cần có một số chuyên môn về Unix, vì chúng tôi thường đề cập đến các ngữ nghĩa Unix (Unix semantics) về system call (gọi hệ thống), câu lệnh và pipeline (đường ống).

Ở cấp độ phần cứng, không yêu cầu kinh nghiệm chuyên môn trước đó để hiểu tài liệu trong cuốn sách này, miễn là các khái niệm chung đã được làm rõ từ trước. Văn bản không dựa trên phần cứng PC cụ thể nào và chúng tôi cung cấp tất cả thông tin cần thiết khi đề cập đến một phần cứng cụ thể.

Cần có một số công cụ phần mềm tự do (free software tools) để xây dựng kernel, và bạn thường cần các phiên bản cụ thể của những công cụ này. Những công cụ quá cũ có thể thiếu các tính năng cần thiết, trong khi những công cụ quá mới đôi khi có thể tạo ra các kernel bị lỗi. Thông thường, các công cụ đi kèm với bất kỳ bản phân phối (distribution) hiện tại nào đều hoạt động rất tốt. Yêu cầu về phiên bản công cụ thay đổi tùy theo từng kernel; hãy tham khảo tệp *Documentation/Changes* trong cây mã nguồn (source tree) của kernel bạn đang sử dụng để biết các yêu cầu chính xác.

## Phiên bản trực tuyến và Giấy phép

Các tác giả đã chọn phát hành cuốn sách này miễn phí theo giấy phép Creative Commons "Attribution-ShareAlike" (Ghi nhận công của tác giả - Chia sẻ tương tự), Phiên bản 2.0:

*http://www.oreilly.com/catalog/linuxdrive3*

## Quy ước sử dụng trong cuốn sách này

Dưới đây là danh sách các quy ước về kiểu chữ được sử dụng trong cuốn sách này:

*Chữ nghiêng (Italic)*

Được sử dụng cho tên tệp (file) và thư mục, tên chương trình và lệnh, các tùy chọn dòng lệnh (command-line options), URL và các thuật ngữ mới.

*Chiều rộng hằng (Constant Width)*

Được sử dụng trong các ví dụ để hiển thị nội dung của tệp hoặc đầu ra (output) từ các lệnh, và trong văn bản để chỉ các từ xuất hiện trong mã C (C code) hoặc các chuỗi ký tự cố định khác.

*Chiều rộng hằng in nghiêng (Constant Width Italic)*

Được sử dụng để chỉ văn bản bên trong các lệnh mà người dùng sẽ thay thế bằng một giá trị thực tế.

#### Chiều rộng hằng in đậm (Constant Width Bold)

Được sử dụng trong các ví dụ để hiển thị các lệnh hoặc văn bản khác mà người dùng phải gõ chính xác theo nghĩa đen.

Hãy đặc biệt chú ý đến các ghi chú được tách biệt khỏi văn bản bằng các biểu tượng sau:

Đây là một mẹo (tip). Nó chứa thông tin bổ sung hữu ích về chủ đề đang được đề cập.

Đây là một cảnh báo (warning). Nó giúp bạn giải quyết và tránh các vấn đề phiền phức.

## Sử dụng Ví dụ Mã nguồn

Cuốn sách này ở đây để giúp bạn hoàn thành công việc của mình. Nhìn chung, bạn có thể sử dụng mã nguồn trong cuốn sách này cho các chương trình và tài liệu của mình. Các mẫu mã nguồn được bao phủ bởi giấy phép kép BSD/GPL (dual BSD/GPL license).

Chúng tôi đánh giá cao, nhưng không bắt buộc, việc trích dẫn nguồn (attribution). Việc trích dẫn nguồn thường bao gồm tiêu đề, tác giả, nhà xuất bản và ISBN. Ví dụ: "*Linux Device Drivers*, Xuất bản lần thứ ba, bởi Jonathan Corbet, Alessandro Rubini và Greg Kroah-Hartman. Bản quyền 2005 O'Reilly Media, Inc., 0-596-00590-3."

## Chúng tôi rất muốn lắng nghe từ bạn

Vui lòng gửi các nhận xét và câu hỏi liên quan đến cuốn sách này tới nhà xuất bản:

O'Reilly Media, Inc.

1005 Gravenstein Highway North

Sebastopol, CA 95472

(800) 998-9938 (tại Hoa Kỳ hoặc Canada)

(707) 829-0515 (quốc tế hoặc địa phương)

(707) 829-0104 (fax)

Chúng tôi có một trang web dành cho cuốn sách này, nơi chúng tôi liệt kê các lỗi đính chính (errata), ví dụ và bất kỳ thông tin bổ sung nào. Bạn có thể truy cập trang này tại:

*http://www.oreilly.com/catalog/linuxdrive3*

Để nhận xét hoặc đặt câu hỏi kỹ thuật về cuốn sách này, hãy gửi email tới:

*bookquestions@oreilly.com*

Để biết thêm thông tin về sách, hội nghị, Trung tâm Tài nguyên (Resource Centers) và Mạng lưới O'Reilly của chúng tôi, hãy xem trang web tại:

*http://www.oreilly.com*

## Tích hợp Safari (Safari Enabled)

Khi bạn nhìn thấy biểu tượng Safari® Enabled trên bìa của cuốn sách công nghệ yêu thích của mình, điều đó có nghĩa là cuốn sách đó có sẵn trực tuyến thông qua O'Reilly Network Safari Bookshelf.

Safari cung cấp một giải pháp tốt hơn sách điện tử (e-books). Đây là một thư viện ảo cho phép bạn dễ dàng tìm kiếm hàng ngàn cuốn sách công nghệ hàng đầu, sao chép và dán các mẫu mã nguồn, tải xuống các chương và tìm kiếm câu trả lời nhanh chóng khi bạn cần thông tin chính xác và cập nhật nhất. Hãy dùng thử miễn phí tại *http://safari.oreilly.com*.

## Lời cảm ơn

Cuốn sách này, tất nhiên, không được viết ra trong sự cô lập; chúng tôi xin gửi lời cảm ơn đến rất nhiều người đã giúp biến nó thành hiện thực.

Cảm ơn biên tập viên của chúng tôi, Andy Oram; cuốn sách này đã trở thành một sản phẩm tốt hơn rất nhiều nhờ những nỗ lực của ông. Và hiển nhiên chúng tôi nợ rất nhiều người thông minh, những người đã đặt nền móng về mặt triết học và thực tiễn cho sự hồi sinh của phần mềm tự do (free software) hiện tại.

Ấn bản đầu tiên đã được kiểm duyệt kỹ thuật (technical review) bởi Alan Cox, Greg Hankins, Hans Lermen, Heiko Eissfeldt và Miguel de Icaza (sắp xếp theo thứ tự bảng chữ cái của tên). Các chuyên gia đánh giá kỹ thuật cho ấn bản thứ hai là Allan B. Cruse, Christian Morgner, Jake Edge, Jeff Garzik, Jens Axboe, Jerry Cooperstein, Jerome Peter Lynch, Michael Kerrisk, Paul Kinzelman và Raph Levien. Những người đánh giá cho ấn bản thứ ba là Allan B. Cruse, Christian Morgner, James Bottomley, Jerry Cooperstein, Patrick Mochel, Paul Kinzelman và Robert Love. Cùng nhau, những con người này đã bỏ ra một khối lượng công việc khổng lồ để tìm ra các vấn đề và chỉ ra những cải tiến có thể có đối với văn bản của chúng tôi.

Cuối cùng nhưng chắc chắn không kém phần quan trọng, chúng tôi cảm ơn các nhà phát triển Linux vì công việc không mệt mỏi của họ. Điều này bao gồm cả các lập trình viên kernel (kernel programmer) và những người làm việc ở không gian người dùng (user-space), những người thường bị lãng quên. Trong cuốn sách này, chúng tôi chọn không gọi tên họ để tránh đối xử bất công với ai đó mà chúng tôi có thể quên mất. Đôi khi chúng tôi có ngoại lệ với quy tắc này và gọi tên Linus; chúng tôi hy vọng ông ấy không bận tâm.

### Jon

Tôi phải bắt đầu bằng việc cảm ơn người vợ Laura và các con Michele và Giulia của tôi vì đã làm cho cuộc đời tôi tràn ngập niềm vui và kiên nhẫn chịu đựng sự lơ đễnh của tôi khi làm việc cho ấn bản này. Các thuê bao của LWN.net, bằng sự hào phóng của họ, đã tạo điều kiện cho phần lớn công việc này diễn ra. Các nhà phát triển Linux kernel đã giúp đỡ tôi rất nhiều khi cho phép tôi trở thành một phần trong cộng đồng của họ, trả lời các câu hỏi của tôi và hướng dẫn tôi đi đúng hướng khi tôi bối rối. Xin gửi lời cảm ơn đến độc giả của ấn bản thứ hai của cuốn sách này, những người có ý kiến đóng góp, được đưa ra tại các buổi gặp mặt Linux trên phần lớn thế giới,

đã mang lại sự hài lòng và đầy cảm hứng. Và tôi đặc biệt muốn cảm ơn Alessandro Rubini vì đã khởi xướng toàn bộ công việc này từ ấn bản đầu tiên (và đồng hành cùng nó cho đến ấn bản hiện tại); cùng với Greg Kroah-Hartman, người đã đem kỹ năng đáng kể của mình áp dụng vào một số chương, mang lại kết quả tuyệt vời.

### Alessandro

Tôi muốn cảm ơn những người đã làm cho công việc này thành hiện thực. Trước hết, sự kiên nhẫn đáng kinh ngạc của Federica, người thậm chí đã cho phép tôi duyệt lại ấn bản đầu tiên ngay trong tuần trăng mật của chúng tôi, với một chiếc máy tính xách tay trong lều. Tôi muốn cảm ơn Giorgio và Giulia, những người đã tham gia vào các ấn bản sau của cuốn sách và vui vẻ chấp nhận là con của "một gnu" người mà thường làm việc đến tận khuya. Tôi mang ơn rất nhiều tác giả phần mềm tự do, những người thực sự đã dạy tôi cách lập trình bằng cách cung cấp các công trình của họ cho bất kỳ ai nghiên cứu. Nhưng đối với ấn bản này, tôi biết ơn nhất Jon và Greg, những người bạn đồng hành tuyệt vời trong công việc này; nó sẽ không thể tồn tại nếu thiếu một trong hai hoặc cả hai người họ, vì mã nguồn (code base) ngày càng lớn hơn và khó khăn hơn, trong khi thời gian của tôi lại là một tài nguyên khan hiếm hơn, luôn bị tranh giành bởi khách hàng, các vấn đề về phần mềm tự do và những hạn chót đã qua. Jon đã là một người lãnh đạo tuyệt vời cho ấn bản này; cả hai đều rất năng suất và vô giá về mặt kỹ thuật khi bổ sung cho góc nhìn lập trình quy mô nhỏ và hệ thống nhúng (embedded) của tôi bằngexpertise (chuyên môn) của họ về SMP và các hệ thống tính toán hiệu năng cao (number cruncher).

### Greg

Tôi muốn gửi lời cảm ơn chân thành đến người vợ Shannon cùng các con Madeline và Griffin của tôi vì sự thấu hiểu và kiên nhẫn của họ trong suốt thời gian tôi dành để thực hiện cuốn sách này. Nếu không có sự ủng hộ của họ đối với các nỗ lực phát triển Linux ban đầu của tôi, tôi đã không thể hoàn thành cuốn sách này. Tôi cũng xin gửi lời cảm ơn đến Alessandro và Jon vì đã tạo cơ hội cho tôi tham gia viết cuốn sách này; tôi thực sự vinh dự khi được góp mặt trong đó. Tôi vô cùng biết ơn tất cả các lập trình viên Linux kernel, những người đã không quản ngại viết mã nguồn công khai để tôi và những người khác có thể học hỏi rất nhiều chỉ bằng cách đọc chúng. Ngoài ra, xin cảm ơn tất cả những ai từng gửi báo cáo lỗi (bug report), phê bình mã nguồn của tôi, cũng như chỉ trích tôi vì những lỗi ngớ ngẩn; tất cả các bạn đã dạy tôi rất nhiều điều về cách trở thành một lập trình viên giỏi hơn và, qua tất cả những điều đó, đã làm cho tôi cảm thấy vô cùng ấm áp khi được trở thành một phần của cộng đồng này. Xin cảm ơn các bạn.
