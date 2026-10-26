# Cẩm nang ôn tập, lộ trình tự triển khai & ngân hàng viva

## 1. Bản đồ đối chiếu mã nguồn ↔ yêu cầu đề bài

| Yêu cầu `CPP.MiniProject_vi.md` | Tệp Tầng 1 (Legacy) | Tệp Tầng 2 (ASW hiện đại) |
|:---|:---|:---|
| P1 `MusicLibrary` (`std::vector`) | `legacy_backend/MusicLibrary.{h,cpp}` | `swc_playlist_model/SongArena.{h,cpp}` |
| P1 `PlaybackQueue` (`std::list`) | `legacy_backend/PlaybackQueue.{h,cpp}` | `BoundedFifo<32U>` trong `PlayerContext.h` |
| P1 `addAlbumToQueue` | `PlaybackQueue.cpp` (hàm tự do) | `SongArena::FindByAlbum` → `span` |
| P2 Index ID `unordered_map` | `MusicLibrary::m_songIndexByID` | `SongArena::m_byId` (index `uint32_t`) |
| P2 Index Title `map` | `m_songIndexByTitle` | `StringKeyedMap<uint32_t> m_byTitle` |
| P2 Index Artist 1-N | `m_artistIndex` | `StringKeyedMap<std::vector<uint32_t>>` |
| P3 History `std::stack` | `legacy_backend/PlaybackHistory.{h,cpp}` | `swc_playback_manager/PlaybackHistory` (ring 50) |
| P3 "Play Next" `std::queue` | `MusicPlayer::m_playNextQueue` | `BoundedFifo<32U> m_playNextQueue` |
| P3 Shuffle `std::set` | `ShuffleManager.{h,cpp}` | `ShuffleOrder` (Fisher-Yates + cursor) |
| P4 `MusicPlayer` tích hợp | `MusicPlayer.{h,cpp}` | `PlayerContext` + State Pattern |
| P4 `generateSmartPlaylist` BFS | `SmartPlaylistGenerator.{h,cpp}` | `SmartBfsOrder::BuildSmartPlaylist` |
| P4 Báo cáo Big-O | `legacy_backend/GIAI_THICH.md` | `doc/architecture.md` |
| (mở rộng) HMI | — | `hmi_qt/`, `swc_hmi_interface/CliHarness` |
| (mở rộng) Kiểm thử | `test/unit_tests/test_legacy_backend.cpp` | `test_main.cpp`, `test_song_search.cpp` |

