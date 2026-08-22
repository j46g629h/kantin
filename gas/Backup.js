/**
 * 每月自動備份（關卡 4-4）
 *
 * 每月 1 日凌晨把整份 Google Sheet 複製一份到 Drive 的「備份」資料夾，
 * 只保留最近幾份，舊的自動丟進垃圾桶。
 *
 *
 * 📌 **這個備份是在防什麼，要先講清楚，不然會誤以為它保護的範圍比實際大。**
 *
 *    ✅ 防得住：手滑把幾列改壞、刪掉一整個分頁、程式出錯寫壞資料、
 *              **去識別化（關卡 4-5）清掉了不該清的東西**
 *
 *    ❌ 防不住：整個 Google 帳號出事（被盜、被停用）。
 *              備份跟正本在同一個 Drive、同一個帳號底下，
 *              帳號沒了就一起沒了。要防這個必須把檔案放到 Google 以外的地方，
 *              而那需要付費服務或每個月有人手動下載——
 *              以這個系統的規模（每月 50 筆）不值得，但**要知道有這個缺口**。
 *
 *
 * 📌 為什麼只備份 Sheet，不備份照片：
 *
 *    1. **備份照片會讓去識別化失效。** 4-5 刪照片是為了個資保護，
 *       但如果備份裡還留著同一批照片，那些照片其實一張都沒有消失，
 *       只是換個資料夾放。等於白做。
 *
 *    2. 照片的救援另有更好的辦法：4-5 刪照片時用「丟進垃圾桶」而不是永久刪除，
 *       **Drive 垃圾桶會保留 30 天**，這 30 天內隨時救得回來，
 *       30 天後 Google 自己永久刪除。零維護、不佔額外空間，
 *       而且時間到了是真的刪掉——這正是個資政策要的效果。
 *
 *    3. 照片是整個系統裡最佔空間的東西，複製一份等於容量直接翻倍。
 *
 *
 * ⚠️ 備份檔裡有工號、姓名，還有整份員工名冊（約 11,000 筆個資）。
 *    **絕對不可以分享給任何人，也不可以下載後隨手放在桌面。**
 */


/**
 * 觸發器每月 1 日凌晨呼叫的就是這一支。
 *
 * 與報表相同，不吞例外：往外丟，Google 才會寄「指令碼執行失敗」通知。
 * 備份失敗如果安靜地過去，等到真的需要它的那天才發現沒有，就太遲了。
 *
 * @return {string} 執行結果的說明（手動執行時會印在執行紀錄上）
 */
function backupMonthly() {
  try {
    const result = runBackup();

    const lines = [
      '✔ 備份完成：' + result.name,
      '',
      '保留 ' + result.kept + ' 份'
        + (result.removed > 0 ? '，清掉 ' + result.removed + ' 份舊的（在垃圾桶，30 天內救得回來）' : ''),
      '位置：Drive → ' + BACKUP.FOLDER_NAME + ' 資料夾',
    ];

    const msg = lines.join(String.fromCharCode(10));
    Logger.log(msg);
    return msg;

  } catch (e) {
    logError('backupMonthly', '', e, {});
    throw e;      // 讓 Apps Script 的失敗通知也發得出去
  }
}


/**
 * 手動備份一次（不必等到下個月 1 號）。
 *
 * 執行方式：Apps Script 編輯器 → 函式選 backupNow → 按 ▷ → 看執行紀錄
 *
 * 要動 Sheet 結構、要跑沒把握的維運腳本之前，先按一下這個。
 */
function backupNow() {
  return backupMonthly();
}


/**
 * 實際做備份：複製整份 Sheet，然後清掉超出保留份數的舊檔。
 *
 * @return {Object} { name, url, kept, removed }
 */
function runBackup() {
  const folder = getBackupFolder();

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  const name  = BACKUP.NAME_PREFIX + stamp;

  // makeCopy 會連同所有分頁、格式、資料一起複製，
  // 還原時直接打開來把需要的列複製回去就好，不必匯入匯出
  const copy = DriveApp.getFileById(SHEET_ID).makeCopy(name, folder);

  const removed = cleanOldBackups(folder);

  return {
    name:    name,
    url:     copy.getUrl(),
    kept:    BACKUP.KEEP_COUNT,
    removed: removed,
  };
}


/**
 * 取得備份資料夾，不存在就建立。
 *
 * 建在「圖片」資料夾的同一層（也就是 PCI餐廳回饋系統 底下），
 * 這樣不必再多記一組資料夾 ID——多一個要手動填的 ID，
 * 就多一個換人接手時會填錯的地方。
 */
