/**
 * 一次性建置腳本
 *
 * 用途：自動建立所有 Sheet 分頁、表頭、格式、初始資料，以及 Drive 圖片資料夾。
 *
 * ⚠️ 這支程式只需要執行一次，已經跑過就不用再跑。
 *    重複執行是安全的：已存在的分頁只會略過，不會被覆蓋。
 *
 * 分頁名稱與欄位定義都放在 Config.js，這裡只負責建立。
 */


/** 一鍵建立所有分頁與資料夾 */
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

    FEEDBACK_COLUMNS.forEach(function (col, i) {
      const colIndex = i + 1;
      feedback.setColumnWidth(colIndex, col.width);
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
    employees.getRange(2, 1, employees.getMaxRows() - 1, 1).setNumberFormat('@');
    employees.getRange(2, 2, employees.getMaxRows() - 1, 1).setNumberFormat('@');

    const dummy = [
      ['0012345', 'Budi Santoso',      EMP_STATUS.ACTIVE],
      ['0012346', 'Siti Rahayu',       EMP_STATUS.ACTIVE],
      ['0012347', 'Ahmad Fauzi',       EMP_STATUS.ACTIVE],
      ['0023456', 'Dewi Lestari',      EMP_STATUS.ACTIVE],
      ['0023457', 'Rizki Pratama',     EMP_STATUS.ACTIVE],
      ['0034567', 'Nurul Hidayah',     EMP_STATUS.ACTIVE],
      ['0034568', 'Agus Setiawan',     EMP_STATUS.ACTIVE],
      ['8372',    'Ken Wang',          EMP_STATUS.ACTIVE],
      ['9001',    '測試員工-已停用',    EMP_STATUS.INACTIVE],
      ['9002',    '測試員工-備用',      EMP_STATUS.ACTIVE],
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

      ['MEAL',     'MEAL_BREAKFAST', '早餐',      'Menu Sarapan',    1, true],
      ['MEAL',     'MEAL_LUNCH',     '午餐',      'Menu Siang',      2, true],
      ['MEAL',     'MEAL_DINNER',    '晚餐',      'Menu Sore',       3, true],

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

  report.push('');
  report.push('建置完成。');

  const text = report.join('\n');
  Logger.log(text);
  return text;
}


/**
 * 升級：新增「餐別」欄位與三餐選項。
 *
 * 給「已經建好 Sheet」的環境用的一次性升級程式。
 * 重複執行是安全的：已經存在的東西會自動略過。
 *
 * 執行方式：上方函式下拉選單選 migrateAddMeal → 按執行 → 看執行紀錄
 */
function migrateAddMeal() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const report = [];

  // --- 1. 回報資料：在「餐廳地點」右邊插入「餐別」欄 ---
  const feedback = ss.getSheetByName(SHEETS.FEEDBACK);
  const headers = feedback.getRange(1, 1, 1, feedback.getLastColumn()).getValues()[0];

  if (headers.indexOf('餐別') === -1) {
    const locIndex = headers.indexOf('餐廳地點');
    if (locIndex === -1) throw new Error('找不到「餐廳地點」欄，請先確認分頁結構');

    const newCol = locIndex + 2;                 // 插在餐廳地點的右邊
    feedback.insertColumnAfter(locIndex + 1);

    feedback.getRange(1, newCol).setValue('餐別');
    feedback.getRange(1, newCol)
      .setFontWeight('bold')
      .setBackground('#e8eaed')
      .setVerticalAlignment('middle');
    feedback.setColumnWidth(newCol, 90);
    feedback.getRange(2, newCol, feedback.getMaxRows() - 1, 1).setNumberFormat('@');

    report.push('✔ 「' + SHEETS.FEEDBACK + '」已新增「餐別」欄（第 ' + newCol + ' 欄）');
  } else {
    report.push('－ 「' + SHEETS.FEEDBACK + '」已有「餐別」欄，略過');
  }

  // --- 2. 選項設定：加入三餐選項 ---
  const options = ss.getSheetByName(SHEETS.OPTIONS);
  const optionRows = options.getLastRow() - 1;
  const existingCodes = optionRows > 0
    ? options.getRange(2, 2, optionRows, 1).getValues().map(function (r) { return str(r[0]); })
    : [];

  const meals = [
    ['MEAL', 'MEAL_BREAKFAST', '早餐', 'Menu Sarapan', 1, true],
    ['MEAL', 'MEAL_LUNCH',     '午餐', 'Menu Siang',   2, true],
    ['MEAL', 'MEAL_DINNER',    '晚餐', 'Menu Sore',    3, true],
  ];

  let addedMeals = 0;
  meals.forEach(function (m) {
    if (existingCodes.indexOf(m[1]) === -1) {
      options.appendRow(m);
      addedMeals++;
    }
  });
  report.push(addedMeals > 0
    ? '✔ 「' + SHEETS.OPTIONS + '」已新增 ' + addedMeals + ' 個餐別選項'
    : '－ 「' + SHEETS.OPTIONS + '」已有餐別選項，略過');

  // --- 3. 員工名冊：補兩筆含英文字母的測試工號 ---
  // 工號可能含英文字，開發階段需要能測到這種情況。
  // ⚠️ 正式名冊貼上時會一併覆蓋掉，不用手動刪。
  const employees = ss.getSheetByName(SHEETS.EMPLOYEES);
  const empRows = employees.getLastRow() - 1;
  const existingEmps = empRows > 0
    ? employees.getRange(2, 1, empRows, 1).getValues().map(function (r) { return str(r[0]).toUpperCase(); })
    : [];

  const testEmps = [
    ['A1234',  '測試員工-英數混合', EMP_STATUS.ACTIVE],
    ['TW0567', 'Test Alphanumeric', EMP_STATUS.ACTIVE],
  ];

  let addedEmps = 0;
  testEmps.forEach(function (e) {
    if (existingEmps.indexOf(e[0].toUpperCase()) === -1) {
      const row = employees.getLastRow() + 1;
      employees.getRange(row, 1, 1, 3).setNumberFormats([['@', '@', '@']]);
      employees.getRange(row, 1, 1, 3).setValues([e]);
      addedEmps++;
    }
  });
  report.push(addedEmps > 0
    ? '✔ 「' + SHEETS.EMPLOYEES + '」已新增 ' + addedEmps + ' 筆含英文字的測試工號'
    : '－ 「' + SHEETS.EMPLOYEES + '」已有測試工號，略過');

  // --- 4. 清掉選項快取，讓新選項立刻生效 ---
  CacheService.getScriptCache().remove('options');
  report.push('✔ 選項快取已清除');

  report.push('');
  report.push('升級完成。');

  const text = report.join('\n');
  Logger.log(text);
  return text;
}


/**
 * 清除所有測試資料（正式上線前執行一次）。
 *
 * 會清空「回報資料」的所有資料列、重置案件流水號、清空錯誤日誌。
 * 分頁結構、員工名冊、選項設定都不會動到。
 *
 * ⚠️ 這是不可復原的操作。
 *    為了避免誤觸，必須先把下面的 CONFIRM 改成 true 才會執行。
 */
function clearTestData() {
  const CONFIRM = false;   // ← 確定要清除時改成 true，執行完再改回 false

  if (!CONFIRM) {
    Logger.log('未執行。請先把 clearTestData() 裡的 CONFIRM 改成 true。');
    return;
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);

  const feedback = ss.getSheetByName(SHEETS.FEEDBACK);
  const feedbackRows = feedback.getLastRow() - 1;
  if (feedbackRows > 0) feedback.deleteRows(2, feedbackRows);

  const counters = ss.getSheetByName(SHEETS.COUNTERS);
  const counterRows = counters.getLastRow() - 1;
  if (counterRows > 0) counters.deleteRows(2, counterRows);

  const logs = ss.getSheetByName(SHEETS.LOGS);
  const logRows = logs.getLastRow() - 1;
  if (logRows > 0) logs.deleteRows(2, logRows);

  Logger.log('已清除 ' + feedbackRows + ' 筆回報資料、重置流水號、清空錯誤日誌。');
  Logger.log('記得把 CONFIRM 改回 false。');
}


// ===== 輔助函式（只有這個檔案用得到）=====

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
  const root = findOrCreateFolder(DriveApp.getRootFolder(), DRIVE_ROOT_FOLDER_NAME);
  return findOrCreateFolder(root, DRIVE_IMAGE_FOLDER_NAME);
}

