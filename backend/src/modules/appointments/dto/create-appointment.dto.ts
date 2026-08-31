import { IsDateString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  doctorId!: string;

  @IsUUID()
  departmentId!: string;

  @IsDateString()
  scheduledAt!: string;
}
