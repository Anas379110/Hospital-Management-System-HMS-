import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InvoiceItemInputDto {
  @IsString()
  @MinLength(2)
  description!: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  @Max(100)
  insuranceCoveragePercent?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  items!: InvoiceItemInputDto[];
}
