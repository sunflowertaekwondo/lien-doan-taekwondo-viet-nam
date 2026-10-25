// check.mjs (v2) - kiem tra website VTF truoc/sau khi deploy.
// Dung: node check.mjs [BASE_URL]   (mac dinh http://localhost:8700 ; vd https://sunflowertaekwondo.github.io/lien-doan-taekwondo-viet-nam)
// Can Chrome: dat CHROME_PATH neu khac duong dan mac dinh. EXPECT_SITE_URL: dia chi that (canonical/og phai bat dau bang no).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://localhost:8700').replace(/\/$/, '');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
const PAGES = ['/', '/gioi-thieu', '/quyen-han-nhiem-vu', '/co-cau-to-chuc', '/lich-thi-dau', '/dai-hoi-the-thao-toan-quoc-2026', '/hoi-vien', '/dieu-le', '/van-ban', '/tin-tuc', '/lien-he', '/quyen-rieng-tu'];
const ORIGIN = new URL(BASE).origin, basePath = new URL(BASE).pathname.replace(/\/$/, '');
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const EXPECT = (process.env.EXPECT_SITE_URL || '').replace(/\/$/, '');

const b = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [], bad = [], external = new Set(), structure = [], ldErrors = [];
const links = new Map();
// 320px = dien thoai nho / phong to 400% (WCAG 1.4.10)
for (const [vp, size] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 1180 }], ['ipad', { width: 768, height: 1024 }], ['mobile', { width: 390, height: 844 }], ['mobile-nho', { width: 320, height: 640 }]]) {
  const ctx = await b.newContext({ viewport: size, ...(/mobile/.test(vp) ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.route(/kaspersky-labs|kis\.v2\.scr/, r => r.abort()); // phan mem diet virus tren may chen script vao trang HTTPS
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${vp} ${page.url()} :: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  // yeu cau do phan mem diet virus tren may tu chen (khong phai do website goi) -> bo qua
  page.on('request', r => { const u = new URL(r.url()); if (/^https?:/.test(u.protocol) && u.origin !== ORIGIN && !/kaspersky-labs|kis\.v2\.scr/.test(u.host)) external.add(u.host); });
  const overflow = [];
  for (const p of PAGES) {
    const resp = await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
    if (!resp || resp.status() !== 200) bad.push(`${resp && resp.status()} ${p}`);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].filter(h => h.offsetParent !== null || h.closest('details')).map(h => +h.tagName[1]);
      let jump = null; for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) { jump = `h${hs[i - 1]}→h${hs[i]}`; break; }
      return {
        // clientWidth (khong dung innerWidth: tren gia lap dien thoai, innerWidth gian theo noi dung nen khong bat duoc tran ngang)
        sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth,
        font: getComputedStyle(document.querySelector('h1')).fontFamily,
        fontOk: document.fonts.check('700 20px "Be Vietnam Pro"', 'Đội tuyển Việt Nam Ữ Ặ ỹ'),
        lang: document.documentElement.lang, h1: document.querySelectorAll('h1').length, jump,
        imgNoAlt: [...document.querySelectorAll('img:not([alt])')].length,
        dupIds: (ids => ids.filter((x, i) => ids.indexOf(x) !== i))([...document.querySelectorAll('[id]')].map(e => e.id)),
        btnNoName: [...document.querySelectorAll('button')].filter(x => !(x.getAttribute('aria-label') || x.textContent.trim())).length,
        links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
        canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
        ogImage: (document.querySelector('meta[property="og:image"]') || {}).content || null,
        lds: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
      };
    });
    if (r.sw > r.iw) overflow.push(`${p} (${r.sw}>${r.iw})`);
    if (vp === 'desktop') {
      if (!r.fontOk || !/Be Vietnam Pro/.test(r.font) || r.lang !== 'vi') bad.push(`font/lang ${p}: ${r.font} ok=${r.fontOk} lang=${r.lang}`);
      if (r.h1 !== 1 || r.jump || r.imgNoAlt || r.btnNoName || r.dupIds.length) structure.push(`${p}: h1=${r.h1}${r.jump ? ' nhảy ' + r.jump : ''}${r.imgNoAlt ? ' ảnh thiếu alt=' + r.imgNoAlt : ''}${r.btnNoName ? ' nút không tên=' + r.btnNoName : ''}${r.dupIds.length ? ' trùng id=' + r.dupIds.join(',') : ''}`);
      if (!r.canonical || !/^https:\/\//.test(r.ogImage || '')) structure.push(`${p}: thiếu canonical/og:image tuyệt đối`);
      else if (EXPECT && !(r.canonical.startsWith(EXPECT + '/') && r.ogImage.startsWith(EXPECT + '/'))) structure.push(`${p}: canonical/og:image không thuộc ${EXPECT}`);
      for (const t of r.lds) { try { const j = JSON.parse(t); if (!j['@type']) ldErrors.push(`${p}: thiếu @type`); } catch (e) { ldErrors.push(`${p}: JSON-LD lỗi ${e.message}`); } }
      for (const h of r.links) if (!links.has(h)) links.set(h, p);
    }
  }
  check(`Không tràn ngang (${vp} ${size.width}px)`, overflow.length === 0, overflow.join(', '));
  await ctx.close();
}
check('Mọi trang trả 200, font Be Vietnam Pro đủ dấu tiếng Việt, lang=vi', bad.length === 0, bad.slice(0, 5).join(' | '));
check('Không gọi dịch vụ bên ngoài (font tự host, không theo dõi)', external.size === 0, [...external].join(', '));
check('Mỗi trang đúng 1 h1, tiêu đề không nhảy cấp, ảnh có alt, nút có tên, không trùng id, có canonical + og:image', structure.length === 0, structure.slice(0, 4).join(' | '));
check('Dữ liệu có cấu trúc (JSON-LD) hợp lệ trên mọi trang', ldErrors.length === 0, ldErrors.slice(0, 3).join(' | '));

