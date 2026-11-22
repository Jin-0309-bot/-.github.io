# 3D版の書き出し

準備：VOICEVOX エンジンを 127.0.0.1:50021 で起動、このフォルダで `npm i three@0.160.0`。

1. `python3 gen.py ../../scripts/ep00_hero.json hero` … 音声と hero/timeline.json を作る
2. `node render.js hero` … scene.html をブラウザで1コマずつ描いて hero/video.mp4 に
3. `ffmpeg -i hero/video.mp4 -i hero/audio.wav -c:v copy -c:a aac -shortest ep00_hero_3d.mp4`

場面の演出は台本JSONの cue（主人公：rise / look / stain、敵：eyes_open / window / narrow / stare）とカメラのキー（scene.html の keys）で決まる。
