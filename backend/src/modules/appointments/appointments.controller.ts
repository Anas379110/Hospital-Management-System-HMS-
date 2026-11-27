import { ApiOperation, ApiResponse, ApiQuery, ApiExtension } from '@nestjs/swagger';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { FindAppointmentsDto } from './dto/find-appointments.dto';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // FR-3.1
  @Post()
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_CREATED', 'Appointment', true)
  @ApiOperation({"summary": "AppointmentsController.create", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  create(@Body() dto: CreateAppointmentDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.create(dto, req.user.userId);
  }

  @Get('options')
  @Roles(Role.receptionist, Role.doctor, Role.admin)
  @ApiOperation({"summary": "AppointmentsController.options", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "doctor", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  options() { return this.appointmentsService.options(); }

  // FR-3.4
  @Get()
  @Roles(Role.receptionist, Role.doctor, Role.admin)
  @ApiOperation({"summary": "AppointmentsController.find", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "doctor", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiQuery({"name": "page", "required": false, "schema": {"maximum": 10000, "minimum": 1, "nullable": true, "type": "integer"}})
  @ApiQuery({"name": "doctor_id", "required": false, "schema": {"format": "uuid", "nullable": true, "type": "string"}})
  @ApiQuery({"name": "date", "required": false, "description": "Strict YYYY-MM-DD UTC calendar date", "schema": {"nullable": true, "pattern": "^\\d{4}-\\d{2}-\\d{2}$", "type": "string"}})
  @ApiQuery({"name": "start", "required": false, "description": "ISO8601 validated date/date-time; see route notes for stricter range rules", "schema": {"nullable": true, "type": "string"}})
  @ApiQuery({"name": "end", "required": false, "description": "ISO8601 validated date/date-time; see route notes for stricter range rules", "schema": {"nullable": true, "type": "string"}})
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  find(@Query() query: FindAppointmentsDto) {
    return this.appointmentsService.findByDoctorAndDate(query.doctor_id, query.date, query.start, query.end, query.page);
  }

  // FR-3.3
  @Patch(':id')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_UPDATED', 'Appointment', true)
  @ApiOperation({"summary": "AppointmentsController.update", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.update(id, dto, req.user.userId);
  }

  @Post(':id/cancel')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_CANCELLED', 'Appointment', true)
  @ApiOperation({"summary": "AppointmentsController.cancel", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["receptionist", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  cancel(@Param('id') id: string, @Body() dto: CancelAppointmentDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.cancel(id, dto.reason, req.user.userId);
  }
  @Post(':id/attendance')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_ATTENDANCE_RECORDED', 'Appointment', true)
  @ApiOperation({ summary: 'AppointmentsController.recordAttendance', description: 'Manual attendance by Admin/receptionist. Scheduled only, final states cannot reopen. No-show is rejected when an encounter is linked.' })
  @ApiExtension('x-roles', ['receptionist', 'admin'])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({ status: 201, description: 'Attendance recorded. Response shape is service-defined.' })
  @ApiResponse({ status: 400, description: 'Malformed appointment UUID or invalid attendance status' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Role forbidden' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 404, description: 'Appointment not found in current workspace' })
  @ApiResponse({ status: 409, description: 'Final appointment or no-show with linked encounter; refresh before choosing another action' })
  @ApiResponse({ status: 503, description: 'Audit persistence failed, status change rolled back' })
  recordAttendance(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: RecordAttendanceDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.recordAttendance(id, dto, req.user.userId);
  }

}
