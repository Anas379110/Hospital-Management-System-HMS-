import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class FindAppointmentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @IsUUID()
  doctor_id?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  start?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  end?: string;
}
