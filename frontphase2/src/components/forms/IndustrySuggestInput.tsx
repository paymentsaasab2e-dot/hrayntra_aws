'use client';

import React, { useCallback } from 'react';
import { Briefcase, type LucideIcon } from 'lucide-react';
import { apiSuggestIndustries } from '../../lib/api';
import { SuggestTypeahead } from './SuggestTypeahead';
import { ADD_LEAD_INPUT_WITH_ICON } from '../drawers/drawerFormUi';

export interface IndustrySuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  companyName?: string;
  className?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  placeholder?: string;
}

/** Single industry field with OpenAI-backed suggestions (via `/settings/org/industries/suggest`). */
export function IndustrySuggestInput({
  value,
  onChange,
  disabled = false,
  companyName = '',
  className = '',
  icon: Icon = Briefcase,
  iconClassName = 'text-emerald-400',
  placeholder = 'e.g. Technology',
}: IndustrySuggestInputProps) {
  const fetchSuggestions = useCallback(
    async (query: string) => {
      try {
        const res = await apiSuggestIndustries({
          q: query,
          limit: 8,
          companyName: companyName.trim() || undefined,
        });
        return {
          suggestions: res.data?.suggestions ?? [],
          aiEnabled: res.data?.aiEnabled,
        };
      } catch {
        return { suggestions: [], aiEnabled: false };
      }
    },
    [companyName],
  );

  return (
    <div className="relative">
      <Icon
        size={16}
        className={`pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 ${iconClassName}`}
      />
      <SuggestTypeahead
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        inputClassName={ADD_LEAD_INPUT_WITH_ICON}
        fetchSuggestions={fetchSuggestions}
        emptyHint="Type an industry (e.g. tech, healthcare, finance)"
        typeHint="Industries"
      />
    </div>
  );
}
