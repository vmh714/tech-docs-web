## Linux Device Drivers, 3rd Edition - Chỉ mục Chương

Sách gốc: *Linux Device Drivers, 3rd Edition* - Jonathan Corbet, Alessandro Rubini, Greg Kroah-Hartman (O'Reilly, 2005).
Mỗi chương (chapter) là một tệp (file) Markdown riêng biệt trong thư mục này.

## Mục lục

| Ch | File | Chủ đề | Từ khóa |
|----|------|--------|---------|
| 0 | ch00_frontmatter.md | Lời nói đầu & Lời cảm ơn | book overview, audience, organization, Creative Commons license |
| 1 | ch01_an_introduction_to_device_drivers.md | Giới thiệu về Driver Thiết bị (Device Driver) | mechanism vs policy, kernel modules, device classes, security, licensing |
| 2 | ch02_building_and_running_modules.md | Xây dựng và Chạy Module | module_init, module_exit, Makefile, insmod, modprobe, kernel symbol table, module parameters |
| 3 | ch03_char_drivers.md | Driver Ký tự (Char Driver) | scull, major/minor, cdev, file_operations, open, read, write, ioctl |
| 4 | ch04_debugging_techniques.md | Kỹ thuật Gỡ lỗi (Debugging) | printk, /proc, oops, strace, gdb, kdb, kgdb, SysRq |
| 5 | ch05_concurrency_and_race_conditions.md | Tính đồng thời và Điều kiện tranh chấp (Concurrency and Race Conditions) | semaphore, mutex, spinlock, atomic, completion, seqlock, RCU |
| 6 | ch06_advanced_char_driver_operations.md | Các thao tác nâng cao của Driver Ký tự | ioctl, blocking I/O, poll, select, async notification, seek, access control |
| 7 | ch07_time_delays_and_deferred_work.md | Thời gian, Độ trễ và Công việc trì hoãn (Deferred Work) | jiffies, HZ, timer, tasklet, workqueue, delay, kernel timer |
| 8 | ch08_allocating_memory.md | Cấp phát Bộ nhớ (Allocating Memory) | kmalloc, kfree, GFP flags, slab cache, vmalloc, per-CPU variables, boot-time allocation |
| 9 | ch09_communicating_with_hardware.md | Giao tiếp với Phần cứng | I/O ports, I/O memory, ioremap, inb/outb, memory barriers, ISA, PCI |
| 10 | ch10_interrupt_handling.md | Xử lý Ngắt (Interrupt Handling) | request_irq, free_irq, top half, bottom half, tasklet, shared IRQ, interrupt-driven I/O |
| 11 | ch11_data_types_in_the_kernel.md | Các Kiểu dữ liệu trong Kernel | portability, __u32, size_t, PAGE_SIZE, byte order, alignment, linked lists |
| 12 | ch12_pci_drivers.md | Driver PCI | PCI bus, pci_driver, pci_dev, configuration space, DMA, bus mastering, ISA |
| 13 | ch13_usb_drivers.md | Driver USB | USB, URB, usb_driver, endpoints, pipes, usb-skeleton, control/bulk/interrupt/isochronous |
| 14 | ch14_the_linux_device_model.md | Mô hình Thiết bị Linux (The Linux Device Model) | kobject, kset, subsystem, sysfs, device model, bus_type, device_driver, class |
| 15 | ch15_memory_mapping_and_dma.md | Ánh xạ Bộ nhớ và DMA (Memory Mapping and DMA) | mmap, vm_area_struct, remap_pfn_range, DMA, scatter-gather, dma_alloc_coherent |
| 16 | ch16_block_drivers.md | Driver Khối (Block Driver) | block device, request queue, gendisk, bio, I/O scheduler, sbull |
| 17 | ch17_network_drivers.md | Driver Mạng (Network Driver) | net_device, sk_buff, NAPI, ethtool, MII, snull, packet transmission/reception |
| 18 | ch18_tty_drivers.md | Driver TTY | tty_driver, tty_operations, tty_struct, line discipline, serial port |
