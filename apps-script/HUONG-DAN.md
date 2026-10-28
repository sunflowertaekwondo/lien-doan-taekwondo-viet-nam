# Cài đặt trang quản trị (admin.html) - làm một lần, khoảng 10 phút

Trang quản trị lưu nội dung vào **Google Sheet** của Liên đoàn qua **Google Apps Script**; ảnh tải lên lưu trong **Google Drive**.
Mật khẩu không nằm trong website, không nằm trên GitHub: chỉ có mã băm, cất trong Apps Script của tài khoản Google bạn dùng ở dưới.

## Chuẩn bị
- Một tài khoản Google (nên dùng tài khoản của Liên đoàn). Tài khoản này là **chủ** của Sheet, script và thư mục ảnh.
- Tệp `apps-script/Code.gs` (có sẵn trong mã nguồn) và tệp `_local/cai-dat-tai-khoan.gs` (tạo trên máy, không đưa lên GitHub).

## Các bước
1. Mở <https://sheets.new>, đặt tên "VTF - Nội dung website".
2. Trên Sheet: **Tiện ích mở rộng → Apps Script**. Xóa đoạn mã mẫu, **dán toàn bộ** nội dung `apps-script/Code.gs`, bấm **Lưu**.
3. Chọn hàm **`setup`** ở thanh trên → **Chạy**. Google hỏi quyền (Bảng tính, Drive): bấm *Xem lại quyền* → chọn tài khoản → *Nâng cao* → *Đi tới ... (không an toàn)* → *Cho phép*. Đây là mã của chính bạn; nó chỉ tạo các sheet nội dung và thư mục ảnh "VTF CMS - ảnh".
4. Bấm dấu **+** cạnh *Tệp* → **Tập lệnh**, dán nội dung `_local/cai-dat-tai-khoan.gs`, chọn hàm **`datTaiKhoanAdmin`** → **Chạy** một lần → rồi **xóa tệp đó** đi (nó chỉ chứa mã băm, nhưng không cần giữ).
5. **Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web** → *Thực thi với tư cách*: **Tôi** → *Người có quyền truy cập*: **Bất kỳ ai** → **Triển khai**. Sao chép địa chỉ kết thúc bằng **`/exec`**.
6. Kiểm tra: mở `địa-chỉ-/exec?action=ping` trên trình duyệt, thấy `{"ok":true,...,"ready":true}` là đúng.
7. Dán địa chỉ `/exec` vào `data/cms.json` (trường `endpoint`) rồi đưa website lên lại (hoặc gửi địa chỉ cho người phụ trách web).
8. Mở `https://<website>/admin.html` → đăng nhập. **Đổi mật khẩu ngay** (menu tên tài khoản góc phải → Đổi mật khẩu).

## Dùng hằng ngày
- Chọn trang ở thanh trên → sửa ở cột trái (hoặc **bấm thẳng vào chữ/ảnh trong khung xem trước** bên phải) → **Lưu tất cả** (hoặc Ctrl+S).
- Để trống một ô = trả về nội dung mặc định của website. Nút **↺ Mặc định** trả từng ô, **Hoàn tác** bỏ mọi thay đổi chưa lưu.
- Chữ chỉ nhận định dạng b / i / u / span / a; liên kết chặn `javascript:`; ảnh chỉ nhận http(s) hoặc tải tệp lên; video chỉ nhận YouTube.
- Khung **Video** (dưới cùng mỗi trang, và đầu trang chủ) ẩn cho đến khi bạn dán liên kết YouTube.
- Mọi thay đổi được ghi ở sheet `lich-su` (ai, khi nào, cũ → mới) để khôi phục khi cần. Đăng nhập ghi ở sheet `nhat-ky`.

## Khi cần
- **Sửa mã `Code.gs` về sau**: dán mã mới, rồi *Triển khai → Quản lý triển khai → biểu tượng bút → Phiên bản: Phiên bản mới → Triển khai*. Địa chỉ `/exec` giữ nguyên.
- **Quên mật khẩu**: chạy lại `node apps-script/make-account.mjs` (đặt mật khẩu qua biến môi trường `ADMIN_PASS`), dán tệp mới vào Apps Script, chạy `datTaiKhoanAdmin`.
- **Sai 5 lần** thì khóa 15 phút (chống dò mật khẩu).
- Nếu ảnh tải lên không hiện: kiểm tra thư mục "VTF CMS - ảnh" trong Drive đang ở chế độ *Bất kỳ ai có đường liên kết đều xem được*.
- Google Apps Script có hạn mức sử dụng hằng ngày. Nếu vượt hạn mức, website vẫn chạy bình thường với nội dung gốc (chỉ không hiện phần đã chỉnh sửa cho tới khi hạn mức được làm mới).

## Cách hoạt động (để người làm kỹ thuật nắm)
- Mỗi trang được quét thành các ô sửa được (chữ, liên kết, ảnh + mô tả ảnh, video, tiêu đề/mô tả SEO) và các **khối lặp** (danh sách thẻ, mục, hàng bảng: thêm/xóa/sắp thứ tự). Khóa của ô sinh từ cấu trúc trang; kèm dấu vân tay nội dung gốc, nên khi mã nguồn website đổi nội dung gốc, chỉnh sửa cũ bị **bỏ qua** thay vì đè nhầm (admin báo "nội dung gốc đã đổi").
- Đầu trang và chân trang dùng chung mọi trang; sửa một lần áp dụng tất cả.
- Trang công khai tải nội dung từ Apps Script khi mở (không dùng localStorage); lỗi mạng thì giữ nội dung gốc.
- Kiểm thử máy chủ không cần tài khoản Google: `node apps-script/test.mjs`; chạy thử cục bộ: `node apps-script/emulator.mjs 8790` (mô phỏng đúng `Code.gs`).
- `Code.gs` do `node apps-script/make-gs.mjs` ghép từ `Code.template.gs` + `src/cms-sanitize.js`; kiểm tra tự động bắt buộc hai bên khớp.
