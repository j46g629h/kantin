/**
 * 本機測試 getCaseList 的邏輯（篩選 / 排序 / 統計 / 逾期）
 *
 * 作法：把 Apps Script 的全域服務用假的替代品頂上，
 * 再把 gas/ 的檔案接起來在 Node 裡跑。
 * 這樣不必真的部署、不必登入，就能驗證判斷邏輯對不對。
 *
 * ⚠️ 假資料裡的 Date 物件必須在 sandbox「裡面」建立。
 *    在外面建立的話，sandbox 裡的 `x instanceof Date` 會是 false
 *    （兩邊的 Date 是不同 realm 的不同建構子），
 *    程式會誤以為提交時間不是日期。真實的 Apps Script 沒有這個問題。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'D:/Claude/KANTIN';
const TZ = 'Asia/Jakarta';
const NOW_ISO = '2026-08-20T12:00:00+07:00';

const HEADERS = ['案件編號','提交時間','工號','姓名','語言','餐廳地點','餐別','問題分類','問題描述',
  '滿意度評分','優先層級','圖片連結','處理狀態','處理者','處理回覆','處理時間',
  '最後更新時間','最後更新者','提交識別碼','已刪除'];

// 日期先寫成 @ISO: 開頭的字串，稍後在 sandbox 裡才轉成 Date
const ROWS_SPEC = [
  ['PCI-202608-001', '@ISO:2026-08-01T08:00:00+07:00', '0012345', 'Budi', 'ID', 'LOC_02', 'MEAL_BREAKFAST',
   'CAT_TASTE,CAT_HYGIENE', '太鹹了', 2, '', '', 'ST_NEW', '', '', '', '', '', 's1', ''],

  ['PCI-202608-002', '@ISO:2026-08-19T12:00:00+07:00', '0012346', 'Siti', 'ID', 'LOC_04', 'MEAL_LUNCH',
   'CAT_SERVICE', '', 4, '', '', 'ST_NEW', '', '', '', '', '', 's2', ''],

  ['PCI-202608-003', '@ISO:2026-08-10T18:00:00+07:00', 'A1234', '測試員工', 'ZH', 'LOC_02', 'MEAL_DINNER',
   'CAT_FACILITY', '燈壞了', 3, '', '', 'ST_PROC', '王小明', '已安排維修',
   '@ISO:2026-08-11T09:00:00+07:00', '', '', 's3', ''],

  ['PCI-202607-004', '@ISO:2026-07-15T12:00:00+07:00', '0023456', 'Dewi', 'ID', 'LOC_R3', 'MEAL_LUNCH',
   'CAT_OTHER', '希望多一點水果', 5, '', '', 'ST_DONE', '王小明', '已轉知廚房',
   '@ISO:2026-07-16T09:00:00+07:00', '', '', 's4', ''],

  // 已軟刪除，任何結果都不該出現
  ['PCI-202608-005', '@ISO:2026-08-05T12:00:00+07:00', '0012345', 'Budi', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_TASTE', '重複回報', 1, '', '', 'ST_NEW', '', '', '', '', '', 's5', 'TRUE'],
];


// ---- 假的 Apps Script 服務 ----
const sandbox = {
  console,
  Session: { getScriptTimeZone: () => TZ },

  Utilities: {
    formatDate(date, tz, fmt) {
      // 只支援測試會用到的格式，固定用 Jakarta（UTC+7）換算
      const shifted = new Date(date.getTime() + 7 * 3600 * 1000);
      const y = shifted.getUTCFullYear();
      const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const day = String(shifted.getUTCDate()).padStart(2, '0');
      const hh = String(shifted.getUTCHours()).padStart(2, '0');
      const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
      const ss = String(shifted.getUTCSeconds()).padStart(2, '0');
      if (fmt === 'yyyyMM') return `${y}${m}`;
      if (fmt === 'yyyy-MM-dd') return `${y}-${m}-${day}`;
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    },
  },

  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => {
        if (name !== '回報資料') return null;
        const rows = sandbox.__ROWS;
        return {
          getLastRow: () => rows.length + 1,
          getLastColumn: () => HEADERS.length,
          getRange(row, col, numRows) {
            const values = (row === 1) ? [HEADERS] : rows.slice(row - 2, row - 2 + numRows);
            return { getValues: () => values };
          },
        };
      },
    }),
  },
};

vm.createContext(sandbox);

// 1) 先把 new Date() 固定成測試時間，逾期天數才有確定的答案。
//    帶參數的 new Date(x) 行為不變，而且產生的物件仍然 instanceof Date。
vm.runInContext(`
  const _RealDate = Date;
  Date = class extends _RealDate {
    constructor(...args) { if (args.length === 0) super(_FIXED_NOW); else super(...args); }
    static now() { return _FIXED_NOW; }
  };
`.replace(/_FIXED_NOW/g, String(new Date(NOW_ISO).getTime())), sandbox);

// 2) 再在 sandbox 裡把 @ISO: 字串轉成 Date（這樣才是同一個 realm 的 Date）
vm.runInContext(
  `__ROWS = ${JSON.stringify(ROWS_SPEC)}.map(function (row) {
     return row.map(function (v) {
       return (typeof v === 'string' && v.indexOf('@ISO:') === 0) ? new Date(v.slice(5)) : v;
     });
   });`, sandbox);

// 3) 載入要測的程式
['Config.js', 'Utils.js', 'Query.js', 'Cases.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});

// parseCategoryCodes 住在 Feedback.js，只把那一支搬進來，
// 免得連帶拉進 LockService / DriveApp 等一大票服務
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', 'Feedback.js'), 'utf8')
  .match(/function parseCategoryCodes[\s\S]*?\n}/)[0], sandbox);


// ---- 開始測試 ----
let pass = 0, failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}

function run(params) {
  return vm.runInContext(`getCaseList(${JSON.stringify(params)}, {name:'測試'})`, sandbox);
}

// 先確認假資料本身被正確認成日期，否則後面全部會一起錯
const sanity = run({});
if (sanity.data.cases[0].submit_time.indexOf('2026') !== 0) {
  console.log('假資料的日期沒有被認出來，測試環境有問題：', sanity.data.cases[0].submit_time);
  process.exit(2);
}

console.log('\n【1】不帶篩選：應回傳 4 筆（軟刪除那筆要被排除），由新到舊');
let r = run({});
check('ok', r.ok, true);
check('總數', r.data.total, 4);
check('順序（新→舊）', r.data.cases.map(c => c.case_id),
  ['PCI-202608-002', 'PCI-202608-003', 'PCI-202608-001', 'PCI-202607-004']);
check('不含已刪除', r.data.cases.some(c => c.case_id === 'PCI-202608-005'), false);

console.log('\n【2】統計卡片（不受篩選影響）');
check('未處理', r.data.stats.new, 2);
check('處理中', r.data.stats.processing, 1);
check('已結案', r.data.stats.done, 1);
check('本月(202608)', r.data.stats.this_month, 3);
check('逾期', r.data.stats.overdue, 1);

console.log('\n【3】逾期判斷：未處理且滿 3 天');
const byId = Object.fromEntries(r.data.cases.map(c => [c.case_id, c]));
check('8/01 未處理 → 逾期', byId['PCI-202608-001'].is_overdue, true);
check('8/01 已過天數', byId['PCI-202608-001'].days_open, 19);
check('8/19 未處理（1 天）→ 未逾期', byId['PCI-202608-002'].is_overdue, false);
check('處理中不算逾期', byId['PCI-202608-003'].is_overdue, false);

console.log('\n【4】內部欄位不可外洩');
check('無 sort_key', 'sort_key' in byId['PCI-202608-001'], false);
check('無 submit_date', 'submit_date' in byId['PCI-202608-001'], false);
check('無 submit_month', 'submit_month' in byId['PCI-202608-001'], false);

console.log('\n【5】管理端看得到工號與姓名');
check('工號保留前導零', byId['PCI-202608-001'].emp_id, '0012345');
check('姓名', byId['PCI-202608-001'].emp_name, 'Budi');
check('員工語言', byId['PCI-202608-003'].lang, 'ZH');
check('提交時間格式', byId['PCI-202608-001'].submit_time, '2026-08-01 08:00:00');

console.log('\n【6】依狀態篩選');
check('ST_NEW', run({ status_code: 'ST_NEW' }).data.cases.map(c => c.case_id),
  ['PCI-202608-002', 'PCI-202608-001']);
check('ST_DONE', run({ status_code: 'ST_DONE' }).data.total, 1);
check('篩選後統計不變', run({ status_code: 'ST_DONE' }).data.stats.new, 2);

console.log('\n【7】依地點 / 分類篩選');
check('LOC_02', run({ location_code: 'LOC_02' }).data.total, 2);
check('複選案件的第 2 個分類也查得到', run({ category_code: 'CAT_HYGIENE' }).data.cases.map(c => c.case_id),
  ['PCI-202608-001']);
check('CAT_TASTE', run({ category_code: 'CAT_TASTE' }).data.total, 1);

console.log('\n【8】日期範圍（含起訖當天）');
check('8/10 起（8/10 + 8/19）', run({ date_from: '2026-08-10' }).data.total, 2);
check('到 8/10 止', run({ date_to: '2026-08-10' }).data.total, 3);
check('剛好 8/10 當天', run({ date_from: '2026-08-10', date_to: '2026-08-10' }).data.cases.map(c => c.case_id),
  ['PCI-202608-003']);
check('7 月整月', run({ date_from: '2026-07-01', date_to: '2026-07-31' }).data.total, 1);

console.log('\n【9】關鍵字（案件編號 / 工號 / 姓名 / 描述 / 處理者）');
check('姓名（不分大小寫）', run({ keyword: 'budi' }).data.total, 1);
check('描述', run({ keyword: '燈' }).data.total, 1);
check('工號', run({ keyword: 'a1234' }).data.total, 1);
check('處理者', run({ keyword: '王小明' }).data.total, 2);
check('案件編號片段', run({ keyword: '202607' }).data.total, 1);
check('查無', run({ keyword: 'zzzz' }).data.total, 0);

console.log('\n【10】篩選條件可疊加');
check('LOC_02 + ST_NEW', run({ location_code: 'LOC_02', status_code: 'ST_NEW' }).data.cases.map(c => c.case_id),
  ['PCI-202608-001']);

console.log('\n【11】limit 上限保護');
check('limit=1', run({ limit: 1 }).data.returned, 1);
check('limit=1 時 total 仍是全部', run({ limit: 1 }).data.total, 4);
check('limit=99999 被夾到 MAX 而非爆掉', run({ limit: 99999 }).data.returned, 4);

console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount ? 1 : 0);
