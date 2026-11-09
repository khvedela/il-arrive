import { Injectable } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@Injectable()
export class CreateBusinessDto {
  name!: string;
  phone?: string;
}

@Injectable()
// Decorators are required: the global ValidationPipe (whitelist + forbidNonWhitelisted) rejects undecorated fields.
export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(7)
  brandColor?: string;

  @IsOptional() @IsString() @MaxLength(64)
  timezone?: string;
}
