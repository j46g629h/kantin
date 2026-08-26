/**
 * 上線前的測試資料清除（第 6 階段 6-10）
 *
 * 📌 這支只做一件事：把「開發期間灌進去的假回報」清乾淨，
 *    讓試辦第一天的統計、月報、案件編號都是從零開始。
 *
 * ⚠️ 這是**會破壞資料**的功能，所以照 CLAUDE.md 設計約定第 17 條的四件事來做：
 *
 *   1. 試跑模式        previewTestDataCleanup()  只列名單，不動任何東西
 *   2. 前置條件檢查    真的要刪的函式名字很長（…Confirmed），不會手滑點到；
 *                      而且執行前會再列一次名單
 *   3. 照片丟垃圾桶    setTrashed(true)，30 天內救得回來
 *   4. 邊界往保守取    只認 client_submit_id 開頭是 'seed-' 的列，
 *                      其他一律不碰（真實提交用的是瀏覽器的 randomUUID，
 *                      永遠不會以 seed- 開頭）
 *
 * ⚠️ **順序：先丟照片，再刪列。**
 *    反過來的話，列刪掉了才發現照片沒丟成功，那幾張照片就變成
 *    沒有人知道存在的孤兒檔案，永遠留在 Drive 裡。
 */


/** 測試資料的標記：三支灌資料的函式都用這個開頭當 client_submit_id */
const TEST_SUBMIT_PREFIX = 'seed-';


/**
 * 【試跑】只列出會被刪掉的東西，不動任何資料。
 *
 * 執行方式：Apps Script 編輯器上方選這支 → 執行 → 看「執行紀錄」。
 */
function previewTestDataCleanup() {
  const scan = scanTestFeedback();
  const msg  = buildCleanupReport(scan, true);
  Logger.log(msg);
  return msg;
}


/**
 * 【真的刪】清掉測試回報 + 照片 + 把案件編號的計數器改回正確的值。
 *
 * ⚠️ 名字刻意這麼長：這支不能手滑點到。
 *    請先跑 previewTestDataCleanup() 看過名單再執行。
 */
function removeTestFeedbackConfirmed() {
  const scan = scanTestFeedback();

  if (scan.targets.length === 0) {
    const none = '沒有找到任何測試資料（client_submit_id 開頭是 '
               + TEST_SUBMIT_PREFIX + '），不需要清除。';
    Logger.log(none);
    return none;
  }

  const sheet  = getSheet(SHEETS.FEEDBACK);
  const colMap = getFeedbackColumnMap();

  // ---------- 1. 先丟照片 ----------
  let trashed = 0;
  scan.targets.forEach(function (item) {
    item.image_ids.forEach(function (id) {
      try {
        // 丟垃圾桶不是永久刪除：判斷錯了還有 30 天可以救
        DriveApp.getFileById(id).setTrashed(true);
        trashed++;
      } catch (e) {
        // 檔案早就被手動刪掉是很正常的，不該讓整支掛掉
        logError('removeTestFeedback', '', e, { case_id: item.case_id, file_id: id });
      }
    });
  });

  // ---------- 2. 再刪列 ----------
  // ⚠️ 一定要**由下往上**刪。由上往下的話，刪掉第 5 列之後
  //    原本的第 6 列會變成第 5 列，接下來每一次都會刪錯一列。
  const rowsDesc = scan.targets.map(function (t) { return t.row; })
                               .sort(function (a, b) { return b - a; });
  rowsDesc.forEach(function (row) { sheet.deleteRow(row); });

  // ---------- 3. 把案件編號的計數器改回正確的值 ----------
  const counterReport = rebuildCounters(sheet, colMap);

  const msg = buildCleanupReport(scan, false)
            + String.fromCharCode(10) + String.fromCharCode(10)
            + '✔ 已刪除 ' + rowsDesc.length + ' 列，照片丟進垃圾桶 ' + trashed + ' 張。'
            + String.fromCharCode(10) + counterReport;

  Logger.log(msg);
  return msg;
}


/**
 * 掃出所有測試資料。**不做任何修改。**
 *
 * @return {{targets:Array, keep:number, scanned:number, months:Object}}
 */
