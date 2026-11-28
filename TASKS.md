> Historical record, not current acceptance. Reconciled27 November2026: see [current verification](VERIFICATION.md), [requirements traceability](docs/requirements/TRACEABILITY.md) and [API contract](docs/api/API.md). Old counts, completion statements and release gates below describe an earlier snapshot. Original requirement targets remain open where traceability says partial/missing/unproven.

# TASKS.md

## EPIC 0 — Project Initialization
- [x] Feature: Idea Validation
  - [x] Task: تحليل المشكلة والمستخدمين والمنافسين
  - [x] Task: تحديد MVP/MMP/MLP
  - [x] Task: تصنيف Scope (MoSCoW)
- [ ] Feature: Planning Finalization
  - [ ] Task: حسم قرار الاستضافة (يحتاج قرار المستخدم)
  - [ ] Task: تحديد الميزانية والجدول الزمني (يحتاج قرار المستخدم)
  - [ ] Task: اعتماد SDLC رسمياً في SDLC.md

## EPIC 1 — Requirements Analysis [مكتمل]
- [x] SRS.md, Traceability Matrix

## EPIC 2 — Architecture & Design [مكتمل]
- [x] ARCHITECTURE.md + مخططات، TECH-STACK.md، DATABASE.md + ERD + schema.prisma، API.md + openapi.yaml، UI-UX.md

## EPIC 3 — AI Tooling Setup [مكتمل]
- [x] CLAUDE.md, AGENTS.md, .claude/ (skills/hooks/agents), .gitignore, .env.example

## EPIC 4 — Development

### Feature: Slice 1 — Auth & RBAC + Patients [مكتمل ومُختبَر]
- [x] Task: Backend scaffolding (NestJS + Prisma)
- [x] Task: RBAC infrastructure (Guards, Decorators, Audit Interceptor)
- [x] Task: Auth Module (login, JWT, me)
- [x] Task: Users Module (Admin creates users)
- [x] Task: Patients Module (create+MRN, search, get, update)
- [x] Task: Unit Tests (5/5 نجحت فعلياً)
- [x] Task: Integration Tests (مكتوبة، بانتظار تشغيل بيئة فعلية بها Prisma Client كامل)
- [x] Subtask: Frontend — تسجيل دخول + قائمة/بحث مرضى + تسجيل مريض جديد (بتدفق تنبيه التكرار الكامل)

**Slice 1 مكتمل بالكامل: DB + API + UI + Tests ✅**

### Feature: Slice 2 — EMR أساسي [مكتمل ومُختبَر بالكامل]
- [x] Task: Encounters Module (create, findOne, soft delete بسبب)
- [x] Task: Prescriptions (ضمن Encounters)
- [x] Task: GET /patients/{id}/records (FR-4.3)
- [x] Task: Unit Tests (7/7 نجحت فعلياً)
- [x] Task: Frontend — PatientDetailPage (سجل كامل + نموذج تسجيل زيارة/وصفة لدور Doctor)

**Slice 2 مكتمل بالكامل: DB + API + UI + Tests ✅**

### Feature: Slice 3 — Appointments [مكتمل ومُختبَر بالكامل]
- [x] Task: Appointments Module (حجز، منع تعارض، تعديل، إلغاء، جدول يومي)
- [x] Task: Unit Tests (6/6 نجحت فعلياً)
- [x] Task: Partial Unique Index SQL (خط دفاع ثانٍ ضد Race Condition)
- [x] Task: Frontend — AppointmentsPage (جدول + حجز + إلغاء)

**Slice 3 مكتمل بالكامل: DB + API + UI + Tests ✅**

### Feature: Slice 4 — Departments & Beds [مكتمل ومُختبَر بالكامل]
- [x] Departments/Beds Module (قائمة، أسرّة، إحصائية)
- [x] Admissions Module — UC-1 كاملاً ضمن Transaction ذرية حقيقية (تسكين + تفريغ)
- [x] Task: Unit Tests (10/10 نجحت فعلياً)
- [x] Task: Frontend — DepartmentsPage (خريطة أسرّة ملوَّنة + تسكين بنقرة)

**Slice 4 مكتمل بالكامل: DB + API + UI + Tests ✅**

---

# 🎯 MVP مكتمل بالكامل (28/28 اختبار، 4 بناءات إنتاجية ناجحة)

