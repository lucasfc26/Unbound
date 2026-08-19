import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { ServerInvitesController } from './server-invites.controller';
import { InvitesController } from './invites.controller';

@Module({
  providers: [InvitationsService],
  controllers: [ServerInvitesController, InvitesController],
})
export class InvitationsModule {}
