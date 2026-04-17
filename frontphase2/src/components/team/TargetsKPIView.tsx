'use client';

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Award, Zap, Plus } from 'lucide-react';
import { getTeamMembers } from '../../lib/api/teamApi';
import { ImageWithFallback } from '../ImageWithFallback';
import type { TeamMember, TeamTarget } from '../../types/team';

export const TargetsKPIView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await getTeamMembers({ status: 'ACTIVE', limit: 100 });
      setMembers(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (member: TeamMember) => {
    const first = member.firstName?.[0] || member.email[0];
    const last = member.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  // Calculate leaderboards
  const topPlacements = [...members]
    .sort((a, b) => (b.placements || 0) - (a.placements || 0))
    .slice(0, 10);

  const topRevenue = [...members]
    .sort((a, b) => (b.revenueGenerated || 0) - (a.revenueGenerated || 0))
    .slice(0, 10);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="inline-block size-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-50">
            <Target className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Placements</p>
            <p className="text-lg font-bold text-slate-900">
              {members.reduce((sum, m) => sum + (m.placements || 0), 0)}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-50">
            <Zap className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Revenue</p>
            <p className="text-lg font-bold text-slate-900">
              ${members.reduce((sum, m) => sum + (m.revenueGenerated || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50">
            <TrendingUp className="size-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Active Members</p>
            <p className="text-lg font-bold text-slate-900">
              {members.filter((m) => m.status === 'ACTIVE').length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-50">
            <Award className="size-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Top Performer</p>
            <p className="text-lg font-bold text-slate-900">
              {topPlacements[0] ? `${topPlacements[0].firstName} ${topPlacements[0].lastName}` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Set Targets Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Set Targets</h3>
            <p className="text-sm text-slate-500 mt-1">Manage performance targets for team members</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
            <Plus className="size-4" />
            Set Target
          </button>
        </div>
        <div className="space-y-4">
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select team member...</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
          {selectedMember && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600">Target management form would go here</p>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Placers */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Top Placers</h3>
            <p className="text-sm text-slate-500 mt-1">Ranked by placements this month</p>
          </div>
          <div className="divide-y divide-slate-100">
            {topPlacements.length > 0 ? (
              topPlacements.map((member, index) => (
                <div key={member.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className="flex items-center justify-center size-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-sm">
                    {getInitials(member)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{member.placements || 0} placements</p>
                  </div>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${Math.min(100, ((member.placements || 0) / 20) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* Top Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Top Revenue</h3>
            <p className="text-sm text-slate-500 mt-1">Ranked by revenue this month</p>
          </div>
          <div className="divide-y divide-slate-100">
            {topRevenue.length > 0 ? (
              topRevenue.map((member, index) => (
                <div key={member.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className="flex items-center justify-center size-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-sm">
                    {getInitials(member)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-slate-500">
                      ${(member.revenueGenerated || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{
                        width: `${Math.min(100, ((member.revenueGenerated || 0) / 100000) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
