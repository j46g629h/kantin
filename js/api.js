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


/**
 * 取得選項清單，並暫存在 sessionStorage。
 * 選項很少變動，換頁時不必每次都重新跟後端要。
 */
async function loadOptions() {
  const CACHE_KEY = 'kantin_options';

  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* 壞掉就重抓 */ }
  }

  const result = await Api.getOptions();
  if (!result.ok) throw new Error(errorMessage(result));

  sessionStorage.setItem(CACHE_KEY, JSON.stringify(result.data));
  return result.data;
}


/**
 * 產生提交識別碼，用來防止重複送出。
 * 同一次填寫只會有一組，就算使用者連按多次，後端也只會建立一筆案件。
 */
function newSubmitId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
