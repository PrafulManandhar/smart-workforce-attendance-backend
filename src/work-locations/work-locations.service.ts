import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkLocationsService {
  constructor(private prisma: PrismaService) {}

  // Placeholder methods - to be implemented later
}

