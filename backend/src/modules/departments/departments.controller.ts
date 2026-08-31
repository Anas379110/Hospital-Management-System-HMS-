import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles(Role.receptionist, Role.doctor, Role.nurse, Role.admin, Role.manager)
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id/beds')
  @Roles(Role.doctor, Role.nurse, Role.admin, Role.manager)
  getBeds(@Param('id') id: string) {
    return this.departmentsService.getBeds(id);
  }

  @Get(':id/beds/summary')
  @Roles(Role.manager, Role.admin)
  getBedsSummary(@Param('id') id: string) {
    return this.departmentsService.getBedsSummary(id);
  }
}
