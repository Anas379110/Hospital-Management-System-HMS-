import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class FindAppointmentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  @ApiPropertyOptional({"maximum":10000,"minimum":1,"nullable":true,"type":"integer"})
  page?: number;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({"format":"uuid","nullable":true,"type":"string"})
  doctor_id?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  @ApiPropertyOptional({"description":"Strict YYYY-MM-DD UTC calendar date","nullable":true,"pattern":"^\\d{4}-\\d{2}-\\d{2}$","type":"string"})
  date?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @ApiPropertyOptional({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","nullable":true,"type":"string"})
  start?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @ApiPropertyOptional({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","nullable":true,"type":"string"})
  end?: string;
}
