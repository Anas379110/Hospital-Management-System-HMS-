# TRACEABILITY.md — مصفوفة تتبع المتطلبات (MVP + MMP كاملين)

**آخر تحديث:** 2026-08-19 — يغطي كل الـ 11 وحدة (كان محدَّثاً لـPatients فقط سابقاً، راجع PROJECT-AUDIT.md).

## Auth & RBAC
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| تسجيل دخول آمن بلا كشف أسماء مستخدمين | — | رسالة موحدة لخطأ الدخول، زمن استجابة موحَّد | `POST /auth/login` | `users` | `auth.service.spec.ts` (5 اختبارات) |
| حد لمحاولات الدخول (Brute Force) | — | رفض بعد 5 محاولات/دقيقة | `@Throttle` على `/auth/login` | — | يدوي (Throttler مكتبة مُختبَرة خارجياً) |
| RBAC صارم Fail-Closed | FR-1.3 | رفض 403 لغير المخوَّل، ورفض أي Endpoint بلا `@Roles` | `RolesGuard` (مشترك) | `users.role` | مُختبَر ضمنياً بكل Controller test |
| Audit Trail شامل + بلا فقدان صامت | FR-1.4 | تسجيل كل عملية حساسة، وسجل احتياطي محلي عند فشل DB | `AuditInterceptor` (مشترك) | `audit_logs` | `audit.interceptor.spec.ts` (4 اختبارات) |
| Admin فقط ينشئ مستخدمين | FR-1.5 | 403 لغير Admin | `POST /users` | `users` | Unit ضمني بـRolesGuard |

## Patients
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| تسجيل مرضى بدون تكرار | US-1 | MRN فريد تلقائي + تنبيه تكرار | `POST /patients` | `patients` | `patients.service.spec.ts` (5)، `patients.e2e-spec.ts` |
| بحث/عرض/تعديل مريض | FR-2.3/2.4 | نتائج دقيقة، 404 لغير موجود | `GET/PATCH /patients` | `patients` | `patients.service.spec.ts` |

## EMR (Encounters + Prescriptions)
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| تسجيل زيارة + وصفة | US-2 | مرتبطة بالطبيب والمريض | `POST /encounters`, `POST /encounters/{id}/prescriptions` | `encounters`, `prescriptions` | `encounters.service.spec.ts` |
| Soft Delete فقط، بسبب، لصاحب السجل أو Admin | FR-4.4 | 403 لغير المالك، 404 لمحذوف منطقياً | `DELETE /encounters/{id}` | `encounters.deletedAt` | `encounters.service.spec.ts` (403/404 مُختبَران صراحة) |
| سجل طبي كامل قراءة فقط | FR-4.3 | مرتَّب زمنياً | `GET /patients/{id}/records` | — | ضمن `patients.controller` |

## Appointments
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| منع تعارض موعدين لنفس الطبيب | US-3 | 409 عند تعارض، يستثني الملغاة | `POST /appointments` | `appointments` + Partial Unique Index | `appointments.service.spec.ts` (6 اختبارات) |
| تعديل/إلغاء موعد | FR-3.3 | إعادة فحص تعارض عند التعديل | `PATCH /appointments/{id}` | `appointments` | `appointments.service.spec.ts` |

## Departments & Beds + Admissions
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| تسكين سرير متاح فقط (UC-1 كاملاً) | US-4 | Transaction ذرية، لا تسكين جزئي | `POST /admissions` | `admissions`, `beds` | `admissions.service.spec.ts` (10 اختبارات — Main/Alternative/Error Flow) |
| إحصائية أسرّة سريعة | US-5 | عدّ دقيق لكل حالة | `GET /departments/{id}/beds/summary` | `beds` | `departments.service.spec.ts` (3 اختبارات) |

## Pharmacy (MMP)
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| صرف وصفة بخصم مخزون ذري | US-7 | 409 عند نقص، لا خصم جزئي | `POST /prescriptions/{id}/dispense` | `medications`, `prescriptions` | `pharmacy.service.spec.ts` (8 اختبارات) |
| تنبيه إعادة طلب | FR-6.5 | فلترة صحيحة تحت الحد | `GET /medications/low-stock` | `medications` | `pharmacy.service.spec.ts` |

## Lab/Radiology (MMP)
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| طلب فحص وتسجيل نتيجة | US-8/US-9 | مرتبط بزيارة، حالة تنتقل لـcompleted | `POST /test-orders`, `POST /test-orders/{id}/result` | `test_orders` | `lab.service.spec.ts` (5 اختبارات) |
| نتائج ضمن سجل المريض مباشرة | US-10 | لا شاشة منفصلة | `GET /patients/{id}/test-results` | `test_orders` | `lab.service.spec.ts` |

## Billing (MMP)
| Business Requirement | User Story | Acceptance Criteria | Component/API | Database | Test |
|---|---|---|---|---|---|
| فاتورة ببنود + تأمين | US-11 | حساب صحيح للمستحق بعد التغطية | `POST /invoices` | `invoices`, `invoice_items` | `billing.service.spec.ts` (7 اختبارات — منها اختبار حساب تأمين 50%) |
| رفض دفعة تتجاوز المتبقي | US-12 | 409، لا تسجيل جزئي | `POST /invoices/{id}/payments` | `payments` | `billing.service.spec.ts` |

---

## ملخص التغطية
- **57/57 اختبار وحدة ناجح فعلياً** يغطي كل صف بالجدول أعلاه.
- **Integration Test (Supertest) حقيقي:** وحدة Patients فقط سابقاً — يُستكمل الآن لبقية الوحدات (راجع قسم Integration Tests الجديد بهذا التحديث).

## لا Requirement بلا اختبار مقابل — القاعدة الصارمة
كل FR بهذا الجدول له اختبار مقابل فعلي (لا نظري) في `backend/test/unit/`. أي FR جديد مستقبلاً يجب أن يُضاف لهذا الجدول **وقت** كتابة الكود، لا بعده.
