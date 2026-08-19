/**
 * 回報提交 API
 *
 * 負責：驗證資料 → 防重複 → 產生案件編號 → 寫入 Sheet
 */


/** 同一工號每日提交上限（防灌水） */
const DAILY_SUBMIT_LIMIT = 10;


/**
 * POST { action:'submitFeedback', ... }
 *
 * 必填：emp_id、location_code、category_code、rating、client_submit_id
 * 選填：description（分類為 CAT_OTHER 時必填）、lang
 *
 * 成功：{ ok:true, data:{ case_id:'PCI-202608-001', emp_name:'...', duplicated:false } }
 */
function submitFeedback(params) {
  // ---------- 1. 基本欄位檢查 ----------
  const empId        = str(params.emp_id);
  const locationCode = str(params.location_code);
  const description  = str(params.description);
  const lang         = str(params.lang).toUpperCase() === 'ZH' ? 'ZH' : 'ID';
  const clientId     = str(params.client_submit_id);
  const rating       = Number(params.rating);

  // 問題分類可複選，前端以逗號分隔送來（例如 CAT_TASTE,CAT_HYGIENE）
  // 順序即點選順序，第一個視為主要分類
  const categoryCodes = parseCategoryCodes(params.category_code);

  if (!clientId)     return fail('SUBMIT_ID_REQUIRED', '缺少提交識別碼');
  if (!empId)        return fail('EMP_ID_REQUIRED', '請輸入工號');
  if (!locationCode) return fail('LOCATION_REQUIRED', '請選擇餐廳地點');
  if (categoryCodes.length === 0)              return fail('CATEGORY_REQUIRED', '請選擇問題分類');
  if (categoryCodes.length > MAX_CATEGORIES)   return fail('CATEGORY_TOO_MANY', '問題分類最多選 ' + MAX_CATEGORIES + ' 項');
  if (!(rating >= 1 && rating <= 5)) return fail('RATING_REQUIRED', '請選擇滿意度評分');

  // 「其他建議」沒有既定分類可循，必須說明內容
  if (categoryCodes.indexOf('CAT_OTHER') >= 0 && !description) {
    return fail('DESCRIPTION_REQUIRED', '選擇「其他建議」時請填寫說明');
  }

  // ---------- 2. 防重複提交 ----------
  // 網路慢時使用者可能連按多次，同一個 client_submit_id 只會寫入一次。
  // 第二次之後直接回傳既有的案件編號，讓前端顯示成功而不是報錯。
  const existing = findCaseByClientId(clientId);
  if (existing) {
    return ok({ case_id: existing.case_id, emp_name: existing.emp_name, duplicated: true });
  }

  // ---------- 3. 驗證工號 ----------
  const employee = findEmployeeInSheet(empId);
  if (!employee.exists)                      return fail('EMP_NOT_FOUND', '查無此工號，請確認後重新輸入');
  if (employee.status === EMP_STATUS.LEFT)   return fail('EMP_INACTIVE', '此工號已停用，請洽人事單位');

  // ---------- 4. 驗證選項代碼 ----------
  // 不能直接相信前端送來的代碼，否則有人改網頁原始碼就能塞任意值進資料庫
  const options = readOptionsFromSheet();
  if (!hasOptionCode(options.LOCATION, locationCode)) {
    return fail('LOCATION_INVALID', '餐廳地點不正確');
  }
  for (let i = 0; i < categoryCodes.length; i++) {
    if (!hasOptionCode(options.CATEGORY, categoryCodes[i])) {
      return fail('CATEGORY_INVALID', '問題分類不正確');
    }
  }

  // ---------- 5. 防灌水 ----------
  if (countTodaySubmissions(empId) >= DAILY_SUBMIT_LIMIT) {
    return fail('DAILY_LIMIT_EXCEEDED', '今日回報次數已達上限，請明天再試');
  }

  // ---------- 6. 產生編號並寫入（需要鎖）----------
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return fail('BUSY', '系統忙碌中，請稍後再試');
  }

  try {
    const caseId = generateCaseId();

    writeFeedbackRow({
      case_id:          caseId,
      submit_time:      new Date(),
      emp_id:           empId,
      emp_name:         employee.name,
      lang:             lang,
      location_code:    locationCode,
      category_code:    categoryCodes.join(','),
      description:      description,
      rating:           rating,
      priority:         'P_NORMAL',
      image_urls:       '',
      status_code:      'ST_NEW',
      handler:          '',
      response:         '',
      response_time:    '',
      last_updated_at:  new Date(),
      last_updated_by:  'SYSTEM',
      client_submit_id: clientId,
      is_deleted:       'FALSE',
    });

    return ok({ case_id: caseId, emp_name: employee.name, duplicated: false });

  } finally {
    // 鎖有可能因為執行時間過長而自動過期，此時 releaseLock() 會丟出例外。
    // 不包起來的話，已經寫入成功的結果會被這個例外蓋掉，
    // 使用者會看到「系統錯誤」但資料其實已經進去了。
    try { lock.releaseLock(); } catch (e) { Logger.log('釋放鎖失敗（可忽略）: ' + e); }
  }
}


