// site.js - menu mobile, muc con, danh dau muc luc dang doc
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  function setNav(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.querySelector('.sr').textContent = open ? 'Đóng menu' : 'Mở menu';
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
  }
  if (toggle) toggle.addEventListener('click', function () { setNav(toggle.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
  // bam link trong menu mobile -> dong menu (ke ca link toi muc tren cung trang)
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });

  // nut mo muc con tren mobile
  document.querySelectorAll('.sub-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sub = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (sub) sub.classList.toggle('open', open);
    });
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) setNav(false); });

  // muc luc Dieu le: to sang Dieu dang doc
  var tocLinks = document.querySelectorAll('.toc a[href^="#dieu-"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.remove('is-active'); });
        var a = map[en.target.id];
        if (a) { a.classList.add('is-active'); }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.dieu').forEach(function (el) { io.observe(el); });
  }
})();
