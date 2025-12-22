import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CompanySignupDto } from './dtos/company-signup.dto';
import { AppRole } from '../common/enums/role.enum';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  findAll() {
    return this.prisma.company.findMany();
  }

  create(data: { name: string; code: string; timezone?: string }) {
    return this.prisma.company.create({ data });
  }

  async signup(dto: CompanySignupDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create company and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create company with status=DRAFT
      const company = await tx.company.create({
        data: {
          status: 'DRAFT',
        },
      });

      // Create COMPANY_ADMIN user linked to the company
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: AppRole.COMPANY_ADMIN as any,
          companyId: company.id,
          isActive: true,
        },
      });

      return { company, user };
    });

    // Generate tokens using AuthService
    const tokens = await this.authService.issueTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.user.companyId ?? null,
    });

    return {
      ...tokens,
      role: result.user.role,
      companyId: result.company.id,
      userId: result.user.id,
    };
  }

  // super admin operations will live here
}
