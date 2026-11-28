import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateAdmissionDto {
  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  patientId!: string;

  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  bedId!: string;
}
