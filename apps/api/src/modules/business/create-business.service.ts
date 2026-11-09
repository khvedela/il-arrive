import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CreateBusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ name, phone }: { name: string; phone?: string }) {
    let slug = this.generateSlug(name);
    
    let existingBusiness = await this.prisma.business.findUnique({
      where: { slug },
    });
    
    let count = 1;
    while (existingBusiness) {
      slug = `${slug}-${count}`;
      existingBusiness = await this.prisma.business.findUnique({
        where: { slug },
      });
      count++;
    }

    const business = await this.prisma.business.create({
      data: {
        name,
        slug,
        phone: phone || '+33100000000',
        plan: 'TRIAL',
        timezone: 'Europe/Paris',
      },
    });

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl: business.logoUrl,
      phone: business.phone,
      brandColor: business.brandColor,
      plan: business.plan,
      timezone: business.timezone,
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
