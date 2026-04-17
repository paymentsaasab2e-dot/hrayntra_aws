'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getLoginHistory } from '../../lib/api/teamApi';
import type { LoginHistory } from '../../types/team';

interface LoginHistoryDrawerProps {
  isOpen: boolean;
  memberId: string;
  onClose: () => void;
}

export const LoginHistoryDrawer: React.FC<LoginHistoryDrawerProps> = ({ isOpen, memberId, onClose }) => {
  const [history, setHistory] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && memberId) {
      loadHistory();
    }
  }, [isOpen, memberId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await getLoginHistory(memberId);
      setHistory(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load login history');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESS':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">SUCCESS</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">FAILED</span>;
      case 'LOCKED':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">LOCKED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{outcome}</span>;
    }
  };

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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[80]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full max-w-md w-full bg-white shadow-2xl z-[90] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Login History</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="size-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">No login history yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          IP Address
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Device
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Outcome
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {history.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {formatDateTime(entry.timestamp)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                            {entry.ipAddress || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <div className="max-w-[200px] truncate" title={entry.device || 'Unknown'}>
                              {entry.device || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getOutcomeBadge(entry.outcome)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
