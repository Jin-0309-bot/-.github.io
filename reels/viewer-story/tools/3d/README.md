# 3D版の書き出し

準備：VOICEVOX エンジンを 127.0.0.1:50021 で起動、このフォルダで `npm i three@0.160.0`。

1. `python3 gen.py ../../scripts/ep00_shiro.json shiro` … 音声と shiro/timeline.json を作る
2. `node render.js shiro` … scene.html をブラウザで1コマずつ描いて shiro/video.mp4 に
3. `ffmpeg -i shiro/video.mp4 -i shiro/audio.wav -c:v copy -c:a aac -shortest ep00_shiro_3d.mp4`

場面の演出は台本JSONの cue（シロ：rise / look / stain、クロ：eyes_open / window / narrow / stare）とカメラのキー（scene.html の keys）で決まる。
