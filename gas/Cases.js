/**
 * 管理端案件 API
 *
 * 規格 §6.5。與員工端的 Query.js 差別在於：
 *   - 需要登入（token 由 Main.js 的 withAuth() 驗好才會進來）
 *   - 回傳工號與姓名（員工端刻意不回傳，見 Query.js 的說明）
 *   - 多了篩選、統計卡片、逾期判斷
 */


/**
 * POST { action:'getCaseList', token, ...篩選條件 }
 *
 * 篩選條件（都可省略，省略就是不篩）：
 *   status_code    ST_NEW / ST_PROC / ST_DONE
 *   location_code  LOC_02 ...
 *   category_code  CAT_TASTE ...（複選案件只要含有這一項就算符合）
 *   date_from      YYYY-MM-DD（含當天）
 *   date_to        YYYY-MM-DD（含當天）
 *   keyword        案件編號 / 工號 / 姓名 / 描述，任一包含即符合
 *   limit          最多回傳幾筆，預設 100
 *
 * 回傳：
 * {
 *   cases:    [ ...由新到舊 ],
 *   total:    符合篩選條件的總筆數,
 *   returned: 這次實際回傳幾筆,
 *   stats:    { new, processing, done, this_month, overdue }
 * }
 */
function getCaseList(params, session) {
  const sheet   = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();

  const emptyResult = {
    cases: [], total: 0, returned: 0,
    stats: { new: 0, processing: 0, done: 0, this_month: 0, overdue: 0 },
  };
  if (lastRow < 2) return ok(emptyResult);

  const colMap = getFeedbackColumnMap();
  const rows   = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  const filter    = readCaseFilter(params);
  const now       = new Date();
  const thisMonth = currentYearMonth();

  // 統計卡片算的是「全部案件」，不受篩選條件影響——
  // 篩選後還跟著變的話，那就不是儀表板而是「目前畫面的計數」了
  const stats = { new: 0, processing: 0, done: 0, this_month: 0, overdue: 0 };
  const matched = [];

  rows.forEach(function (values) {
    if (isDeletedRow(values, colMap)) return;

    const item = buildAdminCase(values, colMap, now);

    // --- 統計（全部案件）---
    if (item.status_code === 'ST_PROC')      stats.processing++;
    else if (item.status_code === 'ST_DONE') stats.done++;
    else                                     stats.new++;     // 狀態空白或認不得都算未處理

    if (item.is_overdue) stats.overdue++;
    if (item.submit_month === thisMonth) stats.this_month++;

    // --- 篩選 ---
    if (matchCaseFilter(item, filter)) {
      matched.push(item);
    }
  });

  // 由新到舊（規格 §6.5：預設提交時間倒序）
  matched.sort(function (a, b) { return b.sort_key - a.sort_key; });

  const limit = readLimit(params.limit);
  const page  = matched.slice(0, limit).map(stripInternalFields);

  return ok({
    cases:    page,
    total:    matched.length,
    returned: page.length,
    stats:    stats,
  });
}


// ===== 篩選 =====

/** 把請求參數整理成篩選條件物件 */
function readCaseFilter(params) {
  return {
    status:   str(params.status_code).toUpperCase(),
    location: str(params.location_code).toUpperCase(),
    category: str(params.category_code).toUpperCase(),
    dateFrom: str(params.date_from),      // YYYY-MM-DD
    dateTo:   str(params.date_to),
    keyword:  str(params.keyword).toLowerCase(),
  };
}


/**
 * 判斷一筆案件是否符合篩選條件。
 *
 * 日期比較刻意用「YYYY-MM-DD 字串」而不是 Date 物件相減：
 * 字串比大小的結果跟日期先後完全一致，而且不必處理時區與時分秒，
 * 少一個最容易出錯的地方（例如 date_to 當天的下午 3 點被判定為超出範圍）。
 */
