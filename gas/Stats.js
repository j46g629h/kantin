/**
 * Dashboard 統計（規格 §3.8、§10.2）
 *
 * 一支 `getDashboardStats`，只有超級管理者能用
 * （路由在 gas/Main.js，用 withAuth(p, handler, true) 包起來）。
 *
 *
 * 📌 為什麼一次把「所有月份、所有年份」的統計全部算好回傳：
 *
 *    Apps Script 每次回應要 3～8 秒。如果切一次月份就打一次 API，
 *    這個頁面會難用到沒有人想開——而 Dashboard 的用途本來就是「快速掃過去」。
 *
 *    全部先算好的話，前端切換下拉是瞬間的。
 *    資料量完全不是問題：每個月的統計只是一個小物件，
 *    每月 50 筆回報的規模下，累積十年也才 120 個月份。
 *
 *
 * ⚠️ 三個定義要先講清楚，不然數字對不起來時會找很久：
 *
 * 1. **平均處理天數**只算「已結案」的案件，從提交到處理時間的天數。
 *    沒結案的不算——它們還在跑，現在把它們算進去只會讓數字每天變動。
 *
 * 2. **平均滿意度**只算有評分的案件（評分 > 0）。
 *    評分是必填，但舊資料或手動補的列可能是空的，
 *    把空白當成 0 分會把平均值整個拉垮。
 *
 * 3. **問題分類佔比用「按出現次數」**：一筆案件選了兩個分類就各算 1 次，
 *    所以**各分類佔比加起來會超過 100%**（規格 §10 的提醒）。
 *    前端的副標一定要寫明這件事，否則有人一加總會以為系統壞了。
 */


/**
 * POST { action:'getDashboardStats', token }
 *
 * 回傳：
 * {
 *   months: { '202608': {...月統計}, ... },
 *   years:  { '2026':   {...年統計}, ... },
 *   available_months: ['202608', '202607', ...],   // 新到舊
 *   available_years:  ['2026', ...],               // 新到舊
 *   generated_at: 'yyyy-MM-dd HH:mm:ss'
 * }
 *
 * 沒有任何資料時，兩個清單都是空陣列（前端顯示「還沒有資料」）。
 */
function getDashboardStats(params, session) {
  const sheet   = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();

  const empty = {
    months: {}, years: {},
    available_months: [], available_years: [],
    generated_at: formatTime(new Date()),
  };
  if (lastRow < 2) return ok(empty);

  const colMap = getFeedbackColumnMap();
  const tz     = Session.getScriptTimeZone();
  const rows   = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  const months = {};
  const years  = {};

  rows.forEach(function (values) {
    // 軟刪除的不算（設計約定第 4 條）。漏掉這一行的話，
    // 統計數字會比實際多，而且永遠找不出多在哪裡
    if (isTrue(values[colMap.is_deleted - 1])) return;
    if (!str(values[colMap.case_id - 1])) return;      // 空白列

    const submitTime = values[colMap.submit_time - 1];
    if (!submitTime || typeof submitTime.getTime !== 'function') return;

    const monthKey = Utilities.formatDate(submitTime, tz, 'yyyyMM');
    const yearKey  = Utilities.formatDate(submitTime, tz, 'yyyy');
    const monthNum = Number(Utilities.formatDate(submitTime, tz, 'MM'));

    const item = {
      status:   str(values[colMap.status_code - 1]).toUpperCase() || 'ST_NEW',
      location: str(values[colMap.location_code - 1]).toUpperCase(),
      rating:   Number(values[colMap.rating - 1]) || 0,
      categories: parseCategoryCodes(values[colMap.category_code - 1]),
      days:     closedDays(submitTime, values[colMap.response_time - 1],
                           str(values[colMap.status_code - 1]).toUpperCase()),
    };

    if (!months[monthKey]) months[monthKey] = newBucket();
    if (!years[yearKey])   years[yearKey]   = newYearBucket();

    addToBucket(months[monthKey], item);
    addToBucket(years[yearKey], item);

    // 年度趨勢用：每個月一格，1 月在 index 0
    const slot = years[yearKey].monthly[monthNum - 1];
    slot.count += 1;
    if (item.rating > 0) { slot.rating_sum += item.rating; slot.rating_n += 1; }
  });

  const monthKeys = Object.keys(months).sort().reverse();
  const yearKeys  = Object.keys(years).sort().reverse();

  const outMonths = {};
  monthKeys.forEach(function (k) { outMonths[k] = finishBucket(months[k]); });

  const outYears = {};
  yearKeys.forEach(function (k) { outYears[k] = finishYearBucket(years[k]); });

  return ok({
    months: outMonths,
    years:  outYears,
    available_months: monthKeys,
    available_years:  yearKeys,
    generated_at: formatTime(new Date()),
  });
}


