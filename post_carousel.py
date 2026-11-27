"""1分キッチン：カルーセル（複数枚の画像）を Instagram に自動投稿する（GitHub Actions から実行）。

- 「Instagramでログイン」方式（graph.instagram.com）。Facebookページは使わない。
  トークンはアカウントごと：環境変数 KITCHEN_TOKEN_<アカウント名の大文字>（例：KITCHEN_TOKEN_PASTA）。
- アカウントを3日で一巡する。order の i 番目のアカウントは、(開始からの日数) を3で割った余りが i を3で割った余りと同じ日に投稿する。
- 各アカウントは config.json の queue の順に、posted.txt にまだない料理を1つ投稿する。
- 画像は images/<料理ID>/1.jpg〜 を、公開URL（raw.githubusercontent.com）で Instagram に渡す。
- 同じアカウントは同じ日に2回投稿しない（FORCE=true のときだけ例外）。
- トークンがまだ無いアカウントは飛ばす（準備できた順に始まる）。
- MODE=list のときは投稿せず、各トークンがどの Instagram アカウントのものかを表示する（確認用）。

環境変数：KITCHEN_TOKEN_<NAME>、MODE（post / list）、FORCE（true / false）"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

IG_API = "https://graph.instagram.com/v21.0"   # IGAA… の形のトークン
FB_API = "https://graph.facebook.com/v21.0"    # EAA… の形のトークン（統合ログインで発行されるもの）
def api_for(token): return FB_API if token.startswith("EA") else IG_API
here = Path(__file__).parent
JST = timezone(timedelta(hours=9))
RAW = "https://raw.githubusercontent.com/Jin-0309-bot/-.github.io/kitchen-posts/images"

def token_of(acc):
    return os.environ.get(f"KITCHEN_TOKEN_{acc.upper()}", "").strip()

def call(token, method, url, params=None, data=None):
    if method == "GET":
        url += "?" + urllib.parse.urlencode(dict(params or {}, access_token=token)); body = None
    else:
        body = urllib.parse.urlencode(dict(data or {}, access_token=token)).encode()
    req = urllib.request.Request(url, data=body, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"API error {e.code}: {e.read().decode(errors='replace')}")

def whoami(token):
    """トークンの Instagram アカウント（user_id, username）を調べる。形によって聞き方が違うので順に試す"""
    errs = []
    for fields in ("user_id,username", "id,username"):
        try:
            r = call(token, "GET", f"{api_for(token)}/me", params=dict(fields=fields))
            return dict(user_id=r.get("user_id") or r.get("id"), username=r.get("username"))
        except Exception as e: errs.append(str(e))
    raise RuntimeError(" / ".join(errs))

def wait_ready(token, cid):
    for _ in range(60):
        st = call(token, "GET", f"{api_for(token)}/{cid}", params=dict(fields="status_code"))
        if st.get("status_code") == "FINISHED": return
        if st.get("status_code") in ("ERROR", "EXPIRED"): raise RuntimeError(f"処理エラー：{st}")
        time.sleep(5)
    raise RuntimeError("処理が5分で終わりませんでした")

def post_one(token, ig_id, dish, caption, n_images):
    children = []
    for i in range(1, n_images + 1):
        c = call(token, "POST", f"{api_for(token)}/{ig_id}/media", data=dict(image_url=f"{RAW}/{dish}/{i}.jpg", is_carousel_item="true"))
        children.append(c["id"])
    for c in children: wait_ready(token, c)
    car = call(token, "POST", f"{api_for(token)}/{ig_id}/media", data=dict(media_type="CAROUSEL", children=",".join(children), caption=caption))
    wait_ready(token, car["id"])
    pub = call(token, "POST", f"{api_for(token)}/{ig_id}/media_publish", data=dict(creation_id=car["id"]))
    info = call(token, "GET", f"{api_for(token)}/{pub['id']}", params=dict(fields="permalink"))
    return info.get("permalink", "")

def probe(cfg):
    """（調査用）システムユーザーのトークンで見える Instagram アカウントを探す。トークン自体は表示しない"""
    t = next((token_of(a) for a in cfg["order"] if token_of(a)), "")
    if not t: return
    def g(path, **params):
        try: return call(t, "GET", f"{FB_API}/{path}", params=params)
        except Exception as e: return {"error": str(e)[:250]}
    print("== 調査")
    print("  me:", g("me", fields="id,name"))
    biz = g("me/businesses", fields="id,name"); print("  me/businesses:", biz)
    print("  me/assigned_pages:", g("me/assigned_pages", fields="name,instagram_business_account{id,username}"))
    for b in biz.get("data", []):
        for edge in ("owned_instagram_accounts", "instagram_accounts", "instagram_business_accounts", "client_instagram_accounts", "owned_pages"):
            print(f"  {b['id']}/{edge}:", json.dumps(g(f"{b['id']}/{edge}", fields="id,username,name"), ensure_ascii=False)[:500])
    # 各トークンが同じシステムユーザーか
    for acc in cfg["order"]:
        tt = token_of(acc)
        if tt:
            try: r = call(tt, "GET", f"{FB_API}/me", params=dict(fields="id,name")); print(f"  [{acc}] me:", r)
            except Exception as e: print(f"  [{acc}] me: {str(e)[:150]}")

def list_accounts(cfg):
    if os.environ.get("PROBE") == "1" or any(token_of(a).startswith("EA") for a in cfg["order"]): probe(cfg)
    print("各アカウントのトークンの確認：")
    bad = False
    for acc in cfg["order"]:
        t = token_of(acc)
        if not t: print(f"  [{acc}] トークン未登録（KITCHEN_TOKEN_{acc.upper()}）"); continue
        try:
            me = whoami(t)
            want = cfg["accounts"][acc].get("username", "")
            mark = "" if not want or me.get("username") == want else f"  ← config の username（{want}）と違います"
            print(f"  [{acc}] @{me.get('username')}  ID={me.get('user_id')}{mark}")
        except Exception as e:
            # 原因を調べるため、トークンの長さと先頭4文字だけ表示する（これだけでは使えない）
            kind = "Instagramログインの形" if t.startswith("IG") else ("Facebookログインの形" if t.startswith("EA") else "トークンの形ではない")
            print(f"  [{acc}] トークンが使えません（{len(t)}文字、先頭 {t[:4]}…、{kind}）：{e}"); bad = True
    if bad: sys.exit(1)

def main():
    cfg = json.loads((here / "config.json").read_text())
    if os.environ.get("MODE") == "list": list_accounts(cfg); return
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
        a = cfg["accounts"][acc]; token = token_of(acc)
        if not token: print(f"[{acc}] トークンが未登録なので飛ばします"); continue
        if not force and any(p[0] == acc and p[2] == str(today) for p in posted):
            print(f"[{acc}] 今日はもう投稿済みです"); continue
        done = {p[1] for p in posted if p[0] == acc}
        todo = [d for d in a["queue"] if d not in done]
        if not todo: print(f"[{acc}] 投稿する料理がもうありません（queue に追加してください）"); continue
        dish = todo[0]
        n = len(sorted((here / "images" / dish).glob("*.jpg")))
        try:
            ig_id = a.get("ig_user_id") or whoami(token)["user_id"]
            url = post_one(token, ig_id, dish, caps[dish], n)
        except Exception as e:
            print(f"[{acc}] {dish} の投稿に失敗：{e}"); failed = True; continue
        line = f"{acc} {dish} {today} {datetime.now(JST).strftime('%H:%M')} {url}"
        with posted_file.open("a") as f: f.write(line + "\n")
        posted.append(line.split())
        print(f"[{acc}] 投稿しました：{line}")
    if failed: sys.exit(1)

if __name__ == "__main__":
    main()
