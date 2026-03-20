'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/common/Header';
import Footer from '../../components/common/Footer';

interface Notification {
  id: number;
  type: 'job' | 'application' | 'interview' | 'course' | 'system' | 'saved-search';
  icon: string;
  barColor: string;
  barColorValue: string;
  title: string;
  description: string;
  actionButton: string;
  actionPath: string;
  timestamp: string;
  isRead: boolean;
}

export default function NotificationPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: 'job',
      icon: 'briefcase',
      barColor: 'bg-blue-400',
      barColorValue: '#60A5FA',
      title: '3 new jobs match your profile!',
      description: 'AI recommendations for "Senior React Developer" roles in London.',
      actionButton: 'View Jobs',
      actionPath: '/explore-jobs',
      timestamp: '2 hours ago',
      isRead: false,
    },
    {
      id: 2,
      type: 'application',
      icon: 'document',
      barColor: 'bg-purple-500',
      barColorValue: '#A855F7',
      title: 'Application for "Product Manager" updated to "Under Review"',
      description: 'Your application for Google has moved to the next stage.',
      actionButton: 'Track Application',
      actionPath: '/applications/1',
      timestamp: '1 day ago',
      isRead: false,
    },
    {
      id: 3,
      type: 'interview',
      icon: 'calendar',
      barColor: 'bg-green-500',
      barColorValue: '#22C55E',
      title: 'Interview scheduled with Tech Solutions for "Software Engineer"',
      description: 'Date: Oct 26, 2023, 10:00 AM. Location: Virtual.',
      actionButton: 'View Interview Details',
      actionPath: '/applications/1',
      timestamp: '2 days ago',
      isRead: false,
    },
    {
      id: 4,
      type: 'course',
      icon: 'book',
      barColor: 'bg-orange-500',
      barColorValue: '#FC9620',
      title: 'New course "Advanced TypeScript" available!',
      description: 'Enhance your front-end skills with our latest offering.',
      actionButton: 'View Course',
      actionPath: '/courses',
      timestamp: '3 days ago',
      isRead: false,
    },
    {
      id: 5,
      type: 'system',
      icon: 'server',
      barColor: 'bg-blue-600',
      barColorValue: '#2563EB',
      title: 'Platform update: New AI matching algorithm deployed',
      description: 'Experience even more accurate job recommendations with our enhanced system.',
      actionButton: 'Learn More',
      actionPath: '/candidate-dashboard',
      timestamp: '4 days ago',
      isRead: false,
    },
    {
      id: 6,
      type: 'saved-search',
      icon: 'folder',
      barColor: 'bg-blue-400',
      barColorValue: '#60A5FA',
      title: 'Your saved search "Data Scientist" has 5 new openings!',
      description: "Don't miss out on these exciting opportunities.",
      actionButton: 'View Jobs',
      actionPath: '/explore-jobs',
      timestamp: '1 week ago',
      isRead: false,
    },
    {
      id: 7,
      type: 'application',
      icon: 'document',
      barColor: 'bg-purple-500',
      barColorValue: '#A855F7',
      title: 'Follow-up needed for "Marketing Specialist" application',
      description: 'Consider sending a polite follow-up email to the recruiter.',
      actionButton: 'Track Application',
      actionPath: '/applications/2',
      timestamp: '1 week ago',
      isRead: false,
    },
  ]);

  const filters = ['All', 'Jobs', 'Applications', 'Interviews', 'Courses', 'System'];

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'briefcase':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'calendar':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'book':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case 'server':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
      case 'folder':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getFilterType = (filter: string): Notification['type'] | null => {
    const filterMap: { [key: string]: Notification['type'] | null } = {
      'All': null,
      'Jobs': 'job',
      'Applications': 'application',
      'Interviews': 'interview',
      'Courses': 'course',
      'System': 'system',
    };
    return filterMap[filter] || null;
  };

  const filteredNotifications = activeFilter === 'All'
    ? notifications
    : notifications.filter(n => n.type === getFilterType(activeFilter));

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleAction = (path: string) => {
    router.push(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 px-6 py-8" style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Title Section */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Notifications
          </h1>
          <p className="text-lg text-gray-600">
            Stay updated with your job applications, alerts, and AI recommendations.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2 flex-wrap">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <button
            onClick={handleMarkAllAsRead}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Mark all as read
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4 mb-6">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${
                !notification.isRead ? 'border-l-4' : ''
              }`}
              style={{
                borderLeftColor: !notification.isRead ? notification.barColorValue : undefined,
              }}
            >
              <div className="flex items-start gap-4 p-6">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${notification.barColor} flex items-center justify-center text-white`}>
                  {getIcon(notification.icon)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {notification.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {notification.description}
                  </p>
                  <button
                    onClick={() => handleAction(notification.actionPath)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {notification.actionButton}
                  </button>
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 text-sm text-gray-500">
                  {notification.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        <div className="flex justify-center">
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
            Load More
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
