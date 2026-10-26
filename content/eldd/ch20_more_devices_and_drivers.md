# Chương 20. Thêm nhiều Thiết bị và Trình điều khiển (Devices and Drivers)

| Trong chương này      |     |
|-----------------------|-----|
| Báo cáo ECC           | 578 |
| Điều chỉnh Tần số     | 583 |
| Bộ điều khiển Nhúng   | 584 |
| ACPI                  | 585 |
| ISA và MCA            | 587 |
| FireWire              | 588 |
| Nhập/Xuất Thông minh  | 589 |
| Vô tuyến Nghiệp dư    | 590 |
| Thoại trên IP (VoIP)  | 590 |
| Kết nối Tốc độ Cao    | 591 |
|                       |     |

Cho đến nay, chúng ta đã dành toàn bộ một chương cho mỗi lớp trình điều khiển thiết bị (device driver class) chính, nhưng vẫn còn một số thư mục con nằm dưới thư mục *drivers/* mà chúng ta chưa khám phá. Trong chương này, hãy cùng bước vào một số thư mục đó với tốc độ nhanh.

## Báo cáo ECC (ECC Reporting)

Một số bộ điều khiển bộ nhớ (memory controllers) chứa phần cứng silicon đặc biệt để đo lường độ tin cậy của dữ liệu được lưu trữ bằng cách sử dụng *mã sửa lỗi* (Error Correcting Codes - ECC). Hệ thống con trình điều khiển *Phát hiện và Sửa lỗi* (Error Detection And Correction - EDAC) thông báo về các sự kiện lỗi bộ nhớ được tạo ra bởi các bộ điều khiển bộ nhớ hỗ trợ ECC. Các chip DRAM hỗ trợ ECC điển hình có khả năng sửa *lỗi đơn bit* (single-bit errors - SBE) và phát hiện *lỗi đa bit* (multibit errors - MBE). Theo thuật ngữ của EDAC, lỗi trước là *lỗi có thể sửa được* (correctable errors - CEs), trong khi lỗi sau là *lỗi không thể sửa được* (uncorrectable errors - UEs).

Các hoạt động ECC hoàn toàn trong suốt đối với hệ điều hành (operating system). Điều này có nghĩa là nếu bộ điều khiển DRAM của bạn hỗ trợ ECC, việc sửa lỗi và phát hiện lỗi sẽ diễn ra âm thầm mà không cần sự tham gia của hệ điều hành. Nhiệm vụ của EDAC là báo cáo các sự kiện đó và cho phép người dùng thiết lập các chính sách xử lý lỗi (chẳng hạn như thay thế một chip DRAM khả nghi).

Hệ thống con trình điều khiển EDAC bao gồm các thành phần sau:

- Một module nhân (core module) có tên là *edac\_mc* cung cấp tập hợp các hàm thư viện (library routines).
- Các trình điều khiển riêng biệt để tương tác với các bộ điều khiển bộ nhớ được hỗ trợ. Ví dụ, module trình điều khiển hoạt động với bộ điều khiển bộ nhớ nằm trong North Bridge của Intel 82860 có tên là *i82860\_edac*.

EDAC báo cáo các lỗi thông qua các tệp nằm trong thư mục sysfs, */sys/devices/system/edac/*. Nó cũng tạo ra các thông điệp có thể được thu thập từ nhật ký lỗi của kernel (kernel error log).

Bố cục của các chip DRAM được xác định dựa trên số lượng đường chọn chip (chip-selects) xuất phát từ bộ điều khiển bộ nhớ và độ rộng truyền dữ liệu (channels) giữa bộ điều khiển bộ nhớ và CPU. Số lượng hàng trong mảng chip DRAM phụ thuộc vào yếu tố trước, trong khi số lượng cột phụ thuộc vào yếu tố sau. Một trong những mục tiêu chính của EDAC là chỉ ra thủ phạm nghi ngờ là các chip DRAM bị lỗi, do đó cấu trúc nút sysfs của EDAC được thiết kế tương ứng với bố cục chip vật lý: */sys/devices/system/edac/mc/mcX/csrowY/* tương ứng với hàng chọn chip Y trong bộ điều khiển bộ nhớ X. Mỗi thư mục như vậy chứa các chi tiết như số lượng CE được phát hiện (ce\_count), UE (ue\_count), vị trí kênh (channel location) và các thuộc tính khác.

### Ví dụ về Thiết bị: Bộ điều khiển Bộ nhớ Hỗ trợ ECC (ECC-Aware Memory Controller)

Hãy thêm hỗ trợ EDAC (Error Detection and Correction) cho một bộ điều khiển bộ nhớ chưa được hỗ trợ. Giả sử rằng bạn đang đưa hệ điều hành Linux lên một thiết bị y tế sử dụng vi kiến trúc x86 nhúng (embedded x86 derivative). Chipset North Bridge (bao gồm bộ điều khiển bộ nhớ được thảo luận trong phần thanh bên "The North Bridge" ở Chương 12, "Video Drivers") trên bo mạch của bạn là Intel 855GME, có khả năng báo cáo lỗi ECC. Tất cả các ngân hàng DRAM (DRAM banks) được kết nối với 855GME trên hệ thống này đều là các chip bật tính năng ECC (ECC-enabled) vì đây là một thiết bị quan trọng sống còn (life-critical device). EDAC chưa hỗ trợ 855GME, vì vậy chúng ta hãy thử triển khai nó.

Các bộ điều khiển DRAM hỗ trợ ECC có hai thanh ghi chính liên quan đến ECC: thanh ghi trạng thái lỗi (error status register) và thanh ghi con trỏ địa chỉ lỗi (error address pointer register), như được hiển thị trong Bảng 20.1. Khi xảy ra lỗi ECC, thanh ghi trước chứa trạng thái (liệu lỗi là SBE hay MBE), trong khi thanh ghi sau chứa địa chỉ vật lý (physical address) nơi xảy ra lỗi. Nhân (kernel) EDAC định kỳ kiểm tra các thanh ghi này và báo cáo kết quả cho không gian người dùng (user space) thông qua sysfs. Từ góc độ cấu hình, tất cả các thiết bị bên trong 855GME xuất hiện trên PCI bus 0. Bộ điều khiển DRAM nằm ở device 0 của bus này. Các thanh ghi điều khiển giao diện DRAM (bao gồm các thanh ghi đặc thù cho ECC) được ánh xạ (map) vào không gian cấu hình PCI (PCI configuration space) tương ứng. Để thêm hỗ trợ EDAC cho 855GME, hãy thêm các móc nối (hooks) để đọc các thanh ghi này, như được minh họa trong Đoạn mã 20.1 (Listing 20.1). Hãy tham khảo lại Chương 10, "Peripheral Component Interconnect," để có giải thích về các phương thức trình điều khiển thiết bị PCI (PCI device driver methods) và cấu trúc dữ liệu (data structures).

| I855_ERRSTS_REGISTER | Thanh ghi trạng thái lỗi, có chức năng báo hiệu<br>sự xuất hiện của lỗi ECC. Cho biết<br>lỗi là SBE hay MBE. |
|----------------------|-------------------------------------------------------------------------------------------------------------------------|
| I855_EAP_REGISTER    | Thanh ghi con trỏ địa chỉ lỗi, chứa địa chỉ<br>vật lý nơi xảy ra lỗi ECC gần đây nhất. |

### Đoạn mã 20.1. Trình điều khiển EDAC cho 855GME (An EDAC Driver for the 855GME)

```c
/* Based on drivers/edac/i82860_edac.c */
## define I855_PCI_DEVICE_ID 0x3584 /* PCI Device ID of the memory
 controller in the 855 GME */
