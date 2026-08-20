import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLES } from '../../common/permissions';

export class UpdateMemberRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role: (typeof ASSIGNABLE_ROLES)[number];
}
