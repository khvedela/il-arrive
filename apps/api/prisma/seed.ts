import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seed() {
  console.log('Starting dev seed...');

  // Create a demo business
  const business = await prisma.business.upsert({
    where: { slug: 'plomberie-martin' },
    update: {},
    create: {
      name: 'Plomberie Martin',
      slug: 'plomberie-martin',
      phone: '+33612345678',
      brandColor: '#2563eb',
      plan: 'TRIAL',
      smsQuotaMonthly: 50,
    },
  });

  // Create demo owner
  const hashedPassword = await argon2.hash('password123');
  const user = await prisma.user.upsert({
    where: { email: 'owner@plomberie-martin.dev' },
    update: {},
    create: {
      email: 'owner@plomberie-martin.dev',
      passwordHash: hashedPassword,
      firstName: 'Jean',
      lastName: 'Martin',
      phone: '+33612345678',
    },
  });

  // Create or get membership
  let membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: business.id },
  });

  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        userId: user.id,
        businessId: business.id,
        role: 'OWNER',
        isTechnician: true,
      },
    });
  }

  // Create demo customer
  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Marie Dupont',
      phone: '+33698765432',
    },
  });

  // Create demo intervention
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const windowStart = new Date(tomorrow.setHours(8, 0, 0, 0));
  const windowEnd = new Date(tomorrow.setHours(12, 0, 0, 0));

  await prisma.intervention.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      technicianMembershipId: membership.id,
      addressLabel: '12 Rue de la Paix, 75002 Paris',
      addressLat: 48.8698,
      addressLng: 2.3315,
      scheduledDate: tomorrow,
      windowStart,
      windowEnd,
      description: 'R\u00e9paration fuite cuisine',
      status: 'SCHEDULED',
    },
  });

  console.log('Seed completed.');
  console.log('Owner login: owner@plomberie-martin.dev / password123');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
