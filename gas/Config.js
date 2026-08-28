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


// ===== 前端網址 =====

/**
 * GitHub Pages 的網址。
 * 排程寄出的信裡要放「直接去看案件」的連結，所以後端也需要知道它。
 * 結尾的斜線不要拿掉，後面是直接接檔名的。
 */
const SITE_URL = 'https://j46g629h.github.io/kantin/';


// ===== 通知與報表（規格 §10）=====

const REPORT = {
  /** 每日未處理清單的寄送時間（時，Asia/Jakarta） */
  DAILY_HOUR: 8,

  /** 每月統計月報的寄送時間（每月 1 日，時） */
  MONTHLY_HOUR: 8,

  /**
   * 信件的寄件人顯示名稱。
   *
   * ⚠️ 只能改「顯示名稱」，改不了信箱地址——
   *    Apps Script 一律從專案擁有者的 Google 帳號寄出。
   *    要讓收件人一眼認出這是系統信，就靠這個名字。
   */
  SENDER_NAME: 'PCI 餐廳回饋系統 · Kantin PCI',

  /**
   * 一封信裡最多列幾筆案件。
   * 超過就只列前 N 筆並註明還有幾筆——
   * 沒有人會在信裡讀完 200 列表格，那種信只會被直接關掉。
   */
  MAX_ROWS: 50,
};


/**
 * 信件頁尾的系統資訊（維護單位 / 聯絡方式 / 系統版本）。
 *
 * ⚠️ **這是 `js/config.js` 的 SYSTEM_INFO 的複本，兩邊必須一模一樣。**
 *
 *    為什麼要複製一份：信是後端產生的，而 Apps Script 讀不到 GitHub Pages 上的
 *    前端檔案。要不複製就得每次寄信時上網抓一次 js/config.js——
 *    多一個會失敗的網路請求，只為了三行不會變的文字，不划算。
 *
 *    ⚠️ 但複製一份就會走鐘，而**版本號印錯比不印還糟**：
 *    有人拿著信裡的版本號來回報問題，你會去查錯的那一版。
 *
 *    所以有一支測試專門盯這件事，改前端版本號忘了改這裡的話它會紅掉：
 *
 *        node tools/test-version-sync.js
 *
 *    改版本號的完整清單見 CLAUDE.md 設計約定第 5 條。
 */
const SYSTEM_INFO = {
  version: 'v3.6',
  year:    '2026',

  /** 維護單位（信裡兩種語言並列，印尼文在前） */
  maintainer: {
    zh: 'PCI 總工務',
    id: 'PCI GA',
  },

  /** 聯絡分機（數字不需要翻譯） */
  contact: '3690',
};


// ===== 每月自動備份（關卡 4-4）=====

const BACKUP = {
  /**
   * 每月備份的執行時間（每月 1 日，時，Asia/Jakarta）。
   *
   * ⚠️ **一定要跟去識別化排在不同的小時，而且要早於它。**
   *    同一個小時的兩個觸發器**沒有先後順序保證**——
   *    Google 自己調度，有可能先跑去識別化再跑備份，
   *    那備份就備到已經被清掉的資料，安全網等於不存在。
   */
  MONTHLY_HOUR: 2,

  /**
   * 保留最近幾份備份。
   *
   * ⚠️ 為什麼要有上限，不是留越多越好：
   *    備份裡有工號、姓名、員工名冊。**永遠留著的話，
   *    「結案滿 13 個月去識別化」就變成做做樣子**——
   *    正本清乾淨了，備份裡那份個資還在。
   *    留三份 = 三個月的緩衝，夠發現問題，也不會讓個資無限期留存。
   */
  KEEP_COUNT: 3,

  /** 備份資料夾的名稱（建在圖片資料夾的同一層） */
  FOLDER_NAME: '備份',

  /**
   * 備份檔名的開頭。
   *
   * ⚠️ 清理舊備份時**只會刪掉開頭符合這個字串的檔案**。
   *    使用者自己放進備份資料夾的東西不會被誤刪——
   *    「自動清理」誤刪使用者的檔案是最不能發生的事。
   */
  NAME_PREFIX: '備份_',
};


// ===== 資料保存政策：結案滿 13 個月去識別化（關卡 4-5、規格 §11）=====

const RETENTION = {
  /** 幾個月之後去識別化 */
  MONTHS: 13,

  /**
   * 執行時間（每月 1 日，時，Asia/Jakarta）。
   *
   * ⚠️ **一定要晚於備份（BACKUP.MONTHLY_HOUR），而且不能同一個小時。**
   *    同一個小時的兩個觸發器沒有先後順序保證，
   *    先刪再備份的話，備到的是已經被清掉的資料，安全網等於不存在。
   */
  MONTHLY_HOUR: 5,

  /**
   * 最新的備份超過幾天就拒絕執行。
   *
   * ⚠️ 這是這支功能唯一的「不可以動手」開關。
   *    備份每月跑一次，正常情況下最多 31 天。
   *    設 45 天的意思是：**只要漏掉一次備份，就不准再刪任何東西。**
   */
  MAX_BACKUP_AGE_DAYS: 45,

  /**
   * 一次最多處理幾件。
   *
   * Apps Script 單次執行有 6 分鐘上限，每件要動 Sheet 與 Drive 好幾次。
   * 超過的部分下個月會接著處理——**但執行紀錄一定要寫出來還剩幾件**，
   * 不然「處理了 300 件」看起來像做完了，其實沒有。
   */
  MAX_PER_RUN: 300,

  /** 去識別化之後寫進「最後更新者」欄，當作稽核紀錄 */
  MARKER: '系統去識別化',
};


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

const OPTION_TYPES = ['LOCATION', 'MEAL', 'CATEGORY', 'STATUS', 'PRIORITY', 'HANDLER', 'REPORT_TO'];

/**
 * 報表額外收件人的類型代碼（規格 §10）。
 *
 * 收件人 = 啟用中的**超級管理者** ＋ 這份額外名單。
 *
 * 這一份放在「選項設定」分頁，跟處理者名單同一套作法（設計約定第 7 條）：
 * 要多寄給廠長、秘書，就加一列、啟用打勾；不想寄了把啟用改成 FALSE，
 * 不必刪掉那一列，也不必改程式。
 *
 * ⚠️ 這個類型的「代碼」欄放的是 **Email 地址**，不是代碼。
 *    其他類型的代碼是 LOC_02 這種識別碼，這裡的識別碼本來就是信箱本身。
 *    「中文顯示」欄放用途說明（例如「廠長」），只是給人看的備註。
 */
const REPORT_TO_OPTION_TYPE = 'REPORT_TO';


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

  /**
   * 密碼最後變更時間。
   *
   * ⚠️ 標成 optional：Sheet 上還沒有這一欄時，程式照常運作（只是不顯示這個時間），
   *    不會像線上事故 1 那樣連登入都進不去。
   *    執行 Setup.gs 的 migrateAddPasswordChangedAt() 之後才會開始記錄。
   *
   * 為什麼需要它：管理者名單上看不出「我剛剛重設的密碼有沒有生效」。
   * 密碼本身是查不回來的（存的是單向雜湊），能給的最有用資訊就是「什麼時候換的」。
   */
  { code: 'password_changed_at', name: '密碼最後變更時間', width: 140,
    format: 'yyyy-mm-dd hh:mm:ss', optional: true },
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

/** 檢視範圍選「全部時間」時用的代碼 */
const PERIOD_ALL = 'ALL';

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
