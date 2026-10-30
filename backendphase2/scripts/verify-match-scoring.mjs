/**
 * Create a controlled OPEN job, score tenant candidates with the match engine,
 * and verify high-skill-overlap candidates rank above low-overlap ones.
 *
 * Usage: node scripts/verify-match-scoring.mjs
 */
import 'dotenv/config';
import { prisma, runWithTenantContext } from '../src/config/prisma.js';
import { summarizeJob, summarizeCandidate } from '../src/services/jobMatchEngine/job-normalization.cjs';
import { mapPhase2CandidateForPortalEngine } from '../src/services/jobMatchEngine/mapPhase2Candidate.cjs';
import {
  buildMatchPipelineCandidateText,
  buildWorkHistoryFromRaw,
} from '../src/services/jobMatchEngine/matchCandidateProfile.cjs';
import { computePass1 } from '../src/services/jobMatchEngine/pass1SkillsMatch.cjs';
import { computePass2 } from '../src/services/jobMatchEngine/pass2ExperienceMatch.cjs';
import { computePass3 } from '../src/services/jobMatchEngine/pass3SemanticMatch.cjs';
import { computePass4 } from '../src/services/jobMatchEngine/pass4CulturalFit.cjs';
import { mergeScores } from '../src/services/jobMatchEngine/scoreMerger.cjs';

const TENANT = process.env.VERIFY_TENANT || 'adm01';
const JOB_TITLE = 'VERIFY AI Match — Senior React/Node Engineer';
const REQUIRED_SKILLS = ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS'];
const PREFERRED_SKILLS = ['Docker', 'Kubernetes'];

function extractJobSections(job) {
  const responsibilities = Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities.join(' ') : '';
  const requirements = Array.isArray(job.requirements) ? job.requirements.join(' ') : '';
  const aboutUs = `${job.overview || ''} ${Array.isArray(job.benefits) ? job.benefits.join(' ') : ''}`.trim();
  return { responsibilities, requirements, aboutUs };
}

function extractCandidateSections(raw) {
  const workExperience = buildWorkHistoryFromRaw(raw)
    .map((e) => `${e.title || ''} at ${e.company || ''}: ${e.description || ''}`)
    .join(' ');
  const skills = [...(raw.skills || []), ...(raw.recruiterSkills || [])].join(', ');
  const summary = buildMatchPipelineCandidateText(raw) || raw.cvSummary || raw.notes || raw.recruiterNotes || '';
  return { workExperience, skills, summary };
}

function skillOverlapCount(candidateSkills, required) {
  // Reuse Pass1 token matching so verify overlap matches engine matches.
  const p1 = computePass1(candidateSkills || [], required, []);
  return p1.matchedRequired.length;
}

function verdictFor(score, overlap, requiredCount) {
  const ratio = requiredCount ? overlap / requiredCount : 0;
  if (ratio >= 0.6 && score < 50) return 'SUSPECT_LOW';
  if (ratio <= 0.2 && score >= 75) return 'SUSPECT_HIGH';
  if (ratio >= 0.6 && score >= 55) return 'OK_STRONG';
  if (ratio <= 0.2 && score < 60) return 'OK_WEAK';
  return 'OK_MID';
}

