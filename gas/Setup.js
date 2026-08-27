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
  storeRemove('options');
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


/**
 * 升級：建立第 3 階段（管理者端）需要的兩個分頁。
 *
 *   - 管理者名單：帳號、密碼雜湊、角色、狀態
 *   - 回覆範本：管理者回覆案件時可一鍵帶入的常用句
 *
 * 重複執行是安全的：已存在的分頁只會略過，不會覆蓋。
 *
 * 執行方式：上方函式下拉選單選 setupAdminSheets → 按執行 → 看執行紀錄
 */
function setupAdminSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const report = [];

  // --- 1. 管理者名單 ---
  const admins = getOrCreateSheet(ss, SHEETS.ADMINS);
  if (admins.getLastRow() === 0) {
    const headers = ADMIN_COLUMNS.map(function (c) { return c.name; });
    admins.getRange(1, 1, 1, headers.length).setValues([headers]);

    ADMIN_COLUMNS.forEach(function (col, i) {
      const colIndex = i + 1;
      admins.setColumnWidth(colIndex, col.width);
      admins.getRange(2, colIndex, admins.getMaxRows() - 1, 1).setNumberFormat(col.format);
    });

    styleHeader(admins, headers.length);

    // 角色與狀態加下拉選單，手動編輯時不會打錯字
    const colMap = getAdminColumnMap();
    setDropdown(admins, colMap.role,           [ADMIN_ROLES.SUPER, ADMIN_ROLES.ADMIN]);
    setDropdown(admins, colMap.status,         [ADMIN_STATUS.ACTIVE, ADMIN_STATUS.DISABLED]);
    setDropdown(admins, colMap.must_change_pw, ['TRUE', 'FALSE']);

    report.push('✔ 建立「' + SHEETS.ADMINS + '」（' + headers.length + ' 欄）');
    report.push('    密碼雜湊與鹽值欄已設為純文字，不會被存成科學記號');
  } else {
    report.push('－ 「' + SHEETS.ADMINS + '」已存在，略過');
  }

  // --- 2. 回覆範本 ---
  const templates = getOrCreateSheet(ss, SHEETS.TEMPLATES);
  if (templates.getLastRow() === 0) {
    const headers = TEMPLATE_COLUMNS.map(function (c) { return c.name; });
    templates.getRange(1, 1, 1, headers.length).setValues([headers]);

    TEMPLATE_COLUMNS.forEach(function (col, i) {
      const colIndex = i + 1;
      templates.setColumnWidth(colIndex, col.width);
      templates.getRange(2, colIndex, templates.getMaxRows() - 1, 1).setNumberFormat(col.format);
    });

    styleHeader(templates, headers.length);

    // 規格 §3.5 的初始範本。管理者日後自己在這張表增修，不需要改程式
    const seed = [
      ['TPL_01', 'CAT_TASTE',    '已轉知廚房調整口味，感謝您的建議。',
       'Sudah disampaikan ke dapur untuk perbaikan rasa. Terima kasih atas sarannya.'],
      ['TPL_02', 'CAT_HYGIENE',  '已加強該區域清潔頻率。',
       'Frekuensi pembersihan area tersebut sudah ditingkatkan.'],
      ['TPL_03', 'CAT_FACILITY', '已安排維修，預計三日內完成。',
       'Perbaikan sudah dijadwalkan, diperkirakan selesai dalam 3 hari.'],
    ];
    templates.getRange(2, 1, seed.length, headers.length).setValues(seed);

    report.push('✔ 建立「' + SHEETS.TEMPLATES + '」並帶入 ' + seed.length + ' 筆初始範本');
  } else {
    report.push('－ 「' + SHEETS.TEMPLATES + '」已存在，略過');
  }

  report.push('');
  report.push('完成。下一步請執行 createSuperAdmin() 建立你自己的管理者帳號。');

  const text = report.join('\n');
  Logger.log(text);
  return text;
}


/**
 * 建立超級管理者帳號（第一個管理者，只需執行一次）。
 *
 * ⚠️ 初始密碼是「程式隨機產生」的，執行後會印在下方的執行紀錄裡。
 *    刻意不讓你把密碼打在程式碼中——這個檔案會跟著 git 上傳到 GitHub，
 *    寫在這裡就等於公開。
 *
 * 使用步驟：
 *   1. 把下面的 ACCOUNT / NAME / EMAIL 改成你自己的
 *   2. 上方函式下拉選單選 createSuperAdmin → 按執行
 *   3. 從執行紀錄複製那組隨機密碼
 *   4. 到 admin.html 登入，系統會強制你立刻改成自己的密碼
 */
