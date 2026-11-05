// doping.mjs - muc "Phong chong doping" tren trang Dai hoi The thao toan quoc lan thu X (noi dung o data/doping-dai-hoi-x.json,
// chep tu So tay Phong chong Doping cua Tieu ban Kiem tra Doping). Dung trong build.mjs: sec('phong-chong-doping', ..., renderDoping(...)).
// Luu y dat ten: KHONG dung tien to "ad-" / "ads" / "banner" cho lop CSS (phan mem chan quang cao an the do).

const EMAIL = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const URL_RE = /(https?:\/\/[^\s<)]+[^\s<).,;])/g;

export const DOPING_NAV = [
  ['dp-can-nho', 'Điều cần nhớ'],
  ['dp-pham-vi', 'Khi nào, ai kiểm tra'],
  ['dp-tue', 'Miễn trừ do điều trị (TUE)'],
  ['dp-thong-bao', 'Khi được thông báo'],
  ['dp-lay-mau', 'Quy trình lấy mẫu'],
  ['dp-quyen', 'Quyền và nghĩa vụ'],
  ['dp-danh-muc', 'Danh mục cấm 2026'],
  ['dp-hau-qua', 'Hậu quả'],
  ['dp-tieu-ban', 'Tiểu ban'],
  ['dp-tai-lieu', 'Tài liệu, liên kết'],
];

