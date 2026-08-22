import { Global, Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { TurnService } from './turn.service';

@Global()
@Module({
  providers: [VoiceService, TurnService],
  exports: [VoiceService, TurnService],
})
export class VoiceModule {}
