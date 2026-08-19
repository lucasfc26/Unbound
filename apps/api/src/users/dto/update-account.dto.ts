import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'username deve conter apenas letras minúsculas, números e underscore',
  })
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Length(1, 200)
  currentPassword: string;
}