function createSuperAdmin() {
  // ← 改這三行（都不是機密，可以安心留在程式碼裡）
  const ACCOUNT = 'j46g629h@gmail.com';
  const NAME    = '系統管理者';
  const EMAIL   = 'j46g629h@gmail.com';

  return addAdminAccount(ACCOUNT, NAME, EMAIL, ADMIN_ROLES.SUPER);
}


/**
 * 新增一個管理者帳號，並回報隨機產生的初始密碼。
 *
 * 第 3-5 關做完帳號管理頁之後，日常新增管理者請用網頁介面，
 * 這支函式留著當作「超級管理者把自己鎖在門外」時的救援管道。
 *
 * @return {string} 執行報告（含初始密碼）
 */
function addAdminAccount(account, name, email, role) {
  const sheet = getSheet(SHEETS.ADMINS);
  const acct  = str(account).toLowerCase();

  if (!acct) throw new Error('帳號不可空白');

  if (findAdminByAccount(acct)) {
    const msg = '帳號「' + acct + '」已存在，沒有重複建立。\n'
              + '忘記密碼請改執行 resetAdminPassword()。';
    Logger.log(msg);
    return msg;
  }

  const password = generateInitialPassword();
  const salt     = generateSalt();
  const row      = sheet.getLastRow() + 1;

  writeRowByColumns(sheet, SHEETS.ADMINS, row, ADMIN_COLUMNS, {
    name:           str(name) || acct,
    account:        acct,
    email:          str(email),
    password_hash:  hashPassword(password, salt),
    password_salt:  salt,
    role:           normalizeRole(role),
    status:         ADMIN_STATUS.ACTIVE,
    must_change_pw: 'TRUE',          // 首次登入強制改密碼（規格 §5.5）
    created_at:     new Date(),
    last_login_at:  '',
  });

  const msg = [
    '✔ 已建立管理者帳號',
    '',
    '  帳號：' + acct,
    '  角色：' + normalizeRole(role),
    '  初始密碼：' + password,
    '',
    '⚠️ 請立刻用這組密碼登入 admin.html，系統會要求你馬上改掉。',
    '   密碼只會出現在這一次的執行紀錄，關掉就看不到了（Sheet 裡只存雜湊，查不回來）。',
    '   若沒記下來，重新執行 resetAdminPassword() 產生一組新的即可。',
  ].join('\n');

  Logger.log(msg);
  return msg;
}


/**
 * 重設某個管理者的密碼（救援用）。
 *
 * 適用情境：忘記密碼、或連續輸錯被鎖住又等不及 15 分鐘。
 * 會產生一組新的隨機密碼，並要求對方下次登入立刻改掉。
 */
function resetAdminPassword() {
  const ACCOUNT = 'j46g629h@gmail.com';   // ← 改成要重設的帳號

  const admin = findAdminByAccount(ACCOUNT);
  if (!admin) {
    const msg = '查無帳號「' + ACCOUNT + '」。';
    Logger.log(msg);
    return msg;
  }

  const password = generateInitialPassword();
  setAdminPassword(admin.row, password, true);   // true = 下次登入強制改密碼

  /**
   * ⚠️ 一定要作廢舊 token（設計約定第 14 條）。
   *
   *    `withAuth()` 只讀 token 裡的 session 快照，不會回頭查 Sheet——
   *    所以改了密碼之後，**舊的 token 在 6 小時內照樣能用**。
   *
   *    而這支函式最常用的情境正好是「忘記密碼」或「懷疑帳號被盜」，
   *    後者正是最不能讓舊 session 活著的時候。
   *
   *    ⚠️ 管理端的 adminOpResetPassword() 本來就有做這件事，
   *       但這支 Apps Script 的救援函式漏了。兩條路徑要一致。
   */
  const revoked = revokeSessionsForAccount(str(ACCOUNT).toLowerCase());

  // 順便解除登入鎖定，不必再等 15 分鐘
  clearLoginFailures(str(ACCOUNT).toLowerCase());

  const msg = [
    '✔ 已重設密碼',
    '',
    '  帳號：' + str(admin.account),
    '  新密碼：' + password,
    '',
    '登入鎖定已解除；舊的登入狀態也已作廢（' + revoked + ' 個）。',
    '這組密碼只會出現這一次。',
  ].join('\n');

  Logger.log(msg);
  return msg;
}


/**
 * 產生一組隨機初始密碼。
 *
 * 12 碼，一定含英文字母與數字（符合規格 §5.5 的密碼規則）。
 * 字元集刻意排除 0 O 1 l I，避免抄下來時看錯而登不進去。
 */
function generateInitialPassword() {
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const DIGITS  = '23456789';
  const ALL     = LETTERS + DIGITS;

  // 先各放一個，確保一定同時含字母與數字
  const chars = [pickRandom(LETTERS), pickRandom(DIGITS)];
  for (let i = 0; i < 10; i++) chars.push(pickRandom(ALL));

  // 洗牌，否則開頭永遠是「字母 + 數字」的固定樣式
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
  }
  return chars.join('');
}

