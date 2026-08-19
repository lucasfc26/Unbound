import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayName?: string;

  // Empty string clears the avatar back to initials; anything else must look like a URL,
  // which the service checks (class-validator's @IsUrl would reject the clearing case).
  @IsOptional()
  @IsString()
  @Length(0, 300)
  avatarUrl?: string;
}
