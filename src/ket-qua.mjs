// ket-qua.mjs - muc "Ket qua thi dau" tren trang Dai hoi The thao toan quoc lan thu X (du lieu o data/ket-qua-dai-hoi-x.json).
// Dung trong build.mjs: sec('ket-qua', ..., renderKetQua({ KQ, esc, src, viDate })). Bang tong sap huy chuong va cac so tren dau muc TU TINH tu danh sach ket qua.
// Luu y dat ten: KHONG dung tien to "ad-" / "ads" / "banner" cho lop CSS (phan mem chan quang cao an the do).

const HC = {
  V: { chip: 'gold', nhan: 'HCV', ten: 'Huy chương Vàng', cot: 'gold', so: 1 },
  B: { chip: 'silver', nhan: 'HCB', ten: 'Huy chương Bạc', cot: 'silver', so: 2 },
  D: { chip: 'bronze', nhan: 'HCĐ', ten: 'Huy chương Đồng', cot: 'bronze', so: 3 },
  TG: { chip: 'none', nhan: 'Tham gia', ten: 'Tham gia', cot: '', so: 4 },
};

// Bang tong sap: xep theo so HCV, roi HCB, roi HCD; bang diem thi cung hang (hang chung, vd 4-4-6)
export function tongSapHuyChuong(KQ) {
  const m = new Map();
  for (const nd of KQ.noiDung) for (const r of nd.ketQua) {
    if (!['V', 'B', 'D'].includes(r.hc)) continue;
    const u = m.get(r.donVi) || { donVi: r.donVi, ma: '', V: 0, B: 0, D: 0 };
    u[r.hc]++; if (r.ma && !u.ma) u.ma = r.ma;
    m.set(r.donVi, u);
  }
  const ds = [...m.values()].map(u => ({ ...u, tong: u.V + u.B + u.D }));
  ds.sort((a, b) => b.V - a.V || b.B - a.B || b.D - a.D || a.donVi.localeCompare(b.donVi, 'vi'));
  return ds.map(u => ({ ...u, hang: 1 + ds.filter(o => o.V > u.V || (o.V === u.V && (o.B > u.B || (o.B === u.B && o.D > u.D)))).length }));
}

