'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Key, Copy, Check, AlertCircle } from 'lucide-react';
import { generateCredentials, getTeamMemberById } from '../../lib/api/teamApi';
import { PortalAccessPreview } from './PortalAccessPreview';
import { toast } from 'sonner';
import type { SystemRole, TeamMember } from '../../types/team';

interface GenerateCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  onSuccess?: () => void;
}

export const GenerateCredentialsModal: React.FC<GenerateCredentialsModalProps> = ({
  isOpen,
  onClose,
  memberId,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [credentials, setCredentials] = useState<{ loginId: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState<{ loginId: boolean; password: boolean }>({
    loginId: false,
    password: false,
  });
  const [sendEmail, setSendEmail] = useState(true);
  const [loginIdOption, setLoginIdOption] = useState<'auto' | 'email' | 'custom'>('auto');
  const [customLoginId, setCustomLoginId] = useState('');

  useEffect(() => {
    if (isOpen && memberId) {
      loadMember();
    }
  }, [isOpen, memberId]);

  const loadMember = async () => {
    try {
      const response = await getTeamMemberById(memberId);
      setMember(response.data as any);
    } catch (error) {
      console.error('Failed to load member:', error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await generateCredentials(memberId, {
        loginIdOption,
        customLoginId: loginIdOption === 'custom' ? customLoginId : undefined,
        sendInvite: sendEmail,
      });
      const data = response.data as { loginId: string; tempPassword: string };
      setCredentials(data);
      toast.success('Credentials generated successfully');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate credentials');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'loginId' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((prev) => ({ ...prev, [type]: true }));
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [type]: false }));
      }, 2000);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleClose = () => {
    setCredentials(null);
    setCopied({ loginId: false, password: false });
    setSendEmail(true);
    setLoginIdOption('auto');
    setCustomLoginId('');
    onClose();
  };

  if (!isOpen) return null;

  const memberRole = member?.role ? {
    id: member.role.id,
    roleName: member.role.roleName,
    permissions: [], // Would need to fetch full role with permissions
  } : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-[60] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Generate Credentials</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {member ? `${member.firstName} ${member.lastName}` : 'Team Member'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="size-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!credentials ? (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Login ID Format</label>
                      <select
                        value={loginIdOption}
                        onChange={(e) => setLoginIdOption(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="auto">Auto-generate (firstname.lastname@saasa)</option>
                        <option value="email">Use work email</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {loginIdOption === 'custom' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Custom Login ID</label>
                        <input
                          type="text"
                          value={customLoginId}
                          onChange={(e) => setCustomLoginId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="custom.login@saasa"
                        />
                      </div>
                    )}

                    {memberRole && (
                      <div>
                        <PortalAccessPreview role={memberRole as any} />
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Send via email</span>
                    </label>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Key className="size-4" />
                        Generate Credentials
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-800 mb-3">Credentials Generated</p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Login ID</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={credentials.loginId}
                            readOnly
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                          />
                          <button
                            onClick={() => copyToClipboard(credentials.loginId, 'loginId')}
                            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            {copied.loginId ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <Copy className="size-4 text-slate-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Temporary Password</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={credentials.tempPassword}
                            readOnly
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                          />
                          <button
                            onClick={() => copyToClipboard(credentials.tempPassword, 'password')}
                            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            {copied.password ? (
                              <Check className="size-4 text-green-600" />
                            ) : (
                              <Copy className="size-4 text-slate-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      <strong>Important:</strong> This password is shown only once. Make sure to copy it before closing this dialog.
                    </p>
                  </div>

                  {memberRole && (
                    <div>
                      <PortalAccessPreview role={memberRole as any} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-white flex items-center justify-end sticky bottom-0">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                {credentials ? 'Done' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
