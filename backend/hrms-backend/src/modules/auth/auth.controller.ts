import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const user = await AuthService.register(req.body);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      // @ts-ignore - userId will be attached by auth middleware
      const userId = req.user.id;
      const profile = await AuthService.getProfile(userId);
      res.status(200).json({ success: true, user: profile });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
}