export function renderKetQua({ KQ, esc, src, viDate }) {
  const nd = KQ.noiDung, tab = tongSapHuyChuong(KQ);
  const dem = h => nd.reduce((s, e) => s + e.ketQua.filter(r => r.hc === h).length, 0);
  const ten = s => esc(s).replace(/ \+ /g, '<br>+ ');
  const code = r => r.ma ? ` <span class="kq-code">${esc(r.ma)}</span>` : '';
  const chip = h => `<span class="kq-chip ${HC[h].chip}">${HC[h].nhan}</span>`;
  const gal = e => {
    const n = Math.min(e.anh.length, 3), vang = e.ketQua.find(r => r.hc === 'V');
    const figs = e.anh.slice(0, 3).map((a, i) => {
      const big = i === 0;
      const img = `<a href="/img/${a.file}-full.jpg" class="kq-zoom" data-cap="${esc(a.alt)}"><img src="/img/${a.file}.jpg" width="${a.w}" height="${a.h}" alt="${esc(a.alt)}" loading="lazy" style="object-position:${esc(a.pos || '50% 50%')}"></a>`;
      const cap = big
        ? `<div class="kq-gal-cap">${chip('V')}<strong>${esc(vang.ten)}</strong>${vang.donVi !== vang.ten ? `<span>${esc(vang.donVi)}</span>` : ''}</div>`
        : (a.cap ? `<figcaption>${esc(a.cap)}</figcaption>` : '');
      return `<figure class="kq-ph${big ? ' big' : ''}"${big && n === 1 && a.ratio ? ` style="aspect-ratio:${a.ratio}"` : ''}>${img}${cap}</figure>`;
    }).join('');
    return `<div class="kq-gal n${n}">${figs}</div><p class="kq-credit">Ảnh: ${esc(KQ.anhCredit)}</p>`;
  };
  const bac = (e, h) => e.ketQua.filter(r => r.hc === h);
  const col = (e, h, cls) => `<div class="kq-pod-col ${cls}"><div class="kq-pod-people">${bac(e, h).map(r => `<div class="kq-pod-p"><div class="kq-pod-name">${ten(r.ten)}</div>${e.loai === 'vdv' ? `<div class="kq-pod-unit">${esc(r.donVi)}</div>` : ''}</div>`).join('')}</div><div class="kq-pod-step"><span class="kq-medal ${cls}" aria-hidden="true">${HC[h].so}</span></div></div>`;
  const event = e => `
  <article class="kq-ev" id="${esc(e.id)}" aria-labelledby="h-${esc(e.id)}">
    <header class="kq-ev-h">
      <div><h3 id="h-${esc(e.id)}">${esc(e.ten)}</h3><p class="kq-en" lang="en">${esc(e.tenAnh)}</p></div>
      <span class="kq-status done">Đã có kết quả</span>
    </header>
    ${gal(e)}
    <div class="kq-pod">${col(e, 'B', 'silver')}${col(e, 'V', 'gold')}${col(e, 'D', 'bronze')}</div>
    <details class="kq-list"><summary>Xem bảng kết quả</summary>
      <table class="kq-tb"><thead><tr><th scope="col">Huy chương</th><th scope="col">${e.loai === 'doi' ? 'Đội' : 'VĐV / Đội hình'}</th><th scope="col">Đơn vị</th></tr></thead><tbody>${e.ketQua.map(r => `<tr><td>${chip(r.hc)}</td><td>${ten(r.ten)}</td><td>${esc(r.donVi)}${code(r)}</td></tr>`).join('')}</tbody></table>
    </details>
  </article>`;
  const th = (c, t, ky) => `<th scope="col" class="${c}"><span aria-hidden="true">${ky}</span><span class="sr">${t}</span></th>`;
  return `<div class="kq-dhx">
  <div class="kq-hero">
    <p class="kq-eyebrow">Đại hội Thể thao toàn quốc lần thứ X · Taekwondo</p>
    <p class="kq-hero-t">Huy chương và bảng tổng sắp</p>
    <p class="kq-hero-d">Cập nhật ${viDate(KQ.capNhat)} · Đã có kết quả ${nd.length}/${KQ.tongNoiDung} nội dung</p>
    <ul class="kq-stats">
      <li class="kq-stat"><b>${nd.length}</b><span>Nội dung đã trao giải</span></li>
      <li class="kq-stat kq-g"><b>${dem('V')}</b><span>Huy chương Vàng</span></li>
      <li class="kq-stat kq-s"><b>${dem('B')}</b><span>Huy chương Bạc</span></li>
      <li class="kq-stat kq-b"><b>${dem('D')}</b><span>Huy chương Đồng</span></li>
    </ul>
  </div>
  <nav class="kq-nav" aria-label="Nội dung đã có kết quả">${nd.map(e => `<a href="#${esc(e.id)}" class="is-done">${esc(e.ten)}</a>`).join('')}</nav>
  <div class="kq-grid">
    <div class="kq-events">${nd.map(event).join('')}
    </div>
    <aside class="kq-side" aria-labelledby="h-kq-tong-sap">
      <h3 id="h-kq-tong-sap">Bảng tổng sắp huy chương</h3>
      <p>Tính trên ${nd.length} nội dung đã có kết quả</p>
      <table class="kq-mt"><caption class="sr">Bảng tổng sắp huy chương theo đơn vị: hạng, số huy chương vàng, bạc, đồng và tổng số</caption><thead><tr><th scope="col"><span aria-hidden="true">#</span><span class="sr">Hạng</span></th><th scope="col">Đơn vị</th>${th('kq-g', 'Huy chương Vàng', 'V')}${th('kq-s', 'Huy chương Bạc', 'B')}${th('kq-b', 'Huy chương Đồng', 'Đ')}${th('kq-t', 'Tổng số huy chương', 'Σ')}</tr></thead>
      <tbody>${tab.map(u => `<tr><td class="kq-rk">${u.hang}</td><td class="kq-unit">${esc(u.donVi)}${u.ma ? ` <span class="kq-code">${esc(u.ma)}</span>` : ''}</td><td class="kq-n kq-g">${u.V}</td><td class="kq-n kq-s">${u.B}</td><td class="kq-n kq-b">${u.D}</td><td class="kq-n kq-t">${u.tong}</td></tr>`).join('')}</tbody></table>
    </aside>
  </div>
  <div class="kq-lb" hidden role="dialog" aria-modal="true" aria-label="Xem ảnh lớn"><button type="button" aria-label="Đóng ảnh">×</button><img alt=""><p></p></div>
  ${src(`${esc(KQ.nguon)}; ảnh: ${esc(KQ.anhCredit)}`)}
</div>`;
}
