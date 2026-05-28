'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { SmartSearchExample, SmartSearchKeywordChip } from '../lib/smart-search/types';

export function useSmartSearch<TParsed extends { keywords: SmartSearchKeywordChip[]; summary: string }>(config: {
  parsePrompt: (prompt: string) => TParsed;
  applyParsed: (parsed: TParsed) => void;
  onRemoveKeyword?: (removed: SmartSearchKeywordChip, remaining: SmartSearchKeywordChip[]) => void;
  examples: readonly SmartSearchExample[];
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [activeKeywords, setActiveKeywords] = useState<SmartSearchKeywordChip[]>([]);

  const previewKeywords = useMemo(
    () => (prompt.trim() ? config.parsePrompt(prompt).keywords : []),
    [prompt, config],
  );

  const applyPrompt = useCallback(
    (text: string, options?: { toastOnSuccess?: boolean }) => {
      const parsed = config.parsePrompt(text);
      if (!text.trim()) {
        toast.message(parsed.summary);
        return;
      }
      config.applyParsed(parsed);
      setActiveKeywords(parsed.keywords);
      if (options?.toastOnSuccess !== false) {
        toast.success(parsed.summary);
      }
    },
    [config],
  );

  const handleApply = useCallback(() => {
    applyPrompt(prompt);
  }, [applyPrompt, prompt]);

  const handleExample = useCallback(
    (query: string) => {
      setPrompt(query);
      applyPrompt(query, { toastOnSuccess: true });
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
    applyPrompt,
    handleApply,
    handleExample,
    removeKeyword,
    clearSmartSearch,
    activeChips,
    examples: config.examples,
  };
}
