# DECISIONS.md

## Decision 001 — نوع المعمارية الابتدائية
**Context:** نطاق MVP محدود نسبياً رغم أن المشفى كبير الحجم.
**Options:** Microservices / Modular Monolith / Layered Monolith بسيط
**Decision Made:** Modular Monolith
**Reason:** لا يوجد مبرر حالياً لتعقيد Microservices؛ Modular Monolith يوفر فصل مسؤوليات واضح (Patients, Appointments, EMR, Pharmacy...) مع سهولة نشر وصيانة أعلى في بيئة بنية تحتية محلية غير مستقرة.
**Consequences:** يمكن استخراج وحدات كـ Microservices مستقلة لاحقاً إذا فرض الحمل الفعلي ذلك.
**Status:** CONFIRMED

## Decision 002 — قاعدة البيانات
**Context:** بيانات علائقية معقدة (مريض↔موعد↔سجل طبي↔فاتورة) وحاجة ACID صارمة.
**Options:** PostgreSQL / MySQL / MongoDB
**Decision Made:** PostgreSQL
**Reason:** أفضل دعم للعلاقات المعقدة والقيود (Constraints) والمعاملات، ونضج بيئي قوي لأنظمة السجلات الصحية.
**Status:** CONFIRMED (مبدئياً — يُفصّل في TECH-STACK.md)

## Decision 003 — الاستضافة
**Context:** حساسية البيانات + تذبذب الإنترنت في سوريا.
**Options:** On-Premise / Cloud إقليمي / Hybrid
**Decision Made:** **On-Premise كامل داخل المشفى**
**Reason:** قرار صاحب المشروع، ويتوافق مع مخاطر الاتصال بالإنترنت وحساسية البيانات الصحية والقانون السوري لحماية البيانات (تقليل نقل البيانات خارج الجهة المسؤولة).
**Consequences:**
- يجب أن يعمل النظام بالكامل على شبكة داخلية (Intranet) بدون اعتماد على إنترنت خارجي للوظائف الأساسية.
- نحتاج خطة نسخ احتياطي محلية صارمة (خادم احتياطي أو تخزين خارجي دوري) لأن لا يوجد Cloud Backup تلقائي.
- يتطلب تحديد مواصفات خادم فعلي (Server Specs) لاحقاً في `DEPLOYMENT.md`.
**Status:** CONFIRMED

## Decision 004 — الميزانية والتقنيات مفتوحة المصدر
**Context:** لا توجد ميزانية حالياً.
**Decision Made:** الاعتماد الكامل على تقنيات **مفتوحة المصدر ومجانية الترخيص** (PostgreSQL, Node.js/NestJS أو Django, React) بدون أي خدمات SaaS مدفوعة أو تراخيص تجارية.
**Reason:** يضمن قابلية التنفيذ دون تكلفة مالية مباشرة، وينسجم مع قرار On-Premise.
**Consequences:** استبعاد أي أداة Cloud مدارة مدفوعة (مثل Firebase/Supabase المدفوع، AWS المدارة)، ويجب تحديد التراخيص (MIT/Apache 2.0) بدقة لكل مكتبة تُستخدم لاحقاً.
**Status:** CONFIRMED

## Decision 005 — الجدول الزمني
**Decision Made:** غير مقيّد بموعد ثابت — أولوية الجودة والاكتمال على السرعة. يمكن مراجعة هذا القرار لاحقاً إن ظهر موعد فعلي مطلوب من إدارة المشفى.
**Status:** CONFIRMED (كافتراض عمل مرن)

## Decision 006 — التكامل الخارجي المستقبلي (HL7 FHIR)
**Context:** صاحب المشروع أكد وجود التزام مستقبلي بالتكامل الخارجي (مع جهات مثل وزارة الصحة أو التأمين أو مختبرات مرجعية).
**Decision Made:** تصميم نموذج البيانات (Database Schema) وطبقة الـ API منذ MVP بحيث تكون **متوافقة بنيوياً مع موارد HL7 FHIR الأساسية** (Patient, Encounter, Observation, MedicationRequest...) حتى لو لم يُبنى API بروتوكول FHIR كامل إلا في مرحلة MMP/MLP.
**Reason:** تجنّب إعادة هيكلة مكلفة لاحقاً عند الحاجة الفعلية للتكامل الخارجي.
**Consequences:** يتطلب من Database Architect مراجعة موارد FHIR الأساسية عند تصميم ERD في مرحلة Database Design (Gate 5).
**Status:** CONFIRMED

