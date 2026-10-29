// site.js (v2) - hanh vi giao dien website VTF (khong phu thuoc thu vien)
(function () {
  var doc = document, root = doc.documentElement;
  var BASE = (doc.currentScript && doc.currentScript.dataset.base) || '';
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  var toastEl = $('.toast'), toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  // ---- menu mobile ----
  var navBtn = $('.nav-toggle'), nav = $('#site-nav');
  function setNav(open) {
    if (!navBtn || !nav) return;
    navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    navBtn.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    nav.classList.toggle('open', open);
    doc.body.classList.toggle('nav-open', open);
    // menu phu kin man hinh: phim Tab khong duoc lot xuong noi dung bi che phia sau
    $$('main, .site-footer, .to-top, .skip').forEach(function (el) { el.inert = open; });
    if (open) { var first = $('.nav-link', nav); if (first) first.focus(); }
  }
  if (navBtn) navBtn.addEventListener('click', function () { setNav(navBtn.getAttribute('aria-expanded') !== 'true'); });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (nav && nav.classList.contains('open')) { setNav(false); navBtn.focus(); return; }
    // may tinh: menu con hien khi re chuot/focus -> Escape an di (WCAG 1.4.13)
    $$('.has-sub').forEach(function (li) {
      if (!(li.matches(':hover') || li.contains(doc.activeElement))) return;
      // focus dang o muc con sap bi an -> dua ve muc cha, khong de roi ve <body>
      var sub = $('.sub', li);
      if (sub && sub.contains(doc.activeElement)) $('.nav-link', li).focus();
      li.classList.add('dismissed');
    });
  });
  $$('.has-sub').forEach(function (li) {
    var undo = function () { li.classList.remove('dismissed'); };
    li.addEventListener('mouseleave', undo);
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) undo(); });
  });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
  $$('.sub-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sub = doc.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (sub) sub.classList.toggle('open', open);
    });
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) setNav(false); });

  // ---- giao dien sang/toi (ghi nho trong trinh duyet) ----
  var themeBtn = $('.theme-toggle');
  function applyTheme(t) {
    root.dataset.theme = t;
    if (themeBtn) themeBtn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false'); // nhan "Giao diện tối" giu nguyen
  }
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  var darkMq = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', function (e) {
    var saved = null; try { saved = localStorage.getItem('vtf-theme'); } catch (_) { /* bi chan luu tru */ }
    if (!saved) applyTheme(e.matches ? 'dark' : 'light');
  });
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t);
    try { localStorage.setItem('vtf-theme', t); } catch (e) { /* trinh duyet chan luu tru: van doi giao dien cho phien nay */ }
  });

  // ---- nut ve dau trang + thanh tien do doc ----
  var toTop = $('.to-top'), bar = $('.progress span'), ticking = false;
  function onScroll() {
    var y = window.scrollY, h = doc.documentElement.scrollHeight - window.innerHeight;
    if (toTop) toTop.hidden = y < 600;
    if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    var m = doc.getElementById('noi-dung'); if (m) m.focus({ preventScroll: true });
  });

  // ---- danh dau muc dang xem (tab trong trang, muc luc Dieu le) ----
  // cuon rieng hop chua (khong dung scrollIntoView vi se keo ca trang)
  function keepVisible(a) {
    for (var box = a.parentElement; box && box !== doc.body; box = box.parentElement) {
      var cs = getComputedStyle(box);
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (box.scrollHeight > box.clientHeight || box.scrollWidth > box.clientWidth)) break;
    }
    if (!box || box === doc.body) return;
    var ar = a.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (ar.top < br.top || ar.bottom > br.bottom) box.scrollTop += ar.top - br.top - br.height / 2;
    if (ar.left < br.left || ar.right > br.right) box.scrollLeft += ar.left - br.left - 16;
  }
  function spy(links, targets, margin) {
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').split('#')[1]] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = map[en.target.id];
        if (!a) return;
        links.forEach(function (x) { x.classList.remove('is-active'); x.removeAttribute('aria-current'); });
        a.classList.add('is-active'); a.setAttribute('aria-current', 'true');
        keepVisible(a);
      });
    }, { rootMargin: margin });
    targets.forEach(function (t) { io.observe(t); });
  }
  var tabLinks = $$('.tabs a[href^="#"]');
  spy(tabLinks, tabLinks.map(function (a) { return doc.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean), '-30% 0px -60% 0px');
  spy($$('.toc a[href^="#dieu-"]'), $$('.dieu'), '-20% 0px -70% 0px');

  // ---- muc luc Dieu le: tu dong thu gon tren man hinh nho ----
  var toc = $('.toc');
  if (toc && window.innerWidth <= 1024) toc.removeAttribute('open'); // du phong; script ngay sau muc luc da thu gon truoc khi ve
  var wideMq = window.matchMedia && matchMedia('(min-width: 1025px)');
  if (toc && wideMq && wideMq.addEventListener) wideMq.addEventListener('change', function (e) { if (e.matches) toc.setAttribute('open', ''); else toc.removeAttribute('open'); });
  if (toc) toc.addEventListener('click', function (e) { if (e.target.closest('a') && window.innerWidth <= 1024) toc.removeAttribute('open'); });

  // ---- sao chep lien ket tung Dieu ----
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (ok, fail) {
      var ta = doc.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); } finally { ta.remove(); }
    });
  }
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.copy-link');
    if (!btn) return;
    var url = location.origin + location.pathname + '#' + btn.dataset.target;
    copyText(url).then(function () { toast('Đã sao chép liên kết'); history.replaceState(null, '', location.pathname + location.search + '#' + btn.dataset.target); },
      function () { toast('Không sao chép được – hãy chép từ thanh địa chỉ'); });
  });

  // ---- tim kiem trong Dieu le ----
  // Go khong dau: khop moi thanh dieu ("hoi phi" -> "hội phí"). Go co dau: tu co dau phai dung dau ("hỏi" khong khop "hội").
  var q = $('#dl-q'), status = $('#dl-status'), body = $('.charter-body');
  if (q && body) {
    var fold = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };
    var lower = function (s) { return s.normalize('NFC').toLowerCase(); };
    var articles = $$('.dieu', body), chapters = $$('.chuong', body), noRes = $('.no-result', body);
    var original = new Map(), texts = new Map();
    function snapshot() {
      articles.forEach(function (a) {
        original.set(a, a.innerHTML);
        // noi cac khoi bang dau cach de chu dau doan khong dinh vao tieu de
        var t = $$('.dieu-t, p, li', a).map(function (e) { return e.textContent; }).join(' ').normalize('NFC').replace(/\s+/g, ' ');
        texts.set(a, { f: fold(t), l: lower(t) });
      });
    }
    snapshot();
    var tocItems = $$('.toc li');
    var timer;
    // dau thanh dat theo kieu cu/moi deu dung ("tùy"/"tuỳ", "xóa"/"xoá", "ủy"/"uỷ") -> dua ve mot kieu truoc khi so
    var canon = function (w) {
      return w.normalize('NFD').replace(/([oO])([̣̀́̃̉])([aAeE])/g, '$1$3$2').replace(/([uU])([̣̀́̃̉])([yY])/g, '$1$3$2').normalize('NFC');
    };
    // tu nguoi dung go co dau thi doan van tuong ung phai trung tung chu (khong phan biet vi tri dau thanh)
    function accentOk(seg, typed) {
      var a = seg.split(/\s+/), b = typed.split(' ');
      for (var k = 0; k < b.length; k++) if (b[k] !== fold(b[k]) && canon(a[k] || '') !== canon(b[k])) return false;
      return true;
    }
    // term = { f: dang bo dau, l: dang da go (NFC, chu thuong) }; f va l cua van ban cung do dai nen dung chung vi tri
    function hits(f, l, term) {
      var out = [], t = term.f, i = f.indexOf(t);
      while (i !== -1) {
        var start = i === 0 || !/[a-z0-9]/.test(f.charAt(i - 1));
        var numEnd = !(/\d$/.test(t) && /\d/.test(f.charAt(i + t.length))); // "Điều 1" khong khop "Điều 12"
        if (start && numEnd && accentOk(l.slice(i, i + t.length), term.l)) out.push([i, i + t.length]);
        i = f.indexOf(t, i + 1);
      }
      return out;
    }
    function termsOf(raw) {
      var typed = lower(raw).replace(/\s+/g, ' ').trim();
      var phrase = { f: fold(typed), l: typed };
      var words = typed.split(' ').filter(function (w) { return w.length > 1 || /\d/.test(w); }).map(function (w) { return { f: fold(w), l: w }; });
      // nhieu tu: uu tien khop nguyen cum; khong co cum nao thi khop tung tu
      var usePhrase = typed.indexOf(' ') !== -1 && articles.some(function (a) { var x = texts.get(a); return hits(x.f, x.l, phrase).length; });
      return usePhrase ? [phrase] : words;
    }
    function highlight(el, terms) {
      var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.parentNode.closest('button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
      var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        var text = node.nodeValue.normalize('NFC'), f = fold(text), l = lower(text);
        var found = [];
        terms.forEach(function (t) { found = found.concat(hits(f, l, t)); });
        if (!found.length) return;
        found.sort(function (a, b) { return a[0] - b[0]; });
        var frag = doc.createDocumentFragment(), pos = 0;
        found.forEach(function (h) {
          if (h[0] < pos) return;
          frag.appendChild(doc.createTextNode(text.slice(pos, h[0])));
          var m = doc.createElement('mark'); m.textContent = text.slice(h[0], h[1]); frag.appendChild(m);
          pos = h[1];
        });
        frag.appendChild(doc.createTextNode(text.slice(pos)));
        node.parentNode.replaceChild(frag, node);
      });
    }
    function run(push) {
      var raw = q.value.trim(), terms = raw ? termsOf(raw) : [];
      var shown = 0;
      articles.forEach(function (a) {
        a.innerHTML = original.get(a);
        if (!terms.length) { a.classList.remove('is-hidden'); return; }
        var x = texts.get(a), ok = terms.every(function (t) { return hits(x.f, x.l, t).length > 0; });
        a.classList.toggle('is-hidden', !ok);
        if (ok) { shown++; highlight(a, terms); }
      });
      chapters.forEach(function (c) { c.classList.toggle('is-hidden', terms.length > 0 && !$$('.dieu:not(.is-hidden)', c).length); });
      tocItems.forEach(function (li) {
        var a = $('a', li), id = a && a.getAttribute('href').slice(1), el = id && doc.getElementById(id);
        li.classList.toggle('is-hidden', terms.length > 0 && !!el && el.classList.contains('is-hidden'));
      });
      if (noRes) noRes.hidden = !(terms.length && !shown);
      status.textContent = !raw ? '' : !terms.length ? 'Hãy gõ ít nhất 2 ký tự.'
        : shown ? 'Tìm thấy ' + shown + ' điều khớp với “' + raw + '”.' : 'Không có điều nào khớp với “' + raw + '”.';
      if (push) {
        var u = new URL(location.href);
        if (raw) u.searchParams.set('q', raw); else u.searchParams.delete('q');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
    }
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { run(true); }, 180); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; run(true); } });
    // noi dung do quan tri sua (cms-core.js) ap sau khi trang tai xong: chup lai de tim kiem khong tra ve ban cu
    doc.addEventListener('vtf:cms-applied', function () { snapshot(); if (q.value.trim()) run(false); });
    // ban in luon day du 29 dieu: tam bo loc tim kiem khi in, khoi phuc sau khi in
    var printSaved = '';
    window.addEventListener('beforeprint', function () { printSaved = q.value; if (printSaved) { q.value = ''; run(false); } });
    window.addEventListener('afterprint', function () { if (printSaved) { q.value = printSaved; run(false); printSaved = ''; } });
    var init = new URLSearchParams(location.search).get('q');
    if (init) { q.value = init; run(false); }
  }

  // ---- lich thi dau: loc theo cap giai (khong co JS thi hien du lich, an bo loc) ----
  $$('.cal-tools').forEach(function (tools) {
    var sec = tools.closest('section'), out = $('.cal-status', tools);
    tools.hidden = false;
    tools.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cap]');
      if (!b) return;
      $$('button[data-cap]', tools).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var cap = b.dataset.cap, n = 0;
      $$('.event', sec).forEach(function (ev) { var ok = !cap || ev.dataset.cap === cap; ev.hidden = !ok; if (ok) n++; });
      $$('.tl-month', sec).forEach(function (m) { m.hidden = !$$('.event:not([hidden])', m).length; });
      out.textContent = cap ? 'Đang hiện ' + n + ' giải ' + cap.toLowerCase() + '.' : 'Đang hiện tất cả ' + n + ' giải.';
    });
  });

  // ---- moc thoi gian Dai hoi: danh dau "Đã qua" / "Sắp tới" theo ngay xem trang (khong co JS thi hien danh sach thuong) ----
  var nextSet = false, now = Date.now();
  // bang thong bao Dai hoi o trang chu: het Dai hoi ma web chua duoc tao lai thi tu an
  $$('.dh-banner[data-end]').forEach(function (b) { if (Date.parse(b.dataset.end) < now) { var s = b.closest('section'); if (s) s.hidden = true; } });
  $$('.ms-list li[data-end]').forEach(function (li) {
    var end = Date.parse(li.dataset.end), tag = $('.ms-state', li);
    if (isNaN(end)) return;
    if (end < now) { li.classList.add('is-past'); tag.textContent = 'Đã qua'; }
    else if (!nextSet) { li.classList.add('is-next'); tag.textContent = 'Sắp tới'; nextSet = true; }
  });

  // ---- loc danh sach (vd 50 trong tai) theo ten / don vi; go khong dau van tim duoc ----
  var foldText = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };
  $$('.roster-filter').forEach(function (inp) {
    var table = doc.getElementById(inp.getAttribute('aria-controls')), out = doc.getElementById(inp.dataset.status);
    if (!table) return;
    inp.addEventListener('input', function () {
      var raw = inp.value.trim(), q = foldText(raw).replace(/\s+/g, ' '), n = 0;
      // doc lai cac hang moi lan go (quan tri co the da them/xoa/sua nguoi trong bang)
      $$('tbody tr', table).forEach(function (tr) { var ok = !q || foldText(tr.textContent).replace(/\s+/g, ' ').indexOf(q) !== -1; tr.hidden = !ok; if (ok) n++; });
      if (out) out.textContent = q ? (n ? 'Có ' + n + ' người khớp với “' + raw + '”.' : 'Không có ai khớp với “' + raw + '”.') : '';
    });
  });

  // ---- in: mo het khoi thu gon truoc khi in ----
  $$('.print-btn').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  var reopened = [];
  window.addEventListener('beforeprint', function () { $$('details:not([open])').forEach(function (d) { d.setAttribute('open', ''); reopened.push(d); }); });
  window.addEventListener('afterprint', function () { reopened.forEach(function (d) { d.removeAttribute('open'); }); reopened = []; });

  // ---- lien ket #id toi mot khoi thu gon: mo khoi do ----
  function openTarget() {
    var el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  openTarget();
  window.addEventListener('hashchange', openTarget);

  // ---- bieu mau dang ky: hoi vien, lien he, nhan tin (chi co tren trang khi website da noi may chu Apps Script) ----
  var cmsTag = $('script[data-endpoint]'), EP = cmsTag ? cmsTag.getAttribute('data-endpoint') : '';
  var RE_EMAIL = /^[a-z0-9][a-z0-9._%+']*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i, RE_PHONE = /^\+?\d{8,15}$/;
  $$('form[data-vtf-form]').forEach(function (form) {
    if (!EP) return;
    var kind = form.getAttribute('data-vtf-form'), statusEl = $('.vf-status', form), btn = $('button[type=submit]', form), t0 = Date.now(), busy = false;
    var rowDD = $('[data-f=daiDien]', form);
    form.hidden = false;

    function setStatus(msg, cls) { statusEl.textContent = msg; statusEl.className = 'vf-status' + (cls ? ' is-' + cls : ''); }
    function setErr(name, msg) {
      var row = $('[data-f="' + name + '"]', form); if (!row) return;
      var e = $('.vf-err', row), c = $('input,select,textarea', row);
      e.textContent = msg || ''; e.hidden = !msg;
      if (c) { if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid'); }
    }
    function rowReq(row) { if (row.getAttribute('data-f') === 'dongY') return true; var s = $('.req', row); return !!s && !s.hidden; }
    // loai hoi vien: chi hoi to chuc moi bat buoc nhap nguoi dai dien
    function syncLoai() { if (!rowDD || !form.elements.loai) return; var s = $('.req', rowDD); if (s) s.hidden = form.elements.loai.value !== 'to-chuc'; }
    if (form.elements.loai) { $$('input[name=loai]', form).forEach(function (r) { r.addEventListener('change', syncLoai); }); syncLoai(); }

    function validate() {
      var first = null, f = {}, n = 0;
      $$('[data-f]', form).forEach(function (row) {
        var k = row.getAttribute('data-f'), msg = '';
        if (k === 'dongY') { f[k] = form.elements.dongY.checked; if (!f[k]) msg = 'Bạn cần đồng ý để gửi thông tin.'; }
        else {
          var el = form.elements[k], v = String(el && el.value != null ? el.value : '').trim();
          f[k] = v;
          if (!v) { if (rowReq(row)) msg = (el && (el.tagName === 'SELECT' || el.type === undefined)) ? 'Vui lòng chọn một mục.' : 'Vui lòng nhập mục này.'; }
          else if (k === 'email' && !RE_EMAIL.test(v)) msg = 'Email chưa hợp lệ.';
          else if (k === 'dienThoai' && !RE_PHONE.test(v.replace(/[\s.\-()]/g, ''))) msg = 'Số điện thoại chưa hợp lệ (8 đến 15 chữ số).';
          else if (k === 'noiDung' && v.length < 10) msg = 'Nhập ít nhất 10 ký tự.';
        }
        setErr(k, msg);
        if (msg) { n++; if (!first) first = row; }
      });
      return { f: f, n: n, first: first };
    }
    function focusRow(row) { var c = row && $('input,select,textarea', row); if (c) c.focus(); }
    function fail(msg) { setStatus(msg + ' ' + (form.getAttribute('data-fallback') || ''), 'err'); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var r = validate();
      if (r.n) { setStatus('Vui lòng kiểm tra lại ' + r.n + ' mục được đánh dấu.', 'err'); focusRow(r.first); return; }
      var path = location.pathname, body = { action: 'submit', kind: kind, f: r.f, t: Date.now() - t0, hp: form.elements.hp ? form.elements.hp.value : '', page: (BASE && path.indexOf(BASE) === 0 ? path.slice(BASE.length) : path) || '/' };
      busy = true; btn.disabled = true; setStatus('Đang gửi…', '');
      var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
      fetch(EP, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, credentials: 'omit' })
        .then(function (res) { return res.json(); })
        .then(function (j) {
          if (j && j.ok) {
            var t = j.ref ? form.getAttribute('data-ok-ref').replace('{ref}', j.ref) : form.getAttribute('data-ok');
            form.reset(); syncLoai(); $$('[data-f]', form).forEach(function (row) { setErr(row.getAttribute('data-f'), ''); });
            t0 = Date.now(); setStatus(t, 'ok');
          } else if (j && j.errors) {
            var first = null, n = 0;
            Object.keys(j.errors).forEach(function (k) { setErr(k, String(j.errors[k])); n++; if (!first) first = $('[data-f="' + k + '"]', form); });
            setStatus('Vui lòng kiểm tra lại ' + n + ' mục được đánh dấu.', 'err'); focusRow(first);
          } else fail(String((j && j.message) || 'Chưa gửi được thông tin.'));
        })
        .catch(function () { fail('Không gửi được (lỗi kết nối).'); })
        .then(function () { clearTimeout(timer); busy = false; btn.disabled = false; });
    });
  });

  // ---- service worker (doc offline, mo nhanh) ----
  var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', function () { navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' }).catch(function () {}); });
  }
})();
