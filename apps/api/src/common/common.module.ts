import { Global, Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { ImageStorageService } from './image-storage.service';

@Global()
@Module({
  providers: [MembershipService, ImageStorageService],
  exports: [MembershipService, ImageStorageService],
})
export class CommonModule {}
