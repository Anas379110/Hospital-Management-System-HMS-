import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsByteLength, IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @ApiProperty({"maxLength":100,"minLength":3,"type":"string"})
  username!: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  @ApiProperty({"minLength":8,"type":"string"})
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @ApiProperty({"maxLength":200,"minLength":1,"type":"string"})
  fullName!: string;

  @IsEnum(Role)
  @ApiProperty({"enum":["admin","receptionist","doctor","nurse","manager","pharmacist","lab_tech","billing_clerk"],"type":"string"})
  role!: Role;
}
