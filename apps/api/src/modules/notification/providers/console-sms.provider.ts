import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SmsProvider, SmsSendResult } from '../sms-provider';

/**
 * Dev provider: logs the message. The outbox is the `Notification` table
 * (provider = 'console'), so the API process can show what the worker "sent"
 * at GET /dev/sms.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(to: string, body: string, idempotencyKey: string): Promise<SmsSendResult> {
    this.logger.log(`SMS to ${to}: ${body}`);
    const id = createHash('sha1').update(idempotencyKey).digest('hex').slice(0, 16);
    return { providerMessageId: `console-${id}` };
  }
}
