import { ApiProperty } from '@nestjs/swagger';
import { Max, IsEnum, IsInt, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @IsInt()
  @Max(2147483647)
  @Min(1)
  @ApiProperty({"maximum":2147483647,"minimum":1,"type":"integer"})
  amount!: number;

  @IsEnum(PaymentMethod)
  @ApiProperty({"enum":["cash","card","insurance"],"type":"string"})
  method!: PaymentMethod;
}
