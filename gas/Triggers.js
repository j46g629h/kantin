/**
 * 觸發器（排程）管理
 *
 * 觸發器就是 Apps Script 的鬧鐘：設定「每天早上 8 點跑這支函式」之後，
 * 不需要有人開著網頁，Google 會自己執行。
 *
 *
 * ⚠️ 三件關於觸發器的事，不知道會出問題：
 *
 * 1. **重複安裝會變成寄兩封信。**
 *    每執行一次 `ScriptApp.newTrigger()` 就多一個鬧鐘，
 *    它不會覺得「已經有一個一樣的了」。所以 installTriggers() 一定要先清乾淨。
 *
 * 2. **時間不是準點。** `atHour(8)` 的意思是「8 點到 9 點之間的某個時刻」，
 *    不是 8:00:00。Google 自己調度，這改不了，也不需要改。
 *
 * 3. **觸發器是跟著「安裝的人」跑的。** 你安裝的鬧鐘，
 *    之後就是用你的 Google 帳號權限執行、用你的帳號寄信。
 *    換人接手系統時，新的人要自己重跑一次 installTriggers()。
 */


/**
 * 這個專案會用到的所有排程。
 *
 * 新增排程時只要往這個清單加一筆，install / list / remove 三支都會自動跟著處理。
 * 之所以集中成一份清單，是因為「安裝時加了、移除時忘了」是最容易留下孤兒鬧鐘的地方。
 */
const SCHEDULED_JOBS = [
  {
    handler: 'sendDailyReport',
    label:   '每日未處理清單',
    build:   function () {
      return ScriptApp.newTrigger('sendDailyReport')
        .timeBased()
        .atHour(REPORT.DAILY_HOUR)
        .everyDays(1)
        .create();
    },
    describe: '每天 ' + REPORT.DAILY_HOUR + ':00 前後（規格 §10.1）',
  },
  {
    handler: 'sendMonthlyReport',
    label:   '每月統計月報',
    build:   function () {
      return ScriptApp.newTrigger('sendMonthlyReport')
        .timeBased()
        .onMonthDay(1)
        .atHour(REPORT.MONTHLY_HOUR)
        .create();
    },
    describe: '每月 1 日 ' + REPORT.MONTHLY_HOUR + ':00 前後，統計上個月（規格 §10.2）',
  },
  {
    handler: 'backupMonthly',
    label:   '每月自動備份',
    build:   function () {
      return ScriptApp.newTrigger('backupMonthly')
        .timeBased()
        .onMonthDay(1)
        .atHour(BACKUP.MONTHLY_HOUR)
        .create();
    },
    describe: '每月 1 日 ' + BACKUP.MONTHLY_HOUR + ':00 前後，複製整份 Sheet（關卡 4-4）',
  },
  {
    handler: 'deidentifyMonthly',
    label:   '結案滿 13 個月去識別化',
    build:   function () {
      return ScriptApp.newTrigger('deidentifyMonthly')
        .timeBased()
        .onMonthDay(1)
        .atHour(RETENTION.MONTHLY_HOUR)
        .create();
    },
    describe: '每月 1 日 ' + RETENTION.MONTHLY_HOUR + ':00 前後，'
            + '清工號 / 姓名 / 照片（關卡 4-5，會改資料）',
  },
];


/**
 * ⚠️ **同一天的排程，時間一定要錯開，而且要照該有的順序排。**
 *
 *    同一個小時的兩個觸發器**沒有先後順序保證**——Google 自己調度。
 *    備份如果排在去識別化後面才跑，備到的就是已經被清掉的資料，
 *    安全網等於不存在，而且完全看不出來哪裡不對。
 *
 *    目前每月 1 日的順序：
 *
 *      02:00  backupMonthly      先把安全網架好
 *      05:00  deidentifyMonthly  再清掉滿 13 個月的個資
 *      08:00  sendMonthlyReport  最後寄上個月的統計
 *
 *    **光靠時間排序是不夠的。** 萬一那天的備份剛好失敗，時間再怎麼排也沒用，
 *    所以 deidentifyMonthly 自己還會再檢查一次「有沒有近期備份」，
 *    沒有就拒絕執行（見 gas/Retention.js 的 requireRecentBackup）。
 */


