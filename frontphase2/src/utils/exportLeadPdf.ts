/**
 * Export a Lead record to a print-friendly PDF.
 *
 * Implementation uses a hidden child window with a styled HTML document and
 * triggers `window.print()` so the browser shows its native print dialog
 * (where the user can pick "Save as PDF"). This keeps the bundle small —
 * no jsPDF dependency — while producing a real PDF the user can save or
 * share with the lead.
 */
import type { Lead, Activity as LeadActivity } from '../app/leads/types';

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function row(label: string, value: unknown): string {
  const safeValue = value === undefined || value === null || value === '' ? '—' : escapeHtml(value);
  return `<tr><th>${escapeHtml(label)}</th><td>${safeValue}</td></tr>`;
}

function buildActivitiesSection(activities: LeadActivity[] | undefined): string {
  if (!activities || activities.length === 0) {
    return '<p class="empty">No activities recorded.</p>';
  }
  const rows = activities
    .slice()
    .sort((a, b) => {
      const aTime = new Date((a as any).timestamp || (a as any).createdAt || 0).getTime();
      const bTime = new Date((b as any).timestamp || (b as any).createdAt || 0).getTime();
      return bTime - aTime;
    })
    .map((activity) => {
      const ts = (activity as any).timestamp || (activity as any).createdAt;
      const type = (activity as any).type || 'Activity';
      const title = (activity as any).title || (activity as any).action || type;
      const description = (activity as any).description || '';
      return `
        <li>
          <div class="activity-meta">
            <span class="activity-type">${escapeHtml(type)}</span>
            <span class="activity-time">${escapeHtml(formatDateTime(ts))}</span>
          </div>
          <div class="activity-title">${escapeHtml(title)}</div>
          ${description ? `<div class="activity-desc">${escapeHtml(description)}</div>` : ''}
        </li>`;
    })
    .join('');
  return `<ul class="timeline">${rows}</ul>`;
}

function buildNotesSection(lead: Lead): string {
  const notes = Array.isArray(lead.notesList) ? lead.notesList : [];
  if (!notes.length && !lead.notes) {
    return '<p class="empty">No notes recorded.</p>';
  }
  const items: string[] = [];
  if (lead.notes) {
    items.push(
      `<li><div class="note-meta"><span>General</span></div><div class="note-body">${escapeHtml(
        lead.notes
      )}</div></li>`
    );
  }
  notes.forEach((note) => {
    items.push(
      `<li>
        <div class="note-meta">
          <span>${escapeHtml(note.createdBy?.name || 'Team member')}</span>
          <span>${escapeHtml(formatDateTime(note.createdAt))}</span>
        </div>
        <div class="note-body">${escapeHtml(note.content || '')}</div>
      </li>`
    );
  });
  return `<ul class="notes">${items.join('')}</ul>`;
}

