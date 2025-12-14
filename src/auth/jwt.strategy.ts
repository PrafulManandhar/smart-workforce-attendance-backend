import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtPayload = {
  sub: string;       // user id
  email: string;
  role: string;
  companyId: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // attached as request.user
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
    };
  }
}
