import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @Length(1, 4000)
  content: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
