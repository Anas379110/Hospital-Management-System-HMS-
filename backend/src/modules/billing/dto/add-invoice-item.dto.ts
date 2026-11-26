import { Max, IsInt, IsString, Min, MinLength } from 'class-validator';

export class AddInvoiceItemDto {
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
