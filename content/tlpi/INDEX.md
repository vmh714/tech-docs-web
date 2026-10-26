## The Linux Programming Interface - Chapter Index

Sách gốc: *The Linux Programming Interface* - Michael Kerrisk.
Mỗi chương (chapter) là một file markdown riêng biệt trong thư mục này.

## Mục lục

| Ch | File | Chủ đề | Từ khóa |
|----|------|--------|---------|
| 1 | ch01_history_and_standards.md | History and Standards | UNIX history, C language, POSIX, SUSv3, SUSv4, Linux Standard Base |
| 2 | ch02_fundamental_concepts.md | Fundamental Concepts | kernel, shell, users, groups, file system, process, memory mapping, signals, threads, /proc |
| 3 | ch03_system_programming_concepts.md | System Programming Concepts | system calls, library functions, glibc, error handling, errno, portability, feature test macros |
| 4 | ch04_file_io_the_universal_io_model.md | File I/O: The Universal I/O Model | open(), read(), write(), close(), file descriptors, O_CREAT, O_RDONLY, O_WRONLY |
| 5 | ch05_file_io_further_details.md | File I/O: Further Details | fcntl(), pread(), pwrite(), readv(), writev(), scatter-gather I/O, truncate(), /dev/fd, temporary files |
| 6 | ch06_processes.md | Processes | process ID, memory layout, text/data/stack/heap, virtual memory, argc/argv, environment, setjmp(), longjmp() |
| 7 | ch07_memory_allocation.md | Memory Allocation | malloc(), free(), calloc(), realloc(), brk(), sbrk(), alloca(), heap, program break |
| 8 | ch08_users_and_groups.md | Users and Groups | /etc/passwd, /etc/group, /etc/shadow, getpwnam(), getpwuid(), getgrnam() |
| 9 | ch09_process_credentials.md | Process Credentials | real UID/GID, effective UID/GID, saved set-user-ID, set-group-ID, supplementary groups, setuid(), setgid() |
| 10 | ch10_time.md | Time | calendar time, time_t, broken-down time, strftime(), gettimeofday(), clock_gettime(), process time |
| 11 | ch11_system_limits_and_options.md | System Limits and Options | sysconf(), pathconf(), fpathconf(), _POSIX_*, _SC_*, _PC_* |
| 12 | ch12_system_and_process_information.md | System and Process Information | /proc filesystem, /proc/PID, uname(), /proc/sys |
| 13 | ch13_file_io_buffering.md | File I/O Buffering | kernel buffer cache, stdio buffering, setvbuf(), fflush(), fsync(), fdatasync(), O_DIRECT |
| 14 | ch14_file_systems.md | File Systems | device files, major/minor, partitions, inodes, ext2/ext3/ext4, VFS, journaling, mount(), umount(), statvfs() |
| 15 | ch15_file_attributes.md | File Attributes | stat(), lstat(), fstat(), file permissions, chmod(), chown(), umask, sticky bit, set-user-ID |
| 16 | ch16_extended_attributes.md | Extended Attributes | EA namespaces, user/system/trusted/security, setxattr(), getxattr(), listxattr(), removexattr() |
| 17 | ch17_access_control_lists.md | Access Control Lists | ACL, getfacl, setfacl, ACL_MASK, default ACL, POSIX ACL API |
| 18 | ch18_directories_and_links.md | Directories and Links | hard links, symbolic links, link(), symlink(), unlink(), rename(), opendir(), readdir(), nftw(), chroot(), realpath() |
| 19 | ch19_monitoring_file_events.md | Monitoring File Events | inotify, inotify_init(), inotify_add_watch(), IN_CREATE, IN_MODIFY, IN_DELETE, dnotify |
| 20 | ch20_signals_fundamental_concepts.md | Signals: Fundamental Concepts | signal disposition, signal(), sigaction(), kill(), raise(), signal mask, pending signals |
| 21 | ch21_signals_signal_handlers.md | Signals: Signal Handlers | async-signal-safe, sig_atomic_t, SA_SIGINFO, sigaltstack(), signal handler design, system call restart |
| 22 | ch22_signals_advanced_features.md | Signals: Advanced Features | core dump, realtime signals, sigqueue(), signalfd(), sigsuspend(), sigwaitinfo() |
| 23 | ch23_timers_and_sleeping.md | Timers and Sleeping | setitimer(), alarm(), sleep(), nanosleep(), POSIX clocks, timer_create(), timerfd |
| 24 | ch24_process_creation.md | Process Creation | fork(), vfork(), copy-on-write, file sharing parent/child, memory semantics |
| 25 | ch25_process_termination.md | Process Termination | _exit(), exit(), atexit(), on_exit(), exit handlers, stdio buffer flushing |
| 26 | ch26_monitoring_child_processes.md | Monitoring Child Processes | wait(), waitpid(), waitid(), WIFEXITED, WIFSIGNALED, orphans, zombies, SIGCHLD |
| 27 | ch27_program_execution.md | Program Execution | execve(), exec() family, PATH, system(), close-on-exec, interpreter scripts |
| 28 | ch28_process_creation_and_program_execution_in_more_detail.md | Process Creation and Program Execution in More Detail | clone(), process accounting, fork/exec effect on process attributes |
| 29 | ch29_threads_introduction.md | Threads: Introduction | pthreads, pthread_create(), pthread_exit(), pthread_join(), pthread_detach(), threads vs processes |
| 30 | ch30_threads_thread_synchronization.md | Threads: Thread Synchronization | mutex, pthread_mutex_lock(), condition variables, pthread_cond_wait(), pthread_cond_signal(), deadlock |

