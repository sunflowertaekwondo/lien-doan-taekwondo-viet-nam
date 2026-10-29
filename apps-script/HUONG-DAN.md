# Cài đặt máy chủ Google (trang quản trị + biểu mẫu đăng ký) - làm một lần, khoảng 10 phút

Một **Google Apps Script** duy nhất phục vụ hai việc, chạy dưới tài khoản Google của Liên đoàn:

1. **Trang quản trị** (`/admin.html`): nội dung chỉnh sửa lưu trong Google Sheet "VTF - Nội dung website"; ảnh tải lên lưu trong thư mục Drive `Web_VTF` → `VTF CMS - anh`.
2. **Biểu mẫu đăng ký công khai** (đăng ký hội viên, liên hệ, nhận tin): ghi vào 3 Google Sheet **riêng tư**.

Mật khẩu quản trị không nằm trong website, không nằm trên GitHub: chỉ có mã băm, cất trong Apps Script của tài khoản Google bạn dùng ở dưới.

## Dữ liệu đăng ký nằm ở đâu

Thư mục Drive `Web_VTF` đang để chế độ "ai có liên kết cũng xem được" (để chứa ảnh website). Vì vậy dữ liệu cá nhân **không** để trực tiếp ở đó mà nằm trong thư mục con **`Du lieu dang ky (RIENG TU)`** (đã tắt kế thừa quyền, chỉ chủ tài khoản truy cập):

| Tệp (Google Sheet) | Nội dung | Mã |
|---|---|---|
| `VTF - Hội viên đăng ký` | Đăng ký gia nhập hội viên (tổ chức/cá nhân) | `HV-ngày-số` |
| `VTF - Khách hàng liên hệ` | Tin nhắn từ trang Liên hệ | `LH-ngày-số` |
| `VTF - Người truy cập nhận tin` | Email đăng ký nhận tin (không ghi trùng) | - |

- Mỗi tệp có sẵn cột **Trạng thái** (mặc định "Mới" / "Đang nhận tin") và **Ghi chú nội bộ** để Văn phòng theo dõi. Có thể thêm cột, đổi thứ tự cột: script ghi theo **tên cột**, thiếu cột nào tự thêm ở cuối. Đừng đổi tên các cột có sẵn.
- **Chốt an toàn:** nếu một tệp bị chia sẻ công khai ("bất kỳ ai có liên kết"), script **ngừng ghi** vào tệp đó và báo lỗi cho người gửi. Script cũng **không bao giờ tự tạo** tệp dữ liệu ở thư mục công khai. Chia sẻ cho nhân sự cụ thể (theo email) thì vẫn bình thường.
- Nếu lỡ xóa tệp: lần gửi sau script tự tạo lại trong thư mục riêng tư (kèm dòng tiêu đề).
- Mở tệp bằng Excel/CSV: nội dung bắt đầu bằng `=`, `+`, `-`, `@` đã được thêm dấu `'` để không bị chạy như công thức.

## Bảng check-in Đại hội X trên Drive (tự cập nhật)
Ban Tổ chức quản lý lịch check-in ngày 23/11 trong một Google Sheet riêng (tài khoản khác). Hai bảng dưới đây **đọc thẳng từ bảng đó bằng công thức `IMPORTRANGE`**, nên tự đổi theo khi Ban Tổ chức sửa bảng gốc (không cần trigger, không cần chạy lại):

| Tệp | Vị trí | Nội dung |
|---|---|---|
| `VTF - Lịch check-in Đại hội X (công khai, tự cập nhật)` | `Web_VTF` (công khai, ai có liên kết xem được) | Chỉ giờ, đơn vị, số thẻ, có thi Quyền, trạng thái, còn trống/đã đăng ký. **Không** có họ tên HLV, CCCD, số điện thoại, email. |
| `VTF - Check-in Đại hội X (đầy đủ, RIÊNG TƯ)` | `Du lieu dang ky (RIENG TU)` (chỉ chủ tài khoản) | Bản đọc nguyên bảng gốc, gồm cả thông tin cá nhân. |

