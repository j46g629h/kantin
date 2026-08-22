/**
 * 排程寄出的報表（規格 §10）
 *
 *   每日未處理清單（§10.1）　每天 08:00，沒有未處理案件就不寄
 *   每月統計月報　（§10.2）　每月 1 日 08:00 統計上個月，**一定會寄**
 *
 *
 * 📌 兩封信的角色完全不同，所以「沒事的時候寄不寄」的答案相反：
 *
 *    日報是**行動清單**——沒事就不要寄。每天寄一封「今天沒事」，
 *    兩個星期後就沒有人會打開它了，等到真的有事那天，那封信也一樣被忽略。
 *
 *    月報是**紀錄**——沒事也要寄。「上個月 0 件」本身就是重要資訊：
 *    可能真的很平靜，也可能是 QR Code 被撕掉了、或是根本沒人知道有這個系統。
 *    月報沒來的話，這兩種情況都會安靜地過去。
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

    const lines = [
      '已寄出 ' + result.sent + ' 封（失敗 ' + result.failed + ' 封）；'
        + '未處理 ' + report.total + ' 件，其中逾期 ' + report.overdue + ' 件。',
    ];

    // 授權問題不能只說「失敗 N 封」——那看起來像信箱有問題，
    // 但實際上要做的事完全不同（再執行一次就好）
    if (result.auth_error) {
      lines.push('');
      lines.push('⚠️ 一封都沒寄出，原因是「寄信權限尚未授權」。');
      lines.push('   請再執行一次這支函式，這次會跳出授權畫面，允許之後就正常了。');
      lines.push('   （Apps Script 是掃描程式碼推算需要哪些權限的，');
      lines.push('     剛更新過程式碼時第一次執行常常會遇到這個。）');
      lines.push('');
      lines.push('   原始訊息：' + result.auth_error);
    }

    const msg = lines.join(String.fromCharCode(10));

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
 * 建立「類型 → 代碼 → { zh, id }」的對照表，一次讀完選項設定。
 *
 * 為什麼不用現成的 getOptions()：那一支是給前端用的，
 * 回傳的是陣列，這裡需要的是能用代碼直接查的對照表。
 *
 * 兩種語言都留著，因為信件內容要並列顯示（見 optionText）。
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
    maps[type][code] = { zh: str(row[2]), id: str(row[3]) };
  });

  return maps;
}


/**
 * 用代碼查顯示文字，**印尼文在前、中文在後**。
 *
 * 收信的人有印尼籍也有台籍，而管理者名單裡沒有記錄每個人的語言偏好。
 * 與其為了寄信多加一個欄位，不如兩種都寫上去——
 * 印尼文放前面是因為使用者以印尼籍同仁為主（與 app 的語言政策一致）。
 *
 * 三種特殊情況：
 *   - 兩種語言的文字一樣（例如人名）→ 只顯示一次，不要變成「王小明 · 王小明」
 *   - 只有一種有填 → 就顯示那一種
 *   - 查不到代碼 → 顯示代碼本身，總比空白好排查
 */
function optionText(maps, type, code) {
  const key = str(code).toUpperCase();
  if (!key) return '';

  const entry = maps[type] && maps[type][key];
  if (!entry) return key;

  if (!entry.id) return entry.zh || key;
  if (!entry.zh) return entry.id;
  if (entry.id === entry.zh) return entry.id;

  return entry.id + ' · ' + entry.zh;
}


// ===== 每月統計月報（規格 §10.2）=====

/**
 * 觸發器每月 1 日早上呼叫的就是這一支，統計的是**上一個月**。
 *
 * 與日報一樣不吞例外：往外丟，Google 才會寄「指令碼執行失敗」通知。
 *
 * @return {string} 執行結果的說明（手動執行時會印在執行紀錄上）
 */
function sendMonthlyReport() {
  return sendMonthlyReportFor(previousMonthKey(currentMonthKey()));
}


/**
 * 手動寄一次上個月的月報（測試用，不必等到下個月 1 號）。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 sendMonthlyReportNow → 按 ▷ → 看執行紀錄
 */
function sendMonthlyReportNow() {
  return sendMonthlyReport();
}


