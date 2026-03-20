'use client';

import { useRouter } from 'next/navigation';

interface ApplicationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle: string;
  company: string;
  appliedDate: string;
  jobId?: number | string;
  applicationId?: string; // Optional: if application already exists, use this ID
}

export default function ApplicationSuccessModal({
  isOpen,
  onClose,
  jobTitle,
  company,
  appliedDate,
  jobId,
  applicationId,
}: ApplicationSuccessModalProps) {
  const router = useRouter();

  const handleTrackApplication = () => {
    onClose();
    // Navigate to the specific application status page
    // Priority: use applicationId if provided, otherwise use jobId
    if (applicationId) {
      // If application already exists, navigate to its tracking page
      router.push(`/applications/${applicationId}`);
    } else if (jobId !== undefined && jobId !== null) {
      // Otherwise, use jobId to create/navigate to application tracking page
      const id = String(jobId);
      router.push(`/applications/${id}`);
    } else {
      // Fallback to applications list if no ID is provided
      router.push('/applications');
    }
  };

  const handleBrowseMoreJobs = () => {
    onClose();
    // Optionally reset selected job or navigate
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className="bg-white rounded-lg shadow-xl z-10 relative"
        style={{
          width: '600px',
          maxWidth: '90vw',
          borderRadius: '10px',
          boxShadow: '0 0 2px 0 rgba(23, 26, 31, 0.20), 0 0 1px 0 rgba(23, 26, 31, 0.07)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center border-2 border-green-500">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Application Submitted
            </h2>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Successfully
            </h2>
            <p className="text-base text-gray-600">
              You will receive updates via email and WhatsApp.
            </p>
          </div>

          {/* Job Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Job Summary</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-bold text-gray-700">Title: </span>
                <span className="text-sm text-gray-900">{jobTitle}</span>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-700">Company: </span>
                <span className="text-sm text-gray-900">{company}</span>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-700">Applied On: </span>
                <span className="text-sm text-gray-900">{appliedDate}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleTrackApplication}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Track Application
            </button>
            <button
              onClick={handleBrowseMoreJobs}
              className="flex-1 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg border-2 border-gray-300 transition-colors"
            >
              Browse More Jobs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
