"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./jwt.strategy");
const refresh_jwt_strategy_1 = require("./refresh-jwt.strategy");
const prisma_module_1 = require("../../prisma/prisma.module");
const config_1 = require("@nestjs/config");
let AuthModule = class AuthModule {
    constructor(authService) {
        this.authService = authService;
    }
    async onModuleInit() {
        // creates super admin if not exists
        await this.authService.bootstrapSuperAdmin();
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            config_1.ConfigModule,
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_ACCESS_TOKEN_SECRET'),
                    signOptions: {
                        expiresIn: config.get('JWT_ACCESS_TOKEN_EXPIRY'),
                    },
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, refresh_jwt_strategy_1.RefreshJwtStrategy],
        exports: [auth_service_1.AuthService],
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthModule);
