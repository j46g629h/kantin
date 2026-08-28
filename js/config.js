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
  version: 'v3.6',
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
 * 依「現在幾點」自動預選餐別。
 *
 * 📌 餐廳提供的**實際供餐時段**（2026-08-25 確認）：
 *
 *      早餐  05:00 – 06:00
 *      午餐  11:15 – 12:30
 *      晚餐  17:00 – 18:30
 *
 * ⚠️ **下面的區間刻意比供餐時段寬很多，這不是抄錯。**
 *
 *    供餐時段是「什麼時候有飯吃」，但這裡要判斷的是
 *    「他現在打開表單，想講的是哪一餐」——那是兩件不同的事。
 *
 *    午餐只供應 11:15–12:30 共 75 分鐘。如果照抄，
 *    一個 13:00 吃完回到線上才想到要回報的人就**完全沒有預選**，
 *    三餐加起來一天只有 3 小時 45 分鐘有作用，這個功能等於不存在。
 *
 *    所以每一段都**從供餐前 30 分鐘開始**（排隊的時候就會遇到問題了），
 *    一路延續到下一段開始為止：
 *
 *      04:30 – 10:45  早餐
 *      10:45 – 16:30  午餐
 *      16:30 – 23:00  晚餐
 *      23:00 – 04:30  不預選
 *
 * ⚠️ 預選只是省一個動作，**員工隨時可以自己改**——
 *    有人會在下午才來反映早餐的問題，不能直接用時間決定。
 *
 * ⚠️ 判斷用的是**員工手機自己的時鐘**，不是伺服器時間。
 *    對印尼的員工來說這是對的（他們的手機就是 WIB），
 *    但在台灣那台電腦測試時會**快一個小時**——
 *    台灣 17:00 其實是雅加達 16:00，畫面會預選晚餐而員工看到的是午餐。
 *    測邊界的時候記得這件事，不要以為程式壞了。
 *
 * 📌 供餐時間改了要動的只有下面三行。格式是 24 小時制的 'HH:MM'，
 *    寫錯格式的那一段會直接失效（不預選），不會亂猜。
 */
const MEAL_TIME_RANGES = [
  { code: 'MEAL_BREAKFAST', from: '04:30', to: '10:45' },
  { code: 'MEAL_LUNCH',     from: '10:45', to: '16:30' },
  { code: 'MEAL_DINNER',    from: '16:30', to: '23:00' },
];


/**
 * 'HH:MM' 轉成「從午夜起算的分鐘數」。
 * 格式不對回傳 NaN——NaN 拿去比大小一律是 false，
 * 那一段就自動失效。**寧可不預選，也不要選錯的那一餐。**
 */
function mealTimeToMinutes(hhmm) {
  const parts = String(hhmm).split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);

  if (!Number.isInteger(h) || !Number.isInteger(m)) return NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;

  return h * 60 + m;
}


/**
 * 這個時間點該預選哪一餐？回傳餐別代碼，沒有對應的區間就回傳空字串。
 * @param {Date} now
 */
function mealCodeAt(now) {
  const minutes = now.getHours() * 60 + now.getMinutes();

  const hit = MEAL_TIME_RANGES.find(function (range) {
    return minutes >= mealTimeToMinutes(range.from)
        && minutes <  mealTimeToMinutes(range.to);
  });

  return hit ? hit.code : '';
}
