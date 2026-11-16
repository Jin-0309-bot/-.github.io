"""scripts.json から台本ごとに 音声（VOICEVOX）・文字カード・SRT・30秒動画 を作る。"""
import io, json, subprocess, sys, urllib.parse, urllib.request, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)
API, SPK, VOICE = "http://127.0.0.1:50021", 53, "麒ヶ島宗麟"
W, H = 1080, 1920
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BG, FG, SUB, ACC, DIM = (16, 28, 48), (255, 255, 255), (178, 192, 214), (255, 196, 64), (60, 80, 110)
END_SPEED, MID_SPEED, GAP_MIN = 1.2, 1.1, 0.25
GAP_MAX, GAP_TARGET, MIN_MID = 1.0, 0.7, 1.0  # 間が空きすぎたらゆっくり読む（中の区間は1.0倍まで）

def font(p, s): return ImageFont.truetype(p, s, index=0)

def fit(d, text, path, size, maxw=900):
    while size > 30 and d.textlength(text, font=font(path, size)) > maxw:
        size -= 4
    return font(path, size)

def center(d, y, text, f, fill):
    d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)

def card(cat, seg, idx, total, path):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.rounded_rectangle((60, 120, 380, 200), 40, fill=ACC)
    f = font(BOLD, 44); d.text((220 - d.textlength("30秒解説", font=f) / 2, 128), "30秒解説", font=f, fill=BG)
    d.text((410, 132), cat, font=font(REG, 40), fill=SUB)
    center(d, 420, seg["head"], fit(d, seg["head"], BOLD, 84), ACC)
    d.line((140, 550, W - 140, 550), fill=DIM, width=4)
    y = 640
    for text, strong in seg["lines"]:
        if not text: y += 50; continue
        f = fit(d, text, BOLD, 96) if strong else fit(d, text, REG, 70)
        center(d, y, text, f, ACC if strong else FG); y += 140 if strong else 110
    if seg.get("note"):
        ny = 1430
        for ln in seg["note"].split("\n"):
            center(d, ny, ln, fit(d, ln, REG, 34, 960), SUB); ny += 52
    center(d, 1700, "VOICEVOX:" + VOICE, font(REG, 32), SUB)
    x0 = (W - (total * 84 - 20)) / 2
    for k in range(total):
        x = x0 + k * 84
        d.rounded_rectangle((x, 1790, x + 64, 1802), 6, fill=ACC if k <= idx else DIM)
    im.save(path)

def post(p, params, body=None):
    r = urllib.request.Request(f"{API}{p}?{urllib.parse.urlencode(params)}",
        data=json.dumps(body).encode() if body is not None else b"", method="POST",
        headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r).read()

def dur(b):
    with wave.open(io.BytesIO(b)) as w: return w.getnframes() / w.getframerate()

def ts(t):
    ms = int(round(t * 1000)); return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"

report = []
for v in json.loads((HERE / "scripts.json").read_text()):
    vd = OUT / v["id"]; vd.mkdir(exist_ok=True)
    n = len(v["segs"])
    base = [END_SPEED if i in (0, n - 1) else MID_SPEED for i in range(n)]
    qs = [json.loads(post("/audio_query", {"text": s["say"], "speaker": SPK})) for s in v["segs"]]
    k = 1.0
    for _ in range(8):
        wavs = []
        for q, b in zip(qs, base):
            q.update(prePhonemeLength=0.05, postPhonemeLength=0.05, speedScale=round(b * k, 3))
            wavs.append(post("/synthesis", {"speaker": SPK}, q))
        ds = [dur(w) for w in wavs]
        g = (30 - sum(ds)) / n
        if g < GAP_MIN:
            k *= sum(ds) / (30 - n * GAP_MIN) * 1.01
        elif g > GAP_MAX and MID_SPEED * k > MIN_MID + 0.005:
            k = max(k * sum(ds) / (30 - n * GAP_TARGET), MIN_MID / MID_SPEED)
        else:
            break
    gap = (30 - sum(ds)) / n
    starts, t = [], 0.0
    for d_ in ds: starts.append(round(t, 3)); t += d_ + gap
    bounds = starts + [30.0]
    for i, w in enumerate(wavs, 1): (vd / f"seg{i}.wav").write_bytes(w)
    for i, s in enumerate(v["segs"]): card(v["cat"], s, i, n, vd / f"card{i+1}.png")
    # SRT（ナレーションの文をそのまま字幕に）
    srt = [f"{i+1}\n{ts(starts[i])} --> {ts(starts[i] + ds[i])}\n{s['say']}\n" for i, s in enumerate(v["segs"])]
    (vd / f"{v['id']}.srt").write_text("\n".join(srt), encoding="utf-8")
    ins = sum([["-i", str(vd / f"seg{i}.wav")] for i in range(1, n + 1)], [])
    fl = ";".join(f"[{i}]adelay={int(starts[i]*1000)}:all=1[s{i}]" for i in range(n))
    fl += ";" + "".join(f"[s{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,apad=whole_dur=30,atrim=0:30,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", fl, "-map", "[a]", "-ac", "2", str(vd / "narration.wav")], check=True)
    vin = []
    for i in range(n): vin += ["-loop", "1", "-t", f"{bounds[i+1]-bounds[i]:.3f}", "-i", str(vd / f"card{i+1}.png")]
    out = OUT / f"30sec_kaisetsu_{v['id']}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *vin, "-i", str(vd / "narration.wav"),
        "-filter_complex", "".join(f"[{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,fps=30,format=yuv420p[v]",
        "-map", "[v]", "-map", f"{n}:a", "-c:v", "libx264", "-tune", "stillimage", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
        "-t", "30", "-movflags", "+faststart", str(out)], check=True)
    vlen = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout)
    report.append(dict(id=v["id"], length=vlen, speeds=[round(b * k, 2) for b in base], gap=round(gap, 2),
        segs=[dict(start=starts[i], end=round(starts[i] + ds[i], 2), card_until=bounds[i+1], kana=q["kana"]) for i, q in enumerate(qs)]))
    print(v["id"], vlen, [round(b * k, 2) for b in base], "gap", round(gap, 2), flush=True)
(OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
