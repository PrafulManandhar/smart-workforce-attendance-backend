import { Module } from '@nestjs/common';
import { UnavailabilityService } from './unavailability.service';
import { UnavailabilityController } from './unavailability.controller';
import { UnavailabilityManagerController } from './unavailability-manager.controller';
import { UnavailabilityConstraintService } from './services/unavailability-constraint.service';
import { UnavailabilityResolverService } from './services/unavailability-resolver.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UnavailabilityController, UnavailabilityManagerController],
  providers: [
    UnavailabilityService,
    UnavailabilityConstraintService,
    UnavailabilityResolverService,
  ],
  exports: [
    UnavailabilityService,
    UnavailabilityConstraintService,
    UnavailabilityResolverService,
  ],
})
export class UnavailabilityModule {}
