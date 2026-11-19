import { Request, Response } from 'express';
export declare class AssetController {
    static getAll(req: Request, res: Response): Promise<void>;
    static getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static create(req: Request, res: Response): Promise<void>;
    static update(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
    static getAllocations(req: Request, res: Response): Promise<void>;
    static assignAsset(req: Request, res: Response): Promise<void>;
    static returnAsset(req: Request, res: Response): Promise<void>;
}
