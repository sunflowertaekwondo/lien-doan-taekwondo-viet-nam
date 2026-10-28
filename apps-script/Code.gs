/**
 * VTF CMS - may chu luu tru cho trang quan tri (admin.html) cua website Lien doan Taekwondo Viet Nam.
 *   - Noi dung chinh sua luu trong Google Sheet gan voi script nay (sheet "noi-dung"; "lich-su" ghi moi thay doi; "nhat-ky" ghi dang nhap).
 *   - Anh tai len luu trong thu muc Google Drive "VTF CMS - anh" (chia se "ai co lien ket"), xem duoc tren web.
 *   - Dang nhap: tai khoan + mat khau (chi luu dau bam), phien 12 gio, khoa 15 phut sau 5 lan sai. Chi vai tro "admin" vao duoc.
 * Cai dat tung buoc: apps-script/HUONG-DAN.md.
 * TEP NAY DO apps-script/make-gs.mjs TAO TU Code.template.gs + src/cms-sanitize.js. SUA O HAI TEP NGUON ROI CHAY LAI, DUNG SUA TRUC TIEP.
 */

// ---------------------------------------------------------------- bo loc noi dung (nguon: src/cms-sanitize.js)
var CMSAN = (function () {
  'use strict';
  // the cho phep: b i u span a br (strong/em duoc doi thanh b/i). Moi the khac bi thoat thanh chu thuong, khong bao gio thanh the that.
  var TAGS = { b: 'b', i: 'i', u: 'u', span: 'span', a: 'a', br: 'br', strong: 'b', em: 'i' };
  var MAX_HTML = 20000, MAX_DEPTH = 8;
  var CLS_RE = /^[A-Za-z0-9_ -]{1,80}$/;
  var ENT_RE = /&(?!(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g;

  function ctl(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); }
  function escText(s) { return s.replace(ENT_RE, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---- lien ket: http(s), mailto, tel, hoac duong dan tuong doi. Chan javascript:, data:, vbscript:, //host, khoang trang/ky tu dieu khien
  function link(u) {
    u = String(u == null ? '' : u).trim();
    if (!u || u.length > 2000) return '';
    u = u.replace(/&amp;/g, '&');
    if (/&[#a-zA-Z0-9]+;/.test(u)) return ''; // thuc the HTML con lai co the ghep thanh "javascript:" -> tu choi
    if (/[\u0000-\u001F\u007F\u0080-\u009F\s"'<>\\`]/.test(u)) return '';
    if (/^\/\//.test(u)) return '';
    var m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(u);
    if (m && ['http', 'https', 'mailto', 'tel'].indexOf(m[1].toLowerCase()) < 0) return '';
    if (m && /^https?$/i.test(m[1]) && !/^https?:\/\/[^\/?#]+/i.test(u)) return '';
    return u;
  }
  // anh: chi http(s)
  function img(u) { var x = link(u); return /^https?:\/\/[^\/?#]+/i.test(x) ? x : ''; }
  // video: chi YouTube (watch, youtu.be, shorts, embed, live) -> ma 11 ky tu
  function ytId(u) {
    u = String(u == null ? '' : u).trim();
    if (!u || u.length > 500 || /[\s"'<>\\`]/.test(u)) return '';
    var m = /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\/(.+)$/i.exec(u);
    if (!m) return '';
    var host = m[1].toLowerCase(), rest = m[2], id = '';
    if (host === 'youtu.be') id = rest.split(/[?#\/]/)[0];
    else {
      var p = /^(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[?#\/].*)?$/.exec(rest);
      if (p) id = p[1];
      else { var w = /^watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})(?:[&#].*)?$/.exec(rest); if (w) id = w[1]; }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  }
  function ytEmbed(u) { var id = ytId(u); return id ? 'https://www.youtube-nocookie.com/embed/' + id : ''; }

  // ---- chu thuan (khong the): dung cho alt, tieu de, o van ban don
  function plain(s, max, keepSpace) {
    s = ctl(s).replace(/<[^<>]*>/g, '').replace(/[<>]/g, '');
    if (!keepSpace) s = s.trim();
    return s.slice(0, max || 2000);
  }

  // ---- HTML an toan: chi b i u span a br. Tach theo the, kiem tung the, thoat het phan con lai.
  function html(input) {
    var s = ctl(input);
    if (s.length > MAX_HTML) s = s.slice(0, MAX_HTML);
    var parts = s.split(/(<[^<>]*>)/), out = '', stack = [];
    for (var k = 0; k < parts.length; k++) {
      var tok = parts[k];
      if (!tok) continue;
      if (k % 2 === 0) { out += escText(tok); continue; }
      var m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\/][^<>]*)?>$/.exec(tok);
      var name = m && TAGS[m[2].toLowerCase()];
      if (!name) { out += escText(tok); continue; }
      if (m[1]) { // the dong: chi dong the dang mo (dong luon cac the nam giua)
        var at = stack.lastIndexOf(name);
        if (at < 0) {
          var swallow = stack.lastIndexOf('x' + m[2].toLowerCase());
          if (swallow >= 0 && swallow === stack.length - 1) stack.pop();
          continue;
        }
        while (stack.length > at) { var t = stack.pop(); if (t.charAt(0) !== 'x') out += '</' + t + '>'; }
        continue;
      }
      if (name === 'br') { out += '<br>'; continue; }
      var attrs = (m[3] || '').replace(/\/\s*$/, ''), at2 = {}, re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g, a;
      while ((a = re.exec(attrs))) at2[a[1].toLowerCase()] = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : '';
      if (stack.length >= MAX_DEPTH) continue;
      var cls = at2['class'] !== undefined && CLS_RE.test(at2['class']) ? ' class="' + escAttr(at2['class']) + '"' : '';
      if (name === 'a') {
        var href = link(at2.href);
        if (!href) { stack.push('x' + m[2].toLowerCase()); continue; } // the a khong hop le: bo the, giu chu
        out += '<a href="' + escAttr(href) + '"' + cls + (String(at2.target || '').toLowerCase() === '_blank' ? ' target="_blank" rel="noopener"' : '') + '>';
        stack.push('a');
      } else if (name === 'span') { out += '<span' + cls + '>'; stack.push('span'); }
      else { out += '<' + name + '>'; stack.push(name); }
    }
    while (stack.length) { var t2 = stack.pop(); if (t2.charAt(0) !== 'x') out += '</' + t2 + '>'; }
    return out;
  }

  // ---- khoa va loai gia tri. Khoa do cms-core.js sinh ra; ham nay chi de may chu va trinh duyet cung kiem tra
  var KEY_RE = /^[A-Za-z0-9_\-#>.\[\]\/:@~]{1,400}$/;
  var ID_RE = /^[oin][A-Za-z0-9_-]{1,64}$/;
  function kindOf(key) {
    var m = /@([a-z]+)\d*$/.exec(key);
    if (!m) return 'html';
    return { href: 'href', src: 'src', alt: 'alt', video: 'video', mt: 'mt', md: 'md', t: 't' }[m[1]] || '';
  }
  function clean(kind, v) {
    v = String(v == null ? '' : v);
    switch (kind) {
      case 'html': return html(v);
      case 't': return plain(v, 5000, true);
      case 'alt': return plain(v, 500);
      case 'mt': return plain(v, 300);
      case 'md': return plain(v, 500);
      case 'href': return link(v);
      case 'src': return img(v);
      case 'video': return ytEmbed(v);
    }
    return '';
  }
  function hash(s) { // FNV-1a 32 bit -> base36: dau van tay noi dung goc, de phat hien noi dung goc da doi
    var h = 0x811c9dc5; s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return h.toString(36);
  }
  // du lieu quan tri gui len: { fields: {khoa: {v, o}}, lists: {khoa: {c, items: [{id, t}]}} } -> ban da loc (bo muc khong hop le)
  function cleanData(fields, lists, limits) {
    var max = (limits && limits.maxFields) || 6000, out = { fields: {}, lists: {} }, n = 0, k;
    fields = fields && typeof fields === 'object' ? fields : {};
    lists = lists && typeof lists === 'object' ? lists : {};
    for (k in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, k) || !KEY_RE.test(k)) continue;
      var kd = kindOf(k), f = fields[k], v = kd ? clean(kd, f && f.v) : '';
      if (v === '') continue;
      if (++n > max) throw new Error('Qua nhieu muc chinh sua (toi da ' + max + ')');
      var o = f && typeof f.o === 'string' && /^[a-z0-9]{1,8}$/.test(f.o) ? f.o : '';
      out.fields[k] = o ? { v: v, o: o } : { v: v };
    }
    for (k in lists) {
      if (!Object.prototype.hasOwnProperty.call(lists, k) || !KEY_RE.test(k)) continue;
      var l = lists[k];
      if (!l || !Array.isArray(l.items) || l.items.length > 500) continue;
      var items = [], seen = {};
      for (var i = 0; i < l.items.length; i++) {
        var it = l.items[i];
        if (!it || !ID_RE.test(String(it.id)) || seen[it.id]) continue;
        seen[it.id] = 1;
        items.push(it.t !== undefined && ID_RE.test(String(it.t)) ? { id: String(it.id), t: String(it.t) } : { id: String(it.id) });
      }
      var c = parseInt(l.c, 10);
      if (!(c >= 0 && c <= 5000)) continue;
      out.lists[k] = { c: c, items: items };
    }
    return out;
  }

  return { html: html, plain: plain, link: link, img: img, ytId: ytId, ytEmbed: ytEmbed, kindOf: kindOf, clean: clean, hash: hash, cleanData: cleanData, KEY_RE: KEY_RE, ID_RE: ID_RE };
})();


var VERSION = '1';
var CFG = {
  ITER: 1000, TOKEN_HOURS: 12, MAX_FIELDS: 6000, MAX_IMG_BYTES: 4 * 1024 * 1024, MAX_BODY: 7000000,
  SHEET: 'noi-dung', LOG: 'nhat-ky', HIST: 'lich-su', FOLDER: 'VTF CMS - anh',
  FAIL_MAX: 5, LOCK_SEC: 900, MIN_PASS: 8, TZ: 'Asia/Ho_Chi_Minh'
};
var HEAD = ['khoa', 'loai', 'gia-tri', 'goc', 'cap-nhat'];

// ============================================================ cai dat (chay tay mot lan)
/** Buoc 1: tao cac sheet, thu muc anh va khoa phien. An toan khi chay lai. */
function setup() {
  var p = P_();
  if (!p.getProperty('TOKEN_SECRET')) p.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('REV')) p.setProperty('REV', '0');
  sheet_(CFG.SHEET, HEAD);
  sheet_(CFG.LOG, ['thoi-gian', 'tai-khoan', 'thao-tac', 'chi-tiet']);
  sheet_(CFG.HIST, ['phien-ban', 'thoi-gian', 'tai-khoan', 'khoa', 'cu', 'moi']);
  folder_();
  return 'Da cai dat xong. Buoc tiep theo: chay datTaiKhoanAdmin, roi Trien khai > Ung dung web.';
}
/** Tao hoac ghi de tai khoan quan tri. Chi nhan dau bam (khong co mat khau thuong): xem apps-script/make-account.mjs. */
function datTaiKhoan(user, salt, hash) { setUser_(String(user).toLowerCase(), String(salt), String(hash), 'admin'); }

// ============================================================ web app
function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || 'content';
    if (a === 'content') return ContentService.createTextOutput(contentJson_()).setMimeType(ContentService.MimeType.JSON);
    if (a === 'ping') return json_({ ok: true, version: VERSION, ready: !!P_().getProperty('TOKEN_SECRET') && users_().length > 0 });
    return json_(err_('bad_action', 'Thao tác không hợp lệ.'));
  } catch (x) { return json_(err_('server', 'Lỗi máy chủ.')); }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > CFG.MAX_BODY) return json_(err_('too_big', 'Dữ liệu quá lớn.'));
    var b = JSON.parse(raw);
    if (!b || typeof b !== 'object') return json_(err_('bad_request', 'Yêu cầu không hợp lệ.'));
    if (b.action === 'login') return json_(login_(b));
    var u = auth_(b.token);
    if (!u) return json_(err_('unauthorized', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'));
    switch (b.action) {
      case 'whoami': return json_({ ok: true, user: u.u, rev: rev_(), version: VERSION });
      case 'save': return json_(save_(b, u));
      case 'upload': return json_(upload_(b, u));
      case 'passwd': return json_(passwd_(b, u));
    }
    return json_(err_('bad_action', 'Thao tác không hợp lệ.'));
  } catch (x) { return json_(err_('server', 'Lỗi máy chủ: ' + (x && x.message))); }
}

// ============================================================ tien ich
function P_() { return PropertiesService.getScriptProperties(); }
function now_() { return new Date().getTime(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code, message) { return { ok: false, code: code, message: message }; }
function rev_() { return parseInt(P_().getProperty('REV') || '0', 10); }
function stamp_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function same_(a, b) { // so sanh khong ro ri thoi gian
  a = String(a); b = String(b);
  var r = a.length ^ b.length;
  for (var i = 0; i < a.length && i < b.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function ss_() {
  var s = SpreadsheetApp.getActiveSpreadsheet();
  if (!s) { var id = P_().getProperty('SHEET_ID'); if (!id) throw new Error('Chua gan Google Sheet'); s = SpreadsheetApp.openById(id); }
  return s;
}
function sheet_(name, head) {
  var s = ss_(), sh = s.getSheetByName(name);
  if (!sh) { sh = s.insertSheet(name); if (head) { sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); } }
  return sh;
}
function ensureRows_(sh, n) { var m = sh.getMaxRows(); if (m < n) sh.insertRowsAfter(m, n - m); }
function folder_() {
  var p = P_(), id = p.getProperty('FOLDER_ID'), f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) { f = DriveApp.createFolder(CFG.FOLDER); p.setProperty('FOLDER_ID', f.getId()); }
  return f;
}
function log_(user, action, detail) {
  try { var sh = sheet_(CFG.LOG, ['thoi-gian', 'tai-khoan', 'thao-tac', 'chi-tiet']); sh.appendRow([stamp_(), user, action, String(detail || '').slice(0, 300)]); } catch (e) { /* khong de loi nhat ky chan thao tac chinh */ }
}

// ============================================================ tai khoan, phien
function users_() { try { return JSON.parse(P_().getProperty('USERS') || '[]'); } catch (e) { return []; } }
function setUser_(user, salt, hash, role) {
  var users = users_().filter(function (u) { return u.u !== user; });
  users.push({ u: user, s: salt, h: hash, r: role || 'admin' });
  P_().setProperty('USERS', JSON.stringify(users));
}
function hashPw_(pass, salt) { // HMAC-SHA256 lap ITER lan, theo muoi rieng cua tai khoan
  var key = Utilities.newBlob(String(salt)).getBytes();
  var d = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(pass)).getBytes(), key);
  for (var i = 1; i < CFG.ITER; i++) d = Utilities.computeHmacSha256Signature(d, key);
  return Utilities.base64Encode(d);
}
function mkToken_(u) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify({ u: u.u, e: now_() + CFG.TOKEN_HOURS * 3600000, p: String(u.h).slice(0, 10) }), Utilities.Charset.UTF_8);
  return body + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, P_().getProperty('TOKEN_SECRET')));
}
function auth_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2 || !P_().getProperty('TOKEN_SECRET')) return null;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], P_().getProperty('TOKEN_SECRET')));
  if (!same_(sig, parts[1])) return null;
  var pl;
  try { pl = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (e) { return null; }
  if (!pl || !(pl.e > now_())) return null;
  var u = users_().filter(function (x) { return x.u === pl.u; })[0];
  if (!u || u.r !== 'admin' || String(u.h).slice(0, 10) !== pl.p) return null; // doi mat khau lam cac phien cu het hieu luc
  return u;
}
function login_(b) {
  var user = String(b.user || '').trim().toLowerCase(), pass = String(b.pass || '');
  if (!user || !pass || user.length > 100 || pass.length > 200) return err_('bad_request', 'Nhập tài khoản và mật khẩu.');
  var cache = CacheService.getScriptCache(), fk = 'fail:' + user;
  var n = parseInt(cache.get(fk) || '0', 10), all = parseInt(cache.get('fail:*') || '0', 10);
  if (n >= CFG.FAIL_MAX || all >= CFG.FAIL_MAX * 8) return err_('locked', 'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.');
  var u = users_().filter(function (x) { return x.u === user; })[0];
  var ok = same_(hashPw_(pass, u ? u.s : 'x'), u ? u.h : '-');
  if (!u || !ok) {
    cache.put(fk, String(n + 1), CFG.LOCK_SEC); cache.put('fail:*', String(all + 1), CFG.LOCK_SEC);
    Utilities.sleep(400); log_(user, 'dang-nhap-sai', '');
    return err_('bad_login', 'Sai tài khoản hoặc mật khẩu.');
  }
  if (u.r !== 'admin') return err_('forbidden', 'Tài khoản này không có quyền quản trị.');
  cache.remove(fk); log_(user, 'dang-nhap', '');
  return { ok: true, token: mkToken_(u), user: u.u, hours: CFG.TOKEN_HOURS, rev: rev_() };
}
function passwd_(b, u) {
  var np = String(b.pass || '');
  if (!same_(hashPw_(String(b.old || ''), u.s), u.h)) { Utilities.sleep(400); return err_('bad_login', 'Mật khẩu hiện tại không đúng.'); }
  if (np.length < CFG.MIN_PASS || np.length > 200) return err_('weak', 'Mật khẩu mới tối thiểu ' + CFG.MIN_PASS + ' ký tự.');
  var salt = Utilities.getUuid();
  setUser_(u.u, salt, hashPw_(np, salt), u.r);
  log_(u.u, 'doi-mat-khau', '');
  return { ok: true, message: 'Đã đổi mật khẩu. Hãy đăng nhập lại.' };
}

// ============================================================ noi dung
function readAll_() {
  var sh = sheet_(CFG.SHEET, HEAD), n = sh.getLastRow(), fields = {}, lists = {};
  if (n > 1) {
    var rows = sh.getRange(2, 1, n - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) { // loc lai khi doc: sua truc tiep trong Sheet cung khong lam hong trang
      var k = String(rows[i][0]), kind = String(rows[i][1]), v = String(rows[i][2]), o = String(rows[i][3] || '');
      if (!CMSAN.KEY_RE.test(k)) continue;
      if (kind === 'list') {
        try { var one = {}; one[k] = JSON.parse(v); var cd = CMSAN.cleanData({}, one); if (cd.lists[k]) lists[k] = cd.lists[k]; } catch (e) { /* bo qua dong hong */ }
      } else {
        var kd = CMSAN.kindOf(k), cv = kd ? CMSAN.clean(kd, v) : '';
        if (cv) fields[k] = /^[a-z0-9]{1,8}$/.test(o) ? { v: cv, o: o } : { v: cv };
      }
    }
  }
  return { fields: fields, lists: lists };
}
function contentJson_() {
  var cache = CacheService.getScriptCache(), c = cache.get('content');
  if (c) return c;
  var out = readAll_(); out.ok = true; out.rev = rev_();
  var s = JSON.stringify(out);
  if (s.length < 90000) cache.put('content', s, 21600);
  return s;
}
function save_(b, u) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var cur = rev_();
    if (parseInt(b.rev, 10) !== cur) return { ok: false, code: 'conflict', message: 'Nội dung vừa được lưu từ nơi khác. Hãy tải lại trang quản trị.', rev: cur };
    var data;
    try { data = CMSAN.cleanData(b.fields, b.lists, { maxFields: CFG.MAX_FIELDS }); } catch (e) { return err_('too_big', 'Quá nhiều mục chỉnh sửa (tối đa ' + CFG.MAX_FIELDS + ').'); }
    var old = readAll_(), at = stamp_(), nrev = cur + 1, rows = [], hist = [], keys = {}, k;
    for (k in data.fields) keys[k] = 1; for (k in data.lists) keys[k] = 1; for (k in old.fields) keys[k] = 1; for (k in old.lists) keys[k] = 1;
    Object.keys(keys).sort().forEach(function (key) {
      var isList = !!(data.lists[key] || old.lists[key]) && !(data.fields[key] || old.fields[key]);
      var nv = isList ? data.lists[key] : data.fields[key], ov = isList ? old.lists[key] : old.fields[key];
      var ns = nv ? JSON.stringify(isList ? nv : nv.v) : '', os = ov ? JSON.stringify(isList ? ov : ov.v) : '';
      if (nv) rows.push([key, isList ? 'list' : 'field', isList ? JSON.stringify(nv) : nv.v, !isList && nv.o ? nv.o : '', at]);
      if (ns !== os && hist.length < 300) hist.push([nrev, at, u.u, key, os.slice(0, 500), ns.slice(0, 500)]);
    });
    var sh = sheet_(CFG.SHEET, HEAD), last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, 5).clearContent();
    if (rows.length) { ensureRows_(sh, rows.length + 1); var rg = sh.getRange(2, 1, rows.length, 5); rg.setNumberFormat('@'); rg.setValues(rows); }
    if (hist.length) {
      var hs = sheet_(CFG.HIST, ['phien-ban', 'thoi-gian', 'tai-khoan', 'khoa', 'cu', 'moi']), hl = hs.getLastRow();
      ensureRows_(hs, hl + hist.length); var hg = hs.getRange(hl + 1, 1, hist.length, 6); hg.setNumberFormat('@'); hg.setValues(hist);
      if (hs.getLastRow() > 4000) hs.deleteRows(2, hs.getLastRow() - 3000);
    }
    P_().setProperty('REV', String(nrev));
    CacheService.getScriptCache().remove('content');
    log_(u.u, 'luu', 'phien ban ' + nrev + ': ' + Object.keys(data.fields).length + ' truong, ' + Object.keys(data.lists).length + ' khoi lap, ' + hist.length + ' thay doi');
    return { ok: true, rev: nrev, fields: data.fields, lists: data.lists, changed: hist.length };
  } finally { lock.releaseLock(); }
}

// ============================================================ anh
function magicOk_(bytes, mime) {
  var g = function (i) { return (bytes[i] + 256) % 256; };
  if (mime === 'image/jpeg') return g(0) === 0xFF && g(1) === 0xD8 && g(2) === 0xFF;
  if (mime === 'image/png') return g(0) === 0x89 && g(1) === 0x50 && g(2) === 0x4E && g(3) === 0x47;
  if (mime === 'image/gif') return g(0) === 0x47 && g(1) === 0x49 && g(2) === 0x46 && g(3) === 0x38;
  if (mime === 'image/webp') return g(0) === 0x52 && g(1) === 0x49 && g(2) === 0x46 && g(3) === 0x46 && g(8) === 0x57 && g(9) === 0x45 && g(10) === 0x42 && g(11) === 0x50;
  return false;
}
function upload_(b, u) {
  var mime = String(b.mime || '').toLowerCase(), ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
  if (!ext) return err_('bad_type', 'Chỉ nhận ảnh JPG, PNG, WebP, GIF.');
  var bytes;
  try { bytes = Utilities.base64Decode(String(b.data || '')); } catch (e) { return err_('bad_data', 'Ảnh không đọc được.'); }
  if (!bytes.length || bytes.length > CFG.MAX_IMG_BYTES) return err_('too_big', 'Ảnh quá lớn (tối đa 4 MB).');
  if (!magicOk_(bytes, mime)) return err_('bad_data', 'Tệp không phải ảnh hợp lệ.');
  var base = String(b.name || 'anh').replace(/\.[A-Za-z0-9]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'anh';
  var name = Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd-HHmmss') + '-' + base + '.' + ext;
  var f = folder_().createFile(Utilities.newBlob(bytes, mime, name));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  log_(u.u, 'tai-anh', name + ' (' + bytes.length + ' byte)');
  return { ok: true, url: 'https://lh3.googleusercontent.com/d/' + f.getId(), name: name };
}
