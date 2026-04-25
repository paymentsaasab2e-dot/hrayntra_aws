'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Trophy, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { getTeamMembers, getTargets, saveTargets } from '../../../lib/api/teamApi';
import type { TeamMember, TeamTarget } from '../../../types/team';

// Color mapping for role colors
const roleColorMap: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
};

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

const asSafeString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const normalizeMembersPayload = (payload: unknown): TeamMember[] => {
  if (Array.isArray(payload)) return payload as TeamMember[];
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data as TeamMember[];
    if (Array.isArray(obj.items)) return obj.items as TeamMember[];
  }
  return [];
};

export const TargetsTab: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [targets, setTargets] = useState<Record<string, number>>({
    candidate_submissions: 0,
    interviews_scheduled: 0,
    placements: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-targets-member-search]')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await getTeamMembers({ status: 'ACTIVE' });
      setMembers(normalizeMembersPayload(res.data));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const loadMemberTargets = async (memberId: string) => {
    try {
      const res = await getTargets(memberId);
      const existingTargets: Record<string, number> = {
        candidate_submissions: 0,
        interviews_scheduled: 0,
        placements: 0,
        revenue: 0,
      };
      
      (res.data || []).forEach((target: TeamTarget) => {
        if (target.period === 'monthly') {
          existingTargets[target.targetType] = target.targetValue;
        }
      });
      
      setTargets(existingTargets);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load targets');
      // Reset to defaults if error
      setTargets({
        candidate_submissions: 0,
        interviews_scheduled: 0,
        placements: 0,
        revenue: 0,
      });
    }
  };

  const handleMemberSelect = (member: TeamMember) => {
    setSelectedMember(member);
    setSearchQuery(`${asSafeString(member.firstName)} ${asSafeString(member.lastName)}`.trim());
    setShowSuggestions(false);
    loadMemberTargets(member.id);
  };

  const handleTargetChange = (targetType: string, value: number) => {
    setTargets((prev) => ({ ...prev, [targetType]: value }));
  };

  const handleSave = async () => {
    if (!selectedMember) return;

    setSaving(true);
    try {
      await saveTargets(selectedMember.id, [
        { targetType: 'candidate_submissions', targetValue: targets.candidate_submissions, period: 'monthly' },
        { targetType: 'interviews_scheduled', targetValue: targets.interviews_scheduled, period: 'monthly' },
        { targetType: 'placements', targetValue: targets.placements, period: 'monthly' },
        { targetType: 'revenue', targetValue: targets.revenue, period: 'monthly' },
      ]);

      toast.success(`Targets saved for ${selectedMember.firstName} ${selectedMember.lastName}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save targets');
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const firstName = asSafeString(member?.firstName).toLowerCase();
    const lastName = asSafeString(member?.lastName).toLowerCase();
    const email = asSafeString(member?.email).toLowerCase();
    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      email.includes(query)
    );
  });

  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filteredMembers.slice(0, 6);
    return filteredMembers.slice(0, 8);
  }, [filteredMembers, searchQuery]);

  // Sort members for leaderboard (placeholder values)
  const sortedByPlacements = [...members].sort((a, b) => {
    // Placeholder: would sort by actual placement count
    return 0;
  });

  const sortedByRevenue = [...members].sort((a, b) => {
    // Placeholder: would sort by actual revenue
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Section 1: Set Targets */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Set Targets</h2>

        {/* Member Selector */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select Member</label>
          <div className="relative" data-targets-member-search>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setSelectedMember(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search a team member..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />

            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggestions</span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(false)}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close suggestions"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {searchSuggestions.map((member) => {
                    const fullName = `${asSafeString(member.firstName)} ${asSafeString(member.lastName)}`.trim();
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleMemberSelect(member)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{fullName}</div>
                          <div className="truncate text-xs text-slate-500">
                            {asSafeString(member.role?.roleName) || 'No Role'} • {asSafeString(member.email)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                          {asSafeString(member.department?.name) || 'No Dept'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {searchQuery && !searchSuggestions.length && (
            <p className="mt-2 text-xs text-slate-500">No matching team members found.</p>
          )}
        </div>

        {/* Target Form */}
        {selectedMember && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Candidate submissions (per month)</label>
                <input
                  type="number"
                  min="0"
                  value={targets.candidate_submissions}
                  onChange={(e) => handleTargetChange('candidate_submissions', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Interviews scheduled (per month)</label>
                <input
                  type="number"
                  min="0"
                  value={targets.interviews_scheduled}
                  onChange={(e) => handleTargetChange('interviews_scheduled', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Placements (per month)</label>
                <input
                  type="number"
                  min="0"
                  value={targets.placements}
                  onChange={(e) => handleTargetChange('placements', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Revenue target (per month)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={targets.revenue}
                    onChange={(e) => handleTargetChange('revenue', Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Targets'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Team Leaderboard</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Placers */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="size-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900">Top Placers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Rank</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Member</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Placements</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Target</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedByPlacements.slice(0, 5).map((member, index) => (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">#{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold ${roleColorMap[asSafeString(member.role?.color).toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                            {getInitials(asSafeString(member.firstName), asSafeString(member.lastName))}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{asSafeString(member.firstName)} {asSafeString(member.lastName)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">0</td>
                      <td className="px-4 py-3 text-sm text-slate-600">—</td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2">Placement data will populate once the Placements module is connected.</p>
          </div>

          {/* Top Revenue */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-5 text-green-500" />
              <h3 className="font-semibold text-slate-900">Top Revenue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Rank</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Member</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Revenue</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Target</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedByRevenue.slice(0, 5).map((member, index) => (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">#{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold ${roleColorMap[asSafeString(member.role?.color).toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                            {getInitials(asSafeString(member.firstName), asSafeString(member.lastName))}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{asSafeString(member.firstName)} {asSafeString(member.lastName)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">$0</td>
                      <td className="px-4 py-3 text-sm text-slate-600">—</td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '0%' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-2">Revenue data will populate once the Placements module is connected.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
