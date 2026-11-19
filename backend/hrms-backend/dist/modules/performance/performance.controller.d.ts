import { Request, Response } from 'express';
export declare class PerformanceController {
    static getAll(req: Request, res: Response): Promise<void>;
    static getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static compute(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static refresh(req: Request, res: Response): Promise<void>;
    static getAnalytics(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getMyReviews(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static create(req: Request, res: Response): Promise<void>;
    static update(req: Request, res: Response): Promise<void>;
    static submitSelfReview(req: Request, res: Response): Promise<void>;
    static submitManagerReview(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
}
