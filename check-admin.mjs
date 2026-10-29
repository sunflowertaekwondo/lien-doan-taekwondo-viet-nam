// check-admin.mjs - kiem tra trang quan tri (admin.html) voi may chu THAT: chay nguyen van apps-script/Code.gs trong Node (apps-script/emulator.mjs),
// noi vao trinh duyet bang route cua Playwright (khong goi Google). check.mjs goi checkAdmin({ b, BASE, ORIGIN, check }).
import { createBackend } from './apps-script/emulator.mjs';
import { runBackendTests } from './apps-script/test.mjs';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const H1_KEY = 'index/m/section.0>div.0>div.0>h1.0';

export async function checkAdmin({ b, BASE, ORIGIN, check }) {
  await runBackendTests(check);

  const EP = 'https://script.google.com/macros/s/AKfycbxKIEMTHU/exec';
  const emu = createBackend(); emu.setup(); emu.seedAdmin('quan-tri', 'Mat-khau-kiem-thu-1');
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/kaspersky-labs|kis\.v2\.scr/, r => r.abort());
  // trang that ban ra co endpoint de trong hoac endpoint that: ep bang endpoint thu de moi truy cap di qua may chu mo phong
  await ctx.route(u => u.origin === ORIGIN, async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch(), ct = res.headers()['content-type'] || '';
    if (!/text\/html/.test(ct)) return route.fulfill({ response: res });
    return route.fulfill({ response: res, body: (await res.text()).replace(/data-endpoint="[^"]*"/g, `data-endpoint="${EP}"`) });
  });
  await ctx.route(u => u.href.startsWith(EP), async route => { const r = route.request(); const x = await emu.http(r.method(), r.url(), r.postData()); await route.fulfill({ status: x.status, headers: x.headers, body: x.body }); });

  const page = await ctx.newPage(), pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const frame = () => page.frames().find(f => f.url().includes('cms-preview=1'));
  const fvalue = (label, g) => page.evaluate(([label, g]) => { const grp = [...document.querySelectorAll('.grp')].find(x => x.dataset.g === g || x.querySelector('.gt').textContent.startsWith(g)); grp.open = true; grp._fill(); const r = [...grp.querySelectorAll('.fr')].find(x => x.querySelector('.fr-lb').textContent === label); return r && r.dataset.key; }, [label, g]);
  const setByKey = (key, v) => page.evaluate(([key, v]) => { const r = [...document.querySelectorAll('.fr')].find(x => x.dataset.key === key), i = r.querySelector('textarea, input[type=text]'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return r.querySelector('.fr-err').textContent; }, [key, v]);
  const status = () => page.evaluate(() => document.querySelector('.ad-status').textContent);
  const waitApp = () => page.waitForSelector('.grp', { timeout: 15000 });

  // ---- dang nhap
  await page.goto(BASE + '/admin.html', { waitUntil: 'load' });
  await page.waitForSelector('#lg-u');
  const noIdx = await page.evaluate(() => document.querySelector('meta[name=robots]').content);
  await page.fill('#lg-u', 'quan-tri'); await page.fill('#lg-p', 'sai-mat-khau-1'); await page.click('.ad-login button[type=submit]');
  await page.waitForFunction(() => /Sai tài khoản/.test((document.querySelector('.ad-err') || {}).textContent || ''));
  await page.fill('#lg-p', 'Mat-khau-kiem-thu-1'); await page.click('.ad-login button[type=submit]');
  await waitApp();
  check('Admin: đăng nhập sai báo lỗi, đúng vào được trang quản trị (noindex, chia đôi form + xem trước)', /noindex/.test(noIdx) && !!(await page.$('.ad-form')) && !!(await page.$('.ad-frame')) && /Đã lưu/.test(await status()), noIdx);

  // ---- cau truc form tu trang that
  await page.waitForFunction(() => { const f = document.querySelector('.ad-frame'); return f && f.contentWindow.VTFCMS && f.contentWindow.VTFCMS.model; });
  const st = await page.evaluate(() => { const M = document.querySelector('.ad-frame').contentWindow.VTFCMS.model; return { groups: [...document.querySelectorAll('.grp .gt')].map(x => x.textContent), fields: Object.keys(M.fieldsByKey).length, lists: M.lists.length, kinds: [...new Set(Object.values(M.fieldsByKey).map(f => f.kind))].sort(), pages: [...document.querySelectorAll('#pg option')].length }; });
  check('Admin: quét đủ chữ, liên kết, ảnh, mô tả ảnh, video, tiêu đề SEO; khối lặp; nhóm theo khu; liệt kê mọi trang', st.kinds.join() === 'alt,href,html,mt,md,src,t,video'.split(',').sort().join() && st.fields > 150 && st.lists >= 5 && st.groups.some(g => /Đầu trang/.test(g)) && st.groups.some(g => /Chân trang/.test(g)) && st.pages >= 12, JSON.stringify({ k: st.kinds, f: st.fields, l: st.lists, g: st.groups.length, p: st.pages }));

  // ---- sua truc tiep: xem truoc doi ngay, canh bao roi trang, hoan tac
  const h1 = await fvalue('Tiêu đề lớn', 'm0');
  const h1Def = await frame().evaluate(() => document.querySelector('h1').textContent);
  await setByKey(h1, 'Tiêu đề thử nghiệm');
  const live = await frame().evaluate(() => document.querySelector('h1').textContent);
  const dirty1 = await status();
  const warn = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  await page.click('.ad-top .btn-ghost'); await page.click('.ad-modal .btn-red');
  await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('.ad-status').textContent));
  const undone = await frame().evaluate(() => document.querySelector('h1').textContent);
  const warn2 = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  check('Admin: sửa là thấy ngay trong khung xem trước; cảnh báo khi rời trang lúc chưa lưu; Hoàn tác trả về bản đã lưu', h1 === H1_KEY && live === 'Tiêu đề thử nghiệm' && /1 thay đổi chưa lưu/.test(dirty1) && warn && undone === h1Def && !warn2, `${live} | ${dirty1} | warn=${warn}/${warn2}`);

  // ---- bam vao chu trong khung xem truoc -> nhay den dung o
  await frame().click('h1');
  const focus = await page.evaluate(() => { const a = document.activeElement; return a && a.closest('.fr') && a.closest('.fr').dataset.key; });
  check('Admin: bấm vào chữ trong khung xem trước thì mở và chọn đúng ô cần sửa', focus === H1_KEY, String(focus));

  // ---- chong XSS khi nhap
  await page.evaluate(() => { document.querySelector('.ad-frame').contentWindow.__x = 0; });
  const pRow = await fvalue('Đoạn văn', 'm0');
  await setByKey(pRow, 'A <b>đậm</b> <script>window.__x=1</script><img src=x onerror="window.__x=2"><a href="javascript:window.__x=3">bấm</a>');
  const badge = await frame().evaluate(() => ({ x: window.__x, bad: document.querySelectorAll('.hh-badge script, .hh-badge img, .hh-badge a, .hh-badge [onerror]').length, html: document.querySelector('.hh-badge').innerHTML }));
  check('Admin: chữ nhập vào bị lọc XSS (script, onerror, javascript: không thành thẻ thật, không chạy mã)', badge.x === 0 && badge.bad === 0 && /<b>đậm<\/b>/.test(badge.html), badge.html.slice(0, 120));
  await setByKey(pRow, ''); // xoa trang = tra ve mac dinh
  const back = await frame().evaluate(() => document.querySelector('.hh-badge').innerHTML);
  check('Admin: xóa trắng một ô = trả về nội dung mặc định của website', /<span>30 năm<\/span>/.test(back) && /Đã lưu/.test(await status()), back);

  // ---- lien ket, anh, video: kiem tra dinh dang
  const logoRow = await fvalue('Logo (nền sáng)', 'Đầu trang');
  const imgErr = await setByKey(logoRow, 'javascript:alert(1)');
  const hrefKey = await page.evaluate(() => { const g = [...document.querySelectorAll('.grp')].find(x => x.dataset.g === 'header'); return [...g.querySelectorAll('.k-href')][0].dataset.key; });
  const hrefErr = await setByKey(hrefKey, 'javascript:alert(1)');
  const vidKey = await fvalue('Video YouTube', 'Video giới thiệu');
  const vidErr = await setByKey(vidKey, 'https://vimeo.com/76979871');
  const vidHidden1 = await frame().evaluate(() => document.getElementById('video-noi-bat').hidden);
  check('Admin: ảnh chỉ nhận http(s), liên kết chặn javascript:, video chỉ nhận YouTube (báo lỗi, không áp dụng)', /http/.test(imgErr) && /không hợp lệ/.test(hrefErr) && /YouTube/.test(vidErr) && vidHidden1 && /Đã lưu/.test(await status()), `${imgErr} | ${hrefErr} | ${vidErr}`);

  // ---- tai anh len (keo-tha/chon tep) -> Drive -> dan vao o
  await page.evaluate(() => { const g = [...document.querySelectorAll('.grp')].find(x => x.dataset.g === 'header'); g.open = true; g._fill(); });
  const fileInput = await page.evaluateHandle(key => [...document.querySelectorAll('.fr')].find(x => x.dataset.key === key).querySelector('input[type=file]'), logoRow);
  await fileInput.asElement().setInputFiles({ name: 'logo-moi.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(key => /Đã tải lên/.test([...document.querySelectorAll('.fr')].find(x => x.dataset.key === key).querySelector('.up-st').textContent), logoRow, { timeout: 15000 });
  const up = await page.evaluate(key => { const r = [...document.querySelectorAll('.fr')].find(x => x.dataset.key === key); return { v: r.querySelector('input[type=text]').value, prev: document.querySelector('.ad-frame').contentDocument.querySelector('.site-header img.logo-img').getAttribute('src') }; }, logoRow);
  check('Admin: tải ảnh lên (chọn tệp) → lưu vào Drive, dán địa chỉ https vào ô, xem trước đổi ngay', emu.state.uploads.length === 1 && /^https:\/\/lh3\.googleusercontent\.com\/d\/D[0-9a-f]+$/.test(up.v) && up.prev === up.v, up.v);

  // ---- khoi lap: nhan doi, sua, doi cho, xoa
  const list = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms)), d = () => document.querySelector('.ad-frame').contentDocument;
    const g = [...document.querySelectorAll('.grp')].find(x => x.querySelector('.gt').textContent.startsWith('Tôn chỉ')); g.open = true; g._fill();
    const lst = g.querySelector('.lst'), items = () => lst.querySelectorAll(':scope > .lst-items > .li'), tit = () => [...d().querySelectorAll('#muc-dich .feature h3')].map(x => x.textContent);
    const btn = (i, t) => items()[i].querySelector('.ib-b[title="' + t + '"]');
    const before = tit(); btn(0, 'Nhân đôi mục này').click(); await wait(80);
    const li = items()[1]; li.open = true; li._fill();
    const ta = [...li.querySelectorAll('.fr')].find(r => r.querySelector('.fr-lb').textContent === 'Tiêu đề nhỏ').querySelector('textarea'); ta.value = 'MỤC MỚI'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    const dup = tit(); btn(1, 'Chuyển xuống').click(); await wait(50); const moved = tit();
    btn(0, 'Xóa mục này').click(); await wait(80); document.querySelector('.ad-modal .btn-red').click(); await wait(120);
    return { before, dup, moved, after: tit() };
  });
  check('Admin: khối lặp thêm / nhân đôi, sửa mục mới, đổi thứ tự, xóa; xem trước đổi ngay', list.before.length === 6 && list.dup.length === 7 && list.dup[1] === 'MỤC MỚI' && list.moved[2] === 'MỤC MỚI' && list.after.length === 6 && list.after[0] === list.before[1], JSON.stringify(list));

  // ---- luu -> trang that hien dung (khoi lap, tieu de, video, anh)
  await setByKey(h1, 'Liên đoàn TKD – bản quản trị');
  await setByKey(vidKey, 'https://youtu.be/dQw4w9WgXcQ');
  await page.evaluate(() => document.querySelector('.ad-top .btn-red').click());
  await page.waitForFunction(() => /phiên bản 1/.test(document.querySelector('.ad-status').textContent), null, { timeout: 15000 });
  const srv = emu.get();
  const pub = await ctx.newPage();
  await pub.goto(BASE + '/', { waitUntil: 'load' });
  await pub.waitForFunction(() => document.querySelector('h1').textContent.includes('bản quản trị'), null, { timeout: 15000 });
  const live2 = await pub.evaluate(() => ({ tit: [...document.querySelectorAll('#muc-dich .feature h3')].map(x => x.textContent), vid: document.querySelector('#video-noi-bat iframe').getAttribute('src'), vidHidden: document.getElementById('video-noi-bat').hidden, logo: document.querySelector('.site-header img.logo-img').getAttribute('src'), dup: (ids => ids.filter((x, i) => ids.indexOf(x) !== i))([...document.querySelectorAll('[id]')].map(e => e.id)) }));
  check('Admin → trang thật: lưu rồi người xem thấy ngay (chữ, khối lặp thêm/xóa/đổi thứ tự, video YouTube, ảnh tải lên), id không trùng', srv.rev === 1 && live2.tit.length === 6 && live2.tit[0] === list.after[0] && live2.tit.includes('MỤC MỚI') && live2.vid === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' && !live2.vidHidden && live2.logo === up.v && live2.dup.length === 0, JSON.stringify(live2).slice(0, 220));
  // trang khac dung chung dau/chan trang
  const emuLogo = srv.fields[logoRow];
  await pub.goto(BASE + '/lien-he', { waitUntil: 'load' });
  await pub.waitForFunction(src => document.querySelector('.site-header img.logo-img').getAttribute('src') === src, up.v, { timeout: 15000 });
  check('Admin: đầu trang/chân trang (logo, menu) sửa một lần áp dụng cho mọi trang', !!emuLogo, '');

  // ---- noi dung goc doi: chinh sua cu bi bo qua thay vi de nham
  const tk = emu.login('quan-tri', 'Mat-khau-kiem-thu-1').token;
  const drift = emu.post({ action: 'save', token: tk, rev: srv.rev, fields: { [H1_KEY]: { v: 'KHONG DUOC HIEN', o: 'zzzzzz' } }, lists: { 'index#muc-dich>div.0>div.0': { c: 99, items: [{ id: 'o0' }] } } });
  await pub.goto(BASE + '/', { waitUntil: 'load' }); await pub.waitForTimeout(800);
  const safe = await pub.evaluate(() => ({ h1: document.querySelector('h1').textContent, n: document.querySelectorAll('#muc-dich .feature').length }));
  check('Chỉnh sửa lỗi thời (nội dung gốc đã đổi / số mục gốc đổi) bị bỏ qua, không đè nhầm', drift.ok && safe.h1 === h1Def && safe.n === 6, JSON.stringify(safe));

  // ---- trang khac, giao dien dien thoai, dang xuat
  await page.evaluate(() => { const s = document.getElementById('pg'); s.value = '/lich-thi-dau'; s.dispatchEvent(new Event('change')); });
  await page.waitForFunction(() => { const f = document.querySelector('.ad-frame'); return f.src.includes('lich-thi-dau') && f.contentWindow.VTFCMS && f.contentWindow.VTFCMS.model && f.contentWindow.VTFCMS.model.page === 'lich-thi-dau'; }, null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.grp').length >= 3, null, { timeout: 15000 }).catch(() => {}); // form dung lai sau khi xem truoc nap xong; thieu thi check ben duoi bao loi kem so lieu
  const other = await page.evaluate(() => ({ lists: document.querySelector('.ad-frame').contentWindow.VTFCMS.model.lists.length, groups: document.querySelectorAll('.grp').length }));
  const mob = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await mob.route(u => u.origin === ORIGIN, async route => { if (route.request().resourceType() !== 'document') return route.continue(); const res = await route.fetch(); const ct = res.headers()['content-type'] || ''; if (!/text\/html/.test(ct)) return route.fulfill({ response: res }); return route.fulfill({ response: res, body: (await res.text()).replace(/data-endpoint="[^"]*"/g, `data-endpoint="${EP}"`) }); });
  await mob.route(u => u.href.startsWith(EP), async route => { const r = route.request(); const x = await emu.http(r.method(), r.url(), r.postData()); await route.fulfill({ status: x.status, headers: x.headers, body: x.body }); });
  const mp = await mob.newPage();
  await mp.goto(BASE + '/admin.html', { waitUntil: 'load' });
  await mp.fill('#lg-u', 'quan-tri'); await mp.fill('#lg-p', 'Mat-khau-kiem-thu-1'); await mp.click('.ad-login button[type=submit]');
  await mp.waitForSelector('.grp', { timeout: 15000 });
  const m1 = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, tabs: getComputedStyle(document.querySelector('.ad-tabs')).display, form: getComputedStyle(document.querySelector('.ad-form')).display, prev: getComputedStyle(document.querySelector('.ad-prev')).display }));
  await mp.click('.ad-tabs button[data-v=prev]');
  const m2 = await mp.evaluate(() => ({ form: getComputedStyle(document.querySelector('.ad-form')).display, prev: getComputedStyle(document.querySelector('.ad-prev')).display, fw: document.querySelector('.ad-frame').getBoundingClientRect().width }));
  check('Admin: nhiều trang (mỗi trang một danh sách ô riêng); điện thoại 390px không tràn ngang, hai thẻ Chỉnh sửa / Xem trước', other.lists >= 1 && other.groups >= 3 && m1.sw <= m1.iw && m1.tabs === 'flex' && m1.form !== 'none' && m1.prev === 'none' && m2.form === 'none' && m2.prev !== 'none' && m2.fw > 300, JSON.stringify({ other, m1, m2 }));
  await mob.close();
  await page.click('.usr summary'); await page.click('.usr-menu button:last-child');
  await page.waitForSelector('#lg-u');
  const stored = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.getItem('vtf-cms-session') }));
  check('Admin: đăng xuất về màn đăng nhập, xóa phiên; không dùng localStorage cho nội dung', stored.ss === null && stored.ls === 0, JSON.stringify(stored));
  check('Admin: không lỗi JS khi chạy', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  await ctx.close();

  await checkForms({ b, check, BASE });
  await checkRedirects({ b, check });
}

