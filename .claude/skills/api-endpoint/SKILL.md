---
name: api-endpoint
description: استخدم هذه المهارة عند إضافة Endpoint جديد لأي وحدة (Module) في HMS Backend — تضمن اتباع DTO+Validation+Guard+Test+Docs بشكل متسق.
---

# إضافة Endpoint جديد — HMS

## متى تُستدعى
عند طلب "أضف Endpoint" أو "أنشئ API جديد" لأي وحدة (Patients, Appointments, Encounters, Departments, Admissions).

## Preconditions
- الوحدة (Module) موجودة أصلاً في `src/modules/`، أو أُنشئت أولاً حسب البنية في `CLAUDE.md` §7.
- الـ Endpoint موثَّق مسبقاً في `docs/api/API.md` (إن لم يكن موثقاً، وثّقه أولاً هناك قبل الكود).

## خطوات التنفيذ
1. أنشئ/حدّث DTO في `dto/` مع class-validator (كل حقل له قيد تحقق واضح).
2. أضف RBAC Guard بالأدوار المسموحة بالضبط كما في `docs/api/API.md`.
3. اكتب منطق الأعمال في Service — لا في Controller.
4. إن كانت العملية حساسة (Create/Update/Delete على بيانات مريض/طبية)، تأكد أن Audit Interceptor مفعَّل تلقائياً عليها.
5. أعد صيغة الخطأ الموحدة `{error:{code,message,details}}` لكل حالة فشل (400/401/403/404/409).
6. اكتب Unit Test للـ Service + Integration Test للـ Controller (Happy Path + حالات الفشل الحرجة).
7. حدِّث `docs/api/openapi.yaml` بالـ Endpoint الجديد.

## Rules
- لا `any`. لا منطق أعمال في Controller. لا تجاوز RBAC "مؤقتاً".

## Expected Output
Endpoint يعمل + Tests ناجحة + Swagger/OpenAPI محدَّث + متوافق مع RBAC والصيغة الموحدة للأخطاء.
