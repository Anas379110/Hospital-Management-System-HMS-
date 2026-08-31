import { IsInt, IsString, MinLength } from 'class-validator';

export class AdjustStockDto {
  // موجب = إضافة (إعادة تعبئة)، سالب = تصحيح/إتلاف — راجع API.md
  @IsInt()
  delta!: number;

  @IsString()
  @MinLength(3)
  reason!: string;
}
