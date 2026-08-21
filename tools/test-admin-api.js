/**
 * 本機測試帳號管理 API（manageAdmin，規格 §5.4）
 *
 *   list           列出管理者（最重要的是「不可以吐出密碼資料」）
 *   create         新增帳號
 *   setStatus      停用 / 啟用
 *   resetPassword  重設他人密碼
 *   setRole        調整角色
 *   withAuth       只有 SUPER 進得來
 *
 * 作法與 test-cases-api.js 相同：把 Apps Script 的全域服務用假的頂上，
 * 再把 gas/ 的檔案接起來在 Node 裡跑。不必部署、不必登入。
 *
 * 這一支比 test-cases-api.js 多兩件事：
 *
 *   1. **真的算 SHA-256。** 密碼雜湊是這一關的核心，
 *      用假的摘要函式測起來就沒有意義了，所以接 Node 的 crypto。
 *      這樣「新增帳號 → 用回傳的初始密碼登入」才是真的走完整條路。
 *
 *   2. **假的 PropertiesService。** token 存在那裡（見 gas/Store.js），
 *      而這一關有一半的重點是「改動帳號後，對方手上的 token 要立刻失效」。
 *
 * 執行：node tools/test-admin-api.js
 */
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TZ = 'Asia/Jakarta';
const NOW_ISO = '2026-08-20T12:00:00+07:00';

const ADMIN_HEADERS = ['姓名', '帳號', 'Email', '密碼雜湊', '密碼鹽值',
  '角色', '狀態', '需重設密碼', '建立時間', '最後登入時間'];

/**
 * 起始名單。密碼雜湊留空，稍後在 sandbox 裡用真的 hashPassword() 算出來填進去——
 * 這樣測試資料裡就不必出現任何寫死的雜湊值。
 */
const ADMIN_SEED = [
  // 姓名, 帳號, Email, hash, salt, 角色, 狀態, 需重設密碼, 建立時間, 最後登入
  { name: '系統管理者', account: 'super@pci',  email: 'super@pci.com', password: 'Super1234',
    role: 'SUPER', status: 'ACTIVE',   must: 'FALSE' },
  { name: '王小明',     account: 'ming@pci',   email: 'ming@pci.com',  password: 'Ming12345',
    role: 'ADMIN', status: 'ACTIVE',   must: 'FALSE' },
  { name: '李美華',     account: 'hua@pci',    email: '',              password: 'Hua123456',
    role: 'ADMIN', status: 'DISABLED', must: 'FALSE' },
  // 狀態欄被手動打錯字：登入會擋下，列表也必須顯示為停用，兩邊要一致
  { name: '打錯字的',   account: 'typo@pci',   email: '',              password: 'Typo12345',
    role: 'ADMIN', status: 'ACTIVEE', must: 'FALSE' },
];


// ---- 位元組轉換：Apps Script 的位元組是有號的（-128～127）----
const toSigned = (b) => (b > 127 ? b - 256 : b);

let uuidCounter = 0;

const sandbox = {
  console,
  Session: { getScriptTimeZone: () => TZ },

  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },

    /**
     * 計數器版的 UUID：每次都不同，但測試重跑結果一樣。
     *
     * ⚠️ 計數器一定要放在「最前面」。放結尾的話，
     *    generateSalt() 取前 16 個字元永遠拿到同一串，
     *    所有帳號的鹽值就會一模一樣——那等於整個鹽值機制都沒被測到。
     */
    getUuid() {
      uuidCounter++;
      const head = uuidCounter.toString(16).padStart(8, '0');
      return `${head}-0000-4000-8000-000000000000`;
    },

    newBlob(text) {
      const buf = Buffer.from(String(text), 'utf8');
      return { getBytes: () => Array.from(buf).map(toSigned) };
    },

    /** 真的算 SHA-256，密碼機制才測得準 */
    computeDigest(algorithm, bytes) {
      const buf = Buffer.from(bytes.map((b) => b & 0xFF));
      return Array.from(crypto.createHash('sha256').update(buf).digest()).map(toSigned);
    },

    formatDate(date, tz, fmt) {
      const shifted = new Date(date.getTime() + 7 * 3600 * 1000);   // 固定 Jakarta（UTC+7）
      const y   = shifted.getUTCFullYear();
      const m   = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const day = String(shifted.getUTCDate()).padStart(2, '0');
      const hh  = String(shifted.getUTCHours()).padStart(2, '0');
      const mm  = String(shifted.getUTCMinutes()).padStart(2, '0');
      const ss  = String(shifted.getUTCSeconds()).padStart(2, '0');
      if (fmt === 'yyyy-MM-dd') return `${y}-${m}-${day}`;
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    },
  },

  /** token 與登入失敗計數都存在這裡（gas/Store.js） */
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty:    (k) => (Object.prototype.hasOwnProperty.call(sandbox.__PROPS, k) ? sandbox.__PROPS[k] : null),
      setProperty:    (k, v) => { sandbox.__PROPS[k] = String(v); },
      deleteProperty: (k) => { delete sandbox.__PROPS[k]; },
      getProperties:  () => Object.assign({}, sandbox.__PROPS),
    }),
  },

  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => (name === '管理者名單' ? makeSheet(sandbox.__ADMINS, ADMIN_HEADERS) : null),
    }),
  },

  Logger: { log: () => {} },

  __PROPS: {},
  __ADMINS: [],
};


