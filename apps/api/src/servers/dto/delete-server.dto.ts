import { IsString, MinLength } from 'class-validator';

export class DeleteServerDto {
  @IsString()
  @MinLength(1)
  password: string;
}
