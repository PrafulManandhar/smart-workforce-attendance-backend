import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppRole } from '../../common/enums/role.enum';

/**
 * Guard that ensures employees can only access their own availability.
 * Managers and admins can view but not modify (enforced at service level).
 */
@Injectable()
export class AvailabilityOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // SUPER_ADMIN and COMPANY_ADMIN can access any availability
    if (user.role === AppRole.SUPER_ADMIN || user.role === AppRole.COMPANY_ADMIN) {
      return true;
    }

    // MANAGER can view but not modify (service will enforce this)
    if (user.role === AppRole.MANAGER) {
      return true;
    }

    // EMPLOYEE can only access their own availability
    if (user.role === AppRole.EMPLOYEE) {
      // Get employeeId from route params or body
      const employeeId = request.params?.employeeId || request.body?.employeeId;
      const availabilityId = request.params?.id;

      if (availabilityId) {
        // Check if availability belongs to this employee
        const availability = await this.prisma.employeeAvailability.findUnique({
          where: { id: availabilityId },
          select: { employeeId: true },
        });

        if (!availability) {
          throw new NotFoundException('Availability not found');
        }

        // Get employee profile for this user
        const employeeProfile = await this.prisma.employeeProfile.findUnique({
          where: { userId: user.userId || user.id },
          select: { id: true },
        });

        if (!employeeProfile || availability.employeeId !== employeeProfile.id) {
          throw new ForbiddenException('You can only access your own availability');
        }
      } else if (employeeId) {
        // Check if employeeId matches user's employee profile
        const employeeProfile = await this.prisma.employeeProfile.findUnique({
          where: { userId: user.userId || user.id },
          select: { id: true },
        });

        if (!employeeProfile || employeeId !== employeeProfile.id) {
          throw new ForbiddenException('You can only access your own availability');
        }
      } else {
        // No employeeId specified, allow if user is accessing their own
        // This will be handled by the service
        return true;
      }
    }

    return true;
  }
}