## 2. Lộ trình 4 giai đoạn (Blank-Screen Challenge)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  GĐ1 — LEGACY STL BASELINE (C++11/14)            ~ 90 phút                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  □ Song.h            struct 5 trường + operator== / !=                       │
│  □ MusicLibrary      vector + 4 index; reserve() TRƯỚC, buildIndexes() SAU   │
│  □ PlaybackQueue     list: addSong / removeSong(id) / getCurrentSong /       │
│                      playNext; + hàm tự do addAlbumToQueue                   │
│  □ PlaybackHistory   stack<Song>; pop trên rỗng trả Song{} (KHÔNG UB)        │
│  □ ShuffleManager    vector xáo trộn + set<int> đã phát + auto resetCycle    │
│  □ MusicPlayer       selectAndPlaySong 3 bước; playNext ưu tiên PlayNext FIFO│
│  □ SmartPlaylistGen  BFS: queue<const Song*> + set<int> visited              │
│  ✓ CHỐT: g++ -std=c++14 -Wall -Wextra -Wpedantic -Werror                    │
│          -fsanitize=address,undefined ... && ./legacy_player                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ▼  chỉ ra điểm nghẽn rồi mới nâng cấp
┌──────────────────────────────────────────────────────────────────────────────┐
│  GĐ2 — TIẾN HOÁ NHÚNG C++20                      ~ 90 phút                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  □ Types.h           SongId=uint32_t, kInvalidSongId=0, enum class : uint8_t │
│  □ SongArena         Builder → shared_ptr<const SongArena> (BẤT BIẾN)        │
│                      lưu INDEX uint32_t, KHÔNG lưu Song*                     │
│  □ TransparentStringHash + StringKeyedMap  (is_transparent)                  │
│  □ FindByArtist/Album trả std::span<const uint32_t>                          │
│  □ BoundedFifo<32U>  thay std::list                                          │
│  □ PlaybackHistory   ring buffer 50, (head+cap-1)%cap                        │
│  □ IPlaybackOrder    Sequential / Shuffle(Fisher-Yates) / SmartBfs           │
│  ✓ CHỐT: giải thích được VÌ SAO mỗi thay thế, kèm số byte và Big-O           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GĐ3 — KIẾN TRÚC & KIỂM THỬ                      ~ 90 phút                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  □ IAudioSink / IFileSystem   HAL thuần ảo (mock được)                       │
│  □ EventBus<8>       array tĩnh + Tombstone; Subscribe [[nodiscard]]         │
│  □ IPlayerState + 5 state singleton .bss (Stopped/Buffering/Playing/         │
│                      Paused/Ducked)                                          │
│  □ PlayerContext::Transition  TRAMPOLINE (m_inTransition + m_pendingState)   │
│  □ OnReverseGear ưu tiên tuyệt đối; OnNavPrompt ducking -12 dB               │
│  □ MockAudioSink (trace vector) + GMock MockAudioSink                        │
│  □ Test: ma trận trạng thái, tiêm lỗi OpenStream, ring wrap, tombstone,      │
│          RAII Unsubscribe của CliHarness                                     │
│  ✓ CHỐT: ctest --output-on-failure ; make coverage (ENABLE_COVERAGE=ON)      │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  GĐ4 — HMI QT6 MVVM                              ~ 60 phút                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  □ SongListModel     rowCount/data/roleNames + m_normalizedCache NFD         │
│  □ PlayerViewModel   Q_PROPERTY + Q_INVOKABLE + QTimer 250 ms → ctx.Tick     │
│  □ AttachEventBus + Unsubscribe trong destructor (RAII)                      │
│  □ MainView.qml      ListView virtual scroll + TextField setFilter           │
│  □ qt_add_qml_module trong CMake                                             │
│  ✓ CHỐT: ASW/BSW không include header Qt nào (grep -r '#include <Q' src/asw) │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3. Top 12 cạm bẫy chí mạng — kiểm tra trước khi bảo vệ

| # | Cạm bẫy | Dấu hiệu | Cách chặn |
|:--:|:---|:---|:---|
| 1 | `Song*` trong index + `vector::push_back` reallocate | Crash/dữ liệu rác sau `addSong` | Lưu `uint32_t` index, hoặc `reserve` + `buildIndexes()` sau mọi lần nạp |
| 2 | Modulo wrap `(head-1)%cap` trên `size_t` | Pop tại `head==0` trả rác | `(head + cap - 1) % cap` |
| 3 | Reentrancy State Machine | `StateChanged` đảo thứ tự trên HMI | Trampoline |
| 4 | `erase` subscriber giữa `Publish` | Bỏ sót / gọi trùng / UAF | Tombstone |
| 5 | Subscriber hủy không `Unsubscribe` | UAF ngẫu nhiên | Unsubscribe trong destructor + test scope |
| 6 | Vừa duyệt vừa `erase` container | Bỏ phần tử, UAF | `it = c.erase(it)` hoặc erase-remove |
| 7 | Thiếu virtual destructor ở interface | Leak `IPlaybackOrder` con | `virtual ~I() = default` |
| 8 | Move Ctor `∅ Not Declared` → fallback Copy | Copy âm thầm cả `SongArena` | Rule of 0/5, `= default` cho move |
| 9 | Sửa model không `beginResetModel` | Crash QML khi lọc | Bao trọn thay đổi cấu trúc |
| 10 | `normalized()` mỗi keystroke | Giật UI khi $N$ lớn | Cache `m_normalizedCache` |
| 11 | Mock cấp bằng `new` không delete | Test xanh giả | Mock là thành viên fixture |
| 12 | Bỏ qua `[[nodiscard]] bool` (`Push`, `Subscribe`) | Mất bài / mất subscriber im lặng | Xử lý hoặc `(void)` có ý thức |

