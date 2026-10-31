/* 表計算シート：グリッド・選択・入力・編集操作 */
(function () {
'use strict';
const E = window.SheetEngine;
const { keyOf, parseKey, colName, colIdx, isErr, isFormula, toHalf } = E;
const ROWS = 500, COLS = 52, DEFW = 72, DEFH = 24, RHW = 40, CHH = 20;
const App = window.App = { ROWS, COLS, DEFW, DEFH, E };
const $ = id => document.getElementById(id);
const touch = matchMedia('(pointer:coarse)').matches;
App.touch = touch;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
App.esc = esc;

/* ================= フォント ================= */
const FONTS = {
  '游ゴシック': '"Yu Gothic","游ゴシック",YuGothic,"Hiragino Sans","Meiryo",sans-serif',
  '游明朝': '"Yu Mincho","游明朝",YuMincho,"Hiragino Mincho ProN",serif',
  'メイリオ': 'Meiryo,"メイリオ","Hiragino Sans",sans-serif',
  'ＭＳ Ｐゴシック': '"MS PGothic","ＭＳ Ｐゴシック","Hiragino Sans",sans-serif',
  'ＭＳ ゴシック': '"MS Gothic","ＭＳ ゴシック",Osaka-mono,monospace',
  'ＭＳ 明朝': '"MS Mincho","ＭＳ 明朝","Hiragino Mincho ProN",serif',
  'BIZ UDPゴシック': '"BIZ UDPGothic","Hiragino Sans",sans-serif',
  'Arial': 'Arial,Helvetica,sans-serif', 'Calibri': 'Calibri,Carlito,Arial,sans-serif',
  'Century': 'Century,"Century Schoolbook",serif', 'Courier New': '"Courier New",Courier,monospace',
  'Georgia': 'Georgia,serif', 'Segoe UI': '"Segoe UI",sans-serif', 'Times New Roman': '"Times New Roman",Times,serif', 'Verdana': 'Verdana,sans-serif',
};
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
Object.assign(App, { FONTS, SIZES });

/* ================= ブックとシート ================= */
function newSheet(name) {
  return { name, cells: {}, colW: {}, rowH: {}, merges: [], cf: [], charts: [], filter: null, freeze: null, hidR: [], hidC: [], tab: null, prot: false, grid: true, heads: true, zoom: 100, page: { orient: 'portrait', margin: 'normal', size: 'A4', grid: false, heads: false } };
}
function fixSheet(s) {
  const d = newSheet(s.name || 'Sheet');
  for (const k in d) if (s[k] === undefined) s[k] = d[k];
  s.page = Object.assign(d.page, s.page || {});
  return s;
}
function newBook(name) { return { name: name || 'Book1', sheets: [newSheet('Sheet1')], cur: 0, view: { fbar: true, showF: false, notes: false }, recentFns: ['SUM', 'AVERAGE', 'IF', 'COUNTIF', 'VLOOKUP'] }; }
let book = null;
App.book = () => book;
const sheet = () => book.sheets[book.cur];
App.sheet = sheet;
App.newSheet = newSheet; App.newBook = newBook; App.fixSheet = fixSheet;
const sheetIdx = name => book.sheets.findIndex(s => s.name.toLowerCase() === String(name).toLowerCase());
App.sheetIdx = sheetIdx;
const zoom = () => (sheet().zoom || 100) / 100;
App.zoom = zoom;

/* ================= 保存 ================= */
const IDX_KEY = 'hyokeisan-index-v2', BOOK_KEY = id => 'hyokeisan-book-' + id;
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 無視 */ } }
function readIndex() { try { const x = JSON.parse(lsGet(IDX_KEY)); if (x && x.list) return x; } catch (e) { /* 無視 */ } return { current: null, list: {} }; }
let bookId = null, dirty = false, autosave = true, saveTimer = 0;
App.bookId = () => bookId;
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function saveNow() {
  const idx = readIndex();
  idx.current = bookId;
  idx.list[bookId] = { name: book.name, updated: Date.now() };
  const ok = lsSet(BOOK_KEY(bookId), JSON.stringify(book)) && lsSet(IDX_KEY, JSON.stringify(idx));
  dirty = !ok;
  updateTitle(ok ? null : '保存できません');
  return ok;
}
App.saveNow = saveNow;
function markDirty() {
  dirty = true;
  if (autosave) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
  updateTitle();
}
function updateTitle(msg) {
  $('docTitle').textContent = `${book.name} - ${msg || (dirty ? (autosave ? '保存中…' : '未保存') : '保存済み')}`;
}
App.updateTitle = updateTitle;
App.setAutosave = on => { autosave = on; $('autosaveBtn').classList.toggle('on', on); if (on && dirty) saveNow(); updateTitle(); lsSet('hyokeisan-autosave', on ? '1' : '0'); };
App.listBooks = () => { const idx = readIndex(); return Object.entries(idx.list).map(([id, x]) => ({ id, ...x })).sort((a, b) => b.updated - a.updated); };
App.deleteBook = id => { const idx = readIndex(); delete idx.list[id]; lsDel(BOOK_KEY(id)); lsSet(IDX_KEY, JSON.stringify(idx)); };
function loadBookData(data, id) {
  book = data;
  if (!Array.isArray(book.sheets) || !book.sheets.length) book = newBook();
  book.sheets.forEach(fixSheet);
  book.view = Object.assign({ fbar: true, showF: false, notes: false }, book.view || {});
  book.recentFns = book.recentFns || [];
  book.cur = Math.min(Math.max(0, book.cur | 0), book.sheets.length - 1);
  bookId = id || uid();
  undoS.length = 0; redoS.length = 0; clip = null;
  act = { r: 0, c: 0 }; ext = { r: 0, c: 0 };
  App.chartSel = null;
}
App.openBook = (data, id) => {
  if (editing) cancelEdit();
  if (bookId && dirty) saveNow();
  loadBookData(data, id);
  if (!id) saveNow();
  wrap.scrollTop = 0; wrap.scrollLeft = 0;
  afterChange(true); focusNav();
};
App.openStoredBook = id => { try { const d = JSON.parse(lsGet(BOOK_KEY(id))); if (d) { App.openBook(d, id); saveNow(); return true; } } catch (e) { /* 無視 */ } return false; };
function migrateV1() {
  try {
    const s = JSON.parse(lsGet('hyokeisan-v1'));
    if (!s || !Array.isArray(s.sheets)) return null;
    const b = newBook('Book1');
    b.sheets = s.sheets.map(x => {
      const sh = newSheet(x.name || 'Sheet1');
      for (const [k, c] of Object.entries(x.cells || {})) {
        const n = { ...c };
        if (n.fmt === 'num') n.fmt = 'comma'; else if (n.fmt === 'yen') n.fmt = 'currency';
        if (n.i === true) n.i = true;
        sh.cells[k] = n;
      }
      sh.colW = x.colW || {};
      return sh;
    });
    b.cur = s.cur | 0;
    return b;
  } catch (e) { return null; }
}

