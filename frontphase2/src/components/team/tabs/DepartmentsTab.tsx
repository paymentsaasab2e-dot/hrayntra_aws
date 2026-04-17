'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getDepartments, deleteDepartment } from '../../../lib/api/teamApi';
import type { Department } from '../../../types/team';
import { AddDepartmentDrawer } from '../AddDepartmentDrawer';
import { EditDepartmentDrawer } from '../EditDepartmentDrawer';
import { DepartmentMembersDrawer } from '../DepartmentMembersDrawer';

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
    systemRole?: {
      color: string;
    };
  }>;
  _count?: {
    users: number;
  };
}

export const DepartmentsTab: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentWithMembers | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDepartments();
      setDepartments(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (dept: DepartmentWithMembers) => {
    if (deleteConfirm !== dept.id) {
      setDeleteConfirm(dept.id);
      return;
    }

    try {
      await deleteDepartment(dept.id);
      toast.success('Department deleted');
      setDeleteConfirm(null);
      fetchData();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to delete department';
      if (errorMessage.includes('member') || errorMessage.includes('assigned')) {
        toast.error(errorMessage);
      } else {
        toast.error(errorMessage);
      }
      setDeleteConfirm(null);
    }
  };

  const handleMembersClick = (dept: DepartmentWithMembers) => {
    setSelectedDepartment(dept);
    setShowMembersDrawer(true);
  };

  // Wire up the Add Department button from parent
  useEffect(() => {
    (window as any).openAddDepartmentDrawer = () => {
      setShowAddDrawer(true);
    };
    return () => {
      delete (window as any).openAddDepartmentDrawer;
    };
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Departments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 mb-4">No departments yet. Create your first department.</p>
            <button
              onClick={() => setShowAddDrawer(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Department
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Department Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Members</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Member Avatars</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {departments.map((dept) => {
                  const memberCount = dept._count?.users || 0;
                  const previewMembers = dept.users || [];
                  const remainingCount = memberCount - previewMembers.length;

                  return (
                    <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-900">{dept.name}</div>
                          {dept.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{dept.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleMembersClick(dept)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer"
                        >
                          <Users size={12} />
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {previewMembers.map((member) => (
                            <div
                              key={member.id}
                              className={`size-6 rounded-full flex items-center justify-center text-xs font-semibold ${roleColorMap[member.systemRole?.color?.toLowerCase() || 'gray'] || 'bg-gray-100 text-gray-600'}`}
                              title={`${member.firstName} ${member.lastName}`}
                            >
                              {getInitials(member.firstName, member.lastName)}
                            </div>
                          ))}
                          {remainingCount > 0 && (
                            <span className="text-xs text-slate-500 font-medium">+{remainingCount} more</span>
                          )}
                          {memberCount === 0 && (
                            <span className="text-xs text-slate-400">No members</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDate(dept.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedDepartment(dept);
                              setShowEditDrawer(true);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          {deleteConfirm === dept.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">Delete {dept.name}?</span>
                              <button
                                onClick={() => handleDelete(dept)}
                                className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDelete(dept)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers */}
      <AddDepartmentDrawer
        isOpen={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onSuccess={() => {
          setShowAddDrawer(false);
          fetchData();
        }}
      />

      {selectedDepartment && (
        <>
          <EditDepartmentDrawer
            isOpen={showEditDrawer}
            department={selectedDepartment}
            onClose={() => {
              setShowEditDrawer(false);
              setSelectedDepartment(null);
            }}
            onSuccess={() => {
              setShowEditDrawer(false);
              setSelectedDepartment(null);
              fetchData();
            }}
          />

          <DepartmentMembersDrawer
            isOpen={showMembersDrawer}
            department={selectedDepartment}
            onClose={() => {
              setShowMembersDrawer(false);
              setSelectedDepartment(null);
            }}
            onMemberMove={() => {
              fetchData();
            }}
          />
        </>
      )}
    </div>
  );
};
