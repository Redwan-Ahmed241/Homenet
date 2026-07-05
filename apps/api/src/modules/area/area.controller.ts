import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AreaService } from './area.service.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';
import { AreaQueryDto } from './dto/area-query.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';

@Controller('areas')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  // ── Public Routes ──────────────────────────────────────

  @Public()
  @Get()
  findAll(@Query() query: AreaQueryDto) {
    return this.areaService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.areaService.findOne(id);
  }

  @Public()
  @Get(':id/children')
  findChildren(@Param('id') id: string) {
    return this.areaService.findChildren(id);
  }

  // ── Admin Routes (require manage_areas permission) ─────

  @Permissions('manage_areas')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateAreaDto) {
    return this.areaService.create(dto);
  }

  @Permissions('manage_areas')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.areaService.update(id, dto);
  }

  @Permissions('manage_areas')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.areaService.delete(id);
  }
}