// lien ket noi bo + anchor + PDF
// kiem tra dung href nhu trinh duyet se goi: site o duong dan con thi moi lien ket phai mang duong dan con
const internal = [...links.keys()].filter(h => h.startsWith('/') && !h.startsWith('//'));
const broken = [];
for (const h of internal) {
  const [p, hash] = h.split('#');
  if (basePath && !(p === basePath || p.startsWith(basePath + '/'))) { broken.push(`thiếu ${basePath}: ${h}`); continue; }
  const res = await fetch(ORIGIN + (p || '/'));
  if (res.status !== 200) { broken.push(`${res.status} ${h}`); continue; }
  const ct = res.headers.get('content-type') || '';
  if (/\.pdf$/.test(p) && !/application\/pdf/.test(ct)) broken.push(`sai MIME ${h}`);
  if (hash && /html/.test(ct) && !(await res.text()).includes(`id="${hash}"`)) broken.push(`thiếu #${hash} trên ${p}`);
}
check(`${internal.length} liên kết nội bộ (kể cả #anchor, PDF, RSS) đều hợp lệ`, broken.length === 0, broken.slice(0, 5).join(' | '));

// tep may doc: sitemap, robots, RSS, manifest, service worker, anh chia se
{
  const txt = async p => { const r = await fetch(BASE + p); return { s: r.status, t: await r.text(), ct: r.headers.get('content-type') || '' }; };
  const sm = await txt('/sitemap.xml'), rb = await txt('/robots.txt'), rss = await txt('/rss.xml'), mf = await txt('/manifest.webmanifest'), sw = await txt('/sw.js');
  const locs = [...sm.t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  check('sitemap.xml liệt kê đủ trang, robots.txt trỏ sitemap', sm.s === 200 && PAGES.every(p => locs.some(l => l.endsWith(p === '/' ? '/' : p))) && /Sitemap: https?:\/\/.+sitemap\.xml/.test(rb.t), `${locs.length} URL`);
  check('RSS hợp lệ', rss.s === 200 && /<rss version="2.0"/.test(rss.t) && /<channel>[\s\S]*<\/channel>/.test(rss.t));
  let mfOk = false, icons = 0;
  try { const j = JSON.parse(mf.t); icons = j.icons.length; mfOk = j.name && j.icons.length >= 3; for (const ic of j.icons) { const r = await fetch(ORIGIN + ic.src); if (r.status !== 200) mfOk = false; } } catch {}
  const swOk = sw.s === 200 && /const VERSION = PREFIX \+ '[0-9a-f]{10}';/.test(sw.t) && !/__(VERSION|BASE|PRECACHE)__/.test(sw.t);
  check('Manifest ứng dụng (PWA) hợp lệ, icon tải được; service worker đã điền phiên bản', mfOk && swOk, `${icons} icon`);
  const og = await fetch(BASE + '/img/og-dieu-le.jpg');
  check('Ảnh chia sẻ mạng xã hội tải được', og.status === 200 && /image\/jpe?g/.test(og.headers.get('content-type') || ''));
}

// tuong tac: che do toi, tim kiem Dieu le, hoi dap, menu mobile
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/kaspersky-labs|kis\.v2\.scr/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.click('.theme-toggle');
  const dark = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
  await page.reload({ waitUntil: 'load' });
  const kept = await page.evaluate(() => document.documentElement.dataset.theme);
  check('Chuyển giao diện tối hoạt động và được ghi nhớ', dark.t === 'dark' && kept === 'dark', `${dark.bg}`);
  await page.goto(BASE + '/dieu-le?q=hoi%20phi', { waitUntil: 'load' }); await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ st: document.getElementById('dl-status').textContent, marks: [...new Set([...document.querySelectorAll('.charter-body mark')].map(m => m.textContent.toLowerCase()))], copy: document.querySelectorAll('.copy-link').length }));
  check('Tìm "hoi phi" (không dấu) trong Điều lệ khớp đúng cụm "hội phí"', /Tìm thấy \d+ điều/.test(s.st) && s.marks.length === 1 && s.marks[0] === 'hội phí', `${s.st} ${JSON.stringify(s.marks)}`);
  check('Có nút sao chép liên kết cho đủ 29 điều', s.copy === 29, String(s.copy));
  const faq = await (await fetch(BASE + '/hoi-vien')).text();
  const faqLd = [...faq.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])).find(j => j['@type'] === 'FAQPage');
  check('Trang Hội viên có Hỏi đáp + FAQPage JSON-LD (8 câu)', faqLd && faqLd.mainEntity.length === 8);
  await ctx.close();
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(BASE + '/', { waitUntil: 'load' });
  await mp.click('.nav-toggle'); await mp.waitForTimeout(400);
  const nav = await mp.evaluate(() => { const n = document.getElementById('site-nav').getBoundingClientRect(), all = document.querySelectorAll('#site-nav .nav-link'); return { h: Math.round(n.height), total: all.length, links: [...all].filter(a => { const x = a.getBoundingClientRect(); return x.height > 0 && x.bottom <= innerHeight; }).length }; });
  check(`Menu mobile mở toàn màn hình, hiện đủ ${nav.total} mục`, nav.h > 600 && nav.total >= 6 && nav.links === nav.total, JSON.stringify(nav));
  const trapped = [];
  // focus o trong header, hoac roi ra thanh trinh duyet (body) - khong duoc vao main/footer dang bi menu che
  for (let i = 0; i < 14; i++) { await mp.keyboard.press('Tab'); trapped.push(await mp.evaluate(() => !document.activeElement.closest('main, .site-footer, .to-top'))); }
  check('Menu mobile đang mở: phím Tab không lọt xuống nội dung bị che', trapped.every(Boolean), trapped.join(','));
  await m.close();
}

