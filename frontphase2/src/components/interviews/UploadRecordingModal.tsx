import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Cloud, Link2, Upload, X } from 'lucide-react';
import type { Interview } from '../../types/interview.types';

interface UploadRecordingModalProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onAttach: (type: 'file' | 'link' | 'cloud', value: string) => void;
}

export function UploadRecordingModal({ isOpen, interview, onClose, onAttach }: UploadRecordingModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'link' | 'cloud'>('file');
  const [linkValue, setLinkValue] = useState('');
  const [cloudValue, setCloudValue] = useState('Zoom Cloud Recording');
  const [fileName, setFileName] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('file');
      setLinkValue('');
      setCloudValue('Zoom Cloud Recording');
      setFileName('');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && interview ? (
        <div className="fixed inset-0 z-[120]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50" />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="absolute right-0 top-0 z-10 flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Upload Recording</h3>
                <p className="text-sm text-[#6B7280]">{interview.candidate.name} • {interview.round}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="size-5" /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="flex gap-2">
                {[
                  ['file', 'Upload File'],
                  ['link', 'Paste Link'],
                  ['cloud', 'Cloud Recording'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key as 'file' | 'link' | 'cloud')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      activeTab === key ? 'bg-[#2563EB] text-white' : 'border border-[#E5E7EB] text-[#374151]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'file' ? (
                <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-center">
                  <Upload className="size-8 text-[#6B7280]" />
                  <div className="mt-3 text-sm font-semibold text-[#111827]">{fileName || 'Drag recording file here or click to browse'}</div>
                  <div className="mt-1 text-xs text-[#6B7280]">MP4, MOV, or audio recording files</div>
                  <input type="file" className="hidden" onChange={(event) => setFileName(event.target.files?.[0]?.name || '')} />
                </label>
              ) : null}

              {activeTab === 'link' ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Recording Link</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <input value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://drive.google.com/..." className="w-full rounded-xl border border-[#E5E7EB] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2563EB]" />
                  </div>
                </div>
              ) : null}

              {activeTab === 'cloud' ? (
                <div className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                    <Cloud className="size-4 text-[#2563EB]" />
                    Connect cloud recording source
                  </div>
                  <select value={cloudValue} onChange={(event) => setCloudValue(event.target.value)} className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                    <option>Zoom Cloud Recording</option>
                    <option>Google Meet Recording</option>
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">Cancel</button>
              <button
                type="button"
                onClick={() => onAttach(activeTab, activeTab === 'file' ? fileName : activeTab === 'link' ? linkValue : cloudValue)}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
              >
                Attach Recording
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
