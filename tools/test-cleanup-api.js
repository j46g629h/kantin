/**
 * 本機測試「上線前清除測試資料」（關卡 6-10）
 *
 * ⚠️ **這支功能會永久刪掉整列，測試的重點是「不該刪的有沒有被刪掉」。**
 *
 *    少刪了（漏掉一筆測試資料）——手動刪掉那一列就好。
 *    多刪了（刪到真實回報）——那是員工寫的東西，回不來。
 *
 *    所以「空白的提交識別碼不算測試資料」「長得像 seed 但不是的不算」
 *    「刪完之後剩下的列有沒有錯位」這幾項，比「有沒有清乾淨」重要得多。
 *
 * 執行：node tools/test-cleanup-api.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');

const HEADERS = ['案件編號','提交時間','工號','姓名','語言','餐廳地點','餐別','問題分類','問題描述',
  '滿意度評分','優先層級','圖片連結','處理狀態','處理者','處理回覆','處理時間',
  '最後更新時間','最後更新者','提交識別碼','已刪除'];

const COUNTER_HEADERS = ['年月', '流水號'];
const LOG_HEADERS = ['時間', '來源', '工號', '錯誤', '內容'];

const IMG = (id) => 'https://drive.google.com/file/d/' + id + '/view?usp=drivesdk';

/** 一列回報資料。只填測試會用到的欄位，其餘留空 */
function row(caseId, submitId, images) {
  const r = new Array(HEADERS.length).fill('');
  r[0]  = caseId;
  r[11] = images || '';
  r[18] = submitId;
  return r;
}

const ROWS_SPEC = [
  row('PCI-202608-001', 'seed-aaa',          IMG('F1') + '\n' + IMG('F2')),  // ① 測試資料，2 張照片
  row('PCI-202608-002', 'seed-overdue-bbb',  IMG('F3')),                     // ② 測試資料（逾期產生器）
  row('PCI-202608-003', '9f8e7d6c-1111',     IMG('F4')),                     // ③ **真實回報**，絕對不能碰
  row('PCI-202607-004', 'seed-hist-ccc',     ''),                            // ④ 測試資料（歷史產生器）
  row('PCI-202608-005', '',                  IMG('F5')),                     // ⑤ 提交識別碼是空的 → 不是測試資料
  row('PCI-202608-006', 'seeded-ddd',        ''),                            // ⑥ 長得像但不是（seeded-）
  row('PCI-202608-007', 'SEED-eee',          ''),                            // ⑦ 大寫，不算
  row('PCI-202608-008', ' seed-fff ',        ''),                            // ⑧ 前後有空白 → str() 會 trim，**算**
  row('PCI-202608-009', ' 9f8e7d6c-2222',    IMG('F6')),                     // ⑨ 真實 UUID 前面有空白 → 還是不算
];

// 系統計數：8 月已經發到 008、7 月發到 004
const COUNTERS_SPEC = [['202608', 8], ['202607', 4]];


// ===== 假的 Apps Script 環境 =====

const sandbox = {
  console,
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  Utilities: { formatDate: () => '2026-08-25 00:00:00' },

  DriveApp: {
    getFileById(id) {
      if (sandbox.__MISSING_FILES__.indexOf(id) >= 0) throw new Error('假裝檔案不存在: ' + id);
      return { setTrashed: (v) => { if (v) sandbox.__TRASHED__.push(id); } };
    },
  },

  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => {
        if (name === '回報資料') return makeSheet(sandbox.__ROWS, HEADERS);
        if (name === '系統計數') return makeSheet(sandbox.__COUNTERS, COUNTER_HEADERS);
        if (name === '錯誤日誌') return makeSheet(sandbox.__LOGS, LOG_HEADERS);
        return null;
      },
    }),
  },

  Logger: { log: () => {} },
  __ROWS: [], __COUNTERS: [], __LOGS: [], __TRASHED__: [], __MISSING_FILES__: [],
};

function makeSheet(rows, headers) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => headers.length,
    appendRow: (r) => { rows.push(r); },

    // ⚠️ 真實的 Apps Script 收到不合法的列號會丟例外。
    //    假的服務對錯誤輸入太寬容的話，測試就成了裝飾品（CLAUDE.md 設計約定第 12 條）
    deleteRow(r) {
      if (!r || r < 2 || r > rows.length + 1) throw new Error('deleteRow 收到不合法的列號: ' + r);
      rows.splice(r - 2, 1);
    },

    getRange(r, col, numRows) {
      const n = numRows || 1;
      if (!col || !r) throw new Error('getRange 收到不合法的位置: row=' + r + ', col=' + col);
      return {
        getValues() { return r === 1 ? [headers] : rows.slice(r - 2, r - 2 + n).map(x => x.slice(col - 1, col - 1 + (arguments.length, headers.length))); },
        setNumberFormat() { return this; },
        setValue(v) { rows[r - 2][col - 1] = v; return this; },
      };
    },
  };
}