/**
 * 假的分頁物件。
 *
 * 與 test-cases-api.js 的版本差在：這裡的 setValue 會自動把列補出來，
 * 因為新增帳號寫的是 getLastRow() + 1，那一列本來還不存在。
 */
function makeSheet(rows, headers) {
  function ensureRow(index) {
    while (rows.length <= index) rows.push(headers.map(() => ''));
    return rows[index];
  }

  return {
    getLastRow: () => rows.length + 1,        // +1 是表頭
    getLastColumn: () => headers.length,

    getRange(row, col, numRows) {
      const n = numRows || 1;
      return {
        getValues() {
          if (row === 1) return [headers];
          return rows.slice(row - 2, row - 2 + n);
        },
        setNumberFormat() { return this; },
        setValue(v) { ensureRow(row - 2)[col - 1] = v; return this; },
      };
    },
  };
}

vm.createContext(sandbox);

// 1) 把 new Date() 固定成測試時間（帶參數的行為不變，物件仍 instanceof Date）
vm.runInContext(`
  const _RealDate = Date;
  Date = class extends _RealDate {
    constructor(...args) { if (args.length === 0) super(_FIXED_NOW); else super(...args); }
    static now() { return _FIXED_NOW; }
  };
`.replace(/_FIXED_NOW/g, String(new Date(NOW_ISO).getTime())), sandbox);

