import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfig } from '../../config/configuration.js';
import { AuthModule } from '../auth/auth.module.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { IndustriesModule } from '../industries/industries.module.js';
import { AdminIndustryService } from './admin-industry.service.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminController } from './admin.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuditService } from './admin-audit.service.js';
import { AdminTenantService } from './admin-tenant.service.js';
import { AdminModuleService } from './admin-module.service.js';
import { AdminMemberService } from './admin-member.service.js';
import { AdminPlanService } from './admin-plan.service.js';
import { AdminTeamService } from './admin-team.service.js';
import { PlatformTokenService } from './platform-token.service.js';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy.js';
import { PlatformAuthGuard } from './guards/platform-auth.guard.js';
import { PlatformRolesGuard } from './guards/platform-roles.guard.js';
import { TwoFactorEnforcementGuard } from './guards/two-factor-enforcement.guard.js';

/**
 * Platform administration (بنل ادمین کل). Kept fully isolated from tenant
 * modules: its own JWT key/strategy, its own guards and its own identity table.
 */
@Module({
  imports: [
    PassportModule,
    AuthModule,
    TenantsModule,
    IndustriesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => {
        const jwt = config.get('platformJwt', { infer: true })!;
        return { secret: jwt.secret, signOptions: { expiresIn: jwt.accessTtl as never } };
      },
    }),
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [
    AdminAuthService,
    AdminAuditService,
    AdminTenantService,
    AdminModuleService,
    AdminMemberService,
    AdminPlanService,
    AdminTeamService,
    AdminIndustryService,
    PlatformTokenService,
    PlatformJwtStrategy,
    PlatformAuthGuard,
    PlatformRolesGuard,
    TwoFactorEnforcementGuard,
  ],
  exports: [AdminAuditService],
})
export class AdminModule {}
