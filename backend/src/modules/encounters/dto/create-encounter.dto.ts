import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEncounterDto {
  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  patientId!: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({"format":"uuid","nullable":true,"type":"string"})
  appointmentId?: string;

  @IsString()
  @MinLength(2)
  @ApiProperty({"minLength":2,"type":"string"})
  chiefComplaint!: string;

  @IsString()
  @MinLength(2)
  @ApiProperty({"minLength":2,"type":"string"})
  diagnosis!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  notes?: string;
}
