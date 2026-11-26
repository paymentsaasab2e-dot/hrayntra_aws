'use client';

import { X } from 'lucide-react';

export type StateTone = 'good' | 'warn' | 'bad' | 'neutral';

export const STATE_META: Record<
  string,
  { label: string; tone: StateTone; short: string; long: string }
> = {
  L1_HIT: {
    label: 'L1_HIT',
    tone: 'good',
    short: 'Served from server memory',
    long: 'The list was already in this server\'s memory and still fresh. No database work at all (0 Mongo operations). This is the fast path you want most Candidates-tab loads to take.',
  },
  L1_STALE: {
    label: 'L1_STALE',
    tone: 'good',
    short: 'Served instantly from memory, refreshing behind the scenes',
    long: 'The saved list was a little old but still safe to show, so it was returned immediately while a fresh copy is rebuilt in the background. You never wait for the database here.',
  },
  L2_HIT: {
    label: 'L2_HIT',
    tone: 'good',
    short: 'Served from Redis',
    long: 'Not in server memory, but found in Redis (the shared cache). Only appears when Redis is configured. Also avoids the database.',
  },
  MISS: {
    label: 'MISS',
    tone: 'warn',
    short: 'Not cached — loaded from the database',
    long: 'Nothing usable was cached, so the list was built from MongoDB and then saved for next time. This is the slow path; it should happen once per view, not on every load.',
  },
  COALESCED: {
    label: 'COALESCED',
    tone: 'warn',
    short: 'Waited for an identical request already running',
    long: 'Several people asked for the same list at the same moment. Only one database load ran; the others waited for it and shared the result. Protects MongoDB from a stampede.',
  },
  REFRESH: {
    label: 'REFRESH',
    tone: 'warn',
    short: 'Forced rebuild from the database',
    long: 'The cache was deliberately skipped for reading; the list was rebuilt from MongoDB and the cache was updated with the new result.',
  },
  BYPASS: {
    label: 'BYPASS',
    tone: 'neutral',
    short: 'Cache not used (original code path)',
    long: 'The request went straight to the original database code without reading or writing the cache. This is the "before" baseline to compare against.',
  },
  DISABLED: {
    label: 'DISABLED',
    tone: 'bad',
    short: 'Cache switched off on this server',
    long: 'CANDIDATE_ORG_CACHE_ENABLED is not 1 on the backend, so every request goes to the database.',
  },
};

