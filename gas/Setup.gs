/**
 * PCI 餐廳回饋系統 — 一次性建置腳本
 *
 * 用途：自動建立所有 Sheet 分頁、表頭、格式、初始資料，以及 Drive 圖片資料夾。
 *
 * ⚠️ 這支程式只需要執行一次。執行方式見檔案最下方的說明。
 * ⚠️ 這個檔案沒有重新宣告 SHEET_ID，它會直接使用 Code.gs 裡的那一個。
 *    （Apps Script 的所有 .gs 檔案共用同一個全域範圍）
 */


// ===== 分頁與欄位定義 =====

/** 回報資料分頁的欄位（順序即欄位順序） */
const FEEDBACK_COLUMNS = [
  { code: 'case_id',          name: '案件編號',     width: 140, format: '@' },
  { code: 'submit_time',      name: '提交時間',     width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'emp_id',           name: '工號',         width: 100, format: '@' },  // ← 純文字，保住前導零
  { code: 'emp_name',         name: '姓名',         width: 110, format: '@' },
  { code: 'lang',             name: '語言',         width:  60, format: '@' },
  { code: 'location_code',    name: '餐廳地點',     width: 100, format: '@' },
  { code: 'category_code',    name: '問題分類',     width: 120, format: '@' },
  { code: 'description',      name: '問題描述',     width: 300, format: '@' },
  { code: 'rating',           name: '滿意度評分',   width:  90, format: '0' },
  { code: 'priority',         name: '優先層級',     width:  90, format: '@' },
  { code: 'image_urls',       name: '圖片連結',     width: 200, format: '@' },
  { code: 'status_code',      name: '處理狀態',     width:  90, format: '@' },
  { code: 'handler',          name: '處理者',       width: 100, format: '@' },
  { code: 'response',         name: '處理回覆',     width: 300, format: '@' },
  { code: 'response_time',    name: '處理時間',     width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'last_updated_at',  name: '最後更新時間', width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'last_updated_by',  name: '最後更新者',   width: 100, format: '@' },
  { code: 'client_submit_id', name: '提交識別碼',   width: 180, format: '@' },
  { code: 'is_deleted',       name: '已刪除',       width:  70, format: '@' },
];

/** 分頁名稱（其他程式一律引用這裡，不要各自寫字串） */
const SHEETS = {
  FEEDBACK:  '回報資料',
  EMPLOYEES: '員工名冊',
  OPTIONS:   '選項設定',
  COUNTERS:  '系統計數',
  LOGS:      '錯誤日誌',
};

/** Drive 資料夾名稱 */
const DRIVE_ROOT_FOLDER  = 'PCI餐廳回饋系統';
const DRIVE_IMAGE_FOLDER = '圖片';


// ===== 主程式 =====

