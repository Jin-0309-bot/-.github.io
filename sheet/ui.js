/* 表計算シート：リボン・メニュー・ダイアログ・ファイル操作 */
(function () {
'use strict';
const App = window.App, E = window.SheetEngine, ICONS = window.ICONS;
const { keyOf, parseKey, colName, isFormula, isErr } = E;
const $ = id => document.getElementById(id);
const esc = App.esc;
const sheet = () => App.sheet(), book = () => App.book();
const cellAt = (r, c) => sheet().cells[keyOf(r, c)];
const actCell = () => { const a = App.getAct(); return cellAt(a.r, a.c) || {}; };

/* ================= アイコンの差し込み ================= */
function paintIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    const n = el.dataset.icon;
    if (n.startsWith('book:')) el.innerHTML = ICONS.book32(n.slice(5));
    else if (ICONS[n] && !el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', ICONS[n]);
  });
}

/* ================= ダイアログ ================= */
function dialog({ title, body, buttons, width, init, onClose }) {
  const d = document.createElement('dialog');
  d.className = 'dlg';
  if (width) d.style.width = width + 'px';
  d.innerHTML = `<div class="dt"><span>${esc(title)}</span><button class="x" aria-label="閉じる">✕</button></div><div class="db"></div><div class="df"><span class="left"></span></div>`;
  const db = d.querySelector('.db'), df = d.querySelector('.df'), left = df.querySelector('.left');
  if (typeof body === 'string') db.innerHTML = body; else if (body) db.appendChild(body);
  let closed = false;
  const close = () => { if (closed) return; closed = true; d.close(); d.remove(); onClose && onClose(); setTimeout(App.focusNav, 0); };
  for (const b of buttons || [{ label: 'OK', primary: true }]) {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' pri' : '');
    el.textContent = b.label;
    el.onclick = () => { if (b.action && b.action(d) === false) return; if (!b.keep) close(); };
    (b.left ? left : df).appendChild(el);
  }
  d.querySelector('.x').onclick = close;
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      const p = (buttons || []).find(b => b.primary);
      if (p) { e.preventDefault(); if (p.action && p.action(d) === false) return; close(); }
      else if (!buttons) { e.preventDefault(); close(); }
    }
  });
  document.body.appendChild(d);
  d.showModal();
  init && init(d);
  if (document.activeElement === d.querySelector('.x')) { const f = d.querySelector('.db input,.db select,.db textarea') || d.querySelector('.df .pri'); if (f) f.focus(); }
  return { el: d, close };
}
App.dialog = dialog;
App.alert = msg => dialog({ title: '表計算シート', body: `<div style="display:flex;gap:12px;align-items:flex-start;max-width:420px;padding:6px 0"><span style="font-size:26px;line-height:1;color:#0078d7">ⓘ</span><div style="white-space:pre-wrap">${esc(msg)}</div></div>`, buttons: [{ label: 'OK', primary: true }] });
App.confirm = (msg, yes, opts) => dialog({ title: '表計算シート', body: `<div style="display:flex;gap:12px;align-items:flex-start;max-width:440px;padding:6px 0"><span style="font-size:26px;line-height:1;color:#e8a33a">⚠</span><div style="white-space:pre-wrap">${esc(msg)}</div></div>`, buttons: [{ label: (opts && opts.ok) || 'OK', primary: true, action: () => { yes(); } }, { label: 'キャンセル' }] });
App.prompt = (title, value, cb, label) => dialog({
  title, width: 360,
  body: `${label ? `<label class="f">${esc(label)}</label>` : ''}<input type="text" style="width:100%" id="pIn">`,
  buttons: [{ label: 'OK', primary: true, action: d => cb(d.querySelector('#pIn').value) }, { label: 'キャンセル' }],
  init: d => { const i = d.querySelector('#pIn'); i.value = value || ''; i.select(); },
});
let toastTimer = 0;
App.toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800); };

/* ================= メニュー ================= */
let openMenus = [], menuOwner = null;
function hideMenus(level) {
  level = level || 0;
  while (openMenus.length > level) openMenus.pop().remove();
  if (!level) { const mini = $('mini'); if (mini) mini.remove(); menuOwner = null; }
}
App.hideMenus = () => hideMenus(0);
function buildMenu(items, level) {
  const m = document.createElement('div');
  m.className = 'menu';
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
    if (it.header) { const h = document.createElement('div'); h.className = 'mh'; h.textContent = it.header; m.appendChild(h); continue; }
    if (it.el) { m.appendChild(typeof it.el === 'function' ? it.el() : it.el); continue; }
    const b = document.createElement('button');
    b.className = 'mi' + (it.sub ? ' sub' : '') + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '');
    const ic = it.icon ? (it.icon.startsWith('<') ? it.icon : ICONS[it.icon] || '') : (it.swatch ? `<span style="width:14px;height:14px;border:1px solid #999;background:${it.swatch};display:block"></span>` : '');
    b.innerHTML = `<span class="mic">${ic}</span><span>${esc(it.label)}</span>${it.prev != null ? `<span class="prev">${esc(it.prev)}</span>` : ''}${it.key ? `<span class="key">${esc(it.key)}</span>` : ''}`;
    b.addEventListener('mouseenter', () => {
      hideMenus(level + 1);
      m.querySelectorAll('.hov').forEach(x => x.classList.remove('hov'));
      if (it.sub) { b.classList.add('hov'); const r = b.getBoundingClientRect(); openMenu(typeof it.sub === 'function' ? it.sub() : it.sub, r.right - 2, r.top - 5, level + 1, r.left); }
    });
    b.addEventListener('click', () => {
      if (it.sub) { b.dispatchEvent(new Event('mouseenter')); return; }
      hideMenus(0); it.action && it.action();
      setTimeout(App.focusNav, 0);
    });
    m.appendChild(b);
  }
  return m;
}
function openMenu(items, x, y, level, altX) {
  level = level || 0;
  hideMenus(level);
  const m = buildMenu(items, level);
  m.style.left = '0px'; m.style.top = '0px';
  document.body.appendChild(m); openMenus.push(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  if (x + w > innerWidth - 4) x = altX != null ? Math.max(4, altX - w + 2) : Math.max(4, innerWidth - w - 4);
  if (y + h > innerHeight - 4) y = Math.max(4, innerHeight - h - 4);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  return m;
}
App.openMenu = openMenu;
function menuAt(el, items) { const r = el.getBoundingClientRect(); return openMenu(items, r.left, r.bottom + 1, 0); }
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu,#mini,[data-menu]')) hideMenus(0); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openMenus.length) { hideMenus(0); App.focusNav(); } });
addEventListener('resize', () => hideMenus(0));
addEventListener('blur', () => hideMenus(0));

/* ================= 色パレット ================= */
const THEME = ['#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
const STD = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
const tint = (c, t) => t > 0 ? App.mix(c, '#ffffff', t) : App.mix(c, '#000000', -t);
const TINTS = c => c === '#FFFFFF' ? [-.05, -.15, -.25, -.35, -.5] : c === '#000000' ? [.5, .35, .25, .15, .05] : c === '#E7E6E6' ? [-.1, -.25, -.5, -.75, -.9] : [.8, .6, .4, -.25, -.5];
function palette(onPick, noneLabel, noneIcon) {
  const el = document.createElement('div');
  el.className = 'palette';
  let h = '';
  if (noneLabel) h += `<button class="pbtn" data-none="1">${noneIcon || ''}${esc(noneLabel)}</button>`;
  h += '<div class="pl">テーマの色</div><div class="pg theme">';
  h += THEME.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
  for (let i = 0; i < 5; i++) h += THEME.map(c => { const x = tint(c, TINTS(c)[i]); return `<button class="sw" data-c="${x}" style="background:${x}" title="${x}"></button>`; }).join('');
  h += '</div><div class="pl" style="margin-top:8px">標準の色</div><div class="pg std">' + STD.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('') + '</div>';
  h += '<button class="pbtn" data-more="1" style="margin-top:6px">🎨 その他の色...</button>';
  el.innerHTML = h;
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.more) {
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = '#4472c4';
      inp.style.cssText = 'position:fixed;left:-100px;top:0';
      document.body.appendChild(inp);
      inp.addEventListener('change', () => { hideMenus(0); onPick(inp.value); inp.remove(); });
      inp.click(); return;
    }
    hideMenus(0);
    onPick(b.dataset.none ? null : b.dataset.c);
  });
  return el;
}
App.palette = palette;

