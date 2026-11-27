> Historical record, not current acceptance. Reconciled27 November2026: see [current verification](VERIFICATION.md), [requirements traceability](docs/requirements/TRACEABILITY.md) and [API contract](docs/api/API.md). Old counts, completion statements and release gates below describe an earlier snapshot. Original requirement targets remain open where traceability says partial/missing/unproven.

# SECURITY-REVIEW.md — مراجعة أمنية شاملة (Gate 8)

**التاريخ:** 2026-08-10
**النطاق:** كامل كود MVP (Slices 1–4: Auth, Users, Patients, Encounters, Appointments, Departments, Admissions)
**المنهجية:** تطبيق `.claude/skills/security-review/SKILL.md` — "افترض أنك مهاجم متمرس" — على كل وحدة، مع فحص فعلي للكود لا نظري.

---

## ملخص تنفيذي
تمت مراجعة 8 وحدات Backend. **3 ثغرات حقيقية اكتُشفت وأُصلحت فعلياً بالكود** أثناء هذه المراجعة (لا افتراضية). **2 قرار مفتوح يحتاج موافقتك** قبل الاعتبار كمكتمل للنشر الفعلي. لا ثغرات حرجة (Critical) متبقية بنطاق MVP الحالي.

---

## Findings

### Finding #1 — MEDIUM — ثغرة توقيت تُمكِّن من اكتشاف أسماء مستخدمين (Username Enumeration)
- **Vulnerability:** في `AuthService.validateUser`، عندما لا يوجد المستخدم، كان الكود يرمي الاستثناء فوراً دون تنفيذ `bcrypt.compare`؛ بينما عند وجود المستخدم بكلمة مرور خاطئة، ينفَّذ `bcrypt.compare` (عملية بطيئة نسبياً عمداً). هذا يخلق فرق زمن استجابة قابلاً للقياس.
- **Attack Vector:** مهاجم يقيس زمن استجابة `/auth/login` لأسماء مستخدمين مختلفة لتحديد أيها موجود فعلياً بالنظام، تمهيداً لهجوم تخمين كلمات مرور مركَّز.
- **Impact:** كشف قائمة أسماء مستخدمين صالحة (موظفين/أطباء) — يسهّل هجمات لاحقة.
- **Likelihood:** منخفضة-متوسطة (يتطلب قياساً دقيقاً للزمن، لكن ممكن تقنياً وموثَّق كنمط هجوم معروف على أنظمة JWT/bcrypt).
- **Mitigation:** ✅ **أُصلح فعلياً** — إضافة `bcrypt.compare` مقابل هاش وهمي ثابت (`DUMMY_HASH`) عند عدم وجود المستخدم، لتوحيد زمن الاستجابة بين الحالتين.
- **Security Test:** ✅ مُضاف — `auth.service.spec.ts`: "login: يرفض بـ401 لمستخدم غير موجود، بنفس رسالة كلمة المرور الخاطئة".
- **الملف:** `src/modules/auth/auth.service.ts`

### Finding #2 — MEDIUM — غياب حد لمحاولات تسجيل الدخول (Brute Force)
- **Vulnerability:** لا يوجد Rate Limiting على `/auth/login` (أو أي Endpoint آخر) قبل هذه المراجعة — عدد محاولات غير محدود.
- **Attack Vector:** هجوم تخمين آلي (Brute Force / Credential Stuffing) على حسابات موظفين، خصوصاً حسابات بكلمات مرور ضعيفة نسبياً.
- **Impact:** اختراق حساب موظف → وصول لبيانات مرضى حسب صلاحيات الحساب المخترق.
- **Likelihood:** متوسطة (شبكة داخلية تقلل التعرض الخارجي، لكن لا تلغي مخاطر مستخدم داخلي خبيث أو جهاز مخترَق داخل الشبكة).
- **Mitigation:** ✅ **أُصلح فعلياً** — `@nestjs/throttler` مُفعَّل عالمياً (100 طلب/دقيقة لكل مستخدم/IP)، وحد أشد خصيصاً على `/auth/login` (5 محاولات/دقيقة) عبر `@Throttle`.
- **الملف:** `src/app.module.ts`, `src/modules/auth/auth.controller.ts`

