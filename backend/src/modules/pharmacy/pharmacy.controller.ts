import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PharmacyService } from './pharmacy.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

interface AuthedRequest {
  user: { userId: string; username: string; role: Role };
}

@ApiTags('pharmacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Post('medications')
  @Roles(Role.pharmacist, Role.admin)
  @Audit('MEDICATION_CREATED', 'Medication', true)
  createMedication(@Body() dto: CreateMedicationDto, @Req() req: AuthedRequest) {
    return this.pharmacyService.createMedication(dto, req.user.userId);
  }

  @Get('medications')
  @Roles(Role.pharmacist, Role.admin)
  listMedications() {
    return this.pharmacyService.listMedications();
  }

  @Get('medications/low-stock')
  @Roles(Role.pharmacist, Role.admin)
  lowStock() {
    return this.pharmacyService.lowStock();
  }

  @Patch('medications/:id/stock')
  @Roles(Role.pharmacist, Role.admin)
  @Audit('MEDICATION_STOCK_ADJUSTED', 'Medication', true)
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto, @Req() req: AuthedRequest) {
    return this.pharmacyService.adjustStock(id, dto.delta, dto.reason, req.user.userId, dto.reasonCode);
  }

  @Get('prescriptions/pending')
  @Roles(Role.pharmacist, Role.admin)
  pendingPrescriptions() {
    return this.pharmacyService.pendingPrescriptions();
  }

  @Post('prescriptions/:id/dispense')
  @Roles(Role.pharmacist, Role.admin)
  @Audit('PRESCRIPTION_DISPENSED', 'Prescription', true)
  dispense(
    @Param('id') id: string,
    @Body() dto: DispensePrescriptionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.pharmacyService.dispense(id, dto, req.user.userId);
  }
}