// ===== 累加用的容器 =====

function newBucket() {
  return {
    total: 0, nw: 0, processing: 0, done: 0,
    rating_sum: 0, rating_n: 0,
    days_sum: 0, days_n: 0,
    by_location: {}, by_status: {}, by_category: {},
    // 各餐廳的年度表現要用（月統計用不到，留著不影響）
    loc_detail: {},
  };
}

function newYearBucket() {
  const bucket = newBucket();
  bucket.monthly = [];
  for (let i = 0; i < 12; i++) {
    bucket.monthly.push({ count: 0, rating_sum: 0, rating_n: 0 });
  }
  return bucket;
}


function addToBucket(bucket, item) {
  bucket.total += 1;

  // 狀態空白或認不得的一律算未處理，與案件列表、日報的判斷一致。
  // 三邊若不一致，同一批資料在三個地方會顯示三種數字
  if (item.status === 'ST_PROC')      bucket.processing += 1;
  else if (item.status === 'ST_DONE') bucket.done += 1;
  else                                bucket.nw += 1;

  bump(bucket.by_status, item.status || 'ST_NEW');
  if (item.location) bump(bucket.by_location, item.location);

  // 按出現次數：一筆選了兩個分類就各算 1 次，所以總和會超過案件數
  item.categories.forEach(function (code) { bump(bucket.by_category, code); });

  if (item.rating > 0) { bucket.rating_sum += item.rating; bucket.rating_n += 1; }
  if (item.days !== null) { bucket.days_sum += item.days; bucket.days_n += 1; }

  // 各餐廳表現：回報數 / 平均滿意度 / 結案率 / 平均處理天數
  if (item.location) {
    if (!bucket.loc_detail[item.location]) {
      bucket.loc_detail[item.location] = {
        total: 0, done: 0, rating_sum: 0, rating_n: 0, days_sum: 0, days_n: 0,
      };
    }
    const d = bucket.loc_detail[item.location];
    d.total += 1;
    if (item.status === 'ST_DONE') d.done += 1;
    if (item.rating > 0) { d.rating_sum += item.rating; d.rating_n += 1; }
    if (item.days !== null) { d.days_sum += item.days; d.days_n += 1; }
  }
}


/** 把累加用的容器換算成前端要的數字 */
function finishBucket(bucket) {
  return {
    total:      bucket.total,
    new:        bucket.nw,
    processing: bucket.processing,
    done:       bucket.done,
    done_rate:  ratio(bucket.done, bucket.total),
    avg_rating: average(bucket.rating_sum, bucket.rating_n),
    avg_days:   average(bucket.days_sum, bucket.days_n),
    by_location: toSortedList(bucket.by_location),
    by_status:   toSortedList(bucket.by_status),
    by_category: toSortedList(bucket.by_category),
  };
}


function finishYearBucket(bucket) {
  const out = finishBucket(bucket);

  // 趨勢圖固定畫 1～12 月。
  //
  // ⚠️ 沒有資料的月份，回報數是 0（那是事實：那個月就是沒人回報），
  //    但平均滿意度回傳 null 而不是 0——
  //    「沒有人回報」跟「大家都給 0 分」是完全不同的兩件事，
  //    畫成 0 會讓那幾個月看起來像災難。前端遇到 null 要斷線，不要連到 0。
  out.monthly = bucket.monthly.map(function (m, i) {
    return {
      month:      i + 1,
      count:      m.count,
      avg_rating: m.rating_n > 0 ? average(m.rating_sum, m.rating_n) : null,
    };
  });

  out.locations = locationList(bucket);

  return out;
}


