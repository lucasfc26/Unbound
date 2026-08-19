import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class BanMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  reason?: string;
}