## define I855_ERRSTS_REGISTER 0x62 /* Error Status Register's offset
 in the PCI configuration space */
## define I855_EAP_REGISTER 0x98 /* Error Address Pointer Register's
 offset in the PCI configuration space */
struct i855_error_info {
 u16 errsts; /* Error Type */
 u32 eap; /* Error Location */
};
/* Get error information */
static void
i855_get_error_info(struct mem_ctl_info *mci,
 struct i855_error_info *info)
{
 struct pci_dev *pdev;
 pdev = to_pci_dev(mci->dev);
 /* Read error type */
 pci_read_config_word(pdev, I855_ERRSTS_REGISTER, &info->errsts);
 /* Read error location */
 pci_read_config_dword(pdev, I855_EAP_REGISTER, &info->eap);
}
/* Process errors */
static int
i855_process_error_info(struct mem_ctl_info *mci,
 struct i855_error_info *info,
 int handle_errors)
{
 int row;
 info->eap >>= PAGE_SHIFT;
 row = edac_mc_find_csrow_by_page(mci, info->eap); /* Find culprit row */
 /* Handle using services provided by the EDAC core.
 Populate sysfs, generate error messages, and so on */
 if (is_MBE()) { /* is_MBE() looks at I855_ERRSTS_REGISTER and checks
 for an MBE. Implementation not shown */
```

```c
 edac_mc_handle_ue(mci, info->eap, 0, row, "i855 UE");
 } else if (is_SBE()) { /* is_SBE() looks at I855_ERRSTS_REGISTER and checks
 for an SBE. Implementation not shown */
 edac_mc_handle_ce(mci, info->eap, 0, info->derrsyn, row, 0,
 "i855 CE");
 }
 return 1;
}
/* This method is registered with the EDAC core from i855_probe() */
static void
i855_check(struct mem_ctl_info *mci)
{
 struct i855_error_info info;
 i855_get_error_info(mci, &info);
 i855_process_error_info(mci, &info, 1);
}
/* The PCI driver probe method, part of the pci_driver structure */
static int
i855_probe(struct pci_dev *pdev, int dev_idx)
{
 struct mem_ctl_info *mci;
 /* ... */
 pci_enable_device(pdev);
 /* Allocate control memory for this memory controller.
 The 3 arguments to edac_mc_alloc() correspond to the
 amount of requested private storage, number of chip-select
 rows, and number of channels in your memory layout */
 mci = edac_mc_alloc(0, CSROWS, CHANNELS);
 /* ... */
 mci->edac_check = i855_check; /* Supply the check method to the
 EDAC core */
 /* Do other memory controller initializations */
 /* ... */
 /* Register this memory controller with the EDAC core */
 edac_mc_add_mc(mci, 0);
 /* ... */
}
/* Remove method */
static void __devexit
i855_remove(struct pci_dev *pdev)
{
 struct mem_ctl_info *mci = edac_mc_find_mci_by_pdev(pdev);
 if (mci && !edac_mc_del_mc(mci)) {
 edac_mc_free(mci); /* Free memory for this controller. Reverse
 of edac_mc_alloc() */
 }
}
/* PCI Device ID Table */
static const struct pci_device_id i855_pci_tbl[] __devinitdata = {
 {PCI_VEND_DEV(INTEL, I855_PCI_DEVICE_ID),
 PCI_ANY_ID, PCI_ANY_ID, 0, 0,},
```

```c
 {0,},
};
MODULE_DEVICE_TABLE(pci, i855_pci_tbl);
/* Cấu trúc pci_driver cho thiết bị này.
 Hãy xem lại Chương 10 để có giải thích chi tiết */
static struct pci_driver i855_driver = {
 .name = "855",
 .probe = i855_probe,
 .remove = __devexit_p(i855_remove),
 .id_table = i855_pci_tbl,
};
/* Khởi tạo Driver (Driver Initialization) */
static int __init
i855_init(void)
{
 /* ... */
 pci_rc = pci_register_driver(&i855_driver);
 /* ... */
}
```

Hãy xem thư mục *drivers/edac/\** để tìm các tệp mã nguồn EDAC và xem tài liệu *Documentation/drivers/edac/edac.txt* để biết ngữ nghĩa chi tiết của các node sysfs EDAC.
