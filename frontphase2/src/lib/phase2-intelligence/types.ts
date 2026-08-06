import type { DrawerAnalysisResult, OverdueMeetingIssue } from '@/lib/tenant-drawer-engine';

export type TenantIntelligenceSnapshot = {
  scannedAt: string;
  leadCount: number;
  clientCount: number;
  overdueFollowUps: number;
  overdueMeetings: number;
  incompleteLeads: number;
  incompleteClients: number;
  topOverdue: OverdueMeetingIssue[];
  incompleteLeadIds: string[];
  incompleteClientIds: string[];
  sampleIncomplete: Array<{
    entityKind: 'lead' | 'client';
    entityId: string;
    entityName: string;
    missingLabels: string[];
  }>;
};

export type TenantIntelligenceCache = {
  snapshot: TenantIntelligenceSnapshot;
  leadAnalyses: DrawerAnalysisResult[];
  clientAnalyses: DrawerAnalysisResult[];
};

export const TENANT_INTELLIGENCE_UPDATED_EVENT = 'saasa:tenant-intelligence-updated';
