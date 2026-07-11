export interface UploadResult {
  url: string;
  public_id: string;
  thumbnail_url: string | null;
  resource_type: 'image' | 'video' | 'document';
}

export interface IUploadService {
  uploadFile(
    file: Express.Multer.File,
    folder: string,
    allowedMimetypes: readonly string[],
    maxSizeMb: number,
  ): Promise<UploadResult>;

  deleteFile(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<void>;

  getThumbnailUrl(secureUrl: string, resourceType: 'image' | 'video'): string;
}