/**
 * 把 loc_detail 換算成「各餐廳表現」的清單。
 *
 * 年統計與每月月報都要用（規格 §10.2 的「平均滿意度（整體 + 各餐廳）」），
 * 所以獨立成一支——兩邊各寫一次的話，哪天結案率的算法改了只會改到其中一邊，
 * 而 Dashboard 與信裡的數字不一樣是最難查的那種問題。
 *
 * @return {Array} [{ code, total, avg_rating, done_rate, avg_days }]，回報數多的排前面
 */
function locationList(bucket) {
  return Object.keys(bucket.loc_detail).map(function (code) {
    const d = bucket.loc_detail[code];
    return {
      code:       code,
      total:      d.total,
      avg_rating: average(d.rating_sum, d.rating_n),
      done_rate:  ratio(d.done, d.total),
      avg_days:   average(d.days_sum, d.days_n),
    };
  }).sort(function (a, b) { return b.total - a.total; });   // 回報數多的排前面
}


// ===== 小工具 =====

function bump(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

/** { code: n } → [{ code, count }]，由多到少 */
function toSortedList(map) {
  return Object.keys(map).map(function (code) {
    return { code: code, count: map[code] };
  }).sort(function (a, b) { return b.count - a.count; });
}

/** 平均值，取到小數點後一位；沒有樣本回傳 null（不是 0） */
function average(sum, n) {
  return n > 0 ? Math.round(sum / n * 10) / 10 : null;
}

/** 百分比，取整數；分母 0 回傳 null */
function ratio(part, whole) {
  return whole > 0 ? Math.round(part / whole * 100) : null;
}


/**
 * 這件案子花了幾天結案？
 *
 * 只算已結案的：沒結案的案件天數每天都在變，
 * 把它們算進平均值的話，這個數字會每天自己往上漂，看不出真正的處理效率。
 *
 * 用「處理時間」當結案時間點——那一欄只有在回覆內容變動時才更新
 * （見 gas/Cases.js），也就是「最後一次寫回覆」的時間，
 * 對已結案的案件來說就是結案的時間。
 *
 * @return {number|null} 天數；不適用時回傳 null
 */
function closedDays(submitTime, responseTime, statusCode) {
  if (statusCode !== 'ST_DONE') return null;
  if (!responseTime || typeof responseTime.getTime !== 'function') return null;

  const days = (responseTime.getTime() - submitTime.getTime()) / 86400000;

  // 負數代表資料有問題（手動改過時間），不要讓它把平均值拉歪
  return days >= 0 ? Math.round(days * 10) / 10 : null;
}


// ===== 每月月報用的統計（規格 §10.2）=====

/**
 * 算出某一個月的統計，給每月月報用。
 *
 * 為什麼不直接呼叫 getDashboardStats()：那一支是給網頁用的，
 * 會把**所有月份、所有年份**全部算完（前端要能瞬間切換下拉），
 * 而月報只需要其中一個月。更重要的是它需要 session（只有 SUPER 能用），
 * 但排程執行時沒有任何人登入，根本沒有 session 可以給。
 *
 * 底層用的是同一組 newBucket / addToBucket / finishBucket，
 * 所以**信裡的數字與 Dashboard 上的數字一定一致**——
 * 這件事比省幾行程式重要得多：兩邊各算一次的話，
 * 哪天口徑改了只會改到一邊，而「網頁說 12 件、信裡說 13 件」
 * 會讓人開始懷疑整個系統的數字。
 *
 * 順便把「前一個月」也算出來（同一趟掃描，不多花成本），
 * 信裡才有比較基準——單獨一個「本月 23 件」是看不出好壞的。
 *
 * @param  {string} monthKey 'yyyyMM'
 * @return {Object} finishBucket 的結果，另外加上：
 *                  month / locations / open_cases / open_total / previous
 */
function buildMonthlyStats(monthKey) {
  const prevKey = previousMonthKey(monthKey);

  const bucket = newBucket();
  const prev   = newBucket();
  const open   = [];

  const sheet   = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const colMap = getFeedbackColumnMap();
    const tz     = Session.getScriptTimeZone();
    const now    = new Date();
    const rows   = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    rows.forEach(function (values) {
      // 軟刪除的不算（設計約定第 4 條）
      if (isTrue(values[colMap.is_deleted - 1])) return;
      if (!str(values[colMap.case_id - 1])) return;      // 空白列

      const submitTime = values[colMap.submit_time - 1];
      if (!submitTime || typeof submitTime.getTime !== 'function') return;

      const key = Utilities.formatDate(submitTime, tz, 'yyyyMM');
      if (key !== monthKey && key !== prevKey) return;

      const status = str(values[colMap.status_code - 1]).toUpperCase() || 'ST_NEW';

      const item = {
        status:     status,
        location:   str(values[colMap.location_code - 1]).toUpperCase(),
        rating:     Number(values[colMap.rating - 1]) || 0,
        categories: parseCategoryCodes(values[colMap.category_code - 1]),
        days:       closedDays(submitTime, values[colMap.response_time - 1], status),
      };

      // 前一個月只拿來做比較，不需要它的未結案清單
      if (key === prevKey) { addToBucket(prev, item); return; }

      addToBucket(bucket, item);

      /**
       * ⚠️ 這裡的「未結案」是**不等於已結案**（含未處理與處理中），
       *    跟日報的「未處理」（只有未處理）**不是同一件事**。
       *
       *    月報回答的是「上個月的案子有沒有收尾」——處理中但還沒結案的
       *    也是還沒收尾，不列出來的話那些案子會從月報上憑空消失。
       *    日報回答的是「今天要先動哪一件」，處理中的已經有人在動了。
       *
       *    兩個定義不同是刻意的，但一定要寫下來：
       *    否則哪天有人發現「日報說 3 件、月報說 5 件」會以為系統壞了。
       */
      if (status !== 'ST_DONE') {
        open.push({
          case_id:        str(values[colMap.case_id - 1]),
          location_code:  item.location,
          category_codes: item.categories,
          status_code:    status,
          submit_date:    Utilities.formatDate(submitTime, tz, 'yyyy-MM-dd'),
          days_open:      Math.floor((now - submitTime) / 86400000),
        });
      }
    });
  }

  // 放最久的排最前面，理由與日報相同：要先處理的永遠是等最久的那件
  open.sort(function (a, b) { return b.days_open - a.days_open; });

  const out = finishBucket(bucket);

  out.month      = monthKey;
  out.locations  = locationList(bucket);
  out.open_cases = open;
  out.open_total = open.length;

  /**
   * 前一個月沒有任何資料時回傳 null，不是 0。
   *
   * 系統剛上線的第一個月就是這種情況——
   * 那時候寫「比上個月多 23 件」是假的，上個月根本還沒有這個系統。
   * 前端（這裡是信件）遇到 null 就不要畫比較。
   */
  out.previous = prev.total > 0
    ? {
        month:      prevKey,
        total:      prev.total,
        avg_rating: average(prev.rating_sum, prev.rating_n),
        done_rate:  ratio(prev.done, prev.total),
      }
    : null;

  return out;
}


// ===== 月份代碼的加減 =====

/**
 * 現在是哪一個月（'yyyyMM'，依專案時區）。
 */
function currentMonthKey() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMM');
}


/**
 * 前一個月的代碼。
 *
 * ⚠️ 刻意用「字串拆開來減」而不是 `new Date(y, m - 1, 1)`：
 *    月份代碼本來就是依專案時區（Asia/Jakarta）算出來的，
 *    再丟回 Date 做運算會用到伺服器的時區，
 *    跨月的那一兩個小時就會算到隔壁月份去——
 *    而月報偏偏就是每月 1 日早上跑的，正好踩在那個交界上。
 *
 * 1 月的前一個月是去年 12 月，這是唯一要特別處理的情況。
 */
function previousMonthKey(monthKey) {
  const year  = Number(str(monthKey).substring(0, 4));
  const month = Number(str(monthKey).substring(4, 6));

  if (!year || !month) return '';

  return month === 1
    ? String(year - 1) + '12'
    : String(year) + ('0' + (month - 1)).slice(-2);
}
