import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
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

  // FR-1.5: المدير (Admin) فقط يستطيع إنشاء حسابات مستخدمين
  @Post()
  @Roles(Role.admin)
  @Audit('USER_CREATED', 'User')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id/status')
  @Roles(Role.admin)
  @Audit('USER_STATUS_CHANGED', 'User')
  setStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setActiveStatus(id, isActive);
  }
}
