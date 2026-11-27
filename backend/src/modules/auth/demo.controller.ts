import { ApiOperation, ApiResponse, ApiExtension } from '@nestjs/swagger';
import { ApiProperty, ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { DemoService } from './demo.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
class SwitchRoleDto {
  @IsEnum(Role)
  @ApiProperty({"enum":["admin","receptionist","doctor","nurse","manager","pharmacist","lab_tech","billing_clerk"],"type":"string"})
  role!: Role;
}
@Controller('demo')
export class DemoController {
 constructor(private readonly demo:DemoService) {}
 @Post('start') @Throttle({default:{limit:3,ttl:60_000}})
 @ApiOperation({"summary": "DemoController.start", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
 @ApiExtension('x-roles', [])
  @ApiExtension('x-auth', 'public')
 @ApiExtension('x-availability', 'HMS_PUBLIC_DEMO=true only; service returns404 outside public mode')
 @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
 @ApiResponse({"status": 400, "description": "Invalid request"})
 @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
 start() { return this.demo.create(); }
 @ApiBearerAuth()
 @Get('audit') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.admin)
 @ApiOperation({"summary": "DemoController.audit", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
 @ApiExtension('x-roles', ["admin"])
  @ApiExtension('x-auth', 'roles')
 @ApiExtension('x-availability', 'HMS_PUBLIC_DEMO=true only; service returns404 outside public mode')
 @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
 @ApiResponse({"status": 400, "description": "Invalid request"})
 @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
 @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
 @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
 audit() { return this.demo.audit(); }
 @ApiBearerAuth()
 @Post('role') @UseGuards(JwtAuthGuard)
 @ApiOperation({"summary": "DemoController.role", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
 @ApiExtension('x-roles', [])
  @ApiExtension('x-auth', 'any-authenticated-user')
 @ApiExtension('x-availability', 'HMS_PUBLIC_DEMO=true only; service returns404 outside public mode')
 @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
 @ApiResponse({"status": 400, "description": "Invalid request"})
 @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
 @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
 role(@Body() dto:SwitchRoleDto,@Req() req:{user:{workspace:string}}) { return this.demo.token(req.user.workspace,dto.role); }
}
