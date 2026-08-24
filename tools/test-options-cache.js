/**
 * 本機測試 js/api.js 的兩份前端快取（載入速度優化，5-5）
 *
 *   選項快取：localStorage +「先給舊的、背景抓新的」
 *   工號快取：只留最後一位、只留成功的
 *
 * 📌 為什麼需要它：
 *
 *    快取壞掉的樣子**不是跳錯誤訊息**，而是「功能還是對的，只是每次都要等」——
 *    這個專案已經在後端踩過一模一樣的坑：CacheService 壞了兩個月沒人發現
 *    （CLAUDE.md 設計約定第 13 條）。前端這兩份快取如果哪天失效，
 *    使用者只會覺得「這個 app 就是很慢」，沒有人會回報。
 *
 *    另一半的風險相反：快取**太黏**。管理者新增了一個餐廳，
 *    員工卻永遠看不到；或是員工離職了，畫面上還打勾顯示他的名字。
 *    所以測試要同時盯住兩件事——該用舊的時候有沒有用，
 *    以及該去拿新的時候有沒有去拿。
 *
 * 執行：node tools/test-options-cache.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');


// ===== 假的瀏覽器環境 =====

/** 假 localStorage。failWrite 打開時模擬無痕視窗 / 空間滿了 */
const store = {};
let failWrite = false;

const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    if (failWrite) throw new Error('QuotaExceededError');
    store[k] = String(v);
  },
  removeItem: (k) => { delete store[k]; },
};

/** 假後端。nextResponse 決定下一次回什麼，calls 記錄打了幾次 */
let calls = 0;
let nextResponse = null;
let networkDown = false;

function fetchStub() {
  calls++;
  if (networkDown) return Promise.reject(new Error('offline'));
  const body = nextResponse;
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

const sandbox = {
  console,
  localStorage,
  fetch: fetchStub,
  URLSearchParams,
  crypto: { randomUUID: () => 'uuid-test' },
  API_URL: 'https://example.test/exec',
  // 真正的 t() 在 js/i18n.js，這裡只需要它「有回傳東西」
  t: (key) => key,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'api.js'), 'utf8'), sandbox);

const run = (code) => vm.runInContext(code, sandbox);


// ===== 測試工具 =====

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n         預期 ' + e + '\n         實際 ' + a); }
};

/** 讓所有已經排好的 microtask 跑完（等背景更新真的做完） */
async function flush() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
}

const OPTIONS_KEY = 'kantin_options_v3';
const EMP_KEY     = 'kantin_emp_v1';

/** 一份合法的選項資料，label 用來分辨「新的」還是「舊的」 */
function optionsData(label) {
  return {
    LOCATION: [{ code: 'LOC_01',       name_id: label, name_zh: label }],
    MEAL:     [{ code: 'MEAL_LUNCH',   name_id: label, name_zh: label }],
    CATEGORY: [{ code: 'CAT_HYGIENE',  name_id: label, name_zh: label }],
    STATUS:   [{ code: 'ST_NEW',       name_id: label, name_zh: label }],
  };
}

/** 直接把一份「幾毫秒前存的」快取塞進 localStorage */
function seedOptionsCache(label, ageMs) {
  store[OPTIONS_KEY] = JSON.stringify({ at: Date.now() - ageMs, data: optionsData(label) });
}

/** 每個情境開始前把環境清乾淨 */
function reset() {
  Object.keys(store).forEach((k) => delete store[k]);
  calls = 0;
  failWrite = false;
  networkDown = false;
  nextResponse = { ok: true, data: optionsData('新的') };
}

const MINUTE = 60 * 1000;
const HOUR   = 60 * MINUTE;
const DAY    = 24 * HOUR;

/** 讀出快取裡那份資料的 label，用來確認背景更新有沒有真的寫進去 */
const cachedLabel = () => JSON.parse(store[OPTIONS_KEY]).data.LOCATION[0].name_id;


