'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '../../../components/common/Header';
import Footer from '../../../components/common/Footer';

interface TimelineEvent {
  id: string;
  status: string;
  date: string;
  time: string;
  description: string;
  icon: 'document' | 'review' | 'star' | 'check' | 'x';
  completed: boolean;
}

interface CommunicationUpdate {
  id: string;
  type: 'email' | 'whatsapp';
  title: string;
  date: string;
  time: string;
  preview: string;
}

const getStatusIcon = (iconType: string) => {
  switch (iconType) {
    case 'document':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
    case 'review':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      );
    case 'star':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      );
    case 'check':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    case 'x':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    default:
      return null;
  }
};

const getStatusMessage = (status: string) => {
  switch (status) {
    case 'Selected':
      return 'Congratulations! Offer inbound';
    case 'Shortlisted':
      return 'Great progress! Interview stage';
    case 'Under Review':
      return 'Your application is being reviewed';
    case 'Rejected':
      return 'Application not selected';
    default:
      return 'Application submitted';
  }
};

export default function ApplicationStatusPage() {
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [isSelectedModalOpen, setIsSelectedModalOpen] = useState(false);

  // Sample data - in real app, fetch based on params.id
  const applicationData = {
    id: params.id || '1',
    jobTitle: 'Senior Frontend Developer',
    company: 'SAASA Tech Solutions',
    location: 'New York, NY',
    status: 'Selected',
    workMode: 'Remote',
    experience: '5+ Years',
  };

  const timelineEvents: TimelineEvent[] = [
    {
      id: '1',
      status: 'Submitted',
      date: 'August 10, 2024',
      time: '09:30 AM',
      description: 'Your application has been successfully sent to SAASA Tech Solutions.',
      icon: 'document',
      completed: true,
    },
    {
      id: '2',
      status: 'Under Review',
      date: 'August 12, 2024',
      time: '11:00 AM',
      description: 'The hiring team at SAASA is actively reviewing your profile and qualifications.',
      icon: 'review',
      completed: true,
    },
    {
      id: '3',
      status: 'Shortlisted',
      date: 'August 15, 2024',
      time: '02:00 PM',
      description: 'Congratulations! You have been shortlisted for the next stage of interviews.',
      icon: 'star',
      completed: true,
    },
    {
      id: '4',
      status: 'Selected',
      date: 'August 20, 2024',
      time: '10:00 AM',
      description: 'Fantastic news! You have been selected for the Senior Frontend Developer position. An offer letter will be sent shortly. Employer will contact you soon for onboarding.',
      icon: 'check',
      completed: true,
    },
  ];

  const emailUpdates: CommunicationUpdate[] = [
    {
      id: '1',
      type: 'email',
      title: 'Application Submitted',
      date: 'August 10, 2024',
      time: '09:35 AM',
      preview: 'Submitted: Senior Frontend Developer. Thank you for your application...',
    },
    {
      id: '2',
      type: 'email',
      title: 'Update: Your Application Status',
      date: 'August 12, 2024',
      time: '11:05 AM',
      preview: 'Your application for Senior Frontend Developer is now under review...',
    },
    {
      id: '3',
      type: 'email',
      title: 'Shortlist Notification',
      date: 'August 15, 2024',
      time: '02:05 PM',
      preview: 'Notification: Senior Frontend Developer. We are pleased to inform you...',
    },
    {
      id: '4',
      type: 'email',
      title: 'Final Decision',
      date: 'August 20, 2024',
      time: '10:05 AM',
      preview: 'Senior Frontend Developer. Following careful consideration...',
    },
  ];

  const whatsappUpdates: CommunicationUpdate[] = [
    {
      id: 'w1',
      type: 'whatsapp',
      title: 'Application Received',
      date: 'August 10, 2024',
      time: '09:32 AM',
      preview: 'Hi! We have received your application for Senior Frontend Developer...',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Selected':
        return 'text-green-600';
      case 'Shortlisted':
        return 'text-purple-600';
      case 'Under Review':
        return 'text-blue-600';
      case 'Rejected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ background: '#F8F9FA' }}>
      <Header />
      
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Applications
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2">
            {/* Job Title and Company */}
            <div className="bg-white rounded-lg p-6 mb-6 shadow-sm" style={{ boxShadow: '0 3px 6px 0 rgba(18, 15, 40, 0.12)' }}>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{applicationData.jobTitle}</h1>
              <div className="flex items-center gap-4 text-gray-600 mb-4">
                <span className="font-medium">{applicationData.company}</span>
                <span>•</span>
                <span>{applicationData.location}</span>
              </div>
              
              {/* Current Status */}
              <div className="flex items-center justify-between">
                <div>
                  {applicationData.status === 'Selected' ? (
                    <button
                      onClick={() => setIsSelectedModalOpen(true)}
                      className="text-left"
                    >
                      <p className={`text-lg font-semibold ${getStatusColor(applicationData.status)} mb-1 hover:underline`}>
                        {applicationData.status}
                      </p>
                      <p className="text-sm text-gray-600">{getStatusMessage(applicationData.status)}</p>
                    </button>
                  ) : (
                    <div>
                      <p className={`text-lg font-semibold ${getStatusColor(applicationData.status)} mb-1`}>
                        {applicationData.status}
                      </p>
                      <p className="text-sm text-gray-600">{getStatusMessage(applicationData.status)}</p>
                    </div>
                  )}
                </div>
                {applicationData.status === 'Selected' && (
                  <button
                    onClick={() => setIsSelectedModalOpen(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Offer Details
                  </button>
                )}
              </div>
            </div>

            {/* Application Timeline */}
            <div className="bg-white rounded-lg p-6 shadow-sm" style={{ boxShadow: '0 3px 6px 0 rgba(18, 15, 40, 0.12)' }}>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Application Timeline</h2>
              
              <div className="relative">
                {/* Timeline Line - only show between completed events */}
                <div className="absolute left-5 top-5 bottom-0 w-0.5 bg-gray-200" style={{ height: 'calc(100% - 1.25rem)' }}></div>
                
                <div className="space-y-8">
                  {timelineEvents.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        event.completed 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-400'
                      }`}>
                        {getStatusIcon(event.icon)}
                      </div>
                      
                      {/* Content */}
                      <div className={`flex-1 ${index < timelineEvents.length - 1 ? 'pb-8' : ''}`}>
                        <div className="flex items-center gap-3 mb-1">
                          {event.status === 'Selected' ? (
                            <button
                              onClick={() => setIsSelectedModalOpen(true)}
                              className="text-left"
                            >
                              <h3 className="text-lg font-semibold text-gray-900 hover:text-green-600 hover:underline">
                                {event.status}
                              </h3>
                            </button>
                          ) : (
                            <h3 className="text-lg font-semibold text-gray-900">{event.status}</h3>
                          )}
                          <span className="text-sm text-gray-500">
                            {event.date}, {event.time}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Job Snapshot */}
            <div className="bg-white rounded-lg p-6 shadow-sm" style={{ boxShadow: '0 3px 6px 0 rgba(18, 15, 40, 0.12)' }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Snapshot</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Job Title</p>
                  <p className="text-sm font-medium text-gray-900">{applicationData.jobTitle}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Work Mode</p>
                  <p className="text-sm font-medium text-gray-900">{applicationData.workMode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Experience</p>
                  <p className="text-sm font-medium text-gray-900">{applicationData.experience}</p>
                </div>
              </div>
            </div>

            {/* Communication Updates */}
            <div className="bg-white rounded-lg p-6 shadow-sm" style={{ boxShadow: '0 3px 6px 0 rgba(18, 15, 40, 0.12)' }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Communication Updates</h3>
              
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setActiveTab('email')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'email'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Email Updates
                </button>
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'whatsapp'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  WhatsApp Updates
                </button>
              </div>

              {/* Updates List */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {(activeTab === 'email' ? emailUpdates : whatsappUpdates).map((update) => (
                  <div key={update.id} className="flex gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex-shrink-0 mt-1">
                      {update.type === 'email' ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-gray-400"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="text-green-500"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.254 9.254 0 01-4.932-1.417l-.361-.214-3.741.982.998-3.648-.235-.374a9.254 9.254 0 01-1.418-4.932c0-5.135 4.18-9.315 9.315-9.315s9.315 4.18 9.315 9.315-4.18 9.315-9.315 9.315m8.662-16.774a11.945 11.945 0 00-8.662-3.713c-6.617 0-12 5.383-12 12 0 2.177.583 4.225 1.608 6.001l-1.7 6.2 6.4-1.666a11.96 11.96 0 005.692 1.465h.005c6.617 0 12-5.383 12-12 0-3.314-1.346-6.315-3.521-8.486"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">{update.title}</p>
                      <p className="text-xs text-gray-500 mb-1">
                        {update.date}, {update.time}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-2">{update.preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Selected Status Modal */}
      {isSelectedModalOpen && applicationData.status === 'Selected' && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsSelectedModalOpen(false)}
          />
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-lg shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '672px',
                height: '226px',
                borderRadius: '10px',
                boxShadow: '0 0 2px 0 rgba(23, 26, 31, 0.20), 0 0 1px 0 rgba(23, 26, 31, 0.07)',
              }}
            >
              {/* Status Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
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
                <span className="text-lg font-semibold text-green-600">Selected</span>
              </div>

              {/* Main Message */}
              <p className="text-base text-gray-900 mb-3">
                Congratulations! You have been selected for the {applicationData.jobTitle} role at {applicationData.company}.
              </p>

              {/* Timestamp */}
              <p className="text-sm text-gray-500 mb-4">
                {timelineEvents.find(e => e.status === 'Selected')?.date}, {timelineEvents.find(e => e.status === 'Selected')?.time}
              </p>

              {/* Instructions */}
              <p className="text-sm text-gray-900">
                The employer will contact you soon to discuss the next steps. Please ensure your contact details are up to date.
              </p>

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsSelectedModalOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}
