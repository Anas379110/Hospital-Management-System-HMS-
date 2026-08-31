# API.md — نظام إدارة المشافي (HMS)

**Base URL (داخلي):** `https://hms.local/api/v1`
**Auth:** Bearer JWT في Header `Authorization` لكل الطلبات ما عدا `/auth/login`.
**Format:** JSON فقط. رسائل الخطأ بصيغة موحدة:
```json
{ "error": { "code": "STRING_CODE", "message": "رسالة بشرية واضحة", "details": [] } }
```

---

## Auth Module

| Method | Endpoint | الوصف | صلاحية |
|---|---|---|---|
| POST | `/auth/login` | تسجيل دخول (username+password) → JWT | عام |
| POST | `/auth/logout` | إبطال الجلسة الحالية | مصادَق عليه |
| GET | `/auth/me` | بيانات المستخدم الحالي | مصادَق عليه |
| POST | `/users` | إنشاء مستخدم جديد | Admin فقط |
| PATCH | `/users/{id}/status` | تفعيل/تعطيل مستخدم | Admin فقط |

## Patients Module

| Method | Endpoint | الوصف | صلاحية |
|---|---|---|---|
| POST | `/patients` | تسجيل مريض جديد (يُنشئ MRN تلقائياً) | Receptionist, Admin |
| GET | `/patients?search=` | بحث بالاسم/MRN/الهاتف | Receptionist, Doctor, Nurse, Admin, Manager |
| GET | `/patients/{id}` | بيانات مريض كاملة | كل الأدوار المصادَق عليها |
| PATCH | `/patients/{id}` | تعديل بيانات مريض | Receptionist, Admin |
| GET | `/patients/{id}/records` | السجل الطبي الكامل (Encounters + Prescriptions) | Doctor, Nurse, Admin |

## Appointments Module

| Method | Endpoint | الوصف | صلاحية |
|---|---|---|---|
| POST | `/appointments` | حجز موعد (يرفض التعارض تلقائياً) | Receptionist, Admin |
| GET | `/appointments?doctor_id=&date=` | جدول مواعيد طبيب ليوم/أسبوع | Receptionist, Doctor, Admin |
| PATCH | `/appointments/{id}` | تعديل موعد | Receptionist, Admin |
| POST | `/appointments/{id}/cancel` | إلغاء موعد (مع سبب) | Receptionist, Admin |

## EMR Module

| Method | Endpoint | الوصف | صلاحية |
|---|---|---|---|
| POST | `/encounters` | تسجيل زيارة جديدة (تشخيص، ملاحظات) | Doctor |
| GET | `/encounters/{id}` | تفاصيل زيارة | Doctor, Nurse, Admin |
| POST | `/encounters/{id}/prescriptions` | إضافة وصفة لزيارة | Doctor |
| DELETE | `/encounters/{id}` | حذف منطقي (Soft Delete + سبب إلزامي) | Doctor (لسجله فقط) أو Admin |

## Departments & Beds Module

| Method | Endpoint | الوصف | صلاحية |
|---|---|---|---|
| GET | `/departments` | قائمة الأقسام | كل الأدوار |
| GET | `/departments/{id}/beds` | أسرّة القسم وحالتها | Nurse, Doctor, Admin, Manager |
| GET | `/departments/{id}/beds/summary` | إحصائية سريعة (متاح/مشغول/صيانة) | Manager, Admin |
| POST | `/admissions` | تسكين مريض في سرير | Nurse, Doctor |
| POST | `/admissions/{id}/discharge` | تفريغ/خروج مريض | Nurse, Doctor |

---

## قواعد عامة لكل Endpoint
- **Pagination:** `?page=&limit=` لكل قوائم (افتراضي limit=20، أقصى 100).
- **Error Codes:** `400` بيانات غير صالحة، `401` غير مصادَق، `403` غير مخوَّل، `404` غير موجود، `409` تعارض (مثال: سرير مشغول/موعد متعارض)، `500` خطأ خادم.
- **Versioning:** `/api/v1/` — أي تغيير Breaking يذهب لـ `/api/v2/` مستقبلاً، لا تعديل مباشر على v1 القائم.
- **Rate Limiting:** غير حرج لبيئة On-Premise معزولة، لكن يُفعَّل حد أساسي (مثل 100 طلب/دقيقة لكل مستخدم) كحماية من إساءة استخدام داخلية أو خلل برمجي متكرر.

راجع `docs/api/openapi.yaml` للتوثيق الكامل بصيغة OpenAPI.

## Pharmacy Module (Slice 5 — MMP)

| Method | Endpoint | الوصف | صلاحية |
|---|---|---|---|
| GET | `/medications` | قائمة المخزون | Pharmacist, Admin |
| POST | `/medications` | إضافة دواء جديد للمخزون | Pharmacist, Admin |
| PATCH | `/medications/{id}/stock` | تعديل الكمية (إعادة تعبئة/تصحيح) مع سبب | Pharmacist, Admin |
| GET | `/medications/low-stock` | أدوية بحاجة لإعادة طلب (FR-6.5) | Pharmacist, Admin |
| GET | `/prescriptions/pending` | قائمة الوصفات بانتظار الصرف (FR-6.2) | Pharmacist, Admin |
| POST | `/prescriptions/{id}/dispense` | صرف وصفة — خصم مخزون ذري (FR-6.3/6.4) | Pharmacist, Admin |

خطأ نقص المخزون: `409` بكود `INSUFFICIENT_STOCK`.
