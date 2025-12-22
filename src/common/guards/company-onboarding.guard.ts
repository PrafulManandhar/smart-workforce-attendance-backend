import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AppRole } from '../enums/role.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class CompanyOnboardingGuard implements CanActivate {
  // Allowed routes when company status is DRAFT
  private readonly allowedRoutes = [
    '/api/companies/onboarding',
    '/api/auth/refresh',
  ];

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user (shouldn't happen if JWT guard is applied first), allow
    // Public routes should bypass this guard (handled by JwtAuthGuard)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !user) {
      return true;
    }

    // SUPER_ADMIN bypasses this guard
    if (user.role === AppRole.SUPER_ADMIN) {
      return true;
    }

    // Check if the route is in the allowed list
    // request.path includes the /api prefix (set globally in main.ts)
    const routePath = request.path || request.url?.split('?')[0] || '';
    
    // Normalize paths (remove trailing slashes)
    const normalizedRequestPath = routePath.replace(/\/$/, '');
    const isAllowedRoute = this.allowedRoutes.some((allowed) => {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return normalizedRequestPath === normalizedAllowed;
    });

    if (isAllowedRoute) {
      return true;
    }

    // Get user's company status
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

    // If company status is DRAFT and route is not allowed, block
    if ((company as any).status === 'DRAFT') {
      throw new ForbiddenException(
        'Company onboarding must be completed before accessing this resource. Please complete onboarding first.',
      );
    }

    return true;
  }
}

