import { FindAppointmentsDto } from './dto/find-appointments.dto';
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  create(@Body() dto: CreateAppointmentDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.create(dto, req.user.userId);
  }

  @Get('options')
  @Roles(Role.receptionist, Role.doctor, Role.admin)
  options() { return this.appointmentsService.options(); }

  // FR-3.4
  @Get()
  @Roles(Role.receptionist, Role.doctor, Role.admin)
  find(@Query() query: FindAppointmentsDto) {
    return this.appointmentsService.findByDoctorAndDate(query.doctor_id, query.date, query.start, query.end, query.page);
  }

  // FR-3.3
  @Patch(':id')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_UPDATED', 'Appointment', true)
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.update(id, dto, req.user.userId);
  }

  @Post(':id/cancel')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_CANCELLED', 'Appointment', true)
  cancel(@Param('id') id: string, @Body() dto: CancelAppointmentDto, @Req() req: { user: { userId: string } }) {
    return this.appointmentsService.cancel(id, dto.reason, req.user.userId);
  }
}
