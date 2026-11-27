import { ApiOperation, ApiResponse, ApiQuery, ApiExtension } from '@nestjs/swagger';
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
  @ApiOperation({"summary": "PatientsController.create", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["admin", "receptionist"])
  @ApiExtension('x-auth', 'roles')
  @ApiQuery({"name": "force", "required": false, "schema": {"type": "string"}})
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
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
  @ApiOperation({"summary": "PatientsController.search", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "doctor", "nurse", "admin", "manager"])
  @ApiExtension('x-auth', 'roles')
  @ApiQuery({"name": "search", "required": false, "schema": {"type": "string"}})
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  search(@Query('search') search = '') {
    return this.patientsService.search(search);
  }

  @Get('billing-lookup')
  @Roles(Role.billing_clerk, Role.admin)
  @ApiOperation({"summary": "PatientsController.billingLookup", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["billing_clerk", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiQuery({"name": "search", "required": false, "schema": {"type": "string"}})
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  billingLookup(@Query('search') search = '') { return this.patientsService.billingLookup(search); }

  @Get(':id')
  @Roles(Role.receptionist, Role.doctor, Role.nurse, Role.admin, Role.manager)
  @ApiOperation({"summary": "PatientsController.findOne", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "doctor", "nurse", "admin", "manager"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  // FR-2.4
  @Patch(':id')
  @Roles(...PATIENT_WRITE_ROLES)
  @Audit('PATIENT_UPDATED', 'Patient', true)
  @ApiOperation({"summary": "PatientsController.update", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["admin", "receptionist"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @Req() req: AuthedRequest) {
    return this.patientsService.update(id, dto, req.user.userId);
  }

  // FR-4.3
  @Get(':id/records')
  @Roles(Role.doctor, Role.nurse, Role.admin)
  @ApiOperation({"summary": "PatientsController.getMedicalRecords", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["doctor", "nurse", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  getMedicalRecords(@Param('id') id: string) {
    return this.patientsService.getMedicalRecords(id);
  }
}
