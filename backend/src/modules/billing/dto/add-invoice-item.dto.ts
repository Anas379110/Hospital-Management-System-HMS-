import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AddInvoiceItemDto {
  @IsString()
  @MinLength(2)
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitPrice!: number;
}
