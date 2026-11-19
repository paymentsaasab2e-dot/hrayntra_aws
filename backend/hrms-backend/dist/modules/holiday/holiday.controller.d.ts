import { Request, Response } from 'express';
export declare class HolidayController {
    static getAll(req: Request, res: Response): Promise<void>;
    static create(req: Request, res: Response): Promise<void>;
    static bulkCreate(req: Request, res: Response): Promise<void>;
    static update(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
}