/* ================= 計算エンジン ================= */
const hidCache = new Map();
const engine = E.createEngine({
  ROWS, COLS,
  cell: (si, r, c) => book.sheets[si] && book.sheets[si].cells[keyOf(r, c)],
  sheetIndex: sheetIdx,
  rowHidden: (si, r) => rowHiddenSet(si).has(r),
});
App.engine = engine;
const val = (si, r, c) => engine.getValue(si, r, c);
App.val = val;
function autoFmt(cell) {
  if (!cell || cell.fmt || !isFormula(cell.v)) return cell;
  const m = /^=\s*([A-Z.]+)\s*\(/i.exec(cell.v);
  if (!m) return cell;
  const f = m[1].toUpperCase();
  if (['TODAY', 'DATE', 'EDATE', 'EOMONTH'].includes(f)) return { ...cell, fmt: 'date' };
  if (f === 'NOW') return { ...cell, fmt: 'datetime' };
  if (f === 'TIME') return { ...cell, fmt: 'time' };
  return cell;
}
App.autoFmt = autoFmt;
function displayText(si, r, c) {
  const cell = book.sheets[si].cells[keyOf(r, c)];
  if (!cell) return '';
  return E.formatValue(val(si, r, c), autoFmt(cell));
}
App.displayText = displayText;

/* ================= フィルター・非表示行 ================= */
function hasValue(sh, r, c) { const x = sh.cells[keyOf(r, c)]; return !!(x && x.v != null && x.v !== ''); }
App.hasValue = hasValue;
function filterRange(sh) {
  const f = sh.filter; if (!f) return null;
  let end = f.r0;
  for (let r = f.r0 + 1; r < ROWS; r++) {
    let any = false;
    for (let c = f.c0; c <= f.c1; c++) if (hasValue(sh, r, c)) { any = true; break; }
    if (!any) break;
    end = r;
  }
  return { r0: f.r0, r1: Math.max(end, f.r1 || f.r0), c0: f.c0, c1: f.c1 };
}
App.filterRange = filterRange;
function rowHiddenSet(si) {
  if (hidCache.has(si)) return hidCache.get(si);
  const sh = book.sheets[si], set = new Set(sh.hidR);
  hidCache.set(si, set);
  const F = filterRange(sh);
  if (F && sh.filter.crit) {
    const crit = Object.entries(sh.filter.crit).filter(([, v]) => v && v.length).map(([c, v]) => [+c, new Set(v)]);
    if (crit.length) for (let r = F.r0 + 1; r <= F.r1; r++) for (const [c, hide] of crit) if (hide.has(displayText(si, r, c))) { set.add(r); break; }
  }
  return set;
}
App.rowHiddenSet = rowHiddenSet;
const isRowHidden = r => rowHiddenSet(book.cur).has(r);
const isColHidden = c => sheet().hidC.includes(c);
App.isRowHidden = isRowHidden; App.isColHidden = isColHidden;

/* ================= グリッドの構築 ================= */
const wrap = $('wrap'), table = $('grid'), editor = $('editor'), fbar = $('fbar'), nameBox = $('nameBox');
const tds = [], trs = [], colHeads = [], rowHeads = [], cols = [];
App.tds = tds; App.wrap = wrap;
const zstyle = document.createElement('style'); document.head.appendChild(zstyle);
function build() {
  let h = '<colgroup><col>' + '<col>'.repeat(COLS) + '</colgroup><thead><tr><th class="corner" title="すべて選択"></th>';
  for (let c = 0; c < COLS; c++) h += `<th class="ch">${colName(c)}<div class="rz"></div></th>`;
  h += '</tr></thead><tbody>';
  const row = '<td></td>'.repeat(COLS);
  for (let r = 0; r < ROWS; r++) h += `<tr><th class="rh">${r + 1}<div class="rzr"></div></th>${row}</tr>`;
  table.innerHTML = h + '</tbody>';
  cols.push(...table.querySelectorAll('col'));
  colHeads.push(...table.querySelectorAll('th.ch'));
  [...table.tBodies[0].rows].forEach(tr => { trs.push(tr); rowHeads.push(tr.cells[0]); tds.push([...tr.cells].slice(1)); });
}
const colW = c => isColHidden(c) ? 0 : Math.round((sheet().colW[c] || DEFW) * zoom());
const rowH = r => Math.round((sheet().rowH[r] || DEFH) * zoom());
App.colW = colW; App.rowH = rowH;
function applySizes() {
  const Z = zoom(), sh = sheet();
  const rhw = Math.round(RHW * Z);
  cols[0].style.width = rhw + 'px';
  let total = rhw;
  for (let c = 0; c < COLS; c++) { const w = colW(c); cols[c + 1].style.width = w + 'px'; total += w; colHeads[c].classList.toggle('hc', w === 0); }
  table.style.width = total + 'px';
  table.tHead.rows[0].style.height = Math.round(CHH * Z) + 'px';
  for (let r = 0; r < ROWS; r++) { const h = rowH(r) + 'px'; if (trs[r]._hh !== h) { trs[r].style.height = h; trs[r]._hh = h; } }
  zstyle.textContent = `#grid{font-size:${11 * Z}pt}#grid th{font-size:${Math.max(7, 11 * Z)}px}#grid .fbtn{transform:scale(${Math.min(1, Math.max(.6, Z))});transform-origin:100% 100%}`;
  table.classList.toggle('nogrid', !sh.grid);
  table.classList.toggle('nohead', !sh.heads);
}

/* ================= 条件付き書式 ================= */
const CF_PRESETS = {
  lr: { bg: '#FFC7CE', fc: '#9C0006', label: '濃い赤の文字、明るい赤の背景' },
  ly: { bg: '#FFEB9C', fc: '#9C5700', label: '濃い黄色の文字、黄色の背景' },
  lg: { bg: '#C6EFCE', fc: '#006100', label: '濃い緑の文字、緑の背景' },
  lrf: { bg: '#FFC7CE', label: '明るい赤の背景' },
  rt: { fc: '#9C0006', label: '赤の文字' },
  b: { b: true, label: '太字' },
};
App.CF_PRESETS = CF_PRESETS;
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = a => '#' + a.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgb2hex(hex2rgb(a).map((x, i) => x + (hex2rgb(b)[i] - x) * t));
App.mix = mix;
function cfOperand(a, si) {
  if (a == null) return null;
  if (typeof a === 'string' && a[0] === '=') return engine.evaluateExpr(a.slice(1), si);
  return E.parseLiteral(String(a));
}
function computeCF(sh, si) {
  if (!sh.cf || !sh.cf.length) return null;
  const out = new Map();
  const put = (idx, st) => { const cur = out.get(idx); out.set(idx, cur ? Object.assign({}, st, cur) : { ...st }); };
  for (const rule of sh.cf) {
    const r1 = Math.min(rule.r1, ROWS - 1), c1 = Math.min(rule.c1, COLS - 1);
    const cells = [];
    for (let r = rule.r0; r <= r1; r++) for (let c = rule.c0; c <= c1; c++) cells.push([r, c, val(si, r, c)]);
    const nums = cells.map(x => x[2]).filter(v => typeof v === 'number');
    const st = CF_PRESETS[rule.st] || CF_PRESETS.lr;
    let test = null;
    if (rule.t === 'cell') {
      const A = cfOperand(rule.a, si), B = cfOperand(rule.b, si);
      const cmp = (v, x) => E.compareVals(v, x);
      switch (rule.op) {
        case 'gt': test = v => v != null && cmp(v, A) > 0; break;
        case 'lt': test = v => v != null && cmp(v, A) < 0; break;
        case 'ge': test = v => v != null && cmp(v, A) >= 0; break;
        case 'le': test = v => v != null && cmp(v, A) <= 0; break;
        case 'eq': test = v => v != null && cmp(v, A) === 0; break;
        case 'ne': test = v => cmp(v, A) !== 0; break;
        case 'between': test = v => v != null && cmp(v, A) >= 0 && cmp(v, B) <= 0; break;
        case 'text': { const t = String(A ?? '').toLowerCase(); test = v => v != null && E.toStr(v).toLowerCase().includes(t); break; }
        case 'dup': case 'uniq': {
          const cnt = new Map(); cells.forEach(([, , v]) => { if (v == null || v === '') return; const k = E.toStr(v).toLowerCase(); cnt.set(k, (cnt.get(k) || 0) + 1); });
          test = v => v != null && v !== '' && (rule.op === 'dup' ? cnt.get(E.toStr(v).toLowerCase()) > 1 : cnt.get(E.toStr(v).toLowerCase()) === 1);
          break;
        }
      }
    } else if (rule.t === 'top') {
      const s = [...nums].sort((a, b) => rule.bottom ? a - b : b - a);
      const n = rule.pct ? Math.max(1, Math.floor(s.length * rule.n / 100)) : Math.min(rule.n, s.length);
      const thr = s[n - 1];
      if (s.length) test = v => typeof v === 'number' && (rule.bottom ? v <= thr : v >= thr);
    } else if (rule.t === 'avg') {
      const m = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
      test = v => typeof v === 'number' && (rule.above ? v > m : v < m);
    } else if (rule.t === 'bar') {
      if (!nums.length) continue;
      const lo = Math.min(0, ...nums), hi = Math.max(...nums), span = hi - lo || 1;
      for (const [r, c, v] of cells) if (typeof v === 'number') put(r * COLS + c, { bar: rule.color, pct: Math.max(0, Math.min(100, (v - lo) / span * 100)) });
      continue;
    } else if (rule.t === 'scale') {
      if (!nums.length) continue;
      const s = [...nums].sort((a, b) => a - b), lo = s[0], hi = s[s.length - 1];
      const mid = s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
      const cs = rule.colors;
      for (const [r, c, v] of cells) {
        if (typeof v !== 'number') continue;
        let bg;
        if (cs.length === 3) bg = v <= mid ? mix(cs[0], cs[1], mid === lo ? 1 : (v - lo) / (mid - lo)) : mix(cs[1], cs[2], hi === mid ? 0 : (v - mid) / (hi - mid));
        else bg = mix(cs[0], cs[1], hi === lo ? 0 : (v - lo) / (hi - lo));
        put(r * COLS + c, { bg });
      }
      continue;
    }
    if (test) for (const [r, c, v] of cells) if (test(v)) put(r * COLS + c, st);
  }
  return out;
}

/* ================= 描画 ================= */
const BW = { thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', medium: '2px solid', thick: '3px solid', double: '3px double' };
function borderCss(spec) { if (!spec) return null; const [st, col] = spec.split(' '); return `${BW[st] || '1px solid'} ${col || '#000'}`; }
App.borderCss = borderCss;
const fontCss = f => FONTS[f] || `"${String(f).replace(/["\\]/g, '')}",sans-serif`;
App.fontCss = fontCss;
let frz = null;
function render() {
  engine.clear(); hidCache.clear();
  const sh = sheet(), si = book.cur, Z = zoom();
  applySizes();
  const hidR = rowHiddenSet(si), hidC = new Set(sh.hidC);
  for (let r = 0; r < ROWS; r++) { const h = hidR.has(r); if (trs[r]._h !== h) { trs[r].style.display = h ? 'none' : ''; trs[r]._h = h; } }
  const anchors = new Map(), covered = new Set();
  for (const m of sh.merges) {
    anchors.set(m.r0 * COLS + m.c0, m);
    for (let r = m.r0; r <= m.r1; r++) for (let c = m.c0; c <= m.c1; c++) if (r !== m.r0 || c !== m.c0) covered.add(r * COLS + c);
  }
  const bmap = new Map();
  for (const [k, cell] of Object.entries(sh.cells)) {
    if (!cell.bd) continue;
    const p = parseKey(k); if (!p) continue;
    if (cell.bd.t && p.r > 0) { const i = (p.r - 1) * COLS + p.c; bmap.set(i, Object.assign(bmap.get(i) || {}, { b: cell.bd.t })); }
    if (cell.bd.l && p.c > 0) { const i = p.r * COLS + p.c - 1; bmap.set(i, Object.assign(bmap.get(i) || {}, { r: cell.bd.l })); }
  }
  const cfmap = computeCF(sh, si);
  const F = filterRange(sh);
  frz = sh.freeze && (sh.freeze.r || sh.freeze.c) ? sh.freeze : null;
  for (let r = 0; r < ROWS; r++) {
    if (hidR.has(r)) continue;
    const rowTds = tds[r];
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c, td = rowTds[c];
      if (covered.has(idx)) { if (!td._cov) { td.style.display = 'none'; td._cov = 1; } continue; }
      if (td._cov) { td._cov = 0; td.style.display = ''; td._d = 1; }
      const m = anchors.get(idx);
      if (m) { td.colSpan = m.c1 - m.c0 + 1; td.rowSpan = m.r1 - m.r0 + 1; td._m = 1; }
      else if (td._m) { td.colSpan = 1; td.rowSpan = 1; td._m = 0; }
      const cell = sh.cells[keyOf(r, c)], bx = bmap.get(idx), cf = cfmap && cfmap.get(idx);
      const fb = F && r === F.r0 && c >= F.c0 && c <= F.c1;
      const hc = hidC.has(c), fz = frz && (r < frz.r || c < frz.c);
      if (!cell && !bx && !cf && !fb && !hc && !fz && !td._d && !m) continue;
      paintCell(td, r, c, cell, bx, cf, fb, hc, fz, si, sh, m, covered, Z);
    }
  }
  applyFreeze();
  paintSel();
  App.renderCharts && App.renderCharts();
  renderNotes();
  placeDv();
}
function paintCell(td, r, c, cell, bx, cf, fb, hc, fz, si, sh, m, covered, Z) {
  const x = cell ? autoFmt(cell) : {};
  const hasV = cell && cell.v != null && cell.v !== '';
  const v = hasV ? val(si, r, c) : null;
  let text = '', al = 'l', acc = false;
  if (hasV && book.view.showF && isFormula(cell.v)) text = cell.v;
  else if (hasV) {
    text = E.formatValue(v, x);
    if (typeof v === 'number') { al = 'r'; acc = x.fmt === 'accounting'; }
    else if (typeof v === 'boolean' || isErr(v)) al = 'c';
  }
  const h = x.al || al;
  let css = '', cls = '';
  if (x.font) css += `font-family:${fontCss(x.font)};`;
  if (x.sz) css += `font-size:${x.sz * Z}pt;`;
  if (x.b || (cf && cf.b)) css += 'font-weight:700;';
  if (x.i) css += 'font-style:italic;';
  if (x.u || x.s) css += `text-decoration:${x.u ? 'underline' : ''} ${x.s ? 'line-through' : ''};${x.u === 'double' ? 'text-decoration-style:double;' : ''}`;
  const fc = (cf && cf.fc) || x.fc, bg = (cf && cf.bg) || x.bg;
  if (fc) css += `color:${fc};`;
  if (bg) css += `background-color:${bg};`;
  if (cf && cf.bar) {
    const lite = mix(cf.bar, '#ffffff', .75);
    css += `background-image:linear-gradient(90deg,${cf.bar} 0,${lite} ${cf.pct}%,transparent ${cf.pct}%);background-size:100% 78%;background-repeat:no-repeat;background-position:0 50%;`;
  }
  if (h === 'c') css += 'text-align:center;'; else if (h === 'r') css += 'text-align:right;'; else if (h === 'l' && x.al) css += 'text-align:left;';
  if (x.va === 't') css += 'vertical-align:top;'; else if (x.va === 'm') css += 'vertical-align:middle;';
  if (x.ind) css += `padding-${h === 'r' ? 'right' : 'left'}:${Math.round(3 + x.ind * 9 * Z)}px;`;
  const bd = cell && cell.bd || {};
  const bb = borderCss(bd.b || (bx && bx.b)), br = borderCss(bd.r || (bx && bx.r));
  if (bb) css += `border-bottom:${bb};`; else if (bg) css += `border-bottom-color:${bg};`;
  if (br) css += `border-right:${br};`; else if (bg) css += `border-right-color:${bg};`;
  if (bd.t && r === 0) css += `border-top:${borderCss(bd.t)};`;
  if (bd.l && c === 0) css += `border-left:${borderCss(bd.l)};`;
  if (x.wrap) cls += ' wr';
  if (hc) cls += ' hc';
  if (cell && cell.note) cls += ' note';
  if (isErr(v)) cls += ' err';
  if (fz) cls += ' frz';
  if (fb) css += 'position:relative;';
  let spillW = 0;
  if (typeof v === 'string' && text && !x.wrap && (h === 'l') && !m && !hc && !book.view.showF) {
    let w = colW(c), k = c + 1;
    while (k < COLS && w < 3000 && !hasValue(sh, r, k) && !covered.has(r * COLS + k) && !sh.merges.some(mm => mm.r0 <= r && mm.r1 >= r && mm.c0 === k)) { w += colW(k); k++; }
    if (k > c + 1) spillW = w - 7;
  }
  td.className = cls.trim();
  td.style.cssText = css;
  if (acc) { td.classList.add('acc'); td.innerHTML = `<span class="cur">¥</span>${esc(text.replace('¥', ''))}`; }
  else if (spillW) { td.classList.add('spill'); td.innerHTML = `<span class="sp" style="width:${spillW}px">${esc(text)}</span>`; }
  else td.textContent = text;
  if (fb) {
    const crit = sh.filter.crit && sh.filter.crit[c];
    const b = document.createElement('button');
    b.className = 'fbtn' + (crit && crit.length ? ' act' : '');
    b.dataset.fc = c;
    b.innerHTML = crit && crit.length ? window.ICONS.funnel : window.ICONS.ddArrow;
    b.title = crit && crit.length ? 'フィルターが適用されています' : '（すべて表示）';
    td.appendChild(b);
  }
  td._d = (cell || bx || cf || fb || hc || fz) ? 1 : 0;
}
let frzEls = [];
function applyFreeze() {
  for (const el of frzEls) {
    el.style.top = ''; el.style.left = ''; el.style.zIndex = '';
    if (el.tagName === 'TD') el.style.position = el.querySelector('.fbtn,#fh') ? 'relative' : '';
    el.classList.remove('frzb', 'frzr');
  }
  frzEls = [];
  const sh = sheet(), f = sh.freeze && (sh.freeze.r || sh.freeze.c) ? sh.freeze : null;
  if (!f) return;
  const Z = zoom(), headH = Math.round(CHH * Z) + 1, rhw = Math.round(RHW * Z) + 1;
  const tops = [], lefts = [];
  let top = headH; for (let r = 0; r < f.r; r++) { tops.push(top); if (!isRowHidden(r)) top += trs[r].offsetHeight; }
  let left = rhw; for (let c = 0; c < f.c; c++) { lefts.push(left); left += colW(c) ? tds[0][c].offsetWidth || colW(c) : 0; }
  for (let r = 0; r < ROWS; r++) {
    const inR = r < f.r;
    if (!inR && !f.c) break;
    const lim = inR ? COLS : f.c;
    for (let c = 0; c < lim; c++) {
      const td = tds[r][c];
      if (td._cov) continue;
      td.style.position = 'sticky';
      if (inR) td.style.top = tops[r] + 'px';
      if (c < f.c) td.style.left = lefts[c] + 'px';
      td.style.zIndex = inR && c < f.c ? 4 : 3;
      if (!td.classList.contains('frz')) td.classList.add('frz');
      if (inR && r === f.r - 1) td.classList.add('frzb');
      if (c === f.c - 1) td.classList.add('frzr');
      frzEls.push(td);
    }
    if (inR) { const th = rowHeads[r]; th.style.top = tops[r] + 'px'; th.style.zIndex = 6; if (r === f.r - 1) th.classList.add('frzb'); frzEls.push(th); }
  }
  for (let c = 0; c < f.c; c++) { const th = colHeads[c]; th.style.left = lefts[c] + 'px'; th.style.zIndex = 7; if (c === f.c - 1) th.classList.add('frzr'); frzEls.push(th); }
}

/* ================= シート見出し ================= */
function renderTabs() {
  const tabs = $('tabs'); tabs.innerHTML = '';
  book.sheets.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'stab' + (i === book.cur ? ' on' : '');
    b.dataset.i = i;
    b.innerHTML = esc(s.name) + (s.prot ? ' 🔒' : '') + (s.tab ? `<i class="tc" style="background:${s.tab}"></i>` : '');
    tabs.appendChild(b);
  });
  const on = tabs.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
App.renderTabs = renderTabs;

/* ================= 選択 ================= */
let act = { r: 0, c: 0 }, ext = { r: 0, c: 0 };
App.getAct = () => ({ ...act }); App.getExt = () => ({ ...ext });
const clampP = p => ({ r: Math.max(0, Math.min(ROWS - 1, p.r)), c: Math.max(0, Math.min(COLS - 1, p.c)) });
const mergeAt = (r, c) => sheet().merges.find(m => r >= m.r0 && r <= m.r1 && c >= m.c0 && c <= m.c1);
App.mergeAt = mergeAt;
const anchorOf = p => { const m = mergeAt(p.r, p.c); return m ? { r: m.r0, c: m.c0 } : p; };
function expandRect(R) {
  let changed = true;
  const ms = sheet().merges;
  while (changed) {
    changed = false;
    for (const m of ms) {
      if (m.r1 < R.r0 || m.r0 > R.r1 || m.c1 < R.c0 || m.c0 > R.c1) continue;
      if (m.r0 < R.r0 || m.r1 > R.r1 || m.c0 < R.c0 || m.c1 > R.c1) {
        R = { r0: Math.min(R.r0, m.r0), r1: Math.max(R.r1, m.r1), c0: Math.min(R.c0, m.c0), c1: Math.max(R.c1, m.c1) }; changed = true;
      }
    }
  }
  return R;
}
function rect() { return expandRect({ r0: Math.min(act.r, ext.r), r1: Math.max(act.r, ext.r), c0: Math.min(act.c, ext.c), c1: Math.max(act.c, ext.c) }); }
App.rect = rect;
const isSingle = R => { const m = mergeAt(R.r0, R.c0); return (R.r0 === R.r1 && R.c0 === R.c1) || (m && m.r0 === R.r0 && m.r1 === R.r1 && m.c0 === R.c0 && m.c1 === R.c1); };
App.isSingle = isSingle;
const rangeName = R => keyOf(R.r0, R.c0) + (R.r0 === R.r1 && R.c0 === R.c1 ? '' : ':' + keyOf(R.r1, R.c1));
App.rangeName = rangeName;
let painted = [], fhTd = null, hlHeads = [];
const SELC = '#217346';
function paintSel() {
  for (const td of painted) td.style.boxShadow = '';
  painted = [];
  const keepFh = drag && drag.touch && drag.t === 'cell';
  if (fhTd && !keepFh) { const fh = fhTd.querySelector('#fh'); if (fh) fh.remove(); if (fhTd._rel) { fhTd.style.position = ''; fhTd._rel = 0; } fhTd = null; }
  for (const th of hlHeads) th.classList.remove('hl', 'full');
  hlHeads = [];
  const R = rect(), A = anchorOf(act), single = isSingle(R), hidR = rowHiddenSet(book.cur);
  const chartOn = App.chartSel != null;
  if (!chartOn) for (let r = R.r0; r <= R.r1; r++) {
    if (hidR.has(r)) continue;
    for (let c = R.c0; c <= R.c1; c++) {
      const td = tds[r][c];
      if (td._cov) continue;
      const m = td._m ? mergeAt(r, c) : null;
      const rr = m ? m.r1 : r, cc = m ? m.c1 : c;
      const sh = [];
      if (r === R.r0) sh.push(`inset 0 2px 0 ${SELC}`);
      if (rr >= R.r1) sh.push(`inset 0 -2px 0 ${SELC}`);
      if (c === R.c0) sh.push(`inset 2px 0 0 ${SELC}`);
      if (cc >= R.c1) sh.push(`inset -2px 0 0 ${SELC}`);
      if (!single && !(r === A.r && c === A.c)) sh.push('inset 0 0 0 9999px rgba(0,0,0,.09)');
      if (sh.length) { td.style.boxShadow = sh.join(','); painted.push(td); }
    }
  }
  if (!chartOn && !editing && !keepFh) {
    let br = R.r1; while (br > R.r0 && hidR.has(br)) br--;
    let bc = R.c1; while (bc > R.c0 && isColHidden(bc)) bc--;
    const a = anchorOf({ r: br, c: bc }), td = tds[a.r][a.c];
    const fh = document.createElement('div'); fh.id = 'fh';
    if (!td.style.position) { td.style.position = 'relative'; td._rel = 1; }
    td.appendChild(fh); fhTd = td;
  }
  const fullCol = R.r0 === 0 && R.r1 === ROWS - 1, fullRow = R.c0 === 0 && R.c1 === COLS - 1;
  for (let c = R.c0; c <= R.c1; c++) { colHeads[c].classList.add('hl'); if (fullCol) colHeads[c].classList.add('full'); hlHeads.push(colHeads[c]); }
  for (let r = R.r0; r <= R.r1; r++) { rowHeads[r].classList.add('hl'); if (fullRow) rowHeads[r].classList.add('full'); hlHeads.push(rowHeads[r]); }
}
function updateSel(opts) {
  paintSel();
  const R = rect();
  if (document.activeElement !== nameBox) nameBox.value = drag && drag.t === 'cell' && !isSingle(R) ? `${R.r1 - R.r0 + 1}R x ${R.c1 - R.c0 + 1}C` : keyOf(act.r, act.c);
  if (!editing) { fbar.value = rawForEdit(act); placeEditor(); if (editor.value.trim()) resetNav(); setMode(clip && !clip.done ? (touch ? '貼り付けたいセルをタップして［貼り付け］を押します' : '貼り付け先を選択し、Enter キーを押すか、貼り付けを選択します。') : '準備完了'); }
  if (!editing && App.hideActionBar && !(opts && opts.keepBar)) App.hideActionBar();
  updateStatus(R);
  placeDv();
  if (clip && !clip.done && clip.si === book.cur) showAnts(clip.R); else hideAnts();
  App.onSelChange && App.onSelChange(opts);
}
App.updateSel = updateSel;
function updateStatus(R) {
  const stat = $('stat');
  if (isSingle(R)) { stat.innerHTML = ''; return; }
  let s = 0, n = 0, k = 0;
  const hidR = rowHiddenSet(book.cur);
  for (let r = R.r0; r <= R.r1; r++) {
    if (hidR.has(r)) continue;
    for (let c = R.c0; c <= R.c1; c++) {
      if (!hasValue(sheet(), r, c)) continue;
      const v = val(book.cur, r, c);
      if (v != null && v !== '') k++;
      if (typeof v === 'number') { s += v; n++; }
    }
  }
  const f = x => E.formatValue(x, sheet().cells[keyOf(act.r, act.c)] && sheet().cells[keyOf(act.r, act.c)].fmt ? sheet().cells[keyOf(act.r, act.c)] : null);
  stat.innerHTML = n ? `<span>平均: ${esc(f(E.roundTo(s / n, 10)))}</span><span>データの個数: ${k}</span><span>合計: ${esc(f(s))}</span>` : k > 1 ? `<span>データの個数: ${k}</span>` : '';
}
function cellRectPx(r, c) {
  const a = anchorOf({ r, c }), td = tds[a.r][a.c];
  const wr = wrap.getBoundingClientRect(), tr = td.getBoundingClientRect();
  return { x: tr.left - wr.left + wrap.scrollLeft - wrap.clientLeft, y: tr.top - wr.top + wrap.scrollTop - wrap.clientTop, w: tr.width, h: tr.height };
}
App.cellRectPx = cellRectPx;
function rangeRectPx(R) {
  const hidR = rowHiddenSet(book.cur);
  let r0 = R.r0; while (r0 < R.r1 && hidR.has(r0)) r0++;
  let r1 = R.r1; while (r1 > r0 && hidR.has(r1)) r1--;
  const a = cellRectPx(r0, R.c0), b = cellRectPx(r1, R.c1);
  return { x: a.x, y: a.y, w: Math.max(2, b.x + b.w - a.x), h: Math.max(2, b.y + b.h - a.y) };
}
App.rangeRectPx = rangeRectPx;
function ensureVisible(p) {
  const a = anchorOf(p), td = tds[a.r][a.c];
  if (!td || td._cov || isRowHidden(a.r)) return;
  const b = cellRectPx(a.r, a.c), Z = zoom();
  let hh = table.tHead.offsetHeight, lw = Math.round(RHW * Z);
  if (frz) {
    if (a.r < frz.r && a.c < frz.c) return;
    for (let r = 0; r < frz.r; r++) if (!isRowHidden(r)) hh += rowH(r) + 1;
    for (let c = 0; c < frz.c; c++) lw += colW(c) + 1;
  }
  if (!(frz && a.r < frz.r)) {
    if (b.y - hh < wrap.scrollTop) wrap.scrollTop = b.y - hh;
    else if (b.y + b.h > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = b.y + b.h - wrap.clientHeight;
  }
  if (!(frz && a.c < frz.c)) {
    if (b.x - lw < wrap.scrollLeft) wrap.scrollLeft = b.x - lw;
    else if (b.x + b.w > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = b.x + b.w - wrap.clientWidth;
  }
}
App.ensureVisible = ensureVisible;
function select(a, b, noScroll) {
  App.chartSel = null;
  act = anchorOf(clampP(a)); ext = clampP(b || a);
  if (!b) ext = { ...act };
  updateSel();
  if (!noScroll) ensureVisible(b || a);
}
App.select = select;
function step(p, dr, dc) {
  const m = mergeAt(p.r, p.c);
  let r = p.r, c = p.c;
  if (m) { if (dr > 0) r = m.r1; if (dc > 0) c = m.c1; if (dr < 0) r = m.r0; if (dc < 0) c = m.c0; }
  const hidR = rowHiddenSet(book.cur);
  for (;;) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return { r: p.r, c: p.c };
    r = nr; c = nc;
    if (dr && hidR.has(r)) continue;
    if (dc && isColHidden(c)) continue;
    return { r, c };
  }
}
function move(dr, dc) { select(step(act, dr, dc)); }
App.move = move;
function jump(p, dr, dc) {
  const sh = sheet(), filled = (r, c) => hasValue(sh, r, c);
  const inb = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  let { r, c } = p;
  if (!inb(r + dr, c + dc)) return p;
  if (filled(r, c) && filled(r + dr, c + dc)) { while (inb(r + dr, c + dc) && filled(r + dr, c + dc)) { r += dr; c += dc; } }
  else { r += dr; c += dc; while (!filled(r, c) && inb(r + dr, c + dc)) { r += dr; c += dc; } }
  return { r, c };
}
function usedRect(sh) {
  sh = sh || sheet();
  let r1 = -1, c1 = -1;
  for (const [k, c] of Object.entries(sh.cells)) { if (c.v == null || c.v === '') continue; const p = parseKey(k); if (!p) continue; r1 = Math.max(r1, p.r); c1 = Math.max(c1, p.c); }
  for (const m of sh.merges) { r1 = Math.max(r1, m.r1); c1 = Math.max(c1, m.c1); }
  return r1 < 0 ? null : { r0: 0, r1, c0: 0, c1 };
}
App.usedRect = usedRect;
function currentRegion(p) {
  const sh = sheet(), filled = (r, c) => hasValue(sh, r, c);
  const R = { r0: p.r, r1: p.r, c0: p.c, c1: p.c };
  const rowHas = (r, c0, c1) => { if (r < 0 || r >= ROWS) return false; for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) if (filled(r, c)) return true; return false; };
  const colHas = (c, r0, r1) => { if (c < 0 || c >= COLS) return false; for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) if (filled(r, c)) return true; return false; };
  for (let grew = true; grew;) {
    grew = false;
    if (rowHas(R.r0 - 1, R.c0 - 1, R.c1 + 1)) { R.r0--; grew = true; }
    if (rowHas(R.r1 + 1, R.c0 - 1, R.c1 + 1)) { R.r1++; grew = true; }
    if (colHas(R.c0 - 1, R.r0 - 1, R.r1 + 1)) { R.c0--; grew = true; }
    if (colHas(R.c1 + 1, R.r0 - 1, R.r1 + 1)) { R.c1++; grew = true; }
  }
  return R;
}
App.currentRegion = currentRegion;

