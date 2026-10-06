'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { MessageSquare } from 'lucide-react';
import { DrawerEntityChatTab } from '../DrawerEntityChatTab';
import type { ChatTabProps } from '../jobDrawerTabProps';

export function ChatTab(props: ChatTabProps) {
  const {
    activeTab,
    isOpen,
    job,
  } = props;

  return (
<DrawerSectionCard
                  title="Chat"
                  subtitle={`Messages for ${job.title}`}
                  icon={MessageSquare}
                  accent="blue"
                >
                  <DrawerEntityChatTab
                    entityType="JOB"
                    entityId={job.id}
                    entityLabel={job.title}
                    isActive={activeTab === 'chat'}
                    isOpen={isOpen}
                  />
                </DrawerSectionCard>
  );
}
