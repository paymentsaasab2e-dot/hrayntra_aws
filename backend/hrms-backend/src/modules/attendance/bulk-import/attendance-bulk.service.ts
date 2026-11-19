import prisma from '../../../shared/prisma';
import { OrgScopeContext } from '../../../shared/org/org-scope.service';
import { requireTenantId } from '../../../shared/tenant/tenant-scope';
import { AttendanceStatus } from '@prisma/client';

export interface RawAttendanceRow {
  rowNumber?: number;
  employeeId?: string; // Custom employeeId like "EMP-001" or ObjectId
  email?: string;
  date: string; // "YYYY-MM-DD"
  checkInTime: string; // "09:00" or ISO string
  checkOutTime?: string; // "18:00" or ISO string
  status?: string; // "PRESENT", "HALF_DAY", "ABSENT", or auto-calculate
  shiftCode?: string;
  remarks?: string;
}

export interface ValidatedAttendanceRow {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  actionType: 'NEW_RECORD' | 'UPDATE_CORRECTION' | 'INVALID';
  employeeRecordId?: string;
  employeeCode?: string;
  employeeName?: string;
  department?: string;
  dateStr: string;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  durationHours: number;
  computedStatus: AttendanceStatus;
  originalAttendance?: {
    id: string;
    checkInTime: Date;
    checkOutTime: Date | null;
    status: AttendanceStatus;
  } | null;
  remarks?: string;
}

export class AttendanceBulkService {
  /**
   * Generates a sample CSV structure for bulk attendance download
   */
  static getSampleTemplate(): string {
    const header = 'employeeId,email,date,checkInTime,checkOutTime,remarks';
    const sampleRows = [
      'EMP-001,sarah.connor@hryantra.com,2026-11-01,09:00:00,18:00:00,Regular Day Shift',
      'EMP-002,michael.chang@hryantra.com,2026-11-01,09:15:00,18:30:00,Biometric log import',
      'EMP-003,david.wallace@hryantra.com,2026-11-01,10:00:00,15:00:00,Half day correction',
    ];
    return [header, ...sampleRows].join('\n');
  }

