export interface SmsProviderMessage {
  id: string;
}

export interface SmsProvider {
  send(to: string, body: string, idempotencyKey: string): Promise<SmsProviderMessage>;
  markDelivered(providerMessageId: string): Promise<void>;
  markFailed(providerMessageId: string, error: string): Promise<void>;
}
