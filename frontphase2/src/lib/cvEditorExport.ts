import type { CVEditorData } from './cvEditorMapping';

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCvEditorPlainText(data: CVEditorData): string {
  const lines: string[] = [];
  const nameLine = [data.name, data.jobTitle].filter((s) => String(s || '').trim()).join(' — ');
  if (nameLine) lines.push(nameLine);

  const contact = [data.email, data.phone, data.location, data.linkedin]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' · ');
  if (contact) lines.push(contact);

  if (String(data.summary || '').trim()) {
    lines.push('', 'SUMMARY', String(data.summary).trim());
  }

  if (data.experiences?.length) {
    lines.push('', 'EXPERIENCE');
    for (const exp of data.experiences) {
      lines.push('');
      const title = [exp.role, exp.company].filter((s) => String(s || '').trim()).join(' — ');
      if (title) lines.push(title);
      if (String(exp.period || '').trim()) lines.push(String(exp.period).trim());
      if (String(exp.desc || '').trim()) lines.push(String(exp.desc).trim());
    }
  }

  if (data.education?.length) {
    lines.push('', 'EDUCATION');
    for (const edu of data.education) {
      lines.push('');
      const title = [edu.degree, edu.school].filter((s) => String(s || '').trim()).join(' — ');
      if (title) lines.push(title);
      if (String(edu.period || '').trim()) lines.push(String(edu.period).trim());
    }
  }

  if (data.skills?.length) {
    lines.push('', 'SKILLS', data.skills.map((s) => String(s).trim()).filter(Boolean).join(', '));
  }

  return lines.join('\n').trim();
}

function sanitizeFilename(name: string): string {
  return String(name || 'candidate').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'candidate';
}

function downloadTextBlob(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/** Download Updated CV as a plain-text file. */
export function downloadCvEditorPlainText(data: CVEditorData, candidateName?: string): void {
  const base = sanitizeFilename(candidateName || data.name || 'candidate');
  downloadTextBlob(buildCvEditorPlainText(data), `${base}-updated-cv.txt`);
}

/** Open a print dialog so the user can save Updated CV as PDF. */
export function printCvEditorAsPdf(data: CVEditorData, candidateName?: string): void {
  if (typeof window === 'undefined') return;
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
  if (!printWindow) throw new Error('Pop-up blocked — allow pop-ups to export PDF');

  const title = escapeHtml(candidateName || data.name || 'Updated CV');
  const contact = [data.email, data.phone, data.location, data.linkedin]
    .map((s) => escapeHtml(String(s || '').trim()))
    .filter(Boolean)
    .join(' · ');

  const experienceHtml = (data.experiences || [])
    .map((exp) => {
      const heading = [exp.role, exp.company].filter((s) => String(s || '').trim()).join(' — ');
      return `
        <article class="block">
          ${heading ? `<h3>${escapeHtml(heading)}</h3>` : ''}
          ${exp.period ? `<p class="meta">${escapeHtml(exp.period)}</p>` : ''}
          ${exp.desc ? `<p class="body">${escapeHtml(exp.desc).replace(/\n/g, '<br/>')}</p>` : ''}
        </article>`;
    })
    .join('');

  const educationHtml = (data.education || [])
    .map((edu) => {
      const heading = [edu.degree, edu.school].filter((s) => String(s || '').trim()).join(' — ');
      return `
        <article class="block">
          ${heading ? `<h3>${escapeHtml(heading)}</h3>` : ''}
          ${edu.period ? `<p class="meta">${escapeHtml(edu.period)}</p>` : ''}
        </article>`;
    })
    .join('');

  const skillsHtml = (data.skills || []).map((s) => escapeHtml(s)).filter(Boolean).join(', ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111827; line-height: 1.45; margin: 0; padding: 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .subtitle { font-size: 14px; color: #374151; margin: 0 0 8px; }
    .contact { font-size: 12px; color: #4b5563; margin-bottom: 20px; }
    h2 { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8; border-bottom: 1px solid #dbeafe; padding-bottom: 4px; margin: 22px 0 10px; }
    h3 { font-size: 14px; margin: 0 0 2px; }
    .meta { font-size: 12px; color: #6b7280; margin: 0 0 6px; }
    .body { font-size: 13px; margin: 0 0 10px; white-space: pre-wrap; }
    .block { margin-bottom: 12px; }
    .skills { font-size: 13px; }
    footer { margin-top: 28px; font-size: 10px; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.name || title)}</h1>
  ${data.jobTitle ? `<p class="subtitle">${escapeHtml(data.jobTitle)}</p>` : ''}
  ${contact ? `<p class="contact">${contact}</p>` : ''}
  ${data.summary ? `<section><h2>Summary</h2><p class="body">${escapeHtml(data.summary)}</p></section>` : ''}
  ${experienceHtml ? `<section><h2>Experience</h2>${experienceHtml}</section>` : ''}
  ${educationHtml ? `<section><h2>Education</h2>${educationHtml}</section>` : ''}
  ${skillsHtml ? `<section><h2>Skills</h2><p class="skills">${skillsHtml}</p></section>` : ''}
  <footer>Updated CV · HRYANTRA</footer>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 150);
    });
    window.addEventListener('afterprint', function () { window.close(); });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
