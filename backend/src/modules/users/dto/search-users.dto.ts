import { Transform } from 'class-transformer';
import { IsString, MinLength, MaxLength } from 'class-validator';
export class SearchUsersDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search!: string;
}
