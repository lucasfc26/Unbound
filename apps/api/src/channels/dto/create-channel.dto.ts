import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsIn(['TEXT', 'VOICE'])
  type: 'TEXT' | 'VOICE';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  topic?: string;
}
