import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // user is attached by JWT strategy
    const user: any = (req as any).user;

    // default tenant = user's companyId (for company admins / employees)
    // SUPER_ADMIN may have companyId = null and can specify tenant via header or query later if needed
    if (user && user.companyId) {
      (req as any).tenantId = user.companyId;
    } else {
      (req as any).tenantId = null;
    }

    next();
  }
}
