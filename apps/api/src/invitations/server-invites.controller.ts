import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { InvitationsService } from './invitations.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@UseGuards(JwtAuthGuard)
@Controller('servers/:serverId/invites')
export class ServerInvitesController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitations.create(serverId, user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Param('serverId') serverId: string) {
    return this.invitations.listForServer(serverId, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Param('id') id: string,
  ) {
    return this.invitations.revoke(serverId, user.id, id);
  }
}
