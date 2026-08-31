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

      if (typeof res === 'object' && res !== null && 'error' in res) {
        // الاستثناء مُنسَّق مسبقاً بصيغتنا الموحدة (مثال: من RolesGuard)
        const errObj = (res as { error: { code?: string; message?: string; details?: unknown[] } })
          .error;
        code = errObj.code ?? code;
        message = errObj.message ?? message;
        details = errObj.details ?? [];
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        // استثناءات NestJS الافتراضية (مثال: ValidationPipe)
        const resObj = res as { message?: string | string[] };
        code = HttpStatus[status] ?? 'ERROR';
        message = Array.isArray(resObj.message)
          ? 'بيانات غير صالحة — راجع الحقول المُدخلة'
          : (resObj.message ?? message);
        details = Array.isArray(resObj.message) ? resObj.message : [];
      }
    } else {
      // خطأ غير متوقع — لا نُظهر تفاصيله للمستخدم، فقط نسجله داخلياً
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({ error: { code, message, details } });
  }
}
