/**
 * 檢查版本號與系統資訊有沒有漏改（CLAUDE.md 設計約定第 5 條）
 *
 * 這一支不測邏輯，只測「同一份資料抄在好幾個地方，有沒有走鐘」。
 *
 *
 * 📌 為什麼需要它：
 *
 *    改前端檔案時，資源版本號 `?v=` 要在 **7 個 HTML 檔**一起往上加，
 *    還要同步改 `js/config.js` 的 SYSTEM_INFO.version。
 *    關卡 4-3 之後又多了一個地方——`gas/Config.js` 的 SYSTEM_INFO
 *    （信件頁尾要顯示版本，而 Apps Script 讀不到前端檔案，只能複製一份）。
 *
 *    九個地方靠人記得改，遲早會漏。而漏掉的後果不會當場報錯：
 *
 *      - 漏改某個 HTML 的 `?v=` → 那一頁繼續吃 10 分鐘的舊快取，
 *        後端已經更新而前端還是舊的，畫面會用「錯誤的方式」壞掉
 *      - 漏改 gas/Config.js  → **信裡印出錯的版本號**，
 *        有人拿著它來回報問題，你會去查錯的那一版。
 *        這比不印版本號還糟
 *
 *    這支測試把「漏改」從三個月後才發現，提前到當下就紅掉。
 *
 * 執行：node tools/test-version-sync.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** 七個引用 CSS / JS 的頁面，全部都要帶同一個 `?v=` */
const HTML_FILES = [
  'index.html', 'report.html', 'query.html',
  'admin.html', 'admin-cases.html', 'admin-accounts.html', 'admin-dashboard.html',
];

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');


// ---- 測試工具 ----
let pass = 0, failCount = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  OK   ${label}`); }
  else { failCount++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
}


console.log('\n===== 七個 HTML 的資源版本號 =====\n');

// 每個檔案把自己出現過的 ?v= 收集起來，同一檔案內也不可以有兩種
const perFile = {};
const allVersions = new Set();

HTML_FILES.forEach((file) => {
  const found = new Set();
  const source = read(file);
  const re = /\?v=([0-9.]+)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    found.add(m[1]);
    allVersions.add(m[1]);
  }
  perFile[file] = [...found];
});

HTML_FILES.forEach((file) => {
  check(`${file} 有帶版本號`, perFile[file].length > 0, true);
  // 同一個檔案裡 CSS 帶 2.7、JS 帶 2.6 的話，只有其中一個會更新
  check(`${file} 內只有一種版本號`, perFile[file].length <= 1, true);
});

check('七個檔案的版本號一致', [...allVersions].sort(), [...allVersions].slice(0, 1));

const assetVersion = [...allVersions][0];
console.log(`\n  （目前的資源版本號：${assetVersion}）\n`);


console.log('\n===== js/config.js 與 gas/Config.js =====\n');

/**
 * 從檔案裡挖出 SYSTEM_INFO 的欄位。
 *
 * 用正規表示式而不是 require()：兩個檔案都是給瀏覽器 / Apps Script 用的，
 * 沒有 module.exports，直接 require 會拿不到東西。
 */
function readSystemInfo(file) {
  const source = read(file);
  const block  = source.match(/const SYSTEM_INFO = \{[\s\S]*?\n\};/);

  if (!block) return null;

  const pick = (key) => {
    // ⚠️ 這裡刻意不用 反斜線-s：欄位是對齊過的（`version:    'v2.7'`），
    //    用明確的空白字元類別就夠了，也不必擔心跳脫字元被吃掉
    const m = block[0].match(new RegExp(key + "[ ]*:[ ]*'([^']*)'"));
    return m ? m[1] : null;
  };

  return {
    version:    pick('version'),
    year:       pick('year'),
    // maintainer 是巢狀的 { zh, id }，兩個 key 在整段裡都是唯一的
    zh:         pick('zh'),
    id:         pick('id'),
    contact:    pick('contact'),
  };
}

const front = readSystemInfo('js/config.js');
const back  = readSystemInfo('gas/Config.js');

check('js/config.js 找得到 SYSTEM_INFO',  front !== null, true);
check('gas/Config.js 找得到 SYSTEM_INFO', back !== null, true);

if (front && back) {
  /**
   * ⚠️ 先確認真的讀得出東西來。
   *
   *    少了這兩行的話，只要哪天欄位改了寫法讓正規表示式失效，
   *    兩邊就會同時讀成 null——而 null === null 是相等的，
   *    測試會全部通過，但它其實什麼都沒有比對到。
   *    「永遠會過的測試」比沒有測試更危險。
   */
  check('版本號真的讀得出來（前端）', typeof front.version === 'string' && !!front.version, true);
  check('版本號真的讀得出來（後端）', typeof back.version === 'string' && !!back.version, true);

  // 這一項最重要：信件頁尾印的版本號必須就是 app 頁尾印的那一個
  check('版本號：前後端一致',   back.version, front.version);
  check('年份：前後端一致',     back.year,    front.year);
  check('維護單位（中）：一致', back.zh,      front.zh);
  check('維護單位（印）：一致', back.id,      front.id);
  check('聯絡方式：一致',       back.contact, front.contact);

  // 前端頁尾顯示的版本，必須也是 HTML 實際載入的那一版資源。
  // 對不上的話，使用者回報「我看到 v2.8」但他手上跑的其實是 v2.7 的 JS
  check('js/config.js 的版本號 = HTML 的 ?v=',
    front.version, 'v' + assetVersion);
}


console.log(`\n===== 通過 ${pass} 項，失敗 ${failCount} 項 =====\n`);
process.exit(failCount > 0 ? 1 : 0);
