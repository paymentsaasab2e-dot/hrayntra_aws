/**
 * Well-formed XML helpers for the Adzuna job feed.
 * Escapes text nodes and safely wraps HTML descriptions in CDATA.
 */

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value) {
  const text = String(value ?? '');
  return `<![CDATA[${text.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function element(tag, value, { raw = false } = {}) {
  if (value == null) return '';
  const text = String(value);
  if (!text.trim()) return '';
  const inner = raw ? cdata(text) : escapeXml(text);
  return `<${tag}>${inner}</${tag}>`;
}

function jobToXml(fields) {
  const lines = ['  <job>'];
  for (const [tag, value, options] of fields) {
    const node = element(tag, value, options);
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
  escapeXml,
  cdata,
  element,
  jobToXml,
  wrapJobsXml,
};
