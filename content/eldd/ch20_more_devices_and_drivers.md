# Chương 20: Các thiết bị và Trình điều khiển khác (More Devices and Drivers)

| Trong chương này           | Trang |
|----------------------------|-------|
| Báo cáo ECC                | 578   |
| Điều chỉnh Tần số          | 583   |
| Bộ điều khiển Nhúng        | 584   |
| ACPI                       | 585   |
| ISA và MCA                 | 587   |
| FireWire                   | 588   |
| Nhập/Xuất Thông minh (I2O) | 589   |
| Vô tuyến Nghiệp dư         | 590   |
| Truyền thanh qua IP (VoIP) | 590   |
| Kết nối Tốc độ Cao         | 591   |

Cho đến nay, chúng ta đã dành trọn từng chương cho từng lớp trình điều khiển thiết bị (device driver class) chính, nhưng vẫn còn nhiều thư mục con nằm dưới `drivers/` mà chúng ta chưa khám phá. Trong chương này, hãy cùng lướt nhanh qua một vài thư mục trong số đó.

## Báo cáo ECC

Một số bộ điều khiển bộ nhớ (memory controllers) chứa phần cứng silicon đặc biệt để kiểm tra độ tin cậy của dữ liệu lưu trữ bằng cách sử dụng *mã sửa lỗi* (Error Correcting Codes - ECC). Hệ thống con trình điều khiển *Phát hiện và Sửa lỗi* (Error Detection And Correction - EDAC) có nhiệm vụ thông báo các sự kiện lỗi bộ nhớ do bộ điều khiển bộ nhớ hỗ trợ ECC phát ra. Các chip DRAM ECC điển hình có khả năng sửa *lỗi đơn bit* (single-bit errors - SBE) và phát hiện *lỗi đa bit* (multibit errors - MBE). Theo thuật ngữ của EDAC, các lỗi đơn bit được gọi là *lỗi có thể sửa* (correctable errors - CE), trong khi các lỗi đa bit là *lỗi không thể sửa* (uncorrectable errors - UE).

Các hoạt động ECC hoàn toàn trong suốt đối với hệ điều hành (operating system). Điều này có nghĩa là nếu bộ điều khiển DRAM của bạn hỗ trợ ECC, quá trình sửa lỗi và phát hiện lỗi sẽ diễn ra âm thầm mà không cần sự can thiệp của hệ điều hành. Nhiệm vụ của EDAC là báo cáo các sự kiện đó và cho phép người dùng thiết lập các chính sách xử lý lỗi (chẳng hạn như thay thế chip DRAM bị nghi ngờ hỏng).

Hệ thống con trình điều khiển EDAC bao gồm các thành phần sau:

- Một module lõi (core module) có tên là `edac_mc` cung cấp tập hợp các hàm thư viện (library routines).
- Các trình điều khiển riêng biệt để tương tác với từng bộ điều khiển bộ nhớ cụ thể. Ví dụ, module trình điều khiển tương tác với bộ điều khiển bộ nhớ nằm trong North Bridge của Intel 82860 có tên là `i82860_edac`.

EDAC báo cáo lỗi thông qua các tệp trong thư mục sysfs: `/sys/devices/system/edac/`. Nó cũng tạo ra các thông điệp log có thể thu thập được từ nhật ký lỗi kernel (kernel error log).

Bố cục của các chip DRAM được xác định dựa trên số lượng đường chọn chip (chip-selects) phát ra từ bộ điều khiển bộ nhớ và độ rộng đường truyền dữ liệu (channels) giữa bộ điều khiển bộ nhớ và CPU. Số lượng hàng trong mảng chip DRAM phụ thuộc vào yếu tố trước, trong khi số lượng cột phụ thuộc vào yếu tố sau. Một trong những mục tiêu chính của EDAC là khoanh vùng và chỉ rõ các chip DRAM đang gặp sự cố, do đó cấu trúc nút sysfs của EDAC được thiết kế tương ứng với bố cục chip vật lý: `/sys/devices/system/edac/mc/mcX/csrowY/` tương ứng với hàng chọn chip Y trong bộ điều khiển bộ nhớ X. Mỗi thư mục như vậy chứa chi tiết như số lượng CE được phát hiện (`ce_count`), số lượng UE (`ue_count`), vị trí kênh (channel location) và các thuộc tính khác.

