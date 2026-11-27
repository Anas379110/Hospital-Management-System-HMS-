import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PATIENT_WRITE_ROLES } from '../../common/transaction-audit';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

interface AuthedRequest {
  user: { userId: string; username: string; role: Role };
}

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // FR-2.1
  @Post()
  @Roles(...PATIENT_WRITE_ROLES)
  @Audit('PATIENT_CREATED', 'Patient', true)
  create(
    @Body() dto: CreatePatientDto,
    @Query('force') force: string,
    @Req() req: AuthedRequest,
  ) {
    return this.patientsService.create(dto, req.user.userId, force === 'true');
  }

  // FR-2.3
  @Get()
  @Roles(Role.receptionist, Role.doctor, Role.nurse, Role.admin, Role.manager)
  search(@Query('search') search = '') {
    return this.patientsService.search(search);
  }

  @Get('billing-lookup')
  @Roles(Role.billing_clerk, Role.admin)
  billingLookup(@Query('search') search = '') { return this.patientsService.billingLookup(search); }

  @Get(':id')
  @Roles(Role.receptionist, Role.doctor, Role.nurse, Role.admin, Role.manager)
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  // FR-2.4
  @Patch(':id')
  @Roles(...PATIENT_WRITE_ROLES)
  @Audit('PATIENT_UPDATED', 'Patient', true)
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @Req() req: AuthedRequest) {
    return this.patientsService.update(id, dto, req.user.userId);
  }

  // FR-4.3
  @Get(':id/records')
  @Roles(Role.doctor, Role.nurse, Role.admin)
  getMedicalRecords(@Param('id') id: string) {
    return this.patientsService.getMedicalRecords(id);
  }
}
