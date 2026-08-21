/**
 * 帳號管理（規格 §5.4，僅 SUPER 角色）
 *
 * 一支 API `manageAdmin`，用 `op` 參數分五個子動作：
 *   list           列出所有管理者
 *   create         新增管理者（回傳一次性的初始密碼）
 *   setStatus      停用 / 啟用
 *   resetPassword  重設他人密碼（回傳一次性的新密碼）
 *   setRole        調整角色
 *
 * 路由在 gas/Main.js，用 withAuth(p, handler, true) 包起來——
 * 第三個參數 true 就是「只有 SUPER 能用」（見設計約定第 8 條）。
 *
 *
 * ⚠️ 這個檔案有三件事特別容易出錯，改動前請先讀懂：
 *
 * 1. **回傳的資料絕對不可以含密碼雜湊與鹽值。**
 *    `readAllAdmins()` 讀的是整列，裡面就有這兩欄。
 *    一律經過 `toSafeAdmin()` 過濾再回傳，不要圖方便直接吐原始資料。
 *
 * 2. **每次改動帳號都要作廢對方的 token。**
 *    `withAuth()` 只看 token 裡的快照，不會回頭查 Sheet。
 *    不作廢的話，被停用的人在 6 小時內照樣能改案件（詳見 Auth.js 的
 *    revokeSessionsForAccount 說明）。
 *
 * 3. **不能讓系統變成沒有半個可用的超級管理者。**
 *    真的發生時只能回 Apps Script 編輯器手動救，一般使用者做不到。
 *    `guardLastActiveSuper()` 就是在擋這件事。
 *
 *
 * 📌 為什麼「新增」可以選角色，但既有帳號沒有「改角色」的按鈕：
 *
 *    一般管理者的生命週期就是「加入 → 離職停用」，中間不會變角色。
 *    唯一會用到的是超級管理者交接，而那用「建一個新的 SUPER + 停用舊的」
 *    就完成了，不必動角色。
 *
 *    後端仍然照規格 §5.4 把 setRole 做完整、測試也涵蓋，
 *    這樣日後真的需要時，前端加一個按鈕就好，後端不必再動。
 */


// ===== 進入點 =====

/**
 * POST { action:'manageAdmin', token, op, ... }
 *
 * @param {Object} params  請求參數
 * @param {Object} session 目前登入者（withAuth 保證是 SUPER）
 */
function manageAdmin(params, session) {
  const op = str(params.op).toLowerCase();

  const operations = {
    list:          adminOpList,
    create:        adminOpCreate,
    setstatus:     adminOpSetStatus,
    resetpassword: adminOpResetPassword,
    setrole:       adminOpSetRole,
  };

  const operation = operations[op];
  if (!operation) {
    return fail('UNKNOWN_OP', '不支援的帳號管理動作：' + op);
  }
  return operation(params, session);
}


// ===== list：列出所有管理者 =====

/**
 * 回傳整份管理者名單（不含任何密碼資料）。
 *
 * 順序：超級管理者在前，其餘依帳號排序。
 * 名單只有個位數，排序純粹是為了每次打開看到的順序一致，
 * 不會因為 Sheet 上的列順序被動過就跳來跳去。
 */
function adminOpList(params, session) {
  const admins = readAllAdmins().map(toSafeAdmin);

  admins.sort(function (a, b) {
    if (a.role !== b.role) return a.role === ADMIN_ROLES.SUPER ? -1 : 1;
    return a.account < b.account ? -1 : (a.account > b.account ? 1 : 0);
  });

  return ok({
    admins: admins,

    // 前端用這兩個值決定哪些按鈕要變灰：
    //   自己那一列不給停用（真正的把關在後端）
    //   只剩一位啟用中的超級管理者時，那一列也不給停用
    self:                session.account,
    active_super_count:  countActiveSupers(admins),
  });
}


// ===== create：新增管理者 =====

