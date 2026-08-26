const fs = require('fs');
let s = fs.readFileSync('tools/test-cleanup-api.js', 'utf8');
const a = `// Retention.js 只借 imageFileIds / extractDriveFileId 兩支
const RET = fs.readFileSync(path.join(ROOT, 'gas', 'Retention.js'), 'utf8');
vm.runInContext(RET.match(/function imageFileIds[\s\S]*?\n}/)[0], sandbox);`;
const b = `// 只搬用得到的兩支過來：整個檔案載入會需要一堆這裡沒有的服務
const RET = fs.readFileSync(path.join(ROOT, 'gas', 'Retention.js'), 'utf8');
const QRY = fs.readFileSync(path.join(ROOT, 'gas', 'Query.js'), 'utf8');
vm.runInContext(QRY.match(/function extractDriveFileId[\s\S]*?\n}/)[0], sandbox);
vm.runInContext(RET.match(/function imageFileIds[\s\S]*?\n}/)[0], sandbox);`;
if (!s.includes(a)) { console.error('找不到'); process.exit(1); }
s = s.replace(a, b);
fs.writeFileSync('tools/test-cleanup-api.js', s);
console.log('已補上 extractDriveFileId');
