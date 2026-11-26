'use client';

import React from 'react';
import { CrmDashboard } from '../../components/dashboard/crm/CrmDashboard';

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-[#F8FAFC] px-3 pb-4 pt-2 sm:px-4">
      <CrmDashboard />
    </div>
  );
}
