"""キミが書く物語：会話劇の動画を書き出す。
使い方：python3 drama.py <台本JSON> <出力mp4>
台本JSON：{"world": "white"|"black", "speaker": id, "voice": "名前", "speed": 1.0, "pitch": 0, "intonation": 1.0,
          "scenes": [{"say": "...", "cue": "...", "card": ["..."]}]}
cue：rise / look / stain / eyes_open / window / narrow / stare / plain"""
import io, json, math, random, subprocess, sys, urllib.parse, urllib.request, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

API = "http://127.0.0.1:50021"
W, H, FPS = 1080, 1920, 30
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
GAP = 0.45
_fc = {}
def font(p, s):
    if (p, s) not in _fc: _fc[(p, s)] = ImageFont.truetype(p, s, index=0)
    return _fc[(p, s)]
def ease(x): x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3
def post(path, params, body=None):
    r = urllib.request.Request(f"{API}{path}?{urllib.parse.urlencode(params)}",
        data=json.dumps(body).encode() if body is not None else b"", method="POST", headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r).read()
def tts(text, spk, speed=1.0, pitch=0.0, inton=1.0):
    q = json.loads(post("/audio_query", {"text": text, "speaker": spk}))
    q.update(prePhonemeLength=0.1, postPhonemeLength=0.15, speedScale=speed, pitchScale=pitch, intonationScale=inton)
    b = post("/synthesis", {"speaker": spk}, q)
    with wave.open(io.BytesIO(b)) as w: d = w.getnframes() / w.getframerate()
    return b, d

def wrap(d, text, f, maxw):
    # 句読点のあとで区切れるなら優先して区切る
    segs, buf = [], ""
    for ch in text:
        buf += ch
        if ch in "、。？！…" and not (ch == "…" and len(buf) < 2): segs.append(buf); buf = ""
    if buf: segs.append(buf)
    lines, cur = [], ""
    for sg in segs:
        if d.textlength(cur + sg, font=f) <= maxw: cur += sg
        elif d.textlength(sg, font=f) <= maxw:
            if cur: lines.append(cur)
            cur = sg
        else:
            for ch in sg:
                if d.textlength(cur + ch, font=f) > maxw and cur: lines.append(cur); cur = ch
                else: cur += ch
    if cur: lines.append(cur)
    return lines
def _old_wrap(d, text, f, maxw):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=f) > maxw and cur:
            lines.append(cur); cur = ch
        else: cur += ch
    if cur: lines.append(cur)
    return lines

def figure(d, cx, base, scale, col, alpha=255):
    # 顔のない人影：頭と胴体
    hr = int(70 * scale)
    d.ellipse([cx - hr, base - int(380 * scale) - hr, cx + hr, base - int(380 * scale) + hr], fill=col + (alpha,))
    d.rounded_rectangle([cx - int(110 * scale), base - int(290 * scale), cx + int(110 * scale), base], radius=int(90 * scale), fill=col + (alpha,))

