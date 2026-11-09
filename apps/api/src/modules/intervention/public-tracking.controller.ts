import { Controller, Get, Param, Res, Header, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiParam, ApiOperation, ApiNotFoundResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PublicTrackingService } from './public-tracking.service';

@ApiTags('public-tracking')
@Controller('public')
export class PublicTrackingController {
  constructor(private readonly publicTrackingService: PublicTrackingService) {}

  @Get('track/:token')
  @ApiOperation({ summary: 'Get public tracking projection by token' })
  @ApiParam({ name: 'token', required: true, description: '32-byte base64url tracking token' })
  @ApiNotFoundResponse({ description: 'Tracking link not found or expired' })
  async getPublicTracking(
    @Param('token') token: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const projection = await this.publicTrackingService.getPublicTracking(token);

      if (!projection) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
      }

      response.json(projection);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw error;
      }
      throw error;
    }
  }

  @Get('track/:token/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({ summary: 'Get SSE events for public tracking' })
  @ApiParam({ name: 'token', required: true, description: '32-byte base64url tracking token' })
  async getPublicTrackingEvents(
    @Param('token') token: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const projection = await this.publicTrackingService.getPublicTracking(token);

      if (!projection) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        response.status(404).end();
        return;
      }

      response.write(`: connected\n\n`);

      const interval = setInterval(async () => {
        try {
          const currentProjection = await this.publicTrackingService.getPublicTracking(token);

          if (!currentProjection) {
            clearInterval(interval);
            response.write('event: session_end\ndata: { "status": "EXPIRED" }\n\n');
            response.end();
            return;
          }

          if (currentProjection.status !== projection.status) {
            response.write(`event: status_change\ndata: ${JSON.stringify(currentProjection)}\n\n`);
            projection.status = currentProjection.status;
          }

          if (currentProjection.location?.lat !== projection.location?.lat) {
            response.write(`event: location_update\ndata: ${JSON.stringify(currentProjection.location)}\n\n`);
            projection.location = currentProjection.location;
          }

          if (currentProjection.eta !== projection.eta) {
            response.write(`event: eta_update\ndata: ${JSON.stringify({ eta: currentProjection.eta })}\n\n`);
            projection.eta = currentProjection.eta;
          }

          if (currentProjection.delayMinutes !== projection.delayMinutes) {
            response.write(`event: delay_update\ndata: ${JSON.stringify({ delayMinutes: currentProjection.delayMinutes })}\n\n`);
            projection.delayMinutes = currentProjection.delayMinutes;
          }

          response.write(`: heartbeat\n\n`);
        } catch (error) {
          clearInterval(interval);
          response.write('event: session_end\ndata: { "status": "ERROR" }\n\n');
          response.end();
        }
      }, 25000);

      response.on('close', () => {
        clearInterval(interval);
      });
    } catch (error) {
      response.status(404).end();
    }
  }
}
