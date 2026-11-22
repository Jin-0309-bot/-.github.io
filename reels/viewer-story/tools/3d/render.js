const PORT = 8765 + ((process.argv[2]||'').includes('kuro')?1:0);
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = __dirname; const NAME = process.argv[2];
const srv = http.createServer((q, s) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); 
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  const ct = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/json';
  s.writeHead(200, {'Content-Type': ct}); fs.createReadStream(f).pipe(s); }).listen(PORT);
(async () => {
  const T = JSON.parse(fs.readFileSync(path.join(dir,NAME,'timeline.json'))).T, FPS = 30;
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('http://127.0.0.1:'+PORT+'/scene.html?n='+NAME); await p.waitForFunction('window.READY===true', null, {timeout: 60000});
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','20',path.join(dir,NAME,'video.mp4')]);
  const n = Math.round(T * FPS), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => window.renderAt(t), i / FPS);
    ff.stdin.write(await p.screenshot({ type: 'jpeg', quality: 92 }));
    if (i % 60 == 0) console.log(i, '/', n, ((Date.now()-t0)/1000).toFixed(0)+'s');
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); srv.close();
})();
