// emulator.mjs - chay NGUYEN VAN apps-script/Code.gs trong Node voi ban mo phong dich vu Google (Sheet, Drive, Properties, Cache, Lock...).
// Dung de kiem thu may chu khong can tai khoan Google: apps-script/test.mjs, check.mjs (kiem thu admin voi may chu that), va chay thu tai may:
//   node apps-script/emulator.mjs 8790      -> http://localhost:8790/exec  (CMS_ENDPOINT cho build thu)
// Tuy chon createBackend({ standalone: true }): script doc lap (khong gan voi Sheet nao) nhu khi tao tai script.google.com.
// Tuy chon createBackend({ seedForms: false }): khong dung san thu muc/tep du lieu dang ky (de thu truong hop thieu tep).
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
const hex = n => crypto.randomBytes(n).toString('hex');
const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };

export function createBackend({ source, standalone = false, seedForms = true } = {}) {
  const clock = { now: Date.parse('2026-10-28T03:00:00Z') };
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.now); } static now() { return clock.now; } }
  const props = new Map(), cache = new Map(), files = new Map(), folders = new Map(), sheets = new Map();
  const drive = new Map(), books = new Map();
  const state = { props, files, sheets, folders, uploads: [], clock, drive, books };

  const makeSheet = name => {
    const rows = [], fmt = new Map(); let maxRows = 1000, frozen = 0;
    const get = (r, c) => (rows[r - 1] && rows[r - 1][c - 1] !== undefined ? rows[r - 1][c - 1] : '');
    const sh = {
      name, rows, fmt, formats: new Set(),
      getName: () => name, setFrozenRows: n => { frozen = n; },
      getMaxRows: () => maxRows, insertRowsAfter: (after, n) => { maxRows += n; },
      getLastRow: () => { let l = 0; rows.forEach((r, i) => { if (r && r.some(v => v !== '' && v !== undefined)) l = i + 1; }); return l; },
      getLastColumn: () => { let l = 0; rows.forEach(r => { if (r) r.forEach((v, j) => { if (v !== '' && v !== undefined) l = Math.max(l, j + 1); }); }); return l; },
      appendRow: vals => { const l = sh.getLastRow(); if (l + 1 > maxRows) maxRows = l + 1; rows[l] = vals.slice(); },
      deleteRows: (start, n) => { rows.splice(start - 1, n); },
      getRange: (r, c, nr = 1, nc = 1) => {
        if (r < 1 || c < 1 || r + nr - 1 > maxRows) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
        const put = (i, j, v) => { rows[r - 1 + i] = rows[r - 1 + i] || []; rows[r - 1 + i][c - 1 + j] = v; };
        return {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))),
          setValues: vals => { vals.forEach((row, i) => row.forEach((v, j) => put(i, j, v))); },
          setValue: v => { put(0, 0, v); },
          clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows[r - 1 + i]) rows[r - 1 + i][c - 1 + j] = ''; },
          setNumberFormat: f => { for (let i = 0; i < nr; i++) fmt.set(r + i, f); },
        };
      },
    };
    return sh;
  };
  // mot "bang tinh": id, cac sheet (Map ten -> sheet). Sheet dau tien la sheet mac dinh.
  const makeBook = (name, sheetMap = new Map(), firstName = 'Sheet1') => {
    if (!sheetMap.size && firstName) sheetMap.set(firstName, makeSheet(firstName));
    const id = 'S' + hex(12), b = {
      id, name, sheetMap, getId: () => id, getName: () => name,
      getSheets: () => [...sheetMap.values()],
      getSheetByName: n => sheetMap.get(n) || null,
      insertSheet: n => { const s = makeSheet(n); sheetMap.set(n, s); return s; },
    };
    books.set(id, b); return b;
  };
  const cmsBook = makeBook('(script gan Sheet)', sheets, null);

  // ---- Drive: nut thu muc / tep, cha - con, quyen chia se tung tep (PRIVATE / ANYONE / ANYONE_WITH_LINK)
  const addNode = n => { drive.set(n.id, n); return n; };
  const ROOT = addNode({ id: 'root', name: 'My Drive', type: 'folder', parent: null, access: 'PRIVATE' });
  const fileObj = n => ({
    getId: () => n.id, getName: () => n.name, getSharingAccess: () => n.access,
    setSharing: (a, p) => { n.access = a; n.sharing = [a, p]; },
    moveTo: dest => { n.parent = dest.getId(); },
  });
  const folderObj = n => ({
    getId: () => n.id, getName: () => n.name,
    getFoldersByName: name => iter([...drive.values()].filter(x => x.type === 'folder' && x.parent === n.id && x.name === name).map(folderObj)),
    getFilesByName: name => iter([...drive.values()].filter(x => x.type === 'file' && x.parent === n.id && x.name === name).map(fileObj)),
    createFolder: name => { const f = addNode({ id: 'F' + hex(8), name, type: 'folder', parent: n.id, access: 'PRIVATE' }); folders.set(f.id, f); return folderObj(f); },
    createFile: blob => {
      const rec = addNode({ id: 'D' + hex(12), name: blob.getName(), type: 'file', parent: n.id, access: 'PRIVATE', mime: blob.getContentType(), bytes: blob.getBytes(), sharing: null });
      files.set(rec.id, rec); state.uploads.push(rec);
      return fileObj(rec);
    },
  });

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
  const sandbox = {
    Date: FakeDate, Utilities, console,
    PropertiesService: { getScriptProperties: () => scriptProps },
    CacheService: { getScriptCache: () => scriptCache },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, mime: 'text/plain', setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (standalone ? null : cmsBook),
      openById: id => { const b = books.get(id); if (!b) throw new Error('Khong mo duoc bang tinh ' + id); return b; },
      create: name => {
        // lan tao dau tien cua script doc lap la Sheet noi dung (CFG.CMS_FILE): dung chung bo sheet cua cmsBook de test doc duoc
        const b = standalone && name === sandbox.CFG.CMS_FILE && !drive.has(cmsBook.id) ? (cmsBook.name = name, cmsBook) : makeBook(name);
        addNode({ id: b.id, name, type: 'file', parent: 'root', access: 'PRIVATE', book: b });
        return b;
      },
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE', PRIVATE: 'PRIVATE', DOMAIN: 'DOMAIN' }, Permission: { VIEW: 'VIEW' },
      getRootFolder: () => folderObj(ROOT),
      createFolder: name => folderObj(ROOT).createFolder(name),
      getFolderById: id => { const n = drive.get(id); if (!n || n.type !== 'folder') throw new Error('Not found'); return folderObj(n); },
      getFileById: id => { const n = drive.get(id); if (!n || n.type !== 'file') throw new Error('Not found'); return fileObj(n); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source || buildGs(), sandbox, { filename: 'Code.gs' });
  const call = (fn, ...a) => vm.runInContext(fn, sandbox)(...a);

  // dung san thu muc Web_VTF (cong khai) + thu muc con RIENG TU + 3 tep du lieu nhu tren Drive that (moi tep chi chu so huu truy cap)
  const seed = () => {
    const web = addNode({ id: sandbox.CFG.WEB_FOLDER_ID, name: 'Web_VTF', type: 'folder', parent: 'root', access: 'ANYONE' });
    const priv = addNode({ id: 'F' + hex(8), name: sandbox.CFG.PRIVATE_FOLDER, type: 'folder', parent: web.id, access: 'PRIVATE' });
    const out = { web, priv, files: {} };
    for (const [k, spec] of Object.entries(sandbox.DK)) {
      const b = makeBook(spec.title, new Map(), 'Untitled');
      b.getSheets()[0].rows[0] = spec.head.slice();
      out.files[k] = addNode({ id: b.id, name: spec.title, type: 'file', parent: priv.id, access: 'PRIVATE', book: b });
    }
    return out;
  };
  const seeded = seedForms ? seed() : null;
  if (!seedForms) addNode({ id: sandbox.CFG.WEB_FOLDER_ID, name: 'Web_VTF', type: 'folder', parent: 'root', access: 'ANYONE' });
  state.seed = seeded;

  const api = {
    state, clock, call, sandbox,
    advance: ms => { clock.now += ms; },
    // goi truc tiep nhu Apps Script: tra ve chuoi/JSON that
    get: (params = {}) => JSON.parse(sandbox.doGet({ parameter: params }).getContent()),
    getRaw: (params = {}) => sandbox.doGet({ parameter: params }).getContent(),
    post: body => JSON.parse(sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body), type: 'text/plain' } }).getContent()),
    setup: () => sandbox.setup(),
    // dong du lieu cua mot loai bieu mau (hoivien | lienhe | nhantin), bo dong tieu de: [{ 'Tieu de cot': gia tri }]
    forms(kind) {
      const n = seeded ? seeded.files[kind] : [...drive.values()].find(x => x.type === 'file' && x.name === sandbox.DK[kind].title);
      if (!n) return null;
      const sh = n.book.getSheets()[0], head = sh.rows[0] || [];
      return sh.rows.slice(1).filter(r => r && r.some(v => v !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
    },
    formSheet(kind) { const n = seeded.files[kind]; return n.book.getSheets()[0]; },
    formFile(kind) { return seeded.files[kind]; },
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
