## Essential Linux Device Drivers - Mục lục các chương

Sách gốc: *Essential Linux Device Drivers* - Sreekrishnan Venkateswaran (Prentice Hall, 2008).
Mỗi chương (chapter) là một tệp Markdown riêng biệt trong thư mục này.

## Mục lục

| Ch | Tệp | Chủ đề | Từ khóa |
|----|------|--------|---------|
| 0 | ch00_frontmatter.md | Lời nói đầu và Giới thiệu (Frontmatter) | book overview, summary of chapters, conventions |
| 1 | ch01_introduction.md | Giới thiệu (Introduction) | Linux evolution, GNU copyleft, kernel.org, distributions, building kernel, loadable modules |
| 2 | ch02_a_peek_inside_the_kernel.md | Khám phá bên trong Kernel (A Peek Inside the Kernel) | boot process, kernel/user mode, process/interrupt context, kernel timers, concurrency, /proc, memory allocation |
| 3 | ch03_kernel_facilities.md | Các tiện ích của Kernel (Kernel Facilities) | kernel threads, linked lists, work queues, completion functions, notifier chains, kthread, hash lists |
| 4 | ch04_laying_the_groundwork.md | Đặt nền móng (Laying the Groundwork) | interrupt handling, device model, sysfs, kobject, udev, hotplug, firmware loading, microcode |
| 5 | ch05_character_drivers.md | Trình điều khiển thiết bị ký tự (Character Drivers) | char device, cdev, file_operations, ioctl, poll, async notification, major/minor numbers |
| 6 | ch06_serial_drivers.md | Trình điều khiển nối tiếp (Serial Drivers) | UART, tty layer, line discipline, serial core, uart_driver, uart_port, uart_ops |
| 7 | ch07_input_drivers.md | Trình điều khiển thiết bị đầu vào (Input Drivers) | input subsystem, evdev, keyboard, mouse, touch screen, input_event, accelerometer |
| 8 | ch08_the_inter_integrated_circuit_protocol.md | Giao thức Inter-Integrated Circuit (I2C Protocol) | I2C, SMBus, i2c_driver, i2c_client, EEPROM, SPI bus, 1-wire bus |
| 9 | ch09_pcmcia_and_compact_flash.md | PCMCIA và Compact Flash (PCMCIA and Compact Flash) | PCMCIA, CF, Card Services, pcmcia_driver, CIS tuples, CardBus |
| 10 | ch10_peripheral_component_interconnect.md | Chuẩn liên kết thiết bị ngoại vi (PCI - Peripheral Component Interconnect) | PCI, pci_driver, pci_dev, DMA, bus mastering, ISA, configuration space |
| 11 | ch11_universal_serial_bus.md | Bus nối tiếp vạn năng (USB - Universal Serial Bus) | USB, URB, usb_driver, endpoints, pipes, hub, gadget drivers, OTG |
| 12 | ch12_video_drivers.md | Trình điều khiển Video (Video Drivers) | framebuffer, fb_info, fb_ops, console, V4L2, video capture, LCD controller |
| 17 | ch17_memory_technology_devices.md | Thiết bị công nghệ bộ nhớ (Memory Technology Devices) | MTD, flash memory, NOR, NAND, CFI, Firmware Hub, partitions |
| 18 | ch18_embedding_linux.md | Nhúng Linux (Embedding Linux) | embedded Linux, bootloader, kernel porting, device drivers, root filesystem |
| 19 | ch19_drivers_in_user_space.md | Trình điều khiển ở không gian người dùng (Drivers in User Space) | UIO, user-space drivers, mmap, /dev/mem, process scheduler, SCHED_FIFO |
| 20 | ch20_more_devices_and_drivers.md | Các thiết bị và Trình điều khiển khác (More Devices and Drivers) | EDAC, FireWire, ACPI, ISA, EISA, watchdog, RTC |
| 21 | ch21_debugging_device_drivers.md | Gỡ lỗi trình điều khiển thiết bị (Debugging Device Drivers) | printk, debugfs, kgdb, kprobes, crash dump, profiling, OProfile, LTTng |
| 22 | ch22_maintenance_and_delivery.md | Bảo trì và Phân phối (Maintenance and Delivery) | software lifecycle, kernel updates, patch management |
| 23 | ch23_shutting_down.md | Lời kết (Shutting Down) | device enabling checklist, what next, kernel contribution |

**Lưu ý:** Sách gốc không bao gồm các chương từ 13 đến 16 (Audio, Block, Network, Wireless) trong tệp này.
