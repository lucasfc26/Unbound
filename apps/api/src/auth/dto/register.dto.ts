import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'username deve conter apenas letras minúsculas, números e underscore',
  })
  username: string;

  @IsString()
  @Length(1, 50)
  displayName: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 72)
  password: string;
}
