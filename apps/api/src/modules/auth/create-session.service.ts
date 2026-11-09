import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { digestToken, generateToken } from '../../common/tokens';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CreateSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the raw access token exactly once; only its SHA-256 digest is stored. */
  async execute({ userId }: { userId: string }) {
    const token = generateToken();
    const session = await this.prisma.session.create({
      data: { userId, tokenHash: digestToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    return { id: session.id, token, expiresAt: session.expiresAt };
  }

  /** Resolves a raw access token to its session, or null if unknown/expired. */
  async verify(token: string): Promise<{ sessionId: string; userId: string } | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: digestToken(token) } });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return { sessionId: session.id, userId: session.userId };
  }
}
