import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtRefreshPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
    });
  }

  async validate(payload: JwtRefreshPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
