'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { TaskForm } from './TaskForm';
import type { TaskFormValues, TaskRelatedTo } from '../app/Task&Activites/types';

const INITIAL_VALUES: TaskFormValues = {
  title: '',
  description: '',
  relatedTo: '',
  relatedEntityId: '',
  assigneeId: '',
  priority: '',
  dueDate: '',
  reminder: '',
  attachmentNames: '',
  notifyAssignee: true,
};

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Prefill "Related To" when opened from a specific module */
  initialRelatedTo?: TaskRelatedTo;
  /** Prefill related entity id (e.g. client id, job id, candidate id) */
  initialRelatedEntityId?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  initialRelatedTo,
  initialRelatedEntityId,
}: CreateTaskModalProps) {
  const [values, setValues] = useState<TaskFormValues>(INITIAL_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues((prev) => ({
        ...INITIAL_VALUES,
        relatedTo: initialRelatedTo ?? '',
        relatedEntityId: initialRelatedEntityId ?? '',
      }));
    }
  }, [isOpen, initialRelatedTo, initialRelatedEntityId]);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSuccess?.();
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <motion.div
        key="drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}
        className="fixed right-0 top-0 z-50 h-full w-full sm:max-w-[760px]"
      >
        <div
          className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-slate-200 p-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create New Task</h2>
              <p className="text-xs text-slate-500 mt-0.5">Add a follow-up or operational task</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <TaskForm
              mode="create"
              values={values}
              onChange={setValues}
              onSubmit={handleSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
