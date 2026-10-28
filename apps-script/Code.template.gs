/**
 * VTF CMS - may chu luu tru cho trang quan tri (admin.html) cua website Lien doan Taekwondo Viet Nam.
 *   - Noi dung chinh sua luu trong Google Sheet gan voi script nay (sheet "noi-dung"; "lich-su" ghi moi thay doi; "nhat-ky" ghi dang nhap).
 *   - Anh tai len luu trong thu muc Google Drive "VTF CMS - anh" (chia se "ai co lien ket"), xem duoc tren web.
 *   - Dang nhap: tai khoan + mat khau (chi luu dau bam), phien 12 gio, khoa 15 phut sau 5 lan sai. Chi vai tro "admin" vao duoc.
 * Cai dat tung buoc: apps-script/HUONG-DAN.md.
 * TEP NAY DO apps-script/make-gs.mjs TAO TU Code.template.gs + src/cms-sanitize.js. SUA O HAI TEP NGUON ROI CHAY LAI, DUNG SUA TRUC TIEP.
 */

/*@SANITIZE@*/

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
