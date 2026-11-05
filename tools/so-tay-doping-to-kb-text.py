# -*- coding: utf-8 -*-
"""so-tay-doping-to-kb-text.py - Trich van ban "So tay Phong chong Doping" (PDF 42 trang, bo cuc nhieu cot) thanh data/kb-docs/*.txt cho tro ly LinhKate.
Dung: python -X utf8 -I tools/so-tay-doping-to-kb-text.py <so-tay.pdf> <ra.txt>
Khac pdf-to-kb-text.py: doc cac khoi chu theo vi tri (y, x) vi thu tu trong PDF bi dao, bo dau/cuoi trang, bo muc luc, bo chu roi cua so do ty trong (trang 24),
noi dong bi ngat, va danh dau tieu de muc bang "## " (build-chat-kb.mjs dung lam ten doan, tang do chinh xac khi tim kiem)."""
import sys, re, unicodedata, pymupdf

src, out = sys.argv[1], sys.argv[2]
d = pymupdf.open(src)
raw = []
for pi, p in enumerate(d, 1):
    if pi in (1, 4):
        continue                                   # bia va muc luc (chi co so trang)
    blocks = sorted([b for b in p.get_text('blocks') if b[6] == 0], key=lambda b: (round(b[1]), round(b[0])))
    for b in blocks:
        y = b[1]
        if y < 60 or y > 548:
            continue                               # dau trang "SO TAY PHONG CHONG DOPING" va chan trang
        if pi == 24 and y < 300:
            continue                               # chu roi cua so do ty trong (da co mo ta bang chu o trang 23)
        txt = unicodedata.normalize('NFC', b[4]).replace('​', '')
        for l in txt.split('\n'):
            l = re.sub(r'\s+', ' ', l).strip()
            if l:
                raw.append(l)

NAMED = ('Lời khuyên về quy trình nộp', 'Hồ sơ Miễn trừ do điều trị cấp sau', 'Yêu cầu điều trị đối với', 'Tính bảo mật', 'Tỷ trọng phù hợp cho',
         'Đảm bảo an toàn cho mẫu', 'Hoàn thiện tài liệu sau', 'Các chất cấm cần phát hiện', 'Tiêu chuẩn phân tích mẫu', 'Việc lưu trữ mẫu',
         'Trường hợp VĐV không ký vào', 'Trường hợp VĐV không tới', 'MỘT SỐ LƯU Ý')
LIGHT = ('VĐV cần biết gì', 'Số lượng mẫu lấy', 'Dung tích yêu cầu', 'Loại ống yêu cầu', 'Lưu ý:', 'Ví dụ:')   # dong ngan khong noi voi dong sau


def is_section(s):
    if len(s) > 110:
        return False
    return bool(re.match(r'^\d+\.\d+(\.\d+)? [A-ZÀ-ỸĐ]', s) or re.match(r'^(PHỤ LỤC|Phụ lục)', s) or re.fullmatch(r'[IVX]+\. [A-ZÀ-ỸĐ ,/-]+', s) or re.match(r'^[SMP]\d\. ', s)
                or re.fullmatch(r'\d\. [A-ZÀ-ỸĐ ,/-]+', s) or s.startswith(NAMED)
                or (s.upper() == s and len(s) > 6 and not s.endswith('.') and not re.match(r'^Bước', s)))


def is_head(s):
    return is_section(s) or s.startswith(LIGHT) or bool(re.match(r'^Bước \d', s))


def item(s):
    return bool(re.match(r'^(•|-|\d+[.)] |[a-zđ][.)] )', s)) or is_head(s)


term = lambda s: bool(re.search(r'[.;:!?)”"]$', s))
lines = []
for l in raw:
    if lines and l == 'ĐẠI HỘI X' and is_section(lines[-1]):
        lines[-1] += ' ' + l                       # tieu de muc 2 bi ngat o chu "TAI / DAI HOI X"
    elif lines and not term(lines[-1]) and not is_head(lines[-1]) and not item(l):
        lines[-1] += ' ' + l                       # noi dong bi ngat
    else:
        lines.append(l)
lines = [('## ' + l) if is_section(l) else l for l in lines]
head = ('---\ntrang: /dai-hoi-the-thao-toan-quoc-2026\nneo: phong-chong-doping\n'
        'tieuDe: Sổ tay Phòng chống Doping, Đại hội Thể thao toàn quốc lần thứ X năm 2026 (Tiểu ban Kiểm tra Doping)\n'
        'pdf: /docs/dai-hoi-x-2026-so-tay-phong-chong-doping.pdf\n---\n')
intro = ('SỔ TAY PHÒNG CHỐNG DOPING – ĐẠI HỘI THỂ THAO TOÀN QUỐC LẦN THỨ X (Tiểu ban Kiểm tra Doping; Trung tâm Phòng chống Doping Việt Nam). '
         'Thông điệp: Play True – Thi đấu trung thực, bảo vệ thể thao trong sạch.\n')
open(out, 'w', encoding='utf-8').write(head + intro + '\n'.join(lines) + '\n')
print(len(lines), 'dong,', sum(map(len, lines)), 'ky tu,', sum(l.startswith('## ') for l in lines), 'tieu de muc')