/* ================= リボン ================= */
App.curTab = 'home';
function showTab(name) {
  if (name === 'file') return openBackstage();
  App.curTab = name;
  document.querySelectorAll('.rtab[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.dataset.panel === name));
  const rb = $('ribbon');
  if (rb.classList.contains('min')) rb.classList.add('peek');
  rb.scrollLeft = 0;
  fitRibbon();
}
function fitRibbon() {
  const rb = $('ribbon'), panel = rb.querySelector('.panel.on');
  rb.classList.remove('c1', 'c2', 'c3', 'c4');
  if (!panel) return;
  for (const c of ['c1', 'c2', 'c3', 'c4']) { if (panel.scrollWidth <= rb.clientWidth) break; rb.classList.add(c); }
  ribbonArrows();
}
function ribbonArrows() {
  const rb = $('ribbon'), max = rb.scrollWidth - rb.clientWidth;
  $('rsL').hidden = rb.scrollLeft <= 2;
  $('rsR').hidden = max <= 2 || rb.scrollLeft >= max - 2;
}
$('ribbon').addEventListener('scroll', ribbonArrows, { passive: true });
$('rsL').onclick = () => $('ribbon').scrollBy({ left: -Math.round($('ribbon').clientWidth * .7), behavior: 'smooth' });
$('rsR').onclick = () => $('ribbon').scrollBy({ left: Math.round($('ribbon').clientWidth * .7), behavior: 'smooth' });
addEventListener('resize', fitRibbon);
App.fitRibbon = fitRibbon;
App.showTab = showTab;
$('tabbar').addEventListener('click', e => {
  const t = e.target.closest('.rtab[data-tab]'); if (t) showTab(t.dataset.tab);
});
$('tabbar').addEventListener('dblclick', e => { if (e.target.closest('.rtab[data-tab]') && e.target.closest('.rtab').dataset.tab !== 'file') App.cmd('toggleRibbon'); });
$('tabbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
const ribbon = $('ribbon');
ribbon.addEventListener('mousedown', e => {
  const b = e.target.closest('button');
  if (b) e.preventDefault();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd],[data-menu]');
  if (!b || b.closest('.menu') || b.closest('dialog')) return;
  if (b.closest('#mini')) { /* ミニツールバー */ }
  if (b.dataset.menu) {
    if (menuOwner === b && openMenus.length) { hideMenus(0); return; }
    const items = MENUS[b.dataset.menu.split(':')[0]](b.dataset.menu.split(':').slice(1).join(':'));
    const m = menuAt(b, items); menuOwner = b;
    if (b.closest('#mini')) m.style.zIndex = 1002;
    return;
  }
  App.cmd(b.dataset.cmd);
});
const fontSel = $('fontName'), sizeSel = $('fontSize');
fontSel.innerHTML = Object.keys(App.FONTS).map(f => `<option style="font-family:${esc(App.fontCss(f))}">${esc(f)}</option>`).join('');
sizeSel.innerHTML = App.SIZES.map(s => `<option>${s}</option>`).join('');
fontSel.onchange = () => { App.styleSel({ font: fontSel.value === '游ゴシック' ? null : fontSel.value }); App.focusNav(); };
sizeSel.onchange = () => { const v = +sizeSel.value; App.styleSel({ sz: v === 11 ? null : v }); App.focusNav(); };

/* ================= 選択に合わせたリボンの状態 ================= */
App.onSelChange = () => {
  const c = App.autoFmt(actCell()) || {}, a = App.getAct();
  const on = (id, v) => { const el = $(id); if (el) el.classList.toggle('on', !!v); };
  on('bBold', c.b); on('bItalic', c.i); on('bUnder', c.u);
  on('bAlL', c.al === 'l'); on('bAlC', c.al === 'c'); on('bAlR', c.al === 'r');
  on('bVaT', c.va === 't'); on('bVaM', c.va === 'm'); on('bVaB', !c.va || c.va === 'b');
  on('bWrap', c.wrap); on('bMerge', !!App.mergeAt(a.r, a.c));
  const f = c.font || '游ゴシック';
  if (![...fontSel.options].some(o => o.value === f)) fontSel.insertAdjacentHTML('beforeend', `<option>${esc(f)}</option>`);
  if (document.activeElement !== fontSel) fontSel.value = f;
  const s = String(c.sz || 11);
  if (![...sizeSel.options].some(o => o.value === s)) sizeSel.insertAdjacentHTML('beforeend', `<option>${esc(s)}</option>`);
  if (document.activeElement !== sizeSel) sizeSel.value = s;
  $('fmtName').textContent = E.FORMATS[c.fmt || 'general'] || '標準';
  syncView();
};
App.onChange = () => { App.onSelChange(); };
function syncView() {
  const sh = sheet(), b = book();
  document.querySelectorAll('[data-view]').forEach(i => { const k = i.dataset.view; i.checked = k === 'grid' ? sh.grid : k === 'headings' ? sh.heads : b.view.fbar; });
  document.querySelectorAll('[data-page]').forEach(i => { i.checked = !!sh.page[i.dataset.page]; });
  $('fbarRow').classList.toggle('hidden', !b.view.fbar);
  $('bFilter').classList.toggle('on', !!sh.filter);
  $('bShowF').classList.toggle('on', !!b.view.showF);
  $('bShowNotes').classList.toggle('on', !!b.view.notes);
  $('bProtect').classList.toggle('on', !!sh.prot);
  $('bProtect').querySelector('.lbl').textContent = sh.prot ? 'シート保護\nの解除' : 'シートの\n保護';
  const z = sh.zoom || 100;
  $('zoomRange').value = z; $('zoomPct').textContent = z + '%';
  $('painterBtn').classList.toggle('on', !!App.painter);
}
document.querySelectorAll('[data-view],[data-page]').forEach(i => i.addEventListener('change', () => {
  const sh = sheet(), b = book();
  if (i.dataset.view) {
    const k = i.dataset.view;
    if (k === 'grid') sh.grid = i.checked; else if (k === 'headings') sh.heads = i.checked; else b.view.fbar = i.checked;
  } else sh.page[i.dataset.page] = i.checked;
  App.afterChange(); App.focusNav();
}));

/* ================= 書式の補助 ================= */
const DEC_DEFAULT = { number: 2, comma: 0, currency: 0, accounting: 0, pct: 0, sci: 2 };
function setFmt(fmt, extra) {
  App.styleSel(Object.assign({ fmt: fmt === 'general' ? null : fmt, dec: null, code: null, sep: null }, extra || {}));
}
function decStep(d) {
  const c = actCell(), a = App.getAct();
  let base = c.dec;
  if (base == null) {
    if (c.fmt && DEC_DEFAULT[c.fmt] != null) base = DEC_DEFAULT[c.fmt];
    else { const v = App.val(book().cur, a.r, a.c); base = typeof v === 'number' ? (E.fmtGeneral(v).split('.')[1] || '').replace(/E.*/, '').length : 0; }
  }
  const patch = { dec: Math.max(0, Math.min(15, base + d)) };
  if (!c.fmt) patch.fmt = 'number';
  App.styleSel(patch);
}
let lastBorder = 'bottom', borderStyle = 'thin', borderColor = '#000000', lastFill = '#FFFF00', lastFc = '#FF0000';
const BORDER_ICON = { bottom: 'borderBottom', top: 'borderTop', left: 'borderLeft', right: 'borderRight', none: 'borderNone', all: 'borderAll', outside: 'borderOut', thickOutside: 'borderThickOut', dblBottom: 'borderDblBottom', thickBottom: 'borderThickBottom', topBottom: 'borderTopBottom', topThickBottom: 'borderTopBottom', topDblBottom: 'borderTopBottom' };
function applyBorder(kind, R) {
  if (App.isEditing()) App.commitEdit(0, 0);
  R = R || App.rect();
  const spec = st => `${st || borderStyle} ${borderColor}`;
  lastBorder = kind;
  $('borderIcon').innerHTML = ICONS[BORDER_ICON[kind] || 'borderBottom'];
  return App.commit(() => {
    const sh = sheet();
    const set = (r, c, e, v) => {
      if (r < 0 || c < 0 || r >= App.ROWS || c >= App.COLS) return;
      const x = App.cellOf(sh, r, c); x.bd = x.bd || {};
      if (v) x.bd[e] = v; else delete x.bd[e];
      const opp = { t: [r - 1, c, 'b'], b: [r + 1, c, 't'], l: [r, c - 1, 'r'], r: [r, c + 1, 'l'] }[e];
      const n = sh.cells[keyOf(opp[0], opp[1])]; if (n && n.bd) { delete n.bd[opp[2]]; App.cleanCell(sh, keyOf(opp[0], opp[1])); }
      App.cleanCell(sh, keyOf(r, c));
    };
    const rowE = (r, e, v) => { for (let c = R.c0; c <= R.c1; c++) set(r, c, e, v); };
    const colE = (c, e, v) => { for (let r = R.r0; r <= R.r1; r++) set(r, c, e, v); };
    const outside = st => { rowE(R.r0, 't', spec(st)); rowE(R.r1, 'b', spec(st)); colE(R.c0, 'l', spec(st)); colE(R.c1, 'r', spec(st)); };
    switch (kind) {
      case 'bottom': rowE(R.r1, 'b', spec()); break;
      case 'top': rowE(R.r0, 't', spec()); break;
      case 'left': colE(R.c0, 'l', spec()); break;
      case 'right': colE(R.c1, 'r', spec()); break;
      case 'none': App.eachIn(R, (r, c) => { for (const e of ['t', 'b', 'l', 'r']) set(r, c, e, null); }); break;
      case 'all': App.eachIn(R, (r, c) => { for (const e of ['t', 'b', 'l', 'r']) set(r, c, e, spec()); }); break;
      case 'outside': outside(); break;
      case 'thickOutside': outside('medium'); break;
      case 'dblBottom': rowE(R.r1, 'b', spec('double')); break;
      case 'thickBottom': rowE(R.r1, 'b', spec('medium')); break;
      case 'topBottom': rowE(R.r0, 't', spec()); rowE(R.r1, 'b', spec()); break;
      case 'topThickBottom': rowE(R.r0, 't', spec()); rowE(R.r1, 'b', spec('medium')); break;
      case 'topDblBottom': rowE(R.r0, 't', spec()); rowE(R.r1, 'b', spec('double')); break;
    }
  });
}
function doMerge(mode) {
  if (App.isEditing()) App.commitEdit(0, 0);
  const R = App.rect(), sh = sheet(), a = App.getAct();
  const exact = sh.merges.find(m => m.r0 === R.r0 && m.r1 === R.r1 && m.c0 === R.c0 && m.c1 === R.c1);
  if (mode === 'unmerge' || (mode === 'center' && exact)) {
    return App.commit(() => { sh.merges = sh.merges.filter(m => m.r1 < R.r0 || m.r0 > R.r1 || m.c1 < R.c0 || m.c0 > R.c1); });
  }
  if (R.r0 === R.r1 && R.c0 === R.c1) return;
  const blocks = mode === 'across' ? Array.from({ length: R.r1 - R.r0 + 1 }, (_, i) => ({ r0: R.r0 + i, r1: R.r0 + i, c0: R.c0, c1: R.c1 })) : [{ ...R }];
  let lost = 0;
  for (const B of blocks) App.eachIn(B, (r, c) => { if ((r !== B.r0 || c !== B.c0) && App.hasValue(sh, r, c)) lost++; });
  const run = () => App.commit(() => {
    sh.merges = sh.merges.filter(m => m.r1 < R.r0 || m.r0 > R.r1 || m.c1 < R.c0 || m.c0 > R.c1);
    for (const B of blocks) {
      if (B.r0 === B.r1 && B.c0 === B.c1) continue;
      // 左上が空なら最初の値を左上へ
      if (!App.hasValue(sh, B.r0, B.c0)) { let moved = false; App.eachIn(B, (r, c) => { if (!moved && App.hasValue(sh, r, c)) { App.cellOf(sh, B.r0, B.c0).v = sh.cells[keyOf(r, c)].v; moved = true; } }); }
      App.eachIn(B, (r, c) => { if (r === B.r0 && c === B.c0) return; const k = keyOf(r, c); if (sh.cells[k]) { delete sh.cells[k].v; App.cleanCell(sh, k); } });
      sh.merges.push(B);
      if (mode === 'center' || mode === 'across') { const x = App.cellOf(sh, B.r0, B.c0); if (mode === 'center') x.al = 'c'; }
    }
    App.setSel({ r: R.r0, c: R.c0 }, { r: R.r1, c: R.c1 });
  });
  if (lost) App.confirm('セルを結合すると、左上の端にあるセルの値のみが保持され、他のセルの値は破棄されます。', run); else run();
}
function autoSum(fn) {
  if (App.isEditing()) { App.insertAtCaret(fn + '()', 1); return; }
  const R = App.rect(), sh = sheet(), si = book().cur;
  const isNum = (r, c) => typeof App.val(si, r, c) === 'number';
  if (!App.isSingle(R)) {
    App.commit(() => {
      const lastEmpty = (() => { for (let c = R.c0; c <= R.c1; c++) if (App.hasValue(sh, R.r1, c)) return false; return true; })();
      const tr = lastEmpty ? R.r1 : R.r1 + 1, end = lastEmpty ? R.r1 - 1 : R.r1;
      if (R.r0 === R.r1 || end < R.r0) {
        const tc = R.c1 + 1; if (tc >= App.COLS) return false;
        App.setCellRaw(R.r0, tc, `=${fn}(${keyOf(R.r0, R.c0)}:${keyOf(R.r0, R.c1)})`);
        return;
      }
      if (tr >= App.ROWS) return false;
      for (let c = R.c0; c <= R.c1; c++) App.setCellRaw(tr, c, `=${fn}(${keyOf(R.r0, c)}:${keyOf(end, c)})`);
    });
    return;
  }
  const a = App.getAct();
  let ref = '';
  if (a.r > 0 && isNum(a.r - 1, a.c)) { let r0 = a.r - 1; while (r0 > 0 && isNum(r0 - 1, a.c) && !/^=\s*(SUM|SUBTOTAL)\(/i.test(String((cellAt(r0 - 1, a.c) || {}).v || ''))) r0--; ref = `${keyOf(r0, a.c)}:${keyOf(a.r - 1, a.c)}`; }
  else if (a.c > 0 && isNum(a.r, a.c - 1)) { let c0 = a.c - 1; while (c0 > 0 && isNum(a.r, c0 - 1)) c0--; ref = `${keyOf(a.r, c0)}:${keyOf(a.r, a.c - 1)}`; }
  if (App.startEdit('enter', `=${fn}(${ref})`)) {
    const ed = App.editor; ed.focus();
    if (ref) ed.setSelectionRange(fn.length + 2, fn.length + 2 + ref.length); else ed.setSelectionRange(fn.length + 2, fn.length + 2);
    App.onEditInput();
  }
}
function insertFn(name) {
  if (App.isEditing() && /^[=＝]/.test(App.editor.value)) { App.insertAtCaret(name + '()', 1); return; }
  if (App.isEditing()) App.commitEdit(0, 0);
  if (App.startEdit('enter', `=${name}()`)) { const ed = App.editor; ed.focus(); ed.setSelectionRange(name.length + 2, name.length + 2); App.onEditInput(); }
}
App.insertFn = insertFn;
const measureCtx = document.createElement('canvas').getContext('2d');
function autofitCol(c) {
  const sh = sheet(), si = book().cur;
  let w = 0;
  for (let r = 0; r < App.ROWS; r++) {
    const x = sh.cells[keyOf(r, c)]; if (!x || x.v == null || x.v === '' || App.mergeAt(r, c)) continue;
    const t = App.displayText(si, r, c);
    measureCtx.font = `${x.i ? 'italic ' : ''}${x.b ? '700 ' : ''}${x.sz || 11}pt ${App.fontCss(x.font || '游ゴシック')}`;
    const lines = x.wrap ? [t] : t.split('\n');
    for (const ln of lines) w = Math.max(w, measureCtx.measureText(ln).width + 9 + (x.ind || 0) * 9);
  }
  return w ? Math.ceil(w) : null;
}
function autofitRow(r) {
  const sh = sheet(); let h = App.DEFH;
  for (let c = 0; c < App.COLS; c++) { const x = sh.cells[keyOf(r, c)]; if (x && x.sz && x.sz > 11) h = Math.max(h, Math.round(x.sz * 1.75 + 5)); }
  return h;
}
function startPainter(sticky) {
  const R = App.rect(), sh = sheet(), cells = [];
  for (let r = R.r0; r <= R.r1; r++) { const row = []; for (let c = R.c0; c <= R.c1; c++) { const x = sh.cells[keyOf(r, c)]; const st = x ? JSON.parse(JSON.stringify(x)) : {}; delete st.v; delete st.note; row.push(st); } cells.push(row); }
  App.painter = { cells, sticky, merges: sh.merges.filter(m => m.r0 >= R.r0 && m.r1 <= R.r1 && m.c0 >= R.c0 && m.c1 <= R.c1).map(m => ({ r0: m.r0 - R.r0, r1: m.r1 - R.r0, c0: m.c0 - R.c0, c1: m.c1 - R.c0 })) };
  $('grid').classList.add('painting'); syncView();
}
function stopPainter() { App.painter = null; $('grid').classList.remove('painting'); syncView(); }
const pstyle = document.createElement('style');
pstyle.textContent = `#grid.painting td{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath d='M4 2v12l3-3 2 5 2-1-2-5h4z' fill='%23fff' stroke='%23000'/%3E%3Crect x='12' y='12' width='7' height='4' fill='%23e8a33a' stroke='%23000'/%3E%3C/svg%3E") 4 2,copy}#ribbon.min.peek{height:104px;border-bottom:1px solid var(--line);position:absolute;top:72px;left:0;right:0;z-index:50;box-shadow:0 4px 10px rgba(0,0,0,.15)}`;
document.head.appendChild(pstyle);

/* ================= コマンド ================= */
function needSel() { if (App.isEditing()) App.commitEdit(0, 0); }
function fullRows(R) { return R.c0 === 0 && R.c1 === App.COLS - 1; }
function fullCols(R) { return R.r0 === 0 && R.r1 === App.ROWS - 1; }
function setZoom(z) {
  z = Math.max(10, Math.min(400, Math.round(z)));
  sheet().zoom = z;
  App.afterChange();
  App.ensureVisible(App.getAct());
}
const CMD = {
  save: () => { needSel(); if (App.saveNow()) App.toast('このブラウザに保存しました'); },
  saveDialog: () => saveDialog(),
  undo: () => App.undo(), redo: () => App.redo(),
  cut: () => { needSel(); const c = App.doCopy(true); if (c && navigator.clipboard) navigator.clipboard.writeText(c.text).catch(() => {}); },
  copy: () => { needSel(); const c = App.doCopy(false); if (c && navigator.clipboard) navigator.clipboard.writeText(c.text).catch(() => {}); },
  paste: () => {
    needSel();
    if (App.getClip()) return App.pasteInternal('all');
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(App.pasteText).catch(() => App.alert('ブラウザの制限により、このボタンでは貼り付けできません。Ctrl+V（Mac は ⌘+V）で貼り付けてください。'));
  },
  pasteValues: () => { needSel(); App.getClip() ? App.pasteInternal('values') : CMD.paste(); },
  pasteFormulas: () => { needSel(); App.getClip() ? App.pasteInternal('formulas') : CMD.paste(); },
  pasteFormats: () => { needSel(); if (App.getClip()) App.pasteInternal('formats'); },
  pasteTranspose: () => { needSel(); if (App.getClip()) App.pasteInternal('transpose'); },
  negate: () => negateSel(),
  pasteOp: op => pasteOp(op),
  painter: () => { if (App.painter) stopPainter(); else startPainter(false); },
  painterSticky: () => startPainter(true),
  painterOff: () => stopPainter(),
  painterApply: () => {
    const P = App.painter; if (!P) return;
    const R = App.rect(), h = P.cells.length, w = P.cells[0].length;
    App.commit(() => {
      const sh = sheet();
      const RR = App.isSingle(R) ? { r0: R.r0, r1: R.r0 + h - 1, c0: R.c0, c1: R.c0 + w - 1 } : R;
      App.eachIn(RR, (r, c) => {
        if (r >= App.ROWS || c >= App.COLS) return;
        const st = P.cells[(r - RR.r0) % h][(c - RR.c0) % w], k = keyOf(r, c), x = sh.cells[k] || {};
        const n = JSON.parse(JSON.stringify(st)); if (x.v != null) n.v = x.v; if (x.note) n.note = x.note;
        sh.cells[k] = n; App.cleanCell(sh, k);
      });
      if (P.merges.length && App.isSingle(R)) for (const m of P.merges) sh.merges.push({ r0: RR.r0 + m.r0, r1: RR.r0 + m.r1, c0: RR.c0 + m.c0, c1: RR.c0 + m.c1 });
    });
    if (!P.sticky) stopPainter();
  },
  growFont: () => { const s = actCell().sz || 11, i = App.SIZES.findIndex(x => x > s); App.styleSel({ sz: i < 0 ? s : App.SIZES[i] }); },
  shrinkFont: () => { const s = actCell().sz || 11, l = App.SIZES.filter(x => x < s); App.styleSel({ sz: l.length ? l[l.length - 1] : s }); },
  bold: () => App.styleSel({ b: !actCell().b || null }),
  italic: () => App.styleSel({ i: !actCell().i || null }),
  underline: () => App.styleSel({ u: actCell().u ? null : true }),
  underlineDouble: () => App.styleSel({ u: actCell().u === 'double' ? null : 'double' }),
  strike: () => App.styleSel({ s: !actCell().s || null }),
  borderLast: () => applyBorder(lastBorder),
  fillLast: () => App.styleSel({ bg: lastFill }),
  fontColorLast: () => App.styleSel({ fc: lastFc }),
  vaTop: () => App.styleSel({ va: actCell().va === 't' ? null : 't' }),
  vaMiddle: () => App.styleSel({ va: actCell().va === 'm' ? null : 'm' }),
  vaBottom: () => App.styleSel({ va: null }),
  wrap: () => App.styleSel({ wrap: !actCell().wrap || null }),
  alLeft: () => App.styleSel({ al: actCell().al === 'l' ? null : 'l' }),
  alCenter: () => App.styleSel({ al: actCell().al === 'c' ? null : 'c' }),
  alRight: () => App.styleSel({ al: actCell().al === 'r' ? null : 'r' }),
  indentInc: () => { const c = actCell(); App.styleSel({ ind: Math.min(15, (c.ind || 0) + 1), al: c.al === 'r' ? 'r' : 'l' }); },
  indentDec: () => { const c = actCell(); App.styleSel({ ind: Math.max(0, (c.ind || 0) - 1) || null }); },
  mergeCenter: () => doMerge('center'), mergeAcross: () => doMerge('across'), mergeCells: () => doMerge('merge'), unmerge: () => doMerge('unmerge'),
  fmtCurrency: () => setFmt('currency'),
  fmtPct: () => setFmt('pct'),
  fmtComma: () => setFmt('comma'),
  decInc: () => decStep(1), decDec: () => decStep(-1),
  formatCells: tab => formatCellsDialog(tab || 'number'),
  insertCellsSmart: () => { needSel(); const R = App.rect(); if (fullRows(R)) CMD.insertRows(); else if (fullCols(R)) CMD.insertCols(); else App.structural('r', R.r0, R.r1 - R.r0 + 1, true, { lo: R.c0, hi: R.c1 }); },
  deleteCellsSmart: () => { needSel(); const R = App.rect(); if (fullRows(R)) CMD.deleteRows(); else if (fullCols(R)) CMD.deleteCols(); else App.structural('r', R.r0, R.r1 - R.r0 + 1, false, { lo: R.c0, hi: R.c1 }); },
  insertCellsDialog: () => cellsDialog(true), deleteCellsDialog: () => cellsDialog(false),
  insertRows: () => { needSel(); const R = App.rect(); App.structural('r', R.r0, R.r1 - R.r0 + 1, true); },
  insertCols: () => { needSel(); const R = App.rect(); App.structural('c', R.c0, R.c1 - R.c0 + 1, true); },
  deleteRows: () => { needSel(); const R = App.rect(); App.structural('r', R.r0, R.r1 - R.r0 + 1, false); },
  deleteCols: () => { needSel(); const R = App.rect(); App.structural('c', R.c0, R.c1 - R.c0 + 1, false); },
  addSheet: () => {
    needSel(); App.saveSelForSheet();
    let n = book().sheets.length + 1; while (App.sheetIdx('Sheet' + n) >= 0) n++;
    App.commit(() => { book().sheets.splice(book().cur + 1, 0, App.newSheet('Sheet' + n)); book().cur++; App.setSel({ r: 0, c: 0 }); }, { any: true });
  },
  deleteSheet: () => {
    const i = book().cur;
    if (book().sheets.length <= 1) return App.alert('ブックには少なくとも 1 つの表示されたシートが必要です。');
    const run = () => App.commit(() => { book().sheets.splice(i, 1); book().cur = Math.max(0, Math.min(i, book().sheets.length - 1)); App.setSel({ r: 0, c: 0 }); }, { any: true });
    const s = book().sheets[i];
    if (Object.keys(s.cells).length || s.charts.length) App.confirm('このシートは完全に削除されます。続けますか?', run, { ok: '削除' }); else run();
  },
  rowHeight: () => { const R = App.rect(), h = sheet().rowH[R.r0] || App.DEFH; App.prompt('セルの高さ', String(+(h * .75).toFixed(2)), v => { const n = parseFloat(v); if (!(n >= 0 && n <= 409)) return App.alert('0 から 409 までの数値を入力してください。'); App.commit(() => { for (let r = R.r0; r <= R.r1; r++) sheet().rowH[r] = Math.round(n / .75); }); }, '行の高さ(R):'); },
  autofitRow: () => { const R = App.rect(); App.commit(() => { for (let r = R.r0; r <= R.r1; r++) { const h = autofitRow(r); if (h === App.DEFH) delete sheet().rowH[r]; else sheet().rowH[r] = h; } }); },
  colWidth: () => { const R = App.rect(), w = sheet().colW[R.c0] || App.DEFW; App.prompt('セルの幅', String(+((w - 5) / 8).toFixed(2)), v => { const n = parseFloat(v); if (!(n >= 0 && n <= 255)) return App.alert('0 から 255 までの数値を入力してください。'); App.commit(() => { for (let c = R.c0; c <= R.c1; c++) sheet().colW[c] = Math.round(n * 8 + 5); }); }, '列の幅(C):'); },
  autofitCol: c => { const R = App.rect(); const list = c != null && c !== '' ? [+c] : Array.from({ length: R.c1 - R.c0 + 1 }, (_, i) => R.c0 + i); App.commit(() => { for (const x of list) { const w = autofitCol(x); if (w) sheet().colW[x] = Math.max(20, w); } }); },
  defaultWidth: () => App.prompt('標準の幅', String(+((App.DEFW - 5) / 8).toFixed(2)), v => { const n = parseFloat(v); if (!(n > 0)) return; App.commit(() => { const w = Math.round(n * 8 + 5); for (let c = 0; c < App.COLS; c++) if (!sheet().colW[c]) sheet().colW[c] = w; }); }, '標準の列幅(S):'),
  hideRows: () => { needSel(); const R = App.rect(); App.commit(() => { for (let r = R.r0; r <= R.r1; r++) if (!sheet().hidR.includes(r)) sheet().hidR.push(r); }); let n = R.r1 + 1; while (n < App.ROWS && App.isRowHidden(n)) n++; App.select({ r: Math.min(n, App.ROWS - 1), c: R.c0 }); },
  hideCols: () => { needSel(); const R = App.rect(); App.commit(() => { for (let c = R.c0; c <= R.c1; c++) if (!sheet().hidC.includes(c)) sheet().hidC.push(c); }); let n = R.c1 + 1; while (n < App.COLS && App.isColHidden(n)) n++; App.select({ r: R.r0, c: Math.min(n, App.COLS - 1) }); },
  unhideRows: () => { const R = App.rect(); App.commit(() => { sheet().hidR = sheet().hidR.filter(r => r < R.r0 - 1 || r > R.r1 + 1 || (R.r0 === R.r1 && false)); if (App.isSingle(R)) sheet().hidR = []; }); },
  unhideCols: () => { const R = App.rect(); App.commit(() => { sheet().hidC = sheet().hidC.filter(c => c < R.c0 - 1 || c > R.c1 + 1); if (App.isSingle(R)) sheet().hidC = []; }); },
  renameSheet: () => startTabRename(book().cur),
  moveSheet: () => moveCopyDialog(),
  protect: () => {
    const sh = sheet();
    if (sh.prot) { App.commit(() => { sh.prot = false; }, { any: true }); App.toast('シートの保護を解除しました'); }
    else App.confirm('シートを保護すると、セルの内容や書式を変更できなくなります。\n（解除するには同じボタンをもう一度押します）', () => { App.commit(() => { sh.prot = true; }, { any: true }); App.toast('シートを保護しました'); }, { ok: '保護する' });
  },
  autoSum: fn => autoSum(fn || 'SUM'),
  fillDown: () => App.fillDir('d'), fillRight: () => App.fillDir('r'), fillUp: () => App.fillDir('u'), fillLeft: () => App.fillDir('l'),
  fillDownAuto: () => App.fillDownAuto(),
  clearAll: () => App.clearRange('all'), clearFormats: () => App.clearRange('formats'), clearContents: () => App.clearRange('contents'), clearNotes: () => App.clearRange('notes'),
  sortAsc: () => quickSort(false), sortDesc: () => quickSort(true),
  sortDialog: () => sortDialog(),
  filter: () => toggleFilter(),
  filterClear: () => { const sh = sheet(); if (sh.filter) App.commit(() => { sh.filter.crit = {}; }); },
  filterReapply: () => App.refresh(),
  find: () => findDialog('find'), replace: () => findDialog('replace'), goto: () => gotoDialog(),
  insertTable: () => tableDialog('#4472C4', true),
  chart: t => App.insertChart(t || 'col'),
  newNote: () => noteDialog(), deleteNote: () => App.clearRange('notes'),
  showNotes: () => { book().view.notes = !book().view.notes; App.afterChange(); },
  symbol: () => symbolDialog(),
  print: () => doPrint(),
  showFormulas: () => { book().view.showF = !book().view.showF; App.afterChange(); },
  recalc: () => { App.refresh(); App.toast('再計算しました'); },
  insertFunction: () => insertFunctionDialog(),
  importCsv: () => $('fileCsv').click(),
  openXlsx: () => $('fileXlsx').click(),
  open: () => openBackstage('open'),
  newBook: () => newBook(),
  dedupe: () => dedupeDialog(),
  validation: () => validationDialog(),
  zoomDialog: () => zoomDialog(),
  zoom: z => setZoom(+z || 100),
  zoomIn: () => setZoom((sheet().zoom || 100) + 10), zoomOut: () => setZoom((sheet().zoom || 100) - 10),
  zoomSel: () => {
    const R = App.rect(); let w = 0, h = 0;
    for (let c = R.c0; c <= R.c1; c++) w += sheet().colW[c] || App.DEFW;
    for (let r = R.r0; r <= R.r1; r++) h += sheet().rowH[r] || App.DEFH;
    const wr = App.wrap; setZoom(Math.min(400, Math.floor(Math.min((wr.clientWidth - 60) / w, (wr.clientHeight - 40) / h) * 100)));
    App.ensureVisible({ r: R.r0, c: R.c0 });
  },
  freeze: t => {
    const sh = sheet(), a = App.getAct();
    App.commit(() => {
      if (t === 'row') sh.freeze = { r: 1, c: 0 };
      else if (t === 'col') sh.freeze = { r: 0, c: 1 };
      else if (sh.freeze && (sh.freeze.r || sh.freeze.c)) sh.freeze = null;
      else sh.freeze = { r: a.r, c: a.c };
    }, { any: true });
  },
  help: () => helpDialog(), shortcuts: () => shortcutsDialog(),
  toggleRibbon: () => { const rb = $('ribbon'); rb.classList.toggle('min'); rb.classList.remove('peek'); $('ribbonToggle').innerHTML = ICONS[rb.classList.contains('min') ? 'expand' : 'collapse']; },
  prevSheet: () => { App.saveSelForSheet(); App.switchSheet(Math.max(0, book().cur - 1)); },
  nextSheet: () => { App.saveSelForSheet(); App.switchSheet(Math.min(book().sheets.length - 1, book().cur + 1)); },
  deleteChart: () => { const i = App.chartSel; if (i == null) return; App.chartSel = null; App.commit(() => { sheet().charts.splice(i, 1); }); },
  chartSwitch: () => { const ch = sheet().charts[App.chartSel]; if (ch) App.commit(() => { ch.swap = !ch.swap; }); },
  chartData: () => chartDataDialog(),
  insertDate: () => insertNow(false), insertTime: () => insertNow(true),
  repeat: () => {},
};
App.cmd = (s) => {
  if (!s) return;
  const i = s.indexOf(':'), name = i < 0 ? s : s.slice(0, i), arg = i < 0 ? undefined : s.slice(i + 1);
  const f = CMD[name];
  if (!f) return;
  if (name !== 'painterApply' && document.activeElement && document.activeElement.closest && document.activeElement.closest('#ribbon')) document.activeElement.blur();
  f(arg);
  if (!['print', 'importCsv', 'openXlsx', 'formatCells', 'find', 'replace', 'goto'].includes(name)) setTimeout(App.focusNav, 0);
};
function insertNow(time) {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const s = time ? `${d.getHours()}:${pad(d.getMinutes())}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  if (App.isEditing()) { App.insertAtCaret(s); return; }
  App.startEdit('enter', s); App.editor.focus(); App.editor.setSelectionRange(s.length, s.length);
}
function quickSort(desc) {
  needSel();
  const reg = App.sortRegion(); if (!reg) return;
  const a = App.getAct();
  App.sortRange(reg.R, [{ c: Math.min(Math.max(a.c, reg.R.c0), reg.R.c1), desc }], reg.header);
}
function toggleFilter() {
  needSel();
  const sh = sheet();
  if (sh.filter) { App.commit(() => { sh.filter = null; }); return; }
  let R = App.rect();
  if (App.isSingle(R)) {
    const a = App.getAct();
    if (!App.hasValue(sh, a.r, a.c)) { R = App.currentRegion(a); if (App.isSingle(R)) return App.alert('このコマンドは、選択した範囲に対して実行できません。データ範囲内のセルを 1 つ選択してから操作してください。'); }
    else R = App.currentRegion(a);
  }
  App.commit(() => { sh.filter = { r0: R.r0, r1: R.r1, c0: R.c0, c1: R.c1, crit: {} }; });
}


/* ================= 符号の反転・計算して貼り付け ================= */
const NOCALC_FMT = /date|ldate|md|datetime|time|hm|text/;
function negateSel() {
  needSel();
  const R = App.rect(), sh = sheet();
  let n = 0;
  App.commit(() => {
    App.eachIn(R, (r, c) => {
      const x = sh.cells[keyOf(r, c)];
      if (!x || x.v == null || x.v === '' || (x.fmt && NOCALC_FMT.test(x.fmt))) return;
      if (isFormula(x.v)) {
        const m = /^=-\(([\s\S]*)\)$/.exec(x.v);
        x.v = m ? '=' + m[1] : '=-(' + x.v.slice(1) + ')';
        n++; return;
      }
      const p = E.parseInput(String(x.v));
      if (typeof p.v !== 'number') return;
      if (p.fmt && !x.fmt) x.fmt = p.fmt;
      x.v = String(-p.v);
      n++;
    });
    if (!n) return false;
  });
  App.toast(n ? `${n} 個のセルの符号を反転しました` : '反転できる数値のセルがありません');
}
function pasteOp(op) {
  needSel();
  const clip = App.getClip();
  if (!clip) { App.alert('先に、計算に使う数値のセルをコピーしてください。\n（例：全部に -1 を掛けたいときは、どこかのセルに -1 と入力してコピーします）'); return; }
  const h = clip.vals.length, w = clip.vals[0].length, R0 = App.rect();
  const R = App.isSingle(R0) ? { r0: R0.r0, r1: Math.min(App.ROWS - 1, R0.r0 + h - 1), c0: R0.c0, c1: Math.min(App.COLS - 1, R0.c0 + w - 1) } : R0;
  const sym = { add: '+', sub: '-', mul: '*', div: '/' }[op];
  const sh = sheet();
  let n = 0;
  App.commit(() => {
    App.eachIn(R, (r, c) => {
      const s = clip.vals[(r - R.r0) % h][(c - R.c0) % w];
      if (typeof s !== 'number') return;
      const x = sh.cells[keyOf(r, c)];
      if (!x || x.v == null || x.v === '' || (x.fmt && NOCALC_FMT.test(x.fmt))) return;
      if (isFormula(x.v)) { x.v = `=(${x.v.slice(1)})${sym}${s < 0 ? '(' + s + ')' : s}`; n++; return; }
      const p = E.parseInput(String(x.v));
      if (typeof p.v !== 'number') return;
      if (p.fmt && !x.fmt) x.fmt = p.fmt;
      if (op === 'div' && s === 0) { x.v = '#DIV/0!'; n++; return; }
      const v = op === 'add' ? p.v + s : op === 'sub' ? p.v - s : op === 'mul' ? p.v * s : p.v / s;
      x.v = String(E.roundTo(v, 12));
      n++;
    });
    if (!n) return false;
  });
  App.toast(n ? `${n} 個のセルを計算しました` : '計算できる数値のセルがありません');
}
const CALC_MENU = () => [
  { label: '足し算（コピーした数を足す）', action: () => App.cmd('pasteOp:add') },
  { label: '引き算（コピーした数を引く）', action: () => App.cmd('pasteOp:sub') },
  { label: '掛け算（コピーした数を掛ける）', action: () => App.cmd('pasteOp:mul') },
  { label: '割り算（コピーした数で割る）', action: () => App.cmd('pasteOp:div') },
];

/* ================= メニューの定義 ================= */
const FMT_LIST = [
  ['general', '標準', 'ABC\n123'], ['number', '数値', '12'], ['currency', '通貨', '¥'], ['accounting', '会計', '¥'], ['date', '短い日付形式', '📅'], ['ldate', '長い日付形式', '📅'],
  ['time', '時刻', '🕘'], ['pct', 'パーセンテージ', '%'], ['frac', '分数', '½'], ['sci', '指数', '10²'], ['text', '文字列', 'ab'],
];
const CF_COLORS = [['青', '#638EC6'], ['緑', '#63BE7B'], ['赤', '#F8696B'], ['オレンジ', '#FFB628'], ['水色', '#008AEF'], ['紫', '#D6007B']];
const SCALES = [
  ['緑、黄、赤', ['#63BE7B', '#FFEB84', '#F8696B']], ['赤、黄、緑', ['#F8696B', '#FFEB84', '#63BE7B']], ['緑、白、赤', ['#63BE7B', '#FCFCFF', '#F8696B']], ['赤、白、緑', ['#F8696B', '#FCFCFF', '#63BE7B']],
  ['青、白、赤', ['#5A8AC6', '#FCFCFF', '#F8696B']], ['赤、白、青', ['#F8696B', '#FCFCFF', '#5A8AC6']], ['白、赤', ['#FCFCFF', '#F8696B']], ['赤、白', ['#F8696B', '#FCFCFF']],
  ['緑、白', ['#63BE7B', '#FCFCFF']], ['白、緑', ['#FCFCFF', '#63BE7B']], ['緑、黄', ['#63BE7B', '#FFEF9C']], ['黄、緑', ['#FFEF9C', '#63BE7B']],
];
const ACCENTS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
const allBd = s => ({ t: s, b: s, l: s, r: s });
const CELL_STYLES = [
  ['良い、悪い、どちらでもない', [['標準', null], ['どちらでもない', { bg: '#FFEB9C', fc: '#9C5700' }], ['悪い', { bg: '#FFC7CE', fc: '#9C0006' }], ['良い', { bg: '#C6EFCE', fc: '#006100' }]]],
  ['データとモデル', [['計算', { bg: '#F2F2F2', fc: '#FA7D00', b: true, bd: allBd('thin #7F7F7F') }], ['チェック セル', { bg: '#A5A5A5', fc: '#FFFFFF', b: true, bd: allBd('double #3F3F3F') }], ['リンク セル', { fc: '#FA7D00', bd: { b: 'double #FF8001' } }], ['メモ', { bg: '#FFFFCC', bd: allBd('thin #B2B2B2') }],
    ['出力', { bg: '#F2F2F2', fc: '#3F3F3F', b: true, bd: allBd('thin #3F3F3F') }], ['説明文', { fc: '#7F7F7F', i: true }], ['入力', { bg: '#FFCC99', fc: '#3F3F76', bd: allBd('thin #7F7F7F') }], ['警告文', { fc: '#FF0000' }]]],
  ['タイトルと見出し', [['タイトル', { sz: 18, fc: '#44546A' }], ['見出し 1', { sz: 15, b: true, fc: '#44546A', bd: { b: 'thick #4472C4' } }], ['見出し 2', { sz: 13, b: true, fc: '#44546A', bd: { b: 'medium #A2B8E1' } }], ['見出し 3', { b: true, fc: '#44546A', bd: { b: 'medium #8EA9DB' } }], ['見出し 4', { b: true, fc: '#44546A' }], ['集計', { b: true, bd: { t: 'thin #4472C4', b: 'double #4472C4' } }]]],
  ['テーマのセル スタイル', [
    ...ACCENTS.map((c, i) => [`20% - アクセント ${i + 1}`, { bg: tint(c, .8) }]),
    ...ACCENTS.map((c, i) => [`40% - アクセント ${i + 1}`, { bg: tint(c, .6) }]),
    ...ACCENTS.map((c, i) => [`60% - アクセント ${i + 1}`, { bg: tint(c, .4), fc: '#FFFFFF' }]),
    ...ACCENTS.map((c, i) => [`アクセント ${i + 1}`, { bg: c, fc: '#FFFFFF' }]),
  ]],
  ['数値の書式', [['桁区切り', { fmt: 'comma', dec: 2 }], ['桁区切り [0]', { fmt: 'comma', dec: 0 }], ['通貨', { fmt: 'currency', dec: 2 }], ['通貨 [0]', { fmt: 'currency', dec: 0 }], ['パーセント', { fmt: 'pct', dec: 0 }]]],
];
const STYLE_KEYS = ['font', 'sz', 'b', 'i', 'u', 's', 'fc', 'bg', 'bd'];
function applyCellStyle(st) {
  const patch = {};
  if (!st) { for (const k of STYLE_KEYS) patch[k] = null; patch.fmt = null; patch.dec = null; }
  else if (st.fmt) Object.assign(patch, st);
  else { for (const k of STYLE_KEYS) patch[k] = null; Object.assign(patch, st); }
  App.styleSel(patch);
}
function swatchMenu(groups) {
  const el = document.createElement('div');
  el.style.cssText = 'padding:4px 8px;max-width:560px';
  for (const [title, list] of groups) {
    el.insertAdjacentHTML('beforeend', `<div class="mh" style="margin:4px -8px">${esc(title)}</div>`);
    const g = document.createElement('div'); g.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:4px 0';
    for (const [name, st] of list) {
      const b = document.createElement('button'); b.className = 'stylesw'; b.textContent = name;
      if (st) {
        if (st.bg) b.style.background = st.bg; if (st.fc) b.style.color = st.fc; if (st.b) b.style.fontWeight = 700; if (st.i) b.style.fontStyle = 'italic';
        if (st.sz && st.sz > 11) b.style.fontSize = Math.min(15, st.sz * .8) + 'px';
        if (st.bd && st.bd.b) b.style.borderBottom = App.borderCss(st.bd.b);
      }
      b.onclick = () => { hideMenus(0); applyCellStyle(st); };
      g.appendChild(b);
    }
    el.appendChild(g);
  }
  return el;
}
function tableSwatches() {
  const el = document.createElement('div');
  el.style.cssText = 'padding:4px 8px';
  const mk = (title, medium) => {
    el.insertAdjacentHTML('beforeend', `<div class="mh" style="margin:4px -8px">${title}</div>`);
    const g = document.createElement('div'); g.style.cssText = 'display:grid;grid-template-columns:repeat(7,auto);gap:6px;padding:6px 0';
    ['#000000', ...ACCENTS].forEach(c => {
      const base = c === '#000000' ? '#7F7F7F' : c;
      const b = document.createElement('button'); b.className = 'tblsw'; b.title = `${title} - ${c}`;
      let h = '';
      for (let i = 0; i < 5; i++) h += `<i style="display:block;background:${i === 0 ? (medium ? base : '#fff') : (i % 2 ? tint(base, medium ? .8 : .85) : '#fff')};border-bottom:1px solid ${i === 0 && !medium ? base : tint(base, .6)}"></i>`;
      b.innerHTML = h;
      b.onclick = () => { hideMenus(0); tableDialog(base, medium); };
      g.appendChild(b);
    });
    el.appendChild(g);
  };
  mk('淡色', false); mk('中間', true);
  return el;
}
function fnMenu(names) { return names.filter(n => E.FN_INFO[n]).map(n => ({ label: n, action: () => insertFn(n) })); }
const fnsOf = cat => Object.keys(E.FN_INFO).filter(n => E.FN_INFO[n][0] === cat).sort();
const MENUS = {
  paste: () => [
    { label: '貼り付け', icon: 'paste32', key: 'Ctrl+V', action: () => App.cmd('paste') },
    { label: '数式', action: () => App.cmd('pasteFormulas') },
    { label: '値', action: () => App.cmd('pasteValues') },
    { label: '書式設定', icon: 'painter', action: () => App.cmd('pasteFormats') },
    { label: '行/列の入れ替え', action: () => App.cmd('pasteTranspose') },
    '-',
    { label: '計算して貼り付け', sub: CALC_MENU },
    { label: '符号を反転（マイナスをつける）', action: () => App.cmd('negate') },
  ],
  underline: () => [{ label: '下線', icon: 'underline', action: () => App.cmd('underline') }, { label: '二重下線', action: () => App.cmd('underlineDouble') }],
  borders: () => [
    { header: '罫線' },
    { label: '下罫線', icon: 'borderBottom', action: () => applyBorder('bottom') },
    { label: '上罫線', icon: 'borderTop', action: () => applyBorder('top') },
    { label: '左罫線', icon: 'borderLeft', action: () => applyBorder('left') },
    { label: '右罫線', icon: 'borderRight', action: () => applyBorder('right') },
    '-',
    { label: '枠なし', icon: 'borderNone', action: () => applyBorder('none') },
    { label: '格子', icon: 'borderAll', action: () => applyBorder('all') },
    { label: '外枠', icon: 'borderOut', action: () => applyBorder('outside') },
    { label: '太い外枠', icon: 'borderThickOut', action: () => applyBorder('thickOutside') },
    '-',
    { label: '下二重罫線', icon: 'borderDblBottom', action: () => applyBorder('dblBottom') },
    { label: '下太罫線', icon: 'borderThickBottom', action: () => applyBorder('thickBottom') },
    { label: '上罫線 + 下罫線', icon: 'borderTopBottom', action: () => applyBorder('topBottom') },
    { label: '上罫線 + 下太罫線', icon: 'borderTopBottom', action: () => applyBorder('topThickBottom') },
    { label: '上罫線 + 下二重罫線', icon: 'borderTopBottom', action: () => applyBorder('topDblBottom') },
    { header: '罫線の作成' },
    { label: '線の色', sub: () => [{ el: palette(c => { borderColor = c || '#000000'; }, '自動') }] },
    { label: '線のスタイル', sub: () => [['thin', '細線'], ['hair', '点線'], ['dashed', '破線'], ['medium', '中太線'], ['thick', '太線'], ['double', '二重線']].map(([k, n]) => ({ label: n, checked: borderStyle === k, icon: `<svg width="40" height="8"><line x1="0" y1="4" x2="40" y2="4" stroke="#000" stroke-width="${k === 'medium' ? 2 : k === 'thick' ? 3 : 1}" ${k === 'hair' ? 'stroke-dasharray="1 2"' : k === 'dashed' ? 'stroke-dasharray="4 2"' : ''}/>${k === 'double' ? '<line x1="0" y1="7" x2="40" y2="7" stroke="#000"/>' : ''}</svg>`, action: () => { borderStyle = k; } })) },
    { label: 'その他の罫線...', action: () => formatCellsDialog('border') },
  ],
  fillColor: () => [{ el: palette(c => { if (c) { lastFill = c; $('fillBar').style.background = c; } App.styleSel({ bg: c }); }, '塗りつぶしなし') }],
  fontColor: () => [{ el: palette(c => { if (c) { lastFc = c; $('fcBar').style.background = c; } App.styleSel({ fc: c }); }, '自動') }],
  merge: () => [
    { label: 'セルを結合して中央揃え', icon: 'merge', action: () => doMerge('center') },
    { label: '横方向に結合', action: () => doMerge('across') },
    { label: 'セルの結合', action: () => doMerge('merge') },
    { label: 'セル結合の解除', action: () => doMerge('unmerge') },
  ],
  numFormat: () => {
    const a = App.getAct(), v = App.val(book().cur, a.r, a.c), cur = actCell().fmt || 'general';
    const n = typeof v === 'number' ? v : typeof v === 'string' && typeof E.parseLiteral(v) === 'number' ? E.parseLiteral(v) : null;
    return [...FMT_LIST.map(([f, name, ic]) => ({
      label: name, checked: cur === f, icon: `<span style="font-size:9px;line-height:1;white-space:pre;text-align:center;color:#555">${esc(ic)}</span>`,
      prev: n == null ? (v == null ? '' : E.toStr(v)) : E.formatValue(n, { fmt: f === 'general' ? null : f }),
      action: () => setFmt(f),
    })), '-', { label: 'その他の表示形式...', action: () => formatCellsDialog('number') }];
  },
  currency: () => [
    { label: '¥ 日本語', action: () => setFmt('currency') },
    { label: '$ 英語 (米国)', action: () => setFmt('custom', { code: '"$"#,##0.00' }) },
    { label: '€ ユーロ', action: () => setFmt('custom', { code: '€#,##0.00' }) },
    { label: '£ 英語 (英国)', action: () => setFmt('custom', { code: '£#,##0.00' }) },
    { label: '¥ 中国語 (中国)', action: () => setFmt('custom', { code: '"¥"#,##0.00' }) },
    '-', { label: 'その他の通貨表示形式...', action: () => formatCellsDialog('number') },
  ],
  condFmt: () => [
    { label: 'セルの強調表示ルール', icon: '<span style="font-size:11px">▸</span>', sub: [
      { label: '指定の値より大きい...', action: () => cfDialog('gt') },
      { label: '指定の値より小さい...', action: () => cfDialog('lt') },
      { label: '指定の範囲内...', action: () => cfDialog('between') },
      { label: '指定の値に等しい...', action: () => cfDialog('eq') },
      { label: '文字列...', action: () => cfDialog('text') },
      { label: '重複する値...', action: () => cfDialog('dup') },
    ] },
    { label: '上位/下位ルール', sub: [
      { label: '上位 10 項目...', action: () => cfDialog('top') },
      { label: '上位 10%...', action: () => cfDialog('topPct') },
      { label: '下位 10 項目...', action: () => cfDialog('bottom') },
      { label: '下位 10%...', action: () => cfDialog('bottomPct') },
      { label: '平均より上...', action: () => cfDialog('above') },
      { label: '平均より下...', action: () => cfDialog('below') },
    ] },
    { label: 'データ バー', sub: () => CF_COLORS.map(([n, c]) => ({ label: n + 'のデータ バー', icon: `<span style="display:block;width:16px;height:12px;background:linear-gradient(90deg,${c},#fff)"></span>`, action: () => addCF({ t: 'bar', color: c }) })) },
    { label: 'カラー スケール', sub: () => SCALES.map(([n, cs]) => ({ label: n + 'のカラー スケール', icon: `<span style="display:block;width:16px;height:14px;background:linear-gradient(180deg,${cs.join(',')})"></span>`, action: () => addCF({ t: 'scale', colors: cs }) })) },
    '-',
    { label: 'ルールのクリア', sub: [
      { label: '選択したセルからルールをクリア', action: () => { const R = App.rect(); App.commit(() => { sheet().cf = sheet().cf.filter(f => f.r1 < R.r0 || f.r0 > R.r1 || f.c1 < R.c0 || f.c0 > R.c1); }); } },
      { label: 'シート全体からルールをクリア', action: () => App.commit(() => { sheet().cf = []; }) },
    ] },
    { label: 'ルールの管理...', action: () => cfManageDialog() },
  ],
  tableFmt: () => [{ el: tableSwatches }],
  cellStyles: () => [{ el: () => swatchMenu(CELL_STYLES) }],
  insert: () => [
    { label: 'セルの挿入...', icon: 'insertSm', action: () => cellsDialog(true) },
    { label: 'シートの行を挿入', action: () => App.cmd('insertRows') },
    { label: 'シートの列を挿入', action: () => App.cmd('insertCols') },
    '-', { label: 'シートの挿入', action: () => App.cmd('addSheet') },
  ],
  delete: () => [
    { label: 'セルの削除...', icon: 'deleteSm', action: () => cellsDialog(false) },
    { label: 'シートの行を削除', action: () => App.cmd('deleteRows') },
    { label: 'シートの列を削除', action: () => App.cmd('deleteCols') },
    '-', { label: 'シートの削除', action: () => App.cmd('deleteSheet') },
  ],
  format: () => [
    { header: 'セルのサイズ' },
    { label: '行の高さ(H)...', action: () => App.cmd('rowHeight') },
    { label: '行の高さの自動調整(A)', action: () => App.cmd('autofitRow') },
    { label: '列の幅(W)...', action: () => App.cmd('colWidth') },
    { label: '列の幅の自動調整(I)', action: () => App.cmd('autofitCol') },
    { label: '既定の幅(D)...', action: () => App.cmd('defaultWidth') },
    { header: '表示設定' },
    { label: '非表示/再表示(U)', sub: [
      { label: '行を表示しない(R)', key: 'Ctrl+9', action: () => App.cmd('hideRows') },
      { label: '列を表示しない(C)', key: 'Ctrl+0', action: () => App.cmd('hideCols') },
      { label: '行の再表示(O)', action: () => App.cmd('unhideRows') },
      { label: '列の再表示(L)', action: () => App.cmd('unhideCols') },
    ] },
    { header: 'シートの整理' },
    { label: 'シート名の変更(R)', action: () => App.cmd('renameSheet') },
    { label: 'シートの移動またはコピー(M)...', action: () => App.cmd('moveSheet') },
    { label: 'シート見出しの色(T)', sub: () => [{ el: palette(c => App.commit(() => { sheet().tab = c; }, { any: true }), '色なし') }] },
    { header: '保護' },
    { label: sheet().prot ? 'シート保護の解除(P)...' : 'シートの保護(P)...', icon: 'protect32', action: () => App.cmd('protect') },
    '-',
    { label: 'セルの書式設定(E)...', icon: 'formatSm', key: 'Ctrl+1', action: () => formatCellsDialog('number') },
  ],
  autoSum: () => [
    { label: '合計(S)', icon: 'sum', action: () => App.cmd('autoSum:SUM') },
    { label: '平均(A)', action: () => App.cmd('autoSum:AVERAGE') },
    { label: '数値の個数(C)', action: () => App.cmd('autoSum:COUNT') },
    { label: '最大値(M)', action: () => App.cmd('autoSum:MAX') },
    { label: '最小値(I)', action: () => App.cmd('autoSum:MIN') },
    { label: 'その他の関数(F)...', action: () => insertFunctionDialog() },
  ],
  fill: () => [
    { label: '下方向へコピー(D)', icon: 'fillDown', key: 'Ctrl+D', action: () => App.cmd('fillDown') },
    { label: '右方向へコピー(R)', key: 'Ctrl+R', action: () => App.cmd('fillRight') },
    { label: '上方向へコピー(U)', action: () => App.cmd('fillUp') },
    { label: '左方向へコピー(L)', action: () => App.cmd('fillLeft') },
  ],
  clear: () => [
    { label: 'すべてクリア(A)', icon: 'clear', action: () => App.cmd('clearAll') },
    { label: '書式のクリア(F)', action: () => App.cmd('clearFormats') },
    { label: '数式と値のクリア(C)', action: () => App.cmd('clearContents') },
    { label: 'メモとノートのクリア(M)', action: () => App.cmd('clearNotes') },
  ],
  sortFilter: () => [
    { label: '昇順(S)', icon: 'sortAZ', action: () => App.cmd('sortAsc') },
    { label: '降順(O)', icon: 'sortZA', action: () => App.cmd('sortDesc') },
    { label: 'ユーザー設定の並べ替え(U)...', action: () => App.cmd('sortDialog') },
    '-',
    { label: 'フィルター(F)', icon: ICONS.funnel, checked: !!sheet().filter, key: 'Ctrl+Shift+L', action: () => App.cmd('filter') },
    { label: 'クリア(C)', icon: 'filterClear', disabled: !sheet().filter, action: () => App.cmd('filterClear') },
    { label: '再適用(Y)', icon: 'filterReapply', disabled: !sheet().filter, action: () => App.cmd('filterReapply') },
  ],
  findSelect: () => [
    { label: '検索(F)...', icon: 'search', key: 'Ctrl+F', action: () => App.cmd('find') },
    { label: '置換(R)...', key: 'Ctrl+H', action: () => App.cmd('replace') },
    { label: 'ジャンプ(G)...', key: 'Ctrl+G', action: () => App.cmd('goto') },
    '-',
    { label: '数式(U)', action: () => selectSpecial('formula') },
    { label: 'メモ(M)', action: () => selectSpecial('note') },
    { label: '定数(N)', action: () => selectSpecial('const') },
  ],
  chartCol: () => [{ header: '2-D 縦棒' }, { label: '集合縦棒', icon: 'colChart', action: () => App.insertChart('col') }, { label: '積み上げ縦棒', icon: 'colChart', action: () => App.insertChart('colStack') }],
  chartBar: () => [{ header: '2-D 横棒' }, { label: '集合横棒', icon: 'barChart', action: () => App.insertChart('bar') }, { label: '積み上げ横棒', icon: 'barChart', action: () => App.insertChart('barStack') }],
  chartLine: () => [{ header: '2-D 折れ線' }, { label: '折れ線', icon: 'lineChart', action: () => App.insertChart('line') }, { label: 'マーカー付き折れ線', icon: 'lineChart', action: () => App.insertChart('lineM') }],
  chartArea: () => [{ header: '2-D 面' }, { label: '面', icon: 'areaChart', action: () => App.insertChart('area') }],
  chartPie: () => [{ header: '2-D 円' }, { label: '円', icon: 'pieChart', action: () => App.insertChart('pie') }, { header: 'ドーナツ' }, { label: 'ドーナツ', icon: 'pieChart', action: () => App.insertChart('doughnut') }],
  margins: () => [['normal', '標準', '上: 1.91 cm 下: 1.91 cm'], ['wide', '広い', '上: 2.54 cm 下: 2.54 cm'], ['narrow', '狭い', '上: 1.91 cm 下: 1.91 cm 左右: 0.64 cm']].map(([k, n, d]) => ({ label: n, prev: d, checked: sheet().page.margin === k, action: () => App.commit(() => { sheet().page.margin = k; }, { any: true }) })),
  orient: () => [['portrait', '縦'], ['landscape', '横']].map(([k, n]) => ({ label: n, checked: sheet().page.orient === k, action: () => App.commit(() => { sheet().page.orient = k; }, { any: true }) })),
  paperSize: () => [['A4', 'A4', '21 cm x 29.7 cm'], ['A3', 'A3', '29.7 cm x 42 cm'], ['B5', 'B5 (JIS)', '18.2 cm x 25.7 cm'], ['letter', 'レター', '21.59 cm x 27.94 cm']].map(([k, n, d]) => ({ label: n, prev: d, checked: sheet().page.size === k, action: () => App.commit(() => { sheet().page.size = k; }, { any: true }) })),
  fnRecent: () => fnMenu(book().recentFns.length ? book().recentFns : ['SUM', 'AVERAGE', 'IF']).concat(['-', { label: '関数の挿入...', icon: '<i style="font:italic 700 12px Georgia,serif">fx</i>', action: () => insertFunctionDialog() }]),
  fn: cat => fnMenu(fnsOf(cat)).concat(['-', { label: '関数の挿入...', icon: '<i style="font:italic 700 12px Georgia,serif">fx</i>', action: () => insertFunctionDialog(cat) }]),
  fnMore: () => [
    { label: '統計', sub: () => fnMenu(fnsOf('統計')) },
    { label: '情報', sub: () => fnMenu(fnsOf('情報')) },
  ],
  freeze: () => {
    const f = sheet().freeze && (sheet().freeze.r || sheet().freeze.c);
    return [
      { label: f ? 'ウィンドウ枠固定の解除' : 'ウィンドウ枠の固定', prev: f ? '' : '選択セルより上の行と左の列を固定', icon: 'freeze32', action: () => App.cmd('freeze:cell') },
      { label: '先頭行の固定', prev: '先頭行を表示したままスクロール', action: () => App.cmd('freeze:row') },
      { label: '先頭列の固定', prev: '先頭列を表示したままスクロール', action: () => App.cmd('freeze:col') },
    ];
  },
  chartElements: () => {
    const ch = sheet().charts[App.chartSel]; if (!ch) return [];
    return [
      { label: 'グラフ タイトル', checked: ch.title !== false, action: () => App.commit(() => { ch.title = ch.title === false ? null : false; }) },
      { label: '凡例', checked: ch.legend !== false && (ch.legend === true || ch.type === 'pie' || ch.type === 'doughnut' || (ch.legend == null)), action: () => App.commit(() => { ch.legend = ch.legend === false ? true : false; }) },
      { label: 'データ ラベル', checked: !!ch.labels, action: () => App.commit(() => { ch.labels = !ch.labels; }) },
      '-', { label: 'グラフ タイトルの編集...', action: () => App.prompt('グラフ タイトル', ch.title || '', v => App.commit(() => { ch.title = v || null; })) },
    ];
  },
  chartColors: () => {
    const ch = sheet().charts[App.chartSel]; if (!ch) return [];
    const names = { colorful: 'カラフルなパレット 1', colorful2: 'カラフルなパレット 2', blue: 'モノクロ パレット (青)', orange: 'モノクロ パレット (オレンジ)', green: 'モノクロ パレット (緑)', gray: 'モノクロ パレット (灰色)' };
    return Object.entries(App.CHART_PALETTES).map(([k, p]) => ({ label: names[k], checked: (ch.pal || 'colorful') === k, icon: `<span style="display:flex">${p.slice(0, 4).map(c => `<i style="width:5px;height:12px;background:${c}"></i>`).join('')}</span>`, action: () => App.commit(() => { ch.pal = k; }) }));
  },
  chartType: () => {
    const ch = sheet().charts[App.chartSel]; if (!ch) return [];
    const ic = { col: 'colChart', colStack: 'colChart', bar: 'barChart', barStack: 'barChart', line: 'lineChart', lineM: 'lineChart', area: 'areaChart', pie: 'pieChart', doughnut: 'pieChart' };
    return Object.entries(App.CHART_TYPES).map(([k, n]) => ({ label: n, icon: ic[k], checked: ch.type === k, action: () => App.commit(() => { ch.type = k; }) }));
  },
};
App.MENUS = MENUS;
function addCF(rule) {
  needSel();
  const R = App.rect();
  App.commit(() => { sheet().cf.push(Object.assign({ r0: R.r0, r1: R.r1, c0: R.c0, c1: R.c1 }, rule)); });
}
function selectSpecial(kind) {
  const sh = sheet(); let R = null;
  for (const [k, c] of Object.entries(sh.cells)) {
    const ok = kind === 'formula' ? isFormula(c.v) : kind === 'note' ? !!c.note : (c.v != null && c.v !== '' && !isFormula(c.v));
    if (!ok) continue;
    const p = parseKey(k);
    R = R ? { r0: Math.min(R.r0, p.r), r1: Math.max(R.r1, p.r), c0: Math.min(R.c0, p.c), c1: Math.max(R.c1, p.c) } : { r0: p.r, r1: p.r, c0: p.c, c1: p.c };
  }
  if (!R) return App.alert('該当するセルが見つかりません。');
  App.select({ r: R.r0, c: R.c0 }, { r: R.r1, c: R.c1 });
}

/* ================= 右クリックメニュー ================= */
function miniToolbar(x, y) {
  const m = document.createElement('div'); m.id = 'mini';
  m.innerHTML = `<div class="row"><select class="rsel" style="width:110px" data-k="font">${Object.keys(App.FONTS).map(f => `<option>${esc(f)}</option>`).join('')}</select><select class="rsel" style="width:46px" data-k="sz">${App.SIZES.map(s => `<option>${s}</option>`).join('')}</select>
    <button class="rb ic" data-cmd="growFont" data-icon="growFont"></button><button class="rb ic" data-cmd="shrinkFont" data-icon="shrinkFont"></button>
    <button class="rb ic" data-cmd="fmtCurrency" data-icon="currency"></button><button class="rb ic" data-cmd="fmtPct" data-icon="percent"></button><button class="rb ic" data-cmd="fmtComma" data-icon="comma"></button><button class="rb ic" data-cmd="painter" data-icon="painter"></button></div>
    <div class="row"><button class="rb ic" data-cmd="bold" data-icon="bold"></button><button class="rb ic" data-cmd="italic" data-icon="italic"></button><button class="rb ic" data-cmd="alCenter" data-icon="alignCenter"></button>
    <button class="rb ic cbarwrap" data-cmd="fillLast"><span data-icon="fill"></span><i class="cbar" style="background:${lastFill}"></i></button><button class="rb arrow" data-menu="fillColor" style="width:13px">▾</button>
    <button class="rb ic cbarwrap" data-cmd="fontColorLast"><span data-icon="fontColor"></span><i class="cbar" style="background:${lastFc}"></i></button><button class="rb arrow" data-menu="fontColor" style="width:13px">▾</button>
    <button class="rb ic" data-cmd="borderLast"><span data-icon="${BORDER_ICON[lastBorder]}"></span></button><button class="rb arrow" data-menu="borders" style="width:13px">▾</button>
    <button class="rb ic" data-cmd="mergeCenter" data-icon="merge"></button><button class="rb ic" data-cmd="decInc" data-icon="decInc"></button><button class="rb ic" data-cmd="decDec" data-icon="decDec"></button></div>`;
  paintIcons(m);
  const c = actCell();
  m.querySelector('[data-k=font]').value = c.font || '游ゴシック';
  m.querySelector('[data-k=sz]').value = String(c.sz || 11);
  m.querySelectorAll('select').forEach(s => s.onchange = () => { const k = s.dataset.k; App.styleSel(k === 'font' ? { font: s.value === '游ゴシック' ? null : s.value } : { sz: +s.value === 11 ? null : +s.value }); });
  m.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  m.addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b) { e.stopPropagation(); hideMenus(1); App.cmd(b.dataset.cmd); m.remove(); } });
  document.body.appendChild(m);
  const w = m.offsetWidth;
  m.style.left = Math.max(4, Math.min(x, innerWidth - w - 4)) + 'px';
  m.style.top = Math.max(4, y - m.offsetHeight - 6) + 'px';
}
App.showCellMenu = (x, y, kind) => {
  const R = App.rect(), nr = R.r1 - R.r0 + 1, nc = R.c1 - R.c0 + 1, clip = App.getClip();
  const a = App.getAct(), cell = actCell();
  const isRow = kind === 'row', isCol = kind === 'col';
  const items = [
    { label: '切り取り(T)', icon: 'cut', action: () => App.cmd('cut') },
    { label: 'コピー(C)', icon: 'copy', action: () => App.cmd('copy') },
    { label: '貼り付け(P)', icon: 'paste32', key: 'Ctrl+V', action: () => App.cmd('paste') },
    { label: '値だけ貼り付け(V)', disabled: !clip, action: () => App.cmd('pasteValues') },
    { label: '数式だけ貼り付け(F)', disabled: !clip, action: () => App.cmd('pasteFormulas') },
    { label: '書式だけ貼り付け(R)', icon: 'painter', disabled: !clip, action: () => App.cmd('pasteFormats') },
    { label: '行と列を入れ替えて貼り付け(T)', disabled: !clip, action: () => App.cmd('pasteTranspose') },
    { label: '計算して貼り付け(O)', disabled: !clip, sub: CALC_MENU },
    { label: '符号を反転（マイナスをつける）', action: () => App.cmd('negate') },
    '-',
    isRow ? { label: `挿入(I)`, action: () => App.cmd('insertRows') } : isCol ? { label: '挿入(I)', action: () => App.cmd('insertCols') } : { label: '挿入(I)...', action: () => cellsDialog(true) },
    isRow ? { label: '削除(D)', action: () => App.cmd('deleteRows') } : isCol ? { label: '削除(D)', action: () => App.cmd('deleteCols') } : { label: '削除(D)...', action: () => cellsDialog(false) },
    { label: '数式と値のクリア(N)', action: () => App.cmd('clearContents') },
  ];
  if (!isRow && !isCol) {
    items.push('-',
      { label: 'フィルター(E)', sub: [
        { label: '選択したセルの値でフィルター(V)', action: () => filterByValue(a) },
        { label: 'フィルターの設定/解除', action: () => App.cmd('filter') },
      ] },
      { label: '並べ替え(O)', sub: [
        { label: '昇順(S)', icon: 'sortAZ', action: () => App.cmd('sortAsc') },
        { label: '降順(O)', icon: 'sortZA', action: () => App.cmd('sortDesc') },
        { label: 'ユーザー設定の並べ替え(U)...', action: () => App.cmd('sortDialog') },
      ] },
      '-',
      cell.note ? { label: 'メモの編集(E)', icon: 'noteShow', action: () => noteDialog() } : { label: '新しいメモ(N)', icon: 'noteShow', action: () => noteDialog() },
      cell.note ? { label: 'メモの削除(M)', action: () => App.cmd('deleteNote') } : null,
    );
  }
  items.push('-', { label: 'セルの書式設定(F)...', icon: 'formatSm', key: 'Ctrl+1', action: () => formatCellsDialog('number') });
  if (cell.dv && cell.dv.type === 'list') items.push({ label: 'ドロップダウン リストから選択(K)...', action: () => App.showDvMenu(null) });
  if (isRow) items.push({ label: '行の高さ(R)...', action: () => App.cmd('rowHeight') }, { label: '非表示(H)', action: () => App.cmd('hideRows') }, { label: '再表示(U)', action: () => App.cmd('unhideRows') });
  if (isCol) items.push({ label: '列の幅(W)...', action: () => App.cmd('colWidth') }, { label: '非表示(H)', action: () => App.cmd('hideCols') }, { label: '再表示(U)', action: () => App.cmd('unhideCols') });
  openMenu(items, x, y);
  miniToolbar(x, y);
};
function filterByValue(a) {
  const sh = sheet();
  if (!sh.filter) { const R = App.currentRegion(a); sh.filter = { r0: R.r0, r1: R.r1, c0: R.c0, c1: R.c1, crit: {} }; }
  const F = App.filterRange(sh), v = App.displayText(book().cur, a.r, a.c);
  const vals = new Set(); for (let r = F.r0 + 1; r <= F.r1; r++) vals.add(App.displayText(book().cur, r, a.c));
  App.commit(() => { sh.filter.crit = sh.filter.crit || {}; sh.filter.crit[a.c] = [...vals].filter(x => x !== v); });
}
App.wrap.addEventListener('contextmenu', e => {
  if (e.target.closest('.chart')) return;
  const h = App.hitAt(e.clientX, e.clientY);
  if (!h) return;
  e.preventDefault();
  if (App.isEditing()) return;
  App.showCellMenu(e.clientX, e.clientY, h.col ? 'col' : h.row ? 'row' : 'cell');
});
App.showChartMenu = (x, y) => openMenu([
  { label: '切り取り(T)', icon: 'cut', action: () => { App.cmd('deleteChart'); } },
  { label: '削除(D)', action: () => App.cmd('deleteChart') },
  '-',
  { label: 'グラフの種類の変更(Y)', icon: 'colChart', sub: MENUS.chartType },
  { label: 'データの選択(E)...', action: () => chartDataDialog() },
  { label: '行/列の切り替え', action: () => App.cmd('chartSwitch') },
  '-',
  { label: 'グラフ要素', sub: MENUS.chartElements },
  { label: '色の変更', sub: MENUS.chartColors },
], x, y);
App.showDvMenu = btn => {
  const a = App.getAct(), cell = actCell(); if (!cell.dv) return;
  const list = App.dvList(cell.dv);
  const items = list.map(v => ({ label: String(v), checked: String(cell.v ?? '') === String(v), action: () => App.commit(() => App.setCellRaw(a.r, a.c, String(v))) }));
  if (btn) menuAt(btn, items.length ? items : [{ label: '(項目がありません)', disabled: true }]);
  else { const b = App.cellRectPx(a.r, a.c), wr = App.wrap.getBoundingClientRect(); openMenu(items, wr.left + b.x - App.wrap.scrollLeft, wr.top + b.y + b.h - App.wrap.scrollTop); }
};
App.dvList = dv => {
  if (!dv) return [];
  const src = String(dv.src || '');
  if (/^[=＝]/.test(src)) {
    const m = /^[=＝]\s*(?:([^!]+)!)?(.+)$/.exec(E.toHalf(src));
    const si = m && m[1] ? App.sheetIdx(m[1].replace(/'/g, '')) : book().cur;
    const R = m && App.parseRef(m[2]);
    if (!R || si < 0) return [];
    const out = [];
    App.eachIn(R, (r, c) => { const t = App.displayText(si, r, c); if (t !== '') out.push(t); });
    return out;
  }
  return src.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
};

/* ================= フィルターのドロップダウン ================= */
const collator = new Intl.Collator('ja', { numeric: true });
App.showFilterMenu = (c, btn) => {
  const sh = sheet(), F = App.filterRange(sh), si = book().cur;
  if (!F) return;
  const crit = (sh.filter.crit && sh.filter.crit[c]) || [];
  const others = Object.entries(sh.filter.crit || {}).filter(([k, v]) => +k !== c && v && v.length).map(([k, v]) => [+k, new Set(v)]);
  const vals = new Set();
  for (let r = F.r0 + 1; r <= F.r1; r++) {
    if (others.some(([k, hide]) => hide.has(App.displayText(si, r, k)))) continue;
    vals.add(App.displayText(si, r, c));
  }
  crit.forEach(v => vals.add(v));
  const list = [...vals].sort((a, b) => a === '' ? 1 : b === '' ? -1 : (() => { const x = E.parseLiteral(a), y = E.parseLiteral(b); return typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(a, b); })());
  const hidden = new Set(crit);
  const head = App.displayText(si, F.r0, c) || `列 ${colName(c)}`;
  const box = document.createElement('div'); box.className = 'fltpop';
  box.innerHTML = `<input class="fs" placeholder="検索"><div class="fl"><label><input type="checkbox" data-all="1">(すべて選択)</label>${list.map((v, i) => `<label title="${esc(v)}"><input type="checkbox" data-i="${i}" ${hidden.has(v) ? '' : 'checked'}>${v === '' ? '(空白セル)' : esc(v)}</label>`).join('')}</div><div class="fbt"><button class="btn pri" data-ok>OK</button><button class="btn" data-cancel>キャンセル</button></div>`;
  const all = box.querySelector('[data-all]'), boxes = [...box.querySelectorAll('[data-i]')];
  const syncAll = () => { const n = boxes.filter(b => b.checked).length; all.checked = n === boxes.length; all.indeterminate = n > 0 && n < boxes.length; };
  syncAll();
  all.onchange = () => boxes.forEach(b => { if (b.parentNode.style.display !== 'none') b.checked = all.checked; });
  boxes.forEach(b => b.onchange = syncAll);
  box.querySelector('.fs').oninput = e => { const q = e.target.value.toLowerCase(); boxes.forEach((b, i) => { const show = !q || list[i].toLowerCase().includes(q); b.parentNode.style.display = show ? '' : 'none'; if (q) b.checked = show; }); syncAll(); };
  box.querySelector('[data-cancel]').onclick = () => hideMenus(0);
  box.querySelector('[data-ok]').onclick = () => {
    const hide = list.filter((v, i) => !boxes[i].checked);
    hideMenus(0);
    App.commit(() => { sh.filter.crit = sh.filter.crit || {}; if (hide.length) sh.filter.crit[c] = hide; else delete sh.filter.crit[c]; });
  };
  box.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') box.querySelector('[data-ok]').click(); if (e.key === 'Escape') hideMenus(0); });
  const sortCol = desc => App.sortRange(F, [{ c, desc }], true);
  const m = menuAt(btn, [
    { label: '昇順(S)', icon: 'sortAZ', action: () => sortCol(false) },
    { label: '降順(O)', icon: 'sortZA', action: () => sortCol(true) },
    '-',
    { label: `"${head}" からフィルターをクリア(C)`, icon: 'filterClear', disabled: !crit.length, action: () => App.commit(() => { delete sh.filter.crit[c]; }) },
    { el: box },
  ]);
  menuOwner = btn;
  setTimeout(() => { const s = m.querySelector('.fs'); if (s) s.focus(); }, 0);
};

/* ================= シート見出し ================= */
const tabsEl = $('tabs');
let tabDrag = null;
tabsEl.addEventListener('mousedown', e => {
  const t = e.target.closest('.stab'); if (!t || t.querySelector('input')) return;
  e.preventDefault();
  const i = +t.dataset.i;
  if (e.button === 0) {
    if (i !== book().cur) { App.saveSelForSheet(); App.switchSheet(i); }
    tabDrag = { i, x: e.clientX, on: false };
  }
});
document.addEventListener('mousemove', e => {
  if (!tabDrag) return;
  if (!tabDrag.on && Math.abs(e.clientX - tabDrag.x) > 6) tabDrag.on = true;
  if (!tabDrag.on) return;
  tabsEl.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const tab = t && t.closest && t.closest('.stab');
  if (tab) tab.classList.add('drop');
  document.body.style.cursor = 'grabbing';
});
document.addEventListener('mouseup', e => {
  if (!tabDrag) return;
  const d = tabDrag; tabDrag = null; document.body.style.cursor = '';
  tabsEl.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
  if (!d.on) return;
  const t = document.elementFromPoint(e.clientX, e.clientY), tab = t && t.closest && t.closest('.stab');
  let to = tab ? +tab.dataset.i : book().sheets.length;
  if (to === d.i) return;
  if (to > d.i) to++;
  App.moveSheet(d.i, to, e.ctrlKey);
});
tabsEl.addEventListener('dblclick', e => { const t = e.target.closest('.stab'); if (t) startTabRename(+t.dataset.i); });
tabsEl.addEventListener('contextmenu', e => {
  const t = e.target.closest('.stab'); if (!t) return;
  e.preventDefault();
  const i = +t.dataset.i;
  if (i !== book().cur) { App.saveSelForSheet(); App.switchSheet(i); }
  openMenu([
    { label: '挿入(I)...', action: () => App.cmd('addSheet') },
    { label: '削除(D)', action: () => App.cmd('deleteSheet') },
    { label: '名前の変更(R)', action: () => startTabRename(i) },
    { label: '移動またはコピー(M)...', action: () => moveCopyDialog() },
    { label: sheet().prot ? 'シート保護の解除(P)...' : 'シートの保護(P)...', action: () => App.cmd('protect') },
    { label: 'シート見出しの色(T)', sub: () => [{ el: palette(c => App.commit(() => { sheet().tab = c; }, { any: true }), '色なし') }] },
  ], e.clientX, e.clientY - 10);
});
function startTabRename(i) {
  App.renderTabs();
  const t = tabsEl.querySelector(`.stab[data-i="${i}"]`); if (!t) return;
  const inp = document.createElement('input');
  inp.value = book().sheets[i].name;
  inp.style.cssText = 'width:110px;border:1px solid #217346;outline:0;font:inherit;padding:1px 3px';
  t.innerHTML = ''; t.appendChild(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => { if (done) return; done = true; if (ok && inp.value.trim()) { if (!App.renameSheet(i, inp.value)) { App.renderTabs(); } } else App.renderTabs(); App.focusNav(); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) finish(true); if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
  inp.addEventListener('mousedown', e => e.stopPropagation());
}

/* ================= ダイアログ群 ================= */
function formatCellsDialog(tab) {
  if (App.isEditing()) App.commitEdit(0, 0);
  const c = JSON.parse(JSON.stringify(App.autoFmt(actCell()) || {}));
  const a = App.getAct(), v = App.val(book().cur, a.r, a.c);
  const sample = typeof v === 'number' ? v : 1234.5;
  const st = { fmt: c.fmt || 'general', dec: c.dec, sep: c.sep, code: c.code || '', al: c.al || '', va: c.va || 'b', ind: c.ind || 0, wrap: !!c.wrap, merge: !!App.mergeAt(a.r, a.c), font: c.font || '游ゴシック', sz: c.sz || 11, b: !!c.b, i: !!c.i, u: c.u || '', s: !!c.s, fc: c.fc || null, bg: c.bg || null, bd: c.bd ? { ...c.bd } : {}, bdStyle: 'thin', bdColor: '#000000', touched: {} };
  const R = App.rect();
  const multi = !App.isSingle(R);
  const body = document.createElement('div');
  body.style.width = '560px';
  body.innerHTML = `<div class="tabs">${[['number', '表示形式'], ['align', '配置'], ['font', 'フォント'], ['border', '罫線'], ['fill', '塗りつぶし']].map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('')}</div><div class="tb" style="min-height:330px"></div>`;
  const tb = body.querySelector('.tb');
  const touch = k => { st.touched[k] = 1; };
  const draw = t => {
    body.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'number') {
      const cats = [['general', '標準'], ['number', '数値'], ['currency', '通貨'], ['accounting', '会計'], ['date', '日付'], ['time', '時刻'], ['pct', 'パーセンテージ'], ['frac', '分数'], ['sci', '指数'], ['text', '文字列'], ['custom', 'ユーザー定義']];
      const catOf = f => ['ldate', 'md', 'datetime'].includes(f) ? 'date' : f === 'hm' ? 'time' : f === 'comma' ? 'number' : f;
      tb.innerHTML = `<div style="display:flex;gap:14px"><div><label class="f">分類(C):</label><div class="listbox" style="width:140px;height:270px" id="fcat">${cats.map(([k, n]) => `<div data-k="${k}">${n}</div>`).join('')}</div></div><div style="flex:1"><fieldset><legend>サンプル</legend><div id="fsample" class="prevbox" style="border:0;min-height:22px;padding:0"></div></fieldset><div id="fopts"></div></div></div>`;
      const opts = tb.querySelector('#fopts'), sampleEl = tb.querySelector('#fsample');
      const upd = () => { sampleEl.textContent = E.formatValue(st.fmt === 'text' ? String(v ?? '') : sample, { fmt: st.fmt === 'general' ? null : st.fmt, dec: st.dec, sep: st.sep, code: st.code }); };
      const pickCat = k => {
        tb.querySelectorAll('#fcat div').forEach(d => d.classList.toggle('on', d.dataset.k === k));
        let h = '';
        if (['number', 'currency', 'accounting', 'pct', 'sci'].includes(k)) h += `<div class="grid2" style="margin-top:6px"><span>小数点以下の桁数(D):</span><input type="number" id="fdec" min="0" max="15" style="width:60px" value="${st.dec ?? DEC_DEFAULT[k] ?? 2}"></div>`;
        if (k === 'number') h += `<label class="radio"><input type="checkbox" id="fsep" ${st.sep || st.fmt === 'comma' ? 'checked' : ''}>桁区切り ( , ) を使用する(U)</label>`;
        if (k === 'date') h += `<label class="f">種類(T):</label><div class="listbox" style="height:120px" id="fdt">${[['date', '2026/3/14'], ['ldate', '2026年3月14日'], ['md', '3月14日'], ['datetime', '2026/3/14 13:30']].map(([f, n]) => `<div data-f="${f}">${n}</div>`).join('')}</div>`;
        if (k === 'time') h += `<label class="f">種類(T):</label><div class="listbox" style="height:80px" id="fdt">${[['time', '13:30:55'], ['hm', '13:30']].map(([f, n]) => `<div data-f="${f}">${n}</div>`).join('')}</div>`;
        if (k === 'custom') h += `<label class="f">種類(T):</label><input type="text" id="fcode" style="width:100%" value="${esc(st.code || '#,##0')}"><div class="listbox" style="height:150px;margin-top:4px" id="fcodes">${['0', '0.00', '#,##0', '#,##0.00', '"¥"#,##0', '0%', '0.00%', '0.00E+00', 'yyyy/mm/dd', 'yyyy"年"m"月"d"日"', 'm"月"d"日"(aaa)', 'h:mm', 'h:mm:ss', '#,##0"円"', '#,##0"個"'].map(x => `<div>${esc(x)}</div>`).join('')}</div>`;
        const desc = { general: '標準の表示形式では、特定の書式は設定されません。', number: '数値の一般的な表示には、[数値] の表示形式を使用します。', currency: '通貨の値を表すときに使用します。', accounting: '会計の表示形式では、通貨記号がセルの左端に揃えて表示されます。', date: '日付のシリアル値を日付として表示します。', time: '時刻のシリアル値を時刻として表示します。', pct: 'セルの値に 100 を掛けた結果がパーセント記号付きで表示されます。', frac: '値を分数で表示します。', sci: '値を指数形式で表示します。', text: '文字列の表示形式では、数値も文字列として扱われます。セルには入力したとおりに表示されます。', custom: '既存の表示形式を基にして、新しい表示形式を作成します。' }[k];
        opts.innerHTML = h + `<p style="color:#555;margin-top:14px">${desc}</p>`;
        if (k !== catOf(st.fmt)) { st.fmt = k === 'date' ? 'date' : k === 'time' ? 'time' : k; st.dec = undefined; }
        touch('fmt');
        const dec = opts.querySelector('#fdec'); if (dec) dec.oninput = () => { st.dec = Math.max(0, Math.min(15, +dec.value || 0)); upd(); };
        const sep = opts.querySelector('#fsep'); if (sep) sep.onchange = () => { st.sep = sep.checked; st.fmt = 'number'; upd(); };
        const dt = opts.querySelector('#fdt'); if (dt) { const mark = () => dt.querySelectorAll('div').forEach(d => d.classList.toggle('on', d.dataset.f === st.fmt)); mark(); dt.onclick = e => { const d = e.target.closest('[data-f]'); if (d) { st.fmt = d.dataset.f; mark(); upd(); } }; }
        const code = opts.querySelector('#fcode'); if (code) { st.code = code.value; code.oninput = () => { st.code = code.value; upd(); }; opts.querySelector('#fcodes').onclick = e => { const d = e.target.closest('div[class=""],div:not([id])'); if (d && d.parentNode.id === 'fcodes') { code.value = d.textContent; st.code = d.textContent; upd(); } }; }
        upd();
      };
      tb.querySelector('#fcat').onclick = e => { const d = e.target.closest('[data-k]'); if (d) pickCat(d.dataset.k); };
      pickCat(catOf(st.fmt));
      st.touched.fmt = 0;
    } else if (t === 'align') {
      tb.innerHTML = `<fieldset><legend>文字の配置</legend><div class="grid2"><span>横位置(H):</span><select id="fal"><option value="">標準</option><option value="l">左詰め (インデント)</option><option value="c">中央揃え</option><option value="r">右詰め (インデント)</option></select><span>インデント(I):</span><input type="number" id="find" min="0" max="15" style="width:60px"><span>縦位置(V):</span><select id="fva"><option value="t">上詰め</option><option value="m">中央揃え</option><option value="b">下詰め</option></select></div></fieldset>
        <fieldset><legend>文字の制御</legend><label class="radio"><input type="checkbox" id="fwrap">折り返して全体を表示する(W)</label><label class="radio"><input type="checkbox" id="fmerge">セルを結合する(M)</label></fieldset>`;
      const al = tb.querySelector('#fal'), ind = tb.querySelector('#find'), va = tb.querySelector('#fva'), wr = tb.querySelector('#fwrap'), mg = tb.querySelector('#fmerge');
      al.value = st.al; ind.value = st.ind; va.value = st.va; wr.checked = st.wrap; mg.checked = st.merge;
      al.onchange = () => { st.al = al.value; touch('al'); }; ind.oninput = () => { st.ind = +ind.value || 0; touch('ind'); if (st.ind && !st.al) { st.al = 'l'; al.value = 'l'; touch('al'); } };
      va.onchange = () => { st.va = va.value; touch('va'); }; wr.onchange = () => { st.wrap = wr.checked; touch('wrap'); }; mg.onchange = () => { st.merge = mg.checked; touch('merge'); };
    } else if (t === 'font') {
      tb.innerHTML = `<div style="display:grid;grid-template-columns:1fr 130px 70px;gap:10px"><div><label class="f">フォント名(F):</label><input type="text" id="ffont" style="width:100%"><div class="listbox" style="height:150px" id="ffonts">${Object.keys(App.FONTS).map(f => `<div style="font-family:${esc(App.fontCss(f))}">${esc(f)}</div>`).join('')}</div></div>
        <div><label class="f">スタイル(O):</label><div class="listbox" style="height:174px" id="fstyle">${['標準', '斜体', '太字', '太字 斜体'].map((s, i) => `<div data-s="${i}">${s}</div>`).join('')}</div></div>
        <div><label class="f">サイズ(S):</label><div class="listbox" style="height:174px" id="fsz">${App.SIZES.map(s => `<div>${s}</div>`).join('')}</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div><label class="f">下線(U):</label><select id="fu" style="width:100%"><option value="">なし</option><option value="1">一重下線</option><option value="double">二重下線</option></select>
        <fieldset><legend>文字飾り</legend><label class="radio"><input type="checkbox" id="fs">取り消し線(K)</label></fieldset></div>
        <div><label class="f">色(C):</label><button class="btn" id="ffc" style="width:100%;display:flex;align-items:center;gap:6px"><i style="width:40px;height:12px;border:1px solid #888" id="ffcs"></i>▾</button><fieldset><legend>プレビュー</legend><div class="prevbox" id="fprev" style="height:50px;justify-content:center">Aaあぁアァ亜宇</div></fieldset></div></div>`;
      const fi = tb.querySelector('#ffont'), fl = tb.querySelector('#ffonts'), sl = tb.querySelector('#fstyle'), zl = tb.querySelector('#fsz'), u = tb.querySelector('#fu'), s = tb.querySelector('#fs'), prev = tb.querySelector('#fprev'), fcs = tb.querySelector('#ffcs');
      const upd = () => {
        fi.value = st.font;
        fl.querySelectorAll('div').forEach(d => d.classList.toggle('on', d.textContent === st.font));
        const si = (st.b ? 2 : 0) + (st.i ? 1 : 0); sl.querySelectorAll('div').forEach(d => d.classList.toggle('on', +d.dataset.s === si));
        zl.querySelectorAll('div').forEach(d => d.classList.toggle('on', +d.textContent === st.sz));
        u.value = st.u === true ? '1' : st.u || ''; s.checked = st.s; fcs.style.background = st.fc || '#000';
        Object.assign(prev.style, { fontFamily: App.fontCss(st.font), fontSize: Math.min(st.sz, 28) + 'pt', fontWeight: st.b ? 700 : 400, fontStyle: st.i ? 'italic' : 'normal', textDecoration: `${st.u ? 'underline' : ''} ${st.s ? 'line-through' : ''}`, color: st.fc || '#000' });
      };
      fl.onclick = e => { const d = e.target.closest('div[style]'); if (d && d.parentNode === fl) { st.font = d.textContent; touch('font'); upd(); } };
      fi.oninput = () => { st.font = fi.value; touch('font'); };
      sl.onclick = e => { const d = e.target.closest('[data-s]'); if (d) { const n = +d.dataset.s; st.b = n >= 2; st.i = n % 2 === 1; touch('b'); touch('i'); upd(); } };
      zl.onclick = e => { const d = e.target.closest('div'); if (d && d.parentNode === zl) { st.sz = +d.textContent; touch('sz'); upd(); } };
      u.onchange = () => { st.u = u.value === '1' ? true : u.value || ''; touch('u'); upd(); };
      s.onchange = () => { st.s = s.checked; touch('s'); upd(); };
      tb.querySelector('#ffc').onclick = e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const m = openMenu([{ el: palette(col => { st.fc = col; touch('fc'); upd(); }, '自動') }], r.left, r.bottom); m.style.zIndex = 2000; };
      upd();
    } else if (t === 'border') {
      tb.innerHTML = `<div style="display:flex;gap:16px"><div style="width:120px"><fieldset><legend>線</legend><label class="f">スタイル(S):</label><div id="bstyles" style="border:1px solid #aaa;padding:4px"></div><label class="f">色(C):</label><button class="btn" id="bcolor" style="width:100%;display:flex;align-items:center;gap:6px"><i id="bcs" style="width:40px;height:12px;border:1px solid #888"></i>▾</button></fieldset></div>
        <div style="flex:1"><label class="f">プリセット</label><div class="bdbtns" id="bpre"><button data-p="none" title="なし">${ICONS.borderNone}</button><button data-p="outside" title="外枠">${ICONS.borderOut}</button><button data-p="inside" title="内側">${ICONS.borderAll}</button></div>
        <label class="f">罫線</label><div style="display:flex;gap:10px;align-items:center"><div class="bdbtns" style="flex-direction:column" id="bedge1"><button data-e="t" title="上">${ICONS.borderTop}</button><button data-e="b" title="下">${ICONS.borderBottom}</button></div><div class="bdprev" id="bprev"><div class="t">文字列</div></div><div class="bdbtns" style="flex-direction:column" id="bedge2"><button data-e="l" title="左">${ICONS.borderLeft}</button><button data-e="r" title="右">${ICONS.borderRight}</button></div></div>
        <p style="color:#555">罫線のスタイルを選んで、プリセット、プレビューの図、またはその周りのボタンをクリックすると罫線を適用できます。</p></div></div>`;
      const styles = [['thin', 1], ['hair', 1], ['dashed', 1], ['medium', 2], ['thick', 3], ['double', 3]];
      const bs = tb.querySelector('#bstyles');
      const drawStyles = () => { bs.innerHTML = styles.map(([k, w]) => `<button class="lsbtn ${st.bdStyle === k ? 'on' : ''}" data-k="${k}"><svg width="90" height="8"><line x1="2" y1="4" x2="88" y2="4" stroke="#000" stroke-width="${w === 3 && k === 'double' ? 1 : w}" ${k === 'hair' ? 'stroke-dasharray="1 2"' : k === 'dashed' ? 'stroke-dasharray="4 2"' : ''}/>${k === 'double' ? '<line x1="2" y1="7" x2="88" y2="7" stroke="#000"/>' : ''}</svg></button>`).join(''); };
      drawStyles();
      bs.onclick = e => { const b = e.target.closest('[data-k]'); if (b) { st.bdStyle = b.dataset.k; drawStyles(); } };
      const prev = tb.querySelector('#bprev'), bcs = tb.querySelector('#bcs');
      const spec = () => `${st.bdStyle} ${st.bdColor}`;
      const upd = () => {
        const css = s => s ? App.borderCss(s) : '1px dotted #ccc';
        Object.assign(prev.style, { borderTop: css(st.bd.t), borderBottom: css(st.bd.b), borderLeft: css(st.bd.l), borderRight: css(st.bd.r) });
        tb.querySelectorAll('[data-e]').forEach(b => b.classList.toggle('on', !!st.bd[b.dataset.e]));
        bcs.style.background = st.bdColor;
      };
      tb.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { const e = b.dataset.e; st.bd[e] = st.bd[e] ? null : spec(); touch('bd'); upd(); });
      prev.onclick = ev => { const r = prev.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; const d = { t: y, b: r.height - y, l: x, r: r.width - x }; const e = Object.entries(d).sort((p, q) => p[1] - q[1])[0][0]; st.bd[e] = st.bd[e] ? null : spec(); touch('bd'); upd(); };
      tb.querySelector('#bpre').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; const p = b.dataset.p; if (p === 'none') { st.bd = {}; st.inside = false; } else if (p === 'outside') st.bd = { t: spec(), b: spec(), l: spec(), r: spec() }; else st.inside = spec(); touch('bd'); upd(); };
      tb.querySelector('#bcolor').onclick = e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const m = openMenu([{ el: palette(col => { st.bdColor = col || '#000000'; upd(); }, '自動') }], r.left, r.bottom); m.style.zIndex = 2000; };
      upd();
    } else if (t === 'fill') {
      tb.innerHTML = `<div style="display:flex;gap:20px"><div><label class="f">背景色(C):</label><button class="btn" id="fnone" style="width:100%;margin-bottom:6px">色なし</button><div id="fpal"></div></div><div style="flex:1"><label class="f">サンプル</label><div class="prevbox" id="fsw" style="height:60px"></div></div></div>`;
      const sw = tb.querySelector('#fsw');
      const upd = () => { sw.style.background = st.bg || '#fff'; };
      const p = palette(c => { st.bg = c; touch('bg'); upd(); }); p.querySelector('[data-more]').remove();
      p.addEventListener('click', e => e.stopPropagation(), true);
      p.querySelectorAll('.sw').forEach(b => b.onclick = ev => { ev.stopPropagation(); st.bg = b.dataset.c; touch('bg'); upd(); });
      tb.querySelector('#fpal').appendChild(p);
      tb.querySelector('#fnone').onclick = () => { st.bg = null; touch('bg'); upd(); };
      upd();
    }
  };
  body.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) draw(b.dataset.t); };
  dialog({
    title: 'セルの書式設定', body,
    buttons: [{ label: 'OK', primary: true, action: () => {
      const T = st.touched, patch = {};
      if (T.fmt) { patch.fmt = st.fmt === 'general' ? null : st.fmt; patch.dec = st.dec ?? null; patch.sep = st.fmt === 'number' && st.sep ? true : null; patch.code = st.fmt === 'custom' ? st.code : null; }
      if (T.al) patch.al = st.al || null; if (T.ind) patch.ind = st.ind || null; if (T.va) patch.va = st.va === 'b' ? null : st.va; if (T.wrap) patch.wrap = st.wrap || null;
      if (T.font) patch.font = st.font === '游ゴシック' ? null : st.font; if (T.sz) patch.sz = st.sz === 11 ? null : st.sz;
      if (T.b) patch.b = st.b || null; if (T.i) patch.i = st.i || null; if (T.u) patch.u = st.u || null; if (T.s) patch.s = st.s || null; if (T.fc) patch.fc = st.fc;
      if (T.bg) patch.bg = st.bg;
      App.commit(() => {
        const sh = sheet();
        App.eachIn(R, (r, c) => { const k = keyOf(r, c), x = App.cellOf(sh, r, c); for (const p in patch) { if (patch[p] == null) delete x[p]; else x[p] = patch[p]; } App.cleanCell(sh, k); });
        if (T.bd) {
          const set = (r, c, e, v) => { const x = App.cellOf(sh, r, c); x.bd = x.bd || {}; if (v) x.bd[e] = v; else delete x.bd[e]; App.cleanCell(sh, keyOf(r, c)); };
          App.eachIn(R, (r, c) => {
            if (r === R.r0) set(r, c, 't', st.bd.t); else if (st.inside !== undefined) set(r, c, 't', st.inside || null);
            if (r === R.r1) set(r, c, 'b', st.bd.b); else if (st.inside !== undefined) set(r, c, 'b', st.inside || null);
            if (c === R.c0) set(r, c, 'l', st.bd.l); else if (st.inside !== undefined) set(r, c, 'l', st.inside || null);
            if (c === R.c1) set(r, c, 'r', st.bd.r); else if (st.inside !== undefined) set(r, c, 'r', st.inside || null);
          });
        }
        if (T.merge) {
          sh.merges = sh.merges.filter(m => m.r1 < R.r0 || m.r0 > R.r1 || m.c1 < R.c0 || m.c0 > R.c1);
          if (st.merge && multi) { App.eachIn(R, (r, c) => { if (r === R.r0 && c === R.c0) return; const k = keyOf(r, c); if (sh.cells[k]) { delete sh.cells[k].v; App.cleanCell(sh, k); } }); sh.merges.push({ ...R }); }
        }
      });
    } }, { label: 'キャンセル' }],
    init: () => draw(tab),
  });
}
App.formatCellsDialog = formatCellsDialog;

function cellsDialog(insert) {
  needSel();
  const R = App.rect();
  const opts = insert ? [['right', '右方向にシフト(I)'], ['down', '下方向にシフト(D)'], ['row', '行全体(R)'], ['col', '列全体(C)']] : [['left', '左方向にシフト(L)'], ['up', '上方向にシフト(U)'], ['row', '行全体(R)'], ['col', '列全体(C)']];
  dialog({
    title: insert ? 'セルの挿入' : '削除', width: 260,
    body: `<fieldset><legend>${insert ? '挿入' : '削除'}</legend>${opts.map(([k, n], i) => `<label class="radio"><input type="radio" name="cd" value="${k}" ${i === 1 ? 'checked' : ''}>${n}</label>`).join('')}</fieldset>`,
    buttons: [{ label: 'OK', primary: true, action: d => {
      const k = d.querySelector('input[name=cd]:checked').value;
      if (k === 'row') App.structural('r', R.r0, R.r1 - R.r0 + 1, insert);
      else if (k === 'col') App.structural('c', R.c0, R.c1 - R.c0 + 1, insert);
      else if (k === 'down' || k === 'up') App.structural('r', R.r0, R.r1 - R.r0 + 1, insert, { lo: R.c0, hi: R.c1 });
      else App.structural('c', R.c0, R.c1 - R.c0 + 1, insert, { lo: R.r0, hi: R.r1 });
    } }, { label: 'キャンセル' }],
  });
}

function findDialog(mode) {
  if (App.isEditing()) App.commitEdit(0, 0);
  const body = document.createElement('div'); body.style.width = '480px';
  body.innerHTML = `<div class="tabs"><button data-t="find">検索(D)</button><button data-t="replace">置換(P)</button></div>
    <div class="grid2"><span>検索する文字列(N):</span><input type="text" id="fq" style="width:100%"><span class="rp">置換後の文字列(E):</span><input type="text" id="fr" class="rp" style="width:100%"></div>
    <details style="margin-top:8px"><summary style="cursor:pointer">オプション(T)</summary><div class="grid2" style="margin-top:6px"><span>検索場所(H):</span><select id="fw"><option value="sheet">シート</option><option value="book">ブック</option></select><span>検索対象(L):</span><select id="ft"><option value="formulas">数式</option><option value="values">値</option></select></div>
    <label class="radio"><input type="checkbox" id="fcase">大文字と小文字を区別する(C)</label><label class="radio"><input type="checkbox" id="fwhole">セル内容が完全に同一であるものを検索する(O)</label></details>
    <div class="findres" id="fres" hidden></div>`;
  let m = mode, dlgEl = null;
  const setMode = x => { m = x; body.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === m)); body.querySelectorAll('.rp').forEach(e => e.style.display = m === 'replace' ? '' : 'none'); dlgEl && dlgEl.querySelectorAll('.rbtn').forEach(b => b.style.display = m === 'replace' ? '' : 'none'); };
  const opts = () => ({ q: body.querySelector('#fq').value, rep: body.querySelector('#fr').value, book: body.querySelector('#fw').value === 'book', target: body.querySelector('#ft').value, cs: body.querySelector('#fcase').checked, whole: body.querySelector('#fwhole').checked });
  const matcher = o => {
    const pat = o.q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\u0001/g, '\\*');
    return new RegExp(o.whole ? `^${pat}$` : pat, o.cs ? 'g' : 'gi');
  };
  const cellsList = o => {
    const out = [], b = book(), sis = o.book ? b.sheets.map((_, i) => i) : [b.cur];
    for (const si of sis) {
      const keys = Object.keys(b.sheets[si].cells).map(k => ({ k, p: parseKey(k) })).filter(x => x.p).sort((x, y) => x.p.r - y.p.r || x.p.c - y.p.c);
      for (const { k, p } of keys) {
        const cell = b.sheets[si].cells[k]; if (cell.v == null || cell.v === '') continue;
        const text = o.target === 'formulas' ? String(cell.v) : App.displayText(si, p.r, p.c);
        out.push({ si, r: p.r, c: p.c, text, raw: String(cell.v) });
      }
    }
    return out;
  };
  const findNext = () => {
    const o = opts(); if (!o.q) return;
    const re = matcher(o), list = cellsList(o).filter(x => { re.lastIndex = 0; return re.test(x.text); });
    if (!list.length) { App.alert('検索条件に一致するデータが見つかりません。'); return; }
    const a = App.getAct(), cur = book().cur;
    const nx = list.find(x => x.si > cur || (x.si === cur && (x.r > a.r || (x.r === a.r && x.c > a.c)))) || list[0];
    if (nx.si !== cur) App.switchSheet(nx.si);
    App.select({ r: nx.r, c: nx.c });
  };
  const findAll = () => {
    const o = opts(); if (!o.q) return;
    const re = matcher(o), list = cellsList(o).filter(x => { re.lastIndex = 0; return re.test(x.text); });
    const res = body.querySelector('#fres'); res.hidden = false;
    res.innerHTML = `<table><tr><th>シート</th><th>セル</th><th>値</th></tr>${list.map((x, i) => `<tr data-i="${i}"><td>${esc(book().sheets[x.si].name)}</td><td>$${colName(x.c)}$${x.r + 1}</td><td>${esc(App.displayText(x.si, x.r, x.c))}</td></tr>`).join('')}</table><div style="padding:4px 6px;color:#555">${list.length} セルが見つかりました</div>`;
    res.onclick = e => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; const x = list[+tr.dataset.i]; if (x.si !== book().cur) App.switchSheet(x.si); App.select({ r: x.r, c: x.c }); };
  };
  const replaceIn = (o, x) => { const re = matcher(o); return o.whole ? o.rep : x.raw.replace(re, o.rep.replace(/\$/g, '$$$$')); };
  const replaceOne = () => {
    const o = opts(); if (!o.q) return;
    const a = App.getAct(), cell = sheet().cells[keyOf(a.r, a.c)];
    const re = matcher(o);
    if (cell && cell.v != null && (re.lastIndex = 0, re.test(o.target === 'formulas' ? String(cell.v) : App.displayText(book().cur, a.r, a.c)))) {
      App.commit(() => { App.setCellRaw(a.r, a.c, replaceIn({ ...o, target: 'formulas' }, { raw: String(cell.v) })); });
    }
    findNext();
  };
  const replaceAll = () => {
    const o = opts(); if (!o.q) return;
    const re = matcher(o);
    const list = cellsList({ ...o, target: 'formulas' }).filter(x => { re.lastIndex = 0; return re.test(x.raw); });
    if (!list.length) { App.alert('置換対象のデータが見つかりません。'); return; }
    const cur = book().cur;
    App.commit(() => { for (const x of list) { const s = book().sheets[x.si]; const cell = s.cells[keyOf(x.r, x.c)]; cell.v = replaceIn({ ...o }, x); if (cell.v === '') delete cell.v; App.cleanCell(s, keyOf(x.r, x.c)); } book().cur = cur; }, { any: true });
    App.alert(`すべて完了しました。${list.length} 件を置換しました。`);
  };
  dialog({
    title: '検索と置換', body,
    buttons: [
      { label: 'すべて置換(A)', left: true, keep: true, action: () => { replaceAll(); return false; } },
      { label: '置換(R)', left: true, keep: true, action: () => { replaceOne(); return false; } },
      { label: 'すべて検索(I)', keep: true, action: () => { findAll(); return false; } },
      { label: '次を検索(F)', primary: true, keep: true, action: () => { findNext(); return false; } },
      { label: '閉じる' },
    ],
    init: d => { dlgEl = d; d.querySelectorAll('.df .left .btn').forEach(b => b.classList.add('rbtn')); setMode(m); d.querySelector('#fq').focus(); const a = App.getAct(); const t = App.displayText(book().cur, a.r, a.c); if (t && t.length < 40) { d.querySelector('#fq').value = t; d.querySelector('#fq').select(); } },
  });
  body.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) setMode(b.dataset.t); };
  App.findNextText = q => { body.querySelector('#fq').value = q; findNext(); };
}
function gotoDialog() {
  dialog({
    title: 'ジャンプ', width: 300,
    body: '<label class="f">参照先(R):</label><input type="text" id="gref" style="width:100%" placeholder="例: B12 または A1:D20">',
    buttons: [{ label: 'OK', primary: true, action: d => { const R = App.parseRef(d.querySelector('#gref').value); if (!R) { App.alert('入力した参照が正しくありません。'); return false; } App.select({ r: R.r0, c: R.c0 }, { r: R.r1, c: R.c1 }); } }, { label: 'キャンセル' }],
    init: d => d.querySelector('#gref').focus(),
  });
}
function sortDialog() {
  needSel();
  const reg = App.sortRegion(); if (!reg) return App.alert('並べ替えるデータ範囲内のセルを選択してください。');
  const { R } = reg; let header = reg.header;
  App.select({ r: R.r0, c: R.c0 }, { r: R.r1, c: R.c1 }, true);
  const a = App.getAct();
  const levels = [{ c: R.c0, desc: false }];
  const body = document.createElement('div'); body.style.width = '540px';
  const colLabel = c => header ? (App.displayText(book().cur, R.r0, c) || `列 ${colName(c)}`) : `列 ${colName(c)}`;
  const draw = () => {
    body.innerHTML = `<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><button class="btn" id="sadd">＋ レベルの追加(A)</button><button class="btn" id="sdel">✕ レベルの削除(D)</button><label class="radio" style="margin-left:auto"><input type="checkbox" id="shead" ${header ? 'checked' : ''}>先頭行をデータの見出しとして使用する(H)</label></div>
      <table style="width:100%;border-collapse:collapse"><tr style="background:#f3f3f3"><th style="text-align:left;padding:4px;font-weight:400"></th><th style="text-align:left;padding:4px;font-weight:400">列</th><th style="text-align:left;padding:4px;font-weight:400">並べ替えのキー</th><th style="text-align:left;padding:4px;font-weight:400">順序</th></tr>
      ${levels.map((L, i) => `<tr data-i="${i}"><td style="padding:4px">${i ? '次に優先されるキー' : '最優先されるキー'}</td><td style="padding:4px"><select data-k="c">${Array.from({ length: R.c1 - R.c0 + 1 }, (_, j) => R.c0 + j).map(c => `<option value="${c}" ${c === L.c ? 'selected' : ''}>${esc(colLabel(c))}</option>`).join('')}</select></td><td style="padding:4px"><select disabled><option>セルの値</option></select></td><td style="padding:4px"><select data-k="o"><option value="0" ${!L.desc ? 'selected' : ''}>小さい順</option><option value="1" ${L.desc ? 'selected' : ''}>大きい順</option></select></td></tr>`).join('')}</table>`;
    body.querySelector('#sadd').onclick = () => { if (levels.length < 6) levels.push({ c: R.c0, desc: false }); draw(); };
    body.querySelector('#sdel').onclick = () => { if (levels.length > 1) levels.pop(); draw(); };
    body.querySelector('#shead').onchange = e => { header = e.target.checked; draw(); };
    body.querySelectorAll('tr[data-i]').forEach(tr => { const L = levels[+tr.dataset.i]; tr.querySelector('[data-k=c]').onchange = e => L.c = +e.target.value; tr.querySelector('[data-k=o]').onchange = e => L.desc = e.target.value === '1'; });
  };
  levels[0].c = Math.min(Math.max(a.c, R.c0), R.c1);
  draw();
  dialog({ title: '並べ替え', body, buttons: [{ label: 'OK', primary: true, action: () => { App.sortRange(R, levels, header); } }, { label: 'キャンセル' }] });
}
function cfDialog(kind) {
  needSel();
  const R = App.rect(), si = book().cur;
  const nums = []; App.eachIn(R, (r, c) => { const v = App.val(si, r, c); if (typeof v === 'number') nums.push(v); });
  const avg = nums.length ? E.fmtGeneral(E.roundTo(nums.reduce((a, b) => a + b, 0) / nums.length, 2)) : '';
  const s = [...nums].sort((a, b) => a - b);
  const presets = Object.entries(App.CF_PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
  const T = {
    gt: ['指定の値より大きい', '次の値より大きいセルを書式設定:', 1], lt: ['指定の値より小さい', '次の値より小さいセルを書式設定:', 1], eq: ['指定の値に等しい', '次の値に等しいセルを書式設定:', 1],
    between: ['指定の範囲内', '次の範囲内にあるセルを書式設定:', 2], text: ['文字列', '次の文字列を含むセルを書式設定:', 1], dup: ['重複する値', '次の値を含むセルを書式設定:', 0],
    top: ['上位 10 項目', '上位に入るセルを書式設定:', 'n'], topPct: ['上位 10%', '上位に入るセルを書式設定:', 'n'], bottom: ['下位 10 項目', '下位に入るセルを書式設定:', 'n'], bottomPct: ['下位 10%', '下位に入るセルを書式設定:', 'n'],
    above: ['平均より上', '選択範囲内で平均より上のセルを書式設定:', 0], below: ['平均より下', '選択範囲内で平均より下のセルを書式設定:', 0],
  }[kind];
  const def1 = kind === 'gt' ? (s.length ? E.fmtGeneral(s[Math.floor(s.length * .75)]) : '') : kind === 'lt' ? (s.length ? E.fmtGeneral(s[Math.floor(s.length * .25)]) : '') : kind === 'between' ? (s.length ? E.fmtGeneral(s[Math.floor(s.length * .25)]) : '') : kind === 'eq' ? avg : '';
  const def2 = s.length ? E.fmtGeneral(s[Math.floor(s.length * .75)]) : '';
  let inputs = '';
  if (T[2] === 1) inputs = `<input type="text" id="cv1" style="width:180px" value="${esc(def1)}">`;
  else if (T[2] === 2) inputs = `<input type="text" id="cv1" style="width:110px" value="${esc(def1)}"> と <input type="text" id="cv2" style="width:110px" value="${esc(def2)}">`;
  else if (T[2] === 'n') inputs = `<input type="number" id="cv1" style="width:70px" value="10" min="1"> ${kind.endsWith('Pct') ? '%' : ''}`;
  else if (kind === 'dup') inputs = `<select id="cv1"><option value="dup">重複</option><option value="uniq">一意</option></select>`;
  dialog({
    title: T[0], width: 460,
    body: `<p style="margin:4px 0 10px">${T[1]}</p><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${inputs}<span>書式:</span><select id="cst">${presets}</select></div>`,
    buttons: [{ label: 'OK', primary: true, action: d => {
      const v1 = d.querySelector('#cv1') && d.querySelector('#cv1').value, v2 = d.querySelector('#cv2') && d.querySelector('#cv2').value, st = d.querySelector('#cst').value;
      let rule;
      if (['gt', 'lt', 'eq', 'between', 'text'].includes(kind)) rule = { t: 'cell', op: kind, a: v1, b: v2, st };
      else if (kind === 'dup') rule = { t: 'cell', op: v1, st };
      else if (kind.startsWith('top') || kind.startsWith('bottom')) rule = { t: 'top', n: Math.max(1, +v1 || 10), bottom: kind.startsWith('bottom'), pct: kind.endsWith('Pct'), st };
      else rule = { t: 'avg', above: kind === 'above', st };
      addCF(rule);
    } }, { label: 'キャンセル' }],
    init: d => { const i = d.querySelector('#cv1'); if (i) { i.focus(); if (i.select) i.select(); } },
  });
}
function cfManageDialog() {
  const body = document.createElement('div'); body.style.width = '560px';
  const desc = f => {
    if (f.t === 'bar') return 'データ バー'; if (f.t === 'scale') return 'カラー スケール';
    if (f.t === 'top') return `${f.bottom ? '下位' : '上位'} ${f.n}${f.pct ? '%' : ' 項目'}`;
    if (f.t === 'avg') return f.above ? '平均より上' : '平均より下';
    return { gt: `セルの値 > ${f.a}`, lt: `セルの値 < ${f.a}`, eq: `セルの値 = ${f.a}`, between: `セルの値が ${f.a} と ${f.b} の間`, text: `"${f.a}" を含む`, dup: '重複する値', uniq: '一意の値' }[f.op] || '';
  };
  const draw = () => {
    const list = sheet().cf;
    body.innerHTML = `<p>このワークシートの書式ルール:</p><div class="cflist">${list.length ? list.map((f, i) => {
      const p = App.CF_PRESETS[f.st] || {};
      const sw = f.t === 'bar' ? `background:linear-gradient(90deg,${f.color},#fff)` : f.t === 'scale' ? `background:linear-gradient(90deg,${f.colors.join(',')})` : `background:${p.bg || '#fff'};color:${p.fc || '#000'}`;
      return `<div class="it"><span>${esc(desc(f))}</span><span style="${sw};border:1px solid #ccc;padding:1px 6px">Aaあぁ</span><span>=$${colName(f.c0)}$${f.r0 + 1}:$${colName(f.c1)}$${f.r1 + 1}</span><button class="btn" data-del="${i}" style="min-width:0">削除</button></div>`;
    }).join('') : '<div style="padding:10px;color:#777">ルールはありません。</div>'}</div>`;
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { App.commit(() => { sheet().cf.splice(+b.dataset.del, 1); }); draw(); });
  };
  draw();
  dialog({ title: '条件付き書式ルールの管理', body, buttons: [{ label: '閉じる', primary: true }] });
}
function tableDialog(color, medium) {
  needSel();
  let R = App.rect();
  if (App.isSingle(R)) R = App.currentRegion(App.getAct());
  dialog({
    title: 'テーブルの作成', width: 320,
    body: `<label class="f">テーブルに変換するデータ範囲を指定してください(W)</label><input type="text" id="tref" style="width:100%" value="=$${colName(R.c0)}$${R.r0 + 1}:$${colName(R.c1)}$${R.r1 + 1}"><label class="radio" style="margin-top:8px"><input type="checkbox" id="thead" checked>先頭行をテーブルの見出しとして使用する(M)</label>`,
    buttons: [{ label: 'OK', primary: true, action: d => {
      const X = App.parseRef(d.querySelector('#tref').value.replace(/\$/g, '')); if (!X) { App.alert('参照が正しくありません。'); return false; }
      const head = d.querySelector('#thead').checked;
      App.commit(() => {
        const sh = sheet();
        App.eachIn(X, (r, c) => {
          const x = App.cellOf(sh, r, c), i = r - X.r0;
          delete x.bg; delete x.fc;
          x.bd = Object.assign(x.bd || {}, { b: `thin ${tint(color, .4)}` });
          if (head && i === 0) { if (medium) { x.bg = color; x.fc = '#FFFFFF'; } x.b = true; x.bd.b = `thin ${color}`; }
          else if ((i - (head ? 1 : 0)) % 2 === 0) x.bg = tint(color, medium ? .8 : .85);
          if (r === X.r1) x.bd.b = `thin ${color}`;
          if (r === X.r0 && !medium) x.bd.t = `thin ${color}`;
          App.cleanCell(sh, keyOf(r, c));
        });
        if (head && !sh.filter) sh.filter = { r0: X.r0, r1: X.r1, c0: X.c0, c1: X.c1, crit: {} };
      });
    } }, { label: 'キャンセル' }],
  });
}
function noteDialog() {
  needSel();
  const a = App.getAct(), cell = actCell();
  dialog({
    title: 'メモ', width: 340,
    body: `<textarea id="nt" rows="6" style="width:100%;background:#ffffe1"></textarea>`,
    buttons: [{ label: 'OK', primary: true, action: d => { const t = d.querySelector('#nt').value; App.commit(() => { const x = App.cellOf(sheet(), a.r, a.c); if (t.trim()) x.note = t; else delete x.note; App.cleanCell(sheet(), keyOf(a.r, a.c)); }); } }, { label: 'キャンセル' }],
    init: d => { const t = d.querySelector('#nt'); t.value = cell.note || ''; t.focus(); },
  });
}
const SYMBOLS = '○●◎◇◆□■△▲▽▼☆★※〒→←↑↓⇒⇔∀∃∈∋⊆⊇⊂⊃∪∩∧∨¬∠⊥⌒∂∇≡≒≪≫√∽∝∵∴∫∬∞±×÷≠≦≧≈°′″℃¥$¢£€%‰§¶†‡♂♀♪♭♯Å〆々〃仝ー―‐～∥｜…‥‘’“”（）〔〕［］｛｝〈〉《》「」『』【】＋－＝＜＞①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡㍻〝〟№㏍℡㊤㊥㊦㊧㊨㈱㈲㈹㍾㍽㍼♠♣♥♦☎☀☁☂☃✓✔✕✖✗✘❤✉✂✈⚠⭕❌';
function symbolDialog() {
  let pick = null;
  dialog({
    title: '記号と特殊文字', width: 470,
    body: `<div class="symgrid" id="sg">${[...SYMBOLS].map(s => `<button>${s}</button>`).join('')}</div><div style="margin-top:8px;display:flex;align-items:center;gap:10px">選択した文字: <span id="sp" style="font-size:22px;min-width:30px;border:1px solid #ccc;text-align:center">&nbsp;</span></div>`,
    buttons: [{ label: '挿入(I)', primary: true, action: () => {
      if (!pick) return false;
      if (!App.isEditing()) { const a = App.getAct(); if (!App.startEdit('edit', App.rawForEdit(a))) return; App.editor.focus(); App.editor.setSelectionRange(App.editor.value.length, App.editor.value.length); }
      App.insertAtCaret(pick);
    } }, { label: '閉じる' }],
    init: d => { d.querySelector('#sg').onclick = e => { const b = e.target.closest('button'); if (!b) return; d.querySelectorAll('#sg .on').forEach(x => x.classList.remove('on')); b.classList.add('on'); pick = b.textContent; d.querySelector('#sp').textContent = pick; }; d.querySelector('#sg').ondblclick = () => d.querySelector('.df .pri').click(); },
  });
}
function insertFunctionDialog(cat) {
  const cats = ['最近使用した関数', 'すべて表示', '数学/三角', '統計', '論理', '文字列操作', '日付/時刻', '検索/行列', '情報'];
  let sel = null;
  const body = document.createElement('div'); body.style.width = '480px';
  body.innerHTML = `<label class="f">関数の検索(S):</label><div style="display:flex;gap:6px"><input type="text" id="ifq" style="flex:1" placeholder="何をしたいかを簡単に入力して、[検索開始] をクリックしてください。"><button class="btn" id="ifgo">検索開始(G)</button></div>
    <div style="margin:8px 0" class="grid2"><span>関数の分類(C):</span><select id="ifc">${cats.map(c => `<option ${c === (cat || '最近使用した関数') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <label class="f">関数名(N):</label><div class="listbox" id="ifl" style="height:170px"></div><div id="ifs" style="margin-top:8px;font-weight:700;min-height:18px"></div><div id="ifd" style="min-height:36px;color:#333"></div>`;
  const fill = names => {
    const l = body.querySelector('#ifl');
    l.innerHTML = names.map(n => `<div>${n}</div>`).join('');
    const pick = n => { sel = n; l.querySelectorAll('div').forEach(d => d.classList.toggle('on', d.textContent === n)); const info = E.FN_INFO[n]; body.querySelector('#ifs').textContent = info ? info[1] : ''; body.querySelector('#ifd').textContent = info ? info[2] : ''; };
    l.onclick = e => { const d = e.target.closest('div'); if (d && d.parentNode === l) pick(d.textContent); };
    l.ondblclick = () => dlg.el.querySelector('.df .pri').click();
    if (names.length) pick(names[0]);
  };
  const byCat = c => c === '最近使用した関数' ? book().recentFns.filter(n => E.FN_INFO[n]) : c === 'すべて表示' ? Object.keys(E.FN_INFO).sort() : fnsOf(c);
  const dlg = dialog({
    title: '関数の挿入', body,
    buttons: [{ label: 'OK', primary: true, action: () => { if (sel) insertFn(sel); } }, { label: 'キャンセル' }],
    init: d => {
      fill(byCat(cat || '最近使用した関数'));
      d.querySelector('#ifc').onchange = e => fill(byCat(e.target.value));
      const search = () => { const q = d.querySelector('#ifq').value.trim().toUpperCase(); if (!q) return; fill(Object.keys(E.FN_INFO).filter(n => n.includes(q) || E.FN_INFO[n][2].includes(d.querySelector('#ifq').value.trim()) || E.FN_INFO[n][1].includes(d.querySelector('#ifq').value.trim())).sort()); };
      d.querySelector('#ifgo').onclick = search;
      d.querySelector('#ifq').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); search(); } });
      d.querySelector('#ifq').focus();
    },
  });
}
function zoomDialog() {
  const z = sheet().zoom || 100;
  dialog({
    title: 'ズーム', width: 240,
    body: `<fieldset><legend>倍率</legend>${[200, 100, 75, 50, 25].map(v => `<label class="radio"><input type="radio" name="zm" value="${v}" ${v === z ? 'checked' : ''}>${v}%</label>`).join('')}<label class="radio"><input type="radio" name="zm" value="sel">選択範囲に合わせる(F)</label><label class="radio"><input type="radio" name="zm" value="c" ${[200, 100, 75, 50, 25].includes(z) ? '' : 'checked'}>指定(C): <input type="number" id="zc" style="width:60px" value="${z}" min="10" max="400">%</label></fieldset>`,
    buttons: [{ label: 'OK', primary: true, action: d => { const v = d.querySelector('input[name=zm]:checked').value; if (v === 'sel') CMD.zoomSel(); else setZoom(v === 'c' ? +d.querySelector('#zc').value : +v); } }, { label: 'キャンセル' }],
  });
}
function validationDialog() {
  needSel();
  const R = App.rect(), dv = actCell().dv || { type: 'any' };
  dialog({
    title: 'データの入力規則', width: 420,
    body: `<fieldset><legend>条件の設定</legend><div class="grid2"><span>入力値の種類(A):</span><select id="vt"><option value="any">すべての値</option><option value="whole">整数</option><option value="decimal">小数点数</option><option value="list">リスト</option><option value="len">文字列 (長さ指定)</option></select></div>
      <div id="vlist" style="margin-top:8px"><label class="f">元の値(S):</label><input type="text" id="vsrc" style="width:100%" placeholder="例: はい,いいえ,保留  または  =$A$1:$A$5"></div>
      <div id="vmm" class="grid2" style="margin-top:8px"><span>最小値(M):</span><input type="text" id="vmin" style="width:120px"><span>最大値(X):</span><input type="text" id="vmax" style="width:120px"></div></fieldset>
      <fieldset><legend>エラー メッセージ</legend><textarea id="vmsg" rows="3" style="width:100%" placeholder="（空欄の場合は既定のメッセージ）"></textarea></fieldset>`,
    buttons: [
      { label: 'すべてクリア(C)', left: true, action: () => { App.commit(() => { App.eachIn(R, (r, c) => { const x = App.cellOf(sheet(), r, c); delete x.dv; App.cleanCell(sheet(), keyOf(r, c)); }); }); } },
      { label: 'OK', primary: true, action: d => {
        const type = d.querySelector('#vt').value;
        const nd = type === 'any' ? null : { type, src: d.querySelector('#vsrc').value, min: d.querySelector('#vmin').value, max: d.querySelector('#vmax').value, msg: d.querySelector('#vmsg').value || undefined };
        if (nd && type === 'list' && !nd.src.trim()) { App.alert('元の値を入力してください。'); return false; }
        if (nd && type === 'list') nd.list = App.dvList(nd);
        App.commit(() => { App.eachIn(R, (r, c) => { const x = App.cellOf(sheet(), r, c); if (nd) x.dv = nd; else delete x.dv; App.cleanCell(sheet(), keyOf(r, c)); }); });
      } }, { label: 'キャンセル' }],
    init: d => {
      const vt = d.querySelector('#vt'), sync = () => { d.querySelector('#vlist').style.display = vt.value === 'list' ? '' : 'none'; d.querySelector('#vmm').style.display = ['whole', 'decimal', 'len'].includes(vt.value) ? '' : 'none'; };
      vt.value = dv.type; d.querySelector('#vsrc').value = dv.src || ''; d.querySelector('#vmin').value = dv.min || ''; d.querySelector('#vmax').value = dv.max || ''; d.querySelector('#vmsg').value = dv.msg || '';
      vt.onchange = sync; sync();
    },
  });
}
function dedupeDialog() {
  needSel();
  let R = App.rect(); if (App.isSingle(R)) R = App.currentRegion(App.getAct());
  if (App.isSingle(R)) return App.alert('重複を削除するデータ範囲を選択してください。');
  App.select({ r: R.r0, c: R.c0 }, { r: R.r1, c: R.c1 }, true);
  let header = App.guessHeader(R);
  const cols = Array.from({ length: R.c1 - R.c0 + 1 }, (_, i) => R.c0 + i);
  const body = document.createElement('div'); body.style.width = '380px';
  const draw = () => {
    body.innerHTML = `<p>重複する値を削除するには、重複が含まれている列を 1 つ以上選択してください。</p><div style="display:flex;gap:6px;margin-bottom:6px"><button class="btn" id="dall">すべて選択(A)</button><button class="btn" id="dnone">すべて選択解除(U)</button><label class="radio" style="margin-left:auto"><input type="checkbox" id="dhead" ${header ? 'checked' : ''}>先頭行をデータの見出しとして使用する(M)</label></div><div class="listbox" style="height:150px;padding:4px">${cols.map(c => `<label class="radio"><input type="checkbox" data-c="${c}" checked>${esc(header ? (App.displayText(book().cur, R.r0, c) || `列 ${colName(c)}`) : `列 ${colName(c)}`)}</label>`).join('')}</div>`;
    body.querySelector('#dall').onclick = () => body.querySelectorAll('[data-c]').forEach(b => b.checked = true);
    body.querySelector('#dnone').onclick = () => body.querySelectorAll('[data-c]').forEach(b => b.checked = false);
    body.querySelector('#dhead').onchange = e => { header = e.target.checked; draw(); };
  };
  draw();
  dialog({
    title: '重複の削除', body,
    buttons: [{ label: 'OK', primary: true, action: () => {
      const use = [...body.querySelectorAll('[data-c]:checked')].map(b => +b.dataset.c);
      if (!use.length) { App.alert('列を 1 つ以上選択してください。'); return false; }
      const si = book().cur, r0 = R.r0 + (header ? 1 : 0), seen = new Set(), keep = [];
      for (let r = r0; r <= R.r1; r++) { const k = use.map(c => E.toStr(App.val(si, r, c)).toLowerCase()).join('\u0001'); if (!seen.has(k)) { seen.add(k); keep.push(r); } }
      const removed = R.r1 - r0 + 1 - keep.length;
      if (!removed) { setTimeout(() => App.alert('重複する値は見つかりませんでした。'), 0); return; }
      App.commit(() => {
        const sh = sheet(), snap = {};
        for (let r = r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) snap[keyOf(r, c)] = sh.cells[keyOf(r, c)];
        for (let r = r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) delete sh.cells[keyOf(r, c)];
        keep.forEach((src, i) => { for (let c = R.c0; c <= R.c1; c++) { const x = snap[keyOf(src, c)]; if (x) { const n = JSON.parse(JSON.stringify(x)); if (isFormula(n.v)) n.v = App.engine.shiftFormula(n.v, r0 + i - src, 0); sh.cells[keyOf(r0 + i, c)] = n; } } });
      });
      setTimeout(() => App.alert(`${removed} 個の重複する値が見つかり、削除されました。${keep.length} 個の一意の値が残っています。`), 0);
    } }, { label: 'キャンセル' }],
  });
}
function moveCopyDialog() {
  const b = book(), cur = b.cur;
  dialog({
    title: '移動またはコピー', width: 320,
    body: `<p>選択したシートを移動します。</p><label class="f">挿入先(B):</label><div class="listbox" id="mcl" style="height:140px">${b.sheets.map((s, i) => `<div data-i="${i}">${esc(s.name)}</div>`).join('')}<div data-i="${b.sheets.length}">(末尾へ移動)</div></div><label class="radio" style="margin-top:8px"><input type="checkbox" id="mcc">コピーを作成する(C)</label>`,
    buttons: [{ label: 'OK', primary: true, action: d => { const on = d.querySelector('#mcl .on'); if (!on) return false; App.moveSheet(cur, +on.dataset.i, d.querySelector('#mcc').checked); } }, { label: 'キャンセル' }],
    init: d => { const l = d.querySelector('#mcl'); l.firstChild.classList.add('on'); l.onclick = e => { const x = e.target.closest('[data-i]'); if (!x) return; l.querySelectorAll('.on').forEach(y => y.classList.remove('on')); x.classList.add('on'); }; },
  });
}
function chartDataDialog() {
  const ch = sheet().charts[App.chartSel]; if (!ch) return;
  dialog({
    title: 'データ ソースの選択', width: 380,
    body: `<label class="f">グラフ データの範囲(D):</label><input type="text" id="cdr" style="width:100%" value="=${esc(sheet().name)}!$${ch.ref.replace(/([A-Z]+)(\d+)/g, '$1$$$2').replace(':', ':$')}"><p style="color:#555">例: =A1:C6</p>`,
    buttons: [{ label: '行/列の切り替え(W)', left: true, keep: true, action: () => { App.cmd('chartSwitch'); return false; } }, { label: 'OK', primary: true, action: d => { const R = App.parseRef(d.querySelector('#cdr').value.replace(/\$/g, '')); if (!R) { App.alert('参照が正しくありません。'); return false; } App.commit(() => { ch.ref = App.rangeName(R); }); } }, { label: 'キャンセル' }],
  });
}
function helpDialog() {
  dialog({
    title: 'ヘルプ', width: 620,
    body: `<div style="line-height:1.7"><h3 style="margin:4px 0">基本操作</h3><ul style="margin:0;padding-left:20px">
      <li>セルを選んでそのまま入力し、<b>Enter</b> で確定します（<b>Tab</b> で右へ、<b>Esc</b> で取り消し）。<b>Alt+Enter</b> でセル内改行。</li>
      <li>ダブルクリックまたは <b>F2</b> でセルを編集します。</li>
      <li><b>スマホ・iPad</b>：タップで選択、<b>ダブルタップで編集</b>、選択中のセルをもう一度タップすると<b>操作バー</b>（編集・切り取り・コピー・貼り付け・消去）が出ます。<b>長押ししたまま指を動かすとセルを移動</b>、右下の丸をドラッグすると範囲を広げられます。表示の大きさは、下の − ＋ ボタンで変えられます。</li>
      <li>選択範囲の<b>枠をドラッグするとセルを移動</b>できます（Ctrl キーを押しながらだとコピー）。コピー中は Enter キーでも貼り付けできます。</li>
      <li><b>=</b> で始めると数式になります。入力中にセルをクリック・ドラッグすると参照が入り、<b>F4</b> で $（絶対参照）を切り替えます。関数名を途中まで入力すると候補が表示され、<b>Tab</b> で確定できます。</li>
      <li>選択範囲の右下の ■（フィル ハンドル）をドラッグすると、コピーや連続データ（1, 2, 3… / 月, 火, 水… / 1月, 2月… / 日付）を作成できます。ダブルクリックで隣の列のデータの最後までコピーします。</li>
      <li>右クリックで、切り取り・コピー・貼り付け、行や列の挿入と削除、並べ替え、フィルター、メモ、セルの書式設定などが使えます。</li>
      <li>[ホーム] の [条件付き書式]、[テーブルとして書式設定]、[セルのスタイル] で表を見やすくできます。</li>
      <li>[挿入] タブからグラフを作成できます。グラフはデータに連動して更新され、ドラッグで移動・右下でサイズ変更できます。</li>
      <li>[データ] タブで並べ替え・フィルター・重複の削除・データの入力規則（ドロップダウン リスト）が使えます。</li>
      <li>[ファイル] から、Excel ファイル (.xlsx) や CSV の読み込み・保存、新しいブックの作成、印刷ができます。</li>
      <li>データはこのブラウザに自動保存されます（タイトルバーの [自動保存]）。別の端末に移すときは [ファイル] → [名前を付けて保存] で .xlsx をダウンロードしてください。</li></ul>
      <h3 style="margin:12px 0 4px">使える関数</h3><p style="margin:0">${Object.keys(E.FN_INFO).sort().join('、')}</p></div>`,
    buttons: [{ label: '閉じる', primary: true }],
  });
}
function shortcutsDialog() {
  const list = [['Ctrl+C / X / V', 'コピー / 切り取り / 貼り付け'], ['Ctrl+Z / Y', '元に戻す / やり直し'], ['Ctrl+B / I / U', '太字 / 斜体 / 下線'], ['Ctrl+1', 'セルの書式設定'], ['Ctrl+F / H', '検索 / 置換'], ['Ctrl+G', 'ジャンプ'],
    ['Ctrl+D / R', '下方向 / 右方向へコピー'], ['Ctrl+Enter', '選択範囲に同じ値を入力'], ['Ctrl+;', '今日の日付'], ['Ctrl+:', '現在の時刻'], ['Ctrl+Shift+L', 'フィルター'], ['Ctrl+T', 'テーブル'],
    ['Ctrl+矢印', 'データの端へ移動'], ['Ctrl+Shift+矢印', 'データの端まで選択'], ['Ctrl+Home / End', '先頭 / 最後のセルへ'], ['Ctrl+Space / Shift+Space', '列全体 / 行全体を選択'], ['Ctrl+A', 'すべて選択'],
    ['Ctrl+- / Ctrl++', 'セルの削除 / 挿入'], ['Ctrl+9 / 0', '行 / 列を表示しない'], ['Ctrl+PageUp / PageDown', '前 / 次のシート'], ['Shift+F11', '新しいシート'], ['Alt+=', 'オート SUM'], ['F2', 'セルの編集'], ['F4（編集中）', '参照の切り替え ($)'],
    ['Shift+F3', '関数の挿入'], ['F9', '再計算'], ['Ctrl+`', '数式の表示'], ['Ctrl+S', '上書き保存'], ['Ctrl+P', '印刷'], ['Alt+Enter', 'セル内で改行'], ['Ctrl+ホイール', 'ズーム']];
  dialog({ title: 'ショートカット キー', width: 520, body: `<table style="border-collapse:collapse;width:100%">${list.map(([k, v]) => `<tr><td style="padding:3px 10px 3px 0;white-space:nowrap;font-family:Consolas,monospace">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`).join('')}</table>`, buttons: [{ label: '閉じる', primary: true }] });
}

