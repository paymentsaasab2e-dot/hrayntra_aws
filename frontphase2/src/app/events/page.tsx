'use client';

import {
  apiCreateTenantPortalEvent,
  apiListTenantPortalEventRegistrations,
  apiListTenantPortalEvents,
} from '@/lib/portal-events-api';
import { PortalEventsManager } from '@/components/events/PortalEventsManager';

export default function TenantEventsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <PortalEventsManager
          title="Portal events"
          subtitle="Create events for candidates on the job portal. Stored in the job portal database and visible on the public events page."
          listEvents={apiListTenantPortalEvents}
          createEvent={apiCreateTenantPortalEvent}
          listRegistrations={apiListTenantPortalEventRegistrations}
        />
      </div>
    </div>
  );
}
