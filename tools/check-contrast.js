/**
 * 對比度檢查（關卡 5-2）
 *
 * 掃過 css/style.css 裡所有「前景色 / 背景色」的組合，用 WCAG 公式算對比度，
 * 不合格的列出來。
 *
 *
 * 📌 為什麼需要這支：
 *
 *    顏色一多，人是記不住哪一組會出問題的。
 *    而低對比的失敗方式很陰險——它不會報錯，只是「有點暗」，
 *    在明亮的辦公室螢幕上看起來還好，到了光線不佳的工廠現場就讀不到了。
 *
 *    這個專案實際踩過兩次：
 *      1. 深灰字被外層規則染進近黑按鈕裡（1.5:1），在縮圖上只覺得「有點暗」
 *      2. 步驟編號只有 1.41:1，設計時以為是「低調」，其實是看不見
 *
 *    ⚠️ 還有一個更早的：現行線上版首頁副標是 4.43:1，差 0.07 沒到 AA。
 *       這種差距**不可能靠肉眼發現**。
 *
 *
 * 📌 這支檢查的是「token 的組合」，不是實際畫面。
 *    真正的畫面還要看瀏覽器（樣式滲透、繼承被蓋掉這類問題這裡看不到），
 *    但 token 錯了的話畫面一定跟著錯，所以這是第一道防線。
 *
 * WCAG AA：內文 4.5:1，大字（≥24px 或粗體 ≥18.66px）與圖形 3:1。
 *
 * 執行：node tools/check-contrast.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS  = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');


/** 從 :root 與 .on-* 區塊把所有 --token: #hex 讀出來 */
function readTokens(source) {
  const map = {};
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*[;}]/g;
  let m;
  while ((m = re.exec(source)) !== null) map['--' + m[1]] = m[2].toUpperCase();
  return map;
}

const T = readTokens(CSS);

const toRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** WCAG 相對亮度 */
const lum = (rgb) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};

