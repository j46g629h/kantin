/**
 * 資料保存政策：結案滿 13 個月去識別化（關卡 4-5、規格 §11）
 *
 *
 * ⚠️ **這是整個系統唯一會永久破壞資料的功能。** 所有設計都是繞著這件事轉的。
 *
 *
 * 📌 做什麼、不做什麼：
 *
 *    清掉：工號、姓名、照片
 *    留著：案件編號、時間、地點、分類、評分、狀態、描述、回覆
 *
 *    **不整筆刪除**，因為隔年要做「今年 vs 去年同期」的比較時，
 *    整筆刪掉就沒資料了。去識別化能同時滿足個資保護與統計需求。
 *
 *    ⚠️ 工號與姓名一定要一起清。只刪照片、把姓名留著的話，
 *       那不叫去識別化——**姓名本來就是最直接的個資**，
 *       等於把窗簾拉上但大門敞開。
 *
 *
 * 📌 起算點是**結案時間**，不是提交時間。
 *    一直沒結案的案件不清除——那代表問題還沒解決，還在處理中。
 *
 *
 * 📌 照片用「丟進垃圾桶」，不是永久刪除：
 *    Drive 垃圾桶保留 30 天，判斷錯了還有 30 天可以救，
 *    30 天後 Google 自己永久刪除。零維護，而且時間到是真的刪掉。
 *
 *
 * ⚠️ **容量從來不是理由。** 13 個月的資料只佔 Sheet 上限的 0.13%、Drive 的 0.45%，
 *    十年不清也才 1.2%。這件事純粹是為了個資保護。
 *    所以任何「為了省空間多刪一點」的想法都是本末倒置。
 *
 *
 * ⚠️ **一個做不到的部分要誠實記著：** 清掉工號姓名之後，
 *    Google 試算表的「版本紀錄」裡還看得到清除前的內容。
 *    要真正抹掉只能「另存新檔 + 刪掉舊檔」重置歷史。
 *    目前的緩解是管理者根本不需要 Sheet 權限（規格 §5.6），只有擁有者進得去。
 */


// ===== 對外的三支 =====

/**
 * 【試跑】只列出「會動到哪些案件」，**一個字都不會改**。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 previewDeidentify → 按 ▷ → 看執行紀錄
 *
 * 📌 真的執行之前一定要先跑這一支，把名單看過。
 *    這種功能出錯的樣子不是「跳出錯誤訊息」，而是「安靜地清掉了不該清的東西」，
 *    而且你要到很久以後才會發現。
 */
function previewDeidentify() {
  const result = scanForDeidentify(new Date());
  const msg    = buildRetentionReport(result, true);

  Logger.log(msg);
  return msg;
}


/**
 * 觸發器每月 1 日呼叫的就是這一支。**會真的改資料。**
 *
 * 與其他排程一樣不吞例外：往外丟，Google 才會寄「指令碼執行失敗」通知。
 */
function deidentifyMonthly() {
  try {
    /**
     * ⚠️ 動手之前先確認安全網在。
     *
     *    光靠「備份排在 02:00、這支排在 05:00」是不夠的——
     *    萬一那天的備份剛好失敗，時間再怎麼排也沒用。
     *    沒有近期備份就直接拒絕執行，這是唯一的煞車。
     */
    requireRecentBackup();

    const result = scanForDeidentify(new Date());

    if (result.targets.length > 0) {
      const sheet  = getSheet(SHEETS.FEEDBACK);
      const colMap = getFeedbackColumnMap();
      const now    = new Date();

      result.targets.slice(0, RETENTION.MAX_PER_RUN).forEach(function (item) {
        applyDeidentify(sheet, colMap, item, now);
        result.done++;
        result.images_trashed += item.trashed;
      });
    }

    const msg = buildRetentionReport(result, false);
    Logger.log(msg);
    return msg;

  } catch (e) {
    logError('deidentifyMonthly', '', e, {});
    throw e;      // 讓 Apps Script 的失敗通知也發得出去
  }
}