/**
 * 寄某一個指定月份的月報。
 *
 * 排程漏跑要補寄、或想先看看某個月長什麼樣子時用：
 * 在編輯器上把下面這行貼進任一支函式執行即可
 *
 *     sendMonthlyReportFor('202607');
 *
 * @param {string} monthKey 'yyyyMM'
 */
function sendMonthlyReportFor(monthKey) {
  try {
    const key = str(monthKey);

    // 月份代碼算壞的話，統計會靜靜地回傳「0 件」——
    // 那看起來跟「那個月真的沒人回報」一模一樣，是最難發現的一種錯
    if (!/^\d{6}$/.test(key)) {
      throw new Error('月份代碼不合法：' + key + '（應該是 yyyyMM，例如 202607）');
    }

    const stats = buildMonthlyStats(key);
    const label = monthLabel(key);

    const subject = '[Kantin PCI] Laporan Bulanan ' + label.id
                  + ' · ' + label.zh + '月報'
                  + '（' + stats.total + ' 件'
                  + (stats.open_total > 0 ? '，未結案 ' + stats.open_total + ' 件' : '') + '）';

    const result = sendToRecipients(subject, function () {
      return buildMonthlyReportHtml(stats, label);
    }, 'sendMonthlyReport');

    const lines = [
      '已寄出 ' + result.sent + ' 封（失敗 ' + result.failed + ' 封）；'
        + label.zh + ' 共 ' + stats.total + ' 件，'
        + '結案率 ' + showPercent(stats.done_rate) + '，'
        + '未結案 ' + stats.open_total + ' 件。',
    ];

    // 與日報相同：授權問題要跟一般寄信失敗分開講，
    // 兩者看到的都是「失敗 N 封」，但該做的事完全不同
    if (result.auth_error) {
      lines.push('');
      lines.push('⚠️ 一封都沒寄出，原因是「寄信權限尚未授權」。');
      lines.push('   請再執行一次這支函式，這次會跳出授權畫面，允許之後就正常了。');
      lines.push('');
      lines.push('   原始訊息：' + result.auth_error);
    }

    const msg = lines.join(String.fromCharCode(10));

    Logger.log(msg);
    return msg;

  } catch (e) {
    logError('sendMonthlyReport', '', e, { month: str(monthKey) });
    throw e;      // 讓 Apps Script 的失敗通知也發得出去
  }
}


/**
 * 月份代碼換成看得懂的名字。
 *
 * 印尼文月份是完整名稱（Juli 2026），中文用「2026 年 7 月」——
 * 兩邊各自寫成該語言本來的樣子，不要硬套同一個格式。
 *
 * @return {Object} { id: 'Juli 2026', zh: '2026 年 7 月' }
 */
function monthLabel(monthKey) {
  const names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const year  = str(monthKey).substring(0, 4);
  const month = Number(str(monthKey).substring(4, 6));

  return {
    id: (names[month - 1] || monthKey) + ' ' + year,
    zh: year + ' 年 ' + month + ' 月',
  };
}


/**
 * 把月報畫成 HTML。
 *
 * 版面順序刻意是「先結論、再細節、最後待辦」：
 *   1. 四個關鍵數字（含與上個月的比較）
 *   2. 各餐廳表現
 *   3. 問題分類佔比
 *   4. 未結案清單
 *
 * 收信的人多半只看第一段就關掉，所以最重要的數字要在最上面，
 * 而需要動作的東西（未結案）放最後、緊接著開啟系統的按鈕。
 */
function buildMonthlyReportHtml(stats, label) {
  const options = getOptionMaps();

  return buildEmailHtml(
    'Laporan Bulanan · 每月統計月報',
    label.id + ' · ' + label.zh,
    [
      monthlySummaryHtml(stats),
      monthlyLocationHtml(stats, options),
      monthlyCategoryHtml(stats, options),
      monthlyOpenCasesHtml(stats, options),
    ].join('\n'),
    'Buka dashboard · 開啟動態表',
    SITE_URL + 'admin-dashboard.html'
  );
}


/**
 * 最上面那四格關鍵數字。
 *
 * 排成 2×2 而不是 1×4：手機上四格並排會擠成一團，
 * 而這種信有很高比例是在手機上看的。
 */
