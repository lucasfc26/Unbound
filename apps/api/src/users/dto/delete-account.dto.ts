import { IsString, Length } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @Length(1, 200)
  password: string;
}
