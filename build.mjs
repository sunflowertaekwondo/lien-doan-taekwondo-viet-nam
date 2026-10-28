// vtf-site/build.mjs (v2) - website doc lap cua Lien doan Taekwondo Viet Nam (VTF).
// Giao dien rieng (khong dung tai nguyen cua World Taekwondo). Noi dung: Dieu le (data/dieu-le.json, khop 100% PDF)
// + cau hinh (data/site.json) + Tin tuc (content/tin-tuc/*.md). Thong tin chua co -> "Dang cap nhat" (khong tu bia).
// Chay: node build.mjs            -> dist/  (goc ten mien)
//       SITE_BASE=/ten-repo SITE_OUT=dist-pages node build.mjs   -> ban cho GitHub Pages (duong dan con)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PAGES } from './src/meta.mjs';
import { sprite, icon } from './src/icons.mjs';
import { parseFrontMatter, renderMarkdown, plainText, clip, safeUrl } from './src/markdown.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.SITE_OUT ? path.resolve(process.env.SITE_OUT) : path.join(HERE, 'dist');
const BASE = (process.env.SITE_BASE || '').replace(/\/$/, '');
// Git Bash tu doi /ten-repo thanh duong dan Windows (C:/Program Files/Git/ten-repo): chan som thay vi tao web sai
if (BASE && !/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(BASE)) throw new Error(`SITE_BASE phai co dang /ten-repo, nhan duoc: ${BASE} (Git Bash: them MSYS_NO_PATHCONV=1)`);
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'site.json'), 'utf8'));
const DL = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'dieu-le.json'), 'utf8'));
const LTD = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'lich-thi-dau.json'), 'utf8'));
const DH = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'dai-hoi-x-2026.json'), 'utf8'));
const DH_PATH = '/dai-hoi-the-thao-toan-quoc-2026';
// Trang quan tri (admin.html): noi dung chinh sua luu o Google Sheet qua Apps Script. De trong = khong goi may chu nao.
const CMS_CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'cms.json'), 'utf8'));
const CMS_ENDPOINT = String(process.env.CMS_ENDPOINT ?? CMS_CFG.endpoint ?? '').trim();
if (CMS_ENDPOINT && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(CMS_ENDPOINT) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/exec$/.test(CMS_ENDPOINT)) {
  throw new Error(`CMS endpoint khong hop le: ${CMS_ENDPOINT} (phai la https://script.google.com/macros/s/.../exec)`);
}
// dia chi that: SITE_URL > ten mien production cua Vercel (khi Vercel build) > siteUrl trong site.json
const VERCEL_PROD = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
const SITE_URL = (process.env.SITE_URL || VERCEL_PROD || cfg.siteUrl || '').replace(/\/$/, '');
const BUILD_DATE = process.env.BUILD_DATE || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }); // ngay theo gio Viet Nam
const latest = (...ds) => ds.filter(Boolean).sort().pop() || null;
const viDate = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const isoDate = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };
// ngay trong site.json: nhan yyyy-mm-dd hoac dd/mm/yyyy; sai dang thi dung build va bao ro (khong im lang hien "undefined")
const cfgDate = key => {
  if (!cfg[key]) return null;
  const v = isoDate(String(cfg[key]).trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`data/site.json: "${key}" phải là ngày dạng 2026-10-22 hoặc 22/10/2026, đang là "${cfg[key]}"`);
  return v;
};
const CONTENT_DATE = cfgDate('ngayCapNhatNoiDung'); // ngay sua noi dung gan nhat
const REVIEW_DATE = cfgDate('ngayRaSoatVanBan'); // ngay ra soat hieu luc van ban

const ART = Object.fromEntries(DL.chuong.flatMap(c => c.dieu).map(a => [a.so, a]));
const blocks = n => ART[n].noiDung;
const subOf = (n, k) => { const bs = blocks(n); const i = bs.findIndex(b => b.loai === 'khoan' && b.so === String(k)); const out = []; for (let j = i + 1; j < bs.length && bs[j].loai !== 'khoan'; j++) out.push(bs[j]); return out; };

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nw = s => `<span class="nw">${esc(s)}</span>`;
const PENDING = '<span class="pending">Đang cập nhật</span>';
const tidy = (t, prefix) => {
  let s = String(t).replace(prefix || /^$/, '').replace(/Khoản 2 Điều này/g, 'khoản 2 Điều 9').trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.replace(/[;:]$/, '.').replace(/([^.])$/, '$1.');
};
const dieuLink = (n, label) => `<a class="ref" href="/dieu-le#dieu-${n}">${esc(label || `Điều ${n}`)}</a>`;
const src = txt => `<p class="source">${icon('book')}<span>Nguồn: ${txt}</span></p>`;
const abs = p => SITE_URL + (p === '/' ? '/' : p);

