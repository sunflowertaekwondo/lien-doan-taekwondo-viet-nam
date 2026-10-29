// redirect-pages.mjs - tao ban "chi chuyen huong" cho GitHub Pages: moi duong dan cua dia chi github.io chuyen sang ten mien chinh.
// GitHub Pages khong co chuyen huong may chu nen dung meta refresh + JavaScript (giu duong dan, ?query, #muc); Google coi la chuyen huong vinh vien.
// Dung:  node tools/redirect-pages.mjs <thu-muc-ra> <duong-dan-goc-cua-pages, vd /lien-doan-taekwondo-viet-nam> <dia-chi-dich, vd https://tkdai.vn>
// Tao index.html + 404.html (404.html bat moi duong dan khong ton tai, ke ca lien ket sau cua website cu).
import fs from 'node:fs';
import path from 'node:path';

const [out, base = '', target = ''] = process.argv.slice(2);
if (!out || !/^https:\/\/[a-z0-9.-]+$/i.test(target) || (base && !/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(base))) {
  console.error('Dung: node tools/redirect-pages.mjs <thu-muc-ra> </duong-dan-goc | ""> <https://ten-mien>'); process.exit(1);
}
const page = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Liên đoàn Taekwondo Việt Nam</title>
<meta http-equiv="refresh" content="0; url=${target}/">
<link rel="canonical" href="${target}/">
<script>
(function () {
  var b = ${JSON.stringify(base)}, p = location.pathname;
  if (b && p.indexOf(b) === 0) p = p.slice(b.length);
  location.replace(${JSON.stringify(target)} + (p || '/') + location.search + location.hash);
})();
</script>
<style>body{font:18px/1.6 system-ui,sans-serif;max-width:34rem;margin:20vh auto;padding:0 1rem;color:#0F172A}a{color:#1E40AF}</style>
</head>
<body>
<p>Website Liên đoàn Taekwondo Việt Nam đã chuyển sang địa chỉ duy nhất: <a href="${target}/">${target.replace('https://', '')}</a>.</p>
</body>
</html>
`;
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', '404.html']) fs.writeFileSync(path.join(out, f), page, 'utf8');
fs.writeFileSync(path.join(out, '.nojekyll'), '', 'utf8');
console.log(`Da tao ${out}/index.html va 404.html: ${base || '/'}* -> ${target}/*`);