## Decision 007 — اللغة والواجهة
**Decision Made:** دعم ثنائي اللغة **عربي (أساسي، RTL) + إنجليزي (ثانوي، LTR)** منذ MVP، مع فصل كامل للنصوص عن الكود (i18n) من اليوم الأول.
**Reason:** طلب صريح من صاحب المشروع، ويتوافق أيضاً مع توصية الدليل الأساسي بفصل النصوص عن الكود من البداية عند التعامل مع تعدد اللغات.
**Status:** CONFIRMED

## Decision 008 — فريق العمل
**Decision Made:** فريق عمل بشري حقيقي سيعمل جنباً إلى جنب مع Claude Code و/أو Codex CLI على نفس Repository.
**Consequences:** يجب إعداد `CLAUDE.md` و`AGENTS.md` بدقة عالية (Gate 6) لأن مستخدمين بشريين سيعتمدون عليهما كمرجع أيضاً، وليس فقط الـ AI.
**Status:** CONFIRMED

## Decision 009 — طبقة التخزين المؤقت (Caching)
**Context:** خادم متوسط الأداء، حجم بيانات مصمَّم لـ10,000+ مريض لكن ليس ضخماً بالمقاييس العالمية.
**Options:** Redis منذ البداية / بلا Cache خارجي في MVP
**Decision Made:** بلا Redis أو Cache خارجي في MVP — Caching داخلي بسيط فقط عند الحاجة.
**Reason:** تجنّب استهلاك ذاكرة إضافي غير مبرَّر على خادم متوسط الأداء قبل إثبات الحاجة الفعلية (قاعدة "عدم الإفراط بالهندسة").
**Consequences:** يُعاد التقييم عند رصد بطء موثَّق فعلياً في MMP/MLP.
**Status:** CONFIRMED

## Decision 010 — إدارة العمليات الخلفية (Background Jobs)
**Context:** حاجة لنسخ احتياطي دوري وأرشفة سجلات دون توفر بنية Cloud أو Queue خارجية.
**Decision Made:** مجدول مهام داخلي (In-process scheduler) بدل خدمة Message Queue منفصلة (RabbitMQ/Kafka).
**Reason:** الحجم الحالي لا يبرر Queue منفصلة؛ يزيد تعقيداً تشغيلياً غير ضروري على خادم واحد On-Premise.
**Status:** CONFIRMED

## Decision 013 — Prescription↔Medication: ربط اختياري لا إلزامي
راجع docs/requirements/SRS-PHARMACY.md — الوصفة تبقى نصاً حراً (Backward Compatible)، والربط بمخزون فعلي يحدث فقط وقت الصرف الفعلي عبر حقول إضافية (Expand فقط). Status: CONFIRMED

## Decision 014 — دور جديد: Pharmacist
توسعة enum Role بإضافة `pharmacist` — تعديل إضافي آمن، صلاحيات الصيدلية مقصورة عليه وعلى Admin. Status: CONFIRMED

## Decision 015 — كمية الصرف رقمية منفصلة عن النص الوصفي الأصلي
`quantityDispensed` حقل رقمي مستقل، لا تحليل آلي لنص dosage/duration. Status: CONFIRMED

## Decision 016 — دور فني واحد موحَّد (lab_tech) للمختبر والأشعة
راجع docs/requirements/SRS-LAB.md — يغطي كلا النوعين بدل دورين منفصلين، تجنّباً لتعقيد صلاحيات غير مبرَّر حالياً. Status: CONFIRMED

## Decision 017 — طلب الفحص مرتبط إلزامياً بـ Encounter
يضمن سياقاً سريرياً واضحاً لكل نتيجة، بعكس الوصفة شبه المستقلة. Status: CONFIRMED

## Decision 018 — دور جديد: Billing Clerk
راجع docs/requirements/SRS-BILLING.md — صلاحيات الفوترة مقصورة عليه وعلى Admin. Status: CONFIRMED

## Decision 019 — لا تكامل بوابة دفع إلكتروني
تسجيل دفعات يدوي بالكامل، يتوافق مع On-Premise بلا إنترنت إلزامي. Status: CONFIRMED

## Decision 020 — مبالغ الفوترة أرقام صحيحة بلا كسور عشرية
تجنّب مشاكل دقة الأعداد العشرية. Status: CONFIRMED

## Decision 021 — لا تخزين إجمالي/حالة فاتورة محسوبين مكرَّرين
تُحسبان ديناميكياً من البنود والدفعات وقت القراءة. Status: CONFIRMED

