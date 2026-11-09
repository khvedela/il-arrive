import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CreateBusinessDto {
  name: string;
  phone?: string;
}

@Injectable()
export class UpdateBusinessDto {
  name?: string;
  phone?: string;
  brandColor?: string;
  timezone?: string;
}
