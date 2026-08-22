/**
 * 本機測試每月自動備份（關卡 4-4）
 *
 *   runBackup        有沒有真的複製、檔名對不對、放對資料夾
 *   cleanOldBackups  保留份數、只碰自己產生的檔案、丟垃圾桶不是永久刪
 *   listBackups      看得出排程有沒有在跑
 *   latestBackupInfo 給 4-5 用的安全網檢查
 *
 * 作法與其他測試相同：把 Apps Script 的全域服務用假的頂上。
 * 這一支多一個假的 `DriveApp`，把「複製了什麼」「丟掉了什麼」記錄下來，
 * 才能真的檢查行為——而不是只確認「有呼叫 makeCopy」。
 *
 * ⚠️ 這支測試最重要的一項是「不碰使用者自己的檔案」。
 *    自動清理誤刪使用者的東西，是整個功能裡最不能發生的事，
 *    而它平常完全不會表現出來——直到某天有人發現檔案不見了。
 *
 * 執行：node tools/test-backup-api.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
const TZ = 'Asia/Jakarta';
const NOW_ISO = '2026-09-01T02:30:00+07:00';

const LOG_HEADERS = ['時間', '來源', '工號', '錯誤', '內容'];


/** 假的 Drive 檔案。記得住自己被改過名、被丟過垃圾桶 */
function makeFile(name, createdIso) {
  return {
    _name: name,
    _trashed: false,
    _created: createdIso,
    getName() { return this._name; },
    getUrl()  { return 'https://drive.fake/' + this._name; },
    getDateCreated() { return new Date(this._created); },
    setTrashed(v) { this._trashed = v; return this; },
  };
}

/** 假的 Drive 資料夾 */
function makeFolder(name, files) {
  return {
    _name: name,
    _files: files || [],
    _subfolders: [],
    getName() { return this._name; },

    getFiles() {
      let i = 0;
      const list = this._files.filter((f) => !f._trashed);
      return { hasNext: () => i < list.length, next: () => list[i++] };
    },

    getFoldersByName(n) {
      let i = 0;
      const list = this._subfolders.filter((f) => f._name === n);
      return { hasNext: () => i < list.length, next: () => list[i++] };
    },

    createFolder(n) {
      const f = makeFolder(n, []);
      this._subfolders.push(f);
      sandbox.__CREATED_FOLDERS__.push(n);
      return f;
    },

    getParents() {
      let i = 0;
      const list = this._parents || [];
      return { hasNext: () => i < list.length, next: () => list[i++] };
    },
  };
}


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
      if (fmt === 'yyyy-MM-dd_HHmm') return `${y}-${m}-${day}_${hh}${mm}`;
      if (fmt === 'yyyy-MM-dd')      return `${y}-${m}-${day}`;
      if (fmt === 'yyyyMM')          return `${y}${m}`;
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    },
  },

  DriveApp: {
    getFolderById(id) {
      if (sandbox.__DRIVE_FAILS__) throw new Error('假裝 Drive 讀不到');
      return sandbox.__IMAGE_FOLDER__;
    },
    getFileById(id) {
      return {
        makeCopy(name, folder) {
          const file = makeFile(name, NOW_ISO);
          folder._files.push(file);
          sandbox.__COPIES__.push({ name: name, folder: folder.getName() });
          return file;
        },
      };
    },
  },

  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => (name === '錯誤日誌'
        ? makeSheet(sandbox.__LOGS, LOG_HEADERS)
        : null),
    }),
  },

  Logger: { log: () => {} },

  __LOGS: [],
  __COPIES__: [],
  __CREATED_FOLDERS__: [],
  __DRIVE_FAILS__: false,
  __IMAGE_FOLDER__: null,
};


function makeSheet(rows, headers) {
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => headers.length,
    appendRow: (row) => { rows.push(row); },
    getRange(row, col, numRows) {
      const n = numRows || 1;
      if (!col || !row) throw new Error('getRange 收到不合法的位置');
      return {
        getValues() { return row === 1 ? [headers] : rows.slice(row - 2, row - 2 + n); },
        setNumberFormat() { return this; },
        setValue(v) { rows[row - 2][col - 1] = v; return this; },
      };
    },
  };
}


