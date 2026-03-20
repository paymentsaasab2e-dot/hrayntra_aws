'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';
import { API_BASE_URL } from '@/lib/profile-completion';

type ApplicationStatus =
  | 'Under Review'
  | 'Submitted'
  | 'Shortlisted'
  | 'Selected'
  | 'Rejected'
  | 'Assessment'
  | 'Interview'
  | 'Final Decision';

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  status: ApplicationStatus | string;
  appliedDate: string;
  matchScore: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Under Review':
      return 'bg-blue-100 text-blue-700';
    case 'Submitted':
      return 'bg-gray-100 text-gray-700';
    case 'Shortlisted':
      return 'bg-purple-100 text-purple-700';
    case 'Assessment':
      return 'bg-cyan-100 text-cyan-800';
    case 'Interview':
      return 'bg-emerald-100 text-emerald-800';
    case 'Final Decision':
      return 'bg-indigo-100 text-indigo-800';
    case 'Selected':
      return 'bg-green-100 text-green-700';
    case 'Rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const STATUS_OPTIONS: string[] = [
  'All',
  'Under Review',
  'Submitted',
  'Shortlisted',
  'Assessment',
  'Interview',
  'Final Decision',
  'Selected',
  'Rejected',
];

const DATE_OPTIONS = ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last 3 Months', 'Last 6 Months', 'Last Year'];

const PAGE_BG =
  'linear-gradient(135deg, #e0f2fe 0%, #ecf7fd 12%, #fafbfb 30%, #fdf6f0 55%, #fef5ed 85%, #fef5ed 100%)';

function isWithinDateFilter(appliedDateStr: string, filter: string): boolean {
  if (filter === 'All Time') return true;
  const applied = new Date(appliedDateStr);
  if (Number.isNaN(applied.getTime())) return true;
  const now = new Date();
  const msPerDay = 86400000;
  let days = 0;
  switch (filter) {
    case 'Last 7 Days':
      days = 7;
      break;
    case 'Last 30 Days':
      days = 30;
      break;
    case 'Last 3 Months':
      days = 90;
      break;
    case 'Last 6 Months':
      days = 180;
      break;
    case 'Last Year':
      days = 365;
      break;
    default:
      return true;
  }
  const cutoff = new Date(now.getTime() - days * msPerDay);
  return applied >= cutoff;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [displayedApplicationsCount, setDisplayedApplicationsCount] = useState(6);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateMissing, setCandidateMissing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const candidateId =
      typeof window !== 'undefined' ? sessionStorage.getItem('candidateId') : null;

    if (!candidateId) {
      setCandidateMissing(true);
      setLoading(false);
      setApplications([]);
      return;
    }

    setCandidateMissing(false);
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/applications/${candidateId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const payload: unknown = await response.json().catch(() => ({}));
        const success = Boolean((payload as { success?: unknown })?.success);
        const data = (payload as { data?: unknown })?.data;

        if (!response.ok) {
          const msg =
            (payload as { message?: string })?.message ||
            `Could not load applications (${response.status})`;
          throw new Error(msg);
        }

        if (!cancelled && success && Array.isArray(data)) {
          setApplications(data as Application[]);
        } else if (!cancelled) {
          setApplications([]);
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : 'Failed to load applications');
          setApplications([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        searchQuery === '' ||
        app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.company.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'All' || app.status === statusFilter;

      const matchesDate = isWithinDateFilter(app.appliedDate, dateFilter);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [applications, searchQuery, statusFilter, dateFilter]);

  const displayedApps = filteredApplications.slice(0, displayedApplicationsCount);

  const handleLoadMore = () => {
    setDisplayedApplicationsCount((prev) => prev + 6);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderApplicationCard = (application: Application) => {
    const score =
      application.matchScore != null && application.matchScore > 0
        ? `${Math.round(application.matchScore)}%`
        : '—';

    return (
      <div
        key={application.id}
        className="w-full h-full p-6 rounded-2xl bg-white border border-gray-200 relative flex flex-col shadow-sm"
      >
        <h3 className="text-xl font-medium text-gray-900 mb-2">{application.jobTitle}</h3>

        <p className="text-sm text-gray-500 mt-1">{application.company}</p>

        <div className="mt-4">
          <span
            className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(
              application.status
            )}`}
          >
            {application.status}
          </span>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          <p>Applied: {formatDate(application.appliedDate)}</p>
          <p>Match Score: {score}</p>
        </div>

        <button
          onClick={() => router.push(`/applications/${application.id}`)}
          className="mt-5 w-full py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity duration-200 active:scale-98"
          style={{ backgroundColor: '#28A8E1' }}
        >
          View Status
        </button>
      </div>
    );
  };

  if (candidateMissing) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: PAGE_BG }}>
        <Header />
        <main className="w-full grow overflow-x-hidden">
          <div className="mx-auto max-w-[1320px] px-6 lg:px-8 py-16 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Sign in to see your applications</h1>
            <p className="mt-2 text-gray-600">
              Verify your WhatsApp number so we can load only your job applications.
            </p>
            <button
              type="button"
              onClick={() => router.push('/whatsapp/verify')}
              className="mt-6 rounded-xl bg-[#28A8E1] px-6 py-3 text-sm font-semibold text-white hover:opacity-95 transition"
            >
              Continue with WhatsApp
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: PAGE_BG }}>
      <Header />

      <main className="w-full grow overflow-x-hidden">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <div className="space-y-5">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 tracking-tight">
                  My Applications
                </h1>
                <p className="text-gray-500 font-medium">
                  Track and manage your dream job opportunities
                </p>
              </div>
            </div>

            {fetchError ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                {fetchError}
              </div>
            ) : null}

            {/* Search and Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative group">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
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
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by job title or company"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium text-gray-900"
                  />
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full md:w-auto px-5 py-3 pr-10 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium text-gray-900 appearance-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="relative">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full md:w-auto px-5 py-3 pr-10 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium text-gray-900 appearance-none cursor-pointer"
                  >
                    {DATE_OPTIONS.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none flex items-center gap-1.5">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Applications Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-20 text-gray-500">
                Loading applications...
              </div>
            ) : displayedApps.length > 0 ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {displayedApps.map((application) => renderApplicationCard(application))}
                </div>

                {/* Load More */}
                {displayedApplicationsCount < filteredApplications.length && (
                  <div className="flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      className="px-10 py-4 bg-white border border-gray-100 text-gray-900 font-bold rounded-2xl shadow-sm hover:bg-gray-50 hover:shadow-md active:scale-95 transition-all duration-300"
                    >
                      Load More Applications
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-400"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                    <line x1="8" y1="9" x2="10" y2="9" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {applications.length === 0 ? 'No applications yet' : 'No applications found'}
                </h2>
                <p className="text-gray-500 max-w-sm mx-auto">
                  {applications.length === 0
                    ? 'Browse jobs and apply — your applications will show up here.'
                    : "We couldn't find any applications matching your search or filters."}
                </p>
                {applications.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => router.push('/explore-jobs')}
                    className="mt-6 rounded-xl bg-[#28A8E1] px-6 py-3 text-sm font-semibold text-white hover:opacity-95 transition"
                  >
                    Explore jobs
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
