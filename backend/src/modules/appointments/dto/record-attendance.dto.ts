import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Manual final attendance decision, approved for Admin/receptionist only. */
export class RecordAttendanceDto {
  @IsIn(['completed', 'no_show'])
  @ApiProperty({ type: 'string', enum: ['completed', 'no_show'], description: 'Manual attended or no-show decision. Final states cannot be reopened.' })
  status!: 'completed' | 'no_show';
}
