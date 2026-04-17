'use client';

import React, { useState, useMemo } from 'react';
import { Sparkles, CheckSquare, X, Users, Calendar, Briefcase, FileCheck } from 'lucide-react';
import type { AITaskSuggestion, AITaskSuggestionCategory, AITaskSuggestionPriority } from '../app/Task&Activites/types';

export interface AITaskSuggestionsPanelProps {
  suggestions: AITaskSuggestion[];
  onDismiss?: (id: string) => void;
  onCreateTask?: (suggestion: AITaskSuggestion) => void;
  className?: string;
}

const CATEGORY_FILTERS: { id: AITaskSuggestionCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Candidate', label: 'Candidate' },
  { id: 'Interview', label: 'Interview' },
  { id: 'Client', label: 'Client' },
  { id: 'Offer', label: 'Offer' },
];

const PRIORITY_STYLES: Record<AITaskSuggestionPriority, string> = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CATEGORY_ICONS: Record<Exclude<AITaskSuggestionCategory, 'all'>, React.ComponentType<{ size?: number; className?: string }>> = {
  Candidate: Users as React.ComponentType<{ size?: number; className?: string }>,
  Interview: Calendar as React.ComponentType<{ size?: number; className?: string }>,
  Client: Briefcase as React.ComponentType<{ size?: number; className?: string }>,
  Offer: FileCheck as React.ComponentType<{ size?: number; className?: string }>,
};

function SuggestionCard({
  suggestion,
  onDismiss,
  onCreateTask,
}: {
  suggestion: AITaskSuggestion;
  onDismiss?: (id: string) => void;
  onCreateTask?: (suggestion: AITaskSuggestion) => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[suggestion.category];
  const priorityStyle = PRIORITY_STYLES[suggestion.priority];

  return (
    <div className="flex gap-4 items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
        <Sparkles size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-bold text-slate-900">{suggestion.title}</h4>
          <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${priorityStyle}`}>
            {suggestion.priority}
          </span>
        </div>
        <p className="text-xs text-slate-600 mb-2">{suggestion.context}</p>
        <div className="flex items-center gap-1.5 mb-3">
          {CategoryIcon && <CategoryIcon size={12} className="text-slate-400" />}
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Suggested action</span>
        </div>
        <p className="text-xs text-slate-700 font-medium mb-4">{suggestion.suggestedAction}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCreateTask?.(suggestion)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            <CheckSquare size={14} />
            Create Task
          </button>
          <button
            type="button"
            onClick={() => onDismiss?.(suggestion.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
          >
            <X size={14} />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function AITaskSuggestionsPanel({
  suggestions: initialSuggestions,
  onDismiss,
  onCreateTask,
  className = '',
}: AITaskSuggestionsPanelProps) {
  const [filter, setFilter] = useState<AITaskSuggestionCategory>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleSuggestions = useMemo(
    () => initialSuggestions.filter((s) => !dismissedIds.has(s.id)),
    [initialSuggestions, dismissedIds]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return visibleSuggestions;
    return visibleSuggestions.filter((s) => s.category === filter);
  }, [visibleSuggestions, filter]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  if (visibleSuggestions.length === 0) return null;

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 shadow-sm overflow-hidden ${className}`}
    >
      <div className="p-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Sparkles size={18} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-indigo-900">AI Suggestions</h3>
            <p className="text-xs text-slate-600 mt-0.5">Smart recommendations to keep recruitment moving</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {CATEGORY_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === opt.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No {filter === 'all' ? '' : filter} suggestions.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onDismiss={handleDismiss}
                onCreateTask={onCreateTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
