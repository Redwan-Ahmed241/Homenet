import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'CurrentPass123!',
  })
  @IsString()
  @MinLength(1)
  current_password: string;

  @ApiProperty({
    description: 'New password (must be different from current password)',
    example: 'NewPass456!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  new_password: string;
}