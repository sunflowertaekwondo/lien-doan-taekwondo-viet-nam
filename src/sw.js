// sw.js - service worker cua website VTF (build.mjs dien phien ban, duong dan goc va danh sach tai truoc)
// HTML: lay ban moi tu mang truoc (luon cap nhat), luu lai de doc khi mat mang; tai nguyen gan ma bam: lay tu bo nho dem truoc.
const BASE = '__BASE__';
// Tien to gan voi duong dan goc: nhieu website chung ten mien github.io khong xoa nham bo nho dem cua nhau
const PREFIX = 'vtf|' + BASE + '|';
const VERSION = PREFIX + '__VERSION__';
const PRECACHE = "__PRECACHE__";

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // xoa ban cu cua chinh website nay (ke ca ten bo nho dem kieu cu 'vtf-...')
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && (k.startsWith(PREFIX) || k.startsWith('vtf-'))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (key, res) => { if (res && res.ok && res.type === 'basic' && !res.redirected) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // bo ?q=... khi luu: moi tu khoa tim kiem dung chung mot ban trang
    const key = url.origin + url.pathname;
    e.respondWith(fetch(req).then(res => put(key, res)).catch(() => caches.match(key, { ignoreSearch: true }).then(r => r || caches.match(BASE + '/offline'))));
    return;
  }
  if (/\/(assets|fonts|img)\//.test(url.pathname) || /\.svg$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => put(req, res))));
  }
});
