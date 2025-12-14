import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany();
  }

  create(data: { name: string; code: string; timezone?: string }) {
    return this.prisma.company.create({ data });
  }

  // super admin operations will live here
}
