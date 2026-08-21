/**
 * 本機測試排程報表（規格 §10.1）
 *
 *   getReportRecipients  收件人怎麼挑
 *   buildDailyReport     哪些案件該進日報、排序、逾期計數
 *   sendDailyReport      空信規則、主旨、寄幾封、失敗處理
 *   HTML                 跳脫、逾期標紅、筆數上限
 *
 * 作法與其他兩支測試相同：把 Apps Script 的全域服務用假的頂上。
 * 這一支多一個假的 `MailApp`，會把「寄出去的信」攔下來存進陣列，
 * 這樣才能真的檢查信裡寫了什麼——而不是只確認「有呼叫寄信」。
 *
 * 執行：node tools/test-report-api.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
const TZ = 'Asia/Jakarta';
const NOW_ISO = '2026-08-20T12:00:00+07:00';

const FEEDBACK_HEADERS = ['案件編號','提交時間','工號','姓名','語言','餐廳地點','餐別','問題分類','問題描述',
  '滿意度評分','優先層級','圖片連結','處理狀態','處理者','處理回覆','處理時間',
  '最後更新時間','最後更新者','提交識別碼','已刪除'];

// 日期先寫成 @ISO: 字串，稍後在 sandbox 裡才轉成 Date（跨 realm 的 Date 會被誤判）
const ROWS_SPEC = [
  // 放了 19 天，未處理 → 逾期，而且應該排在最前面
  ['PCI-202608-001', '@ISO:2026-08-01T08:00:00+07:00', '0012345', 'Budi', 'ID', 'LOC_02', 'MEAL_BREAKFAST',
   'CAT_TASTE,CAT_HYGIENE', '太鹹了', 2, '', '', 'ST_NEW', '', '', '', '', '', 's1', ''],

  // 昨天才來的，未處理但還沒逾期
  ['PCI-202608-002', '@ISO:2026-08-19T12:00:00+07:00', '0012346', 'Siti', 'ID', 'LOC_04', 'MEAL_LUNCH',
   'CAT_SERVICE', '', 4, '', '', 'ST_NEW', '', '', '', '', '', 's2', ''],

  // 處理中 → 不該出現在日報裡
  ['PCI-202608-003', '@ISO:2026-08-10T18:00:00+07:00', 'A1234', '測試員工', 'ZH', 'LOC_02', 'MEAL_DINNER',
   'CAT_FACILITY', '燈壞了', 3, '', '', 'ST_PROC', 'HDL_01', '已安排維修',
   '@ISO:2026-08-11T09:00:00+07:00', '', '', 's3', ''],

  // 已結案 → 不該出現
  ['PCI-202607-004', '@ISO:2026-07-15T12:00:00+07:00', '0023456', 'Dewi', 'ID', 'LOC_R3', 'MEAL_LUNCH',
   'CAT_OTHER', '希望多一點水果', 5, '', '', 'ST_DONE', 'HDL_01', '已轉知廚房',
   '@ISO:2026-07-16T09:00:00+07:00', '', '', 's4', ''],

  // 軟刪除 → 不該出現，即使狀態是未處理
  ['PCI-202608-005', '@ISO:2026-08-05T12:00:00+07:00', '0012345', 'Budi', 'ID', 'LOC_02', 'MEAL_LUNCH',
   'CAT_TASTE', '重複回報', 1, '', '', 'ST_NEW', '', '', '', '', '', 's5', 'TRUE'],

  // 狀態欄空白 → 應該當成未處理（寧可多提醒一件）
  ['PCI-202608-006', '@ISO:2026-08-15T12:00:00+07:00', '0012347', 'Andi', 'ID', 'LOC_04', 'MEAL_DINNER',
   'CAT_HYGIENE', '<script>alert(1)</script>', 3, '', '', '', '', '', '', '', '', 's6', ''],
];

const ADMIN_HEADERS = ['姓名','帳號','Email','密碼雜湊','密碼鹽值','角色','狀態','需重設密碼',
  '建立時間','最後登入時間','密碼最後變更時間'];

const ADMINS_SPEC = [
  ['系統管理者', 'super@pci', 'super@pci.com', 'h', 's', 'SUPER', 'ACTIVE',   'FALSE', '', '', ''],
  ['王小明',     'ming@pci',  'ming@pci.com',  'h', 's', 'ADMIN', 'ACTIVE',   'FALSE', '', '', ''],
  // 停用中 → 不該收到信
  ['李美華',     'hua@pci',   'hua@pci.com',   'h', 's', 'ADMIN', 'DISABLED', 'FALSE', '', '', ''],
  // Email 空白（測試帳號就是這樣）→ 不該收到信
  ['測試管理者一','test01@kantin.local', '',   'h', 's', 'ADMIN', 'ACTIVE',   'TRUE',  '', '', ''],
  // Email 打錯字 → 不該寄出去
  ['打錯字的',   'typo@pci',  'not-an-email',  'h', 's', 'ADMIN', 'ACTIVE',   'FALSE', '', '', ''],
  ['',           '',          '',              '',  '',  '',      '',         '',      '', '', ''],   // 空白列
];

const OPTION_HEADERS = ['類型', '代碼', '中文顯示', '印尼文顯示', '排序', '啟用'];
const OPTIONS_SPEC = [
  ['LOCATION', 'LOC_02', '第二餐廳', 'Kantin 2',  1, true],
  ['LOCATION', 'LOC_04', '第四餐廳', 'Kantin 4',  2, true],
  ['CATEGORY', 'CAT_TASTE',   '菜單口味', 'Rasa Makanan',   1, true],
  ['CATEGORY', 'CAT_HYGIENE', '環境衛生', 'Kebersihan',     2, true],
  ['CATEGORY', 'CAT_SERVICE', '服務態度', 'Pelayanan',      3, true],
  ['STATUS',   'ST_NEW',  '未處理', 'Belum Diproses',  1, true],
  ['HANDLER',  'HDL_01', '王小明', '王小明', 1, true],
];

const LOG_HEADERS = ['時間', '來源', '工號', '錯誤', '內容'];


const sandbox = {
  console,
  Session: { getScriptTimeZone: () => TZ },

  Utilities: {
    formatDate(date, tz, fmt) {
      const shifted = new Date(date.getTime() + 7 * 3600 * 1000);   // 固定 Jakarta（UTC+7）
      const y   = shifted.getUTCFullYear();
      const m   = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const day = String(shifted.getUTCDate()).padStart(2, '0');
      const hh  = String(shifted.getUTCHours()).padStart(2, '0');
      const mm  = String(shifted.getUTCMinutes()).padStart(2, '0');
      const ss  = String(shifted.getUTCSeconds()).padStart(2, '0');
      if (fmt === 'yyyyMM')     return `${y}${m}`;
      if (fmt === 'yyyy-MM-dd') return `${y}-${m}-${day}`;
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    },
  },

  /**
   * 假的寄信服務：把信攔下來存進 __SENT__，不真的寄出去。
   *
   * 收件人在 __FAIL_FOR__ 裡的話就丟例外，
   * 用來驗證「一個人寄失敗，其他人照樣收得到」。
   */
  MailApp: {
    sendEmail(opts) {
      if (sandbox.__FAIL_FOR__.indexOf(opts.to) >= 0) {
        throw new Error('假裝寄信失敗: ' + opts.to);
      }
      sandbox.__SENT__.push(opts);
    },
  },

  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => {
        if (name === '回報資料')   return makeSheet(sandbox.__ROWS,    FEEDBACK_HEADERS);
        if (name === '管理者名單') return makeSheet(sandbox.__ADMINS,  ADMIN_HEADERS);
        if (name === '選項設定')   return makeSheet(sandbox.__OPTIONS, OPTION_HEADERS);
        if (name === '錯誤日誌')   return makeSheet(sandbox.__LOGS,    LOG_HEADERS);
        return null;
      },
    }),
  },

  Logger: { log: () => {} },

  __SENT__: [],
  __FAIL_FOR__: [],
  __ROWS: [], __ADMINS: [], __OPTIONS: [], __LOGS: [],
};


