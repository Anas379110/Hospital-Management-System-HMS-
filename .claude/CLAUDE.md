# CLAUDE.md — PROJECT BRAIN FOR CLAUDE
## نظام إدارة المشافي (HMS) — سوريا

---

## 1. Project Overview
نظام إدارة مشفى كبير (سعة 10,000+ مريض) — On-Premise بالكامل، عربي/إنجليزي (RTL/LTR)، بلا أي اتصال إنترنت إلزامي للوظائف الأساسية. حساسية بيانات عالية (بيانات صحية + قانون سوريا 12/2024 لحماية البيانات).

**اقرأ دائماً قبل أي عمل:**
- `PROJECT.md` قبل أي تخطيط لميزة جديدة
- `docs/requirements/SRS.md` قبل تنفيذ أي Requirement
- `ARCHITECTURE.md` قبل أي تغيير معماري
- `DECISIONS.md` قبل تغيير أي قرار مُعتمد سابقاً
- `docs/database/DATABASE.md` قبل أي تغيير على قاعدة البيانات
- `TESTING.md` قبل تعديل الاختبارات (يُنشأ في Gate 7)

## 2. Current Phase
**Post-MMP — Gate 9 (Deployment) قيد التحضير** (انظر `STATUS.md` للحالة الدقيقة المحدَّثة دائماً، و`PROJECT-AUDIT.md` للفجوات المتبقية قبل نشر فعلي).

## 3. Architecture (ملخص — التفاصيل في ARCHITECTURE.md)
Modular Monolith واحد. **11 وحدة كاملة**: Auth&RBAC, Users, Patients, Encounters (EMR), Appointments, Departments&Beds, Admissions, Pharmacy, Lab (مختبر/أشعة), Billing. بلا Microservices، بلا Redis/Queue خارجية. كل عملية حساسة (تسكين سرير، صرف دواء، دفعة فاتورة) داخل Transaction ذرية — نمط متكرر عبر 4 وحدات (Admissions, Pharmacy, Billing تحديداً تستخدم `prisma.$transaction`).

**نمط Expand-Only:** كل توسعة MMP (Slices 5-7) اتّبعت Expand فقط بلا Contract — لا حذف أعمدة، لا كسر بيانات قائمة. طبِّق نفس النمط لأي توسعة مستقبلية.

## 4. Tech Stack (ملخص — التفاصيل في TECH-STACK.md)
- **Backend:** Node.js + NestJS (TypeScript) + Prisma ORM
- **DB:** PostgreSQL — **14 موديلاً** (راجع database/schema.prisma كمصدر حقيقة)
- **Frontend:** React + TypeScript + MUI + React Query + react-i18next
- **Auth:** Passport.js (JWT) + bcrypt + `@nestjs/throttler` (Rate Limiting — راجع SECURITY-REVIEW.md)
- **Testing:** Jest + Supertest — **53 اختبار وحدة ناجح حالياً**
- **بلا** Redux، بلا Kubernetes، بلا أي خدمة SaaS مدفوعة

## 5. الأدوار الثمانية (Role enum)
`admin`, `receptionist`, `doctor`, `nurse`, `manager`, `pharmacist`, `lab_tech`, `billing_clerk` — كل دور جديد أُضيف بتوسعة enum آمنة (Expand)، راجع Decisions 014/016/018.

## 6. Database (ملخص — DATABASE.md + ERD.mmd + database/schema.prisma هو مصدر الحقيقة الفعلي)
**قواعد صارمة:**
- لا تحذف عموداً مباشرة — اتبع Expand→Migrate→Contract (طُبِّق 3 مرات فعلياً: Pharmacy, Lab, Billing).
- كل Migration عبر `prisma migrate dev` ثم مراجعة قبل `deploy`.
- `Encounter` (السجل الطبي) لا يُحذف نهائياً أبداً — Soft Delete فقط.
- **⚠️ لم تُختبَر أي Migration فعلياً على قاعدة بيانات حقيقية بعد** (قيد بيئة التطوير الحالية) — أول أمر ينفَّذه أي Agent جديد على خادم فعلي.

## 7. API (ملخص — API.md + openapi.yaml)
REST تحت `/api/v1`. كل Endpoint محمي بـ JWT + RBAC Guard (Fail-Closed — يرفض افتراضياً بلا `@Roles`). صيغة خطأ موحدة إلزامية `{error: {code, message, details}}`.
**⚠️ `openapi.yaml` قديم (يعكس Slice 1 فقط)** — لا تعتمد عليه كمرجع كامل، راجع `API.md` النصي المحدَّث بدلاً منه، وحدِّث `openapi.yaml` عند أي عمل مستقبلي على تلك الوحدات.

