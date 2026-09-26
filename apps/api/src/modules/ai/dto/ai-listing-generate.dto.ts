import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingType, PropertyType } from '@prisma/client';

export class AiListingGenerateDto {
  @ApiProperty({ example: 'gulshan-dhaka' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  area_id!: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  type!: PropertyType;

  @ApiProperty({ enum: ListingType })
  @IsEnum(ListingType)
  listing_type!: ListingType;

  @ApiProperty({ description: 'Asking price in BDT', example: 35000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  price!: number;

  @ApiProperty({ description: 'Size in sqft', example: 2400 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10_000_000)
  area_size!: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms?: number;

  @ApiPropertyOptional({
    description: 'Rough seller notes or bullet points',
    example:
      'south facing, 2 car parking, lift, generator, near Gulshan 2 circle',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
