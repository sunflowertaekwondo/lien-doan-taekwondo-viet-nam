/**
 * VTF CMS - may chu luu tru cho trang quan tri (admin.html) cua website Lien doan Taekwondo Viet Nam.
 *   - Noi dung chinh sua luu trong Google Sheet gan voi script nay (sheet "noi-dung"; "lich-su" ghi moi thay doi; "nhat-ky" ghi dang nhap).
 *   - Anh tai len luu trong thu muc Google Drive "VTF CMS - anh" (chia se "ai co lien ket"), xem duoc tren web.
 *   - Dang nhap: tai khoan + mat khau (chi luu dau bam), phien 12 gio, khoa 15 phut sau 5 lan sai. Chi vai tro "admin" vao duoc.
 *   - Bieu mau cong khai (hoi vien, lien he, nhan tin): ghi vao 3 Google Sheet RIENG TU trong thu muc "Du lieu dang ky (RIENG TU)" cua thu muc Web_VTF.
 *     Script TU CHOI ghi neu tep dang duoc chia se cong khai, va khong bao gio tao tep du lieu ca nhan o thu muc cong khai.
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
  ITER: 200, TOKEN_HOURS: 12, MAX_FIELDS: 6000, MAX_IMG_BYTES: 4 * 1024 * 1024, MAX_BODY: 7000000,
  SHEET: 'noi-dung', LOG: 'nhat-ky', HIST: 'lich-su', FOLDER: 'VTF CMS - anh', CMS_FILE: 'VTF - Nội dung website',
  FAIL_MAX: 5, LOCK_SEC: 900, MIN_PASS: 8, TZ: 'Asia/Ho_Chi_Minh',
  // thu muc luu tru cua website tren Google Drive (Web_VTF); du lieu dang ky nam trong thu muc con RIENG TU cua no
  WEB_FOLDER_ID: '1A1-PcWh4w0JL6raJnVvLNdZm833vdAO0', PRIVATE_FOLDER: 'Du lieu dang ky (RIENG TU)',
  MAX_SUBMIT: 20000, MIN_FILL_MS: 1500, RATE_ALL: 150, RATE_EMAIL: 3
};
var HEAD = ['khoa', 'loai', 'gia-tri', 'goc', 'cap-nhat'];

// ============================================================ cai dat (chay tay mot lan)
/** Buoc 1: tao cac sheet, thu muc anh, khoa phien va noi luu bieu mau dang ky. An toan khi chay lai. */
function setup() {
  var p = P_();
  if (!p.getProperty('TOKEN_SECRET')) p.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('REV')) p.setProperty('REV', '0');
  sheet_(CFG.SHEET, HEAD);
  sheet_(CFG.LOG, ['thoi-gian', 'tai-khoan', 'thao-tac', 'chi-tiet']);
  sheet_(CFG.HIST, ['phien-ban', 'thoi-gian', 'tai-khoan', 'khoa', 'cu', 'moi']);
  folder_();
  var kt; try { kt = kiemTraBieuMau(); } catch (e) { kt = 'CANH BAO bieu mau chua san sang: ' + (e && e.message); }
  return 'Da cai dat xong. ' + kt + ' Buoc tiep theo: chay datTaiKhoanAdmin (neu dung trang quan tri), roi Trien khai > Ung dung web.';
}
/** Kiem tra noi luu bieu mau: moi tep phai o thu muc RIENG TU va khong chia se cong khai; ghi thu mot dong roi xoa ngay. Chay duoc bat cu luc nao. */
function kiemTraBieuMau() {
  var out = [];
  Object.keys(DK).forEach(function (k) {
    var spec = DK[k], sh = dkSheet_(spec), vals = {};
    vals[spec.time] = '(kiem tra)';
    var r = dkWrite_(sh, spec, vals), back = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
    sh.deleteRows(r, 1);
    out.push(spec.title + ': ' + (back.indexOf('(kiem tra)') >= 0 ? 'ghi/doc/xoa dung' : 'LOI doc lai'));
  });
  return out.join('; ') + '.';
}
/** Tao hoac ghi de tai khoan quan tri. Chi nhan dau bam (khong co mat khau thuong): xem apps-script/make-account.mjs. */
function datTaiKhoan(user, salt, hash) { setUser_(String(user).toLowerCase(), String(salt), String(hash), 'admin'); }