/**
 * 新增一個管理者帳號，並回傳系統隨機產生的初始密碼。
 *
 * ⚠️ 初始密碼只會在這一次的回應裡出現。
 *    Sheet 裡只存雜湊，事後查不回來（這是刻意的）。
 *    忘了記下來就用「重設密碼」再產生一組新的。
 */
function adminOpCreate(params, session) {
  const account = str(params.account).toLowerCase();
  const name    = str(params.name);
  const email   = str(params.email);
  const role    = normalizeRole(params.role);

  if (!account) return fail('ADMIN_ACCOUNT_REQUIRED', '請輸入帳號');
  if (!name)    return fail('ADMIN_NAME_REQUIRED',    '請輸入姓名');

  // 帳號會被拿來當網址參數與比對鍵，含空白只會製造「看起來一樣卻登不進去」的鬼故事
  if (/\s/.test(account)) {
    return fail('ADMIN_ACCOUNT_INVALID', '帳號不可以有空白');
  }
  if (email && !looksLikeEmail(email)) {
    return fail('ADMIN_EMAIL_INVALID', 'Email 格式不正確');
  }
  if (findAdminByAccount(account)) {
    return fail('ADMIN_EXISTS', '這個帳號已經存在');
  }

  const password = generateInitialPassword();
  const salt     = generateSalt();
  const sheet    = getSheet(SHEETS.ADMINS);

  // 一律用 writeRowByColumns()：它會依表頭定位欄位，
  // Sheet 上多一欄少一欄都不會錯位（設計約定第 12 條）
  writeRowByColumns(sheet, SHEETS.ADMINS, sheet.getLastRow() + 1, ADMIN_COLUMNS, {
    name:           name,
    account:        account,
    email:          email,
    password_hash:  hashPassword(password, salt),
    password_salt:  salt,
    role:           role,
    status:         ADMIN_STATUS.ACTIVE,
    must_change_pw: 'TRUE',        // 首次登入強制改密碼（規格 §5.5）
    created_at:     new Date(),
    last_login_at:  '',
  });

  return ok({
    account:          account,
    name:             name,
    role:             role,
    initial_password: password,
  });
}


// ===== setStatus：停用 / 啟用 =====

/**
 * 改變帳號狀態。離職就停用，不要刪除那一列——
 * 刪掉的話，他經手過的案件在「最後更新者」欄位就變成查無此人。
 */
function adminOpSetStatus(params, session) {
  const account = str(params.account).toLowerCase();
  const status  = str(params.status).toUpperCase();

  if (status !== ADMIN_STATUS.ACTIVE && status !== ADMIN_STATUS.DISABLED) {
    return fail('ADMIN_STATUS_INVALID', '狀態代碼不正確');
  }

  const admin = findAdminByAccount(account);
  if (!admin) return fail('ADMIN_NOT_FOUND', '查無此帳號');

  if (status === ADMIN_STATUS.DISABLED) {
    const blocked = guardLastActiveSuper(admin, session);
    if (blocked) return blocked;
  }

  setTextCell(getSheet(SHEETS.ADMINS), admin.row, getAdminColumnMap().status, status);

  // 停用要立刻生效，不能等他手上的 token 自己過期
  const revoked = (status === ADMIN_STATUS.DISABLED) ? revokeSessionsForAccount(account) : 0;

  return ok({ account: account, status: status, revoked_sessions: revoked });
}


// ===== resetPassword：重設他人密碼 =====

/**
 * 重設別人的密碼，並要求對方下次登入立刻改掉。
 *
 * 密碼有兩種來源：
 *   - 沒帶 new_password  → 系統產生一組 12 碼的隨機密碼（預設，比較安全）
 *   - 有帶 new_password  → 用超級管理者自己輸入的那組
 *
 * ⚠️ 自訂密碼一定要用 `new_password` 這個欄位名稱。
 *    `gas/Main.js` 的 SENSITIVE_PARAMS 會把它遮成 ***，
 *    換成別的名字的話，這支 API 一旦出錯，明文密碼會原封不動被寫進「錯誤日誌」分頁。
 *
 * 不論哪一種都會把「需重設密碼」設成 TRUE：
 * 超級管理者知道別人的密碼只該是過渡狀態，對方一登入就要換成只有他自己知道的。
 *
 * 順便解除登入鎖定——「連續輸錯 5 次被鎖住」正是最常來求救的情境，
 * 重設完還要對方再等 15 分鐘實在沒有道理。
 */