def frame(v, tl, now, T, rnd):
    white = v["world"] == "white"
    bg, fg = ((246, 246, 244), (30, 30, 34)) if white else ((6, 6, 9), (235, 235, 240))
    im = Image.new("RGBA", (W, H), bg + (255,))
    d = ImageDraw.Draw(im)
    # 漂う粒
    for i, (x0, y0, sp) in enumerate(rnd):
        y = (y0 - now * sp) % H
        a = 40 + int(30 * math.sin(now * 1.3 + i))
        c = (180, 180, 186) if white else (90, 70, 120)
        d.ellipse([x0 - 3, y - 3, x0 + 3, y + 3], fill=c + (a,))
    cur = max([e for e in tl if e["start"] <= now] or [tl[0]], key=lambda e: e["start"])
    cues = [e["s"].get("cue", "plain") for e in tl if e["start"] <= now]
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    if white:
        e0 = tl[0]; p = ease((now - e0["start"]) / 2.2)
        base = 1180 - int(0 * p)
        # 起き上がり：最初は低く横たわり、立ち上がる
        sc = 0.55 + 0.45 * p
        # 背後の黒いしみ（stain の場面だけ一瞬）
        for e in tl:
            if e["s"].get("cue") == "stain":
                k = (now - e["start"])
                if 0.6 < k < 2.4:
                    a = int(200 * math.sin(math.pi * (k - 0.6) / 1.8))
                    st = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
                    sd.ellipse([700, 520, 960, 800], fill=(10, 10, 14, a))
                    sd.ellipse([780, 610, 805, 640], fill=(200, 40, 40, a)); sd.ellipse([850, 610, 875, 640], fill=(200, 40, 40, a))
                    lay.alpha_composite(st.filter(ImageFilter.GaussianBlur(14)))
        look = 1 if "look" in cues else 0
        sway = math.sin(now * 1.6) * 6
        figure(ld, int(W / 2 + sway), base, sc, (40, 40, 46))
        im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(1)))
    else:
        e0 = tl[0]; op = ease((now - e0["start"]) / 1.2)
        narrow = 0.45 if "narrow" in cues else 1.0
        blink = 0.1 if (now % 4.7) < 0.12 else 1.0
        stare = "stare" in cues
        eh = int(44 * op * narrow * blink)
        ex = 140 if not stare else 120
        ey = 760 if not stare else 820
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
        for sx in (-1, 1):
            cx = W / 2 + sx * ex
            gd.ellipse([cx - 95, ey - eh * 1.6 - 10, cx + 95, ey + eh * 1.6 + 10], fill=(255, 40, 40, int(90 * op)))
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(30)))
        d = ImageDraw.Draw(im)
        for sx in (-1, 1):
            cx = W / 2 + sx * ex
            d.ellipse([cx - 80, ey - eh, cx + 80, ey + eh], fill=(255, 220, 200, 255))
            d.ellipse([cx - 22, ey - min(eh, 30), cx + 22, ey + min(eh, 30)], fill=(30, 0, 0, 255))
        # 白い小窓（主人公が見える）
        for e in tl:
            if e["s"].get("cue") == "window" and now >= e["start"]:
                k = ease((now - e["start"]) / 0.8)
                ww, wh = int(420 * k), int(320 * k)
                if ww > 10:
                    x0, y0 = W // 2 - ww // 2, 1060
                    win = Image.new("RGBA", (420, 320), (246, 246, 244, 255)); wd = ImageDraw.Draw(win)
                    figure(wd, 210, 300, 0.6 + 0.02 * math.sin(now * 2), (40, 40, 46))
                    win = win.resize((ww, wh))
                    im.alpha_composite(win, (x0, y0))
                    d = ImageDraw.Draw(im)
                    d.rectangle([x0, y0, x0 + ww, y0 + wh], outline=(120, 120, 130), width=3)
    d = ImageDraw.Draw(im)
    # 上：フィクション表記
    f = font(REG, 30); t = "※この物語はフィクションです"
    d.text((W / 2 - d.textlength(t, font=f) / 2, 120), t, font=f, fill=(140, 140, 146) if white else (120, 120, 130))
    f = font(BOLD, 34); t = v.get("title", "キミが書く物語　第0話")
    d.text((W / 2 - d.textlength(t, font=f) / 2, 170), t, font=f, fill=fg)
    # 字幕
    k = ease((now - cur["start"]) / 0.25)
    fs = font(BOLD, 56)
    lines = wrap(d, cur["s"]["say"], fs, 900)
    y = 1440
    box = Image.new("RGBA", (W, H), (0, 0, 0, 0)); bd = ImageDraw.Draw(box)
    bh = 80 * len(lines) + 60
    bd.rounded_rectangle([60, y - 30, W - 60, y - 30 + bh], radius=30, fill=((255, 255, 255, int(235 * k)) if white else (25, 20, 30, int(235 * k))), outline=((30, 30, 34, int(255 * k)) if white else (180, 50, 60, int(255 * k))), width=4)
    im.alpha_composite(box); d = ImageDraw.Draw(im)
    for i, ln in enumerate(lines):
        d.text((W / 2 - d.textlength(ln, font=fs) / 2, y + i * 80 + int(14 * (1 - k))), ln, font=fs, fill=fg)
    # 問いかけカード
    card = None
    for e in tl:
        if e["s"].get("card") and now >= e["start"]: card = e
    if card:
        k = ease((now - card["start"]) / 0.4)
        cl = card["s"]["card"]
        fc = font(BOLD, 52)
        ch = 90 * len(cl) + 50
        y0 = 330 + int(-40 * (1 - k))
        cb = Image.new("RGBA", (W, H), (0, 0, 0, 0)); cd = ImageDraw.Draw(cb)
        cd.rounded_rectangle([70, y0, W - 70, y0 + ch], radius=28, fill=((255, 210, 60, int(245 * k)) if white else (170, 20, 40, int(245 * k))))
        im.alpha_composite(cb); d = ImageDraw.Draw(im)
        for i, ln in enumerate(cl):
            fcc = fc
            while d.textlength(ln, font=fcc) > 880: fcc = font(BOLD, fcc.size - 4)
            d.text((W / 2 - d.textlength(ln, font=fcc) / 2, y0 + 30 + i * 90), ln, font=fcc, fill=(20, 20, 20) if white else (255, 255, 255))
    # 下：声のクレジット
    f = font(REG, 28); t = "VOICEVOX:" + v["voice"]
    d.text((W / 2 - d.textlength(t, font=f) / 2, H - 110), t, font=f, fill=(150, 150, 156) if white else (110, 110, 120))
    # 最初と最後のフェード
    a = min(1.0, now / 0.5, max(0.0, (T - now) / 0.6))
    if a < 1:
        ov = Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - a)))); im.alpha_composite(ov)
    return im.convert("RGB")

