import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { ForgotPasswordDto } from './dtos/forget-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login (all users)' })
  @ApiResponse({ status: 200 })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('super-admin/login')
  @Public()
  @ApiOperation({ summary: 'Super Admin login' })
  @ApiResponse({ status: 200 })
  superAdminLogin(@Body() dto: LoginDto) {
    return this.authService.superAdminLogin(dto);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200 })
  refresh(@Req() req: any, @Body() dto: RefreshTokenDto) {
    // req.user injected by RefreshJwtStrategy.validate()
    return this.authService.refreshTokens(req.user.userId, dto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request password reset token' })
  @ApiResponse({ status: 200 })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200 })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
