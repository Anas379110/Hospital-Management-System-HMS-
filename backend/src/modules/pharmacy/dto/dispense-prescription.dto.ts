import { ApiProperty } from '@nestjs/swagger';
import { Max, IsInt, IsUUID, Min } from 'class-validator';

export class DispensePrescriptionDto {
  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  medicationId!: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  @ApiProperty({"maximum":2147483647,"minimum":1,"type":"integer"})
  quantityDispensed!: number;
}
