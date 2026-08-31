#!/bin/bash
# .claude/hooks/pre-commit-secrets-check.sh
# يُستدعى تلقائياً عند حدث PreToolUse لأمر git commit
# يمنع رفع: ملفات حساسة، مفاتيح API، وملفات بيانات مرضى تجريبية بصيغ خام

set -e

# 1. منع ملفات حساسة معروفة
if git diff --cached --name-only | grep -qE '\.env$|\.pem$|\.key$|settings\.local\.json$'; then
  echo "❌ رُفض الـ Commit: ملف حساس ضمن التغييرات (env/key/pem/settings.local.json)"
  exit 1
fi

# 2. فحص محتوى التغييرات بحثاً عن مفاتيح API/Secrets صريحة
if git diff --cached | grep -qiE '(api[_-]?key|secret|password)\s*[:=]\s*["\047][A-Za-z0-9]{12,}'; then
  echo "❌ رُفض الـ Commit: يبدو أن هناك مفتاح API أو كلمة مرور صريحة بالكود"
  exit 1
fi

# 3. حماية إضافية خاصة بمشروع HMS: منع رفع ملفات CSV/JSON/SQL تبدو كتفريغ بيانات مرضى حقيقية
if git diff --cached --name-only | grep -qE '\.(csv|sql)$' ; then
  echo "⚠️  تنبيه: يوجد ملف .csv أو .sql ضمن التغييرات."
  echo "تأكد يدوياً أنه بيانات Seed تجريبية فقط وليس بيانات مرضى حقيقية قبل المتابعة."
  echo "إذا كنت متأكداً أنه آمن، أعد المحاولة بعد المراجعة اليدوية (هذا تنبيه لا حجب تلقائي)."
fi

exit 0