## Decision 022 — إصلاح Finding #4: سجل احتياطي محلي عند فشل Audit Log
**Context:** فشل صامت سابقاً لكتابة audit_logs عند تعطل DB لحظياً (راجع docs/security/SECURITY-REVIEW.md Finding #4).
**Decision Made:** عند فشل الكتابة بقاعدة البيانات، يُكتب سجل احتياطي فوري محلياً بملف JSON Lines (`logs/audit-fallback.log` افتراضياً، قابل للتخصيص عبر `AUDIT_FALLBACK_LOG_PATH`)، بدل `console.error` فقط.
**Reason:** يضمن عدم فقدان أي حدث تدقيقي حتى مع تعطل DB لحظياً — متطلب أساسي بقانون سوريا 12/2024.
**Consequences:** يحتاج فريق التشغيل مراجعة دورية لمجلد `logs/` واستيراد أي سجلات احتياطية متراكمة لقاعدة البيانات يدوياً بعد استعادة الاتصال (إجراء تشغيلي يُوثَّق لاحقاً في Runbook عند الحاجة الفعلية).
**Status:** CONFIRMED — Finding #4 **RESOLVED**، مُختبَر فعلياً (4 اختبارات وحدة جديدة تثبت الكتابة الاحتياطية تعمل).

## Decision 023 — إصلاح Finding #7: تحقق ترابط المريض/الزيارة عند طلب فحص
**Context:** LabService.createOrder كان يقبل patientId/encounterId بلا تحقق ترابط — خطر سلامة مريض حقيقي.
**Decision Made:** رفض 400 (PATIENT_ENCOUNTER_MISMATCH) إن لم تخص الزيارة المريض المحدَّد.
**Status:** CONFIRMED — مُختبَر فعلياً (2 اختبار جديد).

## Decision 024 — إصلاح Finding #8: توثيق سبب تعديل مخزون الصيدلية فعلياً
**Context:** حقل reason كان يُتحقَّق منه بالـ Validation فقط، يُهمَل بالكود، لا يُخزَّن.
**Decision Made:** إرفاق السبب بنتيجة الـ Endpoint ليلتقطه AuditInterceptor تلقائياً — بلا حاجة لتعديل Schema.
**Status:** CONFIRMED — مُختبَر فعلياً.

## Decision 025 — ترقيات أمنية للاعتماديات (npm audit)
**Context:** 30 ثغرة بالـ Backend (منها Critical بـ`tar` عبر bcrypt القديم)، 7 بالـ Frontend (منها Critical بـ`vitest`).
**Decision Made:**
- Backend: `bcrypt` 5.1.1→6.0.0 (يُصلح Critical+High). NestJS ecosystem (10→12) **لم يُرقَّ** — يتطلب قفزتي إصدار رئيسيتين عبر كل الوحدات مع تغييرات Express 4→5 داخلياً، ولا يمكن التحقق الكامل منه (HTTP Runtime) بهذه البيئة (قيد Prisma المعروف). مؤجَّل لبيئة فعلية بقدرة اختبار E2E كاملة.
- Frontend: `react-router-dom` 6→7 (مُتحقَّق منه ببناء إنتاجي فعلي ناجح)، `vitest`→latest (يُصلح Critical)، `vite` 5→7 + `@vitejs/plugin-react`→4.7 (بدل القفزة لـ8 المتطلَّبة من أحدث إصدار) — **صفر ثغرات متبقية بالـ Frontend**، مُتحقَّق منه ببناء فعلي.
**Consequences:** Backend لا يزال به 27 ثغرة (كلها بتوسعات NestJS الرئيسية أو أدوات Dev لا تُشحَن للإنتاج) — تحتاج ترقية مجدولة منفصلة بخادم حقيقي مع تشغيل كل اختبارات E2E الـ9 المكتوبة أصلاً.
**Status:** CONFIRMED (جزئياً — الجزء الأصعب مؤجَّل بقرار واعٍ لا إهمال).

## Decision 026 — Code Splitting بالواجهة
**Context:** تحذير Vite متكرر بكل بناء (Bundle > 500KB بملف واحد).
**Decision Made:** `manualChunks` بـ`vite.config.ts` يفصل vendor (react/router) وmui كملفات مستقلة — يستفيد Cache المتصفح طويل الأمد منها بين تحديثات التطبيق.
**Status:** CONFIRMED — مُتحقَّق منه ببناء فعلي (لا تحذير بعد الآن، أكبر ملف انخفض من 679KB إلى 369KB).

## Decision 027 — Finding #9 (Billing insurance %) — قرار مفتوح عمداً
راجع docs/security/SECURITY-REVIEW.md Finding #9. لا قيد تقني مفروض حالياً على `insuranceCoveragePercent` — قرار سياسة عمل لا خطأ برمجي، 3 خيارات مطروحة، **بانتظار قرارك الصريح** بدل فرض قيد قد يُعطِّل سير عمل شرعي.
**Status:** OPEN — NEEDS USER DECISION.
