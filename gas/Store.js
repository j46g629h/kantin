/**
 * 附有效期的鍵值儲存
 *
 * ⚠️ 為什麼不用 CacheService（這是踩過的坑）：
 *
 * 這個專案上的 `CacheService` **完全沒有作用**——
 * `put()` 不會丟出任何錯誤，但 `get()` 永遠回傳 null，
 * 連同一次請求內寫完立刻讀都讀不到。實測確認過。
 *
 * 結果是：登入會成功並發出 token，但下一個請求讀不到那個 token，
 * 於是變成「登入後立刻被彈回登入頁」。而且因為 put 不報錯，
 * 錯誤日誌裡什麼線索都沒有。
 *
 * `PropertiesService` 在同一個環境下完全正常，所以改用它。
 * 它沒有內建有效期，這個檔案就是補上那一層：
 * 每筆資料存的時候一起記下到期時間，讀的時候過期就當作不存在。
 *
 * 順帶一個好處：token 存在 Properties 是真的可以刪掉的，
 * 「登出」因此變成真正的伺服器端登出，而不是等它自己過期。
 */


/**
 * 存入一筆資料。
 *
 * @param {string} key   鍵
 * @param {string} value 值（字串。物件請自己先 JSON.stringify）
 * @param {number} ttlSeconds 幾秒後過期
 */
function storePut(key, value, ttlSeconds) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify({
    v: value,
    e: Date.now() + (Number(ttlSeconds) || 0) * 1000,
  }));
}


/**
 * 讀出一筆資料；不存在或已過期都回傳 null。
 *
 * 讀到過期資料時順手刪掉，避免它一直佔著空間。
 */
function storeGet(key) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.e && parsed.e < Date.now()) {
      props.deleteProperty(key);
      return null;
    }
    return (parsed && parsed.v !== undefined) ? parsed.v : null;
  } catch (e) {
    // 格式壞掉就當作沒有，並清掉免得每次都失敗
    try { props.deleteProperty(key); } catch (e2) { /* 忽略 */ }
    return null;
  }
}


/** 刪掉一筆資料（登出、清快取都用這個） */
function storeRemove(key) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(key);
  } catch (e) {
    // 本來就不存在也算成功
  }
}


/**
 * 清掉所有已過期的資料。
 *
 * PropertiesService 沒有自動過期，過期的 token 與快取會一直留著。
 * 在登入時順手掃一次就夠了——登入不頻繁，而那正是要新增 token 的時候。
 *
 * @return {number} 清掉幾筆
 */
function storeSweepExpired() {
  try {
    const props = PropertiesService.getScriptProperties();
    const all   = props.getProperties();
    const now   = Date.now();
    const expired = [];

    Object.keys(all).forEach(function (key) {
      try {
        const parsed = JSON.parse(all[key]);
        if (parsed && parsed.e && parsed.e < now) expired.push(key);
      } catch (e) {
        // 不是這個格式存的（可能是別的用途），不要動它
      }
    });

    expired.forEach(function (key) { props.deleteProperty(key); });
    return expired.length;

  } catch (e) {
    // 清理失敗不該影響任何正常功能
    Logger.log('storeSweepExpired 失敗（可忽略）: ' + e);
    return 0;
  }
}
