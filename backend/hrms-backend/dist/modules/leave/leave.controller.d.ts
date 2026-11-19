import { Request, Response } from 'express';
export declare class LeaveController {
    static apply(req: Request, res: Response): Promise<void>;
    static updateStatus(req: Request, res: Response): Promise<void>;
    static getMyLeaves(req: Request, res: Response): Promise<void>;
    static getBalance(req: Request, res: Response): Promise<void>;
    static cancel(req: Request, res: Response): Promise<void>;
    static getAll(req: Request, res: Response): Promise<void>;
    static getWorkWeekRoster(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateWorkWeekRoster(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static calculateDays(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getRosterGrid(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static bulkAssignRoster(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static overrideRosterCell(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createRosterSchedule(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getShifts(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createOrUpdateShift(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteShift(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