vm.createContext(sandbox);

function reset() {
  sandbox.__ROWS     = ROWS_SPEC.map(r => r.slice());
  sandbox.__COUNTERS = COUNTERS_SPEC.map(r => r.slice());
  sandbox.__LOGS = [];
  sandbox.__TRASHED__ = [];
  sandbox.__MISSING_FILES__ = [];
}
reset();

['Config.js', 'Utils.js', 'Cleanup.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});
// 只搬用得到的兩支過來：整個檔案載入會需要一堆這裡沒有的服務
const RET = fs.readFileSync(path.join(ROOT, 'gas', 'Retention.js'), 'utf8');
const QRY = fs.readFileSync(path.join(ROOT, 'gas', 'Query.js'), 'utf8');

/** 從原始碼裡挖出一支函式（用字串找，不用正規表示式，省得跟跳脫字元纏鬥） */
function grabFunction(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('找不到函式：' + name);
  const end = src.indexOf('\n}', start);
  return src.slice(start, end + 2);
}

vm.runInContext(grabFunction(QRY, 'extractDriveFileId'), sandbox);
vm.runInContext(grabFunction(RET, 'imageFileIds'), sandbox);

const run = (code) => vm.runInContext(code, sandbox);

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n         預期 ' + e + '\n         實際 ' + a); }
};

const caseIds = () => sandbox.__ROWS.map(r => r[0]);
const submitIds = () => sandbox.__ROWS.map(r => r[18]);


console.log('\n【1】掃描：認得出哪些是測試資料');
reset();
let scan = run('scanTestFeedback()');
check('掃了 9 列',        scan.scanned, 9);
check('要刪 4 列',        scan.targets.length, 4);
check('要留 5 列',        scan.keep, 5);
check('要刪的是哪幾筆',   scan.targets.map(t => t.case_id),
  ['PCI-202608-001', 'PCI-202608-002', 'PCI-202607-004', 'PCI-202608-008']);
check('列號正確（從第 2 列算起）', scan.targets.map(t => t.row), [2, 3, 5, 9]);

console.log('\n【2】⚠️ 這幾種「長得像測試資料」的一律不可以碰');
const kept = scan.targets.map(t => t.submit_id);
check('真實 UUID 不在名單裡',        kept.indexOf('9f8e7d6c-1111') < 0, true);
check('空白的提交識別碼不在名單裡',  kept.indexOf('') < 0, true);
check('seeded- 不算（多了字母）',    kept.indexOf('seeded-ddd') < 0, true);
check('SEED- 不算（大寫）',          kept.indexOf('SEED-eee') < 0, true);
check('⚠️ 真實 UUID 前面有空白，還是不算', kept.indexOf('9f8e7d6c-2222') < 0, true);

// 📌 前後有空白的 'seed-' **會**被當成測試資料，因為 str() 會 trim
//    （gas/Utils.js，整個專案都是這樣讀 Sheet 的值）。
//    這不會誤刪真實資料：真實提交用的是瀏覽器的 crypto.randomUUID()，
//    前面就算被手動加了空白，trim 完也不會以 seed- 開頭（上面那一項就是在測這個）。
check('前後有空白的 seed- 會被算進去（str 會 trim）', kept.indexOf('seed-fff') >= 0, true);

console.log('\n【3】試跑：一個字都不可以改');
reset();
const before = JSON.stringify(sandbox.__ROWS) + JSON.stringify(sandbox.__COUNTERS);
const preview = run('previewTestDataCleanup()');
check('資料完全沒動',       JSON.stringify(sandbox.__ROWS) + JSON.stringify(sandbox.__COUNTERS), before);
check('沒有丟任何照片',     sandbox.__TRASHED__.length, 0);
check('報告說明是試跑',     preview.indexOf('不會刪除任何東西') >= 0, true);
check('報告有列出要刪的編號', preview.indexOf('PCI-202608-001') >= 0, true);
check('報告有提醒「有幾列不是測試資料」', preview.indexOf('5 列不是測試資料') >= 0, true);

