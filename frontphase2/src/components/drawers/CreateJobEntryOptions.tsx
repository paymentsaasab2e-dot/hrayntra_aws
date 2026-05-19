'use client';

import { useRef, useState } from 'react';
import { Monitor, Sparkles, Upload } from 'lucide-react';

function AiPoweredBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold shadow-sm">
      <span className="flex h-4 w-4 items-center justify-center rounded bg-[#FC9620] text-[9px] font-bold text-white">
        AI
      </span>
      <span className="text-[#1e5a8a]">Powered</span>
      <Sparkles className="h-3 w-3 text-[#FC9620]" strokeWidth={2.2} />
    </span>
  );
}

interface CreateJobEntryOptionsProps {
  onJdFile: (file: File) => void;
  onGenerateWithAi: () => void;
  disabled?: boolean;
  extracting?: boolean;
  generating?: boolean;
}

export function CreateJobEntryOptions({
  onJdFile,
  onGenerateWithAi,
  disabled = false,
  extracting = false,
  generating = false,
}: CreateJobEntryOptionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pickFile = () => {
    if (disabled || extracting) return;
    inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || disabled || extracting) return;
    onJdFile(file);
  };

  return (
    <div className="mb-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={disabled || extracting}
          onClick={pickFile}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled && !extracting) setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex min-h-[168px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragging
              ? 'border-[#28A8E1] bg-[#E8F7FD]'
              : 'border-slate-300 bg-white hover:border-[#28A8E1]/60 hover:bg-slate-50/80'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F7FD] text-[#28A8E1]">
            <Upload className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="max-w-[220px] text-sm font-medium leading-snug text-slate-700">
            {extracting ? 'Extracting job details…' : 'Drag & drop JD - Our AI will extract key details in seconds!'}
          </p>
          <span className="mt-3">
            <AiPoweredBadge />
          </span>
        </button>

        <span className="shrink-0 px-1 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 sm:px-2">
          OR
        </span>

        <button
          type="button"
          disabled={disabled || generating}
          onClick={onGenerateWithAi}
          className="flex min-h-[168px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center transition-colors hover:border-emerald-400/70 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Monitor className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="text-sm font-medium text-slate-700">
            {generating ? 'Opening AI…' : 'Generate JD with AI'}
          </p>
          <span className="mt-3">
            <AiPoweredBadge />
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf,.doc,.docx,text/plain,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
