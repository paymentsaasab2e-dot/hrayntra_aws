import { Request, Response, NextFunction } from 'express';
import { OrgScopeContext } from '../org/org-scope.service';
declare global {
    namespace Express {
        interface Request {
            orgScope?: OrgScopeContext;
        }
    }
}
export declare function orgScopeMiddleware(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
