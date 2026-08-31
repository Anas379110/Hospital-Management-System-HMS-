import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

// لا يُسمح بتعديل تاريخ الميلاد أو الجنس بعد التسجيل بسهولة — يتطلب مراجعة يدوية خاصة لاحقاً إن لزم
export class UpdatePatientDto extends PartialType(
  OmitType(CreatePatientDto, ['dateOfBirth', 'gender'] as const),
) {}
