/**
 * 本機測試員工名冊檢查報告（gas/Setup.js 的 checkEmployeeRoster）
 *
 * 📌 為什麼這支報告值得測：
 *
 *    它是匯入名冊之後**唯一**的驗證工具。使用者不會自己去比對 562 筆工號，
 *    他就是看這份報告決定「可以用了」還是「要重貼」。
 *
 *    所以報告**講錯話的代價很高**：
 *      · 資料明明好好的卻叫人重貼 → 重貼本身才是真正的風險
 *      · 資料壞了卻說「沒有發現問題」→ 那幾個人掃碼會看到「查無此工號」，
 *        而且**沒有人會知道**，因為他們不會回報，只會不再使用
 *
 * ⚠️ 這支還盯著一件事：**報告裡不可以出現任何工號或姓名。**
 *    執行紀錄會留在 Google 帳號裡，而名冊是個資。
 *
 * 執行：node tools/test-roster-check.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');

const HEADERS = ['工號', '姓名', '狀態'];

const sandbox = {
  console,
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  Logger: { log: () => {} },
  SpreadsheetApp: {
    openById: () => ({
      getName: () => 'fake',
      getSheetByName: (name) => (name === '員工名冊' ? makeSheet() : null),
    }),
  },
  /** 記錄被清掉的快取鍵，順便驗證「新名冊立即生效」那一步真的有跑到 */
  storeRemove: (key) => { sandbox.__REMOVED__.push(key); },
  __ROWS: [], __FORMATS: [], __REMOVED__: [],
};

function makeSheet() {
  const rows = sandbox.__ROWS;
  return {
    getLastRow: () => rows.length + 1,
    getLastColumn: () => HEADERS.length,
    getRange(r, col, numRows, numCols) {
      const n = numRows || 1;
      if (!r || !col) throw new Error('getRange 收到不合法的位置');
      return {
        getValues: () => (r === 1 ? [HEADERS]
          : rows.slice(r - 2, r - 2 + n).map(x => x.slice(col - 1, col - 1 + (numCols || HEADERS.length)))),
        getNumberFormats: () => sandbox.__FORMATS.slice(r - 2, r - 2 + n).map(f => [f]),
      };
    },
  };
}

vm.createContext(sandbox);
['Config.js', 'Utils.js', 'Setup.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas', f), 'utf8'), sandbox, { filename: f });
});
const run = (code) => vm.runInContext(code, sandbox);

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n         預期 ' + e + '\n         實際 ' + a); }
};

/** 擺好名冊。format 給 '@' 代表純文字，'0' 代表自動（數值） */
function setRoster(rows, format) {
  sandbox.__ROWS = rows;
  sandbox.__FORMATS = rows.map(() => format || '@');
  sandbox.__REMOVED__ = [];
}

const report = () => run('checkEmployeeRoster()');


console.log('\n【1】一切正常：不可以出現任何 ⚠️');
setRoster([['0012345', 'Budi', 'ACTIVE'], ['0012346', 'Siti', 'ACTIVE']], '@');
let r = report();
check('總筆數對',     r.indexOf('總筆數：2 筆') >= 0, true);
check('說資料沒問題', r.indexOf('✅ 資料沒有問題') >= 0, true);
check('沒有建議',     r.indexOf('另有') < 0, true);
check('沒有任何 ⚠️',  r.indexOf('⚠️') < 0, true);

/**
 * 🔴 Google Sheets 的純文字格式有**兩種寫法**，兩種都要認得：
 *
 *    '@'         程式用 setNumberFormat('@') 設的
 *    '@STRING@'  **使用者從介面**〔格式 → 數值 → 純文字〕設的
 *
 * 2026-08-31 實際踩過：使用者照建議把 A 欄設成純文字了，
 * 報告卻還是說「1213 個格式不是純文字」——因為程式只認 '@'。
 *
 * ⚠️ 這種 bug 比看起來嚴重：**一個永遠喊「有問題」的檢查，
 *    會訓練看報告的人跳過那一行**，等哪天真的有問題他也不會看見。
 */
console.log('\n【1-b】介面設的純文字（@STRING@）也要算數');
setRoster([['0012345', 'Budi', 'ACTIVE'], ['0012346', 'Siti', 'ACTIVE']], '@STRING@');
r = report();
check('@STRING@ 視為純文字',   r.indexOf('格式不是「純文字」的儲存格：0 個') >= 0, true);
check('不會叫人再去設一次',     r.indexOf('建議把 A 欄設成') < 0, true);
check('結論沒有多餘的建議',     r.indexOf('另有') < 0, true);

// 大小寫不同也要認得（介面語言或版本不同時可能有差異）
setRoster([['0012345', 'Budi', 'ACTIVE']], '@string@');
check('小寫 @string@ 也算數',
  report().indexOf('格式不是「純文字」的儲存格：0 個') >= 0, true);

console.log('\n【2】⚠️ 格式不是純文字、但值還是文字 → 不可以叫人重貼');
setRoster([['0012345', 'Budi', 'ACTIVE'], ['0012346', 'Siti', 'ACTIVE']], '0');
r = report();
check('明說資料沒有壞',   r.indexOf('資料沒有壞，不需要重貼') >= 0, true);
check('⚠️ 沒有出現「重貼」的指示', /先把 A 欄設成.*再重貼/.test(r), false);
check('有建議設成純文字', r.indexOf('格式 → 數值 → 純文字') >= 0, true);
check('結論仍然是資料沒問題', r.indexOf('✅ 資料沒有問題') >= 0, true);
check('但有列出建議',     r.indexOf('另有 1 項建議') >= 0, true);
// 光看「N 個沒設純文字」查不出「到底是哪個字串沒被認得」——2026-08-31 就卡在這裡
check('印出實際讀到的格式字串', r.indexOf('實際讀到的格式字串：「0」') >= 0, true);