/**
 * 手動執行一次（會真的改資料）。
 *
 * ⚠️ 執行前請先跑 previewDeidentify() 把名單看過。
 */
function deidentifyNow() {
  return deidentifyMonthly();
}


// ===== 安全煞車 =====

/**
 * 沒有近期備份就丟例外，不准繼續。
 *
 * ⚠️ 「查不到備份」與「備份太舊」都要擋。
 *    尤其不可以寫成「查不到就當作沒問題」——
 *    Drive 讀不到的時候回傳的是 null，那個 null 的意思是
 *    「我不知道有沒有備份」，絕對不是「有備份」。
 */
function requireRecentBackup() {
  const backup = latestBackupInfo();

  if (!backup) {
    throw new Error(
      '找不到任何備份，為了安全起見不執行去識別化。' +
      '請先執行 backupNow() 做一份備份，再執行一次這支函式。'
    );
  }

  if (backup.age_days > RETENTION.MAX_BACKUP_AGE_DAYS) {
    throw new Error(
      '最新的備份是 ' + backup.age_days + ' 天前的（' + backup.name + '），' +
      '超過 ' + RETENTION.MAX_BACKUP_AGE_DAYS + ' 天的上限，為了安全起見不執行去識別化。' +
      '請先執行 backupNow()，並用 listTriggers() 確認 backupMonthly 排程還在。'
    );
  }

  return backup;
}


// ===== 掃描 =====

/**
 * 掃過整張表，找出該去識別化的案件。**只讀不寫。**
 *
 * @param  {Date} now
 * @return {Object} {
 *   scanned, cutoff_date, targets, no_date, already_clean, done, images_trashed
 * }
 */
function scanForDeidentify(now) {
  const result = {
    scanned:        0,
    cutoff_date:    '',
    targets:        [],
    no_date:        [],     // 已結案但「處理時間」是空的，判斷不了
    already_clean:  0,      // 已到期但先前已經清過了
    done:           0,
    images_trashed: 0,
  };

  const cutoff = retentionCutoffKey(now);
  result.cutoff_date = cutoff.slice(0, 4) + '-' + cutoff.slice(4, 6) + '-' + cutoff.slice(6, 8);

  const sheet   = getSheet(SHEETS.FEEDBACK);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;

  const colMap = getFeedbackColumnMap();
  const tz     = Session.getScriptTimeZone();
  const rows   = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  rows.forEach(function (values, index) {
    const caseId = str(values[colMap.case_id - 1]);
    if (!caseId) return;                  // 空白列

    result.scanned++;

    const deleted = isTrue(values[colMap.is_deleted - 1]);
    const status  = str(values[colMap.status_code - 1]).toUpperCase();

    /**
     * 起算時間有兩種：
     *
     *   已結案 → 用「處理時間」（也就是結案的時間），這是規格寫的
     *
     *   軟刪除 → 用「提交時間」。**這一條是規格之外自己加的。**
     *            軟刪除的案件不會再被結案，用結案時間算的話它永遠不會到期，
     *            那筆個資就會一直留著。這是規格沒有想到的漏洞。
     *
     * 其他情況（還沒結案、還在處理中）→ 一律不動。
     * 那代表問題還沒解決，資料還在用。
     */
    let basis = null, reason = '';

    if (deleted) {
      basis  = values[colMap.submit_time - 1];
      reason = '軟刪除';
    } else if (status === 'ST_DONE') {
      basis  = values[colMap.response_time - 1];
      reason = '已結案';
    } else {
      return;
    }

    // 已結案卻沒有結案時間 = 資料有問題。
    // **不可以默默跳過**——那會變成有些案件永遠不會被清，而沒有人知道
    if (!basis || typeof basis.getTime !== 'function') {
      result.no_date.push(caseId);
      return;
    }

    const key = Utilities.formatDate(basis, tz, 'yyyyMMdd');
    if (key > cutoff) return;             // 還沒滿 13 個月

    const empId    = str(values[colMap.emp_id - 1]);
    const empName  = str(values[colMap.emp_name - 1]);
    const imageIds = imageFileIds(values[colMap.image_urls - 1]);

    // 已經清乾淨的就不要再寫一次。
    // 重複寫沒有壞處，但會把「最後更新時間」每個月往前推一次，
    // 看起來像這筆資料一直被人動，很干擾
    if (!empId && !empName && imageIds.length === 0) {
      result.already_clean++;
      return;
    }

    result.targets.push({
      row:       index + 2,               // Sheet 的實際列號（第 1 列是表頭）
      case_id:   caseId,
      reason:    reason,
      date:      Utilities.formatDate(basis, tz, 'yyyy-MM-dd'),
      emp_id:    empId,
      emp_name:  empName,
      image_ids: imageIds,
      trashed:   0,
    });
  });

  // 最舊的排前面：真的出事時，最舊的那幾件是最不可能被質疑的
  result.targets.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

  return result;
}


