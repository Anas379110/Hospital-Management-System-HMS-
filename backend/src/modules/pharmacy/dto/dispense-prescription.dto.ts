import { Max, IsInt, IsUUID, Min } from 'class-validator';

export class DispensePrescriptionDto {
  @IsUUID()
  medicationId!: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  quantityDispensed!: number;
}
