import { Request, Response } from 'express';
export declare class FieldVisitController {
    static listVisitLocations(req: Request, res: Response): Promise<void>;
    static listRoster(req: Request, res: Response): Promise<void>;
    static assignRoster(req: Request, res: Response): Promise<void>;
    static removeAssignment(req: Request, res: Response): Promise<void>;
    static getMineToday(req: Request, res: Response): Promise<void>;
    static verifyVisit(req: Request, res: Response): Promise<void>;
    static markMissed(req: Request, res: Response): Promise<void>;
    static recordPing(req: Request, res: Response): Promise<void>;
    static getLive(req: Request, res: Response): Promise<void>;
}
