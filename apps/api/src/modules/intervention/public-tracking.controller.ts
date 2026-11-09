import { Controller, Get, HttpException, Param, Res } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { TrackingEventsHub } from '../tracking/tracking-events.hub';
import { PublicTrackingProjection, PublicTrackingService } from './public-tracking.service';

const POLL_MS = 5_000;
const HEARTBEAT_MS = 25_000;
const NOT_FOUND_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@ApiTags('public-tracking')
@Controller('public')
export class PublicTrackingController {
  constructor(
    private readonly publicTrackingService: PublicTrackingService,
    private readonly hub: TrackingEventsHub,
  ) {}

  @Get('track/:token')
  @ApiOperation({ summary: 'Customer-safe tracking projection by token' })
  @ApiParam({ name: 'token', required: true, description: '32-byte base64url tracking token' })
  @ApiNotFoundResponse({ description: 'Unknown or revoked token' })
  async getPublicTracking(@Param('token') token: string): Promise<PublicTrackingProjection> {
    try {
      return await this.publicTrackingService.getPublicTracking(token);
    } catch (error) {
      // Flatten timing between unknown tokens and other failures.
      if (error instanceof HttpException && error.getStatus() === 404) await sleep(NOT_FOUND_DELAY_MS);
      throw error;
    }
  }

  /** SSE: pushes the full projection when it changes; clients refetch on reconnect (ARCHITECTURE §6). */
  @Get('track/:token/events')
  @ApiOperation({ summary: 'SSE stream of tracking projection changes' })
  @ApiParam({ name: 'token', required: true })
  async getPublicTrackingEvents(@Param('token') token: string, @Res() response: Response): Promise<void> {
    let last: string;
    try {
      last = JSON.stringify(await this.publicTrackingService.getPublicTracking(token));
    } catch (error) {
      await sleep(NOT_FOUND_DELAY_MS);
      response.status(error instanceof HttpException ? error.getStatus() : 404).end();
      return;
    }

    response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.flushHeaders();
    response.write(`event: projection\ndata: ${last}\n\n`);

    const interventionId = await this.publicTrackingService.interventionIdForToken(token);
    let sinceHeartbeat = 0;
    let closed = false;
    const refresh = async () => {
      try {
        const current = JSON.stringify(await this.publicTrackingService.getPublicTracking(token));
        if (closed || current === last) return false;
        last = current;
        sinceHeartbeat = 0;
        response.write(`event: projection\ndata: ${current}\n\n`);
        return true;
      } catch {
        // Revoked or expired mid-stream.
        if (closed) return false;
        stop();
        response.write('event: session_end\ndata: {"reason":"expired"}\n\n');
        response.end();
        return false;
      }
    };
    // Push: ETA recompute, fixes, staleness and session end publish on the hub; polling is only a safety net.
    const unsubscribe = this.hub.subscribe(interventionId, () => void refresh());
    const timer = setInterval(async () => {
      sinceHeartbeat += POLL_MS;
      if (!(await refresh()) && !closed && sinceHeartbeat >= HEARTBEAT_MS) {
        sinceHeartbeat = 0;
        response.write(': heartbeat\n\n');
      }
    }, POLL_MS);
    const stop = () => {
      closed = true;
      clearInterval(timer);
      unsubscribe();
    };

    response.on('close', stop);
  }
}