function findOrCreateFolder(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}


/**
 * 效能實測：11,000 筆員工名冊的查詢速度。
 *
 * 會自動建立一個暫存分頁、灌入假資料、實測查詢耗時，最後把暫存分頁刪掉。
 * **完全不會動到你的「員工名冊」分頁。**
 *
 * 執行方式：函式下拉選單選 benchmarkEmployeeLookup → 執行 → 看執行紀錄
 */
function benchmarkEmployeeLookup() {
  const ROWS = 11000;
  const TEMP_SHEET = '_效能測試_暫存';

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const report = [];

  // 上次跑到一半殘留的暫存分頁先清掉
  const leftover = ss.getSheetByName(TEMP_SHEET);
  if (leftover) ss.deleteSheet(leftover);

  const sheet = ss.insertSheet(TEMP_SHEET);

  try {
    report.push('建立 ' + ROWS + ' 筆測試名冊…');

    sheet.getRange(1, 1, 1, 3).setValues([['工號', '姓名', '狀態']]);
    sheet.getRange(2, 1, ROWS, 1).setNumberFormat('@');

    const data = [];
    for (let i = 1; i <= ROWS; i++) {
      data.push(['E' + String(i).padStart(6, '0'), 'Karyawan ' + i, EMP_STATUS.ACTIVE]);
    }

    let t = new Date().getTime();
    sheet.getRange(2, 1, ROWS, 3).setValues(data);
    SpreadsheetApp.flush();
    report.push('  寫入耗時：' + (new Date().getTime() - t) + ' ms（只有匯入名冊時會發生）');
    report.push('');

    // --- 作法一：Sheet 內建搜尋（目前系統用的）---
    // 查最後一筆 = 最壞情況
    const worstCase = 'E' + String(ROWS).padStart(6, '0');

    t = new Date().getTime();
    const found = sheet.getRange(2, 1, ROWS, 1)
      .createTextFinder(worstCase)
      .matchEntireCell(true)
      .matchCase(false)
      .findNext();
    const finderMs = new Date().getTime() - t;

    report.push('【目前系統的作法】Sheet 內建搜尋 TextFinder');
    report.push('  查詢第 ' + ROWS + ' 筆（最壞情況）：' + finderMs + ' ms');
    report.push('  找到了嗎：' + (found ? '是（第 ' + found.getRow() + ' 列）' : '否'));
    report.push('');

    // --- 作法二：全部讀進程式再比對（對照組，我們沒有用）---
    t = new Date().getTime();
    const all = sheet.getRange(2, 1, ROWS, 1).getValues();
    let hit = -1;
    for (let i = 0; i < all.length; i++) {
      if (String(all[i][0]).trim().toUpperCase() === worstCase) { hit = i + 2; break; }
    }
    const scanMs = new Date().getTime() - t;

    report.push('【對照組】把 ' + ROWS + ' 筆全部讀進程式再逐筆比對');
    report.push('  耗時：' + scanMs + ' ms' + (hit > 0 ? '（第 ' + hit + ' 列）' : ''));
    report.push('');

    report.push('結論：');
    report.push('  單次查詢約 ' + finderMs + ' ms，相較之下 Apps Script 本身的啟動就要 1000～3000 ms，');
    report.push('  所以 11,000 筆名冊對速度幾乎沒有影響。');
    report.push('  而且查過的工號會快取 1 小時，同一個人再查是即時的。');

  } finally {
    // 不管成功失敗都要把暫存分頁刪掉，不留垃圾
    ss.deleteSheet(sheet);
    report.push('');
    report.push('暫存分頁已刪除。');
  }

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
}