// 2) 載入要測的程式
['Config.js', 'Utils.js', 'Store.js', 'Auth.js', 'Admins.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});

// generateInitialPassword() 住在 Setup.js，那個檔案整個載進來會需要 DriveApp 等一堆服務，
// 只把用得到的兩支搬過來
const SETUP_SRC = fs.readFileSync(path.join(ROOT, 'gas', 'Setup.js'), 'utf8');
vm.runInContext(SETUP_SRC.match(/function generateInitialPassword[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(SETUP_SRC.match(/function pickRandom\(source\)[\s\S]*?\n}/)[0], sandbox);

// 3) 在 sandbox 裡用真的 hashPassword() 把起始名單的雜湊算出來
vm.runInContext(`
  __SEED = ${JSON.stringify(ADMIN_SEED)};
  __ADMINS = __SEED.map(function (s) {
    const salt = generateSalt();
    return [s.name, s.account, s.email, hashPassword(s.password, salt), salt,
            s.role, s.status, s.must, new Date('2026-01-01T00:00:00+07:00'), ''];
  });
  // 中間夾一列空白，確認會被略過（實務上有人整理 Sheet 時很容易留下空列）
  __ADMINS.push(['', '', '', '', '', '', '', '', '', '']);
`, sandbox);


// ---- 測試工具 ----
let pass = 0, failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}

/** 以某個身分呼叫 manageAdmin */
function callAs(session, params) {
  return vm.runInContext(
    `manageAdmin(${JSON.stringify(params)}, ${JSON.stringify(session)})`, sandbox);
}

const SUPER_SESSION = { account: 'super@pci', name: '系統管理者', role: 'SUPER', must_change_password: false };
// 這個身分只用來測「角色不夠會被擋下」。刻意不用王小明——
// 後面要精準數「停用會作廢幾支 token」，他身上不能有別處發出的 token
const ADMIN_SESSION = { account: 'hua@pci',   name: '李美華',     role: 'ADMIN', must_change_password: false };

const login  = (account, password) =>
  vm.runInContext(`adminLogin(${JSON.stringify({ account, password })})`, sandbox);
const evalIn = (code) => vm.runInContext(code, sandbox);

/** 取得某帳號目前在 Sheet 上的原始列（測試用，正式程式不該這樣讀） */
function rawRow(account) {
  return sandbox.__ADMINS.find((r) => String(r[1]).toLowerCase() === account);
}


console.log('\n===== manageAdmin：權限 =====\n');

check('沒有 token → UNAUTHORIZED',
  evalIn(`withAuth({token:'nope'}, function(){return ok({});}, true).error`), 'UNAUTHORIZED');

// 一般管理者拿到的是合法 token，但角色不夠
const adminToken = evalIn(`createSession(${JSON.stringify(ADMIN_SESSION)})`);
check('一般管理者呼叫 → FORBIDDEN',
  evalIn(`withAuth({token:${JSON.stringify(adminToken)}}, function(s){return manageAdmin({op:'list'}, s);}, true).error`),
  'FORBIDDEN');

const superToken = evalIn(`createSession(${JSON.stringify(SUPER_SESSION)})`);
check('超級管理者呼叫 → 通得過',
  evalIn(`withAuth({token:${JSON.stringify(superToken)}}, function(s){return manageAdmin({op:'list'}, s);}, true).ok`),
  true);

check('不支援的 op → UNKNOWN_OP', callAs(SUPER_SESSION, { op: 'drop' }).error, 'UNKNOWN_OP');
check('op 大小寫不拘',            callAs(SUPER_SESSION, { op: 'LIST' }).ok,   true);


console.log('\n===== list：列出管理者 =====\n');

const list1 = callAs(SUPER_SESSION, { op: 'list' });

check('回傳筆數（空白列被略過）', list1.data.admins.length, 4);

// 這一項是整支測試最重要的：密碼資料絕對不可以離開後端
const listKeys = Object.keys(list1.data.admins[0]).sort();
check('不含密碼雜湊',       listKeys.indexOf('password_hash') === -1, true);
check('不含密碼鹽值',       listKeys.indexOf('password_salt') === -1, true);
check('不含 Sheet 列號',    listKeys.indexOf('row') === -1,           true);
// 這一項刻意寫死整份清單：白名單多一個欄位就會失敗，
// 逼人回來確認「這一欄真的可以送到瀏覽器上嗎」
check('回傳欄位就是白名單那幾個', listKeys,
  ['account', 'created_at', 'email', 'last_login_at', 'must_change_password', 'name',
   'password_changed_at', 'role', 'status']);

check('超級管理者排在第一位', list1.data.admins[0].account, 'super@pci');
check('其餘依帳號排序',
  list1.data.admins.slice(1).map((a) => a.account), ['hua@pci', 'ming@pci', 'typo@pci']);

check('自己是誰',            list1.data.self, 'super@pci');
check('啟用中的超級管理者數', list1.data.active_super_count, 1);

const typo = list1.data.admins.find((a) => a.account === 'typo@pci');
check('狀態欄打錯字 → 顯示為停用（與登入行為一致）', typo.status, 'DISABLED');
check('狀態欄打錯字 → 真的登不進去',
  login('typo@pci', 'Typo12345').error, 'ACCOUNT_DISABLED');

check('沒登入過 → 最後登入時間是空字串',
  list1.data.admins.find((a) => a.account === 'hua@pci').last_login_at, '');
check('建立時間格式化成字串',
  list1.data.admins[0].created_at, '2026-01-01 00:00:00');
check('Email 留空的照樣回傳空字串',
  list1.data.admins.find((a) => a.account === 'hua@pci').email, '');


console.log('\n===== create：新增管理者 =====\n');

check('帳號空白 → 擋下',
  callAs(SUPER_SESSION, { op: 'create', name: '測試' }).error, 'ADMIN_ACCOUNT_REQUIRED');
check('姓名空白 → 擋下',
  callAs(SUPER_SESSION, { op: 'create', account: 'a@pci' }).error, 'ADMIN_NAME_REQUIRED');
check('帳號含空白 → 擋下',
  callAs(SUPER_SESSION, { op: 'create', account: 'a b@pci', name: '測試' }).error, 'ADMIN_ACCOUNT_INVALID');
check('Email 格式錯 → 擋下',
  callAs(SUPER_SESSION, { op: 'create', account: 'a@pci', name: '測試', email: 'not-an-email' }).error,
  'ADMIN_EMAIL_INVALID');
check('帳號重複 → 擋下',
  callAs(SUPER_SESSION, { op: 'create', account: 'ming@pci', name: '冒牌' }).error, 'ADMIN_EXISTS');
check('帳號重複（大小寫不同）→ 一樣擋下',
  callAs(SUPER_SESSION, { op: 'create', account: 'MING@PCI', name: '冒牌' }).error, 'ADMIN_EXISTS');

const created = callAs(SUPER_SESSION, { op: 'create', account: 'Baru@PCI', name: '新來的', email: 'baru@pci.com' });
check('新增成功',            created.ok, true);
check('帳號轉成小寫',        created.data.account, 'baru@pci');
check('角色預設為一般管理者', created.data.role, 'ADMIN');
check('回傳初始密碼',        typeof created.data.initial_password === 'string'
                          && created.data.initial_password.length === 12, true);
check('初始密碼符合密碼規則',
  evalIn(`validatePasswordRule(${JSON.stringify(created.data.initial_password)})`), '');

const baruRow = rawRow('baru@pci');
check('寫進 Sheet 的是雜湊，不是明文',
  baruRow.indexOf(created.data.initial_password) === -1, true);
check('密碼雜湊是 64 個十六進位字元',
  /^[0-9a-f]{64}$/.test(baruRow[3]), true);
check('狀態寫成 ACTIVE',      baruRow[6], 'ACTIVE');
check('需重設密碼寫成 TRUE',  baruRow[7], 'TRUE');
check('姓名寫對欄位',         baruRow[0], '新來的');
check('Email 寫對欄位',       baruRow[2], 'baru@pci.com');

// 端到端：用回傳的初始密碼真的登得進去
const firstLogin = login('baru@pci', created.data.initial_password);
check('用初始密碼登得進去',      firstLogin.ok, true);
check('登入後被要求強制改密碼',  firstLogin.data.must_change_password, true);
check('打錯密碼登不進去',        login('baru@pci', 'WrongPass123').error, 'LOGIN_FAILED');

const createdSuper = callAs(SUPER_SESSION, { op: 'create', account: 'super2@pci', name: '備用管理者', role: 'SUPER' });
check('可以指定建立超級管理者',  createdSuper.data.role, 'SUPER');
check('Email 留空也可以',        rawRow('super2@pci')[2], '');

const createdWeird = callAs(SUPER_SESSION, { op: 'create', account: 'weird@pci', name: '亂填角色', role: 'GOD' });
check('角色亂填 → 退回權限最小的 ADMIN', createdWeird.data.role, 'ADMIN');

check('新增後列表跟著變多',
  callAs(SUPER_SESSION, { op: 'list' }).data.admins.length, 7);
check('現在有兩位啟用中的超級管理者',
  callAs(SUPER_SESSION, { op: 'list' }).data.active_super_count, 2);


console.log('\n===== setStatus：停用 / 啟用 =====\n');

check('不存在的帳號 → 擋下',
  callAs(SUPER_SESSION, { op: 'setStatus', account: 'ghost@pci', status: 'DISABLED' }).error, 'ADMIN_NOT_FOUND');
check('狀態代碼亂填 → 擋下',
  callAs(SUPER_SESSION, { op: 'setStatus', account: 'ming@pci', status: 'MAYBE' }).error, 'ADMIN_STATUS_INVALID');
check('停用自己 → 擋下',
  callAs(SUPER_SESSION, { op: 'setStatus', account: 'super@pci', status: 'DISABLED' }).error, 'ADMIN_SELF_FORBIDDEN');

// 先讓王小明登入，等一下要確認「停用後他手上的 token 立刻失效」
const mingLogin = login('ming@pci', 'Ming12345');
check('王小明可以登入', mingLogin.ok, true);
const mingToken = mingLogin.data.token;
check('他的 token 有效',
  evalIn(`readSession(${JSON.stringify(mingToken)}) !== null`), true);

const disabled = callAs(SUPER_SESSION, { op: 'setStatus', account: 'ming@pci', status: 'DISABLED' });
check('停用成功',              disabled.ok, true);
check('Sheet 上寫成 DISABLED', rawRow('ming@pci')[6], 'DISABLED');
check('停用後登不進去',        login('ming@pci', 'Ming12345').error, 'ACCOUNT_DISABLED');

// 這是這一關補起來的洞：不作廢 token 的話，被停用的人 6 小時內照樣能改案件
check('停用會作廢他手上的 token',    disabled.data.revoked_sessions, 1);
check('那支 token 真的不能用了',
  evalIn(`readSession(${JSON.stringify(mingToken)}) === null`), true);
check('用那支 token 呼叫需登入的 API → UNAUTHORIZED',
  evalIn(`withAuth({token:${JSON.stringify(mingToken)}}, function(){return ok({});}).error`), 'UNAUTHORIZED');
check('別人的 token 不受影響',
  evalIn(`readSession(${JSON.stringify(superToken)}) !== null`), true);

const enabled = callAs(SUPER_SESSION, { op: 'setStatus', account: 'ming@pci', status: 'ACTIVE' });
check('啟用回來 → 又能登入了', login('ming@pci', 'Ming12345').ok, true);
check('啟用不需要作廢任何 token', enabled.data.revoked_sessions, 0);

// 只剩一位啟用中的超級管理者時，那一位不能被停用
callAs(SUPER_SESSION, { op: 'setStatus', account: 'super2@pci', status: 'DISABLED' });
check('停用第二位超級管理者 → 可以（還剩一位）',
  callAs(SUPER_SESSION, { op: 'list' }).data.active_super_count, 1);

// 換備用管理者當操作者，試著停用唯一剩下的那位
const SUPER2_SESSION = { account: 'super2@pci', name: '備用管理者', role: 'SUPER', must_change_password: false };
check('停用最後一位啟用中的超級管理者 → 擋下',
  callAs(SUPER2_SESSION, { op: 'setStatus', account: 'super@pci', status: 'DISABLED' }).error,
  'ADMIN_LAST_SUPER');
check('擋下後狀態沒有被改動', rawRow('super@pci')[6], 'ACTIVE');


console.log('\n===== resetPassword：重設他人密碼 =====\n');

check('不存在的帳號 → 擋下',
  callAs(SUPER_SESSION, { op: 'resetPassword', account: 'ghost@pci' }).error, 'ADMIN_NOT_FOUND');
check('重設自己 → 擋下（要走「變更密碼」）',
  callAs(SUPER_SESSION, { op: 'resetPassword', account: 'super@pci' }).error, 'ADMIN_SELF_RESET');

// 讓王小明先登入並連續打錯 4 次，等一下確認重設會一併解鎖
const mingToken2 = login('ming@pci', 'Ming12345').data.token;
for (let i = 0; i < 4; i++) login('ming@pci', 'WrongPass123');
check('連續失敗後剩餘次數會遞減',
  login('ming@pci', 'WrongPass123').data.attempts_left, 0);
check('第 6 次被鎖定', login('ming@pci', 'Ming12345').error, 'LOGIN_LOCKED');

const saltBeforeReset = rawRow('ming@pci')[4];
const reset = callAs(SUPER_SESSION, { op: 'resetPassword', account: 'ming@pci' });
check('重設成功',            reset.ok, true);
check('回傳新密碼',          typeof reset.data.initial_password === 'string'
                          && reset.data.initial_password.length === 12, true);
check('新密碼符合密碼規則',
  evalIn(`validatePasswordRule(${JSON.stringify(reset.data.initial_password)})`), '');
check('一併解除登入鎖定',    login('ming@pci', reset.data.initial_password).ok, true);
check('舊密碼失效',          login('ming@pci', 'Ming12345').error, 'LOGIN_FAILED');
check('重設後要求強制改密碼', rawRow('ming@pci')[7], 'TRUE');
check('重設會作廢他手上的 token', reset.data.revoked_sessions >= 1, true);
check('舊 token 真的不能用了',
  evalIn(`readSession(${JSON.stringify(mingToken2)}) === null`), true);
check('Sheet 上存的仍是雜湊，不是明文',
  rawRow('ming@pci').indexOf(reset.data.initial_password) === -1, true);
check('重設會換一組新的鹽值（不是沿用舊的）',
  rawRow('ming@pci')[4] !== saltBeforeReset, true);
check('每個帳號的鹽值都不一樣',
  rawRow('ming@pci')[4] !== rawRow('baru@pci')[4], true);


console.log('\n===== resetPassword：超級管理者自己設定密碼 =====\n');

// 規則檢查一樣要跑，不能因為是超級管理者設的就放行（規格 §5.5）
check('太短 → 擋下',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'Ab1' }).error,
  'PASSWORD_TOO_SHORT');
