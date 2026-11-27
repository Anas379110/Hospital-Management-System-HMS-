import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class CreatePatientDto {
  @IsString()
  @MinLength(3)
  @ApiProperty({"minLength":3,"type":"string"})
  fullName!: string;

  @IsDateString()
  @ApiProperty({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","type":"string"})
  dateOfBirth!: string;

  @IsEnum(Gender)
  @ApiProperty({"enum":["male","female"],"type":"string"})
  gender!: Gender;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  nationalId?: string;

  @IsString()
  @ApiProperty({"type":"string"})
  phone!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({"nullable":true,"type":"string"})
  emergencyContactPhone?: string;
}
