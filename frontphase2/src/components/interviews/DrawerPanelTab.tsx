import React from 'react';
import { Plus } from 'lucide-react';
import type { InterviewPanelMember } from '../../types/interview.types';

interface DrawerPanelTabProps {
  panel: InterviewPanelMember[];
  onOpenPanelAssignment: () => void;
}

export function DrawerPanelTab({ panel, onOpenPanelAssignment }: DrawerPanelTabProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs uppercase tracking-[0.14em] text-[#6B7280]">
            <tr>
              <th className="px-4 py-3">Avatar</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {panel.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-4">
                  <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-[#2563EB]">
                    {member.avatar}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-[#111827]">{member.name}</td>
                <td className="px-4 py-4 text-sm text-[#4B5563]">{member.role}</td>
                <td className="px-4 py-4 text-sm text-[#4B5563]">{member.department}</td>
                <td className="px-4 py-4 text-sm text-[#4B5563]">{member.email}</td>
                <td className="px-4 py-4 text-sm text-[#4B5563]">{member.phone}</td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={onOpenPanelAssignment}
                    className="text-sm font-semibold text-[#2563EB]"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#E5E7EB] p-4">
        <button
          type="button"
          onClick={onOpenPanelAssignment}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]"
        >
          <Plus className="size-4" />
          Add Interviewer
        </button>
      </div>
    </div>
  );
}