check('沒有英文字母 → 擋下',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'12345678' }).error,
  'PASSWORD_NEEDS_LETTER');
check('沒有數字 → 擋下',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'abcdefgh' }).error,
  'PASSWORD_NEEDS_DIGIT');

const beforeBadReset = rawRow('ming@pci')[3];
callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'Ab1' });
check('被擋下時密碼沒有被改動', rawRow('ming@pci')[3], beforeBadReset);

// 成功路徑
const CUSTOM = 'Kantin2026';
const saltBeforeCustom = rawRow('ming@pci')[4];
const customReset = callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:CUSTOM });

check('自訂密碼重設成功',      customReset.ok, true);
check('回傳的就是輸入那組',    customReset.data.initial_password, CUSTOM);
check('標記為「非系統產生」',  customReset.data.generated, false);
check('用這組密碼登得進去',    login('ming@pci', CUSTOM).ok, true);
check('自訂密碼一樣要求首次登入改掉', rawRow('ming@pci')[7], 'TRUE');
check('自訂密碼一樣換新鹽值',  rawRow('ming@pci')[4] !== saltBeforeCustom, true);
check('Sheet 上存的仍是雜湊，不是明文',
  rawRow('ming@pci').indexOf(CUSTOM) === -1, true);

// 前後空白：adminLogin() 收到密碼也會 trim，所以這裡先修掉才不會設出一組永遠登不進去的密碼。
// ⚠️ 這裡刻意不能用 CUSTOM 那一組——王小明已經在用了，
//    會被「不可與其他管理者重複」的規則擋下，測到的就不是空白處理了
const spaced = callAs(SUPER_SESSION, { op:'resetPassword', account:'hua@pci', new_password:'  Spaced2026  ' });
check('前後空白會被去掉',      spaced.data.initial_password, 'Spaced2026');