- Thiết lập một lần bằng hàm `taoBangCheckIn()` trong `apps-script/thiet-lap-bang-check-in.gs` (dán thêm vào Apps Script rồi chạy; sau đó có thể xóa đoạn dán thêm).
- **Không dùng `IMPORTDATA`** với đường xuất CSV của Google Sheet: trả `#REF!`. `IMPORTRANGE` chạy được vì tài khoản có quyền xem bảng gốc.
- Công thức đọc `A3:L200` của **sheet đầu tiên** của bảng gốc (cột: TT, TIME, ĐƠN VỊ, …, TRẠNG THÁI). Nếu Ban Tổ chức đổi thứ tự cột, hoặc thu hẹp quyền xem, bảng hiện `#REF!`: sửa công thức ở ô `A4` (bảng công khai) / `A1` (bảng đầy đủ) hoặc chạy lại `taoBangCheckIn()`.
- Bảng trên website (`/dai-hoi-the-thao-toan-quoc-2026#check-in`) tự cập nhật mỗi giờ nhờ `.github/workflows/dong-bo-check-in.yml` (chỉ commit khi dữ liệu đổi; bảng gốc lỗi hay dữ liệu bất thường thì giữ bản cũ). Chạy tay khi cần: `node tools/sync-check-in.mjs`. Nút "Xem khung giờ còn trống" trên website trỏ tới bảng công khai trên Drive ở trên.

## Chuẩn bị
- Tài khoản Google của Liên đoàn (chủ thư mục `Web_VTF`).
- Tệp `apps-script/Code.gs` (có sẵn trong mã nguồn; cũng tải được tại `https://raw.githubusercontent.com/sunflowertaekwondo/lien-doan-taekwondo-viet-nam/main/apps-script/Code.gs`).
- Tệp `_local/cai-dat-tai-khoan.gs` (tạo trên máy, không đưa lên GitHub) nếu dùng trang quản trị.

## Các bước
1. Mở <https://script.google.com> → **Dự án mới**, đặt tên "VTF Website". Xóa đoạn mã mẫu, **dán toàn bộ** `Code.gs`, bấm **Lưu**.
2. Chọn hàm **`setup`** ở thanh trên → **Chạy**. Google hỏi quyền (Bảng tính, Drive): *Xem lại quyền* → chọn tài khoản → *Nâng cao* → *Đi tới ... (không an toàn)* → *Cho phép*. Đây là mã của chính bạn. Nó tạo Sheet nội dung (trong thư mục riêng tư), thư mục ảnh, rồi **kiểm tra ghi/đọc/xóa thử** trên cả 3 tệp đăng ký. Nhật ký phải báo `ghi/doc/xoa dung` cho cả 3 tệp.
3. *(Nếu dùng trang quản trị)* bấm **+** cạnh *Tệp* → **Tập lệnh**, dán `_local/cai-dat-tai-khoan.gs`, chạy hàm **`datTaiKhoanAdmin`** một lần, rồi **xóa tệp đó** đi (chỉ chứa mã băm).
4. **Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web** → *Thực thi với tư cách*: **Tôi** → *Người có quyền truy cập*: **Bất kỳ ai** → **Triển khai**. Sao chép địa chỉ kết thúc bằng **`/exec`**.
5. Kiểm tra: mở `địa-chỉ-/exec?action=ping` trên trình duyệt, thấy `{"ok":true,...,"forms":3}` là đúng (`"ready":true` khi đã có tài khoản quản trị).
6. Dán địa chỉ `/exec` vào `data/cms.json` (trường `endpoint`) rồi đưa website lên lại. **Có địa chỉ này thì ba biểu mẫu mới xuất hiện trên website** (Hội viên → Đăng ký, Liên hệ → Gửi tin nhắn, Tin tức → Đăng ký nhận tin) và trang Quyền riêng tư tự thêm mục mô tả việc thu thập dữ liệu. Để trống = không có biểu mẫu, website không gọi ra ngoài.
7. Với trang quản trị: mở `https://<website>/admin.html` → đăng nhập → **đổi mật khẩu ngay** (menu tên tài khoản → Đổi mật khẩu).

## Chống thư rác, giới hạn
- Ô bẫy ẩn + đo thời gian điền (dưới 1,5 giây bị coi là máy): trả "thành công" giả, **không ghi**.
- Mỗi email tối đa 3 lần gửi/giờ cho mỗi biểu mẫu; toàn hệ thống tối đa 150 lượt/giờ. Vượt thì người gửi thấy thông báo thử lại sau.
- Nội dung gửi tối đa 20.000 ký tự; mọi ô bị lọc ký tự điều khiển và `<` `>`; email, số điện thoại được kiểm tra định dạng ở cả trình duyệt lẫn máy chủ.
- Google Apps Script có hạn mức hằng ngày. Quá hạn mức thì biểu mẫu báo lỗi kèm email/điện thoại Liên đoàn; phần còn lại của website vẫn chạy.

