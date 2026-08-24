/**
 * 本機測試排程報表（規格 §10.1）
 *
 *   getReportRecipients  收件人怎麼挑
 *   buildDailyReport     哪些案件該進日報、排序、逾期計數
 *   sendDailyReport      空信規則、主旨、寄幾封、失敗處理
 *   buildMonthlyStats    月報統計、未結案定義、與上個月比較
 *   sendMonthlyReport    抓哪一個月、空月份照寄、月份代碼防呆
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

// 收件人 = 啟用中的超級管理者 + 選項設定的額外名單，
// 所以這份名單刻意讓每一種「該收 / 不該收」的情況都出現一次
const ADMINS_SPEC = [
  ['系統管理者', 'super@pci',  'super@pci.com',  'h', 's', 'SUPER', 'ACTIVE',   'FALSE', '', '', ''],
  ['系統管理者2','super2@pci', 'super2@pci.com', 'h', 's', 'SUPER', 'ACTIVE',   'FALSE', '', '', ''],
  // 一般管理者 → 不該收到（規格 §10 已改成只寄超級管理者）
  ['王小明',     'ming@pci',   'ming@pci.com',   'h', 's', 'ADMIN', 'ACTIVE',   'FALSE', '', '', ''],
  // 停用中的超級管理者 → 不該收到
  ['李美華',     'hua@pci',    'hua@pci.com',    'h', 's', 'SUPER', 'DISABLED', 'FALSE', '', '', ''],
  // Email 空白（測試帳號就是這樣）→ 不該收到
  ['測試管理者一','test01@kantin.local', '',     'h', 's', 'SUPER', 'ACTIVE',   'TRUE',  '', '', ''],
  // Email 打錯字 → 不該寄出去
  ['打錯字的',   'typo@pci',   'not-an-email',   'h', 's', 'SUPER', 'ACTIVE',   'FALSE', '', '', ''],
  ['',           '',           '',               '',  '',  '',      '',         '',      '', '', ''],   // 空白列
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
['Config.js', 'Utils.js', 'Options.js', 'Query.js', 'Cases.js', 'Stats.js', 'Notify.js', 'Reports.js'].forEach((f) => {
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
vm.runInContext(AUTH_SRC.match(/function normalizeRole[\s\S]*?\n}/)[0], sandbox);
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
check('只挑啟用中的超級管理者',
  recipients.map((r) => r.email), ['super@pci.com', 'super2@pci.com']);
check('一般管理者不收信',     recipients.some((r) => r.email === 'ming@pci.com'), false);
check('停用中的不收信',       recipients.some((r) => r.email === 'hua@pci.com'), false);
check('Email 空白的不收信（測試帳號就是這種）',
  recipients.some((r) => r.name === '測試管理者一'), false);
check('Email 格式錯的不收信', recipients.some((r) => r.email === 'not-an-email'), false);
check('姓名有一起帶出來',     recipients[0].name, '系統管理者');


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
  sandbox.__SENT__.map((m) => m.to), ['super@pci.com', 'super2@pci.com']);
check('寄件人顯示名稱',        sandbox.__SENT__[0].name, 'PCI 餐廳回饋系統 · Kantin PCI');
check('主旨含件數與逾期數',
  sandbox.__SENT__[0].subject, '[Kantin PCI] 3 laporan belum diproses (2 terlambat) · 未處理 3 件');
check('回報寄出結果',          result.indexOf('已寄出 2 封') === 0, true);
check('沒有寫錯誤日誌',        sandbox.__LOGS.length, 0);

const html = sandbox.__SENT__[0].htmlBody;
check('信裡有案件編號',        html.indexOf('PCI-202608-001') >= 0, true);
check('地點雙語並列（印尼文在前）', html.indexOf('Kantin 2 · 第二餐廳') >= 0, true);
check('分類複選以斜線並列',    html.indexOf('Rasa Makanan · 菜單口味 / Kebersihan · 環境衛生') >= 0, true);
// ⚠️ 不可以斷言色碼本身。改配色時這種測試會莫名紅掉，
//    而那跟「逾期列有沒有被標出來」完全無關（版本號那一題已經教過一次）。
//    要驗的是**行為**：逾期列的底色與一般列不同
const overdueRow = html.split('<tr')[1] || '';
check('逾期列有底色（與一般列不同）',
  /background:#[0-9a-fA-F]{6}/.test(overdueRow), true);
check('有連到案件列表的按鈕',
  html.indexOf('https://j46g629h.github.io/kantin_PCI_adidas/admin-cases.html') >= 0, true);
check('中印雙語表頭',          html.indexOf('Kantin · 地點') >= 0, true);

// 描述是員工自己打的，可能含有角括號
check('內容有做 HTML 跳脫（不會變成可執行的標籤）',
  html.indexOf('<script>alert(1)</script>') >= 0, false);
check('跳脫後的原文仍看得到',
  evalIn(`escapeForHtml('<script>alert(1)</script>')`),
  '&lt;script&gt;alert(1)&lt;/script&gt;');


console.log('\n===== 收件人：超級管理者 + 額外名單 =====\n');

const base = evalIn('getReportRecipients()');
check('基準：兩位啟用中的超級管理者',
  base.map((r) => r.email), ['super@pci.com', 'super2@pci.com']);

// 額外收件人放「選項設定」，類型 REPORT_TO，代碼欄放 Email（見 Config.js 說明）
evalIn(`__OPTIONS.push(['REPORT_TO', 'boss@pci.com', '廠長', 'Kepala Pabrik', 1, true])`);
check('額外名單會被加進來',
  evalIn('getReportRecipients()').map((r) => r.email),
  ['super@pci.com', 'super2@pci.com', 'boss@pci.com']);
check('額外收件人的顯示名稱取自中文欄',
  evalIn('getReportRecipients()')[2].name, '廠長');

// 啟用欄 FALSE → 不寄，但那一列不必刪掉（設計約定第 7 條的作法）
evalIn(`__OPTIONS.push(['REPORT_TO', 'left@pci.com', '已離職', '', 2, false])`);
check('啟用欄 FALSE 的不寄',
  evalIn('getReportRecipients()').some((r) => r.email === 'left@pci.com'), false);

evalIn(`__OPTIONS.push(['REPORT_TO', 'not-an-email', '打錯字', '', 3, true])`);
check('格式不對的額外地址不寄',
  evalIn('getReportRecipients()').some((r) => r.email === 'not-an-email'), false);

// 去重：兩個帳號共用一個信箱是很常見的，那個人不該每天收到兩封一樣的信
evalIn(`__ADMINS.push(['共用信箱的', 'shared@pci', 'SUPER@PCI.COM', 'h', 's',
                       'SUPER', 'ACTIVE', 'FALSE', '', '', ''])`);
check('兩個管理者共用信箱 → 只留一份（大小寫也算同一個）',
  evalIn('getReportRecipients()').filter((r) => r.email.toLowerCase() === 'super@pci.com').length, 1);

evalIn(`__OPTIONS.push(['REPORT_TO', 'super2@pci.com', '重複的', '', 4, true])`);
check('額外名單與管理者重複 → 也只留一份',
  evalIn('getReportRecipients()').filter((r) => r.email.toLowerCase() === 'super2@pci.com').length, 1);

// 實際寄信時就是這份去重後的名單
reset();
evalIn('sendDailyReport()');
check('實際寄出的封數 = 去重後的人數', sandbox.__SENT__.length, 3);
check('收件人正確',
  sandbox.__SENT__.map((m) => m.to).sort(),
  ['boss@pci.com', 'super2@pci.com', 'super@pci.com']);


console.log('\n===== 信件內容：印尼文為主、中文為輔 =====\n');

const bi = sandbox.__SENT__[0].htmlBody;
check('地點並列兩種語言（印尼文在前）', bi.indexOf('Kantin 2 · 第二餐廳') >= 0, true);
check('分類並列兩種語言',               bi.indexOf('Rasa Makanan · 菜單口味') >= 0, true);
check('複選分類各自都並列',
  bi.indexOf('Rasa Makanan · 菜單口味 / Kebersihan · 環境衛生') >= 0, true);
check('標題印尼文在前', bi.indexOf('Laporan Belum Diproses · 未處理案件清單') >= 0, true);
check('表頭印尼文在前', bi.indexOf('Kantin · 地點') >= 0, true);

// 兩種語言一樣時（例如人名）不要變成「王小明 · 王小明」
check('兩種語言相同 → 只顯示一次',
  evalIn(`optionText(getOptionMaps(), 'HANDLER', 'HDL_01')`), '王小明');
check('兩種語言都有 → 印尼文在前',
  evalIn(`optionText(getOptionMaps(), 'REPORT_TO', 'boss@pci.com')`), 'Kepala Pabrik · 廠長');
check('只有中文有填 → 就顯示中文',
  evalIn(`optionText(getOptionMaps(), 'REPORT_TO', 'left@pci.com')`), '已離職');
check('查不到代碼 → 顯示代碼本身（總比空白好排查）',
  evalIn(`optionText(getOptionMaps(), 'LOCATION', 'LOC_XX')`), 'LOC_XX');

// ⚠️ 收尾：這一段動過共用的假資料，一定要還原。
//    不還原的話，後面「沒有任何收件人」那組測試會因為額外名單還在而永遠失敗，
//    而失敗訊息會指向那一組，跟真正的原因差很遠
evalIn(`__OPTIONS = ${JSON.stringify(OPTIONS_SPEC)}`);
evalIn(`__ADMINS  = ${JSON.stringify(ADMINS_SPEC)}`);
check('收尾還原成功', evalIn('getReportRecipients()').length, 2);


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
check('一個失敗不影響其他人',      sandbox.__SENT__.map((m) => m.to), ['super2@pci.com']);
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


console.log('\n===== 信件頁尾：系統資訊 =====\n');

// 頁尾內容與 app 頁尾一致（維護單位 / 聯絡方式 / 系統版本），
// 兩邊是否真的同步由 node tools/test-version-sync.js 盯著
reset();
evalIn('sendDailyReport()');
const foot = sandbox.__SENT__[0].htmlBody;

check('有維護單位（印尼文在前）', foot.indexOf('維護單位：PCI GA · PCI 總工務') >= 0, true);
check('有聯絡方式',              foot.indexOf('聯絡方式：3690') >= 0, true);
// ⚠️ 版本號**不可以寫死在測試裡**——寫死的話每次改版都會有一支測試莫名其妙紅掉，
//    而那跟「頁尾有沒有正確顯示版本」完全無關。改成從 gas/Config.js 讀出來比對
const VERSION_LINE = evalIn(
  `'Versi · 系統版本 ' + SYSTEM_INFO.version + ' · ' + SYSTEM_INFO.year`);
check('有系統版本與年份',        foot.indexOf(VERSION_LINE) >= 0, true);
check('仍保留自動寄出的說明',
  foot.indexOf('這封信由系統自動寄出，不需要回覆。') >= 0, true);

// 點版本號 → 員工端首頁（不是管理端）
check('版本號是連結，指向員工端首頁（不是管理端）',
  foot.indexOf('<a href="https://j46g629h.github.io/kantin_PCI_adidas/"') >= 0, true);

// ⚠️ Gmail / Outlook 會把沒指定顏色的連結一律改成藍色底線，
//    整片灰色的頁尾就會突然冒出一條藍字
check('連結有自己指定灰色（不然信箱軟體會塗成藍色）',
  /<a href="[^"]*" style="color:#[0-9a-fA-F]{6};text-decoration:underline;"/.test(foot), true);

// 月報走的是同一個外框，頁尾應該一模一樣
reset();
evalIn(`sendMonthlyReportFor('202608')`);
const mFoot = sandbox.__SENT__[0].htmlBody;
check('月報的頁尾與日報相同',
  mFoot.indexOf(VERSION_LINE) >= 0, true);
check('月報頁尾也有維護單位', mFoot.indexOf('維護單位：PCI GA · PCI 總工務') >= 0, true);

// 兩種語言一樣時只顯示一次，否則會變成「PCI GA · PCI GA」
check('兩種語言相同 → 只顯示一次',
  evalIn(`bilingualText('PCI GA', 'PCI GA')`), 'PCI GA');
check('只有中文有填 → 顯示中文',
  evalIn(`bilingualText('', 'PCI 總工務')`), 'PCI 總工務');
check('只有印尼文有填 → 顯示印尼文',
  evalIn(`bilingualText('PCI GA', '')`), 'PCI GA');


console.log('\n===== 月份代碼的加減 =====\n');

check('現在是哪一個月',        evalIn('currentMonthKey()'), '202608');
check('上一個月',              evalIn(`previousMonthKey('202608')`), '202607');
check('1 月的上一個月是去年 12 月', evalIn(`previousMonthKey('202601')`), '202512');
check('12 月的上一個月',       evalIn(`previousMonthKey('202612')`), '202611');
check('11 月的上一個月要補零', evalIn(`previousMonthKey('202611')`), '202610');
check('月份名稱（印尼文）',    evalIn(`monthLabel('202607').id`), 'Juli 2026');
check('月份名稱（中文）',      evalIn(`monthLabel('202607').zh`), '2026 年 7 月');


console.log('\n===== buildMonthlyStats：月報統計 =====\n');

const m8 = evalIn(`buildMonthlyStats('202608')`);

check('只算當月的案件',        m8.total, 4);
check('軟刪除的不算',
  m8.open_cases.some((c) => c.case_id === 'PCI-202608-005'), false);
check('平均滿意度只算有評分的', m8.avg_rating, 3);
check('沒有結案 → 結案率 0',    m8.done_rate, 0);
check('沒有結案 → 平均處理天數 null（不是 0）', m8.avg_days, null);

// 未結案 = 不等於已結案，含「處理中」——與日報的「未處理」刻意不同
check('未結案含處理中的案件',
  m8.open_cases.some((c) => c.case_id === 'PCI-202608-003'), true);
check('未結案件數',            m8.open_total, 4);
check('放最久的排最前面',
  m8.open_cases.map((c) => c.case_id),
  ['PCI-202608-001', 'PCI-202608-003', 'PCI-202608-006', 'PCI-202608-002']);
check('狀態空白的算成未處理',
  m8.open_cases.find((c) => c.case_id === 'PCI-202608-006').status_code, 'ST_NEW');

check('各餐廳表現（回報數多的排前面）',
  m8.locations.map((l) => [l.code, l.total, l.avg_rating]),
  [['LOC_02', 2, 2.5], ['LOC_04', 2, 3.5]]);

// 複選：4 件案件卻有 5 個分類計次，這是對的（規格 §10 的提醒）
check('分類按出現次數（總和會超過案件數）',
  m8.by_category.reduce((sum, c) => sum + c.count, 0), 5);
check('最多的分類排最前面',    m8.by_category[0].code, 'CAT_HYGIENE');

check('有比上個月（202607 有資料）', m8.previous.month, '202607');
check('上個月的總數',          m8.previous.total, 1);
check('上個月的平均滿意度',    m8.previous.avg_rating, 5);
check('上個月的結案率',        m8.previous.done_rate, 100);

const m7 = evalIn(`buildMonthlyStats('202607')`);
check('7 月全部結案 → 未結案 0', m7.open_total, 0);
check('7 月結案率 100%',        m7.done_rate, 100);
check('7 月平均處理天數（21 小時 → 0.9 天）', m7.avg_days, 0.9);
check('6 月沒有資料 → previous 是 null（不是 0）', m7.previous, null);


console.log('\n===== sendMonthlyReport：寄信 =====\n');

reset();
const mResult = evalIn('sendMonthlyReport()');

// 每月 1 日跑，統計的是上個月。測試把「現在」固定在 8/20，所以抓的是 7 月
check('沒指定月份 → 統計上個月',
  sandbox.__SENT__[0].subject.indexOf('Juli 2026') >= 0, true);
check('寄給每一位收件人各一封', sandbox.__SENT__.length, 2);
check('主旨含件數',
  sandbox.__SENT__[0].subject, '[Kantin PCI] Laporan Bulanan Juli 2026 · 2026 年 7 月月報（1 件）');
check('回報寄出結果',          mResult.indexOf('已寄出 2 封') === 0, true);
check('沒有寫錯誤日誌',        sandbox.__LOGS.length, 0);
check('全部結案時給的是好消息，不是空表格',
  sandbox.__SENT__[0].htmlBody.indexOf('Semua laporan sudah selesai') >= 0, true);

reset();
evalIn(`sendMonthlyReportFor('202608')`);
const mHtml = sandbox.__SENT__[0].htmlBody;

check('主旨在有未結案時會標出來',
  sandbox.__SENT__[0].subject,
  '[Kantin PCI] Laporan Bulanan Agustus 2026 · 2026 年 8 月月報（4 件，未結案 4 件）');
check('標題印尼文在前',   mHtml.indexOf('Laporan Bulanan · 每月統計月報') >= 0, true);
check('副標是月份',       mHtml.indexOf('Agustus 2026 · 2026 年 8 月') >= 0, true);
check('有回報總數',       mHtml.indexOf('Total laporan · 回報總數') >= 0, true);
check('有各餐廳表現',     mHtml.indexOf('Per kantin · 各餐廳表現') >= 0, true);
check('地點雙語並列',     mHtml.indexOf('Kantin 2 · 第二餐廳') >= 0, true);
check('有分類佔比',       mHtml.indexOf('Kategori masalah · 問題分類佔比') >= 0, true);
check('分類雙語並列',     mHtml.indexOf('Kebersihan · 環境衛生') >= 0, true);
check('有未結案清單',     mHtml.indexOf('未結案清單（4）') >= 0, true);
check('未結案清單列出案件編號', mHtml.indexOf('PCI-202608-001') >= 0, true);
check('沒有人動過的有底色',
  /background:#[0-9a-fA-F]{6};?"?>?\s*<td/.test(mHtml) || /<tr style="background:#/.test(mHtml), true);
check('連到動態表',
  mHtml.indexOf('https://j46g629h.github.io/kantin_PCI_adidas/admin-dashboard.html') >= 0, true);

// 這一行不能省：複選會讓佔比加起來超過 100%，沒寫明的話會被當成算錯
check('有註明佔比總和會超過 100%',
  mHtml.indexOf('總和會超過 100%') >= 0, true);

// 與上個月比較：8 月 4 件 vs 7 月 1 件、滿意度 3 vs 5、結案率 0% vs 100%
check('回報數的比較',      mHtml.indexOf('▲ +3') >= 0, true);
check('滿意度下降 → 紅字',
  /color:#[0-9a-fA-F]{6};font-size:12px;[^"]*">▼ -2</.test(mHtml), true);
check('結案率下降 → 紅字', mHtml.indexOf('▼ -100%') >= 0, true);
check('回報數不上色（變多不一定是壞事）',
  /color:#[0-9a-fA-F]{6};font-size:12px;[^"]*">▲ \+3</.test(mHtml), true);
check('有說明括號裡是什麼', mHtml.indexOf('括號內為與上個月的比較') >= 0, true);


console.log('\n===== 月報的空月份規則（與日報相反）=====\n');

// 日報沒事就不寄；月報沒事**也要寄**——
// 「上個月 0 件」可能是真的平靜，也可能是 QR Code 被撕掉了、沒人知道有這個系統
reset();
const emptyMonth = evalIn(`sendMonthlyReportFor('202601')`);
check('沒有任何回報的月份 → 照樣寄', sandbox.__SENT__.length, 2);
check('信裡明說這個月沒有回報',
  sandbox.__SENT__[0].htmlBody.indexOf('這個月沒有任何回報') >= 0, true);
check('數字沒有樣本時顯示破折號，不是 0',
  sandbox.__SENT__[0].htmlBody.indexOf('—') >= 0, true);
check('執行紀錄也說得出來',   emptyMonth.indexOf('共 0 件') >= 0, true);
check('上個月也沒資料 → 不畫比較',
  sandbox.__SENT__[0].htmlBody.indexOf('上個月沒有資料') >= 0, true);


console.log('\n===== 月份代碼防呆 =====\n');

// 月份代碼算壞時如果不擋，統計會靜靜回傳「0 件」——
// 那跟「那個月真的沒人回報」看起來一模一樣，是最難發現的一種錯
reset();
let threw = '';
try { evalIn(`sendMonthlyReportFor('2026-07')`); } catch (e) { threw = String(e.message || e); }
check('月份代碼格式不對 → 丟例外', threw.indexOf('月份代碼不合法') >= 0, true);
check('而且不會寄出任何信',     sandbox.__SENT__.length, 0);
check('有寫進錯誤日誌',         sandbox.__LOGS.length, 1);

reset();
threw = '';
try { evalIn(`sendMonthlyReportFor('')`); } catch (e) { threw = String(e.message || e); }
check('空字串也擋下來',         threw.indexOf('月份代碼不合法') >= 0, true);


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
