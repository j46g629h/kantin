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

  /**
   * 新增管理者。
   *
   * newPassword 留空 → 系統產生一組隨機密碼
   * newPassword 有值 → 用超級管理者自己輸入的那組（一樣不可與其他管理者重複）
   *
   * 成功時 data.initial_password 是要交給對方的密碼。
   */
  createAdmin(token, { account, name, email, role, newPassword }) {
    return this.post({
      action:       'manageAdmin',
      token,
      op:           'create',
      account, name, email, role,
      new_password: newPassword || '',
    });
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
   * 修改管理者的姓名與 Email。
   *
   * 兩個一起送：它們是同一件事，拆成兩支的話要等兩趟 3～8 秒的往返。
   * Email 留空代表不收報表。
   */
  setAdminProfile(token, account, name, email) {
    return this.post({ action: 'manageAdmin', token, op: 'setProfile', account, name, email });
  },

  /**
   * 調整角色。
   * 目前頁面上沒有這個按鈕（一般管理者不會升降級，交接改用「建新的 + 停用舊的」），
   * 後端與這支包裝先留著，日後要開放時前端加個按鈕即可。
   */
  setAdminRole(token, account, role) {
    return this.post({ action: 'manageAdmin', token, op: 'setRole', account, role });
  },


  /**
   * Dashboard 統計（僅 SUPER）。
   *
   * 一次把所有月份與年份的統計全部拿回來——
   * Apps Script 每次回應要 3～8 秒，切一次下拉打一次 API 的話這頁沒人想開。
   * 資料量很小，累積十年也才 120 個月份。
   */
  getDashboardStats(token) {
    return this.post({ action: 'getDashboardStats', token });
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
//
// 這裡的目標不是「讓 Apps Script 變快」——它每次回應要 3～8 秒，
// 那是 Google 那端的執行時間，前端改不掉。
// 目標是「讓使用者不必等它」：先把上次拿到的拿出來用，同時在背景抓新的。

/**
 * 快取鍵名帶版本號。選項的「結構」有變動時（例如新增一種類型）就把 v 往上加，
 * 舊版快取會自動失效。
 */
const OPTIONS_CACHE_KEY = 'kantin_options_v3';

/**
 * ⚠️ 存 localStorage，不是 sessionStorage。
 *
 * sessionStorage 關掉分頁就沒了，而員工是**掃 QR Code 進來的**——
 * 每一次都是全新的分頁，等於每一次都要重等一次 3～8 秒，快取形同不存在。
 *
 * 這裡沒有任何個資，只是餐廳名稱與問題分類，留在裝置上沒有風險。
 * （管理者的 token 不一樣，那個仍然放 sessionStorage，見 js/admin-session.js）
 */

/** 「還很新」的界線：比這個新就直接用，完全不打 API。 */
const OPTIONS_FRESH_MS = 30 * 60 * 1000;              // 30 分鐘

/**
 * 「還能用」的界線：介於兩者之間就**先拿舊的頂著、同時在背景抓新的**。
 * 超過這條線才讓使用者等——放了一個月沒用的資料，寧可等那幾秒。
 */
const OPTIONS_STALE_MS = 7 * 24 * 60 * 60 * 1000;     // 7 天

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
 * 目前正在飛的那一個請求。
 * 同一頁如果有兩個地方同時要選項（例如背景更新還沒回來就又有人呼叫），
 * 共用同一個 promise，不要對 Apps Script 打兩次。
 */
let optionsInflight = null;


/**
 * 取得選項清單。
 *
 * 三種情況：
 *   快取很新   → 直接回傳，不打 API（0 秒）
 *   快取有點舊 → 先回傳舊的，背景抓新的（0 秒，下次進來就是新的）
 *   沒有 / 太舊 → 等 API（3～8 秒）
 *
 * ⚠️ 背景更新只更新快取，不會去動已經畫好的畫面。
 *    管理者新增餐廳之後，員工**下一次**進來就會看到，
 *    不必等 TTL 過期——這正是改用「先顯示舊的」換來的。
 */
async function loadOptions() {
  const cached = readOptionsCache();

  if (cached && cached.age <= OPTIONS_FRESH_MS) return cached.data;

  if (cached && cached.age <= OPTIONS_STALE_MS) {
    // 背景更新失敗就算了（可能剛好沒訊號），使用者手上的舊資料照樣能用
    refreshOptions().catch(function () {});
    return cached.data;
  }

  return refreshOptions();
}


/**
 * 首頁用的預抓。
 *
 * 使用者在首頁讀那 2～5 秒本來是白白浪費的，
 * 拿來先把選項抓回來，按下〔回報〕時表單就**直接出現**。
 *
 * 刻意不回傳 promise、不擋畫面、失敗完全不吭聲——
 * 這只是提早做一件本來就要做的事，做不成就照原本的流程走。
 */
function prefetchOptions() {
  try {
    loadOptions().catch(function () {});
  } catch (e) {
    // 連呼叫都失敗（例如舊瀏覽器沒有 fetch）也不能影響首頁
  }
}


/** 真的去跟後端要一次，成功才寫進快取 */
function refreshOptions() {
  if (optionsInflight) return optionsInflight;

  const request = (async function () {
    const result = await Api.getOptions();
    if (!result.ok) throw new Error(errorMessage(result));

    if (!hasAllRequiredOptions(result.data)) {
      throw new Error('選項資料不完整，缺少必要的類型');
    }

    writeOptionsCache(result.data);
    return result.data;
  })();

  optionsInflight = request;

  // 成功或失敗都要放掉。少了這行，一次失敗之後這一頁就永遠拿到
  // 同一個已經 reject 的 promise，重試永遠不會真的重試
  const release = function () {
    if (optionsInflight === request) optionsInflight = null;
  };
  request.then(release, release);

  return request;
}


/**
 * 讀取快取。
 * 回傳 { data, age }；沒有、格式不對、內容不完整都回傳 null（代表要重抓）。
 */
function readOptionsCache() {
  try {
    const raw = localStorage.getItem(OPTIONS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    if (!hasAllRequiredOptions(parsed.data)) return null;

    const age = Date.now() - (parsed.at || 0);
    // age 是負的代表裝置時鐘被往回調過（手機換時區、手動改時間都會）。
    // 不能當成「很新」——那會讓這份資料在時鐘調回來之前永遠不更新
    if (age < 0) return null;

    return { data: parsed.data, age: age };
  } catch (e) {
    return null;   // 快取壞掉就當作沒有
  }
}


/** 寫入快取。寫不進去只是下次要重抓，不能因此讓功能壞掉 */
function writeOptionsCache(data) {
  try {
    localStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify({
      at:   Date.now(),
      data: data,
    }));
  } catch (e) {
    // 無痕視窗、空間滿了、使用者關掉網站資料，都會在這裡丟例外
  }
}


/** 檢查必要的選項類型是否都存在且不是空的 */
function hasAllRequiredOptions(data) {
  if (!data) return false;
  return REQUIRED_OPTION_TYPES.every(function (type) {
    return Array.isArray(data[type]) && data[type].length > 0;
  });
}


// ===== 工號驗證的快取 =====
//
// 同一位員工再回報一次時，姓名可以立刻出現，不必再等一次 3～8 秒。
//
// 三個刻意的限制：
//
//   1. **只存驗證成功的。** 存了「查無此工號」的話，
//      名冊補上他之後，他還要等 TTL 過期才進得去——而他不會等，他不會再來第二次。
//   2. **只存最後一位。** 這是員工自己的手機，但工廠裡也會有人借手機給同事用。
//      只留一筆，別人的姓名不會累積在這台裝置上。
//   3. **一定照樣在背景重驗一次。** 人會離職、名冊會改名。
//
// ⚠️ 就算這份快取是錯的也送不出錯的案件：
//    後端在 submitFeedback 會自己再驗一次工號（gas/Feedback.js），
//    而且存進 Sheet 的是**名冊上的寫法**，不是這裡快取的值。
//    所以這份快取只影響「畫面上先顯示什麼」，不影響資料正確性。

const EMP_CACHE_KEY    = 'kantin_emp_v1';
const EMP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;    // 30 天

/**
 * 讀取這個工號的快取姓名。
 * @param {string} empId 已經正規化（大寫、只剩英數）的工號
 * @return {?{emp_id:string, emp_name:string}}
 */
function readEmployeeCache(empId) {
  try {
    const raw = localStorage.getItem(EMP_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.key !== empId) return null;      // 存的是別人的，不能用
    if (!parsed.data || !parsed.data.emp_id) return null;

    const age = Date.now() - (parsed.at || 0);
    if (age < 0 || age > EMP_CACHE_TTL_MS) return null;

    return parsed.data;
  } catch (e) {
    return null;
  }
}


/** 驗證成功時寫入快取（只有成功才會呼叫到這裡） */
function writeEmployeeCache(empId, employee) {
  try {
    if (!employee || !employee.emp_id) return;
    localStorage.setItem(EMP_CACHE_KEY, JSON.stringify({
      at:   Date.now(),
      key:  empId,
      data: { emp_id: employee.emp_id, emp_name: employee.emp_name },
    }));
  } catch (e) {
    // 同上：存不進去只是少了一點速度
  }
}


/**
 * 產生提交識別碼，用來防止重複送出。
 * 同一次填寫只會有一組，就算使用者連按多次，後端也只會建立一筆案件。
 */
function newSubmitId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
