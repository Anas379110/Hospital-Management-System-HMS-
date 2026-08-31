import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';

export enum TestTypeDto {
  lab = 'lab',
  radiology = 'radiology',
}

export class CreateTestOrderDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  encounterId!: string;

  @IsEnum(TestTypeDto)
  testType!: TestTypeDto;

  @IsString()
  @MinLength(2)
  testName!: string;
}