function makeSheet(rows, headers) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => headers.length,
    appendRow: (row) => { rows.push(row); },

    getRange(row, col, numRows) {
      const n = numRows || 1;

      // 真實的 Apps Script 收到 undefined 欄號會丟例外。
      // 假 Sheet 若默默接受，「欄位沒檢查就拿去 getRange」的洞就永遠測不出來
      if (!col || !row) {
        throw new Error('getRange 收到不合法的位置: row=' + row + ', col=' + col);
      }

      return {
        getValues() {
          if (row === 1) return [headers];
          return rows.slice(row - 2, row - 2 + n);
        },
        setNumberFormat() { return this; },
        setValue(v) { rows[row - 2][col - 1] = v; return this; },
      };
    },
  };
}

vm.createContext(sandbox);

// 1) 固定 new Date()，逾期天數才有確定答案
vm.runInContext(`
  const _RealDate = Date;
  Date = class extends _RealDate {
    constructor(...args) { if (args.length === 0) super(_FIXED_NOW); else super(...args); }
    static now() { return _FIXED_NOW; }
  };
`.replace(/_FIXED_NOW/g, String(new Date(NOW_ISO).getTime())), sandbox);

// 2) 在 sandbox 裡把 @ISO: 轉成 Date（同一個 realm 才 instanceof Date）
vm.runInContext(
  `__ROWS = ${JSON.stringify(ROWS_SPEC)}.map(function (row) {
     return row.map(function (v) {
       return (typeof v === 'string' && v.indexOf('@ISO:') === 0) ? new Date(v.slice(5)) : v;
     });
   });
   __ADMINS  = ${JSON.stringify(ADMINS_SPEC)};
   __OPTIONS = ${JSON.stringify(OPTIONS_SPEC)};`, sandbox);

