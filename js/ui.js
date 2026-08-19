/**
 * 共用的介面小工具
 *
 * 首頁、回報頁、查詢頁都會用到的東西放這裡，
 * 避免同一段程式在三個檔案各寫一份、改的時候漏改。
 */


/**
 * 把系統資訊（維護單位 / 聯絡方式 / 版本）畫進指定容器。
 *
 * 內容取自 js/config.js 的 SYSTEM_INFO，沒填的欄位自動略過。
 * 語言切換後要重新呼叫一次才會更新文字。
 *
 * @param {string} containerId 容器元素的 id
 */
function renderSystemFooter(containerId) {
  const container = document.getElementById(containerId);
  if (!container || typeof SYSTEM_INFO === 'undefined') return;

  const rows = [];

  // 維護單位依語言取對應寫法（config.js 裡是 { zh, id } 結構）
  const maintainer = SYSTEM_INFO.maintainer
    ? (SYSTEM_INFO.maintainer[getLang()] || SYSTEM_INFO.maintainer.zh || '')
    : '';

  if (maintainer) {
    rows.push(`${t('footer.maintainer')}: ${maintainer}`);
  }
  if (SYSTEM_INFO.contact) {
    rows.push(`${t('footer.contact')}: ${SYSTEM_INFO.contact}`);
  }
  if (SYSTEM_INFO.version) {
    rows.push(`${t('footer.version')} ${SYSTEM_INFO.version}` +
              (SYSTEM_INFO.year ? ` · ${SYSTEM_INFO.year}` : ''));
  }

  container.innerHTML = '';
  rows.forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;   // 用 textContent 而非 innerHTML，避免內容被當成 HTML 執行
    container.appendChild(p);
  });
}


/**
 * 把文字安全地放進 HTML。
 * 選項名稱來自 Google Sheet，管理者可以自由編輯，
 * 直接塞進 innerHTML 的話，內容裡的角括號會被當成標籤解析。
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
