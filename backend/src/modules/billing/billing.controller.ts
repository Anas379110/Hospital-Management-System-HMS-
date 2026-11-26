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
  create(@Body() dto: CreateInvoiceDto, @Req() req: AuthedRequest) {
    return this.billingService.createInvoice(dto, req.user.userId);
  }

  @Get(':id')
  @Roles(Role.billing_clerk, Role.admin, Role.manager)
  getOne(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  @Post(':id/items')
  @Roles(Role.billing_clerk, Role.admin)
  @Audit('INVOICE_ITEM_ADDED', 'InvoiceItem', true)
  addItem(@Param('id') id: string, @Body() dto: AddInvoiceItemDto, @Req() req: AuthedRequest) {
    return this.billingService.addItem(id, dto, req.user.userId);
  }

  @Post(':id/payments')
  @Roles(Role.billing_clerk, Role.admin)
  @Audit('PAYMENT_RECORDED', 'Payment', true)
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @Req() req: AuthedRequest) {
    return this.billingService.recordPayment(id, dto, req.user.userId);
  }
}
