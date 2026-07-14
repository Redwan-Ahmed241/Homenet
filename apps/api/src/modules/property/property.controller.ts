import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { PropertyService } from './property.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';
import { CreatePropertyMediaDto } from './dto/create-property-media.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

@Controller('v1/properties')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  // ── Public Routes ──────────────────────────────────────

  @Public()
  @Get()
  findAll(@Query() query: PropertyQueryDto) {
    return this.propertyService.findAll(query);
  }

  // ── Admin: List All (static route before @Get(':id')) ──

  @Permissions('manage_properties')
  @Get('admin')
  findAllAdmin(@Query() query: PropertyQueryDto) {
    return this.propertyService.findAllAdmin(query);
  }

  // ── User: My Properties (static route before @Get(':id')) ─

  @Get('my')
  findMyProperties(
    @Query() query: PropertyQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.findUserProperties(query, user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(id);
  }

  // ── Authenticated User Routes ──────────────────────────

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.create(dto, user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.update(id, dto, user.id, false);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':id/submit')
  submitForVerification(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.submitForVerification(id, user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.remove(id, user.id, false);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @Post(':id/media')
  addMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePropertyMediaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.addMedia(id, file, dto, user.id, false);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete('media/:mediaId')
  removeMedia(
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.removeMedia(mediaId, user.id, false);
  }

  // ── Admin Routes ───────────────────────────────────────

  @Permissions('manage_properties')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':id/admin')
  adminUpdate(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.update(id, dto, user.id, true);
  }

  @Permissions('manage_properties')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete(':id/admin')
  adminDelete(@Param('id') id: string) {
    return this.propertyService.hardDelete(id);
  }
}
