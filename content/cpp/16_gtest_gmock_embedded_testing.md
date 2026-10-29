# Google Test / Google Mock cho Hệ Nhúng Không Ngoại Lệ

> [!IMPORTANT]
> **Mục tiêu**:
> Thiết lập khung kiểm thử tự động (Unit Testing & Mocking) chuẩn công nghiệp cho hệ thống nhúng thời gian thực biên dịch với `-fno-exceptions`: Vòng đời verify của GMock, giả lập tầng giao tiếp phần cứng (BSW/HAL Mocks), kỹ thuật bắt buộc thứ tự tương tác (`InSequence`), và tuân thủ chuẩn ISO 26262 Part 6.

---

## 1. Cơ Chế Mức Thấp Của GTest & GMock

GTest đăng ký test case qua **static initialization**: mỗi `TEST()` sinh một class con của `::testing::Test` và một `TestInfo` tĩnh tự chèn vào registry trước khi `main()` khởi chạy. 

GMock sinh vtable giả bằng `MOCK_METHOD` (mỗi mock method là một `FunctionMocker` duy trì danh sách expectation), rồi kiểm tra số lần gọi (Cardinality) trong destructor của mock object — do đó **thời điểm phá hủy mock chính là thời điểm verify**. 

Khi biên dịch với `-fno-exceptions`, macro `ASSERT_*` không thể thực hiện stack unwinding nên nó thực hiện lệnh `return` trực tiếp khỏi hàm test hiện tại; điều này bắt buộc test body phải có kiểu trả về là `void`.

---

## 2. Bố Cục Thư Mục & Luồng Verify Của GMock

```
test/
├── CMakeLists.txt
├── framework/googletest/            (FetchContent hoặc submodule, GIT_TAG PIN cứng)
├── mocks/
│   ├── bsw_mocks/
│   │   ├── MockAudioSink.h          <── giả lập IAudioSink
│   │   └── MockFileSystem.h         <── giả lập IFileSystem
│   └── rte_mocks/
│       └── MockEventSubscriber.h    <── bắt RteEvent phát ra từ EventBus
└── unit_tests/
    ├── asw/
    │   ├── test_playback_state_machine.cpp
    │   ├── test_playback_order_strategy.cpp
    │   └── test_song_arena.cpp
    └── common/
        └── test_error_codes.cpp
```

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  VÒNG ĐỜI VERIFY CỦA GMOCK — VÌ SAO MOCK PHẢI LÀ BIẾN CỤC BỘ TRÊN STACK      │
├──────────────────────────────────────────────────────────────────────────────┤
│  TEST_F(PlaybackFixture, TestCase)                                           │
│  {                                                                           │
│      MockAudioSink sink;              <── ARRANGE: Dựng mock trên Stack      │
│      EXPECT_CALL(sink, Play()).Times(1);                                     │
│                                                                              │
│      PlayerContext ctx{sink, bus};    <── ACT: Kích hoạt nghiệp vụ           │
│      ctx.SelectAndPlaySong(1);                                               │
│                                                                              │
│      EXPECT_EQ(ctx.CurrentState(), PlaybackState::Playing); <── ASSERT       │
│  }   <────── ~MockAudioSink() TỰ ĐỘNG CHẠY VERIFY KHI RA KHỎI PHẠM VI!       │
│              Nếu Times(1) chưa thỏa mãn ──▶ BÁO LỖI TEST NGAY LẬP TỨC!       │
│                                                                              │
│  [!] CẠM BẪY CHẾT NGƯỜI: Cấp phát mock bằng new mà quên delete               │
│     ──▶ Destructor không bao giờ chạy ──▶ EXPECT_CALL không verify           │
│     ──▶ Test LUÔN BÁO XANH DÙ CODE LOGIC BỊ HỎNG HOÀN TOÀN!                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Case Study: Giả Lập Cảm Biến Bằng GMock & Dependency Injection Để Kiểm Thử Thuật Toán Phanh ECU Trên CI Server

