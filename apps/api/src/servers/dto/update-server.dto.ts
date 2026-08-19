import { IsHexColor, IsOptional, IsString, Length } from 'class-validator';

export class UpdateServerDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  description?: string;

  @IsOptional()
  @IsHexColor()
  iconColor?: string;
}
