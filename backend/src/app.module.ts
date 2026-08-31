import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { LabModule } from './modules/lab/lab.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // حد أساسي لكل مستخدم/IP — راجع docs/security/SECURITY-REVIEW.md Finding #2
    // و API.md §Rate Limiting. حماية عامة من إساءة الاستخدام أو خلل برمجي متكرر
    // بعميل ما، وليس دفاعاً ضد هجوم موزَّع حقيقي (غير ذي أولوية ببيئة On-Premise معزولة).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    EncountersModule,
    AppointmentsModule,
    DepartmentsModule,
    AdmissionsModule,
    PharmacyModule,
    LabModule,
    BillingModule,
    // كل وحدات نطاق MMP (SCOPE.md §Should) مكتملة الآن
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
