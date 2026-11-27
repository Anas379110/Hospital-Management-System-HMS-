import { Type } from 'class-transformer';
import { ValidateIf, IsInt, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateWaitlistDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() patientId!: string;
}

export class WaitlistPageDto {
  @ApiProperty({ required: false, default: 0, minimum: 0, maximum: 10000 })
  @ValidateIf((_object, value) => value !== undefined) @Type(() => Number) @IsInt() @Min(0) @Max(10000) page = 0;
}