function adminOpResetPassword(params, session) {
  const account = str(params.account).toLowerCase();

  const admin = findAdminByAccount(account);
  if (!admin) return fail('ADMIN_NOT_FOUND', '查無此帳號');

  // 改自己的密碼要走「變更密碼」（需要輸入舊密碼）。
  // 從這裡改的話，自己會立刻被登出，而且繞過了「要先證明你知道舊密碼」這一關
  if (account === str(session.account).toLowerCase()) {
    return fail('ADMIN_SELF_RESET', '要改自己的密碼請用「變更密碼」');
  }

  // str() 會去掉頭尾空白。這跟 adminLogin() 一致——
  // 那裡收到的密碼也會被 trim，所以前後有空白的密碼本來就登不進去，
  // 與其讓人設一組永遠對不起來的密碼，不如在這裡就先修掉
  const custom = str(params.new_password);
  let password;

  if (custom) {
    // 自訂密碼一樣要過規格 §5.5 的規則，不能因為是超級管理者設的就放行
    const ruleError = validatePasswordRule(custom);
    if (ruleError) return fail(ruleError, '密碼不符合規則');
    password = custom;
  } else {
    password = generateInitialPassword();
  }

  setAdminPassword(admin.row, password, true);   // true = 下次登入強制改掉
  clearLoginFailures(account);                   // 順手解除鎖定

  // 密碼都換了，舊 token 當然不能繼續有效
  const revoked = revokeSessionsForAccount(account);

  return ok({
    account:          account,
    name:             str(admin.name),
    initial_password: password,
    generated:        !custom,          // 前端用它決定要不要顯示「只出現這一次」的警告
    revoked_sessions: revoked,
  });
}


// ===== setRole：調整角色 =====

/**
 * 調整角色。目前前端沒有放這個按鈕（見檔案開頭的說明），
 * 但後端照規格 §5.4 做完整，日後要開放時前端加個按鈕就好。
 */
function adminOpSetRole(params, session) {
  const account = str(params.account).toLowerCase();
  const role    = str(params.role).toUpperCase();

  if (role !== ADMIN_ROLES.SUPER && role !== ADMIN_ROLES.ADMIN) {
    return fail('ADMIN_ROLE_INVALID', '角色代碼不正確');
  }

  const admin = findAdminByAccount(account);
  if (!admin) return fail('ADMIN_NOT_FOUND', '查無此帳號');

  if (account === str(session.account).toLowerCase()) {
    return fail('ADMIN_SELF_ROLE', '不能調整自己的角色');
  }

  // 只有「降級」需要守門。升級不會讓超級管理者變少
  if (role === ADMIN_ROLES.ADMIN) {
    const blocked = guardLastActiveSuper(admin, session);
    if (blocked) return blocked;
  }

  const before = normalizeRole(admin.role);
  if (before === role) {
    return ok({ account: account, role: role, changed: false, revoked_sessions: 0 });
  }

  setTextCell(getSheet(SHEETS.ADMINS), admin.row, getAdminColumnMap().role, role);

  // 對方 token 裡的角色是登入當下的快照，不作廢的話他那個分頁還是舊角色
  const revoked = revokeSessionsForAccount(account);

  return ok({ account: account, role: role, changed: true, revoked_sessions: revoked });
}


// ===== 共用的守門與轉換 =====

/**
 * 擋掉「把自己鎖在門外」與「系統再也沒有超級管理者」兩種情況。
 *
 * 停用與降級共用這一支。通過回傳 null，不通過回傳要直接吐給前端的錯誤。
 *
 * 為什麼第二條很重要：一旦沒有任何啟用中的超級管理者，
 * 帳號管理頁就沒有人進得去，只能回 Apps Script 編輯器跑 addAdminAccount()
 * 或 resetAdminPassword() 手動救——那對只會用網頁的人來說等於系統壞了。
 *
 * @param {Object} admin   目標帳號（readAllAdmins 的其中一筆）
 * @param {Object} session 目前登入者
 */
