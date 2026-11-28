import { ApiProperty } from '@nestjs/swagger';

// Existing read projections only. No serialization or permission effect.
export class DepartmentResponseDto {
  @ApiProperty({ type: String })
  workspaceId!: string;
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String })
  nameAr!: string;
  @ApiProperty({ type: String })
  nameEn!: string;
  @ApiProperty({ type: 'integer' })
  totalBeds!: number;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
export class DepartmentBedCountsResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 })
  total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 })
  available!: number;
  @ApiProperty({ type: 'integer', minimum: 0 })
  occupied!: number;
  @ApiProperty({ type: 'integer', minimum: 0 })
  maintenance!: number;
}
export class DepartmentOverviewItemResponseDto extends DepartmentBedCountsResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String })
  nameAr!: string;
  @ApiProperty({ type: String })
  nameEn!: string;
}
export class DepartmentOverviewResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  start!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  end!: string;
  @ApiProperty({ type: 'integer', minimum: 0 })
  appointmentCount!: number;
  @ApiProperty({ type: [DepartmentOverviewItemResponseDto] })
  departments!: DepartmentOverviewItemResponseDto[];
}