## 8. Project Structure
```
src/
  modules/
    auth/ users/ patients/ encounters/ appointments/
    departments/ admissions/ pharmacy/ lab/ billing/
    audit/  ← Cross-cutting، يُستدعى تلقائياً عبر AuditInterceptor
  common/     ← Guards, Decorators, Filters, Interceptors مشتركة
  prisma/     ← Prisma service
frontend/
  src/
    pages/ (11 شاشة) components/ hooks/ i18n/  ← لا نص Hardcoded بالكود أبداً
```

## 9. Coding Rules
- TypeScript Strict Mode — لا `any` أبداً (استثناء ضيق موثَّق واحد فقط: `frontend/src/theme/direction.ts` لحدود مكتبة `stylis` غير المكتوبة بـTS).
- كل Endpoint له DTO + Validation (class-validator) — لا يُقبل Input بلا تحقق.
- Business Logic في Services فقط — لا منطق أعمال داخل Controllers.
- كل نص واجهة عبر مفتاح i18next — ممنوع نص عربي/إنجليزي مباشر بالكود.
- العمليات الحساسة (خصم مخزون، تسكين سرير، تسجيل دفعة) دائماً ضمن `prisma.$transaction`.

## 10. Testing Rules
- كل Endpoint جديد: Unit Test للـ Service إلزامي. Integration Test (Supertest) **موصى به بقوة لكن غير مطبَّق حالياً إلا لوحدة Patients فقط** — فجوة معروفة موثَّقة بـ`PROJECT-AUDIT.md`، يُفضَّل سدّها تدريجياً.
- اختبر دائماً: Happy Path + Unauthorized (403) + Not Found (404) + Conflict (409 عند التعارض).

## 11. Security Rules
- لا Secrets في الكود إطلاقاً.
- كل عملية Create/Update/Delete حساسة تمر عبر `@Audit()` Decorator تلقائياً.
- كلمات المرور: bcrypt فقط (salt rounds 12).
- **قرار مفتوح غير محسوم:** فشل صامت لكتابة Audit Log (راجع `docs/security/SECURITY-REVIEW.md` Finding #4) — لا تعتبره محسوماً حتى تجد تحديثاً صريحاً بـ`DECISIONS.md`.
- قبل اعتبار أي Feature متعلقة ببيانات مريض مكتملة: طبّق `.claude/skills/security-review/SKILL.md`.

## 12. Git Rules
- Commits بصيغة Conventional Commits.
- لا Push مباشر على `main`.
- لا ترفع أبداً: `.env`, `.claude/settings.local.json`, بيانات مريض حقيقية.

## 13. Documentation Rules
أي تغيير في Architecture/Database/API/Tech Stack يجب أن يُحدَّث فوراً في الوثيقة المصدر + `DECISIONS.md`. **هذا الملف نفسه يجب تحديثه عند أي وحدة جديدة** — كان قد تأخّر تحديثه 3 Slices كاملة (Pharmacy/Lab/Billing) قبل هذا التحديث، تجنَّب تكرار ذلك.

## 14. Commands
```
build: npm run build
test:  npm run test        # 53 اختباراً يجب أن تنجح
lint:  npm run lint
dev:   npm run start:dev
migrate: npx prisma migrate dev
seed: npx prisma db seed
```

## 15. Forbidden Practices
- `any` في TypeScript (إلا الاستثناء الموثَّق أعلاه).
- Hard Delete على بيانات طبية.
- نص Hardcoded بدل i18next.
- إضافة Redis/Queue/Microservices بدون توثيق مبرَّر بـ`DECISIONS.md`.
- تجاوز RBAC Guard "مؤقتاً".
- `console.log` بالإنتاج.

## 16. Definition of Done
Code + TypeScript سليم + Unit Tests ناجحة + Audit Logging مفعَّل + i18n مطبَّق + Security Review + Documentation محدَّثة (**بما فيها هذا الملف وAGENTS.md**) + Code Review + Commit صحيح.

---
**قبل أي عمل تطوير جديد: اقرأ `PROJECT-AUDIT.md` أولاً** — يحتوي فجوات حقيقية معروفة (Migration غير مُختبَرة فعلياً، Integration Tests ناقصة، README/CLAUDE.md كانا قديمين) يجب أخذها بالحسبان.