/* ---- アニメーション枠（コピー中） ---- */
let antsEl = null;
function showAnts(R) {
  if (!antsEl) { antsEl = document.createElement('div'); antsEl.id = 'ants'; wrap.appendChild(antsEl); }
  const b = rangeRectPx(R);
  Object.assign(antsEl.style, { left: b.x - 1 + 'px', top: b.y - 1 + 'px', width: b.w + 1 + 'px', height: b.h + 1 + 'px', display: '' });
}
function hideAnts() { if (antsEl) antsEl.style.display = 'none'; }

/* ================= 状態の変更 ================= */
const undoS = [], redoS = [];
function snapshot() { return JSON.stringify({ sheets: book.sheets, cur: book.cur, name: book.name }); }
function restore(s) { const o = JSON.parse(s); book.sheets = o.sheets.map(fixSheet); book.cur = Math.min(o.cur, book.sheets.length - 1); book.name = o.name; }
function protectedMsg() { App.alert('変更しようとしているセルやグラフは保護されているシート上にあります。変更するには、[校閲] タブの [シートの保護] をクリックして保護を解除してください。'); }
function commit(fn, opts) {
  opts = opts || {};
  if (!opts.any && sheet().prot) { protectedMsg(); return false; }
  const snap = snapshot();
  const res = fn();
  if (res === false) return false;
  undoS.push(snap); if (undoS.length > 120) undoS.shift();
  redoS.length = 0;
  afterChange(opts.structure);
  return true;
}
App.commit = commit;
function undo() { if (editing) cancelEdit(); if (!undoS.length) return; redoS.push(snapshot()); restore(undoS.pop()); clip = null; App.chartSel = null; afterChange(true); }
function redo() { if (editing) cancelEdit(); if (!redoS.length) return; undoS.push(snapshot()); restore(redoS.pop()); clip = null; App.chartSel = null; afterChange(true); }
App.undo = undo; App.redo = redo;
function afterChange(structure) {
  act = anchorOf(clampP(act)); ext = clampP(ext);
  render(); renderTabs(); updateSel();
  $('qUndo').disabled = !undoS.length; $('qRedo').disabled = !redoS.length;
  App.onChange && App.onChange();
  markDirty();
}
App.afterChange = afterChange;
App.refresh = () => { render(); updateSel(); };
function cleanCell(sh, k) {
  const c = sh.cells[k]; if (!c) return;
  if (c.v === '' || c.v == null) delete c.v;
  if (c.bd) { for (const e of ['t', 'b', 'l', 'r']) if (!c.bd[e]) delete c.bd[e]; if (!Object.keys(c.bd).length) delete c.bd; }
  for (const p in c) if (c[p] == null || c[p] === false || c[p] === '') delete c[p];
  if (!Object.keys(c).length) delete sh.cells[k];
}
App.cleanCell = cleanCell;
function eachIn(R, fn) { for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) fn(r, c); }
App.eachIn = eachIn;
function cellOf(sh, r, c) { const k = keyOf(r, c); return sh.cells[k] || (sh.cells[k] = {}); }
App.cellOf = cellOf;
function styleSel(patch, R) {
  if (editing) commitEdit(0, 0);
  R = R || rect();
  return commit(() => {
    const sh = sheet();
    eachIn(R, (r, c) => { const k = keyOf(r, c); const x = cellOf(sh, r, c); for (const p in patch) { if (patch[p] == null) delete x[p]; else x[p] = patch[p]; } cleanCell(sh, k); });
  });
}
App.styleSel = styleSel;
function setCellRaw(r, c, v) {
  const sh = sheet(), k = keyOf(r, c), x = cellOf(sh, r, c);
  if (v === '' || v == null) delete x.v;
  else {
    x.v = v;
    if (!x.fmt && !isFormula(v) && v[0] !== "'") { const p = E.parseInput(v); if (p.fmt) x.fmt = p.fmt; }
    if (!x.fmt && isFormula(v)) { const f = inferFmt(v); if (f) Object.assign(x, f); }
  }
  cleanCell(sh, k);
}
/* 数式の表示形式を参照先から引き継ぐ（Excel と同じ挙動） */
const NO_INHERIT = /^(COUNT|COUNTA|COUNTIF|COUNTIFS|COUNTBLANK|ROWS|COLUMNS|ROW|COLUMN|LEN|MATCH|RANK|WEEKDAY|YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|DAYS|DATEDIF|NETWORKDAYS|TEXT|CONCAT|CONCATENATE|TEXTJOIN|IS\w+|AND|OR|NOT|XOR|FIND|SEARCH|EXACT|CODE|CHAR|LEFT|RIGHT|MID|UPPER|LOWER|PROPER|TRIM|SUBSTITUTE|REPLACE|REPT|IFERROR|IFNA)$/;
const INHERITABLE = ['date', 'ldate', 'md', 'datetime', 'time', 'hm', 'currency', 'accounting', 'pct', 'comma'];
function inferFmt(v) {
  const fm = /^=\s*([A-Z][A-Z0-9.]*)\s*\(/i.exec(v);
  if (fm) {
    const f = fm[1].toUpperCase();
    if (['TODAY', 'DATE', 'EDATE', 'EOMONTH'].includes(f)) return { fmt: 'date' };
    if (f === 'NOW') return { fmt: 'datetime' };
    if (f === 'TIME') return { fmt: 'time' };
    if (NO_INHERIT.test(f)) return null;
  }
  if (/[&"]/.test(v)) return null;
  const refs = E.refsIn(v);
  for (const rf of refs) {
    if (rf.sheet && sheetIdx(rf.sheet) !== book.cur) continue;
    const c = sheet().cells[keyOf(Math.min(rf.a.r, ROWS - 1), Math.min(rf.a.c, COLS - 1))];
    if (c && INHERITABLE.includes(c.fmt)) return c.dec != null ? { fmt: c.fmt, dec: c.dec } : { fmt: c.fmt };
    if (c && c.v != null) return null;
  }
  return null;
}
App.setCellRaw = setCellRaw;

/* ================= 入力 ================= */
let editing = false, editKind = null, refIns = null, drag = null, clip = null, editOrig = '';
App.isEditing = () => editing;
function rawForEdit(p) {
  const c = sheet().cells[keyOf(p.r, p.c)];
  if (!c || c.v == null) return '';
  const v = c.v;
  if (!isFormula(v) && c.fmt && /date|ldate|md|datetime|time|hm/.test(c.fmt)) {
    const n = E.parseLiteral(v);
    if (typeof n === 'number') {
      const t = E.fromSerial(n), d = `${t.y}/${t.m}/${t.d}`, tm = `${t.h}:${String(t.mi).padStart(2, '0')}:${String(t.s).padStart(2, '0')}`;
      return c.fmt === 'time' || c.fmt === 'hm' ? tm : c.fmt === 'datetime' ? d + ' ' + tm : d;
    }
  }
  if (!isFormula(v) && c.fmt === 'pct') { const n = E.parseLiteral(v); if (typeof n === 'number' && !String(v).includes('%')) return E.fmtGeneral(n * 100) + '%'; }
  return v;
}
App.rawForEdit = rawForEdit;
function placeEditor() {
  const b = cellRectPx(act.r, act.c);
  Object.assign(editor.style, { left: b.x + 'px', top: b.y + 'px', width: (editing ? b.w : Math.max(2, b.w - 4)) + 'px', height: (editing ? b.h : Math.max(2, b.h - 4)) + 'px' });
  editor._base = b;
}
function growEditor() {
  const b = editor._base || cellRectPx(act.r, act.c);
  editor.style.width = b.w + 'px'; editor.style.height = b.h + 'px';
  if (editor.scrollWidth > editor.clientWidth) editor.style.width = Math.min(editor.scrollWidth + 14, Math.max(b.w, wrap.clientWidth - 20)) + 'px';
  if (editor.scrollHeight > editor.clientHeight) editor.style.height = editor.scrollHeight + 'px';
}
function setMode(m) { $('mode').textContent = m; }
function resetNav() { if (!editing) { editor.value = touch ? '' : ' '; if (!touch) try { editor.setSelectionRange(0, 1); } catch (e) { /* 無視 */ } } }
function focusNav() {
  if (editing || touch) return;
  const ae = document.activeElement;
  if (ae && ae !== editor && ae.closest && ae.closest('dialog,.menu,#backstage')) return;
  if (ae !== editor) editor.focus({ preventScroll: true });
  resetNav();
}
App.focusNav = focusNav;
function startEdit(kind, value) {
  if (sheet().prot) { protectedMsg(); return false; }
  if (App.chartSel != null) { App.chartSel = null; App.renderCharts(); }
  editing = true; editKind = kind; refIns = null;
  editOrig = rawForEdit(act);
  if (value !== undefined) editor.value = value;
  const cell = sheet().cells[keyOf(act.r, act.c)] || {}, Z = zoom();
  Object.assign(editor.style, {
    fontWeight: cell.b ? '700' : '', fontStyle: cell.i ? 'italic' : '', fontFamily: cell.font ? fontCss(cell.font) : '',
    fontSize: (cell.sz || 11) * Z + 'pt', color: cell.fc || '', textAlign: '', whiteSpace: cell.wrap ? 'pre-wrap' : 'pre',
  });
  editor.classList.add('on'); placeEditor(); growEditor();
  fbar.value = editor.value;
  $('fCancel').disabled = false; $('fEnter').disabled = false;
  setMode(kind === 'edit' ? '編集' : '入力');
  paintSel();
  onEditInput();
  return true;
}
App.startEdit = startEdit;
function endEdit() {
  editing = false; editKind = null; refIns = null;
  editor.value = ''; resetNav();
  editor.classList.remove('on'); editor.style.fontSize = '';
  $('fCancel').disabled = true; $('fEnter').disabled = true;
  hideAC(); hideArgTip(); clearRefBoxes(); hidePick();
  setMode('準備完了');
}
function validateInput(v) {
  const cell = sheet().cells[keyOf(act.r, act.c)];
  const dv = cell && cell.dv;
  if (!dv || v === '' || dv.type === 'any') return true;
  const p = E.parseLiteral(v);
  let ok = true;
  if (dv.type === 'list') ok = (App.dvList ? App.dvList(dv) : dv.list || []).some(x => String(x) === v);
  else if (dv.type === 'whole' || dv.type === 'decimal') {
    ok = typeof p === 'number' && (dv.type === 'decimal' || Number.isInteger(p));
    if (ok && dv.min !== '' && dv.min != null) ok = p >= +dv.min;
    if (ok && dv.max !== '' && dv.max != null) ok = p <= +dv.max;
  } else if (dv.type === 'len') {
    const n = [...v].length; ok = (dv.min === '' || n >= +dv.min) && (dv.max === '' || n <= +dv.max);
  }
  if (!ok) App.alert(dv.msg || 'この値は、このセルに定義されているデータの入力規則の制限を満たしていません。');
  return ok;
}
function commitEdit(dr, dc, opts) {
  if (!editing) return true;
  let v = E.normalizeInput(editor.value);
  if (isFormula(v)) {
    const m = v.match(/[A-Z][A-Z0-9.]*(?=\()/g);
    if (m) for (const f of m) if (E.FN_INFO[f]) { book.recentFns = [f, ...book.recentFns.filter(x => x !== f)].slice(0, 10); }
  }
  if (!isFormula(v) && !validateInput(v)) { editor.focus(); return false; }
  const all = opts && opts.all;
  endEdit();
  if (v !== editOrig || all) {
    if (all) {
      const R = rect(), A = { ...act };
      commit(() => { eachIn(R, (r, c) => { if (mergeAt(r, c) && !(mergeAt(r, c).r0 === r && mergeAt(r, c).c0 === c)) return; setCellRaw(r, c, isFormula(v) ? engine.shiftFormula(v, r - A.r, c - A.c) : v); }); });
    } else commit(() => setCellRaw(act.r, act.c, v));
  } else paintSel();
  if (dr || dc) moveInSel(dr, dc); else updateSel();
  focusNav();
  return true;
}
App.commitEdit = commitEdit;
function cancelEdit() { endEdit(); updateSel(); focusNav(); }
App.cancelEdit = cancelEdit;
function moveInSel(dr, dc) {
  const R = rect();
  if (isSingle(R)) return move(dr, dc);
  let { r, c } = act;
  if (dr) { r += dr; if (r > R.r1) { r = R.r0; c = c + 1 > R.c1 ? R.c0 : c + 1; } else if (r < R.r0) { r = R.r1; c = c - 1 < R.c0 ? R.c1 : c - 1; } }
  if (dc) { c += dc; if (c > R.c1) { c = R.c0; r = r + 1 > R.r1 ? R.r0 : r + 1; } else if (c < R.c0) { c = R.c1; r = r - 1 < R.r0 ? R.r1 : r - 1; } }
  const m = mergeAt(r, c); if (m) { r = m.r0; c = m.c0; }
  act = { r, c }; updateSel(); ensureVisible(act);
}
const isFormulaText = s => /^[=＝+]/.test(s) && s.length >= 1;
function canInsertRef(inp) {
  if (!/^[=＝]/.test(inp.value)) return false;
  const pos = inp.selectionStart;
  if (refIns && refIns.inp === inp && refIns.end === pos) return true;
  const before = inp.value.slice(0, pos);
  if ((before.match(/"/g) || []).length % 2) return false;
  return /[=＝+\-*/^&(,<>:]$/.test(before.replace(/\s+$/, ''));
}
function insertRef(inp, text) {
  let s, e;
  if (refIns && refIns.inp === inp && refIns.end === inp.selectionStart) { s = refIns.start; e = refIns.end; }
  else { s = inp.selectionStart; e = inp.selectionEnd; }
  inp.value = inp.value.slice(0, s) + text + inp.value.slice(e);
  refIns = { inp, start: s, end: s + text.length };
  inp.setSelectionRange(refIns.end, refIns.end);
  (inp === editor ? fbar : editor).value = inp.value;
  growEditor(); onEditInput(true);
  setMode('参照');
}
App.insertAtCaret = (text, caretBack) => {
  const inp = document.activeElement === fbar ? fbar : editor;
  const s = inp.selectionStart, e = inp.selectionEnd;
  inp.value = inp.value.slice(0, s) + text + inp.value.slice(e);
  const pos = s + text.length - (caretBack || 0);
  inp.setSelectionRange(pos, pos);
  (inp === editor ? fbar : editor).value = inp.value;
  growEditor(); onEditInput();
  inp.focus();
};
function toggleAbs(inp) {
  const pos = inp.selectionStart, v = inp.value;
  const re = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;
  let m, hit = null;
  while ((m = re.exec(v))) { if (m.index <= pos && re.lastIndex >= pos - 0) hit = m; if (m.index > pos) break; }
  if (!hit) return;
  const st = (hit[1] ? 2 : 0) + (hit[3] ? 1 : 0);
  const nx = { 0: ['$', '$'], 3: ['', '$'], 1: ['$', ''], 2: ['', ''] }[st];
  const rep = nx[0] + hit[2] + nx[1] + hit[4];
  inp.value = v.slice(0, hit.index) + rep + v.slice(hit.index + hit[0].length);
  const np = hit.index + rep.length; inp.setSelectionRange(np, np);
  (inp === editor ? fbar : editor).value = inp.value;
  onEditInput();
}

/* ---- 入力候補・引数ヒント・参照の色枠 ---- */
const acEl = document.createElement('div'); acEl.id = 'ac'; acEl.hidden = true; wrap.appendChild(acEl);
const acDesc = document.createElement('div'); acDesc.id = 'acdesc'; acDesc.hidden = true; wrap.appendChild(acDesc);
const argTip = document.createElement('div'); argTip.id = 'argtip'; argTip.hidden = true; wrap.appendChild(argTip);
const pickBox = document.createElement('div'); pickBox.id = 'pickbox'; pickBox.hidden = true; wrap.appendChild(pickBox);
let acList = [], acIdx = 0, acTok = null;
const REFCOLORS = ['#4472c4', '#c00000', '#7030a0', '#00b050', '#ed7d31', '#0070c0', '#a5a5a5', '#ff00ff'];
let refBoxes = [];
function clearRefBoxes() { refBoxes.forEach(b => b.remove()); refBoxes = []; }
function curInput() { return document.activeElement === fbar ? fbar : editor; }
function tipPos(el) {
  const b = editor._base || cellRectPx(act.r, act.c);
  const eh = Math.max(b.h, editor.offsetHeight || 0);
  el.style.left = b.x + 'px';
  el.style.top = b.y + eh + 2 + 'px';
}
function onEditInput(fromPick) {
  if (!fromPick) { if (refIns && refIns.end !== curInput().selectionStart) refIns = null; }
  const inp = curInput(), v = inp.value;
  clearRefBoxes();
  if (!/^[=＝]/.test(v)) { hideAC(); hideArgTip(); if (editing) setMode(editKind === 'edit' ? '編集' : '入力'); return; }
  const refs = E.refsIn(toHalf(v));
  refs.forEach((rf, i) => {
    if (rf.sheet && sheetIdx(rf.sheet) !== book.cur) return;
    const R = { r0: Math.min(rf.a.r, rf.b.r), r1: Math.min(ROWS - 1, Math.max(rf.a.r, rf.b.r)), c0: Math.min(rf.a.c, rf.b.c), c1: Math.min(COLS - 1, Math.max(rf.a.c, rf.b.c)) };
    if (R.r0 >= ROWS || R.c0 >= COLS) return;
    const b = rangeRectPx(R), d = document.createElement('div');
    d.className = 'refbox'; d.style.color = REFCOLORS[i % REFCOLORS.length]; d.style.borderColor = 'currentColor';
    d.style.background = 'color-mix(in srgb,currentColor 8%,transparent)';
    Object.assign(d.style, { left: b.x - 1 + 'px', top: b.y - 1 + 'px', width: b.w + 1 + 'px', height: b.h + 1 + 'px' });
    wrap.appendChild(d); refBoxes.push(d);
  });
  const before = toHalf(v.slice(0, inp.selectionStart));
  const inStr = (before.match(/"/g) || []).length % 2 === 1;
  const m = !inStr && /(^=|[=(,+\-*/^&<>:;\s])([A-Za-z][A-Za-z0-9.]*)$/.exec(before);
  if (m && !/^\$?[A-Za-z]{1,3}\$?\d+$/.test(m[2]) || (m && E.FN_INFO[m[2].toUpperCase()] === undefined && /^[A-Za-z]+$/.test(m[2]) && !/^[A-Za-z]{1,3}\d/.test(m[2]))) {
    const tok = m[2].toUpperCase();
    const names = Object.keys(E.FN_INFO).filter(n => n.startsWith(tok)).sort();
    if (names.length) showAC(names, tok); else hideAC();
  } else hideAC();
  // 引数ヒント
  let stack = [], q = false, word = '';
  for (const ch of before) {
    if (ch === '"') { q = !q; continue; }
    if (q) continue;
    if (/[A-Za-z0-9_.]/.test(ch)) { word += ch; continue; }
    if (ch === '(') stack.push({ name: word.toUpperCase(), arg: 0 });
    else if (ch === ',' && stack.length) stack[stack.length - 1].arg++;
    else if (ch === ')') stack.pop();
    word = '';
  }
  const top = stack.length && stack[stack.length - 1];
  if (top && E.FN_INFO[top.name] && acEl.hidden) showArgTip(top.name, top.arg); else hideArgTip();
}
App.onEditInput = onEditInput;
function showAC(names, tok) {
  acList = names; acIdx = 0; acTok = tok;
  acEl.innerHTML = names.map((n, i) => `<div data-i="${i}" class="${i === 0 ? 'on' : ''}"><i>fx</i>${n}</div>`).join('');
  acEl.hidden = false; tipPos(acEl);
  if (curInput() === fbar) { const fr = fbar.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); acEl.style.left = fr.left - wr.left + wrap.scrollLeft + 'px'; acEl.style.top = wrap.scrollTop + 'px'; }
  showAcDesc();
}
function showAcDesc() {
  const n = acList[acIdx], info = E.FN_INFO[n];
  if (!info) { acDesc.hidden = true; return; }
  acDesc.innerHTML = esc(info[2]); acDesc.hidden = false;
  acDesc.style.left = acEl.offsetLeft + acEl.offsetWidth + 4 + 'px';
  const it = acEl.children[acIdx];
  acDesc.style.top = acEl.offsetTop + (it ? it.offsetTop - acEl.scrollTop : 0) + 'px';
}
function hideAC() { acEl.hidden = true; acDesc.hidden = true; acList = []; }
function acceptAC() {
  const name = acList[acIdx]; if (!name) return;
  const inp = curInput(), pos = inp.selectionStart, v = inp.value;
  const start = pos - acTok.length;
  inp.value = v.slice(0, start) + name + '(' + v.slice(pos);
  const np = start + name.length + 1; inp.setSelectionRange(np, np);
  (inp === editor ? fbar : editor).value = inp.value;
  hideAC(); growEditor(); onEditInput();
}
acEl.addEventListener('mousedown', e => { e.preventDefault(); const d = e.target.closest('div[data-i]'); if (!d) return; acIdx = +d.dataset.i; acceptAC(); });
acEl.addEventListener('mousemove', e => { const d = e.target.closest('div[data-i]'); if (!d || +d.dataset.i === acIdx) return; acEl.children[acIdx].classList.remove('on'); acIdx = +d.dataset.i; d.classList.add('on'); showAcDesc(); });
function showArgTip(name, arg) {
  const syn = E.FN_INFO[name][1];
  const m = /^([^(]+)\((.*)\)$/.exec(syn);
  if (!m) return hideArgTip();
  const params = m[2] ? m[2].split(/,\s*/) : [];
  let bi = arg;
  if (bi >= params.length) { const rep = params.findIndex(p => p === '...'); bi = rep > 0 ? rep - 1 : params.length - 1; }
  argTip.innerHTML = `<a>${esc(m[1])}</a>(${params.map((p, i) => i === bi ? `<b>${esc(p)}</b>` : esc(p)).join(', ')})`;
  argTip.hidden = false; tipPos(argTip);
  if (curInput() === fbar) { const fr = fbar.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); argTip.style.left = fr.left - wr.left + wrap.scrollLeft + 'px'; argTip.style.top = wrap.scrollTop + 2 + 'px'; }
}
function hideArgTip() { argTip.hidden = true; }
function showPick(R) { const b = rangeRectPx(R); Object.assign(pickBox.style, { left: b.x - 1 + 'px', top: b.y - 1 + 'px', width: b.w + 1 + 'px', height: b.h + 1 + 'px' }); pickBox.hidden = false; }
function hidePick() { pickBox.hidden = true; }
App.showPick = showPick; App.hidePick = hidePick;

/* ---- キー操作 ---- */
const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
function onEditKey(e) {
  if (e.isComposing || e.keyCode === 229) return;
  const inp = e.target;
  if (!acEl.hidden) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      acEl.children[acIdx].classList.remove('on');
      acIdx = (acIdx + (e.key === 'ArrowDown' ? 1 : -1) + acList.length) % acList.length;
      const it = acEl.children[acIdx]; it.classList.add('on'); it.scrollIntoView({ block: 'nearest' }); showAcDesc();
      return;
    }
    if (e.key === 'Tab') { e.preventDefault(); acceptAC(); return; }
    if (e.key === 'Escape') { e.preventDefault(); hideAC(); return; }
  }
  if (e.key === 'Enter' && (e.altKey || (e.metaKey && !e.ctrlKey && false))) {
    e.preventDefault();
    const s = inp.selectionStart; inp.value = inp.value.slice(0, s) + '\n' + inp.value.slice(inp.selectionEnd); inp.setSelectionRange(s + 1, s + 1);
    (inp === editor ? fbar : editor).value = inp.value; growEditor();
    const x = sheet().cells[keyOf(act.r, act.c)]; if (!x || !x.wrap) editor.style.whiteSpace = 'pre-wrap';
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); if (e.ctrlKey) commitEdit(0, 0, { all: true }); else commitEdit(e.shiftKey ? -1 : 1, 0); return; }
  if (e.key === 'Tab') { e.preventDefault(); commitEdit(0, e.shiftKey ? -1 : 1); return; }
  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return; }
  if (e.key === 'F4') { e.preventDefault(); toggleAbs(inp); return; }
  if (e.key === 'F2') { e.preventDefault(); editKind = editKind === 'edit' ? 'enter' : 'edit'; setMode(editKind === 'edit' ? '編集' : '入力'); return; }
  if (ARROWS[e.key] && editKind === 'enter' && inp === editor) {
    if (canInsertRef(inp)) {
      e.preventDefault();
      const base = refIns && refIns.cur ? refIns.cur : { ...act };
      const p = e.shiftKey && refIns && refIns.anchor ? step(refIns.cur, ...ARROWS[e.key]) : step(base, ...ARROWS[e.key]);
      const anchor = e.shiftKey ? (refIns && refIns.anchor) || base : p;
      const R = { r0: Math.min(anchor.r, p.r), r1: Math.max(anchor.r, p.r), c0: Math.min(anchor.c, p.c), c1: Math.max(anchor.c, p.c) };
      insertRef(inp, rangeName(R));
      refIns.cur = p; refIns.anchor = anchor;
      showPick(R); ensureVisible(p);
      return;
    }
    if (!/^[=＝]/.test(inp.value)) { e.preventDefault(); commitEdit(...ARROWS[e.key]); return; }
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'a' && /^[=＝]/.test(inp.value)) { e.preventDefault(); App.cmd('insertFunction'); }
}
function navKey(e) {
  if (e.isComposing || e.keyCode === 229) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key, l = k.length === 1 ? k.toLowerCase() : k;
  if (App.chartSel != null) {
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); App.cmd('deleteChart'); return; }
    if (k === 'Escape') { App.chartSel = null; App.renderCharts(); updateSel(); return; }
  }
  if (mod && !e.altKey) {
    const map = {
      z: 'undo', y: 'redo', b: 'bold', i: 'italic', u: 'underline', '1': 'formatCells', f: 'find', h: 'replace', g: 'goto',
      d: 'fillDown', r: 'fillRight', s: 'save', p: 'print', t: 'insertTable', '5': 'strike', '9': 'hideRows', '0': 'hideCols',
      '`': 'showFormulas', '@': 'showFormulas', o: 'open', n: 'newBook',
    };
    if (e.shiftKey && l === 'z') { e.preventDefault(); return App.cmd('redo'); }
    if (e.shiftKey && (l === 'l')) { e.preventDefault(); return App.cmd('filter'); }
    if (e.shiftKey && (k === '%' || e.code === 'Digit5')) { e.preventDefault(); return App.cmd('fmtPct'); }
    if (e.shiftKey && (k === '$' || e.code === 'Digit4')) { e.preventDefault(); return App.cmd('fmtCurrency'); }
    if (e.shiftKey && (k === '+' || k === '=' || k === ';' && false)) { e.preventDefault(); return App.cmd('insertCellsDialog'); }
    if (k === '+' || (k === ';' && e.shiftKey === false && e.code === 'Semicolon' && false)) { e.preventDefault(); return App.cmd('insertCellsDialog'); }
    if (k === '-') { e.preventDefault(); return App.cmd('deleteCellsDialog'); }
    if (k === ';') { e.preventDefault(); return App.cmd(e.shiftKey ? 'insertTime' : 'insertDate'); }
    if (k === ':' || (e.shiftKey && e.code === 'Semicolon')) { e.preventDefault(); return App.cmd('insertTime'); }
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); return e.shiftKey ? select({ r: 0, c: 0 }, { r: ROWS - 1, c: COLS - 1 }) : selectCols(); }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); return App.cmd(k === 'PageDown' ? 'nextSheet' : 'prevSheet'); }
    if (k === 'Home') { e.preventDefault(); return select({ r: frz ? frz.r : 0, c: frz ? frz.c : 0 }); }
    if (k === 'End') { e.preventDefault(); const u = usedRect(); return select(u ? { r: u.r1, c: u.c1 } : { r: 0, c: 0 }); }
    if (ARROWS[k]) {
      e.preventDefault();
      const to = jump(e.shiftKey ? ext : act, ...ARROWS[k]);
      if (e.shiftKey) { ext = to; updateSel(); ensureVisible(to); } else select(to);
      return;
    }
    if (l === 'a') { e.preventDefault(); const R = currentRegion(act); if (!isSingle(R) && !(rect().r0 === R.r0 && rect().r1 === R.r1 && rect().c0 === R.c0 && rect().c1 === R.c1)) select({ r: R.r0, c: R.c0 }, { r: R.r1, c: R.c1 }); else select({ r: 0, c: 0 }, { r: ROWS - 1, c: COLS - 1 }); act = { r: 0, c: 0 }; return; }
    if (map[l]) { e.preventDefault(); return App.cmd(map[l]); }
    return;
  }
  if (e.altKey && (k === '=' || e.code === 'Minus' && e.shiftKey)) { e.preventDefault(); return App.cmd('autoSum:SUM'); }
  if (e.altKey && k === 'Enter') { e.preventDefault(); return; }
  if (ARROWS[k]) {
    e.preventDefault();
    if (e.shiftKey) { ext = clampP(step(ext, ...ARROWS[k])); updateSel(); ensureVisible(ext); }
    else move(...ARROWS[k]);
    return;
  }
  if (e.shiftKey && (k === ' ' || e.code === 'Space') && !mod) { e.preventDefault(); return selectRows(); }
  switch (k) {
    case 'Enter': e.preventDefault(); if (clip && !e.shiftKey) { pasteInternal('all'); clip = null; hideAnts(); updateSel(); break; } moveInSel(e.shiftKey ? -1 : 1, 0); break;
    case 'Tab': e.preventDefault(); moveInSel(0, e.shiftKey ? -1 : 1); break;
    case 'F2': e.preventDefault(); if (startEdit('edit', rawForEdit(act))) editor.setSelectionRange(editor.value.length, editor.value.length); break;
    case 'F9': e.preventDefault(); App.refresh(); break;
    case 'F11': if (e.shiftKey) { e.preventDefault(); App.cmd('addSheet'); } break;
    case 'F3': if (e.shiftKey) { e.preventDefault(); App.cmd('insertFunction'); } break;
    case 'F4': e.preventDefault(); App.cmd('repeat'); break;
    case 'Delete': e.preventDefault(); clearRange('contents'); break;
    case 'Backspace': e.preventDefault(); startEdit('enter', ''); break;
    case 'Home': e.preventDefault(); select({ r: act.r, c: 0 }); break;
    case 'PageDown': e.preventDefault(); move(Math.max(1, Math.floor(wrap.clientHeight / rowH(act.r)) - 1), 0); break;
    case 'PageUp': e.preventDefault(); move(-Math.max(1, Math.floor(wrap.clientHeight / rowH(act.r)) - 1), 0); break;
    case 'Escape': if (clip) { clip = null; hideAnts(); updateSel(); } if (App.painter) App.cmd('painterOff'); break;
    case 'ContextMenu': e.preventDefault(); { const b = cellRectPx(act.r, act.c), wr = wrap.getBoundingClientRect(); App.showCellMenu(wr.left + b.x - wrap.scrollLeft + b.w / 2, wr.top + b.y - wrap.scrollTop + b.h, 'cell'); } break;
  }
}
function selectRows() { const R = rect(); act = { r: act.r, c: 0 }; select({ r: R.r0, c: 0 }, { r: R.r1, c: COLS - 1 }, true); act = { r: R.r0, c: 0 }; updateSel(); }
function selectCols() { const R = rect(); select({ r: 0, c: R.c0 }, { r: ROWS - 1, c: R.c1 }, true); }
App.selectRows = selectRows; App.selectCols = selectCols;
editor.addEventListener('keydown', e => { if (editing) return onEditKey(e); navKey(e); });
App.navKey = e => { if (!editing) { navKey(e); if (!e.defaultPrevented && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (startEdit('enter', e.key)) { editor.focus(); editor.setSelectionRange(1, 1); onEditInput(); } } } };
editor.addEventListener('compositionstart', () => { if (!editing) startEdit('enter'); });
editor.addEventListener('input', () => {
  if (!editing) { if (!startEdit('enter')) { resetNav(); return; } }
  fbar.value = editor.value; growEditor(); onEditInput();
});
editor.addEventListener('click', () => { if (editing) { refIns = null; onEditInput(); } });
editor.addEventListener('keyup', e => { if (editing && /Arrow|Home|End/.test(e.key) && !ARROWS[e.key]) onEditInput(); });
fbar.addEventListener('focus', () => { if (!editing) { if (!startEdit('edit', rawForEdit(act))) fbar.blur(); } });
fbar.addEventListener('input', () => { editor.value = fbar.value; growEditor(); onEditInput(); });
fbar.addEventListener('keydown', e => { if (editing) onEditKey(e); });
fbar.addEventListener('click', () => { if (editing) onEditInput(); });
$('fCancel').addEventListener('mousedown', e => e.preventDefault());
$('fEnter').addEventListener('mousedown', e => e.preventDefault());
$('fCancel').onclick = () => cancelEdit();
$('fEnter').onclick = () => commitEdit(0, 0);
nameBox.addEventListener('focus', () => { if (editing) commitEdit(0, 0); nameBox.select(); });
nameBox.addEventListener('keydown', e => {
  if (e.key === 'Escape') { nameBox.blur(); updateSel(); focusNav(); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const t = toHalf(nameBox.value).trim();
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(t);
  if (m) {
    const a = { r: +m[2] - 1, c: colIdx(m[1]) }, b = m[3] ? { r: +m[4] - 1, c: colIdx(m[3]) } : a;
    if (a.r < ROWS && a.c < COLS && b.r < ROWS && b.c < COLS) { nameBox.blur(); select(a, b); act = a; updateSel(); focusNav(); return; }
  }
  App.alert('入力した参照が正しくありません。'); nameBox.select();
});

/* ================= マウス ================= */
const posOf = td => ({ r: td.parentNode.rowIndex - 1, c: td.cellIndex - 1 + 0 });
function tdPos(td) {
  // colSpan があるとセル番号がずれるので tds 配列から逆引き
  const r = td.parentNode.rowIndex - 1, row = tds[r];
  return { r, c: row.indexOf(td) };
}
function hitAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !el.closest) return null;
  const td = el.closest('#grid td');
  if (td) {
    // 隣のセルからはみ出した文字などに引っぱられないよう、触れた位置の座標そのものでセルを決める
    const r = td.parentNode.rowIndex - 1, row = tds[r];
    for (let c = 0; c < COLS; c++) {
      const t = row[c]; if (t._cov) continue;
      const b = t.getBoundingClientRect();
      if (b.width > 0 && x >= b.left && x < b.right) return { r, c, td: true };
    }
    return { ...tdPos(td), td: true };
  }
  const th = el.closest('#grid th');
  if (th && th.classList.contains('ch')) return { r: 0, c: colHeads.indexOf(th), col: true };
  if (th && th.classList.contains('rh')) return { r: th.parentNode.rowIndex - 1, c: 0, row: true };
  return null;
}
App.hitAt = hitAt;
/* 見出しの境界（列の幅・行の高さの変更位置）の判定 */
function edgeHit(target, x, y, tol) {
  const th = target && target.closest && target.closest('#grid th.ch,#grid th.rh');
  if (!th) return null;
  const b = th.getBoundingClientRect();
  if (th.classList.contains('ch')) {
    let c = colHeads.indexOf(th);
    if (x >= b.right - tol) return { t: 'resize', c };
    if (x <= b.left + tol) { c--; while (c >= 0 && isColHidden(c)) c--; if (c >= 0) return { t: 'resize', c }; }
    return null;
  }
  let r = rowHeads.indexOf(th);
  if (y >= b.bottom - Math.min(tol, 4)) return { t: 'resizeR', r };
  if (y <= b.top + Math.min(tol, 3)) { r--; while (r >= 0 && isRowHidden(r)) r--; if (r >= 0) return { t: 'resizeR', r }; }
  return null;
}
let hoverEdgeEl = null;
function selBorderHit(x, y, tol) {
  if (editing || App.chartSel != null) return false;
  const R = rect(), b = rangeRectPx(R), wr = wrap.getBoundingClientRect();
  const cx = x - wr.left + wrap.scrollLeft - wrap.clientLeft, cy = y - wr.top + wrap.scrollTop - wrap.clientTop;
  const out = cx >= b.x - tol && cx <= b.x + b.w + tol && cy >= b.y - tol && cy <= b.y + b.h + tol;
  const inn = cx > b.x + tol && cx < b.x + b.w - tol && cy > b.y + tol && cy < b.y + b.h - tol;
  const nearFill = cx > b.x + b.w - 10 && cy > b.y + b.h - 10;
  return out && !inn && !nearFill;
}
wrap.addEventListener('mousemove', e => {
  if (drag) return;
  wrap.classList.toggle('mv', !touch && !!(e.target.closest && e.target.closest('#grid td')) && e.target.id !== 'fh' && selBorderHit(e.clientX, e.clientY, 4));
  const eh = edgeHit(e.target, e.clientX, e.clientY, 5);
  const th = e.target.closest && e.target.closest('#grid th');
  if (hoverEdgeEl && hoverEdgeEl !== th) { hoverEdgeEl.style.cursor = ''; hoverEdgeEl = null; }
  if (th) { th.style.cursor = eh ? (eh.t === 'resize' ? 'col-resize' : 'row-resize') : ''; hoverEdgeEl = th; }
});
let lastTap = { t: 0, r: -1, c: -1 }, autoScroll = 0, lastMouse = null;
wrap.addEventListener('mousedown', e => {
  App.hideMenus && App.hideMenus();
  if (e.target.closest('.chart')) return;
  const eh = edgeHit(e.target, e.clientX, e.clientY, 5);
  if (eh && e.button === 0) {
    e.preventDefault();
    if (eh.t === 'resize') {
      if (e.detail === 2) { App.cmd('autofitCol:' + eh.c); return; }
      drag = { t: 'resize', c: eh.c, x: e.clientX, w: sheet().colW[eh.c] || DEFW, snap: snapshot() };
    } else {
      if (e.detail === 2) { commit(() => { delete sheet().rowH[eh.r]; }); return; }
      drag = { t: 'resizeR', r: eh.r, y: e.clientY, h: sheet().rowH[eh.r] || DEFH, snap: snapshot() };
    }
    return;
  }
  if (e.target.id === 'fh') {
    e.preventDefault(); e.stopPropagation();
    if (editing) commitEdit(0, 0);
    if (e.detail === 2) { App.cmd('fillDownAuto'); return; }
    drag = { t: 'fill', to: null }; return;
  }
  if (e.target.closest('.fbtn')) { e.preventDefault(); const b = e.target.closest('.fbtn'); App.showFilterMenu(+b.dataset.fc, b); return; }
  if (e.target.closest('.dvbtn')) return;
  const h = hitAt(e.clientX, e.clientY);
  if (h && h.td && e.button === 0 && !e.shiftKey && selBorderHit(e.clientX, e.clientY, 4)) {
    e.preventDefault();
    const R = rect();
    drag = { t: 'move', R, grab: { r: Math.min(Math.max(h.r, R.r0), R.r1), c: Math.min(Math.max(h.c, R.c0), R.c1) }, dr: 0, dc: 0, moved: false };
    return;
  }
  if (!h) {
    if (e.target.closest('th.corner')) { e.preventDefault(); if (editing) commitEdit(0, 0); select({ r: 0, c: 0 }, { r: ROWS - 1, c: COLS - 1 }, true); act = { r: 0, c: 0 }; updateSel(); focusNav(); }
    return;
  }
  if (e.button === 2) {
    const R = rect();
    const inside = h.r >= R.r0 && h.r <= R.r1 && h.c >= R.c0 && h.c <= R.c1;
    if (editing) commitEdit(0, 0);
    if (h.col && !(inside && R.r0 === 0 && R.r1 === ROWS - 1)) select({ r: 0, c: h.c }, { r: ROWS - 1, c: h.c }, true);
    else if (h.row && !(inside && R.c0 === 0 && R.c1 === COLS - 1)) { select({ r: h.r, c: 0 }, { r: h.r, c: COLS - 1 }, true); }
    else if (h.td && !inside) select({ r: h.r, c: h.c }, null, true);
    return;
  }
  if (e.button !== 0) return;
  if (editing && h.td) {
    const inp = curInput();
    if (canInsertRef(inp)) {
      e.preventDefault();
      drag = { t: 'pick', a: h, inp };
      insertRef(inp, keyOf(h.r, h.c));
      showPick({ r0: h.r, r1: h.r, c0: h.c, c1: h.c });
      return;
    }
  }
  if (editing && e.target === editor) return;
  e.preventDefault();
  if (editing && !commitEdit(0, 0)) return;
  App.chartSel = null;
  if (h.td) {
    const now = Date.now();
    if (touch && !e.shiftKey && anchorOf(h).r === act.r && anchorOf(h).c === act.c && isSingle(rect())) {
      if (startEdit('edit', rawForEdit(act))) { editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); }
      return;
    }
    lastTap = { t: now, r: h.r, c: h.c };
    if (e.shiftKey) ext = { r: h.r, c: h.c }; else { act = anchorOf({ r: h.r, c: h.c }); ext = { r: h.r, c: h.c }; }
    drag = { t: 'cell' };
  } else if (h.col) {
    if (!e.shiftKey) { act = { r: 0, c: h.c }; drag = { t: 'col', a: h.c }; } else drag = { t: 'col', a: act.c };
    ext = { r: ROWS - 1, c: h.c }; act.r = 0;
  } else if (h.row) {
    if (!e.shiftKey) { act = { r: h.r, c: 0 }; drag = { t: 'row' }; } else drag = { t: 'row' };
    ext = { r: h.r, c: COLS - 1 }; act.c = 0;
  }
  updateSel(); focusNav();
});
wrap.addEventListener('dblclick', e => {
  const td = e.target.closest('#grid td'); if (!td || touch || e.target.id === 'fh' || e.target.closest('.fbtn')) return;
  const p = anchorOf(tdPos(td)); act = p; ext = { ...p };
  updateSel();
  if (startEdit('edit', rawForEdit(act))) { editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); }
});
wrap.addEventListener('click', () => { if (touch && editing && document.activeElement !== editor && document.activeElement !== fbar) editor.focus(); });
function dragMove(x, y) {
  if (!drag) return;
  if (drag.t === 'resize') { const Z = zoom(); sheet().colW[drag.c] = Math.max(0, Math.round(drag.w + (x - drag.x) / Z)); applySizes(); paintSel(); App.renderCharts && App.renderCharts(); showSizeTip(x, y, `幅: ${((sheet().colW[drag.c] - 5) / 8).toFixed(2)} (${sheet().colW[drag.c]} ピクセル)`); return; }
  if (drag.t === 'resizeR') { const Z = zoom(); sheet().rowH[drag.r] = Math.max(4, Math.round(drag.h + (y - drag.y) / Z)); applySizes(); paintSel(); showSizeTip(x, y, `高さ: ${(sheet().rowH[drag.r] * .75).toFixed(2)} (${sheet().rowH[drag.r]} ピクセル)`); return; }
  const h = hitAt(x, y); if (!h) return;
  if (drag.t === 'cell' && h.td) { if (ext.r !== h.r || ext.c !== h.c) { ext = { r: h.r, c: h.c }; updateSel(); } }
  else if (drag.t === 'col') { ext = { r: ROWS - 1, c: h.c }; act = { r: 0, c: drag.a }; updateSel(); }
  else if (drag.t === 'row') { ext = { r: h.r, c: COLS - 1 }; updateSel(); }
  else if (drag.t === 'move' && h.td) {
    const R = drag.R;
    let dr = h.r - drag.grab.r, dc = h.c - drag.grab.c;
    dr = Math.max(-R.r0, Math.min(ROWS - 1 - R.r1, dr)); dc = Math.max(-R.c0, Math.min(COLS - 1 - R.c1, dc));
    drag.dr = dr; drag.dc = dc; if (dr || dc) drag.moved = true;
    const D = { r0: R.r0 + dr, r1: R.r1 + dr, c0: R.c0 + dc, c1: R.c1 + dc };
    if (dr || dc) { showPick(D); nameBox.value = rangeName(D); } else hidePick();
  }
  else if (drag.t === 'pick' && h.td) {
    const a = drag.a, R = expandRect({ r0: Math.min(a.r, h.r), r1: Math.max(a.r, h.r), c0: Math.min(a.c, h.c), c1: Math.max(a.c, h.c) });
    insertRef(drag.inp, rangeName(R)); showPick(R);
  } else if (drag.t === 'fill' && h.td) {
    const R = rect(); let to = null;
    const dd = h.r - R.r1, du = R.r0 - h.r, dr = h.c - R.c1, dl = R.c0 - h.c;
    const best = Math.max(dd, du, dr, dl);
    if (best > 0) {
      if (best === dd) { to = { dir: 'd', n: h.r }; showPick({ ...R, r1: h.r }); }
      else if (best === du) { to = { dir: 'u', n: h.r }; showPick({ ...R, r0: h.r }); }
      else if (best === dr) { to = { dir: 'r', n: h.c }; showPick({ ...R, c1: h.c }); }
      else { to = { dir: 'l', n: h.c }; showPick({ ...R, c0: h.c }); }
    } else hidePick();
    drag.to = to;
  }
}
let sizeTip = null;
function showSizeTip(x, y, t) { if (!sizeTip) { sizeTip = document.createElement('div'); sizeTip.className = 'tip'; document.body.appendChild(sizeTip); } sizeTip.textContent = t; sizeTip.style.left = x + 12 + 'px'; sizeTip.style.top = y - 30 + 'px'; sizeTip.hidden = false; }
document.addEventListener('mousemove', e => {
  if (!drag) return;
  lastMouse = { x: e.clientX, y: e.clientY };
  dragMove(e.clientX, e.clientY);
  if (['cell', 'pick', 'fill', 'col', 'row', 'move'].includes(drag.t)) {
    const wr = wrap.getBoundingClientRect();
    const dx = e.clientX > wr.right - 20 ? 20 : e.clientX < wr.left + 50 ? -20 : 0;
    const dy = e.clientY > wr.bottom - 20 ? 20 : e.clientY < wr.top + 30 ? -20 : 0;
    clearInterval(autoScroll);
    if (dx || dy) autoScroll = setInterval(() => { wrap.scrollLeft += dx; wrap.scrollTop += dy; if (lastMouse) dragMove(Math.min(Math.max(lastMouse.x, wr.left + 50), wr.right - 22), Math.min(Math.max(lastMouse.y, wr.top + 30), wr.bottom - 22)); }, 50);
  }
});
document.addEventListener('mouseup', e => {
  clearInterval(autoScroll);
  if (!drag || drag.touch) return;
  const d = drag; drag = null;
  if (d.t === 'move') { hidePick(); if (d.moved && (d.dr || d.dc)) moveRange(d.R, d.dr, d.dc, e.ctrlKey || e.metaKey); else updateSel(); return; }
  if (sizeTip) sizeTip.hidden = true;
  if (d.t === 'resize' || d.t === 'resizeR') finishResize(d);
  if (d.t === 'fill') { hidePick(); if (d.to) applyFill(d.to); focusNav(); }
  if (d.t === 'pick') { hidePick(); }
  if (d.t === 'cell') { updateSel(); if (App.painter) App.cmd('painterApply'); }
});
function finishResize(d) {
  const R = rect(), sh = sheet();
  if (d.t === 'resize' && R.r0 === 0 && R.r1 === ROWS - 1 && d.c >= R.c0 && d.c <= R.c1) for (let c = R.c0; c <= R.c1; c++) sh.colW[c] = sh.colW[d.c];
  if (d.t === 'resizeR' && R.c0 === 0 && R.c1 === COLS - 1 && d.r >= R.r0 && d.r <= R.r1) for (let r = R.r0; r <= R.r1; r++) sh.rowH[r] = sh.rowH[d.r];
  undoS.push(d.snap); redoS.length = 0; afterChange();
}
/* ================= セルの移動（ドラッグで移動） ================= */
function moveRange(R, dr, dc, copy) {
  if (!dr && !dc) return;
  const sh = sheet(), si = book.cur;
  const D = { r0: R.r0 + dr, r1: R.r1 + dr, c0: R.c0 + dc, c1: R.c1 + dc };
  if (D.r0 < 0 || D.c0 < 0 || D.r1 >= ROWS || D.c1 >= COLS) return;
  const inR = (r, c) => r >= R.r0 && r <= R.r1 && c >= R.c0 && c <= R.c1;
  let occupied = false;
  eachIn(D, (r, c) => { if (!inR(r, c) && hasValue(sh, r, c)) occupied = true; });
  const run = () => commit(() => {
    const src = {};
    eachIn(R, (r, c) => { const x = sh.cells[keyOf(r, c)]; src[keyOf(r, c)] = x ? JSON.parse(JSON.stringify(x)) : null; });
    const srcMerges = sh.merges.filter(m => m.r0 >= R.r0 && m.r1 <= R.r1 && m.c0 >= R.c0 && m.c1 <= R.c1);
    if (!copy) eachIn(R, (r, c) => delete sh.cells[keyOf(r, c)]);
    eachIn(R, (r, c) => {
      const x = src[keyOf(r, c)], k = keyOf(r + dr, c + dc);
      if (!x) { delete sh.cells[k]; return; }
      if (copy && isFormula(x.v)) x.v = engine.shiftFormula(x.v, dr, dc);
      sh.cells[k] = x;
    });
    sh.merges = sh.merges.filter(m => (!copy && srcMerges.includes(m)) ? false : (m.r1 < D.r0 || m.r0 > D.r1 || m.c1 < D.c0 || m.c0 > D.c1));
    for (const m of srcMerges) { sh.merges.push({ r0: m.r0 + dr, r1: m.r1 + dr, c0: m.c0 + dc, c1: m.c1 + dc }); if (copy) sh.merges.push(m); }
    if (!copy) {
      // 移動したセルを参照している数式も一緒に書き換える（Excel と同じ）
      book.sheets.forEach((s2, idx) => {
        for (const cell of Object.values(s2.cells)) if (isFormula(cell.v)) {
          cell.v = engine.mapRefs(cell.v, (shn, a, b2) => {
            const t = shn ? sheetIdx(shn) : idx; if (t !== si || a.full) return undefined;
            const mv = p => ({ ...p, r: p.r + dr, c: p.c + dc });
            if (b2) return inR(a.r, a.c) && inR(b2.r, b2.c) ? { a: mv(a), b: mv(b2) } : undefined;
            return inR(a.r, a.c) ? { a: mv(a), b: null } : undefined;
          });
        }
      });
    }
    act = { r: act.r + dr, c: act.c + dc }; ext = { r: ext.r + dr, c: ext.c + dc };
    if (clip) clip = null;
  });
  if (occupied) App.confirm('ここにはすでにデータがあります。置き換えますか?', run, { ok: '置き換える' }); else run();
}
App.moveRange = moveRange;

