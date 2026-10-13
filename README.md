# نظام إدارة المشافي (HMS)
**Hospital Management System (HMS)** · التصنيف: نظام / تطبيق
> ملف تعريفي بالمشروع ونطاقه؛ هذا المستودع يحتوي على التوثيق فقط ولا يتضمن الشفرة المصدرية.
> Project overview and scope; this repository contains documentation only, not implementation source code.

## نبذة عن المشروع
منصة شاملة لإدارة مشفى بسعة أكثر من 10,000 مريض، تغطي 11 وحدة و8 أدوار مستخدمين، عربي/إنجليزي.

## أبرز النقاط
- Modular Monolith (NestJS + PostgreSQL + Prisma) يغطي الاستقبال والسجل الطبي والصيدلية والمختبر والفوترة
- صلاحيات مبنية على الأدوار (RBAC) عبر 8 أدوار مستخدمين مختلفة
- تصميم Resilient-by-default يعمل بموثوقية رغم تذبذب الكهرباء والإنترنت

## الدور
تصميم وتطوير وحدات إدارة المستشفى وواجهاته، مع مراعاة الأدوار المختلفة ومتطلبات التشغيل المحلي وثنائية اللغة.

## التقنيات المستخدمة
NestJS, TypeScript, PostgreSQL, Prisma, React, JWT

التفاصيل في [TECHSTACK.md](./TECHSTACK.md).