// ---- bieu mau dang ky tren website: dung ban build co endpoint (dist-forms), phuc vu bang serve.mjs, noi may chu mo phong qua route Playwright
async function checkForms({ b, check, BASE }) {
  const HERE = path.dirname(fileURLToPath(import.meta.url)), EP = 'https://script.google.com/macros/s/AKfycbxKIEMTHU/exec';
  try { execFileSync(process.execPath, ['build.mjs'], { cwd: HERE, env: { ...process.env, SITE_OUT: 'dist-forms', CMS_ENDPOINT: EP, SITE_BASE: '' }, stdio: 'pipe' }); }
  catch (e) { check('Biểu mẫu: dựng được bản website có máy chủ (CMS_ENDPOINT)', false, String(e.stderr || e.message).slice(0, 300)); return; }
  const port = await new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: HERE, env: { ...process.env, SERVE_DIR: 'dist-forms', PORT: String(port), SERVE_BASE: '' }, stdio: 'ignore' });
  const U = `http://localhost:${port}`;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(U + '/')).ok) break; } catch (e) { /* cho may chu khoi dong */ } await new Promise(r => setTimeout(r, 100)); }
    const emu = createBackend(); emu.setup();
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await ctx.route(u => u.href.startsWith(EP), async route => { const r = route.request(); const x = await emu.http(r.method(), r.url(), r.postData()); await route.fulfill({ status: x.status, headers: x.headers, body: x.body }); });
    const page = await ctx.newPage(), errs = [], posts = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('request', r => { if (r.method() === 'POST' && r.url().startsWith(EP)) posts.push(JSON.parse(r.postData())); });
    const st = () => page.evaluate(() => document.querySelector('.vf-status').textContent);

    // ---- hoi vien
    await page.goto(U + '/hoi-vien#dang-ky', { waitUntil: 'load' });
    const vis = await page.evaluate(() => { const f = document.querySelector('form[data-vtf-form=hoivien]'); return { shown: !f.hidden && f.offsetParent !== null, cms: f.hasAttribute('data-cms-skip'), tab: !!document.querySelector('.tabs a[href="#dang-ky"]'), ids: new Set([...document.querySelectorAll('[id]')].map(e => e.id)).size === document.querySelectorAll('[id]').length, noScriptNote: !!document.querySelector('noscript') }; });
    await page.waitForTimeout(1700); // may chu bo qua luot gui nhanh hon 1,5 giay (chong may tu dong)
    await page.click('form[data-vtf-form=hoivien] button[type=submit]');
    const emptyErr = await page.evaluate(() => ({ n: document.querySelectorAll('.vf-err:not([hidden])').length, msg: document.querySelector('.vf-status').textContent, focus: document.activeElement && document.activeElement.name, inv: document.querySelectorAll('[aria-invalid=true]').length }));
    check('Biểu mẫu hội viên (bản có máy chủ): hiện trên trang, có thẻ "Đăng ký", ô gửi bỏ qua trình chỉnh sửa; bấm gửi khi để trống thì báo lỗi từng ô, đưa con trỏ vào ô đầu, không gửi gì',
      vis.shown && vis.cms && vis.tab && vis.ids && emptyErr.n >= 5 && /kiểm tra lại/.test(emptyErr.msg) && emptyErr.focus === 'loai' && emptyErr.inv >= 4 && posts.length === 0, JSON.stringify({ vis, emptyErr }));

    await page.check('input[name=loai][value=to-chuc]');
    const star = await page.evaluate(() => !document.querySelector('[data-f=daiDien] .req').hidden);
    await page.check('input[name=loai][value=ca-nhan]');
    const star2 = await page.evaluate(() => !document.querySelector('[data-f=daiDien] .req').hidden);
    await page.check('input[name=loai][value=to-chuc]');
    await page.fill('#vf-hv-ten', 'CLB Taekwondo Thử Nghiệm'); await page.fill('#vf-hv-dienThoai', '0912 000 111'); await page.fill('#vf-hv-email', 'khong-hop-le'); await page.fill('#vf-hv-tinh', 'Thành phố Cần Thơ');
    await page.click('form[data-vtf-form=hoivien] button[type=submit]');
    const e2 = await page.evaluate(() => [...document.querySelectorAll('.vf-err:not([hidden])')].map(e => e.id.replace('vf-hv-', '').replace('-e', '') + ':' + e.textContent));
    check('Biểu mẫu hội viên: tổ chức bắt buộc nhập người đại diện (dấu * bật/tắt theo loại), email sai báo "chưa hợp lệ", chưa tích đồng ý thì không gửi',
      star && !star2 && e2.some(x => x.startsWith('daiDien:')) && e2.some(x => /^email:Email chưa hợp lệ/.test(x)) && e2.some(x => x.startsWith('dongY:')) && posts.length === 0, e2.join(' | '));

    await page.fill('#vf-hv-daiDien', 'Nguyễn Văn Thử'); await page.fill('#vf-hv-email', 'Thu.Nghiem@Example.vn'); await page.fill('#vf-hv-ghiChu', 'Ghi chú thử'); await page.check('input[name=dongY]');
    await page.click('form[data-vtf-form=hoivien] button[type=submit]');
    await page.waitForFunction(() => /Mã hồ sơ/.test(document.querySelector('.vf-status').textContent), null, { timeout: 8000 });
    const row = (emu.forms('hoivien') || [])[0] || {}, sent = posts[0] || {}, after = await page.evaluate(() => ({ ten: document.querySelector('#vf-hv-ten').value, ok: document.querySelector('.vf-status').classList.contains('is-ok'), dis: document.querySelector('form[data-vtf-form=hoivien] button').disabled }));
    check('Gửi biểu mẫu hội viên thành công: máy chủ ghi 1 dòng đúng dữ liệu, trang báo mã hồ sơ + lưu ý "Ban Chấp hành xem xét", form được xóa trắng, gửi kèm thời gian điền và trang gửi, ô bẫy rỗng',
      posts.length === 1 && sent.kind === 'hoivien' && sent.f.loai === 'to-chuc' && sent.hp === '' && sent.page === '/hoi-vien' && sent.t >= 1500 && sent.f.dongY === true
      && row['Họ tên / Tên tổ chức'] === 'CLB Taekwondo Thử Nghiệm' && row['Email'] === 'thu.nghiem@example.vn' && row['Người đại diện (nếu là tổ chức)'] === 'Nguyễn Văn Thử' && /^HV-\d{8}-0001$/.test(row['Mã hồ sơ'])
      && /Ban Chấp hành/.test(await st()) && after.ten === '' && after.ok && !after.dis, JSON.stringify({ sent, row }));

    // ---- lien he
    await page.goto(U + '/lien-he', { waitUntil: 'load' }); await page.waitForTimeout(1700);
    await page.fill('#vf-lh-ten', 'Trần Thử'); await page.fill('#vf-lh-email', 'lienhe.thu@example.vn'); await page.selectOption('#vf-lh-chuDe', 'giai-dau'); await page.fill('#vf-lh-noiDung', 'ngắn'); await page.check('input[name=dongY]');
    await page.click('form[data-vtf-form=lienhe] button[type=submit]');
    const shortErr = await page.evaluate(() => (document.querySelector('#vf-lh-noiDung-e') || {}).textContent);
    await page.fill('#vf-lh-noiDung', 'Tôi muốn hỏi về lịch thi đẳng tháng 12.');
    await page.click('form[data-vtf-form=lienhe] button[type=submit]');
    await page.waitForFunction(() => /mã LH-/.test(document.querySelector('.vf-status').textContent), null, { timeout: 8000 });
    const lh = (emu.forms('lienhe') || [])[0] || {};
    check('Biểu mẫu liên hệ: nội dung quá ngắn bị chặn ngay trên trình duyệt; hợp lệ thì ghi vào tệp liên hệ (chủ đề theo nhãn, trang /lien-he), báo mã LH-…',
      /ít nhất 10/.test(shortErr) && lh['Họ và tên'] === 'Trần Thử' && lh['Chủ đề'] === 'Giải đấu, thi đẳng' && lh['Nội dung'] === 'Tôi muốn hỏi về lịch thi đẳng tháng 12.' && lh['Trang gửi'] === '/lien-he' && /^LH-\d{8}-0001$/.test(lh['Mã liên hệ']) && emu.forms('hoivien').length === 1, JSON.stringify(lh));

    // ---- nhan tin (tin tuc) + gui lai cung email
    await page.goto(U + '/tin-tuc', { waitUntil: 'load' }); await page.waitForTimeout(1700);
    const sendNews = async () => { await page.fill('#vf-nt-email', 'doc.gia@example.vn'); await page.check('input[name=dongY]'); await page.click('form[data-vtf-form=nhantin] button[type=submit]'); await page.waitForFunction(() => !document.querySelector('form[data-vtf-form=nhantin] button[type=submit]').disabled, null, { timeout: 8000 }); };
    await sendNews(); const okFirst = await page.evaluate(() => document.querySelector('.vf-status').classList.contains('is-ok')); await sendNews();
    const okSecond = await page.evaluate(() => document.querySelector('.vf-status').classList.contains('is-ok')), nPosts = posts.filter(p => p.kind === 'nhantin').length;
    check('Đăng ký nhận tin ở trang Tin tức: ghi 1 dòng; đăng ký lại cùng email vẫn báo thành công nhưng không ghi trùng', okFirst && okSecond && nPosts === 2 && emu.forms('nhantin').length === 1 && emu.forms('nhantin')[0]['Email'] === 'doc.gia@example.vn' && emu.forms('nhantin')[0]['Trạng thái'] === 'Đang nhận tin' && emu.forms('nhantin')[0]['Trang gửi'] === '/tin-tuc');

    // ---- loi may chu: hien thong bao + cach lien he truc tiep, khong bao thanh cong
    emu.formFile('lienhe').access = 'ANYONE';
    await page.goto(U + '/lien-he', { waitUntil: 'load' }); await page.waitForTimeout(1700);
    await page.fill('#vf-lh-ten', 'Lỗi Thử'); await page.fill('#vf-lh-email', 'loi.thu@example.vn'); await page.selectOption('#vf-lh-chuDe', 'khac'); await page.fill('#vf-lh-noiDung', 'Thử khi máy chủ báo lỗi.'); await page.check('input[name=dongY]');
    await page.click('form[data-vtf-form=lienhe] button[type=submit]');
    await page.waitForFunction(() => document.querySelector('.vf-status').classList.contains('is-err'), null, { timeout: 8000 });
    const errTxt = await st(), still = await page.evaluate(() => document.querySelector('#vf-lh-ten').value);
    emu.formFile('lienhe').access = 'PRIVATE';
    check('Máy chủ lỗi: người dùng thấy thông báo lỗi kèm email/điện thoại Liên đoàn, nội dung đã nhập được giữ lại để gửi lại, không có dòng nào ghi sai', /Chưa gửi được/.test(errTxt) && /tkdvn1996@gmail\.com/.test(errTxt) && still === 'Lỗi Thử' && emu.forms('lienhe').length === 1, errTxt);

    // ---- chinh sach quyen rieng tu, ban mac dinh khong co bieu mau, giao dien dien thoai
    await page.goto(U + '/quyen-rieng-tu', { waitUntil: 'load' });
    const pv = await page.evaluate(() => ({ sec: !!document.getElementById('bieu-mau'), txt: document.body.innerText }));
    const dflt = await (await fetch(BASE + '/hoi-vien')).text();
    const mob = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await mob.route(u => u.href.startsWith(EP), async route => { const r = route.request(); const x = await emu.http(r.method(), r.url(), r.postData()); await route.fulfill({ status: x.status, headers: x.headers, body: x.body }); });
    const mp = await mob.newPage(); await mp.goto(U + '/hoi-vien#dang-ky', { waitUntil: 'load' });
    const mw = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, col: getComputedStyle(document.querySelector('.vf-grid')).gridTemplateColumns.split(' ').length, btn: document.querySelector('form[data-vtf-form] button').getBoundingClientRect().height }));
    await mob.close();
    check('Chính sách quyền riêng tư (bản có biểu mẫu) mô tả dữ liệu thu thập, nơi lưu, quyền của người dùng; điện thoại 390px: form một cột, không tràn ngang, nút bấm đủ lớn',
      pv.sec && /Đăng ký gia nhập hội viên/.test(pv.txt) && /Google Sheets riêng tư/.test(pv.txt) && /rút lại đồng ý/.test(pv.txt) && !/không có biểu mẫu/.test(pv.txt) && mw.sw <= mw.iw && mw.col === 1 && mw.btn >= 44, JSON.stringify(mw));
    if (dflt.indexOf('data-endpoint="http') >= 0) {
      const others = await Promise.all(['/lien-he', '/tin-tuc'].map(p => fetch(BASE + p).then(r => r.text())));
      check('Website đã nối máy chủ: cả ba biểu mẫu (Hội viên, Liên hệ, Tin tức) có trên trang', dflt.indexOf('data-vtf-form="hoivien"') >= 0 && others[0].indexOf('data-vtf-form="lienhe"') >= 0 && others[1].indexOf('data-vtf-form="nhantin"') >= 0);
    } else check('Bản website chưa nối máy chủ (mặc định) không chứa biểu mẫu nào', dflt.length > 1000 && !/data-vtf-form|<form/.test(dflt));
    check('Biểu mẫu: không lỗi JS khi chạy', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  } finally { srv.kill(); try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) { /* khong quan trong */ } }
}

