-- database/migrations/manual-sql/appointments_unique_partial_index.sql
--
-- خط الدفاع الثاني ضد تعارض حجز موعدين لنفس الطبيب بنفس الوقت (FR-3.2).
-- خط الدفاع الأول هو الفحص التطبيقي في AppointmentsService.assertNoConflict()
-- لكنه لا يحمي بالكامل من Race Condition عند طلبين متزامنين تماماً — هذا
-- الـ Index يضمن الحماية على مستوى قاعدة البيانات نفسها.
--
-- Prisma Schema لا يدعم Partial Unique Index مباشرة حتى إصدار هذا الملف
-- (راجع تعليق في database/schema.prisma ضمن model Appointment)، لذا يُضاف
-- يدوياً بعد كل `prisma migrate dev` عبر ملف migration.sql المُولَّد تلقائياً،
-- أو يُنفَّذ مباشرة كخطوة يدوية موثَّقة هنا.
--
-- طريقة التطبيق:
-- 1. بعد npx prisma migrate dev --name init (أو أي migration لاحقة تمس appointments)
-- 2. نفّذ هذا الـ SQL يدوياً على قاعدة البيانات، أو أضفه لملف الـ migration.sql
--    المُولَّد قبل تطبيقه (migrate dev يسمح بتعديل الملف قبل التنفيذ الفعلي)

CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_time_unique
ON appointments (doctor_id, scheduled_at)
WHERE status != 'cancelled';
