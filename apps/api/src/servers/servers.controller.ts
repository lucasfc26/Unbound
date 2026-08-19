import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { DeleteServerDto } from './dto/delete-server.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { BanMemberDto } from './dto/ban-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateServerDto) {
    return this.servers.create(user.id, dto);
  }

  @Get()
  findMine(@CurrentUser() user: RequestUser) {
    return this.servers.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.servers.findOneForUser(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateServerDto,
  ) {
    return this.servers.update(id, user.id, dto);
  }

  @Get(':id/members')
  members(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.servers.listMembers(id, user.id);
  }

  @Post(':id/join')
  join(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.servers.join(id, user.id);
  }

  @Post(':id/leave')
  @HttpCode(204)
  leave(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.servers.leave(id, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DeleteServerDto,
  ) {
    return this.servers.remove(id, user.id, dto.password);
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.servers.updateMemberRole(id, user.id, targetUserId, dto.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  kickMember(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.servers.kickMember(id, user.id, targetUserId);
  }

  @Get(':id/bans')
  listBans(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.servers.listBans(id, user.id);
  }

  @Post(':id/bans')
  banMember(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: BanMemberDto,
  ) {
    return this.servers.banMember(id, user.id, dto.userId, dto.reason);
  }

  @Delete(':id/bans/:userId')
  @HttpCode(204)
  unbanMember(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.servers.unbanMember(id, user.id, targetUserId);
  }
}