// ---- chuyen huong ve dia chi duy nhat (tkdai.vn): cau hinh Vercel + ban chuyen huong cua GitHub Pages
async function checkRedirects({ b, check }) {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const vj = JSON.parse(fs.readFileSync(path.join(HERE, 'vercel.json'), 'utf8'));
  const r = (vj.redirects || []).find(x => (x.has || []).some(h => h.type === 'host' && h.value === 'lien-doan-taekwondo-viet-nam.vercel.app'));
  check('Vercel: dia chi lien-doan-taekwondo-viet-nam.vercel.app chuyen huong VINH VIEN (308) ve https://tkdai.vn giu nguyen duong dan; chi theo ten mien, khong anh huong ban xem thu',
    !!r && r.permanent === true && r.source === '/:path(.*)' && r.destination === 'https://tkdai.vn/:path' && r.has.length === 1, JSON.stringify(r));

  const TARGET = 'https://chuyen-huong.test', BASE_P = '/ten-repo', dirName = 'dist-redirect-' + process.pid, out = path.join(HERE, dirName); // thu muc rieng moi lan chay (o dia pCloud xoa/ghi de tre)
  try { execFileSync(process.execPath, ['tools/redirect-pages.mjs', dirName, BASE_P, TARGET], { cwd: HERE, stdio: 'pipe' }); }
  catch (e) { check('GitHub Pages: tao duoc ban chuyen huong', false, String(e.stderr || e.message).slice(0, 200)); return; }
  const port = await new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: HERE, env: { ...process.env, SERVE_DIR: dirName, PORT: String(port), SERVE_BASE: BASE_P }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://localhost:${port}${BASE_P}/`)).ok) break; } catch (e) { /* cho may chu khoi dong */ } await new Promise(r2 => setTimeout(r2, 100)); }
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    await ctx.route(u => u.origin === TARGET, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>dich</title>' }));
    const page = await ctx.newPage(), go = async p => { await page.goto(`http://localhost:${port}${BASE_P}${p}`, { waitUntil: 'load' }); await page.waitForURL(u => u.origin === TARGET, { timeout: 8000 }); return page.url(); };
    const [a1, a2, a3] = [await go('/'), await go('/hoi-vien?x=1#dang-ky'), await go('/tin-tuc/bai-viet-sau/xyz')];
    const html = fs.readFileSync(path.join(out, '404.html'), 'utf8');
    check('GitHub Pages: moi duong dan (goc, trang con, ?query, #muc, lien ket sau) chuyen huong ve ten mien chinh, giu nguyen duong dan; co meta refresh + canonical cho may tim kiem',
      a1 === TARGET + '/' && a2 === TARGET + '/hoi-vien?x=1#dang-ky' && a3 === TARGET + '/tin-tuc/bai-viet-sau/xyz' && html.includes(`http-equiv="refresh" content="0; url=${TARGET}/"`) && html.includes(`rel="canonical" href="${TARGET}/"`), [a1, a2, a3].join(' | '));
    await ctx.close();
  } finally { srv.kill(); try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) { /* khong quan trong */ } }
}
