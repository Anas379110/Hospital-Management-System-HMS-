import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { DemoService } from './demo.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
class SwitchRoleDto { @IsEnum(Role) role!: Role; }
@Controller('demo')
export class DemoController {
 constructor(private readonly demo:DemoService) {}
 @Post('start') @Throttle({default:{limit:3,ttl:60_000}})
 start() { return this.demo.create(); }
 @Get('audit') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.admin)
 audit() { return this.demo.audit(); }
 @Post('role') @UseGuards(JwtAuthGuard)
 role(@Body() dto:SwitchRoleDto,@Req() req:{user:{workspace:string}}) { return this.demo.token(req.user.workspace,dto.role); }
}
