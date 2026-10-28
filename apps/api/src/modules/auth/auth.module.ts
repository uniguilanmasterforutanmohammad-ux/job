import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfig } from '../../config/configuration.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy.js';
import { IndustriesModule } from '../industries/industries.module.js';

@Module({
  imports: [
    IndustriesModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => {
        const jwt = config.get('jwt', { infer: true })!;
        return {
          secret: jwt.accessSecret,
          signOptions: { expiresIn: jwt.accessTtl as never },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, TotpService, JwtAccessStrategy],
  exports: [AuthService, TokenService, OtpService, TotpService],
})
export class AuthModule {}
