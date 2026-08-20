import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';
import { toPrivateUser } from './user.presenter';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

interface UploadedAvatar {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Patch()
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.users.updateProfile(user.id, {
      displayName: dto.displayName,
      avatarUrl: dto.avatarUrl === '' ? null : dto.avatarUrl,
    });
    const withSettings = await this.users.findByIdWithSettings(updated.id);
    return toPrivateUser(updated, withSettings?.settings ?? null);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file?: UploadedAvatar,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie uma imagem de até 2 MB');
    }
    const updated = await this.users.saveAvatar(user.id, file);
    const withSettings = await this.users.findByIdWithSettings(updated.id);
    return toPrivateUser(updated, withSettings?.settings ?? null);
  }

  @Patch('account')
  updateAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.auth.updateAccount(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(204)
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto);
  }

  @Delete()
  @HttpCode(204)
  deleteAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.auth.deleteAccount(user.id, dto);
  }

  @Post('friend-code/regenerate')
  async regenerateFriendCode(@CurrentUser() user: RequestUser) {
    const updated = await this.users.regenerateFriendCode(user.id);
    const withSettings = await this.users.findByIdWithSettings(updated.id);
    return toPrivateUser(updated, withSettings?.settings ?? null);
  }
}
