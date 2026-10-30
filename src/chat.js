/* chat.js - tro ly ao "LinhKate" (thu ky VTF) tren website Lien doan Taekwondo Viet Nam.
   - Chi hien nut chat khi may chu bao san sang (GET /api/chat -> ready). Khong co khoa API o day: moi cau hoi di qua /api/chat.
   - Noi dung tra loi duoc dung bang textContent (khong innerHTML) nen khong the chen ma. */
(function () {
  'use strict';
  var doc = document, script = doc.currentScript;
  var BASE = (script && script.dataset.base) || '';
  var API = BASE + '/api/chat';
  var KEY_READY = 'vtf-chat-ready', KEY_LOG = 'vtf-chat-log';
  var GREETING = 'Dạ, em là LinhKate, thư ký VTF. Anh/chị cần em hỗ trợ thông tin gì ạ?';
  var SUGGEST = ['Thủ tục gia nhập hội viên', 'Lịch thi đấu sắp tới', 'Địa chỉ, điện thoại Văn phòng', 'Điều lệ và văn bản ở đâu?'];
  var MAX_LEN = 500, KEEP = 12;

  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* che do rieng tu */ } }
  };

  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  var icon = function (id) {
    var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = doc.createElementNS('http://www.w3.org/2000/svg', 'use');
    s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    u.setAttribute('href', '#i-' + id); s.appendChild(u); return s;
  };
  var url = function (u) { return /^https?:/i.test(u) ? u : BASE + u; };

  // **chu dam** va gach dau dong "- " -> phan tu an toan (khong dung innerHTML)
  function inline(parent, text) {
    text.split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) parent.appendChild(el('strong', { text: part.slice(2, -2) }));
      else if (part) parent.appendChild(doc.createTextNode(part.replace(/\*\*/g, '')));
    });
  }
  function render(text) {
    var box = el('div', { class: 'chat-text' }), list = null;
    text.split('\n').forEach(function (line) {
      var m = /^\s*[-•*]\s+(.*)$/.exec(line);
      if (m) { if (!list) { list = el('ul'); box.appendChild(list); } var li = el('li'); inline(li, m[1]); list.appendChild(li); return; }
      list = null;
      if (line.trim()) { var p = el('p'); inline(p, line.trim()); box.appendChild(p); }
    });
    return box;
  }

  function init() {
    var log = store.get(KEY_LOG) || [];
    var pending = false, lastSent = 0, open = false;

    var fab = el('button', { class: 'chat-fab', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'chat-panel', 'aria-label': 'Mở trò chuyện với LinhKate, thư ký VTF' },
      [icon('chat'), el('span', { class: 'chat-fab-t', text: 'Hỏi LinhKate' })]);
    var closeBtn = el('button', { class: 'chat-x', type: 'button', 'aria-label': 'Đóng trò chuyện' }, [icon('x')]);
    var resetBtn = el('button', { class: 'chat-reset', type: 'button', text: 'Làm mới' });
    var msgs = el('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    var chips = el('div', { class: 'chat-chips' });
    var input = el('textarea', { class: 'chat-in', rows: '1', maxlength: String(MAX_LEN), placeholder: 'Nhập câu hỏi của anh/chị…', 'aria-label': 'Câu hỏi gửi LinhKate', enterkeyhint: 'send' });
    var send = el('button', { class: 'chat-send', type: 'submit', 'aria-label': 'Gửi câu hỏi' }, [icon('arrow-right')]);
    var form = el('form', { class: 'chat-form', novalidate: true }, [input, send]);
    var panel = el('section', { class: 'chat-panel', id: 'chat-panel', role: 'dialog', 'aria-label': 'Trợ lý ảo LinhKate', hidden: true }, [
      el('header', { class: 'chat-head' }, [
        el('span', { class: 'chat-av', 'aria-hidden': 'true', text: 'LK' }),
        el('div', { class: 'chat-who' }, [el('strong', { text: 'LinhKate' }), el('span', { text: 'Thư ký VTF · Trợ lý AI' })]),
        resetBtn, closeBtn]),
      msgs, chips, form,
      el('p', { class: 'chat-note' }, [
        'LinhKate là trợ lý AI, trả lời theo nội dung website và có thể chưa đầy đủ. Xin đừng nhập số căn cước, mật khẩu hay thông tin cá nhân. ',
        el('a', { href: BASE + '/quyen-rieng-tu', text: 'Quyền riêng tư' })])
    ]);
    doc.body.appendChild(fab); doc.body.appendChild(panel); doc.body.classList.add('has-chat');

    function bubble(role, text, extra) {
      var b = el('div', { class: 'chat-msg ' + (role === 'user' ? 'me' : 'bot') }, [role === 'user' ? el('p', { text: text }) : render(text)]);
      if (extra) {
        if (extra.images && extra.images.length) b.appendChild(el('div', { class: 'chat-imgs' }, extra.images.map(function (im) {
          return el('a', { href: url(im.url), title: im.alt }, [el('img', { src: url(im.src), alt: im.alt, loading: 'lazy', width: '120', height: '120' })]);
        })));
        if (extra.sources && extra.sources.length) b.appendChild(el('div', { class: 'chat-src' }, [el('span', { text: 'Xem thêm trên website:' }), el('ul', null, extra.sources.map(function (s) {
          return el('li', null, [el('a', { href: url(s.url), text: s.title })]);
        }))]));
        if (extra.links && extra.links.length) b.appendChild(el('div', { class: 'chat-src' }, [el('span', { text: 'Liên kết, tệp liên quan:' }), el('ul', null, extra.links.map(function (s) {
          var ext = /^https?:/i.test(s.url);
          return el('li', null, [el('a', { href: url(s.url), text: s.title || s.url, target: '_blank', rel: 'noopener' })]);
        }))]));
      }
      msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight; return b;
    }
    function paint() {
      msgs.textContent = '';
      bubble('bot', GREETING);
      log.forEach(function (m) { bubble(m.role, m.content, m.extra); });
      chips.hidden = log.length > 0;
    }
    SUGGEST.forEach(function (q) { chips.appendChild(el('button', { type: 'button', class: 'chat-chip', text: q, 'data-q': q })); });
    chips.addEventListener('click', function (e) { var q = e.target.getAttribute && e.target.getAttribute('data-q'); if (q) ask(q); });

    function setOpen(v) {
      open = v; panel.hidden = !v; fab.setAttribute('aria-expanded', String(v)); fab.hidden = v && matchMedia('(max-width: 640px)').matches;
      if (v) { paint(); input.focus(); } else fab.focus();
    }
    fab.addEventListener('click', function () { setOpen(true); });
    closeBtn.addEventListener('click', function () { setOpen(false); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } });
    resetBtn.addEventListener('click', function () { log = []; store.set(KEY_LOG, log); paint(); input.focus(); });

    function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; }
    input.addEventListener('input', grow);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit(); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    function submit() { var q = input.value.trim(); if (q) ask(q); }

    // cau tra loi loi (may chu ban/Kira truc trac): them nut "Thu lai" gui lai dung cau hoi, khong bat khach go lai
    function addRetry(b, q) {
      var btn = el('button', { type: 'button', class: 'chat-retry', text: 'Thử lại' });
      btn.addEventListener('click', function () { if (pending) return; b.remove(); ask(q, true); });
      b.appendChild(btn);
    }
    function ask(q, retry) {
      q = q.slice(0, MAX_LEN);
      if (pending || (!retry && Date.now() - lastSent < 1200)) return;
      pending = true; lastSent = Date.now(); send.disabled = true; chips.hidden = true;
      if (!retry) { input.value = ''; grow(); }
      log.push({ role: 'user', content: q }); if (!retry) bubble('user', q);
      var typing = el('div', { class: 'chat-msg bot chat-typing', 'aria-label': 'LinhKate đang soạn câu trả lời' }, [el('span'), el('span'), el('span')]);
      msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
      var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { ctl && ctl.abort(); }, 40000);
      var history = log.slice(-KEEP).map(function (m) { return { role: m.role, content: m.content }; });
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }), signal: ctl ? ctl.signal : undefined, credentials: 'omit' })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (d) {
          var text = d && d.answer ? d.answer : 'Dạ, em đang gặp trục trặc nên chưa trả lời được ngay. Anh/chị vui lòng thử lại sau hoặc xem trang Liên hệ ạ.';
          var extra = d && d.ok ? { sources: d.sources, links: d.links, images: d.images } : null;
          typing.remove(); var bb = bubble('bot', text, extra);
          if (d && d.ok) log.push({ role: 'assistant', content: text, extra: extra });
          else {
            log.pop();          // cau loi khong dua vao lich su gui len mo hinh
            if (!d || ['upstream', 'timeout', 'busy', 'kb', 'empty'].indexOf(d.code) >= 0) addRetry(bb, q);
          }
          if (log.length > 30) log = log.slice(-30);
          store.set(KEY_LOG, log);
        })
        .catch(function () {
          typing.remove(); log.pop();
          addRetry(bubble('bot', 'Dạ, em chưa kết nối được. Anh/chị vui lòng kiểm tra mạng rồi hỏi lại giúp em ạ.'), q);
        })
        .then(function () { clearTimeout(timer); pending = false; send.disabled = false; if (open) input.focus(); });
    }
    // mo san khi duong dan co #hoi-linhkate (vd. lien ket tu noi khac)
    if (location.hash === '#hoi-linhkate') setOpen(true);
  }

  function boot() {
    var cached = store.get(KEY_READY);
    if (cached && Date.now() - cached.t < 5 * 60e3) { if (cached.v) init(); return; }
    fetch(API, { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var ok = Boolean(d && d.ready); store.set(KEY_READY, { t: Date.now(), v: ok }); if (ok) init();
    }).catch(function () { /* khong co may chu chat (vd. ban tinh tren GitHub Pages): khong hien nut */ });
  }
  var start = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 800); })(boot); };
  if (doc.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
