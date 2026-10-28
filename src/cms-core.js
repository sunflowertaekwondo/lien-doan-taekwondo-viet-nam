/* cms-core.js - loi CMS "de noi dung": quet cac phan tu sua duoc cua trang (walk) va ap noi dung quan tri len trang (applyData).
   Dung chung cho trang cong khai (tai noi dung tu Apps Script roi de len) va khung xem truoc cua admin.html.
   Nguyen tac: HTML goc la noi dung mac dinh; quan tri chi DE len; de trong = tra ve mac dinh.
   Khoa moi phan tu sinh tu cau truc trang (id gan nhat + vi tri), kem dau van tay noi dung goc "o": noi dung goc doi thi muc de bi bo qua
   thay vi de nham vao phan tu khac. Doan danh dau tren phan tu: data-cms-skip (khong cho sua), data-cms-optional (an cho den khi co video),
   data-cms-video (khung video YouTube sua duoc). Dung kem cms-sanitize.js (CMSAN). */
(function () {
  'use strict';
  var SAN = window.CMSAN, XHTML = 'http://www.w3.org/1999/xhtml';
  var SKIP_TAGS = { script: 1, style: 1, noscript: 1, template: 1, canvas: 1, select: 1, textarea: 1, input: 1, option: 1, svg: 1, object: 1, embed: 1 };
  var SKIP_CLASS = ['ms-state', 'cal-status', 'skip', 'toast', 'to-top', 'progress']; // do site.js tu ghi: khong cho sua
  var INLINE = { b: 1, i: 1, u: 1, strong: 1, em: 1, br: 1, span: 1, a: 1 }; // the duoc coi la "chu co dinh dang" ben trong mot khoi van ban
  var YT = /^(?:https?:)?\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{11}/;

  function pageKey(pathname, base) {
    var p = pathname;
    if (base && p.indexOf(base) === 0) p = p.slice(base.length);
    p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/^\/+|\/+$/g, '');
    try { p = decodeURIComponent(p); } catch (e) { /* giu nguyen */ }
    return p.replace(/[^A-Za-z0-9_\-\/]/g, '_') || 'index';
  }
  function safeId(id) { return /^[A-Za-z0-9_-]{1,80}$/.test(id || '') ? id : ''; }
  function stepOf(el) {
    var n = 0, s = el.previousElementSibling;
    while (s) { if (s.localName === el.localName) n++; s = s.previousElementSibling; }
    return el.localName + '.' + n;
  }
  function isSkip(el) {
    if (el.namespaceURI !== XHTML || SKIP_TAGS[el.localName] || el.hasAttribute('data-cms-skip') || el.id === 'dl-status') return true;
    for (var i = 0; i < SKIP_CLASS.length; i++) if (el.classList.contains(SKIP_CLASS[i])) return true;
    return false;
  }
  function textNodes(el) { // cac doan chu truc tiep (khong rong) cua phan tu, theo thu tu
    var out = [];
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) out.push(n);
    return out;
  }
  function inlineOnly(el) { // moi phan tu con (o moi cap) chi la the dinh dang duoc phep
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (!INLINE[c.localName] || isSkip(c) || !inlineOnly(c)) return false;
    }
    return true;
  }
  function isLeaf(el) { return textNodes(el).length > 0 && inlineOnly(el); }

  // ---------------------------------------------------------------- walk
  // opts: { base, eager } - eager: chup san ban sao goc cua cac muc khoi lap (admin); mac dinh chup luc can (trang cong khai)
  function walk(doc, opts) {
    opts = opts || {};
    var win = doc.defaultView || window;
    var page = pageKey(win.location.pathname, opts.base || '');
    var M = { page: page, doc: doc, groups: [], fieldsByKey: Object.create(null), lists: [], listsByKey: Object.create(null), elFields: new Map(), eager: !!opts.eager };

    function addGroup(id, title, scope) { var g = { id: id, title: title, scope: scope, entries: [] }; M.groups.push(g); return g; }
    function register(f, entries) {
      M.fieldsByKey[f.key] = f;
      if (f.el) { var a = M.elFields.get(f.el); if (!a) M.elFields.set(f.el, a = []); a.push(f); }
      entries.push({ type: 'field', field: f });
      return f;
    }
    // khoa: tien to (trang | site) + "#id" gan nhat, hoac vung/duong di; trong khoi lap: khoa-khoi[ma-muc]/duong-di
    function keyOf(el, ctx) {
      var st = [], cur;
      if (ctx.item) {
        for (cur = el; cur && cur !== ctx.item.el; cur = cur.parentElement) st.push(stepOf(cur));
        return ctx.list.key + '[' + ctx.item.id + ']/' + (st.length ? st.reverse().join('>') : '.');
      }
      for (cur = el; cur && cur !== ctx.root; cur = cur.parentElement) {
        var id = safeId(cur.id);
        if (id) return ctx.scope + '#' + id + (st.length ? '>' + st.reverse().join('>') : '');
        st.push(stepOf(cur));
      }
      return ctx.scope + '/' + ctx.region + (st.length ? '/' + st.reverse().join('>') : '');
    }
    function field(kind, el, ctx, node, idx) {
      var key = keyOf(el, ctx) + (kind === 'html' ? '' : '@' + (kind === 't' ? 't' + idx : kind));
      var f = { key: key, kind: kind, el: el, group: ctx.group || null, item: ctx.item || null, node: node || null };
      // noi dung goc (mac dinh) chup ngay luc quet, truoc khi co gi de len
      if (kind === 'html') f.def = el.innerHTML;
      else if (kind === 't') f.def = node.nodeValue;
      else if (kind === 'href') f.def = el.getAttribute('href') || '';
      else if (kind === 'alt') f.def = el.getAttribute('alt') || '';
      else if (kind === 'src') {
        var pic = el.parentElement && el.parentElement.localName === 'picture' ? el.parentElement : null;
        f.def = { src: el.getAttribute('src') || '', srcset: el.getAttribute('srcset'), sizes: el.getAttribute('sizes'), sources: pic ? [].map.call(pic.querySelectorAll('source'), function (s) { return [s, s.getAttribute('srcset'), s.getAttribute('type')]; }) : [] };
      } else if (kind === 'video') {
        var opt = el.closest('[data-cms-optional]');
        f.def = { src: el.getAttribute('src') || '', opt: opt, hidden: opt ? opt.hidden : false };
      }
      return register(f, ctx.collect);
    }

    function listCandidate(el, ctx) {
      if (ctx.item || el === ctx.root || el.localName === 'main' || el.localName === 'body') return null;
      var kids = el.children;
      if (kids.length < 2 || textNodes(el).length) return null;
      var sig = kids[0].localName + '|' + kids[0].className, bad = { section: 1, header: 1, footer: 1, main: 1, nav: 1, br: 1, hr: 1, source: 1, script: 1, style: 1, option: 1, template: 1, caption: 1, colgroup: 1, thead: 1 };
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (bad[k.localName] || isSkip(k) || k.localName + '|' + k.className !== sig) return null;
      }
      return kids;
    }
    function itemId(k, i) { var id = safeId(k.id); return id ? 'i' + id : 'o' + i; }
    function collectItem(L, item) {
      item.entries = [];
      visit(item.el, { scope: L.scope, region: L.region, root: item.el, item: item, list: L, collect: item.entries });
    }
    M.collectItem = collectItem;
    function addList(el, kids, ctx) {
      var L = { key: keyOf(el, ctx), el: el, scope: ctx.scope, region: ctx.region, group: ctx.group, orig: [], origMap: Object.create(null), items: [], dyn: [] };
      var seen = Object.create(null);
      for (var i = 0; i < kids.length; i++) {
        var id = itemId(kids[i], i); if (seen[id]) id = 'o' + i; seen[id] = 1;
        var item = { id: id, el: kids[i], pristine: null, entries: [], list: L };
        L.orig.push(item); L.origMap[id] = item;
      }
      L.orig.forEach(function (it) { collectItem(L, it); });
      if (!L.orig.some(function (it) { return it.entries.length; })) return false; // khong co gi sua duoc trong cac muc: khong coi la khoi lap
      L.items = L.orig.slice();
      if (M.eager) L.orig.forEach(function (it) { it.pristine = it.el.cloneNode(true); });
      M.lists.push(L); M.listsByKey[L.key] = L;
      ctx.collect.push({ type: 'list', list: L });
      return true;
    }

    function visit(el, ctx) {
      if (isSkip(el)) return;
      var tag = el.localName;
      if (!ctx.item) { var kids = listCandidate(el, ctx); if (kids && addList(el, kids, ctx)) return; }
      if (tag === 'iframe') { if (el.hasAttribute('data-cms-video') || YT.test(el.getAttribute('src') || '')) field('video', el, ctx); return; }
      if (tag === 'img') { field('src', el, ctx); field('alt', el, ctx); return; }
      if (isLeaf(el)) {
        field('html', el, ctx);
        if (tag === 'a' && el.hasAttribute('href')) field('href', el, ctx);
        return;
      }
      if (tag === 'a' && el.hasAttribute('href')) field('href', el, ctx);
      var idx = 0;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { if (/\S/.test(n.nodeValue)) field('t', el, ctx, n, idx++); }
        else if (n.nodeType === 1) visit(n, ctx);
      }
    }
    function region(el, id, title, scope, regionTag) {
      var g = addGroup(id, title, scope);
      visit(el, { scope: scope, region: regionTag, root: el, group: g, collect: g.entries });
      return g;
    }

    // ----- vung: tieu de/mo ta (SEO), dau trang, noi dung, chan trang
    var metaG = addGroup('meta', 'Tiêu đề và mô tả của trang (hiện trên Google và khi chia sẻ)', 'page');
    register({ key: page + '@mt', kind: 'mt', el: null, doc: doc, group: metaG, item: null, def: doc.title }, metaG.entries);
    var md = doc.querySelector('meta[name="description"]');
    if (md) register({ key: page + '@md', kind: 'md', el: md, group: metaG, item: null, def: md.getAttribute('content') || '' }, metaG.entries);
    var header = doc.querySelector('.site-header'), main = doc.querySelector('main'), footer = doc.querySelector('.site-footer');
    if (header) region(header, 'header', 'Đầu trang: logo và menu (dùng chung mọi trang)', 'site', 'h');
    if (main) {
      var gi = 0;
      for (var c = main.firstElementChild; c; c = c.nextElementSibling) {
        if (isSkip(c)) continue;
        var h = c.querySelector('h1, h2, h3, h4');
        var title = (h && h.textContent.replace(/\s+/g, ' ').trim()) || c.getAttribute('aria-label') || c.id || c.className || c.localName;
        var g = addGroup('m' + (gi++), title.slice(0, 90), page);
        visit(c, { scope: page, region: 'm', root: main, group: g, collect: g.entries });
      }
    }
    if (footer) region(footer, 'footer', 'Chân trang (dùng chung mọi trang)', 'site', 'f');
    M.groups = M.groups.filter(function (g) { return g.entries.length; });
    return M;
  }

  // ---------------------------------------------------------------- apply
  function defCanon(f) { // noi dung goc o dang chuan (de so sanh va lay dau van tay)
    if (f.kind === 'html') return SAN.html(f.def);
    if (f.kind === 'src' || f.kind === 'video') return f.def.src;
    return f.def == null ? '' : String(f.def);
  }
  function defHash(f) { return SAN.hash(defCanon(f)); }

  function restore(f) {
    var el = f.el;
    switch (f.kind) {
      case 'html': if (el.innerHTML !== f.def) el.innerHTML = f.def; break;
      case 't': if (f.node.nodeValue !== f.def) f.node.nodeValue = f.def; break;
      case 'href': if (el.getAttribute('href') !== f.def) el.setAttribute('href', f.def); break;
      case 'alt': if (el.getAttribute('alt') !== f.def) el.setAttribute('alt', f.def); break;
      case 'src':
        if (el.getAttribute('src') !== f.def.src) el.setAttribute('src', f.def.src);
        ['srcset', 'sizes'].forEach(function (a) { if (f.def[a] == null) el.removeAttribute(a); else el.setAttribute(a, f.def[a]); });
        f.def.sources.forEach(function (s) { if (s[1] == null) s[0].removeAttribute('srcset'); else s[0].setAttribute('srcset', s[1]); });
        break;
      case 'video':
        if (!f.def.src) el.removeAttribute('src'); else if (el.getAttribute('src') !== f.def.src) el.setAttribute('src', f.def.src);
        if (f.def.opt) f.def.opt.hidden = f.def.hidden;
        break;
      case 'mt': if (f.doc.title !== f.def) f.doc.title = f.def; break;
      case 'md': if (el.getAttribute('content') !== f.def) el.setAttribute('content', f.def); break;
    }
  }
  // ghi de len mot phan tu (ov = {v, o}); rong/khong hop le/noi dung goc da doi = tra ve mac dinh. Tra ve true neu da de.
  function setField(f, ov) {
    var v = ov && typeof ov.v === 'string' ? ov.v : '', el = f.el, x;
    f.stale = false;
    if (v === '') { restore(f); return false; }
    if (ov.o && ov.o !== defHash(f)) { f.stale = true; restore(f); return false; }
    switch (f.kind) {
      case 'html': x = SAN.html(v); if (el.innerHTML !== x) el.innerHTML = x; break;
      case 't': f.node.nodeValue = SAN.plain(v, 5000, true); break;
      case 'href': x = SAN.link(v); if (!x) { restore(f); return false; } el.setAttribute('href', x); break;
      case 'alt': el.setAttribute('alt', SAN.plain(v, 500)); break;
      case 'src':
        x = SAN.img(v); if (!x) { restore(f); return false; }
        el.setAttribute('src', x); el.removeAttribute('srcset'); el.removeAttribute('sizes');
        f.def.sources.forEach(function (s) { s[0].removeAttribute('srcset'); });
        break;
      case 'video':
        x = SAN.ytEmbed(v); if (!x) { restore(f); return false; }
        el.setAttribute('src', x);
        if (f.def.opt) f.def.opt.hidden = false;
        break;
      case 'mt': f.doc.title = SAN.plain(v, 300); break;
      case 'md': el.setAttribute('content', SAN.plain(v, 500)); break;
    }
    return true;
  }

  function stripIds(root) {
    [root].concat([].slice.call(root.querySelectorAll('[id], [aria-controls], [aria-labelledby], [for]'))).forEach(function (n) {
      ['id', 'aria-controls', 'aria-labelledby', 'for'].forEach(function (a) { n.removeAttribute(a); });
    });
  }
  // dat lai cac muc cua mot khoi lap theo mo ta {c, items:[{id, t}]}; khong co mo ta (hoac so muc goc doi) = thu tu goc
  function applyList(M, L, desc) {
    var valid = !!desc && desc.c === L.orig.length && Array.isArray(desc.items);
    L.stale = !!desc && !valid;
    var items = [];
    if (!valid) items = L.orig.slice();
    else desc.items.forEach(function (d) {
      var o = L.origMap[d.id];
      if (o) { items.push(o); return; }
      var tpl = L.origMap[d.t];
      if (!tpl) return;
      var prev = L.dyn.filter(function (x) { return x.id === d.id && x.tpl === d.t; })[0];
      if (prev) { items.push(prev); return; }
      if (!tpl.pristine) tpl.pristine = tpl.el.cloneNode(true); // trang cong khai: chup truoc khi co truong nao bi de
      var clone = tpl.pristine.cloneNode(true); stripIds(clone);
      var item = { id: d.id, tpl: d.t, el: clone, pristine: null, entries: [], list: L, isNew: true };
      L.dyn.push(item); M.collectItem(L, item);
      items.push(item);
    });
    var same = items.length === L.items.length && L.el.children.length === items.length && items.every(function (x, i) { return x === L.items[i] && L.el.children[i] === x.el; });
    L.items = items;
    if (!same) {
      var frag = L.el.ownerDocument.createDocumentFragment();
      items.forEach(function (it) { frag.appendChild(it.el); });
      while (L.el.firstChild) L.el.removeChild(L.el.firstChild);
      L.el.appendChild(frag);
    }
  }
  function eachField(item, fn) { item.entries.forEach(function (e) { if (e.type === 'field') fn(e.field); }); }
  // ap toan bo: data = { fields: {khoa: {v, o}}, lists: {khoa: {c, items}} }
  function applyData(M, data) {
    var fields = (data && data.fields) || {}, lists = (data && data.lists) || {};
    M.lists.forEach(function (L) { applyList(M, L, lists[L.key]); }); // khoi lap truoc: tao muc moi roi moi de tung truong
    Object.keys(M.fieldsByKey).forEach(function (k) { var f = M.fieldsByKey[k]; if (!f.item) setField(f, fields[k]); });
    M.lists.forEach(function (L) { L.items.forEach(function (it) { eachField(it, function (f) { setField(f, fields[f.key]); }); }); });
  }

  var API = { walk: walk, applyData: applyData, applyList: applyList, setField: setField, restore: restore, defCanon: defCanon, defHash: defHash, pageKey: pageKey, textNodes: textNodes, SAN: SAN, model: null };
  window.VTFCMS = API;

  // ---------------------------------------------------------------- chay tren trang cong khai
  var cur = document.currentScript;
  if (window.__VTF_CMS_NOBOOT || !cur) return; // admin.html tu dieu khien
  var endpoint = cur.getAttribute('data-endpoint') || '', base = cur.getAttribute('data-base') || '';
  var preview = /[?&]cms-preview=1(?:&|$)/.test(location.search) && window.parent !== window;
  if (!preview && !endpoint) return;
  // quet NGAY (script nay chay truoc site.js) de khoa khop voi khung xem truoc cua admin; noi dung tai ve sau
  var M0 = API.model = walk(document, { base: base, eager: preview });
  if (preview) return; // khung xem truoc trong admin: noi dung do admin ap
  var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl && setTimeout(function () { ctl.abort(); }, 12000);
  fetch(endpoint + (endpoint.indexOf('?') < 0 ? '?' : '&') + 'action=content', { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok || !(Object.keys(j.fields || {}).length + Object.keys(j.lists || {}).length)) return;
      applyData(M0, j);
      document.dispatchEvent(new CustomEvent('vtf:cms-applied'));
    })
    .catch(function () { /* khong tai duoc noi dung chinh sua: giu noi dung goc */ })
    .then(function () { if (timer) clearTimeout(timer); API.model = null; });
})();
