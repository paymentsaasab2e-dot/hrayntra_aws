'use client';

import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getDepartmentById, getDepartments, updateTeamMember } from '../../lib/api/teamApi';
import type { Department, TeamMember } from '../../types/team';

interface DepartmentMembersDrawerProps {
  isOpen: boolean;
  department: Department;
  onClose: () => void;
  onMemberMove: () => void;
}

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

interface DepartmentWithMembers extends Department {
  users?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
    status: string;
    role?: {
      id: string;
      roleName: string;
      color: string;
    };
  }>;
}

export const DepartmentMembersDrawer: React.FC<DepartmentMembersDrawerProps> = ({
  isOpen,
  department,
  onClose,
  onMemberMove,
}) => {
  const [departmentData, setDepartmentData] = useState<DepartmentWithMembers | null>(null);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, department.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, deptsRes] = await Promise.all([
        getDepartmentById(department.id),
        getDepartments(),
      ]);

      setDepartmentData(deptRes.data);
      setAllDepartments(deptsRes.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load department members');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveMember = async (memberId: string, newDeptId: string) => {
    if (newDeptId === department.id) return; // Same department, no change

    setUpdatingMember(memberId);
    try {
      await updateTeamMember(memberId, { departmentId: newDeptId });
      const member = departmentData?.users?.find((u) => u.id === memberId);
      const memberName = member ? `${member.firstName} ${member.lastName}` : 'Member';
      const newDept = allDepartments.find((d) => d.id === newDeptId);
      const newDeptName = newDept?.name || 'another department';
      
      toast.success(`Moved ${memberName} to ${newDeptName}`);
      
      // Remove member from current list
      setDepartmentData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          users: prev.users?.filter((u) => u.id !== memberId),
        };
      });
      
      onMemberMove(); // Refresh departments list
    } catch (error: any) {
      toast.error(error.message || 'Failed to move member');
    } finally {
      setUpdatingMember(null);
    }
  };

  // Filter members by search
  const filteredMembers = departmentData?.users?.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.firstName?.toLowerCase().includes(query) ||
      member.lastName?.toLowerCase().includes(query) ||
      member.designation?.toLowerCase().includes(query)
    );
  }) || [];

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full max-w-xl w-full bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{department.name}</h2>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} in this department
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="size-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : !departmentData || !departmentData.users || departmentData.users.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">No members in this department yet. Add members from the Members tab.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMembers.map((member) => {
                    const currentDeptId = department.id;
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className={`size-8 rounded-full flex items-center justify-center font-semibold text-sm ${roleColorMap[member.role?.color?.toLowerCase() || 'gray'] || 'bg-gray-100 text-gray-600'}`}>
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">
                            {member.firstName} {member.lastName}
                          </div>
                          {member.designation && (
                            <div className="text-xs text-slate-500">{member.designation}</div>
                          )}
                        </div>
                        <div>
                          {member.role && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${roleColorMap[member.role.color?.toLowerCase() || 'gray'] || 'bg-gray-100 text-gray-600'}`}>
                              {member.role.roleName}
                            </span>
                          )}
                        </div>
                        <div>
                          {member.status === 'ACTIVE' ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Inactive</span>
                          )}
                        </div>
                        <div className="min-w-[200px]">
                          <select
                            value={currentDeptId}
                            onChange={(e) => handleMoveMember(member.id, e.target.value)}
                            disabled={updatingMember === member.id}
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {allDepartments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                          {updatingMember === member.id && (
                            <div className="mt-1 text-xs text-slate-500">Moving...</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
