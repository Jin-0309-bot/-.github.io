/* 表計算エンジン：数式の解析・計算・参照の書き換え・表示形式 */
(function () {
'use strict';
const JP = '\\u3040-\\u30ff\\u3400-\\u9fff';
const SHEET_NAME_RE = new RegExp(`^[A-Za-z_${JP}][\\w${JP}]*$`);
const toHalf = s => s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
function colName(c) { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - 1 - m) / 26; } return s; }
function colIdx(s) { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
const keyOf = (r, c) => colName(c) + (r + 1);
function parseKey(k) { const m = /^([A-Z]+)(\d+)$/.exec(k); return m ? { r: +m[2] - 1, c: colIdx(m[1]) } : null; }

class Err { constructor(code) { this.code = code; } }
const isErr = v => v instanceof Err;
class Range {
  constructor(rows, pos) { this.rows = rows; this.pos = pos || null; }
  *[Symbol.iterator]() { for (const r of this.rows) yield* r; }
  get h() { return this.rows.length; }
  get w() { return this.rows.length ? this.rows[0].length : 0; }
}

/* ---------- 日付 ---------- */
const EPOCH = Date.UTC(1899, 11, 30), DAY = 864e5;
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / DAY;
function fromSerial(s) {
  const days = Math.floor(s + 1e-9), dt = new Date(EPOCH + days * DAY);
  let secs = Math.round((s - days) * 86400); if (secs >= 86400) secs = 86399;
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay(), h: Math.floor(secs / 3600), mi: Math.floor(secs / 60) % 60, s: secs % 60 };
}
const nowSerial = () => { const d = new Date(); return serial(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; };
const todaySerial = () => Math.floor(nowSerial());

/* ---------- 入力値の解釈 ---------- */
function parseInput(s) {
  if (typeof s !== 'string') return { v: s };
  let t = toHalf(s).trim();
  if (t === '') return { v: s };
  if (/^(true|false)$/i.test(t)) return { v: t.toUpperCase() === 'TRUE' };
  let m;
  const okDate = (y, mo, d) => mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const tm = '(?:\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?';
  if ((m = new RegExp(`^(\\d{4})[/\\-.](\\d{1,2})[/\\-.](\\d{1,2})${tm}$`).exec(t)) && okDate(+m[1], +m[2], +m[3])) {
    let v = serial(+m[1], +m[2], +m[3]);
    if (m[4] != null) { v += (+m[4] * 3600 + +m[5] * 60 + +(m[6] || 0)) / 86400; return { v, fmt: 'datetime' }; }
    return { v, fmt: 'date' };
  }
  if ((m = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(t)) && okDate(+m[1], +m[2], +m[3])) return { v: serial(+m[1], +m[2], +m[3]), fmt: 'ldate' };
  const y = new Date().getFullYear();
  if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(t)) && okDate(y, +m[1], +m[2])) return { v: serial(y, +m[1], +m[2]), fmt: 'md' };
  if ((m = /^(\d{1,2})月(\d{1,2})日$/.exec(t)) && okDate(y, +m[1], +m[2])) return { v: serial(y, +m[1], +m[2]), fmt: 'md' };
  if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t)) && +m[2] < 60) return { v: (+m[1] * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400, fmt: m[3] ? 'time' : 'hm' };
  let fmt = null;
  if ((m = /^([+-]?)[¥$]/.exec(t))) { t = m[1] + t.slice(m[0].length); fmt = 'currency'; }
  const pct = t.endsWith('%'); if (pct) { t = t.slice(0, -1); fmt = 'pct'; }
  if (/\d/.test(t) && /^[+-]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
    if (!fmt && t.includes(',')) fmt = 'comma';
    if (!fmt && /e/i.test(t)) fmt = 'sci';
    const n = Number(t.replace(/,/g, ''));
    if (!isNaN(n)) return { v: pct ? n / 100 : n, fmt };
  }
  return { v: s };
}
const parseLiteral = s => parseInput(s).v;

