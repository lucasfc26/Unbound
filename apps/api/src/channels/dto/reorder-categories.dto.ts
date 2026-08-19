import { IsArray, IsUUID } from 'class-validator';

export class ReorderCategoriesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