  /**
   * Pre-validates attendance rows, detects conflicts, and compares with existing punches
   */
  static async validateRows(
    scope: OrgScopeContext,
    rows: RawAttendanceRow[]
  ): Promise<{
    totalRows: number;
    validCount: number;
    invalidCount: number;
    correctionCount: number;
    rows: ValidatedAttendanceRow[];
  }> {
    const tenantId = requireTenantId(scope);

    // Fetch all active employees in tenant for fast mapping
    const employees = await prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, department: true },
    });

    const empById = new Map(employees.map((e) => [e.id, e]));
    const empByCode = new Map(employees.map((e) => [e.employeeId.toLowerCase(), e]));
    const empByEmail = new Map(employees.map((e) => [e.email.toLowerCase(), e]));

    const validatedRows: ValidatedAttendanceRow[] = [];
    const now = new Date();

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const rowNum = raw.rowNumber || i + 1;
      const errors: string[] = [];

      // 1. Locate Employee
      let emp = null;
      if (raw.employeeId) {
        emp = empById.get(raw.employeeId) || empByCode.get(raw.employeeId.toLowerCase());
      }
      if (!emp && raw.email) {
        emp = empByEmail.get(raw.email.toLowerCase());
      }

      if (!emp) {
        errors.push(`Employee not found for identifier "${raw.employeeId || raw.email || 'N/A'}"`);
      }

      // 2. Validate Date
      let dateObj: Date | null = null;
      if (!raw.date) {
        errors.push('Date is required (YYYY-MM-DD)');
      } else {
        dateObj = new Date(raw.date);
        if (isNaN(dateObj.getTime())) {
          errors.push(`Invalid date format "${raw.date}". Expected YYYY-MM-DD.`);
        } else {
          // Check future date
          const dateOnly = new Date(dateObj);
          dateOnly.setHours(0, 0, 0, 0);
          const todayOnly = new Date(now);
          todayOnly.setHours(0, 0, 0, 0);
          if (dateOnly > todayOnly) {
            errors.push(`Date "${raw.date}" cannot be in the future.`);
          }
        }
      }

      // 3. Parse CheckIn & CheckOut
      let inDateTime: Date | null = null;
      let outDateTime: Date | null = null;
      let durationHours = 0;

      if (dateObj && raw.checkInTime) {
        inDateTime = this.combineDateAndTime(dateObj, raw.checkInTime);
        if (!inDateTime || isNaN(inDateTime.getTime())) {
          errors.push(`Invalid check-in time format "${raw.checkInTime}".`);
        }
      } else if (!raw.checkInTime) {
        errors.push('Check-in time is required.');
      }

      if (dateObj && raw.checkOutTime) {
        outDateTime = this.combineDateAndTime(dateObj, raw.checkOutTime);
        if (!outDateTime || isNaN(outDateTime.getTime())) {
          errors.push(`Invalid check-out time format "${raw.checkOutTime}".`);
        }
      }

      if (inDateTime && outDateTime) {
        const diffMs = outDateTime.getTime() - inDateTime.getTime();
        durationHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        if (outDateTime <= inDateTime) {
          errors.push(`Check-out time (${raw.checkOutTime}) must be after check-in time (${raw.checkInTime}).`);
        } else if (durationHours > 16) {
          errors.push(`Duration (${durationHours} hrs) exceeds maximum 16-hour single shift limit.`);
        }
      }

      // 4. Determine Status
      let computedStatus: AttendanceStatus = AttendanceStatus.PRESENT;
      if (raw.status) {
        const norm = raw.status.toUpperCase();
        if (norm === 'HALF_DAY' || norm === 'HALF DAY' || norm === 'HD' || norm === 'HALFDAY') {
          computedStatus = AttendanceStatus.HALFDAY;
        } else if (norm === 'ABSENT' || norm === 'A') {
          computedStatus = AttendanceStatus.ABSENT;
        } else {
          computedStatus = AttendanceStatus.PRESENT;
        }
      } else if (durationHours > 0) {
        if (durationHours >= 7.5) {
          computedStatus = AttendanceStatus.PRESENT;
        } else if (durationHours >= 3.5) {
          computedStatus = AttendanceStatus.HALFDAY;
        } else {
          computedStatus = AttendanceStatus.ABSENT;
        }
      }

      // 5. Look for existing Attendance record for diff/correction
      let existingRecord = null;
      let actionType: 'NEW_RECORD' | 'UPDATE_CORRECTION' | 'INVALID' = 'NEW_RECORD';

      if (emp && dateObj && errors.length === 0) {
        const startOfDay = new Date(dateObj);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateObj);
        endOfDay.setHours(23, 59, 59, 999);

        existingRecord = await prisma.attendance.findFirst({
          where: {
            employeeId: emp.id,
            date: { gte: startOfDay, lte: endOfDay },
          },
          select: {
            id: true,
            checkInTime: true,
            checkOutTime: true,
            status: true,
          },
        });

        if (existingRecord) {
          actionType = 'UPDATE_CORRECTION';
        }
      }

      const isValid = errors.length === 0;
      if (!isValid) {
        actionType = 'INVALID';
      }

      validatedRows.push({
        rowNumber: rowNum,
        isValid,
        errors,
        actionType,
        employeeRecordId: emp?.id,
        employeeCode: emp?.employeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
        department: emp?.department,
        dateStr: raw.date || '',
        checkInDate: inDateTime,
        checkOutDate: outDateTime,
        durationHours,
        computedStatus,
        originalAttendance: existingRecord,
        remarks: raw.remarks,
      });
    }

    const validCount = validatedRows.filter((r) => r.isValid).length;
    const invalidCount = validatedRows.filter((r) => !r.isValid).length;
    const correctionCount = validatedRows.filter((r) => r.isValid && r.actionType === 'UPDATE_CORRECTION').length;

    return {
      totalRows: rows.length,
      validCount,
      invalidCount,
      correctionCount,
      rows: validatedRows,
    };
  }

  /**
   * Commits validated attendance rows to MongoDB and logs batch audit record
   */
  static async commitBatch(
    scope: OrgScopeContext,
    options: {
      fileName: string;
      rows: RawAttendanceRow[];
      uploadedBy?: string;
    }
  ) {
    const tenantId = requireTenantId(scope);
    const validationResult = await this.validateRows(scope, options.rows);

    let insertedCount = 0;
    let updatedCount = 0;
    const errorLogs: Array<{ row: number; errors: string[] }> = [];

    for (const row of validationResult.rows) {
      if (!row.isValid || !row.employeeRecordId || !row.checkInDate) {
        errorLogs.push({ row: row.rowNumber, errors: row.errors });
        continue;
      }

      const dateObj = new Date(row.dateStr);
      dateObj.setHours(0, 0, 0, 0);

      if (row.originalAttendance) {
        // Update existing record (Correction)
        await prisma.attendance.update({
          where: { id: row.originalAttendance.id },
          data: {
            checkInTime: row.checkInDate,
            checkOutTime: row.checkOutDate || row.originalAttendance.checkOutTime,
            status: row.computedStatus,
            punchStatus: 'ACCEPTED',
            rejectionReason: `Batch Correction: ${row.remarks || options.fileName}`,
          },
        });
        updatedCount++;
      } else {
        // Create new Attendance record
        await prisma.attendance.create({
          data: {
            employeeId: row.employeeRecordId,
            date: dateObj,
            checkInTime: row.checkInDate,
            checkOutTime: row.checkOutDate,
            status: row.computedStatus,
            punchStatus: 'ACCEPTED',
            punchMode: 'web',
            rejectionReason: `Batch Imported from ${options.fileName}`,
          },
        });
        insertedCount++;
      }
    }

    const failedCount = errorLogs.length;
    const status = failedCount === 0 ? 'COMPLETED' : insertedCount + updatedCount > 0 ? 'PARTIAL' : 'FAILED';

    const batch = await prisma.attendanceImportBatch.create({
      data: {
        tenantId,
        fileName: options.fileName,
        uploadedBy: options.uploadedBy || null,
        totalRows: options.rows.length,
        successCount: insertedCount + updatedCount,
        failureCount: failedCount,
        errorLog: errorLogs.length > 0 ? (errorLogs as any) : undefined,
        status,
      },
    });

    return {
      success: true,
      batchId: batch.id,
      status,
      insertedCount,
      updatedCount,
      failedCount,
      totalRows: options.rows.length,
      message: `Processed ${insertedCount + updatedCount} rows (${insertedCount} new, ${updatedCount} corrected, ${failedCount} errors)`,
    };
  }

  private static combineDateAndTime(dateObj: Date, timeStr: string): Date | null {
    try {
      const cleanTime = timeStr.trim();
      // If full ISO string, return parsed
      if (cleanTime.includes('T')) {
        return new Date(cleanTime);
      }

      // Expected format "HH:mm" or "HH:mm:ss"
      const parts = cleanTime.split(':');
      if (parts.length < 2) return null;

      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parts[2] ? parseInt(parts[2], 10) : 0;

      if (isNaN(hours) || isNaN(minutes)) return null;

      const result = new Date(dateObj);
      result.setHours(hours, minutes, seconds, 0);
      return result;
    } catch {
      return null;
    }
  }
}