function getBackupFolder() {
  const imageFolder = DriveApp.getFolderById(DRIVE_IMAGE_FOLDER_ID);
  const parents     = imageFolder.getParents();

  // 圖片資料夾理論上一定有上層，但真的沒有時（被搬到「我的雲端硬碟」根目錄）
  // 就退而求其次建在圖片資料夾裡面，總比整支備份掛掉好
  const root = parents.hasNext() ? parents.next() : imageFolder;

  const found = root.getFoldersByName(BACKUP.FOLDER_NAME);
  return found.hasNext() ? found.next() : root.createFolder(BACKUP.FOLDER_NAME);
}


/**
 * 清掉超出保留份數的舊備份。
 *
 * ⚠️ **只動檔名開頭是 BACKUP.NAME_PREFIX 的檔案。**
 *    使用者可能自己放東西進這個資料夾（手動下載的匯出檔、說明文件），
 *    「自動清理」把使用者的檔案誤刪，是這整個功能最不能發生的事。
 *
 * ⚠️ 用 setTrashed(true) 丟垃圾桶，不是永久刪除。
 *    萬一保留份數設錯、或某次備份其實還需要，垃圾桶裡有 30 天可以救。
 *
 * @return {number} 清掉幾份
 */
function cleanOldBackups(folder) {
  const mine  = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().indexOf(BACKUP.NAME_PREFIX) !== 0) continue;   // 不是我們產生的，不碰
    mine.push(file);
  }

  // 檔名是 備份_yyyy-MM-dd_HHmm，補零過的，所以字串由大到小排就是新到舊
  mine.sort(function (a, b) {
    return a.getName() < b.getName() ? 1 : (a.getName() > b.getName() ? -1 : 0);
  });

  let removed = 0;

  mine.slice(BACKUP.KEEP_COUNT).forEach(function (file) {
    try {
      file.setTrashed(true);
      removed++;
    } catch (e) {
      // 清不掉舊的不影響這次備份的正確性，記下來就好
      logError('cleanOldBackups', '', e, { file: file.getName() });
    }
  });

  return removed;
}


/**
 * 列出目前有哪些備份。
 *
 * 「備份到底有沒有在跑」的第一個檢查點就是這裡。
 * 排程壞掉的時候，畫面上不會有任何跡象——最舊的那份日期會停在某一天不動。
 */
function listBackups() {
  const folder = getBackupFolder();
  const items  = backupList(folder);

  if (items.length === 0) {
    const msg = '備份資料夾裡還沒有任何備份。要現在做一份請執行 backupNow()。';
    Logger.log(msg);
    return msg;
  }

  const report = ['===== 目前的備份（' + items.length + ' 份）====='];

  items.forEach(function (item) {
    report.push('・' + item.name + '　（' + item.age_days + ' 天前）');
  });

  report.push('');
  report.push('保留設定：最近 ' + BACKUP.KEEP_COUNT + ' 份（gas/Config.js 的 BACKUP.KEEP_COUNT）');

  // 最新一份太舊 = 排程沒在跑。這是這支函式真正要回答的問題
  if (items[0].age_days > 40) {
    report.push('');
    report.push('⚠️ 最新的一份已經是 ' + items[0].age_days + ' 天前的了，排程可能沒在跑。');
    report.push('   執行 listTriggers() 確認 backupMonthly 有沒有裝上去。');
  }

  const msg = report.join('\n');
  Logger.log(msg);
  return msg;
}


/**
 * 最新一份備份的資訊，查不到回傳 null。
 *
 * 📌 這一支是給關卡 4-5（去識別化）用的：**動手刪資料之前先確認安全網在。**
 *    沒有近期備份就拒絕執行——在沒有安全網的情況下拆房子，
 *    出事了就沒有第二次機會。
 *
 * @return {Object|null} { name, age_days }
 */
function latestBackupInfo() {
  try {
    const items = backupList(getBackupFolder());
    return items.length > 0 ? items[0] : null;
  } catch (e) {
    logError('latestBackupInfo', '', e, {});
    return null;
  }
}


/**
 * 把備份資料夾裡屬於我們的檔案整理成清單，新的排前面。
 *
 * @return {Array} [{ name, age_days }]
 */
function backupList(folder) {
  const out   = [];
  const files = folder.getFiles();
  const now   = new Date();

  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().indexOf(BACKUP.NAME_PREFIX) !== 0) continue;

    const created = file.getDateCreated();

    out.push({
      name:     file.getName(),
      age_days: Math.floor((now - created) / 86400000),
    });
  }

  return out.sort(function (a, b) {
    return a.name < b.name ? 1 : (a.name > b.name ? -1 : 0);
  });
}
