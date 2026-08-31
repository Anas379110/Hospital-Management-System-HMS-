import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEncounterDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsString()
  @MinLength(2)
  chiefComplaint!: string;

  @IsString()
  @MinLength(2)
  diagnosis!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