/** 從字串裡隨機挑一個字元 */
function pickRandom(source) {
  return source.charAt(Math.floor(Math.random() * source.length));
}


/** 把某一欄設成下拉選單（第 2 列以下） */
function setDropdown(sheet, col, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}


/**
 * 建立初始的「處理者」名單。
 *
 * 處理者放在「選項設定」分頁（類型填 HANDLER），跟餐廳、問題分類同一套機制。
 * 這支函式只是幫你把現有的管理者帶進去當起點，
 * **之後你直接在「選項設定」分頁增修就好，不必再執行這支程式**：
 *
 *   類型      代碼      中文顯示    印尼文顯示   排序  啟用
 *   HANDLER   HDL_04    陳大廚      Chef Chen    4     TRUE
 *
 * 說明：
 *   - 代碼隨你取，只要不重複（建議沿用 HDL_ 開頭）
 *   - 中文顯示 = 要給大家看的名字。姓名不需要翻譯，兩欄填一樣即可
 *   - 某人離職時把「啟用」改成 FALSE，**不要刪除該列**，
 *     否則他以前處理過的案件會查不到名字
 *
 * 重複執行是安全的：已存在的代碼會略過。
 */
function setupHandlerOptions() {
  const options = getSheet(SHEETS.OPTIONS);
  const lastRow = options.getLastRow();

  const existingCodes = lastRow > 1
    ? options.getRange(2, 2, lastRow - 1, 1).getValues().map(function (r) { return str(r[0]).toUpperCase(); })
    : [];

  // 用現有的管理者當起點
  const admins = readAllAdmins().filter(function (a) {
    return str(a.status).toUpperCase() === ADMIN_STATUS.ACTIVE;
  });

  if (!admins.length) {
    const msg = '管理者名單裡沒有啟用中的帳號，沒有可帶入的處理者。\n'
              + '你也可以直接到「選項設定」分頁自己加，類型填 HANDLER。';
    Logger.log(msg);
    return msg;
  }

  const report = [];
  let added = 0;

  admins.forEach(function (admin, i) {
    const code = 'HDL_' + ('0' + (i + 1)).slice(-2);
    if (existingCodes.indexOf(code) !== -1) {
      report.push('－ ' + code + ' 已存在，略過');
      return;
    }

    const name = str(admin.name) || str(admin.account);
    // 姓名不需要翻譯，中印兩欄填一樣
    options.appendRow([HANDLER_OPTION_TYPE, code, name, name, i + 1, true]);
    report.push('✔ ' + code + '  ' + name);
    added++;
  });

  // 清掉快取，新名單立刻生效，不用等 10 分鐘
  storeRemove('options');

  report.push('');
  report.push(added > 0 ? '完成，新增 ' + added + ' 位處理者。' : '沒有新增任何項目。');
  report.push('');
  report.push('之後要增減處理者，直接到「選項設定」分頁加一列就好：');
  report.push('  類型 HANDLER ／ 代碼自取 ／ 中文與印尼文都填姓名 ／ 排序 ／ 啟用 TRUE');
  report.push('離職的人請把「啟用」改成 FALSE，不要刪除該列，');
  report.push('否則他以前處理過的案件會查不到名字。');
  report.push('（改完最多 10 分鐘生效，想立刻生效可執行 clearOptionsCache()）');

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
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
  values.forEach(function (row) {
    const id = String(row[0] === null || row[0] === undefined ? '' : row[0]).trim();
    if (id) storeRemove('emp:' + id);
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
  empIds.forEach(function (row) {
    const id = str(row[0]);
    if (id) storeRemove('emp:' + id);
  });
  report.push('✔ 已清除工號查詢快取，變更立即生效');

  const text = report.join(String.fromCharCode(10));
  Logger.log(text);
  return text;
}


/**
 * 升級：在「管理者名單」加上「密碼最後變更時間」欄位。
 *
 * 為什麼需要它：管理者名單上看不出「我剛剛重設的密碼有沒有生效」。
 * 密碼本身是查不回來的（Sheet 存的是單向雜湊），
 * 能給的最有用的資訊就是「這組密碼是什麼時候換的」。
 *
 * ⚠️ 這一欄在 ADMIN_COLUMNS 裡標了 `optional: true`，
 *    所以「先部署程式、後跑這支升級」是安全的——
 *    還沒跑之前，帳號管理頁只是不顯示這個時間，其他功能完全正常。
 *    這正是線上事故 1（加了欄位就部署，導致完全無法登入）的正確作法。
 *
 * 重複執行不會有事：已經有這一欄就直接跳過。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 migrateAddPasswordChangedAt → 按 ▷ → 看執行紀錄
 */
function migrateAddPasswordChangedAt() {
  const sheet   = getSheet(SHEETS.ADMINS);
  const column  = ADMIN_COLUMNS.filter(function (c) { return c.code === 'password_changed_at'; })[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (headers.indexOf(column.name) !== -1) {
    const msg = '－ 「' + column.name + '」欄位已存在，不需要升級。';
    Logger.log(msg);
    return msg;
  }

  // 加在最後一欄。writeRowByColumns() 是依表頭定位的，
  // 所以位置放哪都不影響寫入正確性（設計約定第 12 條）
  const col = sheet.getLastColumn() + 1;

  sheet.getRange(1, col).setValue(column.name);
  sheet.setColumnWidth(col, column.width);
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setNumberFormat(column.format);

  // 表頭樣式跟其他欄一致
  const headerRange = sheet.getRange(1, 1, 1, col);
  headerRange.setFontWeight('bold');

  const msg = [
    '✔ 已新增「' + column.name + '」欄位（第 ' + col + ' 欄）',
    '',
    '既有帳號這一欄是空的，這是正常的——',
    '系統不知道他們的密碼是什麼時候設的，只能從下一次變更開始記錄。',
    '',
    '之後任何一次「重設密碼」或「變更密碼」都會自動填上時間。',
  ].join('\n');

  Logger.log(msg);
  return msg;
}


/**
 * 把「錯誤日誌」最近幾筆印在執行紀錄上（維運工具）。
 *
 * 為什麼需要它：排程出錯時沒有人在場，錯誤只會躺在 Sheet 裡，
 * 而錯誤欄裡是一長串堆疊訊息，在儲存格裡幾乎讀不了。
 * 印在執行紀錄上就能整段看完、整段複製。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 showRecentErrors → 按 ▷ → 看執行紀錄
 */
function showRecentErrors() {
  const COUNT = 5;   // 要看更多就把這個數字改大

  const sheet = getSpreadsheet().getSheetByName(SHEETS.LOGS);
  if (!sheet) {
    const msg = '找不到「' + SHEETS.LOGS + '」分頁。';
    Logger.log(msg);
    return msg;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    const msg = '錯誤日誌是空的，目前沒有任何錯誤紀錄。';
    Logger.log(msg);
    return msg;
  }

  const start = Math.max(2, lastRow - COUNT + 1);
  const rows  = sheet.getRange(start, 1, lastRow - start + 1, 5).getValues();

  const report = ['===== 錯誤日誌最近 ' + rows.length + ' 筆（新的在最下面）====='];

  rows.forEach(function (row, i) {
    report.push('');
    report.push('--- 第 ' + (start + i) + ' 列 ---');
    report.push('時間：' + row[0]);
    report.push('來源：' + row[1]);
    report.push('錯誤：' + row[3]);
    report.push('內容：' + row[4]);
  });

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}


/**
 * 檢查寄信功能本身能不能用（維運工具）。
 *
 * 把「寄信」和「產生信件內容」拆開來各測一次，
 * 這樣才分得出來是權限 / 額度的問題，還是信件內容的程式出錯。
 * 兩者的解法完全不同，混在一起看只會多繞路。
 */
function checkMailSetup() {
  const report = ['===== 寄信環境檢查 ====='];

  // 1. 額度
  try {
    report.push('今日剩餘可寄收件人數：' + MailApp.getRemainingDailyQuota());
  } catch (e) {
    report.push('❌ 讀不到寄信額度：' + e);
  }

  // 2. 收件人
  try {
    const recipients = getReportRecipients();
    report.push('收件人 ' + recipients.length + ' 位：'
      + recipients.map(function (r) { return r.name + ' <' + r.email + '>'; }).join('、'));
  } catch (e) {
    report.push('❌ 取收件人失敗：' + e);
  }

  // 3. 產生信件內容（不寄出）——內容出錯的話問題在這裡，不在寄信
  try {
    const daily = buildDailyReport();
    const html  = buildDailyReportHtml(daily, '測試');
    report.push('信件內容產生成功，長度 ' + html.length + ' 字元；'
      + '未處理 ' + daily.total + ' 件、逾期 ' + daily.overdue + ' 件。');
  } catch (e) {
    report.push('❌ 產生信件內容失敗：' + e);
    report.push('   ' + (e.stack || ''));
  }

  // 4. 真的寄一封給自己
  try {
    const me = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to:       me,
      subject:  '[Kantin PCI] 寄信測試',
      htmlBody: '<p>這是一封測試信。收得到就表示寄信功能正常。</p>',
      name:     REPORT.SENDER_NAME,
    });
    report.push('✔ 已寄一封測試信給 ' + me + '，請去信箱確認。');
  } catch (e) {
    report.push('❌ 寄信失敗：' + e);
  }

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}