export const toneClasses: Record<StateTone, string> = {
  good: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  bad: 'bg-rose-50 text-rose-800 border-rose-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function StateBadge({ state }: { state?: string | null }) {
  const meta = state ? STATE_META[state] : undefined;
  const tone = meta?.tone || 'neutral';
  return (
    <span
      title={meta?.short || ''}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${toneClasses[tone]}`}
    >
      {state || 'N/A'}
    </span>
  );
}

const BUTTONS: Array<{ name: string; what: string; use: string; safe: string }> = [
  {
    name: 'Candidates tab — All / Mine',
    what: 'Chooses which view the test buttons measure. "All" is the full list; "Mine" is only the candidates assigned to / created by you.',
    use: 'Pick the same tab you are actually using, so the numbers match what you feel in the Candidates tab.',
    safe: 'Only changes the test settings. Nothing is run.',
  },
  {
    name: 'Include Phase 1 common pool',
    what: 'Adds candidates from the shared Phase 1 database to the "All" list (the real tab does this when the organization has it enabled).',
    use: 'Turn on to measure the same combined list the Candidates tab loads. It is a different cached entry from the plain list.',
    safe: 'Only changes the test settings.',
  },
  {
    name: 'Run once (cached)',
    what: 'Loads the list exactly the way the Candidates tab does, through the cache, one time.',
    use: 'Click twice in a row. First click may be a MISS (slow), second should be L1_HIT (fast, 0 Mongo operations).',
    safe: 'Read-only. It only adds an entry to this organization\'s cache.',
  },
  {
    name: 'Run once (no cache)',
    what: 'Loads the list through the original code and skips the cache completely.',
    use: 'This is your "before" number. Compare it with a cached HIT to see the real gain.',
    safe: 'Read-only. Does not read or change the cache.',
  },
  {
    name: 'Force rebuild',
    what: 'Ignores whatever is cached, rebuilds the list from MongoDB and stores the new result.',
    use: 'Measures the true cost of a cold load, or refreshes a view on purpose.',
    safe: 'Read-only on candidate data; replaces one cache entry.',
  },
  {
    name: 'Compare: no cache vs cached',
    what: 'One click, five measurements: (1) no cache, (2) clear this org\'s cache and load once (MISS), (3-5) load three more times (should be HITs).',
    use: 'The fastest way to prove the cache works. Shows the speed-up and Mongo operations for each step.',
    safe: 'Clears this organization\'s cache first (others are untouched). Candidate data is never changed.',
  },
  {
    name: 'Concurrency ×N',
    what: 'Fires N identical requests at the same moment, like N recruiters opening the tab together.',
    use: 'With "Start cold" ON you should see 1 MISS and the rest COALESCED, and total Mongo operations about the same as a single load. With it OFF you should see all L1_HIT and 0 operations.',
    safe: '"Start cold" clears this organization\'s cache first. No candidate data is changed.',
  },
  {
    name: 'Start cold (checkbox)',
    what: 'Clears this organization\'s cache right before the concurrency test.',
    use: 'ON = tests the stampede protection. OFF = tests how fast a warm cache serves a crowd.',
    safe: 'Only this organization.',
  },
  {
    name: 'Clear cache (this org)',
    what: 'Deletes every cached candidate list of this organization (memory, and Redis when configured) and starts a new version.',
    use: 'Use before a test to force the next load to be a MISS. Normal edits already do this automatically.',
    safe: 'Only this organization. The next load is slower once, then fast again.',
  },
  {
    name: 'Reset stats',
    what: 'Zeroes the counters and clears the measurement history shown on this page.',
    use: 'Start a clean measurement session.',
    safe: 'Never touches the cache or any candidate data.',
  },
  {
    name: 'Refresh (top right)',
    what: 'Reloads the numbers on this page from the server.',
    use: 'After you use the real Candidates tab in another window, press this to see those real requests appear under "Live Candidates tab".',
    safe: 'Read-only.',
  },
];

const COMBOS: Array<{ title: string; steps: string; expect: string }> = [
  {
    title: 'Does the cache work at all?',
    steps: 'Compare: no cache vs cached',
    expect:
      'Step 1 is BYPASS (slow). Step 2 is MISS (about as slow). Steps 3–5 are L1_HIT with 0 Mongo operations and a much lower time.',
  },
  {
    title: 'First load vs second load',
    steps: 'Clear cache → Run once (cached) → Run once (cached)',
    expect: 'First = MISS with several Mongo operations. Second = L1_HIT, 0 operations, a few milliseconds.',
  },
  {
    title: 'Many people open the tab together',
    steps: 'Clear cache → Concurrency ×10 with "Start cold" ON',
    expect:
      '1 MISS, the other 9 COALESCED. Total Mongo operations stay close to a single load — the database is not hit 10 times.',
  },
  {
    title: 'A busy day with a warm cache',
    steps: 'Run once (cached) → Concurrency ×20 with "Start cold" OFF',
    expect: 'All 20 are L1_HIT and total Mongo operations is 0.',
  },
  {
    title: 'All vs Mine',
    steps: 'Select "All" → Run twice → select "Mine" → Run twice',
    expect:
      'Each tab is cached separately. Each one shows MISS then L1_HIT. "Mine" is cached per user, so it is never shared between people.',
  },
  {
    title: 'Does an edit refresh the list?',
    steps: 'Run once (cached) → edit or add a candidate in the Candidates tab → press Refresh → Run once (cached)',
    expect:
      'The cache version number goes up and the next run is a MISS (or an L1_HIT if the background warm-up already rebuilt it). You never see the old list.',
  },
  {
    title: 'What the real tab sees',
    steps: 'Open the Candidates tab a few times → come back here → Refresh',
    expect:
      'The "Live Candidates tab" section fills with your real requests: how many were served from memory and the average time for each kind.',
  },
  {
    title: 'Slow is not the cache — it is the login checks',
    steps: 'Compare Run once (cached) time here with how long the Candidates tab feels',
    expect:
      'If a cached run shows a few ms here but the tab still feels slow, the remaining time is the browser, network, or the per-request login/permission checks (see the Login-check memory card).',
  },
];

export function CandidateSpeedGuide({ onClose }: { onClose: () => void }) {
  return (
    <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">How to read this page</h2>
          <p className="mt-1 text-sm text-slate-600">
            This page measures how fast the <strong>Candidates tab</strong> list loads. The Candidates tab
            itself shows no statistics — everything is here. Numbers come from real requests on the server,
            not simulations.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close help"
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">The idea in one minute</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>
              Building the candidate list means several database queries (slow, can take seconds). The cache
              keeps the finished list in the server&apos;s memory so the next request is instant.
            </li>
            <li>
              Every organization has its own cache. One organization can never see or clear another&apos;s.
            </li>
            <li>
              Any successful change (add, edit, delete, stage move, upload, job or role change) automatically
              discards that organization&apos;s cached lists, so you never see stale data after saving.
            </li>
            <li>
              <strong>Redis is optional.</strong> Without it the cache lives in server memory (L1) and works
              fully. Redis (L2) only adds sharing between several servers and survives restarts.
            </li>
            <li>
              <strong>Mongo operations</strong> = the real number of database calls made for that request. A
              cache hit should show <strong>0</strong>.
            </li>
            <li>
              <strong>Docs examined</strong> is shown as N/A on purpose: it needs MongoDB&apos;s explain plan and
              is never estimated here.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Result labels (cache state)</h3>
          <dl className="mt-2 space-y-2.5 text-sm">
            {Object.values(STATE_META).map((m) => (
              <div key={m.label} className="flex gap-3">
                <dt className="w-24 shrink-0">
                  <StateBadge state={m.label} />
                </dt>
                <dd className="text-slate-600">{m.long}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">What each button does</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-2 py-2">Button</th>
                <th className="px-2 py-2">What it does</th>
                <th className="px-2 py-2">How to use it</th>
                <th className="px-2 py-2">Safe?</th>
              </tr>
            </thead>
            <tbody className="align-top text-slate-600">
              {BUTTONS.map((b) => (
                <tr key={b.name} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-900">{b.name}</td>
                  <td className="px-2 py-2">{b.what}</td>
                  <td className="px-2 py-2">{b.use}</td>
                  <td className="px-2 py-2">{b.safe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Button combinations and what you should see</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {COMBOS.map((c) => (
            <div key={c.title} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{c.title}</p>
              <p className="mt-1 text-slate-700">
                <span className="font-medium text-slate-500">Do: </span>
                {c.steps}
              </p>
              <p className="mt-1 text-slate-700">
                <span className="font-medium text-slate-500">Expect: </span>
                {c.expect}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          If a result differs from &quot;Expect&quot;, that is real information — do not trust a page that only
          shows good numbers. The timings here cover the server-side list build only, not browser rendering.
        </p>
      </div>
    </section>
  );
}
