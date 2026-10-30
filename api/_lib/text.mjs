// text.mjs - chuan hoa tieng Viet de tim kiem (bo dau, thuong hoa) va lam sach noi dung tra ve.
export const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
export const tokens = s => fold(s).match(/[a-z0-9]+/g) || [];
// bo the HTML / ky tu dieu khien khoi cau tra loi cua mo hinh (hien thi o khach duoc dua vao textContent, day la lop bao ve thu hai)
export const plain = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r/g, '');
export const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