## 4. Ngân hàng câu hỏi viva

**Q1. Đề bài yêu cầu `std::list` cho `PlaybackQueue`, sao bạn dùng `BoundedFifo`?**
Tôi giữ **cả hai**. `legacy_backend/` hiện thực đúng `std::list` theo đề. `src/asw/` là phiên bản nâng cấp cho ràng buộc ECU: `std::list` cấp một `malloc` cho mỗi node (~96 B gồm 2 con trỏ, payload và malloc header), gây phân mảnh heap ngoài và làm WCET của `addSong` phụ thuộc trạng thái heap — không chứng minh được cho tác vụ real-time. `BoundedFifo<32U>` là `std::array` in-struct 152 B, `Push`/`Pop` là $O(1)$ hằng số thật, 0 heap. Đánh đổi tôi chấp nhận và ghi rõ trong `doc/architecture.md`: mất khả năng xóa phần tử giữa hàng đợi và kéo-thả đổi thứ tự; nếu yêu cầu sản phẩm cần tính năng đó, tôi sẽ dùng `std::pmr::list` trên arena tĩnh — giữ được xóa giữa mà vẫn 0 heap runtime.

**Q2. Tại sao `SongArena` lưu `uint32_t` index thay vì `Song*`?**
Vì `Song*` là một quả bom hẹn giờ. Khi `std::vector<Song>` vượt `capacity()`, nó cấp vùng nhớ mới, move phần tử sang và giải phóng vùng cũ — toàn bộ `Song*` trong bốn bảng index lập tức thành dangling. Bản legacy phải "chữa cháy" bằng cách gọi lại `buildIndexes()` sau mỗi `addSong`, tức $O(N)$ cho một phép thêm và dễ bị quên. `uint32_t` index thì bất biến qua reallocate, lại chỉ chiếm 4 B thay vì 8 B nên nhồi được 16 chỉ mục vào một cache line 64 B. `SongArena` còn khoá thêm một tầng: `Builder::Build()` trả `shared_ptr<const SongArena>`, sau đó arena bất biến — không có reallocate nào xảy ra được nữa.

**Q3. `is_transparent` thực chất mở khoá điều gì?**
Nó mở khoá overload template của `find`/`contains`/`equal_range` trên associative container. Không có nó, `map.find("Artist A")` phải chuyển đối số về đúng kiểu khóa `std::string`, tức dựng một `std::string` tạm — với chuỗi dài quá ngưỡng SSO (15 ký tự trên libstdc++) là một `malloc` cộng một `free` **mỗi lần tìm kiếm**. Có `is_transparent`, hàm băm nhận thẳng `string_view` và so sánh qua `std::equal_to<>`, nên chi phí heap bằng 0. Bẫy cần cảnh giác: hai overload `operator()` trong hash functor phải sinh **cùng** giá trị băm — vì thế cả hai đều đi qua `std::hash<std::string_view>`; nếu một cái dùng `std::hash<std::string>`, khóa sẽ rơi vào bucket khác và `find` luôn miss.

