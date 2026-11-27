import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

// Only these six fields may be patched. Omitted values are unchanged; null may
// clear nullable fields, but must never reach non-nullable fullName/phone columns.
export class UpdatePatientDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(3)
  @ApiPropertyOptional({ type: 'string', minLength: 3 })
  fullName?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @ApiPropertyOptional({ type: 'string' })
  phone?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: 'string', nullable: true })
  nationalId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: 'string', nullable: true })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: 'string', nullable: true })
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: 'string', nullable: true })
  emergencyContactPhone?: string;
}
