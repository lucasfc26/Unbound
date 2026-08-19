import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class ChannelPositionDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderChannelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPositionDto)
  items: ChannelPositionDto[];
}