**Q4. Giải thích Atomic Trampoline và vấn đề nó khắc phục.**
`Buffering::OnEnter()` cần lập tức chuyển tiếp sang `Playing` hoặc `Ducked`. Nếu `Transition()` gọi đệ quy, khung trong publish `StateChanged=Playing` trước, khung ngoài publish `StateChanged=Buffering` sau — HMI nhận thứ tự đảo và hiển thị sai, đồng thời độ sâu stack phụ thuộc số state trung gian nên không cận trên được. Trampoline dùng cờ `m_inTransition`: nếu đã trong quá trình chuyển, `Transition()` chỉ **ghi** `m_pendingState` rồi trả về; vòng lặp `while` ở khung ngoài duy nhất sẽ tiêu thụ nó. Kết quả: độ sâu stack hằng số, và đúng **một** sự kiện `StateChanged` mô tả trạng thái ổn định cuối cùng.

**Q5. Tại sao Tombstone thay vì xoá phần tử khỏi `EventBus`?**
Vì `Unsubscribe` có thể được gọi **từ trong** một handler đang chạy dưới `Publish` — ví dụ một subscriber tự huỷ khi nhận `ErrorOccurred`. Nếu `Unsubscribe` dịch mảng, chỉ số `i` của vòng `for` trong `Publish` sẽ lệch: một subscriber bị gọi hai lần hoặc bị bỏ qua, và slot vừa dịch có thể chứa con trỏ đã chết. Tombstone chỉ gán `Subscription{}` (handler = `nullptr`) tại chỗ, không dịch gì; vòng lặp `Publish` kiểm `handler != nullptr` trước khi gọi nên bỏ qua slot chết một cách an toàn. `Subscribe` sau đó tái dùng slot tombstone nên mảng 8 phần tử không bị cạn giả.

**Q6. Shuffle: `std::set` (đề bài) so với Fisher-Yates + cursor (ASW)?**
Bản `std::set` đúng theo đề: kiểm tra "đã phát chưa" là $O(\log k)$ và mỗi lần `insert` cấp một node cây đỏ-đen trên heap. Vấn đề nghiệp vụ nặng hơn vấn đề hiệu năng: nếu chỉ xáo trộn rồi *bỏ qua* các bài đã có trong set, vòng lặp bỏ qua có thể quét gần hết vector ở cuối chu kỳ. Bản ASW xáo trộn toàn bộ chỉ mục **một lần** bằng Fisher-Yates $O(N)$ rồi duyệt tuyến tính bằng cursor — mỗi lần `Next()` là $O(1)$ thật, 0 byte heap, và tính chất "không lặp trong chu kỳ" được bảo đảm bởi cấu trúc hoán vị chứ không cần kiểm tra runtime. Tôi bổ sung một chi tiết: khi bắt đầu chu kỳ mới, nếu bài đầu trùng bài vừa phát thì hoán nó với bài cuối, tránh lặp ngay tại ranh giới chu kỳ.

**Q7. `generateSmartPlaylist`: sao BFS mà không DFS?**
BFS lan toả theo tầng nên nó nạp hết các bài "hàng xóm bậc 1" — cùng nghệ sĩ hoặc cùng album với bài hạt giống — trước khi đi tới liên hệ gián tiếp. Đó chính là ngữ nghĩa "gần gũi nhất" mà người dùng mong đợi. DFS sẽ lao sâu theo một nhánh, có thể trả về những bài chỉ liên quan rất xa trong khi bỏ sót album của chính bài hạt giống. Độ phức tạp là $O(V+E)$ nhưng dừng sớm ngay khi đạt `maxSize`; nhờ hai bảng băm `m_artistIndex`/`m_albumIndex`, bước tìm hàng xóm là $O(1)$ tra cứu chứ không phải quét thư viện $O(N)$. Bản ASW thay `std::set<int> visited` bằng `std::vector<uint8_t>` bitmap kích thước `TotalSongs()`, cho kiểm tra $O(1)$ và một lần cấp phát duy nhất.

