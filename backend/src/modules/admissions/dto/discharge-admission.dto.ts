import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DischargeAdmissionDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  dischargeNotes?: string;
}
