"""投稿から22時間以上たった回のインサイトを取り、insights.md に追記する（各回1回だけ）。
posted.txt の各行：<回> <日付> <時刻> <URL>。トークンは IG_TOKEN、アカウントIDは IG_USER_ID。"""
import json, os, re, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

API = "https://graph.facebook.com/v21.0"
here = Path(__file__).parent
TOKEN, IG = os.environ["IG_TOKEN"], os.environ["IG_USER_ID"]
JST = timezone(timedelta(hours=9))
METRICS = [("views", "再生数"), ("reach", "リーチ（見た人数）"), ("likes", "いいね"), ("comments", "コメント"),
           ("saved", "保存"), ("shares", "シェア"), ("total_interactions", "反応の合計"),
           ("ig_reels_avg_watch_time", "平均視聴時間（ミリ秒）"), ("ig_reels_video_view_total_time", "合計視聴時間（ミリ秒）")]

def get(path, **params):
    params["access_token"] = TOKEN
    try:
        with urllib.request.urlopen(f"{API}/{path}?{urllib.parse.urlencode(params)}", timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode(errors="replace")}

out = here / "insights.md"
text = out.read_text() if out.exists() else "# 投稿24時間後のインサイト（30秒解説ラボ）\n\n各回、投稿からおよそ24時間後に1回だけ記録します。新しい回は下に追加されます。\n"
done = set(re.findall(r"^## (\S+)", text, re.M))
caps = json.loads((here / "captions.json").read_text())
now = datetime.now(JST)
media = get(f"{IG}/media", fields="id,permalink,timestamp", limit=100).get("data", [])
by_link = {m["permalink"].rstrip("/"): m["id"] for m in media}
added = 0
for line in (here / "posted.txt").read_text().splitlines():
    p = line.split()
    if len(p) < 4 or p[0] in done: continue
    vid, when, url = p[0], datetime.strptime(f"{p[1]} {p[2]}", "%Y-%m-%d %H:%M").replace(tzinfo=JST), p[3]
    if now - when < timedelta(hours=22): continue
    mid = by_link.get(url.rstrip("/"))
    if not mid: continue
    vals = {}
    for key, label in METRICS:  # 項目ごとに取る（使えない項目は飛ばす）
        r = get(f"{mid}/insights", metric=key)
        if r.get("data"): vals[label] = r["data"][0]["values"][0]["value"]
    if not vals:  # インサイトの権限がないときは、取れる数字だけ記録する
        b = get(mid, fields="like_count,comments_count")
        if "like_count" in b: vals["いいね"] = b["like_count"]
        if "comments_count" in b: vals["コメント"] = b["comments_count"]
        vals["メモ"] = "再生数・リーチ・保存などは、トークンに instagram_manage_insights の権限がないため未取得"
    title = caps.get(vid, "").split("\n")[0].replace("【30秒解説】", "")
    hours = round((now - when).total_seconds() / 3600, 1)
    text += (f"\n## {vid}\n- どの動画か：{vid} {title}\n- 投稿日時：{p[1]} {p[2]}（日本時間）\n- 投稿URL：{url}\n"
             f"- 計測：{now.strftime('%Y-%m-%d %H:%M')}（投稿から{hours}時間後）\n"
             + "".join(f"- {k}：{v}\n" for k, v in vals.items()))
    added += 1
out.write_text(text)
print(f"インサイトを {added} 本追記しました")