| 31 | ch31_threads_thread_safety_and_per_thread_storage.md | Luồng (Threads): An toàn luồng (Thread Safety) và Bộ nhớ riêng cho từng luồng (Per-Thread Storage) | thread safety, reentrancy, thread-specific data, pthread_key_create(), thread-local storage, __thread |
| 32 | ch32_threads_thread_cancellation.md | Luồng (Threads): Hủy luồng (Thread Cancellation) | pthread_cancel(), cancellation points, cleanup handlers, pthread_cleanup_push() |
| 33 | ch33_threads_further_details.md | Luồng (Threads): Các chi tiết nâng cao | thread stacks, threads and signals, pthread_sigmask(), sigwait(), LinuxThreads, NPTL |
| 34 | ch34_process_groups_sessions_and_job_control.md | Nhóm tiến trình (Process Groups), Phiên làm việc (Sessions) và Kiểm soát công việc (Job Control) | process group, session, setpgid(), setsid(), controlling terminal, SIGHUP, job control |
| 35 | ch35_process_priorities_and_scheduling.md | Độ ưu tiên tiến trình và Lập lịch (Process Priorities and Scheduling) | nice value, SCHED_FIFO, SCHED_RR, SCHED_BATCH, SCHED_IDLE, realtime scheduling, sched_setscheduler() |
| 36 | ch36_process_resources.md | Tài nguyên tiến trình (Process Resources) | getrusage(), resource limits, getrlimit(), setrlimit(), RLIMIT_NOFILE, RLIMIT_NPROC |
| 37 | ch37_daemons.md | Tiến trình nền (Daemons) | daemon creation, setsid(), syslog, openlog(), syslog(), /etc/syslog.conf, SIGHUP reinit |
| 38 | ch38_writing_secure_privileged_programs.md | Viết chương trình đặc quyền bảo mật (Writing Secure Privileged Programs) | set-user-ID security, least privilege, input validation, race conditions, denial-of-service |
| 39 | ch39_capabilities.md | Khả năng đặc quyền (Capabilities) | Linux capabilities, CAP_*, permitted/effective/inheritable sets, capset(), capget() |
| 40 | ch40_login_accounting.md | Kế toán đăng nhập (Login Accounting) | utmp, wtmp, utmpx API, lastlog, login sessions |
| 41 | ch41_fundamentals_of_shared_libraries.md | Cơ bản về Thư viện chia sẻ (Shared Libraries) | static libraries, shared libraries (.so), soname, ldconfig, LD_LIBRARY_PATH, PIC, -fPIC |
| 42 | ch42_advanced_features_of_shared_libraries.md | Tính năng nâng cao của Thư viện chia sẻ (Shared Libraries) | dlopen(), dlsym(), dlclose(), dlerror(), symbol visibility, LD_PRELOAD, LD_DEBUG, version scripts |
| 43 | ch43_interprocess_communication_overview.md | Tổng quan Giao tiếp giữa các tiến trình (Interprocess Communication Overview) | IPC taxonomy, pipes, FIFOs, sockets, shared memory, message queues, semaphores |
| 44 | ch44_pipes_and_fifos.md | Đường ống (Pipes) và FIFO | pipe(), popen(), pclose(), mkfifo(), named pipes, FIFO semantics |
| 45 | ch45_introduction_to_system_v_ipc.md | Giới thiệu về System V IPC | IPC keys, ftok(), ipc_perm, ipcs, ipcrm, IPC_CREAT, IPC_EXCL |
| 46 | ch46_system_v_message_queues.md | Hàng đợi thông điệp System V (System V Message Queues) | msgget(), msgsnd(), msgrcv(), msgctl(), message types, client-server with message queues |
| 47 | ch47_system_v_semaphores.md | Semaphore System V (System V Semaphores) | semget(), semop(), semctl(), semaphore sets, binary semaphore protocol |
| 48 | ch48_system_v_shared_memory.md | Bộ nhớ chia sẻ System V (System V Shared Memory) | shmget(), shmat(), shmdt(), shmctl(), shared memory layout |
| 49 | ch49_memory_mappings.md | Ánh xạ bộ nhớ (Memory Mappings) | mmap(), munmap(), MAP_SHARED, MAP_PRIVATE, file mappings, anonymous mappings, mremap() |
| 50 | ch50_virtual_memory_operations.md | Các thao tác bộ nhớ ảo (Virtual Memory Operations) | mprotect(), mlock(), mlockall(), mincore(), madvise() |
| 51 | ch51_introduction_to_posix_ipc.md | Giới thiệu về POSIX IPC | POSIX IPC overview, comparison with System V IPC |
| 52 | ch52_posix_message_queues.md | Hàng đợi thông điệp POSIX (POSIX Message Queues) | mq_open(), mq_send(), mq_receive(), mq_notify(), mq_close(), mq_unlink() |
| 53 | ch53_posix_semaphores.md | Semaphore POSIX (POSIX Semaphores) | sem_open(), sem_wait(), sem_post(), sem_init(), named semaphores, unnamed semaphores |
| 54 | ch54_posix_shared_memory.md | Bộ nhớ chia sẻ POSIX (POSIX Shared Memory) | shm_open(), shm_unlink(), ftruncate(), mmap() with shared memory objects |
| 55 | ch55_file_locking.md | Khóa tệp (File Locking) | flock(), fcntl() record locking, F_SETLK, F_SETLKW, mandatory locking, advisory locking |
| 56 | ch56_sockets_introduction.md | Socket: Giới thiệu | socket(), bind(), listen(), accept(), connect(), close(), stream sockets, datagram sockets |
| 57 | ch57_sockets_unix_domain.md | Socket: Miền UNIX (UNIX Domain) | sockaddr_un, UNIX domain stream, UNIX domain datagram, socketpair(), SCM_RIGHTS |
| 58 | ch58_sockets_fundamentals_of_tcp_ip_networks.md | Socket: Cơ bản về Mạng TCP/IP | TCP/IP layers, IP addresses, port numbers, TCP, UDP, data-link layer |
| 59 | ch59_sockets_internet_domains.md | Socket: Miền Internet (Internet Domains) | sockaddr_in, sockaddr_in6, htons(), inet_pton(), getaddrinfo(), getnameinfo(), byte order |
| 60 | ch60_sockets_server_design.md | Socket: Thiết kế Máy chủ (Server Design) | iterative server, concurrent server, inetd, prefork, prethread |
| 61 | ch61_sockets_advanced_topics.md | Socket: Các chủ đề nâng cao | partial reads/writes, TCP internals, SO_REUSEADDR, sendmsg(), recvmsg(), passing file descriptors, SCTP |
| 62 | ch62_terminals.md | Thiết bị đầu cuối (Terminals) | terminal driver, termios, canonical mode, raw mode, cbreak, stty, tcgetattr(), tcsetattr() |