function scanTestFeedback() {
  const sheet   = getSheet(SHEETS.FEEDBACK);
  const colMap  = getFeedbackColumnMap();
  const lastRow = sheet.getLastRow();

  const result = { targets: [], keep: 0, scanned: 0, months: {} };
  if (lastRow < 2) return result;

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  values.forEach(function (row, i) {
    result.scanned++;

    const submitId = str(row[colMap.client_submit_id - 1]);

    // ⚠️ 只認開頭完全等於 'seed-' 的。真實提交用的是瀏覽器的
    //    crypto.randomUUID()，永遠不會長這樣。空字串也不會通過這一關
    if (submitId.indexOf(TEST_SUBMIT_PREFIX) !== 0) {
      result.keep++;
      return;
    }

    const caseId = str(row[colMap.case_id - 1]);
    const ym     = caseIdYearMonth(caseId);
    if (ym) result.months[ym] = true;

    result.targets.push({
      row:       i + 2,        // 陣列從 0 開始，而資料從第 2 列開始
      case_id:   caseId,
      submit_id: submitId,
      image_ids: imageFileIds(row[colMap.image_urls - 1]),
    });
  });

  return result;
}


/**
 * 刪完之後，把「系統計數」改成剩下資料的真實最大流水號。
 *
 * ⚠️ 不是直接歸零。萬一已經有真實案件了，歸零會讓下一筆拿到重複的編號——
 *    案件編號重複是回不來的，兩件不同的事會共用同一個編號。
 *    所以是「照剩下的資料重算」：那個月一筆都不剩，才把整列拿掉。
 */
function rebuildCounters(feedbackSheet, colMap) {
  const maxByMonth = {};
  const lastRow = feedbackSheet.getLastRow();

  if (lastRow >= 2) {
    feedbackSheet.getRange(2, colMap.case_id, lastRow - 1, 1).getValues()
      .forEach(function (r) {
        const caseId = str(r[0]);
        const ym     = caseIdYearMonth(caseId);
        if (!ym) return;
        const seq = Number(caseId.slice(caseId.lastIndexOf('-') + 1)) || 0;
        if (!maxByMonth[ym] || seq > maxByMonth[ym]) maxByMonth[ym] = seq;
      });
  }

  const counters = getSheet(SHEETS.COUNTERS);
  const cLast = counters.getLastRow();
  if (cLast < 2) return '系統計數：沒有資料，不需要調整。';

  const rows = counters.getRange(2, 1, cLast - 1, 2).getValues();
  let updated = 0, removed = 0;

  // ⚠️ 一樣由下往上，否則刪掉一列之後底下的列號全部位移
  for (let i = rows.length - 1; i >= 0; i--) {
    const ym  = str(rows[i][0]);
    const row = i + 2;

    if (maxByMonth[ym] === undefined) {
      counters.deleteRow(row);          // 那個月一筆都不剩，下一筆會重新從 001 開始
      removed++;
    } else if (Number(rows[i][1]) !== maxByMonth[ym]) {
      counters.getRange(row, 2).setValue(maxByMonth[ym]);
      updated++;
    }
  }

  return '系統計數：移除 ' + removed + ' 個月份、更新 ' + updated + ' 個月份。';
}


/** 從案件編號 PCI-YYYYMM-NNN 取出 YYYYMM；格式不對回傳空字串 */
function caseIdYearMonth(caseId) {
  const m = str(caseId).match(/^PCI-(\d{6})-\d+$/);
  return m ? m[1] : '';
}


/** 把掃描結果排成看得懂的報告 */
function buildCleanupReport(scan, isPreview) {
  const NL  = String.fromCharCode(10);
  const out = [];

  out.push(isPreview ? '===== 試跑：不會刪除任何東西 =====' : '===== 清除測試資料 =====');
  out.push('');
  out.push('掃描了 ' + scan.scanned + ' 列。');
  out.push('  會刪掉：' + scan.targets.length + ' 列（測試資料）');
  out.push('  會留著：' + scan.keep + ' 列（不是測試資料）');

  const images = scan.targets.reduce(function (n, t) { return n + t.image_ids.length; }, 0);
  out.push('  連帶丟進垃圾桶的照片：' + images + ' 張');

  const months = Object.keys(scan.months).sort();
  if (months.length) out.push('  影響到的月份：' + months.join('、'));

  if (scan.keep > 0) {
    out.push('');
    out.push('⚠️ 有 ' + scan.keep + ' 列不是測試資料，這些**不會**被動到。');
    out.push('   如果你以為現在應該全部都是測試資料，請先確認那幾列是什麼再繼續。');
  }

  if (scan.targets.length) {
    out.push('');
    out.push('要刪掉的案件編號：');
    scan.targets.forEach(function (t) {
      out.push('  第 ' + t.row + ' 列　' + (t.case_id || '（沒有編號）')
             + '　照片 ' + t.image_ids.length + ' 張');
    });
  }

  if (isPreview) {
    out.push('');
    out.push('確認名單沒問題之後，執行 removeTestFeedbackConfirmed()。');
  }

  return out.join(NL);
}
