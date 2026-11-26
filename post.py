"""Instagram リールを1本投稿する（GitHub Actions から実行）。
queue.txt の順に、posted.txt にまだない回を1本選び、videos/<ID>.mp4 と captions.json の説明文で投稿する。
トークンは環境変数 IG_TOKEN、アカウントIDは IG_USER_ID から読む。"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

API = "https://graph.facebook.com/v21.0"
here = Path(__file__).parent
TOKEN, IG = os.environ["IG_TOKEN"], os.environ["IG_USER_ID"]

def call(method, url, params=None, data=None, headers=None):
    if params: url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"API error {e.code}: {e.read().decode(errors='replace')}")

queue = [l.strip() for l in (here / "queue.txt").read_text().splitlines() if l.strip()]
posted_file = here / "posted.txt"
posted = {l.split()[0] for l in posted_file.read_text().splitlines() if l.strip()} if posted_file.exists() else set()
todo = [v for v in queue if v not in posted]
if not todo:
    print("すべて投稿済みです"); sys.exit(0)
# 枠ごとに1本だけ投稿する（二重投稿・遅れて来た実行の対策）。
# 昼の枠＝11:00〜18:59、夜の枠＝19:00〜翌10:59（日本時間）。手動実行で force を付けたときだけ枠を無視する。
JST = timezone(timedelta(hours=9))
def slot(dt):
    if 11 <= dt.hour < 19: return (dt.date(), "昼")
    return ((dt if dt.hour >= 19 else dt - timedelta(days=1)).date(), "夜")
if os.environ.get("FORCE") != "true" and posted_file.exists():
    lines = [l.split() for l in posted_file.read_text().splitlines() if l.strip()]
    if lines:
        last = datetime.strptime(lines[-1][1] + " " + lines[-1][2], "%Y-%m-%d %H:%M").replace(tzinfo=JST)
        if slot(last) == slot(datetime.now(JST)):
            d, n = slot(last)
            print(f"{d} の{n}の枠はもう投稿済みです（{lines[-1][0]} {lines[-1][1]} {lines[-1][2]}）"); sys.exit(0)
vid = todo[0]
caption = json.loads((here / "captions.json").read_text())[vid]
video = here / "videos" / f"{vid}.mp4"
size = video.stat().st_size
print(f"投稿する回：{vid}（{size} bytes）")

# 1. 入れ物を作る（再開可能アップロード）
c = call("POST", f"{API}/{IG}/media", data=urllib.parse.urlencode(dict(
    media_type="REELS", upload_type="resumable", share_to_feed="true", caption=caption, access_token=TOKEN)).encode())
cid, uri = c["id"], c["uri"]
# 2. 動画を送る
up = call("POST", uri, data=video.read_bytes(),
          headers={"Authorization": f"OAuth {TOKEN}", "offset": "0", "file_size": str(size)})
if not up.get("success"): sys.exit(f"アップロード失敗：{up}")
# 3. 処理が終わるまで待つ（最大10分）
for _ in range(60):
    st = call("GET", f"{API}/{cid}", params=dict(fields="status_code,status", access_token=TOKEN))
    if st.get("status_code") == "FINISHED": break
    if st.get("status_code") in ("ERROR", "EXPIRED"): sys.exit(f"処理エラー：{st}")
    time.sleep(10)
else:
    sys.exit("処理が10分で終わりませんでした")
# 4. 公開する
pub = call("POST", f"{API}/{IG}/media_publish", data=urllib.parse.urlencode(dict(creation_id=cid, access_token=TOKEN)).encode())
info = call("GET", f"{API}/{pub['id']}", params=dict(fields="permalink", access_token=TOKEN))
jst = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M")
with posted_file.open("a") as f: f.write(f"{vid} {jst} {info.get('permalink', '')}\n")
print(f"投稿しました：{vid} {info.get('permalink', '')}（残り {len(todo) - 1} 本）")
