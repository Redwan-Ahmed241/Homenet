export interface UserAuthIdentity {
  provider: string;
  email: string | null;
  phone: string | null;
  verified_at: Date | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  auth_identities: UserAuthIdentity[];
}

export interface UserExists {
  id: string;
}

export interface UserAssetRecord {
  id: string;
  user_id: string;
  asset_id: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}

export interface IUserRepository {
  findAll(): Promise<UserProfile[]>;
  findById(id: string): Promise<UserExists | null>;
  findOne(id: string): Promise<UserProfile | null>;
  update(id: string, data: { full_name?: string; avatar_url?: string | null }): Promise<UserProfile>;
  delete(id: string): Promise<void>;
  createUserAsset(data: { user_id: string; asset_id: string; source: string }): Promise<UserAssetRecord>;
  findUserAssetByUserAndSource(userId: string, source: string): Promise<UserAssetRecord | null>;
  deleteUserAsset(id: string): Promise<void>;
}
