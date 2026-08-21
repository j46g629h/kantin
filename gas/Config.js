/**
 * 系統設定與常數
 *
 * 所有 ID、分頁名稱、欄位定義都集中在這個檔案。
 * 其他檔案一律引用這裡的常數，不要各自寫死字串。
 */


// ===== Google 服務 ID =====

/** 資料用的 Google Sheet */
const SHEET_ID = '1E3GIGSWRA1XbxZCQvSm57gAOLTES3McfPu0nALMz2CA';

/** 圖片上傳的 Drive 資料夾（PCI餐廳回饋系統/圖片） */
const DRIVE_IMAGE_FOLDER_ID = '1Re_ua0-cEed27kKc91-pAOwNv8zZnKuk';


// ===== 分頁名稱 =====

const SHEETS = {
  FEEDBACK:  '回報資料',
  EMPLOYEES: '員工名冊',
  ADMINS:    '管理者名單',
  OPTIONS:   '選項設定',
  TEMPLATES: '回覆範本',
  COUNTERS:  '系統計數',
  LOGS:      '錯誤日誌',
};


// ===== 回報資料的欄位定義 =====

/**
 * 順序即為 Sheet 上的欄位順序。
 * `code` 是程式用的名稱，`name` 是 Sheet 表頭上顯示的中文。
 * 程式一律用 code 存取，這樣改中文表頭也不會壞（見 Utils.js 的 getFeedbackColumnMap）。
 */
const FEEDBACK_COLUMNS = [
  { code: 'case_id',          name: '案件編號',     width: 140, format: '@' },
  { code: 'submit_time',      name: '提交時間',     width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'emp_id',           name: '工號',         width: 100, format: '@' },
  { code: 'emp_name',         name: '姓名',         width: 110, format: '@' },
  { code: 'lang',             name: '語言',         width:  60, format: '@' },
  { code: 'location_code',    name: '餐廳地點',     width: 100, format: '@' },
  { code: 'meal_code',        name: '餐別',         width:  90, format: '@' },
  { code: 'category_code',    name: '問題分類',     width: 120, format: '@' },
  { code: 'description',      name: '問題描述',     width: 300, format: '@' },
  { code: 'rating',           name: '滿意度評分',   width:  90, format: '0' },
  { code: 'priority',         name: '優先層級',     width:  90, format: '@' },
  { code: 'image_urls',       name: '圖片連結',     width: 200, format: '@' },
  { code: 'status_code',      name: '處理狀態',     width:  90, format: '@' },
  { code: 'handler',          name: '處理者',       width: 100, format: '@' },
  { code: 'response',         name: '處理回覆',     width: 300, format: '@' },
  { code: 'response_time',    name: '處理時間',     width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'last_updated_at',  name: '最後更新時間', width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'last_updated_by',  name: '最後更新者',   width: 100, format: '@' },
  { code: 'client_submit_id', name: '提交識別碼',   width: 180, format: '@' },
  { code: 'is_deleted',       name: '已刪除',       width:  70, format: '@' },
];


// ===== 問題分類 =====

/**
 * 問題分類最多可選幾項。
 * 前端 js/config.js 也有同一個常數，兩邊要保持一致。
 * 資料在 Sheet 裡以逗號分隔存於同一欄，例如 CAT_TASTE,CAT_HYGIENE，
 * 第一個是使用者最先點選的，視為「主要分類」。
 */
const MAX_CATEGORIES = 2;


// ===== 選項設定分頁的類型 =====

const OPTION_TYPES = ['LOCATION', 'MEAL', 'CATEGORY', 'STATUS', 'PRIORITY', 'HANDLER'];


// ===== 快取秒數 =====

const CACHE_TTL = {
  /** 選項清單：管理者改了選項後，最多 10 分鐘會生效 */
  OPTIONS: 600,
  /** 查到的員工：名冊每月更新一次，快取 1 小時足夠 */
  EMPLOYEE_FOUND: 3600,
  /** 查不到的員工：只快取 1 分鐘，這樣新進員工加進名冊後很快就能用 */
  EMPLOYEE_MISS: 60,
};


// ===== 員工狀態 =====

const EMP_STATUS = {
  ACTIVE:   'ACTIVE',    // 在職，可以提交回報
  INACTIVE: 'INACTIVE',  // 離職或異常，無法提交回報（但歷史案件仍保留）
};

/**
 * 視為「停用」的狀態代碼。
 * 保留 LEFT 是為了相容早期資料，新資料一律用 INACTIVE。
 *
 * ⚠️ 刻意採「認不得就當作在職」：
 *    狀態欄若打錯字（例如 ACTIVEE），寧可讓員工還能回報，
 *    也不要無聲無息地把人擋在外面卻不知道為什麼。
 *    打錯的部分由 checkEmployeeRoster() 檢查出來。
 */
const EMP_STATUS_INACTIVE_CODES = ['INACTIVE', 'LEFT'];


// ===== Setup 用的 Drive 資料夾名稱 =====

const DRIVE_ROOT_FOLDER_NAME  = 'PCI餐廳回饋系統';
const DRIVE_IMAGE_FOLDER_NAME = '圖片';


// ===== 管理者名單的欄位定義 =====

