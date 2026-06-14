'use client';

import React from 'react';
import { ClientHandoffForm } from './ClientHandoffForm';

type Props = {
  clientId: string;
  clientName: string;
  onSent?: () => void;
};

export function CrossDepartmentClientHandoff({ clientId, clientName, onSent }: Props) {
  return (
    <ClientHandoffForm
      clientId={clientId}
      clientName={clientName}
      onSent={onSent}
      showHeader
      hideWhenUnavailable
    />
  );
}