// 沒帶 new_password 就退回系統產生
const autoReset = callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci' });
check('沒帶 new_password → 系統產生',   autoReset.data.generated, true);
check('系統產生的是 12 碼',             autoReset.data.initial_password.length, 12);
check('只打空白 → 也視為沒帶，系統產生',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'   ' }).data.generated, true);

// 自訂密碼一樣要作廢對方的 token 與解除鎖定
evalIn(`revokeSessionsForAccount('ming@pci')`);
const liveToken = login('ming@pci', callAs(SUPER_SESSION,
  { op:'resetPassword', account:'ming@pci', new_password:'Kantin2027' }).data.initial_password).data.token;
const afterCustom = callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'Kantin2028' });
check('自訂密碼一樣會作廢對方 token', afterCustom.data.revoked_sessions, 1);
check('那支 token 真的失效',
  evalIn(`readSession(${JSON.stringify(liveToken)}) === null`), true);

// 自己不能用這條路徑改自己的密碼，帶了自訂密碼也一樣
check('帶自訂密碼改自己 → 一樣擋下',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'super@pci', new_password:'Kantin2026' }).error,
  'ADMIN_SELF_RESET');

// 收尾：把王小明的密碼設回前一段那組。
// 這一段改過他的密碼，不還原的話後面 setRole 的測試會登不進去——
// 而且失敗訊息會指向 setRole，跟真正的原因差了十萬八千里。
callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci',
                        new_password: reset.data.initial_password });


