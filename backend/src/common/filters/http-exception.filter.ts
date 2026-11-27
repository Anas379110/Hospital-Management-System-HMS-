import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * يوحّد صيغة كل استجابات الخطأ عبر النظام كاملاً:
 * { error: { code, message, details } }
 * راجع API.md — "لا Stack Trace للمستخدم أبداً" (متطلب NFR صريح).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        code = HttpStatus[status] ?? 'ERROR';
        message = res;
      } else if (
        typeof res === 'object' &&
        res !== null &&
        'error' in res &&
        typeof res.error === 'object' &&
        res.error !== null
      ) {
        // الاستثناء مُنسَّق مسبقاً بصيغتنا الموحدة (مثال: من RolesGuard)
        const errObj = (res as { error: { code?: string; message?: string; details?: unknown[] } })
          .error;
        code = typeof errObj.code === 'string' ? errObj.code : code;
        message = typeof errObj.message === 'string' ? errObj.message : message;
        details = Array.isArray(errObj.details) ? errObj.details : [];
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        // استثناءات NestJS الافتراضية (مثال: ValidationPipe)
        const resObj = res as { message?: string | string[] };
        code = HttpStatus[status] ?? 'ERROR';
        message = Array.isArray(resObj.message)
          ? 'بيانات غير صالحة — راجع الحقول المُدخلة'
          : (resObj.message ?? message);
        details = Array.isArray(resObj.message) ? resObj.message : [];
      }
    } else if (exception instanceof Error && 'status' in exception &&
      (['entity.parse.failed', 'entity.too.large', 'encoding.unsupported', 'charset.unsupported', 'request.aborted', 'request.size.invalid'].includes(String('type' in exception ? exception.type : '')) || ('code' in exception && exception.code === 'Z_DATA_ERROR')) &&
      [400, 413, 415].includes(Number(exception.status))) {
      status = Number(exception.status);
      code = HttpStatus[status] ?? 'BAD_REQUEST';
      message = 'Invalid request body';
    } else if (process.env.HMS_PUBLIC_DEMO === 'true' && exception instanceof Error && 'code' in exception && ['P2028','P2024'].includes(String(exception.code))) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'DEMO_BUSY';
      message = 'Demo is busy. Try again shortly.';
      response.setHeader('Retry-After', '5');
    } else {
      // خطأ غير متوقع — لا نُظهر تفاصيله للمستخدم، فقط نسجله داخلياً
      this.logger.error({ code: 'UNHANDLED_REQUEST_ERROR' });
    }

    if (status === 503 && code === 'DEMO_BUSY') response.setHeader('Retry-After', '5');
    response.status(status).json({ error: { code, message, details } });
  }
}
