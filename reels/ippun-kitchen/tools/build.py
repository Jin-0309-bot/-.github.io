"""1分キッチン：レシピのデータから、キャプション・表紙（3D）・カルーセル画像4枚をまとめて作る。
使い方（tools フォルダで実行）：python3 build.py <ジャンル> <レシピJSON> <出力フォルダ>
  ジャンル：pasta / side / main / soup / don / dessert / setsuyaku（節約・リメイク。任意で "badge":"カサ増し" など、表紙に印を出す）
  レシピJSON：[{"id":"pasta_002_peperoncino","title":"ペペロンチーノ","serving":"1人分",
                "ingredients":[["スパゲッティ","100g"],...],"steps":["…","…"],"tip":"（任意）",
                "tags":["#ペペロンチーノ",...5個まで],"form":{表紙の型。FORMS.md を参照}}, ...]
  出力：<出力>/images/<id>/1.jpg〜4.jpg、<出力>/captions.json（追記）、<出力>/review_<ジャンル>.jpg（表紙の一覧）"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image
import carousel

GENRE = {"pasta": "パスタ", "side": "前菜・副菜", "main": "主菜", "soup": "汁物", "don": "一品もの・丼", "dessert": "デザート", "setsuyaku": "節約・リメイク"}
here = Path(__file__).parent

def caption(genre, r):
    t = f"【1分キッチン｜{GENRE[genre]}】{r['title']}\n\n▼材料（{r['serving']}）\n"
    t += "\n".join(f"{a}　{b}" for a, b in r["ingredients"]) + "\n\n▼作り方\n"
    t += "\n".join(f"{i}. {s}" for i, s in enumerate(r["steps"], 1)) + "\n"
    if r.get("tip"): t += f"\n▼ポイント\n{r['tip']}\n"
    t += "\n保存して、作るときに見返してね。\n\n" + " ".join(r["tags"][:5]) + "\n"
    return t

def main(genre, recipes, out):
    out = Path(out); recs = json.loads(Path(recipes).read_text())
    work = here / "work"; work.mkdir(exist_ok=True)
    names = []
    for r in recs:
        assert r["id"].startswith(genre + "_"), r["id"]
        assert 3 <= len(r["steps"]) <= 8 and len(r["ingredients"]) <= 10, r["id"]
        w = work / r["id"]; w.mkdir(exist_ok=True)
        tl = {"genre": genre, "title": r["title"], "serving": r["serving"], "voice": "", "ingredients": r["ingredients"],
              "look": {"form": r["form"]}, "T": 6,
              "lines": [{"cue": "teaser", "start": 0, "say": ""}, {"cue": "finish", "start": 1, "say": ""}, {"cue": "list", "start": 4.5, "say": ""}]}
        (w / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False))
        (w / "caption.txt").write_text(caption(genre, r))
        names.append(f"work/{r['id']}")
    subprocess.run(["node", "thumbs.js", *names], cwd=here, check=True)
    caps_f = out / "captions.json"; caps = json.loads(caps_f.read_text()) if caps_f.exists() else {}
    covers = []
    for r in recs:
        w = work / r["id"]
        carousel.main(r["id"], w / "thumb.png", w / "caption.txt", out / "images" / r["id"], badge=r.get("badge"))
        caps[r["id"]] = (w / "caption.txt").read_text()
        covers.append(out / "images" / r["id"] / "1.jpg")
    caps_f.write_text(json.dumps(caps, ensure_ascii=False, indent=1))
    # 表紙の一覧（確認用）：6列
    cols = 6; tw, th = 216, 270; rows = (len(covers) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (255, 255, 255))
    for i, c in enumerate(covers): sheet.paste(Image.open(c).resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
    sheet.save(out / f"review_{genre}.jpg", quality=85)
    print("完了：", len(recs), "品", out / f"review_{genre}.jpg")

if __name__ == "__main__":
    main(*sys.argv[1:4])
