/**
 * 寄信的共用部分（規格 §10）
 *
 * 每日清單、每月月報、備份失敗通知都走這裡，
 * 這樣「收件人怎麼挑」「信長什麼樣子」只有一份定義。
 *
 *
 * ⚠️ 排程寄出的信跟前面三個階段的程式有一個根本差別：**出錯時沒有人在場。**
 *
 *    使用者按按鈕出錯，畫面上會跳紅字，他馬上就知道。
 *    但排程是早上 8 點自己跑的，錯了只是「信沒來」——
 *    而「信沒來」跟「今天剛好沒有未處理案件」看起來一模一樣。
 *
 *    所以這個檔案裡每一支都要把錯誤寫進「錯誤日誌」分頁，
 *    而且不吞掉例外（讓 Apps Script 自己的失敗通知也發得出來）。
 *
 *
 * 📌 關於寄件人：Apps Script 一律從**專案擁有者的 Google 帳號**寄出，
 *    程式改不了寄件地址，只能改顯示名稱（REPORT.SENDER_NAME）。
 */


// ===== 收件人 =====

/**
 * 取得報表的收件人。
 *
 * **收件人 = 啟用中的超級管理者 ＋「選項設定」裡類型為 REPORT_TO 的額外地址。**
 *
 * ⚠️ 這裡與規格 §10 原本寫的「所有 ACTIVE 管理者」不同，是刻意改的。
 *    實際運作是超級管理者看完再交辦，一般管理者不需要每天收到全廠清單。
 *
 *    但要知道這件事的連帶影響：**日報是「今天該處理哪些案件」的行動清單。**
 *    一般管理者收不到的話，他們不會主動知道有什麼要處理——
 *    派工這件事就落在超級管理者身上。
 *    哪天改成讓一般管理者自己認領案件，這裡要改回去。
 *
 * 額外名單放在「選項設定」分頁，跟處理者名單同一套作法（設計約定第 7 條）：
 * 加一列、啟用打勾就生效，不必改程式。
 *
 * 三道篩選（三種來源都要過）：
 *   1. 啟用中——停用的人不該再收到內部案件清單
 *   2. Email 有填且格式正確——測試帳號的 Email 欄是刻意留空的，
 *      沒這道的話每天都會有幾封信寄到不存在的地址
 *   3. **同一個信箱只留一份**——兩個管理者帳號共用一個信箱是很常見的，
 *      沒去重的話那個人每天會收到兩封一模一樣的信
 *
 * @return {Array} [{ email, name }, ...]
 */
function getReportRecipients() {
  const list = [];

  // --- 來源 1：啟用中的超級管理者 ---
  readAllAdmins().forEach(function (admin) {
    if (normalizeRole(admin.role) !== ADMIN_ROLES.SUPER) return;
    if (normalizeAdminStatus(admin.status) !== ADMIN_STATUS.ACTIVE) return;
    list.push({ email: str(admin.email), name: str(admin.name) });
  });

  // --- 來源 2：選項設定裡的額外地址 ---
  getExtraReportRecipients().forEach(function (person) {
    list.push(person);
  });

  // --- 過濾與去重 ---
  const seen = {};
  return list.filter(function (person) {
    if (!person.email || !looksLikeEmail(person.email)) return false;

    const key = person.email.toLowerCase();
    if (seen[key]) return false;      // 同一個信箱只寄一次
    seen[key] = true;
    return true;
  });
}


/**
 * 讀「選項設定」分頁裡類型為 REPORT_TO 的額外收件人。
 *
 * 欄位對應（與其他選項類型不同，見 Config.js 的說明）：
 *   代碼欄     → Email 地址
 *   中文顯示欄 → 用途說明（廠長、秘書…），只是備註
 *   啟用欄     → FALSE 就跳過，不必刪掉那一列
 *
 * 讀取失敗回傳空陣列：少幾個額外收件人不該讓整封日報都寄不出去。
 */
