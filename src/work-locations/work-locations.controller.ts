import { Controller } from '@nestjs/common';
import { WorkLocationsService } from './work-locations.service';

@Controller('work-locations')
export class WorkLocationsController {
  constructor(private workLocationsService: WorkLocationsService) {}

  // Placeholder methods - to be implemented later
}

