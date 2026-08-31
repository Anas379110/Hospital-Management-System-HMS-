# AGENTS.md — نظام إدارة المشافي (HMS)

## Project Overview
نظام إدارة مشفى كبير (10,000+ مريض)، On-Premise بالكامل، عربي/إنجليزي RTL/LTR، بيانات صحية حساسة تخضع لقانون سوريا رقم 12/2024 لحماية البيانات الشخصية الإلكترونية.
**الحالة الحالية:** MVP + MMP مكتملان وظيفياً (11 وحدة، 53 اختبار وحدة ناجح) — Post-MMP، Gate 9 (Deployment) قيد التحضير. **اقرأ `PROJECT-AUDIT.md` أولاً قبل أي عمل جديد** — يحتوي فجوات حقيقية معروفة (Migration لم تُختبَر فعلياً على DB حقيقية، Integration Tests ناقصة لـ10 من 11 وحدة).

## Architecture
Modular Monolith — **11 وحدة كاملة**: Auth&RBAC, Users, Patients, Encounters (EMR), Appointments, Departments&Beds, Admissions, Pharmacy, Lab, Billing, Audit (Cross-cutting). التفاصيل الكاملة: `ARCHITECTURE.md`. نمط Expand-Only اتُّبع 3 مرات فعلياً عند توسعة MMP (Pharmacy/Lab/Billing) — طبِّق نفس النمط لأي توسعة مستقبلية، لا Contract بلا مبرر قوي موثَّق.

## Tech Stack
Node.js + NestJS (TypeScript) + Prisma + PostgreSQL (14 موديلاً) | React + TypeScript + MUI + React Query + react-i18next (Frontend، 11 شاشة) | Jest + Supertest (53 اختبار وحدة ناجح، Integration محدود). التفاصيل: `TECH-STACK.md`.

## الأدوار الثمانية
`admin`, `receptionist`, `doctor`, `nurse`, `manager`, `pharmacist`, `lab_tech`, `billing_clerk`.

## Directory Structure
```
src/modules/{auth,users,patients,encounters,appointments,departments,admissions,pharmacy,lab,billing,audit}/
src/common/{guards,decorators,filters,interceptors}/
src/prisma/
frontend/src/{pages(11),components,hooks,i18n}/
database/schema.prisma  ← مصدر الحقيقة لبنية DB (لم تُختبَر Migration فعلياً بعد — راجع PROJECT-AUDIT.md)
```

## Commands
```
build: npm run build
test:  npm run test        # 53 اختباراً يجب أن تنجح جميعها
lint:  npm run lint
dev:   npm run start:dev
migrate: npx prisma migrate dev
seed: npx prisma db seed
```

## Database Rules
- `database/schema.prisma` هو مصدر الحقيقة — أي تغيير Schema يمر عبره فقط.
- ممنوع حذف عمود مباشرة على Production: اتبع Expand→Migrate→Contract (طُبِّق فعلياً 3 مرات، راجع الأمثلة بـ`DECISIONS.md` 013-021).
- `Encounter` (السجل الطبي): Soft Delete فقط، أبداً Hard Delete.
- **⚠️ Migration لم تُختبَر فعلياً على DB حقيقية طوال المشروع** — أول أمر ينفَّذه أي Agent على خادم فعلي، بلا افتراض أنها ستنجح تلقائياً بلا مراجعة.
- راجع `docs/database/DATABASE.md` قبل أي تعديل بنيوي.

## API Rules
- REST تحت `/api/v1`، JWT + RBAC Guard (Fail-Closed) على كل Endpoint محمي.
- صيغة خطأ موحدة: `{error: {code, message, details}}`.
- راجع `docs/api/API.md` (محدَّث نصياً) قبل إضافة Endpoint جديد. **`openapi.yaml` قديم (Slice 1 فقط)** — لا تعتمد عليه وحده.

## Coding Rules
- TypeScript Strict — لا `any` (استثناء موثَّق واحد فقط بالواجهة لمكتبة `stylis` غير المكتوبة بـTS).
- DTO + class-validator لكل Input.
- منطق الأعمال في Services، لا في Controllers.
- كل نص واجهة عبر i18next.
- العمليات الحساسة (خصم مخزون، تسكين سرير، دفعة فاتورة) ضمن `prisma.$transaction` دائماً.

## Testing
لكل Endpoint جديد: Unit Test إلزامي (Service). Integration Test (Supertest) **موصى به بقوة، مطبَّق حالياً على Patients فقط من أصل 11 وحدة** — فجوة معروفة، يُفضَّل سدّها تدريجياً بدل تركها. غطِّ دائماً: Happy Path, 401/403, 404, 409.

## Security
لا Secrets بالكود. bcrypt لكلمات المرور. Audit Interceptor تلقائي لكل عملية `@Audit()`. **قرار مفتوح غير محسوم:** فشل صامت لكتابة Audit Log (`docs/security/SECURITY-REVIEW.md` Finding #4) — لا تفترض أنه محسوم دون تحديث صريح بـ`DECISIONS.md`. قبل إكمال أي Feature ببيانات مريض: طبّق مراجعة أمنية بأسلوب "افترض أنك مهاجم".

## Git
Conventional Commits. لا Push مباشر على `main`. لا رفع `.env` أو بيانات مريض حقيقية.

## Documentation
أي تغيير Architecture/Database/API/Tech Stack → تحديث فوري للوثيقة المصدر + `DECISIONS.md`. **حدِّث هذا الملف وCLAUDE.md عند أي وحدة جديدة** — كلاهما تأخّر تحديثهما 3 Slices كاملة قبل هذا التحديث، لا تكرر ذلك.

## Definition of Done
Code + TypeScript سليم + Unit Tests ناجحة + Audit Logging + i18n + Security Review + Docs محدَّثة (بما فيها هذا الملف) + Code Review + Commit صحيح.

## Forbidden Actions
`any` في TypeScript (إلا الاستثناء الموثَّق)، Hard Delete لبيانات طبية، نص Hardcoded بدل i18next، إضافة Redis/Queue/Microservices بلا توثيق بـ`DECISIONS.md`، تجاوز RBAC Guard مؤقتاً، `console.log` بالإنتاج.

## Shared Source of Truth
هذا الملف يعمل جنباً إلى جنب مع `CLAUDE.md` على نفس Repository — كلاهما يتبعان نفس: `PROJECT.md`, `SRS.md` (+ملحقات PHARMACY/LAB/BILLING), `ARCHITECTURE.md`, `DECISIONS.md`, `DATABASE.md`. **اقرأ `PROJECT-AUDIT.md` قبل البدء بأي عمل جديد** — يحتوي كل الفجوات الحقيقية المعروفة حالياً.
