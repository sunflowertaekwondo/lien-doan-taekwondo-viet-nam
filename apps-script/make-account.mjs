// make-account.mjs - tao tep cai dat tai khoan quan tri cho Apps Script. Tep chi chua DAU BAM (muoi + ma bam), khong chua mat khau.
// Mat khau doc tu bien moi truong (khong go tren dong lenh, khong luu o dau):
//   ADMIN_USER=ten-dang-nhap ADMIN_PASS='mat-khau' node apps-script/make-account.mjs
// -> _local/cai-dat-tai-khoan.gs. Thu muc _local KHONG dua len GitHub (.gitignore, sync-repo). Dan tep vao Apps Script, chay datTaiKhoanAdmin, roi xoa.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createBackend } from './emulator.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const user = String(process.env.ADMIN_USER || '').trim().toLowerCase(), pass = String(process.env.ADMIN_PASS || '');
if (!/^[a-z0-9._@-]{3,60}$/.test(user)) { console.error('ADMIN_USER khong hop le (3-60 ky tu: chu thuong, so, . _ @ -)'); process.exit(1); }
if (pass.length < 8) { console.error('ADMIN_PASS toi thieu 8 ky tu'); process.exit(1); }
const salt = crypto.randomUUID(), hash = createBackend().hashFor(pass, salt); // dung chinh ham bam cua Code.gs
const out = path.join(ROOT, '_local', 'cai-dat-tai-khoan.gs');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + '.tmp', `/**
 * Tai khoan quan tri: "${user}". Tep nay CHI CHUA DAU BAM (muoi + ma bam), khong co mat khau.
 * Dan vao Apps Script (+ > Tap lenh), chon ham datTaiKhoanAdmin, bam Chay MOT LAN, roi XOA tep nay. Doi mat khau sau: trong trang admin, menu ten tai khoan.
 */
function datTaiKhoanAdmin() {
  datTaiKhoan('${user}', '${salt}', '${hash}');
  return 'Da tao tai khoan quan tri: ${user}';
}
`, 'utf8');
fs.renameSync(out + '.tmp', out);
console.log(`Da tao ${path.relative(ROOT, out)} cho tai khoan "${user}" (chi co dau bam).`);
