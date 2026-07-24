'use client';

import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateDepartment } from '../../lib/api/teamApi';
import type { Department } from '../../types/team';
import { DrawerFormShell, DrawerFormCancelButton } from '../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../drawers/drawerFormUi';

interface EditDepartmentDrawerProps {
  isOpen: boolean;
  department: Department;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditDepartmentDrawer: React.FC<EditDepartmentDrawerProps> = ({
  isOpen,
  department,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: department.name,
    description: department.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: department.name,
        description: department.description || '',
      });
      setErrors({});
    }
  }, [isOpen, department]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Department name is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await updateDepartment(department.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success('Department updated');
      onClose();
      onSuccess();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update department';
      if (errorMessage.toLowerCase().includes('name') || errorMessage.toLowerCase().includes('already')) {
        setErrors({ name: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Department"
      subtitle="Update department name and description"
      headerIcon={Building2}
      footer={
        <>
          <DrawerFormCancelButton />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Department Details" subtitle="Name and description" icon={Building2} accent="blue">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Department Name" icon={Building2} iconClassName="text-blue-500" required />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`${DRAWER_FORM_INPUT} ${errors.name ? 'border-red-300' : ''}`}
            />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
          </div>
          <div>
            <DrawerFieldLabel label="Description" />
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className={`${DRAWER_FORM_INPUT} resize-none`}
            />
          </div>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
};
