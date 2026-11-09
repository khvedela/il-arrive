import { Controller, Get, Query, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ConsoleSmsProvider, ConsoleSmsOutboxItem } from '../notification/providers/console-sms.provider';

export interface DevSmsQuery {
  page?: number;
  limit?: number;
}

export interface DevSmsResponse {
  items: ConsoleSmsOutboxItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Controller('dev/sms')
export class DevSmsController {
  constructor(private readonly consoleSmsProvider: ConsoleSmsProvider) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getOutbox(@Query() query: DevSmsQuery, @Headers('x-environment') env: string): Promise<DevSmsResponse> {
    if (env === 'production') {
      throw new Error('Not found');
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const allItems = ConsoleSmsProvider.getOutbox();
    const total = allItems.length;
    const startIndex = (page - 1) * limit;
    const items = allItems.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('clear')
  @HttpCode(HttpStatus.OK)
  async clearOutbox(@Headers('x-environment') env: string): Promise<{ success: boolean }> {
    if (env === 'production') {
      throw new Error('Not found');
    }

    ConsoleSmsProvider.clearOutbox();
    return { success: true };
  }
}
