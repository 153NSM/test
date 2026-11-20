"""스탬프 미션 인쇄용 QR 카드(A6, 300dpi) 6장과 묶음 PDF를 만든다.

사용법: python3 wsc/tools/make_qr.py   (필요: pip install qrcode pillow)
결과: wsc/print/*.png, wsc/print/wsc-qr-cards.pdf
"""
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont

BASE = "https://153nsm.github.io/test/wsc/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "print")
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

NAVY = (15, 27, 61)
GOLD = (200, 145, 42)
RED = (179, 38, 58)
INK = (18, 26, 51)
MUTED = (85, 96, 122)

CARDS = [
    ("00-start", BASE, "위대한 만남", "미션 시작", "사라진 5개의 시크릿 코드를 찾아라",
     None, "QR을 찍고 5곳의 연구실에서 코드를 모아\n세계과학회의 입장코드를 완성하세요"),
    ("01-jang-G", BASE + "?lab=jang", "장영실 연구실", "앙부일구", "「그림자의 비밀」을 밝혀라",
     "앙부일구 전시품 앞", "QR을 찍고 문제를 맞히면 시크릿 코드를 받아요"),
    ("02-kepler-R", BASE + "?lab=kepler", "요하네스 케플러 연구실", "KEPLER LAB", "행성의 진짜 길을 찾아라",
     "케플러 연구실", "QR을 찍고 문제를 맞히면 시크릿 코드를 받아요"),
    ("03-newton-E", BASE + "?lab=newton", "아이작 뉴턴 연구실", "NEWTON LAB", "흰빛(백색광)에 숨은 너는 누구냐?",
     "피직스랩 프리즘 전시품 앞", "QR을 찍고 문제를 맞히면 시크릿 코드를 받아요"),
    ("04-curie-A", BASE + "?lab=curie", "마리 퀴리 연구실", "CURIE LAB", "보이지 않는 신호를 찾아라",
     "원자력 방사선 안전체험관 앞", "QR을 찍고 문제를 맞히면 시크릿 코드를 받아요"),
    ("05-johnson-T", BASE + "?lab=johnson", "캐서린 존슨 연구실", "JOHNSON LAB", "우주로 가는 길을 찾아라",
     "인공위성·로켓·우주선 궤도 전시품 앞", "QR을 찍고 문제를 맞히면 시크릿 코드를 받아요"),
]

W, H = 1240, 1748  # A6 세로, 300dpi


def font(size):
    return ImageFont.truetype(FONT, size)


def centered(d, y, text, f, fill, max_w=W - 160):
    # 너무 길면 글자 크기를 줄인다
    size = f.size
    while d.textlength(text, font=f) > max_w and size > 20:
        size -= 2
        f = font(size)
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)
    return y + size


def make_card(name, url, eyebrow, lab, title, place, note):
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 360], fill=NAVY)
    y = centered(d, 70, "WORLD SCIENCE CONGRESS 2026", font(40), GOLD)
    y = centered(d, y + 40, eyebrow, font(84), (244, 241, 230))
    centered(d, y + 30, lab, font(50), (185, 192, 216))

    y = centered(d, 410, title, font(56), INK)

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    q = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    q = q.resize((820, 820), Image.NEAREST)
    qx, qy = (W - 820) // 2, y + 50
    d.rounded_rectangle([qx - 24, qy - 24, qx + 844, qy + 844], radius=36, outline=GOLD, width=10)
    img.paste(q, (qx, qy))

    y = qy + 820 + 60
    if place:
        y = centered(d, y, "위치 · " + place, font(42), RED) + 24
    for line in note.split("\n"):
        y = centered(d, y, line, font(38), MUTED if place else RED) + 14
    centered(d, H - 70, url, font(26), MUTED)

    path = os.path.join(OUT, name + ".png")
    img.save(path, dpi=(300, 300))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    pages = [make_card(*c) for c in CARDS]
    pages[0].save(os.path.join(OUT, "wsc-qr-cards.pdf"), save_all=True, append_images=pages[1:], resolution=300)
    print("saved", len(pages), "cards to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
