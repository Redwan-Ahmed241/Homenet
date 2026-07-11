export const UPLOAD_FOLDERS = {
  PROPERTY_IMAGES:       'homenet/properties/{id}/images',
  PROPERTY_VIDEOS:       'homenet/properties/{id}/videos',
  USER_AVATAR:           'homenet/users/{id}/avatar',
} as const;

export const ALLOWED_MIMETYPES = {
  IMAGES:     ['image/jpeg', 'image/png', 'image/webp'],
  VIDEOS:     ['video/mp4', 'video/quicktime'],
  DOCUMENTS:  ['application/pdf'],
  ALL_MEDIA:  ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
} as const;

export const UPLOAD_LIMITS_MB = {
  IMAGE: 10,
  VIDEO: 100,
  DOCUMENT: 5,
} as const;
