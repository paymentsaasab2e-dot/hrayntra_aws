'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Mail, Plus, Trash2, X } from 'lucide-react';
import { DetailsModalShell } from '../drawers/DetailsModalShell';
import { DrawerLinkActions } from '../drawers/DrawerLinkActions';
import {
  apiConnectIntegration,
  apiCreateGmailComposeDraft,
  apiCreateOutlookComposeDraft,
  apiGetMailboxStatus,
  apiUpdateClientTracker,
  type MailboxStatusResponse,
} from '../../lib/api';
import {
  buildInboxComposePath,
  buildMailboxComposeUrl,
  buildSubmitToClientMailCopy,
  connectedMailboxEmail,
  connectedMailboxProviders,
  openMailboxComposeTab,
  stashInboxComposeDraft,
  type MailboxComposeProvider,
} from '../../lib/mailboxCompose';
import {
  CLIENT_TRACKER_OPTION_DEFAULTS,
  CLIENT_TRACKER_OPTION_FIELDS,
  mergeClientStageCatalog,
  normalizeAllowedClientStages,
  stageIdFromName,
  type ClientTrackerOptionKey,
  type ClientTrackerOptions,
} from '../../lib/clientTrackerOptions';
import { CLIENT_PIPELINE_STAGE_CHOICES } from '../../lib/clientReviewTypes';
import {
  getDefaultSubmitToClientMailTemplate,
  listSubmitToClientMailTemplates,
  subscribeSubmitToClientMailTemplatesChanged,
  type SubmitToClientMailTemplate,
} from '../../lib/submitToClientMailTemplate';
import { appendEmailComposeSignature, bodyWithEmailSignatureToHtml, resolveComposeSignature } from '../../lib/emailComposeSignature';

type Props = {
  isOpen: boolean;
  loading: boolean;
  error: string;
  reviewUrl: string;
  candidateNames: string[];
  jobTitle?: string;
  clientEmail?: string;
  clientName?: string;
  visibleCount: number | null;
  hiddenCount: number | null;
  matchId?: string;
  batchMatchIds?: string[];
  trackerOptions?: ClientTrackerOptions;
  allowedClientStages?: string[];
  clientStageCatalog?: string[];
  onTrackerOptionsChange?: (options: ClientTrackerOptions) => void;
  onAllowedClientStagesChange?: (stages: string[]) => void;
  onClientStageCatalogChange?: (stages: string[]) => void;
  onClose: () => void;
  onRetry: () => void;
};

