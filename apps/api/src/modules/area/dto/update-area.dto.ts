import { PartialType } from '@nestjs/swagger';
import { CreateAreaDto } from './create-area.dto.js';

export class UpdateAreaDto extends PartialType(CreateAreaDto) {}
