import { Request, Response } from 'express';
export declare class PlatformController {
    static listPackages(_req: Request, res: Response): Promise<void>;
    static getStats(req: Request, res: Response): Promise<void>;
    static listTenants(_req: Request, res: Response): Promise<void>;
    static getTenant(req: Request, res: Response): Promise<void>;
    static createTenant(req: Request, res: Response): Promise<void>;
    static getTenantCredentials(req: Request, res: Response): Promise<void>;
    static updateTenant(req: Request, res: Response): Promise<void>;
    static updateTenantPackage(req: Request, res: Response): Promise<void>;
    static updateTenantAdmin(req: Request, res: Response): Promise<void>;
    static deleteTenant(req: Request, res: Response): Promise<void>;
}
