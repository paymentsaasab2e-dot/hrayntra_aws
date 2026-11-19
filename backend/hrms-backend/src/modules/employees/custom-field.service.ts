import prisma from '../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../shared/org/org-scope.service';
import { requireTenantId } from '../../shared/tenant/tenant-scope';
import { CustomFieldType, CustomFieldSection } from '@prisma/client';

export const DEFAULT_CUSTOM_FIELD_TEMPLATES: Array<{
  key: string;
  label: string;
  type: CustomFieldType;
  section: CustomFieldSection;
  options?: string[];
  placeholder?: string;
  description?: string;
  required?: boolean;
}> = [
  {
    key: 'blood_group',
    label: 'Blood Group',
    type: 'SELECT',
    section: 'PERSONAL',
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    placeholder: 'Select blood group',
    description: 'Vital medical information in case of workplace emergencies',
  },
  {
    key: 'seat_number',
    label: 'Seat / Desk Number',
    type: 'TEXT',
    section: 'WORK_DETAILS',
    placeholder: 'e.g. Floor 2, Bay 4-12',
    description: 'Physical work station allocation inside company premises',
  },
  {
    key: 'access_card_id',
    label: 'Access Card / Badge ID',
    type: 'TEXT',
    section: 'WORK_DETAILS',
    placeholder: 'e.g. RFID-88319',
    description: 'Physical badge or RFID number for turnstile entry',
  },
  {
    key: 'tshirt_size',
    label: 'T-Shirt / Uniform Size',
    type: 'SELECT',
    section: 'PERSONAL',
    options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    placeholder: 'Select size',
    description: 'Company merchandise, hackathons, and corporate kit sizing',
  },
  {
    key: 'emergency_relation',
    label: 'Emergency Contact Relationship',
    type: 'SELECT',
    section: 'PERSONAL',
    options: ['Spouse', 'Parent', 'Sibling', 'Child', 'Guardian', 'Friend', 'Other'],
    placeholder: 'Select relationship',
    description: 'Relationship of primary emergency contact person',
  },
  {
    key: 'primary_skillset',
    label: 'Primary Tech / Skillset',
    type: 'TEXT',
    section: 'WORK_DETAILS',
    placeholder: 'e.g. React, Node.js, AWS, PostgreSQL',
    description: 'Core competencies and technical domain specializations',
  },
  {
    key: 'cost_center_code',
    label: 'Cost Center Code',
    type: 'TEXT',
    section: 'WORK_DETAILS',
    placeholder: 'e.g. CC-IND-2026',
    description: 'Internal finance billing tag for department project accounting',
  },
  {
    key: 'passport_expiry',
    label: 'Passport Expiry Date',
    type: 'DATE',
    section: 'COMPLIANCE_KYC',
    placeholder: 'YYYY-MM-DD',
    description: 'For international deputation and business travel compliance',
  },
];

export class CustomFieldService {
  /**
   * List custom field definitions for the active tenant.
   * Auto-seeds standard enterprise default templates if none exist yet!
   */
  static async listDefinitions(scope: OrgScopeContext, includeInactive = false) {
    const tenantId = requireTenantId(scope);
    const whereClause: any = { tenantId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    let definitions = await prisma.customFieldDefinition.findMany({
      where: whereClause,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    // Auto-seed enterprise defaults if this tenant has 0 custom fields defined
    if (definitions.length === 0) {
      await this.seedDefaults(tenantId);
      definitions = await prisma.customFieldDefinition.findMany({
        where: whereClause,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
    }

    return definitions;
  }

  /**
   * Seed standard enterprise templates for a tenant.
   */
  static async seedDefaults(tenantId: string) {
    for (let i = 0; i < DEFAULT_CUSTOM_FIELD_TEMPLATES.length; i++) {
      const t = DEFAULT_CUSTOM_FIELD_TEMPLATES[i];
      await prisma.customFieldDefinition.upsert({
        where: { tenantId_key: { tenantId, key: t.key } },
        update: {},
        create: {
          tenantId,
          key: t.key,
          label: t.label,
          type: t.type,
          section: t.section,
          options: t.options || [],
          placeholder: t.placeholder || null,
          description: t.description || null,
          required: Boolean(t.required),
          isActive: true,
          order: i,
        },
      });
    }
  }

  /**
   * Create a new custom field definition.
   */
  static async createDefinition(
    scope: OrgScopeContext,
    data: {
      key?: string;
      label: string;
      type: CustomFieldType;
      section?: CustomFieldSection;
      options?: string[];
      required?: boolean;
      placeholder?: string;
      description?: string;
      order?: number;
    }
  ) {
    const tenantId = requireTenantId(scope);

    // Auto-derive clean key from label if not explicitly provided
    const key = (data.key || data.label)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!key) {
      throw new Error('Valid field key or label is required');
    }

    const existing = await prisma.customFieldDefinition.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (existing) {
      throw new Error(`Custom field with key "${key}" already exists in your organization`);
    }

    const maxOrder = await prisma.customFieldDefinition.aggregate({
      where: { tenantId },
      _max: { order: true },
    });

    const nextOrder = data.order !== undefined ? data.order : (maxOrder._max.order ?? -1) + 1;

    return prisma.customFieldDefinition.create({
      data: {
        tenantId,
        key,
        label: data.label.trim(),
        type: data.type || 'TEXT',
        section: data.section || 'PERSONAL',
        options: Array.isArray(data.options) ? data.options : [],
        required: Boolean(data.required),
        placeholder: data.placeholder || null,
        description: data.description || null,
        order: nextOrder,
        isActive: true,
      },
    });
  }

  /**
   * Update an existing custom field definition.
   */
  static async updateDefinition(
    scope: OrgScopeContext,
    id: string,
    data: {
      label?: string;
      section?: CustomFieldSection;
      options?: string[];
      required?: boolean;
      placeholder?: string;
      description?: string;
      isActive?: boolean;
      order?: number;
    }
  ) {
    const tenantId = requireTenantId(scope);
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error('Custom field definition not found');
    }

    return prisma.customFieldDefinition.update({
      where: { id },
      data: {
        label: data.label !== undefined ? data.label.trim() : undefined,
        section: data.section,
        options: Array.isArray(data.options) ? data.options : undefined,
        required: data.required !== undefined ? Boolean(data.required) : undefined,
        placeholder: data.placeholder !== undefined ? data.placeholder : undefined,
        description: data.description !== undefined ? data.description : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        order: data.order !== undefined ? data.order : undefined,
      },
    });
  }

  /**
   * Delete a custom field definition.
   */
  static async deleteDefinition(scope: OrgScopeContext, id: string) {
    const tenantId = requireTenantId(scope);
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error('Custom field definition not found');
    }

    await prisma.customFieldDefinition.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Save / merge custom field values for a specific employee.
   */
  static async updateEmployeeCustomFields(
    scope: OrgScopeContext,
    employeeId: string,
    values: Record<string, any>
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, ...employeeWhereFromScope(scope) },
    });
    if (!employee) {
      throw new Error('Employee not found or access unauthorized');
    }

    const currentCustomFields = (employee.customFields as Record<string, any>) || {};
    const merged = { ...currentCustomFields, ...values };

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        customFields: merged,
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        customFields: true,
      },
    });

    return updated;
  }
}
