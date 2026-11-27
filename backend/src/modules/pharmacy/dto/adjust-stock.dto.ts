import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, NotEquals, Max, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const STOCK_REASON_CODES = ['restock', 'correction', 'disposal'] as const;
export type StockReasonCode = typeof STOCK_REASON_CODES[number];
export class AdjustStockDto {
  @IsInt()
  @Max(2147483647)
  @Min(-2147483647)
  @NotEquals(0)
  @ApiProperty({"maximum":2147483647,"minimum":-2147483647,"not":{"enum":[0]},"type":"integer"})
  delta!: number;

  // Optional to preserve existing clients. Never retain this free text in audit.
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  @ApiPropertyOptional({"maxLength":256,"minLength":3,"nullable":true,"type":"string"})
  reason?: string;

  @IsOptional()
  @IsIn(STOCK_REASON_CODES)
  @ApiPropertyOptional({"enum":["restock","correction","disposal"],"nullable":true,"type":"string"})
  reasonCode?: StockReasonCode;
}
