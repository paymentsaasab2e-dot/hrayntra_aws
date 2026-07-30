'use client';

import {
  apiCreateTenantPortalEvent,
  apiListTenantPortalEventRegistrations,
  apiListTenantPortalEvents,
  apiUpdateTenantPortalEvent,
  apiCancelTenantPortalEvent,
  apiDeleteTenantPortalEvent,
  apiUploadTenantPortalEventMedia,
} from '@/lib/portal-events-api';
import { PortalEventsManager } from '@/components/events/PortalEventsManager';

export default function TenantEventsPage() {
  return (
    <PortalEventsManager
      title="Portal events"
      subtitle="Create events for candidates on the job portal. Stored in the job portal database and visible on the public events page."
      listEvents={apiListTenantPortalEvents}
      createEvent={apiCreateTenantPortalEvent}
      updateEvent={apiUpdateTenantPortalEvent}
      cancelEvent={apiCancelTenantPortalEvent}
      deleteEvent={apiDeleteTenantPortalEvent}
      uploadMedia={apiUploadTenantPortalEventMedia}
      listRegistrations={apiListTenantPortalEventRegistrations}
      variant="module"
    />
  );
}
