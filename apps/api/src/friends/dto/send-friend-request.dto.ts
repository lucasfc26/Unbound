import { IsString, Length } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  @Length(1, 50)
  username: string;
}
