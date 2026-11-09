import type { Role } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  activeBusinessId: string;
  role: Role;
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}
