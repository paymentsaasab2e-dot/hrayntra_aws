import fs from 'fs';
import path from 'path';
import prisma from '../../shared/prisma';
import { DEFAULT_HR_RULES, mergeRules, TenantHrRules, totalAnnualLeaveDays } from './policy-rules';

async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text?.slice(0, 50000) || null;
  } catch {
    return null;
  }
}

export class PolicyService {
  static async getActiveRules(tenantId: string): Promise<TenantHrRules> {
    const active = await prisma.policyVersion.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { publishedAt: 'desc' },
    });
    return mergeRules(active?.rules as TenantHrRules | null);
  }

  static async listDocuments(tenantId: string) {
    const docs = await prisma.policyDocument.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 3 },
      },
    });
    return docs;
  }

  static async getDocument(id: string, tenantId: string) {
    const doc = await prisma.policyDocument.findFirst({
      where: { id, tenantId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!doc) throw new Error('Policy document not found');
    return doc;
  }

  static async createFromUpload(
    tenantId: string,
    userId: string,
    data: { title: string; file?: Express.Multer.File }
  ) {
    const title = String(data.title || 'Leave & Attendance Policy').trim();
    let fileName: string | null = null;
    let fileUrl: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;
    let extractedText: string | null = null;

    if (data.file) {
      fileName = data.file.originalname;
      mimeType = data.file.mimetype;
      fileSize = data.file.size;
      fileUrl = `/uploads/policies/${tenantId}/${data.file.filename}`;
      if (data.file.mimetype === 'application/pdf') {
        extractedText = await extractPdfText(data.file.path);
      }
    }

    return prisma.policyDocument.create({
      data: {
        tenantId,
        title,
        category: 'LEAVE_ATTENDANCE',
        fileName,
        fileUrl,
        mimeType,
        fileSize,
        extractedText,
        draftRules: DEFAULT_HR_RULES as any,
        status: 'DRAFT',
        uploadedByUserId: userId,
      },
    });
  }

  static async createManual(tenantId: string, userId: string, title: string) {
    return prisma.policyDocument.create({
      data: {
        tenantId,
        title: title.trim() || 'Leave & Attendance Policy',
        category: 'LEAVE_ATTENDANCE',
        draftRules: DEFAULT_HR_RULES as any,
        status: 'DRAFT',
        uploadedByUserId: userId,
      },
    });
  }

  static async updateDraftRules(id: string, tenantId: string, rules: Partial<TenantHrRules>) {
    const doc = await this.getDocument(id, tenantId);
    const merged = mergeRules({ ...(doc.draftRules as TenantHrRules), ...rules });
    return prisma.policyDocument.update({
      where: { id },
      data: { draftRules: merged as any },
    });
  }

  static async publish(id: string, tenantId: string, userId: string) {
    const doc = await this.getDocument(id, tenantId);
    const rules = mergeRules(doc.draftRules as TenantHrRules);

    const lastVersion = await prisma.policyVersion.findFirst({
      where: { policyDocumentId: id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;

    await prisma.policyVersion.updateMany({
      where: { tenantId, isActive: true },
      data: { isActive: false },
    });

    const version = await prisma.policyVersion.create({
      data: {
        policyDocumentId: id,
        tenantId,
        version: nextVersion,
        effectiveFrom: new Date(),
        publishedAt: new Date(),
        publishedByUserId: userId,
        rules: rules as any,
        isActive: true,
      },
    });

    await prisma.policyDocument.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });

    return { document: await this.getDocument(id, tenantId), version, rules };
  }

  static async getActive(tenantId: string) {
    const version = await prisma.policyVersion.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { publishedAt: 'desc' },
      include: { policyDocument: true },
    });
    if (!version) {
      return { rules: DEFAULT_HR_RULES, version: null, totalAnnualLeaveDays: totalAnnualLeaveDays(DEFAULT_HR_RULES) };
    }
    const rules = mergeRules(version.rules as TenantHrRules);
    return {
      rules,
      version: {
        id: version.id,
        version: version.version,
        publishedAt: version.publishedAt,
        documentTitle: version.policyDocument.title,
      },
      totalAnnualLeaveDays: totalAnnualLeaveDays(rules),
    };
  }

  static async updateActiveRules(tenantId: string, userId: string, rules: Partial<TenantHrRules>) {
    const active = await prisma.policyVersion.findFirst({
      where: { tenantId, isActive: true },
      include: { policyDocument: true },
    });

    const merged = mergeRules(
      active ? (active.rules as TenantHrRules) : DEFAULT_HR_RULES
    );
    const finalRules = mergeRules({ ...merged, ...rules });

    if (active) {
      await prisma.policyVersion.update({
        where: { id: active.id },
        data: { rules: finalRules as any },
      });
      if (active.policyDocumentId) {
        await prisma.policyDocument.update({
          where: { id: active.policyDocumentId },
          data: { draftRules: finalRules as any },
        });
      }
      return { rules: finalRules, versionId: active.id };
    }

    const doc = await prisma.policyDocument.create({
      data: {
        tenantId,
        title: 'Tenant HR Policy',
        category: 'LEAVE_ATTENDANCE',
        draftRules: finalRules as any,
        status: 'PUBLISHED',
        uploadedByUserId: userId,
      },
    });

    const version = await prisma.policyVersion.create({
      data: {
        policyDocumentId: doc.id,
        tenantId,
        version: 1,
        effectiveFrom: new Date(),
        publishedAt: new Date(),
        publishedByUserId: userId,
        rules: finalRules as any,
        isActive: true,
      },
    });

    return { rules: finalRules, versionId: version.id };
  }

  static async acknowledge(versionId: string, userId: string) {
    const existing = await prisma.policyAcknowledgment.findFirst({
      where: { policyVersionId: versionId, userId },
    });
    if (existing) return existing;
    return prisma.policyAcknowledgment.create({
      data: { policyVersionId: versionId, userId },
    });
  }
}
