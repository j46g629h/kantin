/**
 * 排程寄出的報表（規格 §10）
 *
 * 目前只有每日未處理清單。每月統計月報排在關卡 4-3。
 *
 *
 * 📌 為什麼日報比月報重要（規格 §10.1 的原話）：
 *    「月報是給主管看績效的；管理者每天真正需要的是『今天有什麼要處理』。」
 *
 *    這封信的作用不是報告，是**提醒**——所以它刻意只列未處理的案件，
 *    而且沒有未處理案件時完全不寄。
 *    每天寄一封「今天沒事」的信，兩個星期之後就沒有人會打開它了，
 *    等到真的有事那天，那封信也一樣被忽略。
 */


// ===== 每日未處理清單 =====

/**
 * 觸發器每天早上呼叫的就是這一支。
 *
 * ⚠️ 不要在這裡吞掉例外。
 *    往外丟的話，Apps Script 會把這次執行標記為失敗，
 *    Google 也會寄一封「指令碼執行失敗」的通知給專案擁有者——
 *    那是排程壞掉時唯一會主動找上門的訊息。
 *
 * @return {string} 執行結果的說明（手動執行時會印在執行紀錄上）
 */
function sendDailyReport() {
  try {
    const report = buildDailyReport();

    if (report.total === 0) {
      const msg = '目前沒有未處理案件，依規格不寄信。';
      Logger.log(msg);
      return msg;
    }

    const today   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const subject = '[Kantin PCI] ' + report.total + ' laporan belum diproses'
                  + (report.overdue > 0 ? ' (' + report.overdue + ' terlambat)' : '')
                  + ' · 未處理 ' + report.total + ' 件';

    const result = sendToRecipients(subject, function () {
      return buildDailyReportHtml(report, today);
    }, 'sendDailyReport');

    const msg = '已寄出 ' + result.sent + ' 封（失敗 ' + result.failed + ' 封）；'
              + '未處理 ' + report.total + ' 件，其中逾期 ' + report.overdue + ' 件。';
    Logger.log(msg);
    return msg;

  } catch (e) {
    logError('sendDailyReport', '', e, {});
    throw e;      // 讓 Apps Script 的失敗通知也發得出去
  }
}


/**
 * 手動寄一次日報（測試用，不必等到明天早上）。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 sendDailyReportNow → 按 ▷ → 看執行紀錄
 */
function sendDailyReportNow() {
  return sendDailyReport();
}


/**
 * 整理出「還沒處理的案件」。
 *
 * 排序刻意用「放最久的排最前面」，不是提交時間倒序——
 * 這封信要回答的是「今天該先處理哪一件」，
 * 而那永遠是等最久的那一件，不是最新來的那一件。
 *
 * @return {Object} { cases, total, overdue }
 */
function buildDailyReport() {
  const sheet   = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return { cases: [], total: 0, overdue: 0 };

  const colMap     = getFeedbackColumnMap();
  const now        = new Date();
  const handlerMap = buildHandlerMap();
  const rows       = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  const cases = [];

  rows.forEach(function (values) {
    // 軟刪除的案件不算（設計約定第 4 條）
    if (isTrue(values[colMap.is_deleted - 1])) return;
    if (!str(values[colMap.case_id - 1])) return;      // 略過空白列

    const item = buildAdminCase(values, colMap, now, handlerMap);

    // 只要未處理的。狀態空白或認不得的也算未處理——
    // 寧可多提醒一件，也不要讓一件案子因為狀態欄打錯字就沒人管
    if (item.status_code === 'ST_PROC' || item.status_code === 'ST_DONE') return;

    cases.push(item);
  });

  cases.sort(function (a, b) { return b.days_open - a.days_open; });

  return {
    cases:   cases,
    total:   cases.length,
    overdue: cases.filter(function (c) { return c.is_overdue; }).length,
  };
}


