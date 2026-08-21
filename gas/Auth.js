/**
 * 管理者登入與權限驗證
 *
 * 規格 §5。這個檔案負責四件事：
 *   1. 密碼雜湊（SHA-256 迭代 1000 次，明文密碼絕不落地）
 *   2. 登入：驗密碼 → 發 token
 *   3. 登入失敗鎖定（5 次 / 15 分鐘）
 *   4. 每支管理端 API 的 token 驗證
 *
 * ⚠️ 所有驗證都必須在後端。前端原始碼在 GitHub 上是公開的，
 *    任何寫在前端的判斷都等同沒有判斷。
 */


// ===== 密碼雜湊 =====

/**
 * 產生隨機鹽值。
 *
 * 每個帳號的鹽值都不同，這樣就算兩個人用一樣的密碼，
 * Sheet 上存的雜湊也會完全不同——攻擊者無法一次破解一整批。
 *
 * 用 UUID 當亂數來源：Apps Script 沒有 crypto.getRandomValues，
 * 而 Utilities.getUuid() 產生的是密碼學等級的隨機值，比 Math.random() 可靠。
 */
function generateSalt() {
  const hex = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  return hex.substring(0, AUTH.SALT_LENGTH);
}


/**
 * 計算密碼雜湊：SHA-256( 鹽值 + 密碼 ) 迭代 1000 次。
 *
 * 為什麼要迭代：單次 SHA-256 快到攻擊者一秒能試上億組。
 * 迭代 1000 次讓每次驗證多花數十毫秒（使用者無感），
 * 但暴力破解的成本也跟著變成 1000 倍。
 *
 * @param {string} password 明文密碼
 * @param {string} salt     該帳號的鹽值
 * @return {string} 64 個十六進位字元
 */
function hashPassword(password, salt) {
  let bytes = Utilities.newBlob(str(salt) + String(password)).getBytes();

  for (let i = 0; i < AUTH.HASH_ITERATIONS; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  }
  return bytesToHex(bytes);
}


/** 把位元組陣列轉成十六進位字串（Apps Script 的位元組是有號的，要先轉回 0～255） */
function bytesToHex(bytes) {
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}


/**
 * 檢查密碼是否符合規則（規格 §5.5）：至少 8 字元，須含英文字母與數字。
 * @return {string} 通過回傳空字串，不通過回傳錯誤代碼
 */
function validatePasswordRule(password) {
  const pw = String(password || '');
  if (pw.length < AUTH.MIN_PASSWORD_LENGTH) return 'PASSWORD_TOO_SHORT';
  if (!/[A-Za-z]/.test(pw))                 return 'PASSWORD_NEEDS_LETTER';
  if (!/[0-9]/.test(pw))                    return 'PASSWORD_NEEDS_DIGIT';
  return '';
}


// ===== 登入 =====

/**
 * POST { action:'adminLogin', account:'...', password:'...' }
 *
 * 成功：{ ok:true, data:{ token, name, account, role, must_change_password } }
 */
