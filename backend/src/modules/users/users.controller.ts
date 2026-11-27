import { ApiOperation, ApiResponse, ApiQuery, ApiExtension } from '@nestjs/swagger';
import { SearchUsersDto } from './dto/search-users.dto';
import { Body, Controller, Get, Query, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.admin)
  @ApiOperation({"summary": "UsersController.search", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiQuery({"name": "search", "required": true, "schema": {"maxLength": 100, "minLength": 2, "type": "string"}})
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  search(@Query() dto: SearchUsersDto) {
    return this.usersService.search(dto.search);
  }

  // FR-1.5: المدير (Admin) فقط يستطيع إنشاء حسابات مستخدمين
  @Post()
  @Roles(Role.admin)
  @Audit('USER_CREATED', 'User', true)
  @ApiOperation({"summary": "UsersController.create", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  create(@Body() dto: CreateUserDto, @Req() req: { user: { userId: string } }) {
    return this.usersService.create(dto, req.user.userId);
  }

  @Patch(':id/status')
  @Roles(Role.admin)
  @Audit('USER_STATUS_CHANGED', 'User', true)
  @ApiOperation({"summary": "UsersController.setStatus", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto, @Req() req: { user: { userId: string } }) {
    return this.usersService.setActiveStatus(id, dto.isActive, req.user.userId);
  }
}
