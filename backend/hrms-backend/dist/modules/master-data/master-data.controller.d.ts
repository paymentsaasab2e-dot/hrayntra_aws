import { Request, Response } from 'express';
export declare class MasterDataController {
    static getMasterData(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upsertDepartment(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteDepartment(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upsertDesignation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteDesignation(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upsertGrade(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteGrade(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static upsertCostCentre(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteCostCentre(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