// 3) 載入要測的程式
['Config.js', 'Utils.js', 'Options.js', 'Query.js', 'Cases.js', 'Notify.js', 'Reports.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});

// parseCategoryCodes 住在 Feedback.js，只搬那一支過來
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', 'Feedback.js'), 'utf8')
  .match(/function parseCategoryCodes[\s\S]*?\n}/)[0], sandbox);

// Auth.js / Admins.js 整個載入會需要一堆服務，只取用得到的那幾支
const AUTH_SRC   = fs.readFileSync(path.join(ROOT, 'gas', 'Auth.js'), 'utf8');
const ADMINS_SRC = fs.readFileSync(path.join(ROOT, 'gas', 'Admins.js'), 'utf8');
vm.runInContext(AUTH_SRC.match(/function readAllAdmins[\s\S]*?\n}\n/)[0], sandbox);
vm.runInContext(AUTH_SRC.match(/function isTrue[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(ADMINS_SRC.match(/function normalizeAdminStatus[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(ADMINS_SRC.match(/function looksLikeEmail[\s\S]*?\n}/)[0], sandbox);


// ---- 測試工具 ----
let pass = 0, failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}

const evalIn = (code) => vm.runInContext(code, sandbox);
const reset  = () => { sandbox.__SENT__ = []; sandbox.__FAIL_FOR__ = []; sandbox.__LOGS = []; };


console.log('\n===== getReportRecipients：收件人怎麼挑 =====\n');

const recipients = evalIn('getReportRecipients()');
check('只挑啟用中且 Email 正確的',
  recipients.map((r) => r.email), ['super@pci.com', 'ming@pci.com']);
check('停用中的不收信',   recipients.some((r) => r.email === 'hua@pci.com'), false);
check('Email 空白的不收信（測試帳號就是這種）',
  recipients.some((r) => r.name === '測試管理者一'), false);
check('Email 格式錯的不收信', recipients.some((r) => r.email === 'not-an-email'), false);
check('姓名有一起帶出來',    recipients[0].name, '系統管理者');


console.log('\n===== buildDailyReport：哪些案件該進日報 =====\n');

const report = evalIn('buildDailyReport()');

check('只算未處理的',        report.total, 3);
check('處理中的不算',        report.cases.some((c) => c.case_id === 'PCI-202608-003'), false);
check('已結案的不算',        report.cases.some((c) => c.case_id === 'PCI-202607-004'), false);
check('軟刪除的不算',        report.cases.some((c) => c.case_id === 'PCI-202608-005'), false);
check('狀態空白的當成未處理', report.cases.some((c) => c.case_id === 'PCI-202608-006'), true);

// 這封信要回答「今天先處理哪一件」，答案永遠是等最久的那件
check('放最久的排最前面',
  report.cases.map((c) => c.case_id),
  ['PCI-202608-001', 'PCI-202608-006', 'PCI-202608-002']);
check('天數算對了',          report.cases[0].days_open, 19);
check('逾期件數',            report.overdue, 2);
check('未滿 3 天的不算逾期',
  report.cases.find((c) => c.case_id === 'PCI-202608-002').is_overdue, false);


console.log('\n===== sendDailyReport：寄信 =====\n');

reset();
const result = evalIn('sendDailyReport()');

check('寄給每一位收件人各一封', sandbox.__SENT__.length, 2);
check('收件人正確',
  sandbox.__SENT__.map((m) => m.to), ['super@pci.com', 'ming@pci.com']);
check('寄件人顯示名稱',        sandbox.__SENT__[0].name, 'PCI 餐廳回饋系統 · Kantin PCI');
check('主旨含件數與逾期數',
  sandbox.__SENT__[0].subject, '[Kantin PCI] 3 laporan belum diproses (2 terlambat) · 未處理 3 件');
check('回報寄出結果',          result.indexOf('已寄出 2 封') === 0, true);
check('沒有寫錯誤日誌',        sandbox.__LOGS.length, 0);

const html = sandbox.__SENT__[0].htmlBody;
check('信裡有案件編號',        html.indexOf('PCI-202608-001') >= 0, true);
check('地點顯示成中文名稱',    html.indexOf('第二餐廳') >= 0, true);
check('分類複選以斜線並列',    html.indexOf('菜單口味 / 環境衛生') >= 0, true);
check('逾期列有紅底',          html.indexOf('background:#fef2f2;') >= 0, true);
check('有連到案件列表的按鈕',
  html.indexOf('https://j46g629h.github.io/kantin_PCI_adidas/admin-cases.html') >= 0, true);
check('中印雙語表頭',          html.indexOf('Kantin · 地點') >= 0, true);

// 描述是員工自己打的，可能含有角括號
check('內容有做 HTML 跳脫（不會變成可執行的標籤）',
  html.indexOf('<script>alert(1)</script>') >= 0, false);
check('跳脫後的原文仍看得到',
  evalIn(`escapeForHtml('<script>alert(1)</script>')`),
  '&lt;script&gt;alert(1)&lt;/script&gt;');


console.log('\n===== 空信規則與失敗處理 =====\n');

// 沒有未處理案件時不寄信（規格 §10.1）——
// 每天寄一封「今天沒事」，兩星期後就沒有人會打開它了
reset();
const savedRows = sandbox.__ROWS;
evalIn(`__ROWS = __ROWS.map(function (r) { r[12] = 'ST_DONE'; return r; })`);
const emptyResult = evalIn('sendDailyReport()');
check('沒有未處理案件 → 不寄信',   sandbox.__SENT__.length, 0);
check('並且說明原因',              emptyResult.indexOf('不寄信') >= 0, true);
sandbox.__ROWS = savedRows;
evalIn(`__ROWS = ${JSON.stringify(ROWS_SPEC)}.map(function (row) {
  return row.map(function (v) {
    return (typeof v === 'string' && v.indexOf('@ISO:') === 0) ? new Date(v.slice(5)) : v;
  });
})`);

// 一個人寄失敗，其他人照樣要收得到
reset();
sandbox.__FAIL_FOR__ = ['super@pci.com'];
const partial = evalIn('sendDailyReport()');
check('一個失敗不影響其他人',      sandbox.__SENT__.map((m) => m.to), ['ming@pci.com']);
check('失敗有寫進錯誤日誌',        sandbox.__LOGS.length, 1);
check('錯誤日誌記下是哪個收件人',
  String(sandbox.__LOGS[0][4]).indexOf('super@pci.com') >= 0, true);
check('回報有算出失敗數',          partial.indexOf('失敗 1 封') >= 0, true);

// 全部管理者的 Email 都沒填 → 這是設定問題，不能無聲無息
reset();
const savedAdmins = sandbox.__ADMINS;
evalIn(`__ADMINS = __ADMINS.map(function (a) { a[2] = ''; return a; })`);
evalIn('sendDailyReport()');
check('沒有任何收件人 → 不寄信',   sandbox.__SENT__.length, 0);
check('沒有任何收件人 → 寫錯誤日誌（不能無聲無息）', sandbox.__LOGS.length, 1);
check('錯誤日誌說得出原因',
  String(sandbox.__LOGS[0][3]).indexOf('沒有任何可用的收件人') >= 0, true);
sandbox.__ADMINS = savedAdmins;
evalIn(`__ADMINS = ${JSON.stringify(ADMINS_SPEC)}`);


console.log('\n===== 筆數上限 =====\n');

reset();
// 灌 60 筆未處理案件，超過 REPORT.MAX_ROWS（50）
evalIn(`
  for (var i = 0; i < 60; i++) {
    __ROWS.push(['PCI-202608-9' + (100 + i), new Date('2026-08-18T12:00:00+07:00'),
      '00123', 'X', 'ID', 'LOC_02', 'MEAL_LUNCH', 'CAT_TASTE', '測試', 3, '', '',
      'ST_NEW', '', '', '', '', '', 'x' + i, '']);
  }
`);
evalIn('sendDailyReport()');
const bigHtml = sandbox.__SENT__[0].htmlBody;
const rowCount = (bigHtml.match(/PCI-2026/g) || []).length;
check('信裡最多只列 50 筆',     rowCount, 50);
check('並且明說還有幾筆沒列出', bigHtml.indexOf('還有 13 件未列出') >= 0, true);
check('總數仍然是全部的',       sandbox.__SENT__[0].subject.indexOf('未處理 63 件') >= 0, true);


console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount > 0 ? 1 : 0);