export function SubmitToClientPreviewLinkModal({
  isOpen,
  loading,
  error,
  reviewUrl,
  candidateNames,
  jobTitle,
  clientEmail,
  clientName,
  visibleCount,
  hiddenCount,
  matchId,
  batchMatchIds,
  trackerOptions,
  allowedClientStages,
  clientStageCatalog,
  onTrackerOptionsChange,
  onAllowedClientStagesChange,
  onClientStageCatalogChange,
  onClose,
  onRetry,
}: Props) {
  const [mailboxStatus, setMailboxStatus] = useState<MailboxStatusResponse | null>(null);
  const [mailboxReady, setMailboxReady] = useState(false);
  const [mailHint, setMailHint] = useState('');
  const [connecting, setConnecting] = useState<MailboxComposeProvider | null>(null);
  const [savingOptions, setSavingOptions] = useState(false);
  const [optionsHint, setOptionsHint] = useState('');
  const [mailTemplates, setMailTemplates] = useState<SubmitToClientMailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [fieldsSectionOpen, setFieldsSectionOpen] = useState(true);
  const [stagesSectionOpen, setStagesSectionOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const options = trackerOptions || CLIENT_TRACKER_OPTION_DEFAULTS;
  const stageCatalog = useMemo(
    () =>
      mergeClientStageCatalog(CLIENT_PIPELINE_STAGE_CHOICES, [
        ...(clientStageCatalog || []),
        ...(allowedClientStages || []),
      ]),
    [allowedClientStages, clientStageCatalog],
  );
  const selectedStages = useMemo(
    () => normalizeAllowedClientStages(allowedClientStages, stageCatalog, true),
    [allowedClientStages, stageCatalog],
  );

  const persistPreviewOptions = async (
    nextOptions: ClientTrackerOptions,
    nextStages: string[],
    nextCatalog: Array<{ id: string; name: string }> = stageCatalog,
  ) => {
    if (!matchId || savingOptions) return;
    const catalogNames = nextCatalog.map((row) => row.name);
    onTrackerOptionsChange?.(nextOptions);
    onAllowedClientStagesChange?.(nextStages);
    onClientStageCatalogChange?.(catalogNames);
    setSavingOptions(true);
    setOptionsHint('');
    try {
      await apiUpdateClientTracker(matchId, {
        trackerOptions: nextOptions,
        allowedClientStages: nextStages,
        clientStageCatalog: catalogNames,
        batchMatchIds: batchMatchIds && batchMatchIds.length > 1 ? batchMatchIds : undefined,
      });
      setOptionsHint('Preview options saved. The client sees these on this link.');
    } catch (err: unknown) {
      onTrackerOptionsChange?.(options);
      onAllowedClientStagesChange?.(selectedStages);
      onClientStageCatalogChange?.(stageCatalog.map((row) => row.name));
      setOptionsHint(err instanceof Error ? err.message : 'Could not save preview options.');
    } finally {
      setSavingOptions(false);
    }
  };

  useEffect(() => {
    setMailHint('');
    setConnecting(null);
    setOptionsHint('');
    setFieldsSectionOpen(true);
    setStagesSectionOpen(false);
  }, [reviewUrl, isOpen]);

  useEffect(() => {
    if (options.changeStage) return;
    setStagesSectionOpen(false);
  }, [options.changeStage]);

  useEffect(() => {
    if (!isOpen) return;
    const refresh = (next?: SubmitToClientMailTemplate[]) => {
      const list = next || listSubmitToClientMailTemplates();
      setMailTemplates(list);
      setSelectedTemplateId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return getDefaultSubmitToClientMailTemplate(list).id;
      });
    };
    refresh();
    return subscribeSubmitToClientMailTemplatesChanged(refresh);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || loading) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, loading, onClose]);

  useEffect(() => {
    if (!isOpen || loading || !reviewUrl) {
      setMailboxStatus(null);
      setMailboxReady(false);
      return;
    }
    let cancelled = false;
    setMailboxReady(false);
    void apiGetMailboxStatus()
      .then((status) => {
        if (!cancelled) setMailboxStatus(status);
      })
      .catch(() => {
        if (!cancelled) setMailboxStatus(null);
      })
      .finally(() => {
        if (!cancelled) setMailboxReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, loading, reviewUrl]);

  const connectedProviders = useMemo(
    () => connectedMailboxProviders(mailboxStatus),
    [mailboxStatus],
  );

  const selectedTemplate = useMemo(() => {
    return (
      mailTemplates.find((t) => t.id === selectedTemplateId) ||
      getDefaultSubmitToClientMailTemplate(mailTemplates)
    );
  }, [mailTemplates, selectedTemplateId]);

  const mailCopy = useMemo(
    () =>
      buildSubmitToClientMailCopy({
        reviewUrl,
        candidateNames,
        jobTitle,
        clientEmail,
        clientName,
        template: selectedTemplate,
      }),
    [reviewUrl, candidateNames, jobTitle, clientEmail, clientName, selectedTemplate],
  );

  if (!isOpen) return null;

  const selectedNamesLabel = candidateNames.filter(Boolean).join(', ');

  const openCompose = (provider: MailboxComposeProvider) => {
    const accountEmail = connectedMailboxEmail(mailboxStatus, provider);
    const brand = provider === 'gmail' ? 'Gmail' : 'Outlook';

    void (async () => {
      const sig = await resolveComposeSignature(provider);
      const bodyWithSignature = appendEmailComposeSignature(mailCopy.body, sig.text);
      // Prefer connected Gmail signature HTML when present; else app signature.
      const bodyHtml = bodyWithEmailSignatureToHtml(mailCopy.body, {
        signature: sig.text,
        logoUrl: sig.logoUrl,
        providerHtml: sig.providerHtml,
      });

      const openProviderDraft = async () => {
        if (provider === 'outlook') {
          return apiCreateOutlookComposeDraft({
            to: clientEmail || undefined,
            subject: mailCopy.subject,
            body: bodyHtml,
          });
        }
        return apiCreateGmailComposeDraft({
          to: clientEmail || undefined,
          subject: mailCopy.subject,
          body: bodyHtml,
        });
      };

      setMailHint(`Creating ${brand} draft with clickable links…`);
      try {
        const draft = await openProviderDraft();
        const openUrl = String(draft?.openUrl || draft?.webLink || '').trim();
        if (openUrl) {
          const opened = openMailboxComposeTab(openUrl);
          setMailHint(
            opened
              ? `Opened ${brand} draft for ${draft?.email || accountEmail || 'your account'}. Links are clickable hyperlinks — review and send.`
              : `${brand} draft created. Allow pop-ups to open it, or open Drafts in ${brand}.`,
          );
          return;
        }
        throw new Error(`No ${brand} draft link returned`);
      } catch (err: unknown) {
        // Fallback: URL compose (plain text — Gmail/Outlook still auto-linkify bare URLs).
        if (provider === 'gmail') {
          const url = buildMailboxComposeUrl({
            provider,
            to: clientEmail,
            subject: mailCopy.subject,
            body: bodyWithSignature,
            accountEmail,
          });
          const opened = openMailboxComposeTab(url);
          setMailHint(
            opened
              ? `Opened Gmail compose (reconnect Gmail if links are not hyperlinks: ${err instanceof Error ? err.message : 'draft unavailable'}).`
              : 'Allow pop-ups to open Gmail compose.',
          );
          return;
        }

        const draftId = stashInboxComposeDraft({
          provider: 'outlook',
          to: clientEmail,
          subject: mailCopy.subject,
          body: bodyWithSignature,
        });
        const opened = openMailboxComposeTab(buildInboxComposePath('outlook', draftId));
        setMailHint(
          opened
            ? `Could not open Outlook draft (${err instanceof Error ? err.message : 'error'}). Opened Inbox compose instead — use Open in Outlook for clickable links.`
            : 'Allow pop-ups to open compose.',
        );
      }
    })();
  };

  const handleConnect = async (provider: MailboxComposeProvider) => {
    try {
      setConnecting(provider);
      await apiConnectIntegration(
        provider,
        typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined,
      );
    } catch (err: unknown) {
      setConnecting(null);
      setMailHint(err instanceof Error ? err.message : 'Could not start Gmail or Outlook connect.');
    }
  };

  const toggleTrackerOption = async (key: ClientTrackerOptionKey) => {
    const next: ClientTrackerOptions = { ...options, [key]: !options[key] };
    const nextStages =
      key === 'changeStage' && next.changeStage && selectedStages.length === 0
        ? stageCatalog.map((s) => s.name)
        : selectedStages;
    if (key === 'changeStage' && next.changeStage) {
      setStagesSectionOpen(true);
    }
    await persistPreviewOptions(next, nextStages, stageCatalog);
  };

  const toggleAllowedStage = async (stageName: string) => {
    if (!options.changeStage) return;
    const exists = selectedStages.some((name) => name.toLowerCase() === stageName.toLowerCase());
    const nextStages = exists
      ? selectedStages.filter((name) => name.toLowerCase() !== stageName.toLowerCase())
      : [...selectedStages, stageName];
    if (!nextStages.length) {
      setOptionsHint('Select at least one stage for the client.');
      return;
    }
    const ordered = stageCatalog
      .map((s) => s.name)
      .filter((name) => nextStages.some((n) => n.toLowerCase() === name.toLowerCase()));
    await persistPreviewOptions(options, ordered, stageCatalog);
  };

  const addCustomStage = async () => {
    const name = newStageName.trim();
    if (!name) return;
    if (stageCatalog.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      setOptionsHint('That stage already exists.');
      return;
    }
    const nextCatalog = [...stageCatalog, { id: stageIdFromName(name), name }];
    const nextStages = [...selectedStages, name];
    setNewStageName('');
    await persistPreviewOptions(options, nextStages, nextCatalog);
  };

  const isDefaultClientStage = useCallback((stageName: string) => {
    const lower = String(stageName || '').trim().toLowerCase();
    return CLIENT_PIPELINE_STAGE_CHOICES.some((row) => row.name.toLowerCase() === lower);
  }, []);

  const deleteCatalogStage = async (stageName: string) => {
    if (isDefaultClientStage(stageName)) {
      setOptionsHint('Default stages cannot be deleted.');
      return;
    }
    if (stageCatalog.length <= 1) {
      setOptionsHint('Keep at least one stage option.');
      return;
    }
    const nextCatalog = stageCatalog.filter(
      (row) => row.name.toLowerCase() !== stageName.toLowerCase(),
    );
    let nextStages = selectedStages.filter(
      (name) => name.toLowerCase() !== stageName.toLowerCase(),
    );
    if (!nextStages.length) {
      nextStages = [nextCatalog[0]!.name];
    }
    await persistPreviewOptions(options, nextStages, nextCatalog);
  };

  return (
    <DetailsModalShell
      size="lg"
      zIndexClass="z-[140]"
      panelClassName="!h-auto max-h-[min(94vh,960px)]"
      onBackdropClick={loading ? undefined : onClose}
      dialogTitleId="submit-client-preview-link-title"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-indigo-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              Submit to Client
            </p>
            <h2 id="submit-client-preview-link-title" className="mt-1 text-lg font-bold text-slate-900">
              Client preview link
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-5">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Generating preview link…</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Applying Submit to Client visibility for the selected candidate
                  {candidateNames.length > 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-sm font-semibold text-rose-800">Could not generate the link</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {selectedNamesLabel ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Selected
                  </p>
                  <p className="mt-1.5 text-base font-semibold leading-6 text-indigo-900">
                    {selectedNamesLabel}
                  </p>
                </div>
              ) : null}

              <div>
                <button
                  type="button"
                  onClick={() => setFieldsSectionOpen((open) => !open)}
                  aria-expanded={fieldsSectionOpen}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Select fields and actions for the client
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {fieldsSectionOpen
                        ? 'Hide options'
                        : `${CLIENT_TRACKER_OPTION_FIELDS.filter((f) => options[f.id]).length} of ${CLIENT_TRACKER_OPTION_FIELDS.length} enabled · click to configure`}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-slate-400 transition-transform ${
                      fieldsSectionOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {fieldsSectionOpen ? (
                <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {CLIENT_TRACKER_OPTION_FIELDS.map((field) => (
                    <div
                      key={field.id}
                      className={field.id === 'changeStage' ? 'sm:col-span-2' : undefined}
                    >
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={options[field.id]}
                          disabled={!matchId || savingOptions}
                          onChange={() => void toggleTrackerOption(field.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-800">
                          {field.label}
                          {field.action ? (
                            <span className="ml-1 text-[11px] font-medium text-slate-400">
                              [Action]
                            </span>
                          ) : null}
                          {field.hint && field.id !== 'changeStage' ? (
                            <span className="mt-0.5 block text-[11px] font-normal leading-4 text-slate-500">
                              {field.hint}
                            </span>
                          ) : null}
                        </span>
                      </label>
                      {field.id === 'changeStage' && options.changeStage ? (
                        <div className="mt-2 ml-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => setStagesSectionOpen((open) => !open)}
                            aria-expanded={stagesSectionOpen}
                            className="flex w-full items-center justify-between gap-3 bg-slate-50/90 px-3.5 py-2.5 text-left hover:bg-slate-100/80"
                          >
                            <span>
                              <span className="block text-xs font-semibold text-slate-800">
                                Stages shown to client
                              </span>
                              <span className="mt-0.5 block text-[11px] text-slate-500">
                                {selectedStages.length} of {stageCatalog.length} selected
                                {stagesSectionOpen
                                  ? ' · pick stages below'
                                  : ' · open to choose stages'}
                              </span>
                            </span>
                            <ChevronDown
                              size={16}
                              className={`shrink-0 text-slate-400 transition-transform ${
                                stagesSectionOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {stagesSectionOpen ? (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2">
                                <p className="text-[11px] text-slate-500">
                                  Tick stages for the client · add custom stages below · only custom
                                  stages can be deleted
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={!matchId || savingOptions}
                                    onClick={() =>
                                      void persistPreviewOptions(
                                        options,
                                        stageCatalog.map((s) => s.name),
                                        stageCatalog,
                                      )
                                    }
                                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                                  >
                                    Select all
                                  </button>
                                  <span className="text-slate-300">·</span>
                                  <button
                                    type="button"
                                    disabled={
                                      !matchId || savingOptions || selectedStages.length <= 1
                                    }
                                    onClick={() => {
                                      const first = stageCatalog[0]?.name;
                                      if (!first) return;
                                      void persistPreviewOptions(options, [first], stageCatalog);
                                    }}
                                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 p-2.5">
                                {stageCatalog.map((stage) => {
                                  const checked = selectedStages.some(
                                    (name) => name.toLowerCase() === stage.name.toLowerCase(),
                                  );
                                  const canDelete = !isDefaultClientStage(stage.name);
                                  return (
                                    <div
                                      key={stage.id}
                                      className={`group flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 transition ${
                                        checked
                                          ? 'bg-indigo-50 ring-1 ring-indigo-200'
                                          : 'bg-slate-50/80 ring-1 ring-transparent hover:bg-slate-50'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        disabled={!matchId || savingOptions}
                                        onClick={() => void toggleAllowedStage(stage.name)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
                                        title={stage.name}
                                      >
                                        <span
                                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                            checked
                                              ? 'border-indigo-600 bg-indigo-600 text-white'
                                              : 'border-slate-300 bg-white text-transparent'
                                          }`}
                                          aria-hidden
                                        >
                                          ✓
                                        </span>
                                        <span
                                          className={`truncate text-xs sm:text-sm ${
                                            checked
                                              ? 'font-semibold text-indigo-900'
                                              : 'text-slate-700'
                                          }`}
                                        >
                                          {stage.name}
                                        </span>
                                      </button>
                                      {canDelete ? (
                                        <button
                                          type="button"
                                          disabled={!matchId || savingOptions || stageCatalog.length <= 1}
                                          onClick={() => void deleteCatalogStage(stage.name)}
                                          className="shrink-0 rounded-lg p-1 text-slate-400 opacity-70 transition hover:bg-white hover:text-rose-600 group-hover:opacity-100 disabled:opacity-30"
                                          title={`Delete ${stage.name}`}
                                          aria-label={`Delete ${stage.name}`}
                                        >
                                          <Trash2 size={13} strokeWidth={2.25} />
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5">
                                <input
                                  type="text"
                                  value={newStageName}
                                  onChange={(e) => setNewStageName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void addCustomStage();
                                    }
                                  }}
                                  disabled={!matchId || savingOptions}
                                  placeholder="Add a stage name…"
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-200 focus:ring-2 disabled:opacity-60"
                                />
                                <button
                                  type="button"
                                  disabled={!matchId || savingOptions || !newStageName.trim()}
                                  onClick={() => void addCustomStage()}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  <Plus size={15} strokeWidth={2.5} />
                                  Add
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                ) : null}
                {optionsHint ? (
                  <p className="mt-2 text-xs leading-5 text-slate-600">{optionsHint}</p>
                ) : savingOptions ? (
                  <p className="mt-2 text-xs text-slate-500">Saving preview options…</p>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Preview link
                </p>
                <div className="mt-2">
                  <DrawerLinkActions url={reviewUrl} shareTitle="Client preview" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Send a mail to the client
                </p>
                {mailTemplates.length > 0 ? (
                  <label className="mt-3 block space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">Email template</span>
                    <select
                      value={selectedTemplate.id}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none ring-indigo-200 focus:ring-2"
                    >
                      {mailTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] leading-4 text-slate-500">
                      Subject: {mailCopy.subject || '—'}
                    </p>
                  </label>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!mailboxReady ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-500">
                      <Loader2 size={15} className="animate-spin" />
                      Checking mail accounts…
                    </span>
                  ) : connectedProviders.length ? (
                    <>
                      {connectedProviders.includes('gmail') ? (
                        <button
                          type="button"
                          onClick={() => openCompose('gmail')}
                          className="inline-flex flex-col items-start gap-0.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Mail size={15} strokeWidth={2.25} />
                            Gmail
                          </span>
                          {connectedMailboxEmail(mailboxStatus, 'gmail') ? (
                            <span className="text-[10px] font-medium text-rose-100">
                              {connectedMailboxEmail(mailboxStatus, 'gmail')}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                      {connectedProviders.includes('outlook') ? (
                        <button
                          type="button"
                          onClick={() => openCompose('outlook')}
                          className="inline-flex flex-col items-start gap-0.5 rounded-xl bg-sky-600 px-3.5 py-2.5 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Mail size={15} strokeWidth={2.25} />
                            Outlook
                          </span>
                          {connectedMailboxEmail(mailboxStatus, 'outlook') ? (
                            <span className="text-[10px] font-medium text-sky-100">
                              {connectedMailboxEmail(mailboxStatus, 'outlook')}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Connect Gmail or Outlook to open compose.</p>
                  )}
                </div>

                {mailHint ? (
                  <p className="mt-2 text-xs leading-5 text-slate-600">{mailHint}</p>
                ) : null}

                {mailboxReady && !connectedProviders.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConnect('gmail')}
                      disabled={connecting !== null}
                      className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {connecting === 'gmail' ? 'Connecting…' : 'Connect Gmail'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConnect('outlook')}
                      disabled={connecting !== null}
                      className="inline-flex items-center rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                    >
                      {connecting === 'outlook' ? 'Connecting…' : 'Connect Outlook'}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </DetailsModalShell>
  );
}
