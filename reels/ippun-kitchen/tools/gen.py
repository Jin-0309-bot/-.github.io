"""台本JSON → 音声とタイムライン。python3 gen.py <台本JSON> <出力フォルダ名>"""
import io, json, subprocess, sys, urllib.parse, urllib.request, wave
from pathlib import Path
API = "http://127.0.0.1:50021"; GAP = 0.35
def post(p, params, body=None):
    r = urllib.request.Request(f"{API}{p}?{urllib.parse.urlencode(params)}", data=json.dumps(body).encode() if body else b"", method="POST", headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r).read()
v = json.loads(Path(sys.argv[1]).read_text()); out = Path(sys.argv[2]); out.mkdir(exist_ok=True)
t = v.get("lead", 0.6); lines = []
for i, s in enumerate(v["scenes"]):
    q = json.loads(post("/audio_query", {"text": s["say"], "speaker": v["speaker"]}))
    q.update(prePhonemeLength=0.05, postPhonemeLength=0.1, speedScale=v.get("speed", 1.0))
    b = post("/synthesis", {"speaker": v["speaker"]}, q); (out / f"n{i}.wav").write_bytes(b)
    with wave.open(io.BytesIO(b)) as w: d = w.getnframes() / w.getframerate()
    lines.append(dict(s, start=round(t, 3), dur=round(d, 3))); t += d + GAP + s.get("pause", 0)
T = round(t + v.get("tail", 2.2), 2)
meta = {k: v[k] for k in v if k != "scenes"}
json.dump(dict(meta, T=T, lines=lines), open(out / "timeline.json", "w"), ensure_ascii=False)
# 明るい持続音（小さめ）＋ナレーション
amb = f"sine=frequency=392:duration={T},volume=0.012"
ins, flt = ["-f", "lavfi", "-i", amb], []
for i, l in enumerate(lines):
    ins += ["-i", str(out / f"n{i}.wav")]; ms = int(l["start"] * 1000); flt.append(f"[{i+1}]adelay={ms}|{ms}[a{i}]")
flt.append("[0]" + "".join(f"[a{i}]" for i in range(len(lines))) + f"amix=inputs={len(lines)+1}:normalize=0,volume=1.5[o]")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(flt), "-map", "[o]", "-ar", "48000", "-t", str(T), str(out / "audio.wav")], check=True)
print(out, T, [(l["start"], l["cue"]) for l in lines])
