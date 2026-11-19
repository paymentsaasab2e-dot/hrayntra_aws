import { Request, Response } from 'express';
export declare class EmployeeController {
    static getAll(req: Request, res: Response): Promise<void>;
    static getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static create(req: Request, res: Response): Promise<void>;
    static update(req: Request, res: Response): Promise<void>;
    static delete(req: Request, res: Response): Promise<void>;
    static submitChangeRequest(req: Request, res: Response): Promise<void>;
    static getChangeRequests(req: Request, res: Response): Promise<void>;
    static getChangeRequestById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateChangeRequestStatus(req: Request, res: Response): Promise<void>;
    static getEmploymentHistory(req: Request, res: Response): Promise<void>;
    static addEmploymentHistoryMilestone(req: Request, res: Response): Promise<void>;
    static deleteEmploymentHistoryMilestone(req: Request, res: Response): Promise<void>;
}
