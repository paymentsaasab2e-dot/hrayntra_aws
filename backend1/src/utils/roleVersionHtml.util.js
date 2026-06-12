const { normalizeResumeStudioHtml } = require('./resumeStudioBrand.util');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asSkillList(skills) {
  if (Array.isArray(skills)) {
    return skills.map((s) => String(s || '').trim()).filter(Boolean);
  }
  return String(skills || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build studio-style HTML from a saved role-version draft snapshot when resumeHtml was not captured.
 */
function buildHtmlFromDraftSnapshot(snapshot, meta = {}) {
  if (!snapshot || typeof snapshot !== 'object') return '';

  const basics = snapshot.basics && typeof snapshot.basics === 'object' ? snapshot.basics : {};
  const name = String(basics.name || meta.candidateName || 'Candidate').trim();
  const title = String(basics.headline || meta.jobTitle || snapshot.title || 'Professional').trim();
  const email = String(basics.email || '').trim();
  const phone = String(basics.phone || '').trim();
  const location = String(basics.location || '').trim();
  const summary = String(snapshot.summary || basics.summary || '').trim();
  const skills = asSkillList(snapshot.skills);
  const experience = Array.isArray(snapshot.experience) ? snapshot.experience : [];
  const education = Array.isArray(snapshot.education) ? snapshot.education : [];

  const contactParts = [email, phone, location].filter(Boolean).map(escapeHtml);

  const experienceHtml = experience
    .map((exp) => {
      if (!exp || typeof exp !== 'object') return '';
      const role = escapeHtml(exp.role || exp.title || 'Role');
      const company = escapeHtml(exp.company || '');
      const duration = escapeHtml(exp.duration || exp.period || '');
      const bullets = String(exp.bullets || exp.description || '')
        .split('\n')
        .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('');
      return `<div class="mb-4">
        <p class="text-sm font-bold uppercase text-slate-900">${role}</p>
        <p class="text-xs font-semibold text-sky-600">${company}${duration ? ` · ${duration}` : ''}</p>
        ${bullets ? `<ul class="mt-1 list-disc pl-4 text-xs text-slate-700">${bullets}</ul>` : ''}
      </div>`;
    })
    .join('');

  const educationHtml = education
    .map((edu) => {
      if (!edu || typeof edu !== 'object') return '';
      return `<div class="mb-3">
        <p class="text-xs font-bold uppercase text-slate-900">${escapeHtml(edu.degree || '')}</p>
        <p class="text-[11px] text-slate-600">${escapeHtml(edu.institution || edu.school || '')}${edu.duration ? ` · ${escapeHtml(edu.duration)}` : ''}</p>
      </div>`;
    })
    .join('');

  const skillsHtml = skills
    .map(
      (skill) =>
        `<div class="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase text-slate-800">
          <span>${escapeHtml(skill)}</span>
          <span class="flex gap-0.5">${'<span class="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"></span>'.repeat(5)}</span>
        </div>`,
    )
    .join('');

  const html = `<div id="resume-preview" class="relative mx-auto w-full max-w-[840px] overflow-visible bg-white pb-12 font-sans text-slate-900 shadow-none">
  <header class="bg-slate-900 px-8 py-8 text-white">
    <h1 class="text-3xl font-bold uppercase tracking-wide">${escapeHtml(name)}</h1>
    <p class="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">${escapeHtml(title)}</p>
    ${contactParts.length ? `<p class="mt-4 text-xs text-slate-200">${contactParts.join(' · ')}</p>` : ''}
  </header>
  <div class="grid grid-cols-1 gap-6 px-8 py-8 md:grid-cols-[1.2fr_0.8fr]">
    <section>
      ${summary ? `<h2 class="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Profile</h2><p class="mb-6 text-sm leading-relaxed text-slate-700">${escapeHtml(summary)}</p>` : ''}
      ${experienceHtml ? `<h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Experience</h2>${experienceHtml}` : ''}
    </section>
    <aside>
      ${skillsHtml ? `<h2 class="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Skills</h2>${skillsHtml}` : ''}
      ${educationHtml ? `<h2 class="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Education</h2>${educationHtml}` : ''}
    </aside>
  </div>
</div>`;

  return normalizeResumeStudioHtml(html, { ensureWatermark: true });
}

function resolveRoleVersionHtml(version) {
  const stored = String(version?.resumeHtml || '').trim();
  if (stored.length > 80) {
    return normalizeResumeStudioHtml(stored, { ensureWatermark: true });
  }
  return buildHtmlFromDraftSnapshot(version?.draftSnapshot, {
    jobTitle: version?.jobTitle,
    company: version?.company,
  });
}

module.exports = {
  buildHtmlFromDraftSnapshot,
  resolveRoleVersionHtml,
};
