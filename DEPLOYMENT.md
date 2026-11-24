# DEPLOYMENT.md — خطة النشر

**الحالة:** لم يُنشر على خادم مشفى. نُفذت ترحيلات واختبارات محلية بقاعدة PostgreSQL وبيانات خيالية، واختبار نسخ واستعادة إلى قاعدة منفصلة. راجع HMS-QUALIFICATION-20261124.md وBACKUP-RESTORE-QUALIFICATION.md للنتائج وحدودها. بوابة التحقق النهائي للمرشح ما زالت غير مكتملة.

## 1. Hosting
On-Premise بالكامل داخل المشفى (Decision 003) — لا Cloud، لا اعتماد إنترنت خارجي للوظائف الأساسية.

## 2. مواصفات الخادم
متوسط الأداء (Decision 005) — **NEEDS USER DECISION**: أرقام دقيقة (CPU/RAM/Storage) لم تُحدَّد بعد. توصية أولية للبدء الآمن:
- CPU: 4 أنوية على الأقل
- RAM: 8GB على الأقل (Node.js + PostgreSQL على نفس الخادم في هذه المرحلة)
- Storage: SSD يفضَّل (أداء قواعد بيانات)، مساحة كافية لنمو بيانات 10,000+ مريض + نسخ احتياطية محلية
- نظام التشغيل: Ubuntu Server LTS (راجع TECH-STACK.md)
- **UPS إلزامي** (راجع ARCHITECTURE.md §7 — انقطاع الكهرباء خطر مسجَّل بالسياق السوري)

## 3. خطوات النشر الأولى (لم تُنفَّذ بعد — هذا هو الترتيب المطلوب فعلياً)
```bash
# 1. تثبيت المتطلبات على الخادم
sudo apt update && sudo apt install -y nodejs postgresql nginx

# 2. إعداد قاعدة البيانات
sudo -u postgres createdb hms_db
sudo -u postgres createuser hms_user --pwprompt

# 3. Backend
cd backend
npm install
cp ../.env.example .env  # عدّل DATABASE_URL, JWT_SECRET (قيمة عشوائية قوية فعلية)، FRONTEND_URL
npx prisma migrate deploy   # ⚠️ أول تنفيذ فعلي لهذا الأمر بكل تاريخ المشروع — راجع النتيجة بعناية
# طبّق يدوياً: database/migrations/manual-sql/appointments_unique_partial_index.sql
# لا تشغّل seed في الإنتاج، فهو ينشئ حسابات تطوير بكلمة مرور افتراضية
npm run build
pm2 start dist/src/main.js --name hms-backend   # أو systemd، راجع TECH-STACK.md

# 4. Frontend
cd frontend
npm install
npm run build
# انسخ frontend/dist/ لمجلد Nginx (مثال: /var/www/hms)

# 5. Nginx (Reverse Proxy)
# - يوجّه / إلى frontend/dist (Static)
# - يوجّه /api إلى http://localhost:3000
# - TLS داخلي (شهادة ذاتية التوقيع أو CA داخلي للمشفى)
```

## 4. Environments
- **development**: محلي على أجهزة المطورين (كما استُخدم طوال هذا المشروع)
- **staging**: **NEEDS USER DECISION** — هل يوجد خادم اختبار منفصل قبل الإنتاج؟ موصى به قبل نقل بيانات مرضى حقيقيين.
- **production**: الخادم الفعلي داخل المشفى

لا تُستخدم قاعدة بيانات Production أثناء التطوير أو الاختبار — قاعدة منفصلة دائماً (`hms_db` إنتاج، `hms_test` اختبار، راجع `TESTING.md`).

## 5. Backup & Recovery (Draft — يحتاج اختباراً فعلياً بعد النشر)
- **التكرار:** نسخ احتياطي يومي تلقائي (`pg_dump` مجدول عبر Background Job داخلي — راجع ARCHITECTURE.md §10)
- **الاحتفاظ:** **NEEDS USER DECISION** — كم يوم/شهر يُحتفَظ بالنسخ؟ (يتقاطع مع سياسة الاحتفاظ القانونية بقانون سوريا 12/2024، راجع SECURITY.md)
- **التخزين:** وسيط منفصل فعلياً عن خادم الإنتاج (قرص خارجي/خادم ثانٍ) — لا نسخ احتياطي على نفس القرص فقط
- **RTO/RPO:** **NEEDS USER DECISION** — لم تُحدَّد أرقام مستهدفة بعد
- **⚠️ لا تُعتبر أي استراتيجية Backup ناجحة حتى يُختبَر الاستعادة (Restore) فعلياً** — لم يحدث بعد

## 6. Monitoring & Logging
- Health Check: `GET /health` (يُضاف إن لم يوجد بعد — تحقق قبل الاعتماد عليه)
- سجلات محلية منظَّمة (Winston + Daily Rotate) — راجع TECH-STACK.md
- لا أدوات Cloud Monitoring (Datadog/Sentry) — بيئة معزولة (راجع ARCHITECTURE.md §11)
- **NEEDS USER DECISION**: هل يُضاف Grafana+Prometheus محلياً لاحقاً؟ غير حرج لبداية الاستخدام.

## 7. Rollback Plan
- **NEEDS USER DECISION / TODO**: لا خطة Rollback موثَّقة بعد بخطوات محددة. الحد الأدنى المقترح:
  1. إيقاف الخدمة الجديدة (`pm2 stop hms-backend`)
  2. استعادة آخر نسخة كود ناجحة معروفة (Git tag/commit)
  3. استعادة نسخة DB الاحتياطية إن تغيّر Schema بشكل غير متوافق
  4. إعادة التشغيل والتحقق

## 8. قبل أول استخدام فعلي على مرضى حقيقيين — Checklist
- [ ] `prisma migrate deploy` نُفِّذ فعلياً بنجاح على DB حقيقية
- [ ] كل كلمات المرور التجريبية (`ChangeMe123!`) غُيِّرت
- [ ] `JWT_SECRET` قيمة عشوائية قوية حقيقية (لا القيمة الافتراضية)
- [ ] Backup يومي مُفعَّل ومُختبَر (Restore فعلي مرة واحدة على الأقل)
- [ ] UAT (راجع `docs/testing/UAT-PLAN.md`) نُفِّذ فعلياً وأُغلقت كل الـ Bugs الحرجة
- [ ] Finding #4 (`SECURITY-REVIEW.md`) محسوم بقرار صريح
- [ ] استشارة قانونية محلية حول سياسة الاحتفاظ بالبيانات (راجع `SECURITY.md`)
