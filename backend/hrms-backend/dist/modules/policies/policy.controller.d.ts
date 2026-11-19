import { Request, Response } from 'express';
export declare class PolicyController {
    static list(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upload(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createManual(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateRules(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static publish(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getActive(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateActive(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static acknowledge(req: Request, res: Response): Promise<void>;
}