/** 重新擺好一組乾淨的 Drive：根資料夾 → 圖片 / 備份 */
function resetDrive(backupFiles) {
  const root   = makeFolder('PCI餐廳回饋系統', []);
  const images = makeFolder('圖片', []);
  images._parents = [root];
  root._subfolders.push(images);

  if (backupFiles) {
    const backup = makeFolder('備份', backupFiles);
    root._subfolders.push(backup);
  }

  sandbox.__IMAGE_FOLDER__   = images;
  sandbox.__COPIES__         = [];
  sandbox.__CREATED_FOLDERS__ = [];
  sandbox.__LOGS             = [];
  sandbox.__DRIVE_FAILS__    = false;
  return root;
}


vm.createContext(sandbox);

vm.runInContext(`
  const _RealDate = Date;
  Date = class extends _RealDate {
    constructor(...args) { if (args.length === 0) super(_FIXED_NOW); else super(...args); }
    static now() { return _FIXED_NOW; }
  };
`.replace(/_FIXED_NOW/g, String(new Date(NOW_ISO).getTime())), sandbox);

['Config.js', 'Utils.js', 'Backup.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});


// ---- 測試工具 ----
let pass = 0, failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}

const evalIn = (code) => vm.runInContext(code, sandbox);


console.log('\n===== 第一次備份：資料夾還不存在 =====\n');

resetDrive(null);   // 沒有備份資料夾
const first = evalIn('backupMonthly()');

check('自動建立備份資料夾',   sandbox.__CREATED_FOLDERS__, ['備份']);
check('複製了一份',           sandbox.__COPIES__.length, 1);
check('檔名帶日期與時間',     sandbox.__COPIES__[0].name, '備份_2026-09-01_0230');
check('放進備份資料夾',       sandbox.__COPIES__[0].folder, '備份');
check('執行紀錄說得出結果',   first.indexOf('備份完成：備份_2026-09-01_0230') >= 0, true);
check('沒有寫錯誤日誌',       sandbox.__LOGS.length, 0);


console.log('\n===== 保留份數：只留最近 3 份 =====\n');

// 已經有 5 份舊備份，加上這次新的共 6 份 → 應該清掉 3 份
const old5 = [
  makeFile('備份_2026-08-01_0230', '2026-08-01T02:30:00+07:00'),
  makeFile('備份_2026-07-01_0230', '2026-07-01T02:30:00+07:00'),
  makeFile('備份_2026-06-01_0230', '2026-06-01T02:30:00+07:00'),
  makeFile('備份_2026-05-01_0230', '2026-05-01T02:30:00+07:00'),
  makeFile('備份_2026-04-01_0230', '2026-04-01T02:30:00+07:00'),
];
resetDrive(old5);
const result = evalIn('backupMonthly()');

const alive   = old5.filter((f) => !f._trashed).map((f) => f._name);
const trashed = old5.filter((f) =>  f._trashed).map((f) => f._name);

// ⚠️ 這次新做的那一份也在 old5 這個陣列裡（假 Drive 的 makeCopy 會 push 進同一個資料夾），
//    所以活著的應該是「新的 + 最近兩份舊的」＝ 最新的 3 份
check('留下來的剛好是最新的 3 份',
  alive.slice().sort(),
  ['備份_2026-07-01_0230', '備份_2026-08-01_0230', '備份_2026-09-01_0230']);
check('最舊的三份被清掉',
  trashed, ['備份_2026-06-01_0230', '備份_2026-05-01_0230', '備份_2026-04-01_0230']);
check('回報清掉幾份',        result.indexOf('清掉 3 份舊的') >= 0, true);

// ⚠️ 丟垃圾桶不是永久刪除：保留份數設錯時，垃圾桶裡有 30 天可以救
check('是丟垃圾桶，不是永久刪除',
  old5[4]._trashed, true);


console.log('\n===== 絕不碰使用者自己的檔案 =====\n');

/**
 * 這是整支測試最重要的一項。
 *
 * 使用者可能自己放東西進備份資料夾（手動下載的匯出檔、說明文件）。
 * 「自動清理」誤刪使用者的檔案，是這個功能最不能發生的事——
 * 而且它平常完全不會表現出來，直到某天有人發現檔案不見了。
 */
const mixed = [
  makeFile('備份_2026-08-01_0230', '2026-08-01T02:30:00+07:00'),
  makeFile('備份_2026-07-01_0230', '2026-07-01T02:30:00+07:00'),
  makeFile('備份_2026-06-01_0230', '2026-06-01T02:30:00+07:00'),
  makeFile('備份_2026-05-01_0230', '2026-05-01T02:30:00+07:00'),
  makeFile('員工名冊_原始檔.xlsx',   '2026-01-01T00:00:00+07:00'),
  makeFile('還原步驟說明.docx',      '2026-01-01T00:00:00+07:00'),
  makeFile('備份說明.txt',           '2026-01-01T00:00:00+07:00'),
];
resetDrive(mixed);
evalIn('backupMonthly()');

