'use client';

import {
  apiCreateHqPortalEvent,
  apiListHqPortalEventRegistrations,
  apiListHqPortalEvents,
} from '@/lib/portal-events-api';
import { PortalEventsManager } from '@/components/events/PortalEventsManager';
import { HqPageContainer, HqPageHeader, HqPageMain } from '@/components/hq/hqUi';

export default function HqEventsPage() {
  return (
    <HqPageContainer>
      <HqPageHeader title="Portal events" subtitle="HQ-published events on the candidate job portal" />
      <HqPageMain>
        <PortalEventsManager
          title="HQ events"
          subtitle="Create HQ events stored in the job portal database. Only you can see applicants for events you created."
          listEvents={apiListHqPortalEvents}
          createEvent={apiCreateHqPortalEvent}
          listRegistrations={apiListHqPortalEventRegistrations}
        />
      </HqPageMain>
    </HqPageContainer>
  );
}
