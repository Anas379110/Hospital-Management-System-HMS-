import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { WaitlistPageResponseDto, WaitlistRequestResponseDto } from './dto/waitlist-response.dto';
import { Controller, Query, Get, Param, ParseUUIDPipe, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiBearerAuth, ApiExtension, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto, WaitlistPageDto } from './dto/create-waitlist.dto';
@ApiTags('waitlist') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments/:departmentId/waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}
  @Get() @Roles(Role.doctor, Role.nurse)
  @ApiQuery({ name: 'page', required: false, type: Number, schema: { type: 'integer', minimum: 0, maximum: 10000, default: 0 } })
  @ApiOperation({ summary: 'List the pending requests in pages of100 chronologically', description: 'Clinical-only patient identity. page and total identify additional pending requests, no inferred medical priority.' })
  @ApiExtension('x-roles', ['doctor','nurse']) @ApiExtension('x-auth', 'roles')
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request' })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: 'Invalid authentication or workspace' })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: 'Clinical role required' })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: 'Scoped record not found' })
  @ApiResponse({ status: 429, type: ApiErrorResponseDto, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 200, type: WaitlistPageResponseDto, description: 'Pending projection, page and total, workspace scoped.' })
  list(@Query() query: WaitlistPageDto, @Param('departmentId', ParseUUIDPipe) departmentId: string, @Req() req: { user: { userId: string } }) { return this.waitlist.list(departmentId, req.user.userId, query.page); }
  @Post() @Roles(Role.doctor, Role.nurse)
  @ApiOperation({ summary: 'Manually add a pending request', description: 'No automatic admission or clinical priority. Duplicate pending request409.' })
  @ApiExtension('x-roles', ['doctor','nurse']) @ApiExtension('x-auth', 'roles')
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request' })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: 'Invalid authentication or workspace' })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: 'Clinical role required' })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: 'Scoped record not found' })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: 'Pending request conflict or already closed' })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto, description: 'Audit persistence failed, operation rolled back' })
  @ApiResponse({ status: 429, type: ApiErrorResponseDto, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 201, type: WaitlistRequestResponseDto, description: 'Created pending request, existing scalar row.' })
  create(@Param('departmentId', ParseUUIDPipe) departmentId: string, @Body() dto: CreateWaitlistDto, @Req() req: { user: { userId: string } }) { return this.waitlist.create(departmentId, dto.patientId, req.user.userId); }
  @Post(':id/cancel') @Roles(Role.doctor, Role.nurse)
  @ApiOperation({ summary: 'Manually cancel a pending request', description: 'Final state, no hard deletion or reopening.' })
  @ApiExtension('x-roles', ['doctor','nurse']) @ApiExtension('x-auth', 'roles')
  @ApiResponse({ status: 400, type: ApiErrorResponseDto, description: 'Invalid request' })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto, description: 'Invalid authentication or workspace' })
  @ApiResponse({ status: 403, type: ApiErrorResponseDto, description: 'Clinical role required' })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto, description: 'Scoped record not found' })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: 'Pending request conflict or already closed' })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto, description: 'Audit persistence failed, operation rolled back' })
  @ApiResponse({ status: 429, type: ApiErrorResponseDto, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 201, type: WaitlistRequestResponseDto, description: 'Cancelled request, existing scalar row.' })
  cancel(@Param('departmentId', ParseUUIDPipe) departmentId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: { user: { userId: string } }) { return this.waitlist.cancel(departmentId, id, req.user.userId); }
}
