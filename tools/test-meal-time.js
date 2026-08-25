/**
 * 本機測試「依現在幾點自動預選餐別」（js/config.js 的 mealCodeAt）
 *
 * 📌 為什麼這一支值得存在：
 *
 *    預選錯了**不會有任何錯誤訊息**。員工沒注意就送出，
 *    資料庫裡就多一筆「午餐」的案件，而他講的其實是早餐。
 *    等到有人看月報覺得「早餐怎麼都沒人反映」時，
 *    已經累積幾百筆分錯的資料，而且**分不出哪幾筆是錯的**。
 *
 *    這正是使用者當初被提醒「錯的預選比不預選更糟」的原因。
 *    所以這裡測的重點是**邊界**——差一分鐘就換一餐的那幾個點。
 *
 * 執行：node tools/test-meal-time.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'), sandbox);

const run = (code) => vm.runInContext(code, sandbox);

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n         預期 ' + e + '\n         實際 ' + a); }
};

/**
 * ⚠️ Date 必須在 sandbox **裡面**建立。
 *    在外面建立的話，sandbox 裡的 getHours 是另一個 realm 的方法，
 *    跨 realm 呼叫會出問題（CLAUDE.md 的測試注意事項也記過這一條）。
 */
function mealAt(hhmm) {
  const [h, m] = hhmm.split(':');
  return run(`mealCodeAt(new Date(2026, 7, 25, ${Number(h)}, ${Number(m)}))`);
}

const 早 = 'MEAL_BREAKFAST';
const 午 = 'MEAL_LUNCH';
const 晚 = 'MEAL_DINNER';
const 無 = '';


console.log('\n【1】實際供餐時間內（餐廳給的：早 05–06、午 11:15–12:30、晚 17–18:30）');
check('05:00 早餐開始',      mealAt('05:00'), 早);
check('05:30 正在吃早餐',    mealAt('05:30'), 早);
check('06:00 早餐剛結束',    mealAt('06:00'), 早);
check('11:15 午餐開始',      mealAt('11:15'), 午);
check('12:00 正在吃午餐',    mealAt('12:00'), 午);
check('12:30 午餐剛結束',    mealAt('12:30'), 午);
check('17:00 晚餐開始',      mealAt('17:00'), 晚);
check('18:30 晚餐剛結束',    mealAt('18:30'), 晚);

console.log('\n【2】供餐前 30 分鐘就開始算（排隊的時候就會遇到問題了）');
check('04:30 早餐區間的第一分鐘', mealAt('04:30'), 早);
check('10:45 午餐區間的第一分鐘', mealAt('10:45'), 午);
check('16:30 晚餐區間的第一分鐘', mealAt('16:30'), 晚);

console.log('\n【3】吃完之後才回報（這才是最常見的情況）');
check('09:00 早上回到線上才想到', mealAt('09:00'), 早);
check('13:30 午休結束後才回報',   mealAt('13:30'), 午);
check('15:00 下午想到午餐的事',   mealAt('15:00'), 午);
check('20:00 晚上才回報',         mealAt('20:00'), 晚);

console.log('\n【4】邊界：差一分鐘就換一餐（分錯的資料事後查不出來）');
check('10:44 還算早餐', mealAt('10:44'), 早);
check('10:45 換成午餐', mealAt('10:45'), 午);
check('16:29 還算午餐', mealAt('16:29'), 午);
check('16:30 換成晚餐', mealAt('16:30'), 晚);
check('22:59 還算晚餐', mealAt('22:59'), 晚);
check('23:00 不預選',   mealAt('23:00'), 無);
check('04:29 不預選',   mealAt('04:29'), 無);
check('04:30 換成早餐', mealAt('04:30'), 早);

console.log('\n【5】深夜不預選（寧可讓他自己選，也不要猜錯）');
check('00:00', mealAt('00:00'), 無);
check('02:30', mealAt('02:30'), 無);
check('23:30', mealAt('23:30'), 無);

console.log('\n【6】三段區間要接得起來，不可以有洞也不可以重疊');
const ranges = run('MEAL_TIME_RANGES');
const toMin = (t) => run(`mealTimeToMinutes('${t}')`);
check('第 1 段的結束 = 第 2 段的開始', toMin(ranges[0].to), toMin(ranges[1].from));
check('第 2 段的結束 = 第 3 段的開始', toMin(ranges[1].to), toMin(ranges[2].from));
check('每一段都是「開始 < 結束」',
  ranges.every((r) => toMin(r.from) < toMin(r.to)), true);

// 一天 1440 分鐘全部掃一次，確認沒有任何一分鐘落在兩段裡
let overlap = 0;
for (let m = 0; m < 1440; m++) {
  const hits = ranges.filter((r) => m >= toMin(r.from) && m < toMin(r.to));
  if (hits.length > 1) overlap++;
}
check('掃過一整天 1440 分鐘，沒有任何一分鐘同時屬於兩餐', overlap, 0);

console.log('\n【7】時間格式寫錯時：那一段失效，但不可以亂猜也不可以炸掉');
check("'25:00' 小時超過範圍", Number.isNaN(toMin('25:00')), true);
check("'12:60' 分鐘超過範圍", Number.isNaN(toMin('12:60')), true);
check("'abc' 根本不是時間",   Number.isNaN(toMin('abc')),   true);
check("'12' 少了分鐘",        Number.isNaN(toMin('12')),    true);
check("'-1:00' 負數",         Number.isNaN(toMin('-1:00')), true);
check("'05:00' 正常的",       toMin('05:00'), 300);
check("'00:00' 午夜",         toMin('00:00'), 0);
check("'23:59' 一天的最後一分鐘", toMin('23:59'), 1439);

// 把其中一段寫壞，確認只有那一段失效，其他照常
run(`MEAL_TIME_RANGES[1].from = '99:99'`);
check('寫壞午餐那一段 → 午餐時間不預選', mealAt('12:00'), 無);
check('寫壞午餐那一段 → 早餐照常',       mealAt('05:30'), 早);
check('寫壞午餐那一段 → 晚餐照常',       mealAt('18:00'), 晚);
run(`MEAL_TIME_RANGES[1].from = '10:45'`);   // 改回來
check('改回來之後午餐恢復正常',           mealAt('12:00'), 午);

console.log('\n===== 通過 ' + pass + ' 項，失敗 ' + fail + ' 項 =====\n');
process.exit(fail ? 1 : 0);
