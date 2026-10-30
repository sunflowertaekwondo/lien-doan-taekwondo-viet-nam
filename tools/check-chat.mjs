// check-chat.mjs - kiem tra tro ly ao LinhKate; check.mjs goi checkChat(). Gom: tim noi dung, may chu (Kira gia), giao dien that tren trinh duyet, an nut khi chua co khoa, va (neu chay tren website that) thu mot cau hoi that.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

async function startSite(HERE, env) {
  const port = await freePort();
  const child = spawn(process.execPath, ['serve.mjs'], { cwd: HERE, env: { ...process.env, PORT: String(port), ...env }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break; } catch { /* chua len */ } await new Promise(r => setTimeout(r, 150)); }
  return { port, url: `http://localhost:${port}`, stop: () => child.kill() };
}

export async function checkChat({ b, BASE, HERE, check, errors }) {
  const dist = path.join(HERE, 'dist');
  const { runEval } = await import('./chat-eval.mjs');
  const { runApiTests } = await import('./test-chat.mjs');

  // 1) co so kien thuc + tim kiem
  const kbPath = path.join(dist, 'chat-kb.json');
  const kb = fs.existsSync(kbPath) ? JSON.parse(fs.readFileSync(kbPath, 'utf8')) : { chunks: [] };
  const pages = new Set(kb.chunks.map(c => c.p));
  check('Trợ lý LinhKate: cơ sở kiến thức chứa toàn bộ trang, có liên hệ Văn phòng và hình ảnh', kb.chunks.length >= 100 && ['/', '/hoi-vien', '/lich-thi-dau', '/dieu-le', '/van-ban', '/lien-he', '/co-cau-to-chuc'].every(p => pages.has(p)) && kb.site?.dienThoai && kb.chunks.some(c => c.i.length), `${kb.chunks.length} đoạn, ${pages.size} trang`);
  const ev = runEval(dist);
  check(`Trợ lý LinhKate: tìm đúng trang cho ${ev.total} câu hỏi mẫu (≥ 90%)`, ev.hit >= Math.ceil(ev.total * 0.9), ev.fails.slice(0, 3).join(' | ') || `${ev.hit}/${ev.total}`);

  // 2) may chu voi Kira AI gia
  const api = await runApiTests({ dist });
  const bad = api.filter(r => !r[1]);
  check(`Trợ lý LinhKate: máy chủ /api/chat đạt ${api.length - bad.length}/${api.length} kiểm tra (khóa bí mật, giới hạn, lọc HTML, lỗi Kira, liên kết/hình ảnh)`, bad.length === 0, bad.map(r => r[0]).slice(0, 3).join(' | '));

  // 3) giao dien that tren trinh duyet, co Kira gia
  const site = await startSite(HERE, { CHAT_MOCK: '1' });
  const off = await startSite(HERE, { KIRA_API_KEY: '', CHAT_MOCK: '' });
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const hosts = new Set();
    page.on('request', r => { const u = new URL(r.url()); if (/^https?:/.test(u.protocol)) hosts.add(u.host); });
    page.on('pageerror', e => errors.push(`chat ${e.message}`));
    await page.goto(site.url + '/hoi-vien', { waitUntil: 'load' });
    await page.waitForSelector('.chat-fab', { timeout: 8000 });
    const fabName = await page.getAttribute('.chat-fab', 'aria-label');
    await page.click('.chat-fab');
    await page.waitForSelector('#chat-panel:not([hidden])');
    const dlg = await page.evaluate(() => { const p = document.getElementById('chat-panel'); return { role: p.getAttribute('role'), name: p.getAttribute('aria-label'), focus: document.activeElement?.className, chips: document.querySelectorAll('.chat-chip').length, log: document.querySelector('.chat-log').getAttribute('role'), hello: document.querySelector('.chat-msg.bot')?.textContent }; });
    check('Trợ lý LinhKate: nút "Hỏi LinhKate" có tên truy cập; khung chat là hộp thoại, tự đặt con trỏ vào ô nhập, có câu chào và gợi ý', /LinhKate/.test(fabName || '') && dlg.role === 'dialog' && /LinhKate/.test(dlg.name) && /chat-in/.test(dlg.focus || '') && dlg.chips === 4 && dlg.log === 'log' && /em là LinhKate, thư ký VTF/.test(dlg.hello || ''), JSON.stringify(dlg));
    await page.click('.chat-chip:nth-child(3)');
    await page.waitForSelector('.chat-msg.bot:not(.chat-typing) .chat-src', { timeout: 8000 });
    const a1 = await page.evaluate(() => ({ bots: document.querySelectorAll('.chat-msg.bot').length, text: document.querySelector('.chat-msg.bot:last-child')?.textContent || '', hrefs: [...document.querySelectorAll('.chat-msg.bot:last-child .chat-src a')].map(a => a.getAttribute('href')), typing: !!document.querySelector('.chat-typing') }));
    check('Trợ lý LinhKate: bấm gợi ý → LinhKate trả lời xưng "em", kèm liên kết tới trang Liên hệ, hết hiệu ứng "đang soạn"', /LinhKate/.test(a1.text) && a1.hrefs.some(h => h.startsWith('/lien-he')) && !a1.typing, JSON.stringify(a1.hrefs));
    await page.waitForTimeout(1300);   // giới hạn phía khách: tối thiểu 1,2 giây giữa hai câu hỏi
    await page.fill('.chat-in', 'Kỷ niệm chương 30 năm của Liên đoàn là gì?');
    await page.press('.chat-in', 'Enter');
    await page.waitForSelector('.chat-msg.bot .chat-imgs img', { timeout: 8000 });
    const im = await page.evaluate(async () => { const i = document.querySelector('.chat-msg.bot .chat-imgs img'); await i.decode().catch(() => {}); return { alt: i.alt, w: i.naturalWidth, a: i.closest('a').getAttribute('href') }; });
    check('Trợ lý LinhKate: hình ảnh liên quan lấy từ website hiển thị được, có chú thích và liên kết về trang chứa hình', im.w > 0 && im.alt.length > 10 && im.a.startsWith('/'), JSON.stringify(im));
    // an toan: ma doc trong cau hoi khong thanh phan tu HTML; loi may chu khong lam hong lich su
    await page.waitForFunction(() => !document.querySelector('.chat-typing') && !document.querySelector('.chat-send').disabled);
    await page.waitForTimeout(1300);
    await page.fill('.chat-in', '<img src=x onerror="window.__xss=1"> LOI500');
    await page.press('.chat-in', 'Enter');
    await page.waitForFunction(() => document.querySelectorAll('.chat-msg.bot').length >= 4 && !document.querySelector('.chat-typing'), null, { timeout: 8000 });
    const x = await page.evaluate(() => ({ xss: window.__xss === 1, imgInUser: document.querySelectorAll('.chat-msg.me img').length, last: document.querySelector('.chat-msg.bot:last-child')?.textContent || '', users: [...document.querySelectorAll('.chat-msg.me')].map(m => m.textContent).pop() }));
    check('Trợ lý LinhKate: mã độc trong câu hỏi không chạy (textContent); Kira lỗi 500 → báo lịch sự kèm liên hệ Văn phòng', !x.xss && x.imgInUser === 0 && /<img/.test(x.users) && /Văn phòng/.test(x.last), JSON.stringify({ ...x, last: x.last.slice(0, 60) }));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => ({ hidden: document.getElementById('chat-panel').hidden, focus: document.activeElement?.className }));
    check('Trợ lý LinhKate: phím Esc đóng khung chat và trả con trỏ về nút mở', closed.hidden && /chat-fab/.test(closed.focus), JSON.stringify(closed));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.chat-fab');
    await page.click('.chat-fab');
    const kept = await page.evaluate(() => ({ me: document.querySelectorAll('.chat-msg.me').length, bot: document.querySelectorAll('.chat-msg.bot').length }));
    check('Trợ lý LinhKate: lịch sử trò chuyện giữ lại khi tải lại trang (trong phiên), câu lỗi không đưa vào lịch sử gửi Kira', kept.me >= 2 && kept.bot >= 3, JSON.stringify(kept));
    const foreign = [...hosts].filter(h => !/^localhost:/.test(h) && !/kaspersky-labs|kis\.v2\.scr/.test(h) && !/^script\.google(usercontent)?\.com$/.test(h));   // bo qua may chu noi dung (Apps Script) va phan mem diet virus tu chen
    check('Trợ lý LinhKate: trình duyệt chỉ nói chuyện với chính website (không gọi thẳng kiraai.vn, khóa không lộ ra trình duyệt)', foreign.length === 0, foreign.join(', ') || 'chỉ localhost');
    const html = await (await fetch(site.url + '/assets/' + fs.readdirSync(path.join(dist, 'assets')).find(f => /^chat\./.test(f)))).text();
    check('Trợ lý LinhKate: mã trình duyệt không chứa khóa API hay địa chỉ Kira', !/kira_|kiraai|Bearer|api[_-]?key/i.test(html) && !/KIRA_API_KEY|kira_[A-Za-z0-9]{10,}/.test(fs.readdirSync(dist).filter(f => f.endsWith('.html')).map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('')));
    await ctx.close();

    // dien thoai: khung chat tran man hinh, khong tran ngang
    const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mp = await mctx.newPage();
    mp.on('pageerror', e => errors.push(`chat-mobile ${e.message}`));
    await mp.goto(site.url + '/', { waitUntil: 'load' });
    await mp.waitForSelector('.chat-fab');
    await mp.tap('.chat-fab');
    await mp.waitForSelector('#chat-panel:not([hidden])');
    const m = await mp.evaluate(() => { const r = document.getElementById('chat-panel').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth, fabHidden: document.querySelector('.chat-fab').hidden, font: getComputedStyle(document.querySelector('.chat-in')).fontSize }; });
    check('Trợ lý LinhKate: điện thoại 390px — khung chat phủ kín màn hình, không tràn ngang, ô nhập cỡ 16px (không bị zoom trên iPhone)', m.w === m.vw && m.h === m.vh && !m.over && m.font === '16px', JSON.stringify(m));
    await mctx.close();

    // chua co khoa API: khong hien nut chat
    const octx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const op = await octx.newPage();
    op.on('pageerror', e => errors.push(`chat-off ${e.message}`));
    const ready = await (await fetch(off.url + '/api/chat')).json();
    await op.goto(off.url + '/', { waitUntil: 'load' });
    await op.waitForTimeout(2500);
    check('Trợ lý LinhKate: khi chưa cài khóa API (ready=false) website không hiện nút chat và không báo lỗi', ready.ready === false && (await op.locator('.chat-fab').count()) === 0, JSON.stringify(ready));
    await octx.close();
  } finally { site.stop(); off.stop(); }

  // 4) tren website dang chay: may chu chat co tra loi khong; (chi khi da cai khoa) thu 1 cau hoi that
  const r0 = await fetch(BASE + '/chat-kb.json');
  const live = r0.ok ? await r0.json() : { chunks: [] };
  check('Trợ lý LinhKate: website đang chạy phục vụ cơ sở kiến thức (chat-kb.json)', r0.ok && live.chunks.length >= 100, `${live.chunks.length} đoạn`);
  const g = await fetch(BASE + '/api/chat');
  const gj = g.ok ? await g.json().catch(() => null) : null;
  const isLocal = /^http:\/\/localhost/.test(BASE);
  if (!isLocal) {
    check(`Trợ lý LinhKate: /api/chat trên website thật trả lời (ready=${gj?.ready})`, g.ok && typeof gj?.ready === 'boolean', `HTTP ${g.status}`);
    if (gj?.ready) {
      const r = await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: new URL(BASE).origin }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Văn phòng Liên đoàn ở địa chỉ nào?' }] }) });
      const j = await r.json().catch(() => ({}));
      check('Trợ lý LinhKate: câu hỏi thật tới Kira AI → trả lời tiếng Việt lễ phép, không lộ dòng NGUỒN, có liên kết liên quan', r.ok && j.ok && /Dạ|anh\/chị|\bem\b/.test(j.answer) && !/Khệt|NGUỒN/.test(j.answer) && j.answer.length > 30 && j.sources?.length > 0, JSON.stringify(j).slice(0, 220));
    }
  }
}
