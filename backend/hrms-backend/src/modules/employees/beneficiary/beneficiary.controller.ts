import { Request, Response } from 'express';
import { BeneficiaryService } from './beneficiary.service';

export class BeneficiaryController {
  // ── Consolidated Snapshot ──
  static async getSnapshot(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.getBeneficiarySnapshot(
        req.orgScope!,
        String(req.params.employeeId)
      );
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Emergency Contacts ──
  static async listEmergencyContacts(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.listEmergencyContacts(
        req.orgScope!,
        String(req.params.employeeId)
      );
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async addEmergencyContact(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.addEmergencyContact(
        req.orgScope!,
        String(req.params.employeeId),
        req.body
      );
      res.status(201).json({ success: true, data, message: 'Emergency contact added' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateEmergencyContact(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.updateEmergencyContact(
        req.orgScope!,
        String(req.params.employeeId),
        String(req.params.contactId),
        req.body
      );
      res.status(200).json({ success: true, data, message: 'Emergency contact updated' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async deleteEmergencyContact(req: Request, res: Response) {
    try {
      await BeneficiaryService.deleteEmergencyContact(
        req.orgScope!,
        String(req.params.employeeId),
        String(req.params.contactId)
      );
      res.status(200).json({ success: true, message: 'Emergency contact deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Dependents ──
  static async listDependents(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.listDependents(
        req.orgScope!,
        String(req.params.employeeId)
      );
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async addDependent(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.addDependent(
        req.orgScope!,
        String(req.params.employeeId),
        req.body
      );
      res.status(201).json({ success: true, data, message: 'Dependent added' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateDependent(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.updateDependent(
        req.orgScope!,
        String(req.params.employeeId),
        String(req.params.dependentId),
        req.body
      );
      res.status(200).json({ success: true, data, message: 'Dependent updated' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async deleteDependent(req: Request, res: Response) {
    try {
      await BeneficiaryService.deleteDependent(
        req.orgScope!,
        String(req.params.employeeId),
        String(req.params.dependentId)
      );
      res.status(200).json({ success: true, message: 'Dependent deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Nominees ──
  static async listNominees(req: Request, res: Response) {
    try {
      const scheme = req.query.scheme as any;
      const data = await BeneficiaryService.listNominees(
        req.orgScope!,
        String(req.params.employeeId),
        scheme
      );
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async addNominee(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.addNominee(
        req.orgScope!,
        String(req.params.employeeId),
        req.body
      );
      res.status(201).json({ success: true, data, message: 'Nominee added successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateNominee(req: Request, res: Response) {
    try {
      const data = await BeneficiaryService.updateNominee(
        req.orgScope!,
        String(req.params.employeeId),
        String(req.params.nomineeId),
        req.body
      );
      res.status(200).json({ success: true, data, message: 'Nominee updated successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async deleteNominee(req: Request, res: Response) {
    try {
      await BeneficiaryService.deleteNominee(
        req.orgScope!,
        String(req.params.employeeId),
        String(req.params.nomineeId)
      );
      res.status(200).json({ success: true, message: 'Nominee removed' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
