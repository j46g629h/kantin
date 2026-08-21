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
 * 取得報表的收件人（規格 §10：所有 ACTIVE 管理者）。
 *
 * 兩道篩選：
 *   1. 狀態是啟用中——離職停用的人不該再收到內部案件清單
 *   2. Email 欄有填且長得像 email
 *
 * 第 2 道很重要：測試帳號的 Email 欄是刻意留空的，
 * 沒有這道篩選的話，每天早上都會有幾封信寄到不存在的地址。
 *
 * @return {Array} [{ email, name }, ...]
 */
function getReportRecipients() {
  return readAllAdmins()
    .filter(function (admin) {
      return normalizeAdminStatus(admin.status) === ADMIN_STATUS.ACTIVE;
    })
    .map(function (admin) {
      return { email: str(admin.email), name: str(admin.name) };
    })
    .filter(function (person) {
      return person.email && looksLikeEmail(person.email);
    });
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

  let sent = 0, failed = 0;

  recipients.forEach(function (person) {
    try {
      MailApp.sendEmail({
        to:       person.email,
        subject:  subject,
        htmlBody: buildHtml(person),
        name:     REPORT.SENDER_NAME,
      });
      sent++;
    } catch (e) {
      // 一個人寄失敗不該讓其他人也收不到，所以在迴圈裡各自 try
      failed++;
      logError(source, '', e, { recipient: person.email });
    }
  });

  return { sent: sent, failed: failed, skipped: 0 };
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
    '            font-size:14px;line-height:1.6;color:#1f2328;',
    '            max-width:680px;margin:0 auto;padding:16px;">',

    '  <div style="border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">',
    '    <div style="font-size:18px;font-weight:bold;">' + escapeForHtml(title) + '</div>',
    subtitle
      ? '    <div style="color:#6b7280;font-size:13px;margin-top:4px;">' + escapeForHtml(subtitle) + '</div>'
      : '',
    '  </div>',

    body,

    linkUrl
      ? ('  <div style="margin-top:24px;">' +
         '    <a href="' + escapeForHtml(linkUrl) + '" ' +
         '       style="display:inline-block;background:#2563eb;color:#ffffff;' +
         '              text-decoration:none;padding:12px 20px;border-radius:8px;' +
         '              font-weight:bold;">' + escapeForHtml(linkText) + '</a>' +
         '  </div>')
      : '',

    '  <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;',
    '              color:#9ca3af;font-size:12px;">',
    '    ' + escapeForHtml(REPORT.SENDER_NAME),
    '    <br>Email ini dikirim otomatis oleh sistem, tidak perlu dibalas.',
    '    <br>這封信由系統自動寄出，不需要回覆。',
    '  </div>',
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
    out.push('    <th style="text-align:left;padding:8px 10px;background:#f9fafb;' +
             'border-bottom:2px solid #e5e7eb;white-space:nowrap;">' + escapeForHtml(h) + '</th>');
  });
  out.push('  </tr>');

  rows.forEach(function (row) {
    // 逾期的整列標紅（規格 §10.1）。
    // 只在文字上加顏色是不夠的——一整片表格裡，一個紅字掃過去根本看不到
    const bg = row.highlight ? 'background:#fef2f2;' : '';
    out.push('  <tr style="' + bg + '">');
    row.cells.forEach(function (cell) {
      out.push('    <td style="padding:8px 10px;border-bottom:1px solid #f0f1f3;' +
               (row.highlight ? 'color:#b91c1c;' : '') + '">' + cell + '</td>');
    });
    out.push('  </tr>');
  });

  out.push('</table>');
  return out.join('\n');
}
