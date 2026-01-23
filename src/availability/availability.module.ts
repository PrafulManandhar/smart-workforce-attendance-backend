import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { AvailabilityManagerController } from './availability-manager.controller';
import { AvailabilityConstraintService } from './services/availability-constraint.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AvailabilityController, AvailabilityManagerController],
  providers: [AvailabilityService, AvailabilityConstraintService],
  exports: [AvailabilityService, AvailabilityConstraintService],
})
export class AvailabilityModule {}
