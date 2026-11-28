import { ApiProperty } from '@nestjs/swagger';

// Existing scalar output only. No serialization or permission effect.
export class AdmissionResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  patientId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  bedId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  admittedBy!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  admittedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  dischargedAt!: string | null;
  @ApiProperty({ type: String, nullable: true })
  dischargeNotes!: string | null;
}
