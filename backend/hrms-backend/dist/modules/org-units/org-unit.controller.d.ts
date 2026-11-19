import { Request, Response } from 'express';
export declare class OrgUnitController {
    static getTree(req: Request, res: Response): Promise<void>;
    static getById(req: Request, res: Response): Promise<void>;
    static create(req: Request, res: Response): Promise<void>;
    static update(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
    static approve(req: Request, res: Response): Promise<void>;
    static reject(req: Request, res: Response): Promise<void>;
}
