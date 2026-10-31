/* グラフ：データの解釈・SVG描画・移動/サイズ変更 */
(function () {
'use strict';
const App = window.App, E = window.SheetEngine;
const esc = App.esc;
const PALETTES = {
  colorful: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E', '#636363', '#997300'],
  colorful2: ['#5B9BD5', '#A5A5A5', '#4472C4', '#264478', '#7CAFDD', '#ED7D31'],
  blue: ['#4472C4', '#2F5597', '#8FAADC', '#203864', '#B4C7E7', '#5B9BD5'],
  orange: ['#ED7D31', '#C55A11', '#F4B183', '#843C0C', '#F8CBAD', '#FFC000'],
  green: ['#70AD47', '#548235', '#A9D18E', '#385723', '#C5E0B4', '#92D050'],
  gray: ['#595959', '#7F7F7F', '#A5A5A5', '#262626', '#BFBFBF', '#404040'],
};
App.CHART_PALETTES = PALETTES;
const TYPES = { col: '集合縦棒', colStack: '積み上げ縦棒', bar: '集合横棒', barStack: '積み上げ横棒', line: '折れ線', lineM: 'マーカー付き折れ線', area: '面', pie: '円', doughnut: 'ドーナツ' };
App.CHART_TYPES = TYPES;

function chartData(ch) {
  const R = App.parseRef(ch.ref); if (!R) return null;
  const si = App.book().cur;
  const M = [], D = [];
  for (let r = R.r0; r <= R.r1; r++) {
    if (App.isRowHidden(r)) continue;
    const row = [], drow = [];
    for (let c = R.c0; c <= R.c1; c++) { row.push(App.val(si, r, c)); drow.push(App.displayText(si, r, c)); }
    M.push(row); D.push(drow);
  }
  if (!M.length) return null;
  const h = M.length, w = M[0].length;
  const textish = v => v == null || typeof v === 'string';
  const colTextBelow = j => h > 1 && M.slice(1).every(r => textish(r[j])) && M.slice(1).some(r => typeof r[j] === 'string');
  const hasCat = w > 1 && (colTextBelow(0) || (M[0][0] == null && h > 1));
  const head = M[0].slice(hasCat ? 1 : 0);
  const hasHead = h > 1 && head.some(v => typeof v === 'string') && !head.some(v => typeof v === 'number');
  const rows = M.slice(hasHead ? 1 : 0), drows = D.slice(hasHead ? 1 : 0);
  const c0 = hasCat ? 1 : 0;
  const num = v => typeof v === 'number' ? v : null;
  let byRow = rows.length < (w - c0);
  if (ch.swap) byRow = !byRow;
  let cats, series;
  if (!byRow) {
    cats = rows.map((r, i) => hasCat ? drows[i][0] : String(i + 1));
    series = [];
    for (let j = c0; j < w; j++) series.push({ name: hasHead ? D[0][j] : `系列${j - c0 + 1}`, values: rows.map(r => num(r[j])) });
  } else {
    cats = []; for (let j = c0; j < w; j++) cats.push(hasHead ? D[0][j] : String(j - c0 + 1));
    series = rows.map((r, i) => ({ name: hasCat ? drows[i][0] : `系列${i + 1}`, values: r.slice(c0).map(num) }));
  }
  return { cats, series };
}

function nice(lo, hi, n) {
  if (lo === hi) { if (lo === 0) hi = 1; else if (lo > 0) lo = 0; else hi = 0; }
  const span = hi - lo, raw = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const st = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { a: Math.floor(lo / st + 1e-9) * st, b: Math.ceil(hi / st - 1e-9) * st, st };
}
const fmtAxis = v => { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + 'M' : Number(v.toPrecision(10)).toLocaleString('ja-JP', { maximumFractionDigits: 4 }); };
const textW = (s, px) => { let w = 0; for (const ch of String(s)) w += /[\x00-\xff]/.test(ch) ? px * .58 : px; return w; };

function drawChart(ch, W, H, Z) {
  const data = chartData(ch);
  const F = 'font-family="Yu Gothic UI,Meiryo,Hiragino Sans,sans-serif" fill="#595959"';
  const fs = 9.5 * Z, tfs = 14 * Z;
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  if (!data || !data.series.length) return svg + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="${fs}" ${F}>データがありません</text></svg>`;
  const pal = PALETTES[ch.pal || 'colorful'];
  const pie = ch.type === 'pie' || ch.type === 'doughnut';
  const title = ch.title === false ? null : (ch.title || (data.series.length === 1 ? data.series[0].name : 'グラフ タイトル'));
  let top = 8 * Z;
  if (title) { svg += `<text x="${W / 2}" y="${top + tfs}" text-anchor="middle" font-size="${tfs}" ${F} class="ctitle" style="cursor:text">${esc(title)}</text>`; top += tfs + 12 * Z; }
  const legendItems = pie ? data.cats : data.series.map(s => s.name);
  const showLegend = ch.legend !== false && (pie || data.series.length > 1 || ch.legend === true);
  let bottom = H - 8 * Z;
  if (showLegend) {
    const ly = bottom - 4 * Z;
    const items = legendItems.map((n, i) => ({ n: String(n), w: 14 * Z + textW(n, fs) + 12 * Z, c: pal[i % pal.length] }));
    const total = items.reduce((a, b) => a + b.w, 0);
    let x = Math.max(6, (W - total) / 2);
    for (const it of items) {
      if (x + it.w > W) break;
      const isLine = ch.type === 'line' || ch.type === 'lineM';
      svg += isLine ? `<path d="M${x} ${ly - fs * .35}h${10 * Z}" stroke="${it.c}" stroke-width="${2 * Z}"/>` : `<rect x="${x}" y="${ly - fs * .75}" width="${7 * Z}" height="${7 * Z}" fill="${it.c}"/>`;
      svg += `<text x="${x + 13 * Z}" y="${ly}" font-size="${fs}" ${F}>${esc(it.n)}</text>`;
      x += it.w;
    }
    bottom = ly - fs - 8 * Z;
  }
  if (pie) {
    const s = data.series[0], vals = s.values.map(v => v > 0 ? v : 0), tot = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = (top + bottom) / 2, rad = Math.max(10, Math.min(W / 2 - 12, (bottom - top) / 2 - 4));
    let ang = -Math.PI / 2;
    vals.forEach((v, i) => {
      if (!v) return;
      const a2 = ang + v / tot * Math.PI * 2, large = a2 - ang > Math.PI ? 1 : 0;
      const p = (a, r) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
      const col = pal[i % pal.length];
      if (v === tot) svg += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${col}"/>`;
      else svg += `<path d="M${cx} ${cy}L${p(ang, rad)}A${rad} ${rad} 0 ${large} 1 ${p(a2, rad)}Z" fill="${col}" stroke="#fff" stroke-width="${1.5 * Z}"/>`;
      if (ch.labels) { const mid = (ang + a2) / 2, lr = ch.type === 'doughnut' ? rad * .78 : rad * .62; svg += `<text x="${cx + lr * Math.cos(mid)}" y="${cy + lr * Math.sin(mid) + fs / 3}" text-anchor="middle" font-size="${fs}" font-family="Yu Gothic UI,Meiryo,sans-serif" fill="#fff">${Math.round(v / tot * 100)}%</text>`; }
      ang = a2;
    });
    if (ch.type === 'doughnut') svg += `<circle cx="${cx}" cy="${cy}" r="${rad * .5}" fill="#fff"/>`;
    return svg + '</svg>';
  }
  const horiz = ch.type === 'bar' || ch.type === 'barStack';
  const stacked = ch.type === 'colStack' || ch.type === 'barStack';
  const nC = data.cats.length, nS = data.series.length;
  let lo = 0, hi = 0;
  if (stacked) for (let i = 0; i < nC; i++) { let p = 0, n = 0; for (const s of data.series) { const v = s.values[i] || 0; if (v > 0) p += v; else n += v; } hi = Math.max(hi, p); lo = Math.min(lo, n); }
  else for (const s of data.series) for (const v of s.values) if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); }
  if (ch.type === 'line' || ch.type === 'lineM') { const all = data.series.flatMap(s => s.values).filter(v => v != null); if (all.length) { lo = Math.min(0, ...all); hi = Math.max(...all); } }
  const sc = nice(lo, hi, horiz ? 4 : 5);
  const ticks = []; for (let v = sc.a; v <= sc.b + sc.st / 2; v += sc.st) ticks.push(Number(v.toPrecision(12)));
  const vLabW = Math.max(...ticks.map(t => textW(fmtAxis(t), fs))) + 8 * Z;
  const cLabW = Math.max(...data.cats.map(c => textW(c, fs))) + 8 * Z;
  let x0, x1, y0, y1;
  if (!horiz) { x0 = 8 * Z + vLabW; x1 = W - 12 * Z; y0 = top + 4 * Z; y1 = bottom - fs - 8 * Z; }
  else { x0 = 8 * Z + Math.min(cLabW, W * .35); x1 = W - 14 * Z; y0 = top + 4 * Z; y1 = bottom - fs - 8 * Z; }
  if (x1 - x0 < 20 || y1 - y0 < 20) return svg + '</svg>';
  const vpos = horiz ? v => x0 + (v - sc.a) / (sc.b - sc.a) * (x1 - x0) : v => y1 - (v - sc.a) / (sc.b - sc.a) * (y1 - y0);
  for (const t of ticks) {
    const p = vpos(t);
    if (!horiz) { svg += `<path d="M${x0} ${p}H${x1}" stroke="#d9d9d9" stroke-width="${Z}"/><text x="${x0 - 5 * Z}" y="${p + fs / 3}" text-anchor="end" font-size="${fs}" ${F}>${fmtAxis(t)}</text>`; }
    else { svg += `<path d="M${p} ${y0}V${y1}" stroke="#d9d9d9" stroke-width="${Z}"/><text x="${p}" y="${y1 + fs + 4 * Z}" text-anchor="middle" font-size="${fs}" ${F}>${fmtAxis(t)}</text>`; }
  }
  const base = vpos(Math.max(sc.a, Math.min(0, sc.b)));
  svg += !horiz ? `<path d="M${x0} ${base}H${x1}" stroke="#bfbfbf" stroke-width="${Z}"/>` : `<path d="M${base} ${y0}V${y1}" stroke="#bfbfbf" stroke-width="${Z}"/>`;
  const span = horiz ? (y1 - y0) : (x1 - x0), gw = span / nC;
  const every = Math.max(1, Math.ceil(nC / Math.max(1, Math.floor(span / (horiz ? fs * 1.6 : Math.min(cLabW, 70 * Z))))));
  data.cats.forEach((c, i) => {
    if (i % every) return;
    if (!horiz) { const cx = x0 + gw * (i + .5); svg += `<text x="${cx}" y="${y1 + fs + 4 * Z}" text-anchor="middle" font-size="${fs}" ${F}>${esc(c)}</text>`; }
    else { const cy = y1 - gw * (i + .5); svg += `<text x="${x0 - 5 * Z}" y="${cy + fs / 3}" text-anchor="end" font-size="${fs}" ${F}>${esc(c)}</text>`; }
  });
  const lab = (x, y, v, anchor) => ch.labels && v != null ? `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}" font-size="${fs}" ${F}>${esc(fmtAxis(v))}</text>` : '';
  if (ch.type === 'line' || ch.type === 'lineM' || ch.type === 'area') {
    data.series.forEach((s, si) => {
      const col = pal[si % pal.length];
      const pts = s.values.map((v, i) => v == null ? null : [x0 + gw * (i + .5), vpos(v)]);
      if (ch.type === 'area') {
        const ok = pts.map((p, i) => p || [x0 + gw * (i + .5), base]);
        svg += `<path d="M${ok[0][0]} ${base}L${ok.map(p => p.join(' ')).join('L')}L${ok[ok.length - 1][0]} ${base}Z" fill="${col}" fill-opacity=".85"/>`;
      } else {
        let d = '', pen = false;
        pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p.join(' '); pen = true; });
        svg += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${2.25 * Z}" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (ch.type === 'lineM') pts.forEach(p => { if (p) svg += `<circle cx="${p[0]}" cy="${p[1]}" r="${3.2 * Z}" fill="${col}" stroke="#fff" stroke-width="${Z}"/>`; });
      }
      pts.forEach((p, i) => { if (p) svg += lab(p[0], p[1] - 6 * Z, s.values[i]); });
    });
    return svg + '</svg>';
  }
  const inner = gw * (stacked ? .6 : Math.min(.8, .32 + .12 * nS)), bw = stacked ? inner : inner / nS;
  const pos = new Array(nC).fill(0), neg = new Array(nC).fill(0);
  data.series.forEach((s, si) => {
    const col = pal[si % pal.length];
    s.values.forEach((v, i) => {
      if (v == null) return;
      let from = 0, to = v;
      if (stacked) { if (v >= 0) { from = pos[i]; pos[i] += v; to = pos[i]; } else { from = neg[i]; neg[i] += v; to = neg[i]; } }
      const a = vpos(from), b = vpos(to);
      const off = (gw - inner) / 2 + (stacked ? 0 : si * bw);
      if (!horiz) {
        const x = x0 + gw * i + off;
        svg += `<rect x="${x}" y="${Math.min(a, b)}" width="${Math.max(1, bw - (nS > 1 && !stacked ? Z : 0))}" height="${Math.abs(b - a)}" fill="${col}"/>`;
        svg += lab(x + bw / 2, (stacked ? (a + b) / 2 + fs / 3 : Math.min(a, b) - 4 * Z), v);
      } else {
        const y = y1 - gw * (i + 1) + off;
        svg += `<rect x="${Math.min(a, b)}" y="${y}" width="${Math.abs(b - a)}" height="${Math.max(1, bw - (nS > 1 && !stacked ? Z : 0))}" fill="${col}"/>`;
        svg += lab(Math.max(a, b) + 4 * Z, y + bw / 2 + fs / 3, v, 'start');
      }
    });
  });
  return svg + '</svg>';
}
App.drawChart = drawChart;

