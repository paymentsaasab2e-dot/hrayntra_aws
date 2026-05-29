import type { AuditMeta, AuditUserBrief } from '../types/audit';
import { formatDateDMY } from './dateDisplay';

type UserLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function resolveUserName(user?: UserLike | null): string | null {
  if (!user) return null;
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fromParts || user.name?.trim() || user.email?.trim() || null;
}

function toBrief(user?: UserLike | null): AuditUserBrief | null {
  if (!user) return null;
  const name = resolveUserName(user);
  if (!name && !user.email) return null;
  return {
    id: user.id ?? null,
    name: name || user.email || 'Unknown',
    email: user.email ?? null,
    avatar: user.avatar ?? null,
  };
}

/** Build audit meta from API row (prefers `auditMeta`, falls back to relations). */
export function extractAuditMeta(row: Record<string, unknown> | null | undefined): AuditMeta {
  if (!row) {
    return { createdAt: null, updatedAt: null, createdBy: null, updatedBy: null };
  }

  const preset = row.auditMeta as AuditMeta | undefined;
  if (preset && typeof preset === 'object') {
    return {
      createdAt: preset.createdAt ?? (row.createdAt as string) ?? null,
      updatedAt: preset.updatedAt ?? (row.updatedAt as string) ?? null,
      createdBy: preset.createdBy ?? toBrief(row.createdBy as UserLike),
      updatedBy: preset.updatedBy ?? toBrief((row.lastUpdatedBy ?? row.updatedBy) as UserLike),
    };
  }

  const createdBy =
    toBrief(row.createdBy as UserLike) ||
    toBrief(row._resolvedCreatedBy as UserLike) ||
    toBrief(row.recruiter as UserLike) ||
    toBrief(row.owner as UserLike);

  const updatedBy =
    toBrief((row.lastUpdatedBy ?? row.updatedBy) as UserLike) || null;

  return {
    createdAt: (row.createdAt as string) ?? null,
    updatedAt: (row.updatedAt as string) ?? null,
    createdBy,
    updatedBy,
  };
}

export function formatAuditDate(value: unknown): string {
  const formatted = formatDateDMY(value);
  return formatted || '—';
}

export function formatAuditUserLabel(user?: AuditUserBrief | null): string {
  if (!user?.name) return '—';
  return user.name;
}