/* ================= タッチ操作 ================= */
// ・タップ位置そのもので判定する（ブラウザによる「近くの要素への補正」を使わない）
// ・選択中のセルをもう一度タップ → 操作バー、ダブルタップ → 編集
// ・長押しして指を動かす → セルの移動、そのまま離す → 操作バー
// ・2本指でピンチ → ズーム
const abar = document.createElement('div'); abar.id = 'abar'; abar.hidden = true; document.body.appendChild(abar);
function hideActionBar() { abar.hidden = true; }
App.hideActionBar = hideActionBar;
function showActionBar() {
  if (editing) return;
  const R = rect(), b = rangeRectPx(R), wr = wrap.getBoundingClientRect();
  const left = wr.left + b.x - wrap.scrollLeft, top = wr.top + b.y - wrap.scrollTop;
  const items = [['edit', '編集'], ['cut', '切り取り'], ['copy', 'コピー'], ['paste', '貼り付け'], ['clear', '消去'], ['more', '…']];
  abar.innerHTML = items.map(([k, l]) => `<button data-a="${k}"${k === 'paste' && clip ? ' class="hot"' : ''}>${l}</button>`).join('');
  abar.hidden = false;
  const w = abar.offsetWidth, h = abar.offsetHeight;
  let x = Math.max(6, Math.min(innerWidth - w - 6, left + Math.min(b.w, wr.width) / 2 - w / 2));
  let y = top - h - 10;
  if (y < wr.top + 2) y = Math.min(innerHeight - h - 6, top + Math.min(b.h, wr.height) + 10);
  abar.style.left = x + 'px'; abar.style.top = Math.max(wr.top + 2, y) + 'px';
}
App.showActionBar = showActionBar;
abar.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const k = b.dataset.a, r = abar.getBoundingClientRect();
  hideActionBar();
  if (k === 'edit') { if (startEdit('edit', rawForEdit(act))) { editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); } }
  else if (k === 'clear') clearRange('contents');
  else if (k === 'more') App.showCellMenu(r.left, r.bottom + 4, isSingle(rect()) || !(rect().r0 === 0 && rect().r1 === ROWS - 1) ? (rect().c0 === 0 && rect().c1 === COLS - 1 ? 'row' : 'cell') : 'col');
  else App.cmd(k);
});
wrap.addEventListener('scroll', hideActionBar, { passive: true });
function handleTap(x, y, target) {
  App.hideMenus && App.hideMenus();
  hideActionBar();
  if (target && target.closest && target.closest('th.corner')) { if (editing && !commitEdit(0, 0)) return; select({ r: 0, c: 0 }, { r: ROWS - 1, c: COLS - 1 }, true); act = { r: 0, c: 0 }; updateSel(); return; }
  const h = hitAt(x, y); if (!h) return;
  if (editing) {
    const inp = curInput();
    if (h.td && canInsertRef(inp)) { insertRef(inp, keyOf(h.r, h.c)); showPick({ r0: h.r, r1: h.r, c0: h.c, c1: h.c }); return; }
    if (!commitEdit(0, 0)) return;
  }
  App.chartSel = null;
  const now = Date.now();
  if (h.td) {
    const a = anchorOf(h), R = rect();
    const same = a.r === act.r && a.c === act.c;
    if (same && isSingle(R) && now - lastTap.t < 380 && lastTap.r === h.r && lastTap.c === h.c) {
      lastTap = { t: 0, r: -1, c: -1 };
      if (startEdit('edit', rawForEdit(act))) { editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); }
      return;
    }
    lastTap = { t: now, r: h.r, c: h.c };
    const inside = h.r >= R.r0 && h.r <= R.r1 && h.c >= R.c0 && h.c <= R.c1;
    if ((same && isSingle(R)) || (inside && !isSingle(R))) { showActionBar(); return; }
    act = { r: a.r, c: a.c }; ext = { r: h.r, c: h.c }; updateSel();
    if (App.painter) App.cmd('painterApply');
  } else if (h.col) {
    const R = rect();
    if (R.r0 === 0 && R.r1 === ROWS - 1 && h.c >= R.c0 && h.c <= R.c1) { showActionBar(); return; }
    select({ r: 0, c: h.c }, { r: ROWS - 1, c: h.c }, true); act = { r: 0, c: h.c }; updateSel();
  } else if (h.row) {
    const R = rect();
    if (R.c0 === 0 && R.c1 === COLS - 1 && h.r >= R.r0 && h.r <= R.r1) { showActionBar(); return; }
    select({ r: h.r, c: 0 }, { r: h.r, c: COLS - 1 }, true); act = { r: h.r, c: 0 }; updateSel();
  }
}
let lp = null, tap = null, multi = false;
// ピンチ操作で画面やシートの大きさが変わらないようにする
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
wrap.addEventListener('touchstart', e => {
  clearTimeout(lp && lp.timer); lp = null;
  if (e.touches.length === 2) {
    tap = null;
    if (drag && drag.touch && drag.t !== 'resize' && drag.t !== 'resizeR') { drag = null; hidePick(); }
    multi = true;
    hideActionBar(); e.preventDefault(); return;
  }
  if (e.touches.length !== 1) return;
  const t = e.touches[0], el = e.target;
  if (!el.closest || el === editor || el.closest('.chart,.fbtn,.dvbtn')) return;
  if (el.id === 'fh' && !editing) { e.preventDefault(); hideActionBar(); drag = { t: 'cell', touch: true }; return; }
  const eh = edgeHit(el, t.clientX, t.clientY, 8);
  if (eh) {
    e.preventDefault(); hideActionBar();
    drag = eh.t === 'resize' ? { t: 'resize', c: eh.c, x: t.clientX, w: sheet().colW[eh.c] || DEFW, snap: snapshot(), touch: true }
      : { t: 'resizeR', r: eh.r, y: t.clientY, h: sheet().rowH[eh.r] || DEFH, snap: snapshot(), touch: true };
    return;
  }
  if (!el.closest('#grid td,#grid th')) return;
  tap = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false, el };
  if (editing) return;
  lp = { x: t.clientX, y: t.clientY, fired: false };
  lp.timer = setTimeout(() => {
    if (!tap || tap.moved || !lp) return;
    const h = hitAt(lp.x, lp.y); if (!h) return;
    const R = rect(), inside = h.r >= R.r0 && h.r <= R.r1 && h.c >= R.c0 && h.c <= R.c1;
    if (h.col && !inside) select({ r: 0, c: h.c }, { r: ROWS - 1, c: h.c }, true);
    else if (h.row && !inside) select({ r: h.r, c: 0 }, { r: h.r, c: COLS - 1 }, true);
    else if (h.td && !inside) select({ r: h.r, c: h.c }, null, true);
    lp.fired = true;
    hideActionBar();
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (err) { /* 無視 */ }
    if (h.td) {
      const R2 = rect();
      drag = { t: 'move', touch: true, R: R2, grab: { r: Math.min(Math.max(h.r, R2.r0), R2.r1), c: Math.min(Math.max(h.c, R2.c0), R2.c1) }, dr: 0, dc: 0, moved: false };
      wrap.classList.add('lifting');
      showPick(R2);
      App.toast && App.toast('指を動かすと、選んだセルを移動できます');
    }
  }, 450);
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (multi || e.touches.length > 1) { if (e.cancelable) e.preventDefault(); return; }
  const t = e.touches[0];
  if (tap && !tap.moved && Math.abs(t.clientX - tap.x) + Math.abs(t.clientY - tap.y) > 8) { tap.moved = true; hideActionBar(); }
  if (lp && !lp.fired && tap && tap.moved) { clearTimeout(lp.timer); lp = null; }
  if (!drag || !drag.touch) return;
  e.preventDefault();
  dragMove(t.clientX, t.clientY);
  if (drag.t === 'move') {
    const wr = wrap.getBoundingClientRect();
    if (t.clientY > wr.bottom - 30) wrap.scrollTop += 12; else if (t.clientY < wr.top + 40) wrap.scrollTop -= 12;
    if (t.clientX > wr.right - 30) wrap.scrollLeft += 12; else if (t.clientX < wr.left + 50) wrap.scrollLeft -= 12;
  }
}, { passive: false });
document.addEventListener('touchend', e => {
  if (multi) { if (!e.touches.length) multi = false; return; }
  const tp = tap, l = lp;
  tap = null; if (l) clearTimeout(l.timer); lp = null;
  if (drag && drag.touch) {
    const d = drag; drag = null;
    if (sizeTip) sizeTip.hidden = true;
    wrap.classList.remove('lifting');
    if (e.cancelable) e.preventDefault();
    if (d.t === 'cell') { updateSel(); return; }
    if (d.t === 'move') { hidePick(); if (d.moved && (d.dr || d.dc)) moveRange(d.R, d.dr, d.dc, false); else { updateSel({ keepBar: true }); showActionBar(); } return; }
    finishResize(d); return;
  }
  if (l && l.fired) { if (e.cancelable) e.preventDefault(); updateSel({ keepBar: true }); showActionBar(); return; }
  if (tp && !tp.moved && Date.now() - tp.t < 700) { if (e.cancelable) e.preventDefault(); handleTap(tp.x, tp.y, tp.el); }
}, { passive: false });
/* メモのホバー表示 */
let noteTip = null;
wrap.addEventListener('mouseover', e => {
  if (book.view.notes) return;
  const td = e.target.closest && e.target.closest('#grid td.note');
  if (!td) { if (noteTip) noteTip.hidden = true; return; }
  const p = tdPos(td), cell = sheet().cells[keyOf(p.r, p.c)];
  if (!cell || !cell.note) return;
  if (!noteTip) { noteTip = document.createElement('div'); noteTip.className = 'notebox'; wrap.appendChild(noteTip); }
  const b = cellRectPx(p.r, p.c);
  noteTip.innerHTML = esc(cell.note); noteTip.hidden = false;
  noteTip.style.left = b.x + b.w + 8 + 'px'; noteTip.style.top = b.y + 'px';
});
wrap.addEventListener('mouseleave', () => { if (noteTip) noteTip.hidden = true; });
let noteBoxes = [];
function renderNotes() {
  noteBoxes.forEach(n => n.remove()); noteBoxes = [];
  if (!book.view.notes) return;
  for (const [k, cell] of Object.entries(sheet().cells)) {
    if (!cell.note) continue;
    const p = parseKey(k); if (!p || isRowHidden(p.r)) continue;
    const b = cellRectPx(p.r, p.c), n = document.createElement('div');
    n.className = 'notebox'; n.innerHTML = esc(cell.note);
    n.style.left = b.x + b.w + 8 + 'px'; n.style.top = b.y + 'px';
    wrap.appendChild(n); noteBoxes.push(n);
  }
}
/* 入力規則のドロップダウン */
let dvBtn = null;
function placeDv() {
  const cell = sheet().cells[keyOf(act.r, act.c)];
  if (!cell || !cell.dv || cell.dv.type !== 'list' || editing || App.chartSel != null) { if (dvBtn) dvBtn.hidden = true; return; }
  if (!dvBtn) {
    dvBtn = document.createElement('button'); dvBtn.className = 'dvbtn'; dvBtn.innerHTML = window.ICONS.ddArrow; wrap.appendChild(dvBtn);
    dvBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); App.showDvMenu(dvBtn); });
  }
  const b = cellRectPx(act.r, act.c);
  Object.assign(dvBtn.style, { left: b.x + b.w + 1 + 'px', top: b.y + 'px', height: b.h + 'px' });
  dvBtn.hidden = false;
}

