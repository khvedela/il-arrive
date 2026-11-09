import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;
}
