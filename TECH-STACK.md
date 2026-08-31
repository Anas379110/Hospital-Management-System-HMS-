# TECH-STACK.md — نظام إدارة المشافي (HMS)

جميع الاختيارات: **مفتوحة المصدر بالكامل** (Decision 004) ومناسبة لخادم On-Premise متوسط الأداء (Decision 005)، ولا تتطلب أي خدمة SaaS مدفوعة أو اتصال إنترنت إلزامي.

## Backend

| العنصر | الاختيار | السبب | البدائل المرفوضة |
|---|---|---|---|
| **اللغة/الإطار** | **Node.js + NestJS (TypeScript)** | خبرة الفريق موجودة فعلياً (معيار حاسم بحسب دليل اللغات — خبرة الفريق أهم من "الأحدث")؛ بنية Modular منظمة تدعم Modular Monolith مباشرة (كل Module في NestJS = حد وحدة معماري طبيعي)؛ TypeScript يمنح Type Safety يقلل أخطاء بيانات صحية حساسة | Django (Python): رُفض رغم قوته لأن الفريق لا يملك خبرة به؛ Laravel: نفس السبب |
| **ORM** | **Prisma** | Migrations آمنة ومقروءة، Type Safety كامل مع TypeScript، أداء جيد لحجم بياناتنا | TypeORM: أقل نضجاً في إدارة Migrations وType Inference مقارنة بـPrisma حالياً |
| **Validation** | class-validator + class-transformer (متكامل مع NestJS DTOs) | يمنع أي بيانات غير صالحة من الوصول لطبقة العمل، متطلب أمني أساسي (FR ونطاق Security) | — |
| **Auth** | Passport.js (JWT Strategy) + bcrypt لتشفير كلمات المرور | معيار صناعي ناضج، يتكامل مباشرة مع NestJS Guards لتطبيق RBAC مركزياً (ARCHITECTURE.md §6) | argon2: بديل مقبول أيضاً، bcrypt أُبقي عليه لنضجه الأوسع ودعمه الأطول |
| **RBAC** | Guards + Decorators مخصصة في NestJS، أدوار Enum ثابتة (Admin, Receptionist, Doctor, Nurse, Manager) بدل جدول صلاحيات ديناميكي | يكفي تماماً لنطاق MVP (5 أدوار محددة)؛ جدول صلاحيات ديناميكي تعقيد غير مبرَّر الآن (Decision 011) | جدول Permissions ديناميكي كامل: مؤجَّل لمرحلة لاحقة إن احتاج المشفى أدواراً مخصصة |
| **Background Jobs** | `@nestjs/schedule` (In-process Cron) | يتوافق مع Decision 010 (بلا Queue خارجية) | Bull/BullMQ (يحتاج Redis): مؤجَّل |
| **Logging** | NestJS Logger + Winston (Daily Rotate File) | سجلات محلية منظمة مع تدوير تلقائي يمنع امتلاء القرص | — |
| **Testing** | Jest (Unit + Integration)، Supertest (API Integration) | معيار NestJS الافتراضي، تكامل ممتاز | — |
| **Process Manager** | PM2 (أو systemd كبديل عند النشر) | إعادة تشغيل تلقائي عند تعطل التطبيق (يخدم ARCHITECTURE.md §7) | — |

## Frontend

| العنصر | الاختيار | السبب |
|---|---|---|
| **Framework** | React + TypeScript | خبرة الفريق + أكبر نظام بيئي (معيار من دليل اللغات) |
| **UI Kit** | MUI (Material UI) — يدعم RTL/LTR built-in رسمياً | يوفر وقتاً كبيراً على دعم RTL الكامل بدل بنائه يدوياً؛ متوافق مع WCAG AA بشكل جيد افتراضياً |
| **State Management** | React Query (Server State) + Context API (UI State بسيط) | لا حاجة لـ Redux بهذا الحجم من التطبيق — تعقيد غير مبرَّر (Decision 012) |
| **Forms/Validation** | React Hook Form + Zod | تكامل ممتاز، رسائل خطأ واضحة بالعربية للمستخدم (متطلب NFR — رسائل بشرية لا Stack Trace) |
| **i18n** | react-i18next | فصل كامل للنصوص عن الكود من اليوم الأول (Decision 007) |
| **HTTP Client** | Axios (عبر React Query) | معيار ناضج |

## Database & Infrastructure

| العنصر | الاختيار | السبب |
|---|---|---|
| **Database** | PostgreSQL (أحدث نسخة مستقرة LTS) | Decision 002 |
| **Backup** | `pg_dump` مجدول (Background Job) + نسخ يدوي دوري لوسيط خارجي | Decision On-Premise + متطلب RPO/RTO لاحق في DEPLOYMENT.md |
| **API Docs** | OpenAPI 3.0 (مولَّد جزئياً عبر `@nestjs/swagger`) | معيار موصى به في الدليل الأساسي |
| **Hosting** | On-Premise — خادم Linux (Ubuntu Server LTS مقترح) | Decision 003 |
| **Reverse Proxy** | Nginx | TLS termination داخلي، Serve للـ Frontend المبني، توجيه لـ API |

## القرارات الجديدة المرتبطة

**Decision 011 — RBAC بأدوار ثابتة (Enum) بدل جدول صلاحيات ديناميكي:** يكفي لـ5 أدوار معروفة في MVP؛ يُعاد التقييم فقط لو احتاج المشفى فعلياً أدواراً مخصصة متعددة (لا يوجد مؤشر على ذلك حالياً). Status: CONFIRMED

**Decision 012 — بلا Redux:** React Query يغطي حالة الخادم (وهي الغالبية العظمى من حالة التطبيق في نظام كهذا)؛ Context كافٍ لحالة الواجهة البسيطة (اللغة، المستخدم الحالي). Status: CONFIRMED

## جدول التراخيص (فحص سريع)
جميع المكتبات المذكورة أعلاه مرخّصة MIT أو Apache 2.0 أو BSD — متوافقة تماماً مع Decision 004 (بلا تكلفة ترخيص). **يجب فحص ترخيص كل مكتبة فعلياً عند إضافتها لـ package.json أثناء التطوير الفعلي** — هذا الجدول مرجعي أولي لا نهائي قانونياً.
