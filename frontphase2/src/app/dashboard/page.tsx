'use client';

import React from 'react';
import { CrmDashboard } from '../../components/dashboard/crm/CrmDashboard';

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-[#F8FAFC] p-3 sm:p-5 lg:p-6">
      <CrmDashboard />
    </div>
  );
}
