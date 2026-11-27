import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';

export enum TestTypeDto {
  lab = 'lab',
  radiology = 'radiology',
}

export class CreateTestOrderDto {
  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  patientId!: string;

  @IsUUID()
  @ApiProperty({"format":"uuid","type":"string"})
  encounterId!: string;

  @IsEnum(TestTypeDto)
  @ApiProperty({"enum":["lab","radiology"],"type":"string"})
  testType!: TestTypeDto;

  @IsString()
  @MinLength(2)
  @ApiProperty({"minLength":2,"type":"string"})
  testName!: string;
}