check('使用者的 xlsx 沒被動到',
  mixed.find((f) => f._name === '員工名冊_原始檔.xlsx')._trashed, false);
check('使用者的 docx 沒被動到',
  mixed.find((f) => f._name === '還原步驟說明.docx')._trashed, false);
// 「備份說明.txt」開頭是「備份」但不是「備份_」，一樣不可以碰
check('名字很像但不是我們產生的，也不碰',
  mixed.find((f) => f._name === '備份說明.txt')._trashed, false);
check('該清的舊備份還是有清掉',
  mixed.filter((f) => f._trashed).map((f) => f._name),
  ['備份_2026-06-01_0230', '備份_2026-05-01_0230']);


console.log('\n===== 份數還沒滿的時候不要亂清 =====\n');

const two = [
  makeFile('備份_2026-08-01_0230', '2026-08-01T02:30:00+07:00'),
];
resetDrive(two);
const small = evalIn('backupMonthly()');
check('只有 2 份 → 一份都不清', two[0]._trashed, false);
check('回報裡不提清理',         small.indexOf('清掉') >= 0, false);


console.log('\n===== listBackups：看得出排程有沒有在跑 =====\n');

resetDrive([
  makeFile('備份_2026-08-01_0230', '2026-08-01T02:30:00+07:00'),
  makeFile('備份_2026-07-01_0230', '2026-07-01T02:30:00+07:00'),
  makeFile('自己放的檔案.pdf',      '2026-07-01T00:00:00+07:00'),
]);
const listed = evalIn('listBackups()');

check('列出份數',           listed.indexOf('目前的備份（2 份）') >= 0, true);
check('新的排前面',
  listed.indexOf('備份_2026-08-01_0230') < listed.indexOf('備份_2026-07-01_0230'), true);
check('算得出幾天前',       listed.indexOf('（31 天前）') >= 0, true);
check('使用者的檔案不列進來', listed.indexOf('自己放的檔案.pdf') >= 0, false);

// 最新一份太舊 = 排程沒在跑。這是這支函式真正要回答的問題
resetDrive([makeFile('備份_2026-05-01_0230', '2026-05-01T02:30:00+07:00')]);
const stale = evalIn('listBackups()');
check('最新一份太舊 → 提醒排程可能沒在跑',
  stale.indexOf('排程可能沒在跑') >= 0, true);

resetDrive([]);
check('一份都沒有時說得出來',
  evalIn('listBackups()').indexOf('還沒有任何備份') >= 0, true);


console.log('\n===== latestBackupInfo：4-5 動手前的安全網檢查 =====\n');

resetDrive([
  makeFile('備份_2026-08-01_0230', '2026-08-01T02:30:00+07:00'),
  makeFile('備份_2026-07-01_0230', '2026-07-01T02:30:00+07:00'),
]);
check('回傳最新的那一份',
  evalIn('latestBackupInfo().name'), '備份_2026-08-01_0230');
check('附上幾天前',   evalIn('latestBackupInfo().age_days'), 31);

resetDrive([]);
check('沒有任何備份 → 回傳 null（4-5 看到 null 就要拒絕執行）',
  evalIn('latestBackupInfo()'), null);

// Drive 讀不到時也要回 null，不能讓 4-5 因為這裡丟例外就整支掛掉——
// 但更不能因為讀不到就當作「有備份」
resetDrive([]);
sandbox.__DRIVE_FAILS__ = true;
check('Drive 讀不到 → 也回 null，不是丟例外',
  evalIn('latestBackupInfo()'), null);
check('而且有寫錯誤日誌',  sandbox.__LOGS.length > 0, true);


console.log('\n===== 備份失敗要吵 =====\n');

// 備份失敗如果安靜地過去，等到真的需要它的那天才發現沒有，就太遲了
resetDrive([]);
sandbox.__DRIVE_FAILS__ = true;
let threw = false;
try { evalIn('backupMonthly()'); } catch (e) { threw = true; }

check('往外丟例外（Google 才會寄失敗通知）', threw, true);
check('同時寫進錯誤日誌',                    sandbox.__LOGS.length, 1);
check('錯誤日誌記得住是哪一支',
  String(sandbox.__LOGS[0][1]), 'backupMonthly');


console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount > 0 ? 1 : 0);
