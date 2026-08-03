'use client';

import { CalendarDays } from 'lucide-react';
import {
  apiCreateHqPortalEvent,
  apiListHqPortalEventRegistrations,
  apiListHqPortalEvents,
  apiUpdateHqPortalEvent,
  apiCancelHqPortalEvent,
  apiDeleteHqPortalEvent,
  apiUploadHqPortalEventMedia,
} from '@/lib/portal-events-api';
import { PortalEventsManager } from '@/components/events/PortalEventsManager';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';

export default function HqEventsPage() {
  return (
    <HqModulePageLayout
      title="Portal events"
      subtitle="HQ-published events on the candidate job portal"
      icon={<CalendarDays className="h-5 w-5" />}
      locked={false}
    >
      <PortalEventsManager
        title="HQ events"
        subtitle="Create HQ events stored in the job portal database. Only you can see applicants for events you created."
        listEvents={apiListHqPortalEvents}
        createEvent={apiCreateHqPortalEvent}
        updateEvent={apiUpdateHqPortalEvent}
        cancelEvent={apiCancelHqPortalEvent}
        deleteEvent={apiDeleteHqPortalEvent}
        uploadMedia={apiUploadHqPortalEventMedia}
        listRegistrations={apiListHqPortalEventRegistrations}
      />
    </HqModulePageLayout>
  );
}
