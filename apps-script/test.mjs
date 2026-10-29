// test.mjs - kiem thu may chu admin (apps-script/Code.gs) bang ban mo phong: dang nhap, khoa, phien, luu, loc XSS, tai anh, doi mat khau.
// Dung: node apps-script/test.mjs   hoac  import { runBackendTests } (check.mjs goi ham nay)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createBackend } from './emulator.mjs';
import { buildGs } from './make-gs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

export async function runBackendTests(check) {
  const rootDir = path.join(HERE, '..');
  // 1. Code.gs dung bang nguon
  const have = fs.existsSync(path.join(HERE, 'Code.gs')) ? fs.readFileSync(path.join(HERE, 'Code.gs'), 'utf8').replace(/\r\n/g, '\n') : '';
  check('apps-script/Code.gs khớp nguồn (Code.template.gs + src/cms-sanitize.js)', have === buildGs(), have ? '' : 'chưa có Code.gs: chạy node apps-script/make-gs.mjs');

  // 2. bo loc: cac mau tan cong XSS thuong gap deu bi vo hieu, noi dung hop le duoc giu
  const SAN = vm.runInNewContext(fs.readFileSync(path.join(rootDir, 'src', 'cms-sanitize.js'), 'utf8') + '\n;CMSAN');
  const evil = [
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<a href="javascript:alert(1)">x</a>', '<a href="jav&#x61;script:alert(1)">x</a>',
    '<a href="java&Tab;script:alert(1)">x</a>', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', '<a href="vbscript:x">x</a>', '<span onmouseover="alert(1)">x</span>',
    '<svg onload=alert(1)>', '<iframe src="https://evil.example"></iframe>', '<scr<script>ipt>alert(1)</scr</script>ipt>', '<b onclick=alert(1)>x</b>',
    '<a href="https://ok.vn" onclick="alert(1)">x</a>', '<style>*{display:none}</style>', '<<script>script>alert(1)<</script>/script>', '<a href="//evil.example">x</a>',
  ];
  // dau ra an toan khi: moi "<" nam trong mot the dung dang chuan (khong co thuoc tinh su kien/style), phan con lai khong con "<"
  const CANON = /^<\/?(?:b|i|u|br|span|a)(?: class="[A-Za-z0-9_ -]+")?(?: href="(?:https?:\/\/|mailto:|tel:|\/|#)?[^"<>:]*")?(?: target="_blank" rel="noopener")?>$|^<a href="(?:https?:\/\/|mailto:|tel:)[^"<>]*"(?: class="[A-Za-z0-9_ -]+")?(?: target="_blank" rel="noopener")?>$/;
  const unsafe = out => (out.match(/<[^<>]*>/g) || []).some(t => !CANON.test(t)) || /[<>]/.test(out.replace(/<[^<>]*>/g, ''));
  const bad = evil.filter(s => unsafe(SAN.html(s)));
  const keep = SAN.html('Xin <b>chào</b> <i>các</i> <u>bạn</u>, <a href="https://a.vn/x?y=1&z=2" target="_blank">link</a> <span class="nw">11/2026</span><br>dòng 2');
  check('Bộ lọc XSS vô hiệu mọi mẫu tấn công (script, onerror, javascript:, data:, entity, lồng thẻ, //host), giữ b/i/u/span/a/br hợp lệ',
    bad.length === 0 && keep === 'Xin <b>chào</b> <i>các</i> <u>bạn</u>, <a href="https://a.vn/x?y=1&amp;z=2" target="_blank" rel="noopener">link</a> <span class="nw">11/2026</span><br>dòng 2', bad.length ? bad.join(' || ') : keep);
  check('Ảnh chỉ nhận http(s); video chỉ nhận YouTube; liên kết chặn javascript:/data:',
    SAN.img('https://a.vn/x.jpg') && !SAN.img('javascript:alert(1)') && !SAN.img('/x.jpg') && !SAN.img('data:image/png;base64,AA') && !SAN.img('ftp://a/x.jpg')
    && SAN.ytEmbed('https://youtu.be/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' && !SAN.ytEmbed('https://vimeo.com/123456789') && !SAN.ytEmbed('https://youtube.com.evil.vn/embed/dQw4w9WgXcQ')
    && SAN.link('/lien-he') && SAN.link('mailto:a@b.vn') && !SAN.link('javascript:alert(1)') && !SAN.link('data:text/html,x'));

  // 3. may chu
  const emu = createBackend();
  const ping0 = emu.get({ action: 'ping' });
  emu.setup(); emu.seedAdmin('tkdvn1996', 'Mat-khau-thu-nghiem-1'); emu.seedAdmin('xemthoi', 'Xem-thoi-12345', 'viewer');
  const ping1 = emu.get({ action: 'ping' });
  check('Cài đặt tạo sheet nội dung/lịch sử/nhật ký + thư mục ảnh; ping báo sẵn sàng khi có tài khoản',
    ['noi-dung', 'lich-su', 'nhat-ky'].every(n => emu.state.sheets.has(n)) && emu.state.folders.size === 1 && ping0.ok && !ping0.ready && ping1.ready === true);
  check('Nội dung công khai đọc được khi chưa có gì', emu.get().ok === true && Object.keys(emu.get().fields).length === 0);

  const fail = emu.login('tkdvn1996', 'sai-mat-khau');
  const noUser = emu.login('khongco', 'x-x-x-x-x-x');
  const ok = emu.login('TkdVN1996', 'Mat-khau-thu-nghiem-1');
  check('Đăng nhập: sai mật khẩu/không có tài khoản bị từ chối; đúng (không phân biệt hoa thường tên) nhận token',
    !fail.ok && fail.code === 'bad_login' && !noUser.ok && noUser.code === 'bad_login' && ok.ok && /^[\w-]+=*\.[\w-]+=*$/.test(ok.token) && ok.user === 'tkdvn1996');
  check('Chỉ vai trò admin vào được (tài khoản vai trò khác bị chặn dù đúng mật khẩu)', emu.login('xemthoi', 'Xem-thoi-12345').code === 'forbidden');
  const pwStored = [...emu.state.props.values()].join('\n');
  check('Mật khẩu không được lưu dạng thường (chỉ băm + muối)', !pwStored.includes('Mat-khau-thu-nghiem-1') && /"h":"[A-Za-z0-9+/=]{40,}"/.test(pwStored));

  // khoa sau 5 lan sai, het khoa sau 15 phut
  for (let i = 0; i < 5; i++) emu.login('khoa-thu', 'sai-' + i);
  const locked = emu.login('khoa-thu', 'sai-nua');
  emu.seedAdmin('khoa-thu', 'Dung-mat-khau-1');
  const lockedRight = emu.login('khoa-thu', 'Dung-mat-khau-1');
  emu.advance(16 * 60 * 1000);
  check('Sai 5 lần thì khóa 15 phút (kể cả nhập đúng), hết giờ đăng nhập lại được', locked.code === 'locked' && lockedRight.code === 'locked' && emu.login('khoa-thu', 'Dung-mat-khau-1').ok);

  const T = ok.token;
  const tamper = T.slice(0, -3) + (T.slice(-3) === 'AAA' ? 'BBB' : 'AAA');
  const body = JSON.parse(Buffer.from(T.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  const forged = Buffer.from(JSON.stringify({ ...body, u: 'xemthoi' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_') + '.' + T.split('.')[1];
  check('Phiên: token sửa chữ ký/giả người dùng bị từ chối; không token bị từ chối', [tamper, forged, '', 'abc'].every(t => emu.post({ action: 'whoami', token: t }).code === 'unauthorized') && emu.post({ action: 'whoami', token: T }).ok);

  // luu noi dung: loc, phien ban, xung dot
  const pay = {
    fields: {
      'index#muc-dich>div.0>div.0>h3.0': { v: 'Đoàn kết <b>hội viên</b><script>alert(1)</script><img src=x onerror=alert(2)>', o: 'abc12' },
      'index#muc-dich>div.0>div.0>p.0': { v: '<a href="javascript:alert(1)">bấm</a> =1+1' },
      'site/h/a.0@href': { v: 'javascript:alert(1)' },
      'site/h/a.1@href': { v: 'https://example.vn/lien-he?x=1&y=2' },
      'index#hero>figure.0>img.0@src': { v: 'data:image/png;base64,AAAA' },
      'index#hero>figure.0>img.1@src': { v: 'https://lh3.googleusercontent.com/d/abc123' },
      'index#video>iframe.0@video': { v: 'https://vimeo.com/76979871' },
      'gioi-thieu#video>iframe.0@video': { v: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      'bad key with spaces': { v: 'x' }, 'x@unknown': { v: 'x' }, 'trong': { v: '' },
    },
    lists: { 'index#muc-dich>div.0': { c: 6, items: [{ id: 'o0' }, { id: 'n9abc', t: 'o0' }, { id: 'o2' }, { id: '<bad>' }] } },
  };
  const conflict = emu.post({ action: 'save', token: T, rev: 5, ...pay });
  const saved = emu.post({ action: 'save', token: T, rev: 0, ...pay });
  const pub = emu.get();
  const F = pub.fields, str = JSON.stringify(pub);
  check('Lưu: sai phiên bản bị báo xung đột; lưu đúng thì tăng phiên bản, lọc sạch XSS, bỏ khóa/giá trị không hợp lệ',
    !conflict.ok && conflict.code === 'conflict' && saved.ok && saved.rev === 1 && pub.rev === 1
    && F['index#muc-dich>div.0>div.0>h3.0'].v === 'Đoàn kết <b>hội viên</b>&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt;' && F['index#muc-dich>div.0>div.0>h3.0'].o === 'abc12'
    && F['index#muc-dich>div.0>div.0>p.0'].v === 'bấm =1+1' && !('site/h/a.0@href' in F) && F['site/h/a.1@href'].v === 'https://example.vn/lien-he?x=1&y=2'
    && !('index#hero>figure.0>img.0@src' in F) && F['index#hero>figure.0>img.1@src'].v === 'https://lh3.googleusercontent.com/d/abc123'
    && !('index#video>iframe.0@video' in F) && F['gioi-thieu#video>iframe.0@video'].v === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    && !('bad key with spaces' in F) && !('x@unknown' in F) && !('trong' in F)
    && JSON.stringify(pub.lists['index#muc-dich>div.0']) === JSON.stringify({ c: 6, items: [{ id: 'o0' }, { id: 'n9abc', t: 'o0' }, { id: 'o2' }] }), str.slice(0, 200));
  const hist = emu.state.sheets.get('lich-su').rows.length, logRows = emu.state.sheets.get('nhat-ky').rows.map(r => r[2]);
  check('Mỗi lần lưu ghi lịch sử thay đổi (sheet lich-su) và nhật ký (đăng nhập, lưu)', hist > 5 && logRows.includes('luu') && logRows.includes('dang-nhap') && logRows.includes('dang-nhap-sai'), `${hist} dòng lịch sử`);

  // Sheet bi sua tay: noi dung doc ra van duoc loc
  const sh = emu.state.sheets.get('noi-dung'); sh.rows.push(['index#x>p.0', 'field', '<script>alert(9)</script><b>ok</b>', '', 'tay']);
  emu.sandbox.CacheService.getScriptCache().remove('content');
  check('Nội dung sửa tay trực tiếp trong Google Sheet vẫn được lọc khi đọc ra', emu.get().fields['index#x>p.0'].v === '&lt;script&gt;alert(9)&lt;/script&gt;<b>ok</b>');
  sh.rows.pop(); emu.sandbox.CacheService.getScriptCache().remove('content');

  const again = emu.post({ action: 'save', token: T, rev: 1, fields: { 'a/b': { v: 'x' } }, lists: {} });
  check('Lưu thay thế toàn bộ: trường không gửi lại bị xóa (trả về mặc định)', again.ok && again.rev === 2 && Object.keys(emu.get().fields).join() === 'a/b' && Object.keys(emu.get().lists).length === 0);
  const many = {}; for (let i = 0; i < 6100; i++) many['k/' + i] = { v: 'x' };
  check('Giới hạn số mục chỉnh sửa (6000)', emu.post({ action: 'save', token: T, rev: 2, fields: many, lists: {} }).code === 'too_big');

  // tai anh
  const up = emu.post({ action: 'upload', token: T, name: 'Logo mới (1).png', mime: 'image/png', data: PNG.toString('base64') });
  const rec = emu.state.uploads[0];
  check('Tải ảnh lên Drive: đặt quyền "ai có liên kết xem", trả URL https, tên tệp được làm sạch', up.ok && /^https:\/\/lh3\.googleusercontent\.com\/d\/D[0-9a-f]+$/.test(up.url) && rec && rec.sharing && rec.sharing[0] === 'ANYONE_WITH_LINK' && /^\d{8}-\d{6}-Logo-m-i-1\.png$/.test(up.name), up.name || up.message);
  const badUp = [
    emu.post({ action: 'upload', token: T, name: 'a.svg', mime: 'image/svg+xml', data: PNG.toString('base64') }),
    emu.post({ action: 'upload', token: T, name: 'a.png', mime: 'image/png', data: Buffer.from('<script>alert(1)</script>').toString('base64') }),
    emu.post({ action: 'upload', token: T, name: 'a.png', mime: 'image/png', data: Buffer.concat([PNG, Buffer.alloc(4.2 * 1024 * 1024)]).toString('base64') }),
    emu.post({ action: 'upload', token: T, name: 'a.png', mime: 'image/png', data: '!!!' }),
    emu.post({ action: 'upload', token: 'x', name: 'a.png', mime: 'image/png', data: PNG.toString('base64') }),
  ];
  check('Tải ảnh: từ chối SVG, tệp giả ảnh (sai chữ ký), ảnh quá 4 MB, dữ liệu hỏng, chưa đăng nhập', badUp.every(r => !r.ok) && ['bad_type', 'bad_data', 'too_big', 'bad_data', 'unauthorized'].every((c, i) => badUp[i].code === c), badUp.map(r => r.code).join());

  // doi mat khau
  const w1 = emu.post({ action: 'passwd', token: T, old: 'sai', pass: 'Mat-khau-moi-123' }), w2 = emu.post({ action: 'passwd', token: T, old: 'Mat-khau-thu-nghiem-1', pass: 'ngan' });
  const ch = emu.post({ action: 'passwd', token: T, old: 'Mat-khau-thu-nghiem-1', pass: 'Mat-khau-moi-123' });
  check('Đổi mật khẩu: sai mật khẩu cũ / quá ngắn bị từ chối; đổi xong phiên cũ hết hiệu lực, mật khẩu cũ không dùng được, mới dùng được',
    w1.code === 'bad_login' && w2.code === 'weak' && ch.ok && emu.post({ action: 'whoami', token: T }).code === 'unauthorized'
    && emu.login('tkdvn1996', 'Mat-khau-thu-nghiem-1').code === 'bad_login' && emu.login('tkdvn1996', 'Mat-khau-moi-123').ok);

  // het han phien
  const t2 = emu.login('tkdvn1996', 'Mat-khau-moi-123').token;
  emu.advance(13 * 3600 * 1000);
  check('Phiên hết hạn sau 12 giờ', emu.post({ action: 'whoami', token: t2 }).code === 'unauthorized');
  check('Yêu cầu hỏng/thao tác lạ trả lỗi JSON, không làm sập', emu.post('{khong phai json').code === 'server' && emu.post({ action: 'xoa-het', token: 'x' }).code === 'unauthorized' && emu.get({ action: 'zzz' }).code === 'bad_action');

  await runFormTests(check);
}

// ---- bieu mau cong khai: hoi vien, lien he, nhan tin -> 3 Sheet rieng tu
async function runFormTests(check) {
  const mk = opts => { const e = createBackend(opts); e.setup(); return e; };
  const fe = mk(), ping = fe.get({ action: 'ping' });
  const send = (e, kind, f, extra = {}) => e.post({ action: 'submit', kind, f: { dongY: true, ...f }, t: 5000, hp: '', page: '/hoi-vien', ...extra });
  const hv = { loai: 'to-chuc', ten: 'CLB Taekwondo Quận 1', daiDien: 'Nguyễn Văn A', dienThoai: '0912 345 678', email: 'Nguyen.A@Example.vn', tinh: 'Thành phố Hồ Chí Minh', diaChi: '1 Lê Lợi', donVi: 'CLB Q1', ghiChu: 'Muốn gia nhập' };

  const r1 = send(fe, 'hoivien', hv), row1 = (fe.forms('hoivien') || [])[0] || {};
  check('Biểu mẫu hội viên: ghi vào tệp riêng đúng cột theo tiêu đề, có mã hồ sơ, giờ Việt Nam, trạng thái "Mới", email chữ thường, SĐT chuẩn hóa, định dạng văn bản',
    r1.ok && r1.ref === 'HV-20261028-0001' && row1['Mã hồ sơ'] === 'HV-20261028-0001' && row1['Loại hội viên'] === 'Tổ chức' && row1['Họ tên / Tên tổ chức'] === hv.ten && row1['Người đại diện (nếu là tổ chức)'] === 'Nguyễn Văn A'
    && row1['Số điện thoại'] === '0912345678' && row1['Email'] === 'nguyen.a@example.vn' && row1['Tỉnh / Thành phố'] === hv.tinh && row1['Thời gian gửi'] === '2026-10-28 10:00:00'
    && row1['Trạng thái'] === 'Mới' && row1['Đồng ý xử lý dữ liệu'] === 'Đã đồng ý' && row1['Trang gửi'] === '/hoi-vien' && fe.formSheet('hoivien').fmt.get(2) === '@', JSON.stringify(row1));

  const inj = send(fe, 'hoivien', { ...hv, email: 'inj@example.vn', ten: '=HYPERLINK("http://x.example","bam vao")', donVi: '@SUM(1+1)', diaChi: '-2+3', ghiChu: '<b>x</b><script>alert(1)</script>+cmd', dienThoai: '+84 912 345 679' });
  const rowI = (fe.forms('hoivien') || [])[1] || {};
  check('Chống chèn công thức (=, +, -, @ đầu ô bị vô hiệu), bỏ < > khỏi nội dung, số điện thoại bắt đầu bằng + vẫn giữ nguyên',
    inj.ok && rowI['Họ tên / Tên tổ chức'].startsWith("'=") && rowI['Đơn vị công tác / CLB'] === "'@SUM(1+1)" && rowI['Địa chỉ'] === "'-2+3" && !/[<>]/.test(rowI['Nội dung / Ghi chú']) && rowI['Số điện thoại'] === '+84912345679', JSON.stringify(rowI));

  const before = fe.forms('hoivien').length;
  const bad = [
    send(fe, 'hoivien', { ...hv, email: 'khong-phai-email' }), send(fe, 'hoivien', { ...hv, email: 'b1@example.vn', dienThoai: '123' }),
    send(fe, 'hoivien', { ...hv, email: 'b2@example.vn', loai: 'khac' }), send(fe, 'hoivien', { ...hv, email: 'b3@example.vn', daiDien: '' }),
    send(fe, 'hoivien', { ...hv, email: 'b4@example.vn', ten: '   ' }), send(fe, 'hoivien', { ...hv, email: 'b5@example.vn', dongY: false }),
    send(fe, 'hoivien', { ...hv, email: 'b6@example.vn', dongY: 'true' }), send(fe, 'hoivien', { ...hv, email: 'b7@example.vn', tinh: '' }),
  ];
  const okPerson = send(fe, 'hoivien', { ...hv, email: 'c1@example.vn', loai: 'ca-nhan', daiDien: '' });
  check('Kiểm tra dữ liệu: email/SĐT sai, loại lạ, thiếu người đại diện (tổ chức), thiếu tên/tỉnh, không đồng ý bị từ chối kèm thông báo theo ô; cá nhân không cần người đại diện; không ghi dòng nào khi lỗi',
    bad.every(r => !r.ok && r.code === 'invalid' && r.errors) && bad[0].errors.email && bad[1].errors.dienThoai && bad[2].errors.loai && bad[3].errors.daiDien && bad[4].errors.ten && bad[5].errors.dongY && bad[6].errors.dongY && bad[7].errors.tinh
    && okPerson.ok && fe.forms('hoivien').length === before + 1, JSON.stringify(bad.map(r => r.errors)));

  const bot = [send(fe, 'hoivien', { ...hv, email: 'bot1@example.vn' }, { hp: 'http://spam.example' }), send(fe, 'hoivien', { ...hv, email: 'bot2@example.vn' }, { t: 300 }), fe.post({ action: 'submit', kind: 'hoivien', f: { ...hv, email: 'bot3@example.vn', dongY: true } })];
  check('Chống máy tự động: ô bẫy bị điền, gửi quá nhanh, hoặc thiếu thời gian điền đều trả "thành công" giả và KHÔNG ghi', bot.every(r => r.ok && r.ref === '') && fe.forms('hoivien').length === before + 1);

  const rl = [1, 2, 3, 4].map(() => send(fe, 'lienhe', { ten: 'Trần B', email: 'rate@example.vn', chuDe: 'khac', noiDung: 'Tôi muốn hỏi về lịch thi đẳng.' }));
  fe.advance(61 * 60 * 1000);
  check('Giới hạn tốc độ: cùng một email tối đa 3 lần/giờ (lần 4 bị từ chối), hết giờ gửi lại được', rl[0].ok && rl[1].ok && rl[2].ok && rl[3].code === 'rate' && send(fe, 'lienhe', { ten: 'Trần B', email: 'rate@example.vn', chuDe: 'khac', noiDung: 'Gửi lại sau một giờ.' }).ok);

  const lh = [send(fe, 'lienhe', { ten: 'Lê C', email: 'lh1@example.vn', chuDe: 'giai-dau', noiDung: 'ngắn' }), send(fe, 'lienhe', { ten: 'Lê C', email: 'lh2@example.vn', chuDe: 'xxx', noiDung: 'Nội dung đủ dài rồi.' }), send(fe, 'lienhe', { ten: 'Lê C', email: 'lh3@example.vn', chuDe: 'hop-tac', dienThoai: 'abc', noiDung: 'Nội dung đủ dài rồi.' })];
  const lhOk = send(fe, 'lienhe', { ten: 'Lê C', email: 'lh4@example.vn', chuDe: 'hop-tac', noiDung: 'Dòng một.\r\n\r\n\r\n\r\nDòng hai.' }, { page: '/lien-he' });
  const lhRow = (fe.forms('lienhe') || []).find(r => r['Email'] === 'lh4@example.vn') || {};
  check('Biểu mẫu liên hệ: chủ đề/nội dung/SĐT sai bị từ chối; hợp lệ ghi mã LH-…, chủ đề theo nhãn, SĐT trống được, xuống dòng gọn',
    lh[0].errors && lh[0].errors.noiDung && lh[1].errors && lh[1].errors.chuDe && lh[2].errors && lh[2].errors.dienThoai && lhOk.ok && /^LH-20261028-\d{4}$/.test(lhOk.ref) && lhRow['Chủ đề'] === 'Hợp tác, tài trợ' && lhRow['Số điện thoại'] === '' && lhRow['Nội dung'] === 'Dòng một.\n\nDòng hai.' && lhRow['Trang gửi'] === '/lien-he', JSON.stringify(lhRow));

  const nt1 = send(fe, 'nhantin', { email: 'Doc.Gia@Example.vn' }, { page: '/tin-tuc' }), nt2 = send(fe, 'nhantin', { email: 'doc.gia@example.vn', ten: 'Khác' }), nt3 = send(fe, 'nhantin', { email: 'doc.gia2@example.vn', ten: 'Phạm D' });
  const ntRows = fe.forms('nhantin');
  check('Đăng ký nhận tin: ghi email chữ thường, trạng thái "Đang nhận tin"; đăng ký lại cùng email không ghi trùng và không tiết lộ đã có (vẫn báo thành công)',
    nt1.ok && nt2.ok && nt3.ok && ntRows.length === 2 && ntRows[0]['Email'] === 'doc.gia@example.vn' && ntRows[0]['Trạng thái'] === 'Đang nhận tin' && ntRows[0]['Đồng ý nhận tin'] === 'Đã đồng ý' && ntRows[0]['Trang gửi'] === '/tin-tuc' && ntRows[1]['Họ và tên'] === 'Phạm D' && JSON.stringify(nt2) === JSON.stringify(nt1), JSON.stringify(ntRows));

  const flood = mk(); let lastCode = '';
  for (let i = 0; i < 151; i++) lastCode = send(flood, 'nhantin', { email: `u${i}@example.vn` }).code || 'ok';
  check('Giới hạn toàn hệ thống: tối đa 150 lượt gửi/giờ, vượt thì từ chối (chống làm đầy Sheet)', lastCode === 'busy' && flood.forms('nhantin').length === 150);

  const bigRaw = JSON.stringify({ action: 'submit', kind: 'lienhe', f: { dongY: true, ten: 'x', email: 'big@example.vn', chuDe: 'khac', noiDung: 'y'.repeat(25000) }, t: 5000 });
  check('Từ chối kiểu biểu mẫu lạ, dữ liệu không phải đối tượng, và nội dung gửi quá 20.000 ký tự',
    fe.post({ action: 'submit', kind: 'xyz', f: {}, t: 5000 }).code === 'bad_kind' && fe.post({ action: 'submit', kind: 'hoivien', f: 'abc', t: 5000 }).code === 'bad_request' && fe.post({ action: 'submit', kind: 'hoivien', f: [1], t: 5000 }).code === 'bad_request' && fe.post(bigRaw).code === 'too_big');

  // an toan: tep dang bi chia se cong khai -> tu choi ghi du lieu ca nhan, khong lo chi tiet cho nguoi gui, ghi nhat ky ky thuat
  const g = mk(); g.formFile('lienhe').access = 'ANYONE_WITH_LINK';
  const blocked = send(g, 'lienhe', { ten: 'Lê C', email: 'safe@example.vn', chuDe: 'khac', noiDung: 'Nội dung thử nghiệm bảo vệ.' });
  const errLog = [...g.state.sheets.get('nhat-ky').rows].filter(r => String(r[2]).startsWith('loi-bieu-mau'));
  g.formFile('lienhe').access = 'PRIVATE';
  const again = send(g, 'lienhe', { ten: 'Lê C', email: 'safe2@example.vn', chuDe: 'khac', noiDung: 'Nội dung thử nghiệm bảo vệ.' });
  check('Chốt an toàn: tệp dữ liệu bị chia sẻ công khai thì KHÔNG ghi (báo lỗi chung, nhật ký kỹ thuật không chứa dữ liệu cá nhân); trả lại Riêng tư thì ghi lại được',
    !blocked.ok && blocked.code === 'server' && !/chia se|Rieng tu|Tep/.test(JSON.stringify(blocked)) && errLog.length === 1 && /chia se/.test(errLog[0][3]) && !/safe@example/.test(JSON.stringify([...g.state.sheets.get('nhat-ky').rows])) && g.forms('lienhe').length === 1 && again.ok);

  // nguoi quan ly them cot / doi thu tu cot trong Sheet: ghi van dung theo tieu de
  const c = mk(), cs = c.formSheet('nhantin'); cs.rows[0] = ['Email', 'Cột thêm', 'Thời gian đăng ký', 'Họ và tên', 'Đồng ý nhận tin', 'Trang gửi', 'Trạng thái', 'Ghi chú nội bộ'];
  const cr = send(c, 'nhantin', { email: 'cot@example.vn', ten: 'Vũ E' }), crow = (c.forms('nhantin') || [])[0] || {};
  cs.rows[0] = cs.rows[0].filter(h => h !== 'Trạng thái'); const cr2 = send(c, 'nhantin', { email: 'cot2@example.vn' }), allHead = cs.rows[0];
  check('Ghi theo tiêu đề cột: thêm/đổi thứ tự cột trong Sheet không làm lệch dữ liệu; thiếu cột nào script tự thêm cột đó ở cuối',
    cr.ok && crow['Email'] === 'cot@example.vn' && crow['Cột thêm'] === '' && crow['Họ và tên'] === 'Vũ E' && crow['Trạng thái'] === 'Đang nhận tin' && cr2.ok && allHead[allHead.length - 1] === 'Trạng thái', JSON.stringify([crow, allHead]));

  // thieu thu muc rieng tu: khong bao gio tao tep du lieu o thu muc cong khai
  const m = createBackend({ seedForms: false }); const msg = m.setup();
  const sm = send(m, 'hoivien', hv), leaked = [...m.state.drive.values()].filter(n => n.type === 'file' && n.parent === m.sandbox.CFG.WEB_FOLDER_ID);
  check('Thiếu thư mục riêng tư: cài đặt báo cảnh báo, gửi biểu mẫu báo lỗi, TUYỆT ĐỐI không tạo tệp dữ liệu ở thư mục công khai Web_VTF', /CANH BAO/.test(String(msg)) && !sm.ok && sm.code === 'server' && leaked.length === 0 && ![...m.state.drive.values()].some(n => n.name === 'VTF - Hội viên đăng ký'));

  // tep du lieu bi xoa nham: tao lai trong thu muc rieng tu, kem tieu de cot
  const d = mk(), hvNode = d.formFile('hoivien'); d.state.drive.delete(hvNode.id);
  const dr = send(d, 'hoivien', hv), recreated = [...d.state.drive.values()].find(n => n.name === 'VTF - Hội viên đăng ký');
  const rb = recreated && recreated.book.getSheets()[0].rows;
  check('Tệp dữ liệu bị xóa nhầm: lần gửi sau tạo lại trong thư mục RIÊNG TƯ, có dòng tiêu đề, dữ liệu vẫn được ghi', dr.ok && recreated && recreated.parent === d.state.seed.priv.id && recreated.access === 'PRIVATE' && rb[0][0] === 'Mã hồ sơ' && rb[1][3] === hv.ten, JSON.stringify(rb && rb[0]));

  // script doc lap (tao tai script.google.com): setup tu tao Sheet noi dung trong thu muc rieng tu, kiem tra 3 tep va khong de lai dong thu
  const s = createBackend({ standalone: true }), sres = s.setup();
  const cmsNode = s.state.drive.get(s.state.props.get('SHEET_ID')), imgFolder = [...s.state.folders.values()][0];
  check('Script độc lập: cài đặt tự tạo Sheet nội dung trong thư mục riêng tư, ảnh vào thư mục Web_VTF, kiểm tra ghi/đọc/xóa cả 3 tệp và không để lại dòng thử; ping báo 3 biểu mẫu',
    /ghi\/doc\/xoa dung/.test(sres) && !/LOI|CANH BAO/.test(sres) && (sres.match(/ghi\/doc\/xoa dung/g) || []).length === 3 && cmsNode && cmsNode.parent === s.state.seed.priv.id && cmsNode.access === 'PRIVATE'
    && imgFolder && imgFolder.parent === s.sandbox.CFG.WEB_FOLDER_ID && ['hoivien', 'lienhe', 'nhantin'].every(k => s.forms(k).length === 0) && s.get({ action: 'ping' }).forms === 3 && s.state.sheets.has('noi-dung'), sres);

  // du lieu ca nhan khong ro ri sang noi khac: thuoc tinh script, nhat ky, phan hoi
  const leak = JSON.stringify([...fe.state.props.values()]) + JSON.stringify(fe.state.sheets.get('nhat-ky').rows) + JSON.stringify(r1);
  check('Dữ liệu cá nhân không rò sang thuộc tính script, nhật ký hay phản hồi (phản hồi chỉ có mã hồ sơ)', !/example\.vn|Nguyễn Văn A|0912345678/.test(leak) && Object.keys(r1).sort().join() === 'ok,ref');
  check('Phản hồi ping báo số biểu mẫu', ping.forms === 3);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let fails = 0, total = 0;
  await runBackendTests((name, ok, info = '') => { total++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info && !ok ? '  — ' + info : ''}`); });
  console.log(`\n${total - fails}/${total} PASS`);
  process.exit(fails ? 1 : 0);
}