/**
 * 檢查員工名冊的資料品質。
 *
 * 匯入名冊後執行一次，確認格式正確、沒有重複或空白。
 *
 * 🔒 這支程式**不會輸出任何姓名或工號**，只回報數量與列號，
 *    所以執行結果可以安心分享給別人看。
 *
 * 執行方式：函式下拉選單選 checkEmployeeRoster → 執行 → 看執行紀錄
 */
function checkEmployeeRoster() {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const lastRow = sheet.getLastRow();
  const report = [];

  report.push('=== 員工名冊檢查 ===');
  report.push('');

  if (lastRow < 2) {
    report.push('名冊是空的（只有標題列）。');
    Logger.log(report.join(String.fromCharCode(10)));
    return;
  }

  const count = lastRow - 1;
  const range = sheet.getRange(2, 1, count, 3);
  const values = range.getValues();
  const formats = sheet.getRange(2, 1, count, 1).getNumberFormats();

  report.push('總筆數：' + count + ' 筆');
  report.push('');

  // --- 1. 工號欄位型別（前導零是否安全）---
  // 儲存格若是「數字」型別，0012345 會被存成 12345
  let numericCells = 0;
  let nonTextFormat = 0;
  const idLengths = {};
  const emptyIdRows = [];
  const spacedIdRows = [];
  const seen = {};
  const duplicateRows = [];

  values.forEach(function (row, i) {
    const rowNo = i + 2;
    const raw = row[0];

    if (typeof raw === 'number') numericCells++;
    if (formats[i][0] !== '@') nonTextFormat++;

    const id = String(raw === null || raw === undefined ? '' : raw);
    if (!id.trim()) {
      emptyIdRows.push(rowNo);
      return;
    }
    if (id !== id.trim()) spacedIdRows.push(rowNo);

    const key = id.trim().toUpperCase();
    idLengths[key.length] = (idLengths[key.length] || 0) + 1;

    if (seen[key]) duplicateRows.push(rowNo + '（與第 ' + seen[key] + ' 列重複）');
    else seen[key] = rowNo;
  });

  report.push('【工號格式】');
  report.push('  被存成「數字」的儲存格：' + numericCells + ' 個'
    + (numericCells > 0 ? '  ⚠️ 前導零可能已經消失，需要重貼' : '  ✅'));
  report.push('  格式不是「純文字」的儲存格：' + nonTextFormat + ' 個'
    + (nonTextFormat > 0 ? '  ⚠️ 建議整欄設為純文字後重貼' : '  ✅'));

  const lengthKeys = Object.keys(idLengths).sort(function (a, b) { return a - b; });
  report.push('  工號長度分布：' + lengthKeys.map(function (k) {
    return k + ' 碼 × ' + idLengths[k] + ' 筆';
  }).join('、'));
  report.push('');

  // --- 2. 資料完整性 ---
  const emptyNameRows = [];
  values.forEach(function (row, i) {
    if (!String(row[1] === null || row[1] === undefined ? '' : row[1]).trim()) {
      emptyNameRows.push(i + 2);
    }
  });

  report.push('【資料完整性】');
  report.push('  工號空白：' + emptyIdRows.length + ' 筆'
    + (emptyIdRows.length ? '  → 第 ' + emptyIdRows.slice(0, 10).join(', ') + ' 列' : '  ✅'));
  report.push('  姓名空白：' + emptyNameRows.length + ' 筆'
    + (emptyNameRows.length ? '  → 第 ' + emptyNameRows.slice(0, 10).join(', ') + ' 列' : '  ✅'));
  report.push('  工號前後有空白字元：' + spacedIdRows.length + ' 筆'
    + (spacedIdRows.length ? '  → 第 ' + spacedIdRows.slice(0, 10).join(', ') + ' 列' : '  ✅'));
  report.push('  工號重複：' + duplicateRows.length + ' 筆'
    + (duplicateRows.length ? '  → 第 ' + duplicateRows.slice(0, 10).join('、') : '  ✅'));
  report.push('');

  // --- 3. 狀態欄 ---
  let blankStatus = 0;
  let activeCount = 0;
  let leftCount = 0;
  let otherStatus = 0;
  values.forEach(function (row) {
    const st = String(row[2] === null || row[2] === undefined ? '' : row[2]).trim().toUpperCase();
    if (!st) blankStatus++;
    else if (st === EMP_STATUS.ACTIVE) activeCount++;
    else if (isInactiveStatus(st)) leftCount++;
    else otherStatus++;
  });

  report.push('【狀態欄】');
  report.push('  ACTIVE：' + activeCount + ' 筆');
  report.push('  INACTIVE（停用）：' + leftCount + ' 筆');
  report.push('  空白：' + blankStatus + ' 筆'
    + (blankStatus > 0 ? '　⚠️ 建議執行 normalizeEmployeeStatus() 補成 ACTIVE' : '  ✅'));
  if (otherStatus > 0) report.push('  ⚠️ 無法辨識的狀態：' + otherStatus + ' 筆');
  report.push('');

  // --- 4. 結論 ---
  const problems = numericCells + emptyIdRows.length + emptyNameRows.length
    + spacedIdRows.length + duplicateRows.length + otherStatus;

  report.push('=== 結論 ===');
  report.push(problems === 0
    ? '✅ 沒有發現問題，名冊可以使用。'
    : '⚠️ 發現 ' + problems + ' 處需要處理，詳見上方。');

  // 清掉工號查詢的快取，讓新名冊立刻生效
  const cache = CacheService.getScriptCache();
  values.forEach(function (row) {
    const id = String(row[0] === null || row[0] === undefined ? '' : row[0]).trim();
    if (id) cache.remove('emp:' + id);
  });
  report.push('（已清除工號查詢快取，新名冊立即生效）');

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
}


