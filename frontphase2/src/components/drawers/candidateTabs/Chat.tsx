'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { MessageSquare } from 'lucide-react';
import { DrawerEntityChatTab } from '../DrawerEntityChatTab';

export function CandidateChatTab(props: any) {
  const {
    activeTab,
    candidate,
    isOpen,
  } = props;

  return (
<DrawerSectionCard
                    title="Chat"
                    subtitle={`Messages with ${candidate?.name || 'candidate'}`}
                    icon={MessageSquare}
                    accent="blue"
                  >
                    <DrawerEntityChatTab
                      entityType="CANDIDATE"
                      entityId={candidate?.id}
                      entityLabel={candidate?.name}
                      isActive={activeTab === 'Chat'}
                      isOpen={isOpen}
                    />
                  </DrawerSectionCard>
  );
}
