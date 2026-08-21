/**
 * 本機測試管理端案件 API：
 *   getCaseList  篩選 / 排序 / 統計 / 逾期
 *   updateCase   狀態驗證 / 回覆必填 / 寫回欄位
 *   getTemplates 回覆範本
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


// 選項設定：類型 / 代碼 / 中文 / 印尼文 / 排序 / 啟用
const OPTION_HEADERS = ['類型', '代碼', '中文顯示', '印尼文顯示', '排序', '啟用'];
const OPTIONS_SPEC = [
  ['LOCATION', 'LOC_02', '第二餐廳', 'Kantin 2',  1, true],
  ['LOCATION', 'LOC_04', '第四餐廳', 'Kantin 4',  2, true],
  ['LOCATION', 'LOC_R3', 'R3廠餐廳', 'Kantin R3', 3, true],
  ['MEAL',     'MEAL_LUNCH', '午餐', 'Menu Siang', 1, true],
  ['CATEGORY', 'CAT_TASTE',  '菜單口味', 'Rasa Makanan', 1, true],
  ['STATUS',   'ST_NEW',  '未處理', 'Belum Diproses',  1, true],
  ['STATUS',   'ST_PROC', '處理中', 'Sedang Diproses', 2, true],
  ['STATUS',   'ST_DONE', '已結案', 'Selesai',         3, true],
];

// 回覆範本：代碼 / 分類 / 中文內容 / 印尼文內容
const TEMPLATE_HEADERS = ['代碼', '分類', '中文內容', '印尼文內容'];
const TEMPLATES_SPEC = [
  ['TPL_01', 'CAT_TASTE',    '已轉知廚房調整口味。', 'Sudah disampaikan ke dapur.'],
  ['TPL_02', 'CAT_HYGIENE',  '已加強清潔頻率。',     'Frekuensi pembersihan sudah ditingkatkan.'],
  ['TPL_03', 'CAT_FACILITY', '已安排維修。',         'Perbaikan sudah dijadwalkan.'],
  ['',       '',             '',                     ''],   // 空白列，應該被略過
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

  // updateCase 會寫回 Sheet，所以假的儲存格也要能寫
  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => {
        if (name === '回報資料')  return makeSheet(sandbox.__ROWS, HEADERS);
        if (name === '選項設定')  return makeSheet(sandbox.__OPTIONS, OPTION_HEADERS);
        if (name === '回覆範本')  return makeSheet(sandbox.__TEMPLATES, TEMPLATE_HEADERS);
        return null;
      },
    }),
  },

  // updateCase 用 LockService 避免兩人同時儲存；測試裡一定拿得到鎖
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
  },

  CacheService: {
    getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }),
  },

  Logger: { log: () => {} },
};


/**
 * 假的分頁物件。
 *
 * 只實作程式真的會用到的方法：讀表頭、讀資料、寫值、TextFinder。
 * getRange 回傳的物件同時支援讀與寫，寫入會直接改到 rows 陣列上，
 * 這樣測試才能檢查「到底寫進去什麼」。
 */