function monthlySummaryHtml(stats) {
  const prev = stats.previous;

  const cells = [
    tileHtml('Total laporan · 回報總數', String(stats.total),
             // 回報數變多不一定是壞事——可能是員工更願意講了，
             // 所以這一格刻意不上色，只寫出差多少
             deltaHtml(stats.total, prev && prev.total, 'neutral')),

    tileHtml('Tingkat selesai · 結案率', showPercent(stats.done_rate),
             deltaHtml(stats.done_rate, prev && prev.done_rate, 'higher_better', '%')),

    tileHtml('Rata-rata kepuasan · 平均滿意度',
             stats.avg_rating === null ? '—' : showNumber(stats.avg_rating) + ' / 5',
             deltaHtml(stats.avg_rating, prev && prev.avg_rating, 'higher_better')),

    // 上個月的平均處理天數沒有放進 previous——信裡擺四個比較就太滿了，
    // 這一格只顯示當月數字
    tileHtml('Rata-rata hari proses · 平均處理天數', showNumber(stats.avg_days), ''),
  ];

  const note = prev
    ? 'Dibandingkan dengan bulan sebelumnya · 括號內為與上個月的比較'
    : 'Belum ada data bulan sebelumnya · 上個月沒有資料，這個月不做比較';

  return [
    '<table style="border-collapse:separate;border-spacing:6px;width:100%;">',
    '  <tr>' + cells[0] + cells[1] + '</tr>',
    '  <tr>' + cells[2] + cells[3] + '</tr>',
    '</table>',
    '<div style="color:#6b7280;font-size:12px;margin-top:6px;">' + escapeForHtml(note) + '</div>',
  ].join('\n');
}


/** 一格數字方塊。用 td 排版，因為信箱軟體不見得吃 flex / grid */
function tileHtml(label, value, delta) {
  return [
    '<td style="width:50%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;',
    '           padding:12px 14px;vertical-align:top;">',
    '  <div style="color:#6b7280;font-size:12px;line-height:1.4;">' + escapeForHtml(label) + '</div>',
    '  <div style="font-size:22px;font-weight:bold;margin-top:4px;">' + escapeForHtml(value) + '</div>',
    delta,
    '</td>',
  ].join('');
}


/**
 * 與上個月的差距。
 *
 * 只有「哪個方向比較好」很明確的數字才上色（滿意度、結案率越高越好）。
 * 回報總數用灰色：回報變多可能代表問題變多，也可能代表員工更願意反映，
 * 把它塗成紅色等於幫使用者下了一個沒有根據的結論。
 *
 * @param {number|null} current
 * @param {number|null} previous
 * @param {string} mode 'higher_better' | 'neutral'
 * @param {string} unit 顯示在數字後面（例如 '%'）
 */
function deltaHtml(current, previous, mode, unit) {
  if (current === null || current === undefined) return '';
  if (previous === null || previous === undefined) return '';

  const diff = Math.round((current - previous) * 10) / 10;
  const tail = unit || '';

  if (diff === 0) {
    return '<div style="color:#6b7280;font-size:12px;margin-top:2px;">→ sama · 與上月持平</div>';
  }

  const text = (diff > 0 ? '▲ +' : '▼ ') + diff + tail;

  const color = mode === 'higher_better'
    ? (diff > 0 ? '#047857' : '#b91c1c')
    : '#6b7280';

  return '<div style="color:' + color + ';font-size:12px;margin-top:2px;font-weight:bold;">'
       + escapeForHtml(text) + '</div>';
}


/** 各餐廳表現（規格 §10.2 的「平均滿意度（整體 + 各餐廳）」） */
function monthlyLocationHtml(stats, options) {
  if (stats.locations.length === 0) return '';

  const rows = stats.locations.map(function (loc) {
    return {
      highlight: false,
      cells: [
        escapeForHtml(optionText(options, 'LOCATION', loc.code)),
        String(loc.total),
        escapeForHtml(showNumber(loc.avg_rating)),
        escapeForHtml(showPercent(loc.done_rate)),
        escapeForHtml(showNumber(loc.avg_days)),
      ],
    };
  });

  return sectionHtml(
    'Per kantin · 各餐廳表現',
    '',
    // 表頭刻意壓短（★ 代替 Kepuasan、天數用與日報相同的字）：
    // 五欄雙語表頭在手機上很容易撐破版面，而 th 是 nowrap 的，撐破就整張表要橫捲
    buildEmailTable(
      ['Kantin · 地點', 'Jml · 件數', '★ · 滿意度', 'Selesai · 結案率', 'Hari · 天數'],
      rows
    )
  );
}


