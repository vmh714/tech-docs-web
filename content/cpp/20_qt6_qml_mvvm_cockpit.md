# Qt 6.8 MVVM Cockpit, Virtual Scrolling & Tìm kiếm tiếng Việt không dấu

## 1. Cơ chế mức thấp

`QAbstractListModel` cung cấp dữ liệu **theo yêu cầu**: `QQuickListView` chỉ gọi `data()` cho các hàng đang nằm trong viewport (cộng cache buffer), nên thư viện 50.000 bài chỉ tạo ~20 delegate — đó là bản chất virtual scrolling. `Q_PROPERTY` + `NOTIFY` nối vào cơ chế property binding của QML engine: khi signal phát, engine đánh dấu binding bẩn và re-evaluate lười trong frame kế tiếp. Tìm kiếm không dấu dựa trên **Unicode NFD**: `QString::normalized(NormalizationForm_D)` phân rã `ế` thành `e` + U+0302 + U+0301, sau đó lọc bỏ dải Combining Diacritical Marks U+0300–U+036F.

## 2. Kiến trúc & luồng dữ liệu

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        MVVM — QML COCKPIT                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  VIEW (MainView.qml)                                                         │
│    ListView { model: player.songModel                                        │
│               delegate: Row { Text { text: title } }                         │
│               onClicked: player.playSong(songId) }                           │
│    TextField { onTextChanged: player.songModel.setFilter(text) }              │
│                    │ property binding                    ▲ Q_INVOKABLE       │
│                    ▼                                     │                   │
│  VIEWMODEL (PlayerViewModel : QObject)          ── KHÔNG chứa logic nghiệp vụ│
│    Q_PROPERTY(QString title READ Title NOTIFY playbackChanged)               │
│    Q_PROPERTY(SongListModel* songModel READ GetSongModel CONSTANT)           │
│    QTimer 250 ms ──▶ ctx.Tick(250) ──▶ emit positionChanged()                │
│                    ▲ static OnRteEvent(void*, const RteEvent&)               │
│                    │                                                         │
│  RTE  EventBus<8> ─┘  (function-pointer + void*, KHÔNG QObject, KHÔNG heap)  │
│                    ▲                                                         │
│  ASW  PlayerContext / SongArena / IPlaybackOrder     ── logic thuần C++      │
│                    ▲                                                         │
│  BSW  IAudioSink / IFileSystem                                               │
│                                                                              │
│  ⚠ ASW/BSW KHÔNG include bất kỳ header Qt nào ==> unit-test được trên host    │
│    không cần Qt (xem target test_legacy_backend / unit_tests trong oke/).     │
└──────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  VIRTUAL SCROLLING — 50.000 bài, ~20 delegate                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  m_filteredIndices : std::vector<uint32_t>  (chỉ 4 B / hàng = 200 KB)        │
│                                                                              │
│         viewport (y: 1200..1680)                                             │
│         ┌───────────────────────────┐                                        │
│  row 0  │                           │  data() KHÔNG được gọi                 │
│  ...    │                           │                                        │
│  row 25 │███ delegate sống ███      │  data(row=25, TitleRole) ──▶ arena     │
│  row 44 │███ delegate sống ███      │                                        │
│  ...    │                           │  data() KHÔNG được gọi                 │
│  row 49999                                                                   │
│         └───────────────────────────┘                                        │
│                                                                              │
│  RAM: 200 KB chỉ mục + ~20 QQuickItem, KHÔNG phải 50.000 QObject.            │
└──────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  UNICODE NFD — bỏ dấu tiếng Việt                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  "Chúng Ta Của Tương Lai"                                                    │
│      │ (1) thay thủ công đ U+0111 / Đ U+0110 ──▶ 'd'                         │
│      │     (NFD KHÔNG phân rã đ vì gạch ngang là phần thân chữ, không phải   │
│      │      combining mark — đây là ngoại lệ BẮT BUỘC xử lý riêng)           │
│      ▼                                                                       │
│  (2) normalized(NormalizationForm_D):                                        │
│      'ú' U+00FA ──▶ 'u' U+0075 + U+0301 (COMBINING ACUTE)                    │
│      'ươ'       ──▶ 'u' + U+031B (HORN) + 'o' + U+031B                       │
│      ▼                                                                       │
│  (3) lọc bỏ U+0300..U+036F  +  toLower()                                     │
│      ▼                                                                       │
│  "chung ta cua tuong lai"   ◀── so khớp contains() với query đã chuẩn hoá    │
│                                                                              │
│  CACHE: chuẩn hoá 1 LẦN khi SetArena() vào m_normalizedCache                 │
│         ==> setFilter() chỉ còn O(N) contains(), không normalize lại          │
│         ==> gõ 10 ký tự: 10 * O(N) thay vì 10 * O(N * chi phí NFD)           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3. Mã nguồn (Allman)

