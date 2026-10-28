// emulator.mjs - chay NGUYEN VAN apps-script/Code.gs trong Node voi ban mo phong dich vu Google (Sheet, Drive, Properties, Cache, Lock...).
// Dung de kiem thu may chu khong can tai khoan Google: apps-script/test.mjs, check.mjs (kiem thu admin voi may chu that), va chay thu tai may:
//   node apps-script/emulator.mjs 8790      -> http://localhost:8790/exec  (CMS_ENDPOINT cho build thu)
import vm from 'node:vm';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildGs } from './make-gs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const signed = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));
const unsigned = a => Buffer.from(a.map(b => (b + 256) % 256));
const toBuf = v => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Array.isArray(v) ? unsigned(v) : Buffer.from(v));

export function createBackend({ source } = {}) {
  const clock = { now: Date.parse('2026-10-28T03:00:00Z') };
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.now); } static now() { return clock.now; } }
  const props = new Map(), cache = new Map(), files = new Map(), folders = new Map(), sheets = new Map();
  const state = { props, files, sheets, folders, uploads: [], clock };

  const makeSheet = name => {
    const rows = []; let maxRows = 1000, frozen = 0;
    const get = (r, c) => (rows[r - 1] && rows[r - 1][c - 1] !== undefined ? rows[r - 1][c - 1] : '');
    const sh = {
      name, rows, formats: new Set(),
      getName: () => name, setFrozenRows: n => { frozen = n; },
      getMaxRows: () => maxRows, insertRowsAfter: (after, n) => { maxRows += n; },
      getLastRow: () => { let l = 0; rows.forEach((r, i) => { if (r && r.some(v => v !== '')) l = i + 1; }); return l; },
      appendRow: vals => { const l = sh.getLastRow(); if (l + 1 > maxRows) maxRows = l + 1; rows[l] = vals.slice(); },
      deleteRows: (start, n) => { rows.splice(start - 1, n); },
      getRange: (r, c, nr = 1, nc = 1) => {
        if (r < 1 || c < 1 || r + nr - 1 > maxRows) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
        return {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))),
          setValues: vals => { vals.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; }); }); },
          clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows[r - 1 + i]) rows[r - 1 + i][c - 1 + j] = ''; },
          setNumberFormat: () => {},
        };
      },
    };
    return sh;
  };
  const ss = {
    getSheetByName: n => sheets.get(n) || null,
    insertSheet: n => { const s = makeSheet(n); sheets.set(n, s); return s; },
  };

  const Utilities = {
    getUuid: () => crypto.randomUUID(),
    newBlob: (data, mime, name) => { const b = toBuf(data); return { getBytes: () => signed(b), getDataAsString: () => b.toString('utf8'), getContentType: () => mime || 'text/plain', getName: () => name || '' }; },
    computeHmacSha256Signature: (value, key) => signed(crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest()),
    base64Encode: v => toBuf(v).toString('base64'),
    base64EncodeWebSafe: v => toBuf(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64Decode: s => { if (/[^A-Za-z0-9+/=\s]/.test(s)) throw new Error('Invalid base64'); return signed(Buffer.from(s, 'base64')); },
    base64DecodeWebSafe: s => signed(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
    sleep: () => {},
    formatDate: (d, tz, fmt) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
      return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
    },
    Charset: { UTF_8: 'UTF-8' },
  };
  const scriptProps = {
    getProperty: k => (props.has(k) ? props.get(k) : null),
    setProperty: (k, v) => { props.set(k, String(v)); },
    setProperties: o => { for (const k in o) props.set(k, String(o[k])); },
    deleteProperty: k => { props.delete(k); },
  };
  const scriptCache = {
    get: k => { const e = cache.get(k); if (!e) return null; if (e.exp < clock.now) { cache.delete(k); return null; } return e.v; },
    put: (k, v, sec = 600) => { cache.set(k, { v: String(v), exp: clock.now + sec * 1000 }); },
    remove: k => { cache.delete(k); },
  };
  const makeFolder = name => {
    const id = 'F' + crypto.randomBytes(8).toString('hex'), f = { getId: () => id, name, createFile: blob => {
      const fid = 'D' + crypto.randomBytes(12).toString('hex'), rec = { id: fid, name: blob.getName(), mime: blob.getContentType(), bytes: blob.getBytes(), sharing: null };
      files.set(fid, rec); state.uploads.push(rec);
      return { getId: () => fid, setSharing: (a, p) => { rec.sharing = [a, p]; } };
    } };
    folders.set(id, f); return f;
  };
  const sandbox = {
    Date: FakeDate, Utilities, console,
    PropertiesService: { getScriptProperties: () => scriptProps },
    CacheService: { getScriptCache: () => scriptCache },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, mime: 'text/plain', setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    DriveApp: { Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' }, createFolder: makeFolder, getFolderById: id => { const f = folders.get(id); if (!f) throw new Error('Not found'); return f; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source || buildGs(), sandbox, { filename: 'Code.gs' });
  const call = (fn, ...a) => vm.runInContext(fn, sandbox)(...a);

  const api = {
    state, clock, call, sandbox,
    advance: ms => { clock.now += ms; },
    // goi truc tiep nhu Apps Script: tra ve chuoi/JSON that
    get: (params = {}) => JSON.parse(sandbox.doGet({ parameter: params }).getContent()),
    getRaw: (params = {}) => sandbox.doGet({ parameter: params }).getContent(),
    post: body => JSON.parse(sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body), type: 'text/plain' } }).getContent()),
    setup: () => sandbox.setup(),
    // tao tai khoan quan tri bang chinh ham bam cua Code.gs (khong luu mat khau thuong)
    hashFor: (pass, salt) => call('hashPw_', pass, salt),
    seedAdmin(user, pass, role = 'admin') {
      const salt = crypto.randomUUID(), hash = api.hashFor(pass, salt);
      if (role === 'admin') sandbox.datTaiKhoan(user, salt, hash);
      else { const u = JSON.parse(props.get('USERS') || '[]').filter(x => x.u !== user); u.push({ u: user, s: salt, h: hash, r: role }); props.set('USERS', JSON.stringify(u)); }
    },
    // dang nhap -> token
    login: (user, pass) => api.post({ action: 'login', user, pass }),
    // cho Playwright route: mo phong giong Apps Script (CORS *, luon 200)
    async http(method, url, bodyText) {
      const u = new URL(url, 'http://x');
      const out = method === 'POST' ? sandbox.doPost({ postData: { contents: bodyText || '', type: 'text/plain' } }) : sandbox.doGet({ parameter: Object.fromEntries(u.searchParams) });
      return { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }, body: out.getContent() };
    },
  };
  return api;
}

// ---- chay doc lap: node apps-script/emulator.mjs [cong]  (tai khoan thu: bien moi truong EMU_USER, EMU_PASS)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +process.argv[2] || 8790, emu = createBackend();
  emu.setup(); emu.seedAdmin(process.env.EMU_USER || 'admin', process.env.EMU_PASS || 'matkhau-thu-123');
  http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }); return res.end(); }
    const r = await emu.http(req.method, req.url, Buffer.concat(chunks).toString('utf8'));
    res.writeHead(r.status, r.headers); res.end(r.body);
  }).listen(port, () => console.log(`Emulator Apps Script: http://localhost:${port}/exec  (tai khoan ${process.env.EMU_USER || 'admin'})`));
}
