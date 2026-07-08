import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheService } from './cache.service.js';

@Global()
@Module({
  imports: [CacheModule.register()],
  providers: [
    { provide: 'ICacheService', useClass: CacheService },
  ],
  exports: ['ICacheService'],
})
export class CacheServiceModule {}
