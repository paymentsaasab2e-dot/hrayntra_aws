'use client';

import React from 'react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { CrmStatNumber, crmNumFont } from '@/components/dashboard/crm/crmStatNumber';
import { formatNum, useRecDashboard } from './recShared';
import {
  REC_CARD_COMPACT,
  REC_CARD_PAD,
  REC_CHARCOAL,
  REC_ORANGE,
  REC_TRACK,
  RecSegmentedBar,
  RecSemiGauge,
  RecStatShell,
  recInitials,
  recKpi,
} from './recViz';
import { RecTeamPerformers } from './RecTeamPerformers';

type Props = { overview: RecruitmentOverview | null };

export function RecTeamIntelligence({ overview }: Props) {
  const { openDrillDown } = useRecDashboard();
  const lb = Array.isArray(overview?.leaderboard) ? overview.leaderboard : [];
  const jobs = Array.isArray(overview?.jobsTable) ? overview.jobsTable : [];
  const unassigned = jobs.filter((j) => !j.assignee || /unassigned/i.test(String(j.assignee))).length;
  const owned = Math.max(0, jobs.length - unassigned);
  const ownedPct = jobs.length > 0 ? Math.round((owned / jobs.length) * 100) : 0;

  const teamN = recKpi(overview, 'teamMembers') || lb.length || 0;
  const cands = Array.isArray(overview?.candidatesTable) ? overview.candidatesTable : [];
  const ivRows = Array.isArray(overview?.interviewsTable) ? overview.interviewsTable : [];
  const deskJobs = lb.reduce((s, r) => s + (r.openJobs || 0), 0);
  const deskCands = lb.reduce((s, r) => s + (r.candidates || 0), 0);
  const deskIv = lb.reduce((s, r) => s + (r.interviews || 0), 0);
  const deskPl = lb.reduce((s, r) => s + (r.placements || 0), 0);
  const avgOpen = lb.length ? deskJobs / lb.length : 0;
  const maxOpen = Math.max(0, ...lb.map((r) => r.openJobs || 0));
  const evenness = maxOpen > 0 ? Math.round((avgOpen / maxOpen) * 100) : 0;
  const closersN = lb.filter((r) => (r.placements || 0) > 0).length;
  const benchN = Math.max(0, lb.length - closersN);
  const candOwned = cands.filter((c) => c.assignee && !/unassigned/i.test(String(c.assignee))).length;
  const candOwnedPct = cands.length ? Math.round((candOwned / cands.length) * 100) : 0;
  const interviewedNames = new Set(
    ivRows.map((i) => String(i.candidate || '').trim().toLowerCase()).filter(Boolean),
  );
  const candInterviewed = cands.filter((c) => interviewedNames.has(String(c.name || '').trim().toLowerCase())).length;
  const interviewedPct = cands.length ? Math.round((candInterviewed / cands.length) * 100) : 0;
  const closerPct = lb.length ? Math.round((closersN / lb.length) * 100) : 0;
  const totalIv = recKpi(overview, 'totalInterviews');
  const feedbackPct = totalIv > 0 ? Math.round((recKpi(overview, 'interviewsOverdueFeedback') / totalIv) * 100) : 0;

  const closers = [...lb]
    .sort((a, b) => (b.placements || 0) - (a.placements || 0))
    .slice(0, 8)
    .map((r) => ({ name: String(r.name || '?').split(/\s+/)[0], value: r.placements || 0 }));
  const closerMax = Math.max(1, ...closers.map((c) => c.value));
  const topName = closers[0]?.name || '—';
  const closerShare = deskPl > 0 ? Math.round(((closers[0]?.value || 0) / deskPl) * 100) : 0;

  const loadRows = [...lb]
    .sort((a, b) => (b.openJobs || 0) - (a.openJobs || 0))
    .slice(0, 8)
    .map((r) => ({
      name: String(r.name || '?').split(/\s+/)[0],
      jobs: r.openJobs || 0,
      interviews: r.interviews || 0,
    }));
  const loadMax = Math.max(1, ...loadRows.map((r) => r.jobs + r.interviews));

  const feedback = recKpi(overview, 'interviewsOverdueFeedback');

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2.5">
          <h2 className="text-[15px] font-bold text-slate-900">Team overview</h2>
          <p className="text-[12px] font-medium text-slate-400">Ownership, load balance & close share</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <RecStatShell
            className={REC_CARD_COMPACT}
            info="Share of listed jobs with an assignee."
            onClick={() => openDrillDown({ title: 'Job ownership', href: '/job', rows: [{ Owned: owned, Open: unassigned }] })}
          >
            <p className="text-[11px] font-medium text-slate-500">Job ownership</p>
            <CrmStatNumber className="mt-1.5" value={`${ownedPct}%`} label="owned" />
            <div className="mt-2.5">
              <RecSegmentedBar height={10} parts={[{ value: owned, color: REC_CHARCOAL }, { value: unassigned, color: REC_ORANGE }]} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#334155]" />Owned {formatNum(owned)}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#F97316]" />Open {formatNum(unassigned)}</span>
            </div>
          </RecStatShell>
          <RecStatShell
            className={REC_CARD_COMPACT}
            info="Avg open jobs vs the busiest recruiter. 100% means load is even."
            onClick={() => openDrillDown({ title: 'Load balance', href: '/job', rows: lb.map((r) => ({ Recruiter: r.name, OpenJobs: r.openJobs })) })}
          >
            <p className="text-[11px] font-medium text-slate-500">Load evenness</p>
            <CrmStatNumber className="mt-1.5" value={`${evenness}%`} label="balanced" />
            <div className="mt-2.5">
              <RecSegmentedBar
                height={10}
                parts={[
                  { value: avgOpen, color: REC_CHARCOAL },
                  { value: Math.max(0, maxOpen - avgOpen), color: REC_ORANGE },
                ]}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Avg {avgOpen.toFixed(1)} · max {formatNum(maxOpen)} open jobs
            </p>
          </RecStatShell>
          <RecStatShell
            className={REC_CARD_COMPACT}
            info="Share of team placements sitting with the top closer."
          >
            <p className="text-[11px] font-medium text-slate-500">Close concentration</p>
            <CrmStatNumber className="mt-1.5" value={`${closerShare}%`} label="top closer" />
            <div className="mt-2.5">
              <RecSegmentedBar
                height={10}
                parts={[
                  { value: closers[0]?.value || 0, color: REC_ORANGE },
                  { value: Math.max(0, deskPl - (closers[0]?.value || 0)), color: REC_CHARCOAL },
                ]}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {topName} · {formatNum(deskPl)} team placements
            </p>
          </RecStatShell>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-12 xl:items-stretch">
        <section className={`${REC_CARD_PAD} xl:col-span-7`}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Desk mix</h3>
              <p className="text-[11px] font-medium text-slate-400">Leaderboard totals — jobs · talent · interviews · closes</p>
            </div>
            <HqInfoTip text="Sums from recruiter desks, not the org interview queue on Insights." />
          </div>
          <RecSegmentedBar
            height={14}
            parts={[
              { value: deskJobs, color: REC_CHARCOAL },
              { value: deskCands, color: '#1E3A8A' },
              { value: deskIv, color: REC_ORANGE },
              { value: deskPl, color: '#0F766E' },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2"><CrmStatNumber value={formatNum(deskJobs)} label="open jobs" size="sm" /></div>
            <div className="rounded-lg bg-blue-50 px-3 py-2"><CrmStatNumber value={formatNum(deskCands)} label="candidates" size="sm" /></div>
            <div className="rounded-lg bg-orange-50 px-3 py-2"><CrmStatNumber value={formatNum(deskIv)} label="interviews" size="sm" /></div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2"><CrmStatNumber value={formatNum(deskPl)} label="placements" size="sm" /></div>
          </div>
        </section>

        <div className="grid min-h-0 gap-3 xl:col-span-5 xl:grid-rows-[auto_minmax(240px,1fr)]">
          <section className="relative shrink-0 rounded-[1.25rem] border border-slate-100/80 bg-white p-3 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">Closer vs bench</h3>
                <p className="text-[11px] font-medium text-slate-400">Recs with a placement vs none</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-emerald-800">
                  {formatNum(closersN)} closing
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-700">
                  {formatNum(benchN)} bench
                </span>
              </div>
            </div>
            <div className="mt-2">
              <RecSegmentedBar height={10} parts={[{ value: closersN, color: '#0F766E' }, { value: benchN, color: REC_ORANGE }]} />
            </div>
          </section>
          <RecTeamPerformers overview={overview} className="min-h-[240px]" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2 xl:items-stretch">
        <section className={REC_CARD_PAD}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Top closer</h3>
              <p className="text-[11px] font-medium text-slate-400">Placements across the team</p>
            </div>
            <span className="absolute right-3 top-3">
              <HqInfoTip text="Ranked by placements on the current leaderboard." />
            </span>
          </div>
          <div className="mt-3 flex w-full items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#334155] text-[11px] font-semibold text-white">
              {recInitials(topName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-slate-900">{topName}</p>
              <p className="text-[11px] font-medium text-slate-400">{formatNum(closers[0]?.value)} placements</p>
            </div>
          </div>
          {closers.length ? (
            <div className="mt-3 flex h-[120px] items-end gap-1.5">
              {closers.map((c) => (
                <div key={c.name} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <p className={`${crmNumFont} text-[10px] font-semibold tabular-nums text-[#0F172A]`}>{c.value}</p>
                  <div
                    className="w-full max-w-[26px] rounded-md shadow-[0_6px_12px_rgba(249,115,22,0.28)]"
                    style={{
                      height: `${Math.max(10, (c.value / closerMax) * 86)}px`,
                      background: 'linear-gradient(180deg, #FB7185 0%, #F97316 52%, #FBBF24 100%)',
                    }}
                    title={`${c.name}: ${c.value} placements`}
                  />
                  <span className="w-full truncate text-center text-[10px] font-medium text-slate-400">{c.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-slate-400">No team data yet</p>
          )}
        </section>

        <section className={REC_CARD_PAD}>
          <h3 className="text-[13px] font-bold text-slate-900">Load by rep</h3>
          <p className="mb-3 text-[11px] font-medium text-slate-400">Open jobs vs interviews</p>
          {loadRows.length ? (
            <ul className="max-h-[220px] space-y-2.5 overflow-y-auto pr-1">
              {loadRows.map((r) => (
                <li key={r.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-medium text-slate-500">{r.name}</span>
                    <CrmStatNumber value={formatNum(r.jobs)} label="jobs" size="sm" />
                  </div>
                  <RecSegmentedBar
                    height={11}
                    parts={[
                      { value: r.jobs, color: REC_CHARCOAL },
                      { value: r.interviews, color: REC_ORANGE },
                      { value: Math.max(0, loadMax - r.jobs - r.interviews), color: REC_TRACK },
                    ]}
                  />
                  <p className="mt-1 text-[10px] font-medium text-slate-400">Interviews {formatNum(r.interviews)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-400">No team data yet</p>
          )}
        </section>
      </div>

      <section>
        <div className="mb-2.5">
          <h2 className="text-[15px] font-bold text-slate-900">Desk coverage</h2>
          <p className="text-[12px] font-medium text-slate-400">Team-only mixes · conversion rates stay on Insights</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RecSemiGauge
            display={`${closerPct}%`}
            pct={closerPct}
            label="Closer coverage"
            sub={`${formatNum(closersN)} of ${formatNum(lb.length || teamN)} recs with a placement`}
            tone="lime"
            info="Share of leaderboard recruiters who have at least one placement."
          />
          <RecSemiGauge
            display={`${candOwnedPct}%`}
            pct={candOwnedPct}
            label="Candidate ownership"
            sub={`${formatNum(candOwned)} assigned · ${formatNum(cands.length)} listed`}
            tone="indigo"
            info="Listed candidates with an assignee vs unassigned."
          />
          <RecSemiGauge
            display={`${interviewedPct}%`}
            pct={interviewedPct}
            label="Interviewed share"
            sub={`${formatNum(candInterviewed)} of listed talent on interview records`}
            tone="amber"
            info="Listed candidates who also appear on the interview snapshot."
          />
          <RecSemiGauge
            display={`${feedbackPct}%`}
            pct={feedbackPct}
            label="Feedback drag"
            sub={`${formatNum(feedback)} overdue · ${formatNum(totalIv)} interviews`}
            tone="rose"
            invertDelta
            info="Overdue feedback as a share of all interviews — different from Insights completion rate."
          />
        </div>
      </section>
    </div>
  );
}
