import { Request, Response } from 'express';
export declare class AttendanceController {
    static checkIn(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static checkOut(req: Request, res: Response): Promise<void>;
    static getTodayStatus(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getHistory(req: Request, res: Response): Promise<void>;
    static submitRequest(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getRequests(req: Request, res: Response): Promise<void>;
    static updateRequestStatus(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getMusterRoll(req: Request, res: Response): Promise<void>;
    static startBreak(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static endBreak(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static toggleBreak(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getLiveMonitor(req: Request, res: Response): Promise<void>;
    static getWebPunchPermission(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static setWebPunchPermission(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static runDailyClosure(req: Request, res: Response): Promise<void>;
    static getTodayReminders(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static creditCompOff(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
