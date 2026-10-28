# Website Liên đoàn Taekwondo Việt Nam (VTF)

Website tĩnh, nội dung theo **Điều lệ (sửa đổi, bổ sung)** do Đại hội nhiệm kỳ VI (2022 – 2026) thông qua ngày 19/08/2022, Bộ Nội vụ phê duyệt theo Quyết định số 2/QĐ-BNV ngày 03/01/2023.

- Bản trực tuyến: https://sunflowertaekwondo.github.io/lien-doan-taekwondo-viet-nam/
- Thư mục trên máy: `P:\Data10\Website VTF`

## Tính năng
- **12 trang**: trang chủ, giới thiệu, quyền hạn và nhiệm vụ, cơ cấu tổ chức (sơ đồ), lịch thi đấu, Đại hội Thể thao toàn quốc lần thứ X (môn Taekwondo), hội viên (kèm hỏi đáp), toàn văn Điều lệ, văn bản pháp lý, tin tức, liên hệ, quyền riêng tư.
- **Lịch thi đấu**: các giải quốc gia và quốc tế tại Việt Nam, xếp theo tháng, có nhãn và bộ lọc Quốc gia/Quốc tế, ghi rõ văn bản nguồn. Trang chủ có lịch rút gọn.
- **Nhận diện**: logo chính thức (bản chữ tối cho nền sáng, bản chữ trắng cho chân trang và giao diện tối), địa chỉ, điện thoại, email ở chân trang và trang Liên hệ (kèm địa chỉ tiếng Anh, nút xem bản đồ).
- **Điều lệ**:
  - Toàn văn khớp từng chữ với bản PDF.
  - Tìm kiếm: gõ không dấu thì khớp mọi thanh điệu; gõ có dấu thì khớp đúng dấu. Tìm được số Điều ("Điều 5", "khoản 3"). Kết quả được tô sáng.
  - Sao chép liên kết từng Điều, mục lục bám theo khi cuộn, thanh tiến độ đọc.
  - Bản in luôn đủ 29 điều, kể cả khi đang lọc tìm kiếm. Có nút tải PDF.
- **Tin tức**: viết bằng tệp Markdown. Web tự tạo danh sách có phân trang, trang bài và nguồn RSS. Bài có ảnh thì dùng ảnh đó khi chia sẻ Facebook.
- **Giao diện và truy cập**:
  - Chế độ sáng/tối, tự theo máy khi chưa chọn.
  - Đạt chuẩn WCAG 2.2 AA: tương phản, bàn phím, menu điện thoại giữ phím Tab trong menu, vùng chạm 44px, không tràn ngang từ 320px, chế độ tương phản cao của Windows, giảm chuyển động.
- **SEO và chia sẻ**: ảnh chia sẻ riêng từng trang (có logo), canonical, sitemap (ngày cập nhật thật), dữ liệu có cấu trúc (tổ chức thể thao kèm địa chỉ, breadcrumb, hỏi đáp, tin bài).
- **Hiệu năng**:
  - Font tự host. Chỉ gọi máy chủ nội dung của Liên đoàn (Google Apps Script) khi đã cài trang quản trị.
  - Tài nguyên gắn mã băm.
  - Cài được như ứng dụng (PWA). Khi mất mạng vẫn đọc được trang đã xem.

## Cập nhật nội dung
| Việc | Sửa ở đâu |
|---|---|
| Địa chỉ, điện thoại, email, website, Facebook/YouTube, danh sách lãnh đạo | `data/site.json`. Để trống thì web hiện "Đang cập nhật" |
| Logo | Đặt tệp PNG/SVG vào `src/`, ghi tên vào `logo` (bản chữ tối) và `logoNenToi` (bản chữ trắng) trong `data/site.json`, rồi chạy `node tools/og.mjs` để tạo lại ảnh chia sẻ và biểu tượng |
| Ngày cập nhật hiện ở chân trang và gửi Google | `ngayCapNhatNoiDung` trong `data/site.json`. Đổi mỗi khi sửa nội dung trang; không cần đổi khi chỉ đăng tin |
| Tình trạng hiệu lực văn bản | Bảng ở trang Văn bản pháp lý và `ngayRaSoatVanBan` trong `data/site.json`. Khi Đại hội nhiệm kỳ mới thông qua Điều lệ mới, cần cập nhật cả Điều lệ |
| Lịch thi đấu | `data/lich-thi-dau.json`: mỗi năm một mục (số, ngày công văn nguồn, danh sách giải với tên, cấp giải, thời gian, tháng, địa điểm, ghi chú). Chỉ đưa thông tin từ văn bản chính thức. Thêm năm mới thì chạy thêm `node tools/og.mjs` |
| Đại hội Thể thao toàn quốc X | `data/dai-hoi-x-2026.json`: chương trình, nội dung, check-in, liên hệ, đường link biểu mẫu, Ban Tổ chức (QĐ 94) và Ban Trọng tài (QĐ 173) (chép nguyên văn từ Điều lệ môn QĐ 9/QĐ-BTCĐHTTTQ, Sổ tay Check-in và các quyết định). File PDF trong `data/docs/`. Bảng thông báo ở trang chủ tự ẩn sau ngày kết thúc |
| Đăng tin | Chép `content/tin-tuc/_mau-bai-viet.md` thành tệp mới (tên không dấu, nối gạch ngang), sửa phần đầu, bỏ dòng `draft: true`. Ảnh đặt trong `content/tin-tuc/anh/` |
| Giao diện | `src/site.css`, theo quy tắc trong `DESIGN.md` |
| Tên miền riêng | Khai báo Custom domain trong Settings → Pages của repository. Quy trình tự động sẽ lấy địa chỉ mới; `siteUrl` trong `data/site.json` chỉ dùng khi tạo web trên máy |

