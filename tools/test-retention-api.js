/**
 * 本機測試結案滿 13 個月去識別化（關卡 4-5）
 *
 *   retentionCutoffKey  13 個月前是哪一天（含月底、閏年、跨年）
 *   scanForDeidentify   誰該被清、誰絕對不能碰
 *   previewDeidentify   試跑真的一個字都不改
 *   deidentifyMonthly   清欄位、丟照片、稽核紀錄
 *   requireRecentBackup 沒有近期備份就拒絕執行
 *
 *
 * ⚠️ **這是整個專案唯一會永久破壞資料的功能，測試的重點在「不該動的有沒有被動到」。**
 *
 *    功能沒做到（該清的沒清）下個月就補上了；
 *    但清錯了（不該清的被清掉）是回不來的。
 *    所以「未結案的不可以碰」「處理中的不可以碰」「還沒滿 13 個月的不可以碰」
 *    這幾項比「有沒有清乾淨」重要得多。
 *
 * 執行：node tools/test-retention-api.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
const TZ = 'Asia/Jakarta';

// 現在是 2027-09-01，分界日 = 13 個月前 = 2026-08-01
const NOW_ISO = '2027-09-01T05:30:00+07:00';

const HEADERS = ['案件編號','提交時間','工號','姓名','語言','餐廳地點','餐別','問題分類','問題描述',
  '滿意度評分','優先層級','圖片連結','處理狀態','處理者','處理回覆','處理時間',
  '最後更新時間','最後更新者','提交識別碼','已刪除'];

const IMG = (id) => 'https://drive.google.com/file/d/' + id + '/view?usp=drivesdk';

const ROWS_SPEC = [
  // ① 2026-07-10 結案 → 早於分界日 → 該清（有工號、姓名、2 張照片）
  ['PCI-202606-001', '@ISO:2026-06-20T08:00:00+07:00', '0012345', 'Budi', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_TASTE', '太鹹了', 2, '', IMG('FILE_A') + '\n' + IMG('FILE_B'), 'ST_DONE', 'HDL_01', '已改善',
   '@ISO:2026-07-10T09:00:00+07:00', '', '', 's1', ''],

  // ② 2026-08-01 結案 → 剛好是分界日 → 「滿 13 個月」，該清
  ['PCI-202607-002', '@ISO:2026-07-15T08:00:00+07:00', '0012346', 'Siti', 'ID', 'LOC_04', 'MEAL_DINNER',
   'CAT_HYGIENE', '', 4, '', IMG('FILE_C'), 'ST_DONE', 'HDL_01', '已清潔',
   '@ISO:2026-08-01T09:00:00+07:00', '', '', 's2', ''],

  // ③ 2026-08-02 結案 → 晚分界日一天 → 還沒滿 13 個月，不可以碰
  ['PCI-202607-003', '@ISO:2026-07-20T08:00:00+07:00', '0012347', 'Andi', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_SERVICE', '', 3, '', IMG('FILE_D'), 'ST_DONE', 'HDL_01', '已處理',
   '@ISO:2026-08-02T09:00:00+07:00', '', '', 's3', ''],

  // ④ 兩年前提交，但一直「未處理」→ 問題還沒解決，永遠不碰
  ['PCI-202505-004', '@ISO:2025-05-01T08:00:00+07:00', '0012348', 'Dewi', 'ID', 'LOC_R3', 'MEAL_BREAKFAST',
   'CAT_FACILITY', '燈壞了', 1, '', IMG('FILE_E'), 'ST_NEW', '', '', '', '', '', 's4', ''],

  // ⑤ 兩年前提交，「處理中」→ 還在跑，也不碰
  ['PCI-202505-005', '@ISO:2025-05-02T08:00:00+07:00', '0012349', 'Eko', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_TASTE', '', 2, '', '', 'ST_PROC', 'HDL_01', '維修中',
   '@ISO:2025-06-01T09:00:00+07:00', '', '', 's5', ''],

  // ⑥ 軟刪除、從沒結案、2026-01 提交 → 規格外自己加的規則：用提交時間算，該清
  ['PCI-202601-006', '@ISO:2026-01-10T08:00:00+07:00', '0012350', 'Fajar', 'ID', 'LOC_04', 'MEAL_DINNER',
   'CAT_OTHER', '重複回報', 3, '', IMG('FILE_F'), 'ST_NEW', '', '', '', '', '', 's6', 'TRUE'],

  // ⑦ 已結案但「處理時間」是空的 → 判斷不了，要報出來，但不可以碰
  ['PCI-202602-007', '@ISO:2026-02-10T08:00:00+07:00', '0012351', 'Gita', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_HYGIENE', '', 4, '', IMG('FILE_G'), 'ST_DONE', 'HDL_01', '已處理',
   '', '', '', 's7', ''],

  // ⑧ 已到期，但先前就清乾淨了 → 不要再寫一次
  ['PCI-202603-008', '@ISO:2026-03-10T08:00:00+07:00', '', '', 'ID', 'LOC_04', 'MEAL_LUNCH',
   'CAT_TASTE', '', 5, '', '', 'ST_DONE', 'HDL_01', '已處理',
   '@ISO:2026-04-01T09:00:00+07:00', '@ISO:2027-08-01T05:00:00+07:00', '系統去識別化', 's8', ''],

  // ⑨ 空白列
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];

const LOG_HEADERS = ['時間', '來源', '工號', '錯誤', '內容'];


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
      if (fmt === 'yyyyMMdd')   return `${y}${m}${day}`;
      if (fmt === 'yyyy-MM-dd') return `${y}-${m}-${day}`;
      if (fmt === 'yyyy')       return `${y}`;
      if (fmt === 'MM')         return `${m}`;
      if (fmt === 'dd')         return `${day}`;
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    },
  },

  /**
   * 假的 Drive：只記錄哪些檔案被丟進垃圾桶。
   * __MISSING_FILES__ 裡的會丟例外，用來驗證「檔案早就被手動刪掉」不會讓排程掛掉。
   */
  DriveApp: {
    getFileById(id) {
      if (sandbox.__MISSING_FILES__.indexOf(id) >= 0) {
        throw new Error('假裝檔案不存在: ' + id);
      }
      return { setTrashed: (v) => { if (v) sandbox.__TRASHED__.push(id); } };
    },
  },

  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => {
        if (name === '回報資料') return makeSheet(sandbox.__ROWS, HEADERS);
        if (name === '錯誤日誌') return makeSheet(sandbox.__LOGS, LOG_HEADERS);
        return null;
      },
    }),
  },

  Logger: { log: () => {} },

  /** 由測試自己決定 latestBackupInfo 回什麼，才能單獨驗證安全煞車 */
  latestBackupInfo: () => sandbox.__BACKUP__,

  __ROWS: [], __LOGS: [], __TRASHED__: [], __MISSING_FILES__: [],
  __BACKUP__: { name: '備份_2027-09-01_0200', age_days: 0 },
};


