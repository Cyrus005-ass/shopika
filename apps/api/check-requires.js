const fs = require('fs'), path = require('path');
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(c?js)$/.test(e.name) ? [path.join(d, e.name)] : []) : [];
let bad = 0;
for (const f of [...walk('src'), ...walk('scripts'), ...walk('api')]) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]*)['"]\s*\)/g)) {
    const p = path.resolve(path.dirname(f), m[1]);
    const ok = [p, p + '.js', p + '.json', p + '.cjs', path.join(p, 'index.js')].some((x) => fs.existsSync(x));
    if (!ok) { bad++; console.log(f, '->', m[1]); }
  }
}
console.log(bad ? bad + ' chemin(s) cassé(s)' : 'Tous les chemins relatifs sont valides');
