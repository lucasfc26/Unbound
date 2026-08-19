import { IsString, Length } from 'class-validator';

export class SendFriendRequestByCodeDto {
  @IsString()
  @Length(1, 20)
  code: string;
}
