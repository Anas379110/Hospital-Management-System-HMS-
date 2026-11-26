import { Transform } from 'class-transformer';
import { IsByteLength, IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsEnum(Role)
  role!: Role;
}