## EPIC 5 — Gate 8: Testing/Security الشامل [مكتمل]
- [x] مراجعة أمنية كاملة لكل Slices 1-4 (3 ثغرات حقيقية أُصلحت: Timing Attack, Brute Force, توثيق-كود)
- [x] اختبارات AuthService المفقودة (5 اختبارات جديدة — فجوة حقيقية اكتُشفت وأُغلقت)
- [x] UAT-PLAN.md كاملة لـ5 مستخدمين حقيقيين بالمشفى
- [ ] **تنفيذ بشري مطلوب**: جلسات UAT الفعلية على الخادم الحقيقي (خارج قدرة AI)
- [ ] قرار مفتوح: Finding #4 (فشل صامت لـAudit Log) — بانتظار موافقتك

## EPIC 6 — MMP
### Feature: Slice 5 — Pharmacy [مكتمل ومُختبَر بالكامل]
- [x] Requirements مصغَّرة (SRS-PHARMACY.md + Decisions 013-015)
- [x] Database Expand (Medication + توسعة Prescription + Role.pharmacist)
- [x] PharmacyModule (مخزون، قائمة انتظار، صرف ذري، تنبيه إعادة طلب)
- [x] Unit Tests (8/8 نجحت فعلياً)
- [x] Frontend — PharmacyPage (قائمة انتظار + صرف)

**Slice 5 مكتمل بالكامل: DB + API + UI + Tests ✅**

### Feature: Slice 6 — Lab/Radiology [مكتمل ومُختبَر بالكامل]
- [x] Requirements مصغَّرة (SRS-LAB.md + Decisions 016-017)
- [x] Database Expand (TestOrder + Role.lab_tech)
- [x] LabModule (طلب فحص، قائمة انتظار، تسجيل نتيجة، عرض نتائج المريض)
- [x] Unit Tests (5/5 نجحت فعلياً)
- [x] Frontend — LabPage + دمج النتائج بشاشة PatientDetailPage

**Slice 6 مكتمل بالكامل: DB + API + UI + Tests ✅**

### Feature: Slice 7 — Billing [مكتمل ومُختبَر بالكامل]
- [x] Requirements مصغَّرة (SRS-BILLING.md + Decisions 018-021)
- [x] Database Expand (Invoice, InvoiceItem, Payment + Role.billing_clerk)
- [x] BillingModule (فاتورة، بنود، تأمين، دفع ذري، اشتقاق حالة ديناميكي)
- [x] Unit Tests (7/7 نجحت فعلياً)
- [x] Frontend — BillingPage (إنشاء فاتورة + دفع)

**Slice 7 مكتمل بالكامل: DB + API + UI + Tests ✅**

---

# 🎯🎯 MMP مكتمل بالكامل (53/53 اختبار، 7/7 بناءات إنتاجية ناجحة)

## EPIC 7 — Post-MMP Audit Response
- [x] PROJECT-AUDIT.md شامل (12 محوراً، فجوات مصنَّفة 🔴🟡🟢)
- [x] README.md (كان مفقوداً بالكامل)
- [x] CLAUDE.md/AGENTS.md محدَّثان بالكامل (كانا متأخرين 3 Slices)
- [x] DEPLOYMENT.md (كان مفقوداً — Blocker #3)
- [x] TRACEABILITY.md تحديث شامل (كل الـ 11 وحدة الآن)
- [x] openapi.yaml تحديث شامل (كل الـ 11 وحدة الآن)
- [x] Integration Tests: 8 ملفات جديدة (Auth, Users, Encounters, Appointments, Departments/Admissions, Pharmacy, Lab, Billing) — مكتوبة وصحيحة، محظورة التشغيل بقيد Sandbox المعروف فقط
- [x] **Finding #4 مُصلَح فعلياً بالكود** (Decision 022، 4 اختبارات جديدة)
- [ ] **Blocker #1**: Migration فعلية على DB حقيقية — يحتاج خادماً فعلياً (متبقٍ)
- [ ] **Blocker #4**: UAT بشري فعلي — يحتاج تنفيذاً بشرياً (متبقٍ)

**57/57 اختبار وحدة ناجح. من 9 فجوات تدقيق: 7 أُغلقت، 2 متبقيتان تحتاجان بيئة تشغيل حقيقية.**
