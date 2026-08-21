/**
 * 共用工具函式
 *
 * 回應格式、Sheet 存取、時間格式化、錯誤記錄。
 */


// ===== API 回應格式 =====

/**
 * 成功的回應。
 * 前端拿到的會是 { ok: true, data: {...} }
 */
function ok(data) {
  return { ok: true, data: data || {} };
}

/**
 * 失敗的回應。
 *
 * @param {string} code    錯誤代碼，給程式判斷用（如 EMP_NOT_FOUND）
 * @param {string} message 錯誤訊息，給人看的
 * @param {Object} extra   選填的補充資料（如剩餘嘗試次數）。
 *
 * 為什麼要有 extra：前端顯示的文字是用 error 代碼查 i18n 翻譯的，
 * 後端的中文 message 不會直接給印尼文使用者看。
 * 「還可以試 3 次」這種帶數字的訊息，數字必須另外傳，前端才能填進自己的譯文。
 */
function fail(code, message, extra) {
  const result = { ok: false, error: code, message: message || '' };
  if (extra) result.data = extra;
  return result;
}

/** 把回應物件包成 Apps Script 的 JSON 輸出 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ===== Sheet 存取 =====

/** 取得試算表本身 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

/**
 * 依名稱取得分頁，找不到就丟出明確的錯誤。
 * @param {string} name 用 SHEETS.XXX，不要直接寫字串
 */
function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('找不到分頁「' + name + '」，請先執行 setupSheets()');
  }
  return sheet;
}

/**
 * 建立「欄位代碼 → 欄號」的對照表。
 *
 * 為什麼要這樣做：直接寫死「案件編號是第 1 欄」的話，
 * 只要有人在 Sheet 插入一欄，所有欄號就全錯了。
 * 改成每次讀表頭再對應，就不怕欄位順序被動過。
 *
 * @return {Object} 例如 { case_id: 1, submit_time: 2, ... }
 */
function getFeedbackColumnMap() {
  return buildColumnMap(SHEETS.FEEDBACK, FEEDBACK_COLUMNS);
}

/** 管理者名單的「欄位代碼 → 欄號」對照表 */
function getAdminColumnMap() {
  return buildColumnMap(SHEETS.ADMINS, ADMIN_COLUMNS);
}

/**
 * 依表頭建立「欄位代碼 → 欄號」對照表（各分頁共用）。
 *
 * @param {string} sheetName  分頁名稱，用 SHEETS.XXX
 * @param {Array}  columnDefs 欄位定義，用 Config.js 裡的 XXX_COLUMNS
 * @return {Object} 例如 { case_id: 1, submit_time: 2, ... }
 */
function buildColumnMap(sheetName, columnDefs) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const map = {};
  columnDefs.forEach(function (col) {
    const index = headers.indexOf(col.name);

    if (index === -1) {
      // 標了 optional 的欄位找不到就跳過，不要丟例外。
      //
      // ⚠️ 這是線上事故 1 的解藥（見 CLAUDE.md 設計約定第 12 條）：
      //    那次把新欄位加進 ADMIN_COLUMNS 就直接部署，Sheet 上還沒有那一欄，
      //    這裡一丟例外，連登入都進不去。
      //
      //    標成 optional 的話，順序就不重要了——程式可以先部署（該功能暫時不顯示），
      //    使用者跑完升級程式才開始生效。
      //
      //    呼叫端一定要檢查 `if (colMap.xxx)` 再用，因為它可能是 undefined。
      if (col.optional) return;
      throw new Error('「' + sheetName + '」分頁缺少欄位：' + col.name);
    }
    map[col.code] = index + 1;  // Sheet 的欄號從 1 開始
  });
  return map;
}


