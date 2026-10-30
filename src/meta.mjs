// meta.mjs - danh sach trang + thong tin SEO dung chung cho build.mjs va tools/og.mjs
// desc: 120-160 ky tu, tu khoa chinh o dau; og: tieu de tren anh chia se 1200x630
import fs from 'node:fs';

// lich thi dau: mo ta tu sinh theo nam moi nhat trong data/lich-thi-dau.json
const LICH = JSON.parse(fs.readFileSync(new URL('../data/lich-thi-dau.json', import.meta.url), 'utf8')).lich.slice().sort((x, y) => y.nam - x.nam)[0];
const duKien = LICH.trangThai === 'Dự kiến' ? ' (dự kiến)' : '';
// trang Lich thi dau luon co ca Dai hoi The thao toan quoc X lan lich nam moi nhat -> mo ta va anh chia se co dinh, khong doi theo ngay
const DH = JSON.parse(fs.readFileSync(new URL('../data/dai-hoi-x-2026.json', import.meta.url), 'utf8'));
const dhNgay = `${DH.batDau.slice(8, 10)}–${DH.ketThuc.slice(8, 10)}/${DH.ketThuc.slice(5, 7)}/${DH.ketThuc.slice(0, 4)}`;

export const PAGES = [
  { path: '/', file: 'index.html', og: 'index', title: 'Liên đoàn Taekwondo Việt Nam (VTF)', ogTitle: 'Liên đoàn Taekwondo Việt Nam',
    desc: 'Liên đoàn Taekwondo Việt Nam (VTF): tổ chức xã hội - nghề nghiệp tự nguyện của tổ chức, công dân Việt Nam trong lĩnh vực Taekwondo. Điều lệ, hội viên, cơ cấu.' },
  { path: '/gioi-thieu', file: 'gioi-thieu.html', og: 'gioi-thieu', title: 'Về Liên đoàn', ogTitle: 'Về Liên đoàn',
    desc: 'Giới thiệu Liên đoàn Taekwondo Việt Nam: tên gọi, tôn chỉ, mục đích, địa vị pháp lý, trụ sở, phạm vi hoạt động và 5 nguyên tắc tổ chức theo Điều lệ nhiệm kỳ VI.' },
  { path: '/quyen-han-nhiem-vu', file: 'quyen-han-nhiem-vu.html', og: 'quyen-han-nhiem-vu', title: 'Quyền hạn và nhiệm vụ', ogTitle: 'Quyền hạn và nhiệm vụ',
    desc: 'Quyền hạn và nhiệm vụ của Liên đoàn Taekwondo Việt Nam: 14 quyền hạn (Điều 7) và 16 nhiệm vụ (Điều 8) theo Điều lệ được Bộ Nội vụ phê duyệt năm 2023.' },
  { path: '/co-cau-to-chuc', file: 'co-cau-to-chuc.html', og: 'co-cau-to-chuc', title: 'Cơ cấu tổ chức', ogTitle: 'Cơ cấu tổ chức',
    desc: 'Cơ cấu tổ chức Liên đoàn Taekwondo Việt Nam: sơ đồ và chức năng của Đại hội, Ban Chấp hành, Ban Thường vụ, Ban Kiểm tra, Tổng thư ký, Hội đồng kỹ thuật.' },
  { path: '/lich-thi-dau', file: 'lich-thi-dau.html', og: 'lich-thi-dau', title: 'Lịch thi đấu', ogTitle: `Lịch thi đấu Taekwondo ${DH.batDau.slice(0, 4)} – ${LICH.nam}`,
    desc: `Lịch thi đấu Taekwondo tại Việt Nam: Đại hội Thể thao toàn quốc X (${dhNgay}) và ${LICH.giai.length} giải quốc gia, quốc tế năm ${LICH.nam}${duKien}, theo văn bản chính thức.` },
  { path: '/dai-hoi-the-thao-toan-quoc-2026', file: 'dai-hoi-the-thao-toan-quoc-2026.html', og: 'dai-hoi-x-2026', title: 'Đại hội Thể thao toàn quốc lần thứ X – Taekwondo', ogTitle: 'Taekwondo tại Đại hội Thể thao toàn quốc X',
    desc: 'Môn Taekwondo tại Đại hội Thể thao toàn quốc lần thứ X năm 2026 (23–30/11, Nhà thi đấu An Hội Đông, TP.HCM): chương trình, nội dung, check-in, đăng ký.' },
  { path: '/hoi-vien', file: 'hoi-vien.html', og: 'hoi-vien', title: 'Hội viên', ogTitle: 'Hội viên Liên đoàn',
    desc: 'Hội viên Liên đoàn Taekwondo Việt Nam: tiêu chuẩn hội viên tổ chức và cá nhân, quyền, nghĩa vụ, hồ sơ và thủ tục gia nhập, hỏi đáp theo Điều lệ nhiệm kỳ VI.' },
  { path: '/dieu-le', file: 'dieu-le.html', og: 'dieu-le', title: 'Điều lệ Liên đoàn', ogTitle: 'Điều lệ Liên đoàn',
    desc: 'Toàn văn Điều lệ (sửa đổi, bổ sung) Liên đoàn Taekwondo Việt Nam: 8 chương, 29 điều, phê duyệt kèm Quyết định số 2/QĐ-BNV ngày 03/01/2023. Tra cứu, tải PDF.' },
  { path: '/van-ban', file: 'van-ban.html', og: 'van-ban', title: 'Văn bản pháp lý', ogTitle: 'Văn bản pháp lý',
    desc: 'Văn bản pháp lý của Liên đoàn Taekwondo Việt Nam: Quyết định 2/QĐ-BNV phê duyệt Điều lệ, Điều lệ nhiệm kỳ VI, văn bản quản lý thể thao và quy định chuyên môn. Xem và tải bản PDF gốc.' },
  { path: '/tin-tuc', file: 'tin-tuc.html', og: 'tin-tuc', title: 'Tin tức', ogTitle: 'Tin tức',
    desc: 'Tin tức Liên đoàn Taekwondo Việt Nam: thông báo, hoạt động, giải đấu và công tác chuyên môn của Liên đoàn. Theo dõi qua RSS để nhận tin mới nhất.' },
  { path: '/lien-he', file: 'lien-he.html', og: 'lien-he', title: 'Liên hệ', ogTitle: 'Liên hệ',
    // build.mjs thay bang mo ta co dia chi tu data/site.json; day la mo ta du phong khi chua co dia chi
    desc: 'Liên hệ Liên đoàn Taekwondo Việt Nam: trụ sở tại Thành phố Hồ Chí Minh, Văn phòng Liên đoàn tiếp nhận hồ sơ gia nhập hội viên và các thông tin liên hệ.' },
];
