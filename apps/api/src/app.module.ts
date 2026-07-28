import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './config/prisma/prisma.module.js';
import { UserModule } from './modules/user/user.module.js';
import { RoleModule } from './modules/role/role.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AreaModule } from './modules/area/area.module.js';
import { PropertyModule } from './modules/property/property.module.js';
import { UploadModule } from './common/upload/upload.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './modules/role/guards/permissions.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { CacheServiceModule } from './common/cache/cache.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BackgroundTaskModule } from './infrastructure/background-task/background-task.module.js';
import { NotificationModule } from './infrastructure/notification/notification.module.js';
import { VerificationModule } from './modules/verification/verification.module.js';
import { EventsModule } from './infrastructure/events/events.module.js';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    BackgroundTaskModule,
    NotificationModule,
    EventsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60000),
          limit: config.get('THROTTLE_LIMIT', 10),
        },
      ],
    }),
    PrismaModule,
    LoggerModule,
    CacheServiceModule,
    UploadModule,
    AuthModule,
    UserModule,
    RoleModule,
    AreaModule,
    PropertyModule,
    VerificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