async function main() {
  await runWithTenantContext(TENANT, async () => {
    console.log(`\n=== Match scoring verification (tenant=${TENANT}) ===\n`);

    let client = await prisma.client.findFirst({
      where: { isDeleted: { not: true } },
      select: { id: true, companyName: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          companyName: 'VERIFY Match Client',
          status: 'ACTIVE',
        },
        select: { id: true, companyName: true },
      });
      console.log(`Created client: ${client.companyName} (${client.id})`);
    } else {
      console.log(`Using client: ${client.companyName} (${client.id})`);
    }

    // Soft-delete any previous verify jobs so we don't clutter.
    await prisma.job.updateMany({
      where: { title: JOB_TITLE, isDeleted: { not: true } },
      data: { isDeleted: true, status: 'CLOSED' },
    });

    const job = await prisma.job.create({
      data: {
        title: JOB_TITLE,
        clientId: client.id,
        status: 'OPEN',
        description:
          'We are hiring a Senior Full Stack Engineer focused on React, Node.js, TypeScript, MongoDB and AWS. You will build APIs, UI features, and cloud deployments.',
        overview: 'Product engineering team building SaaS recruitment tooling.',
        skills: REQUIRED_SKILLS,
        preferredSkills: PREFERRED_SKILLS,
        keyResponsibilities: [
          'Build React frontends with TypeScript',
          'Design Node.js APIs and MongoDB data models',
          'Deploy and operate services on AWS',
        ],
        requirements: ['React', 'Node.js', 'TypeScript', '3-6 years'],
        experienceRequired: '3-6 years',
        location: 'Pune, India',
        workMode: 'HYBRID',
      },
    });
    console.log(`Created job: ${job.title} (${job.id})`);
    console.log(`JD skills: ${REQUIRED_SKILLS.join(', ')}`);
    console.log(`Preferred: ${PREFERRED_SKILLS.join(', ')}\n`);

    // Seed one strong-fit + one weak-fit control profile so ranking can be proven.
    async function ensureControlCandidate({ email, data }) {
      const existing = await prisma.candidate.findFirst({ where: { email } });
      if (existing) {
        return prisma.candidate.update({
          where: { id: existing.id },
          data: { ...data, status: 'ACTIVE', isDeleted: false },
        });
      }
      return prisma.candidate.create({
        data: { email, status: 'ACTIVE', ...data },
      });
    }

    const strongControl = await ensureControlCandidate({
      email: 'verify.strong.match@example.com',
      data: {
        firstName: 'Verify',
        lastName: 'StrongFit',
        currentTitle: 'Senior Full Stack Engineer',
        experience: 5,
        skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS', 'Docker'],
        recruiterSkills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS', 'Docker'],
        cvSummary:
          'Senior React and Node.js engineer with TypeScript, MongoDB and AWS production experience building SaaS platforms.',
        location: 'Pune, India',
      },
    });
    const weakControl = await ensureControlCandidate({
      email: 'verify.weak.match@example.com',
      data: {
        firstName: 'Verify',
        lastName: 'WeakFit',
        currentTitle: 'Sales Associate',
        experience: 2,
        skills: ['Communication', 'MS Office', 'Hindi', 'English'],
        recruiterSkills: ['Communication', 'MS Office'],
        cvSummary: 'Sales associate with strong communication skills. No software engineering background.',
        location: 'Mumbai, India',
      },
    });
    console.log(`Control candidates: StrongFit=${strongControl.id}, WeakFit=${weakControl.id}`);

    const candidates = await prisma.candidate.findMany({
      where: { isDeleted: { not: true }, status: { in: ['NEW', 'ACTIVE'] } },
      take: 40,
      orderBy: { updatedAt: 'desc' },
    });
    console.log(`Loaded ${candidates.length} candidates for scoring\n`);

    if (!candidates.length) {
      console.log('No candidates found — cannot verify scoring.');
      return;
    }

    const normJob = summarizeJob(job);
    console.log(`Engine required skills: ${normJob.normalizedRequiredSkills.join(', ') || '(none)'}`);
    console.log(`Engine preferred skills: ${normJob.normalizedPreferredSkills.join(', ') || '(none)'}\n`);

    const jobSections = extractJobSections(job);
    const jobText = [job.description, job.overview, ...(job.keyResponsibilities || []), ...(job.requirements || [])]
      .filter(Boolean)
      .join('\n');
    const cultureText = [job.overview, job.description].filter(Boolean).join('\n');

    const rows = [];
    for (const raw of candidates) {
      const portal = mapPhase2CandidateForPortalEngine(raw);
      if (!portal) continue;
      const summarized = summarizeCandidate(portal);
      const candidateSections = extractCandidateSections(raw);
      const candidateText = String(
        buildMatchPipelineCandidateText(raw) || summarized.summaryText || raw.cvSummary || raw.notes || ''
      ).slice(0, 12000);
      const workHistory = buildWorkHistoryFromRaw(raw);
      const skillList = summarized.normalizedSkills || [];
      const overlap = skillOverlapCount(skillList, REQUIRED_SKILLS);

      const p1 = computePass1(skillList, normJob.normalizedRequiredSkills, normJob.normalizedPreferredSkills);
      const candYears = Number(summarized.candidateExperience ?? raw.experience ?? 0) || 0;
      const p2 = computePass2(
        candYears,
        summarized.currentTitle,
        workHistory,
        job.experienceRequired,
        job.title,
        job.description || ''
      );
      const p3 = await computePass3(jobSections, candidateSections, jobText, candidateText, null, null, null);
      const softSkills = skillList.filter((s) =>
        /communication|leadership|team|collaboration|stakeholder/i.test(String(s))
      );
      const pastTitles = (workHistory || []).map((w) => w.title).filter(Boolean);
      const p4 = await computePass4(
        cultureText,
        job.title,
        String(candidateText || '').slice(0, 1200),
        softSkills,
        pastTitles,
        !String(cultureText || '').trim()
      );
      const merged = mergeScores(p1, p2, p3, p4);
      const name = summarized.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || raw.id;
      const check = verdictFor(merged.finalScore, overlap, REQUIRED_SKILLS.length);
      rows.push({
        name,
        id: raw.id,
        score: merged.finalScore,
        band: merged.band,
        overlap,
        skillsPreview: skillList.slice(0, 8).join(', '),
        p1: p1.score,
        p2: p2.score,
        p3: p3.score,
        p4: p4.skipped ? 'skip' : p4.score,
        engine: p3.engine,
        formula: merged.formula,
        check,
        matched: p1.matchedRequired,
        missing: p1.missingRequired,
      });
    }

    rows.sort((a, b) => b.score - a.score);

    console.log('--- Top / bottom scored candidates ---');
    const printRow = (r, i) => {
      console.log(
        `${String(i + 1).padStart(2)}. ${r.score}% [${r.band}] overlap=${r.overlap}/${REQUIRED_SKILLS.length} ${r.check} | ${r.name}`
      );
      console.log(
        `    p1=${r.p1} p2=${r.p2} p3=${r.p3}(${r.engine}) p4=${r.p4} | skills: ${r.skillsPreview || '-'}`
      );
      console.log(`    matched: [${r.matched.join(', ')}] missing: [${r.missing.join(', ')}]`);
    };

    rows.slice(0, 8).forEach(printRow);
    console.log('...');
    rows.slice(-5).forEach((r, i) => printRow(r, rows.length - 5 + i));

    const strong = rows.filter((r) => r.overlap >= 3);
    const weak = rows.filter((r) => r.overlap <= 1);
    const avg = (list) =>
      list.length ? Math.round(list.reduce((s, r) => s + r.score, 0) / list.length) : null;

    const avgStrong = avg(strong);
    const avgWeak = avg(weak);
    const suspectHigh = rows.filter((r) => r.check === 'SUSPECT_HIGH');
    const suspectLow = rows.filter((r) => r.check === 'SUSPECT_LOW');

    console.log('\n--- Accuracy checks ---');
    console.log(`Candidates with >=3 JD skill overlaps: ${strong.length} (avg score ${avgStrong ?? 'n/a'})`);
    console.log(`Candidates with <=1 JD skill overlaps: ${weak.length} (avg score ${avgWeak ?? 'n/a'})`);
    console.log(`Suspect HIGH (low overlap but score>=75): ${suspectHigh.length}`);
    console.log(`Suspect LOW (high overlap but score<50): ${suspectLow.length}`);

    let passed = true;
    if (strong.length && weak.length && avgStrong != null && avgWeak != null) {
      if (avgStrong <= avgWeak) {
        console.log('FAIL: high-overlap candidates did not outscore low-overlap on average.');
        passed = false;
      } else {
        console.log(`PASS: high-overlap avg (${avgStrong}) > low-overlap avg (${avgWeak}).`);
      }
    } else {
      console.log('WARN: not enough strong/weak groups to compare averages (need mixed skill profiles).');
    }

    if (suspectHigh.length || suspectLow.length) {
      console.log('FAIL: found suspect score outliers vs skill overlap.');
      passed = false;
      [...suspectHigh, ...suspectLow].slice(0, 10).forEach((r) => {
        console.log(`  - ${r.name}: ${r.score}% overlap=${r.overlap} ${r.check}`);
      });
    } else {
      console.log('PASS: no extreme score outliers vs skill overlap.');
    }

    const controlStrong = rows.find((r) => r.id === strongControl.id);
    const controlWeak = rows.find((r) => r.id === weakControl.id);
    if (controlStrong && controlWeak) {
      console.log(
        `Control StrongFit=${controlStrong.score}% (overlap ${controlStrong.overlap}/5) vs WeakFit=${controlWeak.score}% (overlap ${controlWeak.overlap}/5)`
      );
      if (controlStrong.score <= controlWeak.score) {
        console.log('FAIL: StrongFit control did not beat WeakFit control.');
        passed = false;
      } else {
        console.log('PASS: StrongFit control outscored WeakFit control.');
      }
      if (controlStrong.matched.length < 4 || controlStrong.score < 55) {
        console.log(
          `FAIL: StrongFit control should land high (expect matched>=4 and score>=55; got matched=${controlStrong.matched.length}, score=${controlStrong.score}).`
        );
        passed = false;
      } else {
        console.log('PASS: StrongFit control score/overlap look strong.');
      }
      if (controlWeak.overlap > 1 || controlWeak.score >= 70) {
        console.log('FAIL: WeakFit control should stay low.');
        passed = false;
      } else {
        console.log('PASS: WeakFit control score/overlap look weak.');
      }
    }

    // Persist scores as AI matches so /matches UI can show this job.
    await prisma.match.deleteMany({
      where: { jobId: job.id, createdById: { isSet: false } },
    });
    for (const r of rows) {
      await prisma.match.create({
        data: {
          candidateId: r.id,
          jobId: job.id,
          score: r.score,
          status: 'SUGGESTED',
          evaluation: {
            origin: 'ai',
            finalScore: r.score,
            band: r.band,
            engineVersion: '1.1',
            computedAt: new Date().toISOString(),
            runId: `verify_${Date.now()}`,
            pass1: { score: r.p1, matchedRequired: r.matched, missingRequired: r.missing },
            pass2: { score: r.p2 },
            pass3: { score: r.p3, engine: r.engine },
            pass4: { score: r.p4 === 'skip' ? 0 : r.p4, skipped: r.p4 === 'skip' },
            merged: { finalScore: r.score, band: r.band, formula: r.formula },
            suggestion: `Verify run: overlap ${r.overlap}/${REQUIRED_SKILLS.length} JD skills.`,
          },
        },
      });
    }
    console.log(`\nPersisted ${rows.length} AI match rows for job ${job.id}`);
    console.log(`Open Matches UI → select job "${JOB_TITLE}" → AI tab to review.`);
    console.log(`\n=== RESULT: ${passed ? 'SCORING LOOKS CORRECT' : 'SCORING HAS ISSUES'} ===\n`);
    process.exitCode = passed ? 0 : 1;
  });
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