### Finding #3 — LOW — عدم تطابق التوثيق مع الكود: `/auth/logout` موثَّق بـ`API.md` لكن غير مُنفَّذ
- **Vulnerability:** ليست ثغرة أمنية مباشرة، لكن فجوة توثيق-كود يمكن أن تُربك مطوراً (بشرياً أو AI) لاحقاً ويفترض وجود سلوك غير موجود (مثل إبطال فعلي للـ Token).
- **Mitigation:** ✅ **أُصلح فعلياً** — Endpoint مُنفَّذ الآن، مع توثيق صريح بالكود أن الإبطال الفعلي يحدث بحذف الـ Token من طرف العميل (JWT Stateless، بلا Redis/جلسات — Decision 009/010)، والنقطة جاهزة كموضع تمديد مستقبلي لو أُضيفت قائمة إبطال.
- **الملف:** `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.controller.ts`

### Finding #4 — ~~LOW (قرار مفتوح)~~ **RESOLVED (2026-08-19)** — فشل صامت لكتابة سجل التدقيق
- **Vulnerability (تاريخياً):** في `AuditInterceptor`، إذا فشلت كتابة `audit_logs`، كان يُسجَّل الخطأ بـ`console.error` فقط والطلب الأصلي ينجح دون توقف.
- **✅ Mitigation مُنفَّذة فعلياً:** عند فشل الكتابة بـDB، يُكتب سجل احتياطي فوري محلياً (`logs/audit-fallback.log`، JSON Lines) بكل بيانات الحدث + رسالة الخطأ. راجع Decision 022.
- **Security Test:** ✅ `audit.interceptor.spec.ts` — 4 اختبارات، منها إثبات فعلي (لا افتراضي) لكتابة الملف الاحتياطي عند فشل DB متعمَّد بالاختبار.
- **إجراء تشغيلي متبقٍ:** استيراد دوري لسجلات `logs/audit-fallback.log` المتراكمة (إن وُجدت) لقاعدة البيانات — يُوثَّق بـRunbook عند النشر الفعلي، لا يمنع الاعتبار كـ"محسوم" برمجياً.