/* ================= ファイル（Backstage） ================= */
let bsEl = null;
function openBackstage(page) {
  if (App.isEditing()) App.commitEdit(0, 0);
  hideMenus(0);
  if (!bsEl) {
    bsEl = document.createElement('div'); bsEl.id = 'backstage';
    bsEl.innerHTML = `<nav><button class="back" title="戻る">←</button><button data-p="home">⌂ ホーム</button><button data-p="new">🗋 新規</button><button data-p="open">📂 開く</button><hr><button data-p="save">💾 名前を付けて保存</button><button data-p="print">🖶 印刷</button><hr><button data-p="about">ⓘ 情報</button></nav><main></main>`;
    document.body.appendChild(bsEl);
    bsEl.querySelector('.back').onclick = closeBackstage;
    bsEl.querySelector('nav').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) bsPage(b.dataset.p); });
    bsEl.addEventListener('keydown', e => { if (e.key === 'Escape') closeBackstage(); });
  }
  bsEl.hidden = false;
  bsPage(page || 'home');
}
App.openBackstage = openBackstage;
function closeBackstage() { if (bsEl) bsEl.hidden = true; App.focusNav(); }
const TEMPLATES = {
  blank: ['空白のブック', () => App.newBook(nextBookName())],
  budget: ['家計簿', () => { const b = App.sampleBook(); b.name = '家計簿'; return b; }],
  sales: ['売上集計表', () => {
    const b = App.newBook('売上集計表'), sh = b.sheets[0], set = (k, v, o) => { sh.cells[k] = Object.assign(v == null ? {} : { v }, o || {}); };
    const H = { b: true, bg: '#70AD47', fc: '#FFFFFF', al: 'c' };
    set('A1', '支店別 売上集計', { b: true, sz: 16, fc: '#375623' });
    ['支店', '4月', '5月', '6月', '合計', '平均', '達成'].forEach((h, i) => set(colName(i) + '3', h, H));
    [['東京', 820, 910, 1030], ['大阪', 640, 700, 690], ['名古屋', 450, 520, 580], ['福岡', 380, 360, 440], ['札幌', 300, 340, 390]].forEach(([n, a, b2, c], i) => {
      const r = i + 4; set('A' + r, n); set('B' + r, String(a), { fmt: 'comma' }); set('C' + r, String(b2), { fmt: 'comma' }); set('D' + r, String(c), { fmt: 'comma' });
      set('E' + r, `=SUM(B${r}:D${r})`, { fmt: 'comma', b: true }); set('F' + r, `=AVERAGE(B${r}:D${r})`, { fmt: 'comma', dec: 1 }); set('G' + r, `=IF(E${r}>=1500,"◎",IF(E${r}>=1200,"○","△"))`, { al: 'c' });
    });
    set('A9', '合計', { b: true, bd: { t: 'thin #70AD47', b: 'double #70AD47' } });
    ['B', 'C', 'D', 'E'].forEach(c => set(c + '9', `=SUM(${c}4:${c}8)`, { fmt: 'comma', b: true, bd: { t: 'thin #70AD47', b: 'double #70AD47' } }));
    sh.cf = [{ t: 'scale', colors: ['#F8696B', '#FFEB84', '#63BE7B'], r0: 3, r1: 7, c0: 4, c1: 4 }];
    sh.charts = [{ type: 'col', ref: 'A3:D8', x: 20, y: 270, w: 520, h: 280, title: '月別売上', pal: 'colorful' }];
    sh.colW = { 0: 80 };
    return b;
  }],
  schedule: ['週間スケジュール', () => {
    const b = App.newBook('週間スケジュール'), sh = b.sheets[0], set = (k, v, o) => { sh.cells[k] = Object.assign(v == null ? {} : { v }, o || {}); };
    set('A1', '週間スケジュール', { b: true, sz: 16, fc: '#44546A' });
    const days = ['月', '火', '水', '木', '金', '土', '日'];
    set('A3', '時間', { b: true, bg: '#44546A', fc: '#FFFFFF', al: 'c' });
    days.forEach((d, i) => set(colName(i + 1) + '3', d, { b: true, bg: i >= 5 ? '#ED7D31' : '#4472C4', fc: '#FFFFFF', al: 'c' }));
    for (let h = 8; h <= 20; h++) { const r = h - 4; set('A' + r, `${h}:00`, { fmt: 'hm', al: 'c', bg: '#F2F2F2' }); for (let i = 1; i <= 7; i++) set(colName(i) + r, null, { bd: { b: 'thin #D9D9D9', r: 'thin #D9D9D9' } }); }
    sh.colW = { 0: 60, 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 100 };
    sh.freeze = { r: 3, c: 1 };
    return b;
  }],
};
function nextBookName() { const names = new Set(App.listBooks().map(x => x.name)); let n = 1; while (names.has('Book' + n)) n++; return 'Book' + n; }
function newBook(tpl) { const b = TEMPLATES[tpl || 'blank'][1](); App.openBook(b, null); closeBackstage(); }
function tplThumb(k) {
  if (k === 'blank') return ICONS.newBook;
  const col = { budget: '#4472C4', sales: '#70AD47', schedule: '#44546A' }[k];
  return `<svg width="120" height="88" viewBox="0 0 120 88"><rect width="120" height="88" fill="#fff"/><rect x="8" y="8" width="60" height="6" fill="${col}" opacity=".7"/><rect x="8" y="20" width="104" height="9" fill="${col}"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="8" y="${31 + i * 9}" width="104" height="8" fill="${i % 2 ? App.mix(col, '#ffffff', .8) : '#fff'}" stroke="#eee"/>`).join('')}${k === 'sales' ? `<rect x="80" y="40" width="6" height="30" fill="${col}"/><rect x="90" y="50" width="6" height="20" fill="#ED7D31"/>` : ''}</svg>`;
}
function bsPage(p) {
  bsEl.querySelectorAll('nav [data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  const main = bsEl.querySelector('main');
  const tiles = keys => `<div class="tiles">${keys.map(k => `<button class="tile" data-tpl="${k}"><div class="thumb">${tplThumb(k)}</div>${TEMPLATES[k][0]}</button>`).join('')}</div>`;
  const recent = () => {
    const list = App.listBooks();
    return `<table class="recent"><tr><th>名前</th><th>更新日時</th><th></th></tr>${list.map(x => `<tr class="it" data-id="${x.id}"><td>📗 ${esc(x.name)}${x.id === App.bookId() ? ' <span style="color:#217346">(開いています)</span>' : ''}</td><td>${new Date(x.updated).toLocaleString('ja-JP')}</td><td>${x.id === App.bookId() ? '' : `<button class="del" data-del="${x.id}" title="削除">🗑</button>`}</td></tr>`).join('')}</table>`;
  };
  if (p === 'home') main.innerHTML = `<h2>こんにちは</h2>${tiles(['blank', 'budget', 'sales', 'schedule'])}<h3>最近使ったアイテム（このブラウザに保存されたブック）</h3>${recent()}`;
  else if (p === 'new') main.innerHTML = `<h2>新規</h2>${tiles(Object.keys(TEMPLATES))}`;
  else if (p === 'open') main.innerHTML = `<h2>開く</h2><button class="bsbtn" id="bsXlsx"><span data-icon="open32"></span><span>ファイルを参照<small>Excel ブック (.xlsx / .xls / .ods) を開きます</small></span></button><button class="bsbtn" id="bsCsv"><span data-icon="csv32"></span><span>テキストまたは CSV<small>新しいシートとして読み込みます（UTF-8 / Shift_JIS）</small></span></button><h3>このブラウザに保存されたブック</h3>${recent()}`;
  else if (p === 'save') main.innerHTML = `<h2>名前を付けて保存</h2><div class="bsform"><label>ファイル名</label><input id="bsName" value="${esc(book().name)}"><label>ファイルの種類</label><select id="bsType"><option value="xlsx">Excel ブック (*.xlsx)</option><option value="csv">CSV UTF-8 (コンマ区切り) (*.csv) - 現在のシート</option><option value="browser">このブラウザに保存（名前の変更のみ）</option></select><span></span><button class="bigbtn" id="bsSave"><span data-icon="download32"></span>保存</button></div><p style="color:#666;margin-top:20px;max-width:560px">※ .xlsx には値・数式・表示形式・列の幅・セルの結合が保存されます。色や罫線などの装飾は Excel ファイルには含まれません（このブラウザ内の保存にはすべて含まれます）。</p>`;
  else if (p === 'print') {
    const pg = sheet().page;
    main.innerHTML = `<h2>印刷</h2><div class="bsform"><label>印刷の向き</label><select id="pO"><option value="portrait">縦方向</option><option value="landscape">横方向</option></select><label>用紙サイズ</label><select id="pS"><option value="A4">A4</option><option value="A3">A3</option><option value="B5">B5 (JIS)</option><option value="letter">レター</option></select><label>余白</label><select id="pM"><option value="normal">標準の余白</option><option value="wide">広い余白</option><option value="narrow">狭い余白</option></select><label>枠線</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pG">枠線を印刷する</label><label>見出し</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pH">行列番号を印刷する</label><span></span><button class="bigbtn" id="bsPrint"><span data-icon="print32"></span>印刷</button></div>`;
    main.querySelector('#pO').value = pg.orient; main.querySelector('#pS').value = pg.size; main.querySelector('#pM').value = pg.margin; main.querySelector('#pG').checked = pg.grid; main.querySelector('#pH').checked = pg.heads;
    main.querySelector('#bsPrint').onclick = () => { Object.assign(sheet().page, { orient: main.querySelector('#pO').value, size: main.querySelector('#pS').value, margin: main.querySelector('#pM').value, grid: main.querySelector('#pG').checked, heads: main.querySelector('#pH').checked }); App.afterChange(); closeBackstage(); setTimeout(doPrint, 50); };
  } else if (p === 'about') main.innerHTML = `<h2>情報</h2><p style="font-size:14px">${esc(book().name)}</p><table class="recent" style="max-width:520px"><tr><td>バージョン</td><td>${esc((/[?&]v=([^&]+)/.exec((document.querySelector('script[src*="ui.js"]') || {}).src || '') || [, '不明'])[1])}</td></tr><tr><td>シート数</td><td>${book().sheets.length}</td></tr><tr><td>保存先</td><td>このブラウザ（localStorage）</td></tr><tr><td>自動保存</td><td>${$('autosaveBtn').classList.contains('on') ? 'オン' : 'オフ'}</td></tr></table><p style="color:#666;max-width:560px;margin-top:16px">ブラウザのデータを消去すると、保存したブックも消えます。大切なデータは [名前を付けて保存] で .xlsx としてダウンロードしてください。</p>`;
  paintIcons(main);
  main.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => newBook(b.dataset.tpl));
  main.querySelectorAll('tr.it').forEach(tr => tr.onclick = e => { if (e.target.closest('[data-del]')) return; if (tr.dataset.id !== App.bookId()) App.openStoredBook(tr.dataset.id); closeBackstage(); });
  main.querySelectorAll('[data-del]').forEach(b => b.onclick = () => App.confirm('このブックをブラウザから削除しますか？', () => { App.deleteBook(b.dataset.del); bsPage(p); }, { ok: '削除' }));
  const x = main.querySelector('#bsXlsx'); if (x) x.onclick = () => $('fileXlsx').click();
  const c = main.querySelector('#bsCsv'); if (c) c.onclick = () => $('fileCsv').click();
  const s = main.querySelector('#bsSave');
  if (s) s.onclick = async () => {
    const name = main.querySelector('#bsName').value.trim() || book().name, type = main.querySelector('#bsType').value;
    if (name !== book().name) { book().name = name; App.afterChange(); }
    if (type === 'xlsx') { try { await exportXlsx(); } catch (e) { App.alert('Excel ファイルを作成できませんでした。インターネットに接続されているか確認してください。'); return; } }
    else if (type === 'csv') exportCsv();
    else App.saveNow();
    closeBackstage();
    App.toast(type === 'browser' ? 'このブラウザに保存しました' : 'ダウンロードしました');
  };
}

/* ================= 入出力 ================= */
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCsv() { const b = csvBlob(); if (b) download(b, `${book().name}_${sheet().name}.csv`); }
function csvBlob() {
  const U = App.usedRect(); if (!U) { App.alert('このシートは空です。'); return null; }
  const si = book().cur, lines = [];
  for (let r = 0; r <= U.r1; r++) {
    const row = [];
    for (let c = 0; c <= U.c1; c++) {
      const cell = cellAt(r, c), v = App.val(si, r, c);
      let t = cell && cell.fmt && /date|time|hm|md|datetime/.test(cell.fmt) ? App.displayText(si, r, c) : isErr(v) ? v.code : E.toStr(v);
      if (/[",\n\r]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      row.push(t);
    }
    lines.push(row.join(','));
  }
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv' });
}
$('fileCsv').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const buf = await f.arrayBuffer();
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder('shift_jis').decode(buf); }
  text = text.replace(/^\uFEFF/, '');
  const d = /\.tsv$/i.test(f.name) || (!text.includes(',') && text.includes('\t')) ? '\t' : ',';
  const rows = App.parseDelim(text, d);
  let base = f.name.replace(/\.[^.]+$/, '').replace(new RegExp(`[^\\w${E.JP}]`, 'g'), '_');
  if (!E.SHEET_NAME_RE.test(base)) base = 'CSV_' + base;
  let name = base, n = 2; while (App.sheetIdx(name) >= 0) name = base + '_' + n++;
  const sh = App.newSheet(name);
  rows.slice(0, App.ROWS).forEach((row, r) => row.slice(0, App.COLS).forEach((v, c) => { if (v === '') return; const x = { v }; const p = E.parseInput(v); if (p.fmt) x.fmt = p.fmt; if (/^[=＝]/.test(v)) x.v = "'" + v; sh.cells[keyOf(r, c)] = x; }));
  App.commit(() => { book().sheets.push(sh); book().cur = book().sheets.length - 1; App.setSel({ r: 0, c: 0 }); }, { any: true });
  closeBackstage();
  for (let c = 0; c < Math.min(App.COLS, (rows[0] || []).length); c++) { const w = autofitCol(c); if (w && w > App.DEFW) sh.colW[c] = Math.min(300, w); }
  App.refresh();
  if (rows.length > App.ROWS || rows.some(r => r.length > App.COLS)) App.alert(`${App.ROWS} 行 × ${App.COLS} 列を超える部分は読み込んでいません。`);
};
function loadXLSX() {
  return new Promise((res, rej) => {
    if (window.XLSX) return res(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('load'));
    document.head.appendChild(s);
  });
}
const FMT_Z = { number: d => '0' + (d ? '.' + '0'.repeat(d) : ''), comma: d => '#,##0' + (d ? '.' + '0'.repeat(d) : ''), currency: d => '"¥"#,##0' + (d ? '.' + '0'.repeat(d) : ''), accounting: d => '_ "¥"* #,##0' + (d ? '.' + '0'.repeat(d) : '') + '_ ', pct: d => '0' + (d ? '.' + '0'.repeat(d) : '') + '%', sci: d => '0.' + '0'.repeat(d ?? 2) + 'E+00', date: () => 'yyyy/m/d', ldate: () => 'yyyy"年"m"月"d"日"', md: () => 'm"月"d"日"', time: () => 'h:mm:ss', hm: () => 'h:mm', datetime: () => 'yyyy/m/d h:mm', text: () => '@', frac: () => '# ?/?' };
function zToFmt(z) {
  if (!z || z === 'General' || z === 'general') return null;
  const dec = s => { const m = /\.(0+)/.exec(s); return m ? m[1].length : 0; };
  if (/^0(\.0+)?%$/.test(z)) return { fmt: 'pct', dec: dec(z) };
  if (/^#,##0(\.0+)?(_\))?$/.test(z)) return { fmt: 'comma', dec: dec(z) };
  if (/^0(\.0+)?$/.test(z)) return { fmt: 'number', dec: dec(z) };
  if (/¥|\\\\|\[\$¥/.test(z) && /#,##0/.test(z)) return { fmt: 'currency', dec: dec(z.split(';')[0]) };
  if (/^0\.0+E\+0+$/i.test(z)) return { fmt: 'sci', dec: dec(z) };
  if (/^@$/.test(z)) return { fmt: 'text' };
  if (/^(yyyy|yy)[/-]m{1,2}[/-]d{1,2}$|^m\/d\/yy(yy)?$|^yyyy\\?\/m\\?\/d$/i.test(z)) return { fmt: 'date' };
  if (/^yyyy"年"m{1,2}"月"d{1,2}"日"$/.test(z)) return { fmt: 'ldate' };
  if (/^\[?\$-?[^\]]*\]?/.test(z) && /yyyy|ge/.test(z)) return { fmt: 'custom', code: z.replace(/\[[^\]]*\]/g, '') };
  if (/^h{1,2}:mm:ss$/i.test(z)) return { fmt: 'time' };
  if (/^h{1,2}:mm$/i.test(z)) return { fmt: 'hm' };
  return { fmt: 'custom', code: z.replace(/\[[^\]]*\]/g, '').replace(/\\/g, '') };
}
async function importXlsx(file) {
  let X;
  try { X = await loadXLSX(); } catch (e) { App.alert('Excel ファイルを読み込む部品を取得できませんでした。インターネットに接続されているか確認してください。'); return; }
  const buf = await file.arrayBuffer();
  let wb;
  try { wb = X.read(buf, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true }); }
  catch (e) { App.alert('このファイルは読み込めませんでした。'); return; }
  const b = App.newBook(file.name.replace(/\.[^.]+$/, ''));
  const rename = {};
  const used = new Set();
  b.sheets = wb.SheetNames.slice(0, 50).map(name => {
    let nn = name.replace(new RegExp(`[^\\w${E.JP}]`, 'g'), '_');
    if (!E.SHEET_NAME_RE.test(nn)) nn = 'S_' + nn;
    while (used.has(nn.toLowerCase())) nn += '_';
    used.add(nn.toLowerCase());
    rename[name] = nn;
    return App.newSheet(nn);
  });
  let truncated = false;
  wb.SheetNames.slice(0, 50).forEach((name, si) => {
    const ws = wb.Sheets[name], sh = b.sheets[si];
    if (!ws || !ws['!ref']) return;
    const rg = X.utils.decode_range(ws['!ref']);
    if (rg.e.r >= App.ROWS || rg.e.c >= App.COLS) truncated = true;
    for (let r = rg.s.r; r <= Math.min(rg.e.r, App.ROWS - 1); r++) for (let c = rg.s.c; c <= Math.min(rg.e.c, App.COLS - 1); c++) {
      const cell = ws[X.utils.encode_cell({ r, c })]; if (!cell) continue;
      const x = {};
      if (cell.f) {
        let f = cell.f;
        for (const [o, nn] of Object.entries(rename)) { if (o === nn) continue; f = f.split(`'${o.replace(/'/g, "''")}'!`).join(nn + '!').split(o + '!').join(nn + '!'); }
        x.v = '=' + f.replace(/_xlfn\.|_xlws\./g, '');
      } else if (cell.t === 'n') x.v = String(cell.v);
      else if (cell.t === 'b') x.v = cell.v ? 'TRUE' : 'FALSE';
      else if (cell.t === 'e') x.v = cell.w || '#N/A';
      else if (cell.t === 'd') { const d = new Date(cell.v); x.v = String(E.serial(d.getFullYear(), d.getMonth() + 1, d.getDate())); x.fmt = 'date'; }
      else if (cell.v != null && cell.v !== '') { x.v = String(cell.v); if (/^[=＝']/.test(x.v) || (typeof E.parseLiteral(x.v) !== 'string')) x.v = "'" + x.v; }
      const z = zToFmt(cell.z);
      if (z && cell.t === 'n' || (z && cell.f)) Object.assign(x, z);
      if (cell.s) {
        const fg = cell.s.fgColor && cell.s.fgColor.rgb;
        if (fg && cell.s.patternType === 'solid' && /^[0-9A-F]{6,8}$/i.test(fg)) x.bg = '#' + fg.slice(-6);
      }
      if (x.v != null || x.bg) sh.cells[keyOf(r, c)] = x;
    }
    (ws['!merges'] || []).forEach(m => { if (m.e.r < App.ROWS && m.e.c < App.COLS) sh.merges.push({ r0: m.s.r, c0: m.s.c, r1: m.e.r, c1: m.e.c }); });
    (ws['!cols'] || []).forEach((ci, i) => { if (!ci || i >= App.COLS) return; if (ci.hidden) sh.hidC.push(i); const w = ci.wpx || (ci.wch ? ci.wch * 7 + 5 : ci.width ? ci.width * 7 + 5 : 0); if (w) sh.colW[i] = Math.round(w); });
    (ws['!rows'] || []).forEach((ri, i) => { if (!ri || i >= App.ROWS) return; if (ri.hidden) sh.hidR.push(i); if (ri.hpx) sh.rowH[i] = Math.round(ri.hpx); else if (ri.hpt) sh.rowH[i] = Math.round(ri.hpt / .75); });
  });
  App.openBook(b, null);
  closeBackstage();
  if (truncated) App.alert(`このブックは ${App.ROWS} 行 × ${App.COLS} 列 (A〜${colName(App.COLS - 1)}) を超える部分があるため、その部分は読み込んでいません。`);
}
$('fileXlsx').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importXlsx(f); };
async function exportXlsx() { download(await xlsxBlob(), (book().name || 'Book1') + '.xlsx'); }
async function xlsxBlob() {
  const X = await loadXLSX();
  const wb = X.utils.book_new(), b = book();
  b.sheets.forEach((sh, si) => {
    const ws = {}; let maxR = 0, maxC = 0;
    for (const [k, cell] of Object.entries(sh.cells)) {
      const p = parseKey(k); if (!p || cell.v == null || cell.v === '') continue;
      const v = App.val(si, p.r, p.c), o = {};
      if (isFormula(cell.v)) o.f = cell.v.slice(1);
      if (typeof v === 'number') { o.t = 'n'; o.v = v; }
      else if (typeof v === 'boolean') { o.t = 'b'; o.v = v; }
      else if (isErr(v)) { o.t = 's'; o.v = v.code; }
      else { o.t = 's'; o.v = v == null ? '' : String(v); }
      const z = cell.fmt === 'custom' ? cell.code : FMT_Z[cell.fmt] ? FMT_Z[cell.fmt](cell.dec ?? DEC_DEFAULT[cell.fmt]) : (cell.dec != null && typeof v === 'number' ? FMT_Z.number(cell.dec) : (App.autoFmt(cell).fmt && FMT_Z[App.autoFmt(cell).fmt] ? FMT_Z[App.autoFmt(cell).fmt]() : null));
      if (z) o.z = z;
      if (cell.fmt === 'number' && cell.sep) o.z = FMT_Z.comma(cell.dec ?? 2);
      ws[X.utils.encode_cell({ r: p.r, c: p.c })] = o;
      maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c);
    }
    ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    ws['!cols'] = Array.from({ length: maxC + 1 }, (_, c) => sh.hidC.includes(c) ? { hidden: true } : { wch: Math.round(((sh.colW[c] || App.DEFW) - 5) / 7 * 100) / 100 });
    const rows = []; for (const [r, h] of Object.entries(sh.rowH)) rows[+r] = { hpx: h }; sh.hidR.forEach(r => { rows[r] = Object.assign(rows[r] || {}, { hidden: true }); });
    if (rows.length) ws['!rows'] = rows;
    if (sh.merges.length) ws['!merges'] = sh.merges.map(m => ({ s: { r: m.r0, c: m.c0 }, e: { r: m.r1, c: m.c1 } }));
    X.utils.book_append_sheet(wb, ws, sh.name);
  });
  return new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


