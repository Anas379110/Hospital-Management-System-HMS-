import { MedicationResponseDto, StockAdjustmentResponseDto, PendingPrescriptionResponseDto } from './dto/pharmacy-response.dto';
import { PrescriptionResponseDto } from '../encounters/dto/clinical-response.dto';
import { ApiOperation, ApiResponse, ApiExtension } from '@nestjs/swagger';
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
  @ApiOperation({"summary": "PharmacyController.createMedication", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["pharmacist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, type: MedicationResponseDto, description: 'Existing service payload; lists remain unbounded where applicable.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  createMedication(@Body() dto: CreateMedicationDto, @Req() req: AuthedRequest) {
    return this.pharmacyService.createMedication(dto, req.user.userId);
  }

  @Get('medications')
  @Roles(Role.pharmacist, Role.admin)
  @ApiOperation({"summary": "PharmacyController.listMedications", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["pharmacist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, type: MedicationResponseDto, isArray: true, description: 'Existing service payload; lists remain unbounded where applicable.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  listMedications() {
    return this.pharmacyService.listMedications();
  }

  @Get('medications/low-stock')
  @Roles(Role.pharmacist, Role.admin)
  @ApiOperation({"summary": "PharmacyController.lowStock", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["pharmacist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, type: MedicationResponseDto, isArray: true, description: 'Existing service payload; lists remain unbounded where applicable.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  lowStock() {
    return this.pharmacyService.lowStock();
  }

  @Patch('medications/:id/stock')
  @Roles(Role.pharmacist, Role.admin)
  @Audit('MEDICATION_STOCK_ADJUSTED', 'Medication', true)
  @ApiOperation({"summary": "PharmacyController.adjustStock", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["pharmacist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, type: StockAdjustmentResponseDto, description: 'Existing service payload; lists remain unbounded where applicable.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto, @Req() req: AuthedRequest) {
    return this.pharmacyService.adjustStock(id, dto.delta, dto.reason, req.user.userId, dto.reasonCode);
  }

  @Get('prescriptions/pending')
  @Roles(Role.pharmacist, Role.admin)
  @ApiOperation({"summary": "PharmacyController.pendingPrescriptions", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["pharmacist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, type: PendingPrescriptionResponseDto, isArray: true, description: 'Existing service payload; lists remain unbounded where applicable.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  pendingPrescriptions() {
    return this.pharmacyService.pendingPrescriptions();
  }

  @Post('prescriptions/:id/dispense')
  @Roles(Role.pharmacist, Role.admin)
  @Audit('PRESCRIPTION_DISPENSED', 'Prescription', true)
  @ApiOperation({"summary": "PharmacyController.dispense", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["pharmacist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, type: PrescriptionResponseDto, description: 'Existing service payload; lists remain unbounded where applicable.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  dispense(
    @Param('id') id: string,
    @Body() dto: DispensePrescriptionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.pharmacyService.dispense(id, dto, req.user.userId);
  }
}
