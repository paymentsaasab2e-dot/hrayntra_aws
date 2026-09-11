export type DrawerEntityKind = 'lead' | 'client';

export type MissingFieldIssue = {
  field: string;
  label: string;
  message: string;
};

export type OverdueMeetingIssue = {
  id: string;
  title: string;
  at: string;
  kind: 'followup' | 'meeting';
  entityKind: DrawerEntityKind;
  entityId: string;
  entityName: string;
  /** overdue = past due; upcoming = due soon (not yet past) */
  urgency?: 'overdue' | 'upcoming';
};

export type DrawerAnalysisResult = {
  entityKind: DrawerEntityKind;
  entityId: string;
  entityName: string;
  missingFields: MissingFieldIssue[];
  overdueMeetings: OverdueMeetingIssue[];
  upcomingMeetings: OverdueMeetingIssue[];
};

export type TenantOverdueScanResult = {
  overdueMeetings: OverdueMeetingIssue[];
  upcomingMeetings: OverdueMeetingIssue[];
  scannedAt: string;
};
