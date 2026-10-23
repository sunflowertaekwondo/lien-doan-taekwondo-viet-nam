// og.mjs - sinh anh chia se mang xa hoi (1200x630, moi trang 1 anh) va icon ung dung (PWA) vao src/generated/
// Dung logo chinh thuc khi data/site.json co "logo"/"logoNenToi" (tep trong src/), neu chua co thi dung chu VTF.
// Font Be Vietnam Pro tu host. Chay tren may: node tools/og.mjs
// (can Chrome; dat CHROME_PATH neu khac duong dan mac dinh)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGES } from '../src/meta.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'src', 'generated');
fs.mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const fontsCss = fs.readFileSync(path.join(ROOT, 'src', 'fonts', 'fonts.css'), 'utf8')
  .replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (m, f) => `url("${pathToFileURL(path.join(ROOT, 'src', 'fonts', f)).href}")`);
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const logoFile = key => { if (!cfg[key]) return null; const f = path.join(ROOT, 'src', path.basename(cfg[key])); if (!fs.existsSync(f)) throw new Error(`Khong thay src/${path.basename(cfg[key])}`); return pathToFileURL(f).href; };
const LOGO = logoFile('logo'), LOGO_DARK = logoFile('logoNenToi') || LOGO;

const ogHtml = (title) => `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><style>${fontsCss}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:"Be Vietnam Pro",sans-serif;color:#fff;overflow:hidden;position:relative;
 background:radial-gradient(900px 420px at 88% -10%,rgba(29,78,216,.6),transparent 60%),linear-gradient(120deg,#0B1F4D 0%,#12306F 60%,#1A3E8F 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:48px 48px}
.ring{position:absolute;right:-150px;bottom:-190px;width:560px;height:560px;border-radius:50%;border:72px solid rgba(218,37,29,.28)}
.in{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:18px}
.lg{height:118px;width:auto;display:block}
.mark{width:96px;height:80px;border-radius:18px;background:#DA251D;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:34px;letter-spacing:2px;box-shadow:inset 0 -5px 0 rgba(0,0,0,.15)}
.name strong{display:block;font-size:30px;font-weight:800}.name span{font-size:20px;font-weight:700;letter-spacing:4px;color:#ffb4ae;text-transform:uppercase}
h1{margin-top:auto;font-size:${title.length > 22 ? 76 : 92}px;line-height:1.2;font-weight:800;letter-spacing:-2px;max-width:960px}
.foot{margin-top:28px;font-size:22px;color:#c7d4ff;font-weight:600;letter-spacing:1px}
.bar{position:absolute;left:0;bottom:0;height:12px;width:100%;background:linear-gradient(90deg,#DA251D 0 70%,#F4B400 70%)}
</style></head><body><div class="grid"></div><div class="ring"></div><div class="in">
<div class="brand">${LOGO_DARK ? `<img class="lg" src="${LOGO_DARK}" alt="">` : `<div class="mark">${esc(cfg.tenVietTat)}</div>`}<div class="name"><strong>Liên đoàn Taekwondo</strong><span>Việt Nam</span></div></div>
<h1>${esc(title)}</h1><p class="foot">${esc(cfg.tenTiengAnh)} · ${esc(cfg.tenVietTat)}</p></div><div class="bar"></div></body></html>`;

