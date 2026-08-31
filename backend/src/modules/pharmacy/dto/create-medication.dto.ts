import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateMedicationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  unit!: string;

  @IsInt()
  @Min(0)
  currentStock!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderThreshold?: number;
}