/* ================= クリア・フィル ================= */
function clearRange(what, R) {
  if (editing) commitEdit(0, 0);
  R = R || rect();
  return commit(() => {
    const sh = sheet();
    eachIn(R, (r, c) => {
      const k = keyOf(r, c), x = sh.cells[k]; if (!x) return;
      if (what === 'all') delete sh.cells[k];
      else if (what === 'contents') { delete x.v; cleanCell(sh, k); }
      else if (what === 'formats') { for (const p of Object.keys(x)) if (!['v', 'note', 'dv'].includes(p)) delete x[p]; cleanCell(sh, k); }
      else if (what === 'notes') { delete x.note; cleanCell(sh, k); }
    });
    if (what === 'all' || what === 'formats') sh.cf = sh.cf.filter(f => !(f.r0 >= R.r0 && f.r1 <= R.r1 && f.c0 >= R.c0 && f.c1 <= R.c1));
    if (what === 'all') sh.merges = sh.merges.filter(m => !(m.r0 >= R.r0 && m.r1 <= R.r1 && m.c0 >= R.c0 && m.c1 <= R.c1));
  });
}
App.clearRange = clearRange;
function copyCell(sh, sr, sc, r, c, dst) {
  dst = dst || sh;
  const src = sh.cells[keyOf(sr, sc)], k = keyOf(r, c);
  if (!src) { delete dst.cells[k]; return; }
  const n = JSON.parse(JSON.stringify(src));
  if (isFormula(n.v)) n.v = engine.shiftFormula(n.v, r - sr, c - sc);
  dst.cells[k] = n;
}
App.copyCell = copyCell;
const LISTS = [
  ['日', '月', '火', '水', '木', '金', '土'], ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
  ['睦月', '如月', '弥生', '卯月', '皐月', '水無月', '文月', '葉月', '長月', '神無月', '霜月', '師走'],
  ['第一四半期', '第二四半期', '第三四半期', '第四四半期'],
];
function seriesFn(sh, keys) {
  const cells = keys.map(k => sh.cells[k]);
  if (cells.some(c => !c || c.v == null || isFormula(c.v))) return null;
  const raws = cells.map(c => String(c.v));
  const nums = raws.map(v => E.parseInput(v));
  const isDate = cells[0].fmt && /date|ldate|md|datetime/.test(cells[0].fmt);
  if (nums.every(p => typeof p.v === 'number')) {
    if (keys.length === 1 && !isDate) return null;
    const v = nums.map(p => p.v), st = keys.length === 1 ? 1 : (v[v.length - 1] - v[0]) / (v.length - 1);
    const fmtOut = n => isDate ? (() => { const t = E.fromSerial(n); return `${t.y}/${t.m}/${t.d}`; })() : E.fmtGeneral(E.roundTo(n, 10));
    return i => fmtOut(v[0] + st * i);
  }
  for (const L of LISTS) {
    const idx = raws.map(v => L.indexOf(v));
    if (idx.every(i => i >= 0)) {
      const st = keys.length === 1 ? 1 : (((idx[idx.length - 1] - idx[0]) / (idx.length - 1)) || 1);
      return i => L[(((idx[0] + st * i) % L.length) + L.length) % L.length];
    }
  }
  const ms = raws.map(v => /^(.*?)(\d+)(\D*)$/.exec(v));
  if (ms.every(m => m) && ms.every(m => m[1] === ms[0][1] && m[3] === ms[0][3])) {
    const ns = ms.map(m => +m[2]), st = keys.length === 1 ? 1 : (ns[ns.length - 1] - ns[0]) / (ns.length - 1);
    const w = ms[0][2].length;
    return i => { const n = Math.round(ns[0] + st * i); return ms[0][1] + (ms[0][2].startsWith('0') ? String(Math.abs(n)).padStart(w, '0') : n) + ms[0][3]; };
  }
  return null;
}
function applyFill(to, noSeries) {
  const R = rect();
  commit(() => {
    const sh = sheet();
    if (to.dir === 'd' || to.dir === 'u') {
      const h = R.r1 - R.r0 + 1;
      for (let c = R.c0; c <= R.c1; c++) {
        const keys = []; for (let r = R.r0; r <= R.r1; r++) keys.push(keyOf(r, c));
        const ser = noSeries ? null : seriesFn(sh, keys);
        if (to.dir === 'd') for (let r = R.r1 + 1; r <= to.n; r++) { const sr = R.r0 + (r - R.r1 - 1) % h; copyCell(sh, sr, c, r, c); if (ser) sh.cells[keyOf(r, c)].v = ser(r - R.r0); }
        else for (let r = R.r0 - 1; r >= to.n; r--) { const sr = R.r1 - (R.r0 - 1 - r) % h; copyCell(sh, sr, c, r, c); if (ser) sh.cells[keyOf(r, c)].v = ser(r - R.r0); }
      }
      if (to.dir === 'd') ext = { r: to.n, c: R.c1 }; else { act = { r: to.n, c: R.c0 }; ext = { r: R.r1, c: R.c1 }; return; }
    } else {
      const w = R.c1 - R.c0 + 1;
      for (let r = R.r0; r <= R.r1; r++) {
        const keys = []; for (let c = R.c0; c <= R.c1; c++) keys.push(keyOf(r, c));
        const ser = noSeries ? null : seriesFn(sh, keys);
        if (to.dir === 'r') for (let c = R.c1 + 1; c <= to.n; c++) { const sc = R.c0 + (c - R.c1 - 1) % w; copyCell(sh, r, sc, r, c); if (ser) sh.cells[keyOf(r, c)].v = ser(c - R.c0); }
        else for (let c = R.c0 - 1; c >= to.n; c--) { const sc = R.c1 - (R.c0 - 1 - c) % w; copyCell(sh, r, sc, r, c); if (ser) sh.cells[keyOf(r, c)].v = ser(c - R.c0); }
      }
      if (to.dir === 'r') ext = { r: R.r1, c: to.n }; else { act = { r: R.r0, c: to.n }; ext = { r: R.r1, c: R.c1 }; return; }
    }
    act = { r: R.r0, c: R.c0 };
  });
}
App.applyFill = applyFill;
App.fillDir = dir => {
  if (editing) commitEdit(0, 0);
  const R = rect(), sh = sheet();
  commit(() => {
    if (dir === 'd') { const src = R.r0 === R.r1 ? R.r0 - 1 : R.r0; if (src < 0) return false; for (let c = R.c0; c <= R.c1; c++) for (let r = Math.max(R.r0, src + 1); r <= R.r1; r++) copyCell(sh, src, c, r, c); }
    if (dir === 'u') { const src = R.r0 === R.r1 ? R.r1 + 1 : R.r1; if (src >= ROWS) return false; for (let c = R.c0; c <= R.c1; c++) for (let r = R.r0; r <= Math.min(R.r1, src - 1); r++) copyCell(sh, src, c, r, c); }
    if (dir === 'r') { const src = R.c0 === R.c1 ? R.c0 - 1 : R.c0; if (src < 0) return false; for (let r = R.r0; r <= R.r1; r++) for (let c = Math.max(R.c0, src + 1); c <= R.c1; c++) copyCell(sh, r, src, r, c); }
    if (dir === 'l') { const src = R.c0 === R.c1 ? R.c1 + 1 : R.c1; if (src >= COLS) return false; for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= Math.min(R.c1, src - 1); c++) copyCell(sh, r, src, r, c); }
  });
};
App.fillDownAuto = () => {
  const R = rect(), sh = sheet();
  let n = -1;
  for (const c of [R.c0 - 1, R.c1 + 1]) {
    if (c < 0 || c >= COLS || !hasValue(sh, R.r1 + 1, c)) continue;
    let r = R.r1 + 1; while (r + 1 < ROWS && hasValue(sh, r + 1, c)) r++;
    n = Math.max(n, r);
  }
  if (n > R.r1) applyFill({ dir: 'd', n });
};

