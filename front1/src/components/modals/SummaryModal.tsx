'use client';

import { useState } from 'react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryText: string;
  onSummaryChange: (text: string) => void;
  onSave: () => void;
}

import { API_BASE_URL } from '@/lib/api-base';

export default function SummaryModal({
  isOpen,
  onClose,
  summaryText,
  onSummaryChange,
  onSave,
}: SummaryModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateWithAI = async () => {
    const candidateId = sessionStorage.getItem('candidateId');
    if (!candidateId) {
      alert('Candidate ID not found. Please refresh the page.');
      return;
    }

    try {
      setIsGenerating(true);
      console.log('🚀 Calling API:', `${API_BASE_URL}/profile/generate-summary/${candidateId}`);
      
      const response = await fetch(`${API_BASE_URL}/profile/generate-summary/${candidateId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data?.summary) {
        // Update the summary text with AI-generated content
        onSummaryChange(result.data.summary);
      } else {
        alert(result.message || 'Failed to generate summary. Please try again.');
      }
    } catch (error) {
      console.error('Error generating summary with AI:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error generating summary: ${errorMessage}. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="modal-placeholder-black bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">Edit Profile Summary</h2>
            <button
              onClick={onClose}
              className="text-[#9095A1] hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-6">
            <div className="flex gap-6 items-stretch">
              {/* Left Column - Professional Summary */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={summaryText}
                  onChange={(e) => onSummaryChange(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Write a compelling professional summary that highlights your experience, skills, and career achievements..."
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    height: '280px',
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {summaryText.length} / 500 characters
                </p>
              </div>

              {/* Right Column - Good Summary Includes */}
              <div className="w-72 shrink-0 flex flex-col">
                <div className="h-6 mb-2"></div>
                <div 
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex flex-col"
                  style={{
                    height: '280px',
                  }}
                >
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Good Summary Includes:
                  </h3>
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    <div className="bg-white rounded-md border border-gray-200 p-3 shadow-sm">
                      <span className="text-sm text-gray-700">Your role or expertise</span>
                    </div>
                    <div className="bg-white rounded-md border border-gray-200 p-3 shadow-sm">
                      <span className="text-sm text-gray-700">Years of experience</span>
                    </div>
                    <div className="bg-white rounded-md border border-gray-200 p-3 shadow-sm">
                      <span className="text-sm text-gray-700">Core skills</span>
                    </div>
                    <div className="bg-white rounded-md border border-gray-200 p-3 shadow-sm">
                      <span className="text-sm text-gray-700">Industry/domain focus</span>
                    </div>
                    <div className="bg-white rounded-md border border-gray-200 p-3 shadow-sm">
                      <span className="text-sm text-gray-700">Achievements or strengths</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
            {/* Left Side - AI Enhancement */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-yellow-500"
                >
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>Enhance your summary with AI</span>
              </div>
              <button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate with AI'
                )}
              </button>
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Save Summary
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
