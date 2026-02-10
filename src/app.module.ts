import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { AttendanceModule } from './attendance/attendance.module';
import { WorkLocationsModule } from './work-locations/work-locations.module';
import { ShiftsModule } from './shifts/shifts.module';
import { InvitesModule } from './invites/invites.module';
import { AvailabilityModule } from './availability/availability.module';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { DepartmentsModule } from './departments/departments.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CompanyOnboardingGuard } from './common/guards/company-onboarding.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    AttendanceModule,
    WorkLocationsModule,
    ShiftsModule,
    InvitesModule,
    AvailabilityModule,
    UnavailabilityModule,
    DepartmentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CompanyOnboardingGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // run AFTER jwt guard (so request.user exists), so we normally attach this globally
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
