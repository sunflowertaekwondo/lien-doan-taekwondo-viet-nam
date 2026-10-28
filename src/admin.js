/* admin.js - trang quan tri noi dung website (admin.html).
   Trai: form theo tung khu (gap/mo). Phai: khung XEM TRUOC trang that (sua la thay ngay, chua luu). Noi dung luu o Google Sheet qua Apps Script
   (apps-script/Code.gs). Khong dung localStorage: chi giu phien dang nhap trong sessionStorage cua tab. Dung kem cms-sanitize.js + cms-core.js. */
(function () {
  'use strict';
  var script = document.currentScript;
  var ENDPOINT = script.getAttribute('data-endpoint') || '', BASE = script.getAttribute('data-base') || '', LOGO = script.getAttribute('data-logo') || '';
  var SAN = window.CMSAN;
  var PAGES = []; try { PAGES = JSON.parse(document.getElementById('cms-pages').textContent); } catch (e) { /* khong co danh sach trang */ }
  var app = document.getElementById('app');

  // ------------------------------------------------------------ tien ich
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  var ICONS = { up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7', copy: 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1', trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' };
  function ico(name) { // bieu tuong net don gian (SVG), mau theo chu
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', ICONS[name]); s.appendChild(p); return s;
  }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function stable(o) { return JSON.stringify(o, function (k, v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce(function (a, x) { a[x] = v[x]; return a; }, {}) : v; }); }
  var fold = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };
  var snip = function (s, n) { s = String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var rand = function () { return Math.random().toString(36).slice(2, 8); };

  // ------------------------------------------------------------ trang thai
  var S = { token: '', user: '', rev: 0, base: { fields: {}, lists: {} }, work: { fields: {}, lists: {} }, page: null, cms: null, M: null, frame: null, device: 'desktop', lastTA: null, uploads: 0 };
  function storeSession() { try { sessionStorage.setItem('vtf-cms-session', JSON.stringify({ token: S.token, user: S.user })); } catch (e) { /* tab rieng tu: chi giu trong bo nho */ } }
  function loadSession() { try { var j = JSON.parse(sessionStorage.getItem('vtf-cms-session') || 'null'); if (j && j.token) { S.token = j.token; S.user = j.user || ''; return true; } } catch (e) { /* khong co phien */ } return false; }
  function clearSession() { S.token = ''; S.user = ''; try { sessionStorage.removeItem('vtf-cms-session'); } catch (e) { /* bo qua */ } }
  var isDirty = function () { return stable(S.work) !== stable(S.base); };
  function dirtyCount() {
    var n = 0, seen = {};
    ['fields', 'lists'].forEach(function (t) {
      Object.keys(S.work[t]).concat(Object.keys(S.base[t])).forEach(function (k) { if (seen[t + k]) return; seen[t + k] = 1; if (stable(S.work[t][k]) !== stable(S.base[t][k])) n++; });
    });
    return n;
  }

  // ------------------------------------------------------------ may chu
  function post(action, data) {
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action, token: S.token }, data || {})) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, code: 'network', message: 'Không kết nối được máy chủ lưu trữ. Kiểm tra mạng rồi thử lại.' }; });
  }
  function api(action, data) { // het phien giua chung: hien khung dang nhap lai (khong mat phan dang sua), roi gui lai
    return post(action, data).then(function (r) {
      if (r && r.code === 'unauthorized' && S.token) return relogin().then(function (ok) { return ok ? post(action, data) : r; });
      return r;
    });
  }
  function getContent() {
    return fetch(ENDPOINT + '?action=content', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return { ok: false, message: 'Không tải được nội dung hiện tại.' }; });
  }

  // ------------------------------------------------------------ thong bao, hop thoai
  var toastEl, toastT;
  function toast(msg, bad) {
    if (!toastEl) { toastEl = h('div', { class: 'ad-toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.className = 'ad-toast show' + (bad ? ' bad' : '');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, bad ? 6000 : 2600);
  }
  function modal(title, body, buttons) { // buttons: [{text, cls, run -> false de giu hop thoai}]
    var back = h('div', { class: 'ad-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    var box = h('div', { class: 'ad-modal-box' }, [h('h2', { text: title }), body, h('div', { class: 'ad-modal-btns' }, buttons.map(function (b) {
      return h('button', { type: 'button', class: 'btn ' + (b.cls || 'btn-ghost'), text: b.text, onclick: function () { if (!b.run || b.run() !== false) back.remove(); } });
    }))]);
    back.appendChild(box); document.body.appendChild(back);
    var f = box.querySelector('input, button'); if (f) f.focus();
    return back;
  }
  function confirmBox(title, text, okText) {
    return new Promise(function (res) {
      modal(title, h('p', { text: text }), [{ text: 'Hủy', run: function () { res(false); } }, { text: okText || 'Đồng ý', cls: 'btn-red', run: function () { res(true); } }]);
    });
  }

  // ------------------------------------------------------------ man hinh: chua cai may chu, dang nhap
  function viewSetup() {
    app.textContent = '';
    app.appendChild(h('main', { class: 'ad-center' }, [h('div', { class: 'ad-card' }, [
      LOGO ? h('img', { src: LOGO, alt: '', class: 'ad-logo' }) : null,
      h('h1', { text: 'Chưa kết nối máy chủ lưu trữ' }),
      h('p', { text: 'Trang quản trị lưu nội dung vào Google Sheet qua Google Apps Script. Website chưa được khai báo địa chỉ máy chủ này.' }),
      h('ol', { class: 'ad-steps' }, [
        h('li', { text: 'Tạo Google Sheet mới → Tiện ích mở rộng → Apps Script, dán toàn bộ nội dung tệp apps-script/Code.gs, chạy hàm setup.' }),
        h('li', { text: 'Dán tệp cai-dat-tai-khoan.gs (tạo sẵn trong thư mục _local), chạy hàm datTaiKhoanAdmin, rồi xóa tệp đó đi.' }),
        h('li', { text: 'Triển khai → Ứng dụng web → Thực thi: Tôi; Quyền truy cập: Bất kỳ ai. Sao chép địa chỉ kết thúc bằng /exec.' }),
        h('li', { text: 'Dán địa chỉ đó vào data/cms.json (trường "endpoint"), rồi đưa website lên lại.' }),
      ]),
      h('p', { class: 'ad-muted', text: 'Hướng dẫn chi tiết từng bước: apps-script/HUONG-DAN.md' }),
    ])]));
  }
  function loginBox(done, intro) {
    var user = h('input', { id: 'lg-u', type: 'text', autocomplete: 'username', required: true, spellcheck: 'false', autocapitalize: 'none' });
    var pass = h('input', { id: 'lg-p', type: 'password', autocomplete: 'current-password', required: true });
    var err = h('p', { class: 'ad-err', role: 'alert' });
    var btn = h('button', { class: 'btn btn-red', type: 'submit', text: 'Đăng nhập' });
    var form = h('form', { class: 'ad-login', novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (!user.value.trim() || !pass.value) { err.textContent = 'Nhập tài khoản và mật khẩu.'; return; }
      btn.disabled = true; btn.textContent = 'Đang đăng nhập…';
      post('login', { user: user.value, pass: pass.value, token: '' }).then(function (r) {
        btn.disabled = false; btn.textContent = 'Đăng nhập';
        if (r && r.ok) { S.token = r.token; S.user = r.user; storeSession(); pass.value = ''; done(r); }
        else { err.textContent = (r && r.message) || 'Không đăng nhập được.'; pass.value = ''; pass.focus(); }
      });
    } }, [
      intro ? h('p', { class: 'ad-muted', text: intro }) : null,
      h('label', { for: 'lg-u', text: 'Tài khoản' }), user,
      h('label', { for: 'lg-p', text: 'Mật khẩu' }), pass, err, btn,
    ]);
    return { form: form, focus: function () { user.focus(); } };
  }
  function viewLogin() {
    app.textContent = '';
    var box = loginBox(function () { startApp(); });
    app.appendChild(h('main', { class: 'ad-center' }, [h('div', { class: 'ad-card' }, [
      LOGO ? h('img', { src: LOGO, alt: '', class: 'ad-logo' }) : null,
      h('h1', { text: 'Quản trị website' }),
      h('p', { class: 'ad-muted', text: 'Liên đoàn Taekwondo Việt Nam. Chỉ dành cho quản trị viên.' }),
      box.form,
    ])]));
    box.focus();
  }
  function relogin() {
    return new Promise(function (res) {
      var back, box = loginBox(function () { back.remove(); res(true); }, 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục, phần đang sửa vẫn được giữ.');
      back = modal('Đăng nhập lại', box.form, [{ text: 'Đóng', run: function () { res(false); } }]);
      box.focus();
    });
  }

  // ------------------------------------------------------------ ung dung chinh
  var el = {};
  function startApp() {
    app.textContent = '';
    app.appendChild(h('div', { class: 'ad-loading', text: 'Đang tải nội dung…' }));
    Promise.all([post('whoami'), getContent()]).then(function (rs) {
      var who = rs[0], c = rs[1];
      if (!who || !who.ok) { clearSession(); if (who && who.code === 'network') { app.textContent = ''; app.appendChild(h('div', { class: 'ad-center' }, [h('div', { class: 'ad-card' }, [h('p', { class: 'ad-err', text: who.message })])])); } else viewLogin(); return; }
      if (!c || !c.ok) { toast((c && c.message) || 'Không tải được nội dung.', true); c = { rev: who.rev || 0, fields: {}, lists: {} }; }
      S.rev = c.rev || 0; S.base = { fields: c.fields || {}, lists: c.lists || {} }; S.work = clone(S.base);
      buildShell(); loadPage((PAGES[0] || { path: '/' }).path);
    });
  }

  function buildShell() {
    app.textContent = '';
    var sel = h('select', { id: 'pg', 'aria-label': 'Chọn trang cần sửa', onchange: function () { loadPage(sel.value); } }, PAGES.map(function (p) { return h('option', { value: p.path, text: p.title + '  ·  ' + p.path }); }));
    var dev = function (name, label) { return h('button', { type: 'button', class: 'dev', 'data-dev': name, 'aria-pressed': name === S.device ? 'true' : 'false', text: label, onclick: function () { setDevice(name); } }); };
    el.status = h('span', { class: 'ad-status', role: 'status', 'aria-live': 'polite' });
    el.undo = h('button', { type: 'button', class: 'btn btn-ghost', text: 'Hoàn tác', title: 'Bỏ mọi thay đổi chưa lưu', onclick: undo });
    el.save = h('button', { type: 'button', class: 'btn btn-red', text: 'Lưu tất cả', onclick: save });
    el.page = sel;
    var usr = h('details', { class: 'usr' }, [h('summary', { text: S.user || 'Tài khoản' }), h('div', { class: 'usr-menu' }, [
      h('button', { type: 'button', text: 'Đổi mật khẩu', onclick: passwordDialog }),
      h('a', { href: BASE + '/', target: '_blank', rel: 'noopener', text: 'Xem website' }),
      h('button', { type: 'button', text: 'Đăng xuất', onclick: logout }),
    ])]);
    el.openLive = h('a', { class: 'btn btn-ghost', href: BASE + '/', target: '_blank', rel: 'noopener', text: 'Xem trang thật' });
    var top = h('header', { class: 'ad-top' }, [
      h('div', { class: 'ad-brand' }, [LOGO ? h('img', { src: LOGO, alt: '', class: 'ad-logo-s' }) : null, h('strong', { text: 'Quản trị website' })]),
      sel, h('div', { class: 'devs', role: 'group', 'aria-label': 'Kích thước xem trước' }, [dev('desktop', 'Máy tính'), dev('mobile', 'Điện thoại')]),
      h('div', { class: 'ad-act' }, [el.status, el.undo, el.save]), usr,
    ]);
    var tabs = h('div', { class: 'ad-tabs', role: 'tablist' }, [
      h('button', { type: 'button', role: 'tab', 'data-v': 'form', 'aria-selected': 'true', text: 'Chỉnh sửa', onclick: function () { setView('form'); } }),
      h('button', { type: 'button', role: 'tab', 'data-v': 'prev', 'aria-selected': 'false', text: 'Xem trước', onclick: function () { setView('prev'); } }),
    ]);
    el.search = h('input', { type: 'search', class: 'ad-search', placeholder: 'Tìm chữ, liên kết, ảnh trong trang này…', 'aria-label': 'Tìm trong trang', oninput: debounce(runSearch, 180) });
    el.tb = h('div', { class: 'ad-rte', role: 'toolbar', 'aria-label': 'Định dạng chữ' }, [
      h('button', { type: 'button', title: 'In đậm', 'data-t': 'b', html: null, onmousedown: keepFocus, onclick: function () { wrapSel('b'); } }, [h('b', { text: 'B' })]),
      h('button', { type: 'button', title: 'In nghiêng', onmousedown: keepFocus, onclick: function () { wrapSel('i'); } }, [h('i', { text: 'I' })]),
      h('button', { type: 'button', title: 'Gạch chân', onmousedown: keepFocus, onclick: function () { wrapSel('u'); } }, [h('u', { text: 'U' })]),
      h('button', { type: 'button', title: 'Chèn liên kết vào đoạn đang chọn', onmousedown: keepFocus, onclick: wrapLink, text: 'Liên kết' }),
      h('span', { class: 'ad-muted', text: 'Bấm vào chữ/ảnh trong khung xem trước để sửa đúng ô đó.' }),
    ]);
    el.groups = h('div', { class: 'ad-groups' });
    el.results = h('div', { class: 'ad-groups', hidden: true });
    el.form = h('aside', { class: 'ad-form', 'aria-label': 'Chỉnh sửa nội dung' }, [h('div', { class: 'ad-tools' }, [el.search, el.tb]), el.groups, el.results]);
    el.frame = h('iframe', { class: 'ad-frame', title: 'Xem trước trang', onload: onFrameLoad });
    el.prev = h('section', { class: 'ad-prev', 'aria-label': 'Xem trước trực tiếp' }, [h('div', { class: 'ad-prev-bar' }, [h('span', { text: 'Xem trước trực tiếp: sửa là thấy ngay, chưa lưu lên website' }), el.openLive]), h('div', { class: 'ad-frame-wrap', 'data-device': S.device }, [el.frame])]);
    el.main = h('div', { class: 'ad-main', 'data-view': 'form' }, [el.form, el.prev]);
    app.appendChild(h('div', { class: 'ad' }, [top, tabs, el.main]));
    updateState();
  }
  function setView(v) { el.main.dataset.view = v; [].forEach.call(document.querySelectorAll('.ad-tabs button'), function (b) { b.setAttribute('aria-selected', b.dataset.v === v ? 'true' : 'false'); }); }
  function setDevice(d) {
    S.device = d; el.prev.querySelector('.ad-frame-wrap').dataset.device = d;
    [].forEach.call(document.querySelectorAll('.devs .dev'), function (b) { b.setAttribute('aria-pressed', b.dataset.dev === d ? 'true' : 'false'); });
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }

  // ------------------------------------------------------------ xem truoc (iframe)
  function loadPage(path) {
    S.page = path; if (el.page) el.page.value = path;
    el.groups.textContent = ''; el.groups.appendChild(h('p', { class: 'ad-muted pad', text: 'Đang mở trang…' }));
    el.frame.src = BASE + path + (path.indexOf('?') < 0 ? '?' : '&') + 'cms-preview=1';
    el.openLive.href = BASE + path;
  }
  var PREV_CSS = '[data-cms-hov]{outline:2px dashed #F4B400!important;outline-offset:2px!important;cursor:pointer!important}[data-cms-sel]{outline:3px solid #DA251D!important;outline-offset:2px!important}html{scroll-behavior:auto!important}';
  function onFrameLoad() {
    var w = el.frame.contentWindow, d, cms;
    try { d = el.frame.contentDocument; cms = w.VTFCMS; } catch (e) { cms = null; }
    if (!cms || !cms.model) { el.groups.textContent = ''; el.groups.appendChild(h('p', { class: 'ad-err pad', text: 'Không đọc được trang để sửa. Hãy thử mở trang khác hoặc tải lại.' })); return; }
    S.cms = cms; S.M = cms.model;
    d.head.appendChild(h('style', { text: PREV_CSS }));
    var hov = null;
    function target(t) { for (var n = t; n && n.nodeType === 1; n = n.parentElement) if (S.M.elFields.has(n)) return n; return null; }
    d.addEventListener('mouseover', function (e) { var n = target(e.target); if (hov && hov !== n) hov.removeAttribute('data-cms-hov'); hov = n; if (n) n.setAttribute('data-cms-hov', ''); });
    d.addEventListener('mouseleave', function () { if (hov) { hov.removeAttribute('data-cms-hov'); hov = null; } });
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (a) e.preventDefault(); // khong roi trang khi bam trong khung xem truoc
      var n = target(e.target); if (!n) return;
      var fs = S.M.elFields.get(n), f = fs.filter(function (x) { return x.kind === 'html' || x.kind === 't' || x.kind === 'src' || x.kind === 'video'; })[0] || fs[0];
      if (f) { setView('form'); focusField(f); markSel(n); }
    }, true);
    d.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    S.cms.applyData(S.M, S.work);
    renderForm();
    w.scrollTo(0, 0);
  }
  function markSel(n) { var d = el.frame.contentDocument; [].forEach.call(d.querySelectorAll('[data-cms-sel]'), function (x) { x.removeAttribute('data-cms-sel'); }); if (n) n.setAttribute('data-cms-sel', ''); }
  function scrollPrev(f) { // dua phan tu dang sua vao tam khung xem truoc
    var n = f.el; if (!n || !n.scrollIntoView) return;
    var det = n.closest && n.closest('details'); if (det && !det.open) det.open = true;
    try { n.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* bo qua */ }
    markSel(n);
  }

  // ------------------------------------------------------------ ma hoa hien thi
  var TAGLBL = { h1: 'Tiêu đề lớn', h2: 'Tiêu đề mục', h3: 'Tiêu đề nhỏ', h4: 'Tiêu đề nhỏ', h5: 'Tiêu đề nhỏ', p: 'Đoạn văn', li: 'Mục danh sách', a: 'Nút / liên kết', button: 'Nút', td: 'Ô bảng', th: 'Ô tiêu đề bảng', span: 'Chữ', strong: 'Chữ đậm', b: 'Chữ đậm', small: 'Chữ nhỏ', summary: 'Tiêu đề khối thu gọn', figcaption: 'Chú thích ảnh', dt: 'Thuật ngữ', dd: 'Mô tả', label: 'Nhãn', time: 'Ngày giờ', abbr: 'Viết tắt', em: 'Chữ nghiêng', blockquote: 'Trích dẫn', div: 'Khối chữ', code: 'Mã', mark: 'Chữ nổi bật' };
  function labelOf(f) {
    switch (f.kind) {
      case 'html': case 't': return TAGLBL[f.el.localName] || 'Chữ';
      case 'href': return 'Địa chỉ liên kết' + (f.el.textContent.trim() ? ' (“' + snip(f.el.textContent, 28) + '”)' : '');
      case 'src':
        if (f.el.classList.contains('logo-img')) return 'Logo' + (/only-dark|fc-dark/.test(f.el.className) ? ' (nền tối)' : /only-light|fc-light/.test(f.el.className) ? ' (nền sáng)' : '');
        return 'Ảnh';
      case 'alt': return 'Mô tả ảnh (alt) cho người khiếm thị';
      case 'video': return 'Video YouTube';
      case 'mt': return 'Tiêu đề trang';
      case 'md': return 'Mô tả trang';
    }
    return 'Nội dung';
  }
  var toDisp = function (s) { return String(s).replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '); };
  // gia tri mac dinh hien trong o: khoang trang/xuong dong thua do HTML nguon khong co nghia -> gop lai de de doc
  function defDisp(f) {
    if (f.kind === 'html') return toDisp(SAN.html(f.def)).replace(/\s+/g, ' ').trim();
    if (f.kind === 'src' || f.kind === 'video') return f.def.src;
    return f.def == null ? '' : f.kind === 't' ? String(f.def).replace(/\s+/g, ' ') : String(f.def);
  }
  function curVal(f) { var o = S.work.fields[f.key]; return o ? o.v : defDisp(f); }
  var isMod = function (f) { return !!S.work.fields[f.key]; };

  // ------------------------------------------------------------ form
  var openGroups = {};
  function renderForm() {
    el.groups.textContent = ''; el.results.textContent = ''; el.results.hidden = true; el.groups.hidden = false; el.search.value = '';
    S.M.groups.forEach(function (g) { el.groups.appendChild(groupEl(g)); });
    updateState();
  }
  function countFields(entries) { return entries.reduce(function (n, e) { return n + (e.type === 'field' ? 1 : e.list.items.reduce(function (m, it) { return m + countFields(it.entries); }, 0)); }, 0); }
  function countMod(entries) {
    return entries.reduce(function (n, e) {
      if (e.type === 'field') return n + (isMod(e.field) ? 1 : 0);
      return n + (S.work.lists[e.list.key] ? 1 : 0) + e.list.items.reduce(function (m, it) { return m + countMod(it.entries); }, 0);
    }, 0);
  }
  function groupEl(g) {
    var badge = h('span', { class: 'bd' }), sum = h('summary', {}, [h('span', { class: 'gt', text: g.title }), g.scope === 'site' ? h('span', { class: 'tag', text: 'dùng chung' }) : null, h('span', { class: 'n', text: countFields(g.entries) + ' ô' }), badge]);
    var body = h('div', { class: 'gb' }), d = h('details', { class: 'grp', 'data-g': g.id }, [sum, body]), filled = false;
    d._fill = function () { if (filled) return; filled = true; fillEntries(body, g.entries); };
    d._badge = function () { var m = countMod(g.entries); badge.textContent = m ? '● ' + m + ' đã sửa' : ''; badge.hidden = !m; };
    d.addEventListener('toggle', function () { openGroups[g.id] = d.open; if (d.open) d._fill(); });
    if (openGroups[g.id] || (g.id === 'm0' && openGroups.m0 === undefined)) { d.open = true; d._fill(); }
    d._badge();
    return d;
  }
  function fillEntries(box, entries) { entries.forEach(function (e) { box.appendChild(e.type === 'field' ? fieldRow(e.field) : listBlock(e.list)); }); }
  function refreshBadges() { [].forEach.call(document.querySelectorAll('.grp'), function (d) { if (d._badge) d._badge(); }); }

  function setRowState(row, f) {
    var mod = isMod(f); row.classList.toggle('mod', mod);
    var rs = row.querySelector('.fr-rs'); if (rs) rs.hidden = !mod && !f.stale;
    var warn = row.querySelector('.fr-warn'); if (warn) warn.hidden = !f.stale;
  }
  function fieldRow(f) {
    var row = h('div', { class: 'fr k-' + f.kind, 'data-key': f.key });
    var input = control(f, row);
    var rs = h('button', { type: 'button', class: 'fr-rs', title: 'Trả về nội dung mặc định của website', text: '↺ Mặc định', hidden: true, onclick: function () { setValue(f, defDisp(f), row, true); } });
    var warn = h('p', { class: 'fr-warn', hidden: true }, ['Nội dung gốc của website đã thay đổi sau khi bạn sửa ô này, nên chỉnh sửa đang tạm bị bỏ qua. ',
      h('button', { type: 'button', text: 'Áp dụng lại', onclick: function () { var o = S.work.fields[f.key]; if (o) { o.o = S.cms.defHash(f); S.cms.setField(f, o); updateState(); refreshRow(row, f); } } }),
      h('button', { type: 'button', text: 'Bỏ chỉnh sửa', onclick: function () { setValue(f, defDisp(f), row, true); } })]);
    row.appendChild(h('div', { class: 'fr-h' }, [h('span', { class: 'fr-lb', text: labelOf(f) }), h('span', { class: 'fr-dot', title: 'Đã chỉnh sửa', text: '●' }), rs]));
    row.appendChild(input); row.appendChild(h('p', { class: 'fr-err', role: 'alert' })); row.appendChild(warn);
    setRowState(row, f);
    return row;
  }
  function refreshRow(row, f) {
    var inp = row.querySelector('textarea, input[type=text], input[type=url]'); if (inp && inp !== document.activeElement) { inp.value = curVal(f); autosize(inp); }
    var th = row.querySelector('.thumb img'); if (th) th.src = effectiveSrc(f);
    setRowState(row, f);
  }
  function autosize(t) { if (t.tagName !== 'TEXTAREA') return; t.style.height = 'auto'; t.style.height = Math.min(320, t.scrollHeight + 2) + 'px'; }
  function effectiveSrc(f) { var o = S.work.fields[f.key]; return o && SAN.img(o.v) ? SAN.img(o.v) : f.def.src; }

  function control(f, row) {
    var k = f.kind, v = curVal(f), inp;
    if (k === 'html' || k === 't' || k === 'md') {
      inp = h('textarea', { rows: 1, spellcheck: 'true', 'data-rich': k === 'html' ? '1' : null, placeholder: 'Để trống = dùng nội dung mặc định', 'aria-label': labelOf(f) });
      inp.value = v;
      inp.addEventListener('input', function () { setValue(f, inp.value, row); autosize(inp); });
      inp.addEventListener('focus', function () { S.lastTA = k === 'html' ? inp : null; el.tb.classList.toggle('on', k === 'html'); scrollPrev(f); });
      setTimeout(function () { autosize(inp); }, 0);
      return inp;
    }
    if (k === 'src') return imgControl(f, row);
    inp = h('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', placeholder: k === 'video' ? 'Dán liên kết YouTube (youtube.com/watch?v=… hoặc youtu.be/…)' : k === 'href' ? 'https://… hoặc /duong-dan-noi-bo' : 'Để trống = dùng nội dung mặc định', 'aria-label': labelOf(f) });
    inp.value = v;
    inp.addEventListener('input', function () { setValue(f, inp.value, row); });
    inp.addEventListener('focus', function () { el.tb.classList.remove('on'); S.lastTA = null; scrollPrev(f); });
    if (k === 'video') return h('div', {}, [inp, h('p', { class: 'ad-muted vid', text: f.def.opt ? 'Khung video đang ẩn trên website cho đến khi bạn dán liên kết YouTube.' : '' })]);
    return inp;
  }
  function imgControl(f, row) {
    var inp = h('input', { type: 'text', spellcheck: 'false', autocomplete: 'off', placeholder: 'Dán địa chỉ ảnh (https://…) hoặc tải ảnh lên', 'aria-label': labelOf(f) });
    inp.value = curVal(f);
    inp.addEventListener('input', function () { setValue(f, inp.value, row); });
    inp.addEventListener('focus', function () { el.tb.classList.remove('on'); S.lastTA = null; scrollPrev(f); });
    var pic = h('img', { alt: '', src: effectiveSrc(f) });
    var st = h('p', { class: 'ad-muted up-st' });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', hidden: true, onchange: function () { if (file.files[0]) upload(file.files[0]); file.value = ''; } });
    var btn = h('button', { type: 'button', class: 'btn btn-ghost sm', text: 'Tải ảnh lên', onclick: function () { file.click(); } });
    function upload(fl) {
      st.className = 'ad-muted up-st'; st.textContent = 'Đang xử lý ảnh…'; btn.disabled = true; S.uploads++;
      prepImage(fl).then(function (img) {
        st.textContent = 'Đang tải lên (' + Math.round(img.bytes / 1024) + ' KB)…';
        return api('upload', { name: fl.name, mime: img.mime, data: img.data });
      }).then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.message) || 'Không tải được ảnh lên.');
        inp.value = r.url; setValue(f, r.url, row); st.textContent = 'Đã tải lên. Nhớ bấm “Lưu tất cả”.';
      }).catch(function (e) { st.className = 'fr-err up-st'; st.textContent = e.message || 'Không tải được ảnh lên.'; })
        .then(function () { btn.disabled = false; S.uploads--; });
    }
    pic.addEventListener('error', function () { pic.classList.add('bad'); }); pic.addEventListener('load', function () { pic.classList.remove('bad'); });
    ['dragenter', 'dragover'].forEach(function (ev) { row.addEventListener(ev, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); row.classList.add('drop'); } }); });
    ['dragleave', 'drop'].forEach(function (ev) { row.addEventListener(ev, function () { row.classList.remove('drop'); }); });
    row.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); });
    return h('div', { class: 'imgc' }, [h('div', { class: 'thumb' }, [pic]), h('div', { class: 'imgc-r' }, [inp, h('div', { class: 'imgc-b' }, [btn, h('span', { class: 'ad-muted', text: 'hoặc kéo ảnh thả vào ô này' })]), st, file])]);
  }

  // dat gia tri mot o: rong/bang mac dinh = bo de; sai dinh dang = bao loi, khong de
  function setValue(f, v, row, fromReset) {
    var k = f.kind, err = '', ok = true, rowErr = row && row.querySelector('.fr-err');
    if (v === '' || v === defDisp(f)) delete S.work.fields[f.key];
    else {
      if (k === 'href' && !SAN.link(v)) { ok = false; err = 'Liên kết không hợp lệ. Chỉ nhận http(s), mailto, tel hoặc đường dẫn nội bộ (không có khoảng trắng).'; }
      if (k === 'src' && !SAN.img(v)) { ok = false; err = 'Địa chỉ ảnh phải bắt đầu bằng http:// hoặc https://'; }
      if (k === 'video' && !SAN.ytEmbed(v)) { ok = false; err = 'Chỉ nhận liên kết YouTube (youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…).'; }
      if (ok) S.work.fields[f.key] = { v: v, o: S.cms.defHash(f) }; else delete S.work.fields[f.key];
    }
    if (rowErr) rowErr.textContent = err;
    if (row) row.classList.toggle('bad', !!err);
    S.cms.setField(f, S.work.fields[f.key]);
    if (k === 'video' && row) { var vid = row.querySelector('.vid'), id = SAN.ytId(v); if (vid && v) vid.textContent = id ? '✔ Đã nhận video YouTube: ' + id : ''; if (vid && !v) vid.textContent = f.def.opt ? 'Khung video đang ẩn trên website cho đến khi bạn dán liên kết YouTube.' : ''; }
    if (fromReset && row) refreshRow(row, f); else if (row) { var th = row.querySelector('.thumb img'); if (th) th.src = effectiveSrc(f); setRowState(row, f); }
    if (f.item) { var it = row && row.closest('.li'); if (it && it._snip) it._snip(); }
    updateState();
  }

  function updateState() {
    if (!el.status) return;
    var n = dirtyCount();
    el.status.textContent = S.uploads ? 'Đang tải ảnh…' : n ? n + ' thay đổi chưa lưu' : 'Đã lưu · phiên bản ' + S.rev;
    el.status.classList.toggle('dirty', n > 0);
    el.save.disabled = n === 0 && !S.uploads; el.undo.disabled = n === 0;
    if (S.uploads) el.save.disabled = true;
    refreshBadges();
  }

  // ------------------------------------------------------------ khoi lap (them/xoa/sap thu tu)
  function ensureDesc(L) {
    var d = S.work.lists[L.key];
    if (!d || d.c !== L.orig.length) d = S.work.lists[L.key] = { c: L.orig.length, items: L.items.map(function (it) { return it.isNew ? { id: it.id, t: it.tpl } : { id: it.id }; }) };
    return d;
  }
  function commitList(L) {
    var d = S.work.lists[L.key];
    if (d && d.items.length === L.orig.length && d.items.every(function (x, i) { return x.id === L.orig[i].id && !x.t; })) delete S.work.lists[L.key]; // giong thu tu goc
    // don dep chinh sua cua cac muc da xoa
    var live = {}; (S.work.lists[L.key] ? S.work.lists[L.key].items : L.orig).forEach(function (x) { live[x.id] = 1; });
    var pre = L.key + '[';
    Object.keys(S.work.fields).forEach(function (k) { if (k.indexOf(pre) === 0) { var id = k.slice(pre.length, k.indexOf(']/', pre.length)); if (!live[id]) delete S.work.fields[k]; } });
    S.cms.applyData(S.M, S.work);
  }
  function itemTpl(L, i) { var it = L.items[i]; return it.isNew ? it.tpl : it.id; }
  function copyOverrides(L, fromId, toId) {
    var a = L.key + '[' + fromId + ']/', b = L.key + '[' + toId + ']/';
    Object.keys(S.work.fields).forEach(function (k) { if (k.indexOf(a) === 0) S.work.fields[b + k.slice(a.length)] = clone(S.work.fields[k]); });
  }
  function listBlock(L) {
    var box = h('div', { class: 'lst', 'data-key': L.key }), itemsBox = h('div', { class: 'lst-items' });
    var info = h('span', { class: 'lst-n' });
    var open = {};
    function render() {
      itemsBox.textContent = '';
      info.textContent = L.items.length + ' mục' + (L.stale ? ' · khối này đã thay đổi trên website nên thứ tự/số lượng đã sửa tạm bị bỏ qua' : '');
      L.items.forEach(function (it, i) { itemsBox.appendChild(itemEl(it, i)); });
      if (!L.items.length) itemsBox.appendChild(h('p', { class: 'ad-muted pad', text: 'Danh sách đang trống (đã xóa hết mục).' }));
    }
    function itemEl(it, i) {
      var sn = h('span', { class: 'sn' }), summary, body = h('div', { class: 'ib' }), filled = false;
      var d = h('details', { class: 'li' + (it.isNew ? ' new' : ''), 'data-id': it.id });
      function btn(icon, title, fn, dis) { var b = h('button', { type: 'button', class: 'ib-b', title: title, 'aria-label': title, disabled: dis, onclick: function (e) { e.preventDefault(); e.stopPropagation(); fn(); } }); b.appendChild(ico(icon)); return b; }
      summary = h('summary', {}, [h('span', { class: 'ix', text: String(i + 1) }), sn, it.isNew ? h('span', { class: 'tag', text: 'mới' }) : null, h('span', { class: 'ib-tools' }, [
        btn('up', 'Chuyển lên', function () { move(i, -1); }, i === 0), btn('down', 'Chuyển xuống', function () { move(i, 1); }, i === L.items.length - 1),
        btn('copy', 'Nhân đôi mục này', function () { dup(i); }), btn('trash', 'Xóa mục này', function () { del(i); })])]);
      d._snip = function () {
        var first = null; (function find(es) { es.forEach(function (e) { if (!first && e.type === 'field' && (e.field.kind === 'html' || e.field.kind === 't')) first = e.field; }); })(it.entries);
        sn.textContent = first ? snip(curVal(first), 70) || '(trống)' : '(mục ' + (i + 1) + ')';
      };
      d._fill = function () { if (filled) return; filled = true; fillEntries(body, it.entries); };
      d.addEventListener('toggle', function () { open[it.id] = d.open; if (d.open) d._fill(); });
      d.appendChild(summary); d.appendChild(body); d._snip();
      if (open[it.id]) { d.open = true; d._fill(); }
      return d;
    }
    function change(fn) { ensureDesc(L); fn(S.work.lists[L.key]); commitList(L); render(); updateState(); }
    function move(i, dir) { change(function (d) { var x = d.items.splice(i, 1)[0]; d.items.splice(i + dir, 0, x); }); }
    function dup(i) {
      var id = 'n' + rand(), src = L.items[i].id, tpl = itemTpl(L, i);
      open[id] = true; // mo san muc moi de sua ngay
      change(function (d) { d.items.splice(i + 1, 0, { id: id, t: tpl }); copyOverrides(L, src, id); });
      var nd = itemsBox.querySelectorAll('.li')[i + 1]; if (nd) nd.scrollIntoView({ block: 'nearest' });
    }
    function del(i) {
      confirmBox('Xóa mục này?', 'Mục “' + snip(itemsBox.querySelectorAll('.sn')[i].textContent, 50) + '” sẽ biến mất khỏi website sau khi bạn lưu. Bấm “Hoàn tác” để lấy lại nếu chưa lưu.', 'Xóa mục').then(function (ok) { if (ok) change(function (d) { d.items.splice(i, 1); }); });
    }
    L._render = render;
    var addBtn = h('button', { type: 'button', class: 'btn btn-ghost sm', text: '+ Thêm mục', title: 'Thêm một mục mới (sao chép mục cuối rồi bạn sửa nội dung)', onclick: function () { if (L.items.length) dup(L.items.length - 1); else change(function (d) { d.items.push({ id: 'n' + rand(), t: L.orig[0].id }); }); } });
    L._openItem = function (it) { open[it.id] = true; };
    box.appendChild(h('div', { class: 'lst-h' }, [h('strong', { text: 'Danh sách có thể thêm / xóa / sắp thứ tự' }), info, addBtn]));
    box.appendChild(itemsBox); render();
    return box;
  }

  // ------------------------------------------------------------ bam vao khung xem truoc -> mo dung o can sua
  function eachField(M, fn) {
    M.groups.forEach(function (g) { (function walk(es) { es.forEach(function (e) { if (e.type === 'field') fn(e.field); else e.list.items.forEach(function (it) { walk(it.entries); }); }); })(g.entries); });
  }
  function rowFor(key) { return [].filter.call(document.querySelectorAll('.fr'), function (r) { return r.dataset.key === key; })[0]; }
  function focusField(f) {
    el.search.value = ''; el.results.hidden = true; el.groups.hidden = false;
    var g = f.item ? f.item.list.group : f.group, gd = g && [].filter.call(el.groups.querySelectorAll('.grp'), function (x) { return x.dataset.g === g.id; })[0];
    if (!gd) return;
    gd.open = true; gd._fill();
    if (f.item) {
      var L = f.item.list, lb = [].filter.call(gd.querySelectorAll('.lst'), function (x) { return x.dataset.key === L.key; })[0];
      if (lb) { var idx = L.items.indexOf(f.item), it = lb.querySelectorAll(':scope > .lst-items > .li')[idx]; if (it) { it.open = true; it._fill(); } }
    }
    var row = rowFor(f.key); if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 1400);
    var inp = row.querySelector('textarea, input[type=text]'); if (inp) inp.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ tim kiem trong trang
  function runSearch() {
    var q = fold(el.search.value.trim());
    if (!q) { el.results.hidden = true; el.groups.hidden = false; return; }
    var out = [], more = 0;
    eachField(S.M, function (f) {
      var hay = fold(labelOf(f) + ' ' + curVal(f) + ' ' + (f.kind === 'html' || f.kind === 't' ? f.def : ''));
      if (hay.indexOf(q) < 0) return;
      if (out.length < 40) out.push(f); else more++;
    });
    el.results.textContent = ''; el.results.hidden = false; el.groups.hidden = true;
    el.results.appendChild(h('p', { class: 'ad-muted pad', text: out.length ? 'Tìm thấy ' + (out.length + more) + ' ô' + (more ? ' (hiện 40 ô đầu, hãy gõ cụ thể hơn)' : '') + ':' : 'Không có ô nào khớp.' }));
    out.forEach(function (f) { el.results.appendChild(fieldRow(f)); });
  }

  // ------------------------------------------------------------ dinh dang chu
  function keepFocus(e) { e.preventDefault(); } // bam nut khong lam mat vung chon trong o
  function wrapSel(tag) {
    var t = S.lastTA; if (!t) return;
    var a = t.selectionStart, b = t.selectionEnd, s = t.value;
    t.value = s.slice(0, a) + '<' + tag + '>' + s.slice(a, b) + '</' + tag + '>' + s.slice(b);
    t.focus(); t.setSelectionRange(a + tag.length + 2, b + tag.length + 2); t.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function wrapLink() {
    var t = S.lastTA; if (!t) return;
    var a = t.selectionStart, b = t.selectionEnd, s = t.value;
    var url = window.prompt('Dán địa chỉ liên kết (https://…, mailto:…, tel:… hoặc /duong-dan-noi-bo):', 'https://');
    if (!url) return;
    if (!SAN.link(url)) { toast('Liên kết không hợp lệ (chỉ nhận http, https, mailto, tel hoặc đường dẫn nội bộ).', true); return; }
    var nt = /^https?:/i.test(url) ? ' target="_blank"' : '', txt = s.slice(a, b) || 'liên kết';
    t.value = s.slice(0, a) + '<a href="' + url + '"' + nt + '>' + txt + '</a>' + s.slice(b);
    t.focus(); t.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ------------------------------------------------------------ anh: thu nho truoc khi tai len
  function prepImage(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return rej(new Error('Chỉ nhận ảnh JPG, PNG, WebP, GIF (không nhận SVG).'));
      var url = URL.createObjectURL(file), im = new Image();
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Không đọc được ảnh này.')); };
      im.onload = function () {
        URL.revokeObjectURL(url);
        var MAX = 1920, w = im.naturalWidth, hh = im.naturalHeight, sc = Math.min(1, MAX / Math.max(w, hh));
        if (file.type === 'image/gif' && file.size < 3.5 * 1024 * 1024) { return toB64(file).then(function (d) { res({ mime: 'image/gif', data: d, bytes: file.size }); }, rej); } // giu anh dong
        var tries = [[sc, 0.88], [sc * 0.8, 0.82], [sc * 0.6, 0.78]], i = 0;
        (function attempt() {
          var s = tries[i][0], c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(hh * s));
          var g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
          var alpha = false;
          if (file.type !== 'image/jpeg') { var px = g.getImageData(0, 0, c.width, c.height).data; for (var p = 3; p < px.length; p += 64) if (px[p] < 250) { alpha = true; break; } }
          var mime = alpha ? 'image/png' : 'image/jpeg';
          if (!alpha) { var bg = document.createElement('canvas'); bg.width = c.width; bg.height = c.height; var bgc = bg.getContext('2d'); bgc.fillStyle = '#fff'; bgc.fillRect(0, 0, bg.width, bg.height); bgc.drawImage(c, 0, 0); c = bg; }
          c.toBlob(function (blob) {
            if (!blob) return rej(new Error('Không xử lý được ảnh.'));
            if (blob.size > 3.8 * 1024 * 1024 && ++i < tries.length) return attempt();
            if (blob.size > 3.8 * 1024 * 1024) return rej(new Error('Ảnh quá lớn, hãy chọn ảnh nhỏ hơn.'));
            toB64(blob).then(function (d) { res({ mime: mime, data: d, bytes: blob.size }); }, rej);
          }, mime, tries[i][1]);
        })();
      };
      im.src = url;
    });
  }
  function toB64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(new Error('Không đọc được tệp.')); }; r.readAsDataURL(blob); }); }

  // ------------------------------------------------------------ luu, hoan tac, thoat
  function save() {
    if (!isDirty() || S.uploads) return;
    el.save.disabled = true; el.save.textContent = 'Đang lưu…';
    var payload = { rev: S.rev, fields: S.work.fields, lists: S.work.lists };
    api('save', payload).then(function (r) {
      el.save.textContent = 'Lưu tất cả';
      if (r && r.ok) {
        S.rev = r.rev; S.base = { fields: r.fields || {}, lists: r.lists || {} }; S.work = clone(S.base);
        S.cms.applyData(S.M, S.work); renderForm(); toast('Đã lưu lên website (phiên bản ' + r.rev + '). Người xem sẽ thấy ngay khi tải lại trang.');
      } else if (r && r.code === 'conflict') {
        modal('Nội dung đã được lưu từ nơi khác', h('p', { text: 'Có người (hoặc một cửa sổ khác của bạn) vừa lưu thay đổi. Bạn muốn làm gì?' }), [
          { text: 'Tải lại bản mới (bỏ thay đổi chưa lưu)', run: function () { location.reload(); } },
          { text: 'Lưu đè bản của tôi', cls: 'btn-red', run: function () { S.rev = r.rev; save(); } },
        ]);
      } else toast((r && r.message) || 'Không lưu được. Thử lại.', true);
      updateState();
    });
  }
  function undo() {
    if (!isDirty()) return;
    confirmBox('Hoàn tác thay đổi?', 'Mọi thay đổi chưa lưu (' + dirtyCount() + ' mục) sẽ bị bỏ, nội dung quay lại bản đã lưu gần nhất.', 'Hoàn tác').then(function (ok) {
      if (!ok) return;
      S.work = clone(S.base); S.cms.applyData(S.M, S.work); renderForm(); toast('Đã hoàn tác về bản đã lưu.');
    });
  }
  function logout() {
    var go = function () { clearSession(); viewLogin(); };
    if (isDirty()) confirmBox('Đăng xuất?', 'Còn thay đổi chưa lưu. Đăng xuất sẽ mất các thay đổi này.', 'Đăng xuất').then(function (ok) { if (ok) go(); }); else go();
  }
  window.addEventListener('beforeunload', function (e) { if (S.token && (isDirty() || S.uploads)) { e.preventDefault(); e.returnValue = ''; return ''; } });
  window.addEventListener('dragover', function (e) { e.preventDefault(); }); window.addEventListener('drop', function (e) { e.preventDefault(); }); // tha tep ra ngoai o: khong mo anh thay trang
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.token && el.save) { e.preventDefault(); save(); } });

  function passwordDialog() {
    var o = h('input', { type: 'password', id: 'pw0', autocomplete: 'current-password' }), n = h('input', { type: 'password', id: 'pw1', autocomplete: 'new-password' }), c = h('input', { type: 'password', id: 'pw2', autocomplete: 'new-password' });
    var err = h('p', { class: 'ad-err', role: 'alert' });
    var body = h('div', { class: 'ad-login' }, [h('label', { for: 'pw0', text: 'Mật khẩu hiện tại' }), o, h('label', { for: 'pw1', text: 'Mật khẩu mới (tối thiểu 8 ký tự)' }), n, h('label', { for: 'pw2', text: 'Nhập lại mật khẩu mới' }), c, err]);
    modal('Đổi mật khẩu', body, [{ text: 'Hủy' }, { text: 'Đổi mật khẩu', cls: 'btn-red', run: function () {
      err.textContent = '';
      if (n.value.length < 8) { err.textContent = 'Mật khẩu mới tối thiểu 8 ký tự.'; return false; }
      if (n.value !== c.value) { err.textContent = 'Hai lần nhập mật khẩu mới không giống nhau.'; return false; }
      api('passwd', { old: o.value, pass: n.value }).then(function (r) {
        if (r && r.ok) { toast(r.message); clearSession(); S.work = clone(S.base); viewLogin(); document.querySelector('.ad-modal') && document.querySelector('.ad-modal').remove(); }
        else toast((r && r.message) || 'Không đổi được mật khẩu.', true);
      });
      return false;
    } }]);
  }

  // ------------------------------------------------------------ khoi dong
  if (!ENDPOINT) viewSetup();
  else if (loadSession()) startApp();
  else viewLogin();
})();
