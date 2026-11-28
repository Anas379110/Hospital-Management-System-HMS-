import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

/** Describes the existing projection only; does not serialize or grant access. */
export class PatientIdentityResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  mrn!: string;

  @ApiProperty({ type: String })
  fullName!: string;
}

/** Current complete scalar row returned by patient routes, not billing lookup. */
export class PatientResponseDto extends PatientIdentityResponseDto {
  @ApiProperty({ type: String, description: 'Current fictional workspace identifier, already present in this response.' })
  workspaceId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender })
  gender!: Gender;

  @ApiProperty({ type: String, nullable: true })
  nationalId!: string | null;

  @ApiProperty({ type: String })
  phone!: string;

  @ApiProperty({ type: String, nullable: true })
  address!: string | null;

  @ApiProperty({ type: String, nullable: true })
  emergencyContactName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  emergencyContactPhone!: string | null;

  @ApiProperty({ type: String, format: 'uuid' })
  createdBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
