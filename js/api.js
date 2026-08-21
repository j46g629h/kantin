/**
 * 後端 API 呼叫
 *
 * 所有跟 Apps Script 溝通的程式碼都集中在這裡，
 * 頁面只要呼叫 Api.xxx()，不用重複處理 fetch 的細節。
 */

const Api = {

  /**
   * GET 請求。
   * @param {string} action 動作名稱
   * @param {Object} params 其他參數
   */
  async get(action, params = {}) {
    const query = new URLSearchParams({ action, ...params }).toString();
    const response = await fetch(`${API_URL}?${query}`);
    return response.json();
  },

  /**
   * POST 請求。
   *
   * ⚠️ Content-Type 必須是 text/plain。
   *    用 application/json 會觸發瀏覽器的預檢請求(preflight)，
   *    而 Apps Script 不支援 doOptions，請求會直接被擋掉。
   */
  async post(payload) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return response.json();
  },


  // ===== 各支 API 的包裝 =====

  /** 取得選項清單（地點 / 分類 / 狀態） */
  getOptions() {
    return this.get('getOptions');
  },

  /** 驗證工號，回傳姓名 */
  verifyEmployee(empId) {
    return this.get('verifyEmployee', { empId });
  },

  /** 提交回報 */
  submitFeedback(data) {
    return this.post({ action: 'submitFeedback', ...data });
  },

  /** 依案件編號查單筆 */
  getCaseById(caseId) {
    return this.get('getCaseById', { caseId });
  },

  /** 依工號查全部歷史案件 */
  getCasesByEmpId(empId) {
    return this.get('getCasesByEmpId', { empId });
  },


  // ===== 管理端 =====
  //
  // ⚠️ 管理端一律用 POST，就算只是讀資料也一樣。
  //    因為 token 不能放進網址（會留在瀏覽器歷史紀錄與伺服器日誌），
  //    也不能放進 header（Apps Script 不支援 doOptions，會被 CORS 擋下）。
  //    剩下唯一的選項就是放進 POST 的 body。

  /** 帳號密碼登入 */
  adminLogin(account, password) {
    return this.post({ action: 'adminLogin', account, password });
  },

  /** 登出（讓伺服器端的 token 失效）*/
  adminLogout(token) {
    return this.post({ action: 'adminLogout', token });
  },

  /** 確認 token 還有效，並取回姓名與角色 */
  getAdminProfile(token) {
    return this.post({ action: 'getAdminProfile', token });
  },

  /**
   * 取得案件列表。
   * @param {string} token
   * @param {Object} filters 篩選條件（status_code / location_code / category_code /
   *                         date_from / date_to / keyword），空字串的會被拿掉
   */
  getCaseList(token, filters = {}, period = '') {
    const payload = { action: 'getCaseList', token };
    if (period) payload.period = period;

    // 空字串代表「不篩這一項」，不要送出去佔位
    Object.keys(filters).forEach((key) => {
      if (filters[key]) payload[key] = filters[key];
    });

    return this.post(payload);
  },

  /** 取得回覆範本（管理者可自行在 Sheet 的「回覆範本」分頁增修） */
  getTemplates(token) {
    return this.post({ action: 'getTemplates', token });
  },

  /** 更新案件狀態、回覆與指派的處理者 */
  updateCase(token, caseId, statusCode, response, handlerCode) {
    return this.post({
      action:       'updateCase',
      token,
      case_id:      caseId,
      status_code:  statusCode,
      response,
      handler_code: handlerCode || '',
    });
  },

  // ===== 帳號管理（僅 SUPER，規格 §5.4）=====
  //
  // 全部走同一支 manageAdmin，用 op 分動作。
  // 後端會再驗一次角色（withAuth 的第三個參數），
  // 前端把按鈕藏起來只是體驗，不是安全機制。

  /** 列出所有管理者（不含任何密碼資料） */
  listAdmins(token) {
    return this.post({ action: 'manageAdmin', token, op: 'list' });
  },

  /** 新增管理者。成功時 data.initial_password 是一次性的初始密碼 */
  createAdmin(token, { account, name, email, role }) {
    return this.post({ action: 'manageAdmin', token, op: 'create', account, name, email, role });
  },

  /** 停用 / 啟用（status 傳 'ACTIVE' 或 'DISABLED'） */
  setAdminStatus(token, account, status) {
    return this.post({ action: 'manageAdmin', token, op: 'setStatus', account, status });
  },

  /**
   * 重設他人密碼。
   *
   * newPassword 留空 → 系統產生一組隨機密碼（預設）
   * newPassword 有值 → 用超級管理者自己輸入的那組
   *
   * 成功時 data.initial_password 是要交給對方的密碼，
   * data.generated 表示它是不是系統產生的。
   *
   * ⚠️ 欄位名稱一定要是 new_password：後端的錯誤日誌只遮罩這個名字，
   *    換成別的名字的話，出錯時明文密碼會被寫進 Sheet。
   */
  resetAdminPassword(token, account, newPassword) {
    return this.post({
      action:       'manageAdmin',
      token,
      op:           'resetPassword',
      account,
      new_password: newPassword || '',
    });
  },

  /**
   * 調整角色。
   * 目前頁面上沒有這個按鈕（一般管理者不會升降級，交接改用「建新的 + 停用舊的」），
   * 後端與這支包裝先留著，日後要開放時前端加個按鈕即可。
   */
  setAdminRole(token, account, role) {
    return this.post({ action: 'manageAdmin', token, op: 'setRole', account, role });
  },


  /** 變更自己的密碼 */
  adminChangePassword(token, oldPassword, newPassword) {
    return this.post({
      action:       'adminChangePassword',
      token,
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

};


/**
 * 統一的錯誤處理：把後端錯誤代碼轉成目前語言的訊息。
 *
 * 後端回傳的 message 是中文，這裡不直接用它，
 * 而是用 error 代碼去查 i18n——這樣印尼文使用者才會看到印尼文。
 */
function errorMessage(result) {
  if (!result) return t('err.UNKNOWN');
  const key = 'err.' + (result.error || 'UNKNOWN');
  const text = t(key);
  // 翻譯表裡沒有這個代碼時，t() 會原樣回傳 key，此時退回用後端訊息
  return text === key ? (result.message || t('err.UNKNOWN')) : text;
}


// ===== 選項清單的快取 =====

/**
 * 快取鍵名帶版本號。選項的「結構」有變動時（例如新增一種類型）就把 v 往上加，
 * 舊版快取會自動失效。
 */
const OPTIONS_CACHE_KEY = 'kantin_options_v3';

/** 快取有效期。過期就重新跟後端要一次。 */
const OPTIONS_CACHE_TTL_MS = 30 * 60 * 1000;   // 30 分鐘

/**
 * 表單一定要有的選項類型。
 * 快取或後端回應少了其中任何一種，就視為資料不完整。
 *
 * 這是最重要的一道防護：新增選項類型時就算忘了改版本號，
 * 這裡也會擋下來，不會讓使用者看到「有標題卻沒有按鈕」的空白區塊。
 */
const REQUIRED_OPTION_TYPES = ['LOCATION', 'MEAL', 'CATEGORY', 'STATUS'];
// ⚠️ HANDLER 刻意不列進來。處理者名單一開始是空的，
//    列進必要類型的話會讓整個頁面判定「選項資料不完整」而進不去。


/**
 * 取得選項清單，並暫存在 sessionStorage。
 * 選項很少變動，換頁時不必每次都重新跟後端要。
 */
async function loadOptions() {
  const cached = readOptionsCache();
  if (cached) return cached;

  const result = await Api.getOptions();
  if (!result.ok) throw new Error(errorMessage(result));

  if (!hasAllRequiredOptions(result.data)) {
    throw new Error('選項資料不完整，缺少必要的類型');
  }

  sessionStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify({
    at:   Date.now(),
    data: result.data,
  }));
  return result.data;
}


/** 讀取快取；過期、格式不對、內容不完整都回傳 null（代表要重抓） */
function readOptionsCache() {
  try {
    const raw = sessionStorage.getItem(OPTIONS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    if (Date.now() - (parsed.at || 0) > OPTIONS_CACHE_TTL_MS) return null;
    if (!hasAllRequiredOptions(parsed.data)) return null;

    return parsed.data;
  } catch (e) {
    return null;   // 快取壞掉就當作沒有
  }
}


/** 檢查必要的選項類型是否都存在且不是空的 */
function hasAllRequiredOptions(data) {
  if (!data) return false;
  return REQUIRED_OPTION_TYPES.every(function (type) {
    return Array.isArray(data[type]) && data[type].length > 0;
  });
}


/**
 * 產生提交識別碼，用來防止重複送出。
 * 同一次填寫只會有一組，就算使用者連按多次，後端也只會建立一筆案件。
 */
function newSubmitId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
