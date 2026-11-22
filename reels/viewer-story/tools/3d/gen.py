"""台本JSON → 音声（VOICEVOX）とタイムライン。python3 gen.py <台本JSON> <名前>"""
import io, json, subprocess, sys, urllib.parse, urllib.request, wave
from pathlib import Path
API = "http://127.0.0.1:50021"; GAP = 0.5
def post(p, params, body=None):
    r = urllib.request.Request(f"{API}{p}?{urllib.parse.urlencode(params)}", data=json.dumps(body).encode() if body else b"", method="POST", headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r).read()
v = json.loads(Path(sys.argv[1]).read_text()); name = sys.argv[2]
out = Path(name); out.mkdir(exist_ok=True)
t = v.get("lead", 1.6); lines = []
for i, s in enumerate(v["scenes"]):
    q = json.loads(post("/audio_query", {"text": s["say"], "speaker": v["speaker"]}))
    q.update(prePhonemeLength=0.1, postPhonemeLength=0.15, speedScale=v.get("speed", 1.0), pitchScale=v.get("pitch", 0.0))
    b = post("/synthesis", {"speaker": v["speaker"]}, q); (out / f"n{i}.wav").write_bytes(b)
    with wave.open(io.BytesIO(b)) as w: d = w.getnframes() / w.getframerate()
    lines.append(dict(s, start=round(t, 3), dur=round(d, 3))); t += d + GAP + s.get("pause", 0)
T = round(t + 0.8, 2)
json.dump(dict(world=v["world"], voice=v["voice"], title=v.get("title", "キミが書く物語　第0話"), T=T, lines=lines), open(out / "timeline.json", "w"), ensure_ascii=False)
amb = (f"sine=frequency=220:duration={T},volume=0.035" if v["world"] == "white" else f"sine=frequency=55:duration={T},tremolo=f=0.5:d=0.6,volume=0.14")
ins, flt = ["-f", "lavfi", "-i", amb], []
for i, l in enumerate(lines):
    ins += ["-i", str(out / f"n{i}.wav")]; ms = int(l["start"] * 1000); flt.append(f"[{i+1}]adelay={ms}|{ms}[a{i}]")
flt.append("[0]" + "".join(f"[a{i}]" for i in range(len(lines))) + f"amix=inputs={len(lines)+1}:normalize=0,volume=1.6[o]")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(flt), "-map", "[o]", "-ar", "48000", "-t", str(T), str(out / "audio.wav")], check=True)
print(name, T, [(l["start"], l.get("cue")) for l in lines])