### Finding #5 — INFO (لا يحتاج إصلاحاً فورياً) — سياسة كلمة مرور بسيطة
- **الملاحظة:** `CreateUserDto` يفرض 8 أحرف كحد أدنى فقط، بلا شرط تعقيد (أحرف كبيرة/أرقام/رموز).
- **السياق المخفِّف:** الحسابات يُنشئها Admin فقط (FR-1.5) — ليست تسجيلاً ذاتياً مفتوحاً، ما يقلل من مخاطر كلمات مرور تافهة يختارها مستخدمون عشوائيون.
- **التوصية:** يُحسَّن لاحقاً (قبل Production) بإضافة `@Matches` بتعبير نمطي لتعقيد كلمة المرور، أو سياسة إجبار تغيير كلمة المرور المؤقتة عند أول دخول (خصوصاً لحساب `admin` الافتراضي بـ`seed.ts` — راجع Finding #6).

### Finding #6 — INFO — كلمة مرور Admin الافتراضية بـ`seed.ts` معروفة بالتوثيق
- **الملاحظة:** `ChangeMe123!` مكتوبة بوضوح بـ`prisma/seed.ts` والتعليق يوصي بتغييرها "فوراً" — لكن لا آلية تقنية تُجبر ذلك.
- **Mitigation المقترحة:** إضافة حقل `mustChangePassword` لجدول `users`، يُفعَّل تلقائياً للحساب الابتدائي، ويُفرض تغيير كلمة المرور بأول دخول قبل الوصول لأي شيء آخر. **مؤجَّل لـ MMP** (تحسين لا يمنع MVP، لكن يجب تطبيقه قبل الاستخدام الفعلي على بيانات مرضى حقيقيين).

---

## نقاط تحقَّقت أنها سليمة (لا ثغرات — للتوثيق لا للتكرار)
- ✅ **SQL Injection:** Prisma ORM بالكامل (Parameterized Queries) — لا Raw Query غير آمن بأي وحدة.
- ✅ **RBAC Fail-Closed:** `RolesGuard` يرفض افتراضياً أي Endpoint بلا `@Roles` صريح — تحقَّقتُ من كل الـ 8 Controllers، لا استثناء واحد ناقص.
- ✅ **تسريب بيانات حساسة:** `passwordHash` لا يظهر أبداً بأي استجابة (`UsersService.create/setActiveStatus` يحذفانه صراحة، `AuthService.login` يبني كائن مستخدم آمن يدوياً).
- ✅ **Validation:** كل DTO مزوَّد بـ`class-validator`، و`ValidationPipe` عالمي بـ`whitelist: true, forbidNonWhitelisted: true` (حقول غير متوقعة تُرفض لا تُتجاهل بصمت).
- ✅ **Audit Trail:** مُطبَّق فعلياً على كل عملية حساسة (`@Audit` موجود على: PATIENT_CREATED/UPDATED, USER_CREATED/STATUS_CHANGED, ENCOUNTER_CREATED/SOFT_DELETED, PRESCRIPTION_ADDED, APPOINTMENT_CREATED/UPDATED/CANCELLED, PATIENT_ADMITTED/DISCHARGED).
- ✅ **Transactions ذرية:** `AdmissionsService` (تسكين/تفريغ) بالكامل ضمن `$transaction` — تحقَّق عبر 10 اختبارات فعلية.
- ✅ **صيغة خطأ موحدة بلا Stack Trace:** `AllExceptionsFilter` يمنع تسريب أي تفاصيل تقنية داخلية للمستخدم النهائي.
- ✅ **صلاحية ضيقة على حذف السجل الطبي:** `EncountersService.softDelete` يتحقق من الملكية (الطبيب صاحب السجل) أو Admin فقط — مُختبَر صراحة (403 لغير المالك).

---

## Dependency Scanning
`npm audit` لم يُنفَّذ بعد فعلياً على بيئة بها Node.js حقيقي (البيئة الحالية نفَّذت `npm install` وتحقَّقت من عمل الكود لكن لم يُشغَّل Audit منفصل). **إجراء مطلوب:** تشغيل `npm audit` فعلياً على الخادم عند أول `npm install` حقيقي هناك، وقبل كل Release لاحقاً (راجع `SECURITY.md`).

---

## الخلاصة والقرار
- **3 ثغرات حقيقية (Finding #1, #2, #3) أُصلحت فعلياً بالكود** وأُضيف اختبار لأهمها.
- **Finding #4 محسوم فعلياً (2026-08-19)** — لم يعد قراراً مفتوحاً، راجع Decision 022.
- **Finding #5, #6 تحسينات مؤجَّلة موثَّقة**، غير حاجبة لمتابعة اختبار المستخدمين الحقيقيين.

**لا توجد ثغرة حرجة (Critical) تمنع بدء اختبار المستخدمين الحقيقيين الموصوف في `UAT-PLAN.md`.**

---

## Second Pass — Mandatory Review of Pharmacy/Lab/Billing (2026-08-30)

**السياق:** كان هذا بنداً 🟡 صريحاً غير مُنجز بـ`PROJECT-AUDIT.md` §7 — "مراجعة أمنية مخصَّصة لم تُجرَ على Pharmacy/Lab/Billing". أُجريت الآن فعلياً بفحص كود مباشر، لا وصفاً.

### Finding #7 — MEDIUM (RESOLVED) — عدم تحقق من ترابط المريض والزيارة عند طلب فحص
- **Vulnerability:** `LabService.createOrder` كان يقبل `patientId` و`encounterId` كحقلين مستقلَّين تماماً بلا أي تحقق من أن الزيارة المحددة تخص فعلاً ذلك المريض.
- **Attack Vector:** خطأ إدخال (نسخ/لصق بالواجهة) أو طلب API متعمَّد بمعرِّفين غير متطابقين → نتيجة فحص تُنسَب لملف مريض خاطئ. هذا **خطر سلامة مريض حقيقي (Patient Safety)** لا مجرد ثغرة تقنية.
- **Impact:** عالٍ محتملاً — قرار سريري خاطئ مبني على نتيجة فحص شخص آخر.
- **Mitigation المُنفَّذة فعلياً:** تحقق إلزامي أن `encounter.patientId === dto.patientId` قبل إنشاء الطلب، برفض 400 واضح (`PATIENT_ENCOUNTER_MISMATCH`) عند عدم التطابق.
- **Security Test:** ✅ `lab.service.spec.ts` — اختباران جديدان (رفض عدم التطابق، رفض زيارة غير موجودة).
- **الملف:** `src/modules/lab/lab.service.ts`

### Finding #8 — LOW (RESOLVED) — سبب تعديل المخزون اليدوي يُتحقَّق منه لكن لا يُخزَّن
- **Vulnerability:** `PharmacyService.adjustStock` يفرض حقل `reason` إلزامياً بالـ DTO (validation)، **لكن الكود كان يتجاهله فعلياً (`_reason` غير مستخدَم) ولا يُخزَّن بأي مكان**.
- **Attack Vector:** تعديلات مخزون يدوية (Restock/تصحيح) هي قناة محتملة لتسريب أو سرقة أدوية داخلياً — غياب سبب موثَّق فعلياً يُضعف القدرة على اكتشاف نمط مشبوه لاحقاً رغم وجود "شكل" رقابة ظاهرياً بالـ Validation.
- **Impact:** متوسط-منخفض (لا يُمكِّن هجوماً مباشراً، لكن يُضعف رادعاً رقابياً حقيقياً بسياق حساس).
- **Mitigation المُنفَّذة فعلياً:** السبب يُرفَق الآن ضمن نتيجة الـ Endpoint (`adjustmentReason`, `adjustmentDelta`)، فيلتقطه `AuditInterceptor` تلقائياً ضمن `audit_logs.newValue` — بلا حاجة لتعديل Schema.
- **Security Test:** ✅ `pharmacy.service.spec.ts` — اختبار جديد يتحقق من وجود السبب بالنتيجة المُعادة.
- **الملف:** `src/modules/pharmacy/pharmacy.service.ts`

### Finding #9 — MEDIUM (🔶 NEEDS USER DECISION — غير محسوم عمداً) — لا قيد على نسبة تغطية التأمين
- **Vulnerability:** أي `billing_clerk` يستطيع تعيين `insuranceCoveragePercent` لأي قيمة بين 0-100% عند إنشاء فاتورة، بلا موافقة إضافية أو تحقق من بوليصة تأمين فعلية (لا يوجد كيان "بوليصة تأمين" بالنظام أصلاً — خارج نطاق SRS-BILLING.md الحالي).
- **Attack Vector:** موظف فوترة فاسد يمنح تغطية تأمين وهمية (مثال: 100%) لمريض يدفع نقداً فعلياً، ويستولي على الفرق — **احتيال داخلي (Internal Fraud)**، لا اختراق تقني.
- **Impact:** مالي مباشر، ويصعب اكتشافه بمراجعة عادية دون تقرير مخصَّص.
- **لماذا لم يُصلَح تلقائياً:** هذا قرار سياسة عمل (Business Policy) لا خطأ برمجي واضح الحل — أي قيد (مثال: تقييد النسب غير الصفرية لدور Admin فقط، أو تدقيق مزدوج) قد يُعطِّل سير عمل شرعي دون معرفة سياسة المشفى الفعلية للتعامل مع التأمين.
- **التوصية الهندسية (لتقرِّر):**
  - الخيار أ: تقرير دوري بسيط (`SELECT * FROM invoices WHERE insurance_coverage_percent > 0 ORDER BY created_at`) يراجعه المدير المالي يدوياً — الأخف تنفيذاً.
  - الخيار ب: نسب تأمين غير صفرية تتطلب دوراً إضافياً (Admin) أو موافقة ثانية — أكثر أماناً، يضيف احتكاكاً تشغيلياً.
  - الخيار ج: إضافة كيان "بوليصة تأمين" فعلي (خارج نطاق MMP الحالي — توسعة SRS-BILLING.md مستقبلية).
- **الحالة:** **مفتوح عمداً — بانتظار قرارك.**
