import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class MailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 1025,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
    });
  }

  async send({
    to,
    subject,
    html,
    text,
    idempotencyKey,
  }: {
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
  }) {
    const info = await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@ilarrive.local',
      to,
      subject,
      html,
      text,
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
    });

    return {
      providerMessageId: info.messageId,
    };
  }
}