### Ví dụ về Thiết bị: Bộ điều khiển Bộ nhớ Hỗ trợ ECC

Hãy cùng thêm hỗ trợ EDAC cho một bộ điều khiển bộ nhớ chưa được Linux hỗ trợ. Giả sử bạn đang cài đặt Linux lên một thiết bị y tế dùng vi xử lý biến thể x86 nhúng (embedded x86 derivative). Chipset North Bridge (bao gồm bộ điều khiển bộ nhớ đã được thảo luận trong khung đọc thêm "The North Bridge" ở Chương 12, "Video Drivers") trên bo mạch của bạn là Intel 855GME có khả năng báo cáo ECC. Mọi ngân hàng DRAM (DRAM bank) kết nối với 855GME trên hệ thống này đều là chip hỗ trợ ECC vì đây là thiết bị an toàn tính mạng (life-critical device). EDAC hiện chưa hỗ trợ 855GME, vì vậy hãy cùng bắt tay vào viết trình điều khiển cho nó.

Các bộ điều khiển DRAM ECC có hai thanh ghi chính liên quan đến ECC: thanh ghi trạng thái lỗi (error status register) và thanh ghi con trỏ địa chỉ lỗi (error address pointer register), như mô tả trong Bảng 20.1. Khi xảy ra lỗi ECC, thanh ghi trước chứa trạng thái (cho biết lỗi là SBE hay MBE), trong khi thanh ghi sau chứa địa chỉ vật lý nơi xảy ra lỗi. Lõi EDAC sẽ định kỳ kiểm tra các thanh ghi này và báo cáo kết quả lên không gian người dùng (user space) thông qua sysfs. Từ góc độ cấu hình, tất cả các thiết bị bên trong 855GME đều xuất hiện trên PCI bus 0. Bộ điều khiển DRAM nằm ở device 0 trên bus này. Các thanh ghi điều khiển giao diện DRAM (bao gồm cả các thanh ghi đặc thù của ECC) được ánh xạ vào không gian cấu hình PCI (PCI configuration space) tương ứng. Để thêm hỗ trợ EDAC cho 855GME, ta thêm các hàm móc (hooks) để đọc các thanh ghi này, như minh họa trong Đoạn mã 20.1. Bạn có thể tham khảo lại Chương 10, "Peripheral Component Interconnect", để biết giải thích chi tiết về các phương thức trình điều khiển thiết bị PCI và cấu trúc dữ liệu liên quan.

Bảng 20.1. Thanh ghi ECC của Intel 855GME

| Thanh ghi | Mô tả |
|:---|:---|
| `I855_ERRSTS_REGISTER` | Thanh ghi trạng thái lỗi, có chức năng báo hiệu sự xuất hiện của lỗi ECC. Cho biết lỗi là SBE hay MBE. |
| `I855_EAP_REGISTER` | Thanh ghi con trỏ địa chỉ lỗi, chứa địa chỉ vật lý nơi xảy ra lỗi ECC gần đây nhất. |

### Đoạn mã 20.1. Trình điều khiển EDAC cho Intel 855GME