## Trang quản trị (`/admin.html`)
Sửa mọi chữ, ảnh (tải lên hoặc dán link), liên kết, video YouTube và các danh sách (thêm/xóa/sắp thứ tự) ngay trên trình duyệt, không cần sửa mã. Bên trái là form theo từng khu, bên phải là khung xem trước trực tiếp; có Lưu tất cả, Hoàn tác, xem thử máy tính/điện thoại, cảnh báo khi rời trang lúc chưa lưu.
- **Nguyên tắc**: HTML gốc là nội dung mặc định, admin chỉ đè lên; xóa trắng một ô là trả về mặc định. Bố cục và công thức vẫn sửa trong mã.
- **Lưu trữ**: Google Sheet qua Google Apps Script (`apps-script/Code.gs`), ảnh lưu Google Drive. Không lưu localStorage, không ghi cứng trong mã. Đăng nhập bằng tài khoản + mật khẩu (chỉ lưu mã băm), khóa 15 phút sau 5 lần sai.
- **Bảo mật**: chữ chỉ nhận `b i u span a br`; chặn `javascript:`; ảnh chỉ http(s); video chỉ YouTube. Lọc ở cả trình duyệt lẫn máy chủ.
- **Cài đặt một lần** (10 phút): `apps-script/HUONG-DAN.md`. Chưa cài thì `data/cms.json` để trống: website chạy như cũ, không gọi máy chủ nào.
- Kiểm thử: `node apps-script/test.mjs` (máy chủ, chạy nguyên văn `Code.gs` trong bản mô phỏng) và `node check.mjs` (cả trình duyệt thật).

## Lệnh (chạy trong thư mục `P:\Data10\Website VTF`)
```bash
npm ci               # cài công cụ kiểm tra (một lần)
node build.mjs       # tạo website trong dist/
node serve.mjs       # xem thử tại http://localhost:8700
node check.mjs       # kiểm tra toàn bộ, 29 mục (cần Chrome)
node tools/og.mjs    # tạo lại ảnh chia sẻ, biểu tượng (khi đổi logo hoặc tên trang)
```
Muốn thử bản có đường dẫn con như GitHub Pages: `SITE_BASE=/lien-doan-taekwondo-viet-nam SITE_OUT=dist-pages node build.mjs`. Trong Git Bash phải thêm `MSYS_NO_PATHCONV=1` ở đầu lệnh, nếu không Git Bash sẽ đổi đường dẫn thành đường dẫn Windows và lệnh build sẽ báo lỗi.

## Đưa lên mạng
Đẩy (push) lên nhánh `main` của repository, GitHub Actions sẽ tự làm phần còn lại (khoảng 2–3 phút):
1. Lấy địa chỉ và đường dẫn con từ cấu hình Pages.
2. Tạo web với ngày theo giờ Việt Nam.
3. Chạy toàn bộ 29 mục kiểm tra trên đúng bản sẽ đưa lên.
4. Đạt hết mới đưa lên GitHub Pages. Nếu kiểm tra không đạt, bản cũ vẫn được giữ.

**Google, Bing**: web nằm ở đường dẫn con nên `robots.txt` không có tác dụng. Hãy khai báo địa chỉ sơ đồ trang `https://sunflowertaekwondo.github.io/lien-doan-taekwondo-viet-nam/sitemap.xml` trong Google Search Console (loại "Tiền tố URL") và Bing Webmaster Tools. Khi chuyển sang tên miền riêng thì `robots.txt` có tác dụng trở lại.

## Giấy phép thành phần
- **Logo**: biểu trưng chính thức của Liên đoàn (Điều 1 khoản 4 Điều lệ: được đăng ký bản quyền). Chỉ dùng cho website của Liên đoàn.
- **Font**: Be Vietnam Pro, giấy phép SIL Open Font License 1.1 (`src/fonts/OFL.txt`).
- **Icon, ảnh chia sẻ, giao diện**: thiết kế riêng cho website này.
- **Văn bản Điều lệ và Quyết định**: văn bản chính thức của Liên đoàn.
