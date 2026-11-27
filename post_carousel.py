"""1分キッチン：カルーセル（複数枚の画像）を Instagram に自動投稿する（GitHub Actions から実行）。

- アカウントを3日で一巡する。今日が何日目かで、投稿するアカウントが決まる（order の i 番目は、i を3で割った余り＝開始からの日数を3で割った余り の日）。
- 各アカウントは config.json の queue の順に、posted.txt にまだない料理を1つ投稿する。
- 画像は images/<料理ID>/1.jpg〜 を、公開URL（raw.githubusercontent.com）で Instagram に渡す。
- 同じアカウントは同じ日に2回投稿しない（FORCE=true のときだけ例外）。
- MODE=list のときは投稿せず、トークンで使える Instagram アカウントの ID を表示する（初回の設定用）。

環境変数：KITCHEN_IG_TOKEN（トークン）、MODE（post / list）、FORCE（true / false）"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

API = "https://graph.facebook.com/v21.0"
here = Path(__file__).parent
TOKEN = os.environ.get("KITCHEN_IG_TOKEN", "")
JST = timezone(timedelta(hours=9))
RAW = "https://raw.githubusercontent.com/Jin-0309-bot/-.github.io/kitchen-posts/images"

def call(method, url, params=None, data=None):
    params = dict(params or {}, access_token=TOKEN)
    if method == "GET": url += "?" + urllib.parse.urlencode(params); body = None
    else: body = urllib.parse.urlencode(dict(data or {}, access_token=TOKEN)).encode()
    req = urllib.request.Request(url, data=body, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"API error {e.code}: {e.read().decode(errors='replace')}")

def wait_ready(cid):
    for _ in range(60):
        st = call("GET", f"{API}/{cid}", params=dict(fields="status_code"))
        if st.get("status_code") == "FINISHED": return
        if st.get("status_code") in ("ERROR", "EXPIRED"): raise RuntimeError(f"処理エラー：{st}")
        time.sleep(5)
    raise RuntimeError("処理が5分で終わりませんでした")

def list_accounts():
    r = call("GET", f"{API}/me/accounts", params=dict(fields="name,instagram_business_account{id,username}", limit=50))
    print("このトークンで使える Instagram アカウント：")
    for p in r.get("data", []):
        ig = p.get("instagram_business_account")
        if ig: print(f"  @{ig.get('username')}  ID={ig['id']}  （Facebookページ：{p['name']}）")
        else: print(f"  （Instagram 未連携のページ：{p['name']}）")

def post_one(ig_id, dish, caption, n_images):
    children = []
    for i in range(1, n_images + 1):
        c = call("POST", f"{API}/{ig_id}/media", data=dict(image_url=f"{RAW}/{dish}/{i}.jpg", is_carousel_item="true"))
        children.append(c["id"])
    for c in children: wait_ready(c)
    car = call("POST", f"{API}/{ig_id}/media", data=dict(media_type="CAROUSEL", children=",".join(children), caption=caption))
    wait_ready(car["id"])
    pub = call("POST", f"{API}/{ig_id}/media_publish", data=dict(creation_id=car["id"]))
    info = call("GET", f"{API}/{pub['id']}", params=dict(fields="permalink"))
    return info.get("permalink", "")

def main():
    if not TOKEN: sys.exit("KITCHEN_IG_TOKEN が設定されていません")
    if os.environ.get("MODE") == "list": list_accounts(); return
    cfg = json.loads((here / "config.json").read_text())
    caps = json.loads((here / "captions.json").read_text())
    posted_file = here / "posted.txt"
    posted = [l.split() for l in posted_file.read_text().splitlines() if l.strip()] if posted_file.exists() else []
    now = datetime.now(JST); today = now.date()
    day = (today - date.fromisoformat(cfg["start"])).days
    if day < 0: print(f"開始日（{cfg['start']}）より前なので何もしません"); return
    order = cfg["order"]
    due = [a for i, a in enumerate(order) if i % 3 == day % 3]
    force = os.environ.get("FORCE") == "true"
    print(f"{today}：開始から{day + 1}日目。今日の担当：{', '.join(due)}")
    failed = False
    for acc in due:
        a = cfg["accounts"][acc]
        if not a.get("ig_user_id"): print(f"[{acc}] Instagram の ID が未設定なので飛ばします"); continue
        if not force and any(p[0] == acc and p[2] == str(today) for p in posted):
            print(f"[{acc}] 今日はもう投稿済みです"); continue
        done = {p[1] for p in posted if p[0] == acc}
        todo = [d for d in a["queue"] if d not in done]
        if not todo: print(f"[{acc}] 投稿する料理がもうありません（queue に追加してください）"); continue
        dish = todo[0]
        n = len(sorted((here / "images" / dish).glob("*.jpg")))
        try:
            url = post_one(a["ig_user_id"], dish, caps[dish], n)
        except Exception as e:
            print(f"[{acc}] {dish} の投稿に失敗：{e}"); failed = True; continue
        line = f"{acc} {dish} {today} {datetime.now(JST).strftime('%H:%M')} {url}"
        with posted_file.open("a") as f: f.write(line + "\n")
        posted.append(line.split())
        print(f"[{acc}] 投稿しました：{line}")
    if failed: sys.exit(1)

if __name__ == "__main__":
    main()
