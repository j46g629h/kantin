// 本機測試 gas/Store.js：存取、過期、清除、清掃
const fs = require('fs');
const vm = require('vm');

const props = {};
const sandbox = {
  console,
  Logger: { log: () => {} },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: (k) => { delete props[k]; },
      getProperties: () => Object.assign({}, props),
    }),
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('D:/Claude/KANTIN/gas/Store.js', 'utf8'), sandbox);

const run = (code) => vm.runInContext(code, sandbox);

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  OK   ' + label); }
  else { fail++; console.log(`  FAIL ${label}\n         預期 ${e}\n         實際 ${a}`); }
};

console.log('\n【1】基本存取');
run("storePut('k1', 'hello', 600)");
check('讀得回來', run("storeGet('k1')"), 'hello');
check('不存在的鍵回 null', run("storeGet('nope')"), null);

console.log('\n【2】存 JSON 字串（token 就是這樣存的）');
run("storePut('tok', JSON.stringify({account:'a@b', role:'SUPER'}), 600)");
check('內容完整', JSON.parse(run("storeGet('tok')")).role, 'SUPER');

console.log('\n【3】過期');
run("storePut('soon', 'x', -1)");           // 已經過期
check('過期的讀不到', run("storeGet('soon')"), null);
check('過期的順手被刪掉', 'soon' in props, false);

console.log('\n【4】刪除');
run("storeRemove('k1')");
check('刪掉後讀不到', run("storeGet('k1')"), null);
check('刪不存在的鍵不會出錯', run("storeRemove('nope'); 'ok'"), 'ok');

console.log('\n【5】格式壞掉時不要一直失敗');
props['broken'] = 'not-json';
check('壞掉的當作沒有', run("storeGet('broken')"), null);
check('並且清掉，不會每次都失敗', 'broken' in props, false);

console.log('\n【6】清掃過期資料');
run("storePut('live1','a',600); storePut('live2','b',600)");
run("storePut('dead1','c',-1); storePut('dead2','d',-1)");
props['other'] = 'someone-elses-data';      // 不是這個格式存的，不可以動
check('清掉 2 筆', run('storeSweepExpired()'), 2);
check('沒過期的還在', [run("storeGet('live1')"), run("storeGet('live2')")], ['a', 'b']);
check('別人的資料不受影響', props['other'], 'someone-elses-data');

console.log(`\n===== 通過 ${pass} 項，失敗 ${fail} 項 =====\n`);
process.exit(fail ? 1 : 0);