| 63 | ch63_alternative_io_models.md | Các mô hình I/O thay thế | select(), poll(), epoll, epoll_create(), epoll_ctl(), epoll_wait(), signal-driven I/O, I/O multiplexing |
| 64 | ch64_pseudoterminals.md | Thiết bị giả lập đầu cuối (Pseudoterminals) | PTY, master/slave, posix_openpt(), grantpt(), unlockpt(), ptsname(), ptyFork() |

## Phân nhóm theo chủ đề

### File I/O & Hệ thống tập tin (File Systems)

- Ch 4-5: File I/O (open, read, write, close, fcntl, scatter-gather)
- Ch 13: Đệm File I/O (File I/O Buffering) (kernel buffer cache, stdio buffering, O_DIRECT)
- Ch 14: Hệ thống tập tin (File Systems) (inodes, VFS, mount, journaling)
- Ch 15: Thuộc tính tập tin (File Attributes) (stat, permissions, chmod, chown)
- Ch 16: Thuộc tính mở rộng (Extended Attributes) (xattr)
- Ch 17: Danh sách điều khiển truy cập (Access Control Lists - ACL)
- Ch 18: Thư mục và Liên kết (Directories and Links) (hard/soft links, nftw, chroot)
- Ch 19: Giám sát sự kiện tập tin (Monitoring File Events) (inotify)
- Ch 55: Khóa tập tin (File Locking) (flock, fcntl record locking)

