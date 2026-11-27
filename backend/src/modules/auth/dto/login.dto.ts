import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @ApiProperty({"type":"string"})
  username!: string;

  @IsString()
  @MinLength(6)
  @ApiProperty({"minLength":6,"type":"string"})
  password!: string;
}
