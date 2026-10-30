// mock-kira.mjs - may chu Kira AI "gia" (chuan OpenAI /chat/completions) de kiem thu tro ly LinhKate ma khong ton tien that.
// Dung: node tools/mock-kira.mjs [cong]   hoac import { startMockKira } tu tests.
// Hanh vi: sai khoa -> 401; cau hoi co "LOI500" -> 500; "LOI429" -> 429; "CHAM" -> tre 3 giay; "KHONGNGUON" -> khong co dong NGUON;
//          con lai tra loi mau co xung ho "em", trich doan [1] cua ngu canh va ket thuc bang "NGUON: 1, 2".
import http from 'node:http';

export const MOCK_KEY = 'test-key-khong-phai-khoa-that';

export function startMockKira(port = 0) {
  const calls = [], counters = new Map();
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', d => { raw += d; });
    req.on('end', () => {
      const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
      if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url)) return json(404, { error: { message: 'not found', code: 'not_found' } });
      if (req.headers.authorization !== `Bearer ${MOCK_KEY}`) return json(401, { error: { message: 'Invalid API key', type: 'invalid_request_error', code: 'invalid_api_key' } });
      let body; try { body = JSON.parse(raw); } catch { return json(400, { error: { message: 'bad json' } }); }
      calls.push(body);
      const sys = body.messages.find(m => m.role === 'system')?.content || '';
      const q = body.messages[body.messages.length - 1]?.content || '';
      if (/LOI402/.test(q)) return json(402, { error: { message: 'Insufficient VND wallet balance', type: 'insufficient_quota', code: 'vnd_balance_exhausted' } });
      if (/BIAMAIL/.test(q)) return json(200, { choices: [{ message: { role: 'assistant', content: 'Dạ anh/chị liên hệ số 028 3824 9999 hoặc email giamdoc@vtf-gia.vn. Em cũng xin gửi https://vtf-gia.example/ky-thi ạ. Văn phòng ở số 219 Lý Thường Kiệt.\nNGUỒN: 1' } }] });
      const once = k => { const n = (counters.get(k + q) || 0) + 1; counters.set(k + q, n); return n === 1; };
      if (/RONGMOT/.test(q) && once('r')) return json(200, { choices: [{ message: { role: 'assistant', content: '' } }] });
      if (/LOI500/.test(q)) return json(500, { error: { message: 'upstream exploded', code: 'server_error' } });
      if (/LOI429/.test(q)) return json(429, { error: { message: 'rate limit', code: 'rate_limit' } });
      if (/HTMLTAG/.test(q)) return json(200, { choices: [{ message: { role: 'assistant', content: 'Dạ <b>chào</b> anh<script>alert(1)</script> <img src=x onerror=alert(2)>\nNGUỒN: không' } }] });
      const first = /\[1\] [^\n]*\n([^\n]+)/.exec(sys);
      const answer = `Dạ, em là LinhKate, thư ký VTF. ${first ? first[1].slice(0, 120) : 'Em chưa thấy thông tin này trên website.'}`;
      const tail = /KHONGNGUON/.test(q) ? '' : `\nNGUỒN: ${first ? '1, 2' : 'không'}`;
      const reply = () => json(200, { id: 'mock', object: 'chat.completion', model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: answer + tail }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } });
      if (/CHAMMOT/.test(q)) { if (once('c')) setTimeout(reply, 4000); else reply(); } else if (/CHAM/.test(q)) setTimeout(reply, 3000); else reply();
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, calls, port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) })));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const m = await startMockKira(Number(process.argv[2] || 8791));
  console.log(`Kira gia: ${m.url}/api/v1 (khoa: ${MOCK_KEY})`);
}
