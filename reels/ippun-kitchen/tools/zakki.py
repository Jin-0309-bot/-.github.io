"""1分キッチン｜キッチン雑学：データから、キャプション・表紙（3D）・カルーセル画像4枚をまとめて作る。
使い方（tools フォルダで実行）：python3 zakki.py <雑学JSON> <出力フォルダ>
  雑学JSON：[{"id":"zakki_002_mirin_daiyou",
              "kind":"代用",                       // 代用／手入れ／選び方／保存／下ごしらえ
              "title":"みりんがないときは？",          // 表紙の問いかけ（18文字以内が目安）
              "answer":"酒＋砂糖で代用できます",        // 2枚目に大きく出す答え（20文字以内が目安）
              "answer_note":"酒大さじ1に砂糖小さじ1が目安。", // 答えの補足（1〜2文、任意）
              "points":[["見出し","本文"], ...],     // 3枚目：やり方・ポイント（3〜5個。本文は1〜2文）
              "caution":"…",                       // 4枚目：注意（任意。安全に関わることは必ず書く）
              "summary":"…",                       // 4枚目：まとめ（1〜2文）
              "sources":["https://…"],             // 確かめた出典（画像・キャプションには出さない。記録用）
              "tags":["#…", …5個まで], "form":{表紙の型。FORMS.md を参照}}, ...]
  出力：<出力>/images/<id>/1.jpg〜4.jpg、<出力>/captions.json（追記）、<出力>/review_zakki.jpg（表紙の一覧）"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw
import carousel as C

here = Path(__file__).parent
GENRE = "キッチン雑学"

def caption(r):
    t = f"【1分キッチン｜{GENRE}】{r['title']}\n\n▼答え\n{r['answer']}\n"
    if r.get("answer_note"): t += f"{r['answer_note']}\n"
    t += "\n▼ポイント\n" + "\n".join(f"・{a}：{b}" for a, b in r["points"]) + "\n"
    if r.get("caution"): t += f"\n▼注意\n{r['caution']}\n"
    t += f"\n▼まとめ\n{r['summary']}\n\n保存して、困ったときに見返してね。\n\n" + " ".join(r["tags"][:5]) + "\n"
    return t

def kind_pill(d, kind):
    C.pill(d, 60, 140, kind, 36, (255, 214, 92), C.INK, padx=26, pady=10)

def page_answer(r, out):
    im = Image.new("RGB", (C.W, C.H), C.BG); d = ImageDraw.Draw(im)
    C.header(d, GENRE, 2, 4); kind_pill(d, r["kind"])
    y = 240; f = C.font(56)
    for ln in C.wrap(d, r["title"], f, C.W - 120): d.text((60, y), ln, font=f, fill=C.INK); y += 80
    y += 30
    fa = C.font(72); al = C.wrap(d, r["answer"], fa, C.W - 200)
    note = C.wrap(d, r.get("answer_note", ""), C.font(42), C.W - 200) if r.get("answer_note") else []
    h = 150 + len(al) * 100 + (len(note) * 64 + 30 if note else 0)
    C.card(d, y, y + h)
    d.text((100, y + 40), "答え", font=C.font(44), fill=C.RED)
    yy = y + 110
    for ln in al: d.text((100, yy), ln, font=fa, fill=C.INK); yy += 100
    yy += 20
    for ln in note: d.text((100, yy), ln, font=C.font(42), fill=C.SUB); yy += 64
    if y + h > C.H - 60: print(f"  注意：{out} の文字が下にはみ出しています（y={y + h}）")
    d.text(((C.W - d.textlength("次のページでくわしく →", font=C.font(36))) / 2, C.H - 110), "次のページでくわしく →", font=C.font(36), fill=C.SUB)
    im.save(out, quality=90)

def page_points(r, out):
    im = Image.new("RGB", (C.W, C.H), C.BG); d = ImageDraw.Draw(im)
    C.header(d, GENRE, 3, 4)
    d.text((60, 140), "ポイント", font=C.font(64), fill=C.INK)
    y = 260; fh, fb = C.font(46), C.font(40)
    for i, (a, b) in enumerate(r["points"]):
        hl = C.wrap(d, a, fh, C.W - 300); bl = C.wrap(d, b, fb, C.W - 300)
        h = 40 + len(hl) * 64 + len(bl) * 58 + 20
        C.card(d, y, y + h)
        cx, cy = 120, y + 58
        d.ellipse([cx - 36, cy - 36, cx + 36, cy + 36], fill=C.RED)
        n = str(i + 1); fn = C.font(40); d.text((cx - d.textlength(n, font=fn) / 2, cy - 28), n, font=fn, fill=(255, 255, 255))
        yy = y + 26
        for ln in hl: d.text((190, yy), ln, font=fh, fill=C.INK); yy += 64
        for ln in bl: d.text((190, yy), ln, font=fb, fill=C.SUB); yy += 58
        y += h + 20
    if y > C.H - 40: print(f"  注意：{out} の文字が下にはみ出しています（y={y}）")
    im.save(out, quality=90)

def page_last(r, out):
    im = Image.new("RGB", (C.W, C.H), C.BG); d = ImageDraw.Draw(im)
    C.header(d, GENRE, 4, 4)
    d.text((60, 140), "まとめ", font=C.font(64), fill=C.INK)
    y = 260; f = C.font(44)
    sl = C.wrap(d, r["summary"], f, C.W - 200); h = 60 + len(sl) * 66
    C.card(d, y, y + h)
    for k, ln in enumerate(sl): d.text((100, y + 30 + k * 66), ln, font=f, fill=C.INK)
    y += h + 30
    if r.get("caution"):
        ft = C.font(40); body = C.wrap(d, r["caution"], ft, C.W - 220); h = 100 + len(body) * 60
        d.rounded_rectangle([50, y, C.W - 50, y + h], radius=36, fill=(255, 222, 214))
        d.text((100, y + 26), "注意", font=C.font(40), fill=C.RED)
        for k, ln in enumerate(body): d.text((100, y + 86 + k * 60), ln, font=ft, fill=C.INK)
        y += h + 30
    t = "保存して、困ったときに見返してね"; f2 = C.font(42); w = d.textlength(t, font=f2)
    yb = max(y + 10, C.H - 150)
    d.rounded_rectangle([(C.W - w) / 2 - 40, yb, (C.W + w) / 2 + 40, yb + 84], radius=42, fill=C.RED)
    d.text(((C.W - w) / 2, yb + 14), t, font=f2, fill=(255, 255, 255))
    if yb + 84 > C.H - 20: print(f"  注意：{out} の文字が下にはみ出しています（y={yb + 84}）")
    im.save(out, quality=90)

def main(src, out):
    out = Path(out); recs = json.loads(Path(src).read_text())
    work = here / "work"; work.mkdir(exist_ok=True); names = []
    for r in recs:
        assert r["id"].startswith("zakki_") and 3 <= len(r["points"]) <= 5 and r.get("summary"), r["id"]
        w = work / r["id"]; w.mkdir(exist_ok=True)
        tl = {"genre": "zakki", "title": r["title"], "serving": "", "voice": "", "ingredients": [],
              "look": {"form": r["form"]}, "T": 6,
              "lines": [{"cue": "teaser", "start": 0, "say": ""}, {"cue": "finish", "start": 1, "say": ""}, {"cue": "list", "start": 4.5, "say": ""}]}
        (w / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False)); names.append(f"work/{r['id']}")
    subprocess.run(["node", "thumbs.js", *names], cwd=here, check=True)
    caps_f = out / "captions.json"; caps = json.loads(caps_f.read_text()) if caps_f.exists() else {}
    covers = []
    for r in recs:
        o = out / "images" / r["id"]; o.mkdir(parents=True, exist_ok=True)
        C.cover(work / r["id"] / "thumb.png", o / "1.jpg", r["kind"], swipe="スワイプして答え →")
        page_answer(r, o / "2.jpg"); page_points(r, o / "3.jpg"); page_last(r, o / "4.jpg")
        caps[r["id"]] = caption(r); covers.append(o / "1.jpg"); print(r["id"], r["title"])
    caps_f.write_text(json.dumps(caps, ensure_ascii=False, indent=1))
    cols = 6; tw, th = 216, 270; rows = (len(covers) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (255, 255, 255))
    for i, c in enumerate(covers): sheet.paste(Image.open(c).resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
    sheet.save(out / "review_zakki.jpg", quality=85)
    print("完了：", len(recs), "本", out / "review_zakki.jpg")

if __name__ == "__main__":
    main(*sys.argv[1:3])