/**
 * 13 個月前的日期，格式 'yyyyMMdd'。
 *
 * ⚠️ 用純整數的月份加減，不用 `new Date(y, m - 13, d)`：
 *    後者會用到伺服器時區，而日期是依專案時區算的，
 *    跨日的那幾個小時會算到隔壁天去。
 *
 * ⚠️ 遇到「3 月 31 日往前推 13 個月 = 2 月 31 日」這種不存在的日期，
 *    往回夾到該月最後一天（2 月 28）。
 *
 *    這會讓判斷**稍微偏保守**——落在那幾天的案件會晚一個月才被清掉。
 *    這個方向是刻意選的：**寧可晚點刪，也不要早一天刪。**
 *    晚一個月下次執行就補上了，早一天刪掉就回不來了。
 */
function retentionCutoffKey(now) {
  const tz = Session.getScriptTimeZone();

  const year  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const month = Number(Utilities.formatDate(now, tz, 'MM'));
  const day   = Number(Utilities.formatDate(now, tz, 'dd'));

  let ty = year, tm = month - RETENTION.MONTHS;
  while (tm <= 0) { tm += 12; ty -= 1; }

  const td = Math.min(day, daysInMonth(ty, tm));

  return String(ty) + ('0' + tm).slice(-2) + ('0' + td).slice(-2);
}


/** 某年某月有幾天（含閏年判斷） */
function daysInMonth(year, month) {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month !== 2) return days[month - 1];

  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 29 : 28;
}


/** 從「圖片連結」欄取出所有 Drive 檔案 ID */
function imageFileIds(value) {
  return str(value)
    .split(String.fromCharCode(10))
    .map(function (u) { return extractDriveFileId(u.trim()); })
    .filter(function (id) { return id; });
}


// ===== 實際動手 =====

/**
 * 把一筆案件去識別化。
 *
 * 順序是刻意的：**先丟照片，再清欄位。**
 *
 * 如果反過來，萬一清完欄位之後丟照片失敗，
 * Sheet 裡的圖片連結已經沒了，那幾張照片就變成沒有人知道存在的孤兒檔案，
 * 永遠留在 Drive 裡——那正好是這個功能要消滅的東西。
 *
 * 反過來說，先丟照片、清欄位時失敗的話，下個月再跑一次就會補上，
 * 不會留下任何遺留物。
 */
function applyDeidentify(sheet, colMap, item, now) {
  item.image_ids.forEach(function (id) {
    try {
      // 丟垃圾桶不是永久刪除：判斷錯了還有 30 天可以救
      DriveApp.getFileById(id).setTrashed(true);
      item.trashed++;
    } catch (e) {
      // 檔案早就被手動刪掉是很正常的，不該讓整支排程掛掉
      logError('applyDeidentify', '', e, { case_id: item.case_id, file_id: id });
    }
  });

  // 一律「先設格式再寫值」（設計約定第 11 條），用 setTextCell 就對了
  setTextCell(sheet, item.row, colMap.emp_id,     '');
  setTextCell(sheet, item.row, colMap.emp_name,   '');
  setTextCell(sheet, item.row, colMap.image_urls, '');

  /**
   * 稽核紀錄借用既有的「最後更新時間 / 最後更新者」兩欄。
   *
   * 為什麼不新增一個「去識別化時間」欄：加欄位就要升級 Sheet，
   * 而改欄位定義是這個專案踩過最痛的坑（設計約定第 12 條）。
   * 這兩欄本來的意思就是「最後是誰、什麼時候動了這筆資料」，
   * 系統自己動的也算，語意完全吻合。
   */
  setDateCell(sheet, item.row, colMap.last_updated_at, now);
  setTextCell(sheet, item.row, colMap.last_updated_by, RETENTION.MARKER);
}


