# 1分キッチン：カルーセル自動投稿

- `config.json`：開始日（start）、アカウントの順番（order）、各アカウントの Instagram ID と投稿する料理の順番（queue）
- `images/<料理ID>/1.jpg〜4.jpg`：投稿する画像（1080x1350）。公開URL（raw.githubusercontent.com）で Instagram に渡す
- `captions.json`：料理IDごとの説明文
- `posted.txt`：投稿の記録（アカウント 料理ID 日付 時刻 URL）
- `post_carousel.py`：投稿するプログラム（.github/workflows/kitchen-carousel.yml から毎日実行）

投稿の順番：6アカウントを3日で一巡（1日目 パスタ・汁物／2日目 前菜副菜・一品もの丼／3日目 主菜・デザート）。
料理を足すときは、images と captions.json に追加して、そのアカウントの queue の最後に料理IDを足す。
