import { ApiProperty } from '@nestjs/swagger';

// Existing scalar write output. No serializer, policy or authorization effect.
export class AppointmentResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  patientId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  doctorId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  departmentId!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt!: string;
  @ApiProperty({ type: String, enum: ['scheduled', 'completed', 'no_show', 'cancelled'] })
  status!: string;
  @ApiProperty({ type: String, nullable: true })
  cancelReason!: string | null;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