def build(v, out):
    out = Path(out); tmp = out.parent / (out.stem + "_tmp"); tmp.mkdir(parents=True, exist_ok=True)
    t, tl = 0.5, []
    for i, s in enumerate(v["scenes"]):
        b, dur = tts(s["say"], v["speaker"], v.get("speed", 1.0), v.get("pitch", 0.0), v.get("intonation", 1.0))
        (tmp / f"n{i}.wav").write_bytes(b)
        tl.append(dict(s=s, start=t, dur=dur)); t += dur + GAP + s.get("pause", 0)
    T = round(t + 0.8, 2)
    # 音：ナレーション＋環境音（白＝やわらかい持続音、黒＝低いうなり）
    amb = tmp / "amb.wav"
    expr = (f"sine=frequency=220:duration={T},volume=0.035" if v["world"] == "white"
            else f"sine=frequency=55:duration={T},tremolo=f=0.5:d=0.6,volume=0.12")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", expr, str(amb)], check=True)
    inputs, filt = ["-i", str(amb)], []
    for i, e in enumerate(tl):
        inputs += ["-i", str(tmp / f"n{i}.wav")]
        ms = int(e["start"] * 1000); filt.append(f"[{i+1}]adelay={ms}|{ms}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(tl)))
    filt.append(f"[0]{mix}amix=inputs={len(tl)+1}:normalize=0,volume=1.6[out]")
    aud = tmp / "audio.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]", "-ar", "48000", "-t", str(T), str(aud)], check=True)
    random.seed(7); rnd = [(random.randint(0, W), random.randint(0, H), random.uniform(10, 40)) for _ in range(40)]
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-i", str(aud), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
    for n in range(int(T * FPS)):
        p.stdin.write(frame(v, tl, n / FPS, T, rnd).tobytes())
    p.stdin.close(); p.wait()
    print(out, f"{T:.1f}秒")

if __name__ == "__main__":
    build(json.loads(Path(sys.argv[1]).read_text()), sys.argv[2])
