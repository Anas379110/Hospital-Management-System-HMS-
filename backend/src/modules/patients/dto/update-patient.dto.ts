import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

// لا يُسمح بتعديل تاريخ الميلاد أو الجنس بعد التسجيل بسهولة — يتطلب مراجعة يدوية خاصة لاحقاً إن لزم
export class UpdatePatientDto extends PartialType(
  OmitType(CreatePatientDto, ['dateOfBirth', 'gender'] as const),
) {
  @ApiPropertyOptional({ type: 'string', minLength: 3, nullable: true })
  fullName?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  phone?: string;
}
