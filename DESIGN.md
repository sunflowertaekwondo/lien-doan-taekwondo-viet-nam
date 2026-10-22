---
name: Liên đoàn Taekwondo Việt Nam (VTF) – hệ thiết kế website
version: 2.1
source_of_truth: src/site.css (khối :root) – check.mjs đối chiếu bảng token dưới đây với CSS
tokens:
  color:
    navy-900: "#0B1F4D"
    navy-800: "#12306F"
    navy-700: "#1A3E8F"
    blue-700: "#1E40AF"
    blue-600: "#1D4ED8"
    red-600: "#DA251D"
    red-700: "#B91C14"
    red-800: "#991B1B"
    gold-500: "#F4B400"
    slate-900: "#0F172A"
    slate-700: "#334155"
    slate-600: "#475569"
    slate-200: "#E3E8F2"
    slate-50: "#F4F6FB"
  radius: { sm: 8px, md: 12px, lg: 16px, xl: 20px, pill: 999px }
  space: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 20px, 6: 24px, 8: 32px, 10: 40px, 12: 48px, 16: 64px }
  font-size: { xs: 13px, sm: 14px, base: 16px, md: 17px, lg: 18px, xl: 20px }
  z: { sticky: 20, header: 50, overlay: 60, toast: 70, skip: 100 }
  motion: { fast: 150ms, base: 220ms }
  layout: { header: 72px, max-width: 1200px, tap: 44px }
---

# Hệ thiết kế website Liên đoàn Taekwondo Việt Nam

## 1. Tinh thần
Website của một **tổ chức xã hội – nghề nghiệp cấp quốc gia**: đáng tin, rõ ràng, dễ tra cứu văn bản. Ưu tiên theo thứ tự:
khả năng tiếp cận → dễ đọc trên điện thoại → tốc độ → thẩm mỹ. Không dùng hiệu ứng rườm rà, không gradient tím/hồng,
không biểu tượng cảm xúc (emoji) làm icon. Nhận diện riêng của VTF – **không sao chép nhận diện của tổ chức hay thương hiệu khác**.

## 2. Màu
| Vai trò | Token CSS | Sáng | Tối | Ghi chú |
|---|---|---|---|---|
| Chữ chính | `--text` | slate-900 (17.9:1 trên trắng) | #E6EBF7 | |
| Chữ phụ / ghi chú | `--muted` | slate-600 (7.6:1) | #A8B3D1 | đạt mức AAA cho cơ quan công |
| Tiêu đề | `--heading` | navy-900 (15.9:1) | #F1F4FC | |
| Liên kết | `--link` | blue-700 (8.7:1) | #9DB8FF | luôn gạch chân trong đoạn văn |
| Nhấn nhận diện | `--accent` | red-600 | red-600 | nền nút chính, thanh tiêu đề mục, logo. Chữ trắng trên nền này 4.9:1 |
| Chữ đỏ cỡ nhỏ | `--accent-text` | red-800 (8.3:1) | #FF9C94 | KHÔNG dùng red-600 cho chữ < 18px |
| Viền focus | `--focus` + `--focus-halo` | viền navy 3px + quầng vàng | viền vàng | ≥ 3:1 với nền (WCAG 1.4.11) |
| Nền khối xen kẽ | `--surface-2` | slate-50 | #132250 | |

**Logo chính thức** (`src/VTF-logo-*.png`, khai báo trong `data/site.json`): nền sáng dùng bản chữ tối (`logo`), nền tối – chân trang, giao diện tối, ảnh chia sẻ – dùng bản chữ trắng (`logoNenToi`). Không đổi màu, không cắt, không kéo méo; cao tối thiểu 36px. Dưới 360px đầu trang chỉ giữ logo (ẩn chữ bên cạnh).

Quy tắc: đỏ cờ là **điểm nhấn**, không phủ diện rộng. Mỗi màn hình tối đa một nút đỏ chính. Vàng chỉ dùng cho focus và chi tiết nhỏ.
Không dùng màu làm tín hiệu duy nhất (trạng thái văn bản luôn kèm chữ "Còn hiệu lực/Đã được thay thế").

## 3. Chữ
- Font: **Be Vietnam Pro** (SIL OFL 1.1, tự host trong `src/fonts/`, bộ ký tự latin + latin-ext + vietnamese), độ đậm 400/600/700/800. Dự phòng: Segoe UI, system-ui, Roboto, Arial.
- Thang: xs 13 · sm 14 · base 16 · md 17 · lg 18 · xl 20 · 2xl clamp(24–32) · 3xl clamp(28–42) · 4xl clamp(34–58).
- Chữ thân ≥ 16px trên mọi thiết bị; line-height 1.65; độ dài dòng tối đa 75–78 ký tự (`--measure`) cho văn bản dài (Điều lệ, tin bài).
- Không biến đổi chữ hoa/thường bằng CSS trên nội dung văn bản pháp lý (giữ nguyên văn bản gốc).

