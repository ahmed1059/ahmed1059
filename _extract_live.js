const fs = require('fs');
const src = fs.readFileSync('C:/Users/Toshiba/Desktop/School_Governance_System_1059/apps_script_cloud/_live.html', 'utf8');
const marker = 'goog.script.init("';
const a = src.indexOf(marker);
if (a < 0) {
  console.log('no init');
  process.exit(1);
}
const start = a + marker.length;
const end = src.lastIndexOf('");');
const raw = src.slice(start, end);
let bad = [];
for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if (c === '"' || c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029') {
    bad.push(i + ':' + JSON.stringify(raw.slice(Math.max(0, i - 20), i + 20)));
    if (bad.length > 12) break;
  }
}
console.log('bad', bad.join('\n'));
const decoded = raw.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\\//g, '/');
console.log('decodedStart', decoded.slice(0, 150));
console.log('decodedLen', decoded.length);
fs.writeFileSync('C:/Users/Toshiba/Desktop/School_Governance_System_1059/apps_script_cloud/_decoded.txt', decoded);
const html = obj.html || obj.userHtml || '';
console.log('htmlLen', html.length);
fs.writeFileSync('C:/Users/Toshiba/Desktop/School_Governance_System_1059/apps_script_cloud/_live_user.html', html);
const s = html.lastIndexOf('<script>');
const e = html.lastIndexOf('</script>');
console.log('script', s, e);
let js = html.slice(s + 8, e);
fs.writeFileSync('C:/Users/Toshiba/Desktop/School_Governance_System_1059/apps_script_cloud/_client_check.js', js);
console.log('js bytes', js.length);
console.log(js.slice(0, 180));
