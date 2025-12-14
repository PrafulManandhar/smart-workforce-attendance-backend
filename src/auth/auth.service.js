"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = __importStar(require("bcryptjs"));
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const role_enum_1 = require("../common/enums/role.enum");
let AuthService = class AuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async getUserByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
            include: { company: true },
        });
    }
    async validateUser(loginDto) {
        const user = await this.getUserByEmail(loginDto.email);
        if (!user || !user.isActive)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isMatch)
            throw new common_1.UnauthorizedException('Invalid credentials');
        return user;
    }
    async login(loginDto) {
        const user = await this.validateUser(loginDto);
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
        };
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
            expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRY'),
        });
        const refreshToken = await this.jwtService.signAsync({ sub: user.id, email: user.email }, {
            secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRY'),
        });
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { hashedRefreshToken },
        });
        return { accessToken, refreshToken, role: user.role, companyId: user.companyId };
    }
    async refreshTokens(userId, refreshToken) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || !user.hashedRefreshToken)
            throw new common_1.UnauthorizedException('Invalid refresh token');
        const isMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
        if (!isMatch)
            throw new common_1.UnauthorizedException('Invalid refresh token');
        // Issue new tokens
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
        };
        const newAccessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
            expiresIn: this.configService.get('JWT_ACCESS_TOKEN_EXPIRY'),
        });
        const newRefreshToken = await this.jwtService.signAsync({ sub: user.id, email: user.email }, {
            secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRY'),
        });
        const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { hashedRefreshToken },
        });
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }
    // bootstrap super admin (run once or via script)
    async bootstrapSuperAdmin() {
        const email = this.configService.get('SUPER_ADMIN_EMAIL');
        const password = this.configService.get('SUPER_ADMIN_PASSWORD');
        const exists = await this.prisma.user.findUnique({ where: { email } });
        if (exists)
            return;
        const passwordHash = await bcrypt.hash(password, 10);
        await this.prisma.user.create({
            data: {
                email,
                passwordHash,
                role: role_enum_1.AppRole.SUPER_ADMIN,
                isActive: true,
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
