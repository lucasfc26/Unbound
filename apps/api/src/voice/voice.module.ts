import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { TurnService } from './turn.service';

@Module({
  providers: [VoiceService, TurnService],
  exports: [VoiceService, TurnService],
})
export class VoiceModule {}
