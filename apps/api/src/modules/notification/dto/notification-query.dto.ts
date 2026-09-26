import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const NOTIFICATION_AUDIENCES = ['user', 'admin'] as const;
export type NotificationAudienceParam = (typeof NOTIFICATION_AUDIENCES)[number];

/** Which portal is asking: the user app (default) or the admin panel. */
export class NotificationAudienceDto {
  @IsOptional()
  @IsIn(NOTIFICATION_AUDIENCES)
  audience?: NotificationAudienceParam = 'user';
}

export class NotificationQueryDto extends NotificationAudienceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unread_only?: boolean;
}
