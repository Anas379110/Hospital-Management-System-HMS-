import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { DischargeAdmissionDto } from './dto/discharge-admission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

interface AuthedRequest {
  user: { userId: string; username: string; role: Role };
}

@ApiTags('admissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  // FR-5.2 / UC-1
  @Post()
  @Roles(Role.nurse, Role.doctor)
  @Audit('PATIENT_ADMITTED', 'Admission')
  create(@Body() dto: CreateAdmissionDto, @Req() req: AuthedRequest) {
    return this.admissionsService.create(dto, req.user.userId);
  }

  // FR-5.3
  @Post(':id/discharge')
  @Roles(Role.nurse, Role.doctor)
  @Audit('PATIENT_DISCHARGED', 'Admission')
  discharge(@Param('id') id: string, @Body() dto: DischargeAdmissionDto) {
    return this.admissionsService.discharge(id, dto.dischargeNotes);
  }
}
