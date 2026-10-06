'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Tag } from 'lucide-react';
import { CandidateTagSystem } from '../candidateProfileShared';

export function CandidateTagsTab(props: any) {
  const {
    availableTags,
    candidate,
    onAddTag,
    onCreateTag,
    onRemoveTag,
  } = props;

  return (
<DrawerSectionCard
                    title="Tags"
                    subtitle="Organize and filter candidates"
                    icon={Tag}
                    accent="violet"
                  >
                      <CandidateTagSystem
                        candidateId={candidate.id}
                        existingTags={candidate.tags || []}
                        availableTags={availableTags}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                        onCreateTag={onCreateTag}
                      />
                  </DrawerSectionCard>
  );
}
