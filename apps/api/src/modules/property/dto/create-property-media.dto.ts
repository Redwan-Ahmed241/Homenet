import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsUrl,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '@prisma/client';

export class CreatePropertyMediaDto {
  @IsString()
  @IsNotEmpty()
  property_id!: string;

  @IsEnum(MediaType)
  @IsNotEmpty()
  media_type!: MediaType;

  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  @IsUrl()
  thumbnail_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  display_order?: number;
}
