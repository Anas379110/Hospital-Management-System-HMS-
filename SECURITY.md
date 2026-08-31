# SECURITY.md — نظام إدارة المشافي (HMS)

## المبادئ الأساسية
- Authentication: JWT (قصير الأمد، 8 ساعات افتراضياً — قابل للتعديل حسب سياسة المشفى).
- Authorization: RBAC مركزي عبر Guards — لا فحص صلاحيات متفرق داخل كل Controller.
- Input Validation: DTO + class-validator لكل مدخل — لا ثقة بأي بيانات من العميل.
- Password Hashing: bcrypt (salt rounds ≥ 10) — لا تخزين نص صريح تحت أي ظرف.
- Secrets Management: متغيرات بيئة فقط (`.env`)، غير مرفوعة لـ Git، لا Secrets Hardcoded.

## حماية من الثغرات الشائعة (OWASP Top 10)
| الثغرة | الحماية في HMS |
|---|---|
| SQL Injection | Prisma ORM (Parameterized Queries تلقائياً) — ممنوع Raw Query غير آمن |
| XSS | React يُهرب المحتوى تلقائياً؛ ممنوع `dangerouslySetInnerHTML` بلا تعقيم صريح |
| CSRF | API بلا Cookies للجلسة (JWT في Header) يقلل الخطر جوهرياً؛ CORS مضبوط لمصدر الواجهة فقط |
| Broken Auth | JWT + bcrypt + انتهاء صلاحية إلزامي |
| Broken Access Control | RBAC Guard إلزامي على كل Endpoint محمي، تحقق مزدوج (Frontend يخفي الروابط + Backend يرفض الطلب فعلياً) |
| Sensitive Data Exposure | لا كلمات مرور/بيانات حساسة في Logs أو Responses؛ HTTPS داخل الشبكة الداخلية |
| Security Misconfiguration | `.env.example` بلا قيم حقيقية؛ NODE_ENV=production يعطل رسائل الخطأ التفصيلية للمستخدم |

## Audit Trail
كل عملية Create/Update/Delete على: `patients`, `encounters`, `prescriptions`, `admissions`, `users` تُسجَّل تلقائياً في `audit_logs` عبر Interceptor مشترك (من نفَّذ، متى، ماذا تغيّر — old/new value). هذا الجدول Append-only، لا حذف ولا تعديل من طبقة التطبيق.

## الامتثال القانوني (سوريا — Law No. 12/2024)
- سياسة احتفاظ بيانات (Retention Policy) تُحدَّد رسمياً قبل الإطلاق الفعلي (تُفصَّل عند DEPLOYMENT.md، **NEEDS RESEARCH قانوني إضافي**).
- تشفير البيانات الحساسة أثناء النقل (HTTPS) إلزامي حتى داخل الشبكة الداخلية.
- توصية: استشارة قانونية محلية متخصصة قبل الإطلاق الفعلي على مرضى حقيقيين — هذا التوثيق تقني لا بديل عن ذلك.

## مراجعة أمنية إلزامية لكل Feature
راجع `.claude/skills/security-review/SKILL.md` — يُطبَّق قبل اعتبار أي Feature تلمس بيانات مريض "مكتملة".

## Dependency Scanning
يُنصح بتشغيل `npm audit` دورياً (أداة مجانية مدمجة، تتوافق مع Decision 004 بلا خدمات مدفوعة) قبل كل Release.
