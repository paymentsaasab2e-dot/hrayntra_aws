import React from 'react';

export default function TopBar() {
  return (
    <div className="border-b border-[#E5E7EB] bg-white px-6 py-5 sm:px-8">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900">Matches</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-[#6B7280]">
            Smart candidate job matching powered by Recruity AI
          </p>
        </div>

      </div>
    </div>
  );
}
