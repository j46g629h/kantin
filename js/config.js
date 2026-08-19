/**
 * 系統設定
 *
 * ⚠️ 整個專案只有這個檔案放 API 網址。
 *    以後 Apps Script 重新部署導致網址改變時，只要改這一行。
 */

// Apps Script 部署後取得的網址
// 格式類似：https://script.google.com/macros/s/AKfycb....../exec
const API_URL = 'https://script.google.com/macros/s/AKfycbyYVxnV5AZtnGkLKf0mqRTqsUmFTXI5NoaREPQYPveaCrAt1oW8JShMaZjEos6J5NVr-Q/exec';


/**
 * 首頁最下方顯示的系統資訊。
 *
 * 留空的欄位不會顯示，所以還沒決定的可以先空著。
 *
 * 📌 建議放「部門」而不是個人 email——這個頁面全廠都看得到，
 *    放個人信箱的話員工會直接寄信抱怨，而不是用系統回報。
 * 📌 version 建議每次有明顯改版就 +1，日後有人回報問題時
 *    可以先問他看到的版本號，很好排查。
 */
const SYSTEM_INFO = {
  version:    'v1.0',
  year:       '2026',
  maintainer: '',   // 維護單位，例如：'HR Department'
  contact:    '',   // 聯絡方式，例如：'Ext. 1234'
};