const iconHtml = (size, pad) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fontsCss}
*{margin:0}body{width:${size}px;height:${size}px;background:${pad ? '#0B1F4D' : 'transparent'};display:flex;align-items:center;justify-content:center}
.m{width:${pad ? size * 0.62 : size}px;height:${pad ? size * 0.62 : size}px;border-radius:${size * (pad ? 0.12 : 0.2)}px;background:#DA251D;color:#fff;display:flex;align-items:center;justify-content:center;
font-family:"Be Vietnam Pro",sans-serif;font-weight:800;font-size:${(pad ? size * 0.62 : size) * 0.36}px;letter-spacing:${size * 0.01}px;box-shadow:inset 0 -${size * 0.03}px 0 rgba(0,0,0,.15)}
</style></head><body><div class="m">${esc(cfg.tenVietTat)}</div></body></html>`;

// mode: any (o vuong trang bo goc, nen trong suot), maskable/apple (phu nen trang, chua vung an toan),
// fav (chi phan bieu tuong V-nguoi-F, bo dong chu "VIETNAM TAEKWONDO FEDERATION" vi o 16-48px chi con la vet mo)
// MARK: vung bieu tuong trong tep logo (do tu kenh trong suot cua VTF-logo-transparent.png 1182x482)
const MARK = { x: 130, y: 0, w: 946, h: 440, W: 1182 };
const logoIconHtml = (size, mode) => {
  const s = size * 0.96 / MARK.w;
  // vung MARK chi dung cho dung tep logo da do; doi logo khac thi favicon dung ca logo
  const img = mode === 'fav' && cfg.logo && path.basename(cfg.logo) === 'VTF-logo-transparent.png'
    ? `<div style="width:${MARK.w * s}px;height:${MARK.h * s}px;overflow:hidden"><img src="${LOGO}" alt="" style="width:${MARK.W * s}px;margin:${-MARK.y * s}px 0 0 ${-MARK.x * s}px"></div>`
    : `<img src="${LOGO}" alt="">`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0}body{width:${size}px;height:${size}px;background:${mode === 'any' || mode === 'fav' ? 'transparent' : '#fff'};display:flex;align-items:center;justify-content:center}
.m{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${mode === 'any' ? `background:#fff;border-radius:${size * 0.2}px;` : ''}}
img{width:${size * ({ any: 0.84, maskable: 0.66, apple: 0.82, fav: 1 })[mode]}px;height:auto;display:block;max-width:none}
</style></head><body><div class="m">${img}</div></body></html>`;
};

const b = await chromium.launch({ executablePath: CHROME, headless: true });
const tmp = path.join(os.tmpdir(), `vtf-og-${process.pid}.html`); // thu muc tam cua may: o dia dong bo (pCloud) hay khoa tep ghi lien tuc
async function render(html, w, h, file, transparent = false) {
  fs.writeFileSync(tmp, html, 'utf8');
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images, i => i.decode().catch(() => {}))]));
  const jpg = file.endsWith('.jpg');
  await page.screenshot({ path: path.join(OUT, file), ...(jpg ? { type: 'jpeg', quality: 85 } : { omitBackground: transparent }) });
  await page.close();
}
for (const p of PAGES) await render(ogHtml(p.ogTitle), 1200, 630, `og-${p.og}.jpg`);
await render(ogHtml('Liên đoàn Taekwondo Việt Nam'), 1200, 630, 'og-default.jpg');
if (LOGO) {
  await render(logoIconHtml(192, 'any'), 192, 192, 'icon-192.png', true);
  await render(logoIconHtml(512, 'any'), 512, 512, 'icon-512.png', true);
  await render(logoIconHtml(512, 'maskable'), 512, 512, 'icon-maskable-512.png');
  await render(logoIconHtml(180, 'apple'), 180, 180, 'apple-touch-icon.png');
  await render(logoIconHtml(48, 'fav'), 48, 48, 'favicon-48.png', true);
} else {
  await render(iconHtml(192, false), 192, 192, 'icon-192.png', true);
  await render(iconHtml(512, false), 512, 512, 'icon-512.png', true);
  await render(iconHtml(512, true), 512, 512, 'icon-maskable-512.png');
  await render(iconHtml(180, true), 180, 180, 'apple-touch-icon.png');
  fs.rmSync(path.join(OUT, 'favicon-48.png'), { force: true });
}
await b.close();
fs.rmSync(tmp, { force: true });
console.log(fs.readdirSync(OUT).map(f => `${f} ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)}KB`).join('\n'));
