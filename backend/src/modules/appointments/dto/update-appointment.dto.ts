import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","nullable":true,"type":"string"})
  scheduledAt?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({"format":"uuid","nullable":true,"type":"string"})
  departmentId?: string;
}
