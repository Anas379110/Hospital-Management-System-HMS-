import { ApiProperty } from '@nestjs/swagger';
import { PatientIdentityResponseDto } from '../../patients/dto/patient-response.dto';

/** Existing full scalar write result. Clinical role authorization is unchanged. */
export class WaitlistRequestResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  patientId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  departmentId!: string;

  @ApiProperty({ enum: ['pending', 'admitted', 'cancelled'], description: 'Current stored request state. Create returns pending; cancel returns cancelled.' })
  status!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  requestedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  closedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  admissionId!: string | null;
}

/** Pending-list projection intentionally excludes workspace, actor and clinical data. */
export class WaitlistItemResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  departmentId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt!: string;

  @ApiProperty({ enum: ['pending'] })
  status!: string;

  @ApiProperty({ type: PatientIdentityResponseDto })
  patient!: PatientIdentityResponseDto;
}

export class WaitlistPageResponseDto {
  @ApiProperty({ type: [WaitlistItemResponseDto], maxItems: 100 })
  items!: WaitlistItemResponseDto[];

  @ApiProperty({ type: 'integer', minimum: 0, maximum: 10000 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Total currently pending requests in this department and workspace in the same read snapshot.' })
  total!: number;
}