/**
 * 與 FEEDBACK_COLUMNS 同樣的規則：程式一律用 code 存取，
 * Sheet 上的中文表頭改了也不會壞（見 Utils.js 的 getAdminColumnMap）。
 *
 * ⚠️ 密碼雜湊與鹽值的格式一定要是純文字 '@'。
 *    雜湊是 64 個十六進位字元，剛好整串都是數字時（機率很低但存在），
 *    Sheet 會把它當成數字存成 1.23457E+63，密碼從此永遠對不起來。
 */
const ADMIN_COLUMNS = [
  { code: 'name',           name: '姓名',         width: 110, format: '@' },
  { code: 'account',        name: '帳號',         width: 200, format: '@' },
  { code: 'email',          name: 'Email',        width: 200, format: '@' },
  { code: 'password_hash',  name: '密碼雜湊',     width: 260, format: '@' },
  { code: 'password_salt',  name: '密碼鹽值',     width: 140, format: '@' },
  { code: 'role',           name: '角色',         width:  80, format: '@' },
  { code: 'status',         name: '狀態',         width:  90, format: '@' },
  { code: 'must_change_pw', name: '需重設密碼',   width:  90, format: '@' },
  { code: 'created_at',     name: '建立時間',     width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
  { code: 'last_login_at',  name: '最後登入時間', width: 140, format: 'yyyy-mm-dd hh:mm:ss' },
];


// ===== 回覆範本的欄位定義 =====

const TEMPLATE_COLUMNS = [
  { code: 'code',       name: '代碼',       width: 100, format: '@' },
  { code: 'category',   name: '分類',       width: 120, format: '@' },
  { code: 'content_zh', name: '中文內容',   width: 360, format: '@' },
  { code: 'content_id', name: '印尼文內容', width: 360, format: '@' },
];


// ===== 管理者角色與狀態 =====

const ADMIN_ROLES = {
  SUPER: 'SUPER',   // 超級管理者：可管理帳號
  ADMIN: 'ADMIN',   // 一般管理者：只能處理案件
};

const ADMIN_STATUS = {
  ACTIVE:   'ACTIVE',     // 可登入
  DISABLED: 'DISABLED',   // 停用（離職不刪除，保留歷史處理紀錄）
};


// ===== 登入與密碼機制 =====

const AUTH = {
  /**
   * 密碼雜湊的迭代次數（規格 §5.1）。
   * 迭代的用意是讓「拿到 Sheet 的人暴力猜密碼」變慢 1000 倍。
   * 每次登入約多花數十毫秒，使用者感覺不出來。
   */
  HASH_ITERATIONS: 1000,

  /** 鹽值長度（每人不同的隨機字串） */
  SALT_LENGTH: 16,

  /** token 效期（秒）。6 小時（規格 §5.2） */
  TOKEN_TTL: 21600,

  /** 連續登入失敗幾次就鎖定 */
  MAX_LOGIN_FAILS: 5,

  /** 鎖定多久（秒） */
  LOCKOUT_SECONDS: 900,   // 15 分鐘

  /** 密碼最短長度 */
  MIN_PASSWORD_LENGTH: 8,
};

/** 快取鍵前綴（避免和選項快取之類的鍵撞名） */
const CACHE_KEYS = {
  TOKEN:      'admin_token_',
  LOGIN_FAIL: 'admin_fail_',
};


// ===== 管理端案件列表 =====

const CASE_LIST = {
  /** 一次回傳幾筆（前端沒指定時） */
  DEFAULT_LIMIT: 100,

  /** 一次最多回傳幾筆。防止有人把 limit 填成 99999 把 Apps Script 撐爆 */
  MAX_LIMIT: 300,

  /**
   * 逾期天數（規格 §6.5）。
   * 狀態仍是「未處理」且已超過這個天數的案件，在列表上整列標紅。
   */
  OVERDUE_DAYS: 3,
};


// ===== 案件回覆 =====

/**
 * 這些狀態一定要填回覆內容才能儲存。
 *
 * 為什麼：員工在查詢頁看得到狀態與回覆。
 * 狀態變成「處理中」或「已結案」卻沒有任何說明的話，
 * 員工只會看到一個結果卻不知道發生什麼事，反而更想來問。
 * 只有「未處理」不強制——那本來就是還沒開始處理的意思。
 */
const STATUS_REQUIRING_RESPONSE = ['ST_PROC', 'ST_DONE'];


// ===== 處理者指派 =====

/**
 * 處理者名單放在「選項設定」分頁，類型填 HANDLER。
 *
 * 為什麼不用「管理者名單」：
 * 處理者不一定是系統管理者——可能是廚房主管、清潔組長，
 * 這些人不需要登入系統，沒必要為了被指派而幫他們開帳號。
 * 放在選項設定就跟餐廳、問題分類一樣，加一列就多一個人，不必改程式。
 *
 * 「處理者」欄存的是代碼（例如 HDL_01），不是姓名（設計約定第 1 條）。
 * 顯示時才去選項設定查最新的姓名，這樣某人改名之後，
 * 連歷史案件顯示的名字都會跟著更新。
 *
 * 舊資料的處理者欄存的是姓名，查不到代碼時會直接顯示原字串，不會變成空白。
 */
const HANDLER_OPTION_TYPE = 'HANDLER';
