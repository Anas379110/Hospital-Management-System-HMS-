---
name: database-migration
description: استخدم هذه المهارة عند أي تعديل على database/schema.prisma أو الحاجة لـ Migration جديدة — تضمن اتباع Expand-Migrate-Contract وعدم فقدان بيانات.
---

# تعديل قاعدة البيانات بأمان — HMS

## متى تُستدعى
عند طلب إضافة جدول/عمود جديد، تعديل علاقة، أو أي تغيير في `database/schema.prisma`.

## Preconditions
- راجع `docs/database/DATABASE.md` و `docs/database/ERD.mmd` أولاً — تأكد أن التغيير المطلوب لا يتعارض مع تصميم موجود.
- إذا كان التغيير سيحذف عموداً أو جدولاً مستخدَماً فعلياً: توقف وطبّق Expand→Migrate→Contract (لا تحذف مباشرة).

## خطوات التنفيذ
1. عدّل `database/schema.prisma` (استخدم camelCase بالكود مع `@map` لـ snake_case في DB، اتساقاً مع الملف الحالي).
2. شغّل `npx prisma migrate dev --name <وصف_واضح>` محلياً.
3. راجع ملف الـ Migration المُولَّد يدوياً قبل القبول — تأكد أنه لا يحذف بيانات موجودة بشكل غير مقصود.
4. إن احتجت Unique/Partial Index لا يدعمه Prisma مباشرة (كحالة `appointments` الحالية)، أضفه يدوياً في ملف SQL الخاص بالـ Migration.
5. حدِّث `docs/database/DATABASE.md` و `docs/database/ERD.mmd` ليطابقا التغيير.
6. أضف/حدِّث Seed Data إن لزم في `database/seeds/`.
7. اكتب اختباراً يتحقق من القيد الجديد (مثال: محاولة إدخال بيانات تخالف Constraint يجب أن تفشل).

## Rules
- لا Hard Delete على أي عمود يحتوي بيانات مريض أو طبية دون Expand→Migrate→Contract كاملة.
- لا تشغّل Migration مباشرة على بيئة تشبه Production دون مراجعة بشرية.

## Expected Output
Schema محدَّث + Migration مُختبرة + DATABASE.md/ERD.mmd متطابقان مع الواقع.
