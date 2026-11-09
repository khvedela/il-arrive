import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

interface MembershipWithUser {
  id: string;
  userId: string;
  businessId: string;
  role: string;
  isTechnician: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
  };
}

@Injectable()
export class ListMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ businessId, actorUserId }: {
    businessId: string;
    actorUserId: string;
  }) {
    const actor = await this.prisma.membership.findUnique({
      where: { userId_businessId: { userId: actorUserId, businessId } },
    });
    if (!actor) {
      throw new Error('Not a member of this business');
    }

    const members = await this.prisma.membership.findMany({
      where: { businessId },
      include: {
        user: true,
      },
    });

    return members.map((m: MembershipWithUser) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role,
      isTechnician: m.isTechnician,
    }));
  }
}
