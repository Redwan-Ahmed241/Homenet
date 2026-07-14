export interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  role_permissions: {
    permission: {
      id: string;
      name: string;
      description: string | null;
    };
  }[];
}

export interface UserRoleWithRole {
  id: string;
  user_id: string;
  role_id: string;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
}

export interface IRoleRepository {
  findAllRoles(): Promise<RoleWithPermissions[]>;
  findRoleById(id: string): Promise<RoleWithPermissions | null>;
  assignRoleToUser(userId: string, roleId: string): Promise<{ id: string }>;
  removeRoleFromUser(userId: string, roleId: string): Promise<{ count: number }>;
  getUserRoles(userId: string): Promise<UserRoleWithRole[]>;
  assignPermissionToRole(roleId: string, permissionId: string): Promise<{ id: string }>;
  removePermissionFromRole(roleId: string, permissionId: string): Promise<{ count: number }>;
  getUserPermissions(userId: string): Promise<string[]>;
}
