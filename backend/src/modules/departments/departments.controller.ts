import { ApiOperation, ApiResponse, ApiQuery, ApiExtension } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsDateString, Matches } from 'class-validator';
class OverviewRangeDto {
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  @IsDateString({ strict: true })
  @ApiProperty({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","pattern":"(Z|[+-]\\d{2}:\\d{2})$","type":"string"})
start!: string;
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  @IsDateString({ strict: true })
  @ApiProperty({"description":"ISO8601 validated date/date-time; see route notes for stricter range rules","pattern":"(Z|[+-]\\d{2}:\\d{2})$","type":"string"})
end!: string;
}

import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const CLINICAL_BED_IDENTITY_ROLES: readonly Role[] = [Role.doctor, Role.nurse];

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles(Role.receptionist, Role.doctor, Role.nurse, Role.admin, Role.manager)
  @ApiOperation({"summary": "DepartmentsController.findAll", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "doctor", "nurse", "admin", "manager"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get('overview')
  @Roles(Role.manager, Role.admin)
  @ApiOperation({"summary": "DepartmentsController.overview", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["manager", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiQuery({"name": "start", "required": true, "description": "ISO8601 validated date/date-time; see route notes for stricter range rules", "schema": {"pattern": "(Z|[+-]\\d{2}:\\d{2})$", "type": "string"}})
  @ApiQuery({"name": "end", "required": true, "description": "ISO8601 validated date/date-time; see route notes for stricter range rules", "schema": {"pattern": "(Z|[+-]\\d{2}:\\d{2})$", "type": "string"}})
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  overview(@Query() range: OverviewRangeDto) {
    return this.departmentsService.overview(range.start, range.end);
  }

  @Get(':id/beds')
  @Roles(Role.doctor, Role.nurse, Role.admin, Role.manager)
  @ApiOperation({"summary": "DepartmentsController.getBeds", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["doctor", "nurse", "admin", "manager"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  getBeds(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: { role: Role } }) {
    return this.departmentsService.getBeds(id, CLINICAL_BED_IDENTITY_ROLES.includes(req.user.role));
  }

  @Get(':id/beds/summary')
  @Roles(Role.manager, Role.admin)
  @ApiOperation({"summary": "DepartmentsController.getBedsSummary", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["manager", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  getBedsSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.getBedsSummary(id);
  }
}
