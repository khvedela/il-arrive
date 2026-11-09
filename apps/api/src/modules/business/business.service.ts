import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

@Injectable()
export class BusinessService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'businesses');

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  async getBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new UnauthorizedException('Business not found');
    }
    return business;
  }

  async updateBusiness(businessId: string, dto: {
    name?: string;
    phone?: string;
    brandColor?: string;
    timezone?: string;
  }) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new UnauthorizedException('Business not found');
    }

    if (dto.brandColor) {
      if (!/^#([0-9A-F]{6}|[0-9A-F]{3})$/i.test(dto.brandColor)) {
        throw new BadRequestException('Invalid brand color format. Use hex color #rrggbb');
      }
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.brandColor && { brandColor: dto.brandColor }),
        ...(dto.timezone && { timezone: dto.timezone }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        businessId,
        action: 'business_profile_updated',
        targetType: 'Business',
        targetId: businessId,
      },
    });

    return updated;
  }

  async uploadLogo(businessId: string, file: Express.Multer.File) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new UnauthorizedException('Business not found');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 1MB limit');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPG, and SVG files are allowed');
    }

    const sanitizedFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(this.uploadsDir, sanitizedFileName);

    if (file.mimetype === 'image/svg+xml') {
      await this.sanitizeSvg(file.buffer);
    } else {
      await sharp(file.buffer)
        .resize({ width: 512, height: 512, fit: 'contain' })
        .toFile(filePath);
    }

    await this.prisma.business.update({
      where: { id: businessId },
      data: { logoUrl: `/uploads/businesses/${sanitizedFileName}` },
    });

    await this.prisma.auditLog.create({
      data: {
        businessId,
        action: 'business_logo_updated',
        targetType: 'Business',
        targetId: businessId,
      },
    });

    return { logoUrl: `/uploads/businesses/${sanitizedFileName}` };
  }

  private async sanitizeSvg(buffer: Buffer): Promise<void> {
    const svg = buffer.toString('utf8');
    
    const disallowedPatterns = [
      /<script[\s>]/gi,
      /<svg[\s>]/gi,
      /on\w+\s*=/gi,
      /javascript:/gi,
      /data:/gi,
      /expression\s*\(/gi,
    ];

    for (const pattern of disallowedPatterns) {
      if (pattern.test(svg)) {
        throw new BadRequestException('SVG contains disallowed content');
      }
    }

    if (!/<svg[\s>]/i.test(svg)) {
      throw new BadRequestException('File is not a valid SVG');
    }
  }
}
