import { ApiProperty } from '@nestjs/swagger';
import { IsIn, MinLength, IsString, Matches, MaxLength } from 'class-validator';

export class DepartmentNamesDto {
  @ApiProperty({ minLength: 1, maxLength: 120, pattern: '\\S' })
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/)
  nameAr!: string;
  @ApiProperty({ minLength: 1, maxLength: 120, pattern: '\\S' })
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/)
  nameEn!: string;
}
export class BedNumberDto {
  @ApiProperty({ minLength: 1, maxLength: 40, pattern: '\\S' })
  @IsString() @MinLength(1) @MaxLength(40) @Matches(/\S/)
  bedNumber!: string;
}
export class BedMaintenanceDto {
  @ApiProperty({ enum: ['available', 'maintenance'] })
  @IsIn(['available', 'maintenance'])
  status!: 'available' | 'maintenance';
}