function matchCaseFilter(item, filter) {
  if (filter.status   && item.status_code   !== filter.status)   return false;
  if (filter.location && item.location_code !== filter.location) return false;

  // 分類是複選，只要其中一項符合就算
  if (filter.category && item.category_codes.indexOf(filter.category) === -1) return false;

  if (filter.dateFrom && item.submit_date < filter.dateFrom) return false;
  if (filter.dateTo   && item.submit_date > filter.dateTo)   return false;

  if (filter.keyword) {
    const haystack = [
      item.case_id, item.emp_id, item.emp_name, item.description, item.handler,
    ].join(' ').toLowerCase();
    if (haystack.indexOf(filter.keyword) === -1) return false;
  }

  return true;
}


/** 讀取 limit 並夾在合理範圍內 */
function readLimit(raw) {
  const value = Number(raw);
  if (!value || value <= 0) return CASE_LIST.DEFAULT_LIMIT;
  return Math.min(value, CASE_LIST.MAX_LIMIT);
}


// ===== 組資料 =====

/**
 * 把一列資料整理成管理端要的格式。
 *
 * 比員工端多了工號、姓名、處理者與逾期資訊。
 * 另外附上 sort_key / submit_date / submit_month 三個內部欄位供排序與篩選用，
 * 回傳前會由 stripInternalFields() 拿掉。
 */
function buildAdminCase(values, colMap, now) {
  const submitTime = values[colMap.submit_time - 1];
  const isDate     = submitTime instanceof Date;
  const tz         = Session.getScriptTimeZone();

  const statusCode  = str(values[colMap.status_code - 1]) || 'ST_NEW';
  const daysOpen    = isDate ? Math.floor((now - submitTime) / 86400000) : 0;

  return {
    case_id:        str(values[colMap.case_id - 1]),
    submit_time:    formatCellTime(submitTime),
    emp_id:         str(values[colMap.emp_id - 1]),
    emp_name:       str(values[colMap.emp_name - 1]),
    lang:           str(values[colMap.lang - 1]).toUpperCase() || 'ID',
    location_code:  str(values[colMap.location_code - 1]).toUpperCase(),
    meal_code:      str(values[colMap.meal_code - 1]).toUpperCase(),
    category_codes: parseCategoryCodes(values[colMap.category_code - 1]),
    description:    str(values[colMap.description - 1]),
    rating:         Number(values[colMap.rating - 1]) || 0,
    images:         buildImageList(values[colMap.image_urls - 1]),
    status_code:    statusCode,
    handler:        str(values[colMap.handler - 1]),
    response:       str(values[colMap.response - 1]),
    response_time:  formatCellTime(values[colMap.response_time - 1]),

    /** 已經放著幾天沒動了 */
    days_open: daysOpen,

    /** 未處理且超過 3 天 → 前端整列標紅（規格 §6.5） */
    is_overdue: statusCode === 'ST_NEW' && daysOpen >= CASE_LIST.OVERDUE_DAYS,

    // --- 以下是內部欄位，回傳前會拿掉 ---
    sort_key:     isDate ? submitTime.getTime() : 0,
    submit_date:  isDate ? Utilities.formatDate(submitTime, tz, 'yyyy-MM-dd') : '',
    submit_month: isDate ? Utilities.formatDate(submitTime, tz, 'yyyyMM')     : '',
  };
}


/**
 * 拿掉只給後端自己用的欄位。
 *
 * 為什麼要特地做這件事：排序鍵混在回傳資料裡的話，
 * 前端會看到一堆看不懂的欄位，而且哪天欄位改名就會忘記同步刪。
 * （員工端查詢就發生過 `_sortKey` 被一起回傳出去。）
 */
function stripInternalFields(item) {
  const clean = {};
  Object.keys(item).forEach(function (key) {
    if (key === 'sort_key' || key === 'submit_date' || key === 'submit_month') return;
    clean[key] = item[key];
  });
  return clean;
}