const ratio = (a, b) => {
  const la = lum(toRgb(a)), lb = lum(toRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};


/**
 * 要檢查的組合。
 *
 * ⚠️ 新增顏色 token 時要在這裡補一組，否則它就沒有被任何人檢查過。
 */
const PAIRS = [
  // [前景, 背景, 需要幾比一, 說明]
  ['--text',        '--bg',        4.5, '主文字 / 底色'],
  ['--text-muted',  '--bg',        4.5, '次要文字 / 底色'],
  ['--text-subtle', '--bg',        4.5, '輔助文字 / 底色'],
  ['--text',        '--surface',   4.5, '主文字 / 卡片'],
  ['--text-muted',  '--surface',   4.5, '次要文字 / 卡片'],
  ['--text-subtle', '--surface',   4.5, '輔助文字 / 卡片'],
  ['--num',         '--bg',        3,   '大型步驟編號 / 底色（大字）'],
  ['--num',         '--surface',   3,   '大型步驟編號 / 卡片（大字）'],
  ['--star',        '--bg',        3,   '星等 / 底色（圖形）'],
  ['--star',        '--surface',   3,   '星等 / 卡片（圖形）'],

  ['--danger',      '--bg',        4.5, '未處理 / 底色'],
  ['--danger',      '--danger-bg', 4.5, '未處理 / 淺紅底'],
  ['--warn',        '--bg',        4.5, '處理中 / 底色'],
  ['--warn',        '--warn-bg',   4.5, '處理中 / 淺黃底'],
  ['--ok',          '--bg',        4.5, '已結案 / 底色'],
  ['--ok',          '--ok-bg',     4.5, '已結案 / 淺綠底'],

  /* ⚠️ WCAG 1.4.11：**互動元件的邊界**（輸入框、按鈕）要 3:1。
     純裝飾的分隔線（--border / --border-strong）沒有這個要求，所以不列入檢查——
     把這兩件事當成同一件，會得出「所有線都要很深」的錯誤結論。 */
  ['--border-input', '--bg',      3,   '輸入框 / 按鈕邊界 / 底色'],
  ['--border-input', '--surface', 3,   '輸入框 / 按鈕邊界 / 卡片'],
];

/** 深色表面上的文字（.on-dark 那一組，值直接寫在這裡對照） */
const ON_DARK = [
  ['#F2F2EF', '主文字',   4.5],
  ['#C2C2BD', '次要文字', 4.5],
  ['#93938E', '輔助文字', 4.5],
];


/**
 * 動態表的圖表顏色寫在 js/admin-dashboard.js，不是 CSS——
 * 所以 CSS 的 token 改了，圖表不會自動跟著改。
 *
 * ⚠️ 這件事實際發生過：狀態色原本在兩邊是不同的值，
 *    同一件「未處理」的案子，在案件列表是一種紅、在圖表是另一種紅。
 *    使用者說不出哪裡怪，但會覺得這兩個畫面不像同一個系統。
 */
function checkDashboardColors() {
  const js = fs.readFileSync(path.join(ROOT, 'js', 'admin-dashboard.js'), 'utf8');
  // ⚠️ 正規表示式刻意不用反斜線類別，用明確的空白字元類別就夠，也少一層跳脫
  const grab = (name) =>
    (js.match(new RegExp(name + "[ ]*:[ ]*'(#[0-9a-fA-F]{6})'")) || [])[1];
  const grabConst = (name) =>
    (js.match(new RegExp('const ' + name + "[ ]*=[ ]*'(#[0-9a-fA-F]{6})'")) || [])[1];
  const up = (v) => (v ? v.toUpperCase() : null);

  return [
    [up(grab('ST_NEW')),               T['--danger'], '圖表的「未處理」色'],
    [up(grab('ST_PROC')),              T['--warn'],   '圖表的「處理中」色'],
    [up(grab('ST_DONE')),              T['--ok'],     '圖表的「已結案」色'],
    [up(grabConst('TREND_COUNT_COLOR')),  T['--action'], '趨勢圖的回報數線'],
    [up(grabConst('TREND_RATING_COLOR')), T['--star'],   '趨勢圖的滿意度線'],
  ];
}


let pass = 0, fail = 0;
const rows = [];

PAIRS.forEach(([fgTok, bgTok, need, label]) => {
  const fg = T[fgTok], bg = T[bgTok];
  if (!fg || !bg) {
    fail++;
    rows.push({ label, note: `找不到 token：${!fg ? fgTok : bgTok}`, ok: false });
    return;
  }
  const r = ratio(fg, bg);
  const ok = r >= need;
  ok ? pass++ : fail++;
  rows.push({ label, fg, bg, r, need, ok });
});

ON_DARK.forEach(([fg, label, need]) => {
  const bg = T['--action'];
  const r = ratio(fg, bg);
  const ok = r >= need;
  ok ? pass++ : fail++;
  rows.push({ label: label + ' / 深色按鈕', fg, bg, r, need, ok });
});


console.log('\n===== 對比度檢查（WCAG AA）=====\n');

rows.forEach((row) => {
  if (row.note) {
    console.log(`  FAIL ${row.label}\n         ${row.note}`);
    return;
  }
  const mark = row.ok ? 'OK  ' : 'FAIL';
  const num  = row.r.toFixed(2).padStart(5);
  console.log(`  ${mark} ${num}:1  (需 ${row.need})  ${row.fg} / ${row.bg}   ${row.label}`);
});

console.log('\n----- 圖表顏色與 CSS token 是否一致 -----\n');

checkDashboardColors().forEach(([jsVal, cssVal, label]) => {
  const ok = !!jsVal && !!cssVal && jsVal === cssVal;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}：js=${jsVal || '(找不到)'}  css=${cssVal || '(找不到)'}`);
});

console.log(`\n===== 通過 ${pass} 項，失敗 ${fail} 項 =====\n`);

if (fail > 0) {
  console.log('⚠️ 不合格的組合會在光線不佳的現場讀不到。');
  console.log('   調整 css/style.css 的 :root token，然後再跑一次這支。\n');
}

process.exit(fail > 0 ? 1 : 0);
