/* リボン用アイコン（SVG） */
(function () {
const s16 = b => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
const s32 = b => `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
const G = '#217346', B = '#2b6cc4', R = '#c43e1c', Y = '#e8a33a', GR = '#7a7a7a';
const lines = (ys, xs) => ys.map((y, i) => `<path d="M${xs[i][0]} ${y}H${xs[i][1]}"/>`).join('');
const txt = (t, x, y, sz, extra = '') => `<text x="${x}" y="${y}" font-size="${sz}" fill="currentColor" stroke="none" font-family="Segoe UI,Arial,sans-serif" ${extra}>${t}</text>`;
const gridSm = (x, y, w, h, c = '#8a8a8a') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${c}"/><path d="M${x} ${y + h / 3}H${x + w}M${x} ${y + 2 * h / 3}H${x + w}M${x + w / 2} ${y}V${y + h}" stroke="${c}"/>`;

window.ICONS = {
  /* ---- QAT / 共通 ---- */
  appicon: `<svg width="24" height="24" viewBox="0 0 24 24"><rect x="5" y="2" width="17" height="20" rx="1.5" fill="#fff"/><path d="M8 7h11M8 11h11M8 15h11M13 4v16" stroke="${G}" stroke-width="1.2"/><rect x="1.5" y="6" width="10" height="12" rx="1" fill="#185c37"/><path d="M4 9l5 6M9 9l-5 6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  save: s16(`<path d="M2.5 2.5h9l2 2v9h-11z" stroke="#fff"/><path d="M4.5 2.5v4h6v-4M4.5 13.5v-4h7v4" stroke="#fff"/>`),
  undo: s16(`<path d="M5 3 2 6l3 3"/><path d="M2.5 6H10a3.5 3.5 0 0 1 0 7H6"/>`),
  redo: s16(`<path d="m11 3 3 3-3 3"/><path d="M13.5 6H6a3.5 3.5 0 0 0 0 7h4"/>`),
  search: s16(`<circle cx="6.5" cy="6.5" r="4"/><path d="m9.5 9.5 4 4"/>`),
  /* ---- クリップボード ---- */
  paste32: s32(`<rect x="6" y="6" width="17" height="22" rx="1.5" fill="#d8b98a" stroke="#8a6a3a"/><rect x="10" y="3.5" width="9" height="5" rx="1" fill="#fff" stroke="#555"/><path d="M14 13h14v16H14z" fill="#fff" stroke="#555"/><path d="M17 17h8M17 20h8M17 23h8M17 26h5" stroke="#888"/>`),
  cut: s16(`<circle cx="4.5" cy="11.5" r="2"/><circle cx="11.5" cy="11.5" r="2"/><path d="M6 10 11.5 2.5M10 10 4.5 2.5"/>`),
  copy: s16(`<rect x="5.5" y="5.5" width="8" height="9" fill="#fff"/><path d="M3.5 11.5h-1v-9h8v1"/>`),
  painter: s16(`<rect x="2.5" y="2.5" width="9" height="4" fill="${Y}" stroke="#9a6a18"/><path d="M11.5 4.5h2v4h-6v2"/><rect x="6.5" y="10.5" width="2" height="4" fill="#666"/>`),
  /* ---- フォント ---- */
  bold: s16(txt('B', 3.5, 13, 13, 'font-weight="700"')),
  italic: s16(txt('I', 5.5, 13, 13, 'font-style="italic" font-family="Georgia,serif"')),
  underline: s16(txt('U', 3.5, 11.5, 12) + '<path d="M3 14.5h10"/>'),
  strike: s16(txt('ab', 2, 12, 11) + '<path d="M1.5 8.5h13"/>'),
  growFont: s16(txt('A', 1, 14, 13) + `<path d="m11 6 2.5-3 2.5 3" stroke="${B}"/>`),
  shrinkFont: s16(txt('A', 1.5, 14, 11) + `<path d="m11 3 2.5 3 2.5-3" stroke="${B}"/>`),
  borderBottom: s16(`<path d="M2.5 2.5h11v11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2.5 2.5v11M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2 13.5h12" stroke-width="1.6"/>`),
  borderTop: s16(`<path d="M2.5 13.5h11M2.5 2.5v11M13.5 2.5v11M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2 2.5h12" stroke-width="1.6"/>`),
  borderLeft: s16(`<path d="M2.5 2.5h11M2.5 13.5h11M13.5 2.5v11M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2.5 2v12" stroke-width="1.6"/>`),
  borderRight: s16(`<path d="M2.5 2.5h11M2.5 13.5h11M2.5 2.5v11M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M13.5 2v12" stroke-width="1.6"/>`),
  borderNone: s16(`<path d="M2.5 2.5h11v11h-11zM8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/>`),
  borderAll: s16(`<path d="M2.5 2.5h11v11h-11zM8 2.5v11M2.5 8h11"/>`),
  borderOut: s16(`<path d="M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2.5 2.5h11v11h-11z"/>`),
  borderThickOut: s16(`<path d="M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M3 3h10v10H3z" stroke-width="2"/>`),
  borderDblBottom: s16(`<path d="M2.5 2.5h11M2.5 2.5v9M13.5 2.5v9M8 2.5v9M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2 11.5h12M2 14h12"/>`),
  borderThickBottom: s16(`<path d="M2.5 2.5h11M2.5 2.5v11M13.5 2.5v11M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2 13h12" stroke-width="2.4"/>`),
  borderTopBottom: s16(`<path d="M2.5 2.5v11M13.5 2.5v11M8 2.5v11M2.5 8h11" stroke-dasharray="1 1.5" stroke="#999"/><path d="M2 2.5h12M2 13.5h12"/>`),
  fill: s16(`<path d="M3 8 7.5 3.5l5 5-4.5 4.5z" fill="#fff"/><path d="M5 2l2.5 1.5"/><path d="M13 9.5c.8 1.2 1.2 2 1.2 2.5a1.2 1.2 0 0 1-2.4 0c0-.5.4-1.3 1.2-2.5z" fill="currentColor"/>`),
  fontColor: s16(txt('A', 3, 12.5, 13)),
  /* ---- 配置 ---- */
  alignTop: s16(`<path d="M2 2.5h12"/>` + lines([5, 7.5, 10], [[4, 12], [4, 12], [4, 12]]).replace(/stroke=/g, '')),
  alignMiddle: s16(lines([4.5, 8, 11.5], [[4, 12], [2, 14], [4, 12]])),
  alignBottom: s16(lines([6, 8.5, 11], [[4, 12], [4, 12], [4, 12]]) + `<path d="M2 13.5h12"/>`),
  alignLeft: s16(lines([3.5, 6.5, 9.5, 12.5], [[2, 14], [2, 10], [2, 14], [2, 10]])),
  alignCenter: s16(lines([3.5, 6.5, 9.5, 12.5], [[2, 14], [4, 12], [2, 14], [4, 12]])),
  alignRight: s16(lines([3.5, 6.5, 9.5, 12.5], [[2, 14], [6, 14], [2, 14], [6, 14]])),
  indentDec: s16(lines([3.5, 6.5, 9.5, 12.5], [[2, 14], [8, 14], [8, 14], [2, 14]]) + `<path d="M5.5 6 3 8l2.5 2" stroke="${B}"/>`),
  indentInc: s16(lines([3.5, 6.5, 9.5, 12.5], [[2, 14], [8, 14], [8, 14], [2, 14]]) + `<path d="M3 6l2.5 2L3 10" stroke="${B}"/>`),
  wrap: s16(`<path d="M2 3.5h12M2 7.5h9a2 2 0 0 1 0 4H8"/><path d="m9.5 10-1.5 1.5L9.5 13" stroke="${B}"/><path d="M2 11.5h3"/>`),
  merge: s16(`<rect x="1.5" y="3.5" width="13" height="9"/><path d="M4 8h8M6 6 4 8l2 2M10 6l2 2-2 2" stroke="${B}"/>`),
  orient: s16(txt('ab', 1, 12, 9, 'transform="rotate(-35 6 10)"') + `<path d="M10 13 14 4M14 4l-.4 2.8M14 4l-2.4 1.4" stroke="${B}"/>`),
  /* ---- 数値 ---- */
  currency: s16(`<rect x="1.5" y="4.5" width="11" height="7" fill="#e6f2e9" stroke="${G}"/><circle cx="12" cy="11" r="3" fill="${Y}" stroke="#9a6a18"/>` + txt('¥', 4, 10.5, 7, `fill="${G}"`)),
  percent: s16(txt('%', 2, 13, 13)),
  comma: s16(txt('9', 1, 12, 10) + txt(',', 7, 12, 12, 'font-weight="700"') + txt('9', 10, 12, 10)),
  decInc: s16(txt('.0', 0, 7, 7) + txt('.00', 5, 14.5, 7) + `<path d="M3.5 9.5v3h2" stroke="${B}"/>`),
  decDec: s16(txt('.00', 0, 7, 7) + txt('.0', 8, 14.5, 7) + `<path d="M3.5 9.5v3h3" stroke="${B}"/>`),
  /* ---- スタイル ---- */
  condFmt32: s32(`<rect x="3.5" y="5.5" width="20" height="20" fill="#fff" stroke="#8a8a8a"/><path d="M3.5 12.5h20M3.5 18.5h20M13.5 5.5v20" stroke="#8a8a8a"/><rect x="5" y="7" width="7" height="4" fill="#f4b183" stroke="none"/><rect x="15" y="13.5" width="7" height="4" fill="#9dc3e6" stroke="none"/><rect x="5" y="20" width="4" height="4" fill="#a9d18e" stroke="none"/><rect x="18" y="16" width="11" height="12" fill="#fff" stroke="#555"/><path d="M20 19h7M20 22h7M20 25h5" stroke="${R}"/>`),
  table32: s32(`<rect x="4.5" y="6.5" width="23" height="19" fill="#fff" stroke="#8a8a8a"/><rect x="5" y="7" width="22" height="4.5" fill="${B}" stroke="none"/><rect x="5" y="16" width="22" height="4" fill="#dbe6f7" stroke="none"/><path d="M4.5 11.5h23M4.5 16h23M4.5 20.5h23M12 6.5v19M20 6.5v19" stroke="#8a8a8a"/>`),
  cellStyles32: s32(`<rect x="4.5" y="6.5" width="10" height="8" fill="#c6efce" stroke="#6a9a74"/><rect x="17.5" y="6.5" width="10" height="8" fill="#ffc7ce" stroke="#b46a74"/><rect x="4.5" y="17.5" width="10" height="8" fill="#ffeb9c" stroke="#b3a35a"/><rect x="17.5" y="17.5" width="10" height="8" fill="${B}" stroke="#2b5797"/>`),
  /* ---- セル ---- */
  insertCells32: s32(gridSm(4.5, 9.5, 18, 16) + `<path d="M24 4v10M19 9h10" stroke="${G}" stroke-width="2.2"/>`),
  deleteCells32: s32(gridSm(4.5, 9.5, 18, 16) + `<path d="m21 4 7 7M28 4l-7 7" stroke="${R}" stroke-width="2.2"/>`),
  formatCells32: s32(gridSm(4.5, 9.5, 18, 16) + `<rect x="18" y="3" width="11" height="13" fill="#fff" stroke="#555"/><path d="M20 6h7M20 9h7M20 12h5" stroke="${B}"/>`),
  insertSm: s16(gridSm(1.5, 4.5, 9, 9) + `<path d="M12.5 1v6M9.5 4h6" stroke="${G}" stroke-width="1.6"/>`),
  deleteSm: s16(gridSm(1.5, 4.5, 9, 9) + `<path d="m10 1 4.5 4.5M14.5 1 10 5.5" stroke="${R}" stroke-width="1.6"/>`),
  formatSm: s16(gridSm(1.5, 4.5, 9, 9) + `<rect x="9.5" y="1.5" width="6" height="7" fill="#fff"/>`),
  /* ---- 編集 ---- */
  sum: s16(`<path d="M12.5 3.5V2.5h-9l5 5.5-5 5.5h9v-1" stroke-width="1.3"/>`),
  fillDown: s16(`<rect x="2.5" y="2.5" width="11" height="11" fill="#fff"/><path d="M8 4.5v6M5.5 8 8 10.5 10.5 8" stroke="${B}" stroke-width="1.4"/>`),
  clear: s16(`<path d="M9.5 2.5 14 7l-6 6H5l-3-3z" fill="#f8c8d0" stroke="#b05a6a"/><path d="M5.5 6.5l4.5 4.5" stroke="#b05a6a"/><path d="M8 13.5h6"/>`),
  sortFilter32: s32(txt('A', 4, 13, 10, `fill="${B}" font-weight="700"`) + txt('Z', 4, 26, 10, `fill="${B}" font-weight="700"`) + `<path d="M14 5v20M11 22l3 3 3-3"/><path d="M18.5 8.5h11l-4.3 6v7l-2.4 1.5v-8.5z" fill="#fff" stroke="#555"/>`),
  find32: s32(`<circle cx="13" cy="13" r="7.5" fill="#e8f1fb" stroke="#555" stroke-width="1.6"/><path d="m18.5 18.5 9 9" stroke="#555" stroke-width="2.6"/>`),
  /* ---- 挿入 ---- */
  table32b: s32(`<rect x="4.5" y="6.5" width="23" height="19" fill="#fff" stroke="#8a8a8a"/><rect x="5" y="7" width="22" height="4.5" fill="${B}" stroke="none"/><path d="M4.5 11.5h23M4.5 16h23M4.5 20.5h23M12 6.5v19M20 6.5v19" stroke="#8a8a8a"/>`),
  recChart32: s32(`<rect x="4.5" y="4.5" width="23" height="23" fill="#fff" stroke="#8a8a8a"/><rect x="8" y="15" width="4" height="9" fill="${B}" stroke="none"/><rect x="14" y="10" width="4" height="14" fill="#ed7d31" stroke="none"/><rect x="20" y="18" width="4" height="6" fill="#a5a5a5" stroke="none"/><path d="M22 6l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L19 8.3l2-.3z" fill="${Y}" stroke="none"/>`),
  colChart: s16(`<path d="M1.5 14.5h13" stroke="#777"/><rect x="2.5" y="7" width="3" height="7.5" fill="${B}" stroke="none"/><rect x="6.5" y="3" width="3" height="11.5" fill="#ed7d31" stroke="none"/><rect x="10.5" y="9" width="3" height="5.5" fill="#a5a5a5" stroke="none"/>`),
  barChart: s16(`<path d="M1.5 1.5v13" stroke="#777"/><rect x="2" y="2.5" width="8" height="3" fill="${B}" stroke="none"/><rect x="2" y="6.5" width="12" height="3" fill="#ed7d31" stroke="none"/><rect x="2" y="10.5" width="5" height="3" fill="#a5a5a5" stroke="none"/>`),
  lineChart: s16(`<path d="M1.5 1.5v13h13" stroke="#777"/><path d="m3 11 3.5-4 3 2.5L14 4" stroke="${B}" stroke-width="1.5"/><path d="m3 13 3.5-2 3 1L14 8" stroke="#ed7d31" stroke-width="1.5"/>`),
  pieChart: s16(`<circle cx="8" cy="8" r="6.5" fill="#a5a5a5" stroke="#fff"/><path d="M8 8V1.5A6.5 6.5 0 0 1 14.2 10z" fill="${B}" stroke="#fff"/><path d="M8 8l6.2 2A6.5 6.5 0 0 1 4 13.2z" fill="#ed7d31" stroke="#fff"/>`),
  areaChart: s16(`<path d="M1.5 1.5v13h13" stroke="#777"/><path d="M2 14 5 7l4 3 5-6v10z" fill="${B}" stroke="none"/><path d="M2 14l3-3 4 1 5-3v5z" fill="#ed7d31" stroke="none"/>`),
  colChart32: s32(`<path d="M3.5 28.5h25" stroke="#777"/><rect x="6" y="14" width="5" height="14.5" fill="${B}" stroke="none"/><rect x="13.5" y="6" width="5" height="22.5" fill="#ed7d31" stroke="none"/><rect x="21" y="18" width="5" height="10.5" fill="#a5a5a5" stroke="none"/>`),
  symbol32: s32(txt('Ω', 7, 25, 21, 'font-family="Times New Roman,serif"')),
  note32: s32(`<path d="M5.5 5.5h21v15l-6 6h-15z" fill="#ffffc8" stroke="#a09040"/><path d="M20.5 26.5v-6h6" stroke="#a09040"/><path d="M9 11h13M9 15h13M9 19h8" stroke="#888"/>`),
  /* ---- ページレイアウト ---- */
  margins32: s32(`<rect x="7.5" y="3.5" width="17" height="25" fill="#fff" stroke="#666"/><path d="M7.5 8h17M7.5 24h17M11 3.5v25M21 3.5v25" stroke="${B}" stroke-dasharray="2 1.5"/>`),
  orient32: s32(`<rect x="4.5" y="9.5" width="14" height="19" fill="#fff" stroke="#666"/><rect x="11.5" y="4.5" width="17" height="12" fill="#fff" stroke="#666"/><path d="M7 13h9M7 16h9M14 8h12" stroke="#999"/>`),
  size32: s32(`<rect x="7.5" y="3.5" width="17" height="25" fill="#fff" stroke="#666"/><path d="M4 3.5v25M2.5 5 4 3.5 5.5 5M2.5 27 4 28.5 5.5 27" stroke="${B}"/>`),
  print32: s32(`<rect x="9.5" y="3.5" width="13" height="8" fill="#fff" stroke="#666"/><rect x="3.5" y="11.5" width="25" height="11" rx="1.5" fill="#d9d9d9" stroke="#666"/><rect x="9.5" y="18.5" width="13" height="10" fill="#fff" stroke="#666"/><path d="M12 22h8M12 25h8" stroke="#999"/><circle cx="24" cy="15" r="1" fill="${G}" stroke="none"/>`),
  /* ---- 数式 ---- */
  fx32: s32(txt('fx', 5, 23, 17, 'font-style="italic" font-family="Georgia,Times New Roman,serif"')),
  sum32: s32(`<path d="M24 8V5.5H8l9 10.5-9 10.5h16V24" stroke-width="2"/>`),
  recent32: s32(`<rect x="5.5" y="4.5" width="17" height="23" fill="#fff" stroke="#666"/><path d="M9 10h10M9 14h10M9 18h6" stroke="#999"/><circle cx="22" cy="22" r="6.5" fill="#fff" stroke="${B}" stroke-width="1.5"/><path d="M22 18.5V22l2.5 1.5" stroke="${B}" stroke-width="1.5"/>`),
  book32: c => s32(`<path d="M6.5 5.5h17v22h-17z" fill="${c}" stroke="#555"/><path d="M9.5 5.5v22" stroke="#555"/><rect x="12" y="9" width="9" height="5" fill="#fff" stroke="none"/>`),
  showFormulas: s16(txt('fx', 1, 11, 10, 'font-style="italic" font-family="Georgia,serif"') + `<rect x="9.5" y="5.5" width="5" height="7" fill="#fff"/>`),
  calc: s16(`<rect x="3.5" y="1.5" width="9" height="13" rx="1" fill="#fff"/><rect x="5" y="3" width="6" height="3" fill="#cfe5d8" stroke="none"/><path d="M5.5 8.5h1M8 8.5h1M10.5 8.5h0M5.5 11h1M8 11h1" stroke-width="1.6"/>`),
  /* ---- データ ---- */
  csv32: s32(`<path d="M7.5 3.5h12l5 5v20h-17z" fill="#fff" stroke="#666"/><path d="M19.5 3.5v5h5" stroke="#666"/>` + txt('CSV', 9, 22, 7.5, `fill="${G}" font-weight="700"`)),
  xlsx32: s32(`<path d="M7.5 3.5h12l5 5v20h-17z" fill="#fff" stroke="#666"/><path d="M19.5 3.5v5h5" stroke="#666"/><rect x="5" y="13" width="11" height="11" rx="1" fill="#185c37" stroke="none"/><path d="M8 16l5 5M13 16l-5 5" stroke="#fff" stroke-width="1.5"/><path d="M18 14h4M18 18h4M18 22h4" stroke="${G}"/>`),
  sortAZ: s16(txt('A', 0.5, 7, 7, `fill="${B}" font-weight="700"`) + txt('Z', 0.5, 15, 7, `fill="${B}" font-weight="700"`) + `<path d="M11 2v12M8.5 11.5 11 14l2.5-2.5"/>`),
  sortZA: s16(txt('Z', 0.5, 7, 7, `fill="${B}" font-weight="700"`) + txt('A', 0.5, 15, 7, `fill="${B}" font-weight="700"`) + `<path d="M11 2v12M8.5 11.5 11 14l2.5-2.5"/>`),
  sort32: s32(`<rect x="4.5" y="4.5" width="14" height="23" fill="#fff" stroke="#888"/>` + txt('Z', 7, 13, 8, `fill="${B}" font-weight="700"`) + txt('A', 7, 25, 8, `fill="${B}" font-weight="700"`) + `<rect x="17.5" y="9.5" width="12" height="14" fill="#fff" stroke="#888"/>` + txt('A', 20, 17, 7, `fill="${B}" font-weight="700"`) + txt('Z', 20, 22.5, 6, `fill="${B}" font-weight="700"`)),
  filter32: s32(`<path d="M5.5 6.5h21l-8 9.5v9l-5 3v-12z" fill="#fff" stroke="#555" stroke-width="1.4"/>`),
  filterClear: s16(`<path d="M1.5 2.5h10l-4 4.5v4.5L5.5 13V7z" fill="#fff"/><path d="m10 9.5 4 4M14 9.5l-4 4" stroke="${R}" stroke-width="1.4"/>`),
  filterReapply: s16(`<path d="M1.5 2.5h10l-4 4.5v4.5L5.5 13V7z" fill="#fff"/><path d="M14.5 10a3 3 0 1 1-1-2.2M13.5 6v2h-2" stroke="${G}"/>`),
  dedupe32: s32(`<rect x="3.5" y="5.5" width="11" height="21" fill="#fff" stroke="#888"/><rect x="16.5" y="5.5" width="11" height="21" fill="#fff" stroke="#888"/><path d="M3.5 12.5h24M3.5 19.5h24" stroke="#888"/><path d="m19 21.5 6 5M25 21.5l-6 5" stroke="${R}" stroke-width="2"/>`),
  validation32: s32(`<rect x="4.5" y="5.5" width="18" height="21" fill="#fff" stroke="#888"/><path d="M8 11l2 2 3-4M8 18l2 2 3-4" stroke="${G}" stroke-width="1.6"/><path d="M15 11.5h5M15 18.5h5" stroke="#888"/><circle cx="24" cy="23" r="5.5" fill="#fff" stroke="${R}" stroke-width="1.6"/><path d="m20.2 26.8 7.6-7.6" stroke="${R}" stroke-width="1.6"/>`),
  /* ---- 校閲 ---- */
  noteNew32: s32(`<path d="M5.5 5.5h19v14l-5 5h-14z" fill="#ffffc8" stroke="#a09040"/><path d="M19.5 24.5v-5h5" stroke="#a09040"/><path d="M24 20v10M19 25h10" stroke="${G}" stroke-width="2.2"/>`),
  noteDel: s16(`<path d="M2.5 2.5h9v7l-3 3h-6z" fill="#ffffc8" stroke="#a09040"/><path d="m9.5 10 5 5M14.5 10l-5 5" stroke="${R}" stroke-width="1.4"/>`),
  noteShow: s16(`<path d="M2.5 2.5h11v8l-3 3h-8z" fill="#ffffc8" stroke="#a09040"/><path d="M5 6h6M5 9h4" stroke="#888"/>`),
  protect32: s32(`<rect x="5.5" y="5.5" width="16" height="20" fill="#fff" stroke="#888"/><path d="M5.5 12.5h16M5.5 18.5h16M13.5 5.5v20" stroke="#888"/><rect x="17.5" y="18.5" width="11" height="9" rx="1" fill="${Y}" stroke="#8a6a18"/><path d="M20 18.5v-2.5a3 3 0 0 1 6 0v2.5" stroke="#8a6a18" stroke-width="1.5"/>`),
  /* ---- 表示 ---- */
  normalView32: s32(gridSm(4.5, 5.5, 23, 21)),
  zoom32: s32(`<circle cx="13" cy="13" r="8" fill="#fff" stroke="#555" stroke-width="1.6"/><path d="m19 19 8 8" stroke="#555" stroke-width="2.6"/><path d="M13 9v8M9 13h8" stroke="${B}" stroke-width="1.6"/>`),
  zoom100: s32(`<rect x="3.5" y="7.5" width="25" height="17" fill="#fff" stroke="#666"/>` + txt('100', 6.5, 20, 10.5, 'font-weight="700"')),
  zoomSel32: s32(`<rect x="3.5" y="5.5" width="25" height="21" fill="#fff" stroke="#666"/><rect x="9.5" y="10.5" width="13" height="11" fill="#cfe5d8" stroke="${G}"/><path d="M5 9V7h2M27 9V7h-2M5 23v2h2M27 23v2h-2" stroke="${G}"/>`),
  freeze32: s32(`<rect x="4.5" y="4.5" width="23" height="23" fill="#fff" stroke="#666"/><rect x="5" y="5" width="22" height="5" fill="#cfe5d8" stroke="none"/><rect x="5" y="5" width="6" height="22" fill="#cfe5d8" stroke="none"/><path d="M4.5 10.5h23M11.5 4.5v23" stroke="${B}" stroke-width="1.6"/><path d="M4.5 16.5h23M4.5 22h23M18 4.5v23" stroke="#bbb"/>`),
  /* ---- ヘルプ / グラフのデザイン ---- */
  help32: s32(`<circle cx="16" cy="16" r="11.5" fill="#fff" stroke="${B}" stroke-width="1.6"/>` + txt('?', 11.5, 22, 16, `fill="${B}" font-weight="700"`)),
  keys32: s32(`<rect x="2.5" y="9.5" width="27" height="15" rx="2" fill="#fff" stroke="#666"/><path d="M6 14h2M10 14h2M14 14h2M18 14h2M22 14h4M6 18h2M10 18h12M24 18h2" stroke="#666" stroke-width="1.6"/>`),
  chartType32: s32(`<rect x="3.5" y="5.5" width="25" height="21" fill="#fff" stroke="#888"/><rect x="7" y="15" width="4" height="9" fill="${B}" stroke="none"/><rect x="13" y="10" width="4" height="14" fill="#ed7d31" stroke="none"/><path d="m19 21 3-6 4 3" stroke="#a5a5a5" stroke-width="1.6"/>`),
  selectData32: s32(gridSm(4.5, 5.5, 20, 20) + `<rect x="4.5" y="5.5" width="10" height="13.3" fill="#cfe5d8" stroke="${G}"/><rect x="18" y="16" width="11" height="12" fill="#fff" stroke="#666"/><rect x="20" y="22" width="2" height="4" fill="${B}" stroke="none"/><rect x="23.5" y="19" width="2" height="7" fill="#ed7d31" stroke="none"/>`),
  switchRC32: s32(gridSm(4.5, 4.5, 18, 18) + `<path d="M17 27h10V17M24.5 19.5 27 17l2.5 2.5M19.5 24.5 17 27l2.5 2.5" stroke="${B}" stroke-width="1.5"/>`),
  chartTitle: s16(`<rect x="1.5" y="1.5" width="13" height="13" fill="#fff"/><path d="M4 4.5h8" stroke="${B}" stroke-width="1.6"/><path d="M4 12.5v-3M7 12.5v-5M10 12.5v-2" stroke="#999" stroke-width="1.6"/>`),
  legend: s16(`<rect x="1.5" y="1.5" width="13" height="13" fill="#fff"/><path d="M4 4v6M7 4v6M10 6v4" stroke="#999" stroke-width="1.6"/><rect x="3.5" y="11.5" width="2" height="1.5" fill="${B}" stroke="none"/><rect x="8" y="11.5" width="2" height="1.5" fill="#ed7d31" stroke="none"/>`),
  /* ---- その他 ---- */
  funnel: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1.5h8L6 5v3.5L4 9.5V5z" fill="#217346"/></svg>`,
  ddArrow: `<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 2.5h6L4 6z" fill="#444"/></svg>`,
  close: s16(`<path d="m4 4 8 8M12 4l-8 8"/>`),
  check: s16(`<path d="m3 8.5 3 3 7-7" stroke-width="1.4"/>`),
  plusCircle: s16(`<circle cx="8" cy="8" r="6.5"/><path d="M8 5v6M5 8h6"/>`),
  chevL: s16(`<path d="M10 3 5 8l5 5"/>`), chevR: s16(`<path d="m6 3 5 5-5 5"/>`),
  expand: s16(`<path d="m4 6 4 4 4-4"/>`), collapse: s16(`<path d="m4 10 4-4 4 4"/>`),
  launcher: `<svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor"><path d="M1 1h4M1 1v4M3 3l5 5M8 4v4H4"/></svg>`,
  newBook: `<svg width="60" height="44" viewBox="0 0 60 44"><rect x=".5" y=".5" width="59" height="43" fill="#fff" stroke="#c8c8c8"/><path d="M0 11h60M0 22h60M0 33h60M15 0v44M30 0v44M45 0v44" stroke="#e1e1e1"/><rect x="15" y="11" width="15" height="11" fill="none" stroke="#217346" stroke-width="2"/></svg>`,
  open32: s32(`<path d="M3.5 8.5h9l2 2h13v15h-24z" fill="${Y}" stroke="#8a6a18"/><path d="M3.5 25.5l4-10h22l-4 10z" fill="#f6c86a" stroke="#8a6a18"/>`),
  download32: s32(`<path d="M16 4v16M10 14l6 6 6-6" stroke="${G}" stroke-width="2"/><path d="M5 22v5h22v-5" stroke="#666" stroke-width="1.6"/>`),
};
})();
