import { Max, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateMedicationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  unit!: string;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  currentStock!: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  reorderThreshold?: number;
}
