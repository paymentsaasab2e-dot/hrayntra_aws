import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

/** Lucide icons plus small custom SVGs that take size and className. */
export type AppIcon =
  | LucideIcon
  | ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
