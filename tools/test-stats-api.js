/**
 * 本機測試 Dashboard 統計（規格 §3.8）
 *
 *   getDashboardStats  月統計 / 年統計 / 趨勢 / 各餐廳表現 / 權限
 *
 * 這一支特別盯三件容易錯又不容易發現的事：
 *   1. 軟刪除的案件不可以被算進去
 *   2. 分類是複選，「按出現次數」的總和會超過案件數（這是對的）
 *   3. 沒有資料的月份，回報數是 0 但平均滿意度必須是 null
 *      （「沒人回報」與「大家都給 0 分」是兩件事）
 *
 * 執行：node tools/test-stats-api.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
const TZ = 'Asia/Jakarta';
const NOW_ISO = '2026-08-20T12:00:00+07:00';

const HEADERS = ['案件編號','提交時間','工號','姓名','語言','餐廳地點','餐別','問題分類','問題描述',
  '滿意度評分','優先層級','圖片連結','處理狀態','處理者','處理回覆','處理時間',
  '最後更新時間','最後更新者','提交識別碼','已刪除'];

const ROWS_SPEC = [
  // --- 2026-08 ---
  // 已結案，8/1 提交、8/4 結案 → 3 天
  ['PCI-202608-001', '@ISO:2026-08-01T08:00:00+07:00', '01', 'A', 'ID', 'LOC_02', 'MEAL_BREAKFAST',
   'CAT_TASTE,CAT_HYGIENE', '', 2, '', '', 'ST_DONE', '', '已處理',
   '@ISO:2026-08-04T08:00:00+07:00', '', '', 's1', ''],

  // 未處理
  ['PCI-202608-002', '@ISO:2026-08-19T12:00:00+07:00', '02', 'B', 'ID', 'LOC_04', 'MEAL_LUNCH',
   'CAT_SERVICE', '', 4, '', '', 'ST_NEW', '', '', '', '', '', 's2', ''],

  // 處理中
  ['PCI-202608-003', '@ISO:2026-08-10T18:00:00+07:00', '03', 'C', 'ZH', 'LOC_02', 'MEAL_DINNER',
   'CAT_FACILITY', '', 3, '', '', 'ST_PROC', '', '處理中',
   '@ISO:2026-08-11T09:00:00+07:00', '', '', 's3', ''],

  // 已結案，8/5 → 8/6 = 1 天
  ['PCI-202608-004', '@ISO:2026-08-05T08:00:00+07:00', '04', 'D', 'ID', 'LOC_04', 'MEAL_LUNCH',
   'CAT_TASTE', '', 5, '', '', 'ST_DONE', '', '已處理',
   '@ISO:2026-08-06T08:00:00+07:00', '', '', 's4', ''],

  // 軟刪除 → 任何統計都不該出現
  ['PCI-202608-005', '@ISO:2026-08-05T12:00:00+07:00', '05', 'E', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_TASTE', '', 1, '', '', 'ST_NEW', '', '', '', '', '', 's5', 'TRUE'],

  // 評分空白 → 不該被當成 0 分拉低平均
  ['PCI-202608-006', '@ISO:2026-08-15T12:00:00+07:00', '06', 'F', 'ID', 'LOC_02', 'MEAL_DINNER',
   'CAT_HYGIENE', '', '', '', '', 'ST_NEW', '', '', '', '', '', 's6', ''],

  // 狀態空白 → 應算未處理
  ['PCI-202608-007', '@ISO:2026-08-16T12:00:00+07:00', '07', 'G', 'ID', 'LOC_R3', 'MEAL_LUNCH',
   'CAT_SERVICE', '', 3, '', '', '', '', '', '', '', '', 's7', ''],

  // --- 2026-06 ---
  ['PCI-202606-001', '@ISO:2026-06-10T08:00:00+07:00', '08', 'H', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_TASTE', '', 4, '', '', 'ST_DONE', '', '已處理',
   '@ISO:2026-06-12T08:00:00+07:00', '', '', 's8', ''],

  // --- 2025-12（跨年度）---
  ['PCI-202512-001', '@ISO:2025-12-20T08:00:00+07:00', '09', 'I', 'ID', 'LOC_04', 'MEAL_LUNCH',
   'CAT_FACILITY', '', 2, '', '', 'ST_DONE', '', '已處理',
   '@ISO:2025-12-22T08:00:00+07:00', '', '', 's9', ''],
];

const sandbox = {
  console,
  Session: { getScriptTimeZone: () => TZ },
  Utilities: {
    formatDate(date, tz, fmt) {
      const shifted = new Date(date.getTime() + 7 * 3600 * 1000);
      const y   = shifted.getUTCFullYear();
      const m   = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const day = String(shifted.getUTCDate()).padStart(2, '0');
      const hh  = String(shifted.getUTCHours()).padStart(2, '0');
      const mm  = String(shifted.getUTCMinutes()).padStart(2, '0');
      const ss  = String(shifted.getUTCSeconds()).padStart(2, '0');
      if (fmt === 'yyyyMM')     return `${y}${m}`;
      if (fmt === 'yyyy')       return `${y}`;
      if (fmt === 'MM')         return m;
      if (fmt === 'yyyy-MM-dd') return `${y}-${m}-${day}`;
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    },
  },
  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => (name === '回報資料' ? makeSheet(sandbox.__ROWS, HEADERS) : null),
    }),
  },
  Logger: { log: () => {} },
  __ROWS: [],
};

function makeSheet(rows, headers) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => headers.length,
    getRange(row, col, numRows) {
      const n = numRows || 1;
      if (!col || !row) throw new Error('getRange 收到不合法的位置');
      return {
        getValues() {
          if (row === 1) return [headers];
          return rows.slice(row - 2, row - 2 + n);
        },
      };
    },
  };
}

vm.createContext(sandbox);

vm.runInContext(`
  const _RealDate = Date;
  Date = class extends _RealDate {
    constructor(...args) { if (args.length === 0) super(_FIXED_NOW); else super(...args); }
    static now() { return _FIXED_NOW; }
  };
`.replace(/_FIXED_NOW/g, String(new Date(NOW_ISO).getTime())), sandbox);

vm.runInContext(
  `__ROWS = ${JSON.stringify(ROWS_SPEC)}.map(function (row) {
     return row.map(function (v) {
       return (typeof v === 'string' && v.indexOf('@ISO:') === 0) ? new Date(v.slice(5)) : v;
     });
   });`, sandbox);

['Config.js', 'Utils.js', 'Stats.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});

const FEEDBACK_SRC = fs.readFileSync(path.join(ROOT, 'gas', 'Feedback.js'), 'utf8');
vm.runInContext(FEEDBACK_SRC.match(/function parseCategoryCodes[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', 'Auth.js'), 'utf8')
  .match(/function isTrue[\s\S]*?\n}/)[0], sandbox);


let pass = 0, failCount = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}
const evalIn = (code) => vm.runInContext(code, sandbox);

const result = evalIn(`getDashboardStats({}, {account:'super@pci', role:'SUPER'})`);
const d = result.data;


console.log('\n===== 可用的月份與年份 =====\n');

check('回傳成功',        result.ok, true);
check('月份由新到舊',    d.available_months, ['202608', '202606', '202512']);
check('年份由新到舊',    d.available_years, ['2026', '2025']);
check('沒資料的月份不出現在清單裡',
  d.available_months.indexOf('202607') === -1, true);


console.log('\n===== 月統計（2026-08）=====\n');

const m = d.months['202608'];
check('總件數（軟刪除那筆不算）', m.total, 6);
check('未處理（含狀態空白那筆）', m.new, 3);
check('處理中',                   m.processing, 1);
check('已結案',                   m.done, 2);
check('結案率',                   m.done_rate, 33);

// 評分：2,4,3,5,3 五筆有分（空白那筆不算）→ 17/5 = 3.4
check('平均滿意度只算有評分的',   m.avg_rating, 3.4);
check('評分空白的沒被當成 0 分',  m.avg_rating > 3, true);

// 處理天數：只有兩筆已結案，3 天與 1 天 → 平均 2
check('平均處理天數只算已結案的', m.avg_days, 2);

check('各餐廳（由多到少）',
  m.by_location, [{ code:'LOC_02', count:3 }, { code:'LOC_04', count:2 }, { code:'LOC_R3', count:1 }]);
check('軟刪除的沒被算進餐廳統計',
  m.by_location.filter((x) => x.code === 'LOC_02')[0].count, 3);


console.log('\n===== 問題分類：按出現次數 =====\n');

// CAT_TASTE 2、CAT_HYGIENE 2、CAT_SERVICE 2、CAT_FACILITY 1 = 7 次 > 6 件
const catTotal = m.by_category.reduce((sum, x) => sum + x.count, 0);
check('分類次數總和大於案件數（複選造成，這是對的）',
  catTotal > m.total, true);
check('分類次數總和',   catTotal, 7);
check('複選的兩個分類各算一次',
  m.by_category.filter((x) => x.code === 'CAT_HYGIENE')[0].count, 2);
check('由多到少排序',
  m.by_category[0].count >= m.by_category[m.by_category.length - 1].count, true);


console.log('\n===== 年統計（2026）=====\n');

const y = d.years['2026'];
check('年度總件數（8 月 6 筆 + 6 月 1 筆）', y.total, 7);
check('年度結案率', y.done_rate, 43);

check('趨勢固定 12 個月', y.monthly.length, 12);
check('1 月沒資料 → 回報數 0', y.monthly[0].count, 0);

// 這是最容易寫錯的一項
check('1 月沒資料 → 平均滿意度是 null，不是 0', y.monthly[0].avg_rating, null);
check('6 月有 1 筆',        y.monthly[5].count, 1);
check('6 月平均滿意度',     y.monthly[5].avg_rating, 4);
check('8 月有 6 筆',        y.monthly[7].count, 6);
check('12 月沒資料',        y.monthly[11].count, 0);


console.log('\n===== 各餐廳年度表現 =====\n');

check('依回報數由多到少', y.locations.map((x) => x.code), ['LOC_02', 'LOC_04', 'LOC_R3']);

const loc02 = y.locations[0];
check('LOC_02 年度件數（8 月 3 筆 + 6 月 1 筆）', loc02.total, 4);
check('LOC_02 結案率（4 筆中 2 筆結案）',        loc02.done_rate, 50);
check('LOC_02 平均滿意度（2、3、4 三筆有分）',   loc02.avg_rating, 3);
check('LOC_02 平均處理天數（3 天與 2 天）',      loc02.avg_days, 2.5);

const locR3 = y.locations[2];
check('LOC_R3 沒有結案的 → 結案率 0',   locR3.done_rate, 0);
check('LOC_R3 沒有結案的 → 天數是 null，不是 0', locR3.avg_days, null);


console.log('\n===== 跨年度 =====\n');

const y2025 = d.years['2025'];
check('2025 年只有 1 筆',      y2025.total, 1);
check('2025 年 12 月那一格',   y2025.monthly[11].count, 1);
check('2025 年 1 月是空的',    y2025.monthly[0].count, 0);
check('2026 年的資料沒混進 2025', y2025.total !== d.years['2026'].total, true);


console.log('\n===== 沒有任何資料時 =====\n');

evalIn(`__ROWS = []`);
const emptyResult = evalIn(`getDashboardStats({}, {account:'super@pci', role:'SUPER'})`);
check('不會壞掉',        emptyResult.ok, true);
check('月份清單是空的',  emptyResult.data.available_months, []);
check('年份清單是空的',  emptyResult.data.available_years, []);


console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount > 0 ? 1 : 0);
