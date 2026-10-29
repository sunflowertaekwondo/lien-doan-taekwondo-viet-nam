// sync-check-in.mjs - lay LICH CHECK-IN tu Google Sheet cua Ban To chuc (dang "ai co lien ket xem duoc") va ghi data/check-in-lich.json.
// CHI GIU cac cot an toan: gio, don vi, so the, co thi Quyen hay khong, trang thai. KHONG BAO GIO doc/luu ho ten HLV, so CCCD, so dien thoai, email.
// Dung:  node tools/sync-check-in.mjs        roi  node build.mjs   (hoac day len GitHub nhu moi lan sua noi dung)
// Tu dong: .github/workflows/dong-bo-check-in.yml chay lenh nay moi gio, chi commit khi du lieu thay doi.
// Dia chi bang goc lay tu data/dai-hoi-x-2026.json (lienKet.khungGioGoc). Du lieu khong doi thi khong ghi lai tep.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dai-hoi-x-2026.json'), 'utf8'));
const url = DH.lienKet.khungGioGoc || DH.lienKet.khungGio, m = /\/d\/([\w-]+)/.exec(url), g = /[?&#]gid=(\d+)/.exec(url);
if (!m) throw new Error(`Khong tim thay ma bang tinh trong lienKet.khungGioGoc: ${url}`);
const CSV = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${g ? g[1] : '0'}`;

const res = await fetch(CSV, { redirect: 'follow' });
if (!res.ok) throw new Error(`Khong tai duoc bang (HTTP ${res.status}). Bang phai o che do "Bat ky ai co lien ket deu xem duoc".`);
const txt = await res.text();

// doc CSV (co dau ngoac kep, xuong dong trong o)
const rows = []; let row = [], cell = '', q = false;
for (let i = 0; i < txt.length; i++) {
  const c = txt[i];
  if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
  else if (c === '"') q = true;
  else if (c === ',') { row.push(cell); cell = ''; }
  else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
  else cell += c;
}
if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const H = rows.findIndex(r => norm(r[0]) === 'TT' && norm(r[1]) === 'TIME');
if (H < 0) throw new Error('Khong thay dong tieu de (TT, TIME, ...) trong bang: cau truc bang da doi.');
const col = name => { const i = rows[H].findIndex(h => norm(h).toUpperCase() === name); if (i < 0) throw new Error(`Thieu cot "${name}" trong bang.`); return i; };
const C = { don: col('ĐƠN VỊ'), hlv: col('TỔNG SỐ THẺ QUAN CHỨC VÀ HLV'), vdv: col('TỔNG SỐ THẺ VĐV'), quyen: col('ĐƠN VỊ CÓ THAM DỰ CÁC NỘI DUNG QUYỀN'), tt: col('TRẠNG THÁI') };

const num = s => { const t = norm(s); return /^\d{1,3}$/.test(t) ? Number(t) : null; };
const lich = [];
for (const r of rows.slice(H + 1)) {
  const a = norm(r[0]);
  if (/LUNCH|NGHỈ/i.test(a)) { const t = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/.exec(a); if (!lich.length || !lich[lich.length - 1].nghi) lich.push({ nghi: t ? `${t[1].replace('.', ':')} - ${t[2].replace('.', ':')}` : 'Nghỉ trưa' }); continue; }
  if (!/^\d{1,3}$/.test(a)) continue; // dong trong, dong tong ket cuoi bang
  const gio = norm(r[1]); if (!/^\d{1,2}:\d{2}$/.test(gio)) throw new Error(`Gio khong hop le o TT ${a}: "${gio}"`);
  const donVi = norm(r[C.don]);
  if (/@|\d{7,}/.test(donVi) || donVi.length > 60) throw new Error(`O "ĐƠN VỊ" cua TT ${a} co ve chua du lieu ca nhan hoac qua dai: dung xuat ban, hay sua bang truoc.`);
  const o = { tt: Number(a), gio, donVi };
  if (donVi) {
    o.theBtcHlv = num(r[C.hlv]); o.theVdv = num(r[C.vdv]);
    const qy = norm(r[C.quyen]).toUpperCase(); o.quyen = qy === 'CÓ' ? 'Có' : qy === 'KHÔNG' ? 'Không' : null;
    o.trangThai = norm(r[C.tt]).toUpperCase() || null;
  }
  lich.push(o);
}
const slots = lich.filter(x => x.tt), used = slots.filter(x => x.donVi);
// chan du lieu bat thuong (cau truc bang doi, bang rong...) de khong dang len website
if (slots.length < 10 || slots.length > 150) throw new Error(`So khung gio bat thuong (${slots.length}): dung xuat ban, hay kiem tra bang goc.`);

const file = path.join(ROOT, 'data', 'check-in-lich.json');
const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
if (old && old.nguon === url && old.ngay === DH.checkIn.ngay && JSON.stringify(old.lich) === JSON.stringify(lich)) {
  console.log(`Khong doi: ${slots.length} khung gio, ${used.length} don vi (cap nhat lan cuoi ${old.layLuc || old.layNgay}).`);
  process.exit(0);
}
const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
const layNgay = `${p.year}-${p.month}-${p.day}`;
const out = {
  _ghi_chu: 'TU DONG tao boi tools/sync-check-in.mjs tu bang dang ky cua BTC (moi gio, chi ghi khi co thay doi). Chi gom gio, don vi, so the, co thi Quyen, trang thai. KHONG chua ho ten HLV, CCCD, so dien thoai, email. Dung sua tay: chay lai lenh.',
  nguon: url, layNgay, layLuc: `${layNgay}T${p.hour}:${p.minute}`, ngay: DH.checkIn.ngay, lich,
};
const tmp = file + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(out, null, 1) + '\n', 'utf8'); fs.renameSync(tmp, file);
console.log(`Da ghi ${path.relative(ROOT, file)}: ${slots.length} khung gio, ${used.length} don vi da dang ky, ${slots.length - used.length} con trong (${out.layLuc}).`);