**Q8. Đo coverage thế nào và mục tiêu bao nhiêu?**
`ENABLE_COVERAGE=ON` bật `-O0 -g --coverage -fno-inline`; `-fno-inline` là bắt buộc, vì với `-O2` compiler inline làm bản đồ dòng sai lệch và số liệu vô nghĩa. Sau đó `lcov --capture` rồi `--remove` để loại `/usr/*`, `*/test/*`, `*_autogen/*` và `*/legacy_backend/*` — legacy là oracle đối chứng, không phải mã sản phẩm. Mục tiêu: statement coverage cho tầng ASW, và quan trọng hơn là **branch coverage của các nhánh an toàn**: `OnReverseGear`, ducking, và nhánh `OpenStream` thất bại. Nhánh cuối chỉ kích hoạt được bằng mock (`InjectOpenFailure` hoặc `EXPECT_CALL(...).WillOnce(Return(false))`) — đây chính là lý do phải mock HAL thay vì test trên phần cứng thật.

**Q9. Tại sao ASW/BSW không được include header Qt?**
Ba lý do. Thứ nhất, kiểm thử: `unit_tests` và `test_legacy_backend` build và chạy không cần `QGuiApplication`, không cần display server — chạy được trong container CI. Thứ hai, khả năng chuyển đổi: cùng lõi ASW đang chạy sau hai HMI khác nhau, `CliHarness` và `PlayerViewModel`; nếu ASW phụ thuộc Qt thì bản CLI phải link toàn bộ Qt. Thứ ba, ràng buộc target: một số target AUTOSAR Classic không có Qt, và Qt kéo theo cấp phát động cùng ngoại lệ vốn bị hạn chế ở tầng an toàn. Ranh giới được kiểm tra máy móc bằng `grep -r '#include <Q' src/asw src/bsw` phải trả về rỗng.

**Q10. Có gì đánh đổi khi thay `std::stack<Song>` bằng ring buffer 50 phần tử?**
`std::stack` mặc định dựa trên `std::deque`, phình không giới hạn: xe bật nhạc suốt chuyến đi dài, mỗi bài lại `push` một `Song` đầy đủ với ba `std::string` — bộ nhớ tăng đơn điệu và không có cận trên, đúng kiểu lỗi chỉ lộ ra sau nhiều giờ chạy. Ring buffer lưu `SongId` 4 byte trong `std::array<SongId,50>`, tổng 224 B cố định, tự ghi đè bản ghi cũ nhất khi đầy. Đánh đổi: mất lịch sử quá 50 bài — hoàn toàn chấp nhận được vì nút "Back" trên IVI thực tế không ai bấm quá vài lần. Điểm cần cẩn thận là phép modulo lùi: `(head + cap - 1) % cap`, không phải `(head - 1) % cap`, vì `size_t` không dấu sẽ wrap về `SIZE_MAX`.

**Q11. `-fno-exceptions` thì báo lỗi thế nào?**
Chiến lược lỗi kép. Trong vòng lặp real-time: `enum class ErrorCode : int32_t` (`ErrorCode.h`) trả về qua `bool`/`std::optional`, chi phí zero-overhead, không unwind, không phình `.eh_frame`. Với đường sự kiện, lỗi được publish thành `RteEvent{EventId::ErrorOccurred, payloadValue = ErrorCode}` để HMI hiển thị. Giai đoạn khởi động — nơi timing không tất định là chấp nhận được — có thể dùng exception cho lỗi phần cứng nghiêm trọng. Ràng buộc kéo theo: mọi hàm HAL đều `noexcept`, `promise_type::unhandled_exception` của coroutine gọi `std::terminate`, và các API có thể thất bại đều `[[nodiscard]]` để compiler chặn việc bỏ qua mã lỗi.

