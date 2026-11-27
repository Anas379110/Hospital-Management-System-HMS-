import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // Public demo expiry is the database's sliding24h idle deadline.
        // A fixed JWT lifetime would log out active visitors early.
        signOptions: config.get<string>('HMS_PUBLIC_DEMO') === 'true' ? {} : { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '8h' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, DemoService],
  controllers: [AuthController, DemoController],
  exports: [AuthService],
})
export class AuthModule {}