/* ---------- 表示形式 ---------- */
function fmtGeneral(n) {
  if (!isFinite(n)) return '#NUM!';
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e11 || a < 1e-9)) return n.toExponential(5).replace(/\.?0+e/, 'e').replace('e', 'E').replace(/E([+-])(\d)$/, 'E$10$2');
  return String(Number(n.toPrecision(11)));
}
const grp = (x, d, g) => x.toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: g });
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const WDL = WD.map(w => w + '曜日');
function dateFmt(n, kind) {
  if (n < 0) return '#####';
  const t = fromSerial(n), hm = `${t.h}:${String(t.mi).padStart(2, '0')}`;
  switch (kind) {
    case 'date': return `${t.y}/${t.m}/${t.d}`;
    case 'ldate': return `${t.y}年${t.m}月${t.d}日`;
    case 'md': return `${t.m}月${t.d}日`;
    case 'datetime': return `${t.y}/${t.m}/${t.d} ${hm}`;
    case 'hm': return hm;
    case 'time': return `${hm}:${String(t.s).padStart(2, '0')}`;
  }
  return '';
}
function formatCode(n, code) {
  if (typeof n !== 'number') return toStr(n);
  if (/[yd]|aaa|[hs]|m(?![^"]*")/i.test(code.replace(/"[^"]*"/g, '')) && !/[0#]/.test(code.replace(/"[^"]*"/g, ''))) {
    if (n < 0) return '#####';
    const t = fromSerial(n), out = [];
    const re = /"([^"]*)"|yyyy|yy|mmmm|mmm|mm|m|dd|d|aaaa|aaa|hh|h|ss|s|./gi;
    let mm, prevH = false; const toks = [];
    while ((mm = re.exec(code))) toks.push(mm);
    toks.forEach((tk, i) => {
      const s = tk[0], l = s.toLowerCase();
      if (tk[1] !== undefined) { out.push(tk[1]); return; }
      const nextS = toks.slice(i + 1).find(x => /^[a-z]/i.test(x[0]));
      const isMin = (l === 'm' || l === 'mm') && (prevH || (nextS && /^s/i.test(nextS[0])));
      switch (l) {
        case 'yyyy': out.push(t.y); break; case 'yy': out.push(String(t.y).slice(-2)); break;
        case 'mm': out.push(isMin ? String(t.mi).padStart(2, '0') : String(t.m).padStart(2, '0')); break;
        case 'm': out.push(isMin ? t.mi : t.m); break;
        case 'mmm': case 'mmmm': out.push(t.m + '月'); break;
        case 'dd': out.push(String(t.d).padStart(2, '0')); break; case 'd': out.push(t.d); break;
        case 'aaaa': out.push(WDL[t.wd]); break; case 'aaa': out.push(WD[t.wd]); break;
        case 'hh': out.push(String(t.h).padStart(2, '0')); break; case 'h': out.push(t.h); break;
        case 'ss': out.push(String(t.s).padStart(2, '0')); break; case 's': out.push(t.s); break;
        default: out.push(s);
      }
      if (/^[a-z]/i.test(s)) prevH = l === 'h' || l === 'hh';
    });
    return out.join('');
  }
  const parts = code.split(';');
  let c = parts[0];
  if (n < 0 && parts[1]) { c = parts[1]; n = -n; }
  else if (n === 0 && parts[2]) c = parts[2];
  const m = /^((?:"[^"]*"|[^0#?])*?)([#0?,]*(?:\.[0#?]*)?)((?:E[+-]0+)?)(.*)$/.exec(c);
  if (!m || !m[2]) return c.replace(/"/g, '');
  const unq = s => s.replace(/"([^"]*)"/g, '$1').replace(/\\(.)/g, '$1');
  const pre = unq(m[1]), num = m[2], suf = unq(m[4]);
  if (suf.includes('%')) n *= 100;
  const dec = (num.split('.')[1] || '').length, g = num.includes(',');
  let body;
  if (m[3]) body = n.toExponential(dec).toUpperCase().replace(/E([+-])(\d)$/, 'E$10$2');
  else body = grp(Math.abs(n), dec, g);
  if (!m[3] && n < 0) body = '-' + body;
  if (/^#/.test(num) && !num.includes('0') && Math.abs(n) < 1 && !dec) body = body.replace(/^(-?)0$/, '$1');
  return pre + body + suf;
}
const FORMATS = {
  general: '標準', number: '数値', currency: '通貨', accounting: '会計', date: '短い日付形式', ldate: '長い日付形式',
  time: '時刻', pct: 'パーセンテージ', frac: '分数', sci: '指数', text: '文字列', comma: '桁区切り', md: '月日', hm: '時刻(時:分)', datetime: '日時', custom: 'ユーザー定義',
};
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
function formatValue(v, cell) {
  if (v == null) return '';
  if (isErr(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v !== 'number') return String(v);
  const f = cell && cell.fmt, d = cell ? cell.dec : undefined;
  switch (f) {
    case 'number': return grp(v, d ?? 2, !!cell.sep);
    case 'comma': return grp(v, d ?? 0, true);
    case 'currency': case 'accounting': return (v < 0 ? '-' : '') + '¥' + grp(Math.abs(v), d ?? 0, true);
    case 'pct': return grp(v * 100, d ?? 0, false) + '%';
    case 'sci': return v.toExponential(d ?? 2).toUpperCase().replace(/E([+-])(\d)$/, 'E$10$2');
    case 'date': case 'ldate': case 'md': case 'datetime': case 'hm': case 'time': return dateFmt(v, f);
    case 'frac': {
      const w = Math.trunc(v), fr = Math.abs(v - w);
      if (fr < 1e-9) return String(w);
      let best = [0, 1], err = 1;
      for (let q = 1; q <= 9; q++) { const p = Math.round(fr * q), e = Math.abs(fr - p / q); if (e < err - 1e-12) { err = e; best = [p, q]; } }
      const g = gcd(best[0], best[1]) || 1, p = best[0] / g, q = best[1] / g;
      if (p === 0) return String(w);
      if (p === q) return String(w + Math.sign(v));
      return (w !== 0 ? w + ' ' : v < 0 ? '-' : '') + p + '/' + q;
    }
    case 'custom': return cell.code ? formatCode(v, cell.code) : fmtGeneral(v);
  }
  return d != null ? grp(v, d, false) : fmtGeneral(v);
}
const toStr = v => v == null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? fmtGeneral(v) : isErr(v) ? v.code : String(v);

/* ---------- 比較 ---------- */
function compareVals(a, b) {
  if (a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const rank = v => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  if (ra === 1) { a = a.toLowerCase(); b = b.toLowerCase(); }
  return a < b ? -1 : a > b ? 1 : 0;
}
function cmpOp(op, a, b) {
  const c = compareVals(a, b);
  switch (op) { case '=': return c === 0; case '<>': return c !== 0; case '<': return c < 0; case '>': return c > 0; case '<=': return c <= 0; case '>=': return c >= 0; }
  return false;
}

/* ---------- 字句・構文解析 ---------- */
const SHEET_PART = `[A-Za-z_${JP}][\\w${JP}]*`;
const REF_TOKEN = new RegExp(`^(?:(${SHEET_PART})!)?(?:(\\$?[A-Za-z]{1,3}\\$?\\d+)(?::(\\$?[A-Za-z]{1,3}\\$?\\d+))?|(\\$?[A-Za-z]{1,3}):(\\$?[A-Za-z]{1,3})|(\\$?\\d+):(\\$?\\d+))(?![\\w(])`);
function tokenize(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let j = i + 1, s = '';
      for (;;) {
        if (j >= src.length) throw new Err('#ERROR!');
        if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
        s += src[j++];
      }
      t.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    const rest = src.slice(i); let m;
    if (rest.startsWith('#REF!')) throw new Err('#REF!');
    if ((m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(rest)) && !/^\d+:\$?\d/.test(rest)) { t.push({ t: 'num', v: parseFloat(m[1]) }); i += m[1].length; continue; }
    if ((m = REF_TOKEN.exec(rest))) {
      if (m[2]) t.push({ t: 'ref', sheet: m[1] || null, a: m[2], b: m[3] || null });
      else if (m[4]) t.push({ t: 'ref', sheet: m[1] || null, cols: [m[4], m[5]] });
      else t.push({ t: 'ref', sheet: m[1] || null, rowsR: [m[6], m[7]] });
      i += m[0].length; continue;
    }
    if ((m = /^[A-Za-z_][\w.]*/.exec(rest))) { t.push({ t: 'id', v: m[0].toUpperCase() }); i += m[0].length; continue; }
    if ((m = /^(<=|>=|<>)/.exec(rest))) { t.push({ t: 'op', v: m[1] }); i += 2; continue; }
    if ('+-*/^&=<>(),%'.includes(ch)) { t.push({ t: 'op', v: ch }); i++; continue; }
    throw new Err('#ERROR!');
  }
  return t;
}
function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = v => peek() && peek().t === 'op' && peek().v === v;
  const expect = v => { if (!isOp(v)) throw new Err('#ERROR!'); p++; };
  const CMP = ['=', '<>', '<', '>', '<=', '>='];
  function cmp() { let l = cat(); while (peek() && peek().t === 'op' && CMP.includes(peek().v)) { const o = tokens[p++].v; l = { k: 'bin', o, l, r: cat() }; } return l; }
  function cat() { let l = add(); while (isOp('&')) { p++; l = { k: 'bin', o: '&', l, r: add() }; } return l; }
  function add() { let l = mul(); while (isOp('+') || isOp('-')) { const o = tokens[p++].v; l = { k: 'bin', o, l, r: mul() }; } return l; }
  function mul() { let l = pow(); while (isOp('*') || isOp('/')) { const o = tokens[p++].v; l = { k: 'bin', o, l, r: pow() }; } return l; }
  function pow() { let l = unary(); while (isOp('^')) { p++; l = { k: 'bin', o: '^', l, r: unary() }; } return l; }
  function unary() { if (isOp('-')) { p++; return { k: 'neg', e: unary() }; } if (isOp('+')) { p++; return unary(); } return post(); }
  function post() { let e = prim(); while (isOp('%')) { p++; e = { k: 'pct', e }; } return e; }
  function arg() { return isOp(',') || isOp(')') ? { k: 'empty' } : cmp(); }
  function prim() {
    const tk = tokens[p++];
    if (!tk) throw new Err('#ERROR!');
    if (tk.t === 'num' || tk.t === 'str') return { k: 'lit', v: tk.v };
    if (tk.t === 'ref') return Object.assign({ k: 'ref' }, tk);
    if (tk.t === 'id') {
      if (isOp('(')) {
        p++; const args = [];
        if (!isOp(')')) { args.push(arg()); while (isOp(',')) { p++; args.push(arg()); } }
        expect(')'); return { k: 'fn', name: tk.v, args };
      }
      if (tk.v === 'TRUE') return { k: 'lit', v: true };
      if (tk.v === 'FALSE') return { k: 'lit', v: false };
      throw new Err('#NAME?');
    }
    if (tk.t === 'op' && tk.v === '(') { const e = cmp(); expect(')'); return e; }
    throw new Err('#ERROR!');
  }
  const e = cmp();
  if (p < tokens.length) throw new Err('#ERROR!');
  return e;
}

/* ---------- 参照の書き換え ---------- */
const REF_RE = new RegExp(`(^|[^\\w$.!${JP}])((?:${SHEET_PART})!)?(?:(\\$?)([A-Za-z]{1,3})(\\$?)(\\d+)(?::(\\$?)([A-Za-z]{1,3})(\\$?)(\\d+))?|(\\$?)([A-Za-z]{1,3}):(\\$?)([A-Za-z]{1,3})(?![\\w(!]))(?![\\w(!])`, 'g');
const outsideStrings = (f, fn) => f.split(/("(?:[^"]|"")*"?)/).map((part, i) => i % 2 ? part : fn(part)).join('');
function mapRefs(f, fn, ROWS) {
  return outsideStrings(f, part => part.replace(REF_RE, (m, pre, sh, ac1, c1, ar1, r1, ac2, c2, ar2, r2, cc1, cl1, cc2, cl2) => {
    let a, b;
    if (c1) {
      a = { c: colIdx(c1), r: +r1 - 1, ac: !!ac1, ar: !!ar1 };
      b = c2 ? { c: colIdx(c2), r: +r2 - 1, ac: !!ac2, ar: !!ar2 } : null;
    } else {
      a = { c: colIdx(cl1), r: 0, ac: !!cc1, ar: true, full: true };
      b = { c: colIdx(cl2), r: ROWS - 1, ac: !!cc2, ar: true, full: true };
    }
    const res = fn(sh ? sh.slice(0, -1) : null, a, b);
    if (res === undefined) return m;
    if (res === null) return pre + '#REF!';
    const fr = p => (p.ac ? '$' : '') + colName(p.c) + (p.full ? '' : (p.ar ? '$' : '') + (p.r + 1));
    return pre + (sh || '') + fr(res.a) + (res.b ? ':' + fr(res.b) : '');
  }));
}
function refsIn(f) {
  const out = [];
  mapRefs(f, (sh, a, b) => { out.push({ sheet: sh, a, b: b || a }); return undefined; }, 1e6);
  return out;
}

/* ---------- エンジン本体 ---------- */
function createEngine(host) {
  const { ROWS, COLS } = host;
  const inGrid = p => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS;
  const cache = new Map(), visiting = new Set(), astCache = new Map();

  function getValue(si, r, c) {
    const k = si + ':' + r + ':' + c;
    if (cache.has(k)) return cache.get(k);
    if (visiting.has(k)) return new Err('#CIRC!');
    const cell = host.cell(si, r, c);
    let v;
    if (!cell || cell.v == null || cell.v === '') v = null;
    else if (cell.fmt === 'text') v = String(cell.v);
    else if (typeof cell.v === 'string' && cell.v[0] === "'") v = cell.v.slice(1);
    else if (isFormula(cell.v)) {
      visiting.add(k);
      try { v = evaluate(cell.v.slice(1), { si, r, c }); }
      catch (e) { v = isErr(e) ? e : new Err('#ERROR!'); }
      visiting.delete(k);
    } else v = parseLiteral(cell.v);
    cache.set(k, v);
    return v;
  }
  function evaluate(src, ctx) {
    let ast = astCache.get(src);
    if (!ast) { ast = parse(tokenize(src)); astCache.set(src, ast); }
    let v = scalar(evalNode(ast, ctx));
    if (v == null) v = 0;
    if (typeof v === 'number' && !isFinite(v)) v = new Err('#NUM!');
    return v;
  }
  function parseA1(s) { const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(s); return { c: colIdx(m[1]), r: +m[2] - 1 }; }
  function resolveRef(n, ctx) {
    let s = ctx.si;
    if (n.sheet) { s = host.sheetIndex(n.sheet); if (s < 0) return new Err('#REF!'); }
    let a, b;
    if (n.cols) { a = { r: 0, c: colIdx(n.cols[0].replace('$', '')) }; b = { r: ROWS - 1, c: colIdx(n.cols[1].replace('$', '')) }; }
    else if (n.rowsR) { a = { r: +n.rowsR[0].replace('$', '') - 1, c: 0 }; b = { r: +n.rowsR[1].replace('$', '') - 1, c: COLS - 1 }; }
    else { a = parseA1(n.a); b = n.b ? parseA1(n.b) : a; }
    if (!inGrid(a) || !inGrid(b)) return new Err('#REF!');
    return { s, r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
  }
  function refNode(n, ctx) {
    const R = resolveRef(n, ctx); if (isErr(R)) return R;
    const rows = [];
    for (let r = R.r0; r <= R.r1; r++) { const row = []; for (let c = R.c0; c <= R.c1; c++) row.push(getValue(R.s, r, c)); rows.push(row); }
    return new Range(rows, R);
  }
  function evalNode(n, ctx) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'empty': return null;
      case 'ref': return refNode(n, ctx);
      case 'neg': { const v = toNum(scalar(evalNode(n.e, ctx))); return isErr(v) ? v : -v; }
      case 'pct': { const v = toNum(scalar(evalNode(n.e, ctx))); return isErr(v) ? v : v / 100; }
      case 'bin': {
        const L = evalNode(n.l, ctx), Rr = evalNode(n.r, ctx);
        if (L instanceof Range || Rr instanceof Range) {
          if ((L instanceof Range && (L.h > 1 || L.w > 1)) || (Rr instanceof Range && (Rr.h > 1 || Rr.w > 1))) return arrayOp(n.o, L, Rr);
        }
        return binop(n.o, scalar(L), scalar(Rr));
      }
      case 'fn': {
        if (LAZY[n.name]) return LAZY[n.name](n.args, ctx);
        const f = FN[n.name];
        if (!f) return new Err('#NAME?');
        return f(n.args.map(a => evalNode(a, ctx)), ctx);
      }
    }
    return new Err('#ERROR!');
  }
  function binop(o, a, b) {
    if (isErr(a)) return a; if (isErr(b)) return b;
    if (o === '&') return toStr(a) + toStr(b);
    if (['=', '<>', '<', '>', '<=', '>='].includes(o)) return cmpOp(o, a, b);
    const x = toNum(a), y = toNum(b);
    if (isErr(x)) return x; if (isErr(y)) return y;
    switch (o) {
      case '+': return x + y; case '-': return x - y; case '*': return x * y;
      case '/': return y === 0 ? new Err('#DIV/0!') : x / y;
      case '^': return Math.pow(x, y);
    }
    return new Err('#ERROR!');
  }
  function arrayOp(o, A, B) {
    const get = (X, i, j) => X instanceof Range ? (X.rows[X.h === 1 ? 0 : i] || [])[X.w === 1 ? 0 : j] : X;
    const h = Math.max(A instanceof Range ? A.h : 1, B instanceof Range ? B.h : 1), w = Math.max(A instanceof Range ? A.w : 1, B instanceof Range ? B.w : 1);
    const rows = [];
    for (let i = 0; i < h; i++) { const row = []; for (let j = 0; j < w; j++) row.push(binop(o, get(A, i, j), get(B, i, j))); rows.push(row); }
    return new Range(rows);
  }

  /* ---- 関数の補助 ---- */
  function collect(vals) {
    const out = [];
    for (const v of vals) {
      if (isErr(v)) return v;
      if (v instanceof Range) { for (const x of v) { if (isErr(x)) return x; if (typeof x === 'number') out.push(x); } }
      else if (v == null) continue;
      else { const n = toNum(v); if (isErr(n)) return n; out.push(n); }
    }
    return out;
  }
  function bools(vals) {
    const out = [];
    for (const v of vals) {
      if (v instanceof Range) { for (const x of v) { if (isErr(x)) return x; if (typeof x === 'boolean' || typeof x === 'number') out.push(!!x); } }
      else { const n = toNum(v); if (isErr(n)) return n; out.push(n !== 0); }
    }
    return out.length ? out : new Err('#VALUE!');
  }
  const agg = f => vals => { const n = collect(vals); return isErr(n) ? n : f(n); };
  const num1 = v => toNum(scalar(v));
  const str1 = v => { v = scalar(v); return isErr(v) ? v : toStr(v); };
  const guard = (...xs) => xs.find(isErr) || null;
  const sum = n => n.reduce((a, b) => a + b, 0);
  const opt = (v, d) => v === undefined || v === null ? d : num1(v);
  const rnd = mode => ([x, d]) => { x = num1(x); d = opt(d, 0); return guard(x, d) || roundTo(x, Math.trunc(d), mode); };
  const math1 = f => ([x]) => { x = num1(x); return guard(x) || f(x); };
  const text1 = f => ([s]) => { s = str1(s); return isErr(s) ? s : f(s); };
  const flat = v => v instanceof Range ? [...v] : [scalar(v)];
  const variance = (n, pop) => { if (n.length < (pop ? 1 : 2)) return new Err('#DIV/0!'); const m = sum(n) / n.length; return sum(n.map(x => (x - m) ** 2)) / (n.length - (pop ? 0 : 1)); };
  function makeCrit(c) {
    if (isErr(c)) return c;
    if (typeof c === 'number' || typeof c === 'boolean') return x => x === c || (typeof x === 'string' && parseLiteral(x) === c);
    const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(c == null ? '' : String(c));
    const op = m[1] || '=', raw = m[2], lit = raw === '' ? '' : parseLiteral(raw);
    if (typeof lit === 'number' || typeof lit === 'boolean') {
      return x => { if (typeof x === 'string') { const p = parseLiteral(x); if (typeof p === typeof lit) x = p; } return typeof x !== typeof lit ? op === '<>' : cmpOp(op, x, lit); };
    }
    if (op === '=' || op === '<>') {
      let test;
      if (raw === '') test = x => x == null || x === '';
      else if (/[*?]/.test(raw)) {
        const re = new RegExp('^' + raw.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        test = x => typeof x === 'string' && re.test(x);
      } else { const l = raw.toLowerCase(); test = x => x != null && toStr(x).toLowerCase() === l; }
      return op === '=' ? test : x => !test(x);
    }
    return x => typeof x === 'string' && cmpOp(op, x, raw);
  }
  function multiMask(pairs) {
    let shape = null; const masks = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const rg = pairs[i]; if (!(rg instanceof Range)) return new Err('#VALUE!');
      if (!shape) shape = [rg.h, rg.w]; else if (rg.h !== shape[0] || rg.w !== shape[1]) return new Err('#VALUE!');
      const t = makeCrit(scalar(pairs[i + 1])); if (isErr(t)) return t;
      masks.push([rg, t]);
    }
    if (!shape) return new Err('#VALUE!');
    const out = [];
    for (let i = 0; i < shape[0]; i++) for (let j = 0; j < shape[1]; j++) if (masks.every(([rg, t]) => t(rg.rows[i][j]))) out.push([i, j]);
    return out;
  }
  const pick = (rg, idx) => idx.map(([i, j]) => rg.rows[i] && rg.rows[i][j]).filter(y => typeof y === 'number');
  function lookupIndex(list, v, mode) {
    if (mode === 0) {
      if (typeof v === 'string' && /[*?]/.test(v)) { const t = makeCrit(v); return list.findIndex(x => typeof x === 'string' && t(x)); }
      return list.findIndex(x => x != null && !isErr(x) && compareVals(x, v) === 0);
    }
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      const x = list[i]; if (x == null || isErr(x) || typeof x !== typeof v) continue;
      const c = compareVals(x, v);
      if (mode > 0 ? c <= 0 : c >= 0) idx = i; else break;
    }
    return idx;
  }
  const dateOf = v => { const n = num1(v); return isErr(n) ? n : fromSerial(n); };

  const FN = {
    /* 数学/三角 */
    SUM: agg(sum),
    PRODUCT: agg(n => n.length ? n.reduce((a, b) => a * b, 1) : 0),
    SUMPRODUCT: vals => {
      const arrs = vals.map(v => v instanceof Range ? v : new Range([[scalar(v)]]));
      if (!arrs.length) return new Err('#VALUE!');
      const h = arrs[0].h, w = arrs[0].w;
      if (arrs.some(a => a.h !== h || a.w !== w)) return new Err('#VALUE!');
      let s = 0;
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
        let p = 1;
        for (const a of arrs) { const x = a.rows[i][j]; if (isErr(x)) return x; p *= typeof x === 'number' ? x : typeof x === 'boolean' ? +x : 0; }
        s += p;
      }
      return s;
    },
    ROUND: rnd(), ROUNDUP: rnd('up'), ROUNDDOWN: rnd('down'), TRUNC: rnd('down'),
    INT: math1(Math.floor), ABS: math1(Math.abs), SIGN: math1(Math.sign),
    SQRT: math1(x => x < 0 ? new Err('#NUM!') : Math.sqrt(x)),
    EXP: math1(Math.exp), LN: math1(x => x <= 0 ? new Err('#NUM!') : Math.log(x)),
    LOG10: math1(x => x <= 0 ? new Err('#NUM!') : Math.log10(x)),
    LOG: ([x, b]) => { x = num1(x); b = opt(b, 10); return guard(x, b) || (x <= 0 || b <= 0 || b === 1 ? new Err('#NUM!') : Math.log(x) / Math.log(b)); },
    POWER: ([a, b]) => { a = num1(a); b = num1(b); return guard(a, b) || Math.pow(a, b); },
    MOD: ([a, b]) => { a = num1(a); b = num1(b); return guard(a, b) || (b === 0 ? new Err('#DIV/0!') : a - b * Math.floor(a / b)); },
    QUOTIENT: ([a, b]) => { a = num1(a); b = num1(b); return guard(a, b) || (b === 0 ? new Err('#DIV/0!') : Math.trunc(a / b)); },
    CEILING: ([x, s]) => { x = num1(x); s = opt(s, 1); return guard(x, s) || (s === 0 ? 0 : Math.ceil(roundTo(x / s, 9)) * s); },
    FLOOR: ([x, s]) => { x = num1(x); s = opt(s, 1); return guard(x, s) || (s === 0 ? new Err('#DIV/0!') : Math.floor(roundTo(x / s, 9)) * s); },
    PI: () => Math.PI, RAND: () => Math.random(),
    RANDBETWEEN: ([a, b]) => { a = num1(a); b = num1(b); return guard(a, b) || Math.floor(Math.random() * (Math.floor(b) - Math.ceil(a) + 1)) + Math.ceil(a); },
    SIN: math1(Math.sin), COS: math1(Math.cos), TAN: math1(Math.tan),
    DEGREES: math1(x => x * 180 / Math.PI), RADIANS: math1(x => x * Math.PI / 180),
    FACT: math1(x => { if (x < 0) return new Err('#NUM!'); let f = 1; for (let i = 2; i <= Math.floor(x); i++) f *= i; return f; }),
    /* 統計 */
    AVERAGE: agg(n => n.length ? sum(n) / n.length : new Err('#DIV/0!')),
    MIN: agg(n => n.length ? Math.min(...n) : 0),
    MAX: agg(n => n.length ? Math.max(...n) : 0),
    MEDIAN: agg(n => { if (!n.length) return new Err('#NUM!'); const s = [...n].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }),
    MODE: agg(n => { const cnt = new Map(); let best = null, bc = 1; for (const x of n) { const c = (cnt.get(x) || 0) + 1; cnt.set(x, c); if (c > bc) { bc = c; best = x; } } return best == null ? new Err('#N/A') : best; }),
    COUNT: vals => { let k = 0; for (const v of vals) { if (v instanceof Range) { for (const x of v) if (typeof x === 'number') k++; } else if (v != null && typeof toNum(v) === 'number') k++; } return k; },
    COUNTA: vals => { let k = 0; for (const v of vals) { if (v instanceof Range) { for (const x of v) if (x != null && x !== '') k++; } else if (v != null) k++; } return k; },
    COUNTBLANK: vals => { let k = 0; for (const v of vals) if (v instanceof Range) for (const x of v) if (x == null || x === '') k++; return k; },
    LARGE: ([rg, k]) => { const n = collect([rg]); k = num1(k); const e = guard(n, k); if (e) return e; const s = [...n].sort((a, b) => b - a); return k < 1 || k > s.length ? new Err('#NUM!') : s[Math.ceil(k) - 1]; },
    SMALL: ([rg, k]) => { const n = collect([rg]); k = num1(k); const e = guard(n, k); if (e) return e; const s = [...n].sort((a, b) => a - b); return k < 1 || k > s.length ? new Err('#NUM!') : s[Math.ceil(k) - 1]; },
    RANK: ([x, rg, o]) => { x = num1(x); const n = collect([rg]); o = opt(o, 0); const e = guard(x, n, o); if (e) return e; if (!n.includes(x)) return new Err('#N/A'); return 1 + n.filter(y => o ? y < x : y > x).length; },
    STDEV: agg(n => { const v = variance(n, false); return isErr(v) ? v : Math.sqrt(v); }),
    STDEVP: agg(n => { const v = variance(n, true); return isErr(v) ? v : Math.sqrt(v); }),
    VAR: agg(n => variance(n, false)), VARP: agg(n => variance(n, true)),
    SUMIF: ([rg, cr, sr]) => { const idx = multiMask([rg, cr]); if (isErr(idx)) return idx; return sum(pick(sr instanceof Range ? sr : rg, idx)); },
    COUNTIF: ([rg, cr]) => { const idx = multiMask([rg, cr]); return isErr(idx) ? idx : idx.length; },
    AVERAGEIF: ([rg, cr, sr]) => { const idx = multiMask([rg, cr]); if (isErr(idx)) return idx; const n = pick(sr instanceof Range ? sr : rg, idx); return n.length ? sum(n) / n.length : new Err('#DIV/0!'); },
    SUMIFS: ([sr, ...p]) => { const idx = multiMask(p); if (isErr(idx)) return idx; if (!(sr instanceof Range)) return new Err('#VALUE!'); return sum(pick(sr, idx)); },
    COUNTIFS: p => { const idx = multiMask(p); return isErr(idx) ? idx : idx.length; },
    AVERAGEIFS: ([sr, ...p]) => { const idx = multiMask(p); if (isErr(idx)) return idx; if (!(sr instanceof Range)) return new Err('#VALUE!'); const n = pick(sr, idx); return n.length ? sum(n) / n.length : new Err('#DIV/0!'); },
    MAXIFS: ([sr, ...p]) => { const idx = multiMask(p); if (isErr(idx)) return idx; const n = pick(sr, idx); return n.length ? Math.max(...n) : 0; },
    MINIFS: ([sr, ...p]) => { const idx = multiMask(p); if (isErr(idx)) return idx; const n = pick(sr, idx); return n.length ? Math.min(...n) : 0; },
    /* 論理 */
    AND: vals => { const b = bools(vals); return isErr(b) ? b : b.every(Boolean); },
    OR: vals => { const b = bools(vals); return isErr(b) ? b : b.some(Boolean); },
    XOR: vals => { const b = bools(vals); return isErr(b) ? b : b.filter(Boolean).length % 2 === 1; },
    NOT: ([x]) => { x = num1(x); return guard(x) || x === 0; },
    TRUE: () => true, FALSE: () => false,
    /* 文字列操作 */
    CONCAT: vals => { let s = ''; for (const v of vals) for (const x of flat(v)) { if (isErr(x)) return x; s += toStr(x); } return s; },
    TEXTJOIN: ([d, ig, ...vals]) => { d = str1(d); ig = num1(ig); const e = guard(d, ig); if (e) return e; const out = []; for (const v of vals) for (const x of flat(v)) { if (isErr(x)) return x; if (ig && (x == null || x === '')) continue; out.push(toStr(x)); } return out.join(d); },
    LEN: text1(s => [...s].length), UPPER: text1(s => s.toUpperCase()), LOWER: text1(s => s.toLowerCase()),
    PROPER: text1(s => s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (m, a, b) => a + b.toUpperCase())),
    TRIM: text1(s => s.trim().replace(/[ 　]+/g, ' ')),
    LEFT: ([s, n]) => { s = str1(s); n = opt(n, 1); return guard(s, n) || [...s].slice(0, Math.max(0, n)).join(''); },
    RIGHT: ([s, n]) => { s = str1(s); n = opt(n, 1); return guard(s, n) || (n <= 0 ? '' : [...s].slice(-n).join('')); },
    MID: ([s, st, n]) => { s = str1(s); st = num1(st); n = num1(n); return guard(s, st, n) || (st < 1 ? new Err('#VALUE!') : [...s].slice(st - 1, st - 1 + Math.max(0, n)).join('')); },
    SUBSTITUTE: ([s, a, b, k]) => {
      s = str1(s); a = str1(a); b = str1(b); k = k === undefined ? null : num1(k);
      const e = guard(s, a, b, k); if (e) return e; if (a === '') return s;
      if (k == null) return s.split(a).join(b);
      let i = -1; for (let n = 0; n < k; n++) { i = s.indexOf(a, i + 1); if (i < 0) return s; }
      return s.slice(0, i) + b + s.slice(i + a.length);
    },
    REPLACE: ([s, st, n, t]) => { s = str1(s); st = num1(st); n = num1(n); t = str1(t); const e = guard(s, st, n, t); if (e) return e; const a = [...s]; a.splice(st - 1, n, t); return a.join(''); },
    REPT: ([s, n]) => { s = str1(s); n = num1(n); return guard(s, n) || (n < 0 ? new Err('#VALUE!') : s.repeat(Math.floor(n))); },
    FIND: ([f, s, st]) => { f = str1(f); s = str1(s); st = opt(st, 1); const e = guard(f, s, st); if (e) return e; const i = s.indexOf(f, st - 1); return i < 0 ? new Err('#VALUE!') : i + 1; },
    SEARCH: ([f, s, st]) => {
      f = str1(f); s = str1(s); st = opt(st, 1); const e = guard(f, s, st); if (e) return e;
      const re = new RegExp(f.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
      const m = re.exec(s.slice(st - 1)); return m ? m.index + st : new Err('#VALUE!');
    },
    TEXT: ([v, code]) => { v = scalar(v); code = str1(code); const e = guard(v, code); if (e) return e; const n = typeof v === 'string' ? parseLiteral(v) : v; return typeof n === 'number' ? formatCode(n, code) : toStr(v); },
    VALUE: ([s]) => { s = scalar(s); if (isErr(s)) return s; if (typeof s === 'number') return s; const n = parseLiteral(toStr(s)); return typeof n === 'number' ? n : new Err('#VALUE!'); },
    EXACT: ([a, b]) => { a = str1(a); b = str1(b); return guard(a, b) || a === b; },
    CHAR: math1(n => String.fromCharCode(n)), CODE: text1(s => s ? s.charCodeAt(0) : new Err('#VALUE!')),
    /* 日付/時刻 */
    TODAY: () => todaySerial(), NOW: () => nowSerial(),
    DATE: ([y, m, d]) => { y = num1(y); m = num1(m); d = num1(d); return guard(y, m, d) || serial(y < 1900 ? y + 1900 : y, m, d); },
    TIME: ([h, m, s]) => { h = num1(h); m = num1(m); s = num1(s); return guard(h, m, s) || ((h * 3600 + m * 60 + s) / 86400) % 1; },
    YEAR: ([v]) => { const t = dateOf(v); return isErr(t) ? t : t.y; },
    MONTH: ([v]) => { const t = dateOf(v); return isErr(t) ? t : t.m; },
    DAY: ([v]) => { const t = dateOf(v); return isErr(t) ? t : t.d; },
    HOUR: ([v]) => { const t = dateOf(v); return isErr(t) ? t : t.h; },
    MINUTE: ([v]) => { const t = dateOf(v); return isErr(t) ? t : t.mi; },
    SECOND: ([v]) => { const t = dateOf(v); return isErr(t) ? t : t.s; },
    WEEKDAY: ([v, ty]) => { const t = dateOf(v); ty = opt(ty, 1); const e = guard(t, ty); if (e) return e; return ty === 2 ? (t.wd + 6) % 7 + 1 : ty === 3 ? (t.wd + 6) % 7 : t.wd + 1; },
    EDATE: ([v, n]) => { const t = dateOf(v); n = num1(n); const e = guard(t, n); if (e) return e; const last = new Date(Date.UTC(t.y, t.m - 1 + n + 1, 0)).getUTCDate(); return serial(t.y, t.m + n, Math.min(t.d, last)); },
    EOMONTH: ([v, n]) => { const t = dateOf(v); n = num1(n); const e = guard(t, n); if (e) return e; return serial(t.y, t.m + n + 1, 0); },
    DAYS: ([a, b]) => { a = num1(a); b = num1(b); return guard(a, b) || Math.floor(a) - Math.floor(b); },
    DATEDIF: ([a, b, u]) => {
      a = num1(a); b = num1(b); u = str1(u); const e = guard(a, b, u); if (e) return e;
      if (a > b) return new Err('#NUM!');
      const A = fromSerial(a), B = fromSerial(b);
      let months = (B.y - A.y) * 12 + B.m - A.m; if (B.d < A.d) months--;
      switch (u.toUpperCase()) {
        case 'Y': return Math.floor(months / 12); case 'M': return months; case 'D': return Math.floor(b) - Math.floor(a);
        case 'YM': return months % 12;
        case 'MD': { let d = B.d - A.d; if (d < 0) d += new Date(Date.UTC(B.y, B.m - 1, 0)).getUTCDate(); return d; }
      }
      return new Err('#NUM!');
    },
    NETWORKDAYS: ([a, b]) => {
      a = num1(a); b = num1(b); const e = guard(a, b); if (e) return e;
      let s = Math.floor(Math.min(a, b)), t = Math.floor(Math.max(a, b)), k = 0;
      for (let d = s; d <= t; d++) { const wd = fromSerial(d).wd; if (wd !== 0 && wd !== 6) k++; }
      return a <= b ? k : -k;
    },
    /* 検索/行列 */
    VLOOKUP: ([v, tb, ci, ap]) => {
      v = scalar(v); ci = num1(ci); const e = guard(v, ci); if (e) return e;
      if (!(tb instanceof Range)) return new Err('#VALUE!');
      ci = Math.trunc(ci); if (ci < 1 || ci > tb.w) return new Err('#REF!');
      const approx = ap === undefined || ap === null ? true : num1(ap) !== 0;
      const i = lookupIndex(tb.rows.map(r => r[0]), v, approx ? 1 : 0);
      if (i < 0) return new Err('#N/A');
      const out = tb.rows[i][ci - 1]; return out == null ? 0 : out;
    },
    HLOOKUP: ([v, tb, ri, ap]) => {
      v = scalar(v); ri = num1(ri); const e = guard(v, ri); if (e) return e;
      if (!(tb instanceof Range)) return new Err('#VALUE!');
      ri = Math.trunc(ri); if (ri < 1 || ri > tb.h) return new Err('#REF!');
      const approx = ap === undefined || ap === null ? true : num1(ap) !== 0;
      const i = lookupIndex(tb.rows[0], v, approx ? 1 : 0);
      if (i < 0) return new Err('#N/A');
      const out = tb.rows[ri - 1][i]; return out == null ? 0 : out;
    },
    XLOOKUP: ([v, la, ra, nf, mm]) => {
      v = scalar(v); if (isErr(v)) return v;
      if (!(la instanceof Range) || !(ra instanceof Range)) return new Err('#VALUE!');
      mm = opt(mm, 0);
      const vertical = la.w === 1, list = [...la];
      let i;
      if (mm === 0 || mm === 2) i = lookupIndex(list, v, 0);
      else {
        let best = -1;
        list.forEach((x, k) => { if (x == null || isErr(x) || typeof x !== typeof v) return; const c = compareVals(x, v); if (c === 0) { if (best < 0 || compareVals(list[best], v) !== 0) best = k; } else if (mm === -1 ? c < 0 : c > 0) { if (best < 0 || (compareVals(list[best], v) !== 0 && (mm === -1 ? compareVals(x, list[best]) > 0 : compareVals(x, list[best]) < 0))) best = k; } });
        i = best;
      }
      if (i < 0) return nf === undefined || nf === null ? new Err('#N/A') : scalar(nf);
      const out = vertical ? (ra.rows[i] || [])[0] : ra.rows[0][i];
      return out == null ? 0 : out;
    },
    MATCH: ([v, rg, ty]) => {
      v = scalar(v); if (isErr(v)) return v;
      if (!(rg instanceof Range)) return new Err('#N/A');
      ty = opt(ty, 1); if (isErr(ty)) return ty;
      const i = lookupIndex([...rg], v, ty === 0 ? 0 : ty > 0 ? 1 : -1);
      return i < 0 ? new Err('#N/A') : i + 1;
    },
    INDEX: ([rg, r, c]) => {
      if (!(rg instanceof Range)) return new Err('#VALUE!');
      r = opt(r, 1); c = opt(c, 1); const e = guard(r, c); if (e) return e;
      if (rg.h === 1 && c === 1 && r > 1) { c = r; r = 1; }
      const row = rg.rows[r - 1]; if (!row || row[c - 1] === undefined) return new Err('#REF!');
      return row[c - 1] == null ? 0 : row[c - 1];
    },
    CHOOSE: ([i, ...xs]) => { i = num1(i); if (isErr(i)) return i; i = Math.trunc(i); return i < 1 || i > xs.length ? new Err('#VALUE!') : xs[i - 1]; },
    ROWS: ([rg]) => rg instanceof Range ? rg.h : 1,
    COLUMNS: ([rg]) => rg instanceof Range ? rg.w : 1,
    /* 情報 */
    ISBLANK: ([v]) => { v = scalar(v); return v == null; },
    ISNUMBER: ([v]) => typeof scalar(v) === 'number',
    ISTEXT: ([v]) => typeof scalar(v) === 'string',
    ISERROR: ([v]) => isErr(scalar(v)),
    ISNA: ([v]) => { v = scalar(v); return isErr(v) && v.code === '#N/A'; },
    ISEVEN: ([v]) => { v = num1(v); return guard(v) || Math.trunc(v) % 2 === 0; },
    ISODD: ([v]) => { v = num1(v); return guard(v) || Math.abs(Math.trunc(v)) % 2 === 1; },
    NA: () => new Err('#N/A'),
  };
  FN.CONCATENATE = FN.CONCAT;
  Object.assign(FN, { 'MODE.SNGL': FN.MODE, 'RANK.EQ': FN.RANK, 'STDEV.S': FN.STDEV, 'STDEV.P': FN.STDEVP, 'VAR.S': FN.VAR, 'VAR.P': FN.VARP, 'CEILING.MATH': FN.CEILING, 'FLOOR.MATH': FN.FLOOR });
  const SUBFN = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV', 8: 'STDEVP', 9: 'SUM', 10: 'VAR', 11: 'VARP' };
  const LAZY = {
    IF: (args, ctx) => {
      const c = toNum(scalar(args[0] ? evalNode(args[0], ctx) : false));
      if (isErr(c)) return c;
      if (c !== 0) return args[1] ? evalNode(args[1], ctx) : true;
      return args[2] ? evalNode(args[2], ctx) : false;
    },
    IFERROR: (args, ctx) => { const v = scalar(evalNode(args[0] || { k: 'lit', v: 0 }, ctx)); return isErr(v) ? (args[1] ? evalNode(args[1], ctx) : '') : v; },
    IFNA: (args, ctx) => { const v = scalar(evalNode(args[0] || { k: 'lit', v: 0 }, ctx)); return isErr(v) && v.code === '#N/A' ? (args[1] ? evalNode(args[1], ctx) : '') : v; },
    IFS: (args, ctx) => {
      for (let i = 0; i + 1 < args.length; i += 2) { const c = toNum(scalar(evalNode(args[i], ctx))); if (isErr(c)) return c; if (c !== 0) return evalNode(args[i + 1], ctx); }
      return new Err('#N/A');
    },
    SWITCH: (args, ctx) => {
      const v = scalar(evalNode(args[0], ctx)); if (isErr(v)) return v;
      let i = 1;
      for (; i + 1 < args.length; i += 2) if (compareVals(scalar(evalNode(args[i], ctx)), v) === 0) return evalNode(args[i + 1], ctx);
      return i < args.length ? evalNode(args[i], ctx) : new Err('#N/A');
    },
    ROW: (args, ctx) => { if (!args.length || args[0].k !== 'ref') return ctx.r + 1; const R = resolveRef(args[0], ctx); return isErr(R) ? R : R.r0 + 1; },
    COLUMN: (args, ctx) => { if (!args.length || args[0].k !== 'ref') return ctx.c + 1; const R = resolveRef(args[0], ctx); return isErr(R) ? R : R.c0 + 1; },
    SUBTOTAL: (args, ctx) => {
      const k = toNum(scalar(evalNode(args[0], ctx))); if (isErr(k)) return k;
      const name = SUBFN[k > 100 ? k - 100 : k]; if (!name) return new Err('#VALUE!');
      const vals = args.slice(1).map(a => {
        if (a.k !== 'ref') return evalNode(a, ctx);
        const R = resolveRef(a, ctx); if (isErr(R)) return R;
        const rows = [];
        for (let r = R.r0; r <= R.r1; r++) {
          if (host.rowHidden && host.rowHidden(R.s, r)) continue;
          const row = [];
          for (let c = R.c0; c <= R.c1; c++) { const cell = host.cell(R.s, r, c); row.push(cell && isFormula(cell.v) && /^=\s*SUBTOTAL\s*\(/i.test(cell.v) ? null : getValue(R.s, r, c)); }
          rows.push(row);
        }
        return new Range(rows.length ? rows : [[null]]);
      });
      return FN[name](vals, ctx);
    },
  };
  return {
    getValue, clear: () => cache.clear(), FN, LAZY,
    evaluateExpr: (src, si) => { try { return evaluate(src, { si, r: 0, c: 0 }); } catch (e) { return isErr(e) ? e : new Err('#ERROR!'); } },
    shiftFormula(f, dr, dc) {
      return mapRefs(f, (sh, a, b) => {
        const mv = p => p.full ? { ...p, c: p.ac ? p.c : p.c + dc } : ({ ...p, r: p.ar ? p.r : p.r + dr, c: p.ac ? p.c : p.c + dc });
        const A = mv(a), B = b && mv(b);
        if (!inGrid(A) || (B && !inGrid(B))) return null;
        return { a: A, b: B };
      }, ROWS);
    },
    mapRefs: (f, fn) => mapRefs(f, fn, ROWS),
  };
}