## Dùng hằng ngày (trang quản trị)
- Chọn trang ở thanh trên → sửa ở cột trái (hoặc **bấm thẳng vào chữ/ảnh trong khung xem trước** bên phải) → **Lưu tất cả** (hoặc Ctrl+S).
- Để trống một ô = trả về nội dung mặc định của website. Nút **↺ Mặc định** trả từng ô, **Hoàn tác** bỏ mọi thay đổi chưa lưu.
- Chữ chỉ nhận định dạng b / i / u / span / a; liên kết chặn `javascript:`; ảnh chỉ nhận http(s) hoặc tải tệp lên; video chỉ nhận YouTube.
- Khung **Video** (dưới cùng mỗi trang, và đầu trang chủ) ẩn cho đến khi bạn dán liên kết YouTube.
- Mọi thay đổi được ghi ở sheet `lich-su` (ai, khi nào, cũ → mới) để khôi phục khi cần. Đăng nhập ghi ở sheet `nhat-ky`.
- Các biểu mẫu không chỉnh được trong trang quản trị (tránh làm hỏng việc thu thập dữ liệu); tiêu đề và đoạn dẫn của mục chứa biểu mẫu thì sửa được.

## Khi cần
- **Sửa mã `Code.gs` về sau**: dán mã mới, rồi *Triển khai → Quản lý triển khai → biểu tượng bút → Phiên bản: Phiên bản mới → Triển khai*. Địa chỉ `/exec` giữ nguyên.
- **Kiểm tra lại nơi lưu biểu mẫu bất cứ lúc nào**: chạy hàm `kiemTraBieuMau`.
- **Quên mật khẩu quản trị**: chạy lại `node apps-script/make-account.mjs` (đặt mật khẩu qua biến môi trường `ADMIN_PASS`), dán tệp mới vào Apps Script, chạy `datTaiKhoanAdmin`.
- **Sai 5 lần** thì khóa 15 phút (chống dò mật khẩu).
- Nếu ảnh tải lên không hiện: kiểm tra thư mục "VTF CMS - anh" trong Drive đang ở chế độ *Bất kỳ ai có đường liên kết đều xem được*.
- **Người dùng đã gửi biểu mẫu muốn xem/sửa/xóa dữ liệu**: tìm dòng theo email hoặc mã hồ sơ trong tệp tương ứng rồi sửa/xóa (Trang Quyền riêng tư đã nêu quyền này, qua email của Liên đoàn).
- Nếu cần ghi vào tệp bằng tên khác hoặc thư mục khác: sửa `CFG.PRIVATE_FOLDER` và `DK[...].title` trong `Code.template.gs`, chạy `node apps-script/make-gs.mjs`.

## Cách hoạt động (để người làm kỹ thuật nắm)
- Mỗi trang được quét thành các ô sửa được (chữ, liên kết, ảnh + mô tả ảnh, video, tiêu đề/mô tả SEO) và các **khối lặp** (danh sách thẻ, mục, hàng bảng: thêm/xóa/sắp thứ tự). Khóa của ô sinh từ cấu trúc trang; kèm dấu vân tay nội dung gốc, nên khi mã nguồn website đổi nội dung gốc, chỉnh sửa cũ bị **bỏ qua** thay vì đè nhầm (admin báo "nội dung gốc đã đổi").
- Đầu trang và chân trang dùng chung mọi trang; sửa một lần áp dụng tất cả.
- Trang công khai tải nội dung từ Apps Script khi mở (không dùng localStorage); lỗi mạng thì giữ nội dung gốc.
- Biểu mẫu gửi `POST` JSON (`text/plain`, không cần preflight CORS) dạng `{action:'submit', kind:'hoivien'|'lienhe'|'nhantin', f:{...}, t:<ms điền>, hp:'', page:'/hoi-vien'}`; phản hồi chỉ có `ok` và mã hồ sơ (không trả lại dữ liệu cá nhân). Lỗi hợp lệ trả `errors` theo từng ô.
- Kiểm thử máy chủ không cần tài khoản Google: `node apps-script/test.mjs`; chạy thử cục bộ: `node apps-script/emulator.mjs 8790` (mô phỏng đúng `Code.gs`, kể cả Drive/Sheet riêng tư). `check.mjs` còn dựng một bản website có biểu mẫu (`dist-forms`) và điều khiển trình duyệt thật gửi từng biểu mẫu.
- `Code.gs` do `node apps-script/make-gs.mjs` ghép từ `Code.template.gs` + `src/cms-sanitize.js`; kiểm tra tự động bắt buộc hai bên khớp.
