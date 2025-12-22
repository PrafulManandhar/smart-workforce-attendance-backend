import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppRole } from '../enums/role.enum';

@Injectable()
export class TrialGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user, allow (JWT guard should handle authentication)
    if (!user) {
      return true;
    }

    // SUPER_ADMIN bypasses this guard
    if (user.role === AppRole.SUPER_ADMIN) {
      return true;
    }

    // Get user's company
    if (!user.companyId) {
      // If user has no companyId but is not SUPER_ADMIN, allow (edge case)
      return true;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });

    if (!company) {
      // Company not found, allow (let other guards handle this)
      return true;
    }

    // Check if company is on a paid plan (ACTIVE_PAID) - no restrictions
    if ((company as any).status === 'ACTIVE_PAID') {
      return true;
    }

    // Check trial expiry for trial companies
    if ((company as any).status === 'ACTIVE_TRIAL' && (company as any).trialEndAt) {
      const now = new Date();
      if ((company as any).trialEndAt < now) {
        throw new ForbiddenException(
          'Trial period has expired. Please upgrade to a paid plan to continue using the service.',
        );
      }
    }

    // Check employee limit
    if ((company as any).employeeLimit !== null && (company as any).employeeLimit !== undefined) {
      const currentEmployeeCount = await this.prisma.employeeProfile.count({
        where: { companyId: user.companyId },
      });
      
      if (currentEmployeeCount >= (company as any).employeeLimit) {
        throw new ForbiddenException(
          `Employee limit of ${(company as any).employeeLimit} has been reached. Please upgrade your plan to add more employees.`,
        );
      }
    }

    return true;
  }
}