// ---------------- tai nguyen: CSS/JS gan ma bam, font, anh ----------------
// Lam rong thu muc dau ra (giu lai chinh thu muc): o dia dong bo dam may nhu pCloud xoa tre, xoa ca thu muc de bi ENOTEMPTY/EPERM
fs.mkdirSync(DIST, { recursive: true });
for (const e of fs.readdirSync(DIST)) {
  try { fs.rmSync(path.join(DIST, e), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
  catch (err) { console.warn(`Chua xoa duoc ${e} (${err.code}), se ghi de`); }
}
for (const d of ['assets', 'docs', 'fonts', 'img', 'tin-tuc']) fs.mkdirSync(path.join(DIST, d), { recursive: true });
const fontsCss = fs.readFileSync(path.join(HERE, 'src', 'fonts', 'fonts.css'), 'utf8').replace(/url\("\.\.\/fonts\//g, `url("${BASE}/fonts/`);
const css = fontsCss + '\n' + fs.readFileSync(path.join(HERE, 'src', 'site.css'), 'utf8');
const js = fs.readFileSync(path.join(HERE, 'src', 'site.js'), 'utf8');
// ma bam chi theo noi dung CSS + JS: lan chay tu dong hang ngay khong doi ten tep khi ma khong doi
const HASH = crypto.createHash('sha1').update(css + js).digest('hex').slice(0, 10);
const CSS_FILE = `assets/site.${HASH}.css`, JS_FILE = `assets/site.${HASH}.js`;
fs.writeFileSync(path.join(DIST, CSS_FILE), css, 'utf8');
fs.writeFileSync(path.join(DIST, JS_FILE), js, 'utf8');
// Gói CMS: bo loc XSS + loi quet/ap noi dung (moi trang tai), gói admin (chi admin.html). Ma bam theo noi dung nhu CSS/JS.
const cmsJs = fs.readFileSync(path.join(HERE, 'src', 'cms-sanitize.js'), 'utf8') + '\n' + fs.readFileSync(path.join(HERE, 'src', 'cms-core.js'), 'utf8');
const adminJs = fs.readFileSync(path.join(HERE, 'src', 'admin.js'), 'utf8');
const adminCss = fontsCss + '\n' + fs.readFileSync(path.join(HERE, 'src', 'admin.css'), 'utf8');
const CMS_FILE = `assets/cms.${crypto.createHash('sha1').update(cmsJs).digest('hex').slice(0, 10)}.js`;
const ADMIN_HASH = crypto.createHash('sha1').update(adminJs + adminCss).digest('hex').slice(0, 10);
const ADMIN_JS = `assets/admin.${ADMIN_HASH}.js`, ADMIN_CSS = `assets/admin.${ADMIN_HASH}.css`;
fs.writeFileSync(path.join(DIST, CMS_FILE), cmsJs, 'utf8');
fs.writeFileSync(path.join(DIST, ADMIN_JS), adminJs, 'utf8');
fs.writeFileSync(path.join(DIST, ADMIN_CSS), adminCss, 'utf8');
for (const f of fs.readdirSync(path.join(HERE, 'src', 'fonts'))) if (/\.woff2$|OFL\.txt$/.test(f)) fs.copyFileSync(path.join(HERE, 'src', 'fonts', f), path.join(DIST, 'fonts', f));
for (const f of fs.readdirSync(path.join(HERE, 'src', 'generated'))) fs.copyFileSync(path.join(HERE, 'src', 'generated', f), path.join(DIST, 'img', f));
// anh noi dung (vd ky niem chuong trang chu) dat trong src/img/
for (const f of fs.readdirSync(path.join(HERE, 'src', 'img'))) if (/\.(jpe?g|png|webp|svg)$/i.test(f)) fs.copyFileSync(path.join(HERE, 'src', 'img', f), path.join(DIST, 'img', f));
for (const f of fs.readdirSync(path.join(HERE, 'data', 'docs'))) fs.copyFileSync(path.join(HERE, 'data', 'docs', f), path.join(DIST, 'docs', f));
fs.copyFileSync(path.join(HERE, 'src', 'favicon.svg'), path.join(DIST, 'favicon.svg'));
// Logo chinh thuc (tep dat trong src/): logo = ban chu toi cho nen sang, logoNenToi = ban chu trang cho nen toi (chan trang, giao dien toi)
const pngSize = f => { const h = fs.readFileSync(f).subarray(0, 24); return h.toString('latin1', 12, 16) === 'IHDR' ? [h.readUInt32BE(16), h.readUInt32BE(20)] : null; };
function logoAsset(key) {
  if (!cfg[key]) return null;
  const name = path.basename(cfg[key]), f = path.join(HERE, 'src', name);
  if (!fs.existsSync(f)) throw new Error(`Khong tim thay tep logo src/${name} (truong "${key}" trong data/site.json)`);
  fs.copyFileSync(f, path.join(DIST, 'img', name));
  const [w, h] = pngSize(f) || [240, 98];
  return { url: `/img/${name}`, w, h };
}
const LOGO = logoAsset('logo'), LOGO_DARK = logoAsset('logoNenToi') || LOGO;
const LOGO_URL = LOGO && LOGO.url;

// ---------------- dieu huong ----------------
const NAV = [
  { label: 'Giới thiệu', href: '/gioi-thieu', sub: [['Về Liên đoàn', '/gioi-thieu'], ['Quyền hạn và nhiệm vụ', '/quyen-han-nhiem-vu'], ['Cơ cấu tổ chức', '/co-cau-to-chuc'], ['Hội đồng kỹ thuật', '/co-cau-to-chuc#hoi-dong-ky-thuat']] },
  { label: 'Lịch thi đấu', href: '/lich-thi-dau', sub: [['Lịch các giải', '/lich-thi-dau'], ['Đại hội Thể thao toàn quốc X', DH_PATH]] },
  { label: 'Hội viên', href: '/hoi-vien', sub: [['Tiêu chuẩn hội viên', '/hoi-vien#tieu-chuan'], ['Quyền và nghĩa vụ', '/hoi-vien#quyen-nghia-vu'], ['Thủ tục gia nhập', '/hoi-vien#thu-tuc'], ['Hỏi đáp', '/hoi-vien#hoi-dap']] },
  { label: 'Điều lệ & Văn bản', href: '/dieu-le', sub: [['Điều lệ Liên đoàn', '/dieu-le'], ['Văn bản pháp lý', '/van-ban']] },
  { label: 'Tin tức', href: '/tin-tuc', sub: null },
  { label: 'Liên hệ', href: '/lien-he', sub: null },
];
// onDark: chan trang (nen toi co dinh). Dau trang doi logo theo giao dien sang/toi bang lop only-light/only-dark.
const logoImg = (l, cls = '') => `<img src="${l.url}" alt="" class="logo-img${cls}" width="${l.w}" height="${l.h}">`;
const logo = (onDark = false) => (LOGO
  ? (LOGO_DARK === LOGO ? logoImg(LOGO)
    : onDark ? logoImg(LOGO_DARK, ' fc-dark') + logoImg(LOGO, ' fc-light') // fc-light chi hien o che do tuong phan cao nen sang
    : logoImg(LOGO, ' only-light') + logoImg(LOGO_DARK, ' only-dark'))
  : `<span class="logo-mark" aria-hidden="true">${esc(cfg.tenVietTat)}</span>`)
  + `<span class="logo-text"><strong>Liên đoàn Taekwondo</strong><span>Việt Nam</span></span>`;

function header(active, urlPath) {
  const items = NAV.map((m, i) => {
    // "page" chi cho lien ket dung trang dang xem; "true" cho muc cha khi dang o trang con cua muc do
    const cur = m.href === urlPath ? ' aria-current="page"' : active === m.href ? ' aria-current="true"' : '';
    if (!m.sub) return `<li class="nav-item"><a class="nav-link" href="${m.href}"${cur}>${esc(m.label)}</a></li>`;
    return `<li class="nav-item has-sub">
          <a class="nav-link" href="${m.href}"${cur}>${esc(m.label)}</a>
          <button class="sub-toggle" type="button" aria-expanded="false" aria-controls="sub-${i}" aria-label="Mở mục con ${esc(m.label)}">${icon('chevron')}</button>
          <ul class="sub" id="sub-${i}">${m.sub.map(([t, h]) => `<li><a href="${h}"${h === urlPath && h !== m.href ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul>
        </li>`;
  }).join('\n        ');
  return `<a class="skip" href="#noi-dung">Bỏ qua đến nội dung</a>
  <header class="site-header">
    <div class="container header-in">
      <a class="logo" href="/" aria-label="${esc(cfg.tenTiengViet)} – Trang chủ">${logo()}</a>
      <nav class="site-nav" id="site-nav" aria-label="Điều hướng chính">
        <ul class="nav-list">
        ${items}
        </ul>
      </nav>
      <div class="header-tools">
        <button class="icon-btn theme-toggle" type="button" aria-label="Giao diện tối" aria-pressed="false">${icon('moon', 'only-light')}${icon('sun', 'only-dark')}</button>
        <button class="icon-btn nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Mở menu">${icon('menu', 'when-closed')}${icon('x', 'when-open')}</button>
      </div>
    </div>
  </header>`;
}

function footer() {
  const contact = [];
  if (cfg.dienThoai) contact.push(`<li>${icon('phone')}<a href="tel:${esc(cfg.dienThoai.replace(/\s/g, ''))}">${esc(cfg.dienThoai)}</a></li>`);
  if (cfg.email) contact.push(`<li>${icon('mail')}<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a></li>`);
  if (!contact.length) contact.push(`<li>${icon('phone')}<span>Điện thoại, email: <em>đang cập nhật</em></span></li>`);
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="f-brand">
        <a class="logo logo--light" href="/">${logo(true)}</a>
        <p class="f-en">${esc(cfg.tenTiengAnh)} (${esc(cfg.tenVietTat)})</p>
        <p class="f-members"><span>Thành viên của</span> Ủy ban Olympic Việt Nam · Liên đoàn Taekwondo Thế giới (WT) · Hiệp hội Taekwondo châu Á (ATU) · Liên đoàn Taekwondo các nước ASEAN (ATF)</p>
      </div>
      <nav aria-label="Liên kết chân trang">
        <p class="f-h">Liên kết</p>
        <ul class="f-links">${NAV.map(m => `<li><a href="${m.href}">${esc(m.label)}</a></li>`).join('')}<li><a href="/quyen-rieng-tu">Quyền riêng tư</a></li><li><a href="/rss.xml">${icon('rss')}RSS tin tức</a></li></ul>
      </nav>
      <div>
        <p class="f-h">Trụ sở</p>
        <ul class="f-links">
          <li>${icon('pin')}<span>${cfg.diaChi ? esc(cfg.diaChi) : `${esc(cfg.truSoThanhPho)} <em>(địa chỉ chi tiết đang cập nhật)</em>`}</span></li>
          ${contact.join('\n          ')}
        </ul>
        <p class="f-h">Cơ quan quản lý</p>
        <ul class="f-links"><li>Quản lý nhà nước: Bộ Nội vụ</li><li>Quản lý lĩnh vực thể dục, thể thao: Bộ Văn hóa, Thể thao và Du lịch</li></ul>
      </div>
    </div>
    <div class="container f-bottom">
      <p>© ${esc(cfg.tenTiengViet)}. Bảo lưu mọi quyền.</p>
      <p>Nội dung giới thiệu dựa trên <a href="/dieu-le">Điều lệ (sửa đổi, bổ sung)</a> phê duyệt theo Quyết định số ${nw(DL.pheDuyet.so)} ngày ${DL.pheDuyet.ngay}. Cập nhật: <time datetime="${CONTENT_DATE || BUILD_DATE}">${viDate(CONTENT_DATE || BUILD_DATE)}</time>.</p>
    </div>
  </footer>
  <button class="to-top" type="button" aria-label="Về đầu trang" hidden>${icon('arrow-up')}</button>
  <div class="toast" role="status" aria-live="polite"></div>`;
}

// ---------------- du lieu co cau truc (JSON-LD) ----------------
const ORG_ID = SITE_URL + '/#to-chuc';
const orgLd = {
  '@context': 'https://schema.org', '@type': 'SportsOrganization', '@id': ORG_ID,
  name: cfg.tenTiengViet, alternateName: [cfg.tenTiengAnh, cfg.tenVietTat], url: abs('/'), sport: 'Taekwondo',
  address: { '@type': 'PostalAddress', addressLocality: cfg.truSoThanhPho, addressCountry: 'VN', ...(cfg.diaChi ? { streetAddress: cfg.diaChiDuong || cfg.diaChi } : {}) },
  ...(cfg.email ? { email: cfg.email } : {}), ...(cfg.dienThoai ? { telephone: cfg.dienThoai } : {}), ...(LOGO_URL ? { logo: abs(LOGO_URL) } : {}),
  memberOf: [
    { '@type': 'SportsOrganization', name: 'Liên đoàn Taekwondo Thế giới (World Taekwondo)', url: 'https://www.worldtaekwondo.org' },
    { '@type': 'Organization', name: 'Ủy ban Olympic Việt Nam' },
    { '@type': 'SportsOrganization', name: 'Hiệp hội Taekwondo châu Á (ATU)' },
    { '@type': 'SportsOrganization', name: 'Liên đoàn Taekwondo các nước ASEAN (ATF)' },
  ],
  ...(['facebook', 'youtube', 'website'].some(k => cfg[k]) ? { sameAs: ['facebook', 'youtube', 'website'].map(k => cfg[k]).filter(Boolean) } : {}),
};
const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE_URL + '/#website', url: abs('/'), name: cfg.tenTiengViet, inLanguage: 'vi-VN', publisher: { '@id': ORG_ID } };
const crumbLd = crumbs => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Trang chủ', item: abs('/') }, ...crumbs.map(([t, h], i) => ({ '@type': 'ListItem', position: i + 2, name: t, ...(h ? { item: abs(h) } : {}) }))] });
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

// ---------------- khung trang ----------------
const metaFor = p => PAGES.find(x => x.path === p) || {};
function shell({ file, path: urlPath, title, desc, body, active, hero, crumbs = [], extraLd = [], ogImage, ogAlt, noindex, type = 'website', article, topVideo }) {
  const fullTitle = urlPath === '/' ? `${cfg.tenTiengViet} (${cfg.tenVietTat})` : `${title} | ${cfg.tenTiengViet}`;
  const ogCard = !ogImage || !/[/:]/.test(ogImage); // ten tep anh chia se 1200x630 do tools/og.mjs tao trong src/generated
  const ogImg = /^https?:\/\//.test(ogImage || '') ? ogImage : abs(ogCard ? `/img/${ogImage || 'og-default.jpg'}` : ogImage);
  const lds = [orgLd, siteLd, ...(crumbs.length ? [crumbLd(crumbs)] : []), ...extraLd];
  const html = `<!DOCTYPE html>
<html lang="vi" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(desc)}">
  ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(abs(urlPath))}">`}
  <meta name="theme-color" content="#0B1F4D">
  <meta property="og:type" content="${type}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="${esc(cfg.tenTiengViet)}">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(abs(urlPath))}">
  <meta property="og:image" content="${esc(ogImg)}">
${ogCard ? `
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ''}
  <meta property="og:image:alt" content="${esc(ogAlt || `${title} – ${cfg.tenTiengViet}`)}">${article ? `
  <meta property="article:published_time" content="${article.date}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(ogImg)}">
  ${LOGO ? '<link rel="icon" type="image/png" sizes="48x48" href="/img/favicon-48.png">' : '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'}
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="Tin tức ${esc(cfg.tenTiengViet)}" href="/rss.xml">
  <link rel="preload" href="/fonts/be-vietnam-pro-400-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/be-vietnam-pro-800-latin.woff2" as="font" type="font/woff2" crossorigin>
  <script>var t=null;try{t=localStorage.getItem('vtf-theme')}catch(e){}if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark'</script>
  <link rel="stylesheet" href="/${CSS_FILE}">
  ${CMS_ENDPOINT ? `<link rel="preconnect" href="${esc(new URL(CMS_ENDPOINT).origin)}" crossorigin>
  ` : ''}<script defer src="/${CMS_FILE}" data-endpoint="${esc(CMS_ENDPOINT)}" data-base="${BASE}"></script>
  <script defer src="/${JS_FILE}" data-base="${BASE}"></script>
  ${lds.map(ld).join('\n  ')}
</head>
<body>
  ${sprite()}
  ${header(active, urlPath)}
  <main id="noi-dung" tabindex="-1">
${hero}
${topVideo ? videoSec('video-noi-bat', 'Video giới thiệu') : ''}${body}
${noindex ? '' : videoSec('video-trang', 'Video')}
  </main>
  ${footer()}
</body>
</html>
`;
  const out = BASE ? html.replace(/(href|src|srcset)="\/(?!\/)/g, `$1="${BASE}/`) : html; // srcset: anh <picture> (chi mot duong dan)
  const dest = path.join(DIST, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out, 'utf8');
  // lastmod lay tu ngay that (bai viet, ngayCapNhatNoiDung trong site.json), khong dung ngay build
  if (!noindex) built.push({ path: urlPath, title, lastmod: article ? article.date : (urlPath === '/' || urlPath.startsWith('/tin-tuc')) ? latest(CONTENT_DATE, news[0] && news[0].date) : urlPath === '/van-ban' ? latest(CONTENT_DATE, REVIEW_DATE) : CONTENT_DATE });
}

const pageHero = (crumbs, title, lead = '') => `    <section class="page-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Vị trí"><a href="/">Trang chủ</a>${crumbs.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join('')}</nav>
        <h1>${esc(title)}</h1>${lead ? `\n        <p class="lead">${lead}</p>` : ''}
      </div>
    </section>`;
const sec = (id, tit, inner, lead = '', cls = '') => `
    <section class="section ${cls}" id="${id}" aria-labelledby="h-${id}">
      <div class="container">
        <h2 class="sec-title" id="h-${id}">${esc(tit)}</h2>${lead ? `\n        <p class="sec-lead">${lead}</p>` : ''}
        ${inner}
      </div>
    </section>`;
// Khung video YouTube: AN cho den khi quan tri dan lien ket YouTube trong admin.html (cms-core.js bo thuoc tinh hidden, dien src)
const videoSec = (id, tit) => `
    <section class="section video-sec" id="${id}" aria-labelledby="h-${id}" hidden data-cms-optional>
      <div class="container">
        <h2 class="sec-title" id="h-${id}">${esc(tit)}</h2>
        <div class="video-frame"><iframe data-cms-video title="${esc(tit)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
      </div>
    </section>`;
const ol = items => `<ol class="numlist">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
const chips = items => `<ul class="chips">${items.map(t => `<li>${t}</li>`).join('')}</ul>`;
function articleBody(a) {
  return a.noiDung.map(b => b.loai === 'khoan' ? `<p class="k"><b>${b.so}.</b> ${esc(b.text)}</p>`
    : b.loai === 'diem' ? `<p class="d"><b>${b.so})</b> ${esc(b.text)}</p>`
    : b.loai === 'gach' ? `<p class="g">– ${esc(b.text)}</p>`
    : `<p${b.con ? ' class="c"' : ''}>${esc(b.text)}</p>`).join('');
}
const fullArticle = n => `<details class="full"><summary>Toàn văn Điều ${n}. ${esc(ART[n].tieuDe)}</summary><div class="full-body">${articleBody(ART[n])}</div></details>`;
const PDF_DL = '/docs/dieu-le-vtf-nhiem-ky-vi.pdf', PDF_QD = '/docs/qd-2-qd-bnv-phe-duyet-dieu-le.pdf';
const docCards = () => `<div class="docs">
          <a class="doc" href="${PDF_DL}" target="_blank" rel="noopener"><span class="doc-ic">${icon('file')}<small>PDF</small></span><span><strong>Điều lệ (sửa đổi, bổ sung) Liên đoàn Taekwondo Việt Nam</strong><small>Đại hội nhiệm kỳ VI thông qua ngày ${DL.daiHoiThongQua.ngay} · 604 KB</small></span>${icon('download', 'doc-go')}</a>
          <a class="doc" href="${PDF_QD}" target="_blank" rel="noopener"><span class="doc-ic">${icon('file')}<small>PDF</small></span><span><strong>Quyết định số ${nw(DL.pheDuyet.so)} phê duyệt Điều lệ</strong><small>${DL.pheDuyet.coQuan}, ngày ${DL.pheDuyet.ngay} · 614 KB</small></span>${icon('download', 'doc-go')}</a>
        </div>`;

const built = [];

// ---------------- Tin tuc (Markdown) ----------------
const NEWS_DIR = path.join(HERE, 'content', 'tin-tuc');
const news = fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_')).map(f => {
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(NEWS_DIR, f), 'utf8'));
  if (data.draft === true) return null;
  if (!data.title || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) throw new Error(`Bài ${f}: thiếu title hoặc date (NĂM-THÁNG-NGÀY)`);
  const slug = f.replace(/\.md$/, '');
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Bài ${f}: tên tệp chỉ dùng chữ thường không dấu, số và gạch ngang`);
  const { slug: _slug, html: _html, text: _text, ...meta } = data; // front matter khong duoc ghi de slug (da kiem tra tu ten tep)
  // anh dai dien: "anh/x.jpg" -> "/tin-tuc/anh/x.jpg"; chi nhan duong dan goc "/..." hoac https://
  let image = null;
  if (data.image) {
    image = safeUrl(String(data.image).replace(/^(\.\/)?anh\//, '/tin-tuc/anh/'));
    if (!/^(\/[^/]|https?:\/\/)/.test(image)) throw new Error(`Bài ${f}: "image" phải là /tin-tuc/anh/ten-anh.jpg hoặc https://..., đang là "${data.image}"`);
  }
  return { ...meta, slug, image, date: String(data.date), html: renderMarkdown(body, u => u), text: plainText(body) };
}).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date)) : [];
if (fs.existsSync(path.join(NEWS_DIR, 'anh'))) fs.cpSync(path.join(NEWS_DIR, 'anh'), path.join(DIST, 'tin-tuc', 'anh'), { recursive: true });
const newsCard = n => `<article class="news-card">
          ${n.image ? `<a class="news-img" href="/tin-tuc/${n.slug}" tabindex="-1" aria-hidden="true"><img src="${esc(n.image)}" alt="" loading="lazy" decoding="async" width="640" height="400"></a>` : ''}
          <div class="news-body">
            <p class="news-meta">${n.category ? `<span class="tag">${esc(n.category)}</span>` : ''}<time datetime="${n.date}">${icon('calendar')}${viDate(n.date)}</time></p>
            <h3><a href="/tin-tuc/${n.slug}">${esc(n.title)}</a></h3>
            ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
          </div>
        </article>`;

// ---------------- Lich thi dau (data/lich-thi-dau.json, nam moi nhat truoc) ----------------
const LICH = LTD.lich.slice().sort((a, b) => b.nam - a.nam);
const CAP_CLS = { 'Quốc gia': 'qg', 'Quốc tế': 'qt', 'Cấp tỉnh': 'dp', 'Cấp xã': 'dp' };
// giai dia phuong (cap tinh/xa): chi thong tin chinh + link schema; sap theo ngay bat dau
const GIAI_KHAC = (LTD.giaiKhac || []).slice().sort((a, b) => a.batDau.localeCompare(b.batDau));
for (const g of GIAI_KHAC) {
  if (!CAP_CLS[g.cap] || !/^\d{4}-\d{2}-\d{2}$/.test(g.batDau) || !/^\d{4}-\d{2}-\d{2}$/.test(g.ketThuc)) throw new Error(`lich-thi-dau.json, giaiKhac "${g.id}": kiểm tra "cap", "batDau", "ketThuc"`);
  if (g.trongTai && !(g.trongTai.danhSach || []).every(t => t.tt && t.ten)) throw new Error(`lich-thi-dau.json, giaiKhac "${g.id}": mỗi trọng tài cần "tt", "ten"`);
}
for (const l of LICH) for (const g of l.giai) {
  if (!CAP_CLS[g.cap]) throw new Error(`Lịch ${l.nam}, giải ${g.tt}: "cap" phải là "Quốc gia" hoặc "Quốc tế"`);
  if (!/^\d{4}-\d{2}$/.test(g.thang)) throw new Error(`Lịch ${l.nam}, giải ${g.tt}: "thang" phải có dạng NĂM-THÁNG, vd 2027-06`);
}
// chu viet tat trong van ban (vd TTHLTTQG) -> <abbr title> cho nguoi doc va trinh doc man hinh
const withAbbr = s => Object.entries(LTD.vietTat || {}).reduce((h, [k, v]) => h.split(k).join(`<abbr title="${esc(v)}">${k}</abbr>`), esc(s));
const evId = (l, g) => `giai-${l.nam}-${g.tt}`;
const capTag = g => `<span class="cap cap-${CAP_CLS[g.cap]}">${esc(g.cap)}</span>`;
const duKien = l => l.trangThai === 'Dự kiến';
const byMonth = giai => [...new Set(giai.map(g => g.thang))].sort().map(t => [t, giai.filter(g => g.thang === t)]);
const eventCard = (l, g) => `<li class="event" id="${evId(l, g)}" data-cap="${esc(g.cap)}"><article>
              <p class="ev-top">${capTag(g)}</p>
              <h4>${esc(g.ten)}</h4>
              <dl class="ev-dl">
                <div><dt>${icon('calendar')}Thời gian${duKien(l) ? ' dự kiến' : ''}</dt><dd>${esc(g.thoiGian)}</dd></div>
                <div><dt>${icon('pin')}Địa điểm</dt><dd>${withAbbr(g.diaDiem)}</dd></div>${g.ghiChu ? `
                <div><dt>${icon('info')}Ghi chú</dt><dd>${esc(g.ghiChu)}</dd></div>` : ''}
              </dl>
            </article></li>`;