function adminLogin(params) {
  // 帳號一律轉小寫比對，密碼去頭尾空白——
  // 手機輸入法很容易在後面多帶一個空格，而使用者完全看不出來
  const account  = str(params.account).toLowerCase();
  const password = str(params.password);

  if (!account || !password) {
    return fail('LOGIN_REQUIRED', '請輸入帳號與密碼');
  }

  // ---------- 1. 先看有沒有被鎖 ----------
  const lockedFor = getLockRemainingMinutes(account);
  if (lockedFor > 0) {
    return fail('LOGIN_LOCKED', '嘗試次數過多，請於 ' + lockedFor + ' 分鐘後再試');
  }

  // ---------- 2. 比對密碼 ----------
  const admin = findAdminByAccount(account);

  // 帳號不存在時也走一次雜湊運算，讓「帳號不存在」與「密碼錯誤」的回應時間差不多，
  // 避免有人用回應快慢反推出哪些帳號是存在的
  const salt = admin ? admin.password_salt : 'no-such-account';
  const hash = hashPassword(password, salt);

  if (!admin || hash !== str(admin.password_hash)) {
    const left = recordLoginFailure(account);
    // 刻意不說是帳號錯還是密碼錯（規格 §5.2）
    return fail('LOGIN_FAILED', '帳號或密碼錯誤', { attempts_left: left });
  }

  // ---------- 3. 密碼對了，再看帳號有沒有被停用 ----------
  if (str(admin.status).toUpperCase() !== ADMIN_STATUS.ACTIVE) {
    return fail('ACCOUNT_DISABLED', '此帳號已停用，請洽系統管理者');
  }

  // ---------- 4. 發 token ----------
  clearLoginFailures(account);
  touchLastLogin(admin.row);

  const session = {
    account: str(admin.account).toLowerCase(),
    name:    str(admin.name),
    role:    normalizeRole(admin.role),
    must_change_password: isTrue(admin.must_change_pw),
  };
  const token = createSession(session);

  return ok({
    token:                token,
    account:              session.account,
    name:                 session.name,
    role:                 session.role,
    must_change_password: session.must_change_password,
  });
}


/**
 * POST { action:'adminLogout', token:'...' }
 * 把 token 從快取移除，之後就無效了。
 */
function adminLogout(params) {
  const token = str(params.token);
  // Properties 存的 token 是真的刪得掉的，所以這是真正的伺服器端登出
  if (token) storeRemove(CACHE_KEYS.TOKEN + token);
  return ok({ logged_out: true });
}


/**
 * POST { action:'getAdminProfile', token:'...' }
 *
 * 讓前端重新整理後能確認 token 還有效，並取回姓名與角色。
 * 同時也是「這支 token 到底能不能用」最簡單的測試點。
 */
function getAdminProfile(params, session) {
  return ok({
    account:              session.account,
    name:                 session.name,
    role:                 session.role,
    must_change_password: session.must_change_password,
    is_super:             session.role === ADMIN_ROLES.SUPER,
  });
}


/**
 * POST { action:'adminChangePassword', token, old_password, new_password }
 *
 * 首次登入被強制改密碼時走的也是這一支：
 * 一樣要輸入舊密碼（就是超級管理者給的那組初始密碼）。
 */
function adminChangePassword(params, session) {
  const oldPassword = str(params.old_password);
  const newPassword = str(params.new_password);

  if (!oldPassword || !newPassword) {
    return fail('PASSWORD_REQUIRED', '請輸入舊密碼與新密碼');
  }

  const ruleError = validatePasswordRule(newPassword);
  if (ruleError) return fail(ruleError, '新密碼不符合規則');

  if (newPassword === oldPassword) {
    return fail('PASSWORD_SAME', '新密碼不可與舊密碼相同');
  }

  // 重新從 Sheet 讀一次，不信任快取裡的 session——
  // 帳號可能在登入之後被停用或被重設密碼
  const admin = findAdminByAccount(session.account);
  if (!admin) return fail('ACCOUNT_NOT_FOUND', '查無此帳號');

  if (hashPassword(oldPassword, admin.password_salt) !== str(admin.password_hash)) {
    return fail('OLD_PASSWORD_WRONG', '舊密碼不正確');
  }

  setAdminPassword(admin.row, newPassword, false);

  // 更新快取裡的 session，前端才不會一直被導回改密碼頁
  session.must_change_password = false;
  refreshSession(str(params.token), session);

  return ok({ changed: true });
}


// ===== token（session）=====

/**
 * 產生 token 並存進快取。
 *
 * token 存在 PropertiesService（見 gas/Store.js 說明為什麼不用 CacheService）。
 * 每次登入順手清掉已過期的資料，過期 token 才不會一直累積。
 */
function createSession(session) {
  storeSweepExpired();                 // 登入不頻繁，順手清掉過期的資料
  const token = Utilities.getUuid();
  refreshSession(token, session);
  return token;
}

