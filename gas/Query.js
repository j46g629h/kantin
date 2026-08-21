/**
 * 案件查詢 API（員工端）
 *
 * 兩種查法：
 *   - 案件編號 → 單筆
 *   - 工號     → 該員工的所有歷史案件
 *
 * ⚠️ 這兩支 API 不需要登入（員工不會有帳號），
 *    所以回傳內容刻意不含工號與姓名——查詢的人本來就知道自己是誰，
 *    不必讓「知道某個案件編號的人」順便看到是誰報的。
 */


/** 工號查詢最多回傳幾筆（由新到舊） */
const QUERY_MAX_RESULTS = 50;


/**
 * GET ?action=getCaseById&caseId=PCI-202608-001
 */
function getCaseById(params) {
  const caseId = str(params.caseId || params.case_id).toUpperCase();
  if (!caseId) return fail('CASE_ID_REQUIRED', '請輸入案件編號');

  const sheet = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return fail('CASE_NOT_FOUND', '查無此案件編號');

  const colMap = getFeedbackColumnMap();
  const match = sheet
    .getRange(2, colMap.case_id, lastRow - 1, 1)
    .createTextFinder(caseId)
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  if (!match) return fail('CASE_NOT_FOUND', '查無此案件編號');

  const values = sheet.getRange(match.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  if (isDeletedRow(values, colMap)) return fail('CASE_NOT_FOUND', '查無此案件編號');

  return ok({ cases: [buildPublicCase(values, colMap, buildHandlerMap())] });
}


/**
 * GET ?action=getCasesByEmpId&empId=0012345
 *
 * 回傳該工號的所有案件，由新到舊。
 */
function getCasesByEmpId(params) {
  const empId = str(params.empId || params.emp_id);
  if (!empId) return fail('EMP_ID_REQUIRED', '請輸入工號');

  const sheet = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return ok({ cases: [] });

  const colMap = getFeedbackColumnMap();
  const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const target = empId.toUpperCase();
  const handlerMap = buildHandlerMap();   // 一次建好，不要每筆案件各查一次名單

  // 排序用的時間另外存，不混進要回傳的資料裡——
  // 混在一起就得記得刪掉，而漏刪就會把內部欄位洩漏給前端
  const matched = [];
  rows.forEach(function (values) {
    if (isDeletedRow(values, colMap)) return;
    if (str(values[colMap.emp_id - 1]).toUpperCase() !== target) return;

    const submitTime = values[colMap.submit_time - 1];
    matched.push({
      sortKey: (submitTime instanceof Date) ? submitTime.getTime() : 0,
      data:    buildPublicCase(values, colMap, handlerMap),
    });
  });

  matched.sort(function (a, b) { return b.sortKey - a.sortKey; });   // 由新到舊

  return ok({
    cases: matched.slice(0, QUERY_MAX_RESULTS).map(function (m) { return m.data; }),
    total: matched.length,
  });
}


// ===== 共用 =====

/** 判斷是否為軟刪除的資料列 */
function isDeletedRow(values, colMap) {
  return str(values[colMap.is_deleted - 1]).toUpperCase() === 'TRUE';
}


/**
 * 把一列資料整理成要回傳給員工的格式。
 *
 * 只回傳員工需要看到的欄位——工號、姓名與稽核欄位都不回傳。
 *
 * ⚠️ 處理者的姓名與電話是例外，刻意回傳給員工：
 *    讓員工知道現在是誰在處理、可以打給誰問，不必再打去總機轉一圈。
 *    也因為這樣，「管理者名單」的電話欄請填**公務分機**，不要填私人手機
 *    （這支 API 不需要登入，任何知道案件編號的人都看得到）。
 */
function buildPublicCase(values, colMap, handlerMap) {
  const handler = resolveHandler(values[colMap.handler - 1], handlerMap || {});

  return {
    handler_name:  handler.name,
    handler_phone: handler.phone,
    case_id:         str(values[colMap.case_id - 1]),
    submit_time:     formatCellTime(values[colMap.submit_time - 1]),
    location_code:   str(values[colMap.location_code - 1]),
    meal_code:       str(values[colMap.meal_code - 1]),
    category_codes:  parseCategoryCodes(values[colMap.category_code - 1]),
    description:     str(values[colMap.description - 1]),
    rating:          Number(values[colMap.rating - 1]) || 0,
    status_code:     str(values[colMap.status_code - 1]) || 'ST_NEW',
    response:        str(values[colMap.response - 1]),
    response_time:   formatCellTime(values[colMap.response_time - 1]),
    images:          buildImageList(values[colMap.image_urls - 1]),
  };
}


/** 儲存格的時間可能是 Date 也可能是文字，統一轉成字串 */
function formatCellTime(value) {
  if (value instanceof Date) return formatTime(value);
  return str(value);
}


/**
 * 把儲存格裡的圖片連結整理成前端好用的格式。
 *
 * ⚠️ Sheet 裡存的是 Drive 的「檢視網頁」網址（.../file/d/{ID}/view）。
 *    那是一個 HTML 頁面，放進 <img> 顯示不出來，點下去還會跳離本系統。
 *
 *    這裡從網址取出檔案 ID，另外組出「圖片端點」的網址，
 *    前端就能直接內嵌顯示，使用者不必跳到 Google Drive。
 *
 * @return {Array} [{ preview_url, view_url }]
 */
function buildImageList(value) {
  return str(value)
    .split(String.fromCharCode(10))          // 換行分隔
    .map(function (u) { return u.trim(); })
    .filter(function (u) { return u; })
    .map(function (url) {
      const fileId = extractDriveFileId(url);
      return {
        // 直接回傳圖片內容，可放進 <img>。
        // sz=w1600 與前端壓縮後的尺寸一致，不會再被縮小
        preview_url: fileId
          ? 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600'
          : url,
        // 保留原始網址：圖片載入失敗時可退回用連結開啟
        view_url: url,
      };
    });
}


/** 從 Drive 網址取出檔案 ID（.../file/d/{ID}/view） */
function extractDriveFileId(url) {
  const match = str(url).match(new RegExp('/d/([a-zA-Z0-9_-]+)'));
  return match ? match[1] : '';
}
