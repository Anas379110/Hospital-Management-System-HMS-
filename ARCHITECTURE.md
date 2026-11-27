> Historical project reference. Current release/evidence and explicit missing requirements are in [current verification](VERIFICATION.md) and [traceability](docs/requirements/TRACEABILITY.md). Historical counts, complete-module assertions, untested-migration/CI statements and source paths below must not override current code or evidence. Canonical active Prisma schema is backend/prisma/schema.prisma. Original target requirements are not weakened by this notice.

# ARCHITECTURE.md — نظام إدارة المشافي (HMS)

## 1. Architecture Overview
**النمط المعتمد:** Modular Monolith — تطبيق واحد قابل للنشر، مقسَّم داخلياً لوحدات (Modules) مستقلة منطقياً بحدود واضحة، تعمل ضمن عملية واحدة (Single Process) على خادم On-Premise متوسط الأداء.

**سبب الاختيار (مرجع Decision 001):** لا حاجة لتعقيد Microservices؛ الخادم متوسط الأداء يجعل تشغيل عدة خدمات منفصلة (وما يرافقها من Overhead شبكي وذاكرة لكل خدمة) قراراً غير كفوء. الوحدات مصمَّمة بحدود واضحة (Bounded Contexts) بحيث يمكن استخراج أي منها لاحقاً كخدمة مستقلة إذا فرض النمو الفعلي ذلك — دون إعادة كتابة المنطق من الصفر.

```
┌─────────────────────────────────────────────┐
│              Frontend (SPA — React)           │
│         عربي RTL / إنجليزي LTR — i18n         │
└───────────────────┬───────────────────────────┘
                     │ REST API (HTTPS داخل الشبكة الداخلية)
┌───────────────────▼───────────────────────────┐
│           Application Server (Monolith)        │
│  ┌───────────┬───────────┬──────────────────┐  │
│  │   Auth &   │  Patients  │   Appointments   │  │
│  │   RBAC     │   Module   │      Module      │  │
│  ├───────────┼───────────┼──────────────────┤  │
│  │    EMR     │Departments │   Audit Logging  │  │
│  │   Module   │ & Beds Mod │   (Cross-cutting)│  │
│  └───────────┴───────────┴──────────────────┘  │
│         Background Jobs (Backup, Cleanup)       │
└───────────────────┬───────────────────────────┘
                     │
┌───────────────────▼───────────────────────────┐
│              PostgreSQL (Single Instance)       │
│         + نسخ احتياطي محلي دوري (Cron)          │
└─────────────────────────────────────────────────┘
```

## 2. Components والمسؤوليات

| المكوّن | المسؤولية |
|---|---|
| **Auth & RBAC Module** | تسجيل الدخول، إصدار/التحقق من الجلسات، فرض الصلاحيات على كل Endpoint |
| **Patients Module** | إدارة بيانات المرضى، توليد MRN، البحث، منع التكرار |
| **Appointments Module** | حجز/تعديل/إلغاء المواعيد، منع التعارض الزمني |
| **EMR Module** | تسجيل الزيارات (Encounters)، التشخيصات، الوصفات، القراءة التاريخية |
| **Departments & Beds Module** | إدارة الأقسام والأسرّة، التسكين والتفريغ |
| **Audit Logging (Cross-cutting)** | تسجيل كل عملية حساسة عبر كل الوحدات (Interceptor/Middleware مشترك) |
| **Background Jobs** | نسخ احتياطي دوري، أرشفة سجلات قديمة، مهام صيانة مجدولة |
| **PostgreSQL** | التخزين الدائم الوحيد لكل البيانات — مصدر الحقيقة |

> ملاحظة: وحدات المستقبل (Pharmacy, Lab, Radiology, Billing) ستُضاف بنفس النمط (Module داخل نفس Monolith) عند الوصول لتلك المرحلة في `SDLC.md`.

## 3. Communication
- **Frontend ↔ Backend:** REST API عبر HTTPS ضمن الشبكة الداخلية للمشفى فقط (لا مسار افتراضي للإنترنت الخارجي في MVP).
- **بين الوحدات داخلياً:** استدعاءات مباشرة In-Process (Function/Service calls) — لا حاجة لـ Message Queue في هذا الحجم؛ يُعاد التقييم فقط عند استخراج وحدة كخدمة مستقلة مستقبلاً.
- **Audit Logging:** يُنفَّذ عبر Interceptor/Middleware مشترك يُطبَّق تلقائياً على كل عملية Create/Update/Delete حساسة، دون حاجة لكل وحدة لاستدعائه يدوياً (تقليل احتمال نسيانه).

## 4. Data Flow (مثال: تسكين مريض)
1. الواجهة ترسل طلب `POST /admissions` مع بيانات المريض والسرير.
2. Auth Middleware يتحقق من الجلسة والصلاحية (ممرض/طبيب مخوَّل فقط).
3. Departments & Beds Module يتحقق من أن السرير "متاح" ضمن معاملة قاعدة بيانات واحدة (Transaction) لمنع Race Condition عند طلبين متزامنين لنفس السرير.
4. عند النجاح: تحديث حالة السرير + إنشاء سجل Admission + كتابة Audit Log — كلها ضمن نفس Transaction (Atomicity كاملة، مهم جداً عند احتمال انقطاع كهرباء مفاجئ).
5. استجابة للواجهة بالتأكيد أو رسالة خطأ واضحة إن فشلت أي خطوة.

