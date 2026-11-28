"""30秒解説ラボ：アカウント紹介（予告編）動画を作る。素材は既存の動画（内容は確認済みのもの）だけを使う。"""
import json, subprocess, urllib.request, urllib.parse, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).parent
V = here / "videos"  # reels-videos ブランチの videos/ をここに置いて実行する
W, H = 1080, 1920
BG, Y, WH, SUB = (14, 26, 48), (246, 192, 66), (255, 255, 255), (150, 165, 190)
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
F = lambda s: ImageFont.truetype(FONT, s, index=0)
SPK = 53  # 麒ヶ島宗麟

def tts(text, out, speed):
    q = urllib.parse.urlencode(dict(text=text, speaker=SPK))
    aq = json.loads(urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:50021/audio_query?{q}", method="POST")).read())
    aq["speedScale"] = speed; aq["outputSamplingRate"] = 48000; aq["outputStereo"] = True
    req = urllib.request.Request(f"http://127.0.0.1:50021/synthesis?speaker={SPK}", data=json.dumps(aq).encode(), headers={"Content-Type": "application/json"})
    out.write_bytes(urllib.request.urlopen(req).read())
    with wave.open(str(out)) as w: return w.getnframes() / w.getframerate()

def ctext(d, y, t, f, fill):
    w = d.textlength(t, font=f); d.text(((W - w) / 2, y), t, font=f, fill=fill)

def pill(d, y, t, size, bg, fg):
    f = F(size); w = d.textlength(t, font=f); px, py = 44, 18
    d.rounded_rectangle([(W - w) / 2 - px, y, (W + w) / 2 + px, y + size + py * 2 + 8], radius=(size + py * 2) // 2, fill=bg)
    d.text(((W - w) / 2, y + py - 2), t, font=f, fill=fg)

def credit(d):
    ctext(d, H - 110, "VOICEVOX:麒ヶ島宗麟", F(30), SUB)

def card_intro(p):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    ctext(d, 650, "30秒で、", F(120), Y)
    ctext(d, 820, "ひとつ賢くなる。", F(116), WH)
    pill(d, 1100, "30秒解説ラボ", 64, Y, BG)
    credit(d); im.save(p)

def card_outro(p):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    pill(d, 470, "毎日 12時・19時 に更新", 56, Y, BG)
    ctext(d, 700, "敬語・英語・お金・防災", F(70), WH)
    ctext(d, 800, "宇宙・地理・日本語 など", F(70), WH)
    ctext(d, 1010, "フォローして", F(110), Y)
    ctext(d, 1160, "毎日ひとつ賢くなろう", F(96), WH)
    ctext(d, 1400, "@30byo_lab", F(60), SUB)
    credit(d); im.save(p)

def label_png(p, text, y=1380):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pill(d, y, text, 80, Y, BG); im.save(p)

def run(*a): subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)

def still_seg(png, wav, dur, out):
    run("-loop", "1", "-t", f"{dur}", "-i", str(png), "-i", str(wav), "-filter_complex",
        f"[1:a]apad,atrim=0:{dur}[a]", "-map", "0:v", "-map", "[a]", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", str(out))

def clip_seg(src, ss, dur, label, wav, out, y=1380):
    lp = here / f"lab_{label}.png"; label_png(lp, label, y)
    inputs = ["-ss", f"{ss}", "-t", f"{dur}", "-i", str(src), "-i", str(lp)]
    if wav: inputs += ["-i", str(wav)]
    afil = f"[2:a]apad,atrim=0:{dur}[a]" if wav else f"anullsrc=r=48000:cl=stereo,atrim=0:{dur}[a]"
    run(*inputs, "-filter_complex", f"[0:v][1:v]overlay=0:0,fps=30[v];{afil}", "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-t", f"{dur}", str(out))

def main():
    segs = []
    card_intro(here / "intro.png"); card_outro(here / "outro.png")
    d1 = tts("30秒で、ひとつ賢くなる。30秒解説ラボ。", here / "n1.wav", 1.2)
    still_seg(here / "intro.png", here / "n1.wav", round(d1 + 0.5, 2), here / "s1.mp4"); segs.append("s1.mp4")
    # 出題シーンを5本（各1.9秒）。ナレーションは最初の1本から、5本をまたいで流す
    clips = [("K03", 2.3, "敬語"), ("V04", 2.3, "英語"), ("M03", 2.3, "お金"), ("S02", 2.3, "防災"), ("U05", 2.3, "宇宙")]
    d2 = tts("敬語、英語、お金、防災、宇宙まで。毎日、3秒クイズで出題します。", here / "n2.wav", 1.1)
    per = max(1.9, round((d2 + 0.3) / len(clips), 2))
    run("-i", str(here / "n2.wav"), "-af", f"apad,atrim=0:{per * len(clips)}", str(here / "n2p.wav"))
    for i, (v, ss, lab) in enumerate(clips):
        run("-i", str(here / "n2p.wav"), "-af", f"atrim={i * per}:{(i + 1) * per},asetpts=PTS-STARTPTS", str(here / f"n2_{i}.wav"))
        clip_seg(V / f"{v}.mp4", ss, per, lab, here / f"n2_{i}.wav", here / f"c{i}.mp4"); segs.append(f"c{i}.mp4")
    # 正解の場面
    d3 = tts("あなたは、わかりましたか？", here / "n3.wav", 1.1)
    clip_seg(V / "K03.mp4", 9.6, round(max(2.6, d3 + 0.5), 2), "答え合わせ", here / "n3.wav", here / "c5.mp4", y=1560); segs.append("c5.mp4")
    d4 = tts("毎日12時と19時に更新。フォローして、毎日ひとつ賢くなろう。", here / "n4.wav", 1.2)
    still_seg(here / "outro.png", here / "n4.wav", round(d4 + 0.8, 2), here / "s9.mp4"); segs.append("s9.mp4")
    (here / "list.txt").write_text("".join(f"file '{s}'\n" for s in segs))
    run("-f", "concat", "-safe", "0", "-i", str(here / "list.txt"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(here / "promo_30byo.mp4"))
    print("完了", subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(here / "promo_30byo.mp4")], capture_output=True, text=True).stdout.strip(), "秒")

main()
