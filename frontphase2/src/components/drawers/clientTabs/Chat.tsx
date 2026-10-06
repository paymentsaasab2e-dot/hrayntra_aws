'use client';

import React from 'react';
import { DrawerEntityChatTab } from '../DrawerEntityChatTab';

export function ClientChatTab(props: any) {
  const {
    activeTab,
    client,
    propIsAddMode,
  } = props;

  return (
<DrawerEntityChatTab
                    entityType="CLIENT"
                    entityId={client?.id}
                    entityLabel={client?.name}
                    isActive={activeTab === 'chat'}
                    isOpen={Boolean(client) || propIsAddMode}
                  />
  );
}
