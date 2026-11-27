import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePrescriptionDto {
  @IsString()
  @MinLength(2)
  @ApiProperty({"minLength":2,"type":"string"})
  medicationName!: string;

  @IsString()
  @ApiProperty({"type":"string"})
  dosage!: string;

  @IsString()
  @ApiProperty({"type":"string"})
  duration!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  notes?: string;
}
