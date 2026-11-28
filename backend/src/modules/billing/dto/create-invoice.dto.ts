import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({"minLength":2,"type":"string"})
  description!: string;

  @IsInt()
  @Max(2147483647)
  @Min(1)
  @ApiProperty({"maximum":2147483647,"minimum":1,"type":"integer"})
  quantity!: number;

  @IsInt()
  @Max(2147483647)
  @Min(0)
  @ApiProperty({"maximum":2147483647,"minimum":0,"type":"integer"})
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  patientId!: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({"format":"uuid","nullable":true,"type":"string"})
  admissionId?: string;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  @Max(100)
  @ApiPropertyOptional({"maximum":100,"minimum":0,"nullable":true,"type":"integer"})
  insuranceCoveragePercent?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  @ApiProperty({"maxItems":50,"minItems":1,"type":() => InvoiceItemInputDto,"isArray":true})
  items!: InvoiceItemInputDto[];
}
