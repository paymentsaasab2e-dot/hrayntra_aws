'use client';

import { useEffect, useState } from 'react';
import { Facebook, FileText, Linkedin, Loader2, Share2 } from 'lucide-react';
import { apiListLinkedInPostTemplates } from '../../lib/api';
import {
  applyDefaultLinkedInPostTemplate,
  parseLinkedInPostTemplateList,
  readRememberedLinkedInTemplateId,
  subscribeLinkedInTemplateDefaultChanged,
  subscribeLinkedInTemplatesChanged,
  type JobLinkedInPostTemplate,
} from '../../lib/jobLinkedInPostTemplate';
import { LinkedInPostTemplateModal } from './LinkedInPostTemplateModal';

const SOCIAL_PLATFORMS: Array<{
  id: string;
  label: string;
  live: boolean;
}> = [
  { id: 'linkedin', label: 'LinkedIn', live: true },
  { id: 'x_twitter', label: 'X (Twitter)', live: false },
  { id: 'facebook', label: 'Facebook', live: false },
  { id: 'instagram', label: 'Instagram', live: false },
];

function PlatformGlyph({ id }: { id: string }) {
  if (id === 'linkedin') return <Linkedin className="h-4 w-4" />;
  if (id === 'facebook') return <Facebook className="h-4 w-4" />;
  if (id === 'x_twitter') return <span className="text-sm font-bold">X</span>;
  return <Share2 className="h-4 w-4" />;
}

export function LinkedInPublishingDefaultsPanel({
  variant = 'job',
}: {
  variant?: 'job' | 'settings';
}) {
  const [templates, setTemplates] = useState<JobLinkedInPostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => readRememberedLinkedInTemplateId());
  const [modalOpen, setModalOpen] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const rows = parseLinkedInPostTemplateList(await apiListLinkedInPostTemplates());
      setTemplates(rows);
      const remembered = readRememberedLinkedInTemplateId();
      setSelectedId(rows.some((row) => row.id === remembered) ? remembered : null);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
    const unsubList = subscribeLinkedInTemplatesChanged(() => {
      void loadTemplates();
    });
    const unsubDefault = subscribeLinkedInTemplateDefaultChanged((template) => {
      setSelectedId(template?.id ?? null);
    });
    return () => {
      unsubList();
      unsubDefault();
    };
  }, []);

  const selected = templates.find((row) => row.id === selectedId) || null;

  const useTemplate = (template: JobLinkedInPostTemplate) => {
    setSelectedId(template.id);
    applyDefaultLinkedInPostTemplate(template);
  };

  const clearTemplate = () => {
    setSelectedId(null);
    applyDefaultLinkedInPostTemplate(null);
  };

  const isSettings = variant === 'settings';
  const shellClass = isSettings
    ? 'space-y-4'
    : 'rounded-2xl border border-[#2098C8]/25 bg-gradient-to-br from-[#E8F6FC]/70 via-white to-white p-4 shadow-sm space-y-4';

  return (
    <div className={shellClass}>
      {!isSettings ? (
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Linkedin className="h-4 w-4 text-[#2098C8]" />
            LinkedIn platforms
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Same LinkedIn platforms and templates as Settings. Choosing a template here is saved for
            every new job.
          </p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
          Platforms
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                platform.live
                  ? 'border-[#2098C8]/40 bg-white shadow-sm ring-1 ring-[#2098C8]/15'
                  : 'border-slate-200/80 bg-slate-50/90 opacity-80'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  platform.live ? 'bg-[#2098C8] text-white' : 'bg-slate-200/80 text-slate-500'
                }`}
              >
                <PlatformGlyph id={platform.id} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{platform.label}</p>
                <p className="text-[0.7rem] text-slate-500">
                  {platform.live ? 'Live for job posts' : 'Coming soon'}
                </p>
              </div>
              {platform.live ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700">
                  Live
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-slate-200/90 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Soon
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
              LinkedIn templates
            </p>
            {selected ? (
              <p className="mt-1 text-xs font-medium text-[#176F96]">Using: {selected.name}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                No template selected — posts follow Public Visibility
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {selectedId ? (
              <button
                type="button"
                onClick={clearTemplate}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2098C8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1A86B3]"
            >
              <FileText className="h-3.5 w-3.5" />
              Manage templates
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-[#2098C8]" />
            Loading LinkedIn templates…
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center">
            <p className="text-sm font-medium text-slate-700">No LinkedIn templates yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create one to control section order on LinkedIn, X, and Facebook posts.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => {
              const isSelected = selectedId === template.id;
              const visibleCount = template.schema.sections.filter((section) => section.visible).length;
              return (
                <li
                  key={template.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                    isSelected
                      ? 'border-[#2098C8] bg-[#E8F6FC]/70 ring-1 ring-[#2098C8]/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {template.name}
                      {isSelected ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-[#176F96]">
                          Active
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {visibleCount} visible · {template.schema.sections.length} sections
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => useTemplate(template)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      isSelected
                        ? 'bg-[#2098C8] text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isSelected ? 'Using' : 'Use'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <LinkedInPostTemplateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedTemplateId={selectedId}
        onApply={(template) => {
          useTemplate(template);
        }}
      />
    </div>
  );
}