// ===== 報告 =====

/**
 * 把掃描 / 執行結果寫成人看得懂的報告。
 *
 * @param {boolean} dryRun 試跑模式（只列名單，不改資料）
 */
function buildRetentionReport(result, dryRun) {
  const out = [];

  out.push(dryRun
    ? '===== 【試跑】去識別化：只列名單，不會改任何資料 ====='
    : '===== 去識別化執行結果 =====');
  out.push('');
  out.push('保存政策：結案滿 ' + RETENTION.MONTHS + ' 個月');
  out.push('本次的分界日：' + result.cutoff_date + '（在這天以前結案的才會處理）');
  out.push('掃過 ' + result.scanned + ' 筆案件');
  out.push('');

  if (result.targets.length === 0) {
    out.push('✔ 沒有任何案件到期，不需要處理。');

  } else if (dryRun) {
    out.push('以下 ' + result.targets.length + ' 件到期，實際執行時會清掉工號、姓名與照片：');
    out.push('');
    pushCaseLines(out, result.targets);
    out.push('');
    out.push('確認名單沒問題之後，執行 deidentifyNow() 才會真的動手。');

  } else {
    const rest = result.targets.length - result.done;

    out.push('✔ 已處理 ' + result.done + ' 件，照片丟進垃圾桶 ' + result.images_trashed + ' 張。');
    out.push('  （照片在垃圾桶裡還有 30 天可以救回來，之後 Google 會自己永久刪除）');
    out.push('');
    pushCaseLines(out, result.targets.slice(0, result.done));

    // ⚠️ 有沒有做完一定要說清楚。
    //    只寫「已處理 300 件」的話，看起來像做完了，其實還剩一大堆
    if (rest > 0) {
      out.push('');
      out.push('⚠️ 這次只處理了 ' + RETENTION.MAX_PER_RUN + ' 件（單次執行時間有上限），');
      out.push('   還有 ' + rest + ' 件沒處理。下個月的排程會接著做，');
      out.push('   不想等的話現在再執行一次 deidentifyNow() 就好。');
    }
  }

  if (result.already_clean > 0) {
    out.push('');
    out.push('（另有 ' + result.already_clean + ' 件已到期但先前就清過了，這次跳過）');
  }

  // 已結案卻沒有結案時間 = 資料有問題。
  // 不講出來的話，這些案件會永遠不被清，而且沒有任何人知道
  if (result.no_date.length > 0) {
    out.push('');
    out.push('⚠️ 這 ' + result.no_date.length + ' 件的狀態是「已結案」，但「處理時間」欄是空的，');
    out.push('   判斷不出什麼時候到期，因此永遠不會被清掉。請手動補上結案時間：');
    out.push('   ' + result.no_date.slice(0, 20).join('、')
             + (result.no_date.length > 20 ? ' …等 ' + result.no_date.length + ' 件' : ''));
  }

  return out.join('\n');
}


/** 名單每件一行，最多列 50 件 */
function pushCaseLines(out, items) {
  items.slice(0, 50).forEach(function (item) {
    out.push('・' + item.case_id
           + '　' + item.date + ' ' + item.reason
           + '　工號 ' + (item.emp_id || '（空）')
           + '　照片 ' + item.image_ids.length + ' 張');
  });

  if (items.length > 50) {
    out.push('… 其餘 ' + (items.length - 50) + ' 件未列出');
  }
}
