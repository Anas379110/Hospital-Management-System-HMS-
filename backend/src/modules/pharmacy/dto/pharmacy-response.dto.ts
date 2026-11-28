import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionResponseDto } from '../../encounters/dto/clinical-response.dto';

// Describes existing JSON only. No serialization or authorization effect.
export class MedicationResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String })
  name!: string;
  @ApiProperty({ type: String })
  unit!: string;
  @ApiProperty({ type: 'integer' })
  currentStock!: number;
  @ApiProperty({ type: 'integer' })
  reorderThreshold!: number;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class StockAdjustmentResponseDto extends MedicationResponseDto {
  @ApiProperty({ type: 'integer' })
  adjustmentDelta!: number;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Existing optional echoed request reason, not retained as free text in audit.' })
  adjustmentReason?: string | null;
}

export class PharmacyPatientIdentityResponseDto {
  @ApiProperty({ type: String })
  fullName!: string;
  @ApiProperty({ type: String })
  mrn!: string;
}

export class PharmacyDoctorIdentityResponseDto {
  @ApiProperty({ type: String })
  fullName!: string;
}

export class PharmacyEncounterIdentityResponseDto {
  @ApiProperty({ type: PharmacyPatientIdentityResponseDto })
  patient!: PharmacyPatientIdentityResponseDto;
  @ApiProperty({ type: PharmacyDoctorIdentityResponseDto })
  doctor!: PharmacyDoctorIdentityResponseDto;
}

export class PendingPrescriptionResponseDto extends PrescriptionResponseDto {
  @ApiProperty({ type: PharmacyEncounterIdentityResponseDto })
  encounter!: PharmacyEncounterIdentityResponseDto;
}
