// chat-eval.mjs - bo cau hoi mau kiem tra viec tim doan noi dung cho tro ly LinhKate (dung trong check.mjs va chay tay: node tools/chat-eval.mjs [dist])
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex, search } from '../api/_lib/retrieve.mjs';

const DH = '/dai-hoi-the-thao-toan-quoc-2026';
export const CASES = [
  ['Điều kiện để gia nhập hội viên Liên đoàn là gì?', ['/hoi-vien']],
  ['Thủ tục đăng ký hội viên cá nhân như thế nào', ['/hoi-vien']],
  ['Hội viên có quyền và nghĩa vụ gì', ['/hoi-vien']],
  ['Địa chỉ văn phòng Liên đoàn ở đâu', ['/lien-he']],
  ['Cho em xin số điện thoại liên hệ', ['/lien-he']],
  ['Email của Liên đoàn là gì', ['/lien-he']],
  ['Đại hội Thể thao toàn quốc 2026 môn Taekwondo tổ chức khi nào', [DH, '/', '/lich-thi-dau']],
  ['Check-in đại hội mấy giờ, đăng ký khung giờ ra sao', [DH]],
  ['Sắp tới có giải Taekwondo nào', ['/lich-thi-dau', '/']],
  ['Lịch thi đấu năm 2027 dự kiến', ['/lich-thi-dau']],
  ['Kỳ thi thăng đẳng ở Cần Thơ', ['/tin-tuc/ky-thi-thang-dang-khu-vuc-1-can-tho-lan-2-2026']],
  ['Thi thăng đẳng Đà Nẵng khi nào', ['/tin-tuc/ky-thi-thang-dang-khu-vuc-2-da-nang-lan-1-2026']],
  ['Kỳ thi đẳng tại Hà Nội', ['/tin-tuc/ky-thi-thang-dang-thanh-pho-ha-noi-lan-2-2026']],
  ['Tây Ninh thi lên đẳng', ['/tin-tuc/ky-thi-thang-dang-khu-vuc-1-tay-ninh-lan-2-2026']],
  ['Đắk Lắk kỳ thi thăng đẳng', ['/tin-tuc/ky-thi-thang-dang-khu-vuc-1-dak-lak-lan-2-2026']],
  ['Cơ cấu tổ chức của Liên đoàn gồm những gì', ['/co-cau-to-chuc']],
  ['Ai là chủ tịch Liên đoàn', ['/co-cau-to-chuc', '/']],
  ['Quyền hạn của Liên đoàn Taekwondo Việt Nam', ['/quyen-han-nhiem-vu']],
  ['Nhiệm vụ của Liên đoàn', ['/quyen-han-nhiem-vu']],
  ['Điều lệ Liên đoàn có bao nhiêu chương, bao nhiêu điều', ['/dieu-le', '/']],
  ['Tải Điều lệ ở đâu', ['/dieu-le', '/van-ban']],
  ['Kỷ niệm chương 30 năm Liên đoàn', ['/']],
  ['Nghị định 126 về quản lý hội', ['/van-ban']],
  ['Dữ liệu cá nhân của em được dùng thế nào', ['/quyen-rieng-tu']],
  ['Tôn chỉ mục đích của Liên đoàn', ['/gioi-thieu', '/']],
  ['Tên tiếng Anh của Liên đoàn', ['/gioi-thieu', '/']],
  ['Ban trọng tài Đại hội Thể thao toàn quốc môn Taekwondo', [DH]],
  ['Trọng tài giải Taekwondo Vĩnh Long', ['/lich-thi-dau']],
  ['Thông tư tiêu chuẩn tuyển chọn huấn luyện viên đội tuyển', ['/van-ban']],
  ['Còn Điều 9 nói gì?', ['/dieu-le']],
  ['Nội dung thi lên 1 đẳng', ['/van-ban'], 'Taegeuk 8'],
  ['Nội dung thi lên 3 đẳng gồm những gì', ['/van-ban'], 'Keumgang'],
  ['Lệ phí thi lên đẳng là bao nhiêu?', ['/van-ban'], '400.000'],
  ['Võ sinh dưới 6 tuổi có được thi lên cấp không?', ['/van-ban'], '6 tuổi'],
  ['Thành phần ban giám khảo thi thăng đẳng', ['/van-ban'], 'số lẻ'],
  ['Ai được ưu tiên thi thăng đẳng sớm?', ['/van-ban'], 'ưu tiên'],
  ['Thi lên 4 đẳng cần độ tuổi tối thiểu bao nhiêu', ['/van-ban'], '18 tuổi'],
  ['Tiêu chuẩn tuyển chọn huấn luyện viên đội tuyển Taekwondo quốc gia', ['/van-ban'], 'huấn luyện viên'],
  ['Điều 12 Điều lệ quy định thủ tục kết nạp hội viên thế nào', ['/dieu-le']],
];

export function runEval(dist, { k = 5, verbose = false } = {}) {
  const kb = JSON.parse(fs.readFileSync(path.join(dist, 'chat-kb.json'), 'utf8'));
  const index = buildIndex(kb);
  const fails = [];
  let hit = 0;
  for (const [q, pages, must] of CASES) {
    const top = search(index, q, { k });
    const ok = top.some(r => pages.includes(r.c.p) && (!must || r.c.t.toLowerCase().includes(must.toLowerCase())));
    if (ok) hit++; else fails.push(`${q} -> ${top.map(r => r.c.p + '#' + r.c.a).join(' | ')}`);
    if (verbose) console.log(ok ? 'OK  ' : 'FAIL', q, '=>', top.map(r => `${r.c.p}#${r.c.a}(${r.score.toFixed(1)})`).join(' '));
  }
  return { total: CASES.length, hit, fails };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const r = runEval(path.resolve(process.argv[2] || 'dist'), { verbose: true });
  console.log(`\n${r.hit}/${r.total}`);
  process.exit(r.fails.length > r.total * 0.1 ? 1 : 0);
}
