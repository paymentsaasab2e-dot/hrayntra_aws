import { Request, Response } from 'express';
import { UserService } from './user.service';

export class UserController {
  static async getAll(req: Request, res: Response) {
    try {
      const users = await UserService.getAll(req.orgScope);
      res.status(200).json({ success: true, data: users });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const result = await UserService.create(req.body, req.orgScope?.tenantId);
      res.status(201).json({
        success: true,
        data: result.user,
        employee: result.employee,
        onboarding: result.onboarding,
        email: result.email,
        message: result.email.sent
          ? 'User created — employee, onboarding, and welcome email sent'
          : result.email.skipped
            ? 'User created with employee and onboarding (email skipped — check RESEND_API_KEY)'
            : `User created with employee and onboarding (email failed: ${result.email.message})`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const user = await UserService.update(id, req.body, req.orgScope?.tenantId);
      res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await UserService.delete(id, req.orgScope?.tenantId);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
