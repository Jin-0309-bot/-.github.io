// 表紙（完成品の3D）をまとめて書き出す。ブラウザは1回だけ起動する。
// 使い方：node thumbs.js work/<料理ID> work/<料理ID> ...   （このフォルダで実行。three は node_modules に）
// 出力：work/<料理ID>/thumb.png（1080x1920）
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = __dirname, PORT = +(process.env.PORT || 8870);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, s) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(PORT);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const n of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    p.on('pageerror', e => console.log('err', n, e.message));
    await p.goto(`http://127.0.0.1:${PORT}/kitchen.html?n=${n}&thumb=1`);
    await p.waitForFunction('window.READY===true', null, { timeout: 60000 });
    await p.evaluate(() => window.renderAt(3.2));
    await p.screenshot({ path: path.join(dir, n, 'thumb.png') });
    await p.close(); console.log('ok', n);
  }
  await b.close(); srv.close();
})();
