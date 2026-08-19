import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { InvitationsService } from './invitations.service';

@UseGuards(JwtAuthGuard)
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':code')
  preview(@Param('code') code: string) {
    return this.invitations.preview(code);
  }

  @Post(':code/join')
  join(@CurrentUser() user: RequestUser, @Param('code') code: string) {
    return this.invitations.join(code, user.id);
  }
}
