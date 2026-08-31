import { IsUUID } from 'class-validator';

export class CreateAdmissionDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  bedId!: string;
}