export function renderDoping({ DP, esc, icon, src, extA, pdfCard, mb, BUILD_DATE }) {
  const li = a => a.map(t => `<li>${esc(t)}</li>`).join('');
  const linkify = t => esc(t).replace(EMAIL, '<a href="mailto:$1">$1</a>').replace(URL_RE, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const fig = (h, cls = 'dp-fig') => `<figure class="${cls}"><a href="/img/${h.file}.webp" target="_blank" rel="noopener"><picture><img src="/img/${h.file}.webp" width="${h.w}" height="${h.h}" alt="${esc(h.alt)}" loading="lazy"></picture></a><figcaption>${esc(h.chuThich)}</figcaption></figure>`;
  const N = DP.nguon, T = DP.tue, TB = DP.thongBao, LM = DP.layMau, Q = DP.quyen, DM = DP.danhMuc, HQ = DP.hauQua, TBAN = DP.tieuBan;
  const all = DM.nhom.flatMap(n => n.muc).filter(m => m.ma);
  const nS = all.filter(m => /^S\d/.test(m.ma)), nM = all.filter(m => /^M\d/.test(m.ma));
  const range = a => `${a[0].ma}–${a[a.length - 1].ma}`;
  const wada = DP.lienKet.find(l => /wada-ama/.test(l.url)), gdro = DP.lienKet.find(l => /globaldro/.test(l.url)), tueLink = DP.lienKet.find(l => /mien-tru/.test(l.url));
  const han = T.han, hanQua = BUILD_DATE > han.ngay;

  // ---- khoi mo dau (banner Play True) ----
  const hero = `<div class="dp-hero">
          <div class="dp-hero-body">
            <p class="dp-eyebrow">${icon('shield')}<span>${esc(DP.nhan)}</span></p>
            <h3 class="dp-motto">${esc(DP.khauHieu[0])} <span class="dp-true">${esc(DP.khauHieu[1])}</span></h3>
            <p class="dp-sub">${esc(DP.khauHieuNghia)}</p>
            <p class="dp-lead">${esc(DP.gioiThieu)}</p>
            <div class="btns">
              <a class="btn btn-red" href="${esc(N.pdf)}" target="_blank" rel="noopener">Đọc Sổ tay (PDF) ${icon('book')}</a>
              ${extA(gdro.url, 'Tra cứu thuốc: GlobalDRO', 'btn btn-ghost')}
            </div>
            <ul class="dp-pillars">${li(DP.tinhThan)}</ul>
          </div>
          <a class="dp-cover" href="${esc(N.pdf)}" target="_blank" rel="noopener"><picture><img src="/img/${N.bia.file}.webp" width="${N.bia.w}" height="${N.bia.h}" alt="${esc(N.bia.alt)}" loading="lazy"></picture><span>${N.trang} trang · PDF · ${mb(N.kb)}</span></a>
        </div>
        <nav class="dp-nav" aria-label="Các nội dung của mục Phòng chống doping">${DOPING_NAV.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}</nav>`;

  // ---- 4 dieu can nho ----
  const keys = `<h3 class="sub-h dp-h" id="dp-can-nho">4 điều VĐV, HLV cần nhớ</h3>
        <div class="grid g4 dp-keys">${DP.dieuCanNho.map((c, i) => `<div class="card dp-key"><span class="dp-key-n" aria-hidden="true">0${i + 1}</span><span class="dp-key-ic">${icon(c.icon)}</span><h3>${esc(c.tieuDe)}</h3><p>${esc(c.noiDung)}</p></div>`).join('')}</div>
        <ul class="cal-stats dp-stats">
          <li><b>${nS.length}</b><span>nhóm chất cấm (${range(nS)})</span></li>
          <li><b>${nM.length}</b><span>phương pháp cấm (${range(nM)})</span></li>
          <li><b>${LM.nuocTieu.buoc.length}</b><span>bước lấy mẫu nước tiểu</span></li>
          <li><b>${LM.mau.buoc.length}</b><span>bước lấy mẫu máu</span></li>
        </ul>`;

  // ---- pham vi ----
  const phamVi = `<h3 class="sub-h dp-h" id="dp-pham-vi">Kiểm tra doping tại Đại hội: khi nào, ở đâu, ai thực hiện</h3>
        <table class="table kv"><tbody>${DP.phamVi.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;

  // ---- TUE ----
  const sd = T.sauSuDung;
  const tue = `<h3 class="sub-h dp-h" id="dp-tue">${esc(T.tieuDe)}</h3>
        <p>${esc(T.gioiThieu)}</p>
        <p class="dp-deadline">${icon('calendar')}<span><strong>Hạn gửi bản sao quyết định TUE về BTC: trước ngày ${esc(han.chu)}</strong><small>${esc(han.moTa)}</small></span>${hanQua ? '<span class="dp-dl-state">Đã qua</span>' : ''}</p>
        <div class="grid g2">
          <div class="card"><h4 class="dp-h4">Yêu cầu về Miễn trừ do điều trị</h4><ol class="numlist one">${li(T.yeuCau)}</ol></div>
          <div class="card"><h4 class="dp-h4">${esc(T.loiKhuyenTen)}</h4><ol class="numlist one">${T.loiKhuyen.map(t => `<li>${linkify(t)}</li>`).join('')}</ol></div>
        </div>
        <p class="note">${icon('alert')}<span>${esc(T.luuYBtc).replace(/^BTC lưu ý/, '<strong>BTC lưu ý</strong>')}</span></p>
        <div class="grid g2">
          <div class="card"><h4 class="dp-h4">${esc(sd.tieuDe)}</h4><p>${esc(sd.doan[0])}</p><ul class="dp-ul">${li(sd.dieuKien)}</ul>${sd.doanSau.map(t => `<p>${linkify(t)}</p>`).join('')}</div>
          <div class="card dp-contact"><h4 class="dp-h4">Nộp hồ sơ và liên hệ Hội đồng TUE</h4>
            <p>${linkify(T.noiNop)}</p>
            <ul class="contact-list">
              <li>${icon('mail')}<span><strong>Hội đồng TUE của Đại hội X:</strong> <a href="mailto:${esc(T.lienHe.hoiDongEmail)}">${esc(T.lienHe.hoiDongEmail)}</a></span></li>
              <li>${icon('users')}<span><strong>${esc(T.lienHe.ten)}</strong>, ${esc(T.lienHe.chucVu)}. Email: <a href="mailto:${esc(T.lienHe.email)}">${esc(T.lienHe.email)}</a></span></li>
            </ul>
            <p>Mẫu đơn chính thức và hướng dẫn có sẵn trên website của Trung tâm Phòng chống Doping Việt Nam.</p>
            <div class="btns">${extA(tueLink.url, 'Mẫu đơn và hướng dẫn TUE', 'btn btn-outline')}</div>
          </div>
        </div>`;

  // ---- khi duoc thong bao ----
  const thongBao = `<h3 class="sub-h dp-h" id="dp-thong-bao">${esc(TB.tieuDe)}</h3>
        <div class="grid g2 dp-notify">
          ${fig(TB.hinh, 'dp-fig dp-ill')}
          ${TB.the.map(c => `<div class="card"><h4 class="dp-h4">${esc(c.tieuDe)}</h4><ul class="dp-ul">${li(c.y)}</ul></div>`).join('\n          ')}
        </div>`;

  // ---- quy trinh lay mau ----
  const steps = b => `<ol class="dp-steps">${b.map(s => `<li><b>${esc(s.ten)}</b><ul>${li(s.y)}</ul>${s.luuY ? `<p class="dp-luuy">${esc(s.luuY)}</p>` : ''}</li>`).join('')}</ol>`;
  const NT = LM.nuocTieu, TT = NT.tyTrong, M = LM.mau;
  const layMau = `<h3 class="sub-h dp-h" id="dp-lay-mau">${esc(LM.tieuDe)}</h3>
        <p>${esc(LM.gioiThieu)}</p>
        <p class="note">${icon('info')}<span>${esc(LM.dungCu)}</span></p>
        <div class="dp-procs">
          <details class="full dp-proc" id="dp-nuoc-tieu" open><summary>${icon('drop')}${esc(NT.tieuDe)}</summary><div class="full-body">
            <div class="dp-proc-grid">
              ${fig(NT.hinh)}
              <div>
                ${steps(NT.buoc)}
                <h4 class="dp-h4">${esc(TT.tieuDe)}</h4>
                <p>${esc(TT.moTa)}</p>
                <table class="table kv"><tbody>${TT.hang.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>Tỷ trọng ${esc(v)}</td></tr>`).join('')}</tbody></table>
                <p>${esc(TT.ghiChu)}</p>
              </div>
            </div>
          </div></details>
          <details class="full dp-proc" id="dp-mau"><summary>${icon('drop')}${esc(M.tieuDe)}</summary><div class="full-body">
            <p>${esc(M.gioiThieu)}</p>
            <div class="dp-proc-grid">
              ${fig(M.hinh)}
              <div>
                <table class="table kv"><tbody>${M.thongSo.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
                ${steps(M.buoc)}
              </div>
            </div>
          </div></details>
          <details class="full dp-proc" id="dp-sau-lay-mau"><summary>${icon('book')}${esc(LM.sauLayMau.tieuDe)}</summary><div class="full-body"><ul class="dp-ul">${li(LM.sauLayMau.y)}</ul></div></details>
        </div>`;

  // ---- quyen, nghia vu, trach nhiem ----
  const KC = Q.khuyenCao;
  const quyen = `<h3 class="sub-h dp-h" id="dp-quyen">${esc(Q.tieuDe)}</h3>
        <p>${esc(Q.gioiThieu)}</p>
        <div class="grid g2 dp-rights">
          <div class="card"><h4 class="dp-h4">${icon('shield')}Quyền của vận động viên (${Q.quyen.length})</h4><ul class="dp-ul">${li(Q.quyen)}</ul></div>
          <div class="card"><h4 class="dp-h4">${icon('check')}Nghĩa vụ của vận động viên (${Q.nghiaVu.length})</h4><ul class="dp-ul">${li(Q.nghiaVu)}</ul></div>
          <div class="card"><h4 class="dp-h4">${icon('pill')}Trách nhiệm trong sử dụng thuốc và điều trị</h4><p>Vận động viên cần:</p><ul class="dp-ul">${li(Q.trachNhiemThuoc)}</ul></div>
          <div class="card dp-avoid"><h4 class="dp-h4">${icon('alert')}Các hành vi vận động viên cần tuyệt đối tránh</h4><p>Vận động viên không được:</p><ul class="dp-ul">${li(Q.tranh)}</ul><p>${esc(Q.tranhGhiChu)}</p></div>
        </div>
        <div class="dp-slogan"><strong>${esc(Q.khauHieuCuoi)}</strong><p>${esc(Q.khauHieuCuoi2)}</p></div>
        <h3 class="sub-h">${esc(KC.tieuDe)}</h3>
        <div class="card"><p>${esc(KC.moDau)}</p><ol class="numlist one">${li(KC.y)}</ol><p><strong>${esc(KC.ketLuan)}</strong></p><p>${linkify(KC.traCuu)}</p><div class="btns">${extA(gdro.url, 'Tra cứu thuốc: GlobalDRO', 'btn btn-outline')}</div></div>`;

  // ---- danh muc cam ----
  const rule = [['calendar', DM.luuY[0]], ['clock', DM.luuY[1]], ['alert', DM.luuY[2]]];
  const body = d => d.map(b => b.p ? `<p>${esc(b.p)}</p>` : `<ul class="dp-ul">${b.ul.map(x => typeof x === 'string' ? `<li>${esc(x)}</li>` : `<li>${esc(x.t)}<ul>${li(x.ul)}</ul></li>`).join('')}</ul>`).join('');
  const danhMuc = `<h3 class="sub-h dp-h" id="dp-danh-muc">${esc(DM.tieuDe)}</h3>
        <div class="grid g3 dp-rules">${rule.map(([ic, t]) => `<div class="card">${icon(ic)}<p>${esc(t)}</p></div>`).join('')}</div>
        <div class="btns dp-wada">${extA(wada.url, 'Tải Danh mục cấm 2026 (WADA, PDF)', 'btn btn-outline')}</div>
        ${DM.nhom.map(n => `<h4 class="dp-grp">${esc(n.tieuDe)}</h4>${n.moTa ? `<p>${esc(n.moTa)}</p>` : ''}
        <div class="dp-list dp-${n.loai}">${n.muc.map(m => `<details class="full dp-sub" id="dp-${esc(m.id || m.ma.toLowerCase())}"><summary>${m.ma ? `<span class="dp-code">${esc(m.ma)}</span>` : ''}<span>${esc(m.ten)}</span></summary><div class="full-body">${body(m.doan)}</div></details>`).join('\n          ')}</div>`).join('\n        ')}`;

  // ---- hau qua + quan ly ket qua ----
  const hauQua = `<h3 class="sub-h dp-h" id="dp-hau-qua">${esc(HQ.tieuDe)}</h3>
        <p>${esc(HQ.moDau)}</p>
        <div class="grid g3 dp-conseq">${HQ.the.map((c, i) => `<div class="card"><span class="n">0${i + 1}</span><strong class="dp-card-t">${esc(c.ten)}</strong><p class="dp-en">${esc(c.en)}</p><p>${esc(c.moTa)}</p></div>`).join('')}</div>
        <details class="full dp-proc"><summary>${icon('scale')}${esc(HQ.quanLy.tieuDe)}</summary><div class="full-body">${HQ.quanLy.doan.map(t => `<p>${esc(t)}</p>`).join('')}</div></details>`;

  // ---- tieu ban + thong diep ----
  const TD = TBAN.thongDiep;
  const tieuBan = `<h3 class="sub-h dp-h" id="dp-tieu-ban">${esc(TBAN.tieuDe)} (${TBAN.thanhVien.length} thành viên)</h3>
        <table class="table docs-table roster dp-tb"><thead><tr><th scope="col">Chức vụ trong Tiểu ban</th><th scope="col">Họ và tên</th><th scope="col">Đơn vị công tác</th></tr></thead><tbody>${TBAN.thanhVien.map(([cv, ten, dv]) => `
          <tr><td data-label="Chức vụ">${esc(cv)}</td><td data-label="Họ và tên"><strong>${esc(ten)}</strong></td><td data-label="Đơn vị">${esc(dv)}</td></tr>`).join('')}
        </tbody></table>
        <details class="full dp-proc dp-msg-wrap" id="dp-thong-diep"><summary>${icon('chat')}${esc(TD.tieuDe)}</summary><div class="full-body"><div class="quote dp-msg">${TD.doan.map(t => `<p>${esc(t)}</p>`).join('')}<p class="dp-sign"><strong>${esc(TD.ky[0])}</strong><br>${esc(TD.ky[1])}<br>${esc(TD.ky[2])}</p></div></div></details>`;

  // ---- tai lieu + lien ket + thuat ngu ----
  const taiLieu = `<h3 class="sub-h dp-h" id="dp-tai-lieu">Sổ tay và liên kết chính thức</h3>
        <div class="docs">${pdfCard(N.pdf, esc(N.ten), `${N.trang} trang · ${esc(N.coQuan)} · ${mb(N.kb)}`)}</div>
        <p class="dp-qr">Các liên kết dưới đây lấy từ mã QR in trong Sổ tay.</p>
        <div class="grid g2 dp-links">${DP.lienKet.map(l => `<a class="card dp-link" href="${esc(l.url)}" target="_blank" rel="noopener"><strong class="dp-card-t">${icon('external')} ${esc(l.ten)}</strong><p>${esc(l.moTa)}</p></a>`).join('')}</div>
        <details class="full dp-proc" id="dp-chu-viet-tat"><summary>${icon('book')}Danh mục chữ viết tắt</summary><div class="full-body"><dl class="dp-dl">${DP.chuVietTat.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></details>
        <details class="full dp-proc" id="dp-khai-niem"><summary>${icon('book')}Các khái niệm có liên quan (Phụ lục 3 của Sổ tay)</summary><div class="full-body"><dl class="dp-dl">${DP.khaiNiem.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></details>
        ${src(`${esc(N.ten)} (${N.trang} trang), do ${esc(N.coQuan)} biên soạn`)}`;

  return [hero, keys, phamVi, tue, thongBao, layMau, quyen, danhMuc, hauQua, tieuBan, taiLieu].join('\n        ');
}
