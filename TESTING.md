# TESTING.md — نظام إدارة المشافي (HMS)

## أنواع الاختبارات المستخدمة
- **Unit Tests (Jest):** لكل Service — منطق الأعمال بمعزل عن DB/HTTP (باستخدام Prisma Mock).
- **Integration Tests (Jest + Supertest):** لكل Controller — طلب HTTP كامل مقابل قاعدة بيانات اختبار حقيقية (schema معزول أو DB منفصلة للاختبار).
- **E2E:** يُضاف لاحقاً في MMP عند اكتمال أكثر من وحدة مترابطة (Playwright) — غير حرج لـ Slice الأول بحجمه الحالي.
- **Security Tests:** جزء من Integration — تحقق من 401/403 لكل Endpoint محمي.

## القاعدة الذهبية
اكتب الاختبار مع الكود لا بعده. لا Feature "مكتملة" (Definition of Done) بلا اختبارات ناجحة.

## الحالات الإلزامية لكل Endpoint
1. Happy Path (المدخلات صحيحة، الدور مخوَّل)
2. Invalid Input (400 — DTO validation يرفض بيانات ناقصة/خاطئة)
3. Unauthorized (401 — بلا Token)
4. Forbidden (403 — Token صالح لكن دور غير مخوَّل)
5. Not Found (404 — مورد غير موجود) عند الانطباق
6. Conflict (409) عند الانطباق — مثال: MRN مكرر (تنبيه لا حجب)، تعارض موعد، سرير مشغول

## هدف التغطية
لا نسبة صارمة مبكرة، لكن كل منطق حساس (RBAC, Audit, Transactions الذرية) يجب أن يكون مغطى 100%. الهدف العام: تغطية > 80% مع نمو المشروع (توصية الدليل الأساسي).

## بيئة الاختبار
- قاعدة بيانات PostgreSQL منفصلة للاختبار (`hms_test`)، تُصفَّر (`prisma migrate reset`) قبل كل تشغيل CI.
- لا استخدام لقاعدة بيانات Production أو بيانات مرضى حقيقية في الاختبارات إطلاقاً.

## أوامر
```
npm run test          # Unit
npm run test:e2e       # Integration (Supertest)
npm run test:cov       # تغطية
```
