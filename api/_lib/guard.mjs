// guard.mjs - ra soat cau tra loi cua mo hinh truoc khi gui cho khach.
// Thuc te kiem thu voi Kira that: mo hinh co luc tu nghi ra so dien thoai / email Van phong. Chi cho phep lien he da co tren website.
import { clip } from './text.mjs';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+\s?84|\b0)[\d .()-]{7,14}\d/g;
const URL_RE = /https?:\/\/[^\s)>\]]+|\bwww\.[^\s)>\]]+/gi;
const digits = s => s.replace(/\D/g, '');
const tail9 = s => digits(s).slice(-9);

export function allowedFacts(texts) {
  const joined = texts.join('\n');
  return {
    emails: new Set((joined.match(EMAIL) || []).map(e => e.toLowerCase())),
    phones: new Set((joined.match(PHONE) || []).map(tail9).filter(x => x.length >= 8)),
    urls: new Set((joined.match(URL_RE) || []).map(u => u.replace(/[.,;]+$/, '').toLowerCase())),
    text: joined.toLowerCase(),
  };
}

// tra ve { answer, fixed }: moi cau/dong chua email, so dien thoai hoac duong dan khong co tren website bi bo; sau do them dong lien he chinh thuc.
export function guardAnswer(answer, allowed, site = {}) {
  const bad = seg => {
    const e = (seg.match(EMAIL) || []).some(x => !allowed.emails.has(x.toLowerCase()));
    const p = (seg.match(PHONE) || []).some(x => tail9(x).length >= 8 && !allowed.phones.has(tail9(x)));
    const u = (seg.match(URL_RE) || []).some(x => !allowed.urls.has(x.replace(/[.,;]+$/, '').toLowerCase()));
    return e || p || u;
  };
  let fixed = false;
  const lines = answer.split('\n').map(line => {
    if (!bad(line)) return line;
    // chi bo cau co van de, giu lai cac cau khac cung dong
    const kept = line.split(/(?<=[.!?])\s+/).filter(sg => !bad(sg));
    fixed = true;
    return kept.join(' ');
  });
  let out = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (fixed) {
    const parts = [site.dienThoai && `điện thoại ${site.dienThoai}`, site.email && `email ${site.email}`].filter(Boolean);
    if (parts.length) out = `${out}${out ? '\n\n' : ''}Thông tin liên hệ chính thức của Văn phòng Liên đoàn: ${parts.join(', ')}.`;
  }
  return { answer: clip(out, 1600), fixed };
}

// --- sua loi chinh ta nho cua mo hinh khi nhac lai dia chi/ten chinh thuc (vd. "Ly Thuong Khet" -> "Ly Thuong Kiet") ---
const lev = (a, b) => {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};
// canon: cac cum tu chinh thuc (dia chi, ten don vi). Neu cau tra loi co doan gan giong (sai toi da 2 ky tu) thi thay bang dung chinh thuc.
export function snapToCanon(answer, canon) {
  let out = answer;
  for (const phrase of canon.filter(p => p && p.split(/\s+/).length >= 3)) {
    const n = phrase.split(/\s+/).length;
    const words = out.split(/(\s+)/);   // giu nguyen khoang trang
    for (let i = 0; i < words.length; i += 2) {
      const win = [];
      for (let k = i, c = 0; k < words.length && c < n; k += 2, c++) win.push(words[k]);
      if (win.length < n) break;
      const lead = win[0].match(/^[*_(]+/)?.[0] || '', tail = win[win.length - 1].match(/[.,;:!?*_)]+$/)?.[0] || '';   // giu dau **dam** va dau cau quanh cum tu
      const cand = (lead + win.join(' ') + tail).slice(lead.length, (lead + win.join(' ') + tail).length - tail.length).replace(/^[*_(]+/, '').replace(/[.,;:!?*_)]+$/, '');
      const want = phrase.replace(/[.,;:!?]+$/, '');
      if (cand !== want && lev(cand.toLowerCase(), want.toLowerCase()) <= 2) {
        words.splice(i, n * 2 - 1, lead + want + tail);
        out = words.join('');
        break;
      }
    }
  }
  return out;
}
