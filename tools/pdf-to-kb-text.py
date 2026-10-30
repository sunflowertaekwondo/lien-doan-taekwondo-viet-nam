# -*- coding: utf-8 -*-
"""pdf-to-kb-text.py - Trich chu tu PDF co lop chu (khong phai ban quet) thanh tep data/kb-docs/*.txt cho tro ly LinhKate.
Dung: python -I tools/pdf-to-kb-text.py <van-ban.pdf> <ra.txt> "<tieu de>" <trang-hien-thi> <neo> <duong-dan-pdf>
(Quyet dinh 152/2025 lay tu ban .docx da chuan hoa - xem chuan-hoa-van-ban/docx_to_text.py)"""
import sys, re, unicodedata, pymupdf
src, out, title, page, anchor, pdf = sys.argv[1:7]
d = pymupdf.open(src)
raw = '\n'.join(p.get_text() for p in d).replace('\u200b', '')
raw = unicodedata.normalize('NFC', raw)
lines = [re.sub(r'\s+', ' ', l).strip() for l in raw.split('\n')]
lines = [l for l in lines if l and not re.fullmatch(r'\d{1,3}', l)]           # bo so trang troi
merged = []
for l in lines:
    if merged and not re.search(r'[.;:!?)”"]$', merged[-1]) and not re.match(r'^(Điều|Chương|Mục|\d+[.)]|[a-zđ][.)]|-|•)', l) and l[:1].islower():
        merged[-1] += ' ' + l                                                   # noi dong bi ngat giua cau
    else:
        merged.append(l)
head = f'---\ntrang: {page}\nneo: {anchor}\ntieuDe: {title}\npdf: {pdf}\n---\n'
open(out, 'w', encoding='utf-8').write(head + '\n'.join(merged) + '\n')
print(len(merged), 'dong,', sum(map(len, merged)), 'ky tu')
