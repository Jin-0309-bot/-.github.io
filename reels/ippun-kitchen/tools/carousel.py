"""1分キッチン：カルーセル投稿用の画像（4枚・1080x1350・JPEG）を作る。
使い方：python3 carousel.py <料理ID> <サムネPNG> <キャプションTXT> <出力フォルダ>
  1枚目：表紙（3Dの完成品＋ジャンル名＋料理名。9:16 のサムネを 4:5 に切り抜く）
  2枚目：材料と分量
  3枚目：作り方（前半）
  4枚目：作り方（後半）＋ポイント＋保存の案内
材料・作り方・ポイントは、キャプション（概要欄）から読み取る。"""
import re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
BG, INK, SUB, RED, CARD, LINE, TIP = (243, 237, 228), (43, 33, 28), (107, 90, 80), (232, 85, 61), (255, 255, 255), (234, 223, 211), (255, 227, 163)
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
_fc = {}
def font(s):
    if s not in _fc: _fc[s] = ImageFont.truetype(BOLD, s, index=0)
    return _fc[s]

def parse(caption):
    lines = caption.splitlines()
    m = re.match(r"【1分キッチン｜(.+?)】(.+)", lines[0])
    genre, title = m.group(1), m.group(2).strip()
    serving, ings, steps, tips, sec = "", [], [], [], None
    for l in lines[1:]:
        s = l.strip()
        if s.startswith("▼材料"):
            sec = "ing"; serving = re.search(r"（(.+?)）", s).group(1); continue
        if s.startswith("▼作り方"): sec = "step"; continue
        if s.startswith("▼ポイント"): sec = "tip"; continue
        if not s:
            if sec in ("ing",): sec = None
            continue
        if s.startswith("保存して") or s.startswith("音声：") or s.startswith("#"): sec = "end"; continue
        if sec == "ing":
            a, b = re.split(r"　+", s, maxsplit=1); ings.append((a, b))
        elif sec == "step":
            mm = re.match(r"(\d+)\.\s*(.+)", s)
            if mm: steps.append(mm.group(2))
            else: sec = "tip"; tips.append(s)
        elif sec == "tip":
            tips.append(s)
    return genre, title, serving, ings, steps, tips

def wrap(d, text, f, maxw):
    # 句読点・中黒のあとで区切る。1つの区切りが長すぎるときは、助詞のあとで折り返す
    segs, buf = [], ""
    for ch in text:
        buf += ch
        if ch in "、。！？）・": segs.append(buf); buf = ""
    if buf: segs.append(buf)
    out, cur = [], ""
    for sg in segs:
        if d.textlength(cur + sg, font=f) <= maxw: cur += sg
        elif d.textlength(sg, font=f) <= maxw:
            if cur: out.append(cur)
            cur = sg
        else:
            for ch in sg:
                if d.textlength(cur + ch, font=f) > maxw and cur:
                    k = max(cur.rfind(p) for p in "にをとでがはへものてら")
                    if k >= len(cur) - 8 and k > 0:
                        out.append(cur[:k + 1]); cur = cur[k + 1:] + ch
                    else:
                        out.append(cur); cur = ch
                else: cur += ch
    if cur: out.append(cur)
    return out