// lich thi dau tren web khop du lieu (data/lich-thi-dau.json, da doi chieu tung chu voi cong van) + bo loc
{
  const LTD = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'lich-thi-dau.json'), 'utf8'));
  const want = LTD.lich.flatMap(l => l.giai.map(g => [g.ten, g.thoiGian, g.diaDiem, g.ghiChu].join(' | ')));
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/kaspersky-labs|kis\.v2\.scr/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + '/lich-thi-dau', { waitUntil: 'load' });
  // giai theo cong van: id dang giai-NAM-TT (vd giai-2027-01); giai dia phuong: giai-NAM-<id>
  const got = await page.$$eval('.event', els => els.filter(e => /^giai-\d{4}-\d{2}$/.test(e.id)).map(e => [e.querySelector('h4').textContent, ...[...e.querySelectorAll('dd')].map(d => d.textContent)].concat(e.querySelectorAll('dd').length < 3 ? [''] : []).join(' | ')));
  const missing = want.filter(w => !got.includes(w));
  const local = await page.evaluate(ids => ids.map(([id, schema]) => { const e = document.getElementById(id); return !!e && !!e.querySelector(`a[href="${schema}"][target="_blank"]`); }), (LTD.giaiKhac || []).map(g => [`giai-${g.batDau.slice(0, 4)}-${g.id}`, g.schema]));
  await page.click('.seg button[data-cap="Quốc tế"]');
  const filt = await page.evaluate(() => ({ shown: [...document.querySelectorAll('.event')].filter(e => /^giai-\d{4}-\d{2}$/.test(e.id) && !e.hidden).map(e => e.dataset.cap), status: document.querySelector('.cal-status').textContent }));
  const nQt = LTD.lich.flatMap(l => l.giai).filter(g => g.cap === 'Quốc tế').length;
  check(`Lịch thi đấu trên web khớp dữ liệu (${want.length} giải + ${local.length} giải địa phương có link schema), lọc Quốc tế đúng`, missing.length === 0 && got.length === want.length && local.every(Boolean) && filt.shown.length === nQt && filt.shown.every(c => c === 'Quốc tế'), missing.length ? 'thiếu: ' + missing.slice(0, 2).join(' / ') : filt.status);
  await ctx.close();
}