### Tiến trình (Processes) & Thực thi chương trình

- Ch 6: Tiến trình (Processes) (memory layout, environment, setjmp/longjmp)
- Ch 24: Tạo tiến trình (Process Creation) (fork, vfork, copy-on-write)
- Ch 25: Kết thúc tiến trình (Process Termination) (exit, atexit)
- Ch 26: Giám sát tiến trình con (Monitoring Child Processes) (wait, waitpid, zombies, SIGCHLD)
- Ch 27: Thực thi chương trình (Program Execution) (exec family, system())
- Ch 28: Tạo tiến trình chi tiết hơn (Process Creation in More Detail) (clone)
- Ch 34: Nhóm tiến trình, Phiên làm việc và Quản lý tác vụ (Process Groups, Sessions, Job Control)
- Ch 35: Độ ưu tiên tiến trình và Lịch trình (Process Priorities and Scheduling) (nice, realtime scheduling)
- Ch 36: Tài nguyên tiến trình (Process Resources) (getrusage, rlimit)
- Ch 37: Trình nền (Daemons) (daemon creation, syslog)
- Ch 9: Định danh tiến trình (Process Credentials) (UID, GID, setuid)

### Luồng (Threads / Pthreads)

- Ch 29: Giới thiệu về Luồng (Threads Introduction) (create, join, detach)
- Ch 30: Đồng bộ hóa luồng (Thread Synchronization) (mutex, condition variables)
- Ch 31: An toàn luồng (Thread Safety) (thread-specific data, TLS)
- Ch 32: Hủy luồng (Thread Cancellation)
- Ch 33: Chi tiết bổ sung về Luồng (Threads Further Details) (stacks, signals, NPTL)

