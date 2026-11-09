import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Raw invitation token from the emailed link' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
