export interface AuditUserBrief {
  id?: string | null;
  name: string;
  email?: string | null;
  avatar?: string | null;
}

export interface AuditMeta {
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: AuditUserBrief | null;
  updatedBy?: AuditUserBrief | null;
}