console.log('\n【3】值真的被存成數字 → 這時才要說「重貼」');
setRoster([[12345, 'Budi', 'ACTIVE'], ['0012346', 'Siti', 'ACTIVE']], '0');
r = report();
check('說前導零已經消失', r.indexOf('前導零已經消失，這幾筆要重貼') >= 0, true);
check('說明格式就是原因', r.indexOf('這就是上面那些值變成數字的原因') >= 0, true);
check('⚠️ 結論改成有資料問題', r.indexOf('處**資料問題**') >= 0, true);
check('不會再說「不需要重貼」', r.indexOf('不需要重貼') < 0, true);

console.log('\n【4】工號長度不一致：要指出是第幾列（這是使用者實際遇到的情況）');
setRoster([
  ['001234', 'A', 'ACTIVE'], ['001235', 'B', 'ACTIVE'], ['001236', 'C', 'ACTIVE'],
  ['0012370', 'D', 'ACTIVE'],                                   // 第 5 列，7 碼
  ['001238', 'E', 'ACTIVE'], ['0012390', 'F', 'ACTIVE'],        // 第 7 列，7 碼
], '@');
r = report();
check('有長度分布',       r.indexOf('6 碼 × 4 筆、7 碼 × 2 筆') >= 0, true);
check('⚠️ 指出少數那幾筆在第幾列', r.indexOf('7 碼的在第 5, 7 列') >= 0, true);
check('沒有把多數那幾筆也列出來', r.indexOf('6 碼的在第') < 0, true);
check('有提醒不一定是錯的', r.indexOf('不一定是錯的') >= 0, true);

console.log('\n【5】只有一種長度時不要多嘴');
setRoster([['001234', 'A', 'ACTIVE'], ['001235', 'B', 'ACTIVE']], '@');
r = report();
check('不出現列號提示', r.indexOf('碼的在第') < 0, true);

console.log('\n【6】真的有資料問題時要抓出來');
setRoster([
  ['0012345', 'Budi', 'ACTIVE'],
  ['0012345', 'Duplikat', 'ACTIVE'],   // 重複
  ['',        'NoId',  'ACTIVE'],      // 工號空白
  ['0012348', '',      'ACTIVE'],      // 姓名空白
  [' 0012349', 'Spaced', 'ACTIVE'],    // 前後有空白
], '@');
r = report();
check('抓到重複',       r.indexOf('工號重複：1 筆') >= 0, true);
check('抓到工號空白',   r.indexOf('工號空白：1 筆') >= 0, true);
check('抓到姓名空白',   r.indexOf('姓名空白：1 筆') >= 0, true);
check('抓到前後空白',   r.indexOf('工號前後有空白字元：1 筆') >= 0, true);
check('結論說有資料問題', r.indexOf('處**資料問題**') >= 0, true);

console.log('\n【7】狀態欄');
setRoster([
  ['001234', 'A', 'ACTIVE'], ['001235', 'B', ''], ['001236', 'C', 'INACTIVE'], ['001237', 'D', '亂寫'],
], '@');
r = report();
check('ACTIVE 1 筆',   r.indexOf('ACTIVE：1 筆') >= 0, true);
check('INACTIVE 1 筆', r.indexOf('INACTIVE（停用）：1 筆') >= 0, true);
check('空白 1 筆',     r.indexOf('空白：1 筆') >= 0, true);
check('抓到無法辨識',  r.indexOf('無法辨識的狀態：1 筆') >= 0, true);

console.log('\n【8】⚠️ 報告裡絕對不可以出現工號或姓名（執行紀錄會留在 Google 帳號裡）');
setRoster([
  ['0099887', 'Budi Santoso', 'ACTIVE'],
  [7766554,   'Siti Rahayu',  ''],
  ['009988X', 'Ahmad Fauzi',  '亂寫'],
], '0');
r = report();
check('沒有印出工號 0099887', r.indexOf('0099887') < 0, true);
check('沒有印出工號 7766554', r.indexOf('7766554') < 0, true);
check('沒有印出工號 009988X', r.indexOf('009988X') < 0, true);
check('沒有印出姓名',         /Budi|Siti|Ahmad/.test(r), false);

console.log('\n【9】跑完要清掉工號快取（新名冊才會立刻生效）');
setRoster([['0012345', 'Budi', 'ACTIVE'], ['0012346', 'Siti', 'ACTIVE']], '@');
report();
check('清了 2 個鍵', sandbox.__REMOVED__, ['emp:0012345', 'emp:0012346']);
check('報告有說',    r.length > 0, true);

console.log('\n【10】空名冊不會出錯');
setRoster([], '@');
let err = '';
try { r = report(); } catch (e) { err = e.message; }
check('不丟例外',   err, '');
check('說名冊是空的', r.indexOf('名冊是空的') >= 0, true);

console.log('\n===== 通過 ' + pass + ' 項，失敗 ' + fail + ' 項 =====\n');
process.exit(fail ? 1 : 0);