console.log('\n【4】真的刪：刪對列，而且剩下的沒有錯位');
reset();
run('removeTestFeedbackConfirmed()');
check('剩下 5 列', sandbox.__ROWS.length, 5);
check('⚠️ 剩下的正是那 5 筆非測試資料', caseIds(),
  ['PCI-202608-003', 'PCI-202608-005', 'PCI-202608-006', 'PCI-202608-007', 'PCI-202608-009']);
check('⚠️ 提交識別碼也對得上（沒有整列錯位）', submitIds(),
  ['9f8e7d6c-1111', '', 'seeded-ddd', 'SEED-eee', ' 9f8e7d6c-2222']);

console.log('\n【5】照片：先丟垃圾桶，而且只丟測試資料的');
check('丟了 3 張', sandbox.__TRASHED__.length, 3);
check('丟的是測試資料的照片', sandbox.__TRASHED__.sort(), ['F1', 'F2', 'F3']);
check('⚠️ 真實回報的照片沒被丟', sandbox.__TRASHED__.indexOf('F4') < 0, true);
check('⚠️ 沒有提交識別碼那列的照片也沒被丟', sandbox.__TRASHED__.indexOf('F5') < 0, true);

console.log('\n【6】案件編號的計數器：照剩下的資料重算，不是歸零');
check('202608 還有真實案件 → 更新成真實最大值 009',
  sandbox.__COUNTERS.find(c => c[0] === '202608'), ['202608', 9]);
check('⚠️ 202607 一筆都不剩 → 整列移除（下一筆重新從 001 開始）',
  sandbox.__COUNTERS.find(c => c[0] === '202607'), undefined);
check('計數表只剩 1 列', sandbox.__COUNTERS.length, 1);

console.log('\n【7】計數器不可以歸零——那會讓案件編號重複');
reset();
// 讓 202608 只剩 PCI-202608-003（真實），其餘全是測試資料
sandbox.__ROWS = [
  row('PCI-202608-001', 'seed-a', ''),
  row('PCI-202608-002', 'seed-b', ''),
  row('PCI-202608-003', 'real-c', ''),
];
sandbox.__COUNTERS = [['202608', 3]];
run('removeTestFeedbackConfirmed()');
check('剩下真實那一筆', caseIds(), ['PCI-202608-003']);
check('⚠️ 計數器是 3 不是 0（下一筆才會是 004，不會撞號）',
  sandbox.__COUNTERS[0], ['202608', 3]);

console.log('\n【8】照片檔案早就不見了，不可以讓整支掛掉');
reset();
sandbox.__MISSING_FILES__ = ['F1'];
let err = '';
try { run('removeTestFeedbackConfirmed()'); } catch (e) { err = e.message; }
check('沒有丟例外',        err, '');
check('其他照片照樣丟掉',  sandbox.__TRASHED__.sort(), ['F2', 'F3']);
check('列還是刪掉了',      sandbox.__ROWS.length, 5);
check('有寫進錯誤日誌',    sandbox.__LOGS.length >= 1, true);

console.log('\n【9】沒有測試資料時：什麼都不做，也不報錯');
reset();
sandbox.__ROWS = [row('PCI-202608-003', '9f8e7d6c-1111', IMG('F4'))];
sandbox.__COUNTERS = [['202608', 3]];
const msg = run('removeTestFeedbackConfirmed()');
check('訊息說沒有找到',   msg.indexOf('沒有找到任何測試資料') >= 0, true);
check('資料沒動',         caseIds(), ['PCI-202608-003']);
check('計數器沒動',       sandbox.__COUNTERS[0], ['202608', 3]);
check('沒有丟照片',       sandbox.__TRASHED__.length, 0);

console.log('\n【10】完全空的分頁不會出錯');
reset();
sandbox.__ROWS = [];
sandbox.__COUNTERS = [];
err = '';
try { run('previewTestDataCleanup()'); run('removeTestFeedbackConfirmed()'); }
catch (e) { err = e.message; }
check('兩支都不會丟例外', err, '');

console.log('\n【11】案件編號格式不對時不要亂猜月份');
check("'PCI-202608-001' → 202608", run("caseIdYearMonth('PCI-202608-001')"), '202608');
check("'PCI-20268-1' 位數不對 → 空字串", run("caseIdYearMonth('PCI-20268-1')"), '');
check("'' → 空字串",                     run("caseIdYearMonth('')"), '');
check("'亂寫的' → 空字串",               run("caseIdYearMonth('亂寫的')"), '');

console.log('\n===== 通過 ' + pass + ' 項，失敗 ' + fail + ' 項 =====\n');
process.exit(fail ? 1 : 0);