```cpp
namespace
{
    [[nodiscard]] QString StripVietnameseDiacritics(const QString& input)
    {
        QString str = input;
        str.replace(QChar(0x0111), QLatin1Char('d')); // đ
        str.replace(QChar(0x0110), QLatin1Char('d')); // Đ

        const QString normalized = str.normalized(QString::NormalizationForm_D);

        QString result;
        result.reserve(normalized.size());

        for (const QChar& ch : normalized)
        {
            const ushort code = ch.unicode();
            if (code >= 0x0300U && code <= 0x036FU) // Combining Diacritical Marks
            {
                continue;
            }
            result.append(ch.toLower());
        }

        return result;
    }
} // namespace
```

```cpp
void SongListModel::RebuildFilteredIndices()
{
    // beginResetModel/endResetModel PHẢI bao trọn mọi thay đổi cấu trúc,
    // nếu không QQuickListView giữ chỉ số cũ ==> đọc ngoài biên ==> crash UI.
    beginResetModel();
    m_filteredIndices.clear();

    if (!m_arena)
    {
        endResetModel();
        return;
    }

    m_filteredIndices.reserve(m_arena->TotalSongs()); // 1 alloc, tránh regrow

    const QString trimmed = m_filterText.trimmed();
    if (trimmed.isEmpty())
    {
        for (std::uint32_t i = 0U; i < static_cast<std::uint32_t>(m_arena->TotalSongs()); ++i)
        {
            m_filteredIndices.push_back(i);
        }
    }
    else
    {
        const QString queryNorm = StripVietnameseDiacritics(trimmed); // chuẩn hoá 1 lần

        for (const auto& item : m_normalizedCache) // đã chuẩn hoá sẵn ở SetArena
        {
            if (item.titleNorm.contains(queryNorm) ||
                item.artistNorm.contains(queryNorm) ||
                item.albumNorm.contains(queryNorm))
            {
                m_filteredIndices.push_back(item.arenaIndex);
            }
        }
    }

    endResetModel();
}
```

```cpp
QVariant SongListModel::data(const QModelIndex& index, int role) const
{
    if (!index.isValid() || !m_arena)
    {
        return {};
    }

    const int row = index.row();
    if (row < 0 || row >= static_cast<int>(m_filteredIndices.size()))
    {
        return {}; // Kiểm biên bắt buộc: QML có thể gọi với chỉ số lỗi thời
    }

    const auto* rec = m_arena->GetByIndex(m_filteredIndices[static_cast<std::size_t>(row)]);
    if (rec == nullptr)
    {
        return {};
    }

    switch (role)
    {
        case IdRole:
            return static_cast<int>(rec->id);
        case TitleRole:
            return QString::fromStdString(rec->title);
        case ArtistRole:
            return QString::fromStdString(rec->artist);
        case AlbumRole:
            return QString::fromStdString(rec->album);
        case DurationRole:
            return static_cast<int>(rec->durationSec);
        case DurationFormattedRole:
        {
            const int mins = static_cast<int>(rec->durationSec / 60U);
            const int secs = static_cast<int>(rec->durationSec % 60U);
            return QString::asprintf("%02d:%02d", mins, secs);
        }
        default:
            return {};
    }
}
```

```qml
// MainView.qml — Text.elide + clip bắt buộc cho delegate chiều rộng cố định
ListView
{
    id: libraryView
    anchors.fill: parent
    model: player.songModel
    cacheBuffer: 400                  // px: đánh đổi RAM lấy độ mượt khi lướt nhanh
    reuseItems: true                  // Qt 6: tái dùng delegate, giảm tạo/hủy QQuickItem

    delegate: ItemDelegate
    {
        width: libraryView.width
        highlighted: ListView.isCurrentItem
        onClicked: player.playSong(model.songId)

        contentItem: RowLayout
        {
            spacing: 12
            Label
            {
                Layout.fillWidth: true
                text: model.title
                elide: Text.ElideRight
            }
            Label
            {
                text: model.durationFormatted
                opacity: 0.7
            }
        }
    }
}
```

## 4. Bảng chi phí

