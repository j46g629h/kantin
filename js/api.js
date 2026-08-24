/**
 * 後端 API 呼叫
 *
 * 所有跟 Apps Script 溝通的程式碼都集中在這裡，
 * 頁面只要呼叫 Api.xxx()，不用重複處理 fetch 的細節。
 */

// ===== 連線層：逾時與自動重試 =====
//
// 📌 為什麼需要這一層（2026-08-24 上線後實測到的）：
//
//    Apps Script 的 `/exec` 會**偶爾整支請求失敗**——實測連打 15 次，
//    有 1 次在等了 33 秒之後回 HTTP 404（Google 那端的問題，不是我們的程式：
//    真的跑到我們的程式一定會回 200 + JSON，就算是錯誤也是 `{ok:false}`）。
//
//    少了這一層的話，那 1/15 的使用者看到的是「載入中…」轉很久，
//    然後跳「連線有問題」——而他只要再按一次就會成功。
//    **他不會再按第二次。**
//
//    順序也很重要：404 回來的是一頁 HTML，不是 JSON。
//    原本直接 `response.json()` 會丟一個看不懂的解析錯誤，
//    現在統一轉成「連線問題」，訊息才對得上使用者實際遇到的事。

/**
 * 單次請求的逾時。
 *
 * ⚠️ 不可以設太短。實測正常回應 1.5～3 秒，但**同時有多個請求排隊時
 *    會被 Apps Script 排到 20 秒**（它一次只跑一支）。
 *    設 10 秒的話會把「其實正在跑而且會成功」的請求砍掉重練，反而更慢。
 *    25 秒是取在「排隊最久 20 秒」與「Google 自己放棄的 33 秒」之間。
 */
const API_TIMEOUT_MS = 25000;

/** 重試前先等一下，不要立刻打回去 */
const API_RETRY_DELAY_MS = 1000;

/**
 * 只重試一次。
 * 單次失敗率約 7%，重試一次就降到 0.5%；重試第二次只再降一點點，
 * 卻會讓最壞情況多等 25 秒——使用者盯著骨架畫面的那 25 秒不值得。
 */
const API_RETRY_TIMES = 1;

/**
 * 開始重試時通知畫面（讓載入文字改成「連線比較慢，重試中…」）。
 * 沒有註冊的話就安靜地重試。
 */
let apiRetryNotice = null;
function setApiRetryNotice(fn) { apiRetryNotice = fn; }

function apiDelay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * 送出一次請求並解析 JSON。
 *
 * 三種情況都會丟例外，交給上層當成「連線問題」處理：
 *   逾時、網路斷掉、回來的不是 JSON（Apps Script 掛掉時回的是 HTML）
 */
async function fetchJsonOnce(url, init) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS)
    : null;

  try {
    const options = Object.assign({}, init);
    if (controller) options.signal = controller.signal;

    const response = await fetch(url, options);
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (e) {
      // 回來的不是 JSON = 根本沒跑到我們的程式（多半是 Apps Script 的 404 頁）
      throw new Error('BAD_RESPONSE');
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 送出請求，失敗時自動重試。
 *
 * ⚠️ canRetry 只能給**重複做也不會出事**的 API：
 *    讀取類的全部可以；寫入類的只有 `submitFeedback` 可以——
 *    它靠 `client_submit_id` 去重，重送同一筆會直接回既有的案件編號
 *    （見 gas/Feedback.js 的「防重複提交」）。
 *    新增管理者、重設密碼那些**絕對不可以**自動重試。
 *
 * ⚠️ 只有「連線失敗」才重試。後端有回 JSON 就算它說 `ok:false`
 *    （查無此工號之類）也是正常回應，重試只是白等一次。
 */
async function fetchJson(url, init, canRetry) {
  let attemptsLeft = canRetry ? API_RETRY_TIMES : 0;

  for (;;) {
    try {
      return await fetchJsonOnce(url, init);
    } catch (err) {
      if (attemptsLeft <= 0) throw err;
      attemptsLeft--;

      // 通知畫面「還在試」。這個回呼是頁面給的，炸掉不可以連累重試
      if (apiRetryNotice) {
        try { apiRetryNotice(); } catch (e) { /* 畫面的事，不影響連線 */ }
      }

      await apiDelay(API_RETRY_DELAY_MS);
    }
  }
}


const Api = {

  /**
   * GET 請求。
   *
   * 員工端的讀取全部走這裡，而讀取重複做不會有副作用，所以一律開重試。
   *
   * @param {string} action 動作名稱
   * @param {Object} params 其他參數
   */
  async get(action, params = {}) {
    const query = new URLSearchParams({ action, ...params }).toString();
    return fetchJson(`${API_URL}?${query}`, {}, true);
  },

  /**
   * POST 請求。
   *
   * ⚠️ Content-Type 必須是 text/plain。
   *    用 application/json 會觸發瀏覽器的預檢請求(preflight)，
   *    而 Apps Script 不支援 doOptions，請求會直接被擋掉。
   *
   * @param {Object} payload
   * @param {boolean} [canRetry] 這支 API 重複做會不會出事。**預設不重試。**
   */
  async post(payload, canRetry = false) {
    return fetchJson(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }, canRetry);
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

  /**
   * 提交回報。
   *
   * 這是唯一開重試的寫入類 API——它靠 `client_submit_id` 去重，
   * 重送同一筆會回既有的案件編號而不是建立第二筆（gas/Feedback.js）。
   * 而它也是最不能讓人重來的一支：表單填完了、照片也壓縮上傳了。
   */
  submitFeedback(data) {
    return this.post({ action: 'submitFeedback', ...data }, true);
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
    return this.post({ action: 'getAdminProfile', token }, true);   // 純讀取，可重試
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

    return this.post(payload, true);   // 純讀取，可重試
  },

  /** 取得回覆範本（管理者可自行在 Sheet 的「回覆範本」分頁增修） */
  getTemplates(token) {
    return this.post({ action: 'getTemplates', token }, true);   // 純讀取，可重試
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
    return this.post({ action: 'manageAdmin', token, op: 'list' }, true);   // 純讀取，可重試
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
    return this.post({ action: 'getDashboardStats', token }, true);   // 純讀取，可重試
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
