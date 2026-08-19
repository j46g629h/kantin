/**
 * API 進入點與路由
 *
 * 所有請求都經過這裡：
 *   GET  → 網址帶 ?action=xxx
 *   POST → body 是 JSON，裡面有 action 欄位
 *
 * ⚠️ CORS 注意：前端送 POST 時 Content-Type 必須是 text/plain，
 *    因為 Apps Script 不支援 doOptions，用 application/json 會被瀏覽器擋掉。
 */


/** 處理 GET 請求 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  return handleRequest(params);
}

/** 處理 POST 請求 */
function doPost(e) {
  let body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    logError('doPost', '', err, { raw: e && e.postData ? e.postData.contents : '' });
    return jsonResponse(fail('BAD_JSON', '請求格式錯誤'));
  }
  return handleRequest(body);
}


/**
 * 路由表：action 名稱 → 處理函式
 *
 * 這裡用「包一層」的寫法（p => xxx(p)）而不是直接寫函式名稱，
 * 是為了避免 Apps Script 檔案載入順序造成的「函式尚未定義」問題。
 */
const ROUTES = {
  ping:           function (p) { return handlePing(p); },
  getOptions:     function (p) { return getOptions(p); },
  verifyEmployee: function (p) { return verifyEmployee(p); },
  submitFeedback: function (p) { return submitFeedback(p); },
  getCaseById:     function (p) { return getCaseById(p); },
  getCasesByEmpId: function (p) { return getCasesByEmpId(p); },
};


/**
 * 共用的請求處理流程。
 * 不論成功失敗都回傳統一格式，錯誤會自動寫進錯誤日誌。
 */
function handleRequest(params) {
  const action = str(params.action) || 'ping';
  const handler = ROUTES[action];

  if (!handler) {
    return jsonResponse(fail('UNKNOWN_ACTION', '不支援的動作：' + action));
  }

  try {
    return jsonResponse(handler(params));
  } catch (err) {
    logError(action, str(params.empId || params.emp_id), err, params);
    // 不把技術細節回傳給前端，避免洩漏系統資訊
    return jsonResponse(fail('SERVER_ERROR', '系統發生錯誤，請稍後再試'));
  }
}


/** 健康檢查：直接用瀏覽器打開 API 網址就會看到這個 */
function handlePing(params) {
  return ok({
    message:  'PCI 餐廳回饋系統 API 運作中',
    time:     formatTime(new Date()),
    timezone: Session.getScriptTimeZone(),
    actions:  Object.keys(ROUTES),
  });
}
