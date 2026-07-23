import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsUrl,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PropertyType, ListingType, PropertyStatus } from '@prisma/client';

export class UpsertPropertyDto {
  @IsOptional()
  @IsString()
  property_id?: string;

  @IsOptional()
  @IsString()
  area_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @IsOptional()
  @IsString()
  subtype?: string;

  @IsOptional()
  @IsEnum(ListingType)
  listing_type?: ListingType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  price_currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  area_size?: number;

  @IsOptional()
  @IsString()
  area_unit?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  location_lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  location_lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsObject()
  amenities?: Record<string, any>;

  @IsOptional()
  @IsUrl()
  virtual_tour_url?: string;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;
}
