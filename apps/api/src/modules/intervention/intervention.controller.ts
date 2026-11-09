import { Controller, Post, Param, Body, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { InterventionService } from './intervention.service';

export class NotifyDto {
  kind: string;
  to?: string;
}

export class ShareMessageDto {
  text: string;
  link: string;
  smsUri: string;
}

@Controller('interventions')
export class InterventionController {
  constructor(private readonly interventionService: InterventionService) {}

  @Post(':id/notify')
  @HttpCode(HttpStatus.ACCEPTED)
  async notify(
    @Param('id') interventionId: string,
    @Body() dto: NotifyDto,
  ) {
    return this.interventionService.notify(interventionId, dto.kind, dto.to);
  }

  @Get(':id/share-message')
  async getShareMessage(@Param('id') interventionId: string, @Query('to') to?: string) {
    return this.interventionService.getShareMessage(interventionId, to);
  }
}
