# Instagram リール自動投稿用（30秒解説ラボ）
- videos/：投稿する動画（英語クイズ E01〜E266）
- captions.json：各回の説明文
- queue.txt：投稿する順番（上から）。並べ替えると投稿順が変わる
- posted.txt：投稿済みの記録（GitHub Actions が自動で追記）
- post.py：1本投稿するプログラム。main の .github/workflows/instagram-reels.yml から毎日12時・19時（日本時間）に実行
