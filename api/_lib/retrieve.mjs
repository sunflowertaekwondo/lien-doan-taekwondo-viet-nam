// retrieve.mjs - tim cac doan noi dung website lien quan toi cau hoi (BM25 tren van ban da bo dau, co mo rong tu dong nghia).
import { tokens, fold } from './text.mjs';

const STOP = new Set(['la', 'cua', 'va', 'co', 'cho', 'nhu', 'the', 'nao', 'gi', 'khong', 'vay', 'a', 'anh', 'chi', 'em', 'minh', 'toi', 'xin', 'cam', 'on', 'hay', 'duoc', 'bi', 'o', 'tai', 'trong', 've', 'voi', 'nay', 'do', 'de', 'mot', 'nhung', 'cac', 'khi', 'sao', 'ma', 'hoi', 'biet', 'muon', 'can', 'lam', 'nhe', 'ah', 'ha', 'oi', 'thi', 'ra', 'lai', 'rat', 'va']);
STOP.delete('thi');   // "thi dau", "thi dang": tu khoa chinh

// cum tu (da bo dau) -> them tu khoa de tim dung muc du khach hoi theo cach khac voi noi dung website
const SYN = [
  [/thang dang|len dang|thi dang|thi dai|thang cap|len cap|dai den|dang cap/, 'thang dang thi dang ky thi'],
  [/dang ky|gia nhap|vao lien doan|lam hoi vien|tham gia lien doan|xin vao/, 'hoi vien gia nhap thu tuc ho so dang ky'],
  [/dia chi|van phong|tru so|lien lac|goi dien|hotline|so dien thoai|sdt|email|mail|zalo|(lien doan|vtf) o dau/, 'lien he tru so dien thoai email dia chi van phong'],
  [/tai|tai ve|download|file pdf|tep pdf|ban pdf|xem van ban/, 'tai ve tep pdf van ban dieu le'],
  [/lich|giai dau|khi nao|bao gio|thoi gian|ngay nao|sap toi/, 'lich thi dau thoi gian dia diem'],
  [/check ?in|khung gio|diem danh/, 'check in khung gio dang ky'],
  [/trong tai|giam khao|giam sat/, 'trong tai giam khao ban trong tai'],
  [/chu tich|ai la|lanh dao|ban chap hanh|tong thu ky|pho chu tich/, 'ban chap hanh lanh dao co cau to chuc chu tich'],
  [/dieu le|quy dinh|van ban|nghi dinh|thong tu|phap ly|quyet dinh/, 'dieu le van ban quyet dinh nghi dinh'],
  [/ky niem chuong|vinh danh|tri an|huy chuong/, 'ky niem chuong tri an ton vinh vinh danh'],
  [/quyen han|nhiem vu|chuc nang/, 'quyen han nhiem vu'],
  [/doi tuyen|van dong vien|vdv|tuyen chon/, 'doi tuyen van dong vien tuyen chon'],
  [/quyen rieng tu|du lieu ca nhan|bao mat|thong tin ca nhan/, 'quyen rieng tu du lieu ca nhan'],
];

export function buildIndex(kb) {
  const docs = kb.chunks.map(c => {
    const body = tokens(c.t), head = tokens(`${c.pt} ${c.h}`);
    const tf = new Map();
    for (const t of body) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of head) tf.set(t, (tf.get(t) || 0) + 3);   // tieu de trang/muc co trong so cao
    const dieu = new Set([...c.t.matchAll(/(?:^|\n)Điều (\d+)\./g)].map(m => m[1]));   // cac "Điều N." co dong tieu de trong doan
    return { c, tf, dieu, len: body.length + head.length * 3, flat: ' ' + [...head, ...body].join(' ') + ' ' };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  return { docs, df, N: docs.length, avg: docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length) };
}

function queryTerms(q) {
  const f = fold(q);
  const base = (f.match(/[a-z0-9]+/g) || []);
  const kept = base.filter(t => !STOP.has(t));
  const extra = [];
  for (const [re, add] of SYN) if (re.test(f)) extra.push(...add.split(' '));
  return { kept, extra, base };
}

// history: cac tin nhan truoc (chi lay cau hoi cua khach). Cau ngan/mo ho -> ghep them cau truoc de hieu "con ... thi sao?"
export function search(index, question, { k = 6, history = [] } = {}) {
  const cur = queryTerms(question);
  const prevQs = history.filter(m => m.role === 'user').map(m => m.content).slice(-2);
  const weights = new Map();
  const add = (t, w) => weights.set(t, Math.max(weights.get(t) || 0, w));
  for (const t of cur.kept) add(t, 1);
  for (const t of cur.extra) add(t, 0.6);
  if (cur.kept.length < 3) for (const q of prevQs) { const p = queryTerms(q); for (const t of p.kept) add(t, 0.45); for (const t of p.extra) add(t, 0.3); }
  const bigrams = [];
  for (let i = 0; i + 1 < cur.base.length; i++) if (!STOP.has(cur.base[i]) && !STOP.has(cur.base[i + 1])) bigrams.push(cur.base[i] + ' ' + cur.base[i + 1]);
  const dm = /\bdieu\s*(\d{1,2})\b/.exec(fold(question));   // "Điều 9 nói gì" -> đoạn có tiêu đề Điều 9 lên đầu
  const k1 = 1.4, b = 0.75;
  const scored = [];
  for (const d of index.docs) {
    let s = 0;
    for (const [t, w] of weights) {
      const tf = d.tf.get(t);
      if (!tf) continue;
      const n = index.df.get(t) || 0;
      const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
      s += w * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.len / index.avg));
    }
    for (const bg of bigrams) if (d.flat.includes(' ' + bg + ' ')) s += 1.2;
    if (dm && d.dieu.has(dm[1])) s += 25;
    if (s > 0) scored.push({ c: d.c, score: s });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}
