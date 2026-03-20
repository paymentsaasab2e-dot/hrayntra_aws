'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { generateCredentials, getRoles } from '../../lib/api/teamApi';
import type { TeamMember, SystemRole } from '../../types/team';

interface GenerateCredentialsDrawerProps {
  isOpen: boolean;
  member: TeamMember;
  onClose: () => void;
  onSuccess: () => void;
}

type LoginIdOption = 'auto' | 'email' | 'custom';

export const GenerateCredentialsDrawer: React.FC<GenerateCredentialsDrawerProps> = ({
  isOpen,
  member,
  onClose,
  onSuccess,
}) => {
  const [loginIdOption, setLoginIdOption] = useState<LoginIdOption>('auto');
  const [customLoginId, setCustomLoginId] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ loginId: string; tempPassword: string } | null>(null);
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState<{ loginId: boolean; password: boolean }>({ loginId: false, password: false });
  const [role, setRole] = useState<SystemRole | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRole();
      setGeneratedCredentials(null);
      setLoginIdOption('auto');
      setCustomLoginId('');
      setSendInvite(true);
      setShowPassword(true);
      setCopied({ loginId: false, password: false });
    }
  }, [isOpen, member.role.id]);

  const loadRole = async () => {
    try {
      const res = await getRoles();
      const foundRole = res.data?.find((r) => r.id === member.role.id);
      setRole(foundRole || null);
    } catch (error) {
      console.error('Failed to load role:', error);
    }
  };

  const computeLoginId = (): string => {
    if (loginIdOption === 'email') {
      return member.email;
    } else if (loginIdOption === 'custom') {
      return customLoginId;
    } else {
      // Auto-generate
      const first = member.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const last = member.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return last ? `${first}.${last}@saasa` : `${first}@saasa`;
    }
  };

  const getModules = (): string[] => {
    if (!role || !('rolePermissions' in role)) return [];
    const roleWithPerms = role as any;
    if (!roleWithPerms.rolePermissions) return [];
    const modules = new Set<string>();
    roleWithPerms.rolePermissions.forEach((rp: any) => {
      if (rp.permission?.module) {
        modules.add(rp.permission.module);
      }
    });
    return Array.from(modules).sort();
  };

  const modules = getModules();
  const allModules = ['Jobs', 'Candidates', 'Interviews', 'Placements', 'Billing', 'Reports', 'Team', 'System'];

  const handleCopy = async (text: string, type: 'loginId' | 'password') => {
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const payload: any = {
        sendInvite,
      };

      if (loginIdOption === 'custom') {
        payload.customLoginId = customLoginId;
      } else if (loginIdOption === 'email') {
        payload.loginIdOption = 'email';
      } else {
        payload.loginIdOption = 'auto';
      }

      const res = await generateCredentials(member.id, payload);
      
      if (res.data?.loginId && res.data?.tempPassword) {
        setGeneratedCredentials({
          loginId: res.data.loginId,
          tempPassword: res.data.tempPassword,
        });
      } else {
        toast.success('Credentials generated successfully');
        handleClose();
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate credentials');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setGeneratedCredentials(null);
    setLoginIdOption('auto');
    setCustomLoginId('');
    setSendInvite(true);
    setShowPassword(true);
    setCopied({ loginId: false, password: false });
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const loginIdPreview = computeLoginId();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full max-w-lg w-full bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Generate Login Credentials</h2>
                <p className="text-sm text-slate-500 mt-0.5">{member.firstName} {member.lastName}</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Login ID Format */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Login ID Format</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="loginIdOption"
                      value="auto"
                      checked={loginIdOption === 'auto'}
                      onChange={() => setLoginIdOption('auto')}
                      className="size-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Auto-generate</div>
                      <div className="text-xs text-slate-500">Based on member's name</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="loginIdOption"
                      value="email"
                      checked={loginIdOption === 'email'}
                      onChange={() => setLoginIdOption('email')}
                      className="size-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Use work email</div>
                      <div className="text-xs text-slate-500">Member's email address</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="loginIdOption"
                      value="custom"
                      checked={loginIdOption === 'custom'}
                      onChange={() => setLoginIdOption('custom')}
                      className="size-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">Custom</div>
                      <div className="text-xs text-slate-500">Enter a custom login ID</div>
                    </div>
                  </label>
                </div>

                {loginIdOption === 'custom' && (
                  <input
                    type="text"
                    value={customLoginId}
                    onChange={(e) => setCustomLoginId(e.target.value)}
                    placeholder="Enter custom login ID"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Login ID Preview</div>
                  <div className="font-mono text-sm text-slate-900">{loginIdPreview || 'Will be generated'}</div>
                </div>
              </div>

              {/* Send Invite */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Send invite email</span>
                </label>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  The temporary password will be shown once after generation. Copy it immediately — it cannot be retrieved again.
                </p>
              </div>

              {/* Portal Access Preview */}
              {role && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">Portal access for {role.roleName}</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    {allModules.map((module) => {
                      const hasAccess = modules.includes(module);
                      return (
                        <div key={module} className="flex items-center gap-2 text-sm">
                          {hasAccess ? (
                            <Check className="size-4 text-green-600" />
                          ) : (
                            <X className="size-4 text-gray-400" />
                          )}
                          <span className={hasAccess ? 'text-slate-900' : 'text-slate-400'}>{module}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generated Credentials */}
              {generatedCredentials && (
                <div className="space-y-4 border-t border-slate-200 pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700">Login ID</label>
                      <button
                        onClick={() => handleCopy(generatedCredentials.loginId, 'loginId')}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Copy size={12} />
                        {copied.loginId ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900">
                      {generatedCredentials.loginId}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-700">Temporary Password</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 hover:bg-slate-100 rounded transition-colors"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => handleCopy(generatedCredentials.tempPassword, 'password')}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Copy size={12} />
                          {copied.password ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-sm text-slate-900">
                      {showPassword ? generatedCredentials.tempPassword : '••••••••••••'}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">
                    Invite expires in: 48 hours
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-3">
              {generatedCredentials ? (
                <button
                  onClick={() => {
                    handleClose();
                    onSuccess();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || (loginIdOption === 'custom' && !customLoginId.trim())}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Credentials'
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
