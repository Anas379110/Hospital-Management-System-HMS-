# نظام إدارة المشافي (HMS) — سوريا

نظام إدارة مشفى شامل (سعة 10,000+ مريض)، On-Premise بالكامل، عربي/إنجليزي (RTL/LTR)، مبني بمعمارية Modular Monolith.

## الميزات
تسجيل مرضى، مواعيد، سجل طبي إلكتروني، أقسام وأسرّة، صيدلية، مختبر/أشعة، فوترة وتأمين — 11 وحدة كاملة، 8 أدوار مستخدمين.

## Architecture
Modular Monolith (NestJS + PostgreSQL + Prisma) — راجع `ARCHITECTURE.md` للتفاصيل الكاملة.

## المتطلبات
- Node.js 20+
- PostgreSQL 15+ (محلي أو On-Premise)

## التثبيت والتشغيل (Backend)
```bash
cd backend
npm install
cp ../.env.example .env   # عدّل DATABASE_URL و JWT_SECRET فعلياً
npx prisma migrate dev --name init
# طبّق يدوياً: database/migrations/manual-sql/appointments_unique_partial_index.sql
npx prisma db seed
npm run start:dev         # يعمل على http://localhost:3000
```

## التثبيت والتشغيل (Frontend)
```bash
cd frontend
npm install
npm run dev                # يعمل على http://localhost:5173
```

## تشغيل الاختبارات
```bash
cd backend
npm run test        # 53 اختبار وحدة يجب أن تنجح جميعها
npm run test:e2e
```

## بناء نسخة إنتاجية
```bash
cd backend && npm run build
cd frontend && npm run build   # الناتج في frontend/dist/
```

## حسابات تجريبية (بعد Seed)
| Username | Role | كلمة المرور المؤقتة |
|---|---|---|
| admin | admin | ChangeMe123! |
| pharmacist1 | pharmacist | ChangeMe123! |
| labtech1 | lab_tech | ChangeMe123! |
| billing1 | billing_clerk | ChangeMe123! |

⚠️ **غيّر كل كلمات المرور فوراً قبل أي استخدام فعلي** — راجع `docs/security/SECURITY-REVIEW.md` Finding #6.

## التوثيق الكامل
| الملف | المحتوى |
|---|---|
| `PROJECT.md` | نظرة عامة على المشروع |
| `ARCHITECTURE.md` | المعمارية الكاملة |
| `TECH-STACK.md` | التقنيات والأسباب |
| `docs/database/DATABASE.md` + `database/schema.prisma` | قاعدة البيانات |
| `docs/api/API.md` | كل الـ Endpoints |
| `docs/requirements/SRS.md` + ملحقات SRS-PHARMACY/LAB/BILLING | المتطلبات الكاملة |
| `DECISIONS.md` | كل القرارات الهندسية (21 قراراً) |
| `docs/security/SECURITY-REVIEW.md` | المراجعة الأمنية |
| `docs/testing/UAT-PLAN.md` | خطة اختبار المستخدمين الحقيقيين |
| `PROJECT-AUDIT.md` | التدقيق الشامل الحالي — **اقرأه قبل أي نشر فعلي** |
| `STATUS.md` | حالة المشروع الحيّة والمحدَّثة دائماً |
| `CLAUDE.md` / `AGENTS.md` | تعليمات Claude Code / Codex CLI |

## ⚠️ قبل الاستخدام الفعلي على مرضى حقيقيين
راجع `PROJECT-AUDIT.md` — توجد 4 نقاط حرجة (🔴) يجب معالجتها أولاً، أهمها: لم تُختبَر Migration فعلياً على قاعدة بيانات حقيقية بعد (قيد بيئة التطوير فقط، وليس مشكلة بالتصميم).

## الترخيص
لا ترخيص علني بعد — مشروع داخلي للمشفى.
