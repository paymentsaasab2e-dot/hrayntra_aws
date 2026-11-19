import prisma from '../../shared/prisma';
import { logger } from '../../shared/logger';

export interface CreateComplianceDocumentInput {
  type: 'TOS' | 'PRIVACY_POLICY' | 'DPA' | 'SLA';
  title: string;
  version: string;
  content: string;
  summary?: string;
  effectiveDate?: Date | string;
  isMandatory?: boolean;
}

export interface PublishNewVersionInput {
  newVersion: string;
  title?: string;
  content?: string;
  summary?: string;
  effectiveDate?: Date | string;
  isMandatory?: boolean;
}

export class ComplianceService {
  /**
   * Seed default versioned legal documents (ToS, Privacy Policy, DPA, SLA)
   */
  static async seedDefaultDocuments(tenantId: string, publishedByUserId?: string) {
    const defaults = [
      {
        type: 'TOS',
        title: 'Master Terms of Service (ToS)',
        version: '1.0',
        content: `# Enterprise Terms of Service (v1.0)
**Effective Date:** January 1, 2026
**Governing Jurisdiction:** India / Information Technology Act, 2000

## 1. Acceptance of Terms
By accessing or using this HRMS Enterprise Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.

## 2. Acceptable Use Policy
- Users must access the platform exclusively using authorized corporate credentials.
- Multi-factor authentication tokens and passwords must not be shared.
- Punch records, leave applications, and statutory claims must accurately reflect true work activities.
- Anti-tampering and anti-spoofing measures are continuously active.

## 3. Employer & Employee Obligations
Employees agree to submit accurate attendance, tax declarations, and nominee information. Misrepresentation of dependents, medical records, or leave reasons may be subject to internal disciplinary proceedings.

## 4. Termination & Access Revocation
Upon separation or notice period completion, system access will be terminated automatically according to HR clearance protocols.`,
        summary: 'Standard enterprise terms of service governing workplace portal usage, access obligations, and credential security.',
        isMandatory: true,
      },
      {
        type: 'PRIVACY_POLICY',
        title: 'Workplace Privacy Policy & Notice',
        version: '1.0',
        content: `# Workplace Privacy Policy & Data Processing Notice (v1.0)
**Compliance:** Digital Personal Data Protection Act (DPDP Act 2023) & GDPR

## 1. Data Collected
We collect and process personal data necessary for employment administration:
- **Identification:** Legal name, government identifiers (PAN, Aadhaar/Passport), employee code.
- **Biometric & Attendance:** Geolocation check-ins, punch timestamps, IP addresses for compliance verification.
- **Statutory Beneficiaries:** Emergency contacts, dependent relations, and EPF/Gratuity nominees.
- **Financial Data:** Bank account numbers, salary structures, tax deductions, and investment declarations.

## 2. Lawful Grounds for Processing
Processing is carried out under the legal basis of employment contract execution, statutory compliance (Provident Fund Act, Gratuity Act, Maternity Benefit Act), and legitimate workplace management.

## 3. Data Retention & Employee Rights
Employee records are retained for the statutory retention periods mandated by labor law (typically 8 years post-separation). You may inspect your personal profile and submit change requests through the Self-Service Portal.`,
        summary: 'Employee privacy notice compliant with DPDP Act 2023 covering biometric, financial, and beneficiary data handling.',
        isMandatory: true,
      },
      {
        type: 'DPA',
        title: 'Data Processing Agreement (DPA)',
        version: '1.0',
        content: `# Enterprise Data Processing Agreement (v1.0)
**Schedule of Processing Operations**

## 1. Scope & Purpose
This Data Processing Agreement establishes data security protocols governing employee personal data, payroll computations, and health/leave documentation stored within the cloud platform.

## 2. Technical and Organizational Measures (TOMs)
- **Encryption:** AES-256 at rest, TLS 1.3 in transit.
- **Access Controls:** Role-Based Access Control (RBAC) with granular tenant isolation.
- **Audit Trails:** Immutable logging of terms acceptance, punch events, and profile updates with IP addresses and timestamps.

## 3. Security Breach Notification
In the event of a confirmed security incident affecting employee data, notifications will be issued to regulatory bodies and affected users within 72 hours as prescribed by law.`,
        summary: 'Technical and organizational security commitments, data encryption benchmarks, and incident response SLAs.',
        isMandatory: true,
      },
      {
        type: 'SLA',
        title: 'Platform Service Level Agreement (SLA)',
        version: '1.0',
        content: `# Platform Service Level Agreement (v1.0)

## 1. Availability Commitment
The HRMS Enterprise Platform guarantees 99.9% uptime during standard business operating hours, excluding scheduled maintenance windows notified 48 hours in advance.

## 2. Incident Severity Levels & Response Times
- **P1 (Critical Outage - Attendance/Payroll Down):** Response within 15 minutes; target resolution < 4 hours.
- **P2 (Major Feature Impairment - Approvals/Leaves):** Response within 1 hour; target resolution < 8 hours.
- **P3 (Minor Issue / Query):** Response within 4 business hours.

## 3. Data Backup & RPO/RTO
Automated database snapshots occur every 6 hours with a Recovery Point Objective (RPO) of < 1 hour and Recovery Time Objective (RTO) of < 2 hours.`,
        summary: 'Service availability commitments, priority support response tiers, and backup recovery objectives.',
        isMandatory: false,
      },
    ];

    const results = [];
    for (const doc of defaults) {
      const existing = await prisma.complianceDocument.findUnique({
        where: {
          tenantId_type_version: {
            tenantId,
            type: doc.type,
            version: doc.version,
          },
        },
      });

      if (!existing) {
        const created = await prisma.complianceDocument.create({
          data: {
            tenantId,
            type: doc.type,
            title: doc.title,
            version: doc.version,
            content: doc.content,
            summary: doc.summary,
            isMandatory: doc.isMandatory,
            isActive: true,
            publishedByUserId,
          },
        });
        results.push(created);
      } else {
        results.push(existing);
      }
    }

    logger.info('compliance.defaults.seeded', { tenantId, count: results.length });
    return results;
  }