function makeSheet(rows, headers) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => headers.length,

    getRange(row, col, numRows, numCols) {
      const n = numRows || 1;
      const c = numCols || 1;

      return {
        getValues() {
          if (row === 1) return [headers];
          return rows.slice(row - 2, row - 2 + n);
        },
        // 單一儲存格的寫入（setTextCell / setDateCell 都走這裡）
        setNumberFormat() { return this; },
        setValue(v) { rows[row - 2][col - 1] = v; return this; },

        // 用案件編號找列
        createTextFinder(text) {
          return {
            matchEntireCell() { return this; },
            matchCase() { return this; },
            findNext() {
              for (let i = 0; i < n; i++) {
                const value = rows[row - 2 + i][col - 1];
                if (String(value).toUpperCase() === String(text).toUpperCase()) {
                  const foundRow = row + i;
                  return { getRow: () => foundRow };
                }
              }
              return null;
            },
          };
        },
      };
    },
  };
}

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
   });
   __OPTIONS   = ${JSON.stringify(OPTIONS_SPEC)};
   __TEMPLATES = ${JSON.stringify(TEMPLATES_SPEC)};`, sandbox);

// 3) 載入要測的程式
['Config.js', 'Utils.js', 'Options.js', 'Query.js', 'Cases.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});

// parseCategoryCodes 住在 Feedback.js，只把那一支搬進來，
// 免得連帶拉進 LockService / DriveApp 等一大票服務
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', 'Feedback.js'), 'utf8')
  .match(/function parseCategoryCodes[\s\S]*?\n}/)[0], sandbox);

// hasOptionCode 同樣住在 Feedback.js（updateCase 用它驗證狀態代碼）
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', 'Feedback.js'), 'utf8')
  .match(/function hasOptionCode[\s\S]*?\n}/)[0], sandbox);

// setTextCell 住在 Auth.js，整個檔案載進來會連帶需要一堆服務，只取這一支
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', 'Auth.js'), 'utf8')
  .match(/function setTextCell[\s\S]*?\n}/)[0], sandbox);


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


// ===== updateCase =====

function update(params) {
  return vm.runInContext(
    `updateCase(${JSON.stringify(params)}, {name:'王小明', account:'admin@test'})`, sandbox);
}

/** 直接從假資料裡讀某一格，用來確認到底寫進去什麼 */
function cellOf(caseId, colName) {
  const rowIndex = ROWS_SPEC.findIndex((r) => r[0] === caseId);
  const colIndex = HEADERS.indexOf(colName);
  return vm.runInContext(`__ROWS[${rowIndex}][${colIndex}]`, sandbox);
}

/** 直接改寫假資料裡的某一格（用來埋哨兵值） */
function setCell(caseId, colName, value) {
  const rowIndex = ROWS_SPEC.findIndex((r) => r[0] === caseId);
  const colIndex = HEADERS.indexOf(colName);
  vm.runInContext(`__ROWS[${rowIndex}][${colIndex}] = ${JSON.stringify(value)}`, sandbox);
}

/**
 * 是不是日期物件。
 *
 * ⚠️ 不能用 `instanceof Date`：sandbox 裡建立的物件跨 realm 之後，
 *    在這邊比對的是不同的建構子，永遠會是 false。
 *    改成看它有沒有 getTime()，這個判斷不受 realm 影響。
 */
function isDateLike(value) {
  return !!value && typeof value.getTime === 'function';
}

console.log('\n【12】updateCase：必填檢查');
check('沒有案件編號', update({ status_code: 'ST_PROC', response: 'x' }).error, 'CASE_ID_REQUIRED');
check('沒有狀態', update({ case_id: 'PCI-202608-001' }).error, 'STATUS_REQUIRED');
check('狀態代碼不合法', update({ case_id: 'PCI-202608-001', status_code: 'ST_FAKE', response: 'x' }).error,
  'STATUS_INVALID');
check('查無案件', update({ case_id: 'PCI-999999-999', status_code: 'ST_NEW' }).error, 'CASE_NOT_FOUND');
check('已軟刪除的案件不可更新',
  update({ case_id: 'PCI-202608-005', status_code: 'ST_NEW' }).error, 'CASE_NOT_FOUND');

console.log('\n【13】updateCase：處理中 / 已結案必須有回覆');
check('處理中沒填回覆 → 擋下',
  update({ case_id: 'PCI-202608-001', status_code: 'ST_PROC', response: '' }).error, 'RESPONSE_REQUIRED');
check('已結案沒填回覆 → 擋下',
  update({ case_id: 'PCI-202608-001', status_code: 'ST_DONE', response: '   ' }).error, 'RESPONSE_REQUIRED');
check('改回未處理不強制填回覆',
  update({ case_id: 'PCI-202608-002', status_code: 'ST_NEW', response: '' }).ok, true);

console.log('\n【14】updateCase：正常儲存後寫進去的內容');
const saved = update({ case_id: 'PCI-202608-001', status_code: 'ST_PROC', response: '已請廚房調整鹹度。' });
check('回傳 ok', saved.ok, true);
check('回傳更新後的案件', saved.data.case.case_id, 'PCI-202608-001');
check('狀態已更新', cellOf('PCI-202608-001', '處理狀態'), 'ST_PROC');
check('回覆已寫入', cellOf('PCI-202608-001', '處理回覆'), '已請廚房調整鹹度。');
check('處理者記錄為登入者', cellOf('PCI-202608-001', '處理者'), '王小明');
check('最後更新者', cellOf('PCI-202608-001', '最後更新者'), '王小明');
check('處理時間已填入日期', isDateLike(cellOf('PCI-202608-001', '處理時間')), true);
check('回傳的案件不含內部欄位', 'sort_key' in saved.data.case, false);
check('更新後不再是逾期（已非未處理）', saved.data.case.is_overdue, false);

console.log('\n【15】updateCase：只改狀態時，處理時間不該跳動');
// 測試裡的時鐘是凍結的（逾期天數才有確定答案），兩次寫入的時間戳會一模一樣，
// 沒辦法用比較時間來判斷有沒有被覆寫。改成先埋一個哨兵值，再看它有沒有被蓋掉。
setCell('PCI-202608-001', '處理時間', 'SENTINEL');

const again = update({ case_id: 'PCI-202608-001', status_code: 'ST_DONE', response: '已請廚房調整鹹度。' });
check('儲存成功', again.ok, true);
check('狀態變成已結案', cellOf('PCI-202608-001', '處理狀態'), 'ST_DONE');
check('回覆沒變 → 處理時間沒被動到', cellOf('PCI-202608-001', '處理時間'), 'SENTINEL');

update({ case_id: 'PCI-202608-001', status_code: 'ST_DONE', response: '已改善，感謝回報。' });
check('回覆改了 → 處理時間被更新成日期',
  isDateLike(cellOf('PCI-202608-001', '處理時間')), true);
check('回覆內容也更新了', cellOf('PCI-202608-001', '處理回覆'), '已改善，感謝回報。');

console.log('\n【16】updateCase：大小寫與空白');
check('小寫案件編號也找得到',
  update({ case_id: 'pci-202608-003', status_code: 'ST_PROC', response: '維修中' }).ok, true);
check('狀態代碼小寫會轉成大寫', cellOf('PCI-202608-003', '處理狀態'), 'ST_PROC');

console.log('\n【17】更新後的統計會跟著變');
const after = run({});
check('未處理剩 1 筆（002）', after.data.stats.new, 1);
check('處理中 1 筆（003）', after.data.stats.processing, 1);
check('已結案 2 筆（001 + 004）', after.data.stats.done, 2);
check('逾期歸零', after.data.stats.overdue, 0);

console.log('\n【18】getTemplates');
const tpl = vm.runInContext(`getTemplates({}, {name:'王小明'})`, sandbox);
check('ok', tpl.ok, true);
check('空白列被略過', tpl.data.templates.length, 3);
check('代碼', tpl.data.templates[0].code, 'TPL_01');
check('分類', tpl.data.templates[2].category, 'CAT_FACILITY');
check('中文內容', tpl.data.templates[0].content_zh, '已轉知廚房調整口味。');
check('印尼文內容', tpl.data.templates[0].content_id, 'Sudah disampaikan ke dapur.');

console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount ? 1 : 0);
