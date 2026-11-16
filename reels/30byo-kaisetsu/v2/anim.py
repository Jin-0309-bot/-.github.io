"""30秒解説 新形式（テンポ版）：クイズ → 3秒カウントダウン → 正解 → 解説 → 例文 → 行動の案内。
文字は横からスライド、正解の選択肢が光る、下に残り時間バー。効果音はffmpegで合成。"""
import io, json, math, subprocess, sys, urllib.parse, urllib.request, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

API, SPK, VOICE = "http://127.0.0.1:50021", 53, "麒ヶ島宗麟"
W, H, FPS = 1080, 1920, 30
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BG, FG, SUB, ACC, DIM, OK, NG = (16, 28, 48), (255, 255, 255), (178, 192, 214), (255, 196, 64), (60, 80, 110), (72, 200, 140), (120, 132, 156)
SPEED, GAP, COUNT = 1.2, 0.25, 3.0
_fc = {}
def font(p, s):
    if (p, s) not in _fc: _fc[(p, s)] = ImageFont.truetype(p, s, index=0)
    return _fc[(p, s)]
def fit(d, t, p, s, maxw=920):
    while s > 30 and d.textlength(t, font=font(p, s)) > maxw: s -= 4
    return font(p, s)
def ease(x): x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3

def post(path, params, body=None):
    r = urllib.request.Request(f"{API}{path}?{urllib.parse.urlencode(params)}",
        data=json.dumps(body).encode() if body is not None else b"", method="POST", headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r).read()
def tts(text, speed):
    q = json.loads(post("/audio_query", {"text": text, "speaker": SPK}))
    q.update(prePhonemeLength=0.05, postPhonemeLength=0.08, speedScale=speed, pauseLengthScale=0.7)
    b = post("/synthesis", {"speaker": SPK}, q)
    with wave.open(io.BytesIO(b)) as w: d = w.getnframes() / w.getframerate()
    return b, d, q["kana"]

