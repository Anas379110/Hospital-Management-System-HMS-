import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePrescriptionDto {
  @IsString()
  @MinLength(2)
  medicationName!: string;

  @IsString()
  dosage!: string;

  @IsString()
  duration!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
