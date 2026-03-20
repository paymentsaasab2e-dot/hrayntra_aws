'use client';

import { useRouter } from 'next/navigation';
import Header from '../../components/common/Header';
import Footer from '../../components/common/Footer';

export default function CVScorePage() {
  const router = useRouter();

  const handleImproveCV = () => {
    router.push('/aicveditor');
  };

  const strengths = [
    'Demonstrated expertise in project management.',
    'Quantifiable achievements in previous roles.',
    'Strong communication and leadership skills.',
    'Relevant experience in the target industry.',
  ];

  const improvements = [
    'Limited use of industry-specific keywords.',
    'Generic phrasing in some bullet points.',
    'Inconsistent formatting of dates and titles.',
  ];

  const missingKeywords = [
    'Data Analysis',
    'Market Research',
    'Customer Relationship Management',
    'Strategic Planning',
    'Process Improvement',
    'Financial Modeling',
    'Risk Management',
    'Business Development',
  ];

  const formattingSuggestions = [
    'Ensure consistent font sizes throughout the document.',
    'Optimize margins for better readability and a professional look.',
    'Use a clear, modern template for improved visual appeal.',
    'Proofread carefully for any typographical errors.',
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {/* Title Section */}
        <div className="mb-8 ml-2">
          <p className="text-gray-600 font-medium tracking-tight">
            Detailed insights into your CV's compatibility with Applicant Tracking Systems.
          </p>
        </div>

        {/* Improved Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-start">

          {/* ROW 1 - LEFT: ATS Compatibility Score (col-span-5) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col h-full ring-1 ring-black/5">
            <h2 className="text-xl font-black text-[#111827] mb-8">ATS Compatibility Score</h2>

            <div className="flex flex-col items-center justify-center grow">
              <div className="relative w-48 h-48 mb-8">
                <svg className="w-full h-full transform -rotate-90 relative">
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F3F4F6" />
                      <stop offset="100%" stopColor="#E5E7EB" />
                    </linearGradient>
                  </defs>

                  {/* Background track */}
                  <circle
                    cx="96"
                    cy="96"
                    r="86"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="16"
                  />

                  {/* Progress ring */}
                  <circle
                    cx="96"
                    cy="96"
                    r="86"
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="16"
                    strokeDasharray={`${2 * Math.PI * 86}`}
                    strokeDashoffset={`${2 * Math.PI * 86 * (1 - 0.85)}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{
                      filter: 'drop-shadow(0 4px 12px rgba(40, 168, 223, 0.25))',
                    }}
                  />
                </svg>

                {/* Score value */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-black text-[#111827]">
                    85%
                  </span>
                </div>
              </div>

              <p className="text-base font-bold text-[#111827] mb-6 text-center max-w-[280px]">
                Your CV is highly optimized and ready for review!
              </p>

              <div className="w-full bg-[#F1F5F9] rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#28A8DF] transition-all duration-1000 ease-out"
                  style={{ width: '85%' }}
                ></div>
              </div>

              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                This score indicates how well your CV is parsed and matched by typical ATS systems.
              </p>
            </div>
          </div>

          {/* ROW 1 - RIGHT: Stacked Strengths and Missing Keywords (col-span-7) */}
          <div className="lg:col-span-7 space-y-6 flex flex-col h-full">
            {/* Key Strengths */}
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm ring-1 ring-black/5 flex-1">
              <h3 className="text-lg font-black text-[#111827] mb-6">Key Strengths Identified</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 rounded-full bg-[#EBF8FF] flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-[#28A8DF]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="4"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-[#4B5563] font-medium leading-tight">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Keywords */}
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-black text-[#111827] mb-2">Missing Keywords</h3>
              <p className="text-xs text-gray-500 mb-6">
                Consider adding these to improve your CV's visibility.
              </p>
              <div className="flex flex-wrap gap-2">
                {missingKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-[#F8FAFC] text-[#1E293B] text-xs font-bold rounded-xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all cursor-default"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 2 - Formatting & Areas for Improvement */}
          {/* Formatting Suggestions (matches width of score card) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm ring-1 ring-black/5">
            <h3 className="text-lg font-black text-[#111827] mb-6">Formatting Suggestions</h3>
            <ul className="space-y-4">
              {formattingSuggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-4 p-3 rounded-2xl bg-[#FFF5F5] border border-red-50">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#475569] font-medium">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm ring-1 ring-black/5">
            <h3 className="text-lg font-black text-[#111827] mb-6">Areas for Improvement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {improvements.map((improvement, index) => (
                <div key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FFF5F5] border border-red-50">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#475569] font-bold leading-snug">{improvement}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center mt-12 mb-10">
          <button
            onClick={handleImproveCV}
            className="group relative px-10 py-5 bg-[#FF9D2E] hover:bg-[#ff8c00] text-white font-black text-xl rounded-2xl transition-all shadow-[0_8px_0_0_#cc7a00] active:shadow-none active:translate-y-[8px] flex items-center gap-3 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              Improve My CV & Complete Profile
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 animate-bounce-x">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
