"""1分キッチン：アカウント紹介動画（8アカウント分）を作る。素材は投稿用の表紙画像とアイコンだけを使う。
使い方：python3 make_promo.py <kitchen-posts の images フォルダ> <出力フォルダ>
VOICEVOX（127.0.0.1:50021）が必要。声は春日部つむぎ。"""
import json, subprocess, sys, urllib.request, urllib.parse, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).parent
ICONS = here.parent / "icons"
W, H = 1080, 1920
BG, INK, SUB, RED, NAVY, YEL = (243, 237, 228), (43, 33, 28), (107, 90, 80), (232, 85, 61), (27, 42, 74), (255, 204, 41)
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
F = lambda s: ImageFont.truetype(FONT, s, index=0)
SPK = 8  # 春日部つむぎ
CREDIT = "VOICEVOX:春日部つむぎ"

G = [  # (キー, 表示名, 読み上げ, 説明（読み上げ）, 最後の案内（読み上げ）)
    ("pasta", "パスタ", "パスタ", "家で作れるパスタを、1品ずつ画像でまとめています。", None),
    ("side", "前菜・副菜", "前菜と副菜", "あと1品ほしいときの、前菜と副菜のレシピです。", None),
    ("main", "主菜", "主菜", "今日のおかずが決まる、主菜のレシピです。", None),
    ("soup", "汁物", "汁物", "みそ汁からスープまで、汁物のレシピです。", None),
    ("don", "一品もの・丼", "一品ものと丼", "これ1つで満足する、丼や麺のレシピです。", None),
    ("dessert", "デザート", "デザート", "おうちで作れる、デザートとおやつのレシピです。", None),
    ("setsuyaku", "節約・リメイク", "節約とリメイク", "カサ増し、残り物リメイク、これしかない時のレシピです。", None),
    ("zakki", "キッチン雑学", "キッチン雑学", "調味料の代用や、野菜の選び方、鍋の手入れなど。", "料理がちょっとラクになる知識を、画像でまとめています。保存して、困ったときに見返してね。"),
]
DEFAULT_LAST = "材料と分量は、大きな表で。作り方は、手順ごとに。保存して、作るときに見返してね。"

