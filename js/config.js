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
 * 顯示順序：維護單位 → 聯絡分機 → 系統版本
 * 留空的欄位不會顯示。
 *
 * 📌 version 建議每次有明顯改版就 +1，日後有人回報問題時
 *    可以先問他看到的版本號，很好排查。
 */
const SYSTEM_INFO = {
  version: 'v1.0',
  year:    '2026',

  // 維護單位（依介面語言顯示對應版本）
  maintainer: {
    zh: 'PCI 總工務',
    // ⚠️ 待補：印尼籍員工看中文會看不懂該找誰。
    //    建議填印尼文或英文寫法，例如 'Teknik Umum PCI' 或 'PCI General Affairs'。
    //    在補上之前先沿用中文，不影響系統運作。
    id: 'PCI 總工務',
  },

  // 聯絡分機（數字不需要翻譯）
  contact: '3690',
};


/**
 * 問題分類最多可選幾項。
 * 前端與後端都會用到這個數字，改這裡兩邊會一起生效。
 */
const MAX_CATEGORIES = 2;
