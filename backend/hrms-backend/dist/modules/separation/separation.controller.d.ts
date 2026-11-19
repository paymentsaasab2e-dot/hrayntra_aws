import { Request, Response } from 'express';
export declare class SeparationController {
    static getPolicy(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getMine(req: Request, res: Response): Promise<void>;
    static list(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static create(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static withdraw(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateChecklist(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static complete(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
