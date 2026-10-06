'use client';

import React from 'react';
import { DrawerEntityChatTab } from '../DrawerEntityChatTab';

export function LeadChatTab(props: any) {
  const {
    activeTab,
    lead,
  } = props;

  return (
<DrawerEntityChatTab
                  entityType="LEAD"
                  entityId={lead?.id}
                  entityLabel={lead?.companyName || lead?.contactName}
                  isActive={activeTab === 'chat'}
                  isOpen={Boolean(lead)}
                />
  );
}