def pill(d, x, y, text, size, bg, fg, padx=26, pady=10):
    f = font(size); w = d.textlength(text, font=f)
    d.rounded_rectangle([x, y, x + w + padx * 2, y + size + pady * 2 + 6], radius=(size + pady * 2) // 2, fill=bg)
    d.text((x + padx, y + pady - 2), text, font=f, fill=fg)
    return x + w + padx * 2

def header(d, genre, page, total):
    genre = {"パスタ": "PASTA"}.get(genre, genre)  # 表紙（3Dのサムネ）の表記にそろえる
    x = pill(d, 60, 56, "1分キッチン", 34, RED, (255, 255, 255))
    pill(d, x + 14, 56, genre, 30, CARD, RED, padx=22, pady=12)
    t = f"{page}/{total}"; f = font(30)
    d.text((W - 60 - d.textlength(t, font=f), 66), t, font=f, fill=SUB)

def card(d, y0, y1):
    d.rounded_rectangle([50, y0, W - 50, y1], radius=36, fill=CARD)

def cover(thumb, out):
    im = Image.open(thumb).convert("RGB").crop((0, 110, 1080, 1460))
    d = ImageDraw.Draw(im)
    t = "スワイプして作り方 →"; f = font(34); w = d.textlength(t, font=f)
    d.rounded_rectangle([W - 60 - w - 52, H - 120, W - 60, H - 52], radius=34, fill=RED)
    d.text((W - 60 - w - 26, H - 112), t, font=f, fill=(255, 255, 255))
    pill(d, 60, H - 120, "1分キッチン", 32, CARD, RED, padx=24, pady=14)
    im.save(out, quality=90)

def ingredients(genre, title, serving, ings, out):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    header(d, genre, 2, 4)
    d.text((60, 140), title, font=font(64 if len(title) <= 12 else 52), fill=INK)
    n = len(ings); fs = 52 if n <= 6 else 46; rh = int(fs * 1.75)
    y0 = 270; y1 = y0 + 110 + rh * n + 30
    card(d, y0, y1)
    d.text((100, y0 + 36), f"材料（{serving}）", font=font(46), fill=RED)
    y = y0 + 120
    for i, (a, b) in enumerate(ings):
        fa = font(fs)
        while d.textlength(a, font=fa) > 600: fa = font(fa.size - 2)
        d.text((100, y), a, font=fa, fill=INK)
        fb = font(fs); d.text((W - 100 - d.textlength(b, font=fb), y), b, font=fb, fill=RED)
        if i < n - 1:
            for xx in range(100, W - 100, 22): d.line([xx, y + rh - 16, xx + 11, y + rh - 16], fill=LINE, width=3)
        y += rh
    t = "分量は目安です。お好みで調整してください"; f = font(30)
    d.text(((W - d.textlength(t, font=f)) / 2, min(y1 + 40, H - 80)), t, font=f, fill=SUB)
    im.save(out, quality=90)

def steps_page(genre, steps, start, page, out, tips=None, last=False):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    header(d, genre, page, 4)
    d.text((60, 140), "作り方", font=font(64), fill=INK)
    y = 260; fs = 44; f = font(fs)
    for i, s in enumerate(steps):
        lines = wrap(d, s, f, W - 100 - 200)
        h = max(110, 40 + len(lines) * int(fs * 1.5))
        card(d, y, y + h)
        cx, cy = 120, y + 55
        d.ellipse([cx - 36, cy - 36, cx + 36, cy + 36], fill=RED)
        num = str(start + i); fn = font(40)
        d.text((cx - d.textlength(num, font=fn) / 2, cy - 28), num, font=fn, fill=(255, 255, 255))
        for k, ln in enumerate(lines):
            d.text((190, y + 24 + k * int(fs * 1.5)), ln, font=f, fill=INK)
        y += h + 22
    if tips:
        ft = font(40); body = []
        for t in tips: body += wrap(d, t, ft, W - 100 - 120)
        h = 90 + len(body) * 60
        d.rounded_rectangle([50, y + 6, W - 50, y + 6 + h], radius=36, fill=TIP)
        d.text((100, y + 30), "ポイント", font=font(38), fill=(122, 74, 0))
        for k, ln in enumerate(body): d.text((100, y + 84 + k * 60), ln, font=ft, fill=INK)
        y += h + 28
    if last:
        t = "保存して、作るときに見返してね"; f2 = font(42); w = d.textlength(t, font=f2)
        yb = max(y + 10, H - 150)
        d.rounded_rectangle([(W - w) / 2 - 40, yb, (W + w) / 2 + 40, yb + 84], radius=42, fill=RED)
        d.text(((W - w) / 2, yb + 14), t, font=f2, fill=(255, 255, 255))
    if y > H - 40: print(f"  注意：{out} の文字が下にはみ出しています（y={y}）")
    im.save(out, quality=90)

def main(did, thumb, cap, outdir):
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    genre, title, serving, ings, steps, tips = parse(Path(cap).read_text())
    half = (len(steps) + 1) // 2
    cover(thumb, out / "1.jpg")
    ingredients(genre, title, serving, ings, out / "2.jpg")
    steps_page(genre, steps[:half], 1, 3, out / "3.jpg")
    steps_page(genre, steps[half:], half + 1, 4, out / "4.jpg", tips=tips, last=True)
    print(did, genre, title, serving, len(ings), "材料", len(steps), "手順", len(tips), "ポイント")

if __name__ == "__main__":
    main(*sys.argv[1:5])