// trang Dai hoi The thao toan quoc X: du lieu khop data/dai-hoi-x-2026.json, SportsEvent, moc thoi gian
{
  const DH = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'dai-hoi-x-2026.json'), 'utf8'));
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/kaspersky-labs|kis\.v2\.scr/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + '/dai-hoi-the-thao-toan-quoc-2026', { waitUntil: 'load' });
  const r = await page.evaluate(() => ({
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)).find(j => j['@type'] === 'SportsEvent'),
    weights: document.querySelectorAll('#noi-dung-thi-dau .chips.wc li').length,
    teams: document.querySelectorAll('#noi-dung-thi-dau .docs-table tbody tr').length,
    days: [...document.querySelectorAll('.prog-day')].map(d => d.querySelectorAll('.prog-items li').length),
    ext: [...document.querySelectorAll('a[href^="https://docs.google.com/"]')].every(a => a.target === '_blank' && /noopener/.test(a.rel)),
    marked: document.querySelectorAll('.ms-list li.is-past, .ms-list li.is-next').length,
    btc: document.querySelectorAll('#ban-to-chuc-trong-tai table.roster:not(#tt-list) tbody tr').length,
    btt: [...document.querySelectorAll('#tt-list tbody tr')].map(tr => tr.cells[1].textContent.trim()),
    text: document.querySelector('main').innerText,
  }));
  const want = [DH.checkIn.gio, DH.schema.hanChotChu, DH.sanTap.lienHe.dienThoai, ...DH.lienHeBtc.map(c => c.dienThoai), ...DH.quyen, ...DH.theThuc.slice(1)];
  const missing = want.filter(w => !r.text.includes(w));
  const ok = r.ld && r.ld.startDate === DH.batDau && r.ld.endDate === DH.ketThuc && r.weights === 16 && r.teams === DH.doiKhangDongDoi.length
    && r.days.join(',') === DH.chuongTrinh.map(d => d.muc.length).join(',') && r.ext && r.marked > 0 && missing.length === 0
    && r.btc === DH.banToChuc.thanhVien.length && r.btt.join('|') === DH.banTrongTai.thanhVien.map(t => t.ten).join('|');
  check('Trang Đại hội Thể thao toàn quốc X: khớp dữ liệu Điều lệ, Sổ tay, QĐ Ban Tổ chức + Ban Trọng tài; SportsEvent, mốc thời gian', ok, missing.length ? 'thiếu: ' + missing.slice(0, 3).join(' / ') : `${r.weights} hạng cân, ${r.teams} đồng đội, ${r.days.length} ngày, BTC ${r.btc}, trọng tài ${r.btt.length}`);
  await ctx.close();
}