def build(v, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    scenes = v["scenes"]
    speed = SPEED
    for _ in range(6):  # 30秒に収まるまで話速を上げる
        clips = [tts(s["say"], speed) for s in scenes]
        total = sum(c[1] for c in clips) + GAP * len(clips) + COUNT + 0.6
        if total <= 30: break
        speed = round(speed * total / 29.5, 3)
    # タイムライン
    t, tl = 0.3, []
    for s, (b, d, k) in zip(scenes, clips):
        tl.append(dict(s=s, start=t, dur=d, wav=b, kana=k))
        t += d + GAP
        if s["type"] == "quiz":
            tl[-1]["count_start"] = t; t += COUNT
        if s["type"] == "reveal":
            tl[-1]["quiz"] = tl[-2]
    T = round(t + 0.4, 2)
    for i, e in enumerate(tl): e["end"] = tl[i + 1]["start"] if i + 1 < len(tl) else T
    # 音声：ナレーション＋効果音
    for i, e in enumerate(tl): (out_dir / f"n{i}.wav").write_bytes(e["wav"])
    sfx = out_dir / "sfx"; sfx.mkdir(exist_ok=True)
    def gen(name, expr):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", expr, str(sfx / name)], check=True)
    gen("tick.wav", "sine=frequency=1200:duration=0.07,afade=t=out:st=0.02:d=0.05,volume=0.5")
    gen("ding.wav", "sine=frequency=1568:duration=0.5,afade=t=out:st=0.05:d=0.45,volume=0.6")
    gen("ding2.wav", "sine=frequency=2093:duration=0.5,afade=t=out:st=0.05:d=0.45,volume=0.4")
    gen("pop.wav", "sine=frequency=660:duration=0.06,afade=t=out:st=0.01:d=0.05,volume=0.35")
    events = [(str(out_dir / f"n{i}.wav"), e["start"]) for i, e in enumerate(tl)]
    for e in tl:
        if "count_start" in e:
            for k in range(3): events.append((str(sfx / "tick.wav"), e["count_start"] + k))
            nxt = e["count_start"] + COUNT
            events += [(str(sfx / "ding.wav"), nxt), (str(sfx / "ding2.wav"), nxt + 0.08)]
        else:
            events.append((str(sfx / "pop.wav"), e["start"]))
    ins = sum([["-i", p] for p, _ in events], [])
    fl = ";".join(f"[{i}]adelay={int(st*1000)}:all=1[a{i}]" for i, (_, st) in enumerate(events))
    fl += ";" + "".join(f"[a{i}]" for i in range(len(events))) + f"amix=inputs={len(events)}:normalize=0,apad=whole_dur={T},atrim=0:{T},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fl, "-map", "[a]", "-ac", "2", str(out_dir / "audio.wav")], check=True)

    # 映像
    out = out_dir / f"{v['id']}.mp4"
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(out_dir / "audio.wav"), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
    nframes = int(T * FPS)
    for fi in range(nframes):
        now = fi / FPS
        e = next(x for x in tl if x["start"] - 0.3 <= now < x["end"] or x is tl[-1])
        for x in tl:
            if x["start"] - (0.3 if x is tl[0] else 0) <= now < x["end"]: e = x
        im = frame(v, e, now, T)
        ff.stdin.write(im.tobytes())
    ff.stdin.close(); ff.wait()
    return dict(id=v["id"], length=T, speed=speed, scenes=[dict(type=x["s"]["type"], start=round(x["start"], 2), end=round(x["start"] + x["dur"], 2), kana=x["kana"]) for x in tl])

def slide_text(d, im, text, f, color, y, t_rel, delay):
    p = ease((t_rel - delay) / 0.28)
    if p <= 0: return
    w = d.textlength(text, font=f)
    x = (W - w) / 2 + (1 - p) * 260
    d.text((x, y), text, font=f, fill=tuple(int(c * p + b * (1 - p)) for c, b in zip(color, BG)))

def frame(v, e, now, T):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    s = e["s"]; tr = now - e["start"]
    # ヘッダー
    d.rounded_rectangle((60, 120, 380, 200), 40, fill=ACC)
    f = font(BOLD, 44); d.text((220 - d.textlength("30秒解説", font=f) / 2, 128), "30秒解説", font=f, fill=BG)
    d.text((410, 132), v["cat"], font=font(REG, 40), fill=SUB)
    # 見出し
    if s.get("head"):
        slide_text(d, im, s["head"], fit(d, s["head"], BOLD, 80), ACC, 330, tr, 0.0)
        p = ease(tr / 0.35) if s["type"] != "reveal" else 1; half = 400 * p
        d.line((W / 2 - half, 450, W / 2 + half, 450), fill=DIM, width=4)
    if s["type"] in ("quiz", "reveal"):
        q = e if s["type"] == "quiz" else e["quiz"]
        qs = q["s"]; qtr = now - q["start"]
        y = 520
        for i, (txt, strong) in enumerate(qs["lines"]):
            ff = fit(d, txt, BOLD, 84) if strong else fit(d, txt, REG, 64)
            slide_text(d, im, txt, ff, ACC if strong else FG, y, qtr, 0.1 + 0.12 * i); y += 120 if strong else 96
        cs = q["count_start"]; ans_t = cs + COUNT
        for i, opt in enumerate(qs["options"]):
            p = ease((qtr - 0.4 - 0.15 * i) / 0.3)
            if p <= 0: continue
            bx0, by0 = 140, 820 + i * 210
            bx1, by1 = W - 140, by0 + 175
            off = (1 - p) * (300 if i % 2 == 0 else -300)
            fill, txtc, lab = (26, 42, 70), FG, ACC
            scale = 1.0
            if now >= ans_t:
                ra = now - ans_t
                if i == qs["answer"]:
                    fill, txtc, lab = OK, BG, BG
                    scale = 1 + 0.08 * math.sin(min(ra / 0.3, 1) * math.pi)
                else:
                    fill, txtc, lab = (30, 40, 60), NG, NG
            cx, cy = (bx0 + bx1) / 2 + off, (by0 + by1) / 2
            hw, hh = (bx1 - bx0) / 2 * scale, (by1 - by0) / 2 * scale
            d.rounded_rectangle((cx - hw, cy - hh, cx + hw, cy + hh), 36, fill=fill, outline=ACC if now < ans_t else fill, width=4)
            d.text((cx - hw + 50, cy - 50), "AB"[i], font=font(BOLD, 80), fill=lab)
            ft = fit(d, opt, BOLD, 96, 400)  # 右側の「正解」表示ぶんを空ける
            bb = d.textbbox((0, 0), opt, font=ft)
            d.text((cx - 35 - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]), opt, font=ft, fill=txtc)
            if now >= ans_t and i == qs["answer"]:
                d.text((cx + hw - 170, cy - 40), "正解", font=font(BOLD, 60), fill=BG)
        if cs <= now < ans_t:
            rem = ans_t - now; n = math.ceil(rem)
            cx, cy, r = W / 2, 1420, 120
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=DIM, width=18)
            d.arc((cx - r, cy - r, cx + r, cy + r), -90, -90 + 360 * (rem / COUNT), fill=ACC, width=18)
            frac = n - rem; sc = 1 + 0.25 * max(0, 1 - frac / 0.2)
            fn = font(BOLD, int(150 * sc)); txt = str(n)
            bb = d.textbbox((0, 0), txt, font=fn)
            d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]), txt, font=fn, fill=FG)
            ctext = "3秒で考えてみて"
            d.text(((W - d.textlength(ctext, font=font(REG, 44))) / 2, 1580), ctext, font=font(REG, 44), fill=SUB)
        if s["type"] == "reveal":
            y = 1300
            for i, (txt, strong) in enumerate(s["lines"]):
                ff = fit(d, txt, BOLD, 80) if strong else fit(d, txt, REG, 60)
                slide_text(d, im, txt, ff, ACC if strong else FG, y, tr, 0.15 + 0.14 * i); y += 115 if strong else 88
    else:
        y = 540
        for i, (txt, strong) in enumerate(s["lines"]):
            if not txt: y += 50; continue
            ff = fit(d, txt, BOLD, 96) if strong else fit(d, txt, REG, 68)
            slide_text(d, im, txt, ff, ACC if strong else FG, y, tr, 0.12 + 0.14 * i); y += 140 if strong else 108
        if s.get("note"):
            ny = 1480
            for ln in s["note"].split("\n"):
                ft = fit(d, ln, REG, 34, 960); d.text(((W - d.textlength(ln, font=ft)) / 2, ny), ln, font=ft, fill=SUB); ny += 52
    # クレジットと残り時間バー
    ft = font(REG, 32); cr = "VOICEVOX:" + VOICE
    d.text(((W - d.textlength(cr, font=ft)) / 2, 1760), cr, font=ft, fill=SUB)
    d.rounded_rectangle((140, 1830, W - 140, 1842), 6, fill=DIM)
    d.rounded_rectangle((140, 1830, 140 + (W - 280) * min(now / T, 1), 1842), 6, fill=ACC)
    return im

if __name__ == "__main__":
    here = Path(__file__).parent
    vids = json.loads((here / sys.argv[1]).read_text())
    rep = [build(v, here / "out" / v["id"]) for v in vids if len(sys.argv) < 3 or v["id"] in sys.argv[2:]]
    for r in rep: print(json.dumps(r, ensure_ascii=False))
