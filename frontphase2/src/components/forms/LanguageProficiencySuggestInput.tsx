'use client';

import React, { useCallback } from 'react';
import { apiSuggestLanguages, apiSuggestProficiencies } from '../../lib/api';
import {
  buildLocalLanguageSuggestions,
  buildLocalProficiencySuggestions,
} from '../../constants/languageOptions';
import { SuggestTypeahead } from './SuggestTypeahead';

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export interface LanguageSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  jobTitle?: string;
  excludeLanguages?: string[];
  className?: string;
}

export function LanguageSuggestInput({
  value,
  onChange,
  disabled = false,
  jobTitle = '',
  excludeLanguages = [],
  className = '',
}: LanguageSuggestInputProps) {
  const fetchSuggestions = useCallback(
    async (query: string) => {
      const excluded = excludeLanguages.filter(
        (lang) => lang.toLowerCase() !== value.trim().toLowerCase(),
      );
      try {
        const res = await apiSuggestLanguages({
          q: query,
          selected: excluded,
          limit: 8,
          jobTitle: jobTitle.trim() || undefined,
        });
        const suggestions = res.data?.suggestions ?? [];
        if (suggestions.length > 0) {
          return {
            suggestions,
            aiEnabled: res.data?.aiEnabled,
          };
        }
      } catch {
        /* fall back to local catalog */
      }
      return {
        suggestions: buildLocalLanguageSuggestions(query, excluded, 8),
        aiEnabled: false,
      };
    },
    [excludeLanguages, jobTitle, value],
  );

  return (
    <SuggestTypeahead
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Language (e.g. English, Hindi)"
      className={className}
      inputClassName={inputClass}
      fetchSuggestions={fetchSuggestions}
      emptyHint="Type a language name (e.g. eng, hindi, spanish)"
      typeHint="Languages"
    />
  );
}

export interface ProficiencySuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  language?: string;
  className?: string;
}

export function ProficiencySuggestInput({
  value,
  onChange,
  disabled = false,
  language = '',
  className = '',
}: ProficiencySuggestInputProps) {
  const fetchSuggestions = useCallback(
    async (query: string) => {
      try {
        const res = await apiSuggestProficiencies({
          q: query,
          limit: 8,
          language: language.trim() || undefined,
        });
        const suggestions = res.data?.suggestions ?? [];
        if (suggestions.length > 0) {
          return {
            suggestions,
            aiEnabled: res.data?.aiEnabled,
          };
        }
      } catch {
        /* fall back to local catalog */
      }
      return {
        suggestions: buildLocalProficiencySuggestions(query, [], 8),
        aiEnabled: false,
      };
    },
    [language],
  );

  return (
    <SuggestTypeahead
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Proficiency (e.g. Fluent, Professional)"
      className={className}
      inputClassName={inputClass}
      fetchSuggestions={fetchSuggestions}
      emptyHint="Type a proficiency level (e.g. fluent, native, B2)"
      typeHint="Proficiency levels"
    />
  );
}
