"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Mail, 
  User, 
  Lock, 
  ArrowRight, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Hash,
  Database,
  Search,
  Terminal,
  Server
} from 'lucide-react';
import { buildApiUrl } from '../../lib/api';

const HQSetupPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        userId: '',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ 
      type: 'idle', 
      message: '' 
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: 'idle', message: '' });

        try {
            const apiUrl = buildApiUrl('/hq/setup');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', message: 'SuperAdmin credentials injected into database successfully!' });
                // Reset form on success
                setFormData({ name: '', email: '', userId: '', password: '' });
            } else {
                setStatus({ type: 'error', message: data.message || 'Injection failed. Check backend logs.' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Backend connection refused. Ensure server is running.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6 font-sans overflow-hidden relative">
        {/* Abstract Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-sky-500/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(40,168,225,0.05)_0%,rgba(0,0,0,0)_70%)]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[480px]"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", damping: 15 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 mb-6 shadow-[0_0_30px_-5px_rgba(14,165,233,0.4)]"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-black tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              Headquarters Setup
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Direct Database Injection — SuperAdmin Credentials
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-[#121214] border border-white/5 rounded-[32px] p-8 shadow-2xl backdrop-blur-xl relative group">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-sky-500/20 to-indigo-500/20 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10 pointer-events-none" />
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">Full Name</label>
                <div className="relative group/input">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/input:text-sky-400 transition-colors" />
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Master Administrator"
                    className="w-full bg-[#1c1c1f] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/30 transition-all placeholder:text-slate-600"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">Email Address</label>
                <div className="relative group/input">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/input:text-sky-400 transition-colors" />
                  <input 
                    type="email" 
                    required
                    placeholder="admin@hryantra.com"
                    className="w-full bg-[#1c1c1f] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/30 transition-all placeholder:text-slate-600"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              {/* User ID / Login ID */}
              <div className="space-y-2">
                <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">User ID / Login ID</label>
                <div className="relative group/input">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/input:text-sky-400 transition-colors" />
                  <input 
                    type="text" 
                    required
                    placeholder="superuser_hq"
                    className="w-full bg-[#1c1c1f] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/30 transition-all placeholder:text-slate-600"
                    value={formData.userId}
                    onChange={(e) => setFormData({...formData, userId: e.target.value})}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">System Password</label>
                <div className="relative group/input">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/input:text-sky-400 transition-colors" />
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#1c1c1f] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/30 transition-all placeholder:text-slate-600"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              {/* Status Messages */}
              <AnimatePresence mode="wait">
                {status.type !== 'idle' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex items-start gap-3 p-4 rounded-2xl text-[13px] font-semibold leading-relaxed ${
                      status.type === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span>{status.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative group mt-4 overflow-hidden rounded-2xl p-[1px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-indigo-600 transition-all group-hover:scale-105 duration-500" />
                <div className="relative bg-[#121214] rounded-[15px] py-4 px-6 flex items-center justify-center gap-2 group-hover:bg-transparent transition-colors duration-300">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Inject Credentials</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-700">
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3" />
              <span>Auth Service v2.4</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-3 h-3" />
              <span>MongoDB Atlas</span>
            </div>
            <div className="flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              <span>CLI Access Enabled</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
};

export default HQSetupPage;