console.log('\n===== resetPassword：不可與其他管理者的密碼重複 =====\n');

// 先讓兩個帳號各有一組已知密碼
const P_MING = 'MingOwn2026';
const P_HUA  = 'HuaOwn2026';
callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:P_MING });
callAs(SUPER_SESSION, { op:'resetPassword', account:'hua@pci',  new_password:P_HUA  });

// 把王小明的密碼設成李美華正在用的那組 → 要被擋下
// （李美華在測試資料裡是停用狀態，所以驗證她的密碼沒被動到要比對雜湊，不能用登入）
const huaHashBefore = rawRow('hua@pci')[3];
const taken = callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:P_HUA });
check('與其他管理者重複 → 擋下', taken.error, 'ADMIN_PASSWORD_TAKEN');

// 這一條是安全要求，不是體驗問題：訊息洩漏「是誰在用」的話，
// 超級管理者就能用這支 API 當試探器，一組一組猜出特定帳號的密碼
check('訊息不可以提到是哪個帳號',
  /hua|美華|ming|小明|@pci/i.test(JSON.stringify(taken)), false);

check('被擋下時密碼沒有被改動', login('ming@pci', P_MING).ok, true);
check('被擋下時對方的密碼也沒被動到', rawRow('hua@pci')[3], huaHashBefore);

// 設成他自己現在這組 → 也擋，但用另一個代碼（訊息比較貼切）
check('與他自己目前的密碼相同 → 擋下',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:P_MING }).error,
  'ADMIN_PASSWORD_SAME');

// 沒重複的就放行
const fresh = callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'Brand2026New' });
check('沒有重複 → 通過',       fresh.ok, true);
check('新密碼可以登入',        login('ming@pci', 'Brand2026New').ok, true);
check('舊密碼失效',            login('ming@pci', P_MING).error, 'LOGIN_FAILED');

// 停用中的帳號也要算進去——他可能哪天被重新啟用
callAs(SUPER_SESSION, { op:'setStatus', account:'hua@pci', status:'DISABLED' });
check('已停用者的密碼也算重複',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:P_HUA }).error,
  'ADMIN_PASSWORD_TAKEN');
callAs(SUPER_SESSION, { op:'setStatus', account:'hua@pci', status:'ACTIVE' });

// 大小寫不同就是不同的密碼（密碼本來就區分大小寫）
check('只有大小寫不同 → 視為不重複',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:P_HUA.toUpperCase() }).ok,
  true);

// 系統產生那條路徑不受影響
check('系統產生不會被重複檢查擋住',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci' }).data.generated, true);

// 規則檢查要排在重複檢查前面（比較便宜，而且訊息更明確）
check('太短時回的是規則錯誤，不是重複錯誤',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'Ab1' }).error,
  'PASSWORD_TOO_SHORT');

// findPasswordClash 本身
check('查不到重複時回傳空字串',
  evalIn(`findPasswordClash('NobodyUses9999', 'ming@pci')`), '');
check('沒有密碼的空白列不會誤判',
  evalIn(`findPasswordClash('', 'ming@pci')`), '');

// 收尾：把王小明的密碼設回 setRole 那段要用的那組
callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci',
                        new_password: reset.data.initial_password });

