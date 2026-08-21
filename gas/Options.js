/**
 * 選項清單 API
 *
 * 餐廳地點、問題分類、處理狀態、優先層級都從「選項設定」分頁讀取，
 * 不寫死在程式裡——管理者自己在 Sheet 加一列就能新增選項。
 */


/**
 * GET ?action=getOptions
 *
 * 回傳：
 * {
 *   LOCATION: [ { code:'LOC_02', label_zh:'第二餐廳', label_id:'Kantin 2', sort:1 }, ... ],
 *   CATEGORY: [ ... ],
 *   STATUS:   [ ... ],
 *   PRIORITY: [ ... ]
 * }
 */
function getOptions(params) {
  const cached = storeGet('options');
  if (cached) {
    return ok(JSON.parse(cached));
  }

  const result = readOptionsFromSheet();
  storePut('options', JSON.stringify(result), CACHE_TTL.OPTIONS);
  return ok(result);
}


/** 從「選項設定」分頁讀取並整理成分類好的物件 */
function readOptionsFromSheet() {
  const sheet = getSheet(SHEETS.OPTIONS);
  const lastRow = sheet.getLastRow();

  const result = {};
  OPTION_TYPES.forEach(function (type) { result[type] = []; });

  if (lastRow < 2) return result;   // 只有表頭

  // 欄位順序：類型 / 代碼 / 中文顯示 / 印尼文顯示 / 排序 / 啟用
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

  rows.forEach(function (row) {
    const type = str(row[0]).toUpperCase();
    if (!result[type]) return;          // 不認識的類型就略過
    if (!isEnabled(row[5])) return;     // 未啟用的不回傳

    result[type].push({
      code:     str(row[1]),
      label_zh: str(row[2]),
      label_id: str(row[3]),
      sort:     Number(row[4]) || 0,
    });
  });

  // 依排序欄位排序
  OPTION_TYPES.forEach(function (type) {
    result[type].sort(function (a, b) { return a.sort - b.sort; });
  });

  return result;
}


/**
 * 判斷「啟用」欄位是否為真。
 * Sheet 上可能存成布林值 TRUE，也可能是文字 "TRUE"，兩種都要接受。
 */
function isEnabled(value) {
  if (value === true) return true;
  const s = str(value).toUpperCase();
  return s === 'TRUE' || s === 'Y' || s === 'YES' || s === '1';
}


/**
 * 清除選項快取。
 * 管理者改完選項後不想等 10 分鐘的話，可以在編輯器裡執行這個函式。
 */
function clearOptionsCache() {
  storeRemove('options');
  Logger.log('選項快取已清除，下次呼叫會重新讀取 Sheet');
}


// ===== 處理者 =====

/**
 * 建立「處理者代碼 → 姓名」的對照表。
 *
 * 案件的「處理者」欄存的是代碼（設計約定第 1 條），
 * 顯示時才查姓名——某人改名之後，連歷史案件顯示的名字都會跟著更新。
 *
 * ⚠️ 這張表刻意**包含已停用的處理者**：
 *    離職的人以前處理過的案件仍然要顯示得出是誰處理的。
 *    「可以指派給誰」是另一回事，那要用 canAssignHandler() 判斷。
 *
 * 一次建好整張表，不要每筆案件各查一次。
 */
function buildHandlerMap() {
  const sheet   = getSheet(SHEETS.OPTIONS);
  const lastRow = sheet.getLastRow();
  const map     = {};
  if (lastRow < 2) return map;

  // 欄位順序：類型 / 代碼 / 中文顯示 / 印尼文顯示 / 排序 / 啟用
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

  rows.forEach(function (row) {
    if (str(row[0]).toUpperCase() !== HANDLER_OPTION_TYPE) return;

    const code = str(row[1]);
    if (!code) return;

    // 姓名不需要翻譯，中文欄優先，沒填就用印尼文欄
    map[code.toUpperCase()] = {
      code:   code,
      name:   str(row[2]) || str(row[3]) || code,
      active: isEnabled(row[5]),
    };
  });

  return map;
}


/**
 * 這個代碼現在可以被指派嗎（存在，而且還啟用中）。
 *
 * ⚠️ 不能只看 buildHandlerMap() 裡有沒有這個 key。
 *    那張表刻意包含已停用的處理者，好讓歷史案件顯示得出姓名，
 *    但不能把新案子指派給已經離職的人。
 */
function canAssignHandler(code, handlerMap) {
  const found = handlerMap[str(code).toUpperCase()];
  return !!found && found.active === true;
}


/**
 * 把案件裡存的處理者值換成可顯示的資料。
 *
 * @param {string} raw 「處理者」欄的內容（代碼，或早期資料的姓名）
 * @param {Object} handlerMap buildHandlerMap() 的結果
 * @return {{code:string, name:string}} 沒有指派時兩個欄位都是空字串
 */
function resolveHandler(raw, handlerMap) {
  const value = str(raw);
  if (!value) return { code: '', name: '' };

  const found = handlerMap[value.toUpperCase()];
  // 只挑顯示需要的欄位；internal 的 active 不要跟著回傳出去
  if (found) return { code: found.code, name: found.name };

  // 查不到就把原字串當成姓名顯示。
  // 早期資料的處理者欄存的是姓名，這樣舊案件不會變成空白
  return { code: '', name: value };
}
