'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const BASE_TITLE = 'HRYANTRA';

const TITLE_BY_ROUTE: Array<{ route: string; title: string }> = [
  { route: '/dashboard', title: 'Dashboard' },
  { route: '/leads', title: 'Leads' },
  { route: '/client', title: 'Clients' },
  { route: '/job', title: 'Jobs' },
  { route: '/candidate', title: 'Candidates' },
  { route: '/interviews', title: 'Interviews' },
  { route: '/placements', title: 'Placements' },
  { route: '/placement', title: 'Placements' },
  { route: '/hq', title: 'Recruitment Hub' },
  { route: '/pipeline', title: 'Pipeline' },
  { route: '/matches', title: 'Matches' },
  { route: '/Task&Activites', title: 'Tasks & Activities' },
  { route: '/inbox', title: 'Inbox' },
  { route: '/contacts', title: 'Contacts' },
  { route: '/reports', title: 'Reports' },
  { route: '/billing', title: 'Billing' },
  { route: '/team-management', title: 'Team Management' },
  { route: '/team', title: 'Team' },
  { route: '/request', title: 'Requests' },
  { route: '/subscription', title: 'Subscription' },
  { route: '/setting', title: 'Settings' },
  { route: '/administration', title: 'Administration' },
  { route: '/demoAi', title: 'Resume Parsing' },
];

function getTitleFromPath(pathname: string): string {
  for (const entry of TITLE_BY_ROUTE) {
    if (pathname === entry.route || pathname.startsWith(`${entry.route}/`)) {
      return entry.title;
    }
  }
  return BASE_TITLE;
}

export function PageTitleSync() {
  const pathname = usePathname();

  useEffect(() => {
    const pageTitle = getTitleFromPath(pathname || '');
    document.title = pageTitle === BASE_TITLE ? BASE_TITLE : `${pageTitle} | ${BASE_TITLE}`;
  }, [pathname]);

  return null;
}

