import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dtos/login.dto';
import { AppRole } from '../common/enums/role.enum';
import * as crypto from 'crypto';


@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async issueTokens(user: { id: string; email: string; role: any; companyId: string | null }) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY'),
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRY'),
      },
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async validateUser(loginDto: LoginDto) {
    const user = await this.getUserByEmail(loginDto.email);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    // Normal login: any role
    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
    });

    return {
      ...tokens,
      role: user.role,
      companyId: user.companyId ?? null,
    };
  }

  async superAdminLogin(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    if (user.role !== AppRole.SUPER_ADMIN) {
      throw new UnauthorizedException('Only Super Admin can login here');
    }

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: null,
    });

    return {
      ...tokens,
      role: user.role,
      companyId: null,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.hashedRefreshToken) throw new UnauthorizedException('Invalid refresh token');

    const isMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!isMatch) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
    });

    return tokens;
  }

  // ✅ Forgot password: generate token + store HASH + expiry
  async forgotPassword(email: string) {
    const user = await this.getUserByEmail(email);

    // Security best practice: do NOT reveal if user exists
    if (!user || !user.isActive) {
      return { message: 'If the email exists, a reset token has been generated.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiryMinutes = Number(this.configService.get<string>('RESET_PASSWORD_TOKEN_EXPIRY_MINUTES') ?? '30');
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: expiresAt,
      },
    });

    // ✅ For now, return token in response (DEV MODE)
    // Later: send via email using a mail provider.
    return {
      message: 'If the email exists, a reset token has been generated.',
      devResetToken: rawToken,
      expiresAt,
    };
  }

  // ✅ Reset password: validate token + expiry + update password
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { gt: new Date() },
        isActive: true,
      },
    });

    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
        hashedRefreshToken: null, // optional security: force re-login everywhere
      },
    });

    return { message: 'Password reset successful. Please login again.' };
  }

  async bootstrapSuperAdmin() {
    const email = this.configService.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD');
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: AppRole.SUPER_ADMIN as any,
        isActive: true,
      },
    });
  }
}
