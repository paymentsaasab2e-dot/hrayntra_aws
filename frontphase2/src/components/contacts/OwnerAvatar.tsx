'use client';

import React from 'react';
import { ImageWithFallback } from '../ImageWithFallback';

interface OwnerAvatarProps {
  owner: {
    id: string;
    name: string;
    email?: string;
    avatar?: string | null;
  };
}

export function OwnerAvatar({ owner }: OwnerAvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-2">
      <ImageWithFallback
        src={owner.avatar}
        alt={owner.name}
        className="w-6 h-6 rounded-full object-cover"
        fallback={
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-[10px]">
            {getInitials(owner.name)}
          </div>
        }
      />
      <span className="text-sm text-gray-700">{owner.name.split(' ')[0]}</span>
    </div>
  );
}