def tts(text, out, speed=1.15):
    q = urllib.parse.urlencode(dict(text=text, speaker=SPK))
    aq = json.loads(urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:50021/audio_query?{q}", method="POST")).read())
    aq.update(speedScale=speed, outputSamplingRate=48000, outputStereo=True)
    req = urllib.request.Request(f"http://127.0.0.1:50021/synthesis?speaker={SPK}", data=json.dumps(aq).encode(), headers={"Content-Type": "application/json"})
    out.write_bytes(urllib.request.urlopen(req).read())
    with wave.open(str(out)) as w: return w.getnframes() / w.getframerate()

def ctext(d, y, t, f, fill):
    d.text(((W - d.textlength(t, font=f)) / 2, y), t, font=f, fill=fill)

def pill(d, y, t, size, bg, fg, x=None):
    f = F(size); w = d.textlength(t, font=f); px, py = 40, 16
    x0 = (W - w) / 2 - px if x is None else x
    d.rounded_rectangle([x0, y, x0 + w + px * 2, y + size + py * 2 + 8], radius=(size + py * 2) // 2, fill=bg)
    d.text((x0 + px, y + py - 2), t, font=f, fill=fg)

def round_icon(key, size):
    im = Image.open(ICONS / f"icon_{key}.png").convert("RGB").resize((size, size))
    m = Image.new("L", (size, size), 0); ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    return im, m

def card_intro(key, name, p):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    ic, m = round_icon(key, 460); im.paste(ic, ((W - 460) // 2, 470), m)
    pill(d, 1020, "1分キッチン", 60, RED, (255, 255, 255))
    f = 112 if len(name) <= 5 else 92
    ctext(d, 1170, name, F(f), INK)
    ctext(d, H - 110, CREDIT, F(30), SUB); im.save(p)

def card_cover(cover, p):
    im = Image.new("RGB", (W, H), BG)
    c = Image.open(cover).convert("RGB")  # 1080x1350
    im.paste(c, (0, (H - 1350) // 2)); d = ImageDraw.Draw(im)
    ctext(d, H - 110, CREDIT, F(30), SUB); im.save(p)

def card_text(lines, p):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    y = 620
    for t, size, col in lines: ctext(d, y, t, F(size), col); y += int(size * 1.6)
    ctext(d, H - 110, CREDIT, F(30), SUB); im.save(p)

def card_outro(p):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    ctext(d, 300, "ほかのジャンルも", F(84), INK)
    pill(d, 430, "1分キッチン で", 64, RED, (255, 255, 255))
    s = 200; gx, gy = 40, 90; x0 = (W - (4 * s + 3 * gx)) // 2; y0 = 680
    for i, (key, name, *_ ) in enumerate(G):
        r, c = divmod(i, 4); x = x0 + c * (s + gx); y = y0 + r * (s + gy + 60)
        ic, m = round_icon(key, s); im.paste(ic, (x, y), m)
        f = F(30 if len(name) <= 5 else 24); w = d.textlength(name, font=f)
        d.text((x + (s - w) / 2, y + s + 14), name, font=f, fill=INK)
    ctext(d, 1440, "@ippun_kitchen.〇〇 で検索", F(48), SUB)
    ctext(d, H - 110, CREDIT, F(30), SUB); im.save(p)

def run(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)

def still(png, wav, dur, out):
    a = ["-i", str(wav), "-filter_complex", f"[1:a]apad,atrim=0:{dur}[a]"] if wav else ["-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo", "-filter_complex", f"[1:a]atrim=0:{dur}[a]"]
    run("-loop", "1", "-t", f"{dur}", "-i", str(png), *a, "-map", "0:v", "-map", "[a]", "-r", "30",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-t", f"{dur}", str(out))

def build(images, outdir, key, name, spoken, desc, last):
    w = outdir / "work" / key; w.mkdir(parents=True, exist_ok=True)
    covers = sorted((images).glob(f"{key}_*"))[:6]
    segs = []
    d1 = tts(f"1分キッチン、{spoken}。", w / "n1.wav")
    card_intro(key, name, w / "intro.png"); still(w / "intro.png", w / "n1.wav", round(max(2.2, d1 + 0.4), 2), w / "s0.mp4"); segs.append("s0.mp4")
    d2 = tts(desc, w / "n2.wav"); per = max(1.1, round((d2 + 0.3) / len(covers), 2))
    run("-i", str(w / "n2.wav"), "-af", f"apad,atrim=0:{per * len(covers)}", str(w / "n2p.wav"))
    for i, c in enumerate(covers):
        card_cover(c / "1.jpg", w / f"c{i}.png")
        run("-i", str(w / "n2p.wav"), "-af", f"atrim={i * per}:{(i + 1) * per},asetpts=PTS-STARTPTS", str(w / f"n2_{i}.wav"))
        still(w / f"c{i}.png", w / f"n2_{i}.wav", per, w / f"c{i}.mp4"); segs.append(f"c{i}.mp4")
    d3 = tts(last or DEFAULT_LAST, w / "n3.wav")
    if last: lines = [("料理がちょっとラクになる", 64, INK), ("知識を画像で", 64, INK), ("", 30, INK), ("保存して、", 84, RED), ("困ったときに見返してね", 72, RED)]
    else: lines = [("材料と分量は大きな表で", 64, INK), ("作り方は手順ごとに", 64, INK), ("", 30, INK), ("保存して、", 84, RED), ("作るときに見返してね", 72, RED)]
    card_text(lines, w / "text.png"); still(w / "text.png", w / "n3.wav", round(d3 + 0.5, 2), w / "s8.mp4"); segs.append("s8.mp4")
    d4 = tts("ほかのジャンルも、1分キッチンで。", w / "n4.wav")
    card_outro(w / "outro.png"); still(w / "outro.png", w / "n4.wav", round(d4 + 1.6, 2), w / "s9.mp4"); segs.append("s9.mp4")
    (w / "list.txt").write_text("".join(f"file '{s}'\n" for s in segs))
    out = outdir / f"promo_{key}.mp4"
    run("-f", "concat", "-safe", "0", "-i", str(w / "list.txt"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-af", "volume=3dB,alimiter=limit=0.95", "-c:a", "aac", "-movflags", "+faststart", str(out))
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip()
    print(key, name, dur, "秒")

if __name__ == "__main__":
    images, outdir = Path(sys.argv[1]), Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    only = sys.argv[3:] or [g[0] for g in G]
    for key, name, spoken, desc, last in G:
        if key in only: build(images, outdir, key, name, spoken, desc, last)