### Tín hiệu (Signals)

- Ch 20: Các khái niệm cơ bản về Tín hiệu (Signals Fundamental Concepts) (signal, sigaction, kill)
- Ch 21: Trình xử lý tín hiệu (Signal Handlers) (async-signal-safe, SA_SIGINFO, sigaltstack)
- Ch 22: Tín hiệu nâng cao (Signals Advanced) (core dump, realtime signals, signalfd)

### Bộ nhớ (Memory)

- Ch 7: Cấp phát bộ nhớ (Memory Allocation) (malloc, free, brk, alloca)
- Ch 49: Ánh xạ bộ nhớ (Memory Mappings) (mmap, munmap, shared/private)
- Ch 50: Các thao tác Bộ nhớ ảo (Virtual Memory Operations) (mprotect, mlock, madvise)

### Giao tiếp giữa các tiến trình (Interprocess Communication - IPC)

- Ch 43: Tổng quan về IPC (IPC Overview) (taxonomy, comparison)
- Ch 44: Đường ống (Pipes) và FIFO
- **System V IPC:** Ch 45 (intro), Ch 46 (message queues), Ch 47 (semaphores), Ch 48 (shared memory)
- **POSIX IPC:** Ch 51 (intro), Ch 52 (message queues), Ch 53 (semaphores), Ch 54 (shared memory)

### Socket & Mạng (Networking)

- Ch 56: Giới thiệu về Socket (Sockets Introduction) (socket, bind, listen, accept, connect)
- Ch 57: UNIX Domain Sockets
- Ch 58: Nguyên lý cơ bản về TCP/IP (TCP/IP Fundamentals)
- Ch 59: Internet Domain Sockets (getaddrinfo, byte order)
- Ch 60: Thiết kế Máy chủ (Server Design) (iterative, concurrent, inetd)
- Ch 61: Các chủ đề Socket nâng cao (Advanced Socket Topics) (sendmsg, recvmsg, fd passing)

### Bộ định thời & Thời gian (Timers & Time)

- Ch 10: Thời gian (Thời gian lịch, thời gian tiến trình, clock_gettime)
- Ch 23: Bộ định thời và Trạng thái ngủ (setitimer, POSIX timers, timerfd)

### Bảo mật & Đặc quyền (Security & Privileges)

- Ch 38: Viết chương trình có đặc quyền an toàn (Writing Secure Privileged Programs)
- Ch 39: Khả năng phân quyền (Linux capabilities)

### Thư viện chia sẻ (Shared Libraries)

- Ch 41: Cơ bản về Thư viện chia sẻ (soname, PIC, ldconfig)
- Ch 42: Thư viện chia sẻ nâng cao (dlopen, dlsym, LD_PRELOAD)

### Thiết bị đầu cuối & Mô hình I/O (Terminals & I/O Models)

- Ch 62: Thiết bị đầu cuối (termios, chế độ canonical/raw)
- Ch 63: Các mô hình I/O thay thế (select, poll, epoll, I/O hướng sự kiện qua tín hiệu - signal-driven I/O)
- Ch 64: Thiết bị đầu cuối giả lập (Pseudoterminals - PTY)

### Thông tin hệ thống & Khác (System Info & Misc)

- Ch 1: Lịch sử và Tiêu chuẩn (UNIX, POSIX)
- Ch 2: Khái niệm cơ bản (Tổng quan)
- Ch 3: Khái niệm Lập trình Hệ thống (System Calls, glibc, errno)
- Ch 8: Người dùng và Nhóm (Users and Groups - /etc/passwd, /etc/group)
- Ch 11: Giới hạn và Tùy chọn Hệ thống (sysconf, pathconf)
- Ch 12: Thông tin Hệ thống và Tiến trình (/proc)
- Ch 40: Kế toán đăng nhập (Login Accounting - utmp, wtmp)