/* ---------- 共通の補助 ---------- */
function scalar(v) {
  if (v instanceof Range) return v.rows.length === 1 && v.rows[0].length === 1 ? v.rows[0][0] : (v.rows.length && v.rows[0].length ? v.rows[0][0] : new Err('#VALUE!'));
  return v;
}
function toNum(v) {
  if (isErr(v)) return v;
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v.trim() === '') return 0;
  const n = parseLiteral(v);
  return typeof n === 'number' ? n : new Err('#VALUE!');
}
function roundTo(x, d, mode) {
  const f = Math.pow(10, d), a = Number((Math.abs(x) * f).toPrecision(15));
  const r = mode === 'up' ? Math.ceil(a) : mode === 'down' ? Math.floor(a) : Math.round(a);
  return Math.sign(x) * r / f;
}
const isFormula = v => typeof v === 'string' && v.length > 1 && v[0] === '=';
function normalizeInput(v) {
  if (v[0] === '＝') v = '=' + v.slice(1);
  if (!isFormula(v)) return v;
  v = outsideStrings(v, p => toHalf(p));
  v = outsideStrings(v, p => p.replace(/[A-Za-z_][\w.]*(?=\s*\()/g, s => s.toUpperCase()).replace(REF_RE, m => m.replace(/[a-z]+(?=\$?\d|:|$)/g, s => s.toUpperCase())));
  let depth = 0;
  outsideStrings(v, p => { for (const ch of p) { if (ch === '(') depth++; else if (ch === ')') depth--; } return p; });
  if (depth > 0) v += ')'.repeat(depth);
  return v;
}

/* ---------- 関数の説明（関数の挿入・入力候補） ---------- */
const C = { M: '数学/三角', S: '統計', L: '論理', T: '文字列操作', D: '日付/時刻', R: '検索/行列', I: '情報' };
const FN_INFO = {
  SUM: ['M', 'SUM(数値1, [数値2], ...)', 'セル範囲に含まれる数値をすべて合計します。'],
  SUMIF: ['M', 'SUMIF(範囲, 検索条件, [合計範囲])', '指定した検索条件に一致するセルの値を合計します。'],
  SUMIFS: ['M', 'SUMIFS(合計対象範囲, 条件範囲1, 条件1, ...)', '複数の条件に一致するセルの値を合計します。'],
  SUMPRODUCT: ['M', 'SUMPRODUCT(配列1, [配列2], ...)', '配列の対応する要素の積を合計します。'],
  PRODUCT: ['M', 'PRODUCT(数値1, [数値2], ...)', '引数の積を返します。'],
  ROUND: ['M', 'ROUND(数値, 桁数)', '数値を指定した桁数に四捨五入します。'],
  ROUNDUP: ['M', 'ROUNDUP(数値, 桁数)', '数値を指定した桁数に切り上げます。'],
  ROUNDDOWN: ['M', 'ROUNDDOWN(数値, 桁数)', '数値を指定した桁数で切り捨てます。'],
  TRUNC: ['M', 'TRUNC(数値, [桁数])', '数値の小数部を切り捨てます。'],
  INT: ['M', 'INT(数値)', '数値を超えない最大の整数を返します。'],
  ABS: ['M', 'ABS(数値)', '絶対値を返します。'],
  SIGN: ['M', 'SIGN(数値)', '正なら1、0なら0、負なら-1を返します。'],
  SQRT: ['M', 'SQRT(数値)', '正の平方根を返します。'],
  POWER: ['M', 'POWER(数値, 指数)', 'べき乗を返します。'],
  MOD: ['M', 'MOD(数値, 除数)', '割り算の余りを返します。'],
  QUOTIENT: ['M', 'QUOTIENT(分子, 分母)', '割り算の商の整数部を返します。'],
  CEILING: ['M', 'CEILING(数値, 基準値)', '基準値の倍数に切り上げます。'],
  FLOOR: ['M', 'FLOOR(数値, 基準値)', '基準値の倍数に切り捨てます。'],
  EXP: ['M', 'EXP(数値)', 'e のべき乗を返します。'],
  LN: ['M', 'LN(数値)', '自然対数を返します。'],
  LOG: ['M', 'LOG(数値, [底])', '指定した底の対数を返します。'],
  LOG10: ['M', 'LOG10(数値)', '常用対数を返します。'],
  PI: ['M', 'PI()', '円周率を返します。'],
  RAND: ['M', 'RAND()', '0以上1未満の乱数を返します。'],
  RANDBETWEEN: ['M', 'RANDBETWEEN(最小値, 最大値)', '指定範囲の整数の乱数を返します。'],
  SIN: ['M', 'SIN(数値)', 'サインを返します。'], COS: ['M', 'COS(数値)', 'コサインを返します。'], TAN: ['M', 'TAN(数値)', 'タンジェントを返します。'],
  DEGREES: ['M', 'DEGREES(角度)', 'ラジアンを度に変換します。'], RADIANS: ['M', 'RADIANS(角度)', '度をラジアンに変換します。'],
  FACT: ['M', 'FACT(数値)', '階乗を返します。'],
  SUBTOTAL: ['M', 'SUBTOTAL(集計方法, 参照1, ...)', 'フィルターで非表示の行を除いて集計します（9=合計, 1=平均 など）。'],
  AVERAGE: ['S', 'AVERAGE(数値1, [数値2], ...)', '引数の平均値を返します。'],
  AVERAGEIF: ['S', 'AVERAGEIF(範囲, 条件, [平均対象範囲])', '条件に一致するセルの平均値を返します。'],
  AVERAGEIFS: ['S', 'AVERAGEIFS(平均対象範囲, 条件範囲1, 条件1, ...)', '複数の条件に一致するセルの平均値を返します。'],
  COUNT: ['S', 'COUNT(値1, [値2], ...)', '数値が含まれるセルの個数を数えます。'],
  COUNTA: ['S', 'COUNTA(値1, [値2], ...)', '空白でないセルの個数を数えます。'],
  COUNTBLANK: ['S', 'COUNTBLANK(範囲)', '空白セルの個数を数えます。'],
  COUNTIF: ['S', 'COUNTIF(範囲, 検索条件)', '条件に一致するセルの個数を数えます。'],
  COUNTIFS: ['S', 'COUNTIFS(条件範囲1, 条件1, ...)', '複数の条件に一致するセルの個数を数えます。'],
  MAX: ['S', 'MAX(数値1, [数値2], ...)', '最大値を返します。'], MIN: ['S', 'MIN(数値1, [数値2], ...)', '最小値を返します。'],
  MAXIFS: ['S', 'MAXIFS(最大範囲, 条件範囲1, 条件1, ...)', '条件に一致するセルの最大値を返します。'],
  MINIFS: ['S', 'MINIFS(最小範囲, 条件範囲1, 条件1, ...)', '条件に一致するセルの最小値を返します。'],
  MEDIAN: ['S', 'MEDIAN(数値1, [数値2], ...)', '中央値を返します。'],
  MODE: ['S', 'MODE(数値1, [数値2], ...)', '最も頻繁に出現する値を返します。'],
  LARGE: ['S', 'LARGE(配列, 順位)', '大きいほうから数えて指定した順位の値を返します。'],
  SMALL: ['S', 'SMALL(配列, 順位)', '小さいほうから数えて指定した順位の値を返します。'],
  RANK: ['S', 'RANK(数値, 参照, [順序])', '範囲内での順位を返します。'],
  STDEV: ['S', 'STDEV(数値1, ...)', '標本の標準偏差を返します。'], STDEVP: ['S', 'STDEVP(数値1, ...)', '母集団の標準偏差を返します。'],
  VAR: ['S', 'VAR(数値1, ...)', '標本の分散を返します。'], VARP: ['S', 'VARP(数値1, ...)', '母集団の分散を返します。'],
  IF: ['L', 'IF(論理式, [値が真の場合], [値が偽の場合])', '論理式の結果に応じて異なる値を返します。'],
  IFS: ['L', 'IFS(論理式1, 値1, [論理式2, 値2], ...)', '最初に真になった条件に対応する値を返します。'],
  IFERROR: ['L', 'IFERROR(値, エラーの場合の値)', 'エラーの場合に指定した値を返します。'],
  IFNA: ['L', 'IFNA(値, NAの場合の値)', '#N/A の場合に指定した値を返します。'],
  AND: ['L', 'AND(論理式1, [論理式2], ...)', 'すべての引数が TRUE のとき TRUE を返します。'],
  OR: ['L', 'OR(論理式1, [論理式2], ...)', 'いずれかの引数が TRUE のとき TRUE を返します。'],
  XOR: ['L', 'XOR(論理式1, [論理式2], ...)', '排他的論理和を返します。'],
  NOT: ['L', 'NOT(論理式)', '論理値を反転します。'],
  SWITCH: ['L', 'SWITCH(式, 値1, 結果1, ..., [既定])', '式を値の一覧と比較し、一致した結果を返します。'],
  TRUE: ['L', 'TRUE()', '論理値 TRUE を返します。'], FALSE: ['L', 'FALSE()', '論理値 FALSE を返します。'],
  CONCAT: ['T', 'CONCAT(テキスト1, ...)', '複数の文字列を結合します。'],
  CONCATENATE: ['T', 'CONCATENATE(文字列1, ...)', '複数の文字列を結合します。'],
  TEXTJOIN: ['T', 'TEXTJOIN(区切り文字, 空のセルは無視, テキスト1, ...)', '区切り文字を挟んで文字列を結合します。'],
  LEN: ['T', 'LEN(文字列)', '文字数を返します。'],
  LEFT: ['T', 'LEFT(文字列, [文字数])', '先頭から指定数の文字を返します。'],
  RIGHT: ['T', 'RIGHT(文字列, [文字数])', '末尾から指定数の文字を返します。'],
  MID: ['T', 'MID(文字列, 開始位置, 文字数)', '指定位置から指定数の文字を返します。'],
  UPPER: ['T', 'UPPER(文字列)', '英字を大文字に変換します。'], LOWER: ['T', 'LOWER(文字列)', '英字を小文字に変換します。'],
  PROPER: ['T', 'PROPER(文字列)', '英単語の先頭を大文字にします。'],
  TRIM: ['T', 'TRIM(文字列)', '余分なスペースを削除します。'],
  SUBSTITUTE: ['T', 'SUBSTITUTE(文字列, 検索文字列, 置換文字列, [置換対象])', '文字列中の指定した文字を置き換えます。'],
  REPLACE: ['T', 'REPLACE(文字列, 開始位置, 文字数, 置換文字列)', '指定位置の文字を置き換えます。'],
  REPT: ['T', 'REPT(文字列, 繰り返し回数)', '文字列を繰り返します。'],
  FIND: ['T', 'FIND(検索文字列, 対象, [開始位置])', '文字列の位置を返します（大文字小文字を区別）。'],
  SEARCH: ['T', 'SEARCH(検索文字列, 対象, [開始位置])', '文字列の位置を返します（ワイルドカード可）。'],
  TEXT: ['T', 'TEXT(値, 表示形式)', '数値を書式設定した文字列に変換します。例：TEXT(A1,"yyyy/mm/dd")'],
  VALUE: ['T', 'VALUE(文字列)', '文字列を数値に変換します。'],
  EXACT: ['T', 'EXACT(文字列1, 文字列2)', '2つの文字列が等しいか調べます。'],
  CHAR: ['T', 'CHAR(数値)', '文字コードに対応する文字を返します。'], CODE: ['T', 'CODE(文字列)', '先頭文字の文字コードを返します。'],
  TODAY: ['D', 'TODAY()', '今日の日付を返します。'], NOW: ['D', 'NOW()', '現在の日付と時刻を返します。'],
  DATE: ['D', 'DATE(年, 月, 日)', '日付を返します。'], TIME: ['D', 'TIME(時, 分, 秒)', '時刻を返します。'],
  YEAR: ['D', 'YEAR(シリアル値)', '年を返します。'], MONTH: ['D', 'MONTH(シリアル値)', '月を返します。'], DAY: ['D', 'DAY(シリアル値)', '日を返します。'],
  HOUR: ['D', 'HOUR(シリアル値)', '時を返します。'], MINUTE: ['D', 'MINUTE(シリアル値)', '分を返します。'], SECOND: ['D', 'SECOND(シリアル値)', '秒を返します。'],
  WEEKDAY: ['D', 'WEEKDAY(シリアル値, [種類])', '曜日を数値で返します（1=日曜）。'],
  EDATE: ['D', 'EDATE(開始日, 月)', '指定した月数後の日付を返します。'],
  EOMONTH: ['D', 'EOMONTH(開始日, 月)', '指定した月数後の月末日を返します。'],
  DAYS: ['D', 'DAYS(終了日, 開始日)', '2つの日付の間の日数を返します。'],
  DATEDIF: ['D', 'DATEDIF(開始日, 終了日, 単位)', '期間を年("Y")・月("M")・日("D")で返します。'],
  NETWORKDAYS: ['D', 'NETWORKDAYS(開始日, 終了日)', '土日を除いた日数を返します。'],
  VLOOKUP: ['R', 'VLOOKUP(検索値, 範囲, 列番号, [検索方法])', '範囲の先頭列で値を検索し、指定列の値を返します。'],
  HLOOKUP: ['R', 'HLOOKUP(検索値, 範囲, 行番号, [検索方法])', '範囲の先頭行で値を検索し、指定行の値を返します。'],
  XLOOKUP: ['R', 'XLOOKUP(検索値, 検索範囲, 戻り範囲, [見つからない場合], [一致モード])', '範囲を検索し、対応する値を返します。'],
  INDEX: ['R', 'INDEX(配列, 行番号, [列番号])', '指定位置の値を返します。'],
  MATCH: ['R', 'MATCH(検査値, 検査範囲, [照合の型])', '値が範囲内の何番目にあるかを返します。'],
  CHOOSE: ['R', 'CHOOSE(インデックス, 値1, [値2], ...)', 'インデックスに対応する値を返します。'],
  ROW: ['R', 'ROW([参照])', '行番号を返します。'], COLUMN: ['R', 'COLUMN([参照])', '列番号を返します。'],
  ROWS: ['R', 'ROWS(配列)', '行数を返します。'], COLUMNS: ['R', 'COLUMNS(配列)', '列数を返します。'],
  ISBLANK: ['I', 'ISBLANK(テストの対象)', '空白セルなら TRUE を返します。'],
  ISNUMBER: ['I', 'ISNUMBER(テストの対象)', '数値なら TRUE を返します。'],
  ISTEXT: ['I', 'ISTEXT(テストの対象)', '文字列なら TRUE を返します。'],
  ISERROR: ['I', 'ISERROR(テストの対象)', 'エラーなら TRUE を返します。'],
  ISNA: ['I', 'ISNA(テストの対象)', '#N/A なら TRUE を返します。'],
  ISEVEN: ['I', 'ISEVEN(数値)', '偶数なら TRUE を返します。'], ISODD: ['I', 'ISODD(数値)', '奇数なら TRUE を返します。'],
  NA: ['I', 'NA()', 'エラー値 #N/A を返します。'],
};
for (const k in FN_INFO) FN_INFO[k][0] = C[FN_INFO[k][0]];

window.SheetEngine = {
  createEngine, Err, isErr, Range, colName, colIdx, keyOf, parseKey, toHalf, JP, SHEET_NAME_RE,
  parseInput, parseLiteral, formatValue, formatCode, fmtGeneral, toStr, compareVals, isFormula, normalizeInput,
  outsideStrings, refsIn, roundTo, serial, fromSerial, todaySerial, nowSerial, FN_INFO, FORMATS, REF_RE,
};
})();
