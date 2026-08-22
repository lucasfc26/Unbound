import { IsNotEmpty, IsString } from 'class-validator';

export class OpenDmDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
