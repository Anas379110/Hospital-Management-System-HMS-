import { ApiProperty } from '@nestjs/swagger';

// Describes existing scalar/nested outputs only, never serializes or grants access.
export class PrescriptionResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  encounterId!: string;

  @ApiProperty({ type: String })
  medicationName!: string;

  @ApiProperty({ type: String })
  dosage!: string;

  @ApiProperty({ type: String })
  duration!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ enum: ['pending', 'dispensed', 'unavailable'] })
  status!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  medicationId!: string | null;

  @ApiProperty({ type: 'integer', nullable: true })
  quantityDispensed!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  dispensedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  dispensedBy!: string | null;

}

export class EncounterResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  patientId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  doctorId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  appointmentId!: string | null;

  @ApiProperty({ type: String })
  chiefComplaint!: string;

  @ApiProperty({ type: String })
  diagnosis!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  encounterDate!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  deleteReason!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

}

export class EncounterWithPrescriptionsResponseDto extends EncounterResponseDto {
  @ApiProperty({ type: [PrescriptionResponseDto] })
  prescriptions!: PrescriptionResponseDto[];

}

