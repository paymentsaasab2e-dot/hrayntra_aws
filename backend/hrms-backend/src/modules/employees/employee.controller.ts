import { Request, Response } from 'express';
import { EmployeeService } from './employee.service';
import { EmployeeChangeService } from './employee-change.service';

export class EmployeeController {
  static async getAll(req: Request, res: Response) {
    try {
      const employees = await EmployeeService.getAll(req.orgScope);
      res.status(200).json(employees);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const employee = await EmployeeService.getById(String(req.params.id), req.orgScope);
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      res.status(200).json(employee);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const employee = await EmployeeService.create(req.orgScope!, req.body);
      res.status(201).json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const employee = await EmployeeService.update(req.orgScope!, String(req.params.id), req.body);
      res.status(200).json(employee);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await EmployeeService.delete(req.orgScope!, String(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // ── Employee Change Requests ──

  static async submitChangeRequest(req: Request, res: Response) {
    try {
      const requestedByUserId = (req as any).user?.id || (req as any).user?.userId;
      const changeReq = await EmployeeChangeService.submitChangeRequest(
        req.orgScope!,
        String(req.params.id),
        requestedByUserId,
        req.body
      );
      res.status(201).json({ success: true, data: changeReq });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getChangeRequests(req: Request, res: Response) {
    try {
      const employeeId = req.params.id ? String(req.params.id) : (req.query.employeeId as string | undefined);
      const status = req.query.status as any;
      const list = await EmployeeChangeService.getChangeRequests(req.orgScope!, { employeeId, status });
      res.status(200).json({ success: true, data: list });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getChangeRequestById(req: Request, res: Response) {
    try {
      const item = await EmployeeChangeService.getChangeRequestById(req.orgScope!, String(req.params.requestId));
      if (!item) return res.status(404).json({ success: false, message: 'Change request not found' });
      res.status(200).json({ success: true, data: item });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateChangeRequestStatus(req: Request, res: Response) {
    try {
      const reviewedByUserId = (req as any).user?.id || (req as any).user?.userId;
      const { status, reviewRemark } = req.body;
      const updated = await EmployeeChangeService.updateChangeRequestStatus(
        req.orgScope!,
        String(req.params.requestId),
        reviewedByUserId,
        status,
        reviewRemark
      );
      res.status(200).json({ success: true, data: updated, message: `Change request ${status} successfully` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ── Employment History ──

  static async getEmploymentHistory(req: Request, res: Response) {
    try {
      const history = await EmployeeChangeService.getEmploymentHistory(req.orgScope!, String(req.params.id));
      res.status(200).json({ success: true, data: history });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async addEmploymentHistoryMilestone(req: Request, res: Response) {
    try {
      const recordedBy = (req as any).user?.id || (req as any).user?.userId;
      const milestone = await EmployeeChangeService.addEmploymentHistoryMilestone(
        req.orgScope!,
        String(req.params.id),
        recordedBy,
        req.body
      );
      res.status(201).json({ success: true, data: milestone });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteEmploymentHistoryMilestone(req: Request, res: Response) {
    try {
      await EmployeeChangeService.deleteEmploymentHistoryMilestone(
        req.orgScope!,
        String(req.params.id),
        String(req.params.historyId)
      );
      res.status(200).json({ success: true, message: 'Milestone deleted' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

