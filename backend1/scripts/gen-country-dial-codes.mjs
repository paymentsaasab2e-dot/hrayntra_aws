import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.resolve(__dirname, '../../../jobportal_himanshu/src/lib/country-codes.ts'),
  'utf8',
);
const re = /\{\s*code:\s*"([A-Z]{2})",\s*dialCode:\s*"(\+\d+)"/g;
const map = {};
let m;
while ((m = re.exec(src))) {
  map[m[1]] = m[2];
}
const out = path.resolve(__dirname, '../src/utils/country-dial-codes.js');
fs.writeFileSync(out, `module.exports = ${JSON.stringify(map, null, 2)};\n`);
console.log('Wrote', Object.keys(map).length, 'entries to', out);