> [!CAUTION]
> **Bối cảnh:** Module điều khiển phanh khẩn cấp `BrakeController` đọc dữ liệu trực tiếp từ cảm biến tốc độ bánh xe và áp suất dầu phanh. Do không thể mang cả cụm phanh vật lý lên máy chủ CI (Jenkins/GitHub Actions), lập trình viên phải phụ thuộc vào việc flash chip và test thủ công trên xe thật.
> **Triệu chứng:** Mỗi lần chạy test mất hơn 30 phút setup xe, độ bao phủ kiểm thử (Test Coverage) chỉ đạt 12%. Một lỗi chia cho 0 khi tốc độ xe bằng 0km/h bị lọt lưới và chỉ phát hiện khi xe thử nghiệm phanh gấp tại bãi thử.

```cpp
// TRƯỚC (Lỗi): Khởi tạo và đọc trực tiếp từ thanh ghi phần cứng không thể mock
class BrakeControllerBad
{
public:
    float calculateForce()
    {
        // LỖI PHỤ THUỘC CỨNG (Tight Coupling):
        // Đọc trực tiếp phần cứng qua hàm toàn cục -> KHÔNG THỂ CHẠY TRÊN CI SERVER!
        float speed = HardwareSensor_ReadWheelSpeed(0);
        float pressure = HardwareSensor_ReadBrakePressure();

        // Lỗi chia cho 0 tiềm ẩn nếu speed == 0.0f!
        return (pressure / speed) * 100.0f;
    }
};
```

```cpp
// SAU (Khắc phục): Tách Interface trừu tượng + Mocking bằng GMock chuẩn Allman
#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include <memory>

// 1. Interface trừu tượng (Pure Virtual HAL)
class ISensorHAL
{
public:
    virtual ~ISensorHAL() = default;
    virtual float readWheelSpeed(int wheelId) const noexcept = 0;
    virtual float readBrakePressure() const noexcept = 0;
};

// 2. Mock Class sinh bởi GMock
class MockSensorHAL : public ISensorHAL
{
public:
    MOCK_METHOD(float, readWheelSpeed, (int wheelId), (const, noexcept, override));
    MOCK_METHOD(float, readBrakePressure, (), (const, noexcept, override));
};

// 3. Logic nghiệp vụ áp dụng Dependency Injection (DI)
class SafeBrakeController
{
private:
    const ISensorHAL& m_sensor;

public:
    explicit SafeBrakeController(const ISensorHAL& sensor) noexcept
        : m_sensor(sensor) {}

    float calculateForce() const noexcept
    {
        float speed = m_sensor.readWheelSpeed(0);
        float pressure = m_sensor.readBrakePressure();

        // Xử lý an toàn trường hợp biên xe dừng bánh
        if (speed < 0.01f)
        {
            return pressure * 0.1f;
        }
        return (pressure / speed) * 100.0f;
    }
};

// 4. Test Suite chạy tự động trên CI chỉ mất 0.01 giây!
using ::testing::Return;

TEST(BrakeControllerTest, HandlesZeroSpeedWithoutDivisionByZero)
{
    // ARRANGE: Cố tình tiêm giá trị biên nguy hiểm speed = 0.0f
    MockSensorHAL mock;
    EXPECT_CALL(mock, readWheelSpeed(0)).Times(1).WillOnce(Return(0.0f));
    EXPECT_CALL(mock, readBrakePressure()).Times(1).WillOnce(Return(50.0f));

    SafeBrakeController controller(mock);

    // ACT & ASSERT: Xác nhận không bị vỡ toán học
    float force = controller.calculateForce();
    EXPECT_FLOAT_EQ(force, 5.0f); // 50.0 * 0.1
}
```

> [!TIP]
> **Bài học rút ra & Ranh giới ứng dụng:**
> - Dependency Injection kết hợp GMock cho phép tiêm mọi kịch bản lỗi phần cứng giả lập (cảm biến mất nguồn, tín hiệu ngoài dải, tốc độ 0) mà không thể dựng được trên bo mạch thật.
> - Độ bao phủ kiểm thử (Test Coverage) tăng vọt từ 12% lên 96%, đáp ứng trọn vẹn tiêu chuẩn an toàn chức năng ISO 26262 Part 6 Table 12.

---

## 3. Mã Nguồn Mẫu GMock & CMake Integration

```cpp
// test/mocks/bsw_mocks/MockAudioSink.h
#ifndef TEST_MOCK_AUDIO_SINK_H
#define TEST_MOCK_AUDIO_SINK_H

#include "IAudioSink.h"
#include <gmock/gmock.h>

class MockAudioSink : public IAudioSink
{
public:
    MOCK_METHOD(bool, OpenStream, (SongId id, std::uint32_t durationSec), (noexcept, override));
    MOCK_METHOD(void, Play, (), (noexcept, override));
    MOCK_METHOD(void, Stop, (), (noexcept, override));
    MOCK_METHOD(bool, IsPlaying, (), (const, noexcept, override));
};

#endif
```

