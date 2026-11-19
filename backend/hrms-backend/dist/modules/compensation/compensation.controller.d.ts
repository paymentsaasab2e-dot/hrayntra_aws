import { Request, Response } from 'express';
export declare class CompensationController {
    static listProfiles(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static matchProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static calculate(req: Request, res: Response): Promise<void>;
    static getEmployeeCompensation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upsertEmployeeCompensation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getOnboardingCompensation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upsertOnboardingCompensation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
