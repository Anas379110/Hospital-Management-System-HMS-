import { ApiOperation, ApiResponse, ApiExtension } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoiceItemDto } from './dto/add-invoice-item.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

interface AuthedRequest {
  user: { userId: string; username: string; role: Role };
}

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @Roles(Role.billing_clerk, Role.admin)
  @Audit('INVOICE_CREATED', 'Invoice', true)
  @ApiOperation({"summary": "BillingController.create", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["billing_clerk", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  create(@Body() dto: CreateInvoiceDto, @Req() req: AuthedRequest) {
    return this.billingService.createInvoice(dto, req.user.userId);
  }

  @Get(':id')
  @Roles(Role.billing_clerk, Role.admin, Role.manager)
  @ApiOperation({"summary": "BillingController.getOne", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["billing_clerk", "admin", "manager"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 200, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  getOne(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  @Post(':id/items')
  @Roles(Role.billing_clerk, Role.admin)
  @Audit('INVOICE_ITEM_ADDED', 'InvoiceItem', true)
  @ApiOperation({"summary": "BillingController.addItem", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["billing_clerk", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  addItem(@Param('id') id: string, @Body() dto: AddInvoiceItemDto, @Req() req: AuthedRequest) {
    return this.billingService.addItem(id, dto, req.user.userId);
  }

  @Post(':id/payments')
  @Roles(Role.billing_clerk, Role.admin)
  @Audit('PAYMENT_RECORDED', 'Payment', true)
  @ApiOperation({"summary": "BillingController.recordPayment", "description": "Role permissions and service-level limits are described in docs/api/API.md. This annotation does not alter authorization."})
  @ApiExtension('x-roles', ["billing_clerk", "admin"])
  @ApiExtension('x-auth', 'roles')
  @ApiResponse({"status": 201, "description": "Successful JSON response. Result shape is service-defined; no unverified response schema is asserted."})
  @ApiResponse({"status": 400, "description": "Invalid request"})
  @ApiResponse({"status": 401, "description": "Missing/expired token, inactive current user, or invalid/expired workspace"})
  @ApiResponse({"status": 403, "description": "Current persisted role is not permitted"})
  @ApiResponse({"status": 429, "description": "Rate limit exceeded"})
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @Req() req: AuthedRequest) {
    return this.billingService.recordPayment(id, dto, req.user.userId);
  }
}
