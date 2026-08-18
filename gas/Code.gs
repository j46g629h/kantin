/**
 * PCI 餐廳回饋系統 — 後端 API
 * 第 1 階段：最小可行版本（只驗證「網頁 → 後端 → Sheet」這條路走得通）
 *
 * ⚠️ 這個檔案是備份用。實際執行的程式碼在 Google Apps Script 線上編輯器裡。
 *    每次在線上改完，請把內容複製回這個檔案，然後 git commit。
 */

// ===== 設定區（只有這裡需要你填）=====

// 你的 Google Sheet ID
// 從網址列複製：https://docs.google.com/spreadsheets/d/【這一段就是 ID】/edit
const SHEET_ID = '請貼上你的_SHEET_ID';

// 分頁名稱
const SHEET_NAME = '回報資料';


// ===== API 進入點 =====

/**
 * 處理 GET 請求。
 * 用途：部署完成後，直接用瀏覽器打開 API 網址測試後端有沒有活著。
 */
function doGet(e) {
  return jsonResponse({
    ok: true,
    message: 'PCI 餐廳回饋系統 API 運作中',
    time: formatTime(new Date())
  });
}

/**
 * 處理 POST 請求。
 * 用途：接收前端表單資料，寫入 Google Sheet。
 */
function doPost(e) {
  try {
    // 前端送來的是純文字，這裡把它還原成物件
    // （為什麼不用 application/json？見 docs/規格書_v2.md §七 的 CORS 說明）
    var body = JSON.parse(e.postData.contents);

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('找不到名為「' + SHEET_NAME + '」的分頁，請檢查分頁名稱是否正確');
    }

    sheet.appendRow([
      new Date(),
      body.emp_id || '',
      body.description || ''
    ]);

    return jsonResponse({
      ok: true,
      data: { message: '寫入成功' }
    });

  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'SERVER_ERROR',
      message: String(err)
    });
  }
}


// ===== 共用工具 =====

/** 把物件包成 JSON 回應 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 依系統時區格式化時間 */
function formatTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}


// ===== 測試用（在編輯器裡直接執行）=====

/**
 * 在 Apps Script 編輯器裡選這個函式按「執行」。
 *
 * 目的有兩個：
 *   1. 第一次執行會跳出授權視窗，先把權限給完，之後部署才不會卡住
 *   2. 確認 SHEET_ID 填對了、分頁名稱沒打錯
 *
 * 執行成功後，去 Sheet 看有沒有多一列「測試寫入」。
 */
function testWrite() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  sheet.appendRow([new Date(), 'TEST001', '測試寫入 — 從編輯器執行']);
  Logger.log('✅ 寫入成功，請到 Sheet 確認');
  Logger.log('目前時區：' + Session.getScriptTimeZone());
}