// doc khi mat mang (service worker)
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(/kaspersky-labs|kis\.v2\.scr/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const ready = await page.evaluate(() => 'serviceWorker' in navigator && navigator.serviceWorker.ready.then(() => true));
  await page.goto(BASE + '/dieu-le?q=hoi', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  // setOffline cua Playwright khong chan yeu cau cua service worker, nen kiem tra bo nho dem dung khoa ma sw.js tra khi mat mang
  const st = await page.evaluate(async bp => ({
    ctrl: !!navigator.serviceWorker.controller,
    offline: !!(await caches.match(bp + '/offline')),
    visited: !!(await caches.match(location.origin + bp + '/dieu-le')),
    perQuery: (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).filter(r => r.url.includes('?')).length))).reduce((a, b) => a + b, 0),
  }), basePath);
  check('Đọc khi mất mạng: trang đã xem và trang ngoại tuyến có trong bộ nhớ đệm (không lưu riêng từng ?q=)', ready && st.ctrl && st.offline && st.visited && st.perQuery === 0, JSON.stringify(st));
  await ctx.close();
}

// toan van Dieu le khop tung tu voi ban trich tu PDF
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + '/dieu-le', { waitUntil: 'domcontentloaded' });
  const shown = await page.$eval('.charter-body', e => [...e.querySelectorAll('.chuong h2, .dieu')].map(x => x.innerText).join('\n'));
  const words = s => s.normalize('NFC').replace(/[.,;:()"“”–\-]/g, ' ').split(/\s+/).filter(Boolean);
  let src = fs.readFileSync(path.join(HERE, 'data', 'dieu-le.txt'), 'utf8').normalize('NFC');
  src = src.split(/\r?\n/).filter(l => !/^=+ TRANG \d+ =+$/.test(l.trim()) && !/^\s*\d+\s*$/.test(l)).join('\n');
  src = src.slice(src.indexOf('Chương I'));
  const a = words(shown), w = words(src);
  let diff = -1; for (let i = 0; i < Math.max(a.length, w.length); i++) if (a[i] !== w[i]) { diff = i; break; }
  check('Toàn văn Điều lệ trên web khớp từng từ với văn bản PDF', diff < 0, diff < 0 ? `${a.length} từ` : `lệch tại từ ${diff}: web="${a.slice(diff, diff + 5).join(' ')}" pdf="${w.slice(diff, diff + 5).join(' ')}"`);
  await ctx.close();
}
// ban build khong chua tai nguyen cua World Taekwondo; token DESIGN.md khop CSS
{
  const dist = path.join(HERE, 'dist');
  const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
  const hits = walk(dist).filter(f => /\.(html|css|js)$/.test(f)).flatMap(f => (fs.readFileSync(f, 'utf8').match(/\/common\/|\/upload\/|\/_vi\/|\/wt\b|\/news\/|\/inside\//g) || []).map(x => `${path.basename(f)}:${x}`));
  check('Bản build không chứa tài nguyên/đường dẫn của World Taekwondo', hits.length === 0, hits.slice(0, 5).join(', '));
  const design = fs.readFileSync(path.join(HERE, 'DESIGN.md'), 'utf8'), css = fs.readFileSync(path.join(HERE, 'src', 'site.css'), 'utf8');
  const colors = [...(/color:\s*\n([\s\S]*?)\n  radius/.exec(design) || [, ''])[1].matchAll(/^\s+([\w-]+):\s*"(#[0-9A-Fa-f]{6})"/gm)];
  const mismatch = colors.filter(([, k, v]) => !new RegExp(`--c-${k}:\\s*${v}`, 'i').test(css)).map(([, k, v]) => `${k}=${v}`);
  check('Token màu trong DESIGN.md khớp với CSS', colors.length >= 10 && mismatch.length === 0, mismatch.length ? mismatch.join(', ') : `${colors.length} token`);
}
{ const r = await fetch(BASE + '/khong-co-trang-nay'); check('Trang không tồn tại trả 404 có giao diện VTF', r.status === 404 && /Liên đoàn Taekwondo Việt Nam/.test(await r.text()), String(r.status)); }
check('Không có lỗi JS', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close();
const fail = results.filter(x => !x).length;
console.log(`\n${results.length - fail}/${results.length} PASS  (${BASE})`);
process.exit(fail ? 1 : 0);
