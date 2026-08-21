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
 *
 * 需要登入的 API 一律用 withAuth() 包起來（見 gas/Auth.js）：
 * 這樣「檢查 token」就不會變成每支函式各寫一次、而總有一支會忘記寫的事情。
 */
const ROUTES = {

  // --- 員工端（不需登入）---
  ping:            function (p) { return handlePing(p); },
  getOptions:      function (p) { return getOptions(p); },
  verifyEmployee:  function (p) { return verifyEmployee(p); },
  submitFeedback:  function (p) { return submitFeedback(p); },
  getCaseById:     function (p) { return getCaseById(p); },
  getCasesByEmpId: function (p) { return getCasesByEmpId(p); },

  // --- 管理端：登入相關 ---
  adminLogin:  function (p) { return adminLogin(p); },
  adminLogout: function (p) { return adminLogout(p); },

  // --- 管理端：需要 token ---
  getAdminProfile:     function (p) { return withAuth(p, function (s) { return getAdminProfile(p, s); }); },
  adminChangePassword: function (p) { return withAuth(p, function (s) { return adminChangePassword(p, s); }); },
  getCaseList:         function (p) { return withAuth(p, function (s) { return getCaseList(p, s); }); },
  getTemplates:        function (p) { return withAuth(p, function (s) { return getTemplates(p, s); }); },
  getAdminOptions:     function (p) { return withAuth(p, function (s) { return getAdminOptions(p, s); }); },
  updateCase:          function (p) { return withAuth(p, function (s) { return updateCase(p, s); }); },
};


/**
 * 不可以寫進錯誤日誌的參數名稱。
 *
 * 錯誤日誌會把整包請求內容存下來方便排查，
 * 但密碼與 token 進了 Sheet 就等於明文外洩，必須先遮掉。
 */
const SENSITIVE_PARAMS = ['password', 'old_password', 'new_password', 'token'];


/** 把敏感欄位遮成 ***，其餘照原樣，供錯誤日誌使用 */
function maskSensitive(params) {
  const safe = {};
  Object.keys(params || {}).forEach(function (key) {
    safe[key] = (SENSITIVE_PARAMS.indexOf(key) >= 0 && params[key]) ? '***' : params[key];
  });
  return safe;
}


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
    logError(action, str(params.empId || params.emp_id), err, maskSensitive(params));
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
