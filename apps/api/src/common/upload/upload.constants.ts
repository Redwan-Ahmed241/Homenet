export const UPLOAD_FOLDERS = {
  PROPERTY_IMAGES:       'homenet/properties/{id}/images',
  PROPERTY_VIDEOS:       'homenet/properties/{id}/videos',
  VERIFICATION_NID:      'homenet/verifications/{id}/nid',
  VERIFICATION_DEED:     'homenet/verifications/{id}/deed',
  VERIFICATION_GPS:      'homenet/verifications/{id}/gps_photos',
  AGENT_LICENSE:         'homenet/agents/{id}/trade_license',
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
