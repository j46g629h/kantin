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

  // 沒選月份就看本月
  const selectedMonth = normalizeMonth(params.month) || currentYearMonth();

  const emptyResult = {
    cases: [], total: 0, returned: 0,
    stats: { new: 0, processing: 0, done: 0, month_count: 0, overdue: 0, month: selectedMonth },
    available_months: [],
  };
  if (lastRow < 2) return ok(emptyResult);

  const colMap     = getFeedbackColumnMap();
  const rows       = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const handlerMap = buildHandlerMap();   // 一次建好，不要每筆案件各查一次名單

  const filter = readCaseFilter(params);
  const now    = new Date();

  /**
   * 統計卡片的算法刻意分成兩種：
   *   未處理 / 處理中 / 逾期 → 算「全部時間」，不受月份與篩選影響。
   *     這三個回答的是「我現在該做什麼」。三個月前沒處理完的案子今天一樣要處理，
   *     被月份篩掉反而會漏看。
   *   月份件數 → 只算選定的那個月。這個回答的是「那個月的量有多少」。
   */
  const stats = { new: 0, processing: 0, done: 0, month_count: 0, overdue: 0, month: selectedMonth };

  const monthSet = {};      // 有資料的月份，給前端做月份選單用
  const matched  = [];

  rows.forEach(function (values) {
    if (isDeletedRow(values, colMap)) return;

    const item = buildAdminCase(values, colMap, now, handlerMap);

    // --- 全時間統計 ---
    if (item.status_code === 'ST_PROC')      stats.processing++;
    else if (item.status_code === 'ST_DONE') stats.done++;
    else                                     stats.new++;     // 狀態空白或認不得都算未處理

    if (item.is_overdue) stats.overdue++;

    // --- 選定月份的件數 ---
    if (item.submit_month) {
      monthSet[item.submit_month] = (monthSet[item.submit_month] || 0) + 1;
      if (item.submit_month === selectedMonth) stats.month_count++;
    }

    // --- 篩選 ---
    if (matchCaseFilter(item, filter, selectedMonth)) {
      matched.push(item);
    }
  });

  // 由新到舊（規格 §6.5：預設提交時間倒序）
  matched.sort(function (a, b) { return b.sort_key - a.sort_key; });

  const limit = readLimit(params.limit);
  const page  = matched.slice(0, limit).map(stripInternalFields);

  return ok({
    cases:            page,
    total:            matched.length,
    returned:         page.length,
    stats:            stats,
    available_months: buildAvailableMonths(monthSet, selectedMonth),
  });
}


/**
 * 把「有資料的月份」整理成前端的月份選單。
 *
 * 只列出真的有案件的月份，選單裡就不會出現點下去一片空白的月份。
 * 目前選定的月份就算沒有資料也要保留，否則選單會突然少一項，
 * 使用者會以為自己的選擇被吃掉了。
 *
 * @return {Array} [{ month:'202608', count:10 }]，由新到舊
 */
function buildAvailableMonths(monthSet, selectedMonth) {
  if (selectedMonth && monthSet[selectedMonth] === undefined) {
    monthSet[selectedMonth] = 0;
  }

  return Object.keys(monthSet)
    .sort()
    .reverse()
    .map(function (month) {
      return { month: month, count: monthSet[month] };
    });
}


