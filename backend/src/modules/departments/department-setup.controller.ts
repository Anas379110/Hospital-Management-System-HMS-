import { DepartmentResponseDto } from './dto/department-summary-response.dto';
import { BedSetupResponseDto, SetupDeletionResponseDto } from './dto/setup-response.dto';
import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DepartmentSetupService } from './department-setup.service';
import { BedMaintenanceDto, BedNumberDto, DepartmentNamesDto } from './dto/setup.dto';

@ApiTags('department-setup')
@ApiBearerAuth()
@ApiExtension('x-auth', 'roles')
@ApiExtension('x-roles', ['admin'])
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 400, description: 'Invalid DTO or UUID' })
@ApiResponse({ status: 401, description: 'Missing or invalid authentication' })
@ApiResponse({ status: 403, description: 'Active Admin required' })
@ApiResponse({ status: 404, description: 'Scoped setup record not found' })
@ApiResponse({ status: 409, description: 'Occupied bed, duplicate label or linked history' })
@ApiResponse({ status: 503, description: 'Audit persistence failed, operation rolled back' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
@Controller('departments')
export class DepartmentSetupController {
  constructor(private readonly setup: DepartmentSetupService) {}
  @Post()
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 201, type: DepartmentResponseDto })
  create(@Body() dto: DepartmentNamesDto, @Req() req: { user: { userId: string } }) {
    return this.setup.createDepartment(dto, req.user.userId);
  }
  @Patch(':id')
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 200, type: DepartmentResponseDto })
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartmentNamesDto, @Req() req: { user: { userId: string } }) {
    return this.setup.renameDepartment(id, dto, req.user.userId);
  }
  @Delete(':id')
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 200, type: SetupDeletionResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: { userId: string } }) {
    return this.setup.deleteDepartment(id, req.user.userId);
  }
  @Post(':id/beds')
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 201, type: BedSetupResponseDto })
  createBed(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BedNumberDto, @Req() req: { user: { userId: string } }) {
    return this.setup.createBed(id, dto.bedNumber, req.user.userId);
  }
  @Patch(':id/beds/:bedId')
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 200, type: BedSetupResponseDto })
  renameBed(@Param('id', ParseUUIDPipe) id: string, @Param('bedId', ParseUUIDPipe) bedId: string, @Body() dto: BedNumberDto, @Req() req: { user: { userId: string } }) {
    return this.setup.updateBed(id, bedId, dto, req.user.userId);
  }
  @Patch(':id/beds/:bedId/maintenance')
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 200, type: BedSetupResponseDto })
  maintenance(@Param('id', ParseUUIDPipe) id: string, @Param('bedId', ParseUUIDPipe) bedId: string, @Body() dto: BedMaintenanceDto, @Req() req: { user: { userId: string } }) {
    return this.setup.updateBed(id, bedId, dto, req.user.userId);
  }
  @Delete(':id/beds/:bedId')
  @ApiExtension('x-auth', 'roles')
  @ApiExtension('x-roles', ['admin'])
  @ApiResponse({ status: 200, type: SetupDeletionResponseDto })
  removeBed(@Param('id', ParseUUIDPipe) id: string, @Param('bedId', ParseUUIDPipe) bedId: string, @Req() req: { user: { userId: string } }) {
    return this.setup.deleteBed(id, bedId, req.user.userId);
  }
}
