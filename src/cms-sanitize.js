/* cms-sanitize.js - loc moi noi dung do quan tri nhap. Dung chung: trinh duyet (cms-core.js, admin.js) va may chu (apps-script/Code.gs,
   do apps-script/make-gs.mjs ghep vao). Chi dung ham thuan, khong dung DOM. Sua o day roi chay: node apps-script/make-gs.mjs */
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
