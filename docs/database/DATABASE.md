# DATABASE.md — نظام إدارة المشافي (HMS)

## 1. Business Entities (نطاق MVP)
User, Patient, Appointment, Encounter, Prescription, Department, Bed, Admission, AuditLog

## 2. العلاقات الرئيسية
- User (1) — (N) Appointment [كطبيب]
- User (1) — (N) Encounter [كطبيب]
- Patient (1) — (N) Appointment
- Patient (1) — (N) Encounter
- Patient (1) — (N) Admission
- Encounter (1) — (N) Prescription
- Department (1) — (N) Bed
- Bed (1) — (N) Admission (زمنياً — سرير واحد لعدة تسكينات متعاقبة عبر الزمن، ليس بنفس اللحظة)
- Appointment (0..1) — (0..1) Encounter (الزيارة قد تنشأ من موعد، أو تكون طارئة بلا موعد)

راجع `docs/database/ERD.mmd` للتمثيل المرئي الكامل.

## 3. ملاحظات تصميم مهمة
- **MRN (Medical Record Number):** يُولَّد تلقائياً بصيغة تسلسلية (مثال: `HMS-000001`) عند إنشاء مريض جديد — Unique constraint صارم.
- **Soft Delete على Encounters:** لا حذف نهائي للسجل الطبي — استخدام `deleted_at` + `delete_reason` (متطلب قانوني/تدقيقي، راجع FR-4.4).
- **منع تعارض المواعيد:** Unique Partial Index على `(doctor_id, scheduled_at)` حيث `status != 'cancelled'`.
- **تسكين سرير:** Transaction ذرية تتحقق من `beds.status = 'available'` قبل التحديث، لمنع Race Condition عند طلبين متزامنين (راجع ARCHITECTURE.md §4).
- **Audit Logs:** جدول مستقل غير قابل للتعديل أو الحذف من طبقة التطبيق (Append-only) — `old_value`/`new_value` كـ JSONB لمرونة تسجيل أي نوع تغيير.
- **توافق FHIR مستقبلي (Decision 006):** حقول `patients` و`encounters` صُمِّمت بأسماء ومفاهيم قريبة من موارد FHIR (`Patient`, `Encounter`, `Condition`) لتسهيل التعيين (Mapping) لاحقاً دون إعادة هيكلة جذرية.

## 4. Schema (ملخص الأعمدة الأساسية)

### users
`id (uuid, pk)`, `username (unique)`, `password_hash`, `full_name`, `role (enum: admin|receptionist|doctor|nurse|manager)`, `is_active (bool)`, `created_at`, `updated_at`

### patients
`id (uuid, pk)`, `mrn (unique, auto)`, `full_name`, `date_of_birth`, `gender (enum: male|female)`, `national_id (nullable)`, `phone`, `address (nullable)`, `emergency_contact_name (nullable)`, `emergency_contact_phone (nullable)`, `created_by (fk users)`, `created_at`, `updated_at`

### appointments
`id (uuid, pk)`, `patient_id (fk)`, `doctor_id (fk users)`, `department_id (fk)`, `scheduled_at (timestamp)`, `status (enum: scheduled|completed|no_show|cancelled)`, `cancel_reason (nullable)`, `created_at`, `updated_at`

### encounters
`id (uuid, pk)`, `patient_id (fk)`, `doctor_id (fk users)`, `appointment_id (fk, nullable)`, `chief_complaint`, `diagnosis`, `notes (text, nullable)`, `encounter_date`, `deleted_at (nullable)`, `delete_reason (nullable)`, `created_at`

### prescriptions
`id (uuid, pk)`, `encounter_id (fk)`, `medication_name`, `dosage`, `duration`, `notes (nullable)`, `created_at`

### departments
`id (uuid, pk)`, `name_ar`, `name_en`, `total_beds (int)`, `created_at`

### beds
`id (uuid, pk)`, `department_id (fk)`, `bed_number`, `status (enum: available|occupied|maintenance)`, `created_at`, `updated_at`

### admissions
`id (uuid, pk)`, `patient_id (fk)`, `bed_id (fk)`, `admitted_by (fk users)`, `admitted_at`, `discharged_at (nullable)`, `discharge_notes (nullable)`

### audit_logs
`id (uuid, pk)`, `user_id (fk)`, `action`, `entity_type`, `entity_id`, `old_value (jsonb, nullable)`, `new_value (jsonb, nullable)`, `created_at`

## 5. Indexes الأساسية (لخادم متوسط الأداء — راجع ARCHITECTURE.md §8)
- `patients(mrn)` unique
- `patients(full_name, date_of_birth)` — لتسريع فحص التكرار (FR-2.5)
- `appointments(doctor_id, scheduled_at)` unique partial (status != cancelled)
- `appointments(patient_id)`
- `encounters(patient_id, encounter_date)`
- `beds(department_id, status)` — لتسريع لوحة الإحصائيات (US-5)
- `audit_logs(entity_type, entity_id)`

## 6. Migration Strategy
- أداة: **Prisma Migrate** (راجع TECH-STACK.md).
- كل تغيير Schema يمر عبر: `prisma migrate dev` محلياً → مراجعة → `prisma migrate deploy` على الخادم.
- ممنوع حذف عمود مباشرة على Production — اتباع Expand→Migrate→Contract (كما يوصي الدليل الأساسي):
  1. Expand: إضافة العمود/الجدول الجديد دون حذف القديم
  2. Migrate: نقل البيانات وتحديث الكود ليستخدم الجديد
  3. Contract: حذف القديم بعد التأكد من عدم استخدامه

## 7. Seed Data
`database/seeds/` يحتوي بيانات أولية للتطوير والاختبار: مستخدم Admin افتراضي، أقسام تجريبية (باطنية، جراحة، طوارئ) مع أسرّة، لا بيانات مرضى حقيقية إطلاقاً (خصوصية).

## 8. توسعة Slice 5 — Pharmacy (MMP)
راجع `docs/requirements/SRS-PHARMACY.md` و Decisions 013–015.

### medications (جديد)
`id`, `name (unique)`, `unit`, `current_stock (int, default 0)`, `reorder_threshold (int, default 10)`, `created_at`, `updated_at`

### prescriptions (توسعة — Expand فقط، لا تغيير على الحقول القائمة)
إضافة: `status (enum: pending|dispensed|unavailable, default pending)`, `medication_id (fk medications, nullable)`, `quantity_dispensed (int, nullable)`, `dispensed_at (nullable)`, `dispensed_by (fk users, nullable)`

### Role enum (توسعة)
إضافة قيمة `pharmacist`.

### قاعدة الصرف الذرية
الصرف (خصم المخزون + تحديث حالة الوصفة) يتم ضمن `prisma.$transaction` واحدة — بنفس نمط `AdmissionsService` (راجع ARCHITECTURE.md §4)، لمنع خصم جزئي أو تعارض تزامن بين صيدليين.
