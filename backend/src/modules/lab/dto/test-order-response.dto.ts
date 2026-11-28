import { ApiProperty } from '@nestjs/swagger';

export class TestOrderResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  patientId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  encounterId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orderedBy!: string;

  @ApiProperty({ enum: ['lab', 'radiology'] })
  testType!: string;

  @ApiProperty({ type: String })
  testName!: string;

  @ApiProperty({ enum: ['pending', 'completed', 'cancelled'] })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  orderedAt!: string;

  @ApiProperty({ type: String, nullable: true })
  result!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resultNotes!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  completedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;

}

export class TestPatientIdentityResponseDto {
  @ApiProperty({ type: String })
  fullName!: string;

  @ApiProperty({ type: String })
  mrn!: string;

}

export class OrderingUserIdentityResponseDto {
  @ApiProperty({ type: String })
  fullName!: string;

}

export class PendingTestOrderResponseDto extends TestOrderResponseDto {
  @ApiProperty({ type: TestPatientIdentityResponseDto })
  patient!: TestPatientIdentityResponseDto;

  @ApiProperty({ type: OrderingUserIdentityResponseDto })
  orderedByUser!: OrderingUserIdentityResponseDto;

}

