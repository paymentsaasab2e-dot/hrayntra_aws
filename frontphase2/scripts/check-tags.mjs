import fs from 'fs';
const p = new URL('../src/components/import/importDrawerUi.tsx', import.meta.url);
const lines = fs.readFileSync(p, 'utf8').split('\n');
for (const n of [49, 57, 58, 168, 191, 228]) {
  const line = lines[n - 1];
  console.log(n, JSON.stringify(line.trim()));
}
