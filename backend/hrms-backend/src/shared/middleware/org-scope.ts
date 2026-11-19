import { Request, Response, NextFunction } from 'express';
import { OrgScopeContext, resolveOrgScope } from '../org/org-scope.service';

declare global {
  namespace Express {
    interface Request {
      orgScope?: OrgScopeContext;
    }
  }
}

export async function orgScopeMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    req.orgScope = await resolveOrgScope({
      id: user.id,
      role: user.role,
      orgUnitId: user.orgUnitId,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
    });
    next();
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to resolve org scope' });
  }
}
