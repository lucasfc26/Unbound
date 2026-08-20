import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { VoiceModule } from '../voice/voice.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SfuModule } from '../sfu/sfu.module';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    MessagesModule,
    VoiceModule,
    LinkPreviewModule,
    SfuModule,
  ],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
