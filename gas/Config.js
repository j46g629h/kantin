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
  OPTIONS:   '選項設定',
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


// ===== 選項設定分頁的類型 =====

const OPTION_TYPES = ['LOCATION', 'CATEGORY', 'STATUS', 'PRIORITY'];


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
  ACTIVE: 'ACTIVE',
  LEFT:   'LEFT',
};


// ===== Setup 用的 Drive 資料夾名稱 =====

const DRIVE_ROOT_FOLDER_NAME  = 'PCI餐廳回饋系統';
const DRIVE_IMAGE_FOLDER_NAME = '圖片';
