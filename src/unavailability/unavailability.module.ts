import { Module } from '@nestjs/common';
import { UnavailabilityService } from './unavailability.service';
import { UnavailabilityController } from './unavailability.controller';
import { UnavailabilityConstraintService } from './services/unavailability-constraint.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UnavailabilityController],
  providers: [UnavailabilityService, UnavailabilityConstraintService],
  exports: [UnavailabilityService, UnavailabilityConstraintService],
})
export class UnavailabilityModule {}
