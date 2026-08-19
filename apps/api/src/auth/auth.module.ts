import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { UsersController } from '../users/users.controller';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

// UsersController lives here (not in UsersModule) because it needs AuthService for the
// password-gated actions (change email/username, change password, delete account), and
// AuthModule already depends on UsersModule one-directionally — registering it on the
// Users side instead would create a circular module dependency.
@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
