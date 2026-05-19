import fs from 'fs';

const p = new URL('../src/components/import/importDrawerUi.tsx', import.meta.url);
const lines = fs.readFileSync(p, 'utf8').split('\n');

const fixLines = new Set([57, 168, 191, 228, 242, 270, 271]);

const out = lines.map((line, i) => {
  const n = i + 1;
  if (fixLines.has(n) && line.trim() === '</motion.div>') {
    return line.replace('</motion.div>', '</div>');
  }
  return line;
});

fs.writeFileSync(p, out.join('\n'));
console.log('fixed lines', [...fixLines].join(', '));
