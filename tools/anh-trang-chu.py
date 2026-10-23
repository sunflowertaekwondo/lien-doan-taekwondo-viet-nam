# anh-trang-chu.py - tach anh ky niem chuong (3 tam ghep ngang) thanh 3 anh cho khoi anh dau trang chu.
# Anh goc do Lien doan cung cap: content/anh-goc/ky-niem-chuong-30-nam.jpg (1500x530).
# Vach ngan den giua cac tam: x = 381-416 va x = 937-969 (do tu do sang tung cot). Doi anh goc thi do lai BOXES.
# Chay: python -I tools/anh-trang-chu.py  (can thu vien Pillow)  -> src/img/ky-niem-chuong-{10,20,30}-nam.{jpg,webp}
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BOXES = {'10-nam': (0, 0, 380, 530), '20-nam': (418, 0, 936, 530), '30-nam': (971, 0, 1500, 530)}

im = Image.open(ROOT / 'content' / 'anh-goc' / 'ky-niem-chuong-30-nam.jpg').convert('RGB')
for key, box in BOXES.items():
    part = im.crop(box)
    part.save(ROOT / 'src' / 'img' / f'ky-niem-chuong-{key}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)
    part.save(ROOT / 'src' / 'img' / f'ky-niem-chuong-{key}.webp', 'WEBP', quality=82, method=6)
    print(key, part.size)
