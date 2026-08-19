import { IsIn } from 'class-validator';

const ASSIGNABLE_ROLES = ['ADMIN', 'MODERATOR', 'MEMBER'] as const;

export class UpdateMemberRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role: (typeof ASSIGNABLE_ROLES)[number];
}
