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
      throw new Error('「' + sheetName + '」分頁缺少欄位：' + col.name);
    }
    map[col.code] = index + 1;  // Sheet 的欄號從 1 開始
  });
  return map;
}


/**
 * 依欄位定義把一整列寫進 Sheet。
 *
 * ⚠️ 順序很重要：一定要先設格式再寫值。
 *    直接寫值的話，Sheet 會自己判斷型別——
 *    工號 0012345 會變成 12345，64 位數的密碼雜湊會變成科學記號。
 *
 * @param {Sheet}  sheet      目標分頁
 * @param {number} row        列號（1 起算）
 * @param {Array}  columnDefs 欄位定義
 * @param {Object} data       { 欄位代碼: 值 }，沒給的欄位留空字串
 */
function writeRowByColumns(sheet, row, columnDefs, data) {
  const values  = columnDefs.map(function (c) {
    const v = data[c.code];
    return (v === undefined || v === null) ? '' : v;
  });
  const formats = columnDefs.map(function (c) { return c.format; });

  const range = sheet.getRange(row, 1, 1, columnDefs.length);
  range.setNumberFormats([formats]);   // 先設格式
  range.setValues([values]);           // 再寫值
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
