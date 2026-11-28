import { ApiProperty } from '@nestjs/swagger';
import { Max, IsInt, IsString, Min, MinLength } from 'class-validator';

export class AddInvoiceItemDto {
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
