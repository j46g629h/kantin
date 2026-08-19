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
  const cache = CacheService.getScriptCache();
  const cached = cache.get('options');
  if (cached) {
    return ok(JSON.parse(cached));
  }

  const result = readOptionsFromSheet();
  cache.put('options', JSON.stringify(result), CACHE_TTL.OPTIONS);
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
  CacheService.getScriptCache().remove('options');
  Logger.log('選項快取已清除，下次呼叫會重新讀取 Sheet');
}