```cmake
# CMakeLists.txt tích hợp GoogleTest
find_package(GTest REQUIRED)
include(GoogleTest)

add_executable(unit_tests 
    test/unit_tests/asw/test_playback_state_machine.cpp
)
target_link_libraries(unit_tests PRIVATE 
    GTest::gtest_main 
    GTest::gmock
)
gtest_discover_tests(unit_tests)
```

---

## 4. Bảng Đối Chiếu Macro GTest & GMock

| Nhu Cầu | Macro | Ghi chú trong môi trường `-fno-exceptions` |
|:---|:---|:---|
| Fail và dừng test case ngay | `ASSERT_*` | Kích hoạt lệnh `return` → Hàm test bắt buộc phải trả về `void` |
| Fail và vẫn tiếp tục chạy test | `EXPECT_*` | An toàn tuyệt đối trên mọi kiến trúc |
| Kỳ vọng lời gọi hàm | `EXPECT_CALL(m, F(args))` | Verify tự động tại Destructor của Mock Object |
| Cung cấp hành vi mặc định | `ON_CALL(m, F(_))` | Thiết lập giá trị trả về, không kiểm tra số lần gọi |
| Bỏ qua cảnh báo gọi hàm phụ | `NiceMock<T>` | Dùng cho các mock class có nhiều getter phụ trợ |
| Cấm hoàn toàn lời gọi bất thường | `StrictMock<T>` | Báo fail ngay nếu code nghiệp vụ gọi một hàm chưa được EXPECT |
| Ràng buộc thứ tự tương tác | `InSequence s;` | Bắt buộc cho việc test trình tự điều khiển phần cứng |

---

## 5. Các Cạm Bẫy Phổ Biến Cần Tránh

1. **Mock rò rỉ bộ nhớ = Test xanh giả:** Nếu mock object được cấp phát bằng `new` mà không bị `delete`, hàm destructor không chạy $\rightarrow$ GMock không thực hiện kiểm tra cardinality $\rightarrow$ Test pass sai sự thật. Luôn khai báo mock là biến cục bộ trên Stack.
2. **`ASSERT_*` trong hàm helper trả non-void:** Không biên dịch được khi bật `-fno-exceptions`. Dùng `EXPECT_*` hoặc chuyển hàm helper sang trả về `void`.
3. **Đặt `EXPECT_CALL` sau khi thực thi:** GMock sẽ coi lời gọi là Uninteresting Call và không tính vào kết quả. Luôn tuân thủ quy tắc: ARRANGE (`EXPECT_CALL`) $\rightarrow$ ACT $\rightarrow$ ASSERT.

---

## Tài Liệu Tham Khảo

| Nguồn | Nội dung tham chiếu |
|:---|:---|
| [GoogleTest User's Guide](https://google.github.io/googletest/) | Hướng dẫn Primer, Advanced, GMock Cookbook & Cheat Sheet |
| [CMake: GoogleTest Module](https://cmake.org/cmake/help/latest/module/GoogleTest.html) | Tự động phát hiện và đăng ký test cases qua `gtest_discover_tests` |
| *ISO 26262-6:2018* — Road vehicles — Functional safety | Tiêu chuẩn phát triển phần mềm và chỉ tiêu bao phủ nhánh kiểm thử (Branch Coverage) |

---

## Bảng Tóm Tắt Tra Cứu Nhanh (Cheatsheet)

```cpp
MOCK_METHOD(Ret, Name, (Args), (const, noexcept, override));
EXPECT_CALL(m, F(Eq(1), _)).Times(2).WillOnce(Return(a)).WillRepeatedly(Return(b));
ON_CALL(m, F(_)).WillByDefault(Return(x));           // Hành vi mặc định, không verify
{ InSequence s; EXPECT_CALL(m, A()); EXPECT_CALL(m, B()); }  // Ép buộc thứ tự gọi A rồi đến B
NiceMock<MockType> niceMock;                        // Không spam cảnh báo uninteresting call
StrictMock<MockType> strictMock;                    // Đánh rớt test nếu có lệnh gọi lạ
```
