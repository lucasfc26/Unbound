import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Length(1, 200)
  currentPassword: string;

  @IsString()
  @Length(8, 72)
  newPassword: string;
}
