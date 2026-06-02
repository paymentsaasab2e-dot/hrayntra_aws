import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const servicesDir = path.join(repoRoot, 'src', 'services');
const oldModulePath = path.join(servicesDir, 'cvParsing.head.abtemp.mjs');

function toMulterLike(filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    originalname: path.basename(filePath),
    filename: path.basename(filePath),
    mimetype: 'application/pdf',
    size: stat.size,
  };
}

function sig(stage4) {
  const fb = stage4?.fallbackData || {};
  return {
    email: fb.email || '',
    phone: fb.phone || '',
    name: `${fb.firstName || ''} ${fb.lastName || ''}`.trim(),
    workExperienceEntries: Array.isArray(fb.workExperienceEntries) ? fb.workExperienceEntries.length : 0,
    skills: Array.isArray(fb.skills) ? fb.skills.length : 0,
    score: null,
  };
}

function same(a, b, key) {
  return JSON.stringify(a?.[key]) === JSON.stringify(b?.[key]);
}

async function runOne(mod, file) {
  const t0 = performance.now();
  const out = await mod.runCvPipelineThroughStage4(toMulterLike(file), {
    skipCandidateRegex: false,
    skipProfilePhoto: true,
    logTag: 'AB',
  });
  const ms = Math.round(performance.now() - t0);
  return { ms, sig: sig(out) };
}

async function main() {
  const samples = process.argv.slice(2);
  if (!samples.length) {
    console.error('Usage: node scripts/cv-stage4-ab-check.mjs <pdf1> <pdf2> <pdf3>');
    process.exit(1);
  }

  const currentModule = await import(pathToFileURL(path.join(servicesDir, 'cvParsing.service.js')).href);
  const oldModule = await import(pathToFileURL(oldModulePath).href);

  const rows = [];
  for (const sample of samples) {
    const file = path.resolve(sample);
    const before = await runOne(oldModule, file);
    const after = await runOne(currentModule, file);
    rows.push({
      file: path.basename(file),
      beforeMs: before.ms,
      afterMs: after.ms,
      speedupMs: before.ms - after.ms,
      sameEmail: same(before.sig, after.sig, 'email'),
      samePhone: same(before.sig, after.sig, 'phone'),
      sameName: same(before.sig, after.sig, 'name'),
      sameWorkExperienceEntries: same(before.sig, after.sig, 'workExperienceEntries'),
      sameSkills: same(before.sig, after.sig, 'skills'),
      scoreComparable: false,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