export function exportLeadAsPdf(lead: Lead): void {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) {
    // Popup blocker active — fall back to current window navigation? Not great
    // for UX; surface a helpful message instead and bail.
    alert(
      'Could not open the export window — please allow pop-ups for this site and try again.'
    );
    return;
  }

  const generatedAt = new Date().toLocaleString();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Lead Profile — ${escapeHtml(lead.companyName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #f8fafc; padding: 32px 40px; line-height: 1.5; font-size: 13px; }
  header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
  header h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
  header .subtitle { font-size: 12px; color: #64748b; }
  .badges { display: flex; gap: 8px; flex-wrap: wrap; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #cbd5e1; background: #fff; color: #1e293b; }
  .badge.priority-High { border-color: #fecaca; background: #fee2e2; color: #991b1b; }
  .badge.priority-Medium { border-color: #fde68a; background: #fef3c7; color: #92400e; }
  .badge.priority-Low { border-color: #bbf7d0; background: #dcfce7; color: #166534; }
  .badge.status { border-color: #bfdbfe; background: #dbeafe; color: #1e40af; }
  section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 22px; margin-bottom: 18px; page-break-inside: avoid; }
  section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  table th, table td { padding: 8px 6px; text-align: left; vertical-align: top; font-size: 12.5px; }
  table th { font-weight: 600; color: #64748b; width: 38%; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
  table td { color: #0f172a; border-bottom: 1px solid #f1f5f9; word-break: break-word; }
  table tr:last-child th, table tr:last-child td { border-bottom: none; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .timeline, .notes { list-style: none; padding: 0; margin: 0; }
  .timeline li, .notes li { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .timeline li:last-child, .notes li:last-child { border-bottom: none; }
  .activity-meta, .note-meta { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .activity-type { font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.04em; }
  .activity-title, .note-body { font-weight: 500; color: #0f172a; }
  .activity-desc { margin-top: 4px; color: #475569; font-size: 12px; }
  .empty { color: #94a3b8; font-style: italic; font-size: 12px; }
  footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print {
    body { background: #fff; padding: 0; }
    section { box-shadow: none; }
  }
</style>
</head>
<body>
<header>
  <div>
    <h1>${escapeHtml(lead.companyName)}</h1>
    <div class="subtitle">${escapeHtml(lead.contactPerson || '—')} · ${escapeHtml(lead.email || '—')} · ${escapeHtml(lead.phone || '—')}</div>
  </div>
  <div class="badges">
    <span class="badge status">${escapeHtml(lead.status || 'New')}</span>
    <span class="badge priority-${escapeHtml(lead.priority || 'Medium')}">Priority: ${escapeHtml(lead.priority || 'Medium')}</span>
    <span class="badge">${escapeHtml(lead.type || 'Lead')}</span>
  </div>
</header>

<div class="grid-2">
  <section>
    <h2>Company</h2>
    <table>
      ${row('Company Name', lead.companyName)}
      ${row('Industry', lead.industry)}
      ${row('Sector', lead.sector)}
      ${row('Company Size', lead.companySize)}
      ${row('Website', lead.website)}
      ${row('LinkedIn', lead.linkedIn)}
      ${row('Location', lead.location)}
      ${row('City', lead.city)}
      ${row('Country', lead.country)}
    </table>
  </section>
  <section>
    <h2>Primary Contact</h2>
    <table>
      ${row('Contact Person', lead.contactPerson)}
      ${row('Designation', lead.designation)}
      ${row('Director', lead.directorName)}
      ${row('Email', lead.email)}
      ${row('Phone', lead.phone)}
      ${row('Team Name', lead.teamName)}
    </table>
  </section>
</div>

<section>
  <h2>Lead Pipeline</h2>
  <table>
    ${row('Status', lead.status)}
    ${row('Source', lead.source)}
    ${row('Type', lead.type)}
    ${row('Priority / Interest', lead.priority)}
    ${row('Interested Needs', lead.interestedNeeds)}
    ${row('Services Needed', lead.servicesNeeded)}
    ${row('Expected Business Value', lead.expectedBusinessValue)}
    ${row('Assigned To', lead.assignedTo?.name)}
    ${row('Last Follow-up', formatDateTime(lead.lastFollowUp))}
    ${row('Next Follow-up', formatDateTime(lead.nextFollowUp))}
    ${row('Created', formatDateTime(lead.createdDate))}
  </table>
</section>

<section>
  <h2>Activities</h2>
  ${buildActivitiesSection(lead.activities)}
</section>

<section>
  <h2>Notes</h2>
  ${buildNotesSection(lead)}
</section>

<footer>Exported ${escapeHtml(generatedAt)} · HRYANTRA Lead Profile</footer>

<script>
  // Trigger print as soon as the document settles. The user picks
  // "Save as PDF" from the native print dialog. Closing the window
  // afterwards is best-effort; some browsers block close().
  window.addEventListener('load', function () {
    setTimeout(function () {
      window.focus();
      window.print();
    }, 150);
  });
  window.addEventListener('afterprint', function () {
    window.close();
  });
</script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
