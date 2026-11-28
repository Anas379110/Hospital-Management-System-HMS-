import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RecordResultDto {
  @IsString()
  @MinLength(1)
  @ApiProperty({"minLength":1,"type":"string"})
  result!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  resultNotes?: string;
}