/* ================= コピー・貼り付け ================= */
function doCopy(cut) {
  if (editing) return null;
  const R = rect(), sh = sheet(), cells = [], vals = [], lines = [];
  for (let r = R.r0; r <= R.r1; r++) {
    if (isRowHidden(r) && !cut) continue;
    const row = [], vr = [], txt = [];
    for (let c = R.c0; c <= R.c1; c++) {
      const cell = sh.cells[keyOf(r, c)];
      row.push(cell ? JSON.parse(JSON.stringify(cell)) : null);
      const v = cell ? val(book.cur, r, c) : null;
      vr.push(v);
      let t = cell ? displayText(book.cur, r, c) : '';
      if (/[\t\n"]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      txt.push(t);
    }
    cells.push(row); vals.push(vr); lines.push(txt.join('\t'));
  }
  const merges = sh.merges.filter(m => m.r0 >= R.r0 && m.r1 <= R.r1 && m.c0 >= R.c0 && m.c1 <= R.c1).map(m => ({ r0: m.r0 - R.r0, r1: m.r1 - R.r0, c0: m.c0 - R.c0, c1: m.c1 - R.c0 }));
  const html = buildHtmlClip(R);
  clip = { si: book.cur, R, cells, vals, text: lines.join('\n'), html, cut, merges };
  App.toast && App.toast(cut ? '切り取りました。移動先を選んでください' : 'コピーしました。貼り付けたい場所を選んでください');
  updateSel();
  return clip;
}
App.doCopy = doCopy;
App.getClip = () => clip;
function buildHtmlClip(R) {
  let h = '<table>';
  for (let r = R.r0; r <= R.r1; r++) {
    if (isRowHidden(r)) continue;
    h += '<tr>';
    for (let c = R.c0; c <= R.c1; c++) {
      const td = tds[r][c];
      if (td._cov) continue;
      const st = td.style.cssText.replace(/box-shadow:[^;]*;?/g, '').replace(/position:[^;]*;?/g, '');
      h += `<td${td.colSpan > 1 ? ` colspan="${td.colSpan}"` : ''}${td.rowSpan > 1 ? ` rowspan="${td.rowSpan}"` : ''} style="${esc(st)}">${esc(displayText(book.cur, r, c))}</td>`;
    }
    h += '</tr>';
  }
  return h + '</table>';
}
function parseDelim(text, d) {
  const rows = []; let row = [], f = '', q = false, i = 0;
  text = text.replace(/\r\n?/g, '\n');
  while (i < text.length) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += ch; i++; continue; }
    if (ch === '"' && f === '') { q = true; i++; continue; }
    if (ch === d) { row.push(f); f = ''; i++; continue; }
    if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += ch; i++;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
App.parseDelim = parseDelim;
const norm = t => t.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
function pasteText(text) {
  setTimeout(() => App.toast && App.toast('貼り付けました'), 0);
  if (clip && norm(text) === norm(clip.text)) return pasteInternal('all');
  const data = parseDelim(text, '\t'); if (!data.length) return;
  const R = rect();
  commit(() => {
    if (data.length === 1 && data[0].length === 1 && !isSingle(R)) { eachIn(R, (r, c) => setCellRaw(r, c, data[0][0])); return; }
    data.forEach((row, i) => row.forEach((v, j) => { const p = { r: R.r0 + i, c: R.c0 + j }; if (p.r < ROWS && p.c < COLS) setCellRaw(p.r, p.c, v); }));
    act = { r: R.r0, c: R.c0 }; ext = clampP({ r: R.r0 + data.length - 1, c: R.c0 + Math.max(...data.map(r => r.length)) - 1 });
  });
}
App.pasteText = pasteText;
function pasteInternal(mode) {
  setTimeout(() => App.toast && App.toast({ values: '値を貼り付けました', formats: '書式を貼り付けました', formulas: '数式を貼り付けました', transpose: '行と列を入れ替えて貼り付けました' }[mode] || '貼り付けました'), 0);
  const cl = clip; if (!cl || !book.sheets[cl.si]) { clip = null; return; }
  const R = rect();
  const h = cl.cells.length, w = cl.cells[0].length;
  const tr = mode === 'transpose';
  const H = tr ? w : h, W = tr ? h : w;
  let reps = 1, repsC = 1;
  if (!isSingle(R) && !cl.cut && (R.r1 - R.r0 + 1) % H === 0 && (R.c1 - R.c0 + 1) % W === 0) { reps = (R.r1 - R.r0 + 1) / H; repsC = (R.c1 - R.c0 + 1) / W; }
  commit(() => {
    const sh = sheet(), src = book.sheets[cl.si];
    if (cl.cut) {
      eachIn(cl.R, (r, c) => delete src.cells[keyOf(r, c)]);
      src.merges = src.merges.filter(m => !(m.r0 >= cl.R.r0 && m.r1 <= cl.R.r1 && m.c0 >= cl.R.c0 && m.c1 <= cl.R.c1));
    }
    for (let ri = 0; ri < reps; ri++) for (let ci = 0; ci < repsC; ci++) {
      const br = R.r0 + ri * H, bc = R.c0 + ci * W;
      cl.cells.forEach((row, i) => row.forEach((cell, j) => {
        const p = tr ? { r: br + j, c: bc + i } : { r: br + i, c: bc + j }; if (p.r >= ROWS || p.c >= COLS) return;
        const k = keyOf(p.r, p.c), cur = sh.cells[k];
        if (mode === 'values') {
          const v = cl.vals[i][j];
          const n = cur ? { ...cur } : {};
          if (v == null || v === '') delete n.v; else n.v = isErr(v) ? v.code : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(v) : (/^[=＝]/.test(v) ? "'" + v : v);
          if (cell && cell.fmt && !n.fmt) n.fmt = cell.fmt;
          sh.cells[k] = n; cleanCell(sh, k); return;
        }
        if (mode === 'formats') {
          const n = cell ? JSON.parse(JSON.stringify(cell)) : {};
          delete n.v; delete n.note;
          if (cur && cur.v != null) n.v = cur.v;
          sh.cells[k] = n; cleanCell(sh, k); return;
        }
        if (mode === 'formulas') {
          const n = cur ? { ...cur } : {};
          if (!cell || cell.v == null) delete n.v; else n.v = isFormula(cell.v) ? engine.shiftFormula(cell.v, p.r - (cl.R.r0 + i), p.c - (cl.R.c0 + j)) : cell.v;
          sh.cells[k] = n; cleanCell(sh, k); return;
        }
        if (!cell) { delete sh.cells[k]; return; }
        const n = JSON.parse(JSON.stringify(cell));
        if (!cl.cut && isFormula(n.v)) n.v = engine.shiftFormula(n.v, p.r - (cl.R.r0 + i), p.c - (cl.R.c0 + j));
        sh.cells[k] = n;
      }));
      if (mode === 'all' && !tr) for (const m of cl.merges) {
        const nm = { r0: br + m.r0, r1: br + m.r1, c0: bc + m.c0, c1: bc + m.c1 };
        if (nm.r1 < ROWS && nm.c1 < COLS) { sh.merges = sh.merges.filter(x => x.r1 < nm.r0 || x.r0 > nm.r1 || x.c1 < nm.c0 || x.c0 > nm.c1); sh.merges.push(nm); }
      }
    }
    act = { r: R.r0, c: R.c0 }; ext = clampP({ r: R.r0 + H * reps - 1, c: R.c0 + W * repsC - 1 });
    if (cl.cut) clip = null;
  });
}
App.pasteInternal = pasteInternal;
const navTarget = t => !editing && (t === editor || t === document.body || t === wrap || (t && t.closest && t.closest('#wrap') && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA'));
document.addEventListener('copy', e => {
  if (App.chartSel != null) return;
  if (!navTarget(e.target)) return; e.preventDefault();
  const c = doCopy(false); if (!c) return;
  e.clipboardData.setData('text/plain', c.text); e.clipboardData.setData('text/html', c.html);
});
document.addEventListener('cut', e => {
  if (!navTarget(e.target)) return; e.preventDefault();
  const c = doCopy(true); if (!c) return;
  e.clipboardData.setData('text/plain', c.text); e.clipboardData.setData('text/html', c.html);
});
document.addEventListener('paste', e => {
  if (!navTarget(e.target)) return; e.preventDefault();
  pasteText(e.clipboardData.getData('text/plain')); resetNav();
});

/* ================= 行・列の挿入/削除 ================= */
function adjustRect(R, axis, at, n, insert, band, lim) {
  const lo = axis === 'r' ? 'r0' : 'c0', hi = axis === 'r' ? 'r1' : 'c1';
  const olo = axis === 'r' ? 'c0' : 'r0', ohi = axis === 'r' ? 'c1' : 'r1';
  if (band && (R[olo] < band.lo || R[ohi] > band.hi)) { if (R[ohi] < band.lo || R[olo] > band.hi) return R; return insert || R[hi] < at ? R : R; }
  const X = { ...R };
  if (insert) {
    if (X[lo] >= at) X[lo] += n;
    if (X[hi] >= at) X[hi] += n;
    if (X[lo] >= lim) return null;
    X[hi] = Math.min(X[hi], lim - 1);
    return X;
  }
  const end = at + n;
  const nlo = X[lo] < at ? X[lo] : X[lo] >= end ? X[lo] - n : at;
  const nhi = X[hi] < at ? X[hi] : X[hi] >= end ? X[hi] - n : at - 1;
  if (nhi < nlo) return null;
  X[lo] = nlo; X[hi] = nhi;
  return X;
}
function structural(axis, at, n, insert, band) {
  if (editing) commitEdit(0, 0);
  const si = book.cur, lim = axis === 'r' ? ROWS : COLS, other = axis === 'r' ? 'c' : 'r';
  const inBand = q => !band || (q >= band.lo && q <= band.hi);
  const shiftV = v => insert ? (v >= at ? v + n : v) : (v >= at && v < at + n ? null : v >= at + n ? v - n : v);
  if (insert) {
    // はみ出すデータの確認
    const sh = sheet();
    for (const k of Object.keys(sh.cells)) { const p = parseKey(k); if (p && p[axis] >= lim - n && inBand(p[other]) && hasValue(sh, p.r, p.c)) { App.alert('空ではないセルがワークシートの外に押し出されるため、挿入できません。'); return false; } }
  }
  if (!band && sheet().merges.some(m => !insert ? false : (m[axis + '0'] < at && m[axis + '1'] >= at && false))) { /* 結合セルは伸縮 */ }
  return commit(() => {
    book.sheets.forEach((s, idx) => {
      for (const cell of Object.values(s.cells)) if (isFormula(cell.v)) {
        cell.v = engine.mapRefs(cell.v, (shn, a, b) => {
          const t = shn ? sheetIdx(shn) : idx; if (t !== si) return undefined;
          const A = { ...a }, B = b ? { ...b } : null;
          if (B) {
            const R = { r0: Math.min(A.r, B.r), r1: Math.max(A.r, B.r), c0: Math.min(A.c, B.c), c1: Math.max(A.c, B.c) };
            if (A.full && axis === 'r') return undefined;
            if (band && (R[other + '0'] < band.lo || R[other + '1'] > band.hi)) return undefined;
            const X = adjustRect(R, axis, at, n, insert, null, lim);
            if (!X) return null;
            A[axis] = X[axis + '0']; B[axis] = X[axis + '1'];
            return { a: A, b: B };
          }
          if (!inBand(A[other])) return undefined;
          const v = shiftV(A[axis]); if (v == null || v >= lim) return null;
          A[axis] = v; return { a: A, b: null };
        });
      }
    });
    const sh = book.sheets[si], cells = {};
    for (const [k, cell] of Object.entries(sh.cells)) {
      const p = parseKey(k); if (!p) continue;
      if (!inBand(p[other])) { cells[k] = cell; continue; }
      const v = shiftV(p[axis]); if (v == null || v >= lim) continue;
      p[axis] = v; cells[keyOf(p.r, p.c)] = cell;
    }
    sh.cells = cells;
    const adj = R => adjustRect(R, axis, at, n, insert, band, lim);
    sh.merges = sh.merges.map(adj).filter(m => m && (m.r1 > m.r0 || m.c1 > m.c0));
    sh.cf = sh.cf.map(f => { const X = adj(f); return X ? Object.assign(f, X) : null; }).filter(Boolean);
    if (sh.filter) { const X = adj({ r0: sh.filter.r0, r1: sh.filter.r1 || sh.filter.r0, c0: sh.filter.c0, c1: sh.filter.c1 }); if (!X) sh.filter = null; else { if (axis === 'c' && !insert && sh.filter.crit) { const nc = {}; for (const [c, v] of Object.entries(sh.filter.crit)) { const x = shiftV(+c); if (x != null) nc[x] = v; } sh.filter.crit = nc; } else if (axis === 'c' && insert && sh.filter.crit) { const nc = {}; for (const [c, v] of Object.entries(sh.filter.crit)) nc[shiftV(+c)] = v; sh.filter.crit = nc; } Object.assign(sh.filter, X); } }
    for (const ch of sh.charts) ch.ref = moveRefString(ch.ref, R => adj(R));
    if (!band) {
      const key = axis === 'r' ? 'rowH' : 'colW', hk = axis === 'r' ? 'hidR' : 'hidC', m = {};
      for (const [i, x] of Object.entries(sh[key])) { const v = shiftV(+i); if (v != null && v < lim) m[v] = x; }
      sh[key] = m;
      sh[hk] = sh[hk].map(shiftV).filter(v => v != null && v < lim);
    }
    clip = null;
  });
}
function moveRefString(ref, fn) {
  const m = /^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(ref || '');
  if (!m) return ref;
  const R = { r0: +m[2] - 1, c0: colIdx(m[1]), r1: +(m[4] || m[2]) - 1, c1: colIdx(m[3] || m[1]) };
  const X = fn(R); if (!X) return ref;
  return rangeName(X);
}
App.structural = structural;

/* ================= 並べ替え ================= */
const collator = new Intl.Collator('ja', { numeric: true });
function sortRange(R, keys, header) {
  if (editing) commitEdit(0, 0);
  const sh = sheet(), si = book.cur;
  if (sh.merges.some(m => !(m.r1 < R.r0 || m.r0 > R.r1 || m.c1 < R.c0 || m.c0 > R.c1))) { App.alert('この操作には、結合したセルをすべて同じサイズにする必要があります。'); return false; }
  const r0 = R.r0 + (header ? 1 : 0);
  if (R.r1 <= r0) return false;
  const rows = [];
  for (let r = r0; r <= R.r1; r++) {
    const cells = []; for (let c = R.c0; c <= R.c1; c++) cells.push(sh.cells[keyOf(r, c)]);
    rows.push({ r, keys: keys.map(k => val(si, r, k.c)), cells });
  }
  rows.sort((a, b) => {
    for (let i = 0; i < keys.length; i++) {
      const x = a.keys[i], y = b.keys[i];
      const ex = x == null || x === '', ey = y == null || y === '';
      if (ex || ey) { if (ex !== ey) return ex - ey; continue; }
      const d = typeof x === 'string' && typeof y === 'string' ? collator.compare(x, y) : E.compareVals(x, y);
      if (d) return keys[i].desc ? -d : d;
    }
    return a.r - b.r;
  });
  return commit(() => {
    rows.forEach((row, i) => {
      const nr = r0 + i;
      row.cells.forEach((cell, j) => {
        const k = keyOf(nr, R.c0 + j);
        if (!cell) { delete sh.cells[k]; return; }
        const n = JSON.parse(JSON.stringify(cell));
        if (isFormula(n.v)) n.v = engine.shiftFormula(n.v, nr - row.r, 0);
        sh.cells[k] = n;
      });
    });
  });
}
App.sortRange = sortRange;
App.guessHeader = R => {
  const first = [], second = [];
  for (let c = R.c0; c <= R.c1; c++) { first.push(val(book.cur, R.r0, c)); if (R.r0 + 1 <= R.r1) second.push(val(book.cur, R.r0 + 1, c)); }
  const allText = first.every(v => v == null || typeof v === 'string') && first.some(v => typeof v === 'string');
  const cellA = sheet().cells[keyOf(R.r0, R.c0)];
  return allText && (second.some(v => typeof v === 'number') || (cellA && cellA.b) || first.length === 1 || second.every(v => typeof v === 'string'));
};
App.sortRegion = () => {
  const R = rect();
  if (!isSingle(R)) return { R, header: App.guessHeader(R) };
  const F = filterRange(sheet());
  if (F && act.r >= F.r0 && act.r <= F.r1 && act.c >= F.c0 && act.c <= F.c1) return { R: F, header: true };
  const C = currentRegion(act);
  if (isSingle(C) && !hasValue(sheet(), act.r, act.c)) return null;
  return { R: C, header: App.guessHeader(C) };
};

/* ================= シート操作 ================= */
App.switchSheet = i => {
  if (editing && !commitEdit(0, 0)) return;
  if (i === book.cur || i < 0 || i >= book.sheets.length) return;
  book.cur = i; App.chartSel = null;
  act = { r: 0, c: 0 }; ext = { r: 0, c: 0 };
  const sh = sheet();
  if (sh._sel) { act = sh._sel.a; ext = sh._sel.e; }
  wrap.scrollTop = 0; wrap.scrollLeft = 0;
  render(); renderTabs(); updateSel(); App.onChange && App.onChange(); markDirty();
  ensureVisible(act); focusNav();
};
App.uniqueSheetName = base => { let n = 1, name = base; while (sheetIdx(name) >= 0) name = base + ' (' + (++n) + ')'; return name.replace(/[ ()]/g, m => m === ' ' ? '' : m === '(' ? '_' : ''); };
App.renameSheet = (i, nn) => {
  const old = book.sheets[i].name;
  nn = nn.trim();
  if (nn === old) return true;
  if (!E.SHEET_NAME_RE.test(nn)) { App.alert('シート名には、英数字・ひらがな・カタカナ・漢字・アンダーバー(_)が使えます。先頭に数字は使えません。'); return false; }
  if (nn.toLowerCase() !== old.toLowerCase() && sheetIdx(nn) >= 0) { App.alert('この名前は既に使用されています。別の名前を入力してください。'); return false; }
  const re = new RegExp(`(^|[^\\w$.!${E.JP}])${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}!`, 'gi');
  return commit(() => {
    book.sheets[i].name = nn;
    for (const s of book.sheets) for (const cell of Object.values(s.cells)) if (isFormula(cell.v)) cell.v = E.outsideStrings(cell.v, p => p.replace(re, '$1' + nn + '!'));
  }, { any: true });
};
App.moveSheet = (from, to, copy) => {
  return commit(() => {
    const cur = book.sheets[book.cur];
    if (copy) {
      const s = JSON.parse(JSON.stringify(book.sheets[from]));
      let base = s.name.replace(/_\d+$/, ''), n = 2; while (sheetIdx(base + '_' + n) >= 0) n++;
      s.name = base + '_' + n;
      book.sheets.splice(to, 0, s); book.cur = to;
    } else {
      const [s] = book.sheets.splice(from, 1);
      book.sheets.splice(to > from ? to - 1 : to, 0, s);
      book.cur = book.sheets.indexOf(cur);
    }
  }, { any: true });
};

/* ================= 起動 ================= */
/* 自動で入れていた見本データかどうか（そのままなら空のブックに置き換える） */
function isAutoSample(b) {
  if (!b || !Array.isArray(b.sheets) || b.sheets.length !== 1) return false;
  const c = b.sheets[0].cells || {}, v = k => c[k] && c[k].v;
  const n = Object.values(c).filter(x => x.v != null && x.v !== '').length;
  const old = v('A1') === '品目' && v('A2') === 'りんご' && v('A5') === 'バナナ' && n <= 30;
  const kakei = v('A1') === '家計簿（10月）' && v('A4') === '2026/10/1' && v('C4') === 'スーパー' && n <= 50 && (b.name === 'Book1');
  return old || kakei;
}
App.init = () => {
  build();
  const idx = readIndex();
  let data = null, id = null;
  if (idx.current) { try { data = JSON.parse(lsGet(BOOK_KEY(idx.current))); id = idx.current; } catch (e) { data = null; } }
  if (data && isAutoSample(data)) { const b = newBook(data.name || 'Book1'); data = b; }
  if (!data) { const m = migrateV1(); data = m && !isAutoSample(m) ? m : newBook('Book1'); id = null; }
  autosave = lsGet('hyokeisan-autosave') !== '0';
  $('autosaveBtn').classList.toggle('on', autosave);
  loadBookData(data, id);
  if (touch && lsGet('hyokeisan-zoomreset-1') !== '1') { book.sheets.forEach(s => { s.zoom = 100; }); lsSet('hyokeisan-zoomreset-1', '1'); }
  if (!id) saveNow();
  afterChange(true);
  dirty = false; updateTitle();
  focusNav();
};
App.sampleBook = () => {
  const b = newBook('Book1'), sh = b.sheets[0], set = (k, v, o) => { sh.cells[k] = Object.assign(v == null ? {} : { v }, o || {}); };
  const H = { b: true, bg: '#4472c4', fc: '#ffffff', al: 'c', bd: { b: 'thin #4472c4' } };
  set('A1', '家計簿（10月）', { b: true, sz: 16, fc: '#44546a' });
  set('A3', '日付', H); set('B3', '費目', H); set('C3', '内容', H); set('D3', '金額', H);
  [['2026/10/1', '食費', 'スーパー', 3240], ['2026/10/3', '日用品', 'ドラッグストア', 1580], ['2026/10/5', '交通費', '定期券', 9800], ['2026/10/8', '食費', '外食', 2600], ['2026/10/12', '娯楽', '映画', 1900], ['2026/10/15', '食費', 'スーパー', 4120], ['2026/10/20', '日用品', '洗剤', 680]]
    .forEach(([d, k, n, m], i) => { const r = i + 4, band = i % 2 ? { bg: '#d9e1f2' } : {}; set('A' + r, d, { fmt: 'date', ...band }); set('B' + r, k, band); set('C' + r, n, band); set('D' + r, String(m), { fmt: 'currency', ...band }); });
  set('C12', '合計', { b: true, al: 'r', bd: { t: 'thin #4472c4', b: 'double #4472c4' } });
  set('D12', '=SUM(D4:D10)', { b: true, fmt: 'currency', bd: { t: 'thin #4472c4', b: 'double #4472c4' } });
  set('F3', '費目', H); set('G3', '合計', H);
  ['食費', '日用品', '交通費', '娯楽'].forEach((k, i) => { const r = i + 4; set('F' + r, k); set('G' + r, `=SUMIF($B$4:$B$10,F${r},$D$4:$D$10)`, { fmt: 'currency' }); });
  set('F9', '平均（1件）'); set('G9', '=AVERAGE(D4:D10)', { fmt: 'currency' });
  set('F10', '件数'); set('G10', '=COUNTA(B4:B10)&"件"', { al: 'r' });
  sh.colW = { 0: 88, 1: 72, 2: 120, 3: 84, 5: 92, 6: 92 };
  sh.cf = [{ t: 'bar', color: '#5b9bd5', r0: 3, r1: 9, c0: 3, c1: 3 }];
  sh.charts = [{ type: 'col', ref: 'F3:G7', x: 700, y: 64, w: 400, h: 240, title: '費目別の支出', legend: false }];
  return b;
};
App.paintSel = paintSel;
App.render = render;
App.setSel = (a, e) => { act = a; ext = e || a; };
App.editor = editor; App.fbar = fbar;
App.setMode = setMode;
App.parseRef = s => {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(toHalf(String(s)).trim().replace(/^=/, '').replace(/^.*!/, ''));
  if (!m) return null;
  const a = { r: +m[2] - 1, c: colIdx(m[1]) }, b = m[3] ? { r: +m[4] - 1, c: colIdx(m[3]) } : a;
  if (a.r >= ROWS || b.r >= ROWS || a.c >= COLS || b.c >= COLS) return null;
  return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
};
App.saveSelForSheet = () => { sheet()._sel = { a: { ...act }, e: { ...ext } }; };
App.CHH = CHH; App.RHW = RHW;
})();
