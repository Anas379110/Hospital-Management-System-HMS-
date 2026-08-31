import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  @Audit('APPOINTMENT_CREATED', 'Appointment')
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  // FR-3.4
  @Get()
  @Roles(Role.receptionist, Role.doctor, Role.admin)
  find(@Query('doctor_id') doctorId?: string, @Query('date') date?: string) {
    return this.appointmentsService.findByDoctorAndDate(doctorId, date);
  }

  // FR-3.3
  @Patch(':id')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_UPDATED', 'Appointment')
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, dto);
  }

  @Post(':id/cancel')
  @Roles(Role.receptionist, Role.admin)
  @Audit('APPOINTMENT_CANCELLED', 'Appointment')
  cancel(@Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.appointmentsService.cancel(id, dto.reason);
  }
}
