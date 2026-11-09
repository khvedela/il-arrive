import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dtos';

@ApiTags('business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current business profile' })
  @ApiCookieAuth()
  async getBusiness(@Request() req) {
    return this.businessService.getBusiness(req.user.activeBusinessId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update business profile' })
  @ApiCookieAuth()
  async updateBusiness(@Request() req, @Body() dto: UpdateBusinessDto) {
    return this.businessService.updateBusiness(req.user.activeBusinessId, dto);
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload business logo (max 1MB, png/jpg/svg)' })
  @ApiCookieAuth()
  async uploadLogo(@Request() req) {
    const file = req.file;
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.businessService.uploadLogo(req.user.activeBusinessId, file);
  }
}