  /**
   * List all documents for tenant with acceptance status for the querying user
   */
  static async listDocuments(tenantId: string, currentUserId?: string) {
    const docs = await prisma.complianceDocument.findMany({
      where: { tenantId },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });

    if (!currentUserId) {
      return docs;
    }

    // Fetch user acceptances
    const userAcceptances = await prisma.complianceAcceptance.findMany({
      where: {
        tenantId,
        userId: currentUserId,
      },
    });

    const acceptanceMap = new Map<string, any>();
    userAcceptances.forEach((acc: any) => {
      // Key: docId + version
      acceptanceMap.set(`${acc.documentId}_${acc.versionAccepted}`, acc);
    });

    return docs.map((doc: any) => {
      const accepted = acceptanceMap.get(`${doc.id}_${doc.version}`);
      return {
        ...doc,
        isAccepted: !!accepted,
        acceptedAt: accepted?.acceptedAt || null,
        acceptedIp: accepted?.ipAddress || null,
        acceptedVersion: accepted?.versionAccepted || null,
      };
    });
  }

  /**
   * Get pending mandatory agreements that the user must sign
   */
  static async getPendingAcceptances(tenantId: string, userId: string) {
    // 1. Get all active mandatory documents
    const mandatoryDocs = await prisma.complianceDocument.findMany({
      where: {
        tenantId,
        isActive: true,
        isMandatory: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (mandatoryDocs.length === 0) {
      return [];
    }

    // 2. Get user acceptances for these documents
    const userAcceptances = await prisma.complianceAcceptance.findMany({
      where: {
        tenantId,
        userId,
        documentId: { in: mandatoryDocs.map((d: any) => d.id) },
      },
    });

    const acceptedDocVersionSet = new Set(
      userAcceptances.map((acc: any) => `${acc.documentId}_${acc.versionAccepted}`)
    );

    // 3. Filter for documents where current version is not accepted
    return mandatoryDocs.filter(
      (doc: any) => !acceptedDocVersionSet.has(`${doc.id}_${doc.version}`)
    );
  }

  /**
   * Record user's acceptance of a specific compliance document
   */
  static async acceptDocument(params: {
    tenantId: string;
    userId: string;
    employeeId?: string | null;
    documentId: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    const { tenantId, userId, employeeId, documentId, ipAddress, userAgent, metadata } = params;

    const doc = await prisma.complianceDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!doc) {
      throw new Error('Compliance document not found');
    }

    if (!doc.isActive) {
      throw new Error('Cannot accept an inactive or deprecated document');
    }

    // Find or create acceptance
    const existing = await prisma.complianceAcceptance.findUnique({
      where: {
        tenantId_userId_documentId_versionAccepted: {
          tenantId,
          userId,
          documentId: doc.id,
          versionAccepted: doc.version,
        },
      },
    });

    if (existing) {
      return {
        alreadyAccepted: true,
        acceptance: existing,
      };
    }

    const acceptance = await prisma.complianceAcceptance.create({
      data: {
        tenantId,
        userId,
        employeeId: employeeId || null,
        documentId: doc.id,
        documentType: doc.type,
        versionAccepted: doc.version,
        acceptedAt: new Date(),
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent || 'HRMS-Client',
        metadata: metadata || {},
      },
    });

    logger.info('compliance.terms.accepted', {
      tenantId,
      userId,
      documentId: doc.id,
      type: doc.type,
      version: doc.version,
      ipAddress,
    });

    return {
      alreadyAccepted: false,
      acceptance,
    };
  }

  /**
   * Accept all pending mandatory documents in bulk (e.g. initial login agreement checkbox)
   */
  static async acceptAllPending(params: {
    tenantId: string;
    userId: string;
    employeeId?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const pending = await this.getPendingAcceptances(params.tenantId, params.userId);
    const results = [];

    for (const doc of pending) {
      const res = await this.acceptDocument({
        ...params,
        documentId: doc.id,
      });
      results.push(res);
    }

    return {
      count: results.length,
      acceptedDocuments: pending.map((d: any) => ({ id: d.id, title: d.title, version: d.version })),
    };
  }

  /**
   * Publish a new version of a compliance document (e.g. bump v1.0 -> v2.0)
   * This immediately makes all prior acceptances outdated for the new version.
   */
  static async publishNewVersion(
    tenantId: string,
    documentId: string,
    input: PublishNewVersionInput,
    publishedByUserId?: string
  ) {
    const currentDoc = await prisma.complianceDocument.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!currentDoc) {
      throw new Error('Compliance document not found');
    }

    if (input.newVersion === currentDoc.version) {
      throw new Error(`New version number must be different from current version (${currentDoc.version})`);
    }

    // Check if new version already exists for this document type
    const duplicate = await prisma.complianceDocument.findUnique({
      where: {
        tenantId_type_version: {
          tenantId,
          type: currentDoc.type,
          version: input.newVersion,
        },
      },
    });

    if (duplicate) {
      throw new Error(`Document of type ${currentDoc.type} with version ${input.newVersion} already exists`);
    }

    // Deactivate old version
    await prisma.complianceDocument.update({
      where: { id: currentDoc.id },
      data: { isActive: false },
    });

    // Create new active version document
    const newDoc = await prisma.complianceDocument.create({
      data: {
        tenantId,
        type: currentDoc.type,
        title: input.title || currentDoc.title,
        version: input.newVersion,
        content: input.content || currentDoc.content,
        summary: input.summary || `Updated from version ${currentDoc.version}`,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : new Date(),
        isMandatory: input.isMandatory !== undefined ? input.isMandatory : currentDoc.isMandatory,
        isActive: true,
        publishedByUserId,
      },
    });

    logger.info('compliance.version.published', {
      tenantId,
      type: currentDoc.type,
      oldVersion: currentDoc.version,
      newVersion: newDoc.version,
      publishedByUserId,
    });

    return newDoc;
  }

  /**
   * Retrieve audit logs of acceptances with employee/user details
   */
  static async getAcceptanceAuditTrail(
    tenantId: string,
    filters: {
      documentId?: string;
      documentType?: string;
      userId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.documentId) where.documentId = filters.documentId;
    if (filters.documentType) where.documentType = filters.documentType;
    if (filters.userId) where.userId = filters.userId;

    const [total, items] = await Promise.all([
      prisma.complianceAcceptance.count({ where }),
      prisma.complianceAcceptance.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, displayName: true, role: true },
          },
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, department: true },
          },
          document: {
            select: { id: true, title: true, type: true, version: true },
          },
        },
        orderBy: { acceptedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  /**
   * Get compliance overview statistics for Admin dashboard
   */
  static async getComplianceOverview(tenantId: string) {
    const [totalUsers, mandatoryDocs, allAcceptances] = await Promise.all([
      prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.complianceDocument.findMany({
        where: { tenantId, isActive: true, isMandatory: true },
      }),
      prisma.complianceAcceptance.findMany({
        where: { tenantId },
        select: { userId: true, documentId: true, versionAccepted: true, documentType: true },
      }),
    ]);

    const docStats = mandatoryDocs.map((doc: any) => {
      const acceptedUsers = new Set(
        allAcceptances
          .filter((a: any) => a.documentId === doc.id && a.versionAccepted === doc.version)
          .map((a: any) => a.userId)
      );

      const acceptedCount = acceptedUsers.size;
      const rate = totalUsers > 0 ? Math.round((acceptedCount / totalUsers) * 100) : 100;

      return {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        version: doc.version,
        acceptedCount,
        totalUsers,
        complianceRatePercent: rate,
        pendingCount: Math.max(0, totalUsers - acceptedCount),
      };
    });

    const overallRate =
      docStats.length > 0
        ? Math.round(docStats.reduce((acc: number, curr: any) => acc + curr.complianceRatePercent, 0) / docStats.length)
        : 100;

    return {
      totalUsers,
      mandatoryDocumentsCount: mandatoryDocs.length,
      overallComplianceRatePercent: overallRate,
      documents: docStats,
    };
  }
}