const lichSource = l => `Công văn số ${nw(l.nguon.so)} ngày ${l.nguon.ngay} của ${esc(cfg.tenTiengViet)} (${esc(l.nguon.trichYeu)})`;

// ---------------- Dai hoi The thao toan quoc X (dung o trang chu, Lich thi dau, trang Dai hoi) ----------------
const telA = (ten, so, vaiTro = '') => `<li>${icon('phone')}<span><strong>${esc(ten)}</strong>${vaiTro ? ` (${esc(vaiTro)})` : ''}: <a href="tel:${esc(so.replace(/[^\d+]/g, ''))}">${esc(so)}</a></span></li>`;
const mapsUrl = q => `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(q)}`;
const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const thu = iso => THU[new Date(iso + 'T00:00:00Z').getUTCDay()];
const extA = (href, label, cls = 'btn btn-red') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${label} ${icon('external')}</a>`;
const dhRange = `${viDate(DH.batDau).slice(0, 5)}–${viDate(DH.ketThuc)}`;
const dhLive = BUILD_DATE <= DH.ketThuc; // het Dai hoi thi bo bang thong bao o trang chu
const pdfCard = (href, title, sub) => `<a class="doc" href="${href}" target="_blank" rel="noopener"><span class="doc-ic">${icon('file')}<small>PDF</small></span><span><strong>${title}</strong><small>${sub}</small></span>${icon('download', 'doc-go')}</a>`;
const mb = kb => `${Math.round(kb / 100) / 10} MB`;
// van ban Dai hoi theo thu tu ban hanh - dung o trang Dai hoi (Tai lieu) va trang Van ban phap ly
const dhDocCards = () => [
  pdfCard(DH.nguon.dieuLe.pdf, `Điều lệ ${esc(DH.ten)} – môn Taekwondo`, `Quyết định số ${nw(DH.nguon.dieuLe.so)} ngày ${DH.nguon.dieuLe.ngay} · kèm mẫu đăng ký · ${mb(DH.nguon.dieuLe.kb)}`),
  pdfCard(DH.banToChuc.qd.pdf, 'Quyết định thành lập Ban Tổ chức môn Taekwondo', `Số ${nw(DH.banToChuc.qd.so)} ngày ${DH.banToChuc.qd.ngay} · ${DH.banToChuc.thanhVien.length} thành viên · ${mb(DH.banToChuc.qd.kb)}`),
  pdfCard(DH.banTrongTai.qd.pdf, 'Quyết định thành lập Ban Trọng tài môn Taekwondo', `Số ${nw(DH.banTrongTai.qd.so)} ngày ${DH.banTrongTai.qd.ngay} · ${DH.banTrongTai.thanhVien.length} thành viên · ${mb(DH.banTrongTai.qd.kb)}`),
  pdfCard(DH.nguon.soTay.pdf, esc(DH.nguon.soTay.ten), `${esc(DH.nguon.soTay.coQuan)} · ${mb(DH.nguon.soTay.kb)}`),
].join('\n          ');
// Cong thong tin Dai hoi (thong tin chung, lich, bang xep hang toan Dai hoi)
const CTT = DH.congThongTin;
const officialLinks = () => `<div class="card official-links"><h3>${icon('external')} Cổng thông tin Đại hội</h3>
          <p>${esc(CTT.ten)}: thông tin chung, lịch thi đấu, kết quả và bảng xếp hạng toàn Đại hội.</p>
          <div class="btns">${extA(CTT.url, 'Vào Cổng thông tin Đại hội')}</div>
          <ul class="portal-links">${CTT.trang.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
        </div>`;
// danh sach trong tai cu di dieu hanh giai (neu co), thu gon trong the giai; van ban khong ghi don vi thi de trong
const evReferees = (g, id) => {
  const tt = g.trongTai;
  if (!tt?.danhSach?.length) return '';
  return `
              <details class="full ev-roster" id="${id}-trong-tai"><summary>${esc(tt.tieuDe)} (${tt.danhSach.length} người)</summary><div class="full-body">
                <table class="table roster ev-table"><thead><tr><th scope="col">TT</th><th scope="col">Họ và tên</th><th scope="col">Đơn vị</th></tr></thead><tbody>${tt.danhSach.map(t => `
                  <tr><td>${t.tt}</td><td><strong>${esc(t.ten)}</strong>${t.ghiChu ? `<small class="ev-role">${esc(t.ghiChu)}</small>` : ''}</td><td>${esc(t.donVi)}</td></tr>`).join('')}
                </tbody></table>
                <p class="ev-src">Nguồn: ${esc(tt.nguon)}</p>
              </div></details>`;
};
// the giai dia phuong: thoi gian, dia diem, hop chuyen mon, trong tai, nut schema, nguon van ban
const localCard = g => {
  const [hopNhan, ...hopNd] = g.hop.split(':');
  const id = `giai-${g.batDau.slice(0, 4)}-${g.id}`;
  return `<li class="event" id="${id}" data-cap="${esc(g.cap)}"><article>
              <p class="ev-top">${capTag(g)}</p>
              <h4>${esc(g.ten)}</h4>
              <dl class="ev-dl">
                <div><dt>${icon('calendar')}Thời gian</dt><dd>${esc(g.thoiGian)}</dd></div>
                <div><dt>${icon('pin')}Địa điểm</dt><dd>${esc(g.diaDiem)}</dd></div>
                <div><dt>${icon('users')}${esc(hopNhan.trim())}</dt><dd>${esc(hopNd.join(':').trim())}</dd></div>
              </dl>${evReferees(g, id)}
              <div class="btns ev-btns">${extA(g.schema, 'Xem schema thi đấu', 'btn btn-outline')}</div>
              <p class="ev-src">Nguồn: ${esc(g.nguon)}</p>
            </article></li>`;
};
// the Dai hoi The thao toan quoc trong lich 2026
const dhEventCard = () => `<li class="event" id="giai-${DH.batDau.slice(0, 4)}-dai-hoi-toan-quoc" data-cap="Quốc gia"><article>
              <p class="ev-top"><span class="cap cap-qg">Quốc gia</span></p>
              <h4><a href="${DH_PATH}">${esc(DH.ten)} – môn ${esc(DH.mon)}</a></h4>
              <dl class="ev-dl">
                <div><dt>${icon('calendar')}Thời gian</dt><dd>${dhRange}</dd></div>
                <div><dt>${icon('pin')}Địa điểm</dt><dd>${esc(DH.diaDiem)}</dd></div>
              </dl>
              <p class="more"><a class="ref" href="${DH_PATH}">Chương trình, check-in, nội dung, Ban Tổ chức, Ban Trọng tài</a></p>
              <p class="ev-src">Nguồn: Điều lệ môn Taekwondo ban hành kèm Quyết định số ${nw(DH.nguon.dieuLe.so)} ngày ${DH.nguon.dieuLe.ngay}</p>
            </article></li>`;
// lich nam 2026: Dai hoi + cac giai dia phuong, nhom theo thang
const lich2026 = () => {
  const items = [{ thang: DH.batDau.slice(0, 7), batDau: DH.batDau, html: dhEventCard() }, ...GIAI_KHAC.map(g => ({ thang: g.batDau.slice(0, 7), batDau: g.batDau, html: localCard(g) }))]
    .sort((a, b) => a.batDau.localeCompare(b.batDau));
  return `<ol class="timeline">${[...new Set(items.map(x => x.thang))].map(t => `
          <li class="tl-month">
            <h3 class="tl-h"><span>Tháng ${Number(t.slice(5))}</span><small>${t.slice(0, 4)}</small></h3>
            <ul class="events">${items.filter(x => x.thang === t).map(x => x.html).join('')}</ul>
          </li>`).join('')}
        </ol>`;
};

// ===== Trang chu =====
// Anh ky niem chuong do Lien doan cung cap (content/anh-goc/ky-niem-chuong-30-nam.jpg), tach 3 tam bang tools/anh-trang-chu.py (Pillow)
const KY_NIEM = '30 năm Liên đoàn Taekwondo Việt Nam (1996 – 2026)';
const TROPHY = [
  { file: 'ky-niem-chuong-10-nam', w: 380, h: 530, alt: 'Kỷ niệm chương pha lê hình giọt nước in biểu trưng 30 năm Liên đoàn Taekwondo Việt Nam 1996 – 2026, dòng chữ “Tri ân 10 năm cống hiến”, đế khắc VTF' },
  { file: 'ky-niem-chuong-20-nam', w: 518, h: 530, alt: 'Kỷ niệm chương pha lê hình thoi in biểu trưng 30 năm Liên đoàn Taekwondo Việt Nam, dòng chữ “Tôn vinh 20 năm cống hiến”, đế khắc VTF' },
  { file: 'ky-niem-chuong-30-nam', w: 529, h: 530, alt: 'Kỷ niệm chương pha lê hình bát giác in biểu trưng 30 năm Liên đoàn Taekwondo Việt Nam, dòng chữ “Vinh danh 30 năm cống hiến”, đế khắc VTF' },
];
const trophyPic = (t, big = false) => `<picture class="t${big ? ' t-big' : ''}"><source type="image/webp" srcset="/img/${t.file}.webp"><img src="/img/${t.file}.jpg" width="${t.w}" height="${t.h}" alt="${esc(t.alt)}"${big ? ' fetchpriority="high"' : ''}></picture>`;
const purposes = [
  ['users', 'Đoàn kết hội viên', 'Tập hợp, đoàn kết hội viên, hỗ trợ nhau hoạt động có hiệu quả.'],
  ['shield', 'Bảo vệ quyền lợi', 'Bảo vệ quyền và lợi ích hợp pháp của hội viên.'],
  ['calendar', 'Phát triển phong trào', 'Thúc đẩy phong trào tập luyện, thi đấu môn thể thao Taekwondo.'],
  ['book', 'Giáo dục', 'Giáo dục thể chất, rèn luyện ý chí, phẩm chất đạo đức, nâng cao sức khỏe.'],
  ['arrow-up', 'Tài năng', 'Phát triển tài năng Taekwondo, nâng cao thành tích.'],
  ['building', 'Vị thế', 'Nâng cao vị thế Taekwondo Việt Nam trong khu vực và thế giới.'],
];
{
  const m = metaFor('/');
  shell({
    file: 'index.html', path: '/', active: '/', title: 'Trang chủ', desc: m.desc, ogImage: `og-${m.og}.jpg`, topVideo: true,
    hero: `    <section class="home-hero">
      <div class="container home-hero-in">
        <div class="hh-text">
          <p class="hh-badge"><span>30 năm</span>1996 – 2026</p>
          <p class="eyebrow">${esc(cfg.tenTiengAnh)} · ${esc(cfg.tenVietTat)}</p>
          <h1>${esc(cfg.tenTiengViet)}</h1>
          <p class="lead">Tổ chức xã hội - nghề nghiệp tự nguyện của tổ chức, công dân Việt Nam hoạt động trong lĩnh vực môn thể thao Taekwondo, góp phần nâng cao thành tích và vị thế của Taekwondo Việt Nam trong khu vực và thế giới.</p>
          <div class="btns"><a class="btn btn-red" href="/gioi-thieu">Giới thiệu Liên đoàn ${icon('arrow-right')}</a><a class="btn btn-ghost" href="/dieu-le">Điều lệ nhiệm kỳ VI</a></div>
        </div>
        <figure class="hh-media">
          <div class="trophies">
            <div class="t-col">${TROPHY.slice(0, 2).map(t => trophyPic(t)).join('')}</div>
            ${trophyPic(TROPHY[2], true)}
          </div>
          <figcaption>Kỷ niệm chương tri ân, tôn vinh, vinh danh 10 – 20 – 30 năm cống hiến · ${esc(KY_NIEM)}</figcaption>
        </figure>
      </div>
    </section>`,
    // nen cac muc xen ke trang/xam tu dong (muc Tin moi chi co khi da dang tin)
    body: [
      dhLive && (c => sec('dai-hoi', `${DH.tenNgan} – ${DH.batDau.slice(0, 4)}`, `<div class="dh-banner" data-end="${DH.ketThuc}T23:59:59+07:00">
          <div class="dh-date"><b>${dhRange}</b><span>Môn ${esc(DH.mon)}</span></div>
          <div class="dh-text"><p><strong>${esc(DH.diaDiemTen)}</strong><br>${esc(DH.diaChi)}</p><p>Check-in: ${esc(DH.checkIn.gio)}. Hạn đăng ký khung giờ check-in và email schema: ${esc(DH.schema.hanChotChu)}.</p></div>
          <div class="btns"><a class="btn btn-red" href="${DH_PATH}">Thông tin thi đấu ${icon('arrow-right')}</a></div>
        </div>`, '', c)),
      LICH.length && (c => {
        // giai sap dien ra: giai dia phuong chua ket thuc (theo ngay build) truoc, roi lich nam moi nhat; toi da 6
        const l = LICH[0];
        const sapToi = [
          ...GIAI_KHAC.filter(g => g.ketThuc >= BUILD_DATE).map(g => ({ href: `/lich-thi-dau#giai-${g.batDau.slice(0, 4)}-${g.id}`, thang: g.batDau.slice(0, 7), ten: g.ten, g, noi: `${esc(g.noiNgan)} · <span class="nw">${esc(g.thoiGian)}</span>` })),
          ...l.giai.map(g => ({ href: `/lich-thi-dau#${evId(l, g)}`, thang: g.thang, ten: g.ten, g, noi: withAbbr(g.diaDiem) })),
        ].slice(0, 6);
        return sec('lich-thi-dau', 'Lịch thi đấu sắp tới', `<ol class="cal-mini">${sapToi.map(x => `<li><a href="${x.href}"><span class="cm-when"><b>T${Number(x.thang.slice(5))}</b><small>${x.thang.slice(0, 4)}</small></span><span class="cm-body"><strong>${esc(x.ten)}</strong><span class="cm-meta">${capTag(x.g)}<span>${x.noi}</span></span></span></a></li>`).join('')}</ol>
        <p class="more"><a class="ref" href="/lich-thi-dau">Xem lịch thi đấu đầy đủ</a></p>`, `Các giải có môn Taekwondo sắp diễn ra. Lịch năm ${l.nam} là ${duKien(l) ? 'dự kiến, ' : ''}theo Công văn số ${nw(l.nguon.so)} ngày ${l.nguon.ngay} của Liên đoàn.`, c);
      }),
      c => sec('muc-dich', 'Tôn chỉ, mục đích', `<div class="grid g3">${purposes.map(([ic, t, d]) => `<div class="card feature"><span class="feat-ic">${icon(ic)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
        <p class="more">${dieuLink(2, 'Đọc Điều 2 – Tôn chỉ, mục đích')}</p>`, `Nguyên tắc tổ chức và hoạt động: tự nguyện, tự quản; dân chủ, bình đẳng, công khai, minh bạch; tự bảo đảm kinh phí hoạt động; không vì mục đích lợi nhuận; tuân thủ Hiến pháp, pháp luật và Điều lệ Liên đoàn (${dieuLink(5)}).`, c),
      c => sec('thanh-vien', 'Thành viên của các tổ chức', `<div class="grid g4 orgs">
          <div class="org"><b>Ủy ban Olympic</b><span>Việt Nam</span></div>
          <a class="org" href="https://www.worldtaekwondo.org" target="_blank" rel="noopener"><b>WT ${icon('external', 'ext')}</b><span>Liên đoàn Taekwondo Thế giới</span></a>
          <div class="org"><b>ATU</b><span>Hiệp hội Taekwondo châu Á</span></div>
          <div class="org"><b>ATF</b><span>Liên đoàn Taekwondo các nước ASEAN</span></div>
        </div>${src(`${dieuLink(4, 'Điều 4, khoản 3')} Điều lệ`)}`, '', c),
      c => sec('co-cau', 'Cơ cấu tổ chức', `<div class="grid g4 mini-org">${blocks(14).map(b => `<a class="card" href="/co-cau-to-chuc"><span class="n">${b.so}</span><h3>${esc(b.text.replace(/\.$/, ''))}</h3></a>`).join('')}</div>
        <p class="more"><a class="ref" href="/co-cau-to-chuc">Xem sơ đồ và chức năng các cơ quan</a></p>`, '', c),
      c => sec('hoi-vien', 'Trở thành hội viên', `<div class="grid g2">
          <a class="card big" href="/hoi-vien#tieu-chuan"><h3>Hội viên tổ chức</h3><p>${esc(tidy(subOf(9, 2)[0].text, /^Hội viên tổ chức:\s*/))}</p></a>
          <a class="card big" href="/hoi-vien#tieu-chuan"><h3>Hội viên cá nhân</h3><p>${esc(tidy(subOf(9, 2)[1].text, /^Hội viên cá nhân:\s*/))}</p></a>
        </div>
        <p class="more"><a class="btn btn-red" href="/hoi-vien#thu-tuc">Thủ tục gia nhập Liên đoàn ${icon('arrow-right')}</a></p>`, '', c),
      news.length && (c => sec('tin-moi', 'Tin mới', `<div class="grid g3 news-grid">${news.slice(0, 3).map(newsCard).join('')}</div><p class="more"><a class="ref" href="/tin-tuc">Xem tất cả tin tức</a></p>`, '', c)),
      c => sec('van-ban', 'Văn bản pháp lý', docCards(), '', c),
    ].filter(Boolean).map((f, i) => f(i % 2 ? 'alt' : '')).join(''),
  });
}

// ===== Lich thi dau =====
{
  const m = metaFor('/lich-thi-dau'), crumbs = [['Lịch thi đấu', null]];
  shell({
    file: 'lich-thi-dau.html', path: '/lich-thi-dau', active: '/lich-thi-dau', title: 'Lịch thi đấu', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs,
    hero: pageHero(crumbs, 'Lịch thi đấu', 'Các giải Taekwondo quốc gia và quốc tế tổ chức tại Việt Nam, theo văn bản của Liên đoàn và Ban Tổ chức Đại hội Thể thao toàn quốc.'),
    // Dai hoi 2026 dien ra truoc lich 2027 -> dat len dau; het Dai hoi thi chuyen xuong cuoi
    body: [dhLive && 'dh', ...LICH, !dhLive && 'dh'].filter(Boolean).map((l, i) => l === 'dh' ? sec('nam-2026', `Năm ${DH.batDau.slice(0, 4)}`, lich2026(), 'Đại hội Thể thao toàn quốc và các giải địa phương có môn Taekwondo. Mỗi giải ghi nguồn văn bản; bấm "Xem schema thi đấu" để xem sơ đồ thi đấu của giải.', i % 2 ? 'alt' : '') : (() => {
      const count = c => l.giai.filter(g => g.cap === c).length;
      const places = new Set(l.giai.map(g => g.diaDiem.replace(/\s*\(.*\)$/, ''))).size;
      return sec(`nam-${l.nam}`, `Năm ${l.nam}${duKien(l) ? ' (dự kiến)' : ''}`, `<ul class="cal-stats">
          <li><b>${l.giai.length}</b><span>giải thi đấu</span></li>
          <li><b>${count('Quốc gia')}</b><span>giải quốc gia</span></li>
          <li><b>${count('Quốc tế')}</b><span>giải quốc tế</span></li>
          <li><b>${places}</b><span>địa điểm</span></li>
        </ul>
        <div class="cal-tools" hidden>
          <div class="seg" role="group" aria-label="Lọc theo cấp giải">
            <button type="button" data-cap="" aria-pressed="true">Tất cả</button>
            <button type="button" data-cap="Quốc gia" aria-pressed="false">Quốc gia</button>
            <button type="button" data-cap="Quốc tế" aria-pressed="false">Quốc tế</button>
          </div>
          <p class="cal-status" role="status"></p>
        </div>
        <ol class="timeline">${byMonth(l.giai).map(([t, gs]) => `
          <li class="tl-month">
            <h3 class="tl-h"><span>Tháng ${Number(t.slice(5))}</span><small>${t.slice(0, 4)}</small></h3>
            <ul class="events">${gs.map(g => eventCard(l, g)).join('')}</ul>
          </li>`).join('')}
        </ol>${duKien(l) ? `
        <p class="note">${icon('info')}<span>Thời gian, địa điểm là dự kiến; kế hoạch tổ chức có thể được điều chỉnh phù hợp với tình hình thực tế.</span></p>` : ''}
        ${src(lichSource(l))}`, `Lịch thi đấu các giải Taekwondo quốc gia và quốc tế năm ${l.nam} Liên đoàn báo cáo ${esc(l.nguon.kinhGui)}, đề nghị tổng hợp vào Hệ thống giải thi đấu thể thao năm ${l.nam}.`, i % 2 ? 'alt' : '');
    })()).join(''),
  });
}

// ===== Dai hoi The thao toan quoc lan thu X nam 2026 - mon Taekwondo (data/dai-hoi-x-2026.json) =====
// Nguon: Dieu le mon Taekwondo (QD 9/QD-BTCDHTTTQ) + So tay Check-in cua Ban To chuc; chu trich nguyen van
{
  const m = metaFor(DH_PATH), crumbs = [['Lịch thi đấu', '/lich-thi-dau'], [DH.tenNgan, null]];
  const nCaNhan = DH.doiKhangCaNhan['Nữ'].length + DH.doiKhangCaNhan['Nam'].length, nTong = nCaNhan + DH.doiKhangDongDoi.length + DH.quyen.length;
  const end = d => `${d}T23:59:59+07:00`;
  // moc thoi gian: site.js danh dau "Đã qua" / "Sắp tới" theo ngay xem trang
  // han "truoc ngay X" -> het han cuoi ngay hom truoc
  const dayBefore = d => new Date(Date.parse(d + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
  const moc = [
    [DH.dangKy.soBo, end(dayBefore(DH.dangKy.soBo)), `Hạn đăng ký sơ bộ (trước ngày ${viDate(DH.dangKy.soBo)})`, 'Gửi Bộ môn Taekwondo, Cục Thể dục thể thao Việt Nam'],
    [DH.dangKy.chinhThuc, end(dayBefore(DH.dangKy.chinhThuc)), `Hạn đăng ký chính thức (trước ngày ${viDate(DH.dangKy.chinhThuc)})`, 'Gửi Bộ môn Taekwondo, Cục Thể dục thể thao Việt Nam'],
    [DH.schema.hanChot.slice(0, 10), `${DH.schema.hanChot}:00+07:00`, `Hạn đăng ký HLV đại diện, khung giờ check-in và 5 email truy cập schema (${DH.schema.hanChotChu})`, 'Theo biểu mẫu của Ban Tổ chức'],
    [DH.checkIn.ngay, end(DH.checkIn.ngay), 'Check-in, nhận thẻ thi đấu, nộp nhạc quyền sáng tạo', `${DH.checkIn.gio}`],
    [DH.hopLanhDoi.ngay, end(DH.hopLanhDoi.ngay), 'Họp lãnh đội, bốc thăm xếp lịch', `${DH.hopLanhDoi.gio} ngày ${viDate(DH.hopLanhDoi.ngay)}, ${DH.hopLanhDoi.noi}`],
    ...DH.chuongTrinh.filter(d => d.ngay >= '2026-11-25').map(d => [d.ngay, end(d.ngay), d.muc.find(([, t]) => /^Thi đấu (các nội dung quyền|vòng loại|đối kháng)/.test(t))?.[1] || d.muc[0][1], '']),
  ];
  const dhLd = { '@context': 'https://schema.org', '@type': 'SportsEvent', name: `Môn ${DH.mon} – ${DH.ten}`, sport: DH.mon, startDate: DH.batDau, endDate: DH.ketThuc,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', url: abs(DH_PATH), description: m.desc,
    location: { '@type': 'Place', name: DH.diaDiemTen, address: { '@type': 'PostalAddress', streetAddress: DH.diaChi.replace(/,\s*TP\.?\s*HCM$/i, ''), addressLocality: 'Thành phố Hồ Chí Minh', addressCountry: 'VN' } },
    organizer: { '@type': 'Organization', name: `Ban Tổ chức ${DH.ten}` },
    superEvent: { '@type': 'SportsEvent', name: DH.ten, url: CTT.url } };
  const dl = DH.nguon.dieuLe, st = DH.nguon.soTay;
  const BTC = DH.banToChuc, BTT = DH.banTrongTai, nTT = BTT.thanhVien.length;
  const demGT = g => BTT.thanhVien.filter(t => t.gioiTinh === g).length, nDonVi = new Set(BTT.thanhVien.map(t => t.donVi)).size;
  const qdSrc = q => `Quyết định số ${nw(q.so)} ngày ${q.ngay} của Trưởng Ban Tổ chức ${esc(DH.ten)}`;
  const srcDL = `Điều lệ môn Taekwondo ban hành kèm Quyết định số ${nw(dl.so)} ngày ${dl.ngay}`;
  shell({
    file: 'dai-hoi-the-thao-toan-quoc-2026.html', path: DH_PATH, active: '/lich-thi-dau', title: m.title, desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs, extraLd: [dhLd],
    hero: pageHero(crumbs, DH.ten, `Môn ${esc(DH.mon)} · ${dhRange} · ${esc(DH.diaDiem)}`),
    body: `
    <nav class="tabs" aria-label="Trong trang này"><div class="container"><a href="#tong-quan">Tổng quan</a><a href="#chuong-trinh">Chương trình</a><a href="#ban-to-chuc-trong-tai">Ban tổ chức, trọng tài</a><a href="#noi-dung-thi-dau">Nội dung thi đấu</a><a href="#check-in">Check-in</a><a href="#nop-nhac">Nộp nhạc quyền</a><a href="#email-schema">Email schema</a><a href="#san-tap">Sân tập</a><a href="#quy-dinh">Quy định</a><a href="#tai-lieu">Tài liệu</a></div></nav>` + [
      sec('tong-quan', 'Tổng quan', `<ul class="cal-stats">
          <li><b>${dhRange}</b><span>thời gian</span></li>
          <li><b>${nTong}</b><span>nội dung thi đấu</span></li>
          <li><a class="stat-link" href="#ban-to-chuc-trong-tai"><b>${nTT}</b><span>trọng tài</span></a></li>
          <li><b>WT</b><span>luật thi đấu</span></li>
        </ul>
        <div class="grid g2">
          <div class="card"><h3>${icon('pin')} Địa điểm</h3><p><strong>${esc(DH.diaDiemTen)}</strong><br>${esc(DH.diaChi)}</p><p class="more"><a class="ref" href="${mapsUrl(DH.diaChi)}" target="_blank" rel="noopener">${icon('pin')}Xem bản đồ</a></p></div>
          <div class="card"><h3>${icon('calendar')} Đăng ký trước ${esc(DH.schema.hanChotChu)}</h3><p>Mỗi đơn vị đăng ký HLV đại diện, khung giờ check-in và 5 email truy cập hệ thống schema thi đấu theo biểu mẫu của Ban Tổ chức.</p><div class="btns">${extA(DH.lienKet.dangKy, 'Đăng ký')}${extA(DH.lienKet.khungGio, 'Xem khung giờ còn trống', 'btn btn-outline')}</div></div>
        </div>
        ${officialLinks()}
        <h3 class="sub-h">Mốc thời gian</h3>
        <ol class="ms-list">${moc.map(([d, e, t, s]) => `<li data-end="${e}"><time datetime="${d}"><b>${viDate(d).slice(0, 5)}</b><small>${thu(d)}</small></time><span class="ms-body"><strong>${esc(t)}</strong>${s ? `<small>${esc(s)}</small>` : ''}</span><span class="ms-state" aria-live="off"></span></li>`).join('')}</ol>
        ${src(`${srcDL}; ${esc(st.ten)}`)}`, `Thông tin thi đấu môn ${esc(DH.mon)} tại ${esc(DH.ten)}, theo Điều lệ môn và Sổ tay Check-in của Ban Tổ chức.`),
      sec('chuong-trinh', 'Chương trình tổ chức thi đấu', `<div class="prog">${DH.chuongTrinh.map(d => `
          <div class="prog-day${d.dieuChinh ? ' is-updated' : ''}"><h3><span>${thu(d.ngay)}</span> ${viDate(d.ngay)}${d.dieuChinh ? ' <small class="upd">Đã điều chỉnh</small>' : ''}</h3>
            <ul class="prog-items">${d.muc.map(([g, t]) => `<li><span class="pg-time">${esc(g)}</span><span>${esc(t)}</span></li>`).join('')}</ul>
          </div>`).join('')}
        </div>
        <p class="note">${icon('info')}<span>${esc(DH.dieuChinh.noiDung)} ngày ${viDate(DH.dieuChinh.ngay)}. ${esc(DH.chuongTrinhGhiChu)}. Địa điểm: ${esc(DH.diaDiem)}.</span></p>
        ${src(`${srcDL}; ngày 23/11 và 24/11 theo cập nhật của Liên đoàn ngày ${viDate(DH.dieuChinh.ngay)}`)}`, '', 'alt'),
      sec('ban-to-chuc-trong-tai', 'Ban Tổ chức và Ban Trọng tài', `<h3 class="sub-h">Ban Tổ chức môn Taekwondo (${BTC.thanhVien.length} thành viên)</h3>
        <p>${esc(BTC.nhiemVu)}</p>
        <table class="table docs-table roster"><thead><tr><th scope="col">TT</th><th scope="col">Họ và tên</th><th scope="col">Đơn vị công tác</th><th scope="col">Chức vụ trong Ban Tổ chức</th></tr></thead><tbody>${BTC.thanhVien.map((t, i) => `
          <tr><td data-label="TT">${i + 1}</td><td data-label="Họ và tên"><strong>${esc(t.ten)}</strong></td><td data-label="Đơn vị">${esc(t.donVi)}</td><td data-label="Chức vụ">${esc(t.chucVu)}</td></tr>`).join('')}
        </tbody></table>
        ${src(qdSrc(BTC.qd))}
        <h3 class="sub-h">Ban Trọng tài (${nTT} thành viên)</h3>
        <p>${esc(BTT.nhiemVu)}</p>
        <ul class="cal-stats">
          <li><b>${nTT}</b><span>thành viên</span></li>
          <li><b>${demGT('Nam')}</b><span>nam</span></li>
          <li><b>${demGT('Nữ')}</b><span>nữ</span></li>
          <li><b>${nDonVi}</b><span>đơn vị cử trọng tài</span></li>
        </ul>
        <ul class="contact-list">${BTT.thanhVien.filter(t => t.chucVu !== 'Trọng tài chính').map(t => `<li>${icon('users')}<span><strong>${esc(t.ten)}</strong> (${esc(t.donVi)}): ${esc(t.chucVu)}</span></li>`).join('')}</ul>
        <details class="full roster-wrap" open><summary>Danh sách ${nTT} thành viên Ban Trọng tài</summary><div class="full-body">
          <label class="search roster-search" for="tt-q">${icon('search')}<span class="sr">Tìm trọng tài theo tên hoặc đơn vị</span><input id="tt-q" class="roster-filter" type="search" placeholder="Tìm theo tên hoặc đơn vị, ví dụ: Đồng Nai" autocomplete="off" aria-controls="tt-list" data-status="tt-status"></label>
          <p id="tt-status" class="search-status" role="status"></p>
          <table class="table docs-table roster" id="tt-list"><thead><tr><th scope="col">TT</th><th scope="col">Họ và tên</th><th scope="col">Giới tính</th><th scope="col">Đơn vị</th><th scope="col">Chức vụ</th></tr></thead><tbody>${BTT.thanhVien.map(t => `
            <tr><td data-label="TT">${t.tt}</td><td data-label="Họ và tên"><strong>${esc(t.ten)}</strong></td><td data-label="Giới tính">${esc(t.gioiTinh)}</td><td data-label="Đơn vị">${esc(t.donVi)}</td><td data-label="Chức vụ">${esc(t.chucVu)}</td></tr>`).join('')}
          </tbody></table>
        </div></details>
        ${src(`${qdSrc(BTT.qd)} (danh sách kèm theo)`)}`),
      sec('noi-dung-thi-dau', `${nTong} nội dung thi đấu`, `<p>${esc(DH.doiKhangThietBi)}</p>
        <h3 class="sub-h">Đối kháng cá nhân (${nCaNhan} nội dung)</h3>
        ${Object.entries(DH.doiKhangCaNhan).map(([g, ws]) => `<div class="wc-row"><span class="wc-g">${esc(g)}</span><ul class="chips wc">${ws.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`).join('')}
        <h3 class="sub-h">Đối kháng đồng đội (${DH.doiKhangDongDoi.length} nội dung)</h3>
        <table class="table docs-table"><thead><tr><th scope="col">Nội dung</th><th scope="col">Thành phần</th><th scope="col">Trọng lượng</th></tr></thead><tbody>${DH.doiKhangDongDoi.map(r => `<tr><td data-label="Nội dung">${esc(r.noiDung)}</td><td data-label="Thành phần">${esc(r.thanhPhan)}</td><td data-label="Trọng lượng">${esc(r.gioiHan)}</td></tr>`).join('')}</tbody></table>
        <ul class="bullets">${DH.doiKhangDongDoiLuat.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <h3 class="sub-h">Quyền (${DH.quyen.length} nội dung)</h3>
        <ul class="chips">${DH.quyen.map(q => `<li>${esc(q)}${DH.quyenSoVdv[q] ? ` (${esc(DH.quyenSoVdv[q])})` : ''}</li>`).join('')}</ul>
        <h3 class="sub-h">Thể thức thi đấu</h3>
        <ul class="bullets">${DH.theThuc.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <h3 class="sub-h">Số nội dung mỗi đơn vị được đăng ký</h3>
        <ul class="bullets">${DH.dangKy.quyDinh.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        ${src(`${srcDL}, mục III, V, VI`)}`),
      sec('check-in', 'Check-in và nhận thẻ thi đấu', `<p>${esc(DH.checkIn.gioiThieu)}</p>
        <div class="grid g2">
          <div class="card"><h3>${icon('calendar')} Thời gian</h3><p><strong>${esc(DH.checkIn.gio)}/${DH.checkIn.ngay.slice(0, 4)}</strong> (${thu(DH.checkIn.ngay)})</p></div>
          <div class="card"><h3>${icon('pin')} Địa điểm</h3><p><strong>${esc(DH.checkIn.phong)}</strong><br>${esc(DH.diaChi)}</p></div>
        </div>
        <ol class="steps">${DH.checkIn.quyTrinh.map(([b, s], i) => `<li><b>${esc(b)}</b><span>${esc(s)}${i === 0 ? ` <strong>Đăng ký qua biểu mẫu của Ban Tổ chức, hạn ${esc(DH.schema.hanChotChu)}.</strong>` : ''}</span></li>`).join('')}</ol>
        <p class="note">${icon('info')}<span><strong>Lưu ý:</strong> ${esc(DH.checkIn.canhBao)}</span></p>
        <p class="note">${icon('info')}<span>${esc(DH.checkIn.luuY)}</span></p>
        <h3 class="sub-h">Khung giờ check-in</h3>
        <p>${esc(DH.checkIn.khungGio)} Hạn đăng ký: <strong>${esc(DH.schema.hanChotChu)}/${DH.schema.hanChot.slice(0, 4)}</strong>.</p>
        <div class="btns">${extA(DH.lienKet.khungGio, 'Xem khung giờ còn trống', 'btn btn-outline')}${extA(DH.lienKet.dangKy, 'Đăng ký khung giờ')}</div>
        <h3 class="sub-h">Thay đổi thông tin đã đăng ký</h3>
        <p>${esc(DH.checkIn.thayDoi)}</p>
        <ul class="contact-list">${DH.lienHeBtc.map(c => telA(c.ten, c.dienThoai)).join('')}</ul>
        ${src(esc(st.ten))}`, '', 'alt'),
      sec('nop-nhac', 'Nộp nhạc thi quyền sáng tạo', `<p>${esc(DH.nhac.gioiThieu)}</p>
        <table class="table kv"><tbody>${DH.nhac.muc.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        ${src(esc(st.ten))}`),
      sec('email-schema', 'Đăng ký email truy cập schema thi đấu', `<p>${esc(DH.schema.muc[0])}</p>
        <p class="deadline">${icon('calendar')}<span>Hạn đăng ký: <strong>${esc(DH.schema.hanChotChu)}/${DH.schema.hanChot.slice(0, 4)}</strong></span></p>
        <div class="btns">${extA(DH.lienKet.dangKy, 'Bấm đăng ký tại đây')}</div>
        <p>${esc(DH.schema.muc[1])}</p>
        <ul class="contact-list">${DH.lienHeBtc.map(c => telA(c.ten, c.dienThoai)).join('')}</ul>
        ${src(esc(st.ten))}`, '', 'alt'),
      sec('san-tap', 'Đăng ký sân tập', `<div class="grid g2">
          <div class="card"><h3>${icon('pin')} Địa điểm</h3><p><strong>${esc(DH.diaDiemTen)}</strong><br>${esc(DH.diaChi)}</p></div>
          <div class="card"><h3>${icon('phone')} Liên hệ</h3><ul class="contact-list">${telA(DH.sanTap.lienHe.ten, DH.sanTap.lienHe.dienThoai, DH.sanTap.lienHe.vaiTro)}</ul></div>
        </div>
        <p class="note">${icon('info')}<span><strong>Lưu ý:</strong> ${esc(DH.sanTap.luuY)}</span></p>
        ${src(esc(st.ten))}`),
      sec('quy-dinh', 'Quy định chung', `<h3 class="sub-h">Đối tượng và điều kiện tham dự</h3>
        <ol class="numlist one">${DH.doiTuong.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
        <h3 class="sub-h">Đăng ký thi đấu</h3>
        <ul class="bullets">
          <li>Đăng ký sơ bộ (số lượng tham gia): trước ngày ${viDate(DH.dangKy.soBo)}. Đăng ký chính thức: trước ngày ${viDate(DH.dangKy.chinhThuc)} (theo mẫu kèm Điều lệ).</li>
          <li>Đăng ký được gửi về: ${esc(DH.dangKy.noiNhan)}. Email: <a href="mailto:${esc(DH.dangKy.email)}">${esc(DH.dangKy.email)}</a>, số điện thoại: <a href="tel:${esc(DH.dangKy.dienThoai.replace(/\D/g, ''))}">${esc(DH.dangKy.dienThoai)}</a>.</li>
        </ul>
        <h3 class="sub-h">Kinh phí, luật thi đấu, doping</h3>
        <ul class="bullets">
          <li><strong>Kinh phí tham dự:</strong> ${esc(DH.kinhPhi)}</li>
          <li><strong>Luật thi đấu:</strong> ${esc(DH.luat)}</li>
          <li><strong>Doping:</strong> ${esc(DH.doping)}</li>
        </ul>
        <h3 class="sub-h">Khen thưởng và kỷ luật</h3>
        <ul class="bullets">
          <li><strong>Khen thưởng:</strong> ${esc(DH.khenThuongDieu)} ${esc(DH.khenThuong)}</li>
          <li><strong>Kỷ luật:</strong> ${esc(DH.kyLuat)}</li>
        </ul>
        <h3 class="sub-h">Giải quyết khiếu nại</h3>
        <ul class="bullets">${DH.khieuNai.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        ${src(`${srcDL}, mục I, III, IV, VII–X`)}`, '', 'alt'),
      sec('tai-lieu', 'Tài liệu', `<div class="docs">
          ${dhDocCards()}
        </div>`, '', 'alt'),
    ].map((h, i) => h.replace(/<section class="section [^"]*"/, `<section class="section ${i % 2 ? 'alt' : ''}"`)).join(''), // nen xen ke tu dong theo thu tu muc
  });
}

// ===== Gioi thieu =====
{
  const m = metaFor('/gioi-thieu'), crumbs = [['Giới thiệu', null]];
  shell({
    file: 'gioi-thieu.html', path: '/gioi-thieu', active: '/gioi-thieu', title: 'Về Liên đoàn', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs,
    hero: pageHero(crumbs, 'Về Liên đoàn'),
    body: [
      sec('ten-goi', 'Tên gọi, biểu tượng', `<table class="table kv"><tbody>${blocks(1).map(b => { const [k, ...v] = b.text.split(':'); return `<tr><th scope="row">${esc(k)}</th><td>${esc(v.join(':').trim())}</td></tr>`; }).join('')}</tbody></table>${src(`${dieuLink(1)} Điều lệ`)}`),
      sec('ton-chi', 'Tôn chỉ, mục đích', `<div class="quote">${blocks(2).map(b => `<p>${esc(b.text)}</p>`).join('')}</div>${src(`${dieuLink(2)} Điều lệ`)}`, '', 'alt'),
      sec('phap-ly', 'Địa vị pháp lý, trụ sở', `<div class="grid g2">${blocks(3).map(b => `<div class="card"><p>${esc(b.text)}</p></div>`).join('')}</div>${src(`${dieuLink(3)} Điều lệ`)}${cfg.diaChi ? `
        <p class="note">${icon('pin')}<span>Địa chỉ trụ sở: ${esc(cfg.diaChi)}. <a href="/lien-he">Thông tin liên hệ</a></span></p>` : ''}`),
      sec('pham-vi', 'Lĩnh vực, phạm vi hoạt động', `<div class="grid g3">${blocks(4).map(b => `<div class="card"><span class="n">${b.so}</span><p>${esc(b.text)}</p></div>`).join('')}</div>${src(`${dieuLink(4)} Điều lệ`)}`, '', 'alt'),
      sec('nguyen-tac', 'Nguyên tắc tổ chức và hoạt động', `<div class="grid g5">${blocks(5).map(b => `<div class="card num"><span class="n">${String(b.so).padStart(2, '0')}</span><h3>${esc(b.text.replace(/\.$/, ''))}</h3></div>`).join('')}</div>${src(`${dieuLink(5)} Điều lệ`)}`),
      sec('ngon-ngu', 'Ngôn ngữ', `<div class="card"><p>${esc(blocks(6)[0].text)}</p></div>${src(`${dieuLink(6)} Điều lệ`)}`, '', 'alt'),
    ].join(''),
  });
}

// ===== Quyen han, nhiem vu =====
{
  const m = metaFor('/quyen-han-nhiem-vu'), crumbs = [['Giới thiệu', '/gioi-thieu'], ['Quyền hạn và nhiệm vụ', null]];
  shell({
    file: 'quyen-han-nhiem-vu.html', path: '/quyen-han-nhiem-vu', active: '/gioi-thieu', title: 'Quyền hạn và nhiệm vụ', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs,
    hero: pageHero(crumbs, 'Quyền hạn và nhiệm vụ'),
    body: `
    <nav class="tabs" aria-label="Trong trang này"><div class="container"><a href="#quyen-han">Quyền hạn (14)</a><a href="#nhiem-vu">Nhiệm vụ (16)</a></div></nav>` + [
      sec('quyen-han', 'Quyền hạn', ol(blocks(7).map(b => b.text)) + src(`${dieuLink(7)} Điều lệ`)),
      sec('nhiem-vu', 'Nhiệm vụ', ol(blocks(8).map(b => b.text)) + src(`${dieuLink(8)} Điều lệ`), '', 'alt'),
    ].join(''),
  });
}

// ===== Co cau to chuc =====
{
  const m = metaFor('/co-cau-to-chuc'), crumbs = [['Giới thiệu', '/gioi-thieu'], ['Cơ cấu tổ chức', null]];
  const leaders = Array.isArray(cfg.banLanhDao) && cfg.banLanhDao.length
    ? `<div class="grid g4">${cfg.banLanhDao.map(p => `<div class="card leader"><span class="role">${esc(p.chucDanh)}</span><h3>${esc(p.hoTen)}</h3></div>`).join('')}</div>`
    : `<div class="placeholder">${icon('users')}<strong>Danh sách Ban Chấp hành, Ban Thường vụ ${esc(cfg.nhiemKy)}</strong><p>Thông tin nhân sự đang được cập nhật.</p></div>`;
  const organ = (id, tit, n, facts, alt) => sec(id, tit, `${chips(facts)}${fullArticle(n)}`, '', alt ? 'alt organ' : 'organ');
  shell({
    file: 'co-cau-to-chuc.html', path: '/co-cau-to-chuc', active: '/gioi-thieu', title: 'Cơ cấu tổ chức', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs,
    hero: pageHero(crumbs, 'Cơ cấu tổ chức'),
    body: [
      sec('so-do', 'Sơ đồ tổ chức', `<div class="tree" role="group" aria-label="Sơ đồ tổ chức Liên đoàn Taekwondo Việt Nam">
          <ul><li>
            <a href="#dai-hoi" class="node top">Đại hội<small>Cơ quan lãnh đạo cao nhất · 4 năm/lần (Điều 15)</small></a>
            <ul>
              <li>
                <a href="#ban-chap-hanh" class="node">Ban Chấp hành<small>Do Đại hội bầu · lãnh đạo giữa hai kỳ Đại hội (Điều 16)</small></a>
                <ul>
                  <li>
                    <a href="#ban-thuong-vu" class="node">Ban Thường vụ<small>Do Ban Chấp hành bầu · Chủ tịch, các Phó Chủ tịch, Tổng thư ký, một số ủy viên (Điều 17, 19, 20)</small></a>
                    <ul>
                      <li><a href="#van-phong" class="node sm">Văn phòng và các ban chức năng<small>Tham mưu, giúp việc Ban Chấp hành, Ban Thường vụ (Điều 21)</small></a></li>
                      <li><a href="#van-phong" class="node sm">Tổ chức có tư cách pháp nhân thuộc Liên đoàn<small>Ban Thường vụ quyết định thành lập theo Nghị quyết Ban Chấp hành (Điều 17, 21)</small></a></li>
                    </ul>
                  </li>
                  <li><a href="#hoi-dong-ky-thuat" class="node sm">Hội đồng kỹ thuật<small>Làm việc theo sự chỉ đạo của Ban Chấp hành (Điều 22)</small></a></li>
                </ul>
              </li>
              <li><a href="#ban-kiem-tra" class="node side">Ban Kiểm tra<small>Do Đại hội bầu · hoạt động độc lập (Điều 18)</small></a></li>
            </ul>
          </li></ul>
        </div>${src(`${dieuLink(14)}–${dieuLink(22, '22')} Điều lệ. Đường nối thể hiện quan hệ bầu cử, chỉ đạo, giúp việc theo các điều khoản ghi trong từng ô.`)}`),
      sec('lanh-dao', 'Lãnh đạo Liên đoàn', leaders, '', 'alt'),
      organ('dai-hoi', 'Đại hội', 15, ['Cơ quan lãnh đạo cao nhất; Đại hội nhiệm kỳ <b>04 năm một lần</b>', 'Đại hội bất thường khi <b>ít nhất 2/3</b> ủy viên Ban Chấp hành yêu cầu bằng văn bản hoặc <b>ít nhất 1/2</b> hội viên chính thức đề nghị', 'Tổ chức dưới hình thức Đại hội đại biểu; được tổ chức khi có <b>trên 1/2</b> đại biểu chính thức có mặt', 'Quyết định được thông qua khi <b>trên 1/2</b> đại biểu chính thức có mặt tán thành', 'Có thể tổ chức Hội nghị thường niên <b>01 năm một lần</b>']),
      organ('ban-chap-hanh', 'Ban Chấp hành', 16, ['Do Đại hội bầu trong số hội viên; nhiệm kỳ cùng nhiệm kỳ Đại hội', 'Họp <b>02 lần mỗi năm</b>; họp bất thường theo yêu cầu của Ban Thường vụ hoặc trên 2/3 ủy viên', 'Cuộc họp hợp lệ khi <b>trên 2/3</b> ủy viên dự; nghị quyết thông qua khi <b>trên 2/3</b> ủy viên dự họp tán thành', 'Bầu, miễn nhiệm Chủ tịch, các Phó Chủ tịch, Tổng thư ký, ủy viên Ban Thường vụ', 'Bầu bổ sung ủy viên Ban Chấp hành (không quá <b>1/4</b> số lượng do Đại hội quyết định) và ủy viên Ban Kiểm tra'], true),
      organ('ban-thuong-vu', 'Ban Thường vụ', 17, ['Do Ban Chấp hành bầu trong số ủy viên Ban Chấp hành', 'Gồm Chủ tịch, các Phó Chủ tịch, Tổng thư ký và một số ủy viên; <b>không quá 1/3</b> số ủy viên Ban Chấp hành', 'Họp định kỳ <b>04 tháng một lần</b>', 'Lãnh đạo hoạt động của Liên đoàn giữa hai kỳ họp Ban Chấp hành', 'Có thể cử ra Thường trực để giúp việc Ban Thường vụ']),
      organ('ban-kiem-tra', 'Ban Kiểm tra', 18, ['Do Đại hội bầu; gồm Trưởng ban, Phó trưởng ban và một số ủy viên', 'Thành viên <b>không đồng thời</b> là ủy viên Ban Chấp hành', 'Kiểm tra, giám sát việc thực hiện Điều lệ, Nghị quyết Đại hội và các quy chế', 'Xem xét, giải quyết đơn thư phản ánh, kiến nghị, khiếu nại, tố cáo', 'Hoạt động <b>độc lập</b> theo Quy chế do Ban Chấp hành ban hành'], true),
      organ('chu-tich', 'Chủ tịch, Phó Chủ tịch', 19, ['Chủ tịch là <b>người đại diện trước pháp luật</b> về mọi hoạt động của Liên đoàn', 'Chủ tịch, Phó Chủ tịch do Ban Chấp hành bầu trong số ủy viên Ban Thường vụ', 'Chủ tịch là chủ tài khoản; quyết định ban hành luật thi đấu, phê duyệt điều lệ giải theo thẩm quyền', 'Khi vắng mặt, Chủ tịch ủy quyền bằng văn bản cho một Phó Chủ tịch']),
      organ('tong-thu-ky', 'Tổng thư ký', 20, ['Do Chủ tịch giới thiệu trong số ủy viên Ban Thường vụ, được Ban Chấp hành bầu', 'Điều hành Văn phòng; không kiêm thành viên ban chức năng nào', 'Được ủy quyền thứ nhất chủ tài khoản của Liên đoàn', 'Đầu mối liên hệ với các tổ chức Taekwondo quốc tế, các liên đoàn quốc gia'], true),
      organ('van-phong', 'Văn phòng, ban chuyên môn, tổ chức có tư cách pháp nhân và chi hội', 21, ['Văn phòng là bộ phận tham mưu, giúp việc Ban Chấp hành, Ban Thường vụ và Lãnh đạo Liên đoàn', 'Các ban chuyên môn tham mưu về hoạt động chuyên môn, hoạt động theo Quy chế do Ban Chấp hành ban hành', 'Ban Thường vụ quyết định thành lập tổ chức có tư cách pháp nhân thuộc Liên đoàn theo Nghị quyết Ban Chấp hành', 'Chi hội thuộc Liên đoàn không có tư cách pháp nhân, con dấu, tài khoản riêng']),
      organ('hoi-dong-ky-thuat', 'Hội đồng kỹ thuật', 22, ['Gồm Chủ tịch, các Phó Chủ tịch (nếu có) và một số ủy viên; số lượng, cơ cấu, tiêu chuẩn thành viên do Chủ tịch Liên đoàn đề nghị, Ban Chấp hành thông qua', 'Làm việc theo chế độ tập thể, theo sự chỉ đạo của Ban Chấp hành', 'Quyết định, quản lý các nội dung quan trọng về chuyên môn kỹ thuật', 'Xây dựng kế hoạch đào tạo, bồi dưỡng trọng tài, huấn luyện viên, hướng dẫn viên <b>trình Ban Chấp hành thông qua</b>', 'Giám sát, chấm thi thăng đẳng cho các hội viên <b>theo phân công của Ban Chấp hành</b>'], true),
    ].join(''),
  });
}

// ===== Hoi vien (+ Hoi dap trich tu Dieu le) =====
{
  const m = metaFor('/hoi-vien'), crumbs = [['Hội viên', null]];
  const FAQ = [
    ['Ai có thể trở thành hội viên chính thức của Liên đoàn?',
      'Công dân, tổ chức Việt Nam có đủ tiêu chuẩn, tán thành Điều lệ và tự nguyện gia nhập. Hội viên tổ chức là các liên đoàn, hiệp hội, tổ chức Taekwondo của các tỉnh, thành phố trực thuộc Trung ương và các tổ chức có hoạt động liên quan đến Taekwondo được thành lập hợp pháp. Người đại diện hội viên tổ chức phải là công dân Việt Nam. Hội viên cá nhân là công dân Việt Nam là huấn luyện viên, vận động viên và các cá nhân khác có đủ năng lực hành vi dân sự hoạt động trong lĩnh vực Taekwondo, yêu thích tập luyện, ủng hộ cho sự phát triển môn thể thao Taekwondo.', 9],
    ['Hội viên danh dự khác hội viên chính thức như thế nào?',
      'Hội viên danh dự là công dân, tổ chức Việt Nam có nhiều thành tích, công lao đóng góp cho Liên đoàn nhưng không đủ điều kiện trở thành hội viên chính thức. Hội viên danh dự có quyền và nghĩa vụ như hội viên chính thức, trừ quyền biểu quyết các vấn đề của Liên đoàn và quyền ứng cử, đề cử, bầu cử Ban lãnh đạo, Ban Kiểm tra.', [[9, 'Điều 9, khoản 1'], [10, 'Điều 10, khoản 10']]],
    ['Hồ sơ xin gia nhập gồm những gì?',
      'Hội viên tổ chức: đơn xin gia nhập; bản sao Điều lệ, quy định của tổ chức và quyết định cho phép thành lập; danh sách lãnh đạo chủ chốt và công văn cử đại diện; văn bản cam kết tuân thủ Điều lệ, Luật thi đấu và các quy định của Liên đoàn; đóng niên liễm, phí và hội phí. Hội viên cá nhân: đơn xin gia nhập; văn bản cam kết; nộp hội phí theo quy định.', 12],
    ['Nộp hồ sơ ở đâu và ai xét duyệt?',
      'Hồ sơ nộp tại Văn phòng Liên đoàn. Việc công nhận hội viên do Ban Chấp hành Liên đoàn xem xét, quyết định.', 12],
    ['Hội viên có những quyền lợi gì?',
      'Hội viên được Liên đoàn bảo vệ quyền, lợi ích hợp pháp; được cung cấp thông tin và tham gia các hoạt động của Liên đoàn; được dự Đại hội, ứng cử, đề cử, bầu cử các cơ quan, chức danh lãnh đạo và Ban Kiểm tra theo quy định của Liên đoàn (hội viên danh dự không có quyền biểu quyết, ứng cử, đề cử, bầu cử); giám sát hoạt động của Ban Chấp hành, Ban Kiểm tra; được cấp thẻ hội viên và được khen thưởng khi có thành tích xuất sắc.', 10],
    ['Hội viên có được đồng thời tham gia liên đoàn Taekwondo quốc gia khác không?',
      'Hội viên không được đồng thời là thành viên của một liên đoàn Taekwondo quốc gia khác và không được tham gia các hoạt động Taekwondo trên lãnh thổ của liên đoàn Taekwondo quốc gia khác nếu không được sự cho phép của liên đoàn quốc gia đó, Liên đoàn Taekwondo Việt Nam, Liên đoàn Taekwondo Thế giới (WT), Hiệp hội Taekwondo châu Á (ATU) và Liên đoàn Taekwondo các nước ASEAN (ATF).', 11],
    ['Khi nào hội viên bị xóa tên?',
      'Hội viên không sinh hoạt liên tục trong 06 tháng mà không có lý do chính đáng mặc nhiên bị xóa tên trong danh sách hội viên.', 13],
    ['Muốn ra khỏi Liên đoàn thì làm thế nào?',
      'Hội viên gửi đơn tới Ban Chấp hành Liên đoàn để xem xét, quyết định. Quyền và nghĩa vụ hội viên chấm dứt sau khi Ban Chấp hành thông báo chấp thuận.', 13],
  ];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  shell({
    file: 'hoi-vien.html', path: '/hoi-vien', active: '/hoi-vien', title: 'Hội viên', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs, extraLd: [faqLd],
    hero: pageHero(crumbs, 'Hội viên'),
    body: `
    <nav class="tabs" aria-label="Trong trang này"><div class="container"><a href="#tieu-chuan">Tiêu chuẩn</a><a href="#quyen-nghia-vu">Quyền và nghĩa vụ</a><a href="#thu-tuc">Thủ tục gia nhập</a><a href="#ra-khoi">Ra khỏi Liên đoàn</a><a href="#hoi-dap">Hỏi đáp</a></div></nav>` + [
      sec('tieu-chuan', 'Hội viên và tiêu chuẩn hội viên', `<div class="grid g2">
          <div class="card big"><span class="tag">Hội viên chính thức</span><p>${esc(tidy(subOf(9, 1)[0].text, /^Hội viên chính thức:\s*/))}</p></div>
          <div class="card big"><span class="tag tag-red">Hội viên danh dự</span><p>${esc(tidy(subOf(9, 1)[1].text, /^Hội viên danh dự:\s*/))}</p></div>
        </div>
        <h3 class="h3">Tiêu chuẩn hội viên chính thức</h3>
        <div class="grid g2">
          <div class="card"><h3>Hội viên tổ chức</h3><p>${esc(tidy(subOf(9, 2)[0].text, /^Hội viên tổ chức:\s*/))}</p></div>
          <div class="card"><h3>Hội viên cá nhân</h3><p>${esc(tidy(subOf(9, 2)[1].text, /^Hội viên cá nhân:\s*/))}</p></div>
        </div>${src(`${dieuLink(9)} Điều lệ`)}`),
      sec('quyen-nghia-vu', 'Quyền và nghĩa vụ của hội viên', `<div class="grid g2 top">
          <div><h3 class="h3">Quyền của hội viên</h3>${ol(blocks(10).map(b => b.text))}${src(`${dieuLink(10)} Điều lệ`)}</div>
          <div><h3 class="h3">Nghĩa vụ của hội viên</h3>${ol(blocks(11).map(b => b.text))}${src(`${dieuLink(11)} Điều lệ`)}</div>
        </div>`, '', 'alt'),
      sec('thu-tuc', 'Thủ tục gia nhập Liên đoàn', `<ol class="steps">
          <li><b>Chuẩn bị hồ sơ</b><span>Theo loại hội viên tổ chức hoặc cá nhân (bên dưới).</span></li>
          <li><b>Nộp hồ sơ</b><span>Tại Văn phòng Liên đoàn.</span></li>
          <li><b>Xét công nhận</b><span>Ban Chấp hành Liên đoàn xem xét, quyết định.</span></li>
        </ol>
        <p class="note">${icon('info')}<span>Sau khi được công nhận, hội viên có quyền được cấp thẻ hội viên của Liên đoàn (${dieuLink(10, 'Điều 10, khoản 7')}).</span></p>
        <div class="grid g2 top">
          <div class="card checklist"><h3>Hồ sơ hội viên tổ chức</h3><ul>${subOf(12, 2).map(b => `<li>${icon('check')}<span>${esc(b.text.replace(/[;.]$/, ''))}</span></li>`).join('')}</ul></div>
          <div class="card checklist"><h3>Hồ sơ hội viên cá nhân</h3><ul>${subOf(12, 3).map(b => `<li>${icon('check')}<span>${esc(b.text.replace(/[;.]$/, ''))}</span></li>`).join('')}</ul></div>
        </div>${src(`${dieuLink(12)} Điều lệ`)}`),
      sec('ra-khoi', 'Thể thức ra khỏi Liên đoàn', `<ol class="numlist one">${blocks(13).filter(b => b.loai === 'khoan').map(b => `<li>${esc(b.text)}${b.so === '2' ? `<ul class="sublist">${subOf(13, 2).map(d => `<li><b>${d.so})</b> ${esc(d.text)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>${src(`${dieuLink(13)} Điều lệ`)}`, '', 'alt'),
      sec('hoi-dap', 'Hỏi đáp về hội viên', `<div class="faq">${FAQ.map(([q, a, n], i) => `<details class="faq-item"${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><div class="faq-a"><p>${esc(a)}</p><p class="faq-src">Căn cứ: ${(Array.isArray(n) ? n : [n]).map(x => Array.isArray(x) ? dieuLink(...x) : dieuLink(x)).join('; ')} Điều lệ</p></div></details>`).join('')}</div>`, 'Câu trả lời tóm lược từ Điều lệ (sửa đổi, bổ sung); khi cần căn cứ chính xác, xem điều khoản được dẫn.'),
    ].join(''),
  });
}

// ===== Dieu le (toan van + cong cu doc) =====
{
  const m = metaFor('/dieu-le'), crumbs = [['Điều lệ & Văn bản', '/dieu-le'], ['Điều lệ Liên đoàn', null]];
  const toc = DL.chuong.map(c => `<li><a href="#chuong-${c.so}"><b>Chương ${c.so}</b> ${esc(c.tieuDe.charAt(0) + c.tieuDe.slice(1).toLowerCase())}</a><ul>${c.dieu.map(a => `<li><a href="#dieu-${a.so}">Điều ${a.so}. ${esc(a.tieuDe)}</a></li>`).join('')}</ul></li>`).join('');
  const fullText = DL.chuong.map(c => `
            <section class="chuong" id="chuong-${c.so}" aria-labelledby="h-chuong-${c.so}">
              <h2 id="h-chuong-${c.so}"><span>Chương ${c.so}</span>${esc(c.tieuDe)}</h2>
              ${c.dieu.map(a => `<article class="dieu" id="dieu-${a.so}"><div class="dieu-h"><h3><span class="dieu-t">Điều ${a.so}. ${esc(a.tieuDe)}</span></h3><button class="copy-link" type="button" data-target="dieu-${a.so}" aria-label="Sao chép liên kết tới Điều ${a.so}">${icon('link')}</button></div>${articleBody(a)}</article>`).join('\n              ')}
            </section>`).join('');
  const docLd = { '@context': 'https://schema.org', '@type': 'DigitalDocument', name: DL.ten, inLanguage: 'vi-VN', datePublished: isoDate(DL.pheDuyet.ngay), dateCreated: isoDate(DL.daiHoiThongQua.ngay), publisher: { '@id': ORG_ID }, url: abs('/dieu-le'), associatedMedia: { '@type': 'MediaObject', contentUrl: abs(PDF_DL), encodingFormat: 'application/pdf' } };
  shell({
    file: 'dieu-le.html', path: '/dieu-le', active: '/dieu-le', title: 'Điều lệ Liên đoàn', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs, extraLd: [docLd],
    hero: pageHero(crumbs, 'Điều lệ Liên đoàn'),
    body: `
    <div class="progress" aria-hidden="true"><span></span></div>
    <section class="section">
      <div class="container">
        <div class="charter-head">
          <p class="t">ĐIỀU LỆ (SỬA ĐỔI, BỔ SUNG)<br>LIÊN ĐOÀN TAEKWONDO VIỆT NAM</p>
          <p class="s">(Phê duyệt kèm theo Quyết định số ${nw(DL.pheDuyet.so)} ngày ${DL.pheDuyet.ngay} của Bộ trưởng Bộ Nội vụ)</p>
          <ul class="meta">
            <li><b>Thông qua:</b> Đại hội nhiệm kỳ ${DL.daiHoiThongQua.nhiemKy}, ngày ${DL.daiHoiThongQua.ngay} tại ${DL.daiHoiThongQua.diaDiem}</li>
            <li><b>Hiệu lực:</b> theo Quyết định phê duyệt số ${nw(DL.pheDuyet.so)} ngày ${DL.pheDuyet.ngay}</li>
            <li><b>Thay thế:</b> Điều lệ phê duyệt kèm Quyết định số ${nw(DL.thayThe.so)} ngày ${DL.thayThe.ngay}</li>
          </ul>
          ${docCards()}
        </div>
        <div class="charter-tools" role="search">
          <label class="search" for="dl-q">${icon('search')}<span class="sr">Tìm trong Điều lệ</span><input id="dl-q" type="search" placeholder="Tìm trong Điều lệ, ví dụ: hội phí, Ban Kiểm tra, ho so…" autocomplete="off" enterkeyhint="search"></label>
          <p class="search-status" id="dl-status" role="status" aria-live="polite"></p>
          <button class="btn btn-outline print-btn" type="button">${icon('printer')}In Điều lệ</button>
        </div>
        <div class="charter">
          <details class="toc" open><summary class="toc-h">Mục lục</summary><ul>${toc}</ul></details><script>if(innerWidth<=1024)document.currentScript.previousElementSibling.removeAttribute('open')</script>
          <div class="charter-body">${fullText}
            <p class="no-result" hidden>${icon('search')}Không tìm thấy nội dung phù hợp. Thử từ khóa khác hoặc gõ không dấu.</p>
          </div>
        </div>
      </div>
    </section>`,
  });
}

// ===== Van ban phap ly =====
{
  const m = metaFor('/van-ban'), crumbs = [['Điều lệ & Văn bản', '/dieu-le'], ['Văn bản pháp lý', null]];
  const td = (label, v) => `<td data-label="${label}">${v}</td>`;
  shell({
    file: 'van-ban.html', path: '/van-ban', active: '/dieu-le', title: 'Văn bản pháp lý', desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs,
    hero: pageHero(crumbs, 'Văn bản pháp lý'),
    body: [
      sec('danh-sach', 'Danh sách văn bản', `<table class="table docs-table"><thead><tr><th scope="col">Số, ký hiệu</th><th scope="col">Ngày</th><th scope="col">Trích yếu</th><th scope="col">Cơ quan</th><th scope="col">Hiệu lực</th><th scope="col">Tệp</th></tr></thead><tbody>
          <tr>${td('Số, ký hiệu', nw(DL.pheDuyet.so))}${td('Ngày', DL.pheDuyet.ngay)}${td('Trích yếu', 'Quyết định về việc phê duyệt Điều lệ (sửa đổi, bổ sung) Liên đoàn Taekwondo Việt Nam')}${td('Cơ quan', 'Bộ Nội vụ')}${td('Hiệu lực', '<span class="status ok">Còn hiệu lực</span>')}${td('Tệp', `<a class="dl" href="${PDF_QD}" target="_blank" rel="noopener">${icon('download')}PDF</a>`)}</tr>
          <tr>${td('Số, ký hiệu', 'Điều lệ')}${td('Ngày', DL.daiHoiThongQua.ngay)}${td('Trích yếu', `Điều lệ (sửa đổi, bổ sung) Liên đoàn Taekwondo Việt Nam – Đại hội nhiệm kỳ ${DL.daiHoiThongQua.nhiemKy} thông qua (8 chương, 29 điều)`)}${td('Cơ quan', 'Đại hội Liên đoàn')}${td('Hiệu lực', '<span class="status ok">Còn hiệu lực</span>')}${td('Tệp', `<a class="dl" href="/dieu-le">${icon('book')}Xem</a> <a class="dl" href="${PDF_DL}" target="_blank" rel="noopener">${icon('download')}PDF</a>`)}</tr>
          <tr class="old">${td('Số, ký hiệu', nw(DL.thayThe.so))}${td('Ngày', DL.thayThe.ngay)}${td('Trích yếu', `Điều lệ Liên đoàn phê duyệt kèm Quyết định số ${nw(DL.thayThe.so)} ngày ${DL.thayThe.ngay}; được thay thế theo ${dieuLink(29, 'Điều 29, khoản 2')} Điều lệ hiện hành`)}${td('Cơ quan', 'Bộ Nội vụ')}${td('Hiệu lực', '<span class="status off">Đã được thay thế</span>')}${td('Tệp', '—')}</tr>
        </tbody></table>${REVIEW_DATE ? `<p class="note">${icon('info')}<span>Tình trạng hiệu lực ghi theo các văn bản Liên đoàn cung cấp, rà soát ngày <time datetime="${REVIEW_DATE}">${viDate(REVIEW_DATE)}</time>.</span></p>` : ''}`),
      sec('can-cu', 'Căn cứ phê duyệt Điều lệ', `<ul class="bullets">
          <li>Luật quy định quyền lập hội ngày 20 tháng 5 năm 1957</li>
          <li>Nghị định số 63/2022/NĐ-CP ngày 12/9/2022 của Chính phủ quy định chức năng, nhiệm vụ, quyền hạn và cơ cấu tổ chức của Bộ Nội vụ</li>
          <li>Nghị định số 45/2010/NĐ-CP ngày 21/4/2010 của Chính phủ quy định về tổ chức, hoạt động và quản lý hội</li>
          <li>Nghị định số 33/2012/NĐ-CP ngày 13/4/2012 của Chính phủ sửa đổi, bổ sung một số điều của Nghị định số 45/2010/NĐ-CP</li>
        </ul>${src(`Quyết định số ${nw(DL.pheDuyet.so)} ngày ${DL.pheDuyet.ngay} của ${DL.pheDuyet.coQuan}`)}`, '', 'alt'),
      sec('van-ban-dai-hoi', `Văn bản ${DH.tenNgan} – môn ${DH.mon}`, `<div class="docs">
          ${dhDocCards()}
        </div>
        <p class="more"><a class="ref" href="${DH_PATH}#ban-to-chuc-trong-tai">Xem Ban Tổ chức, Ban Trọng tài và thông tin thi đấu</a></p>`, `Văn bản của Ban Tổ chức ${esc(DH.ten)} về môn ${esc(DH.mon)} (${dhRange}).`),
    ].join(''),
  });
}

// ===== Tin tuc: danh sach (phan trang) + trang bai =====
{
  const m = metaFor('/tin-tuc'), PER = 9;
  const pages = Math.max(1, Math.ceil(news.length / PER));
  for (let i = 0; i < pages; i++) {
    const list = news.slice(i * PER, (i + 1) * PER);
    const urlPath = i === 0 ? '/tin-tuc' : `/tin-tuc/trang-${i + 1}`;
    const crumbs = i === 0 ? [['Tin tức', null]] : [['Tin tức', '/tin-tuc'], [`Trang ${i + 1}`, null]];
    const pager = pages > 1 ? `<nav class="pager" aria-label="Phân trang">${Array.from({ length: pages }, (_, k) => k === i ? `<span aria-current="page">${k + 1}</span>` : `<a href="${k === 0 ? '/tin-tuc' : `/tin-tuc/trang-${k + 1}`}">${k + 1}</a>`).join('')}</nav>` : '';
    shell({
      file: i === 0 ? 'tin-tuc.html' : `tin-tuc/trang-${i + 1}.html`, path: urlPath, active: '/tin-tuc', title: i === 0 ? 'Tin tức' : `Tin tức – trang ${i + 1}`, desc: m.desc, ogImage: `og-${m.og}.jpg`, crumbs,
      hero: pageHero(crumbs, 'Tin tức'),
      body: sec('tin-lien-doan', 'Tin Liên đoàn', list.length
        ? `<div class="grid g3 news-grid">${list.map(newsCard).join('')}</div>${pager}`
        : `<div class="placeholder">${icon('calendar')}<strong>Chưa có tin bài</strong><p>Tin tức hoạt động của Liên đoàn đang được cập nhật. Trong lúc chờ, bạn có thể đọc <a href="/dieu-le">Điều lệ</a> hoặc tìm hiểu <a href="/hoi-vien#thu-tuc">thủ tục gia nhập</a>.</p><p><a class="ref" href="/rss.xml">${icon('rss')}Theo dõi RSS để nhận tin mới</a></p></div>`),
    });
  }
  for (const n of news) {
    const crumbs = [['Tin tức', '/tin-tuc'], [n.title, null]];
    const artLd = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.title, datePublished: n.date, dateModified: n.date, inLanguage: 'vi-VN', author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, mainEntityOfPage: abs(`/tin-tuc/${n.slug}`), ...(n.image ? { image: [/^https?:\/\//.test(n.image) ? n.image : abs(n.image)] } : {}) };
    shell({
      file: `tin-tuc/${n.slug}.html`, path: `/tin-tuc/${n.slug}`, active: '/tin-tuc', title: n.title, desc: n.summary || clip(n.text, 155), crumbs, extraLd: [artLd], type: 'article', article: { date: n.date },
      ogImage: n.image || 'og-tin-tuc.jpg', ogAlt: n.image ? (n.imageAlt || n.title) : null,
      hero: pageHero(crumbs, n.title, `<time datetime="${n.date}">${viDate(n.date)}</time>${n.category ? ` · ${esc(n.category)}` : ''}`),
      body: `
    <section class="section"><div class="container prose">
      ${n.image ? `<figure class="lead-img"><img src="${esc(n.image)}" alt="${esc(n.imageAlt || '')}" width="1600" height="900"></figure>` : ''}
      ${n.html}
      <p class="more"><a class="ref" href="/tin-tuc">Quay lại danh sách tin</a></p>
    </div></section>`,
    });
  }
}

// ===== Lien he =====
{
  const m = metaFor('/lien-he'), crumbs = [['Liên hệ', null]];
  const row = (k, v) => `<tr><th scope="row">${esc(k)}</th><td>${v || PENDING}</td></tr>`;
  shell({
    // mo ta lay dia chi tu site.json (sua dia chi mot cho la du); chua co dia chi thi dung mo ta chung trong meta.mjs
    desc: cfg.diaChiDuong ? `Liên hệ Liên đoàn Taekwondo Việt Nam: trụ sở ${cfg.diaChiDuong.replace(/^Số /, 'số ')}, ${cfg.truSoThanhPho.replace(/^Thành phố /, 'TP. ')}; điện thoại, email và nơi tiếp nhận hồ sơ hội viên.` : m.desc,
    file: 'lien-he.html', path: '/lien-he', active: '/lien-he', title: 'Liên hệ', ogImage: `og-${m.og}.jpg`, crumbs,
    hero: pageHero(crumbs, 'Liên hệ'),
    body: sec('van-phong', 'Văn phòng Liên đoàn', `<table class="table kv"><tbody>
          ${row('Tên đơn vị', `${esc(cfg.tenTiengViet)} (${esc(cfg.tenTiengAnh)} – ${esc(cfg.tenVietTat)})`)}
          ${row('Trụ sở', cfg.diaChi ? `${esc(cfg.diaChi)}<br><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(cfg.diaChi)}" target="_blank" rel="noopener">${icon('pin')}Xem bản đồ</a>` : `${esc(cfg.truSoThanhPho)} — <em>địa chỉ chi tiết đang cập nhật</em>`)}
          ${cfg.diaChiTiengAnh ? row('Địa chỉ (tiếng Anh)', `<span lang="en">${esc(cfg.diaChiTiengAnh)}</span>`) : ''}
          ${row('Điện thoại', cfg.dienThoai && `<a href="tel:${esc(cfg.dienThoai.replace(/\s/g, ''))}">${esc(cfg.dienThoai)}</a>`)}
          ${row('Email', cfg.email && `<a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>`)}
          ${row('Website', cfg.website && `<a href="${esc(cfg.website)}" target="_blank" rel="noopener">${esc(cfg.website)}</a>`)}
        </tbody></table>
        <div class="grid g2 top">
          <div class="card feature"><span class="feat-ic">${icon('file')}</span><h3>Tiếp nhận hồ sơ hội viên</h3><p>Tổ chức, công dân Việt Nam có đủ điều kiện theo ${dieuLink(9, 'Điều 9')}, có nguyện vọng trở thành hội viên, nộp hồ sơ xin gia nhập tại Văn phòng Liên đoàn (${dieuLink(12, 'Điều 12')}).</p></div>
          <div class="card feature"><span class="feat-ic">${icon('building')}</span><h3>Văn phòng đại diện</h3><p>Việc thành lập văn phòng đại diện của Liên đoàn tại các tỉnh, thành phố trực thuộc Trung ương thực hiện theo quy định của pháp luật (${dieuLink(3, 'Điều 3')}).</p></div>
        </div>`),
  });
}

// ===== Quyen rieng tu (mo ta dung cach website hoat dong) =====
shell({
  file: 'quyen-rieng-tu.html', path: '/quyen-rieng-tu', active: '', title: 'Quyền riêng tư',
  desc: 'Chính sách quyền riêng tư của website Liên đoàn Taekwondo Việt Nam: website không thu thập dữ liệu cá nhân, không dùng cookie theo dõi hay công cụ quảng cáo.',
  crumbs: [['Quyền riêng tư', null]], hero: pageHero([['Quyền riêng tư', null]], 'Quyền riêng tư'),
  body: sec('chinh-sach', 'Website này xử lý dữ liệu như thế nào', `<div class="prose">
          <ul class="bullets">
            <li>Website là trang thông tin: <strong>không có biểu mẫu</strong>, không có đăng nhập dành cho người truy cập, không thu thập họ tên, email hay số điện thoại của người truy cập. Chỉ có một trang quản trị riêng cho người được Liên đoàn giao quyền cập nhật nội dung.</li>
            <li><strong>Không dùng cookie theo dõi</strong>, không cài công cụ quảng cáo hay đo lường của bên thứ ba. Phông chữ được phục vụ trực tiếp từ website, không tải từ dịch vụ bên ngoài.</li>${CMS_ENDPOINT ? `
            <li>Khi mở trang, trình duyệt của bạn tải thêm phần nội dung do Liên đoàn chỉnh sửa từ <strong>Google Apps Script</strong> (script.google.com); ảnh do Liên đoàn đăng có thể được tải từ <strong>Google Drive</strong>, và video (nếu trang có) được nhúng từ <strong>YouTube</strong> (youtube-nocookie.com). Các dịch vụ này có thể ghi nhật ký kỹ thuật (địa chỉ IP, thời gian) theo chính sách của họ; website không gửi cho họ thông tin nào về bạn.</li>` : ''}
            <li>Trình duyệt của bạn chỉ lưu <strong>lựa chọn giao diện sáng/tối</strong> (localStorage) và <strong>bộ nhớ đệm</strong> giúp trang mở nhanh, đọc được khi mất mạng. Bạn có thể xóa trong phần cài đặt trình duyệt.</li>
            <li>Nhà cung cấp lưu trữ website có thể ghi nhật ký truy cập kỹ thuật (địa chỉ IP, thời gian) theo chính sách của họ để vận hành và bảo đảm an toàn dịch vụ.</li>
          </ul>
          <p class="note">${icon('info')}<span>Khi website bổ sung biểu mẫu liên hệ, đăng ký hay công cụ thống kê, chính sách này sẽ được cập nhật trước, bao gồm việc xin đồng ý xử lý dữ liệu cá nhân theo quy định của pháp luật.</span></p>
        </div>`),
});

// ===== 404 + trang ngoai tuyen =====
shell({
  file: '404.html', path: '/404', active: '', title: 'Không tìm thấy trang', noindex: true,
  desc: 'Trang bạn tìm không có trên website Liên đoàn Taekwondo Việt Nam.',
  hero: pageHero([['Không tìm thấy trang', null]], 'Không tìm thấy trang'),
  body: sec('khong-tim-thay', 'Trang không tồn tại', `<p>Đường dẫn có thể đã thay đổi hoặc bị gõ sai. Bạn có thể thử:</p><ul class="bullets links"><li><a href="/">Trang chủ</a></li><li><a href="/dieu-le">Toàn văn Điều lệ</a> (có ô tìm kiếm)</li><li><a href="/hoi-vien">Thông tin hội viên</a></li></ul>`),
});
shell({
  file: 'offline.html', path: '/offline', active: '', title: 'Đang ngoại tuyến', noindex: true,
  desc: 'Không có kết nối mạng.',
  hero: pageHero([['Ngoại tuyến', null]], 'Bạn đang ngoại tuyến'),
  body: sec('ngoai-tuyen', 'Không có kết nối mạng', `<p>Trang này chưa được lưu để đọc khi mất mạng. Các trang bạn đã mở trước đó vẫn xem được; hãy kết nối lại để tải trang mới.</p><p class="more"><a class="btn btn-red" href="/">Về trang chủ</a></p>`),
});

// ===== Trang quan tri /admin.html: sua moi chu, anh, lien ket, video; xem truoc truc tiep; luu vao Google Sheet (Apps Script). Khong vao sitemap, noindex =====
{
  const pagesJson = JSON.stringify(built.map(b => ({ path: b.path, title: b.title }))).replace(/</g, '\\u003c');
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quản trị website | ${esc(cfg.tenTiengViet)}</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#0B1F4D">
  ${LOGO ? '<link rel="icon" type="image/png" sizes="48x48" href="/img/favicon-48.png">' : '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'}
  <link rel="stylesheet" href="/${ADMIN_CSS}">
  <script>window.__VTF_CMS_NOBOOT = true;</script>
  <script src="/${CMS_FILE}"></script>
  <script defer src="/${ADMIN_JS}" data-endpoint="${esc(CMS_ENDPOINT)}" data-base="${BASE}" data-logo="${LOGO_URL ? BASE + LOGO_URL : ''}"></script>
</head>
<body>
  <div id="app"><p class="ad-loading">Đang tải trang quản trị…</p></div>
  <noscript><p class="ad-loading">Trang quản trị cần bật JavaScript.</p></noscript>
  <script type="application/json" id="cms-pages">${pagesJson}</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(DIST, 'admin.html'), BASE ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`) : html, 'utf8');
}

// ---------------- sitemap, robots, RSS, manifest, service worker ----------------
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${built.map(b => `  <url><loc>${xmlEsc(abs(b.path))}</loc>${b.lastmod ? `<lastmod>${b.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`, 'utf8');
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${abs('/sitemap.xml')}\n`, 'utf8');
const rfc822 = iso => new Date(iso + 'T08:00:00+07:00').toUTCString();
fs.writeFileSync(path.join(DIST, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Tin tức – ${xmlEsc(cfg.tenTiengViet)}</title>
  <link>${xmlEsc(abs('/tin-tuc'))}</link>
  <atom:link href="${xmlEsc(abs('/rss.xml'))}" rel="self" type="application/rss+xml"/>
  <description>Tin tức hoạt động của ${xmlEsc(cfg.tenTiengViet)}</description>
  <language>vi-vn</language>
  <lastBuildDate>${rfc822(BUILD_DATE)}</lastBuildDate>
${news.slice(0, 30).map(n => `  <item><title>${xmlEsc(n.title)}</title><link>${xmlEsc(abs(`/tin-tuc/${n.slug}`))}</link><guid isPermaLink="true">${xmlEsc(abs(`/tin-tuc/${n.slug}`))}</guid><pubDate>${rfc822(n.date)}</pubDate><description>${xmlEsc(n.summary || clip(n.text, 300))}</description></item>`).join('\n')}
</channel>
</rss>
`, 'utf8');
fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify({
  name: cfg.tenTiengViet, short_name: cfg.tenVietTat, description: metaFor('/').desc, lang: 'vi', dir: 'ltr',
  start_url: `${BASE}/`, scope: `${BASE}/`, display: 'standalone', background_color: '#ffffff', theme_color: '#0B1F4D',
  icons: [
    { src: `${BASE}/img/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${BASE}/img/icon-512.png`, sizes: '512x512', type: 'image/png' },
    { src: `${BASE}/img/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2), 'utf8');
const PRECACHE_FILES = ['/', '/offline', `/${CSS_FILE}`, `/${JS_FILE}`, '/fonts/be-vietnam-pro-400-latin.woff2', '/fonts/be-vietnam-pro-400-vietnamese.woff2', '/fonts/be-vietnam-pro-800-latin.woff2', '/fonts/be-vietnam-pro-800-vietnamese.woff2',
  ...(LOGO ? new Set([LOGO.url, LOGO_DARK.url, '/img/favicon-48.png']) : ['/favicon.svg'])]; // logo: trang ngoai tuyen van co dau trang day du
const PRECACHE = PRECACHE_FILES.map(p => BASE + p);
// Phien ban service worker = ma bam noi dung moi tep no luu (ca logo, icon, trang chu, trang ngoai tuyen):
// doi logo/dia chi cung ngay van day ban moi toi nguoi da tung vao web (tep /img/ duoc phuc vu tu bo nho dem truoc)
const swHash = crypto.createHash('sha1').update(HASH);
for (const p of PRECACHE_FILES) swHash.update(fs.readFileSync(path.join(DIST, p === '/' ? 'index.html' : p === '/offline' ? 'offline.html' : p.slice(1))));
for (const f of fs.readdirSync(path.join(DIST, 'img')).sort()) swHash.update(f).update(fs.readFileSync(path.join(DIST, 'img', f)));
const SW_VERSION = swHash.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sw.js'), fs.readFileSync(path.join(HERE, 'src', 'sw.js'), 'utf8')
  .replace(/__VERSION__/g, () => SW_VERSION).replace(/__BASE__/g, () => BASE).replace('"__PRECACHE__"', () => JSON.stringify(PRECACHE)), 'utf8');

// cau hinh Vercel: vercel.json o goc (Vercel build tu GitHub) la nguon duy nhat; ban trong dist/ (tai thang len Vercel) bo cac lenh build
const { buildCommand: _b, installCommand: _i, outputDirectory: _o, framework: _f, ...vercelServe } = JSON.parse(fs.readFileSync(path.join(HERE, 'vercel.json'), 'utf8'));
fs.writeFileSync(path.join(DIST, 'vercel.json'), JSON.stringify(vercelServe, null, 2), 'utf8');
fs.writeFileSync(path.join(DIST, '.nojekyll'), '', 'utf8');

console.log(JSON.stringify({ out: path.relative(HERE, DIST) || '.', base: BASE || '/', siteUrl: SITE_URL, hash: HASH, pages: built.map(b => b.path), news: news.length }, null, 1));