const objs = document.getElementById('objs');
App.chartSel = null;
App.renderCharts = () => {
  const sh = App.sheet(), Z = App.zoom();
  objs.innerHTML = '';
  sh.charts.forEach((ch, i) => {
    const d = document.createElement('div');
    d.className = 'chart' + (App.chartSel === i ? ' sel' : '');
    d.dataset.i = i;
    const W = Math.round(ch.w * Z), H = Math.round(ch.h * Z);
    Object.assign(d.style, { left: Math.round(ch.x * Z) + 'px', top: Math.round(ch.y * Z) + 'px', width: W + 'px', height: H + 'px' });
    d.innerHTML = drawChart(ch, W, H, Z) + '<i class="hd tl"></i><i class="hd tr"></i><i class="hd bl"></i><i class="hd br" data-h="br"></i><i class="hd r" data-h="r"></i><i class="hd b" data-h="b"></i>';
    objs.appendChild(d);
  });
  document.getElementById('chartTab').classList.toggle('hidden', App.chartSel == null);
  if (App.chartSel == null && App.curTab === 'chart') App.showTab && App.showTab('home');
};

let cdrag = null;
objs.addEventListener('mousedown', e => {
  const el = e.target.closest('.chart'); if (!el) return;
  e.preventDefault(); e.stopPropagation();
  App.hideMenus && App.hideMenus();
  if (App.isEditing()) App.commitEdit(0, 0);
  const i = +el.dataset.i, ch = App.sheet().charts[i];
  const was = App.chartSel;
  App.chartSel = i;
  if (was !== i) { App.paintSel(); App.renderCharts(); App.showTab && App.showTab('chart'); App.updateSel(); }
  App.editor.focus({ preventScroll: true });
  if (e.button !== 0) return;
  const hd = e.target.dataset && e.target.dataset.h;
  cdrag = { i, h: hd || null, x: e.clientX, y: e.clientY, o: { x: ch.x, y: ch.y, w: ch.w, h: ch.h }, moved: false };
});
document.addEventListener('mousemove', e => {
  if (!cdrag) return;
  const Z = App.zoom(), ch = App.sheet().charts[cdrag.i]; if (!ch) return;
  const dx = (e.clientX - cdrag.x) / Z, dy = (e.clientY - cdrag.y) / Z;
  if (Math.abs(dx) + Math.abs(dy) > 2) cdrag.moved = true;
  const o = cdrag.o;
  if (!cdrag.h) { ch.x = Math.max(0, Math.round(o.x + dx)); ch.y = Math.max(0, Math.round(o.y + dy)); }
  else { if (cdrag.h !== 'b') ch.w = Math.max(120, Math.round(o.w + dx)); if (cdrag.h !== 'r') ch.h = Math.max(90, Math.round(o.h + dy)); }
  const el = objs.children[cdrag.i];
  if (el) {
    if (!cdrag.h) { el.style.left = ch.x * Z + 'px'; el.style.top = ch.y * Z + 'px'; }
    else App.renderCharts();
  }
});
document.addEventListener('mouseup', () => {
  if (!cdrag) return;
  const d = cdrag; cdrag = null;
  if (!d.moved) return;
  const ch = App.sheet().charts[d.i], fin = { x: ch.x, y: ch.y, w: ch.w, h: ch.h };
  Object.assign(ch, d.o);
  App.commit(() => { Object.assign(App.sheet().charts[d.i], fin); }, { any: true });
});
objs.addEventListener('dblclick', e => {
  const el = e.target.closest('.chart'); if (!el) return;
  const ch = App.sheet().charts[+el.dataset.i];
  if (e.target.classList.contains('ctitle') || e.target.closest('.ctitle')) {
    App.prompt('グラフ タイトル', ch.title || '', v => App.commit(() => { ch.title = v; }, { any: true }));
  }
});
objs.addEventListener('contextmenu', e => {
  const el = e.target.closest('.chart'); if (!el) return;
  e.preventDefault();
  App.showChartMenu(e.clientX, e.clientY);
});

App.insertChart = type => {
  if (App.isEditing()) App.commitEdit(0, 0);
  let R = App.rect();
  if (App.isSingle(R)) {
    const a = App.getAct();
    if (!App.hasValue(App.sheet(), a.r, a.c)) { App.alert('グラフを作成するには、データを含むセル範囲を選択してから操作してください。'); return; }
    R = App.currentRegion(a);
  }
  const Z = App.zoom(), b = App.rangeRectPx(R);
  const wrap = App.wrap;
  let x = (b.x + b.w) / Z + 24, y = b.y / Z;
  if ((b.x + b.w + 24 + 480 * Z) > wrap.scrollLeft + wrap.clientWidth) { x = (wrap.scrollLeft + Math.max(60, (wrap.clientWidth - 480 * Z) / 2)) / Z; y = (wrap.scrollTop + 40) / Z; }
  App.commit(() => { App.sheet().charts.push({ type, ref: App.rangeName(R), x: Math.round(x), y: Math.round(y), w: 480, h: 288, title: null, legend: null, pal: 'colorful' }); });
  App.chartSel = App.sheet().charts.length - 1;
  App.paintSel(); App.renderCharts(); App.showTab && App.showTab('chart'); App.updateSel();
};
})();