/** 寫入 / 更新 token 的內容（效期重新起算） */
function refreshSession(token, session) {
  if (!token) return;
  storePut(CACHE_KEYS.TOKEN + token, JSON.stringify(session), AUTH.TOKEN_TTL);
}

/** 用 token 取回 session，無效或過期回傳 null */
function readSession(token) {
  if (!token) return null;
  const raw = storeGet(CACHE_KEYS.TOKEN + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}


/**
 * 保護管理端 API 的共用外殼（規格 §5.3）。
 *
 * 用法（在 Main.js 的路由表裡）：
 *   updateCase: function (p) { return withAuth(p, function (s) { return updateCase(p, s); }); }
 *
 * @param {Object}   params       請求參數，token 放在裡面（不放 header，見 CORS 規範）
 * @param {Function} handler      通過驗證後要執行的函式，會收到 session
 * @param {boolean}  requireSuper 是否只有 SUPER 角色可執行
 */
function withAuth(params, handler, requireSuper) {
  const session = readSession(str(params.token));

  if (!session) {
    return fail('UNAUTHORIZED', '登入已過期，請重新登入');
  }
  if (requireSuper && session.role !== ADMIN_ROLES.SUPER) {
    return fail('FORBIDDEN', '你的帳號沒有執行這個操作的權限');
  }
  return handler(session);
}


// ===== 登入失敗鎖定 =====

/**
 * 記一次登入失敗，回傳「還剩幾次機會」。
 * 達到上限時回傳 0，並開始計算 15 分鐘的鎖定。
 */
function recordLoginFailure(account) {
  const key   = CACHE_KEYS.LOGIN_FAIL + account;
  const state = readFailState(key);

  state.count += 1;

  if (state.count >= AUTH.MAX_LOGIN_FAILS) {
    state.locked_until = Date.now() + AUTH.LOCKOUT_SECONDS * 1000;
  }

  storePut(key, JSON.stringify(state), AUTH.LOCKOUT_SECONDS);
  return Math.max(0, AUTH.MAX_LOGIN_FAILS - state.count);
}

/** 登入成功後把失敗紀錄清掉 */
function clearLoginFailures(account) {
  storeRemove(CACHE_KEYS.LOGIN_FAIL + account);
}

/** 還要鎖幾分鐘（沒被鎖就回傳 0） */
function getLockRemainingMinutes(account) {
  const state = readFailState(CACHE_KEYS.LOGIN_FAIL + account);
  const left  = (state.locked_until || 0) - Date.now();
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

/** 讀失敗計數；沒有或壞掉都當作全新開始 */
function readFailState(key) {
  try {
    const raw = storeGet(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.count === 'number') return parsed;
    }
  } catch (e) { /* 壞掉就重來 */ }
  return { count: 0, locked_until: 0 };
}


// ===== 管理者名單存取 =====

/**
 * 依帳號找管理者。
 *
 * 名單只有 6 個人，整張讀進來再比對就夠快，不必用 TextFinder。
 *
 * @return {Object|null} 含所有欄位，外加 row（Sheet 上的列號）
 */
function findAdminByAccount(account) {
  const target = str(account).toLowerCase();
  if (!target) return null;

  const admins = readAllAdmins();
  for (let i = 0; i < admins.length; i++) {
    if (str(admins[i].account).toLowerCase() === target) return admins[i];
  }
  return null;
}


/** 讀出管理者名單的所有資料列（含 row 列號） */
function readAllAdmins() {
  const sheet   = getSheet(SHEETS.ADMINS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const colMap = getAdminColumnMap();
  const rows   = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  return rows.map(function (values, i) {
    const admin = { row: i + 2 };   // 資料從第 2 列開始
    ADMIN_COLUMNS.forEach(function (col) {
      admin[col.code] = values[colMap[col.code] - 1];
    });
    return admin;
  }).filter(function (admin) {
    return str(admin.account) !== '';   // 略過空白列
  });
}


/**
 * 設定某一列的密碼（產生新鹽值 + 新雜湊）。
 * 由「自己改密碼」與「SUPER 重設他人密碼」共用。
 *
 * @param {number}  row                    Sheet 列號
 * @param {string}  newPassword            新的明文密碼（只在記憶體裡，不寫進 Sheet）
 * @param {boolean} forceChangeOnNextLogin 下次登入是否強制改密碼
 */
function setAdminPassword(row, newPassword, forceChangeOnNextLogin) {
  const sheet  = getSheet(SHEETS.ADMINS);
  const colMap = getAdminColumnMap();

  const salt = generateSalt();
  const hash = hashPassword(newPassword, salt);

  // 每格都先設純文字格式再寫值——
  // 全數字的雜湊若被當成數字存成科學記號，密碼會永遠對不起來
  setTextCell(sheet, row, colMap.password_hash,  hash);
  setTextCell(sheet, row, colMap.password_salt,  salt);
  setTextCell(sheet, row, colMap.must_change_pw, forceChangeOnNextLogin ? 'TRUE' : 'FALSE');
}


/** 更新最後登入時間 */
function touchLastLogin(row) {
  try {
    const colMap = getAdminColumnMap();
    const cell   = getSheet(SHEETS.ADMINS).getRange(row, colMap.last_login_at);
    cell.setNumberFormat('yyyy-mm-dd hh:mm:ss');
    cell.setValue(new Date());
  } catch (e) {
    // 記錄登入時間失敗不該讓人登不進來
    logError('touchLastLogin', '', e, { row: row });
  }
}


/** 把值以純文字寫進單一儲存格（先設格式再寫值） */
function setTextCell(sheet, row, col, value) {
  const cell = sheet.getRange(row, col);
  cell.setNumberFormat('@');
  cell.setValue(String(value));
}


// ===== 小工具 =====

/** 角色代碼正規化，認不得的一律當成權限最小的 ADMIN */
function normalizeRole(role) {
  return str(role).toUpperCase() === ADMIN_ROLES.SUPER ? ADMIN_ROLES.SUPER : ADMIN_ROLES.ADMIN;
}

/** Sheet 的布林欄可能是真布林值，也可能是文字 "TRUE"，兩種都要認得 */
function isTrue(value) {
  if (value === true) return true;
  const s = str(value).toUpperCase();
  return s === 'TRUE' || s === 'Y' || s === 'YES' || s === '1';
}


// ===== 強制登出（帳號管理用）=====

/**
 * 把某個帳號手上的所有 token 全部作廢。
 *
 * ⚠️ 為什麼一定要有這一支：
 *
 * `withAuth()` 只讀 token 裡的 session 快照，**不會回頭查 Sheet**。
 * 所以把某人停用之後，他手上那支 token 在效期內（6 小時）照樣能改案件、能結案——
 * 「停用」等於沒有生效。把 SUPER 降成 ADMIN 也一樣：
 * 他那個分頁裡的角色還是舊的。
 *
 * 每次改動帳號的狀態、角色或密碼，都要順手呼叫這一支。
 *
 * 這件事做得到，正是因為 token 改存在 PropertiesService 而不是 CacheService
 * （見 gas/Store.js 開頭的事故說明）——存進去的東西是真的列得出來、刪得掉的。
 *
 * @param  {string} account 帳號
 * @return {number} 作廢了幾支 token
 */
function revokeSessionsForAccount(account) {
  const target = str(account).toLowerCase();
  if (!target) return 0;

  let count = 0;
  storeEntries(CACHE_KEYS.TOKEN).forEach(function (entry) {
    try {
      const session = JSON.parse(entry.value);
      if (session && str(session.account).toLowerCase() === target) {
        storeRemove(entry.key);
        count++;
      }
    } catch (e) {
      // 內容壞掉的就別動它，交給 storeSweepExpired() 過期後清掉
    }
  });
  return count;
}
