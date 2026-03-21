import React, { useMemo, useState } from 'react';
import { Briefcase, ChevronDown, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchJob } from './types';

interface JobSelectorProps {
  jobs: MatchJob[];
  selectedJob: MatchJob;
  onSelect: (job: MatchJob) => void;
}

export default function JobSelector({ jobs, selectedJob, onSelect }: JobSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const text = `${job.title} ${job.client}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [jobs, query]);

  const badgeClass =
    selectedJob.status === 'Urgent'
      ? 'bg-[#FEE2E2] text-[#991B1B]'
      : selectedJob.status === 'Open'
        ? 'bg-[#D1FAE5] text-[#065F46]'
        : 'bg-amber-100 text-amber-700';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-w-[300px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm transition hover:border-blue-300"
      >
        <Briefcase size={18} className="text-slate-400" />
        <div className="flex-1 text-left">
          <p className="text-[11px] text-[#6B7280]">Job Title &amp; Client</p>
          <p className="text-sm font-semibold text-slate-900">
            {selectedJob.title} • {selectedJob.client}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${badgeClass}`}>
          {selectedJob.status}
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 top-[calc(100%+10px)] z-30 w-full rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-xl"
          >
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search jobs or clients..."
                className="w-full rounded-xl border border-[#E5E7EB] px-10 py-2.5 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => {
                    onSelect(job);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                    <p className="mt-1 text-xs text-[#6B7280]">{job.client}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      job.status === 'Urgent'
                        ? 'bg-[#FEE2E2] text-[#991B1B]'
                        : job.status === 'Open'
                          ? 'bg-[#D1FAE5] text-[#065F46]'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {job.status}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