function makeSheet(rows, headers) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => headers.length,
    appendRow: (row) => { rows.push(row); },

    getRange(row, col, numRows) {
      const n = numRows || 1;
      // 真實的 Apps Script 收到 undefined 欄號會丟例外
      if (!col || !row) throw new Error('getRange 收到不合法的位置: row=' + row + ', col=' + col);
      return {
        getValues() { return row === 1 ? [headers] : rows.slice(row - 2, row - 2 + n); },
        setNumberFormat() { return this; },
        setValue(v) { rows[row - 2][col - 1] = v; return this; },
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

/** 假資料裡的 Date 一定要在 sandbox 裡面建立，否則 instanceof / getTime 判斷會失準 */
function resetRows() {
  vm.runInContext(
    `__ROWS = ${JSON.stringify(ROWS_SPEC)}.map(function (row) {
       return row.map(function (v) {
         return (typeof v === 'string' && v.indexOf('@ISO:') === 0) ? new Date(v.slice(5)) : v;
       });
     });`, sandbox);
  sandbox.__LOGS = [];
  sandbox.__TRASHED__ = [];
  sandbox.__MISSING_FILES__ = [];
  sandbox.__BACKUP__ = { name: '備份_2027-09-01_0200', age_days: 0 };
}

resetRows();

['Config.js', 'Utils.js', 'Retention.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});

// 只搬用得到的幾支過來，整個檔案載入會需要一堆服務
const AUTH_SRC  = fs.readFileSync(path.join(ROOT, 'gas', 'Auth.js'), 'utf8');
const QUERY_SRC = fs.readFileSync(path.join(ROOT, 'gas', 'Query.js'), 'utf8');
vm.runInContext(AUTH_SRC.match(/function isTrue[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(AUTH_SRC.match(/function setTextCell[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(QUERY_SRC.match(/function extractDriveFileId[\s\S]*?\n}/)[0], sandbox);


// ---- 測試工具 ----
let pass = 0, failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}

const evalIn = (code) => vm.runInContext(code, sandbox);

/** 依案件編號取回那一列目前的內容 */
function rowOf(caseId) {
  const r = sandbox.__ROWS.find((row) => row[0] === caseId);
  return { emp_id: r[2], emp_name: r[3], images: r[11], updated_by: r[17] };
}


console.log('\n===== 分界日：13 個月前是哪一天 =====\n');

const cutoffOf = (iso) => evalIn(`retentionCutoffKey(new Date('${iso}'))`);

check('2027-09-01 → 2026-08-01', cutoffOf('2027-09-01T05:00:00+07:00'), '20260801');
check('跨年：2027-01-15 → 2025-12-15', cutoffOf('2027-01-15T05:00:00+07:00'), '20251215');
check('跨年：2027-02-01 → 2026-01-01', cutoffOf('2027-02-01T05:00:00+07:00'), '20260101');

// 3/31 往前推 13 個月 = 2 月 31 日，那一天不存在，往回夾到月底
check('月底夾齊：2027-03-31 → 2026-02-28', cutoffOf('2027-03-31T05:00:00+07:00'), '20260228');
check('閏年月底夾齊：2029-03-31 → 2028-02-29', cutoffOf('2029-03-31T05:00:00+07:00'), '20280229');
check('31 日 → 30 日的月份也夾齊：2027-05-31 → 2026-04-30',
  cutoffOf('2027-05-31T05:00:00+07:00'), '20260430');

// 夾齊的方向是刻意的：寧可晚一個月刪，也不要早一天刪
check('夾齊會偏保守（不會把分界日往後推）',
  cutoffOf('2027-03-31T05:00:00+07:00') < '20260301', true);


console.log('\n===== 掃描：誰該清 =====\n');

resetRows();
const scan = evalIn('scanForDeidentify(new Date())');

check('分界日',       scan.cutoff_date, '2026-08-01');
check('掃過的筆數（空白列不算）', scan.scanned, 8);
check('該清的案件（最舊的排前面）',
  scan.targets.map((t) => t.case_id),
  ['PCI-202601-006', 'PCI-202606-001', 'PCI-202607-002']);
check('剛好滿 13 個月的那件也算',
  scan.targets.some((t) => t.case_id === 'PCI-202607-002'), true);
check('軟刪除的用提交時間算（規格外自己加的規則）',
  scan.targets.find((t) => t.case_id === 'PCI-202601-006').reason, '軟刪除');
check('已結案的用結案時間算',
  scan.targets.find((t) => t.case_id === 'PCI-202606-001').reason, '已結案');
check('照片張數有算出來',
  scan.targets.find((t) => t.case_id === 'PCI-202606-001').image_ids, ['FILE_A', 'FILE_B']);


console.log('\n===== 掃描：誰絕對不能碰（這一段比上面重要）=====\n');

/**
 * 該清的沒清，下個月就補上了；清錯了是回不來的。
 * 所以這幾項才是這支測試真正的重點。
 */
const targeted = (id) => scan.targets.some((t) => t.case_id === id);

check('晚分界日一天 → 不碰',        targeted('PCI-202607-003'), false);
check('兩年前提交但「未處理」→ 不碰', targeted('PCI-202505-004'), false);
check('兩年前提交但「處理中」→ 不碰', targeted('PCI-202505-005'), false);
check('已結案但沒有結案時間 → 不碰', targeted('PCI-202602-007'), false);
check('先前已清乾淨的 → 不重複寫',   targeted('PCI-202603-008'), false);
check('已清乾淨的有另外計數',        scan.already_clean, 1);

// 已結案卻沒有結案時間 = 資料有問題，不講出來的話這些案件永遠不會被清，而且沒人知道
check('沒有結案時間的要報出來',      scan.no_date, ['PCI-202602-007']);


console.log('\n===== 試跑：一個字都不可以改 =====\n');

resetRows();
const before = JSON.stringify(sandbox.__ROWS);
const preview = evalIn('previewDeidentify()');

check('資料完全沒變',       JSON.stringify(sandbox.__ROWS), before);
check('一張照片都沒丟',     sandbox.__TRASHED__, []);
check('報告標明是試跑',     preview.indexOf('【試跑】') >= 0, true);
check('報告列出該清的件數', preview.indexOf('以下 3 件到期') >= 0, true);
check('報告列出案件編號',   preview.indexOf('PCI-202606-001') >= 0, true);
check('報告寫出分界日',     preview.indexOf('2026-08-01') >= 0, true);
check('報告告訴你下一步',   preview.indexOf('deidentifyNow()') >= 0, true);
check('報告點出沒有結案時間的那件',
  preview.indexOf('PCI-202602-007') >= 0, true);


console.log('\n===== 實際執行 =====\n');

resetRows();
const done = evalIn('deidentifyMonthly()');

check('工號清空了',   rowOf('PCI-202606-001').emp_id,   '');
check('姓名清空了',   rowOf('PCI-202606-001').emp_name, '');
check('圖片連結清空了', rowOf('PCI-202606-001').images,  '');
check('照片丟進垃圾桶',
  sandbox.__TRASHED__.slice().sort(), ['FILE_A', 'FILE_B', 'FILE_C', 'FILE_F']);

// 稽核紀錄借用既有欄位，不新增欄位（設計約定第 12 條：改欄位定義是最痛的坑）
check('留下稽核紀錄', rowOf('PCI-202606-001').updated_by, '系統去識別化');

check('回報處理件數',   done.indexOf('已處理 3 件') >= 0, true);
check('回報照片張數',   done.indexOf('照片丟進垃圾桶 4 張') >= 0, true);
check('說明照片還救得回來', done.indexOf('30 天') >= 0, true);
check('沒有寫錯誤日誌', sandbox.__LOGS.length, 0);


console.log('\n===== 實際執行：不該動的還是不能動 =====\n');

check('晚一天結案的：工號還在',   rowOf('PCI-202607-003').emp_id, '0012347');
check('晚一天結案的：照片還在',
  sandbox.__TRASHED__.indexOf('FILE_D') >= 0, false);
check('未處理的：工號還在',       rowOf('PCI-202505-004').emp_id, '0012348');
check('未處理的：照片還在',
  sandbox.__TRASHED__.indexOf('FILE_E') >= 0, false);
check('處理中的：工號還在',       rowOf('PCI-202505-005').emp_id, '0012349');
check('沒有結案時間的：工號還在', rowOf('PCI-202602-007').emp_id, '0012351');
check('沒有結案時間的：照片還在',
  sandbox.__TRASHED__.indexOf('FILE_G') >= 0, false);

// 描述、評分、狀態、回覆都要留著——整筆刪掉的話隔年就沒有同期比較的資料
const kept = sandbox.__ROWS.find((r) => r[0] === 'PCI-202606-001');
check('問題描述留著', kept[8],  '太鹹了');
check('評分留著',     kept[9],  2);
check('地點留著',     kept[5],  'LOC_02');
check('分類留著',     kept[7],  'CAT_TASTE');
check('狀態留著',     kept[12], 'ST_DONE');
check('回覆留著',     kept[14], '已改善');


console.log('\n===== 重複執行是安全的 =====\n');

sandbox.__TRASHED__ = [];
const again = evalIn('deidentifyMonthly()');
check('第二次沒有東西可以處理', again.indexOf('沒有任何案件到期') >= 0, true);
check('第二次不會再丟照片',     sandbox.__TRASHED__, []);
check('已清過的有另外計數',     again.indexOf('先前就清過了') >= 0, true);


console.log('\n===== 照片檔案早就不在了 =====\n');

// 有人手動去 Drive 刪過照片是很正常的，不該讓整支排程掛掉
resetRows();
sandbox.__MISSING_FILES__ = ['FILE_A'];
const missing = evalIn('deidentifyMonthly()');

check('其他照片照樣丟得掉',
  sandbox.__TRASHED__.slice().sort(), ['FILE_B', 'FILE_C', 'FILE_F']);
check('欄位照樣清乾淨',   rowOf('PCI-202606-001').emp_id, '');
check('照片張數只算真的丟掉的', missing.indexOf('照片丟進垃圾桶 3 張') >= 0, true);
check('丟不掉的有寫錯誤日誌', sandbox.__LOGS.length, 1);


console.log('\n===== 安全煞車：沒有近期備份就不准動手 =====\n');

/**
 * 光靠「備份排 02:00、這支排 05:00」是不夠的——
 * 萬一那天的備份剛好失敗，時間再怎麼排也沒用。
 */
resetRows();
sandbox.__BACKUP__ = null;
let threw = '';
try { evalIn('deidentifyMonthly()'); } catch (e) { threw = String(e.message || e); }

check('查不到備份 → 丟例外',   threw.indexOf('找不到任何備份') >= 0, true);
check('而且一個字都沒改',       rowOf('PCI-202606-001').emp_id, '0012345');
check('一張照片都沒丟',         sandbox.__TRASHED__, []);
check('有寫錯誤日誌',           sandbox.__LOGS.length, 1);
check('錯誤訊息告訴你怎麼辦',   threw.indexOf('backupNow()') >= 0, true);

resetRows();
sandbox.__BACKUP__ = { name: '備份_2027-06-01_0200', age_days: 92 };
threw = '';
try { evalIn('deidentifyMonthly()'); } catch (e) { threw = String(e.message || e); }

check('備份太舊 → 丟例外',     threw.indexOf('92 天前') >= 0, true);
check('而且一個字都沒改',       rowOf('PCI-202606-001').emp_id, '0012345');

// 45 天是「漏掉一次備份就不准再刪」的意思
resetRows();
sandbox.__BACKUP__ = { name: '備份_2027-08-01_0200', age_days: 31 };
evalIn('deidentifyMonthly()');
check('31 天前的備份仍在容許範圍（每月一次的正常間隔）',
  rowOf('PCI-202606-001').emp_id, '');

resetRows();
sandbox.__BACKUP__ = { name: '備份_2027-07-18_0200', age_days: 46 };
threw = '';
try { evalIn('deidentifyMonthly()'); } catch (e) { threw = String(e.message || e); }
check('46 天前就擋下來',       threw.indexOf('超過 45 天') >= 0, true);


console.log('\n===== 沒有任何資料時 =====\n');

sandbox.__ROWS = [];
sandbox.__LOGS = [];
sandbox.__BACKUP__ = { name: '備份_2027-09-01_0200', age_days: 0 };
check('空表不會出錯',
  evalIn('previewDeidentify()').indexOf('沒有任何案件到期') >= 0, true);


console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount > 0 ? 1 : 0);
