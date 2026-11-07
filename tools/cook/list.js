// Lists every baked model for the game: node tools/cook/list.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '../..');
const dir = path.join(root, 'assets/cooked');
const list = {};
let hi = 0, lo = 0;
if (fs.existsSync(dir)) {
  fs.readdirSync(dir).filter((f) => f.endsWith('.hi.bin')).sort().forEach((f) => {
    const key = f.slice(0, -7);
    const a = fs.readFileSync(path.join(dir, f));
    const b = fs.readFileSync(path.join(dir, key + '.lo.bin'));
    hi += a.length; lo += b.length;
    list[key] = crypto.createHash('md5').update(a).update(b).digest('hex').slice(0, 8);
  });
}
fs.writeFileSync(path.join(root, 'js/cooked-list.js'), '// Written by tools/cook/list.js: every baked model, with a stamp that changes when it does.\nOA.COOKED = ' + JSON.stringify(list, null, 1) + ';\n');
console.log(Object.keys(list).length, 'models,', (hi / 1048576).toFixed(1), 'MB high,', (lo / 1048576).toFixed(1), 'MB low');
