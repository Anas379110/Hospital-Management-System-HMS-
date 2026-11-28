import { ApiProperty } from '@nestjs/swagger';

// Existing scalar outputs only. No serialization or permission effect.
export class BedSetupResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  departmentId!: string;
  @ApiProperty({ type: String })
  bedNumber!: string;
  @ApiProperty({ enum: ['available', 'occupied', 'maintenance'] })
  status!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
export class SetupDeletionResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: Boolean })
  deleted!: boolean;
}
