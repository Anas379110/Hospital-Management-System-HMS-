import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
export class SetUserStatusDto {
  @IsBoolean()
  @ApiProperty({"type":"boolean"})
  isActive!: boolean;
}