console.log('\n===== setRole：調整角色 =====\n');

check('角色代碼亂填 → 擋下',
  callAs(SUPER_SESSION, { op: 'setRole', account: 'ming@pci', role: 'GOD' }).error, 'ADMIN_ROLE_INVALID');
check('不存在的帳號 → 擋下',
  callAs(SUPER_SESSION, { op: 'setRole', account: 'ghost@pci', role: 'ADMIN' }).error, 'ADMIN_NOT_FOUND');
check('調整自己的角色 → 擋下',
  callAs(SUPER_SESSION, { op: 'setRole', account: 'super@pci', role: 'ADMIN' }).error, 'ADMIN_SELF_ROLE');

// 前面的測試讓王小明登入過好幾次，先全部清掉，
// 「升級作廢了幾支」才會是確定的數字而不是隨測試順序浮動
evalIn(`revokeSessionsForAccount('ming@pci')`);
const mingToken3 = login('ming@pci', reset.data.initial_password).data.token;
const promoted = callAs(SUPER_SESSION, { op: 'setRole', account: 'ming@pci', role: 'SUPER' });
check('升級成功',              promoted.data.changed, true);
check('Sheet 上寫成 SUPER',    rawRow('ming@pci')[5], 'SUPER');
check('升級會作廢對方 token（角色是登入當下的快照）',
  promoted.data.revoked_sessions, 1);
check('對方那支 token 失效',
  evalIn(`readSession(${JSON.stringify(mingToken3)}) === null`), true);

check('角色沒有改變 → 不動作、不作廢 token',
  callAs(SUPER_SESSION, { op: 'setRole', account: 'ming@pci', role: 'SUPER' }).data,
  { account: 'ming@pci', role: 'SUPER', changed: false, revoked_sessions: 0 });

check('降級（還有別的啟用中超級管理者）→ 可以',
  callAs(SUPER_SESSION, { op: 'setRole', account: 'ming@pci', role: 'ADMIN' }).data.changed, true);

// 現在只剩 super@pci 一位啟用中的超級管理者
check('降級最後一位啟用中的超級管理者 → 擋下',
  callAs({ account: 'ming@pci', name: '王小明', role: 'SUPER' },
         { op: 'setRole', account: 'super@pci', role: 'ADMIN' }).error,
  'ADMIN_LAST_SUPER');
check('擋下後角色沒有被改動', rawRow('super@pci')[5], 'SUPER');

check('已停用的超級管理者可以降級（不影響可用人數）',
  callAs(SUPER_SESSION, { op: 'setRole', account: 'super2@pci', role: 'ADMIN' }).data.changed, true);


console.log('\n===== setName：修改姓名 =====\n');

check('姓名空白 → 擋下',
  callAs(SUPER_SESSION, { op:'setName', account:'ming@pci', name:'  ' }).error, 'ADMIN_NAME_REQUIRED');
check('不存在的帳號 → 擋下',
  callAs(SUPER_SESSION, { op:'setName', account:'ghost@pci', name:'鬼' }).error, 'ADMIN_NOT_FOUND');

// 讓王小明先登入，等一下要確認改名「不會」把他登出
evalIn(`revokeSessionsForAccount('ming@pci')`);
const mingPw = callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'RenameTest2026' })
  .data.initial_password;
const nameToken = login('ming@pci', mingPw).data.token;
check('改名前 token 有效', evalIn(`readSession(${JSON.stringify(nameToken)}) !== null`), true);
check('session 裡是舊名字',
  evalIn(`readSession(${JSON.stringify(nameToken)}).name`), '王小明');

const renamed = callAs(SUPER_SESSION, { op:'setName', account:'ming@pci', name:'王大明' });
check('改名成功',            renamed.data.changed, true);
check('Sheet 上寫成新名字',  rawRow('ming@pci')[0], '王大明');

// 這是這個功能的重點：不能像停用那樣把人踢出去，
// 只是改個名字就害對方工作到一半被登出，代價和收穫不成比例
check('改名不會把對方登出',
  evalIn(`readSession(${JSON.stringify(nameToken)}) !== null`), true);
check('但 session 裡的名字有跟著換',
  evalIn(`readSession(${JSON.stringify(nameToken)}).name`), '王大明');
check('回報有更新幾支 session', renamed.data.updated_sessions, 1);
check('改名後密碼不受影響',    login('ming@pci', mingPw).ok, true);

check('名字沒有變 → 不動作',
  callAs(SUPER_SESSION, { op:'setName', account:'ming@pci', name:'王大明' }).data,
  { account:'ming@pci', name:'王大明', changed:false, updated_sessions:0 });

