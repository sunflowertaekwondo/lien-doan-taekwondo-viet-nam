// retrieve.mjs - tim cac doan noi dung website lien quan toi cau hoi (BM25 tren van ban da bo dau, co mo rong tu dong nghia).
import { tokens, fold } from './text.mjs';

const STOP = new Set(['la', 'cua', 'va', 'co', 'cho', 'nhu', 'the', 'nao', 'gi', 'khong', 'vay', 'a', 'anh', 'chi', 'em', 'minh', 'toi', 'xin', 'cam', 'on', 'hay', 'duoc', 'bi', 'o', 'tai', 'trong', 've', 'voi', 'nay', 'do', 'de', 'mot', 'nhung', 'cac', 'khi', 'sao', 'ma', 'hoi', 'biet', 'muon', 'can', 'lam', 'nhe', 'ah', 'ha', 'oi', 'thi', 'ra', 'lai', 'rat', 'va']);
STOP.delete('thi');   // "thi dau", "thi dang": tu khoa chinh

// cum tu (da bo dau) -> them tu khoa de tim dung muc du khach hoi theo cach khac voi noi dung website
const SYN = [
  [/thang dang|len dang|thi dang|thi dai|thang cap|len cap|dai den|dang cap/, 'thang dang thi dang ky thi'],
  [/(1|mot|nhat) dang|(1|mot) dan|poom 1/, 'nhat 01 dang thi len nhat'],
  [/(2|hai|nhi) dang|2 dan/, 'nhi 02 dang thi len nhi'],
  [/(3|ba|tam) dang|3 dan/, 'tam 03 dang thi len tam'],
  [/(4|bon|tu) dang|4 dan/, 'tu 04 dang thi len tu'],
  [/(5|nam|ngu) dang|5 dan/, 'ngu 05 dang thi len ngu'],
  [/(6|sau|luc) dang|6 dan/, 'luc 06 dang thi len luc'],
  [/(7|bay|that) dang|7 dan/, 'that 07 dang thi len that'],
  [/8 dang|8 dan|bat dang/, 'bat 08 dang thi len bat'],
  [/le phi|tien thi|hoc phi|phi thi|chi phi|bao nhieu tien/, 'tien thi tien tham du tien cap le phi'],
  [/noi dung thi|thi nhung gi|thi gi|thi nhu the nao|mon thi/, 'noi dung thi ky thuat doi luyen cong pha the luc quyen'],
  [/ban giam khao|giam khao thi/, 'thanh phan ban giam khao'],
  [/do tuoi|bao nhieu tuoi|tuoi thi|may tuoi/, 'do tuoi gioi han thoi gian toi thieu'],
  [/uu tien|thi som|thi truoc/, 'quyen uu tien'],
  [/van bang|chung chi|the dang|cap bang/, 'van bang chung chi cap van bang'],
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

// ý định -> dấu hiệu trong nội dung: hỏi giá/lệ phí thì ưu tiên các đoạn có số tiền (vd. "400.000 đồng"); hỏi thời gian thì ưu tiên đoạn có ngày tháng
const INTENT = [
  [/le phi|tien thi|hoc phi|phi thi|chi phi|bao nhieu tien|gia tien|muc thu|nop bao nhieu/, /\d{1,3}(?:\.\d{3})+\s*(?:đồng|đ)\b/, 12],
  [/\bkhi nao\b|\bbao gio\b|ngay nao|thoi gian|\blich\b/, /\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b|\bngày \d{1,2} tháng \d{1,2}\b/, 4],
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
  const fq = fold(question);
  const dm = /\bdieu\s*(\d{1,2})\b/.exec(fq);   // "Điều 9 nói gì" -> đoạn có tiêu đề Điều 9 lên đầu
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
    if (s > 0) for (const [qre, dre, w] of INTENT) if (qre.test(fq) && dre.test(d.c.t)) s += w;
    if (s > 0) scored.push({ c: d.c, score: s });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}