// ============================================================ web app
function doGet(e) {
  try {
    var a = (e && e.parameter && e.parameter.action) || 'content';
    if (a === 'content') return ContentService.createTextOutput(contentJson_()).setMimeType(ContentService.MimeType.JSON);
    if (a === 'ping') return json_({ ok: true, version: VERSION, ready: !!P_().getProperty('TOKEN_SECRET') && users_().length > 0, forms: Object.keys(DK).length });
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
    if (b.action === 'submit') return json_(raw.length > CFG.MAX_SUBMIT ? err_('too_big', 'Nội dung gửi quá dài.') : submit_(b)); // bieu mau cong khai, khong can dang nhap
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
function ss_() { // script gan voi mot Sheet: dung Sheet do; script doc lap: tu tao Sheet noi dung (trong thu muc rieng tu) o lan chay dau
  var s = SpreadsheetApp.getActiveSpreadsheet();
  if (s) return s;
  var p = P_(), id = p.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* tep da bi xoa: tao lai ben duoi */ } }
  s = SpreadsheetApp.create(CFG.CMS_FILE);
  try { DriveApp.getFileById(s.getId()).moveTo(dkFolder_()); } catch (e) { /* khong co thu muc rieng tu: de o Drive cua ban (mac dinh rieng tu) */ }
  p.setProperty('SHEET_ID', s.getId());
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
  if (!f) { f = webFolder_().createFolder(CFG.FOLDER); p.setProperty('FOLDER_ID', f.getId()); }
  return f;
}
function webFolder_() { try { return DriveApp.getFolderById(CFG.WEB_FOLDER_ID); } catch (e) { return DriveApp.getRootFolder(); } }
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
  // bo nho dem toi da 100 KB tinh theo BYTE (chu co dau ton toi 3 byte/ky tu): chi dem khi nho, loi dem khong duoc lam hong phan hoi
  if (s.length < 30000) { try { cache.put('content', s, 21600); } catch (e) { /* bo qua */ } }
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

// ============================================================ bieu mau dang ky cong khai (khong can dang nhap)
// Ghi theo TIEU DE cot: nguoi quan ly co the them cot, doi thu tu cot trong Sheet ma khong lam hong; thieu cot nao script tu them o cuoi.
var DK = {
  hoivien: {
    pre: 'HV', title: 'VTF - Hội viên đăng ký', ref: 'Mã hồ sơ', time: 'Thời gian gửi', page: 'Trang gửi', consent: 'Đồng ý xử lý dữ liệu', status: 'Trạng thái', st0: 'Mới',
    head: ['Mã hồ sơ', 'Thời gian gửi', 'Loại hội viên', 'Họ tên / Tên tổ chức', 'Người đại diện (nếu là tổ chức)', 'Số điện thoại', 'Email', 'Tỉnh / Thành phố', 'Địa chỉ', 'Đơn vị công tác / CLB', 'Nội dung / Ghi chú', 'Đồng ý xử lý dữ liệu', 'Trang gửi', 'Trạng thái', 'Ghi chú nội bộ'],
    f: [
      { k: 'loai', col: 'Loại hội viên', t: 'enum', opts: { 'to-chuc': 'Tổ chức', 'ca-nhan': 'Cá nhân' }, req: true, msg: 'Chọn loại hội viên.' },
      { k: 'ten', col: 'Họ tên / Tên tổ chức', t: 'text', max: 150, req: true, msg: 'Nhập họ tên hoặc tên tổ chức.' },
      { k: 'daiDien', col: 'Người đại diện (nếu là tổ chức)', t: 'text', max: 120, reqIf: ['loai', 'to-chuc'], msg: 'Nhập họ tên người đại diện của tổ chức.' },
      { k: 'dienThoai', col: 'Số điện thoại', t: 'phone', req: true, msg: 'Nhập số điện thoại hợp lệ (8 đến 15 chữ số).' },
      { k: 'email', col: 'Email', t: 'email', req: true, msg: 'Nhập địa chỉ email hợp lệ.' },
      { k: 'tinh', col: 'Tỉnh / Thành phố', t: 'text', max: 80, req: true, msg: 'Nhập tỉnh / thành phố.' },
      { k: 'diaChi', col: 'Địa chỉ', t: 'text', max: 250 },
      { k: 'donVi', col: 'Đơn vị công tác / CLB', t: 'text', max: 150 },
      { k: 'ghiChu', col: 'Nội dung / Ghi chú', t: 'area', max: 1500 }
    ]
  },
  lienhe: {
    pre: 'LH', title: 'VTF - Khách hàng liên hệ', ref: 'Mã liên hệ', time: 'Thời gian gửi', page: 'Trang gửi', consent: 'Đồng ý xử lý dữ liệu', status: 'Trạng thái', st0: 'Mới',
    head: ['Mã liên hệ', 'Thời gian gửi', 'Họ và tên', 'Email', 'Số điện thoại', 'Chủ đề', 'Nội dung', 'Đồng ý xử lý dữ liệu', 'Trang gửi', 'Trạng thái', 'Ghi chú nội bộ'],
    f: [
      { k: 'ten', col: 'Họ và tên', t: 'text', max: 120, req: true, msg: 'Nhập họ và tên.' },
      { k: 'email', col: 'Email', t: 'email', req: true, msg: 'Nhập địa chỉ email hợp lệ.' },
      { k: 'dienThoai', col: 'Số điện thoại', t: 'phone', msg: 'Số điện thoại chưa hợp lệ (8 đến 15 chữ số), hoặc để trống.' },
      { k: 'chuDe', col: 'Chủ đề', t: 'enum', opts: { 'hoi-vien': 'Hội viên', 'giai-dau': 'Giải đấu, thi đẳng', 'hop-tac': 'Hợp tác, tài trợ', 'khac': 'Khác' }, req: true, msg: 'Chọn chủ đề.' },
      { k: 'noiDung', col: 'Nội dung', t: 'area', max: 3000, min: 10, req: true, msg: 'Nhập nội dung (ít nhất 10 ký tự).' }
    ]
  },
  nhantin: {
    pre: 'NT', title: 'VTF - Người truy cập nhận tin', ref: '', time: 'Thời gian đăng ký', page: 'Trang gửi', consent: 'Đồng ý nhận tin', status: 'Trạng thái', st0: 'Đang nhận tin', dedupe: 'Email',
    head: ['Thời gian đăng ký', 'Email', 'Họ và tên', 'Đồng ý nhận tin', 'Trang gửi', 'Trạng thái', 'Ghi chú nội bộ'],
    f: [
      { k: 'email', col: 'Email', t: 'email', req: true, msg: 'Nhập địa chỉ email hợp lệ.' },
      { k: 'ten', col: 'Họ và tên', t: 'text', max: 120 }
    ]
  }
};

