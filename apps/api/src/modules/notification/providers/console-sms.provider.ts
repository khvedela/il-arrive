import { Injectable, Scope } from '@nestjs/common';
import { SmsProvider, SmsProviderMessage } from '@il-arrive/contracts';

export interface ConsoleSmsOutboxItem {
  id: string;
  providerMessageId: string;
  interventionId: string;
  kind: string;
  to: string;
  body: string;
  status: 'QUEUED' | 'SENT';
  createdAt: string;
}

@Injectable({ scope: Scope.DEFAULT })
export class ConsoleSmsProvider implements SmsProvider {
  private static outbox: Map<string, ConsoleSmsOutboxItem> = new Map();

  constructor() {}

  async send(to: string, body: string, idempotencyKey: string): Promise<SmsProviderMessage> {
    const providerMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const notification = await this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    const interventionId = notification?.interventionId || 'unknown';

    const item: ConsoleSmsOutboxItem = {
      id: providerMessageId,
      providerMessageId,
      interventionId,
      kind: notification?.kind || 'UNKNOWN',
      to,
      body,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };

    ConsoleSmsProvider.outbox.set(idempotencyKey, item);

    console.log(`[ConsoleSmsProvider] SMS queued: to=${to}, kind=${item.kind}, id=${providerMessageId}`);
    console.log(`[ConsoleSmsProvider] Body: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);

    return { id: providerMessageId };
  }

  async markDelivered(providerMessageId: string): Promise<void> {
    const item = ConsoleSmsProvider.outbox.get(providerMessageId);
    if (item) {
      item.status = 'DELIVERED';
      ConsoleSmsProvider.outbox.set(providerMessageId, item);
      console.log(`[ConsoleSmsProvider] Marked delivered: ${providerMessageId}`);
    } else {
      console.warn(`[ConsoleSmsProvider] Provider message not found: ${providerMessageId}`);
    }
  }

  async markFailed(providerMessageId: string, error: string): Promise<void> {
    const item = ConsoleSmsProvider.outbox.get(providerMessageId);
    if (item) {
      item.status = 'FAILED';
      item.body = `${item.body} [FAILED: ${error}]`;
      ConsoleSmsProvider.outbox.set(providerMessageId, item);
      console.error(`[ConsoleSmsProvider] Marked failed: ${providerMessageId}, error: ${error}`);
    } else {
      console.warn(`[ConsoleSmsProvider] Provider message not found: ${providerMessageId}`);
    }
  }

  static getOutbox(): ConsoleSmsOutboxItem[] {
    return Array.from(ConsoleSmsProvider.outbox.values());
  }

  static clearOutbox(): void {
    ConsoleSmsProvider.outbox.clear();
  }
}