/**
 * 一鍵建立所有分頁與資料夾。
 * 重複執行是安全的：已存在的分頁不會被覆蓋，只會略過。
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const report = [];

  report.push('開始建置：' + ss.getName());
  report.push('');

  // --- 1. 回報資料 ---
  // 舊的測試分頁只有 3 欄，先改名保留備份，再建立正式結構
  const oldFeedback = ss.getSheetByName(SHEETS.FEEDBACK);
  if (oldFeedback && oldFeedback.getLastColumn() < FEEDBACK_COLUMNS.length) {
    const backupName = '_舊_回報資料_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMdd');
    oldFeedback.setName(backupName);
    report.push('舊的測試分頁已改名為「' + backupName + '」（確認沒問題後可自行刪除）');
  }

  const feedback = getOrCreateSheet(ss, SHEETS.FEEDBACK);
  if (feedback.getLastRow() === 0) {
    const headers = FEEDBACK_COLUMNS.map(function (c) { return c.name; });
    feedback.getRange(1, 1, 1, headers.length).setValues([headers]);

    // 逐欄設定格式與寬度
    FEEDBACK_COLUMNS.forEach(function (col, i) {
      const colIndex = i + 1;
      feedback.setColumnWidth(colIndex, col.width);
      // 從第 2 列開始套用格式（第 1 列是表頭）
      feedback.getRange(2, colIndex, feedback.getMaxRows() - 1, 1).setNumberFormat(col.format);
    });

    styleHeader(feedback, headers.length);
    report.push('✔ 建立「' + SHEETS.FEEDBACK + '」（' + headers.length + ' 欄）');
    report.push('    工號欄已設為純文字，0012345 不會再變成 12345');
  } else {
    report.push('－ 「' + SHEETS.FEEDBACK + '」已存在，略過');
  }

  // --- 2. 員工名冊 ---
  const employees = getOrCreateSheet(ss, SHEETS.EMPLOYEES);
  if (employees.getLastRow() === 0) {
    employees.getRange(1, 1, 1, 3).setValues([['工號', '姓名', '狀態']]);
    // 整欄設純文字，之後貼上 8000 筆真名冊時前導零才不會被吃掉
    employees.getRange(2, 1, employees.getMaxRows() - 1, 1).setNumberFormat('@');
    employees.getRange(2, 2, employees.getMaxRows() - 1, 1).setNumberFormat('@');

    const dummy = [
      ['0012345', 'Budi Santoso',      'ACTIVE'],
      ['0012346', 'Siti Rahayu',       'ACTIVE'],
      ['0012347', 'Ahmad Fauzi',       'ACTIVE'],
      ['0023456', 'Dewi Lestari',      'ACTIVE'],
      ['0023457', 'Rizki Pratama',     'ACTIVE'],
      ['0034567', 'Nurul Hidayah',     'ACTIVE'],
      ['0034568', 'Agus Setiawan',     'ACTIVE'],
      ['8372',    'Ken Wang',          'ACTIVE'],
      ['9001',    '測試員工-已離職',    'LEFT'],
      ['9002',    '測試員工-備用',      'ACTIVE'],
    ];
    employees.getRange(2, 1, dummy.length, 3).setValues(dummy);

    employees.setColumnWidth(1, 100);
    employees.setColumnWidth(2, 180);
    employees.setColumnWidth(3, 80);
    styleHeader(employees, 3);
    report.push('✔ 建立「' + SHEETS.EMPLOYEES + '」（含 10 筆開發測試用假資料）');
    report.push('    真實名冊到手後，把第 2 列以下全部覆蓋即可');
  } else {
    report.push('－ 「' + SHEETS.EMPLOYEES + '」已存在，略過');
  }

  // --- 3. 選項設定 ---
  const options = getOrCreateSheet(ss, SHEETS.OPTIONS);
  if (options.getLastRow() === 0) {
    const rows = [
      ['類型', '代碼', '中文顯示', '印尼文顯示', '排序', '啟用'],

      ['LOCATION', 'LOC_02',       '第二餐廳',   'Kantin 2',        1, true],
      ['LOCATION', 'LOC_04',       '第四餐廳',   'Kantin 4',        2, true],
      ['LOCATION', 'LOC_R3',       'R3廠餐廳',   'Kantin R3',       3, true],
      ['LOCATION', 'LOC_VIP',      'VIP餐廳',    'Kantin VIP',      4, true],

      ['CATEGORY', 'CAT_TASTE',    '菜單口味',   'Rasa Makanan',    1, true],
      ['CATEGORY', 'CAT_HYGIENE',  '衛生環境',   'Kebersihan',      2, true],
      ['CATEGORY', 'CAT_SERVICE',  '服務態度',   'Pelayanan',       3, true],
      ['CATEGORY', 'CAT_FACILITY', '餐廳設備',   'Fasilitas',       4, true],
      ['CATEGORY', 'CAT_OTHER',    '其他建議',   'Saran Lain',      5, true],

      ['STATUS',   'ST_NEW',       '未處理',     'Belum Diproses',  1, true],
      ['STATUS',   'ST_PROC',      '處理中',     'Sedang Diproses', 2, true],
      ['STATUS',   'ST_DONE',      '已結案',     'Selesai',         3, true],

      ['PRIORITY', 'P_NORMAL',     '一般',       'Normal',          1, true],
      ['PRIORITY', 'P_HIGH',       '緊急',       'Mendesak',        2, true],
    ];
    options.getRange(1, 1, rows.length, 6).setValues(rows);
    options.getRange(2, 2, options.getMaxRows() - 1, 3).setNumberFormat('@');

    [90, 120, 120, 150, 60, 60].forEach(function (w, i) {
      options.setColumnWidth(i + 1, w);
    });
    styleHeader(options, 6);
    report.push('✔ 建立「' + SHEETS.OPTIONS + '」（' + (rows.length - 1) + ' 個選項）');
    report.push('    要新增餐廳或分類，直接在這裡加一列，程式不用改');
  } else {
    report.push('－ 「' + SHEETS.OPTIONS + '」已存在，略過');
  }

  // --- 4. 系統計數 ---
  const counters = getOrCreateSheet(ss, SHEETS.COUNTERS);
  if (counters.getLastRow() === 0) {
    counters.getRange(1, 1, 1, 2).setValues([['年月', '最後流水號']]);
    counters.getRange(2, 1, counters.getMaxRows() - 1, 1).setNumberFormat('@');
    counters.setColumnWidth(1, 100);
    counters.setColumnWidth(2, 100);
    styleHeader(counters, 2);
    report.push('✔ 建立「' + SHEETS.COUNTERS + '」（案件編號流水號，程式自動維護）');
  } else {
    report.push('－ 「' + SHEETS.COUNTERS + '」已存在，略過');
  }

  // --- 5. 錯誤日誌 ---
  const logs = getOrCreateSheet(ss, SHEETS.LOGS);
  if (logs.getLastRow() === 0) {
    logs.getRange(1, 1, 1, 5).setValues([['時間', '來源', '工號', '錯誤訊息', '請求內容']]);
    [140, 140, 100, 300, 300].forEach(function (w, i) {
      logs.setColumnWidth(i + 1, w);
    });
    styleHeader(logs, 5);
    report.push('✔ 建立「' + SHEETS.LOGS + '」（員工回報「送不出去」時查這裡）');
  } else {
    report.push('－ 「' + SHEETS.LOGS + '」已存在，略過');
  }

  // --- 6. Drive 圖片資料夾 ---
  const imageFolder = getOrCreateDriveFolder();
  report.push('');
  report.push('✔ Drive 圖片資料夾已就緒');
  report.push('    資料夾 ID：' + imageFolder.getId());
  report.push('    ↑ 請把這串 ID 複製起來，關卡 2-4 上傳圖片時會用到');

  report.push('');
  report.push('建置完成。請切回 Google Sheet 檢查各分頁。');

  const text = report.join('\n');
  Logger.log(text);
  return text;
}


// ===== 輔助函式 =====

/** 取得分頁，不存在就建立 */
function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** 表頭樣式：粗體、灰底、凍結第一列 */
function styleHeader(sheet, columnCount) {
  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight('bold')
    .setBackground('#e8eaed')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
}

/** 建立 Drive 資料夾結構：PCI餐廳回饋系統/圖片，回傳圖片資料夾 */
function getOrCreateDriveFolder() {
  const root = findOrCreateFolder(DriveApp.getRootFolder(), DRIVE_ROOT_FOLDER);
  return findOrCreateFolder(root, DRIVE_IMAGE_FOLDER);
}

function findOrCreateFolder(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}


/* ============================================================
   執行方式
   ------------------------------------------------------------
   1. 上方函式下拉選單選「setupSheets」
   2. 按「執行」
   3. 第一次會要求授權（因為新增了 Drive 權限）：
      審查權限 → 選帳號 → 進階 → 前往...（不安全）→ 允許
   4. 執行完畢後，看下方「執行紀錄」的輸出，
      裡面有 Drive 圖片資料夾的 ID，請複製起來
   ============================================================ */
