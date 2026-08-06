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
};

export type DrawerAnalysisResult = {
  entityKind: DrawerEntityKind;
  entityId: string;
  entityName: string;
  missingFields: MissingFieldIssue[];
  overdueMeetings: OverdueMeetingIssue[];
};

export type TenantOverdueScanResult = {
  overdueMeetings: OverdueMeetingIssue[];
  scannedAt: string;
};