/** 問題分類佔比 */
function monthlyCategoryHtml(stats, options) {
  if (stats.by_category.length === 0) return '';

  const rows = stats.by_category.map(function (cat) {
    return {
      highlight: false,
      cells: [
        escapeForHtml(optionText(options, 'CATEGORY', cat.code)),
        String(cat.count),
        escapeForHtml(showPercent(ratio(cat.count, stats.total))),
      ],
    };
  });

  /**
   * ⚠️ 這一行不能省（規格 §10 的提醒）。
   *    問題分類可複選最多 2 項，一筆案件會同時計入兩個分類，
   *    所以佔比加起來一定超過 100%。
   *    沒有寫明的話，第一個把它加起來的人會以為系統算錯了。
   */
  const note = 'Satu laporan bisa 2 kategori, total &gt; 100% · '
             + '一筆可複選 2 項分類，因此佔比總和會超過 100%';

  return sectionHtml('Kategori masalah · 問題分類佔比', note,
    buildEmailTable(['Kategori · 分類', 'Jml · 次數', '%'], rows));
}


/**
 * 未結案清單。
 *
 * ⚠️ 這裡的「未結案」含未處理與處理中，跟日報的「未處理」不同，
 *    理由寫在 gas/Stats.js 的 buildMonthlyStats 裡。
 *
 * 標紅的條件不是「逾期」——這些案件都是上個月提交的，
 * 寄信時一律都超過 3 天了，全部標紅等於沒有標。
 * 改成標「完全沒有人動過的（未處理）」，那才是月底回顧時真正該看的。
 */
function monthlyOpenCasesHtml(stats, options) {
  if (stats.total === 0) {
    return sectionHtml('', '',
      '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;' +
      'padding:14px 16px;color:#6b7280;">' +
      'Tidak ada laporan bulan ini · 這個月沒有任何回報' +
      '</div>');
  }

  if (stats.open_total === 0) {
    return sectionHtml('Belum selesai · 未結案清單', '',
      '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;' +
      'padding:14px 16px;color:#047857;font-weight:bold;">' +
      '✅ Semua laporan sudah selesai · 這個月的案件全部結案' +
      '</div>');
  }

  const shown     = stats.open_cases.slice(0, REPORT.MAX_ROWS);
  const truncated = stats.open_total - shown.length;

  const rows = shown.map(function (item) {
    return {
      highlight: item.status_code === 'ST_NEW',
      cells: [
        '<strong>' + escapeForHtml(item.case_id) + '</strong>',
        escapeForHtml(optionText(options, 'LOCATION', item.location_code)),
        escapeForHtml(optionText(options, 'STATUS', item.status_code)),
        escapeForHtml(item.submit_date),
        '<strong>' + item.days_open + '</strong>',
      ],
    };
  });

  const more = truncated > 0
    ? ('<div style="margin-top:10px;color:#6b7280;font-size:13px;">' +
       '… dan ' + truncated + ' lainnya · 還有 ' + truncated + ' 件未列出</div>')
    : '';

  return sectionHtml(
    'Belum selesai · 未結案清單（' + stats.open_total + '）',
    'Baris merah = belum ada yang menangani · 紅色為完全還沒有人處理的案件',
    buildEmailTable(
      ['No. · 編號', 'Kantin · 地點', 'Status · 狀態', 'Tanggal · 日期', 'Hari · 天數'],
      rows
    ) + more
  );
}


/** 一個有小標題的段落 */
function sectionHtml(title, note, body) {
  return [
    '<div style="margin-top:26px;">',
    title
      ? ('  <div style="font-size:15px;font-weight:bold;margin-bottom:' +
         (note ? '2px' : '10px') + ';">' + escapeForHtml(title) + '</div>')
      : '',
    note
      ? '  <div style="color:#6b7280;font-size:12px;margin-bottom:10px;">' + note + '</div>'
      : '',
    body,
    '</div>',
  ].join('\n');
}


/** 數字；null 顯示成破折號，不要顯示成 0（「沒有樣本」不等於「0 分」） */
function showNumber(value) {
  return (value === null || value === undefined) ? '—' : String(value);
}

/** 百分比；null 同樣顯示破折號 */
function showPercent(value) {
  return (value === null || value === undefined) ? '—' : value + '%';
}