async function main() {

  console.log('\n【1】沒有快取時：要真的去拿');
  reset();
  let data = await run('loadOptions()');
  check('拿到後端的資料', data.LOCATION[0].name_id, '新的');
  check('打了一次 API', calls, 1);
  check('寫進 localStorage', cachedLabel(), '新的');

  console.log('\n【2】快取很新（10 分鐘前）：完全不打 API');
  reset();
  seedOptionsCache('舊的', 10 * MINUTE);
  data = await run('loadOptions()');
  check('直接拿快取', data.LOCATION[0].name_id, '舊的');
  check('一次 API 都沒打', calls, 0);

  console.log('\n【3】快取有點舊（2 小時前）：先給舊的，同時在背景抓新的');
  reset();
  seedOptionsCache('舊的', 2 * HOUR);
  data = await run('loadOptions()');
  check('使用者立刻拿到舊的（不用等）', data.LOCATION[0].name_id, '舊的');
  check('但背景有去抓', calls, 1);
  await flush();
  check('抓回來就換掉快取，下次進來是新的', cachedLabel(), '新的');

  console.log('\n【4】快取太舊（8 天前）：不敢再拿舊的頂著，等新的');
  reset();
  seedOptionsCache('舊的', 8 * DAY);
  data = await run('loadOptions()');
  check('回傳的是新抓的', data.LOCATION[0].name_id, '新的');
  check('打了一次 API', calls, 1);

  console.log('\n【5】快取內容不完整：當作沒有（這是最重要的一道防護）');
  reset();
  const partial = optionsData('舊的');
  delete partial.CATEGORY;                       // 少了一種必要類型
  store[OPTIONS_KEY] = JSON.stringify({ at: Date.now(), data: partial });
  data = await run('loadOptions()');
  check('重新抓一次', calls, 1);
  check('拿到的是完整的', Object.keys(data).sort(), ['CATEGORY', 'LOCATION', 'MEAL', 'STATUS']);

  console.log('\n【6】快取有類型但是空陣列：一樣當作沒有');
  reset();
  const empty = optionsData('舊的');
  empty.LOCATION = [];                            // 有這個 key，但一個選項都沒有
  store[OPTIONS_KEY] = JSON.stringify({ at: Date.now(), data: empty });
  await run('loadOptions()');
  check('重新抓一次', calls, 1);

  console.log('\n【7】快取格式壞掉：不要整頁掛掉，重抓就好');
  reset();
  store[OPTIONS_KEY] = 'not-json';
  data = await run('loadOptions()');
  check('照樣拿得到資料', data.LOCATION[0].name_id, '新的');
  check('重新抓一次', calls, 1);

  console.log('\n【8】裝置時鐘被往回調：不可以當成「很新」而永遠不更新');
  reset();
  seedOptionsCache('舊的', -3 * DAY);              // at 在未來
  await run('loadOptions()');
  check('當作沒有快取，重抓', calls, 1);

  console.log('\n【9】後端說失敗：丟例外，而且不可以把壞資料寫進快取');
  reset();
  nextResponse = { ok: false, error: 'SERVER_ERROR' };
  let err = '';
  try { await run('loadOptions()'); } catch (e) { err = e.message; }
  check('有丟例外', err.length > 0, true);
  check('快取沒有被寫壞', OPTIONS_KEY in store, false);

  console.log('\n【10】後端回的資料不完整：一樣擋下來，不要寫進快取');
  reset();
  const badPayload = optionsData('新的');
  delete badPayload.MEAL;
  nextResponse = { ok: true, data: badPayload };
  err = '';
  try { await run('loadOptions()'); } catch (e) { err = e.message; }
  check('有丟例外', err.indexOf('不完整') >= 0, true);
  check('快取沒有被寫壞', OPTIONS_KEY in store, false);

  console.log('\n【11】失敗之後要能重試（in-flight 有放掉）');
  reset();
  nextResponse = { ok: false, error: 'SERVER_ERROR' };
  try { await run('loadOptions()'); } catch (e) { /* 預期會失敗 */ }
  nextResponse = { ok: true, data: optionsData('新的') };
  data = await run('loadOptions()');
  check('第二次成功', data.LOCATION[0].name_id, '新的');
  check('兩次都真的打了 API', calls, 2);

  console.log('\n【12】同一頁同時要兩次：只准打一次 API');
  reset();
  const both = await run('Promise.all([loadOptions(), loadOptions()])');
  check('兩邊都拿到資料', both.map((d) => d.LOCATION[0].name_id), ['新的', '新的']);
  check('只打了一次', calls, 1);

  console.log('\n【13】localStorage 寫不進去（無痕視窗）：功能照樣要對');
  reset();
  failWrite = true;
  data = await run('loadOptions()');
  check('照樣拿得到資料', data.LOCATION[0].name_id, '新的');
  check('只是沒存起來', OPTIONS_KEY in store, false);

  console.log('\n【14】prefetchOptions()：預抓失敗絕對不可以影響首頁');
  reset();
  networkDown = true;
  check('呼叫本身不丟例外', run('prefetchOptions(); "ok"'), 'ok');
  await flush();
  check('去抓了', calls, 1);

  reset();
  seedOptionsCache('舊的', 10 * MINUTE);
  run('prefetchOptions()');
  await flush();
  check('快取還新就不浪費一次 API', calls, 0);

  // ===== 工號快取 =====

  console.log('\n【15】工號快取：存得進、讀得回');
  reset();
  run("writeEmployeeCache('A1234', { emp_id: 'A1234', emp_name: 'Budi' })");
  check('讀得回來', run("readEmployeeCache('A1234')"), { emp_id: 'A1234', emp_name: 'Budi' });

  console.log('\n【16】換一個工號：不可以拿到別人的名字');
  check('讀不到', run("readEmployeeCache('B9999')"), null);

  console.log('\n【17】只留最後一位（借手機給同事用的情況）');
  run("writeEmployeeCache('B9999', { emp_id: 'B9999', emp_name: 'Siti' })");
  check('新的讀得到', run("readEmployeeCache('B9999')").emp_name, 'Siti');
  check('前一位已經不在裝置上', run("readEmployeeCache('A1234')"), null);

  console.log('\n【18】超過 30 天就不再用');
  reset();
  store[EMP_KEY] = JSON.stringify({
    at: Date.now() - 31 * DAY, key: 'A1234', data: { emp_id: 'A1234', emp_name: 'Budi' },
  });
  check('太舊的當作沒有', run("readEmployeeCache('A1234')"), null);

  console.log('\n【19】時鐘往回調 / 格式壞掉：一律當作沒有');
  reset();
  store[EMP_KEY] = JSON.stringify({
    at: Date.now() + 3 * DAY, key: 'A1234', data: { emp_id: 'A1234', emp_name: 'Budi' },
  });
  check('at 在未來 → 不用', run("readEmployeeCache('A1234')"), null);
  store[EMP_KEY] = 'not-json';
  check('壞掉的 → 不用', run("readEmployeeCache('A1234')"), null);

  console.log('\n【20】不完整的資料不可以寫進去');
  reset();
  run('writeEmployeeCache("A1234", null)');
  check('null 不寫', EMP_KEY in store, false);
  run('writeEmployeeCache("A1234", { emp_name: "沒有工號" })');
  check('少了 emp_id 不寫', EMP_KEY in store, false);

  console.log('\n【21】寫不進去也不可以丟例外');
  reset();
  failWrite = true;
  check('安靜地失敗',
    run('writeEmployeeCache("A1234", { emp_id: "A1234", emp_name: "Budi" }); "ok"'), 'ok');

  console.log('\n===== 通過 ' + pass + ' 項，失敗 ' + fail + ' 項 =====\n');
  process.exit(fail ? 1 : 0);
}

main();