**Q12. Nếu phải mở rộng thêm nguồn nhạc Bluetooth thì sửa ở đâu?**
Không sửa gì trong lõi. Thêm một implement mới của interface media source ở tầng BSW/CDD, giống cách `PosixFileSystem` implement `IFileSystem`, và inject qua constructor như `SongFileLoader::LoadFromCsv(path, fs)` đang làm. Đây là Strategy Pattern cộng Dependency Injection: `PlayerContext` phụ thuộc `IAudioSink&` và `IFileSystem&` chứ không phụ thuộc lớp cụ thể, nên lõi tuân thủ Open/Closed. Lợi ích phụ và cũng là lý do chính chọn DI thay vì Singleton: mỗi nguồn mới đều mock được, nên viết test cho nó không cần thiết bị Bluetooth thật.

## 5. Checklist bảo vệ cuối

```
□ ctest --output-on-failure                        → 100% pass
□ g++ -std=c++20 -Wall -Wextra -Wpedantic -Werror  → 0 warning
□ -fsanitize=address,undefined trên cả 2 tầng      → 0 report
□ grep -r '#include <Q' src/asw src/bsw            → rỗng
□ Giải thích được TỪNG dòng trong bảng Big-O của doc/architecture.md
□ Nói được 1 đánh đổi cho MỖI thay thế container ở GĐ2
□ Vẽ lại được ma trận trạng thái + trampoline trên giấy trắng
□ Chỉ đúng dòng code chống: dangling ptr, modulo wrap, reentrancy, UAF observer
```

## Tài Liệu Tham Khảo

- cppreference — [Containers library](https://en.cppreference.com/w/cpp/container) (bảng độ phức tạp từng container)
- cppreference — [Iterator invalidation](https://en.cppreference.com/w/cpp/container#Iterator_invalidation)
- GoogleTest — [Primer](https://google.github.io/googletest/primer.html) & [gMock Cook Book](https://google.github.io/googletest/gmock_cook_book.html)
- Qt — [Model/View Programming](https://doc.qt.io/qt-6/model-view-programming.html)
- GCC — [Instrumentation Options (`--coverage`, `-fsanitize`)](https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html)
- AUTOSAR — [C++14 Coding Guidelines](https://www.autosar.org/fileadmin/standards/adaptive/)

## 6. Cheatsheet lệnh

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DENABLE_GTEST=ON -DENABLE_COVERAGE=ON
cmake --build build -j$(nproc)
ctest --test-dir build --output-on-failure
cmake --build build --target coverage        # coverage_html/index.html

g++ -std=c++20 -Wall -Wextra -Wpedantic -Werror -Wshadow -Wconversion \
    -Wold-style-cast -Wnon-virtual-dtor -fsanitize=address,undefined \
    -I src/legacy_backend src/legacy_backend/*.cpp -o legacy_player

nm -C --size-sort build/legacy_player | tail -20    # phát hiện template bloat
grep -rnE '\)[[:space:]]*\{[[:space:]]*$' src/       # rà vi phạm Allman
```

---

## Kết quả

Đã hoàn thành hai phần: **kiểm toán** (6 vi phạm Allman/References đã xác minh trực tiếp trên `learn_summary.md`, rubric 6 cổng kèm script `grep` để tự chạy trên 19 tệp chưa đọc được, và ma trận khuyến nghị bổ sung nội dung cho từng tệp), và **biên soạn 7 tệp tri thức mới** bao trọn các khoảng trống: views/heterogeneous lookup, PMR/arena, Concepts–Ranges–Coroutines, GTest/GMock nhúng, State Machine/EventBus/Ring Buffer, Qt6 MVVM + tìm kiếm tiếng Việt NFD, và cẩm nang ôn tập kèm 12 câu viva có đáp án.

Một giới hạn cần nêu rõ: nội dung 19 tệp `knowledge_summary/knowledge/` không có trong ngữ cảnh, nên phần kiểm toán chúng là rubric và dự đoán rủi ro theo tệp, không phải phát hiện đã xác minh. Nếu bạn dán nội dung các tệp đó (hoặc cấp quyền đọc thư mục), tôi sẽ chạy kiểm toán thật và trả bảng vi phạm theo số dòng.
