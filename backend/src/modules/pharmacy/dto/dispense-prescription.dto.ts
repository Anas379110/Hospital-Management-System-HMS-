import { IsInt, IsUUID, Min } from 'class-validator';

export class DispensePrescriptionDto {
  @IsUUID()
  medicationId!: string;

  @IsInt()
  @Min(1)
  quantityDispensed!: number;
}