```c
/* Dựa trên drivers/edac/i82860_edac.c */
## define I855_PCI_DEVICE_ID     0x3584 /* PCI Device ID của bộ điều khiển
                                         bộ nhớ trong 855GME */
## define I855_ERRSTS_REGISTER  0x62   /* Offset của Thanh ghi Trạng thái Lỗi
                                         trong không gian cấu hình PCI */
## define I855_EAP_REGISTER     0x98   /* Offset của Thanh ghi Con trỏ Địa chỉ Lỗi
                                         trong không gian cấu hình PCI */

struct i855_error_info {
    u16 errsts; /* Loại lỗi */
    u32 eap;    /* Vị trí lỗi */
};

/* Lấy thông tin lỗi */
static void
i855_get_error_info(struct mem_ctl_info *mci,
                    struct i855_error_info *info)
{
    struct pci_dev *pdev;
    pdev = to_pci_dev(mci->dev);

    /* Đọc loại lỗi */
    pci_read_config_word(pdev, I855_ERRSTS_REGISTER, &info->errsts);

    /* Đọc vị trí lỗi */
    pci_read_config_dword(pdev, I855_EAP_REGISTER, &info->eap);
}

/* Xử lý lỗi */
static int
i855_process_error_info(struct mem_ctl_info *mci,
                        struct i855_error_info *info,
                        int handle_errors)
{
    int row;
    info->eap >>= PAGE_SHIFT;
    row = edac_mc_find_csrow_by_page(mci, info->eap); /* Tìm hàng gây lỗi */

    /* Xử lý bằng các dịch vụ do lõi EDAC cung cấp.
       Cập nhật sysfs, tạo thông điệp lỗi, v.v. */
    if (is_MBE()) { /* is_MBE() kiểm tra I855_ERRSTS_REGISTER xem có phải MBE không.
                       Phần cài đặt không hiển thị ở đây */
        edac_mc_handle_ue(mci, info->eap, 0, row, "i855 UE");
    } else if (is_SBE()) { /* is_SBE() kiểm tra I855_ERRSTS_REGISTER xem có phải SBE không.
                              Phần cài đặt không hiển thị ở đây */
        edac_mc_handle_ce(mci, info->eap, 0, info->derrsyn, row, 0,
                           "i855 CE");
    }
    return 1;
}

/* Phương thức này được đăng ký với lõi EDAC từ i855_probe() */
static void
i855_check(struct mem_ctl_info *mci)
{
    struct i855_error_info info;
    i855_get_error_info(mci, &info);
    i855_process_error_info(mci, &info, 1);
}

/* Phương thức probe của PCI driver, thuộc cấu trúc pci_driver */
static int
i855_probe(struct pci_dev *pdev, int dev_idx)
{
    struct mem_ctl_info *mci;

    /* ... */
    pci_enable_device(pdev);

    /* Cấp phát bộ nhớ điều khiển cho bộ điều khiển bộ nhớ này.
       3 tham số của edac_mc_alloc() tương ứng với:
       dung lượng bộ nhớ riêng yêu cầu, số hàng chọn chip (csrow),
       và số lượng kênh trong bố cục bộ nhớ của bạn */
    mci = edac_mc_alloc(0, CSROWS, CHANNELS);
    /* ... */

    mci->edac_check = i855_check; /* Cung cấp phương thức kiểm tra cho lõi EDAC */

    /* Thực hiện các khởi tạo khác cho bộ điều khiển bộ nhớ */
    /* ... */

    /* Đăng ký bộ điều khiển bộ nhớ này với lõi EDAC */
    edac_mc_add_mc(mci, 0);
    /* ... */
}

/* Phương thức gỡ bỏ Driver */
static void __devexit
i855_remove(struct pci_dev *pdev)
{
    struct mem_ctl_info *mci = edac_mc_find_mci_by_pdev(pdev);
    if (mci && !edac_mc_del_mc(mci)) {
        edac_mc_free(mci); /* Giải phóng bộ nhớ của bộ điều khiển này.
                              Ngược lại với edac_mc_alloc() */
    }
}

/* Bảng PCI Device ID */
static const struct pci_device_id i855_pci_tbl[] __devinitdata = {
    {PCI_VEND_DEV(INTEL, I855_PCI_DEVICE_ID),
     PCI_ANY_ID, PCI_ANY_ID, 0, 0,},
    {0,},
};
MODULE_DEVICE_TABLE(pci, i855_pci_tbl);

/* Cấu trúc pci_driver cho thiết bị này.
   Tham khảo Chương 10 để biết giải thích chi tiết */
static struct pci_driver i855_driver = {
    .name = "855",
    .probe = i855_probe,
    .remove = __devexit_p(i855_remove),
    .id_table = i855_pci_tbl,
};

/* Khởi tạo Driver */
static int __init
i855_init(void)
{
    /* ... */
    pci_rc = pci_register_driver(&i855_driver);
    /* ... */
}
```

Hãy tham khảo thư mục `drivers/edac/` để xem các tệp mã nguồn EDAC và tệp `Documentation/drivers/edac/edac.txt` để biết ngữ nghĩa chi tiết của các nút sysfs thuộc EDAC.