// ===== 案件編號 =====

/**
 * 產生案件編號 PCI-YYYYMM-NNN。
 *
 * ⚠️ 一定要在 LockService 的鎖裡面呼叫。
 * 用「系統計數」分頁的計數器而不是掃描歷史資料的最大值，
 * 因為掃描最大值在兩人同時提交時會拿到相同的號碼。
 */
function generateCaseId() {
  const ym = currentYearMonth();
  const sheet = getSheet(SHEETS.COUNTERS);
  const lastRow = sheet.getLastRow();

  let targetRow = -1;
  if (lastRow >= 2) {
    const months = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < months.length; i++) {
      if (str(months[i][0]) === ym) { targetRow = i + 2; break; }
    }
  }

  let seq;
  if (targetRow === -1) {
    seq = 1;                                   // 這個月的第一筆
    sheet.appendRow([ym, seq]);
  } else {
    seq = Number(sheet.getRange(targetRow, 2).getValue()) + 1;
    sheet.getRange(targetRow, 2).setValue(seq);
  }

  return 'PCI-' + ym + '-' + String(seq).padStart(3, '0');
}


// ===== 寫入 =====

/**
 * 依欄位代碼寫入一列。
 * 用欄位對照表決定每個值該放第幾欄，所以就算日後欄位順序調整也不會寫錯位置。
 *
 * ⚠️ 這裡刻意不用 appendRow()。
 *    appendRow() 不會沿用儲存格既有的數值格式，它會自己判斷型別，
 *    結果就是工號 '0012345' 被當成數字存成 12345（前導零消失）、
 *    日期也不會套用 yyyy-mm-dd 格式。
 *    改成「先設定格式，再用 setValues 寫入」才能保住原本的字串。
 */
function writeFeedbackRow(data) {
  const sheet = getSheet(SHEETS.FEEDBACK);
  const colMap = getFeedbackColumnMap();
  const width = sheet.getLastColumn();

  // 準備這一列的值
  const row = new Array(width).fill('');
  Object.keys(data).forEach(function (code) {
    const col = colMap[code];
    if (col) row[col - 1] = data[code];
  });

  // 準備這一列的格式（預設純文字，再依欄位定義覆蓋）
  const formats = new Array(width).fill('@');
  FEEDBACK_COLUMNS.forEach(function (c) {
    const col = colMap[c.code];
    if (col) formats[col - 1] = c.format;
  });

  const targetRow = sheet.getLastRow() + 1;
  const range = sheet.getRange(targetRow, 1, 1, width);

  range.setNumberFormats([formats]);   // 順序很重要：一定要先設格式
  range.setValues([row]);              // 再寫值
}


// ===== 查詢輔助 =====

/** 用 client_submit_id 找既有案件（防重複用） */
function findCaseByClientId(clientId) {
  const sheet = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const colMap = getFeedbackColumnMap();
  const match = sheet
    .getRange(2, colMap.client_submit_id, lastRow - 1, 1)
    .createTextFinder(clientId)
    .matchEntireCell(true)
    .findNext();

  if (!match) return null;

  const rowValues = sheet.getRange(match.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  return {
    case_id:  str(rowValues[colMap.case_id - 1]),
    emp_name: str(rowValues[colMap.emp_name - 1]),
  };
}


/** 計算某工號今天已經提交幾筆 */
function countTodaySubmissions(empId) {
  const sheet = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const colMap = getFeedbackColumnMap();
  const empIds = sheet.getRange(2, colMap.emp_id, lastRow - 1, 1).getValues();
  const times  = sheet.getRange(2, colMap.submit_time, lastRow - 1, 1).getValues();
  const today  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  let count = 0;
  for (let i = 0; i < empIds.length; i++) {
    if (str(empIds[i][0]) !== empId) continue;
    const t = times[i][0];
    if (!(t instanceof Date)) continue;
    if (Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd') === today) count++;
  }
  return count;
}


/**
 * 把前端送來的分類字串拆成陣列。
 * 順便去除空白與重複，但保留原本的點選順序（第一個是主要分類）。
 */
function parseCategoryCodes(raw) {
  const parts = str(raw).split(',');
  const result = [];

  for (let i = 0; i < parts.length; i++) {
    const code = str(parts[i]);
    if (code && result.indexOf(code) === -1) result.push(code);
  }
  return result;
}


/** 檢查代碼是否存在於某個選項清單中 */
function hasOptionCode(list, code) {
  if (!list) return false;
  for (let i = 0; i < list.length; i++) {
    if (list[i].code === code) return true;
  }
  return false;
}
