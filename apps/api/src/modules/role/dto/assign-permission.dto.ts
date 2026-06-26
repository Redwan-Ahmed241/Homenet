import { IsNotEmpty, IsString } from 'class-validator';

export class AssignPermissionDto {
  @IsString()
  @IsNotEmpty()
  permissionId!: string;
}
