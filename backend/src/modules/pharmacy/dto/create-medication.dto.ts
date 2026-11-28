import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Max, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateMedicationDto {
  @IsString()
  @MinLength(2)
  @ApiProperty({"minLength":2,"type":"string"})
  name!: string;

  @IsString()
  @ApiProperty({"type":"string"})
  unit!: string;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  @ApiProperty({"maximum":2147483647,"minimum":0,"type":"integer"})
  currentStock!: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  @ApiPropertyOptional({"maximum":2147483647,"minimum":0,"nullable":true,"type":"integer"})
  reorderThreshold?: number;
}
