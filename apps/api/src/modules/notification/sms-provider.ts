export interface SmsSendResult {
  providerMessageId: string;
}

/** Delivery-status callback a real adapter calls (e.g. from a provider webhook). */
export type DeliveryStatusHandler = (
  providerMessageId: string,
  status: 'DELIVERED' | 'FAILED',
  error?: string,
) => Promise<void>;

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string, idempotencyKey: string): Promise<SmsSendResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