check('前後空白會被去掉',
  callAs(SUPER_SESSION, { op:'setName', account:'ming@pci', name:'  王小明  ' }).data.name, '王小明');

// 改自己的名字是允許的（跟停用 / 改角色 / 重設密碼不同，這個沒有風險）
check('可以改自己的名字',
  callAs(SUPER_SESSION, { op:'setName', account:'super@pci', name:'系統管理員' }).data.changed, true);
check('改回來', callAs(SUPER_SESSION, { op:'setName', account:'super@pci', name:'系統管理者' }).ok, true);

// updateSessionsForAccount 只動該動的
evalIn(`__PROPS = {}`);
const tA = evalIn(`createSession({account:'a@pci', name:'舊A', role:'ADMIN'})`);
const tB = evalIn(`createSession({account:'b@pci', name:'舊B', role:'ADMIN'})`);
check('只更新指定帳號的 session',
  evalIn(`updateSessionsForAccount('a@pci', { name: '新A' })`), 1);
check('A 的名字換了', evalIn(`readSession(${JSON.stringify(tA)}).name`), '新A');
check('A 沒有被登出', evalIn(`readSession(${JSON.stringify(tA)}) !== null`), true);
check('B 完全不受影響', evalIn(`readSession(${JSON.stringify(tB)}).name`), '舊B');
check('帳號空白 → 什麼都不做', evalIn(`updateSessionsForAccount('', {name:'x'})`), 0);


console.log('\n===== 選填欄位：密碼最後變更時間 =====\n');

// 目前假 Sheet 的表頭「沒有」這一欄，等同還沒跑升級程式的正式環境。
// 線上事故 1 就是這個情境——當時直接丟例外，連登入都進不去
check('Sheet 還沒有這一欄 → buildColumnMap 不丟例外，回 undefined',
  evalIn(`getAdminColumnMap().password_changed_at === undefined`), true);
check('未升級時登入照常', login('ming@pci', 'RenameTest2026').ok, true);
check('未升級時列表照常', callAs(SUPER_SESSION, { op:'list' }).ok, true);
check('未升級時這個欄位回空字串',
  callAs(SUPER_SESSION, { op:'list' }).data.admins[0].password_changed_at, '');
check('未升級時重設密碼照常',
  callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'AfterMig2026' }).ok, true);

// 模擬跑完 migrateAddPasswordChangedAt()：表頭多一欄
ADMIN_HEADERS.push('密碼最後變更時間');
sandbox.__ADMINS.forEach((row) => row.push(''));

check('升級後 buildColumnMap 找得到',
  evalIn(`getAdminColumnMap().password_changed_at`), ADMIN_HEADERS.length);
check('升級前設的密碼沒有時間（系統不知道）',
  callAs(SUPER_SESSION, { op:'list' }).data.admins.find(a => a.account === 'ming@pci').password_changed_at, '');

callAs(SUPER_SESSION, { op:'resetPassword', account:'ming@pci', new_password:'Migrated2026' });
check('升級後重設密碼會記下時間',
  callAs(SUPER_SESSION, { op:'list' }).data.admins.find(a => a.account === 'ming@pci').password_changed_at,
  '2026-08-20 12:00:00');
check('別人的時間不受影響',
  callAs(SUPER_SESSION, { op:'list' }).data.admins.find(a => a.account === 'hua@pci').password_changed_at, '');
check('列表仍然不含密碼雜湊',
  Object.keys(callAs(SUPER_SESSION, { op:'list' }).data.admins[0]).indexOf('password_hash'), -1);


console.log('\n===== revokeSessionsForAccount：只砍該砍的 =====\n');

evalIn(`__PROPS = {};`);   // 清空重來，避免受前面測試殘留影響
const tokenA1 = evalIn(`createSession({account:'a@pci', name:'A', role:'ADMIN'})`);
const tokenA2 = evalIn(`createSession({account:'A@PCI', name:'A', role:'ADMIN'})`);
const tokenB  = evalIn(`createSession({account:'b@pci', name:'B', role:'ADMIN'})`);

check('同一帳號的多支 token 一起作廢（含大小寫不同的）',
  evalIn(`revokeSessionsForAccount('a@pci')`), 2);
check('A 的第一支失效', evalIn(`readSession(${JSON.stringify(tokenA1)}) === null`), true);
check('A 的第二支失效', evalIn(`readSession(${JSON.stringify(tokenA2)}) === null`), true);
check('B 的完全不受影響', evalIn(`readSession(${JSON.stringify(tokenB)}) !== null`), true);
check('帳號空白 → 什麼都不做', evalIn(`revokeSessionsForAccount('')`), 0);
check('查無 token 的帳號 → 回傳 0', evalIn(`revokeSessionsForAccount('nobody@pci')`), 0);


console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount > 0 ? 1 : 0);
