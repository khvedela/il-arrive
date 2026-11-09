import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dtos';

interface RequestWithUser extends Request {
  user: {
    activeBusinessId: string;
    userId: string;
  };
}

interface FileUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@ApiTags('business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current business profile' })
  @ApiCookieAuth()
  async getBusiness(@Request() req: RequestWithUser) {
    return this.businessService.getBusiness(req.user.activeBusinessId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update business profile' })
  @ApiCookieAuth()
  async updateBusiness(@Request() req: RequestWithUser, @Body() dto: UpdateBusinessDto) {
    return this.businessService.updateBusiness(req.user.activeBusinessId, dto);
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload business logo (max 1MB, png/jpg/svg)' })
  @ApiCookieAuth()
  async uploadLogo(@Request() req: RequestWithUser, @Body() file: FileUpload) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.businessService.uploadLogo(req.user.activeBusinessId, file);
  }
}