function guardLastActiveSuper(admin, session) {
  const account = str(admin.account).toLowerCase();

  if (account === str(session.account).toLowerCase()) {
    return fail('ADMIN_SELF_FORBIDDEN', '不能停用或降級自己的帳號');
  }

  const isActiveSuper = normalizeRole(admin.role) === ADMIN_ROLES.SUPER
                     && normalizeAdminStatus(admin.status) === ADMIN_STATUS.ACTIVE;

  if (isActiveSuper && countActiveSupers(readAllAdmins().map(toSafeAdmin)) <= 1) {
    return fail('ADMIN_LAST_SUPER', '這是唯一一位啟用中的超級管理者，不能停用或降級');
  }
  return null;
}


/** 數出目前有幾位「啟用中」的超級管理者 */
function countActiveSupers(safeAdmins) {
  return safeAdmins.filter(function (a) {
    return a.role === ADMIN_ROLES.SUPER && a.status === ADMIN_STATUS.ACTIVE;
  }).length;
}


/**
 * 把 Sheet 上的一整列轉成「可以安全回傳給前端」的物件。
 *
 * ⚠️ 這一步不可以省略。原始資料裡有 password_hash 與 password_salt，
 *    直接回傳等於把整份密碼資料送到瀏覽器上——
 *    而管理端頁面的原始碼在 GitHub 上是公開的，誰都看得到怎麼拿。
 *    這裡採「白名單」寫法（明確列出要哪幾欄），
 *    日後 ADMIN_COLUMNS 加了新欄位也不會不小心跟著漏出去。
 */
function toSafeAdmin(admin) {
  return {
    account:              str(admin.account).toLowerCase(),
    name:                 str(admin.name),
    email:                str(admin.email),
    role:                 normalizeRole(admin.role),
    status:               normalizeAdminStatus(admin.status),
    must_change_password: isTrue(admin.must_change_pw),
    created_at:           formatAdminTime(admin.created_at),
    last_login_at:        formatAdminTime(admin.last_login_at),
  };
}


/**
 * 狀態代碼正規化：只有剛好是 ACTIVE 才算啟用，其餘一律當成停用。
 *
 * 刻意與 adminLogin() 的判斷一致（那裡是 `!== ACTIVE` 就擋下）。
 * 兩邊若不一致，就會出現「列表顯示啟用中，但本人怎麼樣都登不進去」，
 * 而狀態欄只是被手動打錯成 ACTIVEE 之類的字。
 *
 * 這跟員工狀態的「認不得就當作在職」剛好相反，是刻意的：
 * 員工被誤擋只是少一筆回報，管理者權限則寧可從嚴。
 */
function normalizeAdminStatus(status) {
  return str(status).toUpperCase() === ADMIN_STATUS.ACTIVE
    ? ADMIN_STATUS.ACTIVE
    : ADMIN_STATUS.DISABLED;
}


/**
 * 把建立時間 / 最後登入時間轉成字串。
 *
 * 沒登入過的話那一欄是空的，要回傳空字串而不是 "Invalid Date"。
 * 不用 instanceof Date 判斷——本機測試的 sandbox 跨 realm 時它永遠是 false，
 * 改看有沒有 getTime() 比較可靠。
 */
function formatAdminTime(value) {
  if (!value) return '';
  if (typeof value.getTime === 'function') return formatTime(value);
  return str(value);
}


/**
 * Email 的寬鬆檢查：有沒有「東西@東西.東西」的樣子。
 *
 * 刻意不用嚴謹的規則——Email 的完整規格複雜到會誤擋合法地址，
 * 這裡只是要攔住「打錯字漏了 @」這種明顯的手誤。
 * Email 欄是日報 / 月報的收件人（規格 §10），留空也可以。
 */
function looksLikeEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(email));
}
