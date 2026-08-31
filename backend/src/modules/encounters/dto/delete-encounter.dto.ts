import { IsString, MinLength } from 'class-validator';

export class DeleteEncounterDto {
  // FR-4.4: لا حذف نهائي — سبب إلزامي لأغراض قانونية/تدقيقية (راجع DATABASE.md §3)
  @IsString()
  @MinLength(5)
  reason!: string;
}