function dkText_(s, multi) { // bo ky tu dieu khien va < >, gom khoang trang; o nhieu dong giu xuong dong
  s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, ' ').replace(/[<>]/g, ' ');
  if (multi) s = s.replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n');
  else s = s.replace(/\s+/g, ' ');
  return s.trim();
}
function dkPhone_(s) { s = String(s == null ? '' : s).replace(/[\s.\-()]/g, ''); return /^\+?\d{8,15}$/.test(s) ? s : ''; }
function dkEmail_(s) { s = String(s == null ? '' : s).trim().toLowerCase(); return s.length <= 120 && /^[a-z0-9][a-z0-9._%+']*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(s) ? s : ''; }
function dkSafe_(s) { return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; } // chong "chen cong thuc" khi mo/xuat Sheet sang Excel

function dkClean_(spec, f) {
  var v = {}, c = {}, errors = {}, i, d, raw, given, val;
  for (i = 0; i < spec.f.length; i++) {
    d = spec.f[i]; raw = f[d.k]; val = '';
    given = !(raw == null || String(raw).trim() === '');
    if (d.t === 'enum') { if (typeof raw === 'string' && Object.prototype.hasOwnProperty.call(d.opts, raw)) { c[d.k] = raw; val = d.opts[raw]; } }
    else if (d.t === 'phone') val = dkPhone_(raw);
    else if (d.t === 'email') val = dkEmail_(raw);
    else { val = dkText_(raw, d.t === 'area'); if (val.length > d.max) val = val.slice(0, d.max); }
    var need = d.req || (d.reqIf && c[d.reqIf[0]] === d.reqIf[1]);
    if ((need && !val) || (given && !val && d.t !== 'text' && d.t !== 'area') || (d.min && val && val.length < d.min)) errors[d.k] = d.msg;
    else if (val) v[d.k] = val;
  }
  if (f.dongY !== true) errors.dongY = 'Bạn cần đồng ý để gửi thông tin.';
  return { ok: Object.keys(errors).length === 0, v: v, errors: errors };
}
function mac_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(s), P_().getProperty('TOKEN_SECRET') || 'vtf')).slice(0, 24); }
function rate_(key, max) { var ch = CacheService.getScriptCache(), n = parseInt(ch.get(key) || '0', 10); if (n >= max) return false; ch.put(key, String(n + 1), 3600); return true; }