/**
 * 把日報畫成 HTML。
 *
 * 信件內容一律中印雙語：管理者名單裡沒有記錄每個人習慣哪一種語言，
 * 而為了寄信去加一個欄位並不划算。
 * 表頭用「印尼文 / 中文」並排，兩邊的人都看得懂。
 */
function buildDailyReportHtml(report, today) {
  const options    = getOptionMaps();
  const shown      = report.cases.slice(0, REPORT.MAX_ROWS);
  const truncated  = report.total - shown.length;

  const summary = [
    '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;',
    '            padding:14px 16px;margin-bottom:20px;">',
    '  <div style="font-size:16px;font-weight:bold;">',
    '    ' + report.total + ' laporan belum diproses · ' + report.total + ' 件未處理',
    '  </div>',
    report.overdue > 0
      ? ('  <div style="color:#b91c1c;font-weight:bold;margin-top:6px;">' +
         '⚠️ ' + report.overdue + ' sudah lewat ' + CASE_LIST.OVERDUE_DAYS + ' hari · ' +
         '其中 ' + report.overdue + ' 件已逾期超過 ' + CASE_LIST.OVERDUE_DAYS + ' 天</div>')
      : '  <div style="color:#047857;margin-top:6px;">Tidak ada yang terlambat · 沒有逾期案件</div>',
    '</div>',
  ].join('\n');

  const rows = shown.map(function (item) {
    return {
      highlight: item.is_overdue,
      cells: [
        '<strong>' + escapeForHtml(item.case_id) + '</strong>',
        escapeForHtml(optionText(options, 'LOCATION', item.location_code)),
        escapeForHtml(item.category_codes.map(function (code) {
          return optionText(options, 'CATEGORY', code);
        }).join(' / ')),
        escapeForHtml(String(item.submit_time).substring(0, 10)),
        '<strong>' + item.days_open + '</strong>',
      ],
    };
  });

  const table = buildEmailTable(
    ['No. · 編號', 'Kantin · 地點', 'Kategori · 分類', 'Tanggal · 日期', 'Hari · 天數'],
    rows
  );

  const more = truncated > 0
    ? ('<div style="margin-top:10px;color:#6b7280;font-size:13px;">' +
       '… dan ' + truncated + ' lainnya · 還有 ' + truncated + ' 件未列出</div>')
    : '';

  return buildEmailHtml(
    'Laporan Belum Diproses · 未處理案件清單',
    today,
    summary + table + more,
    'Buka daftar laporan · 開啟案件列表',
    SITE_URL + 'admin-cases.html'
  );
}


/**
 * 建立「類型 → 代碼 → 顯示文字」的對照表，一次讀完選項設定。
 *
 * 為什麼不用現成的 getOptions()：那一支是給前端用的，
 * 回傳的是陣列而且分中印兩欄，這裡只需要能用代碼查名字。
 *
 * 信件裡顯示中文名稱（管理者看的），印尼文名稱在表頭已經標示欄位含意了。
 */
function getOptionMaps() {
  const sheet   = getSheet(SHEETS.OPTIONS);
  const lastRow = sheet.getLastRow();
  const maps    = {};

  if (lastRow < 2) return maps;

  sheet.getRange(2, 1, lastRow - 1, 6).getValues().forEach(function (row) {
    const type = str(row[0]).toUpperCase();
    const code = str(row[1]).toUpperCase();
    if (!type || !code) return;

    if (!maps[type]) maps[type] = {};
    // 中文欄空白時退回印尼文欄，再空白就用代碼本身——不要讓儲存格變成空的
    maps[type][code] = str(row[2]) || str(row[3]) || code;
  });

  return maps;
}


/** 用代碼查顯示文字；查不到就把代碼本身顯示出來（總比空白好排查） */
function optionText(maps, type, code) {
  const key = str(code).toUpperCase();
  if (!key) return '';
  return (maps[type] && maps[type][key]) ? maps[type][key] : key;
}
