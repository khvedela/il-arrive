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

export interface ConsoleSmsOutboxDto {
  items: ConsoleSmsOutboxItem[];
  total: number;
}
