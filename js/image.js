/**
 * 圖片壓縮
 *
 * 手機照片一張 3～8 MB，直接上傳會有三個問題：
 *   1. 工廠 Wi-Fi 要傳很久，員工以為當機就重按
 *   2. Apps Script 有執行時間上限，容易逾時
 *   3. Drive 免費空間很快就用完
 *
 * 壓成長邊 1600px、JPEG 品質 0.8 之後大約 200～400 KB，
 * 對於「菜裡有異物」「桌面髒污」這類佐證用途畫質綽綽有餘。
 */


/**
 * 壓縮單一檔案，回傳可直接送給後端的物件。
 *
 * @param {File} file 使用者選的檔案
 * @return {Promise<{mimeType:string, data:string, size:number, previewUrl:string}>}
 *         data 是去掉前綴的 Base64
 */
async function compressImage(file) {
  const source = await loadImageSource(file);
  const size = fitWithin(source.width, source.height, IMAGE_MAX_EDGE);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(source.image, 0, 0, size.width, size.height);

  // ImageBitmap 用完要釋放，否則手機記憶體會被吃掉
  if (source.image.close) source.image.close();
  if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);

  const blob = await canvasToBlob(canvas, IMAGE_QUALITY);
  if (!blob) throw new Error('IMAGE_COMPRESS_FAILED');

  return {
    mimeType:   'image/jpeg',
    data:       await blobToBase64(blob),
    size:       blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}


/**
 * 把檔案讀成可以畫到 canvas 的圖。
 *
 * ⚠️ 手機直向拍的照片，方向資訊存在 EXIF 裡而不是像素本身。
 *    處理不當的話，照片會變成躺著的。
 *    createImageBitmap 要明確指定 imageOrientation 才會套用 EXIF；
 *    不支援的瀏覽器則退回用 <img>，現代瀏覽器顯示 <img> 時會自動轉正。
 */
async function loadImageSource(file) {
  if (window.createImageBitmap) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, objectUrl: '' };
    } catch (e) {
      // 舊瀏覽器不支援 imageOrientation 選項，往下用 <img>
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => resolve({
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      objectUrl: objectUrl,
    });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_READ_FAILED'));
    };

    img.src = objectUrl;
  });
}


/** 等比例縮到長邊不超過 maxEdge；本來就夠小就不放大 */
function fitWithin(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: width, height: height };

  const ratio = maxEdge / longest;
  return {
    width:  Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}


function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}


/** 轉成 Base64，並去掉開頭的 data:image/jpeg;base64, 前綴 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}


/** 把位元組數轉成好讀的文字，例如 312 KB */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
