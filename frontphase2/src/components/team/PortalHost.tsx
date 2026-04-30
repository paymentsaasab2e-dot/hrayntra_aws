'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalHostProps {
  open: boolean;
  children: React.ReactNode;
}

export function PortalHost({ open, children }: PortalHostProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(children, document.body);
}