راجع `docs/architecture/data-flow.mmd` للتمثيل المرئي.

## 5. External Services
- **MVP:** لا خدمات خارجية إطلاقاً (بيئة On-Premise معزولة عن الإنترنت للوظائف الأساسية) — يتوافق مع Decision 003.
- **مستقبلي (MLP):** واجهة تكامل اختيارية مع نظام وزارة الصحة عبر HL7 FHIR (راجع Decision 006 و RESEARCH.md قرار 004) — ستُبنى كـ Module إضافي منفصل يمكن تفعيله/تعطيله دون التأثير على النظام الأساسي.

## 6. Authentication & Authorization
- **Authentication:** جلسات مبنية على Token (JWT قصير الأمد أو Session مخزَّنة في قاعدة البيانات — القرار التقني النهائي في `TECH-STACK.md`)، كلمات المرور مُشفَّرة (bcrypt/argon2)، بدون تخزين نص صريح مطلقاً.
- **Authorization:** RBAC صارم — كل Endpoint محمي بفحص دور المستخدم وصلاحياته، مُنفَّذ في طبقة Middleware مركزية (لا يعتمد على فحص متفرق داخل كل Controller).

## 7. Failure Points ومعالجتها

| نقطة الفشل | الاحتمال | المعالجة |
|---|---|---|
| انقطاع كهرباء مفاجئ | عالٍ (سياق سوري) | كل الكتابات ضمن Transactions ذرية؛ يُنصح بـ UPS للخادم كحد أدنى (يُوثَّق كتوصية في DEPLOYMENT.md) |
| عطل قرص التخزين | متوسط | نسخ احتياطي يومي على وسيط منفصل (قرص خارجي/خادم ثانٍ) |
| تعارض تسكين سرير متزامن | متوسط | قفل على مستوى Transaction (Row-level lock) عند التحقق من توفر السرير |
| تعطل التطبيق (Crash) | منخفض-متوسط | Process Manager (systemd/pm2) يعيد التشغيل تلقائياً |
| امتلاء القرص بسجلات/نسخ احتياطية | منخفض | مهمة أرشفة/تنظيف دورية (Background Job) + تنبيه عند تجاوز نسبة معينة |

## 8. Scalability
- المسار الأولي: Scale Vertically (رفع موارد الخادم نفسه) — كافٍ لسعة 10,000+ مريض في مرحلة MVP/MMP.
- المسار المستقبلي عند الحاجة الفعلية: استخراج وحدة مُحمَّلة بشدة (غالباً EMR أو Appointments) كخدمة مستقلة، دون تفكيك النظام بالكامل.
- **لا تُبنى Kubernetes/Load Balancers/Multi-instance الآن** — يخالف قاعدة "عدم الإفراط بالهندسة" ولا يناسب خادم متوسط الأداء واحد.

## 9. Caching
**قرار (Decision 009):** لا Redis أو أي طبقة Cache خارجية في MVP — التعقيد الإضافي واستهلاك الذاكرة على خادم متوسط الأداء غير مبرَّر بحجم البيانات الحالي. يُستخدم فقط Caching داخلي بسيط على مستوى التطبيق (In-memory) لقوائم شبه ثابتة (كالأقسام) إن لزم. يُعاد تقييم إضافة Redis عند رصد بطء فعلي موثَّق في مرحلة MMP/MLP.

## 10. Background Jobs
- **نسخ احتياطي يومي** لقاعدة البيانات (`pg_dump` مجدول) إلى وسيط تخزين منفصل محلياً.
- **أرشفة/تنظيف** السجلات القديمة جداً من Audit Log (بعد فترة احتفاظ تُحدَّد قانونياً حسب قانون سوريا 12/2024).
- تُنفَّذ عبر مجدول مهام داخل نفس التطبيق (Cron-like scheduler) — لا حاجة لخدمة Queue منفصلة بهذا الحجم.

## 11. Logging & Monitoring
- **Logging:** سجلات تطبيق منظَّمة (Structured Logs) بمستويات (INFO/WARN/ERROR) تُكتب محلياً مع تدوير ملفات (Log Rotation) لتفادي امتلاء القرص.
- **Audit Logging:** منفصل تماماً عن سجلات التطبيق التقنية — جدول DB مخصَّص (`audit_logs`) غير قابل للحذف من الواجهة، لأغراض قانونية وتدقيقية.
- **Monitoring:** بيئة On-Premice بدون إنترنت تستبعد أدوات SaaS (Datadog/Sentry) في MVP. الحل: نقطة فحص صحة (`GET /health`) + مراجعة سجلات محلية دورية يدوياً أو بأداة مفتوحة المصدر خفيفة تُثبَّت محلياً لاحقاً إن استدعت الحاجة (مثل Grafana+Prometheus محلياً — يُقيَّم في مرحلة النشر لا الآن).

---
**Status:** CONFIRMED — Gate 4 مكتمل، مبني على قرارات Gate 1-3.
