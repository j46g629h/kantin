/**
 * 工號驗證 API
 *
 * 員工在表單輸入工號後，前端即時呼叫這支 API 取得姓名。
 *
 * 效能作法：8,000 筆名冊不適合每次全部讀出來比對。
 * 這裡改用 Sheet 內建的 TextFinder 搜尋（只在工號欄找），再把結果快取起來。
 */


/**
 * GET ?action=verifyEmployee&empId=0012345
 *
 * 成功：{ ok:true, data:{ emp_id:'0012345', emp_name:'Budi Santoso' } }
 * 失敗：{ ok:false, error:'EMP_NOT_FOUND', message:'查無此工號' }
 */
function verifyEmployee(params) {
  // 工號可能含英文字母，一律去除頭尾空白後比對（比對本身不分大小寫）
  const empId = str(params.empId || params.emp_id);

  if (!empId) {
    return fail('EMP_ID_REQUIRED', '請輸入工號');
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'emp:' + empId;

  // --- 先查快取 ---
  const cached = cache.get(cacheKey);
  if (cached) {
    const c = JSON.parse(cached);
    return buildEmployeeResult(empId, c);
  }

  // --- 快取沒有就查 Sheet ---
  const found = findEmployeeInSheet(empId);

  cache.put(
    cacheKey,
    JSON.stringify(found),
    found.exists ? CACHE_TTL.EMPLOYEE_FOUND : CACHE_TTL.EMPLOYEE_MISS
  );

  return buildEmployeeResult(empId, found);
}


/**
 * 在員工名冊裡尋找工號。
 * @return {{exists:boolean, name:string, status:string}}
 */
function findEmployeeInSheet(empId) {
  const sheet = getSheet(SHEETS.EMPLOYEES);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { exists: false, id: '', name: '', status: '' };
  }

  // 只在工號欄（第 1 欄）搜尋，matchEntireCell 確保 123 不會比對到 1234
  const searchRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const match = searchRange
    .createTextFinder(empId)
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  if (!match) {
    return { exists: false, id: '', name: '', status: '' };
  }

  const row = sheet.getRange(match.getRow(), 1, 1, 3).getValues()[0];
  return {
    exists: true,
    // 回傳「名冊上的寫法」而不是員工輸入的寫法。
    // 比對是不分大小寫的，若直接沿用輸入值，
    // 同一位員工打 a1234 和 A1234 會在資料庫留下兩種寫法，統計就會拆開。
    id:     str(row[0]),
    name:   str(row[1]),
    status: str(row[2]).toUpperCase() || EMP_STATUS.ACTIVE,
  };
}


/** 依查詢結果組出 API 回應 */
function buildEmployeeResult(empId, found) {
  if (!found.exists) {
    return fail('EMP_NOT_FOUND', '查無此工號，請確認後重新輸入');
  }
  if (found.status === EMP_STATUS.LEFT) {
    return fail('EMP_INACTIVE', '此工號已停用，請洽人事單位');
  }
  return ok({ emp_id: found.id || empId, emp_name: found.name });
}


/**
 * 清除單一工號的快取。
 * 名冊更新後某個工號查不到時可以用這個。
 * 使用方式：在編輯器裡把下面的工號改掉再執行。
 */
function clearEmployeeCache() {
  const empId = '0012345';   // ← 改成要清除的工號
  CacheService.getScriptCache().remove('emp:' + empId);
  Logger.log('已清除工號 ' + empId + ' 的快取');
}