/* ================= 保存パネル ================= */
function saveDialog() {
  if (App.isEditing()) App.commitEdit(0, 0);
  const safe = n => (n || 'Book1').replace(/[\\/:*?"<>|]/g, '_');
  const canShare = !!(navigator.canShare && window.File && (() => { try { return navigator.canShare({ files: [new File(['x'], 'a.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] }); } catch (e) { return false; } })());
  const body = document.createElement('div');
  body.style.cssText = 'width:min(420px,calc(100vw - 64px))';
  body.innerHTML = `<label class="f">ファイル名</label><input type="text" id="svName" style="width:100%;height:32px;font-size:16px">
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
      <button class="bsbtn" data-s="browser" style="max-width:none;border-color:#d0d0d0"><span style="font-size:22px;width:32px;text-align:center">💾</span><span><b>このブラウザに保存</b><small>この端末のこのブラウザに保存します（次に開いたときもそのまま残ります）</small></span></button>
      ${canShare ? `<button class="bsbtn" data-s="share" style="max-width:none;border-color:#d0d0d0"><span style="font-size:22px;width:32px;text-align:center">📤</span><span><b>ファイルとして保存・共有</b><small>「ファイル」アプリに保存したり、LINE やメールで送ったりできます (.xlsx)</small></span></button>` : ''}
      <button class="bsbtn" data-s="xlsx" style="max-width:none;border-color:#d0d0d0"><span data-icon="xlsx32"></span><span><b>Excel ファイルをダウンロード (.xlsx)</b><small>Excel やスマホの表計算アプリで開けます</small></span></button>
      <button class="bsbtn" data-s="csv" style="max-width:none;border-color:#d0d0d0"><span data-icon="csv32"></span><span><b>CSV をダウンロード</b><small>今のシートだけを保存します</small></span></button>
    </div><p id="svMsg" style="color:#555;min-height:18px;margin:10px 0 0"></p>`;
  const d = dialog({ title: '保存', body, buttons: [{ label: '閉じる' }] });
  paintIcons(body);
  const name = body.querySelector('#svName'), msg = body.querySelector('#svMsg');
  name.value = book().name;
  const applyName = () => { const n = name.value.trim(); if (n && n !== book().name) { book().name = n; App.afterChange(); } };
  body.addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    applyName();
    const kind = b.dataset.s, fname = safe(book().name);
    try {
      if (kind === 'browser') { if (App.saveNow()) { d.close(); App.toast('このブラウザに保存しました'); } else msg.textContent = '保存できませんでした（ブラウザの容量が足りないか、プライベートモードの可能性があります）。'; return; }
      if (kind === 'csv') { const bl = csvBlob(); if (bl) { download(bl, `${fname}_${safe(sheet().name)}.csv`); d.close(); App.toast('ダウンロードしました'); } return; }
      msg.textContent = 'ファイルを作成しています…';
      const blob = await xlsxBlob();
      App.saveNow();
      if (kind === 'share') {
        const file = new File([blob], fname + '.xlsx', { type: blob.type });
        try { await navigator.share({ files: [file], title: fname }); d.close(); }
        catch (err) { if (err && err.name === 'AbortError') msg.textContent = ''; else { download(blob, fname + '.xlsx'); d.close(); } }
        return;
      }
      download(blob, fname + '.xlsx'); d.close(); App.toast('ダウンロードしました');
    } catch (err) { msg.textContent = 'Excel ファイルを作成できませんでした。インターネットに接続されているか確認してください。'; }
  });
}
App.saveDialog = saveDialog;

/* ================= 印刷 ================= */
function doPrint() {
  if (App.isEditing()) App.commitEdit(0, 0);
  const sh = sheet(), U = App.usedRect(sh) || { r0: 0, r1: 0, c0: 0, c1: 0 };
  let r1 = U.r1, c1 = U.c1;
  const z = sh.zoom; if (z !== 100) { sh.zoom = 100; App.render(); }
  App.chartSel = null; App.paintSel();
  const pa = $('printArea');
  pa.className = sh.page.grid ? 'pgrid' : '';
  const t = document.createElement('table');
  let w = sh.page.heads ? 40 : 0;
  let cg = '<colgroup>' + (sh.page.heads ? '<col style="width:40px">' : '');
  for (let c = 0; c <= c1; c++) { const cw = App.colW(c); w += cw; cg += `<col style="width:${cw}px">`; }
  t.innerHTML = cg + '</colgroup>';
  t.style.width = w + 'px';
  const tb = document.createElement('tbody');
  if (sh.page.heads) { const tr = document.createElement('tr'); tr.innerHTML = '<th></th>' + Array.from({ length: c1 + 1 }, (_, c) => `<th>${colName(c)}</th>`).join(''); tb.appendChild(tr); }
  for (let r = 0; r <= r1; r++) {
    if (App.isRowHidden(r)) continue;
    const tr = document.createElement('tr'); tr.style.height = App.rowH(r) + 'px';
    if (sh.page.heads) tr.innerHTML = `<th>${r + 1}</th>`;
    for (let c = 0; c <= c1; c++) {
      const td = App.tds[r][c];
      if (td._cov) continue;
      const cl = td.cloneNode(true);
      cl.querySelectorAll('.fbtn,#fh').forEach(x => x.remove());
      cl.style.boxShadow = ''; cl.style.position = ''; cl.style.top = ''; cl.style.left = '';
      if (td.colSpan > 1 && c + td.colSpan - 1 > c1) cl.colSpan = c1 - c + 1;
      tr.appendChild(cl);
    }
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  pa.innerHTML = ''; pa.appendChild(t);
  // グラフも印刷
  sh.charts.forEach(ch => { const d = document.createElement('div'); d.style.cssText = `width:${ch.w}px;height:${ch.h}px;margin-top:12px;border:1px solid #d9d9d9;page-break-inside:avoid`; d.innerHTML = App.drawChart(ch, ch.w, ch.h, 1); pa.appendChild(d); });
  const size = { A4: 'A4', A3: 'A3', B5: '182mm 257mm', letter: 'letter' }[sh.page.size] || 'A4';
  const margin = { normal: '19mm 18mm', wide: '25mm 25mm', narrow: '19mm 6mm' }[sh.page.margin] || '19mm 18mm';
  let ps = $('pageStyle'); if (!ps) { ps = document.createElement('style'); ps.id = 'pageStyle'; document.head.appendChild(ps); }
  ps.textContent = `@page{size:${size.includes('mm') ? (sh.page.orient === 'landscape' ? '257mm 182mm' : size) : size + ' ' + sh.page.orient};margin:${margin}}`;
  const restore = () => { if (z !== 100) { sh.zoom = z; App.render(); App.updateSel(); } };
  setTimeout(() => { window.print(); restore(); }, 30);
}

/* ================= その他の結線 ================= */
$('autosaveBtn').onclick = () => App.setAutosave(!$('autosaveBtn').classList.contains('on'));
$('docTitle').onclick = () => App.prompt('ブック名の変更', book().name, v => { if (v.trim()) { book().name = v.trim(); App.afterChange(); } }, 'ブック名:');
$('fFx').addEventListener('mousedown', e => e.preventDefault());
$('fFx').onclick = () => insertFunctionDialog();
$('fbarExpand').onclick = () => { const f = $('fbar'); f.classList.toggle('tall'); $('fbarExpand').innerHTML = ICONS[f.classList.contains('tall') ? 'collapse' : 'expand']; };
$('zoomRange').oninput = e => setZoom(+e.target.value);
$('zoomPct').onclick = () => zoomDialog();
App.wrap.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom((sheet().zoom || 100) + (e.deltaY < 0 ? 10 : -10)); }, { passive: false });
const ts = $('tsearch');
ts.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && !e.isComposing && ts.value.trim()) {
    const q = ts.value.trim().toUpperCase();
    if (E.FN_INFO[q]) { insertFn(q); ts.value = ''; return; }
    findDialog('find'); setTimeout(() => App.findNextText && App.findNextText(ts.value.trim()), 0);
  }
  if (e.key === 'Escape') { ts.value = ''; App.focusNav(); }
});
document.addEventListener('keydown', e => {
  if (e.altKey && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); ts.focus(); }
  if (e.ctrlKey && e.key === 'F1') { e.preventDefault(); App.cmd('toggleRibbon'); }
  const ae = document.activeElement;
  if (!App.isEditing() && (!ae || ae === document.body || (ae.closest && ae.closest('#ribbon,#tabbar,#sheetbar,#statusbar') && ae.tagName === 'BUTTON')) && !document.querySelector('dialog[open]') && !openMenus.length && !(bsEl && !bsEl.hidden)) {
    if (e.key === 'Tab' || e.key.startsWith('F') && e.key.length > 1 && e.key !== 'F2' && e.key !== 'F4' && e.key !== 'F9') return;
    App.navKey(e);
    if (!App.isEditing()) App.focusNav();
  }
});
document.addEventListener('mousedown', e => { const rb = $('ribbon'); if (rb.classList.contains('peek') && !e.target.closest('#ribbon,#tabbar,.menu')) rb.classList.remove('peek'); });
addEventListener('beforeunload', () => { if (book() && $('autosaveBtn').classList.contains('on')) App.saveNow(); });

/* ================= 起動 ================= */
paintIcons();
App.init();
fitRibbon();
})();
