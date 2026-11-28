import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  patientId!: string;

  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  doctorId!: string;

  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  departmentId!: string;

  @IsDateString()
  @ApiProperty({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","type":"string"})
  scheduledAt!: string;
}
