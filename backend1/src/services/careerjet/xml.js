const { cdata } = require('../adzuna/xml');

function cdataEl(tag, value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return `<${tag}>${cdata(text)}</${tag}>`;
}

function locationXml({ city, region, country }) {
  const inner = [
    cdataEl('city', city),
    cdataEl('region', region),
    cdataEl('country', country),
  ]
    .filter(Boolean)
    .join('\n      ');
  if (!inner) return '';
  return `    <location>\n      ${inner}\n    </location>`;
}

function jobToXml(fields) {
  const lines = ['  <job>'];
  for (const item of fields) {
    if (!item) continue;
    if (item.raw) {
      lines.push(item.raw);
      continue;
    }
    const node = cdataEl(item.tag, item.value);
    if (node) lines.push(`    ${node}`);
  }
  lines.push('  </job>');
  return lines.join('\n');
}

function wrapJobsXml(jobXmlNodes) {
  const body = jobXmlNodes.filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<jobs>\n${body}\n</jobs>\n`;
}

module.exports = {
  cdataEl,
  locationXml,
  jobToXml,
  wrapJobsXml,
};
