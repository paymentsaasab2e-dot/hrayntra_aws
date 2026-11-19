import { Request, Response } from 'express';
export declare class OnboardingController {
    static getAll(req: Request, res: Response): Promise<void>;
    static getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static create(req: Request, res: Response): Promise<void>;
    static bulkCreate(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static update(req: Request, res: Response): Promise<void>;
    static updateTask(req: Request, res: Response): Promise<void>;
    static complete(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
}
