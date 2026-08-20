import { IsUUID } from 'class-validator';

export class OpenDmDto {
  @IsUUID()
  userId: string;
}
