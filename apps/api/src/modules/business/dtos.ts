import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateBusinessDto {
  name!: string;
  phone?: string;
}

@Injectable()
export class UpdateBusinessDto {
  name?: string;
  phone?: string;
  brandColor?: string;
  timezone?: string;
}
