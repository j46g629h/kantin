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
  version: 'v1.6',
  year:    '2026',

  // 維護單位（依介面語言顯示對應版本）
  maintainer: {
    zh: 'PCI 總工務',
    id: 'PCI GA',
  },

  // 聯絡分機（數字不需要翻譯）
  contact: '3690',
};


/**
 * 問題分類最多可選幾項。
 * 後端 gas/Config.js 也有同一個常數，兩邊要保持一致。
 */
const MAX_CATEGORIES = 2;


/**
 * 照片設定。
 * 手機照片一張 3～8 MB，壓成長邊 1600px / JPEG 0.8 後約 200～400 KB。
 */
const IMAGE_MAX_COUNT = 2;      // 一筆回報最多幾張照片
const IMAGE_MAX_EDGE  = 1600;   // 壓縮後長邊最大像素
const IMAGE_QUALITY   = 0.8;    // JPEG 品質（0～1）


/**
 * 各餐供應時段，用來在表單自動預選「餐別」。
 *
 * from 含、to 不含（例如 5～10 表示 05:00～09:59 算早餐）。
 * 提交時間不在任何區間內時就不預選，讓員工自己挑。
 *
 * ⚠️ 這裡是暫定值，請依實際供餐時間調整。
 */
const MEAL_TIME_RANGES = [
  { code: 'MEAL_BREAKFAST', from: 5,  to: 10 },
  { code: 'MEAL_LUNCH',     from: 10, to: 15 },
  { code: 'MEAL_DINNER',    from: 15, to: 22 },
];
