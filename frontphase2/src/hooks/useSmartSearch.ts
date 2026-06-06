'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { SmartSearchExample, SmartSearchKeywordChip } from '../lib/smart-search/types';

export function useSmartSearch<TParsed extends { keywords: SmartSearchKeywordChip[]; summary: string }>(config: {
  parsePrompt: (prompt: string) => TParsed;
  parsePromptWithAi?: (prompt: string) => Promise<TParsed | null>;
  applyParsed: (parsed: TParsed) => void;
  onRemoveKeyword?: (removed: SmartSearchKeywordChip, remaining: SmartSearchKeywordChip[]) => void;
  examples: readonly SmartSearchExample[];
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [activeKeywords, setActiveKeywords] = useState<SmartSearchKeywordChip[]>([]);
  const [applying, setApplying] = useState(false);

  const previewKeywords = useMemo(
    () => (prompt.trim() ? config.parsePrompt(prompt).keywords : []),
    [prompt, config],
  );

  const applyPrompt = useCallback(
    async (text: string, options?: { toastOnSuccess?: boolean }) => {
      const trimmed = text.trim();
      const emptyParsed = config.parsePrompt(text);
      if (!trimmed) {
        toast.message(emptyParsed.summary);
        return;
      }

      setApplying(true);
      try {
        let parsed = emptyParsed;
        let usedAi = false;

        if (config.parsePromptWithAi) {
          const aiParsed = await config.parsePromptWithAi(trimmed);
          if (aiParsed) {
            parsed = aiParsed;
            usedAi = true;
          }
        }

        config.applyParsed(parsed);
        setActiveKeywords(parsed.keywords);
        if (options?.toastOnSuccess !== false) {
          const aiParsed = parsed as {
            tenantDatabase?: { totalLeads?: number; leadsLoadedForAi?: number };
            matchingLeadIds?: string[];
          };
          const matched = aiParsed.matchingLeadIds?.length ?? 0;
          const tenantHint =
            usedAi && matched > 0
              ? ` — ${matched} lead${matched === 1 ? '' : 's'} selected from your database`
              : usedAi && aiParsed.tenantDatabase?.totalLeads != null
                ? ` — AI read ${aiParsed.tenantDatabase.leadsLoadedForAi ?? aiParsed.tenantDatabase.totalLeads} rows from your tenant database`
                : '';
          toast.success(usedAi ? `AI: ${parsed.summary}${tenantHint}` : parsed.summary);
        }
      } catch {
        const parsed = config.parsePrompt(trimmed);
        config.applyParsed(parsed);
        setActiveKeywords(parsed.keywords);
        toast.message('Smart search used local parsing (AI unavailable)');
      } finally {
        setApplying(false);
      }
    },
    [config],
  );

  const handleApply = useCallback(() => {
    void applyPrompt(prompt);
  }, [applyPrompt, prompt]);

  const handleExample = useCallback(
    (query: string) => {
      setPrompt(query);
      void applyPrompt(query, { toastOnSuccess: true });
    },
    [applyPrompt],
  );

  const removeKeyword = useCallback(
    (chipId: string) => {
      setActiveKeywords((previous) => {
        const removed = previous.find((item) => item.id === chipId);
        const next = previous.filter((item) => item.id !== chipId);
        if (removed && config.onRemoveKeyword) {
          config.onRemoveKeyword(removed, next);
        }
        return next;
      });
    },
    [config],
  );

  const clearSmartSearch = useCallback(() => {
    setPrompt('');
    setActiveKeywords([]);
  }, []);

  const activeChips = useMemo(
    () =>
      activeKeywords.map((keyword) => ({
        id: keyword.id,
        label: keyword.label,
        kind: keyword.kind,
        onRemove: () => removeKeyword(keyword.id),
      })),
    [activeKeywords, removeKeyword],
  );

  return {
    open,
    setOpen,
    prompt,
    setPrompt,
    activeKeywords,
    setActiveKeywords,
    previewKeywords,
    applying,
    applyPrompt,
    handleApply,
    handleExample,
    removeKeyword,
    clearSmartSearch,
    activeChips,
    examples: config.examples,
  };
}
