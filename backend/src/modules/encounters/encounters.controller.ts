import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { DeleteEncounterDto } from './dto/delete-encounter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

interface AuthedRequest {
  user: { userId: string; username: string; role: Role };
}

@ApiTags('encounters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  // FR-4.1: طبيب فقط يسجل زيارة
  @Post()
  @Roles(Role.doctor)
  @Audit('ENCOUNTER_CREATED', 'Encounter', true)
  create(@Body() dto: CreateEncounterDto, @Req() req: AuthedRequest) {
    return this.encountersService.create(dto, req.user.userId);
  }

  @Get(':id')
  @Roles(Role.doctor, Role.nurse, Role.admin)
  findOne(@Param('id') id: string) {
    return this.encountersService.findOne(id);
  }

  // FR-4.2
  @Post(':id/prescriptions')
  @Roles(Role.doctor)
  @Audit('PRESCRIPTION_ADDED', 'Prescription', true)
  addPrescription(@Param('id') id: string, @Body() dto: CreatePrescriptionDto, @Req() req: AuthedRequest) {
    return this.encountersService.addPrescription(id, dto, req.user.userId);
  }

  // FR-4.4: حذف منطقي فقط، لصاحب السجل أو Admin (يُفرض داخل Service)
  @Delete(':id')
  @Roles(Role.doctor, Role.admin)
  @Audit('ENCOUNTER_SOFT_DELETED', 'Encounter', true)
  softDelete(@Param('id') id: string, @Body() dto: DeleteEncounterDto, @Req() req: AuthedRequest) {
    return this.encountersService.softDelete(id, dto.reason, req.user);
  }
}