| Thao tác | Time | Space | Ghi chú |
|:---|:---:|:---:|:---|
| `SetArena` (dựng cache chuẩn hoá) | $O(N \cdot L)$ | $O(N \cdot L)$ QString | 1 lần lúc nạp thư viện |
| `setFilter` | $O(N \cdot L)$ | 1 alloc `reserve` | Không normalize lại |
| `data(row, role)` | $O(1)$ | 1 `QString` tạm | Chỉ hàng hiển thị |
| `rowCount` | $O(1)$ | 0 | `m_filteredIndices.size()` |
| Lướt 1 màn hình | $O(\text{visible})$ | ~20 `QQuickItem` | Không phụ thuộc $N$ |
| Không cache, normalize mỗi lần gõ | $O(N \cdot L \cdot C_{NFD})$ | nhiều alloc | Gây giật khi $N$ lớn |

## 5. Cạm bẫy

1. **Sửa `m_filteredIndices` mà không `beginResetModel`/`endResetModel`:** ListView giữ chỉ số cũ → `data()` đọc ngoài biên → crash. Đây là lỗi crash UI phổ biến nhất của Qt model.
2. **`Q_PROPERTY` thiếu `NOTIFY`:** QML đọc một lần rồi không bao giờ cập nhật. Chỉ dùng `CONSTANT` khi giá trị thực sự bất biến (`songModel` là trường hợp đúng).
3. **Trả `SongListModel*` sở hữu bởi C++ cho QML:** QML engine có thể giành ownership. `oke/` an toàn vì model là **thành viên** của ViewModel và property là `CONSTANT` → engine không nhận sở hữu.
4. **Bỏ sót `đ`/`Đ`:** NFD không phân rã U+0111/U+0110. Không xử lý riêng → tìm "dong" không ra "Đông Kiếm Em".
5. **`normalized()` mỗi lần gõ:** NFD là thao tác đắt (bảng tra Unicode). Bắt buộc cache.
6. **Gọi `ctx.Tick()` từ thread khác:** `PlayerContext` không thread-safe. `QTimer` chạy trên GUI thread — giữ nguyên bất biến này; nếu chuyển sang worker thread phải dùng `moveToThread` + queued connection.
7. **`emit` trong static callback:** `OnRteEvent` là `static` nhận `void*`; phải `static_cast` về `PlayerViewModel*` và kiểm `nullptr` trước khi `emit self->...`.

## 6. Ảnh hưởng ô tô

Tách tuyệt đối ASW/BSW khỏi Qt cho phép toàn bộ logic phát nhạc được kiểm thử trên host bằng GTest mà không cần dựng QGuiApplication — điều kiện thực tế để chạy CI. Ở phía HMI, virtual scrolling + cache chuẩn hoá giữ thời gian phản hồi tìm kiếm dưới ngưỡng cảm nhận (~100 ms) trên SoC IVI hạng trung với thư viện hàng chục nghìn bài, tránh vi phạm yêu cầu ergonomics về thời gian rời mắt khỏi đường (driver distraction guidelines).

## Tài Liệu Tham Khảo

- Qt — [`QAbstractListModel`](https://doc.qt.io/qt-6/qabstractlistmodel.html)
- Qt — [Model/View Programming](https://doc.qt.io/qt-6/model-view-programming.html)
- Qt — [Integrating QML and C++](https://doc.qt.io/qt-6/qtqml-cppintegration-topic.html)
- Qt — [`QString::normalized`](https://doc.qt.io/qt-6/qstring.html#normalized) và [Unicode in Qt](https://doc.qt.io/qt-6/unicode.html)
- Qt — [`qt_add_qml_module`](https://doc.qt.io/qt-6/qt-add-qml-module.html)
- Unicode — [UAX #15 Normalization Forms](https://unicode.org/reports/tr15/)

## 7. Cheatsheet

```cpp
Q_PROPERTY(T name READ Get WRITE set NOTIFY changed)   // CONSTANT nếu bất biến
Q_INVOKABLE void action(int id);                        // gọi được từ QML
// 3 override bắt buộc: rowCount(parent), data(index,role), roleNames()
beginResetModel(); /* mọi thay đổi cấu trúc */ endResetModel();
beginInsertRows(QModelIndex(), r, r); endInsertRows();  // chèn tăng dần, mượt hơn reset
str.normalized(QString::NormalizationForm_D);  // rồi lọc U+0300..U+036F, thay đ/Đ trước
```

```cmake
qt_add_executable(app main.cpp ViewModel.cpp ViewModel.h)
qt_add_qml_module(app URI MyUi VERSION 1.0 QML_FILES qml/MainView.qml)
set(CMAKE_AUTOMOC ON)
```