/**
 * 依欄位定義把一整列寫進 Sheet。
 *
 * ⚠️ 兩個都很重要：
 *
 * 1. **先設格式再寫值。** 直接寫值的話 Sheet 會自己判斷型別——
 *    工號 0012345 會變成 12345，64 位數的密碼雜湊會變成科學記號。
 *
 * 2. **依表頭決定欄位位置，不可假設順序。**
 *    早期版本是照 columnDefs 的順序從第 1 欄寫到第 N 欄，
 *    只要 Sheet 上多一欄、少一欄或順序被動過，資料就會整批錯位寫進隔壁欄，
 *    而且完全不會報錯。
 *
 * @param {Sheet}  sheet      目標分頁
 * @param {string} sheetName  分頁名稱（用來查表頭）
 * @param {number} row        列號（1 起算）
 * @param {Array}  columnDefs 欄位定義
 * @param {Object} data       { 欄位代碼: 值 }，沒給的欄位留空字串
 */
function writeRowByColumns(sheet, sheetName, row, columnDefs, data) {
  const colMap = buildColumnMap(sheetName, columnDefs);

  columnDefs.forEach(function (col) {
    const colIndex = colMap[col.code];

    // 選填欄位在 Sheet 上還不存在時，colMap 裡就沒有它。
    //
    // ⚠️ 這個檢查不可以拿掉。少了它，getRange(row, undefined) 會丟出例外，
    //    「新增管理者」會在使用者跑升級程式之前整支壞掉——
    //    而那正是 optional 欄位本來要避免的事。
    //    （本機測試的假 Sheet 不會報錯，這個洞是靠測試斷言才抓出來的。）
    if (!colIndex) return;

    const value = data[col.code];
    const cell  = sheet.getRange(row, colIndex);

    cell.setNumberFormat(col.format);                                  // 先設格式
    cell.setValue((value === undefined || value === null) ? '' : value); // 再寫值
  });
}


/**
 * 把日期寫進單一儲存格（先設格式再寫值）。
 * 與 setTextCell() 成對使用，見 gas/Auth.js。
 */
function setDateCell(sheet, row, col, date) {
  const cell = sheet.getRange(row, col);
  cell.setNumberFormat('yyyy-mm-dd hh:mm:ss');
  cell.setValue(date || new Date());
}


// ===== 時間 =====

/** 依專案時區格式化時間（yyyy-MM-dd HH:mm:ss） */
function formatTime(date) {
  return Utilities.formatDate(date || new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

/** 取得目前年月，格式 YYYYMM（案件編號用） */
function currentYearMonth() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMM');
}


// ===== 錯誤記錄 =====

/**
 * 把錯誤寫進「錯誤日誌」分頁。
 *
 * 員工回報「送不出去」時，這張表是唯一的線索來源。
 * 注意：記錄失敗本身不可以再丟出錯誤，否則會蓋掉原本的問題。
 *
 * @param {string} source 來源（哪一支 API）
 * @param {string} empId  工號，沒有就傳空字串
 * @param {Error|string} error 錯誤物件或訊息
 * @param {Object} payload 當時的請求內容
 */
function logError(source, empId, error, payload) {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEETS.LOGS);
    if (!sheet) return;

    let detail = '';
    try {
      detail = JSON.stringify(payload || {}).substring(0, 500);
    } catch (e) {
      detail = '(無法序列化)';
    }

    sheet.appendRow([
      new Date(),
      source || '',
      empId || '',
      (error && error.stack) ? String(error.stack).substring(0, 500) : String(error).substring(0, 500),
      detail
    ]);
  } catch (e) {
    // 連記錄都失敗就只能寫進 Apps Script 自己的執行紀錄
    Logger.log('logError 失敗: ' + e);
  }
}


// ===== 其他 =====

/** 判斷員工狀態是否為停用（空白、ACTIVE、無法辨識的值都算在職） */
function isInactiveStatus(status) {
  return EMP_STATUS_INACTIVE_CODES.indexOf(str(status).toUpperCase()) !== -1;
}


/** 安全地轉成去頭尾空白的字串（null / undefined 會變成空字串） */
function str(value) {
  return (value === null || value === undefined) ? '' : String(value).trim();
}