function getExtraReportRecipients() {
  try {
    const sheet   = getSheet(SHEETS.OPTIONS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const out = [];

    sheet.getRange(2, 1, lastRow - 1, 6).getValues().forEach(function (row) {
      if (str(row[0]).toUpperCase() !== REPORT_TO_OPTION_TYPE) return;
      if (!isTrue(row[5])) return;      // 啟用欄沒打勾就跳過

      const email = str(row[1]);
      if (!email) return;

      out.push({ email: email, name: str(row[2]) || str(row[3]) || email });
    });

    return out;

  } catch (e) {
    logError('getExtraReportRecipients', '', e, {});
    return [];
  }
}


// ===== 寄信 =====

/**
 * 把同一封信分別寄給每一位收件人。
 *
 * 為什麼一人一封、不是一封信塞滿收件人：
 *   - 每個人只看到自己的信箱，不會拿到一份全體管理者的通訊錄
 *   - 其中一個地址壞掉時，其他人照樣收得到
 *
 * 額度不是問題：免費 Gmail 是每天 100 個收件人，
 * 管理者只有個位數，每天一封日報也才用掉不到 10 個。
 *
 * @param  {string} subject  主旨
 * @param  {Function} buildHtml 收到 { email, name } 回傳 HTML 字串
 * @param  {string} source   出錯時寫進錯誤日誌的來源名稱
 * @return {Object} { sent, failed, skipped }
 */
function sendToRecipients(subject, buildHtml, source) {
  const recipients = getReportRecipients();

  if (recipients.length === 0) {
    // 這不是「沒事發生」，是設定有問題——所有管理者的 Email 欄都是空的。
    // 不記下來的話，會變成「信一直沒來，但沒有任何人知道為什麼」
    logError(source, '', new Error('沒有任何可用的收件人'), {
      hint: '請確認「管理者名單」至少有一位啟用中的管理者填了 Email',
    });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0, failed = 0, authError = '';

  // 用 for 而不是 forEach：授權不足時要能中斷。
  // forEach 沒辦法 break，會把每一位收件人都試一次、每一次都失敗
  for (let i = 0; i < recipients.length; i++) {
    const person = recipients[i];

    try {
      MailApp.sendEmail({
        to:       person.email,
        subject:  subject,
        htmlBody: buildHtml(person),
        name:     REPORT.SENDER_NAME,
      });
      sent++;

    } catch (e) {
      // 一個人的信箱有問題不該讓其他人也收不到，所以在迴圈裡各自 try
      failed++;
      logError(source, '', e, { recipient: person.email });

      // 授權不足是另一回事：那不是「這個收件人有問題」，是整個功能都還不能用。
      // 剩下的人一定也會失敗，繼續試只是多寫幾筆一模一樣的錯誤日誌
      if (isAuthorizationError(e)) {
        authError = String(e);
        break;
      }
    }
  }

  return { sent: sent, failed: failed, skipped: 0, auth_error: authError };
}


/**
 * 這個錯誤是不是「權限還沒授權」？
 *
 * ⚠️ 為什麼要特別認出它：這是新增一支會用到新服務的功能時，第一次執行幾乎必然遇到的錯。
 *
 *    Apps Script 是靠掃描程式碼推算需要哪些權限的。
 *    剛推上新程式碼時，它可能還在用舊的權限清單，
 *    於是「授權畫面按過了，但寄信照樣被擋」——
 *    而錯誤訊息只會顯示成「失敗 N 封」，看不出是授權問題。
 *
 *    解法很簡單（再執行一次，這次的授權畫面就會包含新權限），
 *    但前提是要知道問題出在授權。所以這裡要把它跟一般的寄信失敗分開講。
 */
function isAuthorizationError(error) {
  const text = String((error && error.message) || error);
  return text.indexOf('permission') >= 0
      || text.indexOf('Authorization') >= 0
      || text.indexOf('authorization') >= 0;
}


// ===== HTML 信件的外框 =====

/**
 * 把內容包成一封完整的 HTML 信。
 *
 * ⚠️ 信件的 HTML 跟網頁的 HTML 不一樣：
 *    很多信箱軟體（尤其 Outlook）會把 <style> 區塊整個丟掉，
 *    所以樣式一律寫成每個標籤上的 style="..."，不能用 class。
 *    版面也用 table 排，不用 flex / grid。
 *
 * @param {string} title    大標題
 * @param {string} subtitle 標題下的小字（日期之類）
 * @param {string} body     內容的 HTML
 * @param {string} linkText 底部按鈕文字
 * @param {string} linkUrl  底部按鈕連結
 */
function buildEmailHtml(title, subtitle, body, linkText, linkUrl) {
  return [
    '<div style="font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;',
    '            font-size:14px;line-height:1.6;color:#1A1A1D;',
    '            max-width:680px;margin:0 auto;padding:16px;">',

    '  <div style="border-bottom:3px solid #1A1A1C;padding-bottom:12px;margin-bottom:20px;">',
    '    <div style="font-size:18px;font-weight:bold;">' + escapeForHtml(title) + '</div>',
    subtitle
      ? '    <div style="color:#53535A;font-size:13px;margin-top:4px;">' + escapeForHtml(subtitle) + '</div>'
      : '',
    '  </div>',

    body,

    linkUrl
      ? ('  <div style="margin-top:24px;">' +
         '    <a href="' + escapeForHtml(linkUrl) + '" ' +
         '       style="display:inline-block;background:#1A1A1C;color:#F2F2EF;' +
         '              text-decoration:none;padding:12px 20px;border-radius:8px;' +
         '              font-weight:bold;">' + escapeForHtml(linkText) + '</a>' +
         '  </div>')
      : '',

    buildEmailFooter(),
    '</div>',
  ].join('\n');
}


/**
 * 把文字安全地放進 HTML。
 *
 * 案件描述、餐廳名稱都是使用者或管理者自己打的，
 * 裡面出現 `<` 或 `&` 時若不處理，輕則版面壞掉，重則整段內容不見。
 *
 * ⚠️ 這一支跟前端 js/ui.js 的 escapeHtml() 是兩份。
 *    後端沒有 document 可以用，只能自己換字元。
 */
function escapeForHtml(text) {
  return str(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/**
 * 產生一個表格。
 *
 * @param {Array} headers 表頭文字
 * @param {Array} rows    每列是 { cells: [...], highlight: boolean }
 */
function buildEmailTable(headers, rows) {
  const out = [
    '<table style="border-collapse:collapse;width:100%;font-size:13px;">',
    '  <tr>',
  ];

  headers.forEach(function (h) {
    out.push('    <th style="text-align:left;padding:8px 10px;background:#E7E7E6;' +
             'border-bottom:2px solid #DEDEDD;white-space:nowrap;">' + escapeForHtml(h) + '</th>');
  });
  out.push('  </tr>');

  rows.forEach(function (row) {
    // 逾期的整列標紅（規格 §10.1）。
    // 只在文字上加顏色是不夠的——一整片表格裡，一個紅字掃過去根本看不到
    const bg = row.highlight ? 'background:#FBEDEC;' : '';
    out.push('  <tr style="' + bg + '">');
    row.cells.forEach(function (cell) {
      out.push('    <td style="padding:8px 10px;border-bottom:1px solid #EDEDEB;' +
               (row.highlight ? 'color:#A81E1E;' : '') + '">' + cell + '</td>');
    });
    out.push('  </tr>');
  });

  out.push('</table>');
  return out.join('\n');
}


/**
 * 信件最下方的系統資訊，內容與 app 頁尾一致：
 * 維護單位 → 聯絡方式 → 系統版本，最後才是「自動寄出，不需回覆」。
 *
 * 📌 為什麼要跟 app 長得一樣：收信的人跟用 app 的是同一批人。
 *    有人回報問題時可以先問他看到的版本號，信裡也印得出來就少問一輪。
 *
 * ⚠️ 內容取自 gas/Config.js 的 SYSTEM_INFO，那是前端 js/config.js 的複本。
 *    **版本號印錯比不印還糟**（有人拿著錯的版本號來回報問題），
 *    所以有一支測試專門盯兩邊一致：node tools/test-version-sync.js
 *
 * ⚠️ 版本號那一行是連結，點了會到員工端首頁。
 *    `<a>` 一定要自己寫 color 與 text-decoration——
 *    Gmail、Outlook 會把沒指定顏色的連結一律改成藍色底線，
 *    整片灰色的頁尾就會突然冒出一條藍字。
 */
function buildEmailFooter() {
  const rows = [];

  const maintainer = bilingualText(
    SYSTEM_INFO.maintainer && SYSTEM_INFO.maintainer.id,
    SYSTEM_INFO.maintainer && SYSTEM_INFO.maintainer.zh
  );

  if (maintainer) {
    rows.push('    <div>Dikelola oleh · 維護單位：' + escapeForHtml(maintainer) + '</div>');
  }

  if (SYSTEM_INFO.contact) {
    rows.push('    <div>Kontak · 聯絡方式：' + escapeForHtml(SYSTEM_INFO.contact) + '</div>');
  }

  if (SYSTEM_INFO.version) {
    const versionText = 'Versi · 系統版本 ' + SYSTEM_INFO.version
                      + (SYSTEM_INFO.year ? ' · ' + SYSTEM_INFO.year : '');

    rows.push('    <div><a href="' + escapeForHtml(SITE_URL) + '" ' +
              'style="color:#53535A;text-decoration:underline;">' +
              escapeForHtml(versionText) + '</a></div>');
  }

  return [
    '  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #DEDEDD;',
    '              color:#6A6A70;font-size:12px;line-height:1.7;">',
    '    <div style="color:#53535A;font-weight:bold;">'
      + escapeForHtml(REPORT.SENDER_NAME) + '</div>',
    rows.join('\n'),
    '    <div style="margin-top:8px;">',
    '      Email ini dikirim otomatis oleh sistem, tidak perlu dibalas.',
    '      <br>這封信由系統自動寄出，不需要回覆。',
    '    </div>',
    '  </div>',
  ].join('\n');
}


/**
 * 兩種語言並排顯示，印尼文在前。
 *
 * 與 optionText() 同一套規則，只是這裡的來源不是選項設定：
 *   - 兩邊一樣 → 只顯示一次（否則會變成「PCI GA · PCI GA」）
 *   - 只有一邊有填 → 就顯示那一邊
 */
function bilingualText(idText, zhText) {
  const a = str(idText);
  const b = str(zhText);

  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;

  return a + ' · ' + b;
}
