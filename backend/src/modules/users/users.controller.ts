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
  search(@Query() dto: SearchUsersDto) {
    return this.usersService.search(dto.search);
  }

  // FR-1.5: المدير (Admin) فقط يستطيع إنشاء حسابات مستخدمين
  @Post()
  @Roles(Role.admin)
  @Audit('USER_CREATED', 'User', true)
  create(@Body() dto: CreateUserDto, @Req() req: { user: { userId: string } }) {
    return this.usersService.create(dto, req.user.userId);
  }

  @Patch(':id/status')
  @Roles(Role.admin)
  @Audit('USER_STATUS_CHANGED', 'User', true)
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto, @Req() req: { user: { userId: string } }) {
    return this.usersService.setActiveStatus(id, dto.isActive, req.user.userId);
  }
}
