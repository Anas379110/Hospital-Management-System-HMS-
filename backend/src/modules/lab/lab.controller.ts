import { ApiOperation, ApiResponse, ApiExtension } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { LabService } from './lab.service';
import { CreateTestOrderDto } from './dto/create-test-order.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

interface AuthedRequest {
  user: { userId: string; username: string; role: Role };
}

@ApiTags('lab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LabController {
  constructor(private readonly labService: LabService) {}

  @Post('test-orders')
  @Roles(Role.doctor)
  @Audit('TEST_ORDERED', 'TestOrder', true)
  @ApiOperation({"summary": "LabController.create", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["doctor"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  create(@Body() dto: CreateTestOrderDto, @Req() req: AuthedRequest) {
    return this.labService.createOrder(dto, req.user.userId);
  }

  @Get('test-orders/pending')
  @Roles(Role.lab_tech, Role.admin)
  @ApiOperation({"summary": "LabController.pending", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["lab_tech", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  pending() {
    return this.labService.pendingOrders();
  }

  @Post('test-orders/:id/result')
  @Roles(Role.lab_tech, Role.admin)
  @Audit('TEST_RESULT_RECORDED', 'TestOrder', true)
  @ApiOperation({"summary": "LabController.recordResult", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["lab_tech", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  recordResult(@Param('id') id: string, @Body() dto: RecordResultDto, @Req() req: AuthedRequest) {
    return this.labService.recordResult(id, dto, req.user.userId);
  }

  @Get('patients/:id/test-results')
  @Roles(Role.doctor, Role.nurse, Role.admin, Role.lab_tech)
  @ApiOperation({"summary": "LabController.getPatientResults", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["doctor", "nurse", "admin", "lab_tech"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  getPatientResults(@Param('id') id: string) {
    return this.labService.getPatientResults(id);
  }
}
