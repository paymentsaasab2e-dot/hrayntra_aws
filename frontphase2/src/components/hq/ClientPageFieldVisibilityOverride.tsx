'use client';

import React, { createContext, useContext } from 'react';
import type { ClientPageFieldVisibility } from '../lib/clientPageFieldVisibility';

const ClientPageFieldVisibilityOverrideContext =
  createContext<ClientPageFieldVisibility | null>(null);

export function ClientPageFieldVisibilityOverrideProvider({
  value,
  children,
}: {
  value: ClientPageFieldVisibility;
  children: React.ReactNode;
}) {
  return (
    <ClientPageFieldVisibilityOverrideContext.Provider value={value}>
      {children}
    </ClientPageFieldVisibilityOverrideContext.Provider>
  );
}

export function useClientPageFieldVisibilityOverride(): ClientPageFieldVisibility | null {
  return useContext(ClientPageFieldVisibilityOverrideContext);
}
