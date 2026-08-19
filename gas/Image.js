/**
 * 圖片上傳
 *
 * 前端已經把圖片壓縮好並轉成 Base64，這裡負責存進 Google Drive
 * 並回傳可檢視的連結。
 *
 * 檔案結構：PCI餐廳回饋系統/圖片/2026-08/PCI-202608-001_1.jpg
 */


/** 一筆回報最多幾張圖 */
const IMAGE_MAX_COUNT = 2;

/**
 * 單張圖片大小上限（解碼後的位元組數）。
 * 前端壓縮後通常只有 200～400 KB，這裡設 2 MB 是防呆用的，
 * 超過代表前端壓縮沒生效或有人繞過前端直接打 API。
 */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** 允許的圖片格式 */
const IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];


/**
 * 檢查前端送來的圖片資料是否合法。
 * 在還沒開始上傳之前就先擋掉，避免傳到一半才失敗。
 *
 * @param {Array} images [{ mimeType, data }]
 * @return {string} 錯誤代碼；沒問題回傳空字串
 */
function validateImages(images) {
  if (!images) return '';
  if (!Array.isArray(images)) return 'IMAGE_INVALID';
  if (images.length > IMAGE_MAX_COUNT) return 'IMAGE_TOO_MANY';

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || !img.data) return 'IMAGE_INVALID';
    if (IMAGE_ALLOWED_TYPES.indexOf(str(img.mimeType)) === -1) return 'IMAGE_TYPE_INVALID';

    // Base64 每 4 個字元代表 3 個位元組，先估算大小就不必真的解碼
    const estimatedBytes = str(img.data).length * 3 / 4;
    if (estimatedBytes > IMAGE_MAX_BYTES) return 'IMAGE_TOO_LARGE';
  }
  return '';
}


/**
 * 把圖片存進 Drive。
 *
 * ⚠️ 刻意在取得 LockService 的鎖「之前」呼叫。
 *    上傳可能要好幾秒，握著鎖做這件事會讓其他人卡住，
 *    而且執行過久時鎖會自動過期反而出錯。
 *    所以先用提交識別碼當暫時檔名，取得案件編號後再改名。
 *
 * @param {Array} images   [{ mimeType, data }]
 * @param {string} tempName 暫時檔名（用 client_submit_id）
 * @return {Array} Drive 檔案物件的陣列
 */
function saveImagesToDrive(images, tempName) {
  if (!images || !images.length) return [];

  const folder = getMonthImageFolder();
  const files = [];

  images.slice(0, IMAGE_MAX_COUNT).forEach(function (img, index) {
    const bytes = Utilities.base64Decode(str(img.data));
    const blob = Utilities.newBlob(
      bytes,
      str(img.mimeType) || 'image/jpeg',
      tempName + '_' + (index + 1) + '.jpg'
    );

    const file = folder.createFile(blob);

    // 管理者是用系統自建的帳密登入、不是 Google 帳號，
    // 圖片必須能被瀏覽器直接載入才看得到，所以開放「知道連結的人可檢視」。
    // 連結是隨機字串，猜不到。
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    files.push(file);
  });

  return files;
}


/**
 * 把暫時檔名改成案件編號。
 * 這樣管理者直接在 Drive 裡瀏覽也看得懂哪張圖屬於哪個案件。
 */
function renameImageFiles(files, caseId) {
  files.forEach(function (file, index) {
    try {
      file.setName(caseId + '_' + (index + 1) + '.jpg');
    } catch (e) {
      // 改名失敗不影響資料正確性，記錄下來就好
      Logger.log('圖片改名失敗（可忽略）: ' + e);
    }
  });
}


/** 取得圖片連結，多張以換行分隔（Sheet 裡一格可以放多行） */
function buildImageUrls(files) {
  return files.map(function (f) { return f.getUrl(); }).join('\n');
}


/**
 * 上傳失敗或後續步驟出錯時，把已經上傳的檔案刪掉，
 * 避免 Drive 累積沒有對應案件的孤兒檔案。
 */
function deleteImageFiles(files) {
  files.forEach(function (file) {
    try {
      file.setTrashed(true);
    } catch (e) {
      Logger.log('清除圖片失敗（可忽略）: ' + e);
    }
  });
}


/**
 * 取得當月的圖片資料夾，不存在就建立。
 * 依年月分資料夾，日後查找與封存都方便。
 */
function getMonthImageFolder() {
  const root = DriveApp.getFolderById(DRIVE_IMAGE_FOLDER_ID);
  const name = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');

  const found = root.getFoldersByName(name);
  return found.hasNext() ? found.next() : root.createFolder(name);
}