## 4. Khoảng cách, bo góc, lớp chồng
Khoảng cách theo bội số 4px (`--sp-*`). Bo góc: sm 8 · md 12 · lg 16 · xl 20 · pill. Lớp chồng cố định: sticky 20 · header 50 · overlay 60 · toast 70 · skip 100.

## 5. Bố cục & responsive
Container tối đa 1200px, lề 20px. Điểm ngắt: 1080 (901–1080: đầu trang bỏ chữ cạnh logo để menu 6 mục không xuống dòng) · 1024 (lưới 2 cột, mục lục thu gọn) · 900 (menu mobile toàn màn hình, sơ đồ cây dọc) · 800 (bảng văn bản thành thẻ) · 560 (1 cột) · 400 (thẻ tổ chức 1 cột) · 359 (đầu trang chỉ logo).
Không cuộn ngang ở 320–1920px (check.mjs đo 320, 390, 768, 820, 1440). Header cố định 72px: mọi đích neo có `scroll-margin-top`. Không đặt `backdrop-filter`/`transform` trên phần tử chứa menu `position: fixed`.

## 6. Thành phần
Nút (`.btn-red` chính, `.btn-ghost` trên nền tối, `.btn-outline` phụ) · thẻ (`.card`, `.card.feature` có icon, `.org`) · thẻ văn bản PDF (`.doc`) ·
danh sách đánh số (`.numlist`) · chip điều kiện (`.chips`) · khối thu gọn (`.full`, `.faq-item`) · bảng (`.table`, `.kv`, `.docs-table`) ·
các bước (`.steps`) · tab trong trang (`.tabs`, có đánh dấu mục đang xem) · sơ đồ cây (`.tree`) · thẻ tin (`.news-card`) · phân trang (`.pager`) ·
ghi chú (`.note`) · lịch thi đấu (`.timeline` theo tháng, thẻ `.event`, nhãn cấp giải `.cap-qg` đỏ / `.cap-qt` xanh – luôn kèm chữ, bộ lọc `.seg` dùng `aria-pressed`, thống kê `.cal-stats`, lịch rút gọn trang chủ `.cal-mini`) · trạng thái rỗng (`.placeholder`) · thông báo (`.toast`, aria-live) · nút về đầu trang (`.to-top`).
Mọi phần tử bấm được: vùng chạm ≥ 44×44px (ngoại lệ duy nhất: mục lục Điều lệ là danh sách dày, ≥ 32px, vẫn đạt WCAG 2.5.8), có trạng thái hover/focus, `cursor: pointer`; chuyển động chỉ trên `transform`/`opacity`/màu, 150–220ms.

## 7. Icon
Bộ icon riêng `src/icons.mjs` (khung 24×24, nét 2px, bo tròn), dùng qua `<use href="#i-ten">`. Icon trang trí có `aria-hidden`; nút chỉ có icon phải có `aria-label`.

## 8. Nội dung & dữ liệu
- Mọi thông tin tổ chức lấy từ Điều lệ (`data/dieu-le.json`, khớp 100% PDF) hoặc `data/site.json`. Thông tin chưa có hiển thị "Đang cập nhật" – **không tự đặt ra**.
- Tóm tắt điều khoản luôn kèm liên kết "Nguồn: Điều N".
- Ngày hiển thị dd/mm/yyyy; trong mã máy dùng ISO (yyyy-mm-dd).
- Lịch thi đấu: chép đúng chữ của văn bản nguồn (đã đối chiếu từng trường), ghi "dự kiến" khi văn bản ghi dự kiến, luôn có dòng "Nguồn: Công văn số …". Không suy diễn ý nghĩa cột Ghi chú.

## 9. Khả năng tiếp cận (bắt buộc)
Skip link · một `h1` mỗi trang, tiêu đề không nhảy cấp · `lang="vi"` · mô tả alt cho ảnh nội dung · thông báo động qua `role="status"` ·
tôn trọng `prefers-reduced-motion` · giao diện tối theo `prefers-color-scheme` và nút chuyển (nhãn cố định "Giao diện tối" + `aria-pressed`) · bản in sạch cho văn bản pháp lý (luôn màu sáng, đủ 29 điều).
Menu điện thoại mở: nội dung phía sau `inert`, focus vào mục đầu tiên, Escape đóng. Menu con trên máy tính: Escape ẩn đi. `aria-current="page"` chỉ cho liên kết đúng trang đang xem, `"true"` cho mục cha.
Không dùng phím tắt một ký tự. Ô tìm kiếm có viền focus trong chế độ tương phản cao (`forced-colors`). Thuộc tính `hidden` luôn thắng CSS (`[hidden]{display:none!important}`).
