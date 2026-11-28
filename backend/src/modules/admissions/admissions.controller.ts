import { AdmissionResponseDto } from './dto/admission-response.dto';
import { ApiOperation, ApiResponse, ApiExtension } from '@nestjs/swagger';
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ADMISSION_ROLES } from './admission-audit';
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
  @Roles(...ADMISSION_ROLES)
  @Audit('PATIENT_ADMITTED', 'Admission', true)
  @ApiOperation({"summary": "AdmissionsController.create", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["doctor", "nurse"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, type: AdmissionResponseDto, description: 'Existing admission scalar row, including required nullable discharge fields.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  create(@Body() dto: CreateAdmissionDto, @Req() req: AuthedRequest) {
    return this.admissionsService.create(dto, req.user.userId);
  }

  // FR-5.3
  @Post(':id/discharge')
  @Roles(...ADMISSION_ROLES)
  @Audit('PATIENT_DISCHARGED', 'Admission', true)
  @ApiOperation({"summary": "AdmissionsController.discharge", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["doctor", "nurse"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, type: AdmissionResponseDto, description: 'Existing admission scalar row, including required nullable discharge fields.'})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  discharge(@Param('id') id: string, @Body() dto: DischargeAdmissionDto, @Req() req: AuthedRequest) {
    return this.admissionsService.discharge(id, dto.dischargeNotes, req.user.userId);
  }
}