/**
 * 整理員工名冊的狀態欄。
 *
 * 做三件事：
 *   1. 空白的狀態補成 ACTIVE（在職）
 *   2. 舊的 LEFT 一律換成 INACTIVE
 *   3. 在狀態欄加上下拉選單，之後手動修改時不會打錯字
 *
 * 每次匯入新名冊之後執行一次即可。重複執行是安全的。
 *
 * 🔒 不會輸出任何姓名或工號。
 */
function normalizeEmployeeStatus() {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const lastRow = sheet.getLastRow();
  const report = [];

  report.push('=== 整理員工狀態欄 ===');
  report.push('');

  if (lastRow < 2) {
    report.push('名冊是空的，沒有需要處理的資料。');
    Logger.log(report.join(String.fromCharCode(10)));
    return;
  }

  const count = lastRow - 1;
  const range = sheet.getRange(2, 3, count, 1);
  const values = range.getValues();

  let filled = 0;      // 空白補成 ACTIVE
  let converted = 0;   // LEFT 換成 INACTIVE
  let untouched = 0;   // 本來就正確
  let unknown = 0;     // 認不得的值，保留原樣不動

  const updated = values.map(function (row) {
    const current = str(row[0]).toUpperCase();

    if (!current)                        { filled++;    return [EMP_STATUS.ACTIVE]; }
    if (current === 'LEFT')              { converted++; return [EMP_STATUS.INACTIVE]; }
    if (current === EMP_STATUS.ACTIVE ||
        current === EMP_STATUS.INACTIVE) { untouched++; return [current]; }

    // 認不得的值不要自作主張改掉，讓管理者自己判斷
    unknown++;
    return [row[0]];
  });

  range.setValues(updated);

  report.push('空白補成 ACTIVE：' + filled + ' 筆');
  report.push('LEFT 換成 INACTIVE：' + converted + ' 筆');
  report.push('本來就正確：' + untouched + ' 筆');
  report.push('無法辨識而保留原樣：' + unknown + ' 筆'
    + (unknown > 0 ? '  ⚠️ 請自行確認這些列' : ''));
  report.push('');

  // --- 加上下拉選單，避免手動修改時打錯字 ---
  // 刻意允許不符合的值（setAllowInvalid(true)）：
  // 若設成「拒絕輸入」，日後貼上 11,000 筆名冊時會整批被擋下來。
  // 這裡只要「打錯字時看得出來」就夠了。
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([EMP_STATUS.ACTIVE, EMP_STATUS.INACTIVE], true)
    .setAllowInvalid(true)
    .setHelpText('在職請選 ACTIVE，離職或異常請選 INACTIVE')
    .build();

  sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  report.push('✔ 狀態欄已加上下拉選單（ACTIVE / INACTIVE）');
  report.push('  貼上新名冊時不會被擋，但打錯字會出現紅色標記');
  report.push('');

  // 狀態改變會影響能不能提交回報，快取要一併清掉
  const empIds = sheet.getRange(2, 1, count, 1).getValues();
  const cache = CacheService.getScriptCache();
  empIds.forEach(function (row) {
    const id = str(row[0]);
    if (id) cache.remove('emp:' + id);
  });
  report.push('✔ 已清除工號查詢快取，變更立即生效');

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
}
