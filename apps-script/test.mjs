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
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let fails = 0, total = 0;
  await runBackendTests((name, ok, info = '') => { total++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info && !ok ? '  — ' + info : ''}`); });
  console.log(`\n${total - fails}/${total} PASS`);
  process.exit(fails ? 1 : 0);
}