/** Thu muc con RIENG TU trong Web_VTF. KHONG tu tao: tao trong thu muc cong khai se ke thua quyen "ai cung xem duoc". */
function dkFolder_() {
  var it = DriveApp.getFolderById(CFG.WEB_FOLDER_ID).getFoldersByName(CFG.PRIVATE_FOLDER);
  if (!it.hasNext()) throw new Error('Khong thay thu muc "' + CFG.PRIVATE_FOLDER + '" trong thu muc Web_VTF.');
  return it.next();
}
/** Sheet dau tien cua tep du lieu; tao tep (o thu muc rieng tu) neu chua co; tu choi neu tep dang chia se cong khai. */
function dkSheet_(spec) {
  var p = P_(), key = 'DK_' + spec.pre, id = p.getProperty(key), f = null;
  if (id) { try { f = DriveApp.getFileById(id); } catch (e) { f = null; } }
  if (!f) {
    var dir = dkFolder_(), it = dir.getFilesByName(spec.title);
    if (it.hasNext()) f = it.next();
    else {
      var book = SpreadsheetApp.create(spec.title); f = DriveApp.getFileById(book.getId()); f.moveTo(dir);
      var first = book.getSheets()[0]; first.getRange(1, 1, 1, spec.head.length).setValues([spec.head]); first.setFrozenRows(1);
    }
    p.setProperty(key, f.getId());
  }
  if (f.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Tep "' + spec.title + '" dang duoc chia se. Dat lai ve Rieng tu roi thu lai.');
  return SpreadsheetApp.openById(f.getId()).getSheets()[0];
}
/** Ghi mot dong theo tieu de cot (vals: {tieu-de-cot: gia-tri}); tra ve so dong vua ghi. Dinh dang van ban de khong ai bien noi dung thanh cong thuc. */
function dkWrite_(sh, spec, vals) {
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, spec.head.length).setValues([spec.head]); sh.setFrozenRows(1); }
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  Object.keys(vals).forEach(function (h) { if (head.indexOf(h) < 0) { head.push(h); sh.getRange(1, head.length).setValue(h); } });
  var row = head.map(function (h) { return Object.prototype.hasOwnProperty.call(vals, h) ? vals[h] : ''; });
  var r = sh.getLastRow() + 1; ensureRows_(sh, r);
  var rg = sh.getRange(r, 1, 1, row.length); rg.setNumberFormat('@'); rg.setValues([row]);
  return r;
}
function dkHas_(sh, col, val) {
  var lc = sh.getLastColumn(), n = sh.getLastRow();
  if (n < 2 || lc < 1) return false;
  var c = sh.getRange(1, 1, 1, lc).getValues()[0].map(String).indexOf(col) + 1;
  if (!c) return false;
  var rows = sh.getRange(2, c, n - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim().toLowerCase() === val) return true;
  return false;
}

function submit_(b) {
  var spec = DK[String(b.kind || '')];
  if (!spec) return err_('bad_kind', 'Biểu mẫu không hợp lệ.');
  var f = b.f;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return err_('bad_request', 'Yêu cầu không hợp lệ.');
  // chong may tu dong: o bay bi dien hoac gui qua nhanh -> tra "thanh cong" nhung KHONG ghi gi
  if (String(b.hp || '') !== '' || !(Number(b.t) >= CFG.MIN_FILL_MS)) return { ok: true, ref: '' };
  var cl = dkClean_(spec, f);
  if (!cl.ok) return { ok: false, code: 'invalid', message: 'Vui lòng kiểm tra lại các ô được đánh dấu.', errors: cl.errors };
  if (!rate_('rl:all', CFG.RATE_ALL)) return err_('busy', 'Hệ thống đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.');
  if (!rate_('rl:' + spec.pre + ':' + mac_(cl.v.email), CFG.RATE_EMAIL)) return err_('rate', 'Email này đã gửi nhiều lần trong một giờ. Vui lòng thử lại sau.');
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return err_('busy', 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.'); }
  try {
    var sh = dkSheet_(spec);
    if (spec.dedupe && dkHas_(sh, spec.dedupe, cl.v.email)) return { ok: true, ref: '' }; // da dang ky: khong ghi trung, khong tiet lo cho nguoi gui
    var vals = {};
    spec.f.forEach(function (d) { if (cl.v[d.k]) vals[d.col] = (d.t === 'text' || d.t === 'area') ? dkSafe_(cl.v[d.k]) : cl.v[d.k]; });
    var pg = String(b.page || ''); if (!/^\/[A-Za-z0-9\/_-]{0,80}$/.test(pg)) pg = '';
    vals[spec.time] = stamp_(); vals[spec.consent] = 'Đã đồng ý'; vals[spec.page] = pg; vals[spec.status] = spec.st0;
    var ref = spec.ref ? spec.pre + '-' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyyMMdd') + '-' + ('0000' + (Math.max(sh.getLastRow() + 1, 2) - 1)).slice(-4) : '';
    if (ref) vals[spec.ref] = ref;
    dkWrite_(sh, spec, vals);
    return { ok: true, ref: ref };
  } catch (e) {
    log_('khach', 'loi-bieu-mau-' + spec.pre, e && e.message);
    return err_('server', 'Chưa gửi được thông tin.');
  } finally { lock.releaseLock(); }
}
