import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyMediaDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['image', 'video'])
  media_type!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  display_order?: number;
}