/** 把月份參數正規化成 YYYYMM；認不得的格式回傳空字串（等於不篩） */
function normalizeMonth(raw) {
  // 前端可能送 2026-08（<input type="month"> 的格式）或 202608，兩種都收
  const value = str(raw).replace('-', '');
  return /^\d{6}$/.test(value) ? value : '';
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
function matchCaseFilter(item, filter, selectedMonth) {
  // 月份是清單的主要範圍：看哪個月，清單就只顯示那個月
  if (selectedMonth && item.submit_month !== selectedMonth) return false;

  if (filter.status   && item.status_code   !== filter.status)   return false;
  if (filter.location && item.location_code !== filter.location) return false;

  // 分類是複選，只要其中一項符合就算
  if (filter.category && item.category_codes.indexOf(filter.category) === -1) return false;

  if (filter.dateFrom && item.submit_date < filter.dateFrom) return false;
  if (filter.dateTo   && item.submit_date > filter.dateTo)   return false;

  if (filter.keyword) {
    const haystack = [
      item.case_id, item.emp_id, item.emp_name, item.description,
      item.handler.name, item.handler.account,
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
function buildAdminCase(values, colMap, now, handlerMap) {
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

    /**
     * 處理者。Sheet 存的是帳號，這裡換成 { account, name, phone }。
     * 姓名與電話每次讀取都重新查，某人改名或換分機時歷史案件也會跟著更新。
     */
    handler:        resolveHandler(values[colMap.handler - 1], handlerMap || {}),
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


// ===== 更新案件（規格 §6.6）=====

/**
 * POST { action:'updateCase', token, case_id, status_code, response }
 *
 * 更新處理狀態與回覆內容，並自動記錄處理者、處理時間、最後更新資訊。
 *
 * 回傳更新後的整筆案件，前端直接replace畫面上那一筆就好，
 * 不必為了看到結果再多打一次 API（Apps Script 每次來回要 3～8 秒）。
 */
function updateCase(params, session) {
  const caseId     = str(params.case_id).toUpperCase();
  const statusCode = str(params.status_code).toUpperCase();
  const response   = str(params.response);
  const handler    = str(params.handler_account).toLowerCase();   // 空字串 = 不指派

  if (!caseId)     return fail('CASE_ID_REQUIRED', '缺少案件編號');
  if (!statusCode) return fail('STATUS_REQUIRED', '請選擇處理狀態');

  // 指派的對象必須是名單上還在職的管理者。
  // 不驗的話，有人改網頁原始碼就能把任意字串塞進處理者欄，
  // 員工查詢時就會看到一個查無此人的名字
  const handlerMap = buildHandlerMap();
  if (handler && !canBeAssigned(handler, handlerMap)) {
    return fail('HANDLER_INVALID', '指派的處理者不存在或已停用');
  }

  // 不能相信前端送來的代碼，否則有人改網頁原始碼就能塞任意值進資料庫
  const options = readOptionsFromSheet();
  if (!hasOptionCode(options.STATUS, statusCode)) {
    return fail('STATUS_INVALID', '處理狀態不正確');
  }

  // 「處理中」與「已結案」一定要有回覆，員工才知道發生了什麼事
  if (STATUS_REQUIRING_RESPONSE.indexOf(statusCode) >= 0 && !response) {
    return fail('RESPONSE_REQUIRED', '這個狀態需要填寫回覆內容');
  }

  // 兩位管理者同時處理同一件時，後存的會蓋掉先存的。
  // 加鎖讓兩次儲存排隊進行，至少不會寫到一半互相交錯
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return fail('BUSY', '系統忙碌中，請稍後再試');
  }

  try {
    const sheet  = getSheet(SHEETS.FEEDBACK);
    const colMap = getFeedbackColumnMap();
    const row    = findCaseRow(sheet, colMap, caseId);

    if (!row) return fail('CASE_NOT_FOUND', '查無此案件編號');

    const before = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (isDeletedRow(before, colMap)) return fail('CASE_NOT_FOUND', '查無此案件編號');

    const now         = new Date();
    const editorName  = str(session.name) || str(session.account);
    const oldResponse = str(before[colMap.response - 1]);

    setTextCell(sheet, row, colMap.status_code, statusCode);
    setTextCell(sheet, row, colMap.response,    response);

    // 「處理者」是被指派負責的人，「最後更新者」才是實際按下儲存的人。
    // 兩者分開，才查得出「這件事是誰負責的」與「這次是誰改的」
    setTextCell(sheet, row, colMap.handler, handler);

    // 處理時間代表「這句回覆是什麼時候寫的」，
    // 所以只有回覆內容真的變了才更新。單純改狀態不該讓時間跳動
    if (response !== oldResponse) {
      setDateCell(sheet, row, colMap.response_time, now);
    }

    // 稽核用：任何一次儲存都留下紀錄
    setDateCell(sheet, row, colMap.last_updated_at, now);
    setTextCell(sheet, row, colMap.last_updated_by, editorName);

    const after = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    return ok({ case: stripInternalFields(buildAdminCase(after, colMap, now, handlerMap)) });

  } finally {
    // 執行過久時鎖會自動過期，releaseLock() 會丟出例外。
    // 不包起來的話，已經存好的結果會被這個例外蓋掉，
    // 使用者會看到「系統錯誤」但資料其實已經寫進去了
    try { lock.releaseLock(); } catch (e) { Logger.log('釋放鎖失敗（可忽略）: ' + e); }
  }
}


/**
 * 用案件編號找出所在列號。
 *
 * ⚠️ 一律用 case_id 找，不可以記列號。
 *    有人在 Sheet 手動插入或刪除列，記下來的列號就全錯了，
 *    而且錯得無聲無息——會更新到別人的案件上。
 *
 * @return {number|null} 列號，找不到回傳 null
 */
function findCaseRow(sheet, colMap, caseId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const match = sheet
    .getRange(2, colMap.case_id, lastRow - 1, 1)
    .createTextFinder(caseId)
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  return match ? match.getRow() : null;
}


// ===== 回覆範本（規格 §3.5）=====

/**
 * POST { action:'getTemplates', token }
 *
 * 回傳「回覆範本」分頁的全部內容，讓管理者一鍵帶入再修改。
 * 範本由管理者自己在 Sheet 上增修，不需要改程式。
 */
function getTemplates(params, session) {
  const sheet   = getSheet(SHEETS.TEMPLATES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return ok({ templates: [] });

  const colMap = buildColumnMap(SHEETS.TEMPLATES, TEMPLATE_COLUMNS);
  const rows   = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  const templates = [];
  rows.forEach(function (values) {
    const item = {
      code:       str(values[colMap.code - 1]),
      category:   str(values[colMap.category - 1]).toUpperCase(),
      content_zh: str(values[colMap.content_zh - 1]),
      content_id: str(values[colMap.content_id - 1]),
    };
    // 兩種語言都空白的列視為未填完，不回傳
    if (item.content_zh || item.content_id) templates.push(item);
  });

  return ok({ templates: templates });
}
