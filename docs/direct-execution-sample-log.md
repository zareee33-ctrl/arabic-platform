# سجل تشغيل نموذجي

> هذا سجل نموذجي يوضح شكل العملية داخل سجل التدقيق. القيم المعروضة مثال توثيقي وليست بيانات طالب حقيقية.

```text
2026-10-03T14:20:00+03:00  ACCEPTED
actor_role=teacher
command="افتح درس الحال"
command_type=lesson.set_published
idempotency_key=0c1f...a8b2

2026-10-03T14:20:00+03:00  RUNNING
resolved_lesson=HAL-01
before.is_published=false

2026-10-03T14:20:01+03:00  SUCCEEDED
result.lesson.code=HAL-01
result.lesson.is_published=true

2026-10-03T14:20:01+03:00  AUDIT
event_type=succeeded
message="تم تنفيذ الأمر بنجاح"
```

## عند التراجع

```text
2026-10-03T14:22:11+03:00  ROLLED_BACK
command_type=lesson.set_published
restored.is_published=false
message="تم التراجع عن الأمر"
```