/**
 * 安裝全部排程。
 *
 * 會先把舊的移除再重裝，所以**重複執行是安全的**——
 * 不會變成一天寄好幾封信。改了時間設定之後也是重跑這一支就好。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 installTriggers → 按 ▷ → 看執行紀錄
 */
function installTriggers() {
  const removed = removeTriggers(true);   // true = 安靜模式，不要印兩份報告

  const report = ['===== 安裝排程 ====='];
  if (removed > 0) report.push('（先移除了 ' + removed + ' 個既有排程，避免重複）');
  report.push('');

  SCHEDULED_JOBS.forEach(function (job) {
    job.build();
    report.push('✔ ' + job.label + '　' + job.describe);
  });

  report.push('');
  report.push('時區：' + Session.getScriptTimeZone());
  report.push('⚠️ 實際執行時間會落在該小時內的某個時刻，不是準點，這是 Google 的排程方式。');
  report.push('');
  report.push('想先測試不要等：sendDailyReportNow() / sendMonthlyReportNow() / backupNow()。');
  report.push('⚠️ 去識別化會改資料，先用 previewDeidentify() 試跑看名單，確認後才執行 deidentifyNow()。');
  report.push('想停掉全部排程：執行 removeTriggers()。');

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}


/**
 * 列出目前裝了哪些排程。
 *
 * 「信怎麼沒來」的第一個檢查點就是這裡——
 * 有可能根本沒裝，或是不小心裝了兩個。
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  if (triggers.length === 0) {
    const msg = '目前沒有任何排程。要安裝請執行 installTriggers()。';
    Logger.log(msg);
    return msg;
  }

  const report = ['===== 目前的排程（' + triggers.length + ' 個）====='];
  const counts = {};

  triggers.forEach(function (trigger) {
    const handler = trigger.getHandlerFunction();
    counts[handler] = (counts[handler] || 0) + 1;
    report.push('・' + handler + '　（' + labelOfJob(handler) + '）');
  });

  // 同一支函式裝了兩個以上，就是會重複寄信
  const duplicated = Object.keys(counts).filter(function (h) { return counts[h] > 1; });
  if (duplicated.length > 0) {
    report.push('');
    report.push('⚠️ 這幾支被重複安裝了，會重複執行：' + duplicated.join('、'));
    report.push('   執行 installTriggers() 可以清乾淨再重裝一次。');
  }

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}


/**
 * 移除全部排程。
 *
 * 開發期間不想每天收到信時很好用，之後再執行 installTriggers() 裝回來。
 *
 * ⚠️ 這會移除這個專案的**所有**觸發器，不只清單裡列的那幾支。
 *    這是刻意的：改過函式名稱之後，舊名字的鬧鐘會變成孤兒——
 *    清單裡查不到它，但它每天還是照跑，而且一定會失敗。
 *
 * @param  {boolean} quiet 安靜模式（給 installTriggers 內部呼叫用）
 * @return {number} 移除了幾個
 */
function removeTriggers(quiet) {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  if (!quiet) {
    const msg = triggers.length > 0
      ? '已移除 ' + triggers.length + ' 個排程。要裝回來請執行 installTriggers()。'
      : '本來就沒有任何排程。';
    Logger.log(msg);
  }
  return triggers.length;
}


/** 用函式名稱查中文說明；查不到就標記為孤兒（多半是改過函式名稱留下的） */
function labelOfJob(handler) {
  const job = SCHEDULED_JOBS.filter(function (j) { return j.handler === handler; })[0];
  return job ? job.label : '⚠️ 不在清單中，可能是舊版本留下的';
}
