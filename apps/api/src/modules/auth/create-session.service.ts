import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CreateSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId }: { userId: string }) {
    const token = Buffer.from(uuidv4()).toString('hex');
    const tokenHash = await argon2.hash(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      id: session.id,
      tokenHash,
      expiresAt: session.expiresAt,
    };
  }
}
