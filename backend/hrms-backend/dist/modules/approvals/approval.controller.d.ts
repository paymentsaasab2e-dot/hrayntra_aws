import { Request, Response } from 'express';
export declare class ApprovalController {
    static getInbox(req: Request, res: Response): Promise<void>;
    static act(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
